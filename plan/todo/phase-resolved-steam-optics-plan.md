# Phase-Resolved Steam Optics Plan

Date: 2026-06-11 AKDT

## Current checkpoint - 2026-09-04 AKDT

Goal 2 remains open. Conserved phase-transfer/reaction-born condensed mass now
feeds an authenticated resident optical sidecar and one material-general
participating-volume renderer. Its optical state is not inferred from a gas
label or scripted opacity. Pure vapor and condensed collective routes remain
distinct; ordinary material surfaces use their own route.

The desktop canonical water-cycle run reached 4.608 simulated seconds and
showed vaporization/recondensation with negligible mass drift, but did not show
a convincing transported steam plume. A follow-up shared render fix excludes
the sidecar's matching condensed mass from bulk geometry without changing the
physics ledger; mixed phases, other materials, and motion-smear re-sampling are
covered by focused tests and a native GPU metamorphic test.

The present compact-sphere-per-carrier morphology is a declared reduced model,
not an unresolved droplet population closure. Droplet number/size evolution,
airborne versus bulk deposition, and direct long-horizon plume evidence remain
required work. The historical reduced CPU descriptor work below does not prove
those resident microphysics requirements, and this plan must not be archived
on renderer readiness alone.

### Next resident microphysics slices (not yet implemented)

First diagnose the existing long-run motion evidence: water exceeds the
generic 50 m/s speed threshold late, and sodium's nearly stationary batches
2-16 are followed by a large authoritative state change at batch 17. Compositor
pixels agree with the latter trajectory; distinguish physical support/release
from a state-writer defect before treating it as an optical/capture problem.

The 2026-09-04 follow-up GPU traces now identify sodium's freeze: one gas cell
has condensed occupancy 1.149% above geometric volume, so free-volume/EOS
publication fails and the downstream mechanics transaction restores its input.
Chemistry still advances. This is not a new-law compilation stall or a renderer
failure. Before parcel work, reconcile S9 nodal occupied-volume projection with
the gas cell geometry and the coupled condensed/gas volume constraint. Do not
increase the overfill tolerance, invent a positive void floor, or drop pressure
to pass the demo. Require manufactured GPU geometry/volume tests, conservation
and pressure-work checks, and a long sodium desktop run past 2.56 s without
rejected/stationary generations or the previous jump. Exact counters and cell
volumes are in `/tmp/ulg-goal2-sodium-overfill-geometry-W9mURc/summary.json`.

The current four-lane transfer merges each lineage's target-phase mass into
one position/velocity. A single liquid lane therefore cannot represent both a
bulk pool and spatially separate airborne fog. Adding a smaller optical radius
would not repair that transport mismatch.

1. Derive species partial-pressure and saturation diagnostics on existing
   SS-owned gas cells. Use vapor-species moles and free volume, not total mixed
   gas pressure, for supersaturation. Keep this first slice diagnostic-only.
2. Introduce an admitted sparse aerosol parcel family with conserved mass,
   physical droplet multiplicity, position, material/phase and nucleus
   provenance. Derive radius from mass, density and multiplicity; SPH sample
   count and molecular entity count are not droplet count. Include this mass
   in global phase/energy reductions before moving it out of bulk carriers.
3. Add material-general activation/growth with equal-and-opposite vapor,
   aerosol and latent-energy deltas. Nuclei population is an explicit
   environmental input; homogeneous nucleation requires a declared kinetic
   closure. Missing physical inputs must not manufacture a cloud.
4. Couple airborne motion to the carrier gas with a declared drag/slip validity
   domain. Classify direct bulk condensation and subsequent aerosol deposition
   through an admitted interface witness, preserving mass/momentum/energy.
5. Prove parcel-count invariance at fixed mass/multiplicity, no spurious
   activation, phase/energy conservation, gas-following motion, bulk deposition,
   and a real desktop transported scattering plume. Stochastic coalescence and
   higher-order size spectra can follow this minimum coherent slice.

This proposed representation follows the physical-multiplicity and coupled
growth/transport approach of [Shima et al.](https://arxiv.org/html/physics/0701103v2),
not one rendered sphere per simulated material sample. Its first low-inertia
regime must be declared rather than assumed for all particles. For water,
[Petters and Kreidenweis](https://acp.copernicus.org/articles/7/1961/2007/acp-7-1961-2007.html)
provides a candidate hygroscopic activation closure, and
[IAPWS saturation properties](https://iapws.org/technical-guidance/release/Supp-sat)
provides a reference thermodynamic function. These are design inputs, not
claims of implemented or scientifically calibrated runtime behavior.

## Purpose

Make water, ice, water vapor, and visible steam render from phase-resolved
optical closures instead of collapsing to similar clear/transmissive surfaces.
The goal is not to fake a white cloud. Pure H2O vapor should remain nearly
invisible; visible steam should appear only when the low-level thermodynamic and
microphysical chain predicts condensed droplets or aerosols that scatter light.

## Current Behavior

- H2O particles carry material identity `h2o`.
- The render descriptor maps H2O gas to `renderKey: steam` and `phase: gas`.
- `opticalRenderParams()` and the WebGPU optical table are keyed by
  `material|phase`, so liquid and gas are not intentionally sharing one cache
  row.
- The vapor optical closure sets IOR near one, low opacity, high transmission,
  and a long attenuation distance. That is physically reasonable for pure water
  vapor, but it makes steam look too similar to clear water in the current
  MarchingCubes/PBR bridge.
- The missing piece is a condensation/nucleation/droplet scattering closure.

## Target Model

Optical closure identity must include:

- material/formula,
- phase,
- temperature,
- pressure,
- density,
- phase fractions,
- path length,
- particle or droplet size distribution,
- mixture composition,
- generator/method hash.

For H2O:

- solid ice: transparent dielectric with ice IOR, lower absorption, optional
  grain-boundary scattering when microstructure exists;
- liquid water: dielectric with liquid IOR, Beer-Lambert absorption and
  path-length tint;
- water vapor: dilute gas with near-unity IOR and weak absorption, normally
  almost invisible;
- visible steam/cloud: two-phase mixture of vapor plus condensed droplets, with
  Mie/Rayleigh scattering derived from droplet radius distribution and liquid
  water mass fraction.

## Implementation Plan

### 1. Phase/Thermodynamic Optical Cache Keys

- Extend optical cache keys beyond `material|phase|pathLength` to include the
  state fields that can change optical response:
  - temperature,
  - pressure,
  - density,
  - phase fractions,
  - mixture/droplet summary,
  - generator fingerprint.
- Keep material-only fallback rows only for coarse UI placeholders; strict SPH
  render rows should use material-phase-state keys.

### 2. Condensation And Droplet Closure

- Add a derived H2O microphysics closure:
  - saturation vapor pressure from thermodynamics,
  - supersaturation ratio,
  - nucleation/condensation trigger,
  - condensed droplet mass fraction,
  - droplet radius distribution or effective radius,
  - evaporation when local state returns below saturation.
- The closure may be reduced at first, but it must be driven by temperature,
  pressure, H2O vapor mass, air/gas mixture state, and available condensed
  nuclei. No scripted white alpha.

### 3. Scattering Optical Response

- Add a visible-steam optical model:
  - Mie scattering for droplets when radius is comparable to visible
    wavelengths,
  - Rayleigh limit for very small droplets,
  - absorption from liquid H2O path length,
  - phase function/asymmetry and extinction coefficient,
  - PBR mapping to base color, transmission, opacity, roughness, scattering, and
    attenuation.
- Pure vapor should keep low opacity and high transmission.

### 4. Runtime State Plumbing

- Add per-particle or per-gas-cell microphysics fields:
  - H2O vapor mass fraction,
  - condensed droplet mass fraction,
  - effective droplet radius,
  - local pressure,
  - local temperature,
  - phase fractions.
- Feed those fields into optical table construction and, later, the resident
  WebGPU render-field path.
- Cache derived optical rows by state buckets so the renderer does not rebuild a
  unique optical row for every particle every frame.

### 5. WebGPU Residency

- Extend the optical GPU table/query ABI with state-bucket ids or compact
  microphysics rows.
- Run the optical lookup on GPU-resident render rows so phase/microstructure
  changes do not require heavy JavaScript table rebuilding.
- Read back only compact diagnostics:
  - vapor mass,
  - condensed droplet mass,
  - mean droplet radius,
  - optical depth,
  - scattering coefficient,
  - cache hit/miss/stale counts.

## Acceptance Tests

- Liquid H2O and H2O gas produce distinct optical cache keys and distinct optical
  GPU records.
- Pure vapor remains nearly invisible at low droplet fraction.
- Supersaturated vapor with derived condensed droplets produces a visible white
  scattering volume.
- Increasing droplet mass or path length increases optical depth through the
  derived scattering model.
- Cache invalidation rejects optical rows when phase, state bucket,
  microphysics, path length, or generator hash changes.
- Browser e2e can distinguish:
  - liquid-water transmissive surface,
  - pure vapor weak/clear surface,
  - condensed steam/cloud scattering surface.

## First Slice

1. Add state-bucketed optical cache keys and tests for H2O solid/liquid/gas.
2. Add a reduced condensation droplet summary derived from saturation state.
3. Add CPU optical response for droplet scattering and pack it into existing PBR
   fields.
4. Add WebGPU table/query fields for the droplet/scattering summary.
5. Add browser diagnostics that report pure-vapor vs condensed-steam optical
   mode.

Status, 2026-06-12:

- Items 1-4 are implemented as a first reduced slice. H2O gas descriptors now
  carry a bucketed sealed-box vapor optical state derived from temperature,
  total pressure, H2O partial pressure, saturation pressure, condensed mass
  fraction, droplet radius, vapor/condensed density, droplet number density,
  and scattering coefficient. The optical CPU cache key handles nested/string
  state fields, and the optical GPU lookup output ABI now exposes optical
  depth, scattering coefficient, absorption coefficient, and optical-state id.
- Browser diagnostics now indirectly cover the wider lookup row and derived
  material-property path through the SPH Playwright smoke. A more explicit UI
  readout for pure-vapor versus condensed-steam optical mode is still pending.
- Remaining runtime work is to move the microphysics state into resident
  per-cell/per-particle GPU data and gate vapor surface visibility from derived
  optical depth/scattering rather than from the `steam` render label.

Status, 2026-06-12 08:12 AKDT:

- Vapor surface visibility is now gated by derived optical response. Gas-phase
  H2O surfaces remain geometrically hidden when optical depth and droplet
  scattering are below the visibility threshold; condensed droplet steam remains
  visible from the Clausius-Clapeyron droplet-scattering closure.
- The same visibility gate runs for CPU particle batches and resident
  render-field surfaces, while the existing grace-frame hysteresis still
  prevents abrupt flicker when vapor crosses the threshold.
- Remaining runtime work is to move the microphysics state into resident
  per-cell/per-particle GPU data and add an explicit UI readout for pure-vapor
  versus condensed-steam optical mode.

## Non-Goals

- Do not fake steam as a hard-coded white transparent material.
- Do not make all gas-phase H2O cloudy by default.
- Do not reuse one material-level optical closure when phase and microstructure
  differ.

Status, 2026-07-06:

- The explicit pure-vapor vs condensed-steam UI readout is implemented: the
  mounted status panel now shows `steam optics : <key>=<mode>(tau=.. sigma=../m
  shown|hidden)` where mode is condensed-steam / optically-thick-vapor /
  pure-vapor-thin, derived by resolveOpticalSurfaceVisibility. It reads Three
  mesh userData on the MarchingCubes lanes and the retained
  drawState.surfaces metadata on the native WebGPU consumer lane, and reports
  `no-gas-surfaces` when no gas-phase surface exists.
- Live checks: 430K water base and the Fe(1900K)->ice quench both report
  no-gas-surfaces at short horizons (steam appears later in the quench chain);
  the readout mechanics are covered by mount tests. A longer-horizon browser
  check that catches condensed-steam mode live is still worth one run.
- Remaining runtime work is unchanged: move microphysics state into resident
  per-cell/per-particle GPU data so the vapor gate reads GPU-resident state
  under no-full-readback instead of CPU descriptors.
