# Pressure Publication WebGPU-Retained Only - 2026-06-15

## Completed

- Tightened pressure/interface Worker compact publication candidate readiness
  so it requires a WebGPU backend, no-full readback, worker-ready residency,
  non-mutating pressure authority, retained pressure refs, and an explicit
  retained GPU force-row buffer descriptor.
- Changed CPU-reference or cloneable pressure force-row arrays from a possible
  publication shape into a blocked copy/consumer protocol for the
  worker-retained path.
- Tightened `publishWorkerRetainedPressureInterfaceStageOutput()` so
  NodeKernel/StateManager publication rejects pressure candidates unless they
  carry `worker-lane-gpu-buffer-retained` residency and
  `same-worker-lane-retained-buffer-ref` access.
- Updated PeerCompute integration coverage to prove the pressure stage is
  WebGPU/retained in the stage DAG and that cloneable pressure-row publication
  throws.

## Validation

- PASS: syntax checks for `src/runtime/sph/sphMlsMpmGpuStep.js`,
  `src/runtime/peercomputeBrowserResidentHost.js`, and
  `tests/peercomputeComputeManagerIntegration.test.mjs`.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable|worker-retained pressure/interface"`
  reported `13/13`.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface|stage DAG|resident steps"`
  reported `38/38`.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-publication-webgpu-retained-only-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`, no issues, no visual-surface issues, and two
  captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-pressure-publication-webgpu-retained-only-20260615`.

## Remaining

- Continue pressure/readback reduction toward resident gas-cell/local
  pressure-gradient fields and GPU-resident surface extraction.
- Keep CPU/reference pressure rows as oracle/diagnostic data, not accepted
  worker-retained publication data.
