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
