# Worker-Retained Mechanics Continuation Input

Date: 2026-06-14 AKDT

## Completed

- Added a same-Worker/same-lane mechanics continuation path. When
  `gpuHubResidentStageWorkerUseRetainedInput=true`, the Worker-side P2G stage
  consumes the previous G2P `stateBuffer` and `mechanicsBuffer` from the
  retained Worker lane record.
- Exposed continuation evidence on the stage-chain summary through
  `workerRetainedContinuationInputStatus`.
- Extended the focused browser authority-host gate to keep the Worker warm,
  run a second no-full WebGPU P2G -> grid-update -> G2P chain on the same
  lane, assert `applied-worker-retained-g2p-input`, and verify the continuation
  republishes a Worker-retained mechanics descriptor.

## Validation

- PASS: `node --check src/services/ulgMechanicsResidentStage.worker.js`.
- PASS: `node --check src/runtime/sph/sphMlsMpmGpuStep.js`.
- PASS: `node --check tests/demo.e2e.mjs`.
- PASS: `git diff --check`.
- PASS: `node --test tests/ulgMechanicsResidentStageWorker.test.mjs`
  reported `1/1`.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  reported `11/11`.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS: visual matrix `codex-worker-retained-continuation-20260614` reported
  `failedCount=0` for `3` filtered scenarios with two captured frames each:
  `liquid-liquid-h2o-mlsmpm`, `solid-h2o-cpu-sph`, and
  `law-pressure-off-h2o-mlsmpm`.

## Follow-Up

- Retain thermo/thermal/phase outputs in the Worker lane. This slice still
  uploads thermo from the CPU mirror into a Worker-retained storage buffer for
  the continuation.
- Keep renderer z-buffer/draw-order fixes separate and high priority before
  captured visual sequences are treated as authoritative.
