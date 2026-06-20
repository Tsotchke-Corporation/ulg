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
