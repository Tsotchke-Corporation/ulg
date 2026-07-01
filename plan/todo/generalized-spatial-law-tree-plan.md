# Generalized Spatial Law Tree Plan

Date: 2026-07-01 AKDT

## Purpose

Introduce a GPU-resident hierarchical spatial tree as the shared acceleration
structure for ULG particle laws. The target is a Barnes-Hut-style architecture
generalized beyond gravity: local exact interactions stay exact, long-range or
coarse interactions use aggregate nodes, and every law consumes the same
state-authorized spatial index instead of building one-off grids, bins, dense
fields, or renderer-only summaries.

This plan does not replace the PeerCompute law graph or StateManager authority.
It gives ComputeManager/GPU-resident lanes a common spatial execution artifact
that can support:

- adaptive particle support and coarsening;
- dynamic grid/tile sizing;
- O(N log N) broad-phase and long-range traversal where the law permits it;
- exact near-field pressure/contact/reaction support where approximation would
  violate physics;
- GPU-native render LOD and material-interface queries;
- portable summaries/checkpoints for distributed PeerCompute workloads.

## Core Claim

The current path has too many law-specific spatial structures:

- MLS-MPM active grid and support stencils;
- reaction fixed-capacity neighbor bins;
- material-interface source-local fields;
- render fields and compact candidates;
- product-event/product-mass sidecars;
- future gravity/radiation/plasma fields;
- visual particle/surface LOD.

A generalized tree can make these one spatial substrate. This reduces duplicated
work, exposes adaptive scale cleanly, and gives PeerCompute a single
state-family contract for spatial acceleration instead of many hidden
scene-local helper grids.

## Important Correction

Barnes-Hut is not a universal replacement for all physics kernels.

- For long-range laws such as gravity, radiation transport, gas far-field
  pressure approximations, and some electromagnetic/plasma approximations, the
  tree can use multipole/aggregate nodes and reach O(N log N) behavior.
- For local continuum laws such as MLS-MPM P2G/G2P, contact, incompressibility,
  reactions, and material interfaces, the tree is mainly a broad-phase,
  adaptive-domain, and tile/sparse-grid builder. The near field still needs exact
  support overlap and conservation-preserving transfer.
- For dense local MPM regions, an Ocean-style particle-parallel/atomic/tiled
  grid backend may still beat tree traversal. The tree should select and feed
  that backend, not compete with it.

So the goal is a `SpatialLawTree` that can drive multiple law adapters:

```text
particle/product/gas state
  -> GPU Morton/LBVH/loose-octree build
  -> node aggregate up-sweep
  -> law-specific traversal or tile extraction
      -> MLS-MPM exact local P2G/G2P support/tile backend
      -> reaction/contact near-field pairs
      -> material-interface source/candidate extraction
      -> gas/radiation/gravity far-field aggregate traversal
      -> render LOD/surface seed generation
  -> retained GPU outputs + compact summaries
  -> StateManager admission at epoch/checkpoint boundaries
```

## Architecture Contract

Add a new state family and artifact family:

- `spatial-tree`: retained GPU tree buffers, local-only by default.
- `spatial-tree-summary`: compact admitted warm state; no raw browser GPU
  handles.
- `spatial-tree-build-epoch`: a ComputeManager task/lease boundary that declares
  which particle/product/gas state snapshot produced the tree.
- `spatial-tree-law-query`: law-specific traversal outputs with read/write
  family metadata.

Suggested schemas:

- `peercompute.ulg.spatial-law-tree.v0`
- `peercompute.ulg.spatial-law-tree-build-epoch.v0`
- `peercompute.ulg.spatial-law-tree-node-aggregate.v0`
- `peercompute.ulg.spatial-law-tree-query-plan.v0`
- `peercompute.ulg.spatial-law-tree-portable-summary.v0`

The tree is an execution artifact, not a scheduler:

- `ComputeManager` schedules tree build and law queries.
- `GpuResidentLaneManager` owns same-worker/same-device tree buffers.
- `StateManager` admits compact summaries and authoritative law results.
- Presentation can read retained local tree/render outputs only through a
  presentation contract.
- Remote peers exchange compact summaries, seeds, or snapshots; they never
  exchange browser `GPUBuffer` handles.

## Tree Data Model

Each leaf should represent one particle, product event, gas parcel, or admitted
macro-particle. Each leaf carries:

- particle/product id and state-family source;
- material id, phase id, reaction/product/gas flags;
- position, velocity, mass, volume, support radius, visual radius;
- rest density/current density, temperature, pressure, energy;
- AABB/support bounds and render-domain id;
- source epoch, lane id, and validity flags.

Each internal node should aggregate:

- AABB and support-inflated bounds;
- total mass, center of mass, momentum, angular/affine momentum where available;
- phase/material histograms or dominant/coherent material flags;
- total internal energy and temperature bounds;
- pressure/gas/product inventory summaries;
- charge/polarization/radiation/opacity moments where the relevant law enables
  them;
- LOD/coarsening admissibility flags;
- error estimates and conservation residuals.

Use a GPU-friendly construction first:

- Morton-code or LBVH leaves for build throughput;
- optional loose-octree levels for variable support radii;
- radix sort or existing GPU sort primitive when available;
- bottom-up aggregate reduction;
- compact active-node lists per law.

Do not start with pointer-heavy CPU trees.

## Law Adapter Rules

Each law adapter declares a traversal policy:

- `nearExact`: support-overlap or cell/leaf exact pair work;
- `farAggregate`: Barnes-Hut opening angle or law-specific error bound;
- `tileExtraction`: produce sparse grid/tile worklists for Ocean-style kernels;
- `lodRender`: produce render proxy rows/surface seeds;
- `coarsening`: propose split/merge candidates, but not commit them.

Required adapters:

1. MLS-MPM/SPH mechanics.
   - Use tree leaves/support bounds to produce active tiles and support-tier
     worklists.
   - Keep exact local P2G/G2P transfer for particles whose support overlaps a
     tile.
   - Route dense tiles to Ocean-style atomic P2G/grid/G2P.
   - Use tree aggregates only for admitted macro-particles or coarse far-field
     correction terms, not for local incompressibility.

2. Adaptive support and coarsening.
   - Use coherent internal nodes as merge candidates.
   - Reject candidates near free surfaces, material/phase boundaries, walls,
     active reactions, high gradients, or incompatible thermo state.
   - Proposals must pass mass, momentum, center-of-mass, volume, energy, `F`,
     `J`, affine `C`, and material/phase metadata invariants before StateManager
     admission.

3. Reaction/contact broad phase.
   - Replace fixed-capacity reaction bins with tree-generated near-field
     candidate pairs.
   - Keep exact candidate validation and sedenion/reaction-family scoping.
   - Use aggregates only to skip impossible material/phase pairs or to summarize
     gas/product inventory, not to invent reactions.

4. Material interface and pressure.
   - Replace per-surface dense/source-local field scans with tree traversal over
     support bounds.
   - Emit exact near-surface candidate rows and compact interface patches.
   - Let gas/product pressure use tree aggregate summaries where the law admits a
     continuum approximation.

5. Rendering and optical LOD.
   - Build render rows/proxies from tree leaves and coherent nodes.
   - Permit far/coherent same-material nodes to render as instanced proxies or
     surface seeds.
   - Preserve derived PBR/optical closures; do not use tree LOD as a material
     color patch.

6. Gravity/radiation/plasma future laws.
   - Use true Barnes-Hut/FMM-style traversal where aggregate node error bounds
     are physically defined.
   - Keep law-specific validation separate from mechanics.

## Relationship To Ocean-Style Kernels

The tree direction should not delete the WebGPU-Ocean todo. It changes its role.

Ocean-style kernels become the dense-local backend for mechanics tiles:

```text
SpatialLawTree
  -> active tile extraction
  -> dense tile work queues
  -> Ocean-style particle-parallel atomic P2G
  -> grid update
  -> G2P
```

The tree solves dynamic sizing, sparse domains, broad-phase, LOD, and
cross-law reuse. Ocean-style kernels solve high-throughput local transfer inside
selected tiles. A 100k-particle target probably needs both.

## Todo Audit And Routing Changes

The following `plan/todo` files are affected by this direction:

| Todo | Effect |
| --- | --- |
| `adaptive-mlsmpm-support-radius-and-coarsening-plan.md` | Absorbed as the conservation/adaptive-support gate for tree coarsening. Not moot; its invariants become mandatory acceptance criteria. |
| `webgpu-ocean-mlsmpm-simulator-plan.md` | Re-scoped as the dense-tile mechanics backend fed by the tree. Not moot. |
| `gpu-resident-lanes-and-warm-services-plan.md` | Remains active. The tree must run inside this lane model and not become a scheduler. |
| `peercompute-law-graph-authority-plan.md` | Remains active. Add `spatial-tree` as a law graph state/artifact family. |
| `physics-loop-authority-diagrams.md` | Remains active; diagrams should later add tree build/query between packed state and law stages. |
| `reaction-stoichiometry-energetics-plan.md` | Partially absorbed for reaction neighbor search, product-event append/compaction, and gas summaries. Chemistry/energetics remain independent. |
| `reaction-variable-particle-scale-stability-plan.md` | Partially absorbed by tree coarsening and support-tier invariants. Reaction-specific scale policy remains. |
| `cubic-barrier-contact-integration-plan.md` | Tree supplies broad-phase/contact candidate worklists. The exact barrier law remains independent. |
| `phase-resolved-steam-optics-plan.md` | Tree can supply gas/steam LOD and optical depth aggregates. Phase/optical derivation remains independent. |
| `particle-pbr-material-closure-rendering-plan.md` | Tree can supply render LOD/proxy generation. PBR/material closure correctness remains independent. |
| `drop-edge-large-size-respect-plan.md` | Mostly unaffected for initializer semantics; future coarsening should use tree admission instead of changing requested edges. |
| `physics-behavior-regression-plan.md` | Remains the visible sanity gate for any tree-backed physics. |
| `resident-state-authority-contract-plan.md` | Remains active; tree outputs need explicit authority/owner records. |
| `webgpu-material-property-resolvers-plan.md` | Mostly unaffected; tree consumes packed closure rows after they are resolved. |
| `algorithm-derived-material-properties-plan.md` | Mostly unaffected; material derivation remains input to tree leaves/nodes. |
| `material-property-json-bank-plan.md` | Mostly unaffected; cache/bank rows feed leaves and aggregate metadata. |
| `material-polytope-registry-and-property-fit-plan.md` | Mostly unaffected; may later provide aggregate material error bounds. |
| `sedenion-reaction-scoping-plan.md` | Unaffected except tree traversal can use its masks to prune candidate pairs. |
| `distributed-peercompute-network-stack-plan.md` | Unaffected at the network layer; tree portable summaries become another payload type. |
| `cold-start-cache-performance-plan.md` | Partially affected for caching compiled tree pipelines and warm tree layout templates. |
| `electron-cloud-material-derivation-visualization-plan.md` | Unaffected for derivation; may consume tree LOD for visualization later. |
| `frontier-todo.md` | Its O(N^2) performance note is superseded by this plan for particle-law broad-phase. |
| `overarching-completion-plan.md` and `sphphasedemo.md` | Need routing updates after the first tree slice lands. |

What becomes moot immediately:

- Treating fixed reaction bins, material-interface dense/source-local fields, and
  active-grid policies as separate long-term spatial systems.
- Adding more one-off neighbor/broad-phase grids per law.
- Trying to solve adaptive particle support solely with renderer particle size or
  initializer spacing.
- Treating Ocean-style mechanics as a whole-system architecture replacement
  rather than a tile backend.

What does not become moot:

- PeerCompute state/task/presentation separation.
- StateManager admission and compact portable snapshot work.
- Conservation-safe adaptive support tests.
- Exact near-field laws for pressure, contact, reactions, and incompressibility.
- Derived material, optical, thermal, and reaction closure correctness.

## Implementation Slices

### Slice 0: Source Audit And Contracts

- Add `SpatialLawTree` design notes to the law graph manifest path.
- Define state families: `spatial-tree`, `spatial-tree-summary`,
  `spatial-tree-query-output`.
- Add tests that no tree-backed law output can commit without source epoch,
  state-family reads/writes, and conservation metadata.
- Add benchmark fields for tree build time, query time, retained bytes, compact
  summary bytes, and zero full-readback status.

### Slice 1: CPU Reference Tree

- Implement a deterministic CPU loose-octree/LBVH reference for particles and
  product events.
- Validate AABB/support overlap, material/phase aggregate flags, center of mass,
  total mass, momentum, and energy summaries.
- Add exact near-field pair queries and aggregate far-field traversal with a
  configurable opening criterion.
- Do not integrate it into the hot browser loop yet.

### Slice 2: GPU Tree Build

- Add GPU leaf packing, Morton keys, sort/build, and aggregate up-sweep.
- Keep output retained on the GPU; read back only compact summaries in explicit
  validation mode.
- Gate with 1k, 10k, 50k, and 100k build/query benchmarks.
- Require no browser console issues and no full particle readback.

### Slice 3: Reaction/Contact Broad-Phase Adapter

- Replace or bypass fixed-capacity reaction bins with tree near-field candidate
  generation.
- Preserve sedenion/material scoping and strict reaction gates.
- Prove identical materials do not react, Cs/F-style elemental pairs remain
  discoverable, and multiple generations of product events can append/compact
  without full readback.

### Slice 4: Material Interface/Pressure Adapter

- Use tree support bounds and aggregate material/phase flags to produce compact
  interface candidate patches.
- Replace source-local field splatting as the default steady-state path.
- Keep exact near-field validation for pressure/contact rows.
- Benchmark against the current `webgpu-source-local` material-interface path.

### Slice 5: Mechanics Tile Adapter

- Use the tree to emit active tile work queues and support-tier worklists.
- Feed dense/coherent tiles into Ocean-style atomic P2G/grid/G2P.
- Keep exact MLS support overlap and partition-of-unity tests.
- Add fixed-support vs tree-tile A/B comparisons for H2O/H2O, Na/H2O, Cs/F, and
  sparse gas/product scenarios.

### Slice 6: Conservation-Safe Coarsening

- Promote coherent internal tree nodes to merge candidates only when all
  invariants pass.
- Reject boundary, free-surface, wall, reaction, temperature-gradient,
  phase-mixed, and material-mixed nodes.
- Add split/merge cycling tests and visual gates.
- Do not use coarsening to hide bad pressure or reaction behavior.

### Slice 7: Render LOD/Main Scene Integration

- Generate render proxies/surface seeds from leaves/coherent nodes.
- Keep PBR/optics closure-derived.
- Integrate with the eventual single presented scene path; tree render outputs
  should not require the current overlay workaround.

### Slice 8: Portable Summaries For Distribution

- Emit compact tree summaries/snapshots that remote peers can replay or use to
  rebuild local tree/hot buffers.
- Keep raw GPU tree buffers local-only.
- Add PeerCompute admission tests for stale epoch, wrong state family, missing
  fence, and incompatible material/phase aggregate summaries.

## Acceptance Gates

- 100k-particle tree build plus at least one query path completes without full
  particle readback.
- Near-field exact queries match brute-force CPU reference on small scenes.
- Aggregate far-field traversal reports explicit error bounds and is used only by
  laws that declare it admissible.
- Mechanics P2G/G2P still conserves mass and constant velocity fields when fed by
  tree tile/support worklists.
- Reaction/contact candidate generation preserves strict reaction gates and does
  not miss known close contacts in small brute-force comparisons.
- Coarsening preserves mass, center of mass, momentum, volume, energy, material,
  phase, `F`, `J`, and affine `C` within documented tolerance.
- PeerCompute can treat tree build/query as a resident lane epoch with
  StateManager-admitted summaries and no scene-local hidden authority.

## First Branch Target

On branch `arch/generalized-law-tree`, the first useful implementation target is
not a full GPU tree. It is:

1. add schemas/types/diagnostic shape for `spatial-tree` state family;
2. build the CPU reference tree and brute-force parity tests;
3. add a benchmark/probe field for planned tree backend selection;
4. update the law graph manifest to list `spatial-tree` as a shared dependency;
5. only then prototype GPU Morton/LBVH build.

This gives us a reversible checkpoint before touching the hot MLS-MPM kernels.
