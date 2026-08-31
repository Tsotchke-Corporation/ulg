# SS worker-lane refactor — handoff

Branch: `performance`. Updated 2026-08-30. This document describes
the current working tree; update it in place rather than appending a narrative
log.

Companion material:

- `plan/refactor/diagrams/` — current/target/migration diagrams.
- `plan/refactor/w4-worker-lane-verify.mjs` — durable Chromium/WebGPU route and
  responsiveness proof.
- `plan/todo/ss-regression.md` — architecture and framework acceptance contract.
- ICC task `ss-dynamic-law-routing-enablement-20260830` (current closeout);
  the watch, carrier, target-authority, lifecycle, and retained-product
  predecessor tasks are complete.

## Current continuation

The reaction-activation arm is now enabled on the serialized scene/worker SS
lane. Do not rebuild the watch, transition authority, carrier materializer,
token lifecycle, retained-product handoff, or activation latch. The public
policy is exact tri-state: `disabled` is hard user-off, default `shadow`
observes the authenticated route while preserving static execution, and an
explicit `authoritative` request starts a positive reaction catalog dormant.
The configured sodium/water and Cesium/fluorine presets select authoritative;
water and iron/ice do not.

The authoritative first schedule carries `reactionTable:null` plus the
separately authenticated `reactionActivationWatchTable`. Trustworthy zero
stays dormant. Trigger-positive or conservative-uncertain evidence pre-seals
one exact dormant-to-executing successor. Main, StateManager, the outer lane
authority, and the worker retain and burn independent witnesses before lease
acquisition, route selection, or GPU work. A scene latch becomes active only
after the canonical successor executes reaction, crosses its terminal fence,
and commits through StateManager; later schedules preserve that active table.

The enabled composite tuple is `shadowOnly:false`,
`routingAuthority:true`, and
`enabled-on-serialized-scene-worker-lane-after-contact-thermo-phase-envelope-schedule-auth-and-1-to-4-carriers`.
This is authority of the complete authenticated schedule route, not of a raw
four-byte watch word. A one-lane source must prove the exact GPU `N -> 4N`
materialization with zero map/readback; an already provisioned source must
prove `4 -> 4` with no materialization receipt. The configured reactive
presets exercise the latter and the isolated native test exercises the former.

Visual gates now reject the control-body-preview stall. They require correlated
physics/presentation progress, changing nonblank frames, schedule-1 dormant
watch-only evidence, a later exact activation receipt, persistent activation
lineage, and retained product/gas or authoritative two-level evidence. The
validation framework may start next as a consumer of these receipts. General
per-node routing for other law families and distributed multi-consumer
reservation remain later work; do not broaden this exact enablement claim.

## Superseded construction context

The latest SS refactor sequence is now about schedule-boundary dynamic-law
evidence on the worker-owned resident lane, not another hierarchy rewrite.
Tier0 executes laws-quiescent batches on the fused one-lane substrate. Both
Tier0 and canonical routes publish the same motion-inflated four-byte reaction
watch after their terminal particle family, but that watch remains shadow-only
and cannot select a route.

The newest slice carries that evidence across an exact S-1 -> S boundary.
Main, outer StateManager authority, and the worker each hold a different
witness: main burns an ephemeral dispatch claim; outer authority rereads the
prior committed issuance before acquiring the successor lease; the worker
matches and burns its retained full authority plus observation before route
selection or GPU work. Route receipt v3 returns an exact consumption receipt,
and the successor warm entry persists both admission and consumption.

Sequential replay, missing/torn state, nested-key drift, lineage/count/
topology drift, and coherent worker forgery fail closed. A fresh random scene
incarnation is part of every lane/schedule/task/token id, bridge replacement
forces a fresh lane, and any ambiguous post-dispatch failure poisons the lane.
This is one-use authority for the serialized live worker incarnation, not a
global CAS claim; StateManager evidence cannot recover lost worker GPU state.

The preceding slice closed canonical contact correction as a motion source.
One shared leaf contract owns the solver/watch 16-diameter epoch trust and
exact position tolerance. Both GPU producers evaluate the same upward-rounded
maximum of G2P, generic separation, and canonical contact reach. The watch
still uses three dispatches and one four-byte boundary map; Tier0 gains no
submit and canonical retains its one compact watch submit.

The earlier thermal slice closes the remaining thermal/phase/rest-volume false-zero
class conservatively. The exact sealed envelope is now v2, the raw GPU
observation is v3, and the clone-safe worker observation is v3. The worker
seals `thermalPhaseEvolutionEnabled:true` for
`scheduleLawActivation.thermal || scheduleLawActivation.phaseVolumeMigration`,
and also for any general
`scheduleStepOptionsProvider` not branded in
`workerLaneAssignmentOnlyScheduleProviders`. Only that known assignment-only
provider may preserve the statically proved no-writer path.

When the latch is true, the dedicated canonical and shared Tier0 GPU watchers
count every fixed carrier slot trigger-positive before terminal mass,
material/phase, temperature, or `V0` is consulted. Static laws-quiescent
horizons retain the existing selective motion bound when the latch is false.
Phase-volume merge is an independent `V0`-growth writer even without a thermal
table, so the latch cannot be keyed only to thermal-table presence.

This is a fail-positive closure, not a numeric future-diameter bound or a
thermal selector. Selective future work must bound lineage-total mass against
minimum reachable density; one terminal carrier's mass/diameter maximum is
not sufficient when phase writers can redistribute a lineage among slots.

The previously open topology seam is closed. If a Tier0 continuation has N
single-lane particles and the next schedule statically activates thermal or
reaction work, one GPU submission deterministically materializes the complete
canonical 4N state/thermo/mechanics/identity family before the canonical
classifier runs. The correspondence is `terminal = phaseLane*N + source`;
render-domain identity is duplicated across the four fixed slots and is not
treated as a unique carrier id. The transition exact-validates count, byte,
identity, kernel, lineage, validation-scope, ownership, retirement, and
zero-readback evidence at the outer authority boundary.

Compact summary and phase transfer remain 4N -> 4N. Do not weaken their
distinct-count rejection: N -> 4N belongs exclusively to the new prepass.
The old N family stays pinned until the schedule terminal fence, and the first
canonical epoch must seal the new `storageGeneration + 1` /
`topologyEpoch + 1` family.

The final ownership audit closed four edge cases. Bind groups expose exact
live ranges even when a source buffer is overallocated. Immutable
material-property-bank sidecars propagate through every continuation with
transactional ownership and rollback on rejected adoption. Source retirement
requires cleanup evidence naming each of the four old core buffers after any
asynchronous cleanup completion. The outer topology attestation also
cross-binds its identity ABI to the transition source. Nonzero auxiliary
lifetime and identity-mismatch tamper tests cover those boundaries.

Canonical continuation cleanup has one additional poison boundary. Once a
successor owns identity/material sidecars, a partial predecessor-cleanup
failure does not roll ownership back into a partly destroyed family. The
previous lane remains the logical committed state, the submitted successor is
quarantined separately, reuse is rejected, and explicit lane retirement runs
both owner-aware cleanup paths after the terminal schedule fence.

The outer validator now treats the transition label as authority: static
thermal or reaction activation on a Tier0-to-canonical boundary is admissible
only as `tier0-one-to-four-to-canonical-schedule-boundary` with the exact N ->
4N proof. Same-count Tier0-to-canonical remains valid only for non-phase law
activation such as the existing contact/law-queue transition.

Leaf schedule-route evidence schemas and validators were extracted to
`src/runtime/sph/schroederWorkerScheduleRouteEvidence.js`. Keep the existing
`schroederWorkerLaneControlPlane.js` facade as the public import and authority
boundary; it re-exports the moved schemas and retains orchestration, topology
admission, and commit authority.

The preceding contact slice's recorded verification remains green. The new
envelope-v2 / observation-v3 thermal-phase slice is also fully verified:
focused schema/watcher/worker/outer suites ran `514` tests (`511` passed, `3`
expected opt-in skips); native Vulkan/WebGPU dedicated and shared watcher
execution passed `2/2`, including a current-state-ineligible reaction whose
dynamic latch counts every fixed carrier slot; the full Node suite ran `3066`
tests (`3015` passed, `51` expected opt-in skips, zero failures); and the
production Vite build plus `git diff --check` passed.

Dynamic routing is still disabled. Keep `shadowOnly:true`,
`routingAuthority:false`, and the exact cumulative execution gate
`disabled-until-contact-thermo-phase-envelope-schedule-auth-and-1-to-4-carriers`.

## 2026-08-29 continuation: numeric watch gate verified

Do not reopen the count/overflow or canonical dormant-selection work unless a
new regression contradicts the recorded evidence:

- All watch/discovery/publication counts are exact positive safe integers
  capped at the common f32 identity ceiling. Buffer-size arithmetic and the
  relevant WebGPU buffer, binding, uniform, storage-count, and workgroup limits
  are checked before private allocation or submit.
- Private evidence word zero means failure. Successful counts are encoded with
  a +1 bias and decoded back to the public count; public failure remains
  `0xffffffff`. Exact four-byte map length and post-map device, source-family,
  table/fingerprint, envelope, and cardinality authentication are mandatory.
- Fatal evidence failures poison the worker lane. A tested follow-up schedule
  cannot recover or consume a successor token from that lane.
- A reaction-inactive schedule already forced canonical by another law now
  observes its separately authorized `reactionActivationWatchTable`. The exact
  empty executable table yields to that descriptor, but positive or malformed
  executable tables retain precedence. Neither the single-level nor two-level
  closure receives the dormant table as executable input; direct tests keep
  `reactionStepRunner` at zero calls and bind the watch to the exact terminal
  state/thermo/mechanics family.
- Outer admission accepts ready or uncertain canonical dormant evidence only
  when it matches the retained target authority. Reaction activation remains
  false, and the observation has no routing authority.

Verification is green: discovery `23/23`, watcher `28/28`, control `24/24`,
worker `52/52`, hierarchy `175/175`, MLS-MPM `221/224` with three expected
skips, and full Node `3080` total (`3029` passed, `51` expected skips, zero
failures). Production build, 18 syntax checks, `git diff --check`, refreshed
ICC index/memory/history/graph/FTS, and scoped guard-diff pass. The native
watcher rerun is still unavailable because Chrome/Dawn fails before device
creation with `OperationError: A valid external Instance reference no longer
exists`; earlier native parity evidence remains current.

The remaining ICC item is `watch-storage-device-loss-hardening`. Start with
the successful concurrent observe/destroy path in
`sphReactionMotionEnvelopeWatchGpu.js`: its observation-finally branch calls a
bare `destroyOwned()` even though ownership lives on the proposal record. Add
a regression that releases during a pending canonical map, then repair the
record-scoped call and audit every success/rejection/device-loss interleaving.
After that, cover storage-family replacement/adoption and worker/token loss.

Do not enable routing. Keep `shadowOnly:true`, `routingAuthority:false`, and
the exact gate
`disabled-until-contact-thermo-phase-envelope-schedule-auth-and-1-to-4-carriers`.
Target-schedule authorization and predecessor consumption are complete in the
serialized shadow path. The next priority is a separately named production
dormant `reactionActivationWatchTable`; without it, laws-quiescent Tier0
normally emits no dynamic observation/token. Then close Tier0 watch-omission,
numeric fail-closed, storage-adoption, and device-loss gates before routing
authority.

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

- Full Node suite: **3,125 total**, **3,074 passed**, **51 expected opt-in
  skips**, **0 failures**.
- Cumulative dynamic-law focus: **276 total**, **275 passed**, one expected
  native opt-in skip. Visual liveness is **19/19**, visual sanity **19/19**,
  and the formal standard visual receipt **25/25**.
- Native Vulkan/WebGPU: phase-carrier materialization **1/1** and reaction
  index **2/2**. Production Vite build and `git diff --check` pass.
- Visible desktop Chrome passed all configured presets with zero console/page/
  critical GPU issues. Sodium recorded 1,920 correlated steps over 60.161 s,
  26.2407% sampled pixel change, exact `4 -> 4` activation, and retained gas
  `K=64` at
  `/tmp/ulg-sodium-visible-activation.JdqLt3/receipt.json`. Cesium recorded 528
  correlated steps over 60.927 s, 3.7575% change, authoritative two-level
  activation, and retained gas `K=16` at
  `/tmp/ulg-cesium-visible-final.KIx9iv/receipt.json`.
- The visible mobile/configured/random matrix covered the four presets plus
  Ba/Pb, Bk/Lr, and Fr/Fe with only nonblank frames and no console or surface
  issues. The corrected dynamic-policy rerun reports `failedCount:0` at
  `/tmp/ulg-visible-mobile-dynamic-rerun.NYZwif/dynamic-policy-rerun/summary.json`.
  All agent-owned Chrome and temporary server processes were closed.

### Earlier worker-lane receipts (historical)

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

The validation framework can begin now. Its first slice should consume the
exact schedule, activation, topology, retained-product/gas, StateManager,
presentation, and visible-liveness receipts without reinterpreting or
weakening them. The >350-schedule Cesium nonfinite rollback belongs in the
scientific/long-horizon validation queue: preserve fail-closed admission,
surface `firstRejectedDiagnostic`, trace the first upstream producer, and add
the regression, but it is not a prerequisite for framework scaffolding.

After refactor closure, restore the earlier water-demo throughput and remeasure
the canonical/Tier0 curves with live physics. Keep periodic configured-preset
checks in visible desktop Chrome during framework and performance work. Never
use terminal-browser/tmux panes as visual proof. Per-node routing for other law
families, the online closure factory, additional SS levels, and an atomic
StateManager reservation protocol for any broader-than-serialized consumer set
remain separate follow-on architecture.

### Superseded pre-enablement queue

The architecture and production-route acceptance items in
`plan/todo/ss-regression.md` are implemented and covered by the exact-tree
receipts above. No merge-blocking architecture, communication, presentation,
or liveness work remains in this handoff. Quantitative scientific calibration
is the next validation phase: conservation tolerances and long-horizon
phase/thermal/reaction outcomes should remain formal calibration receipts
rather than being folded into this architecture refactor.

For the adaptive-law continuation, preserve the completed independently
main-authored target seal and S-1 -> S predecessor-token protocol. Provision a
separately named dormant reaction watch table on laws-quiescent Tier0 without
making reaction executable, bind it through the existing SHA-256 authority,
and prove the production route cannot omit or drift it. Then finish the
numeric, selector/storage-adoption, and device-loss gates. Before routing can
use a triggered observation, replace the current prior/current configuration
equality with an explicitly sealed prospective transition and add an atomic
StateManager reservation if authority expands beyond the serialized scene.
Do not enable dynamic routing before those gates pass.

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
- **Never use terminal-browser or a tmux/split-terminal browser pane.** Real
  visual proof means visible desktop Chrome on the actual display. Close only
  browser/server processes started by the current check; do not touch the
  user's persistent Chrome or HTTPS Vite service.

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

The contact and thermal/phase/rest-volume false-zero classes are now enclosed,
with thermal/phase conservatively fail-positive rather than selective. Next,
bind an independently main-thread-authored target schedule and full writer set
to the observation, including provider/table fingerprint drift; prove Tier0
cannot omit a required watch; then finish NaN/zero/count/capacity, overflow,
storage-adoption, and device-loss gates. Only after those gates pass should the
shadow receipt be considered for fail-closed route authority.

</details>

## 2026-08-29 continuation: predecessor token is consumed, not routed

The next agent should start from the verified two-schedule continuity boundary,
not rebuild target authority, thermal/contact envelopes, or carrier topology:

- `schroederTargetScheduleAuthority.js` owns the exact clone-safe authority;
  `schroederAuthorityFingerprint.js` supplies synchronous SHA-256 framing.
- The scene retains the original and posts a clone. The mechanics worker
  recomputes writers/provider/tables/envelope/topology before any schedule GPU
  work. Lane-control receipt v3 compares the worker copy to the original,
  exact-rereads the predecessor StateManager issuance, admits the worker's
  pre-route/pre-GPU consumption receipt, and persists both admission and
  consumption. Dynamic-law observation v4 echoes the target request/
  fingerprint and stays shadow-only.
- The scene burns its claim before dispatch; worker and StateManager each
  retain an independent witness. Replay, missing state, torn warm records,
  lineage/count/topology drift, configuration drift, extra nested lineage
  keys, and coherent worker forgery are covered. Scene incarnation ids prevent
  stale counter-only task aliases, and post-dispatch failure poisons the lane.
- The complete focused boundary is green (`207/207`). Full Node is green
  (`3069` total, `3018` passed, `51` expected skips, zero fail); five source
  syntax checks, the production build, and full `git diff --check` pass.
- Do not enable routing. The exact gate remains
  `disabled-until-contact-thermo-phase-envelope-schedule-auth-and-1-to-4-carriers`.

Next priority is a separately named production dormant
`reactionActivationWatchTable`; otherwise laws-quiescent Tier0 has no reaction
descriptor to observe and normally cannot issue the token this slice now
consumes. Exercise the real dormant S0 -> S1 path, prove watch non-omission,
then close numeric/overflow/storage-adoption/device-loss gates.

Do not overstate the current one-use scope. Outer issuance is read before
acquire but not atomically reserved; concurrent direct callers still rely on
scene/worker single-flight guards. A broader authority needs an issued ->
reserved-by-exact-consumer -> consumed StateManager CAS/ledger. Likewise,
prior/current envelope/writer/provider/table equality is intentionally strict
while routing is disabled; a future dynamic transition must be named and
sealed rather than enabled by relaxing equality.

## 2026-08-29 continuation: production Tier0 now carries the dormant watch

Do not rebuild the watcher, target authority, predecessor-token protocol, or
scene provisioning seam:

- The scene keeps executable `reactionTable` null when reactions are disabled,
  selects only a positive full catalog as
  `reactionActivationWatchTable`, and injects it only through
  `createSchroederWorkerResidentStepOptions`. Shared/direct resident execution
  does not see this unpaired descriptor.
- Worker cloning isolates the typed records. Main authority SHA-256-binds the
  dormant descriptor and `combinedRecords`; worker preflight recomputes them.
  Omission and one-record drift reject at step zero before submit, fence, map,
  write, provider execution, completion, or commit.
- The valid route remains laws-quiescent Tier0 with both writer and activation
  reaction bits false. Its observation echoes the exact watch fingerprint,
  stays `shadowOnly:true` / `routingAuthority:false`, and feeds the verified
  S0 -> S1 predecessor-consumption protocol.
- Verification: production/clone/worker `76/76`; complete focused `210/210`;
  full Node `3070` total (`3019` passed, `51` expected skips, zero failures);
  production build, syntax, and full diff check pass.

Next priority is numeric/count/overflow hardening, followed by storage-adoption
and device-loss lifecycle. Do not claim canonical dormant-watch coverage: if
another law already selects canonical while reaction is dormant, canonical
capture is still gated on executing reaction. Do not claim actual dynamic
routing: exact prior/current configuration equality deliberately rejects a
dormant-to-executing transition until a prospective transition is separately
sealed. Keep the exact gate
`disabled-until-contact-thermo-phase-envelope-schedule-auth-and-1-to-4-carriers`.

## 2026-08-29 continuation: watch lifecycle is closed, routing is not enabled

Start from the completed reaction-watch boundary; do not rebuild its numeric,
canonical-dormant, storage, cancellation, or loss hardening:

- Numeric/count/capacity/overflow preflight is exact and biased private
  evidence cannot turn cleared storage into a false zero. Canonical schedules
  selected by another law may observe the separately authorized dormant table
  without executing reaction; exact empty executable tables yield, while
  positive or malformed executable tables cannot be laundered through the
  fallback.
- A watch proposal is an opaque WeakMap-backed record bound to one device, one
  terminal state/thermo/mechanics buffer triple, and one particle count. The
  worker authenticates that family before and after map. Single- and
  authoritative two-level producers rederive adoption/continuation storage at
  the watch site. A proposal over a superseded predecessor family rejects
  before map, releases, poisons the lane, and cannot issue a successor token.
- Proposal cleanup is order-independent and exact-once. Completion-before-
  destroy is honored; destroy during a map waits for the real outcome;
  idempotent completion can discharge a pending release; and a late rejected
  fallback fence cannot quarantine buffers already released after a successful
  map.
- A partially cancelled schedule may emit only unmeasured conservative
  uncertainty: `rawEvidenceWord:null`, `mapAsyncCount:0`, and
  `readbackByteLength:0`. Forged successful cancelled evidence rejects before
  ComputeManager completion or StateManager commit. Authentic uncertainty is
  consumed once by S1; replay rejects before GPU work. Worker restart remains
  fail-closed because StateManager audit evidence cannot recreate the lost
  worker witness.
- Device loss during a pending terminal map is a tagged terminal failure. No
  result or token escapes; the lane is poisoned; all watch-owned buffers retire
  exactly once; reuse rejects; and explicit release plus replacement-device
  reseed succeeds.

Verification is green: watcher `33/33`, mechanics worker `55/55`, lane control
`25/25`, hierarchy `175/175`, MLS-MPM `224` total (`221` passed, `3` expected
skips), and full Node `3089` total (`3038` passed, `51` expected skips, zero
failures). Production build, syntax checks, `git diff --check`, refreshed ICC
index/memory/graph/FTS/history, and scoped guard-diff pass. Native WGSL was not
rerun because Chrome/Dawn still fails before device creation with
`OperationError: A valid external Instance reference no longer exists`; prior
native parity evidence remains current.

The next slice is a new authority problem: explicitly model and authenticate a
prospective dormant-to-executing transition across S0 -> S1, then run a separate
enablement/readiness audit. Do not relax exact prior/current equality as an
implicit transition. If authority expands beyond the serialized single-flight
scene lane, first add an atomic StateManager issued -> reserved-by-exact-
consumer -> consumed protocol. Until those steps pass, retain exactly
`shadowOnly:true`, `routingAuthority:false`, and
`disabled-until-contact-thermo-phase-envelope-schedule-auth-and-1-to-4-carriers`.

## 2026-08-30 continuation: retained-product S1 -> S2 is sealed, consumed, and visually qualified

Start from the completed transition boundary; do not rebuild target authority,
watch lifecycle, product-arena authentication, or the one-use token protocol:

- `schroederTargetScheduleAuthority.js` owns the v4 target and v1 prospective
  transition. The only admitted S1 -> S2 writer delta is
  `retained-product-gas-boundary-inactive-to-actionable`: reaction stays active,
  gas-boundary authority changes false -> true, mechanics field views remain
  available, and both sides are one-step schedules. Tables, motion envelope,
  source/consumer/request ids, writer evidence, arena identity, and transition
  fingerprint are exact.
- `sphPhaseScene.js` pre-seals S2 while S1 owns the terminally fenced product
  arena, then retains a compact durable consumption receipt. The mechanics
  worker authenticates the live arena before token/GPU effects.
  `schroederWorkerLaneControlPlane.js` burns the StateManager predecessor before
  lease acquisition; the worker burns its independent witness before route
  selection or GPU work. S2 uses the prospective bootstrap once, and S3 is
  exact continuation. Replay, cancellation, mutation, foreign identity, and
  ambiguous completion tests are already covered.
- `sphReactionMotionEnvelopeWatchGpu.js` uses one WGSL entry point per module
  and driver-safe exact factorization. This is the fix that stopped real
  sodium/Cesium runs from crashing NVIDIA `libnvidia-gpucomp.so`.
- The worker's `residentProductHistory` is fixed-size clone-safe evidence, not a
  GPUBuffer handoff. The visual receipt reads the worker-owned last-step
  summary plus `productHistoryLiveBoundObservation` and
  `retainedProductGasTransitionReceipt`. Exact zero-live qualification requires
  an authenticated four-byte zero, matching current arena generation/seal/
  bytes, literal unbound/zero-byte render evidence, and the exact consumed
  transition. Missing render evidence remains null and fails. Sodium also
  requires its gas-only GPU P2G route; Cesium requires the authoritative
  two-level commit and a completely sealed-absent top-level P2G tuple.

Verification is green after adversarial review: focused transition boundary
`229/229`; post-review native/visual harness `105/105`; full Node `3098` total
(`3047` passed, `51` expected skips, zero failures); production build and
`git diff --check` pass. The final headed NVIDIA/WebGPU receipts are:

- `/tmp/ulg-visual-liveness-final-water-strict-20260830/receipt.json`
- `/tmp/ulg-visual-liveness-final-iron-strict-20260830/receipt.json`
- `/tmp/ulg-visual-liveness-final-sodium-strict-20260830/receipt.json`
- `/tmp/ulg-visual-liveness-final-cesium-strict-20260830/receipt.json`

All four passed three motion checkpoints and at least 60 seconds of correlated
physics/presentation with zero console, page, or critical GPU issues. Their
initial/intermediate/final PNGs were opened and inspected: water stayed coherent
with modest surface evolution; iron descended and spread into a luminous,
dark-edged quench cap; sodium descended and developed a pale-yellow interface
band; and a broad white fluorine/product region grew around the orange Cesium
body.

The separate late-horizon Cesium numeric failure is retained as a validation
and calibration item, not another transition-authority rewrite. Independent
long runs fail closed at
schedule 350-356, beyond the green bounded 300-step qualification. The terminal
reflux header is structurally exact but reports flags 535 with fail-closed,
nonfinite, and phase-rejected set; three invalid rows, three rollbacks, nine
skips, zero of two fine commits/consumes, and no terminal/publication token.
Preserve `firstRejectedDiagnostic` in the visual receipt, run
`stageMechanicsTrace=1` around that horizon, identify and fix the first upstream
arithmetic producer, then add a greater-than-350-step Cesium regression. Do not
weaken terminal admission.

The later enablement audit is complete. The configured reaction route is now
exactly `shadowOnly:false`, `routingAuthority:true`, under
`enabled-on-serialized-scene-worker-lane-after-contact-thermo-phase-envelope-schedule-auth-and-1-to-4-carriers`.
The validation framework is the next priority. If authority ever expands
beyond the serialized scene lane, add atomic StateManager issued ->
reserved-by-exact-consumer -> consumed semantics first.

## 2026-08-30 closure: persistent preset entry now presents physics, not control envelopes

The dynamic-law refactor and its user-facing preset route are closed together:

- Menu/hash reloads no longer reinterpret a preset-authored
  `native-webgpu-surface-consumer` value as a user diagnostic override. A
  matching preset runtime value remains implicit; query overrides, differing
  hash values, and the explicit `surfaceDrawDiagnostic` marker remain genuine
  diagnostic ownership requests. New preset reloads remove both ambiguous URL
  fields and retain the scenario id as authority.
- The mount no longer fails open around an unresolved t=0 render refresh. That
  request owns the scene's serialized presentation lane, so autoplay stays
  held and the honest control-envelope preview stays visible until the exact
  transaction settles. Letting physics advance behind it was the mechanism
  that left every current post-step surface queued behind stale startup work.
  The bounded admission proof still applies after a completed render attempt.
- The configured-preset visual receipt now exercises literal
  `/#scenario=<id>` entry. Its exact identity check accepts loopback HTTP or
  HTTPS while retaining exact host/path/hash equality, and quiescent
  checkpoints prove configured batch K from `residentStepsPerSchedule` after
  stage bookkeeping legitimately advances to a null-step interface event.

Final verification is green: full Node `3129` total (`3078` passed, `51`
expected skips, zero failures); production build and `git diff --check` pass;
native phase-carrier materialization is `1/1`; native reaction indexing is
`2/2`. The real desktop Chrome receipt is
`/tmp/ulg-hash-preset-visible-final.UF4Vor/receipt.json`: all four exact hash
presets completed, retired the preview, sustained correlated physics and
presentation progress, passed route milestones, changed compositor pixels,
and reported zero console/page issues. Every final 160-step PNG was opened and
visually inspected; all contain filled simulation surfaces and none contain
the labeled control-body preview.

Start the validation framework next. Keep visual-throughput restoration as a
separate follow-on performance slice: recover and generalize the earlier
`water - real time dam break` throughput improvements across the canned
presets without weakening the source-correlation, presentation-admission, or
dynamic-law authority gates established here.
