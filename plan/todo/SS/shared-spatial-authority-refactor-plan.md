# Shared SS Spatial Authority Refactor Plan

Date: 2026-07-13 AKDT
Branch: `ss-spatial-authority-refactor`
Status: active execution plan
Integration base: recovery checkpoint `bdd3eee`

## Decision

Build the next Schroeder Simulation slice around one SS-owned, GPU-resident
spatial substrate. For every admitted spatial epoch, each authoritative
particle is classified once, emits one exact structural key, and participates
in one canonical sort/unique build. Mechanics and spatial laws consume derived
views of that generation instead of constructing independent grids, bins, or
full-scan fallbacks.

This plan supersedes:

- the old SS implementation queues in the two July 2 Fable documents;
- the CPU-first adaptive MLS-MPM execution track, while retaining its numeric
  transfer and conservation gates;
- the independent-neighbor-structure routing in the Ocean plan;
- Priority 2 and Priority 3 spatial routing in `../sol-critic.md`; and
- the recovery plan's open-ended review of the abandoned refactor branch.

It does **not** supersede the Schroeder architecture, dense MLS-MPM/Ocean
mechanics, PeerCompute/StateManager authority, coherent-solid requirements,
material and chemistry laws, rendering ownership, or numerical and visual
acceptance gates.

Do not merge or continue `gpu-resident-physics-refactor`. Port independently
proven concepts and small primitives only.

## Why This Is First

The intended Schroeder hierarchy is both the multilevel mechanics grid and the
shared law substrate. Current SS code is not yet that structure:

- the active-node path can reserve one row per particle;
- local and far candidates use particle-proportional fixed budgets;
- reaction and pressure/contact can construct private bins even when an SS
  candidate source is selected;
- thermal/radiation can fall back to exhaustive pair traversal;
- mechanics, gas, surface, and law paths can independently classify or sort
  the same particle positions; and
- the abandoned refactor rebuilt a five-word neighborhood as many as thirteen
  times in one four-substep batch.

The useful refactor direction was correct. Its integration boundary and
scheduler were not. The replacement must make the shared structure the first
real producer in the law DAG rather than adding another descriptor next to the
old builders.

## Core Invariant: One Build Per Spatial Epoch

A spatial epoch is the immutable tuple of all state that can change spatial
membership:

- position epoch;
- topology/add/remove/split/merge epoch;
- chart and chart-transform epoch;
- physical representation/native-level epoch;
- support-profile epoch;
- particle-storage/source-family generation; and
- device, lane, and lease identity.

Velocity-only writes may reuse an epoch. Position integration, topology
mutation, chart rebasing, phase/support migration, or native-level changes
invalidate it.

"Once per tick" means once per authoritative physics integration step after
membership-affecting state is frozen. A render frame may contain many physics
steps. If an iterative solver truly changes positions inside a step, it creates
an explicit micro-epoch and rebuild. Reuse across displacement is allowed only
after a conservative GPU-authored skin/displacement certificate is admitted.

Normal acceptance target:

```text
particleKeyEmissionCount == admittedParticleCount
canonicalSortUniqueCount == 1
spatialBuildCount == spatialEpochCount
spatialEpochCount == physicsIntegrationStepCount
privateLawSpatialBuildCount == 0
```

## Canonical Spatial-Epoch Data Target

The bullets below are the evolved target contract. Slice 2 implements the
directory-foundation subset as `ss-spatial-epoch.v1`: its 48-word GPU header
contains source/cell counts, identity epochs, logical live words, physical
address bounds, retained directory capacity, completion/overflow evidence,
dispatch, and cleared-word evidence. Active-node/level/chart aggregate counts,
per-arena allocation budgets, timestamps, submissions, maps, and readbacks
remain runtime/verification telemetry until a later ABI version or explicitly
versioned auxiliary evidence row adds them. They must not be inferred from a
v1 header field.

### Identity and evidence header

- schema/magic/version and build strategy;
- device, lane, lease, source-family, storage, and generation identities;
- physics tick/substep plus position, topology, chart, level, and support
  epochs;
- live particle, unique cell, active node, level, and chart counts;
- separate required, admitted, capacity, and overflow values for every arena;
- completion fence/generation state and fail-closed status;
- indirect dispatch arguments and compact GPU diagnostic counters; and
- timestamp spans, allocated/cleared bytes, submissions, maps, and readbacks.

No live count may be used as capacity. Overflow never silently truncates an
authoritative result: it emits zero indirect work or retains the previous
admitted generation.

### Canonical arrays

- one source row per particle with persistent id, source index/family, chart,
  physical native level, material/phase masks, and support-profile id;
- exact integral structural keys `(chart, level, cellX, cellY, cellZ)` with a
  stable particle-id/index tie break;
- a declared collision-free sort encoding: `bounded-atlas-u32` for admitted
  bounded chart/level extents, otherwise the exact `lexicographic-u32x5`
  fallback. The one-word fast path changes ordering cost, not five-word
  structural identity;
- stable sorted particle indices;
- compact unique cell rows;
- `cellOffsets[cellCount + 1]`, `cellMembers[particleCount]`, and
  `particleToCell[particleCount]`;
- compact parent/child or ancestor closure for multiresolution traversal;
- law-neutral aggregate structure-of-arrays for mass, volume, momentum,
  internal energy, center of mass, and material/phase/law masks; and
- an optional directory/hash view over the same unique cell table. It may not
  become a second owner or require another sort.

Structural identity is integral. Existing float descriptor rows may describe
or diagnose a generation, but they are not the unique-key authority.

### Support profiles

Each law adapter declares:

- physical radius/support rule and level range;
- chart/cross-chart policy;
- exact-near, cross-level, or aggregate-far mode;
- self, pair symmetry, and direction policy;
- material/phase/source eligibility masks;
- aggregate admissibility and error tolerance; and
- conserved quantities and compact residual evidence.

The support table must be extensible. Do not bake the abandoned refactor's
fixed eight consumer slots or fixed candidates-per-source into the authority.

## Derived Views, Not Competing Authorities

One universal widest-radius particle-pair list is prohibited. It would couple
every law to the widest support, stream irrelevant pairs through narrow laws,
and approach quadratic memory for radiation or cross-chart work.

The shared cell/hierarchy membership fans out into:

1. **Mechanics node view** - compact unique P2G/G2P grid-node stencils and
   indirect work per chart/level.
2. **Exact-near view** - direct cell-range traversal or optional byte-bounded
   pair CSR per reusable support profile. Consumers still perform the exact
   current-position law predicate.
3. **Cross-level view** - parent/child adjacency, restriction,
   prolongation, coupling, and reflux edges.
4. **Aggregate-far view** - node reductions and law-specific opening/error
   traversal for aggregate-admissible laws.
5. **Solid proxy view** - body/component-aware contact samples with equal and
   opposite impulse ownership.
6. **Render/surface view** - derived source routes and LOD only. Rendering
   never owns physics cadence, physical mass, or representation level.

Material representation/coarsening level, mechanics/timestep level, law-query
level, solid contact-proxy level, and render LOD may share charts and keys. They
remain separate decisions and authorities.

Different source families may require distinct admitted generations, but they
must use the same spatial primitives and declare their source identity. The
initial authority is the hot particle family; gas/product, rigid proxy, and
render sources follow as explicit derived or family-specific views.

## Scheduler Lifecycle

```text
admit authoritative state x_n and freeze membership-affecting metadata
  -> compute support profiles and native levels on GPU
  -> build one canonical spatial epoch
  -> run mechanics and all spatial readers against that generation
  -> accumulate forces, heat, reaction events, and state/topology proposals
  -> reduce and admit compact invariants/deltas
  -> integrate positions and commit topology once to x_(n+1)
  -> invalidate the old spatial epoch
```

Reaction products, splits, merges, and phase/support migrations are staged for
the next epoch unless a deliberately declared micro-epoch is required. No
stage may quietly rebuild merely because it is enabled or disabled.

The build is caller-encoded on the ComputeManager/GPUHub-owned lane. After
warmup it uses persistent, fence-safe double/triple-buffered arenas, cached
pipelines/bind groups, GPU clears, and live-count indirect dispatch. Normal
production execution performs no `mapAsync`, JavaScript candidate creation,
or GPU-to-CPU-to-GPU candidate round trip.

## Reversible Implementation Order

### Slice 0 - Recovery checkpoint and branch identity

- Status: complete in recovery commit `bdd3eee`.
- Preserve the verified water flow, opaque PBR refraction, resource-liveness,
  build, full-test, GPU-probe, and native visual evidence.
- Work in the linked `ss-spatial-authority-refactor` worktree.

### Slice 1 - Active plan and historical routing

- Publish this document as the concise active execution plan.
- Move superseded queues to `plan/moot` and the validated recovery decision to
  `plan/done` with provenance.
- Keep the Schroeder architecture and SOL scientific contracts active.

### Slice 2 - Working GPU cell-directory foundation

- Add the short v1 ABI plus a focused runtime module; do not append the new
  implementation to `schroederHierarchyGpu.js`.
- Implement caller-owned GPU key emission, stable sort/unique, compact cell
  offsets/members, reverse particle-to-cell mapping, counts, and fail-closed
  overflow evidence.
- Use a collision-free bounded-atlas one-word sort for current boxed scenes and
  retain exact five-word lexicographic sorting as the general path. Never use a
  hash with unverified collisions or the abandoned refactor's quadratic direct
  mode.
- Reuse a generic radix/scan/unique primitive only after isolated probes;
  rewrite occupancy WGSL for the v1 contract.
- Use the existing particle-parallel active-node rows only as a temporary
  source adapter after validating row index, admitted status, finite position,
  positive native spacing, integral chart/level, and exact `i32` cell range.
  Delete that staging once the spatial epoch owns level/topology publication.
- Run it in an isolated native probe/shadow test. No production consumer changes
  and no second hot build are accepted in normal execution.

### Slice 3 - First same-epoch production consumer

Migrate one pre-integration consumer that already reads the frozen epoch,
starting with pressure/contact broad-phase or mechanics node activation.
Prove candidate/node completeness, switch the consumer, and remove its old
lookup in the same slice.

Do not migrate reaction or thermal first: the current fused loop consumes them
after G2P has changed positions. Reusing a pre-G2P directory there would be
stale until Slice 4 moves their proposals onto immutable `x_n` or declares a
new epoch.

### Slice 4 - First-class law-DAG producer and epoch scheduler

- Add the spatial generation as an explicit read family/producer dependency.
- Make laws propose deltas against immutable membership.
- Move position and topology commits to the declared epoch boundary.
- Prove one normal build per physics step and zero disabled-stage rebuilds.
- Introduce skin reuse only after GPU displacement proof exists.

### Slice 5 - Remaining exact-near consumers

Migrate one consumer per commit after epoch ordering is explicit:

1. remaining pressure/interface and contact routes;
2. reaction candidate discovery, without changing product/topology semantics;
3. separation plus thermal conduction;
4. wider-support radiation; and
5. remaining material/interface local-law routes.

Optional pair materialization is global byte-bounded CSR by support profile,
never `particleCount * fixedBudget`.

### Slice 6 - Compact mechanics view

- Replace particle-proportional pseudo-active rows and dual active-node indexes
  with unique mechanics grid-node topology derived from the shared directory.
- Retain real P2G/G2P deposit/gather work.
- Use compact active-node indirect dispatch to eliminate avoidable full-grid
  clears/finalizes where measured and safe.
- Guard against ever treating compact node rows as particle-aligned rows.

### Slice 7 - Two-level coupling and aggregate traversal

- Keep the third level on hold.
- Close constant/affine reproduction, partition of unity, mass, center of mass,
  linear/angular momentum, internal energy, positivity, CFL/correction, reflux,
  subcycling, extreme-ratio, and chart-error contracts at two levels.
- Replace quadratic aggregate reduction and full-scan far candidates with
  compact hierarchy reduction/traversal.
- Resume a third level only after two-level correctness and GPU cost gates are
  green.

### Slice 8 - Other source families and final cleanup

- Adapt product/gas, coherent-solid proxy, sparse render, source-field, and
  surface routes where coordinates and ownership align.
- Delete fixed SS candidate queues, duplicate bins, independent sorts over the
  same particle source, implicit exhaustive fallbacks, and host feedback paths.

## Correctness Gates

- Zero missed exact-near candidates against small brute-force manufactured
  cases for every support profile.
- No duplicate, self, incorrectly directed, or asymmetrically admitted pairs.
- Deterministic unique cells and membership under particle permutation,
  workgroup/dispatch variation, and repeat execution.
- Negative-coordinate, chart-boundary/rebase, cross-level, heterogeneous
  support, phase/material, sparse/dense, and extreme-mass-ratio coverage.
- Stale device/lane/lease/storage/epoch descriptors reject fail-closed.
- Overflow cannot publish a partial authoritative generation.
- GPU-native compact reductions validate mass, center of mass, linear/angular
  momentum, internal energy, reaction stoichiometry, and far-field error.
- Variable-support transfers satisfy partition of unity and first-moment
  reproduction; split/merge preserves mass, momentum, represented volume,
  energy, material, phase, body/component, and topology identity.
- The tiny-mass two-level failure is bounded by physical CFL/cohort/conservation
  assertions, not merely by checking that particles moved.

Small brute force is a manufactured diagnostic oracle. It is not a production
CPU tree or a second solver authority.

## Residency and Performance Gates

- One canonical key/sort/unique generation per admitted spatial epoch.
- No reaction/contact/thermal/private law build when the shared generation is
  admitted.
- No production `N^2` fallback or fixed `N * candidateBudget` arena.
- No per-step `GPUBuffer` allocation after warmup; separately budget and bound
  host-side control-object allocation/caches before per-substep integration.
- Base retained bytes scale as `O(N + occupiedCells + hierarchyNodes)`; optional
  exact views scale with deliberately materialized interactions.
- Zero full particle readback and zero JavaScript hot-state reupload.
- GPU timestamp p50/p95 for key emission, sort, unique, view build, traversal,
  and every migrated law; host enqueue time is not GPU performance evidence.
- Dispatch-granular timestamp mode is instrumented/nonrepresentative because it
  splits grouped production passes. Performance acceptance requires coarse
  spans that preserve the grouped production command structure.
- Track build count, sort passes, cells/nodes, candidate visits, consumer-mask
  hits, required/admitted/capacity/overflow bytes, clears, allocations,
  submissions, fences, maps, and readbacks.
- Establish baselines on this machine before setting absolute budgets. No
  accepted slice may regress a non-target batch or visual physics FPS by more
  than 5% over three-run medians without an explicit scientific justification.

## Visual and Repository Gates

Every production-consumer slice ends with:

- focused ABI/runtime/WebGPU tests;
- `npm test` and `npm run build` when the production graph changes;
- close-spaced native water/steam, sodium/water, cesium, iron/ice, random, and
  mobile sequences at time zero, early, middle, and final checkpoints;
- opaque PBR water/refraction, visible products, water motion, surface resource
  liveness, simulation cadence, and browser-error checks; and
- ICC freshness, guard-diff, task-attempt, and handoff evidence.

## Explicit Prohibitions

- No megacommit or broad orchestrator rewrite.
- No descriptor/admission status accepted as physical completion.
- No active-node row overloaded as a particle row.
- No count/capacity conflation or silent truncation.
- No universal widest-law pair list.
- No fixed per-particle candidate reservation.
- No implicit exhaustive or host-mediated fallback.
- No reuse across an invalidated epoch without admitted GPU evidence.
- No CPU hot-state readback/reupload or JS candidate authority.
- No performance claim from host enqueue timing.
- No coupling of physical representation, law query, contact proxy, and render
  LOD authority.
- No third SS level until the two-level numerical and performance contract is
  green.

## Selective Salvage From The Abandoned Refactor

Evaluate and port concepts or focused primitives, never the final branch commit:

- exact five-word chart/level/cell structural keys;
- generation, source, device, lane, lease, and position-epoch rejection;
- separate required/admitted/capacity/overflow evidence;
- exact byte planners and persistent fence-safe arenas;
- generic GPU radix/scan/unique primitives after independent native probes;
- caller-owned encoders, indirect live-count dispatch, and GPU timestamps.

Do not port its fixed consumer slots, fixed candidates-per-source, quadratic
direct mode, packed maximal candidate CSR, multi-rebuild scheduler, or
production-incomplete consumer claims.

## Active Checkpoint

- [x] Verified recovery checkpoint preserved (`bdd3eee`).
- [x] Dedicated branch and linked worktree created.
- [x] Active/moot/done planning routes committed (`0131601`).
- [x] Generic GPU radix/scan/unique primitive committed (`9eb0d6b`).
- [x] Working GPU cell-directory foundation and native probe green (`9d48c98`).
- [ ] First same-epoch pre-integration production consumer migrated and old
  lookup removed.

## Visual-Physics Restoration Checkpoint Before Slice 3

The first production-consumer migration remains the next SS architecture
slice, but it must start from trustworthy mechanics, phase transport, render
scale, and reaction diagnostics. The recovery work below is deliberately a
baseline repair; it does not claim that a production law consumes the shared
spatial directory yet.

- [x] Capture the retained GPU upload at time zero so initial visual evidence
  cannot silently start after the first mechanics step.
- [x] Make retained render-field extraction use each particle's physical,
  `J`-adjusted radius instead of treating smoothing support as visible volume,
  with the tight conservative 3-D point-sampling bound as a sparse voxel proxy.
  The proxy is phase-weight aware so a fractional phase cannot lose the
  guaranteed half-cell contribution after weighting. It prevents an
  all-negative field, inflates under-resolved geometry to the sampling bound,
  and is not an exact physical-radius surface. Preserve the positive-radius
  legacy field path and opaque PBR/refraction draw contract.
- [x] Separate excluded-volume position projection from pair-normal velocity
  damping. Position overlap relaxation remains enabled; the new velocity
  damping control defaults to zero and remains independently executable when
  position relaxation is zero, so overlap correction does not erase water flow
  implicitly.
- [x] Count placed reaction progress from the gas-species ledger as well as
  still-active product-event rows. Placement consumes/zeros event rows, so an
  active-event count of zero is not evidence of no chemistry. Product and gas
  snapshots are reduced independently before taking the larger event count, so
  a zero product snapshot cannot mask a positive placed-gas ledger.
- [x] Make time-zero evidence provenance fail closed: a candidate must be a
  retained `webgpu-uploaded` state/thermo pair whose own metadata says
  `step=0` and `time=0`; the harness reports the source values rather than
  relabeling a later upload. Only numeric finite zero proves time zero;
  missing, null, string, boolean, array, object, and non-finite metadata do not.
- [x] Version the tagged render-field ABI as v1. Consumers that only understand
  the v0 surface-wide radius lane reject the per-particle-radius sentinel;
  retained-buffer handoff also rejects v0 or missing source schemas.
- [x] Coerce native WebGPU surface presentation to its retained
  `no-full-readback` render-field handoff, including when the caller requested
  `auto`; compact summary readback can no longer silently bypass native
  marching cubes.
- [ ] Derive gas transport from a real drag/terminal-velocity closure before
  adding fractional plateau or product-gas buoyancy. Repeatedly adding an
  uncoupled acceleration cap without drag is not an admissible substitute.

The final-code native water probe at
`/tmp/ulg-ss-spatial-visual-native-final-v2/result.json` is green at
`t=3.072 s`: all four requested retained checkpoints were captured, including
the initial scene upload at exact `step=0`, `time=0`; retained handoff and the
native visible consumer are accepted; opaque PBR refraction remains selected;
and the run reports `maxSpeed=1.08636 m/s`, `minJ=0.981526`,
`maxJ=1.000259`, zero browser/WebGPU issues, and no analysis issues. Its final
pool is broad but still visibly bead/lobe textured. A separate every-batch
sequence through `1.024 s` confirms motion while showing that the pool remains
too cohesive. The same sequence at `alpha=0.03` is only marginally wider and
still mound-like. Earlier `alpha=0`, `0.01`, and `0.02` long A/B runs sprayed or
lifted the pool. Keep `0.04` as an explicit temporary stabilizer until a
compression-only numerical term and closure-derived physical viscosity are
available; do not reinterpret it as molecular viscosity or visual acceptance.

The final-code sodium probe at
`/tmp/ulg-ss-spatial-sodium-native-final-v2/result.json` also captured its exact
time-zero upload and proved chemistry rather than merely inferring it: the
reaction gate counted nine events, and the final authoritative checkpoint
contained 15 NaOH particles (`1.87348 kg`) and four H2 particles
(`0.0472152 kg`). Sodium remains visually and numerically rejected. Aggregate
speed reaches `65.0116 m/s`, `J` reaches its `1000` cap, and the final frame is
occluded by large merged lobe/boulder surfaces. This is not primarily sparse
proxy inflation: the mounted `blob=1` path selects full physical particle
radii, the point-sampling floor is inactive for the decoded final rows, and
water positions really expand almost across the container. The coarse `96^3`
field facets and merges those physical-radius carriers; the four H2 rows alone
reach the `J=1000` cap while sampled water remains near `J=1`. A short causal
A/B rejects a preset-only damping fix: `alpha=0.04` with reaction disabled is
green (`1.17253 m/s`,
`J=0.983976..1.008039`), while the same damping with reaction enabled still
reaches `91.0991 m/s` and `J=1000`. Damping stabilizes the condensed carrier but
does not close the reaction-created gas path, so the sodium override remains
unchanged until per-phase mechanics evidence quantifies how the four cap-hit H2
rows couple energy into the condensed carrier.
At `0.256 s`, reaction-off and reaction-on controls are still near the same
total kinetic energy (`1536 J` versus `1508 J`). By `0.512 s`, reaction-off is
bounded at `2.43 m/s`, `J=1.036`, and `709 J`, whereas reaction-on reaches
`62.56 m/s`, `J=1000`, and `33,976 J` with box-spanning water. The first
physics audit therefore targets reaction-product placement/merge and its next
mechanics refresh, with pair-normal separation damping treated as a secondary
amplifier rather than the primary fix.

Visible-loop repair outranks the first production-consumer migration. Before
accepting Slice 3, close these observability/stability items in small reversible
commits:

1. [x] add compact per-material/per-phase speed, `J`, rest-volume,
   represented-volume, and cap-boundary reductions;
2. [x] publish post-placement placed/merged/unplaced product-mass provenance;
3. isolate and bound the condensed-contact energy injection between
   `0.256 s` and `0.512 s`, including a manufactured multi-step contact test;
4. keep field-resolution/radius-floor classification as a renderer diagnostic
   follow-up rather than treating it as the current explosion fix;
5. derive ambient-density drag and terminal velocity for gas-only products,
   then couple buoyancy through that closure; and
6. replace the broad fixed reaction radius with shared-SS support-surface
   contact plus a small declared hysteresis when reaction migrates to the
   canonical spatial epoch.

Item 1 is complete. The authoritative checkpoint now reduces retained
state/thermo/mechanics buffers into a fixed 7,504-byte GPU evidence table; it
maps no particle rows. Upload admission requires the exact v0 source schemas,
exact 32/48/128-byte row strides, equal particle counts and source metadata,
adequate buffer capacity, and matching slot identity when slots exist. Initial
uploads are reported honestly as metadata-coherent when no shared slot token is
available; resident outputs prove shared-slot-and-metadata coherence. The SS
represented-volume definition is
`max(V0 * max(J, 1e-6), phaseReferenceMass / restDensity)` with
`mass / restDensity` as the final positive fallback. Cap evidence is explicitly
a post-state boundary observation, using `J=1.05` for solid/Tait condensed
rows, `J=64` for generic mechanics, and `J=1000` for linearized gas.

Fresh Vulkan evidence is recorded at
`/tmp/ulg-ss-spatial-water-mechanics-telemetry-hardened-vulkan/result.json` and
`/tmp/ulg-ss-spatial-sodium-mechanics-telemetry-hardened-vulkan/result.json`.
Water is complete and green. Sodium now fails without suppressing valid partial
evidence: all 15 NaOH rows have invalid zero-volume mechanics after placement,
while all four H2 rows remain valid and reach `64.8005 m/s`, `J=1000`, and the
gas cap boundary. The next correction is therefore fail-closed product phase
resolution/placement plus a real post-reaction mechanics refresh; item 2 must
then publish placed/merged/unplaced mass through that refresh.

That correction is now complete. Reaction-table ABI v1 requires every ready
product term to resolve one positive-density target phase; phase/routing
conflicts and ambiguous multi-phase products fail closed, while the existing
phase-id-zero sentinel still permits singleton and gas-only resolution. Event
emission, compaction, and placement independently reject phase-zero,
zero-density, invalid-mechanics, and legacy/torn-stride rows. Persisted v0
reaction tables are rejected instead of bypassing the fresh builder. Reaction
state, thermo, and mechanics must also arrive as one coherent buffer set, and a
constitutive refresh after particle mutation now owns next-step mechanics.

Fresh native evidence is at
`/tmp/ulg-ss-spatial-water-product-mechanics-hardened-vulkan/result.json` and
`/tmp/ulg-ss-spatial-sodium-product-mechanics-hardened-vulkan/result.json`.
Water remains green with complete mechanics, `maxSpeed=0.156902 m/s`, and
`J=0.999948..1.000004`. Sodium still fails only the independently visible H2
speed/expansion gates: nine liquid NaOH rows now have positive rest/current
volume and zero mechanics problems, while five H2 rows reach
`89.6172 m/s`, four touch the `J=1000` gas cap, and native browser pixels pass.
Item 2 is complete. The 32-float reaction-product event ABI v1 now retains a
placement disposition and placed/unplaced mass after the source row is
consumed. A separate 32-float accumulator per product term remains GPU
resident for the whole resident batch and is read only after the final step;
it partitions direct placement, spare-slot placement, radius-capture merge,
fallback merge, subthreshold/unplaced mass, and rejected mass. Empty term rows
cannot alias term zero, rejection fails closed, and direct placement is
attributed from the exact freed parent slot rather than inferred from material
identity. Invalid consumed rows reject their full payload even if their
unplaced field is zero. Sequence diagnostics count only placement dispatches
proven by returned step evidence and only claim a post-reaction mechanics carry
when the final provenance is available. If any accumulator-bearing step lacks
evidence after submission, the entire sequence fails closed and suppresses all
final/step/reaction-summary provenance; a host-inferred count cannot certify a
shared buffer that the unproven step may already have mutated.

Fresh native Vulkan evidence is at
`/tmp/ulg-ss-spatial-sodium-placement-provenance-v1-20260713/result.json` and
`/tmp/ulg-ss-spatial-water-flow-visual-v1-20260713/result.json`. Each sodium
batch maps only 256 bytes after 256 resident steps. The first batch
partitions `0.782123461 kg` of product mass with a
`1.21e-7 kg` residual; the second partitions `0.598155338 kg` with a
`4.20e-10 kg` residual. Both report zero rejected or unplaced mass and carry
the evidence through the post-reaction mechanics refresh. This rules out lost
placement mass as the cause of the remaining visible failure. Sodium still
reaches `89.6172 m/s` and `J=1000`, with the final frame dominated by large
H2-derived lobes. A post-hardening one-batch smoke at
`/tmp/ulg-ss-spatial-sodium-placement-evidence-complete-v4-20260713/result.json`
proves all 256 dispatches returned evidence, verifies
`sourceSummaryCount=256`, reports zero rejected/unplaced mass and no
browser/WebGPU issues; it remains bad only because H2 already reaches
`J=6.6352` at `0.256 s`. The `1.024 s` water control is mechanically bounded at
`1.08636 m/s` and `J=0.996426..1.000259`; retained handoff, native visible
consumption, browser pixels, compact motion, and all automated checks pass.
Direct interval-frame inspection shows genuine descent and spreading into a
wider skirt, but the final surface remains a faceted, tiered cohesive mound
rather than accepted liquid flow. Item 3 is next: isolate the H2
expansion/contact energy injection before changing the renderer or claiming
visual acceptance.

Do not widen the reaction radius, globally change the water damping default,
or treat a deliberately relaxed diagnostic threshold as scientific acceptance.
