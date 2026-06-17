# Resident Render-Field Surface Unclipping - 2026-06-17

Current visible resident render-field surfaces no longer clamp their
MarchingCubes vertices to particle bounds before display. That bounds clamp was
useful for stale-surface retention, but on current MLS-MPM H2O fields it
deformed the live isosurface into a cuboid/chopped blob and made one connected
surface look like non-merged water.

Changes:

- `src/visualization/sphPhaseScene.js` records
  `surface-bounds-diagnostic-current-render-field` for visible resident fields
  instead of mutating vertices with `clampSurfaceMeshToSurfaceBounds()`.
- Container clipping remains active, and inactive/stale render-field retention
  still checks current particle bounds before keeping an old mesh.
- Resident render fields now publish `renderFieldCellSizeM` so the visual probe
  can apply the same sampling slack concept used for CPU MarchingCubes.
- `scripts/sph-long-horizon-probe.mjs` fails on
  `resident-visible-surface-clipped-to-particle-bounds` if a future visible
  resident surface is vertex-clipped back to particle bounds.

Validation:

- `node --check src/visualization/sphPhaseScene.js` passed.
- `node --check scripts/sph-long-horizon-probe.mjs` passed.
- `node --test tests/sphPhaseRenderer.test.mjs` passed `35/35`.
- `git diff --check` passed.
- Resident MLS-MPM visual row
  `codex-mlsmpm-h2o-unclipped-renderfield-cellslack-20260617` passed with
  `failedCount=0`, empty issue counts, one H2O surface, one connected
  component, final tallness `0.4877`, footprint fill `0.3562`,
  `maxVisibleSurfaceOutsideParticleBoundsM=0`, and five captured frames.

Remaining:

- The resident H2O surface is now merged and not cuboid-clipped, but it is still
  visibly low-resolution/faceted. Surface smoothing/resolution policy remains a
  separate visual-quality item.
- Raw WebGPU overlay depth sharing and mobile focus-resume flashing still need
  dedicated pixel/device evidence.
