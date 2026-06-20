# Algorithm-Derived Material Properties Plan

Date: 2026-06-18 AKDT

## Purpose

After the resident MLS-MPM lane and GPU marching-cubes surface path are in
place, adapt ULG's material-property derivation strategy for the actual
algorithms that consume those properties. The new runtime will need
algorithm-shaped tables, but those values must still be derived from
fundamental closures, accepted provenance, or audited warm cache artifacts.

This is not permission to replace first-principles material derivation with
hand-tuned constants. It is a plan for deriving the right reduced rows for
MLS-MPM mechanics, contact, surface extraction, optical/PBR rendering, and
diagnostics.

## Required Derived Rows

### MLS-MPM Mechanics

- Rest density and specific volume at temperature, pressure, phase, and
  composition.
- Bulk modulus, shear modulus, Lamé parameters, Poisson ratio, sound speed, and
  compressibility rows for the active phase.
- Plasticity/yield, viscosity, cohesion, damping, and phase-dependent
  constitutive hints.
- Particle mass, support radius, target neighbor count, initial spacing or
  dynamic particle size from closure volume rather than renderer density.
- Thermal expansion, phase-transition volume change, and J/rest-volume
  reference values.
- Contact rows for wall and material-interface response, including
  elasticity-inclusive dynamic stiffness inputs.

### GPU Marching Cubes And Surface Rendering

- Isovalue policy per material/phase, derived from density/support kernel
  semantics rather than a visual threshold constant.
- Surface smoothing radius, field voxel size, gradient/normal scale, and
  compact-vertex budget from particle support and material state.
- Material/phase/optical ids, transparency/depth policy, absorption,
  scattering, IOR, roughness, metalness, emissive/blackbody coupling, and
  temperature-dependent PBR rows.
- Presentation-safe proxy PBR rows for interim renderers and mobile devices:
  transmissive/metallic closures may need reduced diffuse color, opacity,
  depth, and transmission flags for point/sphere/diagnostic bridges while the
  full surface renderer consumes the richer optical rows.
- Interface classification hints for mixed materials, products, gas/vapor, and
  transient reaction volumes.
- Draw-order and validation metadata needed by the engine bridge without
  reading full geometry back to CPU.

### Diagnostics And Validation

- Conservative CFL and timestep bounds from sound speed, viscosity, and
  thermal/reaction rates.
- Stability guard thresholds for J, velocity, pressure, energy, and contact
  impulse that are material-state aware.
- Compact proof rows that can be read back at a throttled cadence without
  invalidating the resident hot loop.

## Closure Authority Rules

- Fundamental closure graph remains authoritative. Algorithm rows are derived
  views, not new sources of truth.
- Precomputed JSON bank records may seed or cache derivation, but every row
  must retain schema version, units, reference state, validity domain, and
  provenance.
- Strict mode must be able to audit or reject warm rows and rerun the lower
  closure path.
- Algorithm-specific cache keys must include material identity, composition,
  phase, temperature, pressure, density/rest-volume reference, solver version,
  ABI row layout version, and generator fingerprint.
- Any hand-tuned fallback must be marked as `reference-fallback` or
  `reduced-estimate`, never as first-principles evidence.

## Runtime Integration Order

1. Define row schemas for MLS-MPM material mechanics and GPU surface-render
   material rows.
2. Add CPU reference derivation that maps fundamental material closures into
   those rows.
3. Add cache validation and stale-row rejection keyed by closure and solver
   fingerprints.
4. Wire rows into MLS-MPM initialization, contact, timestep/CFL policy, and the
   marching-cubes/surface adapter.
5. Promote derivation and packing to Worker/WebGPU-resident paths once CPU
   parity and provenance gates pass.

Current status, 2026-06-20 AKDT: the first CPU-side particle initialization
row contract is in place as
`peercompute.ulg.algorithm-material-particle-initialization-rows.v0`. It is
fed by the closure-derived initial spacing plan plus versioned material-bank
and crystal-bank warm inputs, and reports applied radius separately from
crystal packing diagnostic radius. This satisfies the generic initialization
row scaffold; the open work is to derive solver-specific MLS-MPM mechanics,
contact, and marching-cubes/surface rows from this contract.

MLS-MPM mechanics status, 2026-06-20 AKDT: `buildMlsMpmGpuParticleBuffers()`
now emits `peercompute.ulg.algorithm-material-mls-mpm-mechanics-rows.v0`.
These compact rows are derived from the packed mechanics buffer and the
particle initialization rows, aggregating role/material/phase mechanics and
carrying crystal metadata forward. Contact policy and marching-cubes/surface
policy are still open consumers.

Contact policy status, 2026-06-20 AKDT:
`peercompute.ulg.algorithm-material-contact-rows.v0` now derives a drop/base
contact-policy view from the MLS-MPM mechanics rows. It is explicitly
non-authoritative for force mutation and carries stiffness, damping/support,
and crystal-key metadata for the future force kernel. Marching-cubes/surface
policy remains the next unimplemented row family.

## Completion Gates

- Same material and temperature produce consistent drop/base particle mass,
  support, spacing/size, and render surface scale.
- Material-specific PBR survives mobile and desktop render paths without flat
  black presentation, with fallback/proxy reasons reported separately from
  closure authority.
- MLS-MPM wall and material-interface contact use derived stiffness/viscosity
  rows with bounded impulses.
- GPU marching-cubes extraction uses derived isovalue/smoothing/normal/optical
  rows and emits ULG-compatible surface vertex plus draw metadata.
- Browser console harness stays clean; dense visual sequence and physics
  atomics pass representative liquid, solid/liquid, metal/water, gas/product,
  and phase-transition scenarios.

## Dependencies

- `plan/todo/webgpu-ocean-mlsmpm-simulator-plan.md`
- `plan/todo/webgpu-material-property-resolvers-plan.md`
- `plan/todo/material-property-json-bank-plan.md`
- `plan/todo/cubic-barrier-contact-integration-plan.md`
