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
- No-full browser probes and benchmarks now default to `compactSummaryMode=none`
  so the normal visual/performance harness does not hide a compact-summary
  `mapAsync` fence inside the batch timing. Diagnostic and parity runs can
  still request compact summaries explicitly.
- The resident marching-cubes extension path now publishes retained translated
  surface/draw buffers and a renderer-capability contract. Current mounted
  scenes report `same-device-gpu-buffer-geometry-blocked-webgl-renderer`
  because they are still Three WebGL-backed. The next no-readback visible
  surface milestone is therefore an engine-owned Three WebGPU renderer path
  plus a storage-buffer geometry bridge, not another canvas overlay.
- The extension path now has a non-overlay WebGL/mobile fallback: when the
  no-readback same-device surface-buffer bridge is blocked, ULG falls back to
  engine-owned Three compact geometry with explicit
  `full-parity-readback` telemetry. This should improve visibility on mobile,
  but it is intentionally not counted as the throughput fix.
- Engine-owned Three surface meshes now proxy transmissive PBR on mobile WebGL
  through closure-derived visible material colors and publish proxy diagnostics.
  This fixes the phone flat-black material failure for CPU/compact fallback
  surfaces, but it is still not the throughput fix because resident compact
  MLS-MPM surfaces remain tied to readback-heavy extraction until the
  same-device renderer lands.
- The first engine-owned Three WebGPU renderer gate remains experimental and
  now fails closed at runtime. Requests for
  `renderer=webgpu&rendererPresentation=1&rendererResidentDevice=1` are
  recorded in diagnostics, but mounted presentation falls back to Three WebGL
  because the current Three WebGPU renderer path still produces
  `Instance dropped in popErrorScope` under browser validation. WebGPU compute
  remains available through the resident compute device path.
- An explicit unsafe diagnostic flag can force that blocked path for local
  investigation, but current evidence still fails with page error
  `Instance dropped in popErrorScope` after `three-webgpu-renderer-ready`.
  Treat this as a diagnostic reproducer only; the roadmap still requires a
  direct engine-owned GPU/native marching-cubes consumer with console and pixel
  evidence before the no-readback renderer is considered viable.
- Follow-up probes have wired `three-webgpu-surface-buffers` through the
  non-overlay `sphResidentSurfaceDraw` bridge, but normal mounted runs block
  that bridge and downgrade to the in-engine `three-render-row-spheres`
  fallback. The current evidence artifact
  `artifacts/sph-probe-three-webgpu-presentation-gated-webgl-fallback-1.json`
  is `status=good`, has zero browser console issues/page errors, blocks Three
  WebGPU presentation with an explicit reason, uses actual renderer
  `three-webgl`, and keeps H2O visible through the sphere bridge. This is a
  correctness/mobile fallback, not a throughput solution.
- The sibling marching-cubes adapter now exposes preflight/capability helpers,
  and ULG's wrapper consumes extension preflight before extraction. This moves
  cross-device and malformed-volume failures to the adapter boundary before
  render bridge construction.
- Retained surface-draw metadata now exposes a no-summary GPU-only handoff:
  when the no-full path skips compact summary readback, it still reports
  retained draw/indirect/compacted-vertex buffers and conservative upper-bound
  draw ranges through `surfaceDrawGpuOnly*` telemetry. This is not a visible
  renderer by itself, but it removes the need for a CPU summary as the contract
  boundary for the future engine-owned GPU surface consumer.
- Explicit native/extension `three-webgpu-surface-buffers` requests now keep
  no-full-readback resident surface buffers as a direct-consumer handoff when
  the visible Three WebGPU bridge is blocked, rather than silently forcing
  compact Three geometry readback. The mounted WebGL fallback remains
  console-clean through `three-render-row-spheres`; the new
  `surfaceDrawGpuBufferHandoff*` and
  `analysis.residentSurfaceBufferHandoffSampleCount` fields distinguish that
  fallback from actual direct GPU consumer readiness. Current probe evidence:
  `artifacts/sph-probe-surface-buffer-handoff-1.json` is `status=good` with
  zero browser console/page errors and `residentSurfaceBufferHandoffSampleCount=0`
  because the mounted path still fell back visibly instead of exercising the
  direct consumer.
- The no-summary render-field route now publishes the direct-consumer handoff
  as `handoffKind=render-field-buffers` with
  `requiresSurfaceExtraction=true`. This is the right pre-native-marching-cubes
  state: retained field buffers are resident and console-clean, but visible
  compact vertex/draw rows still need GPU extraction. Do not treat this as a
  completed renderer until that extraction and engine-owned draw submission are
  browser-console and pixel validated.
- The sibling WebGPU marching-cubes adapter now supports buffer-backed scalar
  volumes, and ULG can describe retained render-field density buffers through
  `createUlgRenderFieldBufferVolumeDescriptor()`. The next implementation
  target is no longer generic adapter work; it is binding that native
  extraction result into ULG's engine-owned surface draw/render bridge without
  CPU readback or overlays.
- Retained no-summary render-field handoffs now also publish sanitized
  per-surface buffer-volume descriptor summaries in the resident render state.
  The browser contract test asserts a ready descriptor set with scalar-buffer
  source type, the extension scalar-field layout name, and 3D scalar strides,
  so native marching-cubes integration has a deterministic handoff instead of
  guessing from retained buffers.
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
- Thermal/reaction-enabled mounted routes can block the multi-step fused
  resident sequence, so the single-step fused no-full mechanics path now also
  accepts active-grid dispatch. The console-clean thermal H2O/H2O probe at
  `artifacts/sph-probe-active-grid-per-step-thermal.json` ran with
  `compactSummaryMode=none` and reported active dispatch over roughly
  `2156/5832` grid nodes. This keeps per-step fallback mechanics from
  reverting to full-grid finalize/update work.
- A comparison probe with explicit `compactSummaryMode=final-only`
  (`artifacts/sph-probe-active-grid-final-summary-default.json`) proves that
  CPU-readable compact bounds are not the default performance fix: it was
  console-clean but `mapAsync` dominated the batch. The next active-grid
  milestone is GPU-side resident bounds reduction and indirect/sparse dispatch
  metadata, not more default compact-summary readback.
- Queue-fenced warm scale rows at
  `artifacts/sph-performance-benchmark-direct-resident-scale-warm-queue-fenced.json`
  show the resident mechanics lane still scales poorly: final-batch
  `residentGpuCompletedStageMs=140.2` at `9826` particles and `580.3` at
  `48778` particles, with zero browser-console issues. The path is dispatched
  particle-parallel, but the active-grid expansion and per-substep full
  mechanics sequence are not yet Ocean-fast.
- Active-grid fused mechanics no longer issues command-encoder full-buffer
  clears in the active-grid path. A generated `clear_accumulators` WGSL entry
  now clears only active AABB accumulator nodes before particle scatter, P2G
  finalize/grid update overwrite active grid/output nodes directly, and the
  dispatch topology reports
  `p2gAccumulatorClear.bufferClearMode=active-grid-compute-clear`.
  Browser direct-resident evidence at
  `artifacts/sph-performance-benchmark-active-grid-accumulator-clear-smoke.json`
  and `artifacts/sph-performance-benchmark-active-grid-accumulator-clear-10k.json`
  is console-clean and queue-fenced. This removes the explicit full-grid clear
  commands but still leaves the 10k direct mechanics row at
  `residentGpuCompletedStageMs=157.5`; next throughput work should target
  GPU-side bounds/sparse or indirect dispatch metadata and the no-readback
  renderer/surface consumer.
- Active-grid fused mechanics now has the first indirect-dispatch contract.
  The CPU active-grid metadata seeds a 12-byte compute dispatch-args buffer,
  and active-grid accumulator clear, P2G finalize, and grid update use
  `dispatchWorkgroupsIndirect()` when available. Unit tests assert the
  direct particle dispatch plus indirect active-node split; the browser harness
  artifact `artifacts/sph-probe-active-grid-indirect-dispatch-1.json` is
  console-clean and reports `indirectDispatchUseCount=3`, active grid
  `1210/2197`, and no direct fallback. This is not the final Ocean-style
  sparse dispatch yet: the dispatch args are still CPU-seeded, so the next
  slice should generate active bounds and dispatch args on the GPU.
- Compact resident summaries now have the first GPU-generated active-grid
  dispatch sidecar. Commit `7206af4` adds a summary planner WGSL pass that
  reads retained compact bounds and writes retained 12-byte compute indirect
  args plus 64-byte metadata. The browser evidence
  `artifacts/sph-probe-active-grid-summary-planner-1.json` is console-clean and
  reports `activeGridDispatchPlanStatus=gpu-active-grid-summary-dispatch-plan-ready`,
  retained args `12` bytes, retained metadata `64` bytes, and active grid
  `54` nodes. This is still a sidecar on a compact-summary run, not the final
  no-fence hot-loop path: next work is to consume these GPU-generated args in
  active-grid mechanics and then move bounds generation out of readback-coupled
  diagnostics.
- Active-grid fused mechanics now consumes that compact-summary dispatch
  sidecar when it is valid for the next step. Commit `3b438f7` carries the
  planner hint through resident state/uploads, borrows compatible retained
  dispatch args for `dispatchWorkgroupsIndirect()`, preserves the borrowed
  buffers across cleanup, and reports structured compatibility reasons on
  fallback. The direct-resident evidence
  `artifacts/sph-direct-active-grid-planner-borrowed-step1-1.json` is
  console-clean and shows batch 2 dispatching from
  `source=compact-summary-gpu-sidecar` with
  `dispatchPlanHintBorrowed=true` and `metadataBufferByteLength=64`.
  The two-step/final-only evidence
  `artifacts/sph-direct-active-grid-planner-step-summary-1.json` is also
  console-clean and shows first-step borrowing followed by a correct stale-hint
  clear before the final step. This proves the handoff contract, but it still
  depends on compact-summary planning; the next throughput fix is a no-readback
  GPU planner that can refresh sparse dispatch args every hot-loop step.
- Active-grid planning now has that no-readback hot-loop planner mode. Commit
  `e9f6b0c` lets resident summaries submit the GPU planner passes with
  `readCompactSummary=false`, retain the same 12-byte indirect args plus
  64-byte metadata sidecar, skip the compact readback buffer/copy/map/decode,
  and defer temporary cleanup behind submitted GPU work. Single-step and
  fused-sequence active-grid MLS-MPM now request this planner even when
  `compactSummaryMode=none`. Direct-resident evidence
  `artifacts/sph-direct-active-grid-planner-only-nosummary-1.json` is
  console-clean and shows batches 2/3 borrowing
  `source=compact-summary-gpu-sidecar`, `dispatchPlanHintBorrowed=true`, and
  `mapAsync=null`. Mounted evidence
  `artifacts/sph-probe-active-grid-planner-only-mounted-nosummary-2.json` is
  also console-clean, reports worker capability ready with `workerCount=12`,
  and shows `resident-render-field-applied`; it remains visually `bad` because
  surface-summary readback was skipped and the current WebGL-backed surface
  draw path has no visible surface samples. This moves the active-grid planner
  out of the compact-summary map fence; remaining throughput work is the
  no-readback surface renderer/consumer, thermal/reaction sidecar fusion, and
  Ocean-style sparse P2G/grid optimizations.
- No-summary mounted render now has a direct no-overlay render-field buffer
  handoff for the future engine consumer. In `auto` surface-draw mode with
  `renderFieldSurfaceSummaryMode=skip` and no-full render rows, ULG retains the
  render-field rows and surface buffers, fences submitted work with
  `queue.onSubmittedWorkDone()`, and reports
  `resident-render-field-buffers-retained`,
  `resident-surface-buffers-no-overlay`,
  `resident-render-field-buffer-direct-consumer-ready`, and retained byte
  lengths without creating compact surface-draw metadata/readback buffers. The
  focused Playwright no-summary test passes, and
  `artifacts/sph-probe-no-summary-render-field-handoff-1.json` completed with
  zero browser console issues/warnings and
  `residentSurfaceBufferHandoffSampleCount=4`. The probe still classifies
  visually `bad` because the actual engine/marching-cubes consumer is not bound
  yet; that binding is now the next visible-render milestone. Current browser
  state names the required input as
  `surfaceDrawGpuBufferHandoffSurfaceExtractionInputKind=render-field-density-storage-buffer`
  and the required consumer as
  `surfaceDrawGpuBufferHandoffSurfaceExtractionConsumerKind=native-webgpu-marching-cubes-buffer-volume`.
- The extension surface bridge planner now preserves the no-readback contract by
  default. When a no-full extension surface request cannot use same-device Three
  WebGPU buffer geometry, the planner retains resident surface buffers and
  reports `resident-surface-buffers-no-overlay` instead of silently downgrading
  to full-readback Three compact geometry. Explicit `three-compact-vertices`
  is now blocked by default because the current compact extractor emits
  tetrahedralized render-field cube geometry rather than true marching cubes,
  and compact readback can stall. Routine no-full performance routing now keeps
  the missing native buffer-volume direct consumer visible as the blocker.
- Runtime MLS-MPM dispatch topology is now explicit in both the resident step
  diagnostics and browser probe output. The console-clean mobile scene artifact
  `artifacts/sph-long-probe-mobile-dispatch-topology-2.json` reports
  `cpuParticleLoopInHotPath=false`, P2G `particle-parallel-scatter`, and G2P
  `particle-parallel-gather`. The console-clean direct resident diagnostic
  artifact `artifacts/sph-direct-resident-dispatch-topology-sequence.json`
  exercises a two-substep fused mechanics sequence with `totalDispatches=8`
  and active-grid finalize/update over `active-grid-node` axes. This shifts
  the next throughput work away from proving basic particle parallelism and
  toward sparse/indirect active-grid dispatch, GPU-side bounds reduction,
  thermal/reaction sidecar fusion, and no-readback surface rendering.
- Mounted phone scene rows can now request the same queue-fence measurement
  with `residentQueueFence=1`. The warm 390x844 DPR 3 row at
  `artifacts/sph-performance-benchmark-mobile-spheres-no-thermal-queue-fenced-warm.json`
  is console-clean but still reports final-batch
  `residentGpuCompletedStageMs=104.2`, `visualRefreshHzEstimate=2.28`, and
  `renderRowsReadbackByteLength=6144` for only `128` particles. The mobile
  sphere bridge fixes visibility/perspective correctness, not throughput.
- A first raw WebGPU render-row overlay experiment can retain and bind the GPU
  render-row buffer, but mounted pixel checks showed a black presented frame
  even when the diagnostic shader ignored storage and camera projection. Until
  that path passes a browser pixel-present test, requests for
  `surfaceDraw=webgpu-render-row-points` or `webgpu-render-row-spheres` are
  routed to the safe Three render-row bridges and reported with
  `surfaceDrawDiagnosticFallbackReason=webgpu-render-row-overlay-disabled-pending-pixel-validation`.
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

Native WebGPU Marching Cubes checkout assessment, 2026-06-18 AKDT:

- Local source: `/home/cos/projects/webgpu-marching-cubes`.
- Useful references:
  - `src/marching_cubes.ts`;
  - `src/exclusive_scan.ts`;
  - `src/stream_compact_ids.ts`;
  - `src/mark_active_voxel.wgsl`;
  - `src/compute_num_verts.wgsl`;
  - `src/compute_vertices.wgsl`;
  - `src/three_webgpu_marching_cubes.ts`.
- Fit decision: good fit for the extraction algorithm, not a direct renderer
  replacement. The pipeline marks active voxels, stream-compacts voxel ids,
  scans per-voxel vertex counts, and emits a compact GPU vertex buffer. That
  directly targets ULG's current retained surface path, which still allocates
  fixed slots from `totalFieldCells * maxVertsPerCell` and disables compact
  surface vertices in normal browser probes because full surface vertex and
  metadata readback can wedge the GUI.
- Required adaptation: use ULG storage-buffer render fields and per-surface
  material/phase/optical metadata instead of the reference's single
  `texture_3d<f32>` volume and one-isovalue mesh. Output rows need material
  ids, PBR/optical table ids, normals or normal-reconstruction inputs,
  draw-order/depth policy, and indirect draw metadata.
- Renderer boundary: the reference's Three integration assigns a generated
  `GPUBuffer` through `renderer.backend.get(interleaved).buffer`, which
  depends on Three `WebGPURenderer` and same-device ownership. ULG currently
  still uses the normal Three scene path for mounted browser rendering, so
  this should not be introduced as a separate overlay or a second GPU device.
- Hot-loop requirement: remove or hide the reference readback/fence points
  before using the pattern in the normal frame loop. Counter readback is
  acceptable for diagnostics, but the production path should keep compact
  counts, draw ranges, and draw metadata resident or update them through
  budgeted diagnostics.

Extension refactor routing, 2026-06-18 AKDT:

- The native checkout is now the right place to build the swappable extraction
  adapter before ULG consumes it. Required adapter shape:
  - vanilla JS ES module exports, no TypeScript/React requirement;
  - accepts a caller-owned `GPUDevice` and never requests a second device in
    the default ULG path;
  - validates or reports same-device buffer ownership instead of binding stale
    cross-device handles;
  - accepts ULG-style storage buffers for scalar/render fields and
    material/phase/optical metadata, not only the reference `texture_3d<f32>`;
  - emits resident compact vertex, normal/material rows, per-surface draw
    metadata, and indirect draw inputs through stable status objects;
  - keeps DOM/canvas/Three binding optional so ULG can swap between
    metadata-only, Three/WebGPU, or future screen-space fluid renderers;
  - includes tests or a mock-device contract proving factory swapability,
    caller-owned-device behavior, and no hidden readback/overlay requirement.
- ULG integration should wait for that adapter boundary, then add one engine
  bridge inside the existing `sphPhaseScene` resident surface path. Do not
  introduce a separate canvas overlay as the completion target.

Integration progress, 2026-06-18 AKDT:

- The sibling `/home/cos/projects/webgpu-marching-cubes` checkout now has a
  vanilla JS adapter boundary that accepts a caller-owned `GPUDevice`, reports
  same-device ownership, and emits compact `float32x4-position` surface
  buffers without taking over DOM/renderer ownership.
- Extension commit `62a65cc Expose compact surface row metadata` adds
  readback-free `rowMetadata` for compact position, normal, and material
  families. Position rows point at the retained GPU buffer; normal/material
  rows explicitly report `*-rows-not-produced` so ULG can translate or reject
  deliberately.
- ULG now has a translation boundary in `sphMarchingCubesSurfaceAdapter.js`:
  a CPU-reference contract for compact position rows, plus a same-device
  WebGPU kernel that converts retained extension compact positions into ULG
  16-float surface vertex rows, surface draw rows, and indirect draw rows.
  The resident WebGPU path leases retained vertex/draw/indirect buffers and
  rejects known cross-device extension buffers before bind-group creation.
- ULG consumes extension compact position buffers through
  `result.rowMetadata.position` when present, while retaining compatibility
  with the older top-level `result.buffer` shape.
- `sphPhaseScene` now exposes
  `refreshSphResidentSurfaceDrawFromExtension()`, which publishes those
  retained extension buffers into the engine-owned `sphResidentSurfaceDraw`
  state without creating a canvas overlay or requesting a second GPU device.
- `refreshSphResidentSurfaceDrawFromExtension()` can now be called with
  `renderBridgeMode=three-compact-surface-geometry` to translate extension
  compact positions into ULG rows, feed the existing Three scene material/PBR
  bridge, and remain inside the engine-owned camera/depth path. This is a
  correctness/mobile fallback slice, not the final hot path, because it uses
  full row readback when that bridge mode is requested.
- The compact surface bridge resolves numeric GPU `materialId` and `phaseId`
  rows back through the SPH render material map before creating materials.
  That preserves closure-derived H2O, element, and product PBR instead of
  falling into synthetic unknown-material keys such as `material-*`/`phase-*`
  that render as black blocked surfaces on reduced metadata paths.
- Remaining gap: the no-full-readback extension surface buffers are resident
  and scene-state integrated, but normal mounted presentation deliberately does
  not consume them through Three WebGPU yet. The next performance slice is a
  direct engine-owned GPU surface consumer, likely using the native
  marching-cubes compaction pattern and ULG draw/material rows, with browser
  console and pixel validation. Do not count this phase complete until the
  visible no-readback bridge exists without enabling the currently failing
  Three WebGPU presentation path.
- Priority update, 2026-06-18 AKDT: treat direct resident GPU surface
  consumption as the architectural fix ahead of further fallback tuning.
  Three WebGPU presentation and `three-webgpu-surface-buffers` remain
  fail-closed because they still fail browser error-scope validation when
  enabled directly. The accepted mounted safety path is now the console-clean
  Three WebGL presentation plus `three-render-row-spheres` fallback; it is
  useful for mobile/correctness evidence but does not satisfy the no-readback
  throughput target.

Interim status, 2026-06-18 AKDT:

- `three-render-row-points` removes CPU `MarchingCubes` construction from the
  default resident debug route and keeps perspective-shift rendering inside
  the Three scene instead of a separate raw WebGPU overlay.
- Phone-sized viewports now default to `three-render-row-spheres`, an
  instanced-sphere Three bridge that avoids mobile square point-sprite
  artifacts while keeping the object in the normal Three camera/depth path.
  The sphere bridge is capped at 4096 instances and falls back to the point
  bridge above that count.
- The sphere bridge now reuses per-surface `InstancedMesh` objects across
  resident refreshes and exposes reuse/create/dispose counters to the harness.
  It refreshes the material when the closure-derived optical signature changes
  so mesh reuse does not freeze PBR state.
- The compact surface-vertex bridge remains disabled for the normal path
  because it is both readback-heavy and currently built on tetrahedralized
  render-field cube geometry, not true native marching cubes.
- The raw WebGPU render-row overlay remains disabled for the normal path after
  black-frame pixel checks. It must either be fixed inside the normal
  Three/WebGPU presentation/depth path or replaced by the screen-space fluid
  renderer; a separate canvas overlay is not an acceptable completion target.
- The final phase remains a GPU surface/screen-space fluid path that consumes
  resident buffers directly and shares Three/WebGPU depth without CPU
  geometry readback.
- Material-interface extraction now has an explicit visual-cadence candidate
  readback budget. Oversized candidate fields publish
  `material-interface-field-candidate-readback-skipped` before any WebGPU
  allocation, preventing the 300MB-class candidate/readback buffers from
  spamming validation errors or stalling render refreshes. The replacement
  target remains a compact GPU-resident material-interface summary/consumer,
  not a larger per-frame CPU readback.

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
- The browser probe report also carries Three sphere bridge mesh
  reuse/create/dispose counts. Current H2O/H2O `three-render-row-spheres`
  evidence is console-clean, disables compact summary readback by default, and
  reuses both sphere meshes on resident refreshes.
- The report now also carries requested/effective surface draw modes and a
  fallback reason. This prevents `webgpu-render-row-*` requests from looking
  like a successful direct-GPU renderer when they were intentionally routed to
  the Three fallback after a failed pixel check.
- Remaining harness work: add broader 10k/50k/100k queue-fenced rows, expose
  GPU-side bounds reduction telemetry once that exists, keep scene/render rows
  separate from direct-resident rows, and add a cache warm split for closure
  table and sidecar setup costs.
- 2026-06-18 03:30 AKDT update: active-grid carry-forward no longer persists
  the safety-cell halo into unread resident bounds; `predictedMotionM` and
  `safetyMarginM` are reported separately. The mounted Three render-row bridge
  is now retained through async refresh even when CPU surface signatures are
  `empty`, fixing blank/stale bridge frames during perspective/refresh changes.
  The remaining mounted-scene bottleneck is unchanged: row-point/row-sphere
  bridges still require render-row readback, so the next architectural renderer
  slice must consume resident GPU render data directly.
- 2026-06-18 active-grid per-step update: the per-step fused mechanics fallback
  now uses active-grid P2G/finalize/grid-update kernels when the runtime cannot
  use a multi-step fused sequence. This is a necessary thermal/reaction sidecar
  bridge, but it does not change the larger roadmap: final bounds, draw counts,
  and surface data still need to stay resident so the GUI avoids hidden
  readback fences.
- 2026-06-18 dispatch-topology update: resident MLS-MPM fused WebGPU paths now
  report a `peercompute.ulg.mls-mpm-resident-dispatch-topology.v0` contract.
  P2G is `particle-parallel-scatter`, G2P is `particle-parallel-gather`, and
  P2G-finalize/grid-update are grid-node or active-grid-node passes with
  per-substep workgroup counts. This confirms the next throughput target is
  resident surface/render generation and readback removal, not replacing the
  current P2G/G2P dispatch shape.

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
