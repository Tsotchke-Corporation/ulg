# Product-Event Spatial Ledger Source - 2026-06-15

## Summary

Resident product-mass handles now preserve compact product-event and product-
inventory records when those records exist. The preferred resident product-
mass gas-ledger pressure path can derive a spatial gas species ledger from
positioned resident product-event records instead of falling back to only
uniform aggregate sealed-gas pressure.

This enables the resident `gasCellEosProducer` route for compact-record or
CPU/reference product-event paths. It does not yet solve the no-full hot path,
where retained product-event buffers can exist without CPU-side event records.

## Completed

- Preserved `productEvents.records` and `productInventory.records` in
  `createResidentProductMassHandle()`.
- Extended `gasPressureSummaryFromResidentReaction()` so the resident product-
  mass gas-ledger branch derives a
  `peercompute.ulg.sph-spatial-gas-species-ledger.v0` from positioned product
  events when records are available.
- Preferred resident product-mass event records over reaction-summary records
  to avoid double-counting the same event rows.
- Added unit coverage proving the pressure path can keep the aggregate
  resident product-mass gas ledger while also deriving local spatial gas-cell
  EOS pressure from positioned events.
- Updated the mounted Na/H2O browser gate to assert the current no-full
  blocker explicitly: retained product-event rows exist, event records are
  absent, spatial ledger is blocked, producer request is blocked, and snapshot
  import is disabled.

## Validation

- PASS: `git diff --check`.
- PASS: `node --check src/runtime/sphPhaseDemo.js`.
- PASS: `node --check src/runtime/sph/sphReactionGpuSummary.js`.
- PASS: `node --check tests/sphPhaseDemo.test.mjs`.
- PASS: `node --check tests/sphReactionGpuSummary.test.mjs`.
- PASS: `node --check tests/demo.e2e.mjs`.
- PASS:
  `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "spatial gas|resident product-mass gas ledger|resident positioned gas|resident reaction gas pressure"`
  reported `30/30`.
- PASS:
  `node --test tests/sphReactionGpuSummary.test.mjs --test-name-pattern "resident product mass handle|product event"`
  reported `9/9`.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "mounted resident Na/H2O promotes product gas pressure"`
  reported `1/1` in about `52s`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-product-event-spatial-ledger-source-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`, and two
  captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-product-event-spatial-ledger-source-20260615`.

## Open

- The no-full hot path still needs a GPU/worker compact spatial-gas ledger
  producer from retained product-event buffers. The live Na/H2O browser gate
  currently records `productEventRowCount > 0` but `productEvents.records.length
  === 0`, so spatial gas remains blocked without full product-event readback.
- The gas-cell EOS derivation is still CPU/oracle logic plus WebGPU row upload;
  a true WGSL EOS shader remains open.
- Visible physics blockers remain open: MLS-MPM fragmentation, CPU-SPH
  liquid/solid stacked blobs, mounted-route ice/solid rigidity, long-horizon
  settling/free-surface quality, volume pulsation/blinking, and renderer
  z-buffer/focus visual trust.
