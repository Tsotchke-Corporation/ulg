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

1. Repair production WebGPU surface-resource liveness across initial,
   refresh-1, refresh-2, and final frames. Version or double-buffer resources
   and reclaim them only after the relevant submission fence.
2. Add GPU timestamp-query spans plus submit, allocation, map, fence, byte,
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
- No performance claim from the currently blank post-refresh main canvas.

## Source Plans

- `plan/todo/sol-critic.md`
- `plan/solver-law-inventory.md`
- `plan/todo/SS/schroeder-tree-and-algorithm-plan.md`
- `plan/todo/adaptive-mlsmpm-support-radius-and-coarsening-plan.md`
- `plan/todo/gpu-resident-lanes-and-warm-services-plan.md`
- `plan/todo/peercompute-law-graph-authority-plan.md`
- `plan/tests.md`

## Initial Status

Branch setup was committed as `9428ab4` and published to
`origin/gpu-resident-physics-refactor`. No runtime refactor has been started by
creation of this branch.
