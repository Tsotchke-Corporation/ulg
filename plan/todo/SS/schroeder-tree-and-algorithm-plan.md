# Schroeder Tree And Schroeder Algorithm Plan

Date: 2026-07-01 AKDT
Branch: `SS`
Status: active architecture direction

## Purpose

Implement Schroeder Simulation: a GPU-first continuous multiscale simulation
architecture made of two inseparable parts:

- the **Schroeder Tree**, a GPU-resident scale hierarchy whose nodes are both
  multilevel MLS-MPM grid nodes and law-aggregate nodes;
- the **Schroeder Algorithm**, a multiscale solver that moves particles,
  fields, reactions, contact, optics, and long-range laws through that hierarchy
  with conservative level coupling and law-specific admissibility rules.

This is not just Barnes-Hut, not just AMR, not just adaptive MPM, and not just
an Ocean-style tiled kernel. It is a new ULG algorithm/data-structure direction:
one continuous scale-aware substrate for physics from atomic to supergalactic
scale, with each law declaring how it can use exact near-field work, aggregate
far-field traversal, and cross-level coupling.

## Core Shift

The prior `generalized-spatial-law-tree` plan treated the hierarchy mostly as a
shared accelerator next to MLS-MPM. SS supersedes that framing.

The hierarchy is now part of the mechanics algorithm:

```text
material/phase state
  -> physical volume, density, pressure, temperature, support radius
  -> Schroeder level assignment
  -> per-level active nodes/tiles
  -> same-level MLS-MPM/Ocean P2G + grid update + G2P
  -> adjacent-level conservative restriction/prolongation
  -> law adapters over the same hierarchy
  -> retained GPU outputs + compact StateManager-admitted summaries
```

Barnes-Hut/FMM-style traversal still belongs here, but as one law-adapter mode
for aggregate-admissible laws. Local continuum mechanics, pressure, contact,
incompressibility, phase boundaries, and reactions still need exact near-field
handling.

## Definitions

### Schroeder Tree

A Schroeder Tree is a GPU-resident hierarchical grid/tree whose nodes carry:

- local chart id, origin, and scale exponent;
- level id and grid/node key;
- spatial bounds and support-inflated bounds;
- conserved aggregates: mass, volume, momentum, internal energy, center of mass;
- mechanics aggregates: deformation/`J`/affine summaries where admissible;
- phase/material/reaction/gas/charge/opacity masks and histograms;
- law masks declaring which laws may consume the node;
- error/admissibility flags for aggregate traversal, coarsening, rendering, and
  cross-level transfer;
- retained GPU buffer ownership, epoch, and state-family source metadata.

It is not a pointer-heavy CPU octree. The hot structure should start as
GPU-friendly level/key arrays, active-node lists, aggregate rows, and coupling
edges.

### Schroeder Algorithm

The Schroeder Algorithm is the GPU solver sequence that uses the tree as the
actual multiscale grid:

- assign each entity to a native scale level from material-derived physical
  support, not from renderer radius or drop/base UI role;
- run same-level MLS-MPM transfer inside active nodes/tiles;
- couple adjacent levels through conservative restriction/prolongation;
- refine near free surfaces, contacts, reactions, shocks, high gradients, and
  phase/material boundaries;
- coarsen coherent bulk only when mass, volume, momentum, energy, material,
  phase, and represented mechanics state are conserved;
- expose law work queues for reaction/contact/interface/optics/gravity/plasma
  without creating one-off grids per law.

## GPU-First Rule

Do not start with a CPU reference implementation. SS starts on the GPU.

Allowed validation:

- tiny aggregate readbacks for counters and conservation residuals;
- level histograms and active-node counts;
- min/max support, density, pressure, and temperature summaries;
- bad-weight, bad-coupling, overflow, and fallback counters;
- sampled sentinel rows only when explicitly requested.

Disallowed as a default path:

- full particle readback;
- CPU mirror trees;
- CPU-first parity gates that prevent the GPU hierarchy from landing;
- worker `mapAsync` snapshot paths as hot-loop plumbing on this Chromium device.

## Scale Independence

SS should support a continuous scale hierarchy, not one flat `f32` universe.

For atomic-to-supergalactic ranges, positions must be represented through local
charts or equivalent origin/scale rebasing. A node can be local `f32` for GPU
throughput, but its admitted state must retain enough chart/scale metadata that
PeerCompute can interpret it globally.

The first implementation can operate in the existing meter-space scene chart.
The data model must not bake in that limitation.

## Phase-Volume Example

Water-to-steam expansion is the canonical SS stress case.

If one water macro-particle expands to roughly `700x` volume as steam, its
radius/support grows by `cbrt(700)`, about `8.9x`. In a binary hierarchy that is
about `3.15` levels coarser. SS should handle that as a level migration or
coarsening event, not by requiring roughly `700x` more particles for the same
mass.

Near a surface, reaction front, wall, or shock, the particle may need to split
or remain fine. In coherent bulk steam, it should live naturally at a coarser
level.

## Law Adapter Contract

Every law declares:

- scale range and chart assumptions;
- read/write state families;
- exact near-field requirements;
- aggregate traversal admissibility and error bounds;
- cross-level coupling rules;
- conserved quantities and residual outputs;
- fallback policy when the current level/tile/node cannot satisfy the law.

Primary adapter modes:

- `sameLevelMpm`: same-level MLS-MPM/Ocean mechanics transfer;
- `crossLevelConservative`: restriction/prolongation between adjacent levels;
- `nearExactPairs`: contact/reaction/interface pair generation;
- `farAggregate`: Barnes-Hut/FMM-style aggregate traversal;
- `bulkCoarsen`: coherent-node merge proposal;
- `surfaceRefine`: free-surface/interface/reaction split proposal;
- `renderLod`: render proxies and optical-depth summaries.

## PeerCompute Contract

SS remains under PeerCompute ownership:

- `ComputeManager` schedules SS build/assignment/query/solver tasks.
- GPU resident lane ownership stays same-worker/same-device unless explicitly
  materialized through a portable compact snapshot.
- `StateManager` admits compact summaries and authoritative state deltas.
- Presentation consumes SS render outputs through a presentation contract; it
  does not become the physics scheduler.
- Remote peers exchange compact summaries, seeds, law plans, or portable
  snapshots, not raw browser `GPUBuffer` handles.

Suggested schemas:

- `peercompute.ulg.schroeder-tree.v0`
- `peercompute.ulg.schroeder-tree-node.v0`
- `peercompute.ulg.schroeder-level-assignment.v0`
- `peercompute.ulg.schroeder-active-node-list.v0`
- `peercompute.ulg.schroeder-law-queue.v0`
- `peercompute.ulg.schroeder-cross-level-coupling.v0`
- `peercompute.ulg.schroeder-conservation-summary.v0`
- `peercompute.ulg.schroeder-cross-level-transfer.v0`
- `peercompute.ulg.schroeder-cross-level-state-delta.v0`
- `peercompute.ulg.schroeder-cross-level-state-delta-merge.v0`
- `peercompute.ulg.schroeder-hierarchy-aggregate.v0`
- `peercompute.ulg.schroeder-hierarchy-aggregate-node.v0`
- `peercompute.ulg.schroeder-phase-volume-migration.v0`
- `peercompute.ulg.schroeder-phase-volume-level-update.v0`
- `peercompute.ulg.schroeder-phase-volume-diagnostic-summary.v0`
- `peercompute.ulg.schroeder-portable-summary.v0`
- `peercompute.ulg.schroeder-render-lod-summary.v0`
- `peercompute.ulg.schroeder-portable-summary-admission.v0`

## Implementation Slices

### Slice 0: Todo Reorg And Branch Identity

- Status: landed in `f662640`.
- Switch work to branch `SS`.
- Route `plan/todo` through this SS folder.
- Preserve older todo files as source material, but make this plan the active
  architecture for adaptive scale, hierarchy, law acceleration, and Ocean-style
  mechanics.

### Slice 1: GPU Level Assignment

- Status: landed in `f4c8e88`.
- Add ABI constants and row layouts for SS level assignment.
- Add a GPU-facing module that classifies each particle into an SS level from
  physical support radius, rest volume, represented volume, density, phase, and
  configured base grid spacing.
- Emit a retained assignment buffer and optional tiny summary counters.
- Keep readback mode `no-full-readback` by default.
- Include level hysteresis/status fields so particles do not flicker between
  levels.

### Slice 2: Per-Level Active Nodes

- Status: landed in `b41c179`.
- Convert level assignments into per-level active node/tile keys.
- Start with one chart and a bounded level range.
- Use GPU-friendly key rows and active-node lists; add sort/radix only when the
  first unsorted prototype proves the contract.

### Slice 3: Same-Level Mechanics

- Status: landed for selected-level fused/split P2G filtering in `55b3a59`,
  `9d3ea80`, `d752434`, and `e9997a3`.
- Run existing MLS-MPM/Ocean-style `P2G -> grid update -> G2P` against a single
  selected SS level.
- Preserve no-full-readback resident operation.
- Report active level, native `dx`, tile count, particle count, and fallback
  status.
- Current status: same-level mechanics forwards retained active-node lists into
  fused single-step and one-submit fused multi-step MLS-MPM resident mechanics.
  P2G/G2P consume the retained filters without full particle readback, including
  the thermal sidecar direct-runner path.

### Slice 4: Adjacent-Level Conservative Coupling

- Status: candidate row planning and orchestration landed in `82044fd` and
  `9d3ea80`; GPU-resident conservation summary rows landed in `b9d35de`;
  GPU-resident transfer rows landed in `38fd33b`; pending conservative
  source/target state-delta rows landed in `c0b980f`; StateManager-admitted
  retained merge buffers landed in `60a63c2`; SS-owned aggregate state
  contribution materialization landed in `258d7c2`; exact GPU duplicate-key
  aggregate-node reduction landed in `60d2d7e`; bounded bucket aggregate-node
  reduction for larger row counts landed in `81f51cd`.
- Add restriction/prolongation between adjacent levels.
- Conserve mass, volume, momentum, and internal energy.
- Add residual counters for bad weights, missing parent/child nodes, and
  nonconservative transfers.

### Slice 5: Phase-Volume Migration

- Status: retained GPU phase-volume migration decision rows over level
  assignments and aggregate nodes landed in `730f2ff`; StateManager-admitted
  retained level-update rows and same-level orchestration handoff landed in
  `ab1ec57`; compact GPU diagnostic summaries over admitted level updates
  landed in `3295777`; visible water-to-steam scene/status wiring landed in
  `dd3e928`; same-level/render phase-volume visibility diagnostics, admitted
  level-update consumer status, selected-level source, represented/rest volume
  ratio, expected level delta, and particle-count growth status landed in
  `f74c836`; row-aligned retained phase-volume level-update assignment overlays
  for active-node level selection landed in `3257cf4`; sparse source-particle
  overlay indexing and same-level next-tick overlay descriptors landed in
  `4a4e6f0`; same-device scene feedback caching, resident-step scheduling
  consumption, local-only summary diagnostics, and retained overlay preservation
  landed in `f06ed2d`; browser-mounted admission threading, following-tick
  feedback consumption proof, status-line telemetry, and a browser WGSL
  reserved-identifier fix landed in `fa9aed0`; resident-authority publication
  for state-delta merge and phase-volume migration admissions, scene
  auto-publication, and browser proof without test-local admission descriptors
  landed in `2aa8da6`. The SS phase-volume reference-mass checkpoint reuses
  mechanics row 31 for `phaseVolumeReferenceMassKg`, derives that mass from
  condensed-phase density for expansive gas/plasma phases, feeds it into the
  GPU level-assignment represented-volume path, publishes compact diagnostics
  through resident same-level mechanics, and adds URL-scheduled browser
  coverage showing H2O steam at about `680x` represented/rest volume, expected
  level delta about `3.14`, particle-count growth `1x`, and no full particle
  readback. The follow-up authority-ordering checkpoint keeps the level
  assignment source level derived from current mechanics volume, carries
  `phaseVolumeReferenceMassKg` only as represented volume for migration, and
  makes the StateManager-admitted phase-volume overlay the source of the
  positive level update; the mounted H2O steam proof now reports source level
  `0`, target level up to `2`, `phase-migration=changed`, and no full
  readback. The aggregate-coherence checkpoint adds a dedicated GPU
  phase-volume target aggregate producer over retained level-assignment rows,
  reuses the hierarchy aggregate-node reducer to materialize target-cell nodes,
  and feeds those nodes into phase-volume migration without changing the main
  far-field hierarchy aggregate source. The URL H2O steam proof now requires
  positive coarsen-eligible and aggregate-coherent counts, zero refine-required
  rows, zero conservation residual issues, particle-count growth `1x`, and no
  full readback. The refine-pressure checkpoint keeps the 32-float row ABI but
  replaces spare fields with a GPU-produced `refinePressureReasonMask` plus
  compact summary `refinePressureCount/refinePressureReasonMask` fields. Coherent
  bulk H2O steam remains coarsened only when the pressure mask is zero; aggregate
  missing/interface, conservation residual, and sparse-surface preservation bits
  now gate refine-required rows before any split/merge mutation path exists.
  The split/merge proposal checkpoint adds retained GPU
  `schroeder-phase-volume-split-merge-proposal` rows after migration: coarsen
  rows become merge proposals, refine-pressure rows become split proposals, and
  every row carries deferred zero momentum/internal-energy deltas plus
  `stateAdmissionRequired`/`mutationDeferred` fields. Same-level mechanics
  forwards the proposal descriptor to the resident step, but no particle-count
  mutation occurs before a future StateManager-admitted apply stage.
- Drive support/level changes from phase/density/temperature/pressure changes.
- Use water-to-steam expansion as the first visible stress case.
- Coarsen coherent bulk steam without exploding particle count.
- Refine or preserve fine particles near interfaces, reactions, walls, and
  high-gradient flow.

### Slice 6: Law Work Queues

- Status: retained active-node local law-queue descriptors landed in `f7cf080`.
  Same-level mechanics orchestration and resident backend forwarding landed in
  `8491fb5`. SPH reaction proposal gating over retained queue rows landed in
  `6e275e0`. Pressure/interface contact-kinematics queue gating landed in
  `b1b2206`. Retained GPU `schroeder-law-neighbor-candidate` rows and
  same-level orchestration forwarding landed in `ae7f7d3`. Reaction and
  pressure/interface consumers validate retained neighbor candidate artifacts
  in `9f6f961`. Active-node tile traversal over retained support-inflated rows
  landed in `126f5d1`, replacing the source-index candidate window while
  leaving sorted/radix tree indexing as future work. Direct retained candidate
  consumption in reaction proposal and pressure/interface contact-kinematics
  kernels landed in `a6315c1`. Retained per-particle source-span rows for
  candidate lookup landed in `c22ed0a`. A retained bucketed active-node tile
  anchor index landed in `6e7f5dc` as an opt-in GPU-resident orchestration
  artifact. Law-neighbor traversal consumes that retained index with exact
  full-scan fallback in `1aa16a4`. Compact retained traversal diagnostics
  landed in `255a67d`. Traversal policy/status escalation landed in `1ce29da`.
- Replace fixed reaction/contact/interface neighbor bins with SS near-exact
  queues.
- Preserve sedenion/reaction scoping and strict reaction gates.
- Add aggregate masks to skip impossible pairs before exact validation.
- Current caveat: reaction and pressure/interface contact now consume
  traversal-backed candidate artifacts as authoritative input. The candidate
  producer emits retained source-span rows so reaction avoids whole-buffer
  candidate scans when spans are present. The producer now tries retained
  bucketed active-node matches before falling back to an exact non-bucket row
  scan, so the index is consumed without becoming a correctness bottleneck.
  Traversal diagnostics now count bucket attempts/hits, exact fallback scans,
  inactive rows, bucket pressure, and source-span writes; compact readback is
  opt-in and the default hot path remains no-full-readback. The policy layer
  now reports the actually applied traversal mode separately from the
  recommended sorted/radix mode. A retained sorted/radix active-node index and
  law-neighbor consumer path landed in `f48631f`; it is currently opt-in from
  same-level orchestration or supplied as a retained artifact. Policy-driven
  automatic construction landed in `f29951e`, with disabled, auto, force, and
  diagnostic-driven selection reported in same-level summaries.
  The current pressure/interface source-span checkpoint binds retained
  source-candidate span rows directly into the pressure contact-kinematics
  kernel, advertises the span table as the pressure/interface spatial-index
  descriptor, and prevents implicit full candidate scans when a retained
  source-span descriptor is absent. The follow-up interface-source checkpoint
  adds explicit `sph-interface-source-key` sidecar rows so pressure contact
  kinematics can resolve source-span keys from retained interface/source
  descriptors instead of overloading `surfaceIndex`; legacy fields still have a
  controlled surface-index fallback. The source-key production checkpoint adds
  a source-local source-index accumulator, emits compact candidate
  `sph-interface-source-key` rows keyed by compact interface element index, and
  carries the retained buffer through resident material-interface state for
  same-device pressure-interface consumption. The retained-ref admission
  checkpoint declares `sph-interface-source-key-buffer` as an optional
  pressure-interface input descriptor in ComputeManager GPU lane tasks, worker
  stage retained refs, pressure-stage evidence, and worker publication
  summaries; older material-interface fields remain valid without the sidecar.
  SS source-key replay diagnostics landed in `fbc05ee`: pressure-interface
  tasks now expose descriptor-only source-key replay inputs, scene/demo
  summaries show source-key production, retained-ref publication, and pressure
  consumer status together, and portable replay diagnostics explicitly avoid
  raw `GPUBuffer` serialization.

### Slice 7: Far-Field Aggregate Laws

- Status: retained far-aggregate candidate row ABI, WGSL producer, WebGPU
  runner, same-level orchestration forwarding, and descriptor-only portable
  summary propagation landed in `0fee1ef`; retained read-only far-aggregate
  force-summary rows landed in `0773c25`; compact far-aggregate diagnostic
  summaries over those force rows landed in `70e21ce`; StateManager-admitted
  retained far-force application delta rows landed in `f91259b`; resident
  SPH-state fusion of admitted far-force deltas landed in `ed15162`;
  StateManager-admitted read-only radiation/plasma/gas-summary consumer rows
  landed in `4a586fc`; compact diagnostics over those law-consumer rows landed
  in `35779c2`; explicit far-field consumer authority policy landed in
  `794e4aa`; admitted gas-pressure state-delta rows landed in `b3f62cf`;
  retained pressure-interface gas-cell row materialization landed in
  `8d87b5b`; direct pressure-interface WebGPU consumption of retained SS
  gas-cell rows landed in `bbd4bdf`; same-level/scene promotion of retained SS
  gas-cell imports into pressure-interface scheduling landed in `04d7627`.
- Add Barnes-Hut/FMM-style traversal for laws with physical aggregate error
  bounds: gravity, radiation, plasma/electromagnetic approximations, gas
  far-field summaries.
- Do not use aggregate traversal for local incompressibility or reactions.
- Current caveat: `0fee1ef` emits read-only aggregate-admissible candidate
  descriptors from active nodes and retained hierarchy aggregate nodes.
  `0773c25` adds the first read-only gravity-like acceleration/potential
  summary over those candidate rows with explicit error-bound telemetry.
  `70e21ce` adds a compact diagnostic reducer for active/empty sources,
  overflow, blocked work, opening-ratio pressure, error-bound pressure, max
  acceleration/potential, and readback-free descriptor propagation. `f91259b`
  adds the first admitted application stage, and `ed15162` fuses those admitted
  rows into a retained resident SPH state buffer after G2P without default full
  particle readback. `4a586fc` adds the first read-only law-consumer adapter
  rows for radiation, plasma/electromagnetic approximation, and gas-summary
  proxies. `35779c2` compacts those rows into retained pressure/exposure
  diagnostics for admission/policy decisions. `794e4aa` adds the fail-closed
  authority policy over those diagnostics: read-only remains the default, and
  opt-in state-delta mutation only reports that a future StateManager-admitted
  delta path is required. `b3f62cf` adds the first admitted gas-pressure
  state-delta path: retained rows carry gas density, pressure, represented
  volume, pressure-work proxy, authority/admission status, and pressure import
  intent through same-level, resident, and portable descriptor paths without
  full particle readback. `8d87b5b` materializes those admitted rows into
  retained pressure-interface gas-cell rows using far-force summary centers,
  forwards the retained gas-pressure-cell descriptor through same-level,
  resident, and portable summary paths, and leaves CPU gas-cell snapshots as
  explicit diagnostic/import materialization rather than the hot-path bridge.
  `bbd4bdf` connects that retained row artifact to the pressure-interface
  WebGPU force-row producer: the stage normalizes SS gas-cell import artifacts
  as retained local pressure-gradient inputs, binds the borrowed
  gas-pressure-cell buffer at the existing gas-cell storage binding, and skips
  CPU gas-cell snapshot/upload plumbing on the no-full-readback path.
  `04d7627` promotes the retained SS gas-cell artifact out of same-level
  resident execution into the scene pressure-interface state, converts it into
  the existing pressure-interface import descriptor while preserving the SS
  source schema and GPU buffer handle, and adds the retained gas-cell buffer to
  resident cleanup preservation. `c0707cb` then surfaces retained-row pressure
  reuse telemetry through lane summaries, pressure-interface worker publication
  candidates, and mounted worker-lane reports, including explicit
  retained/borrowed row consumption status without trying to transfer
  main-thread `GPUBuffer` handles into the dedicated worker lane. `0a91ae6`
  reuses retained SS gas-cell imports as descriptor-backed pressure-feedback
  inputs: retained GPU rows are accepted as local-gradient-ready but
  unvalidated gas-cell fields without CPU cell snapshots, and scene pressure
  refreshes inject promoted SS imports into next-frame same-level feedback.
  `3df3470` adds the worker-owned pressure import path for dedicated mounted
  worker lanes: worker services resolve descriptor-only retained gas-cell refs
  against same-lane worker-local GPU buffers, mounted lanes keep a persistent
  worker runner instead of recreating it each schedule, and mounted mechanics
  runs can include the pressure/interface stage without posting main-thread
  `GPUBuffer` handles across the PeerCompute boundary.

### Slice 8: Render And Distribution

- Status: descriptor-only portable SS summary planning and same-level mechanics
  forwarding landed in `ba87e41`; render ownership consumption and
  StateManager/resident-authority admission landed in `10d1f5c`; scene/render
  source metadata materialization landed in `df261c7`; compact render proxy
  descriptor plans landed in `24ecd87`; renderer-visible proxy consumer binding
  landed in `9b31697`; descriptor-batched proxy draw-source contracts landed
  in `5b54457`; proxy backend selection landed in `4316da6`; the native
  retained-proxy WebGPU executor landed in `bdc48a5`; deterministic retained
  descriptor keys and the same-device-only local render-buffer resolver landed
  in `50337ae`; live native-surface render-pass submission with camera uniforms
  and bridge diagnostics landed in `6fc8f85`; browser validation and
  presentation-worker preemption bypass for explicit native same-device
  consumer refreshes landed in `efe73dc`; opt-in scene resident execution
  through `runSchroederSameLevelMechanicsWebGpu` plus native SS proxy draw
  validation landed in `b573ccd`; URL/PeerCompute-style app configuration,
  resident auto-scheduler wiring, visible SS telemetry, and no-full native
  auto-refresh for URL-configured SS retained proxy draws landed in `9699d58`;
  compact SS execution/render-proxy telemetry in the long-horizon probe and
  performance benchmark landed in `6fa1fec`; diagnostic CPU proxy selection was
  restricted to explicit admitted, under-budget, metadata-only diagnostic use
  in `fc99828`; descriptor-only SS portable-summary replay descriptors and
  seeds landed in `f26f895`; bucket-first traversal/index policy telemetry
  landed in `ff29727`.
- Generate render/optical LOD from SS leaves and coherent nodes.
- Keep PBR/optics derived from material closures.
- Export compact SS summaries/snapshots for PeerCompute replay.

## Current Implementation Queue

1. Far-field aggregate laws:
   - consume worker-owned retained gas-cell descriptors from mounted worker
     lanes without cloning or posting main-thread `GPUBuffer` handles;
   - keep local incompressibility, reaction, contact, and interface laws on the
     exact-near-field queue path;
   - keep radiation, plasma/electromagnetic approximation, and gas-summary
     consumers under law-specific admissibility and compact diagnostics.
2. Render and distribution:
   - keep draw sources closure/PBR-derived and no-full-readback by default;
   - keep StateManager admissions and replay descriptors descriptor-only across
     PeerCompute boundaries.
3. Law work queues:
   - keep pressure/interface contact kinematics on retained source-span indexed
     candidate ranges; no implicit full candidate scan without an explicit
     broad-fallback flag;
   - feed pressure/interface contact kinematics explicit interface source-key
     descriptors when available, preserving surface-index fallback only for
     legacy/non-particle-backed interface fields;
   - keep compact traversal diagnostics as the escalation input rather than
     making sorted/radix the unconditional small-scene path;
   - preserve strict reaction gates, sedenion scoping, and material/phase masks;
   - keep exact near-field candidates for small diagnostic scenes.
4. Phase-volume migration:
   - use resident-authority-published phase-volume/state-delta admissions as
     the default scene/demo path;
   - keep water-to-steam expansion visible in compact diagnostics without
     particle explosion;
   - keep future phase-volume level changes StateManager-admitted: source
     assignment levels come from current mechanics volume, while represented
     phase volume drives the retained migration target level;
   - materialize phase-volume target aggregate nodes from retained assignment
     rows before migration so coherent bulk phase expansion can coarsen without
     requiring a prior cross-level merge aggregate;
   - preserve fine representation near surfaces, reactions, and walls.

## Acceptance Gates

- The default SS hot path performs no full particle readback.
- Level assignment is derived from physical state, not UI role or renderer size.
- A `700x` phase-volume expansion can migrate about three hierarchy levels
  without requiring `700x` particles for the same mass.
- Same-level mechanics conserves mass and constant velocity fields.
- Cross-level coupling reports bounded conservation residuals.
- Reaction/contact/interface candidates are not missed in small brute-force
  diagnostic scenes, but brute force is a diagnostic, not the primary
  implementation route.
- Dense local regions can still use Ocean-style atomic/tiled kernels.
- PeerCompute can identify SS build/query/solver epochs and StateManager
  admission boundaries.

## What Becomes Moot

- The CPU-reference-first adaptive MLS-MPM route.
- The external-only generalized spatial tree framing.
- More fixed one-off neighbor grids for each new law.
- Treating material-interface dense/source-local fields as a long-term spatial
  strategy.
- Solving phase expansion by changing renderer particle sizes or initializer
  spacing.
- Treating Ocean-style mechanics as the whole architecture instead of a dense
  local backend inside SS.

## What Remains Active

- PeerCompute law authority and StateManager admission.
- GPU resident lane ownership and same-worker retained hot-buffer contracts.
- Ocean-style high-throughput dense local P2G/grid/G2P.
- Derived material, optical, reaction, and thermal closures.
- PBR correctness and transparent/refractive rendering.
- Reaction energetics and sedenion reaction scoping.
- Visual sequence sanity checks after major physics changes.

## Current Work Target

Completed in this slice:

1. Added `peercompute.ulg.schroeder-phase-volume-split-merge-admission.v0`
   and retained GPU `schroeder-phase-volume-split-merge-apply` rows gated by
   StateManager admission.
2. Added split/merge apply plans, params, WGSL, WebGPU execution, same-level
   mechanics forwarding, and status telemetry. The stage preserves
   mass/represented-volume intent, particle-count deltas, and proposal
   momentum/internal-energy continuity rows without CPU readback.
3. Kept actual particle storage resizing deferred to a future StateManager
   allocator so proposal/apply rows cannot silently mutate particle buffers.

Completed in this slice:

1. Added `peercompute.ulg.schroeder-particle-storage-allocator-admission.v0`
   and retained GPU `schroeder-particle-storage-allocation` rows.
2. Added allocator admission checks for output family, row count, target
   particle-state/mechanics/thermo families, and capacity approval.
3. Added allocation-intent plans, params, WGSL, WebGPU execution, same-level
   forwarding, and status telemetry. Slot indices intentionally remain
   sentinel values until a concrete free-list/compaction pass assigns them.

Completed in this slice:

1. Added `peercompute.ulg.schroeder-particle-storage-free-list.v0`,
   `peercompute.ulg.schroeder-particle-storage-slot-assignment-admission.v0`,
   `peercompute.ulg.schroeder-particle-storage-slot-assignment.v0`, and
   retained GPU `schroeder-particle-storage-slot-assignment` rows.
2. Added a retained free-list descriptor and a StateManager-admitted
   slot-assignment producer that consumes allocation-intent rows and assigns
   concrete target/free slot ranges on GPU without default particle readback.
3. Threaded slot-assignment execution through same-level SS mechanics and
   resident-step forwarding while keeping particle buffer writes deferred.

Completed in this slice:

1. Added
   `peercompute.ulg.schroeder-particle-storage-materialization-admission.v0`,
   `peercompute.ulg.schroeder-particle-storage-materialization.v0`, and
   retained GPU `schroeder-particle-storage-materialization` rows.
2. Added a StateManager-admitted GPU materialization pass that consumes
   slot-assignment rows, initializes retained output SPH state, SPH thermo, and
   MLS-MPM mechanics buffers, writes assigned target slots, and marks freed
   source slots without default particle readback.
3. Threaded the retained materialized particle buffers and compact
   materialization metadata through same-level SS mechanics and resident-step
   forwarding while leaving the authoritative state swap as a separate owner
   decision.

Completed in this slice:

1. Teach the resident/state-manager authority path to adopt admitted retained
   materialized particle buffers as the next authoritative particle storage.
2. Added fail-closed resident adoption telemetry, target-family checks,
   next-particle count propagation, buffer lease tracking, and cleanup ownership
   for retained materialized SPH state, SPH thermo, and MLS-MPM mechanics
   buffers.
3. Preserved the URL-scheduled H2O steam proof target: expected level delta > 2,
   observed admitted update delta > 0, represented/rest volume > 100,
   coarsen/aggregate-coherent counts > 0, refine-required count 0 for coherent
   bulk, refine-pressure count/mask 0 for coherent bulk, particle growth <= 1,
   no full readback, and status telemetry separating expansion detection from
   level-update deltas.

Completed in this slice:

1. Added `peercompute.ulg.schroeder-adopted-particle-storage-descriptor.v0`
   as a descriptor-only handoff for StateManager-admitted materialized particle
   storage.
2. Threaded adopted materialized particle storage through resident
   step/sequence compute-task results and commit-delta payloads without
   serializing raw GPUBuffer handles.
3. Extended resident commit-bridge admission so StateManager warm-delta commits
   validate descriptor schema, copy mode, raw-transfer flags, authoritative
   particle count, and warm-entry replay consistency.

Completed in this slice:

1. Added `peercompute.ulg.schroeder-adopted-particle-storage-hot-buffer-publication.v0`
   and the `ulg-schroeder-adopted-particle-storage-publications` StateManager
   scope.
2. Added browser resident-host publication for accepted SS adopted particle
   storage descriptors. The hot-buffer record and warm delta carry only
   descriptor/admission/lease evidence, not retained GPUBuffer handles.
3. Added fail-closed validation that rejects malformed descriptors, wrong copy
   modes, raw-transfer flags, or actual raw buffer handle fields before
   StateManager hot-buffer storage or commit.

Completed in this slice:

1. Added `peercompute.ulg.schroeder-adopted-particle-storage-continuation-plan.v0`.
2. Added a browser resident-host planner that consumes the published hot-buffer
   descriptor and reports same-device private-lane continuation readiness
   separately from cross-peer portable replay readiness.
3. Same-device consumers can use retained descriptor refs as private-lane
   continuation evidence. Cross-peer consumers stay blocked until a portable
   snapshot or peer-local materialization seed is supplied.

Completed in this slice:

1. Feed the continuation plan into resident task construction so same-device
   use cases can request the adopted storage hot-buffer descriptor explicitly.
2. Keep cross-peer scheduling fail-closed unless the plan reports portable
   materialization/snapshot readiness.
3. Add tests proving the scheduler chooses same-device continuation for local
   descriptor refs and refuses cross-peer adopted-storage execution without a
   portable replay source.

Completed in this slice:

1. Added
   `peercompute.ulg.schroeder-adopted-particle-storage-local-resolver.v0`
   diagnostics and a same-device retained-buffer resolver binding for scheduled
   adopted-storage continuations.
2. Bound resolved local retained refs into mechanics P2G stage uploads so valid
   same-device adopted storage can feed resident stage tasks without stale CPU
   mirrors or raw GPUBuffer PeerCompute transfer.
3. Kept missing local refs fail-closed for the stage scheduler and added tests
   for both valid same-device resolver consumption and unresolved-ref blocking.

The next code slice on `SS` is **SS adopted storage resident-host resolver
hookup**:

1. Add a browser resident-host resolver surface that maps admitted
   adopted-storage descriptor refs to local retained buffers on the same device.
2. Thread that resolver into browser-mounted resident scheduling so descriptor
   hot-buffer publication, continuation planning, and mechanics stage execution
   form one local same-device path.
3. Add integration tests proving host-planned same-device refs resolve locally
   while missing refs and cross-peer consumers remain blocked without portable
   materialization evidence.
