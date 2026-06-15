# Pressure/Interface Grid Consumption Admission - 2026-06-15

Status: done.

## Scope

Added the explicit authority gate that grid update must satisfy before
pressure/interface force rows can affect MLS-MPM grid momentum.

This is a prior/admitted-descriptor consumer gate. Same-frame intra-DAG
publication/admission of the immediately preceding `pressureInterface` stage
remains open.

## Changes

- Added
  `peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0`.
- Required both solver approval and an admitted/approved pressure force-row
  descriptor before pressure rows are applied to grid momentum.
- Threaded `pressureInterfaceGridForceAdmission` through CPU reference grid
  update, optional WebGPU wrapper, resident-step execution, and the
  grid-update stage compute task.
- Exposed admission schema/status, source hot-buffer key, force-row count,
  applied impulse, and impulse proof diagnostics.
- Updated grid-update stage evidence so direct unadmitted pressure fails while
  admitted/approved pressure consumption passes.

## Validation

- PASS: `node --check src/runtime/sph/sphGridUpdateGpuKernel.js`.
- PASS: `node --check src/runtime/sph/sphMlsMpmGpuStep.js`.
- PASS: `node --check tests/sphMlsMpmGpuStep.test.mjs`.
- PASS: `git diff --check`.
- PASS: `node --test tests/sphMlsMpmGpuStep.test.mjs` reported `37/37`.
- PASS: `node --test tests/peercomputeComputeManagerIntegration.test.mjs`
  reported `13/13`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-interface-grid-consumption-admission-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,solid-h2o-cpu-sph,law-pressure-off-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`; artifacts are under
  `/tmp/ulg-visual-sanity-matrix/codex-pressure-interface-grid-consumption-admission-20260615`.

## Remaining

- Publish/admit same-frame `pressureInterface` force-row output before
  constructing the same stage-plan `gridUpdate` task.
- Keep renderer z-buffer/draw-order work queued separately from this physics
  authority path.
