# CPU-SPH Visual Flow Sequence - 2026-06-17

## Completed Slice

Added an opt-in close-spaced visual sequence gate for CPU-SPH same-material
H2O/H2O flow. The goal is to make the "fluids do not appear to flow" report
testable with a frame sequence that spans enough simulated time, not only a
short still-frame matrix row.

## Changes

- Added `liquid-liquid-h2o-cpu-sph-flow-sequence` as an opt-in visual matrix
  scenario.
- The long-horizon probe now records simulated time for captured visual frames.
- The analyzer reports `visualFrameTimesS` and `visualFrameTimeSpanS`, and can
  fail a row when the captured frames do not span the required simulated time.
- The overlay warning chip now includes current simulated time as `sim t`.

## Evidence

- Syntax checks passed for the touched JS/MJS files.
- `codex-cpu-sph-flow-sequence-20260617` passed with `failedCount=0`, nine
  frames, `visualFrameTimeSpanS=0.9216`, final H2O tallness `0.587`, footprint
  fill `0.297`, one visible H2O surface/component, and empty visual issues.

## Still Open

- The matching resident MLS-MPM flow-sequence row is too expensive under
  headless WebGPU/SwiftShader right now. The shortened run stayed busy for
  about five minutes without producing an artifact. Resident visual-flow
  validation needs either a cheaper render/readback sequence path or a
  hardware-backed browser run.
