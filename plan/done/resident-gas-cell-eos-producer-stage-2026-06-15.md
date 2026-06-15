# Resident Gas-Cell EOS Producer Stage

Date: 2026-06-15 AKDT

## Summary

ULG now has a dedicated resident gas-cell EOS producer stage surface:

`peercompute.ulg.sph-gas-cell-eos-producer-stage-compute-task.v0`

The stage derives a structured local gas-cell pressure field from a spatial gas
species ledger, packs the shared 12-float gas-pressure-cell row ABI used by
pressureInterface, and uploads/retains that row buffer on a same-device WebGPU
lane when requested. It emits non-mutating stage evidence, a GPU fence report,
retained `resident-gas-pressure-cells-buffer` refs, and a
`peercompute.ulg.pressure-interface-retained-gas-cell-field-source.v0`
descriptor.

The resident stage worker now recognizes `gasCellEosProducer`, so the stage can
run through the same worker protocol as pressure/interface, thermal/phase, and
reaction/product stages. PeerCompute integration proves the producer result can
be admitted by the resident authority host, imported as a gas-cell field, and
consumed by pressureInterface.

This is not yet a WGSL EOS shader. The EOS derivation is still CPU/oracle code
feeding a WebGPU-resident row buffer; moving the per-cell EOS calculation
itself into WebGPU remains future work.

## Files Touched

- `src/runtime/sph/sphMlsMpmGpuStep.js`
- `src/services/ulgMechanicsResidentStage.worker.js`
- `tests/sphMlsMpmGpuStep.test.mjs`
- `tests/peercomputeComputeManagerIntegration.test.mjs`
- `tests/ulgMechanicsResidentStageWorker.test.mjs`
- `plan/plan.md`
- `plan/todo/README.md`
- `plan/implementation-status.md`
- `plan/tests.md`
- `plan/log.md`

## Validation

- PASS: `node --check src/runtime/sph/sphMlsMpmGpuStep.js`.
- PASS: `node --check src/services/ulgMechanicsResidentStage.worker.js`.
- PASS: `node --check tests/sphMlsMpmGpuStep.test.mjs`.
- PASS: `node --check tests/peercomputeComputeManagerIntegration.test.mjs`.
- PASS: `node --check tests/ulgMechanicsResidentStageWorker.test.mjs`.
- PASS:
  `node --test tests/ulgMechanicsResidentStageWorker.test.mjs --test-name-pattern "gas-cell EOS|pressure interface"`
  reported `5/5`.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "gas-cell EOS|pressure interface stage .*gas-cell|pressure interface stage declares retained gas-cell|gas-cell field import|pressure interface stage compute task can produce force rows"`
  reported `44/44`.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "EOS producer|gas-cell field imports|worker-retained pressure/interface"`
  reported `15/15`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-resident-gas-cell-eos-producer-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`, `issues=[]`, and `visualSurfaceIssues=[]`.
- Manual frame inspection found all final frames nonblank and bounded. MLS-MPM
  fragmentation and CPU SPH stacked/blob behavior remain open.

## Open

- Wire `gasCellEosProducer` into the live resident stage chain and scene host
  publication path.
- Replace the CPU/oracle EOS derivation with a true WebGPU compute shader when
  the retained row-buffer producer/consumer path is stable.
- Visible physics-quality blockers remain open.
