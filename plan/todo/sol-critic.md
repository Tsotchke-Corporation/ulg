# SOL Critique: Schroeder Simulation And Coherent Solids

Date: 2026-07-09 AKDT
Status: active architecture correction and implementation todo
Branch reviewed: `SS` at `61dfc3a`

## Decision

Keep the Schroeder Simulation direction, but revise its numerical contract and
add a first-class coherent-solid lane before treating it as suitable for scenes
dominated by solids.

The current plan has a useful GPU-resident hierarchy, law-adapter model, and
PeerCompute authority boundary. It does not yet preserve the identity, pose,
angular state, connectivity, or visible shape of a solid body. Its particle and
grid representation can model continuum stress, but its current render path
turns material points into spheres or a density isosurface. That inevitably
makes a moving solid look like a particle lattice or a rounded blob.

Solid coherence is not a later rendering enhancement. It is authoritative
physics state that must survive grid crossing, SS level changes, contacts,
liquid coupling, phase changes, fracture, chart rebasing, and distribution.

The governing rule for this todo is:

> Schroeder particles may be material carriers, quadrature samples, or contact
> samples, but they do not define a coherent solid's identity or visible
> topology. The Eulerian grid is a transient mechanics and coupling substrate,
> never the solid's rest-shape or render lattice.

## Final Critique Of The Schroeder Plan

### What should remain

1. The hierarchy belongs inside the mechanics architecture, not beside it as a
   CPU spatial index.
2. Dense same-level regions should keep GPU-parallel MLS-MPM/Ocean kernels.
3. Each law should declare exact-near, aggregate-far, cross-level, error, and
   fallback behavior.
4. ComputeManager should schedule work, GPUHub lanes should own hot buffers,
   and StateManager should admit authoritative deltas.
5. Presentation should consume admitted physics outputs without owning physics
   cadence.
6. Full particle readback and CPU mirror trees should remain excluded from the
   normal and validation paths.

### Revised validation position

Do not build a CPU mirror solver or require CPU parity. A CPU implementation is
not inherently more correct, and CPU-shaped reference pipelines have already
introduced serial structures, partial readbacks, synchronization boundaries,
and fallback paths that kept work from becoming GPU resident.

The equations, invariants, manufactured states, and metamorphic relations are
the validation authority. Run them on the GPU and read back only compact fixed-
size evidence records.

Required validation forms are:

- manufactured constant, affine, hydrostatic, rotational, and zero-force states;
- same-device one-level versus two-level A/B execution;
- translated, rotated, particle-permuted, workgroup-varied, and timestep-split
  metamorphic executions;
- GPU reductions for mass, center of mass, linear momentum, angular momentum,
  inertia, energy, deformation, maximum correction, and residual bounds;
- StateManager admission that fails closed when those records exceed declared
  error budgets.

No validation design may introduce CPU-owned hot state, a CPU implementation of
the solver, full state readback, or a serial fallback architecture.

### Representation levels must be separate

The current plan treats physical support as the route into one hierarchy level.
The following decisions may share keys and charts, but they are not the same
authority:

- material representation and coarsening level;
- mechanics discretization and timestep level;
- law-query and aggregate-admissibility level;
- solid contact-proxy level;
- render LOD.

A solid body can have one root frame, coarse far-field moments, medium-resolution
collision proxies, and a high-resolution visible mesh at the same time. Changing
contact or render LOD must not change physical mass, inertia, momentum, or shape.

### Cross-level mechanics remains under-specified

The plan's requirement for bounded conservation residuals is too weak. Every
restriction/prolongation operator must state:

- whether each row stores velocity, momentum, impulse, or a correction;
- partition-of-unity and constant/affine reproduction behavior;
- preservation of mass, center of mass, linear momentum, angular momentum, and
  represented internal energy;
- positivity and finite-state requirements;
- maximum correction and CFL/wave-speed bounds;
- synchronization and reflux behavior across subcycled levels;
- behavior across extreme mass ratios and mixed phases;
- a numerical tolerance derived from the declared `f32`, chart, and algorithm
  error budget.

The documented tiny-mass gas explosion shows why this mathematical contract must
precede more replay and rematerialization infrastructure.

### The solid-body omission

`plan/todo/SS/schroeder-tree-and-algorithm-plan.md` carries particle-level
`F/J/C` and conserved aggregates but contains no body frame, orientation,
inertia, angular momentum, connectivity, fracture, or orbital state contract.
Cross-level transfer can therefore conserve scalar mass and vector momentum
while still destroying a solid's pose, rotational behavior, component identity,
or silhouette.

Current ULG fixed-corotated MLS-MPM is useful for deformable solids. It does not
by itself provide a coherent rigid body or a stable visible surface. Current
material/phase metaball extraction is appropriate for fluids and evolving
volumes, not for a box, tool, vehicle, rock, ice block, structural member, or
planet whose recognizable shape must move across a transient grid.

## Toychest Evidence

PeerCompute's Toychest demonstrates the useful rigid subset of the required
representation split:

- `demos/webgpuphys/src/world.js:546-586` stores a body position, quaternion,
  mass/inertia, and body-local collision particles separately.
- `local_to_world.wgsl:17-27` derives each sample position as
  `x = x_com + R(q) * X_local` on the GPU.
- `body_vel_to_particle_vel.wgsl:17-27` derives boundary velocity as
  `v_sample = v_com + omega x r`.
- particle contact forces and torques reduce into body accumulators before the
  body position and quaternion integrate (`world.js:609-711`).
- collision particles are hidden by default; `shapeRenderer.js:30-61` draws a
  persistent mesh directly from GPU body position/quaternion buffers.

This is why Toychest objects retain boxes, cylinders, spheres, and Tetris
silhouettes while their collision particles move through a grid.

Toychest is a prototype, not the production solver to import. Do not copy:

- its one-chart fixed uniform grid;
- its fixed per-cell capacity;
- penalty stiffness/damping/friction as material law authority;
- mass that changes with collision-sample resolution;
- simple local Euler integration for orbital dynamics;
- CPU-maintained render ranges;
- its scene-owned `World` or separately created device.

The reusable pattern is body-local samples plus one GPU body state and direct
mesh transforms. ULG must implement the law content and GPU kernels under the
existing PeerCompute authority boundary rather than embedding Toychest's demo
scheduler.

## Required Solid Representation

### 1. Solid frame

Add a GPU-resident authoritative record such as
`peercompute.ulg.schroeder-solid-frame.v0` containing:

- stable `bodyId`, component generation, source epoch, and admission id;
- chart id, chart origin/scale reference, and local scale exponent;
- center-of-mass position and normalized orientation quaternion;
- linear momentum and body/world angular momentum;
- physical mass and full body-space inertia tensor;
- material, phase, closure, temperature/internal-energy, and law masks;
- motion mode and approximation error budget;
- rest-shape, member-set, contact-proxy, and render-proxy descriptor keys;
- damage, yield, strain, connectivity, and topology generation summaries.

The body frame is authoritative for a coherent rigid island. It is stored once
even when the body overlaps many SS levels or charts.

### 2. Solid members

Add `peercompute.ulg.schroeder-solid-member.v0` rows containing:

- `bodyId` and immutable material-space coordinate;
- physical mass, rest volume, material, phase, and thermal state;
- local constitutive/deformation state when the region is deformable;
- damage/cohesion/connectivity state and provenance;
- boundary, interior, interface, reaction, and refinement masks.

Members determine physical mass distribution and inertia. Changing the number
of collision or render proxies must never change these quantities.

### 3. Contact proxies

Add independently refinable `peercompute.ulg.schroeder-solid-contact-proxy.v0`
rows containing:

- body/member identity and active SS level;
- body-local position and normal;
- area/volume quadrature weight and contact support;
- boundary velocity source and slip/friction/contact law ids;
- SDF/feature information needed for non-penetration;
- wet, reacting, fractured, or high-curvature refinement reasons.

Rigid interior members do not enter dense P2G/G2P. Only active boundary,
contact, wet-interface, reaction, fracture, or deforming regions refine.

### 4. Shape carriers

Add `peercompute.ulg.schroeder-solid-shape-carrier.v0` descriptors for:

- an analytic primitive, rest-frame triangle mesh/meshlets, or rest-frame SDF;
- body or cluster attachment ids;
- material-space vertex coordinates and optional embedding weights;
- topology generation and fracture/melt visibility state;
- closure/PBR material keys independent of geometry LOD.

Collision particles remain available as a diagnostic overlay. They are not the
default visible geometry.

## Solid Modes

The lane must not treat every solid as perfectly rigid.

### Coherent rigid

One `SE(3)` frame owns motion. Samples are regenerated from rest coordinates
each step. This is the Toychest pattern and the first implementation slice.

Rigid approximation admission must come from a physical/error policy, not a UI
role. Useful inputs include strain/yield state, elastic wave-crossing time,
contact timescale, stress gradients, damage, temperature, and requested error.

### Clustered or articulated

Multiple coherent frames with admitted joints or shared members can represent
articulated mechanisms and moderate deformation. Cluster/shape matching is an
optional approximation with an explicit iteration/error budget, not the
authoritative model for planets or engineering solids.

### Deformable continuum

Keep APIC/MLS-MPM particles, deformation gradients, constitutive closures, and
plastic/damage history. Preserve a persistent material-space surface mesh and
advect its vertices from neighboring material points or cluster transforms.
Do not reconstruct the visible surface from a density metaball field each frame.

### Granular or disconnected

Once cohesion is physically lost, components may become smaller coherent bodies
or granular material points. Topology changes require admitted component ids and
conservative state repartitioning.

## GPU Solid And Liquid Coupling Pass

The initial coupled pass should be one ComputeManager-owned same-device DAG:

1. Transform active solid contact proxies from material/body space to world or
   chart-local space.
2. Insert those proxies into SS active cells without snapping their positions to
   cell centers.
3. Execute liquid and deformable-material P2G on their own state families.
4. Build exact near-field solid/fluid interface candidates at shared cells.
5. Resolve non-penetration and the closure-selected slip, friction, pressure,
   viscosity, adhesion, thermal, and reaction terms against
   `v_com + omega x r`.
6. Apply equal-and-opposite impulse to fluid grid momentum and solid body
   momentum/torque.
7. Reduce proxy impulses by `bodyId` using GPU segmented/workgroup reductions;
   avoid making a global compare/exchange float loop the only admission path.
8. Integrate body frames once and run fluid/deformable G2P.
9. Regenerate rigid samples from the new frame; do not independently G2P-advect
   them.
10. Publish compact conservation, contact, and error summaries for StateManager
    admission.

Rigid mass must not be blended into the liquid velocity field as if it were
fluid mass. Separate material/body velocity fields or an explicit compatibility
and interface operator are required near mixed cells.

Pressure and viscous traction integrated over area-weighted solid samples should
produce buoyancy, drag, force, and torque. Do not add a material-specific float,
sink, or damping rule.

## Cross-Level And Topology Rules

- A solid frame may span many SS levels; contact and render proxies refine
  independently around it.
- `bodyId` and component generation must prevent neighboring same-material
  solids from merging merely because they share a cell.
- Contact proxies may change level only if their total quadrature area and
  impulse response remain inside a declared error bound.
- Cross-level aggregation must include center of mass, angular momentum,
  inertia/covariance, body extent, material/phase masks, and proxy error, not
  only mass and linear momentum.
- A physical contact is resolved once. Fine and coarse proxies must not both
  apply the same impulse.
- Melting detaches admitted member mass/energy/momentum from the solid frame and
  materializes it in the fluid lane.
- Solidification creates or joins coherent islands only after a derived
  cohesion/connectivity gate; phase label alone is insufficient.
- Fracture splits a component and repartitions mass, center of mass, inertia,
  linear momentum, angular momentum, energy, members, and shape topology through
  a StateManager-admitted delta.

## Rendering Contract

Use different geometry carriers for different physical topology:

- coherent rigid solid: persistent rest mesh/SDF transformed by the body frame;
- clustered/articulated solid: rest mesh skinned by admitted cluster frames;
- deformable continuum: embedded material-space surface advected from local
  deformation maps;
- granular/disconnected state: per-body proxies or particles where physically
  appropriate;
- liquid/gas or topology-free evolving volume: field/surface extraction.

Solid render keys must include body/component identity, not only material and
phase. Rendering consumes shape descriptors and frame buffers directly on the
same device. It does not copy transforms through JavaScript each frame and does
not schedule mechanics.

PBR/optical appearance remains closure-derived. Geometry coherence must not be
achieved by changing particle radius, marching-cubes isolation, smoothing a
solid into a blob, or hiding instability behind visual filters.

## Human-To-Planetary Scale

A planet must not be filled uniformly with human-scale particles.

Represent a distant planet with an orbital root frame, mass/multipole state,
spin/angular momentum, rest/reference shape, and coarse layered closures. Use a
law-specific orbital integrator and timestep. The local contact solver does not
own orbital motion.

When focus, tides, impact, fracture, atmosphere, ocean, or surface interaction
requires detail, materialize body-fixed regional charts and local SS/MPM lanes.
Those lanes exchange conservative wrench, energy, mass, multipole, and boundary
summaries with the root body. Surface meshes/heightfields refine independently
of physical interior representation.

Chart rebasing must preserve orbital position/velocity, body pose, spin,
momentum, and visible surface continuity without an impulse or visual jump.

## PeerCompute Authority

- ULG owns solid law content, constitutive models, coupling kernels, shape-
  carrier semantics, and GPU-native invariant definitions.
- ComputeManager schedules solid-frame, proxy-build, interface, reduction,
  integration, topology, and render-publication nodes.
- GPUHub owns same-device hot buffers and leases.
- StateManager admits compact frame/topology deltas and invariant summaries.
- Eshkol/MoonLab may provide derived constitutive, fracture, electronic,
  lattice, or response artifacts; they do not mutate body state directly.
- The browser scene only selects scenarios and renders admitted outputs. Do not
  add a scene-local rigid-body scheduler.

## Implementation Slices

### SOL-0: contracts and GPU invariants

- Define solid frame/member/contact/shape schemas and state-family ownership.
- Specify rigid transforms, wrench reductions, integration, error budgets, and
  no-readback compact summaries.
- Extend authority diagrams and SS law-adapter routing.
- Add GPU manufactured/metamorphic gates before mounted demo integration.

### SOL-1: coherent rigid frame and direct render

- Add one asymmetric rigid body with a rest mesh and local contact samples.
- Move it across the existing GPU grid while retaining exact body identity.
- Draw the mesh from the resident body frame buffer; particles are diagnostics.
- Prove no grid-axis silhouette, velocity, pose, or energy steps.

### SOL-2: solid-solid contact

- Add exact-near SS contact queues for body-owned proxies.
- Reduce equal-and-opposite force/torque and integrate frame state.
- Gate stacking, tumbling, glancing collision, and driven rotation.

### SOL-3: solid-liquid coupling

- Add separate mixed-cell solid/fluid velocity/interface handling.
- Integrate pressure and viscous traction into body wrench.
- Gate float, sink, neutral buoyancy, rotating boundary, and liquid-through-pile
  scenarios.

### SOL-4: deformable solid shape carrier

- Attach an explicit material-space surface to current fixed-corotated
  MLS-MPM/APIC state.
- Advect the surface on GPU without density-field rounding.
- Gate elastic recovery, plastic deformation, grid crossing, and liquid contact.

### SOL-5: phase and topology transitions

- Add admitted melt, solidification, fracture, and component merge/split deltas.
- Preserve all conserved body/member quantities and shape topology generation.
- Gate solid-to-liquid-to-solid and fracture sequences.

### SOL-6: multilevel and planetary body

- Add body-spanning levels, proxy refinement, chart rebasing, far-field moments,
  and local surface/interior materialization.
- Gate a spinning orbiting body, close interaction, and a local ocean/solid
  surface patch without filling the planet with particles.

## Acceptance Gates

Every gate must declare a dimensionless or unit-bearing tolerance before it can
pass. “Bounded” without a number and derivation is not acceptance.

### GPU invariant gates

- Translate an asymmetric body across at least 100 cells and many fractional
  subcell offsets. Pair distances, body-frame coordinates, speed, orientation,
  and physical mass/inertia remain invariant within the declared budget.
- Run torque-free and driven rotation. Quaternion norm, angular momentum, and
  energy drift stay within budget.
- Vary member ordering, proxy ordering, workgroup size, dispatch partition, and
  equivalent timestep subdivision without changing admitted results beyond the
  declared parallel reduction budget.
- Change contact-proxy and SS levels without changing mass/inertia or injecting
  an impulse.
- Cross an SS level and chart boundary with continuous pose, velocity, spin,
  shape, and render output.

### Interaction gates

- Stack and tumble differently shaped solids with derived contact/friction
  behavior and no lattice locking.
- Run glancing and off-center impacts with equal-and-opposite linear and angular
  impulse.
- Float a low-density body, sink a high-density body, and hold a neutral-density
  body in liquid. Measure displaced-volume, momentum exchange, penetration,
  force, and torque errors.
- Run flowing liquid through a mostly-solid pile while keeping connected solid
  silhouettes and independent body identities.
- Rotate or translate a wetted body and recover the expected boundary velocity
  without fluid/solid mass blending.

### Transition and scale gates

- Melt, refreeze, and fracture while conserving mass, center of mass, linear and
  angular momentum, inertia accounting, and energy.
- Run a two-body orbit over multiple periods with the declared orbital law and
  then activate a local surface patch without an orbital kick.
- Rebase an orbiting/spinning body between charts without a physics or visual
  discontinuity.
- Demonstrate that a mostly-solid scene scales with active bodies and boundary
  proxies, not solid interior volume or render triangle count.

### Visual sequence gates

Capture close-spaced frames and GPU atomics for:

- asymmetric solid translation and rotation across the grid;
- mixed boxes/cylinders/irregular bodies stacking and tumbling;
- solids floating, sinking, and moving through liquid;
- deformable solid recovery and plastic deformation;
- melt/refreeze and fracture;
- a spinning orbiting planetary body with a refined local surface/ocean patch.

The default view must show coherent meshes/surfaces without particle-lattice
faceting, metaball rounding, blinking, grid-axis wobble, or body identity loss.
A diagnostic toggle may reveal contact/material particles underneath.

## Performance And Residency Gates

- Physics, contact, body reduction, pose integration, surface deformation, and
  render transforms remain on one ComputeManager/GPUHub-owned device lane when
  possible.
- No full particle, member, proxy, mesh, or transform readback occurs in the hot
  path or its acceptance tests.
- Compact diagnostics are reduced on GPU and read back only when requested.
- Rigid interiors do not enter dense MLS-MPM P2G/G2P.
- Rendering binds resident frame/cluster buffers and uses GPU-compacted indirect
  instance/meshlet ranges rather than CPU-maintained per-body draw loops.
- Proxy LOD changes do not change physical mass, inertia, contact energy, or
  visual topology.

## Non-Goals

- Do not import Toychest's `World` as ULG's authoritative solver.
- Do not create a second scene-local scheduler or sibling GPU manager.
- Do not build a CPU mirror solver or CPU parity gate.
- Do not render coherent solids as marching-cubes blobs merely because their
  mechanics use particles.
- Do not make collision-sample count determine mass or inertia.
- Do not force rigid, deformable, granular, liquid, and orbital motion through
  one integrator or one level decision.
- Do not uniformly particle-fill planets.

## Plan Ordering Recommendation

1. Close the current two-level cross-level impulse/stability defect.
2. Land SOL-0 and SOL-1 before more solid rendering or mostly-solid scenes.
3. Land SOL-2 and SOL-3 before claiming general mixed material support.
4. Land SOL-4 before using current MLS-MPM solids as a visual-quality proof.
5. Land SOL-5 before claiming phase-complete solid behavior.
6. Resume broad distributed rematerialization and planetary claims only after
   the local GPU-native solid invariants are green.

The current append-only Schroeder plan should be split into a short active plan,
a numerical contract, and a historical status ledger. This file supplies the
solid and validation correction; implementation history should remain in
`plan/log.md`, not accumulate inside the active mathematical contract.

## Primary Technical Anchors

- [Affine Particle-In-Cell](https://www.math.ucdavis.edu/~jteran/papers/JST17.pdf):
  affine field reproduction and linear/angular momentum behavior for particle-
  grid transfer.
- [MLS-MPM with CPIC](https://yuanming.taichi.graphics/publication/2018-mlsmpm/):
  GPU-friendly deformable mechanics, discontinuities, and two-way rigid
  coupling concepts.
- [MPM simulation of interacting fluids and solids](https://engweb.swan.ac.uk/~cfli/papers_pdf_files/2018_CGF_MPM_simulation_of_interacting_fluids_and_solids.pdf):
  separate solid stress/fluid pressure and interface impulse treatment.
- [Generalized interpolation material point method](https://www.techscience.com/CMES/v5n6/33378):
  reduced grid-crossing noise through smoother material-point support.
- [Embedded Lagrangian Surfaces in MPM](https://doi.org/10.1002/nme.70260):
  explicit deformable interfaces whose resolution is independent of the grid.
- [Hybrid symplectic planetary integration](https://arxiv.org/abs/1903.04972):
  orbital integration with more detailed treatment around close encounters.

These references constrain the design but do not introduce a CPU implementation
requirement. ULG acceptance remains GPU-native.

## Completion Definition

This todo is complete only when:

- coherent solid identity and body/member/proxy/shape contracts are admitted;
- an asymmetric rigid body crosses the grid and SS levels without losing pose,
  silhouette, or invariants;
- solid-solid and solid-liquid interaction gates pass on GPU;
- deformable solids retain an explicit material-space surface;
- phase/topology transitions preserve admitted conserved state;
- a mostly-solid scene does not pay dense interior MPM or metaball-render cost;
- a planetary body can remain coarse in orbit and refine a local solid/liquid
  region without discontinuity;
- all required visual sequences and compact GPU diagnostic artifacts are
  recorded;
- no CPU mirror, hot-path readback, scene scheduler, or particle-lattice solid
  rendering has been introduced.
