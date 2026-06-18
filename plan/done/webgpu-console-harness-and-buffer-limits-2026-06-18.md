# WebGPU Console Harness And Buffer Limits

Date: 2026-06-18 AKDT

Status: completed browser-console capture and WebGPU required-limit fix.

## What Landed

- Browser probes now capture full Playwright `console` and `pageerror`
  telemetry for scene and direct-resident paths.
- WebGPU validation failures are classified as probe issues with
  `browser-console:*` keys and are aggregated in visual matrix summaries.
- `requestOpticalGpuDevice()` now requests supported higher `maxBufferSize`
  and `maxStorageBufferBindingSize` limits for resident SPH, capped at 1 GiB.
- The material-interface candidate WebGPU path preflights buffer and storage
  binding limits before creating storage/readback buffers.
- The `peercompute-worker-inline-fallback` console line is recorded as a
  warning. Later source review shows ULG passes `enableWorkers=true`, so this
  remains a Worker capability/bootstrap blocker rather than an expected
  disabled-by-config state.

## Validation

- `node --test tests/opticalGpuBuffers.test.mjs`: `17/17` pass.
- `node --test tests/sphRenderGpuKernel.test.mjs --test-name-pattern "material interface candidate"`:
  candidate parity and low-limit fallback checks pass.
- `ULG_VISUAL_MATRIX_RUN_ID=codex-console-harness-h2o-mlsmpm-20260618 ... npm run probe:sph-visual-matrix`:
  water/water MLS-MPM passed with empty `browserConsoleIssueCounts`.
- `/tmp/ulg-na-h2o-mlsmpm-console-harness-2.json`: Na/H2O MLS-MPM passed
  with top-level `status=good` and empty `timeline.browserConsole.issueCounts`.

## Remaining Follow-Up

- Fix browser Worker bootstrap/capability so Worker-requested resident work
  does not remain inline.
- Reproduce and fix the unrelated hot Fe/H2O destroyed thermal output buffer
  warning under the new console harness.
