# SS note 1: the plan of record (`plan/todo/SS/`)

Read by Hermes, 2026-11-17, both files in full:
`plan/todo/SS/README.md` (338 lines, updated 2026-11-16) and
`plan/todo/SS/schroeder-tree-and-algorithm-plan.md` (790 lines, dated
2026-07-01, last design section 2026-07-06).

## What SS is

- "`SS` means Schroeder Simulation" (`README.md:7`).
- Two inseparable parts (`schroeder-tree-and-algorithm-plan.md:9-16`):
  - the **Schroeder Tree**, "a GPU-resident scale hierarchy whose nodes are
    both multilevel MLS-MPM grid nodes and law-aggregate nodes";
  - the **Schroeder Algorithm**, "a multiscale solver that moves particles,
    fields, reactions, contact, optics, and long-range laws through that
    hierarchy with conservative level coupling and law-specific admissibility
    rules".
- The ambition (`:18-22`): "This is not just Barnes-Hut, not just AMR, not just
  adaptive MPM, and not just an Ocean-style tiled kernel ... one continuous
  scale-aware substrate for physics from atomic to supergalactic scale, with
  each law declaring how it can use exact near-field work, aggregate far-field
  traversal, and cross-level coupling."
- The core shift (`:24-45`): the hierarchy is no longer an accelerator beside
  MLS-MPM. "The hierarchy is now part of the mechanics algorithm":
  material/phase state → physical volume, density, pressure, temperature,
  support radius → level assignment → per-level active nodes/tiles →
  same-level MLS-MPM/Ocean P2G + grid update + G2P → adjacent-level
  conservative restriction/prolongation → law adapters over the same hierarchy
  → retained GPU outputs + compact StateManager-admitted summaries.
- Barnes-Hut/FMM traversal is one adapter mode, for aggregate-admissible laws
  only. Local mechanics, pressure, contact, incompressibility, phase boundaries
  and reactions need exact near-field handling.

## The tree node (`:49-66`)

Chart id, origin and scale exponent; level id and grid/node key; bounds and
support-inflated bounds; conserved aggregates (mass, volume, momentum, internal
energy, centre of mass); mechanics aggregates (deformation, J, affine) where
admissible; phase/material/reaction/gas/charge/opacity masks and histograms;
law masks; error and admissibility flags for traversal, coarsening, rendering
and cross-level transfer; retained-buffer ownership, epoch and source metadata.
"It is not a pointer-heavy CPU octree": level/key arrays, active-node lists,
aggregate rows, coupling edges.

## The algorithm (`:68-82`)

- Assign each entity a native level "from material-derived physical support,
  not from renderer radius or drop/base UI role".
- Same-level MLS-MPM transfer inside active nodes/tiles.
- Couple adjacent levels by conservative restriction/prolongation.
- Refine near free surfaces, contacts, reactions, shocks, high gradients and
  phase/material boundaries.
- Coarsen coherent bulk only when mass, volume, momentum, energy, material,
  phase and represented mechanics state are conserved.
- Expose law work queues (reaction, contact, interface, optics, gravity,
  plasma) "without creating one-off grids per law".

## Rules

- GPU-first (`:84-101`): "Do not start with a CPU reference implementation."
  Allowed validation: tiny aggregate readbacks for counters and conservation
  residuals, level histograms, active-node counts, min/max summaries, bad-weight
  / bad-coupling / overflow / fallback counters, sampled sentinel rows on
  request. Disallowed by default: full particle readback, CPU mirror trees,
  CPU-first parity gates, worker `mapAsync` snapshot paths in the hot loop.
- README rules (`README.md:69-76`): no CPU reference tree; no full particle
  readback on the hot path; no new law-specific grid before checking whether it
  belongs as an SS law adapter; presentation never owns physics cadence or
  state authority; Ocean-style kernels stay as dense local backends inside the
  hierarchy.
- Scale independence (`:103-113`): positions through local charts or
  origin/scale rebasing; a node may be local f32, but admitted state keeps
  chart/scale metadata. "The first implementation can operate in the existing
  meter-space scene chart. The data model must not bake in that limitation."

## The canonical stress case: phase volume (`:115-127`)

Water to steam is about 700x volume, so support grows by cbrt(700) ≈ 8.9x,
about 3.15 binary levels coarser. "SS should handle that as a level migration
or coarsening event, not by requiring roughly 700x more particles for the same
mass." Near a surface, reaction front, wall or shock the particle may split or
stay fine; in coherent bulk steam it lives at a coarser level.

## Law adapter contract (`:129-149`)

Every law declares: scale range and chart assumptions; read/write state
families; exact near-field requirements; aggregate admissibility and error
bounds; cross-level coupling rules; conserved quantities and residual outputs;
fallback policy. Adapter modes: `sameLevelMpm`, `crossLevelConservative`,
`nearExactPairs`, `farAggregate`, `bulkCoarsen`, `surfaceRefine`, `renderLod`.

## PeerCompute contract (`:151-183`)

ComputeManager schedules SS build/assignment/query/solver tasks. Resident-lane
ownership stays same-worker and same-device unless materialized through a
portable compact snapshot. StateManager admits compact summaries and
authoritative deltas. Presentation consumes SS outputs and never schedules
physics. Peers exchange compact summaries, seeds, law plans or portable
snapshots, never raw `GPUBuffer` handles. Eighteen `peercompute.ulg.schroeder-*`
schemas are listed.

## Slices and what landed (July 2026)

| Slice | Content | Status in the plan file |
|---|---|---|
| 0 | Todo reorg, branch identity | landed `f662640` |
| 1 | GPU level assignment from physical support, with hysteresis | landed `f4c8e88` |
| 2 | Per-level active nodes | landed `b41c179` |
| 3 | Same-level mechanics (P2G, grid, G2P on a selected level) | landed; fused single-step and one-submit multi-step consume retained filters |
| 4 | Adjacent-level conservative coupling | candidate rows, conservation summaries, transfer rows, pending state deltas, admitted merge buffers, aggregate contributions, exact and bucket aggregate-node reducers |
| 5 | Phase-volume migration | decision rows, admitted level updates, diagnostics, overlays, target aggregates, refine-pressure mask, split/merge **proposal** rows, then the storage chain below |
| 6 | Law work queues | law-queue descriptors, neighbour-candidate rows, tile traversal, source spans, bucket index, sorted/radix index, traversal policy; reaction and pressure/interface consume them |
| 7 | Far-field aggregate laws | candidate rows, gravity-like force summaries, admitted far-force deltas fused into resident state, read-only radiation/plasma/gas consumers, admitted gas-pressure deltas, retained gas-cell rows consumed by pressure-interface |
| 8 | Render and distribution | portable summaries, render LOD, proxy descriptors, native retained-proxy executor, URL/host config (`ss=1`, `schroeder=1`, `schroederSimulationPolicy`), replay descriptors |

The README lists 68 landed checkpoints with commit ids (`README.md:82-325`).

### The particle-storage chain built under slice 5 (`:538-721`)

All StateManager-admitted, GPU-resident, no default readback:
split/merge admission and **apply** rows → storage **allocation** intent →
**free list** → **slot assignment** → **materialization** (writes retained
output SPH state, thermo and MLS-MPM mechanics buffers) → resident **adoption**
of the materialized buffers as the next authoritative particle storage →
adopted-storage descriptor → hot-buffer publication → continuation plan →
same-device local resolver → scene publication → mounted proof.

- Proof target kept: H2O steam with expected level delta > 2, represented/rest
  volume > 100, particle growth ≤ 1, no full readback.
- Named next slice (`:709-721`): "SS adopted storage runtime policy and
  portable rematerializer": (1) admissions from URL/host policy instead of
  test injection; (2) a peer-local portable rematerializer from the descriptor
  seed; (3) a mounted `residentStageWorkers=1` proof that the stage-worker lane
  consumes real adopted storage.
- Worker-lane rematerialization (2026-07-06, landed `d866806`, gates
  `8563575`): the worker rebuilds adopted storage from seed plus packed rows.
- **Open residue** (`:785-790`): "a live e2e where adoption ACTUALLY fires
  (needs a scenario producing real split/merge topology changes - the no-op
  adoption guard correctly discards the static h2o/h2o scene's pure-copy
  epochs)", and dropping the packed-row re-upload.

## Acceptance gates of the SS plan (`:501-514`)

No full particle readback on the default hot path. Level assignment from
physical state. A 700x phase-volume expansion migrates about three levels
without 700x particles. Same-level mechanics conserves mass and constant
velocity fields. Cross-level coupling reports bounded conservation residuals.
Reaction/contact/interface candidates are not missed in small brute-force
diagnostic scenes ("brute force is a diagnostic, not the primary implementation
route"). Dense local regions can still use Ocean-style kernels. PeerCompute can
identify SS epochs and admission boundaries.

## What SS made moot, and what stays (`:516-536`)

Moot: the CPU-reference-first adaptive MLS-MPM route; the external-only
spatial-tree framing; more one-off neighbour grids per law; dense/source-local
material-interface fields as the long-term spatial strategy; solving phase
expansion by changing renderer particle sizes or initializer spacing; treating
Ocean-style mechanics as the whole architecture.
Active: PeerCompute law authority and StateManager admission; resident lane
ownership; Ocean-style dense local kernels; derived material, optical, reaction
and thermal closures; PBR correctness; reaction energetics and sedenion
scoping; visual sequence checks.

## The routing README (state at 2026-08-31, edited 2026-11-16)

- The refactor record is `plan/done/SS/shared-spatial-authority-refactor-plan.md`
  (2026-07-21): "build one canonical GPU-resident cell/hierarchy generation per
  immutable spatial epoch and derive mechanics, exact-near, cross-level,
  aggregate-far, solid-proxy, and render views without independent law grids or
  maximal pair storage" (`README.md:33-38`). Slices 0-8 implemented.
- Eight-item shape (`README.md:52-67`): (1) one exact particle-to-cell key
  emission and canonical sort/unique per immutable spatial epoch; (2) compact
  unique cell/member directory with byte capacity, overflow, identity and
  completion evidence; (3) derived exact-near support views replacing private
  reaction, contact, pressure/interface, separation, thermal and radiation
  lookups one at a time; (4) compact mechanics node/stencil view; (5) explicit
  epoch-boundary scheduling for position, topology, phase/support and level
  changes; (6) conservative two-level coupling and aggregate-far traversal;
  (7) coherent-solid carriers and mixed solid-liquid coupling; (8) render and
  source-family views and portable summaries.
- Items 1-6 and the refactor part of 8 landed. Item 7 is active under
  `sol-critic.md`.
- **2026-11-16 change** (`README.md:46-50`, `:62-63`): "The third-level hold in
  item 6 was lifted by the user on 2026-11-16: an N-level chain of 2:1 pairs
  for first-class room air (`../first-class-air.md`), with the SOL-critic
  Priority 3 gate waived." "generalizing to an N-level 2:1 chain is active."
- Current implementation queue (`README.md:327-338`):
  1. "phase-resolved represented-current-volume and volume-gradient moments,
     shared local/reflux pressure and drag, hydrostatic ambient or resolved
     air, and conserved phase/reaction birth volume ... Steam
     rise/condensation and hydrogen rise remain failed expectations until that
     work is verified."
  2. Re-derive long-liquid viscosity, contact and heat-transfer behaviour under
     `surface-contact-transport-phase-closure-plan.md`; "do not hide inherited
     failures by relaxing the long-horizon or standard visual gates."
  3. Coherent-solid work under `sol-critic.md`.
- Follow-on (2026-09-22): the Eshkol higher-order law and material closure plan
  feeds Goal 6: "executable law contracts, generated response/derivative
  artifacts, SS envelope checks, and one local fit/cache/adoption cycle".

## How the campaign maps onto the SS queue (Hermes, INFERRED)

- Queue item 1 is G2 (steam and hydrogen plumes) and first-class air.
- Queue item 2 touches the contact and heat-transfer problems behind G2's
  `iron-cools` failure and the contact-owner redesign.
- Queue item 3 is G3 and A5.
- README item 6 (N-level chain) is A5's "additional SS levels" and the
  first-class-air level chain.
- A2 (incremental membership repair) is a change to README items 1-2 (one
  rebuild per immutable epoch).

## Questions this raises for the rest of the reading

1. The July storage chain (split/merge apply → allocation → free list → slot
   assignment → materialization → adoption) exists. First-class air's slices
   1a-1c (split-spare lineage reserve, lineage scan, split kernel on the worker
   lane) also create particles. Does the November work reuse the July chain,
   replace it, or duplicate it? The July plan's open residue was precisely "a
   scenario producing real split/merge topology changes".
2. The plan says level assignment is physical and levels are many; the runtime
   has two. What exactly limits it to two today (data model, kernels, or the
   Priority 3 gate only)?
3. Charts and scale rebasing ("atomic to supergalactic") are in the data-model
   requirement and nowhere in the campaign. Is anything built?
4. "Law adapter contract" (reads, writes, near/far admissibility, fallback) is
   the same idea as the A1 "law descriptor". Are they the same object in code?
