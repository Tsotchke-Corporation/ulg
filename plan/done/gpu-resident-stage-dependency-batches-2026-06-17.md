# GPU Resident Stage Dependency Batches - 2026-06-17

## What Changed

- Added explicit dependency-batch execution to sibling PeerCompute's
  `GpuResidentLaneManager`.
- Preserved sequential execution for older resident lane contracts that do not
  declare dependencies.
- Normalized `dependsOn` and `inputFrom` on resident stages, validated unknown
  dependency ids, and reported dependency mode, execution batches, and max
  concurrent stage count.
- Updated ULG's MLS-MPM mechanics resident sequence contract to publish a real
  stage DAG: P2G and independent pressure/interface can be ready together,
  grid update consumes the declared upstream stage, G2P follows grid update,
  thermal/phase follows G2P, and reaction/product follows thermal/phase when
  present.

## Validation

- PASS: sibling PeerCompute lane manager syntax checks.
- PASS: sibling PeerCompute
  `node --test tests/unit/gpuResidentLaneManager.test.js` reported `8/8`.
- PASS: ULG syntax checks for `src/runtime/sph/sphMlsMpmGpuStep.js` and
  `tests/peercomputeComputeManagerIntegration.test.mjs`.
- PASS: ULG `node --test tests/peercomputeComputeManagerIntegration.test.mjs`
  reported `16/16`.
- PASS: ULG `npm run test:physics-atomics` reported `11` passing checks and
  `3` expected opt-in skips.
- PASS: short visual matrix
  `codex-stage-dependency-batches-20260617` reported `failedCount=0`, empty
  issue counts, and frame artifacts for three representative rows.

## Remaining

- This closes scheduler-level dependency batching, not full WebGPU throughput.
  Same-queue WebGPU commands still execute in order.
- Next architecture work should consume Worker-retained access contracts for
  same-Worker continuations and combine the dependency DAG with state-family
  read/write conflict admission.
- Known visible physics behavior bugs remain tracked separately: liquid
  quality, ice/solid behavior, z-buffer/focus trust, and longer-horizon
  stability still need behavior-gated work.
