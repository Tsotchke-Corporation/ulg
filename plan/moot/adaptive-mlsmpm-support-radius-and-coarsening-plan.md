# True Adaptive MLS-MPM Support Radius and Coarsening Plan

Date: 2026-06-22 AKDT
Status: moot as an independent CPU-first execution track; numerical transfer,
support, and split/merge conservation gates are carried by
`plan/done/SS/shared-spatial-authority-refactor-plan.md`.

## Purpose

Implement true adaptive MLS-MPM as a separate physics/performance track after
the current fixed-grid liquid/pressure bugfix reaches a clean break.

This is not the same as the existing material-derived initial particle size
work, visual sphere radius policy, or reaction product scale caps. The target
is adaptive solver particles whose support, transfer weights, and split/merge
state are physically meaningful and conservation safe.

## Clean-Break Gate

Do not start this work until the current physically correct fixed-grid MPM
slice has a clean break:

- water/liquid behavior has an accepted pressure/incompressibility strategy;
- ambient pressure is treated consistently as gauge equilibrium or boundary
  traction, not as a visual patch;
- current fixed-support CPU/GPU MLS-MPM behavior is documented and visually
  verified enough that adaptive support changes can be isolated.

Until then, adaptive MLS-MPM remains a separate todo. It should not be used as
the fix for water behaving like a gas.

## Problem

The current MLS-MPM implementation carries per-particle mass and rest volume,
but the P2G/G2P transfer support is still fixed by the global grid spacing. A
particle may visually represent a different amount of material, but it still
uses the same quadratic 3-node-per-axis stencil as every other particle.

That is a fixed-grid macro-particle model, not true adaptive MLS-MPM. It can be
a useful transitional representation, but it is not sufficient for physically
correct level-of-detail, coarsening, or multi-scale particles.

## Non-Goals

- Do not fix PBR, water transparency, or sphere color in this track.
- Do not use adaptive support as a workaround for liquid incompressibility.
- Do not hard-code material-specific particle sizes.
- Do not merge particles across material, phase, reaction, contact, or free
  surface boundaries.
- Do not silently hide invalid reaction expansion behind larger particles.

## Required Work

1. Audit the current fixed-support paths.
   - CPU P2G/G2P in `src/runtime/sph/mlsMpmCarrier.js`.
   - GPU P2G/G2P WGSL in `ulg-gpu-abi/src/wgsl.js`.
   - Mechanics packing in `src/runtime/sph/sphGpuBuffers.js`.
   - Current tests that assume fixed 3x3x3 support.

2. Add an explicit solver support radius field.
   - Store per-particle support radius or support scale separately from visual
     radius, material rest volume, and block edge.
   - Derive initial support from material mass/rest density and an admission
     policy, but keep it independent from renderer sphere radius.
   - Publish diagnostics showing support radius, visual radius, rest volume,
     mass, density, and grid spacing.

3. Implement variable-support P2G/G2P.
   - Replace fixed 3-node-per-axis assumptions with a per-particle support
     stencil.
   - Scale kernel evaluation by the particle support radius.
   - Normalize weights so the partition of unity survives variable support and
     boundary truncation.
   - Preserve MLS first-moment behavior; if normalization changes moments,
     record and correct the moment residual instead of hiding it.
   - Adjust stress-gradient scaling consistently with the chosen support
     radius, not blindly with the global `dx`.

4. Keep the GPU path performance bounded.
   - Prefer quantized support tiers or bounded stencil families if fully
     dynamic loops are too expensive or hard to validate in WGSL.
   - Report fallback/admission status when a requested support radius exceeds
     the supported tier range.
   - Preserve resident no-full-readback operation outside explicit debug
     validation modes.

5. Add conservation-safe split/merge/coarsening.
   - A 2x2x2 block simplifying to one macro-particle is acceptable when the
     merge is admitted by local state and conserves mass, volume, linear
     momentum, angular/affine momentum where represented, and internal energy.
   - Split and merge must carry material id, phase/thermo state, deformation
     gradient, `J`, affine `C`, reaction state, product ledger metadata, and
     render-domain metadata without inventing or destroying material.
   - Merging should be rejected near interfaces, free surfaces, walls, active
     reactions, strong velocity gradients, or incompatible phase/temperature
     states.
   - All rejected merges need diagnostics, not silent no-ops.

6. Add invariant tests.
   - Partition-of-unity and first-moment checks for variable support kernels.
   - CPU P2G/G2P round-trip tests for different support radii.
   - WGSL source and WebGPU parity tests for supported support tiers.
   - Split/merge unit tests for mass, center of mass, linear momentum, affine
     momentum, volume, density, internal energy, and material/phase metadata.
   - Stress tests proving repeated split/merge cycles do not drift mass,
     momentum, or energy.
   - Browser visual sequence checks proving adaptive/coarsened blocks still
     move coherently and do not resize differently between drop/base roles for
     identical material state.

## Acceptance Criteria

- A fixed-support run and an adaptive-support run report distinct solver
  policies in diagnostics.
- Weight normalization preserves total transferred mass to tolerance for
  particles with different support radii, including near boundaries.
- G2P reconstruction preserves constant velocity fields for all supported
  support tiers.
- Split/merge conserves total mass, center of mass, linear momentum, represented
  affine momentum, volume, and internal energy within documented tolerance.
- A same-material same-temperature drop/base pair uses the same material
  particle state unless a documented adaptive LOD policy admits different
  support for local error/performance reasons.
- A 2x2x2 same-material block can coarsen into a single macro-particle only
  through the conservation-safe merge path, with diagnostics proving the
  before/after invariants.
- Browser evidence shows motion and bounded size under the live HTTPS server
  without relying on renderer-only clamps.

## Suggested Slice Order

1. Diagnostics and fixed-support audit, with tests that prove the current
   implementation is still fixed-support.
2. CPU variable-support kernel prototype with normalization and invariant tests.
3. GPU support tiers and parity tests.
4. Conservation-safe merge for uniform same-material interior blocks.
5. Split path and split/merge cycling tests.
6. Browser visual gate for coarsened blocks and mixed support tiers.
7. Performance gate and resident no-full-readback integration.

## Risks

- Variable support can destabilize MLS transfers if normalization fixes mass
  but breaks first moments.
- Dynamic GPU stencils can erase the performance win unless support tiers and
  active-grid admission are bounded.
- Coarsening across boundaries can destroy free-surface/contact behavior.
- Energy and affine momentum accounting can drift if merge/split treats
  internal energy, deformation, or `C` as visual metadata instead of solver
  state.
