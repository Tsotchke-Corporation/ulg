# Digest C: A1 real-time substrate, from Claude's memory notes

Sources: `ulg-realtime-gap-iron-ice`, `ulg-a1-presentation-coupling`, `ulg-a1-presentation-boundary`, `ulg-submit-completion-readback`, `ulg-full-review-20261027`. Figures are Claude's. The record of A1 work is `plan/todo/a1-realtime-substrate.md`.

## The requirement
- User, 2026-10-27: plumes "should run near realtime". At dt 0.5 ms that is 2,000 steps/s. Moved from G2 into A1 on 2026-11-13.
- No plan defines an agreed steps/s target or which laws count. That is an open user decision.

## Baseline (2026-10-27, non-air f32 Iron Ice, 6,784 rows)
- 6.4 steps/s (~159 ms/step). One 16-step batch = 2.55 s: ~1.1 s of steps then ~1.35 s idle (53% idle) in the post-step presentation-proof hold (`residentPostStepPresentationGate`, `tick()` in `sphPhaseDemoMount.js`).
- GPU ~60 ms/step: `contact-graph-solve` ~26 ms; `matching-cleanup-global-owner` 17.7 ms; rest < 3 ms per pass; render field 49 ms once per batch.
- API census per step: 108 compute passes, 405 dispatches (54 indirect), 32 submits, 235 writeBuffer, ~10 onSubmittedWorkDone waits.
- Ceiling of this route even with no hold and a free contact solver: ~28 ms/step, about 35 steps/s.
- Plausibility that real time is reachable: the Phase 0 six-pass step took 89 us at the same capacity; Tier0 bulk water ran 1,100-1,260 steps/s at 33-37k particles.
- Step 0 (2026-11-13, `scripts/step0-baseline-probe.mjs`): 714/714 traced steps admitted (no rollbacks). Unprofiled 5.86-6.09 steps/s at dt 0.5 ms. Census 30.5 submits, 106 passes, 397 dispatches (52 indirect), 222 writeBuffer, 9 workDone waits.
- Iron Ice runs the interactive contact default (16 Jacobi rounds, 512 cleanup passes; comment at `sphPhaseDemoMount.js:7725`). Sodium's preset sets 48 passes, inner rounds 2.

## What the plans already prescribe (found in the 10-27 plan review)
- Tier 0 shape: <= 10 passes, 1-2 submits, K steps per submit, inside the canonical lane (`scale-adaptive-law-activation-plan.md:136-162, 612-622`).
- Resident sidecar fusion; remove per-step fences that cross no authority boundary (`sol-critic.md:222-229, 884-893`).
- Contact predicates (`selective-contact-law-application-plan.md:50-90`); Iron Ice cleanup ran on 727 of 768 steps of a settled scene.
- A law descriptor (`ss-law-architecture-assessment.md:150-169`).
- Rules any route must obey: no second scheduler, no per-preset branch, no law pruning, one producer per state family.
- `ss-regression.md` caps milestone runs at 10 minutes. `ss-regression.md:244` accepted "Physics cadence is not gated by RAF or by completion of the preceding visible presentation". The hold was a regression (added 09-04 for G1, `plan/log.md:44779`).

## The full review (2026-10-27; evidence `~/.cache/icc/repos/ulg/full-review-20261027/`; write-up `plan/todo/2026-11-03audit.md`)
Plan-changing facts Claude verified in source:
- Step 0: the baseline was not trustworthy without rollback data; profiling changes the executed route (timestamps disable contact presentation gaps, fence-free cleanup, proxy submit fusion; add fences; the contact profiler has 48 slots).
- Decoupling means ~8 couplings, not 2: the mount gate polls once per rAF (`sphPhaseDemoMount.js:9464`); the worker waits for a frame proof after every canonical step (`ulgMechanicsResidentStage.worker.js:13393-13411`); the contact solve pauses every 4 Jacobi rounds for `present()`; the page draw-idle fence before every schedule (`sphPhaseScene.js:38354`); commit-then-await presentation (`sphPhaseScene.js:54369`).
- G1 receipts require presented steps == physics steps. Redefining them is the user's decision.
- Contact on Iron Ice gets overlapping responses: grid multi-field inelastic `contact_fields` (`sphMlsMpmGpuStep.js:9548-9690`), a pair-graph `barrier_dv`, and a pressure-interface penalty. The 512-pass budget is below the ~890-pass worst case. Contact is forced on by any other law (`schroederTargetScheduleAuthority.js:725-741`).
- The canonical lane runs one step per call by contract; it throws otherwise (`sphMlsMpmGpuStep.js:41384-41393`). Per-step "submitted" authority flags exist in ~13 modules. Two reverted fence-coalescing attempts are recorded in `plan/done/ss-spatial-authority-refactor-merge-readiness.md:1297`.
- Decisions the user still had to make then: revised A' vs B; G1 receipt redefinition; the contact experiment and budget; staged gates, which laws count, and dt.
- How to apply: check `synthesis.md` before proposing real-time work; ICC `trace_callers` gave many false zeros in this repo (confirm with grep); a tracked `ulgMechanicsResidentStage.worker.js.orig` duplicates the worker's symbols.

## A1 slices delivered (2026-11-14/15)
1. Slice 1: missing worker-bridge proof. `resolveSphResidentPresentationProof` had no `worker-owned-presented-canvas` case, so every batch waited the 1,250 ms proof timeout. Receipt-based proof: 6 -> 12 steps/s.
2. Slice 2: contact-solve retained submission gaps queued behind rAF frames (`requestResidentPresentationSubmissionGap` in `sphG2pGpuKernel.js`). Now a gap is offered only while the lane is idle unless presentation is starving (`RETAINED_GAP_STARVATION_MS` = 1000/30, `workerOwnedIsosurfacePresenter.js`). 12 -> 19.5 steps/s; presented frames 46 -> 39/s.
3. Slice 3: direct launches for the grid-update field consumers (snapshot copy into params bytes 240..251, magic at 252, first-line guard). Bit-exact (rigid-frame hash `2b70c8d4` at step 336 in 4 runs, `scripts/a1-ab-check.mjs`). Indirect dispatches 51 -> 27 per step. No sustained rate gain.
4. Slice 4: `presentCanonicalSubmissionBoundary` is no longer awaited per step (`ulgMechanicsResidentStage.worker.js`): it starts only when none is in flight (else counted in `skippedInFlightCount`); before encoding step k+1 the lane awaits step k-1's queue fence; the last boundary settles before the terminal. Claimed 20 -> 41 steps/s, presented frames 38 -> 29/s. CHECK against the correction below.
   - Opt-in `residentStepsPerSchedule=64`: 59 steps/s but 10 presented frames/s. That trade is the user's call.
   - Gating boundary frames to starvation-only: tried, reverted (physics 22-26 steps/s, presented frames 40 -> 15/s). Changing the boundary-proof contract (shared with Tier-0 QoS) is a user trade-off decision.
   - Opening the submit burst for Iron Ice did not work: fence requests (37.6 per step) force flushes.
5. Slice 5: memory leak fix. Slice 6: indirect-dispatch conversions (see digest A).

## THE CORRECTION (ulg-submit-completion-readback, 2026-11-16)
- A per-command-buffer copy + mapAsync wrapper installed above the worker submit burst (`armWorkerQueueSubmitBurst`, `webgpuComputeLayout.js`), and the pass census installed the same way, mapped buffers of held command buffers. The burst flush then failed validation ("used in submit while mapped") and 1,151 of 1,152 steps rolled back. That read as a 2.2-2.7x speedup.
- Claude had made the readback the default on that false evidence; it was reverted and the user was told. The census now hooks `wrapWorkerQueueRealSubmit(device, wrap)`, below the burst.
- THE TRUE IRON ICE RATE IS ABOUT 19 steps/s AT dt 0.5 ms (0.0095 sim-s/s, ~105x from real time). The 42-49 steps/s census-regime figures and the "48 steps/s headless" are INVALID.
- Rules: never trust a rate from a run not checked for rollbacks (`&observeSpatialAuthority=1`, rolledBack == 0, and grep the log's `gpuErrors`). Frame-distinctness is not evidence of live physics (the presentation extrapolates motion).

## Where the time goes after slice 4 (Claude's last attribution in these notes)
- A step's own work is 6-8 ms. Early in a run the lane reaches 40-44 steps/s with the GPU process 52% busy; later (contact and melt) it falls to ~20.
- The lane is GPU-bound at ~16 ms/step: G2P plus contact ~7.9 ms, gas EOS producer 3.5 ms, P2G 1.8 ms. About 30 per-step buffer creations to pool.
- The GPU process: ~55 indirect dispatches/step at ~0.30 ms each.

## Instruments
- `__ulgLaneStepTiming` (worker ring: per-step epoch, mechanics, yield times); `workerLanePageTiming` per schedule; `scripts/a1-hold-census.mjs` (count presented frames via `renderState.workerOffscreenPresentationFrameCount`; the HUD's "presented N states/s" is instantaneous and misleading); `scripts/a1-gpu-process-trace.mjs`; `scripts/a1-ab-check.mjs`; `scripts/realtime-gap-probe.mjs`.
- Probe options: `S0_TIMELINE=1` (per-submit gap histogram), `S0_CPU_PROFILE=<s>` (+ `S0_CPU_PROFILE_WORKER=page` for the main thread), `S0_ATTRIBUTION=1` (createBuffer labels; fence, mapAsync, submit call sites).
- `stageMs` for g2pReconstruction includes awaited gaps.

## Note for Hermes's own 2026-11-17 throttled run
- It reported `authority.traced = 0`: it was run without `&observeSpatialAuthority=1`, so its 4.34 steps/s was never checked for rollbacks. By the rule above it is not evidence of anything except that the app stepped.
