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

## FIELD-0: all three parity gaps closed and verified

`sphRenderFieldSourceLocalGpu.js` is the particle-parallel splat sol-critic
recommends in place of the dense `S * 884,736 * N` gather. It existed, was
tested, was wired to nothing, and declared three not-yet-implemented refusals.
All three are now closed **with numeric verification against the dense gather**
on native Vulkan (`ULG_RUN_NATIVE_RENDER_SOURCE_LOCAL=1`, 12/12, 0 skipped):

| gap | how it was closed | evidence |
| --- | --- | --- |
| velocity smear | four-pass sequence: moments -> reduce -> smeared re-splat -> resolve | single particle matches to 4.6e-5; two diverging particles engage the correction and still land within 1e-3 |
| product events | dedicated splat pass mirroring the gather's admission rule | density and palette within 1e-3 |
| successor lineage | runs the dense path's own authentication rather than exempting itself | provenance only, changes no cell |

### Two mistakes the parity gate caught, both mine

**The gate as it stood would have passed a broken implementation.** It compared
only the base case and exercised none of the three paths. Extending it is what
found everything below.

**`device.queue.writeBuffer` is queue-ordered, not encoder-ordered.** The first
smear implementation rewrote one uniform's `splat_phase` word between passes.
Both writes land before the command buffer executes, so both passes read the
last phase written: density doubled (1186.41 -> 2372.82) because both ran as the
primary phase, while the smear offset stayed zero because the moments phase
never ran. Each phase now owns its uniform buffer and bind group.

**A single particle cannot test dispersion.** `<|v|^2> - |<v>|^2` is zero by
construction for one particle, so the original arm proved only that the sequence
does not corrupt an uncorrected field. The second arm places two nearby
particles with opposing velocities and asserts the correction actually engages.

Still shadow mode. Making the splat the production render-field path is the
remaining step, and now has a parity gate behind it.

## PROF-0 end-to-end: three hops wired, chain still breaks

The switch reaches further than it did and still does not produce a number.
Wired so far, each one genuinely missing:

1. `sphPhaseScene.js` computed `enableResidentGpuTimestampProfiling` from the
   mount's flag and never passed it on -- the resident step options now carry
   `residentGpuTimestampProfilingRequested`.
2. The fused sequence built its `stageTiming` *before* reading the profiler, so
   the read was moved ahead of it and `stageGpuMs` / `gpuTimestampProfile` added.
3. The resident-step envelope rebuilds `stageTiming` field by field rather than
   spreading it, so anything the fused sequence adds is dropped unless listed --
   both fields are now forwarded.
4. `sph-long-horizon-probe.mjs` `compactStageTiming` likewise rebuilds field by
   field; it now carries `stageGpuMs`, `gpuTimestampProfileStatus` and
   `gpuTimestampProfiledPassCount`.

After all four the probe reports `gpuTimestampProfileStatus: null`. That value
is diagnostic: the profiler always returns a status string when it runs, so
**null means the profile object itself never arrived**, not that profiling was
inert. Another layer between the fused sequence and the envelope is still
dropping it, or the executed path is not the fused sequence that was
instrumented.

Finding the next hop: log `Object.keys(stageTiming)` at the envelope
(`sphMlsMpmGpuStep.js` ~22531, `const stageTiming = finalStep.stageTiming || {}`)
during a profiled run. If `gpuTimestampProfile` is absent there, the break is
upstream in the fused sequence; if present, it is downstream of the envelope.

The pattern is worth naming, because it is the same defect three times in one
chain: **every layer here rebuilds `stageTiming` field by field instead of
spreading it**, so each new field must be added at every layer or it vanishes
silently. That is why a flag can be read correctly at the top and produce
nothing at the bottom.

## Built and not wired: a standing inventory

This keeps happening, so here is the list rather than another one-off
discovery. Modules under `src/` whose only importers are tests -- i.e. built,
covered, and connected to nothing in production:

| module | lines | what it is |
| --- | --- | --- |
| `runtime/mechanicsPromotionEvidence.js` | 1012 | mechanics stage-promotion evidence |
| `runtime/material/MaterialRegistry.js` | 255 | resolve material properties through ClosureRegistry (demo plan P2/P3) |
| `runtime/material/thermodynamicPreflight.js` | 132 | closure-backed thermodynamic preflight (P3) |
| `runtime/md/propertyEstimators.js` | 125 | material-agnostic property estimators over MD samples |
| `runtime/md/potentialFitting.js` | 85 | fit an interatomic potential to ab-initio energies -- the MoonLab/DFT bridge |
| `runtime/md/pairPotential.js` | 66 | general interatomic pair-potential interface |
| `runtime/md/mdInit.js` | 60 | deterministic MD initialisation |
| `runtime/material/materialResolverManifest.js` | — | material resolver manifest |
| `runtime/sph/sphRenderFieldSourceLocalGpu.js` | — | FIELD-0's splat (parity now passing, still shadow) |

Reproduce with a resolver over relative imports across `src/`, `tests/` and
`scripts/`, listing modules with test importers and no `src/` importer.

Two of these are not incidental. **The entire `md/` cluster is the ULG thesis
machinery** -- derive material properties from active microscopic dynamics
instead of importing them -- and `MaterialRegistry` plus
`thermodynamicPreflight` are the closure-backed resolution path from the same
plan. A project whose first hard rule is "no material property is primitive"
has the code for that rule written, tested, and disconnected. That is a large
part of why `scientificValidation=false` and `fullPhysicsValidation=false` are
still honest.

Not every entry should be wired. `*Reference.js` modules are deliberate CPU
oracles for tests. But the `md/` cluster, `MaterialRegistry`,
`thermodynamicPreflight` and `mechanicsPromotionEvidence` all read as intended
production paths.

Wiring any of them changes physics inputs, so each needs its own before/after
evidence rather than being switched on in a batch.

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

### Priority 3: unique active-node compaction — scoped, primitive already exists

The remaining half of Priority 3. sol-critic P0: "The active-node list currently
permits one active row per particle." Confirmed literally --
`schroederHierarchyGpu.js` sizes it as

```js
const activeNodeByteLength = Math.max(
  4, particleCount * SCHROEDER_ACTIVE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT
);
```

and there is **no tile-key or dedup logic anywhere in the file**. So the count is
genuinely per-particle, not merely over-allocated.

That distinction decides the approach. The candidate arena could be byte-bounded
because dropping candidates degrades neighbour coverage gracefully and can be
reported. **Byte-bounding the active-node list would drop particles entirely**,
so the only correct fix is real compaction.

**The compaction is already computed -- it is simply not consumed.** This is the
same shape as FIELD-0: the artifact exists and nothing reads it.

`src/runtime/webgpuRadixScanUnique.js` exports
`createWebGpuStableRadixScanUnique(device, ...)`, a stable GPU radix sort with
scan and unique. `schroederSpatialEpochGpu.js` already runs it over spatial keys
and binds three outputs:

| buffer | contents |
| --- | --- |
| `uniqueGroupIndexBySortedPositionBuffer` | which unique group each element belongs to |
| `uniqueOffsetsBuffer` | where each unique run starts |
| `uniqueEvidenceBuffer` | run evidence, including the unique count |

And the key those groups are formed from is level-aware -- `emit_spatial_keys`
in `ulg-gpu-abi/src/schroederSpatialEpochWgsl.js` derives it from the row's
level and native spacing. **So the unique groups already are unique spatial
cells at the selected level**, which is exactly what an active node is meant to
be.

So the remaining work is not writing a GPU compaction. It is deriving the
active-node list from the epoch's existing unique groups instead of from the
particle list: one row per unique group, `activeNodeByteLength` sized by the
unique count, and `uniqueGroupIndexBySortedPosition` kept as the per-particle
index so consumers still reach their node in O(1) without changing.

The open question to settle first is whether the epoch's key granularity matches
the active-node tile granularity exactly (`tileCellCount`, `supportInflateCells`,
`minTileSpacingM`/`maxTileSpacingM`) or is finer. If finer, the active-node key
needs to be a quantisation of the same input rather than the epoch key itself --
in which case the same radix primitive runs again over the coarser key, which is
still far less work than building compaction from nothing.

Shape of the work:

1. derive a tile key per particle from position and selected level (the tile
   geometry is already computed for `tileCellCount` / `minTileSpacingM`);
2. run the existing stable radix unique over those keys to get sorted unique
   tile keys, their run counts, and a per-particle index into the unique list;
3. emit one active-node row per unique key rather than per particle, and size
   `activeNodeByteLength` by the unique count;
4. keep the per-particle index so every consumer can still reach its node in
   O(1) -- consumers currently index by particle and must not have to change;
5. publish the compaction ratio as evidence, the same way the arena publishes
   its overflow.

Stability matters for the same reason it does elsewhere here: an unstable sort
makes the active-node ordering vary run to run, which would make every
downstream epoch and receipt comparison non-reproducible.

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
