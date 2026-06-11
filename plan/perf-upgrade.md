# Performance Upgrade Plan - GPU-Resident ULG Runtime

Date: 2026-06-08 AKDT

## Purpose

Record the performance direction needed for ULG to have a credible path toward
interactive and eventually 60 Hz simulations. The goal is not to pivot away from
the core contract/provenance architecture. The goal is to keep contracts,
validation, closure provenance, and artifact hashing out of the per-frame hot
loop while moving simulation state, material sampling, phase updates, gas
pressure, wall heat exchange, and rendering into WebGPU-resident buffers.

## Core Position

The current contract work is still useful, but it must be control-plane work:

- validate closure artifacts,
- verify schemas and overclaim guards,
- resolve closure validity domains,
- hash and bind closure inputs,
- build bind groups and pipeline layouts,
- report provenance and diagnostics.

It must not become per-particle or per-frame CPU overhead. The hot loop should
look like:

1. CPU validates contracts once.
2. CPU uploads compact closure tables, coefficients, scenario constants, and UI
   controls into GPU buffers.
3. WebGPU compute kernels update particle, gas, wall, phase, and render state.
4. Three.js/WebGPU rendering consumes the latest GPU buffers directly.
5. CPU reads back only small summary buffers every few frames.

Whole particle buffers should not be copied back to JavaScript during normal
simulation. Readback should be limited to diagnostics such as pressure,
conservation residuals, phase mass totals, wall heat ledgers, closure status,
and readiness blockers.

## Current Gap

The current implementation is not yet this architecture:

- CPU-reference carrier runtime is authoritative.
- WebGPU exists as an optional toy/parity path.
- Closure tables have WGSL/buffer descriptors, which is good groundwork.
- Contracts, artifact summaries, closure registry, validation, and refresh
  handling are mostly JavaScript/CPU control-plane code.
- Simulation layers are not yet persistent WebGPU systems passing buffers
  directly between SPH, EOS, phase, gas, wall, and renderer kernels.

This performance plan is therefore a significant implementation upgrade, but it
is not a conceptual pivot. It is the natural next stage if ULG is expected to
run real-time material and SPH demos.

## GPU-Resident Runtime Target

All frame-loop simulation layers should communicate through WebGPU buffers:

- SPH particle state:
  - position,
  - velocity,
  - mass,
  - smoothing length,
  - density,
  - pressure,
  - internal energy,
  - temperature,
  - phase fractions,
  - material id,
  - represented molecule/atom count.
- Closure data:
  - EOS tables,
  - phase-equilibrium tables,
  - viscosity and transport tables,
  - mechanical property tables,
  - optical/radiation tables,
  - wall boundary tables,
  - validity-domain metadata.
- Neighbor/grid data:
  - spatial hashes,
  - cell offsets,
  - sorted particle indices,
  - pair lists or tile-local neighbor lists.
- Gas/steam data:
  - species densities,
  - temperature,
  - pressure,
  - H2O vapor mass,
  - condensation state,
  - partial pressures.
- Wall data:
  - six absolute side temperatures,
  - per-side heat flux,
  - cumulative per-side energy exchanged,
  - boundary model flags.
- Render data:
  - color,
  - opacity,
  - emissive intensity,
  - phase classification,
  - particle/volume draw buffers.
- Optional nuclear/radiation data:
  - isotope inventory records,
  - decay constants and branching tables,
  - fission/fusion channel tables,
  - neutron/gamma/charged-particle transport bins,
  - radiation energy and dose/deposition fields,
  - activation and daughter-product ledgers.

The CPU should bind these resources and dispatch kernels. It should not inspect
or transform them per particle each frame.

## Current Optical/PBR Checkpoint

As of 2026-06-10 22:36 AKDT, the optical/PBR chain has its first GPU-facing
ABI, scene bridge, and live optional browser WebGPU execution path. ULG can pack
closure-derived PBR/spectral records into stable WebGPU storage-buffer layouts,
assign stable element/compound material ids, build material/phase lookup rows
for active SPH surface batches, execute the lookup kernel in Chromium WebGPU,
accept the result only after CPU parity passes, and decode the accepted output
into draw-state rows applied to the visible Three.js surfaces. The visible demo
still renders through Three.js `MeshPhysicalMaterial`, so this is not yet the
final GPU-resident renderer or SPH hot loop. The next upgrade is to bind these
packed buffers and lookup outputs into WebGPU draw resources directly, then add
GPU-resident SPH particle state buffers.

The SPH particle-buffer ABI/runtime slice now exists as
`peercompute.ulg.sph-gpu-particle-buffer.v0`. It packs CPU-authoritative SPH
particles into f32x4-aligned state and thermo storage-buffer rows using shared
material/phase ids and closure-derived temperature/phase fractions. The live
SPH overlay now builds and optionally uploads this packed particle snapshot to a
cached browser WebGPU device. It is not yet consumed by a GPU mechanics kernel.

The MLS-MPM mechanics-state buffer ABI/runtime slice also exists as
`peercompute.ulg.mls-mpm-gpu-particle-buffer.v0`. It packs deformation gradient,
affine APIC velocity field, volume ratio, rest volume, and solid flag into
f32x4-aligned WebGPU rows. As of 2026-06-10 23:10 AKDT, the live SPH overlay
builds that mechanics snapshot every particle sync and uploads it to a cached
browser WebGPU device beside the SPH state/thermo snapshot. This prepares
P2G/G2P mechanics residency without claiming a GPU mechanics solver.

As of 2026-06-10 23:25 AKDT, ULG also has the first GPU-executed mechanics
prediction kernel. `mlsMpmMechanicsPredictWgsl` consumes the resident SPH state,
SPH thermo, and MLS-MPM mechanics buffers, predicts particle-local velocity,
position, deformation gradient `F`, and volume ratio `J`, and exposes a
parity-gated execution artifact. This is useful residency/dispatch proof, not
the final mechanics loop: no neighbor density, stress scatter, grid momentum
update, contact, pressure solve, or G2P reconstruction is validated yet.

As of 2026-06-10 23:38 AKDT, the first WebGPU P2G grid projection kernel also
executes in the live demo. `mlsMpmP2gGridProjectionWgsl` is a deterministic
gather kernel: one invocation per grid node loops over resident particle rows
and accumulates quadratic-B-spline mass and APIC momentum into f32x4 grid rows.
This avoids float atomics and is parity-friendly, but it is O(grid nodes *
particles) and does not yet include stress scatter, grid velocity/update,
contact/wall conditions, or G2P reconstruction. A later performance pass should
replace it with tiled/scatter-friendly kernels once browser WebGPU supports the
needed reduction strategy cleanly.

## Hot-Loop Kernel Chain

A first GPU-resident SPH phase demo should target this dispatch chain:

1. Apply UI constants:
   - six wall temperatures,
   - particle count / resolution config,
   - timestep,
   - run mode.
2. Build or update spatial hash.
3. Sort or bin particles by cell.
4. Build cell offsets and neighbor ranges.
5. Compute SPH density and local field observations.
6. Sample EOS/phase closures from GPU-resident closure buffers.
7. Compute pressure, viscosity, mechanical response, and sound-speed limits.
8. Compute forces and momentum updates.
9. Compute heat transfer:
   - particle-particle conduction,
   - H2O/Fe interface exchange,
   - gas coupling,
   - six wall boundary fluxes,
   - radiation losses if in scope.
10. Update internal energy, temperature, and phase fractions.
11. Update gas/steam pressure and condensation/evaporation state.
12. Accumulate conservation and diagnostic summaries into small GPU buffers.
13. Generate color/opacity/glow from optical/radiation closures.
14. If nuclear physics is enabled:
   - update isotope inventories from decay/reaction tables,
   - sample fission/fusion source terms within validated domains,
   - propagate neutron/gamma/charged-particle radiation bins,
   - deposit ionizing-radiation energy back into material/gas fields,
   - accumulate isotope and radiation conservation ledgers.
15. Render directly from GPU state.

CPU readback should happen after step 12 and only for the small summary buffers,
ideally every N frames rather than every frame.

## GPU-Resident Nuclear And Ionizing-Radiation Target

Nuclear physics is a separate closure family from chemical/electronic material
properties. Element material ids are not enough; the runtime needs isotope
inventories `(Z,A,state)` and reaction products when radioactive decay,
fission, fusion, activation, or ionizing radiation are enabled.

The control plane should validate and upload:

- isotope mass / binding-energy tables,
- decay constants, branches, daughter products, and emitted spectra,
- fission cross sections, barriers, yields, prompt/delayed neutron spectra, and
  gamma spectra,
- fusion cross sections or reactivity tables as functions of species,
  temperature, density, and screening domain,
- radiation transport opacities, stopping powers, scattering kernels, and
  energy-deposition coefficients.

The hot loop should keep the expensive state resident on the GPU:

- particle/material isotope inventory buffers,
- radiation-group buffers for neutrons, gammas, charged particles, and deposited
  heat,
- compact reaction event accumulators,
- daughter isotope production buffers,
- dose/energy-deposition reductions,
- domain-exit/status buffers.

The CPU may read back only summaries: total activity, emitted/deposited energy,
neutron balance, isotope conservation residuals, validation blockers, and dose
or heat ledgers. It must not run per-particle decay chains or cross-section
sampling in JavaScript during normal simulation.

This is not a near-term shortcut. Reliable fission/fusion/decay closures require
nuclear-structure references, cross-section evidence, transport benchmarks, and
strict conservation tests. Until those exist, scenarios that need them should
produce blocked or degraded artifacts rather than invented reaction rates.

## Contract And Closure Rules

Contracts remain necessary, but they should be paid for at load time, refresh
time, or explicit validation time:

- Contract validation happens before a closure enters the GPU runtime.
- Closure buffers are immutable for a run segment unless a new validated version
  is swapped in.
- Closure-domain exits are detected on GPU and written to a compact status
  buffer.
- CPU handles closure invalidation and re-derivation only when a status buffer
  reports a domain exit or validation blocker.
- The normal frame loop does not rebuild artifact summaries.
- Artifact/provenance output can be sampled periodically or generated at
  checkpoints.

The design should support double-buffered closure swaps:

- current closure buffer set,
- candidate closure buffer set,
- GPU status says whether candidate passed smoke/parity checks,
- CPU flips bind groups only at a safe frame boundary.

## Material Derivation On GPU

Material derivation has two different performance classes.

### GPU MD Is Plausible

Molecular dynamics and statistical sampling can move substantially onto GPU:

- cell-list / neighbor-list construction,
- pair and many-body potentials,
- velocity-Verlet or similar integration,
- thermostats and barostats,
- property accumulators,
- histograms,
- reductions,
- stress/strain sampling,
- transport sampling,
- closure-table fitting or accumulation.

GPU MD can derive or refine:

- density,
- heat capacity,
- viscosity,
- thermal conductivity,
- bulk modulus,
- Young's modulus,
- shear modulus,
- Poisson ratio,
- speed of sound,
- surface tension,
- vapor pressure,
- phase-transition curves,
- latent heat estimates.

This can run asynchronously in the browser GPU, on PeerCompute nodes, or on
remote/native GPU workers. It should not block the 60 Hz frame loop.

### Full Schrodinger / DFT Is Not A 60 Hz Browser Hot Loop

Full first-principles Schrodinger/DFT derivation for H2O and Fe at useful
fidelity is much harder inside browser WebGPU:

- WebGPU primarily exposes f32, while serious material quantum work often needs
  f64 or careful mixed precision.
- Mature DFT needs heavy linear algebra, eigensolvers, FFT/multigrid/Poisson
  solvers, pseudopotentials, exchange-correlation models, and convergence
  control.
- Browser kernels can run reduced Schrodinger, tight-binding, DFT-lite, or
  small reference problems, but production-grade material references should be
  async/offline or remote/native at first.

The practical chain is:

1. Quantum/DFT/reference solvers derive potentials or high-quality reference
   data.
2. GPU MD/statistical sampling derives material properties and closure tables.
3. Closure tables are validated, hashed, and uploaded to WebGPU.
4. The SPH demo consumes those closures in a GPU-resident 60 Hz hot loop.

## WebGPU Substrate Needed

The performance upgrade needs reusable GPU primitives:

- f32/f16 vector math kernels with explicit precision metadata,
- complex64 support for reduced quantum/reference problems,
- reductions,
- prefix scans,
- radix sort or work-efficient binning,
- histograms,
- RNG,
- cell lists and neighbor lists,
- interpolation/table sampling,
- finite-difference derivative sampling,
- small linear algebra kernels,
- FFT or multigrid if reduced quantum/Poisson problems are brought into
  browser WebGPU,
- compact summary-buffer readbacks,
- device-loss recovery and CPU fallback boundaries.

## GPU-Resident Optical And PBR Target

Optical behavior must be a generalized closure family, not material-specific
rendering code. Gold, water, sodium hydroxide, iron oxide, air species, and
arbitrary user-entered formulas must all flow through the same contract shape:

1. Resolve material identity once from formula/element/mixture input.
2. Derive or load lower-level electronic, vibrational, phonon, and scattering
   evidence.
3. Convert that evidence into spectral optical response tables.
4. Cache the resolved tables by material identity, phase, validity domain, and
   input artifact hash.
5. Upload compact optical/PBR tables to WebGPU buffers.
6. Keep those buffers resident and sample them in compute/render kernels.
7. Read back only compact status, blocker, and provenance summaries.

The hot loop must not call expensive JavaScript material resolution,
Hartree-Fock, Kohn-Sham, molecular geometry generation, oscillator discovery,
or CIE integration. Those are control-plane or async derivation tasks. Once a
material has a validated optical closure buffer, GPU kernels consume it by
material id and phase id.

### Required Optical Closure Outputs

Every element/formula optical closure should produce a common record:

- spectral sample wavelengths,
- spectral reflectance for opaque/conductive surfaces,
- spectral transmittance/attenuation for transparent media,
- complex dielectric or `n,k` samples when available,
- absorption coefficient samples,
- scattering coefficient samples,
- IOR or polarizability-derived real-index samples,
- PBR display parameters derived from the spectrum:
  - base color,
  - metalness,
  - roughness provenance,
  - transmission,
  - thickness / attenuation distance,
  - opacity,
  - emissive coupling to the radiation closure,
  - vertex-color policy,
- validity domains for phase, temperature, density, pressure, and composition,
- provenance links to the underlying electronic/vibrational derivation.

For elements:

- metals add a Drude intraband term from derived conduction-electron density,
- localized d/f and periodic-band transitions add interband oscillator terms,
- full target is periodic band / Brillouin-zone integration for solids,
- current scalar-relativistic atomic interband closure is an evidence-level CPU
  reference and must not be described as the final periodic solver.

For molecules/compounds:

- electronic transitions come from excited-state or orbital-gap/transition-
  dipole evidence,
- vibrational and overtone transitions come from normal modes and anharmonic
  rules,
- condensed-phase broadening/local-field corrections come from MD/statistical
  sampling or lower-level reference artifacts,
- water is not special except that its O-H overtone evidence is one instance of
  the generic molecular vibrational path.

### GPU Optical Buffer Layout

The first WebGPU buffer layout should be intentionally simple and stable:

- `OpticalMaterialRecord`
  - material id,
  - phase id,
  - spectral sample offset/count,
  - PBR parameter offset,
  - validity-domain offset,
  - provenance/status offset.
- `OpticalSpectralSample`
  - wavelength nm,
  - reflectance,
  - transmittance,
  - absorption coefficient,
  - scattering coefficient.
- `OpticalPbrParams`
  - baseColor linear RGB,
  - attenuationColor linear RGB,
  - metalness,
  - roughness,
  - transmission,
  - opacity,
  - IOR,
  - attenuation distance,
  - render-model enum,
  - vertex-color-policy enum.

This layout is the bridge between the lower-level closure chain and
Three.js/WebGPU rendering. Three.js can use a CPU-created `MeshPhysicalMaterial`
as an interim display layer, but its parameters must come from the same
spectral closure record that the future WebGPU renderer samples directly.

Implemented status (2026-06-10):

- `ulg-gpu-abi/src/index.js` declares the stable optical row layouts and schema
  ids:
  - `peercompute.ulg.optical-gpu-table.v0`,
  - `peercompute.ulg.optical-gpu-buffer-set.v0`,
  - 24-float `OpticalMaterialRecord` rows,
  - 8-float `OpticalSpectralSample` rows.
- `src/runtime/material/opticalGpuBuffers.js` packs CPU-derived
  `opticalRenderParams()` output into typed arrays and can upload those arrays
  to WebGPU storage buffers.
- `ulg-gpu-abi/src/wgsl.js` now includes `opticalLookupWgsl`, a compact
  material/phase lookup kernel over the packed `vec4<f32>` record rows.
- `src/runtime/material/opticalGpuBuffers.js` also builds lookup query rows,
  provides a CPU reference sampler for parity, and exposes
  `runOpticalGpuLookup()` for WebGPU dispatch/readback of compact render
  parameter rows.
- Optical material ids are stable across rebuilds: element ids are their
  atomic number, and compounds use deterministic f32-exact hashed ids.
- `src/visualization/sphPhaseScene.js` now derives one packed optical GPU table
  from each active material/phase surface batch and exposes it via
  `getOpticalGpuTable()`.
- This is a residency bridge, not the final GPU solver. Derivation still occurs
  on the CPU/control plane; the current renderer remains Three.js WebGL
  `MeshPhysicalMaterial`; future kernels must consume these storage buffers
  directly and avoid per-frame CPU material resolution.

### Persistent Kernel Model

The final runtime should keep these systems alive in parallel:

- simulation kernels advancing particle/phase/gas/wall state,
- closure-domain kernels checking whether state leaves validity envelopes,
- optical/radiation kernels producing render buffers from resident closure
  tables,
- async derivation/refinement kernels or remote workers generating candidate
  closures,
- CPU control-plane code validating candidate artifacts and swapping bind
  groups only at safe frame boundaries.

This is a large architectural upgrade. The near-term implementation should
build the common optical/PBR record and GPU buffer descriptor first, then move
sampling into WebGPU. It should not pretend that full Schrodinger/DFT for all
materials is already a 60 Hz browser hot loop.

## 60 Hz Budget

The frame budget at 60 Hz is about 16.7 ms. The runtime should budget that as:

- simulation dispatches and synchronization,
- rendering,
- UI responsiveness,
- rare summary readback.

Rules:

- No full-state CPU readback in the frame loop.
- Avoid CPU-side neighbor search.
- Avoid CPU-side closure sampling.
- Avoid rebuilding contract artifacts during normal stepping.
- Use async checkpoints for provenance summaries.
- Use adaptive particle counts and convergence reports rather than trying to
  brute-force molecular counts.

If a scenario cannot fit in the 60 Hz budget at the selected particle count, the
demo should lower update rate, substep asynchronously, or report the performance
limit. It should not silently reduce physics fidelity without a visible status.

## Implementation Milestones

### P0 - Architecture Lock

- Document this GPU-resident target.
- Mark contract/provenance code as control-plane, not hot-loop.
- Define which buffers cross each simulation layer.

### P1 - GPU Data Layouts

- Add packed buffer layouts for SPH particles, material closures, gas cells,
  six wall sides, diagnostics, and render fields.
- Extend current WGSL closure-table descriptors to support multi-output
  material/EOS/phase/mechanical/optical closures.

### P2 - GPU Neighbor And SPH Core

- Move spatial hash, binning/sorting, density, pressure, and force kernels to
  WebGPU.
- Keep CPU reference tests for parity, but make GPU the performance path.

### P3 - GPU Closure Sampling

- Bind closure tables directly in WebGPU.
- Sample EOS, phase, transport, mechanical, optical, and radiation closures
  without CPU round trips.
- Emit compact closure-domain status buffers.

### P4 - GPU Phase, Gas, And Wall Coupling

- Implement energy/phase updates on GPU.
- Keep H2O and Fe mass conservation on GPU.
- Compute steam pressure and condensation/evaporation on GPU.
- Accumulate six wall heat ledgers on GPU.

### P5 - GPU-Driven Rendering

- Generate material color, opacity, and glow from GPU-resident
  optical/radiation closures.
- Render directly from simulation buffers.

### P6 - Async Material Derivation

- Add GPU MD/property sampling kernels for closure derivation.
- Keep reduced quantum/DFT work optional and async.
- Support remote/native derivation for high-fidelity references.
- Swap validated closure buffers into the running simulation at safe frame
  boundaries.

## Validation

Required tests and evidence:

- CPU/GPU parity for small SPH fixtures.
- GPU closure sampling parity against CPU reference table sampling.
- GPU conservation summaries for mass, momentum, and energy.
- GPU wall heat ledger parity for six independent side temperatures.
- GPU phase-transition regression fixtures.
- GPU render-color derivation from optical/radiation closures.
- Performance smoke measuring frame time at multiple particle counts.
- No full particle-buffer readback during normal stepping.
- Device-loss fallback preserves a clear status and does not claim GPU
  readiness.

## Open Questions

- What minimum particle count should target 60 Hz on the local GPU?
- What minimum particle count should target 60 Hz on old-donkey or another
  remote/native GPU worker?
- Which WebGPU sort/binning strategy is best for the browser target?
- Should gas be SPH particles, grid/control volumes, or a hybrid model?
- Which closure tables can be sampled as textures, storage buffers, or uniform
  buffers for best performance?
- How often should CPU read diagnostic summaries: every frame, every N frames,
  or only on demand?
- Which material-derivation tasks are acceptable in browser WebGPU, and which
  require PeerCompute or remote/native workers?

## Immediate Next Slice

The next implementation slice should not start with the full SPH phase demo. It
should create the GPU-resident runtime foundation:

1. Define packed GPU buffer layouts for particle state, closure tables, wall
   controls, gas state, diagnostics, and render fields.
2. Add a WebGPU-resident particle update path that does not read back full
   buffers.
3. Move closure sampling for a small fixture fully onto GPU.
4. Add compact summary-buffer readback for pressure/energy/phase diagnostics.
5. Add tests proving contracts are load-time/control-plane only for the hot
   loop.
