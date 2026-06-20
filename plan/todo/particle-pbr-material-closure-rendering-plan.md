# Particle PBR Material Closure Rendering Plan

Date: 2026-06-19 AKDT

## Problem

Particle rendering is not applying material PBR correctly. Sodium and most
substances can show up as flat black spheres, especially in particle/sphere
render modes. This breaks the material-closure visual contract and makes
particle rendering unreliable as either a fallback or an explicit debug mode.

## Scope

Fix PBR for particle/sphere rendering through the engine material pipeline, not
with a separate overlay or hard-coded color table. Particle render modes should
consume the same closure-derived optical/PBR rows used by surfaces whenever the
material, phase, temperature, and pressure are known.

## Required Fixes

1. Trace particle render modes that create `Mesh*Material`, instanced spheres,
   render-row points, or retained GPU row bridges and verify whether they bind
   closure-derived base color, metalness, roughness, transmission, opacity,
   emissive, and phase visibility rows.
2. Add diagnostics for particle material resolution:
   material key, phase, optical row index, PBR source, color space conversion,
   fallback reason, and whether the material was forced to black by missing
   lights, tone mapping, alpha, transmission, or WebGL/WebGPU limits.
3. Fix sodium and representative elements/compounds through the general PBR
   path. The acceptance set should include Na, Pd, Fe, H2O, air, and at least
   one product material.
4. Keep mobile/WebGL constraints explicit. If transmissive or metallic PBR is
   downgraded on a device, use a closure-derived visible proxy color and record
   the downgrade reason instead of rendering black.
5. Add browser visual-sequence evidence for explicit particle rendering and
   varying-size sphere rendering, proving material colors survive reset and
   resident continuation.

## Acceptance

- Sodium and common materials no longer render as black spheres in particle or
  spherical-particle modes unless the closure explicitly derives a black/opaque
  optical result.
- Particle PBR and surface PBR share a single material-resolution contract.
- Fallback or mobile proxy materials are closure-derived and diagnostic, not
  hard-coded cosmetic patches.

## Progress - 2026-06-19 AKDT

- Added a render-row sphere bridge metallic visibility proxy for conductor PBR
  rows. The proxy is applied inside the engine material path, not as an overlay:
  it keeps the closure-derived visible color, records original metalness,
  roughness, and environment intensity, reduces only the particle-sphere bridge
  metalness enough to survive weak mobile/WebGL environment lighting, and
  reports `renderRowSphereMetallicVisibilityProxy`.
- Surfaced `renderBridgeSphereMetallicVisibilityProxyCount` through scene state
  and the long-horizon probe so browser evidence can distinguish true material
  closure PBR from diagnostic visibility proxying.
- Verified the sodium/water MLS-MPM mobile-shaped sphere path in
  `/tmp/ulg-particle-pbr-na-mobile-spheres-probe.json`: `status=good`,
  browser console issues/warnings `0/0`, two nonblank captured canvas frames,
  sphere material keys `h2o`, `naoh`, and `Na`, closure-derived sphere PBR, and
  metallic visibility proxy count `1`.

## Remaining

- Extend browser evidence to air as an actual visible gas-particle path once the
  renderer has a cheap air particle scenario. Air now has a packed transparent
  Rayleigh PBR optical row instead of a blocked black row, but current sphere
  probes do not instantiate air particles.
- Audit the Three WebGPU material-proxy path separately; this slice covered the
  mobile WebGL sphere bridge that was rendering sodium as black.

## Progress - 2026-06-19 AKDT, Air/Pd/Fe Audit

- Added a transparent dry-air Rayleigh optical PBR row to
  `opticalRenderParams()`. This closes the mismatch where
  `intrinsicColorSrgb()` advertised air Rayleigh scattering but the packed
  optical table marked air as blocked black.
- Added optical closure and optical GPU table tests proving air records use
  `gas-rayleigh-transparent-pbr`, high transmission, nonzero Rayleigh
  scattering samples, and accepted lookup status.
- Rechecked material scenarios for Pd, Fe, Na, and Cs. Air, products
  (`naoh`, `csoh`), H2O, and selected conductor drops all resolve to nonblocked
  closure-derived PBR rows.
- Added browser evidence for Pd and Fe mobile-shaped variable-size sphere
  probes:
  `/tmp/ulg-particle-pbr-pd-mobile-spheres-probe.json` and
  `/tmp/ulg-particle-pbr-fe-mobile-spheres-probe.json` completed `status=good`
  with browser console issues/warnings `0/0`, closure-derived sphere PBR, and
  metallic visibility proxy count `1`.
