# SS worker-lane refactor — handoff

Branch: `ss-worker-lane-refactor`. Updated 2026-08-26. This document describes
the current working tree; update it in place rather than appending a narrative
log.

Companion material:

- `plan/refactor/diagrams/` — current/target/migration diagrams.
- `plan/refactor/w4-worker-lane-verify.mjs` — durable Chromium/WebGPU route and
  responsiveness proof.
- `plan/todo/ss-regression.md` — architecture and framework acceptance contract.
- ICC task `ss-hierarchy-test-suite-integration-20260826`.

## Outcome

Eligible same-device interactive SS runs now default to a worker-owned,
GPU-resident schedule lane. The ordinary route no longer performs SS hierarchy
construction, mechanics orchestration, or per-step continuation scheduling on
the page thread.

The route remains policy-driven and fail-closed:

- SS must be enabled.
- The browser must pass the module-Worker plus OffscreenCanvas transfer probe.
- Explicit `main-thread-renderer` and `worker-offscreen-render-rows` ownership
  requests are preserved and do not auto-upgrade.
- Once the worker lane is requested, missing capability or any
  seed/schedule/authority error fails closed with a typed receipt; it never
  retries the page-owned SS route. The direct route remains available only
  when worker ownership was not requested. The last failure is retained in
  `scene.userData.sphWorkerLaneLastFallback` for diagnostics.

The worker lane is selected explicitly with
`renderOwnership=worker-owned-resident-render-producer`, or implicitly by the
ordinary same-device interactive policy. Its execution seal is
`residentComputeManagerMode = 'worker-owned-resident-lane'`.

## Layer contracts

The control plane is
`src/runtime/sph/schroederWorkerLaneControlPlane.js`.
`createSchroederWorkerLaneSequenceContract()` declares one ordered DAG:

1. `schroederSpatialEpoch`
2. `schroederHierarchyMechanics`
3. `residentRenderCandidate`

Each schedule obtains a ComputeManager GPU-resident lease. The presentation
worker executes the batch, proves `worker-device.queue.onSubmittedWorkDone`,
and returns retained buffer references plus compact hierarchy summaries. The
page authority normalizes that exact worker spelling into the ComputeManager
completion ABI, completes the lease, commits one compact delta, and verifies
the StateManager warm commit before publishing the execution.

The published compact receipt includes:

- ComputeManager lease id and `completed` status;
- ComputeManager fence satisfaction;
- StateManager `committed` status;
- final epoch identity and retained-buffer references; and
- the last hierarchy-stage summary.

No page-side publication is treated as authoritative before all three layers
agree. A commit failure poisons the physically advanced worker lane so it can
never continue as split-brain state.

## Hierarchy and residency

Seeding is the only structured-clone boundary for particle rows. A fresh lane
rematerializes canonical SPH and MLS-MPM buffer families on the worker device
from the live scene lineage. Every identity word is caller-supplied:
`storageGeneration`, `physicsTick`, `physicsSubstep`, `positionEpoch`,
`topologyEpoch`, `chartEpoch`, `levelEpoch`, and `supportEpoch`. Missing or
rejected words fail closed; the worker never invents lineage.

The worker retains the packed state descriptors after seeding, so schedule
messages do not resend particle rows. Rematerialized uploads use the canonical
ABI schemas, strides, and byte lengths and therefore do not require a second
upload.

For every step the spatial stage builds the exact mechanics-grid view, including
adjacent exact 2:1 grids for two-level execution. It creates one authenticated
spatial-epoch transaction over that generation/source family and hands the same
opaque transaction to same-level mechanics. The mechanics layer validates the
exact generation and buffer family and reuses the transaction; it does not
construct a duplicate reader transaction.

Two-level SS is supported in the lane. Compact hierarchy telemetry communicates
mechanics level count, field construction mode, law queue/neighbour status,
cross-level coupling/transfer status, state authority, phase-volume migration,
pressure-owner status, and resident stage backends without exposing GPUBuffer
objects or traversing the full hierarchy on the page.

## Redundant-work and lifetime corrections

- Pipeline descriptors prewarm concurrently during lane admission and the seed
  awaits the settled summaries. Compile failures remain fail-open and visible.
- Immutable thermal response and mechanics material tables upload once per lane
  and are reused by later steps.
- Dynamic reaction product mass is carried as the exact next-step owner instead
  of allocating a new warm arena every step.
- Previous resident-step buffers retire after the successor buffers and carried
  product owner are identified.
- Superseded lanes are explicitly retired; their resident step, static uploads,
  and remaining lane-owned GPU buffers are destroyed.
- Per-lane schedule admission rejects concurrent mutation of one lane. Distinct
  lanes are not globally serialized; independent leases may prepare work while
  the device queue preserves submission order.
- `residentRenderCandidateMailbox` is newest-wins by generation/step, rejects
  malformed or duplicate candidates, and supports an explicit lifecycle reset.
- Normal execution performs no full particle readback. Presentation consumes
  worker-retained candidates and compact descriptors.

## Current verification

- The exact-tree serial Node/material/build receipt completed **199/199
  commands**: **2,914 pass**, **50 policy-admitted opt-in skips**, and **0
  fail/cancel/todo** across 2,964 TAP tests. Material-bank validation and the
  production Vite build passed. Receipt:
  `/tmp/ulg-full-node-final4-4E7GxH/full-node.json` (SHA-256
  `8b9339dc3b49f296adda757f57c28569e4d13caf66e1b0b98622c731d58d5834`).
- Full unsafe-WebGPU Playwright completed **60 passed**, **2 intentional long
  visual/probe skips**, and **0 failed** in 12.7 minutes. It covered worker
  hierarchy profiles, fail-closed admission, derived body sizing, mounted
  reaction/law/carrier continuation, native presentation, cross-level GPU
  coupling, and a fresh-WebGPU worker-retained product-history process.
- The worker-owned deep visual matrix completed **7/7 arms**, **17 schedules**,
  and **1,600 authenticated steps** with no fallback, timeout, console issue,
  or visible worker particle canvas. All **38/38** captured frames were
  nonblank and manually inspected; they show the advancing native iso surface
  without the square-particle overlay. Iron surface-stress execution,
  sodium-product formation, CsF formation, authoritative two-level terminal
  reflux, and all three random-pair advancement checks passed. Receipt:
  `/tmp/ulg-visual-sanity-matrix/2026-08-27T03-18-28-299Z/summary.json`
  (SHA-256
  `096acd0e107255d2519b23242e758df2ee89ec280afad5ba571202097269b267`).
- The contained native WebGPU matrix completed **11/11 arms** and **101/101
  tests** with no skip/fail/cancel/todo, timeout, device loss, browser/GPU
  diagnostic, or retained process. Both served-source attestations matched the
  same 17 modules and 22 transform edges before and after execution. Receipt:
  `/tmp/ulg-native-matrix-final-Y0mvKf/native-matrix.json` (SHA-256
  `9211db919819c34758c7fd7bc342b6da855827f7c68c507c75d0400612304fba`).
- Node/build and native receipts sealed the same exact source fingerprint,
  `bc362712884fe070d73f1424b3d5f60b0e91cd470c6143fee6a3062ce5f1a4f7`,
  before and after their runs. A post-browser drift audit found no executable,
  source, configuration, or test changes relative to that fingerprint.

These are framework/functionality receipts. Quantitative scientific-calibration
checks for water, iron, and sodium remain advisory on this branch; their
failure does not weaken the blocking authority, law-invocation, communication,
presentation, or liveness evidence above.

The persistent HTTPS development service on port 5173 advertises
`wss://shitbox.tail5c077c.ts.net:5173` and remains reachable at
`https://shitbox.tail5c077c.ts.net:5173/`. The isolated native receipt used a
temporary port-5174 server with `ULG_VITE_VPN_HOST=127.0.0.1` and
`ULG_VITE_HMR_CLIENT_PORT=5174`, so its HMR endpoint was correctly
`wss://127.0.0.1:5174`; that temporary server was stopped after the receipt.

## Remaining work

The architecture and production-route acceptance items in
`plan/todo/ss-regression.md` are implemented and covered by the exact-tree
receipts above. No merge-blocking architecture, communication, presentation,
or liveness work remains in this handoff. Quantitative scientific calibration
is the next validation phase: conservation tolerances and long-horizon
phase/thermal/reaction outcomes should remain formal calibration receipts
rather than being folded into this architecture refactor.

Strict TypeScript control-plane migration and selective contact-law admission
remain separate follow-on work. Neither is required to keep the worker lane
authoritative.

## Re-running the route proof

With the HTTPS demo server at `https://localhost:5173` (or with
`ULG_W4_BASE_URL` set to another exact-source server):

```sh
# Ordinary production policy (no ownership override)
node plan/refactor/w4-worker-lane-verify.mjs sodium-bomb default

# Explicit worker selection
node plan/refactor/w4-worker-lane-verify.mjs sodium-bomb worker-owned

# Direct baseline, for scenarios whose direct validation inputs are complete
node plan/refactor/w4-worker-lane-verify.mjs water-cycle direct
```

The harness asserts sim advancement, advancement during pointer interaction,
worker route sealing, no fallback, completed ComputeManager lease, satisfied
fence, committed StateManager delta, complete schedule step count, and retained
worker output references.

## Superseded baseline (retained for evidence provenance)

<details>
<summary>Original regression/refactor snapshot before this completion pass</summary>

Verification counts, route defaults, commands, and server/HMR advice in this
details block are historical and are superseded by the current sections above.

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

**Turn it on.** Eligible same-device interactive SS presets select the worker
lane by default; an explicit URL can request it with
`&renderOwnership=worker-owned-resident-render-producer`. It requires SS,
contact admission, the supervised authority host, and a passing
`resolveUlgWorkerOffscreenPresentationCapability` probe
(`transferControlToOffscreen`). An explicitly requested lane that cannot meet
those requirements fails closed. The direct route is reserved for an explicit
main-thread/diagnostic ownership policy.

**The chain, in order.** The mount decides readiness and passes
`workerOwnedResidentProducerReady` into
`resolvePeerComputeRenderOwnershipPolicy` — without it the policy degrades
worker-owned requests to transitional render-rows, which is what made the mode
a no-op before this branch. The scene then takes a worker-lane branch placed
*ahead* of `runSchroederSceneResidentSteps`
(`src/visualization/sphPhaseScene.js` ~:39917): seed the lane on first use,
drive `run-resident-schedule-on-presentation-device` batches, adopt the
terminal envelope, tag `residentComputeManagerMode = 'worker-owned-resident-lane'`.
The offscreen presentation worker owns the resident physics device, retained
state, and its hidden diagnostic canvas. It executes the schedule on that
device without crossing worker-private GPU buffers to the page. At terminal
cadence, an authenticated compact snapshot materializes a presentation-only
mirror for the visible native isosurface; the worker particle canvas remains
hidden unless its explicit debug overlay is requested.

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

**Failure is always visible.** Any requested-lane admission, seed, or schedule
failure records a typed diagnostic in
`scene.userData.sphWorkerLaneLastFallback` and rejects the schedule without a
page-owned retry. Fields a successful worker execution cannot truthfully
supply are sealed absent with named reasons in
`workerLaneSealedAbsentFields`—never fabricated. The known failure reasons
include `worker-lane-bridge-unavailable`,
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

</details>
