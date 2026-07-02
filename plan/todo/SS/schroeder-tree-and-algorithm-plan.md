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
- Current caveat: active-node tiles are planned and exposed, but same-level
  mechanics still uses dense resident MLS-MPM dispatch over the selected level;
  active-node consumption inside P2G/G2P remains future work.

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
  `dd3e928`.
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
  recommended sorted/radix mode, so sorted/radix remains explicit until the real
  index kernel exists.
  Pressure/interface contact-kinematics still needs a spatial/interface index
  rather than only a source-particle span.

### Slice 7: Far-Field Aggregate Laws

- Add Barnes-Hut/FMM-style traversal for laws with physical aggregate error
  bounds: gravity, radiation, plasma/electromagnetic approximations, gas
  far-field summaries.
- Do not use aggregate traversal for local incompressibility or reactions.

### Slice 8: Render And Distribution

- Generate render/optical LOD from SS leaves and coherent nodes.
- Keep PBR/optics derived from material closures.
- Export compact SS summaries/snapshots for PeerCompute replay.

## Current Implementation Queue

1. Law work queues:
   - implement the sorted/radix active-node index selected by traversal policy;
   - keep compact traversal diagnostics as the escalation input rather than
     making sorted/radix the unconditional small-scene path;
   - preserve strict reaction gates, sedenion scoping, and material/phase masks;
   - keep exact near-field candidates for small diagnostic scenes.
2. Active-node mechanics consumption:
   - direct retained active-node filtering is now landed for fused single-step
     P2G/G2P mechanics;
   - extend the same direct filtering to fused multi-step sequence batches when
     SS begins scheduling multi-level mechanics through that path;
   - keep fused no-full active-grid behavior readback-free and avoid
     presentation-owned physics cadence.
3. Phase-volume migration:
   - consume/report admitted retained level-update rows from the SS path;
   - make water-to-steam expansion visibly migrate levels without particle
     explosion;
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

The next code slice on `SS` is **SS sorted/radix active-node indexing**:

1. Add a retained GPU active-node ordering/index artifact that can serve
   law-neighbor traversal without bounded bucket overflow.
2. Keep the first implementation GPU-first and no-full-readback; use compact
   summaries/counters, not a CPU mirror tree.
3. Wire policy-selected sorted/radix mode into law-neighbor traversal only when
   the retained sorted/radix artifact exists and validates its schema/status.
4. Keep the existing bucket index as the default small-scene path.
