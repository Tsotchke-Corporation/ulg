# SS Todo Routing

Date: 2026-07-01 AKDT
Branch: `SS`

`SS` means Schroeder Simulation. This folder is now the active routing layer for
new architecture work in ULG.

Primary plan:

- `schroeder-tree-and-algorithm-plan.md`

Supporting routing:

- `todo-routing.md`

## Active Priority

1. GPU-first Schroeder level assignment.
2. Per-level active node/tile lists.
3. Same-level MLS-MPM/Ocean mechanics on selected SS levels.
4. Adjacent-level conservative restriction/prolongation.
5. Phase-volume migration, starting with water-to-steam expansion.
6. Law work queues for reaction/contact/interface.
7. Aggregate far-field traversal for laws that declare physical error bounds.
8. Render LOD and PeerCompute portable summaries.

## Rules

- Do not start with a CPU reference tree.
- Do not require full particle readback for the SS hot path.
- Do not create another law-specific grid before checking whether it belongs as
  an SS law adapter.
- Do not let presentation own physics cadence or state authority.
- Keep Ocean-style kernels as dense local backends inside the SS hierarchy.

## Current Status

Landed checkpoints:

1. `f662640` routes todo ownership and branch identity through `SS`.
2. `f4c8e88` adds retained GPU level assignment rows and execution contracts.
3. `b41c179` adds retained per-level active-node planning.
4. `55b3a59` adds same-level MLS-MPM mechanics orchestration.
5. `82044fd` adds retained cross-level coupling candidate rows.
6. `9d3ea80` wires cross-level prepass orchestration into SS mechanics.
7. `d752434` filters MLS-MPM P2G by selected Schroeder level assignment.
8. `e9997a3` enables fused no-full MLS-MPM P2G filtering by retained
   Schroeder level assignment.
9. `b9d35de` adds GPU-resident cross-level conservation summary rows for mass
   and represented volume residuals.
10. `38fd33b` adds GPU-resident cross-level transfer rows for mass,
    represented volume, momentum, and internal energy.
11. `c0b980f` adds GPU-resident pending cross-level state-delta rows for
    conservative source/target transfer application.
12. `60a63c2` adds StateManager-admission gating and retained merge buffers for
    cross-level state deltas.
13. `258d7c2` materializes admitted merge rows into retained SS hierarchy
    aggregate contribution rows.
14. `60d2d7e` reduces retained aggregate contribution rows into retained SS
    hierarchy aggregate-node rows with exact GPU duplicate-key summation.
15. `730f2ff` adds retained GPU phase-volume migration decision rows that
    consume level assignments and aggregate nodes without full particle
    readback.
16. `ab1ec57` adds StateManager-admitted retained phase-volume level-update
    rows and same-level orchestration handoff.
17. `3295777` adds compact GPU phase-volume diagnostic summaries over admitted
    level updates, including water-to-steam scale migration counters without
    full particle readback.
18. `dd3e928` publishes compact SS phase-volume diagnostic summaries through the
    scene/status path so water-to-steam level migration can be observed without
    particle readback.
19. `81f51cd` adds an auto-selected bounded bucket aggregate-node reducer for
    larger SS aggregate row counts while preserving the exact reducer for
    diagnostic counts.
20. `f7cf080` adds retained active-node law-queue descriptors for
    reaction/contact/interface candidate work, including exact-near-field,
    sedenion reaction scope, and state-admission metadata.
21. `8491fb5` routes retained SS law queues through the same-level mechanics
    prepass chain and forwards them to the resident backend as
    `schroederLawQueue`, with a per-use-case disable switch.
22. `6e275e0` gates SPH reaction proposal generation with retained
    `schroederLawQueue` rows, preserving strict reaction/sedenion checks while
    keeping the reaction stage resident and no-full-readback.
23. `b1b2206` gates pressure/interface contact-kinematics candidate particles
    with retained `schroederLawQueue` rows and threads the queue through the
    pressure/interface stage task.
24. `ae7f7d3` adds retained GPU `schroeder-law-neighbor-candidate` rows, a
    no-full-readback WebGPU producer, and same-level orchestration forwarding to
    the resident backend.
25. `9f6f961` routes retained `schroeder-law-neighbor-candidate` artifacts into
    reaction and pressure/interface consumers as validated, observed, fail-closed
    metadata.
26. `126f5d1` replaces the law-neighbor source-index window with a retained
    active-node tile traversal broad phase over support-inflated SS rows.
27. `a6315c1` binds traversal-backed law-neighbor candidate rows directly into
    reaction proposal and pressure/interface contact-kinematics kernels as
    authoritative retained GPU input.
28. `c22ed0a` adds retained particle source-span rows beside law-neighbor
    candidate rows, fixes the candidate params buffer size, and routes reaction
    proposal scans through per-source candidate spans when present.

Next implementation queue:

1. Replace the unsorted active-node broad phase with a sorted/radix SS tree
   index when candidate counts become the next bottleneck.
2. Consume retained SS active-node rows directly inside same-level P2G/G2P.
3. Add render LOD and PeerCompute portable SS summaries.
