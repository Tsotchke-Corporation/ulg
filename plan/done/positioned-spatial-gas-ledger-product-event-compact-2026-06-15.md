# Positioned Spatial Gas Ledger From Product Events - 2026-06-15

## Summary

The mounted no-full Na/H2O route now derives a positioned spatial gas ledger
from retained product-event rows. This supersedes the temporary sealed-box
aggregate fallback for the main Na/H2O pressure gate.

The compact WebGPU stage now transcodes product-event rows into compact
spatial-gas rows and preserves row status/routing. The decoder performs the
active gas filter and rejects non-gas, inactive, zero-mole, zero-support, or
non-finite-position rows. Missing per-row support volume can be filled from a
derived aggregate gas box-volume share, but the ledger still uses retained row
positions and reports positioned product-event provenance.

## Completed

- Added support-volume fallback metadata for retained product-event rows that
  have valid gas positions and moles but no per-row support volume.
- Changed the compact product-event WebGPU stage to avoid shader-side boolean
  filtering until the Chromium/Dawn predicate behavior is isolated.
- Moved compact-row safety filtering into the JS decoder.
- Kept condensed products from entering gas ledgers by filtering on routing id.
- Updated mounted Na/H2O e2e coverage to expect positioned product-event rows
  instead of aggregate sealed-box fallback.
- Added unit coverage for positioned product-event rows with missing support
  volume.

## Validation

- PASS: `node --check src/runtime/sph/sphMlsMpmGpuStep.js`.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "spatial gas ledger|gas-cell EOS producer before pressureInterface|gas-cell EOS producer stage publishes"`
  reported `48/48`.
- PASS:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "spatial gas ledger producer|gas-cell EOS producer|gas-cell import|gas-cell field"`
  reported `34/34`.
- PASS:
  `node --test tests/ulgMechanicsResidentStageWorker.test.mjs --test-name-pattern "spatial gas ledger|gas-cell EOS producer|pressure interface"`
  reported `6/6`.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "spatial gas|gas-cell|EOS producer|pressure interface"`
  reported `15/15`.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs tests/demo.e2e.mjs --grep "SPH phase mounted resident Na/H2O promotes product gas pressure"`
  reported `1/1`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in skip.
- PASS: fresh browser defaults remained mechanics `sph`, drop `Na`, base
  `h2o`, both material temperatures `293.15`, and blob `1`.
- PASS: `npm run build:pages` completed.
- FAIL/OPEN:
  `/tmp/ulg-visual-sanity-matrix/2026-06-15T18-36-32-215Z` reported
  `failedCount=11` of `12`. This is retained as open visual/physics behavior
  debt rather than treated as a regression introduced by this compact ledger
  slice.

## Open

- Build a reduced browser/WebGPU probe for the compact-row predicate anomaly
  before reintroducing shader-side gas filtering.
- Move gas-cell EOS math into WGSL under the existing ComputeManager/GPUHub
  producer authority.
- Continue P0 visible behavior work: H2O surface identity/bounds, Na/H2O
  high-speed reaction motion, CPU-SPH stacked/blob settling, ice/solid
  rigidity, volume pulsing/blinking, and renderer z-buffer/focus trust.
