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

The CPU should bind these resources and dispatch kernels. It should not inspect
or transform them per particle each frame.

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
14. Render directly from GPU state.

CPU readback should happen after step 12 and only for the small summary buffers,
ideally every N frames rather than every frame.

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
