# NodeKernel GPU Resident Stage Execution Routing

Date: 2026-06-18 AKDT

Status: completed local NodeKernel execution-authority routing.

## What Landed

- Mechanics stage-chain execution now prefers
  `nodeKernel.executeGpuResidentLaneStagePlan()` when a real NodeKernel owns
  the resident ComputeManager.
- Direct `computeManager.executeGpuResidentLaneStagePlan()` remains the
  fallback for injected/local-only ComputeManager paths.
- Stage-chain telemetry now records
  `gpuResidentLaneStageExecutionAuthorityPath`,
  `peercompute.nodekernel.gpu-resident-stage-execution-authority.v0`, local
  placement/advisory status, and remote-result refresh/admission flags.
- If a future remote execution reports `localHotBufferRefreshRequired`, ULG
  rejects the local lane instead of completing it as if remote retained refs
  were local handles.

## Validation

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
- `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "resident solver descriptors|GPU resident stage placement|worker-retained|state-family|dependency"`:
  `16/16` pass.
- `npm run test:physics-atomics`: `11` pass, `3` expected opt-in skips.
- Visual matrix `codex-nodekernel-stage-execution-authority-20260618`:
  `failedCount=0`, empty issue counts, empty visual-surface issue counts, and
  two frame artifacts each for MLS-MPM H2O/H2O, solid H2O CPU-SPH, and
  pressure-off H2O MLS-MPM.

## Remaining Follow-Up

- Wire explicit opt-in remote resident-stage result admission and local
  hot-buffer refresh through sibling PeerCompute's NodeKernel surfaces.
- Keep remote retained refs metadata-only until StateManager admission and
  local refresh produce local same-device refs.
