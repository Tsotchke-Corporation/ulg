# Full Visual Matrix Clean Baseline

Date: 2026-06-15 AKDT

Status: done for the current short-horizon baseline.

## Evidence

- Run ID: `codex-full-after-sph-partition-and-stale-surface-20260615`.
- Command:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-full-after-sph-partition-and-stale-surface-20260615 ULG_VISUAL_MATRIX_ALLOW_FAILURES=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 ULG_VISUAL_MATRIX_FRAME_MAX=3 ULG_VISUAL_MATRIX_FRAME_EVERY=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`.
- Result: `scenarioCount=12`, `failedCount=0`, empty `issueCounts`, empty
  `visualSurfaceIssueCounts`, and three captured frames per scenario.

## Caveat

- This is a short-horizon integration baseline, not final liquid-quality
  acceptance. CPU-SPH H2O/H2O remains visibly stacked at this sampled horizon,
  so long-horizon liquid merge/free-surface quality remains a P0 follow-up.
