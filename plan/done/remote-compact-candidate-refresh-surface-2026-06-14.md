# Remote Compact Candidate Refresh Surface

Date: 2026-06-14 AKDT

Status: completed fail-closed authority surface plus compact snapshot and
same-device local retained-buffer materialization modes.

## What Landed

- PeerCompute added
  `NodeKernel.refreshRemoteTaskGraphHotBuffersFromCompactCandidate()`.
- The method reads an admitted compact-candidate StateManager record, requires
  the GPU resident lane API, and refuses to run without a local compact refresh
  executor.
- Blocked/failed executor results, or executor results that return no local
  refs, reject the local GPU lane and report
  `compact-hot-buffer-refresh-not-completed`.
- ULG added `refreshRemoteCompactCandidateHotBuffers()` and an opt-in
  `attemptCompactCandidateRefresh` path on the remote graph submit wrapper.
- Without a local compact executor, the ULG path reports refresh not completed
  and returns no local buffer refs.
- ULG added a default compact executor contract that reports
  `blocked-compact-candidate-local-source-required` unless an explicit local
  source seed is attached.
- No-full mechanics compact candidates now include
  `peercompute.ulg.remote-task-graph-compact-local-refresh-contract.v0`,
  listing required local source roles, accepted materialization modes, remote
  retained refs, and the local-source-required blocker.
- ULG added
  `peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0` as the first
  concrete materialization mode. A compact candidate can now carry validated
  SPH state, SPH thermo, and MLS-MPM mechanics rows that ULG uploads into
  local hot buffers and stores only in StateManager hot storage.
- The default compact executor now prefers compact snapshots when present,
  falls back to explicit local seed refresh, and otherwise reports the local
  source blocker.
- ULG added
  `peercompute.ulg.remote-task-graph-same-device-retained-buffer-import.v0`.
  The compact executor now prefers this zero-copy local mode before snapshots:
  it aliases an explicit same-device StateManager hot-buffer record, returns
  existing local retained refs, and creates no new GPU buffers or writes.

## Validation

- PeerCompute NodeKernel unit: `7/7`.
- ULG remote seed graph builder integration: `11/11`.
- ULG mounted remote-refresh prelude: `4/4`.
- ULG physics atomics: `6` pass, `1` expected opt-in long-horizon liquid skip.
- ULG visual matrix `codex-compact-executor-contract-20260614`: `failedCount=0`,
  `frameCount=5` for five representative scenarios.
- ULG visual matrix `codex-compact-snapshot-materialization-20260614`:
  `failedCount=0`, `frameCount=5` for five representative scenarios.
- ULG visual matrix `codex-same-device-retained-import-20260614`:
  `failedCount=0`, `frameCount=5` for five representative scenarios.

## Remaining Follow-Up

- Make real ComputeManager/GPUHub worker outputs emit same-device source
  descriptors directly.
- Keep remote retained refs non-local across device/peer boundaries.
