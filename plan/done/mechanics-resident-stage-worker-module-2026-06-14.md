# Mechanics Resident-Stage Worker Module - 2026-06-14

ULG now has a checked-in mechanics resident-stage Worker module at
`src/services/ulgMechanicsResidentStage.worker.js`. It handles PeerCompute's
`run-resident-stage` protocol for P2G, grid-update, and G2P, keeps raw stage
outputs in a worker-local lane store, and returns clone-safe values/summaries
with retained-buffer refs.

The browser authority host exposes
`createUlgMechanicsResidentStageWorkerRunner()`, which wraps PeerCompute's
`createResidentStageWorkerBackend()` and points at the checked-in worker
module. The focused browser gate now creates that runner, runs the mechanics
stage chain through the real browser Worker module, and verifies all three
stages report `worker-ready`.

This is not yet the final copy-free WebGPU hot path. The current Worker module
is validated as a CPU/reference Worker bridge unless WebGPU is explicitly
validated in the worker. The next promotion is worker-owned WebGPU
device/buffer retention and compact authorized state publication.

Validation:

- `node --check src/services/ulgMechanicsResidentStage.worker.js`
- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
- `node --check src/runtime/peercomputeBrowserResidentHost.js`
- `node --check tests/ulgMechanicsResidentStageWorker.test.mjs`
- `node --check tests/demo.e2e.mjs`
- `node --test tests/ulgMechanicsResidentStageWorker.test.mjs` passed `1/1`
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"` passed `11/11`
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"` passed `1/1`
- `npm run test:physics-atomics` passed `7` checks with `1` expected
  long-horizon skip
- Visual matrix `codex-ulg-mechanics-resident-stage-worker-module-20260614`
  passed `3/3` with two captured frames each for
  `liquid-liquid-h2o-mlsmpm`, `solid-h2o-cpu-sph`, and
  `law-pressure-off-h2o-mlsmpm`
