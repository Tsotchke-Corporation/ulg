# Moved-set incremental expansion — design capture (2026-08-27)

Status: IMPLEMENTED as ba55498 (2026-08-27). Bit-identical cleanup profile on sodium-water; iron-ice clean; 17.5s -> 13-14s per 64-step schedule. The workgroupUniformLoad-in-conditional hazard is documented in the commit. Standard-matrix validation still required before merge to main. This is the next cut at the matching-cleanup
owner after commit 70e077a (frontier-list compaction, physics-identical,
throughput-neutral at N=1216).

## Measured motivation

Per-pass cost ~0.45 ms at N=1216 is dominated by the expansion phase
re-evaluating every dormant (not-ever-active) cursor of every frontier member
every logical pass: ~500 frontier members x ~30 dormant cursors ≈ 15k
`mechanical_matching_constraint_pair` evaluations/pass on one workgroup.
Removing the other 8 full-N scans (70e077a) changed nothing at this N, which
pins the attribution. ~260 active passes/step ⇒ ~120 ms/step here.

## Design

- Sound skip rule (from the code's own monotone-frontier comment at
  schroederSpatialMechanicalProposalsGpu.js ~:16264): a dormant pair's
  activity decision has bit-identical inputs unless an endpoint's state
  changed. So expansion pass P only needs to scan the cursor rows of
  particles whose state changed in pass P-1 ("movers"), plus a full scan on
  the first pass of each chunked dispatch (workgroup memory is per-dispatch).
- Movers recorded by the writers: apply (all group members whose
  compare-on-write shows a changed state word) and wall projection (self,
  when projection changed position/velocity). Double-buffered workgroup
  lists (2 x 1024 u32 ≈ 8 KB; +4 KB existing frontier list; within the 16 KB
  default workgroup storage). Overflow ⇒ set a flag that forces the next
  pass to full expansion (fail-safe, never fail-closed).
- One direction of a pair suffices for admission (admission flags both
  endpoints, as today). csr ever-active bits may diverge from today on the
  never-scanned direction — internal transient state, not part of any
  published receipt; document in the change.

## Why this is NOT byte-identical (validation plan required)

Today's expansion can cascade within one pass: a peer admitted mid-scan gets
its row scanned later in the same pass if its index comes later in the fixed
lane-strided order — a scan-position-dependent (but deterministic) cascade.
Moved-set expansion evaluates an admitted-but-unmoved peer's row only after
it first moves, shifting some admissions one pass later. Same admission SET,
different pass timing ⇒ different f32 application order ⇒ evidence words and
low state bits can differ. Validation must therefore be the physics-
equivalence train, not the profile bit-match:

1. `npm run test:physics-atomics` + proposals/pair-graph/ABI suites.
2. Same-device A/B at fixed step count: retained compact snapshot
   (`exportWorkerOffscreenRetainedCompactSnapshot`) old vs new; positions/
   velocities within tolerances derived from the cleanup's own
   `SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S` and
   position trust bounds.
3. Cleanup profile old vs new: appliedPairTotal equal; per-bucket applied
   counts may shift by bounded amounts; converged tail must still latch;
   residual trajectories within tolerance.
4. Standard visual sanity arms for sodium-water + iron-ice (the two
   contact-heavy presets) before merging to main.

## Expected effect

Expansion evals/pass drop from ~15k to ~(movers x degree) ≈ 0.5-2k typical,
plus 16 full scans/step (dispatch starts). If expansion is ~80% of the pass,
cleanup ~120 ms → ~30-45 ms/step at N=1216, i.e. step ~260 → ~170-185 ms.
Combine with Jacobi adaptivity and the ~55 ms residual work for the next
factor.

## Selection-slim attempt (2026-08-27, REVERTED — analysis capture)

Attempted: SELECTION_PENDING claim-bit + workgroup list so the selection
phase processes only members whose inputs changed (movers, their contact row
peers, new admissions), mirroring the wall-claim pattern; plus a latent-bug
fix for full-mode pending-counter wrap (snapshot-subtract re-basing, since a
fixed-amount atomicSub commutes with concurrent increments — keep that fix
idea for the next attempt).

Result: applied pairs died after ~pass 2 at budget 512 (18 vs 1,575), the
unwritten residual words then read as zero and the convergence latch fired
falsely with real violations (ratio 12.4) frozen in. Reverted to 1842bd8;
restoration verified (profile back to bit-exact 1,575/259).

Two measurement traps hit and documented: (1) a terminal-step profile of a
corrupted trajectory is not diagnostic of the mechanism; (2) changing
contactCleanupPasses changes the trajectory itself — budget-16 shows an
all-zero terminal profile on the GOOD build too, so cross-budget profile
comparisons are invalid. A/B only at identical knobs.

Open root-cause question for next session: how select_matching_cleanup_edge
partial mode actually walks the row (ever-active-gated vs complete), and
what maintains reservation reciprocity for pairs whose ever-active marking
is single-direction under moved-set expansion. Read the select() body fully
(schroederSpatialMechanicalProposalsGpu.js:13081-13360) before retrying;
add a per-pass contact-count lane to the profile diagnostic first so
starvation is directly observable instead of inferred.

## ROOT CAUSE FOUND (select() read, 2026-08-27): selection is stateful

select_matching_cleanup_edge_for_index maintains a per-cursor SWEEP MARKER
(a solver-private CSR high bit, distinct from EDGE_EVER_ACTIVE) and clears a
member's whole row when `begin_new_sweep = pass==0 || prior pass applied 0
pairs` (schroederSpatialMechanicalProposalsGpu.js:13107-13117). Selection is
therefore NOT a pure function of particle state: skipping a member at a
sweep boundary leaves its markers closed and its edges permanently
"processed" — the exact starvation the reverted slim produced. The marker
also explains the ~1-pair-per-3-passes serial chain rate: it enforces a
fixed-order global sweep, restarted at each zero-applied delimiter pass.

Consequences for the campaign:
- Any selection workset reduction must treat begin_new_sweep passes as
  full-sweep (marker reopen is a row mutation for every contact member) and
  may only slim the intra-sweep passes. Zero-applied delimiters appear every
  few passes (firstZeroAppliedPass=2 at budget 512), capping this lever.
- The bigger truth: the sweep-marker discipline IS the pass-count driver.
  The named "sweep admission rate" follow-on (ss-regression.md:103) is the
  real lever — replacing the one-edge-per-order-slot sweep with something
  that admits an independent set per pass — and it is a solver redesign
  gated on the physics-equivalence train, not a workset optimization.
- Before attempting it: extend the profile diagnostic with per-pass sweep
  boundary + contact-count lanes (requires growing the control-buffer layout
  + solverBudget seal — a sealed-contract change, do it as its own commit).

## Contact-count lane LANDED (2026-08-27)

ABI v8→v9: 8th per-pass lane in the matching-cleanup control buffer
(`SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_CONTROL_LANE_COUNT = 8`,
words 12 + 8×passes). Owner stores `mechanical_matching_persistent_contact_count`
per pass beside the selection prestore; converged-tail synthesis and the
zero-edge bypass fill the region; host decoder reads
`profileBudget.contactCountWord` directly (replacing the broken
`particleCount - selection` inversion that reported maxContactCount=1216).

Verification: stash A/B at identical knobs (sodium-water,
ULG_PROBE_BREAK_STEPS=64, contactCleanupProfileReadback=1) — every
applied/residual lane bit-identical v8 vs v9. Clean throughput unchanged
(4.73 steps/s at 192-step horizon). Reference profile at the 64-step horizon
for future A/B: appliedPairTotal 2979, firstZeroAppliedPass 2,
lastNonzeroAppliedPass 495, maxContactCount 27 (uniform across buckets),
maxPosRatio decays 7.67→3.30 across the 16 buckets.

Observation for the redesign: at step 64 the 512-pass budget is nearly
saturated (lastNonzero 495) and terminal position ratio is still >1 —
only ~27 contact-frontier members are producing ~6 applied pairs/pass.
The sweep-order serialization, not contact volume, is the pass-count
driver. (Different horizon from the earlier 1,575/259 numbers — those were
a different capture point; A/B only at identical knobs.)

## Cost attribution CORRECTED (2026-08-27, cadence probe)

- The stage timing table (`residentStageTiming.stageMs`) records HOST
  ENQUEUE time, not GPU time (`sphGpuTimestampProfiler.js` header comment);
  `beginEncoderSpan` is deliberately inert (WebGPU has no encoder
  timestamps). The 6.7 ms "GPU total" it shows is meaningless.
- The honest number comes from the worker's queue-drain checkpoints: steps
  encode back-to-back at 10-22 ms, then ONE ~3.2 s stall every 16 steps
  (`ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS`) while the
  drain waits out the GPU backlog → ~200 ms real GPU work per step.
- Queue-fence stage attribution (`createSphGpuQueueStageRecorder` +
  `timedStage`) is plumbed end-to-end but the worker hardcodes
  `gpuTimestampRecorder: null` — and an ACTIVE recorder fail-closes the
  canonical single-level queue-ordered cleanup path
  (`schroederHierarchyGpu.js:17756`), so it cannot simply be switched on
  for the lane.
- Budget sweep pins the split: 512 passes ≈ 200 ms/step, 16 passes ≈
  63 ms/step → ~0.28 ms per logical pass, ~55 ms non-cleanup residual.
- Chunk-size 32→512 (one owner dispatch/step, commit 93ff262) was
  bit-identical and gained only 4.73→4.91 steps/s: the dispatch-start full
  sweeps were ~4%. The cost is per-INCREMENTAL-pass fixed overhead:
  serialized storage-latency chains (state/ledger/flag round-trips per
  member-row scan) on a single workgroup, ~0.29 ms per pass at ~27-member
  worksets.
- dt = 1 ms/step, so "real time" = 1000 steps/s; the Stop-hook bar of
  30 steps/s needs step ≤ 33 ms: cleanup ≤ ~10 ms AND the ~55 ms
  non-cleanup residual roughly halved. Both campaigns are mandatory.

## NEXT: resident-cluster owner (workgroup-memory hot state), bit-identical

Design decided 2026-08-27. Passes 1..511 of a dispatch write ONLY contact
members' state (pass 0's full sweep also wall-projects non-contact
frontier members, but re-projection is idempotent and incremental wall
claims are movers ⊆ contact). The contact cluster is tiny (~27 at the
64-step horizon; cap 64). So:

- Cluster mode (workgroup-uniform decision at seed): when
  contact_count ≤ 64, load contact members' input/output state
  (2×64×32 B = 4 KB), selection ledger (1 KB), and flag words (256 B)
  into workgroup arrays at dispatch start; run all logical passes against
  the cached copies; write back at dispatch end (and before trust
  restore/verification, which read storage). Fallback: contact_count >
  64 → current storage path (fail-safe, never fail-closed).
- csr_peers / matching_constraints stay in storage: read-only-ish
  streams, L2-resident after the first pass, prefetchable — the
  serialized dependency chain runs through state/ledger/flags, which is
  exactly what gets cached. (Selection's sweep-marker WRITES to csr_peers
  stay in storage — they are row-local, non-dependent across members.)
- Index→slot map: seed writes slot+1 into spare bits (8..15) of the
  member's owner flag word; phases already read the flag word. Peers of
  contact members are contact members (admission flags both endpoints),
  so every state access in passes 1+ resolves to a cluster slot.
- Evidence lanes: per-pass words stay in storage but member-side
  atomicMax/atomicAdd accumulate into workgroup atomics, flushed by
  lane 0 once per pass (~8 sequential stores).
- Workgroup budget: existing owner_list 4 KB + moved lists 4 KB +
  cluster 5.3 KB ≈ 13.5 KB < 16 KB baseline limit.
- Bit-identity: same arithmetic, same order — only the residence of the
  values changes. Verify with the cleanup-profile A/B + focused suites +
  throughput; expected pass cost → ~10-30 µs, cleanup → ~5-15 ms/step.
- Implement in stages, each gated on profile bit-identity: (1) cluster
  seed + state cache + copy/propagate; (2) selection/apply reads via
  slot-aware helpers; (3) ledger + flags + evidence batching.

After that: the non-cleanup ~55 ms (submit fusion, E0 radix bound,
reactionStep, EOS producer), then — only if still short of 30 steps/s —
the admission redesign (physics-order change, equivalence train).

## SUPERSEDED by measurements — lane-parallelism campaign (2026-08-27)

The resident-cluster cache was implemented, measured strictly SLOWER
(hash-probe accessors add instructions to an instruction/latency-bound
single workgroup), and dropped. Real attribution came from pass-level GPU
timestamps (commit d435ffe): `residentGpuTimestampProfile=1` now yields
device-side durations for the contact proposal's passes on the worker
lane. Key truths it established (sodium-water N=1216, NVIDIA Vulkan):

- matching-cleanup-owner: 158–198 ms GPU/step = ~76% of the step,
  ~0.40 ms per ACTIVE logical pass (owner time scales with the latch).
- Jacobi 4 ms; publish/verify/commit < 0.2 ms; the whole non-owner step
  is ~11 ms — the earlier "50 ms residual" was a cross-budget trajectory
  confound (the documented trap; budget sweeps change physics).
- `stageMs` tables are HOST ENQUEUE time (30x off); the queue-drain
  stalls (~3.2 s per 16 steps) were the honest total before timestamps.
- Barriers are free (8 extra pairs/pass: zero change). The pass cost is
  dependent-load latency on the FEW ACTIVE LANES of the single-workgroup
  owner: worksets of ~12 movers / ~27 contact members left >100 lanes
  idle while busy lanes walked ~30-cursor rows serially.

Fixes landed (all bit-identical, verified by cleanup-profile A/B at
identical knobs + suites):
- ded6258 expansion: 8-lane groups per mover row (0.19 -> ~0.04 ms/pass).
- 2073b33 selection: decomposed into cursor-strided scan + strict
  total-order merge + per-member epilogue; owner runs 16-member waves
  with 8 lanes/member and a workgroupUniformLoad-bounded barrier loop.
  Owner 127.5 -> 74.8 ms. Moved-list capacity 1024 -> 512 for scratch.
- Group width 16 measured WORSE than 8 (fold cost > depth savings).

State: 4.91 -> 11.61 steps/s committed. Owner remains ~75 ms =
0.151 ms/pass x ~495 active passes: expansion remnant ~0.044 (measured),
apply pure part ~0.003 (measured), wall/propagate/evidence small,
grouped selection remnant est. ~0.03-0.05. Per-eval dependent-load
latency (~5-10 us per 4-deep chain) is the floor for width-based wins.

Ladder to 30 steps/s (33 ms/step; non-owner ~11 ms leaves owner 22 ms):
1. Sub-round multi-matching per pass (opt-in flag): recover the ~half of
   members lost to mutual-best collisions (applied/pass ~6 of a ~13
   matching ceiling) — expect ~2x fewer passes. Physics-ORDER change:
   equivalence train, not bit-identity.
2. Remaining micro-attribution (grouped-selection remnant, wall claims).
3. If still short: admission redesign beyond matching (over-relaxation /
   shock ordering) — solver research, same train.
dt = 1 ms/step, so true real time is 1000 steps/s; 30 steps/s is the
Stop-hook minimum bar.

## Admission findings (2026-08-27, commit e236572)

- Match-retry among a pass's losers WITHOUT state propagation: measured
  ZERO recovered pairs, trajectory bit-identical with the flag on. The
  mutual-best "losers" have no other violated edges against the same
  state; new violated edges only appear after applications propagate.
  Matching quality was never the limiter.
- contactInnerRounds=K (selection+apply+propagate K times per pass,
  landed as an opt-in sealed-budget knob, default bit-identical):
  - Calm steps: converge in ~110 passes instead of ~259 with FEWER
    total applications (884 vs 1575) — owner 107.7 -> 23.4 ms. Fresher
    state converges faster per application.
  - Impact steps: budget-saturated either way (the falling block
    re-violates contacts every pass — continuous forcing, not a
    relaxation tail). K=2 does ~50% more solving at ~55% more per-pass
    cost: deeper resolution, no speed win there.
  - K>=4 idles: rounds past the second find no violated edges until
    wall/expansion run again.
  - Bring-up trap (twice): everything per-pass-once (lane-0 evidence
    prestores, the pass-0 re-baseline copy, per-member completeness
    adds) must be gated to round 0 or the completeness proofs read
    N+extra / prestore-wiped values and the run fails closed as
    ITERATION_INCOMPLETE. Diagnosed by breadcrumbing graph_control[14]
    through the contact profile lane. Resolved on audit: the GPU seal
    writes evidence status 5 (sealed rejection) and commit_contact_
    proposal refuses the state copy, so those runs advanced on the
    UNCLEANED Jacobi state with rejection receipts published — the
    readback-free lane surfaces the rejection as evidence rather than
    aborting the step, which is the documented fail-closed design and
    exactly what the parked validation framework is meant to consume.

## Where 30 steps/s actually stands (2026-08-27, commit e236572)

Default interactive preset (budget 512, K=1): 11.61 steps/s. The
impact-phase owner is budget-saturated at 512 x 0.151 ms; the sim is
under-resolved there by the preset's own admission (terminal ratio > 1),
so the budget IS the quality knob. Measured menu at the 192-step
horizon (budget changes change the trajectory — the numbers are per
config, not a curve):
- 512 passes, K=2: 12.77 steps/s, ~50% deeper impact resolution
- 128 passes, K=1: 25.54 steps/s
- 96 passes,  K=1: 21.28 steps/s (non-monotonic: different trajectory)
Reaching a sustained 30 needs either a lower interactive budget
(physics-quality decision — surface to the owner, do not flip
silently) or another ~3.5x on per-pass cost (0.151 -> 0.043), beyond
what lane-grouping has left. iron-ice-quench runs 6.5 steps/s at
default on the same commits.

## Final attribution & pipeline fixes (2026-08-27, f05c5c4)

Tooling now decomposes everything (residentGpuTimestampProfile=1):
contact pass timestamps + a per-stage queue timeline across the step
(queue:* keys) + an internal epoch-generation timeline. Hard-won
lesson: queue-interval BRACKETS on a busy queue measure occupancy, not
the stage — the epoch generation "22.4 ms" was backlog draining inside
the bracket; its internal timeline shows 0.93 ms of real device work.

At budget 128, N=1216, step ~192: step queue 32.6 ms = cleanup owner
18.4 + Jacobi 4.2 + gas-EOS producer 7.0 + ~3 everything else; epoch
~1; the queue runs ~96% busy after the lagged drain (the 16-step Dawn
pressure checkpoint now awaits the PREVIOUS boundary's fence; stalls
halved, physics bit-identical). Schedule length is NOT the limiter and
the presentation was ruled out (per-commit field build ~12 ms, raster
viewport-independent).

Scoreboard (sodium-water, default 512 preset): 1.7 origin -> 4.9 ->
11.6 (lane grouping) -> 15.3 steps/s (lagged drain, await-then-start
ordering: a failed checkpoint aborts without touching the queue again;
fence counts per schedule = 1 seed + 1 per satisfied checkpoint +
terminal). Budget-128 deadline config: ~20-21 steps/s. The gas-EOS
producer's mapAsync is fallback-only (the lane takes the
queue-submitted-cleanup-deferred zero-readback path), so its ~7 ms is
real kernel work. Road to a sustained 30:
1. owner 18.4 -> ~12 (further lane micro or admission redesign)
2. gas-EOS producer 7.0 -> ~2 (unexplored; N=1216!)
3. per-64-step commit/verify/turnaround ~14 ms/step -> ~8
plus the budget decision if the owner wants the deadline guaranteed at
impact steps.

## Commit-boundary mystery (2856b0a) — NEXT SESSION'S FIRST TARGET

Schedule-phase stamps + a 64-entry ring decompose the whole lifecycle:
steps encode uniformly (~18 ms at budget 16), turnaround ~90 ms,
post-fence assembly ~0 — and the terminal fence waits 1.1-1.3 s for
REAL pending device work (raw fence latency is ~0-3 ms) that none of
the instrumented stages account for. Eliminated: presentation worker
(disabled: no change), interface refresh + surface draw (disabled,
field build verifiably absent: no change), render refresh, epoch
(0.93 ms true), progress candidates (~2-3 ms/step total). The work is
submitted around the commit boundary and drains under the next cycle's
fences (also visible as the ~500 ms checkpoint stall at step 16).
~1.2 s per 64-step cycle ≈ 19 ms/step — the TOP line item at every
budget. Suspects: the gasCellEos finalizer chain, reflux receipt
encode, StateManager commit-side device work, lane continuation
handling. Next experiment: worker-side queue markers bracketing the
commit boundary (schedule-end marker already exists via the phase
stamps; add one at next-schedule start and read the early steps'
queue:* timeline instead of the last step's).

EXECUTED (2856b0a+): the ring now carries per-step stageGpuMs; early
steps' queue windows are CLEAN (14.7 ms uniform under profiling) — the
foreign work drains OUTSIDE all stage windows. The per-step epoch
bracket (an occupancy meter) shows ~38 ms/step of queue occupancy early
in the sodium run and ~23 ms late against 0.93 ms of true epoch work:
i.e. ~19-23 ms/step of device work from an unidentified per-step
producer, surviving presentation-off, refresh-disabled, surfaceDraw-off,
and progressEvery=8 (~3 ms/step only). Under no-profiling runs the same
producer accounts for the checkpoint stalls and the terminal-fence tail
(64 x ~19 ms ~ 1.2 s/cycle). Water-cycle is NOT a counterexample: its
16-step schedules fire no drain checkpoints (stepOrdinal < stepCount
gate), so its 0.5 s tail is the whole schedule's ordinary GPU drain.
Remaining suspects for the sodium producer: per-step product-mass /
particle-storage materialization submits, per-step writeBuffer traffic,
or another non-stage submitter on the shared queue. Instrument by
enumerating queue.submit call sites hit per step (host-side counter in
the worker device wrapper) before guessing further.

EXECUTED — submit census results (sodium-water, budget 16, per step):
~30 production submits from ~20 named sites. Ruled out: per-submit
overhead itself (~38 us each, microbenched: 1000 split submits 43.7 ms
vs fused 6.2 ms => ~1 ms/step total), the active-node/law-queue/
phase-volume family (all five flags off: +1 step/s = ~2.5 ms), the
epoch cluster (0.93 ms true). REMAINING census-guided suspects for the
~19 ms/step of unattributed device time:
- submitQueueOrderedFinalConsumerWork (webgpuComputeLayout.js:732) —
  4 submits/step of deferred final-consumer/cleanup work
- submitFrozenFamilyCopy (schroederSpatialReactionPlacementEpochGpu)
- submitResidentProductHistoryFilteredAppend (sphMlsMpmGpuStep)
- runSphSpatialGasLedgerEosRetained + gas free-volume EOS authority
Next: wrap these four with marker pairs (all infra exists) for direct
per-site device time. The census wrapper lives in the schedule payload
(diagnostic-only, armed by residentGpuTimestampProfile=1) and surfaces
as scheduleResult.submitCensus.

ATTEMPTED per-submit device-time census (marker command buffers appended
inside every intercepted submit): correct in principle (order-exact,
submit([m1,...bufs,m2])) but the naive always-on form crawled the run
to ~1 step/s — per-submit Error() stacks plus two encoder+buffer
creations per submit compound with the per-step profile serialization.
REVERTED to the counts-only census. The right form: SAMPLE exactly one
step per schedule (arm the marker context at one ring push, disarm at
the next), which bounds the overhead to ~30 marker pairs per schedule.
The scene mirror and probe already read submitCensusDeviceMs when a
future worker emits it. Second attempt (sampled one-step form) ALSO
wedged schedule 2 (one commit in 60 s; schedule 1, unarmed, ran
normally) — the wedge follows ARMING, not the always-on overhead.
Suspect the marker-buffer injection interacting with a consumer of the
intercepted submit's receipt (some callers inspect their own command
buffers or rely on submit(buffers) identity), or an exception path
swallowed by the fall-through. Debug worker-side with the page console
captured (preset-rate-probe-shot pattern) before re-attempting; keep
the counts-only census meanwhile (it is validated and fast).

## Addendum (2026-08-27, commits d52e6cb + 2779f12): the wall was the GPU process, not the GPU

Chromium spends ~0.25 ms of GPU-process main-thread CPU validating every
`dispatchWorkgroupsIndirect` (73x a direct dispatch — `scratch/indirect-cost-probe.mjs`).
The step issued 138; the GPU process saturated while the silicon idled at
collapsed clocks. Converting the GpuCount radix paths to element-guarded
direct-ceiling dispatches (parent-offset adds and 2D-folded shapes stay
indirect) removed 105 of them: budget-16 went 20.3 → 37.2 steps/s and the
terminal tail 1.25 s → 0.5 s, bit-identical. A fenced 4-byte live-count
observation at each schedule tail re-tightens the product-history bound
(emitted "counts" are the 2,432-row per-step capacity; the true live count
is zero for sodium-water), keeping the gas-EOS/spatial-epoch sort capacity
ramping 4096→131072 instead of pinned at 262144.

Sustained 150 s menu: 16 → 38.7 (flat over 4,480 steps), 32 → 34.3,
**48+K2 → 32.1 (best ≥30-quality config)**, 48 → 30.6, 64+K2 → 28.0,
96 → 22.4, default 512+K2 → ~23 early degrading to ~7 after ~450 steps.
The late decay is physics (contact growth saturating the owner budget) —
default-quality 30 fps needs the Jacobi-wide owner solver redesign.
~33 indirect dispatches/step remain outside the radix module (grid-update
×7, epoch/phase-volume/EOS singles) — same conversion pattern per site,
each needs its kernel's element-guard verified.
