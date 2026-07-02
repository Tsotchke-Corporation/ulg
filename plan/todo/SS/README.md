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

Next implementation queue:

1. Surface admitted phase-volume level-update diagnostics in a visible
   water-to-steam SS stress case.
2. Replace the exact O(n^2) aggregate-node scan with a scalable GPU sort/radix
   or bucket reduction once the node contract is consumed by later slices.
3. Route reaction/contact/interface work queues through SS active nodes.
