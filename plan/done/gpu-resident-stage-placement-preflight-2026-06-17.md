# GPU Resident Stage Placement Preflight - 2026-06-17

## Completed

ComputeManager now exposes GPU resident stage-placement preflight before ULG
executes a resident lane stage plan.

## What Changed

- Sibling PeerCompute added
  `peercompute.compute.gpu-resident-lane-stage-placement-preflight.v0`.
- PeerCompute's `GpuResidentLaneManager` now reuses the same dependency-batch
  and state-family conflict planner for preflight and execution.
- `ComputeManager` exposes
  `preflightGpuResidentLaneStagePlacement()` and
  `planGpuResidentLaneStagePlacement()` as authority-facing facades.
- ULG calls the preflight before mechanics stage-plan execution and records:
  placement batches, max concurrent stage count, conflict policy/deferrals,
  GPUHub executor sources, Worker residency status, Worker ready/fallback
  counts, and missing executor count.
- Mechanics-only and pressure/thermal/reaction stage-chain tests now prove the
  preflight matches actual execution batches and Worker residency evidence.

## Validation

- PeerCompute syntax checks passed for:
  - `peercompute/src/peercompute/computeManager/GpuResidentLaneManager.js`
  - `peercompute/src/peercompute/computeManager/ComputeManager.js`
  - `peercompute/src/peercompute/index.js`
  - `peercompute/tests/unit/gpuResidentLaneManager.test.js`
- PeerCompute lane manager:
  `node --test peercompute/tests/unit/gpuResidentLaneManager.test.js` passed
  `10/10`.
- ULG syntax checks passed for:
  - `src/runtime/sph/sphMlsMpmGpuStep.js`
  - `tests/peercomputeComputeManagerIntegration.test.mjs`
- ULG PeerCompute integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs` passed
  `16/16`.
- Physics atomics:
  `npm run test:physics-atomics` passed `11` checks with `3` expected opt-in
  skips.
- Visual sequence sanity:
  `codex-stage-placement-preflight-20260617` passed three representative rows
  with `failedCount=0`, empty issue counts, and two frames each under
  `/tmp/ulg-visual-sanity-matrix/codex-stage-placement-preflight-20260617`.

## Remaining Work

- This is a preflight/audit surface. It does not yet enforce remote or
  cross-Worker placement.
- Next architecture work should make NodeKernel/ComputeManager consume this
  report when deciding Worker/lane/device/peer placement and fail closed for
  non-advisory distributed resident placement that cannot honor retained-ref
  locality and state-family conflicts.
