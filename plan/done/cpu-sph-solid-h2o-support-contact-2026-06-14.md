# CPU-SPH Solid H2O Support Contact

Date: 2026-06-14 AKDT

Status: completed targeted live solid-support fix.

## What Landed

- Added a solid group contact/support pass to
  `src/runtime/sph/sphPhaseCarrier.js`.
- Solid groups with overlapping horizontal support extents now resolve
  vertical penetration by shifting the upper group out of the lower group and
  zeroing downward support velocity.
- Projection/contact position corrections no longer become synthetic solid
  velocities; velocity refresh after density projection applies only to
  non-solid particles.
- Strengthened `scripts/sph-visual-sanity-matrix.mjs` so
  `solid-h2o-cpu-sph` checks static/support thresholds, not only H2O surface
  count.

## Validation

- `npm run test:physics-atomics`: `7` pass, `1` expected opt-in long-horizon
  liquid skip.
- Long mounted CPU-SPH solid H2O probe:
  `/tmp/ulg-solid-h2o-live-audit-20260614/solid-h2o-cpu-sph-fixed.json`
  passed with support gap about `1.83e-7 m`, drop COM delta `0`, max drop
  speed `0`, and H2O visible surface count `2 -> 2`.
- Visual matrix `codex-solid-support-contact-20260614`: `failedCount=0`,
  `frameCount=5` for five representative scenarios.
- Strengthened static guard `codex-solid-support-static-guard-20260614`:
  `failedCount=0`, `frameCount=5` for `solid-h2o-cpu-sph`.

## Remaining Follow-Up

- Liquid H2O settling/free-surface behavior remains open.
- This is a simple support/contact constraint, not a full rigid-body fracture,
  restitution, or multi-solid contact solver.
