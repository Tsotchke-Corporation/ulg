# Same-Device Hot-Buffer Source Publication

Date: 2026-06-14 AKDT

Status: completed authority-host publication surface.

## What Landed

- Added
  `peercompute.ulg.sph-mls-mpm-same-device-hot-buffer-source-publication.v0`.
- Added `publishUlgSphMlsMpmSameDeviceHotBufferSource()`.
- Exposed the helper through the resident authority host as
  `host.publishSameDeviceHotBufferSource()`.
- The helper stores local same-device SPH state, SPH thermo, and MLS-MPM
  mechanics upload handles in StateManager hot storage, then returns a
  serializable
  `peercompute.ulg.remote-task-graph-same-device-retained-buffer-import.v0`
  descriptor.
- The descriptor carries provenance and retained refs only. WebGPU handles stay
  in same-device hot storage.
- Host summaries now report
  `residentSameDeviceHotBufferSourcePublicationReady`.

## Validation

- Syntax checks passed for `src/runtime/peercomputeBrowserResidentHost.js` and
  `tests/peercomputeComputeManagerIntegration.test.mjs`.
- ULG PeerCompute integration passed `11/11`; compact same-device candidates
  now use a published local source record rather than a hand-written
  descriptor, and same-device import creates no fake GPU buffers or writes.
- ULG mounted remote-refresh prelude passed `4/4`.
- `npm run test:physics-atomics` passed `7` with `1` expected opt-in
  long-horizon liquid skip.
- Visual matrix `codex-same-device-source-publication-20260614` passed five
  representative scenarios with `failedCount=0`.

## Remaining Follow-Up

- Wire live ComputeManager/GPUHub worker-stage outputs to call this publication
  surface automatically when they already own same-device SPH/MLS-MPM upload
  handles.
- Keep cross-device retained refs metadata-only until an explicit admitted
  local materialization path exists.
