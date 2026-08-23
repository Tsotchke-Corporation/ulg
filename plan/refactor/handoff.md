# SS worker-lane refactor — handoff

Branch `ss-worker-lane-refactor` @ `f39d088`, 10 commits ahead of `main`
(`f92a41d`, the contained default-off SS merge). Tree clean, everything
pushed. Written 2026-08-23. Update in place; do not append a narrative log.

Companion documents: `plan/refactor/diagrams/` (current / target / migration,
PNG + editable SVG source), `plan/todo/ss-regression.md` (the P0 acceptance
contract this branch answers), `plan/todo/selective-contact-law-application-plan.md`
(the follow-on law-admission design), ICC task
`ss-worker-lane-refactor-20260822`.

## What this branch did

SS physics used to run on the browser main thread: the page owned epoch
construction, command encoding, submission, presentation gating and a full
status traversal per step, and the next physics step could not start until the
previous frame had been presented. That is the "current state" diagram. This
branch built a worker-owned resident lane beside it and made SS run there when
explicitly asked, without deleting the old route.

Measured on the RTX 5060 Ti, water-cycle, same 40 s window
(`scratchpad/w4-worker-lane-verify.mjs`, re-creatable — see below):

| | direct route | worker lane |
| --- | --- | --- |
| sim advance | 0.516 s | **0.624 s** |
| sim advance during a 10 s pointer drag | 0.126 s | **0.152 s** |
| steps/s | ~12 | **~32** |
| route seal | `direct-schroeder-scene` | `worker-owned-resident-lane` |

1,280 steps across 80 chained 16-step schedules, epoch seals monotonic
throughout, no fallback seal, zero hot-loop readbacks.

## The ten commits

| commit | what |
| --- | --- |
| `d3cd3f2` | the three diagrams |
| `de48711` | `prewarmCachedExplicitComputePipeline` over the shared pipeline cache |
| `6a26ee1` | matching cleanup chunked to 32 logical passes per dispatch |
| `7bdd6e8` | W1 — `schroederSpatialEpoch` + `schroederSameLevelMechanics` worker stages |
| `8d03a40` | bounded status telemetry |
| `e0e2e9c` | W2 — `run-resident-schedule` batched driver |
| `461ada1` | W3 — versioned render-candidate mailbox + offscreen transport |
| `9c63cbd` | W4a — `schroederLaneSeed` lane bootstrap |
| `2fc974d` | W4b — the keystone: SS routed through the worker lane |
| `f39d088` | W5 — render smear on simulated time; prewarm enumeration |

## How the lane works now

**Turn it on.** Append `&renderOwnership=worker-owned-resident-render-producer`
to any SS demo URL. Nothing auto-upgrades into this mode; it is explicit
request only, and it additionally requires SS on plus a passing
`resolveUlgWorkerOffscreenPresentationCapability` probe
(`transferControlToOffscreen`). Anything less and you get the direct route,
unchanged.

**The chain, in order.** The mount decides readiness and passes
`workerOwnedResidentProducerReady` into
`resolvePeerComputeRenderOwnershipPolicy` — without it the policy degrades
worker-owned requests to transitional render-rows, which is what made the mode
a no-op before this branch. The scene then takes a worker-lane branch placed
*ahead* of `runSchroederSceneResidentSteps`
(`src/visualization/sphPhaseScene.js` ~:39917): seed the lane on first use,
drive `run-resident-schedule-on-presentation-device` batches, adopt the
terminal envelope, tag `residentComputeManagerMode = 'worker-owned-resident-lane'`.
The offscreen presentation worker owns the canvas *and* the device and
executes the schedule on it — one device, no cross-thread buffer copies, which
is the constraint that makes the whole design possible.

**Seeding (the part that is easy to get wrong).** A fresh lane cannot start an
SS schedule from nothing: the epoch stage admits only a retained successor
family, a `levelAssignment`, or an `activeNodeList`, and the latter two demand
same-device GPUBuffers that cannot cross `postMessage`. `schroederLaneSeed`
solves it by rematerializing particle storage on the worker device from a
cloneable descriptor and building the level assignment *there*, with the
real builder. Its lineage words are **caller-supplied and never invented**:
`storageGeneration` (which also serves as the buffer-family generation) plus
`physicsTick`, `physicsSubstep`, `positionEpoch`, `topologyEpoch`,
`chartEpoch`, `levelEpoch`, `supportEpoch`, all sourced from the scene's live
uploads. Buffer-family readiness is published only from the real resolver's
verdict. Miss a word and you get `seed-lineage-missing`; give it words the
resolver rejects and you get `seed-family-generation-rejected`.

**Batching is legal again** because each worker step builds and seals its own
epoch, so no generation is ever reused across a position epoch — the exact
constraint that forced the old one-step throttle.
`resolveSphResidentScheduleStepCount` returns the real batch count when
`workerLaneActive`, and the driver fails closed on
`epoch-identity-regressed` if identities ever stop advancing. One subtlety
worth knowing before you touch it: the seed-*consuming* step seals exactly the
seed lineage (epoch seals are stamped from the assignment's own identity), so
strict advancement starts at step 2. Both directions are pinned by tests.

**Cadence is decoupled.** Continuation issues from schedule completion, not
from rAF, and the post-step presentation gate no longer suppresses lane
schedule issuance (it still gates presentation). Candidates flow through
`residentRenderCandidateMailbox`, ordered by `(storageGeneration, physicsTick)`,
newest-wins, with the high-water mark surviving `takeLatest` so a stale
republish can never reorder forward.

**Failure is always visible.** Any admission, seed, or schedule failure falls
back to the direct route with `execution.workerLaneFallback = { reason }`
sealed on the execution. Fields the worker cannot truthfully supply are sealed
absent with named reasons in `workerLaneSealedAbsentFields` — never
fabricated. The known reasons are `worker-lane-bridge-unavailable`,
`seed-lineage-missing`, `seed-particle-storage-rematerialization-blocked`,
`seed-family-generation-rejected`, `seed-device-mismatch`,
`lane-already-seeded`, `lane-already-stepped`,
`level-assignment-source-missing`, `epoch-identity-regressed`, and
`worker-lane-schedule-error`.

## Two fixes worth remembering

**The matching cleanup was paying its budget as serial dispatches.** One
logical pass per single-workgroup dispatch meant 1024 passes = 1024 serial
dispatches per step, which starved presentation; 512 was affordable but could
not cover the measured ~890-pass worst contact chain. Now 32 logical passes
loop inside each dispatch behind a workgroup-uniform latch
(`workgroupUniformLoad` on a lane-0 recomputed flag, so every barrier stays in
uniform control flow). The full 1024 budget now sustains interactive cadence,
which means the batch/interactive budget fork can be collapsed whenever
someone wants to do the preset unification.

**The vanishing iron was the render lying, and the lie was a unit error.**
`renderSmearDtS` fed the velocity-smear interval from *wall-clock* time since
the last field build, clamped to 0.25 s. At step cadence one step advances
milliseconds of sim time while the wall waits seconds, so every build got the
full clamp and the smear term reached roughly 19× the entire metaball support
for molten iron's internal velocity dispersion — annihilating its surface
while motionless ice was untouched. It now uses simulated time between field
builds. Iron holds 99.6–99.9 % of its true t=0 surface through the first
schedule where it used to collapse to 19 % by step 2. Two days of "the physics
is broken" were this. When a visual and a checkpoint disagree, suspect the
render.

## Verification state

Full suite **2873 tests, 0 failures, 50 opt-in skips**. Visual liveness
receipt **4/4**. Physics atomics green (3 opt-in skips). Focused suites for
every touched module green. The A/B harness passes all four lane criteria.

`npm run test:e2e` is **not run** — the user stopped it twice, deliberately.
It needs port 5173 for its own `webServer` and collides with a running dev
server; stop the dev server first, or set `PLAYWRIGHT_WEB_SERVER_URL`. Treat
it as open, not as passing.

## What is deliberately not done

**The lane is not the default.** SS still routes direct unless the URL asks
for the worker lane. Flipping it is not a code change so much as an evidence
campaign: rerun the receipt machinery that gated the contained merge (full
node/build, eleven-arm native matrix, interactive presentation, four-demo
visual liveness, AB/BA/AB performance, both ICC traces, readiness) with the
lane as the ordinary route, and recover the low-N and cached-cadence WARNs
rather than waiving them. `/home/cos/ulg-probe-artifacts/run-r5-chain.sh` is
the whole chain in one script, but its paths point at the deleted
`ulg-ss-spatial-authority` worktree and need substituting for
`/home/cos/projects/ulg`.

**Selective law admission predicates** — interface / kinematic / scale /
settledness routing so contact runs where it matters instead of everywhere,
every step. Designed in `plan/todo/selective-contact-law-application-plan.md`,
unimplemented. The knobs to experiment with exist today:
`?contactSolver=0`, `?contactJacobiIterations=N`, `?contactCleanupPasses=N`.
Datum worth chasing: `contactSolver=0` runs ~240 steps/s against ~45 with
contact on, and the cleanup is active on 727 of 768 steps in a scene that is
visually settled — either legitimate resting-contact maintenance or MPM and
the pair solver disagreeing about equilibrium, which nobody has separated yet.

**The sweep admission rate** is still ~1 pair per 3 passes on serial chains.
Chunking made that cheap, not fast. It is the algorithmic debt underneath the
budget.

**Two-level SS in the worker** is refused with `w1-single-level-only`. The
worker lane is single-level only.

**Strict TypeScript control plane** — proposed in `ss-regression.md`, untouched.

## Traps

- **Never add a readback to the lane.** `normal_hot_loop_readback_free` is a
  blocking campaign event and the lane has its own telemetry scope. This is
  inviolable, not a preference.
- **Don't let the worker invent lineage.** Every identity word comes from the
  scene. A fabricated one would make an epoch seal lie, which is the class of
  bug this codebase has paid for three times.
- **Probe with `ss=1`.** The default probe URL does not exercise SS; a green
  suite and a clean production probe once shipped a change that broke every
  SS run.
- **Standalone iron-ice runs default to 64 steps.** Set
  `ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_STEPS=768` or the run passes
  vacuously without ever reaching the interesting step.
- **Evidence servers must run with watching and HMR disabled** (wrapper config
  at `/home/cos/ulg-probe-artifacts/vite-evidence.config.mjs`), or a sibling
  repo edit will destroy receipt browser contexts mid-arm.
- **A demo tab left open during editing dies.** Each save reloads it and
  strands ~60 MB of module graph; ~65 waves reach Chrome's ~2.26 GB renderer
  ceiling. Not an app leak — close the tab between editing bursts.
- **Long GPU verification runs look identical to a hung agent** from the
  outside. Check file mtimes and `pgrep chrom`, not transcript size.

## Re-running the measurements

```
# A/B the lane against the direct route (needs the dev server on :5173)
node scratchpad/w4-worker-lane-verify.mjs water-cycle worker-owned
node scratchpad/w4-worker-lane-verify.mjs water-cycle direct

# four-demo visual liveness receipt (~6 min)
ULG_VISUAL_LIVENESS_OUTPUT_DIR=<dir> node scripts/sph-visual-animation-liveness-receipt.mjs

# the native arm that exercises the contact budget end to end
ULG_RUN_NATIVE_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC=1 \
ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_STEPS=768 \
node --test tests/sphIronIceContactImpactDiagnostic.native.test.mjs
```

The harness lives in the session scratchpad, which is not durable — copy it
into `plan/refactor/` or `/home/cos/ulg-probe-artifacts/` if you want it to
survive.

## Suggested next step

Run the e2e gate to close the last open verification, then decide between two
tracks: the **default-flip campaign** (mechanical, evidence-heavy, unlocks the
performance work for every user rather than the people who know the URL
parameter) or the **selective admission predicates** (research-shaped, and the
one that might finally separate legitimate contact work from MPM-versus-pair
fighting). The second is more interesting; the first is what makes the
refactor matter to anyone who is not typing query strings by hand.
