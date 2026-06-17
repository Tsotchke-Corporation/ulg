# Resident MLS-MPM Floor-Boundary Free-Surface Fix - 2026-06-17

## Status

Done.

## Summary

The resident MLS-MPM H2O/H2O free-surface spread regression is fixed for the
split CPU/WebGPU path used by the browser. The current fixture did not support
the 2026-06-16 audit's specific G2P-renormalization hypothesis: the monolithic
CPU carrier already passed the 1s H2O/H2O shape gate, and toggling that
renormalization did not change the result.

The actual bug was resident grid-update parity. The split path zeroed velocity
for the first interior floor row (`y <= dx`), while the monolithic CPU carrier
only full no-slips the floor guard row below `dx`. That frozen interior row
blocked tangential floor-supported liquid spreading, producing the sticky,
nested, block-like browser water behavior.

## Changes

- `src/runtime/sph/sphGridUpdateGpuKernel.js` now leaves the first interior
  floor row active and only zeroes the floor guard row.
- `ulg-gpu-abi/src/wgsl.js` mirrors the CPU floor-boundary condition.
- `src/runtime/sph/sphMlsMpmGpuStep.js` and `sphGridUpdateGpuKernel.js` bump
  the grid-update pipeline cache key to avoid stale shader reuse in long-lived
  browser sessions.
- `tests/sphGridUpdateGpuKernel.test.mjs` guards the corrected boundary
  semantics.
- `tests/physicsBehaviorInvariants.test.mjs` now includes a resident split
  long-horizon H2O/H2O free-surface gate.

## Validation

- `node --test tests/sphGridUpdateGpuKernel.test.mjs`
  - Passed `14/14`.
- Direct resident CPU-reference H2O/H2O MLS-MPM diagnostic:
  - `2048` substeps, `1.024 s`.
  - Raw X/Z spread about `1.830 m` after the fix, matching the monolithic CPU
    oracle and replacing the prior resident under-spread of about `1.23 m`.
  - `J=1.0464..1.0490`.
- `ULG_RUN_LONG_LIQUID_ATOMIC=1 node --test tests/physicsBehaviorInvariants.test.mjs --test-name-pattern "resident MLS-MPM H2O/H2O long-horizon"`
  - Passed `14/14`.
- Browser visual matrix:
  - Run id:
    `codex-mlsmpm-free-surface-1s-floorfix-finalframe-20260617`.
  - Passed with `failedCount=0`, no issue counts, no visual-surface issues.
  - Final metrics at `1.024 s`: one connected H2O surface, tallness `0.440`,
    footprint fill `0.182`, height `0.938 m`, and no outside-bounds surface.
  - Five frame artifacts:
    `/tmp/ulg-visual-sanity-matrix/codex-mlsmpm-free-surface-1s-floorfix-finalframe-20260617/liquid-liquid-h2o-mlsmpm-frames/`.

## Still Open

- Low-resolution MLS-MPM water still renders faceted/blocky; this fix closes the
  severe resident floor-sticking regression, not final fluid visual quality.
- Mobile focus-resume flashing/disappearing and z-buffer pixel-level artifacts
  still need representative visual/pixel gates.
- Ice/solid flowing like liquid needs a separate behavior gate.
- Accepted law stages still need continued migration behind PeerCompute
  ComputeManager/GPUHub/WebGPU workers.
