# Surface/Contact Scale And Thermophysical Phase-Closure Plan

Date: 2026-07-15 AKDT

ICC task: `surface-contact-transport-phase-closure-20260715`

## Goal

Make the visible material boundary, mechanical contact boundary, thermal
contact boundary, transport coefficients, latent-heat response, and
phase-dependent optical surface describe the same physical state. The target
scenario is hot iron falling onto ice, but the resulting contracts must be
material-general and resolution-convergent.

This work does not replace the SS shared-spatial-authority refactor. Contact,
thermal pairs, surface reconstruction, and diagnostics must consume SS-owned
spatial views rather than adding another private neighbor search.

## Reported Failures

- A settled hot iron block appears to float above the ice block.
- The live control labelled `isosurface blob size` looks approximately aligned
  with contact at `1.9`, while its default is `1`.
- Liquid water flows too slowly and reads as much too viscous.
- After iron and ice appear to contact, heating, melting, and visible steam
  arrive too late.
- The water/ice surface does not visibly evolve as its phase fractions change.

## Source Diagnosis

### Surface and contact do not share one geometry authority

The `1.9` control is a particle/metaball radius multiplier, not a marching-
cubes isovalue. Live condensed-surface isolation values are currently `80`
for H2O, `82` for Fe, and `24` for gas/vapor. The nominal algorithm surface
row carries isovalue `0.5`, but it is explicitly non-renderer-authoritative;
the native adapter intentionally retains the renderer field's isolation.

Initial-body samples use a visual radius of half the minimum cell pitch, while
mechanics/contact also operate through smoothing and shared-grid support. For
the standard `0.2 m` pitch and 64-neighbor target, the current grid/smoothing
length is approximately `0.24814 m`; quadratic P2G support reaches about
`1.5h = 0.37221 m`. Relative to two half-pitch visible radii, that is a scale
of about `1.861`, remarkably close to the observed `1.9`. Treat `1.9` as
evidence of a mismatched numerical support boundary, not as a new default or
a physically derived isovalue.

### Water viscosity is dominated by numerical damping

The current H2O closure does not provide phase-resolved dynamic viscosity.
The mechanics table adds

`mu_artificial = density * soundSpeed * length * alpha`

to the Newtonian liquid stress. At current defaults this is approximately
`1000 * 198.5 * 0.24814 * 0.04 = 1970 Pa*s`, roughly two million times the
order of ordinary room-temperature water viscosity. A separate liquid
velocity-diffusion relaxation of `0.1` begins after about `0.16 s` as well.
These numerical stabilizers currently masquerade as material transport.

### Thermal exchange is demo-tuned rather than conductivity-derived

The GPU pair-conduction coefficient is a hard-coded `1500`; the CPU reference
still defaults to `15`. Pair energy is computed from that rate, temperature
gap, distance weight, and timestep without bulk thermal conductivity,
interfacial area, separation distance, or an interface conductance. Thermal
pair support is `max(2h, r_i + r_j)`, so it is not the same boundary as either
excluded-volume contact or the visible isosurface.

The material bank already contains some useful references, including Fe
thermal conductivity and a liquid-viscosity value, but those fields are not
anchored into the active closure. H2O lacks a complete viscosity/conductivity
state table. The right repair is a derived transport artifact with explicit
validity and uncertainty, not another pair-rate multiplier.

### Macro-particle and phase-surface policy hide early local change

A default water macro-particle represents kilograms of material, so heating,
melting, and vaporizing one complete carrier requires tens of megajoules. The
thermodynamic inverse retains continuous phase fractions, but its dominant
phase id flips at 50 percent latent completion.

The resident renderer creates fractional solid/liquid/gas fields, but its
sampling floor grows as inverse square root of phase weight before strength is
multiplied by that weight. When the floor dominates, those operations nearly
cancel: a very small new-phase fraction can reconstruct an almost full-size
coincident shell. Opaque-alpha/depth-writing ice and water shells then occlude
one another instead of presenting a continuous mixture. The CPU/Three path
has the opposite problem: it batches only the dominant phase and hard-switches
at 50 percent. Gas radius policy also changes at the dominant-phase boundary.

The optical closure itself distinguishes ice, liquid water, pure vapor, and
condensed-droplet steam. The first repair target is therefore phase-fraction
geometry/optical composition and backend parity, not a hand-authored water
color. Pure vapor should remain nearly invisible; a visible white cloud must
come from locally predicted condensate/droplet scattering.

## Non-Negotiable Rules

- Do not make `1.9`, `80`, `82`, `24`, `1500`, or any replacement tuning
  constant the new physics authority.
- Keep continuum cell volume/mass, equivalent particle radius, contact proxy,
  smoothing support, thermal contact area, and render isoradius distinct but
  explicitly related through a versioned geometry contract.
- Separate physical shear/bulk viscosity from shock/compressive artificial
  viscosity and from optional numerical diffusion. Numerical viscosity must
  be reported independently and vanish or converge predictably under
  refinement.
- Derive transport as functions of material, phase, temperature, pressure,
  composition, and state validity. Preserve units, uncertainty, generator
  fingerprint, and source provenance in cached rows.
- Do not force instant steam for presentation. Make the first physically
  predicted local vapor/condensate fraction visible without dominant-phase
  latency, and verify its onset time from the energy and mass ledger.
- Do not add a private contact, thermal, or render neighbor grid. Reuse the
  SS generation and request law-specific exact-near/support views.

## Ordered Work

### 1. Measure and unify geometry boundaries

- Add compact diagnostics for each material pair: minimum center distance,
  equivalent-radius signed gap, mechanics contact support/gap, thermal pair
  weight/contact area, and extracted mesh-to-mesh gap.
- Measure isolated-particle isoradius and planar-body surface bounds on CPU,
  resident WebGPU, and native marching-cubes paths across field resolutions.
- Define one versioned geometry mapping from particle volume and anisotropic
  cell pitch to mechanics contact proxies, thermal interface area, and render
  support/isovalue policy.
- Bind algorithm-derived surface rows into the live scalar convention, or
  replace the split conventions with one normalized density field contract.
- Calibrate against requested body AABBs and zero signed physical gap. Do not
  calibrate against the current shared-grid stopping distance.

### 2. Produce phase-resolved transport closures

- Add `dynamicViscosityPaS(T,P,phase,composition)` and
  `thermalConductivityWPerMK(T,P,phase,composition)` artifacts for active
  materials, beginning with H2O and Fe.
- Use converged Green-Kubo MD or DFT-MD where feasible, with finite-size,
  sampling-time, timestep, and statistical-uncertainty studies. Reference
  measurements may be validation or labeled fallback data, not disguised
  first-principles output.
- Derive Fe-water and Fe-ice interfacial thermal conductance with a compatible
  non-equilibrium MD/reference workflow and explicit interface-state domain.
- Pack validated transport rows into the material bank and GPU mechanics/
  thermal tables with cache invalidation by solver and ABI fingerprint.

### 3. Replace demo pair rates with conservative transport

- Use harmonic-mean bulk conductivity and a resolution-consistent SPH/MLS-MPM
  discretization for interior conduction.
- Use `heat = interfaceConductance * area * temperatureGap * dt` for unlike-
  material contact, with area and gap supplied by the unified geometry/SS
  contact view.
- Make CPU, resident WebGPU, and worker paths consume the same coefficients and
  clamps. Any stability limiter must report the unclamped and applied flux.
- Preserve energy across sensible heat, fusion/vaporization latent heat,
  radiation, walls, reactions, and phase-volume work.
- Support sub-carrier interfacial phase fraction or an equivalent conservative
  refinement mechanism so a kilogram-scale macro-particle does not delay all
  local flash boiling until its dominant phase changes.

### 4. Make phase geometry and optics continuous

- Sweep solid/liquid/gas fractions without inverse-weight radius inflation
  producing coincident full-volume shells.
- Use a conservative mixture/partition policy whose solid volume decreases as
  liquid volume increases and whose union volume stays continuous.
- Remove the 50-percent gas-radius discontinuity and make CPU/Three and native
  resident paths follow the same phase-fraction contract.
- Blend or partition ice/water optical response from phase fraction,
  temperature, microstructure, and path length. Preserve exact phase optical
  ids for diagnostics.
- Drive vapor/steam visibility from local vapor and condensed-droplet state;
  connect nucleation/condensation mass transfer to latent energy rather than
  using optics-only equilibrium as a substitute for microphysics.

### 5. Validate the iron-on-ice scenario

- Correlate first visible contact, first mechanical contact, first nonzero
  thermal flux, first melt fraction, first vapor fraction, and first visible
  condensate on one simulation timeline.
- Record multi-frame native and fallback captures plus compact resident
  diagnostics at identical simulation times.
- Repeat at multiple particle pitches/timesteps; onset times, flow profile,
  surface bounds, and total energy must converge instead of following a UI
  radius or demo rate.

## Acceptance Gates

- **Geometry:** isolated mesh isoradius agrees with the geometry contract to
  within half a render voxel. In a planar Fe/ice drop, visible, mechanical,
  and thermal first contact agree within one mechanics substep and one render
  voxel.
- **Viscosity:** Couette and Poiseuille manufactured cases recover the active
  closure viscosity over multiple resolutions. Report physical and numerical
  dissipation separately.
- **Conductivity:** a two-slab diffusion case recovers the analytic/harmonic-
  mean heat flux, CPU and GPU agree, and error decreases under refinement.
- **Phase energy:** a Stefan melting-front test and a hot-Fe/ice quench conserve
  the full energy ledger and produce first melt/vapor at the derived time.
- **Phase surface:** sweep fractions `0, .01, .1, .25, .49, .51, .75, .9, 1`.
  Old/new phase volumes vary monotonically, union AABB/volume has no 50-percent
  jump, and a one-percent phase does not create a near-full coincident shell.
- **Backend parity:** frozen identical thermal buffers produce matching surface
  counts, bounds, optical ids, and fixed-camera appearance on native WebGPU,
  resident Three, and CPU/Three paths within documented tolerances.
- **Steam:** pure vapor remains optically thin. Visible cloud appears only when
  the local condensate/droplet optical-depth gate is satisfied, with mass and
  latent-energy conservation.
- **Scenario:** water-cycle and iron/ice multi-frame visual gates pass without
  changing a UI blob scale to hide a contact mismatch.

## Dependencies And Related Plans

- `plan/todo/SS/shared-spatial-authority-refactor-plan.md`
- `plan/todo/algorithm-derived-material-properties-plan.md`
- `plan/todo/phase-resolved-steam-optics-plan.md`
- `plan/todo/dynamic-initial-material-bodies-plan.md`
- `plan/todo/sol-critic.md`
