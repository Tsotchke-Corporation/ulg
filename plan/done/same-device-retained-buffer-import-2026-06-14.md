# Same-Device Retained Buffer Import

Date: 2026-06-14 AKDT

Status: completed first zero-copy local compact materialization mode.

## What Landed

- Added
  `peercompute.ulg.remote-task-graph-same-device-retained-buffer-import.v0`.
- Added
  `refreshUlgSphMlsMpmHotBuffersFromSameDeviceRetainedBufferImport()`.
- The compact executor now checks for a same-device import descriptor before
  falling back to compact buffer snapshots or local seed refresh.
- The importer requires `sameDevice: true`, resolves an existing local
  StateManager hot-buffer record, aliases its SPH/MLS-MPM upload handles, and
  returns the existing local retained refs.
- Mechanics G2P stage results can now carry the same-device source descriptor
  into the compact mechanics candidate. The candidate marks the local refresh
  contract as `same-device-local-source-ready` and includes the source
  hot-buffer key in its hash.
- No remote retained ref is promoted to a local handle. If the local hot-buffer
  record is missing, lacks handles, or the declared refs do not match, the
  executor reports `blocked-same-device-retained-buffer-import`.

## Validation

- Syntax checks passed for `src/runtime/peercomputeBrowserResidentHost.js` and
  `tests/peercomputeComputeManagerIntegration.test.mjs`.
- ULG remote seed graph builder integration: `11/11`, including no new fake
  WebGPU buffers or writes during same-device retained import.
- ULG mounted remote-refresh prelude: `4/4`.
- ULG physics atomics: `6` pass, `1` expected opt-in long-horizon liquid skip.
- ULG visual matrix `codex-same-device-retained-import-20260614`:
  `failedCount=0`, `frameCount=5` for five representative scenarios.
- ULG visual matrix `codex-same-device-source-descriptor-20260614`:
  `failedCount=0`, `frameCount=5` for five representative scenarios.

## Remaining Follow-Up

- Have real live ComputeManager/GPUHub worker outputs create the local
  hot-buffer source record and descriptor automatically.
- Keep cross-peer/cross-device retained refs metadata-only until an explicit
  local materialization mode admits them.
