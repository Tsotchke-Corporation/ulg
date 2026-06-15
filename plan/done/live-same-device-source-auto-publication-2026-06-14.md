# Live Same-Device Source Auto-Publication

Date: 2026-06-14 AKDT

Status: completed mounted resident publication wiring.

## What Landed

- `src/visualization/sphPhaseDemoMount.js` now passes the active resident
  authority host into the mounted resident step refresh.
- `src/visualization/sphPhaseScene.js` now publishes a same-device hot-buffer
  source through `host.publishSameDeviceHotBufferSource()` when all authority
  conditions are true:
  - the resident output came through a ComputeManager task;
  - the StateManager warm-delta commit was accepted;
  - SPH state, SPH thermo, and MLS-MPM mechanics uploads are real WebGPU
    handles.
- The resident execution carries
  `sameDeviceHotBufferSourcePublication` and
  `sameDeviceRetainedBufferImport`.
- The same retained import descriptor is bridged onto the final G2P
  reconstruction metadata and GPU result metadata, so compact candidate
  builders can discover the live producer source without hand-written test
  attachment.
- The StateManager hot-buffer record retains the actual same-device upload
  handles locally. The serializable descriptor carries refs and provenance
  only.
- Missing authority, missing admission, missing handles, or a local-only scene
  run now records a skipped publication reason instead of pretending a source
  exists.

## Validation

- `node --check src/visualization/sphPhaseScene.js`
- `node --check src/visualization/sphPhaseDemoMount.js`
- `node --check tests/demo.e2e.mjs`
- `node --test tests/sphPhaseDemoMountRemoteRefresh.test.mjs`: `4/4`.
- Focused browser gates:
  `SPH phase resident steps can use the real browser PeerCompute resident authority host`
  and
  `SPH phase resident auto scheduler can use the default PeerCompute resident authority host`:
  `2/2`.
- ULG PeerCompute integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "remote seed graph builder|resident authority host refreshes admitted remote seeds"`:
  `11/11`.
- `npm run test:physics-atomics`: `7` pass, `1` expected opt-in liquid-settle
  skip.
- `git diff --check`
- Visual matrix `codex-live-source-g2p-bridge-20260614`:
  `failedCount=0` across H2O/H2O MLS-MPM, H2O/H2O CPU-SPH, solid H2O
  CPU-SPH, Fe/H2O contact, and hot H2O phase-change scenarios.

## Remaining Follow-Up

- Use the emitted same-device source descriptor from admitted compact
  worker-stage outputs so compact refresh can avoid snapshot/full-readback
  materialization.
- Keep cross-device remote retained refs metadata-only until an explicit local
  materialization path admits them.
- Continue the separate P0 physics work for long-horizon liquid settling,
  free-surface quality, and Na/H2O visual timeout behavior.
