# Same-Lane WebGPU-Requested Stage Tasks - 2026-06-14

Completed: 2026-06-14 19:48 AKDT

WebGPU-requested mechanics child stage tasks now inherit the parent
ComputeManager lane executor identity. When the non-native lane executor
submits P2G, grid-update, and G2P with `preferWebGpu=true`, all three child
tasks use the parent lane id/state key, remain inline for WebGPU object
safety, preserve supplied device context, and publish per-stage lane/backend/
residency/fence summaries on `mechanicsStageTaskChain`.

This completes the same-lane authority invariant for WebGPU-requested child
tasks in focused Node validation. It does not yet prove browser GPUHub worker
execution with same-device retained buffers; that remains the next promotion.

Validation:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
- `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"` passed `11/11`
- `npm run test:physics-atomics` passed `7` with `1` expected skip
- Visual matrix `codex-same-lane-stage-webgpu-request-20260614` passed `3/3` with two captured frames per scenario
