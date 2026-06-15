# Worker WebGPU Stage-Chain Browser Gate - 2026-06-14

The focused browser authority-host gate now validates real Worker-local WebGPU
execution for the ULG mechanics stage chain. The test creates
`host.createUlgMechanicsResidentStageWorkerRunner()`, requests
`preferWebGpu=true`, and runs P2G, grid-update, and G2P through the checked-in
`src/services/ulgMechanicsResidentStage.worker.js` module.

The returned evidence reports `worker-ready` residency through PeerCompute's
resident-stage Worker bridge and `webgpu` backends for all three mechanics
stages. This proves the browser Worker can request and use WebGPU for the
stage chain.

This does not close the final copy-free lane. The next promotion is compact
summaries plus StateManager/NodeKernel-authorized hot-state publication from
the worker-retained lane so main-thread physics does not need cloned full
arrays between stages.

Validation:

- `node --check tests/demo.e2e.mjs`
- `node --check src/services/ulgMechanicsResidentStage.worker.js`
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"` passed `1/1`

Renderer follow-up:

- Major z-buffer/draw-order issues are queued separately as visual correctness
  debt. Add multi-frame browser coverage for depth/order flicker before using
  visual sequence gates as authoritative renderer evidence.
