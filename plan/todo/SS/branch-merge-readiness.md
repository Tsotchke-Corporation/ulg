# `ss-spatial-authority-refactor` merge readiness

Working record for the effort to get this branch merge-ready. Started
2026-07-25/26. Update in place; do not append a narrative log.

## What this branch actually is

Not "Slice 9". It is **38 commits implementing SS Slices 0 through 9** — the
documented architectural direction — measured against merge-base `33c3075`:

- `009b837` Slice 5 shared exact-near consumers
- `3c801ad` Slice 6 compact mechanics view
- `6c20c32` Slice 7 two-level spatial coupling
- `e78ac68` / `e4b132d` / `78668e4` phase-volume sidecar, receipt, interface
- `7047216` shared spatial authority hierarchy slices
- `1466da9` Slice 9 phase-volume transport, pressure authority, phase equilibrium

The `SS` line had only 4 commits since the same base and does **not** contain
the spatial refactor at all (`sphPhaseCarrierTransferGpu.js` does not exist
there). Discarding this branch would discard the chosen architecture, not a
failed experiment.

## Decision: preserve, merge deliberately

Preserve. Do **not** merge until the priority ordering in
`plan/todo/sol-critic.md` is satisfied, because the branch carries a measured
~4x frame-time regression whose payback step has not landed.

**Why it is slower than what it replaced** — the mechanism is documented, not
mysterious:

1. **No hierarchy in cost yet.** sol-critic P0: the active-node list "permits
   one active row per particle". One node per particle is N with tree overhead
   on top, not N log N. Unique-node compaction is Priority 3.
2. **Worst-case candidate reservation.** 64 candidate rows x 64 bytes per queue
   row = **4 KiB per active particle**, ~4 GiB at 1M particles before useful
   state. This is also what made the matrix OOM.
3. **Cross-level work built and not consumed.** P1: cross-level candidates "can
   remain observational/unconsumed", and the artifact chain is "rebuilt and
   separately submitted each substep".
4. **The unification has not happened.** The plan asks for "one persistent,
   multi-resolution neighbor artifact shared by mechanics, thermal, reaction and
   contact consumers". Until then consumers can still reach the exhaustive `N*N`
   fallback.

The regression is a down payment with a named creditor. **Merge gate:** if
Priority 3 lands and the branch is still materially slower than `7454ac9` on the
same device, the two-level path is not earning its overhead and should be
reconsidered rather than deepened.

## Landed on this branch

| Commit | What |
| --- | --- |
| `5e8b4a3` | Nitpicks: staged control edits, per-material spacing, geometry auto-correction |
| `e765bc8` | Gel fix re-derived: artificial viscosity moved from shear to compression-gated bulk |
| `03cab10` | Eshkol IR read record |
| `61ef99d` | Project orientation + law-interface correction |
| `c4d89ee` | SURF-0: staleness attributed to its actual cause |
| `3bb995d` | SURF-0: free-surface gate can measure the native path |
| `53984b2` | PROF-0: GPU timestamp profiler (module + tests, not yet wired) |
| `d23aaae` | perf: hoist invariant grid-update bind group out of the substep loop |

Full suite after consolidation: **1987 tests, 1958 passing, 0 failing, 29
skipped.**

### Two gates were vacuous, not merely failing

Worth recording because both hid real state:

- **`resident-render-source-stale`** collapsed three independent conditions into
  one integer. The per-cause breakdown showed all stale samples carried one
  retention reason and that the pattern matched the probe's own extraction
  policy — running with `ULG_VISUAL_MATRIX_CAPTURE_FRAMES=0` disables interval
  extraction, so only the final batch extracts. With capture on: 0 stale of 9.
  It was a probe configuration artifact, not a presentation defect.
- **`liquid-free-surface-*`** derived bounds from `geometry.attributes.position`,
  which does not exist on the native WebGPU path (`metric.surfaces.totalCount`
  is 0). The gate iterated an empty array and reported "missing" — it had never
  evaluated the native path. Now falls back to resident cohort particle bounds,
  recorded via `liquidFreeSurfaceBoundsSource`.

Once it could measure, it confirmed the gel fix: final tallness **0.016**
(limit 0.8), footprint fill **0.814** (floor 0.15), peak tallness 1.754 while
the drop was still falling. Water spreads and flattens.

## On branch `prof0-wiring` (worktree `/home/cos/projects/ulg-s9-bisect`)

Held off the main branch only because the merge-gate matrix is serving from the
main worktree and editing source mid-run would make its scenarios inconsistent.
**Merge these back once the matrix finishes.**

| Commit | What |
| --- | --- |
| `ed056df` | PROF-0 wired into the fused sequence's five passes |
| `bd42821` | Bind groups memoized on buffer identity |
| `598d6e9` | Profiling request plumbed; `stageGpuMs` surfaced on the result |
| `595ea5b` | Accumulator-clear bind group memoized and gated |

### The per-substep bind-group finding

The fused sequence built **five bind groups inside** `for (let index = 0; index
< count; index += 1)`. At the default 256-step batch that is ~1280
driver-validated `createBindGroup` calls per sequence, now under a dozen.

- One (`gridUpdate`) was fully loop-invariant and is hoisted.
- Three rotate and are memoized **on buffer identity, never on `pingIndex`** —
  a parity key would be *wrong*, because the thermal and mechanics-refresh
  stages substitute `currentStateBuffer` / `currentThermoBuffer` /
  `currentMechanicsBuffer` mid-loop without following parity.
- One (`activeAccumulatorClear`) was additionally built on every substep even
  when `useActiveGrid` was false and nothing consumed it.

A lexical detector for `createBindGroup` inside a loop was run over the other
hot files (`schroederCrossLevelCouplingGpu`, `sphThermalGpuKernel`,
`schroederHierarchyGpu`, `sphGridGpuKernel`, `sphRenderGpuKernel`,
`schroederFusedFineSubstepGpu`) and found none. The detector was self-checked
against the pre-fix file, where it correctly reports all five — so that is a
true negative, not a broken scan. **The pattern was localized to the fused
sequence.**

No performance claim is attached to any of it yet. The matrix holds the GPU, and
measuring under contention is trap 2 below.

## Open

1. **Merge gate matrix** — `ULG_VISUAL_MATRIX_RUN_ID=merge-gate-02`, artifacts
   under `/home/cos/ulg-probe-artifacts/`. `standard-water-cycle` and
   `standard-iron-ice-quench` good so far.
2. **Measure.** After merging `prof0-wiring`, benchmark current branch against
   `7454ac9` (`/home/cos/projects/ulg-s9-baseline`). Prior arms: kernelsWallMs
   4348.8 baseline vs 17424.2 regressed. Nothing may contend for the GPU.
3. **Device negotiation for timestamps is untested on hardware.**
   `webGpuDeviceDescriptorForResidentSph({ timestampProfilingRequested })`
   exists in `webgpuDeviceLimits.js` but no caller has ever passed true, so an
   end-to-end profiled run needs that switch thrown and verified.
4. **Priority 3 sparsity** — the payback step. Not started.

## Two measurement traps, both hit

- **`/tmp` is a 24 GiB tmpfs and probe artifacts fill it.** When it hit 0 bytes
  free, Chrome's renderer died mid-probe and the scenario failed with "Execution
  context was destroyed, most likely because of a navigation" — which reads
  exactly like an application navigation bug. `standard-water-cycle` reported
  `bad`, and an A/B against `a340072` reported `good`, which looked like a
  clean regression introduced by the consolidation. Re-running the same HEAD
  after freeing space: `good`. There was no regression. **Write probe artifacts
  to real disk** via `ULG_VISUAL_MATRIX_OUTPUT_DIR`.
- **Do not measure under GPU contention.** A previous session misattributed an
  OOM this way. Stop background probes before timing anything.

Related: `plan/todo/sol-critic.md` (priority ordering), `plan/project-orientation.md`.
