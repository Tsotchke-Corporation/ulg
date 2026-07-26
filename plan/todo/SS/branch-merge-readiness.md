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

### Blocker 2: the ~4x regression — NOT REPRODUCED

`scripts/sph-performance-benchmark.mjs`, this branch vs `7454ac9`, same device,
nothing else holding the GPU:

| metric | baseline `7454ac9` | branch | delta |
| --- | --- | --- | --- |
| residentStepsKernelsWallMs | 57.5 | 54.9 | **-4.5%** |
| residentStepsWallMs | 59.6 | 57.2 | -4.0% |
| probeBatchWallMs | 94.5 | 95.2 | +0.7% |
| physicsStepsPerSecond | 170.6 | 169.3 | -0.7% |
| `performanceGate.status` | pass | **pass** | |

At 1024 particles the branch is at parity or slightly ahead, and its own
performance gate passes.

**Above 1024 the benchmark cannot produce a comparison.** At 4096 and at 10000
particles *both* arms fail identically — `page.waitForFunction` timeout at
`sph-long-horizon-probe.mjs:2062`, the initial "particle state or driver
exists" readiness wait, not the physics loop. Confirmed at the default 240 s
budget and again at 900 s (`ULG_BENCH_TIMEOUT_MS`), on this branch and on
`7454ac9`.

This **is** an application-level limit, and it reproduces outside the
benchmark. Driving `sph-long-horizon-probe.mjs` directly with
`ULG_PROBE_URL='...&dropn=13&basen=13'` (~4.4k particles) also never reaches
readiness. It is not caused by the benchmark's extra URL parameters either:
appending all eight of them (`renderUseCase`, `lawt`, `lawr`, `lawv`, `lawst`,
`visualCapture`, `surfaceDraw`, `blob`) to a *small* scenario still starts
normally. Particle count is the variable.

It reproduces on `7454ac9` as well, so it is pre-existing and not introduced by
this branch — but "pre-existing" is not "acceptable": **the application cannot
start a scenario of roughly 4.4k particles**, against a stated ambition of
planetary scale.

This is now the top blocker for answering the performance question at all,
because 1024 particles is the only size that runs, and a 4 KiB-per-particle
reservation cannot show up at 1024.

**Threshold, bisected** (`dropn=basen=N`, h2o/h2o, same URL otherwise):

| N | particles | startup |
| --- | --- | --- |
| 10 | 2000 | ready |
| 11 | 2662 | ready |
| 12 | 3456 | ready |
| 13 | 4394 | **stalls** |

A sharp cliff between 3456 and 4394 is a hard limit being crossed, not a
gradual slowdown — and 4096 falls between them.

**Lead raised and refuted.** `src/runtime/thermoPreflight.js:82` defaults
`particleResolution.h2o` to 4096 (fe 2048, gas 8192), and the stalling scenario
was h2o/h2o — a tempting magnitude coincidence. If that cap were causal, an
fe/fe scenario with its 2048 default should stall *lower*. It does not:

| scenario | 2662 particles | 4394 particles |
| --- | --- | --- |
| h2o/h2o | ready | stalls |
| fe/fe | ready | stalls |

Identical. The cliff is **material-independent**, so `particleResolution` is
not the limit and the thermo preflight is exonerated.

That rules out the material/thermo descriptors and points at something
structural that scales with particle count alone — a buffer size, a dispatch
or binding limit, or a grid/field allocation.

The next probe should capture the browser console during a stalled N=13 run
rather than reason from constants: the stall is at the "particle state or
driver exists" wait, so the failure happens during scene construction and
should log there. One caveat learned the hard way — a hand-rolled Playwright
script could not reach a `vite --port N` dev server from inside the launched
browser (curl reached it from the shell; the page got
`net::ERR_CONNECTION_REFUSED`). Reuse `launchProbeBrowser` and the server setup
from `sph-long-horizon-probe.mjs`, which demonstrably works, and add console
capture on the failure path — the probe already collects console output but
throws at the readiness wait before writing its output file, which is exactly
why this evidence is missing today.

Method note, recorded because it cost a wrong conclusion: the probe reads
`ULG_PROBE_URL`. An earlier pass here used `ULG_PROBE_SCENARIO_URL`, which the
probe ignores, so those runs silently exercised the default small scenario and
appeared to prove the application was fine at 4.4k. Two commits in this file
asserted that before the variable name was checked. If a scaling probe succeeds
suspiciously easily, verify the particle count in its output rather than the
command you thought you ran.

So the previously reported 4x (kernelsWallMs 4348.8 vs 17424.2) **is not
reproducible with this benchmark at any particle count where both arms run**.
Note also that one arm of that original campaign was already invalidated by the
`/tmp` worktree defect recorded in the Slice 9 handoff. Treat the 4x as
unconfirmed rather than as fixed: the mechanisms below are real and still
unaddressed, they simply do not show at 1024 particles, which is exactly where
a 4 KiB-per-particle reservation would not show.

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
