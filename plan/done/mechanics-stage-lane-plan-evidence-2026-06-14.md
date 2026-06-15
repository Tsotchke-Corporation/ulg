# Mechanics Stage Lane-Plan Evidence - 2026-06-14

Completed: 2026-06-14 19:28 AKDT

ULG's mechanics stage-chain helper now wraps the existing P2G -> grid-update
-> G2P native CPU-oracle stage outputs in a PeerCompute GPU resident lane
stage-plan execution. The path builds
`peercompute.ulg.mls-mpm-mechanics-stage-lane-contract.v0`, acquires a
ComputeManager GPU resident lane lease, runs
`executeGpuResidentLaneStagePlan()`, completes the lane fence, and records the
stage-plan execution evidence on `mechanicsStageTaskChain`.

This is non-authoritative evidence. It does not yet move actual WebGPU
mechanics mutation inside the lane executor.

Validation:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
- `node --check tests/peercomputeComputeManagerIntegration.test.mjs`
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"` passed `11/11`
- `npm run test:physics-atomics` passed `7` with `1` expected skip
- Visual matrix `codex-mechanics-stage-lane-plan-20260614` passed `3/3` with two captured frames per scenario
