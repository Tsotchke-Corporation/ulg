# SS note 5: the SS worker lane and reaction activation (August 2026)

Source: `plan/refactor/handoff.md` (948 lines; "Updated 2026-08-31"; the lower
half is the 2026-08-23 original kept "for evidence provenance"). Read by Hermes
in full, 2026-11-17. This is where SS moved off the page thread, and where the
seven goals are first written down. Every campaign scene runs on this lane.

## What the refactor did (`:486-506`, `:236-258`)

Before: "SS physics used to run on the browser main thread: the page owned
epoch construction, command encoding, submission, presentation gating and a
full status traversal per step, and the next physics step could not start until
the previous frame had been presented."

After: "Eligible same-device interactive SS runs now default to a
worker-owned, GPU-resident schedule lane. The ordinary route no longer performs
SS hierarchy construction, mechanics orchestration, or per-step continuation
scheduling on the page thread." Its seal is
`residentComputeManagerMode = 'worker-owned-resident-lane'`.

First measurement (RTX 5060 Ti, water-cycle, 40 s; `:495-506`): direct route
~12 steps/s, worker lane ~32 steps/s; "1,280 steps across 80 chained 16-step
schedules, epoch seals monotonic throughout, no fallback seal, zero hot-loop
readbacks."

## Layer contract (`:260-287`)

`src/runtime/sph/schroederWorkerLaneControlPlane.js`,
`createSchroederWorkerLaneSequenceContract()`, one ordered DAG:

1. `schroederSpatialEpoch`
2. `schroederHierarchyMechanics`
3. `residentRenderCandidate`

"Each schedule obtains a ComputeManager GPU-resident lease. The presentation
worker executes the batch, proves `worker-device.queue.onSubmittedWorkDone`,
and returns retained buffer references plus compact hierarchy summaries. The
page authority ... completes the lease, commits one compact delta, and verifies
the StateManager warm commit before publishing the execution." "A commit
failure poisons the physically advanced worker lane so it can never continue as
split-brain state."

This is the PeerCompute authority path of the Triad spec in its only live
form: one lease and one StateManager delta per schedule, same device, one tab.

## Hierarchy and residency (`:289-314`, `:550-572`)

- "Seeding is the only structured-clone boundary for particle rows."
- Identity words are caller-supplied: `storageGeneration`, `physicsTick`,
  `physicsSubstep`, `positionEpoch`, `topologyEpoch`, `chartEpoch`,
  `levelEpoch`, `supportEpoch`. "the worker never invents lineage."
- "For every step the spatial stage builds the exact mechanics-grid view,
  including adjacent exact 2:1 grids for two-level execution. It creates one
  authenticated spatial-epoch transaction over that generation/source family
  and hands the same opaque transaction to same-level mechanics."
- "Two-level SS is supported in the lane." (The 08-23 original said the worker
  "is single-level only", refused with `w1-single-level-only`; `:656-657`.)
- "Batching is legal again because each worker step builds and seals its own
  epoch, so no generation is ever reused across a position epoch — the exact
  constraint that forced the old one-step throttle." Note the cost this
  implies: **one full spatial epoch per step**. A2 (incremental repair) and
  the larger-dt work both attack that.
- "Cadence is decoupled. Continuation issues from schedule completion, not
  from rAF".
- "Normal execution performs no full particle readback."

## Tier0 and the canonical route (`:73-181`)

- "Tier0 executes laws-quiescent batches on the fused one-lane substrate."
  Canonical is the full four-phase-lane route with every law family.
- Carrier topology: when a Tier0 continuation with N single-lane particles
  meets a schedule that activates thermal or reaction work, "one GPU submission
  deterministically materializes the complete canonical 4N
  state/thermo/mechanics/identity family"; `terminal = phaseLane*N + source`.
  "render-domain identity is duplicated across the four fixed slots and is not
  treated as a unique carrier id."
- Both routes publish the same motion-inflated four-byte reaction watch after
  their terminal particle family.
- "This is a fail-positive closure, not a numeric future-diameter bound or a
  thermal selector": when thermal or phase evolution is on, every carrier slot
  counts trigger-positive. Selective thermal activation was left as future
  work ("must bound lineage-total mass against minimum reachable density").

## Reaction activation is the one dynamic law that has routing authority (`:35-71`, `:905-910`)

"The public policy is exact tri-state: `disabled` is hard user-off, default
`shadow` observes the authenticated route while preserving static execution,
and an explicit `authoritative` request starts a positive reaction catalog
dormant. The configured sodium/water and Cesium/fluorine presets select
authoritative; water and iron/ice do not."

Enabled tuple: `shadowOnly:false`, `routingAuthority:true`,
`enabled-on-serialized-scene-worker-lane-after-contact-thermo-phase-envelope-schedule-auth-and-1-to-4-carriers`.

Limits stated in the document:

- "General per-node routing for other law families and distributed
  multi-consumer reservation are goals 4 and 5; do not broaden the current
  exact reaction-only enablement claim before their own authority contracts
  land."
- "This is one-use authority for the serialized live worker incarnation, not a
  global CAS claim". "A broader authority needs an issued →
  reserved-by-exact-consumer → consumed StateManager CAS/ledger." This is
  where G5 comes from.
- "The present source domain is fixed phase-carrier slots, not general SS
  aggregate nodes" (from the scale-adaptive plan; same work).

So G4's "per node" has a precise meaning: activation keyed on SS nodes rather
than on one schedule-wide watch word. What exists is schedule-level.

## The seven goals, first statement (`:18-33`, 2026-08-31)

"(1) restore at least real-time cadence across all six canned presets;
(2) finish physically coupled gas/phase transport so conserved condensate
produces truthful steam, mist, smoke, and aerosol; (3) deliver coherent solids
from SOL-0/SOL-1 onward; (4) generalize per-node dynamic-law activation;
(5) add epoch-fenced distributed multi-consumer reservations; (6) wire online
regime-keyed closure derivation and cache adoption; and (7) add an external
fuzzy scientific release audit."

"Goal 7 is deliberately outside runtime authority. ... Drift is a nonblocking
signal for human review, not a scheduler, admission gate, or claim that theory
and experiment must agree exactly."

G1's first wording is "restore": the six presets had real-time cadence and
lost it ("recover and generalize the earlier `water - real time dam break`
improvements across all canned presets"; `:945-948`).

## Costs and debts recorded here that are still live

- Contact: "`contactSolver=0` runs ~240 steps/s against ~45 with contact on,
  and the cleanup is active on 727 of 768 steps in a scene that is visually
  settled — either legitimate resting-contact maintenance or MPM and the pair
  solver disagreeing about equilibrium, which nobody has separated yet"
  (`:647-650`). "The sweep admission rate is still ~1 pair per 3 passes on
  serial chains. Chunking made that cheap, not fast. It is the algorithmic
  debt underneath the budget" (`:652-654`). The campaign's 25%
  ITERATION_INCOMPLETE on Iron Ice impact and the deferred "contact-owner
  redesign" are this debt.
- Selective contact-law admission
  (`plan/todo/selective-contact-law-application-plan.md`): "Designed ...,
  unimplemented."
- Cesium-fluorine fails closed at schedules 350-356 with a nonfinite rollback;
  "Do not weaken terminal admission" (`:893-903`).
- Strict TypeScript control plane: proposed, untouched.

## Traps (`:661-686`)

- "Never add a readback to the lane. `normal_hot_loop_readback_free` is a
  blocking campaign event".
- "Don't let the worker invent lineage. ... the class of bug this codebase has
  paid for three times."
- "Probe with `ss=1`. The default probe URL does not exercise SS; a green
  suite and a clean production probe once shipped a change that broke every SS
  run."
- "When a visual and a checkpoint disagree, suspect the render." (the
  `renderSmearDtS` wall-clock bug: "Two days of 'the physics is broken' were
  this".)
- "Real visual proof means visible desktop Chrome on the actual display."
  **Superseded** by the owner's later rule: headless only, no visible windows.

## For the campaign (Hermes, INFERRED)

1. The lane is the substrate A1 has to make real-time. Its per-step shape is:
   build and seal one spatial epoch, run mechanics on it, publish a candidate.
2. Law activation exists at three strengths: reaction is authoritative per
   schedule on two presets; thermal/phase is fail-positive (always on when
   enabled); everything else is static. G4's delivered dormancy has to be read
   against that list.
3. The authority protocol is single-flight by construction. G5 (the
   reservation ledger) is the precondition this document names for widening
   it, and A6 (derivation as PeerCompute tasks) needs it.
