# Mounted No-Snapshot Gas-Cell Imports - 2026-06-15

## Summary

The mounted resident pressure-interface hot path no longer publishes gas-cell
imports from `gasPressureSummary` snapshots.

`publishScenePressureInterfaceGasCellFieldImportSource()` keeps its default
compatibility behavior for explicit helper callers, but mounted refresh passes
`allowSummaryGasCellFieldImport=false`. Mounted gas-cell imports must now come
from a supplied admitted import descriptor or a resident
`gasCellEosProducer` result.

## Completed

- Added `allowSummaryGasCellFieldImport` to the scene gas-cell import helper.
- Default behavior remains compatible with existing explicit callers.
- Mounted pressure-interface refresh disables summary-snapshot gas-cell import
  publication.
- Snapshot candidates report
  `blocked-snapshot-gas-cell-import-disabled` with retained gas-pressure refs
  and snapshot readiness visible for diagnostics.
- Added focused tests proving mounted-style calls block snapshot imports while
  compatibility calls still publish them.

## Validation

- PASS: `git diff --check`.
- PASS: `node --check src/visualization/sphPhaseScene.js`.
- PASS: `node --check tests/sphPhaseRenderer.test.mjs`.
- PASS:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "summary-snapshot|gas-cell EOS producer|gas-cell import|gas-cell field"`
  reported `33/33`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "real browser PeerCompute resident authority host"`
  reported `1/1` in about `1.4m`.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-mounted-no-snapshot-gas-import-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`, and two
  captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-mounted-no-snapshot-gas-import-20260615`.

## Open

- Normal resident scenarios still need to produce a ready spatial gas species
  ledger so the producer route is active in realistic gas/product cases.
- The gas-cell EOS derivation is still CPU/oracle logic plus WebGPU row upload;
  a real WGSL EOS shader remains open.
- Visible physics blockers remain open: MLS-MPM fragmentation, CPU-SPH
  liquid/solid stacked blobs, mounted-route ice/solid rigidity, long-horizon
  settling/free-surface quality, volume pulsation/blinking, and renderer
  z-buffer/focus visual trust.
