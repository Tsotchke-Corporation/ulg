# Digest F: remaining older Claude notes, and the memory index check

Sources: `ulg-ss-neighbour-fallback`, `ulg-hash-rewrite-knob-drop`, `ulg-rebuild-epoch-pinning`, `ulg-canonical-liquid-freeze`, `ulg-v2-directory-consumer-migration`, `ulg-project-orientation` (note), `MEMORY.md` (index).

Coverage: all 52 notes listed in `MEMORY.md` have now been read by Hermes (digests A-F).

## Contact owner: the long-standing wall
- (2026-08-26) SS traversal IS wired; the spatial directory CSR + exact-near cell tree is consumed by every proposal path. The old "100% fallback" claim is stale.
- Where step time went on sodium-water (N=1216, ~270 ms/step): the contact matching-cleanup serial owner ~204 ms = 76%. 512-pass interactive budget = `SCHROEDER_SPATIAL_MECHANICAL_INTERACTIVE_CLEANUP_PASS_BUDGET` (`schroederSpatialMechanicalProposalsGpu.js:284`), run as ceil(512/32) single-workgroup 128-thread owner dispatches each looping 32 barrier-serialized logical passes.
- Workset-slimming levers are exhausted. Selection is STATEFUL (a per-cursor sweep marker), so selection-slim was reverted.
- The remaining lever is the sweep-admission redesign (independent-set admission per pass instead of the fixed-order marker sweep): a physics-order solver change gated on the standard-matrix validation train. This is the same item later called "owner redesign (Jacobi-wide pair application)".
- Keep the family flags URL-A/B-able: a preset default flip breaks the `local-law-queue-path-unproven` receipt gate in `sph-visual-sanity-matrix.mjs`.

## The silent-rollback class (the most repeated lesson in this project)
- (fixed 2026-08-28, 6bac50e) Canonical worker-lane mechanics were a silent whole-step rollback for every V2-directory scene: the authority gate rejected each step and `finalize_canonical_spatial_authority` restored all particles while commits, seals and sim time advanced normally. Every canonical rate measured before that fix was frozen mechanics.
- `?observeSpatialAuthority=1` is the permanent instrument: per-step rejection counters, directory header dump, sampled output state row. A fail-closed rollback is host-invisible without it. NOTE: it is a burst blocker (per-step mapAsync), so it changes timing. A rate and its rollback check may need the same run flagged as "observed", or two runs.
- Same class seen again: 2026-11-15 melt-release entities (frozen from tick 3608), 2026-11-16 submit-completion readback (1,151 of 1,152 steps), 2026-11-16 room-air freeze (237 of 6,000 committed).
- `contactSolver=0` is an admitted explicit contact-free bulk mode; `compactMechanicsView=0` forces the plain V1 route.
- Remaining hunts listed 2026-09-25: compact-mechanics path zero-evidence admission failure; the contact proposal's 4-lane lineage requirement (WGSL gate `mechanical_graph_control_lineage_layout_valid` looked 4-lane-only); late-run rate decay; camera framing.

## Presentation and what the user actually sees
- (fixed 5f9617f) Any control edit rewrote the hash to `scenario=custom` and dropped runtime-only preset keys. When the user reports a rate collapse, read their FULL URL first: `#scenario=custom` plus missing runtime keys means a degraded config, not physics.
- Physics runs in the VIEWER's browser on their GPU. A probe on this workstation measures this workstation.
- (fixed 7bf87fa) After a control-edit rebuild the presentation bridge stayed pinned to the retired lane's stream identity (15 s burned per schedule). Diagnostic ring `globalThis.__ulgCommittedPresentationReceiptTrace`: read it first when committed presentations time out.
- `overlay.__sphWorkerOffscreenPresentation` is a mount-time snapshot; use `overlay.__sphScene.getWorkerOffscreenPresentation()` live.
- Measurement law: whole-screenshot distinct-frame hashing is INVALID on this page (the HUD fps counter ticks every frame). Use `scratch/masked-motion-probe.mjs` (fluid-region-only clip hashing plus canvas visibility inventory). The HUD "render fps" counts redraws of unchanged images.
- Live preview: `workerLivePreview=1` draws a throttled uncommitted preview of the lane's retained state on the worker canvas; previews publish `stateManagerCommittedPresentation:false`.
- One surface per schedule commit on the non-preview path (~1-4 distinct images/s).

## Why the orientation note exists
- Claude twice proposed architecture that was a weaker restatement of designs already written down (the Law Adapter Contract, the SS performance ordering) because it reasoned from code without reading the plans. Before proposing architecture or optimisation: read the Star Spec, the SS plan and `plan/todo/sol-critic.md`, and check the documented priority ordering. (This is the same mistake Hermes started to make on 2026-11-17.)
