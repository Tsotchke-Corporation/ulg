# GPUHub Resident Stage Executor Chain - 2026-06-14

Completed: 2026-06-14 20:23 AKDT

ULG's mechanics stage-chain helper can now register P2G, grid-update, and G2P
stage handlers on the ComputeManager-attached GPUHub and let PeerCompute's
`GpuResidentLaneManager.executeStagePlan()` resolve those stages through the
GPUHub resident stage executor registry instead of receiving ad hoc ULG
callbacks.

Direct browser authority-host construction now passes the same GPUHub into
ComputeManager. Sibling PeerCompute also now passes the NodeKernel-owned GPUHub
into ComputeManager, so both direct-manager and NodeKernel authority modes
share the same lane-manager GPUHub registry boundary.

The stage-chain evidence now reports GPUHub executor mode, registered stage
count, registered stage ids, and per-stage executor sources. Focused Node and
browser tests assert all three mechanics stages use
`gpu-hub-resident-stage-executor` while keeping the same lane/state key,
WebGPU backend, `gpu-lane` residency, and satisfied fences.

This is still an inline GPUHub resident executor registry. It is not yet a
dedicated GPU worker that owns the WebGPU device/buffers. The next promotion is
supervised GPUHub/ComputeManager worker residency for this same stage chain,
then pressure/interface, thermal/phase, and reaction/product stage promotion.

Validation:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
- `node --check src/runtime/peercomputeBrowserResidentHost.js`
- `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
- `node --check tests/demo.e2e.mjs`
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"` passed `11/11`
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"` passed `1/1`
- `npm run test:physics-atomics` passed `7` with `1` expected skip
- Visual matrix `codex-gpuhub-stage-executor-chain-20260614` passed `3/3` with two captured frames per scenario
