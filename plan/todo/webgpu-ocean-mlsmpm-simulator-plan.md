# WebGPU-Ocean-Style MLS-MPM Simulator Plan

Date: 2026-06-12 AKDT

## References

- Website/demo: https://webgpu-ocean.netlify.app/
- GitHub: https://github.com/matsuoka-601/WebGPU-Ocean

The WebGPU-Ocean reference is a real-time browser fluid simulation using
WebGPU. Its README describes an MLS-MPM path that can run roughly 100k
particles on integrated graphics and roughly 300k particles on stronger GPUs,
with P2G implemented through `atomicAdd`. It also includes an SPH mode with
GPU fixed-radius neighbor search and uses screen-space fluid rendering.

## Purpose

Implement a higher-performance ULG MLS-MPM simulator inspired by
WebGPU-Ocean's hot-loop architecture, while preserving ULG's core rule:
material behavior, phase behavior, reaction behavior, optics, pressure, and
thermodynamics must resolve from lower-level derived closures or valid cached
derivations.

This is not a renderer-only task and not a material-specific demo patch. The
target is a reusable WebGPU-resident simulator path that can carry ULG's
multi-material, phase-changing, reacting macro-particles at interactive rates.

## Current ULG Bottleneck

ULG already has pieces of a resident MLS-MPM pipeline:

- packed SPH/thermal and MLS-MPM mechanics particle buffers;
- P2G, grid update, and G2P WebGPU kernels with CPU parity paths;
- repeated resident-step ping-pong;
- no-full-readback modes for parts of the pipeline;
- compact resident summaries;
- product-event/product-mass sidecars;
- pressure-interface force rows;
- WebGPU render-field and surface-vertex prototypes.

The system is still not Ocean-style fast because:

- the current P2G path is still too gather-heavy for large particle counts;
- many paths still keep CPU parity/readback or CPU mesh extraction close to the
  live loop;
- CPU `MarchingCubes` remains the visible fallback;
- closure derivation and table construction still run through heavy JavaScript
  or worker paths;
- product gases, steam, wall heat, and phase states are not yet fully resident
  dynamics;
- draw buffers are not yet fed to a fully GPU-resident Three/WebGPU render path.

Tactical status, 2026-06-18 AKDT:

- The live no-full resident scene path can now use `compactSummaryMode=none`,
  which removes the per-step compact-summary `mapAsync` fence from the GUI
  route and keeps browser WebGPU validation clean for the current Cs/H2O
  MLS-MPM smoke path.
- The default resident MLS-MPM browser render path can now use
  `surfaceDraw=three-render-row-points`, which skips CPU `MarchingCubes`
  setup/apply and renders decoded WebGPU render rows through a Three.js point
  bridge. This is an interim console-clean surface path for live debugging; it
  is not the final GPU surface renderer because it still reads render rows
  back to CPU-owned Three geometry.
- `scripts/sph-performance-benchmark.mjs` now records benchmark status
  separately from physics-probe status and reports resident final-step timing
  separately from probe-wall batch timing. Current smoke evidence is
  console-clean for 16, 1024, and Cs/H2O resident scene rows, but those scene
  rows still need first-class cumulative GPU queue timing.
- The benchmark harness also has a direct-resident mechanics lane
  (`ULG_BENCH_PROBE_MODE=direct-resident`) for measuring the WebGPU hot loop
  without scene rendering or compact-summary readback. The harness now awaits
  `queue.onSubmittedWorkDone()` for this lane when requested, so direct
  timing is completed GPU work rather than command enqueue time. Current cold
  evidence at
  `artifacts/sph-performance-benchmark-direct-resident-active-grid.json` is
  console-clean and runs a four-step fused MLS-MPM mechanics sequence with
  `compactSummaryMode=none`, `fusedResidentSequence=true`,
  `residentGpuCompletedStageMs=647`, and active-grid dispatch over
  `4913/54872` grid nodes. A warm three-batch evidence row at
  `artifacts/sph-performance-benchmark-direct-resident-active-grid-warm.json`
  stays active-grid across unread resident batches by carrying conservative
  predicted resident bounds, with final-batch
  `residentGpuCompletedStageMs=38.9` and active-grid dispatch over
  `19343/54872` nodes. This proves the intended fused WebGPU mechanics path is
  available, but it is not yet the full GUI route or an acceptable performance
  answer: thermal/reaction sidecars, GPU-side bounds reduction, and direct GPU
  surface rendering still need to be folded into the resident sequence.
- Queue-fenced warm scale rows at
  `artifacts/sph-performance-benchmark-direct-resident-scale-warm-queue-fenced.json`
  show the resident mechanics lane still scales poorly: final-batch
  `residentGpuCompletedStageMs=140.2` at `9826` particles and `580.3` at
  `48778` particles, with zero browser-console issues. The path is dispatched
  particle-parallel, but the active-grid expansion and per-substep full
  mechanics sequence are not yet Ocean-fast.
- Mounted phone scene rows can now request the same queue-fence measurement
  with `residentQueueFence=1`. The warm 390x844 DPR 3 row at
  `artifacts/sph-performance-benchmark-mobile-spheres-no-thermal-queue-fenced-warm.json`
  is console-clean but still reports final-batch
  `residentGpuCompletedStageMs=104.2`, `visualRefreshHzEstimate=2.28`, and
  `renderRowsReadbackByteLength=6144` for only `128` particles. The mobile
  sphere bridge fixes visibility/perspective correctness, not throughput.
- This does not replace the architecture target below. The renderer is still
  Three-managed rather than a direct GPU fluid renderer, and explicit
  compact/full readback modes are still required for diagnostics and
  scientific validation.

## Architecture Target

The target hot loop should be:

1. CPU validates scenario, closures, schemas, provenance, cache keys, and UI
   controls outside the frame loop.
2. CPU uploads compact closure tables, wall constants, particle buffers, gas
   state, material tables, and render tables once or when inputs change.
3. WebGPU kernels own the repeated frame loop:
   - particle-to-grid;
   - grid update;
   - pressure/gas/wall force application;
   - grid-to-particle;
   - thermal/phase update;
   - reaction/product sidecar update;
   - compact diagnostics;
   - render-field/surface generation;
   - draw metadata.
4. CPU reads back only compact diagnostics at a throttled cadence.
5. Renderer consumes GPU buffers directly or through a minimal no-full-readback
   bridge.

## Implementation Phases

### Phase 1 - Ocean Reference Audit

- Locally inspect WebGPU-Ocean's MLS-MPM source once network/local clone is
  available.
- Extract its actual buffer layouts, dispatch order, workgroup sizes,
  fixed-point scaling, `atomicAdd` usage, prefix/sort helpers, and render path.
- Record which parts map cleanly to ULG and which conflict with ULG's
  multi-material/closure requirements.
- Do not import TypeScript/React architecture into ULG. ULG remains vanilla JS,
  ES modules, Three.js, and WGSL.

Completion gate:

- A short audit note in `plan/log.md` lists the Ocean kernels/files inspected
  and the ULG mapping decisions.

Phase 1 audit result, 2026-06-18 AKDT:

- Local clone inspected at `/tmp/ulg-webgpu-ocean-audit`.
- MLS-MPM files inspected:
  - `mls-mpm/mls-mpm.ts`
  - `mls-mpm/clearGrid.wgsl`
  - `mls-mpm/p2g_1.wgsl`
  - `mls-mpm/p2g_2.wgsl`
  - `mls-mpm/updateGrid.wgsl`
  - `mls-mpm/g2p.wgsl`
  - `mls-mpm/copyPosition.wgsl`
- Render files inspected:
  - `render/fluidRender.ts`
  - `render/depthMap.wgsl`
  - `render/thicknessMap.wgsl`
  - `render/bilateral.wgsl`
  - `render/gaussian.wgsl`
  - `render/fluid.wgsl`
  - `render/sphere.wgsl`
- The reference dispatches `clearGrid`, two particle-parallel P2G passes,
  `updateGrid`, particle-parallel G2P, and `copyPosition` in one encoder
  sequence. Workgroups are 64 lanes; P2G and G2P are dispatched by particle
  count, while clear/update/finalize-style work is dispatched by grid count.
- The reference uses fixed-point integer `atomicAdd` into grid-cell mass and
  momentum rows. This maps directly to ULG's browser-portable accumulator
  strategy.
- The reference renderer consumes GPU particle/position buffers for depth,
  thickness, sphere, and full-screen fluid passes. This supports ULG's existing
  direction to keep surface/render generation resident rather than relying on
  CPU `MarchingCubes` extraction in the normal path.
- Directly importable pieces: dispatch shape, fixed-point atomics, grid clear/
  update separation, and GPU particle render-buffer flow.
- Not directly importable pieces: simplified material constants, single-fluid
  assumptions, React/TypeScript app structure, lack of ULG closure provenance,
  and lack of product/gas/thermal sidecars.
- ULG mapping decision: the next performance slice should build an explicit
  Ocean-style resident lane around ULG's existing particle-parallel scatter
  P2G, not continue broad optimization of readback-heavy fallback paths.

### Phase 2 - Scatter/Tiled P2G Prototype

- Add a new optional MLS-MPM P2G backend that scatters from particles to grid
  nodes instead of launching one invocation per grid node that loops particles.
- Use fixed-point integer accumulation where WebGPU float atomics are not
  portable enough.
- Accumulate at least:
  - mass;
  - momentum;
  - stress/affine terms;
  - product-event mass/velocity/EOS contributions.
- Keep CPU reference and current gather kernel as parity/fallback paths.
- Add grid-dimension scaling tests so larger boxes increase grid cells, not
  blob radius.

Completion gate:

- Scatter/tiled P2G matches CPU reference within tolerance for single material,
  multi-material, and product-event cases.
- It outperforms the current gather-heavy P2G at medium/high particle counts.

### Phase 3 - Resident Grid/Neighbor Structures

- Add GPU-side spatial structures for remaining SPH-style local interactions:
  - cell hash or grid slot rows;
  - sorted particle indices or fixed-capacity bins;
  - prefix/offset rows;
  - compact overflow diagnostics.
- Use these structures only where ULG still needs pair/local interactions. Pure
  MLS-MPM stages should not reintroduce SPH neighbor cost.
- Keep product-event and gas-cell routing compatible with these structures.

Completion gate:

- Remaining local interaction kernels avoid CPU pair loops and avoid full
  particle readback.

### Phase 4 - Gas, Steam, Wall, And Product Dynamics

- Bind sealed-gas inventory, H2O vapor/droplet state, wall heat ledgers, and
  product-event sidecars into resident kernels.
- Replace diagnostic-only gas pressure with a gas-cell or pressure-gradient
  force path that can push material surfaces conservatively.
- Consume closure-derived EOS, phase, viscosity, and mechanics rows from GPU
  tables.
- Keep strict validation false until conservation and parity gates pass.

Completion gate:

- Product gases and H2O vapor/steam change pressure and forces through resident
  state, not through stale CPU particle scans.

### Phase 5 - GPU-Resident Surface Path

- Finish GPU surface generation:
  - scalar field build;
  - voxel classification;
  - prefix/compaction;
  - triangle/vertex emission;
  - per-surface draw metadata;
  - material/phase/optical ids;
  - indirect draw rows.
- Use WebGPU marching cubes for stable PBR material volumes.
- Evaluate screen-space fluid rendering, Ocean-style, for water/steam visuals
  where it is a better fit than mesh extraction.
- Integrate into Three.js/WebGPU properly. Do not use a custom canvas overlay
  as the long-term architecture.

Completion gate:

- Visible continuous volumes render without CPU `MarchingCubes` mesh extraction
  in the normal path.
- Transparent material depth/z-order behavior is explicitly tested.

Interim status, 2026-06-18 AKDT:

- `three-render-row-points` removes CPU `MarchingCubes` construction from the
  default resident debug route and keeps perspective-shift rendering inside
  the Three scene instead of a separate raw WebGPU overlay.
- Phone-sized viewports now default to `three-render-row-spheres`, an
  instanced-sphere Three bridge that avoids mobile square point-sprite
  artifacts while keeping the object in the normal Three camera/depth path.
  The sphere bridge is capped at 4096 instances and falls back to the point
  bridge above that count.
- The compact surface-vertex bridge remains disabled for the normal path
  because full surface vertex/metadata readback still wedges in browser probes.
- The final phase remains a GPU surface/screen-space fluid path that consumes
  resident buffers directly and shares Three/WebGPU depth without CPU
  geometry readback.

### Phase 6 - Performance Harness

- Add a benchmark harness for:
  - 1k, 10k, 50k, 100k particle counts;
  - box sizes and grid resolutions;
  - single material;
  - H2O/Fe phase scenario;
  - reaction/product-event scenario;
  - gas/steam pressure scenario.
- Report:
  - render FPS;
  - physics FPS;
  - GPU dispatch time per stage;
  - readback bytes per frame;
  - active grid node count;
  - resident buffer sizes;
  - CPU long tasks;
  - cache hits/misses.
- Keep CPU parity tests opt-in for benchmarks; do not run full readback parity
  every frame.

Completion gate:

- Cached warm run reaches an agreed interactive target on the local GPU, and
  bottlenecks are stage-attributed rather than guessed.

Interim status, 2026-06-18 AKDT:

- `npm run bench:sph-performance` exists and runs browser probes with console
  capture, no-full resident stepping, `surfaceDraw=three-render-row-points`,
  and configurable particle counts/batches/substeps.
- The benchmark and long-horizon probe now accept mobile viewport, device-scale,
  and touch settings. Mobile benchmark rows default to
  `surfaceDraw=three-render-row-spheres`.
- The report distinguishes `probeStatus`/`probeIssues` from benchmark
  `status`, and distinguishes `probeWallStepsPerSecond` from
  `residentStageStepsPerSecond`.
- Direct-resident reports can now include queue-fenced GPU timing:
  `measureGpuQueueFence`, `residentGpuQueueFenceMs`,
  `residentGpuCompletedStageMs`, and queue-fence status/method fields in stage
  timing.
- Mounted scene reports can request the same fused-sequence queue-fence timing
  through `residentQueueFence=1` or `ULG_BENCH_MEASURE_GPU_QUEUE_FENCE=1`.
- The report now carries grid-node count, active-grid availability, render-row
  readback byte length, surface draw byte counters, and estimated readback bytes
  per batch/step.
- Remaining harness work: add broader 10k/50k/100k queue-fenced rows, expose
  GPU-side bounds reduction telemetry once that exists, keep scene/render rows
  separate from direct-resident rows, and add a cache warm split for closure
  table and sidecar setup costs.

## ULG-Specific Constraints

- Do not hard-code material properties to make the simulator fast.
- Do not script phase changes, steam, reactions, opacity, color, or pressure.
- Particle count changes resolution and convergence only; it must not change
  the derived material laws.
- Closure derivation may be cached, but cache records must carry provenance,
  generator fingerprints, validity domains, and invalidation guards.
- CPU/control-plane work is acceptable for validation and setup; it is not
  acceptable in the normal per-frame hot loop.
- Keep PeerCompute-compatible buffer/contract boundaries.
- Keep validation flags false until the specific physics claim is proven.

## Acceptance Tests

- P2G scatter/tiled kernel matches CPU reference on mass, momentum, stress, and
  pressure rows.
- Product-event mass, velocity, and EOS fields affect grid dynamics without
  full particle readback.
- Larger sealed boxes increase MLS-MPM grid dimensions at fixed grid spacing
  without enlarging isosurface blobs.
- Normal stepping avoids full particle/grid readback.
- Render and physics FPS counters are decoupled and accurate.
- WebGPU surface path renders continuous PBR material volumes without CPU mesh
  extraction.
- H2O liquid, pure vapor, condensed steam, molten Fe, and solid Fe use
  closure-derived optical/material rows.
- Gas pressure from reactions or vapor can push material through a validated
  force path.
- Device-loss and CPU fallback are visibly reported and do not claim GPU-ready
  status.

## First Implementation Slice

1. Audit WebGPU-Ocean source locally and record kernel/layout decisions.
2. Build a ULG scatter/tiled P2G experimental backend behind an explicit option.
3. Add CPU parity tests for the new backend on small cases.
4. Add a benchmark comparing current gather P2G vs scatter/tiled P2G.
5. Keep the current resident pipeline as fallback until the new backend passes
   parity and performance gates.
