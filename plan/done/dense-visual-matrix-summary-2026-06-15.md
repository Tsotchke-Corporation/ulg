# Dense Visual Matrix Summary - 2026-06-15

## Summary

The visual sanity matrix now produces dense, actionable validation evidence by
default. It captures PNG frames unless explicitly disabled and carries
per-scenario `analysis.issues` into `summary.json`, along with compact
visual-surface issue rows and key physics/render metrics.

## Completed

- Defaulted matrix frame capture on with `DEFAULT_FRAME_MAX = 16`.
- Preserved the escape hatch `ULG_VISUAL_MATRIX_CAPTURE_FRAMES=0`.
- Added summary issue counts from `analysis.issues`.
- Added compact visual-surface issue details without duplicating full geometry
  bounds.
- Added frame artifact status/count and observed motion/J/pressure/surface
  metrics to each scenario result.

## Validation

- PASS: `node --check scripts/sph-visual-sanity-matrix.mjs`.
- PASS: `node scripts/sph-visual-sanity-matrix.mjs --list`.
- PASS/EXPECTED-FAIL:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-visual-summary-issues-smoke-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=2 ULG_VISUAL_MATRIX_FRAME_MAX=4 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=1` with the expected
  `visible-surface-expanded-beyond-particle-bounds` issue.
- PASS: the smoke wrote two non-empty PNG frame artifacts under
  `/tmp/ulg-visual-sanity-matrix/codex-visual-summary-issues-smoke-20260615/liquid-liquid-h2o-cpu-sph-frames`.

## Open

- The harness now exposes the next behavior target clearly: same-material H2O
  CPU-SPH still renders detached/stacked surfaces and violates particle-bound
  surface extent checks.
