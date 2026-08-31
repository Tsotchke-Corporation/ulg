# SOL Critique: Schroeder Simulation And Coherent Solids

Date: 2026-07-10 AKDT
Status: active architecture correction and implementation todo
Branch reviewed: `SS` at `d5319c2` plus the uncommitted scenario-audit slice

Routing update, 2026-07-13 AKDT: Priority 2/3 shared-neighborhood and sparse-SS
execution now routes through
`plan/done/SS/shared-spatial-authority-refactor-plan.md`. This document remains the
active coherent-solid, cross-level numerical, scientific-validation, and
third-level-hold contract.

## 2026-07-10 Post-Fable Re-Audit

### Executive finding

The new physics work is substantive, but it does not implement the coherent-
solid architecture in this document. SOL-0 through SOL-6 remain unstarted.

The immediate two-level tiny-mass explosion is fixed by `3f5b2d9`; gas wall
pinning, contact conduction, reaction-product placement, reaction-rate
limiting, radiation, and surface appearance also advanced. Those changes make
the requested reaction and phase scenarios worth testing again. They do not
add a solid frame, body identity, orientation, inertia, angular momentum,
connectivity, contact proxy, persistent shape carrier, fracture topology, or
body-aware render key.

The re-audit also finds that the current performance limit is not primarily a
lack of a third SS level. Dense render-field construction, readback/reupload
interface feedback, missing shared neighbor residency, un-compacted Schroeder
nodes, serial event placement, and submission/fence bubbles must be addressed
first. The user-held third level stays on hold.

Production native-surface acceptance is failed. The selected main WebGPU
canvas shows surface-like output initially, then becomes a uniform background
after the first resident refresh. The same native pipeline passes its offscreen
draw validation after the shared bind-group repair, but the seven-scenario run
also reports 109 submissions that reference a destroyed indirect buffer. This
narrows the blocker to the general presentation/resource-lifecycle boundary;
offscreen success does not waive a failed production canvas sequence.

No performance optimization is implemented by this audit. It adds selectable
scenarios, fixed-size GPU checkpoint evidence, stricter UI-suppressed visual
capture, and one general native validation bind-group repair. It has not fixed
the main-canvas post-refresh failure or changed physics for a named scene,
material pair, particle count, or expected result.

### Progress against this todo

| Area | Current result | Credit |
| --- | --- | --- |
| Immediate two-level stability | CFL-consistent pre-velocity clamp and mass-significance guard landed | immediate blocker closed |
| Cross-level numerical contract | Still lacks affine/angular/reflux/extreme-ratio proofs and derived tolerances | partial only |
| SOL-0 contracts/invariants | No solid frame/member/contact/shape schema or GPU invariant family | 0% |
| SOL-1 coherent rigid body | No `SE(3)` body state or direct resident mesh transform | 0% |
| SOL-2/3 contacts and liquid coupling | Particle/material interfaces exist, but no body wrench or separate solid velocity field | 0% |
| SOL-4 persistent deformable surface | Solids still use particle spheres/density surfaces | 0% |
| SOL-5 phase/fracture topology | Product placement is material-based, not body/component-aware topology admission | 0% |
| SOL-6 planetary body/charts | No orbital root/body-fixed local chart implementation | 0% |
| Standard GPU-only evidence | No-full resident MLS-MPM plus a fixed 5,184-byte GPU reduction; zero particle-state/thermo mapping | audit evidence form met |
| Production native surface | Offscreen draw passes; main canvas becomes uniform after first refresh and submits destroyed indirect buffers | failed/blocking |
| Legacy numerical tests | CPU-mirror feature tests remain elsewhere and cannot gate Schroeder acceptance | migration still open |

### What the Fable work changes

Keep and build on these landed pieces:

- `3f5b2d9`: removes the immediate tiny-parent cross-level velocity explosion.
- `3e89418`: replaces constant gas pressure with a gauge density response and
  allows larger gas expansion, while retaining a documented temperature-ratio
  approximation.
- `885ef85`: bounds gas/phase wall clearance by half a mechanics grid cell.
- `21dfa94`: derives pair thermal reach from both particles' rest-volume radii.
- `7382e0b`: materializes reaction products into real mechanics rows with
  reserved capacity and center-of-mass velocity.
- `ef2d45e`: limits reaction extent by interface area, flux, and timestep.
- `8b38c43`: adds pair and ambient gray-body radiation from closure-derived
  emissivity.
- The surface commits improve liquid/gas inspection and hot-material emission.

Do not over-credit them:

- The same reaction-extent law is copied across six WGSL modules. A partial
  change already minted phantom mass during development. This is a maintenance
  and redundant-computation boundary, not a stable single law node.
- Product placement is one serial invocation that scans particles and spares.
  Its terminal nearest-same-material merge ignores body/component identity,
  phase, and distance. It cannot become SOL topology logic.
- Ambient radiation gives every particle a full `4*pi*r^2` exposed surface.
  Interior solid samples therefore radiate in proportion to discretization.
- Splash-smear uses raw local velocity variance. Rigid rotation has nonzero
  variance, so a coherently rotating solid is treated like diverging spray.
- The new rendering work remains density-field/particle appearance; it does
  not preserve solid shape or pose.

### New coherent-solid gates required by the landed work

Add these to SOL-0 before implementing SOL-1:

1. **Rigid-motion objectivity.** A translated and rotating asymmetric body must
   be visually and mechanically invariant after subtracting best-fit rigid
   motion. Render smear may respond to objective strain/divergence, not raw
   rotational velocity variance.
2. **Exposed-area ownership.** Radiation, reaction, convection, and wet contact
   consume admitted surface/contact quadrature weights. Interior members have
   zero exposed area; changing member resolution cannot change total radiant
   power.
3. **Body-aware chemistry/topology.** Product placement, melt detachment,
   solidification, and fracture carry `bodyId`/component generation. A product
   cannot merge into an unrelated same-material body as a terminal fallback.
4. **GPU numerical acceptance.** Stefan-Boltzmann, rigid transform, wrench,
   angular momentum, and topology conservation gates execute the actual GPU
   kernels with compact GPU reductions. A JS/CPU mirror is not acceptance.
5. **No global serial body/event scan.** No SOL hot stage may use a single
   invocation to walk every body, member, contact, product event, or particle.

## Standard Scenario Evidence

Artifact: `/tmp/ulg-standard-audit/native-authoritative-final-2026-07-10/summary.json`.
All checkpoints reduce retained GPU state into a fixed 5,184-byte record and
map zero particle-state or thermo bytes. A true retained time-zero checkpoint
is still missing, so every named initial-state gate is correctly inconclusive.

| Scenario | Quantitative result | Missing or failed behavior | Mean batch |
| --- | --- | --- | ---: |
| Water cycle | exact 1,216 kg span; liquid falls; 10.134 kg vapor forms | vapor center stays at 0.10 m and vapor mass never declines | 287.1 ms / 512 steps |
| Molten Fe on ice | mass span `1.21e-6`; 344.339 kg Fe solidifies; 184.103 kg water and 0.482 kg steam form | Fe cools only 1.679 K and steam moves down 0.002 m | 307.1 ms / 512 steps |
| Sodium/water | mass span `5.05e-7`; 3.856 kg NaOH and 0.0972 kg H2 form; peak 509.15 K | H2 rises 43.4 mm, below the 50 mm gate; violence and plume color cannot be accepted | 4,021.7 ms / 256 steps |
| Cesium/fluorine | mass span `3.88e-7`; 5.739 kg CsF forms; peak 3,593.26 K then cools to 1,851.13 K | quantitative exotherm passes, but time-zero and visual acceptance remain unavailable | 2,549.1 ms / 256 steps |
| Ba/Pb, Bk/Lr, Fr/Fe | three finite checkpoints each, zero invalid-mass rows, mass span at or below `1.04e-7` | all post-refresh visible frames fail | 570.5-583.7 ms / 64 steps |

At 1280x800, captures suppress the control panel, warning bar, picker, and
menu, then inspect the selected native canvas. Every scenario has a
surface-like initial frame and uniform/background-only frames from the first
resident refresh onward. Effective modes also include
`resident-surface-buffers-no-overlay`; the standard classifier now requires
every interval to remain `native-webgpu-surface-consumer`, not merely one
matching sample. Physics checkpoints remain useful despite presentation
failure, but overall visual acceptance is failed for all seven scenarios.

## Performance And Redundancy Re-Audit

### P0 - Render-field algorithm and memory model

The native material surface refresh dispatches one invocation per surface cell
and each invocation scans every particle. At the current 96-cubed ceiling that
is `S * 884,736 * N` particle visits. A dispersing cell runs a second complete
particle scan, then scans product events. At 10,000 particles, one surface is
8.85 billion visits before the optional second pass.

This is the largest clear redundant-calculation target. Replace dense gather
with particle/source-local splats, spatial tiles, or sort-by-cell construction.
The existing material-interface source-local splat is a local pattern to reuse.
Do not optimize this by lowering scientific particle counts or hiding the cost
behind render cadence.

The memory budget is also wrong. The comment still budgets 16 bytes per field
cell, while the field ABI is now eight floats/32 bytes. Four 96-cubed fields
are about 108 MiB, not 57 MiB. Full scalar snapshots used for gradient normals
can duplicate another roughly 108 MiB before extraction buffers. Correct the
budget, remove unused reserved lanes, and derive normals during extraction or
share/version field pages.

Coherent solids must bypass this field entirely: render their persistent mesh,
meshlets, or SDF from resident body/cluster frames.

### P0 - Interface feedback leaves the resident lane

The default mounted material/pressure interface refresh can perform a blocking
GPU-to-CPU candidate compaction, build force rows in JavaScript, upload them,
and then prevent the fused resident sequence from proceeding. The repo already
contains a retained GPU force-row route; make candidate-to-force-to-grid
feedback resident and publish CPU diagnostics only at an explicit cadence.

### P0 - Thermal/radiation neighbor coverage

Thermal WGSL uses shared bins only in a narrow fused path. Normal and sidecar-
heavy scenes can reach the exhaustive `N*N` fallback. Radiation widens support
to `4*(r_i+r_j)`; a binned particle can inspect up to 1,331 cells, and larger
reach abandons bins for all-particle scans.

The new radiation support bound also performs an `O(N)` CPU state/thermo scan
while constructing each GPU stage. CPU mirrors may be stale, so this small CPU
dependency can both serialize the graph and narrow neighbor coverage. Derive
or reduce maximum support on GPU/immutable metadata and publish one persistent,
multi-resolution neighbor artifact shared by mechanics, thermal, reaction, and
contact consumers.

### P0 - Schroeder storage is not yet hierarchical in cost

The active-node list currently permits one active row per particle and reports
an unsorted particle-tile range. The default neighbor budget then reserves 64
candidate rows of 64 bytes for every queue row: 4 KiB per active particle, or
about 4 GiB at one million particles before useful state.

Build real unique-node compaction and byte-bounded sparse CSR/global candidate
arenas with overflow telemetry. Planetary claims are blocked until cost scales
with admitted active nodes/interactions rather than particle count times a
fixed worst-case budget.

### P1 - Rebuilt DAGs, bins, buffers, and fences

- The Schroeder artifact chain is rebuilt and separately submitted each
  substep; cross-level candidates can remain observational/unconsumed.
- Two-level mode builds additional fine/coarse artifacts and unconditionally
  requests a compact conservation readback.
- Reaction and contact build their own bins and zero/upload large buffers even
  when Schroeder candidates bypass those bins in WGSL.
- Reaction tables and render rows are repacked/reuploaded; visual and interface
  refreshes can independently derive the same 80-byte-per-particle render row.
- Gas-product summaries map a compact buffer each reactive substep.
- Product-event compaction and placement use one workgroup/invocation and scan
  all particles/spares.
- Surface submission completion is awaited before later compute even where
  same-queue ordering and versioned resources should be sufficient.

Use persistent workspaces, cached static tables/pipelines/bind groups, GPU
clears, one resident neighbor generation, parallel prefix/sort/free lists, and
versioned double-buffered render resources. These are future todos, not changes
made during this audit.

### P1 - Fused mechanics excludes the scenes that matter

The fused mechanics path correctly retains grid and ping-pong state and encodes
many substeps in one submission. Pressure, reaction, retained-product,
Schroeder, and other sidecars disqualify it, so the requested mixed-material
scenes fall back to repeated stage allocation/submission. Treat fully resident
sidecar fusion as an end-to-end objective rather than optimizing isolated
kernels whose orchestration still forces a fence.

### P2 - Real but non-hot costs

GGX environment prefiltering is CPU-heavy but only runs when a background image
changes; it is startup/UI jank, not the first hot-loop target. Do not prioritize
it ahead of dense field construction, readback feedback, neighbors, or event
serialization.

### Source anchors for the performance findings

- Dense render gather and its conditional second particle scan:
  `ulg-gpu-abi/src/wgsl.js:4693-4874`; native surface-table/build routing:
  `src/visualization/sphPhaseScene.js:27456-27500` and `:27624-27660`.
- Incorrect 16-byte field-budget comment versus the two-`vec4`/32-byte write:
  `src/visualization/sphPhaseScene.js:6719-6723` and
  `ulg-gpu-abi/src/wgsl.js:4869-4873`.
- Default blocking interface cadence and CPU-built force-row reupload:
  `src/visualization/sphPhaseDemoMount.js:5034-5047`, `:6671-6683`, and
  `src/visualization/sphPhaseScene.js:12935-13004`, `:13199-13324`.
- Thermal 1,331-cell bounded scan and exhaustive `N*N` fallback:
  `ulg-gpu-abi/src/wgsl.js:921-1063`; CPU support-bound scan:
  `src/runtime/sph/sphThermalGpuKernel.js:1542-1577` and `:1711-1753`.
- One active-node row per particle and per-queue fixed candidate storage:
  `src/runtime/sph/schroederHierarchyGpu.js:3840-3928`, `:4022-4077`, and
  `:4080-4157`; candidate ABI is 16 floats/64 bytes at
  `ulg-gpu-abi/src/index.js:893-910`.
- Serial product compaction/placement and component-blind terminal merge:
  `ulg-gpu-abi/src/wgsl.js:2315-2338` and `:2341-2500`.
- Six copied reaction-extent law blocks begin at
  `ulg-gpu-abi/src/wgsl.js:1554`, `:2706`, `:3340`, `:3658`, `:3990`, and
  `:4262`.

## Profiling Contract Before Optimization

Current `stageMs` values are predominantly JavaScript/enqueue wall timing, not
GPU execution time. The next performance slice must add:

- checkpoint id, source step/time, resident generation, and render-refresh
  sequence/generation;
- GPU timestamp queries around mechanics, thermal, reaction, Schroeder,
  render-field, and extraction passes;
- command encoder and `queue.submit` counts per step/refresh;
- `mapAsync` and `onSubmittedWorkDone` calls, bytes, wait time, and owner;
- buffer create/destroy, peak live bytes per state family, `writeBuffer` bytes,
  and GPU-copy bytes;
- version/reuse/replacement identifiers for color/depth attachments, bridges,
  bind groups, render fields, extracted rows, and indirect draw buffers;
- neighbor candidate/exhaustive visits, overflows, and built-but-bypassed bins;
- particle count versus unique SS nodes, dirty/rebuilt nodes, candidate bytes,
  and admitted rows;
- render `S/C/N/event` visits, field/snapshot/extraction bytes, and budget use;
- selected canvas/bridge identity, UI-suppression flag, clip, CSS/backing size,
  DPR, configure/resize count, frame count, device-lost state, and uncaptured
  WebGPU errors;
- side-by-side production-canvas and offscreen RGB span, distinct colors,
  non-background pixel ratio, status, and reason at time zero, first refresh,
  second refresh, and final checkpoint;
- checkpoint reduction GPU time, mapped evidence bytes, map wait, allocation
  bytes, and screenshot time, reported outside production physics timing;
- pipeline/cache hits and misses;
- p50/p95/p99 schedule and frame latency over `N=1e2/1e3/1e4/1e5` and
  `S=1/4/16`.

Do not use CPU/GPU parity or a CPU solver to obtain these measurements.

### Measured performance evidence

Artifacts:

- `/tmp/ulg-standard-audit/perf-all-laws-native.json`
- `/tmp/ulg-standard-audit/perf-mechanics-only-native.json`
- `/tmp/ulg-standard-audit/perf-interface-native.json`

The controlled native-surface A/B used two eight-step batches at 128, 1,024,
and 8,192 particles with explicit queue-fence measurement. At 1,024 particles,
thermal/reaction-enabled engine batch time was 169.6 ms versus 79.4 ms with
those groups disabled (`2.14x`). At 8,192 it was 131.6 versus 63.1 ms
(`2.09x`). The 128-particle pair was 109.9 versus 87.6 ms (`1.25x`). The
water benchmark had no reaction events, so this isolates thermal and enabled-
sidecar overhead, not reactive chemistry cost.

The full scenarios show the larger end-to-end cliff: water and iron take about
0.56-0.60 ms per step, while sodium/water takes 15.71 ms and Cs/F takes
9.96 ms. That is consistent with reactive/thermal sidecars excluding the fast
fused path, but it is not isolated GPU-kernel timing.

Queue-fence and batch timings are non-monotonic across the three counts; native
refresh timing stays around 27-34 ms while the canvas is visually failed and
destroyed-buffer submissions occur. Do not use those numbers to claim surface
scaling. `stageMs.thermalStep`/`reactionStep` measure host enqueue work,
`residentGpuCompletedStageMs` is a max rather than a sum, and the benchmark's
`residentStageStepsPerSecond` omits fused step count. Use
`probeEngineStepsPerSecond` until GPU timestamps land.

The interface diagnostic identifies a good reusable pattern. Its source-local
GPU splat estimates 140,976 / 432,000 / 3,456,000 visits versus
949,104 / 7,592,832 / 60,742,656 dense cell-particle pairs: 14.85%, 5.69%,
and 5.69% of dense work, with 1.4-2.9 ms refresh wall time and zero readback.
It still reports `gpu-resident-summary-pending` because the pressure consumer
is not wired to consume the retained candidate rows. Finish that general
GPU-to-GPU path; do not reintroduce CPU force-row construction.

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

For every native sequence, the same selected
`native-webgpu-surface-consumer` canvas must show surface-like compositor
variation at time zero, first resident refresh, second refresh, and the final
fixed checkpoint. A passing offscreen texture, nonzero indirect args, or
`ready` bridge status is insufficient. Record canvas identity, UI suppression,
clip, CSS/backing dimensions, DPR, source step/time, resident generation, and
render-refresh generation. Blank, uniform/background-only, UI-only,
wrong-canvas, stale-generation, or mixed-bridge intervals fail.

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
- Do not repair presentation by branching on scenario, material/phase,
  particle count, surface/checkpoint index, or expected color; forcing a
  particle/CPU fallback; hiding refreshes with cadence suppression; or treating
  the offscreen harness as visible production output. A general repair must
  pass one/many surfaces, opaque/transparent batches, reordered materials,
  pause/play, resize, DPR 1/2, every named scene, and seeded random pairs.

## Plan Ordering Recommendation

### Priority 0A - Trustworthy GPU-native evidence

Objective: make the real GPU execution and production WebGPU presentation
observable without changing their authority. Add timestamp-query spans,
submission/fence/byte counters, a retained time-zero checkpoint, fixed-size GPU
material/phase reductions, and interval native-surface pixel evidence at an
inspectable viewport. No full-state readback, CPU solver, or CPU parity gate is
permitted. A uniform or UI-only frame is a visual failure.

The fixed-size reduction and UI-suppressed interval capture are implemented;
time-zero retention, GPU timestamps, and complete lifecycle counters remain.

### Priority 0B - Production presentation liveness

Objective: repair the general initial-to-refresh production lifecycle before
optimizing field math. Preserve the passing offscreen draw as an isolation
probe, then trace canvas configure/current-texture, color/depth generations,
bridge/bind-group replacement, indirect-buffer readiness and reclamation,
load/store ordering, submit ordering, and compositor handoff. The first and
second refresh gates must be green without destroyed-buffer submissions.

### Priority 1 - Dense-field algorithm and memory

Objective: after production presentation is live, replace the
`surface-cell x particle` gather and optional second particle scan with a
sparse particle/source-local splat, tiled construction, or sorted cell ranges.
Correct the field budget to eight floats/32 bytes per cell and remove or share
the full scalar snapshot. Coherent solids bypass this density field entirely.

### Priority 2 - One resident lane and one neighborhood authority

Objective: remove default GPU-to-CPU-to-GPU material/pressure-interface
feedback. Keep candidate-to-force-to-grid work on the ComputeManager-owned
GPUHub lane. Build one persistent, versioned, multi-resolution neighborhood
artifact for mechanics, thermal, radiation, reaction, and contact instead of
building or bypassing independent bins and exhaustive scans.

### Priority 3 - Make two-level SS actually sparse

Objective: compact unique active nodes, replace the per-particle 4 KiB
candidate reservation with byte-bounded CSR/global arenas, publish overflow
evidence, consume cross-level candidates, and close affine/angular/reflux and
extreme-ratio invariants. Do not resume the third level until these gates are
green and measured.

### Priority 4 - Land SOL-0 and SOL-1

Objective: admit body/member/contact/shape contracts and implement an `SE(3)`
rigid lane with direct resident mesh transforms. Include rigid-motion
objectivity, exposed-area quadrature, body-aware product/topology identity, and
GPU reductions for mass, linear/angular momentum, inertia, energy, and shape
error. This is the minimum route to solids that cross a grid without becoming
lattice blobs.

### Priority 5 - Parallel resident sidecars

Objective: make pressure, thermal, reaction, radiation, retained products, and
SS work compatible with an end-to-end resident submission. Replace the serial
product scan/merge with parallel prefix/sort/free-list placement, centralize the
reaction extent law now copied into six WGSL modules, and remove per-step gas
ledger and completion fences that do not cross an authority boundary.

### Priority 6 - Coupling, deformable surfaces, topology, then scale

Objective: land SOL-2/3 contact and liquid coupling, SOL-4 persistent
material-space deformable surfaces, and SOL-5 melt/fracture topology in that
order. Begin SOL-6 orbital/chart work and broad distributed rematerialization
only after the local GPU-native solid invariants and mostly-solid scaling gate
are green.

The current append-only Schroeder plan should be split into a short active plan,
a numerical contract, and a historical status ledger. This file supplies the
solid and validation correction; implementation history should remain in
`plan/log.md`, not accumulate inside the active mathematical contract.

## Concrete Future Todos

- **SURF-0:** deterministic time-zero/refresh-1/refresh-2/final liveness tracer
  for the production main canvas.
- **SURF-1:** general main-canvas lifecycle repair across surface count,
  transparency, material order, resize/DPR, pause/play, and the whole matrix.
- **SURF-2:** versioned or double-buffered presentation resources; use fences
  for reclamation/backpressure, not routine same-queue stage ordering.
- **PROF-0:** GPU timestamps plus submit/map/allocation/pixel-liveness evidence
  under the profiling contract above.
- **FIELD-0:** source-local/tiled sparse render-field rewrite and corrected
  32-byte/cell peak budget after SURF-1 is green.
- **LANE-0:** retained interface candidates consumed by a GPU pressure/force
  stage on the ComputeManager/GPUHub lane.
- **MATRIX-0:** publish separate physics-evidence and presentation statuses for
  every named/random checkpoint, including an authoritative time-zero record.

## Questions Up For Critique

1. Should fluid render fields use source-local splats into one shared
   material/phase atlas, or sorted sparse tiles with per-material indirection?
2. Which interaction owns the persistent neighborhood build, and what exact
   error/overflow policy lets thermal and radiation request wider support
   without falling back to `N*N`?
3. Should reaction products reserve mechanics rows immediately, or accumulate
   a resident event ledger and enter state through one parallel admission pass?
4. What byte budget and truncation/error rule replaces fixed candidates per SS
   queue row, especially across extreme mass ratios and level boundaries?
5. Are exposed radiation/reaction/wet-contact weights owned by the shape
   carrier, the contact proxy, or a versioned shared surface quadrature graph?
6. Which solids remain continuum MLS-MPM bodies, which use rigid frames, and
   where is the measured switching/admission rule between them?
7. What native WebGPU surface evidence is required before a physics sequence
   can be called visually accepted when compositor and canvas capture disagree?

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
