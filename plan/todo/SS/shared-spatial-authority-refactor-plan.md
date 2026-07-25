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

Migrate the remaining consumers as one integrated slice and one final commit
after epoch ordering is explicit:

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
- Preserve enough deterministic node identity for a later derived
  `(node, material/body/mechanical-field)` view. Slice 6 compacts topology; it
  does not claim that the current single velocity field solves mixed
  solid/liquid cells.

### Slice 7 - Two-level coupling and aggregate traversal

- Status: implementation and precommit release verification complete in the
  Slice 7 staged snapshot; the immutable commit and remote-ref receipts are
  recorded out of band after this document is committed.
- Keep the third level on hold.
- Close constant/affine reproduction, partition of unity, mass, center of mass,
  linear/angular momentum, internal energy, positivity, CFL/correction, reflux,
  subcycling, extreme-ratio, and chart-error contracts at two levels.
- Replace quadratic aggregate reduction and full-scan far candidates with
  compact hierarchy reduction/traversal.
- Resume a third level only after two-level correctness and GPU cost gates are
  green.

### Slice 8 - Other source families and final cleanup

- Status: implementation and non-performance precommit verification are
  complete in the staged Slice 8 snapshot. The frozen-source paired performance
  campaigns, ICC release gates, and immutable Git/ref receipts close the slice.
- Adapt product/gas, coherent-solid proxy, sparse render, source-field, and
  surface routes where coordinates and ownership align.
- Delete fixed SS candidate queues, duplicate bins, independent sorts over the
  same particle source, implicit exhaustive fallbacks, and host feedback paths.
- Product placement/topology transition, compact gas authority, matched-time
  thermal transfer, successor render/source-field/surface routes, and
  host/worker continuation now use authenticated source families wherever an
  authoritative replacement exists.
- A far-render carrier is a spatial aggregate proxy, not coherent-solid body
  authority. Body/material frame, member, inertia, connectivity, and
  rest/material-space work remains owned by `plan/todo/sol-critic.md`.

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
- [x] First same-epoch pre-integration production consumer migrated and old
  lookup removed.

### Slice 3 implementation checkpoint - 2026-07-15

The first-consumer implementation is mounted but the original acceptance box
above remains open. Standalone and fused single-step P2G now bind the retained
canonical `ss-spatial-epoch.v1` directory and use its reverse particle-to-cell
map for native-level admission before integration. This is a real mechanics
consumer, not descriptor-only plumbing. The same generation is released only
behind the consumer queue fence, including exceptional exits, and authoritative
two-level execution skips the otherwise unused directory build.

The consumer validates the complete generation identity in WGSL: generation,
storage, position, topology, device, lane, lease, source family, physics
tick/substep, chart, level, and support epochs. The host rejects released,
wrong-schema, overlay, and cross-device generations. A rejected host binding,
stale/corrupt GPU header, or corrupt per-particle reverse-map entry deliberately
falls back to the retained level-assignment row so provenance loss cannot turn
into a zero-physics frame. Telemetry now distinguishes that observed host
fallback from the shader decision: normal hot-loop execution performs no
readback, so `gpuAdmissionObserved=false`, GPU fallback remains unknown, and no
JavaScript status may claim that shader admission was observed.

This does **not** yet satisfy “old lookup removed”:

- G2P and the P2G safety path still retain particle-parallel level assignments;
- phase-volume overlays and multi-step immutable reuse explicitly fall back
  because they do not yet prove the same frozen membership epoch;
- the pressure/interface exact-near shader is staged, not mounted in the
  interactive production route;
- its current conditional host path creates a separate canonical-format
  directory inside the consumer instead of borrowing this generation; and
- the exact-near consumer has only fake-device contract coverage. Native shader
  execution, brute-force candidate completeness/parity, and performance are
  still unproved.

Therefore the next architecture slice is to hoist the admitted directory to an
explicit law-DAG producer/lease, thread that same immutable generation through
pressure/interface exact-near, and delete the pressure-local directory builder
after a native brute-force oracle passes. Add a compact GPU admission evidence
lane before removing the level-assignment safety path. Only then close the Slice
3 acceptance box and proceed to reaction/thermal epoch scheduling.

Evidence at this checkpoint:

- `/tmp/ulg-ss-slice3-p2g-native-proof.json`: native WebGPU exact parity with
  legacy P2G (`8 kg`, max absolute difference `0`), canonical level authority
  observed, and exact fallback for stale identity, invalid header status, and a
  corrupt reverse-map entry; zero validation or uncaptured errors.
- `npm run probe:schroeder-spatial-epoch`: `35/35` native directory checks pass,
  including exact/bounded CSR parity, overflow rejection, variable-count arena
  reuse, and clean compilation/validation.
- Focused ABI/runtime closure: `335/335` tests pass. Full `npm test`:
  `1226/1229` pass, zero failures, three opt-in long-horizon skips. Production
  build passes with only the existing large-chunk warning.
- Fresh native visual artifact:
  `/tmp/ulg-visual-sanity-matrix/codex-slice3-final-p2g-20260715/summary.json`.
  Sodium/water remains rendered and evolving at all captured times with zero
  browser warnings/errors and zero surface flicker/disappearance findings;
  nine reactions and real NaOH/H2 populations are present. It is not a physics
  acceptance: the known hydrogen-rise check fails, max speed reaches
  `44.9278 m/s`, and minimum `J` reaches `0.416929` by `0.512 s`.

### Slice 4A implementation checkpoint - shared exact-near borrower - 2026-07-15

The staged pressure/interface exact-near path can now consume the exact
caller-owned `ss-spatial-epoch.v1` generation. Supplying a generation performs
zero pressure-local directory builds, zero private-bin builds, and no borrower
release. The generation owner remains the only release authority and captures
the final fence after every same-device consumer submission. Runtime ownership
is authenticated by an internal immutable `WeakMap` record; the public
execution descriptor no longer exposes its arena, execution token, or radix
lease. A submitted arena cannot be discarded or reused before its fence, and
clone, field-transplant, foreign-runtime, wrong-device, unsubmitted-fence, and
double-release attempts fail closed. A supplied generation that is stale,
released, already release-scheduled, cross-device, schema-invalid, layout-torn,
source-torn, query-profile-torn, or missing the complete
state/thermo/identity/interface epoch family fails closed to zero contact rows.
It cannot silently rebuild a private lookup or fall through to the CPU solver.

The generic spatial-directory source now publishes a frozen exact-near query
profile for the same active-node buffer. Borrow admission requires exact
object identity plus storage generation, physics tick/substep, position,
topology, chart, level, and support epochs; exact lexicographic `u32x5` sort and
directory layout; positive generation/lease/source/build identity; the
canonical `schroeder-active-node-particles` source family; and the same WebGPU
device. Material-interface provenance additionally proves the exact particle
state, thermo, and identity buffers consumed by the shader.

The exact-near shader no longer selects the first loosely matching policy.
For every compatible ordered policy it:

- matches material and phase as one endpoint, preventing cross-side matches;
- applies exact domain constraints during candidate selection;
- rejects non-finite/inactive/zero-mass rows before scoring;
- traverses the sparse canonical CSR directory across the declared levels;
- rejects the entire output row if a queried CSR offset or member is malformed,
  rather than retaining a partial pair;
- retains the two best candidates per endpoint so identical material/phase
  contacts can still select distinct particles; and
- selects one deterministic distinct pair by score, domain identity, particle
  index, and finally policy index.

The pressure stage and local same-device lane now declare
`schroeder-spatial-epoch` as a conditional read family and forward the exact
generation object. The inline stage uses the admitted Schroeder particle
storage upload rather than a stale raw upload. Stage evidence, outer
orchestration, and lane completion each independently require the selected
borrowed authority, zero private/fixed/exhaustive builds, no fallback, and an
exact required `queue-work-completed` fence. Contradictory nested/top-level
completion statuses fail closed. Raw generations remain excluded from the
worker bridge because GPU buffers and arena functions are not
structured-cloneable and a worker-owned `GPUDevice` cannot consume a
main-thread generation.

The final force shader consumes the exact packed policy ordinal produced by
exact-near. It requires exact authoritative status `2`, an integral in-range
token, matching material/phase endpoint, and matching oriented domains before
recomputing contact pressure. Malformed authoritative rows cannot fall through
to legacy selection. Full force-row readback derives gas/contact aggregates
from the authoritative GPU rows; a total-pressure-only ABI leaves those split
aggregates unknown instead of inventing them, while explicit fail-closed rows
remain known zero.

Native evidence is in
`/tmp/ulg-schroeder-spatial-exact-near-probe.json`. Sixteen manufactured cases
pass `197/197` checks across `81` submissions against an independent
direct-particle brute-force oracle. Coverage includes the expected basic row
`[0.5, -3, ~1.2, 2, 11, 37, 1, 1]`, negative coordinates, levels `-1..1`, the
cylindrical corner bound, same-material/different-phase endpoints,
same-material/same-phase exact domains, policy-order invariance, a later wider
support policy, cross-side material/phase rejection, non-finite/inactive
particles, a stale generation header, and an invalid active source row. A
three-cell positive control emits
`[0.1000000089, -2, 1, 2, 221, 231, 1, 1]` with contact pressure `1`; corrupting
only one queried internal offset or one decoy member leaves a valid pair that
the old partial-`continue` implementation would emit, while the hardened shader
returns an exact eight-word zero row and exact zero contact pressure. Shader
compilation, validation, internal, out-of-memory, uncaptured, page, and device
loss channels are empty. Each case has exactly one producer directory build,
zero borrower/private builds, zero bins, and one owner release after the final
readback.

Repository verification at this checkpoint is also green: the focused
spatial/pressure/stage suites pass `288/288`; full `npm test` passes
`1246/1249` with zero failures and the three existing opt-in long-horizon
skips; and `npm run build` passes with only the existing large-chunk warning.

This is not an interactive production-mount claim. The mounted pressure stage
currently runs later on a dedicated worker/device, after the main-thread
hierarchy owner has captured its release fence. It therefore cannot borrow the
live generation safely. Mounting requires either moving pressure/contact into
the generation owner's same-device immutable-epoch scope or making the worker
own both the producer and all borrowers.

Two evidence gaps also remain explicit:

1. The v1 GPU directory header authenticates generation and epoch identity but
   not chart, min/max level, base spacing, or every active row's declared
   `baseSpacing * 2^level` relationship. The current query profile is a frozen
   producer-side host contract. Production mounting needs an ABI/evidence lane
   or a key-stage mismatch counter that authenticates this query geometry on
   the GPU and fails the generation closed.
2. Normal execution intentionally performs no header readback, so telemetry
   reports `gpuAdmissionObserved=false` and
   `gpuFallbackObserved=null`. A compact GPU admission evidence lane is still
   required before calling shader admission observable or deleting the
   remaining level-assignment safety path.

At the Slice 4A checkpoint, the pressure-private staged builder remained
available only when no shared generation was supplied. It was not reachable as
fallback from a rejected supplied generation and was scheduled for deletion
when the production owner scope mounted. Slice 4B below records that deletion.
Because Slice 4A did not alter the mounted interactive render or physics route,
the native semantic/lifecycle probe was its proportional runtime gate and the
Slice 3 visual matrix remained its mounted-route evidence.

### Slice 4B implementation checkpoint - mounted owner scope and query evidence - 2026-07-15

The first mounted same-device pressure/interface borrower is now real, but it
remains deliberately diagnostic-only. The scene produces one non-published
material-interface sample from the immutable pre-integration particle buffer
family at the first substep of a resident batch. The hierarchy then builds the
canonical spatial generation, submits pressure/interface exact-near against
that same generation, submits resident mechanics without applying the returned
force rows, and lets the generation owner capture the final consumer fence.
Force rows cannot mutate mechanics in this slice; the telemetry reports
`forceRowsAppliedToResidentMechanics=false` and all scientific/physics
validation flags remain false.

Adapter 2 now carries GPU-authenticated query geometry rather than relying on a
host-only profile. A four-word live evidence tail proves chart id, minimum and
maximum level, and base spacing. The key pass validates every active row's
chart, exact integral level, finite positive native spacing, and exact
`baseSpacing * 2^level` relationship. Exact-near refuses a generation unless
its source, execution, authenticated query profile, and query-evidence object
are the same retained authority. Header word 31 remains an intentional zeroed
reserved word; maximum level is derived and checked as
`minLevel + levelCount - 1`.

The pressure-local canonical SS producer has been deleted. A supplied
generation is borrowed-only and fail-closed: it performs zero pressure-local
directory builds, zero private particle-bin builds, zero fixed candidate
builds, and zero exhaustive scans. Post-return validation failures now retire
all pressure temporaries and retained force/gas rows. Normal owner-scope
temporaries, the ephemeral material-interface field, force rows, gas rows,
owned level assignment, and owned sparse overlay index retire behind the one
generation-owner release fence. This is one owner release fence, not a claim
that the whole resident step performs only one queue fence.

The mounted diagnostic cadence is bounded. It attempts at most one compact
interface sample at resident-batch substep zero, publishes explicit attempted,
eligible, submitted, borrowed, and compact-readback counts, and marks the batch
non-readback-free when that compact sample maps. Later substeps report
`not-requested-at-this-cadence`. If a carried phase-volume assignment overlay
already owns level selection, adapter 2 is not yet geometrically sufficient;
the scene performs zero diagnostic reads and records
`phase-volume-assignment-overlay-requires-overlay-capable-exact-near-adapter`
instead of building a doomed field or a second directory. Overlay support is a
future ABI/view slice, not grounds to suppress the admitted overlay.

Mounted first-batch sodium/water evidence on the canonical HTTPS server is
green for this narrow claim. An eight-substep batch produced exactly one
eligible/submitted/borrowed sample and seven cadence skips. The sample carried
136 interface rows, current-particle-epoch provenance, adapter-2 exact-near,
one shared generation build, zero consumer directory/private/fixed/exhaustive
builds, delegated consumer-fence evidence, captured generation-owner cleanup,
and one compact readback. The batch took `1245 ms` on the cold browser run;
the sampled interface build accounted for `53.3 ms`. A separate continued
overlay-on batch took `122.9 ms`, performed zero owner diagnostic attempts or
readbacks, and exposed the expected skip reason. These are single-run
diagnostic timings, not accepted p50/p95 performance baselines.

The inspected frame at
`/tmp/ss-slice4b-mounted-8step-cross-off.png` shows both sodium and water,
opaque refractive water rather than alpha transparency, live native rendering,
and no disappearing geometry. The probe reported zero console, page,
validation, or uncaptured WebGPU errors. This visual sample validates mounted
render-path non-regression only; it does not validate reaction outcome or the
diagnostic pressure force physically.

Verification at this checkpoint:

- focused ABI, hierarchy, stage, pressure, render, and scene suites:
  `426/426` pass;
- native spatial producer probe: `36/36` pass;
- native exact-near/brute-force probe: `310/310` pass;
- full repository suite: `1256/1259` pass, zero failures, with the three
  existing opt-in long-horizon skips; and
- `npm run build` passes with only the existing large-chunk warning.

The active “first consumer migrated and old lookup removed” checkbox remains
open. P2G/G2P still retain the level-assignment safety authority, force rows are
diagnostic-only, reaction and thermal are intentionally unmigrated, and
overlay-capable exact-near is absent.

The immediate follow-on is **Slice 4C - hierarchy artifact ledger and transfer
leases**. The hierarchy creates roughly thirty retained GPU artifact families,
while its current final cleanup owns only level assignment, sparse overlay
index, the spatial generation, and pressure/interface resources. Fine active
nodes and hierarchy aggregate nodes transfer to rendering; adopted particle
buffers transfer to continuation; level-update and gas-cell rows require
explicit next-tick leases. Law queues/indices, neighbor spans and counters,
cross-level intermediates, non-render aggregates, far-law intermediates,
migration/proposal/apply/allocation rows, materialization rows, and diagnostic
buffers are same-tick temporaries that need one idempotent hierarchy-owned
ledger and retirement behind the final owner fence. Complete Slice 4C before
long-horizon performance or lifecycle-complete claims.

### Slice 4C - hierarchy artifact ledger and transfer leases

Implementation checkpoint, 2026-07-15: the hierarchy now creates one thin
artifact ledger per invocation before its first retained allocation. The
ledger canonicalizes raw `GPUBuffer` identity, records descriptor aliases on
that physical record, classifies caller-injected artifacts as borrowed, and
seals before generation retirement. Every hierarchy runner result is
registered immediately. Untransferred owned buffers retire exactly once after
the existing generation-owner fence; a failed post-transfer handoff reclaims
its leases on that same fence. Multi-buffer grouped destructors fail closed
when they cannot prove sibling isolation.

| Artifact class | Generation owner | Transfer owner | Retirement point |
|---|---|---|---|
| Assignment/index, queues, spans, counters, cross/far intermediates, non-render aggregates, phase/storage rows, and diagnostics | Hierarchy ledger when locally created | None | Exactly once after the generation-owner fence |
| Fine active-node and hierarchy aggregate-node buffers | Hierarchy ledger | Render executor | Executor replacement, render disable, or bridge clear after submitted use |
| Phase level-update buffer | Hierarchy ledger | Next-tick overlay cache | Consuming tick, cache replacement, or generation invalidation |
| Gas-cell buffer | Hierarchy ledger | Pressure-interface state | Intermediate-step discard or persistent-state replacement/clear |
| Adopted particle state/thermo/mechanics/identity buffers | Hierarchy ledger | Resident continuation | Continuation cleanup |
| Caller-injected artifacts | Caller | Caller | Never retired by the hierarchy |
| Spatial epoch arena and pressure-owner resources | Existing specialized owner | None | Existing owner cleanup contract |

Render-family release is scoped, so preserving one retained render buffer no
longer preserves an unrelated sibling. Overlay and gas publications carry
one-shot release callbacks and swap acquire-new-before-release-old. The scene
preserves the currently published gas buffer across resident-execution
replacement, while discarded intermediate substeps release their unpromoted
gas imports. Native render executors destroy their batch uniforms, release
their render leases, and explicitly transfer ownership of a reused camera
uniform across executor replacement. Adopted caller buffers keep false
ownership flags through resident continuation cleanup.

Slice 4C verification is complete. Direct regressions cover physical and
cross-family aliases, fence rejection, destroy failure isolation, partial
continuation failure with per-resource finalization, borrowed materialization,
success retirement, post-transfer catch reclamation, asymmetric render
preservation, intermediate gas release, one-shot overlay/gas cache release,
and executor camera ownership. The current hierarchy suite passes `139/139`; the earlier
combined hierarchy/ledger/resident/scene lifecycle gate passed `373/373`, and
the adjacent spatial, compaction, cross-level, demo, native-resource, and
render-ownership suites passed `113/113`. The final full repository suite
passes `1279/1282` with zero failures and the three existing opt-in
long-horizon skips. `npm run build` passes with only the existing large-chunk
warning.

Eight focused native-browser lifecycle gates pass. Four prove scene-local
render-LOD consumption, following-tick phase-volume feedback, water-to-steam
no-full-readback diagnostics, and same-device adopted-storage continuation.
Four more run real admitted split, merge, coarsen, and refine chains through
materialization/count/adoption or compaction with mass and count assertions.
The identity-aware materialization kernel uses ten storage bindings. The four
direct fixtures had requested a default device capped at eight even though the
adapter exposes sixteen, so WebGPU discarded the invalid command buffer and
left zero rows. They now use the same resident-SPH device descriptor as
production, and the runner rejects an explicitly undersized device before any
allocation instead of falsely reporting `submitted`. Identity-family admission
remains fail closed; no compatibility check was weakened and the final fixture
path performs no full particle readback.

The mounted long-horizon artifact at `/tmp/ulg-slice4c-mounted.json` is `good`
with no issues. Eight batches of 128 substeps advanced the source step from
128 through 1024. All eleven captured frames are nonblank, native browser-frame
pixel validation passed, and there were zero browser-console or WebGPU issues.
Direct inspection of initial, middle, final, and composited frames found the
H2O liquid geometry continuously visible with physical deformation and no
flicker or disappearance. The final 152 live particles remained bounded at
`0.9950 <= J <= 1.0025` and `0.6321 m/s` maximum final speed. The observed
`1579.6 ms` mean batch time is evidence for this deliberately heavy visual
run, not the accepted throughput baseline.

The bounded before/after performance artifacts are all gate-passing with zero
estimated readback bytes per step and zero browser issues. At 1k particles the
stable/live pair measured `58.14/60.61` resident steps/s. Two order-reversed
10k pairs measured stable/live as `21.83/15.65` and `15.67/20.92` steps/s;
averaged across both orders this is `18.75/18.28` steps/s, a `2.5%` live
difference within the observed run-order variance. Mean 10k completed-stage
time differs by `1.9%` (`54.8/55.85 ms`), while live ledger clear/publish
telemetry remains at or below `0.1 ms`. There is no consistent performance
regression attributable to the ledger.

Reaction and thermal outputs, the spatial arena, pressure-owner resources,
mechanics application of diagnostic interface rows, and the overlay-capable
exact-near adapter remain deliberately outside this slice.

### Slice 4D - immutable spatial-epoch transaction and stale-reader quarantine

Implementation-complete checkpoint, 2026-07-15; final repository tests, build,
and native exact-near verification are recorded below. The first live
spatial-epoch transaction
freezes one exact pre-integration `x_n` authority before any declared reader is
admitted. The frozen identity includes the selected generation object,
same-device active-node/directory buffers, the complete
state/thermo/identity/mechanics source-buffer family, storage generation, and
physics/topology/chart/level/support epochs. Admission fails closed if that
identity mutates, if a reader supplies a different buffer object or device, if
the generation no longer proves exactly one canonical build and sort/unique,
or if a read is attempted after commit.

The mounted order is explicit: mechanics P2G precedes G2P, and both required
mechanics readers must be admitted before the reader set can seal. The optional
pressure/interface exact-near reader is admitted before P2G only after a
current-epoch preflight proves the shared adapter/query geometry, nonempty
interface field, numeric pressure source, exact source-buffer provenance, and
an interface coupling that can actually solve. A field with no ready surface
or force coupling now skips the optional pressure stage and reader instead of
poisoning an otherwise valid mechanics transaction. The fused mechanics path
authenticates P2G and G2P before encoding its combined submission; the unfused
path authenticates each immediately before its corresponding kernel. The
transaction mounts only for the same-call, internally built, single-level
level-assignment -> active-node -> generation chain and a transaction-aware
resident runner. Injected generations and authoritative two-level mechanics
remain unsupported rather than being assigned provenance they cannot prove.

After G2P, pre-integration SS law queues and neighbor-candidate views are
quarantined from the unmigrated reaction path. Nested reaction options cannot
reintroduce them. Thermal and reaction remain legacy post-integration
consumers in this slice, and their private-build or exhaustive-traversal work
is counted explicitly rather than mislabeled as canonical SS work. The
transaction seals proposals, commits the retained next-particle buffer family
once, and schedules release behind the generation owner's final-consumer
fence. Settlement is retained in the compact transaction and generation
summaries. A rejected or failed owner fence leaves the transaction
release-blocked and retryable; abort cannot be overwritten by an asynchronous
release completion.

Sustained verification deliberately invalidated two early false positives.
First, the original two-step artifact did not exercise the three-slot direct
spatial arena. `/tmp/ulg-slice4d-ss-visual-water.json` later showed that each
64-step batch mounted only its first three transactions and silently continued
with 61 `schroeder-spatial-epoch-transaction-not-selected` rows. Across four
batches only `12/256` ticks built, sorted, committed, and scheduled release;
`244/256` bypassed the canonical transaction. The generation owner now tracks
live generations per retained runtime. On arena exhaustion it waits only for
an already-scheduled owner-release promise, retries the exact frozen source
epoch, and advances the generation id only after authenticated submission. An
arena with no releasable owner fails closed, and the hierarchy rejects any
unresolved backpressure before resident mechanics can run. This is bounded
flow control, not authority reuse: every changed position epoch still receives
a fresh generation and transaction.

Second, an intermediate benchmark left phase-volume migration enabled. Its
admitted assignment overlay is intentionally unsupported by this single-level
transaction, so its incomplete coverage is evidence that the overlay guard
worked, not valid transaction-throughput evidence. The earlier
`/tmp/ulg-slice4d-performance-current.json` also lacked complete per-tick
transaction coverage and reported final-stage rather than complete-batch
throughput. Both results are invalidated. The accepted benchmark explicitly
disables phase-volume migration, law queues/candidates, cross-level coupling,
and the unmigrated reaction/thermal laws; it does not claim those paths have
been migrated.

The explicit-Vulkan sustained artifact at
`/tmp/ulg-slice4d-transaction-sixty-four-telemetry.json` proves rollover of the
three-slot arena. One 64-step batch reports 64 generation summaries and 64
transactions, generation ids `1..64`, 64 distinct physics ticks and position
epochs, and 64 `release-scheduled` states. Totals are 64 directory builds, 64
sort/unique passes, 64 commits, and 64 release schedules, with zero private
canonical builds, reader rejects, or stale-law forwarding. The first three
generations acquire immediately; the remaining 61 each perform one bounded
owner-release wait (`295.2 ms` total in that visual run). All four frames are
nonblank and there are zero browser, WebGPU, or visual-surface issues.

The post-fence release-lifecycle smoke at
`/tmp/ulg-slice4d-release-settlement-smoke.json` advances eight distinct
generation/tick/position identities through exact `released` state. Every
generation has one release attempt, zero release failures, and the transaction
ledger has one schedule and one release with zero retries. All four frames are
nonblank with zero browser/WebGPU/surface issues. The artifact's overall
analysis is `bad` only for its unrelated `no-positive-displacement` motion
threshold, so it is accepted solely as release-settlement evidence and is not
presented as a motion or visual-physics pass.

The final post-fence visual rollover artifact at
`/tmp/ulg-slice4d-final-visual-64.json` executes four 16-step batches. All
`64/64` transactions and generations settle as `released`, each transaction
records exactly one release and zero retries, and generation ids remain
contiguous across batches (`1..64`). Seven early/middle/late native-surface
frames are nonblank, manual inspection finds the water geometry continuously
present with no flicker, native browser-pixel validation passes, and no browser
issue is reported. The aggregate remains `bad` only because the no-full-readback
surface-summary heuristic labels the first three batches' intentionally absent
CPU surface rows as disappeared; the GPU consumer input and captured native
surface remain visible, so this is not accepted as a rendering failure.

After adding the final artifact-ledger identity gate,
`/tmp/ulg-slice4d-artifact-ledger-identity-smoke.json` independently aligns the
transaction, spatial generation, and bound ledger identities as `1..8`. All
eight release and ledger settlements are complete and safe, with no page,
browser, or runtime errors; all four captured frames are nonblank and native
browser-pixel validation passes. The separate hierarchy-generation field is
still `0` by design in this same-level run and is not substituted for the
bound spatial-generation identity.

The first transaction-complete throughput artifact was
`/tmp/ulg-slice4d-performance-transactional.json`, but its gate did not yet
prove per-transaction rather than aggregate exact-once counters, release-hook
coverage, or hierarchy-artifact retirement. It is retained as developmental
performance evidence and is superseded for acceptance by
`/tmp/ulg-slice4d-performance-transactional-ledger-final.json`. Both the 1,000
target (`1,024` actual) and 10,000 target (`9,826` actual) execute three
64-step batches. Each final scenario records `192/192` mounted, uniquely
aligned, and released transactions, exact one-per-tick build/sort/seal/commit/
release counters, `192/192` owner-release hooks, and `192/192` spatial-generation-
bound artifact-ledger settlements. Both have zero release retries, reader
rejects, private canonical builds, stale-law forwarding, legacy private builds,
legacy exhaustive traversal, ledger blockers, failed destroys, unsafe retained
ownership, estimated readback bytes per step, or browser issues. Complete-engine
throughput is `162.64` and `146.45` steps/s, respectively; both scenario gates
and the suite gate pass. These values establish the strict post-fix baseline,
not a proven before/after regression comparison.

An apparent exact-near stall during this checkpoint was isolated to headless
Chromium selecting SwiftShader. The identical mounted buffers and shader
complete on Chromium 148 and 150 with Vulkan on the RTX 5060 Ti. The mounted
directory is small and valid (88 interface elements, 17 particles, nine
occupied cells, monotonic CSR offsets, ordered keys, and members `0..16`). The
exact-near shader has bounded binary-search and sparse-prefix loops with strict
cursor-progress guards. The final explicit-Vulkan native oracle artifact at
`/tmp/ulg-slice4d-exact-near-final.json` passes `310/310`, with no unsatisfied
checks or page errors; those guards are defensive hardening, not a claim that
they fixed SwiftShader. Native/performance probes select Vulkan by default,
and SwiftShader runs are not accepted as native GPU or performance evidence.

Final verification of the live tree is complete:

- the final focused hierarchy-ledger, scene-settlement, benchmark, and native-
  surface identity selection passes `214/214`; earlier focused epoch,
  transaction, pressure, resident-step, and lifecycle selections also pass;
- full `npm test` passes `1,342/1,345`, with the remaining three tests explicitly
  opt-in skips and zero failures; and
- `npm run build` completes successfully (153 transformed modules; the existing
  large-chunk warning remains non-fatal).

The broad explicit-Vulkan desktop matrix at
`/tmp/ulg-visual-sanity-matrix/codex-slice4d-epoch-transaction-desktop-vulkan-20260715`
is SS-off renderer/regression evidence only: its URLs omit `ss=1`, effective SS
telemetry is inactive, and its seven scenarios contain zero transaction
summaries. It nevertheless captures 72 nonblank frames across all four
standard presets and three deterministic random pairs, with zero
browser/WebGPU warnings or errors, zero surface/depth-order issues, and the
native surface consumer selected throughout. Manual early/middle/late
inspection found continuously visible opaque-refractive water, visible
fluorine/product gas, advancing geometry, and no flicker or disappearance.

Separate active-SS visual probes cover desktop water/iron/sodium/cesium,
deterministic Ba/Pb, and 390 x 844 DPR-3 mobile sodium. Across those artifacts,
all 2,496 completed ticks mount a transaction with zero not-selected rows or
reader rejects; 39 captured frames are nonblank with zero browser/WebGPU or
surface issues. Their capture-time rows are `release-scheduled`, while exact
post-fence settlement is supplied by the smoke and throughput artifacts above.
These shorter probes do not erase the longer-horizon physics failures: water
cycle steam still does not rise and condense, iron/ice does not yet cool iron
or raise steam, desktop sodium/water still exceeds its speed and minimum-`J`
bounds despite nine reactions and visible products, and cesium/fluorine still
reports zero retained reaction events despite final CsF product rows. Those are
physics and diagnostic-restoration debts, not Slice 4D transaction regressions.

Reaction and thermal remain unmigrated and diagnostic pressure rows remain
unapplied. Any future optimization that fuses an active-SS multi-tick command
stream must still create a distinct generation and transaction after every
G2P position commit; it may not reuse one generation across position epochs.
Slice 5 retains remaining pressure/contact, reaction, separation/thermal,
radiation, and material/interface exact-near migrations. Slice 6 retains the
compact unique mechanics-node view. Slice 7 retains phase-overlay/two-level
parent-child construction and aggregate traversal. Slice 8 retains other
source families and duplicate-builder/fallback cleanup. Skin reuse remains
prohibited until a GPU displacement certificate exists.

### Slice 5 - Integrated exact-near consumer checkpoint, 2026-07-16

Slice 5 is implemented as one transaction boundary rather than five partial
sub-slices. Every enabled exact-near reader now receives an authenticated view
or traversal of the same immutable `ss-spatial-epoch.v1` generation before
P2G/G2P changes position or topology. Mechanical contact/pressure/interface,
reaction discovery, separation, conduction, wider-support radiation, and the
remaining local material/interface path all publish proposal artifacts before
the single resident commit. Reaction and thermal application consume those
canonical proposals without rebuilding a private directory or forwarding a
stale post-G2P lookup.

The scheduler owns a declared reader set, support-profile identity, finalized
per-consumer receipts, proposal sealing, commit, release, and hierarchy-ledger
retirement. Incomplete canonical inputs, cross-device or stale identities,
wrong support profiles, counter overflow, and corrupt headers fail closed.
The migrated path reports zero private spatial builds, fixed-candidate builds,
and exhaustive production scans. The queue-completion fence now covers the
whole submitted resident sequence instead of preceding reaction/thermal
sidecars. A plain production `?ss=1` entry point defaults to this supported
single-level Slice 5 boundary; cross-level coupling, phase-volume migration,
legacy law queues/candidates, and two-level mechanics remain explicit opt-ins
for their later slices. Explicit overlay use is still rejected rather than
silently suppressing or reinterpreting its authority.

Exact-near query evidence grew from four to six words so the generation
authenticates its occupied-level mask. Traversal skips unoccupied levels and
uses nested level/x/y-bounded lower/upper searches rather than restarting every
prefix search across the full directory. Candidate and accepted-pair evidence
is accumulated per particle before one bounded atomic flush, eliminating the
original per-pair global contention. Conduction and radiation share one fused
physical traversal while retaining distinct support receipts and evidence;
uniform active temperature is an exact zero-delta fast path, not a material
special case.

Stable explicit-Vulkan performance evidence is in
`/tmp/ulg-slice5-performance-ss-final-stable-10k.json`. At 9,826 realized
particles with mechanics, pressure, thermal, reaction, and viscosity enabled,
the complete-engine rate is `89.2857 steps/s` and the suite gate passes. This
is stable against the preceding ranged-search run (`89.0001 steps/s`) and is a
large recovery from the initial contended Slice 5 result (`31.7 steps/s`). The
separate instrumented campaign
`/tmp/ulg-slice5-performance-ss-final-fenced.json` passes at 1,024 and 9,826
particles with `queueFenceStatus=complete` for both; its lower rate is not used
as the throughput claim because the requested fence deliberately serializes
measurement.

Repository verification after the ABI-guard correction reports `1377/1380`
tests passed, zero failures, and the three existing opt-in long-horizon skips.
The production Vite build passes with only the existing large-chunk warning.
Focused scheduler, consumer, shader, settlement, and native-surface suites are
green. The WebGPU uniform guard now validates the generated 144-byte canonical
thermal WGSL directly instead of comparing it with the 112-byte legacy source
template.

Desktop and 390 x 844 DPR-3 touch/mobile matrices each ran all four standard
presets plus deterministic Ba/Pb, Bk/Lr, and Fr/Fe pairings with native WebGPU,
`ss=1`, and retained initial/early/middle/final captures. Across 14 runs and 144
PNG frames, every requested renderer matched; there were zero browser-console,
WebGPU, blank-frame, geometry-disappearance, or visual-surface lifecycle
issues. Direct inspection shows opaque refractive water flowing across time,
persistent iron/ice contact without flicker, sodium/water and product surfaces,
visible moving fluorine with a distinct CsF product region, and all random
pair surfaces retained. Artifacts are under
`/tmp/ulg-slice5-visual/slice5-final-desktop-fixed` and
`/tmp/ulg-slice5-visual/slice5-final-mobile`.

The matrices intentionally continue to report the same pre-Slice-5 physics
debts already recorded above: water-cycle steam does not rise/condense, iron
does not cool enough in the quench interval, sodium/water reaches the existing
speed and minimum-`J` bounds, and cesium/fluorine product rows still outpace the
retained reaction-event diagnostic. These are not hidden as passes and were
not changed with per-material workarounds; they remain separate physics and
diagnostic closure work after the shared spatial-authority migration.

### Slice 6 - Compact mechanics-view implementation checkpoint, 2026-07-16

The canonical spatial generation now derives one authenticated
`ss-spatial-mechanics-view.v1` in the same caller-owned encoder as the spatial
directory. A GPU bitset, fixed exclusive scan, and scatter produce a strictly
ascending unique list of dense MLS-MPM node indices touched by the exact
clipped 3 x 3 x 3 particle stencil. The view has its own evidence/header,
capacity, source-layout, generation, owner, grid-geometry, count, and indirect-
dispatch contract. It remains structurally distinct from particle rows and
borrows the exact level-assignment source/state and directory generation that
created it. Three resident arenas are queue-fenced and backpressure is
fail-closed; no per-encode GPU buffer allocation is permitted after warmup.

Canonical fused mechanics consumes the view without a host count readback.
Compact indirect dispatch drives node validation, accumulator clear, P2G
finalization, and grid update; P2G and G2P remain particle-parallel. The fused
path encodes 14 dispatches: six ordered one-workgroup authentication stages,
one compact-node validation stage, four mechanics stages, one proposal-apply
stage, and one authority finalizer. Two copies stage the view's indirect
arguments because WebGPU does not permit one writable storage binding to alias
the indirect-dispatch source in the same submission. Missing indirect dispatch
support, a torn identity, corrupt node order/range, stale source state, or any
capacity/layout mismatch zeros later indirect work and fails closed before a
partial authoritative mechanics result can be published.

The six small authentication entry points are intentional. The original
single large preflight shader reproducibly destroyed the Dawn/Vulkan instance
on this system while compiling its combined unsigned-product overflow
expression. Splitting the same ordered checks into header, owner, epoch, grid,
topology, and dispatch stages avoids the driver/compiler failure. Exact host
admission authenticates the grid product; the GPU stages authenticate the same
grid tuple, buffer bounds, offsets, counts, layouts, ownership, epochs, and
dispatch arguments. A four-step live SS run now advances cleanly with no
device loss or release failure; evidence is in
`/tmp/ulg-slice6-backpressure-fixed-final-4steps.json`.

Native manufactured evidence is green: the compact-view probe passes all
`10/10` checks, including CPU/GPU node-set parity, permutation determinism,
strict ordering, zero-selected dispatch, corrupt-directory fail-close, and
zero encode-time allocation. The full spatial-epoch probe passes `36/36`.
Repository verification passes `1,384/1,387` with zero failures and the same
three opt-in skips, and the production build passes with only its existing
large-chunk warning. The SS smoke benchmark at
`/tmp/ulg-slice6-performance-smoke.json` passes its suite gate at about
`101.33` complete-engine steps/s for the realized 1,024-particle target
(`270.27` resident-stage steps/s). Its scene probe still reports the existing
initial-preflight diagnostic blocker, so it is throughput evidence rather than
a visual-physics acceptance claim.

Desktop/mobile visual artifacts under `/tmp/ulg-slice6-live-visual` are runtime
clean and prove canonical compact indirect dispatch plus clean generation
release. They do not expose the live compact node count without a readback;
telemetry therefore reports a conservative full-capacity workgroup upper bound
and must not be cited as measured compaction. Direct inspection rejects the
physics: iron/ice lacks separable meltwater and later explodes, water-cycle is
cohesive/scalloped, sodium/water lacks a visible energetic reaction, and
fluorine collapses into floor-bound chains.

The final pressure/interface review also closed a host-admission mismatch:
the consumer now authenticates source-row layout 1 as
`schroeder-level-assignment-particles` and layout 2 as
`schroeder-active-node-particles` instead of hard-coding the latter. An
integrated layout-1 borrowed-generation pressure test proves the live Slice 6
source remains selected without a private rebuild.

This slice reduces full-grid node work, but it does not yet reduce every
full-sized mechanics allocation, materialize sparse material/body fields, or
remove legacy active-node rows retained by other source families. Do not claim
memory-initialization savings until those buffers are compacted and measured.
The iron/ice visual audit also proves the compact view is not a melt-flow fix:
phase change proceeds numerically, then the one shared node velocity locks
liquid water to overlapping ice/iron and eventually destabilizes. Sparse
`(node, material/body/mechanical-field)` state and continuous phase-volume
transfer are therefore a blocking mechanics closure before two-level
coupling, not a reason to restore the deleted pseudo-active topology.

### Slice 7 phase-overlay/mechanics-field checkpoint - 2026-07-16

The blocking phase-overlay portion of Slice 7 is now implemented; this is not
yet a claim that Slice 7's two-level coupling and aggregate traversal are
complete. The Slice 6 compact dense-node set now derives a second sparse view
whose identity is exactly `(denseNodeId, mechanicalFamilyId, materialId,
continuityDomainId)`. Candidate generation, radix ordering, unique evidence,
P2G, field grid update, explicit unlike-field contact, and G2P remain inside
the caller-owned GPU encoder. The contact operator only removes closing normal
velocity with equal-and-opposite momentum transfer, leaving tangential slip
unconstrained. Field-mode compact summaries explicitly identify the legacy
active-grid sidecar as superseded instead of rebuilding or scanning it.

The native audit fixed two authority bugs before acceptance. Duplicate
candidate runs need the following exclusive-prefix value (or final unique
count) to map to their compact field; the prior current-prefix mapping could
turn valid field evidence from flags `3` to `15` and collapse the field count
to zero. Phase-reserve rows are intentionally zero mass and descriptor-free,
so field G2P now copies them through rather than treating them as global
evidence corruption. Native fixtures cover both cases and corrupt-view
fail-close behavior.

Phase topology now uses four fixed, phase-pure lanes per original lineage
under `peercompute.ulg.sph-phase-carrier-plan.v2`. Stable address is
`phaseLane * phaseLaneStride + lineageIndex`, in solid/liquid/gas/plasma order.
Adjacent thermodynamic phase fractions are redistributed conservatively,
including simultaneous solid/liquid/gas occupancy. Mass, momentum, first
moment, internal energy, and total energy are conserved; merge-relative
kinetic energy becomes internal energy. Material/model-compatible `F`, `C`,
and `J` follow the actual largest contributor, while incompatible phase
transitions use the target reference configuration. A malformed lineage is
contained locally; only a malformed global layout copies every row through.
The browser host, resident worker, portable snapshot/rematerialization path,
compact cohort summary, and reaction-product allocator carry the v2 plan.
Physical lane indices are mapped back to lineage indices for cohort evidence,
and reaction products cannot consume reserved phase lanes.

Phase-resolved render fields use monotone isovolume scaling by phase fraction
instead of inverse-weight radius inflation. This preserves the opaque,
refraction-led water/ice surface while making partial melt and vapor geometry
appear continuously rather than as coincident full-volume shells.

Manufactured native verification passes `19/19`; host/worker portable
verification passes `30/30`; the full repository suite passes `1,404/1,410`
with zero failures and six opt-in skips; and the production build passes with
only the existing chunk-size warning. The 1,024-live-particle benchmark at
`/tmp/ulg-phase-four-lane-performance.json` passes at about `101.80` complete
engine steps/s, `101.68` wall steps/s, `217.39` resident-stage steps/s, and
zero estimated readback bytes per step. Complete-engine throughput matches
Slice 6, although resident-stage throughput is lower because the fixed four-
lane topology dispatches inactive reserve capacity.

The 13-frame desktop iron/ice artifact at
`/tmp/ulg-visual-sanity-matrix/phase-four-lane-iron-ice-20260716` is clean
through `2.56 s`. All 11 authoritative checkpoints are phase-pure with zero
invalid mechanics rows. The final retained state contains about `567.11 kg`
flowing liquid H2O and `55.20 kg` H2O gas; liquid reaches `1.83 m/s`. Iron
solidifies from `1507.68 kg` liquid to `1246.58 kg` solid plus `261.10 kg`
liquid, total mass relative span is `1.91e-6`, and observed condensed-state
`J` remains approximately `0.97655..1.02686`. Direct frame inspection shows
impact, progressive dark-water spreading, retained vapor geometry, and
solidifying iron without flicker, disappearance, or transparency regression.
The matching `390 x 844`, DPR-3 mobile artifact under
`/tmp/ulg-visual-sanity-matrix/phase-four-lane-iron-ice-mobile-20260716` also
passes all 11 checkpoints with 13 frames and zero browser, WebGPU, geometry,
or surface issue; direct inspection confirms the same phase evolution.

The remaining Slice 7 work is still the planned two-level reproduction,
conservative coupling/reflux/subcycling, compact hierarchy reduction, and
aggregate traversal. Fixed four-lane capacity should later become sparse when
measurement justifies it. Geometry/contact/thermal-boundary unification,
derived viscosity/conductivity/interfacial conductance, and coarse gas thermal
microphysics remain separate transport debts; transient tiny gas fractions can
still reach the thermal clamp near `1e6 K`. Do not call this checkpoint full
Slice 7 or full thermophysical closure.

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
3. [x] isolate and bound the apparent condensed-contact energy injection
   between `0.256 s` and `0.512 s`; the contact hypothesis was rejected and
   moved to moot after the retained gas stress was found to use a vacuum gauge
   in an atmospheric scene;
4. diagnose the coarse water free surface and visually illegible reaction as
   renderer/material-interface work, including field-resolution, phase-surface,
   and product-material evidence, without reintroducing a mechanics workaround;
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

Item 3 is complete. The P2G ideal-gas branch already computes gauge stress as
`p_ideal - p_ambient`, but every host mechanics route left the ambient lane at
its vacuum default. Newly placed H2 at `J=1` therefore contributed roughly one
atmosphere of false positive stress to the shared grid. Scene pressure feedback
now supplies its external pressure to standalone, fused, active-grid,
thermal-sidecar, resident-sequence, Schroeder two-level, remote-graph, and probe
routes. Explicit zero remains a supported vacuum override, and CPU fallback
reports that ambient pressure was requested without falsely claiming that its
still-different gas EOS applied the WebGPU gauge closure. Cache identity also
includes evidence provenance, and latest-request publication gates prevent an
older delayed vacuum refresh from replacing or clearing a newer atmospheric
result.

Fresh native Vulkan evidence is at
`/tmp/ulg-ss-spatial-sodium-atmospheric-gauge-v3-green-20260713/result.json`.
At `0.512 s`, the same sodium scenario that previously reached `89.6172 m/s`
and `J=1000` is green at `2.43234 m/s` overall. Its four H2 particles are
bounded at `0.823205 m/s` and `J=0.976154..0.992270`; no material reaches a
volume cap. Both resident batches prove a `101325 Pa` external-pressure source
and actual application in stress projection. Reaction still produces nine
NaOH particles, four H2 particles, and nine events. Native browser pixels pass
with no browser/WebGPU issues, and direct frame inspection confirms the giant
detached lobes and sodium launch are gone. A fresh water control at
`/tmp/ulg-ss-spatial-water-atmospheric-regression-v1-20260713/result.json` is
green through `1.024 s` at `1.08636 m/s` and
`J=0.996426..1.000259`. It still renders as a faceted cohesive mound, while the
sodium reaction remains numerically authoritative but visually indistinct.
Item 4 therefore owns the next visual slice; the explosion no longer justifies
gas damping, contact tuning, or renderer changes disguised as mechanics fixes.
Focused coverage passes `273/273`, the delayed real-browser publication race
passes without GPU resource errors, the complete regression passes
`1111/1114` with zero failures and three opt-in skips, and production build
passes with the existing large-chunk warning only.

Do not widen the reaction radius, globally change the water damping default,
or treat a deliberately relaxed diagnostic threshold as scientific acceptance.

### Slice 3 mechanics-authority closure checkpoint - 2026-07-15

This checkpoint supersedes the earlier mounted-but-open Slice 3 mechanics
checkpoint. Canonical standalone and fused single-step P2G and G2P now consume
the same retained `ss-spatial-epoch.v1` directory. Neither canonical shader
declares, binds, nor reads the particle-proportional level-assignment lookup.
The pre-canonical implementation remains only as an explicit separate legacy
route; it is not a fallback from selected canonical intent. A single canonical
generation is also rejected before submission when a multi-step sequence would
span post-G2P position epochs.

The GPU admission contract authenticates the complete generation identity and
exact-near query geometry before allowing canonical mechanics. Every reverse,
key, query, cell, and chart access is bounds-checked before indexing. Rejection
is global and fail closed: P2G finalization zeros the entire projected grid,
while G2P restores immutable input state plus all eight mechanics rows for
every particle. When separation is active, its already-ordered bin-fill pass
performs that restore and the dispatch topology records the fold; when
separation is inactive, the dedicated global restore pass remains. Restore
buffers must be distinct immutable inputs. Diagnostic mode retains exact
words 14--17 and success counters, while normal unobserved production compiles
success atomics out and collapses any rejection into mandatory word 14. All
canonical mechanics variants, including the active-grid transform, preserve
the portable eight-storage-buffer limit.

Native Vulkan evidence closes both workgroup and corruption boundaries. The
130-particle matrix at
`/tmp/ulg-canonical-mechanics-cross-workgroup-probe-summary.json` spans three
64-wide workgroups with a two-lane final group. Reverse-map corruptions at
particles 0, 63, 64, 97, and 129 globally zero all 17,576 P2G grid floats and
bit-exactly restore every state row and all 130 x 32 mechanics floats. Header
generation and exact-near base-spacing mutations prove the header/query
rejection lanes before and after P2G. Valid execution reports exact 130/130
admission counters. Observed and production-unobserved two-particle probes are
at `/tmp/ulg-canonical-mechanics-native-probe-observed-final.json` and
`/tmp/ulg-canonical-mechanics-native-probe-unobserved-final.json`; the latter
proves word-14 collapse. Every probe caps
`maxStorageBuffersPerShaderStage` at eight and reports zero compilation,
validation, uncaptured, page, console, or device-loss errors.

The final non-overlapping GPU-timestamp campaign is recorded at
`/tmp/ulg-canonical-mechanics-performance-accept-batch128-aggregate.json`.
Across three runs with four warmups, nine measured samples, and 128 grouped
production iterations per sample, the median paired canonical-versus-legacy
cost is `+4.55645%` p50 / `+4.58447%` p95 at 1,024 particles and
`+3.32682%` / `+3.37661%` at 9,826 particles. The plan's independent-median
calculation is also below five percent: `+4.56812%` / `+4.55683%` and
`+3.45279%` / `+3.37661%`, respectively. These are same-source legacy-route
diagnostics, not a provenance-valid historical pre-change baseline.

Repository verification passes `1307/1310` tests with zero failures and the
three existing opt-in long-horizon skips. `npm run build`, syntax checks, and
`git diff --check` pass; the build retains only its existing large-chunk
warning. Final desktop and 390 x 844 DPR-3 mobile matrices are at
`/tmp/ulg-visual-sanity-matrix/codex-slice3-final-canonical-mechanics-desktop-20260715/summary.json`
and
`/tmp/ulg-visual-sanity-matrix/codex-slice3-final-canonical-mechanics-mobile-20260715/summary.json`.
Both execute all four presets plus three deterministic random material pairs,
capture initial/early/middle/final frames, and report zero visual-surface,
browser-console, or WebGPU issues. Direct frame inspection finds continuous
opaque refractive water, visible material geometry, evolving sodium/water and
cesium/fluorine contact, and no blank, flickering, or disappearing interval on
either viewport.

The matrices deliberately keep unrelated physics debts visible. Water-cycle
steam still fails rise/condensation behavior, iron/ice still fails the iron
cooling and steam-rise checks, and sodium/water still reaches `75.418 m/s` and
`J=0.1..3.249` despite nine observed reaction events. Cesium/fluorine and all
three random pairs pass their current behavior gates. Those failures remain
active solver/transport work; they are not hidden as Slice 3 acceptance and do
not restore the removed canonical assignment lookup.

## Slice 7 M0-M3 two-level coupling checkpoint - 2026-07-17

ICC plan items M0 through M3 are verified. They establish the complete sparse
two-level mechanics transaction that precedes M4 hierarchy closure; none of
these stages materializes a dense field mirror or publishes an intermediate
particle state as the next public epoch.

M0 admits authenticated sparse-v2 fine and coarse mechanics fields before any
coupling work. Field identity, compact-row bounds, active-word ranges, source
generation, device, lane, and layout are checked together. Malformed active
ends, capacity ends, key offsets, and state strides fail closed at field
admission without partially admitting the parent workspace. The dedicated
native Vulkan M0 run passes all `8/8` tests with zero validation or uncaptured
errors:

`ULG_RUN_NATIVE_PARENT_FIELD_MECHANICS_M0=1 node --test tests/schroederSpatialParentFieldMechanicsWorkspaceGpu.test.mjs`.

M1 executes the exact fine correction and consumes its authenticated
mechanics-field energy receipt through WebGPU G2P. Fine-route heat and local
heat are accounted separately, their sum matches measured particle heat, and
the correction changes only the admitted fine particle. Receipt consumption is
single-use: replay leaves state and mechanics bit-exactly unchanged while the
field and reflux ledgers record fail-closed phase/replay evidence. Its native
Vulkan gate also passes `8/8`:

`ULG_RUN_NATIVE_PARENT_FIELD_MECHANICS_M1=1 node --test tests/schroederSpatialParentFieldMechanicsWorkspaceGpu.test.mjs`.

M2 executes one terminal coarse reflux in a distinct queue-fenced workspace
arena. The terminal receipt binds the exact field count, contribution count,
owner generation, scale words, and final mutation lineage; positivity, CFL,
momentum, angular-momentum, and energy residuals all close within their packed
tolerances. The synchronized coarse velocity/gradient field and deferred route
heat are consumed once through WebGPU G2P, while a replay restores the input
state/mechanics and rejects the reused terminal receipt. The native Vulkan M2
gate passes `8/8`, and independent adversarial source/lifecycle review found no
blocker:

`ULG_RUN_NATIVE_PARENT_FIELD_MECHANICS_M2=1 node --test tests/schroederSpatialParentFieldMechanicsWorkspaceGpu.test.mjs`.

M3 integrates those transactions into the production fused controller for
fine-substep ratios `r=1..4`. Each ratio dispatches exactly `2r+1` P2G passes,
`r+1` grid updates, and `r+1` G2P passes; performs `r` fine corrections and one
terminal coarse operation; advances `r+1` authenticated private epochs; and
publishes no generic or intermediate `S*`. Native Blackwell/Vulkan execution
passes operator-split energy sealing, non-binary spacing identity, fixed
three-arena bounded rollover, replay rejection, and zero post-cleanup live
generations:

`ULG_RUN_NATIVE_CROSS_LEVEL_M3_R1_R4=1 ULG_CROSS_LEVEL_M3_BASE_URL=https://127.0.0.1:5174/ node --test tests/schroederCrossLevelCouplingGpu.native.test.mjs`.

Focused adversarial lifecycle coverage additionally proves submission failure,
exact device-loss supersession without another queue fence, rollback,
quarantine non-reuse, and exactly-once generation cleanup for the fused
controller, mechanics-field runtimes, parent workspaces, frozen assignment
refresh, and spatial generations.

## Slice 7 hierarchy closure and gas-stability checkpoint - 2026-07-17

Slice 7 M4 is complete. The canonical directory now feeds a true Morton-prefix
binary hierarchy over compact canonical leaves rather than a rank-balanced
surrogate. GPU construction retains the five-word Morton radix arenas, builds
Karras-style internal topology and stackless escape ropes, reduces leaf and
internal aggregates, authenticates the topology fingerprint, and publishes a
replay-bound traversal receipt. Traversal materializes no candidate list and
uses no per-source candidate budget. The shared post-mechanics closure adopts
state, thermo, mechanics, reaction, and phase components independently, then
publishes one coherent fresh public epoch with replay-safe retirement.

Focused hierarchy, reflux, closure, and ABI verification passes `64/64`. The
native Blackwell/Vulkan 4,097-source artifact at
`/tmp/ulg-slice7-aggregate-native-final-4097.json` builds 4,097 leaves and
4,096 internal nodes, covers every source exactly, conserves mass, first
moment, momentum, angular momentum, internal energy, and kinetic energy, and
reports zero compilation, validation, or lifecycle errors. Its stackless
traversal visits `376.89` nodes on average while covering `4,091.79` far leaves
per query. The paired corruption artifact at
`/tmp/ulg-slice7-aggregate-native-final-corrupt.json` changes the root
fingerprint and causes all 4,097 queries to reject before traversal. No
corrupted result authenticates.

The M4 visual audit also exposed a separate, older gas closure defect.
Admitted gas P2G ignored the packed CFL-reduced sound speed and rebuilt an
approximately one-atmosphere-per-density-ratio pressure. CPU and WGSL now use
the same ambient-referenced linearized closure:

`p_gauge = c_cfl^2 * (rho - rho0 * p_ambient / 101325 Pa)`.

This preserves the existing condensed closures while reducing the fresh water
control from about `90.9 m/s`, `minJ=0.1` to `1.086 m/s`,
`J=0.999689..1.000266`, and sodium/water from about `62.1 m/s`, `minJ=0.1` to
`5.282 m/s`, `J=0.95..1.033`. The accepted artifacts are
`/tmp/ulg-visual-sanity-matrix/slice7-cfl-gas-water-20260717/summary.json` and
`/tmp/ulg-visual-sanity-matrix/slice7-cfl-gas-sodium-20260717/summary.json`.
Both keep opaque refraction-led water and continuous visible geometry with no
blank, flickering, transparency, browser-console, or WebGPU regression.

One bounded current-volume experiment was deliberately rejected and fully
rolled back. Preserving `Vcurrent = V0 * J` only in mechanics refresh and
phase-lane transfer passed its focused and native conservation tests, but it
left reaction birth and phase-volume materialization on `mass / targetDensity`.
The water visual then reached `J=1000` with 25 gas cap hits and still failed
steam rise/condensation; sodium still failed hydrogen rise. Keeping that half
of the authority would mint incompatible geometry at two adjacent producers.
ICC records the attempt as
`slice7-volume-authority-isolated-20260717:abandoned`; none of its source or
test changes remain.

### Follow-on - phase-resolved volume and gas-interface transport

This is a dedicated post-Slice-7 solver slice, not a reason to reopen the
verified hierarchy/reflux implementation. Steam and hydrogen currently have
no complete buoyancy or phase-interface path, so their rise/condensation gates
remain explicit pre-existing behavior frontiers.

- [ ] Add authoritative represented-current-volume and volume-gradient moments
  to each phase-resolved mechanics field node, sourced from valid `V0 * J`.
- [ ] Implement one shared antisymmetric pressure/drag operator for both the
  local mechanics-field grid update and the parent-field/reflux path, with
  equal-and-opposite momentum and energy accounting.
- [ ] Supply a hydrostatic ambient boundary ledger or explicit resolved air;
  uniform gravity plus a shared grid cannot manufacture gas buoyancy.
- [ ] Conserve consumed source current volume through phase change and reaction
  birth. Direct products, spare placement, merge placement, and resident events
  must partition source volume; target density remains an EOS target that
  drives expansion work instead of teleporting geometry.
- [ ] Materialize phase-volume split/merge consistently before mechanics
  refresh. The older phase-volume migration record is adaptive representation
  metadata, not thermodynamic phase-transfer authority.
- [ ] Keep the legacy pressure-interface rows disabled. Their geometry comes
  from render-derived support and cannot conservatively address mechanics
  fields or the two-level reflux ledger.
- [ ] Prove native partial sodium/water reactions conserve
  `sum(active V0*J) + sum(live event support volume)` across direct, spare, and
  merge routes; then require visible hydrogen rise, visible steam transport,
  pressure-dependent condensation, iron/ice heat-transfer continuity, and less
  than five-percent throughput regression.

## Slice 7 M5 release-verification checkpoint - 2026-07-18

M5 implementation and precommit release verification are complete in the
staged Slice 7 snapshot. The immutable commit SHA and remote-ref results cannot
be embedded in that same commit without changing its SHA; ICC attempt state and
the final handoff record those transport receipts after the snapshot is
committed and pushed.

The release hardening closes three lifecycle/evidence ambiguities found during
the complete suite. Mechanics-field and spatial-generation retirement now
validate the exact in-flight owner and retire at the submitted queue boundary,
including device-loss supersession, without destroying borrowed or published
buffers. Resident continuation evidence now distinguishes a real full particle
readback from compact summary or render-row refresh: the
`fullParticleReadbackPerformed` flag is true only when full state/mechanics rows
were actually read, while authenticated resident GPU continuation remains
available from compact diagnostics. The outer execution envelopes preserve
that distinction instead of recreating a false full-readback claim.

The current complete unit run reports `1628` tests, `1617` passed, `11`
expected opt-in skips, and zero failures. Production build passes, and material
validation accepts all `111` element records and seven crystal records. Fresh
M5 native hierarchy artifacts at
`/tmp/ulg-slice7-aggregate-native-m5-final.json` and
`/tmp/ulg-slice7-aggregate-native-m5-corrupt.json` respectively prove the
4,097-source aggregate/traversal path and all-query topology-fingerprint
fail-close behavior.

The definitive Playwright run reports `66` passed, two intentional
capture-only skips, and zero failures. Its bounded product-event compaction
case is tagged for a dedicated fresh WebGPU browser process, preventing an
accumulated Chromium/Dawn external-instance lifetime failure from being
misreported as chemistry or compaction failure. The preceding condensed
product test remains responsible for Al/O2-to-Al2O3 visibility; the compaction
test owns only bounded event-buffer generations/bytes and clean runtime
lifecycle.

Fresh desktop and mobile standard visual matrices are recorded at
`/tmp/ulg-slice7-visual-m5/slice7-m5-full-standard-desktop-final-20260718/summary.json`
and
`/tmp/ulg-slice7-visual-m5/slice7-m5-full-standard-mobile-final-20260718/summary.json`.
Each runs all four presets and three deterministic random pairs. All seven
scenarios report renderer and analysis status `good`, every capture is
nonblank, and there are zero browser-console, WebGPU, or visual-surface issues.
Direct frame review confirms continuous opaque/refraction-led water, persistent
iron/ice contact and melt/deformation, reactive sodium/water surfaces, visible
dynamic fluorine and CsF product, and stable random-pair geometry on both
viewports.

The matrix commands are not full behavior passes. Two scenario-level behavior
failures remain: water-cycle steam does not rise or condense, and sodium/water
hydrogen does not rise. Those three explicit expectations are the documented
post-Slice-7 phase-volume/gas-interface transport frontier above, not renderer
regressions, and have not been relaxed or hidden.

The final historical non-target campaign is
`/tmp/ulg-slice7-nontarget-detp2g-final-pass-consolidated.json`. It compares
the dirty Slice 7 source fingerprint at Git head
`43d355e59005b96ec2874af86c219b6078d06335` with the clean historical source
at that same head, in three alternating `AB/BA/AB` runs with four warmup
batches, one measured 16-step batch, and 1,024 realized particles per arm.
The first unoptimized receipt failed at `10.753822%` paired median regression:
the mechanics-field route encoded its 13 additional safety/contact dispatches
as 13 additional compute passes. Keeping every dispatch and exact state
transition but grouping production work into one ordered compute pass plus one
post-G2P receipt/rollback pass reduces the final paired median regression to
`3.303618%`, below the five-percent ceiling. The independent medians are
`86.767896` historical versus `86.814976` candidate steps/s, a `0.054259%`
candidate improvement. The campaign reports no blockers.

The final authoritative target characterization is
`/tmp/ulg-slice7-target-detp2g-final-pass-consolidated.json`. All three arms
provide native timestamp-query support, four warmups, nine measured samples,
complete batch/stage/migrated-law coverage, stable same-source fingerprints,
and zero blockers. This is deliberately not a five-percent regression gate:
it compares the `r=2` authoritative two-level mechanics and post-mechanics law
chain with a single-level control, not two interchangeable implementations.
The authoritative/control median ratios are `2.471602x` p50 and `2.266266x`
p95. The timestamp evidence makes the next optimization priority explicit:
post-mechanics `reactionStep` is roughly `364..369 ms` p50 per run, ahead of
spatial-epoch generation at `61..63 ms`, derived-view build at about `44 ms`,
and mechanics-field view build at about `4.1 ms`. Slice 8 must route that
reaction work through admitted shared spatial views and remove its redundant
lookup work before treating the target-path ratio as an optimization baseline.

`npm run build:pages` passes after transforming `926` modules. The Pages
verifier reports `30` files, one HTML entry, twelve JavaScript files, both
hashed workers, the stable resident-compute facade, and all service assets
preserved. A repository-root static server at `/docs/` returns the hashed
entry, stable worker/facade assets, MoonLab JS/Wasm, Eshkol closure Wasm, and
probe worker; MoonLab Wasm has `application/wasm` content type. A fresh Vulkan
Chromium boot reports no failed requests, page errors, or console errors,
mounts the scene and play control, creates two live `1280 x 800` canvases, and
produces `/tmp/ulg-pages-static-smoke.png`; direct inspection confirms visible
native geometry and controls rather than a blank deployment.

The final staged audit covers all `87` changed paths. There are no unmerged
entries, conflict markers, sensitive filenames, or recognized private-key,
certificate, GitHub, OpenAI, AWS, Slack, or Google token signatures. Source,
test, ABI, plan, and ICC policy paths pass the whitespace check; the only raw
`git diff --cached --check` findings are pre-existing trailing spaces embedded
inside the generated hashed Pages bundle. ICC `guard-diff` passes when generated
Pages assets are excluded. The `no-regression` completion oracle passes both
criteria, scoped readiness is `ready` at `100`, and the scoped production audit
returns `ok=true`, `verdict=warn`, with zero high-severity or blocking risks.
Its remaining warnings are the reviewed forward-replacement shape, explicitly
justified temporary GPU integration boundaries, pre-existing portfolio task
state, and the expected precommit dirty-tree receipt.

## Slice 8 source-family and final-cleanup checkpoint - 2026-07-21

Slice 8 closes the remaining authenticated source-family boundaries without
creating a second spatial authority. Reaction discovery now feeds an
authenticated product-placement/topology-transition successor family; thermal
proposal and apply share one matched-time reciprocal receipt; compact gas-ledger
EOS remains GPU-resident through exact-v2 host/worker continuation; retained
fences authenticate reuse and cleanup; and successor render, source-field, and
native-surface routes publish exact generation lineage. The aggregate render
carrier remains a presentation proxy rather than coherent-solid body authority.

The complete unit suite reports `1863` total, `1848` passed, `15` expected
opt-in skips, and zero failures. Focused native-surface lifecycle, harness, and
renderer coverage reports `205/205`. Final desktop and mobile visual artifacts
are
`/tmp/ulg-visual-sanity-matrix/slice8-closeout-desktop-r2/summary.json` and
`/tmp/ulg-visual-sanity-matrix/slice8-closeout-mobile-r2/summary.json`: all
seven scenarios per viewport have structural analysis `good`, zero stale-source
samples, nonblank frames, and no browser-console, WebGPU, or visual-surface
issues. Direct review covers moving opaque/refraction-led water, iron/ice
contact, reactive sodium/water, visible dynamic fluorine/CsF, and all random
pairs.

The first desktop closeout artifact at
`/tmp/ulg-visual-sanity-matrix/slice8-closeout-desktop` exposed stale published
render-source evidence while every frame remained nonblank. The clean Slice 7
control at
`/tmp/ulg-visual-sanity-matrix/slice7-compare-sodium-csf` did not reproduce the
stale-source result. Candidate validation stays nonblocking and last-good
presentation stays visible, but diagnostic checkpoints now wait for the
one-active/one-latest scheduler to quiesce and the promoted candidate publishes
the exact immutable refresh receipt. A successful first submit is terminal and
cannot be mislabeled as a later discard.

Steam rise, steam condensation, and hydrogen rise remain the explicit
transport frontier in “Follow-on - phase-resolved volume and gas-interface
transport.” The opt-in long-liquid gate reproduces its two failures bit-for-bit
on the clean `6c20c32` baseline: `0.46572056445613097 m/s` retained bulk motion
and resident `minJ=0.9833418130874634`. These are inherited solver debts, not
Slice 8 regressions, and no acceptance threshold was weakened.

The final matched performance receipts are written to
`/tmp/ulg-slice8-reaction-step-historical-final.json` and
`/tmp/ulg-slice8-nontarget-physics-throughput-final.json`. The former uses three
alternating `AB/BA/AB` runs, four warmups, nine one-step samples, exact native
timestamps, and a five-percent p50/p95 ceiling against immutable Slice 7. The
latter uses three alternating runs and one measured 16-step batch per arm, with
both paired and independent median throughput ratios required to remain at
least `0.95`. Machine-readable gate values and source fingerprints live in
those reports and the final ICC attempt.

## Slice 9A strict raw-volume moment sidecar checkpoint - 2026-07-23

Slice 9A begins the phase-resolved volume/transport follow-on without quietly
changing mechanics, EOS, phase transfer, reaction placement, or rendering. It
adds a retained, GPU-resident diagnostic sidecar to each admitted mechanics
field view. The sidecar reads only the exact borrowed MLS-MPM mechanics words
for rest volume (`V0`, word 19) and volume ratio (`J`, word 18), forms strict
finite-positive `V0 * J`, and scatters it with the existing 27-point quadratic
stencil to the exact existing mechanics-field identity. It emits per-field
current-volume and volume-gradient rows. There is no density, phase-reference,
render, or host fallback: invalid raw values, source lineage, buffer identity,
or field-header evidence fail the entire sidecar closed.

The control ABI (`schroeder-spatial-phase-volume-moment.v1`) carries exact
source/field/generation identity, source and field capacities, raw mechanics
layout words, indirect field dispatch, compact counters, and an explicit
diagnostic-only/no-state-mutation policy. Candidate-to-field indices and field
ranges share one bounded scratch binding, keeping every shader entry point at
the portable eight-storage-binding limit. Four caller-encoded passes (emit,
range materialization, per-field reduction, and finalization) operate in the
same production command encoder before P2G. The sidecar owns only its retained
arena buffers; it neither destroys nor mutates the borrowed source, mechanics,
directory, or mechanics-field buffers. Normal retirement is fence-safe and
device loss quarantines only sidecar-owned resources.

Frozen fine-substep refreshes deliberately suppress this diagnostic until a
fresh mechanics-source family can be re-proven; a carried pointer is not
mistaken for current `V0 * J` authority. This is diagnostic groundwork, not yet
the phase-transfer or pressure/drag operator promised by the follow-on plan.

Verification is green:

- focused ABI/runtime/epoch coverage passes `43/43` non-opt-in checks, with
  the native proof kept separately opt-in;
- the opt-in native Chromium/Vulkan proof passes `6/6`, including a
  manufactured `V0=0.003`, `J=2` result (`sum V=0.006`) and a `J=0`
  fail-closed result;
- the full repository suite passes `1878/1896`, with `18` expected skips and
  zero failures; `npm run build` and `git diff --check` pass;
- the native desktop visual matrix records all seven standard/random scenarios
  nonblank with zero WebGPU/browser or visual-surface issues. Its three
  steam/hydrogen-rise behavior failures exactly match the established Slice 7/8
  transport frontier rather than introducing a new rendering regression; and
- real SS GPU-stage timestamps confirm the sidecar is active and has zero
  particle readback. At 1,024 particles it measures `0.520640 ms` p50 /
  `0.754528 ms` p95 per spatial epoch, versus `6.068320 / 8.112672 ms` for
  the whole spatial command-encoder span. At 8,192 particles it measures
  `0.748352 / 0.767104 ms`, versus `13.929728 / 14.655264 ms`. These isolated
  sidecar spans are evidence, not an A/B throughput-regression claim.

Artifacts are
`/tmp/ulg-visual-sanity-matrix/s9a-visual-gate-20260723/summary.json`,
`/tmp/ulg-s9a-ss-stage-timing-20260723.json`, and
`/tmp/ulg-s9a-ss-stage-timing-8192-20260723.json`.

### Post-commit transport receipt

The one full-slice commit, branch push, and Pages-bearing `main` fast-forward
are the final transport operations. Their immutable SHA/ref results are
recorded in ICC and the final handoff rather than by creating a second source
commit solely to self-reference the first.

## Whole Slice 9 continuation checkpoint - 2026-07-24

The whole phase-volume/gas-interface transport slice remains in progress in the
dirty `ss-spatial-authority-refactor` worktree. The exact implemented boundary,
pressure-sidecar ABI, current focused verification, known risks, and ordered
remaining work are recorded in
`plan/todo/SS/slice9-continuation-handoff-2026-07-24.md`. That handoff is the
required entry point for the next model. It does not mark any of the nine ICC
Slice 9 gates complete and it is not authorization for an intermediate slice
commit.

## Slice 9D shared exact-near traversal view - planned 2026-07-23

The next performance slice shares the exact local spatial traversal that is
currently rebuilt by each law. The canonical SS directory and M4 hierarchy are
both retained, but their responsibilities stay distinct: M4 remains an
aggregate-admissible far-field accelerator; reactions, thermal conduction, and
pressure/contact keep exact local pair predicates. No local chemistry or
contact path may be approximated through a far-tree aggregate.

### Why this is next

The authenticated M4 hierarchy is real, but normal mounted SS does not use it
as a universal local-law accelerator. The measured target-path bottleneck is
post-mechanics reaction discovery (roughly `364..369 ms` p50), not hierarchy
construction. Reaction discovery currently re-derives level, x, y, and z
directory ranges from the same canonical epoch for every source. That repeats
binary/range lookup work that can be shared without materializing an unbounded
pair list or changing any reaction predicate.

### Scope

1. Build one immutable GPU-resident **canonical exact-cell hierarchy** per
   authenticated epoch. It is a complete, power-of-two binary hierarchy over
   the already canonical directory cells: leaves point back to the directory's
   existing cell/member spans and carry conservative physical cell AABBs;
   internal nodes carry only unions of those AABBs. Its retained footprint is
   `O(cellCapacity)`, its build is `O(cellCapacity * log2(cellCapacity))` with
   fixed bottom-up levels, and it contains no query-cell-to-neighbour-cell CSR,
   pair rows, candidate budget, private sort, or duplicated particle authority.
   A consumer support profile supplies only its query envelope; the hierarchy
   itself is law-neutral and reusable.
2. Bind exact generation, device, lane, lease, source family, storage,
   position/topology/chart/level/support epochs, directory offsets/capacities,
   tree capacity/depth, and the reaction support-profile identity. Any stale,
   foreign, malformed, overflowed, or released parent fails closed before
   dispatch. Cell bounds are derived only from the frozen canonical directory
   keys and level spacing, never from render radius, density, or mechanics
   aggregates.
3. Migrate canonical reaction discovery first. It consumes the view and keeps
   its current material-pair rule lookup and exact distance/reaction predicates.
   It cannot gain a fixed candidate budget, full CPU readback, or a fallback
   private directory/range build. The initial current-source traversal retains
   its existing `maximumContactRadius + D` certificate envelope. A later
   source-cell-batched traversal must instead expand its frozen source-cell
   AABB by `maximumContactRadius + 2 * D`, where `D` is the existing GPU
   displacement certificate. Every accepted pair still passes the current-state
   exact predicate; the hierarchy may only reject provably non-overlapping
   canonical cells.
4. Preserve the view as read-only and law-neutral. Thermal and
   pressure/interface consumers may adopt matching support profiles in later
   slices; phase-volume interface work, P2G, G2P, reflux, phase transfer,
   reaction placement, EOS, and rendering are out of scope here.
5. M4 is deliberately **not** made mandatory by this slice. Its authenticated
   Morton aggregate tree remains correct for aggregate-admissible far-field
   work and may be observed when it already exists, but its current producer
   requires particle/render-mechanics admission and a full source-count Morton
   sort. It is neither a canonical cell-AABB hierarchy nor a safe replacement
   for exact chemistry. The new hierarchy may model M4's lifecycle discipline,
   but does not alias its records or theta/far-summary traversal.
6. Block the classic thermal exhaustive fallback from the intended canonical
   hot path with explicit telemetry before migrating it. Do not silently claim
   that an opt-in hierarchy route has replaced exact-near local traversal.

### Required proof

- Manufactured/permuted directories prove the hierarchy's leaf traversal
  reaches exactly the same admitted local cell members as the current reaction
  traversal: no missed, duplicate, self, out-of-support, or stale-source pair
  is admitted. Sparse, dense, multilevel, negative-coordinate, boundary, and
  current-source large-displacement cases exercise the current `R + D`
  envelope. The later source-cell-batched traversal must add its own `R + 2D`
  large-displacement proof before it is admitted.
- All corrupted identity, support-profile, header, capacity, offset, source,
  device, lifecycle, and parent-submission cases yield zero consumer dispatch
  and no fallback traversal.
- Reaction output, state, thermo, mechanics, reaction placement, and render
  receipts remain bitwise/no-op equivalent except for the view's diagnostic
  evidence; all buffers stay same-device and GPU-resident.
- Native Vulkan evidence covers arena reuse, queue/fence ownership, device
  loss, and no WebGPU validation errors. GPU timestamps report view-build and
  reaction-consumer spans separately.
- Use alternating AB/BA three-run medians against the current canonical
  reaction path. The target must reduce repeated lookup work, and non-target
  physics plus visual presentation must remain within the existing five-percent
  regression ceiling. Steam/condensation/hydrogen transport failures remain
  explicit phase-interface frontier checks rather than being waived.

### S9D-1 native-only comparator checkpoint

Before a second law adopts the tree, preserve the production tree-only route
and construct a native-test-only direct canonical-directory shadow. It must
bind the same generation identity, frozen directory, current-state source,
material-pair rule-index upload, and `R + D` certificate as the production
reaction traversal. The shadow is neither a runtime fallback nor a browser
switch: it exists only to establish proposal/fail-closed parity and a
same-device timing receipt.

- Record direct range-lookup, cell, and member visits separately from the
  tree's node, leaf, and member counters.
- Run four warmups and nine measured alternating `tree/direct`,
  `direct/tree`, `tree/direct` native samples; report tree-build,
  tree-candidate, direct-candidate, and combined tree-route medians.
- Do not call a candidate-only win an end-to-end win: the tree-build span is
  part of the route until a retained/reusable epoch proves otherwise.
- If the combined route is not faster, use the receipt to choose the next
  tree-layout/build optimization rather than migrating thermal or pressure
  prematurely.

### S9D-2 rejected tree-build scheduling experiments - 2026-07-24

Two GPU-resident build-scheduling candidates were implemented only long enough
to obtain a real native Vulkan receipt, full canonical-tree parity, and
arena/fence validation. Neither is retained in production.

- GPU-authored indirect dispatch rows for leaves and each complete-tree level
  preserved the fixed ABI and produced exact trees, but the `C=1`, `L=8192`
  capacity-slack receipt measured `0.078336 ms` median versus `0.035136 ms`
  for the former direct complete-tree schedule (`2.23x` slower). Per-level
  indirect dispatch overhead outweighed skipped invocations.
- Keeping direct dispatches while guarding reducers outside the live leaf
  prefix also preserved exact output, but measured `0.032 ms` versus
  `0.029152 ms` for the exhaustive reducer (`1.098x` slower). The additional
  per-invocation active-prefix calculation outweighed the avoided inactive
  unions on this backend.

Both variants were removed after the receipt. The production builder remains
the fixed direct complete-tree schedule, including full clear/fail-closed
semantics, and no consumer migration or performance claim follows from either
experiment.

### S9D-3 reaction-tree hot-counter aggregation - native checkpoint

This optimization targets the measured hot path rather than hierarchy
construction. Before this slice, live post-mechanics reaction discovery did
not request observed GPU evidence, yet the tree traversal still atomically
incremented global diagnostic counters for every node, leaf, member, candidate,
material-pair lookup, and rule visit. These counters are diagnostics only; they
do not determine proposals, admission, candidate budgets, or fallback behavior.

1. Keep the immutable canonical directory, fixed tree ABI, tree-only
   production traversal, reaction predicates, proposal rows, and 27-word
   evidence ABI unchanged.
2. Accumulate the nine hot diagnostic counters per source invocation and flush
   only nonzero totals once per source. Retain immediate global atomics for all
   fail-closed/control state: source/admission/seal counts, certificate state,
   malformed/source-identity rejection, maximum displacement, and overflow.
3. Add a native-test-only legacy unaggregated shader control. Prove exact
   proposal-row and all evidence-word parity across sparse, dense, multilevel,
   boundary, current-source `R + D`, corrupt-header, arena-reuse, and device
   loss coverage.
4. On dense one-cell and clustered multi-cell fixtures, run four warmups plus
   nine alternating AB/BA samples with evidence readback outside timed spans.
   Report build, displacement, candidate traversal, seal, and combined tree
   reaction-route medians. Require a combined-route win on dense contention and
   no material sparse/clustered regression before claiming success.
5. Do not add a runtime toggle, alternate directory, CPU readback, CSR,
   candidate materialization/budget, direct fallback, or second-law migration.
   After native proof, run the focused suite, production build, and visual
   matrix; inherited gas transport gates remain explicit rather than waived.

The 2026-07-24 native Vulkan checkpoint now proves the implementation boundary
without conflating diagnostic and production modes:

- Explicit observed mode retains bitwise proposal rows and every word of the
  fixed 27-word evidence ABI against the native-test-only legacy global-atomic
  shader. The six correctness fixtures cover sparse, dense, multilevel,
  negative/boundary, and current-source `R + D` cases. The control upload is
  byte-compared with the exact production rule-index upload and checked against
  its production payload fingerprint. A separate full-scan control exercises
  nonzero evidence word 19 and retains exact proposal/all-word parity. Its
  per-sample combined-route median ratios are `0.6255x` dense, `0.7867x`
  sparse, and `0.7024x` clustered.
- Default production mode requests neither diagnostic collection nor internal
  readback. Its nine diagnostic words remain zero, while proposal rows and all
  control/certificate evidence words match the historical always-atomic
  control. Four warmups and nine alternating AB/BA measurements per fixture
  put all test readback outside the timestamped spans.
- Dense contention in default production mode measures `0.261344 ms` combined
  tree route versus `0.424672 ms` historical global-atomic control (`0.6154x`).
  Sparse many-cell measures `0.068512 ms` versus `0.091552 ms` (`0.7483x`),
  and clustered multi-cell measures `0.116064 ms` versus `0.161664 ms`
  (`0.7179x`). Combined values are medians of each sample's build-plus-reaction
  total rather than sums of independently computed medians.
- A test-only runner compiles the unmodified production aggregation WGSL,
  seeds the tree-node destination at `UINT32_MAX`, and proves a real flush
  overflow publishes the overflow bit, marks traversal malformed, and causes
  the seal dispatch to invalidate every proposal row.
- The same production/legacy shader pair retains exact proposal and all-word
  parity on a safely reused tree arena, a corrupt tree header, and the exact
  generation subsequently quarantined on device loss. The production pipeline
  cache version is now explicitly `v4-s9d-hot-counter-aggregation`, preventing
  a long-lived HMR WebGPU device from retaining the pre-aggregation module.

The 2026-07-24 closure campaign completes the remaining S9D-3 release gates:

- The production build and `git diff --check` pass. The full Node suite reports
  `1945` tests, `1924` passed, `21` expected skips, and zero failures. The
  isolated physics-behavior gate reports `11/11` required checks passed with
  only its three explicitly opt-in long-horizon cases skipped.
- A real Chromium/Vulkan run passes both native-presentation liveness cases
  together: real pointer rotation holds the exact post-step gate until a
  structured camera-stale retry foreground-proves the same resident source,
  and a deliberately delayed successful candidate is admitted after the
  bounded handoff wait without releasing a stale gate. Physics advances after
  both recoveries.
- Four browser prerequisite checks prove a real compute-worker pool, a
  worker-retained mechanics lane, normal native presentation, and typed
  fail-closed startup for `residentWorkers=0`; no mounted path falls back to
  inline execution.
- The seven-scenario standard/random visual matrix completes with all `58`
  temporal captures nonblank and current, zero stale-source samples, zero
  browser-console issues, and zero visual-surface issues. Direct early/mid/late
  review confirms flowing water, iron/ice contact and deformation, visible
  sodium/water, dynamic reactive cesium/fluorine, and all random pairs. The
  unchanged steam-rise, steam-condensation, and hydrogen-rise failures remain
  the documented gas-interface transport frontier; they are identical to the
  recent matched baselines and are not waived.
- ICC reports fresh index, memory, architecture, and Git-history artifacts;
  scoped guard diffs pass; both the S9D-3 and camera-liveness completion oracles
  are complete; and both readiness reports score `100` with no contract,
  liveness, stub, or runtime-check blockers.

S9D-3 is therefore closed by the slice commit containing this checkpoint. The
next hierarchy work must start as a separately leased, bounded consumer slice;
it may not reopen the diagnostic-atomic control as a production fallback.

### S9D-4 thermal exact-cell-tree consumer rejected for production - 2026-07-24

S9D-4 tested the matched-time canonical thermal producer as the second
exact-cell-tree consumer without changing the mounted route. The direct
canonical-directory pipelines remain the only production thermal traversal.
The tree and brute-force variants are reachable only through explicit
native-test arming functions; neither has a URL selector, runtime fallback, or
production caller.

Correctness evidence is sufficient to reject or admit the candidate honestly:

- direct and tree runs share one authenticated generation and compare the full
  derived/proposal headers and rows, conduction and radiation evidence, active
  dispatch, CSR replay/state, and applied state/thermo;
- eight campaigns cover mixed temperatures, multilevel cells, negative
  coordinates, both directions of frozen/current displacement, active-rank
  dormant projection, dense CSR overflow/re-walk, and uniform completion;
- the tree route is byte-identical to direct for every compared artifact;
- a separate independent GPU control enumerates particle indices without
  consulting cell keys, member ranks, particle-to-cell mappings, or a spatial
  envelope. It preserves exact applied state/thermo and control evidence, with
  proposal rows equal within the declared f32 tolerance. Candidate-visit
  counters and CSR peer byte order are intentionally not equated because the
  brute-force enumeration visits a different superset in a different order;
- status/generation/position/capacity/offset/root-AABB corruption plus a
  cleared live child and duplicated live-leaf payload all publish zero rows
  with no fallback; and
- host lifecycle coverage rejects foreign devices, swapped generations,
  released and pending-release trees, physical arena reuse, device loss,
  partial pipeline arming, and a tree retired after bind but before encode.
  The final encode recheck happens before any command-encoder mutation.

The final hardware receipt uses the NVIDIA Blackwell adapter with
`timestamp-query`, four warmups, and nine alternating AB/BA samples per
fixture. Diagnostic counters are disabled in the timed routes:

- sparse replay: traversal `1.5224x` paired / `1.6110x` independent,
  full thermal route `1.2285x / 1.2361x`, and shared tree-plus-thermal
  `1.1877x / 1.1906x`;
- clustered replay: traversal `1.1473x / 1.1548x`, full route
  `1.0843x / 1.0605x`, and shared route `1.0713x / 1.0511x`;
- dense overflow/re-walk: full route `0.9611x / 0.9616x`, but the
  tree-first order stratum is `1.1379x` and the shared tree-first stratum is
  `1.1342x`; and
- the dense-dominated composite is `0.9791x / 0.9805x`, which cannot override
  the material sparse/clustered and order-stratum regressions.

The production decision is therefore **retain direct**. No thermal migration,
runtime topology selector, hidden direct fallback, or dense-only special case
is admitted.

Before a later tree migration can be reconsidered, it still needs a real
consumer lease spanning encode through submission, a representative nonzero
radiative-energy campaign, and real-device loss evidence. The next bounded
hierarchy experiment should remain native-test-only and batch traversal by
frozen source cell, expanding each source-cell AABB by the maximum support
radius plus `2D`. It must compare against both the current per-particle tree
and direct-directory routes on the same sparse, clustered, and dense fixtures;
production stays direct unless every no-material-regression gate passes.

### S9D-5 source-cell-batched thermal comparator rejected for production - 2026-07-24

S9D-5 implemented the bounded experiment described by S9D-4 without changing
the mounted thermal route. The native-test-only comparator groups exact source
ranks by frozen canonical source cell, traverses the existing immutable
same-generation cell tree once per source cell with a conservative `R + 2D`
AABB envelope, seals a bounded candidate-cell bitset, and evaluates source rows
through a bounded two-dimensional dispatch. The canonical directory, exact
pair predicates, reciprocal energy semantics, CSR replay/re-walk behavior, and
production direct pipelines remain unchanged; there is no private spatial
index, selector, fallback, or production caller.

Correctness evidence closes the prior proposal gaps. Direct, per-particle tree,
and source-cell tree routes are exact across the full derived/proposal/
evidence/dispatch/CSR/apply byte family on ten same-generation campaigns; an
independent particle-index traversal preserves semantic parity. The campaigns
include a nonzero radiative-energy case, local and base-active dormant
projection, multilevel and negative/boundary cells, both `R + 2D` displacement
directions, dense CSR re-walk, and uniform completion. Eight malformed tree
families publish no rows or fallback. Exact tree plus whole-generation leases
span bind through submitted-work completion, and native lifecycle probes reject
released leases, stale bind-to-encode state, physical arena reuse, and a real
browser device-loss event while the source-cell shadow is armed.

The measured route is nevertheless rejected. Four warmups and nine balanced
three-route NVIDIA Blackwell samples per fixture run without source-cell
diagnostic counters; an isolated observed probe retains bounded counter and
seal evidence. The source-cell full-route composite is
`1.1959788824x` paired / `1.1754972367x` independent (`2.27328 ms` versus
`1.933888 ms` direct). Sparse full-route and traversal ratios are respectively
`2.72538708735x / 2.71867749420x` and
`3.88607594937x / 3.85316455696x`. The per-particle comparator's favorable
composite (`0.9734063355x / 0.9594930006x`) does not override its own
per-fixture rejection. The authoritative receipt is therefore
`sourceCellAccepted=false`, `experimentalDecision=source-cell-benchmark-rejected`,
and `productionDecision=retain-direct`.

This slice proves that source-cell batching can preserve the physics and
lifecycle contracts, but not that this implementation is a viable production
accelerator. No thermal migration follows. Any later hierarchy consumer or
layout experiment requires a new task, lease, native receipt, and
no-material-regression gate; direct remains authoritative.
