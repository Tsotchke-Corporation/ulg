# Retained Gas-Cell Source Consumption

Date: 2026-06-15 AKDT

## Summary

Pressure/interface gas-cell admission and import publication now consume
`peercompute.ulg.pressure-interface-retained-gas-cell-field-source.v0`
directly. The browser resident authority host resolves the descriptor from the
source object or admitted gas-cell field evidence, derives worker/local
retained gas-pressure refs and row count/stride/byte length from it, and
persists the descriptor through admission/import records, StateManager hot
records, and warm deltas.

This reduces caller-fabricated retained-ref wiring. It does not remove the
current local gas-cell snapshot requirement; that remains until the dedicated
resident gas-cell EOS producer stage publishes the retained field under
ComputeManager/GPUHub authority.

## Files Touched

- `src/runtime/peercomputeBrowserResidentHost.js`
- `tests/peercomputeComputeManagerIntegration.test.mjs`
- `plan/plan.md`
- `plan/todo/README.md`
- `plan/implementation-status.md`
- `plan/tests.md`
- `plan/log.md`

## Validation

- PASS: `node --check src/runtime/peercomputeBrowserResidentHost.js`.
- PASS: `node --check tests/peercomputeComputeManagerIntegration.test.mjs`.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "gas-cell field imports|worker-retained pressure/interface"`
  reported `14/14`.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage .*gas-cell|pressure interface stage declares retained gas-cell|gas-cell field import|pressure interface stage compute task can produce force rows"`
  reported `43/43`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-retained-gas-cell-source-consumption-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`, `issues=[]`, and `visualSurfaceIssues=[]`.
- Manual frame inspection found the final frames nonblank and bounded. MLS-MPM
  fragmentation and CPU SPH stacked/blob behavior remain open.

## Open

- The import path still carries a local gas-cell snapshot for the current
  pressureInterface oracle.
- The dedicated resident gas-cell EOS producer stage still needs to publish the
  retained gas-cell field under ComputeManager/GPUHub.
- Visible physics-quality blockers remain open.
