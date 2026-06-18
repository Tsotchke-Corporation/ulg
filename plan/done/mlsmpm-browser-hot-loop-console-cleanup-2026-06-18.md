# MLS-MPM Browser Hot-Loop Console Cleanup - 2026-06-18

## Status

Completed tactical cleanup for the Cs/H2O no-full resident MLS-MPM browser
route. This is not the WebGPU-Ocean replacement backend; it removes avoidable
validation failures and readback fences from the current resident path.

## Changes

- Tagged WebGPU buffers and resident product-mass handles with their creating
  device and skipped cross-device retained product-event handles before bind
  group creation.
- Requested supported adapter-scale resident WebGPU limits for large buffers.
- Deferred no-full reaction scratch cleanup until queued GPU work completes.
- Added `compactSummaryMode=none` and used it for the live no-full scene path,
  setting compact readback budgets to zero.
- Disabled the raw WebGPU surface overlay by default because it is a separate
  canvas and cannot share Three.js depth during perspective changes.

## Evidence

- Focused Node tests passed:
  - `tests/sphMlsMpmGpuStep.test.mjs`
  - `tests/sphReactionGpuKernel.test.mjs`
  - `tests/sphReactionGpuSummary.test.mjs`
  - `tests/opticalGpuBuffers.test.mjs`
  - `tests/orchestration.test.mjs`
  - `tests/sphPhaseRenderer.test.mjs`
- Browser manual resident probe:
  `issueCount=0`, `Worker=function`, `reactionStep=7ms`,
  `compactSummary=0`, `compactSummaryRequested=false`.
- Browser auto scheduler:
  first 16-step batch completed with `issueCount=0`, no resident error, and
  `compactSummaryMode=none`.
- Perspective sanity:
  before/after orbit screenshots were nonblank and showed one Three canvas.

## Open

- Three/MarchingCubes still produces WebGL `ReadPixels` performance warnings.
- A true GPU-resident render path remains part of the WebGPU-Ocean-style
  architecture work.
- Full validation still needs explicit compact/full readback modes.
