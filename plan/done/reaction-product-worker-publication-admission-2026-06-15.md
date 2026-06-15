# Reaction/Product Worker Publication Admission - 2026-06-15

Completed: 2026-06-15 00:13 AKDT.

What changed:

- Added reaction/product Worker-retained publication schemas:
  `peercompute.ulg.reaction-product-worker-retained-buffer-import.v0` and
  `peercompute.ulg.reaction-product-worker-retained-hot-buffer-publication.v0`.
- Added authority-host publication support through
  `publishUlgReactionProductWorkerRetainedHotBufferSource()` and
  `host.publishWorkerRetainedReactionProductStageOutput()`.
- Added a dedicated reaction/product compact publication candidate that
  requires Worker-ready WebGPU no-full execution, a readback-free hot loop,
  retained Worker refs, and a product/resident-product-mass retained-ref
  signal before publication can proceed.
- Wired `gpuHubResidentReactionProductStageWorkerOutputPublisher` into the
  formal mechanics/thermal/reaction stage-chain path and exposed
  reaction/product publication status, hot-buffer key, commit task id, and
  retained product-buffer ref counts on `mechanicsStageTaskChain`.
- Added integration coverage for both the stage-chain publication candidate and
  the authority-host hot-record/warm-delta admission path.

Validation:

- PASS: `node --check src/runtime/sph/sphMlsMpmGpuStep.js`.
- PASS: `node --check src/runtime/peercomputeBrowserResidentHost.js`.
- PASS: `node --check tests/peercomputeComputeManagerIntegration.test.mjs`.
- PASS: `git diff --check`.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  reported `12/12`.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident authority host admits worker-retained reaction/product output descriptors"`
  reported `12/12`.
- PASS: `node --test tests/ulgMechanicsResidentStageWorker.test.mjs`
  reported `3/3`.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS: visual matrix
  `codex-reaction-product-publication-admission-20260615` reported
  `failedCount=0` for `3` filtered scenarios with two captured frames each:
  `liquid-liquid-h2o-mlsmpm`, `solid-h2o-cpu-sph`, and
  `law-pressure-off-h2o-mlsmpm`.

Remaining:

- Promote pressure/interface force-row production and consumption behind the
  same ComputeManager/GPUHub Worker authority.
