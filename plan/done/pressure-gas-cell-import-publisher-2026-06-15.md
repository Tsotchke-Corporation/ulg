# Pressure Gas-Cell Import Publisher - 2026-06-15

## Completed

- Added
  `peercompute.ulg.pressure-interface-gas-cell-field-import-hot-buffer-publication.v0`
  for StateManager-backed pressure gas-cell field import publication.
- Exposed `publishPressureInterfaceGasCellFieldImportSource()` on the browser
  resident authority host.
- The publisher validates admitted field-consumption evidence, retained
  gas-cell refs, and a ready local gas-cell snapshot before storing the hot
  record and committing the warm delta.
- The returned `peercompute.ulg.pressure-interface-gas-cell-field-import.v0`
  descriptor is consumable by `runSphPressureInterfaceStageComputeTask()`.
- Integration coverage proves invalid admission and missing retained refs are
  rejected, hot/warm records preserve the import, and pressureInterface uses
  the returned descriptor for local-gradient pressure rows.

## Validation

- PASS: `node --check src/runtime/peercomputeBrowserResidentHost.js`
- PASS: `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
- PASS: `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "gas-cell field imports|worker-retained pressure/interface force-row descriptors"` reported `14/14`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks with `1`
  expected opt-in long-horizon liquid skip.
- PASS: visual matrix `codex-gas-cell-import-publisher-20260615` reported
  `3/3`, `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`, and two
  captured frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-gas-cell-import-publisher-20260615`.

## Remaining

- Wire the live scene/stage path to request this host-published import when
  resident gas-cell fields are available.
- Replace remaining direct caller construction of pressure gas-cell imports in
  hot-path code with NodeKernel/StateManager/GPUHub publication.
- Renderer z-buffer/draw-order and focus-change flash/disappear issues remain
  separate visual-correctness blockers.
