# Pressure/Interface Worker Stage DAG Boundary - 2026-06-15

Completed: 2026-06-15 00:34 AKDT.

What changed:

- Added pressure/interface stage schemas:
  `peercompute.ulg.sph-pressure-interface-stage-compute-task.v0`,
  `peercompute.ulg.sph-pressure-interface-stage-compute-task-result.v0`, and
  `peercompute.ulg.pressure-interface-stage-task-evidence.v0`.
- Added `createSphPressureInterfaceStageComputeTask()` and
  `runSphPressureInterfaceStageComputeTask()` as a non-authoritative
  ComputeManager stage boundary around the gas-pressure/material-interface
  force-row solver.
- Extended the formal stage-plan contract with an opt-in `pressureInterface`
  producer stage ordered before `gridUpdate`.
- Extended the resident-stage Worker so it accepts `pressureInterface` and
  reports retained `pressure-interface-force-rows-buffer` refs.
- Extended the focused PeerCompute integration gate so the injected Worker DAG
  proves
  `p2g -> pressureInterface -> gridUpdate -> g2p -> thermalPhase -> reactionProduct`
  through GPUHub resident-stage executors with all six stages `worker-ready`.

Validation:

- PASS: syntax checks for changed source/tests.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage compute task"`
  reported `35/35`.
- PASS: `node --test tests/ulgMechanicsResidentStageWorker.test.mjs`
  reported `4/4`.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  reported `12/12`.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS: visual matrix `codex-pressure-interface-stage-dag-20260615`
  reported `failedCount=0` for `3` filtered scenarios with two captured frames
  each: `liquid-liquid-h2o-mlsmpm`, `solid-h2o-cpu-sph`, and
  `law-pressure-off-h2o-mlsmpm`.

Remaining:

- Add pressure/interface retained-ref publication/admission through
  NodeKernel/StateManager.
- Add explicitly approved grid-update pressure-row consumption with
  conservation/impulse evidence.
