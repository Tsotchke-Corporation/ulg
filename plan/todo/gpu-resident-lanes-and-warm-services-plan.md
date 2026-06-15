# GPU Resident Lanes And Warm Service Residency Plan

Date: 2026-06-12 AKDT

Status update, 2026-06-14 03:26 AKDT: the browser-mounted resident path now
uses a real local PeerCompute `NodeKernel` by default, so GPU resident lane
work should continue under `ComputeManager`/`GPUHub` rather than as a sibling
scheduler. Explicit/injected ComputeManagers still win precedence; the default
host owns the matching StateManager only for its own lane tasks. The explicit
NodeKernel network gate can start and stop browser libp2p without destroying
StateManager. The resident pass DAG is registered as
`ulg-mls-mpm-sph-resident-steps`, and mounted scheduling now uses a
solver-created task envelope while preserving the ULG GPU fence and
GPU-resident lane metadata that `ComputeManager` needs for lease/fence
admission. Remote placement hooks can now be configured explicitly, and a
deterministic redundant NodeKernel smoke proves non-advisory remote resident
execution, quorum validation, requester StateManager admission, and in-memory
replicated StateManager convergence. A provider-transport gate now proves
fresh ULG resident warm deltas can move through real PeerComputeProvider
`yjs-update` broadcasts, and the missing initial Yjs state-vector/full-doc sync
handshake is now implemented and verified for late-joining replicas. The same
resident warm-delta path now also passes over live browser/libp2p provider
transport through a Playwright-started WSS relay and two browser NodeKernel
authority hosts. The hot resident lane remains local by default; next work has
begun by publishing metadata-only child descriptors for mechanics,
thermal/phase, reaction/product/gas, and pressure/interface under
ComputeManager authority. Those child law families are not independent
executors yet. Promote them one at a time only after their hot-buffer
ownership, GPU fence/lease evidence, StateManager admission, CPU-reference
parity, and visual sequence gates are in place. The law graph manifest now
records the pass DAG as the single current owner for admitted state families
and mechanics as the first prospective child owner, which gives the future GPU
lane promotion gate a concrete ownership surface to enforce. Then introduce
warm Eshkol/MoonLab service residency as supervised service state, not hidden
mutation authority.

Status update, 2026-06-14 ULG hot-buffer refresh executor slice: the first
remote-seed to local-hot-buffer bridge now exists. Imported remote graph GPU
refs remain metadata-only; after NodeKernel/StateManager admission, ULG can
rebuild SPH state, SPH thermo, and MLS-MPM mechanics buffers locally through
`createUlgSphMlsMpmHotBufferRefreshExecutor()`. The executor stores actual
WebGPU handles in local StateManager hot storage and returns local retained
refs to `NodeKernel.refreshRemoteTaskGraphHotBuffersFromSeed()`. This is the
copy-avoidance-compatible shape for distributed runs: do not copy remote
device handles; rebuild or derive local resident buffers under a local
ComputeManager lane and retain them there. The browser resident authority host
now exposes `refreshRemoteSeedHotBuffers()` as the policy-facing wrapper for
that sequence. It also exposes
`submitTaskGraphWithRemoteSeedHotBufferRefresh()`, which proves the admitted
remote result -> local lane refresh handoff can happen automatically for an
opt-in graph submission while blocked state families produce no uploads. The
mounted scheduler now has a default-off prelude for caller-supplied remote
resident graphs. The remaining work is to package the real mounted resident
pass DAG as remote work and run allowed stages on PeerCompute WebGPU workers
without copying remote retained refs into local leases.

Status update, 2026-06-14 remote seed graph-builder slice: PeerCompute
task-graph cache artifacts now preserve graph-level state seeds, and ULG can
construct a SPH/MLS-MPM remote seed graph with cache inputs, retained-buffer
refs, and GPU resident lane hints. The mounted prelude can build that graph
from raw `driver.demo.state.particles`; packed worker view state still skips
graph creation because it is not enough for the current refresh executor.
The graph can now add an evidence-only resident compute stage after the seed
node, proving a responder can run resident-step task code through
ComputeManager without committing remote mutation. A post-stage seed node now
derives a full-readback transitional state seed from that resident result so
the requester can refresh local hot buffers from the advanced state after
NodeKernel/StateManager admission. Remaining lane work is the real remote
resident law DAG: replace the transitional CPU-readable seed with WebGPU
worker stages that keep their hot buffers resident under ComputeManager/GPUHub
leases and emit compact admitted state for refresh without broad CPU arrays.
The first stage-chain version of that DAG is now present as evidence-only
mechanics P2G, grid update, and G2P nodes before the resident stage. Those
nodes pass upstream stage outputs through PeerCompute `resultInputs` and keep
commit deltas suppressed, so they exercise the remote worker-stage output
boundary without yet claiming GPU-resident retained-buffer authority.
The graph now also has a non-authoritative mechanics seed candidate after G2P.
It still uses full-readback state/mechanics arrays, so it is not the final
copy-avoidance answer; it exists to prove the handoff shape before replacing
the CPU-readable seed with compact summaries, local refresh records, and
retained-buffer refs owned by ComputeManager/GPUHub lanes.
The first compact replacement boundary has now landed: no-full/retained G2P
output returns a non-refreshable compact mechanics-stage candidate with output
byte evidence, output families, retained refs, and GPU-fence status. It
requires StateManager admission and a local retained-lane refresh executor
before becoming hot state. That keeps remote device buffers from masquerading
as local leases while still moving the architecture away from full particle
array copyback. ULG now records that candidate through
`NodeKernel.commitRemoteTaskGraphCompactCandidate()` when explicitly selected,
and hot-buffer refresh now has two local materialization modes: a validated
compact snapshot upload, and a same-device retained-buffer import that aliases
an existing StateManager hot-buffer record without new GPU writes. Mechanics
G2P stage results can now propagate that same-device source descriptor into
compact candidates when supplied by the producer. PeerCompute now also exposes
the fail-closed
`NodeKernel.refreshRemoteTaskGraphHotBuffersFromCompactCandidate()` surface:
it reads the admitted compact-candidate record, acquires no authority without a
local executor, and can only complete with executor-returned local retained
refs. The first publication surface for those local sources now exists:
`host.publishSameDeviceHotBufferSource()` stores same-device SPH/MLS-MPM
upload handles in StateManager hot storage and returns the serializable import
descriptor. The mounted resident ComputeManager path now calls that publication
surface automatically after StateManager admission when it owns real same-device
SPH state, SPH thermo, and MLS-MPM mechanics upload handles, and the retained
import descriptor is bridged onto final G2P reconstruction metadata. The next
lane slice is to have admitted compact worker-stage outputs consume and
propagate that source descriptor as their local materialization path, instead
of falling back to snapshots or full readback. Cross-device retained refs
remain metadata-only.

## Purpose

Address the copying concern without creating a second scheduler. ULG needs
long-lived GPU-resident execution lanes for hot physics state, and it needs
long-lived warm Eshkol/MoonLab service hosts when latency matters. Both should
remain under PeerCompute authority.

## Decision

Do not start with a broad sibling `GPUComputeManager` that competes with
`ComputeManager`. Add a narrower GPU-resident execution layer under
`ComputeManager` and `GPUHub`, for example `GpuResidentLaneManager`.

This layer should be an execution backend, not a new authority boundary:

- `NodeKernel` still owns orchestration policy.
- `ComputeManager` still owns law task scheduling, affinity, placement,
  validation, and commit-delta submission.
- `GpuResidentLaneManager` owns same-device GPU lanes, pass-DAG execution,
  hot-buffer handles, and copy-avoidance contracts.
- `StateManager`/DataState still owns accepted warm/cold state and admitted
  deltas.

## Existing Capability To Reuse

PeerCompute and ULG already have supervised child-worker leasing. Service hosts
can request approved child modules and spawn them under supervisor policy.

That is useful for service trees, but it is not enough for GPU residency. A
child worker that gets its own `GPUDevice` is not automatically sharing resident
`GPUBuffer` state with its parent or sibling workers. Splitting one hot physics
state across arbitrary GPU workers risks extra readback/re-upload and ambiguous
ownership.

## GPU Resident Lane Rule

For one mutable resident state family, keep the hot mutation chain on one
GPU-owning lane unless explicit domain partitioning exists.

Good near-term shape:

```text
ComputeManager task
  -> GpuResidentLane(stateKey/domainKey)
      -> P2G
      -> grid / pressure / wall update
      -> G2P
      -> thermal / phase
      -> reaction / product / gas
      -> pressure/interface extraction
      -> render/surface pass
  -> compact summaries + retained-buffer refs
  -> admission
  -> StateManager commitDelta
```

The lane may run inside a dedicated worker or a main-thread GPUHub lane,
depending on browser constraints, but the contract is the same: keep buffers
resident on the same device and move only handles, compact summaries, and
admitted deltas across the control plane.

## Warm Eshkol And MoonLab Residency

Eshkol and MoonLab are heavy services. They should not be recreated and
destroyed incidentally when latency matters.

Add a service residency policy to PeerCompute service orchestration:

- `startupMode`: `cold`, `warm-on-first-use`, `warm-at-scenario-load`, or
  `always-warm`.
- `idleTtlMs`: how long a service stays warm after its last task.
- `warmPoolSize`: how many ready workers/hosts to keep.
- `memoryBudgetBytes` and optional GPU/wasm memory budgets.
- `warmArtifacts`: closure tables, WASM modules, response bases, tensor-network
  intermediates, compiled pipelines, and validation fixtures that may remain
  cached.
- `latencyClass`: `interactive`, `simulation`, `background`, or `batch`.
- `quarantinePolicy`: what happens after device loss, failed validation, worker
  crash, stale artifact detection, or memory pressure.

Warm residency must not mean hidden authority. Warm services produce artifacts,
closures, response tables, and validation evidence. They do not mutate ULG
state directly outside PeerCompute admission.

## Required Work

1. Add a `GpuResidentLaneManager` design under PeerCompute `ComputeManager`:
   - lane id;
   - state key / domain key / solver affinity;
   - owning device id or GPUHub id;
   - active leases;
   - hot-buffer registry;
   - pass-DAG queue;
   - retained-buffer refs;
   - compact summary outputs;
   - device-lost and quarantine state.
   - 2026-06-12 partial: PeerCompute `ComputeManager` now has the first
     cross-worker GPU fence contract. Tasks can declare a required GPU fence in
     `task.gpuFence` or `task.webgpu`, task packets carry that requirement, and
     remote provenance must include a satisfied
     `peercompute.compute.gpu-fence-report.v0` before verification passes. This
     is the admission gate a future `GpuResidentLaneManager` should use; it is
     not yet the lane scheduler or hot-buffer registry.
   - 2026-06-12 partial: PeerCompute Multiscale `ulg-runtime` now uses that
     gate from a real solver descriptor. Its descriptor declares a WebGPU queue
     fence, the runtime task emits the fence report after queue/readback
     completion, and loopback non-advisory remote placement verifies the fence
     before accepting the compact delta. This narrows the remaining lane work to
     an actual same-device resident backend for ULG SPH hot buffers.
   - 2026-06-12 partial: PeerCompute now has a narrow
     `GpuResidentLaneManager` under `ComputeManager`, with state-keyed lane
     leases, retained-buffer refs, copy-budget counters, same-lane state-key
     conflict rejection, and `peercompute.compute.gpu-fence-report.v0`
     completion reports. `ComputeManager` exposes passive acquire/complete/
     reject methods and reports lane stats without changing normal task
     dispatch. Remaining work is to route ULG SPH hot-buffer passes through
     those lane leases.
   - 2026-06-12 partial: ULG's resident MLS-MPM/SPH step now has a compatible
     lane adapter. Callers can pass a `gpuResidentLaneManager`; the resident
     step acquires a state-keyed lease, declares upload/readback/retained byte
     budgets, completes with local queue-fence evidence and retained-buffer
     refs, mirrors the fence into diagnostics/sequence summaries, and rejects
     the lease on WebGPU setup failure. This proves the ULG side of the lease
     shape, but it is still an optional local adapter rather than a
     ComputeManager-scheduled pass DAG.
   - 2026-06-12 partial: PeerCompute `ComputeManager` now wraps declared
     inline GPU-resident lane tasks in lane leases before local commit. Tasks
     can declare `gpuResidentLane`/`gpuResidentLaneLease`, WebGPU resident-lane
     metadata, or `residency: "gpu-lane"`; local inline execution acquires the
     lane, completes it with GPU fence evidence, injects the lease execution
     report into the task envelope, and rejects commit when a required fence is
     missing or unsatisfied. This starts the scheduled authority path, but the
     full ULG SPH pass DAG is still not yet routed through it.
   - 2026-06-12 partial: ULG now exposes a ComputeManager-shaped resident-step
     task bridge. `createMlsMpmResidentStepComputeTask()` declares
     `residency: "gpu-lane"`, `peercompute.compute.gpu-resident-lane-task.v0`,
     and a required `peercompute.compute.gpu-fence-requirement.v0`; the task
     handler returns the resident step plus an explicit
     `peercompute.compute.gpu-fence-report.v0` without locally double-leasing
     the lane. This gives the next scene/NodeKernel integration a scheduled
     task shape while keeping ComputeManager as lease owner.
   - 2026-06-13 partial: ULG now exposes the same shape for the full repeated
     resident sequence. `createMlsMpmResidentStepsComputeTask()` packages the
     local SPH/MLS-MPM pass DAG as one GPU-lane task with law-node metadata,
     state-family read/write declarations, retained-buffer refs, and a
     sequence-level copy budget. `refreshMlsMpmResidentSteps()` can submit this
     task through a ComputeManager-compatible inline `submitTask()` surface and
     will only publish local scene state when an execution envelope is returned.
     Submit-only async tasks remain blocked until StateManager committed-delta
     retrieval exists.
   - 2026-06-13 contract gate: ULG now tests that resident sequence task shape
     against the real sibling PeerCompute `ComputeManager`. The positive gate
     proves lane lease acquire/complete, satisfied GPU fence reporting,
     task-execution envelope attachment, and fence-before-commit behavior. The
     negative gate proves a missing required GPU fence releases the lane without
     committing a delta. This confirms the current shape is compatible with the
     real ComputeManager resident-lane authority layer.
   - 2026-06-13 mounted-loop wiring: the mounted SPH phase auto scheduler now
     resolves a provided ComputeManager-compatible host from mount/runtime/global
     state and passes it into resident sequence execution on
     `ulg:sph-resident:demo-auto`. The fallback remains direct local execution,
     but the normal browser loop can now use a provided authority without
     changing scene call sites. Remaining work is to provide the actual
     PeerCompute/GPUHub/StateManager host in-browser.
   - 2026-06-13 compact-delta slice: the real ULG resident sequence task now
     emits a compact commit delta with state key, law graph node, output
     families, satisfied fence evidence, retained-buffer refs, and final-step
     summaries. This is the admission payload for the next StateManager/DataState
     slice and keeps full GPU-resident buffers behind lane refs instead of
     copying them into committed CPU state.
   - 2026-06-13 StateManager admission bridge: ULG now has a narrow bridge
     that validates resident sequence commit deltas before handing them to
     PeerCompute `StateManager.commitDelta()`. The real sibling
     `ComputeManager` integration test proves the full local chain from GPU
     resident lane fence through warm `DataState` storage, and rejects
     unsatisfied committed payload fences. This keeps the copy-avoidance plan
     intact: hot buffers stay behind lane refs while warm state receives only
     compact, fence-backed deltas.
   - 2026-06-14 scene publication gate: the SPH scene now reads the matching
     StateManager warm delta before publishing ComputeManager-returned hot
     execution artifacts when a StateManager host is supplied. This preserves
     the hot/warm split: GPUBuffer-bearing execution remains local to the lane,
     while the publication authority is the compact committed warm delta. The
     next copy-avoidance step is a real browser NodeKernel/GPUHub host that owns
     both the resident lane and StateManager by default.
2. Extend solver descriptors with residency hints:
   - `residency: "gpu-lane" | "worker-cpu" | "worker-wasm" | "service-warm"`;
   - `stateKey`;
   - `domainKey`;
   - `requiresSameDevice`;
   - `readFamilies`;
   - `writeFamilies`;
   - `retainedBuffers`;
   - `maxReadbackBytes`.
3. Add a copy budget to every hot law task:
   - expected upload bytes;
   - expected readback bytes;
   - retained GPU bytes;
   - compact summary bytes;
   - reason for any full readback.
4. Route ULG resident physics passes through one lane per active state key
   before trying to split work across child GPU workers.
5. Add domain partitioning later:
   - tile/domain ownership;
   - halo or boundary exchange;
   - compact boundary summaries;
   - distributed peer placement;
   - cross-device transfer accounting.
6. Add warm service host policy for Eshkol and MoonLab:
   - pre-spawn when a scenario declares low-latency closure needs;
   - keep WASM modules, response artifacts, and validation fixtures warm within
     budget;
   - expose readiness and warm-cache state in telemetry;
   - release only under idle TTL, memory pressure, explicit cancellation, or
     quarantine.
7. Extend NetViz/debug output:
   - GPU lane owner;
   - active pass DAG;
   - hot-buffer handles and byte totals;
   - upload/readback byte counters;
   - warm Eshkol/MoonLab service state;
   - idle TTL and memory-pressure status.

## Acceptance Gates

- A resident ULG step can run P2G -> grid update -> G2P -> thermal/phase ->
  reaction/product/gas -> pressure/interface on the same GPU lane without full
  particle readback.
- The only per-frame CPU transfers are declared compact summaries or explicit
  diagnostics.
- Eshkol and MoonLab can be pre-spawned and kept warm for an interactive
  scenario, with readiness, memory budget, idle TTL, and cache state visible.
- Cancelling a root task releases or marks all GPU lane leases and service
  leases without destroying unrelated warm service state.
- Device loss or validation failure quarantines the affected lane/service and
  prevents stale retained buffers from becoming authority.
- Required remote GPU lane tasks fail admission when their queue/lane fence
  report is missing or unsatisfied.
- ULG resident SPH steps expose lane lease/fence/copy-budget evidence locally
  before the true distributed lane backend is introduced.
- Declared local `ComputeManager` tasks with GPU-lane residency acquire,
  complete, or reject lane leases before commit, and cannot commit an
  authoritative delta when a required fence is absent or unsatisfied.
- ULG resident MLS-MPM/SPH can be packaged as a ComputeManager-compatible task
  that declares GPU-lane residency and returns required fence evidence without
  importing PeerCompute or creating a second scheduler.
