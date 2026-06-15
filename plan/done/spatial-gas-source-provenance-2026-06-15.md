# Spatial Gas Source Provenance

Date: 2026-06-15 AKDT

## Summary

Spatial gas-cell source provenance now flows from retained product-event
buffers through the local gas EOS path. Positioned gas product events backed by
an actual retained product-event buffer mark the spatial gas species ledger,
derived local gas-cell pressure field, and pressure feedback gas-cell field
with the retained source ref. Synthetic ledgers and aggregate sealed-gas
summaries remain unretained.

This keeps product/source buffer refs separate from pressure gas-cell refs so
the next retained ComputeManager/GPUHub producer can publish a lane-owned
spatial gas-cell source through StateManager without caller fabrication.

## Files Touched

- `src/runtime/sphPhaseDemo.js`
- `tests/sphPhaseDemo.test.mjs`
- `plan/plan.md`
- `plan/todo/README.md`
- `plan/implementation-status.md`
- `plan/tests.md`
- `plan/log.md`

## Validation

- PASS: `node --check src/runtime/sphPhaseDemo.js`.
- PASS: `node --check tests/sphPhaseDemo.test.mjs`.
- PASS:
  `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "spatial gas|positioned gas|gas pressure"`
  reported `29/29`.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage .*gas-cell|pressure interface stage declares retained gas-cell|gas-cell field import|local gas-cell|pressure interface stage compute task can produce force rows"`
  reported `43/43`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-spatial-gas-source-provenance-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`, `issues=[]`, and `visualSurfaceIssues=[]`.

## Open

- The spatial gas-cell ledger/field still needs to become a retained
  ComputeManager/GPUHub output with real worker/local GPU refs.
- The quick visual matrix is a regression sanity check only. MLS-MPM
  fragmentation, CPU SPH stacked/blob shape, long-horizon liquid settling, and
  renderer z-buffer/focus visual-trust blockers remain open.
