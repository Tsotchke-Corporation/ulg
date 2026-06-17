# Worker-Retained Access Contract - 2026-06-17

Completed: 2026-06-17 15:11 AKDT.

## Scope

Added a shared authority contract for Worker-retained law-family hot-buffer
publications. This is architecture metadata and scheduling evidence, not a
physics behavior fix.

## Changes

- Added `peercompute.ulg.worker-retained-access-contract.v0`.
- Threaded the contract through mechanics, thermal/phase, pressure/interface,
  and reaction/product Worker-retained publication paths.
- Made Worker-private publications explicit:
  `mainThreadGpuHandlesAvailable=false`, `localBufferRefs=[]`,
  `workerContinuationRequired=true`, and accepted consumer mode
  `same-worker-lane-retained-buffer-ref`.
- Preserved same-device main-thread hot-buffer aliases as the only zero-copy
  local import path.
- Added focused mechanics publication coverage to match the existing
  pressure/interface and reaction/product authority-host coverage.

## Validation

- PASS: `node --check src/runtime/peercomputeBrowserResidentHost.js`.
- PASS: `node --check tests/peercomputeComputeManagerIntegration.test.mjs`.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "worker-retained mechanics output descriptors|worker-retained reaction/product output descriptors|worker-retained pressure/interface force-row descriptors"`
  reported `16/16`.
- PASS: `npm run test:physics-atomics` reported `11` passing checks and `3`
  expected opt-in long-horizon skips.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-worker-retained-contract-20260617 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,solid-h2o-cpu-sph,law-pressure-off-h2o-mlsmpm ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`, empty issue counts, and two frame artifacts for
  each scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-worker-retained-contract-20260617`.

## Remaining

- Make ComputeManager/GPUHub placement consume the access contract so
  Worker-retained outputs continue on the same Worker/lane.
- Add dependency-aware law-family concurrency: overlap independent law,
  closure, cache, and remote-peer graph work when state-family read/write sets
  do not conflict, and fence only at required physical dependencies.
- Return to the known physics behavior bugs after this architecture lane:
  liquid quality is still not final, ice/solid behavior needs stronger gates,
  and mobile focus/render flashing remains open.
