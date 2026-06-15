# Thermal/Phase Stage Task Boundary

Date: 2026-06-14 AKDT

## Completed

- Added `createSphThermalPhaseStageComputeTask()`.
- Added `runSphThermalPhaseStageComputeTask()`.
- The task declares GPU-lane/fence requirements, retained state/thermo refs,
  candidate `sph-thermo-phase` writes, and suppresses commit deltas.
- The task returns retained state/thermo outputs, `thermalPhaseStageTaskEvidence`,
  and a non-authoritative task authority record.

## Validation

- PASS: `node --check src/runtime/sph/sphMlsMpmGpuStep.js`.
- PASS: `node --check tests/sphMlsMpmGpuStep.test.mjs`.
- PASS: `git diff --check`.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "thermal phase stage compute task"`
  reported `33/33`.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  reported `11/11`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS: visual matrix `codex-thermal-phase-stage-task-20260614` reported
  `failedCount=0` for `3` filtered scenarios with two captured frames each:
  `liquid-liquid-h2o-mlsmpm`, `solid-h2o-cpu-sph`, and
  `law-pressure-off-h2o-mlsmpm`.

## Follow-Up

- Register the thermal/phase stage behind a GPUHub resident-stage Worker
  runner.
- Have the Worker consume retained G2P state plus retained thermo and adopt the
  emitted thermal `thermoBuffer` as the lane thermo source.
- Keep the stage non-authoritative until NodeKernel/StateManager admission and
  queue-fence evidence are present.
