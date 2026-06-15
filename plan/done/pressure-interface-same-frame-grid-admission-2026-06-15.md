# Pressure/interface same-frame grid admission - 2026-06-15

Status: done.

This slice completed the same-frame pressure/interface consumer path inside
the formal ComputeManager/GPUHub stage-plan DAG. When `pressureInterface`
executes immediately before `gridUpdate` with
`approveSameFramePressureInterfaceGridForces=true`, ULG now publishes the
retained force-row descriptor, creates
`peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0`, and
injects the approved pressure solver plus admission object into the
`gridUpdate` Worker context before execution.

Key implementation points:

- Added same-frame pressure/interface publication/admission helpers in
  `src/runtime/sph/sphMlsMpmGpuStep.js`.
- Wrapped the `gridUpdate` GPUHub worker executor so it can publish/admit the
  immediately preceding `pressureInterface` output and pass the approved
  descriptor through `ulgMechanicsResidentStageWorker.stageOptions.gridUpdate`.
- Preserved retained refs inside each worker stage `value` handed to the next
  stage, because PeerCompute's lane manager carries `normalized.value` forward
  as `currentValue`.
- Updated `src/services/ulgMechanicsResidentStage.worker.js` so cloneable
  worker stage results include retained refs at both the result and
  `workerResidentStage` levels.
- Extended the PeerCompute integration test to assert same-frame publication,
  admitted grid-force descriptor creation, and `gridUpdate` consumption from
  the injected Worker context.

Validation:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
- `node --check src/services/ulgMechanicsResidentStage.worker.js`
- `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
- `git diff --check`
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs` passed
  `13/13`.
- `node --test tests/ulgMechanicsResidentStageWorker.test.mjs` passed `4/4`.
- `node --test tests/sphMlsMpmGpuStep.test.mjs` passed `37/37`.
- `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Focused browser authority-host Playwright gate passed `1/1`.
- Visual matrix
  `codex-pressure-interface-same-frame-grid-admission-20260615` passed `3/3`
  with no issues, no visual-surface issues, and two captured frames per
  scenario.

Next:

- Move the pressure/interface force-row producer away from CPU-reference rows
  toward a WebGPU-resident stage under the same ComputeManager/GPUHub authority
  path.
- Keep the renderer z-buffer/draw-order blocker separate from physics-law
  acceptance and handle it before treating browser surface captures as final
  visual truth.
