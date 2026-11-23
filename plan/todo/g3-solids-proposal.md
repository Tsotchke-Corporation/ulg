# G3 coherent solids: SOL-0 and SOL-1

> **2026-11-22 Live-Code Status (`2fe9e47b`, Consolidated into Gate 3):** **OPEN**
> (`0` formal oracle receipts). P2 closed 3 pre-SOL-1 gates (material-derived
> restitution/friction, exposed-face solid radiation, frame-indifferent
> co-rotational velocity smear). **Remaining under Gate 3:** migrate rigid
> solids off **3 private 4,096-bucket hashes onto canonical SS cells**
> (`schroederSolidRigidGpu.js`, `schroederSolidFluidContactGpu.js`,
> `schroederSolidFluidThermalGpu.js`), `bodyId`-aware product placement, and
> multi-level rigid coupling. See [`plan/CURRENT-PLAN.md`](../CURRENT-PLAN.md).

Date: 2026-11-14. Task: ICC `ulg-g3-solids`. Oracle: `ulg-g3-solids`.

The specification is [sol-critic.md](sol-critic.md): the frame, member, contact
proxy and shape carrier records, coherent rigid mode first, and the GPU
invariant gates. This document covers the G3 slice, SOL-0 and SOL-1, and the
"compatible phase ownership" the campaign table requires. It also covers the
oracle's three criteria:

1. candidate review;
2. SOL-0/SOL-1 GPU invariants;
3. a desktop solid–fluid visual sequence (rest, fall, contact, phase
   transition) with no renderer-authored physics.

G3 also unblocks the last G2 criterion. The Iron Ice ice block collapses as an
MLS-MPM continuum at dt 1 ms, and at 0.5 ms the spreading melt pushes it away.
An ice body that stays coherent until it melts is the route to the plume.

## Design

- **Records.** `src/runtime/sph/schroederSolidRigidGpu.js` holds the frame
  (32 words) and member (8 words) layouts; the module header documents both.
  - The body frame is the principal frame. The cold seed (f64, like every
    scene seed) computes:
    - the centre of mass;
    - the principal axes, by Jacobi eigen-decomposition;
    - the principal moments;
    - member rest coordinates in that frame.
  - Mass and inertia belong to the members only.
- **Integrator.** One thread per body:
  - a half kick of force and torque;
  - translation;
  - the free rotation by the Dullweber–Leimkuhler–McLachlan symmetric
    splitting about the principal axes (1, 2, 3, 2, 1);
  - the second half kick.

  World angular momentum is the integrated variable, so a torque-free body
  conserves it exactly. The splitting is symplectic, so the energy error is
  bounded with no drift.
- **Members** are regenerated from the frame every step, never advected on
  their own.
- **Reductions.**
  - What is reduced: mass, first moment, linear momentum, angular momentum
    about the frame centre, and world inertia.
  - How: each member's f32 contribution goes into exact integer counters
    (`createSphExactLedgerScatterWgsl`). Products are rounded once; sums are
    exact.
  - So the results do not depend on member order, workgroup size or dispatch
    partition. These reductions are the GPU acceptance surface; there is no
    CPU mirror.

## Phases and gates

Every gate declares a tolerance and its derivation.

| Phase | Work | Gate |
|---|---|---|
| 0 | Rigid lane module: records, seed, integrator, regeneration, exact reductions | `tests/schroederSolidRigid.native.test.mjs` (`ULG_RUN_NATIVE_SOLID_RIGID=1`): A translation across 100 cells; B torque-free tumbling; C driven rotation; D permutation × workgroup-size bit-identity |
| 1 | Contact proxies (boundary members) and wall/floor contact, with the wrench reduced exactly per body | Body at rest on the floor: no drift or creep beyond a budget. Fall time against √(2h/g) before contact. Changing the proxy count changes neither mass nor inertia and injects no impulse. Contact impulses equal-and-opposite at the walls (reaction recorded) |
| 2 | Shape carrier: a rest mesh in the body frame, drawn on the native WebGPU canvas by a vertex shader that reads the resident frame buffer | Silhouette moves with the frame without lattice or metaball artifacts; no CPU readback of the pose |
| 3 | Live app: a scenario body admitted as rigid. Its members are excluded from fluid P2G/G2P, their rows are regenerated from the frame, and they keep thermal participation | Desktop rest/fall/contact sequence with body identity; the existing ledgers stay exact |
| 4 | Phase-transition ownership: a melting member leaves the body for the fluid lane with exact mass and energy; the body's mass, centre of mass and inertia update, and momentum is conserved | GPU gate: body plus liquid mass, energy and momentum budgets across melt. Desktop melt sequence. Then the Iron Ice plume run for G2 |

## Phase 0 results, 2026-11-14: gate passed

Native Vulkan, `tests/schroederSolidRigid.native.test.mjs`. The body is an
asymmetric 3D "L" of 14 members with unequal masses, 5 cm pitch; dt 1 ms.

- **A. Translation**, 10 m/s for 1 s (100 cells of 0.1 m):
  - COM error 1.4e-4 m, against a budget of 4.9e-4 m (f32 position rounding:
    0.5 ulp per step);
  - pair-distance error 7.6e-7 m, against 7.6e-6 m (8 ulp);
  - exact mass equals the exact sum of the f32 member masses;
  - momentum and world inertia within 1e-6.
- **B. Torque-free tumbling** near the intermediate axis, 10,000 steps:
  - world L is bit-constant;
  - the member-reduced L matches within 8e-7;
  - energy error 6.82e-5 in the first half and 6.76e-5 in the second, so no
    drift, against a budget of 1e-4 from O((hω)²) = 3.6e-5 × O(1);
  - the Dzhanibekov flip is observed (body-frame L₂ swings ±0.0536);
  - unit quaternion within 1e-6.
- **C. Driven rotation:** L = τt to 5.8e-9, against 1.9e-6.
- **D.** Three member orders × workgroup sizes 32/64/128 give bit-identical
  frames and exact reductions.

## Phase 1 results, 2026-11-14: gate passed

`tests/schroederSolidContact.native.test.mjs` (`ULG_RUN_NATIVE_SOLID_RIGID=1`)
runs the same L body against the six box walls, with gravity and dt 1 ms.

**Contact.**
- Proxies are member points with radius 0.025 m.
- Each step: kick, then a warm start, then 8 projected-Jacobi iterations,
  then drift.
- Each proxy update is scaled by 1/N, N being the body's active contacts.
- Normal: a speculative or Baumgarte target with 0.5 mm slop, plus Newton
  restitution above 0.05 m/s.
- Friction: a Coulomb cone on accumulated impulses.
- The benchmark contact law is e = 0.3, μ = 0.3
  (`SCHROEDER_SOLID_BENCHMARK_CONTACT_LAW`).
- Contact impulses are scattered exactly per body. The cumulative exact
  impulse ledger is the wall reaction.

**Results.**
- **G1 free fall:** 300 steps, within 1.1e-6 m of the discrete kick-drift
  solution (budget 1e-4 m). Zero impulse before contact.
- **G2 rest on the 8-member face, 3 s:**
  - final speed 1e-9 m/s (budget 2e-3);
  - spin 7e-9 rad/s (budget 2e-2);
  - sinking 7e-8 m;
  - creep 1.2e-7 m (budget 1e-4).
- **G3 tilted spinning drop from 1 m, 5 s:**
  - it bounces (1.14 m/s upward) and settles (final kinetic energy below
    1e-9 J);
  - deepest member 1.3e-6 m into contact (budget 2.5 mm);
  - momentum balance P(t) − P(0) + m·g·t against the exact impulse ledger
    closes to 2.3e-5 on 110 N·s (budget 1e-3 · m·g·t).
- **G4 proxy swap** from 14 to 8 proxies mid-rest: mass bit-identical,
  principal moments unchanged, maximum speed after the swap 8.4e-6 m/s,
  spin 1.5e-4 rad/s (budgets 2e-3 and 2e-2).

**Finding.** Without warm starting, the per-step restart of accumulated
impulses left residual slip: 0.50 mm of creep over 3 s, failing G2. Warm
starting (`warm_start_proxies`) carries the resting load across steps and
removes it.

**Test hygiene.** On 2026-11-14 the session was OOM-killed twice.
- **Cause:** a WGSL compile error (the reserved word `target`) made every
  dispatch raise an error, and the test collected all of them without a cap.
- **Now:**
  - native tests cap collected errors at 20;
  - the rigid tests compile-check first;
  - native GPU tests run under
    `systemd-run --user --scope -p MemoryMax=4G -p MemorySwapMax=0`.

## Phase 2 results, 2026-11-14: gate passed

**Shape carrier.** `src/runtime/sph/schroederSolidShapeCarrier.js` builds the
body's exposed-face voxel mesh in the principal body frame.
- Lattice axes in the body frame are Rᵀeₖ.
- Host check on the L: 92 triangles, volume exactly 14 × 0.05³ (closed, by
  the divergence theorem), area 0.115 m², 0 inverted normals.
- The render pipeline's vertex shader reads the centre of mass and the
  quaternion straight from the resident frame buffer, so there is no pose
  readback.

**Gate.** `tests/schroederSolidShape.native.test.mjs`: an orthographic
1 m × 1 m view at 256 × 256 px.
- **S1, translation at (0.2, 0.1) m/s for 1 s:**
  - the silhouette centroid tracks the frame to 0.62 px (budget 1 px);
  - coverage is 1275–1339 px around 1326, within the measured boundary-pixel
    bound of 198;
  - coverage returns to exactly 1326 at whole-pixel shifts, so only pixel
    sampling varies, not the shape.
- **S2, tumbling:** coverage 1174–1869 px as the mesh rotates with the
  frame; always inside the view; no GPU errors.

## Phase 3 results, 2026-11-14: rigid bodies live in the app

**Wiring.**
- **Body schema.** `sphInitialBodies` accepts
  `mechanicsMode: 'rigid' | 'continuum'` and, for rigid bodies only,
  `angularVelocityRadPerS`.
- **Seeding.** `sphPhaseDemo` seeds a rigid body from its particle lattice
  (members and a principal frame; `state.rigidBodies`). Its samples are not
  SPH particles.
- **Family.** `schroederSolidRigidLane.js` keys the resident family (frames,
  members, proxies, shapes) by the upload's identity buffer, which every
  continuation carries.
  - The family is created on first use from `sphParticleState.rigidBodies`.
    This matters because worker lanes that rematerialize adopted storage
    never call `uploadSphGpuParticleBuffers`.
- **Step.** The lane steps on both the resident and the mechanics-only step
  routes, after the continuum mechanics, on the same device and queue.
- **Render.** The worker presenter draws the shape carriers inside the opaque
  pass from the resident frame buffer. The pass order is unchanged (the
  pass-order contract test holds).

**Desktop sequence** (`scripts/g3-solid-sequence.mjs`, headed, dt 1 ms):
- The scene is a water pool plus a rigid ice block 0.6 × 0.3 × 0.15 m
  (three distinct principal moments), 64 members, dropped spinning from
  3.2 m in room air.
- **Fall:** t = 0.40 s at y 2.414 m, 3.92 m/s (free fall: 2.415 m,
  3.92 m/s); t = 0.704 s at 0.766 m, 6.90 m/s.
- **Impact** about 0.78 s, then a bounce to 0.49 m at 1.0 s and tumbling.
- **Rest:** at 2.0 s it lies flat on its largest face, with the centre of
  mass at exactly 0.075 m (half the thickness) and speed 7e-10 m/s.
- The mesh is coherent in every frame; no particles or metaball surfaces are
  drawn for the solid.
- **Evidence:** `~/.cache/icc/repos/ulg/g3-solids-20261114/seq/`
  (receipt.json, seven screenshots, sequence-strip.png).

**Known limits for G3, by design.** Fluid and air pass through the rigid
body: solid–fluid coupling is SOL-3, in campaign track A5. Contact is with
the box walls only; solid–solid contact is SOL-2, also A5.

**Verification:**
- host suite 5,843 pass, 0 fail. The one failure on the first run was the
  pass-order contract, after I briefly recorded the shape draw as its own
  pass;
- build OK;
- native rigid gates (Phase 0, 1, 2) pass.

## Phase 4a results, 2026-11-14: member conduction gate passed

**Module.** `src/runtime/sph/schroederSolidThermalGpu.js`.
- **State:** members carry u. T and liquid fraction follow from the
  material's caloric branches: solid, melt plateau, liquid.
- **Internal conduction:** between lattice neighbours from the seed-time
  table, using the harmonic-mean conductance. The pair flux is antisymmetric
  bit for bit.
- **Wall conduction:** across half a cell to the touching box walls, at the
  scene's wall temperatures, recorded in an exact wall-heat ledger.

**Gate.** `tests/schroederSolidThermal.native.test.mjs`. Benchmark water-like
branches (ice cv 2050, latent 333.55 kJ/kg, water cv 4186; k 2.2 and 0.6);
a 4 × 2 × 4 body of 1 cm members.
- **T1, no walls, 3,000 s at dt 1 s:**
  - energy drift exactly 0 (budget 1.4 J);
  - the 20 K spread shrinks monotonically to 0.0026 K, the f32 resolution.
  - The timescale is physical: ice diffusivity k/(ρc) ≈ 1.2e-6 m²/s gives
    L²/α ≈ 1,400 s for 4 cm. My first try ran only 20 s and failed on that
    expectation, not on the physics.
- **T2, floor at 1,500 K, 100 s at dt 0.05 s:**
  - members gained 24,139.511 J against an exact wall-heat ledger of
    24,139.549 J (budget 0.92 J);
  - all 16 bottom members melted completely;
  - the top layer sits on the plateau at exactly 273.15 K, and the plateau
    rule held in all 176 plateau observations.

**Timescale finding for the desktop phase-transition sequence.**
- Melting at the member scale is slow: time ∝ ρ·c·d²/k.
- With 75 mm members on the 400 K floor it takes minutes to tens of minutes
  of simulated time. The app runs about 6 simulated ms per wall second (the A1
  gap).
- **Plan:** 1 cm members on a hot floor (`wymin` as a URL wall temperature)
  show the first members melting within a few simulated seconds, which is
  about 30 minutes of wall time in a background desktop run.

**Phase 4b design (ownership transfer).**
- **Release:** a member whose liquid fraction reaches 1 leaves the body.
- **Body update:** the body's mass, centre of mass, momentum, angular
  momentum and inertia are recomputed from exact reductions over alive
  members, using the parallel-axis shift to the new centre. The principal
  frame is re-diagonalized per body on the GPU, and alive rest coordinates are
  re-expressed in it.
- **Shape:** the shape carrier becomes member-driven. The vertex shader
  emits each member's six faces, enabled when the member is alive and that
  neighbour is not, so topology follows releases with no mesh rebuild.
- **Fluid:** the released mass, u, position and rigid velocity activate a
  reserved dormant SPH row, the member's own, allocated at seed.

## Phase 4b results, 2026-11-14: release gate passed

**Modules.**
- **Release:** `schroederSolidThermalGpu.js` zeroes a fully melted member's
  mass and appends a release event (member, mass, u, T, world position,
  rigid velocity).
- **Activation:** `src/runtime/sph/schroederSolidReleaseGpu.js` activates the
  member's reserved fluid row:
  - state: position, mass, velocity, u;
  - mechanics: F = I, C = 0, J = 1, rest volume m/ρ_l;
  - thermo: pure liquid at the member's temperature.
- **Rigid lane:** each step starts with fresh exact reductions over alive
  members and then rebases a body whose mass changed (a relative threshold of
  1e-5 separates releases from rounding). The rebase:
  - recomputes the centre of mass, P, and L about the new centre;
  - shifts inertia to the new centre with the parallel-axis theorem;
  - re-diagonalizes it with a cyclic Jacobi sweep in WGSL;
  - re-expresses member, proxy and lattice rest coordinates in the new
    principal frame.

  Proxies of released members are skipped.

**Gate.** `tests/schroederSolidRelease.native.test.mjs`: a spinning,
translating 4 × 2 × 4 body of 1 cm members whose 16 bottom members start
liquid.
- **R1 mass:** body 0.014672 + released 0.014672 = initial 0.029344 kg.
- **R2, R3:** linear momentum, and angular momentum about the origin, across
  body and released rows are conserved to about 1e-9.
- **R4 energy:** 1.5e-4 J off on 5,259.66 J, within the f32 update budget
  of 1.4e-3 J.
- **R5 rebase:** the survivors' inertia is diagonal in the rebased frame
  (off-diagonals about 1e-11 against moments of 1.8e-6), and the centre of
  mass matches.
- **R6:** each activated row holds the member's mass and a liquid-branch u.

## Phase 4c wiring, 2026-11-14 (live melt run in progress)

**Seeding** (`sphPhaseDemo`, rigid branch). A rigid body declares
`thermal`:
- **Caloric curve:** from the material's own u(T) in `thermoState`, linear per
  phase. For h₂o the solid edge is 570,883.5 J/kg and the liquid edge
  904,433.5 J/kg (latent heat 333,550 J/kg).
- **Conductivity:** read where the SPH thermal kernel reads it
  (`phases[].thermalConductivityWPerMK`). The live closure gives ice 2.16 and
  water 0.598 W/m/K; the fixture gives 0, meaning no member conduction.
- **Other fields:** liquid density, the optical material id, and the scene's
  six wall temperatures.
- **Reserved rows:** one dormant liquid row per member (mass 0, same lattice,
  role `solid-release:<body>`), recorded as `releaseRowStart`.

**Lane** (`schroederSolidRigidLane.js`). Rigid stage, then member
conduction, then release activation into the step's post-mechanics state and
mechanics buffers plus the step's thermo.
- Release is enabled only when those buffers exist and the route is not
  exact-mass. Activating a row in f32 would bypass the integer inventory, so
  on the ledger routes members stay in the body and do not release. Exact
  release is follow-on work, needed for the Iron Ice plume on the ledger
  route.
- **Render:** the presenter now draws the member-driven shape. A face is
  drawn when its member is alive and its neighbour is not, so melted members
  vanish and inner faces appear with no mesh rebuild.
- **Gates:** all five rigid native gates pass after the wiring (rigid,
  contact, shape, thermal, release).

**Live melt scene.**
- A rigid ice block 6 × 3 × 6 cm (108 one-centimetre members, 263 K) dropped
  onto a 1,500 K floor in room air (`wymin=1500`).
- Cross-body pitch rules refuse a coarse water pool next to 1 cm members, so
  the block stands alone.
- First releases are expected after a few simulated seconds, at about 6
  simulated ms per wall second.

**First live attempt** (2026-11-14, 10:45–11:11).
- The block landed and rested (COM 0.015 m, speed below 2e-7 m/s), with all
  108 members alive at 1, 4 and 8 s.
- At about 25 minutes of wall time the run's memory cap (6 GB) OOM-killed the
  render worker's Chrome process at 4.9 GB anonymous memory. The machine and
  session were unaffected.
- **Open:** that is roughly 3 MB/s of growth on long runs. It is not yet
  attributed to the rigid lane or to the app.

**Standalone lane reproduction.** The same cold declaration, with the live
conductivities and walls, was driven through `createSchroederSolidRigidFamily`
and `runSchroederSolidRigidLaneStep` for 8,000 steps.
- Bottom members reach the plateau within 1 s, and their liquid fraction then
  grows 0.18 → 0.32 → 0.45 → 0.81 at 2, 3, 4 and 8 s.
- Melting is slower than my first estimate for two reasons: conductivity
  falls toward water's 0.598 W/m/K as a member melts, and heat leaks into the
  cold ice above.
- First full melts, and so the first releases, are due at about 10–11 s
  simulated.
- The relaunched run samples 9.5, 11, 12.5 and 14 s under a 14 GB cap.

## Phase 4c result, 2026-11-14: live melt sequence

Run 11:12–11:53 under a 14 GB cap (peak Chrome RSS about 6.3 GB).

| Sim time | Alive members | Body COM |
|---|---|---|
| 9.5 s | 108 | 0.015 m |
| 11.0 s | 108 | 0.015 m |
| 12.5 s | 72 | 0.010 m |
| 14.0 s | 72 | 0.010 m |

- The whole bottom layer (36 members) melted and released between 11 and
  12.5 s, matching the standalone projection.
- The rebased two-layer body rests one layer lower: COM 0.010 m, half its
  2 cm height, speed 5e-10 m/s.
- From 12.5 s the screenshots show a liquid water isosurface around the
  remaining block: the released rows are live fluid particles drawn by the
  normal liquid renderer. The rigid remainder is still drawn as its voxel
  surface.
- **Evidence:** `~/.cache/icc/repos/ulg/g3-solids-20261114/melt-seq2/`
  (receipt.json, four screenshots, melt-strip.png).

## G3 status

**Delivered** (SOL-0/SOL-1 and phase ownership, f32 route).
- **Contracts:** frame, member, proxy and shape-carrier records.
- **GPU invariant gates** (6 native tests):
  - translation, tumbling, driven rotation and metamorphic bit-identity;
  - contact: fall, rest, drop and settle, proxy swap;
  - shape;
  - member conduction;
  - melt release with conservation and rebase.
- **Live coherent rigid bodies:** fall, bounce and rest with a resident-frame
  render.
- **Live melt release** into the fluid lane.

**Limits, recorded honestly:**
- **Exact-mass routes:** release is off (members stay in the body). An exact
  release must carry integer mass words into the reserved row.
- **No solid–fluid coupling (SOL-3, track A5).** Members exchange heat only
  with walls, and fluid passes through solids.
  - **Consequence for G2:** the Iron Ice plume cannot come from a rigid ice
    block, because molten iron cannot heat rigid members. The plume now
    depends on SOL-3 thermal and mechanical coupling, not on G3.
- **Memory growth on long runs:** about 4.9 GB in 25 minutes of app run, not
  yet attributed.
- **Oracle "candidate review"** needs the user. Commits are on hold per the
  user's instruction.
