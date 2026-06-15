# Pressure Gas-Cell Publication Admission - 2026-06-15

## Summary

Local gas-cell pressure rows now participate in the pressure/interface
publication contract. When pressure force rows are derived from local pressure
gradients, StateManager publication requires retained Worker-local gas-cell
buffer refs alongside the retained pressure force-row buffer refs.

## Completed

- The WebGPU pressure/interface producer can retain the local gas-cell input
  buffer when force-row retention is requested.
- Pressure stage lane summaries now expose gas-cell row count, row stride,
  byte length, and retained-buffer status.
- Pressure/interface Worker compact publication candidates now fail closed for
  local-gradient pressure unless retained gas-cell refs and row metadata are
  present.
- Browser authority host pressure publication rejects local-gradient
  candidates without retained gas-cell buffers.
- StateManager hot and warm pressure publication records now preserve
  gas-cell refs and row metadata.

## Validation

- PASS: syntax checks for changed runtime/test modules.
- PASS: `node --test tests/sphPressureInterfaceGpuKernel.test.mjs` reported
  `3/3`.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "worker-retained pressure/interface|ULG resident solver descriptors publish executable"`
  reported `13/13`.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage|pressure interface|grid admission|grid force"`
  reported `38/38`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-gas-cell-publication-admission-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`.

## Open

- PressureInterface still receives local gas-cell fields from the caller. Next
  slice should consume admitted retained gas-cell refs from StateManager/GPUHub
  inside the stage DAG.
- Renderer z-buffer/focus-change issues remain separate visual blockers.
