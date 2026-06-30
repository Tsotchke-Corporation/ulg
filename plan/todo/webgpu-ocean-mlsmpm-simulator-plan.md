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

- the current P2G path is particle-parallel scatter, but it is still the
  resident baseline rather than a selectable tiled/local-accumulator Ocean
  backend with benchmarked replacement gates;
- many paths still keep CPU parity/readback or CPU mesh extraction close to the
  live loop;
- CPU `MarchingCubes` remains the visible fallback;
- closure derivation and table construction still run through heavy JavaScript
  or worker paths;
- product gases, steam, wall heat, and phase states are not yet fully resident
  dynamics;
- draw buffers are not yet fed to a fully GPU-resident Three/WebGPU render path.

Tactical status, 2026-06-28 AKDT:

- Presentation-worker mechanics execution is now browser-proven. The
  worker-owned offscreen presentation worker can run the mechanics resident
  stage runner on its own WebGPU device, and a same-lane
  `P2G -> gridUpdate -> G2P` diagnostic chain completes with WebGPU/no-full
  readback, retained worker GPU refs, and `gpuFenceSatisfied=true`.
  CPU-visible queue fences fail on this worker-owned presentation device in
  Chromium, so same-worker GPU handoff uses explicit WebGPU same-queue ordering
  via `queue-submitted-same-worker-gpu-handoff-no-cpu-fence`.
- Scheduler wiring is now automatic but evidence-only. Render ownership policy
  can request `presentationWorkerResidentStages=1`; the scene exposes
  `runWorkerOffscreenMechanicsStageChainOnPresentationDevice()` for diagnostics
  and automatically runs the chain when cloneable resident state plus the
  presentation-worker device are ready. Telemetry is
  `peercompute.ulg.presentation-worker-mechanics-stage-chain-auto.v0` and
  reports
  `statePromotionStatus=not-promoted-worker-local-output-awaiting-state-manager-admission`.
  Follow-up now directly consumes the retained presentation-worker G2P output
  for worker-local presentation: the offscreen worker resolves the retained
  state/thermo buffers in-module, binds them in the resident particle-state
  producer, and reports `worker-retained-resident-stage-output` with
  `sourceStateTransferBytes=0` and copied display bytes `0`. Follow-up now
  publishes a non-mutating
  `peercompute.ulg.presentation-worker-retained-state-promotion-candidate.v0`
  contract with
  `statePromotionStatus=pending-state-manager-admission-worker-local-retained-refs`.
  The presentation-only option is now explicit:
  `renderOwnership=presentation-worker-retained-output-presentation-only`
  auto-requests this retained G2P chain, resolves to the implemented
  worker-owned resident producer path, and reports
  `statePromotionMode=presentation-only` with
  `authoritativeStateMutationExpected=false`. Follow-up added
  `peercompute.ulg.presentation-worker-retained-state-promotion-admission.v0`;
  ready promotion candidates commit warm deltas under
  `ulg-presentation-worker-retained-state-promotion-admissions`, store a
  worker-retained hot-buffer key, and expose a same-worker continuation
  contract while keeping `portableState=false` and
  `authoritativeStateMutation=false`. Follow-up now consumes that admitted
  hot-buffer key on the same presentation-worker lane: the scene derives a
  `same-worker-retained-continuation-ready` plan, reruns the
  `P2G -> gridUpdate -> G2P` chain with `useWorkerRetainedG2pInput`, and
  records `applied-worker-retained-g2p-input` on P2G. This is deliberately
  same-device and same-worker only. Follow-up added
  `peercompute.ulg.worker-retained-portable-materialization-contract.v0` so
  the admission/continuation path now explicitly reports
  `crossPeerReplayStatus=blocked-portable-compact-buffer-snapshot-required`.
  Portable snapshots for cross-peer replay remain a separate architecture task
  that must export compact
  `peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0` rows or use a
  peer-local materialization protocol.
  Follow-up wired that compact snapshot export request through the scene,
  offscreen presentation bridge, and mechanics worker, and the benchmark can
  wait for a terminal snapshot status when explicitly requested. Browser
  evidence blocks at `worker-retained-compact-snapshot-readback-failed`:
  Chromium rejects `mapAsync` on the retained `sph-state` readback buffer with
  `A valid external Instance reference no longer exists`. Snapshot export is
  now opt-in via policy/URL/benchmark flags so the normal retained-presentation
  hot path does not run the failing readback. Follow-up implemented the
  export-owned clone-buffer branch: when retained compact snapshot export is
  requested, the presentation worker captures private G2P state/mechanics
  sources before the original stage outputs can expire, and the focused worker
  unit test proves compact snapshot export still succeeds after the original
  G2P buffers are destroyed. Live HTTPS benchmark evidence still blocks at
  worker `mapAsync` on the readback buffer itself, even with
  `compactSnapshotExportSourceStatus=worker-retained-compact-snapshot-export-sources-ready`.
  The next cross-peer slice is therefore no longer another clone/lifetime
  change; bypass worker mapped readback with a GPU-side publication or
  peer-local materialization path. Follow-up implemented the first bypass:
  once a presentation-worker retained continuation is already applied, the
  offscreen bridge publishes
  `presentation-worker-retained-compact-snapshot-export-bypassed-local-materialization-ready`
  with `localMaterializationMode=same-worker-lane-retained-buffer-ref`,
  `workerMapAsyncBypassed=true`, `readbackByteLength=0`, and
  `portableSnapshotAvailable=false` instead of posting another worker compact
  snapshot export. This satisfies the local/same-worker replay contract and
  leaves portable cross-peer replay blocked until a GPU-side publication or
  validated compact snapshot path exists. Live HTTPS benchmark evidence with
  `ULG_BENCH_RETAINED_COMPACT_SNAPSHOT_EXPORT=1` now reports
  `probeStatus=good`,
  `workerOffscreenRetainedCompactSnapshotStatus=presentation-worker-retained-compact-snapshot-export-bypassed-local-materialization-ready`,
  `workerMapAsyncBypassed=true`, `readbackByteLength=0`, and
  `estimatedReadbackBytesPerStep=0`.
  Follow-up tightened the StateManager/PeerCompute contract so same-worker
  retained refs are also listed as an accepted local materialization mode:
  `localMaterializationStatus=same-worker-lane-retained-buffer-ref-ready`,
  `acceptedLocalMaterializationModes=[same-worker-lane-retained-buffer-ref]`,
  `sameWorkerLocalMaterializationAvailable=true`, and
  `localMaterializationCanBypassSnapshot=true` while cross-peer replay remains
  blocked for same-worker-only refs. Follow-up completed the
  compact-candidate portable snapshot path for producers that already provide
  `peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0`: the mechanics
  compact seed validates and clones SPH state, SPH thermo, and MLS-MPM
  mechanics rows, records
  `localRefreshContract.status=validated-compact-buffer-snapshot-ready`,
  sets `portableSnapshotAvailable=true`, and the compact refresh executor can
  rebuild peer-local hot GPU buffers from the seed without an out-of-band
  snapshot injection. This does not re-enable presentation-worker `mapAsync`
  export as the default path on the current device.
  Follow-up also added a presentation-only fast path for visible retained
  output: once the worker has rendered a retained G2P frame, main-thread
  resident render refresh publishes
  `resident-render-presentation-worker-retained-output-preserved`, skips the
  legacy Three render-row bridge, keeps `renderRowsReadback=false` and
  `renderRowsReadbackByteLength=0`, and preserves the worker-owned canvas
  (`transferControlToOffscreen`, copied display bytes `0`). A same-URL
  screenshot showed the sky-blue scene, grid, and particles visible while the
  benchmark summary reported no browser console issues.
- Follow-up diagnosed the apparent one-frame-per-second playback as two
  separate effects. The benchmark's large `meanBatchMs` was dominated by a
  headless browser RAF wait after viewport refresh (`viewportRafMs` around
  `3.2 s`), while the resident step and render refresh were much smaller.
  Live playback also showed an actual interactive bottleneck: each visible
  worker frame was being wrapped in `ComputeManager.submitTask`, producing
  roughly `95-176 ms` resident wall time even when the inner GPU stage was only
  about `3 ms`. Render ownership policy now exposes
  `residentComputeManagerMode` so PeerCompute can choose `direct` or
  `compute-manager` by use case. The local interactive worker-presentation
  default is now `direct`, still capped at one visible substep per schedule;
  throughput and explicit PeerCompute task modes can stay on
  `compute-manager`. Browser evidence on the H2O/H2O worker-owned sphere path
  now shows steady direct resident submissions around `5-9 ms`, render refresh
  around `7-12 ms`, and worker frame counts advancing around `40+ fps` after
  cold start. Next performance work should target the cold first worker-owned
  render refresh and make the benchmark distinguish headless RAF throttling
  from physics/render wall time.
  Follow-up completed the benchmark-trust half of that note:
  scenario summaries now publish
  `peercompute.ulg.sph-performance-benchmark-wall-time-attribution.v0`,
  `probeEngineBatchMs`, `probeEngineStepsPerSecond`, and
  `probeResidentBatchViewportNonRafMs`. The worker-presentation smoke reports
  `probe-wall-dominated-by-browser-raf`, with about `3.42 s` of RAF wait
  versus about `86 ms` of engine-visible work. Copy-back budget estimates now
  use the configured presentation target FPS instead of the throttled headless
  wall refresh rate.
  Follow-up completed the cold first worker-owned render refresh slice. The
  worker-owned particle-state presentation path no longer extracts visual
  render rows just to feed a main-thread bridge, and the mounted scheduler can
  defer the first pipelined material/pressure interface refresh for a
  PeerCompute-configurable warmup frame count. The first render refresh also
  skips main-thread optical lookup work for the worker-owned particle-state
  presentation path. A fresh HTTPS H2O/H2O worker-owned sphere probe now shows
  early frames within the first 650 ms, `renderRowsMs=0`,
  `opticalLookupMs=0`, `renderRefreshTotalMs` around `8-9 ms`, and worker
  ready frames advancing immediately.
- Follow-up on the worker-owned H2O/H2O sphere scenario found the remaining
  material-interface freshness bottleneck was the dense visual render-field
  table, not the full render-row readback fallback. A direct HTTPS timing check
  showed `17907 ms` with `renderRowsReadback=false` and
  `renderFieldReadback=false` while the material-interface field scanned the
  `272072`-cell visual table. The standalone pressure/material-interface
  refresh now seeds surface descriptors from resident particle metadata or
  scenario material properties, then builds a separate coarse
  material-interface table capped at `24000` cells / resolution `18`. The same
  URL now reports `1089.6 ms`, `15760` material-interface cells,
  `residentSurfaceTableTotalFieldCells=272072`, no render-row/readback, and no
  captured console issues. This is a tactical fix, not the final sparse
  interface extractor; the next slice should make interface extraction
  GPU-local and sparse rather than scanning every particle against every field
  cell.
- Follow-up compacted the material-interface candidate readback itself. The
  resident scene now opts into `compact-active-readback`, where the WebGPU
  candidate shader atomically appends only active crossing faces and reads
  compact metadata before row readback. The H2O/H2O worker-owned sphere probe
  mapped `768` compact candidate bytes for `12` active rows instead of the
  `3025920`-byte dense candidate table (`candidateCount=47280`,
  `candidateDenseRowsByteLength=3025920`,
  `candidateCompactRowsByteLength=768`). The remaining steady refresh is still
  around `1.2 s`, so the current bottleneck has moved upstream to
  `buildSphMaterialInterfaceSourceFieldWebGpu()`'s
  coarse-field-cells-by-particles splat. Next performance work should replace
  that with a sparse/source-local or particle-to-field resident builder rather
  than further candidate-readback tuning.
- Render-field and compact-candidate pipeline caching now shows cache hits but
  does not materially move the steady material-interface refresh, so pipeline
  creation is not the remaining bottleneck. The coarse
  material-interface/source-field budget is now an explicit
  `peercompute.ulg.material-interface-surface-table-policy.v0`, configurable
  through PeerCompute/runtime authority policy or URL aliases
  `miCells`/`miRes`. The default policy is now `8000` cells / max resolution
  `14`, which cuts the H2O/H2O worker-owned sphere source table to `6591`
  cells and steady refresh to roughly `317-562 ms`; an aggressive
  `miCells=4000&miRes=12` override reached `3993` cells and roughly
  `283-352 ms` while still producing material-interface rows. Treat this as a
  bounded tactical policy until the sparse/source-local field builder lands.
- Follow-up landed the source-local material-interface source-field builder.
  The resident material-interface refresh now dispatches over
  particles/product events and surfaces, splats only local support cells into a
  quantized atomic density buffer, resolves that into the existing field-row
  layout, and then reuses the existing compact candidate extractor. A live
  HTTPS H2O/H2O worker-owned sphere refresh reports
  `interfaceSourceFieldBackend=webgpu-source-local`,
  `interfaceSourceFieldSourceLocal=true`, `sourceCount=1024`,
  `estimatedCellVisits=384000`, `denseCellParticlePairs=6749184`,
  `estimatedVisitRatio=0.0569`, `renderFieldReadback=false`,
  `renderRowsReadback=false`, compact candidate readback, and about `204 ms`
  warm refresh time. The worker-owned smoke benchmark remains `good` with
  `estimatedReadbackBytesPerStep=0`.
- Render ownership is now a PeerCompute-compatible policy via
  `peercompute.ulg.render-ownership-policy.v0`. The policy can select
  `main-thread-renderer`, `worker-offscreen-render-rows`,
  `worker-owned-resident-render-producer`, or
  `cross-worker-gpubuffer-structured-clone` per use case. Local demos can seed
  it with `renderOwnership=...`; PeerCompute/runtime options can supply it
  directly.
- `worker-owned-resident-render-producer` is now an executable target mode. It
  requests the worker-owned presentation canvas, runs a worker-local WebGPU
  compute pass to produce the render-row storage buffer, and does not request
  the blocked direct retained-GPUBuffer handoff. The benchmark with
  `ULG_BENCH_RENDER_OWNERSHIP=worker-owned-resident-render-producer` reports
  requested/effective mode `worker-owned-resident-render-producer`,
  `worker-offscreen-resident-render-producer-rendered`,
  `workerLocalRenderRowsProduced=true`, first source upload `512` bytes,
  retained GPUBuffer handoff `not-requested`, copied display bytes `0`, and
  scenario `good`.
- Repeated unchanged-source producer draws now reuse a worker-resident source
  cache. The targeted HTTPS Playwright smoke renders the same resident
  execution twice and reports first draw
  `source-cache-uploaded`/`sourceTransferBytes=512`, second draw
  `source-cache-reused`, `sourceCacheHit=true`, `sourceRowsPacked=false`,
  `sourceTransferBytes=0`, and `inputTransferBytes=64`. That reduced repeated
  visual-source transfers and avoided repeated row packing; the follow-up below
  supersedes the first decoded-row upload with particle-state source transfer.
- The first-upload source has now moved from decoded visual rows to packed
  resident SPH particle state/thermo plus a compact material/phase color table.
  The worker owns the particle-state producer compute pass, writes compact
  render rows into its local storage buffer, and draws on the transferred
  canvas without forcing full render-row readback. Fresh benchmark evidence
  reports `worker-offscreen-resident-particle-state-producer-rendered`,
  `producerSourceKind=worker-resident-particle-state`,
  `sourceRowsPacked=false`, decoded visual source transfer `0`,
  state source transfer `1312` bytes on first upload,
  `renderRowsReadbackByteLength=0`, readback mode `no-full-readback`, no
  readback coercion, copied display bytes `0`, and
  `renderRowsReadbackWorkerOwnedResidentParticleStateProducerReadbackFree=true`.
- Worker-owned offscreen presentation now has a concrete transferred-canvas
  path. `workerOffscreenPresentation=1` creates a displayed canvas layer,
  transfers it with `transferControlToOffscreen`, and the worker configures
  WebGPU directly on that `OffscreenCanvas` while reporting zero copied display
  bytes and rejecting `frame-copy-back`.
- Follow-up worker rendering now accepts compact decoded render rows through
  `peercompute.ulg.worker-offscreen-render-rows.v0`. The worker writes the
  compact particle rows to a worker-local storage buffer and draws instanced
  quads directly to the transferred canvas. The current benchmark smoke with
  `surfaceDraw=three-render-row-points` reports
  `worker-offscreen-render-rows-rendered`, `particleCount=16`, compact input
  transfer `576` bytes, copied display bytes `0`, zero browser console issues,
  and suite gate `pass`.
- In `surfaceDraw=auto`, `workerOffscreenPresentation=1` now explicitly forces
  full render-row readback for this transitional bridge and reports
  `worker-offscreen-render-rows-transitional-bridge-requires-fresh-physics-readback`.
  The auto-mode smoke also renders 16 worker particles with 576 compact input
  bytes, copied display bytes `0`, zero browser console issues, and suite gate
  `pass`.
- The decoded-row path remains transitional, but the particle-state producer is
  the current accepted zero-copy worker presentation path. Direct retained
  GPUBuffer handoff is still blocked in the current browser/page: the local
  HTTPS Playwright probe throws `DataCloneError` for `GPUBuffer` postMessage to
  a worker, and the benchmark reports direct retained GPUBuffer handoff
  `not-requested` for this policy. The next renderer optimization is therefore
  not frame-copy-back or cross-worker GPUBuffer transport; it is wiring the
  proven presentation-worker resident stage chain into PeerCompute-selected
  hot-loop scheduling.

Tactical status, 2026-06-19 AKDT:

- Reaction proposal now has a GPU-resident neighbor-bin producer. The WebGPU
  reaction step builds bounded fixed-capacity particle bins in the same command
  encoder as pack/propose/resolve/unpack, and the `propose` shader scans
  neighboring cells when the grid is ready. The all-particle scan is now a
  named fallback, not the normal ready-grid path. Mounted diagnostics expose
  `reactionProposalNeighborMode`, bin status, cell count, capacity, and
  index-buffer bytes. The current Na/H2O resident browser probe is
  console-clean and reports `fixed-capacity-particle-bin-grid` with `343`
  cells. This closes the first reaction-locality slice; prefix-scan compact
  bins should wait for measured overflow/dense-chemistry evidence.
- Reaction-bin exact overflow metadata readback is now debug-opt-in and
  browser-clean. `reactionBinMetadataReadback=1` reaches the scene/resident
  reaction kernel, copies the 16-byte metadata block through a buffer with
  explicit `COPY_SRC` usage, and reports completed overflow diagnostics. The
  Na/H2O debug probe reports overflow count `0`, so prefix-scan reaction bins
  remain deferred until a dense chemistry case proves fixed-capacity overflow.
- `peercompute.ulg.mls-mpm-p2g-backend-policy.v0` now makes the P2G backend
  explicit. The current WebGPU path reports `resident-scatter`, and requests
  for `ocean-tiled-experimental` fail closed to resident scatter with
  `ocean-tiled-p2g-kernel-not-available` until the tiled kernel exists. Focused
  fake-device coverage proves the no-full WebGPU P2G path does not silently
  claim the Ocean replacement is live. The same policy is threaded into
  resident dispatch topology, fused no-full mechanics, fused sequence setup,
  resident diagnostics, and condensed step summaries; focused resident tests
  prove the actual hot loop reports the fallback policy too.
- Resident MLS-MPM task envelopes now expose
  `peercompute.ulg.mls-mpm-webgpu-ocean-hot-loop-budget.v0`. The helper
  normalizes no-full/no-summary readback budgets, compact-summary step counts,
  active-grid enablement, final-only active-grid plan refresh, and the
  resulting upload/readback/retained byte counts. Single-step, multi-step, and
  mechanics-only resident task factories carry the same budget through
  `webgpu`, `gpuResidentLane`, `lawGraphNode`, and `data`. Focused coverage
  proves `compactSummaryMode=none` and active-grid/final-only resident
  sequences report zero readback bytes without changing kernel behavior.
- Native visible-consumer diagnostics now classify blocked validation by
  family while staying fail-closed. `resolveResidentSurfaceVisibleGpuConsumer()`
  distinguishes `native-surface-validation-readback-lifetime`,
  `resident-device-texture-readback-unavailable`,
  `browser-pixel-validation-readback-lifetime`, and pending validation, then
  publishes the classification through resident render-state summaries. This is
  diagnostic plumbing only; it does not mark native rendering ready without
  pixel/readback validation.
- Same-device native consumer import telemetry now reaches both long-horizon
  probe metrics and performance benchmark artifacts. The flattened fields
  report whether the native path selected a main-thread same-device import, its
  route, thread, engine-owned device scope, and readiness status, so benchmark
  evidence can distinguish true same-device native presentation from a fallback
  without reopening mounted Playwright internals. A tiny native benchmark
  against the live HTTPS server reports same-device import selected `true`,
  route `native-webgpu-surface-consumer`, device scope
  `engine-owned-native-webgpu-canvas-device`, and status
  `same-device-main-thread-import-awaiting-pixel-validation`; the remaining
  blocker is still browser-frame validation, not console errors or readback
  bytes. Follow-up native benchmark classification now distinguishes the local
  headless transparent-black canvas crop as
  `native-surface-browser-frame-validation-unsupported` with blocker family
  `browser-frame-validation-capture-unsupported`, rather than treating it as a
  failed native render. The performance benchmark now defaults native consumer
  child probes to the compositor-stable `320x240` validation viewport and
  exposes both benchmark and probe viewport fields; the tiny native benchmark
  is `probeStatus=good`, visible consumer ready, same-device import
  `same-device-main-thread-import-ready`, pixel validation `passed`, blocker
  family `null`, and zero readback bytes. The same route also passes a 10k-ish
  native benchmark with actual particles `9826`, `probeStatus=good`, same-device
  import ready, pixel validation passed, blocker family `null`, and zero
  readback bytes. A mobile-shaped local benchmark with viewport `390x844`,
  device scale factor `2`, and touch enabled also reaches `probeStatus=good`
  with same-device import ready, pixel validation passed, blocker family
  `null`, and zero readback bytes.
- Active-grid plan-only summary work now has an explicit refresh cadence.
  `runMlsMpmResidentStepWithOptionalWebGpu()` records whether a plan-only
  active-grid summary was eligible, requested, deferred, or skipped, and
  `runMlsMpmResidentStepsWithOptionalWebGpu()` accepts
  `activeGridDispatchPlanRefreshMode`. The scene and probe default no-full /
  no-summary resident runs to `final-only`, so intermediate thermal/reaction
  batches can continue from conservative resident bounds without regenerating
  the active-grid dispatch sidecar every substep. Focused coverage proves
  thermal-blocked fused sequences defer intermediate plan-only summaries and
  refresh the plan on the final step. Fresh 10k-ish three-batch native evidence
  is `status=good`, `probeStatus=good`, zero browser console issues, zero
  estimated readback bytes, active grid used, actual particles `9826`,
  `activeGridDispatchPlanRefreshMode=final-only`,
  `activeGridDispatchPlanOnlyRequested=true` on the final sampled step,
  resident completed stage `9.9 ms`, thermal `0.3 ms`, mechanics refresh
  `0.5 ms`, compact plan-only summary `3.2 ms`, native extraction `2.7 ms`,
  translation `1.6 ms`, bridge reused, and visible native GPU consumer ready.
  This is a cadence cleanup inside the current architecture; full
  thermal-aware fused multi-step sequencing remains the larger target.
- Mechanics-refresh material phase rows now have a resident WebGPU upload
  cache. `runMlsMpmMechanicsRefreshWebGpu()` can borrow
  `mechanicsMaterialPhaseUpload`, the scene maintains a signature-keyed
  `mlsMpmMechanicsMaterialPhaseUpload` beside the thermal response graph
  upload, and the probe/benchmark harness reports upload status, phase record
  count, and byte length. Focused coverage proves the kernel does not issue a
  per-step `queue.writeBuffer()` for
  `ulg-mls-mpm-mechanics-material-phase-records` when the upload is borrowed.
  Fresh 10k-ish three-batch native evidence is `status=good`,
  `probeStatus=good`, zero browser console issues, zero readback bytes,
  `mechanicsMaterialPhaseUploadStatus=webgpu-uploaded`,
  `phaseRecordCount=8`, `recordsByteLength=384`, actual particles `9826`,
  mean batch `103.13 ms`, resident completed stage `2.8 ms`, thermal
  `0.2 ms`, mechanics refresh `0.3 ms`, active grid used, visible native GPU
  consumer ready, and render bridge reused. This is a safe current-architecture
  cleanup; the larger remaining target is still thermal-aware fused
  sequencing/cadence.
- Native WebGPU surface validation now has a cadence gate before validation
  command-encoder creation. The render loop inspects readback-smoke and
  offscreen validation pending/pass/retry-exhausted state and only starts GPU
  validation work while one of those stages can still make progress. The probe
  and benchmark harness now flatten cadence diagnostics. Fresh 10k-ish
  three-batch native evidence is `status=good`, `probeStatus=good`, zero
  browser console issues, zero readback bytes, visible native GPU consumer
  ready, `surfaceDrawRenderBridgeReused=true`,
  `surfaceDrawRenderBridgeNativeSurfaceValidationCadenceStatus=native-webgpu-surface-validation-pending`,
  `surfaceDrawRenderBridgeNativeSurfaceValidationEncoderRequired=false`,
  readback/offscreen needed `false`, actual particles `9826`, mean batch
  `105.07 ms`, resident completed stage `6.8 ms`, surface total `8.0 ms`,
  extraction `5.0 ms`, translation `1.5 ms`, and bridge refresh `3.0 ms`.
  This removes another repeated validation-work loop while preserving the
  same-device visible-consumer validation gate; remaining throughput work is
  still resident sequencing/cadence and native extraction variability.
- Native WebGPU validation cadence now carries explicit validation scope.
  Debug clear-only is `native-current-texture-debug-clear`: it can run the
  standalone same-device readback smoke path, but it reports offscreen surface
  geometry validation as ineligible until real retained surface draws are
  submitted. Surface-draw/render-state diagnostics now expose validation scope,
  offscreen eligibility, and offscreen skip reason, and the long-horizon probe
  plus performance benchmark now flatten those fields into native artifacts.
  This prevents current-texture smoke evidence from being mistaken for a
  promoted visible surface consumer.
- Native WebGPU surface presentation now reuses compatible main-canvas render
  bridges instead of rebuilding static shader modules, layouts, render
  pipelines, sampler, camera buffer, and optical lookup buffers on every
  resident surface refresh. Reuse is gated on the same resident GPU device,
  canvas context, canvas format, native renderer mode, and optical GPU table;
  dynamic compacted vertex and indirect draw buffers still get a fresh bind
  group. The benchmark harness now flattens bridge reuse/update telemetry.
  Fresh 10k-ish three-batch native evidence is `status=good`,
  `probeStatus=good`, zero browser console issues, zero render-row readback,
  visible native GPU consumer ready, `surfaceDrawRenderBridgeReused=true`,
  update count `1`, actual particles `9826`, mean batch `96.17 ms`, resident
  completed stage `3.0 ms`, extraction `4.6 ms`, translation `1.6 ms`, and
  bridge refresh `3.2 ms`. This closes repeated static render-bridge setup as
  a likely churn source; the next higher-leverage work remains resident
  cadence/thermal-aware fused sequencing plus native extraction variability.
- Retained thermal and mechanics-refresh output buffers now skip CPU-side
  zero uploads in the resident no-full GUI path. The thermal shader owns every
  output state/thermo row write and reports
  `outputBufferInitializationMode=shader-writes-all-particle-rows`; the
  mechanics-refresh shader copies every source mechanics row before phase
  edits and reports `shader-copies-source-mechanics-rows`. Focused tests
  assert no `queue.writeBuffer()` to `ulg-sph-thermal-output-state`,
  `ulg-sph-thermal-output-thermo`, or
  `ulg-mls-mpm-mechanics-refresh-output-mechanics`. Fresh 10k-ish native
  benchmark evidence is `status=good`, `probeStatus=good`, zero browser
  console issues, zero render-row readback, active grid used, actual particles
  `9826`, mean batch `77.5 ms`, resident completed stage `6.7 ms`, fused
  mechanics `0.8 ms`, thermal `0.3 ms`, mechanics refresh `3.5 ms`, native
  surface total `4.2 ms`, translation `1.4 ms`, and visible native GPU
  consumer ready. The next performance step should be thermal-aware fused
  sequence/cadence work and render-bridge reuse, not more output buffer clear
  shaving.
- Extension-to-ULG native surface translation now uses cached compute pipeline
  creation and skips the full upper-bound compact vertex-row clear in
  no-full-readback indirect draw mode. Focused adapter coverage asserts
  same-device pipeline cache reuse and no vertex clear upload on the resident
  path, while full-readback diagnostics still clear the buffer before CPU row
  validation. Fresh 10k-ish native benchmark evidence is `status=good`,
  `probeStatus=good`, zero browser console issues, pipeline cache hit, skipped
  no-full vertex clear, mean batch `129.55 ms`, resident stage `8.9 ms`,
  extraction `1.7 ms`, translation `2.0 ms`, bridge build `0.9 ms`, and
  surface refresh `3.4 ms`. This closes the first translation hotspot; the
  remaining performance roadmap should prioritize resident mechanics/batch
  cadence and any repeated native render-bridge setup over CPU readback work.
- Native no-full surface extraction no longer spends the benchmark frame in
  adapter setup or render-field row allocation. ULG now caches the sibling
  marching-cubes adapter/volume wrapper by the retained render-field descriptor
  and borrows a persistent render-field rows GPU buffer for the native visible
  consumer bridge. The latest 10k-ish native benchmark is `status=good` and
  `probeStatus=good` with zero browser console issues, zero readback bytes,
  cache hit, pool reused, visible native consumer ready, actual particles
  `9826`, mean batch `139.8 ms`, resident stage `12.1 ms`, surface total
  `24.1 ms`, extraction `1.4 ms`, extension execution `1.4 ms`, translation
  `21.5 ms`, and surface refresh `22.7 ms`. The active hot path has shifted
  from native extraction to extension-to-ULG draw-buffer translation and bridge
  refresh, so the next simulator/rendering slice should push that translation
  onto retained GPU draw state instead of reopening CPU readback or adapter
  lifetime work.
- Native marching-cubes extraction now has a conservative no-readback mode in
  the sibling extension and ULG consumes its retained GPU vertex counter when
  translating compact MC vertices into ULG surface rows. The extension can fill
  dense voxel IDs on GPU, compute conservative upper-bound vertex buffers, copy
  the actual vertex count into retained GPU counter/indirect buffers, and skip
  `mapAsync`/`queue.onSubmittedWorkDone()` in the GUI path. ULG forwards the
  `gpu-conservative-no-readback` request, binds the retained counter as a
  read-only storage buffer in the translation shader, and writes draw metadata
  from that actual GPU-side count. Current native renderer probe evidence is
  console-clean with the bridge submitting, but visible canvas pixels are still
  not proven. The next simulator/rendering slice is therefore main-canvas
  native WebGPU visibility/presentation and mobile validation, not another
  CPU counter-readback workaround.
- Native/extension surface draw metadata now keeps the compact extension's
  single retained indirect row distinct from ULG material `surfaceIndex`.
  Extension-translated surfaces publish `indirectRowIndex=0` /
  `indirectOffsetBytes=0`, and the resident native draw order honors those
  explicit offsets instead of deriving draw-indirect offsets from the original
  surface index. This fixes the case where an extension surface with
  `surfaceIndex > 0` could render with an out-of-range indirect offset into a
  one-row indirect buffer. Current headless evidence at
  `/tmp/ulg-native-indirect-offset-probe-wait.json` is console-clean with the
  main-canvas native bridge rendered and input-ready retained surface buffers;
  it remains fail-closed only because the existing same-device native
  readback/offscreen validation path reports
  `native-surface-validation-readback-lifetime`.
- Native surface rendering now also has a diagnostic same-device offscreen
  validation path. It draws the retained compact vertex and indirect buffers
  into a 64x64 WebGPU texture and publishes offscreen validation telemetry
  without adding an overlay or changing the visible-consumer gate. Current
  headless evidence at `/tmp/ulg-native-offscreen-validation-lifetime-probe.json`
  remains `bad`: browser console is clean and the bridge renders, but direct
  canvas frames are transparent black and offscreen validation is `not-run`
  because the scene readback still hits `A valid external Instance reference no
  longer exists`. Treat this as a renderer/device-lifetime and native
  presentation blocker, not a reason to revive CPU mesh fallback.
- Resident MLS-MPM render-every continuation now avoids the native surface draw
  / compute queue collision by tracking resident compute work, skipping draw
  submits while resident GPU work is in flight, and deferring native
  marching-cubes extraction until the final resident batch. Current browser
  evidence at
  `/tmp/ulg-browser-native-mlsmpm-render-every-2x1-extension-no-explicit-fences.json`
  is timeline-complete with zero browser console issues. This keeps the
  engine-owned `native-webgpu-surface-consumer` route alive without an overlay.
- The sibling `webgpu-marching-cubes` adapter has had the immediate integration
  blockers pushed back: shader `getCompilationInfo()` external-instance
  failures are nonfatal by default, small `mappedAtCreation` uploads are
  replaced with `queue.writeBuffer()`, and explicit `queue.onSubmittedWorkDone()`
  fences were removed from marching-cubes/exclusive-scan readback helpers. ULG
  now forwards native extension error name/status/stage/stack into resident
  render diagnostics.
- This older extraction blocker is now superseded by the conservative
  no-readback extension contract above. Keep the CPU-readable counter path only
  for diagnostics/parity; it is not the GUI hot-loop acceptance path.

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
  surface/draw buffers and a renderer-capability contract. The no-summary
  render-field path now calls the sibling `webgpu-marching-cubes`
  buffer-volume extractor and translates grid-local MC compact positions into
  ULG world-meter rows before retaining resident vertex, draw, indirect, and
  compacted vertex buffers. Current mounted scenes still need a same-device
  engine-owned WebGPU consumer for those buffers. The next no-readback visible
  surface milestone is therefore an engine-owned Three/WebGPU renderer path
  plus a storage-buffer geometry bridge and pixel evidence, not another canvas
  overlay or extraction fallback.
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
- 2026-06-19 reset/render-row lifecycle update: scene reset and
  `setParticles()` now advance a resident execution generation so in-flight
  MLS-MPM resident promises cannot publish stale buffers after reset. The Three
  render-row bridge also keeps its engine-owned submitted status when the
  generic surface draw loop later skips because GPU work is in flight or a
  retained WebGPU draw state is intentionally unavailable. Skip diagnostics stay
  separate, which keeps the browser reset harness console-clean while avoiding
  another overlay or full-readback renderer path.
- 2026-06-29 worker-owned presentation cadence update: ready worker-owned
  resident producer presentation now defaults post-step material/pressure
  interface refresh to `pipelined` instead of blocking the next resident batch.
  Live HTTPS probe evidence moved the mounted H2O/H2O worker-owned sphere path
  from slideshow cadence to roughly 31-36 resident/physics FPS after startup.
  The remaining bottleneck is not MLS-MPM compute; it is material-interface
  extraction, which still takes around 13-15 s because it seeds its surface
  table through render-row/full-readback work. Next slice should build a
  GPU-resident particle/material interface extraction path so pressure coupling
  freshness is not gated by a CPU/readback surface-table seed.
- 2026-06-30 interactive cadence update: interactive worker/presentation and
  same-device render-ownership use cases now default post-step material/pressure
  interface refresh to `pipelined`, while strict main-thread/default playback
  remains `blocking` and explicit PeerCompute/URL overrides still win. This is
  a scheduler/backpressure fix for the slideshow symptom after source-field
  budget tuning; it does not remove the durable need for a sparse/source-local
  material-interface source-field builder.
- 2026-06-30 worker-owned benchmark gate update: the long-horizon probe and
  `sph-performance-benchmark` now accept the worker-owned resident
  particle-state producer as visible output when it proves transferred-canvas
  presentation, frame-copy-back rejection, WebGPU worker readiness, positive
  particle count, and positive ready-frame count. The same 1024-particle
  worker-offscreen sphere smoke now reports `scenarioStatus=good`,
  `probeIssues=[]`, `residentStageMs=7.4`, `residentStageStepsPerSecond=135.1`,
  and `estimatedReadbackBytesPerStep=0`.
- 2026-06-30 same-device ownership default: `renderUseCase=same-device`,
  `same-device-mobile`, or `mobile` now implies the worker-owned resident
  producer target when no explicit ownership mode is supplied. Pending targets
  use the existing transitional render-row path; ready targets use
  `worker-owned-resident-render-producer`; explicit main-thread/other modes
  still override the use-case default.
- 2026-06-30 material-interface source-field pool: the pressure
  material-interface refresh now writes source-field rows into a dedicated
  pooled WebGPU buffer and submits the no-full source-field pass without an
  intermediate CPU queue fence before candidate extraction. Live diagnostics
  show pool create/reuse and
  `queue-submitted-gpu-handoff-no-cpu-fence`; smoke benchmark remains `good`
  with zero estimated readback bytes per step. This is an allocation/fence
  cleanup, not the sparse/source-local builder; the shader still scales with
  coarse field cells times particles.
- 2026-06-30 worker-owned cold-start presentation: interactive worker-owned
  particle-state presentation now skips the legacy visual render-row
  extraction and main-thread optical lookup path, because the transferred
  worker canvas is the visible renderer. PeerCompute/runtime policy exposes
  `residentInterfaceRefreshWarmupFrames` so same-device interactive playback
  can show initial frames before launching the pipelined material/pressure
  interface refresh. Live HTTPS evidence on the H2O/H2O worker-owned sphere
  path shows early `renderRefreshTotalMs` around `8-9 ms`,
  `renderRowsMs=0`, `opticalLookupMs=0`, no render-row readback, and worker
  frames advancing immediately.
- 2026-06-30 source-local material-interface source field: resident
  material-interface refresh now uses
  `peercompute.ulg.sph-material-interface-source-local-field.v0`, a
  particle/product-event-local atomic density splat plus resolve pass that
  feeds the existing compact candidate extractor. Live HTTPS H2O/H2O
  worker-owned sphere evidence reports `webgpu-source-local`,
  `384000` estimated local cell visits versus `6749184` old dense
  cell-particle pairs, no render-row/render-field readback, and about
  `204 ms` warm source-interface refresh.
- 2026-06-30 worker-owned particle-state source-cache diagnostics: the
  worker-owned sphere path now uses a typed particle-state source-cache
  descriptor. CPU-visible states use a `step-time` key instead of hashing every
  state/thermo float; stale or unversioned states retain the content-hash
  fallback. Benchmark artifacts now expose source-cache strategy, stale-state
  flag, and miss reason. The first smoke after this change is still `good` and
  reports `sourceCacheMissReason=source-cache-empty`, which means the remaining
  80 KiB-class particle-state transfer is a bridge lifecycle/cadence or
  same-worker ownership problem, not an opaque key-hash mismatch.
- 2026-06-30 presentation-worker retained output transport proof: the explicit
  `renderOwnership=presentation-worker-retained-output-presentation-only` plus
  `presentationWorkerResidentStages=1` smoke is `good` and renders from
  `worker-retained-resident-stage-output` with `sourceStateTransferBytes=0`,
  `inputTransferBytes=96`, retained G2P output preserved, legacy draw skipped,
  and `requiresFreshPhysicsReadback=false`. This is the strongest current
  evidence that the performance path should prefer same-worker retained
  mechanics output/presentation for interactive same-device uses; cross-peer
  replay still requires the separate portable snapshot/materialization plan.
- 2026-06-30 same-device retained presentation policy: the render ownership
  resolver now maps unforced `renderUseCase=same-device`,
  `same-device-mobile`, `same-device-interactive`, `interactive-same-device`,
  and `mobile` to
  `presentation-worker-retained-output-presentation-only`. Explicit
  `renderOwnership=worker-owned-resident-render-producer` remains available
  for the particle-state producer path, and throughput use cases still default
  to ComputeManager task submission. The benchmark harness now accepts
  `ULG_BENCH_RENDER_USE_CASE`; live HTTPS evidence with only
  `renderUseCase=same-device` reports retained presentation ready, source state
  transfer `0`, input transfer `96` bytes, skipped legacy draw, direct resident
  compute mode, and estimated readback bytes per step `0`.

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
   Current slice: the explicit `ocean-tiled-experimental` option exists and
   falls back to `resident-scatter` with contract telemetry until the tiled
   kernel lands.
3. Add CPU parity tests for the new backend on small cases.
   Current slice: policy and no-full fake-device tests prove the replacement
   backend is not falsely advertised. Real tiled-kernel parity remains open.
4. Add a benchmark comparing resident scatter vs tiled/local-accumulator P2G.
5. Keep the current resident pipeline as fallback until the new backend passes
   parity and performance gates.
