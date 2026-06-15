# Mounted Gas-Cell EOS Hot Loop - 2026-06-15

## Summary

The mounted resident pressure-interface refresh now requests the
`gasCellEosProducer` stage through the resident authority host when a ready
spatial gas species ledger exists and no ready pressure-interface gas-cell
import has already been supplied.

This keeps the scene in the requester/telemetry role. It does not schedule the
law stage itself and does not mutate accepted distributed state directly.

## Completed

- Added `submitSceneGasCellEosProducerStageForPressureInterface()` as a
  fail-closed scene helper.
- The helper blocks without
  `peercompute.ulg.sph-spatial-gas-species-ledger.v0` cells.
- The helper blocks without
  `residentAuthorityHost.submitGasCellEosProducerStageTask()`.
- Ready submissions pass the gas pressure summary, spatial gas species ledger,
  state key, lane id, WebGPU preference, readback mode, and source metadata to
  the resident authority host.
- Ready producer output is passed into
  `publishScenePressureInterfaceGasCellFieldImportSource()` so the existing
  host-published admission/import path stays authoritative.
- Resident pressure-interface state now reports producer request schema,
  status, blocker, result readiness, retained source readiness, and spatial
  ledger cell count.
- Focused scene tests cover missing-ledger blocking, successful host
  submission, retained gas-pressure refs, worker retained refs, and state
  telemetry.

## Validation

- PASS: `git diff --check`.
- PASS: `node --check src/visualization/sphPhaseScene.js`.
- PASS: `node --check tests/sphPhaseRenderer.test.mjs`.
- PASS:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "gas-cell EOS producer|gas-cell import|gas-cell field"`
  reported `32/32`.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "gas-cell EOS|pressure interface stage .*gas-cell|pressure interface stage declares retained gas-cell|gas-cell field import|pressure interface stage compute task can produce force rows|gas-cell EOS producer before pressureInterface"`
  reported `45/45`.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "EOS producer|gas-cell field imports|worker-retained pressure/interface"`
  reported `15/15`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "real browser PeerCompute resident authority host"`
  reported `1/1` in about `1.3m`.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-mounted-gas-eos-hot-loop-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`, and two
  captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-mounted-gas-eos-hot-loop-20260615`.

## Open

- Normal resident H2O/H2O scenarios still need to produce a ready spatial gas
  species ledger before this producer request can replace every snapshot-
  derived fallback.
- The remaining snapshot-derived gas-cell import fallback should be retired
  from the mounted hot path once the spatial ledger source is present.
- The gas-cell EOS derivation is still CPU/oracle logic plus WebGPU row upload;
  a true WGSL EOS shader remains open.
- Visible physics blockers remain open: MLS-MPM fragmentation, CPU-SPH
  liquid/solid stacked blobs, mounted-route ice/solid rigidity, long-horizon
  settling/free-surface quality, volume pulsation/blinking, and renderer
  z-buffer/focus visual trust.
