# Drop Edge Large Size Respect Plan

Date: 2026-06-19 AKDT

## Problem

The drop edge setting does not appear to be respected for values larger than
`6`. Larger requested drop sizes either clamp, normalize incorrectly, or fail
to affect the initialized drop geometry/particle placement in the expected
way.

## Scope

Fix drop sizing through the actual initialization and particle placement path,
not with a visual-only scale. The setting should consistently control the drop
domain used by particle generation, material cohort counts, render bounds,
resident GPU uploads, and reset/rebuild flows.

## Required Investigation

1. Trace the URL/UI parameter for drop edge through state creation, particle
   sampling, spacing/radius selection, render-domain counts, and MLS-MPM GPU
   upload packing.
2. Identify whether values above `6` are clamped by UI limits, URL parsing,
   box/domain bounds, particle-count budgeting, sampling density, active-grid
   bounds, or render-field extraction limits.
3. Add diagnostics that report requested drop edge, effective drop edge,
   clamp reason, generated drop particle count, drop bounds, and resident upload
   bounds.
4. Reproduce with representative values below, at, and above `6`, including
   reset/rebuild and mobile-sized viewport paths.

## Acceptance

- Drop edge values larger than `6` are either honored physically or rejected
  with an explicit diagnostic reason tied to box/domain or particle-budget
  constraints.
- Generated particles, render bounds, resident upload metadata, and reset state
  agree on the effective drop dimensions.
- The fix is material-agnostic and works with variable particle spacing/radius.

## Implementation Status

2026-06-19 AKDT:

- The initializer now treats explicit role edge requests above `6` as a lower
  bound for adaptive spacing. The density/temperature resolver can still refine
  particle size and paired-role spacing, but it no longer silently lowers a
  high requested drop edge.
- Same-material/same-temperature matching preserves high requested drop edges
  and scales the paired base edge when needed to keep equal physical particle
  radius. Equal high drop/base requests preserve both explicit role edges and
  report that same-material spacing was not unified.
- Demo and view state now expose
  `peercompute.ulg.sph-initial-particle-edge-diagnostics.v0` with requested and
  effective edge, generated count, block edge, spacing, radius, and preservation
  status. Long-horizon probes and performance benchmarks carry the same
  diagnostics.
- Focused coverage is in `tests/sphPhaseDemo.test.mjs` for `dropn=7, basen=5`,
  non-matching adaptive spacing, and `dropn=basen=7` benchmark-count
  preservation.

Remaining:

- Add a mounted browser visual-sequence check that exercises reset/rebuild with
  `dropn>6` and confirms resident upload/render-domain counts match the new
  diagnostics after scene reset.
