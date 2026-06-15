# Pressure Gas-Cell Field Import - 2026-06-15

## Completed

- Added `peercompute.ulg.pressure-interface-gas-cell-field-import.v0` as the
  admitted input descriptor for local gas-cell pressure fields.
- The pressureInterface stage now injects a local gas-cell pressure field from
  the import only when the descriptor is ready, carries admitted
  field-consumption evidence, includes retained gas-cell refs, and provides a
  local gas-cell snapshot.
- Blocked imports preserve their blocked status and leave pressureInterface on
  uniform sealed-gas pressure instead of silently upgrading to local-gradient
  physics.
- Stage evidence, lane summaries, and Worker compact publication candidates
  now carry gas-cell import schema/status/readiness/source hot-buffer metadata.
- The mechanics stage DAG forwards gas-cell import/admission inputs through
  inline lane execution and Worker common context.

## Validation

- PASS: `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
- PASS: `node --check tests/sphMlsMpmGpuStep.test.mjs`
- PASS: `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage .*gas-cell|pressure interface stage compute task can produce force rows with WebGPU|pressure interface stage compute task declares retained"` reported `42/42`.
- PASS: `node --test tests/ulgMechanicsResidentStageWorker.test.mjs` reported
  `4/4`.
- PASS: `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "worker-retained pressure/interface force-row descriptors|mechanics-stage-gpuhub-worker-ready|resident pass-DAG task runs through real PeerCompute GPU lane authority"` reported `13/13`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks with `1`
  expected opt-in long-horizon liquid skip.
- PASS: visual matrix `codex-gas-cell-field-import-20260615` reported `3/3`,
  `failedCount=0`, `issues=[]`, `visualSurfaceIssues=[]`, and two captured
  frames per scenario under
  `/tmp/ulg-visual-sanity-matrix/codex-gas-cell-field-import-20260615`.

## Remaining

- The gas-cell import descriptor is still constructed at the caller boundary.
  The next slice should publish/store this source through NodeKernel/
  StateManager/GPUHub from resident gas-cell buffers.
- Renderer z-buffer/draw-order and focus-change flash/disappear issues remain
  separate visual-correctness blockers.
