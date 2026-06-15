# Remote Mechanics Compact Candidate Admission

Date: 2026-06-14 AKDT

Status: completed slice; broader PeerCompute authority migration remains active.

## What Landed

- ULG no-full/retained mechanics G2P output now produces a compact mechanics
  candidate instead of a refreshable `stateSeedPayload`.
- `submitTaskGraphWithRemoteSeedHotBufferRefresh()` now records that compact
  candidate through `NodeKernel.commitRemoteTaskGraphCompactCandidate()` when
  mechanics-stage refresh is explicitly preferred.
- The wrapper still blocks hot-buffer refresh, returns no local buffer refs,
  and keeps remote retained refs metadata-only until a local retained-lane
  refresh executor exists.

## Validation

- ULG remote seed graph builder integration: `11/11`.
- PeerCompute NodeKernel unit: `7/7`.
- ULG mounted remote-refresh prelude: `4/4`.
- ULG physics atomics: `6` pass, `1` expected opt-in long-horizon liquid skip.
- ULG visual matrix `codex-core-compact-authority-20260614`: `failedCount=0`,
  `frameCount=5` for five representative scenarios.

## Remaining Follow-Up

- Build the local retained-lane refresh executor for admitted compact outputs.
- Keep Na/H2O reaction-product visual timeout as a separate P0 blocker.
- Continue migrating law stages to PeerCompute WebGPU workers under
  ComputeManager/GPUHub authority.
