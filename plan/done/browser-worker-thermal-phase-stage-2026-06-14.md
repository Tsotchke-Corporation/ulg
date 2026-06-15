# Browser Worker Thermal/Phase Stage

Date: 2026-06-14 AKDT

## Completed

- Added no-full retained-output acceptance to
  `runSphThermalStepWithOptionalWebGpu()`.
- Extended the focused browser authority-host gate to run `thermalPhase` on
  the same warm Worker/lane after mechanics continuation.
- The Worker thermal stage consumes retained G2P state plus retained thermo,
  uploads thermal response graph buffers inside the Worker from cloneable scene
  tables, runs no-full WebGPU thermal execution, satisfies the Worker queue
  fence, and adopts retained thermal `thermoBuffer` output.

## Validation

- PASS: `node --check tests/demo.e2e.mjs`.
- PASS: `node --check src/runtime/sph/sphThermalGpuKernel.js`.
- PASS: `git diff --check`.
- PASS:
  `node --test tests/sphThermalGpuKernel.test.mjs --test-name-pattern "no-full retained output"`
  reported `11/11`.
- PASS: `node --test tests/ulgMechanicsResidentStageWorker.test.mjs`
  reported `2/2`.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "thermal phase stage compute task"`
  reported `33/33`.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  reported `11/11`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS: visual matrix `codex-browser-worker-thermal-phase-stage-20260614`
  reported `failedCount=0` for `3` filtered scenarios with two captured frames
  each: `liquid-liquid-h2o-mlsmpm`, `solid-h2o-cpu-sph`, and
  `law-pressure-off-h2o-mlsmpm`.

## Follow-Up

- Move the direct browser Worker thermal call into the formal GPUHub stage-plan
  DAG after mechanics G2P.
- Publish/admit retained thermal outputs through NodeKernel/StateManager.
