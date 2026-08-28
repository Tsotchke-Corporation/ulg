# Scale-Adaptive Law Activation and the Closure Economy

Written 2026-08-27 on branch `performance`, from a design conversation following
the real-time campaign (commits d52e6cb..cbf5602). This document records the
target execution architecture for the ULG runtime: a bulk substrate that runs
at pure-MLS-MPM speed, with expensive laws activated only where and when
conditions demand, on scoped regions or statistical samples, extrapolated
elsewhere through cached closures — across every level of the continuous SS
tree, without stalling the simulation while derivations run.

This is not a new architecture. It is the v0.4 Star Spec's stated design
("macroscopic behaviour is not implemented, it is *activated*"; "the runtime
selects the deepest substrate the local regime demands") given an execution
order the current implementation never had. The current implementation is the
eager inversion of the spec: every law family runs on every carrier every
millisecond regardless of activity — measured on sodium-water at 152 live
particles: 172 compute passes, ~30 submits, and ~31 ms of structure per step
while the contact latch is idle and zero products exist. A pure MLS-MPM sim
runs ~1 ms/substep at 100k+ particles; the gap is ~10^4-10^5 in
particle-steps/s and is dominated by per-step fixed orchestration, not
physics arithmetic (~200 us/step).

## The motivating measurements (2026-08-27)

- Per-step floor ~31 ms at 152 live particles, N-independent (a single
  particle would cost the same). Cost scales ~N^0.76 measured at 152/407/854
  live particles — the *intercept* is the scandal, not the slope.
- The MPM core itself (P2G/grid/G2P, node-aggregated) is ~2 ms of that and
  would be ~50 us at proper dispatch shapes; everything else is epoch rebuild,
  capacity-sized machinery, the serial contact owner, per-stage host awaits,
  and pass/submit launch overhead.
- The receipts/fail-closed discipline is NOT the cost: the contact owner runs
  512 logical passes in one dispatch with in-kernel evidence synthesis —
  proof that epistemic discipline does not require pass explosion.

## Two unifications that make the design small

### 1. The cache miss IS the trigger

"When do conditions imply we should run thermodynamics or chemistry?" — when
the bulk path's closure lookup exits its validity envelope. The spec already
mandates envelopes ("a closure without a validity envelope is invalid by
default"). Domain-exit is the demand signal; there is no separate per-law
trigger-detector subsystem to invent. `closureRefreshRecommended` in
`src/runtime/closureLawGraph.js` is this mechanic in miniature (CPU-side,
advisory). The GPU-side generalization is an envelope-exit flag per SS node
per law, written by the bulk pass that consumed the closure.

Trigger soundness rule: envelope tests must be conservative supersets
(erring toward activation), with the error bound declared — this is the Law
Adapter Contract's "aggregate traversal admissibility and error bounds" field
doing its intended job.

### 2. Vertical escalation is horizontal sparsity, rotated

An SS node at level L is an aggregate of L-1 and a "particle" to L+1. "Run
the expensive law on a scoped region" (horizontal) and "descend to a deeper
substrate" (vertical, the spec's escalation ladder) are one operation. A
continuum region outside every cached EOS envelope descends: run electronic
structure on a *sample*, derive the response closure, cache it, resume at
continuum scale. QED at the bottom of the ladder is not a per-step cost — it
is the rarest, deepest cache miss. The offline material-derivation pipeline
(radial Kohn-Sham ladder, RHF/UHF/MP2, MD, Debye tables — CPU oracles today)
is this descent path already built, invoked per-material-at-build-time; the
runtime form invokes it per-regime-on-miss.

## Non-blocking derivation and extrapolation debt

The sim does not stop the world while an expensive law or derivation runs.
On envelope exit, the affected region keeps stepping on the best available
closure (clamped at the envelope edge or extrapolated past it) while the
derivation runs concurrently; the expanded closure adopts at a declared
schedule boundary. Per-law policy — this is the Law Adapter Contract's
required "fallback policy" field, with three values:

- `strict`: stall the region (or the run) until the closure lands. Exactness
  receipts intact; deterministic.
- `async`: free-run on extrapolation; record extrapolation debt; adopt at the
  next boundary. Deterministic given the adoption log.
- `frozen`: never derive; clamp at the envelope edge. Demo/preview mode.

Discipline requirements:

1. **Debt receipts.** Steps taken out-of-envelope are declared evidence:
   {law, region/node set, step ordinals, envelope distance, closure
   generation used}. WARN-class, never silently promoted to PASS (the
   standing cached-results rule, `plan/todo/ss-regression.md:135-136`).
2. **Logged adoption.** Async closure swaps happen only at schedule
   boundaries and the receipt records the adoption ordinal, so replay honors
   the log. No mid-step or mid-schedule mutation of a closure a kernel may
   read (same immutable-epoch rule as the spatial generation).
3. **Forward-only conservation.** Past extrapolated steps are not rewritten.
   Discrete-event laws (reactions) conserve exactly regardless of adoption
   timing because their ledgers are transactional. Continuous laws declare
   per-law whether an adoption applies a conservative reconciliation term or
   simply proceeds; that choice is part of the law's contract, not a global.
4. **Derivation venues, in adoption order:** (a) CPU oracle workers — the
   existing derivation ladder is CPU-side, so the first async closure factory
   costs the GPU lane nothing; (b) PeerCompute-leased warm hosts / remote
   peers — derivations are exactly the provenance-carrying compute tasks the
   orchestration layer exists for; (c) same-GPU low-priority — last, because
   GPU-process contention is measured and real.

In-repo precedent for the whole pattern: the product-history live-bound
observation (`observeResidentProductHistoryLiveRowBound`) — evidence lands
asynchronously at a fenced boundary, tightens the world only for future
schedules, and failure degrades to the conservative prior.

## The closure store (the spine)

Closures are keyed by **regime**, not by scenario: a canonicalized
statistical state (composition, T/P/density ranges, ensemble assumptions,
chart/level class), so a derivation from one run serves every future region —
in any run — that lands inside the envelope. Store closures in
nondimensionalized form wherever the physics is scale-similar, so one
derivation serves multiple tree levels across the ~40-orders-of-magnitude
span (per-level charts handle f32 range; scale-free closures handle reuse).

The invalidation and placement discipline already exists and is adopted
verbatim:

- **Cache Layering Rule** (`plan/todo/README.md:3019-3030`): hot = leased
  worker-local GPU buffers/pipelines; warm = StateManager deltas, closure
  handles, compact law summaries; cold = content-addressed artifacts
  (ArtifactCache; SHA-256 path exists). Invalidation keys include input hash,
  method/tool hash, **validity domain**, schema version, source/runtime ABI,
  and validation status.
- Cached physics served to a run surfaces as WARN, never silently PASS.
- Provenance rule from the spec: imported/derived closures carry explicit
  provenance and are never labelled emergent (hard rule 1).

Store tiers by time-to-derive: lookup table (ns) <- fitted response (us) <-
sampled law run (ms-s) <- full substrate descent (minutes-hours, possibly
remote). Each miss at one tier is a request to the tier below.

## The tier architecture

- **Tier 0 — bulk substrate, always on, all N, real-time.** Fused MPM core
  (P2G/grid/G2P; node aggregation IS the anti-N^2 mechanism), uniform
  external fields, wall handling, and closure *lookups* only. Shape target:
  <=10 passes and 1-2 submits per step, K steps encoded per submit with a
  GPU-side step loop (the authority model already commits per schedule, not
  per step — per-step host orchestration is not required by the design).
  Per-level: every occupied tree level needs its cheap propagator; level 0's
  is the MPM core.
- **Tier 1 — envelope watch, O(active nodes).** A cheap pass over SS nodes
  evaluating closure envelopes and conservative activation predicates,
  writing per-node law-activation masks. The law queue
  (`runSchroederLawQueueWebGpu`) already has this shape (per-node rows,
  per-law enable bits) — today a pass-through allow-gate, becomes the
  scheduler input. Zero-activation short-circuit uses the proven on-GPU
  conditional pattern (the contact zero-edge bypass: decide on GPU, latch the
  dispatch, synthesize the receipt — no host readback).
- **Tier 2 — scoped invocation, O(active region).** Activated laws iterate
  triggered nodes' CSR members only. Fixed admission envelopes (e.g. the
  contact owner's <=1024 participants) become correct semantics rather than
  scaling walls: locality is the claim, fail-closed is the overflow answer.
- **Tier 3 — the closure factory.** For homogeneous regions, run the law on
  a sample, fit a response closure with its envelope, apply region-wide by
  lookup, invalidate on exit. Homogeneity tests are part of the closure's
  validity, not optional. The thermal Debye segment bank
  (`sphThermalGpuKernel.js` closure-graph bank) is the working miniature.

## Honest inventory (2026-08-27)

| Piece | Status |
| --- | --- |
| Node-aggregated bulk mechanics (P2G/grid/G2P) | Runtime; needs Tier-0 shape (fusion + multi-step encoding) |
| Fused mechanics runner | Exists; bypassed on canonical route when gas boundary on |
| Admissible near-field traversal (directory/CSR, no all-pairs fallback) | Runtime, verified 2026-08-27 |
| Far-aggregate (Barnes-Hut) chain | Built, quarantined, dormant; no mounted pairwise long-range law yet |
| Law queue as activation-mask carrier | Structure exists; used as allow-gate only |
| On-GPU conditional-with-receipt (zero-edge bypass, convergence latch) | Runtime; the template for law skipping |
| Envelope-exit signal | Miniature only (`closureRefreshRecommended`, CPU) |
| Offline derivation ladder (KS/HF/MD/Debye) | Oracle; per-material at build time |
| Runtime sample->derive->cache | Missing |
| Regime-keyed closure store | Missing (cold content-addressed cache + closure artifact plumbing exist) |
| 3+ tree levels | Missing (two-level = kernel suite; sol-critic Priority 3 gates) |
| Async adoption receipts / extrapolation debt | Missing (pattern precedent: live-bound observation) |

## Sequencing and acceptance gates

- **Phase A — bulk mode exists and is measured.** A scenario at N >= 100k
  live particles with all laws quiescent sustains 60 Hz on current hardware.
  Forces step fusion, K-steps-per-submit, and true zero-cost-when-inactive
  (today thermal/reaction/EOS/epoch run unconditionally). This is the floor:
  sparsity buys nothing while an idle step costs ~30 ms of structure.
- **Phase E (early, cheap) — closure-store schema.** Regime key + envelope +
  provenance + validation status + the Cache Layering invalidation key.
  Schema/ABI work, consumed by every later phase.
- **Phase B — envelope watch gates existing law stages** at node scope with
  receipts (zero-activation schedules skip law encodes entirely).
- **Phase C — scoped invocation** (laws iterate triggered regions only).
- **Phase D — the online closure factory** with `strict`/`async`/`frozen`
  policies, debt receipts, and logged adoption.
- **Level track (parallel):** multi-level tree per sol-critic Priority 3
  gates; each new level multiplies the value of Tiers 1-3.

Gate style throughout: bit-identity or physics-acceptance A/B at identical
policies; WARN debt visible in receipts; strict mode reproduces exactly;
async mode reproduces given the adoption log.

## Non-goals and prohibited shapes

- No second scheduler competing with the epoch scheduler (standing
  prohibition); Tier 1 produces inputs the existing step consumes.
- No silent extrapolation: every out-of-envelope step is receipted debt.
- No knob-tuning governor as a separate subsystem: performance/accuracy
  adaptation emerges from activation sparsity + closure tiers; sealed-variant
  lattices stay precompiled and boundary-switched (no mid-run variant
  generation — the capacity-family compile storms are the cautionary tale).
- Numerical policies (CFL scaling, damping, hysteresis, admission caps) are
  not laws and are never labelled as such in receipts
  (`plan/solver-law-inventory.md:233-246`).

## Implementation plan — night 1 (2026-08-27), aggressive

Ordering principle: every milestone lands committed, measured, and
independently valuable; later milestones never block earlier value. The
validation layer (receipt families consuming tonight's evidence) is
explicitly day 2 — tonight's milestones emit the receipts it will consume.

### M1 — Bulk-mode capacity recon and the `bulk-water` scenario
A laws-quiescent scenario (single material, no reactions/thermal tables, no
product reserve) whose live particle count scales to >= 100k via controls.
Expect and fix capacity blockers as found (grid dims, buffer sizes, carrier
lane multipliers, dispatch limits). Acceptance: worker lane commits steps at
N >= 100k live; measured baseline steps/s recorded, whatever it is.

### M2 — Structure census at 100k
Rerun the pass/submit census at bulk N to re-rank the step's fixed costs at
scale (the 152-particle ranking will not survive contact with 100k).
Acceptance: a table naming the top 5 costs and which milestone kills each.

### M3 — Fused mechanics on the canonical bulk route
The fused P2G/grid/G2P runner exists but is bypassed; make bulk mode take it.
Acceptance: fused path active on the worker lane in bulk mode (receipts show
it), measured delta, suites green.

### M4 — Burst encoding: K mechanics steps per submit
For laws-quiescent stretches, encode K steps (ping-pong state) in one
encoder/submit with no per-step host awaits; commit cadence unchanged
(authority already admits per schedule). Start with K=8. Acceptance:
steps/s at bulk N with K=1 vs K=8; bit-identical state vs K=1 over a fixed
horizon; drain checkpoints preserved.

### M5 — 60 Hz hunt
Iterate M2's ranking against the M3+M4 platform (dispatch shapes, separation
bin sizing at bulk N, epoch cost at scale, submit count). Acceptance: the
measured N-vs-steps/s curve on this hardware, with the largest N sustaining
>= 60 steps/s named honestly — whether or not it reaches 100k tonight.

### M6 — Closure store schema (Phase E)
New module + tests, host-side: regime key canonicalization, validity
envelope, provenance, validation-status field, Cache Layering invalidation
key, WARN-never-PASS accessors. No GPU work. Acceptance: unit suite green;
schema consumed by M7's receipt.

### M7 — Envelope watch, first increment (Phase B seed)
A per-node activation predicate pass writing a triggered-count evidence word,
read 4-byte-fenced at schedule boundaries (live-bound pattern), gating the
NEXT schedule's law-stage encodes, with an activation receipt in the schedule
result. First predicate: reactant-pair proximity + temperature threshold.
Acceptance: sodium-water runs with law stages skipped on quiescent schedules
and re-enabled on triggered ones, physics acceptance arm still green.

### Explicit non-goals tonight
Scoped per-region invocation (Phase C), the online closure factory (Phase D)
beyond the M6 schema, multi-level tree work, and any physics-claim changes.
Strict/async/frozen policies land as schema fields tonight, machinery day 2+.

## Night-1 results (2026-08-28, commits 6323588..ed5b1fa)

Milestones landed: M1 (bulk-water at 103,831 live particles committing),
M2 (census at bulk N), M3 (fused mechanics on the canonical route via the
explicit `ambientPressurePa` vacuum boundary condition), M5 (curve below),
M6 (`closureRegimeStore` + 9 tests), M7 first increment (the per-schedule
law activation receipt, shared with the epoch's sidecar/field-view gating).
M4 (K-steps-per-submit burst encoding) carries to day 2 unstarted.

Measured N-vs-rate curve (bulk-water, worker lane, laws quiescent, full
authority/receipt machinery):

| live N | steps/s | ms/step |
| --- | --- | --- |
| 1,008 | 109.9 | 9.1 |
| 13,832 | 104.6 | 9.6 |
| 32,776 | 83.9 | 11.9 |
| 64,008 | 69.4 | 14.4 |
| 103,831 | 55.9 | 17.9 |

60 Hz holds to ~90k live. Same-machine reference: the user's modified
WebGPU-Ocean (pure MLS-MPM, 2 substeps/frame) runs 100k at 120 fps
(~4.2 ms/substep) and 1M at 20-30 fps — ULG's equal-N gap is now ~4.3x
(was ~10^4 at the start of the night) while still rebuilding the spatial
epoch/directory/exact-near tree per step and running contact admissible
traversal, separation, and receipts.

The two structural lessons, now enforced in code:
1. **Capacity-tier constructions must be consumer-gated.** The
   phase-volume sidecars (multi-GB field-scale arenas) wedged the lane at
   the 262144 tier; the mechanics field view's candidate sort was 34.2
   ms/step at the 131072 tier with zero consumers in bulk. Both now build
   only when a consumer exists; any consumer that disagrees fails closed.
2. **Boundary conditions are explicit inputs.** Ambient pressure was an
   implicit atmosphere via wall-ledger feedback; it is now a declared
   knob, and "explicit vacuum" is the provable condition that admits the
   fused path and releases buoyancy's field-mode demand. (A first attempt
   to skip buoyancy by phase-reachability was rejected by the suite —
   mechanics-only continuations can already hold gas carriers — and
   reverted.)

Remaining to the plan's Phase A acceptance (100k at 60 Hz): the contact
graph build (~15 ms/step at 104k proving zero contacts — needs either the
envelope-watch sweep bound or Tier-2 scoping), fused-kernel cost (~10 ms
at 104k incl. separation), and M4 burst encoding for the per-step floor
(~9 ms at small N). Known gap: contactSolver=0 hangs worker admission —
the canonical lane cannot yet run contact-free; Tier 0 ultimately wants
that fixed rather than the floor-budget workaround.

## M4 results (day 2, 2026-08-28): the submit burst

M4 landed as **queue-ordered deferred submission**, not K-substep kernel
fusion: `armWorkerQueueSubmitBurst` (webgpuComputeLayout.js) wraps the
worker device's `queue.submit` / `queue.writeBuffer` /
`queue.onSubmittedWorkDone` / `device.createBuffer` once, and an open
burst holds finished command buffers and flushes them as one submit.
Queue order is preserved **by construction**, not by call-site audits:

- a `writeBuffer` whose target predates the last held submit (so a held
  command buffer may reference it) forces a flush first; targets created
  after it (the fresh-uniform pattern) pass through immediately;
- any `onSubmittedWorkDone` flushes first, so every fence a caller takes
  covers the work it believes was submitted (generation-retirement
  fences, drain checkpoints, the terminal fence);
- `destroy()` of a possibly-referenced buffer is parked until after the
  flush's real submit (WebGPU rejects submits referencing destroyed
  buffers); `deferSubmittedWorkCleanup` parks on the burst the same way.

Eligibility is DERIVED from the schedule's law-activation receipt — the
burst opens only when thermal, reaction, law-queue, neighbor candidates,
phase-volume migration, two-level mechanics, surface tension, and
actionable gas boundary are all quiescent, and never under timestamp
profiling or reflux receipts. The lease-latency lesson in
webgpuComputeLayout.js (thermal proposal arenas treat release latency as
correctness) is why law activity blocks the burst rather than merely
degrading it. The schedule result publishes
`submitBurstObservation` (eligibility, blockers, flush stats) next to the
law-activation receipt; sodium-water declares six blockers and never
opens. Knob: `?submitBurstSteps=K` → lane option
`mechanicsSubmitBurstSteps`; the bulk-water preset bakes K=8.

Measured (bulk-water worker lane, this hardware, 2026-08-28):

| live N | off ms/step | on (K=8) ms/step | delta |
| --- | --- | --- | --- |
| 1,008 | 8.56 | 8.00 | +7% |
| 13,832 | 9.20 | 8.61 | +6.5% |
| 32,776 | 12.11 | 11.72 | +3.3% (menu default; HUD later showed 94-117 steps/s) |
| 103,831 | 17.18 | 18.53 | **-7%** |

Findings, honestly:
1. **The submit-count hypothesis for the small-N floor was only partly
   right.** The census showed ~11 submits/step (epoch scaffolding 7,
   mechanics 4); collapsing to ~2/step bought 6-7%, not the 2-3 ms/step
   the 0.25 ms-per-indirect-dispatch figure suggested. Plain submits are
   cheaper than indirect dispatches; the remaining floor is per-step JS
   (generation build, stage payloads, seals) plus dispatch count.
2. **Write-through measured worse and is opt-in-off.** Converting stale
   writes into staging+copy held commands eliminated flushes (1.1/step)
   but ~21 arena-params writes/step became 21 staging buffers + encoders:
   11.4 ms/step vs 8.0 flushing at 1k. The code path stays (option
   `writeThrough` on open) with the measurement recorded at the site.
3. **At 104k the burst inverts**: the terminal fence lag flips from
   ~300 ms (GPU running behind the encode loop — healthy pipelining) to
   ~2 ms, and the loss moves into inter-schedule turnaround. Holding
   submits at large N removes useful encode-ahead. Un-diagnosed beyond
   that; raise `basen` past ~64k and turn the knob off.
4. Flush cadence is bounded by the per-step generation-retirement fence
   (~1/step) plus ~3.8 stale-write flushes/step from three persistent
   arena params buffers (`active-node-params`,
   `spatial-mechanical-expectation`, `active-source-view arena params`).
   Making those fresh-per-step (or giving retirement a lazy fence pool
   sized ≥ K+1 arenas) is what a true K-step-held burst needs — that and
   the deeper Ocean-shape (K substeps inside one epoch, which the epoch
   recon proved safe for plain canonical V1 geometry but which the
   exactly-once epoch transaction, the single-use contact proposal, and
   the strictly-advancing per-step seals all structurally forbid today)
   remain the two candidate next rungs, to be re-ranked against the
   contact-build and fused-kernel rocks by measured ceiling.

## THE Phase-A finding (day 2): the canonical lane freezes bulk liquid

Dam-break test, 2026-08-28: the same laws-quiescent water block run on
both routes at identical knobs (sdt=1ms, EOS+viscosity on, vacuum
ambient).

| route | 4,096 particles | 32,768 particles | physics |
| --- | --- | --- | --- |
| canonical SS worker lane (ss=1) | ~135 steps/s | ~85 steps/s | **rigid — still a pristine cube at sim t = 8 s** |
| pre-Schroeder fused sequence (ss=0) | ~3,800 steps/s (completion ewma 9.1k) | ~1,700–2,100 steps/s (ewma 5.7–6.0k) | **collapses into a rippling pool; ~2–4x FASTER than real time** |

Two facts follow:

1. **The canonical lane's water is not fluid.** A lattice-seeded block
   never develops the hydrostatic pressure gradient that drives collapse:
   the load path goes straight down the particle columns, and the
   canonical contact machinery's repel-only rest-distance projection
   (16 cleanup passes/step) undoes densification every step, so density
   stays at rest, EOS pressure stays ~0, and nothing ever pushes
   sideways. The ss=0 route — whose generic separation passes are also
   repel-only but far weaker — collapses correctly, which localizes the
   freeze to the canonical contact/cleanup stack (mechanism hypothesis;
   per-stage falsification is the next diagnostic). Consequence: every
   night-1 rate above was measured on rigid water, and the honest
   equal-physics gap is not 4.3x to WebGPU-Ocean — it is **~45–67x
   between ULG's own two routes** (85 vs 5,700 at 32.8k).
2. **Ocean-class bulk speed already exists in-tree** (the v8 fused
   sequence runner: K steps, one encoder, ping-pong, no per-step epoch
   rebuild, no contact graph, no receipts). Tier 0's real meaning is now
   concrete: the adaptive-laws router should DROP laws-quiescent bulk
   onto this path inside the canonical lane — activation receipt as the
   admission evidence, envelope-watch triggers lifting back into the
   full epoch/contact machinery when laws or genuine contact demand it.
   That is the architecture the plan's tiers described, and the two
   routes' measured spread is the prize.

Landed with this finding: the `water-realtime` menu preset (36,864
particles, dam break + 16^3 drop, ss=0) — the VISIBLE demo: block
collapses from the first frames, ~1.7–2.1k steps/s (~2x real time),
~30 render fps. `bulk-water` stays the canonical-lane Tier-0 acceptance
arm (rates, receipts — not visuals) until the router exists, then
water-realtime flips back to ss=1 as its acceptance arm. Preset suite
repaired: the night-1 bulk-water addition had silently broken
tests/sphPhaseScenarioPresets.test.mjs (never run that night); the suite
now asserts the standard-matrix subset separately and pins both
adaptive-laws presets' declared deviations.

Phase-A queue, re-ranked by this finding:
1. Falsify/confirm the freeze mechanism per-stage (contact proposal off
   vs cleanup passes vs canonical separation substitution), then make
   bulk liquid flow on the canonical lane — either contact-exempting
   homogeneous-liquid pairs (grid+EOS owns liquid volume, as Ocean) or
   fixing contactSolver=0 admission (the KNOWN GAP).
2. Tier-0 routing: canonical lane drops to the fused sequence under the
   activation receipt (the 45-67x).
3. The M4 burst next rungs and the 104k turnaround regression, re-measured
   AFTER 1-2, since flowing water changes every cost profile.
