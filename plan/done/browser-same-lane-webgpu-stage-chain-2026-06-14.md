# Browser Same-Lane WebGPU Stage Chain - 2026-06-14

Completed: 2026-06-14 19:59 AKDT

The browser authority-host test now validates the same-lane mechanics stage
chain with real browser WebGPU stage backends. It calls
`host.runMechanicsStageTaskChain()` with `preferWebGpu=true`,
`useNativeTaskGraph=false`, a shared scene `deviceResult`, and explicit parent
lane id/state key.

The focused Playwright gate proves P2G, grid-update, and G2P all report
`webgpu` backend, `gpu-lane` residency, the same parent lane/state key,
completed stage-plan execution, and satisfied fences.

This is still inline browser ComputeManager authority-host execution. The next
promotion is supervised GPUHub/ComputeManager worker residency for the same
stage chain.

Validation:

- `node --check tests/demo.e2e.mjs`
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"` passed `1/1`
- `npm run test:physics-atomics` passed `7` with `1` expected skip
- Visual matrix `codex-browser-same-lane-webgpu-stage-chain-20260614` passed `3/3` with two captured frames per scenario
