# Plain SPH Density Projection Law Isolation - 2026-06-15

## Summary

Plain SPH/PBF density projection is now gated by the EOS law group. Density
projection is an incompressibility/EOS-family constraint, so it must not run in
a no-force law-isolation scenario with EOS and pressure disabled.

## Completed

- Updated `src/runtime/sphPhaseDemo.js` so
  `sphDensityProjectionIterations` is zero unless `mechanics === 'sph'` and
  `physicalLawGroups.eos` is enabled.
- Updated the visual matrix `law-static-gravity-off-fe-h2o` scenario so it is a
  true no-force SPH isolation test: gravity, EOS, pressure, thermal,
  reactions, viscosity, and surface tension disabled.
- Added a physics atomic invariant that steps the same plain-SPH no-force case
  and asserts zero projection iterations, zero speed, and zero displacement.

## Validation

- PASS: `node --version` reported `v24.16.0`.
- PASS: `node --check src/runtime/sphPhaseDemo.js`.
- PASS: `node --check tests/physicsBehaviorInvariants.test.mjs`.
- PASS: `npm run test:physics-atomics` reported `8` passing checks and `1`
  expected opt-in long-horizon skip.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-gravity-off-static-no-force-after-eos-gate-20260615 ULG_VISUAL_MATRIX_SCENARIOS=law-static-gravity-off-fe-h2o ULG_VISUAL_MATRIX_BATCHES=4 ULG_VISUAL_MATRIX_BATCH_STEPS=24 ULG_VISUAL_MATRIX_FRAME_MAX=5 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`, empty issue counts, `maxSpeedObservedMPerS=0`,
  `maxDisplacementObservedM=0`, and five captured frames.

## Open

- This does not validate liquid settling or free-surface quality. The remaining
  full-matrix failures and renderer visual-trust blockers stay in
  `plan/todo/physics-behavior-regression-plan.md`.
