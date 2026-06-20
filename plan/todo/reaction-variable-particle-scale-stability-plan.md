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

## Implementation Status - 2026-06-19 17:01 AKDT

Implemented the first fail-closed render-row bound for runaway variable
particle scale:

- CPU render-row extraction now reports
  `peercompute.ulg.sph-render-row-particle-scale-stability.v0` diagnostics.
  The diagnostic records raw/effective radius growth, raw/effective `J`, cap
  count, sample capped rows, material id, phase id, and cap reason.
- WebGPU render-row extraction applies the same policy in WGSL before rows
  reach retained render buffers, particle points, particle spheres, or surface
  extraction: max radius growth ratio `4`, max effective volume ratio `J=64`.
- WebGPU retained/no-readback runs report
  `gpu-row-cap-policy-applied-in-shader` without adding a CPU particle scan to
  the hot path. Full cap counts remain a CPU-reference/readback diagnostic.
- The scene and long-horizon probe now expose the cap policy on render-row
  point/sphere bridges and generic surface draw summaries.
- Focused tests cover an artificial runaway MLS-MPM `J=1e9` row and assert
  that CPU rows clamp radius, volume, `J`, and diagnostics. A WGSL source guard
  keeps the shader constants and branch wired.

Validation:

- `node --check src/runtime/sph/sphRenderGpuKernel.js`
- `node --check ulg-gpu-abi/src/wgsl.js`
- `node --check tests/sphRenderGpuKernel.test.mjs`
- `node --check src/visualization/sphPhaseScene.js`
- `node --check scripts/sph-long-horizon-probe.mjs`
- `node --test tests/sphRenderGpuKernel.test.mjs` passed `51/51`.
- `npm run test:physics-atomics` passed `11/11`; the three long-horizon
  liquid acceptance gates remained opt-in/skipped.
- Browser probe `/tmp/ulg-reaction-particle-scale-cap-probe-bridge.json`
  completed `status=good`, analysis `good`, browser console issue count `0`,
  worker capability `worker-capability-ready` with `12` workers, sphere bridge
  `three-render-row-spheres`, closure-derived sphere PBR enabled, and
  render-row particle-scale policy `gpu-row-cap-policy-applied-in-shader`
  with max radius growth `4` and max `J=64`.

Remaining:

- Add a targeted reaction reproduction that actually trips the cap in browser
  telemetry, not only the unit-level synthetic `J=1e9` fixture.
- Split gas/foam product expansion from individual particle visual radius so
  gas volume can be represented without huge per-particle spheres.
- Add reset/lockup regression coverage after the reset functionality fix lands.

## Implementation Status - 2026-06-19 18:44 AKDT

Implemented a resident mechanics-side particle-scale guard for the same runaway
class:

- MLS-MPM G2P now applies a general volume-ratio guard after material-specific
  condensed stabilization and before writing `out_mls_mechanics`: min `J=0.1`,
  max radius growth ratio `4`, and max effective `J=64`.
- The standalone G2P WGSL and fused no-full resident mechanics G2P path now use
  the same cap constants and bumped pipeline cache keys.
- CPU G2P reports
  `peercompute.ulg.mls-mpm-g2p-particle-scale-stability.v0` diagnostics with
  cap counts, invalid counts, raw/effective `J`, radius growth ratios, and
  sample capped particle rows.
- WebGPU no-full and fused no-full runs report
  `gpu-g2p-cap-policy-applied-in-shader` in resident-step diagnostics without
  adding a CPU particle scan to the hot loop.

Validation:

- `node --check src/runtime/sph/sphG2pGpuKernel.js`
- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
- `node --check ulg-gpu-abi/src/wgsl.js`
- `node --check tests/sphG2pGpuKernel.test.mjs`
- `node --check tests/sphMlsMpmGpuStep.test.mjs`
- `node --test tests/sphG2pGpuKernel.test.mjs` passed `17/17`.
- `node --test tests/sphMlsMpmGpuStep.test.mjs` passed `60/60`.

Remaining:

- Add a targeted reaction reproduction that actually trips the G2P/render cap
  in browser telemetry, not only synthetic G2P/render-row fixtures.
- Split gas/foam product expansion from individual particle visual radius so
  gas volume can be represented without huge per-particle spheres.
- Add active-grid/support-radius admission checks if a future product-expansion
  path can grow per-particle support before G2P sees `J`.
- Add reset/lockup regression coverage after the reset functionality fix lands.

## Implementation Status - 2026-06-19 AKDT

Added a render-row support-radius guard for aggregate/product visual radius:

- CPU render-row extraction now also records the support-radius policy:
  `maxSupportRadiusSmoothingRatioAllowed=2`, the derived `maxSupportRadiusM`,
  and cap samples with reason `max-support-radius`.
- WebGPU render-row extraction passes the same derived support radius into the
  uniform block and clamps `particle_radius_m` in WGSL after the existing
  max-growth/max-`J` guard. Retained/no-full runs expose
  `supportRadiusPolicyAppliedInShader=true` without adding a CPU particle scan.
- Scene and long-horizon probe diagnostics now surface
  `renderRowsParticleScaleMaxSupportRadiusM` and
  `renderRowsParticleScaleSupportRadiusPolicyAppliedInShader` alongside the
  existing decoded `J` cap-boundary fields.
- Focused tests now cover a synthetic aggregate product radius case where
  `J=1` but mass/density would otherwise produce a visual particle larger than
  the solver support radius.

Validation:

- `node --check src/runtime/sph/sphRenderGpuKernel.js`
- `node --check src/visualization/sphPhaseScene.js`
- `node --check scripts/sph-long-horizon-probe.mjs`
- `node --check tests/sphRenderGpuKernel.test.mjs`
- `node --check ulg-gpu-abi/src/wgsl.js`
- `node --test tests/sphRenderGpuKernel.test.mjs` passed `52/52`.
- Browser probe `/tmp/ulg-reaction-support-radius-cap-probe.json` completed
  `status=good`, analysis `good`, browser console issues/warnings `0/0`, four
  nonblank captured visual frames, final resident sphere max radius
  `0.5263000726699829 m`, decoded max `J=1.0000579357147217`, no decoded
  `J=64` cap-boundary rows, and retained shader support policy
  `maxSupportRadiusM=0.6203504908994 m`.

Remaining:

- Add a targeted browser reaction or harness fixture that actually trips the
  support-radius cap in browser telemetry, not only the unit-level synthetic
  aggregate radius fixture.
- Split gas/foam product expansion from individual particle visual radius so
  reaction volume can route through product/gas fields instead of giant
  per-particle spheres.
- Add reset/lockup regression coverage after the reset functionality fix lands.
