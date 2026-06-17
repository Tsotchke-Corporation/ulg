# GPU Resident State-Family Conflict Batching - 2026-06-17

## What Changed

- Added read/write family conflict checks to sibling PeerCompute's GPU resident
  ready-batch scheduler.
- Ready stages with write/write, write/read, or read/write overlap are deferred
  into later batches.
- PeerCompute execution reports now include the conflict policy and detailed
  deferral records.
- ULG mechanics stage-chain telemetry now exposes the conflict policy and
  deferral count.

## Validation

- PASS: PeerCompute lane manager syntax checks.
- PASS: PeerCompute `node --test tests/unit/gpuResidentLaneManager.test.js`
  reported `9/9`.
- PASS: ULG syntax checks for `sphMlsMpmGpuStep.js` and
  `peercomputeComputeManagerIntegration.test.mjs`.
- PASS: ULG `node --test tests/peercomputeComputeManagerIntegration.test.mjs`
  reported `16/16`.
- PASS: ULG `npm run test:physics-atomics` reported `11` passing checks and
  `3` expected opt-in skips.
- PASS: ULG visual matrix `codex-state-family-conflict-batching-20260617`
  passed three rows with `failedCount=0` and empty issue counts.

## Remaining

- Conflict deferral is ordering only, not dataflow. Stages still need explicit
  `dependsOn` or `inputFrom` when they consume another stage's result.
- Next work should use the same read/write conflict policy in broader
  ComputeManager/GPUHub placement across Workers, devices, and peers.
