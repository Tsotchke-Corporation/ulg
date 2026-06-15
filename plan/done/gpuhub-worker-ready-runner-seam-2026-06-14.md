# GPUHub Worker-Ready Runner Seam - 2026-06-14

ULG mechanics stage-chain registration can now consume a supplied GPUHub
resident-stage worker runner for P2G, grid-update, and G2P. The runner is
wrapped at registration time so returned worker values populate the usual
stage-result evidence map. This keeps backend, lane/state key, fence, and
retained-buffer summaries intact while PeerCompute truthfully reports
`worker-ready` only when a backend is actually supplied.

Default browser/live behavior remains `blocked-worker-backend-missing`. This
completed item proves the bridge seam, not the final worker-owned WebGPU
device/buffer path.

Validation:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
- `node --check src/runtime/peercomputeBrowserResidentHost.js`
- `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"` passed `11/11`
- `npm run test:physics-atomics` passed `7` checks with `1` expected
  long-horizon skip
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"` passed `1/1`
- Visual matrix `codex-gpuhub-worker-ready-runner-seam-20260614` passed
  `3/3` with two captured frames each for `liquid-liquid-h2o-mlsmpm`,
  `solid-h2o-cpu-sph`, and `law-pressure-off-h2o-mlsmpm`

Next:

- Add the real ULG browser worker module for mechanics resident stages.
- Keep hot lane buffers worker-owned between stage invocations.
- Do not transfer main-thread `GPUBuffer` handles or split one hot state
  family across arbitrary workers.
