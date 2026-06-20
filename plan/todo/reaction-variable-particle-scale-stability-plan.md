# Reaction Variable Particle Scale Stability Plan

Date: 2026-06-19 AKDT

## Problem

Variable scaled particles can explode in apparent size exponentially during
some chemical reactions, then reset or lock up the simulation without a browser
console error. The failure is currently silent, so the runtime can look stable
from console telemetry while the physics state or render state has already
become unusable.

## Scope

Fix reaction-driven particle size growth as a physics/runtime stability issue,
not as a visual-only clamp. Particle radius/support must remain derived from
material mass, density, phase, temperature, pressure, and valid packing or
kernel-support constraints, but the live solver also needs bounded growth,
diagnostics, and fail-closed reset behavior.

## Working Hypotheses

- Reaction/product mass or phase rows can create a feedback loop where product
  visible radius is recomputed from already-expanded particle scale.
- Variable radius may be using visual size as a source value instead of deriving
  from conserved mass/density each step.
- New product or gas/foam particles may lack a maximum support radius relative
  to grid spacing, smoothing length, local mass, or cell occupancy.
- Temperature/pressure-driven expansion may need rate limiting across substeps
  so a single reaction event cannot move radius by orders of magnitude.
- Reset/lockup can happen without console errors because the values remain
  finite enough for WebGPU/Three submission while blowing up bounds, active-grid
  ranges, surface extraction allocation, or camera/render scale.

## Required Fixes

1. Add particle-scale diagnostics to the resident and render summaries:
   max radius, radius growth ratio, source material/product, phase, temperature,
   pressure, mass, density, and reaction event provenance.
2. Add invariant checks that flag runaway radius growth before it reaches the
   renderer or active-grid planner:
   finite radius, positive density, mass-conserving volume, bounded support
   radius relative to grid spacing, and bounded per-substep growth ratio.
3. Replace any visual-size feedback loop with a derived-radius path:
   `radius = f(mass, density(material, phase, T, P), packing/support policy)`.
4. Add physically justified caps:
   maximum visual radius, maximum solver support radius, maximum growth ratio
   per substep, and a separate gas/foam expansion policy when product gas needs
   volume without giant individual particles.
5. Make cap activation explicit in diagnostics and validation. A cap should not
   silently hide invalid chemistry; it should record the material, reaction,
   unclamped radius, clamped radius, and reason.
6. Add a reset/lockup reproduction gate with the reactions that triggered the
   issue, then run it through `npm run test:physics-atomics` and a browser
   no-console-error visual sequence.

## Acceptance

- Reaction scenarios that previously caused exponential particle-size growth
  stay finite, visually bounded, and continue advancing after reset.
- Browser console remains clean, but the test must also assert the new radius
  diagnostics so "no console error" is not treated as success by itself.
- Mass/volume accounting remains explicit; caps must not create or destroy
  material mass without a recorded residual or gas/pressure route.
- The fix works for arbitrary materials/products, not a hard-coded reaction
  pair.
