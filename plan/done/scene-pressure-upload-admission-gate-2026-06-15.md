# Scene Pressure-Row Upload Admission Gate - 2026-06-15

## Completed

- Blocked mounted-scene pressure/interface force-row uploads unless grid-force
  consumption is admitted through
  `peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0` and
  the pressure solver is approved for grid application.
- Kept unadmitted pressure/interface force rows as telemetry-only candidates
  with candidate byte length, blocker, admission schema/status, and source hot
  buffer evidence.
- Excluded unadmitted pressure candidates from resident mechanics signatures,
  preventing ComputeManager lane state-key drift from scene-local inadmissible
  data.
- Reused the prior lane-owned state key for browser resident continuations,
  fixing reset/continuation submissions on the same ComputeManager lane.
- Updated browser e2e diagnostics for pressure admission fields, compact
  active-grid availability, and closure-derived transmissive H2O alpha/depth
  policy.
- Recorded the user-reported z-buffer/draw-order follow-up as a still-open
  visual correctness blocker separate from this pressure admission slice.

## Validation

- PASS: syntax checks for `src/visualization/sphPhaseScene.js`,
  `src/runtime/sph/sphGridUpdateGpuKernel.js`,
  `tests/sphPhaseRenderer.test.mjs`, and `tests/demo.e2e.mjs`.
- PASS:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "pressure interface state|pressure force-row|transparent|render order"`
  reported `27/27`.
- PASS:
  `node --test tests/sphGridUpdateGpuKernel.test.mjs --test-name-pattern "pressure interface|grid force"`
  reported `14/14`.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "resident steps|pressure interface|grid admission|grid force"`
  reported `38/38`.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase demo runs derived material properties by default"`
  reported `1/1`.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-scene-pressure-upload-admission-gate-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`, no issues, no visual-surface issues, and two
  captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-scene-pressure-upload-admission-gate-20260615`.

## Remaining

- Continue reducing pressure publication/consumption copies and readbacks under
  ComputeManager/GPUHub authority.
- Keep long-horizon liquid settling and the live-device focus-change
  flash/disappear renderer symptom open; this slice is an admission and
  continuity fix, not final visual or fluid acceptance.
