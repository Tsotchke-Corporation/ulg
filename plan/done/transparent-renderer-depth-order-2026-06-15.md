# Transparent Renderer Depth Order

Date: 2026-06-15 AKDT

## Completed

- Transparent Three/MarchingCubes surfaces now share their base layer render
  order, allowing Three.js to depth-sort overlapping water/vapor/alpha meshes
  by camera depth.
- Opaque surfaces keep deterministic hash-stabilized intra-layer order.
- The diagnostic floor grid no longer writes depth, preventing it from
  contaminating later transparent surface draws.
- Browser e2e now reports and checks transparent surface render-order policy
  and container-grid depth state.

## Validation

- PASS: `node --check src/visualization/sphPhaseScene.js`
- PASS: `node --check tests/sphPhaseRenderer.test.mjs`
- PASS: `node --check tests/demo.e2e.mjs`
- PASS:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "render order|transparent|overlay draw order"`
  reported `26/26`
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  reported `1/1`
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-render-transparent-depth-order-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`

## Follow-Up

- Reproduce the phone focus-change flash/disappear symptom if it still occurs;
  that may be a render lifecycle/context refresh issue rather than surface
  ordering.
