# GPUHub Worker Policy Evidence - 2026-06-14

Completed: 2026-06-14 20:41 AKDT

ULG mechanics stage-chain registration now requests dedicated worker residency
for the P2G, grid-update, and G2P GPUHub stage executors while preserving
truthful fallback evidence. PeerCompute reports
`peercompute.gpu.resident-stage-worker-policy.v0` per stage; because no
worker-owned WebGPU device/buffer backend exists yet, the expected status is
`blocked-worker-backend-missing` with inline GPUHub fallback.

The mechanics stage-chain evidence now exposes:

- `gpuResidentLaneStageExecutionWorkerResidency`
- `gpuResidentLaneStageExecutionWorkerResidencyStatuses`
- `gpuResidentLaneStageExecutionRequestedWorkerResidency`

Focused Node and browser gates assert the worker policy is requested and that
P2G, grid-update, and G2P all report `blocked-worker-backend-missing`. This is
intentional. It prevents overclaiming worker execution while making the next
worker-owned backend acceptance target explicit.

Validation:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
- `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
- `node --check tests/demo.e2e.mjs`
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"` passed `11/11`
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"` passed `1/1`
- `npm run test:physics-atomics` passed `7` with `1` expected skip
- Visual matrix `codex-gpuhub-worker-policy-evidence-20260614` passed `3/3` with two captured frames per scenario

Next: add a real supervised worker-owned GPU backend for this same stage chain
without transferring main-thread `GPUBuffer` handles or splitting one hot state
family across arbitrary workers.
