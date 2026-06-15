# Worker WebGPU Device Cache - 2026-06-14

The ULG mechanics resident-stage Worker now caches a Worker-local WebGPU
device result when a supplied stage context requests `preferWebGpu=true`. The
cached device result is reused across P2G, grid-update, and G2P messages in
the same warm Worker. If Worker WebGPU is unavailable, the existing stage
handlers continue to report fallback status and use CPU-reference execution.

This is not yet the final WebGPU-retained hot path. The next acceptance gate
must prove in-worker WebGPU execution, worker-retained GPU buffers between
stages, compact summaries, and authorized hot-state publication.

Validation:

- `node --check src/services/ulgMechanicsResidentStage.worker.js`
- `node --check tests/ulgMechanicsResidentStageWorker.test.mjs`
- `node --test tests/ulgMechanicsResidentStageWorker.test.mjs` passed `1/1`
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"` passed `1/1`
