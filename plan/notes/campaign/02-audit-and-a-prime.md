# Campaign note 2: the 2026-11-03 audit and plan A-prime (what A1 and G4 inherit)

Source: `plan/todo/2026-11-03audit.md`, all 694 lines, read by Hermes
2026-11-17 (the first pass, digest `picture/15`, had sections 2 and 8-10 only).
The audit was Claude's answer to the owner's instruction of 2026-10-28: "read
the entire dev log and every line of code in the application. make sure you're
using icc. and tell me if your plan changes". "The answer is **yes, the plan
changes**." Its line references are to `HEAD f6f7a5e`; the campaign has moved
many of them since.

Method (`:43-70`): 93 slices (85 code, 8 log) of about 330 KB, one sub-agent
per slice, coverage checked mechanically, about 25 plan-changing claims checked
against source, which "caught four reader errors". Notes are kept in
`~/.cache/icc/repos/ulg/full-review-20261027/`. The present read uses the same
method on today's tree.

## Plan A-prime and its verdict

A-prime (`:27-33`): "1. decouple physics from presentation; 2. selective
contact; 3. fuse the side laws into the one canonical lane, behind a law
descriptor; 4. build in exact integer ledgers." Gate: "Iron Ice at ≥1,000
steps/s live, with every law on." Alternative B: ledgers first on the current
route.

Verdict (`:72-91`): "The direction holds. Every rule it obeys still binds: one
canonical lane; no second route or scheduler; no per-preset branch; no law
removed or demoted; one producer per state family; GPU-native validation."

| | Before the audit | After the audit |
|---|---|---|
| First step | Remove the hold and the Tier0 cap | Step 0: prove the 6.4 steps/s baseline is real |
| Decoupling | 2 couplings | ~8 couplings, plus a G1 acceptance decision |
| Contact | Second, as a speed fix | First physics item, as a correctness test |
| Fusion | Wire sidecars into the fused path | Rewrite the per-step authority contract |
| Ledgers | "Phase 0 kernels exist" | Need one energy definition, the extra mass families, vapor exchange wired |
| Gate | ≥1,000 steps/s, every law on | "Unreachable by these steps; staged gates, counting committed events" |

Decided 2026-11-13 (`:10-15`, `:552-557`): "The user deferred the architecture
work (Steps 1-3 and the gate) to A1, and kept G2 first." Steps 1-3 "move to A1
and G4". Decisions 2 (G1 receipts) and 3 (contact) "are deferred with that
work". dt 1 ms allowed for G2 evidence.

## Step 0: the baseline (`:93-176`)

Iron Ice, unprofiled, 2026-11-13: 5.86-6.09 steps/s at dt 0.5 ms; no
rollbacks in 714 traced steps. Per step: "30.5 submits; 106 compute passes; 397
dispatches, 52 of them indirect; 222 `writeBuffer` calls; 9.1
`onSubmittedWorkDone` waits; 44 `createBuffer` calls."

- "Profiling changes the route it measures": GPU timestamps turn off contact
  presentation gaps, fence-free cleanup and proxy submit fusion.
- "dt 1 ms changes the outcome": the app caps sound speed at
  `cflSafety·spacing/dt`, "so condensed-phase moduli are 4× softer at 1 ms".
  "The user approved dt 1 ms before this was known." (Iron Ice evidence later
  returned to 0.5 ms.)

## Step 1: physics and presentation are coupled in eight places (`:178-279`)

The eight (`:186-195`): the page holds the next batch on the post-step
presentation gate; the worker flushes and waits up to 100 ms for a frame proof
after every canonical step ("added 09-04 for G1"); the Tier0 cap of 2 substeps
per presented frame; the contact solve pauses every 4 Jacobi rounds for the
presenter; every schedule waits for the page's surface-draw queue; every
schedule awaits its own presentation after commit; the worker refuses the next
schedule until the page admits the previous one; and "A physics input is
produced at render cadence. The pressure-interface force solver is plain JS
reading an interface field built from render rows".

What they protect (`:204-218`): "exact-generation visibility and buffer
lifetime, not a GPU data race". Physics and rendering share "one worker, device
and queue"; "The renderer reads physics buffers in place."

Hazards of naive removal (`:220-243`): the display can freeze (validation is
cancelled by every new enqueue), blank, or starve; old SS generations pile up
("Retiring an SS generation needs its render lease released"). Real limits
that must stay: "The drain every 16 steps bounds Dawn's queue: 'unbounded
64-step queue shut its Instance down'"; "A 128-step single-fence batch 'could
lose the browser WebGPU device'".

The G1 decision (`:261-270`): G1's receipts "require presented steps == physics
steps (iron '213/213')". "Decoupling means changing the rule to 'the latest
committed state is shown at ≥54 Hz'. That is the user's call." **Still
undecided.**

Step 1 work list (`:272-279`): admit the latest committed epoch; snapshot at
the schedule's terminal submission; latest-wins validation without cancelling;
a guaranteed presentation slot on the queue; move the pressure-interface
producer to physics cadence; cap queued work rather than hold on frames.

## Step 2: contact (`:281-366`)

**Five overlapping contact responses at the iron-ice interface** (`:283-311`):
the grid multi-field contact (`contact_fields`, a perfectly inelastic normal
impulse before G2P); the pair-contact graph after G2P (whose own comment says a
second impulse "would double the response", yet the shader applies
`pair_scale.y * pair.barrier_dv`); the pressure-interface penalty force,
"non-zero at rest"; the G2P excluded-volume PBD projection; a grid wall
barrier.

Why it costs (`:320-342`): 512 interactive cleanup passes against a measured
~890-pass worst case; "Contact fails closed above 1,024 active particles";
"Any active law forces contact on"; "There is no early exit across the 16
Jacobi rounds"; "Budgets are compiled into WGSL and sealed into the schedule
signature ... so selection has to be decided on the GPU"; "Mixed materials
search 33× the largest particle diameter".

Step 2 work: A/B each response; "If responses double up, remove the
duplicate"; then GPU-side activity predicates; then evidence checks that accept
GPU-filled evidence, not full budgets. (Hermes: the trust-radius change 16 → 1
on 11-16 addresses the 33× search; the double-response A/B is not recorded as
done in what Hermes has read so far.)

## Step 3: fusion is a rewrite of the per-step contract (`:368-460`)

Blockers:

- **One step per call.** "one immutable hierarchy generation cannot span
  multiple position epochs". The K-step encoder throws for the same reason.
- "Per-step identity lives in host-written uniforms"; a mismatch "silently
  produces a zero dispatch". Fusing K steps "needs per-step slots or
  GPU-advanced identity, plus a host-visible failure counter".
- "'Submitted' is used as an authority token. `isExecutionSubmitted` is
  defined in 13 modules." "The epoch builder submits itself ... That forces a
  `queue.submit` inside every step, although queue order alone would satisfy
  the data dependency."
- "No stage runner takes the caller's command encoder."
- Arenas cap K at 2-3 (max 8). "Two fence-coalescing attempts were reverted
  ... 'Do not try a third without reading this'". "Arena leases must become
  GPU-side or ring-based before fusion."
- "Reaction is never quiescent while thermal runs. The activation watch marks
  every particle triggered whenever thermal or phase is on."

The law descriptor (`:409-428`): "At least eight partial descriptors exist.
All of them are metadata, and none rejects a double writer." Best seed:
`createFusedResidentSidecarFusionPlan` (per-law `{id, lawNodeId,
orderConstraint, reads, writes, ...}`, "no `accumulates`, not enforced").
"**Extend one of these so it gates execution and models `accumulates`, rather
than adding a ninth.**" This is the executable law contract that
`greenfield.md` section 2 and the SS law-seam assessment both ask for.

Quick wins (`:430-452`): "The law queue and four phase-volume stages run every
step, and their results are never applied. That is about 5 of the 32 submits
per step ... The fix is generic consumer-gated activation, not a per-preset
flag"; thermal on `ss=1` "visits every active source per source ... about 46M
pair checks per pass at 6,784 rows" though "A cell-based walk exists"; the
redundant S9-C sidecar; indirect dispatches at "about 0.25 ms of CPU in the
GPU process" each. "Not a lever: per-step buffer creation."

Step 3 order: attribute submits; quick wins; "Move epoch identity onto the
GPU, and split encode from commit"; a shared-encoder runner contract; make the
descriptor gate; move the pressure-interface solver from JS onto the GPU.

## Step 4: ledgers (`:462-503`), since largely done under G2

Then: Phase 0 lived only in a test fixture; "Energy has no single definition"
(`cpJPerKgK` used as dU/dT; Cp for most gases, Cv for air); vapor exchange
could not run in the app; "A law can be on and quietly do nothing" (reactions
fire only when F == I bit-exact, C == 0 and J == 1); humid-air Iron Ice failed
at step 1. "Energy checks that can never fail" are listed (`:499-503`),
including the reflux ledger's operator-split bound and one phase-volume
transport check.

## The gate (`:505-548`)

"**≥1,000 steps/s with every law on is not reachable by Steps 1-4 as
written.**" The budget is about 1 ms per step for all GPU work and rendering
on one queue; the step was about 60 ms of GPU time. "Fusion does not remove
most per-step GPU work: two radix sorts per epoch rebuild, every step (the
exactness contract requires same-step positions); reaction placement at
150-250 capacity-sized dispatches even when nothing reacts (inferred);
contact; thermal's all-pairs search; about 54 indirect dispatches."

"Tier0's 1,100-1,260 steps/s is not like-for-like: it runs no contact graph and
no field contact; it runs one row per particle, where Iron Ice runs 4".

"'Every law on' is ill-defined today": "the far-field 'laws' (radiation,
plasma, gas summary) are scaled-gravity placeholders"; "the two-level route
runs only on the cesium-fluorine preset".

Proposal: staged gates, counting "reactions and transfers that were actually
committed, not laws that are switched on". "**dt is a lever.**"

## Other findings worth carrying (`:578-666`)

- Silent failures: "A GPU authority rollback silently becomes a mechanics
  no-op"; "A single bad particle row cancels its level's dispatch with no
  error"; no `uncapturederror` listener; "The 30 s stage timeout never cancels
  the schedule, so the orphan keeps advancing lane state without a commit".
- Possible bugs: phantom product mass for non-physical reactions; "The
  law-queue contact gate looks indexed by particle. The queue is ordered by
  active node"; moved-list overflow at 512 slots; three-body block collisions.
- Fragile code generation: "The live thermal shader is text-patched ... 12
  exact-text replacements"; "V2 shaders are V1 plus string patches"; "The
  reaction-extent law exists in seven copies".
- Size: `runSchroederSameLevelMechanicsWebGpuImpl` about 9,190 lines;
  `createSphPhaseScene` about a 40,900-line closure; "Test-only code ships in
  production modules: CPU oracles and mirrors, about 1,000 lines in the contact
  module alone."
- ICC (`:676-684`): "Call-graph results are unreliable in this repo ...
  Confirm any 'dead' or 'no callers' claim with `grep -rn`."

## How the campaign's A1 work maps onto this audit (Hermes, INFERRED from digests `picture/03` and `picture/08`)

| Audit step | Campaign work since 11-13 | Left |
|---|---|---|
| 0 | Done; the probe became `scripts/step0-baseline-probe.mjs` | — |
| 1 decouple | Presentation holds and waits removed or shortened on the canonical lane (A1 slices 1-3); water-realtime re-coupled by choice for its own display | The G1 rule decision; latest-wins validation; pressure-interface producer at physics cadence (to check) |
| 2 contact | Trust radius 16 → 1; gas rows out of the query maxima; `contactInnerRounds` | The double-response A/B; GPU activity predicates; failure liveness (owner decision pending); the "contact-owner redesign" |
| 3 fusion | Direct dispatch for field consumers; consumer-gated law queue (to check); G4 dormancy for thermal and reaction | One step per call still holds; epoch identity is host-written; no shared encoder; the descriptor does not gate |
| 4 ledgers | G2 phases 0-3 and more | Room air runs the f32 route |
| Gate | A1 has no agreed number ("The steps/s target and which laws count for A1" is open) | Owner decision |

The structural blocker under all of A1 is an SS property: one immutable spatial
generation per position epoch, rebuilt with two radix sorts every step. A2
(incremental repair) and the larger-dt work are the two ways the campaign has
approached it; neither changes the contract.
