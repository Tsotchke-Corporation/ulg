# Worker Retained Mechanics Publication - 2026-06-14

ULG now has an admitted publication path for Worker-owned mechanics stage
outputs. The browser resident authority host exposes
`publishWorkerRetainedMechanicsStageOutput()`.

The publisher stores a StateManager hot record with:

- the live Worker backend,
- worker-local retained buffer refs,
- the compact publication candidate,
- a serializable worker-retained import descriptor.

It also commits a warm delta with
`peercompute.ulg.mechanics-worker-retained-hot-buffer-publication.v0`. The
descriptor is `peercompute.ulg.mechanics-worker-retained-buffer-import.v0`.
Worker `GPUBuffer` handles remain in the Worker; main receives authority
metadata and a live backend reference only.

Validation:

- `node --check src/runtime/peercomputeBrowserResidentHost.js`
- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
- `node --check tests/demo.e2e.mjs`
- `node --test tests/ulgMechanicsResidentStageWorker.test.mjs` passed `1/1`
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"` passed `11/11`
- `git diff --check`
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"` passed `1/1`
- `npm run test:physics-atomics` passed `7` checks with `1` expected
  long-horizon skip
- Visual matrix `codex-worker-retained-publication-20260614` passed `3/3`
  with two captured frames each for `liquid-liquid-h2o-mlsmpm`,
  `solid-h2o-cpu-sph`, and `law-pressure-off-h2o-mlsmpm`
