# A5 SOL-3: solid–fluid coupling (rigid bodies ↔ SPH/MPM particles)

Date: 2026-11-14. Track A5. This is the coupling the G2 Iron Ice plume waits
on: the user chose to keep G2 open until it lands.

## Thermal half: delivered (f32 route)

**`src/runtime/sph/schroederSolidFluidThermalGpu.js`.**
- **Pair law.** For a member (a cube with half pitch a) and an SPH particle
  (radius r) whose centres are within a + r + slop:
  - Q = k_h A ΔT dt / L;
  - k_h is the harmonic mean of the two conductivities;
  - A = min((2a)², π r²);
  - L = max(d, (a + r)/4).
- **Limiter.** Each pair moves at most 1/8 of the energy that would equalize
  the two temperatures. A member on its melt plateau has unbounded capacity.
- **Exact pair energy.** Q is quantized to integer quanta (1e-9 J). The
  member adds q and the particle subtracts the same q through an i32 atomic,
  so the exchange is exactly antisymmetric in quanta. The f32 u updates are
  the only rounding.
- **Per-step ledger.** Net quanta into the solid, the contact-pair count and
  an overflow flag.
- **Search.** Brute force over particles (members × particles); binning
  belongs to A1.

**Wiring.**
- `sphPhaseDemo.js` declares `state.rigidBodies.fluidThermal`: conductivity
  and heat capacity per scene material and GPU phase, from the material bank.
  For example: ice 2.16 W/m·K and 2,090 J/kg·K; water 0.598 and 4,186; Fe
  solid 80.4 and 449; Fe liquid 40 and 820.
- `schroederSolidRigidLane.js` creates the stage with the thermal stage and
  encodes it after member conduction, whenever release is enabled (the f32
  route's fluid buffers). The step passes the particle count.

**Gate.** `tests/schroederSolidFluidThermal.native.test.mjs`
(`ULG_RUN_NATIVE_SOLID_RIGID=1`): a 32-member ice body over 16 hot fluid
particles (1,800 K), 4,000 steps at 2 ms.
- **C1 conservation:** member plus particle Σ m u is conserved; the residual
  is at most 0.04 J of about 4 kJ exchanged, against an f32 budget of 3.7 to
  30 J.
- **C2 ledger:** the quanta ledger matches the member gain and the particle
  loss.
- **C3:** heat flows hot → cold, and no member overshoots.
- **C4:** particles out of contact stay bit-identical.
- **C5:** contact members reach the plateau exactly at 273.15 K.

**Regressions.**
- The G3 native gates (rigid, contact, thermal, release) still pass.
- Host suites for the demo and solids pass (158 of 158).

**Limits.**
- f32 route only, like release. An exact-ledger route needs the integer
  energy rows.
- The fluid temperature is read from the thermo row, one step behind.

## Mechanical half: delivered (contact; f32 route)

**`src/runtime/sph/schroederSolidFluidContactGpu.js`.**
- **Search.** One thread per particle, Gauss-Seidel over its own member
  contacts.
- **Contact.** A member is a sphere of radius a (half its pitch); a contact
  is |x_p − x_m| < a + r_p.
- **Impulse.** When the normal relative velocity is below the Baumgarte
  target, min(β · penetration / dt, 0.5 m/s), the particle receives
  J = m_eff (target − v_n) n, with m_eff = 1/(1/m_p + 1/M_body). The contact
  is inelastic and frictionless: a fluid slips.
- **Reaction.** The body receives −J at the member surface, linear and
  angular. Both are scattered as f32 values into exact integer counters
  (order-independent sums), and a per-body pass adds them to the frame's
  world P and L.
- **Positions** are never moved directly.

**Wiring.** The lane creates the stage with the rigid stage and encodes it
after the thermal coupling, whenever the fluid buffers are present.

**Gate.** `tests/schroederSolidFluidContact.native.test.mjs`: 8 off-centre
particles approach a 32-member ice body at 1 m/s.
- **M1 momentum:** Σ m v + P_body is conserved within the f32 budget
  (2.6e-9 of 0.056 kg·m/s; budget 2.8e-9). The body is pushed up.
- **M2 approach:** every contact leaves at or above the target, relative to
  the body's post-reaction velocity.
- **M3 angular:** the measured ΔL_body is −5.877845e-4, against −5.877845e-4
  predicted from the particles' own impulses.
- **M4:** separating and far particles keep their exact velocities.

The G3 native gates still pass with both coupling stages in the lane.

## Live check, 2026-11-14

**Scene.** A 16.8 mm molten iron cube at 1,850 K above a 40×20×40 mm rigid
ice block at 233 K (`mechanicsMode: 'rigid'`). The bodies URL is built in
`ulg-a5-solid-fluid-coupling` memory. Evidence:
`~/.cache/icc/repos/ulg/a5-coupling-20261114/`.

**Iron Ice preset box** (`scenario=iron-ice-quench&bodies=…&sdt=0.001`):
- the heat coupling, contact and release stages are all enabled;
- the ice rests on the floor (COM y = 10.0 mm for a 20 mm block);
- the iron melts it from above: 20 of 256 members released by 2.0 s, and the
  COM falls to 9.4 mm as the top layer goes.

**Two presentation gaps, outside the coupling code:**
1. **The rigid shape was not drawn on copy-back routes.** The frame carried
   no family. *Fixed:* the presenter falls back to the device's
   most-recently stepped family (`latestSchroederSolidRigidFamily`).
2. **Without room air the presenter never presents new states** ("compact
   motion proof is unavailable"): the screen keeps the first frame while
   physics steps. With `environmentMode=air` it presents (50 states/s), and
   the ice block, iron and room-air parcels render.

**Iron at 1,850 K in room air.** The schedule fails closed: "Phase-specific
caloric reaction energy is not yet admitted" (iron oxidation). The coupling
check therefore runs with `lawr=0`, reactions off; that is a declared
limitation of this check.

**Water-cycle route scaled to the small box, with air**
(`sceneLengthScale=0.014`, 10-unit box, `environmentMode=air`, `lawr=0`):
- it renders the ice block, the iron and the air parcels;
- but through 3 s the ice never melts, the body stays exactly at rest, and
  the frames do not change (source states 0.2/s);
- in this route the iron never reaches the ice.

**Status.**
- The SOL-3 coupling is delivered on the GPU gates, and the Iron Ice route
  shows the live melt.
- **The visible Iron Ice plume (G2) is not yet shown.** It now waits on
  presentation, not on coupling:
  - the Iron Ice route presents no new states for a custom body set
    ("compact motion proof is unavailable");
  - the room-air route oxidizes iron, which needs the phase-specific
    reaction energy admission.

## Presentation fix, 2026-11-14 (the stall with a rigid body and no air)

**The real reason** (from the presenter's render-rows readout, which the
probe now prints as `presentationReadout`):
- The worker frame failed every time with "ready dispersed-medium
  opticalStateId 5701146 has no render surface route".
- The rigid body's reserved meltwater rows are H2O lineages, so the
  dispersed-medium seed declares their optical route ready, even at zero
  mass.
- The surface table, though, was built only from rows with mass, so iron
  alone was routed (fe/liquid, fe/solid, fe/gas).

**Fix:**
- The meltwater rows carry `solidReleaseSlot: true`. It is set in
  `sphPhaseDemo.js` and kept by `copyInitialParticleMetadataIntoState`
  (`createSphState` strips unknown fields).
- `sphPhaseViewState.js` passes the flag through.
- `createResidentMaterialSeedSurfaceBatches` lets such rows seed their
  liquid surface. Zero mass contributes nothing to the field until release.
- The failure message now lists the routed surfaces.

**Result:**
- The Iron Ice route with rigid ice presents: 52 states/s, status
  "presentation-rendered", with the rigid block and the molten iron drawn.
- Host tests pass (demo, render, scene, view state: 296 of 296).

## G2 plume census, 2026-11-14 (rigid ice, `sdt=0.001`, 6 s simulated)

Run: `scripts/step0-baseline-probe.mjs` with `S0_PROPOSAL_AUDIT=1` and
`S0_UNTIL_SIM_S=6`; evidence in
`~/.cache/icc/repos/ulg/g2-plume-census-20261114/census6.{json,log,png}`.
6,000 steps at about 5.5 steps/s.

| Kind | Rows | Mass | Max T |
|---|---|---|---|
| Fe solid | 123 | 9.5 g | 1,800 K (re-freezing) |
| Fe liquid | 216 | 23.6 g | 1,845 K, a pool on the floor, y ≤ 9 mm |
| H2O liquid (meltwater) | 45 | 5.2 g | 293.8 K |
| H2O gas | 0 | 0 | — |

**Interface.** The iron→water interface exists: 1.2 cm² over 40
positive-area pairs. It carries about 13 W on the newest step.

**No steam, and none is in prospect with the current model.**
1. **Coarse parcels.** Meltwater parcels are 0.115 g and heat as a whole.
   - Real quench steam comes from the contact layer. The iron–water contact
     temperature is about 1,650 K, from the effusivities √(kρc) of the two
     sides. That is far above T_sat, so the contact layer film-boils at once.
   - The model has no interface-boiling closure. A parcel must reach 373 K in
     bulk before any vapor forms, which takes about 5 s of sustained contact;
     the contacts here are brief.
2. **Walls.** They are fixed at 293.15 K, an infinite sink for the iron pool
   and for the water lying on it.
3. **Geometry.** The molten iron runs off the rigid ice onto the floor
   instead of staying in its crater.

**What the visible Iron Ice plume needs** (G2 stays open):
- **An interface-boiling closure.** Where the contact temperature of a
  liquid–hot-condensed pair exceeds the liquid's T_sat, the interface heat
  goes to vaporizing liquid mass at the interface. Only the sensible
  conduction from T_sat into the parcel's bulk warms the parcel. Mass and
  energy are exact on the ledger.
- **A1 throughput.** At about 5.5 steps/s and dt 1 ms, a minute of
  simulated time takes about 3 hours of wall time.

## CORRECTION (2026-11-14, latest): Iron Ice walls are adiabatic, so walls were not its cause

The Iron Ice preset's runtime declares `wallModel: 'adiabatic'`, and the
`bodies=` override keeps it.
- Checked live: the scene reports `exchangeEnabled=false`.
- So in every census the fluid exchanged no heat with the walls.
- The 293.8 K meltwater maximum was not wall pinning. The later 301.4 K
  reading came from run-to-run and timing differences.
- The Iron Ice no-steam cause is **resolution**, as first diagnosed: parcels
  heat as a whole, contacts with the iron are brief, and the iron loses heat
  mainly to the rigid ice.

The honest-wall change below is still a correct **general** fix: the fixed
6e4 W/K law was non-physical for every preset that uses
`infinite-fixed-temperature-reservoir` walls, such as water-cycle. But it is
not the Iron Ice blocker.

**4 s census with honest walls (adiabatic here, so walls unused):** Fe solid
128 rows at 1,811 K; Fe liquid 215 rows at 1,849 K; H2O liquid 33 rows at
301.4 K; no gas; 16.7 steps/s.

## (Superseded for Iron Ice) the walls are a near-perfect thermostat

**The wall law.**
- Fluid wall heat on both routes is `wall_rate × (T_wall − T) × weight × dt / mass`:
  - `ulg-gpu-abi/src/wgsl.js:1465`;
  - `runSphThermalStepCpu` and the GPU encoder stage in
    `src/runtime/sph/sphThermalGpuKernel.js`.
- It applies to every parcel within one smoothing length of a wall.
- `wallRate` defaults to `6e4` W/K per parcel, and the live route passes none.

**How that compares with conduction.** Conduction-limited exchange over the
same distance, k·A/d, is about 6e-3 W/K for a 5 mm water parcel and about
0.4 W/K for iron. So the constant is 10⁵–10⁷ times too strong.

**Consequences:**
- Anything on the floor is clamped to 293.15 K within a step.
- The census meltwater maximum of 293.8 K is the wall temperature: the
  meltwater lies on the floor.
- The molten iron pool on the floor re-freezes for the same reason.

The rigid solid lane already uses a conduction-limited wall law, Q = kA·ΔT/(d/2)
(`schroederSolidThermalGpu.js`).

**The general fix** (not scenario-specific; awaiting the user): derive the
fluid wall exchange from each parcel's own conductivity and its wall
distance, as the solid lane does.
- It changes every preset with thermal walls.
- Water-cycle's accepted vapor-onset evidence may depend on the current
  instant walls.

**Resolution is the second, general factor.** Parcels heat as a whole, while
real quench boiling happens in a sub-millimetre layer. Adaptive refinement
near steep thermal gradients, through the SS levels, is the general route.
- A test with 8× finer ice (16×8×16 members) was OOM-killed at about 5.5 GB
  of render-worker RSS within about 6 min, under a 6 GB cap. This ties into
  the open memory-growth issue at higher member counts.

## SOL-2 body-body contact: delivered (2026-11-15)

- **Where.** `src/runtime/sph/schroederSolidRigidGpu.js`: the `warm_start_pairs`
  and `contact_pairs` passes, inside the same projected-Jacobi iterations as
  the wall contacts. They run when there are at least 2 bodies.
- **Partner search.** Each proxy pairs with its nearest proxy on another
  body: a brute-force O(P²/2) search once per step at warm start, reused by
  the iterations. The lower proxy index owns the pair, so each pair is solved
  once.
- **State.** Per-proxy state grows from 8 to 16 words: wall state plus pair
  state (impulse, approach speed, partner + 1, tangential impulse). Pairs are
  warm-started like walls.
- **Contact law.** The same as the walls: Baumgarte, restitution above the
  threshold, Coulomb friction. The effective mass uses both bodies' masses
  and inertias, and the Jacobi share is the larger of the two bodies' counts.
- **Conservation.** Equal and opposite impulses are scattered exactly, so
  the two bodies' exact impulse ledgers sum to zero bit-exactly. Both bodies
  take the impulse at one shared application point, midway between the
  sphere surfaces. Applying it at the sphere centres had let friction inject
  angular momentum (1.8e-3).
- **Gates** (`tests/schroederSolidBodyContact.native.test.mjs`, 1 of 1, 3³-member cubes):
  - **C1, head-on at 1 m/s closing:** the ledgers sum to [0, 0, 0] exactly.
    The bodies rebound at ±0.16 m/s (restitution 0.3) and separate.
  - **C2, glancing:** ΔL 3.2e-6 relative, ΔP 0, and both bodies spin.
  - **C3, a cube stacked on a cube on the floor:** centre separation
    0.0593 m against the ideal 0.06 m, settled, KE 7e-18 J, deepest overlap
    5.5 µm.
- **No regressions.** The existing rigid-lane native gates still pass (wall
  contact, SOL-0 invariants, solid-fluid contact, melt release, shape
  carrier).
- **Limits.**
  - One partner per proxy.
  - The O(P²) search: fine at Iron Ice's 256 members. A spatial broad phase
    is needed for thousands of proxies.
  - Tumbling and driven rotation against another body are not yet gated.
