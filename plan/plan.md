# ULG Implementation Plan

## Current Target

Current checkpoint, 2026-06-15 06:09 AKDT: the first spatial gas-cell EOS
producer contract is in place. Aggregate resident gas-species ledgers still
update only the uniform sealed-box pressure and explicitly report
`blocked-resident-spatial-gas-species-ledger-required`; they cannot fabricate
local pressure gradients. A new
`deriveLocalGasCellPressureFieldFromSpatialGasLedger()` path derives per-cell
ideal-gas pressure and nearest-neighbor gradients from a true spatial
gas-species ledger, and positioned gas product-event rows with actual
`positionM` plus `supportVolumeM3` now produce a
`peercompute.ulg.sph-spatial-gas-species-ledger.v0` source for that EOS path.
PressureInterface admission gates remain intact: local-gradient oracle rows
can be computed, but Worker publication/grid consumption still require the
admitted gas-cell field/import path and retained refs. Validation passed
focused gas/pressure coverage, pressure stage coverage, PeerCompute
integration, physics atomics, the browser authority-host gate, and visual
matrix `codex-spatial-gas-cell-eos-producer-20260615` `3/3` with inspected
frames. The frames are nonblank and bounded, but MLS-MPM fragmentation and CPU
SPH stacked/blob behavior remain open physics-quality blockers. Next target:
publish/admit the spatial gas-cell ledger/field as retained ComputeManager/
GPUHub state through NodeKernel/StateManager, then feed it through the existing
host-published gas-cell import path without caller fabrication.

Current checkpoint, 2026-06-15 05:47 AKDT: pressureInterface retained gas-cell
buffer refs are now classified and declared separately from pressure force-row
refs. The pressureInterface stage task adds
`resident-gas-pressure-cells-buffer` to its GPU fence/lane retained refs when
an admitted local gas-cell import or local gas-cell field is present, and the
mechanics resident Worker mirrors that declaration for Worker execution. The
Worker publication candidate now recognizes worker-generated camelCase refs
such as `result.gasPressureCellsBuffer` as gas-cell refs without also counting
them as pressure force-row refs. This lets admitted local gas-cell WebGPU
pressure stages carry worker-retained gas-cell evidence through the
ComputeManager/GPUHub publication candidate into NodeKernel/StateManager
admission. Validation passed syntax checks, focused pressure stage coverage,
PeerCompute integration, resident-stage Worker tests, physics atomics, the
browser authority-host gate, and the three-scenario visual matrix
`codex-pressure-gas-cell-retained-ref-wire-20260615` with inspected frames.
Next target: derive and admit a real resident local gas-cell pressure-gradient
field from EOS/species/material state instead of relying on synthetic/imported
local fields.

Current checkpoint, 2026-06-15 05:28 AKDT: the live browser scene/stage path
now requests pressure/interface gas-cell field imports from the resident
authority host instead of treating caller-built imports as the only route.
`sphPhaseScene` adds a fail-closed publication helper that extracts a ready
local gas-cell pressure-gradient field, explicit
`peercompute.ulg.pressure-interface-gas-cell-field-admission.v0` evidence, and
retained gas-pressure refs from the resident gas-pressure summary, then calls
`host.publishPressureInterfaceGasCellFieldImportSource()` to obtain the
StateManager-backed
`peercompute.ulg.pressure-interface-gas-cell-field-import.v0` descriptor. The
mounted physics loop now threads that import/admission through resident
mechanics, pressure-interface refresh, and render refresh state; state
summaries expose publication status, source hot-buffer key, retained refs, and
blocker status. Validation passed syntax checks, focused scene/renderer tests,
the browser PeerCompute resident authority-host gate, physics atomics, focused
PeerCompute integration, and the three-scenario visual matrix
`codex-scene-gas-cell-import-wire-20260615` with inspected final frames. Next
target: make the actual resident gas-cell pressure-gradient producer publish
admitted retained refs so this path becomes active in normal WebGPU execution,
then continue reducing readback/copy surfaces. Keep the remaining unphysical
liquid/solid behavior, ice flowing in CPU SPH, phone focus flash/disappear, and
z-buffer/draw-order issues as explicit open blockers.

Current checkpoint, 2026-06-15 05:00 AKDT: gas-cell field imports can now be
published through the browser resident authority host and StateManager. The
new
`peercompute.ulg.pressure-interface-gas-cell-field-import-hot-buffer-publication.v0`
record validates admitted field-consumption evidence, retained gas-cell refs,
and a ready local gas-cell snapshot, stores the import in hot state, commits a
warm delta, and returns a
`peercompute.ulg.pressure-interface-gas-cell-field-import.v0` descriptor that
the pressureInterface stage can consume. Focused integration coverage proves
bad admission and missing-ref cases are rejected and that the returned import
drives local-gradient pressure rows. Validation passed syntax checks, focused
PeerCompute integration, physics atomics, and the three-scenario visual matrix
`codex-gas-cell-import-publisher-20260615`. Next target: replace remaining
caller construction in the live scene/stage path with this host-published gas
cell import when resident gas-cell fields are available.

Current checkpoint, 2026-06-15 04:50 AKDT: pressureInterface can now consume
an admitted retained gas-cell field import descriptor. The new
`peercompute.ulg.pressure-interface-gas-cell-field-import.v0` contract requires
ready status, admitted field-consumption evidence, retained gas-cell refs, and
a local gas-cell snapshot before it injects local pressure gradients into the
pressure feedback path. Invalid imports stay visible as blocked import status
and do not silently convert uniform sealed-gas pressure into local-gradient
physics. The mechanics stage DAG passes the import/admission fields through
inline lane execution and Worker common context, so ComputeManager/GPUHub have
a stable input seam for the next StateManager-backed gas-cell source. Validation
passed syntax checks, focused pressureInterface stage coverage, Worker stage
coverage, PeerCompute integration, physics atomics, and the three-scenario
visual matrix `codex-gas-cell-field-import-20260615` with inspected final
frames. Next target: publish/store the gas-cell field import source through
NodeKernel/StateManager rather than constructing it at the caller boundary.

Current checkpoint, 2026-06-15 04:37 AKDT: pressure/interface local gas-cell
field consumption now has an explicit admission contract. A local-gradient
pressureInterface stage reports whether
`peercompute.ulg.pressure-interface-gas-cell-field-admission.v0` approved
consumption of the gas-cell field; missing approval records
`pressure-interface-gas-cell-field-admission-required` and
`blocked-local-gas-cell-field-admission-required` even when force rows can be
computed for local oracle purposes. Worker compact publication candidates now
fail closed for local gas-cell fields unless that admission is present, and
the browser authority host rejects publication attempts that provide retained
gas-cell buffers without admitted field-consumption evidence. Validation
passed syntax checks, focused pressure-interface stage tests, PeerCompute host
publication tests, WebGPU pressure producer coverage, physics atomics, and
the three-scenario visual matrix
`codex-gas-cell-field-admission-20260615` with inspected final frames. Next
target: make pressureInterface consume admitted retained gas-cell refs from
StateManager/GPUHub inside the ComputeManager DAG instead of receiving
caller-supplied local cell fields.

Current checkpoint, 2026-06-15 04:23 AKDT: pressure/interface publication now
preserves and gates retained local gas-cell pressure buffers. When a
pressureInterface stage uses local pressure gradients, the WebGPU producer can
retain the gas-cell input buffer beside the retained force-row buffer; stage
summaries report gas-cell row count, stride, byte length, and retained status.
The Worker compact publication candidate now fail-closes local-gradient
publication unless a worker-retained gas-cell buffer ref is present, and
NodeKernel/StateManager hot/warm publication records preserve the gas-cell
buffer metadata and reject cloneable/local-gradient publications without
retained gas-cell refs. Validation passed focused producer, PeerCompute
publication, resident pressure-stage, physics atomics, browser authority-host,
and visual matrix gates. Next target: make pressureInterface consume admitted
retained local gas-cell refs from StateManager inside the ComputeManager/GPUHub
DAG instead of receiving caller-supplied local cell fields.

Current checkpoint, 2026-06-15 04:13 AKDT: pressure/interface force rows now
have a structured local gas-cell pressure field contract. `gasPressureCellFieldSummary()`
can normalize a ready local gas-cell field with per-cell pressure and
`pressureGradientPaPerM`; the CPU pressure preview/solver samples nearest-cell
pressure plus first-order gradient reconstruction at each interface centroid.
The WebGPU pressure/interface producer now packs the same gas cells into a
12-float row buffer, expands `PressureInterfaceParams` to 32 bytes, binds the
cell buffer at slot 3, and runs the same nearest-cell/gradient reconstruction
in WGSL before writing the existing 16-float force-row ABI. Validation passed
focused pressure/gas tests, WebGPU producer and ABI guards, resident-stage
pressure tests, physics atomics, browser authority-host, and the visual matrix.
Next target: publish/admit resident local gas-cell pressure fields through
NodeKernel/StateManager and thread retained gas-cell buffers across the
ComputeManager/GPUHub stage DAG instead of relying on caller-supplied fields.

Current checkpoint, 2026-06-15 03:52 AKDT: pressure/interface force rows now
carry an explicit pressure-field resolution contract. The sealed-gas pressure
field still uses a conservative one-cell uniform pressure law, but
`gasPressureCellFieldSummary()`, pressure/interface coupling, CPU solver,
WebGPU force-row producer, ComputeManager stage evidence, and lane summaries
now report `pressureFieldMode="uniform-single-cell-sealed-gas"` plus
`localPressureGradientStatus="blocked-uniform-single-cell-field-has-no-local-gradient"`
and
`localPressureGradientForceCouplingStatus="blocked-local-pressure-gradient-field-required"`.
This keeps the existing pressure law while making it impossible to confuse
uniform interface tractions with validated local gas-cell/pressure-gradient
coupling. Focused demo, WebGPU producer, resident-step pressure tests,
physics atomics, browser authority-host, and the three-scenario visual matrix
passed. Next target: implement/admit a resident local gas-cell pressure field
and gradient-coupling producer, while keeping the renderer z-buffer/focus
follow-up separate.

Current checkpoint, 2026-06-15 03:39 AKDT: pressure/interface Worker
publication now fail-closes on WebGPU-retained force-row descriptors. The
Worker compact publication candidate no longer treats CPU-reference or
cloneable force-row arrays as an admissible same-lane pressure output: it
requires WebGPU backend evidence, no-full readback, worker-ready residency,
non-mutating pressure authority, retained force-row refs, and an explicit
retained GPU force-row buffer descriptor. The PeerCompute browser resident
authority host now rejects pressure/interface publication attempts unless the
candidate reports `worker-lane-gpu-buffer-retained` plus
`same-worker-lane-retained-buffer-ref`. Validation passed focused PeerCompute
integration, resident-step pressure coverage, browser authority-host,
physics atomics, and the three-scenario visual matrix. Next target: continue
pressure/readback reduction toward resident gas-cell/local pressure-gradient
fields and keep the renderer z-buffer/focus follow-up separate.

Current checkpoint, 2026-06-15 03:25 AKDT: the mounted scene now fail-closes
pressure/interface force-row uploads behind the same admitted grid-force
descriptor required by grid update. `sphPhaseScene` will keep unapproved
pressure/interface force-row candidates as telemetry only, reporting the
candidate byte length, admission schema/status, and blocker, but it will not
write a scene-local pressure-row `GPUBuffer` or pass the candidate into
resident mechanics signatures until
`peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0` and
the solver both approve grid application. This also fixed the browser
ComputeManager continuation lane drift by excluding unadmitted pressure data
from state signatures and reusing the previous lane-owned state key for
continuations. Validation passed focused unit gates, default and authority-host
browser Playwright gates, physics atomics, and the three-scenario visual
matrix. Next target: continue pressure/readback copy reduction under
ComputeManager/GPUHub authority while keeping the renderer z-buffer/focus
follow-up queued as a separate visual trust blocker.

Current checkpoint, 2026-06-15 02:20 AKDT: the queued Three.js renderer
z-buffer/draw-order blocker has its first concrete fix. Transparent
MarchingCubes surfaces now share their layer render order so Three.js can sort
overlapping transmissive/vapor/alpha meshes by camera depth; only opaque
surfaces keep the hash-stabilized intra-layer order. The floor grid now renders
as a diagnostic overlay without writing to the depth buffer, and the browser
authority gate asserts visible transparent surfaces report the
`three-transparent-depth-sort-within-layer` policy plus grid depth-write
disabled. Validation passed renderer units, the browser authority-host gate,
physics atomics, and the three-scenario visual matrix with inspected PNG
frames. This reduces one real draw-order failure mode, but the phone
focus-change flash/disappear symptom remains a separate live-device regression
to reproduce if the user still sees it.

Current checkpoint, 2026-06-15 02:05 AKDT: pressure/interface grid
consumption now distinguishes retained GPU force-row buffers from CPU-readable
force-row arrays. The WebGPU grid-update wrapper now requires the same
`peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0`
descriptor as the CPU/reference path before applying pressure rows, even when
the force rows arrive as a same-worker retained `GPUBuffer`. Buffer-only
submissions are labeled as submitted/unverified instead of pretending a zero
CPU impulse was measured, and the pressure/interface publication descriptor now
carries force-row stride, byte length, buffer residency, and same-lane consumer
access protocol through StateManager hot and warm records. Next target: run
the broader atomics/browser/visual gates for this slice, then continue reducing
pressure/readback surfaces or move to the queued renderer z-buffer/draw-order
blocker if visual evidence remains suspect.

Current checkpoint, 2026-06-15 01:51 AKDT: pressure/interface force-row
production now has its first WebGPU-resident producer path. ULG adds a
dedicated pressure/interface WGSL kernel that packs material-interface element
rows and dispatches one force-row output per interface element using the same
first-principles uniform-gas-pressure times normal-area law as the CPU oracle.
`runSphPressureInterfaceStageComputeTask()` now uses this WebGPU producer when
`preferWebGpu=true` and a device is available, retaining
`forceRowsBuffer` for no-full hot-loop execution and falling back to the CPU
solver when WebGPU is unavailable. The resident Worker hands the raw retained
pressure force-row buffer from `pressureInterface` to `gridUpdate` on the same
lane, while same-frame StateManager admission remains the authority gate for
grid consumption. Next target: keep reducing readback/copy surfaces between
pressure production, publication, and grid consumption, then address the
queued renderer z-buffer/draw-order blocker before treating browser surfaces
as final visual truth.

Current checkpoint, 2026-06-15 01:33 AKDT: same-frame pressure/interface
force-row publication and grid-update admission now work inside the
ComputeManager/GPUHub stage-plan DAG. When `pressureInterface` runs
immediately before `gridUpdate` with
`approveSameFramePressureInterfaceGridForces=true`, ULG publishes the
Worker-retained force-row descriptor through the pressure/interface publisher,
creates
`peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0`, and
injects the approved solver plus admission object into the `gridUpdate`
worker context before that stage executes. The GPUHub wrapper now preserves
retained buffer refs inside the stage `value` handed to the next stage, so
same-frame consumers do not lose Worker-local retained-ref descriptors at the
PeerCompute lane-manager boundary. Next target: move the pressure/interface
force-row producer itself toward WebGPU-resident execution and keep the
renderer z-buffer/draw-order blocker separate from physics acceptance.

Current checkpoint, 2026-06-15 01:14 AKDT: grid update now refuses
pressure/interface force rows unless they are paired with an explicit admitted
grid-force consumption descriptor. Direct
`pressureInterfaceForceSolver.forceApplicationStatus="apply-to-mls-mpm-grid"`
is no longer sufficient: the solver must also carry
`gridForceApplicationApproved=true`, and grid update must receive a
`peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0`
object tied to admitted `pressure-interface-force-rows`. The CPU reference,
optional WebGPU wrapper, resident step, and grid-update stage task all surface
admission status, source hot-buffer key, force-row count, applied impulse, and
impulse proof diagnostics. This is a prior/admitted-descriptor consumer gate;
same-frame intra-DAG pressure publication before `gridUpdate` remains the next
architecture slice.

Current checkpoint, 2026-06-15 00:53 AKDT: pressure/interface force-row output
now has a Worker-retained publication/admission path through the
NodeKernel/StateManager authority surface. ULG builds
`peercompute.ulg.sph-pressure-interface-worker-compact-publication-candidate.v0`
from the `pressureInterface` stage, exposes
`publishWorkerRetainedPressureInterfaceStageOutput()` on the resident authority
host, stores pressure force-row retained-ref descriptors as hot records under
`peercompute.ulg.pressure-interface-worker-retained-hot-buffer-publication.v0`,
and commits admitted warm deltas in
`ulg-worker-retained-pressure-interface-publications`. The publication remains
non-mutating and carries `gridForceApplicationApproved=false`; the next target
is explicitly approved grid-update consumption of admitted pressure rows with
impulse/conservation evidence.

Current checkpoint, 2026-06-15 00:34 AKDT: the first pressure/interface
force-row producer stage now exists under the ComputeManager/GPUHub stage DAG.
ULG exposes `createSphPressureInterfaceStageComputeTask()` and
`runSphPressureInterfaceStageComputeTask()`, wrapping the existing
gas-pressure/material-interface force-row solver as a non-authoritative
`pressureInterface` stage. The formal opt-in DAG can now execute
`p2g -> pressureInterface -> gridUpdate -> g2p -> thermalPhase -> reactionProduct`
through GPUHub resident-stage executors, and the resident Worker accepts
`pressureInterface` with retained force-row refs. This is producer evidence
only; the next target is admitted pressure/interface retained-ref publication
and then explicitly approved grid-update consumption of those rows.

Current checkpoint, 2026-06-15 00:13 AKDT: Worker-retained
reaction/product output now has a NodeKernel/StateManager publication path.
ULG builds a dedicated
`peercompute.ulg.sph-reaction-product-worker-compact-publication-candidate.v0`
from the `reactionProduct` stage, requires Worker-ready WebGPU no-full
execution plus retained product refs, and publishes admitted descriptors under
`peercompute.ulg.reaction-product-worker-retained-hot-buffer-publication.v0`.
The host stores the live Worker retained-ref descriptor as a hot record and
commits a warm delta in
`ulg-worker-retained-reaction-product-publications` with
`outputFamilies=["sph-particle-state","sph-thermo-phase","mls-mpm-mechanics","resident-product-mass"]`.
Next target: promote pressure/interface force-row production and consumption
behind the same ComputeManager/GPUHub Worker authority, then make downstream
consumers use admitted retained-ref descriptors instead of private lane
records.

Current checkpoint, 2026-06-14 23:36 AKDT: Worker-retained thermal/phase
output now has a NodeKernel/StateManager publication path. ULG splits
mechanics and thermal publication candidates by stage family, publishes
`thermalPhase` retained thermo refs under
`peercompute.ulg.thermal-phase-worker-retained-hot-buffer-publication.v0`, and
commits a warm delta in `ulg-worker-retained-thermal-phase-publications` with
`outputFamilies=["sph-thermo-phase"]`. The focused browser authority gate
asserts the hot record, live Worker backend, warm delta, retained thermo refs,
and admitted output family. Next target: promote pressure/interface and
reaction/product stages behind the same ComputeManager/GPUHub Worker authority,
with downstream consumers using the admitted thermal retained-ref descriptor.

Current checkpoint, 2026-06-14 23:23 AKDT: `thermalPhase` is now part of the
formal ComputeManager/GPUHub stage-plan DAG when
`includeThermalPhaseStage=true`. The browser authority-host gate no longer
calls the Worker thermal stage directly; the retained same-lane continuation
executes `p2g -> gridUpdate -> g2p -> thermalPhase` through
`host.runMechanicsStageTaskChain()`, with GPUHub resident-stage executor
sources, Worker-ready residency, no-full WebGPU execution, queue-fence
evidence, retained thermo input/output summaries, and non-authoritative
thermal task evidence. Next target: publish/admit Worker-retained thermal
outputs through NodeKernel/StateManager instead of only carrying the
`thermoBuffer` inside the Worker lane. Superseded by the 23:36 thermal
publication admission above.

Current checkpoint, 2026-06-14 23:01 AKDT: the browser Worker path now executes
a real `thermalPhase` stage after the same-Worker mechanics continuation. The
focused authority-host gate sends cloneable thermal tables to the already warm
resident-stage Worker, keeps the same lane/state key, lets the Worker consume
its retained G2P state plus retained thermo source, runs no-full WebGPU thermal
execution, satisfies the Worker queue fence, and verifies the Worker adopts the
retained thermal `thermoBuffer`. Thermal no-full acceptance is explicit in
`runSphThermalStepWithOptionalWebGpu()`, so this no longer compares Worker-hot
state against a stale CPU mirror. Next target: promote this direct Worker call
into the formal ComputeManager/GPUHub stage-plan DAG and StateManager
publication path. Superseded by the 23:23 formal GPUHub thermal/phase stage DAG
above.

Current checkpoint, 2026-06-14 22:50 AKDT: the checked-in resident-stage Worker
module now has a `thermalPhase` stage path. The Worker imports
`runSphThermalPhaseStageComputeTask()`, can build retained state/thermo inputs
from the lane record or supplied uploads, and records
`adopted-worker-retained-thermo-output` when the thermal stage emits a retained
`thermoBuffer`. Unit validation proves the direct Worker-payload contract with
an injected thermal runner. Superseded by the 23:01 live browser Worker thermal
stage gate above.

Current checkpoint, 2026-06-14 22:42 AKDT: thermal/phase promotion now has an
executable ComputeManager stage-task boundary. `sphMlsMpmGpuStep.js` exports
`createSphThermalPhaseStageComputeTask()` and
`runSphThermalPhaseStageComputeTask()`, wrapping the existing thermal step in
a GPU-lane/fence-aware, commit-suppressed, evidence-only task. The task reads
retained SPH state/thermo plus mechanics context, writes candidate
`sph-thermo-phase`, retains state/thermo outputs, and reports
`thermalPhaseStageTaskAuthority.authoritativeStateMutation=false`. This sets
up the next Worker slice: register thermal/phase as a GPUHub resident-stage
Worker executor so it runs where the retained Worker buffers live.

Current checkpoint, 2026-06-14 22:32 AKDT: the Worker mechanics lane now
retains thermo input alongside state/mechanics. For WebGPU P2G/G2P stages, the
Worker seeds one retained thermo buffer from the CPU mirror when the lane has
no thermo source yet, then reuses that buffer through `sphParticleUpload` for
later P2G/G2P stages and same-Worker continuations. The Worker result summary
now reports `workerRetainedThermoInputStatus`, and it can adopt future
thermal/reaction `thermoBuffer` outputs as the lane thermo source. Browser
validation asserts retained thermo input on the first Worker stage chain and
the retained continuation. This still keeps the actual thermal/phase law stage
outside the Worker; the next target is promoting thermal/phase execution under
the same ComputeManager/GPUHub Worker authority before pressure/interface and
reaction/product stages.

Current checkpoint, 2026-06-14 22:18 AKDT: the admitted Worker-retained
mechanics publication path now has its first same-Worker continuation consumer.
The focused browser authority-host gate keeps the Worker runner warm after the
first no-full WebGPU stage-chain publication, then runs a second mechanics
stage chain on the same lane with
`gpuHubResidentStageWorkerUseRetainedInput=true`. P2G consumes the previous
Worker-retained G2P state/mechanics buffers through the Worker lane record,
and the test asserts the continuation remains WebGPU/no-full/fence-satisfied
and republishes a retained mechanics descriptor. Superseded by the 22:32
retained-thermo input slice above. Renderer note:
major z-buffer/draw-order failures remain queued as a P0/P1 visual correctness
blocker separate from physics-law acceptance.

Current checkpoint, 2026-06-14 22:06 AKDT: ULG now has an admitted
worker-retained mechanics publication path. The browser authority host exposes
`publishWorkerRetainedMechanicsStageOutput()`, which writes a StateManager hot
record containing the live Worker backend and worker-local retained refs, then
commits a serializable warm delta under
`peercompute.ulg.mechanics-worker-retained-hot-buffer-publication.v0`. The
focused browser gate passes that publisher into
`runMechanicsStageTaskChain()`, validates
`peercompute.ulg.mechanics-worker-retained-buffer-import.v0`, and leaves the
Worker warm when the publication is committed. This is the first actual
authority-compatible publication step for Worker-owned mechanics buffers; the
next target is consuming that worker-retained descriptor from later stages
without falling back to cloned arrays.

Current checkpoint, 2026-06-14 21:50 AKDT: the browser Worker mechanics stage
chain now runs WebGPU with `no-full-readback`. The Worker drains its own queue
with `queue.onSubmittedWorkDone()` for each no-full WebGPU stage message before
returning the result, so P2G, grid-update, and G2P report satisfied per-stage
fences without full particle arrays. `mechanicsStageTaskChain` now exposes
`peercompute.ulg.mls-mpm-mechanics-worker-compact-publication-candidate.v0`,
including worker-retained refs, no-full stage readback modes, WebGPU backends,
worker-ready residency, and a fail-closed publication status:
`blocked-authorized-worker-publication-required`. Superseded by the 22:06
admitted worker-retained publication path above.

Current checkpoint, 2026-06-14 21:36 AKDT: the focused browser authority-host
gate now validates Worker-local WebGPU mechanics stage execution. The test
creates `host.createUlgMechanicsResidentStageWorkerRunner()`, runs the
mechanics stage chain with `preferWebGpu=true`, and asserts P2G, grid-update,
and G2P all report `worker-ready` plus `webgpu` stage backends through the
real browser Worker module. Superseded by the 21:50 no-full Worker gate above.
Renderer note: major z-buffer/draw-order failures are queued as a P0/P1 visual
correctness blocker before any visual gate is treated as authoritative.

Current checkpoint, 2026-06-14 21:24 AKDT: ULG now includes
`src/services/ulgMechanicsResidentStage.worker.js`, a mechanics resident-stage
Worker module for the P2G -> grid-update -> G2P chain. The browser authority
host exposes `createUlgMechanicsResidentStageWorkerRunner()`, which wraps
PeerCompute's `createResidentStageWorkerBackend()` and keeps the Worker
available for stage messages. Focused browser validation now runs the
mechanics chain through the real Worker bridge and reports `worker-ready` for
all three stages. The module stores raw stage outputs in a worker-local lane
record and sends clone-safe values/summaries back to the main thread. This is
not yet the final WebGPU-resident hot path; the next promotion is worker-owned
WebGPU device/buffer retention with compact/authorized state publication.
Follow-up 2026-06-14 21:29 AKDT: the Worker now caches a Worker-local WebGPU
device result when `preferWebGpu=true`, but acceptance still needs to prove
in-worker WebGPU execution and retained GPU buffers between stages.

Current checkpoint, 2026-06-14 21:01 AKDT: ULG mechanics stage-chain
execution can now attach a supplied GPUHub resident-stage worker runner to
the P2G, grid-update, and G2P stage executor registrations. The wrapped
runner preserves the normal stage-result evidence map, so the lane summary
continues to report backend, lane/state key, fence, and retained-buffer
details while PeerCompute marks the worker policy `worker-ready`. Browser and
default execution still stay blocked/fallback until the next implementation
adds a real ULG worker module that owns its WebGPU device and retained lane
buffers.

Current checkpoint, 2026-06-14 20:41 AKDT: ULG mechanics stage-chain
registration now requests dedicated worker residency for P2G, grid-update, and
G2P GPUHub stage executors while truthfully reporting fallback. PeerCompute's
stage results carry `peercompute.gpu.resident-stage-worker-policy.v0`, and ULG
now exposes per-stage worker-residency objects/statuses on
`mechanicsStageTaskChain`. Focused Node and browser gates assert all three
mechanics stages currently report `blocked-worker-backend-missing`, which is
the correct non-overclaiming status until a real worker-owned WebGPU
device/buffer backend exists. Next is that backend: supervised
GPUHub/ComputeManager worker execution for the same stage chain without
transferring main-thread `GPUBuffer` handles or splitting one hot state family
across arbitrary workers.

Current checkpoint, 2026-06-14 20:23 AKDT: ULG mechanics stage-chain
execution now passes through the PeerCompute/GPUHub resident stage executor
registry. The helper registers P2G, grid-update, and G2P handlers on the
ComputeManager-attached GPUHub, then calls
`executeGpuResidentLaneStagePlan()` without direct stage callbacks so
`GpuResidentLaneManager` resolves each stage through
`gpu-hub-resident-stage-executor`. The browser authority-host gate proves the
same WebGPU stage chain still reports WebGPU backends, `gpu-lane` residency,
shared parent lane/state keys, completed stage-plan execution, satisfied
fences, and GPUHub executor sources for all three mechanics stages. This is
still inline GPUHub execution, not a dedicated GPU worker; next is supervised
GPUHub/ComputeManager worker residency for this same stage chain, followed by
pressure/interface, thermal/phase, and reaction/product stage promotion.

Current checkpoint, 2026-06-14 19:59 AKDT: the browser authority-host test
now validates the same-lane WebGPU mechanics stage chain with real browser
WebGPU backends. The test runs `host.runMechanicsStageTaskChain()` with
`preferWebGpu=true`, `useNativeTaskGraph=false`, an explicit shared scene
`deviceResult`, and a parent lane id/state key. It proves the P2G,
grid-update, and G2P child tasks report `webgpu` backend, `gpu-lane`
residency, shared lane/state keys, completed stage-plan execution, and
satisfied fences. This is still inline browser authority-host execution, not
separate GPUHub worker execution; the next promotion is to move this same
stage chain into supervised GPUHub/ComputeManager worker residency and then
repeat the pattern for pressure/interface, thermal/phase, and reaction/product
stages.

Current checkpoint, 2026-06-14 19:48 AKDT: WebGPU-requested mechanics stage
tasks now stay aligned to the parent ComputeManager lane executor. When
`runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks()` submits
P2G, grid-update, and G2P child tasks with `preferWebGpu=true`, the helper
stamps each child descriptor with the parent lane id/state key, keeps the
task inline for GPU object safety, preserves supplied device context, and
publishes per-stage lane id, state key, backend, residency, and fence
evidence on `mechanicsStageTaskChain`. The focused Node integration proves
all three child tasks are `gpu-lane` tasks aligned to the same parent lane and
that their fences satisfy. This is still not proof of real browser GPUHub
worker execution; the next slice is browser/WebGPU same-device retained-buffer
validation under this lane executor, then pressure/interface, thermal/phase,
and reaction/product stage promotion.

Current checkpoint, 2026-06-14 19:36 AKDT: the mechanics stage-plan executor
can now drive actual ComputeManager stage-task submissions when the native
task graph is disabled. `runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks()`
pre-runs `executeGpuResidentLaneStagePlan()` with stage handlers that submit
the P2G, grid-update, and G2P ComputeManager tasks, caches their results, and
lets the mechanics-only step consume those lane-produced stage outputs
without duplicate execution. The focused integration now proves both the
native graph evidence path and the lane-executed stage-task path complete
three ordered stages under the PeerCompute lane contract, still
non-authoritative and `defaultEnabled=false`.

Current checkpoint, 2026-06-14 19:28 AKDT: ULG's mechanics stage-chain helper
now consumes actual P2G -> grid-update -> G2P stage outputs through the
PeerCompute GPU resident lane stage-plan boundary. The path builds
`peercompute.ulg.mls-mpm-mechanics-stage-lane-contract.v0`, acquires a
ComputeManager GPU resident lane lease, runs
`executeGpuResidentLaneStagePlan()` over the native CPU-oracle stage graph
results, completes the lane fence, and records stage-plan schema/status,
execution status, completed stage count, execution order, and fence evidence
on `mechanicsStageTaskChain` and the compact split-path summary. This remains
non-authoritative and `defaultEnabled=false`; it is evidence that the
mechanics stages can sit behind the PeerCompute lane boundary before actual
WebGPU stage mutation is promoted.

Current checkpoint, 2026-06-14 19:13 AKDT: PeerCompute's
`GpuResidentLaneManager` now consumes the ULG resident sequence lane contract
as a first-class lane stage plan. `ComputeManager` preserves
`residentSequenceLaneContract` in normalized GPU resident lane requirements,
passes it into the lane lease, and returns the derived
`peercompute.compute.gpu-resident-lane-stage-plan.v0` in the task execution
envelope. The new generic `executeStagePlan()` boundary can run supplied
stage executors under one active lane lease and merge retained refs before the
lease fence completes. This is still default-off for ULG physics behavior, but
it is the first real PeerCompute/GPUHub lane-owned stage boundary that future
P2G/grid/G2P/thermal/reaction workers can move behind.

Current checkpoint, 2026-06-14 18:58 AKDT: resident steps tasks now carry a
metadata-only `peercompute.ulg.mls-mpm-resident-sequence-lane-contract.v0`.
The contract is attached to the law graph node, WebGPU descriptor, GPU
resident lane descriptor, task data, solver-registry input, compute-task
result, and StateManager commit-delta payload. It declares the lane-owned
P2G -> grid update -> G2P -> compact-summary pass DAG, retained buffers,
read/write families, single-owner rules, queue-fence policy, and active-grid
policy. When `residentFuseSequence=1`/`fuseNoFullResidentMechanicsSequence`
and no-full/final-only requirements are present, it reports a runnable fused
sequence; otherwise it remains a per-step metadata contract. `defaultEnabled`
is false, so this does not promote active-grid or fused sequence to default
execution.

Current checkpoint, 2026-06-14 18:50 AKDT: mounted scene opt-in wiring for
the active-grid fused resident mechanics sequence is in place. Browser URLs
can now request `residentFuseSequence=1`, `residentActiveGrid=1`, and optional
`residentActiveGridSafety=<cells>`; active-grid implies the fused sequence in
the mounted scheduler, the resident signature includes the policy, and the
scene forwards the same options through direct WebGPU execution and
ComputeManager resident-step tasks. The status overlay now reports
`resident policy` and active-grid stage timing. The scene probe sampler also
preserves fused sequence stage timing so analysis can report
`minActiveGridNodeCount`. Validation artifact
`/tmp/ulg-history-probes/current-scene-active-grid-optin-frames-20260614.json`
classified `good`: `16` no-full mounted scene substeps used active-grid
dispatch `2744/13824` nodes, compact-summary `mapAsync` was about `2.57 s`,
J stayed `0.99999..1.00299`, max speed was about `0.107 m/s`, pressure
impulse stayed `0`, and two frames were captured under
`/tmp/ulg-history-probes/scene-active-grid-frames-20260614`. This is a wiring
and performance gate only; the intentionally tiny `27/125` particle visual
probe is not liquid-quality acceptance.

Current checkpoint, 2026-06-14 18:21 AKDT: the first opt-in
active-grid slice for the fused resident mechanics sequence is implemented and
validated. The path is gated by `fuseNoFullResidentMechanicsActiveGrid` /
`ULG_PROBE_FUSE_RESIDENT_ACTIVE_GRID=1`, keeps full-grid buffer layout for
G2P compatibility, clears inactive grid rows with `COPY_DST` grid buffers, and
falls back to full-grid dispatch when no trustworthy resident/CPU bounds exist.
Browser A/B evidence on the same `64`-substep H2O/H2O mechanics-only
direct-resident probe shows full-grid fused sequence `mapAsync` around
`13.44 s` versus active-grid around `3.02 s` with matching mass, J, and motion.
A `2x64` active-grid run stayed `good`; batch two used
`boundsSource=resident-position-bounds`, proving stale CPU mirrors do not drive
the active box after WebGPU owns the state. Keep this path opt-in until it has
scene-paired validation and ComputeManager/GPU-lane ownership, but treat
sparse/tiled/neighbor P2G as the confirmed next performance lever.

Current checkpoint, 2026-06-14 18:32 AKDT: the active-grid request is now
visible at the ComputeManager resident-steps task boundary as
`peercompute.ulg.mls-mpm-active-grid-dispatch-policy.v0`. The policy is
attached to the law graph node, WebGPU descriptor, GPU resident lane
descriptor, task data, solver-registry input, and compute-task result. It
separates `requested` from `enabled`, requiring the fused resident sequence
wrapper before active-grid is advertised as enabled. This is metadata-only
authority plumbing; it does not make active-grid default.

Current checkpoint, 2026-06-14 17:42 AKDT: compact-summary attribution is now
instrumented. A `64`-substep direct-resident no-full H2O/H2O probe spends
about `14.49 s` waiting on the final summary `mapAsync` fence for a `336` byte
summary row; system Chrome/Vulkan and thermal/reaction-off mechanics-only
comparisons stay in the same range. Treat this as queued resident mechanics
work being charged to the first readback fence. The next implementation target
is a fused/sparse resident mechanics lane, not another summary-row shrink.

Current checkpoint, 2026-06-14 17:10 AKDT: the direct-resident no-full H2O/H2O
settle probe now passes the declared retained telemetry gate. The
`/tmp/ulg-history-probes/current-liquid-settle-direct-resident-nofull-2048-20260614.json`
run reached about `1.024 s` over `2048` resident substeps, final drop max
speed was about `0.1935 m/s`, support gap ended near `-0.1079 m`, J stayed
bounded around `0.9500..1.0490`, and pressure impulse stayed `0`. This does
not make the current browser visual loop cheap or fully validated: the batch
took about `431.4 s`, compact summary took about `342.7 s`, and a scene-paired
visual settle gate remains open.

Current checkpoint, 2026-06-14 16:42 AKDT: the opt-in H2O/H2O
CPU/reference long-horizon liquid acceptance now passes in the current tree.
`npm run test:physics-liquid-atomic` reports `8/8`; the measured CPU-driver
fixture reaches about `1.024 s`, stays merged, keeps J around `1.046..1.049`,
and damps final drop speed to about `0.196 m/s` against the `0.25 m/s`
threshold. This updates stale notes that described the node-level gate as
currently failing.

Current checkpoint, 2026-06-14 16:24 AKDT: the mounted resident ComputeManager
path now auto-publishes same-device hot-buffer sources after StateManager
admission when the execution already owns real SPH state, SPH thermo, and
MLS-MPM mechanics WebGPU upload handles. The scene receives the active resident
authority host from the mount, calls `host.publishSameDeviceHotBufferSource()`,
and records `sameDeviceHotBufferSourcePublication` plus
`sameDeviceRetainedBufferImport` on the resident execution. Missing authority,
missing StateManager admission, or missing handles records a skipped
publication reason rather than fabricating a source. The same retained import
is bridged onto final G2P reconstruction metadata so compact candidate builders
can discover the live producer source. Validation passed syntax checks,
mounted remote-refresh unit `4/4`, focused browser authority-host and
auto-scheduler gates `2/2`, focused PeerCompute/ULG integration `11/11`,
physics atomics `7` pass with `1` expected liquid-settle skip, `git diff
--check`, and visual matrix `codex-live-source-g2p-bridge-20260614` with
`failedCount=0`. Next architecture work is to consume/propagate this descriptor
from admitted compact worker-stage outputs while keeping cross-peer retained
refs metadata-only.

Current checkpoint, 2026-06-14 07:53 AKDT: sibling PeerCompute
`ComputeManager.submitTaskGraph()` now carries lifecycle metadata for graph
cache policy, placement policy, cooperative cancellation, active-graph
inspection, stats, and optional graph-wide GPU resident lane leases. ULG wires
those fields through the mechanics P2G -> grid-update -> G2P stage-chain
artifact while keeping the CPU-oracle graph cache record-only. The next
architecture slice is content-addressed closure/state cache keys plus
distributed graph placement/execution semantics. The Na/H2O reaction-product
visual matrix scenario remains a known hard-timeout blocker and is not counted
as physics fixed.

Current checkpoint, 2026-06-14 08:16 AKDT: graph cache keys are now derived
from declared content inputs instead of hand-written strings. PeerCompute
normalizes graph state refs, closure refs, law ids, invalidation refs,
retained-buffer refs, units, stable values, and per-node cache inputs into
`peercompute.compute.task-graph-cache-inputs.v0`, then hashes that material
into the scoped cache key. ULG's mechanics stage-chain graph now records
`content-addressed-inputs` key source, input hash, input schema, key, and
record-only status. The next architecture slice is admitted closure/state
cache artifacts plus distributed graph placement/execution using those hashes.

Current checkpoint, 2026-06-14 08:43 AKDT: task graph cache writes now produce
first-class artifacts with admission metadata. PeerCompute records
`peercompute.compute.task-graph-cache-artifact.v0` and
`peercompute.compute.task-graph-cache-admission.v0` for graph cache writes,
including result hash, input hash, invalidation refs, node result schemas, and
admitted status. Read-through requires an admitted artifact by default. ULG's
mechanics stage-chain graph remains `recorded-not-admitted`, proving
provenance without replaying physics outputs. The next architecture slice is
StateManager/NodeKernel admission and invalidation for these artifacts.

Current checkpoint, 2026-06-14 09:24 AKDT: StateManager/NodeKernel admission
and invalidation has landed for task-graph cache artifacts. PeerCompute
`StateManager` now records admitted/invalidated artifact authority in CRDT
namespaces, `NodeKernel` exposes the facade, and `ComputeManager` only marks
local cache artifacts admitted after that authority record. ULG's mechanics
native stage DAG now proves the artifact can move through NodeKernel-owned
StateManager admission and invalidation. The next architecture slice is
distributed graph placement/execution using admitted hashes and retained GPU
lane refs, still guarded by the CPU oracle, physics atomics, and dense visual
sequence checks.

Current checkpoint, 2026-06-14 10:12 AKDT: mechanics stage-chain task graphs
now route through NodeKernel authority when a real NodeKernel is present.
Sibling PeerCompute exposes `NodeKernel.submitTaskGraph()` and annotates
results with `peercompute.nodekernel.task-graph-authority.v0`; ULG passes the
browser resident authority host's real NodeKernel into the mechanics
P2G -> grid-update -> G2P graph helper. The helper still falls back to direct
ComputeManager graph submission when no kernel wrapper exists, but the default
browser authority path now reports `node-kernel-submit-task-graph` and
`nodeKernelOwned=true`. The next architecture slice remains true distributed
graph placement/execution across peers, using admitted artifact hashes and
retained GPU lane refs under NodeKernel/StateManager authority.

Current checkpoint, 2026-06-14 10:31 AKDT: NodeKernel task-graph placement now
fails closed for non-advisory distributed graph requests. PeerCompute emits
`peercompute.nodekernel.task-graph-placement-preflight.v0`, accepts local and
advisory distributed graph placement with explicit preflight status, and throws
`ERR_NODEKERNEL_DISTRIBUTED_TASK_GRAPH_UNAVAILABLE` when a graph asks for
non-advisory peer/cluster/distributed execution before the distributed graph
executor exists. ULG carries the preflight status in the mechanics stage-chain
artifact; the current CPU-oracle graph reports `local-placement-accepted`.
This prevents false local execution from masquerading as distributed graph
authority while the real executor is still pending.

Current checkpoint, 2026-06-14 11:05 AKDT: sibling PeerCompute now has the
first real remote task-graph transport hop. Non-advisory distributed graphs
still fail closed when no executor exists, but an explicit target peer now
resolves to `network-task-graph:<peer>`, sends `compute-task-graph`, runs on
the responder's `ComputeManager.submitTaskGraph()`, and returns
`peercompute.nodekernel.remote-task-graph-placement-provenance.v0`. The
requester-local ComputeManager graph path is not invoked for that remote
graph. This is not yet default remote resident physics: admitted artifact
hashes, retained GPU lane refs, distributed cache/result sharing, and
StateManager admission still need to be threaded through the graph
request/result path before ULG can move real resident workloads across peers
by default.

Current checkpoint, 2026-06-14 11:24 AKDT: remote task-graph results now carry
explicit cache-artifact admission preflight. PeerCompute annotates remote
cache artifacts with
`peercompute.nodekernel.remote-task-graph-cache-artifact-preflight.v0`;
default status is `remote-cache-artifact-received-not-admitted`, and explicit
`admitRemoteTaskGraphCacheArtifact` routes the artifact object through
NodeKernel/StateManager admission. This keeps distributed result/cache sharing
honest: remote graph output can be observed and admitted as an authority
record, but it is not silently trusted or replayed as local physics state.
Next is to use those admitted remote artifact records with retained GPU lane
refs and distributed cache/result sharing semantics.

Current checkpoint, 2026-06-14 11:43 AKDT: admitted remote task-graph results
can now become actual local read-through cache entries. PeerCompute
`ComputeManager.importRemoteTaskGraphCacheResult()` records
`peercompute.compute.remote-task-graph-cache-import.v0` only after
NodeKernel/StateManager admission, and a later local graph with the same
admitted cache key can return `cacheStatus: hit`. Remote retained GPU lane
refs remain metadata-only with `usableLocally=false`, so distributed cache
sharing does not pretend a remote WebGPU buffer is a local lease. The next ULG
authority step is a retained-lane/state-family policy: decide when an admitted
remote result may seed local warm state or trigger a local hot-buffer
refresh, without bypassing StateManager admission and visual/physics gates.

Current checkpoint, 2026-06-14 state-seed policy slice: sibling PeerCompute
now exposes `ComputeManager.evaluateRemoteTaskGraphStateSeedPolicy()` with
`peercompute.compute.remote-task-graph-state-seed-policy.v0`. Imported remote
cache results can be inspected against explicit allowed state families before
they seed local warm state; disallowed families are blocked. Remote retained
GPU buffer refs remain metadata-only with `usableLocally=false`, and the
policy reports `local-refresh-required` when local hot buffers must be rebuilt
from the admitted remote result. The next architecture step is implementing
that local warm-state seed/hot-buffer refresh execution path under
NodeKernel/StateManager authority, still gated by CPU/reference atomics and
dense visual sequences.

Current checkpoint, 2026-06-14 warm-state seed commit slice: sibling
PeerCompute now exposes `NodeKernel.commitRemoteTaskGraphStateSeed()` with
`peercompute.nodekernel.remote-task-graph-state-seed-authority.v0`. An admitted
remote graph import that passes the allowed state-family policy and carries a
compact state seed payload can now be recorded as a StateManager warm delta
under NodeKernel authority. Remote retained GPU refs remain nonlocal; the
committed seed records `local-refresh-required` when local hot buffers must be
rebuilt. The next step is the actual local hot-buffer refresh executor that
consumes these warm seed records and acquires local GPU-resident lane leases.

Current checkpoint, 2026-06-14 hot-buffer refresh slice: sibling PeerCompute
now exposes `NodeKernel.refreshRemoteTaskGraphHotBuffersFromSeed()` with
`peercompute.nodekernel.remote-task-graph-hot-buffer-refresh.v0`. The method
reads a committed remote warm seed, acquires a local ComputeManager GPU
resident lane lease, invokes a local refresh executor with the compact seed
payload, completes a local fence, and can commit a refresh delta. Remote
retained buffer refs remain seed metadata; only executor-returned local refs
are retained on the local lane.

Current checkpoint, 2026-06-14 ULG hot-buffer refresh executor slice: ULG now
plugs the real SPH/MLS-MPM buffer rebuild into the NodeKernel refresh hook.
`peercompute.ulg.remote-task-graph-sph-mls-mpm-state-seed.v0` carries the
compact state seed; `peercompute.ulg.remote-task-graph-hot-buffer-refresh-result.v0`
records the local refresh result. The ULG executor rebuilds SPH state, SPH
thermo, and MLS-MPM mechanics buffers with the existing GPU buffer pack/upload
helpers, stores the actual WebGPU handles only in local StateManager hot
storage, and returns local retained-buffer refs to NodeKernel. A focused
integration test proves an admitted remote graph cache artifact can be
committed as a warm seed and refreshed into local hot buffers without aliasing
remote GPU refs. The browser resident authority host now also exposes
`refreshRemoteSeedHotBuffers()`, which commits an admitted remote seed if
needed and invokes the ULG executor through NodeKernel, with host summary flags
showing readiness. ULG now also exposes
`submitTaskGraphWithRemoteSeedHotBufferRefresh()`, an opt-in browser authority
wrapper that submits a task graph through NodeKernel and automatically runs the
local hot-buffer refresh only when the remote cache artifact was admitted and
imported. A focused in-memory remote task-graph test proves both the allowed
SPH/MLS-MPM refresh path and the blocked `reaction-products` family path. The
mounted resident scheduler now has an explicit default-off remote-refresh
prelude: `enableRemoteResidentTaskGraphRefresh` calls
`submitTaskGraphWithRemoteSeedHotBufferRefresh()` before the local resident
step only when a caller supplies a remote task graph or graph factory. The
default mounted scene stays local. Remaining architecture work is to express
the real mounted resident pass DAG as a remote graph and place those law
stages on PeerCompute WebGPU workers under ComputeManager/GPUHub lane
authority.

Current checkpoint, 2026-06-14 remote seed graph-builder slice: sibling
PeerCompute `ComputeManager.submitTaskGraph()` now preserves an explicit
graph-level `stateSeedPayload` in the task-graph result and cache artifact.
ULG now exposes `buildUlgSphMlsMpmRemoteSeedTaskGraph()`, a default SPH/
MLS-MPM remote seed graph envelope with cache inputs, StateManager-required
admission metadata, GPU resident lane hints, and a serializable seed-node task
(`runUlgRemoteSphMlsMpmStateSeedGraphNode`). The mounted remote-refresh
prelude uses this builder by default when `driver.demo.state.particles` is
available; if only packed worker view state is available, it skips graph
creation rather than fabricating a seed. A focused integration test now proves
a real responder `ComputeManager` executes the seed-node module, NodeKernel
admits/imports the remote cache artifact, and ULG refreshes local SPH/MLS-MPM
hot buffers from the admitted seed. Remaining architecture work is replacing
the seed-only graph node with the actual remote resident law DAG stages and
WebGPU worker placement.

Current focus, 2026-06-14 07:07 AKDT: architecture authority is the active
priority while CPU/reference physics stays the correctness oracle. The browser
resident route now initializes a real local PeerCompute `NodeKernel` by
default, routes resident SPH/MLS-MPM through its `ComputeManager` and
`StateManager`, exposes an explicit NodeKernel network start/stop gate, and
registers the resident SPH/MLS-MPM pass DAG as a real ComputeManager solver
descriptor. Mounted resident scheduling now uses solver-created task envelopes
when a real `SolverRegistry` is available while preserving ULG GPU fence,
GPU-resident lane, law-graph, and StateManager commit metadata. Remote
placement is now an explicit ULG gate that can configure NodeKernel network
placement executors, ComputeManager placement hooks, ULG admission, and
PeerCompute quorum validation without auto-starting networking or making
resident physics remote by default. A deterministic in-memory redundant
NodeKernel smoke now proves non-advisory remote resident execution, two-result
quorum validation, no responder-side commit, and requester StateManager
admission. The same smoke now also encodes the requester's Yjs StateManager
document and applies it to a second real StateManager, proving in-memory
replicated warm-delta convergence for the admitted resident state. A new
provider-transport gate now proves fresh resident warm deltas can move through
real PeerComputeProvider `yjs-update` broadcasts into a replica StateManager.
The missing initial Yjs state-vector/full-document sync handshake exposed by
that gate is now implemented in sibling PeerCompute and verified from ULG with
a late-joining replica that receives a preexisting resident warm delta. The
live browser/libp2p gate now also passes: ULG starts a local WSS PeerCompute
relay inside Playwright, boots two real browser NodeKernel authority hosts
against it, commits a resident warm delta before the second host joins, and
proves provider sync replays the preexisting delta across the real transport.
That exposed and fixed a second lifecycle bug in PeerCompute: provider sync
requests were firing before network/pubsub settlement, so NodeKernel now
requests sync after connect and retries briefly under a clearable lifecycle
timer. The next architecture slice now publishes law-family graph nodes under
ComputeManager authority: the resident host registers metadata-only child
descriptors for mechanics, thermal/phase, reaction/product/gas, and
pressure/interface while keeping the pass DAG as the only executable solver.
These children are visible to authority tests but blocked from direct task
creation until each family passes CPU-reference, conserved-field,
StateManager-admission, GPU lease/fence, and visual sequence gates. The host
now also derives a concrete resident law graph manifest from those descriptors
with five nodes, seven edges, executable/metadata-only node lists, state-family
surfaces, and the `metadata-only-until-gated` promotion policy. The manifest
now also carries resident state-family owner maps: the pass DAG is the only
current owner for admitted particle, mechanics, thermo/phase, reaction/product,
gas-pressure, and pressure/interface families; child law nodes are only
prospective owners, with mechanics recorded as the first promotion candidate.
The resident ComputeManager now exposes a ULG law-family promotion admission
gate that rejects missing evidence, enforces promotion order, and admits the
mechanics families only when the required evidence map is present. The
admission gate also runs as a local non-mutating ComputeManager task with
`suppressCommitDelta: true`, so promotion decisions exercise the task system
without making child law descriptors executable. The current slice adds a
non-mutating mechanics promotion evidence task that validates structured
CPU/reference, conserved-field, volume-stability, pressure-disabled,
owner-map, GPU fence, StateManager admission, committed-delta, and visual
sequence evidence before feeding the admission task. Those physics/reference
fields are now generated by actual CPU resident zero-force and gravity-only
reference runs through `createUlgMechanicsPromotionReferenceEvidence()`, while
browser authority tests add live host GPU-fence, StateManager, committed-delta,
and owner-map evidence from the resident step. The first non-mutating child
gate now exists: `ulg-mechanics-child-dry-run` runs as a ComputeManager
module task, compares the mechanics child candidate against measured reference
evidence, and contributes `mechanics-child-dry-run-parity` to promotion
admission without making the metadata-only mechanics solver executable. That
candidate now carries an explicit mechanics-only stage contract proving only
P2G, grid update, and G2P ran; thermal, reaction, and mechanics-refresh stages
were skipped; and the child writes only `particle-kinematics` plus
`mechanics`. The mechanics candidate now routes through an explicit
`runMlsMpmMechanicsOnlyResidentStepsWithOptionalWebGpu()` entrypoint that
forcibly disables non-mechanics law stages and records
`mechanics-only-entrypoint-enforced`. The sequence now uses a direct
`runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu()` split step rather
than the generic resident pass-DAG step; that direct step runs only P2G, grid
update, G2P, and optional compact summary. The next authority checkpoint is
now in place: `ulg-mls-mpm-mechanics-only-resident-steps` is a
ComputeManager-owned non-mutating WebGPU/CPU child task envelope for the
mechanics law node. CPU-oracle runs do not require a GPU fence; WebGPU runs use
the same same-device GPU resident lane/fence contract as the resident pass
DAG. The browser resident authority host exposes
`submitMechanicsOnlyResidentStepsTask()` without making the metadata-only
mechanics solver an admitted current owner. That envelope is now a required
promotion artifact: mechanics admission requires
`mechanics-only-child-task-envelope`, the child dry-run validates the envelope,
and the promotion evidence task records it before admission. The next stage
gate is also in place: mechanics child task results now emit
`mechanics-child-stage-kernel-evidence`, and mechanics admission requires that
artifact so P2G, grid update, and G2P can be replaced or promoted one at a
time with explicit per-stage evidence. P2G is now the first independently
named sub-stage artifact: mechanics child task results expose
`mechanics-child-p2g-stage-evidence` top-level and under
`perStageEvidence.p2g`, and mechanics admission requires that key before
promotion. It proves P2G executed through the explicit mechanics-only split
path, used an accepted backend, suppressed pressure-interface forces, wrote
only transient MLS-MPM grid state, and remains
`stage-evidence-only-not-authoritative`. Grid update now has the same
individual gate: mechanics child task results expose
`mechanics-child-grid-update-stage-evidence` top-level and under
`perStageEvidence.gridUpdate`, and mechanics admission requires it before
promotion. It proves grid update executed through the same split path, used an
accepted backend, suppressed pressure-interface forces, touched only transient
MLS-MPM grid state, and remains evidence-only. G2P now completes the
mechanics sub-stage set: mechanics child task results expose
`mechanics-child-g2p-stage-evidence` top-level and under
`perStageEvidence.g2p`, and mechanics admission requires it before promotion.
It proves G2P executed through the split path, used an accepted backend,
suppressed pressure-interface forces, read transient MLS-MPM grid state, wrote
only particle state plus MLS-MPM mechanics, and remains evidence-only. Next:
the first actual stage task boundary is now in place for P2G:
`ulg-mls-mpm-mechanics-p2g-stage` runs under ComputeManager, wraps the existing
P2G kernel entrypoint, suppresses pressure/product inputs, writes only
transient `mls-mpm-grid`, suppresses commit deltas, and emits
`mechanics-p2g-stage-task-evidence`. CPU-oracle P2G tasks do not require a GPU
fence; WebGPU/no-full-readback tasks declare the same lane/fence style as the
resident path. Grid update now has the matching task boundary:
`ulg-mls-mpm-mechanics-grid-update-stage` runs under ComputeManager, consumes
transient P2G grid state, suppresses pressure-interface rows, writes only
transient updated grid state, suppresses commit deltas, and emits
`mechanics-grid-update-stage-task-evidence`. G2P now has the matching task
boundary: `ulg-mls-mpm-mechanics-g2p-stage` runs under ComputeManager,
consumes transient updated grid state, suppresses internal pressure impulses,
returns candidate particle state plus MLS-MPM mechanics output, suppresses
commit deltas, and emits `mechanics-g2p-stage-task-evidence`. The first
replacement seam is now in the mechanics-only split step: optional whole-stage
runners can replace raw P2G/grid-update/G2P calls while preserving the default
raw kernel path, and the focused gate proves P2G-only, P2G+grid-update, and
full P2G+grid-update+G2P replacement through the ComputeManager-owned stage
tasks. A first-class ULG helper now wraps that seam as
`runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks()`: it submits
all three stage tasks through the active ComputeManager, records
`peercompute.ulg.mls-mpm-mechanics-stage-task-chain.v0`, and is exposed by the
browser resident authority host as `runMechanicsStageTaskChain()`. The first
native PeerCompute scheduler primitive now exists: sibling PeerCompute
`ComputeManager.submitTaskGraph()` records
`peercompute.compute.task-graph-result.v0`, validates dependency edges,
executes ready dependency batches, and passes completed upstream results into
downstream task factories. ULG proves it with the mechanics
P2G -> grid-update -> G2P stage DAG. The ULG helper now consumes this native
graph path directly for CPU-oracle/no-upload stage chains, and the browser
authority gate executes `runMechanicsStageTaskChain()` successfully. Next: add
graph-level leases, placement, cancellation, caching, and distributed
execution under the required child-task envelope,
P2G/grid-update/G2P evidence, and CPU oracle. Continue deepening GPU resident
lanes/warm service residency and long-horizon liquid/free-surface quality
fixes under the CPU oracle. Keep
`npm run test:physics-atomics`, scoped browser authority checks, and the
representative visual sanity matrix as required gates after each major slice.

Build the Milestone 0.6 and 0.7 foundation from the v0.5 spec before deeper
physics work:

1. Shared ULG ABI descriptors and schemas.
2. Shared service contract builders, adapter docs, and fixture manifests.
3. Dummy supervised Eshkol and MoonLab services.
4. Child-worker leases and cancellation tree.
5. Browser-visible telemetry and three.js worker-tree visualization.
6. Tests that prove descriptor validation, fixture conformance, lease behavior,
   and the live demo.

## Work Breakdown

### ULG app

- [x] Create vanilla Vite app with three.js visualization.
- [x] Implement shared ABI package in plain ES modules.
- [x] Add JSON schemas for the spec artifacts.
- [x] Export stable service contract builders and cross-repo JSON fixtures.
- [x] Implement PeerCompute-style registry, supervisor, leases, GPU probe, and cache.
- [x] Implement dummy Eshkol and MoonLab service workers.
- [x] Add browser-facing service asset convention and MoonLab WASM locateFile/MIME
  probes for copied artifacts.
- [x] Add a supervised MoonLab classic child worker that instantiates the real
  core WASM runtime and emits Bell-state probabilities into the task artifact.
- [x] Add compact `peercompute.ulg.artifact-summary.v0` browser telemetry so
  PeerCompute-style consumers can see descriptor/parity/calibration readiness
  without fetching full artifact bodies.
- [x] Add an Eshkol closure-bundle service asset convention and browser probe for
  manually staged `scripts/export_ulg_closure_bundle.py` outputs.
- [x] Return staged Eshkol closure bundle artifacts from the supervised service
  worker when the bundle is ready.
- [x] Preserve Eshkol closure entry signature, start-section, import/export,
  WASM metadata count, and DOM-free host-import bundle metadata in compact
  artifact-summary telemetry and the live artifact list.
- [x] Export `peercompute.ulg.demo-handoff.v0` packets from the browser demo
  artifact cache, including same-origin transferred Eshkol WASM bytes for
  PeerCompute/Multiscale ingestion without mixed-content fetches.
- [x] Emit digest-shaped `sha256:` artifact refs from the browser artifact cache
  so relay/service dispatch plans can verify content-addressed handoffs on the
  HTTP VPN demo.
- [x] Surface Eshkol `validation.outputSemantics` smoke-fixture metadata through
  compact artifact-summary telemetry and the browser handoff packet without
  marking the closure scientifically validated.
- [x] Surface Eshkol `validation.closureDescriptor` magnetar fixture metadata
  through compact artifact-summary telemetry and the browser handoff packet,
  preserving transferred WASM bytes while keeping descriptor-only closures out
  of host-runtime/output-smoke execution.
- [x] Expose a separate `createPeerComputeEshkolSmokeHandoff()` browser API that
  keeps the default magnetar descriptor service unchanged while exporting the
  staged `hello` closure bundle with real output semantics and transferred WASM
  bytes for PeerCompute's gated runtime execution proof.
- [x] Surface Eshkol's
  `eshkol.ulg.magnetar-closure-tensor-runtime-contract.v0` through compact
  artifact summaries and staging guards, including tensor ids, contract hash,
  interpolation-table binding, sample-shape validation, and explicit
  non-scientific/full-physics flags.
- [x] Surface Eshkol's `eshkol.ulg.production-handler-boundary.v0` through ULG
  staging guards, compact summaries, browser handoffs, and artifact-list status
  while preserving explicit non-scientific/full-physics flags.
- [x] Surface Eshkol's smoke-only f64 tensor linear-memory layout through ULG
  staging guards, compact summaries, browser handoffs, and live status while
  preserving `entryExportConsumesOffsets = false`.
- [x] Upgrade the staged Eshkol magnetar closure to deterministic tensor-offset
  runtime smoke, including consumed declared offsets, produced output tensors,
  `64` changed declared tensor bytes, and explicit non-production/full-physics
  blockers.
- [x] Surface exact Eshkol tensor-runtime smoke evidence and production blocker
  counts in the visible demo artifact row and `npm run status:live` output.
- [x] Surface Eshkol's production-host-import candidate requirements through
  ULG staging guards, summaries, visible artifact rows, and live status while
  keeping smoke stubs explicitly non-production.
- [x] Surface Eshkol's
  `eshkol.ulg.production-handler-dispatch-preflight.v0` through ULG staging
  guards, compact summaries, browser handoffs, e2e coverage, and live status
  while keeping full-physics readiness blocked.
- [x] Surface Eshkol's computed production dispatch preflight check evidence
  through ULG staging guards, compact summaries, browser handoffs, e2e coverage,
  and live status.
- [x] Surface Eshkol's production-candidate runtime probe as smoke-only evidence
  through ULG staging guards, compact summaries, browser handoffs, e2e coverage,
  and live status while preserving the full-physics blocker.
- [x] Surface Eshkol's declared production handler contract through ULG staging
  guards, compact summaries, browser handoffs, e2e coverage, and live status,
  advancing production dispatch preflight evidence to ten required checks,
  seven passed checks, and three blocked checks before the production-candidate
  handler/runtime evidence slice superseded those counts.
- [x] Surface Eshkol's production-candidate handler implementation and runtime
  execution evidence through ULG staging guards, compact summaries, browser
  handoffs, e2e coverage, and live status, advancing production dispatch
  preflight evidence to ten required checks, nine passed checks, and one
  blocked full-physics check.
- [x] Surface Eshkol's
  `eshkol.ulg.full-physics-validation-requirements.v0` through ULG staging
  guards, compact summaries, browser handoffs, e2e coverage, and live status so
  the remaining full-physics blocker is a concrete five-family evidence contract
  instead of a bare boolean.
- [x] Promote Eshkol's DOM-free `eshkol-host-imports.js` factory to a
  first-class browser/service-worker asset, probe it as JavaScript, import it in
  the supervised Eshkol worker, and expose factory/readiness summary fields
  without invoking the production handler.
- [x] Surface MoonLab's `moonlab.webgpu.complex64-parity-scope.v0` browser
  evidence through ULG staging, core-probe validation, summaries, UI, handoffs,
  and e2e coverage with `device-acquired`, executed/passing
  `compute_probabilities`, `hadamard`, `pauli_x`, `pauli_z`, and `cnot`
  reduced probes, while preserving explicit no-full-physics/no-full-fidelity
  flags.
- [x] Surface MoonLab's compact WebGPU parity handoff summary as reduced-scope
  five-operation evidence for `compute_probabilities`, `hadamard`, `pauli_x`,
  `pauli_z`, and `cnot`, without claiming full MoonLab runtime backend,
  full-fidelity magnetar simulation, or full-physics validation.
- [x] Generalize MoonLab native-operation summary rendering so future blocked
  operations flow through `operationResults[]` without new one-off UI fields.
- [x] Add direct Multiscale launch status detail for scenario/readiness acks
  while preserving the `handoff ready / blockers 0` compatibility prefix.
- [x] Add Phase 1 ULG carrier-runtime foundations: `ClosureRegistry`,
  table-interpolation closure handles, CPU-reference velocity-Verlet carrier
  runtime, invariant drift reports, `peercompute.ulg.simulation-artifact.v0`,
  and a first-class `ulg-runtime` service contract.
- [x] Add `window.__ulgDemo.runOscillatorDemo()` and a retro UI control that
  stores a toy harmonic closure, resolves it from the cache, submits a
  supervised `simulation.step` task, and emits a toy/reference simulation
  artifact without changing the magnetar Eshkol/MoonLab handoff.
- [x] Add Phase 2 WebGPU carrier-runtime plumbing: an optional WGSL
  two-particle carrier step, CPU/WebGPU parity gate, worker-local device-loss
  fallback reporting, GPU broker device-loss lease marking, compact
  simulation WebGPU summary fields, and e2e coverage that accepts WebGPU only
  when parity passes. CPU-reference output remains authoritative and this does
  not claim SPH/material/full-physics validation.
- [x] Add Phase 3A carrier topology primitives without building an SPH demo:
  normalized particle state, deterministic spatial hashes, radius-limited
  neighbor pairs, and closure-sampled edge messages with antisymmetric force
  conservation summaries for future field/material/EOS operators.
- [x] Add Phase 3A field-observer primitives over neighbor graphs, with
  compact-support scalar smoothing summaries and explicit no-SPH/no-material/
  no-phase-change validation scope.
- [x] Surface Phase 3A edge-message conservation summaries through simulation
  artifact summaries, browser artifact rows, and oscillator e2e coverage so
  handoff consumers can distinguish topology/operator evidence from raw deltas.
- [x] Surface Phase 3A field-observer summaries through carrier compact
  deltas, simulation artifact summaries, browser artifact rows, and oscillator
  e2e coverage so handoff consumers can see scalar field-observer operator
  evidence without claiming density, material, SPH, or phase-change readiness.
- [x] Add Phase 3A field-closure sample descriptors over observed scalar fields
  and surface compact `simulationFieldClosureSample*` telemetry without
  claiming material properties, EOS, SPH, or phase-change readiness.
- [x] Fix SPH box/grid scaling so larger container dimensions increase the
  MLS-MPM grid dimensions/node count while continuous surface radii remain tied
  to particle spacing/smoothing length, not box size.
- [x] Add visible SPH demo runtime warnings, decoupled render/physics/resident
  FPS telemetry, and PeerCompute-compatible localStorage closure cache reuse.
- [x] Guard the localStorage closure cache with input/method/validity hashes and
  a material-generator fingerprint so cached material properties persist across
  runs but stale records are ignored when generating code changes.
- [x] Add `sph.phase.rebuild` to the supervised `ulg-runtime` service and wire
  SPH control rebuilds through the worker so material/reaction/view-state
  rebuilds do not block the UI when the runtime is available.
- [x] Add a formula-parser-driven reaction candidate layer for general
  element/compound pairs, including active-metal/water and charge-balanced
  binary ionic candidates, and route the SPH adapter through balanced
  stoichiometry records instead of the old limited compound recognizer.
- [x] Restore visible resident playback motion in the SPH demo after moving
  away from the raw WebGPU overlay: playback now keeps renewing GPU-resident
  continuation chains, preserves the initial render-field pass needed to derive
  pressure-interface force rows, and forces a Three/MarchingCubes visual refresh
  when compact resident diagnostics cross the visible-motion threshold.
- [x] Fix resident MLS-MPM reset-path physics continuity: multi-substep
  GPU-resident runs now use sequence-owned pressure-interface force buffers,
  skip no-op reaction output buffers, and avoid zeroing post-reset continuation
  substeps. Post-reset browser evidence showed continued substeps with active
  grid nodes and visible displacement instead of substep 1+ collapsing to zero.
- [ ] Implement `plan/todo/physics-behavior-regression-plan.md`: treat current
  severely broken visible/local physics behavior as the P0 gate. Restore
  coherent reset/playback continuity, stage order, pressure/interface force
  application, reaction/product/gas carry-forward, thermal/phase continuity,
  stale mirror rejection, and truthful diagnostics before counting additional
  WebGPU/PeerCompute migration as complete.
  - 2026-06-12 slice: resident no-full-readback steps now carry post-thermal
    SPH state forward instead of dropping `specificInternalEnergy` updates when
    reaction emits no particle mutation. Remaining P0: add a GPU resident
    mechanics/constitutive refresh from post-thermal phase/EOS state before the
    next P2G.
  - 2026-06-13 slice: physical law-group controls now reach runtime/probe
    execution, no-full cohort diagnostics no longer report stale CPU mirrors as
    live motion, and resident render-field MarchingCubes surfaces are clamped to
    decoded material/phase/domain bounds plus padding. The valid-geometry
    H2O/H2O bounds-clipped scene probe and dense visual sequence pass. Remaining
    P0: long-horizon liquid merge/settle quality, faster visual cadence, and
    admitted live-state cohort checkpoints.
  - 2026-06-13 live-cohort slice: long all-laws valid-geometry direct resident
    probing now shows live drop descent/contact with bounded J and zero
    pressure impulse, and the analyzer reports finite-support gap separately
    from center-bound gap. Remaining P0 is visually validated merged/settled
    liquid behavior plus compact resident cohort/support summaries so this can
    run without full particle readback.
  - 2026-06-13 compact-cohort slice: no-full resident compact summaries now
    include optional base/drop cohort COM/AABB/max-speed diagnostics and the
    probe consumes them as live cohort evidence. Remaining P0 is optimizing the
    summary stage and pairing compact live-state evidence with scene/visual
    free-surface validation.
  - 2026-06-13 liquid-stability slice: the first opt-in long-horizon H2O/H2O
    atomic gate now passes after adding explicit liquid viscosity lanes,
    consuming hydrostatic pressure consistently in the CPU carrier, and using a
    floor-only no-slip wall boundary in CPU/WGSL grid updates. The CPU SPH
    render path no longer disappears on empty batches or undefined resident
    render-field variables; the `mech=sph` browser probe is `good` with H2O
    visible in all samples. Remaining P0 is representative visual-sequence
    coverage, surface tension/free-surface quality, resident throughput, and
    ComputeManager/GPUHub authority for the full law DAG.
  - 2026-06-13 G2P ABI slice: the latest no-full resident zero-output collapse
    was an 80-byte G2P uniform payload written into a 64-byte WebGPU params
    buffer. G2P now shares `G2P_PARAMS_BYTES = 80` between JS packing and GPU
    allocation, and the focused fake-device regression catches future
    `writeBuffer` overruns. Full-readback WebGPU parity passes at
    `~1e-8` scale, short no-full and CPU-SPH mounted probes classify `good`,
    and temporary per-stage queue fences were removed. A follow-up source-level
    guard now covers `16` resident scalar params contracts by comparing WGSL
    struct size, JS packing size, uniform allocation size, and writeBuffer
    factory usage. Remaining P0 is cheap no-full visual summaries,
    long-horizon water quality, Na/H2O mounted orchestration, and mobile render
    lifecycle validation.
  - 2026-06-13 compact-summary scope slice: no-full resident summaries now
    support `compactSummaryScope=particle-visual`, which keeps particle,
    cohort, thermal, COM/AABB, and J diagnostics while explicitly skipping the
    active-grid-node scan. Strict probes keep `compactSummaryScope=full`.
    Direct H2O/H2O `2 x 1` no-full comparison probes classify `good`; warm
    compact summary time was about `230 ms` for particle-visual versus
    `295 ms` for full-grid on the same `13824`-node scenario. Remaining P0 is
    the readback/map fence and cold-start cost, which should move into retained
    GPU diagnostic/render lanes with sparse admitted readbacks.
  - 2026-06-13 CPU-SPH lifecycle slice: CPU-SPH `setParticles()` now forces a
    viewport refresh burst after CPU MarchingCubes surfaces are applied, and
    `visibilitychange`/`pageshow` use the same immediate-plus-two-RAF refresh
    path. The mobile-sized H2O/H2O `mech=sph` Playwright test passes and
    verifies visible CPU-particle surfaces after a CPU step and synthetic page
    lifecycle events. If the real phone still blanks/flashes, escalate this to
    device visual sequence capture and canvas/context-loss diagnostics.
  - 2026-06-13 no-full surface-summary skip slice: resident render refresh and
    the long-horizon probe now expose `renderFieldSurfaceSummaryMode=skip`.
    No-full H2O/H2O mounted evidence shows render rows, render field, and
    compact surface-summary readbacks all disabled with explicit skipped
    telemetry. This is cheaper routine diagnostic evidence, not fresh visual
    correctness; strict checkpoints still need readback or the retained GPU
    draw/summary lane.
- [ ] Implement `plan/todo/peercompute-law-graph-authority-plan.md`: make
  PeerCompute NodeKernel, ComputeManager, and StateManager the long-term
  authority path for distributed ULG law execution, worker leases, closure
  artifact caches, validation, and accepted compact state deltas.
  - 2026-06-14 slice: the browser resident authority host now initializes a
    real sibling PeerCompute `NodeKernel` in local/no-start mode by default,
    uses its real `ComputeManager`, `StateManager`, and `GPUHub`, validates
    resident warm-delta publication, and exposes explicit
    `startNodeKernelNetwork()` / `stopNodeKernelNetwork()` telemetry. This is a
    local browser libp2p gate, not distributed physics yet. Later slices now
    cover remote placement, quorum validation, and in-memory replicated
    StateManager convergence; peer/bootstrap and real browser/provider
    transport remain open.
  - 2026-06-14 solver slice: the same host now registers
    `ulg-mls-mpm-sph-resident-steps` in the real ComputeManager
    `SolverRegistry` with module/export, GPU-lane, warm-delta, read/write
    field, and law-graph metadata.
  - 2026-06-14 solver-created task bridge slice: mounted resident scheduling
    now uses `SolverRegistry.createTask()` when the real solver registry is
    present and bridges the solver-created envelope back into ULG's resident
    pass-DAG task without losing GPU fence, GPU-resident lane, law-graph,
    read/write family, return-envelope, or StateManager commit evidence. Next
    authority work is real peer/bootstrap configuration, live provider
    transport, and more law groups under the ComputeManager law graph.
  - 2026-06-14 remote placement gate slice: the resident authority host now
    configures NodeKernel network placement executors, ComputeManager
    placement hooks, ULG admission, and PeerCompute quorum validation behind
    `peercompute.ulg.remote-placement-gate.v0`. The gate is explicit and does
    not auto-start networking or send resident physics remote by default. Next
    distributed work is a real two-node/browser-local or loopback placement
    smoke with non-advisory placement hints and StateManager admission
    evidence.
  - 2026-06-14 remote placement smoke slice: ULG now has an in-memory
    redundant NodeKernel remote-placement smoke for the resident pass DAG. A
    module-backed ULG resident task runs with `placementHint.advisoryOnly=false`,
    primary and replica responders execute through their ComputeManagers,
    PeerCompute quorum accepts the matching results, responders commit no local
    deltas, and the requester StateManager admits the compact resident delta.
  - 2026-06-14 replicated StateManager convergence slice: the remote placement
    smoke now encodes the requester's Yjs StateManager document, applies it to
    a second real StateManager, and validates the same committed warm resident
    delta on the replica. Next distributed work is real browser/provider
    transport across live NodeKernel peers.
  - 2026-06-14 provider-transport slice: two real PeerCompute `StateManager`s
    with real `PeerComputeProvider`s now transport a fresh ULG resident warm
    delta over provider `yjs-update` broadcasts through an in-process
    NetworkManager shim. This proves the provider update path for fresh
    resident deltas and exposes the missing initial state-vector/full-doc sync
    handshake as the next PeerCompute prerequisite before live provider
    transport can be trusted for long-lived distributed state.
  - 2026-06-14 provider initial-sync slice: sibling PeerComputeProvider now
    handles `yjs-sync-request`/`yjs-sync-response` using Yjs state vectors and
    encoded diff updates. The ULG integration gate commits a resident warm
    delta before the replica StateManager joins and proves the late replica
    receives that preexisting delta through the provider sync response. Next
    distributed work is the same path over live browser/libp2p NodeKernel
    peers.
- [ ] Implement `plan/todo/resident-state-authority-contract-plan.md`: add a
  resident state authority ledger so every WebGPU/CPU law stage declares read
  families, authoritative writes, no-op families, borrowed buffers, destruction
  rules, validation status, and next consumers.
  - 2026-06-12 slice: `src/runtime/residentStateAuthority.js` now records and
    summarizes MLS-MPM resident-step family owners; the resident step envelope
    exposes the ledger, compact owner map, and diagnostics fields.
  - 2026-06-12 slice: `src/runtime/residentBufferLease.js` now records
    retained resident buffer resources and guards explicit product-event
    preserve handles during cleanup; pressure/render lease enforcement remains
    open.
  - 2026-06-12 slice: retained surface-draw buffers and pressure-interface
    force-row uploads now publish lease ledgers and use guarded release paths;
    stale CPU mirrors are rejected unless retained GPU uploads own the resident
    step.
  - 2026-06-12 slice: `sphResidentPressureInterfaceState` now owns pressure
    coupling/solver/force-row upload metadata, MLS-MPM defaults read pressure
    rows from that state instead of render state, and the playback loop refreshes
    pressure rows after resident physics steps even when visible render refresh
    is skipped.
  - 2026-06-12 slice: retained pressure-interface force rows now get transient
    consumer leases when scene-level MLS-MPM grid/resident-step callers borrow
    the pressure-state buffer; local grid/resident-step queue evidence now
    exists, while distributed worker fences remain open.
  - 2026-06-12 slice: retained render-field and surface-vertex buffers now use
    lease ledgers and guarded destroy; the scene bridge releases them after
    surface-draw metadata production.
  - 2026-06-12 slice: compact summary temporary GPU buffers now publish a
    cleaned diagnostics-only lease ledger after readback.
  - 2026-06-12 slice: grid-update, render-field, surface-vertex, surface-draw,
    compact-summary, and product-event merge/copy WebGPU paths now publish
    explicit `queueCompletionStatus`/`queueCompletionMethod` or product-event
    merge queue evidence from readback maps or queue fences. Remaining fence
    work is ULG SPH resident-lane task submission through PeerCompute, not the
    local WebGPU helper calls.
  - 2026-06-12 slice: scene-level pressure force-row uploads now publish
    `queue.writeBuffer` ordering evidence, borrow/release consumer queue
    evidence, and guarded temporary-upload destroy summaries after grid/resident
    consumers complete.
  - 2026-06-12 PeerCompute slice: `/home/cos/projects/peercompute` now has a
    `peercompute.compute.gpu-fence-report.v0` admission contract in
    `ComputeManager`. Remote task packets can require GPU fence evidence, and
    remote placement verification rejects missing or unsatisfied GPU fence
    reports before `commitDelta`.
  - 2026-06-12 PeerCompute/Multiscale slice: the `ulg-runtime` solver
    descriptor now declares a queue-fence-required WebGPU task, `stepUlgRuntime`
    emits a `peercompute.compute.gpu-fence-report.v0` after
    `queue.onSubmittedWorkDone()`/readback ordering, and loopback
    non-advisory remote placement accepts the result only after ComputeManager
    verifies the satisfied fence. Remaining work is to route this repo's SPH
    resident physics lanes through an actual ComputeManager/GPUHub resident lane
    backend and then wire NodeKernel network responders to the same evidence.
  - 2026-06-12 PeerCompute lane slice: `/home/cos/projects/peercompute` now has
    `GpuResidentLaneManager`, a narrow passive lane contract under
    `ComputeManager` with state-keyed leases, retained-buffer refs, copy-budget
    counters, same-lane state-key conflict rejection, lane stats, and GPU fence
    reports. It does not yet schedule ULG SPH; next work is to wrap SPH
    P2G/grid/G2P/thermal/reaction/pressure/render passes in those lane leases.
  - 2026-06-12 ULG lane-adapter slice:
    `runMlsMpmResidentStepWithOptionalWebGpu()` can now acquire a compatible
    GPU resident lane lease, report packed upload/readback/retained byte
    budgets, complete the lease with local queue-fence evidence and retained
    buffer refs, mirror the fence into diagnostics and sequence summaries, and
    reject the lease if WebGPU device acquisition fails. Remaining work is to
    move the whole SPH pass DAG behind a real ComputeManager/GPUHub lane task
    instead of using an optional local adapter.
  - 2026-06-12 PeerCompute ComputeManager lane-wrapper slice:
    `/home/cos/projects/peercompute` now wraps declared inline GPU-resident lane
    tasks in `GpuResidentLaneManager` leases before local commit. The wrapper
    derives lane metadata from task/WebGPU residency hints, acquires/completes/
    rejects leases, injects fence/lane execution into task envelopes, and
    throws `ERR_COMPUTE_GPU_FENCE_UNSATISFIED` before `commitDelta` when a
    required GPU fence is missing or unsatisfied. Remaining work is still a
    real ULG SPH ComputeManager/GPUHub pass-DAG task.
  - 2026-06-12 ULG ComputeManager task-bridge slice:
    `createMlsMpmResidentStepComputeTask()`,
    `runMlsMpmResidentStepComputeTask()`, and
    `submitMlsMpmResidentStepComputeTask()` now package the resident
    MLS-MPM/SPH step as a ComputeManager-compatible JS task with GPU-lane
    residency, required GPU fence metadata, and explicit fence reports from the
    task handler. The handler intentionally does not double-lease locally when
    ComputeManager owns the lane lease.
  - 2026-06-12 slice: `buildSphPhysicsMaterialInterfaceFieldWebGpu()` and
    `sphResidentMaterialInterfaceState` now make material-interface extraction a
    pressure/physics-stage state refreshed after resident MLS-MPM steps and
    before pressure force rows. It still reuses the existing scalar field kernel
    and candidate-row readback; the remaining work is source shader renaming/
    ownership, GPU-side compaction, and distributed fence metadata.
  - 2026-06-12 slice: `peercompute.ulg.sph-material-interface-source-field.v0`
    now wraps the retained scalar field buffers for pressure-only
    material-interface extraction, so the pressure path no longer advertises
    only a render-field source. Remaining work is to move the source shader fully
    out of render naming and compact candidate/interface rows on GPU.
- [ ] Implement `plan/todo/gpu-resident-lanes-and-warm-services-plan.md`: add a
  ComputeManager-owned GPU resident lane plan for copy avoidance and warm
  Eshkol/MoonLab service residency so heavy closure/response services are not
  recreated when scenario latency matters.
  - 2026-06-12 slice: PeerCompute now exposes a passive
    `GpuResidentLaneManager` through `ComputeManager`; ULG SPH hot-buffer pass
    wiring and warm Eshkol/MoonLab residency remain open.
  - 2026-06-12 slice: ULG resident MLS-MPM/SPH steps now expose the first
    shape-compatible lane adapter for that manager, including copy budgets,
    retained-buffer refs, queue fence status, and rejection on setup failure.
    The adapter is not yet a distributed scheduler or pass-DAG backend.
  - 2026-06-12 slice: PeerCompute `ComputeManager` now actively wraps declared
    inline GPU-lane tasks in lane leases and blocks unsatisfied required fence
    commits, so the next ULG step can target a scheduled lane task instead of
    another local adapter.
  - 2026-06-12 slice: ULG now has that scheduled lane task shape for the
    resident MLS-MPM/SPH step. Scene/NodeKernel integration and behavior
    remediation remain open.
- [ ] Implement `plan/todo/reaction-stoichiometry-energetics-plan.md`: strict
  first-principles reaction energetics, balanced multi-product CPU/WebGPU
  reaction execution, gas byproduct routing, sealed-box pressure coupling, and
  reaction-closure cache reuse. Current slice complete: packed reactant,
  product, and gas-product rows are uploaded/restored with the reaction table;
  the resident CPU reference computes limiting extent, excess-reactant
  leftovers, event heat, and visible/unplaced product ledgers; the WGSL resolve
  pass now consumes reactant/product term rows for fixed-buffer product
  emission. Current resident slice complete: no-full-readback reaction steps
  produce a 128-byte compact GPU summary with canonical event count, consumed
  mass, visible/unplaced product mass, gas mass/moles, heat, and residuals; the
  demo can derive sealed-box pressure from that resident summary under a
  guarded single gas-species path. Current per-gas slice complete: a separate
  32-byte-per-gas-product compact resident ledger reports material id, mass,
  moles, visible/unplaced mass, event count, gas-product index, and status; the
  demo pressure diagnostic now consumes the per-species GPU ledger for multiple
  gas products before using aggregate fallback. Current product/residual slice
  complete: product-inventory rows and atom/charge residual rows are emitted by
  compact WebGPU summary passes without full particle readback, preserved in
  resident diagnostics, and surfaced in the SPH overlay. Current strict
  gate/pressure slice complete: compact summaries now carry a strict reaction
  gate for atom/charge/provisional-energetics blockers, and gas-pressure
  summaries carry a gauge-pressure six-wall force ledger whose force coupling is
  blocked when strict gates fail or when pressure gradients/normals are not yet
  resolved. Current renderable-storage slice complete: no-full-readback
  reaction steps can retain a sparse particle-major product-event WebGPU buffer
  without copying it back to JavaScript, and resident diagnostics/overlay rows
  expose its capacity, active verification rows, bytes, and lifetime status.
  Current render bridge complete: the SPH render-field ABI can bind the
  retained product-event buffer, and the scene adds generic product-inventory
  surface descriptors so unplaced event products render as spawned volume
  without sparse event readback. Current pressure bridge complete: gas pressure
  can derive gas products from the per-species gas ledger, product-event
  readback rows, or compact product-inventory rows without full particle
  readback. Current resident-mass contract complete:
  `peercompute.ulg.sph-resident-product-mass.v0` exposes the retained
  product-event buffer, row count/stride, unplaced mass, gas mass, consumption
  policy, and guarded destruction to downstream kernels. Current P2G sidecar
  slice complete: repeated resident steps carry the resident product-mass handle
  into the next P2G stage, P2G binds product-event rows as read-only storage,
  and unplaced product mass contributes to grid mass without double-counting
  visible emitted products. Current mechanics/EOS product-event slice complete:
  product-event rows now carry closure-derived product velocity, support volume,
  bulk/shear/Lame constants, sound speed, EOS model id, solid flag, and mechanics
  status, and P2G consumes those fields for product-event momentum and local EOS
  pressure when support volume is present. Remaining: validated gas-cell or
  pressure-gradient force coupling and GPU append/compaction for multiple
  generations of unplaced resident products.
- [ ] Implement `plan/todo/sedenion-reaction-scoping-plan.md`: use the sedenion
  periodic-table reference as a symbolic reaction-channel prefilter and
  candidate-priority signal while keeping stoichiometry, energetics, kinetics,
  and validation under the ordinary first-principles closure chain.
- [ ] Implement `plan/todo/phase-resolved-steam-optics-plan.md`: phase/state
  keyed optical closures, H2O vapor vs condensed-droplet steam scattering,
  state-bucketed optical cache invalidation, and GPU-resident optical lookup
  plumbing.
- [ ] Implement `plan/todo/cold-start-cache-performance-plan.md`: persist and
  reuse reaction/product closures, stop bypassing reaction cache for
  material-property-backed discovery, persist thermal/optical/static table and
  GPU warmup artifacts where valid, expose timing/cache diagnostics for worker
  rebuilds, and add a visible SPH `clear cache` control. First slice complete:
  material-property-backed `discoverReactions()` cache keys, persisted
  reaction/product cold-start records, worker-first SPH startup diagnostics,
  low-FPS CPU-derivation warning messaging, cached interactive Step/Play
  rebuilds, and the `clear cache` button are live. Remaining:
  GPU upload/warmup persistence, stale-record browser probes, measured
  cold/warm/clear deltas, and the long 0.1 FPS cold-start period.
- [ ] Implement `plan/todo/webgpu-material-property-resolvers-plan.md`: move
  expensive material-property resolver families from JavaScript into
  WebGPU-resident kernels/flat closure graphs with worker/PeerCompute fallback,
  including relativistic optics, element/compound thermomechanics, reactions,
  radiation/nuclear effects, cache provenance, and visible CPU fallback
  warnings. First slice complete: an additive
  `src/runtime/material/materialResolverManifest.js` scaffold now enumerates
  the resolver family inventory, CPU anchors/status, WebGPU residency targets,
  cache key ingredients, status labels, and explicit false validation flags.
- [ ] Follow `plan/todo/README.md` and `plan/todo/overarching-completion-plan.md`
  as the active ordering
  plan for the remaining ULG, SPH, material resolver, performance, reaction,
  steam/gas, nuclear/radiation, PeerCompute, Eshkol, MoonLab, and tooling todo
  items.
- [ ] Implement `plan/todo/webgpu-ocean-mlsmpm-simulator-plan.md`: build a
  WebGPU-Ocean-style high-performance MLS-MPM simulator path with
  fixed-point/tiled P2G where appropriate, GPU cell/neighbor structures,
  resident gas/product/phase dynamics, and GPU-resident continuous surfaces.
- [ ] Replace provisional candidate energetics and heavy product-closure
  derivations with cached worker/WebGPU-resident lower-level solvers for the
  full element/compound reaction space.
- [ ] Keep the dev server running for live inspection.

### PeerCompute

- [x] Review current multiscale runtime and remote-placement branch work.
- [x] Map existing NodeKernel and ComputeManager surfaces to ULG service hosting.
- [x] Add reusable headless service orchestration modules after the ULG app slice is stable.
- [x] Accept ULG MoonLab/Eshkol magnetar handoffs in Multiscale and clear the
  reduced calibrated runtime evidence gate with five hash-backed entries.
- [x] Promote the browser demo handoff into
  `peercompute.ulg.handoff-service-envelope.v0` with content-addressed refs,
  relay-safe counts, transfer manifest preservation, and provenance.
- [x] Add PeerCompute's first envelope-backed ULG service host so
  `WorkerSupervisor` can normalize/store durable handoff envelopes through its
  artifact cache.
- [x] Add PeerCompute's first envelope-backed dispatch plan so durable handoff
  envelope refs become concrete Eshkol/MoonLab service tasks with relay-safe
  artifact refs and transferred WASM metadata.
- [x] Add PeerCompute's registry-backed supervisor executor so dispatch tasks
  can be submitted to registered MoonLab/Eshkol service hosts.
- [x] Materialize normalized ULG artifact payloads in supervisor-submitted
  PeerCompute dispatch service tasks while keeping dispatch plans ref-based.
- [x] Add exported PeerCompute MoonLab/Eshkol dispatch service adapters that
  consume those materialized payloads under `WorkerSupervisor`.
- [x] Expose and verify Multiscale browser Worker execution for the exported
  dispatch adapters through `runUlgDispatchServiceAdapterProbe()`.
- [x] Add MoonLab payload and Eshkol WASM compile probes behind the dispatch
  adapter Worker contract.
- [x] Add metadata-only Eshkol descriptor contract probes so descriptor-ready
  closures can dispatch without requiring transferred WASM bytes.
- [x] Add Eshkol host-runtime dry probes that instantiate complete descriptor
  WASM with inert imports while keeping `main` uninvoked.
- [x] Add gated Eshkol smoke runtime execution behind explicit output-semantics
  preflight without promoting descriptor handoffs to scientific execution.
- [x] Verify PeerCompute adapter Workers execute the real ULG-staged Eshkol
  `hello` smoke closure handoff, validate stdout semantics, and keep
  `scientificExecution = false`.
- [x] Surface the Eshkol magnetar descriptor's reduced interpolation-table
  fixture through ULG artifact summaries and PeerCompute adapter probes while
  keeping `scientificValidation = false`.
- [x] Add guarded runtime-smoke output semantics to the default Eshkol magnetar
  descriptor handoff and verify PeerCompute validates stdout without promoting
  it to scientific execution.
- [x] Expose the derived handoff dispatch plan through the live Multiscale
  browser API for VPN inspection.
- [x] Validate Eshkol descriptor tensor-runtime contracts in dispatch adapter
  probes and service summaries without promoting them to scientific execution.
- [x] Accept Eshkol deterministic tensor-offset runtime-smoke handoffs in
  Multiscale browser and relay smokes while keeping production handler and full
  physics validation blocked.
- [x] Surface Eshkol production-handler boundary metadata in PeerCompute
  dispatch adapters, supervisor summaries, Multiscale ingestion, and browser UI
  without promoting handler/runtime/scientific readiness.
- [x] Surface Eshkol production-host candidate and production dispatch preflight
  metadata through PeerCompute artifact summaries, dispatch ingest, supervisor
  summaries, Multiscale readiness, and packet boundary conditions without
  promoting smoke stubs to production runtime readiness.
- [x] Run relay-backed focused PeerCompute runtime P2P smoke and preserve
  generated relay configs after the test.
- [x] Add relay-backed ULG handoff dispatch diagnostics so adapter-enabled relay
  smoke records the popup context reset instead of failing as an unstructured
  Playwright crash.
- [x] Fix relay-served popup dispatch adapter execution so the optional relay
  smoke reaches adapter `dispatch-complete` without relaxing runtime or
  scientific gates.
- [x] Add Eshkol tensor-runtime candidate probes in PeerCompute and reverify
  browser plus relay-dispatch ULG handoffs against the latest staged artifacts.
- [ ] Start from `ComputeManager`, `NodeKernel`, `SolverRegistry`, relay tooling,
  NetViz telemetry, and Multiscale ULG schemas.
- [ ] Replace demo-local scheduling/GPU/artifact substitutes with explicit service
  lifecycle, child-worker leases, GPU leases, cancellation trees, content-addressed
  artifacts, and provenance indexes.
- [ ] Extend Eshkol descriptor probing from deterministic table-fixture evidence
  to controlled magnetar closure execution once the runtime contract is ready.

### Eshkol

- [x] Identify compiler/runtime points for ULG closure manifests and WASM exports.
- [x] Prototype closure artifact generation using the shared ABI contract.
- [x] Add ABI-level WGSL/table strategy descriptor emission after descriptor
  conformance stabilized.
- [x] Fold in the Eshkol sidecar report.
- [ ] Start from `eshkol-run` CLI `--wasm`/target/export paths, `llvm_backend.h`,
  `llvm_codegen.cpp`, GPU memory/VM dispatch APIs, and existing web/GPU scripts.
- [x] Add closure artifact JSON emission and named WASM reference export/import
  discovery for the current AOT WASM path.
- [x] Add manual closure-bundle export/deploy helper support to the ULG
  browser-facing service asset convention.
- [x] Add deterministic reduced interpolation-table fixture metadata to the
  magnetar descriptor artifact without claiming validated physics.
- [x] Add metadata-level typed closure tensor runtime descriptors to the
  magnetar fixture, including sample-shape validation and contract hash.
- [x] Add production-handler boundary metadata to the magnetar closure fixture
  and reject unsupported runtime/full-physics overclaims.
- [x] Add concrete smoke-only tensor linear-memory layout metadata and
  host-import validation while keeping the WASM entry export disconnected from
  tensor offsets.
- [x] Execute deterministic host-runtime tensor-offset smoke for the magnetar
  closure entry export while preserving production-handler and full-physics
  blockers.
- [x] Add production dispatch preflight metadata to the magnetar closure fixture
  so ULG and PeerCompute can reject deterministic runtime-smoke stubs at the
  production handler boundary.
- [x] Add computed production dispatch preflight `checkResults`/`checkSummary`
  evidence to exported magnetar closure artifacts without promoting production
  handler/runtime/full-physics readiness.
- [x] Add declared production handler contract metadata to exported magnetar
  closure artifacts so ULG and PeerCompute can hand off the production entry
  ABI, tensor offsets, required evidence, and remaining blockers without
  claiming the production handler has been implemented.
- [x] Add language-level `define-ulg-closure` syntax and service-worker import
  glue on top of the stabilized artifact contract.
- [x] Add declared full-physics validation requirements to exported magnetar
  closure artifacts, including the required MHD, PIC, radiation, relativity, and
  cross-family conservation evidence families, without clearing the production
  full-physics blocker.
- [x] Prefer WGSL/table descriptor emission for closure interpolation instead of a
  general LLVM-to-WGSL compiler.
- [ ] Avoid JIT service paths until the observed derivative/JIT hang is profiled.

### MoonLab

- [x] Identify JS/WASM/WebGPU bindings that can emit ULG quantum response artifacts.
- [x] Prototype service worker bootstrap around existing MoonLab core exports.
- [x] Add deterministic CPU/WebGPU parity artifact surface with explicit
  unsupported WebGPU parity reporting.
- [x] Fix JS unit regressions and WASM dist packaging before real service integration.
- [ ] Add browser WebGPU complex64/parity kernels to replace the current
  unsupported parity report.
- [x] Add ULG/browser smoke that verifies MoonLab `locateFile`/WASM asset probe
  wiring and consumes the published service fixtures in a browser worker.
- [x] Copy generated MoonLab core artifacts into ignored local service assets and
  verify live browser asset probe readiness.
- [x] Wrap a minimal MoonLab core task in a supervised service worker using the
  ready asset path.
- [x] Surface the MoonLab `magnetar-dipole-ising-calibration` handoff through
  the ULG browser artifact cache as a WASM-vs-JS parity-checked calibration
  sub-artifact.
- [x] Surface the MoonLab `moonlab.magnetar-dipole-ising-reference.v0`
  tolerance/reference contract through the ULG artifact body, compact
  artifact-summary telemetry, and demo handoff packet.
- [x] Preserve MoonLab tolerance/reference contracts as plural
  `outputs.references[]` entries in the ULG artifact body, compact summary, UI
  status line, and demo handoff packet while keeping `outputs.reference` as a
  compatibility alias.
- [x] Preserve MoonLab's calibrated magnetosphere MHD, PIC kinetic plasma,
  radiation transport, and relativistic correction inventory in raw
  `outputs.references[]` while compact summaries count the singular ready Ising
  reference plus calibrated-family readiness.
- [x] Promote the magnetosphere MHD inventory entry to a scoped analytic dipole
  field reference with solver id, SHA-256 contract/unit hashes, field maps,
  tolerances, observed deltas, and pass validation.
- [x] Declare optional MoonLab calibrated reference-contract JSON assets and
  merge valid supplied reference contracts into the browser core probe inventory
  without blocking loader/WASM readiness when the optional file is absent.
- [x] Stage the reduced MoonLab PIC, radiation, and relativity reference
  contracts in the ignored service-asset directory and verify the live
  ULG-to-PeerCompute magnetar handoff reports `scientific-tolerance-suite-ready`
  while keeping runtime scientific execution blocked.
- [x] Add a reproducible `npm run stage:service-assets` command for refreshing
  ignored MoonLab browser assets and the Eshkol `hello` closure bundle from the
  sibling repos.
- [x] Surface the same handoff through compact ULG artifact-summary telemetry for
  direct PeerCompute/Multiscale scenario ingestion.
- [x] Surface staged Eshkol closure execution metadata through compact ULG
  artifact-summary telemetry for direct PeerCompute/Multiscale scenario
  execution handoff.
- [x] Verify PeerCompute/Multiscale accepts descriptor-only Eshkol magnetar
  closure handoffs as packaging/probe prerequisites while preserving
  `proxy-runtime-not-scientific`.
- [x] Bind Eshkol's descriptor-only magnetar closure metadata to the durable
  PeerCompute handoff envelope, MoonLab normalized reference-suite hash, closure
  surface sample ids, and product-topology binding without claiming scientific
  validation.
- [x] Add a reduced MoonLab WebGPU complex64 parity-scope artifact with browser
  backend-acquired evidence and executed/passing reduced
  `compute_probabilities`, `hadamard`, `pauli_x`, `pauli_z`, and `cnot` probes.
- [ ] Update the PeerCompute receiver to accept MoonLab's successful reduced
  browser WebGPU parity-scope evidence without treating it as a full-runtime or
  full-physics claim.

### Tooling

- [x] Use ICC registry/status/architecture summaries for MoonLab and peercompute.
- [x] Use sidecar agents for MoonLab, Eshkol, peercompute, and ICC/swarm.
- [x] Ensure ICC parser dependencies are available before refreshing indexes.
- [x] Register `eshkol` and `ulg` with ICC when persistent tool artifacts are wanted.
- [x] Add a ULG repo-local `.icc/` configuration modeled on Eshkol's policy
  layout, plus `npm run icc:update` to refresh the ICC index, memory, status,
  and architecture snapshot into `.icc`.
- [x] Rewrite repo-local `.icc` policy docs so the editable configuration reads
  as ULG-native policy rather than copied sibling-repo wording.
- [x] Add a user Codex `icc` skill at `/home/cos/.codex/skills/icc/SKILL.md`
  so future sessions can trigger the ICC workflow from skill metadata.
- [x] Write the 2026-06-12 repo-root todo handoff at `todo-handoff-6-12.md`.
- [ ] Use swarm lightly for status/context until a ULG-specific profile exists.

### Current SPH/P0 Status - 2026-06-13 20:31 AKDT

- [x] Fixed the first mounted Na/H2O resident gas-promotion path. WebGPU
  resident product gas ledgers now feed the mounted overlay/render
  gas-pressure summary during direct scene/probe resident execution, and the
  focused mounted Playwright regression passes.
- [x] Added a bounded retained surface-draw diagnostic mode so over-budget
  no-full surface metadata construction reports a structured skip instead of
  hanging the browser.
- [ ] Reduce or tile retained surface-vertex/draw metadata so no-full resident
  visual correctness can produce fresh surface evidence without routine CPU
  readback.
- [ ] Continue long-horizon liquid/free-surface quality work, including
  explicit surface tension and representative visual sequence gates.
- [ ] Extend Na/H2O beyond the one-step mounted gas-promotion proof to repeated
  horizons with product carry-forward, no double counting, visible product/gas
  evidence, and accepted pressure coupling.

## Integration Rule

PeerCompute remains the orchestration authority. Eshkol and MoonLab services do
not own networking, GPU scheduling, or child worker spawning outside PeerCompute
leases.
