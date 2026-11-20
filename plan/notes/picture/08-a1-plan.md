# Digest H: the A1 plan of record (`plan/todo/a1-realtime-substrate.md`, read in full, 399 lines)

Figures are Claude's. Slices 1-3 were measured on the rigid-ice plume route (`seq-plume3` bodies, iron at 1,850 K, `sdt=0.001`, 1,888 rows, Chrome 157). Slice 4 onward on Iron Ice at dt 0.5 ms.

## Delivered
| Slice | What | Result | Gate / test |
|---|---|---|---|
| 1 | Worker-bridge presentation proof (`sphPhaseDemoMount.js`): the post-step hold never passed on the worker route, so every batch waited the 1,250 ms timeout | 6.0 -> 12.0 steps/s; gate active 49.7% -> 0.4% of wall time | `tests/sphPhaseDemoMountRemoteRefresh.test.mjs` ("A1: worker-owned presented canvas") |
| 2 | Contact-solve retained submission gap only while the render lane is idle, unless presentation is starving (`workerOwnedIsosurfacePresenter.js`, `RETAINED_GAP_STARVATION_MS` = 1000/30) | 11.7 -> 19.5 steps/s; presented frames 46.3 -> 38.6/s | `tests/workerOwnedIsosurfacePresenter.test.mjs` |
| 3 | Direct launches for the grid-update field consumers (snapshot in params bytes 240..251, magic at 252, `direct_dispatch_excludes` first statement) | indirect 51 -> 27.4 per step; rate within noise (19.5 -> 20.0) | `tests/a1FieldConsumerDirectDispatch.test.mjs`; hash `2b70c8d4` at step 336 in 4 runs |
| 4 | Canonical presentation boundary non-blocking + queue pacing (`ulgMechanicsResidentStage.worker.js`) | 20 -> 41 steps/s; presented frames 38 -> 29/s; new physics states 1.2 -> 2.7/s. 3 s validation: 0 of 5,690 steps rolled back with `observeSpatialAuthority=1`; steam still rises to y 137 mm | worker presentation test (at most one boundary outstanding) |
| 5 | Worker memory growth (device-loss reactions, generation lineage chain) | heap +145 MB -> +4 MB per 30 s; 5-min soak renderer RSS flat at 1.25-1.3 GB | host suite 5,869 pass |
| 6 | 14 more indirect sites converted to exact direct launches | indirect 28 -> ~14 per step; fixed-simulated-interval A/B (steps 208 -> 1,200): forced indirect 31.4-32.3, direct 33.9-37.0 steps/s (+9% to +18%) | `scripts/a1-ab-check.mjs` hashes identical at step 300 and 1,000 |

Rejected or parked along the way:
- Present at a canonical boundary only when starving: 22-26 steps/s but 14-16 frames/s. Reverted.
- Opening the submit burst for Iron Ice: fence requests (37.6 per step) force flushes. No gain.
- Longer default schedules (`residentStepsPerSchedule=64`: 59 steps/s, 10 frames/s): the presentation cost is the user's call.

## Where a step's time goes (slice 6 measurements, Iron Ice dt 0.5 ms, 1 atm)
- Per step: 474 dispatches, 28 indirect (now ~14), 83 bind groups, 45 created buffers, 95 writes, 21 submits.
- Real GPU work is only ~9-10 ms per step (`S0_PASS_CENSUS=1`, `src/runtime/sph/sphPassTimestampCensus.js`): contact Jacobi ~5 ms, 19 unlabelled P2G passes ~1.2 ms. The 3 ms "gas EOS" queue bracket was host idle time.
- GPU-process main thread 45% busy (`HandleDawnCommands`, `Queue::Submit`). No thread is saturated: the step is latency-bound.
- API costs on Chrome 157: indirect dispatch ~290 us (8.5 us with `skip_validation`), direct ~6 us, createBuffer ~5, createBindGroup ~6, writeBuffer ~3, submit 30-75.
- ~30 buffers created per step under ~25 labels (law queue, aggregate, migration, split-merge, thermal outputs and params, G2P outputs, gas-boundary scratch). Pooling them per lane is cheap work.
- The schedule boundary is ~120-130 ms per 16 steps (terminal fence draining queued GPU work, plus page work).

## "Still open in A1" (the plan's own list)
1. Indirect -> direct conversion of the remaining ~14 per step: P2G staged validation, field clear, scatter, finalize (5; need the staged argument snapshots bound, because validation zeroes the live words mid-sequence); contact graph solve (2); epoch V2 assemble (1; needs a params snapshot); mechanics-field radix GpuCount (1); native surface temperature rows (~0.4).
2. Per-step JS on the lane, ~19 ms: `createBindGroup`, schedule-authority fingerprints (sha256), optics row validation.
3. Fusion and K steps per submit (the audit's A' step 3) for the canonical route.
4. The all-preset real-time measurement, and the >= 100k quiescent carriers check (bulk-water Tier-0 was at 104k live).
5. Near-real-time Iron Ice at dt 0.5 ms = 2,000 steps/s.

## User-reported defects parked in this doc (2026-11-14)
- "the z buffer is all fucked up": the rigid ice block's top face is drawn over the molten iron isosurface resting on and in it. User asked to fix it later. Hypothesis: the solid-body mesh and the fluid isosurface do not share one depth buffer, or the solid is drawn in a later pass without a depth test. First check: the worker presenter's pass order and depth attachments for the solid mesh (added by G3/A5).
- ~2 Hz surface discontinuity ("like some kind of surface geometry or volume update"). Probable cause: the presenter re-extracts the isosurface per 16-step batch and only extrapolates between batches, so each new source snaps. Fix direction: interpolate between consecutive committed sources (present one batch behind). Cheaper: smaller batches or a short cross-fade.

## THE STOP POINT: "Schedule-boundary overhead (in progress, paused 2026-11-17 for a driver update)"
- Iron Ice (vacuum) is GPU- or submission-bound at ~40 steps/s UNAUDITED.
  - Contact cleanup budget barely matters: 512 gives 39.6, 128 gives 37.4.
  - The per-step contact audit is itself the 3x slowdown seen in audited runs.
  - With `residentGpuTimestampProfile=1` the matching-cleanup owner takes 23.7 ms of GPU per step (under profiling).
- 64-step schedules ran at 59 steps/s, which puts ~130 ms per 16-step schedule at the boundary.
- New probe option `S0_RESIDENT_PERF=1`: page-side timings per schedule. Under a 50% CPU quota: compute median 1373 ms per schedule; post-compute (page work after the compute resolves, before the next schedule is requested) median 98 ms, p90 169.
- The next schedule is issued only on the following `requestAnimationFrame` (`sphPhaseDemoMount.js` ~15710).
- NEXT (as written by Claude):
  1. profile the page main thread over that post-compute window (`S0_CPU_PROFILE_WORKER=page`, `S0_CPU_PROFILE_DELAY`);
  2. then issue the next schedule before UI-only work (renderStatus, banners), if the authority chain allows it.
- GPU budget line: every probe through the scratchpad `gpuprobe.sh` (CPUQuota 50%, `nvidia-smi` logged), with cooldowns.

## Tension Hermes must resolve before quoting a rate
- `ulg-submit-completion-readback` (2026-11-16) says the true Iron Ice rate is ~19 steps/s at 0.5 ms and that 42-49 figures are invalid.
- This plan's 2026-11-17 section says ~40 steps/s unaudited, and that the per-step contact audit is a 3x slowdown.
- Slice 4's 41 steps/s had a rollback check in a separate 3 s validation run.
- Reading: 19 may be the audited rate and ~40 the unaudited one. Not confirmed. Check the transcript tail before quoting either.

## Comparison with Hermes's own throttled run (2026-11-17, after the driver update)
- Hermes: compute median 2969 ms per schedule, post median 200 ms, 4.34 steps/s, with `S0_CPU_PROFILE` on, boot quota 400% then 50%, driver 615.71.09, no authority observation.
- Claude under "50% quota": compute median 1373 ms, post median 98 ms.
- Roughly 2x slower on both. Not explained. Candidates not yet examined: the CPU profiler's overhead, a different quota scope in Claude's wrapper, the driver update, the slow first ~100 s.
