# Surface-Radius Visual Bounds Gate - 2026-06-15

## Summary

The visual probe no longer treats the expected MarchingCubes/metaball support
radius as particle-bound overflow. Particle-bound surface checks now allow the
configured particle tolerance plus the surface's reported render support radius
before flagging `visible-surface-expanded-beyond-particle-bounds`.

## Completed

- Updated `scripts/sph-long-horizon-probe.mjs` to include
  `surfaceRadiusM`, `requestedSurfaceRadiusM`, or
  `cpuMarchingCubesRadiusFloorM` in the particle-bound overflow envelope.
- Preserved `particleBoundsToleranceM`, `particleSupportRadiusM`, and
  `allowedParticleBoundsOverflowM` in compact matrix visual-surface issue rows.
- Verified the focused H2O scenarios no longer fail on expected render support
  radius.

## Validation

- PASS: `node --check scripts/sph-long-horizon-probe.mjs`.
- PASS: `node --check scripts/sph-visual-sanity-matrix.mjs`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in skip.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-surface-radius-bounds-trio-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`, empty issue counts, frame artifact status `ready`,
  and two frames per scenario.

## Open

- Long-horizon same-material liquid merge/free-surface acceptance is still open.
  The short visual trio intentionally does not prove water has settled into one
  continuous final pool.
