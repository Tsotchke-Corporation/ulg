# Pressure/Interface Retained-Buffer Admission Evidence

Date: 2026-06-15 AKDT

## Completed

- WebGPU grid update now requires admitted pressure/interface grid-force
  consumption before applying pressure rows, matching the CPU/reference gate.
- Retained `GPUBuffer` pressure force rows are treated as submitted GPU work
  with unverified no-full impulse evidence, not as a measured zero CPU impulse.
- Empty CPU force-row placeholders no longer override an explicit admitted
  force-row count when a retained pressure buffer is supplied.
- Pressure/interface Worker publication descriptors now include force-row
  stride, byte length, retained-buffer residency, and same-lane consumer
  protocol in StateManager hot records and warm deltas.

## Validation

- PASS: `node --check src/runtime/sph/sphGridUpdateGpuKernel.js`
- PASS: `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
- PASS: `node --check src/runtime/peercomputeBrowserResidentHost.js`
- PASS: `node --check tests/sphGridUpdateGpuKernel.test.mjs`
- PASS: `git diff --check`
- PASS: `node --test tests/sphGridUpdateGpuKernel.test.mjs` reported `14/14`
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface"`
  reported `38/38`
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "pressure/interface"`
  reported `13/13`
- PASS: `node --test tests/ulgMechanicsResidentStageWorker.test.mjs`
  reported `4/4`
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  reported `1/1`
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-retained-buffer-admission-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0` with artifacts under
  `/tmp/ulg-visual-sanity-matrix/codex-pressure-retained-buffer-admission-20260615`

## Follow-Up

- Continue reducing pressure publication/consumption readback surfaces after
  this evidence layer is clean.
