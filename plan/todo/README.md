# ULG Todo Priority Index

Date: 2026-06-14 AKDT

Use this file as the active routing layer for `plan/todo/`. The detailed todo
files remain valid, but implementation order now starts with the screenshot-
backed P0 physics behavior regression. Authority and distributed law execution
remain the long-term shape, but they do not count as done while the visible
physics loop is incoherent.

## Non-Negotiable Direction

- Do not remove or demote physics laws. ULG exists to add more laws and connect
  them from first principles.
- Do separate law content from law authority. Laws may be authored in ULG,
  Eshkol, MoonLab, or service artifacts, but distributed execution and accepted
  state mutation must be supervised through PeerCompute's NodeKernel,
  ComputeManager, and StateManager path.
- Do not let the browser scene become a second scheduler. The scene can host a
  local reference path and a visualization, but the long-term runtime is a
  PeerCompute-managed graph of laws, closures, workers, leases, caches, and
  admitted compact state deltas.
- Do not let renderer cadence decide physics cadence. Physics extraction stages
  can feed rendering, but pressure, interface, gas, and product state cannot
  depend on whether a visible mesh was drawn this frame.
- Every major todo item must finish with a dense visual sequence sanity check
  over representative scenarios, not only unit tests. The sequence must capture
  close-spaced frames plus resident diagnostics, visible surface bounds, and
  simulation-time cadence proving the resident state advanced between sampled
  frames.
- Physics behavior work must run atomic scientific invariant checks before
  visual tuning or integrated demo fixes. Use `npm run test:physics-atomics`
  as the current fast gate and extend it whenever a new law group or failure
  class is touched.

## Active Priority Order

Current routing note, 2026-06-15 04:13 AKDT: the local gas-cell pressure field
contract has first CPU and WebGPU support. ULG can now represent per-cell gas
pressure and pressure gradients, sample them at material-interface centroids,
and produce pressure/interface force rows from either uniform sealed-gas
pressure or local nearest-cell/gradient reconstruction. Next priority is to
make those local gas-cell fields resident and admitted: publish retained
gas-cell pressure buffers through NodeKernel/StateManager, then make the
pressureInterface stage consume admitted Worker-local gas-cell refs inside the
ComputeManager/GPUHub DAG.

Current routing note, 2026-06-15 03:52 AKDT: the pressure/interface stage now
labels its current gas pressure law as uniform single-cell sealed-gas pressure
and explicitly blocks local pressure-gradient coupling until a resident gas
cell/EOS gradient field exists. Keep the uniform interface traction law; it is
still a valid first-principles pressure force row producer. The next pressure
slice should add the resident local gas-cell pressure-gradient field contract
and then move pressure-gradient force coupling into WebGPU/Worker execution
under ComputeManager/GPUHub authority.

Current routing note, 2026-06-15 03:39 AKDT: pressure/interface Worker
publication is now WebGPU-retained-only. Candidate readiness and NodeKernel/
StateManager publication reject CPU-reference or cloneable pressure force-row
arrays for the worker-retained pressure path. Continue pressure/readback
copy-reduction toward resident gas-cell/local pressure-gradient fields and
eventual GPU-resident surface extraction; do not treat cloneable pressure
arrays as an accepted distributed hot-buffer format.

Renderer blocker update, 2026-06-15 03:46 AKDT: user reports major z-buffer
issues with draw order are still visible. Keep this as a queued renderer
visual-correctness blocker independent from the pressure/local-gas-cell physics
slice. The follow-up pass must use close-spaced visual sequences and explicit
depth/draw metadata to prove transparent sorting, opaque depth writes,
container/grid overlay policy, nested water/solid surface identity, and
focus-change/context-resume behavior before visual captures are treated as
trusted physics evidence.

Current routing note, 2026-06-15 03:25 AKDT: scene pressure-row upload
admission is complete. The browser scene can surface pressure/interface
candidate force-row telemetry, but it cannot upload or feed those rows into
resident mechanics unless the same admitted grid-force consumption descriptor
and solver approval are present. The default browser gate now expects
`resident-pressure-interface-force-rows-admission-required` plus blocked upload
status for unadmitted pressure rows, and the resident continuation state key
stays lane-stable across reset/continuation. Continue pressure/readback
copy-reduction and PeerCompute/GPUHub law-stage promotion; keep the renderer
z-buffer/focus-change follow-up queued as a separate visual correctness item.

Renderer blocker update, 2026-06-15 02:59 AKDT: user reports additional major
z-buffer/draw-order problems in the live view. Treat renderer depth/order as
still open until a follow-up pass reproduces it with close-spaced frame
captures and validates Three.js fallback plus any raw WebGPU overlay path for
nested transparent/opaque surfaces, container/grid overlays, focus-change
flash/disappear, and surface identity stability. Do not treat visual captures
as authoritative physics evidence when this reproduces; record the artifact
and either fix the renderer pass or mark the capture as visually suspect.

Current routing note, 2026-06-15 02:20 AKDT: first renderer depth-order pass is
complete. The immediate Three.js bug was per-surface hash offsets on
transparent MarchingCubes meshes: those offsets prevented Three's transparent
object sorter from ordering overlapping water/vapor/alpha surfaces by camera
depth. Transparent meshes now share their layer order, opaque meshes keep
stable hash ordering, and the diagnostic floor grid no longer writes depth.
Keep the live-device focus-change flash/disappear symptom queued as a follow-up
if it still reproduces; otherwise return to pressure/readback surface reduction
and GPU-resident law graph promotion.

Current routing note, 2026-06-15 02:05 AKDT: grid-update pressure/interface
consumption now treats retained GPU force-row buffers as first-class submitted
work instead of collapsing missing CPU rows into zero impulse evidence. The
WebGPU grid-update wrapper requires the same admitted grid-force descriptor as
the CPU path, records retained-buffer submissions as unverified no-full GPU
work, and the pressure/interface StateManager publication records stride,
byte length, buffer residency, and same-lane consumer protocol. Next priority:
finish broad validation for this slice, then continue pressure/readback
copy-reduction or take the queued z-buffer/draw-order renderer blocker if the
visual harness cannot be trusted.

Current routing note, 2026-06-15 01:51 AKDT: the pressure/interface force-row
producer now has a WebGPU-resident path. The new WGSL kernel consumes packed
material-interface elements, writes the same 16-float pressure force-row ABI
as the CPU oracle, and retains the output `forceRowsBuffer` for no-full
Worker execution. The resident Worker now passes the raw retained pressure
row buffer from `pressureInterface` to `gridUpdate` on the same lane; the
same-frame admitted descriptor remains required before grid consumption. Next
priority: reduce remaining pressure publication/consumption copies and
readback surfaces, then schedule the queued renderer z-buffer/draw-order pass.

Renderer blocker update, 2026-06-15 01:57 AKDT: user again reports major
z-buffer/draw-order issues in the live view. Keep this queued as a renderer
P0/P1 after the current pressure/residency copy-reduction slice and before any
claim that visual captures are authoritative. The pass must verify depth-test,
depth-write, transparent sorting, container/grid overlays, nested surfaces, and
the focus-change flash/disappear symptom against close-spaced frame captures.
Partially addressed by the 2026-06-15 02:20 transparent-depth-sort pass; keep
focus-change flashing/disappearing and any remaining nested-surface artifact
open until reproduced against the live device/browser path.

Current routing note, 2026-06-15 01:33 AKDT: same-frame intra-DAG
pressure/interface publication and grid-update admission are complete for the
ComputeManager/GPUHub stage-plan path. With
`approveSameFramePressureInterfaceGridForces=true`, `pressureInterface`
publishes its retained force-row descriptor before `gridUpdate` executes,
creates
`peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0`, and
injects that admitted descriptor plus an approved pressure solver into the
`gridUpdate` Worker context. The next priority is moving the
pressure/interface force-row producer away from CPU-reference rows toward a
WebGPU-resident stage while keeping NodeKernel/StateManager admission and
GPUHub lane authority intact.

Current routing note, 2026-06-15 01:14 AKDT: grid-update pressure consumption
now has an explicit admission gate. Direct force solvers are blocked unless
paired with `peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0`
and `gridForceApplicationApproved=true`; successful consumption reports
admission status, source hot-buffer key, force-row count, applied impulse, and
impulse proof diagnostics. The next priority is same-frame intra-DAG pressure
publication/admission: when `pressureInterface` runs immediately before
`gridUpdate`, the stage-plan executor must publish/admit the force-row
descriptor before the `gridUpdate` task is created, rather than relying on a
prior-frame descriptor supplied by the caller.

Current routing note, 2026-06-15 00:53 AKDT: pressure/interface force-row
output now has a Worker-retained publication/admission path. The
`pressureInterface` stage builds a dedicated compact publication candidate,
the authority host exposes `publishWorkerRetainedPressureInterfaceStageOutput()`,
and admitted descriptors are stored as StateManager hot records plus warm
deltas under `ulg-worker-retained-pressure-interface-publications`. This is
still non-mutating; the admitted payload explicitly carries
`gridForceApplicationApproved=false`. The next priority is the approved
grid-update consumer slice: grid update may consume pressure/interface rows
only from an admitted descriptor and must report force-row count, impulse,
pairwise conservation residuals, and authority status.

Current routing note, 2026-06-15 00:34 AKDT: the first
pressure/interface force-row producer stage now exists under the formal
ComputeManager/GPUHub stage DAG. `pressureInterface` runs after `p2g` and
before `gridUpdate`, reads `resident-gas-pressure` plus
`sph-material-interface-field`, writes candidate
`pressure-interface-force-rows`, and remains non-authoritative with grid force
application explicitly not approved. The next priority is pressure/interface
retained-ref publication/admission through NodeKernel/StateManager, followed
by an explicitly approved grid-update consumption slice with conservation and
impulse evidence.

Current routing note, 2026-06-15 00:13 AKDT: Worker-retained
reaction/product output now has a NodeKernel/StateManager publication path.
`reactionProduct` builds a dedicated compact publication candidate, requires
Worker-ready WebGPU no-full execution plus retained product refs, calls a
reaction/product-specific publisher, stores the Worker retained-ref descriptor
as a StateManager hot record, and commits an admitted warm delta under
`ulg-worker-retained-reaction-product-publications`. This completes the
reaction/product admission slice as evidence/non-authoritative state
publication. Next priority is pressure/interface force-row promotion behind
the same ComputeManager/GPUHub Worker authority, then wiring downstream stages
to consume admitted retained-ref descriptors rather than private lane records.

Current routing note, 2026-06-15 00:01 AKDT: the first reaction/product
ComputeManager stage boundary and Worker/GPUHub DAG slot now exist. ULG
exposes `createSphReactionProductStageComputeTask()` and
`runSphReactionProductStageComputeTask()`, the resident Worker accepts
`reactionProduct`, and the injected PeerCompute integration proves
`p2g -> gridUpdate -> g2p -> thermalPhase -> reactionProduct` executes through
GPUHub resident-stage executors with all five stages `worker-ready`. The
reaction no-full wrapper now accepts retained WebGPU output without stale CPU
parity. This stage is still evidence-only and non-authoritative; next priority
is to add Worker-retained reaction/product publication/admission through
NodeKernel/StateManager, then promote pressure/interface rows behind the same
ComputeManager/GPUHub worker authority.

Current routing note, 2026-06-14 23:36 AKDT: Worker-retained thermal/phase
output now has its own publication/admission path. Mechanics publication stays
mechanics-only, while `thermalPhase` publishes retained thermo refs under
`peercompute.ulg.thermal-phase-worker-retained-hot-buffer-publication.v0` and
commits a warm StateManager delta with `outputFamilies=["sph-thermo-phase"]`.
The browser authority gate proves hot record storage, live Worker backend,
warm delta admission, and retained thermo refs. Next priority: promote
pressure/interface and reaction/product stages behind the same
ComputeManager/GPUHub Worker authority and make them consume the admitted
thermal retained-ref descriptor. Superseded by the 2026-06-15 00:01
reaction/product stage DAG note above.

Renderer blocker note, 2026-06-14 23:42 AKDT: user reports major z-buffer and
draw-order issues are still visible. Keep this queued as a renderer P0/P1
before treating visual captures as authoritative evidence. The later renderer
pass must test transparent/opaque pass ordering, depth-write/depth-test policy,
nested liquid/solid surfaces, container/grid overlay ordering, focus-change
flash/disappear behavior, and multi-frame draw-order flicker.

Renderer blocker update, 2026-06-15 01:33 AKDT: user reiterated that major
z-buffer/draw-order issues remain. Keep this queued after the current
ComputeManager/GPUHub physics authority slices and before any claim that
browser surface captures are final visual truth.

Current routing note, 2026-06-14 23:23 AKDT: `thermalPhase` now runs as an
opt-in fourth node in the formal ComputeManager/GPUHub stage-plan DAG. The
browser authority-host gate requests `includeThermalPhaseStage=true` on the
same Worker/lane retained continuation, so PeerCompute executes
`p2g -> gridUpdate -> g2p -> thermalPhase` through GPUHub resident-stage
executors instead of a direct test-only Worker call. Validation passed focused
PeerCompute integration, resident-step units, the browser authority gate,
physics atomics, and the representative visual matrix. Next priority: publish
and admit Worker-retained thermal outputs through NodeKernel/StateManager so
downstream pressure/interface and reaction/product stages consume an admitted
thermal retained-ref descriptor rather than only a Worker-local lane record.
Superseded by the 23:36 thermal publication admission note above.

Current routing note, 2026-06-14 23:01 AKDT: the focused browser authority
gate now runs `thermalPhase` on the same warm Worker/lane after the mechanics
Worker continuation. The Worker consumes its retained G2P state and retained
thermo source, builds/uploads thermal response graph buffers inside the Worker
from cloneable scene tables, runs no-full WebGPU thermal execution, waits on
the Worker queue fence, and adopts the emitted retained `thermoBuffer` into
the lane record. This proves the first real browser Worker thermal stage path.
Next priority: fold this into the formal GPUHub stage-plan DAG instead of
calling the Worker directly from the test, then publish/admit thermal retained
outputs through NodeKernel/StateManager. Superseded by the 23:23 formal DAG
note above.

Current routing note, 2026-06-14 22:50 AKDT: the resident-stage Worker module
now accepts a `thermalPhase` stage id. It can run
`runSphThermalPhaseStageComputeTask()`, receive retained state/thermo inputs,
return retained state/thermo outputs, and adopt the emitted `thermoBuffer` into
the Worker lane record. Direct Worker-payload coverage proves this stage shape
with an injected thermal runner. Superseded by the 23:01 live browser Worker
thermal stage gate above.

Current routing note, 2026-06-14 22:42 AKDT: the first thermal/phase
ComputeManager stage-task boundary now exists. ULG exposes
`createSphThermalPhaseStageComputeTask()` and
`runSphThermalPhaseStageComputeTask()` as an evidence-only, commit-suppressed
thermal/phase child task with GPU-lane/fence descriptors, retained state/
thermo outputs, and `thermalPhaseStageTaskAuthority.authoritativeStateMutation
= false`. This is not the Worker thermal law yet; it is the executable task
contract the next Worker module can run under GPUHub/ComputeManager. Next:
register a thermal/phase Worker stage runner that consumes the Worker-retained
G2P state plus retained thermo, emits retained thermal state/thermo, and feeds
that thermo source into reaction/product and mechanics refresh.

Current routing note, 2026-06-14 22:32 AKDT: the Worker mechanics lane now
seeds and reuses a Worker-retained thermo buffer for WebGPU P2G/G2P stages.
The first Worker WebGPU stage creates the thermo buffer once from the CPU
mirror, later P2G/G2P stages borrow it through `sphParticleUpload`, and the
Worker has a generic adoption hook for future thermal/reaction `thermoBuffer`
outputs. This closes the immediate repeated thermo-upload issue in the
mechanics Worker chain. It does not yet move the thermal/phase law stage into
the Worker; next priority is promoting thermal/phase and then pressure/
interface and reaction/product stages under the same ComputeManager/GPUHub
worker authority.

Current routing note, 2026-06-14 22:18 AKDT: the Worker-retained mechanics
stage output can now be consumed by a second mechanics stage-chain run on the
same warm Worker/lane. When the caller sets
`gpuHubResidentStageWorkerUseRetainedInput=true`, P2G uses the prior retained
G2P state/mechanics buffers through the Worker-local lane record instead of
requiring those hot arrays to return through main. Superseded by the 22:32
retained-thermo input slice above.

Renderer blocker note, 2026-06-14 22:18 AKDT; reiterated 2026-06-14 23:08
AKDT: user again reports major z-buffer/draw-order problems. Keep this as an
explicit renderer P0/P1 before claiming visual correctness. Audit transparent
fluid depth-write/test policy, opaque/transparent pass separation, surface
sorting for nested fluids/solids, container/grid overlay ordering, and the
flash/disappear/focus-change symptom. Add a close-spaced browser visual
regression that catches draw-order flicker and vanished volumes independently
from physics-state acceptance.

Current routing note, 2026-06-14 22:06 AKDT: the Worker-retained mechanics
stage output now has an admitted publication path. The browser authority host
exposes `publishWorkerRetainedMechanicsStageOutput()`, which stores a
StateManager hot record containing the live Worker backend plus worker-local
retained refs, and commits a serializable warm delta with
`peercompute.ulg.mechanics-worker-retained-hot-buffer-publication.v0`. The
focused browser gate passes a publisher into the stage-chain runner, keeps the
Worker backend warm when publication commits, and asserts the hot record,
warm delta, and `peercompute.ulg.mechanics-worker-retained-buffer-import.v0`
descriptor exist. This still does not transfer Worker `GPUBuffer` handles to
main; future consumers must address the Worker through the retained-ref
descriptor or implement a worker-side continuation stage.

Current routing note, 2026-06-14 21:50 AKDT: the Worker WebGPU mechanics
stage-chain gate now runs `no-full-readback` instead of full parity readback.
The Worker explicitly waits on its own `queue.onSubmittedWorkDone()` for each
no-full WebGPU stage message, so P2G, grid-update, and G2P report satisfied
stage fences while keeping stage buffers worker-local. ULG now surfaces
`peercompute.ulg.mls-mpm-mechanics-worker-compact-publication-candidate.v0`
on the stage-chain summary: it records worker-retained refs, no-full readback
mode, WebGPU backends, worker-ready residency, and the deliberate publication
blocker `blocked-authorized-worker-publication-required`. Superseded by the
22:06 admitted worker-retained publication path above.

Current routing note, 2026-06-14 21:36 AKDT: the focused browser authority
gate now proves real browser Worker WebGPU mechanics stage execution. The
test creates `host.createUlgMechanicsResidentStageWorkerRunner()`, requests
`preferWebGpu=true`, runs P2G, grid-update, and G2P through the checked-in
Worker module, and asserts all three worker stage backends report `webgpu`
with `worker-ready` residency. This closes the first in-worker WebGPU
acceptance gate, but not the final copy-free path. Superseded by the 21:50
no-full Worker gate above.

Renderer blocker note, 2026-06-14 21:36 AKDT: user reports major z-buffer and
draw-order failures in the live visualization. Keep this queued as renderer
correctness debt before claiming visual correctness: audit depth write/test
policy, transparent fluid sorting, opaque/transparent pass separation,
container/grid overlay ordering, nested fluid/solid surfaces, and the
reported flash/disappear behavior where volumes briefly render and then vanish
until a browser/app focus change. Add a visual/browser regression that samples
multi-frame render state and catches depth-order flicker, not just physics
state.

Current routing note, 2026-06-14 21:24 AKDT: ULG now has a checked-in
mechanics resident-stage Worker module and the browser authority-host gate
creates a PeerCompute `createResidentStageWorkerBackend()` runner for it. The
focused browser test runs P2G, grid-update, and G2P through the real browser
Worker bridge and reports `worker-ready` for all three stages. This first
module keeps raw stage outputs in a worker-local lane store and returns
clone-safe summaries/values to the main thread; it is still CPU/reference
worker execution unless WebGPU is explicitly validated in the worker. Next
priority: promote the worker path to worker-owned WebGPU device/buffer
retention so the hot mechanics lane no longer round-trips through main-thread
arrays.

Follow-up note, 2026-06-14 21:29 AKDT: the Worker now caches a Worker-local
WebGPU device result when `preferWebGpu=true`, but the acceptance gate still
needs to prove in-worker WebGPU execution and retained GPU buffers between
stages.

Current routing note, 2026-06-14 21:01 AKDT: ULG mechanics stage-chain
registration can now consume a supplied GPUHub resident-stage worker runner.
When a backend is supplied, P2G, grid-update, and G2P report `worker-ready`,
the stage plan still resolves through `gpu-hub-resident-stage-executor`, and
returned worker values populate the normal stage-result evidence. The default
live path remains truthful `blocked-worker-backend-missing` because ULG still
needs the actual browser worker module that owns its WebGPU device and
retained lane buffers. Next priority: implement that worker-owned backend for
the same stage chain without copying main-thread `GPUBuffer` handles.

Current routing note, 2026-06-14 20:41 AKDT: ULG mechanics stage-chain
registration now requests dedicated worker residency for P2G, grid-update, and
G2P GPUHub stage executors, but the evidence correctly reports
`blocked-worker-backend-missing` until a worker-owned WebGPU device/buffer
backend exists. This makes the next acceptance target explicit without
pretending main-thread `GPUBuffer` handles moved to a child worker. Next
priority: add the real supervised worker-owned backend under
ComputeManager/GPUHub for this same stage chain, then repeat the pattern for
pressure/interface, thermal/phase, and reaction/product stages.

Current routing note, 2026-06-14 20:23 AKDT: ULG mechanics stage-chain
execution now registers P2G, grid-update, and G2P handlers on the
ComputeManager-attached GPUHub and lets `GpuResidentLaneManager` resolve the
stage plan through `gpu-hub-resident-stage-executor` instead of direct ULG
callbacks. Focused Node and browser gates prove all three mechanics stages
use GPUHub executor sources while retaining WebGPU backends, GPU-lane
residency, same parent lane/state key, completed stage-plan execution, and
satisfied fences. Next priority remains supervised GPUHub/ComputeManager
worker residency for this same stage chain, followed by pressure/interface,
thermal/phase, and reaction/product stage promotion.

Deferred renderer blocker noted 2026-06-14 20:24 AKDT: user reports major
z-buffer/draw-order issues in the live visualization. Do not let this distract
from the current GPUHub stage-executor architecture clean point, but keep it
queued as a renderer P0/P1 before claiming visual correctness. The fix should
audit transparent/opaque surface ordering, depth-write/depth-test policy,
nested fluid/solid surfaces, container/grid overlay ordering, and add browser
coverage that catches wrong draw order rather than relying on static
screenshots. Superseded by the 21:36 renderer blocker note above.

Current routing note, 2026-06-14 19:59 AKDT: browser authority-host
validation now proves the same-lane mechanics stage chain can run P2G,
grid-update, and G2P as actual `webgpu` child stage tasks under one parent
ComputeManager lane id/state key. The focused Playwright gate uses
`preferWebGpu=true`, `useNativeTaskGraph=false`, and a shared scene
`deviceResult`, and it asserts WebGPU backends, GPU-lane residencies,
same-lane task summaries, completed stage-plan execution, and satisfied
fences. Next priority is supervised GPUHub/ComputeManager worker residency for
that same stage chain; after that, promote pressure/interface, thermal/phase,
and reaction/product stages behind the same pattern.

Current routing note, 2026-06-14 19:48 AKDT: WebGPU-requested mechanics
stage tasks now inherit the parent lane executor identity instead of creating
three unrelated stage-specific GPU lane descriptors. The non-native lane
executor path stamps P2G, grid-update, and G2P child tasks with the same lane
id/state key, keeps them inline for WebGPU object safety, and records
per-stage lane/backend/residency/fence summaries. This completes the
same-lane authority invariant for the WebGPU-requested path in Node/fallback
validation.

Current routing note, 2026-06-14 19:36 AKDT: the mechanics stage-plan executor
now drives actual ComputeManager stage-task submissions in the non-native
graph path. With `useNativeTaskGraph=false`, the lane executor submits P2G,
grid-update, and G2P stage tasks, records completed stage count/order and
fence evidence, and the mechanics-only step consumes the lane-produced stage
results without duplicate execution. This remains non-authoritative and CPU/
inline in the focused test.

Current routing note, 2026-06-14 19:28 AKDT: the first ULG mechanics consumer
of the PeerCompute lane stage-plan boundary is in place. The existing
mechanics stage-chain helper now wraps real P2G/grid-update/G2P stage graph
outputs in `peercompute.ulg.mls-mpm-mechanics-stage-lane-contract.v0`,
executes the contract through `ComputeManager.executeGpuResidentLaneStagePlan()`,
and records completed stage count/order plus lane fence evidence. This is
still CPU-oracle/native-stage output and remains non-authoritative.

Current routing note, 2026-06-14 19:13 AKDT: the resident sequence contract is
now consumed by sibling PeerCompute's `GpuResidentLaneManager`. The manager
derives `peercompute.compute.gpu-resident-lane-stage-plan.v0`, exposes a
generic `executeStagePlan()` lease-bound stage executor, preserves retained
refs, and returns the stage plan in `ComputeManager` execution envelopes.
This is still not default physics behavior; it is the authority boundary for
moving individual P2G/grid/G2P/thermal/reaction law stages behind
ComputeManager/GPUHub lanes.

Current routing note, 2026-06-14 18:58 AKDT: resident steps tasks now publish
`peercompute.ulg.mls-mpm-resident-sequence-lane-contract.v0` across the task,
solver-registry input, result, and commit-delta surfaces. This is the first
ComputeManager/GPUHub lane contract for the active-grid fused sequence: it
declares the lane-owned P2G -> grid update -> G2P -> compact-summary DAG,
single-owner rules, retained buffers, queue-fence policy, and active-grid
constraints. `defaultEnabled=false` remains mandatory. Next work is still to
move execution behind a real lane-owned worker/stage boundary and then extend
validation to pressure, thermal, reaction/product, and long-horizon liquid
gates.

Current routing note, 2026-06-14 18:50 AKDT: mounted scene opt-in wiring for
the active-grid fused resident mechanics sequence has landed. Browser URLs can
set `residentActiveGrid=1` and `residentFuseSequence=1`; the scene signature,
status overlay, explicit scene probe refresh path, and ComputeManager resident
task options all carry the same policy. The validation artifact
`/tmp/ulg-history-probes/current-scene-active-grid-optin-frames-20260614.json`
is `good` with active dispatch `2744/13824` and two persisted frames. Keep
active-grid default-off. The next priority remains promoting this into a
ComputeManager/GPUHub lane contract and then expanding validation beyond
mechanics-only sparse probes to pressure, thermal, reaction/product, and real
liquid settling gates.

Current routing note, 2026-06-14 08:43 AKDT: yes, architecture authority is now
the active implementation priority because the CPU/reference path, fast
physics atomics, and short visual sanity matrix are strong enough to serve as
guards. Treat CPU/reference as the correctness oracle. Move accepted mutation
behind PeerCompute/NodeKernel/ComputeManager/StateManager authority first, then
continue GPU-resident physics migration under that authority. Do not remove the
physics gates; run atomics and visual sanity after each architecture slice.
Sibling PeerCompute `submitTaskGraph()` now has graph-level cache, placement,
cancellation, stats, active-graph, and optional graph-wide GPU lane lease
evidence, and ULG records those fields in the mechanics stage-chain artifact.
It now also derives graph cache keys from declared state refs, closure refs,
law ids, invalidation refs, units, stable values, and per-node cache inputs.
Graph cache writes now produce explicit cache artifacts with admission and
invalidation metadata. ULG mechanics artifacts are still
`recorded-not-admitted`; this is intentional and prevents replaying physics
outputs before StateManager/NodeKernel admission. The next authority slice has
landed in sibling PeerCompute: `StateManager` owns a CRDT admission and
invalidation ledger for task-graph cache artifacts, `NodeKernel` exposes the
authority facade, and `ComputeManager` only flips local read-through cache
artifacts to admitted when that authority record exists. ULG now proves its
mechanics native stage DAG artifact can be admitted and invalidated through a
NodeKernel-owned StateManager. Next priority is distributed graph
placement/execution semantics using admitted hashes and retained GPU lane refs.
The next NodeKernel routing slice has also landed: mechanics stage-chain task
graphs now use `NodeKernel.submitTaskGraph()` when a real kernel is present,
and the browser authority path reports `node-kernel-submit-task-graph` plus
`nodeKernelOwned=true`. Direct ComputeManager graph submission remains the
fallback for non-kernel tests and standalone helpers. Next priority remains
true distributed graph placement/execution across peers under the same
StateManager/NodeKernel authority. NodeKernel now also fails closed for
non-advisory distributed graph placement until that executor exists; local and
advisory graph requests carry explicit placement-preflight status instead of
silently pretending to be distributed. The first sibling PeerCompute remote
task-graph executor now exists for explicit target peers: non-advisory graphs
with `targetPeerIds` send `compute-task-graph`, execute on the responder's
`ComputeManager.submitTaskGraph()`, and return remote graph provenance without
falling back to requester-local graph execution. This is still a first-hop
transport slice; next priority is admitted artifact hashes, retained GPU lane
refs, distributed cache/result sharing, and StateManager admission through
that request/result path before resident ULG physics moves remote by default.
Remote graph results now also carry a cache-artifact admission preflight:
artifacts are `remote-cache-artifact-received-not-admitted` by default, and
explicit admission routes them through NodeKernel/StateManager authority.
Admitted remote graph results now import as local read-through cache entries,
but remote GPU retained-buffer refs are metadata-only and `usableLocally=false`;
the retained-lane/state-family policy report now exists in sibling
PeerCompute. Imported remote results must pass an explicit allowed-family
policy before seeding local warm state, and remote retained-buffer refs report
`local-refresh-required` instead of becoming local WebGPU leases. The next
authority slice has also landed: `NodeKernel.commitRemoteTaskGraphStateSeed()`
can commit an allowed imported remote result with a compact state seed payload
into StateManager warm state. The next slice must implement actual local
hot-buffer refresh execution from those warm seed records, including local
GPU-resident lane acquisition, instead of stopping at metadata. That first
refresh executor surface now also exists in sibling PeerCompute:
`NodeKernel.refreshRemoteTaskGraphHotBuffersFromSeed()` reads the warm seed,
acquires a local GPU resident lane lease, invokes a local refresh executor,
completes a local fence, and commits a refresh delta. The next ULG slice has
now landed: ULG exposes a SPH/MLS-MPM refresh executor that rebuilds real local
SPH state, SPH thermo, and MLS-MPM mechanics WebGPU buffers from an admitted
remote seed payload, stores the non-serializable uploads only in local
StateManager hot storage, and returns local retained-buffer refs to NodeKernel.
The browser authority host now also exposes `refreshRemoteSeedHotBuffers()`,
which commits an admitted remote seed if needed and runs the local ULG refresh
executor through NodeKernel. It now also exposes
`submitTaskGraphWithRemoteSeedHotBufferRefresh()`: an opt-in live remote graph
submit wrapper that submits through NodeKernel, admits/imports the remote cache
artifact when policy allows it, auto-refreshes local SPH/MLS-MPM hot buffers
for allowed state families, and blocks disallowed families such as
`reaction-products` without creating GPU uploads. The mounted resident
scheduler now has a default-off remote-refresh prelude that calls this wrapper
only when `enableRemoteResidentTaskGraphRefresh` is set and a caller supplies a
remote task graph or graph factory. The next priority is building the actual
mounted resident law DAG as a remote graph and placing those law stages on
PeerCompute WebGPU workers under ComputeManager/GPUHub authority, still
guarded by atomics and visual matrix checks.
The first graph-builder slice has now landed: PeerCompute preserves explicit
graph-level `stateSeedPayload` in task-graph results/cache artifacts, and ULG
can build a SPH/MLS-MPM remote seed graph that a real responder
`ComputeManager` executes before NodeKernel admission/import and local
hot-buffer refresh. That graph now has an optional evidence-only resident
compute stage after the seed node, so a responder can execute
`ulg-sph-mls-mpm-resident-steps` with commit deltas suppressed and return
task-result evidence before requester-local hot-buffer refresh. It now also
has a post-stage seed node that derives a full-readback transitional state seed
from the resident result and lets the requester refresh local hot buffers from
that advanced seed after NodeKernel/StateManager admission. Remaining work is
to replace that transitional full-readback seed with actual P2G/grid/G2P/
thermal/reaction/pressure/render WebGPU worker-stage output under
ComputeManager/GPUHub lane authority.
The first compact worker-stage boundary is now in the remote graph as
evidence-only mechanics P2G -> grid update -> G2P nodes before the resident
stage. Grid update and G2P consume upstream node results through PeerCompute
`resultInputs`, the resident stage depends on G2P when enabled, and all of it
stays non-mutating until the admitted compact seed/retained-lane handoff is
implemented.
The next seed-candidate slice has also landed: the graph can insert
`mechanics-stage-state-seed` after G2P. That node derives a full-readback
candidate seed from mechanics stage output, preserves original thermo/phase
rows, and is only selected for refresh when `preferMechanicsStageSeed` is
explicitly set. It remains non-authoritative by default.
The compact boundary for that node has now started: no-full/retained mechanics
G2P output returns a non-refreshable compact candidate with output-buffer byte
evidence, state families, retained refs, GPU-fence status, and explicit
`admissionRequired`/`localRefreshRequired` flags. It does not emit a
`stateSeedPayload`, so local hot-buffer refresh still cannot consume compact
remote output until the admitted retained-lane refresh executor exists.
That compact candidate is now also recorded through
`NodeKernel.commitRemoteTaskGraphCompactCandidate()` when an explicit
mechanics-stage refresh request selects it. The wrapper still blocks
hot-buffer refresh and returns no local buffer refs, which is the desired
authority boundary until a local retained-lane refresh executor can rebuild
admitted compact output into same-device hot buffers.
The next fail-closed refresh surface has now landed as well:
`NodeKernel.refreshRemoteTaskGraphHotBuffersFromCompactCandidate()` reads the
admitted compact-candidate record and refuses to complete without an explicit
local compact refresh executor. ULG exposes
`refreshRemoteCompactCandidateHotBuffers()` plus an opt-in
`attemptCompactCandidateRefresh` path; absent that executor, the reported
refresh remains not completed and still returns no local refs. Blocked/failed
executor results or executor results with no local refs now reject the local
lane instead of completing it. ULG also has a default compact executor contract
that reports `blocked-compact-candidate-local-source-required` unless an
explicit local source seed is attached. The next real implementation item is a
source/materialization path that gives this executor valid local compact data.
No-full mechanics compact candidates now carry a typed
`peercompute.ulg.remote-task-graph-compact-local-refresh-contract.v0` listing
the required state families, required local source roles, remote retained refs,
and accepted materialization modes. Use that contract as the target for the
next source-transfer/import slices.
The first source materialization mode has now landed:
`peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0` carries compact
SPH state, SPH thermo, and MLS-MPM mechanics rows that ULG validates and
uploads into local hot buffers under StateManager hot storage. This is useful
for admission and correctness, but it is still a copy-bearing snapshot mode;
the next mode reduces that copy cost. ULG now also accepts
`peercompute.ulg.remote-task-graph-same-device-retained-buffer-import.v0`,
which aliases an explicit same-device local hot-buffer record without new GPU
uploads or writes. Mechanics G2P stage results can now propagate those
descriptors into compact candidates when a producer supplies one. The remaining
copy-avoidance work is to have real live ComputeManager/GPUHub worker outputs
create the local hot-buffer source record and descriptor automatically, while
remote retained refs stay metadata-only across devices.
Same-device source publication follow-up, 2026-06-14 16:07 AKDT: the resident
authority host now exposes `host.publishSameDeviceHotBufferSource()`, which
stores same-device SPH/MLS-MPM upload handles in StateManager hot storage and
returns a serializable same-device retained-buffer import descriptor. The
integration test now feeds compact same-device candidates from that published
source record rather than a hand-written descriptor. At that point, remaining
work narrowed to automatic use from live ComputeManager/GPUHub outputs when
they already own the handles.
Live same-device source auto-publication, 2026-06-14 16:24 AKDT: the mounted
resident ComputeManager path now calls that publication surface automatically
after StateManager admission when it already owns real same-device SPH state,
SPH thermo, and MLS-MPM mechanics upload handles. The execution carries the
same-device retained-buffer import descriptor and StateManager hot storage
retains the handles. The descriptor is also bridged onto the final G2P
reconstruction metadata so compact candidate builders can discover the live
producer source. The remaining copy-avoidance work is now downstream: admitted
compact worker-stage outputs must consume/propagate that descriptor instead of
falling back to snapshots or full readback, while cross-device remote retained
refs remain metadata-only.
The CPU-SPH solid H2O bug report is now pinned and guarded: cold H2O solid
particles no longer flow through the liquid PBF path, `npm run
test:physics-atomics` includes a solid H2O invariant, and the recurring visual
matrix includes `solid-h2o-cpu-sph` with an expected two-surface solid H2O
render. This does not close liquid H2O settling/free-surface work.
Live-scene solid H2O follow-up, 2026-06-14 16:20 AKDT: the CPU-SPH report was
the missing solid-solid support/contact slice. The solid stayed internally
rigid but sank into the solid base. `sphPhaseCarrier` now resolves solid group
support contact and the visual matrix's `solid-h2o-cpu-sph` scenario now has a
static/support guard. Keep liquid H2O settling/free-surface work open; do not
misclassify this completed solid-support fix as liquid realism.
Law-isolation visual harness follow-up, 2026-06-14 15:57 AKDT: the recurring
visual matrix now includes explicit browser-mounted law-toggle labels for
mechanics-off static, gravity-off static, pressure-off H2O, EOS-off H2O,
thermal-off hot H2O, and reactions-off Na/H2O. The selected run
`codex-law-isolation-matrix-20260614` passed with `failedCount=0` and three
captured frames for all six. Keep these labels in the post-slice visual sanity
rotation; they are diagnostic guards, not permission to remove or demote laws.
Keep Na/H2O reaction-product visual timeouts as a P0 blocker: the five
representative non-Na visual sequence scenarios pass with frames, but Na/H2O
still hard-times out before writing a full result.

0. **P0 PeerCompute authority spine**
   - `peercompute-law-graph-authority-plan.md`
   - `gpu-resident-lanes-and-warm-services-plan.md`
   - `resident-state-authority-contract-plan.md`
   - Goal: make NodeKernel/ComputeManager/StateManager/GPUHub the default
     authority for law execution and accepted state mutation. ULG scene code
     should be a visualization/reference host, not a competing scheduler.
   - Current checkpoint, 2026-06-14 03:44 AKDT: the browser route now
     initializes a real sibling PeerCompute `NodeKernel` in local/no-start
     mode. Its real `ComputeManager`, `StateManager`, and `GPUHub` own the
     default mounted resident authority path, and the NodeKernel-shaped facade
     is now only a fallback. An explicit `startNodeKernelNetwork()` /
     `stopNodeKernelNetwork()` gate now proves browser libp2p can start and
     stop locally without destroying StateManager. The resident SPH/MLS-MPM
     pass DAG is now registered as ComputeManager solver
     `ulg-mls-mpm-sph-resident-steps`, and mounted resident scheduling now
     uses solver-created task envelopes when the real solver registry is
     present while preserving ULG GPU fence, GPU-resident lane, law-graph, and
     StateManager commit evidence. Remote placement is now an explicit gate
     that configures NodeKernel placement executors, ComputeManager placement
     hooks, ULG admission, and PeerCompute quorum validation without
     auto-starting networking or sending resident physics remote by default.
     A deterministic in-memory redundant NodeKernel smoke now proves
     non-advisory remote resident execution, quorum validation, no
     responder-side commit, and requester StateManager admission. That smoke
     now also proves in-memory replicated StateManager convergence by applying
     the requester's encoded Yjs update to a second real StateManager and
     validating the same warm resident delta there. A provider-transport gate
     now proves fresh resident warm deltas move through real
     PeerComputeProvider `yjs-update` broadcasts into a replica StateManager.
     The missing initial state-vector/full-document sync handshake exposed by
     that gate is now implemented in PeerComputeProvider and verified from ULG
     with a late-joining replica that receives a preexisting resident warm
     delta. The live browser/libp2p provider gate now also passes through a
     Playwright-started WSS relay and two real browser NodeKernel authority
     hosts. That gate exposed a provider-sync lifecycle race, now fixed by
     explicit `StateManager.requestProviderSync()` plus post-connect
     NodeKernel sync retries. The next architecture slice is now landed:
     `ComputeManager` registers metadata-only law-family descriptors for
     mechanics, thermal/phase, reaction/product/gas, and pressure/interface,
     including sedenion periodic-table chemistry scoping on the
     reaction/product/gas node. The existing resident pass DAG remains the
     only executable solver; child law-family descriptors are visible to the
     law graph but blocked from direct task creation until they pass
     CPU-reference, conserved-field, GPU fence/lease, StateManager-admission,
     and visual-sequence gates. The host now also derives a concrete law graph
     manifest from the registered descriptors with five nodes, seven
     parent/dependency edges, executable/metadata-only node lists, state-family
     surfaces, and the `metadata-only-until-gated` promotion policy. That
     manifest now includes current/prospective state-family owner maps. The
     pass DAG is the single current owner for admitted particle, mechanics,
     thermo/phase, reaction/product, gas-pressure, and pressure/interface
     families; mechanics is only the first prospective promotion candidate.
     The resident ComputeManager now exposes a ULG promotion admission gate
     that rejects missing evidence, enforces promotion order, and admits the
     mechanics families only when all required evidence is present. That
     admission report now runs as a non-mutating ComputeManager task with
     `suppressCommitDelta: true` while keeping child law descriptors
     metadata-only. The next architecture slice has also landed: a
     non-mutating mechanics promotion evidence task validates structured
     CPU/reference, conserved-field, volume-stability, pressure-disabled,
     owner-map, GPU fence, StateManager admission, committed-delta, and
     visual-sequence evidence, then feeds the admission task. The
     physics/reference fields are now generated by measured CPU resident
     zero-force and gravity-only probes through
     `createUlgMechanicsPromotionReferenceEvidence()`, while browser authority
     tests add live host GPU-fence, StateManager, committed-delta, and
     owner-map context from the actual resident step. The child dry-run gate
     now exists as `ulg-mechanics-child-dry-run`: it runs under
     ComputeManager with `suppressCommitDelta: true`, compares the child
     candidate against measured reference evidence, and contributes
     `mechanics-child-dry-run-parity` before promotion admission. The next
     checkpoint now proves the child candidate is mechanics-only by contract:
     only P2G, grid update, and G2P can run; thermal, reaction, and
     mechanics-refresh stages must be skipped; writes are limited to
     `particle-kinematics` and `mechanics`. The child candidate now routes
     through explicit entrypoint
     `runMlsMpmMechanicsOnlyResidentStepsWithOptionalWebGpu()`, which records
     `mechanics-only-entrypoint-enforced` and forcibly disables non-mechanics
     law stages. That entrypoint now calls the direct split step
     `runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu()` for each substep
     instead of delegating to the generic resident pass DAG step. The direct
     mechanics path now has a ComputeManager-owned non-mutating WebGPU/CPU
     child task envelope,
     `ulg-mls-mpm-mechanics-only-resident-steps`, exposed through the browser
     resident authority host as `submitMechanicsOnlyResidentStepsTask()`. CPU
     oracle runs remain valid without a GPU fence, while WebGPU runs require
     same-device lane/fence evidence. This child task envelope is now required
     by mechanics promotion admission as
     `mechanics-only-child-task-envelope`; the dry-run task validates it and the
     promotion evidence task records it before admission. The child task now
     also emits `mechanics-child-stage-kernel-evidence`, and promotion requires
     it so P2G, grid update, and G2P can be replaced/promoted one at a time
     with explicit stage evidence. The first per-stage gate is now split out:
     `mechanics-child-p2g-stage-evidence` is emitted top-level and under
     `perStageEvidence.p2g`, required by promotion admission, and kept
     `stage-evidence-only-not-authoritative` until the CPU oracle, child task
     envelope, dry-run parity, StateManager admission, GPU fence/lease
     evidence, and visual sanity gates agree. Grid update now has the same
     explicit gate as `mechanics-child-grid-update-stage-evidence`, emitted
     top-level and under `perStageEvidence.gridUpdate`, required by promotion
     admission, and kept evidence-only while it proves transient grid
     read/write scope. G2P now completes the explicit mechanics sub-stage
     gates as `mechanics-child-g2p-stage-evidence`, emitted top-level and
     under `perStageEvidence.g2p`, required by promotion admission, and kept
     evidence-only while it proves transient grid reads plus particle/mechanics
     writes. The first real stage-task boundary is now landed for P2G:
     `ulg-mls-mpm-mechanics-p2g-stage` runs through ComputeManager, wraps the
     existing P2G kernel entrypoint, suppresses pressure/product inputs, writes
     only transient `mls-mpm-grid`, suppresses commit deltas, and emits
     `mechanics-p2g-stage-task-evidence`. Grid update is now landed as
     `ulg-mls-mpm-mechanics-grid-update-stage`, consuming transient P2G grid
     state, suppressing pressure-interface rows, writing only transient updated
     grid state, and emitting `mechanics-grid-update-stage-task-evidence`.
     G2P now completes the stage-task boundary set as
     `ulg-mls-mpm-mechanics-g2p-stage`, consuming transient updated grid
     state, suppressing internal pressure impulses, returning candidate
     particle state plus MLS-MPM mechanics output, and emitting
     `mechanics-g2p-stage-task-evidence`. The first replacement seam is now in
     the mechanics-only split step: optional whole-stage runners can swap a raw
     stage call for a ComputeManager-owned stage task while preserving the
     default path, and the focused gate now proves P2G-only,
     P2G+grid-update, and full P2G+grid-update+G2P replacement this way. The
     next slice has started that lift with
     `runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks()`, a ULG
     helper exposed by the browser resident authority host that submits all
     three mechanics stages through the active ComputeManager and records a
     stage-chain artifact while remaining non-authoritative. Sibling
     PeerCompute now has the first native scheduler primitive,
     `ComputeManager.submitTaskGraph()`, and ULG proves it with the mechanics
     P2G -> grid-update -> G2P stage DAG. The ULG helper now consumes that
     native graph path for CPU-oracle/no-upload stage chains, and the browser
     authority gate executes it. Graph-level lease/cancellation/cache/
     placement evidence now exists on the native graph and is recorded by the
     ULG mechanics stage-chain artifact. Graph cache keys are now
     content-addressed from declared state/closure/law/invalidation inputs and
     per-stage cache input summaries. Cache writes now produce explicit
     artifacts with admission metadata, but ULG mechanics stage artifacts are
     intentionally `recorded-not-admitted`. The next slice has now routed
     those artifacts through StateManager/NodeKernel admission and invalidation:
     StateManager owns the admitted/invalidated artifact ledger, NodeKernel is
     the authority facade, and ComputeManager only consumes local cache entries
     after that admission. Mechanics stage-chain task graphs now also route
     through `NodeKernel.submitTaskGraph()` when a real kernel is available,
     while preserving direct ComputeManager fallback for non-kernel contexts.
     NodeKernel placement preflight now blocks non-advisory peer/cluster graph
     requests without an executor, while recording local/advisory status for
     allowed graph submissions. The first remote task-graph transport now
     exists for explicit target peers, executing through the responder's
     `ComputeManager.submitTaskGraph()` with remote graph provenance and no
     requester-local fallback. Remote graph cache artifacts now carry explicit
     admission preflight and only become admitted when routed through
     NodeKernel/StateManager authority. Admitted remote graph results now
     import as local read-through cache entries while remote retained GPU refs
     remain metadata-only. The next architecture priority is defining when
     those imported remote results may seed warm state or cause local hot
     buffer refresh before any mechanics child law owns writes outside the
     parent pass DAG. Then continue one law family
     at a time,
     deepen GPU resident lanes/warm service residency, and keep long-horizon
     liquid-quality work guarded by the CPU oracle.
     CPU/reference atomics, scoped browser authority checks, and
     representative visual sanity remain mandatory after every slice.

1. **P0 physics behavior regression**
   - `physics-behavior-regression-plan.md`
   - Goal: restore coherent visible/local physics behavior before treating more
     WebGPU migration as success. Reset/playback, pressure/interface force
     application, reaction/product/gas carry-forward, thermal/phase continuity,
     stale mirror guards, and diagnostics must be behaviorally coherent.
   - Latest checkpoint, 2026-06-13 22:47 AKDT: the no-full retained render
     diagnostic can now stop at resident surface-vertex buffers under HTTPS
     without hanging on compact draw metadata/readback. Keep the compact
     metadata/readback lane as a P0 GPU-resident render blocker; do not count
     this as liquid behavior fixed. After that render-diagnostic checkpoint,
     return to the liquid-quality work: long-horizon merge/settle,
     free-surface stability, pulsing/blinking solids, and representative visual
     sequences.
   - Current first code slice: reproduce and pin the screenshot-backed H2O/H2O
     same-material settling failure, including detached floating blobs and
     delayed render-cadence jumps. The post-thermal SPH state handoff,
     GPU-resident mechanics-refresh stage, pressure force-application gate, and
     WebGPU G2P grid-origin handoff are now in place. The resident page cadence
     now honors `substeps=16 target=16`, and the hot loop no longer blocks on
     every no-full-readback mutation stage. Batch motion diagnostics now force
     visual refresh when accumulated resident motion crosses the visible
     threshold even if the final substep displacement is small. The first
     visible render-bounds bug is also fixed: padded-field blob radii now
     preserve physical meters, generated MarchingCubes geometry is clipped to
     the sealed container, and the probe flags out-of-box visible surfaces.
     Short-horizon resident gravity motion is coherent again, so the remaining
     P0 focus is actual same-material liquid settling/contact stability,
     corrected-cadence resident throughput, resident GPU surface draw without
     readback, draw-range-aware vertex budgeting, and close-spaced visual
     evidence over longer horizons. The raw WebGPU surface overlay is now an
     explicit opt-in (`surfaceOverlay=1`) with policy/status telemetry, but it
     currently blocks headless Chromium/SwiftShader and must remain behind the
     default Three/MarchingCubes fallback until it passes visual probes. The
     latest pressure/gas regression search confirms `c81a66a` reproduces the
     separated H2O/H2O scene failure with unapproved pressure rows, oversized
     visible bounds, and a `20.7 m/s` velocity spike after `1 x 16` steps; the
     current dirty tree passes the same short scene probe with pressure rows
     blocked, J near one, visible bounds inside the container, and compact
     COM/AABB telemetry. The live derived-material e2e and post-COM/AABB visual
     sequence pass, with artifacts under
     `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-separated-current-com-bounds/`.
     The next visible-surface slice lowered the default isosurface scale to
     `0.4`, added a particle-AABB-relative surface bounds guard, and passed the
     contact-near H2O/H2O scene probe plus visual sequence with artifacts under
     `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-contact-near-default-blob-0p4/`.
     The active failing guard is now sharper: direct full-readback contact-near
     H2O/H2O reports `same-material-contact-gap-not-closing`. The earlier
     sparse scene `solid:ice` visible-surface split is fixed in the current
     tree by carrying wall temperatures into resident signatures, preserving
     same-material base/drop render domains, and giving sparse render domains a
     scoped default-radius floor without inflating dense base water.
     Latest regression slice: the pressure/gas boundary commit is still
     `c81a66a`, but the fix set inside the dirty tree is now clearer. Gas EOS
     remains nonnegative; condensed Tait pressure is signed again, hidden
     condensed-liquid affine damping has been removed, and finite-volume
     particles now clamp at wall clearance instead of point centers. Direct
     high-drop H2O/H2O is numerically coherent over `256` substeps
     (`drop COM 2.75 -> 2.669350 m`, final drop velocity `-1.25525 m/s`,
     pressure impulse `0`, J near one). The long-horizon visual harness can
     force validation render-field readback, timeout render refreshes, and
     measure drawn MarchingCubes surfaces by `drawRange` instead of the fixed
     `72000` vertex capacity. Corrected visual artifacts now show real
     short-horizon motion for separated and contact-near H2O/H2O, but that is
     not long-horizon liquid settling proof.
     2026-06-13 update: pressure-off did not fix the high-drop H2O/H2O visible
     failure; the proximate bugs were missing thermal wall inputs defaulting the
     resident path toward frozen H2O, same-material render-field/domain
     coalescence, a render-row extraction scope error, and an overly sparse
     3x3x3 drop render kernel. Focused tests pass, the separated high-drop scene
     passes `1 x 16` and `4 x 64` resident scene probes with two visible liquid
     H2O domains and no particle-bound inflation, and law-group checkboxes now
     let mechanics, gravity, pressure, thermal/walls, and reactions be isolated
     from the overlay/URL. A static `gravity=off pressure=off` probe passes with
     zero displacement under `ULG_PROBE_EXPECT_STATIC=1`.
     This is a bounded short-horizon fix, not long-horizon liquid-settling
     proof.
     2026-06-13 08:51 update: the remaining broken liquid behavior is now
     isolated below pressure/gas/thermal/reaction. Direct full-readback
     contact-near H2O/H2O remains `bad` when only mechanics and gravity are
     enabled: the gap changes only about `0.03333 -> 0.02995 m`, the base
     compresses to `J ~= 0.876`, the drop/base cohorts still fail to merge or
     settle like water, and pressure impulse is zero. Hydrostatic base
     initialization and an EOS-off run did not fix the issue. Treat the active
     root-cause target as MLS-MPM mechanics transfer, wall/contact handling,
     volume preservation, and missing liquid constraint laws, not renderer,
     pressure rows, gas, thermal, or reactions. Add a plain SPH/PBF reference
     mode as a P0 diagnostic/fallback lane so ULG can compare MLS-MPM behavior
     against a simpler liquid integrator while preserving the law graph.
     2026-06-13 09:03 update: `mech=mlsmpm|sph` now exists as a UI/probe
     selector. The `sph` path is explicitly labeled
     `plain-sph-cpu-reference`, bypasses resident WebGPU MLS-MPM, and is
     diagnostic only. A short H2O/H2O contact smoke confirms the branch runs,
     but it also reaches high velocities and barely closes the gap over the
     short interval, so the next reference-lane task is wall handling plus
     PBF/incompressibility/viscosity/surface-tension constraints before using
     it as a liquid-quality baseline.
     2026-06-13 09:21 update: the plain SPH reference lane now has
     PBF-style density projection, wall clamping, explicit mechanics telemetry,
     and preflight geometry diagnostics. The old `ironh=0.85` same-material
     "contact" probe was not valid contact: physical support extents overlap
     by `0.15 m`, even though center bounds report a small positive gap.
     Overlapped setups now report `initial-block-geometry-overlap` and the
     probe analysis records `initial-preflight-blocked`. A valid face-contact
     `mech=sph` URL with `ironh=1` is `good` over a short direct probe
     (`maxSpeed 0.080756 m/s`, drop COM moves downward, wall defaults
     `283.15 K`). This improves the reference lane, but it does not clear the
     MLS-MPM resident bug: mechanics+gravity-only MLS-MPM still needs its
     own valid-geometry contact/settling audit.
     2026-06-13 09:51 update: valid-geometry all-laws MLS-MPM direct probes
     preserve volume over `1024` substeps (`J 0.997..1.009`), while
     mechanics+gravity-only collapses to the `J=0.2` floor because the
     incompressibility/EOS law is disabled. The valid-geometry scene probe
     exposed a separate visible render-field bug: sparse 27-particle drops
     were rendered in a too-coarse global field and expanded above particle
     bounds. Sparse resident render-field resolution is now `32`, sparse
     radius inflation is removed, the scene probe is `good`, and the visual
     sequence harness is drawRange-aware. Remaining P0 is now long-horizon
     liquid quality/merge/settle evidence and resident throughput, not the
     invalid `ironh=0.85` overlap or the fixed sparse render-field expansion.
     2026-06-13 10:36 update: the `0.4`/resolution-32 sparse render fix was
     not sufficient for all valid separated H2O/H2O cases. Direct and scene
     probes showed compact particle state and decoded render rows were bounded,
     while MarchingCubes still overshot sparse drop domains and created the
     nested/pulsing visible blob class. The runtime now defaults visible
     surface radius to `0.15`, records decoded material/phase/domain render-row
     bounds, and clamps each generated surface to those bounds plus
     radius-derived padding before the sealed-container clamp. Law-group
     controls are fully wired through runtime/probes, and no-full-readback
     cohort analysis now reports unavailable live cohorts instead of stale
     initial CPU data. The bounds-clipped scene probe
     `/tmp/ulg-history-probes/current-lawmatrix-12-scene-bounds-clipped-5batch.json`
     is `good` with no visual surface issues, and the dense visual artifact
     `h2o-h2o-valid-geometry-bounds-clipped-visual` passed. This closes the
     current render-extraction lie, not the long-horizon water-quality gate.
     2026-06-13 11:00 update: live-state long direct probes now prove the
     all-laws valid-geometry drop is not frozen. Over `1024` substeps /
     `0.512 s`, J stays `0.997748..1.009107`, pressure impulse remains `0`,
     drop COM moves `1.25 -> 0.463889 m`, and center-bound gap shrinks
     `0.183333 -> 0.034447 m`. The analyzer now also reports finite-support
     gap from preflight geometry, because center-bound gap made a physically
     touching setup look separated by one particle-radius sum. Support-gap
     smoke shows `~0 -> -0.01625 m` after `0.128 s`. Remaining P0 is therefore
     not "drop is frozen"; it is visually validated merged/settled liquid
     behavior, free-surface quality, and making this evidence cheap enough to
     run routinely without full readback.
     2026-06-13 11:35 update: base/drop cohort diagnostics now exist in the
     compact no-full resident summary. The summary ABI appends optional
     initial-order cohort rows, the shader uses a 32-lane reduction to stay
     under workgroup-storage limits, and the probe passes base/drop ranges into
     resident steps. No-full compact-cohort smoke is `good` over `0.128 s` with
     drop COM `1.25 -> 1.159897 m`, support gap `~0 -> -0.01625 m`, J
     `0.998833..1.006488`, and pressure impulse `0`. Remaining work is to make
     compact summary timing cheap enough for long visual matrices and pair this
     live-state evidence with scene/visual free-surface checks.
     2026-06-13 12:25 update: the screenshot-backed detached/nested water
     artifact is now pinned as a render-field currentness/aliasing chain, not a
     single vague physics failure. Stale retained MarchingCubes surfaces are
     hidden when they no longer fit current particle-derived bounds;
     same-material/same-phase H2O render domains merge into one visible
     material field while base/drop diagnostics remain separate; sparse
     render-only radius floor is `0.2`; and merged same-material fields use
     render resolution `32`. The decisive current-render scene probe
     `/tmp/ulg-history-probes/reassess-10-scene-all-laws-tight-long-merged-res32-render-every-batch.json`
     is `good` over `8 x 64` no-full resident batches with no visual issues,
     H2O visible in all samples, J `0.998677..1.008176`, drop COM
     `1.2498 -> 0.9031 m`, and pressure impulse `0`. The post-item visual
     sequence also passed and wrote GIF/WebM artifacts under
     `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-valid-merged-res32-current-render-pass/`.
     Remaining P0 is still true liquid quality/settling over longer horizons
     and render/capture throughput; `renderEvery=2` is explicitly stale-cadence
     evidence for moving liquid and should not be used as a current-render
     correctness gate.
     2026-06-13 atomic-gate update: added `npm run test:physics-atomics` for
     zero-force rest, free-space gravity-only motion, mass conservation,
     bounded `J`, law-group isolation, and zero disabled-pressure impulse. The
     suite initially failed on gravity-only transfer and H2O/H2O
     mechanics+gravity-only volume drift. Fix: non-solid particles with the
     EOS/pressure law disabled now move ballistically but do not let APIC
     affine residue mutate deformation volume in either CPU carrier or
     resident CPU/WGSL G2P. Focused atomics, nearby MLS-MPM/SPH tests, and
     full `npm test` pass. Direct resident evidence:
     `/tmp/ulg-history-probes/current-atomicgate-valid-mechanics-gravity-only-256-g2p-scale.json`
     is `good` over `256` substeps with disabled-pressure impulse `0`, J
     exactly `1..1`, max speed about `0.135 m/s`, and drop COM
     `1.25 -> 1.235336 m`. Post-item short visual sanity also passed and
     wrote PNG/GIF/WebM/timeline artifacts under
     `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-atomicgate-mech-gravity-pressure-disabled/`;
     limitation: capture cadence is still slow (`~5.4 s` mean interval for a
     `250 ms` target).
     2026-06-13 EOS-on update: expanded `npm run test:physics-atomics` to
     `5/5` with H2O/H2O EOS-on MLS-MPM contact and plain SPH/PBF reference
     lane invariants. The current WebGPU resident direct probe
     `/tmp/ulg-history-probes/current-atomicgate-eos-on-liquid-contact-direct-resident.json`
     is `good` over `256` substeps with J `0.997148..1.006978`, pressure
     impulse `0`, drop COM `1.25 -> 1.159897 m`, and support gap
     `~0 -> -0.016253 m`. The matching visual sequence
     `h2o-h2o-atomicgate-eos-on-liquid-contact` passed and wrote PNG/GIF/WebM
     artifacts; capture cadence is still slow (`~5.35 s` mean interval for a
     `250 ms` target).
     2026-06-13 liquid-quality gate update: `scripts/sph-long-horizon-probe.mjs`
     now has opt-in H2O/H2O same-material quality gates. The merge/render gate
     passes in scene mode at
     `/tmp/ulg-history-probes/current-liquid-quality-merge-optin-scene-256-tolerance-aligned.json`
     with final H2O visible surface count `1`, support gap
     `~0 -> -0.02056 m`, J `0.998788..1.007276`, pressure impulse `0`, and no
     visual surface issues. The settle gate correctly remains `bad` at
     `/tmp/ulg-history-probes/current-liquid-quality-merge-settle-optin-direct-1024.json`:
     `1024` direct substeps / `0.512 s` are still below the `1 s` settle
     horizon and final drop speed is about `1.68 m/s` against the `0.25 m/s`
     gate. Treat merge/contact as pinned and settling/free-surface quality plus
     affordable long horizons as the next P0 target.
     Follow-up `1.024 s` direct settle evidence at
     `/tmp/ulg-history-probes/current-liquid-quality-merge-settle-optin-direct-2048-singlebatch.json`
     reaches the declared horizon and still fails
     `liquid-settle-final-drop-speed>0.25` with final drop speed about
     `1.43 m/s`, J `0.985629..1.026000`, and pressure impulse `0`. That same
     single-batch run took about `399 s`, with compact-summary wait about
     `368 s`, so the next P0 slice must address both physical settling laws
     and compact-summary/long-horizon throughput.
     2026-06-14 atomic-settle status: `npm run test:physics-liquid-atomic`
     now passes the opt-in node-level long-horizon acceptance gate. Current
     measured CPU-driver evidence after `1.024 s`: support gap about
     `-0.125 m`, final drop speed about `0.196 m/s` against the `0.25 m/s`
     gate, bounded J `1.046..1.049`, and conserved mass. This is useful
     CPU/reference evidence.
     2026-06-14 direct-resident no-full settle status: the
     `/tmp/ulg-history-probes/current-liquid-settle-direct-resident-nofull-2048-20260614.json`
     probe reaches `1.024 s` over `2048` resident substeps and classifies
     `good`: final drop max speed about `0.1935 m/s`, support gap about
     `-0.1079 m`, bounded J about `0.9500..1.0490`, pressure impulse `0`.
     This closes retained direct-resident telemetry for the scenario, but not
     the browser scene/MarchingCubes visual settle proof. The run took about
     `431.4 s`, with compact summary about `342.7 s`, so compact-summary/
     readback throughput is now the immediate P0 before this can be part of
     routine visual validation.
     2026-06-14 fence-attribution status: compact-summary telemetry now splits
     setup/encode/submit/`mapAsync`/decode timing. A `64`-substep no-full
     H2O/H2O probe spends about `14.49 s` in final summary `mapAsync` for a
     `336` byte row; system Chrome/Vulkan stays about the same; thermal/
     reaction-off mechanics-only still spends about `13.50 s`. The summary row
     is not the real cost. The first readback is draining queued resident
     mechanics command buffers. Prioritize fused/sparse P2G -> grid update ->
     G2P execution under ComputeManager/GPU lane authority.
     2026-06-14 active-grid status: the opt-in
     `fuseNoFullResidentMechanicsActiveGrid` path now dispatches only an
     active full-grid row window inside the fused sequence and keeps inactive
     rows zeroed for G2P. Matched `64`-substep browser probes stayed `good` in
     full-grid and active-grid modes; active-grid reduced compact-summary
     `mapAsync` from about `13.44 s` to about `3.02 s` with `2352/13824`
     active nodes. A `2x64` active run stayed `good` and used resident compact
     bounds for the second batch. Keep this opt-in until scene-paired visual
     validation and ComputeManager/GPU-lane promotion are complete.
   - Rule: architecture plumbing is not done if the demo still behaves
     severely wrong.
- Recurring evidence gate: after each major todo item, run the visual
  sequence harness across same-material liquid/liquid, solid/liquid,
  phase-change steam/water, and reaction/product cases as applicable.
  The harness now accepts `ULG_SPH_VISUAL_URL` and
  `ULG_SPH_VISUAL_LABEL` so those representative scenarios can reuse the
  same capture/test path. Use `npm run probe:sph-long-horizon` with
  `ULG_PROBE_REPO_DIR=<worktree>` for repeatable compact-diagnostic
  comparisons across old commits or isolated worktrees; this is the probe
  that pinned the pressure/gas regression to `c81a66a` and verified the
  current pressure-row gate. Use `ULG_PROBE_MODE=direct-resident` for fast
  retained resident mechanics/thermal telemetry, then pair it with scene
  mode for pressure/render-surface evidence. Use
  `npm run probe:sph-visual-matrix` as the recurring representative scenario
  smoke; select a subset with `ULG_VISUAL_MATRIX_SCENARIOS=<label,...>` when
  only the touched scenario family needs to run.
   - Immediate next slices:
     - run a longer valid-geometry all-laws H2O/H2O merge/settle probe with
       full or admitted cohort readback at sparse checkpoints, so "drop
       descends and merges" is measured from live state rather than stale CPU
       mirrors or short-window render surfaces;
     - promote the active-grid mechanics sequence into a ComputeManager-owned
       GPU resident lane and replace the simple AABB active window with tiled/
       neighbor indexing before making it default;
     - make `ULG_PROBE_EXPECT_LIQUID_SETTLE=1` pass for same-material H2O/H2O
       without disabling laws or relaxing the declared physics thresholds;
     - audit P2G/grid-update/G2P for momentum, volume, wall clearance, and
       same-material contact transfer under valid-geometry mechanics+gravity
       probes;
     - extend the plain SPH/PBF reference mode toward long-horizon
       incompressible/liquid behavior, viscosity, surface tension, and visual
       scene validation before moving it into a ComputeManager-managed WebGPU
       law lane;
     - keep improving visual sequence cadence and resident render throughput;
       current GIF/WebM capture works but still reports slow-capture cadence,
       so it is not yet dense enough to infer subtle fluid motion by eye alone;
     - keep law-group checkboxes in the recurring visual matrix so each law
       group can be tested independently and in combinations.
1. **Authority and state ownership**
   - `peercompute-law-graph-authority-plan.md`
   - `resident-state-authority-contract-plan.md`
   - `gpu-resident-lanes-and-warm-services-plan.md`
   - `physics-loop-authority-diagrams.md`
   - Goal: one authoritative owner per state family and one admitted mutation
     path for distributed compute.
2. **ULG resident-loop bug remediation**
   - `resident-state-authority-contract-plan.md`
   - `webgpu-ocean-mlsmpm-simulator-plan.md`
   - `perf-upgrade.md`
   - Goal: repair the bugs introduced during the WebGPU-resident refactor:
     no-op law output overwrites, render/physics coupling, stale CPU mirrors,
     buffer lifetime mistakes, cadence mismatches, per-substep readback/fence
     stalls, and ambiguous producer/consumer ownership.
3. **Reaction, product, gas, and pressure closure completion**
   - `reaction-stoichiometry-energetics-plan.md`
   - `sedenion-reaction-scoping-plan.md`
   - Goal: keep balanced stoichiometry general, move gas/product ledgers toward
     resident state, use the sedenion reference only as a symbolic candidate
     prefilter, and finish validated pressure-gradient or gas-cell force
     coupling without material-pair scripts.
4. **Steam, water, phase, optics, and ice controls**
   - `phase-resolved-steam-optics-plan.md`
   - `sphphasedemo.md`
   - Goal: distinguish pure vapor from condensed steam, route optics through
     phase state, and make the iron-on-ice scenario preflight honest.
5. **WebGPU hot-loop and surface generation**
   - `webgpu-ocean-mlsmpm-simulator-plan.md`
   - `gpu-resident-lanes-and-warm-services-plan.md`
   - `perf-upgrade.md`
   - Goal: keep particle, grid, gas, wall, product, phase, and surface fields
     GPU resident; use compact summaries instead of full readback.
6. **Material/closure resolver migration**
   - `webgpu-material-property-resolvers-plan.md`
   - Goal: move resolver families into ComputeManager-managed CPU/WASM/WebGPU
     workers with explicit closure provenance, cache keys, validity domains,
     and CPU/WASM reference paths.
7. **Frontier law expansion**
   - `frontier-todo.md`
   - Goal: add radiation, nuclear, Cherenkov, gravity, MHD/PIC, quantum
     response, relativistic, and astrophysical closure paths as law nodes with
     honest validation gates.
8. **PeerCompute, Eshkol, and MoonLab service integration**
   - `peercompute-law-graph-authority-plan.md`
   - `gpu-resident-lanes-and-warm-services-plan.md`
   - `webgpu-material-property-resolvers-plan.md`
   - Goal: run ULG laws and closure derivations through PeerCompute service
     orchestration, keep heavy Eshkol/MoonLab hosts warm when scenario latency
     requires it, use Eshkol for derived closures/reference/WASM/WGSL artifacts,
     and use MoonLab for quantum/many-body response artifacts.
9. **Cold-start and persistence polish**
   - `cold-start-cache-performance-plan.md`
   - Goal: persist only stable schemas and content-addressed closure artifacts
     after the law/state contracts stop moving.
10. **Final validation and packaging**
    - `overarching-completion-plan.md`
    - Goal: complete browser smoke tests, scientific overclaim guards,
      distributed evidence handoff, and production-readable status docs.
11. **Full distributed PeerCompute stack**
    - `distributed-peercompute-network-stack-plan.md`
    - Goal: after the single-node authority and worker-stage contracts are
      stable, stand up this machine as the WSS/STUN/TURN/ICE test environment
      for three browser windows across two computers, proving real distributed
      placement, StateManager sync, cache admission, and GPU-fence gated
      mutation.

## Cache Layering Rule

- Hot cache: worker-local WebGPU buffers and pipeline resources under explicit
  leases, preferably retained inside ComputeManager-owned GPU resident lanes
  when the same state family is being mutated across multiple passes.
- Warm cache: StateManager/DataState deltas, closure handles, compact law
  summaries, admitted state references, and warm Eshkol/MoonLab service hosts
  when scenario latency requires them.
- Cold cache: content-addressed artifacts in browser storage, PeerCompute
  artifact cache, and sibling-repo service outputs.
- Invalidation must include input hash, method/tool hash, validity domain,
  schema version, source/runtime ABI, and validation status.

## Copy-Avoidance Rule

Do not split a single hot resident state across arbitrary GPU child workers just
because child-worker leases exist. First keep each active resident state key on
one GPU lane and move only compact summaries, retained-buffer refs, and admitted
deltas across the control plane. Domain-splitting comes later with explicit
tile ownership and boundary exchange.

2026-06-12 status: PeerCompute now has a passive `GpuResidentLaneManager`,
`ComputeManager` can wrap declared inline GPU-lane tasks before local commit,
and ULG resident MLS-MPM/SPH steps can publish shape-compatible lane lease, copy
budget, retained-buffer-ref, and GPU-fence evidence. The active next step is a
real ComputeManager/GPUHub lane task for the whole SPH pass DAG, not another
local scene-side scheduler.

## Scale Rule

The same law graph must be able to focus resolution by context: quantum and
molecular closures for small scales, continuum SPH/MLS-MPM/finite-volume laws
for materials, and gravity/MHD/PIC/radiation/relativistic laws for astrophysical
contexts. Higher and lower scales can provide boundary conditions and closures,
but only the active focus region should receive hot high-resolution compute.

## Current P0 Reassessment - 2026-06-13 15:01 AKDT

- Do not spend more time treating gas/pressure coupling as the primary H2O/H2O
  liquid-settling cause. The direct law matrix already showed pressure on/off
  was not the proximate remaining failure.
- The first explicit liquid-stability slice is now passing: dynamic viscosity
  is carried through the mechanics ABI/refresh/buffers/CPU carrier/WGSL P2G
  stress, the CPU carrier consumes hydrostatic pressure consistently, and the
  grid update uses a floor-only no-slip boundary.
- The opt-in atomic gate now passes:
  `ULG_RUN_LONG_LIQUID_ATOMIC=1 npm run test:physics-liquid-atomic` reports
  `6/6` passing for the former long-horizon H2O/H2O speed failure.
- The CPU SPH visual path no longer disappears on empty CPU batches. The
  `mech=sph` browser probe classifies `good`, with H2O visible in all sampled
  states and no visual surface issues.
- Priority order inside P0:
  1. Keep the new atomic liquid gate mandatory for SPH/MLS-MPM mechanics edits.
  2. Implement surface tension/free-surface behavior as an explicit law slice,
     not hidden APIC damping and not law removal.
  3. Run representative dense visual sequences for liquid/liquid,
     solid/liquid, steam/water, and reaction/product scenarios.
  4. Reduce compact-summary/readback cost and move the accepted SPH/MLS-MPM law
     DAG behind a ComputeManager/GPUHub resident lane with explicit authority.

2026-06-13 17:20 status: the latest pressure/gas-window failures split into
three narrower bugs and one open orchestration gate. Hot H2O/H2O instability was
thermal conduction/phase overshoot feeding EOS/mechanics; the thermal pass now
has pair/aggregate limiters and conservative default rate. Fe/H2O corruption
was a packed Debye thermal graph and over-broad active-metal/water reaction
scope; Debye graphs now use source metadata/32 samples and Fe/H2O no longer
reacts as zero-barrier water chemistry. The visual matrix can now save PNG
frame sequences (`ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1`). Immediate P0 order is:

1. Keep hot-H2O and Fe/H2O atomics in the focused test set while editing any
   thermal, phase, EOS, reaction, or mechanics buffer path.
2. Fix the mounted-scene Na/H2O timeout without disabling the reaction law.
   Direct resident Na/H2O works, so treat this as product-closure warmup,
   render-scene orchestration, and admission telemetry.
3. Reproduce the user's phone CPU-SPH render lifecycle bug with a mobile
   viewport/page-visibility RAF probe; desktop CPU-SPH probes currently pass.
4. Continue surface tension/free-surface work and move the pass DAG toward a
   ComputeManager/GPUHub resident lane once the representative matrix is
   stable with frame evidence.

2026-06-13 18:05 status: `npm run test:physics-atomics` is passing again after
fixing hydrostatic prestrain and tightening the condensed G2P `J` guard in CPU,
JS resident fallback, and WGSL. Direct resident H2O/H2O mechanics now passes the
`0.95..1.05` J gate with zero pressure impulse. Keep compact-summary/readback
cost high in the queue: the correctness probe still spent about `51.7s` in
compact summary for one `256`-substep no-full batch.

2026-06-13 18:55 status: the current P0 split is sharper. The long liquid gate
passes with a small explicit support-wall damping term carried through CPU,
resident JS fallback, and WGSL G2P, and gated by the viscosity law group. The
mounted `mech=sph` probe now validates the actual CPU-SPH path. CPU
MarchingCubes has a CPU-only raster radius floor/resolution floor so sparse CPU
SPH surfaces no longer vanish because the field under-samples the particles.

Updated immediate priority:

1. Keep the long liquid atomic gate, G2P damping regression, CPU MarchingCubes
   renderer regression, and mounted CPU-SPH frame probe in the recurring
   validation set.
2. Fix no-full resident visual summaries/readback cost. The current
   full-readback path is useful correctness evidence, but final resident
   behavior needs fresh GPU-resident visual diagnostics without round-tripping
   full particle/render fields.
3. Fix mounted Na/H2O reaction/product orchestration without disabling the
   reaction law. Prior evidence points at reaction ledger/readback/product
   handoff, not at pressure removal.
4. Implement explicit surface-tension/free-surface behavior and longer
   settled-liquid visual horizons.
5. Move the accepted SPH/MLS-MPM law DAG into a ComputeManager/GPUHub resident
   lane with authority evidence after the representative matrix is stable.

2026-06-13 19:25 status: the newest catastrophic no-full resident failure was a
G2P WebGPU params ABI bug, not another pressure/thermal/render timing problem.
The G2P params payload is 80 bytes; the GPU uniform buffer was still 64 bytes.
After the write overrun, the shader could see invalid params and write no
particle rows, leaving retained no-full outputs effectively zero. The fix is a
shared `G2P_PARAMS_BYTES = 80` contract plus a fake-device regression that
throws on buffer write overruns. Full-readback G2P parity and short no-full
scene/CPU-SPH probes are good. Do not paper over this class with queue fences:
temporary per-stage fences were removed, and the next structural work is ABI
contract tests for the other WGSL kernels plus cheaper GPU-resident summaries.

Updated immediate priority after the G2P ABI fix:

1. Fix no-full resident visual summaries/readback cost so fresh visual proof
   does not require full particle/render-field round trips.
2. Fix mounted Na/H2O reaction/product orchestration without disabling the
   reaction law.
3. Add the mobile/page-visibility CPU-SPH lifecycle probe for the user's phone
   blank/flash symptom.
4. Continue explicit surface-tension/free-surface behavior and longer
   settled-liquid visual horizons.
5. Move the accepted SPH/MLS-MPM law DAG into a ComputeManager/GPUHub resident
   lane with authority evidence after representative validation stabilizes.

2026-06-13 19:45 status: the first ABI hardening follow-up is complete.
`tests/webgpuKernelAbi.test.mjs` now covers `16` resident scalar params
contracts and compares WGSL struct byte length, JS params ArrayBuffer length,
uniform buffer allocation size, and writeBuffer factory usage. Keep adding to
this guard when new resident law kernels or params structs land. Full
`npm test` passes `496/497` with the one long-horizon liquid gate skipped unless
explicitly enabled, and ICC is refreshed at `227` indexed files / `1071` memory
chunks. The active next P0 is now no-full resident visual summaries/readback
cost, because full-readback remains the correctness path and compact summaries
are still too expensive for routine long visual horizons.

2026-06-13 19:50 status: the no-full compact-summary cost item is partially
complete. Resident compact summaries now have an explicit `particle-visual`
scope for routine visual/cohort diagnostics. It skips the active-grid-node scan
while still reporting mass, momentum, center of mass, particle AABBs, cohorts,
thermal phase totals, and J bounds from resident GPU buffers. The missing grid
evidence is explicit (`activeGridNodeCount=null`,
`activeGridNodeCountAvailable=false`, `gridNodeScanCount=0`), while strict
probes can force `ULG_PROBE_COMPACT_SUMMARY_SCOPE=full`. Direct no-full
H2O/H2O `2 x 1` comparison probes both classify `good`: particle-visual compact
summary was about `3026 ms` cold / `230 ms` warm, full scope was about
`3248 ms` cold / `295 ms` warm. The remaining P0 is therefore not the grid scan
alone; it is the readback/map fence plus cold-start cost. The next slice should
move visual summaries into a retained GPU diagnostic/render lane with sparse
admitted readbacks and warm long-lived services.

Updated immediate priority after the compact-summary scope split:

1. Reduce retained diagnostic/render readback fences for no-full resident visual
   validation; keep `particle-visual` as the cheap routine summary and reserve
   `full` summary scope for strict correctness checkpoints.
2. Fix mounted Na/H2O reaction/product orchestration without disabling the
   reaction law.
3. Extend the mobile/page-visibility CPU-SPH lifecycle probe into real-device
   visual sequence capture if the user's phone still blanks/flashes after the
   synthetic lifecycle fix.
4. Continue explicit surface-tension/free-surface behavior and longer
   settled-liquid visual horizons.
5. Move the accepted SPH/MLS-MPM law DAG into a ComputeManager/GPUHub resident
   lane with authority evidence after representative validation stabilizes.

2026-06-13 20:02 status: the synthetic mobile/page-visibility CPU-SPH
lifecycle slice is complete. CPU-SPH `setParticles()` now forces an immediate
viewport render plus a two-frame RAF refresh burst after applying
MarchingCubes surfaces, and `visibilitychange`/`pageshow` resume use the same
burst path. The focused Playwright mobile-sized H2O/H2O `mech=sph` test steps
the CPU-SPH scene, dispatches visibility/page-show events, and verifies visible
CPU-particle surfaces plus refresh-burst telemetry. This directly targets the
phone symptom where the canvas only repainted after app switching and surfaces
flashed/disappeared. Keep this in the recurring validation set; if the real
phone still fails, escalate from synthetic lifecycle events to device capture
and browser-specific context-loss diagnostics.

Updated immediate priority after the CPU-SPH lifecycle slice:

1. Reduce retained diagnostic/render readback fences for no-full resident visual
   validation; keep `particle-visual` as the cheap routine summary, reserve
   `full` summary scope for strict correctness checkpoints, and use explicit
   no-full surface-summary skip only where stale visible surfaces are acceptable
   evidence.
2. Fix mounted Na/H2O reaction/product orchestration without disabling the
   reaction law.
3. Continue explicit surface-tension/free-surface behavior and longer
   settled-liquid visual horizons, with the CPU-SPH lifecycle test in the
   recurring visual sanity matrix.
4. Move the accepted SPH/MLS-MPM law DAG into a ComputeManager/GPUHub resident
   lane with authority evidence after representative validation stabilizes.

2026-06-13 20:15 status: the next no-full readback-fence slice is complete but
bounded. `refreshSphResidentRenderState()` now accepts
`renderFieldSurfaceSummaryMode=auto|readback|skip`. In skip mode, no-full
render refreshes avoid the compact render-field surface-summary `mapAsync`
readback and report explicit telemetry instead of pretending surface activity
was measured. The long-horizon probe exposes this through
`ULG_PROBE_RENDER_FIELD_SURFACE_SUMMARY_MODE=skip`, and the mounted Playwright
regression verifies WebGPU resident H2O/H2O can run with render rows readback
`false`, render field readback `false`, compact surface summary readback
`false`, and `resident-surface-draw-summary-skipped`. This reduces routine
diagnostic fence pressure only for callers that accept stale visible surfaces
as non-strict evidence. Strict visual correctness, anomaly escalation, and
future default mounted playback still need either readback or the retained GPU
draw/summary lane.

Updated immediate priority after the no-full summary-skip slice:

1. Fix mounted Na/H2O reaction/product orchestration without disabling the
   reaction law.
2. Continue the retained GPU visual diagnostic lane so no-full visual
   correctness can update fresh surfaces without readback.
3. Continue explicit surface-tension/free-surface behavior and longer
   settled-liquid visual horizons.
4. Move the accepted SPH/MLS-MPM law DAG into a ComputeManager/GPUHub resident
   lane with authority evidence after representative validation stabilizes.

2026-06-13 20:31 status: the first mounted Na/H2O orchestration bug is fixed.
Direct mounted scene/probe resident steps now promote the WebGPU resident
product gas-species ledger into the overlay/render gas-pressure summary instead
of leaving display/render pressure at the ambient baseline. The mounted
Na/H2O scene probe classified `good` and reports `h2=24.6kPa`, total pressure
`125.9kPa`, WebGPU `reaction-step-executed`, and retained product mass rows
with EOS sidecar ready. The focused Playwright regression
`SPH phase mounted resident Na/H2O promotes product gas pressure` passes.
Remaining Na/H2O work is longer-horizon product carry-forward, double-count
prevention, visible product/gas presentation, and pressure coupling under the
retained GPU authority path.

Updated immediate priority after the mounted Na/H2O gas-promotion slice:

1. Continue the retained GPU visual diagnostic lane so no-full visual
   correctness can update fresh surfaces without readback.
2. Continue explicit surface-tension/free-surface behavior and longer
   settled-liquid visual horizons.
3. Extend Na/H2O to repeated resident horizons with product carry-forward,
   double-count prevention, and visible product/gas evidence.
4. Move the accepted SPH/MLS-MPM law DAG into a ComputeManager/GPUHub resident
   lane with authority evidence after representative validation stabilizes.

2026-06-13 20:51 status: the retained surface-draw diagnostic lane is now
bounded instead of allowed to hang. `surfaceDrawDiagnosticMode=metadata` can be
requested by mounted render refresh and the long-horizon probe, but it has a
default `100000` render-field-cell budget. Current sparse H2O/H2O fields reach
`272072` cells, so the path returns
`resident-surface-draw-diagnostic-skipped` with
`surface-draw-diagnostic-field-cell-budget-exceeded` instead of wedging
headless Chromium. The previously hanging small scene probe now classifies
`good` with explicit skip telemetry. This is not completion of no-full fresh
surface draw; the next retained visual task is to reduce, tile, or otherwise
budget the surface-vertex/draw metadata path so representative sparse fields
can build under budget.

Updated immediate priority after the diagnostic-budget guard:

1. Reduce or tile retained surface-vertex/draw metadata so no-full visual
   diagnostics can produce fresh GPU-resident surface evidence under budget.
2. Continue explicit surface-tension/free-surface behavior and longer
   settled-liquid visual horizons.
3. Extend Na/H2O to repeated resident horizons with product carry-forward,
   double-count prevention, and visible product/gas evidence.
4. Move the accepted SPH/MLS-MPM law DAG into a ComputeManager/GPUHub resident
   lane with authority evidence after representative validation stabilizes.
