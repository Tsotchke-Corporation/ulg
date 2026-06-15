# Spatial Gas Ledger Producer Fallback - 2026-06-15

## Summary

The mounted no-full Na/H2O pressure path now completes the resident
`spatialGasLedgerProducer -> gasCellEosProducer -> pressureInterface gas-cell
import` chain without full product-event readback.

This is a provenance-explicit bridge, not the final local gas plume solution:
positioned compact product-event rows still win, while inactive/positionless
compact rows can fall back to a one-cell sealed-box spatial ledger derived from
the resident aggregate gas species ledger.

## Completed

- Added aggregate gas ledger extraction for spatial ledger producer fallback.
- Added one-cell sealed-box spatial ledger construction with:
  - `spatialGasLedgerDerivation = aggregate-gas-ledger-single-cell-sealed-box`;
  - `spatialGasPositionSource = aggregate-gas-ledger-no-positioned-product-events`.
- Kept the positioned product-event row path tagged as
  `positioned-product-event-rows`.
- Exposed fallback/provenance through scene pressure-interface summary fields.
- Updated the mounted Na/H2O browser gate to assert the fallback provenance.
- Added atomic SPH stage coverage for positionless retained compact rows plus
  aggregate H2 gas ledger.
- Changed public demo defaults to plain SPH CPU reference, sodium over water,
  both `293.15 K`, and blob size `1`.
- Built the GitHub Pages artifact into `docs/`.

## Validation

- PASS: `node --check src/runtime/sph/sphMlsMpmGpuStep.js`.
- PASS: `node --check src/visualization/sphPhaseScene.js`.
- PASS: `node --check src/visualization/sphPhaseDemoMount.js`.
- PASS: `node --check tests/sphMlsMpmGpuStep.test.mjs`.
- PASS: `node --check tests/demo.e2e.mjs`.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "spatial gas ledger|gas-cell EOS producer before pressureInterface|gas-cell EOS producer stage publishes"`
  reported `47/47`.
- PASS:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "spatial gas ledger producer|gas-cell EOS producer|gas-cell import|gas-cell field"`
  reported `34/34`.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "mounted resident Na/H2O promotes product gas pressure"`
  reported `1/1`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-spatial-gas-ledger-producer-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`, and two
  captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-spatial-gas-ledger-producer-20260615`.
- PASS: manual inspection found nonblank bounded visual frames.
- PASS: fresh-browser default probe reported mechanics `sph`, drop `Na`, base
  `h2o`, both temperatures `293.15`, and blob `1`.
- PASS: `npm run build:pages` produced `docs/index.html`,
  `docs/assets/pages-vPnFh9Yy.js`, `docs/assets/pages-DwBf2e9n.css`, and
  `docs/.nojekyll`.
- PASS: `git diff --check`.

## Open

- Replace the aggregate sealed-box fallback with a true GPU/worker positioned
  spatial-gas ledger producer from retained product-event buffers.
- Move gas-cell EOS math into WGSL instead of CPU/oracle derivation plus
  WebGPU row upload.
- Continue visible physics-quality work: MLS-MPM fragmentation, CPU-SPH
  stacked/blob behavior, liquid free-surface settling, solid/ice rigidity,
  volume pulsing/blinking, and renderer z-buffer/focus visual trust.
