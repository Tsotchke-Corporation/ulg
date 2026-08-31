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
- Retained-GPU evidence can report hundreds of kilograms of liquid H2O while
  the melt remains effectively stationary, followed by an abrupt gas/volume
  instability instead of progressive melt flow.

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

### One shared MPM node velocity locks melted water to ice and iron

The current P2G path deposits every material and mechanical phase into one
`(mass, momentum)` accumulator per grid node. Grid update produces one velocity
from that combined momentum, and every particle samples the same velocity in
G2P. Fully liquid H2O therefore cannot slip past solid ice or iron when their
quadratic supports overlap. This is algorithmic mixed-cell locking, independent
of the liquid viscosity coefficient.

The iron/ice native Vulkan probe demonstrates the failure. At `2.56 s`, the
retained state contains about `232.08 kg` liquid H2O and at least twelve
fully-liquid H2O carriers, but liquid-contributing H2O reaches only about
`0.00749 m/s`. Setting both artificial-viscosity alpha and liquid velocity
diffusion to zero still leaves H2O at about `0.00670 m/s`. A manufactured pair
with co-located equal-mass solid/liquid carriers at opposite tangential
velocities collapses both velocities to zero after one shared-field
P2G/update/G2P cycle; separate fields preserve both velocities. The clean
Slice 5 commit and the in-progress Slice 6 worktree produce identical quench
evidence through the later `3.584 s` instability, ruling out a Slice 6
regression.

This is the live phase-change manifestation of the separate solid/fluid state
families and mixed-cell interface operator already required by
`plan/todo/sol-critic.md`. The compact SS mechanics topology should supply the
sparse node set; a derived `(node, material/body/mechanical-field)` view should
supply distinct velocities and explicit equal-and-opposite interface exchange.

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
- Do not blend rigid/solid mass into a liquid node velocity or fix the result
  with a material-specific force. Derive sparse mechanics fields from the
  SS-owned compact node topology and resolve their interface explicitly.

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

### 2. Materialize SS-owned sparse mechanics fields

- Extend the compact mechanics topology with deterministic field entries keyed
  by grid node plus material/body/mechanical phase identity; compact rows must
  remain structurally distinct from particle rows.
- Deposit and gather liquid, deformable, gas, and coherent-solid state through
  their admitted field families instead of one universally averaged velocity.
- At mixed cells, consume SS exact-near interface candidates and apply explicit
  non-penetration, slip/friction, pressure, viscosity, adhesion, thermal, and
  reaction exchange with equal-and-opposite momentum/body-wrench accounting.
- When melting is admitted, detach the conserved melted mass, momentum, and
  energy from the solid lane and materialize it in the fluid lane. A dominant
  phase-id flip alone is not topology or kinematic authority.

### 3. Produce phase-resolved transport closures

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

### 4. Replace demo pair rates with conservative transport

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

### 5. Make phase geometry and optics continuous

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

### 6. Validate the iron-on-ice scenario

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
- **Mechanics fields:** a co-located two-field tangential-slip fixture preserves
  the two unconstrained tangential velocities, while a same-field control
  performs the expected mass-weighted average. Mixed-cell contact conserves
  linear/angular momentum and does not blend rigid mass into liquid velocity.
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

## Integrated SS Phase-Flow Closure Checkpoint - 2026-07-16

The first material-general mechanics/phase-flow closure is implemented on top
of the Slice 6 compact SS node topology. A GPU-derived sparse field view is
keyed exactly by `(denseNodeId, mechanicalFamilyId, materialId,
continuityDomainId)`. Candidate generation, sort, unique, P2G, grid update,
contact, and G2P stay GPU resident and require no field-count readback. Unlike
fields retain tangential slip; their closing normal motion is resolved by an
equal-and-opposite impulse. This removes the universal mixed-cell velocity
average that previously locked liquid H2O to overlapping ice and iron.

Two fail-closed integration defects were found and fixed during the native
audit. The exclusive-prefix mapping initially used the current prefix instead
of the following prefix/final unique count, so duplicate candidates could
invalidate the entire field view. In addition, zero-mass phase-reserve rows do
not own a field descriptor and must pass through G2P rather than invalidate
all live carriers. Native tests now cover duplicate stencils, inactive reserve
rows, corrupt evidence, and material/phase field separation.

Continuous phase transfer uses schema
`peercompute.ulg.sph-phase-carrier-plan.v2`. Every original lineage owns four
stable, phase-pure lanes in solid/liquid/gas/plasma order. A source may split
between adjacent thermodynamic phases, and all source contributions are
conservatively reassembled into the target lanes. The transfer preserves mass,
linear momentum, position first moment, internal energy, and total energy;
relative kinetic energy lost while merging same-phase contributions is
thermalized. Compatible constitutive state follows the largest contributor,
while incompatible phase/model transitions reset `F`, `C`, and `J` to the
target reference state. Invalidity is contained to one lineage unless the
global layout itself is invalid. The browser host, resident worker, portable
snapshot/rematerialization route, compact cohort summary, and reaction-product
placement all understand this four-lane topology.

Render-field phase partitioning now scales isovolume monotonically with phase
fraction rather than inflating radius by inverse weight. A small new phase can
therefore no longer create a coincident near-full-volume shell that hides the
remaining phase.

Native manufactured verification passes `19/19`, including simultaneous
solid/liquid/gas ownership, total-energy conservation, constitutive-state
selection, lineage-local failure containment, duplicate-field stencils, and
inactive carrier rows. Portable host/worker verification passes `30/30`. The
repository suite passes `1,404/1,410` with zero failures and six intentional
opt-in skips, and the production build passes with only the existing chunk-size
warning.

The desktop iron/ice visual run at
`/tmp/ulg-visual-sanity-matrix/phase-four-lane-iron-ice-20260716` passes all 11
retained-GPU checkpoints through `2.56 s`, with 13 captured frames and no
browser, WebGPU, blank-frame, geometry, or surface-lifecycle issue. Final H2O
is approximately `294.69 kg` solid, `567.11 kg` liquid, and `55.20 kg` gas;
liquid reaches `1.83 m/s`. Every checkpoint is phase-pure and reports zero
invalid mechanics rows or phase-fraction problems. Iron changes from
`1507.68 kg` liquid to `1246.58 kg` solid plus `261.10 kg` liquid. Total mass
relative span is about `1.91e-6`, and observed condensed-state `J` remains
within approximately `0.97655..1.02686`.

The matching mobile run at
`/tmp/ulg-visual-sanity-matrix/phase-four-lane-iron-ice-mobile-20260716`
uses a `390 x 844` viewport at device scale factor `3`. It also passes all 11
checkpoints through `2.56 s`, captures 13 frames, and reports no browser,
WebGPU, geometry, or surface issue. Direct inspection of initial, impact,
spreading, and final frames confirms the same opaque refractive melt surface
and retained phase geometry in the portrait layout.

The 1,024-live-particle smoke benchmark at
`/tmp/ulg-phase-four-lane-performance.json` passes at about `101.80` complete
engine steps/s, `101.68` wall steps/s, `217.39` resident-stage steps/s, and
zero estimated readback bytes per step. Complete-engine throughput matches the
Slice 6 baseline, while resident-stage throughput is lower because four fixed
lanes currently dispatch and allocate at four times the original lineage
capacity. Sparse phase-lane allocation/compaction remains a measured
optimization opportunity; it is not hidden as completed work.

This checkpoint closes the observed detach-and-flow blocker, but not the whole
thermophysical plan. Geometry/contact/thermal-boundary unification, derived
phase-resolved viscosity and conductivity, interfacial conductance, and the
broader resolution/convergence gates remain open. Artificial viscosity and
the demo-tuned conduction law remain active. Tiny gas fractions can still hit
the coarse thermal clamp near `1e6 K` transiently before the quench returns to
a stable range, so gas microphysics and thermal-limit closure remain explicit
debt. Water-cycle, sodium/water, and cesium/fluorine gates must still be rerun
after those transport changes; this checkpoint is not a claim of complete
transport closure.

## Dependencies And Related Plans

- `plan/done/SS/shared-spatial-authority-refactor-plan.md`
- `plan/todo/algorithm-derived-material-properties-plan.md`
- `plan/todo/phase-resolved-steam-optics-plan.md`
- `plan/todo/dynamic-initial-material-bodies-plan.md`
- `plan/todo/sol-critic.md`
