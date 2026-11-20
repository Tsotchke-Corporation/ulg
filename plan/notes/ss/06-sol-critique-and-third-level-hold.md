# SS note 6: the SOL critique (coherent solids, SS sparsity, and the third-level hold)

Source: `plan/todo/sol-critic.md` (988 lines; dated 2026-07-10, "active
architecture correction and implementation todo"; routing update 07-13; one
paragraph added 2026-11-16). Read by Hermes in full, 2026-11-17. This is the
contract behind G3 and A5, and it is the document that held SS at two levels
for four months.

## Its decision (`:332-354`)

"Keep the Schroeder Simulation direction, but revise its numerical contract and
add a first-class coherent-solid lane before treating it as suitable for scenes
dominated by solids."

"Solid coherence is not a later rendering enhancement. It is authoritative
physics state that must survive grid crossing, SS level changes, contacts,
liquid coupling, phase changes, fracture, chart rebasing, and distribution."

The governing rule: "Schroeder particles may be material carriers, quadrature
samples, or contact samples, but they do not define a coherent solid's identity
or visible topology. The Eulerian grid is a transient mechanics and coupling
substrate, never the solid's rest-shape or render lattice."

## What it says should remain of the SS plan (`:358-370`)

1. "The hierarchy belongs inside the mechanics architecture, not beside it as a
   CPU spatial index."
2. Dense same-level regions keep GPU-parallel MLS-MPM kernels.
3. "Each law should declare exact-near, aggregate-far, cross-level, error, and
   fallback behavior."
4. ComputeManager schedules, GPUHub lanes own hot buffers, StateManager admits
   deltas.
5. "Presentation should consume admitted physics outputs without owning
   physics cadence."
6. No full particle readback and no CPU mirror trees.

## Two corrections to SS itself

**Representation levels must be separate (`:397-411`).** "The current plan
treats physical support as the route into one hierarchy level." These are five
different authorities that may share keys and charts:

- material representation and coarsening level;
- mechanics discretization and timestep level;
- law-query and aggregate-admissibility level;
- solid contact-proxy level;
- render LOD.

"A solid body can have one root frame, coarse far-field moments,
medium-resolution collision proxies, and a high-resolution visible mesh at the
same time."

This bears directly on first-class air. The air work sets a carrier's SS level
from its volume (`max(physical, source)`), which is the single-level-decision
shape this section criticises. A coarse air parcel next to a hot surface needs
a fine law-query level for conduction while keeping a coarse mechanics level.

**Cross-level mechanics is under-specified (`:413-430`).** "The plan's
requirement for bounded conservation residuals is too weak." Every restriction
and prolongation operator must state: what each row stores (velocity, momentum,
impulse or correction); partition-of-unity and affine reproduction;
preservation of mass, centre of mass, linear momentum, angular momentum and
internal energy; positivity; maximum correction and CFL bounds;
"synchronization and reflux behavior across subcycled levels"; "behavior across
extreme mass ratios and mixed phases"; a tolerance derived from the f32, chart
and algorithm error budget. "The documented tiny-mass gas explosion shows why
this mathematical contract must precede more replay and rematerialization
infrastructure."

The N-level chain's phase B (restrict pair by pair, nested reflux, shared dt
first and subcycling later) is exactly where this contract is needed, and air
against iron is an extreme mass ratio.

## The SS cost findings of 2026-07-10 (`:141-229`)

| Finding | Text | Later state (from Hermes's other notes) |
|---|---|---|
| Render field | "one invocation per surface cell and each invocation scans every particle ... `S * 884,736 * N`" | Presentation was rebuilt since; to check in reader notes |
| Interface feedback | "can perform a blocking GPU-to-CPU candidate compaction, build force rows in JavaScript, upload them" | To check |
| Neighbours | Thermal can reach "the exhaustive `N*N` fallback"; each law builds its own bins | Routed to the shared spatial authority refactor (07-13), complete 07-21 |
| SS storage | "The active-node list currently permits one active row per particle ... 64 candidate rows of 64 bytes for every queue row: 4 KiB per active particle, or about 4 GiB at one million particles before useful state." "Planetary claims are blocked until cost scales with admitted active nodes/interactions rather than particle count times a fixed worst-case budget." | Partly open: the 11-16 waiver lists the remaining items |
| Rebuilds | "The Schroeder artifact chain is rebuilt and separately submitted each substep; cross-level candidates can remain observational/unconsumed." | The worker lane still builds one epoch per step; A2 targets it |
| Fused path | "Pressure, reaction, retained-product, Schroeder, and other sidecars disqualify it, so the requested mixed-material scenes fall back" | Still true in shape: Tier0 is fused, canonical is not |

"the current performance limit is not primarily a lack of a third SS level"
(`:28-32`). "The user-held third level stays on hold."

Profiling warning that still applies (`:264-265`, `:319-322`): "Current
`stageMs` values are predominantly JavaScript/enqueue wall timing, not GPU
execution time."

## The third-level hold and its waiver

Priority 3 (`:869-875`): "Make two-level SS actually sparse. Objective: compact
unique active nodes, replace the per-particle 4 KiB candidate reservation with
byte-bounded CSR/global arenas, publish overflow evidence, consume cross-level
candidates, and close affine/angular/reflux and extreme-ratio invariants. Do
not resume the third level until these gates are green and measured."

Added at the end (`:980-988`): "**Priority 3 gate waived by the user
(2026-11-16).** The third and further SS levels proceed now as an N-level chain
of 2:1 pairs, for first-class room air ... The sparsity work this gate asked
for stays as follow-up, not as a prerequisite: byte-bounded CSR arenas;
overflow evidence; consumed cross-level candidates; closed affine, angular and
reflux invariants; extreme-ratio invariants."

So five named SS debts are open by the owner's choice, and they are debts, not
cancelled work.

## The solid representation (`:481-540`): G3's schema

Four GPU-resident record families, named
`peercompute.ulg.schroeder-solid-{frame,member,contact-proxy,shape-carrier}.v0`:

- **Frame**: `bodyId`, component generation, chart, centre of mass, quaternion,
  linear and angular momentum, mass, inertia tensor, motion mode and error
  budget. "stored once even when the body overlaps many SS levels or charts."
- **Members**: material-space coordinate, mass, rest volume, thermal state;
  "Members determine physical mass distribution and inertia."
- **Contact proxies**: independently refinable; body-local position and normal,
  quadrature weight, "active SS level". "Rigid interior members do not enter
  dense P2G/G2P."
- **Shape carriers**: analytic primitive, rest mesh or SDF. "Collision
  particles ... are not the default visible geometry."

Four solid modes (`:542-573`): coherent rigid (one SE(3) frame; "Rigid
approximation admission must come from a physical/error policy, not a UI
role"), clustered/articulated, deformable continuum (keep MLS-MPM, with a
persistent material-space surface), granular/disconnected.

New gates added before SOL-1 (`:96-115`): rigid-motion objectivity;
exposed-area ownership ("Interior members have zero exposed area; changing
member resolution cannot change total radiant power"); body-aware
chemistry/topology; GPU numerical acceptance; "No global serial body/event
scan."

## Solid-liquid coupling as one pass (`:575-604`): A5's design

Ten steps in "one ComputeManager-owned same-device DAG": transform proxies;
insert into SS active cells; fluid P2G; exact near-field solid/fluid interface
candidates; resolve non-penetration and closure-selected slip, friction,
pressure, viscosity, adhesion, thermal and reaction terms against
`v_com + omega x r`; equal and opposite impulse; reduce by `bodyId`; integrate
frames; regenerate rigid samples ("do not independently G2P-advect them");
publish compact summaries.

"Pressure and viscous traction integrated over area-weighted solid samples
should produce buoyancy, drag, force, and torque. Do not add a
material-specific float, sink, or damping rule."

Cross-level rules (`:606-625`): "A solid frame may span many SS levels";
"A physical contact is resolved once. Fine and coarse proxies must not both
apply the same impulse."; melting detaches member mass, energy and momentum
into the fluid lane; "Solidification creates or joins coherent islands only
after a derived cohesion/connectivity gate; phase label alone is insufficient."

## The slices (`:679-727`)

| Level | Content |
|---|---|
| SOL-0 | Contracts and GPU invariants |
| SOL-1 | One asymmetric rigid body with a rest mesh, moved across the grid, drawn from the resident frame buffer |
| SOL-2 | Solid-solid contact: exact-near SS contact queues for body-owned proxies; stacking, tumbling |
| SOL-3 | Solid-liquid coupling: float, sink, neutral buoyancy, rotating boundary, liquid through a pile |
| SOL-4 | Deformable solid shape carrier |
| SOL-5 | Phase and topology transitions: melt, solidification, fracture |
| SOL-6 | "Multilevel and planetary body": body-spanning levels, proxy refinement, chart rebasing, far-field moments |

Human-to-planetary scale (`:648-664`): "A planet must not be filled uniformly
with human-scale particles." A distant planet is an orbital root frame with
multipole state and "a law-specific orbital integrator and timestep"; detail
materializes as "body-fixed regional charts and local SS/MPM lanes" that
"exchange conservative wrench, energy, mass, multipole, and boundary summaries
with the root body".

Ordering (`:830-900`): 0A evidence, 0B presentation liveness, 1 dense field,
2 one resident lane and one neighbourhood authority, 3 sparse two-level SS,
4 SOL-0/1, 5 parallel resident sidecars, 6 "Coupling, deformable surfaces,
topology, then scale".

Completion (`:962-978`) includes: "an asymmetric rigid body crosses the grid
**and SS levels** without losing pose, silhouette, or invariants"; "a
mostly-solid scene does not pay dense interior MPM or metaball-render cost".

## Against the campaign (Hermes, INFERRED; to verify in code)

- G3 was defined as SOL-0 and SOL-1; A5 as SOL-2 to SOL-6 with solid-fluid
  coupling and more SS levels. Claude's notes report all of them delivered.
  This document's own bar is high: SOL-1 needs the body to cross SS levels;
  SOL-3 needs separate mixed-cell velocity handling; SOL-6 needs charts and an
  orbital integrator. The reader notes on the `sphSolid*` and coupling code
  must be checked against these exact gates, and against whether any campaign
  scene contains a coherent solid at all (Iron Ice's iron and ice are MPM
  continua today).
- Open questions 4 and 6 (`:933-938`) are still the SS questions: what byte
  budget replaces fixed candidates per queue row "especially across extreme
  mass ratios and level boundaries", and "where is the measured
  switching/admission rule" between continuum and rigid representation.
