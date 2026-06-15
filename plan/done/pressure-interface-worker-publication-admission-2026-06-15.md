# Pressure/Interface Worker Publication Admission - 2026-06-15

Status: done.

## Scope

Added the Worker-retained publication/admission path for pressure/interface
force-row output. This completes descriptor publication only; grid-update
consumption of pressure rows remains a separate authority-gated slice.

## Changes

- Added pressure/interface Worker-retained publication schemas:
  `peercompute.ulg.pressure-interface-worker-retained-buffer-import.v0` and
  `peercompute.ulg.pressure-interface-worker-retained-hot-buffer-publication.v0`.
- Added `publishUlgPressureInterfaceWorkerRetainedHotBufferSource()` and
  `host.publishWorkerRetainedPressureInterfaceStageOutput()`.
- Added
  `peercompute.ulg.sph-pressure-interface-worker-compact-publication-candidate.v0`
  construction for `pressureInterface` stage output.
- Wired `gpuHubResidentPressureInterfaceStageWorkerOutputPublisher` into the
  ComputeManager/GPUHub stage-chain path.
- Exposed pressure publication status, hot-buffer key, retained pressure refs,
  force-row count, and publication authority on `mechanicsStageTaskChain`.
- Preserved `gridForceApplicationApproved=false`; no authoritative grid force
  consumption happens in this slice.

## Validation

- PASS: `node --check src/runtime/peercomputeBrowserResidentHost.js`.
- PASS: `node --check src/runtime/sph/sphMlsMpmGpuStep.js`.
- PASS: `node --check tests/peercomputeComputeManagerIntegration.test.mjs`.
- PASS: `git diff --check`.
- PASS: `node --test tests/peercomputeComputeManagerIntegration.test.mjs`
  reported `13/13`.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-interface-publication-admission-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,solid-h2o-cpu-sph,law-pressure-off-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`; artifacts are under
  `/tmp/ulg-visual-sanity-matrix/codex-pressure-interface-publication-admission-20260615`.

## Remaining

- Add the approved grid-update consumer path. It must consume pressure rows
  only from an admitted pressure/interface descriptor and report force-row
  count, applied impulse, pairwise conservation residuals, and explicit
  authority status.
- Run the recurring browser authority gate, physics atomics, and visual sanity
  matrix before closing the next major slice.
