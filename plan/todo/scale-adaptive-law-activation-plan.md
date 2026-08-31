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

#### M7 second increment (2026-08-29): motion envelope + route parity

Implemented as a shadow observation, not the originally proposed routing
gate. A sealed `K`-step envelope now inflates the terminal reactant-pair watch
for CFL-bounded travel, separation displacement, rule radius, and
absolute-coordinate f32 position-store rounding. Canonical discovery remains
the exact mutation input, but observation has moved off that pre-reaction
family. After closure publication, a standalone canonical producer
authenticates the exact terminal state/thermo/mechanics buffers, rebuilds
fixed-slot bins, and emits the v1 four-byte observation in one compact
additional submission. Tier0 emits the same ABI from its terminal
post-separation family inside its existing sole submission. Both observations
are consumed after the one schedule-terminal fence.

The terminal family is intentionally split by its actual last writers:
phase-carrier transfer owns state/thermo; the following constitutive refresh
owns mechanics when it runs, and phase transfer owns mechanics otherwise. A
shared branded selector now supplies both publication and compact summary, so
partial phase output and no-op reaction buffers cannot produce different
terminal families. GPU publication, CPU full-readback mirrors, source-stage
provenance, resident authority, and the terminal watch agree on that
precedence. Two-level pre-terminal compact diagnostics are marked superseded
when a terminal sidecar changes the family.

Storage adoption is complete-family only and carries its exact authoritative
count and buffer byte lengths. Compact summary fails closed for all such
adoptions, even same-count adoption, because the current ABI has neither
separate source/terminal counts nor a stable identity/slot correspondence for
displacement and cohort comparison.

The gate remains intentionally disabled. Before M7 can satisfy its original
acceptance arm, it still requires deterministic one-to-four carrier
materialization, including a source/terminal-count ABI and stable carrier
correspondence; authentication of the target schedule's exact `K`/`dt`/grid/
CFL/separation/box request; proof that Tier0 could not omit a required watch;
and closure of contact-motion, thermal/phase activation, and remaining numeric
guards. The present source domain is fixed phase-carrier slots, not general SS
aggregate nodes. Malformed evidence remains trigger-positive and cannot
disable a law. The exact gate string is
`disabled-until-contact-thermo-phase-envelope-schedule-auth-and-1-to-4-carriers`.

The canonical contact counterexample is now enclosed by the fourth increment
below. The strongest remaining reachability counterexample is temperature or
phase evolution: it can satisfy an activation predicate without particle
motion and can increase the rest-volume/clearance scale used by a later
contact bound. That activation path must be enclosed before a zero may route
the next schedule away from canonical law work.

#### M7 third increment (2026-08-29): deterministic Tier0 N -> canonical 4N

Implemented the topology transition without enabling the dynamic routing arm.
An exact one-lane Tier0 continuation now expands on the worker GPU before the
canonical loop when the next schedule's static declaration activates thermal
or reaction work. One compute submission publishes complete 4N state, thermo,
mechanics, and identity buffers with no particle readback. The primary lane is
an exact copy; three fixed reserved lanes use zero mass/velocity and status
`254` while retaining the source position, specific energy, template data,
and render-domain cohort identity.

Carrier correspondence is explicit and deterministic:
`terminal = phaseLane * N + source`, with inverse `source = terminal % N`.
The identity field remains the existing `renderDomainId:u32`; it is duplicated
across lanes and is not misrepresented as a unique carrier id. Kernel,
correspondence, source/terminal identity revisions, exact buffer byte lengths,
and the `storageGeneration + 1` / `topologyEpoch + 1` transition are all
published in the clone-safe worker receipt.

The materializer fails closed before allocation or adoption on torn schemas,
counts, plan copies, lineage, identity ABI, byte lengths, buffer device/size/
usage, device limits, and aliases. A WebGPU validation error scope covers
construction through submit; a submitted invalid publication stays owned
until terminal-fence cleanup instead of escaping through an exception. The
old N family is pinned until the schedule terminal fence, auxiliary material
buffer ownership is explicitly transferred, and the first canonical epoch
must seal the exact new topology lineage.

The final ownership pass makes that transfer durable across later canonical
continuations: all material-property-bank sidecar references propagate with
their row counts and transfer transactionally, while rejected adoption rolls
back both auxiliary and identity ownership. Retirement authority now comes
from cleanup evidence that names every old core buffer after any asynchronous
cleanup completion. Materializer bind groups use exact live byte ranges, and
the topology attestation's identity ABI is cross-bound to the transition
source identity metadata.

If a later canonical predecessor cleanup throws after the successor received
those owners, the worker keeps the previous committed lane state, quarantines
the submitted successor on a poisoned record, and blocks reuse. Explicit lane
retirement reaches both owner families after the schedule terminal fence; it
never rolls ownership into a possibly partly destroyed predecessor.

The execution-route receipt advanced to v1. Outer admission now proves the
source and terminal counts across all four state/upload descriptors and the
terminal step, requires terminal count `4*N`, and exact-validates identity,
byte, kernel, validation, ownership, lineage, retirement, submit, readback,
and routing fields. The compact-summary ABI remains same-count v0: because the
prepass runs before canonical work, its source and terminal are 4N -> 4N and
the historical distinct-count rejection stays intact.

Native Vulkan evidence executes N=2 twice with bitwise-identical output,
unchanged source buffers, and exact reserved companion rows, then feeds the
result into the existing conservative phase-transfer kernel. Full Node and
production-build gates pass.

Leaf schedule-route evidence schemas and validators now live in
`schroederWorkerScheduleRouteEvidence.js`, with the existing worker-lane
control-plane module retaining the public facade and all orchestration and
commit authority.

Outer admission also requires the exact one-to-four proof whenever a claimed
Tier0-to-canonical boundary statically activates thermal or reaction work.
The same-count transition label is reserved for non-phase activation and
cannot be used to launder deletion of the topology proof.

This removes `1-to-4-carriers` as an implementation blocker. The fourth
increment below also closes the contact-motion subgate, but the existing gate
string remains the stable cumulative identifier: thermal/phase activation,
target-schedule authentication, Tier0 omission proof, and numeric fail-closed
guards remain open. Until they close, the watch remains shadow-only with
`routingAuthority:false` and cannot select the next schedule.

#### M7 fourth increment (2026-08-29): canonical contact motion bound

The motion envelope now imports the canonical solver's exact 16-diameter
position trust factor and tolerance from one shared leaf contract. With
upward-rounded CFL travel `A`, maximum active terminal rest diameter `D`, and
a conservative wall-shell transition `W`, the enabled per-particle bound is
the maximum of `A+W`, `A+0.5D+2W`, and
`16D+2A+3W+max(1e-6,64*epsilon*max(capacity,1))`. Two endpoints and `K` are
applied once; Jacobi iterations, cleanup passes, and inner rounds all consume
the same absolute epoch trust ball and do not multiply the allowance.

Envelope v1 exact-binds f32 box dimensions, separation/contact mode, trust
revision and numeric constants, active-terminal physical-box membership, and
the requirement that future rest diameter not grow beyond the terminal upper.
Both GPU producers carry those fields in the same 96-byte uniform. Contact
mode reduces `D` even when generic separation is off; invalid boxes, outside-
box active rows, one-ULP producer/envelope drift, overflow, and forged receipt
fields fail closed through the existing sentinel or pre-encode rejection.

The worker derives separation/contact mode from the schedule's static law
receipt. The raw and outer observations advanced to v2, but retain the same
three passes, single four-byte boundary map, Tier0 submit count, canonical
compact submit, false routing authority, and exact execution-gate string.

This increment closes canonical contact motion only under its declared stable
rest-diameter premise. Thermal/phase evolution is deliberately not laundered
through that premise; it is the next subgate. Full target-request
authentication is also still absent, so two internally valid worker-produced
envelopes with different target parameters are not yet routing authority.

#### M7 fifth increment (2026-08-29): thermal/phase false-zero closure

The exact sealed envelope has advanced to v2, with raw observation v3 and
worker observation v3. The worker seals
`thermalPhaseEvolutionEnabled:true` whenever
`scheduleLawActivation.thermal || scheduleLawActivation.phaseVolumeMigration`
is true. A general
`scheduleStepOptionsProvider` is conservatively treated as another possible
writer unless it is the known provider branded in
`workerLaneAssignmentOnlyScheduleProviders`; only that assignment-only
provider may retain the static no-writer path.

When the latch is true, the dedicated canonical and shared Tier0 GPU watchers
count every fixed carrier slot trigger-positive before terminal mass,
material/phase, temperature, or reference volume `V0` is consulted. The
existing selective motion-inflated predicate remains available for a
statically laws-quiescent horizon when the latch is false. This is deliberate:
phase-volume merge is an independent `V0`-growth writer even if no thermal
table exists, so terminal inactivity or distance cannot prove a future zero.

This closes the thermal/phase/rest-volume false-zero class conservatively. It
does not supply a numeric upper bound on future diameter and it does not make
thermal/phase evolution selective. Any later selective bound must be derived
from lineage-total mass and minimum reachable density, not the maximum mass or
diameter of one terminal carrier slot, because phase writers may redistribute
the lineage among the fixed slots.

The watch remains `shadowOnly:true` with `routingAuthority:false`. Its exact
cumulative gate remains
`disabled-until-contact-thermo-phase-envelope-schedule-auth-and-1-to-4-carriers`.

The next priority is independent main-thread authorization of the target
schedule and full writer set, including dynamic-provider identity and
thermal/phase/reaction table fingerprint drift. Tier0/watch omission,
numeric fail-closed, and device-loss gates follow that authorization.

Verification for this increment is complete: focused schema/watcher/worker/
outer suites ran `514` tests (`511` passed, `3` expected opt-in skips);
dedicated/shared native GPU execution passed `2/2`, including a
current-state-ineligible dynamic-latch case; the full Node suite ran `3066`
tests (`3015` passed, `51` expected opt-in skips, zero failures); and the
production build plus `git diff --check` passed.

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

## The freeze root cause (day 2, second leg): the unfinished V1→V2
## directory-consumer migration

The per-stage falsification overturned the contact hypothesis: removing
the contact stage entirely (the new explicit contact-free mode) left the
cube rigid at +50% rate. The observe instrument (per-step authority
evidence readback + directory header dump, now permanent under
`?observeSpatialAuthority=1`) then walked the whole chain down:

1. **The canonical mechanics authority gate rejected EVERY step and the
   global fail-closed finalize rolled all mechanics back** — silently
   (production reads no evidence), with commits, seals, and sim-time all
   advancing. Every canonical-lane scene ever measured ran rolled-back
   (frozen) mechanics on the plain/compact routes; only the field-view
   path (sodium) escaped, because its ActiveSource validation replaces
   this gate entirely.
2. Three seams of one unfinished V1→V2 directory ABI migration caused the
   rejection, each individually sufficient:
   - **Version pin**: the consumer gates required header version 1;
     every live directory stamps version 2 (both producers). Any v2
     directory failed word 1 outright.
   - **Reverse-map encoding**: v2 writes `cell_index + 1` (zero =
     dormant sentinel); the consumers decoded raw — rejecting the whole
     final cell's occupants and silently shifting every other lookup by
     one cell (masked in single-level runs).
   - **Query-geometry offset**: the builder writes the 6-word query
     profile at `particle_to_cell + capacity`; the consumers read at
     `+ live count` — a zeroed gap whenever live != capacity. Fixed by
     locating it from the physical high-water word (47) minus its size,
     which is correct for both layouts.
   - Feeding (3): the host's exact-near query-profile gate still had the
     migration's old `no GPU-authored logical count` exclusion, so every
     product-carrying lane built directories with mode GENERIC and no
     query words at all. The WGSL side of that exclusion had already been
     removed by the v2 assembly — the host half was forgotten.
3. After the four fixes: zero rejection counters, header + geometry
   admitted, and a sampled output row shows textbook free-fall with
   velocity accumulating across chained steps — canonical mechanics
   integrates and chains correctly for the first time on v2 directories.

Consequence for the tiers: the night-1 curve measured rolled-back
mechanics; every canonical rate must be re-measured against live physics.
The contact-solver and compact-view questions are now REACHABLE (they
were unfalsifiable while the rollback masked everything): the post-fix
canonical run with contact ON still holds the lattice rigid, so the
contact rest-distance projection question is back on the table as the
next per-stage falsification, together with the compact path's own
zero-evidence admission failure (bulk selects compact by default; the
explicit `compactMechanicsView=0` knob now exists to force plain V1).

## 2026-08-29 target-schedule authority slice

Completed:

- Main-authored original plus independently posted worker clone.
- Exact source schedule/lane/state, lineage, particle cardinality, 1/4 phase
  lanes, f32 K/dt/grid/CFL/box envelope, contact/thermal-phase modes, full law
  writer set, cross-level coupling, mechanics-field-pair V2, provider policy,
  and executing/dormant table/step-option binding.
- SHA-256 request/provider/table fingerprints, including canonical and Tier0
  reaction watcher immutable-authenticity fingerprints.
- Worker recomputation before route/encode; receipt v2 and observation v4 echo;
  retained-original outer comparison; exact StateManager persistence.
- Coherent-forgery, malformed-prelease, unsealed-provider, 1-to-4, and second
  four-lane schedule tests. Focused `118/118`; full suite zero failures.

## 2026-08-29 predecessor target-token slice

Completed for the serialized live scene/worker incarnation:

1. The scene predicts the exact next same-lane schedule id, retains the full
   admitted authority plus terminal observation, and embeds that observation
   in the successor's independently main-authored authority.
2. Main burns its dispatch claim, outer authority exact-rereads the prior
   committed StateManager issuance before lease acquisition, and the worker
   independently matches and burns its retained authority/observation before
   route selection or GPU work.
3. Worker route receipt v3 carries an exact consumption receipt. Outer
   authority binds it to the retained main values and persists both admission
   and consumption in the successor warm entry. An existing successor entry
   rejects sequential replay before acquisition.
4. Missing, replayed, torn, foreign, extra-key, state-loss,
   lineage/cardinality/topology, writer/provider/table, and coherent-forgery
   cases fail closed. Any ambiguous post-dispatch failure poisons the lane.
5. Lane/task/token identities include a fresh scene incarnation, and bridge
   replacement forces a fresh lane, eliminating the former counter-only warm
   task-id alias across scene rebuilds.

Scope boundary:

- This is one-use authority for the live serialized lane, not distributed
  exactly-once. The outer read is not an atomic StateManager reservation; a
  future cross-caller claim needs an issued -> reserved-by-consumer -> consumed
  CAS or immutable ledger.
- Worker or StateManager loss is non-recoverable. Persisted issuance is audit
  evidence and must never rehydrate worker GPU continuity.
- Prior/current writer, provider, table, and motion equality intentionally
  forbids a dynamic configuration transition while the observation is
  shadow-only. Before gate enablement, replace equality with an explicitly
  sealed prospective transition rather than weakening it implicitly.
- Triggered or uncertain consumption records
  `conservativeActivationRequired`; current route selection does not read it.

The next ordered slice is production dormant-watch provisioning:

1. Add a separately named `reactionActivationWatchTable` to the production
   laws-quiescent Tier0 schedule without making reaction executable.
2. Bind that dormant descriptor through the existing SHA-256 target authority
   and prove Tier0 cannot omit, replace, or drift the required watcher.
3. Exercise S0 issuance -> S1 consumption on the actual dormant production
   path, including zero, trigger, sentinel/uncertain, cancellation, and device
   loss.
4. Then close remaining numeric, overflow, storage-adoption, and device-loss
   gates. Keep the exact execution-gate string and `routingAuthority:false`
   until the entire list is verified.

## 2026-08-29 dormant-watch provisioning result

The first three provisioning requirements above are complete for the
laws-quiescent Tier0 worker route:

1. A positive scene reaction catalog crosses under the separate
   `reactionActivationWatchTable` name only when reaction execution is off.
   `reactionTable` remains null and a zero-count catalog remains absent.
2. The existing target authority SHA-256-binds the descriptor and exact
   `combinedRecords`; worker preflight independently recomputes it. Omission
   and record drift reject at step zero before GPU work.
3. The real worker Tier0 schedule emits the shadow observation and the next
   schedule consumes its exact predecessor token. Existing watcher tests cover
   trustworthy zero, trigger, sentinel, cancellation, and device-loss
   primitives; the end-to-end sentinel/uncertain S0 -> S1 path remains green.

Verification: focused `210/210`; full Node `3070` total / `3019` passed / `51`
expected skips / zero failures; build, syntax, and diff checks pass.

Next ordered work:

1. Audit and close NaN, nonpositive count, count/capacity mismatch, arithmetic
   overflow, and malformed-evidence paths so none can mint a false zero or
   usable successor token.
2. Close storage-family adoption/replacement plus cancellation, worker loss,
   and device-loss token lifecycle.
3. If dormant observation must work after another law already selects the
   canonical route, add that canonical dormant watcher explicitly; current
   canonical capture is intentionally tied to executing reaction.
4. Before any actual dormant-to-executing route change, replace exact
   prior/current configuration equality with a named prospective transition
   seal. Do not weaken equality or flip routing authority implicitly.

## 2026-08-29 numeric and canonical-dormant result

The numeric/count/capacity/overflow item is verified.

1. Watch, discovery, terminal-bin, target-authority, worker, and outer
   consumers now share exact positive capped counts, checked byte arithmetic,
   device-limit preflight, private-zero failure encoding, biased success
   counts, exact four-byte maps, post-map authenticity, and fatal lane
   poisoning.
2. Canonical schedules selected by another law can observe the separately
   authorized dormant reaction table without activating reaction execution.
   An exact empty executable table yields to the dormant table; positive or
   malformed executable tables retain precedence and cannot be laundered
   through the fallback.
3. Direct single- and authoritative two-level tests pin the execution/watch
   separation and terminal-family bindings. Outer admission accepts an
   uncertain authority-bound canonical dormant observation while preserving
   `lawActivationReceipt.reaction:false`.
4. Full verification is green: `3080` Node tests, `3029` passed, `51` expected
   skips, zero failures; build, syntax, diff, refreshed ICC stores, and scoped
   guard-diff pass. Native rerun remains blocked by the known Chrome/Dawn
   external-Instance failure, not a watcher assertion.

Next ordered work:

1. Repair and verify concurrent observe/destroy ownership, including the
   canonical successful-map release path and rejected-map quarantine.
2. Prove storage-family replacement/adoption cannot retarget an in-flight
   watch or publish evidence from a superseded family.
3. Exercise cancellation, worker loss, and device loss through S0 issuance and
   S1 token admission; no unproven observation may survive or replay.
4. Keep `shadowOnly:true`, `routingAuthority:false`, and the exact existing
   execution-gate string. Prospective dormant-to-executing transition authority
   remains a later, separately sealed item.

## 2026-08-29 storage and loss lifecycle result

The final reaction-watch hardening item is verified without enabling routing.

1. Watch proposals are opaque records bound to the exact device, terminal
   state/thermo/mechanics storage family, and particle count. Worker capture
   authenticates that family before and after map; two-level producers rederive
   the exact adoption or closure-continuation family at the watch site. A
   superseded predecessor proposal rejects before map, releases, poisons the
   lane, and cannot issue evidence.
2. Concurrent observation, completion, destroy, and fallback-fence orders now
   converge on one exact release. Successful maps release owned buffers once;
   rejected maps quarantine only unreleased proposals; late stale-fence failure
   cannot convert a released proposal into quarantine.
3. Partial cancellation can issue only unmeasured conservative uncertainty
   with null raw evidence and zero map/readback activity. Forged successful
   cancelled evidence rejects before completion/commit. The authentic token is
   consumed once by S1 and replay rejects before GPU work. Existing restart
   coverage keeps worker loss non-recoverable from StateManager audit state.
4. Device loss during pending map is terminal: no result/token escapes, the lane
   is poisoned, all watch-owned buffers retire exactly once, lane reuse fails,
   and explicit release followed by replacement-device reseed succeeds.
5. Full verification is green: `3089` Node tests / `3038` passed / `51`
   expected skips / zero failures, with watcher `33/33`, worker `55/55`, control
   `25/25`, hierarchy `175/175`, and MLS-MPM `221/224` plus three expected
   skips. Build, syntax, diff, refreshed ICC stores/history, and scoped guard
   pass. Native WGSL remains blocked before device creation by the known
   Chrome/Dawn external-Instance failure.

The next ordered work is no longer watcher lifecycle. Define and authenticate a
prospective dormant-to-executing configuration transition, retain exact prior
and target seals on both sides of S0 -> S1, and run a separate enablement audit.
If consumers expand beyond the serialized scene lane, add an atomic issued ->
reserved-by-exact-consumer -> consumed StateManager protocol first. Until that
work is verified, retain `shadowOnly:true`, `routingAuthority:false`, and the
exact gate
`disabled-until-contact-thermo-phase-envelope-schedule-auth-and-1-to-4-carriers`.

## 2026-08-30 retained-product S1 -> S2 transition result

The next prospective-transition increment is complete in shadow-only mode.

1. Target-schedule authority now carries an explicit, SHA-256-authenticated
   `retained-product-gas-boundary-inactive-to-actionable` transition. The
   source and target keep reaction execution active, change only the
   gas-boundary writer from inactive to actionable, retain mechanics field
   views, and cap both schedules at one future substep. Exact source/target
   schedule ids, table/envelope continuity, writer evidence, and transition
   fingerprint are sealed rather than inferred from the successor.
2. S1 pre-seals the target after a terminally fenced retained-product arena.
   The worker authenticates the exact arena identity and four-byte live-count
   observation before admitting S2. StateManager and worker token burns occur
   before lease acquisition, route selection, dispatch, or GPU work. S2 uses
   the one-step prospective bootstrap; S3 returns to exact-configuration
   continuation. Replay, cancellation, identity drift, writer drift, and
   post-dispatch ambiguity remain fail-closed.
3. The reaction-motion watcher now compiles one WGSL entry point per driver
   module and avoids the NVIDIA compiler failure caused by the former combined
   module/dynamic-division shape. The real sodium and Cesium native runs no
   longer crash `libnvidia-gpucomp.so`.
4. Worker evidence exports only a fixed-size clone-safe retained-product
   summary. A zero-live product arena is not mislabeled as a rendered product:
   it qualifies only with an authenticated exact-zero readback, matching arena
   generation/seal/bytes, an explicit unbound zero-byte render receipt, the
   consumed S1 -> S2 transition, and either the exact P2G route or the fully
   sealed-absent two-level P2G tuple. Missing render evidence stays null and
   fails the visual gate.
5. Verification is green: focused transition/watcher/worker/scene/native-
   harness suites `229/229`; full Node `3098` total / `3047` passed / `51`
   expected skips / zero failures; production build and `git diff --check`
   pass. Final headed NVIDIA/WebGPU receipts pass for water (`583` physics and
   presented steps), iron/ice (`213`), sodium/water (`460`), and
   Cesium/fluorine (`262`), each over at least 60 seconds with zero browser or
   GPU issues. The actual initial/intermediate/final PNGs were inspected.

Scope remains exact: `shadowOnly:true`, `routingAuthority:false`, and
`disabled-until-contact-thermo-phase-envelope-schedule-auth-and-1-to-4-carriers`.
This slice proves transition authority and execution continuity; it does not
turn the shadow observation into production route authority.

Next ordered work:

1. Preserve the already-available terminal reflux `firstRejectedDiagnostic`
   in the visual receipt, trace Cesium with `stageMechanicsTrace=1` around
   schedule 350, fix the first two-level arithmetic producer of the three
   nonfinite rows, and add a greater-than-350-step Cesium regression. Do not
   weaken terminal admission; the current late-horizon rollback is correctly
   fail-closed and occurs beyond the green bounded 300-step qualification.
2. Run the separate enablement audit for the now-authenticated S0 -> S1 and
   S1 -> S2 transitions. Prove every contact, thermo/phase, envelope,
   schedule-authentication, and 1-to-4 carrier prerequisite before changing
   either routing field or the exact execution-gate string.
3. If consumers expand beyond the serialized scene lane, implement atomic
   StateManager issued -> reserved-by-exact-consumer -> consumed authority
   before any broader routing rollout.

#### M7 final reaction increment (2026-08-30): authenticated route enablement

The configured reaction arm now satisfies the original M7 schedule-boundary
acceptance on the serialized scene/worker lane. Policy is explicit tri-state:
`disabled` is hard user-off, `shadow` observes the fully authenticated route
while preserving static execution, and `authoritative` starts a positive
reaction catalog dormant. The default is still `shadow`; only an explicit
authoritative request can provision the dormant watch and route its successor.

The first authoritative schedule executes no reaction stage. It carries the
separately authenticated watch table and can issue only a trustworthy zero,
trigger-positive, or conservative-uncertain observation for its pre-named
successor. Triggered/uncertain evidence pre-seals a prospective
reaction-dormant-to-executing transition. Main, StateManager, outer lane
authority, and worker retain and consume the same one-use request and
transition fingerprint before lease acquisition, route selection, or GPU work.
The scene sets a persistent active latch only after the canonical successor,
reaction writer, queue fence, StateManager commit, and every consumption
witness are exact.

The enabled composite tuple is now `shadowOnly:false`,
`routingAuthority:true`, with gate
`enabled-on-serialized-scene-worker-lane-after-contact-thermo-phase-envelope-schedule-auth-and-1-to-4-carriers`.
This authority belongs to the whole authenticated schedule route. A raw watch
word or materialization receipt cannot route independently, and cancellation
or ambiguous completion cannot mint a replayable successor.

Activation also proves its topology. A one-lane Tier0 source must publish the
already verified GPU-resident `N -> 4N` carrier family, with no map/readback and
an exact terminal-fence/retirement receipt. A pre-provisioned four-lane source
must stay `4 -> 4` and carry no materialization receipt. Native execution proves
the former; the sodium and Cesium configured presets prove the latter. Their
separately authenticated retained-product gas transition remains multi-step
(`K=64` sodium, `K=16` Cesium).

The visual acceptance layer now rejects the former control-body-preview stall.
It requires correlated physics and presentation progress, nonblank changing
pixels, schedule-1 dormant/watch-only evidence, a later exact active receipt,
persistent activation lineage, and retained product/gas or authoritative
two-level proof. Visible desktop Chrome passes for all configured presets;
mobile configured presets and three random element pairs are nonblank and
issue-free. Sodium sustained 1,920 correlated steps over 60.161 seconds and
Cesium 528 over 60.927 seconds with exact activation receipts.

Final cumulative gates: full Node `3125` total / `3074` passed / `51` expected
skips / zero failures; focused dynamic matrix `276` total / `275` passed / one
expected native opt-in skip; visual liveness `19/19`; visual sanity `19/19`;
formal visual receipt `25/25`; native carrier materialization `1/1`; native
reaction index `2/2`; production build and diff check green.

M7's reaction seed is therefore ready for the day-2 validation framework. That
framework should consume the exact route, activation, topology, retained-gas,
presentation, and visual receipts before adding new physics. Remaining work in
the broader architecture is not a hidden prerequisite: per-node routing for
other law families, distributed multi-consumer reservation, scoped invocation,
the online closure factory, and additional tree levels remain later phases.
Restore the earlier water-demo throughput after the refactor checkpoint, while
continuing periodic visible desktop preset sweeps during framework work.
