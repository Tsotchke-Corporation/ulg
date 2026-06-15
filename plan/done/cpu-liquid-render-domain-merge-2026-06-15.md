# CPU Liquid Render-Domain Merge

Date: 2026-06-15 AKDT

Status: done for the short-horizon CPU-SPH same-material visible-surface bug.

## Completed

- Merged same-material liquid CPU render domains before MarchingCubes so
  base/drop H2O renders as one visible liquid material surface.
- Preserved same-material solid render domains as separate surfaces so static
  support/contact validation can still distinguish blocks.
- Added CPU MarchingCubes cell-size metadata to rendered meshes.
- Updated the visual probe to add that runtime cell size to particle-bound
  surface-envelope checks, avoiding a false failure from normal grid sampling
  after the merge.
- Confirmed the public/default scenario remains plain SPH, sodium over H2O,
  both `293.15 K`, and blob scale `1`.
- Rebuilt the GitHub Pages artifact in `docs/`.

## Evidence

- `node --check src/visualization/sphPhaseScene.js`: pass.
- `node --check scripts/sph-long-horizon-probe.mjs`: pass.
- `node --check scripts/sph-visual-sanity-matrix.mjs`: pass.
- `node --test tests/sphPhaseRenderer.test.mjs`: `35/35` pass.
- Targeted CPU-SPH H2O visual matrix
  `codex-cpu-liquid-merge-surface-short-cellslack-20260615`: `failedCount=0`,
  empty issue counts, H2O visible surface count `1 -> 1`, and three frame
  artifacts.
- Targeted public/default Na/H2O visual matrix
  `codex-default-na-h2o-plain-sph-blob1-20260615`: `failedCount=0`,
  `mechanicsIntegrator=sph`, empty visual issues, H2O visible surface count
  `1 -> 1`, and three frame artifacts.
- `npm run build:pages`: pass.

## Follow-Up

- Rerun and harden the long-horizon CPU-SPH H2O/H2O liquid settling and
  free-surface acceptance gate.
- Keep renderer z-buffer/draw-order and focus-resume flashing/disappearing
  under the P0 visual-trust lane.
