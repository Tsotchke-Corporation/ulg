# PeerCompute Law Graph Authority Plan

Date: 2026-06-12 AKDT

Status update, 2026-06-17 ComputeManager placement preflight: the law-stage
dependency and state-family conflict policy is now visible before execution,
not only after. `ComputeManager.preflightGpuResidentLaneStagePlacement()`
returns a GPU resident placement report with dependency batches, conflict
deferrals, executor sources, Worker residency status, and missing-executor
counts. ULG records this report before running the mechanics lane. This is the
right authority boundary for the larger law graph: next, NodeKernel and
ComputeManager placement should consume this same report when choosing
same-Worker continuations, local device lanes, or remote peer execution.

Status update, 2026-06-17 Worker-retained authority contract: the graph-level
cache/placement/lease slice is already implemented, so the current authority
work moved to the next missing boundary: admitted Worker-retained law-family
outputs now publish an explicit
`peercompute.ulg.worker-retained-access-contract.v0`. Mechanics,
thermal/phase, pressure/interface, and reaction/product descriptors now state
whether their refs are same-device main-thread hot-buffer aliases or
Worker-private retained refs that require same-Worker/lane continuation. This
keeps remote/Worker GPU refs from masquerading as local leases while giving
ComputeManager/GPUHub a concrete placement signal. Focused PeerCompute
coverage passed for mechanics/reaction/pressure publication descriptors, fast
physics atomics stayed green, and a short visual sanity matrix passed. Next:
turn this metadata into dependency-aware placement and concurrency policy so
independent law-family/closure/cache/remote graph work can overlap, while
ordered physics dependencies still fence only at required state-family
boundaries.

Status update, 2026-06-17 state-family conflict batching: PeerCompute now
uses law-stage `reads`/`writes` to prevent conflicting ready stages from
sharing a GPU resident batch. This gives the law graph a concrete concurrency
guard beyond explicit dependencies. The next authority move is to reuse this
same rule at placement time across Workers/devices/peers, then let independent
closures and law stages overlap only when the state-family graph says they can.

Status update, 2026-06-17 Worker-retained continuation planner: mechanics
Worker-retained outputs now have a consumer-side authority plan. The plan is
derived from StateManager hot-buffer evidence and the access contract, then
fed into the mechanics Worker context. This prevents a raw caller boolean from
being the only reason a Worker-private GPU ref is consumed. The next authority
step is to lift this from mechanics-only continuation into law-graph placement:
admit a continuation only when state-family reads/writes, Worker/lane affinity,
and remote/local residency all agree.

Status update, 2026-06-17 GPU resident dependency batches: the first concrete
law-stage concurrency surface is now in place. PeerCompute's resident lane
stage-plan executor accepts explicit dependencies, validates them, executes
ready batches, and reports the actual batch layout. ULG now publishes the
mechanics/pressure/thermal/reaction stage DAG through its resident sequence
contract, so ComputeManager can distinguish independent law work from real
physics dependencies. This is still scheduler-level concurrency, not a claim
that one WebGPU queue runs kernels out of order. The next authority step is
state-family conflict admission and placement across same-Worker, remote-peer,
and local-lane boundaries using the Worker-retained access contract.

Status update, 2026-06-14 04:41 AKDT: now that CPU/reference atomics and the
short visual sanity matrix can guard regressions, this authority track is the
active top priority. ULG now initializes a real sibling PeerCompute
`NodeKernel` in the browser default resident authority path. It is local and
not P2P-started yet, but its real `ComputeManager`, `StateManager`, and
`GPUHub` own mounted SPH/MLS-MPM resident batches by default. An explicit
network gate can now start and stop the browser NodeKernel locally without
destroying StateManager. The resident SPH/MLS-MPM pass DAG is now registered
as ComputeManager solver `ulg-mls-mpm-sph-resident-steps`, and mounted
resident scheduling now uses solver-created task envelopes when the real solver
registry is present while preserving ULG GPU fence, GPU-resident lane,
law-graph, and StateManager commit evidence. Remote placement is now
configured through an explicit ULG gate around NodeKernel placement executors,
ComputeManager placement hooks, ULG admission, and PeerCompute quorum
validation; it does not auto-start networking or move resident physics remote
by default. A deterministic in-memory redundant NodeKernel smoke now proves
non-advisory remote resident execution, quorum validation, no responder-side
commit, and requester StateManager admission. The smoke now also proves
in-memory replicated StateManager convergence by applying the requester's
encoded Yjs update to a second real StateManager and validating the same warm
resident delta there. A provider-transport gate now proves fresh ULG resident
warm deltas move through real PeerComputeProvider `yjs-update` broadcasts into
a replica StateManager. The missing initial Yjs state-vector/full-doc sync
handshake exposed by that gate is now implemented in sibling PeerCompute and
verified from ULG with a late-joining replica receiving a preexisting resident
warm delta. The same provider path now also passes over live browser/libp2p
NodeKernel peers through a Playwright-started WSS relay. The live gate exposed
and fixed a provider-sync lifecycle race by adding explicit
`StateManager.requestProviderSync()` and post-connect NodeKernel sync retries.
The law/closure graph now starts growing under ComputeManager: the resident
host registers metadata-only child solver descriptors for mechanics,
thermal/phase, reaction/product/gas, and pressure/interface, including
sedenion periodic-table chemistry scoping on the reaction/product/gas node.
The pass DAG remains the only executable solver today; child descriptors are
authority metadata and are blocked from direct task creation until each law
family passes CPU-reference, conserved-field, GPU fence/lease,
StateManager-admission, and visual-sequence gates. Next, promote one law
family at a time instead of adding more scene-local scheduling paths. The
authority host also now emits a concrete resident law graph manifest from the
registered descriptors: five nodes, seven parent/dependency edges,
executable/metadata-only node lists, read/write/conserved state families, and
the `metadata-only-until-gated` promotion policy. The manifest now includes
current/prospective resident state-family owner maps. The pass DAG remains the
single current owner for admitted particle, mechanics, thermo/phase,
reaction/product, gas-pressure, and pressure/interface state; child law nodes
are prospective owners only. Mechanics is the first promotion candidate, but
must still pass an explicit ComputeManager-side promotion/admission gate before
it can become executable. That ULG promotion admission gate now exists on the
resident ComputeManager authority surface and rejects missing evidence,
enforces promotion order, and admits mechanics only when all required evidence
is present. That admission report now also runs as a non-mutating local
ComputeManager task with `suppressCommitDelta: true`, proving the task path
without making child law descriptors executable. The mechanics-specific
evidence gate now also exists as a non-mutating ComputeManager task:
`peercompute.ulg.mechanics-promotion-evidence.v0` validates structured
zero-force, gravity-only, conserved-field, volume-stability,
pressure-disabled, owner-map, GPU fence, StateManager admission,
committed-delta, and visual-sequence evidence before feeding the admission
task. The physics/reference parts of that evidence are now measured by actual
CPU resident zero-force and gravity-only probes through
`createUlgMechanicsPromotionReferenceEvidence()`, while browser authority tests
combine them with live host GPU-fence, StateManager, committed-delta, and
owner-map evidence from the resident step. The next work is to wrap mechanics
as an actual non-mutating child dry-run candidate and compare it against the
measured reference evidence, not thermal/phase or reaction promotion. That
child dry-run gate now exists as task family `ulg-mechanics-child-dry-run`
with `suppressCommitDelta: true`, schema
`peercompute.ulg.mechanics-child-dry-run-evidence.v0`, and required admission
evidence key `mechanics-child-dry-run-parity`. It still uses the CPU resident
mechanics reference path as the candidate, but it now carries an explicit
mechanics-only stage contract: required stages are P2G, grid update, and G2P;
thermal, reaction, and mechanics-refresh stages must be skipped; writes are
limited to `particle-kinematics` and `mechanics`. The next split is to point
the candidate at a real mechanics-only execution path while keeping this
contract and parity gate before ownership promotion. The explicit mechanics
entrypoint now exists as
`runMlsMpmMechanicsOnlyResidentStepsWithOptionalWebGpu()`: it forcibly disables
non-mechanics law stages and records `mechanics-only-entrypoint-enforced`.
That entrypoint now calls the direct split step
`runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu()` for each substep
instead of the generic resident pass-DAG step. Next, make that direct path a
ComputeManager-owned child worker path and keep the same admission evidence
chain before ownership promotion.
The remote graph boundary has also grown its first compact mechanics-stage
candidate: when G2P output is retained/no-full, ULG now records a
non-refreshable compact candidate instead of throwing or pretending it can
refresh local buffers. The candidate carries output byte evidence, output
families, retained refs, and GPU-fence status with
`admissionRequired=true`/`localRefreshRequired=true`; it deliberately has no
`stateSeedPayload`. The ULG submit wrapper now admits that compact candidate
through `NodeKernel.commitRemoteTaskGraphCompactCandidate()` when
mechanics-stage refresh is explicitly preferred, while still blocking
hot-buffer refresh and returning no local buffer refs. The next authority
surface has also landed:
`NodeKernel.refreshRemoteTaskGraphHotBuffersFromCompactCandidate()` reads the
admitted compact-candidate record and refuses to complete without an explicit
local compact refresh executor. The next authority slice is that executor:
turn admitted compact candidates into local hot buffers under
NodeKernel/StateManager/ComputeManager authority without treating remote refs
as local leases.

## Purpose

Realign ULG with the triad architecture: PeerCompute owns orchestration and
accepted distributed state mutation; ULG owns domain-facing law integration and
the browser visualization/reference surface; Eshkol and MoonLab provide closure
and response artifacts through supervised services.

This is not a plan to remove physics laws. It is a plan to make laws executable
as a distributed graph without losing provenance, validation, cacheability, or
state authority.

## Grounding From The Current Repos

- The ULG triad PDF says PeerCompute is the orchestration layer, with GPU
  access, nested worker trees, artifact caches, closure registries, validation,
  and accepted deltas brokered through PeerCompute.
- PeerCompute already has the right shape: `NodeKernel` wires
  `StateManager`, `GPUHub`, and `ComputeManager`; `ComputeManager` submits
  JS/WASM/WebGPU tasks, solver tasks, placement-aware tasks, validation, and
  commit deltas; `SolverRegistry` describes solver runtime, fields, conserved
  fields, timestep, affinity, and warm-delta behavior.
- PeerCompute's Multiscale demo already contains a law graph scheduler,
  dispatch queue, update plan, result admission, and state application
  preflight. Much of it is still proxy/evidence gated, but the architecture is
  the right place for ULG authority.
- Eshkol has useful compiler, WASM, closure-artifact, production-preflight, and
  validation manifest surfaces. It should produce law/closure artifacts and
  reference paths, not become the scheduler.
- MoonLab has quantum response artifacts and reduced WebGPU parity evidence. It
  should produce quantum/many-body response artifacts through PeerCompute
  service tasks until a fuller runtime backend exists.

Status update, 2026-06-14 07:53 AKDT: sibling PeerCompute task graphs now
carry graph-level cache policy, placement policy, cooperative cancellation,
active-graph inspection, stats, and optional graph-wide GPU lane lease
evidence. ULG wires those fields through the mechanics stage-chain artifact
while keeping the CPU-oracle path record-only instead of replaying cached
state. The next authority slice should make cache keys content-addressed from
closure/state inputs and replace local-only placement metadata with real
distributed graph placement/execution semantics.

Status update, 2026-06-14 08:16 AKDT: graph cache keys now derive from
declared content inputs. PeerCompute normalizes state refs, closure refs, law
ids, invalidation refs, retained-buffer refs, units, stable values, and
per-node cache inputs into `peercompute.compute.task-graph-cache-inputs.v0`
and hashes that material into the scoped cache key. ULG's mechanics
stage-chain graph records the resulting input hash and key source. The cache
remains record-only until StateManager admission and invalidation rules can
prove a cached closure or stage artifact is safe to consume.

Status update, 2026-06-14 08:43 AKDT: graph cache writes now create explicit
`peercompute.compute.task-graph-cache-artifact.v0` records with
`peercompute.compute.task-graph-cache-admission.v0`, result hash, input hash,
invalidation refs, and node result schemas. Read-through requires admitted
artifacts by default. ULG mechanics stage-chain artifacts are
`recorded-not-admitted`, so the architecture now captures provenance without
reusing physics output before StateManager/NodeKernel admission.

Status update, 2026-06-14 09:24 AKDT: sibling PeerCompute now has the first
StateManager/NodeKernel cache artifact authority slice. `StateManager` owns a
CRDT-backed `peercompute.state.task-graph-cache-artifact-admission.v0` ledger
plus invalidation records, `NodeKernel` exposes admission/invalidation as the
public authority facade, and `ComputeManager` only marks local task-graph cache
artifacts admitted after receiving that authority record. ULG now proves a
mechanics native stage-DAG artifact can move from `recorded-not-admitted` to
admitted and then invalidated through a NodeKernel-owned StateManager. The next
architecture priority is distributed graph placement/execution that consumes
admitted artifact hashes and retained GPU lane refs without bypassing the
StateManager ledger.

Status update, 2026-06-14 10:12 AKDT: the mechanics stage-chain graph now goes
through NodeKernel authority when available. PeerCompute exposes
`NodeKernel.submitTaskGraph()` with
`peercompute.nodekernel.task-graph-authority.v0`, and ULG passes the real
browser resident NodeKernel into the mechanics stage-chain helper. The helper
keeps direct ComputeManager graph submission as fallback, but the default
browser authority route now proves `nodeKernelOwned=true` and
`node-kernel-submit-task-graph`. Next is still distributed graph
placement/execution across peers using admitted artifact hashes plus retained
GPU lane refs.

Status update, 2026-06-14 10:31 AKDT: NodeKernel task-graph placement preflight
now prevents a dangerous false-positive state. Non-advisory `peer`, `cluster`,
or otherwise distributed graph placement requests throw
`ERR_NODEKERNEL_DISTRIBUTED_TASK_GRAPH_UNAVAILABLE` until a real distributed
graph executor exists. Local and advisory graph requests still run through the
local ComputeManager, but their results carry
`peercompute.nodekernel.task-graph-placement-preflight.v0` so downstream ULG
and PeerCompute tests can tell whether a graph was local, advisory-local, or
blocked. The mechanics CPU-oracle stage graph reports `local-placement-accepted`.

Status update, 2026-06-14 11:05 AKDT: sibling PeerCompute now has the first
remote task-graph transport path. A non-advisory distributed graph with an
explicit target peer resolves to `network-task-graph:<peer>`, sends
`compute-task-graph`, executes through the responder's
`ComputeManager.submitTaskGraph()`, and returns
`peercompute.nodekernel.remote-task-graph-placement-provenance.v0`. The
requester-local ComputeManager graph path is not invoked. Graphs without an
executor still fail closed. The next authority work is not "make graphs remote"
in the abstract; it is to carry admitted artifact hashes, retained GPU lane
refs, distributed cache/result sharing, and StateManager admission over this
request/result path before ULG resident physics can run remote by default.

Status update, 2026-06-14 11:24 AKDT: the remote graph result path now exposes
cache-artifact admission preflight instead of leaving remote cache artifacts as
implicit facts. `peercompute.nodekernel.remote-task-graph-cache-artifact-preflight.v0`
reports `remote-cache-artifact-received-not-admitted` by default. If placement
explicitly enables `admitRemoteTaskGraphCacheArtifact`, NodeKernel submits the
remote artifact object through StateManager admission and reports
`admitted-through-node-kernel-state-manager`. This is the right default for ULG:
remote graph outputs can be cached/shared only after an authority decision,
not merely because another peer returned a cache artifact.

Status update, 2026-06-14 11:43 AKDT: admitted remote graph results now import
into the local ComputeManager cache as
`peercompute.compute.remote-task-graph-cache-import.v0`. A later local graph
with the same admitted cache key can read that result as a cache hit. Remote
retained GPU lane and buffer refs are preserved only as nonlocal metadata with
`usableLocally=false`. This is the right next layer for distributed ULG: use
admitted remote results as warm/cache facts, then require an explicit
state-family/retained-lane policy before refreshing local hot buffers or
letting a child mechanics law own writes.

Status update, 2026-06-14 state-seed policy slice: sibling PeerCompute now has
`peercompute.compute.remote-task-graph-state-seed-policy.v0` through
`ComputeManager.evaluateRemoteTaskGraphStateSeedPolicy()`. The report checks
that an imported remote result is admitted, verifies declared state families
against a caller-provided allowed-family policy, blocks disallowed families,
and reports `local-refresh-required` for remote retained GPU refs that cannot
be used as local WebGPU leases. The next layer is not more metadata; it is the
actual local warm-state seed/hot-buffer refresh executor under NodeKernel and
StateManager authority.

Status update, 2026-06-14 ULG hot-buffer refresh executor slice: ULG now
provides the concrete local executor that the NodeKernel refresh hook needs.
`createUlgSphMlsMpmHotBufferRefreshExecutor()` consumes
`peercompute.ulg.remote-task-graph-sph-mls-mpm-state-seed.v0`, rebuilds SPH
state, SPH thermo, and MLS-MPM mechanics WebGPU buffers with the existing
runtime upload helpers, stores the actual GPU handles only in local
StateManager hot storage, and returns local retained-buffer refs through
`peercompute.ulg.remote-task-graph-hot-buffer-refresh-result.v0`. A focused
ULG integration test now proves an admitted remote graph import can be
committed as a NodeKernel warm seed and refreshed into local hot buffers
without treating remote retained refs as local leases. The next authority step
is now partly landed too: the browser resident authority host exposes
`refreshRemoteSeedHotBuffers()`, which commits an admitted remote seed if
needed and runs the ULG refresh through NodeKernel. The remaining authority
step is now partly landed with
`submitTaskGraphWithRemoteSeedHotBufferRefresh()`, an opt-in host wrapper that
submits a graph through NodeKernel, auto-refreshes local buffers after
admitted/imported remote results, and blocks disallowed families such as
`reaction-products` without GPU uploads. The mounted scheduler now has a
default-off prelude that can call this wrapper for caller-supplied remote
resident graphs. Remaining: package the real mounted resident law DAG as remote
work and place allowed stages on PeerCompute WebGPU workers under
ComputeManager/GPUHub lane authority.

Status update, 2026-06-14 remote seed graph-builder slice: PeerCompute
`ComputeManager.submitTaskGraph()` now preserves an explicit graph-level
`stateSeedPayload` in task-graph results and cache artifacts. ULG now exposes
`buildUlgSphMlsMpmRemoteSeedTaskGraph()` plus the serializable
`runUlgRemoteSphMlsMpmStateSeedGraphNode()` module task. The mounted
remote-refresh prelude uses that builder by default only when raw
`driver.demo.state.particles` are available. A focused integration test proves
a real responder `ComputeManager` executes the seed node, NodeKernel
admits/imports the remote cache artifact, and the requester refreshes local
SPH/MLS-MPM hot buffers from the admitted seed. Remaining authority work is to
promote the seed graph from transport/refresher evidence into actual remote
resident law execution.

Status update, 2026-06-14 resident-stage graph slice: the remote seed graph
can now include an evidence-only resident compute node after the seed node.
The responder executes `ulg-sph-mls-mpm-resident-steps` through its real
`ComputeManager`, reports the resident-step task result with backend
`cpu-reference`, and suppresses commit deltas. This proves two-node law graph
execution over the remote graph path without granting remote mutation
authority. The next slice now adds a post-stage seed node: the resident result
flows through PeerCompute task-graph `resultInputs`, ULG derives a
full-readback transitional state seed, and the requester refreshes local hot
buffers from that post-stage seed after NodeKernel/StateManager admission.
Remaining authority work is to replace the transitional full-readback seed
with actual P2G/grid/G2P/thermal/reaction/pressure/render WebGPU worker stages
under ComputeManager/GPUHub lane leases and StateManager admission.

Status update, 2026-06-14 remote mechanics stage-chain graph slice: the ULG
remote seed graph can now insert static ComputeManager-owned mechanics stage
tasks before the resident compute stage. The responder executes mechanics P2G,
grid update, and G2P as separate task-graph nodes; grid update and G2P receive
upstream node results through PeerCompute `resultInputs`; and the resident
stage depends on G2P completion when this chain is enabled. This proves the
first remote worker-stage output boundary inside the task graph, but the stage
chain remains evidence-only and non-mutating. The next authority step is to
turn those stage outputs into compact admitted state/retained-lane facts
instead of relying on the transitional full-readback post-stage seed.

Status update, 2026-06-14 remote mechanics stage seed candidate slice: the
remote graph can now add a `mechanics-stage-state-seed` node after G2P. It
derives a full-readback candidate state seed from G2P output, preserves the
original thermo/phase rows, and reports
`peercompute.ulg.remote-task-graph-sph-mls-mpm-mechanics-stage-seed-node.v0`.
Default refresh still prefers the resident post-stage seed; the mechanics seed
is used only when `preferMechanicsStageSeed` is explicit. This gives the
authority path a concrete promotion target while keeping StateManager mutation
conservative until the candidate is replaced by compact admitted output and
retained GPU lane refs.

Status update, 2026-06-14 warm-state seed commit slice: sibling PeerCompute now
has `peercompute.nodekernel.remote-task-graph-state-seed-authority.v0` through
`NodeKernel.commitRemoteTaskGraphStateSeed()`. An admitted remote graph import
that passes the state-family policy and includes a compact state seed payload
can now be committed into StateManager warm deltas under NodeKernel authority.
The committed record preserves remote retained GPU refs as nonlocal metadata
and records `local-refresh-required` for local hot buffers. The next layer is
the real local hot-buffer refresh executor that consumes these warm seed
records, acquires local GPU resident lane leases, and rebuilds local buffers
without copying or aliasing remote WebGPU memory.

Status update, 2026-06-14 hot-buffer refresh slice: sibling PeerCompute now has
`peercompute.nodekernel.remote-task-graph-hot-buffer-refresh.v0` through
`NodeKernel.refreshRemoteTaskGraphHotBuffersFromSeed()`. The method reads the
committed warm seed, acquires a local ComputeManager GPU resident lane lease,
invokes a local refresh executor, completes a local fence, and commits a
refresh delta. Remote retained refs stay seed metadata; only local refs
returned by the refresh executor are retained on the local lane. The next ULG
work is wiring the real SPH/MLS-MPM resident buffer rebuild into this hook.

## Target Authority Model

- `NodeKernel` owns session-level orchestration, clock/tick policy, peer
  placement, authority election, and the composition of StateManager,
  ComputeManager, GPUHub, service orchestration, and local IO.
- `ComputeManager` owns law solver execution, worker selection, CPU/WASM/WebGPU
  runtime dispatch, GPU lease requests, task admission, result validation,
  retry/placement policy, and commit-delta submission.
- `StateManager`/DataState owns committed warm/cold state, accepted compact
  deltas, provenance-bearing refs, and peer-replicated state views.
- ULG runtime workers may own hot WebGPU buffers while they hold a lease, but
  they publish only compact deltas, closure artifacts, result summaries, and
  explicit retained-buffer refs for the next leased stage.
- Eshkol and MoonLab run as service hosts under WorkerSupervisor/lease control.
  Their outputs are closure/response artifacts with validation metadata, not
  direct mutations of ULG state.
- GPU-resident hot paths should use ComputeManager-owned resident lanes rather
  than a competing top-level GPU scheduler. A lane keeps a related pass DAG on
  one device/state key and returns compact summaries, retained-buffer refs, or
  admitted deltas.
- Heavy Eshkol and MoonLab services may be kept warm under an explicit service
  residency policy when latency matters. Warm service state is cache/readiness
  state, not hidden authority.

## Law And Closure Graph Shape

Create a graph descriptor such as
`peercompute.ulg.law-closure-graph.v0`. Each node should declare:

- law id, schema version, solver family, and runtime target;
- read state families and write state families;
- conserved quantities and residual tolerances;
- units, validity domain, and scale regime;
- required closures, tables, artifacts, or boundary conditions;
- CPU/WASM reference requirement and WebGPU mutation readiness;
- hot/warm/cold cache policy;
- admissibility gates and overclaim blockers.

Initial law families should include:

- particle mechanics and MLS-MPM/SPH transfer;
- thermodynamics, phase, EOS, steam/water, wall heat, and pressure;
- reaction stoichiometry, energetics, products, and gas ledgers;
- optics, PBR, spectral response, Cherenkov, radiation transport;
- nuclear decay/transmutation/fission/fusion ledgers;
- gravity, N-body/tree/FMM, orbital/astrophysical dynamics;
- MHD/PIC/plasma coupling where context requires it;
- MoonLab quantum/many-body response closures;
- Eshkol-derived math kernels, derivatives, closure tables, and references.

## Required Work

1. Add an authority ledger schema such as
   `peercompute.ulg.authority-ledger.v0` with:
   - state family;
   - current owner;
   - producer stage;
   - consumer stages;
   - hot buffer refs;
   - accepted warm/cold refs;
   - mutation mode;
   - validation gate;
   - lease id;
   - cache scope;
   - invalidation inputs.
2. Register ULG law workers as ComputeManager solver descriptors, for example:
   - `ulg-mechanics-resident-step`;
   - `ulg-pressure-gas-cell`;
   - `ulg-reaction-product`;
   - `ulg-phase-steam`;
   - `ulg-optics-surface`;
   - `ulg-gravity-tree`;
   - `ulg-quantum-response-closure`;
   - `ulg-eshkol-derived-kernel`.
3. Add the GPU resident lane plan from
   `plan/todo/gpu-resident-lanes-and-warm-services-plan.md`:
   - lane affinity by state key/domain key;
   - same-device pass DAG execution for hot mutable state;
   - copy budgets for upload/readback/retained bytes;
   - retained-buffer refs instead of full particle readback;
   - device-lost and validation quarantine.
4. Extend result admission so authoritative mutation requires:
   - sequence and lease validity;
   - unit/domain compatibility;
   - conservation and residual checks;
   - CPU/WASM reference or calibrated artifact evidence where required;
   - provenance hash, source/runtime ABI, and validation status;
   - non-stale cache inputs.
   - 2026-06-12 partial in PeerCompute:
     `peercompute.compute.gpu-fence-report.v0` and task-level GPU fence
     requirements now flow through `ComputeManager` task packets, remote
     provenance, verification, and task execution envelopes. Non-advisory
     remote placement can now reject a result before commit when a required GPU
     fence report is missing or unsatisfied.
   - 2026-06-12 partial in PeerCompute Multiscale:
     the `ulg-runtime` solver descriptor now requests a queue fence through
     solver `webgpu` metadata, `stepUlgRuntime` emits a
     `peercompute.compute.gpu-fence-report.v0`, and loopback non-advisory
     remote placement verifies the satisfied fence before admitting the compact
     ULG execution delta. This proves the descriptor/task/provenance path, but
     it is not yet this repo's SPH resident physics lane backend.
   - 2026-06-12 partial in PeerCompute:
     `GpuResidentLaneManager` now provides the first narrow same-device lane
     contract under `ComputeManager`: state-keyed leases, retained-buffer refs,
     copy budgets, same-lane state conflict rejection, lane stats, and GPU
     fence reports. It is passive and does not yet run ULG SPH passes.
   - 2026-06-12 partial in ULG:
     `runMlsMpmResidentStepWithOptionalWebGpu()` now accepts a compatible lane
     manager adapter, reports copy budgets and retained-buffer refs, completes
     with local queue-fence evidence, and rejects the lease on setup failure.
     This gives the SPH resident step a bridge to the PeerCompute lane
     contract, but accepted distributed mutation still requires a real
     ComputeManager/GPUHub lane task and StateManager commit path.
   - 2026-06-12 partial in PeerCompute:
     declared local GPU-resident lane tasks are now wrapped by
     `ComputeManager` before inline execution and commit. The manager derives
     `peercompute.compute.gpu-resident-lane-task.v0` from task/WebGPU metadata,
     acquires a state-keyed lane lease, completes it with GPU fence evidence,
     injects lane execution into return envelopes, and rejects a task with
     `ERR_COMPUTE_GPU_FENCE_UNSATISFIED` before `commitDelta` when a required
     queue/lane fence is missing or unsatisfied. This is the first active local
     authority wrapper for the passive lane manager; the ULG SPH pass DAG still
     needs a concrete ComputeManager/GPUHub task.
   - 2026-06-12 partial in ULG:
     `createMlsMpmResidentStepComputeTask()`,
     `runMlsMpmResidentStepComputeTask()`, and
     `submitMlsMpmResidentStepComputeTask()` now package the resident
     MLS-MPM/SPH step as a ComputeManager-compatible JS task. The task declares
     GPU-lane residency and required fence metadata, while the handler returns
     explicit `peercompute.compute.gpu-fence-report.v0` evidence and leaves
     lane leasing to ComputeManager.
   - 2026-06-13 partial in ULG:
     the task shape now covers the whole local resident sequence/pass DAG via
     `createMlsMpmResidentStepsComputeTask()`,
     `runMlsMpmResidentStepsComputeTask()`, and
     `submitMlsMpmResidentStepsComputeTask()`. The sequence task declares
     `peercompute.ulg.law-graph-node-task-ref.v0` metadata, read/write state
     families, expected output families, GPU-lane residency, retained-buffer
     refs, copy budgets, and required fence evidence. The browser scene can
     optionally submit `refreshMlsMpmResidentSteps()` through a
     ComputeManager-compatible inline task before publishing local state.
     This is still local/inline; the next architecture step is a real
     ComputeManager/GPUHub lane host plus StateManager commit-delta admission.
   - 2026-06-13 contract gate in ULG:
     `tests/peercomputeComputeManagerIntegration.test.mjs` submits a ULG
     resident sequence/pass-DAG task through the actual sibling PeerCompute
     `ComputeManager`. It verifies GPU resident lane lease acquire/complete,
     satisfied fence evidence, `peercompute.compute.task-execution.v0`, and
     commit only after the required fence is satisfied. The negative case proves
     that a missing required fence blocks commit with
     `ERR_COMPUTE_GPU_FENCE_UNSATISFIED`. This upgrades the architecture proof
     from a fake submitter to the real local ComputeManager contract, while
     leaving NodeKernel transport and StateManager retrieval as open work.
   - 2026-06-13 mounted-loop wiring in ULG:
     the SPH phase demo auto scheduler now resolves an existing manager from
     `residentComputeManager`, `runtime.residentComputeManager`,
     `runtime.computeManager`, or `globalThis.__ulgResidentComputeManager` and
     passes it into `refreshMlsMpmResidentSteps()` on lane
     `ulg:sph-resident:demo-auto`. This lets the normal mounted resident loop
     run through a provided ComputeManager-shaped authority instead of only
     manual scene calls. The next step is to provide the real browser
     PeerCompute manager/StateManager host, not a test-injected submitter.
   - 2026-06-13 compact-delta slice in ULG:
     the real resident sequence task handler now emits
     `peercompute.ulg.mls-mpm-resident-steps-commit-delta.v0` with compact
     state key, law-node, output-family, GPU-fence, retained-buffer-ref, and
     final-step summary evidence. This gives StateManager an actual admission
     payload from the ULG task handler instead of relying on synthetic test
     deltas. Next work is to admit/read this delta through StateManager/DataState
     before scene-local publication.
   - 2026-06-13 StateManager admission bridge in ULG:
     `src/runtime/peercomputeResidentCommitBridge.js` now validates the compact
     resident sequence delta before passing it to a
     StateManager-compatible `commitDelta()` handler. The sibling PeerCompute
     integration gate proves the path through real `ComputeManager`, real
     GPU-resident lane fence admission, the ULG bridge, and real
     `StateManager`/`DataState` warm storage. It also rejects a result whose
     top-level task fence is satisfied but whose committed payload fence is not.
     Remaining work moves from "can StateManager admit this?" to "does the
     mounted browser scene get its manager from a real NodeKernel host and read
     accepted committed state before scene publication?"
   - 2026-06-14 scene publication gate in ULG:
     `refreshMlsMpmResidentSteps()` now accepts a StateManager-shaped warm
     store and reads the matching committed resident delta before publishing
     ComputeManager-returned hot execution artifacts as scene-local state. The
     mounted demo resolves StateManager from mount/runtime/global hosts and
     carries `state-manager-committed-inline-execution-returned` evidence when
     the committed warm delta is accepted. Remaining work is no longer the
     publication gate itself; it is wiring a real browser PeerCompute
     NodeKernel/StateManager host by default and then proving distributed/quorum
     admission.
   - 2026-06-14 replicated StateManager convergence gate in ULG:
     the redundant NodeKernel remote-placement smoke now proves that an
     admitted requester warm delta can converge into a second real
     PeerCompute StateManager through an encoded Yjs update. Remaining work is
     live browser/provider transport convergence across NodeKernel peers.
   - 2026-06-14 provider-transport gate in ULG:
     two real PeerCompute `StateManager`s with real `PeerComputeProvider`s now
     move a fresh ULG resident warm delta through provider `yjs-update`
     broadcast delivery. This proves the provider update path and identifies
     the missing initial state-vector/full-doc sync handshake as the next
     PeerCompute state-replication prerequisite.
   - 2026-06-14 provider initial-sync gate:
     sibling PeerComputeProvider now responds to late-peer
     `yjs-sync-request` messages with Yjs diff updates. ULG verifies a
     preexisting resident warm delta converges into a late-joining replica
     StateManager through that provider response. Remaining work is live
     browser/libp2p provider transport across NodeKernel peers.
5. Route accepted law results through StateManager/DataState commit deltas. Do
   not let ULG scene code mutate committed distributed state directly.
   - 2026-06-13 partial in ULG: local admission into real
     PeerCompute `StateManager` is tested. Browser scene readback and
     NodeKernel-owned manager/state wiring remain open.
   - 2026-06-14 partial in ULG: browser scene publication can be gated on a
     supplied StateManager warm delta. NodeKernel-owned manager/state wiring is
     now the default browser resident route, and in-memory Yjs StateManager
     convergence is tested. Real browser/provider transport convergence remains
     open.
6. Add distributed placement gates:
   - task packets must carry law graph node ids, input refs, cache refs,
     lease ids, validation requirements, and expected output families;
   - remote results must be signed/validated/quorum-checked where the law
     family requires it before commit.
7. Add Eshkol and MoonLab service adapters as graph node providers:
   - Eshkol: closure derivation, derivative export, WASM reference build,
     eventual WGSL/table emission, validation probes;
   - MoonLab: quantum response, spectra, ground state, transition matrix,
     correlations, tensor-network artifacts, parity probes.
8. Add warm-service residency policy for heavy graph node providers:
   - pre-spawn services when a scenario declares interactive closure needs;
   - keep WASM modules, response bases, closure tables, compiled artifacts, and
     validation fixtures warm within explicit memory budgets;
   - release by idle TTL, memory pressure, cancellation, or quarantine;
   - expose warm/cold/ready/quarantined state in telemetry.
9. Add NetViz/debug panels showing:
   - state family owner;
   - active law graph nodes;
   - GPU/worker leases;
   - GPU resident lanes and copy budgets;
   - warm Eshkol/MoonLab service state;
   - cache hits/misses/staleness;
   - validation blockers;
   - admitted vs rejected deltas.

## Cache Architecture

- Hot layer: worker-local WebGPU buffers, bind groups, pipelines, closure table
  buffers, staged output buffers, and ComputeManager-owned resident GPU lanes
  under explicit leases.
- Warm layer: StateManager/DataState deltas, compact solver summaries, closure
  handles, resident-buffer refs, warm service hosts, and law graph progress
  state.
- Cold layer: content-addressed PeerCompute artifacts, browser IndexedDB or
  localStorage mirrors, Eshkol/MoonLab service artifacts, and replicated peer
  cache entries.

Every reusable closure must be keyed by input hash, method/tool hash, validity
domain, schema version, source/runtime ABI, and validation status. Cache hits
are evidence, not authority, until admitted by the law graph gate.

## Multiscale Rule

The graph must select focus and resolution by context:

- quantum or molecular focus uses MoonLab/Eshkol closures and high-resolution
  local laws;
- material focus uses reaction, phase, EOS, SPH/MLS-MPM, optics, and wall laws;
- astrophysical focus uses gravity, radiation, MHD/PIC, plasma, and relativistic
  closures as needed.

Adjacent scales provide boundary conditions, closures, and correction terms.
They should not all run at maximum resolution everywhere all the time.

## Acceptance Gates

- A ULG scenario can print an authority ledger showing exactly one owner for
  every mutable state family.
- Every resident WebGPU law result declares its read/write families and is
  admitted or rejected before affecting committed state.
- ComputeManager can host local CPU, WASM, and WebGPU law workers under the same
  task/result contract.
- ComputeManager remote placement can require GPU fence evidence and reject
  missing or unsatisfied GPU queue/lane completion before `commitDelta`.
- PeerCompute Multiscale `ulg-runtime` can exercise that gate through a real
  solver descriptor and task result, not only a synthetic ComputeManager unit
  test.
- ComputeManager exposes a passive `GpuResidentLaneManager` contract for
  same-device hot-buffer ownership and copy-budget accounting.
- ULG resident MLS-MPM/SPH steps can publish lane lease/fence/copy-budget
  evidence through a shape-compatible adapter without importing PeerCompute as
  a sibling dependency.
- ComputeManager wraps declared inline GPU-resident lane tasks in
  acquire/complete/reject lease flow and blocks local `commitDelta` when a
  required GPU fence is missing or unsatisfied.
- ULG has a resident-step task factory/handler that matches that ComputeManager
  lane/fence contract without importing PeerCompute.
- Eshkol and MoonLab outputs enter as cacheable artifacts with validation
  metadata, not as hidden side effects.
- Multiscale demos can distinguish proxy evidence, reference evidence,
  calibrated evidence, and authoritative mutation.
