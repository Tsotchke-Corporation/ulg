# SS Todo Routing Matrix

Date: 2026-07-01 AKDT

This matrix reorganizes the existing flat `plan/todo` backlog around Schroeder
Simulation.

`shared-spatial-authority-refactor-plan.md` records completed refactor Slices
0–8. The original Schroeder plan remains the architecture contract; this matrix
records how adjacent plans constrain or consume the shared substrate and routes
follow-on transport and coherent-solid work to their active owners.

| Existing todo | SS routing |
| --- | --- |
| `plan/moot/adaptive-mlsmpm-support-radius-and-coarsening-plan.md` | Superseded as a CPU-first adaptive track. Its conservation invariants are carried into the active spatial-authority plan for SS support, split/coarsen, and cross-level coupling. |
| `webgpu-ocean-mlsmpm-simulator-plan.md` | Retained as dense local mechanics backend inside SS levels. Ocean-style P2G/grid/G2P is no longer the whole architecture. |
| `generalized-spatial-law-tree-plan.md` | Replaced by `SS/schroeder-tree-and-algorithm-plan.md`. The hierarchy is now part of MLS-MPM mechanics and law acceleration. |
| `gpu-resident-lanes-and-warm-services-plan.md` | Retained. SS buffers must live inside GPU resident lane ownership and same-worker/same-device rules. |
| `resident-state-authority-contract-plan.md` | Retained. SS epochs, summaries, and deltas need explicit StateManager admission. |
| `peercompute-law-graph-authority-plan.md` | Retained. SS becomes a law graph substrate and artifact family, not a hidden scene scheduler. |
| `physics-loop-authority-diagrams.md` | Retained. Diagrams should add SS level assignment, active-node build, mechanics, coupling, and law-query stages. |
| `reaction-stoichiometry-energetics-plan.md` | Retained for chemistry and energetics. Neighbor discovery should move to SS near-exact work queues. |
| `reaction-variable-particle-scale-stability-plan.md` | Mostly absorbed by SS phase-volume migration and split/coarsen policy. Reaction-specific safety gates remain. |
| `sedenion-reaction-scoping-plan.md` | Retained. SS queues should use sedenion masks for pruning, not replace the grammar. |
| `cubic-barrier-contact-integration-plan.md` | Retained for exact contact law. SS supplies broad-phase/contact candidate queues. |
| `phase-resolved-steam-optics-plan.md` | Retained. SS supplies phase-volume migration and steam LOD/optical-depth aggregates. |
| `particle-pbr-material-closure-rendering-plan.md` | Retained. SS render LOD must consume closure-derived optics/PBR, not patch colors. |
| `physics-behavior-regression-plan.md` | Retained as visible sanity gate after SS mechanics changes. |
| `drop-edge-large-size-respect-plan.md` | Demoted. Drop/base size semantics remain input behavior, but adaptive scale is owned by SS physical support and level assignment. |
| `webgpu-material-property-resolvers-plan.md` | Retained. SS consumes resolved material/phase rows. |
| `algorithm-derived-material-properties-plan.md` | Retained. SS support/level decisions depend on derived density, pressure, phase, and closure rows. |
| `material-property-json-bank-plan.md` | Retained as source/cache for material properties. |
| `material-polytope-registry-and-property-fit-plan.md` | Retained; may later provide aggregate error bounds and admissibility regions. |
| `distributed-peercompute-network-stack-plan.md` | Retained at network layer. SS adds compact summaries/snapshots as payloads. |
| `cold-start-cache-performance-plan.md` | Retained for pipeline/cache warmup, including SS shaders and active-node templates. |
| `electron-cloud-material-derivation-visualization-plan.md` | Retained for derivation/visualization. SS may provide multiscale render LOD. |
| `frontier-todo.md` | Its broad O(N^2) concern routes through SS. |
| `overarching-completion-plan.md` and `sphphasedemo.md` | Need updates after the first SS GPU slice lands. |

## Immediate Do-Not-Start List

- CPU reference Schroeder tree.
- Another fixed reaction bin implementation.
- Another dense material-interface field as the long-term spatial solution.
- Renderer-size-driven adaptive support.
- Full-readback validation as a prerequisite for SS GPU work.
