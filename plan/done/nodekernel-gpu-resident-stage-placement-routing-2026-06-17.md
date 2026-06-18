# NodeKernel GPU Resident Stage Placement Routing - 2026-06-17

## Completed

ULG now routes mechanics GPU resident stage-placement preflight through
NodeKernel when a real NodeKernel owns the resident ComputeManager.

## What Changed

- `runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks()` now
  prefers `nodeKernel.preflightGpuResidentLaneStagePlacement()` when available.
- The raw ComputeManager preflight is preserved from the NodeKernel envelope as
  the execution-level placement report.
- Direct/injected ComputeManager paths continue to call
  `computeManager.preflightGpuResidentLaneStagePlacement()` directly.
- Mechanics stage-chain telemetry now records:
  - `gpuResidentLaneStagePlacementAuthorityPath`
  - NodeKernel placement preflight schema/status/requested placement
  - NodeKernel advisory flag
  - NodeKernel-wrapped ComputeManager preflight status and executable flag
  - raw ComputeManager placement batches and Worker policy evidence

## Validation

- Syntax:
  `node --check src/runtime/sph/sphMlsMpmGpuStep.js` passed.
- Syntax:
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs` passed.
- ULG PeerCompute integration:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs` passed
  `16/16`.
- Physics atomics:
  `npm run test:physics-atomics` passed `11` checks with `3` expected opt-in
  skips.
- Visual sequence sanity:
  `codex-nodekernel-stage-placement-preflight-20260617` passed three
  representative rows with `failedCount=0`, empty issue counts, and two frames
  each under
  `/tmp/ulg-visual-sanity-matrix/codex-nodekernel-stage-placement-preflight-20260617`.

## Remaining Work

- The NodeKernel path is still local/advisory only. Non-advisory distributed
  resident placement correctly fails closed in sibling PeerCompute until a
  real remote resident-stage executor exists.
- Next architecture slice should design that executor contract around peer
  capability, retained-ref locality, cache admission, and StateManager
  authority before any remote GPU-resident mutation is allowed.
