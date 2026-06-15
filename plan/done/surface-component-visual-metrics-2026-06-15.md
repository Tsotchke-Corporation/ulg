# Surface Component Visual Metrics - 2026-06-15

Status: done for instrumentation and baseline diagnosis.

Summary:

- Added connected-component metrics for active MarchingCubes surface geometry
  in `scripts/sph-long-horizon-probe.mjs`.
- Surfaced `maxVisibleSurfaceComponentCount`,
  `maxVisibleSurfaceSmallComponentCount`, and
  `minVisibleSurfaceLargestComponentRatio` in long-horizon analysis and visual
  matrix summaries.
- Established that the current MLS-MPM H2O visual problem is not disconnected
  mesh fragments. It is a connected but blocky/tall liquid body that needs
  free-surface shape/levelness validation and mechanics remediation.

Validation:

- PASS: `node --check scripts/sph-long-horizon-probe.mjs`.
- PASS: `node --check scripts/sph-visual-sanity-matrix.mjs`.
- PASS: visual matrix `codex-surface-components-h2o-baseline-20260615`.
- PASS: medium MLS-MPM probe `codex-mlsmpm-h2o-medium-components-20260615`.

Remaining:

- Add free-surface shape/levelness metrics.
- Fix MLS-MPM/accepted liquid mechanics so water spreads/flattens rather than
  retaining a block-like shape.
