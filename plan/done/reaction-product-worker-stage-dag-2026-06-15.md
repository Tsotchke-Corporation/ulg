# Reaction/Product Worker Stage DAG Boundary - 2026-06-15

## Done

- Added `reactionProduct` as a non-authoritative ComputeManager stage task:
  `createSphReactionProductStageComputeTask()` and
  `runSphReactionProductStageComputeTask()`.
- Extended the formal GPUHub lane contract so an opt-in DAG can execute
  `p2g -> gridUpdate -> g2p -> thermalPhase -> reactionProduct`.
- Extended `src/services/ulgMechanicsResidentStage.worker.js` so the warm
  Worker can run `reactionProduct`, borrow retained thermal/G2P buffers, and
  return retained refs for SPH state, thermo, mechanics, and resident
  product-mass output.
- Changed reaction no-full WebGPU acceptance so retained reaction output no
  longer computes stale CPU parity.

## Validation

- `node --check` on changed source/test files: pass.
- `git diff --check`: pass.
- `node --test tests/sphReactionGpuKernel.test.mjs --test-name-pattern "no-full retained output"`: `10/10` pass.
- `node --test tests/ulgMechanicsResidentStageWorker.test.mjs`: `3/3` pass.
- `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "stage compute task"`: `34/34` pass.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`: `11/11` pass.
- Focused browser authority-host Playwright gate: `1/1` pass.
- `npm run test:physics-atomics`: `7` pass, `1` expected long-horizon skip.
- Visual matrix `codex-reaction-product-stage-dag-20260614`: `3/3` pass with two captured frames per scenario.

## Remaining

- Publish/admit Worker-retained reaction/product outputs through
  NodeKernel/StateManager before treating them as authoritative state.
- Promote pressure/interface force-row production/consumption under the same
  ComputeManager/GPUHub Worker authority.
- Keep the renderer z-buffer/draw-order blocker queued before visual captures
  are treated as authoritative renderer evidence.
