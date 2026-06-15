# Worker-Retained Thermo Input

Date: 2026-06-14 AKDT

## Completed

- Added a Worker-retained thermo buffer for the mechanics Worker lane.
- P2G and G2P WebGPU stages now borrow the lane thermo buffer through
  `sphParticleUpload`, avoiding per-stage thermo uploads inside the Worker
  mechanics chain.
- The Worker seeds the thermo buffer once from the CPU mirror when no retained
  thermo source exists.
- The Worker can now adopt future thermal/reaction `thermoBuffer` outputs as
  the lane thermo source.
- Browser authority-host validation asserts retained thermo input on P2G/G2P
  for both the first Worker no-full WebGPU run and the retained continuation.

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
- PASS: visual matrix `codex-worker-retained-thermo-input-20260614` reported
  `failedCount=0` for `3` filtered scenarios with two captured frames each:
  `liquid-liquid-h2o-mlsmpm`, `solid-h2o-cpu-sph`, and
  `law-pressure-off-h2o-mlsmpm`.

## Follow-Up

- Promote thermal/phase as a Worker-resident law stage under
  ComputeManager/GPUHub authority so the retained thermo buffer is produced by
  physics, not only seeded from the CPU mirror.
- Keep renderer z-buffer/draw-order fixes on the separate visual correctness
  blocker track.
