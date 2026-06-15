# Free-Surface Shape Visual Gate - 2026-06-15

Status: done for instrumentation and baseline diagnosis.

Summary:

- Added H2O liquid free-surface shape metrics to
  `scripts/sph-long-horizon-probe.mjs`: surface height, tallness ratio, and
  footprint fill ratio.
- Added an opt-in acceptance gate with
  `ULG_PROBE_EXPECT_LIQUID_FREE_SURFACE=1`, which reports explicit
  `liquid-free-surface-*` issues for insufficient simulated duration,
  excessive tallness, and insufficient footprint fill.
- Carried the metrics and gate thresholds into
  `scripts/sph-visual-sanity-matrix.mjs` summaries.
- Fixed the matrix helper so unset optional numeric fields remain `null`
  instead of being reported as `0`.

Validation:

- PASS: `node --check scripts/sph-long-horizon-probe.mjs`.
- PASS: `node --check scripts/sph-visual-sanity-matrix.mjs`.
- PASS: `git diff --check`.
- EXPECTED FAILURES CAPTURED:
  visual matrix `codex-free-surface-gate-h2o-short-fixedsummary-20260615`
  completed with `failedCount=2` under `ULG_VISUAL_MATRIX_ALLOW_FAILURES=1`.
  Both H2O rows had one connected visible surface but failed tallness and
  footprint-fill gates.

Key baseline:

- MLS-MPM H2O/H2O: last tallness `1.3969`, last footprint fill `0.0497`.
- CPU-SPH H2O/H2O: last tallness `1.1568`, last footprint fill `0.1076`.

Remaining:

- Use this gate on longer H2O liquid rows while fixing liquid mechanics and
  free-surface constraints so water spreads/settles instead of retaining a
  block-like connected blob.
