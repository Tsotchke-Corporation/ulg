# Retained Gas-Cell Field Source Descriptor

Date: 2026-06-15 AKDT

## Summary

The pressure/interface Worker-retained publication path now emits a retained
gas-cell field source descriptor:

`peercompute.ulg.pressure-interface-retained-gas-cell-field-source.v0`

The descriptor is present when a local-gradient pressure/interface stage has
worker/local retained gas-cell buffer refs and admitted gas-cell field
consumption. It records the source hot-buffer key, worker/local retained gas
pressure refs, row count/stride/byte length, pressure-field mode, source
family, zero-copy worker-retained access protocol, and StateManager admission
requirement.

This is a source-publication slice, not the final gas-cell EOS producer. It
does not claim new mutation authority; it makes the retained gas-cell field
visible to StateManager so a later slice can consume that retained source
directly without caller-built snapshots.

## Files Touched

- `src/runtime/peercomputeBrowserResidentHost.js`
- `src/runtime/sph/sphMlsMpmGpuStep.js`
- `tests/peercomputeComputeManagerIntegration.test.mjs`
- `plan/plan.md`
- `plan/todo/README.md`
- `plan/implementation-status.md`
- `plan/tests.md`
- `plan/log.md`

## Validation

- PASS: `node --check src/runtime/peercomputeBrowserResidentHost.js`.
- PASS: `node --check src/runtime/sph/sphMlsMpmGpuStep.js`.
- PASS: `node --check tests/peercomputeComputeManagerIntegration.test.mjs`.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "worker-retained pressure/interface|resident pass-DAG task runs through real PeerCompute GPU lane authority"`
  reported `14/14`.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage .*gas-cell|pressure interface stage declares retained gas-cell|pressure interface stage compute task can produce force rows"`
  reported `43/43`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-retained-gas-cell-field-source-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`, `issues=[]`, and `visualSurfaceIssues=[]`.

## Open

- The gas-cell admission/import path still consumes snapshots. Next work should
  accept the retained source descriptor directly where possible.
- The dedicated resident gas-cell EOS producer stage still needs to move
  upstream under ComputeManager/GPUHub.
- Liquid-quality blockers remain open.
