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

Throughput correction, 2026-06-14 AKDT:

- A single-substep fused P2G/grid-update/G2P command submission was tested in
  the browser and kept the H2O/H2O mechanics-only sanity probe `good`, but it
  did not materially reduce the compact-summary queue fence. The bottleneck is
  not just three command submissions inside one substep.
- The next credible performance target is a ComputeManager-owned resident lane
  that batches multiple substeps in one pass DAG, ping-pongs resident particle
  and grid buffers inside the lane, and exposes compact summaries only at
  explicit validation/render cadence boundaries.
- Keep the one-substep fused path opt-in until it becomes part of that larger
  multi-substep lane or has independent throughput evidence.

Architecture correction, 2026-06-12 AKDT:

- The GPU-resident hot loop should be packaged as ComputeManager-compatible law
  workers, not as a demo-local scheduler.
- NodeKernel/ComputeManager/StateManager remain the long-term authority path for
  distributed law execution and accepted state mutation.
- Every hot-loop stage must declare read families, authoritative write families,
  borrowed buffers, lease/lifetime requirements, cache behavior, and validation
  gates.
- WebGPU workers can own hot buffers while leased, but accepted state must move
  as compact deltas, retained-buffer refs, or closure artifacts through the
  PeerCompute admission path.
- Rendering may consume resident physics outputs, but pressure/interface,
  gas/product, phase, wall-heat, and closure updates must not depend on render
  cadence.
- Avoid a broad sibling `GPUComputeManager` for now. Add a focused
  ComputeManager-owned GPU resident lane layer so one hot state key can keep its
  pass DAG and buffers on the same device.
- Keep heavy Eshkol and MoonLab service hosts warm when scenario latency needs
  them. Their warm state is service readiness/cache state, not direct state
  mutation authority.

## Current Gap

The current implementation is not yet this architecture:

- CPU-reference carrier runtime is authoritative.
- WebGPU exists as an optional toy/parity path.
- Closure tables have WGSL/buffer descriptors, which is good groundwork.
- Contracts, artifact summaries, closure registry, validation, and refresh
  handling are mostly JavaScript/CPU control-plane code.
- Simulation layers are not yet persistent WebGPU systems passing buffers
  directly between SPH, EOS, phase, gas, wall, and renderer kernels.
- GPU worker spawning exists through supervised child leases, but child-worker
  spawning is not enough to avoid copies unless the hot state remains on the
  same GPU device/lane or has explicit domain partitioning.

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

## UI Nonblocking Worker Target

CPU-heavy work that remains before full GPU residency must not run on the UI
thread. Until the WebGPU closure/runtime path is authoritative, the browser demo
must push expensive rebuild-time and validation-time work into workers:

- material closure derivation,
- optical closure table construction,
- reaction discovery and candidate ranking,
- thermal closure graph/table construction,
- initial SPH/MLS-MPM particle packing,
- optional CPU parity/reference runs,
- full-field CPU render fallbacks.

The preferred control-plane shape is PeerCompute-compatible: the UI submits a
typed job to a local CPU/WASM compute worker, receives progress/status records,
and applies only the final compact result on the main thread. If a task is still
running on the CPU main thread, the demo must visibly say so instead of silently
locking the UI.

The live SPH overlay should also show two counters:

- **Render FPS**: normal `requestAnimationFrame` presentation cadence.
- **Physics FPS**: accepted simulation/resident-step cadence. This may differ
  from render FPS once physics and rendering are decoupled.

These counters are diagnostics, not validation. They make it obvious whether the
renderer is smooth while physics is slow, or whether closure/rebuild work is
blocking both.

## PeerCompute Local Closure Cache

Derived closures and compact closure-derived tables should be cached in the
PeerCompute state representation and mirrored to browser `localStorage` when the
demo is running locally. This lets later peers and browser reloads benefit from
existing derived values instead of recomputing them.

Cache records must be content/provenance keyed, not material-name-only:

- material or formula key,
- closure family and schema version,
- derivation method/version,
- input hash / formula / atom counts / phase model,
- validity-domain hash,
- source commit/runtime ABI where available,
- validation flags and blockers.

The runtime may reuse cached values only when the key, schema, validity domain,
and provenance guard match. Cache hits should still be surfaced in diagnostics
as `peercompute-local-cache-hit`; stale or mismatched values should be ignored
and recomputed through the lower-level chain. This cache is a performance layer,
not a source of truth; every cached material, optical, thermal, or reaction
closure remains derived and provenance-checked.

Implemented browser-local cache guard:

- The SPH overlay stores v2 records under
  `peercompute.ulg.sph-derived-closure-cache.v1` so browser reloads can build a
  local material-closure library.
- Each record carries `inputHash`, `methodHash`, `validityDomainHash`,
  `propertiesHash`, and a `generatorFingerprint`.
- The generator fingerprint is derived from the material-closure method version,
  app version, module URL/build chunk identity, and source strings for the
  material derivation/generator functions. Production hashed bundles therefore
  invalidate when the generating code bundle changes; dev builds invalidate when
  the participating function sources change.
- Lookup rejects records with schema, method-version, generator-fingerprint,
  material-key, guard-hash, or properties-hash mismatches and reports them as
  stale instead of consuming them.
- The top-level cache keeps a material index pointing to hash-keyed records so
  the local library can grow beyond one record per material while still looking
  up common demo materials quickly.

## Required Runtime Warnings

The top of the SPH demo must show warning banners when:

- WebGPU is unsupported, unavailable, lost, or falling back to CPU.
- CPU closure work is active on the main thread or in a CPU/WASM worker.
- The normal hot loop is not fully GPU-resident.

The warning should identify the active blocker or CPU task where possible, for
example `reaction discovery`, `material closure derivation`, `optical table`,
`thermal graph`, `CPU parity`, or `render-field readback`.

## Box/Grid Scaling Fix

Increasing the sealed box size must increase the MLS-MPM simulation domain and
grid node count at fixed grid spacing. It must not make the rendered material
isosurface blobs larger.

Required behavior:

- MLS-MPM grid dimensions are derived from `boxDimsM / gridSpacingM`.
- The status panel reports grid dimensions/node count so box scaling is visible.
- Continuous isosurface radius is derived from particle spacing,
  smoothing length, or local occupancy, not from the largest box edge.
- Render-field resolution may grow with the domain or cap detail explicitly, but
  it must never hide box scaling by inflating metaballs.
- Tests compare a fixed particle cloud in small vs large boxes and require
  stable blob radius plus increased grid node count.

## WebGPU-Ocean Lessons And Marching Cubes

User-provided reference:

- Website/demo: `https://webgpu-ocean.netlify.app/`
- `https://github.com/matsuoka-601/WebGPU-Ocean`

Dedicated todo:

- `plan/todo/webgpu-ocean-mlsmpm-simulator-plan.md`

Initial decision:

- Incorporate the relevant WebGPU-Ocean patterns in the hot-loop GPU residency
  phase, after reaction inventory/residual/pressure/steam contracts are stable
  enough to define the data that must move through the GPU.
- Do not move this after cold-start timing polish; the Ocean lessons target the
  frame-loop performance problem directly.
- Do not let renderer polish preempt core physics. The renderer work matters
  when it keeps field generation and surface extraction GPU resident.

Placement update, 2026-06-11 23:12 AKDT:

- Keep the just-finished product-event render-field bridge in Phase 2 because
  it makes reaction products visible without sparse event readback.
- Next consume product-event mass in EOS/pressure/field kernels and finish the
  phase-resolved steam/gas contract.
- Then bring the WebGPU-Ocean lessons forward into the hot-loop phase before
  cold-start timing polish: fixed-point/tiled P2G, GPU cell/neighbor structures,
  and WebGPU marching cubes. This directly targets the live-frame bottleneck
  instead of optimizing startup around schemas that are still changing.

Placement update, 2026-06-11 23:43 AKDT:

- The first resident product-mass P2G sidecar slice is now complete: product
  event rows can stay GPU-resident and contribute unplaced product mass to P2G
  grid mass through a stable storage-buffer binding.
- Do not treat this as pressure/EOS completion. The next correctness slice must
  add product mechanics/EOS fields or a GPU gas-cell EOS inventory before
  pressure forces can be validated.
- The WebGPU-Ocean lessons should come immediately after that resident
  product-pressure contract: keep P2G/grid/surface fields GPU-resident, add
  fixed-point or tiled accumulation where browser atomics require it, and move
  continuous surface extraction to WebGPU marching cubes instead of CPU mesh
  extraction.

Placement update, 2026-06-11 23:54 AKDT:

- Product-event rows now carry closure-derived mechanics/EOS metadata and P2G
  can consume that metadata without CPU readback. This satisfies the immediate
  "product mechanics fields" prerequisite for resident product-event dynamics.
- The next correctness/performance bridge is still gas-cell/pressure-gradient
  force coupling, then WebGPU-Ocean-style hot-loop residency: GPU cell/neighbor
  structures, tiled/fixed-point accumulation where required, and WebGPU marching
  cubes for continuous surfaces.

Applicable patterns to evaluate and implement:

- Fixed-point integer `atomicAdd` accumulation for browser-portable P2G scatter
  of mass, momentum, and stress rows where the current deterministic gather path
  is too slow.
- GPU-side grid, cell, sort/prefix, and neighbor structures so SPH/MLS-MPM
  local interactions do not depend on CPU pair loops.
- A GPU-resident surface path. Screen-space fluid rendering is useful for
  transparent liquids and vapor/droplet visualization, while WebGPU marching
  cubes is the required todo for continuous PBR material volumes.

WebGPU marching-cubes todo:

- Build a scalar field or signed-density field from resident SPH/MLS-MPM rows
  into a 3D WebGPU storage texture/buffer.
- Classify voxels and generate case ids on GPU.
- Prefix-sum active voxel triangle counts.
- Emit triangle vertices, normals, material ids, phase ids, optical state ids,
  and draw-indirect metadata into GPU buffers.
- Bind the generated surface buffers to Three.js/WebGPU or a native WebGPU draw
  path without CPU mesh extraction.
- Preserve transparent-material depth ordering and z-buffer behavior for water,
  steam droplets, glass container walls, and embedded/overlapping materials.
- Keep CPU extraction only as a debug/parity fallback.

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

## Flat Closure-Law Graph WebGPU Target

The `/btw` performance target fits between the current resident kernel chain and
the full direct renderer: the closure-law graph should become a flat
WebGPU-resident data structure. CPU code is still responsible for building and
validating the graph, but the runtime hot loop should evaluate it from storage
buffers rather than traversing JS objects or per-material contracts.

Required layout:

- Closure node rows:
  - operation/law id,
  - material id and phase/domain selectors,
  - input edge offset/count,
  - output slot id,
  - coefficient/table offset/count,
  - interpolation/range mode,
  - validation/domain flag ids,
  - provenance/hash row ids.
- Closure edge rows:
  - source slot id,
  - destination node id,
  - unit/dimension id,
  - derivative/sensitivity tag where needed.
- Coefficient/table rows:
  - EOS, phase, optics, radiation, reaction, nuclear, and mechanics lookup
    tables,
  - sampled ranges and interpolation metadata,
  - material constants derived from lower-level quantum/MD/reference solvers.
- Runtime slot buffers:
  - particle/local state inputs such as density, temperature, composition,
    phase fractions, strain, pressure, radiation field, and isotope inventory,
  - closure outputs such as pressure, sound speed, viscosity, moduli, thermal
    conductivity, opacity, emissive color, reaction rates, decay/fission/fusion
    source terms, and wall/transport coefficients.
- Status buffers:
  - out-of-domain node ids,
  - NaN/overflow flags,
  - validation/parity failure bits,
  - compact diagnostic counters.

CPU responsibilities:

- Compile high-level material closures into the flat tables.
- Validate units, dimensions, domains, graph acyclicity or fixed-point groups,
  provenance hashes, and CPU reference parity fixtures.
- Upload validated table buffers and build bind groups.
- Handle slow-path invalidation only when a GPU status buffer reports a domain
  exit, stale cache key, or validation blocker.

GPU responsibilities:

- Evaluate closure nodes from flat rows during the SPH/MLS-MPM/nuclear hot
  loop.
- Keep intermediate closure slots WebGPU-resident across kernels.
- Feed pressure, phase, mechanics, thermal, optics, radiation, reaction, and
  nuclear closures without CPU-side graph traversal.
- Emit only compact status/diagnostic readbacks during normal runtime.

This is a general solution target. It should support all elements and compounds
whose closures have been derived and validated, with cache reuse keyed by the
closure graph/provenance hash. It should not add one-off material branches for
H2O, Fe, Au, Na, or any other specific demo material.

## 2026-06-11 Checkpoint - Flat Closure-Law Graph ABI And Evaluator

Implemented:

- Added `peercompute.ulg.closure-law-graph.v0` and
  `peercompute.ulg.closure-law-graph-execution.v0`.
- Added flat f32x4-aligned node, edge, slot, status, and table-sample row
  layouts for WebGPU-resident closure evaluation.
- Added CPU compiler support for table-interpolation closure artifacts. The
  compiler validates strict sample ordering and domain limits instead of
  silently sorting or clamping.
- Added CPU evaluator support for table-linear closure nodes. Domain exits
  write status rows and set `closureRefreshRecommended = true`.
- Added a WebGPU evaluator (`closureLawGraphEvalWgsl`) that consumes only flat
  graph buffers and writes slot/status buffers.
- Added optional WebGPU execution with CPU parity gating.

Evidence:

- Focused ABI/runtime tests passed `24/24`.
- Manual Chromium probe against the live HTTPS Vite server initially acquired
  WebGPU and caught a shared WGSL parse failure because `layout` in
  `TensorDescriptor` is now a reserved keyword.
- Renamed that shared WGSL field to `tensor_layout`.
- Manual Chromium/WebGPU probe then passed with `backend = webgpu`,
  `status = webgpu-accepted`, parity `pass`, `maxSlotAbs = 0`, and
  `maxStatusAbs = 0`.

Remaining performance target:

- Only table-linear closure nodes are implemented. The next graph work is to
  compile EOS/phase/mechanics/optics/radiation/reaction/nuclear closure families
  into the same graph rows and consume slot buffers from SPH/MLS-MPM kernels
  without per-frame CPU graph traversal.

## 2026-06-11 Checkpoint - Carrier Runtime Uses Flat Closure Graph Buffers

Implemented:

- Added `carrierGraphStepWgsl`, a compatibility carrier kernel that evaluates
  the toy two-body closure through flat closure-law graph node/sample/slot/status
  buffers instead of binding raw closure samples directly.
- Updated the real WebGPU carrier runner to CPU-compile the closure artifact
  into a flat graph before upload.
- The carrier WebGPU result now reports `closureLawGraph.backend =
  webgpu-resident-flat-graph` so probes can distinguish graph-backed execution
  from the older direct-sample kernel.

Evidence:

- Focused ABI/closure graph/carrier tests passed `32/32`.
- Manual Chromium/WebGPU probe against the live HTTPS Vite server passed with
  `backend = webgpu`, `webgpuStatus.status = webgpu-executed`, carrier parity
  `pass`, max position drift about `5.7e-9`, max velocity drift about `1.6e-9`,
  and invariant status `pass`.

Remaining performance target:

- This bridge covers the toy carrier runtime only. SPH thermal, phase,
  mechanics, optical, reaction, and nuclear/radiation kernels still need to
  consume the flat closure graph/slot buffers.

## 2026-06-11 Checkpoint - Resident Render Rows And Layout-Limit Fixes

Implemented:

- Compact SPH render rows are extracted from retained WebGPU SPH state/thermo
  buffers and decoded into continuous Three.js volume surfaces.
- The resident Na + water path now renders `h2o`, `Na`, and derived `naoh`
  surfaces instead of collapsing to `unknown` rows after invalid WebGPU
  pipelines.
- Reaction rows and product-phase mechanics rows share one storage buffer, so
  the reaction resolve pass fits an adapter with
  `maxStorageBuffersPerShaderStage = 10`.
- SPH/MLS-MPM resident hot-path kernels use explicit compute bind group layouts
  instead of `layout: 'auto'`, avoiding per-entrypoint binding pruning.
- The SPH WebGL renderer no longer requests `preserveDrawingBuffer`.

Profiler evidence:

- Manual Chromium/WebGPU probe: zero WebGPU bind-group/validation warnings after
  the explicit-layout pass.
- Browser CPU/trace profile after resident render activation: JS script work was
  about `33 ms` in the sampled window; the remaining large costs were
  GPU-process/WebGL flush/readback stalls in headless Chromium.
- Disabling SPH `preserveDrawingBuffer` reduced observed `GLES2::ReadPixels`
  calls in the sampled headless trace from `18` to `5`.

Remaining performance target:

- Remove the compact render-row readback and Three.js surface rebuild from the
  normal hot loop by generating draw/instance/field buffers directly from
  resident WebGPU state.
- Keep compact CPU summaries for diagnostics, not per-particle or per-surface
  state reconstruction.

## 2026-06-11 Checkpoint - Generic Resident SPH Render Field Bridge

Implemented:

- Added `peercompute.ulg.sph-gpu-render-field.v0` and
  `peercompute.ulg.sph-gpu-render-field-execution.v0`.
- Added generic material/phase surface rows and field-cell rows:
  surface records carry material id, phase id, field offset/count, resolution,
  isolation/subtract/strength, radius, and derived display color; field cells
  carry density plus palette contribution.
- Added `sphRenderFieldWgsl`, a WebGPU splat kernel that matches compact render
  rows to surfaces by `(materialId, phaseId)` and writes flattened
  density/palette fields.
- Wired the live resident render branch so accepted resident WebGPU state now
  renders through `resident-gpu-render-field` before the interim Three.js
  MarchingCubes bridge. Compact rows and CPU particles remain fallback paths.
- Capped resident bridge field resolution at 32 cells per axis to keep bridge
  readback bounded while direct GPU rendering is still pending.

Evidence:

- Focused ABI/render tests passed `23/23`.
- Focused renderer tests passed `6/6`.
- Focused HTTPS Chromium e2e passed `1/1` and now asserts
  `resident-gpu-render-field` for the WebGPU resident branch.
- Manual default Fe/H2O browser probe showed field readback reduced to
  `1048576` bytes for two surfaces, with visible H2O and Fe surfaces.
- Manual Na/H2O browser probe showed field-rendered `h2o`, `Na`, and derived
  `naoh` surfaces.

Remaining performance target:

- This bridge still reads back field cells and still uses Three.js CPU
  polygonization. The next slice should replace the Three.js MarchingCubes
  bridge with direct WebGPU draw/volume buffers and move color/emission sampling
  to GPU-resident optical/radiation closure buffers.

## 2026-06-11 Checkpoint - Retained Render-Row Buffer Handoff

Implemented:

- The resident SPH render-row extraction kernel can now retain its compact
  render-row GPU buffer after the required interim metadata readback.
- The resident render-field kernel borrows that retained buffer directly on the
  successful WebGPU path, removing one CPU-side render-row reupload before field
  splatting.
- Live scene telemetry exposes `renderFieldInputSource =
  resident-render-rows-buffer`, `renderRowsBufferRetained`, and retained buffer
  byte length so browser probes can verify the path.
- The retained buffer is owned by the render-row execution artifact and is
  destroyed in a `finally` block after the field/fallback branch completes.

Evidence:

- `node --test tests/sphRenderGpuKernel.test.mjs` passed `7/7`.
- Focused HTTPS Chromium e2e against `https://127.0.0.1:5173/` passed `1/1`.
- `npm test` passed `313/313`.
- `npm run build` passed with the existing Vite large-chunk warning.
- `git diff --check` passed.

Remaining performance target:

- This is not the final renderer. Compact render-row metadata and field cells
  still cross back to CPU for the Three.js bridge. The next larger runtime
  target is the flat closure-law graph plus direct GPU draw/volume buffers.

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

### Cherenkov / Optical Radiation Closure

Cherenkov light should be treated as a radiation/optical transport closure, not
as an element color patch.

Required GPU-resident inputs:

- charged-particle species, energy, direction, and velocity from radioactive
  decay, fission/fusion products, activation, or external beam closures,
- wavelength-dependent refractive index `n(lambda)` from the same
  first-principles optical closure used by PBR/transparency,
- medium absorption/scattering coefficients from optical/radiation transport
  closures,
- particle stopping power / energy-loss closure for the active material phase,
- compact photon/radiation group buffers for visible and non-visible emission.

GPU hot-loop behavior:

1. For each charged-particle group, compute `beta = v / c`.
2. For each optical wavelength/radiation group, emit Cherenkov photons only
   where `beta * n(lambda) > 1`.
3. Use the Frank-Tamm spectral emission form for `d^2N / (dx d lambda)` within
   the closure's valid wavelength/energy domain.
4. Subtract emitted energy from the charged-particle/radiation-energy ledger.
5. Transport or locally deposit photons through the radiation/optical transport
   buffers.
6. Feed visible groups into the renderer through the same emission path as
   blackbody/incandescence and optical fluorescence.

Validation requirements:

- threshold tests for materials with `n(lambda) <= 1 / beta` and
  `n(lambda) > 1 / beta`,
- energy conservation between charged-particle loss, photon emission, and
  deposited heat,
- spectrum sanity against analytic Frank-Tamm references for a constant-index
  medium,
- no Cherenkov artifact when the nuclear/radiation source closure is blocked or
  outside domain.

If the stack later supports explicit photon transport from low-level EM
simulation, this closure can become a reduced model of that deeper chain. Until
then it is the honest bridge between radioactive/charged-particle sources and
optical rendering.

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

## 2026-06-10 Checkpoint - Stress-Aware MLS-MPM P2G

The MLS-MPM GPU particle row is now 32 f32 values and carries closure-derived
mechanical constants beside `F`, `C`, `J`, and rest volume. This lets the P2G
kernel compute material stress on GPU instead of asking the CPU for pressure or
modulus lookups during the projection.

Implemented GPU-resident pieces:

- Packed effective bulk modulus, shear modulus, Lame lambda, sound speed, EOS
  model id, and constitutive status into the mechanics buffer.
- Propagated the demo's CFL-derived sound-speed/modulus scale into
  `state.gpuMechanics` so GPU and CPU use the same interactive approximation.
- Added `dt` to the P2G parameter block.
- Ported fluid pressure and fixed-corotated solid stress into WGSL.
- Updated P2G momentum transfer to
  `m*v + (m*C + stressTerm) * dpos`.
- Verified live WebGPU parity for the stress-aware gather-form projection.

Remaining hot-loop work before the demo can run GPU-authoritatively:

- Grid velocity update, gravity, CFL clamp, and wall/contact constraints.
- G2P velocity/C/F/J reconstruction.
- Thermal conduction, wall heat ledgers, phase equilibrium, and reaction
  updates resident on GPU.
- Compact diagnostics instead of full grid/particle readbacks during normal
  stepping.

## 2026-06-11 Checkpoint - MLS-MPM Grid Update And Resident Buffer Bridge

The grid-update stage now runs as a WebGPU kernel after P2G. It converts grid
momentum to velocity, applies gravity, CFL speed limiting, and sealed-box wall
normal clamping. Successful WebGPU P2G and grid-update executions retain their
GPU buffers so the next G2P kernel can consume them without a CPU re-upload.

Implemented GPU-resident pieces:

- Grid velocity ABI rows and execution/parity schemas.
- `mlsMpmGridUpdateWgsl` and parity-gated CPU/WebGPU wrappers.
- Browser scheduling after P2G.
- Retained P2G grid buffer and retained updated velocity-grid buffer on
  successful WebGPU parity.

Still remaining:

- G2P reconstruction from the retained velocity grid.
- Normal runtime stepping without full readback; parity mode still reads back
  full buffers for evidence.
- Thermal/phase/reaction kernels and compact diagnostic summaries.

## 2026-06-11 Checkpoint - MLS-MPM G2P Reconstruction

The G2P stage now runs as a WebGPU kernel after the retained grid-update
velocity buffer. It reconstructs particle velocity, affine `C`, deformation
gradient `F`, and volume ratio `J`, then applies sealed-box position and inward
velocity clamps. This completes the first parity-proven MLS-MPM kernel chain
shape: P2G stress projection, grid velocity update, and G2P reconstruction.

Implemented GPU-resident pieces:

- G2P ABI execution and parity schemas.
- `mlsMpmG2pReconstructWgsl` and parity-gated CPU/WebGPU wrappers.
- Browser scheduling after grid update.
- Scene and overlay accessors exposing `getMlsMpmG2pReconstruction()`.

Still remaining:

- The chain is not yet a single GPU-authoritative stepping path.
- Normal runtime still performs full readback for parity evidence.
- Repeated-step conservation checks are needed before visual state can be
  accepted from GPU output.
- Thermal/phase/reaction kernels, gas pressure, wall heat ledgers, and render
  fields remain outside the resident GPU hot loop.

## 2026-06-11 Checkpoint - Resident MLS-MPM Step Artifact

The first resident-step runtime artifact now owns P2G, grid update, and G2P as
one orchestrated chain. The scene no longer has to manually schedule each stage
from UI code; it asks for one resident step and exposes the component stage
artifacts for compatibility and evidence.

Implemented GPU-resident pieces:

- `runMlsMpmResidentStepWithOptionalWebGpu()` as the chain owner.
- Shared WebGPU device and uploaded particle buffers across the stage wrappers.
- Retained P2G grid buffer into grid update and retained grid-update velocity
  buffer into G2P.
- Compact step diagnostics for mass, momentum, active grid nodes, speed,
  displacement, and volume-ratio range.
- Browser overlay scheduling through `refreshMlsMpmResidentStep()`.

Still remaining:

- G2P output particle buffers are read back and destroyed; they are not yet
  ping-ponged as the next resident input.
- Normal runtime still performs full parity readback.
- CPU particle state remains authoritative for visible motion, thermal updates,
  phase updates, reactions, and status.
- Compact GPU summary buffers need to replace full readbacks in the hot loop.

## 2026-06-11 Checkpoint - Retained G2P Output Buffers

The resident-step chain now keeps the G2P output state and mechanics buffers
alive after parity passes. Those buffers are exposed as next-step particle upload
descriptors with explicit ownership flags and ping-pong metadata. This is the
handoff needed for a repeated GPU stepping loop.

Implemented:

- `retainOutputParticleBuffers` on G2P WebGPU execution.
- Retained state/mechanics buffer fields and cleanup functions on G2P execution
  artifacts.
- Ownership-aware `destroySphGpuParticleBuffers()` and
  `destroyMlsMpmGpuParticleBuffers()`.
- Resident-step fields:
  `g2pOutputBuffersRetained`, `nextParticleUploads`,
  `nextParticleBufferMode`, `nextParticleStateBufferByteLength`,
  `nextParticleMechanicsBufferByteLength`, and `particlePingPong`.

Still remaining:

- The hot loop still runs in `full-parity-readback` mode.
- The retained next uploads are not yet swapped into the next resident step.
- Compact diagnostics are CPU-computed from readback, not GPU summary buffers.

## 2026-06-11 Checkpoint - Multi-Step Resident Ping-Pong

The runtime now has a repeated resident-step execution wrapper that swaps
accepted retained G2P output particle buffers into the next MLS-MPM resident
step. This is the first end-to-end ping-pong loop boundary for the mechanics
chain, but it is still an evidence path with full parity/readback.

Implemented:

- `peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0`.
- `runMlsMpmResidentStepsWithOptionalWebGpu()` for repeated P2G -> grid update
  -> G2P execution.
- Source/next slot tracking across repeated steps.
- Per-step summaries for stage statuses, retained-buffer fields, diagnostics,
  and ping-pong state.
- Cleanup for final and optionally retained intermediate resident steps.

Still remaining:

- Compact GPU summary buffers for normal-frame diagnostics.
- GPU-authoritative visible particle state.
- Thermal, wall heat, phase, reaction, gas pressure, and render-field kernels.

## 2026-06-11 Checkpoint - No-Full-Readback Resident Foundation

The MLS-MPM mechanics chain now has an opt-in no-full-readback mode below the
scene layer. This mode retains GPU buffers and skips full array readback for
P2G, grid update, and G2P. It does not run CPU parity on success and does not
invent diagnostics from unread buffers.

Implemented:

- `readbackMode: 'no-full-readback'` on P2G, grid update, G2P, single resident
  step, and repeated resident steps.
- Lazy CPU reference/parity generation so no-full-readback success avoids CPU
  reference work.
- Explicit parity status `not-run-no-full-readback`.
- Metadata-only diagnostics when full arrays are absent.
- Tests for single-step and repeated-step retained-buffer ping-pong without
  full arrays.

Still remaining:

- Compact GPU summary buffers for mass, active nodes, speed, displacement,
  pressure, and conservation diagnostics.
- Scene/default hot-loop selection for no-full-readback mode.
- GPU-authoritative visible particle state.
- Thermal, wall heat, phase, reaction, gas pressure, and render-field kernels.

## 2026-06-11 Checkpoint - Scene-Scheduled Multi-Step Chain

The browser scene now requests the repeated resident MLS-MPM execution wrapper
directly. The default demo schedules two resident steps per scene update so the
retained G2P outputs are actually consumed as the next step's particle buffers.

Implemented:

- `sphPhaseScene.refreshMlsMpmResidentSteps()` and
  `sphPhaseScene.getMlsMpmResidentSteps()`.
- Sequence publication that keeps the existing single-step P2G/grid/G2P getters
  pointed at the final step for compatibility.
- Sequence-level cleanup to avoid double-destroying retained resident buffers.
- Demo-mount scheduling of two repeated resident steps.
- Browser e2e and live WebGPU probe coverage for two-step ping-pong.

Still remaining:

- No-readback hot-loop mode.
- Compact GPU summary buffers for normal-frame diagnostics.
- GPU-authoritative visible particle state.
- Thermal, wall heat, phase, reaction, gas pressure, and render-field kernels.

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
   controls, gas state, diagnostics, render fields, and the flat closure-law
   graph.
2. Compile and validate the closure-law graph on CPU, upload it as flat WebGPU
   tables, and evaluate a small EOS/phase/optics fixture on GPU with parity.
3. Add a WebGPU-resident particle update path that does not read back full
   buffers.
4. Add compact summary-buffer readback for pressure/energy/phase diagnostics.
5. Add tests proving contracts are load-time/control-plane only for the hot
   loop.

## 2026-06-11 Checkpoint - SPH Thermal Graph Artifacts

Implemented:

- SPH thermal now emits a flat closure-law graph artifact set from the existing
  closure-derived thermal material table.
- Each graph represents one derived segment as
  `specificInternalEnergyJPerKg -> temperatureK`, with derivative and source
  material/phase/segment metadata preserved in GPU-ready buffers.
- The live SPH scene exposes the graph set beside the material table, so the
  browser runtime can inspect and eventually upload the same flat graph ABI
  used by the carrier bridge.

Still remaining:

- Add selector/categorical graph operations before phase id, phase fractions,
  and density are moved out of the SPH thermal segment table.
- Teach the WebGPU thermal kernel to bind graph node/sample/slot/status buffers
  and evaluate thermal closures resident on GPU.
- Replace full graph/debug readbacks with compact status summaries once graph
  execution is in the hot loop.

## 2026-06-11 Checkpoint - Thermal Response Tables For GPU Binding

Implemented:

- Added a packed thermal closure graph bank so temperature graphs can move
  toward WebGPU binding without per-segment JS graph objects.
- Added an explicit SPH thermal phase-response table. Categorical phase
  selection, plateau fractions, and density policy are represented as response
  rows rather than hidden as ordinary interpolated scalar graph outputs.
- Added CPU parity that combines graph-derived temperature with response-table
  phase/density/fraction selection and compares against the legacy resolver.

Next performance slice:

- Bind graph-bank node/sample rows plus phase-response records/rows in
  `sphThermalStepWgsl`.
- Avoid shared global graph slots in the SPH hot loop; each particle needs
  local scratch or direct per-particle graph sampling to prevent races.
- Keep full particle readback disabled in normal resident runs and read back
  compact status/summary rows only.

## 2026-06-11 Checkpoint - Thermal Kernel Uses Response/Graph Buffers

Implemented:

- `sphThermalStepWgsl` now consumes response records/rows plus thermal graph
  node/sample rows. It no longer resolves thermal state from the legacy segment
  rows in the WebGPU thermal step.
- The shader samples temperature from graph-bank samples using local
  per-particle values, avoiding shared global graph slots in the hot loop.
- The scene precomputes and passes thermal graph/response artifacts into the
  resident chain, reducing per-frame CPU artifact construction.

Still remaining:

- Persist uploaded response/graph buffers across resident steps instead of
  uploading them on each thermal kernel call.
- Move reaction product phase reset onto the same response table.
- Add compact thermal status/phase summary buffers for normal no-readback runs.
