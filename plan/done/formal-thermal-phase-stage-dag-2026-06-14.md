# Formal Thermal/Phase Stage DAG - 2026-06-14

Completed: 2026-06-14 23:23 AKDT.

What changed:

- Added an opt-in `includeThermalPhaseStage` path to the ComputeManager/GPUHub
  mechanics stage-chain contract.
- The formal pass DAG can now execute
  `p2g -> gridUpdate -> g2p -> thermalPhase` on the same GPU resident lane.
- The browser authority gate no longer calls the Worker thermal stage directly.
  It requests thermal/phase through `host.runMechanicsStageTaskChain()`, so
  PeerCompute's lane manager and GPUHub resident-stage executor own the stage.
- The Worker context now carries thermal material, closure graph, and phase
  response tables only when the thermal stage is requested.
- Mechanics worker-retained publication now accepts stage-plan executions that
  include thermal, while still requiring the mechanics stages to pass before
  publishing mechanics retained refs.

Validation:

- PASS: `node --check src/runtime/sph/sphMlsMpmGpuStep.js`.
- PASS: `node --check tests/peercomputeComputeManagerIntegration.test.mjs`.
- PASS: `node --check tests/demo.e2e.mjs`.
- PASS: `git diff --check`.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  reported `11/11`.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "thermal phase stage compute task"`
  reported `33/33`.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS: visual matrix `codex-formal-thermal-stage-dag-20260614` reported
  `failedCount=0` for `3` filtered scenarios with two captured frames each:
  `liquid-liquid-h2o-mlsmpm`, `solid-h2o-cpu-sph`, and
  `law-pressure-off-h2o-mlsmpm`.

Remaining:

- Publish/admit Worker-retained thermal outputs through NodeKernel/StateManager
  rather than only carrying the retained thermo buffer inside the Worker lane.
- Move pressure/interface and reaction/product stages behind the same
  ComputeManager/GPUHub Worker authority after thermal output admission is
  explicit.
