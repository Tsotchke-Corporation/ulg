# Direction note 5: scale-adaptive law activation (the target execution architecture)

Source: `plan/todo/scale-adaptive-law-activation-plan.md` (981 lines, written
2026-08-27 "from a design conversation following the real-time campaign").
Read by Hermes, 2026-11-17: lines 1-330 (the design, the inventory, the phases,
night-1 milestones M1-M7 and the first M7 increments). Lines 331-981 (later M7
increments and status) are left to the reader slice.

`greenfield.md` section 4 and the Eshkol plan both point here. This is the
document that says how the runtime is supposed to execute, and A1, G4, G6, A3,
A4 and the "more SS levels" part of A5 are its phases under other names.

## What it is (`:3-21`)

"the target execution architecture for the ULG runtime: a bulk substrate that
runs at pure-MLS-MPM speed, with expensive laws activated only where and when
conditions demand, on scoped regions or statistical samples, extrapolated
elsewhere through cached closures — across every level of the continuous SS
tree, without stalling the simulation while derivations run."

"This is not a new architecture. It is the v0.4 Star Spec's stated design ...
given an execution order the current implementation never had. The current
implementation is the eager inversion of the spec: every law family runs on
every carrier every millisecond regardless of activity".

Measurements behind it (2026-08-27, sodium-water, 152 live particles):
172 compute passes, ~30 submits and ~31 ms of structure per step "while the
contact latch is idle and zero products exist". "the *intercept* is the
scandal, not the slope": the per-step floor is N-independent. The MPM core is
~2 ms of it. "The receipts/fail-closed discipline is NOT the cost: the contact
owner runs 512 logical passes in one dispatch with in-kernel evidence
synthesis".

## Two unifications (`:36-65`)

1. **"The cache miss IS the trigger."** A law is needed "when the bulk path's
   closure lookup exits its validity envelope". There is no separate
   trigger-detector subsystem. "Trigger soundness rule: envelope tests must be
   conservative supersets (erring toward activation), with the error bound
   declared". This is the Law Adapter Contract's admissibility field.
2. **"Vertical escalation is horizontal sparsity, rotated."** "An SS node at
   level L is an aggregate of L-1 and a 'particle' to L+1. 'Run the expensive
   law on a scoped region' (horizontal) and 'descend to a deeper substrate'
   (vertical, the spec's escalation ladder) are one operation." A region
   outside every cached EOS envelope descends: "run electronic structure on a
   *sample*, derive the response closure, cache it, resume at continuum scale.
   QED at the bottom of the ladder is not a per-step cost — it is the rarest,
   deepest cache miss."

This second point is the clearest statement of why SS matters to the
destination: the tree is not only spatial acceleration, it is the axis along
which the runtime changes substrate.

## Non-blocking derivation and extrapolation debt (`:67-107`)

"The sim does not stop the world while an expensive law or derivation runs."
Per-law fallback policy: `strict` (stall until the closure lands), `async`
(free-run on extrapolation, record debt, adopt at the next boundary), `frozen`
(never derive; clamp).

- Debt receipts: out-of-envelope steps are declared, "WARN-class, never
  silently promoted to PASS".
- Logged adoption only at schedule boundaries: "No mid-step or mid-schedule
  mutation of a closure a kernel may read (same immutable-epoch rule as the
  spatial generation)."
- Forward-only conservation: discrete-event laws conserve exactly because
  "their ledgers are transactional".
- Derivation venues, in adoption order: CPU oracle workers; PeerCompute-leased
  warm hosts and remote peers; same-GPU low priority last, "because GPU-process
  contention is measured and real".

## The closure store (`:109-134`)

"Closures are keyed by **regime**, not by scenario". Stored nondimensionalized
where the physics is scale-similar, "so one derivation serves multiple tree
levels across the ~40-orders-of-magnitude span (per-level charts handle f32
range; scale-free closures handle reuse)". Tiers by time to derive: lookup
table (ns) ← fitted response (µs) ← sampled law run (ms-s) ← full substrate
descent (minutes to hours, possibly remote). "Each miss at one tier is a
request to the tier below."

## The tier architecture (`:136-162`)

| Tier | What | Target shape |
|---|---|---|
| 0 | Bulk substrate, always on, all N, real time: fused MPM core, uniform external fields, walls, closure *lookups* only | "<=10 passes and 1-2 submits per step, K steps encoded per submit with a GPU-side step loop (the authority model already commits per schedule, not per step — per-step host orchestration is not required by the design)". "Per-level: every occupied tree level needs its cheap propagator" |
| 1 | Envelope watch, O(active nodes): per-node law-activation masks; the law queue already has this shape | "decide on GPU, latch the dispatch, synthesize the receipt — no host readback" |
| 2 | Scoped invocation, O(active region): activated laws iterate triggered nodes' CSR members only | Fixed admission envelopes (the contact owner's ≤ 1,024 participants) "become correct semantics rather than scaling walls" |
| 3 | The closure factory: for homogeneous regions, run the law on a sample, fit a response closure with its envelope, apply region-wide by lookup, invalidate on exit | "Homogeneity tests are part of the closure's validity, not optional." |

## Honest inventory as of 2026-08-27 (`:164-179`)

Runtime: node-aggregated bulk mechanics; admissible near-field traversal; the
on-GPU conditional-with-receipt pattern. Exists but unused or partial: the
fused mechanics runner ("bypassed on canonical route when gas boundary on");
the far-aggregate chain ("Built, quarantined, dormant; no mounted pairwise
long-range law yet"); the law queue ("used as allow-gate only"); the
envelope-exit signal ("Miniature only"). Missing: runtime
sample→derive→cache; the regime-keyed closure store; "3+ tree levels";
async adoption receipts.

## Phases and gates (`:181-201`)

- **Phase A**: "A scenario at N >= 100k live particles with all laws quiescent
  sustains 60 Hz on current hardware. Forces step fusion, K-steps-per-submit,
  and true zero-cost-when-inactive ... This is the floor: sparsity buys nothing
  while an idle step costs ~30 ms of structure."
- **Phase E** (early): closure-store schema.
- **Phase B**: envelope watch gates existing law stages at node scope, with
  receipts.
- **Phase C**: scoped invocation.
- **Phase D**: the online closure factory with the three policies.
- **Level track (parallel)**: "multi-level tree per sol-critic Priority 3
  gates; each new level multiplies the value of Tiers 1-3."

Prohibited shapes (`:203-214`): no second scheduler; no silent extrapolation;
no knob-tuning governor; no mid-run variant generation ("the capacity-family
compile storms are the cautionary tale"); numerical policies are not laws.

## Night 1 and after (`:216-330`)

M1 `bulk-water` scenario at ≥ 100k; M2 structure census; M3 fused mechanics on
the bulk route; M4 K steps per submit; M5 60 Hz hunt; M6 closure-store schema;
M7 envelope watch. M7 was implemented "as a shadow observation, not the
originally proposed routing gate": "The gate remains intentionally disabled."
Its gate string then:
`disabled-until-contact-thermo-phase-envelope-schedule-auth-and-1-to-4-carriers`.
A deterministic Tier0 N → canonical 4N carrier expansion exists
(`terminal = phaseLane * N + source`).

## The campaign, read as this plan's phases (Hermes, INFERRED)

| This plan | Campaign name | State per Hermes's other notes |
|---|---|---|
| Phase A, Tier 0 | A1 (real-time substrate; "≥ 100k quiescent carriers") | water-realtime runs in real time on the Tier0 route; presets with active laws run the canonical lane at 20-60 steps/s |
| Phase B, Tier 1 | G4 (laws idle where nothing happens) | Exact thermal and reaction dormancy by default; workgroup compaction outstanding |
| Phase C, Tier 2 | G4 / A1 | Not identified as built |
| Phase D, Tier 3 | G6, A3, A4, then A6 for remote venues | G6 fit/cache logic; A3 sampler on GPU with no in-step consumer; A4 evaluator with one consumer |
| Phase E | G6 groundwork | `closureRegimeStore.js` exists |
| Level track | A5 "additional SS levels"; first-class air | Chain phase A of five |

Two consequences for how the campaign fits:

1. A1 is not "make it faster" in general. It is Phase A: a Tier 0 whose idle
   step costs almost nothing, so that Tiers 1-3 can pay off. The campaign's
   A1 slices so far removed waiting (presentation holds, audits) from the
   canonical lane; they did not change the eager structure this plan names.
2. A3 and A4 are Tier 3. They only reduce cost when a law reads the closure
   instead of running per particle, and when the envelope watch (Tier 1) says
   where it is valid. Without those two connections they are components.
