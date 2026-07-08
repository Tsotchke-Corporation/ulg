# Resident State Authority Contract Plan

Date: 2026-06-12 AKDT

Status update, 2026-06-17 NodeKernel placement routing: ULG now asks
NodeKernel for mechanics GPU resident stage placement preflight when a real
NodeKernel is present, preserving the raw ComputeManager preflight inside the
NodeKernel authority envelope. This moves the placement decision one step
closer to the intended state-authority owner before any resident stage mutates
state. Direct/injected ComputeManager paths still use the ComputeManager
preflight.

Status update, 2026-06-17 ComputeManager placement preflight: state-family
read/write metadata now has an admission-facing pre-execution report.
PeerCompute's GPU resident lane preflight uses the same dependency and
conflict planner as execution, then reports which stages may share a placement
batch and which Worker/GPUHub executor policy applies. ULG records the report
before mechanics stage execution. This keeps state-authority reasoning ahead
of mutation: the next gap is to make NodeKernel/ComputeManager placement
reject non-advisory distributed or cross-Worker plans that cannot honor these
state-family and retained-ref constraints.

Status update, 2026-06-17 Worker-retained access contract: admitted
Worker-retained publications now state how their buffers may be consumed.
`peercompute.ulg.worker-retained-access-contract.v0` is included in mechanics,
thermal/phase, pressure/interface, and reaction/product hot records, warm
deltas, and import descriptors. Worker-private retained GPU refs report empty
main-thread `localBufferRefs`, `workerContinuationRequired=true`, and
same-Worker retained-ref consumer mode; same-device main-thread aliases remain
the only zero-copy local import source. This closes an authority ambiguity
before broader WebGPU worker promotion. Remaining state-authority work is to
make ComputeManager placement consume this contract, enforce state-family
read/write conflict rules, and overlap independent law stages without
destroying or reinterpreting Worker-owned buffers.

Status update, 2026-06-17 state-family conflict batching: state-family
metadata now has a runtime scheduling consequence. GPU resident ready stages
with conflicting `reads`/`writes` are deferred into separate batches, and ULG
records the policy/deferral count in mechanics stage-chain telemetry. This
does not yet replace the full authority ledger, but it makes inaccurate
read/write metadata a direct concurrency blocker rather than passive docs.

Status update, 2026-06-17 Worker-retained continuation planner: the mechanics
consumer path now asks the authority host for a continuation plan derived from
the admitted hot-buffer record. The plan blocks if the required output
families are absent or if the retained source cannot be consumed on the same
Worker/lane. This narrows the authority gap between "descriptor was admitted"
and "a later stage may use it." The remaining state-authority work is to make
the same read/write-family checks global across all law-family stages.

Status update, 2026-06-17 GPU resident dependency batches: resident stage
plans now carry explicit `dependsOn`/`inputFrom` edges and execution reports
record dependency batches. ULG's current DAG makes grid update wait for P2G
and pressure/interface, G2P wait for grid update, thermal/phase wait for G2P,
and reaction/product wait for thermal/phase when present. This is the first
mechanical enforcement point for "ordered only where the physics requires it."
It does not replace the state authority ledger: the next step is to combine
these dependencies with read/write family ownership so independent stages can
overlap only when they cannot corrupt the same authoritative state.

Status update, 2026-06-14 04:41 AKDT: State authority has moved from an
injected-only shape to a default browser PeerCompute `NodeKernel` authority
host. The mounted route now runs resident batches through the real sibling
NodeKernel's `ComputeManager` and `StateManager`, validates the matching warm
delta before scene publication, and avoids pairing injected ComputeManagers
with the default host's StateManager. The explicit network gate starts/stops
the real browser NodeKernel without destroying StateManager. The mounted
resident pass now comes from the registered solver task envelope when the real
solver registry is available, while ULG still preserves the GPU fence,
GPU-resident lane, law graph, and commit-delta evidence required for
StateManager admission. Remote placement can now be configured with
ComputeManager placement hooks and PeerCompute quorum validation, but remote
resident mutation stays explicit. A deterministic in-memory redundant
NodeKernel smoke now proves StateManager admission evidence from a
non-advisory remote placement result after quorum validation, with responder
commits suppressed. The same smoke now proves in-memory replicated
StateManager convergence by applying the requester's encoded Yjs update to a
second real StateManager and validating the same committed warm resident delta
there. A provider-transport gate now proves fresh resident warm deltas can move
through real PeerComputeProvider `yjs-update` broadcasts into a replica
StateManager. The missing initial Yjs state-vector/full-doc sync handshake
exposed by that gate is now implemented in sibling PeerCompute and verified
from ULG with a late-joining replica receiving a preexisting resident warm
delta. The same resident warm-delta path now passes across live browser/libp2p
NodeKernel peers through a local WSS relay. The live run exposed a provider
sync lifecycle race, now fixed by explicit post-connect provider sync and
short NodeKernel retries. The authority host now also registers metadata-only
child descriptors for mechanics, thermal/phase, reaction/product/gas, and
pressure/interface under the resident pass DAG. Those child descriptors make
the law-family state boundaries visible to ComputeManager without allowing
independent mutation yet. Remaining authority work is complete state-family
metadata across every law stage and broader law-group admission under
ComputeManager, promoting one child only after CPU-reference, conserved-field,
GPU fence/lease, StateManager-admission, and visual-sequence gates pass. The
law graph manifest now records current/prospective owner maps: the executable
pass DAG is the single current owner for admitted particle, mechanics,
thermo/phase, reaction/product, gas-pressure, and pressure/interface state,
while mechanics is only the first prospective child owner.
The promotion admission gate and mechanics evidence gate now both run through
non-mutating ComputeManager tasks with `suppressCommitDelta: true`; mechanics
cannot become a current owner until measured CPU/reference, conservation,
GPU-fence, StateManager, committed-delta, and visual-sequence evidence is
generated and admitted.
The CPU/reference portions of that evidence are now measured by resident
zero-force and gravity-only reference probes, but mechanics is still blocked
from becoming a current owner until a non-mutating mechanics child dry-run
matches that measured reference. The child dry-run parity gate now exists and
is required for mechanics promotion admission, but it remains non-mutating and
now carries an explicit mechanics-only stage/write contract. It must still be
pointed at the actual mechanics-only split path before ownership can move from
the parent pass DAG. The explicit mechanics-only resident entrypoint now
exists and records provenance, so ownership promotion can require the same
entrypoint even after the implementation behind it changes. The entrypoint now
uses a direct mechanics-only split step rather than the generic pass-DAG step,
which narrows the boundary for the future mechanics child worker.
The remote mechanics-stage seed boundary now distinguishes full-readback seeds
from compact retained outputs. A no-full G2P result produces compact evidence
only, with `stateSeedPayload=null`, `admissionRequired=true`, and
`localRefreshRequired=true`. This keeps compact remote outputs from becoming
authoritative state until NodeKernel/StateManager admission and a local
ComputeManager lane refresh executor explicitly accept them. The first
admission hook now exists through
`NodeKernel.commitRemoteTaskGraphCompactCandidate()`; it records compact
candidate authority metadata while keeping hot-buffer refresh blocked and
remote retained refs non-local. The corresponding fail-closed refresh surface
now exists through `NodeKernel.refreshRemoteTaskGraphHotBuffersFromCompactCandidate()`:
it reads the admitted compact-candidate record, requires a local compact
refresh executor, and only lets executor-returned local refs complete the GPU
lane lease.

## Purpose

Fix the glaring behavior regressions from the WebGPU-resident refactor by
making state ownership explicit. Physics laws stay in the system and more laws
will be added. The bug to remove is ambiguous authority: no law stage should
accidentally overwrite another stage's authoritative state, destroy a buffer
that a later stage still borrows, or make physics depend on render cadence.

## Current Failure Pattern

The refactor moved useful physics into resident WebGPU paths, but several state
families now have unclear producers and consumers:

- CPU arrays, packed upload rows, resident WebGPU buffers, compact summaries,
  and Three.js fallback surfaces can disagree.
- A no-op or thermo-only law pass can accidentally replace G2P-owned mechanics.
- Pressure/interface rows have depended on render-field execution, so suppressing
  or delaying rendering can remove force inputs.
- Reaction/product buffers can be destroyed while the next step still needs to
  borrow them.
- Full-readback fallbacks can silently reintroduce stale CPU particle state.

## Required Invariant

After every stage, exactly one producer is authoritative for each mutable state
family. Other copies are mirrors, summaries, diagnostics, or stale until proven
current.

## Initial State Families

- particle kinematics: position, velocity, active flag, material id;
- mechanics: deformation gradient, affine/APIC rows, stress, volume ratio;
- thermodynamics and phase: temperature, internal energy, phase fractions;
- material closures: EOS, optical, thermal, mechanics, reaction tables;
- reaction and product events: consumed mass, product mass, event rows, residuals;
- gas inventory and pressure: species mass/moles, gas-cell pressure, wall loads;
- wall heat and boundary state;
- optical/render field: color, opacity, emissive, surface/volume descriptors;
- surface geometry: mesh/surface buffers, draw-indirect rows;
- diagnostics: compact summaries, counters, validation blockers.

## Stage Authority Order

| Stage | Reads | Authoritative Writes | Must Not Do |
| --- | --- | --- | --- |
| `setParticles` / scenario reset | Scenario inputs, cache refs | CPU/view seed state until upload; closure table refs | Pretend old resident buffers are still valid |
| Upload / pack | CPU/view seed state | Initial resident state buffers | Preserve stale CPU mirrors as authority |
| P2G | Particle/mechanics/product read refs | Grid mass/momentum/stress accumulators | Mutate particle state directly |
| Grid update / pressure | Grid, gas, wall, pressure-interface rows | Grid velocity/force/pressure rows | Depend on visible render cadence |
| G2P | Grid update outputs | Particle kinematics and mechanics | Allow thermo/no-op passes to overwrite mechanics |
| Thermal/phase | Particle state, closures, wall heat | Thermo/phase family only | Replace kinematics unless explicitly declared |
| Reaction/product | Particle state, closures, gas/product ledgers | Product/gas ledgers, event buffers, residuals | Overwrite mechanics on no-op output |
| Pressure/interface extraction | Resident physics fields | Pressure/interface rows for physics and optional render reuse | Be skipped because rendering is skipped |
| Render field / surface | Resident physics state, optical closures | Render/surface/draw buffers | Feed back into physics without an explicit physics-stage contract |
| Compact summary | Any admitted state | Diagnostics only | Become authority for full state |

## Required Work

1. [x] Add a resident authority ledger helper that can record, assert, and display
   the owner of each state family for every resident step.
2. [ ] Add stage metadata to every resident WebGPU/CPU step:
   - `authoritativeFamilies`;
   - `noOpFamilies`;
   - `borrowedBuffers`;
   - `destroyedBuffers`;
   - `nextConsumers`;
   - `validationStatus`.
3. [ ] Add a buffer lease/lifetime wrapper. Product-event buffers,
   pressure-interface rows, render fields, and compact outputs cannot be
   destroyed until all declared consumers or queue work are complete.
   - 2026-06-12 partial: `src/runtime/residentBufferLease.js` adds the generic
     lease ledger and guarded destroy helper; MLS-MPM resident steps now report
     product-event, pressure-interface, and compact-summary lease metadata, and
     product-event cleanup uses the guarded destroy path when handles are
     explicitly preserved.
   - 2026-06-12 partial: retained resident surface-draw buffers now carry
     active overlay leases and skip direct destroy until the overlay release
     path releases them. Pressure-interface force-row uploads now carry lease
     metadata and use the guarded destroy path for retained scene uploads and
     one-shot grid-update uploads.
   - 2026-06-12 partial: scene-level MLS-MPM grid update/resident-step callers
     now add and release transient consumer leases when they borrow the retained
     pressure-interface force-row buffer from resident pressure state.
   - 2026-06-12 partial: retained render-field buffers and retained
     surface-vertex buffers now carry lease ledgers; scene bridge cleanup
     releases those input leases before guarded destroy after surface-draw
     metadata has been produced.
   - 2026-06-12 partial: compact summary temporary GPU buffers now report a
     cleaned diagnostics-only lease ledger after readback.
   - 2026-06-12 partial: grid-update, render-field, surface-vertex,
     surface-draw, compact-summary, product-event merge/copy, and scene-level
     pressure force-row upload/cleanup paths now report explicit
     `queueCompletionStatus`/`queueCompletionMethod`, product-event merge queue
     evidence, or `queue.writeBuffer` ordering evidence from
     `mapAsync(readback-buffer)`, `queue.writeBuffer`, and
     `queue.onSubmittedWorkDone()` where the fake or real device exposes it.
   - 2026-06-12 partial: resident MLS-MPM/SPH steps can now wrap the full local
     resident step in a compatible GPU lane lease. The step reports copy budget,
     retained-buffer refs, queue-fence status, diagnostics mirrors, sequence
     summary fields, and rejects the lane lease if WebGPU device acquisition
     fails before the stage chain starts.
   - Remaining: extend the same fence contract across
     PeerCompute-distributed GPU worker submissions.
4. [ ] Decouple physics extraction from rendering. Pressure/interface extraction
   should be a physics compute stage. Rendering may reuse the result, but
   rendering must not be required to create it.
   - 2026-06-12 partial: `src/visualization/sphPhaseScene.js` now publishes a
     `peercompute.ulg.sph-resident-pressure-interface-state.v0` authority object
     and routes MLS-MPM grid/resident-step defaults through it instead of the
     resident render state. The playback loop refreshes pressure force rows
     after resident physics steps even when visible render refresh is skipped,
     while render state mirrors the pressure fields for compatibility.
   - 2026-06-12 partial: `buildSphPhysicsMaterialInterfaceFieldWebGpu()` now
     wraps the material-interface candidate WebGPU kernel as a physics-stage
     extractor over retained field/surface buffers. The scene publishes
     `sphResidentMaterialInterfaceState`, pressure refresh prefers that state
     over render-state mirrors, and the playback loop refreshes material
     interfaces immediately after resident physics steps before rebuilding
     pressure force rows.
   - 2026-06-12 partial: `peercompute.ulg.sph-material-interface-source-field.v0`
     now wraps the retained scalar field buffers under material-interface
     source authority for pressure-only refreshes instead of exposing only the
     render-field schema/name.
   - Remaining: move the source shader/ABI fully out of render naming, compact
     candidate/interface rows on GPU without broad readback, and attach the
     stage metadata/fence contract needed for PeerCompute-distributed law
     workers.
5. [x] Add stale CPU mirror guards. When resident stepping is active, CPU particle
   arrays are snapshots unless a specific readback has been admitted.
   - 2026-06-12: `runMlsMpmResidentStepWithOptionalWebGpu()` now rejects stale
     SPH/MLS-MPM CPU mirrors unless retained GPU uploads are present and the
     caller explicitly requests a no-full-readback WebGPU resident step.
6. [ ] Extend repeated-step tests:
   - no-op reaction output cannot overwrite G2P mechanics;
   - reset-path continuation preserves motion;
   - pressure rows exist without visible render refresh;
   - product buffers survive one borrowing step;
   - compact summaries never become full-state authority;
   - conservation and residual counters stay bounded across repeated substeps.
7. [ ] Update overlay/debug output to show state-family owner, producer stage,
   validation gate, and known blockers.
   - 2026-06-12 partial: SPH status output now includes a `material iface`
     line showing authority owner, source, status, ready/total surfaces,
     source-field schema, and candidate-readback state.
8. [ ] Make scene publication depend on accepted StateManager state, not only
   local resident task completion.
   - 2026-06-13 partial: `src/runtime/peercomputeResidentCommitBridge.js`
     validates compact resident sequence deltas before calling
     `StateManager.commitDelta()`, and the sibling PeerCompute integration test
     proves real `ComputeManager` -> GPU lane fence -> bridge admission -> real
     `StateManager` warm storage. Remaining work is to mount a real
     NodeKernel/StateManager host in the browser path and make the scene read
     the accepted delta before treating it as authoritative local state.
   - 2026-06-14 partial: `refreshMlsMpmResidentSteps()` now accepts
     `residentStateManager` and reads the matching warm delta before publishing
     ComputeManager-returned hot execution artifacts when StateManager is
     supplied. The mounted demo resolves StateManager from mount/runtime/global
     hosts for the resident auto scheduler. The default real browser
     NodeKernel/StateManager host is now in place; remaining work is live
     provider-transport replicated admission, not the local scene publication
     gate.
   - 2026-06-14 replicated convergence gate: the redundant NodeKernel remote
     placement smoke now admits the requester warm delta, encodes the
     requester's Yjs document, applies it to a second real PeerCompute
     `StateManager`, and validates the same committed resident delta on the
     replica. Remaining work is real browser/provider transport convergence
     across live peers, not the in-memory StateManager/Yjs update path.
   - 2026-06-14 provider-transport gate: two real PeerCompute StateManagers
     with real PeerComputeProviders now move a fresh ULG resident warm delta
     through provider `yjs-update` broadcast delivery into the replica warm
     store.
   - 2026-06-14 provider initial-sync gate: PeerComputeProvider now handles
     initial `yjs-sync-request`/`yjs-sync-response` with Yjs state vectors and
     diff updates. ULG verifies a preexisting resident warm delta reaches a
     late-joining replica through that path.
   - 2026-06-14 live provider transport gate: a Playwright-started WSS relay
     and two real browser NodeKernel authority hosts now prove the same
     preexisting resident warm delta replays across live browser/libp2p
     provider transport. The first failing run exposed the provider-sync
     lifecycle race now fixed in PeerCompute `NodeKernel.start()`.

## Implementation Status

- 2026-06-14: StateManager-backed scene publication gate implemented. This
  keeps hot GPU execution artifacts local while requiring compact committed warm
  delta evidence before publication whenever a StateManager authority is
  available.
- 2026-06-14: Replicated StateManager convergence gate implemented for the
  deterministic in-memory remote-placement smoke. It proves admitted resident
  warm deltas can converge into a second real PeerCompute StateManager through
  a Yjs update. Live browser/provider transport convergence remains open.
- 2026-06-14: PeerComputeProvider warm-delta transport gate implemented for
  fresh resident deltas.
- 2026-06-14: PeerComputeProvider initial sync implemented and verified for
  late-joining replicas with preexisting resident warm deltas. Live
  browser/libp2p provider transport is now covered by the WSS relay/two-host
  browser gate.
- 2026-06-13: Local StateManager admission bridge implemented. The immediate
  priority is now architecture: keep the working CPU/reference implementation
  as the regression truth, but move GPU-resident mutation through
  ComputeManager/StateManager authority before more scene-local physics edits.
- 2026-06-12: First slice implemented in
  `src/runtime/residentStateAuthority.js` and
  `src/runtime/sph/sphMlsMpmGpuStep.js`. Resident MLS-MPM steps now emit a
  versioned authority ledger, compact family-owner summaries, warning/blocker
  lists, and diagnostic owner fields. Focused tests cover the ledger helper,
  CPU fallback steps, no-full-readback retained GPU steps, no-op reaction
  ownership, gas/product ownership, and repeated reaction handoffs.
- 2026-06-12: First buffer-lease slice implemented in
  `src/runtime/residentBufferLease.js`. Resident MLS-MPM steps now emit a
  versioned lease ledger and compact lease counters; explicit preserved
  product-event handles block destruction through a lease guard and produce a
  cleanup summary.
- 2026-06-12: Render/pressure lease and stale-mirror slices implemented.
  Surface-draw overlay buffers and pressure force-row uploads now publish lease
  status, and stale CPU mirrors cannot drive resident MLS-MPM steps without
  retained GPU authority.
- 2026-06-12: Pressure/interface authority split started. A resident pressure
  interface state now owns pressure coupling, solver, retained force-row upload
  metadata, and the force-row source used by MLS-MPM; resident render state is a
  compatibility mirror for those fields.
- 2026-06-12: Local queue-completion evidence started. Grid-update,
  render-field, surface-vertex, surface-draw, compact-summary, and
  product-event merge/copy WebGPU results now identify whether completion came
  from readback mapping or an explicit queue fence, instead of leaving lease
  lifetime evidence implicit in wrapper return.
- 2026-06-12: Scene pressure force-row upload cleanup now records
  `queue.writeBuffer` enqueue evidence, derives upload completion ordering from
  the pressure consumer's queue/readback completion, and attaches guarded
  temporary-upload destroy evidence to scene-level grid/resident executions.
- 2026-06-12: PeerCompute Multiscale `ulg-runtime` now exercises the
  distributed GPU fence admission path from a real solver descriptor and task
  result. The remaining resident-state authority gap is this repo's SPH
  resident hot-buffer lane: P2G/grid/G2P/thermal/reaction/pressure/render still
  need to submit through a ComputeManager/GPUHub resident lane instead of
  demo-local helper calls.
- 2026-06-12: PeerCompute now has a passive `GpuResidentLaneManager` under
  `ComputeManager`. It can issue state-keyed lane leases, track retained-buffer
  refs and copy budgets, reject same-lane state-key conflicts, and return GPU
  fence reports. The next ULG resident-state slice should wrap SPH hot-buffer
  passes in these leases.
- 2026-06-12: ULG resident MLS-MPM/SPH now has the first optional adapter for
  those leases in `src/runtime/sph/sphMlsMpmGpuStep.js`. It is intentionally
  shape-compatible and local so ULG does not import the sibling PeerCompute
  package directly; the next slice should replace optional local wrapping with
  ComputeManager/GPUHub lane task submission for the whole resident pass DAG.
- 2026-06-14: Remote warm-seed refresh now has the first concrete
  ComputeManager/NodeKernel hot-buffer bridge. ULG can rebuild SPH state, SPH
  thermo, and MLS-MPM mechanics buffers from an admitted remote state seed,
  store the actual WebGPU handles in StateManager hot storage, and return only
  local retained-buffer refs through the NodeKernel refresh delta. The browser
  resident authority host now wraps this as `refreshRemoteSeedHotBuffers()`
  and `submitTaskGraphWithRemoteSeedHotBufferRefresh()`. The latter submits an
  opt-in remote graph through NodeKernel, refreshes local SPH/MLS-MPM buffers
  only after cache admission/import, and blocks out-of-scope families without
  uploads. The mounted scheduler now has a default-off prelude for
  caller-supplied remote resident graphs. Remaining: package the real mounted
  resident law DAG as remote work, place allowed stages on PeerCompute WebGPU
  workers without aliasing remote retained refs, and keep moving the full
  P2G/grid/G2P/thermal/reaction/pressure/render pass DAG behind
  ComputeManager/GPUHub resident lane submission.

2026-06-14 remote seed graph-builder update: sibling PeerCompute now carries
graph-level `stateSeedPayload` through `ComputeManager.submitTaskGraph()`
results and cache artifacts. ULG now builds a SPH/MLS-MPM remote seed graph
with StateManager-required admission metadata and local-refresh state-family
scope. The mounted prelude can build that graph from raw `driver.demo.state`
and skips when only packed worker view state exists. The same builder can now
add an evidence-only resident compute stage that a responder executes after
the seed node with commit deltas suppressed. A post-stage seed node can now
derive a full-readback transitional state seed from that resident result, and
the requester refreshes local hot buffers from the post-stage seed only after
remote cache admission/import succeeds. This improves the state authority
chain for remote graph imports and proves multi-node responder execution, but
does not yet authorize remote workers to mutate the full resident law DAG;
that remains gated on replacing the transitional full-readback seed with
per-stage read/write families, buffer leases, fences, compact admitted seeds,
and visual/atomic validation.

2026-06-14 remote mechanics stage-chain update: that same remote graph can now
run mechanics P2G, grid update, and G2P as explicit responder-side
ComputeManager nodes before the resident compute stage. Grid update consumes
the P2G result through PeerCompute `resultInputs`; G2P consumes the grid-update
result the same way; and the resident compute node depends on G2P when the
chain is enabled. This validates a stage-output handoff inside the remote graph
while keeping all mechanics child nodes evidence-only and non-mutating. The
post-stage seed remains transitional until the stage-chain output is promoted
to admitted compact state and retained-buffer refs under StateManager
authority.

2026-06-14 remote mechanics stage seed candidate update: a
`mechanics-stage-state-seed` node now derives a candidate seed directly from
G2P output. It requires full readback for now, preserves the seed's
thermo/phase ownership, and is not selected by default while the resident
post-stage seed exists. This makes the future promotion point explicit without
granting mechanics child stages authoritative mutation yet.
- 2026-06-12: Material-interface extraction decoupling started. A resident
  material-interface state is now refreshed as a physics stage after resident
  MLS-MPM steps and before pressure force rows, rather than only as a side
  effect of visible render refresh. A material-interface source-field ABI now
  wraps the retained field buffers, but the source shader still reuses the
  existing splat kernel and candidate rows still read back for CPU compaction.
- 2026-06-19: Scene-local resident execution generation now fences reset and
  `setParticles()` against stale async MLS-MPM resident publications. Pending
  single-step and multi-step resident promises are generation-tagged; reset
  clears them, stale completions destroy their output buffers, and progress
  diagnostics publish both the execution generation and current scene
  generation. This is still scene-local authority, but it closes a practical
  stale-buffer overwrite class before the full ComputeManager/GPUHub resident
  lane owns the pass DAG.

## Acceptance Gates

- The demo can run repeated resident steps after reset without visible collapse,
  stale CPU rewind, or no-op law overwrite.
- Disabling or throttling rendering does not remove pressure/interface physics.
- Buffer destruction is traceable and happens only after declared consumers.
- Every law stage can state which families it reads, writes, borrows, or leaves
  untouched.
- The authority ledger can be mapped later onto PeerCompute's law graph and
  StateManager commit-delta path without inventing a second model.

## Promotion Slice Design - 2026-07-08

Scoping for the named promotion point ("stage-chain output promoted to
admitted compact state and retained-buffer refs under StateManager
authority"), from code audit:

- The remote seed graph (peercomputeBrowserResidentHost.js ~1204) already
  carries `mechanics-stage-state-seed` with `authoritativeByDefault: false`,
  and the downstream resident-steps node runs evidence-only
  (`suppressCommitDelta: true`, `emitCommitDelta: false`, fence optional via
  `residentRequireGpuFence !== true`).
- The admission machinery already exists and is validated elsewhere:
  `attachResidentStateManagerCommitBridge`
  (peercomputeResidentCommitBridge.js, 350 lines) validates deltas per
  accepted scope with fence evidence; the mounted resident path and the SS
  adopted-storage path both commit through it.
- Promotion slice = (1) a request-level opt-in
  (`promoteMechanicsStageSeed: true`) that flips the seed node to emit a
  commit delta in an accepted scope, requires `gpuFenceSatisfied` on the
  producing G2P node, and records the seed's stateFamilies as the delta's
  write set; (2) the resident-steps node consuming the ADMITTED seed
  (StateManager read) instead of the raw resultInputs when promotion is on;
  (3) integration coverage in peercomputeComputeManagerIntegration.test.mjs
  (node-side, no browser needed) proving: admitted delta with fence, scope
  rejection without fence, and resident continuation from the admitted seed
  matching the evidence-only baseline bit-for-bit.
- Keep default OFF until the distributed plan needs it; the mounted demo
  path is unaffected.
