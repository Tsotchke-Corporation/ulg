# Spatial Gas-Cell EOS Producer

Completed: 2026-06-15 06:09 AKDT

## Summary

Added the first spatial gas-cell EOS producer contract. Aggregate resident
gas-species ledgers still feed only uniform sealed-box pressure and explicitly
report that a resident spatial gas-species ledger is required before local
pressure gradients can be trusted. A true spatial gas-species ledger can now
derive per-cell ideal-gas pressure and nearest-neighbor pressure gradients, and
positioned gas product-event rows with support volume can produce that spatial
ledger.

This is not yet distributed authoritative consumption. Local-gradient pressure
rows remain oracle/stage evidence until the existing gas-cell field admission,
retained refs, StateManager publication, and host-published import path approve
them.

## Files

- `src/runtime/sphPhaseDemo.js`
- `tests/sphPhaseDemo.test.mjs`
- `plan/plan.md`
- `plan/todo/README.md`
- `plan/implementation-status.md`
- `plan/tests.md`
- `plan/log.md`

## Validation

- `node --check src/runtime/sphPhaseDemo.js`
- `node --check tests/sphPhaseDemo.test.mjs`
- `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "gas pressure|spatial gas|sealed gas|positioned gas"` passed `29/29`.
- `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage .*gas-cell|pressure interface stage declares retained gas-cell|gas-cell field import|local gas-cell|pressure interface stage compute task can produce force rows"` passed `43/43`.
- `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in skip.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "gas-cell field imports|worker-retained pressure/interface|resident pass-DAG task runs through real PeerCompute GPU lane authority"` passed `14/14`.
- Browser authority-host Playwright gate passed `1/1`.
- Visual matrix `codex-spatial-gas-cell-eos-producer-20260615` passed `3/3`.

## Open

- Publish/admit the spatial gas-cell ledger and derived pressure field as
  retained ComputeManager/GPUHub state through NodeKernel/StateManager.
- Feed that admitted retained source through the existing host-published
  pressure-interface gas-cell field import path.
- MLS-MPM fragmentation, CPU SPH stacked/blob behavior, liquid settling,
  z-buffer/draw-order, and focus-resume visual trust issues remain open.
