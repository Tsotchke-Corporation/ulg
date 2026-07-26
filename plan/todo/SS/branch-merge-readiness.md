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

## Decision: preserve. The merge blockers are weaker than believed.

Preserve — that was never in doubt once the branch turned out to be Slices 0-9
rather than one slice. What changed on 2026-07-26 is the case for *withholding*
the merge. Both stated blockers were re-measured and neither survived intact.

### Blocker 1: production presentation — CLEARED

`sol-critic.md` records "Production native surface | failed/blocking" on all
seven scenarios, with **109 submissions referencing a destroyed indirect
buffer**. Re-run on this branch (`merge-gate-02`, artifacts under
`/home/cos/ulg-probe-artifacts/`):

| scenario | status | issues | destroyed-buffer submits |
| --- | --- | --- | --- |
| standard-water-cycle | good | [] | 0 |
| standard-iron-ice-quench | good | [] | 0 |
| standard-sodium-water | good | [] | 0 |
| standard-cesium-fluorine | good | [] | 0 |
| random-elements-ba-pb | good | [] | 0 |
| random-elements-bk-lr | good | [] | 0 |
| random-elements-fr-fe | good | [] | 0 |

**7/7 good, zero issues, zero destroyed-buffer submissions.** Priority 0B is
satisfied on this branch.

### Blocker 2: the ~4x regression — DOES NOT EXIST

Measured against `7454ac9` on the same device, nothing else holding the GPU,
using the same benchmark script for both arms:

| particles | baseline kernelsWallMs | branch kernelsWallMs | delta | gates |
| --- | --- | --- | --- | --- |
| 1,024 | 57.5 | 54.9 | **-4.5%** | both pass |
| 9,826 | 75.7 | 78.0 | +3.0% | both pass |
| 48,778 | 153.1 | 159.7 | **+4.3%** | both pass |

`physicsStepsPerSecond` at 48,778: 15.65 baseline vs 14.68 branch (-6.2%).

The SS refactor costs roughly **5%**, not 4x. The original figures
(kernelsWallMs 4348.8 vs 17424.2) are not reproducible at any particle count,
and one arm of that campaign was already invalidated by the `/tmp` worktree
defect recorded in the Slice 9 handoff.

Getting to this measurement required fixing three things that had nothing to do
with the SS refactor and everything to do with why nobody could measure it:

1. **The benchmark box did not follow its own geometry** (`df640d9`).
   `boxx/boxy/boxz` were pinned at 5 m while `dropn`/`basen` scaled with the
   target count, so above 12 particles per edge the drop block overflowed the
   ceiling and the scenario was rejected. The sweep could never exceed ~3,456
   particles.
2. **A rejected scenario looked like a hang** (`f465c44`). `runTask` catches a
   throw and reports an error artifact; `applyWorkerRebuildResult` saw no
   `positionsM`, returned false, and recorded nothing. The demo then sat on
   `initial-material-closure-pending` forever. It now records the reason.
3. **Two unbounded array spreads** (`2aeb3a7`). `particles.push(...reservedLanes)`
   pushes three entries per particle onto the call stack -- about 146k arguments
   at 50k particles -- and threw "Maximum call stack size exceeded". Both are
   loops now.

Each fix exposed the next. The apparent "application scaling cliff at ~3.5k
particles" recorded earlier in this file was the first of them.

### Mechanisms that remain unaddressed regardless

These are real and documented, and none of them is fixed. They are simply not
visible at 1024 particles, which is the largest count where the benchmark
currently runs at all:

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

These are the down payment whose creditor has not yet been paid. The original
framing still holds as a **test**, but it has to be run somewhere the cost can
appear: once the readiness limit above 1024 particles is understood and the
benchmark can run at 10k+, compare against `7454ac9` there. If the branch is
materially slower at a count where a per-particle reservation actually bites,
the two-level path is not earning its overhead and should be reconsidered
rather than deepened. At 1024 particles that test has no power.

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

## PROF-0 and the bind-group work (merged 2026-07-26)

Developed on `prof0-wiring` in the `ulg-s9-bisect` worktree so the merge-gate
matrix could keep serving from the main worktree uninterrupted, then
fast-forwarded in: `ed056df`, `bd42821`, `598d6e9`, `595ea5b`, `7dceb6a`,
`3b87b4a`. A `node_modules` symlink rode along from that worktree and was
removed in `1879d9c` -- it had materialised as a self-referential link that
replaced the real dependency tree.

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
4. **Priority 3 sparsity** — the payback step. Not started, but now located
   exactly.

### Priority 3: where the 4 KiB per particle actually comes from

`src/runtime/sph/schroederHierarchyGpu.js:4498`:

```js
const neighborCandidateCount = lawQueueCount * resolvedCandidateBudget;
const neighborCandidateByteLength = Math.max(
  4,
  neighborCandidateCount * SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS * 4
);
```

with `DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET = 64` (line 503) and a
64-byte candidate row. That is `lawQueueCount * 4096` bytes — a fixed
worst-case reservation, not a measurement — and `lawQueueCount` is effectively
one row per particle because the active-node list still permits one active row
per particle. The two facts compound: **no compaction, times worst-case
budget.**

The work is therefore two coupled pieces, in this order:

1. **Compact unique active nodes** so `lawQueueCount << particleCount`. Until
   this lands the tree provides no hierarchical cost reduction at all, and every
   later optimisation is multiplied by the wrong count.
2. **Replace the fixed `* candidateBudget`** with a byte-bounded CSR arena:
   count per row on the GPU, prefix-sum, allocate the actual total, fill in a
   second pass, and publish overflow telemetry rather than silently truncating.
   sol-critic is explicit that a bounded cap must `log()` what it dropped.

Then consume cross-level candidates instead of leaving them observational, and
publish the single shared multi-resolution neighbor artifact so the tree is
queried once rather than once per law stage.

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
