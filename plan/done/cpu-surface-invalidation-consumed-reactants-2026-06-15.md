# CPU Surface Invalidation For Consumed Reactants

Date: 2026-06-15 AKDT

Status: done for the targeted stale Na surface failure.

## Completed

- Diagnosed the remaining Na/H2O visual row failure as stale CPU
  MarchingCubes retention after reaction chemistry consumed the Na batch.
- Changed CPU-particle surface invalidation so absent material/phase batches
  hide immediately.
- Preserved inactive grace for resident render-field surfaces, where it still
  protects transient GPU/readback gaps.

## Evidence

- `node --check src/visualization/sphPhaseScene.js`: pass.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "inactive grace|hide empty surfaces"`:
  `34/34` pass.
- Targeted visual matrix
  `codex-sph-reaction-roomtemp-blob1-no-stale-na-20260615`: `failedCount=0`,
  empty issue counts, empty visual-surface issue counts, five frame artifacts,
  `maxVisibleSurfaceOutsideParticleBoundsM=0`, pressure impulse `0`, H2O
  visible surface count `1 -> 1`.

## Follow-Up

- Broader z-buffer/depth-order, focus-resume, and long-horizon liquid
  free-surface visual quality remain open.
