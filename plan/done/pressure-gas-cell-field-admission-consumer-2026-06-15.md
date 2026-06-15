# Pressure Gas-Cell Field Admission Consumer Gate - 2026-06-15

## Completed

- Added `peercompute.ulg.pressure-interface-gas-cell-field-admission.v0` as the
  explicit admission contract for consuming local gas-cell pressure fields.
- PressureInterface stage results and evidence now report whether a
  local-gradient gas-cell field is admitted, required, or blocked.
- Worker compact publication candidates fail closed when local pressure
  gradients are present without admitted gas-cell field-consumption evidence.
- The browser resident authority host now rejects local-gradient
  pressure/interface publication when retained gas-cell refs exist but the
  field-consumption admission is missing or invalid.
- StateManager hot/warm pressure publication records preserve gas-cell field
  admission schema, status, approval, and consumer status.

## Validation

- PASS: `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
- PASS: `node --check src/runtime/peercomputeBrowserResidentHost.js`
- PASS: `node --check tests/sphMlsMpmGpuStep.test.mjs`
- PASS: `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
- PASS: `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage .*local gas-cell|pressure interface stage compute task can produce force rows with WebGPU|pressure interface stage compute task declares retained"` reported `40/40`.
- PASS: `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "worker-retained pressure/interface force-row descriptors"` reported `13/13`.
- PASS: `node --test tests/sphPressureInterfaceGpuKernel.test.mjs` reported `3/3`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks with `1`
  expected opt-in long-horizon liquid skip.
- PASS: visual matrix
  `codex-gas-cell-field-admission-20260615` reported `3/3`,
  `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`, and two captured
  frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-gas-cell-field-admission-20260615`.

## Remaining

- PressureInterface still receives caller-supplied local gas-cell fields for
  the oracle path. The next slice should consume admitted retained gas-cell
  refs from StateManager/GPUHub inside the ComputeManager stage DAG.
- Renderer z-buffer/draw-order and focus-change flash/disappear issues remain
  queued visual-correctness blockers.
