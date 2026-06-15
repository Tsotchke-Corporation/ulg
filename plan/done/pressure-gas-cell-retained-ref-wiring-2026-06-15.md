# Pressure Gas-Cell Retained Ref Wiring - 2026-06-15

## Summary

PressureInterface local gas-cell pressure rows now keep their retained-buffer
evidence separated from pressure force-row evidence across task creation,
resident Worker execution, and ComputeManager/GPUHub publication candidates.

## Completed

- Added pressureInterface task retained-ref expansion: local gas-cell
  imports/fields cause `resident-gas-pressure-cells-buffer` to appear in the
  stage GPU fence, resident lane descriptor, and `webgpu.retainedBufferRefs`.
- Mirrored that retained-ref declaration in the resident mechanics Worker when
  stage options contain a local gas-cell field/import.
- Tightened publication-candidate ref classification so camelCase worker refs
  like `result.gasPressureCellsBuffer` are accepted as gas-cell refs, while
  pressure force-row refs only match force-row-specific names.
- Added focused tests for the local gas-cell retained-ref task contract and
  the PeerCompute worker publication candidate ref split.

## Validation

- PASS: `node --check src/runtime/sph/sphMlsMpmGpuStep.js`.
- PASS: `node --check src/services/ulgMechanicsResidentStage.worker.js`.
- PASS: `node --check tests/sphMlsMpmGpuStep.test.mjs`.
- PASS: `node --check tests/peercomputeComputeManagerIntegration.test.mjs`.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage .*gas-cell|pressure interface stage declares retained gas-cell|pressure interface stage compute task can produce force rows with WebGPU|pressure interface stage compute task declares retained"`
  reported `43/43`.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "worker-retained pressure/interface|mechanics-stage-gpuhub-worker-ready|resident pass-DAG task runs through real PeerCompute GPU lane authority|gas-cell field imports"`
  reported `14/14`.
- PASS: `node --test tests/ulgMechanicsResidentStageWorker.test.mjs` reported
  `4/4`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-gas-cell-retained-ref-wire-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0` and no visual-surface issues.
- Manual frame inspection found final captured frames nonblank and bounded.

## Open

- This does not derive real local gas-cell pressure gradients. The next slice
  must build/admit that producer from resident EOS/species/material state.
- MLS-MPM fragmentation, CPU SPH stacked/blob behavior, ice/solid rigidity,
  focus flash/disappear, and remaining z-buffer/draw-order issues remain open.
