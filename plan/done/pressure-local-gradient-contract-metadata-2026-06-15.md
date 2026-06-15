# Pressure Local-Gradient Contract Metadata - 2026-06-15

## Summary

The pressure/interface force-row path now distinguishes its current uniform
sealed-gas pressure traction law from the future local gas-cell pressure
gradient coupling path. This keeps the existing pressure law active while
making the missing local-gradient field explicit in runtime evidence.

## Completed

- Added pressure-field resolution metadata to sealed gas pressure feedback:
  `pressureFieldMode="uniform-single-cell-sealed-gas"`,
  `pressureFieldResolution="lumped-sealed-box"`, and blocked local pressure
  gradient fields.
- Threaded local pressure-gradient blocker metadata through
  pressure-interface coupling, CPU pressure force preview, CPU solver, WebGPU
  pressure force-row producer, ComputeManager stage evidence, and lane
  summaries.
- Added focused tests proving the current force rows are uniform interface
  tractions and not validated local pressure-gradient gas-cell coupling.
- Recorded the queued renderer z-buffer/draw-order issue as a separate visual
  correctness blocker.

## Validation

- PASS: syntax checks for changed runtime and test modules.
- PASS:
  `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "sealed gas pressure feedback|gas pressure interface"`
  reported `25/25`.
- PASS: `node --test tests/sphPressureInterfaceGpuKernel.test.mjs` reported
  `2/2`.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage|pressure interface|grid admission|grid force"`
  reported `38/38`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-local-gradient-contract-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`.

## Next

- Implement the resident local gas-cell pressure-gradient field contract and
  make any gradient-coupled pressure force rows execute/admit through
  ComputeManager/GPUHub Worker authority.
- Keep the renderer z-buffer/focus-change pass separate from pressure physics
  acceptance.
