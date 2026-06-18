# CPU-SPH And Resident MLS-MPM Visual Flow Sequences - 2026-06-17

## Completed Slice

Added opt-in close-spaced visual sequence gates for CPU-SPH same-material
H2O/H2O flow and a practical lower-resolution resident MLS-MPM smoke row. The
goal is to make the "fluids do not appear to flow" report testable with a frame
sequence that spans enough simulated time, not only a short still-frame matrix
row.

## Changes

- Added `liquid-liquid-h2o-cpu-sph-flow-sequence` as an opt-in visual matrix
  scenario.
- Added `liquid-liquid-h2o-mlsmpm-flow-smoke` as a practical resident smoke
  scenario. The full resident MLS-MPM flow row remains available as the
  stricter, slower 3x5 gate.
- The long-horizon probe now records simulated time for captured visual frames.
- The analyzer reports `visualFrameTimesS` and `visualFrameTimeSpanS`, and can
  fail a row when the captured frames do not span the required simulated time.
- The overlay warning chip now includes current simulated time as `sim t`.

## Evidence

- Syntax checks passed for the touched JS/MJS files.
- `codex-cpu-sph-flow-sequence-20260617` passed with `failedCount=0`, nine
  frames, `visualFrameTimeSpanS=0.9216`, final H2O tallness `0.587`, footprint
  fill `0.297`, one visible H2O surface/component, and empty visual issues.
- `codex-mlsmpm-flow-smoke-pass-20260618` passed with `failedCount=0`, nine
  frames, `visualFrameTimeSpanS=1.024`, final H2O tallness `0.767`, footprint
  fill `0.151`, one visible H2O surface/component, and empty visual issues.

## Still Open

- The full 3x5 resident MLS-MPM flow-sequence row is still expensive under
  headless WebGPU/SwiftShader. Use the smoke row for periodic checks and the
  full row for deeper validation or hardware-backed browser runs.
