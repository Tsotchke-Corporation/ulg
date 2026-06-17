# Transmissive H2O Depth Policy - 2026-06-17

Status: done.

## What Changed

- Condensed transmissive H2O now renders as depth-writing physical transmission
  instead of alpha transparency in the default Three/MarchingCubes path.
- The optical GPU lookup material refresh now keeps the same contract as the
  initial material constructor.
- The visual probe's render-depth analyzer now accepts depth-writing
  `transmissive-surface` rows and keeps vapor/alpha rows depth-sortable.

## Evidence

- `node --test tests/sphPhaseRenderer.test.mjs` passed `35/35`.
- `codex-cpu-sph-h2o-depthwrite-long-20260617` passed with one H2O surface, one
  component, final tallness `0.582`, footprint fill `0.296`, and empty visual
  issues.
- `codex-mlsmpm-h2o-depthwrite-merge-20260617` passed with one H2O surface, one
  component, final tallness `0.440`, footprint fill `0.182`, and empty visual
  issues.

## Still Open

- Low-resolution MLS-MPM water remains faceted/blocky.
- The raw WebGPU overlay canvas still needs an explicit shared-depth or
  composition decision before it should be trusted as the default renderer.
- Mobile focus-resume flashing/disappearing remains open.
