# Worker No-Full Retained Publication Candidate - 2026-06-14

The browser Worker mechanics stage-chain path now runs with
`readbackMode="no-full-readback"`. For WebGPU no-full stage messages, the
Worker waits on its own `device.queue.onSubmittedWorkDone()` before returning
the result, so P2G, grid-update, and G2P report satisfied stage fences without
full particle-array readback.

`mechanicsStageTaskChain` now exposes
`peercompute.ulg.mls-mpm-mechanics-worker-compact-publication-candidate.v0`.
The candidate records worker-retained buffer refs, no-full readback modes,
WebGPU backends, worker-ready residency, and the required publication protocol.

The candidate deliberately remains publication-blocked:
`blocked-authorized-worker-publication-required`. Worker `GPUBuffer` handles
are not transferable authority. The next slice must let the Worker publish
compact summaries and retained-ref descriptors through NodeKernel/StateManager
admission.

Validation:

- `node --check src/services/ulgMechanicsResidentStage.worker.js`
- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
- `node --check tests/demo.e2e.mjs`
- `node --test tests/ulgMechanicsResidentStageWorker.test.mjs` passed `1/1`
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"` passed `11/11`
- `git diff --check`
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"` passed `1/1`
- `npm run test:physics-atomics` passed `7` checks with `1` expected
  long-horizon skip
- Visual matrix `codex-worker-no-full-retained-candidate-20260614` passed
  `3/3` with two captured frames each for `liquid-liquid-h2o-mlsmpm`,
  `solid-h2o-cpu-sph`, and `law-pressure-off-h2o-mlsmpm`
