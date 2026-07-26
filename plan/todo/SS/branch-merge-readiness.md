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

### Mechanisms that remain unaddressed

None of these is fixed. The 50k measurement shows they cost about 5% today, not
4x -- but they are real, and they set the memory ceiling rather than the current
frame time.

1. **No hierarchy in cost yet.** sol-critic P0: the active-node list "permits
   one active row per particle". One node per particle is N with tree overhead
   on top, not N log N. Unique-node compaction is Priority 3.
2. **Worst-case candidate reservation.** 64 candidate rows x 64 bytes per queue
   row = 4 KiB per active particle, ~4 GiB at 1M particles before useful state
   (`schroederHierarchyGpu.js:4498`).
3. **Cross-level work built and not consumed.** P1: cross-level candidates "can
   remain observational/unconsumed", and the artifact chain is "rebuilt and
   separately submitted each substep".
4. **The unification has not happened.** One persistent multi-resolution
   neighbor artifact shared by mechanics, thermal, reaction and contact
   consumers. Until then consumers can still reach the exhaustive `N*N`
   fallback.

### 5. Measured 2026-07-26: 77.8% of dispatched GPU threads do nothing

`appendPhaseCarrierLanes` reserves a full companion copy of every particle for
each of 3 non-primary phase lanes, then `spareProductSlotCount` adds another
12.5%. A 4,394-particle scenario therefore allocates **19,772 slots**, and every
particle-parallel kernel dispatches over all of them:

```
p2gPass.dispatchWorkgroups(Math.max(1, Math.ceil(particleCount / 64)))
```

where `particleCount` is the slot count. Measured directly on the state buffer:

| | count |
| --- | --- |
| slots | 19,772 |
| slots with mass > 0 | 4,394 |
| **wasted threads** | **77.8%** |

The companions are created with `massKg: 0`, so the P2G guard
`if (!(pos_mass.w > 0.0)) { return; }` exits them after a single vec4 load.
That is why the cost is bounded -- it is scheduling plus one 16-byte read per
wasted thread, not full physics -- and it is consistent with the branch being
only ~5% off baseline rather than several times slower.

It is still 4.5x the threads, 4.5x the state-buffer traffic on that first load,
and 4.5x the memory footprint of every per-slot array (which is separately what
made the view state 41 MB, see the transport codec).

The fix is compaction, not removal: companion slots must keep stable identities
because a phase transition materialises one.

**Measured, and it makes the fix much cheaper than a general index buffer: the
live particles are perfectly contiguous at the front of the slot array.** On an
h2o/fe scenario at 19,772 slots, live slots are exactly `[0, 4394)` -- first
zero-mass slot at 4394, last live slot at 4393, and zero live slots after the
first dead one. `appendPhaseCarrierLanes` appends companions after the live
particles and spare product slots after those, so the initial layout is
naturally sorted.

So the initial-state fix is a bound, not an index: dispatch
`ceil(liveCount / 64)` instead of `ceil(slotCount / 64)`.

**The correctness constraint is what makes this non-trivial.** Liveness stops
being contiguous during a run: a phase transition materialises a companion slot
and reaction placement fills a spare, both far above the initial live range.
Dispatching over a *superset* of live slots is always safe; dispatching over too
few silently drops particles. So the design has to be:

- kernels that can **activate** a slot (phase carrier transfer, reaction
  placement) keep dispatching over the full slot range;
- kernels that only **process** live particles (P2G, finalize, grid update,
  G2P) dispatch over a high-water bound that activating kernels raise with an
  atomic max, consumed as indirect dispatch args -- the same mechanism
  `dispatchActiveGridComputePass` already uses for active grid nodes.

A host-side bound refreshed from the compact summary is **not** safe on its own:
a companion activated this substep would be skipped until the next readback.

The bounding experiment was run and **did not yield a number**: with
`phaseLaneCount = 1` the 50k scenario reports `status: bad` with no kernel
timing, because removing the companion lanes removes the phase-transition
capacity the scenario actually uses. A ceiling measurement needs a scenario with
no phase transitions rather than a build with no capacity for them.

**More important, and it reframes the priority: this inflation is not an SS
refactor cost.** `appendPhaseCarrierLanes` lives in `sphPhaseDemo.js`, which
`7454ac9` shares unchanged, so the baseline dispatches over exactly the same
19,772 slots. It cannot explain any regression between the two, and compaction
would speed up both arms equally. It is a general optimisation, not a merge
concern -- which is consistent with the branch measuring only 4.3% off baseline
at 48,778 particles despite 77.8% of threads being dead in both arms.

The likely size is also modest: each wasted thread costs scheduling plus one
16-byte load, so at 15,378 dead threads that is roughly 246 KB of extra traffic
per kernel per substep, not a bandwidth wall. Worth doing for the memory
footprint -- 4.5x on every per-slot array -- more than for the frame time.

## FIELD-0 is written and never wired

sol-critic P0 calls the dense render-field gather "the largest clear
redundant-calculation target": one invocation per surface cell, each scanning
every particle, `S * 884,736 * N` visits -- 8.85 billion for one surface at
10,000 particles. Its recommended replacement is a particle-parallel splat,
estimated at 140,976 / 432,000 / 3,456,000 visits.

**That replacement already exists.** `src/runtime/sph/sphRenderFieldSourceLocalGpu.js`
is particle-parallel (`if (particle_index >= params.particle_count ...)`) and
scatters into a small `radius_cells` neighbourhood -- exactly the splat shape.

It is not used. Its modes are `shadow`, `diagnostic-no-readback` and
`disabled`; there is no production mode, and the only importer in the entire
repository is `tests/sphRenderFieldSourceLocalGpu.test.mjs`. Nothing under
`src/` references it.

**But it is not nearly production-ready**, and its own admissibility check says
so. `sphRenderFieldSourceLocalGpu.js` refuses with these reasons:

| reason | meaning |
| --- | --- |
| `shadow-parity-requires-full-readback` | parity only checkable with a full readback |
| `velocity-smear-parity-not-yet-implemented` | any `renderSmearDtS > 0` unsupported |
| `product-event-parity-not-yet-implemented` | product events unsupported |
| `successor-lineage-parity-not-yet-implemented` | Schroeder spatial source family unsupported |

So the splat covers the base case only. Wiring it to production as it stands
would silently drop velocity smear, product events and successor lineage --
three real features -- which is exactly the kind of "add laws, never remove
one" violation `Agents.md` prohibits.

FIELD-0 is therefore: kernel written and tested for the simple case, three
declared parity gaps to close, then a production mode, consumer wiring, and an
equivalence gate against the gather before the gather can be retired. That is
substantial work, not a wiring job. Priority 1 is unblocked now that 0B is
green, and this is the largest remaining win in the system.

### Why velocity smear is the structurally hard gap

Worth writing down because it is not obvious from the refusal string, and it
dictates the shape of the whole splat design.

The splash-shard smear is **per-cell, two-pass, and gather-shaped**. Pass one
accumulates velocity moments for a cell, weighted by that cell's positive
metaball values; the cell's velocity dispersion follows; pass two re-samples
every contributing metaball at the smeared distance
`dist^2 + (sigma_v * dt)^2`. A cell-parallel gather gets this for free because
one invocation already sees every particle contributing to its cell.

A particle-parallel splat does not: no single particle knows the dispersion of
any cell it scatters into. Parity therefore needs three sparse passes, not one:

1. **splat moments** — scatter `w`, `w * v` and `w * |v|^2` into per-cell
   accumulators (atomics, or a fixed-point integer encoding if float atomics are
   unavailable);
2. **reduce** — one invocation per touched cell computes `sigma_v` from those
   moments;
3. **splat density** — scatter again, each particle reading the destination
   cell's `sigma_v` to offset its distance.

That is still vastly cheaper than `S * 884,736 * N`, and it keeps the
correction exact rather than approximating it. Note the ordering constraint:
pass 3 reads what pass 2 wrote, so they cannot be fused, and pass 1 must
complete for every particle before pass 2 runs on any cell.

Product events and successor lineage are additional source families feeding the
same field; once the three-pass structure exists they are additional splat
inputs rather than new algorithms.

## Testing against the live dev server on 5174

A vite dev server runs on **5174 over HTTPS** from this worktree
(`https://dadbox.tail5c077c.ts.net:5174/`, or `https://127.0.0.1:5174` locally).
Vite's watcher keeps it current -- verified by fetching a module through it and
finding symbols added minutes earlier.

Point the probe at it instead of letting it spawn a throwaway server:

```
NODE_TLS_REJECT_UNAUTHORIZED=0 \
ULG_PROBE_BASE_URL='https://127.0.0.1:5174' \
ULG_PROBE_VIEWPORT_WIDTH=1280 ULG_PROBE_VIEWPORT_HEIGHT=800 \
ULG_SPH_VISUAL_CAPTURE=1 ULG_PROBE_FRAME_EVERY=1 \
ULG_PROBE_FRAME_DIR=<dir> ULG_PROBE_URL='/?...' \
ULG_PROBE_CHROMIUM_ARGS='--use-angle=vulkan --enable-features=Vulkan,UseSkiaRenderer --ignore-certificate-errors' \
node scripts/sph-long-horizon-probe.mjs
```

Two things that waste a run if missed: it is **https**, so plain `curl` against
`http://…:5174` returns nothing and looks like a dead server; and without
`ULG_PROBE_VIEWPORT_*` the frames come out 176x132, too small to judge anything.

## Visual checks at t0 / t-mid / t-final

Gate status is an aggregate and does not see "strange but passing". Frames are
captured by the matrix already (`ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1`, under
`<run>/<scenario>-frames/`); **look at them**, at least the initial frame, a
mid-run batch, and the final one.

Read the `post-probe-composited-page` frame rather than the `resident-batch`
crops. The crops are a 767x480 window on a 1280x800 canvas and cut off the
bottom of the container, which makes settled material look as though it has
vanished off-screen.

Two things looked wrong on `standard-iron-ice-quench` and neither was:

- **A blob apparently suspended in mid-air.** In the composited frame its
  screen position falls inside the floor quad at the far corner of the box --
  it is an ice fragment resting on the floor, thrown clear by the impact, not
  something stuck. It also moves between batches 8 and 10.
- **The iron base "disappearing".** It is dark blue-grey on a dark background
  and ends up under the ice pile; the faint dark rim below the white mound in
  the final composited frame is it.

One hypothesis raised and **disproved**, recorded so it is not raised again:
placeholder slots were suspected of rendering. They really are indistinguishable
from live particles except by mass -- 1,512 of 1,944 render rows carry zero mass
while still carrying a genuine material id, phase and `status: 1`, and the spare
product slots all sit at the box centre -- and neither the gather nor the splat
checks mass. But adding the guard produced a **byte-identical frame** and
`surfaceDrawMs` of 70.6 ms against 67.7 ms without it, so it fixes nothing and
costs slightly more. It was reverted rather than kept as a plausible-sounding
change with no evidence behind it.

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
