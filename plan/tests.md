# ULG Test Plan

## Current Focused Result - 2026-06-29 Retained Stage Output Render

The presentation-worker mechanics stage chain now feeds worker-local
presentation directly. After G2P completes on the offscreen presentation
worker, the worker resolves its own retained G2P state buffer and retained
thermo buffer, binds them in the resident particle-state producer, and renders
without a main-thread state transfer.

Focused checks:

- Syntax:
  `node --check src/services/ulgOffscreenRender.worker.js`
  `node --check src/services/ulgMechanicsResidentStage.worker.js`
  `node --check src/visualization/sphPhaseScene.js`
  `node --check scripts/sph-performance-benchmark.mjs`
  `node --check tests/nativeSurfaceHarness.test.mjs`
  - Passed.
- Focused worker/render ownership suite:
  `node --test tests/ulgMechanicsResidentStageWorker.test.mjs tests/nativeSurfaceHarness.test.mjs tests/offscreenPresentationBridge.test.mjs tests/peercomputeRenderOwnershipPolicy.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed: `110/110`.
- HTTPS retained-output probe:
  `/tmp/ulg-retained-stage-output-render-probe-2.json`
  - Retained render status persisted across both metrics with
    `workerOffscreenRenderRowsProducerSourceKind=worker-retained-resident-stage-output`,
    `workerOffscreenRenderRowsProducerSourceTransport=worker-retained-resident-stage-output`,
    `workerOffscreenRenderRowsSourceStageId=g2p`,
    `workerOffscreenRenderRowsRetainedParticleStateStatus=worker-retained-particle-state-ready`,
    `workerOffscreenRenderRowsSourceStateTransferBytes=0`,
    `workerOffscreenRenderRowsSourceTransferBytes=0`, and
    `workerOffscreenResidentStageChainAutoSameWorkerGpuHandoff=true`.
  - Browser console/page errors: `0`.
  - Overall analysis stayed `bad` only because this run disabled motion
    evidence and therefore reported `missing-max-speed` and
    `no-positive-displacement`.
- HTTPS benchmark:
  `/tmp/ulg-retained-stage-output-render-bench.json`
  - Suite status `complete`, gate `pass`, scenario `good`, probe `good`,
    issues `[]`.
  - Render rows: `worker-offscreen-resident-particle-state-producer-rendered`,
    retained stage-output source/transport, `sourceStageId=g2p`, retained
    particle state ready, `sourceStateTransferBytes=0`,
    `sourceTransferBytes=0`, `inputTransferBytes=96`, copied display bytes
    `0`, and frame-copy-back rejected.

## Current Focused Result - 2026-06-29 Presentation-Worker Mechanics Stages

The worker-owned presentation worker can now run mechanics resident stages on
its own WebGPU device. The bridge exposes
`runResidentStageOnPresentationDevice`, the scene exposes
`runWorkerOffscreenResidentStageOnPresentationDevice`, and telemetry is
published as `peercompute.ulg.presentation-worker-resident-stage.v0`.
The policy-selected auto scheduler now publishes
`peercompute.ulg.presentation-worker-mechanics-stage-chain-auto.v0` and keeps
the run explicitly non-authoritative until worker-local render/state promotion
is implemented.

Focused checks:

- Syntax:
  `node --check src/services/ulgMechanicsResidentStage.worker.js`
  `node --check src/services/ulgOffscreenRender.worker.js`
  `node --check src/visualization/sphPhaseScene.js`
  `node --check scripts/sph-performance-benchmark.mjs`
  `node --check tests/nativeSurfaceHarness.test.mjs`
  - Passed.
- Focused worker/render ownership suite:
  `node --test tests/ulgMechanicsResidentStageWorker.test.mjs tests/nativeSurfaceHarness.test.mjs tests/offscreenPresentationBridge.test.mjs tests/peercomputeRenderOwnershipPolicy.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed: `109/109`.
- Focused auto-chain recheck:
  `node --test tests/ulgMechanicsResidentStageWorker.test.mjs tests/offscreenPresentationBridge.test.mjs tests/peercomputeRenderOwnershipPolicy.test.mjs tests/nativeSurfaceHarness.test.mjs`
  - Passed: `31/31`.
- Browser stage proof against `https://127.0.0.1:5173` with
  `renderOwnership=worker-owned-resident-render-producer`,
  `workerOffscreenPresentation=1`, and `residentAuto=0`:
  - Single P2G completed with `summaryBackend=webgpu`,
    `workerWebGpuStatus=webgpu-executed-no-full-readback`, retained refs, and
    `gpuFenceSatisfied=true`.
  - Same-lane `P2G -> gridUpdate -> G2P` completed in the presentation worker;
    all three stages reported WebGPU/no-full-readback, retained refs, and
    `queueCompletionStatus=queue-submitted-same-worker-gpu-handoff-no-cpu-fence`.
- Policy-driven browser proof with `presentationWorkerResidentStages=1`:
  `runWorkerOffscreenMechanicsStageChainOnPresentationDevice()` built the stage
  payloads from current scene resident state and returned
  `worker-offscreen-mechanics-stage-chain-completed`, three completed WebGPU
  no-full stages, `gpuFenceSatisfied=true`, and
  `sameWorkerGpuHandoff=true`.
- Policy-enabled benchmark:
  `ULG_BENCH_PRESENTATION_WORKER_RESIDENT_STAGES=1` with
  `ULG_BENCH_RENDER_OWNERSHIP=worker-owned-resident-render-producer` completed
  as suite `status=complete`, scenario `status=good`, policy requested/ready
  `true`, worker presentation ready, render-row readback byte length `0`, and
  copied display bytes `0`.
- Automatic policy path:
  - HTTPS probe artifact
    `/tmp/ulg-auto-presentation-worker-chain-probe.json` completed with
    result `status=good`, issues `[]`,
    `workerOffscreenResidentStageChainAutoStatus=presentation-worker-mechanics-stage-chain-auto-completed`,
    chain status `worker-offscreen-mechanics-stage-chain-completed`,
    `sameWorkerGpuHandoff=true`, and
    `statePromotionStatus=not-promoted-worker-local-output-awaiting-state-manager-admission`.
  - Follow-up benchmark artifact
    `/tmp/ulg-retained-promotion-candidate-bench.json` also asserts
    `workerOffscreenRetainedStatePromotionCandidateStatus=presentation-worker-retained-state-promotion-candidate-ready`,
    `workerOffscreenRetainedStatePromotionCandidateAdmissionStatus=pending-state-manager-admission`,
    `workerOffscreenRetainedStatePromotionCandidateStatePromotionStatus=pending-state-manager-admission-worker-local-retained-refs`,
    `workerOffscreenRetainedStatePromotionCandidateAuthoritativeStateMutation=false`,
    and zero source/state transfer bytes.
  - Presentation-only policy benchmark artifact
    `/tmp/ulg-presentation-only-policy-bench-2.json` completed as scenario/probe
    `good` with
    `peerComputeRenderOwnershipPolicyStatus=render-ownership-presentation-worker-retained-output-presentation-only-ready`,
    requested mode `presentation-worker-retained-output-presentation-only`,
    effective mode `worker-owned-resident-render-producer`,
    `peerComputeRenderOwnershipPresentationWorkerResidentStagesRequested=true`,
    `peerComputeRenderOwnershipPresentationWorkerResidentStagesReady=true`,
    `peerComputeRenderOwnershipStatePromotionMode=presentation-only`, and
    `peerComputeRenderOwnershipAuthoritativeStateMutationExpected=false`.
  - Retained-ref admission benchmark artifact
    `/tmp/ulg-presentation-retained-admission-bench.json` completed as
    scenario/probe `good`, issues `[]`, auto-chain completed, candidate ready,
    `workerOffscreenRetainedStatePromotionAdmissionStatus=presentation-worker-retained-state-promotion-admission-published`,
    accepted/committed `true`, scope
    `ulg-presentation-worker-retained-state-promotion-admissions`,
    state promotion status `admitted-worker-private-retained-ref-descriptor`,
    continuation required `true`, portable state `false`, and authoritative
    mutation `false`.
  - PeerCompute StateManager integration now asserts
    `admitPresentationWorkerRetainedStatePromotionCandidate()` writes the
    retained-state promotion admission warm delta, stores a worker-retained
    hot-buffer key, rejects unsatisfied fence evidence, and produces a
    same-worker continuation plan from the admitted hot-buffer key.
  - Benchmark artifact
    `/tmp/ulg-auto-presentation-worker-chain-bench.json` completed with suite
    `status=complete`, scenario/probe `good`, auto-chain completed,
    same-worker handoff `true`, copied display bytes `0`, and browser console
    issue count `0`.

Residual risk:

- Chromium rejects CPU-visible queue fences on this worker-owned presentation
  device with `OperationError: A valid external Instance reference no longer
  exists`, and a 4-byte sentinel `mapAsync` fallback also fails in the same
  environment. For same-worker GPU-to-GPU stage handoff, the accepted fence is
  explicit same-queue WebGPU ordering. Cross-thread or CPU-admission paths must
  still require a real CPU-visible queue fence.
- The presentation-worker stage chain is now policy-selected automatically, but
  it is still evidence-only. It does not yet promote worker-local stage output
  into the authoritative visible/render state.

## Current Focused Result - 2026-06-28 Worker Particle-State Producer

The worker-owned resident producer now consumes packed resident SPH particle
state/thermo plus a compact material/phase color table instead of decoded
visual render rows. The readback planner preserves `no-full-readback` for this
particle-state path while still forcing full readback for the older
transitional decoded-row worker bridge.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`
  `node --check src/services/ulgOffscreenRender.worker.js`
  `node --check src/visualization/offscreenPresentationBridge.js`
  `node --check scripts/sph-performance-benchmark.mjs`
  `node --check tests/offscreenPresentationBridge.test.mjs`
  `node --check tests/sphPhaseRenderer.test.mjs`
  `node --check tests/nativeSurfaceHarness.test.mjs`
  - Passed.
- Focused worker/render ownership suite:
  `node --test tests/sphPhaseRenderer.test.mjs tests/offscreenPresentationBridge.test.mjs tests/nativeSurfaceHarness.test.mjs tests/peercomputeRenderOwnershipPolicy.test.mjs`
  - Passed: `100/100`.
- HTTPS benchmark:
  `ULG_BENCH_RENDER_OWNERSHIP=worker-owned-resident-render-producer
  ULG_BENCH_WORKER_OFFSCREEN_PRESENTATION=1 ULG_BENCH_SURFACE_DRAW_MODE=auto`
  against `https://127.0.0.1:5173` passed with
  `worker-offscreen-resident-particle-state-producer-rendered`,
  `producerSourceKind=worker-resident-particle-state`,
  `sourceRowsPacked=false`, decoded visual source transfer `0`, state source
  transfer `1312` bytes, input transfer `1376` bytes,
  `renderRowsReadbackByteLength=0`, readback mode `no-full-readback`, no
  readback coercion,
  `renderRowsReadbackWorkerOwnedResidentParticleStateProducerReadbackFree=true`,
  copied display bytes `0`, and retained GPUBuffer handoff `not-requested`.

Residual risk:

- The first source upload still copies packed state/thermo from the main-thread
  resident state into the worker. Eliminating that copy requires an ownership
  boundary change: move resident simulation/render production into the
  worker-owned device path, or establish a validated same-device GPU object
  transport.

## Current Focused Result - 2026-06-28 PeerCompute Render Ownership

Render ownership is now a PeerCompute-compatible policy instead of a single
demo flag. `peercompute.ulg.render-ownership-policy.v0` can select the
main-thread renderer, the transitional worker-offscreen render-row bridge, the
target worker-owned resident render producer, or the direct cross-worker
GPUBuffer handoff experiment. The worker-owned resident producer mode now runs
a worker-local WebGPU producer pass before drawing. Repeated unchanged-source
draws reuse a worker-resident source cache, and the mode does not request the
blocked direct GPUBuffer handoff.

Focused checks:

- Syntax:
  `node --check` passed for `src/runtime/peercomputeRenderOwnershipPolicy.js`,
  `src/runtime/peercomputeBrowserResidentHost.js`,
  `src/visualization/offscreenPresentationBridge.js`,
  `src/visualization/sphPhaseScene.js`,
  `src/visualization/sphPhaseDemoMount.js`,
  `scripts/sph-performance-benchmark.mjs`,
  `scripts/sph-long-horizon-probe.mjs`, and
  `tests/peercomputeRenderOwnershipPolicy.test.mjs`.
- Policy/offscreen/render adjacency:
  `node --test tests/peercomputeRenderOwnershipPolicy.test.mjs
  tests/offscreenPresentationBridge.test.mjs tests/nativeSurfaceHarness.test.mjs
  tests/sphPhaseRenderer.test.mjs --test-name-pattern "render ownership|worker
  offscreen|render-row particle modes|surface buffer handoff"` passed `97/97`.
- PeerCompute host summary regression:
  focused `tests/peercomputeComputeManagerIntegration.test.mjs` run passed
  `18/18` in this checkout.
- Source-cache focused checks:
  `node --test tests/offscreenPresentationBridge.test.mjs
  tests/nativeSurfaceHarness.test.mjs tests/peercomputeRenderOwnershipPolicy.test.mjs`
  passed `20/20`.
- Browser benchmark:
  `ULG_BENCH_RENDER_OWNERSHIP=worker-owned-resident-render-producer
  ULG_BENCH_WORKER_OFFSCREEN_PRESENTATION=1
  ULG_BENCH_SURFACE_DRAW_MODE=auto` against
  `https://127.0.0.1:5173` reported requested/effective mode
  `worker-owned-resident-render-producer`, input
  `worker-owned-resident-render-producer`,
  `worker-offscreen-resident-render-producer-rendered`,
  `workerLocalRenderRowsProduced=true`, first source upload `512` bytes,
  direct retained GPUBuffer handoff `not-requested`, copied display bytes `0`,
  and scenario `good`.
- Targeted browser cache smoke:
  HTTPS Playwright against `renderOwnership=worker-owned-resident-render-producer`
  ran one resident MLS-MPM step, rendered the same execution twice, and reported
  first draw `source-cache-uploaded`/`sourceTransferBytes=512`, second draw
  `source-cache-reused`, `sourceCacheHit=true`, `sourceRowsPacked=false`,
  `sourceTransferBytes=0`, and `inputTransferBytes=64`.

Residual risk:

- Superseded by the worker particle-state producer checkpoint above. The
  remaining risk is no longer decoded visual-row source upload; it is the
  ownership boundary needed to avoid the first packed state/thermo upload.

## Current Focused Result - 2026-06-28 Worker Render Rows

The worker-owned presentation canvas now has a transitional render-row draw
path. When decoded render rows are available, the scene posts compact particle
rows to the transferred `OffscreenCanvas` worker. The worker writes them to a
WebGPU storage buffer and draws instanced quads directly to the presented
canvas. This preserves the zero-display-copy rule: the benchmark reports
compact input-transfer bytes separately from copied frame bytes, and copied
display bytes stay at `0`.

Focused checks:

- Syntax:
  `node --check` passed for the bridge, worker, scene, long-horizon probe, and
  performance benchmark files touched by this slice.
- Unit/source harness:
  `node --test tests/offscreenPresentationBridge.test.mjs
  tests/nativeSurfaceHarness.test.mjs` passed `12/12`.
- Renderer/render-row adjacency:
  `node --test tests/sphPhaseRenderer.test.mjs` passed `77/77`, and
  `node --test tests/sphRenderGpuKernel.test.mjs` passed `55/55`.
- Demo adjacency:
  focused `tests/sphPhaseDemo.test.mjs` render/particle/background coverage
  passed `46/46`.
- Browser benchmark:
  `ULG_BENCH_WORKER_OFFSCREEN_PRESENTATION=1
  ULG_BENCH_SURFACE_DRAW_MODE=three-render-row-points` against
  `https://127.0.0.1:5173` reported
  `worker-offscreen-render-rows-rendered`, `particleCount=16`,
  compact input transfer `576` bytes, copied display bytes `0`,
  frame-copy-back rejected, zero browser console issues, and suite gate `pass`.
- Auto-mode browser benchmark:
  `ULG_BENCH_WORKER_OFFSCREEN_PRESENTATION=1
  ULG_BENCH_SURFACE_DRAW_MODE=auto` reported the transitional readback reason
  `worker-offscreen-render-rows-transitional-bridge-requires-fresh-physics-readback`,
  `renderRowsReadbackForcedForWorkerOffscreenPresentation=true`,
  `worker-offscreen-render-rows-rendered`, `particleCount=16`, compact input
  transfer `576` bytes, copied display bytes `0`, zero browser console issues,
  and suite gate `pass`.
- Retained GPUBuffer handoff boundary:
  local HTTPS Playwright microprobe showed direct `GPUBuffer` postMessage to a
  worker throws `DataCloneError: GPUBuffer object could not be cloned`. The
  benchmark now reports
  `worker-offscreen-retained-gpubuffer-handoff-blocked-structured-clone-unavailable`,
  retained render rows and retained surface buffers present, plan change
  required `true`, preferred replacement `worker-owned-resident-render-producer`,
  copied display bytes `0`, zero browser console issues, and suite gate `pass`.

Residual risk:

- This is not the final Ocean-style worker renderer. It still relies on
  main-thread decoded render rows and a compact typed-array transfer. The
  current direct retained-GPUBuffer handoff is blocked, so the next gate is a
  worker-owned resident render producer or another validated same-device
  browser path.

## Current Focused Result - 2026-06-28 Worker-Owned Offscreen Presentation

The repo now has an opt-in transferred-canvas worker presentation bridge. Enable
it with `workerOffscreenPresentation=1`. The scene creates a displayed canvas
layer, transfers it with `transferControlToOffscreen`, and the worker configures
WebGPU on that `OffscreenCanvas`. Telemetry uses
`peercompute.ulg.worker-offscreen-presentation.v0` and keeps copied display
bytes at zero while explicitly rejecting `frame-copy-back`.

Focused checks:

- Syntax:
  `node --check` passed for the bridge, worker, scene, mount, long-horizon
  probe, and performance benchmark files touched by this slice.
- Unit/source harness:
  `node --test tests/offscreenPresentationBridge.test.mjs
  tests/nativeSurfaceHarness.test.mjs` passed `11/11`.
- Renderer/demo adjacency:
  `node --test tests/sphPhaseRenderer.test.mjs` passed `77/77`, and focused
  `tests/sphPhaseDemo.test.mjs` render/particle/background coverage passed
  `46/46`.
- Browser smoke:
  `https://127.0.0.1:5173/?workerOffscreenPresentation=1&residentAuto=0`
  produced a transferred worker canvas with `readyEver=true`,
  `readyFrameCount=1`, `contextStatus=webgpu-context-ready`,
  `copiedBytesPerFrame=0`, and `frameCopyBackRejected=true`.
- Benchmark flag:
  `ULG_BENCH_WORKER_OFFSCREEN_PRESENTATION=1` now adds
  `workerOffscreenPresentation=1` to generated scenario URLs and records
  `workerOffscreenPresentationRequested` in the page-level report.
  Tiny smoke output `/tmp/ulg-worker-offscreen-presentation-bench.json`
  reported `status=complete`, suite gate `pass`, scenario/probe `good`, zero
  browser console issues, `worker-offscreen-presentation-ready`,
  `readyFrameCount=3`, copied bytes `0`, and frame-copy-back rejected.
- Diff hygiene:
  `git diff --check` passed.

Residual risk:

- The worker currently clears a transparent presentation canvas; it does not
  yet consume retained resident render buffers.
- Headless Chromium destroyed the worker WebGPU device after the first clear in
  the manual smoke run. A subsequent benchmark smoke kept the worker ready for
  three clears, but longer live-device validation is still needed before this
  is treated as the final renderer path.

## Current Focused Result - 2026-06-24 Worker Offscreen Frame Transport Budget

The performance benchmark now reports a stable worker-offscreen frame transport
budget. The preferred path is a worker-owned presented canvas
(`transferControlToOffscreen`) with zero copied display bytes. The rejected path
is a per-frame copy-back shuttle, such as worker readback or ImageBitmap frames
sent to the main thread; the benchmark estimates RGBA8 bytes per frame and
bytes per second from viewport size, device pixel ratio, and refresh rate.

Focused checks:

- Syntax:
  `node --check scripts/sph-performance-benchmark.mjs` passed.
- Native/source harness:
  `node --test tests/nativeSurfaceHarness.test.mjs` passed `8/8`, including the
  `peercompute.ulg.worker-offscreen-frame-transport-budget.v0` schema guard.
- Benchmark schema smoke:
  one-step direct-resident benchmark wrote
  `/tmp/ulg-worker-offscreen-transport-budget-bench.json`; desktop `1280x800`
  reports copy-back `3.91 MiB/frame` and `234.38 MiB/s` at `60 Hz`, while the
  worker-owned presented-canvas path reports `0` copied bytes.

Residual risk:

- This does not implement the worker renderer. It prevents the benchmark from
  treating frame-copy-back as equivalent to zero-copy worker presentation.

## Pending Gate - True Adaptive MLS-MPM

`plan/todo/adaptive-mlsmpm-support-radius-and-coarsening-plan.md` defines the
next clean-break adaptive MLS-MPM test target. Required future gates are:

- variable-support kernel partition-of-unity and first-moment tests;
- CPU P2G/G2P round-trip tests across support radii;
- WGSL/WebGPU parity tests for supported support tiers;
- split/merge conservation tests for mass, center of mass, linear momentum,
  represented affine momentum, volume, density, internal energy, and
  material/phase metadata;
- repeated split/merge drift tests for mass, momentum, and energy continuity;
- browser visual sequence checks proving coarsened/adaptive blocks move
  coherently without role-specific particle-size divergence.

## Current Focused Result - 2026-06-22 Fixed Global Particle Volume

The fixed-support MLS-MPM initializer now treats particle size as numerical
resolution, not a per-material radius policy. Requested drop/base edge counts
determine particle counts, a single global spacing determines mechanics rest
volume and visual radius, and material closure density at temperature/pressure
determines per-particle mass. Phase-change expansion does not spawn extra
solver particles in this path; gas volume stays represented by species
ledgers/fields until a later gas-admission or true adaptive split/merge policy
creates additional particles.

Focused checks:

- Syntax:
  `node --check src/runtime/sphPhaseDemo.js` and
  `node --check src/runtime/material/algorithmMaterialRows.js` passed.
- Demo initialization coverage:
  `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "initial
  particle spacing|same material|large requested drop edge|large
  non-H2O|matching material preserves|low requested drop edge|material state
  changes mass|crystal packing"` reported `46/46`.
- Physics atomics:
  `npm run test:physics-atomics` passed `11/14` with the three expected opt-in
  long-horizon skips.
- Render/buffer adjacent coverage:
  `node --test tests/sphRenderGpuKernel.test.mjs --test-name-pattern "visual
  particle radius|particle scale|radius|render rows"` passed `55/55`, and
  `node --test tests/sphGpuBuffers.test.mjs --test-name-pattern
  "visualParticleRadius|particle|mechanics|material bank"` passed `10/10`.
- Live HTTPS no-full browser probe:
  H2O/H2O at `https://127.0.0.1:5173` completed `status=good`, issues `[]`,
  nonblank frames `7/7`, and bounded `J=0.9996516704559326..1.0049999952316284`.
- Live HTTPS sphere browser probe:
  H2O/H2O sphere mode completed `status=good`, nonblank frames `5/5`,
  `surfaceDrawStatus=resident-render-row-spheres-built`,
  `sphereMaterialSource=closure-derived-pbr`, `sphereClosurePbr=true`, and zero
  console issues.

Residual risk:

- Visible water still appears as sphere particles rather than a merged
  transparent/refractive liquid surface. Keep that work in the renderer/surface
  quality track.
- True adaptive support/split/merge remains out of scope for this fixed-size
  simplification.

## Current Focused Result - 2026-06-20 GPU Contact Kinematics Particle Bins

The pressure-interface WebGPU producer now builds a bounded same-device
particle-bin grid before deriving interface contact kinematics. The
contact-kinematics shader scans neighboring bin cells around each interface
centroid and falls forward to the old full-particle scan only when the bin grid
is unavailable. Solver and stage evidence expose bin-grid
status/enabled/cell-count/capacity. Empty pressure-interface gas-cell storage
now uses a one-row 16-byte sentinel so browser WebGPU validation accepts the
`array<vec4<f32>>` binding even when row count is zero.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphPressureInterfaceGpuKernel.js`,
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`, and
  `node --check ulg-gpu-abi/src/wgsl.js` passed.
- Contact/pressure/stage coverage:
  `node --test tests/sphPressureInterfaceGpuKernel.test.mjs
  tests/sphMlsMpmGpuStep.test.mjs` passed `71/71`, including the 16-byte empty
  gas-cell sentinel guard plus adaptive bin-capacity/headroom diagnostics.
- ABI/grid/buffer coverage:
  `node --test tests/webgpuKernelAbi.test.mjs tests/abi.test.mjs
  tests/sphGridUpdateGpuKernel.test.mjs tests/sphGpuBuffers.test.mjs` passed
  `47/47`.
- Direct browser WebGPU smoke:
  imported the pressure-interface module through the live Vite server,
  requested a real WebGPU device, ran synthetic retained H2O/Na contact rows,
  reached `gpu-interface-element-neighbor-bin-contact-kinematics`, and captured
  no console logs.
- Whitespace:
  `git diff --check` passed.
- Build:
  `npm run build` passed with only the existing Vite large-chunk warning.
- Physics atomics:
  `npm run test:physics-atomics` passed `11/14` with the three expected
  opt-in long-horizon skips.
- ICC:
  `npm run icc:update` passed with `indexedFiles=354` and
  `memoryChunks=2085`.

Follow-up focused check:

- Adaptive bin diagnostics:
  `node --check src/runtime/sph/sphPressureInterfaceGpuKernel.js`,
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check tests/sphPressureInterfaceGpuKernel.test.mjs`,
  `node --check tests/sphMlsMpmGpuStep.test.mjs`, and
  `node --test tests/sphPressureInterfaceGpuKernel.test.mjs
  tests/sphMlsMpmGpuStep.test.mjs` passed `71/71`.
- Follow-up hygiene:
  `git diff --check` passed; `npm run build` passed with only the existing Vite
  large-chunk warning; `npm run icc:update` passed with `indexedFiles=354` and
  `memoryChunks=2086`.
- Overflow metadata readback:
  the same focused pressure/MLS-MPM suite passed `71/71` after adding the
  debug-only particle-bin overflow metadata readback path and flattened
  overflow status/count evidence.
- Browser resident summary:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173
  PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config
  tests/playwright.config.mjs --grep "SPH phase demo runs derived material
  properties by default"` passed `1/1` after surfacing contact-bin diagnostics
  through mounted `sphResidentRenderState` and the e2e summary.

## Previous Focused Result - 2026-06-20 GPU Interface Contact Kinematics and Console Gate

The pressure-interface WebGPU producer now derives missing per-interface
contact kinematics from resident SPH particle state/thermo buffers before the
force-row stage. The new kinematics pass writes the existing four-float
`gapM`/normal-velocity/mass/status ABI, then the force-row WGSL consumes that
buffer on the same device/queue. The pressure-stage ComputeManager wrapper
forwards retained particle uploads and exposes derivation diagnostics. The same
focused browser pass also fixed thermal/mechanics empty material-bank
warm-input bindings by allocating one full 64-byte sentinel row while keeping
shader row count zero.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphPressureInterfaceGpuKernel.js`,
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`, and
  `node --check ulg-gpu-abi/src/wgsl.js` passed.
- Contact/pressure/stage coverage:
  `node --test tests/sphPressureInterfaceGpuKernel.test.mjs
  tests/sphMlsMpmGpuStep.test.mjs` passed `71/71`.
- Thermal/mechanics sentinel coverage:
  `node --test tests/sphMechanicsRefreshGpuKernel.test.mjs
  tests/sphThermalGpuKernel.test.mjs tests/sphPressureInterfaceGpuKernel.test.mjs
  tests/sphMlsMpmGpuStep.test.mjs` passed `92/92`.
- ABI/grid/buffer coverage:
  `node --test tests/webgpuKernelAbi.test.mjs tests/abi.test.mjs
  tests/sphGridUpdateGpuKernel.test.mjs tests/sphGpuBuffers.test.mjs` passed
  `47/47`.
- Browser console gate:
  `ULG_PROBE_OUTPUT=/tmp/ulg-contact-kinematics-gpu-probe-rerun.json
  ULG_PROBE_PORT=5662 ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=1
  ULG_PROBE_READBACK_MODE=no-full-readback
  ULG_PROBE_RENDER_READBACK_MODE=no-full-readback
  ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback
  ULG_PROBE_FAIL_ON_BAD=0 node scripts/sph-long-horizon-probe.mjs` passed
  with `status=good`, no analysis issues, and zero browser-console issues.
- Whitespace:
  `git diff --check` passed.
- Build:
  `npm run build` passed with only the existing Vite large-chunk warning.
- Physics atomics:
  `npm run test:physics-atomics` passed `11/14` with the three expected
  opt-in long-horizon skips.
- ICC:
  `npm run icc:update` passed with `indexedFiles=354` and
  `memoryChunks=2079`.

## Current Focused Result - 2026-06-20 Algorithm Contact Pair Force Rows

`algorithmMaterialContactRows` now feed material-interface force-row production.
The pressure-interface WebGPU producer packs bounded contact policy rows and
binds them in WGSL; the CPU oracle and pressure-stage task path use the same
matching/capping logic. Grid update continues to consume the unchanged
16-float force-row ABI.

## Current Focused Result - 2026-06-20 Algorithm Row Runtime Consumers

Algorithm-derived rows now feed active runtime consumers. Surface extraction
rows select native marching-cubes isovalue/policy metadata, and contact rows
derive MLS-MPM wall-barrier elastic stiffness when no explicit wall stiffness
or modulus override is supplied.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphGridUpdateGpuKernel.js`,
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/runtime/sph/sphMarchingCubesSurfaceAdapter.js`, and
  `node --check src/visualization/sphPhaseScene.js` passed.
- Focused runtime coverage:
  `node --test tests/sphGridUpdateGpuKernel.test.mjs
  tests/sphMlsMpmGpuStep.test.mjs` passed `79/79`.
- Renderer/native adjacent coverage:
  `node --test tests/sphGpuBuffers.test.mjs tests/sphPhaseRenderer.test.mjs`
  passed `78/78`; `node --test tests/sphMarchingCubesSurfaceAdapter.test.mjs
  tests/nativeSurfaceHarness.test.mjs` passed `22/22`.
- Physics invariants:
  `npm run test:physics-atomics` passed `11/14` with the three expected
  opt-in long-horizon skips.

## Current Focused Result - 2026-06-19 Material Bank Generator First Tranche

The element JSON bank now has a bounded generator path and first generated
selectable tranche. Existing reviewed rows remain warm inputs rather than
strict truth, while generated `Be`, `B`, `C`, `N`, `F`, `Mg`, `Al`, `Si`, `P`,
`S`, `Cl`, `Ca`, `Sc`, `Ti`, `V`, `Cr`, `Mn`, `Co`, `Ni`, `Cu`, `Zn`, `Ga`,
`Ge`, `As`, `Se`, `Br`, `Sr`, `Y`, `Zr`, `Nb`, `Mo`, `Tc`, and `Ru` rows carry
`reduced-estimate` provenance and explicit `gridPointsN=80` closure metadata.
The same generated-prefix coverage now extends through `I`, including `Rh`,
`Ag`, `Cd`, `In`, `Sn`, `Sb`, `Te`, and `I`. The unit guard verifies the
selectable prefix through `Pr`, including the first lanthanide-band tranche
`Ba`, `La`, `Ce`, and `Pr`, plus the cache-backed continuation `Nd`, `Pm`,
`Sm`, `Eu`, `Gd`, `Tb`, `Dy`, `Ho`, `Er`, `Tm`, `Yb`, and `Lu`, rather than a hand-maintained
first-tranche-only list. The generated prefix now extends through `Au`,
including `Hf`, `Ta`, `W`, `Re`, `Os`, `Ir`, `Pt`, and `Au`.
It now extends through `Ra`, including `Hg`, `Tl`, `Pb`, `Bi`, `Po`, `At`,
`Fr`, and `Ra`.
It now extends through `Cm`, including `Ac`, `Th`, `Pa`, `U`, `Np`, `Pu`,
`Am`, and `Cm`.
It now extends through `Rf`, including `Bk`, `Cf`, `Es`, `Fm`, `Md`, `No`,
`Lr`, and `Rf`.
It now extends through `Ts`, including final superheavy rows `Db`, `Sg`, `Bh`,
`Hs`, `Mt`, `Ds`, `Rg`, `Cn`, `Nh`, `Fl`, `Mc`, `Lv`, and `Ts`; the current
selectable non-noble bank has no missing `condensedElementSymbols()` targets.

Focused checks:

- Syntax:
  `node --check scripts/material-properties/generate-material-property-bank.mjs`
  and `node --check tests/materialPropertyBank.test.mjs` passed.
- Bank validation:
  `node scripts/material-properties/validate-material-property-bank.mjs`
  passed with `recordCount=111`.
- Unit coverage:
  `node --test tests/materialPropertyBank.test.mjs` reported `9/9`, including
  the generated tranche and a bounded generator dry run with cache write/hit
  assertions.
- Generator cache smoke:
  two manual `Nd` dry runs showed first-run cache `writeCount=1` and second-run
  `hitCount=1`, proving repeated dry-run/write loops can avoid recomputing the
  same row.
- Cache-backed tranche:
  the `Nd/Pm/Sm/Eu`, `Gd/Tb/Dy/Ho`, and `Er/Tm/Yb/Lu` write passes each
  reported `cache.hitCount=4` after their dry runs populated those rows.
  The `Hf/Ta/W/Re/Os/Ir/Pt/Au` write pass reported `cache.hitCount=8`.
  The `Hg/Tl/Pb/Bi/Po/At/Fr/Ra` write pass also reported `cache.hitCount=8`.
  The `Ac/Th/Pa/U/Np/Pu/Am/Cm` write pass reported `cache.hitCount=8`.
  The `Bk/Cf/Es/Fm/Md/No/Lr/Rf` write pass reported `cache.hitCount=8`.
  The `Db/Sg/Bh/Hs/Mt/Ds/Rg/Cn/Nh/Fl/Mc/Lv/Ts` write pass reported
  `cache.hitCount=13`.
- Build hygiene:
  `npm run build`, `git diff --check`, and `npm run icc:update` passed; the
  Vite build retained the existing large-chunk warning.

## Current Focused Result - 2026-06-19 Non-H2O Drop Edge Browser Coverage

Drop-edge coverage now includes a non-H2O material pair above six. Fe/H2O with
`dropn=8, basen=5` preserves the requested Fe drop edge, adapts the H2O base
edge through the material spacing resolver, and keeps mounted reset,
render-domain, and GPU upload diagnostics aligned under the variable-size
sphere render mode.

Focused checks:

- Syntax:
  `node --check tests/demo.e2e.mjs` and
  `node --check tests/sphPhaseDemo.test.mjs` passed.
- Unit coverage:
  `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern
  "large non-H2O drop edge|large requested drop edge remains preserved beyond
  seven|same material high drop edge"` reported `40/40`.
- Browser regression:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1
  PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173
  PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config
  tests/playwright.config.mjs --grep "non-H2O drop edge above six"` passed
  `1/1` with the WebGPU console guard active.

## Current Focused Result - 2026-06-19 Three WebGPU Particle PBR Proxy Audit

The Three WebGPU render-row sphere bridge now has focused particle-PBR proxy
coverage. Sodium conductor particles and transparent dry-air gas particles keep
closure-derived visible colors and metadata after the `MeshBasicMaterial`
renderer proxy, and the proxy falls back to the closure-derived visible color
when a source material reaches it as black.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js` and
  `node --check tests/sphPhaseRenderer.test.mjs` passed.
- Diff hygiene:
  `git diff --check -- src/visualization/sphPhaseScene.js
  tests/sphPhaseRenderer.test.mjs` passed.
- Renderer regression:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern
  "Three WebGPU render-row sphere proxy|render-row sphere bridge keeps air|render-row
  sphere bridge uses closure-derived visible proxy"` reported `68/68`.

## Current Focused Result - 2026-06-19 Alkali Resident Reaction Scale Browser Coverage

Mounted resident reaction coverage now extends beyond Na/H2O. The Playwright
path keeps the Na/H2O reset/lockup sequence and adds K/H2O consecutive
resident pressure/render passes under the same WebGPU console guard.

Focused checks:

- Syntax:
  `node --check tests/demo.e2e.mjs` passed.
- Browser regression:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1
  PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173
  PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config
  tests/playwright.config.mjs --grep "resident alkali/H2O promotes product gas
  pressure"` passed `1/1`. The run asserted Na/H2O first, consecutive, reset,
  and post-reset passes, then K/H2O first and consecutive passes with promoted
  spatial gas pressure, retained product mass, scale policies, and support
  bounds.

## Current Focused Result - 2026-06-19 WebGPU-Ocean P2G Backend Policy Switch

The P2G projection contract now exposes an explicit backend policy for the
Ocean-style migration. The current WebGPU runner reports `resident-scatter`,
while `ocean-tiled-experimental` requests fail closed to resident scatter until
the tiled/local-accumulator kernel exists. The same policy is now threaded into
resident MLS-MPM dispatch topology and fused no-full mechanics diagnostics.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphGridGpuKernel.js` and
  `node --check tests/sphGridGpuKernel.test.mjs` passed.
- Runtime/unit coverage:
  `node --test tests/sphGridGpuKernel.test.mjs` passed `21/21`, including the
  policy normalization regression and the fake-device no-full WebGPU P2G
  fallback assertion for `ocean-tiled-experimental`.
- Resident hot-loop coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs` passed `61/61`, including the
  fused no-full resident mechanics assertion that an `ocean-tiled-experimental`
  request reports `ocean-tiled-backend-fallback-resident-scatter`.

## Current Focused Result - 2026-06-19 Immediate Todo Guardrails And Hot-Loop Budget Telemetry

The immediate MLS-MPM/rendering todo lanes now have focused coverage for
large same-material particle edges, transparent particle PBR bridge behavior,
native visible-consumer blocker classification, and resident WebGPU-Ocean
hot-loop budget diagnostics.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check tests/sphMlsMpmGpuStep.test.mjs`,
  `node --check tests/sphPhaseRenderer.test.mjs`,
  `node --check tests/sphPhaseDemo.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- Runtime/unit coverage:
  `node --test tests/sphPhaseDemo.test.mjs` passed `39/39`,
  `node --test tests/sphPhaseRenderer.test.mjs` passed `65/65`, and
  `node --test tests/sphMlsMpmGpuStep.test.mjs` passed `61/61`.
- Mounted browser regression:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1
  PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173
  PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config
  tests/playwright.config.mjs --grep "SPH phase reset preserves drop edge
  above six through mounted render diagnostics"` passed `1/1` against the
  live Vite server with the console issue guard active. The mounted
  `dropn=8, basen=8` reset path preserved effective drop/base edges `8/8`
  and kept generated/render-domain counts at `1024`.
- Renderer guardrails:
  the air render-row sphere bridge now keeps transparent Rayleigh-style PBR
  visible without switching to the metallic proxy fallback, and native
  visible-consumer diagnostics expose blocker families for pending validation,
  resident texture readback unavailability, and browser pixel-validation
  external-instance lifetime failures.
- Resident performance telemetry:
  MLS-MPM resident steps expose
  `peercompute.ulg.mls-mpm-webgpu-ocean-hot-loop-budget.v0`, reporting
  no-full-readback and compact-summary budgets so the WebGPU-Ocean lane can be
  evaluated separately from legacy CPU readback paths.

## Current Focused Result - 2026-06-19 Native Validation Wait And Headless Capture Classification

The native WebGPU probe now waits for browser-side validation when requested,
and blank headless canvas captures are no longer treated as proof that the
engine-owned native canvas did not render. The visible consumer still stays
closed until same-device validation succeeds.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js` and
  `node --check scripts/sph-long-horizon-probe.mjs` passed.
- Minimal browser sanity:
  a localhost WebGPU canvas clear executes in local headless Chromium, but the
  screenshot remains black; a pure offscreen WebGPU texture readback returns
  the expected nonzero sample. Native canvas screenshots are therefore a
  capture limitation in this harness, not a sufficient render failure signal.
- Browser probe:
  `/tmp/ulg-native-validation-analysis-classified-probe.json` completed with
  browser console issues/warnings `0/0`, recorded
  `nativeSurfaceValidationWaitMs=2500`, native bridge render status
  `native-webgpu-surface-consumer-rendered`, and
  `browserCanvasCaptureUnsupportedByNativeWebGpu=true`. It remains `bad`
  because the resident-device validation/readback path exhausts with
  `A valid external Instance reference no longer exists`, leaving
  `resident-surface-visible-gpu-consumer-not-ready` as the only current native
  renderer analysis issue.

## Current Focused Result - 2026-06-19 Drop Edge Large Request Respect

Initial particle edge requests above `6` now stay visible in the actual
particle placement contract instead of being silently coarsened by adaptive
spacing. The demo/view state publishes
`peercompute.ulg.sph-initial-particle-edge-diagnostics.v0`, and the probe plus
benchmark harnesses carry those diagnostics.

Focused checks:

- Syntax:
  `node --check src/runtime/sphPhaseDemo.js`,
  `node --check src/runtime/sphPhaseViewState.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`, and
  `node --check scripts/sph-performance-benchmark.mjs` passed.
- Runtime/unit coverage:
  `node --test tests/sphPhaseDemo.test.mjs` passed `37/37`, including
  `dropn=7, basen=5` same-material matching, non-matching adaptive spacing,
  and `dropn=basen=7` benchmark-count preservation.
- Direct initializer smoke:
  H2O/H2O at `dropn=7, basen=5` now reports effective drop edge `7`, effective
  base edge `14`, total particles `3087`, and matching radius. H2O/H2O at
  `dropn=7, basen=7` preserves both explicit edges and reports total particles
  `686`. Na/H2O at `dropn=7, basen=5` preserves effective drop edge `7` and
  keeps an adaptive base edge `8`.
- Mounted browser probe:
  `/tmp/ulg-drop-edge-7-mounted-probe.json` completed with `status=good`,
  browser console issues `0`, initial edge diagnostics reporting effective
  drop edge `7`, effective base edge `14`, total generated particles `3087`,
  and final render-row vertex count `3087`.
- Mounted reset/rebuild browser regression:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173
  PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173
  PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config
  tests/playwright.config.mjs tests/demo.e2e.mjs --grep "drop edge above six"`
  passed `1/1`. The mobile-shaped `dropn=7, basen=7` MLS-MPM scene clicked
  Reset, reached `particle-state-resynced-after-reset`, preserved effective
  drop/base edge `7/7`, kept generated/render-domain counts at `686`, forced a
  Step, and verified SPH plus MLS-MPM GPU upload counts both matched `686`
  with no captured WebGPU console issues.

## Current Focused Result - 2026-06-19 Mechanics Material Phase Upload Cache

The thermal resident path now reuses a WebGPU upload for mechanics-refresh
material phase records. The refresh kernel can borrow
`mechanicsMaterialPhaseUpload`, the scene owns the cached upload, and the
browser benchmark reports the cache status directly.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphMechanicsRefreshGpuKernel.js`,
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`,
  `node --check scripts/sph-performance-benchmark.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- Runtime/unit coverage:
  `node --test tests/sphMechanicsRefreshGpuKernel.test.mjs` passed `6/6`,
  including the borrowed material phase upload regression.
- Resident step coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs` passed `59/59`.
- Browser benchmark:
  `/tmp/ulg-bench-native-10k-mechanics-material-upload-cache-2.json` completed
  with `status=good`, `probeStatus=good`, browser console issues `0`,
  `mechanicsMaterialPhaseUploadStatus=webgpu-uploaded`,
  `phaseRecordCount=8`, `recordsByteLength=384`, actual particles `9826`,
  mean batch `103.13 ms`, resident completed stage `2.8 ms`, zero readback
  bytes, active grid used, visible native GPU consumer ready, and bridge
  `reused=true`.

## Current Focused Result - 2026-06-19 Native WebGPU Surface Validation And Pd Picker

The native WebGPU surface consumer now validates as an engine-owned
same-device main-canvas path in the harness, even when Chromium headless cannot
map or screenshot the native WebGPU canvas. Palladium is also restored in the
material picker by using the condensed-closure availability filter instead of
the old simple-metal valence filter.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`,
  `node --check src/runtime/material/elementClosures.js`, and
  `node --check src/visualization/sphMaterialOptions.js` passed.
- Runtime/unit coverage:
  `node --test tests/sphMaterialOptions.test.mjs tests/periodicTable.test.mjs`
  passed `9/9`, including the Pd picker assertion.
- Renderer contracts:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "viewport|native|visible GPU|surface draw|mobile|PBR|WebGPU"`
  passed `59/59`, including the native visible-consumer fallback for the
  Chromium `mapAsync` external-instance failure.
- Browser diagnostics:
  `/tmp/ulg-native-surface-probe.json` completed with browser console issues
  `0`, native visible consumer `ready`, bridge
  `native-webgpu-surface-consumer-rendered`, one opaque draw, primary bounds in
  frustum, and `browserCanvasCaptureUnsupportedByNativeWebGpu=true`.
- Mobile-shaped browser diagnostics:
  `/tmp/ulg-native-surface-mobile-probe.json` completed with browser console
  issues `0`, native visible consumer `ready`, bridge
  `native-webgpu-surface-consumer-rendered`, primary bounds in frustum, and
  consistent native surface sizing: CSS about `397x860`, backing `794x1720`,
  bridge DPR `2`, resize DPR `2`.

Known residual risk:

- Local Chromium headless still returns transparent black for WebGPU canvas
  captures and rejects validation buffer mapping with
  `A valid external Instance reference no longer exists`. The harness now
  records that as an unsupported readback/capture channel after native consumer
  acceptance, but real-device mobile rendering still needs live verification.
- The one-step no-full-readback probes still report `missing-max-speed` and
  `no-positive-displacement`; those are physics-motion evidence limits of this
  short render validation run, not console or renderer integration failures.

## Current Focused Result - 2026-06-19 Particle Render Modes Use Live Physics Rows

Explicit Three particle render modes now use current resident physics render
rows instead of retaining stale scene geometry. When the selected mode is
`three-render-row-points`, `three-points`, `three-render-row-spheres`,
`three-spheres`, or `three`, the demo forces a live render refresh each
resident batch, and the scene coerces the row extraction to
`full-parity-readback` for fresh CPU-owned Three geometry.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseDemoMount.js`,
  `node --check src/visualization/sphPhaseScene.js`, and
  `node --check scripts/sph-long-horizon-probe.mjs` passed.
- Runtime/unit coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "render-row sphere|render-row particle|visible GPU|surface draw|renderer backend|mobile"`
  passed `59/59`, including the readback plan regression that keeps Three
  particles fresh while preserving the no-full WebGPU overlay contract.
- Whitespace:
  `git diff --check -- src/visualization/sphPhaseDemoMount.js src/visualization/sphPhaseScene.js tests/sphPhaseRenderer.test.mjs`
  passed.
- Browser diagnostics:
  `/tmp/ulg-render-mode-spheres-live-probe.json` completed `good` with browser
  console issues `0`, `visibleRendererBridge=three-render-row-spheres`,
  `renderBridgeParticleRenderMode=variable-size-spheres`,
  `renderBridgeSpherePbrMaterialSource=closure-derived-pbr`,
  `renderRowsReadbackEffectiveMode=full-parity-readback`,
  `renderRowsReadbackForcedForThreeBridge=true`,
  `renderRowsReadbackRetainedPreviousBridge=false`, bridge update count `4`,
  and decoded render-row displacement `0.005600690841674805m`.

Known residual risk:

- This is still an interim Three readback bridge. It fixes stale rendering for
  explicit particle modes, but the performance roadmap still needs the
  same-device no-readback renderer path to remove the CPU row-readback cost.

## Current Focused Result - 2026-06-19 Native Surface Readback Fallback Validation

The native `native-webgpu-surface-consumer` bridge now separates local
headless texture-readback failure from actual same-device GPU readiness. A
small resident-device map smoke must pass before the visible GPU consumer can
fall back when native canvas/offscreen readback reports the known external
instance limitation.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js` and
  `node --check scripts/sph-long-horizon-probe.mjs` passed.
- Runtime/unit coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "visible GPU|native|surface draw|renderer backend|overlay shader"`
  passed `57/57`, including fallback readiness for the known native readback
  failure.
- Marching-cubes adapter coverage:
  `node --test tests/sphMarchingCubesSurfaceAdapter.test.mjs` passed `17/17`.
- Whitespace:
  `git diff --check` passed.
- Browser diagnostics:
  `/tmp/ulg-native-fallback-probe.json` and
  `/tmp/ulg-native-fallback-capture-probe.json` completed with browser console
  issues `0`, resident device map smoke `passed`, bridge render status
  `native-webgpu-surface-consumer-rendered`, visible GPU consumer
  `resident-surface-visible-gpu-consumer-ready`, and native readback fallback
  accepted.

Known residual risk:

- The local headless browser still returns
  `A valid external Instance reference no longer exists` for native texture
  readback, so it remains unsuitable as a final canvas-pixel oracle. Real
  browser/mobile visibility still needs direct verification.

## Current Focused Result - 2026-06-19 Native Surface Offscreen Validation Probe

The native `native-webgpu-surface-consumer` bridge now has a diagnostic
offscreen same-device validation path. It draws the same retained surface
buffers into a 64x64 WebGPU texture and records validation status separately
from actual visible canvas pixel validation. The visible GPU consumer still
fails closed unless real canvas/presentation pixels validate.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js` and
  `node --check scripts/sph-long-horizon-probe.mjs` passed.
- Runtime/unit coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "native|visible GPU|surface draw|renderer backend"`
  passed `57/57`.
- Whitespace:
  `git diff --check` passed.
- Browser diagnostics:
  `/tmp/ulg-native-offscreen-validation-lifetime-probe.json` completed with
  browser console issues/warnings `0/0`, retained native MC surface draw
  buffers, bridge status `native-webgpu-surface-consumer-ready`, and last
  render status `native-webgpu-surface-consumer-rendered`.

Known residual risk:

- The direct native canvas PNGs are still transparent black while the
  composited page is nonblank. Offscreen validation is wired, but in this
  headless Chromium scene path it remains `not-run` after two attempts because
  `mapAsync` reports `A valid external Instance reference no longer exists`.
  The next acceptance gate remains actual native canvas/mobile visibility.

## Current Focused Result - 2026-06-19 Conservative Native MC No-Readback Counter Bridge

Native marching-cubes extraction is no longer blocked on the sibling
extension's CPU-visible counter readback. The current path requests
`gpu-conservative-no-readback`, keeps the extension's actual vertex count in a
retained GPU counter buffer, and lets ULG's translation shader clamp the
conservative surface rows to that actual count.

Focused checks:

- Sibling extension:
  `/home/cos/projects/webgpu-marching-cubes` passed `npm test` and
  `npm run build` with the dense-voxel/no-readback extraction path.
- Syntax:
  `node --check src/runtime/sph/sphMarchingCubesSurfaceAdapter.js`,
  `node --check src/visualization/sphPhaseScene.js`, and
  `node --check src/visualization/sphPhaseDemoMount.js` passed.
- Runtime/unit coverage:
  `node --test tests/sphMarchingCubesSurfaceAdapter.test.mjs` passed `17/17`
  and proves ULG binds the extension-retained vertex counter instead of a
  host constant for conservative outputs. `node --test
  tests/sphPhaseRenderer.test.mjs` passed `57/57`.
- Browser diagnostics:
  `/tmp/ulg-browser-native-mlsmpm-native-renderer-pixel-validation-3.json`
  completed with `browserConsoleIssueCount=0`, `consoleWarnings=0`, native
  extraction status `extension-surface-ready-needs-ulg-row-translation`,
  `sourceVertexCounterMode=extension-gpu-vertex-counter`, bridge status
  `native-webgpu-surface-consumer-ready`, and last render status
  `native-webgpu-surface-consumer-rendered`.

Known residual risk:

- Visible native pixels are still not proven. Runtime pixel validation reports
  `not-run` because WebGPU `mapAsync` readback fails with
  `A valid external Instance reference no longer exists`, and the direct native
  canvas frames are blank while the composited page remains nonblank. The next
  acceptance gate is main-canvas native WebGPU presentation/mobile visibility,
  not another CPU extraction fallback.

## Current Focused Result - 2026-06-19 Resident Continuation Native MC Deferral

Resident MLS-MPM render-every continuation is now browser-console clean when
native marching-cubes extraction is deferred until the final resident batch.
The remaining native MC issue is isolated to the sibling extension's CPU
counter readback, not the older WGSL, buffer-limit, or queue-fence failures.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`, and
  `node --check src/runtime/sph/sphMarchingCubesSurfaceAdapter.js` passed.
- Runtime/unit coverage:
  `node --test tests/sphPhaseRenderer.test.mjs` passed `57/57`,
  `node --test tests/sphMlsMpmGpuStep.test.mjs` passed `59/59`, and
  `node --test tests/sphMarchingCubesSurfaceAdapter.test.mjs` passed `16/16`.
- Sibling extension:
  `/home/cos/projects/webgpu-marching-cubes` passed `npm test` `19/19` and
  `npm run build`.
- Browser diagnostics:
  `/tmp/ulg-browser-native-mlsmpm-render-every-2x1-extension-no-explicit-fences.json`
  completed with `browserConsoleIssueCount=0`. Intermediate render refreshes
  deferred native extraction; final native extraction failed closed at
  `native-engine-extract-surface` because the extension still calls
  `counterReadback.mapAsync()` in `MarchingCubes.computeActiveVoxels()`.

Known residual risk:

- The next acceptance gate is GPU-resident/no-readback native extraction and
  draw metadata with browser pixel validation. CPU summary/readback fallback
  paths remain diagnostic only.

## Current Focused Result - 2026-06-19 Native WebGPU Validation Correction

The native `native-webgpu-surface-consumer` route now binds an engine-owned
main-canvas WebGPU context to the resident `GPUDevice`, consumes retained
native marching-cubes / extension surface draw buffers without an overlay, and
renders through the native bridge. It does not yet pass the visible GPU
consumer gate: runtime WebGPU pixel readback from the render loop is disabled
after repeated `A valid external Instance reference no longer exists` failures,
so browser-harness PNG/composited-frame analysis is now the validation owner.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`, and
  `node --check scripts/sph-long-horizon-probe.mjs` passed.
- Runtime/unit coverage:
  `node --test tests/sphPhaseRenderer.test.mjs` passed `57/57`, and
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "thermal blocks fused sequence"`
  passed `59/59` after tightening fused-sequence fallback policy.
- Whitespace:
  `git diff --check` passed.
- Browser diagnostics:
  `/tmp/ulg-native-no-full-policy-smoke.json` completed one no-full resident
  substep with browser console issues/warnings `0/0`, page errors `0`,
  retained direct-consumer surface buffers ready, native bridge status
  `native-webgpu-surface-consumer-ready`, and
  `renderBridgeLastRenderStatus=native-webgpu-surface-consumer-rendered`.
  It still classified `bad` with
  `resident-surface-visible-gpu-consumer-not-ready` because
  `surfaceDrawVisibleGpuConsumerPixelValidationStatus=not-run`.
- Frame diagnostics:
  `/tmp/ulg-native-no-full-policy-smoke-frames/` contains direct canvas PNGs
  that are transparent black plus a nonblank composited-page screenshot. This
  proves the new harness can distinguish direct canvas capture from page
  composition, but it does not prove native surface pixels yet.
- Resident continuation diagnostics:
  `/tmp/ulg-native-webgpu-readback-disabled-probe.json`,
  `/tmp/ulg-native-active-grid-probe.json`,
  `/tmp/ulg-native-active-grid-2x1.json`, and
  `/tmp/ulg-native-nonactive-2x1.json` all timed out with zero WebGPU console
  issues. The non-active continuation stalls in `p2gGridProjection`; the
  active-grid continuation stalls in `fusedMechanics`.

Known residual risk:

- The earlier native main-canvas good/mobile-good artifacts were false
  positives from optimistic runtime pixel-validation reporting. Treat them as
  superseded. The current path is correctly fail-closed until native visible
  pixels are proven by browser-frame analysis and the resident continuation
  hang is fixed.

## Current Focused Result - 2026-06-19 Native WebGPU Surface Consumer Contract

The native `native-webgpu-surface-consumer` bridge is now represented as an
engine-owned WebGPU direct-consumer contract. It deliberately refuses separate
overlay canvases and only reports visible no-readback support after same-device
resident buffers, a real engine render target, runtime validation, and browser
pixel validation are all present.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`, and
  `node --check tests/sphPhaseRenderer.test.mjs` passed.
- Runtime/unit coverage:
  `node --test tests/sphPhaseRenderer.test.mjs` passed `57/57`, including
  native capability gating, bridge planning, no-full-readback preservation, and
  visible-consumer pixel-validation policy.
- Browser diagnostics:
  `/tmp/ulg-native-webgpu-surface-consumer-mlsmpm-probe.json` completed with
  browser console `issueCount=0`, no page errors, worker capability ready, five
  retained render-field buffer handoff samples, and
  `surfaceDrawGpuBufferHandoffStatus=resident-render-field-buffer-direct-consumer-ready`.
  It still classified `bad`, as expected, with
  `native-webgpu-surface-consumer-blocked-engine-integration` and
  `resident-surface-visible-gpu-consumer-blocked-surface-extraction-required`.

Known residual risk:

- This is the correct no-overlay contract boundary, not the finished renderer.
  The next testable milestone is an engine-owned WebGPU render target/native
  MC consumer that turns the retained buffers into visible pixels and passes
  browser pixel validation on desktop and mobile.

## Current Focused Result - 2026-06-19 Unsafe Three WebGPU Surface Diagnostics

The explicit unsafe Three WebGPU route now exposes two diagnostic shapes:
renderer-owned resident-device probing and presentation-only probing. Resident
diagnostic meshes use a basic material proxy and low-poly geometry proxy under
Three WebGPU, and external surface-buffer diagnostics now disable unvalidated
Three indirect draw and external normal attributes while using a
`MeshNormalMaterial`-style proxy. The browser harness can distinguish material
complexity from renderer/device lifetime failures. The path is still not
production-ready.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`, and
  `node --check tests/sphPhaseRenderer.test.mjs` passed.
- Runtime/unit coverage:
  `node --test tests/sphPhaseRenderer.test.mjs` passed `57/57`, including the
  unsafe presentation-only policy and Three WebGPU resident material proxy.
- Browser diagnostics:
  `/tmp/ulg-three-webgpu-render-row-lowpoly-proxy-diagnostic.json` still
  classified `bad` with one `browser-page-error`; Three WebGPU reported
  `createBuffer failed, size (288) is too large for the implementation when mappedAtCreation == true`
  and page error `Instance dropped in popErrorScope`.
- Browser diagnostics:
  `/tmp/ulg-three-webgpu-render-row-presentation-only-diagnostic.json`
  classified `bad`, timed out before metrics/frames, and reported the same
  page error.
- Browser diagnostics:
  `/tmp/ulg-three-webgpu-surface-buffers-normal-material-diagnostic.json`
  retained the same-device surface buffers and reached
  `three-webgpu-surface-buffers-ready` with position-only external geometry,
  no Three indirect draw, and no external normal attribute. It still classified
  `bad` with three `browser-page-error` entries from
  `WebGPUPipelineUtils.createRenderPipeline -> Instance dropped in popErrorScope`.

Known residual risk:

- This proves the current Three WebGPU route is not merely failing on
  transmissive PBR, normals, Three indirect draw, or marching-cubes extraction.
  Do not count retained GPU buffers as visible rendering until a same-device
  consumer passes browser console and pixel validation.

## Current Focused Result - 2026-06-18 No-Readback Render-Field Handoff

No-summary/no-full resident render refresh now keeps the render-field rows and
surface buffer resident as a no-overlay engine handoff instead of stopping at a
summary-skipped diagnostic status. The current mounted route still needs the
actual engine/marching-cubes/WebGPU consumer, but the CPU compact summary and
surface-draw metadata readbacks are no longer required as the handoff boundary.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check tests/demo.e2e.mjs`, and
  `node --check scripts/sph-long-horizon-probe.mjs` passed.
- Runtime/unit coverage:
  `node --test tests/sphPhaseRenderer.test.mjs` passed `52/52`, and
  `node --test tests/sphMlsMpmGpuStep.test.mjs` passed `59/59`.
- Browser coverage:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase no-full render refresh can skip compact surface summary readback"`
  passed `1/1`.
- Probe evidence:
  `artifacts/sph-probe-no-summary-render-field-handoff-1.json` completed with
  browser console `issueCount=0`, `warningCounts={}`,
  `surfaceDrawStatus=resident-render-field-buffers-retained`,
  `surfaceDrawVisibleRendererBridge=resident-surface-buffers-no-overlay`,
  `surfaceDrawVisibleRenderSource=resident-render-field-buffers`,
  `surfaceDrawGpuBufferHandoffReady=true`, and
  `surfaceDrawGpuBufferHandoffStatus=resident-render-field-buffer-direct-consumer-ready`.

Known residual risk:

- The same probe still classifies `bad` for no-summary visual/motion evidence:
  missing max-speed, missing positive displacement, and no visible surface
  samples. That is now the expected next renderer-consumer task, not a WebGPU
  console or compact-readback failure.

## Current Focused Result - 2026-06-18 Product-Event Device Identity Guard

Retained product-event buffers and resident product-mass handles now carry
WebGPU device ownership through global symbol keys and fallback object fields,
so duplicated module paths cannot silently erase ownership before the spatial
gas ledger producer binds the buffer. Cross-device retained buffers are blocked
before `createBindGroup()` and fall back to aggregate/cpu ledger paths.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphGpuDeviceIdentity.js` and
  `node --check tests/sphMlsMpmGpuStep.test.mjs` passed.
- Runtime/unit coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "spatial gas ledger producer"`
  passed `57/57` in the current Node runner, including the new globally tagged
  cross-device retained product-event regression with zero bind groups and zero
  dispatches on the consumer device.
- Browser console probe:
  `artifacts/sph-probe-cross-device-product-event-identity-cs-h2o.json`
  completed the Cs/H2O resident fused URL class with browser console
  `issueCount=0`, `warningCounts={}`, resident product-mass status
  `resident-product-mass-merged-gpu-resident`, and `productEventBufferBound=false`.

Known residual risk:

- The same browser probe still classified `bad` for visual/motion evidence:
  no max-speed sample, no positive displacement sample, and no visible surface
  samples. Those remain renderer/diagnostic issues; the WebGPU cross-device
  console failure is no longer reproduced.

## Current Focused Result - 2026-06-18 Active-Grid P2G Accumulator Clear

Active-grid fused MLS-MPM mechanics no longer issues command-encoder
full-buffer clears in the active-grid path. P2G accumulators are cleared
through an active-node WGSL `clear_accumulators` pass, and P2G finalize/grid
update overwrite the active grid/output nodes directly. The resident dispatch
topology and benchmark JSON report
`p2gAccumulatorClear.bufferClearMode=active-grid-compute-clear`, so future
browser artifacts can prove the hot loop is not hiding a full-grid clear.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`,
  `node --check scripts/sph-performance-benchmark.mjs`, and
  `node --check tests/sphMlsMpmGpuStep.test.mjs` passed.
- Runtime/unit topology:
  `node --test tests/sphMlsMpmGpuStep.test.mjs` passed `56/56`; active-grid
  single-step dispatch now reports five dispatches per substep and zero
  command-encoder full-buffer clears, while fused two-step active-grid sequence
  reports ten dispatches, `dispatchCount=10`, and zero full-buffer clears.
- Browser console/benchmark probes:
  `artifacts/sph-performance-benchmark-active-grid-accumulator-clear-smoke.json`
  and `artifacts/sph-performance-benchmark-active-grid-accumulator-clear-10k.json`
  completed with benchmark `status=good`, active grid required, queue fence
  required/complete, browser console `issueCount=0`, and top-level
  `p2gAccumulatorClear.bufferClearMode=active-grid-compute-clear`.

Known residual risk:

- This is a real hot-loop cleanup, but it is not enough for interactive GUI
  rates. The 10k direct-resident row still reports final-batch
  `residentGpuCompletedStageMs=157.5`; the next performance work remains
  GPU-side bounds/sparse dispatch and the no-readback renderer path.

## Current Focused Result - 2026-06-18 Mobile WebGL Surface Material Proxy

Engine-owned Three surface meshes now have an explicit renderer material
policy. On mobile WebGL, transmissive surfaces are converted to a visible
closure-derived color proxy so H2O/glass-like materials do not render flat
black when `MeshPhysicalMaterial.transmission` is unsupported or unreliable.
Same-device Three WebGPU material paths preserve true transmission.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`, and
  `node --check tests/sphPhaseRenderer.test.mjs` passed.
- Renderer material policy coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "surface mesh material|render-row sphere|depth policy"`
  passed `47/47`.
- Browser console/visual probe:
  `/tmp/ulg-sph-mobile-cpu-surface-material-policy-off.json` completed with
  `status=good`, `analysis.status=good`, browser console `issueCount=0`,
  `warningCount=0`, two visible H2O samples, mobile WebGL policy
  `surface-material-mobile-webgl-transmission-proxy`, and surface proxy summary
  `proxyCount=1` for `h2o`.

Known residual risk:

- This protects the CPU/Three and compact/Three fallback material path. The
  resident compact MLS-MPM probe is still bottlenecked by the known
  readback-heavy surface extraction route; the architectural fix remains the
  same-device no-readback surface renderer.

## Current Focused Result - 2026-06-18 Retained Three Render-Row No-Full Visual Mode

The interim Three render-row bridge now reports when it forces full render-row
readback for fresh CPU-owned geometry, and it can retain an already-visible
Three bridge on later explicit no-full refreshes. This gives the browser
harness a console-clean visibility mode without pretending that retained
geometry is fresh physics-motion evidence.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js` and
  `node --check scripts/sph-long-horizon-probe.mjs` passed.
- Renderer regression coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "sphere bridge|render-row|surface draw"`
  passed `42/42`.
- Browser console/visual probe:
  `artifacts/sph-probe-three-bridge-retain-no-full-visual.json` completed with
  `status=good`, `analysis.status=good`, browser console `issueCount=0`,
  `warningCount=0`, no visual-surface issues, and three visible H2O samples.
  The initial sample reported forced `full-parity-readback`; the resident batch
  samples reported retained previous Three sphere bridge with effective
  `no-full-readback`.

Known residual risk:

- Retained bridge samples are stale visual continuity, not fresh geometry.
  Use them only for visual/console checks until the same-device GPU surface
  renderer or a GPU-side render-row consumer is live.

## Current Focused Result - 2026-06-18 Pressure-Aware Particle Size Metadata

Initial particle size is now an explicit physics setup contract rather than an
implicit render-only value. `buildSphPhaseDemoState()` records rest/current
particle-size rows from material, temperature, phase/rest-density, target
neighbor count, and box/support constraints; hydrostatic MLS-MPM
initialization updates current radius/volume from pressure and `J` while
preserving rest radius. Browser probe snapshots now also report resident
authority and Worker capability fields, so future Worker fallback captures are
visible in the artifact.

Focused checks:

- Syntax:
  `node --check src/runtime/sphPhaseDemo.js` and
  `node --check scripts/sph-long-horizon-probe.mjs` passed.
- Demo initialization coverage:
  `node --test tests/sphPhaseDemo.test.mjs` passed `34/34`.
- Diff hygiene:
  `git diff --check -- src/runtime/sphPhaseDemo.js scripts/sph-long-horizon-probe.mjs tests/sphPhaseDemo.test.mjs`
  passed.
- Browser console probe:
  `artifacts/sph-probe-worker-size-metadata-resident-auto.json` completed with
  `status=good`, `analysis.status=good`, browser console `issueCount=0`,
  `warningCount=0`, resident Worker capability `worker-capability-ready`,
  Worker constructor available, requested/effective workers true, and `12`
  target workers.

Known residual risk:

- The visible fallback remains `three-render-row-spheres`, which still reads
  render rows back for Three-owned geometry. The particle-size contract fixes
  initialization semantics and evidence, not the no-readback renderer.

## Current Focused Result - 2026-06-18 Per-Step Active-Grid Fused Mechanics

The thermal-enabled no-full resident route can now use active-grid dispatch
even when sidecars prevent the multi-step fused resident sequence. The
single-step fused mechanics path selects active-grid P2G/finalize/grid-update
kernels, clears only the buffers that require active-grid sparse writes, and
reports the active dispatch through stage timing for the console harness.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js` passed.
- Resident MLS-MPM regression coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs` passed `56/56`.
- Diff hygiene:
  `git diff --check -- src/runtime/sph/sphMlsMpmGpuStep.js tests/sphMlsMpmGpuStep.test.mjs`
  passed.
- Browser console probe:
  `artifacts/sph-probe-active-grid-per-step-thermal.json` completed with
  `status=good`, `analysis.status=good`, browser console `issueCount=0`,
  `warningCount=0`, `compactSummaryMode=none`, and per-batch active-grid
  dispatch over about `2156/5832` grid nodes.

Known residual risk:

- Explicit compact-summary bounds readback remains a diagnostic path, not the
  hot-loop default. The comparison probe
  `artifacts/sph-probe-active-grid-final-summary-default.json` was
  console-clean but spent most of the batch in compact-summary `mapAsync`, so
  the next performance work should move bounds reduction/dispatch decisions
  fully onto the GPU.

## Current Focused Result - 2026-06-18 Three WebGPU Device Gate

This slice adds the engine-side contract for a future no-readback Three WebGPU
surface renderer. `renderer=webgpu` now initializes a Three `WebGPURenderer`
device without rendering through the current WebGPU presentation path. Routine
resident compute/readback stays on the cached resident compute device; the
renderer-owned device is reserved as presentation/same-device bridge evidence.
The marching-cubes extension surface bridge can build Three meshes whose
interleaved attributes point at retained ULG surface row GPU buffers, but
visible WebGPU presentation is still blocked until the Three WebGPU
presentation lifetime issue is resolved.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js` and
  `node --check src/visualization/sphPhaseDemoMount.js` passed.
- Renderer regression coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "renderer backend|external interleaved|extension surface renderer capability|sphere bridge|render-row|depth policy|surface draw"`
  passed `42/42`.
- Browser console probe:
  `artifacts/sph-probe-three-webgpu-renderer-regated-device-split.json`
  completed with
  `status=good`, `analysis.status=good`, zero browser console issues, and
  `renderer=webgpu` held behind the explicit presentation-disabled gate.

Known residual risk:

- The ungated presentation probe after the namespace cleanup and compute-device
  split still produced WebGPU page error `Instance dropped in popErrorScope`.
  Do not enable WebGPU presentation until that exact error is gone and the
  browser console probe is clean with actual rendered pixels.

## Current Focused Result - 2026-06-18 Extension Surface Renderer Capability Gate

The resident marching-cubes extension surface path now reports an explicit
renderer capability contract. The browser/probe/benchmark telemetry can tell
the difference between retained GPU-resident extension buffers and a visible
same-device surface bridge. The current mounted scene is Three WebGL-backed,
so no-full visible GPUBuffer geometry is intentionally blocked with a concrete
reason instead of silently looking like a renderer success.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`, and
  `node --check scripts/sph-performance-benchmark.mjs` passed.
- Renderer regression coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "extension surface renderer capability|sphere bridge|render-row|depth policy|surface draw"`
  passed `40/40`.
- Marching-cubes adapter coverage:
  `node --test tests/sphMarchingCubesSurfaceAdapter.test.mjs` passed `10/10`.

Known residual risk:

- This is a gate and telemetry slice, not yet the visible no-readback renderer.
  The next slice needs the engine-owned Three WebGPU renderer path and a bridge
  that consumes retained extension buffers without CPU readback or overlay
  presentation.

## Current Focused Result - 2026-06-18 No-Fence Probe Defaults And Sphere Bridge Reuse

This slice removes two accidental mounted-scene costs from the interim
MLS-MPM render path: no-full browser probes and benchmarks no longer default
to compact-summary readback fences, and the Three render-row sphere bridge
reuses per-surface `InstancedMesh` objects across resident refreshes. Reused
sphere meshes still refresh their material when the closure-derived optical
signature changes, so PBR state is not frozen by geometry reuse.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`, and
  `node --check scripts/sph-performance-benchmark.mjs` passed.
- Renderer regression coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "sphere bridge|render-row|depth policy|surface draw"`
  passed `39/39`.
- Browser console probe:
  `artifacts/sph-probe-sphere-bridge-reuse-material-refresh-water-water.json`
  completed with `status=good`, `analysis.status=good`, no analysis issues,
  browser console `issueCount=0`, `compactSummaryDisabled=true`,
  `meanCompactSummaryMs=0`, and render-row motion evidence.
- Bridge reuse evidence:
  initial draw created `2` sphere meshes; both resident batches reused `2`
  meshes with `0` created and `0` disposed. The second resident batch reported
  `batchMs=20.1` after the cold refresh batch.

Known residual risk:

- The bridge still reads render rows back into Three-owned geometry. It is a
  mobile visibility and diagnostics path while the proper same-device GPU
  surface consumer is built.
- No-full default compact-summary suppression is correct for performance and
  visual probes, but parity/scientific runs must explicitly request compact or
  full readback evidence.

## Current Focused Result - 2026-06-18 Resident Gates, Material Bank, Worker Telemetry, And Wall Contact

This slice covers the non-renderer lanes around the current MLS-MPM push:
resident performance gates, browser Worker capability reporting, the first
precomputed material-property bank seed, and elasticity-inclusive wall contact.
The GPU-resident marching-cubes extension work is tracked separately through
the `/home/cos/projects/webgpu-marching-cubes` adapter/refactor lane.

Focused checks:

- Syntax:
  `node --check scripts/sph-performance-benchmark.mjs`,
  `node --check src/runtime/sph/sphGridUpdateGpuKernel.js`,
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check scripts/material-properties/validate-material-property-bank.mjs`,
  and `node --check src/runtime/material/materialPropertyBank.js` passed.
- Focused resident/material/contact tests:
  `node --test tests/sphGridUpdateGpuKernel.test.mjs tests/materialPropertyBank.test.mjs tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "wall barrier|floor no-slip|floor row|material property bank|Worker capability"`
  passed `34/34`.
- Material bank validator:
  `npm run validate:material-properties` passed with `5` element records:
  `H`, `O`, `Na`, `Fe`, and `Cs`.
- Physics atomics:
  `npm run test:physics-atomics` passed `11/14`, with the `3` long-horizon
  liquid acceptance gates skipped because they remain opt-in behind
  `ULG_RUN_LONG_LIQUID_ATOMIC=1`.

Known residual risk:

- The material JSON bank is a warm-input seed only; it is not yet the default
  `MaterialRegistry` resolver source and does not yet include crystalline
  structures or common compounds.
- Wall contact now has a bulk/shear-derived stiffness route, but material pair
  and interface contact still need a physics-engine integration after wall
  behavior stays stable.
- The browser Worker telemetry makes inline fallback explicit; it does not by
  itself make PeerCompute run this Node test environment in real browser
  Workers.

## Current Focused Result - 2026-06-18 Mobile Three Renderer Viewport Integration

The mobile MLS-MPM visibility fix now lives in the normal Three scene rather
than a separate canvas path. The scene resolves mobile layout from container
size, rect size, and `visualViewport`, clamps the renderer DPR to `2`, and
resizes the Three backing buffer without changing the CSS scene surface. The
resident render-row sphere bridge reuses its Three mesh/group and reports
engine-integration telemetry.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js` and
  `node --check scripts/sph-long-horizon-probe.mjs` passed.
- Renderer regression coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "viewport sizing|resident overlay policy|render-row overlay shader|renderer depth policy"`
  passed `37/37`, including DPR clamp and zero-layout mobile fallback
  coverage.
- Mobile visual-only probe:
  `ULG_PROBE_VISUAL_ONLY=1 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&boxx=5&boxy=5&boxz=5&dropn=4&basen=4&mech=mlsmpm&residentAuto=0&residentFuseSequence=1&residentActiveGrid=1&visualCapture=1&surfaceDraw=three-render-row-spheres&blob=1' ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MODE=three-render-row-spheres ULG_PROBE_OUTPUT=artifacts/sph-long-probe-mobile-three-spheres-engine-viewport-visual.json ULG_PROBE_FRAME_DIR=artifacts/sph-long-probe-mobile-three-spheres-engine-viewport-visual-frames ULG_PROBE_BATCHES=2 ULG_PROBE_BATCH_STEPS=2 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=full-parity-readback ULG_PROBE_RENDER_FIELD_SURFACE_SUMMARY_MODE=skip ULG_PROBE_COMPACT_SUMMARY_MODE=none ULG_PROBE_COMPACT_SUMMARY_SCOPE=particle-visual ULG_PROBE_FUSE_RESIDENT_MECHANICS_SEQUENCE=1 ULG_PROBE_FUSE_RESIDENT_ACTIVE_GRID=1 ULG_PROBE_CAPTURE_FRAMES=1 ULG_PROBE_FRAME_MAX=4 ULG_PROBE_FAIL_ON_BAD=1 ULG_PROBE_VIEWPORT_WIDTH=390 ULG_PROBE_VIEWPORT_HEIGHT=844 ULG_PROBE_DEVICE_SCALE_FACTOR=3 ULG_PROBE_IS_MOBILE=1 ULG_PROBE_HAS_TOUCH=1 ULG_PROBE_PORT=5209 ULG_PROBE_TIMEOUT_MS=180000 npm run probe:sph-long-horizon`
  passed with `status=good`, `analysis.status=good`, no issues, zero console
  issues/warnings, and four captured frames.
- Probe evidence:
  final surface draw reported `visibleRendererBridge=three-render-row-spheres`,
  `renderBridgeStatus=three-render-row-spheres-ready`,
  `renderBridgeLastRenderStatus=three-render-row-spheres-submitted`,
  `renderBridgeThreeMeshCount=1`,
  `renderBridgeEngineIntegration=three-renderer-owned-scene-object`,
  `renderBridgeReused=true`, and `renderBridgeUpdateCount=1`.
- Mobile sizing evidence:
  final viewport resize reported CSS `397x860`, backing `794x1720`, DPR `2`,
  and visual viewport `390x844`; the composited page screenshot
  `artifacts/sph-long-probe-mobile-three-spheres-engine-viewport-visual-frames/0003-b002-post-probe-composited-page.png`
  is `390x844`.

Known residual risk:

- The render bridge is still an interim Three readback bridge. It fixes mobile
  visibility and perspective integration, but not the sub-1-FPS architecture
  problem.
- `ULG_PROBE_VISUAL_ONLY=1` deliberately scopes the verdict to visible render
  output. It does not replace compact/full readback for physics validation.

## Current Focused Result - 2026-06-18 Direct Resident Fused Sequence

The performance harness now has a direct-resident MLS-MPM lane for measuring
the WebGPU mechanics hot loop without scene rendering or compact-summary
readback. The runtime allows a no-full fused resident sequence when
`compactSummaryMode=none`, active-grid dispatch remains enabled in that
sequence, and the harness can await `queue.onSubmittedWorkDone()` so benchmark
timing reflects completed GPU work instead of command enqueue time.
The mounted scene can now request the same fused-sequence queue-fence timing
with `residentQueueFence=1`, which the benchmark enables through
`ULG_BENCH_MEASURE_GPU_QUEUE_FENCE=1`.

Focused checks:

- Syntax:
  `node --check tests/sphMlsMpmGpuStep.test.mjs`,
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`,
  `node --check scripts/sph-performance-benchmark.mjs`,
  `node --check src/visualization/sphPhaseScene.js`, and
  `node --check src/visualization/sphPhaseDemoMount.js` passed.
- Resident sequence no-summary coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "compactSummaryMode none|fused resident sequence can run active-grid|carries active-grid bounds"`
  passed `54/54`.
- Direct-resident active-grid benchmark:
  `ULG_BENCH_OUTPUT=artifacts/sph-performance-benchmark-direct-resident-active-grid.json ULG_BENCH_PROBE_MODE=direct-resident ULG_BENCH_PARTICLE_COUNTS=1000 ULG_BENCH_BATCHES=1 ULG_BENCH_BATCH_STEPS=4 ULG_BENCH_PORT=5220 ULG_BENCH_FAIL_ON_ERROR=1 npm run bench:sph-performance`
  completed with scenario `status=good`, `browserConsoleIssueCount=0`,
  actual particles `1024`, `compactSummaryMode=none`,
  `fusedResidentSequence=true`, `fusedResidentSequenceStepCount=4`,
  `compactSummaryRequested=false`, `residentGpuQueueFenceMs=643.6`,
  `residentGpuCompletedStageMs=647`, and active-grid dispatch over
  `4913/54872` grid nodes. The earlier `2.6ms` row is retained only as
  evidence of enqueue-only timing and must not be used as a throughput claim.
- Warm direct-resident active-grid carry-over benchmark:
  `ULG_BENCH_OUTPUT=artifacts/sph-performance-benchmark-direct-resident-active-grid-warm.json ULG_BENCH_PROBE_MODE=direct-resident ULG_BENCH_PARTICLE_COUNTS=1000 ULG_BENCH_BATCHES=3 ULG_BENCH_BATCH_STEPS=4 ULG_BENCH_PORT=5222 ULG_BENCH_FAIL_ON_ERROR=1 npm run bench:sph-performance`
  completed with scenario `status=good`, `browserConsoleIssueCount=0`,
  final-batch `residentGpuCompletedStageMs=38.9`,
  `residentGpuQueueFenceMs=37.6`, `residentStageStepsPerSecond=25.7`, and
  active-grid dispatch over `19343/54872` nodes with
  `boundsSource=resident-position-bounds`.
- Warm direct-resident scale benchmark:
  `ULG_BENCH_OUTPUT=artifacts/sph-performance-benchmark-direct-resident-scale-warm-queue-fenced.json ULG_BENCH_PROBE_MODE=direct-resident ULG_BENCH_PARTICLE_COUNTS=10000,50000 ULG_BENCH_BATCHES=3 ULG_BENCH_BATCH_STEPS=4 ULG_BENCH_PORT=5225 ULG_BENCH_TIMEOUT_MS=300000 npm run bench:sph-performance`
  completed with `browserConsoleIssueCount=0`; final-batch
  `residentGpuCompletedStageMs` was `140.2` at `9826` particles and `580.3`
  at `48778` particles.
- Queue-fenced phone-shaped mounted scene benchmark:
  `ULG_BENCH_OUTPUT=artifacts/sph-performance-benchmark-mobile-spheres-no-thermal-queue-fenced-warm.json ULG_BENCH_PARTICLE_COUNTS=152 ULG_BENCH_BATCHES=3 ULG_BENCH_BATCH_STEPS=4 ULG_BENCH_PORT=5231 ULG_BENCH_IS_MOBILE=1 ULG_BENCH_VIEWPORT_WIDTH=390 ULG_BENCH_VIEWPORT_HEIGHT=844 ULG_BENCH_DEVICE_SCALE_FACTOR=3 ULG_BENCH_LAW_THERMAL=0 ULG_BENCH_MEASURE_GPU_QUEUE_FENCE=1 ULG_BENCH_FAIL_ON_ERROR=1 npm run bench:sph-performance`
  completed with scenario `status=good`, `browserConsoleIssueCount=0`,
  `surfaceDrawBridge=three-render-row-spheres`,
  `residentGpuCompletedStageMs=104.2`, `residentGpuQueueFenceMs=103.4`,
  `visualRefreshHzEstimate=2.28`, `renderRowsReadbackByteLength=6144`, and
  active-grid dispatch over `13520/27000` nodes.
- Renderer regression coverage:
  `node --test tests/sphPhaseRenderer.test.mjs` passed `35/35`.

Known residual risk:

- This is a mechanics-only performance lane, not full GUI throughput.
  Thermal/reaction sidecars and the renderer still need to be folded into the
  resident sequence.
- Compact motion proof is intentionally absent in direct no-summary mode, so
  the embedded probe can report missing motion metrics while the benchmark
  scenario remains `good`.
- Active-grid warm batches currently rely on conservative predicted resident
  bounds. A GPU-side bounds reduction is still needed to tighten dispatch after
  larger motion or long no-readback runs.
- The phone-shaped mounted scene is console-clean but still far from
  interactive. The sphere bridge is a mobile correctness/visibility bridge,
  not the final performance renderer.

## Current Focused Result - 2026-06-18 Resident Point Bridge And Benchmark Split

The normal MLS-MPM resident browser route can now avoid CPU surface
construction when `surfaceDraw=three-render-row-points` is selected. The scene
publishes a Three.js point bridge backed by WebGPU render-row readback, skips
CPU `MarchingCubes` surface apply during setup, and keeps browser console
validation clean for both same-material H2O/H2O and reactive Cs/H2O no-full
resident smoke routes.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check src/visualization/sphPhaseDemoMount.js`,
  `node --check src/runtime/material/opticalGpuBuffers.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`, and
  `node --check scripts/sph-performance-benchmark.mjs` passed.
- Optical storage binding padding:
  `node --test tests/opticalGpuBuffers.test.mjs` passed `18/18`; small
  optical lookup query/output buffers now allocate at least 16 bytes for
  WebGPU storage bindings.
- H2O/H2O MLS-MPM browser probe:
  `artifacts/sph-long-probe-smoke-after-output-padding.json` recorded
  `browserConsoleIssueCount=0`, `setParticlesTiming.totalMs=2.9`,
  render FPS about `52.3`, `surfaceDrawVisibleRendererBridge=three-render-row-points`,
  `materialKeys=["h2o"]`, `residentOverlayVisibleSampleCount=1`, and no
  visual-surface issues. The remaining analysis issues are the expected
  no-full compact-motion-proof gaps: `missing-max-speed` and
  `no-positive-displacement`.
- Cs/H2O MLS-MPM browser probe:
  `artifacts/sph-long-probe-cs-h2o-after.json` recorded
  `browserConsoleIssueCount=0`, `setParticlesTiming.totalMs=4.2`, render FPS
  about `54.5`, `residentProductMassStatus=resident-product-mass-buffer-retained`,
  and `residentProductMassEosCouplingStatus=resident-product-mass-p2g-eos-sidecar-ready`.
- Benchmark harness:
  `ULG_BENCH_PARTICLE_COUNTS=16 ULG_BENCH_BATCHES=1 ULG_BENCH_BATCH_STEPS=1 ULG_BENCH_OUTPUT=artifacts/sph-performance-benchmark-smoke-after.json npm run bench:sph-performance`
  reported scenario `status=good`, `browserConsoleIssueCount=0`,
  resident final-step `9.5ms`, and bridge `three-render-row-points`.
- Larger smoke:
  `ULG_BENCH_PARTICLE_COUNTS=1000 ULG_BENCH_BATCHES=1 ULG_BENCH_BATCH_STEPS=1 ULG_BENCH_OUTPUT=artifacts/sph-performance-benchmark-1000-after.json npm run bench:sph-performance`
  reported scenario `status=good`, actual particles `1024`,
  `browserConsoleIssueCount=0`, resident final-step `9.7ms`, and bridge
  `three-render-row-points`.
- Multi-substep smoke:
  `ULG_BENCH_PARTICLE_COUNTS=16 ULG_BENCH_BATCHES=1 ULG_BENCH_BATCH_STEPS=16 ULG_BENCH_OUTPUT=artifacts/sph-performance-benchmark-16x16-after2.json npm run bench:sph-performance`
  reported `completedStepCount=16`, scenario `status=good`,
  `browserConsoleIssueCount=0`, final-step `1.6ms`, and probe-wall throughput
  separately from resident final-step throughput.

Known residual risk:

- The point bridge still performs render-row readback; it is an interim
  console-clean replacement for CPU surface construction, not the final
  GPU-resident surface renderer.
- No-full benchmark rows intentionally skip compact motion proof, so the
  physics probe status can remain `bad` even when the benchmark status is
  `good`.
- Benchmark sequence timing currently reports final-step resident timing and
  probe-wall batch timing separately; cumulative GPU queue timing for the full
  multi-step sequence still needs a first-class telemetry field.

## Current Focused Result - 2026-06-18 MLS-MPM Browser Hot-Loop Console Cleanup

The Cs/H2O no-full resident MLS-MPM browser route is console-clean after the
device-identity, device-limit, no-full reaction cleanup, and compact-summary
skip changes. The live no-full scene path uses `compactSummaryMode=none`,
which leaves full/compact validation modes available but removes the per-step
summary `mapAsync` fence from the GUI hot path.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/visualization/sphPhaseScene.js`, and
  `node --check src/visualization/sphPhaseDemoMount.js` passed.
- Resident sequence and cross-device guard:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "compactSummaryMode none|budget no compact-summary|resident no-full step runs reaction|ping-pong unread retained buffers|cross-device retained product-event buffers"`
  passed `52/52`.
- Reaction no-full cleanup:
  `node --test tests/sphReactionGpuKernel.test.mjs --test-name-pattern "no-full|reaction"`
  passed.
- Reaction summary resident/product-event rows:
  `node --test tests/sphReactionGpuSummary.test.mjs --test-name-pattern "resident|product-event|summary"`
  passed.
- Device-limit and renderer policy coverage:
  `node --test tests/opticalGpuBuffers.test.mjs tests/orchestration.test.mjs tests/sphPhaseRenderer.test.mjs`
  passed `63/63`.
- Manual browser resident probe on `http://localhost:5174/` Cs/H2O MLS-MPM:
  Playwright captured `issueCount=0`, `Worker=function`,
  `stageTiming.totalMs=18.7`, `reactionStep=7ms`, `compactSummary=0`,
  `compactSummaryRequested=false`, and retained reaction product-event state.
- Auto GUI resident scheduler on the same route: first `16`-step batch
  completed with `issueCount=0`, no resident error,
  `compactSummaryMode=none`, final-step `stageTiming.totalMs=3`, and
  `compactSummary=0`.
- Perspective-shift visual sanity: Playwright screenshots before/after an
  orbit drag were nonblank and reported one full-size Three canvas, not the
  old separate raw WebGPU overlay canvas.

Known residual risk:

- Browser/headless still emits WebGL `ReadPixels` performance warnings from
  the Three/MarchingCubes fallback render path.
- `compactSummaryMode=none` is a live performance mode. Explicit compact/full
  readback remains required for scientific validation and diagnostics.
- The WebGPU-Ocean-style resident render path is still the architectural fix
  for broad render/FPS improvement.

## Current Focused Result - 2026-06-18 WebGPU-Ocean Audit And Readback Routing

The WebGPU-Ocean audit confirms the next performance gate should be a
replacement hot-loop backend, not incremental tuning of fallback readbacks.
The reference MLS-MPM loop dispatches P2G/G2P per particle, scatters to grid
nodes with fixed-point integer atomics, updates grid nodes in grid-only passes,
and renders particle-derived depth/thickness directly on GPU. ULG's current
P2G shader now matches the particle-parallel scatter shape; the remaining
browser bottleneck is queue fences/readback cadence, reaction summary cadence,
Worker residency, and sidecar/render integration.

Focused checks:

- Source audit:
  `/tmp/ulg-webgpu-ocean-audit/mls-mpm/mls-mpm.ts`,
  `/tmp/ulg-webgpu-ocean-audit/mls-mpm/p2g_1.wgsl`,
  `/tmp/ulg-webgpu-ocean-audit/mls-mpm/p2g_2.wgsl`,
  `/tmp/ulg-webgpu-ocean-audit/mls-mpm/updateGrid.wgsl`,
  `/tmp/ulg-webgpu-ocean-audit/mls-mpm/g2p.wgsl`, and
  `/tmp/ulg-webgpu-ocean-audit/render/fluidRender.ts` inspected.
- Syntax:
  `node --check src/runtime/sph/sphReactionGpuSummary.js`,
  `node --check src/runtime/sph/sphReactionGpuKernel.js`,
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check tests/sphReactionGpuSummary.test.mjs`, and
  `node --check tests/sphMlsMpmGpuStep.test.mjs` passed.
- Reaction resident product-event mode:
  `node --test tests/sphReactionGpuSummary.test.mjs --test-name-pattern "resident product-event|product events"`
  passed `10/10`.
- Reaction step wrapper:
  `node --test tests/sphReactionGpuKernel.test.mjs` passed `10/10`.
- Resident MLS-MPM reaction/fused focused rows:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "reaction|resident steps ping-pong unread|per-step fused"`
  passed `49/49`.
- H2O/H2O MLS-MPM browser probe:
  `/tmp/ulg-h2o-h2o-mlsmpm-no-reaction-summary-readback-20260618.json`
  classified `good` with zero browser-console issues/warnings.
- Na/H2O MLS-MPM browser probe:
  `/tmp/ulg-na-h2o-mlsmpm-compact-gas-only-reaction-summary-20260618.json`
  classified `good` with zero browser-console issues/warnings and retained
  `gpu-resident-reaction-pressure-summary`.

## Current Focused Result - 2026-06-18 Browser Console Harness And WebGPU Buffer Limits

The visual harness now records full Playwright browser console and page-error
telemetry instead of only the probe progress messages. WebGPU validation
failures, WGSL parse failures, invalid GPU objects, destroyed-buffer submits,
cross-device buffers, page errors, and WebGPU warning-limit messages are
classified as `browser-console:*` analysis issues. The visual matrix summary
now aggregates `browserConsoleIssueCounts` and
`browserConsoleWarningCounts`.

The resident render/device path also requests supported higher WebGPU limits:
`maxBufferSize` and `maxStorageBufferBindingSize`, capped at 1 GiB for the
resident SPH device request. This fixes the large material-interface candidate
buffer path on adapters that advertise higher limits, while render-buffer
preflights keep lower-limit adapters on CPU fallback before invalid buffers or
bind groups are created.

Focused checks:

- Syntax:
  `node --check src/runtime/material/opticalGpuBuffers.js`,
  `node --check src/runtime/sph/sphRenderGpuKernel.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`, and
  `node --check scripts/sph-visual-sanity-matrix.mjs` passed.
- WebGPU device limit unit:
  `node --test tests/opticalGpuBuffers.test.mjs` passed `17/17`, including
  the required-limits descriptor for resident SPH storage-buffer count,
  `maxBufferSize`, and `maxStorageBufferBindingSize`.
- Material-interface render preflight:
  `node --test tests/sphRenderGpuKernel.test.mjs --test-name-pattern "material interface candidate"`
  passed, including low-limit fallback before oversized buffer creation and
  before oversized storage binding.
- Water/water MLS-MPM browser matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-console-harness-h2o-mlsmpm-20260618 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=0 ULG_VISUAL_MATRIX_TIMEOUT_MS=180000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, empty `browserConsoleIssueCounts`, and
  `browserConsoleWarningCounts.peercompute-worker-inline-fallback=1`.
- Na/H2O MLS-MPM browser probe:
  `ULG_PROBE_URL='/?wxmin=293.15&wxmax=293.15&wymin=293.15&wymax=293.15&wzmin=293.15&wzmax=293.15&drop=Na&base=h2o&dropt=290&baset=290&iceh=0&ironh=1.5&boxx=5&boxy=5&boxz=5&dropn=3&basen=5&mech=mlsmpm&lawmech=1&lawg=1&laweos=1&lawp=1&lawt=1&lawr=1&lawv=1&lawst=1&blob=1' ULG_PROBE_OUTPUT=/tmp/ulg-na-h2o-mlsmpm-console-harness-2.json ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=4 ULG_PROBE_CAPTURE_FRAMES=0 ULG_PROBE_TIMEOUT_MS=180000 ULG_PROBE_FAIL_ON_BAD=0 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-long-horizon`
  passed with top-level `status=good`, empty
  `timeline.browserConsole.issueCounts`, and only the expected
  `peercompute-worker-inline-fallback` warning.

## Current Focused Result - 2026-06-18 NodeKernel Stage Execution Authority And WGSL Parser Fix

ULG now routes GPU resident stage execution through NodeKernel when a real
NodeKernel owns the resident ComputeManager. The same slice fixed the browser
WGSL parse failure in `ulg-sph-render-field-surface-summary` by renaming the
reserved local identifier `active` to `has_active_cells`.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`,
  `node --check ulg-gpu-abi/src/wgsl.js`, and
  `node --check tests/webgpuKernelAbi.test.mjs` passed.
- WGSL ABI/parser guard:
  `node --test tests/webgpuKernelAbi.test.mjs` passed `2/2`, including the
  guard that rejects exact WGSL `let|var|const active` declarations.
- ULG PeerCompute integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "resident solver descriptors|GPU resident stage placement|worker-retained|state-family|dependency"`
  passed `16/16`. NodeKernel-owned mechanics stage chains now report
  `gpuResidentLaneStageExecutionAuthorityPath=node-kernel-execution` and
  `peercompute.nodekernel.gpu-resident-stage-execution-authority.v0`; direct
  injected ComputeManager paths still report `compute-manager-execution`.
- Fast physics atomics:
  `npm run test:physics-atomics` passed `11` checks with `3` expected opt-in
  skips.
- Recurring visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-nodekernel-stage-execution-authority-20260618 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,solid-h2o-cpu-sph,law-pressure-off-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, empty issue counts, empty visual-surface issue
  counts, and two frame artifacts per row. Full browser-console validation is
  covered by the current console harness result above.

## Current Focused Result - 2026-06-18 Solid H2O Static Sequence Recheck

The cold same-material CPU-SPH solid-H2O static/support row still passes under
the current dense visual sequence harness. This narrows, but does not close,
the reported ice/solid behavior bug class.

Focused check:

- Solid H2O static sequence:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-solid-h2o-static-sequence-20260618 ULG_VISUAL_MATRIX_SCENARIOS=solid-h2o-cpu-sph ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=10 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=360000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, nine captured frames,
  `visualFrameTimeSpanS=0.9216`, max displacement `1.19e-7 m`, max speed
  `0.00147 m/s`, first/last H2O visible surface count `2 -> 2`, one connected
  component per visible surface, empty issue lists, and final particles
  `{h2o:152}`.

## Current Focused Result - 2026-06-18 CPU-SPH And Resident MLS-MPM Visual Flow Sequence Gates

CPU-SPH same-material H2O/H2O and a practical lower-resolution resident
MLS-MPM smoke row now have opt-in close-spaced visual sequence gates. The gate
records the simulated time represented by captured frames and can fail when a
row captures too little simulated time to prove motion.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseDemoMount.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`, and
  `node --check scripts/sph-visual-sanity-matrix.mjs` passed.
- CPU-SPH flow sequence:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-cpu-sph-flow-sequence-20260617 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-cpu-sph-flow-sequence ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=12 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=360000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, nine frames, `visualFrameTimeSpanS=0.9216`,
  frame times from `0` through `0.9216 s`, final H2O tallness `0.587`,
  footprint fill `0.297`, one H2O visible surface/component, and empty visual
  issues.
- Resident MLS-MPM flow smoke:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-mlsmpm-flow-smoke-pass-20260618 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm-flow-smoke ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=10 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=360000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, nine frames, `visualFrameTimeSpanS=1.024`,
  one H2O visible surface/component, final tallness `0.767` under the
  smoke-specific `0.8` cap, footprint fill `0.151`, and empty visual issues.
  The full 3x5 resident flow row remains a slower stricter gate.

## Current Focused Result - 2026-06-17 Reaction Product Visual Contract And Flow Cadence Triage

Na/H2O CPU/plain-SPH reaction state is now asserted by the visual matrix, and
the overlay status reports the current material inventory instead of stale
drop/base role counts. Live fluid flow remains a separate cadence/sequence
gate: long atomics pass, while the short visual rows still do not advance far
enough in simulated time to prove settling by eye.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseDemoMount.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`, and
  `node --check scripts/sph-visual-sanity-matrix.mjs` passed.
- Long scientific liquid atomics:
  `ULG_RUN_LONG_LIQUID_ATOMIC=1 npm run test:physics-liquid-atomic` passed
  `14/14`.
- Reaction visual contract:
  visual matrix run `codex-reaction-panel-contract-rerun-20260617` for
  `reaction-product-na-h2o` passed with `failedCount=0`,
  `maxReactionEventsTotal=8`, final particles `{h2o:125, naoh:8, h2:8}`,
  empty visual issues, and two frame artifacts.
- Flow cadence triage:
  visual matrix run `codex-reaction-flow-regression-20260617` intentionally
  kept the liquid complaint open. It failed the MLS-MPM and CPU-SPH H2O/H2O
  rows because the short run reached only `0.192 s` and `0.1296 s` simulated
  time, with tallness/footprint still `0.930`/`0.144` and `0.973`/`0.117`.
  The next behavior harness must capture enough simulated time and close-spaced
  frames to prove visible flow, not just nonblank bounded geometry.

## Current Focused Result - 2026-06-17 NodeKernel GPU Resident Stage-Placement Preflight Routing

ULG now routes mechanics stage placement preflight through NodeKernel when a
real NodeKernel owns the resident ComputeManager, while preserving direct
ComputeManager preflight for injected/local-only paths.

Focused checks:

- ULG PeerCompute integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs` passed
  `16/16`. The NodeKernel-owned mechanics stage chain reports
  `gpuResidentLaneStagePlacementAuthorityPath=node-kernel-preflight`,
  `peercompute.nodekernel.gpu-resident-stage-placement-preflight.v0`,
  `local-placement-accepted`, and raw ComputeManager status
  `placement-preflight-ready`; the direct lane-executed path reports
  `compute-manager-preflight` and no NodeKernel preflight schema.
- Fast physics atomics:
  `npm run test:physics-atomics` passed `11` checks with `3` expected opt-in
  skips.
- Recurring visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-nodekernel-stage-placement-preflight-20260617 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,solid-h2o-cpu-sph,law-pressure-off-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, empty issue counts, and two frames each under
  `/tmp/ulg-visual-sanity-matrix/codex-nodekernel-stage-placement-preflight-20260617`.

## Current Focused Result - 2026-06-17 ComputeManager GPU Resident Stage-Placement Preflight

ComputeManager now reports GPU resident lane placement before execution. ULG
records that preflight in mechanics stage-chain telemetry so Worker/lane/device
placement can be audited before actual stage handlers mutate state.

Focused checks:

- PeerCompute lane manager:
  `node --test tests/unit/gpuResidentLaneManager.test.js` passed `10/10`. The
  new coverage proves `preflightGpuResidentLaneStagePlacement()` reports the
  same dependency batches and state-family conflict deferrals as execution,
  plus GPUHub executor sources, Worker residency status, Worker ready/fallback
  counts, missing executor count, and max concurrent stage count.
- ULG PeerCompute integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs` passed
  `16/16`. The mechanics-only stage chain reports placement batches
  `[['p2g'], ['gridUpdate'], ['g2p']]` with blocked Worker fallback statuses,
  while the pressure/thermal/reaction Worker-ready chain reports
  `[['p2g', 'pressureInterface'], ['gridUpdate'], ['g2p'], ['thermalPhase'], ['reactionProduct']]`
  with six Worker-ready stages and no missing executors.
- Fast physics atomics:
  `npm run test:physics-atomics` passed `11` checks with `3` expected opt-in
  skips.
- Recurring visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-stage-placement-preflight-20260617 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,solid-h2o-cpu-sph,law-pressure-off-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, empty issue counts, and two frames each under
  `/tmp/ulg-visual-sanity-matrix/codex-stage-placement-preflight-20260617`.

## Current Focused Result - 2026-06-17 GPU Resident State-Family Conflict Batching

PeerCompute ready batches now respect declared state-family read/write
conflicts. ULG records that policy in mechanics stage-chain telemetry so future
law-stage concurrency can be audited from the browser side.

Focused checks:

- PeerCompute lane manager:
  `node --test tests/unit/gpuResidentLaneManager.test.js` passed `9/9`. The
  new coverage proves ready stages with write/read or read/write conflicts are
  deferred into later batches, and the execution report records conflict type,
  families, blocker stage, and batch index.
- ULG PeerCompute integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs` passed
  `16/16`. The mechanics-only and pressure/thermal/reaction stage-chain rows
  report `stateFamilyConflictPolicy=defer-read-write-conflicting-ready-stages`
  and zero conflict deferrals for the current accepted batch layout.
- Fast physics atomics:
  `npm run test:physics-atomics` passed `11` checks with `3` expected opt-in
  skips.
- Recurring visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-state-family-conflict-batching-20260617 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,solid-h2o-cpu-sph,law-pressure-off-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, empty issue counts, and two frames each under
  `/tmp/ulg-visual-sanity-matrix/codex-state-family-conflict-batching-20260617`.

## Current Focused Result - 2026-06-17 Worker-Retained Continuation Planner

Worker-retained publications now have a consumer-side continuation plan instead
of relying only on caller intent. The authority host can resolve a hot-buffer
publication, validate its access contract, and report whether a same-Worker
retained-ref continuation is ready.

Focused checks:

- Syntax:
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`, and
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs` passed.
- ULG PeerCompute integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "worker-retained mechanics output descriptors|ULG resident solver descriptors publish executable pass-DAG"`
  passed `16/16`. The new assertions prove
  `host.planWorkerRetainedContinuation()` returns
  `same-worker-retained-continuation-ready` for a mechanics publication with
  `sph-particle-state` and `mls-mpm-mechanics`, blocks when required families
  are absent, and threads an explicit continuation plan into Worker stage
  context plus mechanics stage-chain telemetry.
- Fast physics atomics:
  `npm run test:physics-atomics` passed `11` checks with `3` expected opt-in
  long-horizon skips.
- Recurring visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-worker-retained-continuation-plan-20260617 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,solid-h2o-cpu-sph,law-pressure-off-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, empty issue counts, and two frames each under
  `/tmp/ulg-visual-sanity-matrix/codex-worker-retained-continuation-plan-20260617`.

## Current Focused Result - 2026-06-17 GPU Resident Stage Dependency Batches

GPU resident lane contracts now carry explicit stage dependencies for the
MLS-MPM mechanics law chain, and sibling PeerCompute can execute ready batches
under one resident lane stage plan while preserving sequential fallback for old
contracts.

Focused checks:

- PeerCompute lane manager syntax:
  `/home/cos/projects/peercompute/peercompute/src/peercompute/computeManager/GpuResidentLaneManager.js`
  and
  `/home/cos/projects/peercompute/peercompute/tests/unit/gpuResidentLaneManager.test.js`
  passed `node --check`.
- PeerCompute lane manager coverage:
  `node --test tests/unit/gpuResidentLaneManager.test.js` passed `8/8`. The
  new dependency-batch test proves `p2g` and `pressureInterface` start in the
  same ready batch, `gridUpdate` waits for both, `g2p` waits for `gridUpdate`,
  and the execution report records `maxConcurrentStageCount=2`.
- ULG integration syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js` and
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs` passed.
- ULG PeerCompute integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs` passed
  `16/16`. The mechanics-only lane reports dependency batches
  `[['p2g'], ['gridUpdate'], ['g2p']]`; the pressure/thermal/reaction lane
  reports
  `[['p2g', 'pressureInterface'], ['gridUpdate'], ['g2p'], ['thermalPhase'], ['reactionProduct']]`.
- Fast physics atomics:
  `npm run test:physics-atomics` passed `11` checks with `3` expected
  opt-in long-horizon skips.
- Recurring visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-stage-dependency-batches-20260617 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,solid-h2o-cpu-sph,law-pressure-off-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, empty issue counts, and two frames each under
  `/tmp/ulg-visual-sanity-matrix/codex-stage-dependency-batches-20260617`.

## Current Focused Result - 2026-06-17 Worker-Retained Access Contract

Worker-retained law-family publications now carry an explicit access contract
that distinguishes Worker-private retained refs from same-device main-thread
hot-buffer aliases. This prevents later schedulers from treating Worker-local
GPU refs as local WebGPU handles, while still allowing ComputeManager/GPUHub to
schedule same-Worker continuations.

Focused checks:

- Syntax:
  `node --check src/runtime/peercomputeBrowserResidentHost.js` and
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs` passed.
- PeerCompute authority-host coverage:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "worker-retained mechanics output descriptors|worker-retained reaction/product output descriptors|worker-retained pressure/interface force-row descriptors"`
  passed `16/16`. The focused mechanics test asserts
  `peercompute.ulg.worker-retained-access-contract.v0`,
  `workerContinuationRequired=true`,
  `mainThreadGpuHandlesAvailable=false`, empty `localBufferRefs`, and
  same-Worker retained-ref consumer mode.
- Fast physics atomics:
  `npm run test:physics-atomics` passed `11` checks with `3` expected
  opt-in long-horizon skips.
- Recurring visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-worker-retained-contract-20260617 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,solid-h2o-cpu-sph,law-pressure-off-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, empty issue counts, and two frames each under
  `/tmp/ulg-visual-sanity-matrix/codex-worker-retained-contract-20260617`.

## Current Focused Result - 2026-06-17 Resident Render-Field Surface Unclipping

Resident MLS-MPM render-field surfaces now preserve the current
MarchingCubes geometry instead of clipping visible vertices back to particle
bounds. Particle-bounds checks remain diagnostic/validation gates, stale
surface retention still checks current bounds, and container clipping still
keeps surfaces inside the box. The probe records resident render-field cell
size so CPU and resident surface envelopes use comparable sampling slack.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js` and
  `node --check scripts/sph-long-horizon-probe.mjs` passed.
- Diff whitespace:
  `git diff --check` passed.
- Renderer coverage:
  `node --test tests/sphPhaseRenderer.test.mjs` passed `35/35`.
- Resident MLS-MPM visual row:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-mlsmpm-h2o-unclipped-renderfield-cellslack-20260617 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=4 ULG_VISUAL_MATRIX_BATCH_STEPS=512 ULG_VISUAL_MATRIX_FRAME_MAX=5 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=600000 ULG_PROBE_EXPECT_LIQUID_FREE_SURFACE=1 ULG_PROBE_LIQUID_FREE_SURFACE_MIN_TIME_S=1 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, empty issue counts, one H2O visible surface,
  component count `1`, final tallness `0.4877`, footprint fill `0.3562`,
  `maxVisibleSurfaceOutsideParticleBoundsM=0`, and five frames under
  `/tmp/ulg-visual-sanity-matrix/codex-mlsmpm-h2o-unclipped-renderfield-cellslack-20260617/liquid-liquid-h2o-mlsmpm-frames`.
  Final H2O metadata reported `renderSource=resident-gpu-render-field`,
  `renderFieldResolution=64`, `renderFieldCellSizeM=0.1417`,
  `surfaceBoundsClipStatus=surface-bounds-diagnostic-current-render-field`,
  `surfaceBoundsClipVertexCount=0`, `transparent=false`, `depthWrite=true`,
  and `renderOrderPolicy=stable-opaque-layer-order`.

## Current Focused Result - 2026-06-17 Transmissive H2O Depth Policy

Condensed transmissive water now uses Three's physical transmission path as
depth-writing glass, not alpha blending. H2O liquid surfaces report
`transparent=false`, `depthWrite=true`, `depthTest=true`,
`renderLayer=transmissive-surface`, and
`renderOrderPolicy=stable-opaque-layer-order`; vapor and true alpha opacity
surfaces remain non-depth-writing and depth-sortable.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`,
  `node --check scripts/sph-visual-sanity-matrix.mjs`,
  `node --check tests/sphPhaseRenderer.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- Renderer coverage:
  `node --test tests/sphPhaseRenderer.test.mjs` passed `35/35`.
- Short CPU-SPH visual row:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-cpu-sph-h2o-depthwrite-short-2-20260617 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=4 ULG_VISUAL_MATRIX_BATCH_STEPS=24 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with empty issue counts and H2O depth-writing transmissive metadata.
- Long CPU-SPH visual row:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-cpu-sph-h2o-depthwrite-long-20260617 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=144 ULG_VISUAL_MATRIX_BATCH_STEPS=24 ULG_VISUAL_MATRIX_FRAME_MAX=6 ULG_VISUAL_MATRIX_FRAME_EVERY=36 ULG_VISUAL_MATRIX_TIMEOUT_MS=600000 ULG_PROBE_EXPECT_LIQUID_FREE_SURFACE=1 ULG_PROBE_LIQUID_FREE_SURFACE_MIN_TIME_S=1 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, one H2O visible surface, component count `1`,
  final tallness `0.5821`, footprint fill `0.2960`, empty visual issues, and
  five frames under
  `/tmp/ulg-visual-sanity-matrix/codex-cpu-sph-h2o-depthwrite-long-20260617/liquid-liquid-h2o-cpu-sph-frames`.
- Resident MLS-MPM visual row:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-mlsmpm-h2o-depthwrite-merge-20260617 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=4 ULG_VISUAL_MATRIX_BATCH_STEPS=512 ULG_VISUAL_MATRIX_FRAME_MAX=5 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=600000 ULG_PROBE_EXPECT_LIQUID_FREE_SURFACE=1 ULG_PROBE_LIQUID_FREE_SURFACE_MIN_TIME_S=1 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, one H2O visible surface, component count `1`,
  final tallness `0.4403`, footprint fill `0.1815`, empty visual issues, and
  five frames under
  `/tmp/ulg-visual-sanity-matrix/codex-mlsmpm-h2o-depthwrite-merge-20260617/liquid-liquid-h2o-mlsmpm-frames`.

## Current Focused Result - 2026-06-15 CPU-SPH Free-Surface Remediation

The CPU-SPH reference lane now has a reduced free-surface mechanics closure for
floor-supported liquid groups. This is a low-resolution pressure/free-surface
projection, not renderer deformation: it mutates particle positions through the
SPH carrier and is guarded by particle-space and browser visual metrics.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphPhaseCarrier.js`,
  `node --check src/runtime/sphPhaseDemo.js`, and
  `node --check tests/physicsBehaviorInvariants.test.mjs` passed.
- Diff whitespace:
  `git diff --check` passed.
- Fast physics atomics:
  `npm run test:physics-atomics` passed `11` checks with `2` expected opt-in
  skips before the long gate.
- Opt-in long liquid atomics:
  `ULG_RUN_LONG_LIQUID_ATOMIC=1 npm run test:physics-liquid-atomic` passed
  `13/13`. The plain-SPH long gate now asserts particle-space tallness
  `<=0.75` and footprint fill `>=0.15` in the 5m visual fixture.
- Long browser visual row:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-cpu-sph-free-surface-fix-long-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=144 ULG_VISUAL_MATRIX_BATCH_STEPS=24 ULG_VISUAL_MATRIX_FRAME_MAX=8 ULG_VISUAL_MATRIX_FRAME_EVERY=18 ULG_VISUAL_MATRIX_TIMEOUT_MS=600000 ULG_PROBE_EXPECT_LIQUID_FREE_SURFACE=1 ULG_PROBE_LIQUID_FREE_SURFACE_MIN_TIME_S=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, empty issue counts, one connected H2O surface,
  last H2O tallness `0.5821`, last footprint fill `0.2960`, and eight frame
  artifacts under
  `/tmp/ulg-visual-sanity-matrix/codex-cpu-sph-free-surface-fix-long-20260615/liquid-liquid-h2o-cpu-sph-frames`.

## Current Focused Result - 2026-06-15 Free-Surface Shape Gate

The visual probe now records same-material H2O liquid free-surface shape
metrics and can turn them into opt-in liquid-quality failures. This catches the
current "one connected but blocky water blob" failure that component metrics
alone cannot classify as bad.

Focused checks:

- Syntax:
  `node --check scripts/sph-long-horizon-probe.mjs` and
  `node --check scripts/sph-visual-sanity-matrix.mjs` passed.
- Diff whitespace:
  `git diff --check` passed.
- Corrected H2O free-surface gate baseline:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-free-surface-gate-h2o-short-fixedsummary-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=4 ULG_VISUAL_MATRIX_BATCH_STEPS=24 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 ULG_PROBE_EXPECT_LIQUID_FREE_SURFACE=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  completed with the expected `failedCount=2`. Both rows reported one
  connected H2O surface and no visual-surface issues, but failed
  `liquid-free-surface-duration<0.25`,
  `liquid-free-surface-tallness>0.75`, and
  `liquid-free-surface-footprint-fill<0.15`. MLS-MPM ended at tallness
  `1.3969` and footprint fill `0.0497`; CPU-SPH ended at tallness `1.1568`
  and footprint fill `0.1076`.

## Current Focused Result - 2026-06-15 Surface Component Metrics

The visual probe now records connected-component metrics for active
MarchingCubes geometry: component count, largest component vertex ratio, and
small-component count. This helps distinguish actual disconnected fragments
from a single connected but physically wrong free surface.

Focused checks:

- Syntax:
  `node --check scripts/sph-long-horizon-probe.mjs` and
  `node --check scripts/sph-visual-sanity-matrix.mjs` passed.
- Short H2O baseline:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-surface-components-h2o-baseline-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=4 ULG_VISUAL_MATRIX_BATCH_STEPS=24 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed both rows with one visible H2O surface, component count `1`, no small
  components, and largest-component ratio `1`.
- Medium MLS-MPM H2O probe:
  `codex-mlsmpm-h2o-medium-components-20260615` passed status `good` with one
  connected H2O surface and eight frames, but manual inspection of
  `/tmp/ulg-frame-check/mlsmpm-h2o-medium-components-20260615/0007-b042-resident-batch.png`
  showed the remaining failure is blocky/tall liquid free-surface shape rather
  than disconnected mesh pieces.

## Current Focused Result - 2026-06-15 Render Depth/Order Matrix Gate

The recurring visual sanity matrix now treats renderer depth/order metadata as
acceptance evidence. Screenshots are no longer enough: visible surfaces must
report coherent render layer/order/depth policy, and container grid/wire
overlays must keep their non-depth-writing order.

Focused checks:

- Syntax:
  `node --check scripts/sph-long-horizon-probe.mjs` and
  `node --check scripts/sph-visual-sanity-matrix.mjs` passed.
- Renderer coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "transparent|draw order|depth|render order"`
  passed `35/35`.
- CPU-SPH liquid visual row:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-render-depth-policy-cpu-sph-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=2 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=180000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, empty issue counts, and three frames.
- Mixed opaque/transparent visual row:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-render-depth-policy-solid-liquid-20260615 ULG_VISUAL_MATRIX_SCENARIOS=solid-liquid-contact-fe-h2o ULG_VISUAL_MATRIX_BATCHES=2 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=180000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, empty issue counts, and three frames. Spot
  check: H2O reported `transmissive-surface`, `depthWrite=false`,
  `depthTest=true`, `renderOrder=renderOrderBase=200`, and
  `three-transparent-depth-sort-within-layer`; Fe reported `opaque-surface`,
  `depthWrite=true`, and `stable-opaque-layer-order`; grid/wire reported
  `depthWrite=false`, `depthTest=true`.
- Fresh combined visual row:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-render-depth-policy-two-row-refresh-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-cpu-sph,solid-liquid-contact-fe-h2o ULG_VISUAL_MATRIX_BATCHES=2 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=180000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed both rows with `failedCount=0`, empty issue counts, empty
  visual-surface issue counts, and three frames per row.

## Current Focused Result - 2026-06-15 Plain SPH Liquid Settling

The current slice fixes the long-horizon CPU-SPH same-material liquid settling
failure that produced delayed falling, stacked/nested water, and residual bulk
motion. The fix is physics-side: finite-volume wall contact cancels gravity
half-kicks, and explicit liquid viscosity/wall damping is law-gated by the
viscosity group.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphPhaseCarrier.js`,
  `node --check src/runtime/sphPhaseDemo.js`, and
  `node --check tests/physicsBehaviorInvariants.test.mjs` passed.
- Physics atomics:
  `npm run test:physics-atomics` passed `11` checks with `2` expected opt-in
  long-horizon skips.
- Opt-in long liquid atomics:
  `ULG_RUN_LONG_LIQUID_ATOMIC=1 npm run test:physics-liquid-atomic` passed
  `13/13`, including the new plain-SPH long-horizon merge/settle gate.
- Short visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-cpu-sph-liquid-viscosity-short-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=4 ULG_VISUAL_MATRIX_BATCH_STEPS=24 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, empty issue counts, one H2O visible surface, and
  three frames.
- Long mounted browser probe:
  `codex-cpu-sph-h2o-long-after-sph-viscosity-20260615` passed with status
  `good`, no analysis or visual-surface issues, H2O visible surface count
  `1 -> 1`, final drop speed about `0.246 m/s`, and ten frames under
  `/tmp/ulg-frame-check/cpu-sph-h2o-long-after-sph-viscosity-20260615`.

## Current Focused Result - 2026-06-15 CPU Liquid Surface Merge

The current slice fixes CPU MarchingCubes surface identity for same-material
liquid domains. CPU-rendered liquids merge base/drop render domains into one
visible material/phase surface; same-material solids stay separate so static
support/contact scenarios can still show distinct blocks.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`, and
  `node --check scripts/sph-visual-sanity-matrix.mjs` passed.
- Renderer coverage:
  `node --test tests/sphPhaseRenderer.test.mjs` passed `35/35`, including the
  new CPU liquid-domain merge regression and MarchingCubes cell-size metadata
  assertion.
- Targeted CPU-SPH H2O visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-cpu-liquid-merge-surface-short-cellslack-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=4 ULG_VISUAL_MATRIX_BATCH_STEPS=24 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, empty issue counts, H2O visible surface count
  `1 -> 1`, and three frame artifacts.
- Public/default Na/H2O visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-default-na-h2o-plain-sph-blob1-20260615 ULG_VISUAL_MATRIX_SCENARIOS=reaction-product-na-h2o ULG_VISUAL_MATRIX_BATCHES=4 ULG_VISUAL_MATRIX_BATCH_STEPS=24 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, `mechanicsIntegrator=sph`, both blocks at
  `293.15 K`, `blob=1`, empty visual issues, and three frame artifacts.
- Pages build:
  `npm run build:pages` passed and regenerated `docs/`.

## Current Focused Result - 2026-06-15 Full Visual Matrix Baseline

After the plain-SPH pressure partition and stale CPU-surface invalidation
fixes, the full short-horizon visual matrix is clean.

Evidence:

- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-full-after-sph-partition-and-stale-surface-20260615 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `scenarioCount=12`, `failedCount=0`, empty `issueCounts`, empty
  `visualSurfaceIssueCounts`, and three captured frames for every scenario.
- Representative values: MLS-MPM H2O/H2O `J=0.999682..1.036141`, CPU-SPH
  H2O/H2O max speed about `0.282 m/s`, solid H2O max displacement about
  `1.19e-7 m`, Na/H2O reaction max speed about `0.541 m/s`, and all pressure
  impulse summaries `0`.
- Manual frame inspection: Na/H2O is bounded with no stale Na surface; CPU-SPH
  H2O/H2O is bounded but still shows two stacked H2O surfaces at the sampled
  horizon, so long-horizon liquid merge/free-surface quality remains open.

## Current Focused Result - 2026-06-15 CPU Surface Invalidation

The current slice fixes stale CPU MarchingCubes surfaces after reaction-driven
material changes. CPU-particle surfaces hide immediately when their
material/phase batch disappears; retained grace remains for resident
render-field gaps.

Focused checks:

- Syntax: `node --check src/visualization/sphPhaseScene.js` passed.
- Renderer coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "inactive grace|hide empty surfaces"`
  passed `34/34` renderer tests.
- Diff check: `git diff --check` passed.
- Targeted browser visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-sph-reaction-roomtemp-blob1-no-stale-na-20260615 ULG_VISUAL_MATRIX_SCENARIOS=reaction-product-na-h2o ULG_VISUAL_MATRIX_BATCHES=4 ULG_VISUAL_MATRIX_BATCH_STEPS=24 ULG_VISUAL_MATRIX_FRAME_MAX=5 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, empty issue counts, empty visual-surface issue
  counts, five captured frames, `maxVisibleSurfaceOutsideParticleBoundsM=0`,
  `maxSpeedObservedMPerS=0.5410316601618764`, pressure impulse `0`, and H2O
  visible surface count `1 -> 1`.

## Current Focused Result - 2026-06-15 Plain SPH Condensed Pressure Partition

The current slice fixes the plain SPH/PBF participant contract. Only
thermodynamic liquid particles should enter condensed SPH density, pressure,
and PBF projection; solids and reaction gases must remain represented without
acting as liquid pressure mass.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphPhaseCarrier.js`,
  `node --check src/runtime/sphPhaseDemo.js`,
  `node --check tests/physicsBehaviorInvariants.test.mjs`, and
  `node --check scripts/sph-visual-sanity-matrix.mjs` passed.
- Physics atomics:
  `npm run test:physics-atomics` passed `10` checks with `1` expected opt-in
  long-horizon liquid skip.
- Targeted browser visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-sph-reaction-roomtemp-blob1-20260615 ULG_VISUAL_MATRIX_SCENARIOS=reaction-product-na-h2o ULG_VISUAL_MATRIX_BATCHES=4 ULG_VISUAL_MATRIX_BATCH_STEPS=24 ULG_VISUAL_MATRIX_FRAME_MAX=5 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  completed and captured five frames. The old physics failure is gone:
  `maxSpeedObservedMPerS=0.5410316601618764`,
  `maxPressureImpulseNSeconds=0`, H2O visible surface count `1 -> 1`, and
  mechanics integrator `sph`. The run still classified bad only because the Na
  solid surface exceeded particle bounds by about `0.102 m` after
  support-radius/tolerance expansion; keep that under renderer/probe
  surface-envelope work.

## Current Focused Result - 2026-06-15 Plain SPH No-force Law Isolation

The current slice fixes the plain SPH/PBF law-toggle contract. Density
projection is an incompressibility/EOS-family constraint, so the reference SPH
lane must not run it when the EOS law group is disabled. The matrix
`law-static-gravity-off-fe-h2o` scenario now disables gravity, EOS, pressure,
viscosity, thermal, reactions, and surface tension so it is a true no-force
isolation test.

Focused checks:

- Syntax:
  `node --check src/runtime/sphPhaseDemo.js`,
  `node --check tests/physicsBehaviorInvariants.test.mjs`, and Node version
  `v24.16.0` passed.
- Physics atomics:
  `npm run test:physics-atomics` passed `8` checks with `1` expected opt-in
  long-horizon liquid skip. The new invariant is
  `plain SPH/PBF reference stays static when gravity and EOS laws are disabled`;
  it asserts `sphDensityProjectionIterations === 0`, zero speed, and zero
  displacement after 16 steps.
- Focused browser visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-gravity-off-static-no-force-after-eos-gate-20260615 ULG_VISUAL_MATRIX_SCENARIOS=law-static-gravity-off-fe-h2o ULG_VISUAL_MATRIX_BATCHES=4 ULG_VISUAL_MATRIX_BATCH_STEPS=24 ULG_VISUAL_MATRIX_FRAME_MAX=5 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, empty issue counts, `maxSpeedObservedMPerS=0`,
  `maxDisplacementObservedM=0`, and five PNG frames under
  `/tmp/ulg-visual-sanity-matrix/codex-gravity-off-static-no-force-after-eos-gate-20260615/law-static-gravity-off-fe-h2o-frames`.

## Current Focused Result - 2026-06-15 Surface Radius Bounds Gate

The current slice fixes the visual probe's surface bounds acceptance rule. A
continuous/MarchingCubes surface is expected to extend beyond particle centers
by its rendered support radius. The probe now inflates particle bounds by
`particleBoundsToleranceM + max(surfaceRadiusM, requestedSurfaceRadiusM,
cpuMarchingCubesRadiusFloorM)` before flagging
`visible-surface-expanded-beyond-particle-bounds`; outside-box and
larger-than-box checks are unchanged.

Focused checks:

- Syntax:
  `node --check scripts/sph-long-horizon-probe.mjs` and
  `node --check scripts/sph-visual-sanity-matrix.mjs` passed.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Surface-radius visual smoke:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-surface-radius-bounds-smoke-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=2 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed with `failedCount=0`, empty issue counts, frame artifact status
  `ready`, and `frameCount=2`.
- Focused H2O visual trio:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-surface-radius-bounds-trio-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, empty issue counts, frame artifact status
  `ready`, and two PNG frames per scenario.

## Current Focused Result - 2026-06-15 Dense Visual Matrix Summaries

The current slice fixes the visual matrix as a validation harness. Matrix runs
now capture close-spaced PNG frame artifacts by default and copy the probe's
actual `analysis.issues` into the matrix summary. The summary also records
compact visual-surface issue details, issue counts, frame artifact status,
observed motion/J/pressure metrics, visible H2O surface counts, and maximum
surface overflow. This turns failed matrix runs into actionable physics
evidence instead of only `status=bad` rows.

Focused checks:

- Syntax and listing:
  `node --check scripts/sph-visual-sanity-matrix.mjs` and
  `node scripts/sph-visual-sanity-matrix.mjs --list` passed.
- Visual summary smoke:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-visual-summary-issues-smoke-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=2 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  completed with expected `failedCount=1`. The summary now reports
  `captureFrames=true`, issue count
  `visible-surface-expanded-beyond-particle-bounds=1`, visual surface issue
  count `2`, frame artifact status `ready`, and `frameCount=2`.
- Frame artifact inspection:
  `/tmp/ulg-visual-sanity-matrix/codex-visual-summary-issues-smoke-20260615/liquid-liquid-h2o-cpu-sph-frames`
  contains two non-empty PNGs. Manual inspection of the final frame showed a
  nonblank scene with detached/stacked H2O blobs, matching the summary failure.

## Current Focused Result - 2026-06-15 Positioned Product-Event Spatial Gas Ledger

The current slice replaces the temporary sealed-box bridge in the mounted
no-full Na/H2O gate with a positioned spatial gas ledger derived from retained
product-event rows. The WebGPU compact stage now transcodes product-event rows
into the compact spatial-gas row ABI, while the decoder filters inactive,
non-gas, zero-mole, zero-support, or non-finite-position rows. Per-row support
volume can still fall back to a derived box-volume/event-count share when the
retained product row omits support, but ledger derivation stays
`positioned-product-event-rows` and position source stays
`resident-product-event-row-positions`.

Focused checks:

- Syntax and whitespace:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js` and `git diff --check`
  passed.
- Focused SPH stage coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "spatial gas ledger|gas-cell EOS producer before pressureInterface|gas-cell EOS producer stage publishes"`
  passed `48/48`.
- Focused scene gas-cell coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "spatial gas ledger producer|gas-cell EOS producer|gas-cell import|gas-cell field"`
  passed `34/34`.
- Worker pressure/gas coverage:
  `node --test tests/ulgMechanicsResidentStageWorker.test.mjs --test-name-pattern "spatial gas ledger|gas-cell EOS producer|pressure interface"`
  passed `6/6`.
- PeerCompute pressure/gas coverage:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "spatial gas|gas-cell|EOS producer|pressure interface"`
  passed `15/15`.
- Mounted Na/H2O browser gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs tests/demo.e2e.mjs --grep "SPH phase mounted resident Na/H2O promotes product gas pressure"`
  passed `1/1` in about `1.1m`. The gate now asserts aggregate fallback
  `false`, `positioned-product-event-rows`,
  `resident-product-event-row-positions`, gas-cell EOS producer ready, and
  admitted pressure gas-cell import ready without full product-event readback.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Public defaults and Pages build:
  a fresh browser probe confirmed mechanics `sph`, drop `Na`, base `h2o`,
  drop/base temperatures `293.15`, and blob `1`; `npm run build:pages` passed.
- Post-slice full visual matrix:
  `npm run probe:sph-visual-matrix` wrote
  `/tmp/ulg-visual-sanity-matrix/2026-06-15T18-36-32-215Z` and failed `11/12`.
  The failure is retained as open visual/physics debt. Summary issue arrays
  were empty, but individual scenario logs show repeated
  `visible-surface-expanded-beyond-particle-bounds` findings; Na/H2O still
  shows high-speed reaction motion. Visual frame artifact capture was disabled
  for that run, so it is a classification/diagnostic gate, not final visual
  sequence evidence.

## Current Focused Result - 2026-06-15 Spatial Gas Ledger Producer Fallback

The current slice makes the mounted no-full Na/H2O pressure path complete
without full product-event readback by adding an explicit aggregate-gas bridge
inside `spatialGasLedgerProducer`. Positioned compact product-event rows still
produce normal spatial gas cells. If compact rows are inactive/positionless but
the resident aggregate gas species ledger is ready, the producer emits a
one-cell sealed-box spatial ledger with provenance
`aggregate-gas-ledger-single-cell-sealed-box` and position source
`aggregate-gas-ledger-no-positioned-product-events`. The scene pressure-
interface summary exposes that provenance so browser tests can assert that the
path is unblocked but not a true local plume.

Focused checks:

- Syntax and whitespace:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check src/visualization/sphPhaseDemoMount.js`,
  `node --check tests/sphMlsMpmGpuStep.test.mjs`,
  `node --check tests/demo.e2e.mjs`, and `git diff --check` passed.
- Focused SPH stage coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "spatial gas ledger|gas-cell EOS producer before pressureInterface|gas-cell EOS producer stage publishes"`
  passed `47/47`.
- Focused scene gas-cell coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "spatial gas ledger producer|gas-cell EOS producer|gas-cell import|gas-cell field"`
  passed `34/34`.
- Mounted Na/H2O browser gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "mounted resident Na/H2O promotes product gas pressure"`
  passed `1/1` in about `59s`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-spatial-gas-ledger-producer-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`, and
  `visualSurfaceIssues=[]` under
  `/tmp/ulg-visual-sanity-matrix/codex-spatial-gas-ledger-producer-20260615`.
  Manual inspection found nonblank bounded frames; MLS-MPM H2O remains
  fragmented and CPU-SPH liquid/solid remain stacked/blob-shaped.
- Default UI probe:
  fresh browser context at `https://127.0.0.1:5173/?sph=1` reported
  mechanics `sph`, drop `Na`, base `h2o`, drop/base temperatures `293.15`,
  and blob `1`.
- GitHub Pages build:
  `npm run build:pages` passed and produced `docs/index.html`,
  `docs/assets/pages-vPnFh9Yy.js`, `docs/assets/pages-DwBf2e9n.css`, and
  `docs/.nojekyll`.

## Current Focused Result - 2026-06-15 Product-Event Spatial Ledger Source

The current slice preserves compact positioned product-event records on
resident product-mass handles and lets the preferred resident product-mass gas
ledger pressure path derive a spatial gas species ledger from those records
when they exist. It also updates the mounted Na/H2O browser gate to expose the
remaining no-full blocker: retained product-event rows exist, but CPU-side
event records are absent, so the spatial ledger and gas-cell EOS producer
still fail closed in the no-full hot path.

Focused checks:

- Syntax and whitespace:
  `git diff --check`,
  `node --check src/runtime/sphPhaseDemo.js`,
  `node --check src/runtime/sph/sphReactionGpuSummary.js`,
  `node --check tests/sphPhaseDemo.test.mjs`,
  `node --check tests/sphReactionGpuSummary.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- Focused pressure coverage:
  `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "spatial gas|resident product-mass gas ledger|resident positioned gas|resident reaction gas pressure"`
  passed `30/30`.
- Focused reaction-summary coverage:
  `node --test tests/sphReactionGpuSummary.test.mjs --test-name-pattern "resident product mass handle|product event"`
  passed `9/9`.
- Mounted Na/H2O browser gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "mounted resident Na/H2O promotes product gas pressure"`
  passed `1/1` in about `52s`; the gate now asserts product-event rows are
  retained but event records are unavailable, spatial ledger is blocked, the
  producer request is blocked, and snapshot gas-cell import is disabled.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-product-event-spatial-ledger-source-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`, and
  `visualSurfaceIssues=[]` under
  `/tmp/ulg-visual-sanity-matrix/codex-product-event-spatial-ledger-source-20260615`.
  Manual inspection found bounded nonblank frames, but MLS-MPM H2O remained
  fragmented and CPU-SPH liquid/solid remained stacked/blob-shaped.

## Current Focused Result - 2026-06-15 Mounted No-Snapshot Gas-Cell Imports

The current slice removes the mounted pressure-interface hot path's fallback
that published gas-cell imports directly from `gasPressureSummary` snapshots.
The helper still allows snapshot imports by default for explicit compatibility
callers, but mounted refresh now passes `allowSummaryGasCellFieldImport=false`
so imports must come from a supplied admitted import or a resident
`gasCellEosProducer` result.

Focused checks:

- Syntax and whitespace:
  `git diff --check`,
  `node --check src/visualization/sphPhaseScene.js`, and
  `node --check tests/sphPhaseRenderer.test.mjs` passed.
- Scene gas-cell coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "summary-snapshot|gas-cell EOS producer|gas-cell import|gas-cell field"`
  passed `33/33`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Browser PeerCompute resident authority-host gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "real browser PeerCompute resident authority host"`
  passed `1/1` in about `1.4m`.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-mounted-no-snapshot-gas-import-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`, and
  `visualSurfaceIssues=[]` under
  `/tmp/ulg-visual-sanity-matrix/codex-mounted-no-snapshot-gas-import-20260615`.
  Manual inspection found bounded nonblank frames, but MLS-MPM H2O remained
  fragmented and CPU-SPH liquid/solid remained stacked/blob-shaped.

## Current Focused Result - 2026-06-15 Mounted Gas-Cell EOS Hot Loop

The current slice wires the mounted resident pressure-interface refresh to
request `gasCellEosProducer` through the resident authority host when a ready
spatial gas species ledger exists. The scene remains a requester and telemetry
surface: blocked requests report missing ledgers or missing host submitters,
ready submissions feed the existing host-published gas-cell admission/import
helper, and resident pressure-interface state exposes request status, blocker,
retained source readiness, and spatial ledger cell count.

Focused checks:

- Syntax and whitespace:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check tests/sphPhaseRenderer.test.mjs`, and `git diff --check`
  passed.
- Scene gas-cell coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "gas-cell EOS producer|gas-cell import|gas-cell field"`
  passed `32/32`.
- Broader pressure/gas coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "gas-cell EOS|pressure interface stage .*gas-cell|pressure interface stage declares retained gas-cell|gas-cell field import|pressure interface stage compute task can produce force rows|gas-cell EOS producer before pressureInterface"`
  passed `45/45`.
- PeerCompute integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "EOS producer|gas-cell field imports|worker-retained pressure/interface"`
  passed `15/15`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Browser PeerCompute resident authority-host gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "real browser PeerCompute resident authority host"`
  passed `1/1` in about `1.3m`.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-mounted-gas-eos-hot-loop-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`, and
  `visualSurfaceIssues=[]` under
  `/tmp/ulg-visual-sanity-matrix/codex-mounted-gas-eos-hot-loop-20260615`.
  Manual inspection found bounded nonblank frames, but MLS-MPM H2O remained
  fragmented and CPU-SPH liquid/solid remained stacked/blob-shaped.

## Current Focused Result - 2026-06-15 Gas-Cell EOS Stage-Chain Import Wiring

The current slice wires `gasCellEosProducer` into the opt-in ComputeManager
mechanics stage-chain before pressureInterface. The chain can publish the
producer's retained gas-cell field through the resident authority host,
admit/import it for pressureInterface, and preserve pressure feedback derivation
from the producer-enriched gas-pressure summary instead of constructing a
partial synthetic feedback object.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/services/ulgMechanicsResidentStage.worker.js`,
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check tests/sphMlsMpmGpuStep.test.mjs`, and
  `node --check tests/sphPhaseRenderer.test.mjs` passed.
- Focused stage-chain and scene coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "gas-cell EOS producer before pressureInterface"`
  passed `45/45`, and
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "producer result source"`
  passed `30/30`.
- Broader pressure/gas coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "gas-cell EOS|pressure interface stage .*gas-cell|pressure interface stage declares retained gas-cell|gas-cell field import|pressure interface stage compute task can produce force rows|gas-cell EOS producer before pressureInterface"`
  passed `45/45`.
- Scene gas-cell coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "gas-cell"`
  passed `30/30`.
- PeerCompute integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "EOS producer|gas-cell field imports|worker-retained pressure/interface"`
  passed `15/15`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Browser PeerCompute resident authority-host gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "real browser PeerCompute resident authority host"`
  passed `1/1`.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-gas-eos-stage-chain-live-wire-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`, and
  `visualSurfaceIssues=[]`. Manual inspection found bounded nonblank frames,
  but MLS-MPM H2O fragmentation and CPU-SPH stacked/blob shapes remain open.

## Current Focused Result - 2026-06-15 Resident Gas-Cell EOS Producer Stage

The current slice adds a ComputeManager/GPUHub stage surface for resident
gas-cell EOS production. The stage derives the local gas-cell pressure field
from the spatial gas species ledger, packs the shared 12-float
gas-pressure-cell ABI, uploads/retains that row buffer on WebGPU when
requested, and emits a retained gas-cell field source descriptor that the
resident authority host can admit/import for pressureInterface.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/services/ulgMechanicsResidentStage.worker.js`,
  `node --check tests/sphMlsMpmGpuStep.test.mjs`,
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`, and
  `node --check tests/ulgMechanicsResidentStageWorker.test.mjs` passed.
- Worker coverage:
  `node --test tests/ulgMechanicsResidentStageWorker.test.mjs --test-name-pattern "gas-cell EOS|pressure interface"`
  passed `5/5`.
- SPH stage coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "gas-cell EOS|pressure interface stage .*gas-cell|pressure interface stage declares retained gas-cell|gas-cell field import|pressure interface stage compute task can produce force rows"`
  passed `44/44`.
- PeerCompute integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "EOS producer|gas-cell field imports|worker-retained pressure/interface"`
  passed `15/15`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Browser PeerCompute resident authority-host gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "real browser PeerCompute resident authority host"`
  passed `1/1`.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-resident-gas-cell-eos-producer-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`, and
  `visualSurfaceIssues=[]`. Manual inspection found final frames nonblank and
  bounded; MLS-MPM fragmentation and CPU SPH stacked/blob behavior remain
  open.

## Current Focused Result - 2026-06-15 Retained Gas-Cell Source Consumption

The current slice lets pressure/interface gas-cell admission and import
publication consume
`peercompute.ulg.pressure-interface-retained-gas-cell-field-source.v0`
directly. The host derives retained gas-pressure refs and row metadata from
the descriptor, preserves it through StateManager hot/warm records, and ignores
empty caller ref arrays when descriptor refs are available. The pressure import
still carries a local gas-cell snapshot for the current oracle path.

Focused checks:

- Syntax:
  `node --check src/runtime/peercomputeBrowserResidentHost.js` and
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs` passed.
- PeerCompute integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "gas-cell field imports|worker-retained pressure/interface"`
  passed `14/14`.
- Pressure stage coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage .*gas-cell|pressure interface stage declares retained gas-cell|gas-cell field import|pressure interface stage compute task can produce force rows"`
  passed `43/43`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Browser PeerCompute resident authority-host gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "real browser PeerCompute resident authority host"`
  passed `1/1`.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-retained-gas-cell-source-consumption-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`, and
  `visualSurfaceIssues=[]`. Manual inspection found final frames nonblank and
  bounded; MLS-MPM fragmentation and CPU SPH stacked/blob behavior remain
  open.

## Current Focused Result - 2026-06-15 Retained Gas-Cell Field Source

The current slice adds a StateManager-visible retained gas-cell field source
descriptor to the pressure/interface Worker publication path. When a
local-gradient pressure stage has worker/local retained gas-cell buffer refs,
the publication now carries
`peercompute.ulg.pressure-interface-retained-gas-cell-field-source.v0` through
the candidate, worker-retained import, hot record, warm delta, and stage-chain
summary.

Focused checks:

- Syntax:
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`, and
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs` passed.
- PeerCompute integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "worker-retained pressure/interface|resident pass-DAG task runs through real PeerCompute GPU lane authority"`
  passed `14/14`.
- Pressure stage coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage .*gas-cell|pressure interface stage declares retained gas-cell|pressure interface stage compute task can produce force rows"`
  passed `43/43`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Browser PeerCompute resident authority-host gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "real browser PeerCompute resident authority host"`
  passed `1/1`.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-retained-gas-cell-field-source-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`, and
  `visualSurfaceIssues=[]`. Manual inspection found final frames nonblank and
  bounded; MLS-MPM fragmentation and CPU SPH stacked/blob shape remain open.

## Current Focused Result - 2026-06-15 Spatial Gas-Cell Source Provenance

The current slice preserves retained product-event source provenance as the
local spatial gas EOS path derives pressure cells. Explicit retained product
refs pass through unchanged, and `resident-product-mass-buffer` is added only
when an actual retained product-event buffer handle exists. The pressure
feedback gas-cell field now exposes the same source refs as the spatial ledger
and derived gas-cell field.

Focused checks:

- Syntax:
  `node --check src/runtime/sphPhaseDemo.js` and
  `node --check tests/sphPhaseDemo.test.mjs` passed.
- Gas/pressure coverage:
  `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "spatial gas|positioned gas|gas pressure"`
  passed `29/29`.
- Pressure stage coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage .*gas-cell|pressure interface stage declares retained gas-cell|gas-cell field import|local gas-cell|pressure interface stage compute task can produce force rows"`
  passed `43/43`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-spatial-gas-source-provenance-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`, and
  `visualSurfaceIssues=[]`. Manual inspection found the frames nonblank and
  bounded, while MLS-MPM fragmentation and CPU SPH stacked/blob shape remain
  open physics-quality blockers.

## Current Focused Result - 2026-06-15 Gas-Cell Field Admission Publisher

The current slice moves gas-cell field-consumption admission behind the
resident authority host and StateManager. The scene can now ask the host to
publish/admit a ready local gas-cell field with retained gas-pressure refs, then
use that host-published admission to publish the gas-cell field import.

Focused checks:

- Syntax:
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`, and
  `node --check tests/sphPhaseRenderer.test.mjs` passed.
- Scene/renderer admission coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "gas-cell field imports|admit gas-cell|pressure interface state owns retained force rows"`
  passed `29/29`.
- PeerCompute integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "gas-cell field imports|worker-retained pressure/interface|resident pass-DAG task runs through real PeerCompute GPU lane authority"`
  passed `14/14`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Browser PeerCompute resident authority-host gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "real browser PeerCompute resident authority host"`
  passed `1/1`.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-gas-cell-admission-publisher-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`, and
  `visualSurfaceIssues=[]`. Manual inspection found the frames nonblank and
  bounded, with MLS-MPM fragmentation and CPU SPH stacked/blob behavior still
  open.

## Current Focused Result - 2026-06-15 Spatial Gas-Cell EOS Producer

The current slice prevents aggregate resident gas ledgers from being mistaken
for local pressure-gradient data and adds the first real spatial gas-cell EOS
producer contract. Spatial gas-species ledgers can derive per-cell ideal-gas
pressure and nearest-neighbor pressure gradients; positioned gas product-event
rows with actual support volume can produce that spatial ledger. Distributed
consumption remains behind the existing gas-cell field admission/import and
retained-ref gates.

Focused checks:

- Syntax:
  `node --check src/runtime/sphPhaseDemo.js` and
  `node --check tests/sphPhaseDemo.test.mjs` passed.
- Gas/pressure coverage:
  `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "gas pressure|spatial gas|sealed gas|positioned gas"`
  passed `29/29`.
- Pressure stage coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage .*gas-cell|pressure interface stage declares retained gas-cell|gas-cell field import|local gas-cell|pressure interface stage compute task can produce force rows"`
  passed `43/43`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- PeerCompute integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "gas-cell field imports|worker-retained pressure/interface|resident pass-DAG task runs through real PeerCompute GPU lane authority"`
  passed `14/14`.
- Browser PeerCompute resident authority-host gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "real browser PeerCompute resident authority host"`
  passed `1/1`.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-spatial-gas-cell-eos-producer-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`,
  `visualSurfaceIssues=[]`, and two captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-spatial-gas-cell-eos-producer-20260615`.
  Manual inspection found the frames nonblank and bounded. MLS-MPM remains
  fragmented, and CPU SPH liquid/solid still show the known stacked/blob shape.

## Current Focused Result - 2026-06-15 Pressure Gas-Cell Retained Ref Wiring

The current slice fixes retained-buffer evidence for local gas-cell pressure
fields. A pressureInterface stage task now declares gas-cell buffer retention
when local gas-cell pressure data is present, and worker-generated
`gasPressureCellsBuffer` refs are classified as gas-cell refs instead of being
lost or counted as pressure force-row refs.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/services/ulgMechanicsResidentStage.worker.js`,
  `node --check tests/sphMlsMpmGpuStep.test.mjs`, and
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs` passed.
- Pressure stage retained gas-cell coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage .*gas-cell|pressure interface stage declares retained gas-cell|pressure interface stage compute task can produce force rows with WebGPU|pressure interface stage compute task declares retained"`
  passed `43/43`.
- PeerCompute pressure publication coverage:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "worker-retained pressure/interface|mechanics-stage-gpuhub-worker-ready|resident pass-DAG task runs through real PeerCompute GPU lane authority|gas-cell field imports"`
  passed `14/14`.
- Resident-stage Worker coverage:
  `node --test tests/ulgMechanicsResidentStageWorker.test.mjs` passed `4/4`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Browser PeerCompute resident authority-host gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "real browser PeerCompute resident authority host"`
  passed `1/1`.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-gas-cell-retained-ref-wire-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`,
  `visualSurfaceIssues=[]`, and two captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-pressure-gas-cell-retained-ref-wire-20260615`.
  Manual inspection found final frames nonblank and bounded. MLS-MPM remains
  fragmented, and CPU SPH liquid/solid still show the known unphysical
  stacked/blob shape.

## Prior Focused Result - 2026-06-15 Scene Gas-Cell Import Host Wiring

The current slice wires the live scene/stage path to the browser resident
authority host for pressure/interface gas-cell field imports. Scene code can
derive a candidate from resident gas-pressure telemetry, but it only treats the
import as ready after `host.publishPressureInterfaceGasCellFieldImportSource()`
returns the StateManager-backed import descriptor.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check src/visualization/sphPhaseDemoMount.js`, and
  `node --check tests/sphPhaseRenderer.test.mjs` passed.
- Scene/renderer import publication coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "gas-cell field imports|pressure interface state owns retained force rows|render order|transparent|overlay draw order"`
  passed `28/28`.
- Browser PeerCompute resident authority-host gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "real browser PeerCompute resident authority host"`
  passed `1/1`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- PeerCompute gas-cell import publication coverage:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "gas-cell field imports|worker-retained pressure/interface force-row descriptors"`
  passed `14/14`.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-scene-gas-cell-import-wire-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`,
  `visualSurfaceIssues=[]`, and two captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-scene-gas-cell-import-wire-20260615`.
  Manual inspection found all final frames nonblank and bounded. The short
  MLS-MPM capture remains fragmented, and CPU SPH still shows the known
  unphysical stacked/blob shape; those are open physics behavior defects, not
  accepted liquid/solid behavior.

## Prior Focused Result - 2026-06-15 StateManager Gas-Cell Import Publisher

The current slice moves gas-cell import construction behind the browser
resident authority host and StateManager. The host publishes
`peercompute.ulg.pressure-interface-gas-cell-field-import-hot-buffer-publication.v0`
records and returns a pressureInterface-consumable
`peercompute.ulg.pressure-interface-gas-cell-field-import.v0` descriptor.

Focused checks:

- Syntax:
  `node --check src/runtime/peercomputeBrowserResidentHost.js` and
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs` passed.
- PeerCompute gas-cell import publication coverage:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "gas-cell field imports|worker-retained pressure/interface force-row descriptors"`
  passed `14/14`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-gas-cell-import-publisher-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`,
  `visualSurfaceIssues=[]`, and two captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-gas-cell-import-publisher-20260615`.
  Manual inspection found all final frames nonblank and bounded; MLS-MPM still
  shows the known short-horizon fragmentation.

## Prior Focused Result - 2026-06-15 Admitted Gas-Cell Field Import

The current slice adds
`peercompute.ulg.pressure-interface-gas-cell-field-import.v0` as the admitted
input seam for local gas-cell pressure fields. The pressureInterface stage now
uses an imported local gas-cell field only when the descriptor is ready, has
admitted field-consumption evidence, has retained gas-cell refs, and includes a
local gas-cell snapshot for oracle parity. Blocked imports leave the stage on
uniform sealed-gas pressure.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js` and
  `node --check tests/sphMlsMpmGpuStep.test.mjs` passed.
- Pressure/interface stage import coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage .*gas-cell|pressure interface stage compute task can produce force rows with WebGPU|pressure interface stage compute task declares retained"`
  passed `42/42`.
- Worker resident stage coverage:
  `node --test tests/ulgMechanicsResidentStageWorker.test.mjs` passed `4/4`.
- PeerCompute integration coverage:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "worker-retained pressure/interface force-row descriptors|mechanics-stage-gpuhub-worker-ready|resident pass-DAG task runs through real PeerCompute GPU lane authority"`
  passed `13/13`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-gas-cell-field-import-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`,
  `visualSurfaceIssues=[]`, and two captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-gas-cell-field-import-20260615`.
  Manual inspection found all final frames nonblank and bounded; MLS-MPM still
  shows the known short-horizon fragmentation.

## Prior Focused Result - 2026-06-15 Local Gas-Cell Field Admission Gate

The current slice gates local gas-cell pressure-field consumption separately
from retained buffer publication. A pressureInterface stage may compute a
local-gradient oracle result, but distributed Worker publication now requires
explicit
`peercompute.ulg.pressure-interface-gas-cell-field-admission.v0` approval
before that local gas-cell field is treated as admitted input.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check tests/sphMlsMpmGpuStep.test.mjs`, and
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs` passed.
- Pressure/interface stage admission coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage .*local gas-cell|pressure interface stage compute task can produce force rows with WebGPU|pressure interface stage compute task declares retained"`
  passed `40/40`.
- PeerCompute host publication admission coverage:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "worker-retained pressure/interface force-row descriptors"`
  passed `13/13`.
- WebGPU pressure producer coverage:
  `node --test tests/sphPressureInterfaceGpuKernel.test.mjs` passed `3/3`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-gas-cell-field-admission-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`,
  `visualSurfaceIssues=[]`, and two captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-gas-cell-field-admission-20260615`.
  Manual inspection found all final frames nonblank and bounded; MLS-MPM still
  shows the known short-horizon fragmentation.

## Prior Focused Result - 2026-06-15 Retained Local Gas-Cell Publication Gate

The current slice makes local gas-cell pressure publication fail closed unless
the gas-cell rows are retained on the Worker lane. A local-gradient
pressureInterface stage can retain both pressure force rows and gas-cell input
rows; publication candidates and NodeKernel/StateManager hot/warm records now
carry gas-cell row/ref metadata.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check src/runtime/sph/sphPressureInterfaceGpuKernel.js`,
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`, and
  `node --check tests/sphPressureInterfaceGpuKernel.test.mjs` passed.
- WebGPU pressure producer coverage:
  `node --test tests/sphPressureInterfaceGpuKernel.test.mjs` passed `3/3`.
- PeerCompute publication coverage:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "worker-retained pressure/interface|ULG resident solver descriptors publish executable"`
  passed `13/13`.
- Resident pressure/stage coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage|pressure interface|grid admission|grid force"`
  passed `38/38`.
- Browser PeerCompute resident authority-host gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  passed `1/1`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-gas-cell-publication-admission-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`,
  `visualSurfaceIssues=[]`, and two captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-pressure-gas-cell-publication-admission-20260615`.
  Manual inspection found all final frames nonblank and bounded.

## Prior Focused Result - 2026-06-15 Local Gas-Cell Pressure Field Contract

The current slice adds a structured local gas-cell pressure field that can
drive pressure/interface force rows. CPU and WebGPU pressure producers can now
use per-cell pressure plus pressure gradients by sampling the nearest gas cell
at each material-interface centroid, while retaining the existing uniform
sealed-gas pressure path when no local field is admitted.

Focused checks:

- Syntax:
  `node --check src/runtime/sphPhaseDemo.js`,
  `node --check src/runtime/sph/sphPressureInterfaceGpuKernel.js`,
  `node --check tests/sphPhaseDemo.test.mjs`,
  `node --check tests/sphPressureInterfaceGpuKernel.test.mjs`, and
  `node --check tests/webgpuKernelAbi.test.mjs` passed.
- Demo pressure/gas contract coverage:
  `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "sealed gas pressure feedback|gas pressure interface"`
  passed `26/26`.
- WebGPU pressure producer coverage:
  `node --test tests/sphPressureInterfaceGpuKernel.test.mjs` passed `3/3`.
- WebGPU uniform-buffer ABI:
  `node --test tests/webgpuKernelAbi.test.mjs --test-name-pattern "uniform buffer ABI"`
  passed `1/1`.
- ABI pressure/render guard:
  `node --test tests/abi.test.mjs --test-name-pattern "pressure|SPH GPU render field ABI|WebGPU"`
  passed `17/17`.
- Resident pressure/stage coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage|pressure interface|grid admission|grid force"`
  passed `38/38`.
- Browser PeerCompute resident authority-host gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  passed `1/1`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-local-gas-cell-field-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`,
  `visualSurfaceIssues=[]`, and two captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-pressure-local-gas-cell-field-20260615`.
  Manual inspection found all final frames nonblank and bounded; MLS-MPM still
  shows the known short-horizon fragmentation.

## Prior Focused Result - 2026-06-15 Pressure Local-Gradient Contract Metadata

The current slice keeps the existing pressure/interface law but labels it
honestly. Uniform sealed-gas pressure still produces interface traction rows,
including WebGPU-retained rows, but CPU, WebGPU, ComputeManager stage evidence,
and lane summaries now report that local pressure-gradient gas-cell coupling
is blocked until a resident gas-cell/EOS gradient field exists.

Focused checks:

- Syntax:
  `node --check src/runtime/sphPhaseDemo.js`,
  `node --check src/runtime/sph/sphPressureInterfaceGpuKernel.js`,
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check tests/sphPhaseDemo.test.mjs`,
  `node --check tests/sphPressureInterfaceGpuKernel.test.mjs`, and
  `node --check tests/sphMlsMpmGpuStep.test.mjs` passed.
- Demo pressure/gas contract coverage:
  `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "sealed gas pressure feedback|gas pressure interface"`
  passed `25/25`.
- WebGPU pressure producer coverage:
  `node --test tests/sphPressureInterfaceGpuKernel.test.mjs` passed `2/2`.
- Resident pressure/stage coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage|pressure interface|grid admission|grid force"`
  passed `38/38`.
- Browser PeerCompute resident authority-host gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  passed `1/1`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-local-gradient-contract-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`,
  `visualSurfaceIssues=[]`, and two captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-pressure-local-gradient-contract-20260615`.
  Manual inspection found all final frames nonblank and bounded; MLS-MPM still
  shows the known short-horizon fragmentation.

## Prior Focused Result - 2026-06-15 Pressure WebGPU-Retained Publication

The current slice makes the pressure/interface Worker publication path
WebGPU-retained-only. A pressure compact publication candidate is ready only
when it proves WebGPU backend execution, no-full readback, worker residency,
non-mutating pressure authority, retained pressure refs, and a retained GPU
force-row buffer descriptor. The authority host rejects cloneable/CPU
force-row-array publication attempts for this worker-retained path.

Focused checks:

- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/runtime/peercomputeBrowserResidentHost.js`, and
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs` passed.
- PeerCompute/ULG integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable|worker-retained pressure/interface"`
  passed `13/13`, including rejection of cloneable pressure-row publication.
- Resident-step pressure coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface|stage DAG|resident steps"`
  passed `38/38`.
- Browser PeerCompute resident authority-host gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  passed `1/1`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-publication-webgpu-retained-only-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`,
  `visualSurfaceIssues=[]`, and two captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-pressure-publication-webgpu-retained-only-20260615`.

## Prior Focused Result - 2026-06-15 Scene Pressure-Row Upload Admission

The current slice blocks scene-local pressure/interface force-row uploads until
grid-force consumption is admitted through
`peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0` and
the solver is explicitly approved for grid application. Unadmitted pressure
rows remain candidate telemetry only; they are not written to a scene-owned
GPU buffer and are excluded from resident mechanics signatures. The browser
default gate now exposes pressure grid-force admission fields, compact-summary
active-grid scan availability, and closure-derived H2O alpha/depth policy.

Focused checks:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check src/runtime/sph/sphGridUpdateGpuKernel.js`,
  `node --check tests/sphPhaseRenderer.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- Renderer pressure/depth unit coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "pressure interface state|pressure force-row|transparent|render order"`
  passed `27/27`.
- Grid-update admission coverage:
  `node --test tests/sphGridUpdateGpuKernel.test.mjs --test-name-pattern "pressure interface|grid force"`
  passed `14/14`.
- Resident-step pressure/admission coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "resident steps|pressure interface|grid admission|grid force"`
  passed `38/38`.
- Default browser derived-material gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase demo runs derived material properties by default"`
  passed `1/1`.
- Browser PeerCompute resident authority-host gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  passed `1/1`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-scene-pressure-upload-admission-gate-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, `issues=[]`,
  `visualSurfaceIssues=[]`, and two captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-scene-pressure-upload-admission-gate-20260615`.
  Captured frames were inspected manually; they are nonblank and bounded, but
  the short MLS-MPM frame remains visually fragmented, so this is not
  long-horizon liquid-settling acceptance.

## Prior Focused Result - 2026-06-15 Transparent Renderer Depth Order

The mechanics stage-chain now resolves P2G, grid-update, and G2P through the
PeerCompute/GPUHub resident stage executor registry and requests dedicated
worker residency. The latest focused browser gate now proves real browser
Worker WebGPU execution without full readback, publishes the Worker-retained
mechanics output through StateManager, and runs a second same-Worker/same-lane
continuation where P2G consumes the prior retained G2P state/mechanics buffers.
The Worker lane now also seeds one retained thermo buffer and reuses it for
P2G/G2P in both the first stage chain and the continuation.
The latest unit slice adds the first ComputeManager thermal/phase child stage
task boundary for the next law-family promotion.
The Worker module now also accepts a `thermalPhase` stage id and can adopt
retained thermo output into the Worker lane. The focused browser gate now runs
that `thermalPhase` stage through the formal ComputeManager/GPUHub stage-plan
DAG on the same warm Worker/lane after mechanics continuation.
Thermal retained output now also has a NodeKernel/StateManager publication
path with its own schema and `sph-thermo-phase` output family admission.
The current unit/integration slice adds the first reaction/product child stage
boundary after thermal. It is non-authoritative and evidence-only, but the
Worker and injected PeerCompute DAG now know how to execute `reactionProduct`
and retain state/thermo/mechanics/product refs without full readback.
Reaction/product Worker-retained output now also has a NodeKernel/StateManager
publication path with a dedicated schema and admitted output families for SPH
state, thermo phase, MLS-MPM mechanics, and resident product mass.
The current slice adds a non-authoritative `pressureInterface` force-row
producer stage between P2G and grid-update. It is a producer boundary only:
grid-update consumption remains blocked until an admitted/approved pressure
rows slice lands.
Pressure/interface Worker-retained force-row output now also has a
NodeKernel/StateManager publication path. The authority host stores admitted
force-row retained-ref descriptors as hot records and commits warm deltas under
`ulg-worker-retained-pressure-interface-publications`; the admitted payload
still carries `gridForceApplicationApproved=false`.
Grid-update pressure consumption now has a separate admission gate. Direct
pressure solvers are blocked unless paired with
`peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0` and
`gridForceApplicationApproved=true`; successful application reports admission
status, source hot-buffer key, force-row count, applied impulse, and impulse
proof diagnostics.
Same-frame pressure/interface publication now works inside the formal
ComputeManager/GPUHub stage-plan DAG. When `pressureInterface` runs immediately
before `gridUpdate`, the runner publishes the retained force-row descriptor,
creates an admitted grid-force descriptor, preserves Worker-retained refs
inside the stage value handed to the next stage, and injects the approved
solver/admission into the `gridUpdate` Worker context before execution.
Pressure/interface force-row production now has a WebGPU-resident producer
path. The WebGPU kernel writes the same 16-float pressure force-row ABI as the
CPU oracle, and the resident Worker carries the retained force-row `GPUBuffer`
from `pressureInterface` into `gridUpdate` on the same lane.
The latest focused slice tightens grid-update evidence for that retained
buffer handoff: the WebGPU grid-update wrapper now requires the admitted
grid-force descriptor, records buffer-only pressure rows as retained GPU
submissions with unverified no-full impulse evidence, and publishes
stride/byte-length/residency metadata through the StateManager descriptor.
The current renderer slice fixes the first queued z-buffer/draw-order failure:
transparent Three/MarchingCubes surfaces no longer receive per-surface
hash-offset render orders, so Three.js can depth-sort overlapping water/vapor
surfaces within each transparent layer. The diagnostic floor grid also no
longer writes depth.
Focused checks:

- Renderer depth-order unit coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "render order|transparent|overlay draw order"`
  passed `26/26`. The new test proves transparent same-layer surfaces share
  the base order while opaque surfaces retain stable hash ordering.
- Browser render-state gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  passed `1/1` and now asserts visible transparent surfaces use the
  `three-transparent-depth-sort-within-layer` policy and the container grid
  does not write depth.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-render-transparent-depth-order-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, two captured frames per scenario, and
  inspected PNG frames under
  `/tmp/ulg-visual-sanity-matrix/codex-render-transparent-depth-order-20260615`.

Prior pressure/interface retained-buffer checks:

- Grid-update pressure retained-buffer evidence:
  `node --test tests/sphGridUpdateGpuKernel.test.mjs` passed `14/14`. The new
  cases prove admitted WebGPU pressure rows require StateManager admission,
  unadmitted approved solvers are blocked, and retained `GPUBuffer` force rows
  are submitted without uploading a CPU force-row array.
- Pressure/interface publication descriptor:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "pressure/interface"`
  passed `13/13`; the pressure/interface host test now asserts force-row
  stride, byte length, retained-buffer residency, and same-lane consumer
  protocol in the publication, hot record, import descriptor, and warm delta.
- Pressure/interface stage wrapper:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface"`
  passed `38/38`, including the WebGPU pressure stage summary fields.
- Worker regression:
  `node --test tests/ulgMechanicsResidentStageWorker.test.mjs` passed `4/4`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Browser authority-host regression:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  passed `1/1`.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-retained-buffer-admission-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  passed `3/3` with `failedCount=0`, two captured frames per scenario, and
  artifacts under
  `/tmp/ulg-visual-sanity-matrix/codex-pressure-retained-buffer-admission-20260615`.

Prior pressure/interface WebGPU producer checks:

- Pressure/interface WebGPU producer:
  `node --test tests/sphPressureInterfaceGpuKernel.test.mjs` passed `2/2`.
  The tests prove material-interface element row packing, params packing, and
  no-full retained force-row buffer dispatch.
- WebGPU ABI guard:
  `node --test tests/webgpuKernelAbi.test.mjs` passed `1/1`, including the new
  `PressureInterfaceParams` uniform struct.
- Pressure/interface stage wrapper:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface"`
  ran the resident-step file and passed `38/38`; the new WebGPU case proves
  `runSphPressureInterfaceStageComputeTask()` returns `backend="webgpu"`,
  retained `forceRowsBuffer`, readback-map fence evidence, and
  `executionSource="sphPressureInterfaceForceRowsWebGpu"` when given a
  WebGPU-like device.
- Worker and PeerCompute regressions:
  `node --test tests/ulgMechanicsResidentStageWorker.test.mjs` passed `4/4`;
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs` passed
  `13/13`.
- Browser authority-host regression:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  passed `1/1`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-interface-webgpu-producer-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`, no issues, no visual-surface issues, and two
  captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-pressure-interface-webgpu-producer-20260615`.
- Pressure/interface same-frame grid admission:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs` passed
  `13/13`. The updated integration path proves
  `p2g -> pressureInterface -> gridUpdate -> g2p -> thermalPhase -> reactionProduct`
  still executes through GPUHub resident-stage executors, that
  `pressureInterface` publishes exactly once with `sameFrameConsumerStage`
  set to `gridUpdate`, that the same-frame
  `pressure-interface-grid-force-consumption-approved` descriptor is created,
  and that `gridUpdate` receives/applies the admitted descriptor from its
  Worker context.
- Worker/runtime regressions:
  `node --test tests/ulgMechanicsResidentStageWorker.test.mjs` passed `4/4`;
  `node --test tests/sphMlsMpmGpuStep.test.mjs` passed `37/37`.
- Browser authority-host regression:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  passed `1/1`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-interface-same-frame-grid-admission-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`, no issues, no visual-surface issues, and two
  captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-pressure-interface-same-frame-grid-admission-20260615`.
- Pressure/interface grid consumption admission:
  `node --test tests/sphMlsMpmGpuStep.test.mjs` passed `37/37`. The new cases
  prove direct pressure solvers are blocked without an admitted grid-force
  approval, admitted pressure rows are consumed as grid impulses, optional
  WebGPU runner args carry the admission object, resident-step diagnostics
  preserve admission evidence, and the grid-update stage task evidence passes
  only for admitted/approved pressure consumption.
- PeerCompute regression:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs` passed
  `13/13`.
- Browser authority-host regression:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  passed `1/1`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-interface-grid-consumption-admission-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,solid-h2o-cpu-sph,law-pressure-off-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0` with artifacts under
  `/tmp/ulg-visual-sanity-matrix/codex-pressure-interface-grid-consumption-admission-20260615`.
- Pressure/interface Worker publication admission:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs` passed
  `13/13`. The updated stage-chain integration proves a ready
  pressure/interface publication candidate, calls the injected pressure
  publisher, and carries retained force-row refs. The new authority-host case
  asserts
  `peercompute.ulg.pressure-interface-worker-retained-hot-buffer-publication.v0`
  hot-record storage, `worker-retained-pressure-interface-output-admitted`
  warm-delta admission in
  `ulg-worker-retained-pressure-interface-publications`, retained pressure
  force-row refs, `pressureInterfaceForceRowCount=2`, and
  `gridForceApplicationApproved=false`.
- Browser authority-host regression:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  passed `1/1`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-interface-publication-admission-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,solid-h2o-cpu-sph,law-pressure-off-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0` with artifacts under
  `/tmp/ulg-visual-sanity-matrix/codex-pressure-interface-publication-admission-20260615`.
- Pressure/interface Worker stage DAG boundary:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage compute task"`
  passed; Node executed the resident-step file and reported `35/35`. The new
  case asserts `createSphPressureInterfaceStageComputeTask()` declares
  `pressure-interface-force-rows`, GPU-lane/fence requirements, retained
  force-row buffer refs, and non-mutating authority with
  `gridForceApplicationApproved=false`.
- Pressure/interface resident Worker support:
  `node --test tests/ulgMechanicsResidentStageWorker.test.mjs` passed `4/4`.
  The new case runs `pressureInterface` through
  `runUlgMechanicsResidentStageWorkerPayload()`, verifies pressure force rows
  are produced, and asserts retained `pressure-interface-force-rows-buffer`
  refs.
- Pressure/interface formal DAG integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  reported `12/12`. The injected Worker-runner case now proves
  `p2g -> pressureInterface -> gridUpdate -> g2p -> thermalPhase -> reactionProduct`,
  GPUHub executor sourcing for all six stages, `worker-ready` residency for all
  six, pressure force-row evidence, retained pressure force-row refs, and
  non-authoritative pressure stage authority.
- Browser authority-host regression:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  passed `1/1`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-interface-stage-dag-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,solid-h2o-cpu-sph,law-pressure-off-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0` with artifacts under
  `/tmp/ulg-visual-sanity-matrix/codex-pressure-interface-stage-dag-20260615`.
- Reaction/product Worker publication admission:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  and
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident authority host admits worker-retained reaction/product output descriptors"`
  both passed; Node executed the full integration file in both runs and
  reported `12/12` each time. The first path asserts the five-stage Worker DAG
  builds a ready reaction/product publication candidate, calls the injected
  publisher, admits the reaction/product hot-buffer key, and carries exactly
  `["sph-particle-state","sph-thermo-phase","mls-mpm-mechanics","resident-product-mass"]`.
  The second path asserts the actual authority host stores
  `peercompute.ulg.reaction-product-worker-retained-hot-buffer-publication.v0`
  as a hot record, commits
  `worker-retained-reaction-product-output-admitted` in
  `ulg-worker-retained-reaction-product-publications`, and uses
  `peercompute.ulg.reaction-product-worker-retained-buffer-import.v0` as the
  zero-copy Worker-retained descriptor.
- Browser authority-host regression:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  passed `1/1`.
- Physics atomics:
  `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-reaction-product-publication-admission-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,solid-h2o-cpu-sph,law-pressure-off-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0` with artifacts under
  `/tmp/ulg-visual-sanity-matrix/codex-reaction-product-publication-admission-20260615`.
- Reaction/product Worker stage DAG boundary:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  reported `11/11`. The injected Worker-runner case now proves
  `p2g -> gridUpdate -> g2p -> thermalPhase -> reactionProduct` through GPUHub
  resident-stage executors, all five stages `worker-ready`, and
  `reactionProduct` non-authoritative task evidence with retained product-mass
  buffer signaling.
- SPH reaction no-full acceptance:
  `node --test tests/sphReactionGpuKernel.test.mjs --test-name-pattern "no-full retained output"`
  reported `10/10`. The new case asserts
  `runSphReactionStepWithOptionalWebGpu()` accepts no-full retained WebGPU
  reaction output without CPU parity against stale mirrors.
- ULG resident-stage Worker reaction/product support:
  `node --test tests/ulgMechanicsResidentStageWorker.test.mjs` passed `3/3`.
  The new reaction case runs `reactionProduct` through
  `runUlgMechanicsResidentStageWorkerPayload()` with an injected reaction
  runner, verifies retained state/thermo/mechanics inputs are forwarded,
  asserts `reactionProductStageTaskEvidence.passed=true`, and confirms
  retained product-mass output refs are reported.
- SPH reaction/product stage task boundary:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "stage compute task"`
  reported `34/34`. The new focused case asserts the reaction/product stage
  declares GPU lane/fence requirements, retained state/thermo/mechanics/product
  refs, candidate writes for `resident-product-mass`, and no StateManager
  mutation.
- Post-slice visual sanity matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-reaction-product-stage-dag-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,solid-h2o-cpu-sph,law-pressure-off-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0` with artifacts under
  `/tmp/ulg-visual-sanity-matrix/codex-reaction-product-stage-dag-20260614`.
- Thermal/phase Worker publication admission:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  passed `1/1`. The focused browser gate now supplies
  `host.publishWorkerRetainedThermalPhaseStageOutput()` to the formal stage
  chain and asserts thermal candidate readiness, hot-buffer storage, live
  Worker backend retention, warm-delta admission under
  `ulg-worker-retained-thermal-phase-publications`, retained thermo refs, and
  admitted `outputFamilies=["sph-thermo-phase"]`.
- PeerCompute thermal publication candidate:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  reported `11/11`. The injected Worker-runner case now also injects a
  thermal publisher and asserts the candidate carries only
  `sph-thermo-phase`, one retained thermo ref, and `sourceStage="thermalPhase"`.
- Formal GPUHub thermal/phase stage DAG:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  passed `1/1`. The retained continuation now requests
  `includeThermalPhaseStage=true` from `host.runMechanicsStageTaskChain()`.
  Assertions prove `thermalPhase` appears in the stage-plan execution order,
  uses `gpu-hub-resident-stage-executor`, reports `worker-ready`, runs
  `webgpu-accepted-no-full-readback`, satisfies the queue fence, applies
  retained thermo input, adopts retained thermo output, passes thermal task
  evidence, and remains non-authoritative.
- PeerCompute formal thermal DAG integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  reported `11/11`. The new injected Worker-runner case proves the opt-in
  stage plan executes `p2g -> gridUpdate -> g2p -> thermalPhase` through
  GPUHub resident-stage executors with all four stages `worker-ready`, and
  verifies thermal tables are present in the Worker context.
- Browser Worker thermal/phase stage:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  passed `1/1`. The gate now keeps the mechanics Worker warm, runs the
  retained mechanics continuation, then calls the same Worker runner with
  `stage.id="thermalPhase"` and cloneable scene thermal tables. Assertions
  prove the Worker thermal stage reports `webgpu`,
  `webgpu-accepted-no-full-readback`, `no-full-readback`, queue fence
  satisfied, retained thermo input applied, retained thermo output adopted,
  task evidence passed, and no authoritative mutation. Superseded by the
  formal GPUHub thermal/phase stage DAG check above.
- SPH thermal no-full acceptance:
  `node --test tests/sphThermalGpuKernel.test.mjs --test-name-pattern "no-full retained output"`
  reported `11/11`. The new case asserts
  `runSphThermalStepWithOptionalWebGpu()` accepts no-full retained WebGPU
  output without CPU parity against stale mirrors.
- ULG resident-stage Worker thermal/phase support:
  `node --test tests/ulgMechanicsResidentStageWorker.test.mjs` passed `2/2`.
  The new thermal case runs `thermalPhase` through
  `runUlgMechanicsResidentStageWorkerPayload()` with an injected thermal
  runner, verifies retained state/thermo inputs are forwarded, asserts
  `thermalPhaseStageTaskEvidence.passed=true`, and confirms the Worker reports
  `adopted-worker-retained-thermo-output`.
- SPH thermal/phase stage task boundary:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "thermal phase stage compute task"`
  passed; the filtered command reported `33/33` resident-step tests. The new
  focused case asserts `createSphThermalPhaseStageComputeTask()` declares a
  GPU lane/fence, retained state/thermo refs, `sph-thermo-phase` candidate
  writes, and no StateManager mutation. It then runs
  `runSphThermalPhaseStageComputeTask()` with an injected WebGPU-like thermal
  runner and verifies retained state/thermo output, fence satisfaction,
  `thermalPhaseStageTaskEvidence.passed=true`, and
  `thermalPhaseStageTaskAuthority.authoritativeStateMutation=false`.
- ULG mechanics resident-stage Worker module:
  `node --test tests/ulgMechanicsResidentStageWorker.test.mjs` passed `1/1`.
  The test runs P2G, grid-update, and G2P through
  `runUlgMechanicsResidentStageWorkerPayload()`, reusing one worker-local lane
  store and verifying worker-stage completion/fence evidence.
- ULG mechanics stage-chain lane-plan evidence:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  passed `11/11`, including assertions that the mechanics P2G -> grid-update
  -> G2P native stage graph outputs are consumed through
  `ComputeManager.executeGpuResidentLaneStagePlan()` and that the non-native
  graph path lets the lane executor submit the actual three stage tasks. The
  same focused gate now gives ComputeManager a real sibling `GPUHubManager`
  and asserts the stage execution source map is
  `gpu-hub-resident-stage-executor` for P2G, grid-update, and G2P. It now
  also asserts all three default stage worker-residency statuses are
  `blocked-worker-backend-missing`, which is the expected fallback until a
  worker-owned GPU backend exists. The same gate now supplies an explicit
  GPUHub resident-stage worker runner and asserts all three stages report
  `worker-ready`, keep `gpu-hub-resident-stage-executor` as the executor
  source, and preserve backend/fence stage summaries from returned worker
  values.
- Browser same-lane WebGPU stage-chain validation:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  passed `1/1`. The gate now runs `host.runMechanicsStageTaskChain()` with
  `preferWebGpu=true`, `useNativeTaskGraph=false`, a shared scene
  `deviceResult`, and explicit parent lane id/state key. It asserts P2G,
  grid-update, and G2P all report `webgpu` backend, `gpu-lane` residency,
  same parent lane/state key, completed stage-plan execution, satisfied
  fences, GPUHub executor registration, and
  `gpu-hub-resident-stage-executor` sources for all three mechanics stages.
  It also checks the serialized browser evidence reports requested worker
  residency with `blocked-worker-backend-missing` for P2G, grid-update, and
  G2P on the default path. The same gate now creates
  `host.createUlgMechanicsResidentStageWorkerRunner()`, runs the CPU/reference
  mechanics chain through the real browser Worker module, and asserts
  `worker-ready` for P2G, grid-update, and G2P through PeerCompute's Worker
  bridge. The Worker-bridge path now requests `preferWebGpu=true` plus
  `readbackMode="no-full-readback"` and asserts
  `mechanicsStageTaskChainWorker.stageTaskBackends` is `{ p2g: "webgpu",
  gridUpdate: "webgpu", g2p: "webgpu" }`,
  `stageTaskReadbackModes` is all `no-full-readback`, and per-stage fences are
  satisfied after the Worker drains its own WebGPU queue. The same gate now
  asserts
  `peercompute.ulg.mls-mpm-mechanics-worker-compact-publication-candidate.v0`
  is ready as a worker-local retained-ref candidate. The same gate now supplies
  `host.publishWorkerRetainedMechanicsStageOutput()` as the worker output
  publisher and asserts the publication status is
  `worker-retained-mechanics-output-published`, the StateManager hot record is
  stored with the live Worker runner, the warm admission delta is present, and
  the descriptor schema is
  `peercompute.ulg.mechanics-worker-retained-buffer-import.v0`. It then runs a
  second stage chain on the same warm Worker/lane with
  `gpuHubResidentStageWorkerUseRetainedInput=true` and asserts the continuation
  status is `compute-manager-stage-task-chain-executed`, P2G/grid-update/G2P
  remain `webgpu`, all continuation fences are satisfied, P2G reports
  `applied-worker-retained-g2p-input`, and the continuation publishes another
  retained mechanics descriptor. The same gate now asserts P2G and G2P report
  `applied-worker-retained-thermo-input` for the first Worker run and the
  retained continuation.
- Renderer visual correctness debt:
  major z-buffer/draw-order issues are reported in the live visualization,
  including flicker/vanish behavior around visible fluid/solid volumes. Treat
  future visual sequence sanity checks as incomplete until they include a
  render-depth/order regression that samples multiple close-spaced frames and
  checks visible surface identity/extent, transparent/opaque ordering, and
  overlay/container ordering.
- PeerCompute lane manager:
  `EMSDK_QUIET=1 node --test peercompute/tests/unit/gpuResidentLaneManager.test.js`
  from `/home/cos/projects/peercompute` passed `6/6`.
- PeerCompute ComputeManager regressions:
  `EMSDK_QUIET=1 node --test peercompute/tests/computeManager.unit.test.js`
  passed `2/2`, and
  `EMSDK_QUIET=1 node --test peercompute/tests/unit/computeManager.commitDelta.test.js`
  passed `19/19`.
- Cross-repo ULG integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "resident pass-DAG task runs through real PeerCompute GPU lane authority|GPU resident lane|law graph"`
  passed `11/11`, including the assertion that ULG's resident sequence lane
  contract reaches the ComputeManager execution envelope as a derived stage
  plan with `defaultEnabled=false`.
- Physics and visual gates stayed green:
  `npm run test:physics-atomics` passed `7` with `1` expected skip. Visual
  matrix `codex-lane-stage-plan-executor-20260614` passed `3/3`, and the
  newer mechanics stage-chain lane-plan matrix
  `codex-mechanics-stage-lane-plan-20260614` also passed `3/3`. The latest
  lane-executed stage-task matrix
  `codex-mechanics-stage-task-lane-executor-20260614` passed `3/3` as well.
  The same-lane WebGPU-request invariant matrix
  `codex-same-lane-stage-webgpu-request-20260614` passed `3/3`. The browser
  same-lane WebGPU stage-chain matrix
  `codex-browser-same-lane-webgpu-stage-chain-20260614` passed `3/3`. The
  GPUHub resident stage executor chain matrix
  `codex-gpuhub-stage-executor-chain-20260614` passed `3/3`. The GPUHub
  worker-policy evidence matrix
  `codex-gpuhub-worker-policy-evidence-20260614` passed `3/3`.
  The GPUHub worker-ready runner seam matrix
  `codex-gpuhub-worker-ready-runner-seam-20260614` passed `3/3`.
  The mechanics resident-stage Worker module matrix
  `codex-ulg-mechanics-resident-stage-worker-module-20260614` passed `3/3`.
  The Worker no-full retained-ref candidate matrix
  `codex-worker-no-full-retained-candidate-20260614` passed `3/3`.
  The Worker retained publication matrix
  `codex-worker-retained-publication-20260614` passed `3/3`.
  The Worker retained continuation matrix
  `codex-worker-retained-continuation-20260614` passed `3/3`.
  The Worker retained thermo input matrix
  `codex-worker-retained-thermo-input-20260614` passed `3/3`.
  The thermal/phase stage task matrix
  `codex-thermal-phase-stage-task-20260614` passed `3/3`.
  The Worker thermal/phase stage support matrix
  `codex-worker-thermal-phase-stage-support-20260614` passed `3/3`.
  The browser Worker thermal/phase stage matrix
  `codex-browser-worker-thermal-phase-stage-20260614` passed `3/3`.
  All captured two frames per scenario.

The opt-in active-grid mechanics sequence is validated behind
`fuseNoFullResidentMechanicsActiveGrid` and
`ULG_PROBE_FUSE_RESIDENT_ACTIVE_GRID=1`. Direct-resident probes remain the
fastest performance gate:

`ULG_PROBE_MODE=direct-resident ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=64 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_COMPACT_SUMMARY_SCOPE=particle-visual ULG_PROBE_FUSE_RESIDENT_MECHANICS_SEQUENCE=1 ULG_PROBE_FUSE_RESIDENT_ACTIVE_GRID=1 node scripts/sph-long-horizon-probe.mjs`

The mounted scene can now exercise the same opt-in path through URL policy:

`ULG_PROBE_MODE=scene ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=16 ULG_PROBE_CAPTURE_FRAMES=1 ULG_PROBE_FRAME_DIR=/tmp/ulg-history-probes/scene-active-grid-frames-20260614 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-scene-active-grid-optin-frames-20260614.json ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.5&boxx=5&boxy=5&boxz=5&dropn=3&basen=5&mech=mlsmpm&lawp=0&lawt=0&lawr=0&residentAuto=0&residentActiveGrid=1&residentFuseSequence=1&visualCapture=1' node scripts/sph-long-horizon-probe.mjs`

Current required active-grid checks:

- Focused resident unit coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "active-grid dispatch|fused mechanics sequence|fused no-full mechanics|compact GPU summary"`.
- Focused ComputeManager task-surface coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "resident steps compute task|active-grid dispatch"`.
  This now verifies the metadata-only resident sequence lane contract is
  present on the task, solver input, result, and commit-delta surfaces while
  `defaultEnabled=false`.
- Browser A/B: active-grid and full-grid fused sequence must both classify
  `good`; active-grid should report `activeGridDispatch.useActiveGrid=true`,
  active node count below full grid count, conserved mass, bounded J, and no
  pressure impulse.
- Multi-batch direct resident probe must show later batches use
  `boundsSource=resident-position-bounds` once CPU mirrors are stale.
- Keep pairing with `npm run test:physics-atomics` and a targeted
  `scripts/sph-visual-sanity-matrix.mjs` run. Use
  `ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1` after major todo slices so at least a
  small representative visual sequence is captured.
- Treat the mounted active-grid probe as a wiring/performance check. Its
  reduced `27/125` particle visual frames are intentionally sparse and do not
  replace the same-material liquid long-horizon/free-surface acceptance gate.

## Current Focused Result - 2026-06-14 Live Same-Device Auto-Publication + Solid H2O + Law-Isolation Visual Gates

ULG now has a concrete NodeKernel-compatible refresh executor for admitted
remote task-graph seeds. The executor rebuilds SPH state, SPH thermo, and
MLS-MPM mechanics WebGPU buffers locally, stores the real GPU handles only in
StateManager hot storage, and returns local retained-buffer refs to
`NodeKernel.refreshRemoteTaskGraphHotBuffersFromSeed()`. Remote GPU refs stay
metadata-only and are not retained as local leases. The browser resident
authority host now exposes `refreshRemoteSeedHotBuffers()` as the host-level
call that commits an admitted remote seed and runs this local refresh path.
It also exposes `submitTaskGraphWithRemoteSeedHotBufferRefresh()`, an opt-in
NodeKernel graph submit wrapper that auto-refreshes only after a remote cache
artifact is admitted/imported. The mounted resident scheduler now has a
default-off prelude that can call that wrapper when a caller explicitly
supplies a remote resident task graph or graph factory. The next slice adds a
default SPH/MLS-MPM remote seed graph builder and PeerCompute now preserves
graph-level `stateSeedPayload` in task-graph results/cache artifacts, so a
real responder `ComputeManager` can feed ULG's local hot-buffer refresh path.
That builder now also supports an optional second node,
`ulg-sph-mls-mpm-resident-steps`, which executes the resident-step compute
task on the responder with commit deltas suppressed. In the current focused
gate this second node is CPU-reference evidence only; it proves graph shape
and responder task execution. The graph can now add a third post-stage seed
node that receives the resident result through PeerCompute task-graph
`resultInputs`, derives a full-readback transitional state seed, and lets the
requester refresh local hot buffers from the advanced seed after NodeKernel/
StateManager admission/import.
The same graph builder now also supports an optional evidence-only mechanics
stage chain before the resident compute stage:
`state-seed -> mechanics-p2g -> mechanics-grid-update -> mechanics-g2p ->
resident-steps -> post-stage-state-seed`. Grid update and G2P receive upstream
stage outputs through PeerCompute task-graph `resultInputs`; the resident stage
depends on G2P when the chain is enabled. This proves the first compact remote
worker-stage output boundary under responder `ComputeManager` ownership, while
the post-stage seed remains the transitional full-readback refresh source.
The graph can now insert `mechanics-stage-state-seed` between G2P and the
resident stage. That node derives a non-authoritative seed candidate from
full-readback G2P state/mechanics arrays, leaves thermo/phase owned by the
original seed, and can be selected only through explicit
`preferMechanicsStageSeed`.
The same focused result now includes a CPU-SPH solid H2O phase gate: cold H2O
solids are excluded from liquid SPH pressure/density projection, wall contact
clamps solid groups instead of individual particles, and a visual matrix
scenario now guards the old "ice flows like water" failure.
The remote mechanics-stage seed node now also has a no-full-readback compact
candidate path. Full G2P readback still produces the transitional refresh
`stateSeedPayload`; retained/no-full G2P output now produces a compact
mechanics-stage candidate with buffer byte evidence, output families,
GPU-fence status, `admissionRequired=true`, and `localRefreshRequired=true`.
It deliberately leaves `stateSeedPayload=null`, so it cannot be selected by
the current local hot-buffer refresh path until the retained-lane/admitted
compact refresh contract exists.
The refresh seed selector now blocks fallback when `preferMechanicsStageSeed`
is set and only the compact no-full mechanics candidate exists, rather than
silently refreshing the original graph seed.
The ULG submit wrapper now also records that compact mechanics candidate
through `NodeKernel.commitRemoteTaskGraphCompactCandidate()` before returning
the blocked hot-buffer refresh result. This creates an admitted
StateManager-authority record for the compact output while still refusing to
turn remote retained refs into local GPU buffer handles.
PeerCompute now also exposes
`NodeKernel.refreshRemoteTaskGraphHotBuffersFromCompactCandidate()`, a
fail-closed compact refresh surface that reads the admitted compact-candidate
record, requires a local compact refresh executor, and only completes a GPU
lane lease with executor-returned local refs. Executor results that report
blocked/failed or return no local refs now reject the lane and report
`compact-hot-buffer-refresh-not-completed`. ULG exposes the matching
`refreshRemoteCompactCandidateHotBuffers()` host wrapper, an opt-in
`attemptCompactCandidateRefresh` path on the graph submit wrapper, and a
default compact executor contract that reports
`blocked-compact-candidate-local-source-required` unless an explicit local
source seed is attached. The compact candidate now also carries
`peercompute.ulg.remote-task-graph-compact-local-refresh-contract.v0`, listing
required local source roles and accepted materialization modes. The first
materialization mode,
`peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0`, can carry
validated compact SPH state, SPH thermo, and MLS-MPM mechanics rows that ULG
uploads directly into local hot buffers.
The next materialization mode,
`peercompute.ulg.remote-task-graph-same-device-retained-buffer-import.v0`,
can alias an explicit same-device local hot-buffer record without creating new
GPU buffers or writes. It stays fail-closed: remote retained refs are still
metadata-only unless a local StateManager hot-buffer record already owns the
handles.
The recurring visual sanity matrix now also carries explicit law-isolation
labels for mechanics-off static, gravity-off static, pressure-off H2O,
EOS-off H2O, thermal-off hot H2O, and reactions-off Na/H2O. These labels use
the browser URL law toggles and keep per-scenario thresholds in the matrix
definition so future architecture slices can prove disabled law groups stay
disabled without claiming that laws should be removed.
The same-device compact refresh path now has a host-side source-publication
surface. `host.publishSameDeviceHotBufferSource()` stores local same-device
SPH/MLS-MPM upload handles in StateManager hot storage and returns a
serializable same-device retained-buffer import descriptor for compact
candidate propagation.
The mounted resident ComputeManager path now uses that surface automatically
after StateManager admission when the resident execution already owns real
same-device SPH state, SPH thermo, and MLS-MPM mechanics WebGPU upload
handles. The live execution carries `sameDeviceHotBufferSourcePublication` and
`sameDeviceRetainedBufferImport`, and the StateManager hot-buffer record keeps
the non-serializable GPU handles local. The retained import is also bridged
onto the final G2P reconstruction metadata so compact candidate builders can
discover the live producer source.

Verified commands:

- PeerCompute focused NodeKernel unit:
  `node --test tests/unit/nodeKernel.start.test.js`
  from `/home/cos/projects/peercompute/peercompute`
  - Passed: `7/7`.
  - Evidence: explicit target peer graphs emit `compute-task-graph`, responder
    `ComputeManager.submitTaskGraph()` runs the graph, preflight reports
    `distributed-placement-executor-ready`, and the result carries
    `peercompute.nodekernel.remote-task-graph-placement-provenance.v0`.
    Remote graph cache artifacts report
    `peercompute.nodekernel.remote-task-graph-cache-artifact-preflight.v0`;
    default behavior is `remote-cache-artifact-received-not-admitted`, and
    explicit admission routes the artifact through NodeKernel/StateManager
    authority. Explicit admission also imports the result as
    `peercompute.compute.remote-task-graph-cache-import.v0`; a subsequent
    local graph with the same admitted cache key returns `cacheStatus: hit`,
    while remote retained GPU refs remain metadata-only with
    `usableLocally=false`. The same gate now evaluates
    `peercompute.compute.remote-task-graph-state-seed-policy.v0`, proving
    allowed `particle-kinematics` imports can seed warm state, disallowed
    state families are blocked, and remote retained GPU refs require local
    hot-buffer refresh rather than becoming local leases. The test now also
    calls `NodeKernel.commitRemoteTaskGraphStateSeed()` and proves
    `peercompute.nodekernel.remote-task-graph-state-seed-authority.v0` is
    committed into the requester warm-delta sink only for the allowed policy
    path. It then calls
    `NodeKernel.refreshRemoteTaskGraphHotBuffersFromSeed()` and proves
    `peercompute.nodekernel.remote-task-graph-hot-buffer-refresh.v0` reads the
    warm seed, acquires a local GPU resident lane lease, runs a local refresh
    executor, completes a local fence, retains only local buffer refs, and
    commits a refresh delta.
- PeerCompute GPU resident lane regression:
  `node --test peercompute/tests/unit/gpuResidentLaneManager.test.js`
  from `/home/cos/projects/peercompute`
  - Passed: `5/5`.
  - Evidence: local resident lane leases still complete/reject correctly and
    required missing fences still block commits.
- PeerCompute remote compute regression:
  `node --test tests/unit/nodeKernel.remoteCompute.test.js`
  from `/home/cos/projects/peercompute/peercompute`
  - Passed: `8/8`.
  - Evidence: existing single-task remote compute and redundant placement
    paths still pass after adding graph messages.
- PeerCompute ComputeManager task-graph cache regression:
  `node --test tests/unit/computeManager.commitDelta.test.js --test-name-pattern "task graph"`
  from `/home/cos/projects/peercompute/peercompute`
  - Passed: `19/19`.
  - Evidence: existing read-through cache behavior still blocks unadmitted
    artifacts, and graph-level `stateSeedPayload` is preserved in the
    task-graph result, cache artifact, and later admitted cache hit. The same
    gate now proves graph `resultInputs` inject completed upstream node results
    into downstream task data while preserving typed arrays and stripping
    non-cloneable function fields.
- ULG focused integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "remote seed graph builder"`
  - Passed: `11/11` because Node's test-name filter still evaluated the whole
    file.
  - Evidence: the new test imports an admitted remote task-graph cache result,
    commits it as
    `peercompute.nodekernel.remote-task-graph-state-seed-authority.v0`, runs
    ULG's SPH/MLS-MPM refresh executor through
    `peercompute.nodekernel.remote-task-graph-hot-buffer-refresh.v0`, verifies
    local refs do not start with `remote:`, verifies WebGPU upload labels
    `ulg-sph-particle-state`, `ulg-sph-particle-thermo`, and
    `ulg-mls-mpm-particle-mechanics`, and verifies StateManager hot storage
    contains the real local upload handles.
    The host-level test then proves
    `peercompute.ulg.remote-task-graph-hot-buffer-refresh-authority-report.v0`
    from `host.refreshRemoteSeedHotBuffers()`, with summary readiness flags and
    the same local hot-buffer storage evidence.
    The automatic host wrapper test proves
    `peercompute.ulg.remote-task-graph-submit-refresh-report.v0` from a real
    in-memory remote NodeKernel task-graph hop, and proves a disallowed
    `reaction-products` family is blocked without any GPU uploads.
    The remote seed graph-builder test now proves
    `buildUlgSphMlsMpmRemoteSeedTaskGraph()` produces
    `peercompute.ulg.remote-task-graph-sph-mls-mpm-resident-graph.v0` with
    seed, evidence-only mechanics P2G/grid-update/G2P, mechanics-stage seed,
    evidence-only resident compute, and post-stage seed nodes. A real
    responder `ComputeManager`
    executes
    `runUlgRemoteSphMlsMpmStateSeedGraphNode()` and
    the static mechanics stage tasks before
    `ulg-sph-mls-mpm-resident-steps`; P2G, grid update, and G2P report their
    `peercompute.ulg.mls-mpm-mechanics-*-stage-task-result.v0` schemas with
    passed stage evidence and non-mutating authority. The mechanics-stage seed
    node reports
    `peercompute.ulg.remote-task-graph-sph-mls-mpm-mechanics-stage-seed-node.v0`
    at `step + 1`, and an explicit `preferMechanicsStageSeed` wrapper run
    refreshes from `remote-mechanics-stage-state-seed-node`.
    The same test now directly asserts the no-full G2P compact candidate:
    `peercompute.ulg.remote-task-graph-sph-mls-mpm-mechanics-stage-compact-seed.v0`
    reports output buffer byte evidence, GPU-fence satisfaction, admission and
    local-refresh requirements, and `stateSeedPayload=null`; the selector
    reports `remote-mechanics-stage-compact-seed-not-refreshable` with
    `blockRefresh=true` when mechanics-stage refresh is explicitly preferred.
    The host wrapper then records that compact candidate through
    `commitRemoteTaskGraphCompactCandidate()`, reports
    `compactCandidateAdmissionStatus=compact-candidate-committed`, keeps
    `refreshReport=null`, optionally attempts compact refresh through
    `refreshRemoteTaskGraphHotBuffersFromCompactCandidate()`, and still returns
    no `localBufferRefs` when NodeKernel blocks for missing local compact
    executor. The same integration gate now proves a compact candidate can
    import an explicit same-device local hot-buffer record without new fake
    WebGPU buffers or writes, and that a G2P stage result can propagate that
    same-device source descriptor into the compact candidate rather than
    requiring the executor caller to attach it manually.
    The same test now proves the same-device source descriptor is produced by
    `host.publishSameDeviceHotBufferSource()` from an existing local hot-buffer
    upload record. The host summary reports
    `residentSameDeviceHotBufferSourcePublicationReady=true`; the published
    source record stays in StateManager hot storage; and the same-device import
    aliases that published source with no new fake WebGPU buffers or writes.
    The resident node
    reports
    `peercompute.ulg.mls-mpm-resident-steps-task-result.v0`, backend
    `cpu-reference`, and no commit delta. The post-stage seed node reports
    `peercompute.ulg.remote-task-graph-sph-mls-mpm-post-stage-seed-node.v0`
    at `step + 1`. PeerCompute returns the graph-level seed in the cache
    artifact for admission, NodeKernel admits/imports that artifact, and ULG
    commits/refreshes from the post-stage seed override rather than the
    original graph-level seed.
- ULG mounted remote-refresh prelude:
  `node --test tests/sphPhaseDemoMountRemoteRefresh.test.mjs`
  - Passed: `4/4`.
  - Evidence: default-off mode does not call the graph factory or authority
    wrapper; enabled mode submits through
    `submitTaskGraphWithRemoteSeedHotBufferRefresh()`, captures admitted cache
    and local hot-buffer refresh telemetry, reports missing authority-wrapper
    status without submitting, and converts refresh errors into
    `error-local-resident-continued` so the local resident step remains
    available.
- ULG live same-device source auto-publication browser gates:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host|SPH phase resident auto scheduler can use the default PeerCompute resident authority host"`
  - Passed: `2/2`.
  - Evidence: the manual real browser authority-host path and the mounted auto
    scheduler both report `same-device-hot-buffer-source-published`; the
    descriptor source task id matches the admitted resident task id; the
    retained import points back to the published hot-buffer source; and
    StateManager hot storage contains the SPH state, SPH thermo, and MLS-MPM
    mechanics upload handles. The same source hot-buffer key is also present
    on the final G2P reconstruction metadata.
- ULG live same-device auto-publication visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-live-source-g2p-bridge-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph,solid-liquid-contact-fe-h2o,phase-change-hot-h2o-water ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `frameCount=2` for all five representative
    scenarios.
  - Evidence: artifacts under
    `/tmp/ulg-visual-sanity-matrix/codex-live-source-g2p-bridge-20260614/`.
- ULG physics atomics:
  `npm run test:physics-atomics`
  - Passed: `7` pass, `1` expected opt-in long-horizon liquid skip.
  - Evidence: the new `plain SPH/PBF reference keeps solid H2O from flowing
    like liquid water` invariant preserves cold H2O base/drop pair distances
    and solid phase over the CPU-SPH/PBF reference path. The newer
    gravity-on `plain SPH/PBF reference keeps solid H2O supported under
    gravity` invariant catches solid drops sinking through solid bases.
- ULG opt-in liquid atomic:
  `npm run test:physics-liquid-atomic`
  - Passed: `8/8`.
  - Evidence: the H2O/H2O CPU/reference long-horizon acceptance reaches about
    `1.024 s`, remains merged, keeps J bounded around `1.046..1.049`, and
    damps final drop speed to about `0.196 m/s` against the `0.25 m/s`
    threshold. This is CPU/reference evidence; browser scene visual settle
    proof remains a separate open gate.
- ULG direct-resident no-full liquid settle probe:
  `ULG_PROBE_MODE=direct-resident ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=2048 ULG_PROBE_EXPECT_LIQUID_MERGE=1 ULG_PROBE_EXPECT_LIQUID_SETTLE=1 ULG_PROBE_LIQUID_SETTLE_MIN_TIME_S=1 ULG_PROBE_LIQUID_SETTLE_MAX_FINAL_DROP_SPEED=0.25 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-liquid-settle-direct-resident-nofull-2048-20260614.json ULG_PROBE_TIMEOUT_MS=600000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-long-horizon`
  - Passed/classified `good`; `analysis.issues=[]`.
  - Evidence: `2048` no-full direct-resident substeps reached about
    `1.024 s`; final drop max speed was about `0.1935 m/s`; support gap ended
    near `-0.1079 m`; J stayed bounded at about `0.9500..1.0490`; pressure
    impulse stayed `0`.
  - Remaining blocker: the batch took about `431.4 s`, with compact summary
    consuming about `342.7 s`. This proves the retained direct-resident liquid
    mechanics can pass the settle threshold, but compact-summary/readback cost
    and a scene-paired visual proof remain open.
- ULG compact-summary fence attribution probes:
  - `ULG_PROBE_MODE=direct-resident ... ULG_PROBE_BATCH_STEPS=64 ... npm run probe:sph-long-horizon`
    wrote
    `/tmp/ulg-history-probes/current-compact-summary-attribution-64-20260614.json`
    and classified `good`. Batch time was about `14.60 s`; compact-summary
    `mapAsync` wait was about `14.49 s` for a `336` byte readback.
  - `ULG_PROBE_CHROMIUM_CHANNEL=chrome ULG_PROBE_CHROMIUM_ARGS='--enable-features=Vulkan' ...`
    wrote
    `/tmp/ulg-history-probes/current-compact-summary-attribution-64-chrome-20260614.json`
    and stayed about the same: `14.33 s` batch, `14.23 s` `mapAsync` wait.
  - `lawt=0&lawr=0` mechanics-only comparison wrote
    `/tmp/ulg-history-probes/current-compact-summary-attribution-64-mechanics-only-20260614.json`
    and still took about `13.57 s` batch, `13.50 s` `mapAsync` wait.
  - Interpretation: the first summary readback fence is mostly draining queued
    resident mechanics command buffers. The next throughput item is fused/
    sparse mechanics execution, not shrinking the compact summary row.
- ULG law-isolation visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-law-isolation-matrix-20260614 ULG_VISUAL_MATRIX_SCENARIOS=law-static-mechanics-off-fe-h2o,law-static-gravity-off-fe-h2o,law-pressure-off-h2o-mlsmpm,law-eos-off-h2o-mlsmpm,law-thermal-off-hot-h2o,law-reactions-off-na-h2o ULG_VISUAL_MATRIX_BATCHES=2 ULG_VISUAL_MATRIX_BATCH_STEPS=8 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `frameCount=3` for all six scenarios.
  - Evidence: artifacts under
    `/tmp/ulg-visual-sanity-matrix/codex-law-isolation-matrix-20260614/`.
    Static mechanics-off and gravity-off checks reported zero displacement and
    speed; pressure/EOS/thermal/reaction-off checks reported zero pressure
    impulse and bounded short-horizon state.
- ULG same-device source-publication visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-same-device-source-publication-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph,solid-liquid-contact-fe-h2o,phase-change-hot-h2o-water ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`; five selected scenarios wrote captured frames
    under
    `/tmp/ulg-visual-sanity-matrix/codex-same-device-source-publication-20260614/`.
- ULG dense visual sequence subset:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-remote-mechanics-stage-seed-sequence-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-liquid-contact-fe-h2o,phase-change-hot-h2o-water ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `frameCount=3` for all four scenarios.
- ULG compact-candidate visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-compact-mechanics-stage-candidate-sequence-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph,solid-liquid-contact-fe-h2o,phase-change-hot-h2o-water ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `frameCount=3` for all five scenarios.
- ULG compact-authority visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-core-compact-authority-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph,solid-liquid-contact-fe-h2o,phase-change-hot-h2o-water ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=8 node scripts/sph-visual-sanity-matrix.mjs`
  - Passed: `failedCount=0`, `frameCount=5` for all five selected scenarios.
  - Separate observation: the default six-scenario matrix timed out only on
    `reaction-product-na-h2o`; keep that as a reaction/closure harness blocker.
- ULG compact-refresh-surface visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-compact-refresh-surface-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph,solid-liquid-contact-fe-h2o,phase-change-hot-h2o-water ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=6 node scripts/sph-visual-sanity-matrix.mjs`
  - Passed: `failedCount=0`, `frameCount=5` for all five selected scenarios.
- ULG compact-executor-contract visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-compact-executor-contract-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph,solid-liquid-contact-fe-h2o,phase-change-hot-h2o-water ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=6 node scripts/sph-visual-sanity-matrix.mjs`
  - Passed: `failedCount=0`, `frameCount=5` for all five selected scenarios.
- ULG compact-snapshot-materialization visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-compact-snapshot-materialization-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph,solid-liquid-contact-fe-h2o,phase-change-hot-h2o-water ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=6 node scripts/sph-visual-sanity-matrix.mjs`
  - Passed: `failedCount=0`, `frameCount=5` for all five selected scenarios.
- ULG same-device-retained-import visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-same-device-retained-import-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph,solid-liquid-contact-fe-h2o,phase-change-hot-h2o-water ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=6 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 node scripts/sph-visual-sanity-matrix.mjs`
  - Passed: `failedCount=0`, `frameCount=5` for all five selected scenarios.
- ULG same-device-source-descriptor visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-same-device-source-descriptor-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph,solid-liquid-contact-fe-h2o,phase-change-hot-h2o-water ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=6 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 node scripts/sph-visual-sanity-matrix.mjs`
  - Passed: `failedCount=0`, `frameCount=5` for all five selected scenarios.
- ULG CPU-SPH solid H2O visual sequence:
  `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5320 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=250&baset=250&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=sph' ULG_PROBE_BATCHES=4 ULG_PROBE_BATCH_STEPS=24 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_CAPTURE_FRAMES=1 ULG_PROBE_FRAME_DIR=/tmp/ulg-visual-sanity-matrix/codex-cpu-sph-solid-h2o-sequence-20260614/solid-h2o-cpu-sph-frames ULG_PROBE_FRAME_EVERY=2 ULG_PROBE_FRAME_MAX=12 ULG_PROBE_TIMEOUT_MS=240000 ULG_PROBE_FAIL_ON_BAD=1 ULG_PROBE_OUTPUT=/tmp/ulg-visual-sanity-matrix/codex-cpu-sph-solid-h2o-sequence-20260614/solid-h2o-cpu-sph.json PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 node scripts/sph-long-horizon-probe.mjs`
  - Passed: status `good`, `frameCount=3`, first/last H2O visible surface
    count `2`, no visual surface issues, and no visible surface outside
    particle/container bounds.
- ULG visual matrix solid-H2O label:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-solid-h2o-cpu-sph-matrix-20260614 ULG_VISUAL_MATRIX_SCENARIOS=solid-h2o-cpu-sph ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_BATCHES=2 ULG_VISUAL_MATRIX_BATCH_STEPS=8 ULG_VISUAL_MATRIX_TIMEOUT_MS=180000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `frameCount=3`.
- ULG solid-support visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-solid-support-contact-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph,solid-liquid-contact-fe-h2o,phase-change-hot-h2o-water ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=6 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 node scripts/sph-visual-sanity-matrix.mjs`
  - Passed: `failedCount=0`, `frameCount=5` for all five selected scenarios.
- ULG strengthened solid-support static guard:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-solid-support-static-guard-20260614 ULG_VISUAL_MATRIX_SCENARIOS=solid-h2o-cpu-sph ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=6 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 node scripts/sph-visual-sanity-matrix.mjs`
  - Passed: `failedCount=0`, `frameCount=5`; `solid-h2o-cpu-sph` now uses
    `ULG_PROBE_EXPECT_STATIC=1` with static/support thresholds.
- Hygiene:
  `git diff --check` from `/home/cos/projects/ulg`
  - Passed.
  `git diff --check` from `/home/cos/projects/peercompute`
  - Passed.
  `npm run icc:update`
  - Passed: `indexedFiles=235`, `memoryChunks=1252`.

Open validation gaps:

- This proves the local ULG refresh hook, host-level authority method, opt-in
  auto-refresh graph wrapper, mounted scheduler prelude, a seven-node remote
  graph with evidence-only mechanics and resident compute stages, compact
  mechanics candidate admission through NodeKernel, and a fail-closed compact
  candidate refresh surface. It does not yet make the mounted resident workload
  authoritative on a remote peer; the next step is the actual local
  retained-lane refresh executor implementation for admitted compact outputs,
  then real law stages on PeerCompute WebGPU workers under ComputeManager/
  GPUHub authority.
- Na/H2O reaction-product visual probing remains a known timeout blocker.
- Liquid H2O settling/free-surface behavior remains separate from the fixed
  CPU-SPH solid H2O gate.

## Current Focused Result - 2026-06-14 NodeKernel Task-Graph Placement Preflight

NodeKernel task-graph placement now fails closed for non-advisory distributed
requests until a real distributed graph executor exists. ULG carries the
preflight schema/status in the mechanics stage-chain artifact.

Verified commands:

- PeerCompute focused NodeKernel unit:
  `node --test tests/unit/nodeKernel.start.test.js`
  from `/home/cos/projects/peercompute/peercompute`
  - Passed: `5/5`.
  - Evidence: local graphs report `local-placement-accepted`, advisory
    distributed graphs report
    `advisory-distributed-placement-local-execution-allowed`, and
    non-advisory distributed graphs throw
    `ERR_NODEKERNEL_DISTRIBUTED_TASK_GRAPH_UNAVAILABLE`.
- ULG focused Node gate:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7`.
  - Evidence: the mechanics stage-chain artifact reports
    `peercompute.nodekernel.task-graph-placement-preflight.v0` and
    `local-placement-accepted`.
- ULG browser authority gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
- ULG physics atomics:
  `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- Hygiene:
  - `git diff --check` passed in ULG and sibling PeerCompute.
  - `npm run icc:update` refreshed ICC with `indexedFiles=233` and
    `memoryChunks=1218`.

Open validation gaps:

- Dense visual subset was already run for the preceding NodeKernel graph-routing
  slice; rerun it after the next physics/render-facing change.
- Distributed graph placement/execution still needs to consume admitted hashes
  and retained GPU lane refs through NodeKernel/StateManager authority.

## Current Focused Result - 2026-06-14 NodeKernel Task-Graph Routing

The mechanics P2G -> grid-update -> G2P stage-chain graph now routes through
`NodeKernel.submitTaskGraph()` when a real NodeKernel is available. Direct
`ComputeManager.submitTaskGraph()` remains the fallback for non-kernel
contexts.

Verified commands:

- PeerCompute focused NodeKernel unit:
  `node --test tests/unit/nodeKernel.start.test.js`
  from `/home/cos/projects/peercompute/peercompute`
  - Passed: `3/3`.
  - Evidence: `NodeKernel.submitTaskGraph()` overwrites graph placement
    authority to `node-kernel` and returns
    `peercompute.nodekernel.task-graph-authority.v0`.
- ULG focused Node gate:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7`.
  - Evidence: the mechanics stage-chain artifact reports
    `node-kernel-submit-task-graph`, `nodeKernelOwned=true`, and
    `peercompute.nodekernel.task-graph-authority.v0`.
- ULG browser authority gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
- ULG physics atomics:
  `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG dense visual sequence subset:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-nodekernel-task-graph-sequence-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-liquid-contact-fe-h2o,phase-change-hot-h2o-water ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `frameCount=3` for all four scenarios.
- Hygiene:
  - `git diff --check` passed in ULG and sibling PeerCompute.
  - `npm run icc:update` refreshed ICC with `indexedFiles=233` and
    `memoryChunks=1218`.

Open validation gaps:

- Distributed graph placement/execution still needs to consume admitted hashes
  and retained GPU lane refs through NodeKernel/StateManager authority.
- Na/H2O reaction-product visual probing remains a known timeout blocker.

## Current Focused Result - 2026-06-14 StateManager/NodeKernel Cache Artifact Authority

Architecture is now the active priority because the CPU/reference path and
visual/atomic gates can guard changes. PeerCompute now treats task-graph cache
artifacts as StateManager/NodeKernel authority records, not ComputeManager-only
local cache facts.

Verified commands:

- PeerCompute syntax checks from `/home/cos/projects/peercompute/peercompute`:
  `node --check` passed for `src/peercompute/stateManager/StateManager.js`,
  `src/peercompute/computeManager/ComputeManager.js`,
  `src/peercompute/nodeKernel/NodeKernel.js`, `src/peercompute/index.js`,
  `tests/stateManager.unit.test.js`,
  `tests/unit/computeManager.commitDelta.test.js`, and
  `tests/unit/nodeKernel.start.test.js`.
  - Passed.
- PeerCompute focused authority units:
  `node --test tests/stateManager.unit.test.js tests/unit/computeManager.commitDelta.test.js tests/unit/nodeKernel.start.test.js`
  from `/home/cos/projects/peercompute/peercompute`
  - Passed: `25/25`.
  - Evidence: StateManager admits/invalidates task-graph cache artifacts,
    ComputeManager read-through remains blocked until admission, and NodeKernel
    routes admission/invalidation through StateManager authority.
- ULG focused Node gate:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7`.
  - Evidence: the mechanics native stage-DAG artifact is first
    `recorded-not-admitted`, then admitted and invalidated through a
    NodeKernel-owned StateManager; ComputeManager local cache state follows
    that authority decision.
- ULG browser authority gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
- ULG physics atomics:
  `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG dense visual sequence subset:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-state-manager-cache-admission-sequence-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-liquid-contact-fe-h2o,phase-change-hot-h2o-water ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `frameCount=3` for all four scenarios.
- Hygiene:
  - `git diff --check` passed in ULG and sibling PeerCompute.
  - `npm run icc:update` refreshed ICC with `indexedFiles=233` and
    `memoryChunks=1216`.

Open validation gaps:

- Distributed graph placement/execution still needs to consume admitted hashes
  and retained GPU lane refs through NodeKernel/StateManager authority.
- Na/H2O reaction-product visual probing remains a known timeout blocker.

## Current Focused Result - 2026-06-14 Graph Cache Artifacts And Admission Metadata

PeerCompute task-graph cache writes now produce explicit artifacts rather than
only storing cloned results. Each write records
`peercompute.compute.task-graph-cache-artifact.v0` with result hash, input
hash, invalidation refs, node result schemas, and
`peercompute.compute.task-graph-cache-admission.v0`. ULG mechanics graphs
remain `recorded-not-admitted`, so the cache is provenance evidence only.

Verified commands:

- Syntax:
  `node --check /home/cos/projects/peercompute/peercompute/src/peercompute/computeManager/ComputeManager.js src/runtime/sph/sphMlsMpmGpuStep.js tests/peercomputeComputeManagerIntegration.test.mjs tests/demo.e2e.mjs`
  - Passed.
- ULG focused Node gate:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7`.
  - Evidence: the mechanics stage-chain graph reports
    `peercompute.compute.task-graph-cache-artifact.v0`,
    `recorded-not-admitted`, `admitted=false`, and an `fnv1a32-*` result hash.
    The direct native DAG also proves `getTaskGraphCacheArtifact()` and
    `taskGraphCacheArtifactsWritten`.
- ULG browser authority gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: the mounted browser authority host returns the cache artifact
    schema/status/admission fields from `runMechanicsStageTaskChain()`.
- ULG physics atomics:
  `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- PeerCompute focused units:
  `node --test tests/unit/gpuResidentLaneManager.test.js tests/unit/computeManager.commitDelta.test.js`
  from `/home/cos/projects/peercompute/peercompute`
  - Passed: `21/21`.
- ULG dense visual sequence subset:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-task-graph-cache-artifact-sequence-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-liquid-contact-fe-h2o,phase-change-hot-h2o-water ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `frameCount=3` for all four scenarios.
- Hygiene:
  - `git diff --check` passed in ULG and sibling PeerCompute.
  - `npm run icc:update` refreshed ICC with `indexedFiles=233` and
    `memoryChunks=1214`.

Open validation gaps:

- Cache artifacts are not admitted or replayed yet. StateManager/NodeKernel
  invalidation and admission must govern read-through before physics output can
  use the cache.
- Na/H2O reaction-product visual probing remains a known timeout blocker.

## Current Focused Result - 2026-06-14 Content-Addressed Graph Cache Inputs

PeerCompute task graphs now derive cache keys from declared graph inputs when
no explicit key is supplied. ULG's mechanics P2G -> grid-update -> G2P
stage-chain graph declares state refs, closure refs, law ids, invalidation
refs, units, and per-stage cache inputs, then records
`peercompute.compute.task-graph-cache-inputs.v0` in the stage-chain artifact.
The cache is still `record-only` for physics output.

Verified commands:

- Syntax:
  `node --check /home/cos/projects/peercompute/peercompute/src/peercompute/computeManager/ComputeManager.js src/runtime/sph/sphMlsMpmGpuStep.js tests/peercomputeComputeManagerIntegration.test.mjs tests/demo.e2e.mjs`
  - Passed.
- ULG focused Node gate:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7`.
  - Evidence: the mechanics stage-chain graph reports
    `nativeTaskGraphCacheKeySource=content-addressed-inputs`,
    `peercompute.compute.task-graph-cache-inputs.v0`, an `fnv1a32-*`
    input hash, and a derived scoped cache key.
- ULG browser authority gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: the mounted browser PeerCompute authority host returns the same
    content-addressed cache-input schema/hash fields from
    `runMechanicsStageTaskChain()`.
- ULG physics atomics:
  `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- PeerCompute focused units:
  `node --test tests/unit/gpuResidentLaneManager.test.js tests/unit/computeManager.commitDelta.test.js`
  from `/home/cos/projects/peercompute/peercompute`
  - Passed: `21/21`.
- ULG dense visual sequence subset:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-content-addressed-graph-cache-sequence-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-liquid-contact-fe-h2o,phase-change-hot-h2o-water ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `frameCount=3` for all four scenarios.
- Hygiene:
  - `git diff --check` passed in ULG and sibling PeerCompute.
  - `npm run icc:update` refreshed ICC with `indexedFiles=233` and
    `memoryChunks=1213`.

Open validation gaps:

- Cache remains record-only for physics outputs; shared read-through requires
  admitted content-addressed closure/state artifacts and invalidation rules.
- Na/H2O reaction-product visual probing remains a known timeout blocker from
  the prior full matrix run.

## Current Focused Result - 2026-06-14 Task Graph Lifecycle Evidence

Sibling PeerCompute `ComputeManager.submitTaskGraph()` now carries graph-level
cache, placement, cancellation, stats, active-graph, and optional GPU resident
lane lease evidence. ULG wires those fields into the mechanics stage-chain
artifact while keeping the CPU-oracle graph record-only, not replaying cached
physics state.

Verified commands:

- PeerCompute and ULG syntax:
  `node --check /home/cos/projects/peercompute/peercompute/src/peercompute/computeManager/ComputeManager.js src/runtime/sph/sphMlsMpmGpuStep.js tests/peercomputeComputeManagerIntegration.test.mjs tests/demo.e2e.mjs`
  - Passed.
- ULG focused Node gate:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7`.
  - Evidence: the real mechanics P2G -> grid-update -> G2P DAG reports
    `peercompute.compute.task-graph-result.v0`, record-only cache status,
    local ComputeManager placement policy, non-cancelled status, and a direct
    native DAG graph-wide GPU lane lease.
- ULG browser authority gate:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: `runMechanicsStageTaskChain()` returns cache, placement,
    cancellation, and lease-status fields from the real browser authority host.
- ULG physics atomics:
  `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- PeerCompute focused units:
  `node --test tests/unit/gpuResidentLaneManager.test.js tests/unit/computeManager.commitDelta.test.js`
  from `/home/cos/projects/peercompute/peercompute`
  - Passed: `21/21`.
- ULG full visual matrix:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-task-graph-lifecycle-evidence-20260614 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Mixed: `4/5` scenarios were `good`; `reaction-product-na-h2o` timed out.
  - This same Na/H2O timeout existed in the prior retained-vertex run, so it is
    tracked as a known reaction/closure visual blocker rather than a new graph
    lifecycle regression.
- ULG dense visual sequence subset:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-task-graph-lifecycle-sequence-pass-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-liquid-contact-fe-h2o,phase-change-hot-h2o-water ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `frameCount=3` for all four scenarios.
- Hygiene:
  - `git diff --check` passed in ULG and sibling PeerCompute.
  - `npm run icc:update` refreshed ICC with `indexedFiles=233` and
    `memoryChunks=1211`.

Open validation gaps:

- Na/H2O reaction-product visual probe still hard-times out before producing a
  full result.
- Graph cache keys are currently explicit policy metadata; next step is
  content-addressed closure/state keys and distributed graph placement.

## Current Focused Result - 2026-06-14 PeerCompute Task Graph Primitive

Sibling PeerCompute `ComputeManager` now exposes `submitTaskGraph()`, a native
dependency-aware graph submission primitive. ULG proves it by submitting the
mechanics P2G -> grid-update -> G2P stage DAG as graph nodes whose downstream
task factories receive upstream results.

Verified commands:

- PeerCompute:
  `node --check /home/cos/projects/peercompute/peercompute/src/peercompute/computeManager/ComputeManager.js`
  - Passed.
- ULG:
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: ULG asserts `computeManager.submitTaskGraph` exists, submits
    `p2g -> gridUpdate -> g2p`, receives
    `peercompute.compute.task-graph-result.v0`, checks execution order and
    dependency batches, and verifies all three stage-task evidence artifacts
    pass.
- ULG:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: the browser host executes `runMechanicsStageTaskChain()` and the
    helper reports `schedulerStatus=peercompute-native-task-graph-used`.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-native-task-graph-helper-integration-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.

Open validation gaps:

- Add graph-level GPU leases, cancellation, cache keys, placement, and
  distributed execution semantics.

## Current Focused Result - 2026-06-14 Mechanics Stage-Chain Helper

ULG now has `runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks()`,
a first-class helper that runs one mechanics-only split step while submitting
P2G, grid update, and G2P through the active ComputeManager stage tasks. It
records `peercompute.ulg.mls-mpm-mechanics-stage-task-chain.v0`, marks all
three stage-task boundaries, keeps the mechanics child law non-authoritative,
and is exposed by the browser resident authority host as
`runMechanicsStageTaskChain()`.

Verified commands:

- ULG:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`, and
  `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: the helper submits the P2G, grid-update, and G2P stage tasks
    through ComputeManager, receives all three stage-task evidence artifacts,
    records `stageTaskBoundaries` for all stages, and emits the stage-chain
    artifact.
- ULG:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: the browser resident authority host exposes
    `runMechanicsStageTaskChain()`, executes it, and the helper reports
    `schedulerStatus=peercompute-native-task-graph-used`.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-native-task-graph-helper-integration-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Scope: visual sanity covers the default mounted browser path after the
    helper/native-graph code change; helper execution is proven by both the
    Node ComputeManager gate and the browser authority gate.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-native-task-graph-helper-integration-20260614/`.

Open validation gaps:

- Add graph-level leases, cancellation, placement, cache keys, and distributed
  execution semantics.

## Current Focused Result - 2026-06-14 Mechanics Stage Replacement Seam

The mechanics-only split step now has optional whole-stage runner seams for
P2G, grid update, and G2P. Defaults still call the existing raw kernel
entrypoints, but a runner can submit a ComputeManager-owned stage task and feed
that result back into the same mechanics-only step. The focused gate now proves
P2G-only replacement, P2G+grid-update replacement, and full
P2G+grid-update+G2P replacement through
`ulg-mls-mpm-mechanics-{p2g,grid-update,g2p}-stage` tasks. The split-path
evidence records `stageTaskBoundaries` and the corresponding stage-task
evidence artifacts; the mechanics child law remains non-authoritative.

Verified commands:

- ULG:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js` and
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: the mechanics-only split step accepts stage runners that submit
    `createMlsMpmMechanicsP2gStageComputeTask()`,
    `createMlsMpmMechanicsGridUpdateStageComputeTask()`, and
    `createMlsMpmMechanicsG2pStageComputeTask()` through ComputeManager,
    receives each `peercompute.ulg.mechanics-*-stage-task-evidence.v0`
    artifact, and records P2G-only, P2G+grid-update, and full
    P2G+grid-update+G2P `stageTaskBoundaries`.
- ULG:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-p2g-stage-replacement-hook-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Scope: visual sanity covers the default mounted browser path after the
    split-step code change; the hook-based replacement seam is currently
    proven by the Node ComputeManager integration gate until a first-class
    stage-chain scheduler is browser-wired.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-p2g-stage-replacement-hook-20260614/`.

Open validation gaps:

- Promote this hook seam into a first-class ComputeManager/NodeKernel
  stage-chain scheduler instead of relying on external function runners.

## Current Focused Result - 2026-06-14 G2P ComputeManager Stage Task

ULG now has a ComputeManager-owned non-mutating G2P mechanics sub-stage task:
`ulg-mls-mpm-mechanics-g2p-stage`. The task consumes the grid-update artifact,
suppresses internal pressure-interface impulses for the mechanics-only path,
returns candidate `sph-particle-state` plus `mls-mpm-mechanics` output, emits
`peercompute.ulg.mechanics-g2p-stage-task-evidence.v0`, and does not make the
mechanics law an authoritative child owner yet.

Verified commands:

- ULG:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`, and
  `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: the Node ComputeManager submits P2G, feeds it into grid update,
    feeds that into `ulg-mls-mpm-mechanics-g2p-stage`, receives
    `peercompute.ulg.mls-mpm-mechanics-g2p-stage-compute-task-result.v0`,
    and validates non-mutating task authority, pressure suppression,
    transient `mls-mpm-grid` reads, candidate particle/mechanics writes, and
    evidence-only promotion status.
- ULG:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: the real browser authority host exposes
    `submitMechanicsG2pStageTask()` and submits P2G -> grid-update -> G2P
    stage tasks through its real ComputeManager.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-g2p-stage-compute-task-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=2 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=12 ULG_VISUAL_MATRIX_FRAME_EVERY=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=3` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-g2p-stage-compute-task-20260614/`.

Open validation gaps:

- Wire P2G/grid-update/G2P stage replacement into the mechanics-only child path
  under the CPU oracle, StateManager admission, GPU fence/lease evidence, and
  visual sanity.
- These stage-task artifacts prove scheduler/authority boundaries; they are
  not final scientific validation of long-horizon multiscale liquid behavior.

## Current Focused Result - 2026-06-14 Grid Update ComputeManager Stage Task

ULG now has a ComputeManager-owned non-mutating grid-update mechanics
sub-stage task: `ulg-mls-mpm-mechanics-grid-update-stage`. The task consumes a
P2G projection artifact, suppresses mechanics-only pressure-interface rows,
writes only transient updated `mls-mpm-grid`, emits
`peercompute.ulg.mechanics-grid-update-stage-task-evidence.v0`, and does not
make the mechanics law an authoritative child owner yet.

Verified commands:

- ULG:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`, and
  `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: the Node ComputeManager submits P2G, feeds the result into
    `ulg-mls-mpm-mechanics-grid-update-stage`, receives
    `peercompute.ulg.mls-mpm-mechanics-grid-update-stage-compute-task-result.v0`,
    and validates non-mutating task authority, pressure-interface suppression,
    and transient `mls-mpm-grid` read/write evidence.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: the real browser authority host exposes
    `submitMechanicsGridUpdateStageTask()` and submits P2G -> grid-update
    stage tasks through its real ComputeManager.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-grid-update-stage-compute-task-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-grid-update-stage-compute-task-20260614/`.

Open validation gaps:

- Add the equivalent ComputeManager-owned G2P stage task.
- Wire stage replacement into the mechanics-only child path after all stage
  task boundaries exist and are guarded by CPU oracle plus visual sanity.

## Current Focused Result - 2026-06-14 P2G ComputeManager Stage Task

ULG now has a ComputeManager-owned non-mutating P2G mechanics sub-stage task:
`ulg-mls-mpm-mechanics-p2g-stage`. The task wraps the existing P2G kernel
entrypoint, forces mechanics-only pressure/product suppression, writes only
transient `mls-mpm-grid`, emits
`peercompute.ulg.mechanics-p2g-stage-task-evidence.v0`, and does not make the
mechanics law an authoritative child owner yet.

Verified commands:

- ULG:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`, and
  `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: the Node ComputeManager submits
    `ulg-mls-mpm-mechanics-p2g-stage`, receives
    `peercompute.ulg.mls-mpm-mechanics-p2g-stage-compute-task-result.v0`,
    validates non-mutating task authority, pressure/product suppression, and
    transient `mls-mpm-grid` output evidence.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: the real browser authority host exposes
    `submitMechanicsP2gStageTask()` and submits a WebGPU P2G stage task through
    its real ComputeManager.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-p2g-stage-compute-task-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-p2g-stage-compute-task-20260614/`.

Open validation gaps:

- Add equivalent ComputeManager-owned grid-update and G2P stage tasks.
- Wire stage replacement into the mechanics-only child path after all stage
  task boundaries exist and are guarded by CPU oracle plus visual sanity.

## Current Focused Result - 2026-06-14 G2P Stage Evidence Gate

Mechanics child task results now emit
`peercompute.ulg.mechanics-child-g2p-stage-evidence.v0` top-level and under
`mechanicsChildStageKernelEvidence.perStageEvidence.g2p`. Mechanics promotion
requires `mechanics-child-g2p-stage-evidence` alongside P2G evidence,
grid-update evidence, broad stage kernel evidence, the child task envelope,
and dry-run parity. This completes the individually named evidence gates for
P2G, grid update, and G2P; the gates remain evidence-only and do not make
mechanics an authoritative child owner yet.

Verified commands:

- ULG:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/runtime/mechanicsPromotionEvidence.js`,
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`, and
  `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: missing mechanics admission includes
    `mechanics-child-g2p-stage-evidence`; child task results expose a passed
    G2P artifact; direct and task-wrapped dry-run evidence include it; and
    promotion evidence satisfies the key before mechanics admission accepts.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: the browser authority host submits a WebGPU mechanics-only child
    task and verifies the G2P sub-stage artifact through child dry-run and
    promotion evidence.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-g2p-stage-evidence-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-g2p-stage-evidence-20260614/`.

Open validation gaps:

- The next architecture slice should replace/promote one mechanics stage at a
  time under this completed sub-stage evidence set, CPU oracle, StateManager
  admission, GPU fence/lease evidence, and visual sanity.
- These artifacts are stage-boundary/admission evidence, not final scientific
  validation of multiscale liquid behavior.

## Current Focused Result - 2026-06-14 Grid Update Stage Evidence Gate

Mechanics child task results now emit
`peercompute.ulg.mechanics-child-grid-update-stage-evidence.v0` top-level and
under `mechanicsChildStageKernelEvidence.perStageEvidence.gridUpdate`.
Mechanics promotion requires `mechanics-child-grid-update-stage-evidence`
alongside P2G evidence, broad stage kernel evidence, the child task envelope,
and dry-run parity. This is the second individually named mechanics sub-stage
gate and remains evidence-only, not an authoritative write owner.

Verified commands:

- ULG:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/runtime/mechanicsPromotionEvidence.js`,
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`, and
  `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: missing mechanics admission includes
    `mechanics-child-grid-update-stage-evidence`; child task results expose a
    passed grid-update artifact; direct and task-wrapped dry-run evidence
    include it; and promotion evidence satisfies the key before mechanics
    admission accepts.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: the browser authority host submits a WebGPU mechanics-only child
    task and verifies the grid-update sub-stage artifact through child dry-run
    and promotion evidence.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-grid-update-stage-evidence-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-grid-update-stage-evidence-20260614/`.

Open validation gaps:

- Add the same individually named evidence gate for G2P.
- Grid-update evidence is not scientific validation by itself; it only proves
  the stage boundary and admission artifact before future kernel replacement.

## Current Focused Result - 2026-06-14 P2G Stage Evidence Gate

Mechanics child task results now emit
`peercompute.ulg.mechanics-child-p2g-stage-evidence.v0` top-level and under
`mechanicsChildStageKernelEvidence.perStageEvidence.p2g`. Mechanics promotion
requires `mechanics-child-p2g-stage-evidence` in addition to the broad stage
kernel evidence, child task envelope, and dry-run parity. This is the first
individually named mechanics sub-stage gate; it is evidence-only and not an
authoritative write owner.

Verified commands:

- ULG:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/runtime/mechanicsPromotionEvidence.js`,
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`, and
  `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: missing mechanics admission includes
    `mechanics-child-p2g-stage-evidence`; child task results expose a passed
    P2G artifact; direct and task-wrapped dry-run evidence include it; and
    promotion evidence satisfies the key before mechanics admission accepts.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: the browser authority host submits a WebGPU mechanics-only child
    task and verifies the P2G sub-stage artifact through child dry-run and
    promotion evidence.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-p2g-stage-evidence-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-p2g-stage-evidence-20260614/`.

Open validation gaps:

- Add the same individually named evidence gates for grid update and G2P.
- P2G evidence is not scientific validation by itself; it only proves the
  stage boundary and admission artifact before future kernel replacement.

## Current Focused Result - 2026-06-14 Mechanics Stage Kernel Evidence

Mechanics child task results now emit
`peercompute.ulg.mechanics-child-stage-kernel-evidence.v0`. Mechanics
promotion requires `mechanics-child-stage-kernel-evidence` in addition to the
child task envelope and dry-run parity. This gate exposes P2G, grid update, and
G2P as separately inspectable mechanics stages before any current-owner
promotion.

Verified commands:

- ULG:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/runtime/mechanicsPromotionEvidence.js`,
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`, and
  `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: missing mechanics admission includes
    `mechanics-child-stage-kernel-evidence`; direct and task-wrapped dry-run
    evidence include a passed stage-kernel artifact; promotion evidence
    satisfies the key before mechanics admission accepts.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: the browser authority host submits a WebGPU mechanics-only child
    task and verifies its required stages are `p2g`, `gridUpdate`, and `g2p`.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-mechanics-stage-kernel-evidence-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-mechanics-stage-kernel-evidence-20260614/`.
- ULG: `git diff --check`
  - Passed.
- ULG: `npm run icc:update`
  - Passed: `indexedFiles=233`, `memoryChunks=1183`.

Open validation gaps:

- Next architecture work should use this per-stage evidence to replace/promote
  P2G, grid update, and G2P one at a time against the CPU oracle.

## Current Focused Result - 2026-06-14 Required Mechanics Child Envelope

The mechanics-only child task envelope is now required promotion evidence.
Mechanics law-family admission requires `mechanics-only-child-task-envelope`;
`runUlgMechanicsChildDryRunTask()` validates the envelope, and
`runUlgMechanicsPromotionEvidenceTask()` records it before promotion admission.

Verified commands:

- ULG:
  `node --check src/runtime/mechanicsPromotionEvidence.js`,
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`, and
  `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: missing mechanics admission includes
    `mechanics-only-child-task-envelope`; direct and task-wrapped child dry-run
    results include a passed envelope; promotion evidence satisfies the same
    key before admission accepts mechanics.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: the browser authority host submits a WebGPU mechanics-only child
    task, passes that result into the child dry-run task, and promotion
    evidence includes `mechanics-only-child-task-envelope`.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-mechanics-child-envelope-required-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-mechanics-child-envelope-required-20260614/`.
- ULG: `git diff --check`
  - Passed.
- ULG: `npm run icc:update`
  - Passed: `indexedFiles=233`, `memoryChunks=1180`.

Open validation gaps:

- Next architecture work should replace the underlying mechanics kernels one
  stage at a time under this required child-task envelope and CPU oracle.

## Current Focused Result - 2026-06-14 ComputeManager Mechanics-Only Child Task

ULG now has a ComputeManager-owned non-mutating mechanics-only resident steps
task surface: `createMlsMpmMechanicsOnlyResidentStepsComputeTask()`,
`runMlsMpmMechanicsOnlyResidentStepsComputeTask()`, and
`submitMlsMpmMechanicsOnlyResidentStepsComputeTask()`. The browser resident
authority host exposes `submitMechanicsOnlyResidentStepsTask()`. CPU-oracle
runs do not require a GPU fence; WebGPU runs require same-device lane/fence
evidence and still suppress commit deltas until promotion admission changes.

Verified commands so far:

- ULG:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`, and
  `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: the CPU-oracle mechanics-only child task runs through
    ComputeManager with task family
    `ulg-mls-mpm-mechanics-only-resident-steps`, suppresses commit deltas, and
    reports `mechanics-only-entrypoint-enforced`.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: the real browser authority host exposes
    `submitMechanicsOnlyResidentStepsTask()` and submits a WebGPU mechanics-only
    child task with satisfied ComputeManager GPU fence evidence.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-computemanager-mechanics-child-task-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-computemanager-mechanics-child-task-20260614/`.
- ULG: `git diff --check`
  - Passed.
- ULG: `npm run icc:update`
  - Passed: `indexedFiles=233`, `memoryChunks=1180`.

## Current Focused Result - 2026-06-14 Direct Mechanics-Only Split Step

ULG now has a direct mechanics-only single-step function:
`runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu()`. The mechanics-only
sequence entrypoint calls that function for each substep. The direct step runs
only P2G, grid update, G2P, and optional compact summary; it supplies null
pressure-interface/product inputs and never calls thermal, reaction, or
mechanics-refresh stages.

Verified commands:

- ULG:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  and `node --check src/runtime/mechanicsPromotionEvidence.js`
  - Passed.
- ULG:
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  and `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: measured reference evidence and mechanics child dry-run task
    both report `runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu` as the
    step source, satisfy the mechanics-only stage/write contract, and feed
    mechanics promotion admission through the existing evidence gates.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: Chromium authority test verifies the direct mechanics-only step
    source for both page-generated reference evidence and the task-wrapped
    child dry-run result.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-direct-mechanics-split-step-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-direct-mechanics-split-step-20260614/`.
- ULG: `git diff --check`
  - Passed.

Open validation gaps:

- The direct split step still uses the existing P2G/grid/G2P kernels. Next work
  should make it a ComputeManager-owned child worker path with the same
  evidence gates.
- The opt-in long-horizon liquid-settling acceptance gate remains the separate
  physics-quality blocker.

## Current Focused Result - 2026-06-14 Explicit Mechanics-Only Resident Entrypoint

ULG now has an explicit mechanics-only resident execution entrypoint:
`runMlsMpmMechanicsOnlyResidentStepsWithOptionalWebGpu()`. Mechanics promotion
reference evidence and child dry-run evidence route through that entrypoint,
which disables thermal, reaction, mechanics-refresh, and pressure-interface
stages and marks evidence with `mechanics-only-entrypoint-enforced`.

Verified commands:

- ULG:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  and `node --check src/runtime/mechanicsPromotionEvidence.js`
  - Passed.
- ULG:
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  and `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: measured reference evidence and mechanics child dry-run task
    both report `mechanics-only-entrypoint-enforced`; the child dry-run still
    satisfies the mechanics-only stage/write contract and promotion admission
    accepts only mechanics families after evidence tasks complete.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: Chromium authority test verifies the same mechanics-only
    entrypoint provenance on page-generated reference evidence and the
    task-wrapped child dry-run result.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-mechanics-only-entrypoint-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-mechanics-only-entrypoint-20260614/`.
- ULG: `git diff --check`
  - Passed.

Open validation gaps:

- The mechanics-only entrypoint is explicit but still backed by the existing
  resident CPU mechanics stage chain. Next work should put the split
  WebGPU/CPU mechanics child kernel behind this entrypoint.
- The opt-in long-horizon liquid-settling acceptance gate remains the separate
  physics-quality blocker.

## Current Focused Result - 2026-06-14 Mechanics-Only Child Stage Contract

ULG now proves that mechanics child dry-run evidence is not silently running
the full parent pass DAG. Measured reference and child dry-run artifacts carry
mechanics-only stage contracts: required mechanics stages are `p2g`,
`gridUpdate`, and `g2p`; thermal/reaction/mechanics-refresh stages must remain
skipped; authoritative writes are limited to `particle-kinematics` and
`mechanics`.

Verified commands:

- ULG:
  `node --check src/runtime/mechanicsPromotionEvidence.js`
  - Passed.
- ULG:
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  and `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: measured reference evidence and child dry-run evidence both
    assert `mechanicsOnlyStageContract.passed`; child writes are
    `particle-kinematics` plus `mechanics`; thermo/phase remains a
    must-not-write family.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: Chromium authority test checks the mechanics-only contract on
    measured reference evidence and on the task-wrapped child dry-run result.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-mechanics-only-contract-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-mechanics-only-contract-20260614/`.
- ULG: `git diff --check`
  - Passed.

Open validation gaps:

- The mechanics-only candidate still uses the resident CPU mechanics path. The
  next implementation step is replacing that candidate with the actual split
  mechanics kernel path while retaining this contract.
- The opt-in long-horizon liquid-settling acceptance gate remains the separate
  physics-quality blocker.

## Current Focused Result - 2026-06-14 Mechanics Child Dry-Run Parity Gate

ULG now requires a non-mutating mechanics child dry-run before mechanics
promotion evidence can satisfy admission. The child dry-run runs as a
module-backed ComputeManager task with `suppressCommitDelta: true`, emits
`peercompute.ulg.mechanics-child-dry-run-evidence.v0`, compares the child
candidate against measured CPU resident reference evidence, and contributes
`mechanics-child-dry-run-parity` to promotion admission.

Verified commands:

- ULG:
  `node --check src/runtime/mechanicsPromotionEvidence.js`
  and `node --check src/runtime/peercomputeBrowserResidentHost.js`
  - Passed.
- ULG:
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  and `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: missing mechanics admission now requires
    `mechanics-child-dry-run-parity`; `ulg-mechanics-child-dry-run` completes
    one task; the child dry-run artifact feeds mechanics promotion evidence;
    the resulting promotion admission accepts only `particle-kinematics` and
    `mechanics`.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: browser authority host exposes
    `submitMechanicsChildDryRunTask()`, the task returns
    `mechanics-child-dry-run-parity-ready`, promotion evidence includes
    `mechanics-child-dry-run-parity`, and task-wrapped promotion admission
    accepts mechanics.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-mechanics-child-dry-run-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-mechanics-child-dry-run-20260614/`.
- ULG: `git diff --check`
  - Passed.

Open validation gaps:

- The child dry-run gate is still using the CPU resident mechanics reference
  path. The next implementation step is to point that child candidate at a
  real mechanics-only split path while keeping this same parity gate.
- The opt-in long-horizon liquid-settling acceptance gate remains the separate
  physics-quality blocker.

## Current Focused Result - 2026-06-14 Measured Mechanics Promotion Reference Evidence

ULG now generates mechanics promotion evidence from actual CPU resident
reference probes. `createUlgMechanicsPromotionReferenceEvidence()` runs
zero-force and gravity-only mechanics dry runs, measures displacement,
velocity error, volume stability, pressure-disabled impulse, and mass
conservation, then feeds those fields into the mechanics promotion evidence
task. Browser authority coverage combines those measured fields with live host
authority evidence from the resident step.

Verified commands:

- ULG:
  `node --check src/runtime/mechanicsPromotionEvidence.js`
  - Passed.
- ULG:
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  and `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: measured `peercompute.ulg.mechanics-promotion-reference-evidence.v0`
    reports CPU resident zero-force and gravity-only probes, then task-wrapped
    mechanics promotion evidence admits the mechanics family through the
    existing admission task.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: browser page imports the measured reference helper, generates
    CPU resident mechanics evidence, combines it with live GPU fence,
    StateManager, committed-delta, owner-map, and visual-sequence evidence,
    and feeds the task-wrapped promotion admission.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-measured-mechanics-evidence-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-measured-mechanics-evidence-20260614/`.
- ULG: `git diff --check`
  - Passed.

Open validation gaps:

- The reference evidence is measured, but mechanics is still not an executable
  child law dry-run. The next authority gate should wrap mechanics as a
  non-mutating child candidate and compare its output against this reference.
- The opt-in long-horizon liquid-settling acceptance gate remains the separate
  physics-quality blocker.

## Current Focused Result - 2026-06-14 Mechanics Promotion Evidence Task

ULG now has a non-mutating ComputeManager task for mechanics promotion
evidence. The task validates structured CPU/reference, conservation,
volume-stability, pressure-disabled, owner-map, GPU fence, StateManager
admission, committed-delta, and visual-sequence evidence, then emits
`peercompute.ulg.mechanics-promotion-evidence.v0`. That artifact feeds the
existing law-family promotion admission task. Child mechanics remains
metadata-only and cannot own writes yet.

Verified commands:

- ULG:
  `node --check src/runtime/peercomputeBrowserResidentHost.js`
  - Passed.
- ULG:
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  and `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: `runUlgMechanicsPromotionEvidenceTask()` accepts structured
    mechanics evidence, the ComputeManager task family
    `ulg-mechanics-promotion-evidence` records one completed task, and the
    resulting artifact admits mechanics through the existing promotion
    admission task.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: browser authority host exposes
    `submitMechanicsPromotionEvidenceTask()`, task-wrapped mechanics evidence
    is accepted, and that artifact feeds task-wrapped mechanics promotion
    admission.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-mechanics-promotion-evidence-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-mechanics-promotion-evidence-20260614/`.
- ULG: `git diff --check`
  - Passed.

Open validation gaps:

- The mechanics evidence task currently validates provided structured evidence;
  it does not yet generate measured dry-run/reference evidence from an
  independent mechanics child task.
- The opt-in long-horizon liquid-settling acceptance gate remains the separate
  physics-quality blocker.

## Current Focused Result - 2026-06-14 Promotion Admission Task Wrapper

ULG now routes promotion admission through real local ComputeManager task
execution. The task wrapper is deliberately non-mutating and uses
`suppressCommitDelta: true`; child law-family descriptors remain
metadata-only and cannot create solver tasks.

Verified commands:

- ULG:
  `node --check src/runtime/peercomputeBrowserResidentHost.js`
  - Passed.
- ULG:
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  and `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: `createUlgLawFamilyPromotionAdmissionComputeTask()` submits
    through ComputeManager, missing mechanics evidence rejects, evidenced
    mechanics admits `particle-kinematics` and `mechanics`, and the task
    family records two completed tasks.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: browser authority host exposes
    `submitLawFamilyPromotionAdmissionTask()`, task-wrapped missing mechanics
    evidence rejects, task-wrapped evidenced mechanics admits, and
    `ulg-law-family-promotion-admission` completed twice.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_RUN_ID=codex-promotion-admission-task-20260614 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=24 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=180000 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-promotion-admission-task-20260614/`.
- ULG: `git diff --check`
  - Passed.

Open validation gaps:

- This is still admission-task plumbing, not independent mechanics execution.
  Mechanics needs stronger reference/dry-run artifacts before it can own
  writes outside the parent pass DAG.
- The opt-in long-horizon liquid-settling acceptance gate remains the separate
  physics-quality blocker.

## Current Focused Result - 2026-06-14 Promotion Admission Gate

ULG now has a ComputeManager-facing promotion admission gate for metadata-only
law families. It consumes the resident law graph manifest and registered
solver descriptors, rejects missing evidence, enforces promotion order, and
admits only the first candidate families when all required evidence is present.
It does not execute mechanics independently yet.

Verified commands:

- ULG:
  `node --check src/runtime/peercomputeBrowserResidentHost.js`
  - Passed.
- ULG:
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  and `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: missing mechanics evidence returns
    `required-evidence-missing`, full mechanics evidence returns
    `promotion-admission-accepted` for `particle-kinematics` and `mechanics`,
    and thermal/phase promotion remains blocked by promotion order.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: real browser authority host exposes
    `ulgLawFamilyPromotionAdmission()`, rejects missing mechanics evidence,
    admits mechanics when the required evidence map is present, and rejects
    thermal/phase as out of order.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_RUN_ID=codex-promotion-admission-gate-20260614 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=24 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=180000 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-promotion-admission-gate-20260614/`.
- ULG: `git diff --check`
  - Passed.

Open validation gaps:

- The gate only admits promotion metadata. It does not yet create an
  executable mechanics child task or prove independent mechanics mutation.
- The opt-in long-horizon liquid-settling acceptance gate remains the separate
  physics-quality blocker.

## Current Focused Result - 2026-06-14 State-Family Owner Map

ULG now carries resident state-family ownership metadata in the law graph
manifest. The pass DAG remains the only current executable owner of admitted
physics state, while child law-family descriptors declare only prospective
ownership until promotion gates pass. Mechanics is recorded as the first
promotion candidate, but it is still metadata-only and cannot create a task.

Verified commands:

- ULG:
  `node --check src/runtime/peercomputeBrowserResidentHost.js`
  - Passed.
- ULG:
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  and `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: manifest owner map status is
    `single-current-owner-per-family`; pass DAG owns current `mechanics`,
    `gas-pressure`, and `pressure-interface`; prospective owners map mechanics
    to `ulg-mls-mpm-mechanics-law`; first promotion candidate is mechanics
    with `particle-kinematics` and `mechanics` families.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: real browser authority summary exposes the same owner-map
    status, no conflicts, current pass-DAG owners, prospective child owners,
    and mechanics first-promotion candidate.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_RUN_ID=codex-state-family-owner-map-20260614 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=24 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=180000 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-state-family-owner-map-20260614/`.
- ULG: `git diff --check`
  - Passed.

Open validation gaps:

- Owner metadata does not yet promote mechanics to an independent worker. The
  next gate should make ComputeManager refuse child-law execution unless the
  required promotion evidence is present.
- The opt-in long-horizon liquid-settling acceptance gate remains the separate
  physics-quality blocker.

## Current Focused Result - 2026-06-14 Law Graph Manifest

ULG now derives a concrete law graph manifest from the resident solver
descriptors registered under the browser PeerCompute authority host. The
manifest is a control-plane object, not a scheduler: it lists graph nodes,
parent/data-dependency edges, executor status, read/write/conserved state
families, validation gates, cache policy, and the metadata-only promotion
policy that blocks child law execution until gates pass.

Verified commands:

- ULG:
  `node --check src/runtime/peercomputeBrowserResidentHost.js`
  - Passed.
- ULG:
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  and `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: manifest schema is
    `peercompute.ulg.law-closure-graph-manifest.v0`, with `nodeCount=5`,
    `edgeCount=7`, executable node
    `ulg-mls-mpm-sph-resident-pass-dag`, four metadata-only law-family nodes,
    sedenion scope in read state families, and product/pressure outputs in
    write state families.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: real browser authority summary exposes manifest schema,
    node/edge counts, executable node IDs, metadata-only node IDs, and the
    `metadata-only-until-gated` promotion rule.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_RUN_ID=codex-law-graph-manifest-20260614 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=24 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=180000 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-law-graph-manifest-20260614/`.

Open validation gaps:

- The manifest does not yet execute independent child law workers. Promotion
  still requires CPU-reference parity, conserved-field checks, GPU lease/fence
  evidence, StateManager admission, and representative visual sequences per
  law family.
- The opt-in long-horizon liquid-settling acceptance gate remains the separate
  physics-quality blocker.

## Current Focused Result - 2026-06-14 Law-Family Descriptors

ULG now publishes the resident law graph shape through PeerCompute
`ComputeManager` solver descriptors without splitting execution yet. The
browser authority host registers one executable pass-DAG solver and four
metadata-only child law-family descriptors: mechanics, thermal/phase,
reaction/product/gas, and pressure/interface. Metadata-only children are
visible to the authority graph but cannot create tasks until their independent
execution gates are implemented and validated.

Verified commands:

- ULG:
  `node --check src/runtime/peercomputeBrowserResidentHost.js`
  - Passed.
- ULG:
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  and `node --check tests/demo.e2e.mjs`
  - Passed.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  - Passed: `7/7` in the file.
  - Evidence: `ulg-mls-mpm-sph-resident-steps` remains executable; all four
    law-family descriptors have `runtime=metadata`, `hasExecutor=false`,
    parent law graph metadata, and `submitSolverTask()` rejection.
- ULG:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Evidence: the real browser NodeKernel/ComputeManager authority host
    reports executable solver IDs, law-family solver IDs, and the law graph
    ID; the child law-family descriptors reject direct task creation.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_RUN_ID=codex-law-family-descriptors-20260614 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=24 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=180000 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-law-family-descriptors-20260614/`.

Open validation gaps:

- Metadata publication does not prove independent law scheduling yet. Each
  child descriptor must earn execution with CPU-reference parity,
  conserved-field checks, GPU fence/lease evidence, StateManager admission,
  and representative visual sequences.
- The opt-in long-horizon liquid-settling acceptance gate remains the separate
  physics-quality blocker.

## Current Focused Result - 2026-06-14 Live Browser Provider Transport

ULG now verifies resident StateManager replication over live browser/libp2p
transport. The gate starts a local WSS PeerCompute relay inside Playwright,
keeps the existing ULG HTTPS Vite server on `:5173`, creates two real browser
PeerCompute `NodeKernel` authority hosts, commits a resident warm delta before
the second host joins, and proves provider sync replays the preexisting
`ulg-sph-resident-pass-dag` delta across the real network path.

Verified commands:

- PeerCompute: `node --check peercompute/src/peercompute/nodeKernel/NodeKernel.js`
  and StateManager/provider syntax checks
  - Passed.
- PeerCompute:
  `node --test peercompute/tests/stateManager.unit.test.js peercompute/tests/unit/nodeKernel.start.test.js`
  - Passed: `6/6`.
  - Evidence: `StateManager.requestProviderSync()` publishes a provider sync
    request after provider initialization, no-ops without a provider, and
    `NodeKernel.start()` requests provider sync after network connect.
- PeerCompute:
  `node --test peercompute/tests/stateManager.unit.test.js peercompute/tests/unit/nodeKernel.start.test.js peercompute/tests/unit/gpuResidentLaneManager.test.js peercompute/tests/unit/computeManager.commitDelta.test.js`
  - Passed: `27/27`.
- ULG:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npx playwright test tests/demo.e2e.mjs --config=tests/playwright.config.mjs --project=chromium --grep "provider transport replays resident warm deltas"`
  - Passed: `1/1`.
  - Evidence: late browser NodeKernel receives the preexisting resident warm
    delta over WSS relay/provider transport; source publishes
    `yjs-sync-response`, replica publishes `yjs-sync-request`, and the replica
    committed-delta reader accepts the warm entry.
- ULG:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `35/35`.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-provider-sync-architecture-20260614 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=2 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=4 node scripts/sph-visual-sanity-matrix.mjs`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=3` for both water scenarios.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-provider-sync-architecture-20260614/`.

Open validation gaps:

- This proves compact resident warm-delta replay over live browser provider
  transport, not full remote resident physics execution across separate
  machines.
- The opt-in long-horizon liquid-settling acceptance gate remains the separate
  physics-quality blocker.

## Current Focused Result - 2026-06-14 PeerComputeProvider Initial Sync

PeerComputeProvider now has an initial Yjs sync handshake, and ULG verifies it
with a resident warm-delta gate. The source StateManager commits the ULG
resident delta before the replica joins; the replica then requests sync via
the real PeerComputeProvider path, receives the missing update, and validates
the preexisting `ulg-sph-resident-pass-dag` warm entry.

Verified commands:

- PeerCompute: `node --check peercompute/src/peercompute/stateManager/PeerComputeProvider.js`
  - Passed.
- PeerCompute: `node --check peercompute/tests/stateManager.unit.test.js`
  - Passed.
- PeerCompute: `node --test peercompute/tests/stateManager.unit.test.js`
  - Passed: `3/3`.
- ULG: `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  - Passed.
- ULG: `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "PeerComputeProvider transports"`
  - Passed: `6/6` in the file.
  - Evidence: replica provider emits `yjs-sync-request`; source provider
    answers with `yjs-sync-response`; the late replica reads the preexisting
    ULG resident warm delta and `readResidentStepsCommittedWarmDelta()` accepts
    it as committed.
- ULG: `node --test tests/peercomputeComputeManagerIntegration.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `35/35`.
- ULG: `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- ULG: `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase (resident steps can use the real browser PeerCompute resident authority host|browser PeerCompute remote placement gate configures hooks without implicit network start|resident auto scheduler can use the default PeerCompute resident authority host)"`
  - Passed: `3/3`.
- ULG: `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_RUN_ID=codex-provider-initial-sync-20260614 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=120000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2`, short-run `J=[0.9997627139091492,1.0019187927246094]`,
    max observed speed `0.08506813645362854 m/s`, and no visible surface
    outside the container or particle bounds.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-provider-initial-sync-20260614/`.

Open validation gaps:

- This proves provider initial sync through in-process NetworkManager shims.
  The next distributed gate is live browser/libp2p NodeKernel transport for
  the same resident-delta path.
- The opt-in long-horizon liquid-settling acceptance gate remains the separate
  physics-quality blocker.

## Current Focused Result - 2026-06-14 PeerComputeProvider Warm-Delta Transport

ULG now has a provider-transport gate for resident StateManager deltas. The
test creates two real sibling PeerCompute `StateManager`s with
`disableNetworkProvider=false`, lets both instantiate real
`PeerComputeProvider`s, and uses a minimal in-process NetworkManager shim only
to deliver `broadcast()` messages to registered provider handlers.

Verified commands:

- `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  - Passed.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "PeerComputeProvider transports"`
  - Passed: `6/6` in the file.
  - Evidence: source provider broadcasts `yjs-update` on
    `ulg-provider-state-sync`; the replica provider applies it; replica warm
    state contains the ULG resident state delta; and
    `readResidentStepsCommittedWarmDelta()` accepts it as committed.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `35/35`.
- `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase (resident steps can use the real browser PeerCompute resident authority host|browser PeerCompute remote placement gate configures hooks without implicit network start|resident auto scheduler can use the default PeerCompute resident authority host)"`
  - Passed: `3/3`.
- `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_RUN_ID=codex-provider-transport-convergence-20260614 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=120000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2`, short-run `J=[0.9997627139091492,1.0019187927246094]`,
    max observed speed `0.08506813645362854 m/s`, and no visible surface
    outside the container or particle bounds.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-provider-transport-convergence-20260614/`.

Open validation gaps:

- This proves the PeerComputeProvider `yjs-update` transport path for a fresh
  resident delta. The initial Yjs state-vector/full-document sync gap this
  exposed is now covered by the 2026-06-14 initial-sync gate above.
- Real browser/libp2p provider transport across live NodeKernel peers remains
  open.
- The opt-in long-horizon liquid-settling acceptance gate remains the separate
  physics-quality blocker.

## Current Focused Result - 2026-06-14 Replicated StateManager Convergence

The redundant NodeKernel remote-placement smoke now proves an extra authority
step: after the requester admits the remote resident commit delta into its real
PeerCompute `StateManager`, the test encodes the requester's Yjs document,
applies it to a second `StateManager`, and verifies the replica can read and
validate the same `ulg-sph-resident-pass-dag` warm delta.

Verified commands:

- `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  - Passed.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "redundant NodeKernel remote placement quorum"`
  - Passed: `5/5` in the file.
  - Evidence: remote primary and replica responders execute through their own
    `ComputeManager`s; requester provenance reports task signing, satisfied GPU
    fence, redundant placement, and quorum accepted; requester `StateManager`
    admits the resident delta; a second `StateManager` receives the encoded
    Yjs update and reads the same committed warm delta.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `34/34`.
- `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- `curl -k -I --max-time 5 https://127.0.0.1:5173/`
  - Passed: live HTTPS Vite server returned `HTTP/2 200`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase (resident steps can use the real browser PeerCompute resident authority host|browser PeerCompute remote placement gate configures hooks without implicit network start|resident auto scheduler can use the default PeerCompute resident authority host)"`
  - Passed: `3/3`.
  - Note: the same grep without the HTTPS base URL timed out during
    `config.webServer` startup because the current live dev server is
    HTTPS-only while the default Playwright base URL is HTTP.
- `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_RUN_ID=codex-replicated-state-convergence-20260614 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=120000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2`, short-run `J=[0.9997627139091492,1.0019187927246094]`,
    max observed speed `0.08506813645362854 m/s`, and no visible surface
    outside the container or particle bounds.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-replicated-state-convergence-20260614/`.

Open validation gaps:

- This proves in-memory Yjs update convergence from admitted requester state to
  a replica `StateManager`. It does not yet prove real browser/provider
  transport convergence across live NodeKernel peers.
- The visual matrix remains short-horizon regression evidence. The opt-in
  long-horizon liquid-settling acceptance gate is still the unresolved
  physics-quality blocker.

## Current Focused Result - 2026-06-14 Remote Placement Smoke

ULG now has an in-memory redundant NodeKernel remote-placement smoke for the
resident pass DAG. It submits a module-backed ULG resident task with
`placementHint.advisoryOnly=false`, runs primary and replica responders through
PeerCompute remote placement, validates quorum, and admits the resulting compact
delta into the requester's real `StateManager`.

Verified commands:

- `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  - Passed.
- `node --check tests/fixtures/ulgRemoteResidentPlacementTask.mjs`
  - Passed.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "redundant NodeKernel remote placement quorum"`
  - Passed: `5/5` in the file, including the focused remote-placement smoke.
  - Evidence: responder `ComputeManager`s execute the remote task but commit no
    deltas; requester provenance reports remote placement, task signing,
    satisfied GPU fence, redundant placement, and quorum accepted; requester
    StateManager warm state contains the admitted resident delta.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `34/34`.
- `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_RUN_ID=codex-remote-placement-smoke-20260614 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=120000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2`, short-run `J=[0.9997627139091492,1.0019187927246094]`,
    max observed speed `0.08506813645362854 m/s`.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-remote-placement-smoke-20260614/`.

Open validation gaps:

- This is an in-memory transport smoke for deterministic resident output, not
  full browser-to-browser distributed physics. The replicated StateManager
  convergence portion is now covered by the 2026-06-14 02:04 gate above; the
  remaining distributed gate is real browser/provider transport across live
  NodeKernel peers.

## Current Focused Result - 2026-06-14 Remote Placement Gate

The browser PeerCompute resident authority host now exposes an explicit remote
placement gate. It can configure `NodeKernel` network placement executors,
`ComputeManager` placement hooks, ULG placement admission, and PeerCompute
remote-result quorum validation without auto-starting networking or making
resident physics remote by default.

Verified commands:

- `node --check src/runtime/peercomputeBrowserResidentHost.js`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "remote placement gate configures hooks" --timeout 120000`
  - Passed: `1/1`.
  - Evidence: `configureRemotePlacement({peerId:"peer-b", replicaPeerIds:["peer-c"]})`
    reports `configured-network-not-started`, wires ComputeManager
    `placementExecutor`, `placementAdmission`, and `placementResultValidator`,
    keeps `nodeKernelStarted=false`, then `clearRemotePlacement()` removes the
    hooks.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "default PeerCompute resident authority host|real browser PeerCompute resident authority host|NodeKernel network gate starts and stops explicitly|remote placement gate configures hooks|StateManager warm-delta admission|resident auto scheduler uses an injected ComputeManager|ComputeManager-shaped GPU lane task" --timeout 180000`
  - Passed: `7/7`.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `33/33`.
- `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_RUN_ID=codex-remote-placement-gate-20260614 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=120000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2`, short-run `J=[0.9997627139091492,1.0019187927246094]`,
    max observed speed `0.08506813645362854 m/s`.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-remote-placement-gate-20260614/`.

Open validation gaps:

- This configures and proves the gate; it does not yet run resident physics on
  a remote peer. The next distributed validation should use explicit
  non-advisory placement hints with a real two-node/browser-local or loopback
  remote placement probe and StateManager admission evidence.

## Current Focused Result - 2026-06-14 Solver-Created Resident Task Bridge

Mounted resident SPH/MLS-MPM scheduling now uses
`SolverRegistry.createTask()` for registered PeerCompute solver
`ulg-mls-mpm-sph-resident-steps` when the active `ComputeManager` exposes a
real solver registry. The bridge preserves the ULG task's root GPU fence,
GPU-resident lane, law-graph, read/write family, return-envelope, and
StateManager commit metadata.

Verified commands:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  - Passed.
- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/sphMlsMpmGpuStep.test.mjs`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "resident steps compute task"`
  - Passed: `29/29`.
  - Evidence: the submit helper calls `solverRegistry.createTask()` and the
    submitted task keeps `peercompute.ulg.mls-mpm-resident-steps-compute-task.v0`,
    `gpuResidentLane`, `gpuFence`, `lawGraphNode`, and
    `peercompute.ulg.mls-mpm-resident-steps-solver-task-bridge.v0`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "real browser PeerCompute resident authority host" --timeout 180000`
  - Passed: `1/1`.
  - Evidence: browser execution reports
    `peerComputeSolverTask.created=true`, solver id
    `ulg-mls-mpm-sph-resident-steps`, solver-task schema
    `peercompute.compute.solver-task.v0`, and warm-delta scope
    `ulg-sph-resident-pass-dag`; scene `computeManagerTask` reports the same
    solver-created bridge.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "default PeerCompute resident authority host|real browser PeerCompute resident authority host|NodeKernel network gate starts and stops explicitly|StateManager warm-delta admission|resident auto scheduler uses an injected ComputeManager|ComputeManager-shaped GPU lane task" --timeout 180000`
  - Passed: `6/6`.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `33/33`.
- `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_RUN_ID=codex-solver-created-resident-task-20260614 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=120000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2`, short-run `J=[0.9997627139091492,1.0019187927246094]`,
    max observed speed `0.08506813645362854 m/s`.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-solver-created-resident-task-20260614/`.

Open validation gaps:

- The short visual matrix is a geometry/volume regression guard, not proof of
  solved liquid settling. The opt-in long-horizon H2O/H2O liquid acceptance
  gate remains the next physics-quality blocker.

## Current Focused Result - 2026-06-14 Resident Solver Descriptor Registration

The browser NodeKernel `ComputeManager` now registers ULG's resident
SPH/MLS-MPM pass DAG in PeerCompute `SolverRegistry` as
`ulg-mls-mpm-sph-resident-steps`.

Verified commands:

- `node --check src/runtime/peercomputeBrowserResidentHost.js`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "real browser PeerCompute resident authority host" --timeout 180000`
  - Passed: `1/1`.
  - Evidence: the real browser authority host reports
    `residentSolverRegistrationStatus=registered`; `ComputeManager.listSolvers()`
    contains `peercompute.compute.solver-descriptor.v0` for
    `ulg-mls-mpm-sph-resident-steps` with module
    `/src/runtime/sph/sphMlsMpmGpuStep.js`, warm-delta scope
    `ulg-sph-resident-pass-dag`, law node
    `ulg-mls-mpm-sph-resident-pass-dag`, and WebGPU residency `gpu-lane`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "default PeerCompute resident authority host|real browser PeerCompute resident authority host|NodeKernel network gate starts and stops explicitly|StateManager warm-delta admission|resident auto scheduler uses an injected ComputeManager|ComputeManager-shaped GPU lane task" --timeout 180000`
  - Passed: `6/6`.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `33/33`.
- `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_RUN_ID=codex-resident-solver-registry-20260614 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=120000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2`.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-resident-solver-registry-20260614/`.

Follow-up:

- Completed by the 2026-06-14 solver-created resident task bridge: mounted
  scheduling now uses `SolverRegistry.createTask()` when the real solver
  registry is available while preserving GPU-lane, fence, and StateManager
  admission evidence.

## Current Focused Result - 2026-06-14 Explicit NodeKernel Network Gate

The browser PeerCompute resident authority host remains local/no-start by
default, but it now exposes explicit `startNodeKernelNetwork()` and
`stopNodeKernelNetwork()` controls with
`peercompute.ulg.nodekernel-network-gate.v0` evidence. The stop path disconnects
`NetworkManager` without destroying `StateManager`, so warm resident authority
survives temporary network tests.

Verified commands:

- `node --check src/runtime/peercomputeBrowserResidentHost.js`
  - Passed.
- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "NodeKernel network gate starts and stops explicitly" --timeout 120000`
  - Passed: `1/1`.
  - Evidence: host summary starts with `nodeKernelNetworkGateStatus=not-started`,
    `startNodeKernelNetwork()` reports `started` and a browser libp2p peer id,
    `stopNodeKernelNetwork()` reports `stopped-network-only`, and
    `ComputeManager`/`StateManager` are still usable after network stop.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "default PeerCompute resident authority host|real browser PeerCompute resident authority host|NodeKernel network gate starts and stops explicitly|StateManager warm-delta admission|resident auto scheduler uses an injected ComputeManager|ComputeManager-shaped GPU lane task" --timeout 180000`
  - Passed: `6/6`.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `33/33`.
- `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_RUN_ID=codex-nodekernel-network-gate-20260614 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=120000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2`.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-nodekernel-network-gate-20260614/`.

Open validation gaps:

- This is a local browser libp2p start/stop gate with zero peers. It does not
  prove remote placement, quorum validation, replicated StateManager
  convergence, or distributed physics execution.

## Current Focused Result - 2026-06-14 Real NodeKernel Browser Authority

The mounted browser resident authority host now initializes a real sibling
PeerCompute `NodeKernel` locally by default. The node is initialized but not
P2P-started; its real `ComputeManager`, `StateManager`, and `GPUHub` own the
default resident authority path. A direct-manager facade remains only as a
fallback.

Verified commands:

- `node --check src/runtime/peercomputeBrowserResidentHost.js`
  - Passed.
- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "default PeerCompute resident authority host|real browser PeerCompute resident authority host" --timeout 180000`
  - Passed: `2/2`.
  - Evidence: both direct and default mounted resident paths report
    `peercompute-browser-nodekernel-authority-host`,
    `nodeKernelMode=real-peercompute-nodekernel`, constructor `NodeKernel`,
    initialized authority metadata, and non-started P2P state.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "default PeerCompute resident authority host|real browser PeerCompute resident authority host|StateManager warm-delta admission|resident auto scheduler uses an injected ComputeManager|ComputeManager-shaped GPU lane task" --timeout 180000`
  - Passed: `5/5`.
  - Evidence: ComputeManager lanes, StateManager warm-delta admission,
    default NodeKernel authority, direct NodeKernel authority, and injected
    ComputeManager precedence all stayed green.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `33/33`.
- `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_RUN_ID=codex-real-nodekernel-authority-20260614 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=120000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2`.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-real-nodekernel-authority-20260614/`.

Open validation gaps:

- The node is initialized locally but not connected. Distributed start,
  peer discovery, remote placement, quorum validation, and live provider
  StateManager convergence still need explicit gates. Later slices now cover
  remote placement/quorum and in-memory replicated StateManager convergence;
  real browser/provider transport remains open.
- Long-horizon same-material liquid settling remains a separate quality gate.

## Current Focused Result - 2026-06-14 Browser PeerCompute Resident Authority Host

The mounted browser route can now instantiate a local PeerCompute authority
host by default and run resident SPH/MLS-MPM batches through the real sibling
PeerCompute `ComputeManager` and `StateManager` before scene publication.
Injected/explicit ComputeManagers still take precedence and are not paired with
the default authority host's StateManager.

Verified commands:

- `node --check src/runtime/peercomputeBrowserResidentHost.js`
  - Passed.
- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "default PeerCompute resident authority host|real browser PeerCompute resident authority host|StateManager warm-delta admission|resident auto scheduler uses an injected ComputeManager|ComputeManager-shaped GPU lane task" --timeout 180000`
  - Passed: `5/5`.
  - Evidence: the browser-default host reports
    `peercompute.ulg.browser-resident-authority-host.v0`, routes auto resident
    batches through source `peercompute-resident-authority-host`, commits the
    compact resident state delta into PeerCompute warm state, and preserves
    injected ComputeManager precedence with status `inline-execution-returned`.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `33/33`.
- `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in long-horizon liquid skip.
- `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_RUN_ID=codex-browser-peercompute-host-20260614 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=120000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2`.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-browser-peercompute-host-20260614/`.

Open validation gaps:

- The browser host is a local NodeKernel-shaped facade around real
  PeerCompute managers, not the full distributed NodeKernel/libp2p stack.
- Later slices now cover quorum validation, non-advisory in-memory remote
  resident placement, and in-memory replicated StateManager convergence.
  Remote GPU resident placement over real browser/provider transport remains
  unproven.
- Long-horizon same-material liquid settling remains a separate quality gate.

## Current Focused Result - 2026-06-14 StateManager-Backed Scene Publication Gate

The mounted/scene resident path can now require a matching StateManager warm
delta before publishing ComputeManager-returned hot execution artifacts as
local scene state.

Verified commands:

- `node --check src/runtime/peercomputeResidentCommitBridge.js`
  - Passed.
- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check tests/demo.e2e.mjs && node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  - Passed.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `33/33`.
  - Evidence: the real sibling PeerCompute integration still admits compact
    resident deltas into real `StateManager` warm state, and the bridge helper
    can read/validate the committed warm entry.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "StateManager warm-delta admission|ComputeManager-shaped GPU lane task|resident auto scheduler uses an injected ComputeManager" --timeout 180000`
  - Passed: `3/3`.
  - Evidence: a browser scene using a ComputeManager-shaped submitter and
    StateManager-shaped warm store publishes resident execution with
    `computeManagerTask.status =
    state-manager-committed-inline-execution-returned`, accepted
    `peercompute.ulg.resident-state-commit-admission.v0` evidence, and a
    committed `peercompute.ulg.mls-mpm-resident-steps-state-delta.v0`.
- `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in skip.
- `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_RUN_ID=codex-state-manager-publication-20260614 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=120000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2`.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-state-manager-publication-20260614/`.

Open validation gaps:

- The browser route still needs a real PeerCompute/NodeKernel host by default;
  this slice accepts injected/provided StateManager-shaped authority.
- Distributed placement, quorum validation, and replicated StateManager
  convergence are not covered by this scene publication gate.

## Current Focused Result - 2026-06-13 StateManager Admission Bridge

ULG now has a narrow bridge that validates resident sequence commit deltas
before handing them to PeerCompute `StateManager`/`DataState`.

Verified commands:

- `node --check src/runtime/peercomputeResidentCommitBridge.js`
  - Passed.
- `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  - Passed.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs`
  - Passed: `4/4`.
  - Evidence: a ULG resident sequence/pass-DAG task submitted through the real
    sibling PeerCompute `ComputeManager` acquired/completed the GPU resident
    lane, returned satisfied fence evidence, passed the ULG bridge admission
    gate, and committed
    `peercompute.ulg.mls-mpm-resident-steps-state-delta.v0` into real
    PeerCompute `StateManager` warm state under scope
    `ulg-sph-resident-pass-dag`.
  - Negative evidence: a result with a satisfied top-level task fence but an
    unsatisfied payload fence was rejected with
    `ERR_ULG_RESIDENT_DELTA_REJECTED`, committed no warm delta, and counted as
    a failed ComputeManager task.
- `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_RUN_ID=codex-state-admission-bridge-20260613 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=120000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2`.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-state-admission-bridge-20260613/`.

Open validation gaps:

- The mounted browser scene does not yet instantiate a real PeerCompute
  NodeKernel/StateManager host or read accepted state back from StateManager
  before publishing local scene state.
- Distributed placement, quorum validation, and network-responder
  StateManager replication still need separate gates.

## Current Focused Result - 2026-06-13 Resident Sequence Commit Delta Envelope

The real resident sequence/pass-DAG task handler now emits a compact
StateManager-ready commit delta, instead of requiring test-only glue to provide
one.

Verified commands:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  - Passed.
- `node --check tests/sphMlsMpmGpuStep.test.mjs`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "resident steps compute task"`
  - Passed.
  - Evidence: `runMlsMpmResidentStepsComputeTask()` returns
    `peercompute.ulg.mls-mpm-resident-steps-commit-delta.v0` with compact
    `peercompute.ulg.mls-mpm-resident-steps-state-delta.v0` payload carrying
    the state key, law graph node, expected output families, satisfied
    GPU-fence report, retained-buffer refs, final-step summary, and recent
    step summaries.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `31/31`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "ComputeManager-shaped GPU lane task|resident auto scheduler uses an injected ComputeManager" --timeout 180000`
  - Passed: `2/2`.
- `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in skip.
- `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_RUN_ID=codex-resident-commit-delta-20260613 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=120000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2`.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-resident-commit-delta-20260613/`.

Open validation gaps:

- The compact delta is emitted and PeerCompute can commit deltas, but ULG does
  not yet route scene state publication through a real StateManager committed
  state readback.
- The delta is intentionally compact; full retained GPU state still needs
  lane-owned buffer references and admission semantics under the real
  GPUHub/StateManager host.

## Current Focused Result - 2026-06-13 Mounted Resident Scheduler ComputeManager Wiring

The mounted SPH phase demo auto scheduler can now use a provided
ComputeManager-compatible resident lane host instead of only direct
scene-local execution.

Verified commands:

- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `git diff --check`
  - Passed.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "resident auto scheduler uses an injected ComputeManager" --timeout 180000`
  - Passed: `1/1`.
  - Evidence: a `globalThis.__ulgResidentComputeManager` injected before page
    load was discovered by the mounted resident scheduler, the automatic
    resident sequence submitted a
    `peercompute.ulg.mls-mpm-resident-steps-compute-task.v0` task on
    `ulg:sph-resident:demo-auto`, and the scene published an inline
    `peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0` envelope with
    satisfied GPU-fence evidence.
- `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_RUN_ID=codex-resident-auto-manager-20260613 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=120000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2`.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-resident-auto-manager-20260613/`.

Open validation gaps:

- The demo discovers an injected/provided manager; it does not yet bundle or
  instantiate the real PeerCompute manager in the browser route.
- The local scene still publishes inline execution envelopes directly; accepted
  asynchronous results need the future StateManager committed-delta read path.

## Current Focused Result - 2026-06-13 Real PeerCompute Lane Contract Gate

The ULG resident SPH/MLS-MPM pass-DAG task shape now has a direct contract test
against the real sibling PeerCompute `ComputeManager`, not only a fake scene
submitter.

Verified commands:

- `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  - Passed.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs`
  - Passed: `2/2`.
  - Evidence: a `createMlsMpmResidentStepsComputeTask()` task submitted through
    PeerCompute `ComputeManager` acquired/completed a GPU resident lane lease,
    attached satisfied `peercompute.compute.gpu-fence-report.v0` evidence,
    emitted `peercompute.compute.task-execution.v0`, and committed a
    `ulg-sph-resident-pass-dag` delta only after the fence was satisfied.
  - Negative evidence: the same ULG resident pass-DAG task shape with a
    required GPU fence but no fence report was rejected with
    `ERR_COMPUTE_GPU_FENCE_UNSATISFIED`, committed no delta, and released the
    lane with `gpu-fence-report-missing`.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `31/31`.
- `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in skip.
- `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_RUN_ID=codex-peercompute-contract-20260613 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=120000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`,
    `frameCount=2`.
  - Frames and logs:
    `/tmp/ulg-visual-sanity-matrix/codex-peercompute-contract-20260613/`.

Open validation gaps:

- This is still a local inline ComputeManager execution contract. It does not
  prove NodeKernel network responder transport, distributed placement, or
  StateManager committed-delta retrieval.
- The browser scene still uses an optional submitter boundary; it is not yet
  wired to instantiate and own the real PeerCompute manager/lane host.

## Current Focused Result - 2026-06-13 ComputeManager Resident Sequence Boundary

The resident SPH/MLS-MPM sequence can now cross a ComputeManager-shaped GPU
resident lane task boundary while preserving the existing CPU/reference and
visual validation gates.

Verified commands:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  - Passed.
- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/sphMlsMpmGpuStep.test.mjs`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs`
  - Passed: `71/71`.
  - New coverage: sequence-level ComputeManager task declarations, law-graph
    node metadata, no local double-leasing in the task handler, and
    ComputeManager-compatible submit helper.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "ComputeManager-shaped GPU lane task" --timeout 150000`
  - Passed: `1/1`.
  - Evidence: scene `refreshMlsMpmResidentSteps()` submitted through a fake
    inline ComputeManager, returned a
    `peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0` envelope,
    carried `ulg-mls-mpm-sph-resident-pass-dag` law-node metadata, and
    returned satisfied GPU fence evidence.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "retained surface draw diagnostics build under budget" --timeout 150000`
  - Passed: `1/1`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "mounted resident Na/H2O promotes product gas pressure" --timeout 150000`
  - Passed: `1/1`.
- `npm run test:physics-atomics`
  - Passed: `5` pass, `1` expected opt-in skip.
- `ULG_RUN_LONG_LIQUID_ATOMIC=1 npm run test:physics-liquid-atomic`
  - Passed: `6/6`.
- `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_RUN_ID=codex-compute-manager-slice-20260613 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=12 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_TIMEOUT_MS=120000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, `issues=[]`, frames written under
    `/tmp/ulg-visual-sanity-matrix/codex-compute-manager-slice-20260613/`.

Open validation gaps:

- This proves an inline ComputeManager-shaped task boundary, not a distributed
  NodeKernel/StateManager admission path.
- Submit-only/asynchronous ComputeManager results are intentionally not
  accepted as scene-local state until StateManager committed-delta retrieval is
  implemented.

## Current Focused Result - 2026-06-13 Retained Surface-Vertex Diagnostic

The no-full resident render diagnostic can now prove the render-field plus
surface-vertex resident path under HTTPS without entering the compact
surface-draw metadata/readback path that currently hangs Chromium/SwiftShader.

Verified commands:

- `node --check src/runtime/sph/sphRenderGpuKernel.js`
  - Passed.
- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/sphRenderGpuKernel.test.mjs`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs`
  - Passed: `42/42`.
  - Includes deferred no-full queue-fence coverage for retained
    surface-vertex handoff and compact surface-draw metadata summary fencing.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "retained surface draw diagnostics build under budget" --timeout 150000`
  - Passed: `1/1` in `24.8s` against the HTTPS Vite server on
    `0.0.0.0:5173`.
  - Evidence: resident physics stages completed, render rows and render field
    stayed no-full-readback, the diagnostic reached
    `resident-surface-vertex-buffers-retained`, retained a
    `vertexRowsBuffer`, and did not build draw rows, indirect rows, compacted
    vertex rows, or summary readback.
  - Harness note: the focused browser test must explicitly dispose the scene
    after collecting the primitive payload, otherwise active animation plus
    retained WebGPU buffers can keep Playwright teardown alive until timeout.

Open validation gaps:

- Compact surface-draw metadata/readback is still a separate failing lane; this
  test deliberately defers it for no-overlay diagnostics.
- The liquid/solid pulsing, settling, and free-surface behavior remains
  unresolved by this checkpoint.
- The normal visible path still needs a GPU-resident draw bridge that renders
  continuous surfaces without CPU `MarchingCubes` readback.

## Current Focused Result - 2026-06-13 G2P Params ABI Regression

The catastrophic no-full resident zero-output bug is now pinned by a focused
WebGPU ABI regression. G2P had an 80-byte uniform payload but allocated a
64-byte params buffer, so no-full WebGPU execution could silently retain zeroed
output rows after the shader saw invalid params.

Verified commands:

- `node --check src/runtime/sph/sphG2pGpuKernel.js && node --check tests/sphG2pGpuKernel.test.mjs && node --test tests/sphG2pGpuKernel.test.mjs`
  - Passed: `16/16`.
  - Includes `WebGPU MLS-MPM G2P params buffer fits the full uniform payload`,
    which fails if `queue.writeBuffer()` writes more bytes than the created
    params buffer can hold.
- `node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check tests/sphMlsMpmGpuStep.test.mjs && node --check src/runtime/sph/sphG2pGpuKernel.js && node --check tests/sphG2pGpuKernel.test.mjs`
  - Passed.
- `node --test tests/sphG2pGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed: `106/106`.
- `node --test tests/webgpuKernelAbi.test.mjs tests/sphG2pGpuKernel.test.mjs tests/sphGridGpuKernel.test.mjs tests/sphGridUpdateGpuKernel.test.mjs tests/sphThermalGpuKernel.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed: `165/165`.
  - Adds cross-kernel params ABI coverage for `16` resident WebGPU params
    contracts. The guard compares WGSL scalar param struct byte length, JS
    ArrayBuffer byte length, WebGPU uniform buffer allocation size, and the
    writeBuffer factory call.
- `npm run test:physics-atomics`
  - Passed the expected fast gate: `5` pass, `1` opt-in long-horizon liquid
    skip.
- `npm test`
  - Passed: `496` pass, `1` skipped.
- `npm run icc:update`
  - Passed after the code/doc/test updates: `227` indexed files and `1071`
    memory chunks.

Probe evidence:

- `/tmp/ulg-h2o-mlsmpm-nofull-buffer-debug-1step-nothermal-fixed.json`
  - Direct no-full resident H2O/H2O, thermal disabled: classified `good`,
    conserved mass, nonzero G2P output, bounded J, pressure impulse `0`.
- `/tmp/ulg-h2o-mlsmpm-fullreadback-direct-1step-g2pdebug-fixed.json`
  - Direct full-readback H2O/H2O: classified `good`; WebGPU G2P parity passed
    with `maxStateAbs ~= 7.45e-9` and `maxMechanicsAbs ~= 4.46e-9`.
- `/tmp/ulg-h2o-mlsmpm-nofull-buffer-debug-1step-thermal-fixed-no-stage-fences.json`
  - Direct no-full thermal-on H2O/H2O: classified `good` after removing
    temporary per-stage fences; compact summary still dominated the one-step
    run at about `3.24 s`.
- `/tmp/ulg-scene-nofull-h2oh2o-fixed.json`
  - Mounted H2O/H2O no-full scene probe: classified `good`, H2O visible in all
    sampled frames, no visual surface issues.
- `/tmp/ulg-scene-cpusph-h2oh2o-fixed.json`
  - Mounted CPU-SPH H2O/H2O scene probe: classified `good`, H2O visible in all
    sampled frames, no visual surface issues.

Open validation gaps:

- This closes the catastrophic zero-output/no-full resident failure, not the
  final liquid-settling/free-surface quality problem.
- Add comparable JS/WGSL ABI size tests for every resident law kernel with
  new params structs as they are introduced. Existing scalar params contracts
  are now guarded; storage row-layout drift remains covered by row-layout ABI
  tests.
- Add a mobile/page-visibility CPU-SPH render lifecycle probe before declaring
  the phone-only blank/flash symptom fixed.

## Current Focused Result - 2026-06-13 Liquid-Stability Gate

The opt-in node-level long-horizon same-material liquid gate is now a passing
acceptance check for the first liquid-stability remediation slice.

Verified commands:

- `npm run test:physics-atomics`
  - Passed the default fast gate: `5` pass, `1` skipped.
  - The skipped case is the long-horizon H2O/H2O liquid settling acceptance
    gate. It remains opt-in because it is slower than the default atomics.
- `ULG_RUN_LONG_LIQUID_ATOMIC=1 npm run test:physics-liquid-atomic`
  - Passed: `6/6`. The prior failing H2O/H2O MLS-MPM setup reaches the
    declared horizon with mass conserved, J bounded, and final drop speed under
    the `0.25 m/s` acceptance threshold.
- `npm test`
  - Passed: `484` pass, `1` skipped.

CPU-SPH mobile/page lifecycle validation, 2026-06-13 20:02 AKDT:

- `node --check src/visualization/sphPhaseScene.js tests/demo.e2e.mjs`
  - Passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5630 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5630 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5630 --strictPort' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "CPU-SPH view refreshes" --timeout 120000`
  - Passed: `1/1`.
  - Evidence: mobile-sized H2O/H2O `mech=sph` scene steps without blocking,
    reports `mechanics mode   : sph`, completes a two-frame viewport refresh
    burst after synthetic `visibilitychange`/`pageshow`, and retains at least
    one visible H2O CPU-particle MarchingCubes surface.
- `node --test tests/sphPhaseRenderer.test.mjs tests/sphRenderGpuKernel.test.mjs`
  - Passed: `65/65`.
- `git diff --check`
  - Passed.
- `npm run icc:update`
  - Passed.

No-full surface-summary skip validation, 2026-06-13 20:15 AKDT:

- `node --check src/visualization/sphPhaseScene.js scripts/sph-long-horizon-probe.mjs tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed: `65/65`.
- `ULG_PROBE_MODE=scene ULG_PROBE_PORT=5632 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.01&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=2 ULG_PROBE_BATCH_STEPS=1 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_FIELD_SURFACE_SUMMARY_MODE=skip ULG_PROBE_TIMEOUT_MS=120000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-no-full-render-summary-skip-smoke-2.json node scripts/sph-long-horizon-probe.mjs`
  - Passed/classified `good`.
  - Evidence: `renderFieldSurfaceSummaryMode=skip`,
    `renderFieldSurfaceSummarySkipped=true`, render rows readback `false`,
    render field readback `false`, compact surface summary readback `false`,
    and `surfaceDrawStatus=resident-surface-draw-summary-skipped` on both
    resident-batch samples.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5633 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5633 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5633 --strictPort' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "no-full render refresh can skip" --timeout 120000`
  - Passed: `1/1`.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5634 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5634 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5634 --strictPort' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "no-full render refresh can skip|CPU-SPH view refreshes" --timeout 120000`
  - Passed: `2/2`.

Compact summary scope validation, 2026-06-13 19:50 AKDT:

- `node --check src/runtime/sph/sphMlsMpmGpuSummary.js src/runtime/sph/sphMlsMpmGpuStep.js src/visualization/sphPhaseScene.js scripts/sph-long-horizon-probe.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `26/26`.
  - New coverage: `particle-visual` compact summaries allocate/dispatch one
    particle-sized partial summary for a small particle set even when the grid
    has many nodes, and report active-grid evidence as not requested.
- `node --test tests/sphMlsMpmGpuStep.test.mjs tests/webgpuKernelAbi.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed: `92/92`.
- `npm run test:physics-atomics`
  - Passed: `5` pass, `1` skipped opt-in long-horizon liquid gate.
- `ULG_PROBE_MODE=direct-resident ... ULG_PROBE_BATCHES=2 ULG_PROBE_BATCH_STEPS=1 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_COMPACT_SUMMARY_SCOPE=particle-visual node scripts/sph-long-horizon-probe.mjs`
  - Passed/classified `good`.
  - Evidence: `gridNodeScanCount=0`, `activeGridNodeCount=null`,
    `activeGridNodeCountAvailable=false`, no analysis issues, compact summary
    timings about `3026 ms` cold and `230 ms` warm.
- `ULG_PROBE_MODE=direct-resident ... ULG_PROBE_BATCHES=2 ULG_PROBE_BATCH_STEPS=1 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_COMPACT_SUMMARY_SCOPE=full node scripts/sph-long-horizon-probe.mjs`
  - Passed/classified `good`.
  - Comparison evidence: `gridNodeScanCount=13824`,
    `activeGridNodeCount=280`, compact summary timings about `3248 ms` cold
    and `295 ms` warm.
- `git diff --check`
  - Passed.
- `npm run icc:update`
  - Passed: `227` indexed files and `1076` memory chunks.

Long liquid damping and mounted CPU-SPH validation, 2026-06-13 18:55 AKDT:

- `node --check src/runtime/sph/mlsMpmCarrier.js src/runtime/sphPhaseDemo.js src/runtime/sph/sphGpuBuffers.js src/runtime/sph/sphG2pGpuKernel.js ulg-gpu-abi/src/wgsl.js src/visualization/sphPhaseScene.js scripts/sph-long-horizon-probe.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed.
- `ULG_RUN_LONG_LIQUID_ATOMIC=1 node --test tests/physicsBehaviorInvariants.test.mjs`
  - Passed: `6/6`.
- `node --test tests/sphG2pGpuKernel.test.mjs`
  - Passed: `15/15`, including the CPU G2P liquid wall-damping regression.
- `ULG_RUN_LONG_LIQUID_ATOMIC=1 node --test tests/physicsBehaviorInvariants.test.mjs tests/sphPhaseDemo.test.mjs tests/sphG2pGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `71/71`.
- `node --test tests/sphPhaseRenderer.test.mjs tests/sphRenderGpuKernel.test.mjs`
  - Passed: `60/60`.
- Mounted CPU-SPH browser probe:
  `ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.01&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=sph&lawr=0' ULG_PROBE_OUTPUT=/tmp/ulg-h2o-cpu-sph-scene-probe-fixed2.json ULG_PROBE_PORT=5612 ULG_PROBE_BATCHES=2 ULG_PROBE_BATCH_STEPS=12 ULG_PROBE_INITIAL_RESIDENT_WAIT_MS=1000 ULG_PROBE_CAPTURE_FRAMES=1 ULG_PROBE_FRAME_DIR=/tmp/ulg-h2o-cpu-sph-frames-fixed2 ULG_PROBE_FRAME_EVERY=1 ULG_PROBE_FRAME_MAX=10 ULG_PROBE_TIMEOUT_MS=60000 node scripts/sph-long-horizon-probe.mjs`
  - Passed/classified `good`.
  - Evidence: `issues=[]`, `maxSpeedObservedMPerS=0.1412157416`,
    `maxDisplacementObservedM=0.00076258`, H2O visible samples `3/3`,
    no visual surface issues, and frames written under
    `/tmp/ulg-h2o-cpu-sph-frames-fixed2/`.
- Mounted MLS-MPM H2O/H2O full-readback browser probe:
  `ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&lawr=0' ULG_PROBE_OUTPUT=/tmp/ulg-h2o-mlsmpm-scene-probe-full.json ULG_PROBE_PORT=5614 ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=16 ULG_PROBE_INITIAL_RESIDENT_WAIT_MS=1000 ULG_PROBE_READBACK_MODE=full-parity-readback ULG_PROBE_RENDER_READBACK_MODE=full-parity-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=full-parity-readback ULG_PROBE_CAPTURE_FRAMES=1 ULG_PROBE_FRAME_DIR=/tmp/ulg-h2o-mlsmpm-frames-full ULG_PROBE_FRAME_EVERY=1 ULG_PROBE_FRAME_MAX=6 ULG_PROBE_TIMEOUT_MS=90000 node scripts/sph-long-horizon-probe.mjs`
  - Passed/classified `good`.
  - Evidence: `maxSpeedObservedMPerS=0.1055575673`,
    `maxDisplacementObservedM=0.00005294`, active grid nodes `248`,
    `J=0.999684..1.002948`, zero pressure impulse, H2O visible samples `2/2`,
    and `visualSurfaceIssues=[]`.
  - Caveat: the no-full resident render path still cannot prove fresh
    MarchingCubes surfaces cheaply; full-readback remains the correctness path
    until resident visual summaries move into the GPU lane.

Thermal/Debye/reaction-scope and frame-capture validation, 2026-06-13 AKDT:

- `node --check src/runtime/sph/thermalPhase.js src/runtime/sph/sphThermalGpuKernel.js`
  - Passed.
- `node --test tests/sphThermalGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs`
  - Passed: `35/35`.
- `node --check src/runtime/chemistry/reactionCandidates.js src/runtime/sph/reactionDiscovery.js tests/reactionDiscovery.test.mjs tests/chemistryReactionCandidates.test.mjs tests/sphThermalGpuKernel.test.mjs`
  - Passed.
- `node --test tests/chemistryReactionCandidates.test.mjs tests/reactionDiscovery.test.mjs tests/sphThermalGpuKernel.test.mjs`
  - Passed: `24/24`.
- Direct resident hot H2O/H2O, `16` substeps, all laws:
  - Passed/classified stable after the thermal limiter.
  - Evidence: `maxSpeedMPerS=0.19544`, `minVolumeRatioJ=0.80181`,
    `maxVolumeRatioJ=1.00118`, `minTemperatureK=299.859`,
    `maxTemperatureK=449.410`, liquid H2O remains dominant.
- Direct resident Fe/H2O, `16` substeps, reactions disabled:
  - Passed after Debye graph expansion.
  - Evidence: `minTemperatureK=299.431976`, `maxTemperatureK=300`,
    no spurious cooling to ~130 K.
- Direct resident Fe/H2O, `16` substeps, all laws:
  - Passed after reaction candidate scoping.
  - Evidence: `reactionCount=0`, Fe remains solid, H2O remains liquid, no
    thousands-K heat spike.
- Direct resident Na/H2O, `16` substeps, all laws:
  - Passed mechanically and still discovers the intended reactive family.
  - Evidence: `reactionCount=1`; this remains a thermochemistry/barrier
    validation target, not a reason to remove the law.
- `node --check scripts/sph-long-horizon-probe.mjs`
  - Passed.
- `node --check scripts/sph-visual-sanity-matrix.mjs`
  - Passed.
- `ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_OUTPUT=/tmp/ulg-frame-check/result.json ULG_PROBE_FRAME_DIR=/tmp/ulg-frame-check/frames ULG_PROBE_CAPTURE_FRAMES=1 ULG_PROBE_FRAME_EVERY=1 ULG_PROBE_PORT=5585 ULG_PROBE_BATCHES=2 ULG_PROBE_BATCH_STEPS=2 ULG_PROBE_TIMEOUT_MS=120000 node scripts/sph-long-horizon-probe.mjs`
  - Passed/classified `good`.
  - Artifacts: `/tmp/ulg-frame-check/frames/0000-b000-initial.png`,
    `/tmp/ulg-frame-check/frames/0001-b001-resident-batch.png`,
    `/tmp/ulg-frame-check/frames/0002-b002-resident-batch.png`.
  - Evidence: all three files are valid `1280 x 800` PNGs, probe
    `frameCount=3`, `writtenFrameCount=3`, `issues=[]`.
- `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_RUN_ID=codex-frame-smoke ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_BASE_PORT=5586 ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=2 ULG_VISUAL_MATRIX_TIMEOUT_MS=60000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 npm run probe:sph-visual-matrix`
  - Passed with `failedCount=0`, scenario status `good`, `frameCount=2`.
  - Artifacts: `/tmp/ulg-visual-sanity-matrix/codex-frame-smoke/`.

Open validation gaps:

- Last small representative matrix before frame-capture wiring was `4/5`:
  liquid/liquid MLS-MPM, CPU-SPH, Fe/H2O, and hot H2O passed; Na/H2O timed out
  in mounted scene mode while direct resident Na/H2O passed. Treat this as a
  product-closure/render-scene orchestration gate.
- The phone CPU-SPH render flash/disappear report is not reproduced by the
  desktop probe yet. Add a mobile viewport/page-visibility RAF lifecycle probe
  before declaring that path closed.

Hydrostatic prestrain and condensed-J guard validation, 2026-06-13 AKDT:

- `npm run test:physics-atomics`
  - Passed: `5` pass, `1` skipped.
  - This previously failed because the EOS-on H2O/H2O contact case started
    with hydrostatic liquid `mpmJ` around `0.801..0.952` and then drifted
    outside the `0.95..1.05` gate.
- `node --test tests/physicsBehaviorInvariants.test.mjs tests/sphPhaseDemo.test.mjs tests/sphG2pGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `69/69`, `1` skipped.
- Direct resident WebGPU mechanics comparison:
  `ULG_PROBE_MODE=direct-resident ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&wxmin=293.15&wxmax=293.15&wymin=293.15&wymax=293.15&wzmin=293.15&wzmax=293.15&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&lawt=0&lawr=0' ULG_PROBE_OUTPUT=/tmp/ulg-atomic-current-eos-direct-after-jguard.json ULG_PROBE_PORT=5588 ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=256 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_MIN_J=0.95 ULG_PROBE_MAX_J=1.05 ULG_PROBE_TIMEOUT_MS=120000 node scripts/sph-long-horizon-probe.mjs`
  - Passed/classified `good`.
  - Evidence: `minVolumeRatioJ=0.9999914169311523`,
    `maxVolumeRatioJ=1.0490002632141113`, drop COM
    `1.25 -> 1.199495553970337`, pressure impulse `0`.
  - Performance note: compact summary dominated this run at about `51.7s`,
    so the result is correctness evidence, not throughput evidence.

Representative visual sanity matrix validation, 2026-06-13 15:01 AKDT:

- `node --check scripts/sph-visual-sanity-matrix.mjs`
  - Passed.
- `node scripts/sph-visual-sanity-matrix.mjs --list`
  - Passed; scenario labels:
    `liquid-liquid-h2o-mlsmpm`, `liquid-liquid-h2o-cpu-sph`,
    `solid-liquid-contact-fe-h2o`, `phase-change-hot-h2o-water`,
    `reaction-product-na-h2o`.
- `ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_RUN_ID=codex-smoke-cpu-sph ULG_VISUAL_MATRIX_BASE_PORT=5320 ULG_VISUAL_MATRIX_BATCHES=3 ULG_VISUAL_MATRIX_BATCH_STEPS=16 npm run probe:sph-visual-matrix`
  - Passed/classified `good`, `failedCount=0`, `issues=[]`,
    `visualSurfaceIssues=[]`.
  - Summary path:
    `/tmp/ulg-visual-sanity-matrix/codex-smoke-cpu-sph/summary.json`.

Scope limits:

- This is a reduced-demo stability gate, not a final water model or multiscale
  claim. Keep the gate mandatory for mechanics edits, then add surface
  tension/free-surface checks, broader visual sequences, and ComputeManager/
  GPUHub lane scheduling for the accepted law DAG.

## Current Focused Result - 2026-06-13 Atomic Physics Gate

Added and verified a fast atomic behavior gate for SPH/MLS-MPM regressions.

Verified commands:

- `npm run test:physics-atomics`
  - Passed the default gate, `5` pass plus the skipped long-horizon liquid
    acceptance case.
  - Covers resident zero-force rest, resident gravity-only free-space motion
    against semi-implicit Euler, mass conservation, zero pressure impulse when
    pressure is disabled, and H2O/H2O mechanics+gravity law isolation with
    bounded volume ratio `J`.
  - Added EOS-on H2O/H2O MLS-MPM contact and plain SPH/PBF reference-lane
    atomics. The EOS-on case checks same-material contact closure under
    gravity while keeping J inside `0.95..1.05`; the plain SPH/PBF case checks
    the reference lane stays finite, bounded, and contact-closing.
- `node --check tests/physicsBehaviorInvariants.test.mjs && node --test tests/physicsBehaviorInvariants.test.mjs tests/sphPhaseDemo.test.mjs --test-name-pattern "H2O/H2O|plain SPH|physical law groups|demo exposes"`
  - Passed, `28/28`.
- `node --test tests/sphG2pGpuKernel.test.mjs tests/mlsMpmCarrier.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseDemo.test.mjs`
  - Passed, `63/63`.
- `node --test tests/sphG2pGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/mlsMpmCarrier.test.mjs`
  - Passed after the resident G2P pressure-scale patch, `41/41`.
- `npm test`
  - Passed, `483/483`.
- Direct resident mechanics+gravity-only H2O/H2O probe:
  `/tmp/ulg-history-probes/current-atomicgate-valid-mechanics-gravity-only-256-g2p-scale.json`
  - Passed/classified `good`: `0.128 s` over `256` direct substeps,
    pressure impulse `0`, J exactly `1..1`, max speed about `0.135 m/s`,
    drop COM `1.25 -> 1.235336 m`, and support gap
    `~0 -> -0.002719 m`.
- Short visual sequence sanity check:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 ULG_SPH_VISUAL_CAPTURE=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 ULG_SPH_VISUAL_FRAMES=3 ULG_SPH_VISUAL_INTERVAL_MS=250 ULG_SPH_VISUAL_LABEL='h2o-h2o-atomicgate-mech-gravity-pressure-disabled' ... npx playwright test --config tests/playwright.config.mjs --grep 'SPH phase visual sequence'`
  - Passed, `1/1`, against H2O/H2O mechanics+gravity with EOS/pressure/
    thermal/reaction disabled.
  - Wrote PNG/GIF/WebM/timeline artifacts under
    `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-atomicgate-mech-gravity-pressure-disabled/`.
  - Timeline evidence: WebGPU resident backend, active grid nodes `248`,
    pressure impulse `0`, J exactly `1..1`, H2O visible in all `3` sampled
    frames. Limitation: capture cadence remains slow
    (`meanIntervalMs ~= 5417` for a `250 ms` target).
- EOS-on direct resident H2O/H2O contact probe:
  `/tmp/ulg-history-probes/current-atomicgate-eos-on-liquid-contact-direct-resident.json`
  - Passed/classified `good`: WebGPU backend, no-full readback, `256`
    resident substeps / `0.128 s`, min active grid nodes `248`, J
    `0.997148..1.006978`, pressure impulse `0`, max speed about `1.60 m/s`,
    drop COM `1.25 -> 1.159897 m`, and support gap
    `~0 -> -0.016253 m`.
- EOS-on short visual sequence sanity check:
  `h2o-h2o-atomicgate-eos-on-liquid-contact`
  - Passed, `1/1`, and wrote PNG/GIF/WebM/timeline artifacts under
    `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-atomicgate-eos-on-liquid-contact/`.
  - Timeline evidence: WebGPU resident backend, active grid nodes `248`, J
    about `0.9993..1.0104`, pressure impulse `0`, and H2O visible in all
    `3` sampled frames. Limitation: capture cadence remains slow
    (`meanIntervalMs ~= 5349` for a `250 ms` target).
- Simulation-time visual cadence sanity check:
  `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5335 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5335 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5335 --strictPort' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 ULG_SPH_VISUAL_CAPTURE=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 ULG_SPH_VISUAL_FRAMES=3 ULG_SPH_VISUAL_INTERVAL_MS=250 ULG_SPH_VISUAL_ADVANCE_TIMEOUT_MS=90000 ULG_SPH_VISUAL_TIMEOUT_MS=300000 ULG_SPH_VISUAL_LABEL='h2o-h2o-sim-cadence-final-eos-on-liquid-contact' ULG_SPH_VISUAL_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=mlsmpm&lawmech=1&lawg=1&laweos=1&lawp=1&lawt=0&lawr=0' npx playwright test --config tests/playwright.config.mjs --grep 'SPH phase visual sequence'`
  - Passed, `1/1`.
  - Wrote PNG/GIF/WebM/timeline artifacts under
    `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-sim-cadence-final-eos-on-liquid-contact/`.
  - Timeline evidence: `simulationCadence.status =
    simulation-advanced-each-frame`, resident steps `32 -> 48 -> 64`,
    simulation time `0.016 -> 0.024 -> 0.032 s`, repeated samples `0`, J
    `0.997147..1.010376`, pressure impulse `0`, and H2O visible in all
    frames. Limitation: wall-clock capture cadence remains slow
    (`meanIntervalMs ~= 6202` for a `250 ms` target). Frame timing points at
    resident advance (`~2.37..2.75 s`), metric collection (`~1.52..1.62 s`),
    and canvas readback (`~1.93..2.11 s`) as the remaining bottlenecks.
- Long-horizon liquid-quality gate smoke:
  `ULG_PROBE_MODE=direct-resident ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5336 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=mlsmpm&lawmech=1&lawg=1&laweos=1&lawp=1&lawt=0&lawr=0' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=16 ULG_PROBE_TIMEOUT_MS=180000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-liquid-quality-default-compat-smoke.json node scripts/sph-long-horizon-probe.mjs`
  - Passed/classified `good`; default probe behavior remains compatible.
  - New opt-in thresholds are present but disabled by default:
    `expectLiquidMerge=false`, `expectLiquidSettled=false`.
- Opt-in H2O/H2O merge/render gate:
  `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5339 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=mlsmpm&lawmech=1&lawg=1&laweos=1&lawp=1&lawt=0&lawr=0' ULG_PROBE_BATCHES=4 ULG_PROBE_BATCH_STEPS=64 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=300000 ULG_PROBE_RENDER_READBACK_MODE=full-parity-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_EXPECT_LIQUID_MERGE=1 ULG_PROBE_EXPECT_H2O_VISIBLE_SURFACE_COUNT=1 ULG_PROBE_MIN_J=0.95 ULG_PROBE_MAX_J=1.05 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-liquid-quality-merge-optin-scene-256-tolerance-aligned.json node scripts/sph-long-horizon-probe.mjs`
  - Passed/classified `good`.
  - Evidence: final H2O visible surface count `1`, visible sample count `5`,
    support gap `~0 -> -0.02056 m`, J `0.998788..1.007276`, no pressure
    impulse, no visual surface issues. The probe's particle-bound tolerance is
    now explicit and defaults to `0.2 m`, matching the sparse render-only
    radius floor.
- Opt-in H2O/H2O settle gate:
  `ULG_PROBE_MODE=direct-resident ... ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=2048 ULG_PROBE_EXPECT_LIQUID_MERGE=1 ULG_PROBE_EXPECT_LIQUID_SETTLE=1 ULG_PROBE_LIQUID_SETTLE_MIN_TIME_S=1 ULG_PROBE_LIQUID_SETTLE_MAX_FINAL_DROP_SPEED=0.25 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-liquid-quality-merge-settle-optin-direct-2048-singlebatch.json node scripts/sph-long-horizon-probe.mjs`
  - Correctly classified `bad` for the unfinished long-horizon water-quality
    gate.
  - Evidence: `2048` substeps / `1.024 s`, support gap
    `~0 -> -0.243569 m`, J `0.985629..1.026000`, pressure impulse `0`, but
    issue is `liquid-settle-final-drop-speed>0.25`; final drop speed is about
    `1.43 m/s`.
  - Timing evidence: the single resident batch took about `399 s`, with
    compact-summary wait about `368 s` (`~92%` of batch wall time after queued
    resident work). A `16 x 128` equivalent run produced the same physics
    conclusion, so the current blocker is both physical settling quality and
    affordable long-horizon validation.

Scope limits:

- This fixes the disabled-EOS mechanics isolation path and restores an atomic
  guardrail. It also proves short merge/render coherence under the opt-in
  gate. It does not prove full all-laws liquid free-surface settling quality;
  the opt-in settle gate now fails explicitly and remains P0.

## Current Focused Result - 2026-06-13 10:36 AKDT

Law-group isolation, stale no-full cohort diagnostics, and per-surface
MarchingCubes bounds clipping verified.

Verified commands:

- `node --check src/runtime/sphPhaseDemo.js`
  - Passed.
- `node --check src/runtime/sphPhaseViewState.js`
  - Passed.
- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check scripts/sph-long-horizon-probe.mjs`
  - Passed.
- `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "physical law groups"`
  - Passed, `22/22`.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "bounded isosurface|render field|surface radius|surface"`
  - Passed, `24/24`.
- Static all-laws-off direct probe:
  `/tmp/ulg-history-probes/current-lawmatrix-00-static-all-off.json`
  - Passed/classified `good`: zero displacement, zero speed, and feasible
    initial preflight.
- Plain SPH mechanics+gravity+EOS direct probe:
  `/tmp/ulg-history-probes/current-lawmatrix-01-plain-sph-mech-gravity-eos.json`
  - Passed/classified `good`: max speed about `0.527 m/s`, drop COM delta
    about `-0.015 m`, and valid wall defaults.
- Corrected no-full cohort diagnostic probe:
  `/tmp/ulg-history-probes/current-lawmatrix-03c-mlsmpm-nofull-cohort-null-check.json`
  - Passed/classified `good`: `cohortDiagnosticsAvailableCount=0`,
    drop/base cohort deltas are null, and resident cohort status is
    `unavailable-no-full-state-readback` instead of stale initial data.
- Long all-laws live-cohort direct probe:
  `/tmp/ulg-history-probes/current-lawmatrix-13-direct-long-all-laws-live-cohorts.json`
  - Passed/classified `good`: `1024` substeps / `0.512 s`, J
    `0.997748..1.009107`, pressure impulse `0`, drop COM
    `1.25 -> 0.463889 m`, and center-bound gap
    `0.183333 -> 0.034447 m`.
- Support-gap analyzer smoke:
  `/tmp/ulg-history-probes/current-lawmatrix-14-direct-support-gap-smoke.json`
  - Passed/classified `good`: finite-support gap is now reported separately
    from center-bound gap, with support gap `~0 -> -0.01625 m` over
    `0.128 s`.
- No-full compact cohort smoke:
  `/tmp/ulg-history-probes/current-lawmatrix-16-nofull-compact-cohorts-32lane.json`
  - Passed/classified `good`: compact resident cohort diagnostics are ready
    without full particle readback, drop COM `1.25 -> 1.159897 m`,
    support gap `~0 -> -0.01625 m`, J `0.998833..1.006488`, and pressure
    impulse `0`.
- Bounds-clipped valid-geometry scene probe:
  `/tmp/ulg-history-probes/current-lawmatrix-12-scene-bounds-clipped-5batch.json`
  - Passed/classified `good`: `issues=[]`, `maxOverflow=0`, H2O visible across
    the sampled sequence, J about `0.997..1.007`, and max speed about
    `1.026 m/s`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 ULG_SPH_VISUAL_CAPTURE=1 ULG_SPH_VISUAL_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=mlsmpm&lawmech=1&lawg=1&laweos=1&lawp=1&lawt=1&lawr=1' ULG_SPH_VISUAL_FRAMES=5 ULG_SPH_VISUAL_INTERVAL_MS=250 ULG_SPH_VISUAL_LABEL='h2o-h2o-valid-geometry-bounds-clipped-visual' npx playwright test --config tests/playwright.config.mjs --grep 'SPH phase visual sequence'`
  - Passed, `1/1`.
  - Artifacts:
    `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-valid-geometry-bounds-clipped-visual/`.
  - Timeline evidence: `5` captured frames, GIF/WebM assembled, all law groups
    on, resident render field rows `152`, pressure impulse `0`, two visible
    liquid H2O domains, and bounded surfaces.

Scope limits:

- This verifies law-isolation plumbing and a visible render-field extraction
  fix. It does not prove water-like long-horizon merge/settle behavior. The
  visual harness still reports `slow-capture-cadence` with mean frame interval
  about `4934 ms` against a `250 ms` target, so faster resident/render
  validation remains a P0 requirement. The long direct probe proves live
  descent/contact and bounded volume, but it bypasses scene pressure/surface
  rendering and therefore does not close the visual merge/settle gate. Compact
  cohort summaries remove full readback from that motion check, but their
  queue-wait cost is still high and remains performance work.

## Current Focused Result - 2026-06-13 09:51 AKDT

Valid-geometry H2O/H2O scene render-field surface expansion fixed.

Verified commands:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "bounded isosurface|render field|surface"`
  - Passed, `24/24`.
- `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5294 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=4 ULG_PROBE_BATCH_STEPS=64 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=420000 ULG_PROBE_RENDER_READBACK_MODE=full-parity-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-face-contact-scene-256-all-laws-valid-geometry-sparse-res-32.json node scripts/sph-long-horizon-probe.mjs`
  - Passed, classified `good`.
  - Evidence: no `visible-surface-expanded-beyond-particle-bounds`,
    `visibleSurfaceSampleCount=5`, `h2oVisibleSurfaceSampleCount=5`, max
    speed `1.77523 m/s`, J `0.998788..1.007276`.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5296 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5296 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5296 --strictPort' PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 ULG_SPH_VISUAL_CAPTURE=1 ULG_SPH_VISUAL_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_SPH_VISUAL_LABEL='h2o-h2o-face-contact-valid-geometry-sparse-res-32-drawrange' ULG_SPH_VISUAL_FRAMES=3 ULG_SPH_VISUAL_INTERVAL_MS=250 ULG_SPH_VISUAL_TIMEOUT_MS=300000 npm run test:e2e -- --grep "SPH phase visual sequence" --timeout 300000`
  - Passed.
  - Artifacts:
    `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-face-contact-valid-geometry-sparse-res-32-drawrange/`.
  - Timeline surface metrics now use active `drawRange` vertices instead of
    the full MarchingCubes `72000` capacity.

Scope limits:

- This fixes a visible render-field sizing/metric bug for valid short-horizon
  contact. It still leaves the long-horizon fluid-quality question open:
  all-laws MLS-MPM preserves J over 1024 direct substeps, while
  mechanics+gravity-only collapse to the J floor because incompressibility/EOS
  is disabled.

## Current Focused Result - 2026-06-13 09:21 AKDT

Plain SPH reference mode now distinguishes valid face contact from invalid
overlapped initial geometry.

Verified commands:

- `node --check src/runtime/sphPhaseDemo.js`
  - Passed.
- `node --check src/runtime/sph/sphPhaseCarrier.js`
  - Passed.
- `node --check scripts/sph-long-horizon-probe.mjs`
  - Passed.
- `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "overlapping initial|plain SPH|demo driver"`
  - Passed, `21/21`.
- `ULG_PROBE_MODE=direct-resident ... ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=sph' ... ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-face-contact-plain-sph-reference-pbf-parser-fixed.json node scripts/sph-long-horizon-probe.mjs`
  - Passed, classified `good`.
  - Evidence: `initialPreflightStatus=preflight-feasible-derived-closures`,
    wall defaults `283.15 K`, geometry `initial-block-geometry-ok`, max speed
    `0.080756 m/s`, drop COM delta `-0.000241 m`, and gap delta
    `-0.000111 m`.
- `ULG_PROBE_MODE=direct-resident ... ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=0.85&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=sph' ... ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-overlap-plain-sph-reference-preflight-blocked-parser-fixed.json node scripts/sph-long-horizon-probe.mjs`
  - Failed intentionally, classified `bad`.
  - Evidence: `initial-preflight-blocked`,
    `initial-block-geometry-overlap`, physical support overlap `0.15 m`, and
    the same high-speed upward impulse that made the earlier center-gap probe
    misleading.

Scope limits:

- This gives a useful SPH/PBF reference lane for valid short-horizon setups,
  but it is still CPU reference and diagnostic only. It does not fix the
  resident MLS-MPM mechanics/contact/volume bug.

## Current Focused Result - 2026-06-13 09:03 AKDT

Plain SPH reference-mode selector and direct probe branch added.

Verified commands:

- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check scripts/sph-long-horizon-probe.mjs`
  - Passed.
- `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "plain SPH|demo driver"`
  - Passed, `20/20`.
- `ULG_PROBE_MODE=direct-resident ULG_PROBE_READBACK_MODE=full-parity-readback ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5293 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=0.85&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=sph' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=24 ULG_PROBE_TIMEOUT_MS=180000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-direct-contact-near-plain-sph-reference-smoke-analyzer-fixed.json node scripts/sph-long-horizon-probe.mjs`
  - Passed as a wiring smoke, classified `good` for the short interval.
  - Evidence: timeline `mechanicsIntegrator=sph`, final metric phase
    `plain-sph-cpu-reference-batch`, schema
    `peercompute.ulg.plain-sph-cpu-reference-step.v0`, max speed
    `17.2334 m/s`, gap `0.03333336 -> 0.03236580 m`, and explicit limitations
    that this mode bypasses resident WebGPU MLS-MPM.

Scope limits:

- The selector and probe branch work, but current plain SPH is not yet a
  trustworthy water reference. It needs wall handling and PBF/incompressible,
  viscosity, surface-tension, and cavitation/free-surface constraints before
  being used as the baseline for liquid behavior.

## Current Focused Result - 2026-06-13 08:51 AKDT

Residual liquid/contact bug isolated below pressure/gas/thermal/reaction.

Verified commands:

- `node --test tests/abi.test.mjs tests/sphGridGpuKernel.test.mjs tests/sphMechanicsRefreshGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphGpuBuffers.test.mjs`
  - Passed, `67/67`.
- `ULG_PROBE_MODE=direct-resident ULG_PROBE_READBACK_MODE=full-parity-readback ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5283 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=0.85&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&laweos=0' ULG_PROBE_BATCHES=4 ULG_PROBE_BATCH_STEPS=64 ULG_PROBE_TIMEOUT_MS=300000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-direct-contact-near-256-eos-off.json node scripts/sph-long-horizon-probe.mjs`
  - Failed as intended, classified `bad`.
  - Evidence: gap `0.03333336 -> 0.02995068 m`, drop COM
    `1.1000 -> 1.00951 m`, base top `0.82680 m`, drop bottom
    `0.85675 m`, J `0.878366..0.999933`, max speed `1.69935 m/s`,
    pressure impulse `0`.
- `ULG_PROBE_MODE=direct-resident ULG_PROBE_READBACK_MODE=full-parity-readback ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5286 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=0.85&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&laweos=0&lawp=0&lawt=0&lawr=0' ULG_PROBE_BATCHES=4 ULG_PROBE_BATCH_STEPS=64 ULG_PROBE_TIMEOUT_MS=300000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-direct-contact-near-256-mechanics-gravity-only.json node scripts/sph-long-horizon-probe.mjs`
  - Failed as intended, classified `bad`.
  - Evidence: law groups were mechanics+gravity only; stages were
    P2G/gridUpdate/G2P only; gap `0.03333336 -> 0.02995068 m`, drop COM
    `1.1000 -> 1.00951 m`, base top `0.82680 m`, drop bottom
    `0.85675 m`, base mean velocity `-0.41877 m/s`, drop mean velocity
    `-1.42842 m/s`, J `0.876073..0.999933`, max speed `1.69935 m/s`,
    and internal pressure scale `0`.
- Hydrostatic initialization probes also failed:
  - `/tmp/ulg-history-probes/current-h2o-direct-contact-near-256-hydrostatic-init.json`
  - `/tmp/ulg-history-probes/current-h2o-direct-contact-near-256-hydrostatic-pressure-lane.json`

Scope limits:

- This does not fix liquid behavior. It narrows the active bug below the
  pressure/gas/render layers and makes the next target MLS-MPM mechanics
  transfer plus a plain SPH/PBF reference lane.

## Current Focused Result - 2026-06-13 08:05 AKDT

Same-material high-drop render/domain bug fixed short-horizon, and physical
law-group isolation controls verified.

Verified commands:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check scripts/sph-long-horizon-probe.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed, `58/58`.
- `npm test`
  - Passed, `466/466`.
- `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5268 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=16 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=180000 ULG_PROBE_RENDER_READBACK_MODE=full-parity-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-scene-highdrop-16-sparse-floor.json node scripts/sph-long-horizon-probe.mjs`
  - Passed, classified `good`.
  - Evidence: resident GPU render field active, two visible liquid H2O domains,
    zero pressure impulse, J near one, and
    `maxVisibleSurfaceOutsideParticleBoundsM=0`.
- `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5269 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=4 ULG_PROBE_BATCH_STEPS=64 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=300000 ULG_PROBE_RENDER_READBACK_MODE=full-parity-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-scene-highdrop-256-sparse-floor.json node scripts/sph-long-horizon-probe.mjs`
  - Passed, classified `good`.
  - Evidence: no visual surface issues, zero pressure impulse, J
    `0.998100..1.000672`, total COM Y decreases, and two visible liquid H2O
    domains remain present over the sampled resident sequence.
- `ULG_PROBE_EXPECT_STATIC=1 ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5271 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&lawg=0&lawp=0' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=16 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=180000 ULG_PROBE_RENDER_READBACK_MODE=full-parity-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-scene-law-toggle-static-smoke.json node scripts/sph-long-horizon-probe.mjs`
  - Passed, classified `good`.
  - Evidence: status reports `gravity=off pressure=off`, max displacement is
    `0`, COM Y delta is `0`, pressure impulse is `0`, and two H2O liquid
    domains stay visible.
- `npm run icc:update`
  - Passed, indexed `224` files and `1004` memory chunks.

Scope limits:

- This fixes wall-input/render-domain/sparse-drop visibility bugs in the
  short-horizon scene path. It does not prove true water-like contact, merge,
  surface tension, viscosity, incompressible pressure projection, or
  long-horizon settling.
- The law-group checkboxes are diagnostic isolation controls; they do not
  remove laws from the architecture and must become part of the recurring
  visual/probe matrix.

## Current Focused Result - 2026-06-13 06:20 AKDT

Pressure/gas regression slice repaired, and long-horizon visual validation made
draw-range aware.

Verified commands:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphG2pGpuKernel.test.mjs tests/sphGridGpuKernel.test.mjs tests/sphGridUpdateGpuKernel.test.mjs tests/multiMaterialEos.test.mjs tests/sphRenderGpuKernel.test.mjs`
  - Passed, `75/75`.
- `PLAYWRIGHT_BASE_URL='http://127.0.0.1:5238' PLAYWRIGHT_WEB_SERVER_URL='http://127.0.0.1:5238' PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5238' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 ULG_SPH_LONG_HORIZON_CAPTURE=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 ULG_SPH_LONG_HORIZON_BATCHES=6 ULG_SPH_LONG_HORIZON_BATCH_STEPS=16 ULG_SPH_LONG_HORIZON_RENDER_EVERY=1 ULG_SPH_LONG_HORIZON_MAX_FRAMES=7 ULG_SPH_LONG_HORIZON_READBACK_MODE=no-full-readback ULG_SPH_LONG_HORIZON_RENDER_READBACK_MODE=full-parity-readback ULG_SPH_LONG_HORIZON_RENDER_TIMEOUT_MS=30000 ULG_SPH_LONG_HORIZON_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=0.85&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_SPH_LONG_HORIZON_LABEL='h2o-h2o-near-contact-drawrange-sequence-validation-readback' npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident long-horizon probe records H2O/H2O stability"`
  - Passed, `1/1` in about `1.2m`.
  - Evidence: `7` fresh render-field readback samples, `7` frame artifacts,
    `maxVisibleSurfaceCenterMotionM=0.0047826`, max speed
    `0.878941 m/s`, no analysis issues. The harness now samples drawn
    MarchingCubes vertices (`168` active vertices), not the fixed `72000`
    vertex capacity.
- `PLAYWRIGHT_BASE_URL='http://127.0.0.1:5239' PLAYWRIGHT_WEB_SERVER_URL='http://127.0.0.1:5239' PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5239' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 ULG_SPH_LONG_HORIZON_CAPTURE=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 ULG_SPH_LONG_HORIZON_BATCHES=4 ULG_SPH_LONG_HORIZON_BATCH_STEPS=16 ULG_SPH_LONG_HORIZON_RENDER_EVERY=1 ULG_SPH_LONG_HORIZON_MAX_FRAMES=5 ULG_SPH_LONG_HORIZON_READBACK_MODE=no-full-readback ULG_SPH_LONG_HORIZON_RENDER_READBACK_MODE=full-parity-readback ULG_SPH_LONG_HORIZON_RENDER_TIMEOUT_MS=30000 ULG_SPH_LONG_HORIZON_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_SPH_LONG_HORIZON_LABEL='h2o-h2o-highdrop-drawrange-sequence-validation-readback' npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident long-horizon probe records H2O/H2O stability"`
  - Passed, `1/1` in about `1.0m`.
  - Evidence: `5` fresh render-field readback samples, `5` frames,
    `maxVisibleSurfaceCenterMotionM=0.0098805`, max speed
    `0.578135 m/s`, no analysis issues.
- `ULG_PROBE_MODE=direct-resident ULG_PROBE_READBACK_MODE=full-parity-readback ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5240 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=4 ULG_PROBE_BATCH_STEPS=64 ULG_PROBE_TIMEOUT_MS=300000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-direct-highdrop-after-harness-fixes.json node scripts/sph-long-horizon-probe.mjs`
  - Passed, classified `good`.
  - Evidence: over `256` substeps / `0.128s`, drop COM
    `2.75 -> 2.669350 m`, final drop velocity `-1.25525 m/s`, pressure
    impulse `0`, and J `0.998292..1.000527`.
- `npm run icc:update`
  - Passed, indexed `224` files and `994` memory chunks.

Scope limits:

- This repairs the frozen/delayed high-drop regression and makes the visual
  sequence evidence trustworthy enough for recurring sanity checks.
- It does not complete liquid physics. Same-material contact/merge/settle still
  needs explicit liquid law work: incompressible pressure projection or
  equivalent constraint solve, viscosity/surface tension/cavitation closures,
  phase/wall-temperature consistency, and longer-horizon visual probes.

## Current Focused Result - 2026-06-13 04:46 AKDT

Same-material liquid contact and phase/render split guards added to the
standalone long-horizon probe.

Verified commands:

- `node --check scripts/sph-long-horizon-probe.mjs`
  - Passed.
- `ULG_PROBE_MODE=direct-resident ULG_PROBE_READBACK_MODE=full-parity-readback ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5223 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=0.85&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=4 ULG_PROBE_BATCH_STEPS=64 ULG_PROBE_TIMEOUT_MS=300000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-direct-contact-near-256-full-cohorts-contact-guard-fixed.json node scripts/sph-long-horizon-probe.mjs`
  - Failed as intended, classified `bad`.
  - Evidence: issue `same-material-contact-gap-not-closing`; after `256`
    substeps / `0.128s`, drop COM changes `1.1000000 -> 1.0804508 m`, the
    base/drop gap changes only `0.0333334 -> 0.0321894 m`, pressure impulse is
    `0`, and J remains stable at `0.997498..1.000174`.
- `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5224 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=0.85&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=4 ULG_PROBE_BATCH_STEPS=64 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=420000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-scene-contact-near-256-default-blob-0p4-phase-guard.json node scripts/sph-long-horizon-probe.mjs`
  - Failed as intended, classified `bad`.
  - Evidence: issues `same-material-h2o-visible-phase-split` and
    `same-material-h2o-nonliquid-visible-surface`; the final sampled visible
    H2O descriptors are `liquid:h2o` and `solid:ice` in a same-material 300 K
    H2O/H2O scenario.

Scope limits:

- These are regression guards and diagnosis evidence, not a fix for liquid
  contact. The later 08:05 slice fixed the phase/render-domain path that
  invented the solid/ice visible surface in high-drop scene probes; the
  contact-gap guard remains active for true liquid contact/settling work.

## Current Focused Result - 2026-06-13 04:30 AKDT

Default visible isosurface radius tightened and validated against resident
particle AABB bounds.

Verified commands:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check tests/sphPhaseRenderer.test.mjs`
  - Passed.
- `node --check scripts/sph-long-horizon-probe.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "surface radius|blob radius|isosurface radius|resident motion diagnostic|render field|surface"`
  - Passed, `22/22`.
- `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5219 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=0.85&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=16 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=180000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-scene-contact-near-16-default-blob-0p4.json node scripts/sph-long-horizon-probe.mjs`
  - Passed, classified `good`.
  - Evidence: no URL `blob=` override, pressure rows `0`, pressure impulse
    `0`, max speed `0.1308358 m/s`, J `0.999490..0.999996`,
    `maxVisibleSurfaceOutsideM=0`, and
    `maxVisibleSurfaceOutsideParticleBoundsM=0`.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5274 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5274 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5274 --strictPort' PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 ULG_SPH_VISUAL_CAPTURE=1 ULG_SPH_VISUAL_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=0.85&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_SPH_VISUAL_LABEL='h2o-h2o-contact-near-default-blob-0p4' ULG_SPH_VISUAL_FRAMES=3 ULG_SPH_VISUAL_INTERVAL_MS=250 ULG_SPH_VISUAL_TIMEOUT_MS=300000 npm run test:e2e -- --grep "SPH phase visual sequence" --timeout 300000`
  - Passed, `1/1` in about `44s`.
  - Artifacts:
    `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-contact-near-default-blob-0p4/`.

Scope limits:

- This validates the default visible surface radius and the new
  particle-relative visual guard.
- It does not validate long-horizon same-material liquid merge/settle physics.

## Current Focused Result - 2026-06-13 04:11 AKDT

Compact resident COM/bounds diagnostics in live browser paths, plus post-change
visual sequence sanity check.

Verified commands:

- `node --check tests/demo.e2e.mjs`
  - Passed.
- `node --check ulg-gpu-abi/src/index.js && node --check ulg-gpu-abi/src/wgsl.js && node --check src/runtime/sph/sphMlsMpmGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check scripts/sph-long-horizon-probe.mjs && node --check tests/demo.e2e.mjs && node --check tests/sphMlsMpmGpuStep.test.mjs`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "summary|copy budget|GPU resident lane|compact|compute task|reaction from retained"`
  - Passed, `25/25`.
- `node --test tests/abi.test.mjs --test-name-pattern "resident summary ABI"`
  - Passed, `17/17`.
- `npm test`
  - Passed, `457/457`.
- `npm run build`
  - Passed with Vite's existing large-chunk warning.
- `ULG_PROBE_MODE=direct-resident ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5213 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=16 ULG_PROBE_TIMEOUT_MS=120000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-direct-16-com-bounds.json node scripts/sph-long-horizon-probe.mjs`
  - Passed, classified `good`.
  - Evidence: pressure rows `0`, max speed `0.0784546 m/s`, J
    `0.9998219..1.0`, and next Y particle bounds `0.0999236..2.9163332 m`.
- `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5214 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=16 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=180000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-scene-16-com-bounds.json node scripts/sph-long-horizon-probe.mjs`
  - Passed, classified `good`.
  - Evidence: pressure rows `0`, bounded visible geometry,
    `maxVisibleSurfaceOutsideM=0`, COM Y delta `-0.0013416 m`, and next Y
    particle bounds `0.0995834..2.9163332 m`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 ULG_SPH_DERIVED_E2E_TIMEOUT_MS=300000 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1` in about `3.9m`.
  - Evidence: live browser path carries `224` byte compact diagnostics,
    COM/AABB fields, refreshed-mechanics retained buffer mode, and explicit
    `surface-draw-overlay-disabled-by-policy`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 ULG_SPH_VISUAL_CAPTURE=1 ULG_SPH_VISUAL_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_SPH_VISUAL_LABEL='h2o-h2o-separated-current-com-bounds' ULG_SPH_VISUAL_FRAMES=3 ULG_SPH_VISUAL_INTERVAL_MS=250 ULG_SPH_VISUAL_TIMEOUT_MS=300000 npm run test:e2e -- --grep "SPH phase visual sequence"`
  - Passed, `1/1` in about `50s`.
  - Artifacts:
    `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-separated-current-com-bounds/`.
- `npm run icc:update`
  - Passed, indexed `224` files and `988` memory chunks.

Scope limits:

- This validates the pressure gate, compact diagnostics, live browser
  propagation, and short separated H2O/H2O visual sanity path.
- It does not prove long-horizon same-material liquid merge/settle behavior.
  That remains P0.

## Current Focused Result - 2026-06-13 02:40 AKDT

Pressure/gas regression boundary, resident cadence, motion diagnostics, and
render-field bounds fix.

Verified commands:

- `node --check src/runtime/webgpuComputeLayout.js && node --check src/runtime/sph/sphGridGpuKernel.js && node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check src/runtime/sph/sphG2pGpuKernel.js && node --check src/runtime/sph/sphThermalGpuKernel.js && node --check src/runtime/sph/sphMechanicsRefreshGpuKernel.js && node --check src/runtime/sph/sphMlsMpmGpuSummary.js`
  - Passed.
- `node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/visualization/sphPhaseScene.js && node --check scripts/sph-long-horizon-probe.mjs && node --check tests/demo.e2e.mjs`
  - Passed.
- `ULG_PROBE_MODE=direct-resident ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5191 ULG_PROBE_URL='/#drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=0.85&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=2 ULG_PROBE_BATCH_STEPS=32 ULG_PROBE_TIMEOUT_MS=300000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-direct-64-final-summary.json node scripts/sph-long-horizon-probe.mjs`
  - Passed, classified `good`.
  - Evidence: `compactSummaryMode=final-only`, max speed `0.1798196 m/s`,
    max displacement `0.00008988 m`, active grid nodes `248`, J
    `0.998767..0.999974`, pressure rows `0`, pressure impulse `0`.
- `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5192 ULG_PROBE_URL='/#drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=0.85&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=1 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=180000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-scene-cadence-final-summary.json node scripts/sph-long-horizon-probe.mjs`
  - Passed, classified `good`.
  - Evidence: page path reports `substeps=16 target=16`, initial resident
    `stepCount=16`, `nextTime=0.008s`, zero pressure impulse, visible H2O
    surface samples, and scene envelope `step-ms=11.4k` instead of the earlier
    `75.0k` for the same corrected 16-substep cadence.
- `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphGridGpuKernel.test.mjs tests/sphGridUpdateGpuKernel.test.mjs tests/sphG2pGpuKernel.test.mjs tests/sphMechanicsRefreshGpuKernel.test.mjs tests/sphMlsMpmGpuSummary.test.mjs tests/residentStateAuthority.test.mjs`
  - Passed, `74/74`.
- `git diff --check`
  - Passed.
- `npm run build`
  - Passed with Vite's existing large-chunk warning.
- `npm test`
  - Passed, `455/455`.
- `npm run icc:update`
  - Passed, indexed `224` files and `980` memory chunks after the latest
    render-bounds docs.
- `ULG_PROBE_MODE=direct-resident ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5194 ULG_PROBE_URL='/#drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=256 ULG_PROBE_TIMEOUT_MS=360000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-direct-separated-256-final-summary.json node scripts/sph-long-horizon-probe.mjs`
  - Passed, classified `good`.
  - Evidence: separated H2O/H2O reached `nextTime=0.128s`, max speed
    `1.2552514 m/s`, active grid nodes `296`, J `0.997750..1.000842`,
    pressure rows/impulse `0`, with final-substep displacement only
    `0.0006275 m`.
- `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5195 ULG_PROBE_URL='/#drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=64 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=240000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-scene-separated-64-batch-motion.json node scripts/sph-long-horizon-probe.mjs`
  - Passed, classified `good`.
  - Evidence: status line reported `status=batch-motion-estimate-visible`,
    `batch-est=0.012553m`, and render cadence forced refresh with
    `reason=resident-batch-motion-estimate-visual-refresh`.
  - Scope limit: visible H2O surface bounds remained oversized/nonphysical, so
    render-field/surface coherency is still P0.
- `node --check src/visualization/sphPhaseDemoMount.js && node --check tests/sphPhaseRenderer.test.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident motion diagnostic|render cadence|resident overlay|render field|surface"`
  - Passed, `19/19`.
- `npm test`
  - Passed, `455/455` after the resident motion diagnostic cleanup.
- `node --check src/visualization/sphPhaseScene.js && node --check scripts/sph-long-horizon-probe.mjs && node --check tests/sphPhaseRenderer.test.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "surface radius|resident motion diagnostic|render field|surface"`
  - Passed, `20/20`.
- `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5197 ULG_PROBE_URL='/#drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=16 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=240000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-scene-separated-16-radius-fix-visual-guard.json node scripts/sph-long-horizon-probe.mjs`
  - Passed as a probe and correctly classified `bad`.
  - Evidence: `issues=["visible-surface-outside-box"]`, H2O y-min
    `-0.755995 m`, and `maxVisibleSurfaceOutsideM=0.705995 m`.
- `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5199 ULG_PROBE_URL='/#drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=16 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=240000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-scene-separated-16-drawrange-bounds.json node scripts/sph-long-horizon-probe.mjs`
  - Passed, classified `good`.
  - Evidence: H2O `surfaceBoxClipStatus=clipped-to-container`, y-min
    `-1.06e-8 m`, `maxVisibleSurfaceOutsideM=0`, zero pressure impulse, J
    `0.999495..1.0`, max speed `0.1569079 m/s`, active H2O draw vertices
    `840`, and MarchingCubes vertex capacity `72000`.
  - Scope limit: render-field readback is active, so this is not liquid
    settling validation or the final resident GPU surface-draw path.
- `node --test tests/sphPhaseRenderer.test.mjs tests/sphRenderGpuKernel.test.mjs --test-name-pattern "surface radius|resident motion diagnostic|render field|surface|marching|draw"`
  - Passed, `50/50`.
- `npm run build`
  - Passed with Vite's existing large-chunk warning.
- `npm test`
  - Passed, `456/456`.

## Current Focused Result - 2026-06-13 01:18 AKDT

P0 pressure/gas regression boundary and current pressure-row gate.

Verified commands:

- `node --check scripts/sph-long-horizon-probe.mjs && node --check tests/demo.e2e.mjs`
  - Passed.
- `ULG_PROBE_REPO_DIR=/tmp/ulg-history-probes/f0d101f ULG_PROBE_PORT=5181 ULG_PROBE_URL='/#drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=0.85&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=2 ULG_PROBE_BATCH_STEPS=16 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=180000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/f0d101f-h2o-probe.json node scripts/sph-long-horizon-probe.mjs`
  - Passed, classified `good`.
  - Evidence: max speed `0.012864 m/s`, max displacement `0.00000645 m`,
    active grid nodes `248`, J `0.999677..1.000018`, visible H2O surface
    sampled.
- `ULG_PROBE_REPO_DIR=/tmp/ulg-history-probes/c81a66a ULG_PROBE_PORT=5182 ULG_PROBE_URL='/#drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=0.85&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=2 ULG_PROBE_BATCH_STEPS=16 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=180000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/c81a66a-h2o-probe.json node scripts/sph-long-horizon-probe.mjs`
  - Passed as a probe, classified `bad`.
  - Evidence: max speed `303.441 m/s`, max displacement `0.151721 m`, J
    `0.1..8.343449`, pressure rows `146`, consumer
    `grid-momentum-impulse-submitted-unverified-no-full-readback`.
- `ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5183 ULG_PROBE_URL='/#drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=0.85&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=2 ULG_PROBE_BATCH_STEPS=16 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=180000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-probe.json node scripts/sph-long-horizon-probe.mjs`
  - Passed, classified `good`.
  - Evidence: max speed `0.140798 m/s`, max displacement `0.0000705 m`, active
    grid nodes `248`, J `0.999399..1.0`, pressure rows `0`, consumer
    `blocked-pressure-force-rows-unavailable`, applied pressure impulse `0`.
- Attempted the gated Playwright long-horizon test through the normal
  Playwright web-server path; it timed out before reaching the page because
  `webServer` did not become ready. The standalone probe above is the current
  reliable history-comparison path.

## Current Focused Result - 2026-06-12 AKDT

P0 resident thermal state handoff behavior fix.

Verified commands:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  - Passed.
- `node --check src/runtime/residentStateAuthority.js`
  - Passed.
- `node --check tests/sphMlsMpmGpuStep.test.mjs`
  - Passed.
- `node --check tests/residentStateAuthority.test.mjs`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs`
  - Passed, `22/22`.
  - Covers the resident no-full-readback handoff now carrying thermal
    `stateBuffer` forward when thermal ran, while surfacing the remaining
    `mechanics-constitutive-refresh-pending-after-thermal-state` P0 gap.
- `node --test tests/residentStateAuthority.test.mjs`
  - Passed, `6/6`.
  - Covers the authority warning when post-thermal state advances without a
    matching resident mechanics/constitutive refresh.
- `node --check src/runtime/sph/sphMlsMpmGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --test tests/sphGridUpdateGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "queue|pressure|material interface|source field|resident|overlay|render|surface|stale CPU|ping-pong unread|no-full|cleanup preserves|merges carried|retained buffer|retained buffers|compact summary|resident summary|GPU resident lane|compute task|thermal"`
  - Passed, `80/80`.
- `npm test`
  - Passed, `440/440`.
- `npm run build`
  - Passed with Vite's existing large-chunk warning.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH phase demo runs derived material properties" --timeout 180000`
  - Passed, `1/1`, about `2.2m`.

## Current Focused Result - 2026-06-12 AKDT

ULG resident MLS-MPM/SPH ComputeManager task bridge slice.

Verified commands:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check tests/sphMlsMpmGpuStep.test.mjs`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "compute task|GPU resident lane|retain buffers without full readback"`
  - Passed, `22/22`.
  - Covers the resident-step task factory declaring GPU-lane residency and
    required GPU fence metadata, the task handler returning explicit
    `peercompute.compute.gpu-fence-report.v0` without local double leasing, the
    submit helper using a ComputeManager-compatible `submitTask()` surface, and
    existing local lane adapter behavior.
- `node --test tests/sphMlsMpmGpuStep.test.mjs`
  - Passed, `22/22`.
- `node --check src/runtime/sph/sphMlsMpmGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --test tests/sphGridUpdateGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "queue|pressure|material interface|source field|resident|overlay|render|surface|stale CPU|ping-pong unread|no-full|cleanup preserves|merges carried|retained buffer|retained buffers|compact summary|resident summary|GPU resident lane|compute task"`
  - Passed, `80/80`.
- `npm test`
  - Passed, `439/439`.
- `npm run build`
  - Passed with Vite's existing large-chunk warning.
- `npm run icc:update`
  - Passed, `220` indexed files and `937` memory chunks.

## Current Focused Result - 2026-06-12 AKDT

PeerCompute ComputeManager GPU-resident lane task wrapper slice.

Verified commands:

- In `/home/cos/projects/peercompute`:
  `node --check peercompute/src/peercompute/computeManager/ComputeManager.js && node --check peercompute/tests/unit/gpuResidentLaneManager.test.js`
  - Passed.
- In `/home/cos/projects/peercompute`:
  `node --test peercompute/tests/unit/gpuResidentLaneManager.test.js`
  - Passed, `5/5`.
  - Covers passive lane manager behavior plus `ComputeManager` wrapping
    declared inline GPU-resident lane tasks in leases before commit and
    rejecting required-fence misses before `commitDelta`.
- In `/home/cos/projects/peercompute`:
  `node --test peercompute/tests/computeManager.unit.test.js peercompute/tests/unit/computeManager.commitDelta.test.js peercompute/tests/unit/computeManager.wasm.test.js peercompute/tests/unit/computeManager.worker.test.js peercompute/tests/unit/gpuResidentLaneManager.test.js`
  - Passed, `32/32`.
- In `/home/cos/projects/peercompute`:
  `git diff --check`
  - Passed.
- In `/home/cos/projects/peercompute`:
  `npm --prefix /home/cos/projects/peercompute/peercompute run build`
  - Passed with PeerCompute's existing circular chunk and large bundle
    warnings.

## Current Focused Result - 2026-06-12 AKDT

PeerCompute passive GPU resident lane manager slice.

Verified commands:

- In `/home/cos/projects/peercompute`:
  `node --check peercompute/src/peercompute/computeManager/GpuResidentLaneManager.js && node --check peercompute/src/peercompute/computeManager/ComputeManager.js && node --check peercompute/src/peercompute/index.js && node --check peercompute/tests/unit/gpuResidentLaneManager.test.js`
  - Passed.
- In `/home/cos/projects/peercompute`:
  `node --test peercompute/tests/unit/gpuResidentLaneManager.test.js`
  - Passed, `3/3`.
  - Covers state-keyed lane leases, retained-buffer refs, copy-budget counters,
    same-lane state-key conflict rejection, GPU fence reports, and passive
    ComputeManager exposure without changing normal task dispatch.
- In `/home/cos/projects/peercompute`:
  `node --test peercompute/tests/computeManager.unit.test.js peercompute/tests/unit/computeManager.commitDelta.test.js peercompute/tests/unit/computeManager.wasm.test.js peercompute/tests/unit/computeManager.worker.test.js peercompute/tests/unit/gpuResidentLaneManager.test.js`
  - Passed, `30/30`.
- In `/home/cos/projects/peercompute`:
  `git diff --check`
  - Passed.
- In `/home/cos/projects/peercompute`:
  `npm --prefix /home/cos/projects/peercompute/peercompute run build`
  - Passed. Webpack still reports the existing circular chunk and large bundle
    warnings.

## Current Focused Result - 2026-06-12 AKDT

PeerCompute ULG runtime GPU-fence descriptor/task/provenance slice.

Verified commands:

- In `/home/cos/projects/peercompute`:
  `node --check demos/multiscale/src/compute/ulgRuntimeTasks.js && node --check demos/multiscale/src/compute/solverWorkerDescriptors.js && node --check peercompute/src/peercompute/computeManager/ComputeManager.js && node --check demos/multiscale/tests/multiscaleModel.test.mjs`
  - Passed.
- In `/home/cos/projects/peercompute`:
  `node --test --test-name-pattern "ULG runtime worker|multiscale solver descriptors can attach|loopback remote placement admits ULG|loopback remote placement executor runs" demos/multiscale/tests/multiscaleModel.test.mjs`
  - Passed, `4/4`.
  - Covers `ulg-runtime` descriptor WebGPU queue-fence metadata,
    `stepUlgRuntime` compact delta GPU-fence emission, and loopback
    non-advisory remote placement acceptance after ComputeManager verifies the
    satisfied fence.
- In `/home/cos/projects/peercompute`:
  `node --test peercompute/tests/computeManager.unit.test.js peercompute/tests/unit/computeManager.commitDelta.test.js peercompute/tests/unit/computeManager.wasm.test.js peercompute/tests/unit/computeManager.worker.test.js`
  - Passed, `27/27`.
- In `/home/cos/projects/peercompute`:
  `node --test demos/multiscale/tests/multiscaleModel.test.mjs`
  - Passed, `203/203`.
- In `/home/cos/projects/peercompute`:
  `git diff --check`
  - Passed.
- In `/home/cos/projects/peercompute`:
  `npm --prefix /home/cos/projects/peercompute/peercompute run build`
  - Passed. Webpack still reports the existing circular chunk and large bundle
    warnings.

## Current Focused Result - 2026-06-12 16:18 AKDT

Added a dedicated todo plan for a higher-performance WebGPU-Ocean-style
MLS-MPM simulator.

Verified commands:

- `sed -n '1,260p' plan/todo/webgpu-ocean-mlsmpm-simulator-plan.md`
  - Passed.
  - Confirmed the plan includes the website/demo link, GitHub link,
    architecture target, implementation phases, ULG constraints, acceptance
    tests, and first implementation slice.
- `rg -n "webgpu-ocean-mlsmpm|webgpu-ocean.netlify|github.com/matsuoka-601/WebGPU-Ocean|WebGPU-Ocean-style" plan/plan.md plan/todo/perf-upgrade.md plan/todo/overarching-completion-plan.md plan/todo/webgpu-ocean-mlsmpm-simulator-plan.md`
  - Passed.
  - Confirmed the new todo is linked from the active plan, performance plan,
    and overarching completion plan.
- `wc -l plan/todo/webgpu-ocean-mlsmpm-simulator-plan.md`
  - Passed.
  - Reported `232` lines.
- `npm run icc:update`
  - Passed.
  - Reported `209` indexed files and `886` memory chunks.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo ulg --check-staleness`
  - Passed.
  - Reported `is_stale: false` at current `HEAD`
    `c81a66a85c82eb7ce3d960bcd8de0b35ff7d5676`.
- `git diff --check`
  - Passed.

## Current Focused Result - 2026-06-12 15:53 AKDT

Created the repo-root todo handoff file `todo-handoff-6-12.md` with current
todo status, known blockers, validation notes, and recommended next work order.

Verified commands:

- `sed -n '1,260p' todo-handoff-6-12.md`
  - Passed.
  - Confirmed the file contains the current snapshot, completed work,
    remaining gaps, active todo order, known problems, useful commands, and next
    recommended slice.
- `wc -l todo-handoff-6-12.md`
  - Passed.
  - Reported `300` lines.
- `ss -ltnp 'sport = :5173'`
  - Passed.
  - Confirmed the Vite listener is on `0.0.0.0:5173`.
- `npm run icc:update`
  - Passed.
  - Reported `208` indexed files and `882` memory chunks after
    `todo-handoff-6-12.md` was added.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo ulg --check-staleness`
  - Passed.
  - Reported `is_stale: false`.
- `git diff --check`
  - Passed.

## Current Focused Result - 2026-06-12 15:47 AKDT

Created a user Codex skill for Infinite Context Coder at
`/home/cos/.codex/skills/icc/SKILL.md`.

Verified commands:

- `python3` frontmatter/body validation for
  `/home/cos/.codex/skills/icc/SKILL.md`
  - Passed.
  - Confirmed `name: icc`, a description mentioning Infinite Context Coder,
    and the `codebase_tool.py` command path.
- `find /home/cos/.codex/skills/icc -maxdepth 2 -type f -printf '%p\n'`
  - Passed.
  - Confirmed `/home/cos/.codex/skills/icc/SKILL.md` exists.
- `npm run icc:update`
  - Passed.
  - Reported `207` indexed files and `879` memory chunks after the plan/log
    updates.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo ulg --check-staleness`
  - Passed.
  - Reported `is_stale: false`.
- `git diff --check`
  - Passed.

## Current Focused Result - 2026-06-12 15:42 AKDT

ULG ICC artifacts were reinitialized from scratch to verify whether JavaScript
symbol/chunk detection improved after the `.icc` policy rewrite.

Verified commands:

- `mv /home/cos/projects/infinite_context_coder/artifacts/repos/ulg /home/cos/projects/infinite_context_coder/artifacts/repos/ulg.reinit-20260612-154227`
  - Passed.
  - Preserved the previous generated ICC artifacts instead of deleting them.
- `npm run icc:update`
  - Passed.
  - Re-created ULG ICC artifacts from scratch.
  - Reported `207` indexed files and `878` memory chunks.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo ulg --check-staleness`
  - Passed.
  - Reported `is_stale: false`.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py index-quality --repo ulg --min-lines 200 --limit 30`
  - Passed.
  - Still reported `.mjs` files as `text` with no symbols and
    `ulg-gpu-abi/src/wgsl.js` as a large JavaScript blind spot.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py find-symbol --repo ulg --symbol runMlsMpmResidentStepWithOptionalWebGpu --exact --limit 5`
  - Passed with `0` matches.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py pack-symbols --repo ulg --task "resident MLS-MPM pressure force rows GPU buffer lifetime reset path" --top-k 5 --format markdown`
  - Failed as expected with `No symbols matched the task`.
- Raw index inspection with `jq`
  - Confirmed `.js` files do receive some symbol names.
  - Confirmed `.mjs` files remain classified as `text` with zero symbols.
  - Confirmed chunk search can still find relevant `.js` and `.mjs` content.

## Current Focused Result - 2026-06-12 15:39 AKDT

ULG's repo-local `.icc/` policy files now describe ULG directly instead of
carrying copied sibling-repo wording.

Verified commands:

- `rg -n "eshkol|Eshkol|/home/cos/projects/eshkol|peercompute|PeerCompute|moonlab|MoonLab" .icc/README.md .icc/assistant-goals.yaml .icc/completion-oracles.yaml .icc/production-audit.yaml .icc/ulg_doc_intel.md .icc/modularity-justifications.json`
  - Passed with no matches.
- `python3` JSON parse check for `.icc/modularity-justifications.json` and
  `.icc/ulg_status.json`
  - Passed.
- `python3` YAML parse check for `.icc/assistant-goals.yaml`,
  `.icc/completion-oracles.yaml`, and `.icc/production-audit.yaml`
  - Passed.
- `ruby` YAML parse check for `.icc/assistant-goals.yaml`,
  `.icc/completion-oracles.yaml`, and `.icc/production-audit.yaml`
  - Passed.
- `npm run icc:update`
  - Passed.
  - Reported `207` indexed files and `878` memory chunks.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo ulg --check-staleness`
  - Passed.
  - Reported `is_stale: false`.
- `git diff --check`
  - Passed.

## Current Focused Result - 2026-06-12 15:31 AKDT

ULG now has a repo-local `.icc/` configuration and refresh path aligned to the
documented ICC CLI artifact workflow.

Verified commands:

- `npm run icc:update`
  - Passed.
  - Registered ULG with generated/staged output skipped:
    `.git`, `coverage`, `dist`, `docs`, `node_modules`, `playwright-report`,
    `public`, and `test-results`.
  - Refreshed ICC index for repo `ulg`.
  - Refreshed ICC memory for repo `ulg`.
  - Captured ICC status into `.icc/ulg_status.json`.
  - Captured ICC architecture summary into `.icc/ulg_arch_summary.md`.
  - Reported `207` indexed files and `878` memory chunks.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo ulg --check-staleness`
  - Passed.
  - Reported `is_stale: false` for the current ULG `HEAD`.
- `node --check scripts/update-icc.mjs`
  - Passed.
- `node -e "JSON.parse(require('fs').readFileSync('.icc/ulg_status.json','utf8')); JSON.parse(require('fs').readFileSync('.icc/modularity-justifications.json','utf8')); console.log('json ok')"`
  - Passed.
- `git diff --check`
  - Passed.

## Current Focused Result - 2026-06-12 15:18 AKDT

Resident MLS-MPM reset-path physics continuity is passing. The reset path no
longer collapses continued GPU-resident substeps to zero active grid nodes after
the first moving substep.

Verified commands:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  - Passed.
- `node --check tests/sphMlsMpmGpuStep.test.mjs`
  - Passed.
- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs`
  - Passed, `15/15`.
- `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphGridUpdateGpuKernel.test.mjs`
  - Passed, `25/25`.
- Custom inline Chromium/WebGPU probe against `https://127.0.0.1:5173/`
  - Passed.
  - After Reset, the continued resident sequence reported active grid nodes
    `[257, 264, 273, 262]`, max displacement
    `[0.1292028725, 0.1061157286, 0.1003902778, 0.1079893708]` meters, and no
    destroyed pressure-force WebGPU buffer warnings.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, about 2.2 minutes.

## Local Unit Tests

Command: `npm test`

Current focused result on 2026-06-11 23:54 AKDT: pass after expanding resident
product-event rows with closure-derived mechanics/EOS metadata. Product-event
rows now preserve the original render fields and add velocity, support volume,
bulk/shear/Lame constants, sound speed, EOS model id, solid flag, and mechanics
status. P2G consumes event velocity and local EOS pressure when those fields are
present.

Verified suites:

- `node --check ulg-gpu-abi/src/wgsl.js && node --check ulg-gpu-abi/src/index.js && node --check src/runtime/sph/sphGridGpuKernel.js && node --check src/runtime/sph/sphReactionGpuSummary.js && node --check tests/abi.test.mjs && node --check tests/sphGridGpuKernel.test.mjs && node --check tests/sphReactionGpuSummary.test.mjs`
  passed.
- `node --test tests/abi.test.mjs tests/sphGridGpuKernel.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphRenderGpuKernel.test.mjs`
  passed `47/47`.
- Broader focused suite:
  `node --test tests/abi.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphGridGpuKernel.test.mjs`
  passed `89/89`.
- `git diff --check` passed.

Previous focused result on 2026-06-11 23:43 AKDT: pass after adding the first
resident product-mass P2G sidecar consumption slice. The P2G CPU reference and
WebGPU binding contract now accept `peercompute.ulg.sph-resident-product-mass.v0`,
bind product-event rows as read-only storage, deposit only positive
`unplacedMassKg` into grid mass, and carry prior resident product mass into the
next repeated resident step before cleanup.

Verified suites:

- `node --check src/runtime/sph/sphGridGpuKernel.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check tests/sphGridGpuKernel.test.mjs && node --check tests/sphMlsMpmGpuStep.test.mjs && node --check tests/abi.test.mjs && node --check ulg-gpu-abi/src/wgsl.js`
  passed.
- `node --test tests/sphGridGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/abi.test.mjs`
  passed `39/39`.
- Broader focused suite:
  `node --test tests/abi.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphGridGpuKernel.test.mjs`
  passed `88/88`.
- `git diff --check` passed.
- Infinite Context Coder refreshed after this slice:
  `index --repo ulg` indexed 237 files / 120,191 lines, and
  `build-memory --repo ulg` wrote 1,015 chunks.

Previous focused result on 2026-06-11 23:28 AKDT: pass after adding the
resident product-mass handle. Reaction results and resident MLS-MPM steps now
expose `peercompute.ulg.sph-resident-product-mass.v0`, including retained
product-event buffer metadata, unplaced-mass consumption policy, blocked
EOS/force coupling status, sequence-summary preservation, and guarded
destruction.

Verified suites:

- `node --check src/visualization/sphPhaseDemoMount.js && node --check src/runtime/sph/sphReactionGpuSummary.js && node --check src/runtime/sph/sphReactionGpuKernel.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/visualization/sphPhaseScene.js`
- `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseDemo.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs`
  passed `59/59`.
- Combined focused suite:
  `node --test tests/abi.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs`
  passed `76/76`.
- `git diff --check` passed.

Note: `node --test tests/demo.e2e.mjs` was attempted once and failed because
that file is a Playwright test file; it must be run via the Playwright runner,
not Node's test runner.

Previous focused result on 2026-06-11 23:27 AKDT: pass after adding the compact
product-event/product-inventory pressure bridge. Resident gas pressure still
prefers the per-species gas ledger, and now falls back to gas product-event rows
or compact product-inventory rows without full particle readback.

Verified suites:

- `node --check src/runtime/sphPhaseDemo.js && node --check src/visualization/sphPhaseDemoMount.js && node --check tests/sphPhaseDemo.test.mjs`
- `node --test tests/sphPhaseDemo.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  passed `31/31`.
- Combined focused suite:
  `node --test tests/abi.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs`
  passed `76/76`.
- `git diff --check` passed.
- Infinite Context Coder refreshed after this slice:
  `index --repo ulg` indexed 237 files / 119,369 lines, and
  `build-memory --repo ulg` wrote 1,010 chunks.

Previous focused result on 2026-06-11 23:12 AKDT: pass after adding resident
product-event render-field consumption. The ABI includes a product-event row,
verification readback is optional, normal resident runs
retain the product-event buffer on GPU, the render-field shader binds that
buffer, and unplaced product-event mass can render as generic material/phase
surface volume.

Verified suites:

- `node --check src/visualization/sphPhaseScene.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check ulg-gpu-abi/src/wgsl.js`
- `node --check tests/sphPhaseRenderer.test.mjs && node --check tests/sphRenderGpuKernel.test.mjs && node --check tests/abi.test.mjs && node --check tests/sphReactionGpuSummary.test.mjs`
- `node --test tests/abi.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphReactionGpuKernel.test.mjs`
  passed `63/63`.

Previous focused result on 2026-06-11 22:56 AKDT: pass after adding
GPU-resident sparse product-event staging for no-full-readback reaction steps.
Verification readback is optional, normal resident runs retain the product-event
buffer on GPU, and resident diagnostics/overlay rows report product-event
capacity, active rows, buffer bytes, readback bytes, and retention. Focused
ABI/reaction/resident coverage passed `44/44`.

Previous focused result on 2026-06-11 21:55 AKDT: pass after adding the
resident WebGPU reaction compact summary, compact gas/product ledger totals,
per-gas-species resident compact ledger rows, resident sealed-box pressure
plumbing, and sequence-summary preservation. The aggregate summary is a
128-byte f32x4 compact readback, each gas product has a 32-byte f32x4 compact
species row, and normal no-full resident runs still avoid particle-array
readback.

Verified suites:

- `node --check src/runtime/sph/sphReactionGpuSummary.js`
- `node --check src/runtime/sph/sphReactionGpuKernel.js`
- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
- `node --check src/runtime/sphPhaseDemo.js`
- `node --check src/visualization/sphPhaseDemoMount.js`
- `node --check src/visualization/sphPhaseScene.js`
- `node --test tests/sphMlsMpmGpuStep.test.mjs` passed `10/10`.
- `node --test tests/abi.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  passed `49/49`.
- `node --test tests/opticalClosure.test.mjs tests/opticalGpuBuffers.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphPhaseDemo.test.mjs`
  passed `53/53`.

Previous full-suite result: fail, 359/360 tests on 2026-06-11 after adding the
material resolver manifest scaffold. `node --test
tests/materialResolverManifest.test.mjs` passed `4/4`, and those tests also
passed inside `npm test`. The full suite's single failure was the dirty-tree ABI
expectation in `tests/abi.test.mjs` for `SPH GPU render field ABI exposes
material-phase surface fields`: the current row layout reports
`opticalStateId:f32` where the test still expected `pad0:f32`.

Focused current result on 2026-06-11: pass for the material resolver manifest
scaffold. Verified suites:

- `node --check src/runtime/material/materialResolverManifest.js` passed.
- `node --check tests/materialResolverManifest.test.mjs` passed.
- `node --test tests/materialResolverManifest.test.mjs` passed `4/4`.

Prior full-suite result: pass, 343/343 tests on 2026-06-11 after moving SPH
static table/GPU-warmup cache serialization into the supervised `ulg-runtime`
worker and then wiring warm scene sync to consume rehydrated static table cache
bundles. Static table cache records live in a separate localStorage family so
reaction cold-cache lookups do not parse the large table payload. Focused SPH
browser coverage passed 3/3 against `https://127.0.0.1:5173/`, including the
worker-backed `sph.static-table-cache` write path, a reset/rebuild that reports
`static-table-cache-bundle-hit` in `setParticles()`, and the room-temperature Na
+ H2O path with H2 pressure diagnostics. `npm run build` passed with the
existing Vite large-chunk warning, `npm run build:pages` regenerated the GitHub
Pages artifact in `docs/`, and `git diff --check` passed.

Previous focused result on 2026-06-11: pass after the worker-backed static table
cache and warm scene-consumption slices. Verified suites:

- `node --test tests/sphColdStartCache.test.mjs tests/contract-fixtures.test.mjs`
  passed `7/7`.
- `node --test tests/sphColdStartCache.test.mjs tests/sphPhaseRenderer.test.mjs`
  passed `12/12`.
- `node --test tests/sphPhaseDemo.test.mjs` passed `7/7`.
- `node --test tests/reactiveChemistry.test.mjs` passed `7/7`.
- `node --test tests/reactionDiscovery.test.mjs` passed `8/8`.
- `node --test tests/contract-fixtures.test.mjs tests/sphPhaseRenderer.test.mjs tests/chemistryReactionCandidates.test.mjs`
  passed `16/16`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 npx playwright test --config tests/playwright.config.mjs -g "SPH phase demo"`
  passed `3/3` after the static table cache worker slice.

This focused slice adds resident/worker/scene timing rows, partial material
cache reuse, static thermal/optical/reaction table cache records, `ulg-runtime`
pre-spawn, balanced Na/H2O -> NaOH + H2 CPU reference conversion, stale
reaction-record rejection, sealed-gas pressure diagnostics, and a worker-backed
static table cache coordinator that serializes/rehydrates typed-array cache
payloads off the UI path, and warm scene sync can restore thermal, graph,
phase-response, optical/PBR, and reaction tables from the static cache when
their generator/hash guards pass.

Prior milestone: pass, 328/328 tests on 2026-06-11 after adding explicit
transparent-surface render-order/depth-write policy for the SPH phase renderer.
Focused renderer coverage passed 7/7, focused HTTPS Chromium e2e for the SPH
phase demo passed 1/1 against `https://127.0.0.1:5173/`, `npm run build`
passed with the existing Vite large-chunk warning, and `npm run build:pages`
regenerated the GitHub Pages artifact in `docs/`.

Prior milestone: pass, 327/327 tests on 2026-06-11 after adding resident render
readback cadence/profiling telemetry and disabling the standalone MLS-MPM
mechanics prediction parity readback in the default SPH demo hot loop. Focused
HTTPS Chromium e2e for the SPH phase demo passed 1/1 against
`https://127.0.0.1:5173/`, `npm run build` passed with the existing Vite
large-chunk warning, and `npm run build:pages` regenerated the GitHub Pages
artifact in `docs/`.

Prior milestone: pass, 327/327 tests on 2026-06-11 after extending the resident
MLS-MPM compact GPU summary to include retained thermo-buffer phase masses and
temperature diagnostics. Focused ABI/thermal/reaction/resident coverage passed
40/40, focused HTTPS Chromium e2e for the SPH phase demo passed 1/1 against
`https://127.0.0.1:5173/`, `npm run build` passed with the existing Vite
large-chunk warning, and `npm run build:pages` regenerated the GitHub Pages
artifact in `docs/`.

Prior milestone: pass, 327/327 tests on 2026-06-11 after adding the persistent
SPH thermal response/graph WebGPU upload set and wiring it into resident
thermal plus reaction stages. Focused ABI/thermal/reaction/resident coverage
passed 40/40, focused HTTPS Chromium e2e for the SPH phase demo passed 1/1
against `https://127.0.0.1:5173/`, and `npm run build` passed with the existing
Vite large-chunk warning.

Prior milestone: pass, 326/326 tests on 2026-06-11 after migrating the SPH
reaction product phase reset to the shared thermal phase-response table and
thermal graph bank. Earlier milestone: pass, 134/134 tests on 2026-06-09 after
taking Kohn–Sham DFT all the way to the iron atom (multi-shell Aufbau +
tridiagonal eigensolver). Earlier still: 132/132 after the minimal radial KS-LDA
solver validated on helium.

- Kohn–Sham DFT coverage on 2026-06-09: `node --test tests/radialKohnSham.test.mjs`
  passed `3/3` — the radial KS-LDA solver reproduces helium's total energy
  (−2.823 Ha vs the LDA reference ~−2.83) and 1s orbital energy (−0.563 vs ~−0.57)
  within ~0.3%, a more-charged He-like ion is more tightly bound, and the SCF is
  deterministic.
- Multi-shell / iron KS-LDA coverage on 2026-06-09:
  `node --test tests/atomicKohnSham.test.mjs` passed `2/2` — beryllium
  (−14.41 Ha) and neon (−127.9 Ha) totals match the LDA references with exact
  electron counts, and the all-electron iron atom (Z=26, [Ar]4s²3d⁶) solves to
  exactly 26 electrons, total ~−1258 Ha (non-relativistic, near the LDA reference
  ~−1261), the full 1s..4s,3d shell structure all bound, and 3d below 4s (the
  correct LDA atomic ordering).

- ABI descriptor construction and complex64 round trip.
- JSON schema validation for service manifests, task capsules, closure artifacts,
  quantum response artifacts, simulation artifacts, and tolerance reports.
- Static Eshkol/MoonLab adapter fixtures validate against the shared schemas.
- Service contract builders reproduce the published manifest defaults and emit a
  schema-compatible default MoonLab task capsule.
- MoonLab service asset specs resolve `locateFile("moonlab.wasm")` to the
  `/service-assets/moonlab/moonlab.wasm` convention.
- MoonLab service asset specs declare optional
  `/service-assets/moonlab/magnetar-reference-contracts.json` reference-contract
  JSON while keeping only loader/WASM assets required.
- Eshkol closure-bundle service asset specs resolve manually staged artifact
  JSON, WASM, DOM-free host-import JavaScript, schema snapshot, and bundle
  manifest URLs.
- Service asset probes classify ready, missing, and wrong-MIME loader/WASM
  responses.
- Service asset probes report a missing optional MoonLab reference-contract JSON
  without changing required loader/WASM readiness.
- `npm run stage:service-assets -- --dry-run --json` reports the MoonLab and
  Eshkol source/target plan without mutating the ignored service-asset tree.
- `npm run stage:service-assets -- --moonlab-only` stages the MoonLab compact
  WebGPU parity handoff summary as reduced-scope evidence for the five covered
  operations: `compute_probabilities`, `hadamard`, `pauli_x`, `pauli_z`, and
  `cnot`; it preserves `fullFidelityMagnetarSimulation = false` and
  `fullPhysicsValidation = false`.
- `npm run stage:service-assets -- --eshkol-only` stages the Eshkol
  production-candidate runtime probe as smoke-only evidence and keeps
  production handler/runtime/full-physics readiness blocked.
- `npm run stage:service-assets -- --eshkol-only --created-at ...` forwards a
  fixed timestamp to Eshkol helpers that support reproducible bundle metadata.
  It now also stages the declared
  `eshkol.ulg.production-handler-contract.v0` production handler contract,
  preserving the `main(i32, i32) -> i32` invocation ABI, tensor input/output
  ids, required evidence, and remaining production/full-physics blockers.
- `npm run stage:service-assets -- --eshkol-only --created-at ...` also stages
  `eshkol.ulg.full-physics-validation-requirements.v0`, preserving the five
  required runtime evidence families, required hash fields, and
  `full-physics-validation-not-run` blocker without marking the production
  handler scientifically validated.
- MoonLab service asset specs include the classic core probe worker URL and the
  manifest builder approves it for child-worker leasing.
- Registry resolution, child-worker lease limits, artifact cache behavior,
  artifact-summary telemetry behavior, and GPU fallback probe behavior.
- Child-worker leases preserve `classic` vs `module` worker type metadata.
- Artifact cache summaries preserve Eshkol closure entry signature,
  start-section, import/export, WASM metadata count, and DOM-free host-import
  bundle metadata.
- Artifact cache summaries preserve Eshkol host-import JavaScript asset status,
  service-worker import factory readiness, production-host candidate
  requirements schema/status, runtime scope, implementation status, and required
  non-stub import count.
- The browser demo handoff exporter returns `peercompute.ulg.demo-handoff.v0`
  records with full closure artifacts, compact summaries, refs, and transferred
  Eshkol WASM bytes.
- Artifact cache summaries preserve Eshkol closure output-semantics metadata for
  the deterministic smoke fixture, including schema, scope, entry export/args,
  expected result, stdout hash/length, and `scientificValidation: false`.
- Artifact cache summaries preserve MoonLab magnetar reference/tolerance
  metadata, including schema, role, contract hash, normalized energy units,
  ground-state bitstring/reference energy, energy tolerance, observed energy
  delta, and validation status.
- Artifact cache summaries de-duplicate legacy `outputs.reference` plus plural
  `outputs.references[]`, count ready output references, and can derive the
  MoonLab magnetar reference summary from the plural array when the calibration
  entry does not carry a singular reference.
- Artifact cache summaries preserve the four-entry MoonLab calibrated
  magnetosphere MHD, PIC kinetic plasma, radiation transport, and relativistic
  correction inventory with four ready/scientific-coverage calibrated entries
  when valid supplied contracts are present.
- Artifact cache summaries preserve Eshkol production dispatch preflight
  metadata, including schema `eshkol.ulg.production-handler-dispatch-preflight.v0`,
  `status = blocked`, `ready = false`, ten required production dispatch
  checks, the declared production handler contract, the production-candidate
  runtime probe, deterministic runtime-smoke stubs rejected for production
  dispatch, production-candidate handler implementation/runtime-execution
  evidence, and the computed `10/9/1` check split.
- Artifact cache summaries preserve Eshkol full-physics validation requirements,
  including `declared-not-run`, `ready = false`, five required runtime evidence
  families, four required hash fields, and the
  `full-physics-validation-not-run` blocker.
- `ClosureRegistry` stores table-interpolation closure artifacts in the
  content-addressed `ArtifactCache`, resolves by closure kind/input/method hash,
  reports in-range/out-of-range/miss validity, emits cache events, and
  invalidates stale closure refs.
- The Phase 1 closure handle samples `table-interpolation` closures for energy
  and `dEdr`, and the CPU-reference carrier runtime advances a two-particle
  oscillator with compact deltas plus invariant drift reports.
- The Phase 2 optional WebGPU carrier path exposes a WGSL compute entrypoint,
  returns CPU when WebGPU is not requested or unavailable, rejects parity drift,
  reports device-lost CPU fallback, and preserves the explicit
  `peercompute.ulg.carrier-webgpu-parity.v0` schema.
- The closure-table WGSL descriptor coverage verifies
  `peercompute.ulg.closure-table-wgsl-descriptor.v0`, deterministic f32x4
  `ClosureTableSample` row layout, explicit false validation flags, stable
  sample-buffer encoding, derivative inference for tables that omit
  derivatives, and rejection of full-physics validation overclaims.
- GPU broker and worker-supervisor coverage verifies device-loss pressure
  reporting, retryable CPU fallback lease marking, and worker-originated
  `gpu-device-lost` telemetry without relaxing task completion.
- Phase 3A topology primitive coverage verifies normalized particle state,
  deterministic spatial hashing, duplicate-free and symmetric neighbor-pair
  queries, closure sampling over graph edges, out-of-range edge reporting,
  antisymmetric pair-force conservation, and parity with the existing two-body
  carrier force convention. The CPU-reference carrier runtime now emits
  edge-message conservation summaries in compact deltas, and the oscillator e2e
  smoke verifies those summaries are visible in compact artifact telemetry and
  the live artifact row as `edge:pass`. These tests preserve explicit false
  scientific/full-physics flags.
- Phase 3A field-observer coverage verifies compact-support scalar observations
  over deterministic neighbor graphs and warning behavior when no contribution
  reaches a particle. It also verifies supplied graph validation,
  symmetric-pair canonicalization, recipient smoothing-length behavior,
  duplicate-position handling, and explicit empty-field rejection. The observer
  summaries preserve explicit false scientific/full-physics flags and do not
  claim SPH/material/EOS readiness.
- The ABI schema coverage now validates
  `peercompute.ulg.simulation-artifact.v0`, and service-contract tests lock the
  `ulg-runtime` service id, `simulation.step` task kind, capabilities, and
  default `simulation-delta` output artifact kind.
- Focused service-asset/orchestration coverage after the host-import import-glue
  slice:
  `node --test tests/orchestration.test.mjs tests/service-assets.test.mjs`
  passed `14/14`.
- Focused carrier-runtime coverage on 2026-06-08:
  `node --test tests/closureRegistry.test.mjs` passed `2/2`,
  `node --test tests/carrierRuntime.test.mjs` passed `2/2`, and
  `node --test tests/abi.test.mjs tests/contract-fixtures.test.mjs` passed
  `7/7`.
- Focused WebGPU carrier-runtime coverage on 2026-06-08:
  `node --test tests/webgpuCarrierKernel.test.mjs` passed `7/7`, and
  `node --test --test-name-pattern "GPU broker|WorkerSupervisor records gpu-device-lost" tests/orchestration.test.mjs`
  passed `3/3`.
- Focused closure-table WGSL descriptor coverage on 2026-06-08:
  syntax checks for `ulg-gpu-abi/src/index.js`, `ulg-gpu-abi/src/wgsl.js`,
  `src/runtime/webgpuCarrierKernel.js`, `tests/abi.test.mjs`, and
  `tests/webgpuCarrierKernel.test.mjs` passed; `node --test
  tests/abi.test.mjs tests/webgpuCarrierKernel.test.mjs
  tests/carrierRuntime.test.mjs` passed `14/14`; `npm test` passed `54/54`;
  `npm run build` passed with the existing large chunk warning; `npm run
  test:e2e` passed `2/2`; and `npm run status:live -- --bridge` preserved the
  default MoonLab/Eshkol two-artifact handoff and Multiscale bridge ack
  `handoff-ready`.
- Focused oscillator closure-artifact descriptor surface coverage on
  2026-06-08:
  syntax checks for `src/runtime/demoRuntime.js` and `tests/demo.e2e.mjs`
  passed; `node --test tests/abi.test.mjs tests/webgpuCarrierKernel.test.mjs
  tests/carrierRuntime.test.mjs` passed `14/14`; and `npm run test:e2e -- --grep
  "ULG oscillator demo"` passed `1/1` while verifying
  `tableDescriptor.wgslTableDescriptor` and `execution.wgslTableDescriptor`.
  The follow-up full regression passed `npm test` (`54/54`), `npm run build`,
  full Playwright e2e (`2/2`), `npm run status:live -- --bridge`, and
  `git diff --check`.
- Focused closure refresh-request coverage on 2026-06-08:
  syntax checks for `src/runtime/fieldClosureSamples.js`,
  `src/runtime/ClosureRegistry.js`, `src/runtime/artifactSummary.js`,
  `src/runtime/webgpuCarrierKernel.js`, `src/main.js`, and related tests passed;
  `node --test tests/fieldClosureSamples.test.mjs tests/carrierRuntime.test.mjs
  tests/webgpuCarrierKernel.test.mjs` passed `16/16`, including out-of-range
  field sampling, `ClosureRegistry.applyRefreshRequest()` invalidation, in-range
  no-op preservation, compact artifact summary fields, and CPU/WebGPU delta
  contract parity. The follow-up full regression passed `npm test` (`56/56`),
  `npm run build`, full Playwright e2e (`2/2`), `npm run status:live --
  --bridge`, and `git diff --check`.
- End-to-end closure refresh path coverage on 2026-06-08 (recommended-work
  item 1): `node --test tests/carrierRuntime.test.mjs` passed `5/5` (added:
  carrier run halts on a closure-domain exit and surfaces a
  `closure-refresh-request.v0` with status `refresh-recommended`,
  `sourceKind: carrier-runtime-closure-domain-exit`, and all
  scientific/material/EOS/SPH/phase flags false; an in-range run reports no
  domain exit). New `node --test tests/closureRefreshPath.test.mjs` passed `2/2`:
  a domain-exit simulation artifact drives
  `ClosureRegistry.applyRefreshRequest()` invalidation, emits a content-addressed
  `closure-invalidation-artifact.v0` (non-overclaiming, with simulation parent
  ref) and the `closure-invalidated` event, and a later resolve misses; an
  in-range simulation leaves the closure valid and emits no artifact. Full
  regression: `npm test` `60/60`, `npm run build`, `npm run test:e2e` `2/2`, and
  `git diff --check` clean. `npm run status:live -- --bridge` ULG live status
  healthy on 0.0.0.0:5173; bridge ack not re-confirmed because the PeerCompute
  Multiscale 5185 server was down in this environment (bridge/handoff envelope
  untouched by this change).
- Opt-in ULG runtime handoff coverage on 2026-06-08 (recommended-work item 3):
  new `node --test tests/ulgRuntimeHandoff.test.mjs` passed `2/2` —
  `createUlgRuntimeHandoff` includes only `ulg-runtime`/`ulg-runtime-fixture`
  artifacts, surfaces `wgslTableDescriptor` on the closure entry, classifies the
  `closure-invalidation` artifact distinctly, and pulls MoonLab/Eshkol ancestors
  only when `includeAncestors` is set. The default handoff/bridge path is
  unchanged.
- Closure rederivation loop coverage on 2026-06-08 (recommended-work item 4):
  `node --test tests/closureRefreshPath.test.mjs` passed `4/4` — domain exit →
  invalidate → opt-in rederive re-registers a closure whose expanded domain
  covers the offending input and resolves in-range there, emitting a
  content-addressed `closure-rederivation-artifact.v0` with old→new lineage and
  all scientific/material/EOS/SPH/phase flags false; plus a guard test that no
  rederivation occurs unless opted in. Full regression: `npm test` `64/64`,
  `npm run build`, `npm run test:e2e` `2/2`, `git diff --check` clean. The live
  two-server ULG→Multiscale handoff smoke was re-confirmed (exit 0, `handoff
  ready / blockers 0`, default 2-artifact handoff) with Multiscale on
  localhost:5185.
- SPH phase demo thermodynamic preflight coverage on 2026-06-08 (first physics
  slice): new `node --test tests/thermoPreflight.test.mjs` passed `6/6` —
  iron cube is 1/8 the ice volume (0.125 m^3, 875 kg) with ice 917 kg and air
  ~1512 kg; cold infinite reservoirs make cold solid iron + ice feasible with
  ~864 MJ exported to the walls (144 MJ/face) and the iron able to melt but not
  boil all the ice; an adiabatic sealed box reaches a ~352.6 K mixed equilibrium
  and is correctly reported INFEASIBLE (as are walls set >= freezing); and the
  preflight + its ABI artifact never overclaim (`closureBacked` and all
  scientific/material/EOS/SPH/phase flags false). Full regression: `npm test`
  `70/70`, `npm run build`, `git diff --check` clean.
- SPH phase demo P1/P2/P3 coverage on 2026-06-08: new
  `node --test tests/sphPhaseContracts.test.mjs` passed `6/6` (closure family
  schemas, the overclaim guard rejecting validation flags without evidence refs,
  six-face wall guard, resolution mass invariant, phase-equilibrium/conservation
  builders) and `node --test tests/materialThermo.test.mjs` passed `7/7`
  (reference closures non-overclaiming and citing pending microphysics; closure
  energy == reference energy; phase-equilibrium lever rule at the melt plateau;
  MaterialRegistry density/phase/energy sampling; out-of-domain sampling emits a
  refresh request; closure-backed preflight reproduces the reference path and
  blocks with a refresh request when iron starts above the Fe closure domain).
  Full regression: `npm test` `83/83`, `npm run build`, `git diff --check` clean.
- SPH phase demo P4 conservative carrier coverage on 2026-06-08: new
  `node --test tests/sphCarrier.test.mjs` passed `5/5` — cubic-spline kernel
  support, symmetric pressure forces conserving momentum to round-off, an
  inviscid run conserving total energy (<1% drift) and momentum (<1e-9) with
  exact mass, particle phase emerging from specific internal energy, and the SPH
  simulation artifact staying evidence-only. Full regression: `npm test`
  `88/88`, `npm run build`, `git diff --check` clean.
- MoonLab microphysics reference coverage on 2026-06-08: new
  `node --test tests/microphysics.test.mjs` passed `4/4` — the H2 dissociation
  curve (exact diagonalization of MoonLab's molecular Hamiltonian) yields an
  equilibrium bond length of 0.7414 A (experiment ~0.741) within ~4.9 mHa of the
  FCI reference and a ~3.87 eV bond energy; the H2 reference is
  produced-quantitative and the H2O reference produced-model-not-quantitative,
  both non-overclaiming; and the H2O material closure cites the produced
  reference (status produced) while materialValidation stays false (fe/air still
  pending). Full regression: `npm test` `92/92`, `npm run build`,
  `git diff --check` clean.
- ULG SPH phase demo coverage on 2026-06-08: `node --test
  tests/sphPhaseDemo.test.mjs` passed `3/3` (cold-ice-on-hot-iron initial build,
  phase/temperature from closure energy, preflight feasible + bounded stepping
  inside the sealed box) and `node --test tests/radiationClosure.test.mjs` passed
  `4/4` (blackbody colour follows the Planck locus — molten iron orange, blue
  rising to white; cold matter non-incandescent / flagged placeholder; radiation
  closure closureBacked but opticalValidation false). Full regression `npm test`
  `99/99`, `npm run build`. A headless browser check on `127.0.0.1:5173` confirmed
  the SPH Phase overlay opens, preflight-feasible, 280 particles, no console
  errors, iron glowing with the derived blackbody colour.
- First-principles material closure coverage on 2026-06-09: new
  `node --test tests/statisticalMechanics.test.mjs` passed `4/4` (air equipartition
  cv≈715/cp≈1002/γ≈1.40, Debye reaches Dulong–Petit at high T and falls below it
  at low T, iron θ_D≈470 K from sound speed + density, Debye dU/dT = cv) and
  `node --test tests/opticalClosure.test.mjs` passed `4/4` (flat reflectance →
  white/black, Drude metal high+flat reflectance, iron warm grey + water/ice blue
  + air near-transparent, optical closure non-overclaiming). The
  materialThermo/closure-backed-preflight tests were updated for the
  first-principles values (iron solid now Debye; closure-backed heat-to-walls
  ~845 MJ vs the constant-cp baseline 864 MJ, consistent on masses + feasibility).
  Full regression `npm test` `107/107`, `npm run build`, and a headless render
  check (ice blue, molten iron orange glow, no console errors).
- Material EOS + latent-heat coverage on 2026-06-09: new
  `node --test tests/materialEos.test.mjs` passed `7/7` — Grüneisen linear thermal
  expansion of iron 1.18e-5/K, ρ(T) drop toward melting (~7469 at 1800 K),
  Richards L_fus within ~10% for iron, Trouton underestimating water L_vap (flagged
  as associated-liquid, not faked), Clausius–Clapeyron boiling depression, the
  MaterialRegistry returning a temperature-dependent iron density, and the EOS
  closure non-overclaiming (eosValidation false). The closure-backed preflight
  test was updated: Debye + Richards corrections nearly cancel (~865 MJ vs the
  864 MJ baseline). Full regression `npm test` `114/114`, `npm run build`,
  `git diff --check` clean.
- General MD statistical-mechanics engine coverage on 2026-06-09: new
  `node --test tests/mdEngine.test.mjs` passed `3/3` — on a generic Lennard-Jones
  (argon-like) system the engine recovers equipartition (measured T tracks the
  thermostat), the ideal-gas law PV = N kB T at low density from the virial
  pressure (within 10%), and a monatomic heat capacity (3/2) N kB from dE/dT
  (within 15%) — all measured uniformly with the potential as the only
  per-material input, no analytic per-material model. Full regression `npm test`
  `117/117`, `npm run build`.
- Condensed-phase MD estimator coverage on 2026-06-09: new
  `node --test tests/mdCondensed.test.mjs` passed `3/3` — diffusion (MSD)
  distinguishes a cold LJ solid from a hot liquid; the EOS scan shows pressure
  rising under compression with a positive bulk modulus and density increasing
  with pressure; the melting scan shows potential energy + diffusion jumping
  across the transition. All measured uniformly from the one engine.
- Ab-initio → potential pipeline coverage on 2026-06-09: new
  `node --test tests/potentialFitting.test.mjs` passed `3/3` — the Morse fit to
  MoonLab's H2 dissociation curve recovers r_e = 0.7414 Å and D_e = 3.87 eV with
  zero force at r_e, the fitter round-trips a known Morse potential, and the
  fitted potential drives the MD engine as a bound pair. Full regression
  `npm test` `123/123`, `npm run build`.
- Periodic electronic-structure coverage on 2026-06-09: new
  `node --test tests/electronicStructure.test.mjs` passed `5/5` — the uniform
  electron gas reproduces the exact Thomas–Fermi kinetic and Dirac exchange and
  matches Ceperley–Alder QMC correlation within ~3% (r_s = 1, 2, 5); jellium
  cohesion derives sodium's equilibrium density (955 vs 971 kg/m^3) and bulk
  modulus (7.0 vs 6.3 GPa) from electronic structure with one pseudopotential
  radius; and a bare point ion overbinds (r_s ≈ 1.6), confirming the empty core is
  physically required. Full regression `npm test` `128/128`, `npm run build`.
- Focused Phase 3A topology primitive coverage on 2026-06-08:
  `node --test tests/carrierRuntime.test.mjs tests/spatialHash.test.mjs tests/edgeMessages.test.mjs tests/webgpuCarrierKernel.test.mjs`
  passed `17/17`.
- Focused Phase 3A field-observer coverage on 2026-06-08:
  `node --test tests/observers.test.mjs tests/spatialHash.test.mjs tests/edgeMessages.test.mjs`
  passed `12/12`.
- Focused Phase 3A field-observer carrier-surface coverage on 2026-06-08:
  `node --test tests/carrierRuntime.test.mjs tests/observers.test.mjs tests/webgpuCarrierKernel.test.mjs`
  passed `15/15`, `npm test` passed `49/49`, `npm run build` passed with the
  existing large chunk warning, and `npm run test:e2e` passed `2/2` with
  delta-level `peercompute.ulg.field-observer-summary.v0`, compact
  `simulationFieldObserver*` summary fields, and visible `field:pass`.
- Focused Phase 3A field-closure sample coverage on 2026-06-08:
  `node --test tests/fieldClosureSamples.test.mjs tests/carrierRuntime.test.mjs tests/observers.test.mjs tests/webgpuCarrierKernel.test.mjs`
  passed `19/19`, including standalone observed-field closure sampling,
  sampled-output bounds, out-of-range and null-field warning behavior, carrier
  delta summaries, WebGPU fallback delta summaries, and accepted WebGPU parity
  delta summaries. `npm test` passed `53/53`, `npm run build` passed with the
  existing large chunk warning, `npm run test:e2e` passed `2/2` with visible
  `closure-field:pass`, and `npm run status:live -- --bridge` preserved the
  default two-artifact MoonLab/Eshkol handoff and Multiscale bridge ack
  `handoff-ready`.

## Current Handoff Validation Summary

Validation run on 2026-06-07 after surfacing Eshkol's declared full-physics
validation requirements:

- `npm run stage:service-assets -- --eshkol-only --created-at
  2026-06-07T00:04:00-08:00`: passed and staged
  `eshkol.ulg.production-handler-contract.v0`,
  `eshkol.ulg.production-handler-implementation.v0`, and
  `eshkol.ulg.production-handler-runtime-execution.v0`, plus
  `eshkol.ulg.full-physics-validation-requirements.v0`.
- `node --test tests/orchestration.test.mjs --test-name-pattern "artifact
  cache summarizes Eshkol"`: passed, `7/7`.
- `npm test`: passed, `22/22`.
- `npm run build`: passed with the existing Vite large chunk warning.
- `npm run test:e2e`: passed, `1/1` Chromium test.
- `npm run status:live -- --bridge`: passed; live ULG on
  `http://100.86.83.35:5173/` reports
  `productionHandlerContractDeclared = true`,
  `productionHandlerContractInvocationArgumentMode = linear-memory-offsets`,
  `productionHandlerContractRequiredEvidenceCount = 8`,
  `fullPhysicsValidationRequirementsDeclared = true`,
  `fullPhysicsValidationRequiredRuntimeEvidenceCount = 5`, and production
  dispatch preflight counts `10/9/1`.

The MoonLab compact WebGPU parity handoff remains reduced-scope evidence for
five operations only. The Eshkol production-candidate runtime probe, handler
implementation, runtime execution, and full-physics requirements remain
deterministic tensor smoke / declared requirement evidence. Production dispatch
preflight records `10/9/1`; it does not promote scientific validation,
full-fidelity magnetar simulation, or full-physics validation.

## Carrier Runtime Validation Summary

Validation run on 2026-06-08 after adding the Phase 1 CPU-reference carrier
runtime:

- `node --check` passed for `ClosureRegistry.js`, `closureHandle.js`,
  `invariants.js`, `carrierRuntime.js`, `ulgRuntime.worker.js`,
  `demoRuntime.js`, `closureRegistry.test.mjs`, and `carrierRuntime.test.mjs`.
- `node --test tests/closureRegistry.test.mjs`: passed, `2/2`.
- `node --test tests/carrierRuntime.test.mjs`: passed, `2/2`.
- `node --test tests/abi.test.mjs tests/contract-fixtures.test.mjs`: passed,
  `7/7`.
- `npm test`: passed, `27/27`.
- `npm run build`: passed with the existing Vite large chunk warning and emitted
  bundled `ulgRuntime.worker`.
- `npm run test:e2e`: passed, `2/2`; the second browser smoke calls
  `window.__ulgDemo.runOscillatorDemo()`, verifies cached closure validity,
  `peercompute.ulg.simulation-artifact.v0`, CPU-reference execution, invariant
  pass status, 32 deltas, false scientific/full-physics flags, and visible
  `simulation:carrier-toy` telemetry.
- `npm run status:live -- --bridge`: passed against
  `http://100.86.83.35:5173/`, preserving the default two-artifact
  Eshkol/MoonLab magnetar handoff and `handoff-ready` Multiscale ack.

## Production Build

Command: `npm run build`

Current result: pass on 2026-06-08 after the carrier-runtime slice, with the
existing Vite large chunk warning.

## Browser Smoke

Command: `npm run test:e2e`

Current result: pass, 2/2 Chromium tests on 2026-06-08 after the
carrier-runtime slice.

- Load the Vite app through Playwright.
- Verify two supervised services register and run.
- Verify worker telemetry appears.
- Verify MoonLab service telemetry includes non-skipped asset probe status.
- Verify the published MoonLab service/task fixtures can be consumed by a browser
  worker and resolve the expected `locateFile` WASM URL.
- Runtime artifact readiness check on 2026-06-05: copied generated MoonLab core
  `moonlab.js` and `moonlab.wasm` into ignored `public/service-assets/moonlab/`;
  `curl -I` returned `text/javascript` for JS and `application/wasm` for WASM;
  a Playwright telemetry probe reported MoonLab `assetProbe.status = ready`.
- Runtime core probe check on 2026-06-05: with copied MoonLab assets present,
  Playwright verified the supervised MoonLab artifact method
  `moonlab-wasm-bell-phi-plus-probe`, `coreProbe.status = ready`, validation
  `pass`, and Bell `phi_plus` probabilities close to `[0.5, 0, 0, 0.5]`.
- Runtime parity artifact check on 2026-06-05: with copied MoonLab assets
  present, Playwright verifies
  `peercompute.ulg.quantum-response-descriptor.v0`,
  `peercompute.ulg.quantum-response-parity.v0`, a passing
  `moonlab-wasm-core` comparison, and an explicit unsupported `moonlab-webgpu`
  comparison for the still-missing browser WebGPU parity kernel.
- Live VPN check on 2026-06-05: `http://100.86.83.35:5173/` returned the same
  MoonLab artifact method, core probe status, validation status, and Bell
  probability vector through `window.__ulgDemo.artifactCache`.
- Runtime magnetar calibration check on 2026-06-05: with copied MoonLab assets
  present, Playwright verifies
  `peercompute.ulg.magnetar-dipole-ising-calibration.v0` under the MoonLab
  artifact's `calibrationArtifacts.magnetarDipoleIsing`, passing WASM-vs-JS
  Ising energy parity with `groundState.bitString = "000"`,
  `maxEnergyDelta = 0`, and `evaluatedBitstrings = 8`.
- Runtime magnetar reference check on 2026-06-06: with copied MoonLab assets
  present, Playwright verifies `outputs.reference` carries
  `moonlab.magnetar-dipole-ising-reference.v0`, role
  `peercompute-reference-tolerance-input`, contract hash
  `sha256:f85763af06f271c414d55e29884ee7b0d5738a4a7ec9351493964b98f8d4e1ec`,
  energy units `normalized-ising`, ground state `000`, reference energy
  `-1.6712962962963`, tolerance `1e-9`, zero observed energy delta, and passing
  reference validation.
- Runtime plural reference check on 2026-06-06: with copied MoonLab assets
  present, Playwright verifies `outputs.reference` still carries the ready
  dipole-Ising compatibility contract while `outputs.references[]` carries the
  calibrated family inventory.
- Runtime calibrated reference inventory check on 2026-06-06: with copied
  MoonLab assets present, Playwright verifies `outputs.references[]` carries the
  scoped analytic `magnetosphere-mhd` dipole-field reference plus staged reduced
  PIC kinetic plasma, radiation transport, and relativistic correction supplied
  contracts. All four calibrated entries report ready/scientific coverage when
  the optional JSON is present; the test still accepts blocked placeholders when
  the optional JSON is absent.
- Runtime optional MoonLab reference-contract asset check on 2026-06-06:
  Playwright verifies the MoonLab service asset probe reports
  `referenceContractModule` for
  `/service-assets/moonlab/magnetar-reference-contracts.json` as
  `required: false`; when the file is absent behind Vite's HTML fallback, the
  service remains `ready` and the core probe records optional
  `referenceContracts.status = "missing"`.
- Live VPN calibrated inventory check on 2026-06-06:
  `http://100.86.83.35:5173/` reported four raw
  `outputs.references[]` entries for magnetosphere MHD, PIC kinetic plasma,
  radiation transport, and relativistic correction, compact
  `outputReferenceCount = 5`, `outputReferenceReadyCount = 5`,
  `magnetarCalibratedReferenceCount = 4`, and four calibrated ready/scientific
  coverage entries.
- Live VPN ULG-to-PeerCompute magnetar handoff check on 2026-06-06:
  ULG exported two handoff artifacts: MoonLab with
  `outputReferenceReadyCount = 5` and
  `magnetarCalibratedReferenceReadyCount = 4`, and Eshkol with
  `closureReady = true`, `wasmByteLength = 33907`. PeerCompute accepted the
  handoff as `handoff-ready`, `2/2` required handoffs ready,
  `scientific-tolerance-suite-ready`, and then recorded five proxy-only runtime
  evidence entries with five SHA-256 evidence hashes, five proxy-validation
  passes, `observedCount = 5`, `proxyOnlyCount = 5`, `validatedCount = 0`, and
  the remaining blocker `proxy-runtime-not-scientific`.
- Live VPN stricter PeerCompute runtime-gate check on 2026-06-06:
  after local PeerCompute commit `c0610ca7`, a fresh browser probe still reports
  `handoff-ready`, `scientific-tolerance-suite-ready`, five proxy-validation
  passes, five SHA-256 runtime evidence hashes, `validatedCount = 0`, and
  scientific runtime gate blocker `proxy-runtime-not-scientific`.
- Service-asset staging command check on 2026-06-06:
  `npm run stage:service-assets` copied MoonLab `moonlab.js`, `moonlab.wasm`,
  generated the normalized `magnetar-reference-contracts.json` suite,
  regenerated the Eshkol `hello` closure bundle with
  `eshkol.ulg.closure-output-semantics.v0`, and `npm run test:e2e` stayed green
  afterward.
- Normalized MoonLab reference suite staging check on 2026-06-06:
  `npm run stage:service-assets -- --moonlab-only --dry-run --json`,
  `npm run stage:service-assets -- --moonlab-only`,
  `npm run stage:service-assets -- --dry-run --json`, and
  `npm run stage:service-assets` passed. The generated browser asset reports
  schema `moonlab.magnetar.normalized-reference-suite.v0`, status
  `reference-contract-suite-ready`, top-level `ready: true`, and four ready
  calibrated references.
- Live VPN normalized-suite and descriptor-closure handoff check on 2026-06-06:
  after generated-suite staging and Eshkol `magnetar-closure` descriptor
  staging, ULG exported MoonLab `outputReferenceReadyCount = 5`,
  `magnetarCalibratedReferenceReadyCount = 4`, and Eshkol
  `wasmByteLength = 53066`. PeerCompute accepted the handoff as `handoff-ready`,
  reported `scientific-tolerance-suite-ready`,
  `transferredWasmByteLength = 53066`, descriptor probe ready, no host-runtime or
  output-semantics execution claim for the descriptor path, five proxy-only
  runtime evidence entries after refresh, and the intended blocker
  `proxy-runtime-not-scientific`.
- Live VPN reduced calibrated runtime evidence check on 2026-06-06:
  after PeerCompute commits `d0dbe1f5` and `df4ea25a`,
  `window.__multiscaleDemo.refreshScenarioCalibratedRuntimeEvidence()` on
  `https://100.86.83.35:5185/?scenario=magnetar` reported
  `manifestEntryCount = 5`, `manifestScientificExecution = true`,
  `runtime-evidence-ready`, `scientificExecution = true`,
  `validatedCount = 5`, `missingCount = 0`, `proxyOnlyCount = 0`,
  `scientific-runtime-ready`, `scenarioScientificReady = true`, and no blockers
  after applying the live ULG handoff from `http://100.86.83.35:5173/`.
- Live VPN durable service-envelope check on 2026-06-06: after PeerCompute
  commit `fbcc4f17`, the live ULG handoff from
  `http://100.86.83.35:5173/` and PeerCompute
  `https://100.86.83.35:5185/?scenario=magnetar` returned
  `peercompute.ulg.handoff-service-envelope.v0` with `ready = true`,
  `status = service-envelope-ready`, `artifactCount = 2`,
  `relaySafeArtifactCount = 2`, `contentAddressedArtifactCount = 2`, no
  envelope blockers, Eshkol transferred WASM length `53066`, and the reduced
  calibrated runtime gate still at `runtime-evidence-ready`,
  `validatedCount = 5`, `scientific-runtime-ready`,
  `scenarioScientificReady = true`, and no blockers after awaited calibrated
  runtime refresh.
- Live VPN Eshkol descriptor-binding check on 2026-06-06: after Eshkol commit
  `31cbbfc` and `npm run stage:service-assets -- --eshkol-only`, the live ULG
  handoff preserved `eshkol.ulg.magnetar-closure-descriptor-binding.v0`, named
  `peercompute.ulg.handoff-service-envelope.v0`, carried MoonLab suite hash
  `sha256:7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`,
  reported four closure-surface sample ids, kept
  `descriptor-bound-not-executed` / `declared-not-executed`, preserved
  `scientificValidation = false`, and still gave PeerCompute
  `service-envelope-ready`, `runtime-evidence-ready`, `validatedCount = 5`,
  `scientific-runtime-ready`, `scenarioScientificReady = true`, and no blockers.
- PeerCompute envelope-backed service-host check on 2026-06-06: after commit
  `2776682d`, focused service-orchestration coverage passed `14/14`, proving
  `UlgHandoffServiceHost` can run under `WorkerSupervisor`, accept a raw ULG
  handoff task, emit `peercompute.ulg.handoff-service-result.v0`, and store the
  durable `peercompute.ulg.handoff-service-envelope.v0` artifact through the
  supervisor artifact cache.
- PeerCompute envelope-backed service-dispatch check on 2026-06-06: after
  commit `22feae0b`, `node --test
  peercompute/tests/unit/serviceOrchestration.test.js` passed `15/15`, proving
  durable ULG handoff envelopes derive
  `peercompute.ulg.handoff-service-dispatch-plan.v0`, map MoonLab and Eshkol
  artifact refs to concrete service tasks, preserve relay-safe/content-addressed
  refs and transferred Eshkol WASM metadata, optionally execute through an
  injected service executor, and cache dispatch plan/result metadata beside the
  envelope.
- Eshkol production dispatch preflight check on 2026-06-06:
  `npm run stage:service-assets -- --eshkol-only`, `npm test`,
  `npm run build`, `npm run test:e2e`, and
  `npm run status:live -- --bridge` passed. The live Eshkol status reports
  `productionDispatchPreflightStatus = blocked`,
  `productionDispatchPreflightReady = false`,
  required production runtime ABI
  `wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0`,
  rejected runtime scope `deterministic-runtime-smoke-stubs`, and current
  blocker `full-physics-validation-not-run`.
- Earlier Eshkol production dispatch preflight computed-evidence check on
  2026-06-06:
  `npm run stage:service-assets -- --eshkol-only`, `npm test`,
  `npm run build`, `npm run test:e2e`, `git diff --check`, and
  `npm run status:live -- --bridge` passed. The live ULG status reports
  `productionDispatchPreflightCheckSummarySchema =
  eshkol.ulg.production-handler-dispatch-preflight-check-summary.v0`,
  `productionDispatchPreflightTotalRequiredCheckCount = 8`,
  `productionDispatchPreflightPassedCheckCount = 4`, and
  `productionDispatchPreflightBlockedCheckCount = 4`. Passed checks are module
  hash, entry signature, f64 tensor memory binding, and production smoke-stub
  rejection; blocked checks are non-stub host imports, handler readiness,
  runtime execution, and full-physics validation. This count has since been
  superseded by later production-handler contract and runtime evidence slices.
  durable envelope.
- Magnetar fidelity/runtime scope gate on 2026-06-06:
  `npm run stage:service-assets`, `npm test`, `npm run build`, and
  `npm run test:e2e` passed after adding
  `ulg.magnetar.fidelity-runtime-scope.v0` to MoonLab reference summaries and
  Eshkol descriptor-binding summaries. A strict live ULG `5173` to PeerCompute
  `5185` browser probe then reported `runtime-evidence-ready`,
  `validatedCount = 5`, `proxyOnlyCount = 0`, `missingCount = 0`,
  `scientificReady = true`, no blockers, tolerance-scope readiness for
  `pic-kinetic-plasma`, and explicit `fullFidelityMagnetarSimulation = false`
  plus `fullPhysicsValidation = false` in the calibrated runtime scope.
- PeerCompute registry-backed dispatch executor check on 2026-06-06: after
  commit `ae67d31e`, full `node --test
  peercompute/tests/unit/serviceOrchestration.test.js` passed `16/16`, proving
  `createUlgHandoffSupervisorServiceExecutor()` can submit dispatch tasks to
  registered `moonlab-ulg-fixture` and `eshkol-ulg-fixture` service hosts under
  the same `WorkerSupervisor`, preserve nested service task/result metadata,
  and still cache the parent durable envelope plus dispatch plan/result.
- PeerCompute materialized dispatch payload check on 2026-06-06: after commit
  `697f8d8b`, full `node --test
  peercompute/tests/unit/serviceOrchestration.test.js` passed `16/16`, proving
  supervisor-submitted dispatch tasks carry
  `peercompute.ulg.handoff-dispatch-artifact-payload.v0` with MoonLab
  quantum-response summaries and Eshkol closure bodies plus transferred WASM
  bytes for registered service adapters.
- PeerCompute dispatch service-adapter check on 2026-06-06: after commit
  `4d45714b`, full `node --test
  peercompute/tests/unit/serviceOrchestration.test.js` passed `16/16`, proving
  exported `UlgDispatchServiceHost` MoonLab/Eshkol adapters validate materialized
  dispatch payloads, request/release supervised child leases, emit typed dispatch
  service results/artifacts, and cache nested acceptance artifacts beside the
  parent durable handoff envelope.
- Live VPN Multiscale dispatch adapter-worker check on 2026-06-06: after
  PeerCompute commit `c198326c`, `window.__multiscaleDemo.runUlgDispatchServiceAdapterProbe(handoff)`
  on `https://100.86.83.35:5185/?scenario=magnetar` returned
  `peercompute.multiscale.ulg-dispatch-service-adapter-probe.v0`,
  `dispatch-adapters-ready`, `ready = true`, `dispatchCount = 2`,
  `executedDispatchCount = 2`, `acceptedDispatchCount = 2`,
  `failedDispatchCount = 0`, nested dispatch artifact refs for
  `moonlab-ulg-fixture` and `eshkol-ulg-fixture`, MoonLab
  `magnetarDipoleIsingReady = true`, Eshkol `wasmByteLength = 53066`, and no
  blockers.
- Live VPN dispatch adapter-probe check on 2026-06-06: after PeerCompute commit
  `0eae0a68`, the same adapter-worker probe returned MoonLab probe schema
  `peercompute.ulg.moonlab-dispatch-payload-probe.v0` with `probeStatus = pass`
  and Eshkol probe schema `peercompute.ulg.eshkol-dispatch-wasm-probe.v0` with
  `moduleCompiled = true`, `importCount = 33`, `exportCount = 1`,
  `hasEntryExport = true`, Eshkol `wasmByteLength = 53066`, and no blockers.
- Live VPN descriptor-contract adapter check on 2026-06-06: after PeerCompute
  commit `7cae7660`, the live ULG handoff still returned
  `dispatch-adapters-ready` with Eshkol `moduleCompiled = true`,
  `importCount = 33`, `exportCount = 1`, and descriptor contract status
  `descriptor-contract-ready`. A synthetic descriptor-only handoff through the
  same browser Worker API returned `eshkol.ulg.closure.descriptor-bind`,
  `hasTransferredWasmBytes = false`, probe mode
  `descriptor-contract-metadata-only`, `moduleCompiled = false`,
  tensor/table contract matches, MoonLab reference count `4`, runtime status
  `declared-not-executed`, and no blockers.
- Live VPN Eshkol host-runtime dry-probe check on 2026-06-06: after PeerCompute
  commit `b00ac043`, the live ULG handoff returned `dispatch-adapters-ready`
  with Eshkol `moduleCompiled = true`, `importCount = 33`, `exportCount = 1`,
  descriptor contract status `descriptor-contract-ready`, host-runtime probe
  status `host-runtime-dry-probe-ready`, `instantiated = true`, `30` function
  stubs plus memory/global/table stubs, `stubCallCount = 0`,
  `mainInvoked = false`, `scientificExecution = false`, and no blockers.
- Live VPN gated smoke-execution check on 2026-06-06: after PeerCompute commit
  `8259ecb6`, the live magnetar descriptor handoff still returned
  `dispatch-adapters-ready` with host-runtime dry probe ready and
  `hostRuntimeExecution = null`, `mainInvoked = false`, and
  `scientificExecution = false`. A synthetic smoke-output-semantics handoff
  returned `dispatch-adapters-ready`, host-runtime execution status
  `host-runtime-output-semantics-validated`, `entryInvoked = true`,
  `entryResult = 0`, output-semantics validation ready, and
  `scientificExecution = false`.
- Live VPN Multiscale dispatch-plan API check on 2026-06-06: after PeerCompute
  commit `fa33b97f`, a browser probe waited for ULG
  `artifactCache.list().length >= 2`, exported
  `peercompute.ulg.demo-handoff.v0` with `quantum-response` and `closure`
  artifacts plus Eshkol `wasmByteLength = 53066`, then verified
  `window.__multiscaleDemo.applyUlgDemoHandoffForScenario(handoff)` and direct
  `window.__multiscaleDemo.createUlgHandoffServiceDispatchPlan(handoff)` both
  returned `peercompute.ulg.handoff-service-dispatch-plan.v0`,
  `dispatch-ready`, `dispatchCount = 2`, `readyDispatchCount = 2`, service ids
  `moonlab-ulg-fixture` and `eshkol-ulg-fixture`, task kinds
  `moonlab.ulg.quantum-response.ingest` and
  `eshkol.ulg.closure-artifact.ingest`, Eshkol dispatch WASM byte length
  `53066`, and no dispatch blockers.
- Live VPN digest-addressed artifact-ref check on 2026-06-06: after hardening
  ULG `ArtifactCache`, `npm test` passed `18/18`, `npm run build` passed with
  the existing large chunk warning, `npm run test:e2e` passed `1/1`, and a live
  browser probe showed both exported handoff refs as
  `artifact://sha256:<64 hex>` with matching `artifactHash` values. The
  Multiscale dispatch plan stayed `dispatch-ready`, `dispatchCount = 2`,
  `readyDispatchCount = 2`, and reported `digestAddressed = true` for both
  MoonLab and Eshkol dispatches with no blockers.
- Artifact-summary telemetry check on 2026-06-05: Playwright verifies the
  MoonLab artifact telemetry record carries
  `peercompute.ulg.artifact-summary.v0`, magnetar readiness `true`, ground state
  `000`, `maxEnergyDelta = 0`, and `evaluatedBitstrings = 8` without fetching
  the full artifact body.
- MoonLab reference artifact-summary check on 2026-06-06: Playwright verifies
  `peercompute.ulg.artifact-summary.v0` exposes the same reference schema, hash,
  units, ground-state reference energy, tolerance, observed energy delta, and
  pass status without fetching the full artifact body.
- MoonLab plural reference artifact-summary check on 2026-06-06: Playwright
  verifies compact telemetry reports output reference count/ready count and a
  compact plural reference summary.
- Eshkol bundle asset check on 2026-06-05: when the ignored local `hello` bundle
  is copied under `public/service-assets/eshkol/closures/hello/`, Playwright
  verifies the Eshkol service asset probe sees artifact JSON, WASM, schema
  snapshot, and bundle manifest assets.
- Eshkol magnetar closure descriptor summary check on 2026-06-06:
  unit coverage verifies descriptor-only Eshkol artifacts expose
  `closureDescriptorReady = true`, schema
  `eshkol.ulg.magnetar-closure-descriptor.v0`, typed magnetar input/output ids,
  fixture checksum `50`, and guarded smoke `closureOutputSemanticsReady = true`
  while still
  staying service-worker-safe and dynamic-code-free.
- Eshkol magnetar closure browser handoff check on 2026-06-06:
  `npm run stage:service-assets -- --eshkol-only`,
  `npm run stage:service-assets -- --dry-run --json`,
  `npm run stage:service-assets`, `npm test`, `npm run build`, and
  `npm run test:e2e` passed after switching the ULG Eshkol service manifest to
  `magnetar-closure`. The live 5173 handoff exports
  `closureKind = "magnetar-closure-descriptor-fixture"`,
  `closureDescriptorReady = true`, `closureOutputSemanticsReady = true`,
  `scientificValidation = false`, and `wasmByteLength = 53066`.
- Eshkol magnetar interpolation-table fixture check on 2026-06-06:
  `npm run stage:service-assets -- --eshkol-only`, `npm test`,
  `npm run build`, and `npm run test:e2e` passed after the staged descriptor
  gained `eshkol.ulg.magnetar-closure-interpolation-table.v0`,
  `status = computed-fixture`, `sampleCount = 4`, content hash
  `sha256:82ca16463d7ffe1d170adb266be61c3959b22a6c352751e99f0f510738a14165`,
  and `scientificValidation = false`. A live `5173` to Multiscale `5185`
  adapter probe returned `dispatch-adapters-ready`, `acceptedDispatchCount = 2`,
  Eshkol descriptor probe `ready = true`, table status `computed-fixture`,
  no blockers, and service-summary table sample count `4`.
- Eshkol magnetar runtime-smoke check on 2026-06-06:
  `npm run stage:service-assets -- --eshkol-only`, `npm test`,
  `npm run build`, and `npm run test:e2e` passed after the default staged
  magnetar descriptor gained `eshkol.ulg.closure-output-semantics.v0` for
  `main(0, 0) -> 0`, stdout text `1048560\n10485441048528\n`, stdout hash
  `sha256:34a23605b7cacbeb83ef3391ae049c0bbcf38651b552eb9630eeca2165ca5768`,
  byte length `23`, and `scientificValidation = false`. A live ULG `5173` to
  Multiscale `5185` dispatch probe returned
  `host-runtime-output-semantics-validated`, `entryInvoked = true`,
  `mainInvoked = true`, `entryResult = 0`, no output-semantics blockers, and
  `scientificExecution = false`.
- Eshkol closure artifact handoff check on 2026-06-05: Playwright verifies the
  ready Eshkol service returns the staged `wasm-reference` closure artifact,
  preserves `hello.wasm` as the relative module URL, marks it service-worker
  safe, and exposes closure artifact-summary validation status `pass`,
  `closureReady: true`, and bundle relative-URL preservation.
- Eshkol closure execution metadata check on 2026-06-05: Playwright verifies
  the closure artifact-summary telemetry reports `entryExport = "main"`,
  signature `i32,i32 -> i32`, no start section, import count `12`,
  runtime function import count `9`, WASM function/type counts `18/104`, and
  DOM-free host import factory `createEshkolHostImportObject`.
- Live VPN Eshkol bundle check on 2026-06-05: `http://100.86.83.35:5173/`
  reported Eshkol asset status `ready`, with `application/wasm` for the module
  and `application/json` for the artifact, schema, and bundle manifest. A live
  artifact-cache probe also reported closure kind `wasm-reference`, module URL
  `hello.wasm`, validation status `pass`, and bundle manifest
  `preserveRelativeUrls: true`.
- Live VPN Eshkol closure metadata check on 2026-06-05:
  `http://100.86.83.35:5173/` reported `entry:main`, `imports:12`, and
  `host:createEshkolHostImportObject` in the artifact list after
  `window.__ulgDemo.runSmoke()`.
- ULG handoff exporter check on 2026-06-05: Playwright verifies
  `window.__ulgDemo.createPeerComputeHandoff()` returns schema
  `peercompute.ulg.demo-handoff.v0`, preserves the Eshkol closure summary entry
  `main`, marks DOM-free host imports, and transfers `33,907` WASM bytes from
  `/service-assets/eshkol/closures/hello/hello.wasm`.
- ULG MoonLab reference handoff check on 2026-06-06: Playwright verifies
  `window.__ulgDemo.createPeerComputeHandoff()` preserves the MoonLab
  `outputs.references[]` list and compact output reference counts in the
  exported packet.
- Live ULG-to-Multiscale analytic reference check on 2026-06-06:
  `http://100.86.83.35:5173/` exported MoonLab and Eshkol artifacts to
  `https://100.86.83.35:5185/?scenario=magnetar`; Multiscale reported
  `transfer-manifest-ready`, tolerance ready `2/5`, calibrated reference ready
  `1/4`, calibrated scientific ready `1/4`, the `magnetosphere-mhd` entry ready
  with no blocker, and `scenarioScientificReady: false`.
- ULG output-semantics check on 2026-06-05: Playwright verifies the staged
  Eshkol closure artifact, compact artifact-summary telemetry, and demo handoff
  packet all carry `eshkol.ulg.closure-output-semantics.v0`,
  `semanticScope = "smoke-fixture"`, `scientificScope = "none"`,
  `scientificValidation = false`, `entryExport = "main"`, `entryArgs = [0, 0]`,
  `expectedEntryResult = 0`, stdout SHA-256
  `sha256:675d2e8686b6a85ffaa5751fba535c108d23ba941f1890d0a102619ec2cdf20d`,
  and byte length `16`.
- ULG separate Eshkol smoke handoff check on 2026-06-06: Playwright verifies
  `window.__ulgDemo.createPeerComputeEshkolSmokeHandoff()` returns
  `peercompute.ulg.demo-handoff.v0` with exactly MoonLab `quantum-response` and
  Eshkol `closure` artifacts, keeps the default magnetar descriptor handoff
  unchanged, carries `hello.wasm` with module SHA-256
  `sha256:1a4699680cc14ba3cefa78634c1d52425c4d4158e590aa2e3658d3c7cae9f79c`,
  transfers `33,907` WASM bytes, merges the DOM-free host-import bundle
  manifest, and marks output semantics ready with scientific validation false.
- Live ULG-to-PeerCompute smoke execution check on 2026-06-06:
  `http://100.86.83.35:5173/` exported the new smoke handoff to
  `https://100.86.83.35:5185/?scenario=magnetar`; Multiscale returned
  `dispatch-adapters-ready`, `acceptedDispatchCount = 2`,
  `host-runtime-output-semantics-validated`, `entryInvoked = true`,
  `entryResult = 0`, stdout SHA-256
  `sha256:675d2e8686b6a85ffaa5751fba535c108d23ba941f1890d0a102619ec2cdf20d`,
  stdout byte length `16`, no output-semantics blockers, and
  `scientificExecution = false`.
- Live ULG-to-Multiscale bridge check on 2026-06-05:
  `http://100.86.83.35:5173/` exported MoonLab and Eshkol artifacts to
  `https://100.86.83.35:5185/?scenario=magnetar`; Multiscale ingested the
  MoonLab magnetar calibration, executed the Eshkol closure from transferred
  bytes with `entryResult = 0`, reported output preview `1048560\n1048544\n`,
  set `scenarioHandoffReady` and `scenarioClosureHostRuntimeExecutionReady` to
  `true`, and kept `scenarioScientificReady` false.
- Live artifact-cache check on 2026-06-05: `http://100.86.83.35:5173/`
  returned Bell parity `pass` plus magnetar calibration `pass`, ground state
  `000`, `maxEnergyDelta = 0`, and `calibrationArtifactCount = 1` from
  `window.__ulgDemo.artifactCache`.
- Verify the three.js canvas is nonblank at desktop and mobile viewport sizes.
- Save screenshots into `test-results/`.

## Manual Stack Follow-up

- PeerCompute sidecar verified syntax, unit, Multiscale unit, Multiscale build,
  backend dry-run, and VPN coturn dry-run in `/home/cos/projects/peercompute`.
- PeerCompute service orchestration checks on 2026-06-05:
  `node --check` on new modules/tests/index passed,
  `node --test peercompute/tests/unit/serviceOrchestration.test.js` passed 5/5,
  targeted ComputeManager/SolverRegistry integration gate passed 28/28,
  `npm --prefix peercompute run test:unit` passed 121/121, and
  `git diff --check` passed.
- Eshkol sidecar verified `cmake --build build --target eshkol-run -j2`,
  native hello compile/run, WASM hello emission, LLVM 21 build config, CUDA GPU
  enabled config, and RTX 3090 visibility. It also found no real WebGPU/WGSL
  implementation and one JIT derivative hang to avoid in the browser service path.
- Eshkol ULG artifact helper checks on 2026-06-05:
  `ctest --test-dir build -R 'ulg_closure_artifact_test|eshkol_run_profile_cli_test|execution_profile_test' --output-on-failure`
  passed 3/3; native hello compiled and ran; WASM hello emitted a valid
  `\0asm` module; generated `hello.ulg.json` validated against
  `ulg-gpu-abi/src/schemas/closure_artifact.schema.json`.
- MoonLab sidecar verified native unit binaries and `qsim_test`, while JS unit
  and integration tests need fixes before real MoonLab service integration.
- MoonLab core WASM readiness checks on 2026-06-05:
  `pnpm test:unit` passed 90/90, `pnpm --filter @moonlab/quantum-core build`
  passed, `pnpm test:integration` passed 41/41, `pnpm build:wasm` passed, and
  `git diff --check` passed. Full JS workspace `pnpm build` still fails outside
  core because `@moonlab/quantum-algorithms` lacks `src/index.ts`.
- MoonLab WASM allocation export checks on 2026-06-05:
  `pnpm --filter @moonlab/quantum-core build` passed, `pnpm --filter
  @moonlab/quantum-core test:unit` passed 93/93, and the rebuilt loader exposes
  `_quantum_state_create`/`_quantum_state_destroy`.
- Bring up the peercompute relay-backed local stack after the dummy ULG service
  smoke is stable.
- Reuse peercompute's existing runtime P2P smoke harness where possible.
- Add STUN/TURN/ICE/relay coverage once the service registry integration lands
  in peercompute proper.

## 2026-06-06 Tensor Runtime Contract Checks

- Eshkol:
  `python3 -m json.tool examples/magnetar_closure.ulg-metadata.json >/dev/null`
  and `python3 -m py_compile tests/toolchain/ulg_magnetar_closure_fixture_test.py`
  passed.
- Eshkol:
  `ctest --test-dir build -R '^ulg_magnetar_closure_fixture_test$' --output-on-failure`
  passed `1/1`.
- ULG:
  `node --check src/runtime/artifactSummary.js`,
  `node --check scripts/stage-service-assets.mjs`,
  `node --check tests/orchestration.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- ULG: `npm run stage:service-assets`, `npm test` (`19/19`),
  `npm run test:e2e` (`1/1`), and `npm run build` passed. Build still emits
  the existing large-chunk warning.
- PeerCompute:
  `node --check peercompute/src/peercompute/serviceOrchestration/UlgDispatchServiceAdapters.js`,
  `node --check peercompute/src/peercompute/serviceOrchestration/UlgHandoffServiceHost.js`,
  and `node --check peercompute/tests/unit/serviceOrchestration.test.js`
  passed.
- PeerCompute:
  `node --test peercompute/tests/unit/serviceOrchestration.test.js` passed
  `22/22`.
- PeerCompute: `npm --prefix demos/multiscale run build` passed with the
  existing large-chunk warning.
- Strict live browser probe from `http://127.0.0.1:5173/` to
  `https://127.0.0.1:5185/?scenario=magnetar` passed: ULG and PeerCompute both
  reported the Eshkol tensor runtime contract ready, dispatch adapters returned
  `dispatch-adapters-ready`, calibrated runtime evidence returned
  `runtime-evidence-ready`, `validatedCount = 5`, and blocker count `0`.

## 2026-06-06 Sidecar Staging Refresh Checks

- ULG: `npm run stage:service-assets` should pass after MoonLab/Eshkol local
  rebuilds and should restage MoonLab JS/WASM, the canonical normalized
  MoonLab reference suite, and the Eshkol magnetar closure descriptor bundle.
- ULG: `npm run stage:service-assets -- --dry-run --json` should show MoonLab
  reference-suite normalization with `--canonical` and the Eshkol
  `export_ulg_closure_bundle.py` command for `magnetar_closure.esk`.
- ULG staged hash gate:
  `sha256sum public/service-assets/moonlab/magnetar-reference-contracts.json public/service-assets/eshkol/closures/magnetar-closure/magnetar-closure.wasm`
  should report MoonLab suite
  `7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455` and
  Eshkol WASM
  `38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`.
- ULG staged descriptor gate: the staged Eshkol artifact should preserve source
  hash
  `sha256:73f2a89ffe3434d995ffe1174185462cf0c2edb653fbe4d1286342b788763052`,
  MoonLab suite binding
  `sha256:7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`,
  source metadata path `magnetar_closure.ulg-metadata.json`, tensor runtime
  status `declared-fixture-contract`, and false scientific/full-physics flags.
- ULG and live bridge: `npm test`, `npm run test:e2e`, and PeerCompute
  `npm --prefix demos/multiscale run test:ulg-handoff` should pass against the
  live `5173`/`5185` servers with `handoff-ready`, blocker count `0`, and the
  visible magnetar proxy on the solar layer.

## 2026-06-06 MoonLab WebGPU Parity-Scope Staging Checks

- ULG syntax:
  `node --check scripts/stage-service-assets.mjs`,
  `node --check src/runtime/ServiceAssetProbe.js`,
  `node --check ulg-gpu-abi/src/serviceContract.js`, and
  `node --check tests/service-assets.test.mjs` passed.
- ULG staging:
  `npm run stage:service-assets` passed and generated optional
  `public/service-assets/moonlab/webgpu-complex64-parity-scope.json`.
- ULG dry-run staging:
  `npm run stage:service-assets -- --dry-run --json` passed and listed the
  MoonLab WebGPU complex64 parity-scope generation command.
- ULG staged parity-scope gate:
  `public/service-assets/moonlab/webgpu-complex64-parity-scope.json` reports
  schema `moonlab.webgpu.complex64-parity-scope.v0`, status
  `scope-ready-backend-unavailable`, `contractReady = true`,
  `contractValidation.valid = true`, `reducedFixtureOnly = true`,
  `backendAvailable = false`, `webgpuParity.executed = false`,
  `webgpuParity.passed = false`, `complex64Preflight.passed = true`, and the
  blocker `browser-webgpu-kernel-parity-not-executed`.
- ULG staged hashes:
  parity scope
  `8c10f99aaa0dc0f13c6bb3242befbe65bf8ff2d5acad610829017fb548dc83bc`,
  MoonLab suite
  `7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`,
  and Eshkol WASM
  `38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`.
- ULG regression:
  `npm test` passed `20/20`, `npm run build` passed with the existing
  large-chunk warning, and `npm run test:e2e` passed `1/1`.
- Live bridge:
  PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` passed
  against live ULG `5173` and Multiscale `5185` with `handoff-ready`, blocker
  count `0`, `simulationStatus = scientific-ready`, bridge ack
  `handoff-ready`, visible magnetar proxy, and expected canonical/source/WASM
  hashes.

## 2026-06-06 MoonLab WebGPU Parity-Scope Runtime Handoff Checks

- ULG syntax:
  `node --check public/workers/moonlab-core-probe.worker.js`,
  `node --check src/services/dummyService.worker.js`,
  `node --check src/runtime/artifactSummary.js`,
  `node --check src/main.js`, `node --check tests/orchestration.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- ULG regression:
  `npm test` passed `20/20`, `npm run build` passed with the existing
  large-chunk warning, and `npm run test:e2e` passed `1/1`.
- Live ULG runtime:
  Playwright against `http://100.86.83.35:5173/` reported MoonLab parity-scope
  schema `moonlab.webgpu.complex64-parity-scope.v0`, status
  `scope-ready-backend-unavailable`, `backendAvailable = false`,
  `webgpuParity.executed = false`, `webgpuParity.passed = false`,
  `complex64Preflight.passed = true`, false full-fidelity/full-physics flags,
  and blocker `browser-webgpu-kernel-parity-not-executed` in both telemetry and
  handoff artifact.
- Live ULG UI:
  the MoonLab artifact list line includes `webgpu:no-backend` beside
  `validation:pass`, `parity:pass`, `magnetar:000`, and `refs:5/5`.
- Live bridge:
  PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` passed
  against live ULG `5173` and Multiscale `5185` with `handoff-ready`, blocker
  count `0`, `simulationStatus = scientific-ready`, bridge ack
  `handoff-ready`, and visible magnetar proxy.

## 2026-06-06 PeerCompute Parity-Scope Consumer Checks

- PeerCompute service orchestration:
  `node --test peercompute/tests/unit/serviceOrchestration.test.js` passed
  `24/24`.
- PeerCompute Multiscale:
  `npm --prefix demos/multiscale test` passed `196/196`.
- PeerCompute Multiscale build:
  `npm --prefix demos/multiscale run build` passed with the existing
  large-chunk warning.
- Live bridge:
  `npm --prefix demos/multiscale run test:ulg-handoff` passed with
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  bridge ack `handoff-ready`, and visible magnetar proxy.
- Listener check:
  Vite servers remained bound on `0.0.0.0:5173` and `0.0.0.0:5185`.

## 2026-06-06 PeerCompute Relay Smoke Checks

- VPN coturn dry-run:
  `bash scripts/dev-vpn-coturn.sh --dry-run` selected VPN host
  `100.86.83.35`, `RELAY_LISTEN_HOST=0.0.0.0`, dynamic relay port, and TURN
  host `100.86.83.35:3478`.
- Backend dry-run:
  `npm run backend:dry-run` reported relay plus coturn launch commands without
  starting services.
- Focused runtime P2P smoke:
  PeerCompute
  `RUNTIME_P2P_DEMOS=hyperborea DEMO_PORT=4191 RELAY_CONFIG_TIMEOUT_MS=15000 DEMO_TIMEOUT_MS=45000 node demos/tests/runtime-p2p.mjs`
  started the Go relay on a dynamic localhost port, wrote Hyperborea relay
  config, connected headless browser peers, disconnected cleanly, and printed
  `Runtime P2P tests passed`.

## 2026-06-06 Eshkol Handler Boundary and MoonLab Probe Checks

- ULG syntax:
  `node --check scripts/stage-service-assets.mjs`,
  `node --check src/runtime/artifactSummary.js`, `node --check src/main.js`,
  `node --check tests/orchestration.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- MoonLab WASM rebuild:
  `pnpm build:wasm` in
  `/home/cos/projects/moonlab/bindings/javascript/packages/core` recreated
  `dist/moonlab.js` and `dist/moonlab.wasm` after MoonLab's TypeScript build
  cleaned the browser loader.
- ULG staging:
  `npm run stage:service-assets` passed after stricter validation for Eshkol
  `eshkol.ulg.production-handler-boundary.v0` metadata and MoonLab
  `moonlab.webgpu.complex64-probability-kernel-probe.v0` metadata.
- Staged artifact hashes:
  MoonLab parity scope
  `27b87fcdbd13574df63d83d4fe6aac5a31a740a0f77879c3e70a1a097c27c0bb`,
  MoonLab reference suite
  `7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`,
  Eshkol WASM
  `38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`,
  and Eshkol artifact JSON
  `9532159bae058a193fc982113cca781e82182740e82e3f0b5ddbafe8b346b4c1`.
- ULG regression:
  `npm test` passed `20/20`, `npm run build` passed with the existing
  large-chunk warning, and `npm run test:e2e` passed `1/1`.
- Live listener check:
  `ss -ltnp 'sport = :5173'` and `ss -ltnp 'sport = :5185'` showed the ULG and
  PeerCompute Multiscale Vite servers bound to `0.0.0.0`.
- Live ULG runtime:
  Playwright against `http://100.86.83.35:5173/` reported two handoff
  artifacts, Eshkol `closureProductionHandlerBoundaryDeclared = true` with
  `handlerReady = false` and `runtimeExecution = false`, and MoonLab
  `moonlabWebGpuProbabilityKernelProbeDeclared = true` for
  `compute_probabilities` with `executed = false`, `passed = false`, and the
  native-operation-coverage blocker preserved.

## 2026-06-06 PeerCompute Production Handler Boundary Consumer Checks

- PeerCompute focused service orchestration:
  sidecar verification reported
  `node --test peercompute/tests/unit/serviceOrchestration.test.js --test-name-pattern 'production handler boundary|descriptor-only Eshkol closures without WASM bytes'`
  passed `26/26`.
- PeerCompute focused Multiscale model:
  sidecar verification reported
  `node --test demos/multiscale/tests/multiscaleModel.test.mjs --test-name-pattern 'production handler boundary|descriptor-only Eshkol closure'`
  passed `197/197`.
- PeerCompute Multiscale build:
  sidecar verification reported `npm --prefix demos/multiscale run build`
  passed with the existing large-chunk warning.
- PeerCompute diff/worktree:
  sidecar verification reported `git diff --check` passed and the post-commit
  PeerCompute worktree was clean at local commit `cd85fd9e`.
- Coordinator live bridge:
  `npm --prefix demos/multiscale run test:ulg-handoff` passed after
  `cd85fd9e`, reporting ULG `handoff ready / blockers 0`, Multiscale
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  bridge ack `handoff-ready`, and `magnetarVisible = true`.

## 2026-06-06 ULG Launch Status Checks

- ULG syntax:
  `node --check src/runtime/handoffStatus.js`, `node --check src/main.js`, and
  `node --check tests/handoffStatus.test.mjs` passed.
- ULG unit tests:
  `npm test` passed `22/22`, including the handoff-status formatter preserving
  the `handoff ready / blockers 0` compatibility prefix while surfacing scenario
  and simulation readiness fields.
- ULG browser smoke:
  `npm run test:e2e` passed `1/1`.
- ULG production build:
  `npm run build` passed with the existing large-chunk warning.
- Live bridge:
  PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` passed and
  reported ULG status
  `handoff ready / blockers 0 / scenario magnetar / scientific ready / 2 artifacts`,
  Multiscale `handoff-ready`, blocker count `0`,
  `simulationStatus = scientific-ready`, bridge ack `handoff-ready`, and
  `magnetarVisible = true`.

## 2026-06-06 ULG Live Status Script Checks

- Script syntax:
  `node --check scripts/live-status.mjs` passed.
- Default live status:
  `npm run status:live` passed against `http://100.86.83.35:5173/`, reporting
  two ready services, two handoff artifacts, MoonLab WebGPU parity scope ready,
  `compute_probabilities` probe declared but unexecuted, MoonLab calibrated
  reference ready count `4`, Eshkol descriptor/tensor runtime ready, and Eshkol
  production-handler boundary declared with handler/runtime execution false.
- Bridge live status:
  `npm run status:live -- --bridge` passed and reported Multiscale ack
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  and artifact count `2`.

## 2026-06-06 MoonLab Hadamard Probe and Eshkol Tensor Layout Checks

- MoonLab browser assets:
  `pnpm build:wasm` in
  `/home/cos/projects/moonlab/bindings/javascript/packages/core` rebuilt
  `dist/moonlab.js` and `dist/moonlab.wasm`.
- ULG syntax:
  `node --check scripts/stage-service-assets.mjs`,
  `node --check src/runtime/artifactSummary.js`, `node --check src/main.js`,
  `node --check scripts/live-status.mjs`,
  `node --check tests/orchestration.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- ULG staging:
  `npm run stage:service-assets` passed with guards for MoonLab
  `moonlab.webgpu.complex64-native-operation-probe.v0` and Eshkol
  `eshkol.ulg.tensor-linear-memory-binding.v0`.
- Staged hashes:
  MoonLab WebGPU parity-scope JSON
  `7a4430a3ffa1a0a21807d36fefd1e465ecbad24ad7bfa725d7be4768fecd9f6b`,
  Eshkol magnetar closure artifact JSON
  `a7d77d237dcb9130030f1ea1a3357c0c30cf49932e5e6df978492e928d252841`,
  and Eshkol WASM
  `38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`.
- ULG unit tests:
  `npm test` passed `22/22`.
- ULG production build:
  `npm run build` passed with the existing large-chunk warning.
- ULG browser smoke:
  `npm run test:e2e` passed `1/1`.
- Live status:
  `npm run status:live` reported MoonLab native-operation probe declared,
  hadamard declared with `executed = false`, `covered = false`, blocker
  `native-operation-probe-not-executed`, Eshkol tensor linear-memory binding
  ready, base offset `131072`, total byte length `168`, and handler/runtime
  execution false.
- Live bridge:
  `npm run status:live -- --bridge` passed and reported Multiscale ack
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  and artifact count `2`.

## 2026-06-06 PeerCompute Relay-Backed ULG Handoff Checks

- PeerCompute relay smoke syntax:
  sidecar verification reported
  `node --check demos/multiscale/tests/ulgRelayHandoffSmoke.mjs` passed.
- PeerCompute relay smoke:
  sidecar verification reported
  `npm --prefix demos/multiscale run test:ulg-relay-handoff` passed. The smoke
  started a dynamic Go relay, generated STUN/TURN ICE config with
  `iceServerCount = 2`, `hasStun = true`, and `hasTurn = true`, connected two
  Multiscale browser peers in one relay room, imported the live ULG handoff via
  `ulg-post-message`, and verified `handoff-ready`,
  `service-envelope-ready`, `relaySafeArtifactCount = 2`, and `dispatch-ready`.
- PeerCompute live handoff regression:
  sidecar verification reported
  `npm --prefix demos/multiscale run test:ulg-handoff` still passed against live
  ULG `5173` and Multiscale `5185`.
- PeerCompute cleanup:
  sidecar verification reported `git diff --check` passed, relay configs were
  preserved with no diff in `docs/multiscale/relay-config*.json`, and no
  test-owned `4196` server or relay process remained.

## 2026-06-06 MoonLab pauli_x Native Probe Handoff Checks

- MoonLab sidecar validation:
  sidecar verification reported focused WebGPU parity tests passed `12/12`,
  MoonLab unit tests passed `116/116`, `pnpm build:ts` passed with the existing
  package export-order warning, CLI parity artifact generation passed, and
  `git diff --check` passed.
- MoonLab browser assets:
  `pnpm build:wasm` in
  `/home/cos/projects/moonlab/bindings/javascript/packages/core` rebuilt
  `dist/moonlab.js` and `dist/moonlab.wasm`.
- ULG staging:
  `npm run stage:service-assets` passed with `hadamard` and `pauli_x` native
  operation probes both declared but unexecuted/uncovered.
- Staged MoonLab parity-scope hash:
  `61d04ad9eb66aa7804b64e063e7653acb76f4b0683a5035136ecff1e9d0d2bb2`.

## 2026-06-06 Eshkol Tensor Offset ABI Blocker Checks

- Eshkol sidecar validation:
  sidecar verification reported `ulg_magnetar_closure_fixture_test.py`,
  `eshkol_host_imports_smoke_test.js`, `ulg_closure_artifact_test.py`, focused
  `ctest`, and `git diff --check` all passed.
- ULG staging:
  `npm run stage:service-assets` regenerated the Eshkol magnetar artifact with
  `eshkol.ulg.tensor-entry-export-offset-probe.v0` and tensor runtime contract
  hash `sha256:4d16bf10f236832da92974cd341bb40a533cb2fe7c7ceab67ff8f6758645c95f`.
- Offset ABI blocker:
  staged ULG artifact reports `entryExportConsumesOffsets = false`,
  `outputTensorsProducedByEntryExport = false`,
  `changedBytesInDeclaredTensorRange = 0`, and blocker
  `main-export-accepts-two-i32-runtime-args-but-does-not-read-or-write-host-managed-tensor-offsets`.

## 2026-06-06 PeerCompute Relay Dispatch Adapter Diagnostic Checks

- PeerCompute syntax/build:
  sidecar verification reported `node --check demos/multiscale/src/main.js`,
  `node --check demos/multiscale/tests/ulgRelayHandoffSmoke.mjs`, and
  `npm --prefix demos/multiscale run build` passed with the existing large-chunk
  warning.
- Default relay smoke:
  sidecar verification reported
  `npm --prefix demos/multiscale run test:ulg-relay-handoff` passed.
- Adapter-enabled relay diagnostic:
  sidecar verification reported
  `ULG_RELAY_HANDOFF_RUN_DISPATCH=1 npm --prefix demos/multiscale run
  test:ulg-relay-handoff` now exits cleanly with structured diagnostic status
  `dispatchAdapterStatus = dispatch-adapter-popup-context-reset`, reaches
  `start`, `dispatch-plan-created`, and MoonLab `dispatch-start`, and records
  `runtimeGateRelaxed = false` plus `scientificGateRelaxed = false`.
- Strict failure mode:
  sidecar verification reported `ULG_RELAY_HANDOFF_REQUIRE_DISPATCH=1` is
  available to force this diagnostic blocker to fail while debugging adapter
  execution itself.
- Cleanup:
  sidecar verification reported relay config restore diff was empty for
  `docs/multiscale/relay-config*.json`, no test-owned `4196` listener or relay
  process remained, and `git diff --check` passed.
- Coordinator live status:
  `npm run status:live -- --bridge` on 2026-06-06 14:58:03 AKDT reported live
  ULG `5173` and Multiscale `5185` ready, with Multiscale ack
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  and artifact count `2`.

## 2026-06-06 ULG Generic Native Operation Summary Checks

- Syntax:
  `node --check src/runtime/artifactSummary.js`, `node --check src/main.js`,
  `node --check scripts/live-status.mjs`,
  `node --check tests/orchestration.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- Unit tests:
  `npm test` passed `22/22`.
- Build and browser smoke:
  `npm run build` passed with the existing large-chunk warning, and
  `npm run test:e2e` passed `1/1`.
- Live status:
  `npm run status:live -- --bridge` reported
  `nativeOperationDeclaredOperations = ["hadamard", "pauli_x"]`,
  `nativeOperationBlockedOperations = ["hadamard", "pauli_x"]`, Multiscale ack
  `handoff-ready`, blocker count `0`, and
  `simulationStatus = scientific-ready`.
- Summary guard:
  `tests/orchestration.test.mjs` now includes a blocked `pauli_z` fixture entry
  in `browserNativeOperationProbe.operationResults[]`, proving ULG preserves
  future declared native operations through generic declared/blocked operation
  lists while still requiring `hadamard` and `pauli_x` compatibility blockers.
- Current live artifact path:
  `tests/demo.e2e.mjs` still expects the staged live MoonLab artifact to report
  the current two declared blocked native operations: `hadamard` and `pauli_x`.

## 2026-06-06 MoonLab pauli_z Native Probe Handoff Checks

- MoonLab sidecar validation:
  sidecar verification reported MoonLab local commit `e9bc324` passed
  `pnpm --dir bindings/javascript/packages/core build:ts`, focused
  `webgpu-complex64-parity.test.ts` with `13/13`, CLI parity artifact
  generation, `ulg-quantum-response-artifact.test.ts` with `14/14`,
  `pnpm --dir bindings/javascript/packages/core build:wasm`, and
  `git diff --check HEAD~1..HEAD`.
- ULG staging:
  `npm run stage:service-assets` passed after requiring `hadamard`, `pauli_x`,
  and `pauli_z` in the MoonLab native-operation probe.
- Staged MoonLab hashes:
  parity-scope JSON
  `5542be2ba09be9541666472a993c4c06e80ecb790cb57ec9cea3191aa3d02f27`,
  browser loader
  `4272298c649ad4141057cb7dc4ccc27dec5a8a79036ddf2a70a6dd76e84a7cfe`, and
  WASM
  `df924d4c907ace13caf58c6c15ba49bd97aadd351fce768bb936875d14475d78`.
- ULG validations:
  `node --check scripts/stage-service-assets.mjs`,
  `node --check src/runtime/artifactSummary.js`,
  `node --check tests/demo.e2e.mjs`, `npm test`, `npm run build`, and
  `npm run test:e2e` passed.
- Live status:
  `npm run status:live -- --bridge` reported
  `nativeOperationDeclaredOperations = ["hadamard", "pauli_x", "pauli_z"]`,
  `nativeOperationBlockedOperations = ["hadamard", "pauli_x", "pauli_z"]`,
  Multiscale ack `handoff-ready`, blocker count `0`, and
  `simulationStatus = scientific-ready`.
- Multiscale handoff:
  PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` passed with
  `magnetarVisible = true`, `magnetarLayer = solar`, and bridge ack
  `handoff-ready`.

## 2026-06-06 ICC Eshkol Registration Checks

- Parser dependency handling:
  `make install-parsers` in `/home/cos/projects/infinite_context_coder` hit the
  Ubuntu PEP 668 externally-managed system-pip guard, so the same parser package
  check/install was run through ICC's existing `.venv`. The packages were
  already present: `tree-sitter`, `tree-sitter-cpp`, and `tree-sitter-c`.
- Registry:
  `.venv/bin/python scripts/codebase_tool.py register --name eshkol --path
  /home/cos/projects/eshkol ...` succeeded with skips for `.git`, `build`,
  `node_modules`, `dist`, `.venv`, `__pycache__`, `.pytest_cache`, and `site`.
- Index:
  `.venv/bin/python scripts/codebase_tool.py index --repo eshkol` indexed
  `1578` files, `451140` lines, and `14294` symbol records with
  `tree_sitter_available = true`.
- Memory:
  `.venv/bin/python scripts/codebase_tool.py build-memory --repo eshkol` wrote
  `/home/cos/projects/infinite_context_coder/artifacts/repos/eshkol/codebase_memory`
  with `21334` chunks and Eshkol git head
  `ad878d0ab182b238b85e2acb89b329b52566464a`.
- Architecture summary:
  `.venv/bin/python scripts/codebase_tool.py architecture-summary --repo eshkol
  --bundle --include-cheatsheet` succeeded and identified Eshkol integration
  surfaces including `exe/eshkol-server.cpp`,
  `inc/eshkol/bridge/qllm_bridge.h`, `inc/eshkol/core/eval_bridge.h`, and
  tensor/backend paths.

## 2026-06-06 ULG Native Operation Staging Overclaim Guard Checks

- Syntax:
  `node --check scripts/stage-service-assets.mjs` passed.
- MoonLab-only staging:
  `npm run stage:service-assets -- --moonlab-only` passed and regenerated the
  MoonLab loader, WASM, normalized reference suite, and WebGPU complex64 parity
  scope with `hadamard`, `pauli_x`, and `pauli_z` blocked/unexecuted/uncovered.
- Unit tests:
  `npm test` passed `22/22`.
- Diff check:
  `git diff --check` passed.
- Full staging note:
  full `npm run stage:service-assets` was not used for this guard checkpoint
  because the active Eshkol sidecar has uncommitted Eshkol edits that currently
  make the Eshkol bundle export report `@define-ulg-closure ... entryExport='main'`
  while generated artifact execution uses `scheme_main`.

## 2026-06-06 ICC ULG Refresh Checks

- ULG index:
  `.venv/bin/python scripts/codebase_tool.py index --repo ulg` in
  `/home/cos/projects/infinite_context_coder` indexed `63` files, `25557` lines,
  and reported `tree_sitter_available = true` at ULG git head
  `f620e85459f389afd16e9a72134049a8730417cd`.
- ULG memory:
  `.venv/bin/python scripts/codebase_tool.py build-memory --repo ulg` wrote
  `/home/cos/projects/infinite_context_coder/artifacts/repos/ulg/codebase_memory`
  with `224` chunks.
- ULG architecture summary:
  `.venv/bin/python scripts/codebase_tool.py architecture-summary --repo ulg
  --bundle --include-cheatsheet` succeeded and identified `src/runtime`,
  `src/services`, `src`, and `src/visualization` as public module roots.

## 2026-06-06 MoonLab Native Operation Target Visibility Checks

- Syntax:
  `node --check src/runtime/artifactSummary.js`,
  `node --check scripts/live-status.mjs`,
  `node --check tests/orchestration.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- Unit tests:
  `npm test` passed `22/22`.
- Live status:
  `npm run status:live -- --bridge` reported
  `nativeOperationTargetOperations = ["hadamard", "pauli_x", "pauli_z", "cnot"]`
  and `nativeOperationMissingTargetOperations = ["cnot"]`, while Multiscale
  ack stayed `handoff-ready` with blocker count `0` and
  `simulationStatus = scientific-ready`.

## 2026-06-06 PeerCompute Relay Dispatch Fix Checks

- PeerCompute sidecar validation:
  sidecar verification reported local PeerCompute commit `631b202` passed
  syntax checks for `demos/multiscale/src/main.js` and
  `demos/multiscale/tests/ulgRelayHandoffSmoke.mjs`, built
  `demos/multiscale` with the existing large-chunk warning, and passed both
  default and adapter-enabled relay handoff smokes.
- Adapter-enabled relay smoke:
  sidecar verification reported
  `ULG_RELAY_HANDOFF_RUN_DISPATCH=1 npm --prefix demos/multiscale run
  test:ulg-relay-handoff` now passes with `dispatch-adapters-ready`,
  `acceptedDispatchCount = 2`, and scientific scope flags all `false`.
- Coordinator handoff regression:
  `npm --prefix demos/multiscale run test:ulg-handoff` passed after
  PeerCompute `631b202`, reporting `handoff-ready`, blocker count `0`,
  `simulationStatus = scientific-ready`, and `magnetarVisible = true`.

## 2026-06-06 MoonLab cnot Native Probe Handoff Checks

- MoonLab sidecar validation:
  sidecar verification reported local MoonLab commit `fbc2ddf` passed
  `pnpm --dir bindings/javascript/packages/core build:ts` with the existing
  export-order warning, focused `webgpu-complex64-parity.test.ts` with `14/14`,
  CLI parity artifact generation/inspection for blocked `cnot`,
  `ulg-quantum-response-artifact.test.ts` with `14/14`, `build:wasm`, and
  `git diff --check`.
- ULG MoonLab-only staging:
  `npm run stage:service-assets -- --moonlab-only` passed after requiring
  `hadamard`, `pauli_x`, `pauli_z`, and `cnot` native-operation declarations.
- Staged MoonLab hashes:
  parity-scope JSON
  `dc391fa82a5e384c2b419e78c4066a88d6fbb76255867fbebd5d3b6a6a4a42d0`,
  browser loader
  `4272298c649ad4141057cb7dc4ccc27dec5a8a79036ddf2a70a6dd76e84a7cfe`, and
  WASM
  `df924d4c907ace13caf58c6c15ba49bd97aadd351fce768bb936875d14475d78`.
- Eshkol asset consistency:
  after the failed full staging attempt from active Eshkol sidecar edits, the
  ignored ULG `magnetar-closure.wasm` was restored from committed Eshkol source
  bytes to `53066` bytes with hash
  `38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`.
- ULG validations:
  `node --check scripts/stage-service-assets.mjs`,
  `node --check src/runtime/artifactSummary.js`,
  `node --check scripts/live-status.mjs`,
  `node --check tests/orchestration.test.mjs`,
  `node --check tests/demo.e2e.mjs`, `npm test`, `npm run build`, and
  `npm run test:e2e` passed.
- Live status:
  `npm run status:live -- --bridge` reported
  `nativeOperationDeclaredOperations = ["hadamard", "pauli_x", "pauli_z", "cnot"]`,
  `nativeOperationBlockedOperations = ["hadamard", "pauli_x", "pauli_z", "cnot"]`,
  `nativeOperationMissingTargetOperations = []`, Multiscale ack
  `handoff-ready`, blocker count `0`, and
  `simulationStatus = scientific-ready`.
- Multiscale handoff:
  PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` passed with
  `magnetarVisible = true`, `magnetarLayer = solar`, and bridge ack
  `handoff-ready`.

## 2026-06-06 Eshkol Tensor Offset Runtime Smoke Handoff Checks

- Eshkol sidecar integration:
  local Eshkol commit `a13745e` exports a magnetar closure artifact whose
  top-level validation is `runtime-smoke` with validation mode
  `eshkol-deterministic-magnetar-tensor-abi-smoke`.
- Staged Eshkol artifact:
  source hash
  `sha256:630b20dd243be58f8e53631e934d09298696fe7e7ea84b15e7d7b89d18809b69`,
  WASM hash
  `sha256:e0a3c7d280678a8c1e40865daeab6601dc8a6a64cfa5b29b7b6bfcaddc86c5aa`,
  WASM byte length `169528`, and tensor contract hash
  `sha256:2289b8c8068f1a033cda20f09f30a33f2e41588b8ee2ccd1143100f2fe87dd64`.
- Tensor runtime evidence:
  ULG staging and summaries now require
  `runtimeStatus = deterministic-runtime-smoke-executed`,
  `executionClaim = deterministic-tensor-runtime-smoke-only`,
  `linearMemoryBinding.status = entry-export-runtime-smoke-passed`,
  `entryExportConsumesOffsets = true`, all declared tensors consumed by the
  entry export, offset probe `runtime-smoke-passed`, output tensors produced,
  `changedBytesInDeclaredTensorRange = 64`, and stdout invariant false.
- Production boundary:
  ULG requires the exact remaining blocker
  `full-physics-validation-not-run`; `handlerReady` and `runtimeExecution`
  are true for production-candidate runtime-smoke evidence, while
  `scientificValidation` and `fullPhysicsValidation` remain false.
- ULG validations:
  `node --check scripts/stage-service-assets.mjs`,
  `node --check src/runtime/artifactSummary.js`,
  `node --check scripts/live-status.mjs`,
  `node --check tests/orchestration.test.mjs`,
  `node --check tests/demo.e2e.mjs`, `npm run stage:service-assets`,
  `npm test`, `npm run build`, and `npm run test:e2e` passed.
- Live status:
  `npm run status:live -- --bridge` reported Eshkol
  `tensorLinearMemoryEntryExportConsumesOffsets = true`,
  `tensorEntryExportOffsetProbeStatus = runtime-smoke-passed`,
  `tensorEntryExportChangedBytesInDeclaredTensorRange = 64`,
  `productionHandlerReady = true`, Multiscale ack `handoff-ready`, blocker
  count `0`, and `simulationStatus = scientific-ready`.
- Multiscale handoff:
  PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` passed with
  the new Eshkol source/WASM hashes, `wasmByteLength = 169528`,
  `magnetarVisible = true`, `magnetarLayer = solar`, and bridge ack
  `handoff-ready`.
- PeerCompute sidecar validation:
  local PeerCompute commit `dc497229` updated browser and relay handoff smoke
  expectations for the new Eshkol artifact and passed syntax checks,
  `npm --prefix demos/multiscale run test:ulg-handoff`,
  `npm --prefix demos/multiscale run test:ulg-relay-handoff`, relay config
  cleanup checks, and `git diff --check`.

## 2026-06-06 Eshkol Runtime Smoke Visibility Checks

- UI visibility:
  Playwright now asserts the visible artifact row includes
  `tensor-probe:runtime-smoke-passed:offsets-consumed:64b` and
  `handler:production-handler-runtime-smoke-executed:1-blockers`.
- Live status:
  `npm run status:live -- --bridge` now reports Eshkol
  `validationStatus = runtime-smoke`,
  `tensorRuntimeStatus = deterministic-runtime-smoke-executed`,
  `tensorEntryExportOutputTensorsProduced = true`, expected entry args
  `[131072, 131136]`, stdout hash
  `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
  `productionHandlerScientificValidation = false`,
  `productionHandlerFullPhysicsValidation = false`, and the exact three
  production blockers.
- Validation:
  `node --check scripts/live-status.mjs`, `node --check src/main.js`,
  `node --check tests/demo.e2e.mjs`, `npm test`, `npm run build`,
  `npm run test:e2e`, and `npm run status:live -- --bridge` passed.

## 2026-06-06 Eshkol Production Host Import Candidate Checks

- Eshkol sidecar validation:
  local Eshkol commit `b025f5d` added a
  `eshkol.ulg.production-host-import-candidate.v0` requirements block and
  passed focused host-import/fixture tests plus `eshkol-run` rebuild.
- ULG staging:
  `npm run stage:service-assets -- --eshkol-only` passed and regenerated the
  Eshkol magnetar closure bundle with `runtimeScope =
  production-candidate-host-imports`, `implementationStatus =
  production-candidate-runtime-imports-present`, production candidate status
  `production-candidate-runtime-imports-implemented`,
  `runtimeSmokeStubsAllowed = false`, f64 tensor-memory imports
  `ulg_read_f64`/`ulg_write_f64`, `23` required non-stub imports, and the
  remaining two production boundary blockers.
- ULG validations:
  `node --check src/runtime/artifactSummary.js`,
  `node --check scripts/stage-service-assets.mjs`,
  `node --check scripts/live-status.mjs`,
  `node --check tests/orchestration.test.mjs`,
  `node --check tests/demo.e2e.mjs`, `npm test`, `npm run build`,
  `npm run test:e2e`, and `npm run status:live -- --bridge` passed.
- Live status:
  `npm run status:live -- --bridge` reported production candidate status
  `production-candidate-runtime-imports-implemented`,
  `runtimeSmokeStubsAllowed = false`, required non-stub import count `23`,
  readiness requirements
  `production-magnetar-handler-implementation`, `non-stub-host-runtime-imports`,
  `validated-f64-tensor-memory-imports`, `full-physics-validation-pass`,
  preflight evidence counts `8/5/3`, Multiscale ack `handoff-ready`, and
  `simulationStatus = scientific-ready`.
- Full staging caveat:
  full `npm run stage:service-assets` was not used for this checkpoint because
  the active MoonLab sidecar temporarily removed or had not rebuilt
  `bindings/javascript/packages/core/dist/moonlab.js`; Eshkol-only staging was
  the relevant gate for this integration slice.

## 2026-06-06 MoonLab Browser Backend Preflight Checks

- MoonLab sidecar validation:
  local MoonLab commit `4e91165` added
  `moonlab.webgpu.complex64-browser-backend-preflight.v0` and passed TypeScript
  build, focused parity tests, CLI parity generation, required-backend failure
  behavior in the no-adapter runtime, quantum-response artifact tests, full core
  tests, WASM build, and `git diff --check`.
- ULG staging:
  `npm run stage:service-assets` passed and regenerated
  `webgpu-complex64-parity-scope.json` with
  `browserBackendPreflight.stage = navigator-gpu-unavailable`,
  `navigatorGpuAvailable = false`, `adapterAvailable = false`, and
  `deviceAcquired = false`.
- ULG validations:
  `node --check src/runtime/artifactSummary.js`,
  `node --check scripts/stage-service-assets.mjs`,
  `node --check scripts/live-status.mjs`, `node --check src/main.js`,
  `node --check tests/orchestration.test.mjs`,
  `node --check tests/demo.e2e.mjs`, `npm test`, `npm run build`,
  `npm run test:e2e`, and `npm run status:live -- --bridge` passed.
- Live status:
  `npm run status:live -- --bridge` reported MoonLab
  `browserBackendPreflightDeclared = true`,
  `browserBackendPreflightStage = navigator-gpu-unavailable`,
  `browserBackendPreflightNavigatorGpuAvailable = false`,
  `browserBackendPreflightAdapterAvailable = false`,
  `browserBackendPreflightDeviceAcquired = false`, Multiscale ack
  `handoff-ready`, and `simulationStatus = scientific-ready`.
- PeerCompute handoff:
  `npm --prefix /home/cos/projects/peercompute/demos/multiscale run test:ulg-handoff`
  passed with `magnetarVisible = true`, `magnetarLayer = solar`, bridge ack
  `handoff-ready`, and `simulationStatus = scientific-ready`.

## 2026-06-06 MoonLab Browser WebGPU Evidence ULG Checks

- ULG staging:
  `npm run stage:service-assets -- --moonlab-only` passed and regenerated
  `public/service-assets/moonlab/webgpu-complex64-parity-scope.json` through
  MoonLab's browser smoke harness with `--require-backend`.
- Staged parity-scope gate:
  the staged artifact reports schema
  `moonlab.webgpu.complex64-parity-scope.v0`, status
  `scope-ready-backend-detected`, `backendAvailable = true`,
  `requireBackend = true`, `browserBackendPreflight.stage = device-acquired`,
  `webgpuParity.executed = true`, `webgpuParity.passed = true`, zero blockers,
  `compute_probabilities` browser-kernel coverage, and native operation
  coverage for `hadamard`, `pauli_x`, `pauli_z`, and `cnot`.
- ULG syntax/regression:
  `node --check public/workers/moonlab-core-probe.worker.js`,
  `node --check src/runtime/artifactSummary.js`, `npm test`, and
  `npm run build` passed. Build retained the existing large-chunk warning.
- ULG browser e2e:
  first `npm run test:e2e` failed because the core-probe worker still rejected
  `backendAvailable = true` / executed browser parity as an overclaim. After
  updating that validator to require the successful reduced browser evidence
  and explicit no-full-physics flags, `npm run test:e2e` passed `1/1`.
- Live ULG runtime:
  Playwright against `http://127.0.0.1:5173/` showed the MoonLab artifact row
  containing `webgpu:backend`, `webgpu-preflight:device-acquired`,
  `wgsl:compute_probabilities-declared`, and covered native operations for
  `hadamard`, `pauli_x`, `pauli_z`, and `cnot`.
- PeerCompute relay-dispatch handoff:
  `ULG_RELAY_HANDOFF_RUN_DISPATCH=1 ULG_RELAY_HANDOFF_REQUIRE_DISPATCH=1 npm --prefix /home/cos/projects/peercompute/demos/multiscale run test:ulg-relay-handoff`
  passed with relay peers connected, `dispatchAdapterStatus =
  dispatch-adapters-ready`, `acceptedDispatchCount = 2`, ack `handoff-ready`,
  and `simulationStatus = scientific-ready`.

## 2026-06-11 H2O Transmissive Surface Visibility Regression

- Added `tests/sphPhaseRenderer.test.mjs` coverage that condensed transmissive
  H2O keeps mesh alpha coverage at `1` and disables depth write while vapor
  continues to use closure opacity.
- Extended `tests/demo.e2e.mjs` so the default SPH phase demo must expose a
  visible H2O surface with `renderAlpha = 1`, `material.opacity = 1`, and
  `material.transmission > 0.9` after the optical GPU lookup is applied.
- Manual Playwright probes against `https://127.0.0.1:5173/` verified default
  Fe/H2O and Na/H2O scenarios render continuous H2O volumes. Screenshots were
  saved to `/tmp/ulg-default-sph-h2o-alpha-fixed.png` and
  `/tmp/ulg-na-h2o-alpha-fixed.png`.
- Validation passed: syntax checks for touched files, `node --test
  tests/sphPhaseRenderer.test.mjs` (`6/6`), focused HTTPS Chromium e2e (`1/1`),
  `git diff --check`, `npm run build`, and full `npm test` (`309/309`).

## 2026-06-11 Generic Resident Render-Field Bridge

- Added ABI coverage for `peercompute.ulg.sph-gpu-render-field.v0` and
  `peercompute.ulg.sph-gpu-render-field-execution.v0`, including generic
  material/phase surface rows, field-cell rows, and WGSL binding checks.
- Added `tests/sphRenderGpuKernel.test.mjs` coverage for generic surface-table
  packing, CPU render-field splatting by material id + phase id, field splitting
  for the Three.js bridge, and optional WebGPU execution via injected runner.
- Updated the SPH browser e2e so a successful WebGPU resident branch must report
  `source = resident-gpu-render-field`, WebGPU render-field backend, nonzero
  field byte length, and visible field-backed surfaces.
- Validation passed: syntax checks for touched files, `node --test
  tests/abi.test.mjs tests/sphRenderGpuKernel.test.mjs` (`23/23`),
  `node --test tests/sphPhaseRenderer.test.mjs` (`6/6`), focused HTTPS
  Chromium e2e (`1/1`), manual Fe/H2O and Na/H2O browser probes, and
  `git diff --check`.

## 2026-06-11 Resident Render Buffer And Closure-Graph Perf Gates

Immediate render-buffer gate:

- `tests/sphRenderGpuKernel.test.mjs` should prove the optional WebGPU
  render-field path forwards a retained render-row GPU buffer to the injected
  runner and reports `renderFieldInputSource =
  resident-render-rows-buffer`.
- `tests/demo.e2e.mjs` should prove a successful WebGPU resident SPH branch
  reports retained render-row buffer telemetry and visible surfaces sourced from
  `resident-render-rows-buffer`.

Validation status:

- PASS: `node --test tests/sphRenderGpuKernel.test.mjs` (`7/7`).
- PASS: focused HTTPS Chromium e2e against `https://127.0.0.1:5173/` (`1/1`).
- PASS: full `npm test` (`313/313`).
- PASS: `npm run build` with the existing Vite large-chunk warning.

Flat closure-law graph gates for the next major performance slice:

- CPU compiler tests should build a deterministic flat node/edge/table buffer
  set from a representative closure graph and validate units, domains,
  provenance hashes, and dependency ordering.
- CPU reference and WebGPU evaluator tests should run the same EOS/phase,
  mechanics, optical, radiation, reaction, and nuclear fixture rows through the
  flat closure buffers and compare outputs within declared tolerances.
- Browser e2e should confirm normal runtime samples the flat closure graph from
  WebGPU buffers and only reads compact status/diagnostic summaries unless a
  domain exit or validation failure is reported.
- Regression tests should reject material-specific branches for individual demo
  substances when the same behavior can be expressed through derived closure
  rows.

Implemented first flat-graph gates:

- `tests/abi.test.mjs` now covers `peercompute.ulg.closure-law-graph.v0`, flat
  node/edge/sample/slot/status row layouts, descriptor stride metadata, and
  validation-flag overclaim rejection.
- `tests/closureLawGraph.test.mjs` covers strict CPU compilation from
  table-interpolation closures, rejection of unsorted table axes, CPU
  table-linear graph evaluation, domain-exit status/refresh reporting,
  optional WebGPU parity acceptance through an injected runner, and parity drift
  fallback.
- Manual Chromium/WebGPU probe against the live HTTPS Vite server executed
  `closureLawGraphEvalWgsl` with real WebGPU after enabling headless WebGPU
  flags and passed CPU/WebGPU parity exactly.

Validation status:

- PASS: `node --test tests/closureLawGraph.test.mjs tests/abi.test.mjs`
  (`24/24`).
- PASS: manual Chromium/WebGPU probe reported `backend = webgpu`,
  `webgpuStatus.status = webgpu-executed`, parity `pass`, `maxSlotAbs = 0`,
  and `maxStatusAbs = 0`.

Carrier graph bridge gates:

- `tests/webgpuCarrierKernel.test.mjs` now checks `carrierGraphStepWgsl`
  declares and consumes flat closure-law graph node/sample/slot/status buffers.
- Manual Chromium/WebGPU probe ran the existing optional carrier runtime through
  the graph-backed WebGPU kernel and passed CPU/WebGPU carrier parity.

Validation status:

- PASS: `node --test tests/webgpuCarrierKernel.test.mjs
  tests/closureLawGraph.test.mjs tests/abi.test.mjs` (`32/32`).
- PASS: manual Chromium/WebGPU carrier probe reported `backend = webgpu`,
  `webgpuStatus.status = webgpu-executed`, carrier parity `pass`,
  `closureLawGraph.backend = webgpu-resident-flat-graph`, and invariant status
  `pass`.

SPH thermal closure graph artifact gates:

- `tests/sphThermalGpuKernel.test.mjs` now verifies
  `buildSphThermalClosureGraphBuffers()` emits
  `peercompute.ulg.sph-gpu-thermal-closure-graph-set.v0` from the derived
  thermal material table, preserves H2O/Fe/air material metadata, preserves
  source phase ids, and evaluates each emitted segment graph through the
  generic closure-law graph CPU evaluator to match
  `resolveThermalStateFromTable()`.
- `tests/demo.e2e.mjs` now verifies the browser SPH phase scene exposes the
  graph set beside the material table.

Validation status:

- PASS: `node --test tests/sphThermalGpuKernel.test.mjs` (`6/6`).
- PASS: `node --test tests/sphThermalGpuKernel.test.mjs
  tests/closureLawGraph.test.mjs tests/abi.test.mjs` (`30/30`).
- PASS: focused HTTPS Chromium e2e against `https://127.0.0.1:5173/`
  (`1/1`).
- PASS: full `npm test` (`323/323`).
- PASS: `npm run build` with the existing Vite large-chunk warning.
- PASS: `git diff --check`.

SPH thermal phase-response gates:

- `tests/abi.test.mjs` now locks the
  `peercompute.ulg.sph-gpu-thermal-closure-graph-bank.v0` and
  `peercompute.ulg.sph-gpu-thermal-phase-response-table.v0` schemas plus the
  f32x4-aligned response record/row layouts.
- `tests/closureLawGraph.test.mjs` now covers the generic `tableStep` graph op
  for explicit selector/categorical outputs.
- `tests/sphThermalGpuKernel.test.mjs` now verifies the packed thermal graph
  bank, builds the phase-response table, and proves graph temperature plus
  response-table phase/density/fraction outputs match the legacy thermal
  resolver for generated H2O/Fe/air segments, plateau midpoint behavior, and
  low/high clamp behavior.

Validation status:

- PASS: `node --test tests/abi.test.mjs tests/closureLawGraph.test.mjs
  tests/sphThermalGpuKernel.test.mjs` (`32/32`).
- PASS: focused HTTPS Chromium e2e against `https://127.0.0.1:5173/`
  (`1/1`).
- PASS: `npm run build` with the existing Vite large-chunk warning.
- PASS: `git diff --check`.
- PASS: full `npm test` (`325/325`).

SPH thermal WebGPU response/graph binding gates:

- `tests/abi.test.mjs` now checks `sphThermalStepWgsl` binds
  `phase_response_records`, `phase_responses`, `thermal_graph_nodes`, and
  `thermal_graph_samples`, with output thermo at the shifted storage binding.
- `tests/demo.e2e.mjs` now confirms the live scene exposes the packed graph
  bank schema and the phase-response table schema/count.

Validation status:

- PASS: syntax checks for touched WGSL/runtime/scene/e2e files.
- PASS: `node --test tests/abi.test.mjs tests/sphThermalGpuKernel.test.mjs
  tests/closureLawGraph.test.mjs` (`32/32`).
- PASS: focused HTTPS Chromium e2e against `https://127.0.0.1:5173/`
  (`1/1`).
- PASS: `npm run build` with the existing Vite large-chunk warning.
- PASS: `git diff --check`.
- PASS: full `npm test` (`325/325`).

SPH box/grid, worker rebuild, warnings/cache, and general reaction candidate gates:

- `tests/sphPhaseRenderer.test.mjs` now includes a regression proving a fixed
  particle cloud keeps the same continuous-surface radius when the simulation
  box doubles, while `createMlsMpmGridSpec()` grows the grid dimensions and node
  count at the same smoothing/grid spacing.
- `tests/contract-fixtures.test.mjs` now checks the `ulg-runtime`
  `sph.phase.rebuild` service contract and task capsule shape.
- `tests/chemistryReactionCandidates.test.mjs` covers lowercase/formula
  parsing, Li/Na/Cs water reactions through the same balanced family, Na/Cl and
  Na/Cl2 binary ionic candidates, and non-1:1 products such as MgCl2 and
  Al2O3 without claiming scientific validation.
- `tests/reactionDiscovery.test.mjs` now verifies the SPH adapter consumes the
  general candidate layer for lighter integration cases, carries balanced
  stoichiometry into reaction records, and updates Fe + H2O from the old FeOH
  reduced product to balanced Fe(OH)2.
- Browser probes against the live HTTPS Vite server verified a box X-size
  change from 5 m to 10 m submitted a supervised `sph.phase.rebuild` worker
  task, applied `peercompute-worker-packed-state`, and reported
  `mls grid : dims=30x18x18 nodes=9720 dx=0.400m`.

Validation status:

- PASS: `node --test tests/contract-fixtures.test.mjs
  tests/sphPhaseRenderer.test.mjs tests/chemistryReactionCandidates.test.mjs
  tests/reactiveChemistry.test.mjs` (`22/22`).
- PASS: `node --test tests/reactionDiscovery.test.mjs` (`7/7`, slow because it
  still derives product closures for integration evidence).
- PASS: focused HTTPS Chromium e2e against `https://127.0.0.1:5173/` (`1/1`).
- PASS: manual HTTPS Chromium worker/grid probe: `sph.phase.rebuild` completed
  in `ulg-runtime`, status showed `peercompute-worker-packed-state`, closure
  cache hits, idle CPU closure task, and expanded MLS grid dimensions.
- PASS: syntax checks for touched runtime, worker, scene, mount, and test files.
- PASS: `npm run build` and `npm run build:pages`, both with the existing Vite
  large-chunk warning.
- PASS: `git diff --check`.

Additional local closure-cache invalidation gate:

- Browser probe seeded an old v1 material-name-only localStorage cache and then
  loaded the SPH demo. The runtime rejected it as `schema-mismatch`, reported
  `stale=1`, derived fresh values, and wrote v2 hash-keyed records with
  generator fingerprints, input hashes, and a material index.
- Focused SPH e2e now expects the v2 cache schema and a `ulg:*` generator
  fingerprint in the write result.

Validation status:

- PASS: manual HTTPS Chromium cache probe reported previous schema
  `peercompute.ulg.local-derived-closure-cache.v1`, write schema
  `peercompute.ulg.local-derived-closure-cache.v2`, generator fingerprint
  `ulg:653567f6`, and material index keys for H2O/Fe/air/H2/O2/FeOH2.
- PASS: focused HTTPS Chromium e2e against `https://127.0.0.1:5173/` (`1/1`).
- PASS: `npm run build` and `npm run build:pages` with the existing Vite
  large-chunk warning.
- PASS: `git diff --check`.

Reaction stoichiometry and energetics gates:

- ABI tests should lock a balanced reaction-closure schema with reactant term
  rows, product term rows, gas-product routing rows, validity rows, and
  provenance hashes.
- Candidate tests should prove Li/H2O, Na/H2O, and Cs/H2O are discovered through
  one general active-metal/water path and emit hydroxide plus H2 byproduct
  stoichiometry.
- Candidate tests should prove Na/Cl2, Mg/Cl2, and Al/O2 balance exact integer
  coefficients without material-specific scripts.
- Strict-mode tests should reject any executable reaction carrying
  `provisional-heuristic-not-scientifically-validated`; a bad fast energy sign
  must become `needs-refined-thermochemistry`, not a heuristic reaction.
- CPU runtime tests should consume macro-particle moles by limiting reactant and
  produce all products by coefficient while conserving atoms, charge, mass, and
  energy within declared tolerances.
- Gas byproduct tests should route H2 or vapor products into a gas inventory and
  derive sealed-box pressure from gas moles, volume, temperature, and EOS.
- WebGPU parity tests should compare resident reaction product masses, gas
  moles, heat, phase reset, and compact pressure summaries against the CPU
  reference without full particle readback.
- Browser e2e should verify cold reaction-closure derivation reports a visible
  worker/GPU task, cache hits avoid the multi-minute freeze on later runs, and
  stale reaction closures are ignored after generator changes.

Phase-resolved steam optics gates:

- Unit tests should prove H2O solid, liquid, gas, and condensed-droplet steam
  build distinct optical cache keys and optical GPU rows.
- Pure H2O vapor should remain high-transmission/low-opacity when no condensed
  droplet fraction is derived.
- Supersaturated vapor with a derived droplet fraction should increase
  scattering/extinction and render as a visible steam/cloud surface.
- Cache tests should reject optical rows when phase, temperature/pressure/density
  bucket, droplet summary, path length, or generator fingerprint changes.
- Browser e2e should expose optical mode diagnostics for liquid water, pure
  vapor, and condensed steam.

SPH cold-start/cache performance gates:

- Worker rebuild timing now records cache lookup, worker rebuild, clear-cache,
  and cached interactive-driver spans; remaining gates need finer subspans for
  material closure derivation, reaction discovery, product closure derivation,
  optical table construction, thermal graph packing, and GPU upload/warmup.
- Add tests that material closure cache hits are actually included in
  `sph.phase.rebuild` task options and consumed by the worker.
- Added tests that reaction discovery caches material-property-backed reactions
  by material/provenance hash instead of disabling the cache, including a
  persisted-record hit path.
- Browser e2e now verifies worker-first SPH startup exposes cold-cache status,
  persisted cold-start records, clear-cache UI presence, timing trace state, and
  cached Na/H2O stepping. Remaining gates still need explicit stale rejection
  and warm-reload delta assertions.
- Add tests for persisted thermal graph/phase-response, optical/PBR, static
  table, and GPU warmup metadata cache hits that skip deterministic
  reconstruction while preserving ABI/generator invalidation.
- Add browser e2e coverage for the SPH `clear cache` button: it must delete
  only ULG SPH cache families, reset in-memory cache signatures, report cleared
  counts, force a cold rebuild, and then allow a warm reload to repopulate
  cache hits.

WebGPU material-property resolver migration gates:

- Add a resolver-manifest test that enumerates every material-property resolver
  family, current CPU entrypoint, GPU target schema, cache key fields, and
  fallback status.
- Add optical tests proving relativistic/interband metal optics are
  `webgpu-derived`, not only `webgpu-consumed`, and match the CPU
  Drude-Lorentz/CIE reference within declared tolerance.
- Add thermal/mechanics/EOS tests proving phase-response, EOS, modulus,
  viscosity/transport, and mechanics reset rows can be resolved from
  GPU-resident material rows without main-thread CPU closure work.
- Add element/compound solver tests that compare WebGPU radial Kohn-Sham/KH
  and molecular closure outputs against CPU references for a small element and
  molecule suite.
- Add reaction tests proving balanced multi-product closure execution runs from
  resident WebGPU term tables, including gas byproducts and pressure summaries.
- Add radiation tests locking the isotope/channel/Cherenkov buffer schemas and
  requiring explicit validation blockers until the physics is benchmarked.
- Add browser e2e checks for warning banners when WebGPU is unavailable or any
  closure resolver falls back to CPU/main-thread work.

Overarching completion plan gates:

- Before starting each implementation phase in
  `plan/todo/overarching-completion-plan.md`, run or record the relevant
  baseline focused tests so regressions are attributable to the current phase.
- Each completed phase must update `plan/implementation-status.md`,
  `plan/log.md`, and the specific source todo file with concrete validation
  evidence before the overarching plan marks that phase done.
- Phase advancement requires that known validation blockers remain explicit;
  no phase may clear `scientificValidation` or `fullPhysicsValidation` by
  implication.
- Final completion requires cold/warm/clear-cache probes, reaction fixtures,
  steam/phase optical fixtures, GPU no-full-readback evidence, and profiler
  evidence for the demo hot loop.

Resident reaction term-table slice, 2026-06-11 21:08 AKDT:

- `node --check src/runtime/sph/sphReactionGpuKernel.js && node --check src/runtime/sph/sphColdStartCache.js && node --check ulg-gpu-abi/src/wgsl.js`
  - Passed.
- `node --test tests/sphReactionGpuKernel.test.mjs tests/sphColdStartCache.test.mjs tests/abi.test.mjs`
  - Passed, `30/30`.
  - Covers packed reaction table term rows, gas routing metadata, CPU resident
    fixed-buffer extent execution, excess-reactant preservation, unplaced gas
    product ledgers, static table cache rehydration, and WGSL ABI regex guards.
- `git diff --check`
  - Passed.

Browser WebGPU surface draw smoke,
2026-06-12 03:49 AKDT:

- `node --check ulg-gpu-abi/src/wgsl.js && node --check tests/abi.test.mjs && node --check tests/demo.e2e.mjs && node --check tests/playwright.config.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `40/40`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH surface draw WebGPU shader"`
  - Passed, `1/1`.
  - Covers real Chromium WebGPU adapter/device acquisition, shader
    compilation/dispatch, compact vertex rows, draw rows, and parity against a
    tiny CPU fixture.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, using the normal browser config without unsafe WebGPU flags.
- `npm test`
  - Passed, `407/407`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.
- `python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py index --repo ulg`
  - Passed, `237` files indexed.
- `python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py build-memory --repo ulg`
  - Passed, `237` files / `1096` chunks.
- Infinite Context Coder refresh:
  - `python3 scripts/codebase_tool.py index --repo ulg` passed, `237` files.
  - `python3 scripts/codebase_tool.py build-memory --repo ulg` passed, `237`
    files / `1088` chunks.

Resident product-event merge coverage, 2026-06-12 00:22 AKDT:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  - Passed.
- `node --check tests/sphMlsMpmGpuStep.test.mjs`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs`
  - Passed, `11/11`.
  - Adds direct coverage for GPU copy concatenation of carried and newly emitted
    resident product-event buffers, cumulative generation metadata, carry-forward
    through `nextParticleUploads`, and destruction ownership.
- `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphGridGpuKernel.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed, `58/58`.
  - Rechecks resident product mass through repeated MLS-MPM steps, P2G product
    mass consumption, render-field consumption, phase-demo pressure summaries,
    and renderer surface behavior.
- `git diff --check`
  - Passed.

Resident gas-species pressure continuity, 2026-06-12 00:30 AKDT:

- `node --check src/runtime/sph/sphReactionGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sphPhaseDemo.js && node --check src/visualization/sphPhaseDemoMount.js && node --check tests/sphMlsMpmGpuStep.test.mjs && node --check tests/sphPhaseDemo.test.mjs`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseDemo.test.mjs tests/sphReactionGpuSummary.test.mjs`
  - Passed, `33/33`.
  - Covers resident product-mass gas ledger merge, pressure summary preference
    for the merged handle, and reaction summary gas/product decoders.
- `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphGridGpuKernel.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphReactionGpuSummary.test.mjs`
  - Passed, `67/67`.
  - Rechecks P2G/render/phase pressure and renderer behavior after the pressure
    source update.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.

Resident overlay draw order checkpoint,
2026-06-12 08:33 AKDT:

- Syntax checks for `src/visualization/sphPhaseScene.js`,
  `tests/sphPhaseRenderer.test.mjs`, and `tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident overlay|transparent|vapor|steam"`
  - Passed, `15/15` renderer file tests executed.
  - Covers resident overlay ordering by render policy metadata, vapor
    visibility, transparent solid policy, and transparent render ordering.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH surface draw WebGPU shader"`
  - Passed, `1/1`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- Full SPH e2e with `PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1`
  - Timed out before resident readback status in headless Chromium, matching
    the prior full unsafe-WebGPU limitation. The focused offscreen WebGPU shader
    smoke remains the useful overlay evidence.

Resident overlay optical/PBR rows checkpoint,
2026-06-12 08:44 AKDT:

- Syntax checks for `src/visualization/sphPhaseScene.js`,
  `src/visualization/sphPhaseDemoMount.js`,
  `tests/sphPhaseRenderer.test.mjs`, and `tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident overlay|optical"`
  - Passed, `16/16` renderer file tests executed.
  - Covers resident overlay draw order and the shader-source guard that keeps
    closure-derived optical records bound into the overlay path.
- `node --test tests/sphPhaseRenderer.test.mjs tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `57/57`.
  - Covers renderer policy, surface draw metadata, compact draw rows, and ABI
    assumptions after the overlay optical binding change.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH surface draw WebGPU shader"`
  - Passed, `1/1`.
  - Browser-compiles and submits the raw WebGPU overlay with a bound optical
    GPU record buffer.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
  - Covers the live demo exposing `closure-derived-optical-gpu-table` and the
    resident overlay optical record count in snapshots/status.

Resident overlay depth attachment checkpoint,
2026-06-12 08:55 AKDT:

- Syntax checks for `src/visualization/sphPhaseScene.js`,
  `src/visualization/sphPhaseDemoMount.js`,
  `tests/sphPhaseRenderer.test.mjs`, and `tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident overlay|optical|draw order"`
  - Passed, `16/16` renderer file tests executed.
  - Covers resident draw ordering, overlay pipeline classification, depth
    format export, and closure-derived optical shader binding.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH resident overlay depth attachment|SPH surface draw WebGPU shader"`
  - Passed, `2/2`.
  - Covers the resident overlay shader path with depth-enabled pipelines and a
    pixel-readback proof that far transparent and far opaque draws are occluded
    by a near opaque depth write.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
  - Covers live bridge telemetry for `opaque-depth-write-transparent-depth-test`,
    `depth24plus`, and depth attachment readiness.

Resident overlay weighted blended OIT checkpoint,
2026-06-12 09:05 AKDT:

- Syntax checks for `src/visualization/sphPhaseScene.js`,
  `src/visualization/sphPhaseDemoMount.js`,
  `tests/sphPhaseRenderer.test.mjs`, and `tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident overlay|optical|draw order"`
  - Passed, `16/16` renderer file tests executed.
  - Covers OIT constants and shader entry-point guards alongside resident draw
    ordering and optical table binding.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH resident overlay depth attachment|SPH surface draw WebGPU shader"`
  - Passed, `2/2`.
  - Covers the resident overlay shader, OIT accumulation/composite pipeline
    submission, and the depth pixel-readback proof.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
  - Covers the live default scene reporting `weighted-blended-oit`,
    `rgba16float`, `rgba8unorm`, OIT target readiness, and transparent draw
    count.

Resident overlay optical attenuation and IOR checkpoint,
2026-06-12 09:10 AKDT:

- Syntax checks for `src/visualization/sphPhaseScene.js`,
  `tests/sphPhaseRenderer.test.mjs`, and `tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident overlay|optical"`
  - Passed, `16/16` renderer file tests executed.
  - Covers shader-source guards for closure-derived attenuation, optical depth,
    scattering coefficient, and IOR/Fresnel fields.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH resident overlay depth attachment|SPH surface draw WebGPU shader"`
  - Passed, `2/2`.
  - Browser-compiles and submits the updated WGSL with the expanded optical
    struct and keeps the depth pixel-readback proof passing.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.

Resident overlay spectral rows checkpoint,
2026-06-12 09:16 AKDT:

- Syntax checks for `src/visualization/sphPhaseScene.js`,
  `src/visualization/sphPhaseDemoMount.js`,
  `tests/sphPhaseRenderer.test.mjs`, and `tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident overlay|optical"`
  - Passed, `16/16` renderer file tests executed.
  - Covers shader-source guards for spectral sample binding, wavelength tinting,
    and bounded spectral row traversal.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH resident overlay depth attachment|SPH surface draw WebGPU shader"`
  - Passed, `2/2`.
  - Browser-compiles and submits the updated overlay shader with both optical
    material records and spectral sample storage buffers bound.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
  - Covers live bridge telemetry for spectral sample count and stride matching
    the optical GPU table.
- `npm test`
  - Passed, `409/409`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/` with `docs/assets/pages-B89kFbUC.js`.
- `git diff --check`
  - Passed.
- Infinite Context Coder `index --repo ulg` and `build-memory --repo ulg`
  - Passed, `237` files indexed and `1104` memory chunks built.

GPU surface draw compaction checkpoint,
2026-06-12 03:28 AKDT:

- `node --check src/runtime/sph/sphRenderGpuKernel.js && node --check ulg-gpu-abi/src/wgsl.js && node --check tests/sphRenderGpuKernel.test.mjs && node --check tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `40/40`.
  - Covers the new `sphRenderSurfaceDrawWgsl` ABI exposure, the real WebGPU
    builder path, compact vertex buffer draw-source contract, retained
    no-full-readback draw/vertex buffers, and CPU draw metadata parity wrappers.
- `node --test tests/sphGridGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseDemo.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphReactionGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `106/106`.
- `npm test`
  - Passed, `407/407`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- `curl -k -I --max-time 10 https://127.0.0.1:5173/`
  - Passed, HTTP `200`.
- `ss -ltnp | rg ':5173'`
  - Passed, Vite is listening on `0.0.0.0:5173`.
- Infinite Context Coder refresh:
  - `python3 scripts/codebase_tool.py index --repo ulg` passed, `237` files.
  - `python3 scripts/codebase_tool.py build-memory --repo ulg` passed, `236`
    files / `1028` chunks.
- `git diff --check`
  - Passed.

Deterministic surface-vertex emission checkpoint,
2026-06-12 03:06 AKDT:

- `node --check src/runtime/sph/sphRenderGpuKernel.js && node --check ulg-gpu-abi/src/wgsl.js && node --check tests/sphRenderGpuKernel.test.mjs && node --check tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `36/36`.
  - Covers the new surface-vertex schemas, f32x4 row layout, WGSL fixed-slot
    emitter contract, CPU tetrahedralized render-field vertex emission,
    optional WebGPU parity wrapper, no-full-readback render-field buffer
    retention, and the `12/36` marching-cube cell reservation.
- `node --test tests/sphGridGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseDemo.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphReactionGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `102/102`.
- `npm test`
  - Passed, `403/403`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- `PATH=/home/cos/projects/infinite_context_coder/.venv/bin:$PATH python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py index --repo ulg`
  - Passed.
- `PATH=/home/cos/projects/infinite_context_coder/.venv/bin:$PATH python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py build-memory --repo ulg`
  - Passed.

Surface draw metadata checkpoint,
2026-06-12 03:15 AKDT:

- `node --check src/runtime/sph/sphRenderGpuKernel.js && node --check tests/sphRenderGpuKernel.test.mjs && node --check tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `38/38`.
  - Covers the new surface-draw schemas, f32x4 row layout, CPU draw metadata
    bucketing from compact surface vertices, and optional WebGPU parity wrapper.
- `node --test tests/sphGridGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseDemo.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphReactionGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `104/104`.
- `npm test`
  - Passed, `405/405`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- `PATH=/home/cos/projects/infinite_context_coder/.venv/bin:$PATH python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py index --repo ulg`
  - Passed.
- `PATH=/home/cos/projects/infinite_context_coder/.venv/bin:$PATH python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py build-memory --repo ulg`
  - Passed.
- `git diff --check`
  - Passed.

Sealed-gas pressure-cell field contract, 2026-06-12 00:34 AKDT:

- `node --check src/runtime/sphPhaseDemo.js`
  - Passed.
- `node --check tests/sphPhaseDemo.test.mjs`
  - Passed.
- `node --test tests/sphPhaseDemo.test.mjs`
  - Passed, `14/14`.
  - Covers the uniform sealed-gas pressure-cell field, zero pressure gradient,
    explicit force-coupling prerequisites, and the surface-normal blocker.
- `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphGridGpuKernel.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphReactionGpuSummary.test.mjs`
  - Passed, `67/67`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- `git diff --check`
  - Passed.
- `node --test tests/reactiveChemistry.test.mjs tests/reactionDiscovery.test.mjs tests/chemistryReactionCandidates.test.mjs tests/sphPhaseDemo.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphColdStartCache.test.mjs`
  - Passed, `54/54`.
  - Covers the broader CPU chemistry, reaction discovery, SPH demo, resident
    MLS-MPM handoff, static-cache, and resident reaction CPU reference paths.
- `npm run build:pages`
  - Passed; generated `docs/assets/pages-LrVu5lFx.js` and rewired
    `docs/index.html`, with the existing Vite large-chunk warning.
- `npm run build`
  - Passed, with the existing Vite large-chunk warning.
- `npm test`
  - Passed, `361/361`.
- `node --check tests/demo.e2e.mjs`
  - Passed after changing the derived-material SPH browser test to wait for the
    worker-produced preflight after a cache clear.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 npx playwright test --config tests/playwright.config.mjs -g "SPH phase demo"`
  - Passed, `4/4`, against the live HTTPS Vite server.

Remaining reaction test gates:

- Add strict gate tests that consume the compact atom/charge/mass residuals and
  reject executable reactions when residuals or energetics are outside declared
  tolerance.
- Add browser/WebGPU e2e that proves resident reaction term-table execution can
  run without full particle readback and expose those compact summaries.

Resident product inventory, atom residual, and cache coverage slice,
2026-06-11 22:30 AKDT:

- `node --check src/runtime/sph/sphReactionGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/services/ulgRuntime.worker.js && node --check src/visualization/sphPhaseDemoMount.js && node --check tests/abi.test.mjs && node --check tests/sphReactionGpuSummary.test.mjs && node --check tests/sphMlsMpmGpuStep.test.mjs && node --check tests/ulgRuntimeWorkerCacheCoverage.test.mjs`
  - Passed.
- `node --test tests/abi.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/ulgRuntimeWorkerCacheCoverage.test.mjs`
  - Passed, `33/33`.
  - Covers product-inventory readback, atom-residual decoder aggregation,
    atom-residual WebGPU command-stream wiring, resident repeated-step
    diagnostics, ABI/WGSL guards, and worker static-table coverage rejecting
    changed reaction contact radius while ignoring particle count alone.
- `node --test tests/sphColdStartCache.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs`
  - Passed, `23/23`.
  - Covers static-table serialization/rehydration, resident reaction table
    packing, SPH demo pressure diagnostics, and baseline demo construction.

New performance/rendering gate added:

- Add WebGPU marching-cubes tests under the hot-loop phase. Required evidence:
  GPU field build, active-cell classification, prefix/compaction, triangle and
  normal emission, material/phase/optical ids, and no CPU mesh extraction during
  normal rendering.

Strict reaction gate and pressure feedback slice, 2026-06-11 22:38 AKDT:

- `node --check src/runtime/sph/sphReactionGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sphPhaseDemo.js && node --check src/runtime/sphPhaseViewState.js && node --check src/services/ulgRuntime.worker.js && node --check src/visualization/sphPhaseDemoMount.js && node --check tests/sphReactionGpuSummary.test.mjs && node --check tests/sphMlsMpmGpuStep.test.mjs && node --check tests/sphPhaseDemo.test.mjs`
  - Passed.
- `node --test tests/sphReactionGpuSummary.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseDemo.test.mjs`
  - Passed, `27/27`.
  - Covers strict reaction gate pass/block behavior, resident diagnostics,
    baseline/resident gas pressure, per-wall pressure feedback, and strict-gate
    blocking of force coupling.
- `node --test tests/abi.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphColdStartCache.test.mjs tests/ulgRuntimeWorkerCacheCoverage.test.mjs`
  - Passed, `31/31`.
  - Rechecks ABI, resident reaction table packing, static-table cache
    rehydration, and worker cache coverage after the pressure/gate changes.

Rendered-blob flicker stabilization, 2026-06-12 00:14 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/sphPhaseRenderer.test.mjs`
  - Passed.
- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs`
  - Passed, `12/12`.
  - Covers render-field hysteresis and stable intra-layer render ordering.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed, `31/31`.
  - Rechecks compact render rows/fields, renderer batching/ordering, and the
    resident MLS-MPM handoff path while the resident product-mass merge work is
    in progress.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo opens collapsed"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- Browser visual probe against `https://127.0.0.1:5173/?drop=fe&base=h2o&dropt=1850&baset=233.15&dropn=3&basen=3&boxx=5&boxy=5&boxz=5`
  - Passed. Sampled 24 frames; visible marching-cubes surface count stayed
    stable at `2/2`; render orders were finite and stable.
  - Screenshot: `test-results/sph-blob-flicker-check.png`.
- `npm test`
  - Passed, `384/384`.
- `git diff --check`
  - Passed.

Phase-resolved H2O vapor optics and optical lookup ABI diagnostics,
2026-06-12 00:55 AKDT:

- `node --check src/runtime/material/opticalClosure.js && node --check src/runtime/material/opticalGpuBuffers.js && node --check src/runtime/sphPhaseDemo.js && node --check src/visualization/sphPhaseScene.js && node --check ulg-gpu-abi/src/index.js && node --check ulg-gpu-abi/src/wgsl.js`
  - Passed.
- `node --test tests/opticalClosure.test.mjs`
  - Passed, `10/10`.
  - Covers H2O gas pure-vapor versus supersaturated condensed-droplet optical
    response, droplet-radius sensitivity, spectral scatter, and cache cloning.
- `node --test tests/opticalGpuBuffers.test.mjs`
  - Passed, `16/16`.
  - Covers optical-state-key table dedupe, optical-state-id lookup matching,
    appended optical-depth/scatter/absorption/state-id output rows, CPU/WebGPU
    WGSL stride guards, and parity behavior.
- `node --test tests/sphPhaseDemo.test.mjs`
  - Passed, `15/15`.
  - Covers sealed-box H2O vapor optical state derivation, pressure bucketing,
    condensation microphysics status, and no optical state on non-gas H2O
    descriptors.
- `node --test tests/abi.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed, `29/29`.
  - Covers the 16-float optical lookup ABI and renderer separation of clear
    vapor from condensed-droplet steam through closure-derived scatter/depth.
- `node --test tests/opticalClosure.test.mjs tests/opticalGpuBuffers.test.mjs tests/sphPhaseDemo.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphRenderGpuKernel.test.mjs`
  - Passed, `62/62`.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/sphGridGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphPhaseDemo.test.mjs tests/opticalGpuBuffers.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed, `84/84`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- `npm test`
  - Passed, `387/387`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.

Conservative pressure-interface force solver checkpoint,
2026-06-12 01:55 AKDT:

- `node --check src/runtime/sphPhaseDemo.js && node --check src/visualization/sphPhaseScene.js && node --check tests/sphPhaseDemo.test.mjs && node --check tests/demo.e2e.mjs && node --check tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphPhaseDemo.test.mjs tests/abi.test.mjs`
  - Passed, `34/34`.
  - Covers `peercompute.ulg.sph-pressure-interface-force-solver.v0`, the
    16-float force row layout, solver-ready-not-applied status, equal/opposite
    material/gas force rows, zero pairwise residuals, and blocked empty-input
    behavior.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphPhaseRenderer.test.mjs tests/abi.test.mjs`
  - Passed, `59/59`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, with live resident render diagnostics exposing the
    pressure-interface force solver artifact.
- `npm test`
  - Passed, `393/393`.
- `git diff --check`
  - Passed.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.

Local interface elements and pressure-force preview checkpoint,
2026-06-12 01:18 AKDT:

- `node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/runtime/sphPhaseDemo.js && node --check src/visualization/sphPhaseScene.js && node --check tests/sphRenderGpuKernel.test.mjs && node --check tests/sphPhaseDemo.test.mjs && node --check tests/demo.e2e.mjs && node --check tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphPhaseRenderer.test.mjs tests/abi.test.mjs`
  - Passed, `56/56`.
  - Covers local interface element row layout, element row/object emission,
    aggregate area consistency, pressure/interface coupling, strict-gate
    override, and non-applied pressure-force previews.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, with resident render diagnostics exposing previewed
    interface element count and non-applied pressure-force preview status.
- `npm test`
  - Passed, `390/390`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.

Material-interface field and pressure/interface coupling checkpoint,
2026-06-12 01:09 AKDT:

- `node --check src/runtime/sph/sphRenderGpuKernel.js && node --check tests/sphRenderGpuKernel.test.mjs && node --check tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `27/27`.
  - Covers `peercompute.ulg.sph-material-interface-field.v0`, threshold-crossing
    area/normal/centroid derivation from render fields, and ABI schema exposure.
- `node --check src/runtime/sphPhaseDemo.js && node --check src/visualization/sphPhaseScene.js && node --check tests/sphPhaseDemo.test.mjs && node --check tests/demo.e2e.mjs && node --check tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphPhaseDemo.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/abi.test.mjs`
  - Passed, `55/55`.
  - Covers pressure/interface coupling readiness, strict-gate override, no force
    validation, resident render-field interface diagnostics, and existing
    renderer/ABI contracts.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, with live resident render-state diagnostics exposing
    material-interface and pressure/interface coupling readiness while force
    coupling remains blocked on the missing solver.
- `npm test`
  - Passed, `389/389`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.

Rendered blob flicker guard checkpoint, 2026-06-12 01:28 AKDT:

- `node --test tests/sphPhaseRenderer.test.mjs tests/sphRenderGpuKernel.test.mjs`
  - Passed, `22/22`.
  - Covers render-field hysteresis, stable render ordering, transparent
    depth-write handling, material identity separation, render-field splatting,
    and material-interface extraction.
- `git diff --check`
  - Passed.
- `npm test`
  - Passed, `390/390`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- tests/demo.e2e.mjs`
  - Partial: SPH/runtime-relevant browser coverage passed (`5/5` after the
    first smoke), including URL-param startup, clear cache, derived-material SPH,
    Na + H2O, and cached-closure oscillator.
  - Known unrelated failure: the legacy supervised service smoke timed out at
    `window.__ulgDemo.telemetry.services?.length === 2`.

GPU-shaped material-interface candidate buffer checkpoint,
2026-06-12 01:45 AKDT:

- `node --check ulg-gpu-abi/src/wgsl.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check tests/abi.test.mjs && node --check tests/sphRenderGpuKernel.test.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `30/30`.
  - Covers the candidate-field schemas, f32x4 candidate row layout, WGSL
    bindings, deterministic fixed cell-axis candidate rows, candidate-to-element
    compaction, optional WebGPU acceptance, and parity-failure fallback.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphPhaseRenderer.test.mjs tests/abi.test.mjs`
  - Passed, `59/59`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- `git diff --check`
  - Passed.
- `npm test`
  - Passed, `393/393`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.

Pressure-interface grid-force consumer and flicker path coverage checkpoint,
2026-06-12 02:12 AKDT:

- `node --check src/visualization/sphPhaseScene.js && node --check tests/sphPhaseRenderer.test.mjs && node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check ulg-gpu-abi/src/wgsl.js`
  - Passed.
- `node --check tests/sphMlsMpmGpuStep.test.mjs && node --check tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/abi.test.mjs`
  - Passed, `43/43`.
  - Covers the direct rendered-blob inactive-grace path, pressure-force row
    consumption by MLS-MPM grid update, optional WebGPU forwarding of retained
    pressure-force row buffers, and ABI exposure of the grid-update pressure
    force binding.
- `node --test tests/sphGridGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseDemo.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphReactionGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `95/95`.
- `npm test`
  - Passed, `396/396`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.

Resident pressure-interface force routing checkpoint,
2026-06-12 02:23 AKDT:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/visualization/sphPhaseScene.js && node --check tests/sphMlsMpmGpuStep.test.mjs`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs`
  - Passed, `14/14`.
  - Covers pressure-interface solver rows reaching resident grid update and
    resident diagnostics reporting `pressure-interface-grid-force-consumer-applied`.
- `node --test tests/sphGridGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseDemo.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphReactionGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `96/96`.
- `npm test`
  - Passed, `397/397`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.

Rendered-blob flicker confirmation and GPU marching-cube classification checkpoint,
2026-06-12 02:45 AKDT:

- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "hysteresis|grace"`
  - Passed, `13/13` in the renderer file.
  - Covers render-field threshold hysteresis and direct inactive-grace behavior
    for retaining the last valid mesh before hide/reset.
- `node --check src/runtime/sph/sphRenderGpuKernel.js`
  - Passed.
- `node --check tests/sphRenderGpuKernel.test.mjs`
  - Passed.
- `node --check tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `34/34`.
  - Covers no-full-readback render-field buffer retention, CPU marching-cube
    voxel classification, optional WebGPU parity acceptance, resident
    no-readback marching-cube execution, and ABI/WGSL layout exposure.
- `npm test -- --test-name-pattern "SPH|sph|material|reaction|optical|thermal|MLS-MPM|render"`
  - Passed, `401/401`.
- `npm test`
  - Passed, `401/401`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.

Resident surface draw sidecar checkpoint,
2026-06-12 07:30 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed, `53/53`.
  - Covers the retained WebGPU surface draw builder, ABI/WGSL layout exposure,
    and the existing flicker/hysteresis renderer guard while the live bridge is
    being wired.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
  - Covers the live resident render path publishing
    `peercompute.ulg.sph-resident-surface-draw.v0`, retaining compact draw
    buffers without full draw readback, and exposing the `surface draw` overlay
    status line.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH surface draw WebGPU shader"`
  - Passed, `1/1`.
  - Browser-compiles and dispatches the surface draw WGSL in Chromium WebGPU.
- `npm test`
  - Passed, `407/407`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.

Surface draw indirect and WebGPU overlay bridge checkpoint,
2026-06-12 08:05 AKDT:

- Syntax checks for `src/visualization/sphPhaseScene.js`,
  `src/visualization/sphPhaseDemoMount.js`, `tests/demo.e2e.mjs`,
  `src/runtime/sph/sphRenderGpuKernel.js`, `ulg-gpu-abi/src/wgsl.js`,
  `tests/sphRenderGpuKernel.test.mjs`, and `tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `40/40`.
  - Covers the u32 draw-indirect ABI row, CPU/WebGPU surface draw metadata
    emission, retained indirect buffer behavior, and WGSL binding exposure.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH surface draw WebGPU shader"`
  - Passed, `1/1`.
  - Browser-compiles the resident surface draw shader, verifies compacted draw
    rows, and submits the raw-WebGPU overlay shader through an offscreen render
    target with `drawIndirect()`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- `npm test`
  - Passed, `407/407`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.
- Full SPH e2e with `PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1` timed out before
  resident readback status in headless Chromium and is not used as overlay
  evidence. The focused offscreen render-target smoke is the useful proof for
  the overlay shader plus indirect draw command path.

Vapor visibility from derived optics checkpoint,
2026-06-12 08:12 AKDT:

- `node --check src/visualization/sphPhaseScene.js && node --check tests/sphPhaseRenderer.test.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "vapor|steam|hysteresis|grace|transparent"`
  - Passed, `14/14` renderer file tests executed.
  - Covers optically thin pure vapor hiding, droplet steam visibility, liquid
    water remaining geometrically visible, render-field hysteresis, inactive
    grace-frame behavior, and transparent render ordering contracts.
- `node --test tests/sphPhaseRenderer.test.mjs tests/opticalClosure.test.mjs tests/opticalGpuBuffers.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs`
  - Passed, `80/80`.
  - Covers derived vapor microphysics, optical GPU row packing/lookup, resident
    render row optical state, and SPH pressure-driven vapor state plumbing.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.

Resident draw transparency policy checkpoint,
2026-06-12 08:23 AKDT:

- Syntax checks for `src/visualization/sphPhaseScene.js`,
  `src/runtime/sph/sphRenderGpuKernel.js`, `ulg-gpu-abi/src/wgsl.js`,
  `tests/sphPhaseRenderer.test.mjs`, `tests/sphRenderGpuKernel.test.mjs`, and
  `tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `55/55`.
  - Covers transparent solid/glass-like render policy, explicit surface-table
    policy slots, CPU draw metadata preservation, and WGSL use of explicit
    transparency/depth policy.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH surface draw WebGPU shader"`
  - Passed, `1/1`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.

Manual headed SPH watch and WebGPU validation cleanup,
2026-06-12 10:20 AKDT:

- `node --check src/runtime/sph/sphGridGpuKernel.js && node --check tests/sphGridGpuKernel.test.mjs`
  - Passed.
- `node --test tests/sphGridGpuKernel.test.mjs --test-name-pattern "product-event row|P2G|resident product"`
  - Passed, `14/14`.
  - Covers the full-row placeholder for zero resident product-event storage
    bindings.
- `node --test tests/sphGridUpdateGpuKernel.test.mjs --test-name-pattern "pressure-force|grid update"`
  - Passed, `9/9`.
  - Covers the full-row placeholder for zero pressure-interface force storage
    bindings.
- `node --test tests/opticalGpuBuffers.test.mjs --test-name-pattern "spectral|upload"`
  - Passed, `17/17`.
  - Covers the full-row placeholder for empty optical spectral-sample storage
    bindings.
- `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident|overlay|retains|ping-pong|product|render"`
  - Passed, `31/31`.
  - Covers resident ping-pong, product-event merge, overlay retention, and
    renderer contracts after resident scheduling was serialized.
- Manual headed Chromium:
  - URL: `https://127.0.0.1:5173/?sph=1`
  - Evidence folder: `test-results/manual-sph-watch-running-serialized/`
  - Result: zero WebGPU warnings, no crash, one non-critical 404 resource error,
    resident backend `webgpu`, resident readback `actual=no-full-readback`,
    surface draw bridge `webgpu-storage-indirect-overlay`, render fps about 38,
    resident fps about 3.9 after 90 seconds of Play.

Resident pressure-force buffer and FPS cleanup,
2026-06-12 10:45 AKDT:

- `node --check src/visualization/sphPhaseDemoMount.js && node --check src/visualization/sphPhaseScene.js && node --check tests/demo.e2e.mjs`
  - Passed.
- `node --check src/runtime/sph/sphReactionGpuSummary.js && node --check tests/sphMlsMpmGpuStep.test.mjs`
  - Passed.
- `node --check tests/sphGridGpuKernel.test.mjs`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure-interface|resident step routes|grid update"`
  - Passed, `14/14`.
  - Covers pressure-interface force rows flowing through the resident step into
    MLS-MPM grid update.
- `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "pressure interface|force preview|pressure feedback"`
  - Passed, `17/17`.
  - Covers sealed-gas pressure feedback, interface summaries, preview tractions,
    and solver force rows.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident|overlay|pressure|interface|render"`
  - Passed, `17/17`.
- `node --test tests/sphGridGpuKernel.test.mjs --test-name-pattern "resident product|P2G|product-event row"`
  - Passed, `14/14`.
  - Covers retained product-event mass, velocity, and EOS sidecar status in P2G.
- `node --test tests/sphReactionGpuSummary.test.mjs --test-name-pattern "product|summary|strict|gas|atom"`
  - Passed, `8/8`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`.
  - Covers live browser summary fields for pressure force rows, resident render
    state, and the FPS banner path.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH resident overlay depth attachment|SPH surface draw WebGPU shader"`
  - Passed, `2/2`.
- `git diff --check`
  - Passed.
- `npm run build`
  - Passed with the existing Vite large-chunk warning.
- `npm run build:pages`
  - Passed with the existing Vite large-chunk warning and regenerated `docs/`.

Resident render no-full-readback publication checkpoint,
2026-06-12 11:58 AKDT:

- `node --check src/runtime/sph/sphRenderGpuKernel.js`
  - Passed.
- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/sphRenderGpuKernel.test.mjs`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs --test-name-pattern "render row|render field|surface draw|no-full-readback|resident"`
  - Passed, `26/26`.
  - Covers resident render-row extraction without full CPU readback, retained
    render-row buffers, no-full render-field buffers, resident surface vertices,
    and surface draw buffers.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident|overlay|render|pressure|interface|surface"`
  - Passed, `17/17`.
  - Covers resident overlay ordering/retention, render-field visibility, vapor
    visibility, pressure/interface renderer contracts, and surface batching.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
  - Browser coverage now expects `resident-gpu-render-field` with render rows in
    `no-full-readback`, zero render-row CPU readback bytes, hot-loop
    no-full-readback, retained resident surface table metadata, and resident
    surface-draw buffers.
- Manual inline Playwright probes were attempted to sample scalar status and
  screenshots over time, but both hung in headless Chromium/SwiftShader before
  producing app samples. The exact probe processes were stopped; no inline
  probe process remained afterward.
- `npm run build`
  - Passed with the existing Vite large-chunk warning.

Resident playback motion and Three fallback cadence,
2026-06-12 13:26 AKDT:

- `node --check src/visualization/sphPhaseDemoMount.js && node --check tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs --test-name-pattern "surface vertices orient|surface vertices compact|surface draw metadata buckets"`
  - Passed, `27/27`.
  - Reconfirms the corrected surface normal orientation and resident surface
    draw metadata while the visible path is using Three/MarchingCubes fallback.
- `git diff --check`
  - Passed.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, about 1.6 minutes.
  - Browser coverage now accepts the Three fallback contract:
    `renderFieldReadback=true`, render-state
    `normalHotLoopReadbackFree=false`, material-interface fields may be
    `material-interface-field-ready`, render-field input may include
    product-event buffers, and primary H2O optics are still checked through the
    rendered material state.
- `npm run build`
  - Passed with the existing Vite large-chunk warning.
- `npm run build:pages`
  - Passed with the existing Vite large-chunk warning and regenerated `docs/`.
- Manual inline Chromium/WebGPU probe against `https://127.0.0.1:5173/?sph=1`
  - Passed.
  - Evidence: `t20` built `pressureRows=152`; `t60` continued from
    `previous-gpu-resident-output` with `nextStep=4`, `nextTime=0.002`,
    `maxDx=0.09532373398542404`, `motionStatus=motion-proven`, and render
    cadence `reason=resident-motion-proven-visual-refresh`; `t90` reached
    `nextStep=6`, `nextTime=0.003`, `maxDx=0.13504351675510406`, and remained
    visible through `resident-gpu-render-field`.

Resident authority and buffer lease contracts, 2026-06-12 17:52 AKDT:

- `node --check src/runtime/residentStateAuthority.js`
  - Passed.
- `node --check src/runtime/residentBufferLease.js`
  - Passed.
- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  - Passed.
- `node --test tests/residentBufferLease.test.mjs tests/residentStateAuthority.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/chemistryReactionCandidates.test.mjs`
  - Passed, `28/28`.
  - Covers resident state-family ownership, product-event buffer lease guards,
    no-op reaction ownership, gas/product ownership, no-full-readback resident
    steps, repeated reaction handoffs, and the sedenion-scoping-adjacent
    reaction candidate baseline.

Resident render/pressure leases and stale mirror guards, 2026-06-12 AKDT:

- `node --check src/runtime/sph/sphRenderGpuKernel.js`
  - Passed.
- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident|overlay|render|pressure|interface|surface"`
  - Passed, `44/44`.
  - Covers retained surface-draw buffer leases, resident overlay behavior,
    pressure/interface renderer contracts, render-field residency, and surface
    batching.
- `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "stale CPU|ping-pong unread|resident no-full|cleanup preserves|merges carried"`
  - Passed, `18/18`.
  - Covers stale CPU mirror rejection, stale mirrors accepted only with retained
    GPU uploads in no-full-readback resident mode, product-event leases, and
    repeated unread buffer ping-pong.
- `node --test tests/residentBufferLease.test.mjs tests/residentStateAuthority.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/chemistryReactionCandidates.test.mjs`
  - Passed, `74/74`.
  - Combined focused safety net for authority ledgers, buffer leases, resident
    MLS-MPM stepping, retained render buffers, renderer pressure/interface
    contracts, and reaction candidate baseline behavior.
- `npm run build`
  - Passed with Vite's existing large-chunk warning.

Resident pressure-interface state authority split, 2026-06-12 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "pressure interface state|resident|overlay|render|pressure|interface|surface"`
  - Passed, `18/18`.
  - Covers the new `peercompute.ulg.sph-resident-pressure-interface-state.v0`
    summary, resident pressure authority fields, retained force-row upload
    metadata, renderer pressure/interface contracts, and surface/overlay
    contracts.
- `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "pressure|resident|overlay|render|surface|stale CPU|ping-pong unread|no-full|cleanup preserves|merges carried"`
  - Passed, `63/63`.
  - Reconfirms MLS-MPM pressure-force-row consumption, no-full resident steps,
    stale CPU mirror guards, retained render buffers, and the new pressure-state
    summary. Also covers that scene-level transient pressure-row consumer lease
    wiring does not regress the resident/render pressure contracts.

Render-field and surface-vertex retained-buffer leases, 2026-06-12 AKDT:

- `node --check src/runtime/sph/sphRenderGpuKernel.js`
  - Passed.
- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs --test-name-pattern "retained buffer|retained buffers|surface draw WebGPU builder|render field optional|surface vertices"`
  - Passed, `29/29`.
  - Covers lease-guarded retained render-field buffers, retained surface-vertex
    buffers, retained surface-draw buffers, and existing resident no-full render
    field/surface extraction behavior.
- `node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "pressure|resident|overlay|render|surface|stale CPU|ping-pong unread|no-full|cleanup preserves|merges carried|retained buffer|retained buffers"`
  - Passed, `65/65`.
- `git diff --check`
  - Passed.
- `npm run build`
  - Passed with Vite's existing large-chunk warning.

Compact-summary diagnostics lease, 2026-06-12 AKDT:

- `node --check src/runtime/sph/sphMlsMpmGpuSummary.js`
  - Passed.
- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "compact summary|resident summary|resident no-full|ping-pong unread|cleanup preserves|stale CPU|pressure"`
  - Passed, `18/18`.
  - Covers the compact summary readback path reporting a cleaned
    diagnostics-only lease ledger while preserving resident pressure and
    no-full-readback contracts.
- `node --check src/runtime/sph/sphMlsMpmGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "pressure|resident|overlay|render|surface|stale CPU|ping-pong unread|no-full|cleanup preserves|merges carried|retained buffer|retained buffers|compact summary|resident summary"`
  - Passed, `65/65`.
- `git diff --check`
  - Passed.
- `npm run build`
  - Passed with Vite's existing large-chunk warning.

Local queue-completion evidence, 2026-06-12 AKDT:

- `node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/runtime/sph/sphMlsMpmGpuSummary.js && node --test tests/sphGridUpdateGpuKernel.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "queue|pressure|compact summary|resident summary|retained buffer|retained buffers|surface draw WebGPU builder|render field retained|surface vertices retained"`
  - Passed, `57/57`.
  - Covers explicit `queueCompletionStatus` and `queueCompletionMethod` on the
    grid-update no-full paths, render-field retained-buffer path,
    surface-vertex retained-buffer path, surface-draw WebGPU builder, and
    compact resident summary readback.
  - Evidence is local to these kernels: completion is recorded from
    `mapAsync(readback-buffer)` when readback occurs and from
    `queue.onSubmittedWorkDone()` when a no-readback path can fence the queue.
    PeerCompute-distributed GPU worker fence semantics remain a future contract.
- `node --check src/runtime/sph/sphMlsMpmGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --test tests/sphGridUpdateGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "queue|pressure|resident|overlay|render|surface|stale CPU|ping-pong unread|no-full|cleanup preserves|merges carried|retained buffer|retained buffers|compact summary|resident summary"`
  - Passed, `75/75`.
  - Rechecks queue evidence together with pressure-state authority, stale CPU
    mirror guards, retained render buffers, retained pressure rows, and compact
    summary non-authority.
- `git diff --check`
  - Passed.
- `npm run build`
  - Passed with Vite's existing large-chunk warning.
- `npm run icc:update`
  - Passed, `219` indexed files and `922` memory chunks after the final
    material-interface/e2e documentation update.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo ulg --check-staleness`
  - Passed, `is_stale: false`.

Product-event merge queue evidence, 2026-06-12 AKDT:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "merges carried|cleanup preserves|resident no-full|ping-pong unread|compact summary|pressure|queue"`
  - Passed, `18/18`.
  - Covers resident product-event merge/copy queue evidence on the merged
    product-mass handle and resident-step envelope. The fake WebGPU queue now
    exposes `queue.onSubmittedWorkDone()`, and the merge test asserts
    `queue-work-completed` before the merged buffer is carried into
    `nextParticleUploads`.
- `node --check src/runtime/sph/sphMlsMpmGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --test tests/sphGridUpdateGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "queue|pressure|material interface|source field|resident|overlay|render|surface|stale CPU|ping-pong unread|no-full|cleanup preserves|merges carried|retained buffer|retained buffers|compact summary|resident summary"`
  - Passed, `76/76`.
  - Rechecks product-event merge queue evidence with resident authority ledgers,
    pressure/material-interface state, render leases, and compact-summary
    diagnostics-only lease cleanup.

Scene pressure-upload queue/cleanup evidence, 2026-06-12 AKDT:

- `node --check src/visualization/sphPhaseScene.js && node --check tests/demo.e2e.mjs && node --check tests/sphPhaseRenderer.test.mjs && node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "pressure interface state|resident overlay|render"`
  - Passed, `18/18`.
  - Covers retained pressure force-row upload queue/cleanup fields flowing
    through `buildSphResidentPressureInterfaceStateSummary()`.
- `node --check src/runtime/sph/sphMlsMpmGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --test tests/sphGridUpdateGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "queue|pressure|material interface|source field|resident|overlay|render|surface|stale CPU|ping-pong unread|no-full|cleanup preserves|merges carried|retained buffer|retained buffers|compact summary|resident summary"`
  - Passed, `76/76`.
  - Rechecks pressure upload evidence with resident grid update, resident
    pressure state, material-interface state, and render/lease diagnostics.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, about `2.3m`.
  - Browser WebGPU coverage confirms the resident render-state summary exposes
    pressure force-row upload queue evidence while derived material properties
    and resident pressure coupling remain ready.
- `git diff --check`
  - Passed.
- `npm run build`
  - Passed with Vite's existing large-chunk warning.
- `npm run icc:update`
  - Passed, `219` indexed files and `923` memory chunks after pressure-upload
    evidence and documentation updates.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo ulg --check-staleness`
  - Passed, `is_stale: false`.

PeerCompute distributed GPU fence admission contract, 2026-06-12 AKDT:

- In `/home/cos/projects/peercompute`:
  `node --check peercompute/src/peercompute/computeManager/ComputeManager.js && node --check peercompute/tests/unit/computeManager.commitDelta.test.js && node --test peercompute/tests/unit/computeManager.commitDelta.test.js --test-name-pattern "GPU fence|remote placement"`
  - Passed, `16/16`.
  - Covers `peercompute.compute.gpu-fence-report.v0`, task-packet GPU fence
    requirements, remote provenance normalization, accepted satisfied fence
    reports, and rejection before commit when a required fence report is
    missing.
- In `/home/cos/projects/peercompute`:
  `node --test peercompute/tests/computeManager.unit.test.js peercompute/tests/unit/computeManager.commitDelta.test.js peercompute/tests/unit/computeManager.wasm.test.js peercompute/tests/unit/computeManager.worker.test.js`
  - Passed, `27/27`.
  - Rechecks the new fence gate with existing inline, worker, WASM,
    WASM-WebGPU, commit-delta, task-envelope, and remote-placement behavior.
- In `/home/cos/projects/peercompute`:
  `git diff --check && npm --prefix /home/cos/projects/peercompute/peercompute run build`
  - Passed. The PeerCompute webpack build still reports its existing circular
    chunk and large bundle warnings.

Physics-owned material-interface extraction slice, 2026-06-12 AKDT:

- `node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --test tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "material interface|pressure interface state|retained buffer|render field retained|surface draw"`
  - Passed, `48/48`.
  - Covers `buildSphPhysicsMaterialInterfaceFieldWebGpu()` consuming retained
    field/surface buffers, stamping physics-stage authority metadata, and
    preserving pressure-interface state behavior.
  - Scope limit: this moves material-interface authority/cadence out of visible
    rendering, but the source scalar field still reuses the existing field
    kernel and interface candidate rows still read back for CPU compaction.
- `node --check src/runtime/sph/sphMlsMpmGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --test tests/sphGridUpdateGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "queue|pressure|material interface|resident|overlay|render|surface|stale CPU|ping-pong unread|no-full|cleanup preserves|merges carried|retained buffer|retained buffers|compact summary|resident summary"`
  - Passed, `76/76`.
  - Rechecks material-interface authority with pressure rows, resident
    no-full-readback paths, queue evidence, render leases, and compact summary
    non-authority.
- `git diff --check`
  - Passed.
- `npm run build`
  - Passed with Vite's existing large-chunk warning.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - First run exposed an e2e readiness race after Reset: the wait accepted a
    WebGPU resident step while render state was still `cpu-particles pending`.
  - After fixing the wait to require `resident-gpu-render-field` for WebGPU
    resident runs, the rerun passed, `1/1`, about `2.2m`.

Material-interface source-field ABI wrapper, 2026-06-12 AKDT:

- `node --check ulg-gpu-abi/src/index.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check tests/abi.test.mjs && node --test tests/abi.test.mjs tests/sphRenderGpuKernel.test.mjs --test-name-pattern "render field ABI|material interface|physics material interface|source field"`
  - Passed, `47/47`.
  - Covers `peercompute.ulg.sph-material-interface-source-field.v0`, retained
    source-field buffer lease cleanup, and the physics material-interface
    extractor consuming the source wrapper instead of ad hoc render-field buffer
    parameters.
- `node --check src/runtime/sph/sphMlsMpmGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --test tests/sphGridUpdateGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "queue|pressure|material interface|source field|resident|overlay|render|surface|stale CPU|ping-pong unread|no-full|cleanup preserves|merges carried|retained buffer|retained buffers|compact summary|resident summary"`
  - Passed, `76/76`.
- `git diff --check`
  - Passed.
- `npm run build`
  - Passed with Vite's existing large-chunk warning.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, about `2.3m`.

Material-interface authority status overlay, 2026-06-12 AKDT:

- `node --check src/visualization/sphPhaseDemoMount.js && node --check tests/demo.e2e.mjs && node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "pressure interface state|resident overlay|render"`
  - Passed, `18/18`.
- `node --check src/runtime/sph/sphMlsMpmGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --test tests/sphGridUpdateGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "queue|pressure|material interface|source field|resident|overlay|render|surface|stale CPU|ping-pong unread|no-full|cleanup preserves|merges carried|retained buffer|retained buffers|compact summary|resident summary"`
  - Passed, `76/76`.
- `git diff --check`
  - Passed.
- `npm run build`
  - Passed with Vite's existing large-chunk warning.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, about `2.3m`, including the new `material iface  :`
    status assertion.

ULG resident SPH GPU lane adapter, 2026-06-12 AKDT:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  - Passed.
- `node --check tests/sphMlsMpmGpuStep.test.mjs`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs`
  - Passed, `19/19`.
  - Covers optional GPU resident lane acquire/complete evidence on a no-full
    resident WebGPU step and lease rejection when WebGPU device acquisition
    fails.
- `node --check src/runtime/sph/sphMlsMpmGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --test tests/sphGridUpdateGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "queue|pressure|material interface|source field|resident|overlay|render|surface|stale CPU|ping-pong unread|no-full|cleanup preserves|merges carried|retained buffer|retained buffers|compact summary|resident summary|GPU resident lane"`
  - Passed, `77/77`.
  - Rechecks the new lane adapter with resident authority ledgers, material
    interface state, pressure rows, retained render buffers, queue evidence,
    stale CPU guards, and compact-summary non-authority.
- `git diff --check`
  - Passed.
- `npm test`
  - Passed, `436/436`.
- `npm run build`
  - Passed with Vite's existing large-chunk warning.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5273 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5273 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5273 --strictPort' PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, about `2.3m`.
  - Ran on an isolated port because an existing listener on `5173` returned
    `ERR_EMPTY_RESPONSE` to `npm run status:live`.

Resident surface overlay policy and bounded probe timeout, 2026-06-13 AKDT:

- `node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --check scripts/sph-long-horizon-probe.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident overlay|overlay policy|surface radius|render field|surface"`
  - Passed, `21/21`.
- `node --test tests/sphRenderGpuKernel.test.mjs --test-name-pattern "surface draw|surface vertices|render field"`
  - Passed, `30/30`.
- `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5203 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&surfaceOverlay=1' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=1 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=30000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-overlay-forced-bounded.json node scripts/sph-long-horizon-probe.mjs`
  - Expected blocker captured: result `bad`, timeline `blocked`, reason
    `browser probe timed out after 30000ms`.
- `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5205 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=4 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=120000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-default-policy.json node scripts/sph-long-horizon-probe.mjs`
  - Passed/classified `good`.
  - Key evidence: overlay policy `surface-draw-overlay-disabled-by-policy`,
    bridge `three-marching-cubes`, render-field readback `true`, H2O active
    draw count `840`, `maxVisibleSurfaceOutsideM=0`, applied pressure impulse
    `0`, and J `0.9997479..1.0`.
- `git diff --check`
  - Passed.
- `npm test`
  - Passed, `457/457`.
- `npm run build`
  - Passed with Vite's existing large-chunk warning.
- `npm run icc:update`
  - Passed with `224` indexed files and `982` memory chunks.

Pressure/gas regression worktree search and current scene recheck, 2026-06-13 AKDT:

- `git worktree add --detach /tmp/ulg-regression-1781349875/f0d101f f0d101f`
  and `git worktree add --detach /tmp/ulg-regression-1781349875/c81a66a c81a66a`
  - Created isolated historical checkouts without touching the dirty working
    tree.
- `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/tmp/ulg-regression-1781349875/c81a66a ULG_PROBE_PORT=5211 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=16 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=120000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/c81a66a-h2o-scene-16.json node scripts/sph-long-horizon-probe.mjs`
  - Failed/classified `bad`.
  - Key evidence: `visible-surface-outside-box`,
    `visible-surface-larger-than-box`, `maxVisibleSurfaceOutsideM=1.3088627`,
    pressure rows `302`, consumer
    `grid-momentum-impulse-submitted-unverified-no-full-readback`,
    max speed `20.7157 m/s`, and J `0.509843..1.372338`.
- `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5212 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=16 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=180000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-scene-16-after-gates.json node scripts/sph-long-horizon-probe.mjs`
  - Passed/classified `good`.
  - Key evidence: pressure rows `0`, consumer
    `blocked-pressure-force-rows-unavailable`, max speed `0.156908 m/s`, J
    `0.999495..1.0`, active nodes `280`, `maxVisibleSurfaceOutsideM=0`, overlay
    policy `surface-draw-overlay-disabled-by-policy`, and active H2O draw count
    `840`.
- `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/tmp/ulg-regression-1781349875/f0d101f ULG_PROBE_PORT=5210 ...`
  - Not used as a clean separated-H2O/H2O comparator: the older page path
    mapped the URL into an Fe/H2O case and reports `J=0.1`/inactive nodes under
    today probe assumptions.

Resident compact COM/bounds diagnostics, 2026-06-13 AKDT:

- `node --check ulg-gpu-abi/src/index.js && node --check ulg-gpu-abi/src/wgsl.js && node --check src/runtime/sph/sphMlsMpmGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check scripts/sph-long-horizon-probe.mjs && node --check tests/demo.e2e.mjs && node --check tests/sphMlsMpmGpuStep.test.mjs`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "summary|copy budget|GPU resident lane|compact|compute task|reaction from retained"`
  - Passed, `25/25`.
  - Covers the expanded `224` byte MLS-MPM resident compact summary, COM/AABB
    decode, copy-budget propagation, resident lane byte accounting, and
    reaction summary byte-size separation.
- `ULG_PROBE_MODE=direct-resident ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5213 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=16 ULG_PROBE_TIMEOUT_MS=120000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-direct-16-com-bounds.json node scripts/sph-long-horizon-probe.mjs`
  - Passed/classified `good`.
  - Key evidence: COM and position bounds present in resident diagnostics,
    pressure rows `0`, max speed `0.0784546 m/s`, J `0.9998219..1.0`,
    `nextPositionBoundsM.status=position-bounds-ready`, and next Y bounds
    `0.0999236..2.9163332 m`.
- `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5214 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=16 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=180000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-scene-16-com-bounds.json node scripts/sph-long-horizon-probe.mjs`
  - Passed/classified `good`.
  - Key evidence: pressure rows `0`, max speed `0.235361 m/s`, J
    `0.999142..1.0`, `maxVisibleSurfaceOutsideM=0`,
    `nextCenterOfMassYDeltaM=-0.0013416`, and next Y bounds
    `0.0995834..2.9163332 m`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 ULG_SPH_VISUAL_CAPTURE=1 ULG_SPH_VISUAL_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_SPH_VISUAL_LABEL='h2o-h2o-separated-current-after-pressure-gate' ULG_SPH_VISUAL_FRAMES=6 ULG_SPH_VISUAL_INTERVAL_MS=250 ULG_SPH_VISUAL_TIMEOUT_MS=300000 npm run test:e2e -- --grep "SPH phase visual sequence"`
  - Passed, `1/1`, about `1.2m`.
  - Artifacts:
    `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-separated-current-after-pressure-gate/`.
  - Timeline evidence: canvas frame capture, GIF/WebM assembled, pressure rows
    `0`, visible H2O bounded, but `captureCadence.status=slow-capture-cadence`
    with mean interval about `6708 ms` for a `250 ms` target.

Current-render H2O/H2O merge/render-field validation, 2026-06-13 AKDT:

- `node --check src/visualization/sphPhaseScene.js && node --check tests/sphPhaseRenderer.test.mjs && node --check tests/sphRenderGpuKernel.test.mjs && node --check tests/demo.e2e.mjs`
  - Passed.
- `git diff --check`
  - Passed.
- `npm test`
  - Passed, `477/477`.
- `npm run icc:update`
  - Passed, `224` indexed files and `1024` memory chunks.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "same-material|resident render fields|surface radius|hysteresis|inactive grace"`
  - Passed, `25/25`.
- `node --test tests/sphRenderGpuKernel.test.mjs --test-name-pattern "render domain|domain zero|sparse same-material|render field CPU"`
  - Passed, `35/35`.
- `ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/reassess-07-scene-all-laws-tight-long-no-stale.json ULG_PROBE_BATCHES=8 ULG_PROBE_BATCH_STEPS=64 ULG_PROBE_RENDER_EVERY=2 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=full-parity-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=full-parity-readback ULG_PROBE_MIN_J=0.95 ULG_PROBE_MAX_J=1.05 node scripts/sph-long-horizon-probe.mjs`
  - Failed as expected after stale detached surfaces were hidden: issue
    `same-material-h2o-visible-surface-disappeared`, but particle invariants
    stayed sane (`J=0.998721..1.008176`, pressure impulse `0`).
- `ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/reassess-08-scene-all-laws-tight-long-merged-same-material.json ULG_PROBE_BATCHES=8 ULG_PROBE_BATCH_STEPS=64 ULG_PROBE_RENDER_EVERY=2 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=full-parity-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=full-parity-readback ULG_PROBE_MIN_J=0.95 ULG_PROBE_MAX_J=1.05 node scripts/sph-long-horizon-probe.mjs`
  - Failed as stale-cadence evidence after same-material render-domain merge:
    issue `visible-surface-expanded-beyond-particle-bounds`,
    `maxVisibleSurfaceOutsideParticleBoundsM=0.054612`.
- `ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/reassess-09-scene-all-laws-tight-long-render-every-batch.json ULG_PROBE_BATCHES=8 ULG_PROBE_BATCH_STEPS=64 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=full-parity-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=full-parity-readback ULG_PROBE_MIN_J=0.95 ULG_PROBE_MAX_J=1.05 node scripts/sph-long-horizon-probe.mjs`
  - Failed as current-render aliasing evidence: issue
    `same-material-h2o-visible-surface-disappeared`, merged H2O
    `maxDensity=31.198 < isolation=80` at the bad sample.
- `ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/reassess-10-scene-all-laws-tight-long-merged-res32-render-every-batch.json ULG_PROBE_BATCHES=8 ULG_PROBE_BATCH_STEPS=64 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=full-parity-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=full-parity-readback ULG_PROBE_MIN_J=0.95 ULG_PROBE_MAX_J=1.05 node scripts/sph-long-horizon-probe.mjs`
  - Passed/classified `good`.
  - Evidence: `512` requested substeps, `maxNextTimeS=0.264 s`,
    `J=0.998677..1.008176`, pressure impulse `0`, H2O visible in all `9`
    samples, no visual surface issues, `maxVisibleSurfaceOutsideParticleBoundsM=0`,
    drop COM `1.2498 -> 0.9031 m`, and support gap
    `-0.0001686 -> -0.064634 m`.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5297 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5297 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5297 --strictPort' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 ULG_SPH_VISUAL_CAPTURE=1 ULG_SPH_VISUAL_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_SPH_VISUAL_LABEL='h2o-h2o-valid-merged-res32-current-render-pass' ULG_SPH_VISUAL_FRAMES=3 ULG_SPH_VISUAL_INTERVAL_MS=250 ULG_SPH_VISUAL_TIMEOUT_MS=300000 npm run test:e2e -- --grep "SPH phase visual sequence" --timeout 300000`
  - Passed, `1/1`.
  - Artifacts:
    `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-valid-merged-res32-current-render-pass/`.
  - Timeline: `3` frames, WebGPU resident backend, visible H2O in all frames,
    pressure impulse `0`, media assembled as GIF/WebM. Cadence remains slow
    (`meanIntervalMs=5187.65` for a `250 ms` target), so throughput remains a
    separate remediation item.

Atomic/visual reassessment after screenshot review, 2026-06-13 14:04 AKDT:

- `node --check src/runtime/sph/mlsMpmCarrier.js`
  - Passed.
- `node --check src/runtime/sphPhaseDemo.js`
  - Passed.
- `node --check tests/sphPhaseDemo.test.mjs`
  - Passed.
- `node --check tests/physicsBehaviorInvariants.test.mjs`
  - Passed.
- `npm run test:physics-atomics`
  - Passed: `5` pass, `1` skipped opt-in long-horizon liquid gate.
- `node --test tests/sphPhaseDemo.test.mjs`
  - Passed: `24/24`.
- `npm run test:physics-liquid-atomic`
  - Expected fail remains: after CPU/resident carrier-alignment fixes, H2O/H2O
    MLS-MPM still retains `1.6130091586080253 m/s` drop speed after
    `1.0239999999999427 s`, above the `0.25 m/s` acceptance.
- Law matrix evidence:
  - MLS-MPM `eos=true pressure=true` and `eos=true pressure=false` produce the
    same long-horizon H2O/H2O result, so gas/pressure coupling is not the
    proximate cause of this failure.
  - MLS-MPM `eos=false pressure=false` removes the high-speed spread by removing
    condensed incompressibility/pressure physics, so it is not an acceptable
    fix.
  - Plain SPH/PBF remains useful as a reference lane but still ends near
    `0.5259164978735411 m/s`, above the same `0.25 m/s` liquid acceptance.
- `ULG_SPH_VISUAL_CAPTURE=1 ... npx playwright test --config tests/playwright.config.mjs --grep "SPH phase visual sequence captures dense H2O/H2O resident motion"`
  - First run proved the harness can emit frame PNGs plus GIF/WebM/timeline
    artifacts against the live Vite server at `http://127.0.0.1:5174/`.
  - After strengthening the visual assertions, this gate now fails as intended:
    visible H2O liquid surfaces with `vertexCount` `72000` and `42000` report
    `worldBounds=null`, and the bounded H2O surface is a thin column of about
    `0.197 m x 2.681 m x 0.197 m`.
  - Artifact directory:
    `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/sph-h2o-h2o-resident-motion/`.

Current interpretation:

- The current P0 has two independent failing gates: the liquid physics
  long-horizon speed gate and the resident visual surface-bounds gate.
- `viscosity` and `surfaceTension` are explicit law groups now, defaulting off
  and reporting pending/unimplemented if enabled. They still need actual CPU and
  resident WebGPU implementations before the long-horizon liquid gate can pass.

Liquid-stability remediation validation, 2026-06-13 15:01 AKDT:

- `node --check src/runtime/sph/mlsMpmCarrier.js src/runtime/sph/sphGridUpdateGpuKernel.js src/runtime/sph/sphGridGpuKernel.js src/runtime/sph/sphGpuBuffers.js src/runtime/sph/sphMechanicsMaterialTable.js src/runtime/sph/sphMechanicsRefreshGpuKernel.js src/runtime/sphPhaseDemo.js src/visualization/sphPhaseScene.js ulg-gpu-abi/src/index.js ulg-gpu-abi/src/wgsl.js`
  - Passed.
- `node --test tests/sphPhaseDemo.test.mjs tests/sphGpuBuffers.test.mjs tests/sphMechanicsRefreshGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed: `53/53`.
- `node --test tests/sphGridUpdateGpuKernel.test.mjs tests/sphGridGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `56/56`.
- `node --test tests/sphPhaseRenderer.test.mjs tests/sphRenderGpuKernel.test.mjs`
  - Passed: `60/60`.
- `npm run test:physics-atomics`
  - Passed: `5` pass, `1` skipped opt-in long-horizon liquid gate.
- `ULG_RUN_LONG_LIQUID_ATOMIC=1 npm run test:physics-liquid-atomic`
  - Passed: `6/6`; this is the first passing run for the prior long-horizon
    H2O/H2O speed gate.
- `ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.01&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=sph' ULG_PROBE_OUTPUT=/tmp/ulg-cpu-sph-visual-probe.json ULG_PROBE_PORT=5179 ULG_PROBE_BATCHES=5 ULG_PROBE_BATCH_STEPS=24 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_EXPECT_H2O_VISIBLE_SURFACE_COUNT=1 ULG_PROBE_FAIL_ON_BAD=1 node scripts/sph-long-horizon-probe.mjs`
  - Passed/classified `good`.
  - Evidence: `issues=[]`, `visualSurfaceIssues=[]`,
    `visibleSurfaceSampleCount=6`, `h2oVisibleSurfaceSampleCount=6`,
    `firstH2oVisibleSurfaceCount=2`, `lastH2oVisibleSurfaceCount=1`.
- `npm test`
  - Passed: `484` pass, `1` skipped.

Mounted Na/H2O resident gas-pressure promotion, 2026-06-13 20:31 AKDT:

- `node --check src/visualization/sphPhaseDemoMount.js && node --check scripts/sph-long-horizon-probe.mjs && node --check tests/demo.e2e.mjs`
  - Passed.
- `ULG_PROBE_MODE=scene ULG_PROBE_PORT=5636 ULG_PROBE_URL='/?drop=Na&base=h2o&dropt=293.15&baset=293.15&iceh=0&ironh=1.01&dropn=2&basen=4&boxx=4&boxy=4&boxz=4' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=1 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=full-parity-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=full-parity-readback ULG_PROBE_TIMEOUT_MS=180000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-na-h2o-mounted-1x1-promoted-gas.json node scripts/sph-long-horizon-probe.mjs`
  - Passed/classified `good`.
  - Resident gas summary source:
    `gpu-resident-product-mass-gas-species-ledger`; total pressure
    `125932.56 Pa`, H2 partial pressure about `24.6 kPa`.
  - Status text shows WebGPU reaction execution and retained product mass rows:
    `reaction-step-executed`, `rows=144`, `unplaced=1.61kg`,
    `eos=resident-product-mass-p2g-eos-sidecar-ready`.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5637 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5637 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5637 --strictPort' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "mounted resident Na/H2O promotes product gas pressure" --timeout 150000`
  - Passed, `1/1`.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5638 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5638 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5638 --strictPort' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "mounted resident Na/H2O promotes product gas pressure|no-full render refresh can skip compact surface summary readback|CPU-SPH view refreshes" --timeout 150000`
  - Passed, `3/3`.

Bounded retained surface-draw diagnostics, 2026-06-13 20:51 AKDT:

- `node --check src/visualization/sphPhaseScene.js && node --check scripts/sph-long-horizon-probe.mjs && node --check tests/demo.e2e.mjs`
  - Passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5641 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5641 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5641 --strictPort' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "retained surface draw diagnostics are budget-bounded" --timeout 150000`
  - Passed, `1/1`.
- `ULG_PROBE_MODE=scene ULG_PROBE_PORT=5642 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.01&dropn=2&basen=3&boxx=3&boxy=3&boxz=3' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=1 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_FIELD_SURFACE_SUMMARY_MODE=skip ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MODE=metadata ULG_PROBE_TIMEOUT_MS=120000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-surface-draw-diagnostic-budget-skip-small.json node scripts/sph-long-horizon-probe.mjs`
  - Passed/classified `good`.
  - Render state: `surfaceDrawDiagnosticMode=metadata`,
    `surfaceDrawDiagnosticsSkipped=true`,
    `surfaceDrawDiagnosticsSkipReason=surface-draw-diagnostic-field-cell-budget-exceeded`,
    `surfaceDrawDiagnosticFieldCellCount=272072`,
    render rows readback `false`, render field readback `false`, and render
    field surface summary readback `false`.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5643 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5643 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5643 --strictPort' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "mounted resident Na/H2O promotes product gas pressure|no-full render refresh can skip compact surface summary readback|retained surface draw diagnostics are budget-bounded|CPU-SPH view refreshes" --timeout 150000`
  - Passed, `4/4`.

Resident MLS-MPM floor-boundary/free-surface validation, 2026-06-17 12:45 AKDT:

- `node --test tests/sphGridUpdateGpuKernel.test.mjs`
  - Passed: `14/14`.
  - Covers the corrected floor boundary: the floor guard row is no-slip, while
    the first interior floor row remains free to carry liquid spreading velocity.
- Direct resident CPU-reference diagnostic for H2O/H2O MLS-MPM at `1.024 s`
  - Passed manually: `2048` resident split substeps, raw X/Z spread about
    `1.830 m`, Y spread about `0.688 m`, `J=1.0464..1.0490`, and max speed about
    `0.730 m/s`.
  - This matches the monolithic CPU oracle and replaces the previous resident
    under-spread of about `1.23 m`.
- `ULG_RUN_LONG_LIQUID_ATOMIC=1 node --test tests/physicsBehaviorInvariants.test.mjs --test-name-pattern "resident MLS-MPM H2O/H2O long-horizon"`
  - Passed: `14/14` in about `243 s`.
  - Node still ran the file's other long gates despite the name pattern; the new
    resident split H2O/H2O free-surface gate passed.
- `ULG_VISUAL_MATRIX_RUN_ID=codex-mlsmpm-free-surface-1s-floorfix-finalframe-20260617 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=4 ULG_VISUAL_MATRIX_BATCH_STEPS=512 ULG_VISUAL_MATRIX_FRAME_MAX=5 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=600000 ULG_PROBE_EXPECT_LIQUID_FREE_SURFACE=1 ULG_PROBE_LIQUID_FREE_SURFACE_MIN_TIME_S=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  - Passed: `failedCount=0`, no issue counts, no visual-surface issues.
  - Final metrics at `1.024 s`: H2O surface count `1`, tallness `0.440`,
    footprint fill `0.182`, height `0.938 m`, `maxVisibleSurfaceOutsideM=0`.
  - Frame artifacts:
    `/tmp/ulg-visual-sanity-matrix/codex-mlsmpm-free-surface-1s-floorfix-finalframe-20260617/liquid-liquid-h2o-mlsmpm-frames/`.
  - Manual frame inspection: final frame is still low-resolution/faceted, but no
    longer shows detached/nested/sticky water or bounds escape.

Mobile resident sphere bridge and viewport benchmark coverage, 2026-06-18 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check scripts/sph-long-horizon-probe.mjs`
  - Passed.
- `node --check scripts/sph-performance-benchmark.mjs`
  - Passed.
- `ULG_BENCH_OUTPUT=artifacts/sph-performance-benchmark-desktop-after-spheres.json ULG_BENCH_PARTICLE_COUNTS=1000 ULG_BENCH_BATCHES=1 ULG_BENCH_BATCH_STEPS=4 ULG_BENCH_PORT=5197 ULG_BENCH_FAIL_ON_ERROR=1 npm run bench:sph-performance`
  - Passed with report `status=complete`.
  - Scenario: `status=good`, `browserConsoleIssueCount=0`,
    `surfaceDrawBridge=three-render-row-points`,
    `fusedResidentMechanics=true`, actual particles `1024`, resident
    final-step `2.2 ms`, render-row readback `49152` bytes, and estimated
    readback `12288` bytes per resident step.
- `ULG_BENCH_OUTPUT=artifacts/sph-performance-benchmark-mobile-spheres.json ULG_BENCH_PARTICLE_COUNTS=152 ULG_BENCH_BATCHES=1 ULG_BENCH_BATCH_STEPS=4 ULG_BENCH_PORT=5198 ULG_BENCH_IS_MOBILE=1 ULG_BENCH_VIEWPORT_WIDTH=390 ULG_BENCH_VIEWPORT_HEIGHT=844 ULG_BENCH_DEVICE_SCALE_FACTOR=3 ULG_BENCH_FAIL_ON_ERROR=1 npm run bench:sph-performance`
  - Passed with report `status=complete`.
  - Scenario: `status=good`, `browserConsoleIssueCount=0`,
    `surfaceDrawBridge=three-render-row-spheres`,
    `fusedResidentMechanics=true`, actual particles `128`, resident
    final-step `1.6 ms`, render-row readback `6144` bytes, and estimated
    readback `1536` bytes per resident step.
- `ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&boxx=5&boxy=5&boxz=5&dropn=4&basen=4&mech=mlsmpm&residentAuto=0&residentFuseSequence=1&residentActiveGrid=1&visualCapture=1&surfaceDraw=three-render-row-spheres&blob=1' ULG_PROBE_OUTPUT=artifacts/sph-long-probe-mobile-h2o-spheres-after-cleanup.json ULG_PROBE_FRAME_DIR=artifacts/sph-long-probe-mobile-h2o-spheres-after-cleanup-frames ULG_PROBE_PORT=5199 ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=4 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_FIELD_SURFACE_SUMMARY_MODE=skip ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MODE=three-render-row-spheres ULG_PROBE_COMPACT_SUMMARY_SCOPE=particle-visual ULG_PROBE_FUSE_RESIDENT_MECHANICS_SEQUENCE=1 ULG_PROBE_FUSE_RESIDENT_ACTIVE_GRID=1 ULG_PROBE_VIEWPORT_WIDTH=390 ULG_PROBE_VIEWPORT_HEIGHT=844 ULG_PROBE_DEVICE_SCALE_FACTOR=3 ULG_PROBE_IS_MOBILE=1 ULG_PROBE_HAS_TOUCH=1 ULG_PROBE_FAIL_ON_BAD=0 node scripts/sph-long-horizon-probe.mjs`
  - Completed with `browserConsole.issueCount=0`,
    `renderState.backend=render-rows-three-sphere-bridge`,
    `surfaceDrawVisibleRendererBridge=three-render-row-spheres`,
    `surfaceDrawVisibleRenderSource=resident-render-rows-three-instanced-spheres`,
    `residentOverlayVisibleSampleCount=1`, and two captured mobile frames.
  - Probe classification remains `bad` only because no-full compact motion
    diagnostics are intentionally absent:
    `missing-max-speed`, `no-positive-displacement`.

Active-grid carry bounds and render-row bridge retention, 2026-06-18 03:30 AKDT:

- `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "active-grid bounds|carries active-grid bounds|active-grid dispatch"`
  - Passed: `54/54`.
  - Covers the no-full unread resident-batch carry path: zero-motion batches now
    keep the same active-grid node count instead of compounding the safety-cell
    halo into persisted resident bounds.
- `node --test tests/sphPhaseRenderer.test.mjs`
  - Passed: `35/35`.
  - Covers resident render retention for empty surface signatures, which is the
    Three render-row bridge case used by the MLS-MPM mounted path.
- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `ULG_BENCH_PROFILE=smoke ULG_BENCH_PROBE_MODE=scene ULG_BENCH_PARTICLE_COUNTS=128 ULG_BENCH_BATCHES=2 ULG_BENCH_BATCH_STEPS=4 ULG_BENCH_VIEWPORT_WIDTH=390 ULG_BENCH_VIEWPORT_HEIGHT=844 ULG_BENCH_DEVICE_SCALE_FACTOR=3 ULG_BENCH_IS_MOBILE=1 ULG_BENCH_HAS_TOUCH=1 ULG_BENCH_LAW_THERMAL=0 ULG_BENCH_LAW_REACTIONS=0 ULG_BENCH_LAW_SURFACE_TENSION=0 ULG_BENCH_COMPACT_SUMMARY_MODE=none ULG_BENCH_MEASURE_GPU_QUEUE_FENCE=1 ULG_BENCH_OUTPUT=artifacts/sph-performance-benchmark-mobile-render-retention.json node scripts/sph-performance-benchmark.mjs`
  - Passed with report `status=complete`.
  - Scenario: `status=good`, `browserConsoleIssueCount=0`,
    `surfaceDrawBridge=three-render-row-spheres`, active-grid dispatch
    `2744/27000`, queue-fenced resident stage `143.6 ms`, and render rows still
    `full-parity-readback`.

WebGPU render-row overlay fallback gate, 2026-06-18 04:25 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check scripts/sph-performance-benchmark.mjs`
  - Passed.
- `node --check scripts/sph-long-horizon-probe.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs`
  - Passed: `36/36`.
- `ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&boxx=5&boxy=5&boxz=5&dropn=4&basen=4&mech=mlsmpm&residentAuto=0&residentFuseSequence=1&residentActiveGrid=1&visualCapture=1&surfaceDraw=webgpu-render-row-points&blob=1' ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MODE=webgpu-render-row-points ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=no-full-readback ULG_PROBE_OUTPUT=artifacts/sph-long-probe-mobile-webgpu-request-fallback.json ULG_PROBE_FRAME_DIR=artifacts/sph-long-probe-mobile-webgpu-request-fallback-frames ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=2 ULG_PROBE_FAIL_ON_BAD=0 ULG_PROBE_VIEWPORT_WIDTH=390 ULG_PROBE_VIEWPORT_HEIGHT=844 ULG_PROBE_DEVICE_SCALE_FACTOR=3 ULG_PROBE_IS_MOBILE=1 ULG_PROBE_HAS_TOUCH=1 ULG_PROBE_PORT=5195 npm run probe:sph-long-horizon`
  - Completed with `browserConsole.issueCount=0`.
  - Effective bridge:
    `surfaceDrawDiagnosticMode=three-render-row-points`,
    `surfaceDrawRequestedDiagnosticMode=webgpu-render-row-points`,
    `surfaceDrawDiagnosticFallbackReason=webgpu-render-row-overlay-disabled-pending-pixel-validation`,
    `surfaceDrawVisibleRendererBridge=three-render-row-points`.
  - Captured frame
    `artifacts/sph-long-probe-mobile-webgpu-request-fallback-frames/0001-b001-resident-batch.png`
    is visible. Probe classification remains `bad` only because no-full compact
    motion proof is absent: `missing-max-speed`, `no-positive-displacement`.
- `ULG_BENCH_PROFILE=smoke ULG_BENCH_PROBE_MODE=scene ULG_BENCH_PARTICLE_COUNTS=128 ULG_BENCH_BATCHES=1 ULG_BENCH_BATCH_STEPS=2 ULG_BENCH_VIEWPORT_WIDTH=390 ULG_BENCH_VIEWPORT_HEIGHT=844 ULG_BENCH_DEVICE_SCALE_FACTOR=3 ULG_BENCH_IS_MOBILE=1 ULG_BENCH_HAS_TOUCH=1 ULG_BENCH_LAW_THERMAL=0 ULG_BENCH_LAW_REACTIONS=0 ULG_BENCH_LAW_SURFACE_TENSION=0 ULG_BENCH_COMPACT_SUMMARY_MODE=none ULG_BENCH_SURFACE_DRAW_MODE=webgpu-render-row-points ULG_BENCH_PORT=5195 ULG_BENCH_OUTPUT=artifacts/sph-performance-benchmark-webgpu-request-fallback.json node scripts/sph-performance-benchmark.mjs`
  - Passed with report `status=complete`.
  - Scenario: `status=good`, `browserConsoleIssueCount=0`,
    `surfaceDrawBridge=three-render-row-points`,
    requested mode `webgpu-render-row-points`, fallback reason above, and
    resident stage `2.5 ms`.
- `ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&boxx=5&boxy=5&boxz=5&dropn=4&basen=4&mech=mlsmpm&residentAuto=0&residentFuseSequence=1&residentActiveGrid=1&visualCapture=1&surfaceDraw=three-render-row-spheres&blob=1' ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MODE=three-render-row-spheres ULG_PROBE_OUTPUT=artifacts/sph-long-probe-mobile-three-spheres-post-fallback.json ULG_PROBE_FRAME_DIR=artifacts/sph-long-probe-mobile-three-spheres-post-fallback-frames ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=2 ULG_PROBE_FAIL_ON_BAD=0 ULG_PROBE_VIEWPORT_WIDTH=390 ULG_PROBE_VIEWPORT_HEIGHT=844 ULG_PROBE_DEVICE_SCALE_FACTOR=3 ULG_PROBE_IS_MOBILE=1 ULG_PROBE_HAS_TOUCH=1 ULG_PROBE_PORT=5195 npm run probe:sph-long-horizon`
  - Completed with `browserConsoleIssueCount=0`,
    `surfaceDrawVisibleRendererBridge=three-render-row-spheres`, and a visible
    mobile frame at
    `artifacts/sph-long-probe-mobile-three-spheres-post-fallback-frames/0001-b001-resident-batch.png`.

Scheduler resident fence and mobile render recovery, 2026-06-18 05:04 AKDT:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  - Passed.
- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "resident step fence accepts deferred cleanup|resident steps compute task handler returns fence evidence|fused resident sequence can run active-grid"`
  - Passed: `55/55`.
  - The new focused assertion covers
    `queue-submitted-cleanup-deferred` as satisfied only for retained WebGPU
    no-full resident chains.
- Mobile UI scheduler harness:
  `artifacts/scheduler-after-fence-fix-20260618/report.json`
  - Passed: resident scheduler error `null`, render error `null`.
  - Resident batch: `status=resident-steps-executed`, `backend=webgpu`,
    `completedStepCount=16`, `readbackMode=no-full-readback`,
    `computeExecution.gpuFenceSatisfied=true`, StateManager commit `accepted`.
  - Render: `surfaceDrawVisibleRendererBridge=three-render-row-spheres`,
    `surfaceDrawRenderBridgeStatus=three-render-row-spheres-ready`,
    `surfaceDrawRenderBridgeThreeMeshCount=1`.
  - Console: no WebGPU validation issues; remaining warnings were local HTTPS
    certificate and WebGL `ReadPixels` capture stalls.
- Mobile perspective/resize harness:
  `artifacts/scheduler-perspective-after-fence-fix-20260618/report.json`
  - Passed: portrait-initial, front-low, side-high, top, landscape-side, and
    portrait-return all kept `meshCount=1`, render errors `null`, and no
    WebGPU validation console issues.
  - Screenshot pixel statistics were nonblank for all captures, with means
    around `0.119..0.140`.
- Mobile HUD harness:
  `artifacts/mobile-hud-after-fence-fix-20260618/report.json`
  - Passed: `toggleFpsOverlap=false`, `toggleWarningOverlap=false`,
    render bridge `three-render-row-spheres`, `meshCount=1`, and no WebGPU
    validation console issues.

Three WebGPU presentation gate plus reset/PBR repair, 2026-06-18 12:56 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check scripts/sph-long-horizon-probe.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "renderer backend|extension surface renderer capability|external interleaved|surface draw|render-row sphere|depth policy"`
  - Passed: `43/43`.
  - Covers the WebGPU presentation-disabled capability gate and the
    low-luminance transmissive sphere proxy fallback used for mobile black-PBR
    reports.
- `node --test tests/sphPhaseDemoMountRemoteRefresh.test.mjs --test-name-pattern "reset gate"`
  - Passed: `5/5`.
- `ULG_PROBE_VISUAL_ONLY=1 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&boxx=5&boxy=5&boxz=5&dropn=4&basen=4&mech=mlsmpm&residentAuto=0&residentFuseSequence=1&residentActiveGrid=1&visualCapture=1&surfaceDraw=three-render-row-spheres&blob=1' ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MODE=three-render-row-spheres ULG_PROBE_OUTPUT=artifacts/sph-long-probe-mobile-three-spheres-reset-pbr-visual.json ULG_PROBE_FRAME_DIR=artifacts/sph-long-probe-mobile-three-spheres-reset-pbr-visual-frames ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=2 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=full-parity-readback ULG_PROBE_RENDER_FIELD_SURFACE_SUMMARY_MODE=skip ULG_PROBE_COMPACT_SUMMARY_MODE=none ULG_PROBE_COMPACT_SUMMARY_SCOPE=particle-visual ULG_PROBE_FUSE_RESIDENT_MECHANICS_SEQUENCE=1 ULG_PROBE_FUSE_RESIDENT_ACTIVE_GRID=1 ULG_PROBE_CAPTURE_FRAMES=1 ULG_PROBE_FRAME_MAX=3 ULG_PROBE_FAIL_ON_BAD=1 ULG_PROBE_VIEWPORT_WIDTH=390 ULG_PROBE_VIEWPORT_HEIGHT=844 ULG_PROBE_DEVICE_SCALE_FACTOR=3 ULG_PROBE_IS_MOBILE=1 ULG_PROBE_HAS_TOUCH=1 ULG_PROBE_PORT=5242 ULG_PROBE_TIMEOUT_MS=180000 npm run probe:sph-long-horizon`
  - Passed with `status=good`, `browserConsoleIssueCount=0`,
    `surfaceDrawVisibleRendererBridge=three-render-row-spheres`,
    `surfaceDrawRenderBridgeStatus=three-render-row-spheres-ready`, and three
    captured mobile frames.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase demo runs derived material properties by default"`
  - Passed: `1/1`.
  - This is the reset browser gate: it clicks `#sph-reset`, confirms static
    table cache reuse, waits for resident/render state to return, and asserts
    `resetStatus.status=particle-state-resynced-after-reset`.
- Three WebGPU presentation probes remain failing and are intentionally not
  promoted:
  - `artifacts/sph-probe-three-webgpu-surface-buffers-frame-pause-visual.json`
    reports `status=bad`, page error `Instance dropped in popErrorScope`, and
    `resident-render-rows-error` reason
    `A valid external Instance reference no longer exists.`

ULG marching-cubes extension preflight boundary, 2026-06-18 13:02 AKDT:

- In `/home/cos/projects/webgpu-marching-cubes`, `npm test`
  - Passed: `10/10`.
- In `/home/cos/projects/webgpu-marching-cubes`, `npm run smoke:adapter`
  - Passed with `ok=true`, `adapterStatus=adapter-ready`,
    `preflightStatus=ready`, `executionStatus=surface-ready`.
- In `/home/cos/projects/webgpu-marching-cubes`, `npm run build`
  - Passed with the known large-chunk warning.
- In `/home/cos/projects/webgpu-marching-cubes`, `git diff --check`
  - Passed.
- `node --check src/runtime/sph/sphMarchingCubesSurfaceAdapter.js`
  - Passed.
- `node --check tests/sphMarchingCubesSurfaceAdapter.test.mjs`
  - Passed.
- `node --test tests/sphMarchingCubesSurfaceAdapter.test.mjs`
  - Passed: `11/11`.
  - Covers ready extension preflight propagation and blocked preflight stopping
    extraction before renderer integration.

MLS-MPM dispatch topology contract, 2026-06-18 13:11 AKDT:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  - Passed.
- `node --check tests/sphMlsMpmGpuStep.test.mjs`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "fused no-full mechanics dispatch|active-grid fused no-full mechanics dispatch|fused mechanics sequence can opt into active-grid dispatch"`
  - Passed: `56/56`.
  - The assertions now prove the resident WebGPU fused hot path reports
    `dispatchTopologyStatus=resident-dispatch-topology-ready`,
    `cpuParticleLoopInHotPath=false`, P2G
    `particle-parallel-scatter`, G2P `particle-parallel-gather`, and
    active-grid finalize/update dispatch over `active-grid-node` axes when
    enabled.
- `ULG_PROBE_VISUAL_ONLY=1 ... ULG_PROBE_OUTPUT=artifacts/sph-long-probe-mobile-dispatch-topology-2.json ... npm run probe:sph-long-horizon`
  - Passed with `status=good`, `browserConsoleIssueCount=0`, three captured
    mobile frames, P2G `particle-parallel-scatter`, G2P
    `particle-parallel-gather`, and `cpuParticleLoopInHotPath=false`.
- `ULG_PROBE_MODE=direct-resident ULG_PROBE_DIRECT_RESIDENT=1 ULG_PROBE_VISUAL_ONLY=1 ... ULG_PROBE_OUTPUT=artifacts/sph-direct-resident-dispatch-topology-sequence.json ... npm run probe:sph-long-horizon`
  - Passed with `status=good`, `browserConsoleIssueCount=0`,
    `normalHotLoopReadbackFree=true`, `fusedResidentSequence=true`,
    `fusedResidentSequenceStepCount=2`, `totalDispatches=8`, P2G
    `particle-parallel-scatter`, G2P `particle-parallel-gather`, and
    active-grid finalize/update dispatch over `active-grid-node` axes.

Three WebGPU surface buffer capability gate, 2026-06-18 13:25 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/sphPhaseRenderer.test.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "renderer backend|extension surface renderer capability|external interleaved|surface draw"`
  - Passed: `43/43`.
  - The capability contract now blocks no-full-readback external GPUBuffer
    geometry as `same-device-gpu-buffer-geometry-blocked-three-webgpu-device-pending`
    until Three WebGPU exposes an initialized backend device, while still
    allowing the same-device bridge when renderer and resident devices match.

Three WebGPU presentation fail-closed, 2026-06-18 13:57 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/sphPhaseRenderer.test.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "renderer backend|renderer-owned resident|extension surface renderer capability|external interleaved|surface draw|sphere bridge|render-row"`
  - Passed: `44/44`.
  - Covers the explicit renderer-owned resident-device opt-in policy, the
    Three WebGPU presentation fail-closed gate, extension surface capability,
    and render-row bridge behavior.
- `ULG_PROBE_VISUAL_ONLY=1 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=2&basen=3&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=0&residentFuseSequence=1&residentActiveGrid=1&visualCapture=1&renderer=webgpu&rendererPresentation=1&surfaceDraw=three-webgpu-surface-buffers&blob=1' ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MODE=three-webgpu-surface-buffers ULG_PROBE_OUTPUT=artifacts/sph-probe-three-webgpu-surface-buffers-device-policy-4.json ULG_PROBE_FRAME_DIR=artifacts/sph-probe-three-webgpu-surface-buffers-device-policy-4-frames ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=1 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_FIELD_SURFACE_SUMMARY_MODE=skip ULG_PROBE_COMPACT_SUMMARY_MODE=none ULG_PROBE_COMPACT_SUMMARY_SCOPE=particle-visual ULG_PROBE_FUSE_RESIDENT_MECHANICS_SEQUENCE=1 ULG_PROBE_FUSE_RESIDENT_ACTIVE_GRID=1 ULG_PROBE_CAPTURE_FRAMES=1 ULG_PROBE_FRAME_MAX=3 ULG_PROBE_FAIL_ON_BAD=0 ULG_PROBE_PORT=5256 ULG_PROBE_TIMEOUT_MS=180000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-long-horizon`
  - Passed with `status=good`, `browserConsoleIssueCount=0`,
    `browserConsoleWarningCount=0`, and three captured frames.
  - Renderer evidence: requested backend `webgpu`, actual
    `rendererBackend=three-webgl`, `rendererPresentationBlocked=true`.
  - Surface evidence: requested draw `three-webgpu-surface-buffers`, effective
    draw `three-render-row-spheres`, fallback reason
    `same-device GPUBuffer geometry requires Three WebGPU renderer; current scene renderer is WebGLRenderer`,
    bridge status `three-render-row-spheres-ready`, and
    `renderBridgeEngineIntegration=three-renderer-owned-scene-object`.
  - Failed pre-fix evidence: `artifacts/sph-probe-three-webgpu-surface-buffers-device-policy-3.json`
    reached a console-clean page but stalled at
    `surface-vertices-full-readback-started`, so the final patch falls back at
    mode selection instead of compact/full-readback surface vertices.

Mounted worker-stage lane guard, 2026-06-18 14:24 AKDT:

- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5277 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5277 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "default PeerCompute resident authority host starts browser compute workers|mounted resident scheduler can publish worker-retained mechanics stage lane"`
  - Passed: `2/2`.
  - The first row proves `typeof Worker === "function"`, host
    `workerCapability.status=worker-capability-ready`, ComputeManager reports
    worker support and worker count, and the old worker fallback warning does
    not appear.
  - The second row runs the real mounted SPH phase scheduler with
    `residentStageWorkers=1`. It verifies the main resident batch still returns
    `state-manager-committed-inline-execution-returned` on `webgpu`, while the
    opt-in stage-worker lane publishes
    `worker-retained-mechanics-output-published`, records
    `worker-ready` residency for P2G/grid-update/G2P, stores the hot-buffer
    record, and reports
    `renderHandoffStatus=blocked-worker-gpu-handles-not-main-thread-renderable`.
  - The row fails on `Web Workers not available`, Worker bootstrap fallback,
    invalid WebGPU buffers/bind groups/command buffers, and WGSL parse errors;
    the issue list was empty.

Mounted worker-retained authority evidence, 2026-06-20 AKDT:

- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  - Passed.
- Syntax:
  `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- Syntax:
  `node --check tests/demo.e2e.mjs`
  - Passed.
- Focused Node stage-chain coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "stage-chain|lane stage|worker"`
  - Passed: `65/65`.
  - Covers the shared mechanics stage-lane summary after adding copy-budget
    and buffer byte-length fields.
- Worker module tests:
  `node --test tests/ulgMechanicsResidentStageWorker.test.mjs`
  - Passed: `6/6`.
  - Covers the worker module after adding source-side worker-stage copy-budget
    publication.
- Focused HTTPS browser gate:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase mounted resident scheduler can publish worker-retained mechanics stage lane"`
  - Passed: `1/1` in `20.2s`.
  - The mounted `residentStageWorkers=1` lane now proves
    `authorityHostSource=peercompute-browser-nodekernel-authority-host`,
    `gpuResidentLaneStageExecutionAuthorityPath=node-kernel-execution`,
    the mechanics stage lane contract schema, the read/write conflict policy,
    StateManager warm-delta admission for the worker-retained publication, and
    the same-worker retained-ref continuation plan.
  - The same gate still requires the worker-retained hot-buffer record to be
    stored with no main-thread local buffer refs and
    `renderHandoffStatus=blocked-worker-gpu-handles-not-main-thread-renderable`.
  - It also requires per-stage no-full readback modes, readback-free hot-loop
    flags, `stage-copy-budgets-recorded`, zero aggregate readback bytes,
    positive retained-budget bytes, and positive retained worker-stage buffer
    byte totals.

ULG extension output descriptor consumption, 2026-06-18 14:31 AKDT:

- `node --check src/runtime/sph/sphMarchingCubesSurfaceAdapter.js`
  - Passed.
- `node --check tests/sphMarchingCubesSurfaceAdapter.test.mjs`
  - Passed.
- `node --test tests/sphMarchingCubesSurfaceAdapter.test.mjs`
  - Passed: `12/12`.
  - New coverage builds an extension execution with only
    `result.outputDescriptors.rows.position`; there is no `rowMetadata` and no
    top-level `result.buffer`.
  - Evidence: summary reports
    `extensionOutputDescriptorSchema=peercompute.webgpu-marching-cubes.surface-output-descriptor.v0`,
    `extensionPositionRowsLayoutName=peercompute.webgpu-marching-cubes.layout.compact-position-f32x4.v0`,
    draw/indirect rows as not produced, material/PBR metadata available, and
    GPU translation binds the descriptor's retained compact position buffer.

Extension surface engine fallback, 2026-06-18 14:29 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/sphPhaseRenderer.test.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs`
  - Passed: `45/45`.
  - New coverage proves a WebGL/mobile renderer capability plans
    `extension-surface-render-plan-three-compact-fallback`,
    `translationReadbackMode=full-parity-readback`, and no raw overlay, while a
    same-device Three WebGPU renderer keeps
    `extension-surface-render-plan-three-webgpu-surface-buffers` with
    `translationReadbackMode=no-full-readback`.
- `node --check src/runtime/sph/sphMarchingCubesSurfaceAdapter.js`
  - Passed.
- `node --check tests/sphMarchingCubesSurfaceAdapter.test.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs tests/sphMarchingCubesSurfaceAdapter.test.mjs`
  - Passed: `57/57`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5277 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5277 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase no-full retained surface draw diagnostics build under budget without overlay"`
  - Failed: the browser row emitted no WebGPU validation errors, but the
    fixture reached `resident-render-surface-table-ready surfaces=0 cells=0`
    and failed the existing `surfaceDrawDiagnosticFieldCellCount > 0`
    assertion. The test assertion was not changed.

Reset resident render bridge cleanup, 2026-06-18 14:29 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs`
  - Passed: `45/45`.
  - The reset cleanup is a scene-closure resource invalidation fix: released
    surface draw bridges are now nulled from scene state even when no overlay
    canvas was present.

Particle-radius render metadata, 2026-06-18 14:29 AKDT:

- `node --check src/runtime/sphPhaseViewState.js`
  - Passed.
- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/sphPhaseDemo.test.mjs`
  - Passed.
- `node --check tests/sphPhaseRenderer.test.mjs`
  - Passed.
- `node --test tests/sphPhaseDemo.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed: `79/79`.
  - New assertions prove same-material/same-temperature drop/base particles
    carry matching `particleRadiiM` through the view state and that continuous
    surface batching consumes explicit per-particle radii instead of estimating
    radius from block bounds.

Three WebGPU unsafe presentation diagnostic gate, 2026-06-18 21:34 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check tests/sphPhaseRenderer.test.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs`
  - Passed: `53/53`.
  - New coverage proves the Three WebGPU presentation policy is fail-closed by
    default, can be enabled only through an unsafe diagnostic override, and
    still blocks when the renderer-owned resident-device path is not enabled.
- Unsafe browser diagnostic:
  `artifacts/sph-probe-three-webgpu-presentation-unsafe-diagnostic-1.json`
  - Expected diagnostic failure: `status=bad`.
  - Renderer reached `rendererBackend=three-webgpu`,
    `rendererPresentationPolicy.status=three-webgpu-presentation-enabled-unsafe-diagnostic`,
    `rendererDeviceSource=app-owned-resident-webgpu-device`, and
    `rendererBackendDeviceReady=true`.
  - Browser evidence still contains one page error:
    `Instance dropped in popErrorScope`, so this path remains blocked for
    normal mounted rendering.

Render-field direct-consumer handoff contract, 2026-06-18 21:56 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/sphPhaseRenderer.test.mjs`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `node --check scripts/sph-long-horizon-probe.mjs`
  - Passed.
- `node --check scripts/sph-performance-benchmark.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs`
  - Passed: `53/53`.
  - New coverage proves the resident handoff resolver accepts both compact
    `surface-draw-buffers` and lower-level `render-field-buffers`, and marks
    the latter as `requiresSurfaceExtraction=true`.
- Focused Playwright:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase no-full render refresh can skip compact surface summary readback"`
  - Passed: `1/1`.
- Browser probe:
  `artifacts/sph-probe-render-field-handoff-contract-1.json`
  - Completed with `browserConsoleIssueCount=0`.
  - Expected analysis status remains `bad` for no visible/motion evidence.
  - Contract evidence:
    `surfaceDrawGpuBufferHandoffKind=render-field-buffers`,
    `surfaceDrawGpuBufferHandoffInputSchema=peercompute.ulg.sph-gpu-render-field.v0`,
    `surfaceDrawGpuBufferHandoffRequiresSurfaceExtraction=true`,
    retained render-field rows `16777216` bytes, and retained surface buffer
    `256` bytes.

Native MC buffer-volume extraction and coordinate handoff, 2026-06-18 22:45 AKDT:

- `node --check src/runtime/sph/sphMarchingCubesSurfaceAdapter.js`
  - Passed.
- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphMarchingCubesSurfaceAdapter.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed: `68/68`.
  - Coverage proves the extension compact positions are translated from
    grid-local MC coordinates into ULG render-field world meters and that the
    resident surface-draw handoff still preserves renderer capability and
    fallback contracts.
- `git diff --check`
  - Passed.
- Focused Playwright:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH WebGPU extension surface translation maps MC grid positions|SPH phase no-full render refresh can skip compact surface summary readback"`
  - Passed: `2/2`.
  - Browser coverage verifies the native-MC/no-summary path and the transform
    shader path against the live HTTPS Vite server.

Direct renderer vertex-usage preflight, 2026-06-18 22:55 AKDT:

- `node --check src/runtime/sph/sphMarchingCubesSurfaceAdapter.js`
  - Passed.
- `node --check src/runtime/sph/sphRenderGpuKernel.js`
  - Passed.
- `node --check tests/sphMarchingCubesSurfaceAdapter.test.mjs`
  - Passed.
- `node --check tests/sphRenderGpuKernel.test.mjs`
  - Passed.
- `node --test tests/sphMarchingCubesSurfaceAdapter.test.mjs tests/sphRenderGpuKernel.test.mjs`
  - Passed: `62/62`.
  - Coverage asserts `GPUBufferUsage.VERTEX` on retained extension-native MC
    surface vertices and in-repo compact surface-draw vertex buffers.
- `node --test tests/sphPhaseRenderer.test.mjs`
  - Passed: `54/54`.
- Focused Playwright:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH WebGPU extension surface translation maps MC grid positions|SPH phase no-full render refresh can skip compact surface summary readback"`
  - Passed: `2/2`.
- `git diff --check`
  - Passed.

Native MC clamp and exact no-readback draw ranges, 2026-06-18 23:16 AKDT:

- `node --check src/runtime/sph/sphMarchingCubesSurfaceAdapter.js`
  - Passed.
- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphMarchingCubesSurfaceAdapter.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed: `69/69`.
  - New coverage proves the extension-to-ULG translator can clamp compact MC
    world positions into a supplied simulation box, preserves exact no-readback
    vertex/triangle ranges, widens the translation params buffer to 144 bytes,
    and carries conservative surface bounds for retained GPU draw buffers.
- Focused Playwright:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH WebGPU extension surface translation maps MC grid positions into ULG world meters|SPH phase no-full retained surface draw diagnostics build under budget without overlay"`
  - Passed: `2/2`.
- Focused Playwright:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase no-full render refresh can skip compact surface summary readback"`
  - Passed: `1/1`.
  - Browser coverage now asserts native MC no-summary handoff reports
    `position-clamp-ready`, exact retained vertex/triangle ranges, and
    conservative `[2.5,2.5,2.5]`/box-diagonal bounds for the 5m test box.

Three WebGPU surface-buffer diagnostic flag, 2026-06-18 23:25 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs`
  - Passed: `54/54`.
- Focused Playwright:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase records surface-buffer presentation opt-in without enabling WebGL external buffers" --reporter=line`
  - Passed: `1/1`.
  - Confirms `surfaceBufferPresentation=1` survives URL sync and is recorded
    as requested while WebGL correctly keeps external GPUBuffer presentation
    disabled/blocked.
- Manual unsafe diagnostic, not a passing acceptance gate:
  `renderer=webgpu&rendererPresentation=1&rendererResidentDevice=1&rendererPresentationUnsafe=1&surfaceBufferPresentation=1&surfaceDraw=three-webgpu-surface-buffers`
  - Same-device capability reached `same-device-gpu-buffer-geometry-supported`.
  - Page error: `Instance dropped in popErrorScope`.
  - Surface draw fell back to `resident-surface-draw-unavailable` before the
    external-buffer mesh bridge could bind retained MC rows.

Visible GPU consumer validation gate, 2026-06-19 00:55 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/sphPhaseRenderer.test.mjs`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs tests/sphMarchingCubesSurfaceAdapter.test.mjs`
  - Passed: `71/71`.
  - New coverage proves resident surface input handoff can be ready while the
    visible direct GPU consumer remains blocked on renderer capability or
    pixel validation.
- Focused Playwright:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH WebGPU extension surface translation maps MC grid positions|SPH phase no-full render refresh can skip compact surface summary readback"`
  - Passed: `2/2`.
  - Browser coverage asserts retained native-MC surface draw buffers are
    input-ready while
    `surfaceDrawVisibleGpuConsumerStatus=resident-surface-visible-gpu-consumer-blocked-renderer-capability`
    under the current engine-owned WebGL fallback.

Probe visible GPU consumer reporting, 2026-06-19 01:04 AKDT:

- `node --check scripts/sph-long-horizon-probe.mjs`
  - Passed.
- `node --check scripts/sph-performance-benchmark.mjs`
  - Passed.
- Visual-only browser probe:
  `ULG_PROBE_OUTPUT=/tmp/ulg-visible-gpu-consumer-visual-only-probe.json ULG_PROBE_PORT=5178 ULG_PROBE_TIMEOUT_MS=180000 ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=2 ULG_PROBE_RENDER_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_FIELD_SURFACE_SUMMARY_MODE=skip ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MODE=three-webgpu-surface-buffers ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_COMPACT_SUMMARY_MODE=none ULG_PROBE_VISUAL_ONLY=1 ULG_PROBE_FAIL_ON_BAD=0 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=290&baset=290&iceh=0&ironh=1.5&boxx=5&boxy=5&boxz=5&dropn=3&basen=5&mech=mlsmpm&lawmech=1&lawg=1&laweos=1&lawp=1&lawt=1&lawr=1&lawv=1&lawst=1&blob=1&residentFuseSequence=1&surfaceDrawMode=three-webgpu-surface-buffers&visualCapture=1&residentAuto=0' node scripts/sph-long-horizon-probe.mjs`
  - Expected bad status, isolated to
    `resident-surface-visible-gpu-consumer-not-ready`.
  - Browser console issues/warnings: `0/0`.
  - Resident surface-buffer handoff samples: `2`.
  - Resident visible GPU consumer samples: `0`.
  - Resident visible GPU consumer input-ready samples: `2`.
  - Last visible consumer status:
    `resident-surface-visible-gpu-consumer-blocked-surface-extraction-required`;
    input kind `render-field-buffers`; renderer capability
    `same-device-gpu-buffer-geometry-blocked-webgl-renderer`; pixel validation
    `not-run`.

Native WebGPU surface bridge diagnostics, 2026-06-19 10:27 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check scripts/sph-long-horizon-probe.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs`
  - Passed: `57/57`.
- `node --test tests/sphMarchingCubesSurfaceAdapter.test.mjs`
  - Passed: `17/17`.
- `git diff --check`
  - Passed.
- Browser probe:
  `/tmp/ulg-native-mlsmpm-native-renderer-diagnostics-probe.json`
  - Expected bad status because browser canvas pixels did not validate.
  - Browser console issues/warnings: `0/0`.
  - Native bridge status:
    `native-webgpu-surface-consumer-ready`.
  - Last render status:
    `native-webgpu-surface-consumer-rendered`.
  - Primary surface projected through the camera with center `[2.5,2.5,2.5]`,
    `inFront=true`, `centerInsideClip=true`, and `maybeVisible=true`.
  - Direct canvas center crop was transparent black.
- Browser probe:
  `/tmp/ulg-native-mlsmpm-native-renderer-raf2-probe.json`
  - Browser console issues/warnings: `0/0`.
  - `renderBridgeNativeSurfaceConsumerRafSustain=true`.
  - `renderBridgeLastNativeSurfaceConsumerRafScheduleReason=native-webgpu-surface-consumer-raf`.
  - Last sampled `renderBridgeFrameCount=2`; the probe samples before the next
    pending RAF has necessarily fired.
- Headless WebGPU limitation:
  native runtime pixel validation and a tiny standalone WebGPU clear smoke both
  reported `A valid external Instance reference no longer exists`. Do not use
  this headless run as final native surface-pixel acceptance.

Native canvas sizing diagnostics, 2026-06-19 11:16 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check scripts/sph-long-horizon-probe.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "native|visible GPU|surface draw|renderer backend"`
  - Passed: `57/57`.
- `git diff --check`
  - Passed.
- Browser probe:
  `/tmp/ulg-native-mlsmpm-native-renderer-sizing-probe.json`
  - Expected bad status because browser canvas pixels did not validate.
  - Browser console issues/warnings: `0/0`.
  - Native bridge rendered with CSS/backing canvas `1280x800`, DPR `1`, resize
    pixel ratio `1`, primary surface in frustum, and direct canvas frames all
    transparent black.
- Mobile-shaped browser probe:
  `/tmp/ulg-native-mlsmpm-native-renderer-mobile-sizing-probe.json`
  - Expected bad status because browser canvas pixels did not validate.
  - Browser console issues/warnings: `0/0`.
  - Viewport `390x844`, device scale factor `3`, native bridge rendered with
    CSS/client canvas about `397x860`, backing canvas `794x1720`, reported DPR
    `3`, clamped resize pixel ratio `2`, and primary surface in frustum.
- Standalone local-origin WebGPU clear smoke:
  - Failed with `A valid external Instance reference no longer exists`.
  - The screenshot was fully transparent black even for a simple green clear,
    confirming the local headless browser cannot prove native WebGPU
    presentation.

Reset generation fence and render-row lifecycle, 2026-06-19 10:50 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs`
  - Passed: `57/57`.
- `node --test tests/sphMarchingCubesSurfaceAdapter.test.mjs`
  - Passed: `17/17`.
- `git diff --check`
  - Passed.
- Focused browser reset harness:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase demo runs derived material properties by default" --timeout=60000`
  - Passed: `1/1`.
  - The reset summary now verifies
    `peercompute.ulg.sph-scene-resident-execution-invalidation.v0`, current
    resident execution generation, and generation propagation into
    `setParticles()` timing and resident steps progress.
  - Three render-row bridge submission status remains
    `three-render-row-points-submitted` or
    `three-render-row-spheres-submitted` after later render-loop skip attempts;
    skip status remains available separately for in-flight GPU work or missing
    WebGPU draw state.

Explicit particle render modes and closure-PBR spheres, 2026-06-19 12:41 AKDT:

- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check scripts/sph-long-horizon-probe.mjs`
  - Passed.
- `git diff --check -- src/visualization/sphPhaseDemoMount.js src/visualization/sphPhaseScene.js scripts/sph-long-horizon-probe.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "render-row sphere|visible GPU|surface draw|renderer backend|mobile"`
  - Passed: `58/58`.
  - New coverage pins the render-row sphere bridge contract to
    `variable-size-spheres`, `per-particle-radius`, and
    `closure-derived-pbr` or `closure-derived-pbr-proxied-for-renderer`.
- Browser probe:
  `/tmp/ulg-render-mode-spheres-probe.json`
  - Browser console issues: `0`.
  - Selected render mode: `three-render-row-spheres`.
  - Render-state mode: `three-render-row-spheres`.
  - Visible bridge: `three-render-row-spheres`.
  - Particle render mode: `variable-size-spheres`.
  - Sphere sizing: `per-particle-radius`.
  - Sphere PBR source: `closure-derived-pbr`.
  - Closure PBR flag: `true`.
  - Particle radius range: about `0.10339145m` to `0.10339173m`.
  - Expected non-rendering probe issues in this tiny run:
    `missing-max-speed`, `no-positive-displacement`.

Resident render-source freshness contract, 2026-06-19 14:00 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check scripts/sph-long-horizon-probe.mjs`
  - Passed.
- `git diff --check -- src/visualization/sphPhaseScene.js scripts/sph-long-horizon-probe.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "render source|visible GPU|surface buffer handoff|native"`
  - Passed: `60/60`.
  - New coverage verifies current resident render-source metadata and stale
    retained surface metadata.
- Browser probe:
  `/tmp/ulg-native-render-source-probe.json`
  - Passed with `status=good`.
  - Browser console issues/warnings: `0/0`.
  - Worker capability: ready, `12` workers.
  - Native bridge: `native-webgpu-surface-consumer-rendered`.
  - Surface draw source generation: current generation `2`, next step `8`,
    next time `0.004s`, retained previous `false`.
  - Analysis source evidence:
    `residentRenderSourceCurrentSampleCount=3`,
    `residentRenderSourceStaleSampleCount=0`,
    `residentRenderSourceStepDelta=4`,
    `residentRenderSourceTimeDeltaS=0.002`, and
    `residentNoReadbackRenderSourceEvidenceAvailable=true`.

Native surface clip-depth mapping, 2026-06-19 14:30 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check scripts/sph-long-horizon-probe.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident overlay shader|render source|visible GPU|surface buffer handoff|native|depth policy"`
  - Passed: `60/60`.
  - New coverage pins the native resident surface shader to the WebGPU
    clip-depth remap used by the particle WebGPU draw path.
- `git diff --check -- src/visualization/sphPhaseScene.js tests/sphPhaseRenderer.test.mjs scripts/sph-long-horizon-probe.mjs plan/log.md plan/tests.md`
  - Passed.
- Browser desktop-shaped native probe:
  `/tmp/ulg-native-depth-remap-probe.json`
  - Passed with `status=good`.
  - Browser console issues/warnings: `0/0`.
  - Native bridge: `native-webgpu-surface-consumer-rendered`.
  - Analysis source evidence:
    `residentRenderSourceCurrentSampleCount=3`,
    `residentRenderSourceStaleSampleCount=0`,
    `residentRenderSourceStepDelta=4`,
    `residentRenderSourceTimeDeltaS=0.002`, and
    `residentNoReadbackRenderSourceEvidenceAvailable=true`.

Benchmark active-grid telemetry repair, 2026-06-19 14:55 AKDT:

- `node --check scripts/sph-performance-benchmark.mjs`
  - Passed.
- Native no-full scene benchmark:
  `PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 ULG_BENCH_PROFILE=smoke ULG_BENCH_PARTICLE_COUNTS=1000 ULG_BENCH_BATCHES=2 ULG_BENCH_BATCH_STEPS=4 ULG_BENCH_SURFACE_DRAW_MODE=native-webgpu-surface-consumer ULG_BENCH_MEASURE_GPU_QUEUE_FENCE=1 ULG_BENCH_OUTPUT=/tmp/ulg-bench-native-active-grid-telemetry-fixed.json ULG_BENCH_PORT=5222 ULG_BENCH_TIMEOUT_MS=180000 npm run bench:sph-performance`
  - Passed with scenario `status=good` and browser console issues `0`.
  - Benchmark now reports `activeGridNodeCount=6156`,
    `activeGridNodeCountAvailable=true`,
    `activeGridNodeCountSource=active-grid-dispatch`,
    `activeGridRatio=0.06755555555555555`, and `gridNodeCount=91125`.
  - Copy/readback telemetry stayed clean:
    `renderRowsReadback=false`, `surfaceDrawReadback=false`, and
    `estimatedReadbackBytesPerStep=0`.

Native surface extraction timing split, 2026-06-19 15:25 AKDT:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`, and
  `node --check scripts/sph-performance-benchmark.mjs` passed.
- `git diff --check -- src/visualization/sphPhaseScene.js scripts/sph-performance-benchmark.mjs scripts/sph-long-horizon-probe.mjs`
  - Passed.
- Native no-full 10k-ish scene benchmark:
  `PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 ULG_BENCH_PROFILE=smoke ULG_BENCH_PARTICLE_COUNTS=10000 ULG_BENCH_BATCHES=2 ULG_BENCH_BATCH_STEPS=4 ULG_BENCH_SURFACE_DRAW_MODE=native-webgpu-surface-consumer ULG_BENCH_MEASURE_GPU_QUEUE_FENCE=1 ULG_BENCH_OUTPUT=/tmp/ulg-bench-native-10k-surface-timing-fixed.json ULG_BENCH_PORT=5226 ULG_BENCH_TIMEOUT_MS=240000 npm run bench:sph-performance`
  - Passed with scenario `status=good`, browser console issues `0`, and
    `estimatedReadbackBytesPerStep=0`.
  - Timing split: resident physics `9.2 ms`, native MC extraction
    `3762.6 ms`, ULG translation `1.2 ms`, render bridge build `0.6 ms`,
    total native surface refresh `3765.6 ms`.
- Browser mobile-shaped native probe:
  `/tmp/ulg-native-depth-remap-mobile-probe.json`
  - Passed with `status=good`.
  - Viewport/canvas evidence: viewport `397x860`, DPR `2`, canvas
    `794x1720`.
  - Browser console issues/warnings: `0/0`.
  - Native bridge: `native-webgpu-surface-consumer-rendered`.
  - Analysis source evidence:
    `residentRenderSourceCurrentSampleCount=3`,
    `residentRenderSourceStaleSampleCount=0`,
    `residentRenderSourceStepDelta=4`,
    `residentRenderSourceTimeDeltaS=0.002`, and
    `residentNoReadbackRenderSourceEvidenceAvailable=true`.

Active-grid plan-refresh cadence, 2026-06-19 16:30 AKDT:

- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`,
  `node --check scripts/sph-performance-benchmark.mjs`, and
  `node --check tests/sphMlsMpmGpuStep.test.mjs` passed.
- Focused tests:
  `node --test tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `60/60`.
  - New coverage proves thermal-blocked active-grid resident batches can defer
    intermediate plan-only summaries with
    `activeGridDispatchPlanRefreshMode=final-only`, then publish the next
    active-grid dispatch plan on the final step.
- Native no-full 10k-ish scene benchmark:
  `PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 ULG_BENCH_PROFILE=smoke ULG_BENCH_PARTICLE_COUNTS=10000 ULG_BENCH_BATCHES=3 ULG_BENCH_BATCH_STEPS=4 ULG_BENCH_SURFACE_DRAW_MODE=native-webgpu-surface-consumer ULG_BENCH_ACTIVE_GRID_PLAN_REFRESH_MODE=final-only ULG_BENCH_MEASURE_GPU_QUEUE_FENCE=1 ULG_BENCH_OUTPUT=/tmp/ulg-bench-native-10k-active-grid-plan-final-only.json ULG_BENCH_PORT=5246 ULG_BENCH_TIMEOUT_MS=240000 npm run bench:sph-performance`
  - Passed with scenario `status=good`, `probeStatus=good`, browser console
    issues `0`, and `estimatedReadbackBytesPerStep=0`.
  - Cadence telemetry: `activeGridDispatchPlanRefreshMode=final-only`,
    `activeGridDispatchPlanOnlyEligible=true`,
    `activeGridDispatchPlanOnlyRequested=true`,
    `activeGridDispatchPlanRefreshFinalStep=true`, and no skipped reason on
    the final sampled step.
  - Timing: actual particles `9826`, resident completed stage `9.9 ms`,
    thermal `0.3 ms`, mechanics refresh `0.5 ms`, compact plan-only summary
    `3.2 ms`, native extraction `2.7 ms`, ULG translation `1.6 ms`, bridge
    reused, and visible native GPU consumer ready.

Render-row particle scale guardrail, 2026-06-19 17:01 AKDT:

- Syntax:
  `node --check src/runtime/sph/sphRenderGpuKernel.js`,
  `node --check ulg-gpu-abi/src/wgsl.js`,
  `node --check tests/sphRenderGpuKernel.test.mjs`,
  `node --check src/visualization/sphPhaseScene.js`, and
  `node --check scripts/sph-long-horizon-probe.mjs` passed.
- Focused tests:
  `node --test tests/sphRenderGpuKernel.test.mjs`
  - Passed: `51/51`.
  - New coverage asserts a runaway MLS-MPM `J=1e9` render row is capped to
    radius-growth `4` and effective `J=64`, with cap diagnostics recording the
    material, phase, raw/effective growth, and reason.
- Physics atomics:
  `npm run test:physics-atomics`
  - Passed: `11/11`; the three long-horizon acceptance gates were skipped by
    their opt-in environment guard.
- Browser reaction/sphere probe:
  `PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 ... ULG_PROBE_OUTPUT=/tmp/ulg-reaction-particle-scale-cap-probe-bridge.json ... npm run probe:sph-long-horizon`
  - Passed with `status=good`, analysis `good`, and browser console issue
    count `0`.
  - Worker telemetry: `worker-capability-ready`, `workerCount=12`,
    `effectiveEnableWorkers=true`.
  - Rendering telemetry: `three-render-row-spheres`,
    `renderBridgeSphereClosurePbr=true`, material keys included `h2o`, `Na`,
    and `naoh`, min/max sphere radius `0.045373838394880295` /
    `0.5263000726699829`.
  - Scale telemetry: `renderRowsParticleScaleStabilityStatus =
    gpu-row-cap-policy-applied-in-shader`, max radius growth allowed `4`, max
    volume ratio `J=64`.

Particle sphere PBR metallic visibility, 2026-06-19 17:46 AKDT:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`, and
  `node --check tests/sphPhaseRenderer.test.mjs` passed.
- Focused tests:
  `node --test tests/sphPhaseRenderer.test.mjs`
  - Passed: `63/63`.
  - New coverage asserts a sodium-like fully metallic particle sphere is
    stabilized with a closure-derived visible proxy, records original PBR
    values and reason `metallic-sphere-visibility-proxy`, and leaves non-metal
    particle PBR outside that proxy.
- Physics atomics:
  `npm run test:physics-atomics`
  - Passed: `11/11`; the three long-horizon acceptance gates were skipped by
    their opt-in environment guard.
- Browser mobile-shaped sodium sphere probe:
  `/tmp/ulg-particle-pbr-na-mobile-spheres-probe.json`
  - Passed with `status=good`, analysis `good`, and browser console
    issues/warnings `0/0`.
  - Captured two nonblank canvas frames at mobile-shaped viewport
    `390x844`, DPR `2`.
  - Rendering telemetry: `three-render-row-spheres`, material keys `h2o`,
    `naoh`, and `Na`, sphere PBR source `closure-derived-pbr`,
    `renderBridgeSphereClosurePbr=true`,
    `renderBridgeSphereMetallicVisibilityProxyCount=1`,
    transmission proxy count `2`, fallback color count `1`, and min/max sphere
    radius `0.045374006032943726` / `0.5262995958328247`.

Air/Pd/Fe particle PBR audit, 2026-06-19 18:18 AKDT:

- Syntax:
  `node --check src/runtime/material/opticalClosure.js`,
  `node --check tests/opticalClosure.test.mjs`, and
  `node --check tests/opticalGpuBuffers.test.mjs` passed.
- Focused tests:
  `node --test tests/opticalClosure.test.mjs`
  - Passed: `10/10`.
  - New coverage proves `air` derives `gas-rayleigh-transparent-pbr`, high
    transmission, nonzero Rayleigh scattering samples, accepted material PBR
    policy, and nonblack base color.
  `node --test tests/opticalGpuBuffers.test.mjs`
  - Passed: `19/19`.
  - New coverage proves packed optical GPU rows and lookup decode air as an
    accepted transparent Rayleigh PBR record instead of blocked black.
  `node --test tests/sphPhaseRenderer.test.mjs`
  - Passed: `63/63`.
  `node --test tests/sphPhaseDemo.test.mjs`
  - Passed: `37/37`.
- Physics atomics:
  `npm run test:physics-atomics`
  - Passed: `11/11`; the three long-horizon acceptance gates were skipped by
    their opt-in environment guard.
- Material registry audit:
  Pd, Fe, Na, and Cs scenarios resolve H2O, air, selected conductor drops, and
  product materials (`naoh`, `csoh`) as nonblocked closure-derived PBR rows.
- Browser mobile-shaped sphere probes:
  `/tmp/ulg-particle-pbr-pd-mobile-spheres-probe.json`
  - Passed with `status=good`, analysis `good`, browser console
    issues/warnings `0/0`, one nonblank captured frame, material keys `h2o`
    and `Pd`, sphere PBR source `closure-derived-pbr`,
    `renderBridgeSphereMetallicVisibilityProxyCount=1`, and min/max sphere
    radius `0.06203504651784897` / `0.1551002413034439`.
  `/tmp/ulg-particle-pbr-fe-mobile-spheres-probe.json`
  - Passed with `status=good`, analysis `good`, browser console
    issues/warnings `0/0`, material keys `h2o` and `fe`, sphere PBR source
    `closure-derived-pbr`, `renderBridgeSphereMetallicVisibilityProxyCount=1`,
    and min/max sphere radius `0.07754381000995636` /
    `0.15509283542633057`.

Resident G2P particle-scale guard, 2026-06-19 18:44 AKDT:

- Syntax:
  `node --check src/runtime/sph/sphG2pGpuKernel.js`,
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`,
  `node --check ulg-gpu-abi/src/wgsl.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`,
  `node --check tests/sphG2pGpuKernel.test.mjs`, and
  `node --check tests/sphMlsMpmGpuStep.test.mjs` passed.
- Focused tests:
  `node --test tests/sphG2pGpuKernel.test.mjs`
  - Passed: `17/17`.
  - New coverage proves a non-condensed CPU G2P particle with synthetic runaway
    affine strain is capped to `J=64` / radius growth `4` before render
    extraction, with cap-count diagnostics.
  `node --test tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `60/60`.
  - New coverage proves fused no-full resident mechanics diagnostics expose
    `peercompute.ulg.mls-mpm-g2p-particle-scale-stability.v0`,
    `gpu-g2p-cap-policy-applied-in-shader`, and the max `J=64` / radius growth
    `4` shader policy without a full particle readback.
- Physics atomics:
  `npm run test:physics-atomics`
  - Passed: `11/11`; the three long-horizon acceptance gates were skipped by
    their opt-in environment guard.
- Browser probe:
  `/tmp/ulg-resident-g2p-scale-guard-probe.json`
  - Passed with `status=good`, analysis `good`, browser console
    issues/warnings `0/0`, four captured visual frames, three nonblank canvas
    frames, and resident diagnostics
    `particleScaleStabilityStatus=gpu-g2p-cap-policy-applied-in-shader`,
    `particleScalePolicySource=webgpu-fused-g2p-shader`, max `J=64`, and max
    radius growth `4`.

Render-row support-radius particle-scale guard, 2026-06-19 AKDT:

- Syntax:
  `node --check src/runtime/sph/sphRenderGpuKernel.js`,
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`,
  `node --check tests/sphRenderGpuKernel.test.mjs`, and
  `node --check ulg-gpu-abi/src/wgsl.js` passed.
- Focused tests:
  `node --test tests/sphRenderGpuKernel.test.mjs`
  - Passed: `52/52`.
  - New coverage proves render-row extraction caps an aggregate/product visual
    radius to `2 * smoothingLengthM` even when `J=1`, records
    `max-support-radius`, and keeps the WebGPU WGSL cap branch in lockstep.
- Browser probe:
  `/tmp/ulg-reaction-support-radius-cap-probe.json`
  - Passed with `status=good`, analysis `good`, browser console
    issues/warnings `0/0`, four nonblank captured visual frames, final
    resident sphere max radius `0.5263000726699829 m`, decoded max
    `J=1.0000579357147217`, no decoded `J=64` cap-boundary rows, and retained
    shader support policy `maxSupportRadiusM=0.6203504908994 m`.

Gas product routing and gas-radius render proxy, 2026-06-19 AKDT:

- Syntax:
  `node --check src/runtime/sph/sphRenderGpuKernel.js`,
  `node --check src/runtime/sph/sphReactionGpuKernel.js`,
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`,
  `node --check tests/sphRenderGpuKernel.test.mjs`,
  `node --check tests/sphReactionGpuKernel.test.mjs`, and
  `node --check ulg-gpu-abi/src/wgsl.js` passed.
- Focused tests:
  `node --test tests/sphRenderGpuKernel.test.mjs`
  - Passed: `53/53`.
  - New coverage proves gas-phase render rows proxy individual sphere radius to
    `0.5 * smoothingLengthM`, records
    `gas-phase-visual-radius-proxy`, and keeps the WGSL gas branch wired.
  `node --test tests/sphReactionGpuKernel.test.mjs`
  - Passed: `11/11`.
  - New coverage proves gas-routed product terms remain unplaced/ledgered
    instead of taking visible particle slots, and the WebGPU reaction shader
    selects only condensed product terms for visible slots.
- Physics atomics:
  `npm run test:physics-atomics`
  - Passed: `11/11`; the three long-horizon acceptance gates were skipped by
    their opt-in environment guard.
- Browser mobile-shaped reaction/sphere probe:
  `/tmp/ulg-reaction-gas-radius-proxy-probe.json`
  - Passed with `status=good`, analysis `good`, browser console
    issues/warnings `0/0`, and four nonblank captured visual frames.
  - The final retained sphere bridge still decoded `naoh|gas` rows, but max
    sphere radius was bounded to `0.15508762001991272 m`, matching the reported
    `renderRowsParticleScaleMaxGasParticleRadiusM=0.15508762272485`.

Native visible-consumer fail-closed gate, 2026-06-19 AKDT:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js` and
  `node --check tests/sphPhaseRenderer.test.mjs` passed.
- Focused tests:
  `node --test tests/sphPhaseRenderer.test.mjs`
  - Passed: `63/63`.
  - New coverage proves pending native validation and texture-readback
    unavailable errors do not mark the visible GPU consumer ready. A native
    consumer can promote only after browser pixel validation passes or a
    same-device readback/offscreen validation actually passes.
- Browser no-full native smoke:
  `/tmp/ulg-native-visible-consumer-tightened-probe.json`
  - Expected partial/fail-closed result: probe `status=bad`, analysis `bad`,
    browser console issues/warnings `0/0`.
  - Retained direct-consumer surface buffers were ready and the native bridge
    rendered (`renderBridgeLastRenderStatus=native-webgpu-surface-consumer-rendered`),
    but `visibleGpuConsumerReady=false`,
    `visibleGpuConsumerStatus=resident-surface-visible-gpu-consumer-blocked-pixel-validation`,
    `visibleGpuConsumerValidated=false`, and
    `visibleGpuConsumerNativeReadbackFallbackValidated=false`.
  - Direct canvas validation remains the blocker:
    `blankCanvasFrameCount=3`, `nonblankCanvasFrameCount=0`,
    and analysis includes `visual-canvas-frames-all-blank`.

Resident native texture readback smoke, 2026-06-19 AKDT:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check scripts/sph-long-horizon-probe.mjs`, and
  `node --check tests/sphPhaseRenderer.test.mjs` passed.
- Focused tests:
  `node --test tests/sphPhaseRenderer.test.mjs`
  - Passed: `63/63`.
  - New assertions keep native visible-consumer readiness blocked when the
    resident-device texture readback smoke reports the texture-readback
    unavailable class.
- Whitespace:
  `git diff --check` passed.
- Browser native surface probe:
  `/tmp/ulg-native-device-texture-smoke-probe.json`
  - Expected partial/fail-closed result: probe `status=bad`, browser console
    issues/warnings `0/0`.
  - Native bridge selected correctly with `renderer=native-webgpu` and
    `surfaceDraw=native-webgpu-surface-consumer`.
  - Resident device MAP_READ smoke passed with expected/sample
    `305419896`.
  - New resident texture render/copy/MAP_READ smoke passed with
    `sample=[255,0,0,255]`.
  - The native bridge rendered
    `renderBridgeLastRenderStatus=native-webgpu-surface-consumer-rendered`
    with `renderBridgeFrameCount=10`, but visible consumer remained
    fail-closed:
    `visibleGpuConsumerStatus=resident-surface-visible-gpu-consumer-blocked-pixel-validation`.
  - Bridge readback smoke still failed with
    `A valid external Instance reference no longer exists`; offscreen
    validation reported the same readback-unavailable class.
- Port note:
  An initial attempt against occupied `5173` failed during HTTP readiness with
  `Timed out waiting for http://127.0.0.1:5173: fetch failed`; the successful
  harness run used clean port `5631`.

Native surface readback classification, 2026-06-19 AKDT:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js` passed.
- Focused tests:
  `node --test tests/sphPhaseRenderer.test.mjs`
  - Passed: `63/63`.
- Whitespace:
  `git diff --check` passed.
- Browser native surface probe:
  `/tmp/ulg-native-readback-classified-probe.json`
  - Expected partial/fail-closed result: probe `status=bad`, browser console
    issues/warnings `0/0`.
  - Resident device MAP_READ and standalone texture readback smokes both
    passed.
  - Native bridge rendered
    `renderBridgeLastRenderStatus=native-webgpu-surface-consumer-rendered`
    with `renderBridgeFrameCount=10`.
  - Visible consumer remained blocked:
    `visibleGpuConsumerStatus=resident-surface-visible-gpu-consumer-blocked-pixel-validation`.
  - Native bridge readback smoke is now classified as `not-run` with
    texture-readback-unavailable reason instead of generic `error`; offscreen
    validation remains `not-run` for the same external-instance class.

Drop edge >6 domain bounds guardrail, 2026-06-19 AKDT:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js` and
  `node --check src/visualization/sphPhaseDemoMount.js` and
  `node --check tests/demo.e2e.mjs` passed.
- Focused tests:
  `node --test tests/sphPhaseRenderer.test.mjs`
  - Passed: `64/64`.
  - Added coverage that CPU continuous surface batching derives same-material
    base/drop render domains from `renderDomainCounts` even when material rows
    omit explicit domain ids.
  `node --test tests/sphPhaseDemo.test.mjs`
  - Passed: `37/37`.
- Mounted browser regression:
  `PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5635 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5635 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5635' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 npx playwright test --config tests/playwright.config.mjs --grep "same-material base spacing expands"`
  - Passed: `1/1`.
  - The mobile-shaped H2O/H2O MLS-MPM reset path preserves
    `dropn=7` as `7^3` drop particles and expands the same-material base to
    `14^3` particles for equal physical particle radius.
  - `peercompute.ulg.sph-scene-set-particles-timing.v0` now carries
    `peercompute.ulg.sph-render-domain-position-bounds.v0`, proving base/drop
    center and bounds from the render-facing particle arrays after reset.
  - The same payload now carries
    `peercompute.ulg.sph-same-material-domain-merge-diagnostics.v0`, proving
    that the H2O/H2O liquid role domains are intentionally merged for the
    continuous visible material surface rather than lost at initialization.

Reaction variable particle scale reset guard, 2026-06-19 AKDT:

- Syntax:
  `node --check tests/demo.e2e.mjs` passed.
- Focused Node suites:
  `node --test tests/sphPhaseDemo.test.mjs`
  - Passed: `37/37`.
  `node --test tests/sphRenderGpuKernel.test.mjs`
  - Passed: `53/53`.
- Whitespace:
  `git diff --check` passed.
- Mounted browser regression:
  `PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5637 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5637 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5637' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 npx playwright test --config tests/playwright.config.mjs --grep "resident Na/H2O promotes product gas pressure"`
  - Passed: `1/1`.
  - The first Na/H2O resident pass validates retained product-event buffer to
    positioned spatial gas ledger and gas-cell EOS stages without full
    product-event readback.
  - The reset pass validates
    `peercompute.ulg.sph-demo-reset-status.v0` with
    `particle-state-resynced-after-reset`, then proves a second resident
    reaction/render pass still emits product rows and bounded gas render rows.
  - Both passes assert `gpu-g2p-cap-policy-applied-in-shader`, render-row
    particle-scale policy diagnostics, max radius growth `4`, max `J=64`,
    positive support/gas radius caps, decoded gas-phase rows, and max decoded
    particle radius under the gas visual proxy cap.
  - Superseded by the retained spatial gas pressure promotion below: the
    pressure-summary gap is no longer the active blocker.

Retained spatial gas pressure promotion, 2026-06-19 AKDT:

- Syntax:
  `node --check src/runtime/sphPhaseDemo.js`,
  `node --check src/visualization/sphPhaseDemoMount.js`,
  `node --check tests/sphPhaseDemo.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- Focused Node suites:
  `node --test tests/sphPhaseDemo.test.mjs`
  - Passed: `38/38`.
  - Added a no-full resident pressure unit guard proving a pressure-interface
    spatial gas species ledger can produce
    `gpu-resident-pressure-interface-spatial-gas-summary` without compact gas
    ledger readback.
  `node --test tests/sphRenderGpuKernel.test.mjs`
  - Passed: `53/53`.
- Mounted browser regression:
  `PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5637 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5637 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5637' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 npx playwright test --config tests/playwright.config.mjs --grep "resident Na/H2O promotes product gas pressure"`
  - Passed: `1/1`.
  - The browser path now runs resident step, pressure-interface refresh,
    pressure promotion, render refresh, reset, and a second pass while
    requiring clean WebGPU console output.
  - The first pass requires promoted resident pressure source
    `gpu-resident-pressure-interface-spatial-gas-ledger`, ready retained
    spatial gas ledger cells, ready gas-cell EOS feedback, and render-state
    pressure from the promoted summary instead of baseline fallback.

Consecutive resident reaction pressure sequence, 2026-06-19 AKDT:

- Syntax:
  `node --check tests/demo.e2e.mjs` passed.
- Whitespace:
  `git diff --check` passed.
- Mounted browser regression:
  `PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5637 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5637 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5637' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 npx playwright test --config tests/playwright.config.mjs --grep "resident Na/H2O promotes product gas pressure"`
  - Passed: `1/1`.
  - The harness now covers first resident pressure/render pass, consecutive
    no-reset resident pressure/render pass, reset, and post-reset resident
    pressure/render pass in one console-clean browser run.
  - The consecutive pass keeps promoted pressure source
    `gpu-resident-pressure-interface-spatial-gas-ledger`, pressure above
    baseline, and render-state pressure input from the promoted summary.

Native surface validation scope guard, 2026-06-19 AKDT:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js` and
  `node --check tests/sphPhaseRenderer.test.mjs` passed.
- Focused renderer suite:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "native WebGPU surface validation cadence|visible GPU surface consumer"`
  - Passed: `68/68`.
  - Added native cadence assertions for `native-surface-draw`,
    `native-current-texture-debug-clear`, and `native-no-submitted-draws`.
  - Debug clear-only keeps readback-smoke validation eligible while reporting
    offscreen surface geometry validation as skipped until real surface draws
    are submitted.

Cesium resident reaction browser guard, 2026-06-19 AKDT:

- Syntax:
  `node --check tests/demo.e2e.mjs` passed.
- Mounted browser regression:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "resident alkali/H2O promotes product gas pressure"`
  - Passed: `1/1` in `3.2m`.
  - The existing Na/H2O reset and K/H2O continuation assertions now also run a
    Cs/H2O continuation sequence with retained CsOH/H2 product pressure,
    promoted spatial gas pressure, scale-policy diagnostics, support-radius
    bounds, and clean WebGPU console output.

High drop-edge points render coverage, 2026-06-19 AKDT:

- Syntax:
  `node --check tests/demo.e2e.mjs` passed.
- Mounted browser regression:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "mounted points diagnostics"`
  - Passed: `1/1`.
  - Fe/H2O `dropn=8, basen=5` now validates reset, render-domain counts and
    bounds, SPH/MLS-MPM uploads, selected `three-render-row-points` mode, and
    clean WebGPU console output.

Native validation scope harness telemetry, 2026-06-19 AKDT:

- Syntax:
  `node --check scripts/sph-long-horizon-probe.mjs`,
  `node --check scripts/sph-performance-benchmark.mjs`, and
  `node --check tests/nativeSurfaceHarness.test.mjs` passed.
- Focused Node suite:
  `node --test tests/nativeSurfaceHarness.test.mjs`
  - Passed: `1/1`.
  - Guards that long-horizon probe and performance benchmark artifacts expose
    native validation scope, offscreen eligibility, and offscreen skipped
    reason.

Material property bank registry warm inputs, 2026-06-19 AKDT:

- Syntax:
  `node --check src/runtime/material/materialPropertyBank.js`,
  `node --check src/runtime/material/MaterialRegistry.js`,
  `node --check tests/materialPropertyBank.test.mjs`, and
  `node --check src/runtime/material/materialResolverManifest.js` passed.
- Focused Node suite:
  `node --test tests/materialPropertyBank.test.mjs`
  - Passed: `4/4`.
  - Covers schema validation, canonical symbol lookup (`fe`/`Fe`/`FE`),
    non-authoritative warm inputs, `MaterialRegistry` strict closure sampling
    with attached bank metadata, and the no-bank path.
- Material bank schema validator:
  `node scripts/material-properties/validate-material-property-bank.mjs`
  - Passed with `recordCount=5` and symbols `H`, `O`, `Na`, `Fe`, `Cs`.
- Adjacent material suites:
  `node --test tests/materialPropertyProvenance.test.mjs` passed `6/6`,
  `node --test tests/materialThermo.test.mjs` passed `8/8`, and
  `node --test tests/materialEos.test.mjs` passed `7/7`.
- Whitespace:
  `git diff --check` passed.

Material property bank stale provenance guards, 2026-06-19 AKDT:

- Syntax:
  `node --check src/runtime/material/materialPropertyBank.js` and
  `node --check tests/materialPropertyBank.test.mjs` passed.
- Focused Node suite:
  `node --test tests/materialPropertyBank.test.mjs`
  - Passed: `5/5`.
  - Added mutated-bank guards for stale schema version, future schema version,
    unknown provenance status, and missing provenance units.
- Material bank schema validator:
  `node scripts/material-properties/validate-material-property-bank.mjs`
  - Passed with `recordCount=5` and symbols `H`, `O`, `Na`, `Fe`, `Cs`.

Active material bank element coverage, 2026-06-19 AKDT:

- Syntax:
  `node --check tests/materialPropertyBank.test.mjs` passed.
- Focused Node suite:
  `node --test tests/materialPropertyBank.test.mjs`
  - Passed: `6/6`.
  - Added active coverage assertions for `H`, `O`, `Li`, `Na`, `K`, `Rb`,
    `Cs`, `Fe`, and `Pd`, including lowercase Palladium lookup and metallic PBR
    seed presence.
- Material bank schema validator:
  `node scripts/material-properties/validate-material-property-bank.mjs`
  - Passed with `recordCount=9` and symbols `H`, `Li`, `O`, `Na`, `K`, `Fe`,
    `Rb`, `Pd`, `Cs`.
- Whitespace:
  `git diff --check` passed.

Material bank particle-spacing warm input hook, 2026-06-19 AKDT:

- Syntax:
  `node --check src/runtime/sphPhaseDemo.js` and
  `node --check tests/sphPhaseDemo.test.mjs` passed.
- Focused SPH demo suite command:
  `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "material bank warm inputs|initial particle spacing adapts"`
  - Passed: `41/41`.
  - The new assertion supplies `data/material-properties/elements.json`, checks
    Fe role warm-input attachment, verifies `h2o` is reported as a missing
    compound row, and confirms the view-state handoff carries the metadata.
- Whitespace:
  `git diff --check` passed.

Default material bank loader, 2026-06-19 AKDT:

- Syntax:
  `node --check src/runtime/material/defaultMaterialPropertyBank.js`,
  `node --check src/runtime/sphPhaseDemo.js`, and
  `node --check tests/sphPhaseDemo.test.mjs` passed.
- SPH demo suite command:
  `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "default material bank warm inputs|initial particle spacing adapts"`
  - Passed: `41/41`.
  - The default demo path now publishes Fe warm-input metadata from the
    checked-in element JSON bank without explicitly passing the bank option.
- Material bank suite:
  `node --test tests/materialPropertyBank.test.mjs` passed `6/6`.
- Material bank schema validator:
  `node scripts/material-properties/validate-material-property-bank.mjs`
  - Passed with `recordCount=9`.
- Browser bundle:
  `npm run build`
  - Passed. Vite reported only the existing large chunk-size warning.
- Whitespace:
  `git diff --check` passed.

Thermal material-bank warm-input annotation, 2026-06-19 AKDT:

- Syntax:
  `node --check src/runtime/sph/sphThermalGpuKernel.js src/runtime/sph/sphStaticTableInputs.js src/visualization/sphPhaseScene.js src/runtime/sph/sphColdStartCache.js tests/sphThermalGpuKernel.test.mjs tests/sphColdStartCache.test.mjs`
  passed.
- Thermal suite command:
  `node --test tests/sphThermalGpuKernel.test.mjs --test-name-pattern "material-bank warm|retained output"`
  - Passed: `13/13`.
  - Covers non-authoritative material-bank warm-input attachment and WebGPU
    result-envelope diagnostics.
- Cold-start cache suite:
  `node --test tests/sphColdStartCache.test.mjs`
  - Passed: `4/4`.
  - Covers preserving the warm-input consumer summary through static-table
    cache rehydration.

Optical material-bank PBR warm-input annotation, 2026-06-19 AKDT:

- Syntax:
  `node --check src/runtime/material/opticalGpuBuffers.js src/runtime/sph/sphStaticTableInputs.js src/visualization/sphPhaseScene.js src/runtime/sph/sphColdStartCache.js tests/opticalGpuBuffers.test.mjs tests/sphColdStartCache.test.mjs`
  passed.
- Optical GPU table suite command:
  `node --test tests/opticalGpuBuffers.test.mjs --test-name-pattern "material-bank PBR|derived PBR|air"`
  - Passed: `20/20`.
  - Covers non-authoritative PBR warm-input attachment while preserving
    closure-derived optical table values.
- Cold-start cache suite:
  `node --test tests/sphColdStartCache.test.mjs`
  - Passed: `4/4`.
  - Covers preserving optical bank PBR consumer metadata through rehydration.

Native surface browser-frame validation classifier, 2026-06-19 AKDT:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`,
  `node --check tests/sphPhaseRenderer.test.mjs`,
  `node --check scripts/sph-long-horizon-probe.mjs`, and
  `node --check scripts/sph-performance-benchmark.mjs` passed.
- Focused renderer suite command:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "visible GPU surface consumer|native WebGPU surface validation cadence"`
  - Passed: `68/68`.
  - Covers the native visible-consumer blocker family
    `browser-frame-validation-required` while keeping native acceptance
    fail-closed until pixel or readback validation passes.
- Browser bundle:
  `npm run build`
  - Passed. Vite reported only the existing large chunk-size warning.
- Whitespace:
  `git diff --check` passed.
- Whitespace:
  `git diff --check` passed.

Material bank GPU warm-row and particle-size packing, 2026-06-19 AKDT:

- Syntax:
  `node --check src/runtime/material/materialPropertyBank.js`,
  `node --check src/runtime/sph/sphGpuBuffers.js`,
  `node --check src/runtime/sphPhaseDemo.js`,
  `node --check src/runtime/sphPhaseViewState.js`,
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check tests/materialPropertyBank.test.mjs`,
  `node --check tests/sphGpuBuffers.test.mjs`,
  `node --check tests/sphPhaseDemo.test.mjs`, and
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs` passed.
- Material bank suite:
  `node --test tests/materialPropertyBank.test.mjs`
  - Passed: `7/7`.
  - Covers packed warm-input rows and particle-size rows as
    `strictSourceOfTruth: false` GPU-ready warm metadata.
- GPU particle buffer suite:
  `node --test tests/sphGpuBuffers.test.mjs`
  - Passed: `10/10`.
  - Covers optional SPH and MLS-MPM upload buffers for warm-input and
    particle-size rows, including destroy ownership.
- SPH demo suite command:
  `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "material bank warm inputs|GPU uploads include material-bank|initial particle spacing carries default"`
  - Passed: `41/41`.
  - Confirms demo initialization and view-state SPH/MLS-MPM descriptors carry
    one accepted Fe warm row while `h2o` remains an explicit missing compound
    bank row.
- PeerCompute integration command:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "initial particle-size packing rows"`
  - Passed: `18/18`.
  - Confirms remote seed graphs preserve optional `initialParticleSpacing` and
    hash differently when particle-size packing rows are present.
- Material bank schema validator:
  `node scripts/material-properties/validate-material-property-bank.mjs`
  - Passed with `recordCount=9`.
- Browser bundle:
  `npm run build`
  - Passed. Vite reported only the existing large chunk-size warning.

Material bank render-row shader consumer, 2026-06-19 AKDT:

- Syntax:
  `node --check src/runtime/sph/sphRenderGpuKernel.js`,
  `node --check ulg-gpu-abi/src/wgsl.js`, and
  `node --check tests/sphRenderGpuKernel.test.mjs` passed.
- Focused render-kernel command:
  `node --test tests/sphRenderGpuKernel.test.mjs --test-name-pattern "material-bank particle-size|particle scale cap|retain resident rows"`
  - Passed: `54/54`.
  - Covers the new binding `5` material-bank particle-size row consumer,
    shader-source guards, retained render rows, and scale-cap contracts.
- Full render-kernel suite:
  `node --test tests/sphRenderGpuKernel.test.mjs`
  - Passed: `54/54`.
- Material bank schema validator:
  `node scripts/material-properties/validate-material-property-bank.mjs`
  - Passed with `recordCount=111`.
- Browser bundle:
  `npm run build`
  - Passed. Vite reported only the existing large chunk-size warning.
- Whitespace:
  `git diff --check` passed.

Render-row WebGPU params ABI cleanup, 2026-06-19 AKDT:

- Syntax:
  `node --check src/runtime/sph/sphRenderGpuKernel.js tests/webgpuKernelAbi.test.mjs tests/sphRenderGpuKernel.test.mjs`
  passed.
- WebGPU ABI guard:
  `node --test tests/webgpuKernelAbi.test.mjs`
  - Passed: `3/3`.
  - Confirms `RenderRowsParams`, JS packing, and
    `ulg-sph-render-rows-params` uniform allocation all agree on 48 bytes.
- Focused render-kernel command:
  `node --test tests/sphRenderGpuKernel.test.mjs --test-name-pattern "render row WebGPU extraction can retain resident rows|material bank|particle scale"`
  - Passed: `54/54`.
  - Re-covers retained render-row handoff, shader material-bank particle-size
    consumption, and particle scale caps.
- Browser console harness:
  `ULG_PROBE_OUTPUT=/tmp/ulg-console-probe-after-renderrows.json ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=1 ULG_PROBE_TIMEOUT_MS=90000 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&visualCapture=1&residentAuto=0&surfaceDraw=three-render-row-points' node scripts/sph-long-horizon-probe.mjs`
  - Passed: status `good`.
  - Browser console issue count: `0`.
  - Browser console warning count: `0`.
  - Page error count: `0`.
- Browser bundle:
  `npm run build`
  - Passed. Vite reported only the existing large chunk-size warning.
- Whitespace:
  `git diff --check` passed.

Native surface request retention and probe snapshot, 2026-06-19 AKDT:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js scripts/sph-long-horizon-probe.mjs tests/nativeSurfaceHarness.test.mjs`
  passed.
- Native harness:
  `node --test tests/nativeSurfaceHarness.test.mjs`
  - Passed: `2/2`.
  - Confirms native probes retain render-field buffers by default and metrics
    carry native validation snapshot fields.
- Focused renderer command:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "native WebGPU surface validation cadence|visible GPU surface consumer|renderer backend|surface draw"`
  - Passed: `68/68`.
- Mobile-shaped native probe:
  `ULG_PROBE_OUTPUT=/tmp/ulg-native-mobile-after-snapshot.json ULG_PROBE_FRAME_DIR=/tmp/ulg-native-mobile-after-snapshot-frames ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=2 ULG_PROBE_TIMEOUT_MS=120000 ULG_PROBE_FAIL_ON_BAD=0 ULG_PROBE_VIEWPORT_WIDTH=390 ULG_PROBE_VIEWPORT_HEIGHT=844 ULG_PROBE_DEVICE_SCALE_FACTOR=3 ULG_PROBE_IS_MOBILE=1 ULG_PROBE_HAS_TOUCH=1 ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=no-full-readback ULG_PROBE_COMPACT_SUMMARY_MODE=none ULG_PROBE_NATIVE_SURFACE_VALIDATION_WAIT_MS=1500 ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MODE=native-webgpu-surface-consumer ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&boxx=5&boxy=5&boxz=5&dropn=4&basen=4&mech=mlsmpm&residentAuto=0&residentFuseSequence=1&residentActiveGrid=1&visualCapture=1&surfaceDraw=native-webgpu-surface-consumer&blob=1' node scripts/sph-long-horizon-probe.mjs`
  - Partial by design: status `bad` because native visible consumer remains
    blocked on validation.
  - Browser console issue/warning counts: `0/0`.
  - Native GPU buffer handoff accepted: `true`.
  - Last `nativeSurfaceValidation.validationBlockerFamily`:
    `native-surface-validation-readback-lifetime`.

Reset resident stage-order trace, 2026-06-19 AKDT:

- Syntax:
  `node --check tests/demo.e2e.mjs src/visualization/sphPhaseDemoMount.js scripts/sph-long-horizon-probe.mjs tests/sphPhaseDemoMountRemoteRefresh.test.mjs`
  passed.
- Focused helper tests:
  `node --test tests/sphPhaseDemoMountRemoteRefresh.test.mjs`
  - Passed: `7/7`.
  - Covers capped trace append behavior and compact execution summaries with
    authority/active-grid evidence.
- Mounted reset e2e:
  `PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase reset preserves drop edge above six through mounted render diagnostics"`
  - Passed: `1/1`.
  - Confirms reset invalidation/resync events are retained and console issue
    list stays empty.
- Browser probe:
  `ULG_PROBE_OUTPUT=/tmp/ulg-stage-order-trace-smoke-3.json ULG_PROBE_FRAME_DIR=/tmp/ulg-stage-order-trace-smoke-3-frames ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=1 ULG_PROBE_TIMEOUT_MS=120000 ULG_PROBE_FAIL_ON_BAD=0 ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=no-full-readback ULG_PROBE_COMPACT_SUMMARY_MODE=none ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&boxx=4&boxy=4&boxz=4&dropn=2&basen=3&mech=mlsmpm&residentAuto=0&residentFuseSequence=1&residentActiveGrid=1&surfaceDraw=three-render-row-spheres&visualCapture=1&blob=1' node scripts/sph-long-horizon-probe.mjs`
  - Passed: status `good`.
  - Browser console issue/warning counts: `0/0`.
  - Per-batch trace reached `resident-execution-complete-direct-probe` with
    WebGPU no-full-readback execution, authority ledger ready, and buffer
    lease ledger ready.

Kinematics-gated material-interface contact response, 2026-06-20 AKDT:

- Syntax:
  `node --check src/runtime/sph/sphPressureInterfaceGpuKernel.js`
  passed.
- Syntax:
  `node --check src/runtime/sphPhaseDemo.js`
  passed.
- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  passed.
- Syntax:
  `node --check ulg-gpu-abi/src/wgsl.js`
  passed.
- Focused pressure/interface and stage tests:
  `node --test tests/sphPressureInterfaceGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `112/112`.
  - Covers kinematics row packing, no-full WebGPU bind layout, kinematics-gated
    dynamic contact pressure, no-force behavior when kinematics are absent, CPU
    oracle parity, and pressure-stage evidence fields.
- ABI/grid/buffer regression:
  `node --test tests/webgpuKernelAbi.test.mjs tests/abi.test.mjs tests/sphGridUpdateGpuKernel.test.mjs tests/sphGpuBuffers.test.mjs`
  - Passed: `47/47`.
  - Re-covers WGSL ABI guards, the reserved identifier guard, particle-parallel
    P2G shader guard, MLS-MPM wall-barrier contact, and GPU buffer packing.
- Whitespace:
  `git diff --check`
  - Passed.
- Browser bundle:
  `npm run build`
  - Passed. Vite reported only the existing large chunk-size warning.
- Physics atomics:
  `npm run test:physics-atomics`
  - Passed: `11/14`.
  - Skipped: the three expected opt-in long-horizon liquid acceptance gates.
- ICC:
  `npm run icc:update`
  - Passed with `indexedFiles=354`, `memoryChunks=2072`.

Contact-bin diagnostic flag lifetime fix, 2026-06-20 AKDT:

- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --check scripts/sph-long-horizon-probe.mjs`
  passed.
- Whitespace:
  `git diff --check`
  passed.

Worker compact same-device materialization slice, 2026-06-20 AKDT:

- Syntax:
  `node --check src/runtime/peercomputeBrowserResidentHost.js`
  passed.
- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  passed.
- Syntax:
  `node --check src/visualization/sphPhaseDemoMount.js`
  passed.
- Syntax:
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  passed.
- Syntax:
  `node --check tests/demo.e2e.mjs`
  passed.
- Resident-authority integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident authority host admits worker-retained mechanics output descriptors"`
  - Passed: `18/18`.
  - Covers the baseline worker-private descriptor plus the new same-device
    retained-buffer import route through publication, hot storage, warm delta,
    access contract, and continuation plan.
- Mounted worker browser gate:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase mounted resident scheduler can publish worker-retained mechanics stage lane"`
  - Passed: `1/1`.
  - Requires same-device materialization availability while keeping worker-owned
    GPU handles non-main-thread-renderable.
- Real browser PeerCompute resident-authority gate:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  - Passed: `1/1`.
  - Requires the same-device source key to propagate through the standalone
    worker stage-chain candidate, publication, hot-buffer record, warm delta,
    and worker-retained access contract.

Worker publication compact refresh bridge, 2026-06-20 AKDT:

- Syntax:
  `node --check src/runtime/peercomputeBrowserResidentHost.js`
  passed.
- Syntax:
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
  passed.
- Resident-authority compact refresh integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "compact"`
  - Passed: `18/18`.
  - Covers direct `sameDeviceRetainedBufferImport` forwarding through
    `createUlgSphMlsMpmCompactHotBufferRefreshExecutor()` and the new
    `host.refreshWorkerRetainedMechanicsPublicationHotBuffers()` bridge from an
    admitted worker mechanics publication to zero-upload same-device hot-buffer
    aliasing.

Native same-device main-thread import slice, 2026-06-20 AKDT:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`
  passed.
- Syntax:
  `node --check tests/demo.e2e.mjs`
  passed.
- Focused visible-consumer contract:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "SPH visible GPU surface consumer requires renderer and pixel validation"`
  - Passed: `71/71`.
  - Covers native route selection, `main-thread` import scope, awaiting
    pixel-validation status, and validated `same-device-main-thread-import-ready`.
- HTTPS browser gate:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase native same-device surface consumer publishes browser-frame validation readiness"`
  - Passed: `1/1` in `14.8s`.
  - Uses the live HTTPS Vite server bound to `0.0.0.0`.
  - Requests `renderer=native-webgpu&surfaceDraw=native-webgpu-surface-consumer`,
    keeps `no-full-readback` and skipped compact summary, runs a fresh resident
    batch plus a continued resident batch, renders the native bridge, publishes
    browser-frame validation evidence through the scene API, and requires
    `same-device-main-thread-import-ready`.
  - Requires `continuationAvailable=true` after the first batch,
    `continuedFromResidentState=true` in the second batch, and monotonic
    resident step advance.

Mounted Mg/O2 non-water binary product browser acceptance, 2026-06-20 AKDT:

- Syntax:
  `node --check tests/demo.e2e.mjs`
  passed.
- Focused browser e2e:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs tests/demo.e2e.mjs --grep "SPH phase mounted non-water binary reaction retains condensed product events" --timeout 300000`
  - Passed: `1/1` in `40.3s`.
  - Reused the live HTTPS Vite server bound to `0.0.0.0`.
  - Covers hot `Mg/o2` with a one-reaction binary-ionic MgO table, condensed
    `mgo` product term, zero gas-product rows, retained resident product-event
    rows, zero resident gas-species ledger rows, render-bound product event
    buffer, decoded `mgo` render rows, fixed-capacity reaction-bin diagnostics,
    G2P particle-scale policy, and clean WebGPU console output.

Mounted active-metal/H2O reaction-bin multi-material validation, 2026-06-20 AKDT:

- Syntax:
  `node --check tests/demo.e2e.mjs`
  passed.
- Baseline physics atomics:
  `npm run test:physics-atomics`
  - Passed: `11/11`; skipped the `3` opt-in long-horizon liquid gates.
- Browser e2e against the live HTTPS server:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs tests/demo.e2e.mjs --grep "SPH phase mounted resident active-metal/H2O promotes product gas pressure" --timeout 480000`
  - Passed: `1/1` in `5.7m`.
  - Reused the running `0.0.0.0` HTTPS Vite server.
  - The mounted resident workflow now asserts
    `reactionProposalNeighborMode=fixed-capacity-particle-bin-grid`,
    `reactionParticleBinGridStatus=reaction-particle-bin-grid-prepared`,
    positive cell/capacity/index-buffer/max-contact-radius diagnostics, and
    default `reactionParticleBinOverflowMetadataReadbackRequested=false`.
  - Coverage spans Na/H2O first, continuation, reset/post-reset; K/H2O and
    Cs/H2O first, continuation, and long-horizon continuation; and Ca/H2O
    first plus continuation.

Mounted Ca/H2O multivalent long-horizon continuation, 2026-06-20 AKDT:

- Syntax:
  `node --check tests/demo.e2e.mjs`
  passed.
- Browser e2e against the live HTTPS server:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs tests/demo.e2e.mjs --grep "SPH phase mounted resident active-metal/H2O promotes product gas pressure" --timeout 540000`
  - Passed: `1/1` in `6.3m`.
  - Extends the mounted active-metal workflow so Ca/H2O now matches K/Cs
    long-horizon shape with first pass, continuation, and second no-full
    continuation. The added Ca pass asserts resident product carry-forward,
    retained `Ca(OH)2`/H2 pressure, fixed-capacity reaction-bin diagnostics,
    and the GPU-resident spatial gas pressure source.

Mounted derived-material contact-bin browser acceptance, 2026-06-20 AKDT:

- Syntax:
  `node --check tests/demo.e2e.mjs`
  passed.
- Browser e2e against the live HTTPS server:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs tests/demo.e2e.mjs --grep "SPH phase demo runs derived material properties by default" --timeout 240000`
  - Passed: `1/1` in `32.9s`.
  - The mounted derived-material browser path now requires
    `pressureInterfaceContactBinGridStatus` to be ready/submitted with
    `pressureInterfaceContactBinGridEnabled=true`, positive cell count,
    capacity, average occupancy, and index-buffer bytes, plus
    `pressureInterfaceContactBinGridEstimatedOverflowRisk=false`, whenever
    the pressure-interface solver is ready.

Algorithm surface-policy native extraction browser acceptance, 2026-06-20 AKDT:

- Syntax:
  `node --check tests/demo.e2e.mjs`
  passed.
- Browser e2e against the live HTTPS server:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs tests/demo.e2e.mjs --grep "SPH phase no-full render refresh can skip compact surface summary readback" --timeout 180000`
  - Passed: `1/1` in `20.1s`.
  - The no-full native marching-cubes path now asserts the selected
    buffer-volume descriptor reports
    `surfaceExtractionPolicyStatus=algorithm-surface-policy-row-selected`,
    `surfaceExtractionPolicyRowsSchema=peercompute.ulg.algorithm-material-surface-extraction-rows.v0`,
    `surfaceExtractionPolicyRowSchema=peercompute.ulg.algorithm-material-surface-extraction-row.v0`,
    `surfaceExtractionPolicyIsovaluePolicy=density-kernel-half-occupancy`,
    and positive smoothing/voxel/normal policy values.
  - The same run updates the browser expectation to the current direct native
    hot path:
    `surfaceDrawGpuBufferHandoffSurfaceExtractionInputKind=surface-draw-compact-position-buffer`
    and
    `surfaceDrawGpuBufferHandoffSurfaceExtractionInputLayout=peercompute.webgpu-marching-cubes.compact-position-rows.v0`.

Native browser-frame surface validation slice, 2026-06-20 AKDT:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`
  passed.
- Syntax:
  `node --check scripts/sph-long-horizon-probe.mjs`
  passed.
- Syntax:
  `node --check tests/nativeSurfaceHarness.test.mjs`
  passed.
- Focused native tests:
  `node --test tests/sphMarchingCubesSurfaceAdapter.test.mjs tests/nativeSurfaceHarness.test.mjs`
  - Passed: `27/27`.
  - Covers default ULG-owned compact-position indirect draw metadata, native
    browser-frame validation publication, native probe viewport defaults for a
    compositor-stable validation path, and the native canvas sizing guard.
- HTTPS native browser-frame validation:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 ULG_PROBE_BASE_URL=https://127.0.0.1:5173/ ULG_PROBE_OUTPUT=/tmp/ulg-native-browser-frame-validation-probe-https-defaultviewport.json ULG_PROBE_FRAME_DIR=/tmp/ulg-native-browser-frame-validation-frames-https-defaultviewport ULG_PROBE_TIMEOUT_MS=180000 ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=1 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MODE=native-webgpu-surface-consumer ULG_PROBE_NATIVE_SURFACE_VALIDATION_WAIT_MS=1500 ULG_PROBE_FAIL_ON_BAD=0 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.01&dropn=2&basen=2&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=0&residentFuseSequence=1&residentActiveGrid=1&surfaceDraw=native-webgpu-surface-consumer&renderer=native-webgpu&visualCapture=1&nativeSurfacePixelValidation=1' node scripts/sph-long-horizon-probe.mjs`
  - Passed: `status=good`, `issues=[]`.
  - Browser console issue count: `0`.
  - Browser launch viewport defaulted to `320x240`.
  - `nativeSurfaceBrowserFrameValidation.status=passed`.
  - Center crop observed `10099/27313` visible native WebGPU pixels with
    surface-like variation.
  - `nativeSurfaceValidation.status=native-surface-visible-consumer-ready`.
  - `renderBridgeLastRenderStatus=native-webgpu-surface-consumer-rendered`.
- Build:
  `npm run build`
  - Passed with the existing large chunk warning only.
- Whitespace:
  `git diff --check`
  passed.
- ICC:
  `npm run icc:update`
  - Passed with `indexedFiles=354` and `memoryChunks=2118`.
- ICC:
  `npm run icc:update`
  - Passed with `indexedFiles=354` and `memoryChunks=2111`.
- Focused pressure/interface and MLS-MPM runtime tests:
  `node --test tests/sphPressureInterfaceGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `72/72`.
  - Adds preservation coverage for product-event buffers supplied through
    `preserveBuffers`.
- Focused renderer/demo tests:
  `node --test tests/sphPhaseRenderer.test.mjs tests/sphPhaseDemoMountRemoteRefresh.test.mjs`
  - Passed: `75/75`.
- Browser contact-bin diagnostic probe:
  `ULG_PROBE_OUTPUT=/tmp/ulg-contact-bin-browser-diagnostics-after-lifetime-fix.json ULG_PROBE_PORT=5672 ULG_PROBE_TIMEOUT_MS=90000 ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=1 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_CONTACT_BIN_METADATA_READBACK=1 ULG_PROBE_FAIL_ON_BAD=0 ULG_PROBE_URL='/?drop=Na&base=h2o&dropt=290&baset=290&iceh=0&ironh=1.5&boxx=5&boxy=5&boxz=5&dropn=3&basen=5&mech=mlsmpm&lawmech=1&lawg=1&laweos=1&lawp=1&lawt=1&lawr=1&lawv=1&lawst=1&blob=1&residentFuseSequence=1&residentActiveGrid=1&surfaceDraw=three-render-row-spheres&renderer=native-webgpu&visualCapture=1' node scripts/sph-long-horizon-probe.mjs`
  - Passed: `status=good`.
  - Browser console issue/warning counts: `0/0`.

Reaction proposal particle-bin hot-loop slice, 2026-06-20 AKDT:

- Syntax:
  `node --check src/runtime/sph/sphReactionGpuKernel.js`
  passed.
- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  passed.
- Syntax:
  `node --check src/visualization/sphPhaseDemoMount.js`
  passed.
- Whitespace:
  `git diff --check`
  passed.
- Focused reaction tests:
  `node --test tests/sphReactionGpuKernel.test.mjs`
  - Passed: `14/14`.
  - Covers WGSL bin/propose markers, bounded adaptive capacity, and fallback
    behavior when no positive reaction contact radius exists.
- Focused resident/reaction tests:
  `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphReactionGpuKernel.test.mjs`
  - Passed: `79/79`.
- Mounted resident summary tests:
  `node --test tests/sphPhaseDemoMountRemoteRefresh.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed: `72/72`.
- Browser reaction-bin probe:
  `ULG_PROBE_OUTPUT=/tmp/ulg-reaction-bin-browser-probe-final.json ULG_PROBE_PORT=5676 ULG_PROBE_TIMEOUT_MS=90000 ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=1 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_FAIL_ON_BAD=0 ULG_PROBE_URL='/?drop=Na&base=h2o&dropt=290&baset=290&iceh=0&ironh=1.5&boxx=5&boxy=5&boxz=5&dropn=3&basen=5&mech=mlsmpm&lawmech=1&lawg=1&laweos=1&lawp=1&lawt=1&lawr=1&lawv=1&lawst=1&blob=1&residentFuseSequence=1&residentActiveGrid=1&surfaceDraw=three-render-row-spheres&renderer=native-webgpu&visualCapture=1' node scripts/sph-long-horizon-probe.mjs`
  - Passed: `status=good`.
  - Browser console issue/warning counts: `0/0`.
  - Final mounted diagnostics reported
    `reactionProposalNeighborMode=fixed-capacity-particle-bin-grid`,
    `reactionParticleBinGridStatus=reaction-particle-bin-grid-prepared`, and
    `reactionParticleBinGridCellCount=343`.

Reaction-bin overflow metadata debug readback, 2026-06-20 AKDT:

- Syntax:
  `node --check src/runtime/sph/sphReactionGpuKernel.js`
  passed.
- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  passed.
- Syntax:
  `node --check src/visualization/sphPhaseScene.js`
  passed.
- Syntax:
  `node --check src/visualization/sphPhaseDemoMount.js`
  passed.
- Syntax:
  `node --check scripts/sph-long-horizon-probe.mjs`
  passed.
- Focused resident/reaction/mount tests:
  `node --test tests/sphReactionGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseDemoMountRemoteRefresh.test.mjs`
  - Passed: `86/86`.
  - Covers reaction wrapper forwarding and resident MLS-MPM propagation of
    `reactionParticleBinMetadataReadback`.
- Browser reaction-bin metadata probe:
  `ULG_PROBE_OUTPUT=/tmp/ulg-reaction-bin-metadata-browser-probe-final.json ULG_PROBE_PORT=5677 ULG_PROBE_TIMEOUT_MS=90000 ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=1 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_REACTION_BIN_METADATA_READBACK=1 ULG_PROBE_FAIL_ON_BAD=0 ULG_PROBE_URL='/?drop=Na&base=h2o&dropt=290&baset=290&iceh=0&ironh=1.5&boxx=5&boxy=5&boxz=5&dropn=3&basen=5&mech=mlsmpm&lawmech=1&lawg=1&laweos=1&lawp=1&lawt=1&lawr=1&lawv=1&lawst=1&blob=1&residentFuseSequence=1&residentActiveGrid=1&surfaceDraw=three-render-row-spheres&renderer=native-webgpu&visualCapture=1' node scripts/sph-long-horizon-probe.mjs`
  - Passed: `status=good`.
  - Browser console issue/warning counts: `0/0`.
  - Final mounted diagnostics reported
    `reactionParticleBinOverflowStatus=particle-bin-overflow-readback-completed`,
    `reactionParticleBinOverflowCount=0`, and
    `reactionParticleBinOverflowMetadataReadbackRequested=true`.

Three render-row no-full retention slice, 2026-06-20 AKDT:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`
  passed.
- Focused renderer tests:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "render-row particle|render-row sphere|resident render source"`
  - Passed: `69/69`.
  - Covers first-frame full readback for Three render-row particles and
    steady-state no-full retention when a matching bridge is already visible.
- Whitespace:
  `git diff --check -- src/visualization/sphPhaseScene.js tests/sphPhaseRenderer.test.mjs`
  passed.
- Browser retention probe:
  `ULG_PROBE_OUTPUT=/tmp/ulg-render-row-retain-browser-probe.json ULG_PROBE_PORT=5679 ULG_PROBE_TIMEOUT_MS=120000 ULG_PROBE_BATCHES=2 ULG_PROBE_BATCH_STEPS=1 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_REACTION_BIN_METADATA_READBACK=0 ULG_PROBE_FAIL_ON_BAD=0 ULG_PROBE_URL='/?drop=Na&base=h2o&dropt=290&baset=290&iceh=0&ironh=1.5&boxx=5&boxy=5&dropn=3&basen=5&mech=mlsmpm&lawmech=1&lawg=1&laweos=1&lawp=1&lawt=1&lawr=1&lawv=1&lawst=1&blob=1&residentFuseSequence=1&residentActiveGrid=1&surfaceDraw=three-render-row-spheres&renderer=native-webgpu&visualCapture=1' node scripts/sph-long-horizon-probe.mjs`
  - Browser console issue/warning counts: `0/0`.
  - Final retained surface draw at `timeline.metrics[2].surfaceDraw` reported
    `status=resident-render-row-three-bridge-retained-no-full-readback`,
    `visibleRendererBridge=three-render-row-spheres`,
    `renderRowsReadbackEffectiveMode=no-full-readback`,
    `renderRowsReadbackForcedForThreeBridge=false`,
    `renderRowsReadbackRetainedPreviousBridge=true`,
    `sourceResidentRenderSourceStatus=resident-render-source-stale-or-unknown`,
    and `sourceResidentRetainedPrevious=true`.
  - Overall probe status remains `bad` because this interim retained-Three path
    intentionally lacks fresh CPU motion evidence (`resident-render-source-stale`,
    `missing-max-speed`, `no-positive-displacement`).

Native consumer device reuse and no-full evidence slice, 2026-06-20 AKDT:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`
  passed.
- Syntax:
  `node --check scripts/sph-long-horizon-probe.mjs`
  passed.
- Native harness tests:
  `node --test tests/nativeSurfaceHarness.test.mjs`
  - Passed: `5/5`.
  - Covers automatic browser-frame capture for native validation, in-memory PNG
    analysis, submit-fence pacing guards, native consumer device reuse, and
    no-full render-source evidence over advancing metric time.
- Focused renderer tests:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "native WebGPU|renderer-owned|render-row|resident render source"`
  - Passed: `69/69`.
- Browser native no-full probe:
  `ULG_PROBE_OUTPUT=/tmp/ulg-native-device-reuse-probe-2.json ULG_PROBE_PORT=5683 ULG_PROBE_TIMEOUT_MS=120000 ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=1 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_NATIVE_SURFACE_VALIDATION_WAIT_MS=2500 ULG_PROBE_FAIL_ON_BAD=0 ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=290&baset=290&iceh=0&ironh=1.5&boxx=5&boxy=5&dropn=3&basen=5&mech=mlsmpm&lawmech=1&lawg=1&laweos=1&lawp=1&lawt=1&lawr=1&lawv=1&lawst=1&blob=1&residentFuseSequence=1&residentActiveGrid=1&surfaceDraw=native-webgpu-surface-consumer&renderer=native-webgpu&visualCapture=1' node scripts/sph-long-horizon-probe.mjs`
  - Passed: `status=good`.
  - Browser console issue count: `0`.
  - `analysis.issues=[]`.
  - `residentNoReadbackRenderSourceEvidenceAvailable=true`.
  - `residentRenderSourceCurrentSampleCount=2`.
  - `residentRenderSourceStaleSampleCount=0`.
  - `residentRenderSourceMetricTimeDeltaS=0.0005`.
  - The final native surface draw reports
    `sourceResidentRenderSourceStatus=resident-render-source-current`,
    `sourceResidentExecutionGenerationMatchesCurrent=true`,
    `renderBridgeStatus=native-webgpu-surface-consumer-ready`, and
    `renderBridgeLastRenderStatus=native-webgpu-surface-consumer-rendered`.
- Build:
  `npm run build`
  - Passed with the existing large chunk warning only.
- ICC:
  `npm run icc:update`
  - Passed with `indexedFiles=354` and `memoryChunks=2102`.

Native marching-cubes vertex-row budget slice, 2026-06-20 AKDT:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`
  passed.
- Syntax:
  `node --check scripts/sph-performance-benchmark.mjs`
  passed.
- Syntax:
  `node --check scripts/sph-long-horizon-probe.mjs`
  passed.
- Focused renderer/native tests:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "native marching|native WebGPU|renderer-owned|render-row|resident render source"`
  - Passed: `70/70`.
  - Covers the native marching-cubes conservative row-budget helper, including
    the exact 64^3 -> 240,045,120-byte upper-bound regression number.
- Native harness tests:
  `node --test tests/nativeSurfaceHarness.test.mjs`
  - Passed: `5/5`.
- Browser native 10k benchmark:
  `ULG_BENCH_OUTPUT=/tmp/ulg-native-10k-bench-budgeted-surface.json ULG_BENCH_PORT=5685 ULG_BENCH_TIMEOUT_MS=240000 ULG_BENCH_PARTICLE_COUNTS=10000 ULG_BENCH_BATCHES=3 ULG_BENCH_BATCH_STEPS=1 ULG_BENCH_SURFACE_DRAW_MODE=native-webgpu-surface-consumer ULG_BENCH_COMPACT_SUMMARY_MODE=none ULG_BENCH_ACTIVE_GRID_PLAN_REFRESH_MODE=final-only ULG_BENCH_LAW_THERMAL=1 ULG_BENCH_LAW_REACTIONS=1 ULG_BENCH_LAW_VISCOSITY=1 ULG_BENCH_LAW_SURFACE_TENSION=0 ULG_BENCH_FAIL_ON_ERROR=0 npm run bench:sph-performance`
  - Passed: `status=good`, `probeStatus=good`.
  - Browser console issue count: `0`.
  - Actual particles: `9826`.
  - `estimatedReadbackBytesPerStep=0`.
  - `surfaceDrawNativeMarchingCubesSurfaceTableBudgetStatus=native-marching-cubes-surface-table-resolution-budgeted`.
  - `surfaceDrawNativeMarchingCubesSurfaceTableMaxResolution=23`.
  - `surfaceDrawNativeMarchingCubesMaxVertexRowsBufferByteLength=33554432`.
  - `surfaceDrawNativeMarchingCubesEstimatedMaxVertexRowsBufferByteLength=30666240`.
  - `surfaceDrawCompactedVertexRowsBufferByteLength=10222080`.
  - `surfaceDrawVertexCount=159720`.
  - `surfaceDrawTriangleCount=53240`.
- Build:
  `npm run build`
  - Passed with the existing large chunk warning only.
- Whitespace:
  `git diff --check`
  passed.
- ICC:
  `npm run icc:update`
  - Passed with `indexedFiles=354` and `memoryChunks=2104`.

Direct compact-position native surface draw slice, 2026-06-20 AKDT:

- Syntax:
  `node --check src/runtime/sph/sphMarchingCubesSurfaceAdapter.js`
  passed.
- Syntax:
  `node --check src/visualization/sphPhaseScene.js`
  passed.
- Syntax:
  `node --check scripts/sph-performance-benchmark.mjs`
  passed.
- Syntax:
  `node --check scripts/sph-long-horizon-probe.mjs`
  passed.
- Adapter tests:
  `node --test tests/sphMarchingCubesSurfaceAdapter.test.mjs`
  - Passed: `19/19`.
  - Covers metadata-only compact direct draw, no allocation of
    `ulg-sph-extension-surface-vertices`, retained extension compact position
    source metadata, and retained draw/indirect buffer lease cleanup.
- Focused renderer tests:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "compact-position|surface buffer handoff"`
  - Passed: `71/71`.
  - Covers compact-position native WGSL, PBR/optical fragment path retention,
    triangle-normal derivation, and direct compact-position handoff readiness.
- Browser native 10k benchmark:
  `ULG_BENCH_OUTPUT=/tmp/ulg-native-10k-bench-direct-compact-v2.json ULG_BENCH_PORT=5687 ULG_BENCH_TIMEOUT_MS=240000 ULG_BENCH_PARTICLE_COUNTS=10000 ULG_BENCH_BATCHES=3 ULG_BENCH_BATCH_STEPS=1 ULG_BENCH_SURFACE_DRAW_MODE=native-webgpu-surface-consumer ULG_BENCH_COMPACT_SUMMARY_MODE=none ULG_BENCH_ACTIVE_GRID_PLAN_REFRESH_MODE=final-only ULG_BENCH_LAW_THERMAL=1 ULG_BENCH_LAW_REACTIONS=1 ULG_BENCH_LAW_VISCOSITY=1 ULG_BENCH_LAW_SURFACE_TENSION=0 ULG_BENCH_FAIL_ON_ERROR=0 npm run bench:sph-performance`
  - Passed: `status=good`, `probeStatus=good`.
  - Browser console issue count: `0`.
  - Actual particles: `9826`.
  - `estimatedReadbackBytesPerStep=0`.
  - `validResidentSurfaceBufferHandoff=true`.
  - `surfaceDrawRenderBridgeExternalGpuBufferInputLayout=webgpu-marching-cubes-compact-position-rows`.
  - `surfaceDrawDirectCompactPositionDraw=true`.
  - `surfaceDrawCompactedVertexRowsBufferByteLength=0`.
  - `surfaceDrawCompactPositionRowsBufferByteLength=2555520`.
  - `surfaceDrawCompactPositionRowsVertexCount=159720`.
  - `surfaceDrawCompactPositionRowsStrideFloats=4`.
  - Native bridge rendered through `native-webgpu-surface-consumer-rendered`.
- Combined focused tests:
  `node --test tests/sphMarchingCubesSurfaceAdapter.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed: `90/90`.
- Build:
  `npm run build`
  - Passed with the existing large chunk warning only.
- Whitespace:
  `git diff --check`
  passed.

Al/O2 and Cl2 condensed product browser acceptance, 2026-06-20 AKDT:

- Syntax:
  `node --check src/visualization/sphMaterialOptions.js`
  passed.
- Syntax:
  `node --check tests/sphMaterialOptions.test.mjs`
  passed.
- Syntax:
  `node --check tests/demo.e2e.mjs`
  passed.
- Syntax:
  `node --check tests/reactionDiscovery.test.mjs`
  passed.
- Material options:
  `node --test tests/sphMaterialOptions.test.mjs`
  - Passed: `4/4`.
- Whitespace:
  `git diff --check -- tests/demo.e2e.mjs tests/reactionDiscovery.test.mjs src/visualization/sphMaterialOptions.js tests/sphMaterialOptions.test.mjs`
  passed.
- Browser:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs tests/demo.e2e.mjs --grep "SPH phase mounted non-water binary reactions retain condensed product events" --timeout 540000`
  - Passed: `1/1` in `3.9m`.
  - Covers Mg/O2 -> MgO, hot Al/O2 -> Al2O3, and hot Na/Cl2 -> NaCl mounted no-full resident
    product-event retention, render-bound product buffers, zero gas-product
    ledgers, and decoded condensed product render rows.

Three render-row live motion regression, 2026-06-20 AKDT:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js`
  passed.
- Syntax:
  `node --check tests/sphPhaseRenderer.test.mjs`
  passed.
- Syntax:
  `node --check tests/demo.e2e.mjs`
  passed.
- Focused renderer tests:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "render-row particle|render-row sphere|resident render source"`
  - Passed: `71/71`.
  - The readback planner now keeps Three point/sphere particle modes on
    `full-parity-readback` even when a previous Three bridge is visible.
- Browser:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs tests/demo.e2e.mjs --grep "resident auto Three sphere bridge refreshes visible rows" --timeout 240000`
  - Passed: `1/1`.
  - Covers resident auto `three-render-row-spheres` refreshing from newer live
    resident physics rows, with
    `renderRowsReadbackEffectiveMode=full-parity-readback`,
    `renderRowsReadbackRetainedPreviousBridge=false`, and decoded center motion
    between sampled render refreshes.

Same-device native consumer probe telemetry, 2026-06-20 AKDT:

- Syntax:
  `node --check scripts/sph-performance-benchmark.mjs`
  passed.
- Syntax:
  `node --check scripts/sph-long-horizon-probe.mjs`
  passed.
- Whitespace:
  `git diff --check -- scripts/sph-performance-benchmark.mjs scripts/sph-long-horizon-probe.mjs`
  passed.
- Browser:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs tests/demo.e2e.mjs --grep "native same-device surface consumer publishes browser-frame validation readiness" --timeout 300000`
  - Passed: `1/1`.
  - Rechecks that the scene still publishes
    `surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImport*` fields for the
    native engine-owned main-canvas consumer. The benchmark and long-horizon
    probe now flatten those fields into artifact output.
- Benchmark:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 ULG_PROBE_BASE_URL=https://127.0.0.1:5173 ULG_BENCH_OUTPUT=/tmp/ulg-native-same-device-telemetry-bench.json ULG_BENCH_PARTICLE_COUNTS=100 ULG_BENCH_BATCHES=1 ULG_BENCH_BATCH_STEPS=1 ULG_BENCH_TIMEOUT_MS=180000 ULG_BENCH_SURFACE_DRAW_MODE=native-webgpu-surface-consumer ULG_BENCH_COMPACT_SUMMARY_MODE=none ULG_BENCH_ACTIVE_GRID_PLAN_REFRESH_MODE=final-only ULG_BENCH_LAW_THERMAL=1 ULG_BENCH_LAW_REACTIONS=1 ULG_BENCH_LAW_VISCOSITY=1 ULG_BENCH_LAW_SURFACE_TENSION=0 ULG_BENCH_FAIL_ON_ERROR=0 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run bench:sph-performance`
  - Passed as benchmark suite `status=complete`; scenario `status=good`.
  - New artifact fields report same-device import selected `true`, route
    `native-webgpu-surface-consumer`, thread `main-thread`, device scope
    `engine-owned-native-webgpu-canvas-device`, and status
    `same-device-main-thread-import-awaiting-pixel-validation`.
  - Probe status remains `bad` for the existing
    `native-surface-browser-frame-validation-failed` blocker; browser console
    issue count stayed `0` and estimated readback bytes stayed `0`.

Native browser-frame capture unsupported classification, 2026-06-20 AKDT:

- Syntax:
  `node --check scripts/sph-long-horizon-probe.mjs`
  passed.
- Syntax:
  `node --check src/visualization/sphPhaseScene.js`
  passed.
- Syntax:
  `node --check tests/sphPhaseRenderer.test.mjs`
  passed.
- Focused renderer tests:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "visible GPU surface consumer"`
  - Passed: `71/71`.
  - Covers the new `unsupported` pixel-validation status mapping to
    `browser-frame-validation-capture-unsupported`.
- Browser:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs tests/demo.e2e.mjs --grep "native same-device surface consumer publishes browser-frame validation readiness" --timeout 300000`
  - Passed: `1/1`.
  - Rechecks browser-frame validation publication through the mounted scene API.
- Benchmark:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 ULG_PROBE_BASE_URL=https://127.0.0.1:5173 ULG_BENCH_OUTPUT=/tmp/ulg-native-same-device-telemetry-bench-unsupported.json ULG_BENCH_PARTICLE_COUNTS=100 ULG_BENCH_BATCHES=1 ULG_BENCH_BATCH_STEPS=1 ULG_BENCH_TIMEOUT_MS=180000 ULG_BENCH_SURFACE_DRAW_MODE=native-webgpu-surface-consumer ULG_BENCH_COMPACT_SUMMARY_MODE=none ULG_BENCH_ACTIVE_GRID_PLAN_REFRESH_MODE=final-only ULG_BENCH_LAW_THERMAL=1 ULG_BENCH_LAW_REACTIONS=1 ULG_BENCH_LAW_VISCOSITY=1 ULG_BENCH_LAW_SURFACE_TENSION=0 ULG_BENCH_FAIL_ON_ERROR=0 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run bench:sph-performance`
  - Passed as benchmark suite `status=complete`; scenario `status=good`.
  - Probe status remains `bad`, but the native browser-frame issue is now
    `native-surface-browser-frame-validation-unsupported` instead of a failed
    render; scene telemetry reports pixel validation `unsupported` and blocker
    family `browser-frame-validation-capture-unsupported`.

Native benchmark stable browser-frame viewport, 2026-06-20 AKDT:

- Syntax:
  `node --check scripts/sph-performance-benchmark.mjs`
  passed.
- Syntax:
  `node --check scripts/sph-long-horizon-probe.mjs`
  passed.
- Whitespace:
  `git diff --check -- scripts/sph-performance-benchmark.mjs scripts/sph-long-horizon-probe.mjs`
  passed.
- Benchmark:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 ULG_PROBE_BASE_URL=https://127.0.0.1:5173 ULG_BENCH_OUTPUT=/tmp/ulg-native-same-device-telemetry-bench-stable-viewport-coherent.json ULG_BENCH_PARTICLE_COUNTS=100 ULG_BENCH_BATCHES=1 ULG_BENCH_BATCH_STEPS=1 ULG_BENCH_TIMEOUT_MS=180000 ULG_BENCH_SURFACE_DRAW_MODE=native-webgpu-surface-consumer ULG_BENCH_COMPACT_SUMMARY_MODE=none ULG_BENCH_ACTIVE_GRID_PLAN_REFRESH_MODE=final-only ULG_BENCH_LAW_THERMAL=1 ULG_BENCH_LAW_REACTIONS=1 ULG_BENCH_LAW_VISCOSITY=1 ULG_BENCH_LAW_SURFACE_TENSION=0 ULG_BENCH_FAIL_ON_ERROR=0 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run bench:sph-performance`
  - Passed as benchmark suite `status=complete`; scenario `status=good`; probe
    `status=good`.
  - Reports `probeViewport` `320x240`, no probe issues, visible native GPU
    consumer ready `true`, same-device import
    `same-device-main-thread-import-ready`, pixel validation `passed`, blocker
    family `null`, browser console issue count `0`, and zero estimated
    readback bytes.
- Larger benchmark:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 ULG_PROBE_BASE_URL=https://127.0.0.1:5173 ULG_BENCH_OUTPUT=/tmp/ulg-native-same-device-10k-stable-viewport.json ULG_BENCH_PARTICLE_COUNTS=10000 ULG_BENCH_BATCHES=1 ULG_BENCH_BATCH_STEPS=1 ULG_BENCH_TIMEOUT_MS=240000 ULG_BENCH_SURFACE_DRAW_MODE=native-webgpu-surface-consumer ULG_BENCH_COMPACT_SUMMARY_MODE=none ULG_BENCH_ACTIVE_GRID_PLAN_REFRESH_MODE=final-only ULG_BENCH_LAW_THERMAL=1 ULG_BENCH_LAW_REACTIONS=1 ULG_BENCH_LAW_VISCOSITY=1 ULG_BENCH_LAW_SURFACE_TENSION=0 ULG_BENCH_FAIL_ON_ERROR=0 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run bench:sph-performance`
  - Passed with actual particles `9826`, suite `status=complete`, scenario
    `status=good`, probe `status=good`, no probe issues, visible native GPU
    consumer ready `true`, same-device import
    `same-device-main-thread-import-ready`, pixel validation `passed`, blocker
    family `null`, browser console issue count `0`, and zero estimated
    readback bytes.
- Mobile-shaped benchmark:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 ULG_PROBE_BASE_URL=https://127.0.0.1:5173 ULG_BENCH_OUTPUT=/tmp/ulg-native-same-device-mobile-shaped-stable-viewport.json ULG_BENCH_PARTICLE_COUNTS=100 ULG_BENCH_BATCHES=1 ULG_BENCH_BATCH_STEPS=1 ULG_BENCH_TIMEOUT_MS=180000 ULG_BENCH_SURFACE_DRAW_MODE=native-webgpu-surface-consumer ULG_BENCH_VIEWPORT_WIDTH=390 ULG_BENCH_VIEWPORT_HEIGHT=844 ULG_BENCH_DEVICE_SCALE_FACTOR=2 ULG_BENCH_IS_MOBILE=1 ULG_BENCH_HAS_TOUCH=1 ULG_BENCH_COMPACT_SUMMARY_MODE=none ULG_BENCH_ACTIVE_GRID_PLAN_REFRESH_MODE=final-only ULG_BENCH_LAW_THERMAL=1 ULG_BENCH_LAW_REACTIONS=1 ULG_BENCH_LAW_VISCOSITY=1 ULG_BENCH_LAW_SURFACE_TENSION=0 ULG_BENCH_FAIL_ON_ERROR=0 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run bench:sph-performance`
  - Passed as suite `status=complete`; scenario `status=good`; probe
    `status=good`.
  - Reports mobile-shaped viewport `390x844`, device scale factor `2`, touch
    enabled, stable native probe viewport `320x240`, visible native GPU
    consumer ready `true`, same-device import
    `same-device-main-thread-import-ready`, pixel validation `passed`, blocker
    family `null`, browser console issue count `0`, and zero estimated
    readback bytes.

Fixed-support water incompressibility clean break, 2026-06-22 AKDT:

- Unit:
  `node --test tests/mlsMpmCarrier.test.mjs`
  - Passed: `2/2`.
  - Confirms the CPU carrier keeps water within the condensed
    `1 +/- 0.005` volume-ratio envelope.
- Unit:
  `node --test tests/sphG2pGpuKernel.test.mjs`
  - Passed: `17/17` when first run, and passed again as part of the combined
    carrier/G2P command below.
  - Confirms the CPU G2P path and WGSL source guard use the tighter condensed
    `J` clamp.
- Focused demo:
  `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "ambient water|initial particle spacing|liquid|MLS-MPM sound-speed|hydrostatic"`
  - Passed: `46/46`.
- Focused physics invariants:
  `node --test --test-name-pattern "H2O/H2O mechanics|H2O/H2O EOS-on|long-horizon liquid acceptance" tests/physicsBehaviorInvariants.test.mjs`
  - Passed focused non-opt-in checks; long liquid checks skipped unless their
    opt-in env is present.
- Long liquid atomic:
  `ULG_RUN_LONG_LIQUID_ATOMIC=1 node --test --test-name-pattern "H2O/H2O long-horizon liquid acceptance" tests/physicsBehaviorInvariants.test.mjs`
  - Passed: `2/2`.
- Focused grid pressure:
  `node --test tests/sphGridGpuKernel.test.mjs --test-name-pattern "pressure|hydrostatic|fluid|liquid|condensed|P2G|MLS-MPM"`
  - Passed: `21/21`.
- Focused GPU buffer mechanics:
  `node --test tests/sphGpuBuffers.test.mjs --test-name-pattern "MLS-MPM GPU mechanics buffer|mechanics"`
  - Passed: `10/10`.
- Combined recheck:
  `node --test tests/mlsMpmCarrier.test.mjs tests/sphG2pGpuKernel.test.mjs`
  - Passed: `19/19`.
- Project atomics:
  `npm run test:physics-atomics`
  - Passed: `11/14`, with the 3 long-horizon liquid checks skipped unless
    `ULG_RUN_LONG_LIQUID_ATOMIC=1` is set.
  - The run initially exposed a stale plain-SPH solid-H2O fixture placement
    (`0.25 m` initial support gap). The fixture now derives contact height from
    the material-derived base block edge, then the npm gate passed.
- Mounted browser no-full H2O/H2O:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 ULG_PROBE_BASE_URL=https://127.0.0.1:5173 ULG_PROBE_OUTPUT=/tmp/ulg-water-incompressible-nofull-probe.json ULG_PROBE_FRAME_DIR=/tmp/ulg-water-incompressible-nofull-frames ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&visualCapture=1&residentAuto=0&mech=mlsmpm' ULG_PROBE_BATCHES=4 ULG_PROBE_BATCH_STEPS=32 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_COMPACT_SUMMARY_MODE=every-step ULG_PROBE_COMPACT_SUMMARY_SCOPE=particle-visual ULG_PROBE_MIN_J=0.995 ULG_PROBE_MAX_J=1.005 ULG_PROBE_MIN_VISUAL_FRAME_TIME_SPAN_S=0.05 ULG_PROBE_FAIL_ON_BAD=1 node scripts/sph-long-horizon-probe.mjs`
  - Passed with status `good`, no issues, no browser console issues,
    `minVolumeObservedJ=0.998684823513031`,
    `maxVolumeObservedJ=1.0049999952316284`,
    `maxSpeedObservedMPerS=0.739406943321228`,
    `maxDisplacementObservedM=0.00036962516605854034`, resident render source
    advanced, and all seven captured frames nonblank.
- Mounted browser sphere H2O/H2O:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 ULG_PROBE_BASE_URL=https://127.0.0.1:5173 ULG_PROBE_OUTPUT=/tmp/ulg-water-spheres-probe.json ULG_PROBE_FRAME_DIR=/tmp/ulg-water-spheres-frames ULG_PROBE_URL='/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&visualCapture=1&residentAuto=0&mech=mlsmpm&surfaceDraw=three-render-row-spheres' ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MODE=three-render-row-spheres ULG_PROBE_BATCHES=2 ULG_PROBE_BATCH_STEPS=16 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_READBACK_MODE=no-full-readback ULG_PROBE_RENDER_ROWS_READBACK_MODE=no-full-readback ULG_PROBE_COMPACT_SUMMARY_MODE=every-step ULG_PROBE_COMPACT_SUMMARY_SCOPE=particle-visual ULG_PROBE_MIN_J=0.995 ULG_PROBE_MAX_J=1.005 ULG_PROBE_MIN_VISUAL_FRAME_TIME_SPAN_S=0.01 ULG_PROBE_FAIL_ON_BAD=1 node scripts/sph-long-horizon-probe.mjs`
  - Passed with status `good`, no issues, no browser console issues, visible
    sphere frames, `surfaceDrawStatus=resident-render-row-spheres-built`,
    `surfaceDrawRenderBridgeSpherePbrMaterialSource=closure-derived-pbr`,
    `surfaceDrawRenderBridgeSphereClosurePbr=true`, variable sphere sizing, and
    152 decoded liquid H2O render rows.
- Mounted browser full-readback H2O/H2O:
  same scenario with `ULG_PROBE_READBACK_MODE=full-parity-readback` timed out
  before completing the first 32-step batch. It did capture nonblank
  sky-blue/grid frames, but it is not an accepted physics gate for this
  scenario.

Presentation-worker retained continuation, 2026-06-29 12:01 AKDT:

- Syntax:
  `node --check src/visualization/sphPhaseScene.js && node --check scripts/sph-long-horizon-probe.mjs && node --check scripts/sph-performance-benchmark.mjs && node --check tests/nativeSurfaceHarness.test.mjs`
  - Passed.
- Focused worker/presentation source and worker-lane tests:
  `node --test tests/nativeSurfaceHarness.test.mjs tests/offscreenPresentationBridge.test.mjs tests/ulgMechanicsResidentStageWorker.test.mjs`
  - Passed: `24/24`.
- Live HTTPS retained continuation benchmark:
  `NODE_TLS_REJECT_UNAUTHORIZED=0 ULG_PROBE_BASE_URL=https://127.0.0.1:5173 ULG_BENCH_RENDER_OWNERSHIP=presentation-worker-retained-output-presentation-only ULG_BENCH_WORKER_OFFSCREEN_PRESENTATION=1 ULG_BENCH_SURFACE_DRAW_MODE=three-render-row-points ULG_BENCH_OUTPUT=/tmp/ulg-presentation-retained-continuation-bench.json ULG_BENCH_PARTICLE_COUNTS=16 ULG_BENCH_BATCHES=1 ULG_BENCH_BATCH_STEPS=1 ULG_BENCH_COMPACT_SUMMARY_MODE=none ULG_BENCH_LAW_THERMAL=0 ULG_BENCH_LAW_REACTIONS=0 ULG_BENCH_LAW_VISCOSITY=0 ULG_BENCH_LAW_SURFACE_TENSION=0 ULG_BENCH_FAIL_ON_ERROR=0 npm run bench:sph-performance`
  - Passed with scenario `status=good`, `probeStatus=good`,
    `probeIssues=[]`,
    `workerOffscreenRetainedStatePromotionAdmissionStatus=presentation-worker-retained-state-promotion-admission-published`,
    `workerOffscreenRetainedStatePromotionAdmissionCommitted=true`,
    `workerOffscreenRetainedStateContinuationStatus=presentation-worker-retained-state-continuation-completed`,
    `workerOffscreenRetainedStateContinuationPlanStatus=same-worker-retained-continuation-ready`,
    `workerOffscreenRetainedStateContinuationInputStatus=applied-worker-retained-g2p-input`,
    `workerOffscreenRetainedStateContinuationApplied=true`, and
    `workerOffscreenRetainedStateContinuationChainStatus=worker-offscreen-mechanics-stage-chain-completed`.
