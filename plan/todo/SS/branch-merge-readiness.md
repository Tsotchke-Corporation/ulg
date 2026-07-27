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

## FIELD-0: DONE — splat is the default as of 2026-07-26

Measured with the PROF-0 queue-stage recorder on native Vulkan, same scenario,
same device, `n=15` builds per arm, **identical output in both arms (466,033
triangles, 1,398,099 vertices)**:

| | device render-field per build | renderRefreshTotalMs |
| --- | --- | --- |
| dense gather | 24.3 ms median | 40.8 ms median |
| source-local splat | **3.8 ms median** | **16.7 ms median** |

6.4x on the stage, 2.4x at the total. The total is the number that matters --
every other render stage is unchanged, so this is not work moving between
stages, which is the trap that produced two wrong reports earlier on this task.

Visual parity across t0/tmid/tfinal at 960x720, four paired runs: several frames
byte-identical, mean channel delta <= 0.019/255, at most 0.07% of pixels differ
by more than 2 levels, all of them on silhouette edges -- a ~1e-3 field
difference moving an isosurface boundary across a pixel. Full unit suite green
with the default flipped: 1999 pass, 0 fail.

### What was actually slow was not the algorithm

First measurement said the splat was **4.6x slower** than the gather. The cause
was not the splat: the atomic accumulator, `totalFieldCells * ACCUM_LANES` u32,
was built from a zero-filled `Uint32Array` on every build. At 884,736 cells and
14 lanes that is a **49 MB host allocation and a 49 MB host-to-device upload per
frame**, and it grew every time a lane was added for the velocity smear. It is
now allocated once per device and zeroed on the device with `clearBuffer`.

That turned out to be an instance of a general pattern, not a one-off:
`writeStorageBuffer(device, label, new Float32Array(N))` uploads N bytes of
zeros into a buffer WebGPU has **already** zero-initialised. Seven more sites
had it, including the dense path's own 28 MB `ulg-sph-render-field-cells` and
the material-interface source-local buffers. `createZeroedStorageBuffer` in
`sphRenderGpuKernel.js` and `sphMaterialInterfaceSourceFieldLocalGpu.js`
replaces them. The dense arm's numbers above are measured **after** that fix, so
the comparison is fair -- dense was already short-circuiting its own site via
the scene's pooled `targetFieldRowsBuffer`, and did not get faster.

### One unexplained failure, recorded rather than dismissed

Across the measurement campaign the splat arm died once with "Execution context
was destroyed" on an 8-batch 960x720 run. It did not reproduce: 6 subsequent
splat runs at the same and larger settings passed, GPU memory peaked at 2.7 GiB
of 16 GiB, and paired A/B runs were 4/4 clean on both arms. This error string
has previously traced to environment (tmpfs exhaustion), not product. Not
attributed to the splat, not claimed clean either.

## FIELD-0 parity: all three gaps closed and verified

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

## PROF-0 reframed: the interface exists with 17 consumers and no producer

Three ticks were spent plumbing `stageGpuMs` by hand through layer after layer,
each of which rebuilds its timing object field by field and drops anything not
explicitly listed. That was the wrong approach, and the reason only became clear
after chasing the chain to the end.

**`gpuTimestampRecorder` is already a contract with consumers throughout the
runtime and no implementation anywhere.** 17 modules reference it across 51 call
sites -- `sphMlsMpmGpuStep`, `webgpuRadixScanUnique`, `schroederSpatialEpochGpu`,
`schroederSpatialMechanicalProposalsGpu`,
`schroederSpatialReactionProductPlacementGpu`, `sphMlsMpmPostMechanicsClosure`
and more. Every one guards on `recorder?.active === true` and then calls
`measureQueueStage(descriptor, runStage)` or `beginEncoderSpan(...)`.

Nothing ever constructs one. `schroederGpuTimestampRecorder` is a scene
parameter defaulting to `null`, forwarded once, and there is no factory in the
tree. So every consumer takes its inert branch, forever.

Critically, `timedStage` in `runMlsMpmResidentStepWithOptionalWebGpu` -- the
wrapper that invokes the fused-mechanics call that actually executes -- already
routes through `measureQueueStage`. The instrumentation point that was hunted
for across three ticks was already there.

So `createSphGpuTimestampProfiler` is not redundant; it is the missing producer,
built to the wrong shape. The work is to make it satisfy the
`gpuTimestampRecorder` contract -- `active`, `measureQueueStage`,
`beginEncoderSpan` -- and supply it from the scene when
`?residentGpuTimestampProfile=1` is set. Then 51 call sites light up at once
instead of one hand-plumbed field.

This also means the earlier hand-plumbing should be removed rather than
extended: `stageGpuMs`/`gpuTimestampProfile` threaded through the fused
sequence, the envelope and the probe are all redundant once the recorder exists,
and each is a field-by-field rebuild waiting to drop a field.

The diagnostic scaffolding used to find this -- marker fields in the fused
mechanics results and in the surfacing `stageTiming` -- was reverted; it served
its purpose and does not belong in the tree.

**Still the gating dependency for FIELD-0**: `renderFieldMs` is host enqueue
time, so dense versus splat is unanswerable without real GPU timing.

### PROF-0 producer landed 2026-07-26 (`b2098f5`)

`createSphGpuQueueStageRecorder` in `sphGpuTimestampProfiler.js` is the missing
producer. It brackets a stage with `queue.onSubmittedWorkDone()` fences, which
is the only measurement available for a stage assembled from several passes plus
a submit. Supplied by `sphPhaseScene.js` under `?residentGpuTimestampProfile=1`
only -- the fences serialise the pipeline, so it changes what it measures and
must never run in a production frame.

Encoder spans are deliberately inert (`beginEncoderSpan()` returns `null`).
Current WebGPU has no `encoder.writeTimestamp`; timestamps come only from
`timestampWrites` on a pass descriptor. Every consumer already guards on null,
so declaring none is honest and costs nothing.

Wiring it exposed a second dropped hop: `runThermalSidecarDirectResidentStep-
WithOptionalWebGpu` -- the runner that actually executes `fusedMechanics` when a
thermal sidecar is present -- was passed `gpuTimestampRecorder` by its caller and
dropped it in the destructuring, while defining its own `timedStage` that never
consulted it. Two independent instances of the same failure mode in one
contract.

Surfacing: `stageTiming.queueStageGpuMs` / `.queueStageGpuStats` on the resident
step, `sphResidentRenderState.residentGpuQueueStageStats` for the render
refresh, both captured by `sph-long-horizon-probe.mjs`. Kept separate from
`stageGpuMs`, which is pass-level timestamp-query data: one measures pass
execution, the other brackets a whole stage including submit latency. Merging
them would make a reader unable to tell which they were looking at.

## Everything on this page was measured with `ss=1` OFF until 2026-07-26

The probe URL used throughout this campaign never set `ss=1`, so
`schroederActiveNodeIndexEnabled` was false and **the Schroeder path this branch
exists to build was not running**. A change to a shared runtime helper shipped
green against a full unit suite and a clean production probe, and broke every
`ss=1` run.

Re-verified at `48fb060`, `ss=1`, 10 batches, both render-field arms:

| arm | timeline | errors | triangles | frame validation |
| --- | --- | --- | --- | --- |
| splat (default) | complete | none | 466,033 | passed |
| dense (`sourceLocalField=0`) | complete | none | 466,033 | passed |

**Probe any shared-runtime change with `ss=1` as well as without.** The default
configuration is not a test of this branch.

## GPU residency: audited by counting, not by reading code (2026-07-26)

The standing rule is that nothing reads back to the CPU in the hot loop and the
field stays GPU-resident all the way through rendering. The runtime has ~140
static `mapAsync` sites, nearly all gated behind a readback mode, so counting
them statically proves nothing either way.

`ULG_PROBE_TRACE_NATIVE_BUFFER_MAP=1` wraps `GPUBuffer.prototype.mapAsync` and
tallies calls by buffer label into every probe sample. A per-frame readback is
one whose count rises between consecutive samples. Production config, 10
batches:

```
startup   4  optical-lookup, presentation-diff x2, offscreen-validation
per batch 1  ulg-sph-authoritative-checkpoint-N-compact-readback
end       1  presentation-diff-3
          --
total    15
```

**Zero per-frame readbacks.** The one recurring call is the authoritative
checkpoint's compact evidence record -- `(20 + 64*29) * 4 = 7,504 bytes`, fixed
size regardless of particle count -- and it lives in
`scripts/sph-authoritative-gpu-checkpoint.mjs`, a probe, not the runtime. That
is the GPU-native validation design working as intended, not a leak.

### What *was* broken was the other direction

The audit was prompted by the right question asked about the wrong direction.
Nothing was reading back; something was **uploading**. The source-local
accumulator was a 49 MB host allocation and host-to-device upload per frame
(see FIELD-0 above), and seven other buffers uploaded zeros into memory WebGPU
had already zeroed. "GPU-resident" has to mean both directions, and only the
readback direction had a name, a flag and a gate.

### Queue fences: 162 per batch, and they cannot be coalesced — REVERTED

Same method as the readback audit -- `ULG_PROBE_TRACE_NATIVE_QUEUE_FENCES=1` now
tallies `onSubmittedWorkDone` by call site into every sample instead of only
dumping stacks. Production config, 10 batches: **162 fences per batch, 161 of
them from `deferSubmittedWorkCleanup` (`webgpuComputeLayout.js`)**, every one
waiting for the same device idle point. They are not host stalls -- that helper
schedules cleanup on the fence rather than awaiting it.

**Two coalescing schemes were built and both were reverted. Do not try a third
without reading this.**

1. *One fence in flight, newcomers wait for the next one.* Measured 162 per
   batch down to 4. It also **broke every `ss=1` run**: "Thermal proposal arena
   0 is still leased by generation 1". `schroederSpatialThermalProposalsGpu.js`
   releases its arena lease through `deferSubmittedWorkCleanup`, so delaying a
   release by one fence round trip let the next substep reach `acquire` before
   the previous release had run. **Release latency is a correctness property
   here, not a performance one.**
2. *Batch per microtask turn* -- safe, since each cleanup's fence is created in
   its own turn. Measured **no reduction at all**: 162 per batch, unchanged.
   The 161 registrations are already spread across separate microtask turns by
   the awaits between stages, so there is nothing in a turn to coalesce.

So the helper is back to one fence per cleanup, with that rationale recorded on
it. The tracer stays; it is how this was found and how the next attempt should
be judged.

**How the regression was caught, and how it nearly was not.** Every measurement
in this campaign ran *without* `ss=1` -- the probe URL never set it, so
`schroederActiveNodeIndexEnabled` was false and the Schroeder path was off
entirely. The coalescing shipped green against a full unit suite and a clean
production probe. It only surfaced when Priority 3 required turning SS on.
**The default probe configuration does not exercise this branch's own feature.**
Any change to shared runtime helpers has to be probed with `ss=1` as well.

The failure was also nearly invisible: the probe recorded
`phase: resident-batch-error` with `error: null`, and the message was in a
separate `timeline.errors[]` array. Third instance in this campaign of a real
failure surfacing as an absent value.

### Per-substep DAG rebuilds: it is buffers, not bind groups

`ULG_PROBE_TRACE_NATIVE_DAG_BUILDS=1` tallies `createBindGroup`,
`createBindGroupLayout`, `createComputePipeline`, `createPipelineLayout`,
`createShaderModule`, `createRenderPipeline` and `createBuffer` by label, and by
caller source position when the descriptor is unlabelled. Production config,
10 batches, 32 substeps each:

- **~550 bind groups per batch**, at ~17 call sites, each site landing on
  *exactly 32* -- one per substep.
- **608 buffer allocations per batch**, across 19 labels, again 32 apiece:
  `fused-p2g-grid-out`, `fused-p2g-grid-accumulators`, `fused-grid-update-out`,
  `fused-g2p-state-out`, `fused-g2p-mechanics-out`, the three params buffers,
  and the empty-placeholder buffers.
- `ulg-sph-render-rows` was **recompiling its WGSL module and rebuilding both
  layouts and its pipeline on every render refresh**, for a shader whose source
  is a module constant. Fixed by routing it through
  `createCachedExplicitComputePipeline`; it no longer appears per batch.

**A bind-group cache does not fix the 550.** One was built, keyed on layout plus
per-entry buffer identity, with tests covering ping-pong reuse, offset/size
identity and bounded growth. Applied to the eight hottest sites it measured a
**0% hit rate** -- 256 misses per batch, exactly 8 sites x 32 substeps -- and
the total went 550 -> 553. It was reverted rather than shipped: a cache that
never hits is dead code that reads as a live optimisation, which is the pattern
the inventory below exists to stop.

**Landed: the zero-row placeholders are shared per device.** Seven of the 19
buffer labels are read-only all-zero rows that stand in for a disabled feature --
`fused-empty-product-events`, `fused-empty-pressure-force-rows`,
`fused-empty-schroeder-level-assignments`, `fused-empty-schroeder-spatial-directory`
and friends. Nothing owns them, nothing writes them, and their contents are
identical by construction, so a per-device singleton is unambiguously safe where
pooling a real buffer would not be. They are excluded from every per-substep
destroy list and their `owns*Buffer` flags are false. Measured: **608 -> 384
buffer allocations per batch**, total device-object creation 992 -> 768,
identical 466,033-triangle output, full suite green.

The reason a bind-group cache cannot hit is the second bullet. The bind groups genuinely
reference different buffers each substep, because the substep **allocates new
ones**. So the real item is per-substep buffer allocation, and bind-group
caching only becomes worth revisiting once buffers are stable.

Note the ownership hazard that makes the pooling non-trivial: `g2p-state-out`
and `g2p-mechanics-out` are the next substep's inputs *and* can be retained by
the render path across the sequence boundary. A naive two-deep pool would let
substep N+2 overwrite a buffer the renderer is still reading -- which is
plausibly related to the standing `resident-render-source-stale` probe issue,
and must be settled before pooling, not after.

### `normalHotLoopReadbackFree` was reporting absence as failure

The earlier note that "5 of 53 samples are not readback-free" was wrong, and the
error is worth keeping: the demo mount built that field with `Boolean(...)`, so a
summary with `available: false` and every field null reported
`normalHotLoopReadbackFree: false` -- an absent measurement rendered as a
measured bad result. All 12 such samples in the 2026-07-26 campaign were this.
It now reports `null` when neither source claimed anything. Same failure mode as
a timestamp query reporting 0 ms for a pass the device never wrote.

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

#### Settled 2026-07-26: the premise above is wrong. They do not match.

The open question was whether the epoch's key granularity matches the
active-node tile granularity. It does not, and the mismatch is not only
granularity -- it is **shape**.

The epoch key (`emit_spatial_keys`, `schroederSpatialEpochWgsl.js`) is

```wgsl
let cell_f = floor(position / native_spacing);
```

— one **point**, at one cell of the level's native spacing.

An active-node row (`ulg-gpu-abi/src/wgsl.js`) is

```wgsl
let tile_spacing = ss_active_tile_spacing(native_dx);   // native_dx * tile_cell_count, clamped
let min_tile = floor((position - vec3<f32>(expanded_support)) / tile_spacing);
let max_tile = floor((position + vec3<f32>(expanded_support)) / tile_spacing);
```

— an **AABB of tiles**, at a spacing coarser by `tile_cell_count` (default 8)
per axis and clamped by `minTileSpacingM`/`maxTileSpacingM`, inflated by the
particle's support radius.

So "the unique groups already are unique spatial cells at the selected level,
which is exactly what an active node is meant to be" is **not true**. The epoch's
unique groups cannot be consumed as active nodes:

- they are 8x finer per axis, so one tile spans up to 512 epoch cells;
- they are points, while an active node is a range. Two particles in the same
  tile can still have different `min_tile`/`max_tile` because their support
  boxes differ.

That leaves two real designs, and the choice is a physics/cost trade rather than
a plumbing decision:

- **(a) Dedup on the AABB tuple** `(level, min_tile, max_tile)`. Exactly
  equivalent to today -- no consumer changes, no over-approximation. Compaction
  ratio depends on how uniform the support radii are, since two particles share
  a row only if their inflated boxes round identically.
- **(b) Dedup on the tile coordinate alone** and store the **union** of the
  occupants' support boxes. This is one row per occupied tile, which is what
  sol-critic P0 actually asks for. The union is a safe over-approximation --
  supersets never drop particles -- but it widens each node's scan range, so it
  trades allocation against neighbour-scan work. That trade has to be measured,
  not assumed.

Either way the existing stable radix primitive still does the sorting; what
changes is the key, and the plan's step 1 ("derive a tile key per particle")
remains correct. Step 3 is where (a) and (b) diverge.

#### Measured 2026-07-26: take (a). (b) degenerates.

`scripts/schroeder-active-node-compaction-probe.mjs` runs the real level
assignment and active-node kernels on a real GPU over a uniform lattice, at the
**shipped geometry defaults** (`targetSupportCells` 1.5, `supportRadiusScale` 1,
`tileCellCount` 8, `supportInflateCells` 1), and reports both ratios plus what
(b) costs in scan volume:

| particles | (a) rows | (a) compaction | (b) rows | (b) compaction | (b) scan inflation |
| --- | --- | --- | --- | --- | --- |
| 4,096 | 8 | 512x | 1 | 4,096x | 1.66x |
| 10,648 | 8 | 1,331x | 1 | 10,648x | 2.37x |
| 32,768 | 27 | 1,214x | 1 | 32,768x | **5.94x** |

**Design (a) gives 500-1,300x compaction with no over-approximation and no
consumer change.** The unique AABB count is tiny because most particles' inflated
support boxes round to the same tile range.

**Design (b) is worse than it looks and gets worse with size.** It compacts to a
single row, but that row's unioned support box then covers the whole domain, so
every particle scans everything: scan inflation 1.66x -> 2.37x -> 5.94x as the
lattice grows. That is the O(N^2) behaviour the hierarchy exists to avoid.
sol-critic P0's wording ("one active row per particle" should become one per
node) reads as (b); taken literally it would make things worse.

Geometry context for why (b) collapses: at these defaults `nativeGridSpacingM`
is 0.40 m against a 0.10 m particle spacing, so `tileSpacingM` is 3.20 m -- **a
tile is the size of the whole domain** at these particle counts. Whether that
tile sizing is itself right is a separate question this measurement raises and
does not answer.

#### Landed: the compaction key and its ratio, on the GPU, evidence only

`src/runtime/sph/schroederActiveNodeCompactionGpu.js` emits the design-(a) key
from real active-node rows and runs the existing stable radix unique over it.
The key is exactly the eight fields that make two rows interchangeable to a
consumer -- `levelId`, `chartId`, `tileMin.xyz`, `tileMax.xyz` -- which is also
exactly `WEBGPU_RADIX_MAX_KEY_WORDS`, so it fits the sort without widening
anything. Signed tile coordinates are sign-flipped for ordering, because a
support box crossing the origin produces negative coordinates that a raw
bitcast would sort above every positive one and split one node into two groups.

It reads back 40 bytes of fixed-size evidence and nothing else, and it changes
no allocation and no consumer. Verified on native Vulkan against the off-line
script over the same rows -- 10,648 particles, **8 unique nodes, 1,331x**, zero
uncaptured errors -- so the GPU key agrees with the host computation that
produced the table above. Concretely, at that size:
`activeNodeByteLength` **681,472 -> 43,104 bytes**, including a `u32` per
particle for the indirection the next increment needs.

Evidence-first on purpose. Sizing an allocation by a ratio nobody measured on
the real workload is how the candidate arena ended up reserving 4 KiB per
particle.

#### Landed: the compacted list, the per-particle index, and a byte-identity proof

`emitCompactedNodes: true` runs a second pass that scatters
`nodeIndexByParticle[sortedIndices[p]] = groupIndex(p)` and copies each group's
representative row into compacted slot `groupIndex`. It follows the spatial
epoch's directory-assembly conventions rather than inventing its own, which
matters for two details that are easy to get wrong and produce plausible-looking
wrong neighbours:

- `uniqueGroupIndexBySortedPosition` holds an **inclusive head count**, not a
  group index. The group is `[p + 1] - 1`, falling back to `uniqueCount` at the
  last position. Read as a group index it puts every particle on its
  neighbour's node.
- `uniqueOffsets[group]` is the sorted position that **heads** the group, so
  `p == uniqueOffsets[group]` is the representative test.

Rejected rows all share the sentinel group, so that slot is written canonically
zero rather than copied from an arbitrary member -- copying would publish one
rejected particle's position as the whole group's.

**Verified on native Vulkan, 10,648 particles: `checkedParticleCount` 10,648,
`mismatchedParticleCount` 0, `outOfRangeNodeIndexCount` 0.** Every particle's
index lands on a compacted row identical to its own in every geometry field
(`levelId`, tile min/max, `tileSpacing`, `nativeDx`, `supportRadius`, `status`,
`chartId`).

#### That check was not sufficient, and the correction changes the design

It excluded `sourceParticleIndex` (field 10) and position as "legitimately
differing between group members". True, and **that is exactly the problem** --
which makes the check circular: it verified the fields the key is built from,
proving the key self-consistent rather than sufficient.

`ulg-gpu-abi/src/wgsl.js:13683`, in the exhaustive law-neighbour fallback:

```wgsl
let neighbor_index = u32(max(round(active_nodes[selected_active_offset + 10u]), 0.0));
```

The scan finds a row whose tile overlaps and then **recovers the neighbour
particle from field 10**. So the "active node list" is not a node list at all --
it is a per-particle list with tile bounds attached. A compacted row carries one
particle index, so a consumer reading field 10 off it would silently lose the
other 1,330 members of that group. Plausible physics, almost every neighbour
missing. Wiring the compacted list in as a drop-in replacement would have done
exactly that.

**The fix was already in hand.** The radix produces the CSR for free: group `g`'s
member particles are `sortedIndices[uniqueOffsets[g] .. uniqueOffsets[g + 1])`,
the same structure the spatial epoch builds for its cells. Both buffers are now
published as `nodeMemberIndicesBuffer` / `nodeMemberOffsetsBuffer`.

So the split is:

- the **compacted list** answers *which nodes overlap* -- the O(N^2) term, and
  the only part compaction shrinks;
- the **CSR** answers *which particles are in this node* -- what field 10 used
  to answer one particle at a time.

Compaction shrinks the search, **not** the particle set.

Verified with the check that would have caught this in the first place:
`csrCoveredParticleCount` **10,648**, `csrDoubleCoveredCount` **0**,
`csrAdmittedUncoveredCount` **0** -- the CSR reaches every admitted particle
exactly once.

Also fixed here, and it was latent in the evidence-only commit: the radix
primitive refuses `releaseExecution` after submission -- that entry point is for
a discarded encoder, and post-submission it wants `releaseExecutionAfter` with a
fence. Releasing from inside a deferred cleanup is by definition
post-submission, so it threw *inside a cleanup callback*, where there is no
caller and it surfaces only as an unhandled rejection.

**Next increment** (not started): switch consumers onto the per-particle index
and dispatch them over nodes instead of particles.

#### How the N^2 scan is actually reached, and what that means for the fix

Read before writing any of this. The exhaustive scan is **not** the normal path
-- it is the fallback when the bucket index cannot satisfy the request:

```
selected = ss_neighbor_select_active_index_match(...)      // bucket lookup
if (selected >= params.active_node_count) {                 // bucket missed
  ss_neighbor_diagnostic_add(..._EXACT_FALLBACK_SCANS, 1u);
  loop { ... scan all active_node_count rows ... }          // O(N) per query
}
```

`DEFAULT_ACTIVE_NODE_INDEX_BUCKET_SLOT_CAPACITY` is **32**. With one active-node
row per particle, a bucket covering a populated region holds far more than 32
rows, overflows, and the query drops into the exhaustive scan. That is the
mechanism behind "consumers can still reach the exhaustive `N*N` fallback".

**So compaction fixes the N^2 problem by relieving bucket pressure, not by
rewriting the scan.** At 710x-1,331x fewer rows, the distinct nodes for a region
fit inside 32 slots and the fallback stops being reached at all. The scan can
stay exactly as it is.

Two constraints on the wiring, both discovered in the code rather than assumed:

- **Binding pressure is the real limit.** The law-neighbour kernel already binds
  **9 storage buffers** (0-4, 6-9), past the default
  `maxStorageBuffersPerShaderStage` of 8 -- the same limit whose breach the
  fused-mechanics tests record as having "invalidated every P2G pipeline on
  default-limit devices". Adding three CSR bindings is not available. They have
  to **replace** bindings 6, 8 and 9 -- the bucket slots and the sorted index --
  which is the natural move anyway, because the node CSR supersedes both: they
  exist to accelerate the same neighbour search, less well.
- **Field 10 still needs the CSR.** A bucket hit returns a node; the neighbour
  particle comes from member enumeration, not from the row.

**And the diagnostics to prove any of this already exist**:
`exactFallbackScanRatio`, `bucketPressureRatio`, `exactFallbackScanCount`, with
thresholds, computed in `schroederHierarchyGpu.js:2519-2604`. They are never
observed, because the law-neighbour path is off by default
(`schroederEnableLawNeighborCandidates`) and the probe does not enable it --
`lawQueueProxyCount` is 0 in an `ss=1` run. **Measure the fallback ratio before
doing the rewrite**: if buckets are not actually saturating in real scenarios,
the win is theoretical.

**The former real target, the exhaustive fallback scan** -- kept for the
self-skip trap it contains, which applies to any node-wise rewrite: The
loop at `ulg-gpu-abi/src/wgsl.js:13654` walks all `active_node_count` rows per
queue row testing tile overlap -- one row per particle, so N per particle, so
N^2. That is the "consumers can still reach the exhaustive `N*N` fallback"
mechanism listed above. Compacted, its overlap tests drop by the measured
ratio (710x-1,331x) while the CSR keeps every neighbour reachable.

Rewriting it needs care on one point that is the same class of error as the
field-10 bug: the current scan skips `active_index == source_active_index` to
avoid self-pairing. Node-wise, the source particle's *own node* also contains
its genuine neighbours, so the skip has to move from the node to the member --
skipping the whole node would make every particle sharing a node with the
source unreachable, which at these ratios is most of them.

The bucket index (`runSchroederActiveNodeIndexWebGpu`) is the easier warm-up: it
already iterates rows *as nodes* rather than per particle -- `schroederHierarchyGpu.js:8216`,
`dispatchWorkgroups(ceil(plan.activeNodeCount / WORKGROUP_SIZE))`, where
`activeNodeCount` is the particle count today. The change is three edits:

1. bind `compactedNodeBuffer` in place of the per-particle `activeNodeBuffer`;
2. replace that dispatch with
   `dispatchWorkgroupsIndirect(uniqueDispatchIndirectBuffer)`, so the row count
   comes from the GPU and no readback is needed;
3. wherever a consumer of the bucket index maps back to a particle, hop through
   `nodeIndexByParticle[particle]` first.

Its `params.row_count` bound also has to come from `uniqueEvidence[2]` rather
than a host uniform, or the kernel will still guard against the particle count.

**Verify with `ss=1`.** Every consumer touched here is on a path the default
probe does not run, which is how the fence-coalescing regression got through a
green suite and a clean production probe.

The design fork this hits, and its answer, because the plan above did not
anticipate it: **a GPU-authored unique count cannot size a host-side
allocation.** The two obvious ways out are both bad -- read the count back
(breaks GPU residency) or allocate at a bounded capacity (and *dropping an
active node drops a particle*, which is exactly why this could not be
byte-bounded like the candidate arena).

Neither is needed. `encodeSortUnique` already returns
**`uniqueDispatchIndirectBuffer`**, a GPU-authored indirect dispatch sized by
the unique count. So the sequence is:

1. keep `activeNodeByteLength` at particle capacity for now -- no overflow risk,
   no dropped nodes, no memory win yet;
2. scatter `activeNodeIndexByParticle[sortedIndices[p]] = uniqueGroupIndex[p]`,
   one small kernel, giving every consumer its O(1) hop;
3. emit one compacted row per unique group from each group's representative;
4. switch consumers from `dispatchWorkgroups(ceil(particleCount / 64))` to
   `dispatchWorkgroupsIndirect(uniqueDispatchIndirectBuffer)`.

That takes the **compute** from one node per particle to one per distinct node
-- which is what "make two-level SS actually sparse" asks for -- with no
readback and no capacity gamble. The **memory** win needs the allocation
resized, which can follow once the ratio has been observed across real
scenarios rather than one uniform lattice.

Consumer surface is smaller than it looks: `node_offset` is derived in seven
places in `ulg-gpu-abi/src/wgsl.js`, and only two derive it from
`particle_index`. The other 75 `active_nodes[...]` reads all go through
`node_offset`, so the indirection lands in those derivations rather than at
every read.

#### The uniform-lattice caveat, resolved

The first measurement used a uniform single-material lattice, which resolves
every particle to one level and one support radius -- the best possible case for
a key built from level and tile bounds, so 1,331x was an upper bound rather than
a promise. `ULG_ACTIVE_NODE_COMPACTION_MIXED=1` gives half the lattice a
different smoothing length (which resolves to a different level, the thing that
actually splits the key), a different material and rest volume, and jitters
every position by up to 40% of the spacing. Jitter is deterministic, not
`Math.random`, so the ratio stays reproducible.

| input | unique nodes | compaction | CSR coverage |
| --- | --- | --- | --- |
| uniform, one material | 8 | 1,331x | 10,648 / 0 double / 0 uncovered |
| two materials, two levels, jittered | 15 | **710x** | 10,648 / 0 double / 0 uncovered |

Heterogeneity roughly doubles the node count and halves the ratio. **710x on
heterogeneous input is still three orders of magnitude**, and the CSR reaches
every admitted particle exactly once in both cases, so the design holds. The
ordering of (a) over (b) never depended on this -- (b)'s scan inflation is
driven by domain extent, not material variety.

**Also settled: this cost is not paid in the default configuration.**
`schroederEnableActiveNodeIndex` defaults to the Schroeder simulation flag,
which the probe never sets, so none of the per-particle active-node allocation
runs unless `ss=1`. Priority 3 must be measured with it on.

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
