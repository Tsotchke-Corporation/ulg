# A1 real-time substrate: progress record

> **2026-11-22 Live-Code Status (`23a961c4`):** **OPEN** (`0` formal oracle
> receipts). 100k+ `water-realtime` sustains `>= 1x` RT and the `1,970 Pa·s`
> shear viscosity bug is fixed, **but** Coupling #8 (`sphPhaseScene.js:21478,
> 50435`), 5 overlapping iron-ice contact responses, disabled 63-limb rationals,
> production CPU mirrors, `246` `@workgroup_size(1)` serial kernels, 11-file
> `device.lost` leaks, unbounded `DataState.setHotBuffer`, missing
> `uncapturederror` listener, raw NUL byte (`sphPhaseViewStateTransport.js:98`),
> `0 K` wall default (`thermalEnvironmentAuthority.js:222`), and p-wave speed
> mismatch (`sphPhaseDemo.js:1204`) remain open. See
> [`plan/CURRENT-PLAN.md`](../CURRENT-PLAN.md).

Date: 2026-11-14. Track A1: real-time physics, including the near-real-time
G2 plume scenarios moved here on 2026-11-13.

**Measured route.** All numbers below are the live Iron Ice plume route: rigid
ice and iron at 1,850 K, `sdt=0.001`, 1,888 rows, RTX 5060 Ti, Chrome 157.
The bodies are the `seq-plume3` set.

**Instruments:**
- `scripts/a1-hold-census.mjs` samples the page every 10 ms and reports:
  - steps/s and presented frames/s;
  - gate state and a timeline;
  - schedule trace and lane stage timing.
- `scripts/a1-worker-cpu-profile.mjs` captures a Chrome-tracing CPU profile of
  the page and workers.
- `scripts/realtime-gap-probe.mjs` now also attributes indirect dispatches by
  pass and pipeline, and fences and readbacks by call site.

## Slice 1: the post-step presentation hold never passed on the worker route

- **Symptom.** The mount holds the next resident batch until the post-step
  presentation proof passes. On the worker-owned route the visible bridge is
  `worker-owned-presented-canvas`. `resolveSphResidentPresentationProof` had
  no case for it and returned `resident-presentation-proof-missing-visible-bridge`.
- **Cost.** Every batch waited out the whole 1,250 ms proof timeout, then
  failed open. The gate was active 49.7% of wall time.
- **Fix.** `src/visualization/sphPhaseDemoMount.js` gained a proof for the
  worker bridge, built only from worker receipts:
  - the worker owns the display;
  - the canvas is visible with content and frames;
  - the isosurface frame was rendered;
  - the retained stage output is preserved, and its source step matches the
    current committed schedule;
  - the source is current: the generation matches, it is not retained, and
    it is not stale-after-publish.

  It sets `admitted`, not `foregroundProved`. The gate settlement accepts
  `worker-resident-presentation-committed` as an exact admission.
- **Result.** 6.0 → 12.0 steps/s. The gate is now active 0.4% of the time
  and settles about 40 ms after each batch.
- **Test:** `tests/sphPhaseDemoMountRemoteRefresh.test.mjs`, the "A1:
  worker-owned presented canvas" case (exact, stale and unadmitted cases, plus
  gate settlement).

## Slice 2: the contact solve waited behind display frames

**Diagnosis.**
- After slice 1, a step took about 63 ms in-burst. The GPU was busy 13 ms of
  it.
- The lane's worker thread was idle 77% of the time, and no process was
  saturated.
- The CPU trace showed where the idle ended: in
  `encodeApplyBatches` → `requestResidentPresentationSubmissionGap`. Between
  Jacobi batches, the contact solve offers the presenter a "retained
  submission gap" and awaits it.
- The gap queues on the render lane behind frames that hold the lane through
  GPU completion and rAF. With `waitForPendingSlot` on the final batch, it
  also waits for a predecessor's full proof. Each gap can take up to 16.7 ms,
  about 44 ms per step in total.
- This contradicts the ss-regression acceptance criterion: "Physics cadence is
  not gated by RAF or by completion of the preceding visible presentation".

**Fix.** In `src/services/workerOwnedIsosurfacePresenter.js`, physics is
offered a gap only while the render lane is idle. It may wait for a busy lane
only when presentation is starving, meaning no lane frame has completed for
`RETAINED_GAP_STARVATION_MS` (1000/30).

**Result**, 60 s windows, presented frames counted from the worker's frame
counter:

| Gap policy | Steps/s | Presented frames/s |
|---|---|---|
| old (always may wait) | 11.7 | 46.3 |
| hybrid, 1/30 s (default) | **19.5** | 38.6 |
| idle lane only | 19.5 | 39.1 |

**Test:** `tests/workerOwnedIsosurfacePresenter.test.mjs`, "A1: physics is
offered a gap behind a busy render lane only when presentation is starving".

The host suite gives 5,861 pass, 0 fail, 96 skipped.

## Slice 3: direct launches for the grid-update sequence's field consumers

**What runs directly now.** The mechanics-field grid-update sequence used to
issue about 24 `dispatchWorkgroupsIndirect` calls per step: grid update,
phase-volume transport and the surface-stress stages. They are now direct 1D
launches.

**How it stays exact.** The sequence's kernels share one 256-byte params
uniform.
- In the same encoder, the host copies the field view's staged consumer
  dispatch (words 60..62) into params bytes 240..251, and writes
  `SCHROEDER_SPATIAL_FIELD_CONSUMER_DIRECT_DISPATCH_MAGIC` at byte 252.
- Each consumer entry's first statement is
  `if (direct_dispatch_excludes(workgroup_id)) { return; }`.
  - It admits only workgroups with x < snap_x·snap_y, y = z = 0 and snap_z ≠ 0.
  - That is exactly the set the staged indirect launch ran.
  - The guard is inert without the magic, so indirect launches and existing
    fixtures are unchanged.
- Direct launches are used only when ceil(field capacity / 64) fits the
  dispatch-x limit, where the field view never folds into 2D:
  `consumerDispatchMaxLinearGroups`.
- `__ulgForceIndirectFieldConsumers` (a worker global) forces the old path for
  A/B runs.

**Evidence:**
- All three WGSL modules compile on native Vulkan.
- `scripts/a1-ab-check.mjs` pauses the live route at a batch boundary and
  hashes every rigid-lane frame float. Four runs at step 336 (direct, direct,
  forced-indirect, forced-indirect) give the identical hash `2b70c8d4`, so
  same-mode runs are deterministic and direct equals indirect bit for bit.
- Indirect dispatches dropped from about 51 to 27.4 per step.
- Tests:
  - `tests/a1FieldConsumerDirectDispatch.test.mjs` checks the guard-first
    contract, the snapshot layout and the capacity rule;
  - the `tests/sphGridGpuKernel.test.mjs` lifecycle assertion now expects
    direct launches.

**Rate.** 60 s windows: 19.5 → 20.0 steps/s, about 40 presented frames/s.
That is within noise, because the lane was not GPU-process-bound at this
point.

## Measured per-step lane timing, and a reverted trial

**Instrument.** `globalThis.__ulgLaneStepTiming` is a worker diagnostic ring
of the last 128 steps (start, step, epoch, mechanics, yield wait). It is read
by `scripts/a1-hold-census.mjs`. The census also records the page-side
`workerLanePageTiming` phases per schedule.

**Step cost.** A step's own work is 6–8 ms: epoch about 0.8 ms, mechanics
about 6 ms.

**Where the rest went:**
- **About 27 ms per step** in some batches came from the canonical lane
  awaiting `presentCanonicalSubmissionBoundary`, a full GPU and rAF frame
  proof after every step.
- **90–160 ms per batch** at the batch start.
- **55–90 ms** at the lagged queue-drain checkpoints.

**Trial (reverted).** Only present at a canonical boundary when presentation
is starving.

| Window | Steps/s | Frames/s |
|---|---|---|
| 60 s, run 1 | 22.1 | 14 |
| 60 s, run 2 | 25.9 | 16 |
| 20 s, early in the run | 40.8 | 31 |

The lane then outruns the GPU process: drain checkpoints wait, and presenter
frames queue behind physics. Losing display rate (40 → 15 frames/s) for
+10–30% physics was not worth it, so the trial was reverted.

**Conclusion.** The shared limit is the GPU process, which serves physics and
presentation alike. Reducing per-step GPU-process work helps both. Next:
- the remaining about 27 indirect dispatches per step: staged P2G 5, thermal
  5, field view v2 4, phase-volume moment and receipt 5, gas EOS 3, epoch v2
  2;
- then fusing work, with fewer passes per step.

## Where the time goes now (19.5 steps/s, about 51 ms per step)

- **The GPU process is the limit:** 64.7% of one core, about 33 ms per step.
  The renderer process is at 46%.
  - About 55 `dispatchWorkgroupsIndirect` calls per step.
  - Each costs about 0.30 ms of GPU-process validation on Chrome 157. This was
    re-measured: 180 indirect dispatches take 54.9 ms per step, against 1 ms
    direct.
  - That makes about 16 ms per step.
  - The sites: grid-update mechanics-field sequence (11), surface stress (12+),
    thermal (5), spatial epoch v2 (2), field view (5), phase volume (5), gas
    EOS (3) and staged P2G (5).
- **Converting them to direct ceiling launches must stay exact.** Several
  sequences stage the indirect arguments once (a snapshot) while kernels zero
  the live words on reject: `sphMlsMpmGpuStep.js:9144` and the phase-volume
  transport at `:431`.
  - A guard on the live words therefore changes fail-closed receipts. One
    example is `initialize_surface_stress`'s `reject_scratch()`.
  - An exact conversion needs the snapshot in a binding the kernels already
    read, such as the params uniform.
  - This is the next A1 slice. The August radix conversion is the precedent:
    [[ulg-indirect-dispatch-cost]].
- **GPU time is 13.3 ms per step:**
  - contact graph solve 4.4 ms;
  - cleanup owner 1.7 ms;
  - render field 1.0 ms;
  - everything else under 0.7 ms each.

## Slice 4: the canonical presentation boundary held every step (2026-11-15)

**Measured at dt 0.5 ms** (Iron Ice, 1 atm, after the steam fixes).
- GPU queue time is about 16 ms per step, but the wall time was about 50 ms.
- The worker CPU profile (`S0_CPU_PROFILE=12`) showed the worker idle 64% of
  the time. The page was idle 84% (`S0_CPU_PROFILE_WORKER=page`).
- The submit timeline (`S0_TIMELINE=1`) showed one 16–128 ms gap per step,
  15.3 s of a 20 s window.

**Cause.** After every step the canonical lane awaited
`presentCanonicalSubmissionBoundary(stepOrdinal)`:
- render the last committed mesh;
- prove the frame's GPU completion covers the step's physics;
- wait for a presentation opportunity.

That serialized CPU encode, GPU physics, the render and vsync for every step.

**Fix** (`src/services/ulgMechanicsResidentStage.worker.js`):
- **Non-blocking boundary.** A boundary starts only when none is in flight.
  Otherwise it is skipped and counted in `skippedInFlightCount`, and physics
  keeps encoding. The last boundary completes before the schedule terminal.
- **Queue pacing.** Before encoding step k+1, the lane waits for step k−1's
  GPU completion, so presentation renders are not queued behind a whole
  schedule's backlog.

**Results** (24 s windows):

| route | steps/s | presented frames/s | new physics states/s |
|---|---|---|---|
| blocking (before) | 20 | 38 | 1.2 |
| non-blocking, unpaced | 44 | 22 | 2.8 |
| **paced (kept)** | **41** | **29** | **2.7** |
| paced + `residentStepsPerSchedule=64` (opt-in) | 59 | 10 | 1.0 |

- **3 s validation:** 0 of 5,690 steps rolled back (`observeSpatialAuthority=1`),
  and the steam still rises to y 137 mm.
- **Test.** The worker presentation test now encodes the contract: at most
  one boundary outstanding, step order, and boundaries plus in-flight skips
  covering every non-final step.
- **Ruled out:**
  - opening the submit burst for Iron Ice: per-step fence requests (37.6
    per step) force flushes, so there was no gain;
  - longer default schedules: the presentation cost is the user's call.

**Where the time goes now.**
- The lane is GPU-bound at about 16 ms per step plus presentation renders.
- Largest items: G2P plus the contact solve, about 7.9 ms (Jacobi 4.1); the
  gas-pressure EOS producer 3.5 ms; P2G 1.8 ms.
- There are about 454 dispatches and 27 indirect dispatches per step.
- About 30 buffers are created per step, roughly 25 labels rebuilt every step
  (law queue, aggregate, migration, split-merge, thermal outputs and params,
  G2P outputs, gas-boundary scratch). Pooling them per lane is cheap work.
- The schedule boundary is about 120 ms per 16 steps, mostly the terminal
  fence draining queued GPU work.

## Slice 5: worker memory growth (2026-11-15)

**Measured** on Iron Ice at dt 0.5 ms and 1 atm, with heap snapshots of the
render worker 30 s apart (`S0_CPU_PROFILE=1 S0_HEAP_SNAPSHOTS=30`). The heap
grew 145 MB per 30 s, about 0.2 MB per step. A retainer search that follows
WeakMap ephemeron edges (value kept alive by key) found two causes:

- **Per-call `device.lost.then(...)`.** About 6 reactions were added per step
  (grid, G2P, P2G, grid update, mechanics, optics, dispersed medium, source
  family, thermal proposals). A healthy device's loss promise never settles,
  so every reaction, and everything it captured, lived as long as the device.
  - **Fix:** `src/runtime/sph/sphDeviceLossRelay.js` adds one reaction per
    device with weak per-step loss states (`watchSphDeviceLoss`,
    `watchSphDeviceLossFor`).
  - The thermal proposals keep strong ownership of live leases through a
    per-device holder set; a successful retirement removes its holder.
  - The observable notification sequence is kept, including the
    throw-forwarding call. One difference: an already-settled loss now always
    stops the stage before its runner.
- **Generation lineage chain.** `spatialEpochGenerationLineages` held each
  generation's level assignment strongly. That assignment's admission record
  reaches the previous step's uploads, their source family, its generation,
  and so on back to the first step.
  - **Fix:** a WeakRef plus the assignment buffers recorded at publication.
    No validation changed.

**Results:**
- Heap growth over 30 s fell from +145 MB to +4 MB, mostly code objects.
- A 5-minute headless soak at 47.9 steps/s: renderer RSS is flat at
  1.25–1.3 GB from 2 min on (it used to grow about 15 MB/s, reaching 4.8 GB in
  5 min). The GPU process creeps about 0.2 MB/s.
- The host suite passes (5,869 pass, 0 fail).

## Slice 6: exact direct launches for the indirect consumers (2026-11-15)

**What limits the step.**
- **Benchmark** (`api-cost-bench.mjs` in the session scratchpad), Chrome 157:
  - one `dispatchWorkgroupsIndirect` costs about 290 µs round trip, against about 6 µs for a direct dispatch;
  - with `--enable-dawn-features=skip_validation` it costs 8.5 µs, so the cost is Dawn's indirect validation;
  - `createBuffer` costs about 5 µs, `createBindGroup` about 6 µs, `writeBuffer` about 3 µs, and a submit 30–75 µs.
- **Per step:** 474 dispatches, 28 indirect, 83 bind groups, 45 created buffers, 95 writes and 21 submits.
- **Thread load:** the trace shows the GPU-process main thread 45% busy, mostly `HandleDawnCommands` plus `Queue::Submit`. No thread is saturated, so the step is latency-bound.
- **GPU:** the new per-pass census (`S0_PASS_CENSUS=1`, `src/runtime/sph/sphPassTimestampCensus.js`) shows only about 9–10 ms of real GPU work per step.
  - Of that, about 5 ms is the contact Jacobi solve and about 1.2 ms is 19 unlabelled P2G passes.
  - The 3 ms "gas EOS" queue bracket was host idle time, not GPU time.

**Pattern.**
- The host launches a direct 1D ceiling (from capacity, at most the device's `maxComputeWorkgroupsPerDimension`).
- Each kernel computes its linear group from `num_workgroups`. It admits the group only if the indirect launch would have run it: Z ≠ 0 and the group is below X·Y of the GPU-authored arguments.
- Excluded groups return before any side effect. Barrier-uniform reductions instead get an index past every bound.
- Under the old indirect launch the kernels behave exactly as before, so `__ulgForceIndirectFieldConsumers` A/Bs both launches.

**Converted (14 per step):**
- gas-ledger EOS aggregate and gradient (staged words in the control buffer), and the gas free-volume build (directory words 42–44);
- phase-volume moment emit, ranges and reduce;
- phase-volume receipt sources and fields;
- epoch V2 key emission;
- thermal prepass and law entries (derive, resolve_budget, physical-topology preflight, budget, propose). Their launch-shape checks now also admit a covering direct launch; a too-small ceiling still fails closed;
- mechanics-field V2 emit, stencil map and assemble keys;
- mechanics-view V2 mark.

**Results** (Iron Ice, dt 0.5 ms, 1 atm):
- Indirect dispatches per step went from 28 to about 14.
- **Exactness:** `scripts/a1-ab-check.mjs` now fingerprints fluid state, thermo and rigid frames at a fixed step, copied in queue order. The hashes are identical, direct against forced indirect, at step 300 and at step 1,000.
- **Throughput:** measured over a fixed simulated interval (steps 208→1,200) so both modes cover the same scene phase. Forced indirect runs at 31.4–32.3 steps/s and direct at 33.9–37.0, about +9% to +18%.
- **Measurement trap:** a fixed wall-clock window starting 10 s after stepping is biased. A faster configuration measures a later and slower scene phase, which compresses or inverts differences. The one-off `skip_validation` reading of 55.9 steps/s was such an artifact; a later re-run gave 32.4.

**Still indirect (about 14 per step):**
- P2G's staged validation, field clear, scatter and finalize (5). These need the staged argument snapshots bound, because validation zeroes the live words mid-sequence.
- the contact graph solve (2);
- the epoch V2 assemble (1), whose kernel does not bind the view; it needs a params snapshot;
- the mechanics-field radix GpuCount (1);
- the native surface temperature rows (about 0.4).

## Still open in A1

- The indirect→direct conversion: GPU-process time.
- Per-step JS on the lane, about 19 ms. Contributors include
  `createBindGroup`, schedule-authority fingerprints (sha256) and optics row
  validation.
- Fusion and K steps per submit (the audit's A′ step 3) for the canonical
  route.
- The all-preset real-time measurement, and the ≥100k quiescent carriers check
  (bulk-water Tier-0 was at 104k live).
- **Near-real-time Iron Ice** at dt 0.5 ms means 2,000 steps/s. Today it runs
  19.5 steps/s at dt 1 ms, about 0.02 simulated seconds per wall second.

## Reported by the user, 2026-11-14: z-buffer is broken

The user saw broken depth ("the z buffer is all fucked up") in the live demo
and asked to fix it later.
- **To do first:** reproduce it from several camera angles on the Iron Ice
  preset.
- **Then rule out today's changes** before treating it as pre-existing:
  - the retained-gap policy in `workerOwnedIsosurfacePresenter.js`;
  - the worker-bridge proof in `sphPhaseDemoMount.js`.

  Neither touches depth state, but frames now interleave differently with
  physics submissions.

**User screenshot (21:17, rigid ice route).** The rigid ice block's top face
is drawn over the molten iron isosurface that rests on and in it.
- **Hypothesis:** the solid-body mesh and the fluid isosurface don't share
  one depth buffer, or the solid is drawn in a later pass without a depth
  test against the fluid.
- **First check:** the worker presenter's pass order and depth attachments
  for the solid mesh against the isosurface opaque pass. The G3/A5 solid
  rendering added that mesh.

## Reported by the user, 2026-11-14: about 2 Hz surface discontinuity

The user describes it as "like some kind of surface geometry or volume
update".

**Probable cause.**
- The presenter re-extracts the isosurface from each new physics batch, a
  16-step schedule.
- Between batches it only extrapolates the last surface along a motion field.
- So every new source snaps the surface: geometry, volume and topology can
  jump.
- After the A1 speedups, batches land about 2 times per second (they used to
  land about every 2.5 s), so the pops are now about 2 Hz and visible.

**Fix direction.** Interpolate between consecutive committed sources: present
one batch behind, blending the previous extraction into the new one, instead
of extrapolate-then-snap.
- Cheaper partial options: smaller batches, or a short cross-fade at the
  snap.
- Measure visually and with the distinct-frame probe.

## Schedule-boundary overhead (in progress, paused 2026-11-17 for a driver update)

- Iron Ice (vacuum) is GPU- or submission-bound at about 40 steps/s
  unaudited.
  - The contact cleanup budget barely matters: 512 gives 39.6 and 128
    gives 37.4.
  - The per-step contact audit is itself the 3× slowdown seen in audited
    runs.
  - `residentGpuTimestampProfile=1`: the matching-cleanup owner takes 23.7
    ms of GPU per step under profiling.
- 64-step schedules ran at 59 steps/s (earlier), which puts about 130 ms
  per 16-step schedule at the boundary.
- **Probe `S0_RESIDENT_PERF=1`** (new): page-side timings per schedule.
  Under a 50% CPU quota, compute has a median of 1373 ms per schedule and
  post-compute (page work after the compute resolves, before the next
  schedule is requested) a median of 98 ms (p90 169). The next schedule
  is then issued only on the following `requestAnimationFrame`
  (`sphPhaseDemoMount.js` ~15710).
- **Next:**
  - profile the page main thread over that post-compute window
    (`S0_CPU_PROFILE_WORKER=page`, `S0_CPU_PROFILE_DELAY`);
  - then issue the next schedule before UI-only work (renderStatus,
    banners), if the authority chain allows it.
- **GPU budget** (user 2026-11-17): every probe runs through the scratchpad
  `gpuprobe.sh` (CPUQuota 50%, `nvidia-smi` logged), with cooldowns between
  runs.
