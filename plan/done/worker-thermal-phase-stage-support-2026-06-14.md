# Worker Thermal/Phase Stage Support

Date: 2026-06-14 AKDT

## Completed

- Extended the resident-stage Worker module with a `thermalPhase` stage id.
- The Worker can call `runSphThermalPhaseStageComputeTask()`.
- The Worker forwards retained state/thermo inputs and can adopt emitted
  thermal `thermoBuffer` output into the lane record.
- Added direct Worker-payload unit coverage with an injected thermal runner.

## Validation

- PASS: `node --check src/services/ulgMechanicsResidentStage.worker.js`.
- PASS: `node --check tests/ulgMechanicsResidentStageWorker.test.mjs`.
- PASS: `git diff --check`.
- PASS: `node --test tests/ulgMechanicsResidentStageWorker.test.mjs`
  reported `2/2`.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "thermal phase stage compute task"`
  reported `33/33`.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  reported `11/11`.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS: visual matrix `codex-worker-thermal-phase-stage-support-20260614`
  reported `failedCount=0` for `3` filtered scenarios with two captured frames
  each: `liquid-liquid-h2o-mlsmpm`, `solid-h2o-cpu-sph`, and
  `law-pressure-off-h2o-mlsmpm`.

## Follow-Up

- Register the `thermalPhase` stage in the browser GPUHub resident-stage chain
  after mechanics G2P.
- Provide real thermal tables and retained Worker inputs to the browser Worker
  path.
- Keep admission non-authoritative until queue-fence evidence and
  NodeKernel/StateManager publication are in place.
