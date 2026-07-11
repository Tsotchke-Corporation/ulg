# GPU-Resident Physics Refactor Branch

Branch: `gpu-resident-physics-refactor`

Base branch: `SS`

Base commit: `33c30757409c7739d927decc7f25a671ed65aa7e`

Created: 2026-07-10 20:35:36 AKDT

## Objective

Refactor the production physics and presentation pipeline around one
ComputeManager-owned, GPUHub-backed resident lane without changing laws to
fit individual demonstrations or material pairs. The branch must make the
current runtime measurable and correct before optimizing it, then remove
repeated dense/spatial work through general algorithms shared by all scenes.

ULG continues to own laws, closure content, domain integration, reference
artifacts, and browser visualization. PeerCompute continues to own accepted
distributed execution, GPU lane supervision, and StateManager admission of
authoritative mutations.

## Required Order

1. **Complete 2026-07-10.** Repair production WebGPU surface-resource liveness across initial,
   refresh-1, refresh-2, and final frames. Version or double-buffer resources
   and reclaim them only after the relevant submission fence.
2. **Next.** Add GPU timestamp-query spans plus submit, allocation, map, fence, byte,
   and pixel-liveness evidence. Do not optimize from host enqueue timings.
3. Replace dense `surface-cell x particle` render-field construction with a
   source-local, tiled, sorted-range, or otherwise sparse general algorithm.
4. Establish one persistent multiresolution neighborhood/index authority for
   mechanics, thermal, radiation, reaction, pressure/interface, and future
   solid contact.
5. Keep pressure/interface candidate-to-force-to-grid work on the same
   ComputeManager/GPUHub lane without default GPU-to-CPU-to-GPU feedback.
6. Make the two-level Schroeder path genuinely sparse: compact unique active
   nodes and replace particle-proportional candidate reservations with
   byte-bounded arenas and explicit overflow evidence.
7. Land coherent-solid `SOL-0` contracts/invariants and `SOL-1` objective
   rigid frames only after the runtime/evidence gates above are trustworthy.

## General-Fix Rule

- No branch on a named scenario, element, compound, or reaction pair inside a
  solver, shader, renderer lifecycle, or performance fix.
- Standard scenarios and random element pairs are validation inputs, not
  implementation selectors.
- Fixes must hold across particle count, material count/order, phase,
  transparency, resize/DPR, pause/play, and repeated resource refresh.
- A reduced law may be replaced only by a more general closure/law node with
  provenance and validation gates, never by a demo-specific coefficient.

## Validation Rules

- Use the production `native-webgpu-surface-consumer` for every visual
  acceptance check. Particle spheres and offscreen draws are diagnostic only.
- Capture close-spaced compositor frames and compact GPU physics reductions at
  time zero, refresh-1, refresh-2, intermediate checkpoints, and final state.
- A blank, uniform, stale, UI-only, wrong-canvas, destroyed-buffer, or fallback
  frame is a hard failure.
- Run the standard water-cycle, iron/ice, sodium/water, cesium/fluorine, and
  deterministic random-pair matrix after each major slice.
- Run focused tests, `npm test`, `npm run build`, `git diff --check`, and
  `npm run icc:update` before each coherent local commit.

## Non-Goals

- No new CPU mirror solver or CPU parity gate for production acceptance.
- No one-off fix for a demo, material, phase, element, or reaction family.
- No third Schroeder level until two-level sparsity and conservation gates are
  green.
- No kernel micro-optimization before GPU timestamp attribution exists.
- No scene-local scheduler competing with ComputeManager.
- No kernel performance claim before GPU timestamp attribution; the repaired
  production canvas is now presentation evidence, not a timing oracle.

## Source Plans

- `plan/todo/sol-critic.md`
- `plan/solver-law-inventory.md`
- `plan/todo/SS/schroeder-tree-and-algorithm-plan.md`
- `plan/todo/adaptive-mlsmpm-support-radius-and-coarsening-plan.md`
- `plan/todo/gpu-resident-lanes-and-warm-services-plan.md`
- `plan/todo/peercompute-law-graph-authority-plan.md`
- `plan/tests.md`

## Current Status

The first runtime slice is complete. Native surface generations now own their
primary and additional extension results until submit-fence and validation
liveness permits exact-once retirement. Failed/device-lost bridges are
quarantined from both render-refresh entry points and can be force-drained on
explicit teardown. Captured visual intervals perform real native extraction;
performance-only probes remain final-extraction-only. Unchanged native canvas
dimensions no longer trigger resize, reconfigure, or a destructive clear.

Focused tests pass 125/125. The seven-scene production matrix at
`/tmp/ulg-standard-refactor/surface-generation-final4-2026-07-10/summary.json`
has 72/72 nonblank surface-varying frames, one context configuration per
scene, and zero browser/WebGPU issues or warnings. The mobile DPR-2 gate also
passes. These results close SURF-0 through SURF-2; named physics-behavior
failures remain open and are not presentation failures.

`PROF-0` is complete. Same-device optional timestamp queries cover mechanics,
separation, thermal, reaction, mechanics refresh, dense render fields, native
marching-cubes extraction, and surface translation. Required profiling is
explicitly inconclusive when unsupported and never substitutes host or fence
time. `/tmp/ulg-prof0-benchmark-final2.json` passes its required timestamp and
stage-fence gates with 10 valid resident spans, 2.557 ms GPU time versus 252 ms
host-visible stage time, 13.600 ms dense render-field GPU time, and zero
estimated per-step readback bytes.

The active branch slice is `FIELD-0`. Structural u32 sparse-brick layouts,
generation admission, exact non-multiple resolution planning, predecessor
marching-cubes halo expansion, and fail-closed capacity evidence are present.
They are not yet production execution: route fanout, shared radix/scan/unique,
brick atlas evaluation, sparse native extraction, and scene generation swaps
remain open. The matching neighborhood ABI/planner is also present so the
shared compaction backbone can serve FIELD, NEIGH, and SS instead of creating
three competing indexes. The next coherent checkpoint remains local; do not
push it without an explicit request.
