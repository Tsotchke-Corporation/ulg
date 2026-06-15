# Gas-Cell Field Admission Publisher

Completed: 2026-06-15 06:29 AKDT

## Summary

Added a StateManager-backed authority-host publisher for pressure/interface
gas-cell field-consumption admission. The host now validates a ready local
gas-cell pressure field plus retained gas-pressure refs before publishing
`peercompute.ulg.pressure-interface-gas-cell-field-admission.v0` through a hot
buffer and warm StateManager delta.

The scene helper can request this admission from the host before publishing the
existing gas-cell field import. This removes the need for caller-built
admission objects on the scene path while preserving the fail-closed retained
ref and StateManager authority gates.

## Files

- `src/runtime/peercomputeBrowserResidentHost.js`
- `src/visualization/sphPhaseScene.js`
- `tests/peercomputeComputeManagerIntegration.test.mjs`
- `tests/sphPhaseRenderer.test.mjs`
- `plan/plan.md`
- `plan/todo/README.md`
- `plan/implementation-status.md`
- `plan/tests.md`
- `plan/log.md`

## Validation

- Syntax checks passed for changed JS/test files.
- Scene/renderer focused coverage passed `29/29`.
- PeerCompute integration focused coverage passed `14/14`.
- `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in skip.
- Browser authority-host Playwright gate passed `1/1`.
- Visual matrix `codex-gas-cell-admission-publisher-20260615` passed `3/3`.

## Open

- The spatial gas-cell ledger/field still needs to become a retained
  ComputeManager/GPUHub output with real worker/local GPU refs.
- MLS-MPM fragmentation, CPU SPH stacked/blob behavior, liquid settling,
  z-buffer/draw-order, and focus-resume visual trust issues remain open.
