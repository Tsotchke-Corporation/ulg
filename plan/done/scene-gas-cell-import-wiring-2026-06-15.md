# Scene Gas-Cell Import Wiring - 2026-06-15

## Summary

The live scene/stage path now requests pressure/interface gas-cell field
imports from the browser resident authority host when resident gas-pressure
telemetry contains a ready local gas-cell gradient field, admitted field
consumption, and retained gas-pressure refs.

## Completed

- Added `publishScenePressureInterfaceGasCellFieldImportSource()` in
  `sphPhaseScene` as a fail-closed bridge from scene telemetry to
  `host.publishPressureInterfaceGasCellFieldImportSource()`.
- Extended resident pressure-interface state summaries and render-state fields
  with gas-cell import publication status, source hot-buffer key, admission
  status, retained refs, and blocker telemetry.
- Threaded the published import/admission through resident mechanics
  scheduling, pressure-interface refresh, and resident render refresh in the
  mounted demo loop.
- Added renderer/scene coverage proving the scene calls the resident authority
  host only when admission and retained gas-cell refs are present.

## Validation

- PASS: `node --check src/visualization/sphPhaseScene.js`.
- PASS: `node --check src/visualization/sphPhaseDemoMount.js`.
- PASS: `node --check tests/sphPhaseRenderer.test.mjs`.
- PASS:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "gas-cell field imports|pressure interface state owns retained force rows|render order|transparent|overlay draw order"`
  reported `28/28`.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "gas-cell field imports|worker-retained pressure/interface force-row descriptors"`
  reported `14/14`.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-scene-gas-cell-import-wire-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0` and no visual-surface issues.
- Manual frame inspection found the final captured frames nonblank and bounded.

## Open

- This wiring does not yet make the resident gas-cell pressure-gradient
  producer publish real retained refs/admission in normal WebGPU execution.
- The short MLS-MPM visual matrix still fragments; CPU SPH still shows
  unphysical stacked/blob behavior. Those remain physics behavior defects.
- Ice flowing like water, phone focus flash/disappear, and remaining
  z-buffer/draw-order issues remain queued visual/physics blockers.
