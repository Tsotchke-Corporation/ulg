import {
  createSphGpuTimestampProfiler,
  encodeSphGpuTimestampMarkerPass
} from '../runtime/sph/sphGpuTimestampProfiler.js';
import {
  cloneMlsMpmParticleStateForNext,
  cloneSphParticleStateForNext,
  destroyMlsMpmResidentStepBuffers,
  destroyMlsMpmResidentStepsBuffers,
  retainedContinuationBuffersFromUploads,
  runMlsMpmResidentStepsWithOptionalWebGpu,
  runSphSpatialGasLedgerProducerStageComputeTask,
  runSphGasCellEosProducerStageComputeTask,
  runSphPressureInterfaceStageComputeTask,
  runSphReactionProductStageComputeTask,
  runSphThermalPhaseStageComputeTask,
  runMlsMpmMechanicsG2pStageComputeTask,
  runMlsMpmMechanicsGridUpdateStageComputeTask,
  runMlsMpmMechanicsP2gStageComputeTask,
  describeResidentProductHistoryArenaIdentity,
  normalizePressureInterfaceGasCellFieldImport,
  scheduleSphGasCellEosFinalConsumerRelease,
  observeResidentProductHistoryLiveRowBound,
  isExactQuiescentSphReactionTable
} from '../runtime/sph/sphMlsMpmGpuStep.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_IDENTITY_UINTS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
} from '../runtime/sph/sphGpuBuffers.js';
import {
  SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS,
  decodeSchroederCrossLevelRefluxTerminalHeader
} from '../../ulg-gpu-abi/src/schroederCrossLevelRefluxLedger.js';
import {
  ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA
} from '../../ulg-gpu-abi/src/index.js';
import { requestOpticalGpuDevice } from '../runtime/material/opticalGpuBuffers.js';
import {
  ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V2,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3,
  describeSphSpatialGasPressureAuthority,
  isExactSphSpatialGasPressureAuthoritySource
} from '../runtime/sph/sphSpatialGasLedgerEosGpu.js';
import {
  isExactSphCpuSeededGasPressureAuthorityGpu
} from '../runtime/sph/sphCpuSeededGasPressureAuthorityGpu.js';
import {
  isExactSphPressureInterfaceCompletionReceipt
} from '../runtime/sph/sphPressureInterfaceGpuKernel.js';
import {
  canReleaseSchroederSpatialEpochGenerationQueueOrderedAfterFinalConsumer,
  releaseSchroederSpatialEpochGenerationAfterQueue,
  releaseSchroederSpatialEpochGenerationQueueOrderedAfterFinalConsumer,
  runSchroederSpatialEpochGenerationWebGpu
} from '../runtime/sph/schroederSpatialEpochGpu.js';
import {
  createSchroederSameLevelMechanicsSpatialEpochTransaction,
  resolveSchroederParticleBufferFamilyGeneration,
  runSchroederLevelAssignmentWebGpu,
  runSchroederSameLevelMechanicsWebGpu,
  schroederGridSpacingForLevel
} from '../runtime/sph/schroederHierarchyGpu.js';
import { createMlsMpmGridSpec } from '../runtime/sph/sphGridGpuKernel.js';
import {
  acquireSchroederSpatialSuccessorSourceFamilyLease,
  releaseSchroederSpatialSuccessorSourceFamilyLease,
  releaseSchroederSpatialSuccessorSourceFamilyLeaseAfter,
  resolveSchroederSpatialSuccessorSourceFamily,
  retireSchroederSpatialSuccessorSourceFamilyAfterLeases
} from '../runtime/sph/schroederSpatialSuccessorSourceFamily.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferDevice,
  webGpuDeviceId
} from '../runtime/sph/sphGpuDeviceIdentity.js';
import {
  enumerateSchroederSpatialMechanicalPrewarmPipelineDescriptors
} from '../runtime/sph/schroederSpatialMechanicalProposalsGpu.js';
import {
  SCHROEDER_SPATIAL_REACTION_ACTIVATION_PREDICATE_REVISION,
  ULG_SCHROEDER_SPATIAL_REACTION_ACTIVATION_OBSERVATION_SCHEMA,
  observeSchroederSpatialReactionDiscoveryActivation
} from '../runtime/sph/schroederSpatialReactionDiscoveryProposalGpu.js';
import {
  SPH_REACTION_ACTIVATION_OBSERVATION_PUBLIC_FAILURE_WORD,
  SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT,
  SPH_REACTION_MOTION_ENVELOPE_PREDICATE,
  ULG_SPH_REACTION_ACTIVATION_OBSERVATION_FATAL_ERROR_CODE,
  createSphReactionMotionEnvelope
} from '../runtime/sph/sphReactionMotionEnvelope.js';
import {
  createSchroederTargetScheduleProviderAuthority,
  createSchroederTargetScheduleTableFingerprints,
  createSchroederTargetScheduleWriterSet,
  exactSchroederTargetScheduleAuthority,
  schroederTargetScheduleSuccessorGasBoundaryActionable,
  schroederTargetScheduleWriterSetMatchesActivation,
  validateSchroederTargetScheduleAuthorityForExecution,
  validateSchroederTargetScheduleConfigurationContinuity
} from '../runtime/sph/schroederTargetScheduleAuthority.js';
import {
  ULG_WORKER_PHASE_CARRIER_ONE_TO_FOUR_TRANSITION_SCHEMA as ULG_WORKER_PHASE_CARRIER_ONE_TO_FOUR_TRANSITION_ROUTE_SCHEMA,
  ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_SCHEMA as ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_ROUTE_SCHEMA,
  ULG_WORKER_SCHEDULE_PROSPECTIVE_WRITER_EVIDENCE_SCHEMA,
  WORKER_DYNAMIC_LAW_OBSERVATION_FAILURE_POLICY,
  exactWorkerDynamicLawObservationSelf,
  workerRouteValuesEqual
} from '../runtime/sph/schroederWorkerScheduleRouteEvidence.js';
import {
  SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY,
  SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE,
  SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
} from '../runtime/sph/schroederDynamicLawRoutingContract.js';
import {
  runSphPhaseCarrierOneToFourMaterializationWebGpu,
  validateSphPhaseCarrierOneToFourExecution
} from '../runtime/sph/sphPhaseCarrierMaterializationGpu.js';
import {
  ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_PROPOSAL_SCHEMA,
  ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_DEVICE_LOST_ERROR_CODE,
  markSphReactionMotionEnvelopeWatchSubmittedWorkCompleted,
  observeSphReactionMotionEnvelopeWatch,
  sphReactionMotionEnvelopeWatchMatchesTerminalStorageFamily
} from '../runtime/sph/sphReactionMotionEnvelopeWatchGpu.js';
import {
  destroySphThermalResponseGraphBuffers,
  uploadSphThermalResponseGraphBuffers
} from '../runtime/sph/sphThermalGpuKernel.js';
import {
  diagnoseUploadedMechanicsMaterialPhaseRecordsMatch,
  destroyMlsMpmMechanicsMaterialPhaseUpload,
  uploadMlsMpmMechanicsMaterialPhaseRecords
} from '../runtime/sph/sphMechanicsRefreshGpuKernel.js';
import {
  armWorkerQueueSubmitBurst,
  closeWorkerQueueSubmitBurst,
  flushWorkerQueueSubmitBurst,
  openWorkerQueueSubmitBurst,
  prewarmCachedExplicitComputePipeline
} from '../runtime/webgpuComputeLayout.js';
import {
  SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_BYTE_LENGTH,
  SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_TARGET_OPTION,
  ULG_SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_COPY_SCHEMA,
  createSchroederFusedTerminalRefluxReceiptTarget
} from '../runtime/sph/schroederFusedFineSubstepGpu.js';
import {
  ULG_WORKER_RESIDENT_SCHEDULE_CONTROL_PLANE_YIELD_RECEIPT_SCHEMA,
  createWorkerResidentScheduleControlPlaneTaskYielder,
  workerResidentScheduleControlPlaneYieldNotRequiredReceipt
} from './workerResidentScheduleTaskYielder.js';

export {
  ULG_WORKER_RESIDENT_SCHEDULE_CONTROL_PLANE_YIELD_RECEIPT_SCHEMA
};

export const ULG_MECHANICS_RESIDENT_STAGE_WORKER_PROTOCOL_SCHEMA = 'peercompute.ulg.mechanics-resident-stage-worker.v0';
export const ULG_MECHANICS_RESIDENT_STAGE_WORKER_RESULT_SCHEMA = 'peercompute.ulg.mechanics-resident-stage-worker-result.v0';
export const ULG_MECHANICS_RESIDENT_STAGE_WORKER_RETAINED_PARTICLE_STATE_SCHEMA =
  'peercompute.ulg.mechanics-resident-stage-worker-retained-particle-state.v0';
export const ULG_MECHANICS_RESIDENT_STAGE_WORKER_RETAINED_COMPACT_SNAPSHOT_EXPORT_SCHEMA =
  'peercompute.ulg.mechanics-resident-stage-worker-retained-compact-snapshot-export.v0';
export const ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA =
  'peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0';
const ULG_SPH_PHASE_CARRIER_PLAN_V1_SCHEMA = 'peercompute.ulg.sph-phase-carrier-plan.v1';
const ULG_SPH_PHASE_CARRIER_PLAN_V2_SCHEMA = 'peercompute.ulg.sph-phase-carrier-plan.v2';

const NO_FULL_READBACK_MODE = 'no-full-readback';
const GAS_CELL_EOS_FINALIZER_STAGE_ID = 'gasCellEosFinalizer';
const SCHROEDER_SPATIAL_EPOCH_STAGE_ID = 'schroederSpatialEpoch';
// Diagnostic-only queue-fence recorder for the epoch generation stage; see
// runWorkerSchroederSpatialEpochStage. Fences serialize the queue, so this
// exists only under residentGpuTimestampProfile=1.
const SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID = 'schroederSameLevelMechanics';
const SCHROEDER_LANE_SEED_STAGE_ID = 'schroederLaneSeed';
const TIER0_FUSED_RESIDENT_SEQUENCE_STAGE_ID =
  'tier0FusedResidentSequence';
const WORKER_SCHROEDER_SCHEDULE_TRANSPORT_STAGE_IDS = Object.freeze(
  new Set([
    SCHROEDER_SPATIAL_EPOCH_STAGE_ID,
    SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID,
    TIER0_FUSED_RESIDENT_SEQUENCE_STAGE_ID
  ])
);
// The W1 adopted-storage rematerialization is a named capability, not a
// p2g-only special case: the SS lane-seed stage (refactor increment W4a)
// reuses the exact same descriptor-seed machinery to rebuild the four
// particle-storage buffers on the worker device before it runs the real
// level-assignment kernel against them.
const WORKER_ADOPTED_STORAGE_REMATERIALIZATION_STAGE_IDS = Object.freeze(
  new Set(['p2g', SCHROEDER_LANE_SEED_STAGE_ID])
);
export const ULG_WORKER_SCHROEDER_SPATIAL_EPOCH_STAGE_SCHEMA =
  'peercompute.ulg.worker-schroeder-spatial-epoch-stage.v0';
export const ULG_WORKER_SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_SCHEMA =
  'peercompute.ulg.worker-schroeder-same-level-mechanics-stage.v0';
export const ULG_WORKER_SCHROEDER_EPOCH_SEAL_SCHEMA =
  'peercompute.ulg.worker-schroeder-spatial-epoch-seal.v0';
export const ULG_WORKER_SCHROEDER_LANE_SEED_STAGE_SCHEMA =
  'peercompute.ulg.worker-schroeder-lane-seed-stage.v0';
export const ULG_WORKER_SCHROEDER_LANE_SEED_SCHEMA =
  'peercompute.ulg.worker-schroeder-lane-seed.v0';
export const ULG_WORKER_RESIDENT_SCHEDULE_RESULT_SCHEMA =
  'peercompute.ulg.worker-resident-schedule-result.v0';
export const ULG_WORKER_RESIDENT_SCHEDULE_PROGRESS_SCHEMA =
  'peercompute.ulg.worker-resident-schedule-progress.v0';
export const ULG_WORKER_RESIDENT_SCHEDULE_ERROR_SCHEMA =
  'peercompute.ulg.worker-resident-schedule-error.v0';
export const ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_SCHEMA =
  'peercompute.ulg.worker-resident-schedule-step-summary.v0';
export const ULG_WORKER_RESIDENT_SCHEDULE_TERMINAL_REFLUX_RECEIPT_SCHEMA =
  'peercompute.ulg.worker-resident-schedule-terminal-reflux-receipt.v0';
export const ULG_WORKER_SCHEDULE_EXECUTION_ROUTE_RECEIPT_SCHEMA =
  'peercompute.ulg.worker-schedule-execution-route-receipt.v6';
export const ULG_WORKER_SCHEDULE_LAW_ACTIVATION_RECEIPT_SCHEMA =
  'peercompute.ulg.worker-schedule-law-activation-receipt.v0';
export const ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_SCHEMA =
  ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_ROUTE_SCHEMA;
export const ULG_WORKER_TIER0_TOPOLOGY_ATTESTATION_SCHEMA =
  'peercompute.ulg.worker-tier0-topology-attestation.v0';
export const ULG_WORKER_PHASE_CARRIER_ONE_TO_FOUR_TRANSITION_SCHEMA =
  ULG_WORKER_PHASE_CARRIER_ONE_TO_FOUR_TRANSITION_ROUTE_SCHEMA;
// Keep explicit diagnostic schedules compatible with the historical
// 128-step sodium batch. The interactive preset uses 64-step admitted chunks;
// the schedule driver bounds the amount of unfenced work inside either shape.
export const ULG_WORKER_RESIDENT_SCHEDULE_MAX_STEP_COUNT = 128;
// A terminal-only fence allowed the canonical sodium workload to enqueue 64
// full reaction/mechanics/presentation steps before Dawn had a chance to drain
// its native queue. On the headed browser route the same device completed a
// 16-step drain, while the unbounded 64-step queue shut its Instance down at
// the terminal callback. These checkpoints are pressure/liveness boundaries,
// never authority-admission receipts: StateManager still admits only the
// schedule's final terminal fence.
export const ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS = 16;
// Terminal schedule results keep the LAST step's full summary plus a compact
// fixed-capacity per-step ring so envelopes stay bounded for any stepCount.
export const ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_RING_CAPACITY = 64;
const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
};
const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

function exactReactionActivationCount(value, minimum = 0, maximum = 0xffff_ffff) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && !Object.is(value, -0)
    && value >= minimum
    && value <= maximum;
}

const REACTION_ACTIVATION_GPU_OBSERVATION_KEYS = Object.freeze([
  'schema',
  'status',
  'predicateRevision',
  'producerRoute',
  'sampleStage',
  'nodeDomain',
  'motionEnvelope',
  'shadowOnly',
  'routingAuthority',
  'observationSucceeded',
  'triggered',
  'triggeredSourceCount',
  'uncertainty',
  'rawEvidenceWord',
  'particleCount',
  'reactionCount',
  'reactionTableFingerprint',
  'mapAsyncCount',
  'readbackByteLength',
  'fullParticleReadbackPerformed'
]);

function exactReactionActivationGpuObservationShape(value) {
  try {
    if (
      !value
      || typeof value !== 'object'
      || Object.getPrototypeOf(value) !== Object.prototype
      || !Object.isFrozen(value)
    ) return false;
    const keys = Object.keys(value);
    return keys.length === REACTION_ACTIVATION_GPU_OBSERVATION_KEYS.length
      && REACTION_ACTIVATION_GPU_OBSERVATION_KEYS.every(
        (key) => Object.hasOwn(value, key)
      );
  } catch {
    return false;
  }
}

function exactReactionActivationGpuObservation(value, {
  particleCount,
  reactionCount,
  reactionTableFingerprint,
  producerRoute,
  sampleStage,
  motionEnvelope
} = {}) {
  if (
    !exactReactionActivationGpuObservationShape(value)
    || value.schema
      !== ULG_SCHROEDER_SPATIAL_REACTION_ACTIVATION_OBSERVATION_SCHEMA
    || value.predicateRevision
      !== SCHROEDER_SPATIAL_REACTION_ACTIVATION_PREDICATE_REVISION
    || value.producerRoute !== producerRoute
    || value.sampleStage !== sampleStage
    || value.nodeDomain !== 'fixed-phase-carrier-slot'
    || value.motionEnvelope !== motionEnvelope
    || value.shadowOnly !== true
    || value.routingAuthority !== false
    || !exactReactionActivationCount(
      value.particleCount,
      1,
      SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
    )
    || value.particleCount !== particleCount
    || !exactReactionActivationCount(
      value.reactionCount,
      1,
      SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
    )
    || value.reactionCount !== reactionCount
    || typeof value.reactionTableFingerprint !== 'string'
    || value.reactionTableFingerprint.length < 1
    || value.reactionTableFingerprint !== reactionTableFingerprint
    || value.mapAsyncCount !== 1
    || value.readbackByteLength !== Uint32Array.BYTES_PER_ELEMENT
    || value.fullParticleReadbackPerformed !== false
  ) return null;
  if (value.observationSucceeded === true) {
    return value.status === 'reaction-activation-observation-ready'
      && value.uncertainty === false
      && exactReactionActivationCount(
        value.triggeredSourceCount,
        0,
        value.particleCount
      )
      && exactReactionActivationCount(
        value.rawEvidenceWord,
        0,
        value.particleCount
      )
      && value.rawEvidenceWord === value.triggeredSourceCount
      && value.triggered === (value.triggeredSourceCount > 0)
      && (
        value.motionEnvelope?.thermalPhaseEvolutionEnabled !== true
        || value.triggeredSourceCount === value.particleCount
      )
        ? value
        : null;
  }
  return value.status === 'reaction-activation-observation-uncertain'
    && value.observationSucceeded === false
    && value.uncertainty === true
    && value.triggered === true
    && value.triggeredSourceCount === null
    && value.rawEvidenceWord
      === SPH_REACTION_ACTIVATION_OBSERVATION_PUBLIC_FAILURE_WORD
      ? value
      : null;
}

function malformedReactionActivationObservationError(message) {
  const error = new Error(message);
  error.code = ULG_SPH_REACTION_ACTIVATION_OBSERVATION_FATAL_ERROR_CODE;
  error.reactionActivationObservationFatal = true;
  return error;
}

const EXACT_GAS_PRESSURE_TRANSPORT_RAW_ALIAS_KEYS = new Set([
  'gasPressureCellsBuffer',
  'retainedGasPressureCellsBuffer',
  'pressureInterfaceGasPressureCellsBuffer',
  'gasAuthorityControlBuffer',
  'retainedGasAuthorityControlBuffer',
  'pressureInterfaceGasAuthorityControlBuffer'
]);
const EXACT_GAS_PRESSURE_TRANSPORT_CAPABILITY_KEYS = new Set([
  'releaseAfterFinalConsumerQueue',
  'deferredCleanupReadbackTelemetrySnapshot',
  'releasePromise'
]);
const WORKER_LOCAL_PRESSURE_AUTHORITY_KEYS = new Set([
  'cpuSeededGasPressureAuthority',
  'pressureCompletionReceipt'
]);
const EXACT_GAS_PRESSURE_TRANSPORT_RETIRED_SCHEMA_KEYS = new Set([
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V2,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3
]);
const EXACT_GAS_PRESSURE_TRANSPORT_GRAPH_KEYS = Object.freeze([
  'retainedGasCellFieldSource',
  'spatialGasLedgerEosExecution',
  'pressureInterfaceGasCellFieldImport',
  'pressureInterfaceGasCellFieldAdmission',
  'gasCellFieldAdmission',
  'admission',
  'gasCellEosProducerResult',
  'pressureInterfaceForceSolver',
  'retainedGasPressureCellImport'
]);
const EXACT_GAS_PRESSURE_TRANSPORT_READINESS_KEYS = Object.freeze([
  'schema',
  'status',
  'ready',
  'localPressureGradientReady',
  'retainedGasCellFieldSourceReady',
  'pressureInterfaceImportReady',
  'pressureInterfaceGasPressureCellRowsBufferRetained',
  'gasPressureCellRowsBufferRetained',
  'pressureInterfaceGasPressureCellRowCount',
  'gasPressureCellRowCount',
  'pressureInterfaceGasPressureCellRowCapacity',
  'gasPressureCellRowCapacity',
  'pressureInterfaceGasPressureCellRowStrideFloats',
  'gasPressureCellRowStrideFloats',
  'pressureInterfaceGasPressureCellRowByteLength',
  'gasPressureCellRowByteLength',
  'gasCellFieldConsumptionApproved',
  'telemetryOnly',
  'bindable',
  'deviceId',
  'computeTaskId',
  'pressureFieldMode',
  'pressureFieldResolution',
  'retainedGasPressureBufferRefs',
  'workerRetainedGasPressureBufferRefs'
]);
const EXACT_GAS_PRESSURE_TRANSPORT_CAPTURE_KEYS = Object.freeze([
  ...new Set([
    ...EXACT_GAS_PRESSURE_TRANSPORT_GRAPH_KEYS,
    ...EXACT_GAS_PRESSURE_TRANSPORT_RAW_ALIAS_KEYS,
    ...EXACT_GAS_PRESSURE_TRANSPORT_READINESS_KEYS
  ])
]);

const STAGE_RUNNERS = {
  p2g: runMlsMpmMechanicsP2gStageComputeTask,
  spatialGasLedgerProducer: runSphSpatialGasLedgerProducerStageComputeTask,
  gasCellEosProducer: runSphGasCellEosProducerStageComputeTask,
  pressureInterface: runSphPressureInterfaceStageComputeTask,
  gridUpdate: runMlsMpmMechanicsGridUpdateStageComputeTask,
  g2p: runMlsMpmMechanicsG2pStageComputeTask,
  thermalPhase: runSphThermalPhaseStageComputeTask,
  reactionProduct: runSphReactionProductStageComputeTask,
  // Schroeder Simulation (SS) worker-lane stages (refactor increments W1/W4a).
  // Function declarations hoist; the runners live near the other SS helpers.
  [SCHROEDER_LANE_SEED_STAGE_ID]: runWorkerSchroederLaneSeedStage,
  [SCHROEDER_SPATIAL_EPOCH_STAGE_ID]: runWorkerSchroederSpatialEpochStage,
  [SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID]:
    runWorkerSchroederSameLevelMechanicsStage
};

const retainedLanes = new Map();
const workerLaneAssignmentOnlyScheduleProviders = new WeakSet();
const workerLaneScheduleProviderAuthority = new WeakMap();
const exactGasPressureTransportGraphByStageData = new WeakMap();
const exactPressureGridHandoffByStageData = new WeakMap();
const workerResidentScheduleFenceDeferredStageData = new WeakSet();
let workerDeviceResultPromise = null;

function normalizeString(value, fallback = null) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function cloneAndDeepFreezeWorkerScheduleValue(value) {
  const clone = structuredClone(value);
  const freeze = (entry) => {
    if (!entry || typeof entry !== 'object' || Object.isFrozen(entry)) {
      return entry;
    }
    for (const nested of Object.values(entry)) freeze(nested);
    return Object.freeze(entry);
  };
  return freeze(clone);
}

function clonePhaseCarrierPlanForParticleCount(plan, particleCount, label = 'phase carrier plan') {
  if (plan == null) return null;
  const count = Number(particleCount);
  const countAccepted = Number.isSafeInteger(count) && count > 0;
  if (plan?.schema === ULG_SPH_PHASE_CARRIER_PLAN_V2_SCHEMA) {
    const lineageCapacity = Number(plan?.lineageCapacity);
    const primaryCapacity = Number(plan?.primaryCapacity);
    const phaseLaneCount = Number(plan?.phaseLaneCount);
    const phaseLaneStride = Number(plan?.phaseLaneStride);
    const companionStart = Number(plan?.companionStart);
    const companionCapacity = Number(plan?.companionCapacity);
    const particleCapacity = Number(plan?.particleCapacity);
    const stableLaneAddressPresent = plan.stableLaneAddress !== undefined;
    const phaseCompanionLanesRequiredPresent =
      plan.phaseCompanionLanesRequired !== undefined;
    const reasonPresent = typeof plan.reason === 'string' && plan.reason.trim();
    // Two declared topologies exist: the four-lane phase-companion layout
    // and the laws-quiescent single-lane declaration (no companion lanes;
    // the plan's presence still asserts the topology explicitly).
    const laneShapeAccepted =
      (
        phaseLaneCount === 4
        && companionCapacity === 3 * lineageCapacity
        && particleCapacity === 4 * lineageCapacity
      )
      || (
        phaseLaneCount === 1
        && companionCapacity === 0
        && particleCapacity === lineageCapacity
      );
    const accepted = countAccepted
      && plan?.status === 'phase-lane-capacity-ready'
      && Number.isSafeInteger(plan.lineageCapacity)
      && Number.isSafeInteger(plan.primaryCapacity)
      && Number.isSafeInteger(plan.phaseLaneCount)
      && Number.isSafeInteger(plan.phaseLaneStride)
      && Number.isSafeInteger(plan.companionStart)
      && Number.isSafeInteger(plan.companionCapacity)
      && Number.isSafeInteger(plan.particleCapacity)
      && lineageCapacity > 0
      && primaryCapacity === lineageCapacity
      && phaseLaneStride === lineageCapacity
      && companionStart === lineageCapacity
      && laneShapeAccepted
      && particleCapacity === count
      && (!stableLaneAddressPresent || typeof plan.stableLaneAddress === 'string');
    if (accepted) {
      return {
        schema: ULG_SPH_PHASE_CARRIER_PLAN_V2_SCHEMA,
        status: 'phase-lane-capacity-ready',
        lineageCapacity,
        primaryCapacity,
        phaseLaneCount,
        phaseLaneStride,
        companionStart,
        companionCapacity,
        particleCapacity,
        ...(stableLaneAddressPresent
          ? { stableLaneAddress: plan.stableLaneAddress }
          : {}),
        ...(phaseCompanionLanesRequiredPresent
          ? {
              phaseCompanionLanesRequired:
                plan.phaseCompanionLanesRequired === true
            }
          : {}),
        ...(reasonPresent ? { reason: plan.reason.trim() } : {})
      };
    }
  }
  const primaryCapacity = Number(plan?.primaryCapacity);
  const companionStart = Number(plan?.companionStart);
  const companionCapacity = Number(plan?.companionCapacity);
  const particleCapacity = Number(plan?.particleCapacity);
  const accepted = countAccepted
    && plan?.schema === ULG_SPH_PHASE_CARRIER_PLAN_V1_SCHEMA
    && plan?.status === 'phase-companion-capacity-ready'
    && Number.isSafeInteger(primaryCapacity)
    && primaryCapacity > 0
    && Number.isSafeInteger(companionStart)
    && companionStart === primaryCapacity
    && Number.isSafeInteger(companionCapacity)
    && companionCapacity === primaryCapacity
    && Number.isSafeInteger(particleCapacity)
    && particleCapacity === count
    && companionStart + companionCapacity === count;
  if (!accepted) {
    throw new RangeError(
      `${label} does not match particleCount ${Number.isSafeInteger(count) ? count : 'invalid'}`
    );
  }
  // Keep this descriptor-only across the worker boundary. Unknown properties
  // are intentionally not cloned, so local buffers cannot hitchhike on it.
  return {
    schema: ULG_SPH_PHASE_CARRIER_PLAN_V1_SCHEMA,
    status: 'phase-companion-capacity-ready',
    primaryCapacity,
    companionStart,
    companionCapacity,
    particleCapacity
  };
}

function phaseCarrierPlansEqual(left, right) {
  if (left == null || right == null) return left == null && right == null;
  if (left.schema !== right.schema || left.status !== right.status) return false;
  if (left.schema === ULG_SPH_PHASE_CARRIER_PLAN_V2_SCHEMA) {
    return left.lineageCapacity === right.lineageCapacity
      && left.primaryCapacity === right.primaryCapacity
      && left.phaseLaneCount === right.phaseLaneCount
      && left.phaseLaneStride === right.phaseLaneStride
      && left.companionStart === right.companionStart
      && left.companionCapacity === right.companionCapacity
      && left.particleCapacity === right.particleCapacity
      && left.stableLaneAddress === right.stableLaneAddress
      && (left.phaseCompanionLanesRequired === true)
        === (right.phaseCompanionLanesRequired === true);
  }
  return left.primaryCapacity === right.primaryCapacity
    && left.companionStart === right.companionStart
    && left.companionCapacity === right.companionCapacity
    && left.particleCapacity === right.particleCapacity;
}

function resolveWorkerPhaseCarrierPlan({ data = null, seed = null, particleCount = 0 } = {}) {
  const candidates = [
    ['worker rematerialization seed phaseCarrierPlan', seed?.phaseCarrierPlan],
    ['SPH packed state phaseCarrierPlan', data?.sphParticleState?.phaseCarrierPlan],
    ['MLS-MPM packed state phaseCarrierPlan', data?.mlsMpmParticleState?.phaseCarrierPlan],
    ['SPH upload phaseCarrierPlan', data?.sphParticleUpload?.phaseCarrierPlan],
    ['MLS-MPM upload phaseCarrierPlan', data?.mlsMpmParticleUpload?.phaseCarrierPlan]
  ].filter(([, plan]) => plan != null);
  let resolved = null;
  for (const [label, plan] of candidates) {
    const candidate = clonePhaseCarrierPlanForParticleCount(plan, particleCount, label);
    if (resolved && !phaseCarrierPlansEqual(resolved, candidate)) {
      throw new RangeError('worker adopted-storage phaseCarrierPlan metadata conflicts across inputs');
    }
    resolved = candidate;
  }
  return resolved;
}

function uniqueStringList(values = []) {
  const source = Array.isArray(values) ? values : [];
  return [...new Set(source.map((value) => normalizeString(value, null)).filter(Boolean))];
}

function firstPositiveInteger(values = [], fallback = 0) {
  for (const value of values) {
    const number = Math.trunc(Number(value));
    if (Number.isFinite(number) && number > 0) return number;
  }
  return Math.max(0, Math.trunc(Number(fallback) || 0));
}

function isGasPressureBufferRef(ref) {
  const text = String(ref || '').toLowerCase();
  return text.includes('gaspressure')
    || text.includes('gas-pressure')
    || text.includes('gascell')
    || text.includes('gas-cell')
    || text.includes('resident-gas-pressure-cells-buffer');
}

function workerRetainedGasPressureBufferRefsFrom(value = null) {
  if (!value || typeof value !== 'object') return [];
  return uniqueStringList([
    ...(value.workerRetainedGasPressureBufferRefs || []),
    ...(value.retainedGasCellFieldSource?.workerRetainedGasPressureBufferRefs || []),
    ...(value.pressureInterfaceGasCellFieldAdmission?.workerRetainedGasPressureBufferRefs || []),
    ...(value.gasCellFieldAdmission?.workerRetainedGasPressureBufferRefs || []),
    ...(value.admission?.workerRetainedGasPressureBufferRefs || [])
  ]).filter(isGasPressureBufferRef);
}

function retainedGasPressureBufferRefsFrom(value = null) {
  if (!value || typeof value !== 'object') return [];
  return uniqueStringList([
    ...(value.retainedGasPressureBufferRefs || []),
    ...(value.retainedGasCellFieldSource?.retainedGasPressureBufferRefs || []),
    ...(value.pressureInterfaceGasCellFieldAdmission?.retainedGasPressureBufferRefs || []),
    ...(value.gasCellFieldAdmission?.retainedGasPressureBufferRefs || []),
    ...(value.admission?.retainedGasPressureBufferRefs || [])
  ]).filter(isGasPressureBufferRef);
}

function pressureInterfaceSourceKeyBufferReadyFromOptions(options = {}) {
  const field = options?.materialInterfaceField || null;
  return Boolean(
    field
    && (
      field.interfaceSourceKeyBuffer
      || field.sourceKeyBuffer
      || field.interfaceSourceKeyBufferRetained === true
      || field.sourceKeyBufferRetained === true
    )
    && firstPositiveInteger([field.interfaceSourceKeyRowCount, field.sourceKeyRowCount]) > 0
  );
}

function laneKeyFor(payload = {}) {
  return [
    normalizeString(payload.lease?.laneId ?? payload.lane?.laneId, 'worker-lane:default'),
    normalizeString(payload.lease?.stateKey ?? payload.lane?.stateKey, 'worker-state:default')
  ].join('|');
}

function laneKeyForParts({ laneId = null, stateKey = null } = {}) {
  return [
    normalizeString(laneId, 'worker-lane:default'),
    normalizeString(stateKey, 'worker-state:default')
  ].join('|');
}

function getLaneRecord(payload = {}) {
  const key = laneKeyFor(payload);
  let record = retainedLanes.get(key);
  if (!record) {
    record = {
      key,
      stageResults: {},
      retainedBuffers: new Map(),
      scheduleRetainedBufferRefBySlot: new Map(),
      retainedThermoBuffer: null,
      retainedThermoBufferByteLength: 0,
      retainedThermoBufferSourceStage: null,
      retainedThermoBufferSeededFromCpu: false,
      retainedThermoBufferCopySrc: false,
      retainedThermoSnapshotRows: null,
      phaseCarrierPlan: null,
      compactSnapshotExportSources: null,
      pressureInterfaceGridForceHandoff: null,
      schroederLane: null,
      workerDevice: null,
      nextBufferOrdinal: 1
    };
    retainedLanes.set(key, record);
  }
  return record;
}

function collectLaneOwnedGpuBuffers(value, buffers, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (isGpuBufferLike(value)) {
    buffers.add(value);
    return;
  }
  if (value instanceof Map) {
    for (const entry of value.values()) {
      collectLaneOwnedGpuBuffers(entry, buffers, seen);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectLaneOwnedGpuBuffers(entry, buffers, seen);
    return;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return;
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'device' || key === 'queue' || typeof entry === 'function') continue;
    collectLaneOwnedGpuBuffers(entry, buffers, seen);
  }
}

export function releaseUlgMechanicsResidentStageWorkerLane({
  laneId = null,
  stateKey = null,
  reason = 'lane-retired'
} = {}) {
  const key = laneKeyForParts({ laneId, stateKey });
  if (activeWorkerResidentScheduleByLaneKey.get(key)) {
    return {
      status: 'worker-resident-lane-release-blocked-schedule-active',
      laneId: normalizeString(laneId, null),
      stateKey: normalizeString(stateKey, null),
      reason,
      released: false,
      destroyedBufferCount: 0
    };
  }
  const record = retainedLanes.get(key);
  if (!record) {
    return {
      status: 'worker-resident-lane-release-noop-missing',
      laneId: normalizeString(laneId, null),
      stateKey: normalizeString(stateKey, null),
      reason,
      released: false,
      destroyedBufferCount: 0
    };
  }
  const staticGpuResources = record.schroederLane?.staticGpuResources || null;
  if (record.schroederLane?.residentStep) {
    try {
      destroyMlsMpmResidentStepBuffers(record.schroederLane.residentStep, {
        destroyInputResidentProductMass: true
      });
    } catch {
      // The lane is being retired regardless; the owned-buffer walk below is
      // the final best-effort safety net for device resources.
    }
  }
  if (record.poisonedCanonicalResidentStep) {
    try {
      destroyMlsMpmResidentStepBuffers(
        record.poisonedCanonicalResidentStep,
        { destroyInputResidentProductMass: true }
      );
    } catch {
      // The poisoned successor remains reachable through the record until
      // the owned-buffer walk below finishes every remaining resource.
    }
  }
  if (record.poisonedTier0Execution?.finalStep) {
    try {
      destroyMlsMpmResidentStepBuffers(
        record.poisonedTier0Execution.finalStep,
        { destroyInputResidentProductMass: true }
      );
    } catch {
      // The owned-buffer walk below remains the final teardown safety net.
    }
  }
  for (const cleanupRecord of (
    record.poisonedTier0SubmittedCleanupRecords || []
  )) {
    if (cleanupRecord?.released === true) continue;
    try {
      cleanupRecord.cleanup?.();
      cleanupRecord.released = true;
    } catch {
      // Best-effort poisoned-lane teardown continues with the buffer walk.
    }
  }
  try {
    record.pendingPhaseCarrierOneToFourTransition?.execution
      ?.cleanupSubmittedWork?.();
  } catch {
    // The owned-buffer walk below still retires the retained particle
    // families. This callback owns only the materializer's uniform buffer.
  }
  destroySphThermalResponseGraphBuffers(
    staticGpuResources?.thermalResponseGraphUpload
  );
  destroyMlsMpmMechanicsMaterialPhaseUpload(
    staticGpuResources?.mechanicsMaterialPhaseUpload
  );
  const buffers = new Set();
  collectLaneOwnedGpuBuffers(record, buffers);
  for (const buffer of buffers) {
    try { buffer.destroy?.(); } catch { /* best-effort lane retirement */ }
  }
  retainedLanes.delete(key);
  return {
    status: 'worker-resident-lane-released',
    laneId: normalizeString(laneId, null),
    stateKey: normalizeString(stateKey, null),
    reason,
    released: true,
    destroyedBufferCount: buffers.size
  };
}

function isGpuBufferLike(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && (
      value.constructor?.name === 'GPUBuffer'
      || typeof value.mapAsync === 'function'
      || typeof value.getMappedRange === 'function'
    )
  );
}

function retainGpuBuffer(record, stageId, path, buffer) {
  const ref = `ulg-worker:${record.key}:${stageId}:${path}:${record.nextBufferOrdinal++}`;
  // W2 emits a fresh transport envelope for the same bounded set of SS
  // buffer paths every step. Those refs are presentation telemetry, not the
  // buffers' lifecycle owner; retaining every historical wrapper until lane
  // deletion made a persistent lane grow without bound. Replace only the
  // private schedule's same-stage/path slot while leaving generic W1 refs
  // untouched for their independent continuity contracts.
  if (
    activeWorkerResidentScheduleByLaneKey.get(record.key)
    && WORKER_SCHROEDER_SCHEDULE_TRANSPORT_STAGE_IDS.has(stageId)
  ) {
    const slot = `${stageId}:${path}`;
    const previousRef = record.scheduleRetainedBufferRefBySlot.get(slot);
    if (previousRef) record.retainedBuffers.delete(previousRef);
    record.scheduleRetainedBufferRefBySlot.set(slot, ref);
  }
  record.retainedBuffers.set(ref, buffer);
  return {
    schema: 'peercompute.ulg.worker-retained-buffer-ref.v0',
    ref,
    stageId,
    path
  };
}

function exactGasPressureTransportGraphRecords(value = null) {
  const pending = [value];
  const seen = new Set();
  const records = [];
  const byRecord = new WeakMap();
  const descriptorCache = new WeakMap();
  const prototypeCache = new WeakMap();
  let visited = 0;

  const descriptorSnapshot = (record, key) => {
    let properties = descriptorCache.get(record);
    if (!properties) {
      properties = new Map();
      descriptorCache.set(record, properties);
    }
    if (properties.has(key)) return properties.get(key);
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(record, key);
    } catch (error) {
      const snapshot = Object.freeze({
        present: false,
        accessor: false,
        value: undefined,
        enumerable: false,
        error
      });
      properties.set(key, snapshot);
      return snapshot;
    }
    const snapshot = descriptor
      ? Object.freeze({
          present: true,
          accessor: !Object.hasOwn(descriptor, 'value'),
          value: Object.hasOwn(descriptor, 'value')
            ? descriptor.value
            : undefined,
          enumerable: descriptor.enumerable === true,
          error: null
        })
      : Object.freeze({
          present: false,
          accessor: false,
          value: undefined,
          enumerable: false,
          error: null
        });
    properties.set(key, snapshot);
    return snapshot;
  };

  const prototypeSnapshot = (record) => {
    if (prototypeCache.has(record)) return prototypeCache.get(record);
    let prototype = null;
    let error = null;
    try {
      prototype = Object.getPrototypeOf(record);
    } catch (cause) {
      error = cause;
    }
    const snapshot = Object.freeze({ prototype, error });
    prototypeCache.set(record, snapshot);
    return snapshot;
  };

  const capturePrototypeSchemas = (record) => {
    const schemas = [];
    const prototypeSeen = new Set();
    let cursor = record;
    for (let depth = 0; depth < 32; depth += 1) {
      const { prototype, error } = prototypeSnapshot(cursor);
      if (error) {
        return Object.freeze({
          schemas: Object.freeze(schemas),
          issue: Object.freeze({ kind: 'inspection', error })
        });
      }
      if (!prototype) {
        return Object.freeze({
          schemas: Object.freeze(schemas),
          issue: null
        });
      }
      if (prototypeSeen.has(prototype)) {
        return Object.freeze({
          schemas: Object.freeze(schemas),
          issue: Object.freeze({ kind: 'cycle', error: null })
        });
      }
      prototypeSeen.add(prototype);
      schemas.push(Object.freeze({
        owner: prototype,
        property: descriptorSnapshot(prototype, 'schema')
      }));
      cursor = prototype;
    }
    return Object.freeze({
      schemas: Object.freeze(schemas),
      issue: Object.freeze({ kind: 'limit', error: null })
    });
  };

  while (pending.length > 0) {
    const candidate = pending.shift();
    if (
      !candidate
      || (typeof candidate !== 'object' && typeof candidate !== 'function')
      || seen.has(candidate)
    ) continue;
    if (visited >= 64) {
      const error = new TypeError(
        'Exact gas-pressure worker transport graph exceeds the bounded wrapper depth'
      );
      error.code = 'ERR_ULG_WORKER_GAS_AUTHORITY_GRAPH_LIMIT';
      throw error;
    }
    visited += 1;
    seen.add(candidate);
    records.push(candidate);
    let ownKeys;
    try {
      ownKeys = Reflect.ownKeys(candidate);
    } catch (cause) {
      const error = new TypeError(
        'Exact gas-pressure worker transport own keys could not be inspected'
      );
      error.code = 'ERR_ULG_WORKER_GAS_AUTHORITY_PROPERTY_INSPECTION';
      error.cause = cause;
      throw error;
    }
    for (const key of EXACT_GAS_PRESSURE_TRANSPORT_CAPTURE_KEYS) {
      descriptorSnapshot(candidate, key);
    }
    for (const key of ownKeys) descriptorSnapshot(candidate, key);
    const capture = Object.freeze({
      record: candidate,
      ownKeys: Object.freeze([...ownKeys]),
      properties: descriptorCache.get(candidate),
      prototypeSchemas: capturePrototypeSchemas(candidate)
    });
    byRecord.set(candidate, capture);
    for (const key of EXACT_GAS_PRESSURE_TRANSPORT_GRAPH_KEYS) {
      const property = capture.properties.get(key);
      if (property.error) {
        const error = new TypeError(
          `Exact gas-pressure worker transport could not inspect ${key}`
        );
        error.code = 'ERR_ULG_WORKER_GAS_AUTHORITY_PROPERTY_INSPECTION';
        error.cause = property.error;
        throw error;
      }
      if (property.accessor) {
        const error = new TypeError(
          `Exact gas-pressure worker transport ${key} must be an own data property`
        );
        error.code = 'ERR_ULG_WORKER_GAS_AUTHORITY_ACCESSOR';
        throw error;
      }
      if (!property.present) continue;
      const nested = property.value;
      if (
        nested
        && (typeof nested === 'object' || typeof nested === 'function')
        && !seen.has(nested)
      ) pending.push(nested);
    }
  }
  return Object.freeze({
    records: Object.freeze(records),
    byRecord
  });
}

function exactGasPressureTransportGraphCapture(value = null) {
  try {
    return Object.freeze({
      root: value,
      graph: exactGasPressureTransportGraphRecords(value),
      error: null
    });
  } catch (error) {
    return Object.freeze({ root: value, graph: null, error });
  }
}

function exactGasPressureTransportOwnDataProperty(graph, record, key) {
  const property = graph?.byRecord?.get(record)?.properties?.get(key) || null;
  if (!property) return { present: false, value: undefined };
  if (property.error) {
    const error = new TypeError(
      `Exact gas-pressure worker transport could not inspect ${String(key)}`
    );
    error.code = 'ERR_ULG_WORKER_GAS_AUTHORITY_PROPERTY_INSPECTION';
    error.cause = property.error;
    throw error;
  }
  if (property.accessor) {
    const error = new TypeError(
      `Exact gas-pressure worker transport ${String(key)} must be an own data property`
    );
    error.code = 'ERR_ULG_WORKER_GAS_AUTHORITY_ACCESSOR';
    throw error;
  }
  return { present: property.present, value: property.value };
}

function exactGasPressureTransportMaterializedValue(
  graph,
  value,
  materialized = new Map()
) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
    return value;
  }
  if (isExactSphSpatialGasPressureAuthoritySource(value)) return value;
  const capture = graph?.byRecord?.get(value) || null;
  if (!capture) return value;
  if (materialized.has(value)) return materialized.get(value);
  const output = Array.isArray(value) ? [] : {};
  materialized.set(value, output);
  for (const key of capture.ownKeys) {
    const property = capture.properties.get(key);
    if (
      !property
      || property.error
      || property.accessor
      || !property.present
      || !property.enumerable
    ) continue;
    const nested = exactGasPressureTransportMaterializedValue(
      graph,
      property.value,
      materialized
    );
    Object.defineProperty(output, key, {
      enumerable: true,
      configurable: true,
      writable: true,
      value: nested
    });
  }
  return output;
}

function exactGasPressureAuthoritySourceFromResult(value = null) {
  return exactGasPressureTransportGraphRecords(value).records.find((candidate) => (
    isExactSphSpatialGasPressureAuthoritySource(candidate)
  )) || null;
}

function exactGasPressureTransportRawAliasIssue(graph = null) {
  for (const record of graph?.records || []) {
    for (const key of EXACT_GAS_PRESSURE_TRANSPORT_RAW_ALIAS_KEYS) {
      let property;
      try {
        property = exactGasPressureTransportOwnDataProperty(graph, record, key);
      } catch (error) {
        return {
          kind: error?.code === 'ERR_ULG_WORKER_GAS_AUTHORITY_ACCESSOR'
            ? 'accessor'
            : 'inspection',
          key,
          error
        };
      }
      if (property.present) {
        return { kind: 'raw-alias', key, value: property.value };
      }
    }
  }
  return null;
}

function exactGasPressureTransportProtectedSchemaIssue(graph = null) {
  for (const record of graph?.records || []) {
    let property;
    try {
      property = exactGasPressureTransportOwnDataProperty(
        graph,
        record,
        'schema'
      );
    } catch (error) {
      return {
        kind: error?.code === 'ERR_ULG_WORKER_GAS_AUTHORITY_ACCESSOR'
          ? 'accessor'
          : 'inspection',
        error
      };
    }
    const exact = isExactSphSpatialGasPressureAuthoritySource(record);
    if (exact) {
      if (
        !property.present
        || property.value !== ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA
      ) {
        return {
          kind: 'exact-schema-mismatch',
          schema: property.value
        };
      }
      continue;
    }
    if (property.value === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA) {
      return {
        kind: 'forged-current-schema',
        schema: property.value
      };
    }
    if (EXACT_GAS_PRESSURE_TRANSPORT_RETIRED_SCHEMA_KEYS.has(property.value)) {
      return {
        kind: 'retired-schema',
        schema: property.value
      };
    }
    const prototypeSchemas = graph.byRecord.get(record)?.prototypeSchemas;
    if (prototypeSchemas?.issue) {
      return {
        kind: 'inspection',
        inherited: true,
        error: prototypeSchemas.issue.error || null
      };
    }
    for (const { property: inheritedProperty } of (
      prototypeSchemas?.schemas || []
    )) {
      if (inheritedProperty.error) {
        return {
          kind: 'inspection',
          inherited: true,
          error: inheritedProperty.error
        };
      }
      if (inheritedProperty.accessor) {
        return {
          kind: 'accessor',
          inherited: true,
          error: null
        };
      }
      if (
        inheritedProperty.value === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA
      ) {
        return {
          kind: 'forged-current-schema',
          inherited: true,
          schema: inheritedProperty.value
        };
      }
      if (
        EXACT_GAS_PRESSURE_TRANSPORT_RETIRED_SCHEMA_KEYS.has(
          inheritedProperty.value
        )
      ) {
        return {
          kind: 'retired-schema',
          inherited: true,
          schema: inheritedProperty.value
        };
      }
    }
  }
  return null;
}

function exactGasPressureTransportExactSources(graph = null) {
  return (graph?.records || []).filter((record) => (
    isExactSphSpatialGasPressureAuthoritySource(record)
  ));
}

function exactGasPressureTransportApprovedAdmissions(graph = null) {
  const admissions = [];
  for (const record of graph?.records || []) {
    const schema = exactGasPressureTransportOwnDataProperty(
      graph,
      record,
      'schema'
    ).value;
    if (
      schema !== 'peercompute.ulg.pressure-interface-gas-cell-field-admission.v0'
    ) continue;
    const status = exactGasPressureTransportOwnDataProperty(
      graph,
      record,
      'status'
    ).value;
    const approved = exactGasPressureTransportOwnDataProperty(
      graph,
      record,
      'gasCellFieldConsumptionApproved'
    ).value;
    if (
      status !== 'pressure-interface-gas-cell-field-consumption-approved'
      || approved !== true
    ) continue;
    admissions.push(Object.freeze({
      admission: record,
      retainedSource: exactGasPressureTransportOwnDataProperty(
        graph,
        record,
        'retainedGasCellFieldSource'
      ).value
    }));
  }
  return Object.freeze(admissions);
}

function exactGasPressureTransportBoundary(source = null) {
  if (!isExactSphSpatialGasPressureAuthoritySource(source)) return null;
  return {
    source
  };
}

function cloneableValue(
  value,
  record,
  stageId,
  path = 'result',
  seen = new WeakSet(),
  gasPressureBoundary = null
) {
  if (value == null) return value;
  if (typeof value === 'function') return null;
  if (isGpuBufferLike(value)) return retainGpuBuffer(record, stageId, path, value);
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
  if (typeof value !== 'object') return value;
  if (isExactSphSpatialGasPressureAuthoritySource(value)) {
    return describeSphSpatialGasPressureAuthority(value);
  }
  if (seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((entry, index) => {
      const cloned = cloneableValue(
        entry,
        record,
        stageId,
        `${path}.${index}`,
        seen,
        gasPressureBoundary
      );
      return cloned === undefined ? null : cloned;
    });
  }
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'device' || key === 'navigatorRef' || key === 'deviceResult') continue;
    if (WORKER_LOCAL_PRESSURE_AUTHORITY_KEYS.has(key)) continue;
    if (
      gasPressureBoundary
      && (
        EXACT_GAS_PRESSURE_TRANSPORT_RAW_ALIAS_KEYS.has(key)
        || EXACT_GAS_PRESSURE_TRANSPORT_CAPABILITY_KEYS.has(key)
      )
    ) continue;
    if (
      gasPressureBoundary
      && (
        key === 'retainedGasPressureBufferRefs'
        || key === 'workerRetainedGasPressureBufferRefs'
      )
    ) {
      out[key] = [];
      continue;
    }
    if (
      gasPressureBoundary
      && key === 'retainedBufferRefs'
      && Array.isArray(entry)
    ) {
      out[key] = entry.filter((ref) => !isGasPressureBufferRef(ref));
      continue;
    }
    const cloned = cloneableValue(
      entry,
      record,
      stageId,
      `${path}.${key}`,
      seen,
      gasPressureBoundary
    );
    if (cloned !== undefined) out[key] = cloned;
  }
  return out;
}

function positiveByteLength(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return Math.round(number);
  }
  return 0;
}

function destroyGpuBufferQuietly(buffer) {
  try {
    buffer?.destroy?.();
  } catch {}
}

function cloneFloat32Rows(value, expectedLength = null) {
  if (!(ArrayBuffer.isView(value) || value instanceof ArrayBuffer || Array.isArray(value))) {
    return null;
  }
  let rows;
  if (value instanceof Float32Array) {
    rows = new Float32Array(value);
  } else if (ArrayBuffer.isView(value)) {
    rows = new Float32Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  } else if (value instanceof ArrayBuffer) {
    rows = new Float32Array(value.slice(0));
  } else {
    rows = new Float32Array(value);
  }
  if (expectedLength != null && rows.length < expectedLength) return null;
  return expectedLength != null && rows.length !== expectedLength
    ? new Float32Array(rows.slice(0, expectedLength))
    : rows;
}

async function readWorkerGpuBufferFloat32({
  device,
  sourceBuffer,
  byteLength,
  floatLength,
  label
} = {}) {
  const resolvedByteLength = positiveByteLength(byteLength, floatLength * Float32Array.BYTES_PER_ELEMENT);
  const resolvedFloatLength = Math.max(0, Math.floor(Number(floatLength) || 0));
  if (!device?.createBuffer || !device?.createCommandEncoder || typeof device?.queue?.submit !== 'function') {
    throw new Error(`${label || 'retained-buffer'} readback requires a WebGPU device`);
  }
  if (!sourceBuffer || resolvedByteLength <= 0 || resolvedFloatLength <= 0) {
    throw new Error(`${label || 'retained-buffer'} readback requires a retained source buffer`);
  }
  let readbackBuffer = null;
  try {
    readbackBuffer = device.createBuffer({
      label: `ulg-worker-retained-compact-snapshot-${label || 'buffer'}-readback`,
      size: Math.max(4, resolvedByteLength),
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
    const encoder = device.createCommandEncoder({
      label: `ulg-worker-retained-compact-snapshot-${label || 'buffer'}`
    });
    encoder.copyBufferToBuffer(sourceBuffer, 0, readbackBuffer, 0, Math.max(4, resolvedByteLength));
    device.queue.submit([encoder.finish()]);
    await readbackBuffer.mapAsync(GPU_MAP_MODE.READ);
    const mapped = readbackBuffer.getMappedRange(0, Math.max(4, resolvedByteLength));
    const rows = new Float32Array(mapped.slice(0, resolvedFloatLength * Float32Array.BYTES_PER_ELEMENT));
    readbackBuffer.unmap();
    return rows;
  } catch (error) {
    throw new Error(`${label || 'retained-buffer'} readback failed: ${
      error instanceof Error ? error.message : String(error)
    }`);
  } finally {
    try {
      readbackBuffer?.destroy?.();
    } catch {}
  }
}

async function readWorkerGpuBufferUint32({
  device,
  sourceBuffer,
  byteLength,
  uintLength,
  label
} = {}) {
  const resolvedUintLength = Math.max(0, Math.floor(Number(uintLength) || 0));
  const resolvedByteLength =
    resolvedUintLength * Uint32Array.BYTES_PER_ELEMENT;
  const declaredByteLength = Math.floor(Number(byteLength) || 0);
  if (
    !device?.createBuffer
    || !device?.createCommandEncoder
    || typeof device?.queue?.submit !== 'function'
  ) {
    throw new Error(`${label || 'retained-buffer'} readback requires a WebGPU device`);
  }
  if (
    !sourceBuffer
    || resolvedByteLength <= 0
    || resolvedUintLength <= 0
    || declaredByteLength !== resolvedByteLength
    || (Number.isFinite(Number(sourceBuffer.size))
      && Number(sourceBuffer.size) < resolvedByteLength)
  ) {
    throw new Error(`${label || 'retained-buffer'} readback requires a retained source buffer`);
  }
  let readbackBuffer = null;
  try {
    readbackBuffer = device.createBuffer({
      label: `ulg-worker-retained-compact-snapshot-${label || 'buffer'}-readback`,
      size: Math.max(4, resolvedByteLength),
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
    const encoder = device.createCommandEncoder({
      label: `ulg-worker-retained-compact-snapshot-${label || 'buffer'}`
    });
    encoder.copyBufferToBuffer(
      sourceBuffer,
      0,
      readbackBuffer,
      0,
      Math.max(4, resolvedByteLength)
    );
    device.queue.submit([encoder.finish()]);
    await readbackBuffer.mapAsync(GPU_MAP_MODE.READ);
    const mapped = readbackBuffer.getMappedRange(0, Math.max(4, resolvedByteLength));
    const rows = new Uint32Array(
      mapped.slice(0, resolvedUintLength * Uint32Array.BYTES_PER_ELEMENT)
    );
    if (rows.length !== resolvedUintLength) {
      throw new Error(`${label || 'retained-buffer'} readback returned incomplete rows`);
    }
    readbackBuffer.unmap();
    return rows;
  } catch (error) {
    throw new Error(`${label || 'retained-buffer'} readback failed: ${
      error instanceof Error ? error.message : String(error)
    }`);
  } finally {
    try {
      readbackBuffer?.destroy?.();
    } catch {}
  }
}

async function cloneWorkerGpuBufferForCompactSnapshot({
  device,
  sourceBuffer,
  byteLength,
  label
} = {}) {
  const resolvedByteLength = positiveByteLength(byteLength);
  if (!device?.createBuffer || !device?.createCommandEncoder || typeof device?.queue?.submit !== 'function') {
    throw new Error(`${label || 'compact-snapshot-source'} clone requires a WebGPU device`);
  }
  if (!sourceBuffer || resolvedByteLength <= 0) {
    throw new Error(`${label || 'compact-snapshot-source'} clone requires a retained source buffer`);
  }
  const clone = device.createBuffer({
    label: `ulg-worker-retained-compact-snapshot-${label || 'source'}-export-source`,
    size: Math.max(4, resolvedByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  try {
    const encoder = device.createCommandEncoder({
      label: `ulg-worker-retained-compact-snapshot-${label || 'source'}-export-source-copy`
    });
    encoder.copyBufferToBuffer(sourceBuffer, 0, clone, 0, Math.max(4, resolvedByteLength));
    device.queue.submit([encoder.finish()]);
    return clone;
  } catch (error) {
    destroyGpuBufferQuietly(clone);
    throw error;
  }
}

function compactSnapshotExportSourcesBlocked({
  reason,
  laneId = null,
  stateKey = null,
  sourceStageId = 'g2p',
  source = null,
  error = null
} = {}) {
  return {
    schema: 'peercompute.ulg.worker-retained-compact-snapshot-export-sources.v0',
    status: 'worker-retained-compact-snapshot-export-sources-blocked',
    reason,
    laneId: normalizeString(laneId, null),
    stateKey: normalizeString(stateKey, null),
    sourceStageId,
    stateBufferRetained: Boolean(source?.stateBuffer),
    mechanicsBufferRetained: Boolean(source?.mechanicsBuffer),
    stateBufferByteLength: positiveByteLength(source?.stateBufferByteLength),
    mechanicsBufferByteLength: positiveByteLength(source?.mechanicsBufferByteLength),
    exportOwnedStateBufferReady: false,
    exportOwnedMechanicsBufferReady: false,
    exportOwnedSourceReady: false,
    errorName: error instanceof Error ? error.name : null,
    errorMessage: error instanceof Error ? error.message : (error ? String(error) : null)
  };
}

function compactSnapshotExportSourcesSummary(sources = null) {
  if (!sources) return null;
  return {
    schema: sources.schema || 'peercompute.ulg.worker-retained-compact-snapshot-export-sources.v0',
    status: sources.status || null,
    reason: sources.reason || null,
    laneId: sources.laneId ?? null,
    stateKey: sources.stateKey ?? null,
    sourceStageId: sources.sourceStageId ?? null,
    stateBufferByteLength: sources.stateBufferByteLength ?? null,
    mechanicsBufferByteLength: sources.mechanicsBufferByteLength ?? null,
    exportOwnedStateBufferReady: sources.exportOwnedStateBufferReady === true,
    exportOwnedMechanicsBufferReady: sources.exportOwnedMechanicsBufferReady === true,
    exportOwnedSourceReady: sources.exportOwnedSourceReady === true,
    errorName: sources.errorName ?? null,
    errorMessage: sources.errorMessage ?? null
  };
}

function releaseCompactSnapshotExportSources(record) {
  const sources = record?.compactSnapshotExportSources;
  if (!sources?.exportOwnedSourceReady) return;
  destroyGpuBufferQuietly(sources.stateBuffer);
  destroyGpuBufferQuietly(sources.mechanicsBuffer);
}

export async function captureUlgMechanicsResidentStageWorkerCompactSnapshotExportSources({
  device = null,
  record = null,
  source = null,
  laneId = null,
  stateKey = null,
  sourceStageId = 'g2p'
} = {}) {
  if (!record || typeof record !== 'object') {
    return compactSnapshotExportSourcesBlocked({
      reason: 'worker-retained-compact-snapshot-export-sources-record-required',
      laneId,
      stateKey,
      sourceStageId,
      source
    });
  }
  const stateByteLength = positiveByteLength(source?.stateBufferByteLength);
  const mechanicsByteLength = positiveByteLength(source?.mechanicsBufferByteLength);
  if (!source?.stateBuffer || !source?.mechanicsBuffer || stateByteLength <= 0 || mechanicsByteLength <= 0) {
    const blocked = compactSnapshotExportSourcesBlocked({
      reason: 'worker-retained-compact-snapshot-export-sources-require-g2p-state-and-mechanics',
      laneId,
      stateKey,
      sourceStageId,
      source
    });
    releaseCompactSnapshotExportSources(record);
    record.compactSnapshotExportSources = blocked;
    return blocked;
  }
  if (!device?.createBuffer || !device?.createCommandEncoder || typeof device?.queue?.submit !== 'function') {
    const blocked = compactSnapshotExportSourcesBlocked({
      reason: 'worker-retained-compact-snapshot-export-sources-require-webgpu-device',
      laneId,
      stateKey,
      sourceStageId,
      source
    });
    releaseCompactSnapshotExportSources(record);
    record.compactSnapshotExportSources = blocked;
    return blocked;
  }
  let stateBuffer = null;
  let mechanicsBuffer = null;
  try {
    stateBuffer = await cloneWorkerGpuBufferForCompactSnapshot({
      device,
      sourceBuffer: source.stateBuffer,
      byteLength: stateByteLength,
      label: 'sph-state'
    });
    mechanicsBuffer = await cloneWorkerGpuBufferForCompactSnapshot({
      device,
      sourceBuffer: source.mechanicsBuffer,
      byteLength: mechanicsByteLength,
      label: 'mls-mpm-mechanics'
    });
    releaseCompactSnapshotExportSources(record);
    const ready = {
      schema: 'peercompute.ulg.worker-retained-compact-snapshot-export-sources.v0',
      status: 'worker-retained-compact-snapshot-export-sources-ready',
      reason: 'export-owned-g2p-sources-captured-before-stage-output-expiry',
      laneId: normalizeString(laneId, null),
      stateKey: normalizeString(stateKey, null),
      sourceStageId,
      stateBuffer,
      mechanicsBuffer,
      stateBufferByteLength: stateByteLength,
      mechanicsBufferByteLength: mechanicsByteLength,
      exportOwnedStateBufferReady: true,
      exportOwnedMechanicsBufferReady: true,
      exportOwnedSourceReady: true
    };
    record.compactSnapshotExportSources = ready;
    return compactSnapshotExportSourcesSummary(ready);
  } catch (error) {
    destroyGpuBufferQuietly(stateBuffer);
    destroyGpuBufferQuietly(mechanicsBuffer);
    const blocked = compactSnapshotExportSourcesBlocked({
      reason: 'worker-retained-compact-snapshot-export-sources-copy-failed',
      laneId,
      stateKey,
      sourceStageId,
      source,
      error
    });
    releaseCompactSnapshotExportSources(record);
    record.compactSnapshotExportSources = blocked;
    return blocked;
  }
}

function workerStageRetainedByteLength(result = {}) {
  return positiveByteLength(
    result.stateBufferByteLength,
    result.nextParticleStateBufferByteLength,
    result.state?.byteLength
  )
    + positiveByteLength(
      result.thermoBufferByteLength,
      result.nextParticleThermoBufferByteLength,
      result.thermo?.byteLength
    )
    + positiveByteLength(
      result.mechanicsBufferByteLength,
      result.nextParticleMechanicsBufferByteLength,
      result.mechanics?.byteLength
    )
    + positiveByteLength(
      result.gridBufferByteLength,
      result.gridNodes?.byteLength
    )
    + positiveByteLength(
      result.updatedGridBufferByteLength,
      result.updatedGridNodes?.byteLength
    )
    + positiveByteLength(
      result.pressureInterfaceForceRowsBufferByteLength,
      result.forceRowsBufferByteLength,
      result.forceRowByteLength
    )
    + positiveByteLength(
      result.pressureInterfaceGasPressureCellRowByteLength,
      result.gasPressureCellRowByteLength,
      result.gasPressureCellRowsBufferByteLength
    )
    + positiveByteLength(
      result.productEventBufferByteLength,
      result.residentProductMass?.productEventBufferByteLength
    )
    + positiveByteLength(
      result.spatialGasLedgerBufferByteLength,
      result.compactSpatialGasReadbackByteLength
    );
}

function workerStageCopyBudget({ result = {}, readbackMode = null } = {}) {
  const retainedBytes = workerStageRetainedByteLength(result);
  const noFullReadback = readbackMode === 'no-full-readback'
    || result.readbackMode === 'no-full-readback'
    || result.normalHotLoopReadbackFree === true;
  return {
    schema: 'peercompute.compute.gpu-resident-lane-copy-budget.v0',
    uploadBytes: 0,
    readbackBytes: noFullReadback ? 0 : retainedBytes,
    retainedBytes,
    compactSummaryBytes: 0,
    fullReadbackReason: noFullReadback ? null : 'worker-stage-full-readback-mode'
  };
}

function retainedRefsForStageResult(stageId, result = {}) {
  const refs = [];
  const gpuResult = result.gpuResult || {};
  if (stageId === 'p2g' && (result.gridBuffer || gpuResult.gridBuffer || result.gridBufferByteLength > 0)) {
    refs.push('mls-mpm-p2g-grid-buffer');
  }
  if (stageId === 'gridUpdate' && (
    result.updatedGridBuffer
    || gpuResult.updatedGridBuffer
    || result.updatedGridBufferByteLength > 0
  )) {
    refs.push('mls-mpm-grid-update-buffer');
  }
  if (stageId === 'pressureInterface' && (
    result.pressureInterfaceForceRowsRetained
    || result.forceRowValues instanceof Float32Array
    || result.forceRowByteLength > 0
  )) {
    refs.push('pressure-interface-force-rows-buffer');
  }
  if (stageId === 'pressureInterface' && (
    result.interfaceSourceKeyBufferConsumed === true
    || result.interfaceSourceKeyBufferObserved === true
    || result.pressureInterfaceForceSolver?.interfaceSourceKeyBufferConsumed === true
    || result.pressureInterfaceForceSolver?.interfaceSourceKeyBufferObserved === true
    || result.materialInterfaceField?.interfaceSourceKeyBufferRetained === true
  )) {
    refs.push('sph-interface-source-key-buffer');
  }
  if (stageId === 'spatialGasLedgerProducer' && (
    result.spatialGasLedgerRowsBufferRetained
    || result.spatialGasLedgerRowsBuffer
  )) {
    refs.push('resident-spatial-gas-species-ledger-buffer');
  }
  if (stageId === 'gasCellEosProducer' && (
    result.gasPressureCellRowsBufferRetained
    || result.pressureInterfaceGasPressureCellRowsBufferRetained
    || result.gasPressureCellsBuffer
  )) {
    refs.push('resident-gas-pressure-cells-buffer');
  }
  if (stageId === 'g2p') {
    if (result.stateBuffer || gpuResult.stateBuffer || result.state instanceof Float32Array || result.stateBufferByteLength > 0) {
      refs.push('sph-state-buffer');
    }
    if (
      result.mechanicsBuffer
      || gpuResult.mechanicsBuffer
      || result.mechanics instanceof Float32Array
      || result.mechanicsBufferByteLength > 0
    ) {
      refs.push('mls-mpm-mechanics-buffer');
    }
  }
  if (stageId === 'thermalPhase') {
    if (result.stateBuffer || gpuResult.stateBuffer || result.state instanceof Float32Array || result.stateBufferByteLength > 0) {
      refs.push('sph-state-buffer');
    }
    if (result.thermoBuffer || gpuResult.thermoBuffer || result.thermo instanceof Float32Array || result.thermoBufferByteLength > 0) {
      refs.push('sph-thermo-buffer');
    }
  }
  if (stageId === 'reactionProduct') {
    if (result.stateBuffer || gpuResult.stateBuffer || result.state instanceof Float32Array || result.stateBufferByteLength > 0) {
      refs.push('sph-state-buffer');
    }
    if (result.thermoBuffer || gpuResult.thermoBuffer || result.thermo instanceof Float32Array || result.thermoBufferByteLength > 0) {
      refs.push('sph-thermo-buffer');
    }
    if (result.mechanicsBuffer || gpuResult.mechanicsBuffer || result.mechanics instanceof Float32Array || result.mechanicsBufferByteLength > 0) {
      refs.push('mls-mpm-mechanics-buffer');
    }
    if (
      result.residentProductMass?.productEventBufferRetained
      || result.residentProductMassBufferRetained
      || result.reactionSummary?.productEventBufferRetained
    ) {
      refs.push('resident-product-mass-buffer');
    }
  }
  return refs;
}

function retainedWorkerRefs(value = {}, out = []) {
  if (!value || typeof value !== 'object') return out;
  if (value.schema === 'peercompute.ulg.worker-retained-buffer-ref.v0' && value.ref) {
    out.push(value.ref);
    return out;
  }
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return out;
  for (const entry of Object.values(value)) retainedWorkerRefs(entry, out);
  return out;
}

function pressureInterfaceLocalGasCellFieldReadyFromOptions(
  options = {},
  graphCapture = null
) {
  const importValue = options.pressureInterfaceGasCellFieldImport || options.gasCellFieldImport || null;
  let stableImportValue = importValue;
  if (importValue && typeof importValue === 'object') {
    const capture = graphCapture?.root === importValue
      ? graphCapture
      : exactGasPressureTransportGraphCapture(importValue);
    if (capture.error || !capture.graph) return false;
    const importGraph = capture.graph;
    if (exactGasPressureTransportProtectedSchemaIssue(importGraph)) {
      return false;
    }
    const exactSources = exactGasPressureTransportExactSources(importGraph);
    if (exactSources.length > 1) return false;
    const exactSource = exactSources[0] || null;
    if (exactSource) {
      let schemaProperty;
      try {
        schemaProperty = exactGasPressureTransportOwnDataProperty(
          importGraph,
          exactSource,
          'schema'
        );
      } catch {
        return false;
      }
      if (
        !schemaProperty.present
        || schemaProperty.value !== ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA
        || exactGasPressureTransportRawAliasIssue(importGraph)
      ) return false;
      let approvedAdmissions;
      try {
        approvedAdmissions =
          exactGasPressureTransportApprovedAdmissions(importGraph);
      } catch {
        return false;
      }
      if (
        approvedAdmissions.length !== 1
        || approvedAdmissions[0].retainedSource !== exactSource
      ) return false;
      const workerDevice = options.deviceResult?.device || options.device || null;
      if (!workerDevice) return false;
      const description = describeSphSpatialGasPressureAuthority(
        exactSource,
        { device: workerDevice }
      );
      return Boolean(
        description?.readyObserved === true
        && description.deviceAuthenticated === true
        && description.releaseScheduledObserved !== true
        && description.releasedObserved !== true
        && description.terminalObserved !== true
        && description.consumerSubmittedObserved !== true
        && description.consumerBorrowedObserved !== true
      );
    }
    stableImportValue = exactGasPressureTransportMaterializedValue(
      importGraph,
      importValue
    );
  }
  const normalizedImport = normalizePressureInterfaceGasCellFieldImport(
    stableImportValue
  );
  if (
    normalizedImport.importReady === true
    && (
      normalizedImport.localPressureGradientReady === true
      || normalizedImport.retainedLocalPressureGradientReady === true
      || normalizedImport.gpuPressureAuthorityReady === true
    )
  ) {
    return true;
  }
  const retainedSource = stableImportValue?.retainedGasCellFieldSource
    || stableImportValue?.pressureInterfaceGasCellFieldAdmission?.retainedGasCellFieldSource
    || null;
  const rowCount = firstPositiveInteger([
    stableImportValue?.pressureInterfaceGasPressureCellRowCount,
    stableImportValue?.gasPressureCellRowCount,
    retainedSource?.pressureInterfaceGasPressureCellRowCount
  ]);
  const retainedRowsDescriptorReady = Boolean(
    stableImportValue
      && rowCount > 0
      && (
        workerRetainedGasPressureBufferRefsFrom(stableImportValue).length > 0
        || retainedGasPressureBufferRefsFrom(stableImportValue).length > 0
      )
  );
  if (retainedRowsDescriptorReady) return true;
  const importedField = stableImportValue?.gasCellFieldSnapshot
    || stableImportValue?.gasCellField
    || null;
  const gasCellField = importedField
    || options.pressureFeedback?.gasCellField
    || options.gasPressureSummary?.gasCellField
    || options.pressureSummary?.gasCellField
    || options.gasCellField
    || null;
  return gasCellField?.localPressureGradientReady === true
    && Array.isArray(gasCellField?.cells)
    && gasCellField.cells.length > 0;
}

function synchronizePressureInterfaceRetainedInputRefs(data = {}) {
  if (!pressureInterfaceLocalGasCellFieldReadyFromOptions(data)) return false;
  let synchronized = false;
  for (const requirement of [data.gpuFenceRequirement, data.gpuResidentLane]) {
    if (!requirement || typeof requirement !== 'object') continue;
    requirement.retainedBufferRefs = [...new Set([
      ...(Array.isArray(requirement.retainedBufferRefs)
        ? requirement.retainedBufferRefs
        : []),
      'resident-gas-pressure-cells-buffer'
    ])];
    synchronized = true;
  }
  return synchronized;
}

function workerContext(payload = {}) {
  return payload.context?.ulgMechanicsResidentStageWorker
    || payload.context?.mechanicsResidentStageWorker
    || {};
}

export async function resolveUlgMechanicsResidentStageWorkerDeviceResult({
  preferWebGpu = false,
  providedDeviceResult = null,
  providedDevice = null,
  requestDeviceResult = null,
  navigatorRef = globalThis.navigator
} = {}) {
  if (preferWebGpu !== true) return null;
  if (providedDeviceResult?.device) {
    return {
      ...providedDeviceResult,
      status: providedDeviceResult.status || 'webgpu-ready-supplied-worker-device-result',
      reason: providedDeviceResult.reason || 'caller supplied worker device result',
      workerDeviceSource: 'provided-device-result',
      workerDeviceProvided: true
    };
  }
  if (providedDevice?.createBuffer) {
    return {
      status: 'webgpu-ready-supplied-worker-device',
      reason: 'caller supplied worker device',
      device: providedDevice,
      workerDeviceSource: 'provided-device',
      workerDeviceProvided: true
    };
  }
  const request = typeof requestDeviceResult === 'function'
    ? requestDeviceResult
    : requestOpticalGpuDevice;
  const result = await request(navigatorRef, {
    onDeviceLost() {}
  });
  return result
    ? {
        ...result,
        workerDeviceSource: result.workerDeviceSource || 'worker-requested-device',
        workerDeviceProvided: false
      }
    : null;
}

async function getWorkerDeviceResult(preferWebGpu, data = {}) {
  if (preferWebGpu !== true) return null;
  if (data?.deviceResult?.device || data?.device?.createBuffer) {
    return resolveUlgMechanicsResidentStageWorkerDeviceResult({
      preferWebGpu,
      providedDeviceResult: data.deviceResult,
      providedDevice: data.device
    });
  }
  if (!workerDeviceResultPromise) {
    workerDeviceResultPromise = requestOpticalGpuDevice(globalThis.navigator, {
      onDeviceLost() {
        workerDeviceResultPromise = null;
      },
      // Diagnostic pass-level GPU timestamps need the 'timestamp-query'
      // device feature, which must be negotiated at acquisition -- and the
      // worker device is a session singleton usually acquired on a stage
      // message that predates any schedule options. Enabling the feature is
      // free (cost exists only when a query set is created), so always
      // negotiate it when the adapter offers it.
      timestampProfilingRequested: true
    }).then((result) => result
      ? {
          ...result,
          workerDeviceSource: result.workerDeviceSource || 'worker-requested-device',
          workerDeviceProvided: false
        }
      : result
    );
  }
  return workerDeviceResultPromise;
}

function writeWorkerStorageBuffer(device, label, data) {
  if (!device?.createBuffer || !device.queue?.writeBuffer || !ArrayBuffer.isView(data)) return null;
  const byteLength = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
  });
  if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

function hasWorkerRetainedGpuStageOutput(stageId, rawResult = {}) {
  if (!rawResult || typeof rawResult !== 'object') return false;
  if (stageId === 'p2g') {
    return Boolean(rawResult.gridBuffer || rawResult.gpuResult?.gridBuffer);
  }
  if (stageId === 'gridUpdate') {
    return Boolean(rawResult.updatedGridBuffer || rawResult.gpuResult?.updatedGridBuffer);
  }
  if (stageId === 'g2p' || stageId === 'thermalPhase' || stageId === 'reactionProduct') {
    return Boolean(
      rawResult.stateBuffer
      || rawResult.mechanicsBuffer
      || rawResult.thermoBuffer
      || rawResult.gpuResult?.stateBuffer
      || rawResult.gpuResult?.mechanicsBuffer
      || rawResult.gpuResult?.thermoBuffer
    );
  }
  return false;
}

function sameWorkerQueueFenceFallbackAllowed({ data, rawResult, workerDeviceResult, stageId }) {
  return data?.sameWorkerQueueFenceFallback !== false
    && (
      data?.sameWorkerQueueFenceFallback === true
      || workerDeviceResult?.workerDeviceSource === 'offscreen-presentation-worker-device'
      || data?.deviceResult?.workerDeviceSource === 'offscreen-presentation-worker-device'
    )
    && rawResult?.backend === 'webgpu'
    && hasWorkerRetainedGpuStageOutput(stageId, rawResult);
}

function retainedG2pOutput(record) {
  const g2p = record?.stageResults?.g2p || null;
  const source = g2p?.gpuResult || g2p;
  if (!source?.stateBuffer || !source?.mechanicsBuffer) return null;
  return source;
}

export function resolveUlgMechanicsResidentStageWorkerRetainedParticleState({
  laneId = null,
  stateKey = null,
  particleCount = null,
  stateStrideFloats = null,
  thermoStrideFloats = null,
  stateByteLength = null,
  thermoByteLength = null,
  sourceStageId = 'g2p'
} = {}) {
  const key = laneKeyForParts({ laneId, stateKey });
  const record = retainedLanes.get(key);
  if (!record) {
    return {
      schema: ULG_MECHANICS_RESIDENT_STAGE_WORKER_RETAINED_PARTICLE_STATE_SCHEMA,
      status: 'worker-retained-particle-state-missing-lane',
      laneId: normalizeString(laneId, null),
      stateKey: normalizeString(stateKey, null),
      sourceStageId,
      retainedWithinWorker: false
    };
  }
  const g2p = retainedG2pOutput(record);
  // W4b: the SS worker lane retains its post-step (or freshly seeded)
  // particle uploads on record.schroederLane; presentation consumers resolve
  // them through the same contract the g2p output uses. The buffers stay
  // worker-retained — this resolver only ever hands them to same-worker
  // consumers (the presentation draw path), never across postMessage.
  const schroederLaneUpload = record.schroederLane?.sphParticleUpload || null;
  const schroederLaneSource =
    sourceStageId === SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID
    && schroederLaneUpload?.stateBuffer
      ? {
          stateBuffer: schroederLaneUpload.stateBuffer,
          thermoBuffer: schroederLaneUpload.thermoBuffer || null,
          identityBuffer: schroederLaneUpload.identityBuffer || null,
          mechanicsBuffer:
            record.schroederLane?.mlsMpmParticleUpload?.mechanicsBuffer || null,
          particleCount:
            record.schroederLane?.particleCount
            ?? schroederLaneUpload.particleCount
            ?? null,
          stateStrideFloats: schroederLaneUpload.stateStrideFloats ?? null,
          thermoStrideFloats: schroederLaneUpload.thermoStrideFloats ?? null,
          stateBufferByteLength: schroederLaneUpload.stateBufferByteLength ?? null,
          thermoBufferByteLength: schroederLaneUpload.thermoBufferByteLength ?? null,
          identityBufferByteLength:
            schroederLaneUpload.identityBufferByteLength ?? null,
          identityStrideBytes: schroederLaneUpload.identityStrideBytes ?? null,
          identityRequired: schroederLaneUpload.identityRequired === true,
          identitySchema: schroederLaneUpload.identitySchema ?? null,
          identityRevision: schroederLaneUpload.identityRevision ?? null,
          renderDomainKeys: schroederLaneUpload.renderDomainKeys || null,
          mechanicsBufferByteLength:
            record.schroederLane?.mlsMpmParticleUpload
              ?.mechanicsBufferByteLength ?? null
        }
      : null;
  const source = sourceStageId === 'g2p' ? g2p : schroederLaneSource;
  const exportSources = sourceStageId === 'g2p'
    && record.compactSnapshotExportSources?.status === 'worker-retained-compact-snapshot-export-sources-ready'
    && record.compactSnapshotExportSources?.exportOwnedSourceReady === true
    ? record.compactSnapshotExportSources
    : null;
  const thermoBuffer = record.retainedThermoBuffer || source?.thermoBuffer || null;
  const canonicalSchroederSource =
    sourceStageId === SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID;
  const resolvedParticleCount = Math.max(0, Math.floor(Number(
    canonicalSchroederSource
      ? source?.particleCount
      : (particleCount ?? source?.particleCount)
  ) || 0));
  const resolvedStateStrideFloats = Math.max(1, Math.floor(Number(
    canonicalSchroederSource
      ? (source?.stateStrideFloats
        ?? (Number(record.schroederLane?.sphParticleUpload?.stateStrideBytes) / 4))
      : (stateStrideFloats ?? source?.stateStrideFloats)
  ) || 8));
  const resolvedThermoStrideFloats = Math.max(12, Math.floor(Number(
    canonicalSchroederSource
      ? (source?.thermoStrideFloats
        ?? (Number(record.schroederLane?.sphParticleUpload?.thermoStrideBytes) / 4))
      : (thermoStrideFloats ?? source?.thermoStrideFloats)
  ) || 12));
  const resolvedStateByteLength = canonicalSchroederSource
    ? positiveByteLength(
        source?.stateBufferByteLength,
        source?.stateBuffer?.size,
        resolvedParticleCount * resolvedStateStrideFloats
          * Float32Array.BYTES_PER_ELEMENT
      )
    : positiveByteLength(
        stateByteLength,
        source?.stateBufferByteLength,
        resolvedParticleCount * resolvedStateStrideFloats
          * Float32Array.BYTES_PER_ELEMENT
      );
  const resolvedThermoByteLength = canonicalSchroederSource
    ? positiveByteLength(
        record.retainedThermoBufferByteLength,
        source?.thermoBufferByteLength,
        thermoBuffer?.size,
        resolvedParticleCount * resolvedThermoStrideFloats
          * Float32Array.BYTES_PER_ELEMENT
      )
    : positiveByteLength(
        thermoByteLength,
        record.retainedThermoBufferByteLength,
        source?.thermoBufferByteLength,
        resolvedParticleCount * resolvedThermoStrideFloats
          * Float32Array.BYTES_PER_ELEMENT
      );
  if (!source?.stateBuffer || !thermoBuffer || resolvedParticleCount <= 0) {
    return {
      schema: ULG_MECHANICS_RESIDENT_STAGE_WORKER_RETAINED_PARTICLE_STATE_SCHEMA,
      status: 'worker-retained-particle-state-missing-buffer',
      laneId: normalizeString(laneId, null),
      stateKey: normalizeString(stateKey, null),
      sourceStageId,
      retainedWithinWorker: false,
      particleCount: resolvedParticleCount,
      stateBufferRetained: Boolean(source?.stateBuffer),
      thermoBufferRetained: Boolean(thermoBuffer),
      mechanicsBufferRetained: Boolean(source?.mechanicsBuffer),
      retainedThermoBufferSourceStage: record.retainedThermoBufferSourceStage || null
    };
  }
  return {
    schema: ULG_MECHANICS_RESIDENT_STAGE_WORKER_RETAINED_PARTICLE_STATE_SCHEMA,
    status: 'worker-retained-particle-state-ready',
    laneId: normalizeString(laneId, null),
    stateKey: normalizeString(stateKey, null),
    sourceStageId,
    retainedWithinWorker: true,
    sourceStateBuffer: exportSources?.stateBuffer || source.stateBuffer,
    sourceThermoBuffer: thermoBuffer,
    sourceMechanicsBuffer: exportSources?.mechanicsBuffer || source.mechanicsBuffer || null,
    sourceIdentityBuffer: source.identityBuffer || null,
    particleCount: resolvedParticleCount,
    stateStrideFloats: resolvedStateStrideFloats,
    thermoStrideFloats: resolvedThermoStrideFloats,
    stateBufferByteLength: exportSources?.stateBufferByteLength || resolvedStateByteLength,
    thermoBufferByteLength: resolvedThermoByteLength,
    mechanicsBufferByteLength:
      exportSources?.mechanicsBufferByteLength
      || positiveByteLength(
        source.mechanicsBufferByteLength,
        source.mechanicsBuffer?.size,
        resolvedParticleCount * 32 * Float32Array.BYTES_PER_ELEMENT
      ),
    identityBufferByteLength: positiveByteLength(
      source.identityBufferByteLength,
      source.identityBuffer?.size,
      resolvedParticleCount * SPH_GPU_PARTICLE_IDENTITY_UINTS
        * Uint32Array.BYTES_PER_ELEMENT
    ),
    identityRequired: source.identityRequired === true,
    identitySchema: source.identitySchema ?? null,
    identityStrideBytes: source.identityStrideBytes ?? null,
    identityRevision: source.identityRevision ?? null,
    renderDomainKeys: source.renderDomainKeys
      ? { ...source.renderDomainKeys }
      : null,
    retainedThermoBufferSourceStage: record.retainedThermoBufferSourceStage || null,
    retainedThermoBufferSeededFromCpu: record.retainedThermoBufferSeededFromCpu === true,
    retainedThermoBufferCopySrc: record.retainedThermoBufferCopySrc === true,
    compactSnapshotExportSources: compactSnapshotExportSourcesSummary(exportSources),
    compactSnapshotExportSourceStatus: exportSources?.status || null,
    compactSnapshotExportOwnedSources: Boolean(exportSources)
  };
}

function blockedRetainedCompactSnapshotExport({
  reason,
  laneId = null,
  stateKey = null,
  sourceStageId = 'g2p',
  retained = null,
  error = null
} = {}) {
  return {
    schema: ULG_MECHANICS_RESIDENT_STAGE_WORKER_RETAINED_COMPACT_SNAPSHOT_EXPORT_SCHEMA,
    status: 'worker-retained-compact-snapshot-export-blocked',
    reason,
    laneId: normalizeString(laneId, null),
    stateKey: normalizeString(stateKey, null),
    sourceStageId,
    retainedParticleStateStatus: retained?.status || null,
    particleCount: retained?.particleCount ?? null,
    stateBufferRetained: Boolean(retained?.sourceStateBuffer),
    thermoBufferRetained: Boolean(retained?.sourceThermoBuffer),
    mechanicsBufferRetained: Boolean(retained?.sourceMechanicsBuffer),
    retainedThermoBufferCopySrc: retained?.retainedThermoBufferCopySrc ?? null,
    retainedThermoBufferSeededFromCpu: retained?.retainedThermoBufferSeededFromCpu ?? null,
    compactBufferSnapshot: null,
    portableSnapshotAvailable: false,
    crossPeerReplayReady: false,
    errorName: error instanceof Error ? error.name : null,
    errorMessage: error instanceof Error ? error.message : (error ? String(error) : null)
  };
}

export async function exportUlgMechanicsResidentStageWorkerRetainedCompactSnapshot({
  device = null,
  laneId = null,
  stateKey = null,
  cacheKey = null,
  sourceStageId = 'g2p',
  particleCount = null,
  stateStrideFloats = null,
  thermoStrideFloats = null,
  mechanicsStrideFloats = null,
  step = null,
  time = null,
  dimension = 3,
  smoothingLengthM = 0,
  phaseCarrierPlan = undefined
} = {}) {
  const retained = resolveUlgMechanicsResidentStageWorkerRetainedParticleState({
    laneId,
    stateKey,
    particleCount,
    stateStrideFloats,
    thermoStrideFloats,
    sourceStageId
  });
  if (retained.status !== 'worker-retained-particle-state-ready') {
    return blockedRetainedCompactSnapshotExport({
      reason: retained.status || 'worker-retained-particle-state-required',
      laneId,
      stateKey,
      sourceStageId,
      retained
    });
  }
  if (!device?.createBuffer || !device?.createCommandEncoder || typeof device?.queue?.submit !== 'function') {
    return blockedRetainedCompactSnapshotExport({
      reason: 'worker-retained-compact-snapshot-export-requires-webgpu-device',
      laneId,
      stateKey,
      sourceStageId,
      retained
    });
  }
  if (!retained.sourceMechanicsBuffer) {
    return blockedRetainedCompactSnapshotExport({
      reason: 'worker-retained-compact-snapshot-mechanics-buffer-required',
      laneId,
      stateKey,
      sourceStageId,
      retained
    });
  }
  const resolvedParticleCount = Math.max(0, Math.floor(Number(retained.particleCount) || 0));
  const resolvedStateStrideFloats = Math.max(1, Math.floor(Number(
    stateStrideFloats ?? retained.stateStrideFloats ?? SPH_GPU_PARTICLE_STATE_FLOATS
  ) || SPH_GPU_PARTICLE_STATE_FLOATS));
  const resolvedThermoStrideFloats = Math.max(1, Math.floor(Number(
    thermoStrideFloats ?? retained.thermoStrideFloats ?? SPH_GPU_PARTICLE_THERMO_FLOATS
  ) || SPH_GPU_PARTICLE_THERMO_FLOATS));
  const resolvedMechanicsStrideFloats = Math.max(1, Math.floor(Number(
    mechanicsStrideFloats ?? MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
  ) || MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS));
  if (
    resolvedStateStrideFloats !== SPH_GPU_PARTICLE_STATE_FLOATS
    || resolvedThermoStrideFloats !== SPH_GPU_PARTICLE_THERMO_FLOATS
    || resolvedMechanicsStrideFloats !== MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
  ) {
    return blockedRetainedCompactSnapshotExport({
      reason: 'worker-retained-compact-snapshot-stride-mismatch',
      laneId,
      stateKey,
      sourceStageId,
      retained
    });
  }
  const expectedStateFloats = resolvedParticleCount * SPH_GPU_PARTICLE_STATE_FLOATS;
  const expectedThermoFloats = resolvedParticleCount * SPH_GPU_PARTICLE_THERMO_FLOATS;
  const expectedMechanicsFloats = resolvedParticleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
  const key = laneKeyForParts({ laneId, stateKey });
  const record = retainedLanes.get(key);
  const schroederLane = record?.schroederLane || null;
  const retainedSphUpload = schroederLane?.sphParticleUpload || null;
  const retainedMlsMpmUpload = schroederLane?.mlsMpmParticleUpload || null;
  let resolvedPhaseCarrierPlan = null;
  try {
    resolvedPhaseCarrierPlan = phaseCarrierPlan !== undefined
      ? clonePhaseCarrierPlanForParticleCount(
          phaseCarrierPlan,
          resolvedParticleCount,
          'worker retained compact snapshot phaseCarrierPlan'
        )
      : resolveWorkerPhaseCarrierPlan({
          data: {
            sphParticleUpload: retainedSphUpload,
            mlsMpmParticleUpload: retainedMlsMpmUpload
          },
          seed: {
            phaseCarrierPlan:
              record?.phaseCarrierPlan
              || record?.adoptedStorageRematerialization?.phaseCarrierPlan
              || null
          },
          particleCount: resolvedParticleCount
        });
  } catch (error) {
    return blockedRetainedCompactSnapshotExport({
      reason: 'worker-retained-compact-snapshot-phase-carrier-plan-particle-count-mismatch',
      laneId,
      stateKey,
      sourceStageId,
      retained,
      error
    });
  }
  const identityRequired = retained.identityRequired === true;
  const expectedIdentityUints =
    resolvedParticleCount * SPH_GPU_PARTICLE_IDENTITY_UINTS;
  const expectedIdentityByteLength =
    expectedIdentityUints * Uint32Array.BYTES_PER_ELEMENT;
  if (
    identityRequired
    && (
      retained.identitySchema !== ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
      || retained.identityStrideBytes
        !== SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT
      || retained.identityBufferByteLength !== expectedIdentityByteLength
      || !normalizeString(retained.identityRevision, null)
      || !retained.sourceIdentityBuffer
    )
  ) {
    return blockedRetainedCompactSnapshotExport({
      reason:
        'worker-retained-compact-snapshot-explicit-identity-source-required',
      laneId,
      stateKey,
      sourceStageId,
      retained
    });
  }
  try {
    const sphState = await readWorkerGpuBufferFloat32({
      device,
      sourceBuffer: retained.sourceStateBuffer,
      byteLength: expectedStateFloats * Float32Array.BYTES_PER_ELEMENT,
      floatLength: expectedStateFloats,
      label: 'sph-state'
    });
    const mlsMpmMechanics = await readWorkerGpuBufferFloat32({
      device,
      sourceBuffer: retained.sourceMechanicsBuffer,
      byteLength: expectedMechanicsFloats * Float32Array.BYTES_PER_ELEMENT,
      floatLength: expectedMechanicsFloats,
      label: 'mls-mpm-mechanics'
    });
    const sphIdentity = retained.sourceIdentityBuffer
      ? await readWorkerGpuBufferUint32({
          device,
          sourceBuffer: retained.sourceIdentityBuffer,
          byteLength: retained.identityBufferByteLength,
          uintLength: expectedIdentityUints,
          label: 'sph-identity'
        })
      : null;
    let sphThermo = cloneFloat32Rows(record?.retainedThermoSnapshotRows, expectedThermoFloats);
    let thermoSource = sphThermo ? 'worker-retained-thermo-cpu-shadow' : null;
    if (!sphThermo && record?.retainedThermoBufferCopySrc === true) {
      sphThermo = await readWorkerGpuBufferFloat32({
        device,
        sourceBuffer: retained.sourceThermoBuffer,
        byteLength: expectedThermoFloats * Float32Array.BYTES_PER_ELEMENT,
        floatLength: expectedThermoFloats,
        label: 'sph-thermo'
      });
      thermoSource = 'worker-retained-thermo-gpu-readback';
    }
    if (!sphThermo) {
      return blockedRetainedCompactSnapshotExport({
        reason: 'worker-retained-compact-snapshot-thermo-source-unavailable',
        laneId,
        stateKey,
        sourceStageId,
        retained
      });
    }
    const retainedSphState = schroederLane?.sphParticleState || null;
    const retainedMlsMpmState = schroederLane?.mlsMpmParticleState || null;
    const resolvedStepCandidate =
      retainedSphUpload?.step
      ?? retainedMlsMpmUpload?.step
      ?? retainedSphState?.step
      ?? retainedMlsMpmState?.step
      ?? step;
    const resolvedTimeCandidate =
      retainedSphUpload?.time
      ?? retainedMlsMpmUpload?.time
      ?? retainedSphState?.time
      ?? retainedMlsMpmState?.time
      ?? time;
    const resolvedStep = Number.isFinite(Number(resolvedStepCandidate))
      ? Number(resolvedStepCandidate)
      : null;
    const resolvedTime = Number.isFinite(Number(resolvedTimeCandidate))
      ? Number(resolvedTimeCandidate)
      : null;
    const slotField = (source, fallback, field) => {
      const value = Number(source?.[field] ?? fallback?.[field]);
      return Number.isSafeInteger(value) && value >= 0 ? value : null;
    };
    const sphSlotIdentity = {
      slot: slotField(retainedSphUpload, retainedSphState, 'slot'),
      sourceSlot: slotField(retainedSphUpload, retainedSphState, 'sourceSlot'),
      nextSlot: slotField(retainedSphUpload, retainedSphState, 'nextSlot')
    };
    const mechanicsSlotIdentity = {
      slot: slotField(retainedMlsMpmUpload, retainedMlsMpmState, 'slot'),
      sourceSlot: slotField(
        retainedMlsMpmUpload,
        retainedMlsMpmState,
        'sourceSlot'
      ),
      nextSlot: slotField(retainedMlsMpmUpload, retainedMlsMpmState, 'nextSlot')
    };
    const sharedSlotIdentityVerified = ['slot', 'sourceSlot', 'nextSlot']
      .every((field) => (
        sphSlotIdentity[field] != null
        && sphSlotIdentity[field] === mechanicsSlotIdentity[field]
      ));
    const topologyEpochCandidate = Number(
      retainedSphUpload?.topologyEpoch ?? retainedSphState?.topologyEpoch
    );
    const topologyEpoch = Number.isSafeInteger(topologyEpochCandidate)
      && topologyEpochCandidate >= 0
      ? topologyEpochCandidate
      : null;
    const identityRevision = normalizeString(
      retainedSphUpload?.identityRevision ?? retainedSphState?.identityRevision,
      null
    );
    const phaseCarrierMetadataReady = Boolean(resolvedPhaseCarrierPlan);
    const workerLineageMetadata = {
      schema:
        'peercompute.ulg.worker-retained-compact-snapshot-lineage-metadata.v0',
      status: sharedSlotIdentityVerified
        && phaseCarrierMetadataReady
        && topologyEpoch != null
        && identityRevision
        && (!identityRequired || Boolean(sphIdentity))
        ? 'worker-retained-compact-snapshot-lineage-metadata-ready'
        : 'worker-retained-compact-snapshot-lineage-metadata-incomplete',
      sharedSlotIdentityVerified,
      sphSlotIdentity,
      mechanicsSlotIdentity,
      phaseCarrierMetadataReady,
      topologyEpoch,
      identityRevision,
      identityRequired,
      identitySchema: retained.identitySchema ?? null,
      identityRowsReady: Boolean(sphIdentity)
    };
    const compactBufferSnapshot = {
      schema: ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA,
      status: 'compact-buffer-snapshot-exported-from-worker-retained-state',
      cacheKey: normalizeString(cacheKey, null),
      stateKey: normalizeString(stateKey, null),
      laneId: normalizeString(laneId, null),
      sourceStageId,
      particleCount: resolvedParticleCount,
      step: resolvedStep,
      time: resolvedTime,
      dimension: Number.isFinite(Number(dimension)) ? Number(dimension) : 3,
      smoothingLengthM: Number.isFinite(Number(smoothingLengthM)) ? Number(smoothingLengthM) : 0,
      phaseCarrierPlan: resolvedPhaseCarrierPlan,
      sphPhaseCarrierPlan: resolvedPhaseCarrierPlan
        ? { ...resolvedPhaseCarrierPlan }
        : null,
      mechanicsPhaseCarrierPlan: resolvedPhaseCarrierPlan
        ? { ...resolvedPhaseCarrierPlan }
        : null,
      slot: sharedSlotIdentityVerified ? sphSlotIdentity.slot : null,
      sourceSlot: sharedSlotIdentityVerified
        ? sphSlotIdentity.sourceSlot
        : null,
      nextSlot: sharedSlotIdentityVerified ? sphSlotIdentity.nextSlot : null,
      sphSlotIdentity,
      mechanicsSlotIdentity,
      sharedSlotIdentityVerified,
      topologyEpoch,
      identityRevision,
      identityRequired,
      identitySchema:
        retained.identitySchema ?? ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
      identityStrideUints: SPH_GPU_PARTICLE_IDENTITY_UINTS,
      identityStrideBytes:
        SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
      sphIdentityByteLength: sphIdentity?.byteLength || 0,
      renderDomainKeys: retained.renderDomainKeys
        ? { ...retained.renderDomainKeys }
        : {},
      workerLineageMetadata,
      sphState,
      sphThermo,
      ...(sphIdentity ? { sphIdentity } : {}),
      mlsMpmMechanics
    };
    const byteLength = sphState.byteLength
      + sphThermo.byteLength
      + (sphIdentity?.byteLength || 0)
      + mlsMpmMechanics.byteLength;
    return {
      schema: ULG_MECHANICS_RESIDENT_STAGE_WORKER_RETAINED_COMPACT_SNAPSHOT_EXPORT_SCHEMA,
      status: 'worker-retained-compact-snapshot-exported',
      laneId: normalizeString(laneId, null),
      stateKey: normalizeString(stateKey, null),
      cacheKey: normalizeString(cacheKey, null),
      sourceStageId,
      particleCount: resolvedParticleCount,
      compactBufferSnapshot,
      compactBufferSnapshotSchema: compactBufferSnapshot.schema,
      portableSnapshotAvailable: true,
      crossPeerReplayReady: true,
      readbackByteLength: byteLength,
      sphStateByteLength: sphState.byteLength,
      sphThermoByteLength: sphThermo.byteLength,
      sphIdentityByteLength: sphIdentity?.byteLength || 0,
      mlsMpmMechanicsByteLength: mlsMpmMechanics.byteLength,
      phaseCarrierPlan: resolvedPhaseCarrierPlan ? { ...resolvedPhaseCarrierPlan } : null,
      workerLineageMetadata,
      thermoSource,
      retainedThermoBufferCopySrc: record?.retainedThermoBufferCopySrc === true,
      retainedThermoBufferSeededFromCpu: record?.retainedThermoBufferSeededFromCpu === true
    };
  } catch (error) {
    return blockedRetainedCompactSnapshotExport({
      reason: 'worker-retained-compact-snapshot-readback-failed',
      laneId,
      stateKey,
      sourceStageId,
      retained,
      error
    });
  }
}

function retainedThermalOutput(record) {
  const thermal = record?.stageResults?.thermalPhase || null;
  const source = thermal?.gpuResult || thermal;
  if (!source?.stateBuffer && !source?.thermoBuffer) return null;
  return source;
}

function gasCellEosProducerGasCellField(record) {
  const result = record?.stageResults?.gasCellEosProducer || null;
  return result?.gasCellFieldSnapshot
    || result?.gasCellField
    || result?.pressureFeedback?.gasCellField
    || null;
}

function workerCpuSeededGasPressureAuthority(record) {
  const result = record?.stageResults?.gasCellEosProducer || null;
  if (!result || typeof result !== 'object') return null;
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(
      result,
      'cpuSeededGasPressureAuthority'
    );
  } catch {
    return null;
  }
  return descriptor && Object.hasOwn(descriptor, 'value')
    ? descriptor.value
    : null;
}

function retainedGasCellEosProducerSource(record) {
  const result = record?.stageResults?.gasCellEosProducer || null;
  const source = result?.retainedGasCellFieldSource || null;
  const exactIdentity = isExactSphSpatialGasPressureAuthoritySource(source);
  if (exactIdentity) {
    let sourceGraph;
    try {
      sourceGraph = exactGasPressureTransportGraphRecords(result);
    } catch {
      return null;
    }
    if (
      exactGasPressureTransportProtectedSchemaIssue(sourceGraph)
      || exactGasPressureTransportRawAliasIssue(sourceGraph)
    ) return null;
    const exactSources = exactGasPressureTransportExactSources(sourceGraph);
    if (exactSources.length !== 1 || exactSources[0] !== source) return null;
    let rowCapacity;
    let rowStrideFloats;
    let rowByteLength;
    let resultReady;
    let sourceReady;
    let deviceId;
    let computeTaskId;
    let pressureFieldMode;
    let pressureFieldResolution;
    try {
      const valueFor = (candidate, key) => (
        exactGasPressureTransportOwnDataProperty(
          sourceGraph,
          candidate,
          key
        ).value
      );
      rowCapacity = firstPositiveInteger([
        valueFor(result, 'pressureInterfaceGasPressureCellRowCapacity'),
        valueFor(result, 'gasPressureCellRowCapacity'),
        valueFor(source, 'pressureInterfaceGasPressureCellRowCapacity'),
        valueFor(source, 'gasPressureCellRowCapacity')
      ]);
      rowStrideFloats = firstPositiveInteger([
        valueFor(result, 'pressureInterfaceGasPressureCellRowStrideFloats'),
        valueFor(source, 'pressureInterfaceGasPressureCellRowStrideFloats')
      ]);
      rowByteLength = firstPositiveInteger([
        valueFor(result, 'pressureInterfaceGasPressureCellRowByteLength'),
        valueFor(source, 'pressureInterfaceGasPressureCellRowByteLength')
      ], rowCapacity * rowStrideFloats * Float32Array.BYTES_PER_ELEMENT);
      resultReady = valueFor(result, 'retainedGasCellFieldSourceReady');
      sourceReady = valueFor(source, 'ready');
      deviceId = valueFor(source, 'deviceId')
        || valueFor(result, 'deviceId')
        || null;
      computeTaskId = valueFor(result, 'computeTaskId') || null;
      pressureFieldMode = valueFor(source, 'pressureFieldMode') || null;
      pressureFieldResolution =
        valueFor(source, 'pressureFieldResolution') || null;
    } catch {
      return null;
    }
    const description = describeSphSpatialGasPressureAuthority(source);
    if (
      resultReady !== true
      || sourceReady !== true
      || !description
      || description.releaseScheduledObserved === true
      || description.releasedObserved === true
      || description.terminalObserved === true
      || description.consumerBorrowedObserved === true
      || description.consumerSubmittedObserved === true
      || rowCapacity <= 0
      || rowStrideFloats !== 12
    ) return null;
    return {
      result,
      source,
      description,
      rowCount: 0,
      rowCapacity,
      rowStrideFloats,
      rowByteLength,
      deviceId,
      computeTaskId,
      pressureFieldMode,
      pressureFieldResolution,
      exactV4: true
    };
  }
  const rowStrideFloats = firstPositiveInteger([
    result?.pressureInterfaceGasPressureCellRowStrideFloats,
    source?.pressureInterfaceGasPressureCellRowStrideFloats
  ]);
  const buffer = result?.gasPressureCellsBuffer
    || result?.retainedGasPressureCellsBuffer
    || source?.gasPressureCellsBuffer
    || source?.retainedGasPressureCellsBuffer
    || source?.pressureInterfaceGasPressureCellsBuffer
    || null;
  const rowCount = firstPositiveInteger([
    result?.pressureInterfaceGasPressureCellRowCount,
    source?.pressureInterfaceGasPressureCellRowCount
  ]);
  if (
    result?.retainedGasCellFieldSourceReady !== true
    || source?.schema !== 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1'
    || source?.ready !== true
    || source?.localPressureGradientReady !== true
    || !buffer
    || rowCount <= 0
    || rowStrideFloats !== 12
  ) return null;
  return {
    result,
    source,
    buffer,
    controlBuffer: null,
    rowCount,
    rowCapacity: rowCount,
    rowStrideFloats,
    exactV4: false
  };
}

function retainedGasCellEosProducerPressureImport(record) {
  const retained = retainedGasCellEosProducerSource(record);
  if (!retained) return null;
  const {
    result,
    source,
    rowCount,
    rowCapacity,
    rowStrideFloats,
    rowByteLength: retainedRowByteLength,
    deviceId,
    computeTaskId,
    pressureFieldMode,
    pressureFieldResolution,
    exactV4
  } = retained;
  const rowByteLength = exactV4
    ? retainedRowByteLength
    : firstPositiveInteger([
        result.pressureInterfaceGasPressureCellRowByteLength,
        source.pressureInterfaceGasPressureCellRowByteLength
      ], rowCapacity * rowStrideFloats * Float32Array.BYTES_PER_ELEMENT);
  const sourceKey = `ulg-worker:${record.key}:gasCellEosProducer:retained-gas-pressure`;
  if (exactV4) {
    const admission = {
      schema: 'peercompute.ulg.pressure-interface-gas-cell-field-admission.v0',
      status: 'pressure-interface-gas-cell-field-consumption-approved',
      gasCellFieldConsumptionApproved: true,
      sourceHotBufferKey: sourceKey,
      sourceTaskId: computeTaskId,
      sourceStage: 'gasCellEosProducer',
      retainedGasCellFieldSource: source,
      pressureInterfaceGasPressureCellRowCount: 0,
      pressureInterfaceGasPressureCellRowCapacity: rowCapacity,
      gasPressureCellLogicalCountGpuAuthored: true,
      pressureInterfaceGasPressureCellRowStrideFloats: rowStrideFloats,
      pressureInterfaceGasPressureCellRowByteLength: rowByteLength,
      pressureFieldMode,
      pressureFieldResolution,
      gasPressureAuthorityTransport: 'same-worker-exact-opaque-v4',
      stateManagerAdmitted: true,
      authoritativeStateMutation: false
    };
    return {
      schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import.v0',
      status: 'pressure-interface-gas-cell-field-import-ready',
      sourceHotBufferKey: sourceKey,
      sourceTaskId: computeTaskId,
      sourceStage: 'gasCellEosProducer',
      sameDevice: true,
      deviceId,
      retainedGasCellFieldSource: source,
      pressureInterfaceGasPressureCellRowCount: 0,
      pressureInterfaceGasPressureCellRowCapacity: rowCapacity,
      gasPressureCellLogicalCountGpuAuthored: true,
      pressureInterfaceGasPressureCellRowStrideFloats: rowStrideFloats,
      pressureInterfaceGasPressureCellRowByteLength: rowByteLength,
      pressureInterfaceGasPressureCellRowsBufferRetained: true,
      gasPressureAuthorityTransport: 'same-worker-exact-opaque-v4',
      pressureInterfaceGasCellFieldAdmission: admission,
      authoritativeStateMutation: false
    };
  }
  const buffer = retained.buffer;
  const retainedRefs = uniqueStringList([
    ...(result.retainedGasPressureBufferRefs || []),
    ...(source.retainedGasPressureBufferRefs || []),
    'resident-gas-pressure-cells-buffer'
  ]);
  const workerRefs = uniqueStringList([
    ...(result.workerRetainedGasPressureBufferRefs || []),
    ...(source.workerRetainedGasPressureBufferRefs || [])
  ]);
  const admission = {
    schema: 'peercompute.ulg.pressure-interface-gas-cell-field-admission.v0',
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    sourceHotBufferKey: sourceKey,
    sourceTaskId: result.computeTaskId || null,
    sourceStage: 'gasCellEosProducer',
    retainedGasPressureBufferRefs: retainedRefs,
    workerRetainedGasPressureBufferRefs: workerRefs,
    retainedGasCellFieldSource: source,
    pressureInterfaceGasPressureCellRowCount: rowCount,
    pressureInterfaceGasPressureCellRowCapacity: rowCapacity,
    gasPressureCellLogicalCountGpuAuthored: false,
    pressureInterfaceGasPressureCellRowStrideFloats: rowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: rowByteLength,
    pressureFieldMode: source.pressureFieldMode || null,
    pressureFieldResolution: source.pressureFieldResolution || null,
    stateManagerAdmitted: true,
    authoritativeStateMutation: false
  };
  return {
    schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import.v0',
    status: 'pressure-interface-gas-cell-field-import-ready',
    sourceHotBufferKey: sourceKey,
    sourceTaskId: result.computeTaskId || null,
    sourceStage: 'gasCellEosProducer',
    sameDevice: true,
    deviceId: source.deviceId || result.deviceId || null,
    gasPressureCellsBuffer: buffer,
    retainedGasPressureCellsBuffer: buffer,
    pressureInterfaceGasPressureCellsBuffer: buffer,
    pressureInterfaceGasPressureCellRowCount: rowCount,
    pressureInterfaceGasPressureCellRowCapacity: rowCapacity,
    gasPressureCellLogicalCountGpuAuthored: false,
    pressureInterfaceGasPressureCellRowStrideFloats: rowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: rowByteLength,
    pressureInterfaceGasPressureCellRowsBufferRetained: true,
    retainedGasPressureBufferRefs: retainedRefs,
    workerRetainedGasPressureBufferRefs: workerRefs,
    retainedGasCellFieldSource: source,
    pressureInterfaceGasCellFieldAdmission: admission,
    releaseAfterFinalConsumerQueue:
      result.releaseAfterFinalConsumerQueue
      || source.releaseAfterFinalConsumerQueue
      || null,
    authoritativeStateMutation: false
  };
}

function pressureSummaryWithGasCellEosProducer(record, pressureSummary = null) {
  const gasCellField = gasCellEosProducerGasCellField(record);
  if (!gasCellField?.localPressureGradientReady) return pressureSummary;
  const base = pressureSummary && typeof pressureSummary === 'object'
    ? pressureSummary
    : {
        schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
        status: 'worker-gas-cell-eos-producer-pressure-summary-local',
        source: 'worker-gas-cell-eos-producer-stage'
      };
  return {
    ...base,
    gasCellField,
    pressureFeedback: base.pressureFeedback && typeof base.pressureFeedback === 'object'
      ? {
          ...base.pressureFeedback,
          gasCellField
        }
      : base.pressureFeedback
  };
}

function pressureFeedbackWithGasCellEosProducer(record, pressureFeedback = null) {
  const gasCellField = gasCellEosProducerGasCellField(record);
  if (!gasCellField?.localPressureGradientReady) return pressureFeedback;
  if (!pressureFeedback || typeof pressureFeedback !== 'object') return null;
  return {
    ...pressureFeedback,
    schema: pressureFeedback.schema || 'peercompute.ulg.sph-gas-pressure-feedback.v0',
    status: pressureFeedback.status || 'worker-gas-cell-eos-producer-pressure-feedback-local',
    gasCellField
  };
}

function gasCellEosProducerRetainedGasPressureBuffer(record) {
  const result = record?.stageResults?.gasCellEosProducer || null;
  return result?.gasPressureCellsBuffer || result?.pressureInterfaceGasPressureCellsBuffer || null;
}

function pressureInterfaceRetainedGasPressureBuffer(record) {
  const result = record?.stageResults?.pressureInterface || null;
  return result?.pressureInterfaceGasCellFieldImport?.retainedGasPressureCellsBuffer
    || result?.pressureInterfaceGasCellFieldImport?.gasPressureCellsBuffer
    || result?.pressureInterfaceGasCellFieldImport?.pressureInterfaceGasPressureCellsBuffer
    || result?.gasPressureCellsBuffer
    || result?.pressureInterfaceGasPressureCellsBuffer
    || result?.pressureInterfaceForceSolver?.gasPressureCellsBuffer
    || null;
}

function resolveRetainedGasPressureBufferFromWorkerRefs(record, refs = []) {
  for (const ref of uniqueStringList(refs).filter(isGasPressureBufferRef)) {
    const buffer = record?.retainedBuffers?.get?.(ref);
    if (buffer) return { ref, buffer, source: 'worker-retained-buffer-ref' };
  }
  return null;
}

function resolveRetainedGasPressureBufferFromGenericRefs(record, refs = []) {
  if (!uniqueStringList(refs).some(isGasPressureBufferRef)) return null;
  const gasCellEosBuffer = gasCellEosProducerRetainedGasPressureBuffer(record);
  if (gasCellEosBuffer) {
    return {
      ref: 'resident-gas-pressure-cells-buffer',
      buffer: gasCellEosBuffer,
      source: 'worker-retained-gas-cell-eos-output'
    };
  }
  const pressureInterfaceBuffer = pressureInterfaceRetainedGasPressureBuffer(record);
  if (pressureInterfaceBuffer) {
    return {
      ref: 'resident-gas-pressure-cells-buffer',
      buffer: pressureInterfaceBuffer,
      source: 'worker-retained-pressure-interface-import'
    };
  }
  return null;
}

function previousWorkerResidentProductMass(record) {
  const reactionResult = record?.stageResults?.reactionProduct || null;
  const candidate = reactionResult?.residentProductMass
    || reactionResult?.reactionSummary?.residentProductMass
    || null;
  if (
    !candidate
    || candidate.productEventBufferRetained !== true
    || firstPositiveInteger([candidate.productEventRowCount]) <= 0
  ) return null;
  const bufferCandidate = candidate.productEventBuffer || null;
  const bufferRef = bufferCandidate?.schema === 'peercompute.ulg.worker-retained-buffer-ref.v0'
    ? bufferCandidate.ref
    : null;
  const buffer = bufferRef
    ? record?.retainedBuffers?.get?.(bufferRef) || null
    : bufferCandidate;
  if (!buffer) return null;
  return buffer === bufferCandidate
    ? candidate
    : { ...candidate, productEventBuffer: buffer };
}

function quarantineWorkerRetainedGasCellFieldImport(data) {
  data.pressureInterfaceGasCellFieldImport = null;
  data.gasCellFieldImport = null;
  data.pressureInterfaceGasCellFieldAdmission = null;
}

function applyWorkerRetainedGasCellFieldImport({ stageId, data, record }) {
  if (stageId !== 'pressureInterface') return null;
  const importValue = data?.pressureInterfaceGasCellFieldImport || data?.gasCellFieldImport || null;
  if (!importValue || typeof importValue !== 'object') return null;
  const cachedCapture = exactGasPressureTransportGraphByStageData.get(data);
  const graphCapture = cachedCapture?.root === importValue
    ? cachedCapture
    : exactGasPressureTransportGraphCapture(importValue);
  const importGraph = graphCapture.graph;
  if (graphCapture.error || !importGraph) {
    const error = graphCapture.error;
    quarantineWorkerRetainedGasCellFieldImport(data);
    return {
      status: 'blocked-gas-pressure-authority-wrapper-accessor',
      applied: false,
      requested: true,
      graphRejected: true,
      errorCode: error?.code || null
    };
  }
  const protectedSchemaIssue =
    exactGasPressureTransportProtectedSchemaIssue(importGraph);
  if (protectedSchemaIssue) {
    quarantineWorkerRetainedGasCellFieldImport(data);
    const status = protectedSchemaIssue.kind === 'accessor'
      ? 'blocked-gas-pressure-authority-schema-accessor'
      : (protectedSchemaIssue.kind === 'inspection'
          ? 'blocked-gas-pressure-authority-schema-inspection'
          : (protectedSchemaIssue.kind === 'exact-schema-mismatch'
              ? 'blocked-exact-gas-pressure-authority-schema-mismatch'
              : (protectedSchemaIssue.kind === 'forged-current-schema'
                  ? 'blocked-forged-exact-v4-gas-pressure-authority-schema'
                  : 'blocked-retired-gas-pressure-authority-schema')));
    return {
      status,
      applied: false,
      requested: true,
      schemaRejected: true,
      schemaIssue: protectedSchemaIssue.kind,
      sourceSchema: protectedSchemaIssue.schema || null,
      errorCode: protectedSchemaIssue.error?.code || null
    };
  }
  const exactSources = exactGasPressureTransportExactSources(importGraph);
  if (exactSources.length > 1) {
    quarantineWorkerRetainedGasCellFieldImport(data);
    return {
      status: 'blocked-ambiguous-exact-v4-gas-pressure-authority',
      applied: false,
      requested: true,
      exactAuthorityRejected: true,
      exactAuthorityCount: exactSources.length
    };
  }
  const exactRetainedSource = exactSources[0] || null;
  if (exactRetainedSource) {
    let schemaProperty;
    try {
      schemaProperty = exactGasPressureTransportOwnDataProperty(
        importGraph,
        exactRetainedSource,
        'schema'
      );
    } catch (error) {
      quarantineWorkerRetainedGasCellFieldImport(data);
      return {
        status: 'blocked-exact-gas-pressure-authority-schema-accessor',
        applied: false,
        requested: true,
        schemaRejected: true,
        errorCode: error?.code || null
      };
    }
    if (
      !schemaProperty.present
      || schemaProperty.value !== ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA
    ) {
      quarantineWorkerRetainedGasCellFieldImport(data);
      return {
        status: 'blocked-exact-gas-pressure-authority-schema-mismatch',
        applied: false,
        requested: true,
        schemaRejected: true
      };
    }
    const rawAliasIssue = exactGasPressureTransportRawAliasIssue(importGraph);
    if (rawAliasIssue) {
      quarantineWorkerRetainedGasCellFieldImport(data);
      return {
        status: rawAliasIssue.kind === 'accessor'
          ? 'blocked-exact-v4-gas-pressure-authority-raw-alias-accessor'
          : 'blocked-exact-v4-gas-pressure-authority-raw-alias',
        applied: false,
        requested: true,
        rawAliasRejected: true,
        rawAliasKey: rawAliasIssue.key,
        rawAliasIssue: rawAliasIssue.kind
      };
    }
    const retainedSource = exactRetainedSource;
    const workerDevice = data.deviceResult?.device || data.device || null;
    const description = workerDevice
      ? describeSphSpatialGasPressureAuthority(
          retainedSource,
          { device: workerDevice }
        )
      : null;
    if (!workerDevice || description?.deviceAuthenticated !== true) {
      quarantineWorkerRetainedGasCellFieldImport(data);
      return {
        status: workerDevice
          ? 'blocked-exact-v4-gas-pressure-authority-device-mismatch'
          : 'blocked-exact-v4-gas-pressure-authority-device-unavailable',
        applied: false,
        requested: true,
        deviceRejected: true
      };
    }
    const rowCapacity = firstPositiveInteger([
      description.pressureCellCapacity
    ]);
    const rowStrideFloats = firstPositiveInteger([
      description.pressureCellStrideFloats
    ]);
    let deviceId;
    try {
      const valueFor = (candidate, key) => (
        exactGasPressureTransportOwnDataProperty(
          importGraph,
          candidate,
          key
        ).value
      );
      deviceId = valueFor(retainedSource, 'deviceId') || null;
    } catch (error) {
      quarantineWorkerRetainedGasCellFieldImport(data);
      return {
        status: error?.code === 'ERR_ULG_WORKER_GAS_AUTHORITY_ACCESSOR'
          ? 'blocked-exact-v4-gas-pressure-authority-readiness-accessor'
          : 'blocked-exact-v4-gas-pressure-authority-readiness-inspection',
        applied: false,
        requested: true,
        readinessRejected: true,
        errorCode: error?.code || null
      };
    }
    if (
      !description
      || description.releaseScheduledObserved === true
      || description.releasedObserved === true
      || description.terminalObserved === true
      || description.consumerSubmittedObserved === true
      || description.consumerBorrowedObserved === true
      || rowCapacity <= 0
      || rowStrideFloats !== 12
    ) {
      quarantineWorkerRetainedGasCellFieldImport(data);
      return {
        status: 'blocked-exact-v4-gas-pressure-authority-unavailable',
        applied: false,
        requested: true
      };
    }
    let approvedAdmissions;
    try {
      approvedAdmissions =
        exactGasPressureTransportApprovedAdmissions(importGraph);
    } catch (error) {
      quarantineWorkerRetainedGasCellFieldImport(data);
      return {
        status: error?.code === 'ERR_ULG_WORKER_GAS_AUTHORITY_ACCESSOR'
          ? 'blocked-exact-v4-gas-pressure-authority-admission-accessor'
          : 'blocked-exact-v4-gas-pressure-authority-admission-inspection',
        applied: false,
        requested: true,
        admissionRejected: true,
        errorCode: error?.code || null
      };
    }
    if (approvedAdmissions.length !== 1) {
      quarantineWorkerRetainedGasCellFieldImport(data);
      return {
        status: approvedAdmissions.length === 0
          ? 'blocked-exact-v4-gas-pressure-authority-admission-missing'
          : 'blocked-exact-v4-gas-pressure-authority-admission-ambiguous',
        applied: false,
        requested: true,
        admissionRejected: true,
        approvedAdmissionCount: approvedAdmissions.length
      };
    }
    const [{ admission, retainedSource: admittedSource }] =
      approvedAdmissions;
    if (admittedSource !== retainedSource) {
      quarantineWorkerRetainedGasCellFieldImport(data);
      return {
        status: 'blocked-exact-v4-gas-pressure-authority-admission-identity-mismatch',
        applied: false,
        requested: true,
        admissionRejected: true
      };
    }
    const nextImport = {
      schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import.v0',
      status: 'pressure-interface-gas-cell-field-import-ready',
      sameDevice: true,
      deviceId,
      retainedGasCellFieldSource: retainedSource,
      pressureInterfaceGasPressureCellRowCount: 0,
      pressureInterfaceGasPressureCellRowCapacity: rowCapacity,
      gasPressureCellLogicalCountGpuAuthored: true,
      pressureInterfaceGasPressureCellRowStrideFloats: rowStrideFloats,
      pressureInterfaceGasPressureCellRowByteLength:
        rowCapacity * rowStrideFloats * Float32Array.BYTES_PER_ELEMENT,
      pressureInterfaceGasPressureCellRowsBufferRetained: true,
      gasPressureAuthorityTransport: 'same-worker-exact-opaque-v4',
      pressureInterfaceGasCellFieldAdmission: admission,
      authoritativeStateMutation: false
    };
    data.pressureInterfaceGasCellFieldImport = nextImport;
    data.gasCellFieldImport = nextImport;
    data.pressureInterfaceGasCellFieldAdmission = admission;
    return {
      status: 'applied-worker-retained-gas-cell-field-import',
      applied: true,
      requested: true,
      resolvedSource: 'worker-retained-exact-opaque-v4-authority',
      exactGasPressureAuthority: true,
      pressureInterfaceGasPressureCellRowCount: 0,
      pressureInterfaceGasPressureCellRowCapacity: rowCapacity,
      pressureInterfaceGasPressureCellRowStrideFloats: rowStrideFloats,
      pressureInterfaceGasPressureCellRowByteLength:
        rowCapacity * rowStrideFloats * Float32Array.BYTES_PER_ELEMENT
    };
  }
  const stableImportValue = exactGasPressureTransportMaterializedValue(
    importGraph,
    importValue
  );
  const retainedSource = stableImportValue.retainedGasCellFieldSource
    || stableImportValue.pressureInterfaceGasCellFieldAdmission
      ?.retainedGasCellFieldSource
    || null;
  if (
    stableImportValue.schema === ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA
    || retainedSource?.schema === ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA
    || stableImportValue.telemetryOnly === true
    || retainedSource?.telemetryOnly === true
    || stableImportValue.bindable === false
    || retainedSource?.bindable === false
  ) {
    return {
      status: 'blocked-gas-pressure-authority-telemetry-non-bindable',
      applied: false,
      requested: true,
      telemetryRejected: true
    };
  }
  const existingBufferCandidate = stableImportValue.retainedGasPressureCellsBuffer
    || stableImportValue.gasPressureCellsBuffer
    || stableImportValue.pressureInterfaceGasPressureCellsBuffer
    || stableImportValue.retainedGasCellFieldSource?.gasPressureCellsBuffer
    || stableImportValue.retainedGasCellFieldSource?.retainedGasPressureCellsBuffer
    || stableImportValue.retainedGasCellFieldSource
      ?.pressureInterfaceGasPressureCellsBuffer
    || null;
  const existingBufferRef = existingBufferCandidate?.schema
    === 'peercompute.ulg.worker-retained-buffer-ref.v0'
    ? existingBufferCandidate.ref
    : null;
  const existingBuffer = existingBufferRef
    ? record?.retainedBuffers?.get?.(existingBufferRef) || null
    : existingBufferCandidate;
  if (existingBuffer && !existingBufferRef) {
    return {
      status: 'pressure-interface-gas-cell-import-buffer-already-present',
      applied: false,
      retainedGasPressureCellsBuffer: true
    };
  }
  const workerRefs = workerRetainedGasPressureBufferRefsFrom(
    stableImportValue
  );
  const retainedRefs = retainedGasPressureBufferRefsFrom(stableImportValue);
  const resolved = existingBuffer
    ? { ref: existingBufferRef, buffer: existingBuffer, source: 'worker-retained-buffer-ref-descriptor' }
    : resolveRetainedGasPressureBufferFromWorkerRefs(record, workerRefs)
    || resolveRetainedGasPressureBufferFromGenericRefs(record, retainedRefs)
    || resolveRetainedGasPressureBufferFromGenericRefs(record, workerRefs);
  const rowCount = firstPositiveInteger([
    stableImportValue.pressureInterfaceGasPressureCellRowCount,
    stableImportValue.gasPressureCellRowCount,
    retainedSource?.pressureInterfaceGasPressureCellRowCount
  ]);
  const rowStrideFloats = firstPositiveInteger([
    stableImportValue.pressureInterfaceGasPressureCellRowStrideFloats,
    stableImportValue.gasPressureCellRowStrideFloats,
    retainedSource?.pressureInterfaceGasPressureCellRowStrideFloats
  ], 12);
  const rowByteLength = firstPositiveInteger([
    stableImportValue.pressureInterfaceGasPressureCellRowByteLength,
    stableImportValue.gasPressureCellRowByteLength,
    retainedSource?.pressureInterfaceGasPressureCellRowByteLength
  ], rowCount * rowStrideFloats * Float32Array.BYTES_PER_ELEMENT);
  if (!resolved?.buffer || rowCount <= 0) {
    return {
      status: resolved?.buffer
        ? 'blocked-worker-retained-gas-cell-row-metadata-missing'
        : 'blocked-worker-retained-gas-cell-buffer-missing',
      applied: false,
      requested: true,
      workerRetainedGasPressureBufferRefs: workerRefs,
      retainedGasPressureBufferRefs: retainedRefs,
      pressureInterfaceGasPressureCellRowCount: rowCount,
      pressureInterfaceGasPressureCellRowByteLength: rowByteLength
    };
  }
  const nextImport = {
    ...stableImportValue,
    status: stableImportValue.status
      || 'pressure-interface-gas-cell-field-import-ready',
    retainedGasPressureCellsBuffer: resolved.buffer,
    gasPressureCellsBuffer: resolved.buffer,
    pressureInterfaceGasPressureCellsBuffer: resolved.buffer,
    pressureInterfaceGasPressureCellRowCount: rowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: rowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: rowByteLength,
    pressureInterfaceGasPressureCellRowsBufferRetained: true,
    gasPressureCellRowsBufferRetained: true,
    workerRetainedGasPressureBufferRefs: workerRefs,
    retainedGasPressureBufferRefs: retainedRefs,
    retainedGasCellFieldSource: retainedSource
      ? {
          ...retainedSource,
          pressureInterfaceGasPressureCellRowsBufferRetained: true,
          workerRetainedGasPressureBufferRefs: workerRefs,
          retainedGasPressureBufferRefs: retainedRefs
        }
      : retainedSource
  };
  data.pressureInterfaceGasCellFieldImport = nextImport;
  data.gasCellFieldImport = nextImport;
  data.pressureInterfaceGasCellFieldAdmission =
    nextImport.pressureInterfaceGasCellFieldAdmission
    || nextImport.gasCellFieldAdmission
    || nextImport.admission
    || data.pressureInterfaceGasCellFieldAdmission
    || null;
  return {
    status: 'applied-worker-retained-gas-cell-field-import',
    applied: true,
    requested: true,
    resolvedRef: resolved.ref,
    resolvedSource: resolved.source,
    workerRetainedGasPressureBufferRefs: workerRefs,
    retainedGasPressureBufferRefs: retainedRefs,
    pressureInterfaceGasPressureCellRowCount: rowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: rowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: rowByteLength
  };
}

function stageUsesSphThermo(stageId) {
  return stageId === 'p2g' || stageId === 'g2p' || stageId === 'thermalPhase' || stageId === 'reactionProduct';
}

function ensureWorkerRetainedThermoBuffer({ data, record, workerDeviceResult }) {
  if (record.retainedThermoBuffer) {
    return {
      status: 'worker-retained-thermo-ready',
      thermoBuffer: record.retainedThermoBuffer,
      sourceStage: record.retainedThermoBufferSourceStage || 'worker-retained-lane',
      thermoBufferByteLength: record.retainedThermoBufferByteLength || data?.sphParticleState?.thermo?.byteLength || null,
      seededFromCpu: record.retainedThermoBufferSeededFromCpu === true,
      copySrc: record.retainedThermoBufferCopySrc === true
    };
  }
  const uploadedThermoBuffer = data?.sphParticleUpload?.status === 'webgpu-uploaded'
    ? data.sphParticleUpload.thermoBuffer
    : null;
  if (uploadedThermoBuffer) {
    record.retainedThermoBuffer = uploadedThermoBuffer;
    record.retainedThermoBufferByteLength = data?.sphParticleState?.thermo?.byteLength || 0;
    record.retainedThermoBufferSourceStage = 'input-upload';
    record.retainedThermoBufferSeededFromCpu = false;
    record.retainedThermoBufferCopySrc = false;
    record.retainedThermoSnapshotRows = cloneFloat32Rows(data?.sphParticleState?.thermo);
    return {
      status: 'worker-retained-thermo-ready',
      thermoBuffer: record.retainedThermoBuffer,
      sourceStage: record.retainedThermoBufferSourceStage,
      thermoBufferByteLength: record.retainedThermoBufferByteLength || null,
      seededFromCpu: false,
      copySrc: false
    };
  }
  const device = workerDeviceResult?.device || data?.deviceResult?.device || null;
  const thermo = data?.sphParticleState?.thermo;
  const thermoBuffer = writeWorkerStorageBuffer(
    device,
    'ulg-worker-retained-sph-thermo-seed',
    thermo
  );
  if (!thermoBuffer) {
    return {
      status: 'blocked-worker-retained-thermo-input-missing',
      thermoBuffer: null,
      sourceStage: null,
      thermoBufferByteLength: thermo?.byteLength || null,
      seededFromCpu: false
    };
  }
  record.retainedThermoBuffer = thermoBuffer;
  record.retainedThermoBufferByteLength = thermo?.byteLength || 0;
  record.retainedThermoBufferSourceStage = 'cpu-seed';
  record.retainedThermoBufferSeededFromCpu = true;
  record.retainedThermoBufferCopySrc = true;
  record.retainedThermoSnapshotRows = cloneFloat32Rows(thermo);
  return {
    status: 'worker-retained-thermo-ready',
    thermoBuffer: record.retainedThermoBuffer,
    sourceStage: record.retainedThermoBufferSourceStage,
    thermoBufferByteLength: record.retainedThermoBufferByteLength || null,
    seededFromCpu: true,
    copySrc: true
  };
}

function applyWorkerRetainedThermoInput({ stageId, data, record, workerDeviceResult }) {
  if (data?.preferWebGpu !== true || !stageUsesSphThermo(stageId)) return null;
  const thermo = ensureWorkerRetainedThermoBuffer({ data, record, workerDeviceResult });
  if (!thermo.thermoBuffer) {
    return {
      status: thermo.status,
      applied: false,
      stageId,
      thermoBufferByteLength: thermo.thermoBufferByteLength,
      seededFromCpu: false
    };
  }
  data.sphParticleUpload = {
    ...(data.sphParticleUpload || {}),
    schema: data.sphParticleUpload?.schema || 'peercompute.ulg.worker-retained-sph-particle-upload.v0',
    status: 'webgpu-uploaded',
    workerRetainedThermo: true,
    thermoBuffer: thermo.thermoBuffer
  };
  return {
    status: 'applied-worker-retained-thermo-input',
    applied: true,
    stageId,
    sourceStage: thermo.sourceStage,
    thermoBufferByteLength: thermo.thermoBufferByteLength,
    seededFromCpu: thermo.seededFromCpu,
    thermoBufferCopySrc: thermo.copySrc === true
  };
}

function recordWorkerRetainedThermoOutput({ stageId, rawResult, record }) {
  const source = rawResult?.gpuResult || rawResult;
  if (!source?.thermoBuffer) return null;
  record.retainedThermoBuffer = source.thermoBuffer;
  record.retainedThermoBufferByteLength = source.thermoBufferByteLength || record.retainedThermoBufferByteLength || 0;
  record.retainedThermoBufferSourceStage = stageId;
  record.retainedThermoBufferSeededFromCpu = false;
  record.retainedThermoBufferCopySrc = true;
  record.retainedThermoSnapshotRows = null;
  return {
    status: 'adopted-worker-retained-thermo-output',
    stageId,
    thermoBufferByteLength: record.retainedThermoBufferByteLength || null,
    seededFromCpu: false
  };
}

// Worker-owned rematerialization of SS adopted particle storage: the
// main-thread retained GPUBuffer refs cannot cross the worker boundary, so
// the lane ships a descriptor-only seed and the worker rebuilds the adopted
// storage on ITS device from the packed rows the request already carries
// (peer-local-gpu-rematerialization-from-descriptor-seed). Buffers are
// retained on the lane record keyed by the adopted-storage hot-buffer key
// and reused across schedules; no raw GPUBuffer clone, no mapAsync export.
function applyWorkerAdoptedStorageRematerialization({ stageId, data, record, workerDeviceResult }) {
  const seed = data?.schroederAdoptedParticleStorageWorkerRematerializationSeed || null;
  const requested = data?.useSchroederAdoptedParticleStorageWorkerRematerialization === true;
  if (
    !requested
    || !WORKER_ADOPTED_STORAGE_REMATERIALIZATION_STAGE_IDS.has(stageId)
  ) return null;
  const hotBufferKey = normalizeString(seed?.hotBufferKey, null);
  if (!seed || seed.ready !== true || !hotBufferKey) {
    return {
      status: 'blocked-worker-adopted-storage-rematerialization-seed-not-ready',
      requested: true,
      applied: false,
      hotBufferKey
    };
  }
  const device = workerDeviceResult?.device || data?.deviceResult?.device || null;
  if (!device) {
    return {
      status: 'blocked-worker-adopted-storage-rematerialization-device-missing',
      requested: true,
      applied: false,
      hotBufferKey
    };
  }
  let retained = record.adoptedStorageRematerialization || null;
  let reused = false;
  const identityRequired = seed.identityRequired === true;
  const identityRevision = normalizeString(seed.identityRevision, null);
  const packedParticleCount = Math.max(0, Math.floor(Number(data?.sphParticleState?.particleCount) || 0));
  const authoritativeParticleCount = Math.max(0, Math.floor(Number(seed.authoritativeParticleCount) || 0));
  const outputParticleCapacity = Math.max(
    authoritativeParticleCount,
    Math.floor(Number(seed.outputParticleCapacity) || authoritativeParticleCount)
  );
  // The packed rows are the seed's row payload; a count mismatch means the
  // shipped rows do not represent the adopted storage - fail honest rather
  // than rematerialize a stale particle set as authoritative.
  if (authoritativeParticleCount > 0 && packedParticleCount !== authoritativeParticleCount) {
    return {
      status: 'blocked-worker-adopted-storage-rematerialization-row-count-mismatch',
      requested: true,
      applied: false,
      hotBufferKey,
      packedParticleCount,
      authoritativeParticleCount
    };
  }
  let phaseCarrierPlan = null;
  try {
    phaseCarrierPlan = resolveWorkerPhaseCarrierPlan({
      data,
      seed,
      particleCount: packedParticleCount
    });
  } catch (error) {
    return {
      status: 'blocked-worker-adopted-storage-rematerialization-phase-carrier-plan-mismatch',
      requested: true,
      applied: false,
      hotBufferKey,
      packedParticleCount,
      errorName: error instanceof Error ? error.name : null,
      errorMessage: error instanceof Error ? error.message : String(error)
    };
  }
  if (
    retained
    && retained.hotBufferKey === hotBufferKey
    && retained.identityRequired === identityRequired
    && (!identityRequired || retained.identityRevision === identityRevision)
    && phaseCarrierPlansEqual(retained.phaseCarrierPlan, phaseCarrierPlan)
  ) {
    reused = true;
  } else {
    const state = data?.sphParticleState?.state;
    const thermo = data?.sphParticleState?.thermo;
    const mechanics = data?.mlsMpmParticleState?.mechanics;
    if (!ArrayBuffer.isView(state) || !ArrayBuffer.isView(thermo) || !ArrayBuffer.isView(mechanics)) {
      return {
        status: 'blocked-worker-adopted-storage-rematerialization-packed-rows-missing',
        requested: true,
        applied: false,
        hotBufferKey
      };
    }
    const identity = data?.sphParticleState?.identity;
    if (identityRequired) {
      const expectedIdentityStrideBytes = SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT;
      const fourBufferRowsStale = data?.sphParticleState?.cpuStateStale === true
        || data?.sphParticleState?.cpuIdentityStale === true
        || data?.mlsMpmParticleState?.cpuStateStale === true;
      const fourBufferRowsComplete = state.length
          >= outputParticleCapacity * SPH_GPU_PARTICLE_STATE_FLOATS
        && thermo.length >= outputParticleCapacity * SPH_GPU_PARTICLE_THERMO_FLOATS
        && mechanics.length >= outputParticleCapacity * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
        && identity instanceof Uint32Array
        && identity.length >= outputParticleCapacity * SPH_GPU_PARTICLE_IDENTITY_UINTS;
      const identityContractAccepted = seed.particleIdentityMutationApproved === true
        && seed.requiresAuthoritativeFourBufferRows === true
        && seed.identitySchema === ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
        && seed.identityStrideBytes === expectedIdentityStrideBytes;
      if (fourBufferRowsStale || !fourBufferRowsComplete || !identityContractAccepted) {
        return {
          status: 'blocked-worker-adopted-storage-rematerialization-authoritative-four-buffer-snapshot-required',
          requested: true,
          applied: false,
          hotBufferKey,
          identityRequired: true,
          fourBufferRowsStale,
          fourBufferRowsComplete,
          identityContractAccepted,
          outputParticleCapacity
        };
      }
    }
    if (retained) {
      retained.stateBuffer?.destroy?.();
      retained.thermoBuffer?.destroy?.();
      retained.mechanicsBuffer?.destroy?.();
      retained.identityBuffer?.destroy?.();
    }
    retained = {
      hotBufferKey,
      seedSchema: seed.schema || null,
      materializationMode: seed.materializationMode || 'peer-local-gpu-rematerialization-from-descriptor-seed',
      particleCount: packedParticleCount,
      authoritativeParticleCount: authoritativeParticleCount || packedParticleCount,
      outputParticleCapacity,
      identityRequired,
      identityRevision,
      identitySchema: identityRequired ? seed.identitySchema : null,
      identityStrideBytes: identityRequired ? seed.identityStrideBytes : 0,
      phaseCarrierPlan: phaseCarrierPlan ? { ...phaseCarrierPlan } : null,
      stateBuffer: writeWorkerStorageBuffer(device, 'ulg-worker-adopted-storage-state', state),
      thermoBuffer: writeWorkerStorageBuffer(device, 'ulg-worker-adopted-storage-thermo', thermo),
      mechanicsBuffer: writeWorkerStorageBuffer(device, 'ulg-worker-adopted-storage-mechanics', mechanics),
      identityBuffer: identityRequired
        ? writeWorkerStorageBuffer(device, 'ulg-worker-adopted-storage-identity', identity)
        : null,
      stateBufferByteLength: state.byteLength,
      thermoBufferByteLength: thermo.byteLength,
      mechanicsBufferByteLength: mechanics.byteLength,
      identityBufferByteLength: identityRequired ? identity.byteLength : 0
    };
    if (
      !retained.stateBuffer
      || !retained.thermoBuffer
      || !retained.mechanicsBuffer
      || (identityRequired && !retained.identityBuffer)
    ) {
      retained.stateBuffer?.destroy?.();
      retained.thermoBuffer?.destroy?.();
      retained.mechanicsBuffer?.destroy?.();
      retained.identityBuffer?.destroy?.();
      return {
        status: 'blocked-worker-adopted-storage-rematerialization-buffer-create-failed',
        requested: true,
        applied: false,
        hotBufferKey
      };
    }
    record.adoptedStorageRematerialization = retained;
  }
  record.phaseCarrierPlan = retained.phaseCarrierPlan
    ? { ...retained.phaseCarrierPlan }
    : null;
  data.sphParticleUpload = {
    // This is a worker-local materialization of the canonical ABI, not a new
    // buffer family. Preserve the canonical schema/strides/byte lengths so
    // exact mechanics-field consumers can authenticate it without a second
    // upload or a permissive worker-only alias.
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    workerRetained: true,
    sourceStage: 'schroeder-adopted-particle-storage-worker-rematerialization',
    particleCount: retained.particleCount,
    stateStrideBytes:
      SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    thermoStrideBytes:
      SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    stateBufferByteLength: retained.stateBufferByteLength,
    thermoBufferByteLength: retained.thermoBufferByteLength,
    stateBuffer: retained.stateBuffer,
    thermoBuffer: retained.thermoBuffer,
    identityBuffer: retained.identityBuffer,
    identityRequired: retained.identityRequired,
    identityRevision: retained.identityRevision,
    identitySchema: retained.identitySchema,
    identityStrideBytes: retained.identityStrideBytes,
    identityBufferByteLength: retained.identityBufferByteLength,
    phaseCarrierPlan: retained.phaseCarrierPlan ? { ...retained.phaseCarrierPlan } : null,
    renderDomainKeys: { ...(seed.renderDomainKeys || {}) }
  };
  data.mlsMpmParticleUpload = {
    schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    workerRetained: true,
    sourceStage: 'schroeder-adopted-particle-storage-worker-rematerialization',
    particleCount: retained.particleCount,
    mechanicsStrideBytes:
      MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    mechanicsBufferByteLength: retained.mechanicsBufferByteLength,
    phaseCarrierPlan: retained.phaseCarrierPlan ? { ...retained.phaseCarrierPlan } : null,
    mechanicsBuffer: retained.mechanicsBuffer
  };
  return {
    status: 'worker-rematerialized-adopted-storage',
    requested: true,
    applied: true,
    reusedRetainedBuffers: reused,
    hotBufferKey,
    materializationMode: retained.materializationMode,
    particleCount: retained.particleCount,
    authoritativeParticleCount: retained.authoritativeParticleCount,
    stateBufferByteLength: retained.stateBufferByteLength,
    thermoBufferByteLength: retained.thermoBufferByteLength,
    mechanicsBufferByteLength: retained.mechanicsBufferByteLength,
    identityRequired: retained.identityRequired,
    identityRevision: retained.identityRevision,
    identityBufferByteLength: retained.identityBufferByteLength,
    phaseCarrierPlan: retained.phaseCarrierPlan ? { ...retained.phaseCarrierPlan } : null,
    phaseCarrierPlanPropagatedToUploads: Boolean(
      retained.phaseCarrierPlan
      && phaseCarrierPlansEqual(data.sphParticleUpload.phaseCarrierPlan, retained.phaseCarrierPlan)
      && phaseCarrierPlansEqual(data.mlsMpmParticleUpload.phaseCarrierPlan, retained.phaseCarrierPlan)
    ),
    rawGpuBufferPeerComputeTransfer: false
  };
}

function applyWorkerRetainedContinuationInput({ stageId, data, record, workerDeviceResult }) {
  const requested = data?.useWorkerRetainedG2pInput === true;
  if (!requested || stageId !== 'p2g') return null;
  const source = retainedG2pOutput(record);
  if (!source) {
    return {
      status: 'blocked-worker-retained-g2p-input-missing',
      requested: true,
      sourceStage: 'g2p'
    };
  }
  const thermo = ensureWorkerRetainedThermoBuffer({ data, record, workerDeviceResult });
  if (!thermo.thermoBuffer) {
    return {
      status: 'blocked-worker-retained-thermo-upload-missing',
      requested: true,
      sourceStage: 'g2p',
      thermoInputStatus: thermo.status
    };
  }
  data.sphParticleUpload = {
    ...(data.sphParticleUpload || {}),
    schema: data.sphParticleUpload?.schema || 'peercompute.ulg.worker-retained-sph-particle-upload.v0',
    status: 'webgpu-uploaded',
    workerRetained: true,
    sourceStage: 'g2p',
    particleCount: data?.sphParticleState?.particleCount ?? source.particleCount ?? null,
    stateBuffer: source.stateBuffer,
    thermoBuffer: record.retainedThermoBuffer
  };
  data.mlsMpmParticleUpload = {
    schema: 'peercompute.ulg.worker-retained-mls-mpm-particle-upload.v0',
    status: 'webgpu-uploaded',
    workerRetained: true,
    sourceStage: 'g2p',
    particleCount: data?.mlsMpmParticleState?.particleCount ?? data?.sphParticleState?.particleCount ?? null,
    mechanicsBuffer: source.mechanicsBuffer
  };
  return {
    status: 'applied-worker-retained-g2p-input',
    requested: true,
    sourceStage: 'g2p',
    stateBufferByteLength: source.stateBufferByteLength ?? null,
    mechanicsBufferByteLength: source.mechanicsBufferByteLength ?? null,
    thermoBufferRetained: true,
    thermoBufferSourceStage: thermo.sourceStage,
    thermoBufferSeededFromCpu: thermo.seededFromCpu,
    thermoBufferCopySrc: thermo.copySrc === true
  };
}

// --- Schroeder Simulation (SS) worker-lane stages (refactor increment W1) ---
//
// One 'run-resident-stage' message runs one stage; the increment-W2
// 'run-resident-schedule' driver further below loops these same stage
// functions for batched steps without any postMessage-to-self round trips.
// A schroederSpatialEpoch stage consumes a level-assignment source (the
// committed successor source family retained from the previous same-level
// step, or a payload-supplied level-assignment / active-node execution) and
// builds the spatial epoch generation on the worker's device with the REAL
// generation builder. The generation and every GPU buffer it references stay
// retained on the worker lane record; only seals, cloneable summaries, and
// worker-retained buffer refs cross the message boundary. A
// schroederSameLevelMechanics stage then consumes that retained generation
// for exactly one same-level mechanics step, handles successor-source-family
// consumption/retirement the way runSchroederSceneResidentSteps does, and
// retains the post-step particle buffers (plus any newly committed successor
// source family) for the next schroederSpatialEpoch. The two stages
// alternating in one lane are one SS step chain.
//
// Presentation consumes compact worker-local candidate summaries and retained
// buffer refs; scene-only diagnostic overlays, host timing/progress marks, and
// prior-execution cleanup evidence remain outside this component. The real
// WebGPU route is gated by plan/refactor/w4-worker-lane-verify.mjs; node tests
// independently drive the real epoch builder on the synthetic fake-device
// fixture and pin the mechanics-stage contract through the injectable
// stageOptions.schroederSameLevelMechanics.schroederSameLevelMechanicsRunner
// seam, which defaults to the real runSchroederSameLevelMechanicsWebGpu.

const SCHROEDER_EPOCH_IDENTITY_WORD_FIELDS = Object.freeze([
  'storageGeneration',
  'physicsTick',
  'physicsSubstep',
  'positionEpoch',
  'topologyEpoch',
  'chartEpoch',
  'levelEpoch',
  'supportEpoch'
]);
const SCHROEDER_EPOCH_SEAL_COMPARABLE_FIELDS = Object.freeze([
  'generationId',
  'deviceId',
  ...SCHROEDER_EPOCH_IDENTITY_WORD_FIELDS
]);
// The W4a lane-seed lineage contract (and the W4b scene hand-off contract):
// every word is REQUIRED, caller-supplied, and a finite non-negative integer.
// On the scene side, the eight epoch identity words come from the scene's
// current epoch identity and storageGeneration doubles as the buffer-family
// generation word the family resolver reads from BOTH live uploads.
export const ULG_WORKER_SCHROEDER_LANE_SEED_LINEAGE_WORD_FIELDS =
  SCHROEDER_EPOCH_IDENTITY_WORD_FIELDS;
// Classifier geometry the seed passes through to the REAL level-assignment
// runner; absent fields keep the runner's own defaults.
const SCHROEDER_LANE_SEED_CLASSIFIER_OPTION_FIELDS = Object.freeze([
  'baseGridSpacingM',
  'minLevel',
  'maxLevel',
  'targetSupportCells',
  'supportRadiusScale',
  'chartId',
  'minSupportRadiusM',
  'maxSupportRadiusM',
  'fallbackSupportRadiusM',
  'hysteresisBand'
]);
const workerSchroederLaneRecordByStageData = new WeakMap();
// The seed stage needs the W1 rematerialization report (which ran in the
// payload path before the stage runner) to fail closed with the exact W1
// blocked-status when the particle-storage descriptor was malformed.
const workerSchroederLaneSeedRematerializationByStageData = new WeakMap();

function workerSchroederStageError(stageId, reason, detail = null) {
  const error = new Error(
    `Worker ${stageId} stage failed closed: ${reason}${detail ? ` (${detail})` : ''}`
  );
  error.code = `ERR_ULG_WORKER_SCHROEDER_${reason.replace(/-/g, '_').toUpperCase()}`;
  error.stageId = stageId;
  error.reason = reason;
  return error;
}

function workerSchroederStageDevice(stageId, data = {}) {
  const device = data?.deviceResult?.device || data?.device || null;
  if (!device?.createBuffer || !device?.queue) {
    throw workerSchroederStageError(
      stageId,
      'worker-device-missing',
      'SS worker stages require the lane-resident WebGPU device'
    );
  }
  return device;
}

function workerSchroederLaneRecord(stageId, data = {}) {
  const record = workerSchroederLaneRecordByStageData.get(data);
  if (!record) {
    throw workerSchroederStageError(
      stageId,
      'lane-record-missing',
      'stage data was not prepared by stageDataForPayload'
    );
  }
  return record;
}

// The epoch's own seal: the generation carries its deviceId, generationId,
// and the eight epoch identity words on execution. This descriptor is the
// only epoch identity that crosses the message boundary; a scheduler echoes
// it back as stageOptions.schroederSameLevelMechanics.expectedSpatialEpochSeal
// to pin the retained generation across messages.
function workerSchroederEpochSealFromGeneration(generation, device) {
  const execution = generation?.execution || null;
  if (generation?.ready !== true || !execution) return null;
  return {
    schema: ULG_WORKER_SCHROEDER_EPOCH_SEAL_SCHEMA,
    generationId: execution.generationId ?? null,
    deviceId: execution.deviceId ?? null,
    consumerDeviceId: webGpuDeviceId(device),
    directoryAbiVersion: generation.directoryAbiVersion ?? null,
    mechanicsLevelCount: generation.mechanicsLevelCount
      ?? (generation.mechanicsLevelViews?.length ?? 0),
    mechanicsLevels: Array.isArray(generation.mechanicsLevels)
      ? [...generation.mechanicsLevels]
      : [],
    ...Object.fromEntries(SCHROEDER_EPOCH_IDENTITY_WORD_FIELDS.map(
      (field) => [field, execution[field] ?? null]
    ))
  };
}

function workerSchroederEpochSealMismatchFields(currentSeal, expectedSeal) {
  if (!currentSeal || !expectedSeal || typeof expectedSeal !== 'object') {
    return [];
  }
  return SCHROEDER_EPOCH_SEAL_COMPARABLE_FIELDS.filter((field) => (
    expectedSeal[field] !== undefined
    && expectedSeal[field] !== null
    && expectedSeal[field] !== currentSeal[field]
  ));
}

// Worker mirror of the scene's beginSchroederSpatialSuccessorSourceFamilyConsumption
// (src/visualization/sphPhaseScene.js). Reimplemented here from the runtime
// primitives so the worker never imports the scene module: acquire the exact
// read-only consumer lease while the family is still active, resolve the
// private successor level assignment, then request retirement that settles
// only after the owner fence and every issued lease fence complete.
function beginWorkerSchroederSuccessorSourceFamilyConsumption({
  sourceFamily = null,
  device = null,
  particleCount = sourceFamily?.particleCount,
  stateBuffer = null,
  thermoBuffer = null,
  identityBuffer = null,
  mechanicsBuffer = null,
  consumerStage = 'ulg-mechanics-resident-stage-worker-schroeder-spatial-epoch',
  retirementReason = 'ulg worker schroeder lane continuation superseded',
  ownerFence = Promise.resolve()
} = {}) {
  if (!sourceFamily) return null;
  const lease = acquireSchroederSpatialSuccessorSourceFamilyLease(
    sourceFamily,
    { device, consumerStage }
  );
  let resolution;
  let retirementPromise;
  try {
    resolution = resolveSchroederSpatialSuccessorSourceFamily(sourceFamily, {
      device,
      particleCount,
      stateBuffer,
      thermoBuffer,
      identityBuffer,
      mechanicsBuffer
    });
    retirementPromise = retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
      sourceFamily,
      {
        device,
        reason: retirementReason,
        after: ownerFence
      }
    );
  } catch (error) {
    releaseSchroederSpatialSuccessorSourceFamilyLease(
      sourceFamily,
      lease,
      { device }
    );
    throw error;
  }
  let releasePromise = null;
  return Object.freeze({
    sourceFamily,
    sourceFamilyLease: lease,
    levelAssignment: resolution.levelAssignment,
    levelAssignmentSeal: resolution.levelAssignmentSeal,
    retirementPromise,
    releaseAfter(after = null) {
      if (!releasePromise) {
        const attempt = releaseSchroederSpatialSuccessorSourceFamilyLeaseAfter(
          sourceFamily,
          lease,
          { device, after }
        );
        releasePromise = attempt;
        attempt.catch(() => {
          if (releasePromise === attempt) releasePromise = null;
        });
      }
      return releasePromise;
    }
  });
}

function releaseWorkerSchroederSuccessorLeaseQuietly(consumption, device) {
  if (!consumption?.sourceFamily || !consumption.sourceFamilyLease) return;
  try {
    releaseSchroederSpatialSuccessorSourceFamilyLease(
      consumption.sourceFamily,
      consumption.sourceFamilyLease,
      { device }
    );
  } catch {
    // The lease may already carry a queue-fenced release; keep the original
    // stage failure as the reported error.
  }
}

// --- SS worker-lane seed stage (refactor increment W4a) ---
//
// A fresh worker lane cannot start an SS schedule: the W2 step-1 epoch stage
// admits only a worker-retained successor family (which needs a prior SS step
// in this lane) or payload levelAssignment/activeNodeList sources that
// hard-require same-device retained GPUBuffers — and GPUBuffers cannot cross
// postMessage. The lane-seed stage closes that gap from a structured-
// cloneable descriptor: it reuses the W1 adopted-storage rematerialization
// (whose stage gate is the WORKER_ADOPTED_STORAGE_REMATERIALIZATION_STAGE_IDS
// capability list) to rebuild the four particle-storage buffers on the worker
// device, stamps the REQUIRED caller-supplied lineage words onto those
// uploads, runs the REAL resolveSchroederParticleBufferFamilyGeneration and
// publishes its ACTUAL verdict, then runs the REAL
// runSchroederLevelAssignmentWebGpu (injectable through
// stageOptions.schroederLaneSeed.levelAssignmentRunner) against the uploads
// and retains the resulting execution on record.schroederLane.laneSeed as a
// step-1-admissible level-assignment source. The worker NEVER invents
// lineage: a missing or non-finite word is a fail-closed error, never a
// default.
// W4b/W5 lane-admission prewarm hook. prewarmCachedExplicitComputePipeline
// requires an exact per-pipeline descriptor ({ cacheKey, label, code,
// entryPoint, bindings }); as of W5 the mechanical-proposals kernel module
// EXPORTS that enumeration (enumerateSchroederSpatialMechanicalPrewarm-
// PipelineDescriptors) from the same descriptor factory its encode path
// consumes, so the prewarmed cache keys can never drift from the keys the
// first SS step asks for. The default enumeration covers both canonical
// solver budgets (j16.p1024 batch, j16.p512 interactive), the aggregate and
// flat projection variants, and directory ABI v1.
//
// Fail-open but completion-truthful: descriptors compile concurrently and the
// lane seed awaits their settled summaries. A failed compile never rejects
// lane admission, but "completed" now means the async work actually settled.
export async function prewarmWorkerSchroederLaneComputePipelines(device, {
  enumeratePipelines =
    enumerateSchroederSpatialMechanicalPrewarmPipelineDescriptors
} = {}) {
  let descriptors;
  try {
    descriptors = typeof enumeratePipelines === 'function'
      ? (enumeratePipelines() || [])
      : [];
  } catch (error) {
    return {
      schema: 'peercompute.ulg.worker-schroeder-lane-pipeline-prewarm.v0',
      status: 'worker-lane-pipeline-prewarm-skipped-enumeration-failed',
      reason: error instanceof Error ? error.message : String(error),
      requestedCount: 0,
      firedCount: 0
    };
  }
  if (!Array.isArray(descriptors) || descriptors.length === 0) {
    return {
      schema: 'peercompute.ulg.worker-schroeder-lane-pipeline-prewarm.v0',
      status: 'worker-lane-pipeline-prewarm-skipped-no-enumeration',
      reason: 'the pipeline enumeration produced no descriptors',
      requestedCount: 0,
      firedCount: 0
    };
  }
  const results = await Promise.all(descriptors.map(async (descriptor) => {
    try {
      return await prewarmCachedExplicitComputePipeline(device, descriptor);
    } catch (error) {
      return {
        cacheStatus: 'pipeline-prewarm-failed',
        cacheKey: descriptor?.cacheKey ?? null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }));
  const failed = results.filter(
    (result) => result?.cacheStatus === 'pipeline-prewarm-failed'
  );
  return {
    schema: 'peercompute.ulg.worker-schroeder-lane-pipeline-prewarm.v0',
    status: 'worker-lane-pipeline-prewarm-completed',
    reason: null,
    requestedCount: descriptors.length,
    firedCount: descriptors.length,
    settledCount: results.length,
    prewarmedCount: results.filter(
      (result) => result?.cacheStatus === 'pipeline-prewarmed'
    ).length,
    cacheHitCount: results.filter(
      (result) => result?.cacheStatus === 'pipeline-cache-hit'
    ).length,
    failedCount: failed.length,
    failedCacheKeys: failed.map((result) => result?.cacheKey).filter(Boolean)
  };
}

// W4b: worker-local continuation classifier for batched schedules. A lane
// whose mechanics kernel retains post-step uploads but commits no successor
// source family (the offscreen presentation-device flow) rebuilds its next
// step's level assignment by running the REAL classifier against the lane's
// OWN retained buffers and advanced metadata. This factory is worker-local
// by construction (it closes over the retained lane map); the offscreen
// presentation worker injects it as the W2 driver's
// scheduleStepOptionsProvider because a function can never cross
// postMessage.
export function createWorkerSchroederLaneLevelAssignmentProvider({
  laneId = null,
  stateKey = null,
  classifierOptions = null,
  levelAssignmentRunner = runSchroederLevelAssignmentWebGpu
} = {}) {
  const laneKey = laneKeyForParts({ laneId, stateKey });
  const filteredClassifierOptions = {};
  for (const field of SCHROEDER_LANE_SEED_CLASSIFIER_OPTION_FIELDS) {
    if (classifierOptions?.[field] != null) {
      filteredClassifierOptions[field] = classifierOptions[field];
    }
  }
  const provider = async function workerSchroederLaneLevelAssignmentProvider() {
    const record = retainedLanes.get(laneKey);
    const lane = record?.schroederLane || null;
    if (!lane) {
      throw new Error(
        `Worker schroeder lane continuation failed closed: lane-continuation-state-missing (no retained lane for ${laneKey})`
      );
    }
    // A committed successor source family is the lane's native step source;
    // the epoch stage consumes it directly.
    if (lane.successorSourceFamily) return {};
    const sphUpload = lane.sphParticleUpload || null;
    const mlsUpload = lane.mlsMpmParticleUpload || null;
    if (!sphUpload?.stateBuffer || !mlsUpload?.mechanicsBuffer) {
      throw new Error(
        'Worker schroeder lane continuation failed closed: lane-post-step-uploads-missing (the previous step retained no continuation buffers)'
      );
    }
    const execution = await levelAssignmentRunner({
      device: lane.device,
      sphParticleState: lane.sphParticleState || null,
      mlsMpmParticleState: lane.mlsMpmParticleState || null,
      sphParticleUpload: sphUpload,
      mlsMpmParticleUpload: mlsUpload,
      ...filteredClassifierOptions,
      retainAssignmentBuffer: true,
      readbackMode: NO_FULL_READBACK_MODE
    });
    if (
      execution?.status !== 'schroeder-level-assignment-submitted'
      || !execution.assignmentBuffer
    ) {
      throw new Error(
        `Worker schroeder lane continuation failed closed: lane-continuation-level-assignment-invalid (${execution?.status ?? 'missing-execution'})`
      );
    }
    return { levelAssignment: execution };
  };
  // Only this factory can mint the assignment-only capability. The function
  // never crosses postMessage, and its return shape is reduced here to one
  // levelAssignment field, so skipping it on Tier0 cannot suppress a law or
  // topology activation request.
  workerLaneAssignmentOnlyScheduleProviders.add(provider);
  workerLaneScheduleProviderAuthority.set(
    provider,
    createSchroederTargetScheduleProviderAuthority({
      kind: 'worker-lane-assignment-only',
      classifierOptions: filteredClassifierOptions
    })
  );
  return provider;
}

async function runWorkerSchroederLaneSeedStage(data = {}) {
  const stageId = SCHROEDER_LANE_SEED_STAGE_ID;
  const seedOptions = data.schroederLaneSeed
    && typeof data.schroederLaneSeed === 'object'
    ? data.schroederLaneSeed
    : {};
  const retiredLane = seedOptions.retireLane
    && typeof seedOptions.retireLane === 'object'
    ? seedOptions.retireLane
    : null;
  let retiredLaneReceipt = null;
  if (retiredLane?.laneId || retiredLane?.stateKey) {
    const retiredKey = laneKeyForParts(retiredLane);
    const nextKey = laneKeyFor(data);
    if (retiredKey !== nextKey) {
      retiredLaneReceipt = releaseUlgMechanicsResidentStageWorkerLane({
        laneId: retiredLane.laneId,
        stateKey: retiredLane.stateKey,
        reason: 'superseded-by-fresh-worker-lane-seed'
      });
      if (
        retiredLaneReceipt.status
        === 'worker-resident-lane-release-blocked-schedule-active'
      ) {
        throw workerSchroederStageError(
          stageId,
          'retired-lane-schedule-active',
          `the superseded lane ${retiredKey} still owns an active schedule`
        );
      }
    }
  }
  const record = workerSchroederLaneRecord(stageId, data);
  const device = workerSchroederStageDevice(stageId, data);
  const previousLane = record.schroederLane || null;
  if (previousLane) {
    // No reseed capability in this increment: one seed per lane, and a lane
    // that already retains SS step state never accepts a seed.
    const seededOnly = Boolean(previousLane.laneSeed)
      && !previousLane.epochGeneration
      && previousLane.stepOrdinal == null;
    throw workerSchroederStageError(
      stageId,
      seededOnly ? 'lane-already-seeded' : 'lane-already-stepped',
      seededOnly
        ? 'the retained seed must feed this lane\'s step 1 first; there is no reseed flag in this increment'
        : 'the lane already retains SS step state; seeds only start fresh lanes'
    );
  }
  const lineageSource = seedOptions.lineage
    && typeof seedOptions.lineage === 'object'
    ? seedOptions.lineage
    : null;
  const lineage = {};
  const invalidLineageWords = [];
  for (const field of ULG_WORKER_SCHROEDER_LANE_SEED_LINEAGE_WORD_FIELDS) {
    const value = Number(lineageSource?.[field]);
    if (Number.isSafeInteger(value) && value >= 0) {
      lineage[field] = value;
    } else {
      invalidLineageWords.push(field);
    }
  }
  if (!lineageSource || invalidLineageWords.length > 0) {
    throw workerSchroederStageError(
      stageId,
      'seed-lineage-missing',
      `stageOptions.schroederLaneSeed.lineage must supply finite non-negative integer words for: ${
        (lineageSource
          ? invalidLineageWords
          : [...ULG_WORKER_SCHROEDER_LANE_SEED_LINEAGE_WORD_FIELDS]).join(', ')
      }`
    );
  }
  const rematerialization =
    workerSchroederLaneSeedRematerializationByStageData.get(data) || null;
  const sphUpload = data.sphParticleUpload || null;
  const mlsUpload = data.mlsMpmParticleUpload || null;
  const rematerializedUploadsReady = rematerialization?.applied === true
    && sphUpload?.sourceStage
      === 'schroeder-adopted-particle-storage-worker-rematerialization'
    && sphUpload.stateBuffer
    && sphUpload.thermoBuffer
    && mlsUpload?.mechanicsBuffer;
  if (!rematerializedUploadsReady) {
    // The W1 machinery already judged the particle-storage descriptor; its
    // exact blocked-status IS the truthful malformed-descriptor error.
    throw workerSchroederStageError(
      stageId,
      'seed-particle-storage-rematerialization-blocked',
      rematerialization?.status
        || 'the seed did not request the W1 adopted-storage rematerialization (useSchroederAdoptedParticleStorageWorkerRematerialization + descriptor seed required)'
    );
  }
  const consumerDeviceId = webGpuDeviceId(device);
  const seedSourceBuffers = [
    ['sphParticleUpload.stateBuffer', sphUpload.stateBuffer],
    ['sphParticleUpload.thermoBuffer', sphUpload.thermoBuffer],
    ...(sphUpload.identityBuffer
      ? [['sphParticleUpload.identityBuffer', sphUpload.identityBuffer]]
      : []),
    ['mlsMpmParticleUpload.mechanicsBuffer', mlsUpload.mechanicsBuffer]
  ];
  for (const [path, buffer] of seedSourceBuffers) {
    // Tagging is provenance-preserving: a buffer already owned by another
    // device keeps its tag and fails the mismatch check below.
    tagWebGpuBufferDevice(buffer, device);
    const owner = webGpuBufferDevice(buffer);
    if (owner && owner !== device) {
      throw workerSchroederStageError(
        stageId,
        'seed-device-mismatch',
        `${path} belongs to device ${webGpuDeviceId(owner)}, not the worker lane device ${consumerDeviceId}`
      );
    }
  }
  const particleCount = firstPositiveInteger([
    sphUpload.particleCount,
    data?.sphParticleState?.particleCount
  ], 0) || null;
  const lineageWordEntries = Object.fromEntries(
    ULG_WORKER_SCHROEDER_LANE_SEED_LINEAGE_WORD_FIELDS.map(
      (field) => [field, lineage[field]]
    )
  );
  // Attach the caller-supplied lineage to the rematerialized uploads so the
  // REAL family resolver and level-assignment classifier read exactly the
  // scene's identity. storageGeneration doubles as the buffer-family
  // generation word on BOTH uploads: one family, one generation.
  const seededSphUpload = {
    ...sphUpload,
    ...lineageWordEntries,
    bufferFamilyGeneration: lineage.storageGeneration
  };
  const seededMlsUpload = {
    ...mlsUpload,
    ...lineageWordEntries,
    bufferFamilyGeneration: lineage.storageGeneration
  };
  const bufferFamilyGeneration = resolveSchroederParticleBufferFamilyGeneration({
    sphParticleUpload: seededSphUpload,
    mlsMpmParticleUpload: seededMlsUpload,
    particleCount
  });
  if (
    bufferFamilyGeneration.ready !== true
    || bufferFamilyGeneration.status
      !== 'schroeder-particle-buffer-family-generation-ready'
  ) {
    const error = workerSchroederStageError(
      stageId,
      'seed-family-generation-rejected',
      `${bufferFamilyGeneration.status}: ${bufferFamilyGeneration.reason ?? 'no reason'}`
    );
    error.bufferFamilyGeneration = bufferFamilyGeneration;
    throw error;
  }
  const levelAssignmentRunner =
    typeof seedOptions.levelAssignmentRunner === 'function'
      ? seedOptions.levelAssignmentRunner
      : runSchroederLevelAssignmentWebGpu;
  const levelAssignmentRunnerSource =
    levelAssignmentRunner === runSchroederLevelAssignmentWebGpu
      ? 'real-runSchroederLevelAssignmentWebGpu'
      : 'stage-option-injected-level-assignment-runner';
  const classifierOptions = {};
  for (const field of SCHROEDER_LANE_SEED_CLASSIFIER_OPTION_FIELDS) {
    if (seedOptions[field] != null) classifierOptions[field] = seedOptions[field];
  }
  const execution = await levelAssignmentRunner({
    device,
    sphParticleState: data.sphParticleState,
    mlsMpmParticleState: data.mlsMpmParticleState,
    sphParticleUpload: seededSphUpload,
    mlsMpmParticleUpload: seededMlsUpload,
    ...classifierOptions,
    retainAssignmentBuffer: true,
    readbackMode: NO_FULL_READBACK_MODE
  });
  if (
    execution?.schema
      !== 'peercompute.ulg.schroeder-level-assignment-execution.v0'
    || execution.status !== 'schroeder-level-assignment-submitted'
    || !execution.assignmentBuffer
  ) {
    throw workerSchroederStageError(
      stageId,
      'seed-level-assignment-execution-invalid',
      `${execution?.status ?? 'missing-execution'}: the runner did not retain a submitted level-assignment execution`
    );
  }
  if (
    execution.bufferFamilyGenerationStatus
      !== 'schroeder-particle-buffer-family-generation-ready'
  ) {
    // The runner re-ran the family resolver against the same uploads; its
    // verdict is authoritative and is published truthfully.
    const error = workerSchroederStageError(
      stageId,
      'seed-family-generation-rejected',
      `${execution.bufferFamilyGenerationStatus ?? 'missing-status'}: ${
        execution.bufferFamilyGeneration?.reason ?? 'no reason'
      }`
    );
    error.bufferFamilyGeneration =
      execution.bufferFamilyGeneration ?? bufferFamilyGeneration;
    throw error;
  }
  const assignmentBufferOwner = webGpuBufferDevice(execution.assignmentBuffer);
  if (assignmentBufferOwner && assignmentBufferOwner !== device) {
    throw workerSchroederStageError(
      stageId,
      'seed-device-mismatch',
      `the seeded level-assignment buffer belongs to device ${
        webGpuDeviceId(assignmentBufferOwner)
      }, not the worker lane device ${consumerDeviceId}`
    );
  }
  tagWebGpuBufferDevice(execution.assignmentBuffer, device);
  const laneSeed = {
    schema: ULG_WORKER_SCHROEDER_LANE_SEED_SCHEMA,
    lineage: { ...lineage },
    bufferFamilyGeneration,
    levelAssignment: execution,
    levelAssignmentRunnerSource,
    consumed: false,
    consumedByGenerationId: null
  };
  record.schroederLane = {
    schema: 'peercompute.ulg.worker-schroeder-lane-state.v0',
    device,
    deviceId: consumerDeviceId,
    // No SS step has run yet: the first schroederSpatialEpoch on this lane
    // is step ordinal 0, exactly as on an unseeded lane.
    stepOrdinal: null,
    epochGeneration: null,
    epochSeal: null,
    epochConsumed: false,
    epochReleaseScheduled: false,
    epochReleasePromise: null,
    levelAssignment: null,
    activeNodeList: null,
    levelAssignmentSource: null,
    successorConsumption: null,
    successorLeaseReleasePromise: null,
    successorSourceFamily: null,
    executionMode: 'worker-lane-seeded',
    tier0ContinuationIdentity: null,
    nextScheduleTargetAuthority: null,
    nextScheduleLawActivationObservation: null,
    lastConsumedDynamicLawTargetScheduleRequestId: null,
    laneSeed,
    sphParticleUpload: seededSphUpload,
    mlsMpmParticleUpload: seededMlsUpload,
    // The seed is the single structured-clone boundary for packed particle
    // rows. Retain those worker-local state descriptors alongside the GPU
    // uploads: the first mechanics step still needs their schemas and scalar
    // metadata, and subsequent steps replace them with the advanced
    // worker-local clones below. Schedule messages never resend the rows.
    sphParticleState: data.sphParticleState,
    mlsMpmParticleState: data.mlsMpmParticleState,
    particleCount
  };
  const seedLevelAssignmentBufferRef = retainGpuBuffer(
    record,
    stageId,
    'laneSeed.levelAssignment.assignmentBuffer',
    execution.assignmentBuffer
  );
  // Lane admission waits for the concurrent prewarm set to settle. Compilation
  // failures remain fail-open and are sealed in the returned summary.
  const pipelinePrewarm = await prewarmWorkerSchroederLaneComputePipelines(device);
  return {
    schema: ULG_WORKER_SCHROEDER_LANE_SEED_STAGE_SCHEMA,
    status: 'worker-schroeder-lane-seeded',
    pipelinePrewarm,
    retiredLaneReceipt,
    backend: 'webgpu',
    readbackMode: data.readbackMode || null,
    laneSeeded: true,
    seedRetainedInLane: true,
    deviceId: consumerDeviceId,
    seedLineage: { ...lineage },
    bufferFamilyGenerationStatus: bufferFamilyGeneration.status,
    bufferFamilyGeneration: { ...bufferFamilyGeneration },
    levelAssignmentRunnerSource,
    levelAssignmentSummary: {
      status: execution.status,
      bufferFamilyGenerationStatus: execution.bufferFamilyGenerationStatus,
      backend: execution.backend ?? null,
      pipelineCacheStatus: execution.pipelineCacheStatus ?? null,
      particleCount: execution.particleCount ?? particleCount,
      assignmentStrideFloats: execution.assignmentStrideFloats ?? null,
      assignmentBufferByteLength: execution.assignmentBufferByteLength ?? null,
      minLevel: execution.minLevel ?? null,
      maxLevel: execution.maxLevel ?? null,
      chartId: execution.chartId ?? null,
      baseGridSpacingM: execution.baseGridSpacingM ?? null,
      ...Object.fromEntries(SCHROEDER_EPOCH_IDENTITY_WORD_FIELDS.map(
        (field) => [field, execution[field] ?? null]
      ))
    },
    workerAdoptedStorageRematerializationStatus: rematerialization.status,
    particleCount,
    seedLevelAssignmentBufferRef
  };
}

async function runWorkerSchroederSpatialEpochStage(data = {}) {
  const stageId = SCHROEDER_SPATIAL_EPOCH_STAGE_ID;
  const record = workerSchroederLaneRecord(stageId, data);
  const device = workerSchroederStageDevice(stageId, data);
  const previousLane = record.schroederLane || null;
  if (previousLane?.epochGeneration && previousLane.epochConsumed !== true) {
    throw workerSchroederStageError(
      stageId,
      'unconsumed-epoch-retained',
      `lane still retains unconsumed spatial epoch generation ${
        previousLane.epochSeal?.generationId ?? 'unknown'
      }; run schroederSameLevelMechanics first`
    );
  }
  const laneSphUpload = previousLane?.sphParticleUpload || null;
  const laneMlsUpload = previousLane?.mlsMpmParticleUpload || null;
  const retainedSourceFamily = previousLane?.successorSourceFamily
    || data.schroederSpatialSuccessorSourceFamily
    || null;
  const unconsumedLaneSeed = previousLane?.laneSeed
    && previousLane.laneSeed.consumed !== true
    ? previousLane.laneSeed
    : null;
  if (unconsumedLaneSeed && retainedSourceFamily) {
    // While a seed is pending, the seeded assignment is the lane's ONLY
    // admissible step-1 source; a competing successor family is ambiguous
    // and fails closed instead of silently bypassing (and stranding) the
    // seed.
    throw workerSchroederStageError(
      stageId,
      'seeded-lane-conflicting-level-assignment-source',
      'a lane holding an unconsumed seeded assignment admits no successor source family'
    );
  }
  let successorConsumption = null;
  let levelAssignment = null;
  let activeNodeList = null;
  let levelAssignmentSource = null;
  if (retainedSourceFamily) {
    // Mirror the scene's per-step consumption exactly; a family that does not
    // identify the exact committed same-device continuation throws here and
    // the stage fails closed instead of falling back to stale inputs.
    successorConsumption = beginWorkerSchroederSuccessorSourceFamilyConsumption({
      sourceFamily: retainedSourceFamily,
      device,
      particleCount: laneSphUpload?.particleCount
        ?? data?.sphParticleUpload?.particleCount,
      stateBuffer: laneSphUpload?.stateBuffer
        ?? data?.sphParticleUpload?.stateBuffer
        ?? null,
      thermoBuffer: laneSphUpload?.thermoBuffer
        ?? data?.sphParticleUpload?.thermoBuffer
        ?? null,
      identityBuffer: laneSphUpload?.identityBuffer
        ?? data?.sphParticleUpload?.identityBuffer
        ?? null,
      mechanicsBuffer: laneMlsUpload?.mechanicsBuffer
        ?? data?.mlsMpmParticleUpload?.mechanicsBuffer
        ?? null,
      retirementReason:
        'ulg worker schroeder lane continuation superseded by next spatial epoch',
      // The lane's previous mechanics submissions are already queue-ordered;
      // retirement still waits for every issued lease fence, so the resolved
      // owner fence mirrors the scene's Promise.resolve() contract.
      ownerFence: Promise.resolve()
    });
    levelAssignment = successorConsumption?.levelAssignment || null;
    levelAssignmentSource = 'worker-retained-successor-source-family';
    if (!levelAssignment) {
      releaseWorkerSchroederSuccessorLeaseQuietly(successorConsumption, device);
      throw workerSchroederStageError(
        stageId,
        'successor-family-level-assignment-missing',
        'committed successor source family resolved without a canonical level assignment'
      );
    }
  } else if (unconsumedLaneSeed) {
    // W4a: a lane holding an unconsumed seeded assignment uses it for step 1
    // exactly as data.levelAssignment would be used — and admits no competing
    // payload source while the seed is pending: no silent preference, fail
    // closed on the conflict instead.
    if (
      (data.levelAssignment && typeof data.levelAssignment === 'object')
      || (data.activeNodeList && typeof data.activeNodeList === 'object')
    ) {
      throw workerSchroederStageError(
        stageId,
        'seeded-lane-conflicting-level-assignment-source',
        'a lane holding an unconsumed seeded assignment admits no payload levelAssignment/activeNodeList'
      );
    }
    levelAssignment = unconsumedLaneSeed.levelAssignment;
    levelAssignmentSource = 'worker-lane-seeded-level-assignment';
    if (!levelAssignment?.assignmentBuffer) {
      throw workerSchroederStageError(
        stageId,
        'seeded-level-assignment-missing',
        'the retained lane seed no longer carries a submitted level-assignment execution'
      );
    }
  } else if (data.levelAssignment && typeof data.levelAssignment === 'object') {
    levelAssignment = data.levelAssignment;
    levelAssignmentSource = 'stage-option-level-assignment';
    if (data.useWorkerRetainedParticleBuffers === true) {
      if (!laneSphUpload?.stateBuffer) {
        throw workerSchroederStageError(
          stageId,
          'worker-retained-particle-buffers-missing',
          'useWorkerRetainedParticleBuffers requires post-step uploads retained by a prior schroederSameLevelMechanics stage in this lane'
        );
      }
      if (!levelAssignment.sourceStateBuffer) {
        levelAssignment = {
          ...levelAssignment,
          sourceStateBuffer: laneSphUpload.stateBuffer,
          sourceStateBufferBorrowed: true
        };
      }
      levelAssignmentSource =
        'stage-option-level-assignment-with-worker-retained-particle-buffers';
    }
  } else if (data.activeNodeList && typeof data.activeNodeList === 'object') {
    activeNodeList = data.activeNodeList;
    levelAssignmentSource = 'stage-option-active-node-list';
  } else {
    throw workerSchroederStageError(
      stageId,
      'level-assignment-source-missing',
      'no retained successor source family and no payload-supplied levelAssignment/activeNodeList'
    );
  }
  const particleCount = firstPositiveInteger([
    levelAssignment?.particleCount,
    data?.sphParticleState?.particleCount,
    activeNodeList?.activeCandidateCount
  ], 0) || null;
  const particleIdentityBuffer = data.particleIdentityBuffer
    ?? (data.useWorkerRetainedParticleBuffers === true
      || successorConsumption
      || levelAssignmentSource === 'worker-lane-seeded-level-assignment'
      ? laneSphUpload?.identityBuffer ?? null
      : null)
    ?? data?.sphParticleUpload?.identityBuffer
    ?? null;
  const generationRunner =
    typeof data.schroederSpatialEpochGenerationRunner === 'function'
      ? data.schroederSpatialEpochGenerationRunner
      : runSchroederSpatialEpochGenerationWebGpu;
  const selectedLevel = Math.round(Number(data.selectedLevel) || 0);
  const nativeGridSpacingM = schroederGridSpacingForLevel({
    selectedLevel,
    baseGridSpacingM: data.baseGridSpacingM ?? data.gridSpacingM,
    minLevel: data.minLevel,
    maxLevel: data.maxLevel
  });
  const fineGridSpec = data.mechanicsGrid || createMlsMpmGridSpec({
    boxDimsM: data.boxDimsM,
    gridSpacingM: nativeGridSpacingM
  });
  const mechanicsGrid = data.mechanicsGrid || {
    gridNodeCount: fineGridSpec.gridNodeCount,
    gridDims: [...fineGridSpec.gridDims],
    gridShift: fineGridSpec.shift,
    gridSpacingM: fineGridSpec.gridSpacingM
  };
  const coarseGridSpec = data.enableTwoLevelMechanics === true
    ? createMlsMpmGridSpec({
        boxDimsM: data.boxDimsM,
        gridSpacingM: nativeGridSpacingM * 2
      })
    : null;
  const authoritativeTwoLevel = Boolean(
    data.enableTwoLevelMechanics === true
    && String(data.twoLevelMechanicsAuthority || 'observation')
      .trim()
      .toLowerCase() === 'authoritative'
  );
  // The authoritative hierarchy always uses at least four direct arenas and
  // keys its sparse mechanics pair by the physical particle capacity.  The
  // worker-built initial epoch must use that exact cache identity too.  A
  // default r3/a=maxSourceCount epoch followed by the controller's r4/a=N
  // refresh otherwise materializes two large, incompatible field-pair
  // families on the same device, substantially increasing late-run
  // allocation pressure without adding another authority domain.
  const resolvedSpatialEpochArenaCount = authoritativeTwoLevel
    ? Math.max(4, Number(data.spatialEpochArenaCount ?? 4))
    : (data.spatialEpochArenaCount == null
        ? null
        : Number(data.spatialEpochArenaCount));
  // Diagnostic-only: fence-bracket the epoch generation so its device cost
  // is attributable (the recorder goes ONLY to the generation runner; the
  // mechanics kernel's canonical-cleanup exactness gate never sees it).
  const epochProfilingRequested =
    data?.residentStepOptions?.residentGpuTimestampProfilingRequested === true
    || previousLane?.residentStepOptions
      ?.residentGpuTimestampProfilingRequested === true;
  // Diagnostic-only queue-interval bracket around the epoch generation: a
  // start marker submitted before the runner and an end marker after it
  // measure the ordered device interval the generation occupies (the
  // runner submits its own encoder inside the awaited call).
  let epochIntervalProfiler = null;
  let epochIntervalBracket = null;
  if (epochProfilingRequested) {
    try {
      epochIntervalProfiler = createSphGpuTimestampProfiler({
        device,
        enabled: true,
        capacity: 2,
        label: 'ulg-worker-schroeder-epoch-queue-interval'
      });
      epochIntervalBracket =
        epochIntervalProfiler.passTimestamps('epochQueueInterval');
      if (epochIntervalBracket) {
        const markerEncoder = device.createCommandEncoder();
        encodeSphGpuTimestampMarkerPass(markerEncoder, {
          querySet: epochIntervalBracket.timestampWrites.querySet,
          queryIndex:
            epochIntervalBracket.timestampWrites.beginningOfPassWriteIndex,
          boundary: 'start',
          label: 'ulg-worker-schroeder-epoch-interval-start'
        });
        device.queue.submit([markerEncoder.finish()]);
      }
    } catch {
      epochIntervalProfiler = null;
      epochIntervalBracket = null;
    }
  }
  let generation;
  try {
    generation = await generationRunner({
      // Phase-volume moment/receipt sidecars exist to serve phase-volume
      // migration/transport. With migration disabled they have no consumer,
      // and at bulk capacities their field-scale arenas are the largest
      // allocations in the whole generation (their first 262144-capacity
      // construction wedged the lane before this gate).
      phaseVolumeSidecarsEnabled:
        data.enablePhaseVolumeMigration === true || authoritativeTwoLevel,
      // Field views are skipped only when the schedule proves no field-mode
      // consumer exists (see epochOptionsForStep); default is to build.
      mechanicsFieldViewsEnabled: data.mechanicsFieldViewsRequired !== false,
      device,
      ...(levelAssignment ? { levelAssignment } : { activeNodeList }),
      particleCount,
      activeSourceCapacity: particleCount,
      ...(particleIdentityBuffer
        ? {
            particleIdentityBuffer,
            particleIdentityStrideWords: firstPositiveInteger(
              [data.particleIdentityStrideWords],
              SPH_GPU_PARTICLE_IDENTITY_UINTS
            )
          }
        : {}),
      laneId: 'ulg-mechanics-resident-stage-worker',
      sourceFamily: levelAssignment
        ? 'schroeder-level-assignment-particles'
        : 'schroeder-active-node-particles',
      selectedLevel,
      mechanicsGrid,
      // Bound the directory sort key domain to the mechanics grid, exactly as
      // the hierarchy-owned refresh epochs do (schroederHierarchyGpu.js
      // exactCellAtlas). Without a bounded atlas the significant-digit-row
      // pruner keeps all 24 cell nibble rows, so this worker-prebuilt E0 pays
      // 25 radix passes per step while its successor refresh epochs pay 7.
      // The atlas is enforced fail-closed in key emission: a particle outside
      // the grid becomes a rejected row with evidence — the same admission the
      // successor epochs already apply every step to the same particle set.
      exactCellAtlas: {
        cellMin: [0, 0, 0],
        cellCount: [...mechanicsGrid.gridDims]
      },
      ...(coarseGridSpec
        ? {
            mechanicsLevels: [
              { selectedLevel, mechanicsGrid },
              {
                selectedLevel: selectedLevel + 1,
                mechanicsGrid: {
                  gridNodeCount: coarseGridSpec.gridNodeCount,
                  gridDims: [...coarseGridSpec.gridDims],
                  gridShift: coarseGridSpec.shift,
                  gridSpacingM: coarseGridSpec.gridSpacingM
                }
              }
            ]
          }
        : {}),
      ...(resolvedSpatialEpochArenaCount == null
        ? {}
        : { directArenaCount: resolvedSpatialEpochArenaCount }
      ),
      mechanicsFieldPairV2Enabled: data.enableMechanicsFieldPairV2 === true,
      // The worker prebuilds and injects the canonical generation rather
      // than letting the hierarchy build it. Authoritative two-level
      // mechanics therefore has to mount the same read-only S9-C topology
      // artifact the hierarchy-owned path requests for its transaction.
      phaseVolumeInterfaceProposalEnabled: authoritativeTwoLevel,
      exactNearCellTreeEnabled: data.exactNearCellTreeEnabled !== false,
      gpuQueueTimelineRequested: epochProfilingRequested,
      gpuTimestampRecorder: null
    });
  } catch (error) {
    releaseWorkerSchroederSuccessorLeaseQuietly(successorConsumption, device);
    throw error;
  }
  let epochQueueTimeline = null;
  if (
    epochProfilingRequested
    && typeof generation?.readGenerationQueueTimeline === 'function'
  ) {
    try {
      epochQueueTimeline = await generation.readGenerationQueueTimeline();
    } catch {
      epochQueueTimeline = null;
    }
  }
  let epochQueueIntervalMs = null;
  if (epochIntervalBracket && epochIntervalProfiler) {
    try {
      const markerEncoder = device.createCommandEncoder();
      encodeSphGpuTimestampMarkerPass(markerEncoder, {
        querySet: epochIntervalBracket.timestampWrites.querySet,
        queryIndex: epochIntervalBracket.timestampWrites.endOfPassWriteIndex,
        boundary: 'end',
        label: 'ulg-worker-schroeder-epoch-interval-end'
      });
      epochIntervalProfiler.resolve(markerEncoder);
      device.queue.submit([markerEncoder.finish()]);
      const intervalProfile = await epochIntervalProfiler.read();
      epochQueueIntervalMs =
        intervalProfile?.stageGpuMs?.epochQueueInterval ?? null;
    } catch {
      epochQueueIntervalMs = null;
    } finally {
      epochIntervalProfiler.destroy?.();
    }
  }
  if (generation?.ready !== true) {
    releaseWorkerSchroederSuccessorLeaseQuietly(successorConsumption, device);
    throw workerSchroederStageError(
      stageId,
      'generation-not-ready',
      `${generation?.status ?? 'missing-generation'}: ${generation?.reason ?? 'no reason'}`
    );
  }
  const epochSeal = workerSchroederEpochSealFromGeneration(generation, device);
  if (!epochSeal
    || (epochSeal.deviceId != null
      && epochSeal.deviceId !== epochSeal.consumerDeviceId)) {
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, device);
    releaseWorkerSchroederSuccessorLeaseQuietly(successorConsumption, device);
    throw workerSchroederStageError(
      stageId,
      'generation-device-mismatch',
      `generation deviceId ${epochSeal?.deviceId ?? 'missing'} is not the worker lane device ${epochSeal?.consumerDeviceId ?? webGpuDeviceId(device)}`
    );
  }
  record.schroederLane = {
    schema: 'peercompute.ulg.worker-schroeder-lane-state.v0',
    device,
    deviceId: epochSeal.consumerDeviceId,
    stepOrdinal: (previousLane?.stepOrdinal ?? -1) + 1,
    epochGeneration: generation,
    epochSeal,
    epochConsumed: false,
    epochReleaseScheduled: false,
    epochReleasePromise: null,
    levelAssignment,
    activeNodeList,
    levelAssignmentSource,
    successorConsumption,
    successorLeaseReleasePromise: null,
    // The retained family (if any) was just consumed into this epoch; the
    // next family arrives from the following mechanics step.
    successorSourceFamily: null,
    executionMode: previousLane?.executionMode ?? 'canonical-schroeder',
    tier0ContinuationIdentity:
      previousLane?.tier0ContinuationIdentity ?? null,
    nextScheduleTargetAuthority:
      previousLane?.nextScheduleTargetAuthority ?? null,
    nextScheduleLawActivationObservation:
      previousLane?.nextScheduleLawActivationObservation ?? null,
    lastConsumedDynamicLawTargetScheduleRequestId:
      previousLane?.lastConsumedDynamicLawTargetScheduleRequestId ?? null,
    // A seeded assignment feeds exactly one epoch; the consumed marker stays
    // on the lane so double-seeding remains detectable and the W2 driver can
    // keep the seed lineage as its monotonicity baseline.
    laneSeed: previousLane?.laneSeed
      ? {
          ...previousLane.laneSeed,
          consumed: true,
          consumedByGenerationId: previousLane.laneSeed.consumed === true
            ? previousLane.laneSeed.consumedByGenerationId
            : epochSeal.generationId ?? null
        }
      : null,
    sphParticleUpload: laneSphUpload || data.sphParticleUpload || null,
    mlsMpmParticleUpload: laneMlsUpload || data.mlsMpmParticleUpload || null,
    // W4b: the lane's advanced CPU-metadata clones (step/time/epoch words)
    // survive the per-step lane-record rebuild; the next mechanics step's
    // particlePingPong advances from them.
    sphParticleState: previousLane?.sphParticleState ?? null,
    mlsMpmParticleState: previousLane?.mlsMpmParticleState ?? null,
    // Immutable law inputs and their device-local uploads are lane lifetime
    // state, not epoch lifetime state. Preserve them across the per-step
    // epoch record rebuild so continuation schedules neither disable those
    // layers nor rematerialize the same sidecars.
    residentStepOptions: previousLane?.residentStepOptions ?? null,
    staticGpuResources: previousLane?.staticGpuResources ?? null,
    residentStep: previousLane?.residentStep ?? null,
    particleCount
  };
  const retainedRefDescriptors = {};
  if (generation.execution?.directoryBuffer) {
    retainedRefDescriptors.directoryBufferRef = retainGpuBuffer(
      record,
      stageId,
      'epochGeneration.execution.directoryBuffer',
      generation.execution.directoryBuffer
    );
  }
  if (generation.execution?.sourceBuffer) {
    retainedRefDescriptors.sourceBufferRef = retainGpuBuffer(
      record,
      stageId,
      'epochGeneration.execution.sourceBuffer',
      generation.execution.sourceBuffer
    );
  }
  if (levelAssignment?.assignmentBuffer) {
    retainedRefDescriptors.levelAssignmentBufferRef = retainGpuBuffer(
      record,
      stageId,
      'levelAssignment.assignmentBuffer',
      levelAssignment.assignmentBuffer
    );
  }
  return {
    schema: ULG_WORKER_SCHROEDER_SPATIAL_EPOCH_STAGE_SCHEMA,
    status: 'worker-schroeder-spatial-epoch-retained',
    backend: 'webgpu',
    readbackMode: data.readbackMode || null,
    // Diagnostic-only bracketed device interval of the epoch generation
    // (null unless residentGpuTimestampProfile=1).
    epochQueueIntervalMs,
    epochQueueTimeline,
    epochSeal,
    epochRetainedInLane: true,
    epochStepOrdinal: record.schroederLane.stepOrdinal,
    levelAssignmentSource,
    successorSourceFamilyConsumption: successorConsumption
      ? {
          began: true,
          consumerStage:
            'ulg-mechanics-resident-stage-worker-schroeder-spatial-epoch',
          sourceGenerationId:
            successorConsumption.sourceFamily?.sourceGenerationId ?? null,
          deviceId: successorConsumption.sourceFamily?.deviceId ?? null,
          levelAssignmentSealPresent:
            Boolean(successorConsumption.levelAssignmentSeal)
        }
      : null,
    generationSummary: {
      status: generation.status ?? null,
      directoryAbiVersion: generation.directoryAbiVersion ?? null,
      directoryBuildCount: generation.directoryBuildCount ?? null,
      mechanicsLevelCount: epochSeal.mechanicsLevelCount,
      mechanicsLevels: [...epochSeal.mechanicsLevels],
      arenaCapacity: generation.arenaCapacity ?? null,
      activeSourceCapacity: generation.activeSourceCapacity ?? null,
      directArenaCount: generation.directArenaCount ?? null,
      runtimeCacheHit: generation.runtimeCacheHit === true,
      particleCount
    },
    ...retainedRefDescriptors
  };
}

function compactWorkerPhaseVolumeSurfaceStressSubmission(step = null) {
  const submission = step?.gridUpdate?.phaseVolumeSurfaceStressSubmission
    ?? step?.phaseVolumeSurfaceStressSubmission
    ?? null;
  if (!submission) return null;
  return {
    schema: submission.schema ?? null,
    status: submission.status ?? null,
    requested: submission.requested === true,
    submitted: submission.submitted === true,
    dispatchCount: submission.dispatchCount ?? null,
    entryPoints: [...(submission.entryPoints || [])],
    lifecycleDispatchCount: submission.lifecycleDispatchCount ?? null,
    lifecycleMode: submission.lifecycleMode ?? null,
    ambientBuoyancyMode: submission.ambientBuoyancyMode ?? null,
    generationId: submission.generationId ?? null,
    selectedLevel: submission.selectedLevel ?? null,
    levelRole: submission.levelRole ?? null,
    twoLevel: submission.twoLevel === true,
    fieldCompletionOrdinal: submission.fieldCompletionOrdinal ?? null,
    materialTableSchema: submission.materialTableSchema ?? null,
    phaseRecordCount: submission.phaseRecordCount ?? null,
    positiveSurfaceTensionPhaseRecordCount:
      submission.positiveSurfaceTensionPhaseRecordCount ?? null,
    surfaceTensionCoefficientStatus:
      submission.surfaceTensionCoefficientStatus ?? null,
    authority: submission.authority ?? null,
    verification: submission.verification ?? null
  };
}

function compactWorkerResidentProductHistoryEvidence(step = null) {
  const residentProductMass = step?.nextParticleUploads?.residentProductMass
    ?? step?.residentProductMass
    ?? null;
  if (!residentProductMass) return null;
  const countAuthority = residentProductMass.productEventLiveCountAuthority
    ?? null;
  return {
    schema:
      'peercompute.ulg.worker-resident-product-history-evidence.v0',
    status: 'worker-resident-product-history-evidence-ready',
    residentProductMassStatus:
      step?.residentProductMassStatus
      ?? residentProductMass.status
      ?? null,
    productEventBufferRetained:
      residentProductMass.productEventBufferRetained === true,
    productEventBufferByteLength:
      residentProductMass.productEventBufferByteLength ?? null,
    productEventRowCount:
      residentProductMass.productEventRowCount ?? null,
    compactionStatus:
      residentProductMass.productEventCompactionStatus ?? null,
    gpuCommitStatus:
      residentProductMass.productEventGpuCommitStatus ?? null,
    arenaStatus:
      residentProductMass.productEventHistoryArenaStatus ?? null,
    generation: countAuthority?.generation ?? null,
    seal: countAuthority?.seal ?? null,
    gridCouplingStatus:
      step?.residentProductMassGridCouplingStatus ?? null,
    countAuthority:
      step?.residentProductMassInputProductEventCountAuthority ?? null,
    rowCapacity:
      step?.residentProductMassInputProductEventRowCapacity ?? null,
    countHostKnown:
      step?.residentProductMassInputProductEventCountHostKnown ?? null,
    dispatchMode:
      step?.residentProductMassProductEventDispatchMode ?? null
  };
}

function exactWorkerPhaseVolumeSurfaceStressSubmission(
  submission,
  { generationId = null, selectedLevel = null } = {}
) {
  return Boolean(
    submission?.schema
      === 'peercompute.ulg.schroeder-phase-volume-surface-stress-submission.v2'
    && submission?.status
      === 'eighteen-pass-central-bond-surface-stress-submitted-unverified'
    && submission.requested === true
    && submission.submitted === true
    && Number(submission.dispatchCount) === 18
    && Array.isArray(submission.entryPoints)
    && submission.entryPoints.join('|') === [
      'stage_surface_stress_x_even',
      'stage_surface_stress_x_odd',
      'stage_surface_stress_y_even',
      'stage_surface_stress_y_odd',
      'stage_surface_stress_z_even',
      'stage_surface_stress_z_odd',
      'stage_surface_stress_xy_positive_even',
      'stage_surface_stress_xy_positive_odd',
      'stage_surface_stress_xy_negative_even',
      'stage_surface_stress_xy_negative_odd',
      'stage_surface_stress_xz_positive_even',
      'stage_surface_stress_xz_positive_odd',
      'stage_surface_stress_xz_negative_even',
      'stage_surface_stress_xz_negative_odd',
      'stage_surface_stress_yz_positive_even',
      'stage_surface_stress_yz_positive_odd',
      'stage_surface_stress_yz_negative_even',
      'stage_surface_stress_yz_negative_odd'
    ].join('|')
    && Number(submission.lifecycleDispatchCount) === 21
    && submission.lifecycleMode
      === 'standalone-s9ab-initialize-ambient-eighteen-central-bonds-validate-commit'
    && submission.ambientBuoyancyMode
      === 'field-local-s9ab-current-volume-ambient-source'
    && submission.levelRole === 'single'
    && submission.twoLevel === false
    && Number(submission.fieldCompletionOrdinal) >= 1
    && Number(submission.phaseRecordCount) > 0
    && Number(submission.positiveSurfaceTensionPhaseRecordCount) > 0
    && submission.surfaceTensionCoefficientStatus
      === 'positive-surface-tension-coefficient-ready'
    && submission.verification === 'queue-submitted-no-full-readback'
    && submission.authority
      === 'exact-s9-phase-volume-moment-and-mechanics-material-records'
    && Number(submission.selectedLevel) === Number(selectedLevel)
    && (
      generationId == null
      || String(submission.generationId) === String(generationId)
    )
  );
}

async function runWorkerSchroederSameLevelMechanicsStage(data = {}) {
  const stageId = SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID;
  const record = workerSchroederLaneRecord(stageId, data);
  const device = workerSchroederStageDevice(stageId, data);
  const lane = record.schroederLane || null;
  if (!lane?.epochGeneration) {
    throw workerSchroederStageError(
      stageId,
      'lane-epoch-missing',
      'run a schroederSpatialEpoch stage in this lane before same-level mechanics'
    );
  }
  if (lane.epochConsumed === true) {
    throw workerSchroederStageError(
      stageId,
      'lane-epoch-already-consumed',
      'each retained spatial epoch generation feeds exactly one same-level mechanics step'
    );
  }
  const generation = lane.epochGeneration;
  const currentSeal = workerSchroederEpochSealFromGeneration(generation, device);
  if (!currentSeal) {
    throw workerSchroederStageError(
      stageId,
      'lane-epoch-not-ready',
      'the retained generation no longer reports a ready execution'
    );
  }
  if (
    currentSeal.deviceId !== currentSeal.consumerDeviceId
    || lane.deviceId !== currentSeal.consumerDeviceId
  ) {
    throw workerSchroederStageError(
      stageId,
      'epoch-device-mismatch',
      `retained epoch generation belongs to device ${
        currentSeal.deviceId ?? lane.deviceId ?? 'unknown'
      }, not the current worker lane device ${currentSeal.consumerDeviceId}`
    );
  }
  const retainedSealDrift = workerSchroederEpochSealMismatchFields(
    currentSeal,
    lane.epochSeal
  );
  if (retainedSealDrift.length > 0) {
    throw workerSchroederStageError(
      stageId,
      'epoch-seal-mismatch',
      `retained generation identity drifted on: ${retainedSealDrift.join(', ')}`
    );
  }
  const expectedSealMismatch = workerSchroederEpochSealMismatchFields(
    currentSeal,
    data.expectedSpatialEpochSeal || null
  );
  if (expectedSealMismatch.length > 0) {
    throw workerSchroederStageError(
      stageId,
      'epoch-seal-mismatch',
      `expectedSpatialEpochSeal does not match the retained generation on: ${expectedSealMismatch.join(', ')}`
    );
  }
  const enableTwoLevelMechanics = data.enableTwoLevelMechanics === true
    || currentSeal.mechanicsLevelCount > 1;
  const kernelRunner =
    typeof data.schroederSameLevelMechanicsRunner === 'function'
      ? data.schroederSameLevelMechanicsRunner
      : runSchroederSameLevelMechanicsWebGpu;
  const sphParticleUpload = lane.sphParticleUpload || data.sphParticleUpload || null;
  const mlsMpmParticleUpload =
    lane.mlsMpmParticleUpload || data.mlsMpmParticleUpload || null;
  // W4b: chained steps consume the lane's own advanced CPU-metadata clone
  // (step/time/epoch words) exactly as the direct scene loop consumes
  // nextSphParticleState per step; the payload's packed rows only seed the
  // first step of a fresh lane.
  const sphParticleStateForKernel =
    lane.sphParticleState || data.sphParticleState;
  const mlsMpmParticleStateForKernel =
    lane.mlsMpmParticleState || data.mlsMpmParticleState;
  const successorConsumption = lane.successorConsumption || null;
  // `data.residentStepOptions` is the clone-safe, schedule-seed snapshot. The
  // private schedule driver reuses that same payload for every ordinal, while
  // resident product mass is a live worker-local owner replaced after each
  // successful step. Preserve that exact dynamic handle when refreshing the
  // static law/material options; otherwise ordinal 2 silently restores the
  // seed-time (absent) value and drops product-history authority.
  const carriedResidentProductMassForOptionsRefresh =
    lane.residentStepOptions?.residentProductMass ?? null;
  if (data.residentStepOptions && typeof data.residentStepOptions === 'object') {
    // Static closure/law tables cross the boundary once with the first
    // schedule and remain lane-local thereafter, just like the particle
    // buffers. Materialize their immutable GPU sidecars once on THIS device;
    // otherwise the resident step would upload and destroy the same thermal
    // graph and mechanics phase table every step. A later schedule omitting
    // them must not disable law layers or trigger another upload.
    const previousOptions = lane.residentStepOptions || {};
    const requestedOptions = data.residentStepOptions;
    const mechanicsMaterialTable =
      requestedOptions.mechanicsMaterialTable
      ?? previousOptions.mechanicsMaterialTable
      ?? null;
    const thermalMaterialTable =
      requestedOptions.thermalMaterialTable
      ?? previousOptions.thermalMaterialTable
      ?? null;
    const staticGpuResources = lane.staticGpuResources || {};
    if (
      thermalMaterialTable
      && !staticGpuResources.thermalResponseGraphUpload
    ) {
      staticGpuResources.thermalResponseGraphUpload =
        uploadSphThermalResponseGraphBuffers(device, {
          thermalMaterialTable,
          thermalClosureGraphSet:
            requestedOptions.thermalStepOptions?.thermalClosureGraphSet
            || requestedOptions.reactionStepOptions?.thermalClosureGraphSet
            || previousOptions.thermalStepOptions?.thermalClosureGraphSet
            || previousOptions.reactionStepOptions?.thermalClosureGraphSet
            || null,
          thermalClosureGraphBank:
            requestedOptions.thermalStepOptions?.thermalClosureGraphBank
            || requestedOptions.reactionStepOptions?.thermalClosureGraphBank
            || previousOptions.thermalStepOptions?.thermalClosureGraphBank
            || previousOptions.reactionStepOptions?.thermalClosureGraphBank
            || null,
          thermalPhaseResponseTable:
            requestedOptions.thermalStepOptions?.thermalPhaseResponseTable
            || requestedOptions.reactionStepOptions?.thermalPhaseResponseTable
            || previousOptions.thermalStepOptions?.thermalPhaseResponseTable
            || previousOptions.reactionStepOptions?.thermalPhaseResponseTable
            || null
        });
    }
    if (
      mechanicsMaterialTable
      && !staticGpuResources.mechanicsMaterialPhaseUpload
    ) {
      staticGpuResources.mechanicsMaterialPhaseUpload =
        uploadMlsMpmMechanicsMaterialPhaseRecords(
          device,
          mechanicsMaterialTable
        );
    }
    lane.staticGpuResources = staticGpuResources;
    const thermalResponseGraphUpload =
      staticGpuResources.thermalResponseGraphUpload || null;
    lane.residentStepOptions = {
      ...previousOptions,
      ...requestedOptions,
      ...(thermalMaterialTable ? { thermalMaterialTable } : {}),
      ...(mechanicsMaterialTable ? { mechanicsMaterialTable } : {}),
      thermalStepOptions: {
        ...(previousOptions.thermalStepOptions || {}),
        ...(requestedOptions.thermalStepOptions || {}),
        ...(thermalResponseGraphUpload
          ? { thermalResponseGraphUpload }
          : {})
      },
      reactionStepOptions: {
        ...(previousOptions.reactionStepOptions || {}),
        ...(requestedOptions.reactionStepOptions || {}),
        ...(thermalResponseGraphUpload
          ? { thermalResponseGraphUpload }
          : {})
      },
      mechanicsRefreshOptions: {
        ...(previousOptions.mechanicsRefreshOptions || {}),
        ...(requestedOptions.mechanicsRefreshOptions || {}),
        ...(staticGpuResources.mechanicsMaterialPhaseUpload
          ? {
              mechanicsMaterialPhaseUpload:
                staticGpuResources.mechanicsMaterialPhaseUpload
            }
          : {})
      },
      ...(carriedResidentProductMassForOptionsRefresh
        ? {
            residentProductMass:
              carriedResidentProductMassForOptionsRefresh
          }
        : {})
    };
  }
  const retainedMechanicsMaterialTable =
    lane.residentStepOptions?.mechanicsMaterialTable ?? null;
  const retainedMechanicsMaterialPhaseUpload =
    lane.staticGpuResources?.mechanicsMaterialPhaseUpload ?? null;
  if (retainedMechanicsMaterialTable || retainedMechanicsMaterialPhaseUpload) {
    const diagnostics = diagnoseUploadedMechanicsMaterialPhaseRecordsMatch(
      retainedMechanicsMaterialPhaseUpload,
      retainedMechanicsMaterialTable,
      device
    );
    if (!diagnostics.matches) {
      const error = workerSchroederStageError(
        stageId,
        'static-mechanics-material-phase-authority-drift',
        Object.entries(diagnostics)
          .filter(([key, value]) => (
            key !== 'schema'
            && key !== 'matches'
            && typeof value === 'boolean'
            && value === false
          ))
          .map(([key]) => key)
          .join(', ')
      );
      error.authorityDiagnostics = Object.freeze({
        materialUpload: diagnostics
      });
      throw error;
    }
  }
  const residentStepOptions = lane.residentStepOptions || {};
  if (
    Object.prototype.hasOwnProperty.call(
      data,
      'stageMechanicsTraceEnabled'
    )
  ) {
    // Tracing is a schedule-scoped diagnostic. Static material/law options
    // cross only with the lane seed, so keeping this bit solely inside that
    // snapshot makes later diagnostic schedules silently readback-free.
    residentStepOptions.stageMechanicsTraceEnabled =
      data.stageMechanicsTraceEnabled === true;
  }
  const queueOrderedScheduleRetirement =
    workerResidentScheduleFenceDeferredStageData.has(data);
  const canonicalSingleLevelQueueOrderedCleanupRequested = Boolean(
    queueOrderedScheduleRetirement
    && !enableTwoLevelMechanics
    && data.enableMechanicsFieldPairV2 !== true
  );
  if (queueOrderedScheduleRetirement) {
    // The page's direct resident loop explicitly passes `summaryRunner: null`
    // on non-observation steps. Functions are not cloneable, so the worker
    // option selector deliberately omits that field; leaving it absent here
    // accidentally selects runMlsMpmResidentSummaryWebGpu's default and maps
    // a compact summary on every nominally no-readback schedule step. W2 owns
    // a zero-readback hot loop and publishes only its terminal queue fence, so
    // restore the exact no-summary contract inside the private schedule path.
    residentStepOptions.summaryRunner = null;
  }
  const previousResidentStep = lane.residentStep || null;
  const rawPreviousHierarchyTransferCleanupClaims = Array.isArray(
    previousResidentStep?.schroederHierarchyArtifactTransferCleanupClaims
  )
    ? previousResidentStep.schroederHierarchyArtifactTransferCleanupClaims
    : [];
  if (
    canonicalSingleLevelQueueOrderedCleanupRequested
    && rawPreviousHierarchyTransferCleanupClaims.length > 0
    && previousResidentStep?.canonicalSingleLevelQueueOrderedCleanupEligible
      !== true
  ) {
    // A previous exact hierarchy result that published transfer claims but
    // failed to seal its cleanup capability cannot be treated as claim-free.
    // Doing so would let the next step silently enter the generic host-fence
    // cleanup path and break the schedule's queue-ordered ownership chain.
    throw workerSchroederStageError(
      stageId,
      'schedule-prior-hierarchy-cleanup-authority-missing',
      'the prior canonical worker step retained hierarchy transfer claims without exact queue-ordered cleanup authority'
    );
  }
  const previousHierarchyTransferCleanupClaims =
    canonicalSingleLevelQueueOrderedCleanupRequested
    && previousResidentStep?.canonicalSingleLevelQueueOrderedCleanupEligible
      === true
      ? rawPreviousHierarchyTransferCleanupClaims
      : [];
  const previousCarriedResidentProductMassHandles = [
    previousResidentStep?.nextParticleUploads?.residentProductMass,
    previousResidentStep?.residentProductMass,
    lane.residentStepOptions?.residentProductMass
  ].filter(Boolean);
  const previousContinuationBuffers = retainedContinuationBuffersFromUploads(
    previousResidentStep?.nextParticleUploads
  );
  const spatialEpochTransaction =
    kernelRunner === runSchroederSameLevelMechanicsWebGpu
      ? createSchroederSameLevelMechanicsSpatialEpochTransaction({
          device,
          generation,
          sphParticleUpload,
          mlsMpmParticleUpload,
          residentStepOptions,
          twoLevelAuthoritative: Boolean(
            enableTwoLevelMechanics
            && String(data.twoLevelMechanicsAuthority || 'observation')
              .toLowerCase() === 'authoritative'
          )
        })
      : null;
  let kernelResult = null;
  let successorLeaseReleasePromise = null;
  try {
    kernelResult = await kernelRunner({
      device,
      queueOrderedProducerClaims: previousHierarchyTransferCleanupClaims,
      sphParticleState: sphParticleStateForKernel,
      mlsMpmParticleState: mlsMpmParticleStateForKernel,
      sphParticleUpload,
      mlsMpmParticleUpload,
      spatialEpochGeneration: generation,
      ...(spatialEpochTransaction
        ? { schroederSpatialEpochTransaction: spatialEpochTransaction }
        : {}),
      enableSpatialEpochGeneration: false,
      enableCanonicalSingleLevelQueueOrderedCleanup:
        canonicalSingleLevelQueueOrderedCleanupRequested,
      ...(successorConsumption?.levelAssignment
        ? {
            levelAssignment: successorConsumption.levelAssignment,
            levelAssignmentSourceFamily: successorConsumption.sourceFamily,
            levelAssignmentSourceFamilyLease:
              successorConsumption.sourceFamilyLease
          }
        : (lane.levelAssignment
            ? { levelAssignment: lane.levelAssignment }
            : {})),
      selectedLevel: data.selectedLevel ?? 0,
      ...(data.baseGridSpacingM != null
        ? { baseGridSpacingM: data.baseGridSpacingM }
        : {}),
      ...(data.minLevel != null ? { minLevel: data.minLevel } : {}),
      ...(data.maxLevel != null ? { maxLevel: data.maxLevel } : {}),
      ...(data.tileCellCount != null
        ? { tileCellCount: data.tileCellCount }
        : {}),
      enableTwoLevelMechanics,
      twoLevelMechanicsAuthority:
        data.twoLevelMechanicsAuthority
        || (enableTwoLevelMechanics ? 'authoritative' : 'observation'),
      ...(data.twoLevelFineSubstepCount != null
        ? { twoLevelFineSubstepCount: data.twoLevelFineSubstepCount }
        : {}),
      enableMechanicsFieldPairV2: data.enableMechanicsFieldPairV2 === true,
      // These hierarchy switches must be explicit across the worker boundary.
      // The hierarchy runner's historical defaults enable several stages;
      // letting an omitted false value inherit those defaults would make the
      // mounted controls and execution receipt disagree with the graph that
      // actually ran.
      enablePortableSummary: data.enablePortableSummary === true,
      enableActiveNodeIndex: data.enableActiveNodeIndex === true,
      enableActiveNodeSortedIndex:
        data.enableActiveNodeSortedIndex === true,
      ...(data.activeNodeSortedIndexPolicyMode
        ? {
            activeNodeSortedIndexPolicyMode:
              data.activeNodeSortedIndexPolicyMode
          }
        : {}),
      ...(data.lawNeighborTraversalPolicyMode
        ? {
            lawNeighborTraversalPolicyMode:
              data.lawNeighborTraversalPolicyMode
          }
        : {}),
      ...(data.lawNeighborCandidateReadbackMode
        ? {
            lawNeighborCandidateReadbackMode:
              data.lawNeighborCandidateReadbackMode
          }
        : {}),
      enableLawQueue: data.enableLawQueue === true,
      enableLawNeighborCandidates:
        data.enableLawNeighborCandidates === true,
      enableCrossLevelCoupling:
        data.enableCrossLevelCoupling === true,
      enablePhaseVolumeMigration:
        data.enablePhaseVolumeMigration === true,
      boxDimsM: data.boxDimsM ?? [5, 5, 5],
      ...(data.dt != null ? { dt: data.dt } : {}),
      ...(data.gravityMPerS2 != null
        ? { gravityMPerS2: data.gravityMPerS2 }
        : {}),
      ...(data.cflFactor != null ? { cflFactor: data.cflFactor } : {}),
      ...(data.readbackMode ? { readbackMode: data.readbackMode } : {}),
      residentStepOptions
    });
  } finally {
    if (successorConsumption) {
      // Mirror the scene loop: the successor-source lease releases only after
      // the exact consumer fence — the hierarchy owner completion when it is
      // offered, else this device queue's completion.
      let exactConsumerFence;
      const hierarchyOwnerCompletion =
        kernelResult?.schroederSpatialEpochReleasePromise;
      if (
        hierarchyOwnerCompletion
        && typeof hierarchyOwnerCompletion.then === 'function'
      ) {
        exactConsumerFence = Promise.resolve(hierarchyOwnerCompletion).then(
          (confirmed) => {
            if (confirmed !== true) {
              throw new Error(
                'Worker Schroeder hierarchy owner completion did not confirm successor-source consumption'
              );
            }
            return true;
          }
        );
      } else {
        try {
          exactConsumerFence = device.queue.onSubmittedWorkDone();
        } catch (error) {
          exactConsumerFence = Promise.reject(error);
        }
      }
      successorLeaseReleasePromise =
        successorConsumption.releaseAfter(exactConsumerFence);
      successorLeaseReleasePromise.catch(() => {});
      lane.successorLeaseReleasePromise = successorLeaseReleasePromise;
    }
  }
  const residentStep = kernelResult?.residentStep || null;
  if (!residentStep) {
    throw workerSchroederStageError(
      stageId,
      'resident-step-missing',
      'the same-level mechanics runner did not return a resident step'
    );
  }
  const nextUploads = residentStep.nextParticleUploads || null;
  const nextSphUpload = nextUploads?.sphParticleUpload ?? null;
  const nextMlsUpload = nextUploads?.mlsMpmParticleUpload ?? null;
  const nextSuccessorSourceFamily =
    residentStep.schroederSpatialSuccessorSourceFamily
    ?? nextUploads?.schroederSpatialSuccessorSourceFamily
    ?? kernelResult.schroederSpatialSuccessorSourceFamily
    ?? null;
  const carriedResidentProductMass =
    nextUploads?.residentProductMass ?? residentStep.residentProductMass ?? null;
  const currentHierarchyTransferCleanupClaims = Array.isArray(
    residentStep.schroederHierarchyArtifactTransferCleanupClaims
  )
    ? residentStep.schroederHierarchyArtifactTransferCleanupClaims
    : [];
  const currentCanonicalCleanupEligible = Boolean(
    kernelResult?.canonicalSingleLevelQueueOrderedCleanupEligible === true
    && residentStep.canonicalSingleLevelQueueOrderedCleanupEligible === true
  );
  const realCanonicalScheduleCleanupRequired = Boolean(
    canonicalSingleLevelQueueOrderedCleanupRequested
    && kernelRunner === runSchroederSameLevelMechanicsWebGpu
  );
  if (
    canonicalSingleLevelQueueOrderedCleanupRequested
    && !currentCanonicalCleanupEligible
    && (
      realCanonicalScheduleCleanupRequired
      || currentHierarchyTransferCleanupClaims.length > 0
    )
  ) {
    // Exact W2 may not admit a real canonical step whose hierarchy cleanup
    // authority failed to seal. Preserve the previously committed lane
    // inputs while conservatively tearing down only this unadopted result.
    restoreWorkerContinuationSidecarOwnership({
      sourceUploads: { sphParticleUpload, mlsMpmParticleUpload },
      unadoptedUploads: nextUploads
    });
    destroyMlsMpmResidentStepBuffers(residentStep, {
      preserveResidentProductMass:
        previousCarriedResidentProductMassHandles[0] ?? null,
      preserveResidentProductMassHandles:
        previousCarriedResidentProductMassHandles,
      destroyInputResidentProductMass: true,
      preserveBuffers: previousContinuationBuffers
    });
    throw workerSchroederStageError(
      stageId,
      'schedule-hierarchy-cleanup-authority-missing',
      'the canonical worker step did not seal exact queue-ordered hierarchy cleanup authority'
    );
  }
  const currentHierarchyFinalConsumer =
    canonicalSingleLevelQueueOrderedCleanupRequested
    && currentCanonicalCleanupEligible
      ? kernelResult.queueOrderedFinalConsumerCapability ?? null
      : null;
  if (
    previousHierarchyTransferCleanupClaims.length > 0
    && currentHierarchyFinalConsumer == null
  ) {
    // The current step has already submitted, but without its authenticated
    // final-consumer capability it cannot retire the previous hierarchy
    // transfer claims queue-ordered. Tear down the unadopted result through
    // the conservative path, then fail the schedule closed; its terminal
    // fence remains the admission boundary for all submitted cleanup.
    restoreWorkerContinuationSidecarOwnership({
      sourceUploads: { sphParticleUpload, mlsMpmParticleUpload },
      unadoptedUploads: nextUploads
    });
    destroyMlsMpmResidentStepBuffers(residentStep, {
      preserveResidentProductMass:
        previousCarriedResidentProductMassHandles[0] ?? null,
      preserveResidentProductMassHandles:
        previousCarriedResidentProductMassHandles,
      destroyInputResidentProductMass: true,
      preserveBuffers: previousContinuationBuffers
    });
    throw workerSchroederStageError(
      stageId,
      'schedule-hierarchy-final-consumer-capability-missing',
      'the canonical worker step did not return authority to retire prior hierarchy transfers'
    );
  }
  if (previousResidentStep) {
    // buildNextParticleUploads has already transferred identity and immutable
    // material-bank sidecar ownership to `residentStep`. If predecessor
    // cleanup fails, retain that uncommitted successor on the poisoned record
    // rather than dropping its only owner or partially advancing the lane.
    try {
      destroyMlsMpmResidentStepBuffers(previousResidentStep, {
        preserveResidentProductMass: carriedResidentProductMass,
        preserveResidentProductMassHandles: [
          residentStep.emittedResidentProductMass,
          carriedResidentProductMass
        ].filter(Boolean),
        destroyInputResidentProductMass: true,
        preserveBuffers: retainedContinuationBuffersFromUploads(nextUploads),
        queueOrderedFinalConsumer: currentHierarchyFinalConsumer
      });
    } catch (error) {
      record.poisonedCanonicalResidentStep = residentStep;
      poisonWorkerResidentScheduleLane(record, {
        reason: 'previous-resident-step-cleanup-failed'
      });
      throw workerSchroederStageError(
        stageId,
        'previous-resident-step-cleanup-failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  // Commit every owner-bearing continuation pointer as one non-throwing
  // adoption step after predecessor cleanup succeeds.
  lane.residentStep = residentStep;
  lane.sphParticleUpload = nextSphUpload;
  lane.mlsMpmParticleUpload = nextMlsUpload;
  // A batched schedule has one host-visible fence at its terminal boundary.
  // Its normal success path can retire this generation synchronously because
  // every final consumer has already been submitted to the same ordered queue;
  // standalone W1 calls and exceptional cleanup retain the conservative fence.
  let epochReleaseScheduled = false;
  let epochReleaseMode = null;
  if (queueOrderedScheduleRetirement) {
    try {
      if (
        canReleaseSchroederSpatialEpochGenerationQueueOrderedAfterFinalConsumer(
          generation,
          device
        )
      ) {
        epochReleaseScheduled =
          releaseSchroederSpatialEpochGenerationQueueOrderedAfterFinalConsumer(
            generation,
            device
          ) === true;
        epochReleaseMode =
          'queue-ordered-after-final-consumer-no-host-fence';
      } else if (
        generation.releaseScheduled === true
        || generation.releasePromise != null
        || generation.execution?.released === true
        || kernelResult.schroederSpatialEpochReleasePromise != null
      ) {
        epochReleaseScheduled = true;
        epochReleaseMode = 'already-retired-by-hierarchy-owner';
      } else {
        throw new Error(
          'the exact generation did not expose queue-ordered retirement authority'
        );
      }
    } catch (error) {
      throw workerSchroederStageError(
        stageId,
        'schedule-queue-ordered-epoch-retirement-failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  } else {
    epochReleaseScheduled =
      releaseSchroederSpatialEpochGenerationAfterQueue(generation, device)
        === true;
    epochReleaseMode = 'host-queue-fence-after-final-consumer';
  }
  lane.epochConsumed = true;
  lane.epochReleaseScheduled = epochReleaseScheduled;
  lane.epochReleasePromise = generation.releasePromise ?? null;
  lane.successorConsumption = null;
  lane.levelAssignment = null;
  lane.activeNodeList = null;
  lane.successorSourceFamily = nextSuccessorSourceFamily;
  lane.executionMode = 'canonical-schroeder';
  lane.tier0ContinuationIdentity = null;
  lane.particleCount = nextSphUpload?.particleCount ?? lane.particleCount ?? null;
  // The canonical SS closure can replace thermo storage during reaction and
  // phase-carrier transfer. Keep the lane's explicit diagnostic source on the
  // exact post-step buffer instead of the seed-time upload; otherwise a
  // terminal snapshot either reads stale thermo rows or fails because the
  // seed upload was not recorded as COPY_SRC-capable. This is metadata-only:
  // normal resident schedules still perform no particle readback.
  if (nextSphUpload?.thermoBuffer) {
    record.retainedThermoBuffer = nextSphUpload.thermoBuffer;
    record.retainedThermoBufferByteLength = positiveByteLength(
      nextSphUpload.thermoBufferByteLength,
      nextSphUpload.thermoBuffer.size,
      (nextSphUpload.particleCount ?? lane.particleCount ?? 0)
        * SPH_GPU_PARTICLE_THERMO_FLOATS
        * Float32Array.BYTES_PER_ELEMENT
    );
    record.retainedThermoBufferSourceStage = stageId;
    record.retainedThermoBufferSeededFromCpu = false;
    record.retainedThermoBufferCopySrc = Boolean(
      (Number(nextSphUpload.thermoBuffer.usage) & GPU_BUFFER_USAGE.COPY_SRC)
        === GPU_BUFFER_USAGE.COPY_SRC
    );
    record.retainedThermoSnapshotRows = null;
  }
  // Product mass is dynamic lane state. Carry the exact worker-local owner
  // into the next step so reaction placement can merge/retire it through its
  // normal final-consumer path. Leaving the seed-time null here allocated a
  // fresh warm arena every step and stranded the first three owners.
  lane.residentStepOptions = {
    ...(lane.residentStepOptions || {}),
    residentProductMass:
      carriedResidentProductMass
      ?? lane.residentStepOptions?.residentProductMass
      ?? null
  };
  // W4b: retain the kernel's advanced CPU-metadata clones so the NEXT step's
  // particlePingPong (physicsTick, time) advances truthfully — worker-local
  // only, never returned across the message boundary.
  let nextParticleStateCloneError = null;
  try {
    lane.sphParticleState = residentStep.nextSphParticleState
      ?? (sphParticleStateForKernel
        ? cloneSphParticleStateForNext(sphParticleStateForKernel, residentStep)
        : null);
    lane.mlsMpmParticleState = residentStep.nextMlsMpmParticleState
      ?? (mlsMpmParticleStateForKernel
        ? cloneMlsMpmParticleStateForNext(
            mlsMpmParticleStateForKernel,
            residentStep
          )
        : null);
  } catch (cloneError) {
    // A metadata clone failure must not fail the completed step; the next
    // step fails closed truthfully if its inputs are incomplete — and the
    // failure is REPORTED, never swallowed.
    nextParticleStateCloneError =
      cloneError instanceof Error ? cloneError.message : String(cloneError);
    lane.sphParticleState = lane.sphParticleState ?? null;
    lane.mlsMpmParticleState = lane.mlsMpmParticleState ?? null;
  }
  const postStepRefs = {};
  if (nextSphUpload?.stateBuffer) {
    postStepRefs.stateBufferRef = retainGpuBuffer(
      record,
      stageId,
      'nextParticleUploads.sphParticleUpload.stateBuffer',
      nextSphUpload.stateBuffer
    );
  }
  if (nextSphUpload?.thermoBuffer) {
    postStepRefs.thermoBufferRef = retainGpuBuffer(
      record,
      stageId,
      'nextParticleUploads.sphParticleUpload.thermoBuffer',
      nextSphUpload.thermoBuffer
    );
  }
  if (nextSphUpload?.identityBuffer) {
    postStepRefs.identityBufferRef = retainGpuBuffer(
      record,
      stageId,
      'nextParticleUploads.sphParticleUpload.identityBuffer',
      nextSphUpload.identityBuffer
    );
  }
  if (nextMlsUpload?.mechanicsBuffer) {
    postStepRefs.mechanicsBufferRef = retainGpuBuffer(
      record,
      stageId,
      'nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer',
      nextMlsUpload.mechanicsBuffer
    );
  }
  const summaryOf = (candidate) => {
    if (typeof candidate === 'function') {
      try {
        return candidate() ?? null;
      } catch {
        return null;
      }
    }
    return candidate ?? null;
  };
  const residentStageTiming = residentStep.stageTiming
    && typeof residentStep.stageTiming === 'object'
    ? {
        schema: residentStep.stageTiming.schema ?? null,
        totalMs: Number.isFinite(residentStep.stageTiming.totalMs)
          ? residentStep.stageTiming.totalMs
          : null,
        stageMs: Object.fromEntries(
          Object.entries(residentStep.stageTiming.stageMs || {})
            .filter(([, elapsedMs]) => Number.isFinite(elapsedMs))
        ),
        // Device-side pass timestamps (null when profiling is inert). The
        // stageMs host-enqueue entries above are literal zeros for work
        // encoded inside the fused sequence; these are the real durations.
        stageGpuMs: residentStep.stageTiming.stageGpuMs ?? null,
        gpuTimestampProfile:
          residentStep.stageTiming.gpuTimestampProfile ?? null,
        compactSummaryRequested:
          residentStep.stageTiming.compactSummaryRequested === true,
        compactSummaryMapAsyncWaitMs: Number.isFinite(
          residentStep.stageTiming.queueFenceMs?.compactSummaryMapAsync
        )
          ? residentStep.stageTiming.queueFenceMs.compactSummaryMapAsync
          : null,
        residentQueueFenceStatus:
          residentStep.stageTiming.queueFenceStatus?.fusedMechanicsSequence
          ?? null,
        residentQueueFenceMethod:
          residentStep.stageTiming.queueFenceMethod?.fusedMechanicsSequence
          ?? null
      }
    : null;
  const rawTerminalRefluxReceiptCopy =
    residentStep.twoLevelTerminalRefluxReceiptCopy ?? null;
  const terminalRefluxReceiptCopy = rawTerminalRefluxReceiptCopy
    ? { ...rawTerminalRefluxReceiptCopy }
    : null;
  const twoLevelCflFactorCandidate =
    kernelResult?.twoLevelMechanics?.cflFactor
    ?? residentStep.twoLevelCflFactor;
  const twoLevelCflFactor = Number.isFinite(
    Number(twoLevelCflFactorCandidate)
  )
    ? Number(twoLevelCflFactorCandidate)
    : null;
  const hierarchyConfigSummary = data.hierarchyConfig
    && typeof data.hierarchyConfig === 'object'
    ? {
        schema: data.hierarchyConfig.schema ?? null,
        status: data.hierarchyConfig.status ?? null,
        signature: data.hierarchyConfig.signature ?? null,
        selectedLevel: data.hierarchyConfig.selectedLevel ?? null,
        minLevel: data.hierarchyConfig.minLevel ?? null,
        maxLevel: data.hierarchyConfig.maxLevel ?? null,
        enableTwoLevelMechanics:
          data.hierarchyConfig.enableTwoLevelMechanics === true,
        twoLevelMechanicsAuthority:
          data.hierarchyConfig.twoLevelMechanicsAuthority ?? null,
        twoLevelFineSubstepCount:
          data.hierarchyConfig.twoLevelFineSubstepCount ?? null,
        enableMechanicsFieldPairV2:
          data.hierarchyConfig.enableMechanicsFieldPairV2 === true,
        enablePortableSummary:
          data.hierarchyConfig.enablePortableSummary === true,
        enableActiveNodeIndex:
          data.hierarchyConfig.enableActiveNodeIndex === true,
        enableActiveNodeSortedIndex:
          data.hierarchyConfig.enableActiveNodeSortedIndex === true,
        enableLawQueue: data.hierarchyConfig.enableLawQueue === true,
        enableLawNeighborCandidates:
          data.hierarchyConfig.enableLawNeighborCandidates === true,
        enableCrossLevelCoupling:
          data.hierarchyConfig.enableCrossLevelCoupling === true,
        enablePhaseVolumeMigration:
          data.hierarchyConfig.enablePhaseVolumeMigration === true
      }
    : null;
  const hierarchyStageSummary = {
    schema: 'peercompute.ulg.worker-schroeder-hierarchy-stage-summary.v0',
    status: 'worker-schroeder-hierarchy-stage-summary-ready',
    hierarchyConfig: hierarchyConfigSummary
      ? { ...hierarchyConfigSummary }
      : null,
    mechanicsLevelCount: currentSeal.mechanicsLevelCount ?? null,
    twoLevelMechanicsEnabled: enableTwoLevelMechanics,
    twoLevelMechanicsAuthority:
      data.twoLevelMechanicsAuthority
      || (enableTwoLevelMechanics ? 'authoritative' : 'observation'),
    residentStepStatus: residentStep.status ?? null,
    // Opt-in cleanup-profile diagnostic (contactCleanupProfileReadback=1):
    // named here explicitly because the summary is a whitelist — an unnamed
    // step field never crosses the worker boundary.
    matchingCleanupProfile: residentStep.matchingCleanupProfile
      ? { ...residentStep.matchingCleanupProfile }
      : null,
    twoLevelFineSubstepCount:
      residentStep.twoLevelFineSubstepCount ?? null,
    twoLevelCflFactor,
    twoLevelAuthoritativeCommitVerified:
      residentStep.twoLevelAuthoritativeCommitVerified === true,
    terminalRefluxReceiptCopy: terminalRefluxReceiptCopy
      ? { ...terminalRefluxReceiptCopy }
      : null,
    mechanicsFieldPairV2Enabled:
      kernelResult.mechanicsFieldPairV2Enabled === true,
    mechanicsFieldConstructionMode:
      kernelResult.mechanicsFieldConstructionMode ?? null,
    lawQueueStatus: kernelResult.lawQueueStatus ?? null,
    lawQueueConsumerStatus:
      kernelResult.lawQueueConsumerStatus ?? null,
    lawNeighborCandidateStatus:
      kernelResult.lawNeighborCandidateStatus ?? null,
    lawNeighborCandidateConsumerStatus:
      kernelResult.lawNeighborCandidateConsumerStatus ?? null,
    crossLevelCouplingStatus:
      kernelResult.crossLevelCouplingStatus ?? null,
    conservativeTransferStatus:
      kernelResult.conservativeTransferStatus ?? null,
    stateMutationStatus: kernelResult.stateMutationStatus ?? null,
    stateAuthorityStatus: kernelResult.stateAuthorityStatus ?? null,
    phaseVolumeMigrationStatus:
      kernelResult.phaseVolumeMigrationStatus ?? null,
    phaseVolumeLevelUpdateStatus:
      kernelResult.phaseVolumeLevelUpdateStatus ?? null,
    pressureInterfaceOwnerScopeStatus:
      kernelResult.pressureInterfaceOwnerScopeStatus ?? null,
    residentStageStatus: { ...(residentStep.stageStatus || {}) },
    residentStageBackends: { ...(residentStep.stageBackends || {}) },
    staticGpuTableUploadStatus: {
      thermalResponseGraph:
        lane.staticGpuResources?.thermalResponseGraphUpload?.status ?? null,
      mechanicsMaterialPhase:
        lane.staticGpuResources?.mechanicsMaterialPhaseUpload?.status ?? null,
      retainedAcrossSteps: Boolean(lane.staticGpuResources)
    },
    postMechanicsClosure: residentStep.postMechanicsClosure ? {
      schema: residentStep.postMechanicsClosure.schema ?? null,
      status: residentStep.postMechanicsClosure.status ?? null,
      backend: residentStep.postMechanicsClosure.backend ?? null,
      executedStageOrder: [
        ...(residentStep.postMechanicsClosure.executedStageOrder || [])
      ],
      thermalStatus:
        residentStep.postMechanicsClosure.thermalStep?.result?.status
        ?? residentStep.postMechanicsClosure.thermalStep?.status
        ?? null,
      reactionStatus:
        residentStep.postMechanicsClosure.reactionStep?.result?.status
        ?? residentStep.postMechanicsClosure.reactionStep?.status
        ?? null,
      mechanicsRefreshStatus:
        residentStep.postMechanicsClosure.mechanicsRefreshStep?.result?.status
        ?? residentStep.postMechanicsClosure.mechanicsRefreshStep?.status
        ?? null,
      phaseCarrierTransferStatus:
        residentStep.postMechanicsClosure.phaseCarrierTransferStep?.result
          ?.status
        ?? residentStep.postMechanicsClosure.phaseCarrierTransferStep?.status
        ?? null,
      fullParticleReadbackFree:
        residentStep.postMechanicsClosure.fullParticleReadbackFree === true,
      residentContinuationReady:
        residentStep.postMechanicsClosure.residentContinuationReady === true
    } : null,
    thermalRequested: Boolean(residentStepOptions.thermalMaterialTable),
    reactionRequested:
      Number(residentStepOptions.reactionTable?.reactionCount) > 0,
    phaseVolumeSurfaceStressRequired:
      residentStepOptions.mechanicsMaterialTable?.surfaceTensionEnabled === true,
    phaseVolumeSurfaceStressSubmission:
      compactWorkerPhaseVolumeSurfaceStressSubmission(residentStep),
    phaseVolumeSurfaceStressSubmissionExact:
      exactWorkerPhaseVolumeSurfaceStressSubmission(
        compactWorkerPhaseVolumeSurfaceStressSubmission(residentStep),
        {
          generationId: currentSeal.generationId ?? null,
          selectedLevel: kernelResult.selectedLevel ?? data.selectedLevel ?? 0
        }
      ),
    // Fixed-size, clone-safe proof of the worker-private retained product
    // owner. The page never receives its GPUBuffer handles; this receipt is
    // sufficient for visual/runtime gates to correlate P2G consumption with
    // the independently authenticated resident render candidate.
    residentProductHistory:
      compactWorkerResidentProductHistoryEvidence(residentStep),
    // Diagnostic-only, cloneable fixed-size receipts. These are null on the
    // normal readback-free route and are retained only for the terminal step
    // when stageMechanicsTraceEnabled was explicitly requested.
    stageMechanicsTraceRequested:
      residentStepOptions.stageMechanicsTraceEnabled === true,
    stageMechanicsTrace: residentStep.stageMechanicsTrace ?? null,
    canonicalSpatialAuthorityTrace:
      residentStep.canonicalSpatialAuthorityTrace ?? null,
    fullParticleReadbackPerformed:
      residentStep.fullParticleReadbackPerformed === true,
    fullParticleReadbackFree:
      residentStep.fullParticleReadbackFree === true,
    residentStageTiming
  };
  return {
    schema: ULG_WORKER_SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_SCHEMA,
    status: 'worker-schroeder-same-level-mechanics-completed',
    backend: residentStep.backend || 'webgpu',
    readbackMode: residentStep.readbackMode ?? data.readbackMode ?? null,
    epochSeal: currentSeal,
    epochConsumed: true,
    epochReleaseScheduled,
    epochReleaseMode,
    residentStepSummary: {
      backend: residentStep.backend ?? null,
      status: residentStep.status ?? null,
      hierarchyConfig: hierarchyConfigSummary
        ? { ...hierarchyConfigSummary }
        : null,
      stageStatus: { ...(residentStep.stageStatus || {}) },
      stageBackends: { ...(residentStep.stageBackends || {}) },
      readbackMode: residentStep.readbackMode ?? null,
      twoLevelMechanicsEnabled: enableTwoLevelMechanics,
      mechanicsLevelCount: currentSeal.mechanicsLevelCount ?? null,
      twoLevelMechanicsAuthority:
        residentStep.twoLevelMechanicsAuthority
        ?? data.twoLevelMechanicsAuthority
        ?? (enableTwoLevelMechanics ? 'authoritative' : 'observation'),
      twoLevelFineSubstepCount:
        residentStep.twoLevelFineSubstepCount ?? null,
      twoLevelCflFactor,
      twoLevelMechanicsStatus:
        residentStep.twoLevelMechanicsStatus
        ?? residentStep.stageStatus?.twoLevelMechanics
        ?? null,
      twoLevelAuthoritativeCommitVerified:
        residentStep.twoLevelAuthoritativeCommitVerified === true,
      terminalRefluxReceiptCopy: terminalRefluxReceiptCopy
        ? { ...terminalRefluxReceiptCopy }
        : null,
      phaseVolumeSurfaceStressRequired:
        hierarchyStageSummary.phaseVolumeSurfaceStressRequired,
      phaseVolumeSurfaceStressSubmission:
        hierarchyStageSummary.phaseVolumeSurfaceStressSubmission,
      phaseVolumeSurfaceStressSubmissionExact:
        hierarchyStageSummary.phaseVolumeSurfaceStressSubmissionExact,
      stageMechanicsTrace: hierarchyStageSummary.stageMechanicsTrace,
      canonicalSpatialAuthorityTrace:
        hierarchyStageSummary.canonicalSpatialAuthorityTrace,
      particleCount: nextSphUpload?.particleCount
        ?? data?.sphParticleState?.particleCount
        ?? null,
      nextParticleStateRetained: Boolean(lane.sphParticleState),
      nextParticleStateStep: lane.sphParticleState?.step ?? null,
      nextParticleStateCloneError
    },
    schroederSummary: {
      status: kernelResult.status ?? null,
      selectedLevel: kernelResult.selectedLevel ?? data.selectedLevel ?? 0,
      spatialEpochGenerationSummary: summaryOf(
        kernelResult.currentSchroederSpatialEpochGenerationSummary
      ),
      spatialEpochTransactionSummary: summaryOf(
        kernelResult.currentSchroederSpatialEpochTransactionSummary
      )
    },
    hierarchyStageSummary,
    successorSourceFamilyRetirement: successorConsumption
      ? {
          leaseReleaseScheduled: successorLeaseReleasePromise != null,
          sourceGenerationId:
            successorConsumption.sourceFamily?.sourceGenerationId ?? null
        }
      : null,
    postStep: {
      particleCount: nextSphUpload?.particleCount ?? null,
      successorSourceFamilyRetained: Boolean(nextSuccessorSourceFamily),
      successorSourceGenerationId:
        nextSuccessorSourceFamily?.sourceGenerationId ?? null,
      ...postStepRefs
    }
  };
}

// --- SS worker-side batched schedule driver (refactor increment W2) ---
//
// One 'run-resident-schedule' message loops the W1 stage pair — a fresh
// schroederSpatialEpoch, then the schroederSameLevelMechanics step that
// consumes it — stepCount times on ONE lane, through direct internal calls to
// runUlgMechanicsResidentStageWorkerPayload (never postMessage-to-self). This
// realizes plan/todo/ss-regression.md correction 1 worker-side: amortization
// returns as a batch while every step still builds and seals its own
// generation, so an immutable generation is never reused across an invalid
// position epoch. The driver asserts per step that the new seal's
// positionEpoch/physicsTick words strictly advance versus the prior step and
// fails closed with 'epoch-identity-regressed' otherwise.
//
// Concurrency choice: schedules are exclusive PER LANE ('lane-schedule-
// already-active' fail-closed); schedules on DIFFERENT lanes may interleave.
// That interleaving is trivially safe with the current structure because all
// SS lane state lives on the per-laneKey record (retainedLanes) and single
// 'run-resident-stage' messages from different lanes already interleave the
// same way through the message listener; the only shared module state the
// stage path touches is the memoized worker device promise, which is already
// shared by the single-stage path.
// Deliberately do not globally serialize independent lanes: per-lane
// ComputeManager leases prevent conflicting ownership, lane records isolate
// mutable state, and the single WebGPU queue preserves submission order. This
// allows independent lanes to make progress on high-concurrency hardware
// without permitting concurrent schedules to mutate one lane.
//
// Cancellation ('cancel-resident-schedule') sets a flag the loop checks only
// BETWEEN steps: the in-flight step always completes and releases per W1
// semantics, then the driver posts a terminal result with cancelled: true and
// the truthful completedStepCount. Internal stage dependencies stay on the
// worker's ordered GPU queue; bounded non-authoritative drain checkpoints keep
// the browser/Dawn queue live, and one required host-visible fence authenticates
// the whole schedule at terminal. A real task yield between steps keeps
// cancellation deliverable without using a GPU fence as an event-loop yield.

const SCHROEDER_EPOCH_ADVANCING_IDENTITY_WORD_FIELDS = Object.freeze([
  'physicsTick',
  'positionEpoch'
]);
const activeWorkerResidentScheduleByLaneKey = new Map();
const activeWorkerResidentScheduleByCancelKey = new Map();
const WORKER_RESIDENT_SCHEDULE_FENCE_DEFERRAL_TOKEN = Object.freeze({});
const WORKER_RESIDENT_SCHEDULE_PRIVATE_STAGE_RESULT_SCHEMA =
  'peercompute.ulg.worker-resident-schedule-private-stage-result.v0';
const WORKER_RESIDENT_SCHEDULE_PRIVATE_RETURN_STAGE_IDS = Object.freeze(
  new Set([
    SCHROEDER_SPATIAL_EPOCH_STAGE_ID,
    SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID
  ])
);
let workerResidentScheduleOrdinal = 1;

function workerResidentScheduleError(reason, detail = null, {
  scheduleId = null,
  stepOrdinal = null,
  stageId = null,
  laneState = null
} = {}) {
  const message = `Worker resident schedule failed closed: ${reason}${
    detail ? ` (${detail})` : ''
  }`;
  const error = new Error(message);
  error.code = `ERR_ULG_WORKER_RESIDENT_SCHEDULE_${
    reason.replace(/-/g, '_').toUpperCase()
  }`;
  error.reason = reason;
  error.residentScheduleError = {
    schema: ULG_WORKER_RESIDENT_SCHEDULE_ERROR_SCHEMA,
    scheduleId,
    stepOrdinal,
    stageId,
    reason,
    message,
    laneState
  };
  return error;
}

function privateWorkerResidentScheduleStageRefDescriptors(
  stageId,
  rawResult = null
) {
  if (stageId === SCHROEDER_SPATIAL_EPOCH_STAGE_ID) {
    return [
      [
        rawResult?.directoryBufferRef,
        'epochGeneration.execution.directoryBuffer'
      ],
      [
        rawResult?.sourceBufferRef,
        'epochGeneration.execution.sourceBuffer'
      ],
      [
        rawResult?.levelAssignmentBufferRef,
        'levelAssignment.assignmentBuffer'
      ]
    ];
  }
  if (stageId === SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID) {
    return [
      [
        rawResult?.postStep?.stateBufferRef,
        'nextParticleUploads.sphParticleUpload.stateBuffer'
      ],
      [
        rawResult?.postStep?.thermoBufferRef,
        'nextParticleUploads.sphParticleUpload.thermoBuffer'
      ],
      [
        rawResult?.postStep?.identityBufferRef,
        'nextParticleUploads.sphParticleUpload.identityBuffer'
      ],
      [
        rawResult?.postStep?.mechanicsBufferRef,
        'nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer'
      ]
    ];
  }
  return [];
}

function privateWorkerResidentScheduleStageResult({
  stageId,
  rawResult,
  record,
  payload,
  callLaneKey,
  activeSchedule,
  workerQueueFence
} = {}) {
  const laneId = normalizeString(
    payload?.lease?.laneId ?? payload?.lane?.laneId,
    null
  );
  const stateKey = normalizeString(
    payload?.lease?.stateKey ?? payload?.lane?.stateKey,
    null
  );
  if (
    !activeSchedule
    || activeSchedule.laneKey !== callLaneKey
    || record?.key !== callLaneKey
    || !WORKER_RESIDENT_SCHEDULE_PRIVATE_RETURN_STAGE_IDS.has(stageId)
  ) {
    throw workerResidentScheduleError(
      'schedule-private-stage-authority-invalid',
      `${stageId || 'unknown-stage'} is not owned by the active worker schedule lane`,
      {
        scheduleId: activeSchedule?.scheduleId ?? null,
        stageId
      }
    );
  }
  const retainedBufferRefs = [];
  for (const [descriptor, expectedPath] of
    privateWorkerResidentScheduleStageRefDescriptors(stageId, rawResult)) {
    if (
      descriptor?.schema
        !== 'peercompute.ulg.worker-retained-buffer-ref.v0'
      || descriptor.stageId !== stageId
      || descriptor.path !== expectedPath
      || normalizeString(descriptor.ref, null) == null
      || record.retainedBuffers.has(descriptor.ref) !== true
    ) {
      throw workerResidentScheduleError(
        'schedule-private-stage-retained-ref-invalid',
        `${stageId} did not retain its exact ${expectedPath} descriptor`,
        {
          scheduleId: activeSchedule.scheduleId,
          stageId
        }
      );
    }
    retainedBufferRefs.push(descriptor.ref);
  }
  const exactRetainedBufferRefs = [...new Set(retainedBufferRefs)];
  const privateStageReceipt = Object.freeze({
    schema: WORKER_RESIDENT_SCHEDULE_PRIVATE_STAGE_RESULT_SCHEMA,
    status: 'worker-resident-schedule-private-stage-result-ready',
    stageId,
    scheduleId: activeSchedule.scheduleId,
    laneId,
    stateKey,
    cloneableResultReturned: false,
    copyBudgetComputed: false,
    gasPressureTransportGraphInspected: false,
    retainedRefEnumeration: 'canonical-stage-descriptors',
    retainedBufferRefCount: exactRetainedBufferRefs.length,
    retainedBufferRegistryEntryCount: record.retainedBuffers.size
  });
  const commonValue = {
    schema: rawResult?.schema ?? null,
    status: rawResult?.status ?? null,
    backend: rawResult?.backend ?? null,
    readbackMode: rawResult?.readbackMode ?? null,
    gpuFence: rawResult?.gpuFence ?? workerQueueFence ?? null,
    workerResidentStage: privateStageReceipt
  };
  const value = stageId === SCHROEDER_SPATIAL_EPOCH_STAGE_ID
    ? {
        ...commonValue,
        epochQueueIntervalMs: rawResult?.epochQueueIntervalMs ?? null,
        epochQueueTimeline: rawResult?.epochQueueTimeline ?? null,
        epochSeal: rawResult?.epochSeal ?? null,
        epochStepOrdinal: rawResult?.epochStepOrdinal ?? null,
        levelAssignmentSource: rawResult?.levelAssignmentSource ?? null
      }
    : {
        ...commonValue,
        epochConsumed: rawResult?.epochConsumed === true,
        epochReleaseScheduled: rawResult?.epochReleaseScheduled === true,
        epochReleaseMode: rawResult?.epochReleaseMode ?? null,
        residentStepSummary: rawResult?.residentStepSummary ?? null,
        hierarchyStageSummary: rawResult?.hierarchyStageSummary ?? null,
        postStep: rawResult?.postStep ?? null
      };
  return {
    value,
    retainedBufferRefs: exactRetainedBufferRefs,
    gpuFence:
      rawResult?.gpuFence
      || rawResult?.gpuFenceReport
      || workerQueueFence
      || null,
    privateWorkerResidentScheduleStage: privateStageReceipt
  };
}

function workerResidentScheduleEpochIdentity(seal = null) {
  if (!seal || typeof seal !== 'object') return null;
  return Object.fromEntries(SCHROEDER_EPOCH_IDENTITY_WORD_FIELDS.map(
    (field) => [field, seal[field] ?? null]
  ));
}

function workerResidentScheduleRegressedIdentityWords(previousSeal, currentSeal) {
  return SCHROEDER_EPOCH_ADVANCING_IDENTITY_WORD_FIELDS.filter((field) => {
    const previous = Number(previousSeal?.[field]);
    const current = Number(currentSeal?.[field]);
    return !(Number.isFinite(previous)
      && Number.isFinite(current)
      && current > previous);
  });
}

function workerResidentScheduleLaneStateSnapshot(record, {
  laneId = null,
  stateKey = null
} = {}) {
  const lane = record?.schroederLane || null;
  return {
    schema: 'peercompute.ulg.worker-resident-schedule-lane-state.v0',
    laneId,
    stateKey,
    laneRetained: Boolean(lane),
    epochRetained: Boolean(lane?.epochGeneration),
    epochConsumed: lane?.epochConsumed === true,
    epochReleaseScheduled: lane?.epochReleaseScheduled === true,
    epochReleasedWithoutMechanicsStep:
      lane?.epochReleasedWithoutMechanicsStep === true,
    epochGenerationId: lane?.epochSeal?.generationId ?? null,
    epochIdentity: workerResidentScheduleEpochIdentity(lane?.epochSeal),
    epochStepOrdinal: lane?.stepOrdinal ?? null,
    particleCount: lane?.particleCount ?? null,
    postStepUploadsRetained: Boolean(lane?.sphParticleUpload?.stateBuffer),
    successorSourceFamilyRetained: Boolean(lane?.successorSourceFamily),
    laneSeedRetained: Boolean(lane?.laneSeed),
    laneSeedConsumed: lane?.laneSeed?.consumed === true,
    executionMode: lane?.executionMode ?? null,
    tier0ContinuationIdentity: lane?.tier0ContinuationIdentity
      ? { ...lane.tier0ContinuationIdentity }
      : null,
    nextScheduleTargetAuthoritySourceScheduleId:
      lane?.nextScheduleTargetAuthority?.sourceScheduleId ?? null,
    nextScheduleTargetAuthorityRequestId:
      lane?.nextScheduleTargetAuthority?.targetScheduleRequestId ?? null,
    nextScheduleTargetAuthorityFingerprint:
      lane?.nextScheduleTargetAuthority?.requestFingerprint ?? null,
    nextScheduleLawActivationObservationStatus:
      lane?.nextScheduleLawActivationObservation?.status ?? null,
    nextScheduleLawActivationObservationTriggered:
      lane?.nextScheduleLawActivationObservation?.triggered ?? null,
    nextScheduleLawActivationObservationSourceScheduleId:
      lane?.nextScheduleLawActivationObservation?.sourceScheduleId ?? null,
    nextScheduleLawActivationObservationTargetScheduleRequestId:
      lane?.nextScheduleLawActivationObservation
        ?.targetScheduleRequestId ?? null,
    lastConsumedDynamicLawTargetScheduleRequestId:
      lane?.lastConsumedDynamicLawTargetScheduleRequestId ?? null
  };
}

function exactWorkerScheduleLineageIdentity(upload = null) {
  if (!upload || typeof upload !== 'object') return null;
  const identity = {};
  for (const field of SCHROEDER_EPOCH_IDENTITY_WORD_FIELDS) {
    const value = upload[field];
    if (
      !Number.isSafeInteger(value)
      || value < 0
      || value > 0xffff_ffff
    ) return null;
    identity[field] = value;
  }
  if (
    identity.storageGeneration < 1
    || (
      upload.bufferFamilyGeneration != null
      && upload.bufferFamilyGeneration !== identity.storageGeneration
    )
  ) return null;
  return identity;
}

function exactWorkerScheduleParticleFamilyLineage({
  sphParticleUpload = null,
  mlsMpmParticleUpload = null
} = {}) {
  const sph = exactWorkerScheduleLineageIdentity(sphParticleUpload);
  const mlsMpm = exactWorkerScheduleLineageIdentity(mlsMpmParticleUpload);
  if (!sph || !mlsMpm) return null;
  return SCHROEDER_EPOCH_IDENTITY_WORD_FIELDS.every(
    (field) => sph[field] === mlsMpm[field]
  ) ? sph : null;
}

function expectedWorkerTier0TerminalLineage(source, stepCount) {
  if (!source) return null;
  const count = Number(stepCount);
  if (
    !Number.isSafeInteger(count)
    || count < 2
    || source.storageGeneration > 0xffff_fffe
    || source.positionEpoch > 0xffff_fffe
    || source.physicsTick > 0xffff_ffff - count
  ) return null;
  return Object.freeze({
    storageGeneration: source.storageGeneration + 1,
    physicsTick: source.physicsTick + count,
    physicsSubstep: 0,
    positionEpoch: source.positionEpoch + 1,
    topologyEpoch: source.topologyEpoch,
    chartEpoch: source.chartEpoch,
    levelEpoch: source.levelEpoch,
    supportEpoch: source.supportEpoch
  });
}

function workerScheduleLineageMismatchFields(actual, expected) {
  if (!actual || !expected) return [...SCHROEDER_EPOCH_IDENTITY_WORD_FIELDS];
  return SCHROEDER_EPOCH_IDENTITY_WORD_FIELDS.filter(
    (field) => actual[field] !== expected[field]
  );
}

function workerTier0LawsQuiescentPhaseCarrierPlan(plan = null) {
  if (!plan || typeof plan !== 'object') return false;
  const lineageCapacity = Number(plan.lineageCapacity);
  return Boolean(
    plan.schema === ULG_SPH_PHASE_CARRIER_PLAN_V2_SCHEMA
    && plan.status === 'phase-lane-capacity-ready'
    && Number.isSafeInteger(lineageCapacity)
    && lineageCapacity > 0
    && Number(plan.primaryCapacity) === lineageCapacity
    && Number(plan.phaseLaneCount) === 1
    && Number(plan.phaseLaneStride) === lineageCapacity
    && Number(plan.companionStart) === lineageCapacity
    && Number(plan.companionCapacity) === 0
    && Number(plan.particleCapacity) === lineageCapacity
    && plan.phaseCompanionLanesRequired === false
  );
}

export function workerScheduleRequiresPhaseCarrierOneToFourMaterialization({
  phaseCarrierPlan = null,
  scheduleLawActivation = null,
  canonicalRouteSelected = false,
  tier0ContinuationIdentityPresent = false
} = {}) {
  return Boolean(
    canonicalRouteSelected === true
    && tier0ContinuationIdentityPresent === true
    && workerTier0LawsQuiescentPhaseCarrierPlan(phaseCarrierPlan)
    && scheduleLawActivation?.schema
      === ULG_WORKER_SCHEDULE_LAW_ACTIVATION_RECEIPT_SCHEMA
    && scheduleLawActivation.activationAuthority
      === 'schedule-config-static-declaration-no-readback'
    && (
      scheduleLawActivation.thermal === true
      || scheduleLawActivation.reaction === true
    )
  );
}

function workerTier0PhaseCarrierPlanMatchesParticleFamily(
  plan,
  sphParticleUpload,
  mlsMpmParticleUpload
) {
  const sphParticleCount = Number(sphParticleUpload?.particleCount);
  const mlsMpmParticleCount = Number(mlsMpmParticleUpload?.particleCount);
  return Boolean(
    workerTier0LawsQuiescentPhaseCarrierPlan(plan)
    && sphParticleUpload?.schema
      === ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
    && sphParticleUpload?.status === 'webgpu-uploaded'
    && sphParticleUpload?.destroyed !== true
    && mlsMpmParticleUpload?.schema
      === ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA
    && mlsMpmParticleUpload?.status === 'webgpu-uploaded'
    && mlsMpmParticleUpload?.destroyed !== true
    && Number.isSafeInteger(sphParticleCount)
    && sphParticleCount > 0
    && mlsMpmParticleCount === sphParticleCount
    && Number(plan.lineageCapacity) === sphParticleCount
    && Number(plan.primaryCapacity) === sphParticleCount
    && Number(plan.particleCapacity) === sphParticleCount
  );
}

function workerTier0TopologyAttestation({
  phaseCarrierPlan = null,
  sourceSphUpload = null,
  sourceMlsUpload = null,
  device = null
} = {}) {
  if (!workerTier0LawsQuiescentPhaseCarrierPlan(phaseCarrierPlan)) return null;
  const identityBufferPresent = Boolean(sourceSphUpload?.identityBuffer);
  const sourceBuffers = [
    sourceSphUpload?.stateBuffer,
    sourceSphUpload?.thermoBuffer,
    sourceSphUpload?.identityBuffer,
    sourceMlsUpload?.mechanicsBuffer
  ].filter(Boolean);
  const exactFourBufferFamily = sourceBuffers.length === 4
    && new Set(sourceBuffers).size === 4;
  const exactFourBufferDeviceFamily = Boolean(
    device
    && exactFourBufferFamily
    && sourceBuffers.every((buffer) => webGpuBufferDevice(buffer) === device)
  );
  const planMatchesParticleFamily =
    workerTier0PhaseCarrierPlanMatchesParticleFamily(
      phaseCarrierPlan,
      sourceSphUpload,
      sourceMlsUpload
    );
  const sourceParticleCount = Number(sourceSphUpload?.particleCount);
  const identityStrideBytes = Number(sourceSphUpload?.identityStrideBytes);
  const identityBufferByteLength = Number(
    sourceSphUpload?.identityBufferByteLength
  );
  const identityBufferSize = Number(sourceSphUpload?.identityBuffer?.size);
  const identityUsage = Number(sourceSphUpload?.identityBuffer?.usage);
  const identityRevision = String(
    sourceSphUpload?.identityRevision ?? ''
  ).trim();
  const expectedIdentityByteLength = Number.isSafeInteger(sourceParticleCount)
    && sourceParticleCount > 0
    ? sourceParticleCount
      * SPH_GPU_PARTICLE_IDENTITY_UINTS
      * Uint32Array.BYTES_PER_ELEMENT
    : null;
  const identityStorageUsage = Boolean(
    Number.isSafeInteger(identityUsage)
    && (identityUsage & GPU_BUFFER_USAGE.STORAGE) === GPU_BUFFER_USAGE.STORAGE
  );
  const identityDeviceMatched = Boolean(
    identityBufferPresent
    && device
    && webGpuBufferDevice(sourceSphUpload.identityBuffer) === device
  );
  const identityAuthorityComplete = Boolean(
    identityBufferPresent
    && sourceSphUpload?.identitySchema
      === ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
    && identityStrideBytes
      === SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT
    && identityRevision
    && identityBufferByteLength === expectedIdentityByteLength
    && Number.isSafeInteger(identityBufferSize)
    && identityBufferSize >= expectedIdentityByteLength
    && identityStorageUsage
    && identityDeviceMatched
  );
  return Object.freeze({
    schema: ULG_WORKER_TIER0_TOPOLOGY_ATTESTATION_SCHEMA,
    status: exactFourBufferFamily
      && exactFourBufferDeviceFamily
      && planMatchesParticleFamily
      && identityAuthorityComplete
      ? 'tier0-topology-quiescence-attested'
      : 'tier0-topology-quiescence-incomplete',
    phaseCarrierPlanSchema: phaseCarrierPlan.schema,
    phaseCarrierPlanStatus: phaseCarrierPlan.status,
    lineageCapacity: Number(phaseCarrierPlan.lineageCapacity),
    primaryCapacity: Number(phaseCarrierPlan.primaryCapacity),
    phaseLaneCount: Number(phaseCarrierPlan.phaseLaneCount),
    phaseLaneStride: Number(phaseCarrierPlan.phaseLaneStride),
    companionStart: Number(phaseCarrierPlan.companionStart),
    companionCapacity: Number(phaseCarrierPlan.companionCapacity),
    particleCapacity: Number(phaseCarrierPlan.particleCapacity),
    sourceParticleCount,
    phaseCompanionLanesRequired:
      phaseCarrierPlan.phaseCompanionLanesRequired === true,
    identityBufferRequired: true,
    identityBufferPresent,
    identitySchema: sourceSphUpload?.identitySchema ?? null,
    identityStrideBytes,
    identityRevision: identityRevision || null,
    identityBufferByteLength,
    identityBufferSize,
    identityStorageUsage,
    identityDeviceMatched,
    identityAuthorityComplete,
    exactFourBufferFamily,
    exactFourBufferDeviceFamily,
    planMatchesParticleFamily
  });
}

function transferPhaseCarrierAuxiliaryBufferOwnership({
  sourceUploads = null,
  terminalUploads = null
} = {}) {
  const pairs = [
    [sourceUploads?.sphParticleUpload, terminalUploads?.sphParticleUpload],
    [sourceUploads?.mlsMpmParticleUpload, terminalUploads?.mlsMpmParticleUpload]
  ];
  const fields = [
    [
      'materialPropertyBankWarmInputBuffer',
      'ownsMaterialPropertyBankWarmInputBuffer'
    ],
    [
      'materialPropertyBankParticleSizeBuffer',
      'ownsMaterialPropertyBankParticleSizeBuffer'
    ]
  ];
  const transfers = [];
  const uniquelyOwned = new Set();
  const aliased = new Set();
  for (const [source, terminal] of pairs) {
    if (!source || !terminal) {
      throw new TypeError(
        'Phase-carrier auxiliary ownership transfer requires both particle upload descriptors'
      );
    }
    for (const [bufferField, ownershipField] of fields) {
      const sourceBuffer = source[bufferField] ?? null;
      const terminalBuffer = terminal[bufferField] ?? null;
      if (terminalBuffer !== sourceBuffer) {
        throw new RangeError(
          `Phase-carrier auxiliary ownership transfer rejected ${bufferField} alias drift`
        );
      }
      const owned = Boolean(
        sourceBuffer && source[ownershipField] !== false
      );
      if (sourceBuffer) aliased.add(sourceBuffer);
      if (owned && uniquelyOwned.has(sourceBuffer)) {
        throw new RangeError(
          'Phase-carrier auxiliary ownership transfer rejected duplicate source ownership'
        );
      }
      if (owned) uniquelyOwned.add(sourceBuffer);
      transfers.push({ source, terminal, ownershipField, sourceBuffer, owned });
    }
  }
  if (transfers.some(
    ({ source, terminal }) => Object.isFrozen(source) || Object.isFrozen(terminal)
  )) {
    throw new TypeError(
      'Phase-carrier auxiliary ownership transfer requires mutable upload ownership descriptors'
    );
  }
  const previous = transfers.map(({ source, terminal, ownershipField }) => ({
    source,
    terminal,
    ownershipField,
    sourceOwned: source[ownershipField],
    terminalOwned: terminal[ownershipField]
  }));
  let rolledBack = false;
  const rollback = () => {
    if (rolledBack) return true;
    for (const mutation of [...previous].reverse()) {
      mutation.source[mutation.ownershipField] = mutation.sourceOwned;
      mutation.terminal[mutation.ownershipField] = mutation.terminalOwned;
    }
    rolledBack = true;
    return true;
  };
  try {
    for (const {
      source,
      terminal,
      ownershipField,
      sourceBuffer,
      owned
    } of transfers) {
      source[ownershipField] = false;
      terminal[ownershipField] = Boolean(sourceBuffer && owned);
    }
  } catch (error) {
    try { rollback(); } catch {}
    throw error;
  }
  const receipt = {
    schema:
      'peercompute.ulg.worker-phase-carrier-auxiliary-ownership-transfer.v0',
    status: 'phase-carrier-auxiliary-ownership-transferred',
    aliasedAuxiliaryBufferCount: aliased.size,
    transferredOwnedBufferCount: uniquelyOwned.size,
    borrowedAuxiliaryBufferCount: Math.max(
      0,
      aliased.size - uniquelyOwned.size
    ),
    sourceOwnershipCleared: true,
    terminalOwnershipAdopted: true
  };
  Object.defineProperty(receipt, 'rollbackOwnershipTransfer', {
    value: rollback,
    enumerable: false,
    configurable: false,
    writable: false
  });
  return Object.freeze(receipt);
}

function restoreWorkerContinuationSidecarOwnership({
  sourceUploads = null,
  unadoptedUploads = null
} = {}) {
  const sourceSph = sourceUploads?.sphParticleUpload ?? null;
  const unadoptedSph = unadoptedUploads?.sphParticleUpload ?? null;
  let auxiliaryOwnershipTransfer = null;
  const sourceIdentitySnapshot = {
    ownsIdentityBuffer: sourceSph?.ownsIdentityBuffer,
    identityOwnership: sourceSph?.identityOwnership
  };
  const unadoptedIdentitySnapshot = {
    ownsIdentityBuffer: unadoptedSph?.ownsIdentityBuffer,
    identityOwnership: unadoptedSph?.identityOwnership
  };
  try {
    auxiliaryOwnershipTransfer =
      transferPhaseCarrierAuxiliaryBufferOwnership({
        sourceUploads: unadoptedUploads,
        terminalUploads: sourceUploads
      });
    if (
      unadoptedSph?.identityBuffer
      && unadoptedSph.identityBuffer === sourceSph?.identityBuffer
      && unadoptedSph.ownsIdentityBuffer === true
    ) {
      unadoptedSph.ownsIdentityBuffer = false;
      unadoptedSph.identityOwnership =
        'rolled-back-unadopted-resident-continuation';
      sourceSph.ownsIdentityBuffer = true;
      sourceSph.identityOwnership =
        'restored-after-unadopted-resident-continuation';
    }
  } catch (error) {
    try {
      sourceSph.ownsIdentityBuffer =
        sourceIdentitySnapshot.ownsIdentityBuffer;
      sourceSph.identityOwnership =
        sourceIdentitySnapshot.identityOwnership;
      unadoptedSph.ownsIdentityBuffer =
        unadoptedIdentitySnapshot.ownsIdentityBuffer;
      unadoptedSph.identityOwnership =
        unadoptedIdentitySnapshot.identityOwnership;
    } catch {}
    try {
      auxiliaryOwnershipTransfer?.rollbackOwnershipTransfer?.();
    } catch {}
    throw error;
  }
  return true;
}

function persistWorkerScheduleResidentStepOptions(lane, requested = null) {
  if (!lane || !requested || typeof requested !== 'object') return;
  const previous = lane.residentStepOptions || {};
  const carriedResidentProductMass = previous.residentProductMass ?? null;
  lane.residentStepOptions = {
    ...previous,
    ...requested,
    thermalStepOptions: {
      ...(previous.thermalStepOptions || {}),
      ...(requested.thermalStepOptions || {})
    },
    reactionStepOptions: {
      ...(previous.reactionStepOptions || {}),
      ...(requested.reactionStepOptions || {})
    },
    mechanicsRefreshOptions: {
      ...(previous.mechanicsRefreshOptions || {}),
      ...(requested.mechanicsRefreshOptions || {})
    },
    ...(carriedResidentProductMass
      ? { residentProductMass: carriedResidentProductMass }
      : {})
  };
}

function validateWorkerTier0FusedExecution(execution, {
  device,
  stepCount,
  sourceSphUpload,
  sourceMlsUpload,
  sourceLineage,
  expectedLineage,
  phaseCarrierPlan,
  registeredSubmittedCleanupCount = 0,
  rejectedSubmittedCleanupCount = 0
} = {}) {
  const failures = [];
  const finalStep = execution?.finalStep ?? null;
  const fused = execution?.fusedResidentSequence
    ?? finalStep?.fusedResidentSequence
    ?? null;
  const preflight = execution?.fusedResidentSequencePreflight ?? null;
  const nextUploads = execution?.nextParticleUploads
    ?? finalStep?.nextParticleUploads
    ?? null;
  const nextSphUpload = nextUploads?.sphParticleUpload ?? null;
  const nextMlsUpload = nextUploads?.mlsMpmParticleUpload ?? null;
  const targetLineage = exactWorkerScheduleParticleFamilyLineage({
    sphParticleUpload: nextSphUpload,
    mlsMpmParticleUpload: nextMlsUpload
  });
  const exactBuffers = [
    nextSphUpload?.stateBuffer,
    nextSphUpload?.thermoBuffer,
    nextSphUpload?.identityBuffer,
    nextMlsUpload?.mechanicsBuffer
  ].filter(Boolean);
  if (execution?.schema !== ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA) {
    failures.push('execution-schema');
  }
  if (execution?.status !== 'resident-steps-executed') {
    failures.push('execution-status');
  }
  if (
    execution?.stepCount !== stepCount
    || execution?.completedStepCount !== stepCount
  ) failures.push('execution-step-count');
  if (
    fused?.schema !== 'peercompute.ulg.mls-mpm-fused-resident-sequence.v0'
    || fused.status !== 'fused-resident-sequence-executed'
    || fused.stepCount !== stepCount
    || fused.commandSubmissionCount !== 1
    || fused.internalPositionSubstepCount !== stepCount
    || fused.storageGenerationDelta !== 1
    || fused.committedPositionEpochDelta !== 1
    || fused.physicsTickDelta !== stepCount
  ) failures.push('fused-sequence-receipt');
  if (
    preflight?.status !== 'fused-resident-sequence-preflight-ready'
    || preflight.sequenceRunnable !== true
    || (preflight.blockers || []).length !== 0
    || (preflight.sidecarBlockers || []).length !== 0
  ) failures.push('fused-preflight');
  if (
    execution?.readbackMode !== NO_FULL_READBACK_MODE
    || execution.fullParticleReadbackPerformed !== false
    || execution.fullParticleReadbackFree !== true
    || execution.residentContinuationReady !== true
    || Number(execution.mapAsyncCount) !== 0
    || Number(execution.readbackBytes) !== 0
    || Number(execution.hostQueueFenceCount) !== 0
  ) failures.push('readback-or-continuation');
  if (
    finalStep?.nextParticleUploads !== nextUploads
    || finalStep?.residentContinuationReady !== true
    || finalStep?.fullParticleReadbackFree !== true
  ) failures.push('terminal-step-publication');
  if (
    workerScheduleLineageMismatchFields(targetLineage, expectedLineage)
      .length > 0
    || workerScheduleLineageMismatchFields(
      fused?.terminalLineageIdentity,
      expectedLineage
    ).length > 0
  ) failures.push('terminal-lineage');
  if (
    nextSphUpload?.stateBuffer === sourceSphUpload?.stateBuffer
    || nextMlsUpload?.mechanicsBuffer === sourceMlsUpload?.mechanicsBuffer
    || nextSphUpload?.thermoBuffer !== sourceSphUpload?.thermoBuffer
    || nextSphUpload?.identityBuffer !== sourceSphUpload?.identityBuffer
  ) failures.push('terminal-buffer-family');
  if (
    exactBuffers.length !== 4
    || new Set(exactBuffers).size !== 4
    || exactBuffers.some((buffer) => webGpuBufferDevice(buffer) !== device)
  ) failures.push('terminal-buffer-device');
  if (
    !workerTier0LawsQuiescentPhaseCarrierPlan(phaseCarrierPlan)
    || !workerTier0PhaseCarrierPlanMatchesParticleFamily(
      phaseCarrierPlan,
      nextSphUpload,
      nextMlsUpload
    )
    || !workerTier0LawsQuiescentPhaseCarrierPlan(
      nextSphUpload?.phaseCarrierPlan
    )
    || !workerTier0LawsQuiescentPhaseCarrierPlan(
      nextMlsUpload?.phaseCarrierPlan
    )
    || !phaseCarrierPlansEqual(
      phaseCarrierPlan,
      nextSphUpload?.phaseCarrierPlan
    )
    || !phaseCarrierPlansEqual(
      phaseCarrierPlan,
      nextMlsUpload?.phaseCarrierPlan
    )
  ) failures.push('phase-carrier-plan');
  if (
    sourceSphUpload?.identityBuffer
    && (
      fused?.continuationOwnershipTransferDeferred !== true
      || nextSphUpload?.ownsIdentityBuffer !== false
      || nextSphUpload?.identityOwnership
        !== 'deferred-source-to-continuation-transfer'
    )
  ) failures.push('identity-ownership-deferral');
  if (
    fused?.submittedCleanupOwnership !== 'caller-terminal-fence'
    || fused?.submittedCleanupRegistrationCount !== 1
    || registeredSubmittedCleanupCount !== 1
    || rejectedSubmittedCleanupCount !== 0
  ) failures.push('submitted-cleanup-ownership');
  return {
    valid: failures.length === 0,
    failures,
    finalStep,
    fused,
    preflight,
    nextUploads,
    nextSphUpload,
    nextMlsUpload,
    sourceLineage,
    targetLineage,
    exactBuffers
  };
}

// A schedule step that aborted after its epoch stage retained a fresh sealed
// generation (identity regression, or a mechanics-stage error) must not leave
// that generation pinned unconsumed: a follow-up single 'run-resident-stage'
// epoch message on the same lane has to keep working. Release it queue-ordered
// exactly like consumption would have, but only when the retained generation
// is provably the one THIS step built.
function releaseWorkerResidentScheduleUnconsumedStepEpoch(record, stepSeal, {
  releaseSuccessorLease = false,
  queueOrderedAfterLastSubmission = false
} = {}) {
  const lane = record?.schroederLane || null;
  if (!stepSeal || !lane?.epochGeneration || lane.epochConsumed === true) {
    return { required: false, confirmed: true, scheduled: false };
  }
  if (lane.epochSeal?.generationId !== stepSeal.generationId) {
    return { required: true, confirmed: false, scheduled: false };
  }
  const generation = lane.epochGeneration;
  if (releaseSuccessorLease) {
    // Only when the mechanics stage never started for this step; its own
    // finally-block owns the lease release otherwise.
    releaseWorkerSchroederSuccessorLeaseQuietly(
      lane.successorConsumption,
      lane.device
    );
    lane.successorConsumption = null;
  }
  let scheduled = false;
  try {
    scheduled = queueOrderedAfterLastSubmission
      && canReleaseSchroederSpatialEpochGenerationQueueOrderedAfterFinalConsumer(
        generation,
        lane.device
      )
      ? releaseSchroederSpatialEpochGenerationQueueOrderedAfterFinalConsumer(
          generation,
          lane.device
        ) === true
      : releaseSchroederSpatialEpochGenerationAfterQueue(
          generation,
          lane.device
        ) === true;
  } catch {
    scheduled = false;
  }
  const confirmed = Boolean(
    scheduled
    || generation.releaseScheduled === true
    || generation.releasePromise != null
    || generation.execution?.released === true
  );
  lane.epochConsumed = confirmed;
  lane.epochReleasedWithoutMechanicsStep = confirmed;
  lane.epochReleaseScheduled = confirmed;
  lane.epochReleasePromise = generation.releasePromise ?? null;
  return { required: true, confirmed, scheduled };
}

function workerResidentScheduleNowMs() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

function poisonWorkerResidentScheduleLane(record, detail = null) {
  if (!record || typeof record !== 'object') return null;
  const poison = Object.freeze({
    schema: 'peercompute.ulg.worker-resident-schedule-lane-poison.v0',
    status: 'worker-resident-schedule-lane-poisoned',
    reason: detail?.reason || 'resident-schedule-terminal-authority-failed',
    scheduleId: detail?.scheduleId ?? null,
    stepOrdinal: detail?.stepOrdinal ?? null,
    terminalGpuFence: detail?.terminalGpuFence
      ? structuredClone(detail.terminalGpuFence)
      : null
  });
  record.residentSchedulePoison = poison;
  return poison;
}

function requireWorkerResidentScheduleDeferredStageAdmission(result, {
  scheduleId,
  stepOrdinal,
  stageId,
  laneId,
  stateKey
} = {}) {
  const privateStage = result?.privateWorkerResidentScheduleStage ?? null;
  const expectedRetainedBufferRefCount =
    stageId === SCHROEDER_SPATIAL_EPOCH_STAGE_ID ? 3 : 4;
  if (
    privateStage?.schema
      !== WORKER_RESIDENT_SCHEDULE_PRIVATE_STAGE_RESULT_SCHEMA
    || privateStage.status
      !== 'worker-resident-schedule-private-stage-result-ready'
    || privateStage.stageId !== stageId
    || privateStage.scheduleId !== scheduleId
    || privateStage.laneId !== laneId
    || privateStage.stateKey !== stateKey
    || privateStage.cloneableResultReturned !== false
    || privateStage.copyBudgetComputed !== false
    || privateStage.gasPressureTransportGraphInspected !== false
    || privateStage.retainedRefEnumeration
      !== 'canonical-stage-descriptors'
    || privateStage.retainedBufferRefCount
      !== (result?.retainedBufferRefs?.length ?? -1)
    || privateStage.retainedBufferRefCount
      !== expectedRetainedBufferRefCount
    || result?.value?.workerResidentStage !== privateStage
  ) {
    throw workerResidentScheduleError(
      'schedule-private-stage-result-missing',
      `${stageId || 'unknown-stage'} did not return the exact private schedule stage result`,
      { scheduleId, stepOrdinal, stageId }
    );
  }
  const fence = result?.gpuFence || result?.value?.gpuFence || null;
  if (
    result?.value?.backend !== 'webgpu'
    || fence?.required !== true
    || fence?.fenceSatisfied !== false
    || fence?.residentScheduleTerminalFenceDeferred !== true
    || fence?.queueCompletionMethod !== 'same-worker-webgpu-queue-in-order'
  ) {
    throw workerResidentScheduleError(
      'schedule-stage-terminal-fence-deferral-missing',
      `${stageId || 'unknown-stage'} did not return the private WebGPU schedule deferral attestation`,
      { scheduleId, stepOrdinal, stageId }
    );
  }
  return fence;
}

async function completeWorkerResidentScheduleQueueDrainCheckpoint({
  workerDevice,
  scheduleId,
  laneId,
  stateKey,
  completedStepCount,
  // Lagged-drain support: a fence the CALLER already started (covering work
  // through an earlier checkpoint). Awaiting it bounds unfenced work without
  // stalling the encode pipeline behind the newest submissions.
  fencePromise = null
} = {}) {
  const normalizedCompletedStepCount = Math.max(
    0,
    Math.floor(Number(completedStepCount) || 0)
  );
  const queue = workerDevice?.queue || null;
  const base = {
    schema: 'peercompute.compute.gpu-fence-report.v0',
    required: true,
    source: 'ulg-mechanics-resident-stage-worker',
    scope: 'resident-schedule-queue-drain-checkpoint',
    terminalScheduleFence: false,
    scheduleId,
    laneId,
    stateKey,
    completedStepCount: normalizedCompletedStepCount,
    checkpointIntervalSteps:
      ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS,
    authorityAdmissionReady: false,
    stateManagerCommitReady: false
  };
  if (typeof queue?.onSubmittedWorkDone !== 'function') {
    return {
      ...base,
      fenceSatisfied: false,
      status: 'worker-queue-drain-checkpoint-unavailable',
      reason: 'worker-webgpu-device-queue-missing-at-resident-schedule-checkpoint',
      queueCompletionStatus: 'queue-completion-unavailable',
      queueCompletionMethod: null
    };
  }
  const startedAtMs = workerResidentScheduleNowMs();
  try {
    await (fencePromise ?? queue.onSubmittedWorkDone());
  } catch (error) {
    return {
      ...base,
      fenceSatisfied: false,
      status: 'gpu-queue-drain-checkpoint-unsatisfied',
      reason: 'resident-schedule-checkpoint-worker-queue-completion-error',
      queueCompletionStatus: 'queue-completion-error',
      queueCompletionMethod: 'worker-device.queue.onSubmittedWorkDone',
      queueCompletionErrorName: error instanceof Error ? error.name : null,
      queueCompletionErrorMessage:
        error instanceof Error ? error.message : String(error),
      elapsedMs: Math.max(0, workerResidentScheduleNowMs() - startedAtMs)
    };
  }
  return {
    ...base,
    fenceSatisfied: true,
    status: 'gpu-queue-drain-checkpoint-satisfied',
    reason: 'resident-schedule-checkpoint-worker-queue-completion-evidenced',
    queueCompletionStatus: 'queue-work-completed',
    queueCompletionMethod: 'worker-device.queue.onSubmittedWorkDone',
    elapsedMs: Math.max(0, workerResidentScheduleNowMs() - startedAtMs)
  };
}

function failedQueueDrainCheckpointTerminalFence(checkpoint, {
  scheduleId,
  laneId,
  stateKey,
  completedStepCount
} = {}) {
  return {
    schema: 'peercompute.compute.gpu-fence-report.v0',
    required: true,
    source: 'ulg-mechanics-resident-stage-worker',
    scope: 'resident-schedule-terminal',
    terminalScheduleFence: true,
    terminalDerivedFromQueueDrainCheckpoint: true,
    scheduleId,
    laneId,
    stateKey,
    completedStepCount: Math.max(
      0,
      Math.floor(Number(completedStepCount) || 0)
    ),
    fenceSatisfied: false,
    status: 'gpu-fence-unsatisfied',
    reason: 'resident-schedule-queue-drain-checkpoint-unsatisfied',
    queueCompletionStatus:
      checkpoint?.queueCompletionStatus || 'queue-completion-error',
    queueCompletionMethod: checkpoint?.queueCompletionMethod || null,
    queueCompletionErrorName: checkpoint?.queueCompletionErrorName || null,
    queueCompletionErrorMessage:
      checkpoint?.queueCompletionErrorMessage || checkpoint?.reason || null,
    authorityAdmissionReady: false,
    queueDrainCheckpoint: checkpoint || null
  };
}

function terminalCflIntervalRejectTrace(decoded = null, words = null) {
  const tag = Number(decoded?.statusCaptureSentinel) >>> 0;
  if (tag === 0xffff_fffe) {
    return {
      schema: 'peercompute.ulg.schroeder-cfl-interval-reject-trace.v0',
      status: 'capture-interrupted-before-tag-publication',
      tag,
      headerEvidenceRepurposed: true,
      rawPayloadWords: null
    };
  }
  if ((tag >>> 24) !== 0xc7) return null;
  const payloadWords = words instanceof Uint32Array && words.length >= 136
    ? Array.from(words.slice(125, 136), (value) => value >>> 0)
    : null;
  const payloadFloats = payloadWords == null
    ? null
    : Array.from(new Float32Array(Uint32Array.from(payloadWords).buffer));
  const stageCode = (tag >>> 22) & 0x3;
  const stage = [
    'fine-validator',
    'coarse-validator',
    'global-interval-seal',
    'unknown'
  ][stageCode];
  const priorRegimeCode = (tag >>> 17) & 0x3;
  const priorRegime = [
    'inside-numeric-guard',
    'inside-physical-audit-band',
    'outside-physical-audit',
    'invalid-or-not-applicable'
  ][priorRegimeCode];
  const base = {
    schema: 'peercompute.ulg.schroeder-cfl-interval-reject-trace.v0',
    status: payloadFloats == null
      ? 'capture-tag-published-payload-unavailable'
      : 'capture-complete',
    tag,
    stage,
    stageCode,
    phaseIntervalValid: ((tag >>> 21) & 1) === 1,
    fullIntervalValid: ((tag >>> 20) & 1) === 1,
    localIntervalOverlap: ((tag >>> 19) & 1) === 1,
    priorRegime,
    priorRegimeCode,
    fieldOrdinalOverflow: ((tag >>> 16) & 1) === 1,
    fieldOrdinal: stageCode === 2 ? null : tag & 0xffff,
    headerEvidenceRepurposed: true,
    rawPayloadWords: payloadWords
  };
  if (payloadFloats == null) return base;
  if (stageCode === 2) {
    return {
      ...base,
      globalAlphaInterval: {
        lower: payloadFloats[0],
        upper: payloadFloats[1]
      }
    };
  }
  return {
    ...base,
    priorVelocityMPerS: payloadFloats.slice(0, 3),
    phaseDeltaVelocityMPerS: payloadFloats.slice(3, 6),
    fullDeltaVelocityMPerS: payloadFloats.slice(6, 9),
    maximumVelocityMPerS: payloadFloats[9],
    correctionCeilingMPerS: payloadFloats[10]
  };
}

function terminalRefluxReceiptDiagnostic(decoded = null, words = null) {
  if (!decoded) return null;
  const cflIntervalRejectTrace = terminalCflIntervalRejectTrace(
    decoded,
    words
  );
  return {
        structuralValid: decoded.structuralValid === true,
        admitted: decoded.admitted === true,
        terminalAdmitted: decoded.terminalAdmitted === true,
        failClosed: decoded.failClosed === true,
        statusFlags: decoded.statusFlags ?? null,
        phase: decoded.phase ?? null,
        completionOrdinal: decoded.completionOrdinal ?? null,
        committedFineSubstepCount:
          decoded.committedFineSubstepCount ?? null,
        consumedFineSubstepCount:
          decoded.consumedFineSubstepCount ?? null,
        fineSubstepCount: decoded.fineSubstepCount ?? null,
        fineLevel: decoded.fineLevel ?? null,
        coarseLevel: decoded.coarseLevel ?? null,
        macroOwnerId: decoded.macroOwnerId ?? null,
        macroOwnerGeneration: decoded.macroOwnerGeneration ?? null,
        terminalReceiptState: decoded.terminalReceiptState ?? null,
        terminalReceiptToken: decoded.terminalReceiptToken ?? null,
        publicationToken: decoded.publicationToken ?? null,
        mutationRollbackCount: decoded.mutationRollbackCount ?? null,
        correctionClampCount: decoded.correctionClampCount ?? null,
        cflRejectCount: decoded.cflRejectCount ?? null,
        invalidCount: decoded.invalidCount ?? null,
        keyMismatchCount: decoded.keyMismatchCount ?? null,
        routeRejectCount: decoded.routeRejectCount ?? null,
        boundaryRejectCount: decoded.boundaryRejectCount ?? null,
        chartRejectCount: decoded.chartRejectCount ?? null,
        positivityStatus: decoded.positivityStatus ?? null,
        cflStatus: decoded.cflStatus ?? null,
        massComStatus: decoded.massComStatus ?? null,
        momentumStatus: decoded.momentumStatus ?? null,
        angularMomentumStatus: decoded.angularMomentumStatus ?? null,
        energyStatus: decoded.energyStatus ?? null,
        capturedOperationCount: decoded.capturedOperationCount ?? null,
        expectedOperationCount: decoded.expectedOperationCount ?? null,
        finalP2gAuthorityStatus: decoded.finalP2gAuthorityStatus ?? null,
        finalG2pAuthorityStatus: decoded.finalG2pAuthorityStatus ?? null,
        particleHeatStatus: decoded.particleHeatStatus ?? null,
        exactCountStatus: decoded.exactCountStatus ?? null,
        publicationStatus: decoded.publicationStatus ?? null,
        authorityRejectCount: decoded.authorityRejectCount
          ? { ...decoded.authorityRejectCount }
          : null,
        receiptRejectCount: decoded.receiptRejectCount
          ? { ...decoded.receiptRejectCount }
          : null,
        fineReceiptConsumeCount: decoded.fineReceiptConsumeCount ?? null,
        coarseReceiptConsumeCount: decoded.coarseReceiptConsumeCount ?? null,
        localHeatStatus: decoded.heatSplit?.localHeatStatus ?? null,
        routeHeatStatus: decoded.heatSplit?.routeHeatStatus ?? null,
        statusCaptureSentinel: decoded.statusCaptureSentinel ?? null,
        statusCaptureMissingCount:
          cflIntervalRejectTrace == null
            ? decoded.statusCaptureMissingCount ?? null
            : null,
        cflIntervalRejectTrace,
        headerEvidenceRepurposed:
          cflIntervalRejectTrace?.headerEvidenceRepurposed === true,
        maxFineCflRatio: decoded.maxFineCflRatio ?? null,
        maxCoarseCflRatio: decoded.maxCoarseCflRatio ?? null,
        operatorSplitValid: cflIntervalRejectTrace == null
          ? decoded.operatorSplit?.valid === true
          : null,
        phaseVolumeTransportValid:
          cflIntervalRejectTrace == null
            ? decoded.phaseVolumeTransport?.valid === true
            : null,
        ambientBoundaryValid: cflIntervalRejectTrace == null
          ? decoded.ambientBoundary?.valid === true
          : null
      };
}

async function readWorkerResidentScheduleTerminalRefluxReceipt({
  required = false,
  buffer = null,
  expectations = [],
  scheduleId,
  laneId,
  stateKey,
  completedStepCount
} = {}) {
  const expectedStepCount = Math.max(
    0,
    Math.floor(Number(completedStepCount) || 0)
  );
  const base = {
    schema: ULG_WORKER_RESIDENT_SCHEDULE_TERMINAL_REFLUX_RECEIPT_SCHEMA,
    required: required === true,
    scheduleId,
    laneId,
    stateKey,
    expectedStepCount,
    observedStepCount: 0,
    admittedStepCount: 0,
    firstRejectedStepOrdinal: null,
    allStepsAdmitted: required !== true
  };
  if (required !== true) {
    return {
      ...base,
      status: 'terminal-reflux-receipt-not-required',
      reason: null
    };
  }
  const expectedByteLength = expectedStepCount
    * SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_BYTE_LENGTH;
  const expectationCount = Array.isArray(expectations)
    ? expectations.length
    : 0;
  if (
    expectedStepCount < 1
    || !buffer
    || buffer.destroyed === true
    || !Array.isArray(expectations)
    || expectationCount !== expectedStepCount
    || Number(buffer.size) < expectedByteLength
    || typeof buffer.mapAsync !== 'function'
    || typeof buffer.getMappedRange !== 'function'
  ) {
    return {
      ...base,
      status: 'terminal-reflux-receipt-rejected',
      reason: 'terminal-reflux-receipt-ring-incomplete',
      firstRejectedStepOrdinal:
        expectationCount < expectedStepCount
          ? expectationCount + 1
          : 1
    };
  }
  let copiedBytes = null;
  try {
    await buffer.mapAsync(GPU_MAP_MODE.READ, 0, expectedByteLength);
    const mapped = buffer.getMappedRange(0, expectedByteLength);
    copiedBytes = new Uint8Array(mapped).slice();
  } catch (error) {
    return {
      ...base,
      status: 'terminal-reflux-receipt-rejected',
      reason: 'terminal-reflux-receipt-map-failed',
      mapErrorName: error instanceof Error ? error.name : null,
      mapErrorMessage: error instanceof Error ? error.message : String(error),
      firstRejectedStepOrdinal: 1
    };
  } finally {
    try { buffer.unmap?.(); } catch { /* terminal rejection remains sealed */ }
  }
  let admittedStepCount = 0;
  let firstRejectedStepOrdinal = null;
  let firstRejectedDiagnostic = null;
  for (let index = 0; index < expectations.length; index += 1) {
    const expectation = expectations[index] ?? null;
    const stepOrdinal = index + 1;
    const offset = index
      * SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_BYTE_LENGTH;
    const words = new Uint32Array(
      copiedBytes.buffer,
      copiedBytes.byteOffset + offset,
      SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS
    );
    const decoded = decodeSchroederCrossLevelRefluxTerminalHeader(words);
    const copyReceipt = expectation?.copyReceipt ?? null;
    const admitted = Boolean(
      expectation?.stepOrdinal === stepOrdinal
      && copyReceipt?.schema
        === ULG_SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_COPY_SCHEMA
      && copyReceipt.status
        === 'terminal-reflux-header-copy-submitted-unverified'
      && copyReceipt.scheduleId === scheduleId
      && copyReceipt.laneId === laneId
      && copyReceipt.stateKey === stateKey
      && copyReceipt.stepOrdinal === stepOrdinal
      && copyReceipt.targetOffsetBytes === offset
      && copyReceipt.targetByteLength
        === SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_BYTE_LENGTH
      && decoded?.structuralValid === true
      && decoded.terminalAdmitted === true
      && decoded.failClosed !== true
      && decoded.mutationRollbackCount === 0
      && decoded.completionOrdinal
        === expectation.expectedCompletionOrdinal
      && decoded.fineSubstepCount
        === expectation.expectedFineSubstepCount
      && decoded.fineLevel === expectation.expectedFineLevel
      && decoded.coarseLevel === expectation.expectedCoarseLevel
      && decoded.macroOwnerId === expectation.expectedCompletionOrdinal
      && copyReceipt.completionOrdinal === decoded.completionOrdinal
      && copyReceipt.macroOwnerId === decoded.macroOwnerId
      && copyReceipt.ownerGeneration === decoded.macroOwnerGeneration
      && copyReceipt.fineSubstepCount === decoded.fineSubstepCount
      && copyReceipt.fineLevel === decoded.fineLevel
      && copyReceipt.coarseLevel === decoded.coarseLevel
    );
    if (admitted) {
      admittedStepCount += 1;
    } else if (firstRejectedStepOrdinal == null) {
      firstRejectedStepOrdinal = stepOrdinal;
      firstRejectedDiagnostic = terminalRefluxReceiptDiagnostic(
        decoded,
        words
      );
    }
  }
  const allStepsAdmitted = admittedStepCount === expectedStepCount
    && firstRejectedStepOrdinal == null;
  return {
    ...base,
    status: allStepsAdmitted
      ? 'terminal-reflux-schedule-receipt-admitted'
      : 'terminal-reflux-receipt-rejected',
    reason: allStepsAdmitted
      ? null
      : 'one-or-more-terminal-reflux-headers-rejected',
    observedStepCount: expectations.length,
    admittedStepCount,
    firstRejectedStepOrdinal,
    firstRejectedDiagnostic,
    allStepsAdmitted
  };
}

async function completeWorkerResidentScheduleTerminalFence({
  workerDevice,
  scheduleId,
  laneId,
  stateKey,
  completedStepCount,
  workMayHaveBeenSubmitted = false,
  terminalRefluxReceiptRequired = false,
  terminalRefluxRingBuffer = null,
  terminalRefluxExpectations = []
} = {}) {
  const normalizedCompletedStepCount = Math.max(
    0,
    Math.floor(Number(completedStepCount) || 0)
  );
  if (!workMayHaveBeenSubmitted) {
    return {
      schema: 'peercompute.compute.gpu-fence-report.v0',
      required: true,
      fenceSatisfied: false,
      status: 'gpu-fence-unsatisfied-no-schedule-submissions',
      reason: 'resident schedule terminated without an authoritative GPU step',
      queueCompletionStatus: 'queue-work-not-submitted',
      queueCompletionMethod: null,
      source: 'ulg-mechanics-resident-stage-worker',
      scope: 'resident-schedule-terminal',
      terminalScheduleFence: true,
      authorityAdmissionReady: false,
      scheduleId,
      laneId,
      stateKey,
      completedStepCount: 0
    };
  }
  const queue = workerDevice?.queue || null;
  const base = {
    schema: 'peercompute.compute.gpu-fence-report.v0',
    required: true,
    source: 'ulg-mechanics-resident-stage-worker',
    scope: 'resident-schedule-terminal',
    terminalScheduleFence: true,
    scheduleId,
    laneId,
    stateKey,
    completedStepCount: normalizedCompletedStepCount
  };
  if (typeof queue?.onSubmittedWorkDone !== 'function') {
    return {
      ...base,
      fenceSatisfied: false,
      status: 'worker-queue-fence-unavailable',
      reason: 'worker-webgpu-device-queue-missing-at-resident-schedule-terminal',
      queueCompletionStatus: 'queue-completion-unavailable',
      queueCompletionMethod: null,
      authorityAdmissionReady: false
    };
  }
  try {
    await queue.onSubmittedWorkDone();
  } catch (error) {
    return {
      ...base,
      fenceSatisfied: false,
      status: 'gpu-fence-unsatisfied',
      reason: 'resident-schedule-terminal-worker-queue-completion-error',
      queueCompletionStatus: 'queue-completion-error',
      queueCompletionMethod: 'worker-device.queue.onSubmittedWorkDone',
      queueCompletionErrorName: error instanceof Error ? error.name : null,
      queueCompletionErrorMessage:
        error instanceof Error ? error.message : String(error),
      authorityAdmissionReady: false
    };
  }
  const terminalRefluxReceipt =
    await readWorkerResidentScheduleTerminalRefluxReceipt({
      required: terminalRefluxReceiptRequired,
      buffer: terminalRefluxRingBuffer,
      expectations: terminalRefluxExpectations,
      scheduleId,
      laneId,
      stateKey,
      completedStepCount: normalizedCompletedStepCount
    });
  const authorityAdmissionReady = Boolean(
    terminalRefluxReceiptRequired !== true
    || terminalRefluxReceipt.allStepsAdmitted === true
  );
  return {
    ...base,
    fenceSatisfied: true,
    status: authorityAdmissionReady
      ? 'gpu-fence-satisfied'
      : 'gpu-fence-satisfied-authority-rejected',
    reason: authorityAdmissionReady
      ? 'resident-schedule-terminal-worker-queue-completion-evidenced'
      : 'resident-schedule-terminal-reflux-receipt-rejected',
    queueCompletionStatus: 'queue-work-completed',
    queueCompletionMethod: 'worker-device.queue.onSubmittedWorkDone',
    authorityAdmissionReady,
    terminalRefluxReceipt
  };
}

export function cancelUlgMechanicsResidentStageWorkerSchedule(id) {
  const key = normalizeString(id, null);
  const state = key ? activeWorkerResidentScheduleByCancelKey.get(key) : null;
  if (!state) {
    return {
      status: 'resident-schedule-not-active',
      scheduleId: key,
      cancelRequested: false
    };
  }
  state.cancelRequested = true;
  return {
    status: 'resident-schedule-cancel-requested',
    scheduleId: state.scheduleId,
    cancelRequested: true
  };
}

export async function runUlgMechanicsResidentStageWorkerSchedulePayload(
  payload = {},
  {
    id = null,
    postProgress = null,
    runTier0FusedResidentSequence =
      runMlsMpmResidentStepsWithOptionalWebGpu
  } = {}
) {
  const scheduleFunctionEnteredAtMs = workerResidentScheduleNowMs();
  const schedule = payload.schedule && typeof payload.schedule === 'object'
    ? payload.schedule
    : {};
  const postedTargetScheduleAuthority =
    schedule.targetScheduleAuthority ?? null;
  let rawTargetScheduleAuthority = null;
  if (postedTargetScheduleAuthority != null) {
    try {
      // Latch the complete posted authority before this async function can
      // yield to a provider or mechanics runner. Validation, token burn,
      // retained state, and the emitted receipt all consume this immutable
      // worker-local copy, so callback-time mutation cannot authorize GPU
      // work or poison the lane's successor evidence.
      rawTargetScheduleAuthority =
        cloneAndDeepFreezeWorkerScheduleValue(
          postedTargetScheduleAuthority
        );
    } catch {
      throw workerResidentScheduleError(
        'target-schedule-authority-mismatch',
        'the posted target schedule authority is not clone-safe',
        {
          scheduleId:
            normalizeString(schedule.scheduleId, null)
            || normalizeString(id, null),
          stepOrdinal: 0,
          stageId: 'target-schedule-authority-latch'
        }
      );
    }
  }
  const laneId = normalizeString(
    payload.lease?.laneId ?? payload.lane?.laneId,
    null
  );
  const stateKey = normalizeString(
    payload.lease?.stateKey ?? payload.lane?.stateKey,
    null
  );
  const laneKey = laneKeyFor(payload);
  const scheduleId = normalizeString(schedule.scheduleId, null)
    || normalizeString(id, null)
    || `ulg-worker-resident-schedule:${workerResidentScheduleOrdinal++}`;
  const stepCount = Number(schedule.stepCount);
  if (!Number.isInteger(stepCount) || stepCount < 1) {
    throw workerResidentScheduleError(
      'schedule-step-count-invalid',
      `stepCount must be an integer in 1..${
        ULG_WORKER_RESIDENT_SCHEDULE_MAX_STEP_COUNT
      }, got ${schedule.stepCount}`,
      { scheduleId }
    );
  }
  if (stepCount > ULG_WORKER_RESIDENT_SCHEDULE_MAX_STEP_COUNT) {
    throw workerResidentScheduleError(
      'schedule-step-count-over-cap',
      `stepCount ${stepCount} exceeds the resident schedule cap ${
        ULG_WORKER_RESIDENT_SCHEDULE_MAX_STEP_COUNT
      }`,
      { scheduleId }
    );
  }
  const progressEverySteps = firstPositiveInteger(
    [schedule.progressEverySteps],
    1
  );
  const existingLaneRecord = retainedLanes.get(laneKey) || null;
  if (existingLaneRecord?.residentSchedulePoison) {
    throw workerResidentScheduleError(
      'lane-terminal-fence-poisoned',
      existingLaneRecord.residentSchedulePoison.reason,
      {
        scheduleId,
        laneState: workerResidentScheduleLaneStateSnapshot(existingLaneRecord, {
          laneId,
          stateKey
        })
      }
    );
  }
  const activeOnLane = activeWorkerResidentScheduleByLaneKey.get(laneKey);
  if (activeOnLane) {
    throw workerResidentScheduleError(
      'lane-schedule-already-active',
      `lane ${laneKey} is already running schedule ${activeOnLane.scheduleId}`,
      { scheduleId }
    );
  }
  const state = {
    scheduleId,
    id: normalizeString(id, null),
    laneKey,
    cancelRequested: false,
    workerDevice: null
  };
  const cancelKeys = [...new Set([state.scheduleId, state.id].filter(Boolean))];
  for (const cancelKey of cancelKeys) {
    if (activeWorkerResidentScheduleByCancelKey.has(cancelKey)) {
      throw workerResidentScheduleError(
        'schedule-id-already-active',
        `schedule id ${cancelKey} is already registered by an active schedule`,
        { scheduleId }
      );
    }
  }
  activeWorkerResidentScheduleByLaneKey.set(laneKey, state);
  for (const cancelKey of cancelKeys) {
    activeWorkerResidentScheduleByCancelKey.set(cancelKey, state);
  }
  let terminalRefluxRingBuffer = null;
  let terminalRefluxReceiptRequired = false;
  let scheduleControlPlaneTaskYielder = null;
  const terminalRefluxExpectations = [];
  try {
    const baseContext = workerContext(payload);
    const commonOptions = baseContext.common
      && typeof baseContext.common === 'object'
        ? baseContext.common
        : {};
    const baseStageOptions =
      baseContext.stageOptions && typeof baseContext.stageOptions === 'object'
        ? baseContext.stageOptions
        : {};
    const baseEpochOptions =
      baseStageOptions[SCHROEDER_SPATIAL_EPOCH_STAGE_ID] || {};
    const baseMechanicsOptions =
      baseStageOptions[SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID] || {};
    const scheduleStepOptionsProvider =
      typeof baseEpochOptions.scheduleStepOptionsProvider === 'function'
        ? baseEpochOptions.scheduleStepOptionsProvider
        : null;
    const scheduleStagePayload = (stageId, reads, writes, stageOptions) => ({
      stage: {
        id: stageId,
        lawNodeId: `ulg-mls-mpm-mechanics-${stageId}-stage`,
        runtimeTarget: 'gpu-hub-resident-stage-worker',
        reads: [...reads],
        writes: [...writes]
      },
      input: null,
      lease: {
        ...(payload.lease && typeof payload.lease === 'object'
          ? payload.lease
          : {}),
        laneId,
        stateKey
      },
      context: {
        ulgMechanicsResidentStageWorker: {
          ...baseContext,
          stageOptions: { ...baseStageOptions, [stageId]: stageOptions }
        }
      }
    });
    // Adaptive-laws Tier-1 seed: one schedule-scoped record of which law
    // families and epoch structures this schedule will encode, and why.
    // The epoch payload consumes it (sidecars / field views), and the
    // schedule result publishes it as the law activation receipt so
    // activation is DECLARED evidence, never an implicit side effect of
    // option plumbing. The day-2 validation layer consumes the receipt;
    // the GPU envelope-watch trigger will extend `reasons` with
    // per-schedule envelope-exit evidence.
    let scheduleLawActivationCache = null;
    const resolveScheduleLawActivation = () => {
      if (scheduleLawActivationCache) return scheduleLawActivationCache;
      const laneResidentOptions =
        record.schroederLane?.residentStepOptions
        || baseMechanicsOptions.residentStepOptions
        || {};
      const phaseVolumeMigration =
        baseEpochOptions.enablePhaseVolumeMigration === true
        || baseMechanicsOptions.enablePhaseVolumeMigration === true
        || baseMechanicsOptions.hierarchyConfig?.enablePhaseVolumeMigration === true;
      const twoLevelMechanics =
        baseMechanicsOptions.enableTwoLevelMechanics === true
        || baseMechanicsOptions.hierarchyConfig?.enableTwoLevelMechanics
          === true;
      const thermal = Boolean(laneResidentOptions.thermalMaterialTable);
      const reactionTable = laneResidentOptions.reactionTable ?? null;
      const reaction = reactionTable != null
        && !isExactQuiescentSphReactionTable(reactionTable);
      const lawQueue =
        baseMechanicsOptions.enableLawQueue === true
        || baseMechanicsOptions.hierarchyConfig?.enableLawQueue === true;
      const lawNeighborCandidates =
        baseMechanicsOptions.enableLawNeighborCandidates === true
        || baseMechanicsOptions.hierarchyConfig
          ?.enableLawNeighborCandidates === true;
      const surfaceTension =
        laneResidentOptions.mechanicsMaterialTable?.surfaceTensionEnabled === true;
      // Worker-private product history becomes schedule-actionable only
      // through the exact fenced predecessor observation. Mere buffer
      // retention is not clone-safe authority; an authenticated zero-live
      // arena is still a writer capability for products created by this step.
      const retainedProductGasBoundaryActionable =
        retainedPredecessorGasBoundaryActionable;
      const gasBoundaryActionable =
        retainedProductGasBoundaryActionable
        || Boolean(laneResidentOptions.gasPressureSummary?.gasCellField)
        || Boolean(laneResidentOptions.pressureInterfaceForceRowsBuffer)
        || Boolean(laneResidentOptions.pressureInterfaceForceSolver)
        || Boolean(laneResidentOptions.pressureInterfaceGasCellFieldImport)
        || Boolean(laneResidentOptions.pressureInterfaceGridForceAdmission)
        || laneResidentOptions.externalGaugePressureEnabled === true;
      const explicitVacuumAmbient =
        typeof laneResidentOptions.ambientPressurePa === 'number'
        && Number.isFinite(laneResidentOptions.ambientPressurePa)
        && laneResidentOptions.ambientPressurePa === 0;
      // Mechanics field views may be skipped only when every field-mode
      // consumer is provably absent for the whole schedule; a null ambient
      // can still receive atmospheric pressure from wall-ledger feedback,
      // which would demand buoyancy's field mode.
      const mechanicsFieldViews =
        baseEpochOptions.mechanicsFieldViewsRequired === true
        || phaseVolumeMigration
        || twoLevelMechanics
        || surfaceTension
        || gasBoundaryActionable
        || !explicitVacuumAmbient;
      const contactSolverRequested =
        laneResidentOptions.contactSolverEnabled !== false;
      const contactSolverEscalatedForDynamicLaws = Boolean(
        !contactSolverRequested
        && (
          thermal
          || reaction
          || lawQueue
          || lawNeighborCandidates
          || phaseVolumeMigration
          || twoLevelMechanics
          || surfaceTension
          || gasBoundaryActionable
        )
      );
      const contactSolver = Boolean(
        contactSolverRequested || contactSolverEscalatedForDynamicLaws
      );
      const receipt = Object.freeze({
        schema: ULG_WORKER_SCHEDULE_LAW_ACTIVATION_RECEIPT_SCHEMA,
        thermal,
        reaction,
        contactSolver,
        contactSolverRequested,
        contactSolverEscalatedForDynamicLaws,
        lawQueue,
        lawNeighborCandidates,
        phaseVolumeMigration,
        twoLevelMechanics,
        surfaceTension,
        gasBoundaryActionable,
        explicitVacuumAmbient,
        phaseVolumeSidecars: phaseVolumeMigration || twoLevelMechanics,
        mechanicsFieldViews,
        activationAuthority:
          'schedule-config-static-declaration-no-readback'
      });
      scheduleLawActivationCache = receipt;
      return receipt;
    };
    const epochOptionsForStep = async (stepOrdinal, previousEpochSeal) => {
      const {
        scheduleStepOptionsProvider: ignoredProvider,
        ...stepZeroOptions
      } = baseEpochOptions;
      // The epoch stage gates the phase-volume moment/receipt sidecars and
      // mechanics field views on their consumers; the schedule-scoped
      // activation record is the single source of that derivation.
      const scheduleLawActivation = resolveScheduleLawActivation();
      stepZeroOptions.enablePhaseVolumeMigration =
        stepZeroOptions.enablePhaseVolumeMigration === true
        || scheduleLawActivation.phaseVolumeMigration;
      stepZeroOptions.mechanicsFieldViewsRequired =
        stepZeroOptions.mechanicsFieldViewsRequired === true
        || scheduleLawActivation.mechanicsFieldViews;
      if (stepOrdinal === 1) {
        // W4b: a RETAINED lane starting a new schedule with no step-1 source
        // at all — seed already consumed, no committed successor family, no
        // payload-supplied levelAssignment/activeNodeList — consults the
        // schedule provider exactly as steps 2+ do. Every existing step-1
        // source keeps absolute precedence; this branch only replaces the
        // 'level-assignment-source-missing' dead end on lane continuation.
        const stepOneLane = record.schroederLane || null;
        const stepOneLaneNeedsProvider = Boolean(
          scheduleStepOptionsProvider
          && stepOneLane
          && !stepOneLane.successorSourceFamily
          && !(stepOneLane.laneSeed && stepOneLane.laneSeed.consumed !== true)
          && stepZeroOptions.levelAssignment == null
          && stepZeroOptions.activeNodeList == null
          && stepOneLane.sphParticleUpload?.stateBuffer
        );
        if (!stepOneLaneNeedsProvider) return stepZeroOptions;
        const providerOverrides = await scheduleStepOptionsProvider({
          scheduleId,
          stepOrdinal,
          previousEpochSeal
        });
        return {
          ...stepZeroOptions,
          useWorkerRetainedParticleBuffers: true,
          ...(providerOverrides && typeof providerOverrides === 'object'
            ? providerOverrides
            : {})
        };
      }
      // Continuation steps rebuild from the lane's retained post-step
      // buffers (or the retained successor source family when the kernel
      // committed one). Step-0-only sources are stripped so a stale
      // level assignment cannot silently feed a later step: a step without
      // an advanced assignment fails the epoch-identity seal below.
      const {
        sphParticleUpload: ignoredSphUpload,
        mlsMpmParticleUpload: ignoredMlsUpload,
        levelAssignment: ignoredLevelAssignment,
        activeNodeList: ignoredActiveNodeList,
        schroederSpatialSuccessorSourceFamily: ignoredSourceFamily,
        particleIdentityBuffer: ignoredIdentityBuffer,
        ...continuationOptions
      } = stepZeroOptions;
      const providerOverrides = scheduleStepOptionsProvider
        ? await scheduleStepOptionsProvider({
            scheduleId,
            stepOrdinal,
            previousEpochSeal
          })
        : null;
      return {
        ...continuationOptions,
        useWorkerRetainedParticleBuffers: true,
        ...(providerOverrides && typeof providerOverrides === 'object'
          ? providerOverrides
          : {})
      };
    };
    const mechanicsOptionsForStep = (epochSeal, stepOrdinal) => {
      const {
        expectedSpatialEpochSeal: ignoredExpectedSeal,
        [SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_TARGET_OPTION]:
          ignoredTopLevelTerminalRefluxTarget,
        residentStepOptions: requestedResidentStepOptions = null,
        ...continuationOptions
      } = baseMechanicsOptions;
      const cleanResidentStepOptions = {
        ...(requestedResidentStepOptions
          && typeof requestedResidentStepOptions === 'object'
          ? requestedResidentStepOptions
          : {})
      };
      const scheduleLawActivation = resolveScheduleLawActivation();
      cleanResidentStepOptions.contactSolverEnabled =
        scheduleLawActivation.contactSolver;
      // Shadow-only Phase-B seed: only the terminal ordinal requests a compact
      // watch. The resident route submits it after the exact published
      // post-closure family exists; the worker's schedule-terminal fence then
      // orders the single four-byte map.
      cleanResidentStepOptions.captureReactionActivationObservation = Boolean(
        scheduleReactionActivationWatchTable
        && scheduleReactionActivationMotionEnvelope
        && stepOrdinal === stepCount
      );
      cleanResidentStepOptions.reactionActivationMotionEnvelope =
        cleanResidentStepOptions.captureReactionActivationObservation
          ? scheduleReactionActivationMotionEnvelope
          : null;
      delete cleanResidentStepOptions[
        SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_TARGET_OPTION
      ];
      let terminalRefluxReceiptTarget = null;
      if (terminalRefluxReceiptRequired) {
        const levels = Array.isArray(epochSeal?.mechanicsLevels)
          ? epochSeal.mechanicsLevels
          : [];
        if (
          !terminalRefluxRingBuffer
          || levels.length !== 2
          || !levels.every(Number.isSafeInteger)
        ) {
          throw workerResidentScheduleError(
            'schedule-terminal-reflux-target-unavailable',
            'authoritative two-level receipt target requires one ring and two exact mechanics levels',
            { scheduleId, stepOrdinal }
          );
        }
        terminalRefluxReceiptTarget =
          createSchroederFusedTerminalRefluxReceiptTarget({
          device: state.workerDevice,
          scheduleId,
          laneId,
          stateKey,
          stepOrdinal,
          targetBuffer: terminalRefluxRingBuffer,
          targetOffsetBytes: (stepOrdinal - 1)
            * SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_BYTE_LENGTH,
          targetByteLength:
            SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_BYTE_LENGTH,
          expectedCompletionOrdinal: epochSeal.generationId,
          expectedFineSubstepCount: twoLevelFineSubstepCountRequested,
          expectedFineLevel: levels[0],
          expectedCoarseLevel: levels[1]
        });
      }
      // The driver pins each step's mechanics stage to the seal of the
      // generation IT just built; a caller-supplied seal is only valid for
      // one generation and would go stale on step 2.
      // A diagnostic schedule transports only its terminal hierarchy summary.
      // Mapping multi-megabyte mechanics traces for discarded intermediate
      // summaries serialized the entire hot loop without producing any
      // additional evidence. Trace the exact terminal step that the schedule
      // can actually publish.
      return {
        ...continuationOptions,
        stageMechanicsTraceEnabled:
          continuationOptions.stageMechanicsTraceEnabled === true
          && stepOrdinal === stepCount,
        expectedSpatialEpochSeal: epochSeal,
        residentStepOptions: {
          ...cleanResidentStepOptions,
          ...(terminalRefluxReceiptTarget
            ? {
                [SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_TARGET_OPTION]:
                  terminalRefluxReceiptTarget
              }
            : {})
        }
      };
    };
    const record = getLaneRecord(payload);
    // The scene sends immutable material/law options only with a fresh seed.
    // Persist that first schedule snapshot before route selection so Tier0
    // does not bypass the canonical mechanics stage that historically stored
    // it, and later schedules cannot silently re-enable default contact.
    const scheduleLaneHadResidentStepOptions = Boolean(
      record.schroederLane
      && Object.prototype.hasOwnProperty.call(
        record.schroederLane,
        'residentStepOptions'
      )
    );
    const scheduleLaneResidentStepOptionsBeforeRequest =
      record.schroederLane?.residentStepOptions;
    persistWorkerScheduleResidentStepOptions(
      record.schroederLane,
      baseMechanicsOptions.residentStepOptions
    );
    const restoreScheduleResidentStepOptions = () => {
      if (scheduleLaneHadResidentStepOptions && record.schroederLane) {
        record.schroederLane.residentStepOptions =
          scheduleLaneResidentStepOptionsBeforeRequest;
      } else if (record.schroederLane) {
        delete record.schroederLane.residentStepOptions;
      }
    };
    // W4a: a seeded lane's epoch-identity monotonicity baseline is the SEED
    // lineage. The step that consumes the retained seeded assignment must
    // carry exactly the seeded identity words (the epoch it builds IS the
    // seeded epoch); every other unpreceded first step on a seeded lane —
    // including a schedule started after single-stage messages consumed the
    // seed — must strictly advance beyond the seeded words.
    const scheduleStartLane = record.schroederLane || null;
    const retainedPredecessorTargetScheduleAuthorityRaw =
      scheduleStartLane?.nextScheduleTargetAuthority ?? null;
    const retainedPredecessorTargetScheduleAuthority =
      retainedPredecessorTargetScheduleAuthorityRaw == null
        ? null
        : exactSchroederTargetScheduleAuthority(
            retainedPredecessorTargetScheduleAuthorityRaw
          );
    const retainedPredecessorDynamicLawObservationRaw =
      scheduleStartLane?.nextScheduleLawActivationObservation ?? null;
    const retainedPredecessorDynamicLawObservation =
      retainedPredecessorDynamicLawObservationRaw == null
        ? null
        : exactWorkerDynamicLawObservationSelf(
            retainedPredecessorDynamicLawObservationRaw
          );
    const retainedPredecessorGasBoundaryActionable =
      schroederTargetScheduleSuccessorGasBoundaryActionable({
        predecessorTargetScheduleAuthority:
          retainedPredecessorTargetScheduleAuthority,
        predecessorDynamicLawObservation:
          retainedPredecessorDynamicLawObservation
      });
    const scheduleStartParticleFamilyCounts = Object.freeze({
      sphState: Number(scheduleStartLane?.sphParticleState?.particleCount),
      sphUpload: Number(scheduleStartLane?.sphParticleUpload?.particleCount),
      mlsMpmState: Number(
        scheduleStartLane?.mlsMpmParticleState?.particleCount
      ),
      mlsMpmUpload: Number(
        scheduleStartLane?.mlsMpmParticleUpload?.particleCount
      )
    });
    const scheduleStartLaneSeed = scheduleStartLane?.laneSeed || null;
    const seedConsumptionExpectedAtStepOne = Boolean(
      scheduleStartLaneSeed
      && scheduleStartLaneSeed.consumed !== true
      && !scheduleStartLane.successorSourceFamily
    );
    const seedBaselineIdentity = scheduleStartLaneSeed
      ? (seedConsumptionExpectedAtStepOne
          ? { ...scheduleStartLaneSeed.lineage }
          : workerResidentScheduleEpochIdentity(scheduleStartLane.epochSeal)
            || { ...scheduleStartLaneSeed.lineage })
      : null;
    let scheduleStartTier0ContinuationIdentity =
      scheduleStartLane?.tier0ContinuationIdentity
        ? { ...scheduleStartLane.tier0ContinuationIdentity }
        : null;
    const tier0SourceLineage = exactWorkerScheduleParticleFamilyLineage({
      sphParticleUpload: scheduleStartLane?.sphParticleUpload,
      mlsMpmParticleUpload: scheduleStartLane?.mlsMpmParticleUpload
    });
    const tier0ExpectedLineage = expectedWorkerTier0TerminalLineage(
      tier0SourceLineage,
      stepCount
    );
    const tier0PhaseCarrierPlan =
      scheduleStartLane?.sphParticleUpload?.phaseCarrierPlan
      ?? scheduleStartLane?.sphParticleState?.phaseCarrierPlan
      ?? null;
    const tier0TopologyAttestation = workerTier0TopologyAttestation({
      phaseCarrierPlan: tier0PhaseCarrierPlan,
      sourceSphUpload: scheduleStartLane?.sphParticleUpload,
      sourceMlsUpload: scheduleStartLane?.mlsMpmParticleUpload,
      device: record.workerDevice
    });
    const scheduleLawActivation = resolveScheduleLawActivation();
    const scheduleResidentStepOptions =
      scheduleStartLane?.residentStepOptions
      || baseMechanicsOptions.residentStepOptions
      || {};
    // A dormant table is observation input only. It must never participate in
    // the static activation receipt or Tier0 blocker derivation. Canonical
    // schedules watch their executing table; laws-quiescent Tier0 schedules
    // may instead receive this separately named immutable descriptor.
    const scheduleReactionActivationWatchTable = scheduleLawActivation.reaction
      ? scheduleResidentStepOptions.reactionTable ?? null
      : scheduleResidentStepOptions.reactionActivationWatchTable ?? null;
    if (
      scheduleReactionActivationWatchTable
      && !rawTargetScheduleAuthority
      && retainedPredecessorDynamicLawObservationRaw == null
    ) {
      restoreScheduleResidentStepOptions();
      throw workerResidentScheduleError(
        'target-schedule-authority-required',
        'dynamic-law observation requires an independently authored schedule authority',
        {
          scheduleId,
          stepOrdinal: 0,
          stageId: 'target-schedule-authority-preflight',
          laneState: workerResidentScheduleLaneStateSnapshot(record, {
            laneId,
            stateKey
          })
        }
      );
    }
    const scheduleStepOptionsProviderAuthority = scheduleStepOptionsProvider
      ? (
          workerLaneScheduleProviderAuthority.get(scheduleStepOptionsProvider)
          || createSchroederTargetScheduleProviderAuthority({
            kind: 'general-unsealed'
          })
        )
      : createSchroederTargetScheduleProviderAuthority({ kind: 'none' });
    let scheduleTargetWriterSet = null;
    let scheduleTargetTableFingerprints = null;
    let scheduleReactionActivationMotionEnvelope = null;
    let scheduleReactionActivationMotionEnvelopeFailure = null;
    let admittedTargetScheduleAuthority = null;
    let predecessorTargetTokenConsumption = null;
    let predecessorConfigurationContinuity = null;
    let authenticatedDynamicReactionSuccessor = false;
    if (rawTargetScheduleAuthority || scheduleReactionActivationWatchTable) {
      try {
        scheduleTargetWriterSet = createSchroederTargetScheduleWriterSet({
          residentStepOptions: scheduleResidentStepOptions,
          epochOptions: baseEpochOptions,
          mechanicsOptions: baseMechanicsOptions,
          hierarchyConfig: baseMechanicsOptions.hierarchyConfig,
          scheduleStepOptionsProvider: scheduleStepOptionsProviderAuthority,
          retainedProductGasBoundaryActionable:
            retainedPredecessorGasBoundaryActionable
        });
        scheduleTargetTableFingerprints =
          createSchroederTargetScheduleTableFingerprints({
            residentStepOptions: scheduleResidentStepOptions,
            executingReactionActive: scheduleLawActivation.reaction
          });
        scheduleReactionActivationMotionEnvelope =
          createSphReactionMotionEnvelope({
            maxFutureSubsteps: stepCount,
            dtS:
              commonOptions.dt
              ?? scheduleStartLane?.mlsMpmParticleState?.mechanicsDtS
              ?? 0,
            gridSpacingM:
              commonOptions.gridSpacingM
              ?? scheduleStartLane?.sphParticleState?.smoothingLengthM,
            cflFactor:
              commonOptions.cflFactor
              ?? scheduleStartLane?.mlsMpmParticleState?.gridCflFactor
              ?? 0.4,
            boxDimsM: commonOptions.boxDimsM ?? [5, 5, 5],
            separationDisplacementEnabled:
              scheduleTargetWriterSet.contactSolver !== true,
            contactCorrectionEnabled:
              scheduleTargetWriterSet.contactSolver === true,
            thermalPhaseEvolutionEnabled:
              scheduleTargetWriterSet.thermalPhaseEvolutionEnabled
          });
      } catch (error) {
        scheduleReactionActivationMotionEnvelopeFailure =
          error instanceof Error ? error.message : String(error);
      }
    }
    const postedPredecessorDynamicLawObservation =
      rawTargetScheduleAuthority?.predecessorDynamicLawObservation ?? null;
    const postedPredecessorTargetScheduleRequestId =
      postedPredecessorDynamicLawObservation?.targetScheduleRequestId ?? null;
    const lastConsumedDynamicLawTargetScheduleRequestId =
      scheduleStartLane?.lastConsumedDynamicLawTargetScheduleRequestId ?? null;
    let predecessorTargetTokenFailureReason = null;
    let predecessorTargetTokenFailureDetail = null;
    if (
      postedPredecessorTargetScheduleRequestId != null
      && postedPredecessorTargetScheduleRequestId
        === lastConsumedDynamicLawTargetScheduleRequestId
    ) {
      predecessorTargetTokenFailureReason =
        'predecessor-target-token-replayed';
      predecessorTargetTokenFailureDetail =
        'the predecessor target request was already consumed on this lane';
    } else if (
      retainedPredecessorDynamicLawObservationRaw != null
      && (
        !retainedPredecessorTargetScheduleAuthority
        || retainedPredecessorDynamicLawObservationRaw.sourceScheduleId
          !== retainedPredecessorTargetScheduleAuthority.sourceScheduleId
        || retainedPredecessorDynamicLawObservationRaw
          .targetScheduleRequestId
          !== retainedPredecessorTargetScheduleAuthority
            .targetScheduleRequestId
        || retainedPredecessorDynamicLawObservationRaw
          .targetScheduleAuthorityFingerprint
          !== retainedPredecessorTargetScheduleAuthority.requestFingerprint
        || retainedPredecessorDynamicLawObservationRaw.laneId
          !== retainedPredecessorTargetScheduleAuthority.laneId
        || retainedPredecessorDynamicLawObservationRaw.stateKey
          !== retainedPredecessorTargetScheduleAuthority.stateKey
      )
    ) {
      predecessorTargetTokenFailureReason =
        'predecessor-target-token-state-unavailable';
      predecessorTargetTokenFailureDetail =
        'the worker-retained predecessor authority does not bind the retained observation';
    } else if (
      retainedPredecessorDynamicLawObservationRaw != null
      && !retainedPredecessorDynamicLawObservation
    ) {
      predecessorTargetTokenFailureReason =
        'predecessor-target-token-state-unavailable';
      predecessorTargetTokenFailureDetail =
        'the worker-retained predecessor observation is not exact';
    } else if (retainedPredecessorDynamicLawObservation) {
      const retainedWriterEvidence =
        retainedPredecessorDynamicLawObservation.prospectiveWriterEvidence;
      const retainedProductHistoryHandle =
        previousWorkerResidentProductMass(record)
        ?? scheduleStartLane?.residentStepOptions?.residentProductMass
        ?? null;
      const currentProductHistoryArenaIdentity =
        describeResidentProductHistoryArenaIdentity(
          state.workerDevice,
          retainedProductHistoryHandle
        );
      if (
        retainedWriterEvidence?.gasBoundaryActionable === true
        && (
          retainedProductHistoryHandle?.productEventBufferRetained !== true
          || retainedProductHistoryHandle.productEventRowCount
            !== retainedWriterEvidence.productEventRowCount
          || !workerRouteValuesEqual(
            currentProductHistoryArenaIdentity,
            retainedWriterEvidence.productHistoryArenaIdentity
          )
        )
      ) {
        predecessorTargetTokenFailureReason =
          'predecessor-target-token-mismatch';
        predecessorTargetTokenFailureDetail =
          'the retained product-history arena no longer matches its fenced predecessor identity';
      } else if (postedPredecessorDynamicLawObservation == null) {
        predecessorTargetTokenFailureReason =
          'predecessor-target-token-missing';
        predecessorTargetTokenFailureDetail =
          'the next schedule omitted the worker-retained predecessor observation';
      } else if (
        !exactWorkerDynamicLawObservationSelf(
          postedPredecessorDynamicLawObservation
        )
        || !workerRouteValuesEqual(
          postedPredecessorDynamicLawObservation,
          retainedPredecessorDynamicLawObservation
        )
      ) {
        predecessorTargetTokenFailureReason =
          'predecessor-target-token-mismatch';
        predecessorTargetTokenFailureDetail =
          'the posted predecessor observation does not exactly match worker-retained state';
      }
    } else if (postedPredecessorDynamicLawObservation != null) {
      predecessorTargetTokenFailureReason =
        'predecessor-target-token-state-unavailable';
      predecessorTargetTokenFailureDetail =
        'the posted predecessor observation has no worker-retained authority';
    }
    if (predecessorTargetTokenFailureReason) {
      restoreScheduleResidentStepOptions();
      throw workerResidentScheduleError(
        predecessorTargetTokenFailureReason,
        predecessorTargetTokenFailureDetail,
        {
          scheduleId,
          stepOrdinal: 0,
          stageId: 'predecessor-target-token-preflight',
          laneState: workerResidentScheduleLaneStateSnapshot(record, {
            laneId,
            stateKey
          })
        }
      );
    }
    if (rawTargetScheduleAuthority) {
      let targetScheduleAuthorityAdmission = null;
      if (
        !scheduleReactionActivationMotionEnvelopeFailure
        && schroederTargetScheduleWriterSetMatchesActivation(
          scheduleTargetWriterSet,
          scheduleLawActivation
        )
      ) {
        targetScheduleAuthorityAdmission =
          validateSchroederTargetScheduleAuthorityForExecution(
            rawTargetScheduleAuthority,
            {
              sourceScheduleId: scheduleId,
              laneId,
              stateKey,
              sourceLineage: tier0SourceLineage,
              sourceParticleCount:
                scheduleStartParticleFamilyCounts.sphUpload,
              sourcePhaseLaneCount: Number(
                tier0PhaseCarrierPlan?.phaseLaneCount
              ),
              motionEnvelope: scheduleReactionActivationMotionEnvelope,
              writerSet: scheduleTargetWriterSet,
              scheduleStepOptionsProvider:
                scheduleStepOptionsProviderAuthority,
              tableFingerprints: scheduleTargetTableFingerprints
            }
          );
      }
      if (targetScheduleAuthorityAdmission?.ready !== true) {
        restoreScheduleResidentStepOptions();
        throw workerResidentScheduleError(
          'target-schedule-authority-mismatch',
          scheduleReactionActivationMotionEnvelopeFailure
            || targetScheduleAuthorityAdmission?.reason
            || 'target-authority-activation',
          {
            scheduleId,
            stepOrdinal: 0,
            stageId: 'target-schedule-authority-preflight',
            laneState: workerResidentScheduleLaneStateSnapshot(record, {
              laneId,
              stateKey
            })
          }
        );
      }
      admittedTargetScheduleAuthority =
        targetScheduleAuthorityAdmission.authority;
      // Keep the worker-local sealed envelope after the independently posted
      // clone has exactly matched it. structuredClone intentionally strips
      // Object.freeze state, while the GPU watch requires the sealed brand.
      if (retainedPredecessorDynamicLawObservation) {
        predecessorConfigurationContinuity =
          validateSchroederTargetScheduleConfigurationContinuity({
            predecessorTargetScheduleAuthority:
              retainedPredecessorTargetScheduleAuthority,
            currentTargetScheduleAuthority: admittedTargetScheduleAuthority,
            predecessorDynamicLawObservation:
              retainedPredecessorDynamicLawObservation
          });
        if (predecessorConfigurationContinuity.ready !== true) {
          restoreScheduleResidentStepOptions();
          throw workerResidentScheduleError(
            'predecessor-target-token-mismatch',
            `the retained predecessor target authority does not admit the consuming schedule configuration: ${predecessorConfigurationContinuity.reason}`,
            {
              scheduleId,
              stepOrdinal: 0,
              stageId: 'predecessor-target-token-preflight',
              laneState: workerResidentScheduleLaneStateSnapshot(record, {
                laneId,
                stateKey
              })
            }
          );
        }
        authenticatedDynamicReactionSuccessor =
          predecessorConfigurationContinuity.mode
            === 'prospective-reaction-dormant-to-executing';
        if (
          authenticatedDynamicReactionSuccessor
          && (
            scheduleLawActivation.reaction !== true
            || admittedTargetScheduleAuthority?.writerSet?.reaction !== true
          )
        ) {
          restoreScheduleResidentStepOptions();
          throw workerResidentScheduleError(
            'dynamic-reaction-successor-not-executable',
            'an authenticated dormant-to-executing successor must declare and recompute reaction execution before route selection',
            {
              scheduleId,
              stepOrdinal: 0,
              stageId: 'predecessor-target-token-preflight',
              laneState: workerResidentScheduleLaneStateSnapshot(record, {
                laneId,
                stateKey
              })
            }
          );
        }
        // The exact retained token is burned only after the complete current
        // authority has been admitted, and still before route selection or
        // any schedule GPU work. A later failure cannot replay it on this
        // worker lane.
        predecessorTargetTokenConsumption = Object.freeze({
          schema:
            'peercompute.ulg.worker-predecessor-target-token-consumption.v2',
          status:
            'predecessor-target-token-consumed-before-route-selection',
          predecessorScheduleId:
            retainedPredecessorDynamicLawObservation.sourceScheduleId,
          targetScheduleRequestId:
            retainedPredecessorDynamicLawObservation.targetScheduleRequestId,
          targetScheduleAuthorityFingerprint:
            retainedPredecessorDynamicLawObservation
              .targetScheduleAuthorityFingerprint,
          consumerScheduleId: scheduleId,
          laneId,
          stateKey,
          terminalLineage: Object.freeze({
            ...retainedPredecessorDynamicLawObservation.terminalLineage
          }),
          sourceParticleCount:
            scheduleStartParticleFamilyCounts.sphUpload,
          sourcePhaseLaneCount: Number(
            tier0PhaseCarrierPlan?.phaseLaneCount
          ),
          conservativeActivationRequired:
            predecessorConfigurationContinuity
              .conservativeActivationRequired === true,
          configurationContinuityMode:
            predecessorConfigurationContinuity.mode,
          predecessorConfigurationFingerprint:
            predecessorConfigurationContinuity
              .predecessorConfigurationFingerprint,
          currentConfigurationFingerprint:
            predecessorConfigurationContinuity.currentConfigurationFingerprint,
          prospectiveDynamicLawTransitionFingerprint:
            predecessorConfigurationContinuity
              .prospectiveDynamicLawTransitionFingerprint,
          consumedBeforeRouteSelection: true,
          consumedBeforeGpuWork: true,
          shadowOnly: SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY,
          routingAuthority: SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY,
          executionGating: SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE
        });
        scheduleStartLane.nextScheduleLawActivationObservation = null;
        scheduleStartLane.nextScheduleTargetAuthority = null;
        scheduleStartLane.lastConsumedDynamicLawTargetScheduleRequestId =
          retainedPredecessorDynamicLawObservation
            .targetScheduleRequestId;
      }
    }
    const scheduleReactionActivationWatchRequested = Boolean(
      scheduleReactionActivationWatchTable
    );
    const tier0RouteBlockers = [];
    if (stepCount < 2) tier0RouteBlockers.push('step-count-not-greater-than-one');
    if (
      scheduleStepOptionsProvider
      && !workerLaneAssignmentOnlyScheduleProviders.has(
        scheduleStepOptionsProvider
      )
    ) {
      // Provider output is resolved only while building canonical epochs. It
      // may introduce a new assignment, migration/view request, or other law
      // activation, so Tier0 cannot bypass it without first authenticating a
      // schedule-boundary provider receipt.
      tier0RouteBlockers.push('schedule-step-options-provider-present');
    }
    if (scheduleLawActivation.thermal) tier0RouteBlockers.push('thermal-active');
    if (scheduleLawActivation.reaction) tier0RouteBlockers.push('reaction-active');
    if (scheduleLawActivation.contactSolver) {
      tier0RouteBlockers.push('contact-solver-active');
    }
    if (scheduleLawActivation.lawQueue) tier0RouteBlockers.push('law-queue-active');
    if (scheduleLawActivation.lawNeighborCandidates) {
      tier0RouteBlockers.push('law-neighbor-candidates-active');
    }
    if (scheduleLawActivation.phaseVolumeMigration) {
      tier0RouteBlockers.push('phase-volume-migration-active');
    }
    if (scheduleLawActivation.twoLevelMechanics) {
      tier0RouteBlockers.push('two-level-mechanics-active');
    }
    if (scheduleLawActivation.surfaceTension) {
      tier0RouteBlockers.push('surface-tension-active');
    }
    if (scheduleLawActivation.gasBoundaryActionable) {
      tier0RouteBlockers.push('gas-boundary-actionable');
    }
    if (scheduleLawActivation.mechanicsFieldViews) {
      tier0RouteBlockers.push('mechanics-field-views-required');
    }
    const crossLevelCouplingActive =
      baseMechanicsOptions.enableCrossLevelCoupling === true
      || baseMechanicsOptions.hierarchyConfig?.enableCrossLevelCoupling
        === true;
    if (crossLevelCouplingActive) {
      tier0RouteBlockers.push('cross-level-coupling-active');
    }
    if (!scheduleStartLane) tier0RouteBlockers.push('worker-lane-not-seeded');
    if (!record.workerDevice || scheduleStartLane?.device !== record.workerDevice) {
      tier0RouteBlockers.push('worker-lane-device-unavailable');
    }
    if (
      !scheduleStartLane?.sphParticleState
      || !scheduleStartLane?.mlsMpmParticleState
      || !scheduleStartLane?.sphParticleUpload?.stateBuffer
      || !scheduleStartLane?.sphParticleUpload?.thermoBuffer
      || !scheduleStartLane?.sphParticleUpload?.identityBuffer
      || !scheduleStartLane?.mlsMpmParticleUpload?.mechanicsBuffer
    ) tier0RouteBlockers.push('worker-lane-particle-family-incomplete');
    if (!tier0SourceLineage) tier0RouteBlockers.push('source-lineage-invalid');
    if (
      tier0SourceLineage
      && tier0SourceLineage.physicsSubstep !== 0
    ) tier0RouteBlockers.push('source-physics-substep-not-terminal');
    if (!tier0ExpectedLineage) tier0RouteBlockers.push('terminal-lineage-unavailable');
    if (!workerTier0LawsQuiescentPhaseCarrierPlan(tier0PhaseCarrierPlan)) {
      tier0RouteBlockers.push('phase-carrier-plan-not-single-lane-quiescent');
    }
    if (
      tier0TopologyAttestation?.status
        !== 'tier0-topology-quiescence-attested'
    ) tier0RouteBlockers.push('tier0-topology-attestation-incomplete');
    if (scheduleStartLane?.successorSourceFamily) {
      tier0RouteBlockers.push('successor-source-family-retained');
    }
    if (
      scheduleStartLane?.epochGeneration
      && scheduleStartLane.epochConsumed !== true
    ) tier0RouteBlockers.push('unconsumed-canonical-epoch-retained');
    if (scheduleStartLane?.executionMode === 'canonical-schroeder') {
      // The inverse transition owns hierarchy-transfer cleanup that this
      // first slice deliberately does not pretend to retire.
      tier0RouteBlockers.push('canonical-to-tier0-reentry-not-admitted');
    }
    if (
      scheduleStartLane?.residentStepOptions?.residentProductMass
    ) tier0RouteBlockers.push('resident-product-mass-active');
    if (
      baseMechanicsOptions.enableMechanicsFieldPairV2 === true
      || baseMechanicsOptions.hierarchyConfig?.enableMechanicsFieldPairV2
        === true
    ) tier0RouteBlockers.push('mechanics-field-pair-v2-active');
    if (
      scheduleStartLane?.residentStepOptions?.pressureInterfaceForceRowsBuffer
    ) tier0RouteBlockers.push('pressure-interface-force-rows-active');
    if (
      scheduleStartLane?.residentStepOptions?.pressureInterfaceForceSolver
    ) tier0RouteBlockers.push('pressure-interface-force-solver-active');
    if (
      scheduleStartLane?.sphParticleUpload?.status !== 'webgpu-uploaded'
    ) tier0RouteBlockers.push('sph-particle-upload-not-resident');
    if (
      scheduleStartLane?.mlsMpmParticleUpload?.status !== 'webgpu-uploaded'
    ) tier0RouteBlockers.push('mls-mpm-upload-not-resident');
    for (const [field, blocker] of [
      ['p2gRunner', 'custom-p2g-runner'],
      ['gridUpdateRunner', 'custom-grid-update-runner'],
      ['g2pRunner', 'custom-g2p-runner'],
      ['p2gStageRunner', 'custom-p2g-stage-runner'],
      ['gridUpdateStageRunner', 'custom-grid-update-stage-runner'],
      ['g2pStageRunner', 'custom-g2p-stage-runner']
    ]) {
      if (scheduleStartLane?.residentStepOptions?.[field]) {
        tier0RouteBlockers.push(blocker);
      }
    }
    if (
      [
        'residentGpuTimestampProfilingRequested',
        'residentGpuTimestampProfiling',
        'observeCanonicalSpatialAuthority',
        'consumeCompactMechanicsView',
        'contactKinematicsParticleBinMetadataReadback',
        'contactCleanupProfileReadback',
        'reactionParticleBinMetadataReadback'
      ].some(
        (field) => scheduleStartLane?.residentStepOptions?.[field] === true
      )
      || baseMechanicsOptions.stageMechanicsTraceEnabled === true
    ) tier0RouteBlockers.push('diagnostic-readback-requested');
    const declaredLawsQuiescent = !(
      scheduleLawActivation.thermal
      || scheduleLawActivation.reaction
      || scheduleLawActivation.contactSolver
      || scheduleLawActivation.lawQueue
      || scheduleLawActivation.lawNeighborCandidates
      || scheduleLawActivation.phaseVolumeMigration
      || scheduleLawActivation.twoLevelMechanics
      || scheduleLawActivation.surfaceTension
      || scheduleLawActivation.gasBoundaryActionable
      || scheduleLawActivation.mechanicsFieldViews
      || crossLevelCouplingActive
    );
    const tier0RouteSelected = tier0RouteBlockers.length === 0;
    if (authenticatedDynamicReactionSuccessor && tier0RouteSelected) {
      restoreScheduleResidentStepOptions();
      throw workerResidentScheduleError(
        'dynamic-reaction-successor-tier0-route-rejected',
        'an authenticated dormant-to-executing successor may only enter the canonical Schroeder route',
        {
          scheduleId,
          stepOrdinal: 0,
          stageId: 'schedule-route-selection',
          laneState: workerResidentScheduleLaneStateSnapshot(record, {
            laneId,
            stateKey
          })
        }
      );
    }
    const executionRouteDecision = Object.freeze({
      schema: 'peercompute.ulg.worker-schedule-execution-route-decision.v0',
      status: tier0RouteSelected
        ? 'tier0-fused-resident-sequence-selected'
        : 'canonical-schroeder-selected',
      route: tier0RouteSelected
        ? 'tier0-fused-resident-sequence'
        : 'canonical-schroeder',
      lawsQuiescent: declaredLawsQuiescent,
      activationReceipt: scheduleLawActivation,
      blockers: [...tier0RouteBlockers],
      transition: tier0RouteSelected
        ? (scheduleStartLane?.executionMode
            === 'tier0-fused-resident-sequence'
          ? 'tier0-continuation'
          : 'fresh-to-tier0-schedule-boundary')
        : (scheduleStartTier0ContinuationIdentity
          ? 'tier0-to-canonical-schedule-boundary'
          : 'fresh-or-canonical-continuation')
    });
    let executionRouteReceipt = null;
    const phaseCarrierOneToFourMaterializationRequired =
      workerScheduleRequiresPhaseCarrierOneToFourMaterialization({
        phaseCarrierPlan: tier0PhaseCarrierPlan,
        scheduleLawActivation,
        canonicalRouteSelected: !tier0RouteSelected,
        tier0ContinuationIdentityPresent: Boolean(
          scheduleStartTier0ContinuationIdentity
        )
      });
    let phaseCarrierOneToFourExecution = null;
    let phaseCarrierOneToFourValidation = null;
    let phaseCarrierOneToFourTransitionReceipt = null;
    let phaseCarrierAuxiliaryOwnershipTransfer = null;
    let phaseCarrierOneToFourAdopted = false;
    let phaseCarrierOneToFourSourceResidentStep = null;
    let phaseCarrierOneToFourSourceUploads = null;
    let phaseCarrierOneToFourSourceRetirement = null;
    let tier0ExecutionAttempted = false;
    let tier0ExecutionResult = null;
    let tier0ExecutionValidation = null;
    let tier0SupersededResidentStep = null;
    let tier0SupersededUploads = null;
    let tier0RetainedBufferRefs = [];
    let tier0SupersededFamilyRetirement = null;
    const tier0SubmittedCleanupRecords = [];
    let tier0RejectedSubmittedCleanupCount = 0;
    let tier0SubmittedCleanupRelease = null;
    const registerTier0SubmittedCleanup = (registration = null) => {
      const accepted = Boolean(
        registration?.schema
          === 'peercompute.ulg.mls-mpm-fused-submitted-cleanup-registration.v0'
        && registration.device === record.workerDevice
        && registration.scope === 'fused-resident-sequence-temporaries'
        && typeof registration.cleanup === 'function'
      );
      if (!accepted) {
        tier0RejectedSubmittedCleanupCount += 1;
        return false;
      }
      tier0SubmittedCleanupRecords.push({
        cleanup: registration.cleanup,
        released: false
      });
      return Object.freeze({ accepted: true });
    };
    const releaseTier0SubmittedCleanups = (terminalGpuFence) => {
      if (tier0SubmittedCleanupRecords.length === 0) {
        return Object.freeze({
          schema:
            'peercompute.ulg.worker-tier0-submitted-cleanup-release.v0',
          status: 'tier0-submitted-cleanup-not-registered',
          terminalFenceSatisfied:
            terminalGpuFence?.fenceSatisfied === true,
          registeredCount: 0,
          releasedCount: 0,
          failedCount: 0
        });
      }
      if (terminalGpuFence?.fenceSatisfied !== true) {
        return Object.freeze({
          schema:
            'peercompute.ulg.worker-tier0-submitted-cleanup-release.v0',
          status: 'tier0-submitted-cleanup-held-fence-unsatisfied',
          terminalFenceSatisfied: false,
          registeredCount: tier0SubmittedCleanupRecords.length,
          releasedCount: 0,
          failedCount: 0
        });
      }
      let releasedCount = 0;
      let failedCount = 0;
      for (const record of tier0SubmittedCleanupRecords) {
        if (record.released) continue;
        try {
          record.cleanup();
          record.released = true;
          releasedCount += 1;
        } catch {
          failedCount += 1;
        }
      }
      return Object.freeze({
        schema:
          'peercompute.ulg.worker-tier0-submitted-cleanup-release.v0',
        status: failedCount === 0
          ? 'tier0-submitted-cleanup-released-after-terminal-fence'
          : 'tier0-submitted-cleanup-release-failed',
        terminalFenceSatisfied: true,
        registeredCount: tier0SubmittedCleanupRecords.length,
        releasedCount,
        failedCount
      });
    };
    let completedStepCount = 0;
    let cancelled = false;
    let previousEpochSeal = null;
    let lastMechanicsStageResult = null;
    let lastStepSummary = null;
    const stepSummaryRing = [];
    // Diagnostic-only submit census: under residentGpuTimestampProfile=1,
    // wrap the worker queue's submit once per device and count call sites
    // (top non-wrapper stack frame) so every producer of device work is
    // named per step. Removed concern: the wrapper adds one Error() per
    // submit in diagnostic runs only.
    const submitCensus = new Map();
    const scheduleProfilingRequested =
      record.schroederLane?.residentStepOptions
        ?.residentGpuTimestampProfilingRequested === true;
    const armSubmitCensus = () => {
      const queue = state.workerDevice?.queue;
      if (!scheduleProfilingRequested || !queue) return;
      if (!queue.__ulgSubmitCensusWrapped) {
        const originalSubmit = queue.submit.bind(queue);
        queue.__ulgSubmitCensusWrapped = true;
        queue.__ulgSubmitCensusSink = null;
        queue.submit = (buffers) => {
          const sink = queue.__ulgSubmitCensusSink;
          if (sink) {
            const stack = String(new Error().stack || '');
            const line = stack.split('\n').find(
              (l, index) => index > 1
                && !l.includes('__ulgSubmitCensus')
                && !l.includes('submitQueueOrderedWork')
            ) || 'unknown';
            const site = line.trim().slice(0, 120);
            sink.set(site, (sink.get(site) || 0) + 1);
          }
          return originalSubmit(buffers);
        };
      }
      queue.__ulgSubmitCensusSink = submitCensus;
    };
    // M4 submit burst: hold each step's command buffers at the queue
    // boundary and flush them as one queue.submit per K steps. Queue order
    // is preserved by construction (stale writeBuffer targets, fence
    // requests, and possibly-referenced destroys all force a flush first).
    // Eligibility is DERIVED from the schedule's law-activation receipt:
    // lease-style law sidecar releases treat release latency as a
    // correctness property, so the burst only opens when every law family
    // that could hold such a lease is provably quiescent this schedule.
    const submitBurstStepsRequested = Number(
      record.schroederLane?.residentStepOptions?.mechanicsSubmitBurstSteps
    );
    // Lazy like resolveScheduleLawActivation: terminalRefluxReceiptRequired
    // is assigned below, and the first use happens inside the step loop.
    let submitBurstEligibilityCache = null;
    const resolveSubmitBurstEligibility = () => {
      if (submitBurstEligibilityCache) return submitBurstEligibilityCache;
      const activation = resolveScheduleLawActivation();
      const blockers = [];
      if (
        !Number.isInteger(submitBurstStepsRequested)
        || submitBurstStepsRequested < 2
        || submitBurstStepsRequested > 256
      ) {
        blockers.push('burst-not-requested');
      }
      if (activation.thermal) blockers.push('thermal-active');
      if (activation.reaction) blockers.push('reaction-active');
      if (activation.lawQueue) blockers.push('law-queue-active');
      if (activation.lawNeighborCandidates) {
        blockers.push('law-neighbor-candidates-active');
      }
      if (activation.phaseVolumeMigration) {
        blockers.push('phase-volume-migration-active');
      }
      if (activation.twoLevelMechanics) blockers.push('two-level-mechanics-active');
      if (activation.surfaceTension) blockers.push('surface-tension-active');
      if (activation.gasBoundaryActionable) {
        blockers.push('gas-boundary-actionable');
      }
      if (terminalRefluxReceiptRequired) {
        blockers.push('terminal-reflux-receipts-required');
      }
      // Timestamp profiling reads mapAsync results per stage; a held submit
      // would let those reads resolve before the work they measure reaches
      // the queue, so diagnostics and the burst are mutually exclusive.
      if (scheduleProfilingRequested) blockers.push('gpu-timestamp-profiling');
      // Authority-evidence observation awaits a per-step mapAsync whose
      // source copy would be HELD by the burst — a deadlock, not merely a
      // stale read. Mutually exclusive.
      if (
        record.schroederLane?.residentStepOptions
          ?.observeCanonicalSpatialAuthority === true
      ) {
        blockers.push('spatial-authority-evidence-observation');
      }
      submitBurstEligibilityCache = Object.freeze({
        schema: 'peercompute.ulg.worker-schedule-submit-burst-observation.v0',
        eligible: blockers.length === 0,
        blockers,
        stepsPerFlush: blockers.length === 0 ? submitBurstStepsRequested : null
      });
      return submitBurstEligibilityCache;
    };
    let submitBurstOpened = false;
    let submitBurstCloseStats = null;
    // Explicit contact-free bulk mode: admitted only while every law family
    // that owns contact consequences is quiescent for the schedule. The
    // check is lazy (the activation receipt derives from lane options that
    // a fresh lane adopts at seed time) and fails closed with a typed
    // reason — never a silent hang.
    let contactFreeEligibilityChecked = false;
    const requireContactFreeScheduleEligibility = () => {
      if (contactFreeEligibilityChecked) return;
      contactFreeEligibilityChecked = true;
      const activation = resolveScheduleLawActivation();
      if (activation.contactSolver !== false) return;
      const blockers = [];
      if (activation.thermal) blockers.push('thermal-active');
      if (activation.reaction) blockers.push('reaction-active');
      if (activation.lawQueue) blockers.push('law-queue-active');
      if (activation.lawNeighborCandidates) {
        blockers.push('law-neighbor-candidates-active');
      }
      if (activation.phaseVolumeMigration) {
        blockers.push('phase-volume-migration-active');
      }
      if (activation.twoLevelMechanics) {
        blockers.push('two-level-mechanics-active');
      }
      if (activation.surfaceTension) blockers.push('surface-tension-active');
      if (activation.gasBoundaryActionable) {
        blockers.push('gas-boundary-actionable');
      }
      if (blockers.length > 0) {
        throw workerResidentScheduleError(
          'schedule-contact-free-requires-quiescent-laws',
          `explicit contact-free bulk mode is blocked by: ${blockers.join(', ')}`,
          { scheduleId, contactFreeBlockers: blockers }
        );
      }
    };
    // Worker-clock schedule phase stamps for inter-cycle diagnosis: the gap
    // between one schedule's result assembly and the next schedule's first
    // step start is main-thread turnaround (commit, verify, re-request).
    let scheduleFirstStepStartedAtMs = null;
    let scheduleLastStepEndedAtMs = null;
    // Lagged-drain state: the queue fence started at the previous drain
    // checkpoint (see the checkpoint block below). Seeded immediately so the
    // first checkpoint awaits a real fence (covering lane seed uploads)
    // rather than fully draining the newest submissions.
    // Tier0 is one atomic K-step submission followed by exactly one worker
    // terminal fence. The lagged drain seed exists only for the canonical
    // per-step loop; starting it for Tier0 would add an otherwise invisible
    // host fence before the atomic submission and contradict the route receipt.
    let pendingQueueDrainFencePromise = tier0RouteSelected
      ? null
      : (() => {
          try {
            return state.workerDevice?.queue?.onSubmittedWorkDone?.() ?? null;
          } catch {
            return null;
          }
        })();
    if (pendingQueueDrainFencePromise?.catch) {
      pendingQueueDrainFencePromise.catch(() => {});
    }
    let droppedStepSummaryCount = 0;
    let phaseVolumeSurfaceStressRequired = false;
    let phaseVolumeSurfaceStressObservedStepCount = 0;
    let phaseVolumeSurfaceStressExactSubmissionCount = 0;
    let phaseVolumeSurfaceStressFirstIncompleteStepOrdinal = null;
    let phaseVolumeSurfaceStressFinalSubmission = null;
    let phaseVolumeSurfaceStressFinalSubmissionStepOrdinal = null;
    const twoLevelMechanicsRequested =
      baseMechanicsOptions.enableTwoLevelMechanics === true;
    const twoLevelMechanicsAuthorityRequested = String(
      baseMechanicsOptions.twoLevelMechanicsAuthority
        ?? (twoLevelMechanicsRequested ? 'authoritative' : 'observation')
    ).trim().toLowerCase() === 'authoritative'
      ? 'authoritative'
      : 'observation';
    const twoLevelFineSubstepCountRequested = Number.isFinite(
      Number(baseMechanicsOptions.twoLevelFineSubstepCount)
    )
      ? Math.max(1, Math.round(Number(
          baseMechanicsOptions.twoLevelFineSubstepCount
        )))
      : 2;
    const twoLevelCflFactorEvidenceRequired = Object.prototype.hasOwnProperty.call(
      baseMechanicsOptions,
      'cflFactor'
    );
    const twoLevelCflFactorRequested = twoLevelCflFactorEvidenceRequired
      ? baseMechanicsOptions.cflFactor
      : null;
    if (
      twoLevelCflFactorEvidenceRequired
      && (
        typeof twoLevelCflFactorRequested !== 'number'
        || !Number.isFinite(twoLevelCflFactorRequested)
        || !(twoLevelCflFactorRequested > 0)
        || twoLevelCflFactorRequested > 2
      )
    ) {
      throw workerResidentScheduleError(
        'schedule-two-level-cfl-factor-invalid',
        'authoritative two-level cflFactor must be one finite number in (0, 2]',
        { scheduleId }
      );
    }
    terminalRefluxReceiptRequired = Boolean(
      twoLevelMechanicsRequested
      && twoLevelMechanicsAuthorityRequested === 'authoritative'
    );
    if (
      schedule.twoLevelTerminalRefluxReceiptRequired === true
      && terminalRefluxReceiptRequired !== true
    ) {
      throw workerResidentScheduleError(
        'schedule-terminal-reflux-receipt-request-invalid',
        'terminal reflux receipts require authoritative two-level mechanics',
        { scheduleId }
      );
    }
    let twoLevelMechanicsObservedStepCount = 0;
    let twoLevelMechanicsExactStatusCount = 0;
    let twoLevelMechanicsExactAuthorityCount = 0;
    let twoLevelMechanicsExactFineSubstepCount = 0;
    let twoLevelMechanicsCommitVerifiedCount = 0;
    let twoLevelMechanicsCflFactorObservedStepCount = 0;
    let twoLevelMechanicsExactCflFactorCount = 0;
    let twoLevelMechanicsFirstCflFactorMismatchStepOrdinal = null;
    let twoLevelMechanicsLastCflFactor = null;
    let twoLevelMechanicsExactAuthoritativeStepCount = 0;
    let twoLevelMechanicsFirstIncompleteStepOrdinal = null;
    let twoLevelMechanicsLastStep = null;
    const queueDrainCheckpoints = [];
    let failedQueueDrainCheckpoint = null;
    let scheduleLoopError = null;
    let scheduleGpuWorkMayHaveBeenSubmitted = false;
    const scheduledControlPlaneYieldOpportunityCount = tier0RouteSelected
      ? 0
      : Math.max(0, stepCount - 1);
    let controlPlaneYieldReceipt =
      workerResidentScheduleControlPlaneYieldNotRequiredReceipt({
        tier0RouteSelected,
        stepCount
      });
    if (scheduledControlPlaneYieldOpportunityCount > 0) {
      scheduleControlPlaneTaskYielder =
        createWorkerResidentScheduleControlPlaneTaskYielder({
          scheduledYieldOpportunityCount:
            scheduledControlPlaneYieldOpportunityCount
        });
    }
    try {
      if (tier0RouteSelected) {
        tier0ExecutionAttempted = true;
        scheduleGpuWorkMayHaveBeenSubmitted = true;
        scheduleFirstStepStartedAtMs = workerResidentScheduleNowMs();
        state.workerDevice = record.workerDevice;
        const lane = record.schroederLane;
        const residentStepOptions = lane.residentStepOptions || {};
        // Seed descriptors may retain a stale CPU step while the uploaded
        // family carries the authoritative scene tick. Tier0 starts from the
        // exact upload identity and returns aligned worker-local metadata so
        // a later canonical classifier cannot silently rebase to the CPU row.
        const tier0SphParticleState = {
          ...lane.sphParticleState,
          ...tier0SourceLineage,
          step: tier0SourceLineage.physicsTick,
          phaseCarrierPlan:
            lane.sphParticleState?.phaseCarrierPlan
            ?? tier0PhaseCarrierPlan
            ?? null
        };
        const tier0MlsMpmParticleState = {
          ...lane.mlsMpmParticleState,
          ...tier0SourceLineage,
          step: tier0SourceLineage.physicsTick,
          phaseCarrierPlan:
            lane.mlsMpmParticleState?.phaseCarrierPlan
            ?? tier0PhaseCarrierPlan
            ?? null
        };
        const tier0Execution = await runTier0FusedResidentSequence({
          ...residentStepOptions,
          sphParticleState: tier0SphParticleState,
          mlsMpmParticleState: tier0MlsMpmParticleState,
          sphParticleUpload: lane.sphParticleUpload,
          mlsMpmParticleUpload: lane.mlsMpmParticleUpload,
          device: state.workerDevice,
          preferWebGpu: true,
          gridSpacingM:
            commonOptions.gridSpacingM
            ?? tier0SphParticleState.smoothingLengthM,
          boxDimsM: commonOptions.boxDimsM ?? [5, 5, 5],
          dt:
            commonOptions.dt
            ?? tier0MlsMpmParticleState.mechanicsDtS
            ?? 0,
          gravityMPerS2:
            commonOptions.gravityMPerS2
            ?? tier0MlsMpmParticleState.gravityMPerS2
            ?? [0, -9.81, 0],
          cflFactor:
            commonOptions.cflFactor
            ?? tier0MlsMpmParticleState.gridCflFactor
            ?? 0.4,
          stepCount,
          readbackMode: NO_FULL_READBACK_MODE,
          compactSummaryMode: 'none',
          // Tier0's K substeps and terminal publication are one command
          // submission. The next schedule can conservatively rebuild its
          // active bounds from the carried terminal prediction; a second
          // summary-plan submission here would break that atomic contract.
          activeGridDispatchPlanRefreshMode: 'none',
          summaryRunner: null,
          fuseNoFullResidentMechanicsSequence: true,
          // Until a compact terminal motion/separation envelope is available,
          // an unread successor batch cannot safely reuse a bounded AABB.
          // Tier0 remains one fused submission but dispatches the full grid.
          fuseNoFullResidentMechanicsActiveGrid: false,
          fuseNoFullResidentActiveGrid: false,
          schroederLevelAssignment: null,
          schroederSelectedLevel: null,
          schroederActiveNodeList: null,
          measureFusedSequenceQueueFence: false,
          measureGpuQueueFence: false,
          benchmarkQueueFence: false,
          canonicalSpatialRequired: false,
          requireLawsQuiescentSingleLanePhaseCarrierPlan: true,
          schroederSpatialEpochGeneration: null,
          residentProductMass: null,
          reactionActivationWatchTable:
            scheduleReactionActivationWatchRequested
              ? scheduleReactionActivationWatchTable
              : null,
          reactionActivationMotionEnvelope:
            scheduleReactionActivationWatchRequested
              ? scheduleReactionActivationMotionEnvelope
              : null,
          deferContinuationOwnershipTransfer: true,
          registerFusedSubmittedCleanup:
            registerTier0SubmittedCleanup
        });
        tier0ExecutionResult = tier0Execution;
        tier0ExecutionValidation = validateWorkerTier0FusedExecution(
          tier0Execution,
          {
            device: state.workerDevice,
            stepCount,
            sourceSphUpload: lane.sphParticleUpload,
            sourceMlsUpload: lane.mlsMpmParticleUpload,
            sourceLineage: tier0SourceLineage,
            expectedLineage: tier0ExpectedLineage,
            phaseCarrierPlan: tier0PhaseCarrierPlan,
            registeredSubmittedCleanupCount:
              tier0SubmittedCleanupRecords.length,
            rejectedSubmittedCleanupCount:
              tier0RejectedSubmittedCleanupCount
          }
        );
        if (tier0ExecutionValidation.valid !== true) {
          const error = workerResidentScheduleError(
            'tier0-fused-terminal-publication-invalid',
            tier0ExecutionValidation.failures.join(', '),
            {
              scheduleId,
              stepOrdinal: stepCount,
              stageId: TIER0_FUSED_RESIDENT_SEQUENCE_STAGE_ID,
              laneState: workerResidentScheduleLaneStateSnapshot(record, {
                laneId,
                stateKey
              })
            }
          );
          error.residentScheduleError.tier0ValidationFailures = [
            ...tier0ExecutionValidation.failures
          ];
          error.residentScheduleError.tier0Validation = {
            executionSchema: tier0Execution?.schema ?? null,
            executionStatus: tier0Execution?.status ?? null,
            executionStepCount: tier0Execution?.stepCount ?? null,
            completedStepCount: tier0Execution?.completedStepCount ?? null,
            readbackMode: tier0Execution?.readbackMode ?? null,
            fullParticleReadbackPerformed:
              tier0Execution?.fullParticleReadbackPerformed ?? null,
            fullParticleReadbackFree:
              tier0Execution?.fullParticleReadbackFree ?? null,
            residentContinuationReady:
              tier0Execution?.residentContinuationReady ?? null,
            mapAsyncCount: tier0Execution?.mapAsyncCount ?? null,
            readbackBytes: tier0Execution?.readbackBytes ?? null,
            hostQueueFenceCount:
              tier0Execution?.hostQueueFenceCount ?? null,
            readbackTelemetrySourceBreakdown:
              tier0Execution?.readbackTelemetrySourceBreakdown ?? null,
            fusedQueueFenceRequested:
              tier0ExecutionValidation.fused?.queueFenceRequested ?? null,
            fusedQueueFenceStatus:
              tier0ExecutionValidation.fused?.queueFenceStatus ?? null,
            preflightStatus:
              tier0ExecutionValidation.preflight?.status ?? null,
            preflightBlockers: [
              ...(tier0ExecutionValidation.preflight?.blockers || [])
            ],
            fusedStatus: tier0ExecutionValidation.fused?.status ?? null,
            finalStepStatus:
              tier0ExecutionValidation.finalStep?.status ?? null,
            finalStepResidentBuffersRetained:
              tier0ExecutionValidation.finalStep?.residentBuffersRetained
              ?? null,
            finalStepReadbackDowngradeReasons: [
              ...(tier0ExecutionValidation.finalStep
                ?.readbackDowngradeReasons || [])
            ],
            finalStepNextParticleBufferMode:
              tier0ExecutionValidation.finalStep?.nextParticleBufferMode
              ?? null,
            targetLineage: tier0ExecutionValidation.targetLineage,
            expectedLineage: tier0ExpectedLineage,
            nextParticleUploadsPresent:
              Boolean(tier0ExecutionValidation.nextUploads),
            nextStateBufferPresent:
              Boolean(tier0ExecutionValidation.nextSphUpload?.stateBuffer),
            nextThermoBufferPresent:
              Boolean(tier0ExecutionValidation.nextSphUpload?.thermoBuffer),
            nextIdentityBufferPresent:
              Boolean(tier0ExecutionValidation.nextSphUpload?.identityBuffer),
            nextMechanicsBufferPresent:
              Boolean(tier0ExecutionValidation.nextMlsUpload?.mechanicsBuffer)
          };
          throw error;
        }
        const {
          finalStep,
          nextUploads,
          nextSphUpload,
          nextMlsUpload,
          targetLineage
        } = tier0ExecutionValidation;
        tier0SupersededResidentStep = lane.residentStep || null;
        tier0SupersededUploads = {
          sphParticleUpload: lane.sphParticleUpload,
          mlsMpmParticleUpload: lane.mlsMpmParticleUpload
        };
        // The terminal family becomes the one lane owner atomically. State
        // and mechanics are fresh buffers; quiescent thermo/identity aliases
        // and immutable material sidecars transfer only now, after every
        // receipt and lineage check passed.
        const sourceOwnershipSnapshot = {
          ownsThermoBuffer: lane.sphParticleUpload.ownsThermoBuffer,
          ownsIdentityBuffer: lane.sphParticleUpload.ownsIdentityBuffer,
          identityOwnership: lane.sphParticleUpload.identityOwnership
        };
        const targetOwnershipSnapshot = {
          ownsThermoBuffer: nextSphUpload.ownsThermoBuffer,
          ownsIdentityBuffer: nextSphUpload.ownsIdentityBuffer,
          identityOwnership: nextSphUpload.identityOwnership
        };
        let tier0AuxiliaryOwnershipTransfer = null;
        try {
          tier0AuxiliaryOwnershipTransfer =
            transferPhaseCarrierAuxiliaryBufferOwnership({
              sourceUploads: {
                sphParticleUpload: lane.sphParticleUpload,
                mlsMpmParticleUpload: lane.mlsMpmParticleUpload
              },
              terminalUploads: nextUploads
            });
          if (
            nextSphUpload.thermoBuffer
              === lane.sphParticleUpload.thermoBuffer
          ) {
            lane.sphParticleUpload.ownsThermoBuffer = false;
            nextSphUpload.ownsThermoBuffer = true;
          }
          if (
            nextSphUpload.identityBuffer
            && nextSphUpload.identityBuffer
              === lane.sphParticleUpload.identityBuffer
          ) {
            lane.sphParticleUpload.ownsIdentityBuffer = false;
            lane.sphParticleUpload.identityOwnership =
              'transferred-to-tier0-terminal-family';
            nextSphUpload.ownsIdentityBuffer = true;
            nextSphUpload.identityOwnership =
              'owned-tier0-terminal-family-transfer';
          }
        } catch (error) {
          try {
            lane.sphParticleUpload.ownsThermoBuffer =
              sourceOwnershipSnapshot.ownsThermoBuffer;
            lane.sphParticleUpload.ownsIdentityBuffer =
              sourceOwnershipSnapshot.ownsIdentityBuffer;
            lane.sphParticleUpload.identityOwnership =
              sourceOwnershipSnapshot.identityOwnership;
            nextSphUpload.ownsThermoBuffer =
              targetOwnershipSnapshot.ownsThermoBuffer;
            nextSphUpload.ownsIdentityBuffer =
              targetOwnershipSnapshot.ownsIdentityBuffer;
            nextSphUpload.identityOwnership =
              targetOwnershipSnapshot.identityOwnership;
          } catch {}
          try {
            tier0AuxiliaryOwnershipTransfer
              ?.rollbackOwnershipTransfer?.();
          } catch {}
          throw error;
        }
        lane.residentStep = finalStep;
        lane.sphParticleUpload = nextSphUpload;
        lane.mlsMpmParticleUpload = nextMlsUpload;
        lane.sphParticleState = {
          ...(tier0Execution.nextSphParticleState || tier0SphParticleState),
          ...targetLineage,
          step: targetLineage.physicsTick
        };
        lane.mlsMpmParticleState = {
          ...(tier0Execution.nextMlsMpmParticleState
            || tier0MlsMpmParticleState),
          ...targetLineage,
          step: targetLineage.physicsTick
        };
        lane.particleCount = nextSphUpload.particleCount;
        lane.successorSourceFamily = null;
        lane.successorConsumption = null;
        lane.levelAssignment = null;
        lane.activeNodeList = null;
        lane.epochGeneration = null;
        lane.epochSeal = null;
        lane.epochConsumed = true;
        lane.epochReleaseScheduled = false;
        lane.epochReleasePromise = null;
        lane.executionMode = 'tier0-fused-resident-sequence';
        lane.tier0ContinuationIdentity = { ...targetLineage };
        if (lane.laneSeed) {
          lane.laneSeed = {
            ...lane.laneSeed,
            consumed: true,
            consumedByTier0ScheduleId: scheduleId
          };
        }
        record.retainedThermoBuffer = nextSphUpload.thermoBuffer;
        record.retainedThermoBufferByteLength = positiveByteLength(
          nextSphUpload.thermoBufferByteLength,
          nextSphUpload.thermoBuffer?.size,
          (nextSphUpload.particleCount ?? lane.particleCount ?? 0)
            * SPH_GPU_PARTICLE_THERMO_FLOATS
            * Float32Array.BYTES_PER_ELEMENT
        );
        record.retainedThermoBufferSourceStage =
          TIER0_FUSED_RESIDENT_SEQUENCE_STAGE_ID;
        record.retainedThermoBufferSeededFromCpu = false;
        record.retainedThermoBufferCopySrc = Boolean(
          (Number(nextSphUpload.thermoBuffer?.usage)
            & GPU_BUFFER_USAGE.COPY_SRC) === GPU_BUFFER_USAGE.COPY_SRC
        );
        record.retainedThermoSnapshotRows = null;
        const tier0Refs = [];
        for (const [path, buffer] of [
          ['nextParticleUploads.sphParticleUpload.stateBuffer', nextSphUpload.stateBuffer],
          ['nextParticleUploads.sphParticleUpload.thermoBuffer', nextSphUpload.thermoBuffer],
          ['nextParticleUploads.sphParticleUpload.identityBuffer', nextSphUpload.identityBuffer],
          ['nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer', nextMlsUpload.mechanicsBuffer]
        ]) {
          if (!buffer) continue;
          tier0Refs.push(retainGpuBuffer(
            record,
            TIER0_FUSED_RESIDENT_SEQUENCE_STAGE_ID,
            path,
            buffer
          ).ref);
        }
        tier0RetainedBufferRefs = tier0Refs;
        completedStepCount = stepCount;
        scheduleLastStepEndedAtMs = workerResidentScheduleNowMs();
        lastMechanicsStageResult = {
          retainedBufferRefs: [...tier0RetainedBufferRefs]
        };
        lastStepSummary = {
          schema: ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_SCHEMA,
          scheduleId,
          stepOrdinal: stepCount,
          epochStepOrdinal: null,
          epochStatus: 'canonical-spatial-epoch-not-generated',
          levelAssignmentSource: null,
          epochSeal: null,
          epochIdentity: { ...targetLineage },
          mechanicsStatus: 'tier0-fused-resident-sequence-executed',
          residentStepStatus: finalStep.status ?? null,
          nextParticleStateRetained: true,
          nextParticleStateStep: targetLineage.physicsTick,
          epochConsumed: false,
          epochReleaseScheduled: false,
          particleCount: nextSphUpload.particleCount,
          successorSourceFamilyRetained: false,
          retainedBufferRefs: [...tier0RetainedBufferRefs],
          gpuFenceSatisfied: false,
          gpuFenceStatus: 'covered-by-resident-schedule-terminal',
          sameWorkerQueueOrdered: true,
          terminalScheduleFenceSatisfied: false,
          authorityAdmissionReady: false,
          tier0FusedResidentSequence: true,
          internalStepSummariesOmitted: Math.max(0, stepCount - 1),
          hierarchyStageSummary: null
        };
        stepSummaryRing.push({
          stepOrdinal: stepCount,
          generationId: null,
          ...targetLineage,
          mechanicsStatus: 'tier0-fused-resident-sequence-executed',
          internalStepSummariesOmitted: Math.max(0, stepCount - 1)
        });
        droppedStepSummaryCount += Math.max(0, stepCount - 1);
      } else {
      if (phaseCarrierOneToFourMaterializationRequired) {
        const lane = record.schroederLane;
        phaseCarrierOneToFourSourceResidentStep = lane.residentStep || null;
        phaseCarrierOneToFourSourceUploads = {
          sphParticleUpload: lane.sphParticleUpload,
          mlsMpmParticleUpload: lane.mlsMpmParticleUpload
        };
        const sourceCoreOwners = [
          [
            phaseCarrierOneToFourSourceUploads.sphParticleUpload
              ?.ownsStateBuffer,
            phaseCarrierOneToFourSourceUploads.sphParticleUpload
              ?.stateBuffer
          ],
          [
            phaseCarrierOneToFourSourceUploads.sphParticleUpload
              ?.ownsThermoBuffer,
            phaseCarrierOneToFourSourceUploads.sphParticleUpload
              ?.thermoBuffer
          ],
          [
            phaseCarrierOneToFourSourceUploads.sphParticleUpload
              ?.ownsIdentityBuffer,
            phaseCarrierOneToFourSourceUploads.sphParticleUpload
              ?.identityBuffer
          ],
          [
            phaseCarrierOneToFourSourceUploads.mlsMpmParticleUpload
              ?.ownsMechanicsBuffer,
            phaseCarrierOneToFourSourceUploads.mlsMpmParticleUpload
              ?.mechanicsBuffer
          ]
        ];
        if (
          sourceCoreOwners.some(([owned, buffer]) => owned !== true || !buffer)
          || new Set(sourceCoreOwners.map(([, buffer]) => buffer)).size !== 4
        ) {
          throw workerResidentScheduleError(
            'phase-carrier-one-to-four-source-ownership-incomplete',
            'phase-carrier materialization requires one exact owned source state/thermo/mechanics/identity family',
            {
              scheduleId,
              stepOrdinal: 0,
              stageId: 'phaseCarrierOneToFourMaterialization'
            }
          );
        }
        scheduleGpuWorkMayHaveBeenSubmitted = true;
        phaseCarrierOneToFourExecution =
          await runSphPhaseCarrierOneToFourMaterializationWebGpu({
            device: record.workerDevice,
            sphParticleState: lane.sphParticleState,
            mlsMpmParticleState: lane.mlsMpmParticleState,
            sphParticleUpload: lane.sphParticleUpload,
            mlsMpmParticleUpload: lane.mlsMpmParticleUpload,
            phaseCarrierPlan: tier0PhaseCarrierPlan,
            submittedWorkCleanup: 'caller-terminal-fence'
          });
        // Retain every owner before validating the submitted publication. A
        // malformed result is still GPU work and cannot be dropped before the
        // schedule terminal fence or explicit poisoned-lane teardown.
        record.pendingPhaseCarrierOneToFourTransition = {
          sourceResidentStep: phaseCarrierOneToFourSourceResidentStep,
          sourceUploads: phaseCarrierOneToFourSourceUploads,
          execution: phaseCarrierOneToFourExecution
        };
        phaseCarrierOneToFourValidation =
          validateSphPhaseCarrierOneToFourExecution(
            phaseCarrierOneToFourExecution,
            {
              device: record.workerDevice,
              sourceParticleCount:
                phaseCarrierOneToFourSourceUploads.sphParticleUpload
                  ?.particleCount,
              sourceLineage: scheduleStartTier0ContinuationIdentity
            }
          );
        if (phaseCarrierOneToFourValidation.valid !== true) {
          const error = workerResidentScheduleError(
            'phase-carrier-one-to-four-publication-invalid',
            phaseCarrierOneToFourValidation.failures.join(', '),
            {
              scheduleId,
              stepOrdinal: 0,
              stageId: 'phaseCarrierOneToFourMaterialization',
              laneState: workerResidentScheduleLaneStateSnapshot(record, {
                laneId,
                stateKey
              })
            }
          );
          error.residentScheduleError.phaseCarrierOneToFourValidation = {
            status: phaseCarrierOneToFourValidation.status,
            failures: [...phaseCarrierOneToFourValidation.failures]
          };
          throw error;
        }
        const targetLineage = phaseCarrierOneToFourValidation.targetLineage;
        const materializedUploads =
          phaseCarrierOneToFourExecution.nextParticleUploads;
        phaseCarrierAuxiliaryOwnershipTransfer =
          transferPhaseCarrierAuxiliaryBufferOwnership({
            sourceUploads: phaseCarrierOneToFourSourceUploads,
            terminalUploads: materializedUploads
          });
        phaseCarrierOneToFourAdopted = true;
        // Model the 4N publication as the canonical step's immediate
        // predecessor. Existing resident-step cleanup then retires it only
        // after the first canonical step has submitted every read, while the
        // older Tier0 N-family remains separately pinned to the terminal
        // schedule fence below.
        lane.residentStep = {
          schema:
            'peercompute.ulg.phase-carrier-one-to-four-predecessor-step.v0',
          status: 'phase-carrier-one-to-four-predecessor-retained',
          backend: 'webgpu',
          readbackMode: NO_FULL_READBACK_MODE,
          nextParticleUploads: materializedUploads,
          phaseCarrierOneToFourMaterialization:
            phaseCarrierOneToFourExecution
        };
        lane.sphParticleUpload =
          phaseCarrierOneToFourExecution.nextSphParticleUpload;
        lane.mlsMpmParticleUpload =
          phaseCarrierOneToFourExecution.nextMlsMpmParticleUpload;
        lane.sphParticleState =
          phaseCarrierOneToFourExecution.nextSphParticleState;
        lane.mlsMpmParticleState =
          phaseCarrierOneToFourExecution.nextMlsMpmParticleState;
        lane.particleCount =
          phaseCarrierOneToFourExecution.terminalParticleCount;
        lane.phaseCarrierPlan = {
          ...phaseCarrierOneToFourExecution.phaseCarrierPlan
        };
        lane.successorSourceFamily = null;
        lane.successorConsumption = null;
        lane.levelAssignment = null;
        lane.activeNodeList = null;
        lane.epochGeneration = null;
        lane.epochSeal = null;
        lane.epochConsumed = true;
        lane.epochReleaseScheduled = false;
        lane.epochReleasePromise = null;
        lane.executionMode =
          'tier0-to-canonical-phase-carrier-one-to-four';
        lane.tier0ContinuationIdentity = { ...targetLineage };
        scheduleStartTier0ContinuationIdentity = { ...targetLineage };
        record.phaseCarrierPlan = {
          ...phaseCarrierOneToFourExecution.phaseCarrierPlan
        };
        record.retainedThermoBuffer =
          phaseCarrierOneToFourExecution.thermoBuffer;
        record.retainedThermoBufferByteLength =
          phaseCarrierOneToFourExecution.thermoBufferByteLength;
        record.retainedThermoBufferSourceStage =
          'phaseCarrierOneToFourMaterialization';
        record.retainedThermoBufferSeededFromCpu = false;
        record.retainedThermoBufferCopySrc = true;
        record.retainedThermoSnapshotRows = null;
        phaseCarrierOneToFourTransitionReceipt = Object.freeze({
          schema:
            ULG_WORKER_PHASE_CARRIER_ONE_TO_FOUR_TRANSITION_SCHEMA,
          status:
            'phase-carrier-one-to-four-adopted-pending-terminal-fence',
          scheduleId,
          sourceParticleCount:
            phaseCarrierOneToFourExecution.sourceParticleCount,
          terminalParticleCount:
            phaseCarrierOneToFourExecution.terminalParticleCount,
          companionParticleCount:
            phaseCarrierOneToFourExecution.companionParticleCount,
          countSummary:
            phaseCarrierOneToFourExecution.countSummary,
          sourcePhaseCarrierPlan:
            phaseCarrierOneToFourExecution.sourcePhaseCarrierPlan,
          terminalPhaseCarrierPlan:
            phaseCarrierOneToFourExecution.phaseCarrierPlan,
          sourceLineage:
            phaseCarrierOneToFourExecution.lineage.source,
          terminalLineage:
            phaseCarrierOneToFourExecution.lineage.target,
          identityCorrespondence:
            phaseCarrierOneToFourExecution.identityCorrespondence,
          identityCorrespondenceRevision:
            phaseCarrierOneToFourExecution.identityCorrespondenceRevision,
          materializationKernelRevision:
            phaseCarrierOneToFourExecution.materializationKernelRevision,
          sourceIdentitySchema:
            phaseCarrierOneToFourExecution.identitySchema,
          terminalIdentitySchema:
            phaseCarrierOneToFourExecution.nextSphParticleUpload
              .identitySchema,
          sourceIdentityStrideBytes:
            phaseCarrierOneToFourExecution.identityStrideBytes,
          terminalIdentityStrideBytes:
            phaseCarrierOneToFourExecution.nextSphParticleUpload
              .identityStrideBytes,
          sourceIdentityRevision:
            phaseCarrierOneToFourExecution.sourceIdentityRevision,
          terminalIdentityRevision:
            phaseCarrierOneToFourExecution.identityRevision,
          sourceStateBufferByteLength:
            phaseCarrierOneToFourExecution.sourceStateBufferByteLength,
          sourceThermoBufferByteLength:
            phaseCarrierOneToFourExecution.sourceThermoBufferByteLength,
          sourceMechanicsBufferByteLength:
            phaseCarrierOneToFourExecution.sourceMechanicsBufferByteLength,
          sourceIdentityBufferByteLength:
            phaseCarrierOneToFourExecution.sourceIdentityBufferByteLength,
          terminalStateBufferByteLength:
            phaseCarrierOneToFourExecution.stateBufferByteLength,
          terminalThermoBufferByteLength:
            phaseCarrierOneToFourExecution.thermoBufferByteLength,
          terminalMechanicsBufferByteLength:
            phaseCarrierOneToFourExecution.mechanicsBufferByteLength,
          terminalIdentityBufferByteLength:
            phaseCarrierOneToFourExecution.identityBufferByteLength,
          validationStatus: phaseCarrierOneToFourValidation.status,
          validationErrorScopeStatus:
            phaseCarrierOneToFourExecution.validationErrorScopeStatus,
          validationErrorScopeCount:
            phaseCarrierOneToFourExecution.validationErrorScopeCount,
          validationErrorObserved:
            phaseCarrierOneToFourExecution.validationErrorObserved,
          auxiliaryBufferOwnershipTransfer:
            phaseCarrierAuxiliaryOwnershipTransfer,
          publicationFamilies: [
            ...phaseCarrierOneToFourExecution.publicationFamilies
          ],
          commandSubmissionCount:
            phaseCarrierOneToFourExecution.commandSubmissionCount,
          fullParticleReadbackPerformed: false,
          mapAsyncCount: 0,
          readbackBytes: 0,
          activationAuthority:
            scheduleLawActivation.activationAuthority,
          trigger: authenticatedDynamicReactionSuccessor
            ? 'authenticated-dynamic-reaction-successor'
            : scheduleLawActivation.thermal
              ? 'static-thermal-law-active'
              : 'static-reaction-law-active',
          routingAuthority: authenticatedDynamicReactionSuccessor,
          dynamicLawRoutingAuthority:
            authenticatedDynamicReactionSuccessor,
          terminalFenceSatisfied: false,
          supersededSourceRetired: false
        });
      }
      for (let stepOrdinal = 1; stepOrdinal <= stepCount; stepOrdinal += 1) {
        // Once internal GPU fences are deferred, this task yield—not queue
        // completion—is what lets a cancel message run between atomic steps.
        if (stepOrdinal > 1) {
          await scheduleControlPlaneTaskYielder.yieldTask(stepOrdinal);
        }
        if (
          state.cancelRequested
          && !(phaseCarrierOneToFourAdopted && completedStepCount === 0)
        ) {
          scheduleControlPlaneTaskYielder?.observeCancellation(stepOrdinal);
          cancelled = true;
          break;
        }
        requireContactFreeScheduleEligibility();
        let currentStepSeal = null;
        let epochStageResult = null;
        let mechanicsStageResult = null;
        let mechanicsStageStarted = false;
        const stepStartedAtMs = workerResidentScheduleNowMs();
        if (scheduleFirstStepStartedAtMs == null) {
          scheduleFirstStepStartedAtMs = stepStartedAtMs;
        }
        let epochStageElapsedMs = null;
        let mechanicsStageElapsedMs = null;
        try {
        scheduleGpuWorkMayHaveBeenSubmitted = true;
        const epochStageStartedAtMs = workerResidentScheduleNowMs();
        epochStageResult = await runUlgMechanicsResidentStageWorkerPayload(
          scheduleStagePayload(
            SCHROEDER_SPATIAL_EPOCH_STAGE_ID,
            ['schroeder-level-assignment'],
            ['schroeder-spatial-epoch'],
            await epochOptionsForStep(stepOrdinal, previousEpochSeal)
          ),
          WORKER_RESIDENT_SCHEDULE_FENCE_DEFERRAL_TOKEN
        );
        epochStageElapsedMs = Math.max(
          0,
          workerResidentScheduleNowMs() - epochStageStartedAtMs
        );
        requireWorkerResidentScheduleDeferredStageAdmission(epochStageResult, {
          scheduleId,
          stepOrdinal,
          stageId: SCHROEDER_SPATIAL_EPOCH_STAGE_ID,
          laneId,
          stateKey
        });
        if (!record.workerDevice) {
          throw workerResidentScheduleError(
            'schedule-worker-device-missing',
            'the epoch stage completed without retaining its worker device',
            {
              scheduleId,
              stepOrdinal,
              stageId: SCHROEDER_SPATIAL_EPOCH_STAGE_ID
            }
          );
        }
        if (
          !submitBurstOpened
          && resolveSubmitBurstEligibility().eligible
          && state.workerDevice
        ) {
          // Opened after the first epoch stage proves the device, so seed
          // uploads and the lane's first generation go direct.
          openWorkerQueueSubmitBurst(state.workerDevice, {
            label: `ulg-worker-schedule-${scheduleId}`
          });
          submitBurstOpened = true;
        }
        if (state.workerDevice && state.workerDevice !== record.workerDevice) {
          throw workerResidentScheduleError(
            'schedule-worker-device-changed',
            'the worker lane device changed during an active schedule',
            {
              scheduleId,
              stepOrdinal,
              stageId: SCHROEDER_SPATIAL_EPOCH_STAGE_ID
            }
          );
        }
        state.workerDevice = record.workerDevice;
        if (terminalRefluxReceiptRequired && !terminalRefluxRingBuffer) {
          terminalRefluxRingBuffer = tagWebGpuBufferDevice(
            state.workerDevice.createBuffer({
              label: `ulg-worker-terminal-reflux-ring-${scheduleId}`,
              size: stepCount
                * SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_BYTE_LENGTH,
              usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
            }),
            state.workerDevice
          );
        }
        currentStepSeal = epochStageResult.value?.epochSeal ?? null;
        if (!currentStepSeal) {
          throw workerResidentScheduleError(
            'schedule-epoch-seal-missing',
            'the epoch stage completed without a sealed generation identity',
            { scheduleId, stepOrdinal }
          );
        }
        if (previousEpochSeal) {
          const regressedWords = workerResidentScheduleRegressedIdentityWords(
            previousEpochSeal,
            currentStepSeal
          );
          if (regressedWords.length > 0) {
            // The contract seal of correction 1: batching must never reuse
            // (or rebuild against) a stale position epoch.
            throw workerResidentScheduleError(
              'epoch-identity-regressed',
              `step ${stepOrdinal} rebuilt the spatial epoch without advancing: ${
                regressedWords.join(', ')
              }`,
              { scheduleId, stepOrdinal }
            );
          }
        } else if (scheduleStartTier0ContinuationIdentity) {
          // A law activated at this schedule boundary. The classifier rebuilt
          // one fresh canonical generation against the exact Tier0 terminal
          // particle family; the generation must describe that family, not
          // advance or rebase it before mechanics consumes it.
          const driftedWords = SCHROEDER_EPOCH_IDENTITY_WORD_FIELDS.filter(
            (field) => Number(currentStepSeal[field])
              !== Number(scheduleStartTier0ContinuationIdentity[field])
          );
          if (driftedWords.length > 0) {
            throw workerResidentScheduleError(
              'tier0-canonical-transition-identity-mismatch',
              `step ${stepOrdinal} rebuilt canonical spatial authority against a different Tier0 terminal family on: ${
                driftedWords.join(', ')
              }`,
              { scheduleId, stepOrdinal }
            );
          }
        } else if (seedBaselineIdentity) {
          const consumedSeedThisStep =
            epochStageResult.value?.levelAssignmentSource
              === 'worker-lane-seeded-level-assignment';
          if (seedConsumptionExpectedAtStepOne && consumedSeedThisStep) {
            // The seeded epoch carries the seed lineage by construction; any
            // drift on the eight identity words is fail-closed, never
            // silently rebased.
            const driftedWords = SCHROEDER_EPOCH_IDENTITY_WORD_FIELDS.filter(
              (field) => {
                const seeded = Number(seedBaselineIdentity[field]);
                const current = Number(currentStepSeal[field]);
                return !(Number.isFinite(seeded)
                  && Number.isFinite(current)
                  && current === seeded);
              }
            );
            if (driftedWords.length > 0) {
              throw workerResidentScheduleError(
                'seed-epoch-identity-mismatch',
                `step ${stepOrdinal} consumed the seeded assignment but its epoch identity drifted from the seed lineage on: ${
                  driftedWords.join(', ')
                }`,
                { scheduleId, stepOrdinal }
              );
            }
          } else {
            const regressedWords = workerResidentScheduleRegressedIdentityWords(
              seedBaselineIdentity,
              currentStepSeal
            );
            if (regressedWords.length > 0) {
              // The seeded lineage is the lane's baseline: after the seed is
              // consumed, a first schedule step must advance beyond the
              // seeded words.
              throw workerResidentScheduleError(
                'epoch-identity-regressed',
                `step ${stepOrdinal} did not advance beyond the lane's seeded lineage baseline: ${
                  regressedWords.join(', ')
                }`,
                { scheduleId, stepOrdinal }
              );
            }
          }
        }
        mechanicsStageStarted = true;
        const mechanicsStageStartedAtMs = workerResidentScheduleNowMs();
        mechanicsStageResult = await runUlgMechanicsResidentStageWorkerPayload(
          scheduleStagePayload(
            SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID,
            ['schroeder-spatial-epoch', 'sph-particle-state', 'mls-mpm-mechanics'],
            ['sph-particle-state', 'mls-mpm-mechanics'],
            mechanicsOptionsForStep(currentStepSeal, stepOrdinal)
          ),
          WORKER_RESIDENT_SCHEDULE_FENCE_DEFERRAL_TOKEN
        );
        mechanicsStageElapsedMs = Math.max(
          0,
          workerResidentScheduleNowMs() - mechanicsStageStartedAtMs
        );
        requireWorkerResidentScheduleDeferredStageAdmission(
          mechanicsStageResult,
          {
            scheduleId,
            stepOrdinal,
            stageId: SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID,
            laneId,
            stateKey
          }
        );
        if (record.workerDevice !== state.workerDevice) {
          throw workerResidentScheduleError(
            'schedule-worker-device-changed',
            'the mechanics stage did not remain on the schedule worker device',
            {
              scheduleId,
              stepOrdinal,
              stageId: SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID
            }
          );
        }
      } catch (error) {
        // The W1 stage finally-blocks already released the successor-family
        // lease when the mechanics stage ran; drop the epoch this step built
        // (if it is still retained unconsumed) so the lane stays consistent
        // and restartable by a plain 'run-resident-stage' epoch message.
        const epochCleanup = releaseWorkerResidentScheduleUnconsumedStepEpoch(
          record,
          currentStepSeal,
          {
            releaseSuccessorLease: !mechanicsStageStarted,
            queueOrderedAfterLastSubmission: true
          }
        );
        if (epochCleanup.confirmed !== true) {
          poisonWorkerResidentScheduleLane(record, {
            reason: 'schedule-unconsumed-epoch-cleanup-unconfirmed',
            scheduleId,
            stepOrdinal
          });
        }
        const laneState = workerResidentScheduleLaneStateSnapshot(record, {
          laneId,
          stateKey
        });
        if (error?.residentScheduleError) {
          if (error.residentScheduleError.laneState == null) {
            error.residentScheduleError.laneState = laneState;
          }
          if (error.residentScheduleError.stepOrdinal == null) {
            error.residentScheduleError.stepOrdinal = stepOrdinal;
          }
          error.residentScheduleError.unconsumedEpochCleanup = epochCleanup;
          if (error.authorityDiagnostics) {
            error.residentScheduleError.authorityDiagnostics =
              error.authorityDiagnostics;
          }
          throw error;
        }
        const scheduleError = workerResidentScheduleError(
          normalizeString(error?.reason, null) || 'schedule-step-stage-error',
          error?.message != null ? String(error.message) : String(error),
          {
            scheduleId,
            stepOrdinal,
            stageId: normalizeString(error?.stageId, null),
            laneState
          }
        );
        scheduleError.residentScheduleError.unconsumedEpochCleanup =
          epochCleanup;
        if (error?.authorityDiagnostics) {
          scheduleError.authorityDiagnostics = error.authorityDiagnostics;
          scheduleError.residentScheduleError.authorityDiagnostics =
            error.authorityDiagnostics;
        }
        throw scheduleError;
      }
      const epochIdentity =
        workerResidentScheduleEpochIdentity(currentStepSeal);
      const residentStepSummary =
        mechanicsStageResult.value?.residentStepSummary ?? null;
      if (terminalRefluxReceiptRequired) {
        const copyReceipt = residentStepSummary?.terminalRefluxReceiptCopy
          ?? null;
        const levels = Array.isArray(currentStepSeal?.mechanicsLevels)
          ? currentStepSeal.mechanicsLevels
          : [];
        const expectedOffset = (stepOrdinal - 1)
          * SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_BYTE_LENGTH;
        if (
          copyReceipt?.schema
            !== ULG_SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_COPY_SCHEMA
          || copyReceipt.status
            !== 'terminal-reflux-header-copy-submitted-unverified'
          || copyReceipt.scheduleId !== scheduleId
          || copyReceipt.laneId !== laneId
          || copyReceipt.stateKey !== stateKey
          || copyReceipt.stepOrdinal !== stepOrdinal
          || copyReceipt.targetOffsetBytes !== expectedOffset
          || copyReceipt.targetByteLength
            !== SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_BYTE_LENGTH
          || copyReceipt.completionOrdinal !== currentStepSeal.generationId
          || copyReceipt.fineSubstepCount
            !== twoLevelFineSubstepCountRequested
          || copyReceipt.fineLevel !== levels[0]
          || copyReceipt.coarseLevel !== levels[1]
        ) {
          throw workerResidentScheduleError(
            'schedule-terminal-reflux-copy-receipt-invalid',
            'the authoritative step did not return its exact terminal reflux copy receipt',
            {
              scheduleId,
              stepOrdinal,
              stageId: SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID,
              laneState: workerResidentScheduleLaneStateSnapshot(record, {
                laneId,
                stateKey
              })
            }
          );
        }
        terminalRefluxExpectations.push({
          stepOrdinal,
          expectedCompletionOrdinal: currentStepSeal.generationId,
          expectedFineSubstepCount: twoLevelFineSubstepCountRequested,
          expectedFineLevel: levels[0],
          expectedCoarseLevel: levels[1],
          copyReceipt
        });
      }
      completedStepCount = stepOrdinal;
      previousEpochSeal = currentStepSeal;
      lastMechanicsStageResult = mechanicsStageResult;
      const rawHierarchyStageSummary =
        mechanicsStageResult.value?.hierarchyStageSummary ?? null;
      // Private schedule stage results preserve the compact raw summary.
      // Keep the reconstruction as a compatibility guard for older/public
      // cloneable stage envelopes, where repeated diagnostic receipt aliases
      // can be represented as null by cycle-safe transport sanitization.
      const surfaceStressSubmissionWasTransportAlias = Boolean(
        rawHierarchyStageSummary?.phaseVolumeSurfaceStressSubmission
        && rawHierarchyStageSummary.phaseVolumeSurfaceStressSubmission
          === residentStepSummary?.phaseVolumeSurfaceStressSubmission
      );
      const rawResidentStageTiming =
        rawHierarchyStageSummary?.residentStageTiming ?? null;
      const stageGpuTimingWasTransportAlias = Boolean(
        rawResidentStageTiming?.stageGpuMs
        && rawResidentStageTiming.gpuTimestampProfile?.stageGpuMs
          === rawResidentStageTiming.stageGpuMs
      );
      const stageMechanicsTraceWasTransportAlias = Boolean(
        rawHierarchyStageSummary?.stageMechanicsTrace
        && rawHierarchyStageSummary.stageMechanicsTrace
          === residentStepSummary?.stageMechanicsTrace
      );
      const canonicalSpatialTraceWasTransportAlias = Boolean(
        rawHierarchyStageSummary?.canonicalSpatialAuthorityTrace
        && rawHierarchyStageSummary.canonicalSpatialAuthorityTrace
          === residentStepSummary?.canonicalSpatialAuthorityTrace
      );
      const stageMechanicsTraceRequested =
        rawHierarchyStageSummary?.stageMechanicsTraceRequested === true;
      const hierarchyStageSummary = rawHierarchyStageSummary
        && (
          stageMechanicsTraceRequested
          || surfaceStressSubmissionWasTransportAlias
          || stageGpuTimingWasTransportAlias
          || stageMechanicsTraceWasTransportAlias
          || canonicalSpatialTraceWasTransportAlias
        )
        ? {
            ...rawHierarchyStageSummary,
            // Preserve the established schedule-boundary shape: the public
            // cycle-safe stage transport visited residentStepSummary first,
            // so this repeated receipt was null in hierarchyStageSummary.
            phaseVolumeSurfaceStressSubmission:
              surfaceStressSubmissionWasTransportAlias
                ? null
                : rawHierarchyStageSummary
                  .phaseVolumeSurfaceStressSubmission,
            residentStageTiming: stageGpuTimingWasTransportAlias
              ? {
                  ...rawResidentStageTiming,
                  gpuTimestampProfile: {
                    ...rawResidentStageTiming.gpuTimestampProfile,
                    // The former cycle-safe public transport visited this
                    // map first through residentStageTiming.stageGpuMs. Keep
                    // its repeated occurrence null at the schedule boundary.
                    stageGpuMs: null
                  }
                }
              : rawResidentStageTiming,
            stageMechanicsTrace: stageMechanicsTraceWasTransportAlias
              ? stageMechanicsTraceRequested
                ? residentStepSummary?.stageMechanicsTrace ?? null
                : null
              : rawHierarchyStageSummary.stageMechanicsTrace
                ?? (stageMechanicsTraceRequested
                  ? residentStepSummary?.stageMechanicsTrace
                  : null)
                ?? null,
            canonicalSpatialAuthorityTrace:
              canonicalSpatialTraceWasTransportAlias
                ? stageMechanicsTraceRequested
                  ? residentStepSummary?.canonicalSpatialAuthorityTrace ?? null
                  : null
                : rawHierarchyStageSummary.canonicalSpatialAuthorityTrace
                  ?? (stageMechanicsTraceRequested
                    ? residentStepSummary?.canonicalSpatialAuthorityTrace
                    : null)
                  ?? null
          }
        : rawHierarchyStageSummary;
      lastStepSummary = {
        schema: ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_SCHEMA,
        scheduleId,
        stepOrdinal,
        epochStepOrdinal: epochStageResult.value?.epochStepOrdinal ?? null,
        epochStatus: epochStageResult.value?.status ?? null,
        levelAssignmentSource:
          epochStageResult.value?.levelAssignmentSource ?? null,
        epochSeal: currentStepSeal,
        epochIdentity,
        epochRetainedBufferRefs: [...(epochStageResult.retainedBufferRefs || [])],
        mechanicsStatus: mechanicsStageResult.value?.status ?? null,
        residentStepStatus:
          mechanicsStageResult.value?.residentStepSummary?.status ?? null,
        nextParticleStateRetained:
          mechanicsStageResult.value?.residentStepSummary
            ?.nextParticleStateRetained ?? null,
        nextParticleStateStep:
          mechanicsStageResult.value?.residentStepSummary
            ?.nextParticleStateStep ?? null,
        nextParticleStateCloneError:
          mechanicsStageResult.value?.residentStepSummary
            ?.nextParticleStateCloneError ?? null,
        epochConsumed: mechanicsStageResult.value?.epochConsumed === true,
        epochReleaseScheduled:
          mechanicsStageResult.value?.epochReleaseScheduled === true,
        epochReleaseMode: mechanicsStageResult.value?.epochReleaseMode ?? null,
        particleCount:
          mechanicsStageResult.value?.postStep?.particleCount ?? null,
        successorSourceFamilyRetained:
          mechanicsStageResult.value?.postStep?.successorSourceFamilyRetained
            === true,
        retainedBufferRefs: [...(mechanicsStageResult.retainedBufferRefs || [])],
        retainedBufferRegistryEntryCount:
          mechanicsStageResult.value?.workerResidentStage
            ?.retainedBufferRegistryEntryCount ?? null,
        gpuFenceSatisfied:
          mechanicsStageResult.gpuFence?.fenceSatisfied === true,
        gpuFenceStatus: mechanicsStageResult.gpuFence?.status ?? null,
        sameWorkerQueueOrdered:
          mechanicsStageResult.gpuFence?.sameWorkerGpuHandoff === true,
        terminalScheduleFenceSatisfied: false,
        authorityAdmissionReady: false,
        epochStageElapsedMs,
        mechanicsStageElapsedMs,
        stepElapsedMs: Math.max(
          0,
          workerResidentScheduleNowMs() - stepStartedAtMs
        ),
        hierarchyStageSummary
      };
      if (residentStepSummary?.phaseVolumeSurfaceStressRequired === true) {
        phaseVolumeSurfaceStressRequired = true;
        phaseVolumeSurfaceStressObservedStepCount += 1;
        phaseVolumeSurfaceStressFinalSubmission =
          residentStepSummary.phaseVolumeSurfaceStressSubmission ?? null;
        phaseVolumeSurfaceStressFinalSubmissionStepOrdinal =
          phaseVolumeSurfaceStressFinalSubmission ? stepOrdinal : null;
        if (
          residentStepSummary.phaseVolumeSurfaceStressSubmissionExact === true
        ) {
          phaseVolumeSurfaceStressExactSubmissionCount += 1;
        } else if (phaseVolumeSurfaceStressFirstIncompleteStepOrdinal == null) {
          phaseVolumeSurfaceStressFirstIncompleteStepOrdinal = stepOrdinal;
        }
      }
      if (twoLevelMechanicsRequested) {
        twoLevelMechanicsObservedStepCount += 1;
        const twoLevelStep = {
          stepOrdinal,
          status: residentStepSummary?.status ?? null,
          mechanicsLevelCount:
            residentStepSummary?.mechanicsLevelCount ?? null,
          twoLevelMechanicsEnabled:
            residentStepSummary?.twoLevelMechanicsEnabled === true,
          twoLevelMechanicsAuthority:
            residentStepSummary?.twoLevelMechanicsAuthority ?? null,
          twoLevelMechanicsStatus:
            residentStepSummary?.twoLevelMechanicsStatus ?? null,
          twoLevelFineSubstepCount:
            residentStepSummary?.twoLevelFineSubstepCount ?? null,
          twoLevelCflFactor:
            residentStepSummary?.twoLevelCflFactor ?? null,
          twoLevelAuthoritativeCommitVerified:
            residentStepSummary?.twoLevelAuthoritativeCommitVerified === true
        };
        const exactStatus = twoLevelStep.status
          === 'schroeder-two-level-authoritative-step-executed';
        const exactAuthority = twoLevelStep.twoLevelMechanicsAuthority
          === 'authoritative';
        const exactFineSubsteps = Number(
          twoLevelStep.twoLevelFineSubstepCount
        )
          === Number(twoLevelFineSubstepCountRequested);
        const commitVerified =
          twoLevelStep.twoLevelAuthoritativeCommitVerified === true;
        const observedCflFactor = Number(twoLevelStep.twoLevelCflFactor);
        const cflFactorObserved = Number.isFinite(observedCflFactor)
          && observedCflFactor > 0;
        const exactCflFactor = Boolean(
          !twoLevelCflFactorEvidenceRequired
          || (
            cflFactorObserved
            && observedCflFactor === twoLevelCflFactorRequested
          )
        );
        const exactHierarchy = Boolean(
          twoLevelStep.twoLevelMechanicsEnabled
          && Number(twoLevelStep.mechanicsLevelCount) >= 2
        );
        if (exactStatus) twoLevelMechanicsExactStatusCount += 1;
        if (exactAuthority) twoLevelMechanicsExactAuthorityCount += 1;
        if (exactFineSubsteps) twoLevelMechanicsExactFineSubstepCount += 1;
        if (commitVerified) twoLevelMechanicsCommitVerifiedCount += 1;
        if (cflFactorObserved) {
          twoLevelMechanicsCflFactorObservedStepCount += 1;
          twoLevelMechanicsLastCflFactor = observedCflFactor;
        }
        if (exactCflFactor) {
          twoLevelMechanicsExactCflFactorCount += 1;
        } else if (
          twoLevelMechanicsFirstCflFactorMismatchStepOrdinal == null
        ) {
          twoLevelMechanicsFirstCflFactorMismatchStepOrdinal = stepOrdinal;
        }
        if (
          exactStatus
          && exactAuthority
          && exactFineSubsteps
          && commitVerified
          && exactCflFactor
          && exactHierarchy
        ) {
          twoLevelMechanicsExactAuthoritativeStepCount += 1;
        } else if (twoLevelMechanicsFirstIncompleteStepOrdinal == null) {
          twoLevelMechanicsFirstIncompleteStepOrdinal = stepOrdinal;
        }
        twoLevelMechanicsLastStep = twoLevelStep;
      }
      stepSummaryRing.push({
        stepOrdinal,
        generationId: currentStepSeal.generationId ?? null,
        storageGeneration: currentStepSeal.storageGeneration ?? null,
        physicsTick: currentStepSeal.physicsTick ?? null,
        positionEpoch: currentStepSeal.positionEpoch ?? null,
        mechanicsStatus: mechanicsStageResult.value?.status ?? null,
        stepStartedAtMs,
        stepElapsedMs: lastStepSummary.stepElapsedMs,
        epochStageElapsedMs,
        mechanicsStageElapsedMs,
        epochQueueIntervalMs:
          epochStageResult.value?.epochQueueIntervalMs ?? null,
        epochQueueTimeline:
          epochStageResult.value?.epochQueueTimeline ?? null,
        // Diagnostic-only per-step device timing map (null unless
        // residentGpuTimestampProfile=1): the contact pass durations plus
        // the queue:* stage-window timeline for THIS step.
        stageGpuMs:
          hierarchyStageSummary?.residentStageTiming?.stageGpuMs ?? null
      });
      scheduleLastStepEndedAtMs = workerResidentScheduleNowMs();
      armSubmitCensus();
      if (
        submitBurstOpened
        && stepOrdinal % resolveSubmitBurstEligibility().stepsPerFlush === 0
      ) {
        // Cadence bound: even if no fence request forced a flush this
        // window, held work never spans more than K steps.
        flushWorkerQueueSubmitBurst(state.workerDevice, 'step-cadence');
      }
      if (
        stepSummaryRing.length
          > ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_RING_CAPACITY
      ) {
        stepSummaryRing.shift();
        droppedStepSummaryCount += 1;
        }
      if (
        typeof postProgress === 'function'
        && stepOrdinal % progressEverySteps === 0
      ) {
        try {
          // Fire-and-forget; progress never blocks or fails the step loop.
          postProgress({
            schema: ULG_WORKER_RESIDENT_SCHEDULE_PROGRESS_SCHEMA,
            scheduleId,
            completedStepCount,
            stepOrdinal,
            epochIdentity,
            stepSummary: lastStepSummary
          });
        } catch {
          // Progress delivery failures must not abort the batch.
        }
      }
      if (
        stepOrdinal < stepCount
        && stepOrdinal
          % ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS === 0
      ) {
        // Progress presentation submits on this same worker/device, so drain
        // after posting the boundary candidate. This bounds both canonical
        // compute and worker-local render work without publishing an
        // authority fence before the schedule terminal.
        //
        // Lagged drain: the fence awaited here was STARTED at the previous
        // checkpoint, so it covers all work submitted through that earlier
        // boundary. Unfenced work stays bounded by two checkpoint intervals
        // (the Dawn pressure bound this checkpoint exists for) while the
        // encode pipeline keeps running ahead of device completion instead
        // of stalling for the newest submissions every interval.
        const laggedFencePromise = pendingQueueDrainFencePromise;
        pendingQueueDrainFencePromise = null;
        const checkpoint =
          await completeWorkerResidentScheduleQueueDrainCheckpoint({
            workerDevice: state.workerDevice,
            scheduleId,
            laneId,
            stateKey,
            completedStepCount,
            fencePromise: laggedFencePromise
          });
        if (checkpoint.fenceSatisfied === true) {
          // Start the next window's fence only after this one succeeded, so
          // a failed checkpoint aborts without touching the queue again. The
          // fence starts after the current window's submissions, so awaiting
          // it at the NEXT checkpoint still bounds unfenced work by roughly
          // two intervals while the encode pipeline keeps running.
          try {
            pendingQueueDrainFencePromise =
              state.workerDevice?.queue?.onSubmittedWorkDone?.() ?? null;
          } catch {
            pendingQueueDrainFencePromise = null;
          }
          if (pendingQueueDrainFencePromise?.catch) {
            pendingQueueDrainFencePromise.catch(() => {});
          }
        }
        queueDrainCheckpoints.push(checkpoint);
        if (checkpoint.fenceSatisfied !== true) {
          failedQueueDrainCheckpoint = checkpoint;
          const checkpointError = workerResidentScheduleError(
            'schedule-queue-drain-checkpoint-unsatisfied',
            checkpoint.reason || checkpoint.status || null,
            {
              scheduleId,
              stepOrdinal,
              stageId: 'schroederResidentScheduleQueueDrainCheckpoint',
              laneState: workerResidentScheduleLaneStateSnapshot(record, {
                laneId,
                stateKey
              })
            }
          );
          checkpointError.residentScheduleError.queueDrainCheckpoint =
            checkpoint;
          throw checkpointError;
        }
      }
      }
      }
    } catch (error) {
      scheduleLoopError = error;
    } finally {
      if (scheduleControlPlaneTaskYielder) {
        controlPlaneYieldReceipt = scheduleControlPlaneTaskYielder.close();
      }
    }
    if (submitBurstOpened) {
      // Close before any terminal fence so the last window's held work is
      // on the queue and later submits (terminal snapshots, next schedule
      // seeds) go direct. A failed close-flush is a poisoned schedule.
      try {
        submitBurstCloseStats =
          closeWorkerQueueSubmitBurst(state.workerDevice, 'burst-close');
      } catch (error) {
        if (!scheduleLoopError) {
          scheduleLoopError = workerResidentScheduleError(
            'schedule-submit-burst-close-failed',
            error instanceof Error ? error.message : String(error),
            { scheduleId }
          );
        }
      }
      submitBurstOpened = false;
    }
    // Once an intermediate queue completion reports a dead/invalid device,
    // do not issue a second blind queue callback. Convert that exact failure
    // into the terminal non-admission receipt and quarantine the lane below.
    const terminalGpuFence = failedQueueDrainCheckpoint
      ? failedQueueDrainCheckpointTerminalFence(failedQueueDrainCheckpoint, {
          scheduleId,
          laneId,
          stateKey,
          completedStepCount
        })
      : await completeWorkerResidentScheduleTerminalFence({
          workerDevice: state.workerDevice,
          scheduleId,
          laneId,
          stateKey,
          completedStepCount,
          workMayHaveBeenSubmitted:
            scheduleGpuWorkMayHaveBeenSubmitted,
          terminalRefluxReceiptRequired,
          terminalRefluxRingBuffer,
          terminalRefluxExpectations
        });
    const tailTerminalFenceDoneAtMs = workerResidentScheduleNowMs();
    if (tier0ExecutionAttempted) {
      tier0SubmittedCleanupRelease =
        releaseTier0SubmittedCleanups(terminalGpuFence);
      if (terminalGpuFence?.fenceSatisfied !== true) {
        record.poisonedTier0Execution = tier0ExecutionResult;
        record.poisonedTier0SubmittedCleanupRecords =
          tier0SubmittedCleanupRecords;
      }
      if (
        tier0SubmittedCleanupRelease.status
          === 'tier0-submitted-cleanup-release-failed'
      ) {
        record.poisonedTier0SubmittedCleanupRecords =
          tier0SubmittedCleanupRecords.filter(
            (cleanupRecord) => cleanupRecord.released !== true
          );
        if (!scheduleLoopError) {
          scheduleLoopError = workerResidentScheduleError(
            'tier0-submitted-cleanup-release-failed',
            'one or more fused sequence temporaries failed to release after the terminal fence',
            {
              scheduleId,
              stepOrdinal: completedStepCount || stepCount,
              stageId: TIER0_FUSED_RESIDENT_SEQUENCE_STAGE_ID
            }
          );
        }
      }
    }
    if (phaseCarrierOneToFourExecution) {
      if (terminalGpuFence?.fenceSatisfied === true) {
        const terminalBuffers = retainedContinuationBuffersFromUploads({
          sphParticleUpload:
            record.schroederLane?.sphParticleUpload,
          mlsMpmParticleUpload:
            record.schroederLane?.mlsMpmParticleUpload
        });
        const retiredBuffers = new Set();
        try {
          phaseCarrierOneToFourExecution.cleanupSubmittedWork?.();
          if (!phaseCarrierOneToFourAdopted) {
            phaseCarrierOneToFourExecution.destroyOutputParticleBuffers?.();
          } else if (phaseCarrierOneToFourSourceResidentStep) {
            const sourceStepUploads =
              phaseCarrierOneToFourSourceResidentStep.nextParticleUploads;
            const supersededBuffers = [
              sourceStepUploads?.sphParticleUpload?.stateBuffer,
              sourceStepUploads?.sphParticleUpload?.thermoBuffer,
              sourceStepUploads?.sphParticleUpload?.identityBuffer,
              sourceStepUploads?.mlsMpmParticleUpload?.mechanicsBuffer
            ].filter(
              (buffer) => buffer && !terminalBuffers.includes(buffer)
            );
            if (
              supersededBuffers.length !== 4
              || new Set(supersededBuffers).size !== 4
            ) {
              throw new Error(
                'Phase-carrier source retirement requires four distinct superseded core buffers'
              );
            }
            const retirementEvidence = destroyMlsMpmResidentStepBuffers(
              phaseCarrierOneToFourSourceResidentStep,
              {
                preserveBuffers: terminalBuffers,
                destroyInputResidentProductMass: true
              }
            );
            if (
              phaseCarrierOneToFourSourceResidentStep
                .residentCleanupCompletion?.then
            ) {
              const cleanupReceipt = await phaseCarrierOneToFourSourceResidentStep
                .residentCleanupCompletion;
              if (cleanupReceipt?.status !== 'resident-cleanup-complete') {
                throw new Error(
                  'Phase-carrier source retirement owner cleanup did not complete'
                );
              }
            }
            if (
              !(retirementEvidence?.retiredBuffers instanceof Set)
              || supersededBuffers.some(
                (buffer) => !retirementEvidence.retiredBuffers.has(buffer)
              )
            ) {
              throw new Error(
                'Phase-carrier source retirement did not confirm all four core buffers'
              );
            }
            for (const buffer of supersededBuffers) {
              retiredBuffers.add(buffer);
            }
          } else if (phaseCarrierOneToFourSourceUploads) {
            const sourceSph =
              phaseCarrierOneToFourSourceUploads.sphParticleUpload;
            const sourceMls =
              phaseCarrierOneToFourSourceUploads.mlsMpmParticleUpload;
            for (const [owned, buffer] of [
              [sourceSph?.ownsStateBuffer !== false, sourceSph?.stateBuffer],
              [sourceSph?.ownsThermoBuffer !== false, sourceSph?.thermoBuffer],
              [sourceSph?.ownsIdentityBuffer !== false, sourceSph?.identityBuffer],
              [sourceMls?.ownsMechanicsBuffer !== false, sourceMls?.mechanicsBuffer]
            ]) {
              if (!owned || !buffer || terminalBuffers.includes(buffer)) {
                continue;
              }
              buffer.destroy?.();
              retiredBuffers.add(buffer);
            }
          }
          if (
            phaseCarrierOneToFourAdopted
            && retiredBuffers.size !== 4
          ) {
            throw new Error(
              'Phase-carrier source retirement did not confirm exactly four core buffers'
            );
          }
          for (const [ref, buffer] of record.retainedBuffers) {
            if (retiredBuffers.has(buffer)) record.retainedBuffers.delete(ref);
          }
          phaseCarrierOneToFourSourceRetirement = Object.freeze({
            schema:
              'peercompute.ulg.worker-phase-carrier-one-to-four-source-retirement.v0',
            status: phaseCarrierOneToFourAdopted
              ? 'phase-carrier-one-to-four-source-retired-after-terminal-fence'
              : 'phase-carrier-one-to-four-rejected-output-retired-after-terminal-fence',
            terminalFenceSatisfied: true,
            sourceFamilyAdopted: phaseCarrierOneToFourAdopted,
            retiredSourceBufferCount: retiredBuffers.size,
            rejectedOutputRetired: !phaseCarrierOneToFourAdopted,
            submittedWorkCleanupReleased: true
          });
          if (phaseCarrierOneToFourTransitionReceipt) {
            phaseCarrierOneToFourTransitionReceipt = Object.freeze({
              ...phaseCarrierOneToFourTransitionReceipt,
              status:
                'phase-carrier-one-to-four-adopted-terminal-fence-satisfied',
              terminalFenceSatisfied: true,
              supersededSourceRetired: true,
              sourceRetirement: phaseCarrierOneToFourSourceRetirement
            });
          }
          record.pendingPhaseCarrierOneToFourTransition = null;
        } catch (error) {
          poisonWorkerResidentScheduleLane(record, {
            reason: 'phase-carrier-one-to-four-retirement-failed',
            scheduleId,
            stepOrdinal: completedStepCount || 0,
            terminalGpuFence
          });
          if (!scheduleLoopError) {
            scheduleLoopError = workerResidentScheduleError(
              'phase-carrier-one-to-four-retirement-failed',
              error instanceof Error ? error.message : String(error),
              {
                scheduleId,
                stepOrdinal: completedStepCount || 0,
                stageId: 'phaseCarrierOneToFourMaterialization'
              }
            );
          }
        }
      } else {
        record.pendingPhaseCarrierOneToFourTransition = {
          sourceResidentStep: phaseCarrierOneToFourSourceResidentStep,
          sourceUploads: phaseCarrierOneToFourSourceUploads,
          execution: phaseCarrierOneToFourExecution
        };
      }
    }
    const reactionActivationObservationExpected = Boolean(
      scheduleReactionActivationWatchRequested
      && completedStepCount > 0
    );
    const reactionActivationObservationCaptureAllowed = Boolean(
      reactionActivationObservationExpected
      && cancelled === false
      && completedStepCount === stepCount
    );
    const expectedReactionActivationProducerRoute = tier0RouteSelected
      ? 'tier0-fused-resident-sequence'
      : 'canonical-schroeder';
    const expectedReactionActivationSampleStage = tier0RouteSelected
      ? 'tier0-terminal-post-separation-motion-envelope'
      : 'canonical-terminal-published-carrier-family-motion-envelope';
    const expectedReactionActivationParticleCount = Number(
      lastStepSummary?.particleCount
    );
    const expectedReactionActivationCount =
      admittedTargetScheduleAuthority?.tableFingerprints
        ?.watchReactionCount ?? null;
    const expectedReactionActivationTableFingerprint =
      admittedTargetScheduleAuthority?.tableFingerprints
        ?.watchReactionTableFingerprint ?? null;
    const terminalReactionActivationProposal =
      record.schroederLane?.residentStep
        ?.reactionActivationObservationProposal ?? null;
    // These expectations come from the terminal schedule summary and the
    // independently admitted target authority, never from the proposal that
    // is about to be authenticated. A miswired private capability therefore
    // cannot define the contract against which its own observation is judged.
    const reactionActivationObservationDescriptor = {
      particleCount: expectedReactionActivationParticleCount,
      reactionCount: expectedReactionActivationCount,
      reactionTableFingerprint:
        expectedReactionActivationTableFingerprint,
      producerRoute: expectedReactionActivationProducerRoute,
      sampleStage: expectedReactionActivationSampleStage,
      nodeDomain: 'fixed-phase-carrier-slot',
      motionEnvelope: scheduleReactionActivationMotionEnvelope
    };
    for (const countField of ['particleCount', 'reactionCount']) {
      if (
        !Number.isSafeInteger(
          reactionActivationObservationDescriptor[countField]
        )
        || Object.is(
          reactionActivationObservationDescriptor[countField],
          -0
        )
        || reactionActivationObservationDescriptor[countField] < 1
        || reactionActivationObservationDescriptor[countField]
          > SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
      ) {
        reactionActivationObservationDescriptor[countField] = null;
      }
    }
    let reactionActivationGpuObservation = null;
    let reactionActivationObservationFailureReason = null;
    let reactionActivationObservationMapAsyncCount = 0;
    const currentTerminalReactionActivationStorageFamily = () => {
      const lane = record.schroederLane ?? null;
      const nextUploads = lane?.residentStep?.nextParticleUploads ?? null;
      const sphUpload = nextUploads?.sphParticleUpload ?? null;
      const mlsMpmUpload = nextUploads?.mlsMpmParticleUpload ?? null;
      if (
        lane?.sphParticleUpload !== sphUpload
        || lane?.mlsMpmParticleUpload !== mlsMpmUpload
        || !sphUpload?.stateBuffer
        || !sphUpload?.thermoBuffer
        || !mlsMpmUpload?.mechanicsBuffer
        || sphUpload.particleCount
          !== expectedReactionActivationParticleCount
        || mlsMpmUpload.particleCount
          !== expectedReactionActivationParticleCount
      ) return null;
      return {
        device: state.workerDevice,
        terminalStateBuffer: sphUpload.stateBuffer,
        terminalThermoBuffer: sphUpload.thermoBuffer,
        terminalMechanicsBuffer: mlsMpmUpload.mechanicsBuffer,
        particleCount: expectedReactionActivationParticleCount
      };
    };
    if (
      reactionActivationObservationCaptureAllowed
      && terminalGpuFence?.fenceSatisfied === true
      && !scheduleLoopError
      && state.workerDevice
    ) {
      if (!terminalReactionActivationProposal) {
        reactionActivationObservationFailureReason =
          scheduleReactionActivationMotionEnvelopeFailure
          || 'terminal-reaction-activation-proposal-missing';
      } else {
        const compactMotionWatch =
          terminalReactionActivationProposal.schema
            === ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_PROPOSAL_SCHEMA;
        try {
          const preMapTerminalStorageFamily =
            currentTerminalReactionActivationStorageFamily();
          if (
            compactMotionWatch
            && (
              !preMapTerminalStorageFamily
              || !sphReactionMotionEnvelopeWatchMatchesTerminalStorageFamily(
                terminalReactionActivationProposal,
                preMapTerminalStorageFamily
              )
            )
          ) {
            throw malformedReactionActivationObservationError(
              'reaction motion watch does not match the exact terminal particle storage family'
            );
          }
          if (
            compactMotionWatch
            && markSphReactionMotionEnvelopeWatchSubmittedWorkCompleted(
              terminalReactionActivationProposal,
              { device: state.workerDevice }
            ) !== true
          ) {
            throw malformedReactionActivationObservationError(
              'Tier0 reaction motion watch rejected the satisfied terminal fence'
            );
          }
          reactionActivationGpuObservation =
            compactMotionWatch
              ? await observeSphReactionMotionEnvelopeWatch(
                  terminalReactionActivationProposal,
                  { device: state.workerDevice }
                )
              : await observeSchroederSpatialReactionDiscoveryActivation(
                  terminalReactionActivationProposal,
                  { device: state.workerDevice }
                );
          const postMapTerminalStorageFamily =
            currentTerminalReactionActivationStorageFamily();
          if (
            compactMotionWatch
            && (
              !postMapTerminalStorageFamily
              || !sphReactionMotionEnvelopeWatchMatchesTerminalStorageFamily(
                terminalReactionActivationProposal,
                postMapTerminalStorageFamily
              )
            )
          ) {
            throw malformedReactionActivationObservationError(
              'reaction motion watch terminal particle storage family changed while evidence was pending'
            );
          }
          if (!exactReactionActivationGpuObservation(
            reactionActivationGpuObservation,
            {
              particleCount:
                reactionActivationObservationDescriptor.particleCount,
              reactionCount:
                reactionActivationObservationDescriptor.reactionCount,
              reactionTableFingerprint:
                expectedReactionActivationTableFingerprint,
              producerRoute:
                expectedReactionActivationProducerRoute,
              sampleStage:
                expectedReactionActivationSampleStage,
              motionEnvelope:
                scheduleReactionActivationMotionEnvelope
            }
          )) {
            throw malformedReactionActivationObservationError(
              'reaction activation observer returned malformed evidence'
            );
          }
        } catch (error) {
          reactionActivationObservationFailureReason =
            error instanceof Error ? error.message : String(error);
          const failureMapAsyncCount = Number(
            error?.reactionActivationObservationMapAsyncCount
          );
          reactionActivationObservationMapAsyncCount =
            Number.isSafeInteger(failureMapAsyncCount)
            && !Object.is(failureMapAsyncCount, -0)
            && failureMapAsyncCount >= 0
            && failureMapAsyncCount <= 1
              ? failureMapAsyncCount
              : 0;
          const fatalReactionActivationObservation = Boolean(
            error?.reactionActivationObservationFatal === true
            || error?.code
              === ULG_SPH_REACTION_ACTIVATION_OBSERVATION_FATAL_ERROR_CODE
          );
          const reactionActivationObservationDeviceLost = Boolean(
            error?.reactionActivationObservationDeviceLost === true
            || error?.code
              === ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_DEVICE_LOST_ERROR_CODE
          );
          if (reactionActivationObservationDeviceLost) {
            poisonWorkerResidentScheduleLane(record, {
              reason: 'reaction-activation-observation-device-lost',
              scheduleId,
              stepOrdinal: completedStepCount || null,
              terminalGpuFence
            });
            if (!scheduleLoopError) {
              scheduleLoopError = workerResidentScheduleError(
                'reaction-activation-observation-device-lost',
                reactionActivationObservationFailureReason,
                {
                  scheduleId,
                  stepOrdinal: completedStepCount || null,
                  stageId: 'reactionActivationObservation'
                }
              );
            }
          } else if (fatalReactionActivationObservation) {
            poisonWorkerResidentScheduleLane(record, {
              reason: 'reaction-activation-observation-malformed-evidence',
              scheduleId,
              stepOrdinal: completedStepCount || null,
              terminalGpuFence
            });
            if (!scheduleLoopError) {
              scheduleLoopError = workerResidentScheduleError(
                'reaction-activation-observation-malformed-evidence',
                reactionActivationObservationFailureReason,
                {
                  scheduleId,
                  stepOrdinal: completedStepCount || null,
                  stageId: 'reactionActivationObservation'
                }
              );
            }
          }
        } finally {
          terminalReactionActivationProposal.destroy?.();
        }
      }
    } else if (
      terminalReactionActivationProposal
      && terminalGpuFence?.fenceSatisfied === true
    ) {
      // A schedule failure, cancellation before its requested terminal
      // ordinal, or an unexpected capture must never strand the arena lease.
      // The already-satisfied schedule fence is explicit destruction authority
      // for Tier0's compact buffers. A failed fence leaves either producer
      // family pinned on the poisoned lane for explicit teardown.
      if (
        terminalReactionActivationProposal.schema
          === ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_PROPOSAL_SCHEMA
      ) {
        markSphReactionMotionEnvelopeWatchSubmittedWorkCompleted(
          terminalReactionActivationProposal,
          { device: state.workerDevice }
        );
      }
      terminalReactionActivationProposal.destroy?.();
      if (
        reactionActivationObservationExpected
        && reactionActivationObservationCaptureAllowed !== true
        && !scheduleLoopError
      ) {
        poisonWorkerResidentScheduleLane(record, {
          reason: 'reaction-activation-observation-unexpected-partial-capture',
          scheduleId,
          stepOrdinal: completedStepCount || null,
          terminalGpuFence
        });
        scheduleLoopError = workerResidentScheduleError(
          'reaction-activation-observation-unexpected-partial-capture',
          'a partial or cancelled schedule returned a terminal watch proposal',
          {
            scheduleId,
            stepOrdinal: completedStepCount || null,
            stageId: 'reactionActivationObservation'
          }
        );
      }
    } else if (
      reactionActivationObservationExpected
      && reactionActivationObservationCaptureAllowed !== true
    ) {
      reactionActivationObservationFailureReason =
        'reaction-activation-observation-not-sampled-after-partial-cancellation';
    }
    // The terminal fence just drained the queue, so the product-history
    // GPU count is final for this schedule: one 4-byte fixed-size evidence
    // read re-tightens the host-side live-row upper bound that otherwise
    // only grows (and drags the gas-EOS compact arena, its v1 spatial
    // epoch sort, and per-capacity pipeline families toward the full
    // 262144-row arena capacity). Failure keeps the conservative bound.
    let productHistoryLiveBoundObservation = null;
    let observedProductHistoryHandle = null;
    let observedProductHistoryArenaIdentity = null;
    if (
      terminalGpuFence?.fenceSatisfied === true
      && state.workerDevice
    ) {
      const observedLaneRecord = getLaneRecord(payload);
      observedProductHistoryHandle =
        previousWorkerResidentProductMass(observedLaneRecord)
        ?? observedLaneRecord?.schroederLane?.residentStepOptions
          ?.residentProductMass
        ?? null;
      if (observedProductHistoryHandle) {
        observedProductHistoryArenaIdentity =
          describeResidentProductHistoryArenaIdentity(
            state.workerDevice,
            observedProductHistoryHandle
          );
        productHistoryLiveBoundObservation =
          await observeResidentProductHistoryLiveRowBound(
            state.workerDevice,
            observedProductHistoryHandle
          );
      }
    }
    if (scheduleLoopError) {
      if (
        tier0ExecutionAttempted
        && tier0ExecutionResult
        && tier0ExecutionValidation?.valid !== true
      ) {
        if (terminalGpuFence?.fenceSatisfied === true) {
          try {
            destroyMlsMpmResidentStepsBuffers(
              tier0ExecutionResult,
              {
                preserveBuffers: [
                  tier0SupersededUploads?.sphParticleUpload?.stateBuffer,
                  tier0SupersededUploads?.sphParticleUpload?.thermoBuffer,
                  tier0SupersededUploads?.sphParticleUpload?.identityBuffer,
                  tier0SupersededUploads?.mlsMpmParticleUpload
                    ?.mechanicsBuffer,
                  scheduleStartLane?.sphParticleUpload?.stateBuffer,
                  scheduleStartLane?.sphParticleUpload?.thermoBuffer,
                  scheduleStartLane?.sphParticleUpload?.identityBuffer,
                  scheduleStartLane?.mlsMpmParticleUpload?.mechanicsBuffer
                ].filter(Boolean)
              }
            );
            if (
              !tier0ExecutionResult.finalStep
              || tier0ExecutionResult.finalStep.nextParticleUploads
                !== tier0ExecutionValidation?.nextUploads
            ) {
              const preserved = new Set([
                scheduleStartLane?.sphParticleUpload?.stateBuffer,
                scheduleStartLane?.sphParticleUpload?.thermoBuffer,
                scheduleStartLane?.sphParticleUpload?.identityBuffer,
                scheduleStartLane?.mlsMpmParticleUpload?.mechanicsBuffer
              ].filter(Boolean));
              for (const buffer of retainedContinuationBuffersFromUploads(
                tier0ExecutionValidation?.nextUploads
              )) {
                if (!preserved.has(buffer)) buffer.destroy?.();
              }
            }
          } catch {
            // Preserve the typed validation failure. The poisoned lane's final
            // owned-buffer walk remains the best-effort safety net.
            record.poisonedTier0Execution = tier0ExecutionResult;
          }
        } else {
          // No satisfied fence means destruction is not yet safe. Retain the
          // rejected family and cleanup closures on the poisoned record so
          // explicit lane/device teardown can retire them instead of dropping
          // the only owning references.
          record.poisonedTier0Execution = tier0ExecutionResult;
          record.poisonedTier0SubmittedCleanupRecords =
            tier0SubmittedCleanupRecords;
        }
      }
      const terminalReceiptLoopFailure =
        scheduleLoopError.residentScheduleError?.reason
          === 'schedule-terminal-reflux-copy-receipt-invalid';
      if (
        scheduleGpuWorkMayHaveBeenSubmitted
        && !record.residentSchedulePoison
        && (
          tier0ExecutionAttempted
          || Boolean(phaseCarrierOneToFourExecution)
          ||
          terminalGpuFence?.fenceSatisfied !== true
          || terminalGpuFence?.authorityAdmissionReady !== true
          || terminalReceiptLoopFailure
        )
      ) {
        poisonWorkerResidentScheduleLane(record, {
          reason: tier0ExecutionAttempted
            ? 'tier0-fused-terminal-publication-rejected-after-submit'
            : (phaseCarrierOneToFourExecution
              ? 'phase-carrier-one-to-four-schedule-rejected-after-submit'
            : (terminalGpuFence?.fenceSatisfied !== true
            ? 'schedule-terminal-gpu-fence-unsatisfied'
            : 'schedule-terminal-reflux-receipt-rejected')),
          scheduleId,
          stepOrdinal:
            scheduleLoopError.residentScheduleError?.stepOrdinal ?? null,
          terminalGpuFence
        });
      }
      if (scheduleLoopError.residentScheduleError) {
        scheduleLoopError.residentScheduleError.controlPlaneYieldReceipt =
          controlPlaneYieldReceipt;
        scheduleLoopError.residentScheduleError.terminalGpuFence =
          terminalGpuFence;
        scheduleLoopError.residentScheduleError.terminalGpuFenceSatisfied =
          terminalGpuFence?.fenceSatisfied === true;
        if (tier0ExecutionValidation) {
          scheduleLoopError.residentScheduleError.tier0ValidationFailures = [
            ...(tier0ExecutionValidation.failures || [])
          ];
        }
      }
      throw scheduleLoopError;
    }
    if (terminalGpuFence?.fenceSatisfied !== true) {
      if (scheduleGpuWorkMayHaveBeenSubmitted) {
        poisonWorkerResidentScheduleLane(record, {
          reason: 'schedule-terminal-gpu-fence-unsatisfied',
          scheduleId,
          stepOrdinal: completedStepCount || null,
          terminalGpuFence
        });
      }
      const error = workerResidentScheduleError(
        'schedule-terminal-gpu-fence-unsatisfied',
        terminalGpuFence?.reason || terminalGpuFence?.status || null,
        {
          scheduleId,
          stepOrdinal: completedStepCount || null,
          stageId: 'schroederResidentScheduleTerminal',
          laneState: workerResidentScheduleLaneStateSnapshot(record, {
            laneId,
            stateKey
          })
        }
      );
      error.residentScheduleError.controlPlaneYieldReceipt =
        controlPlaneYieldReceipt;
      error.residentScheduleError.terminalGpuFence = terminalGpuFence;
      error.residentScheduleError.terminalGpuFenceSatisfied = false;
      throw error;
    }
    if (terminalGpuFence?.authorityAdmissionReady !== true) {
      poisonWorkerResidentScheduleLane(record, {
        reason: 'schedule-terminal-reflux-receipt-rejected',
        scheduleId,
        stepOrdinal:
          terminalGpuFence?.terminalRefluxReceipt
            ?.firstRejectedStepOrdinal
          ?? completedStepCount
          ?? null,
        terminalGpuFence
      });
      const error = workerResidentScheduleError(
        'schedule-terminal-reflux-receipt-rejected',
        terminalGpuFence?.terminalRefluxReceipt?.reason
          || terminalGpuFence?.reason
          || terminalGpuFence?.status
          || null,
        {
          scheduleId,
          stepOrdinal:
            terminalGpuFence?.terminalRefluxReceipt
              ?.firstRejectedStepOrdinal
            ?? completedStepCount
            ?? null,
          stageId: 'schroederResidentScheduleTerminalRefluxReceipt',
          laneState: workerResidentScheduleLaneStateSnapshot(record, {
            laneId,
            stateKey
          })
        }
      );
      error.residentScheduleError.controlPlaneYieldReceipt =
        controlPlaneYieldReceipt;
      error.residentScheduleError.terminalGpuFence = terminalGpuFence;
      error.residentScheduleError.terminalGpuFenceSatisfied = true;
      error.residentScheduleError.authorityAdmissionReady = false;
      if (
        lastStepSummary?.hierarchyStageSummary
          ?.stageMechanicsTraceRequested === true
        && terminalGpuFence?.terminalRefluxReceipt
          ?.firstRejectedStepOrdinal === completedStepCount
      ) {
        // Diagnostic-only: stageMechanicsTrace=1 serializes the compact
        // post-stage authority snapshots. When a deliberately bounded run
        // ends on the first rejected header, retain that exact last-step
        // snapshot on the typed error so the page can localize the GPU
        // predicate without weakening terminal admission or adding another
        // readback to normal schedules.
        error.residentScheduleError.authorityDiagnostics = {
          schema:
            'peercompute.ulg.worker-resident-schedule-terminal-reflux-diagnostic.v0',
          firstRejectedStepOrdinal: completedStepCount,
          hierarchyStageSummary: lastStepSummary.hierarchyStageSummary
        };
      }
      throw error;
    }
    if (tier0RouteSelected) {
      const terminalBuffers = retainedContinuationBuffersFromUploads(
        tier0ExecutionValidation?.nextUploads
      );
      const retiredBuffers = new Set();
      try {
        if (tier0SupersededResidentStep) {
          const supersededBuffers = retainedContinuationBuffersFromUploads(
            tier0SupersededResidentStep.nextParticleUploads
          ).filter((buffer) => !terminalBuffers.includes(buffer));
          destroyMlsMpmResidentStepBuffers(tier0SupersededResidentStep, {
            preserveBuffers: terminalBuffers,
            destroyInputResidentProductMass: true
          });
          for (const buffer of supersededBuffers) retiredBuffers.add(buffer);
        } else if (tier0SupersededUploads) {
          const sourceSph = tier0SupersededUploads.sphParticleUpload;
          const sourceMls = tier0SupersededUploads.mlsMpmParticleUpload;
          for (const [owned, buffer] of [
            [sourceSph?.ownsStateBuffer !== false, sourceSph?.stateBuffer],
            [sourceSph?.ownsThermoBuffer !== false, sourceSph?.thermoBuffer],
            [sourceSph?.ownsIdentityBuffer !== false, sourceSph?.identityBuffer],
            [sourceMls?.ownsMechanicsBuffer !== false, sourceMls?.mechanicsBuffer]
          ]) {
            if (!owned || !buffer || terminalBuffers.includes(buffer)) continue;
            buffer.destroy?.();
            retiredBuffers.add(buffer);
          }
        }
        const lane = record.schroederLane;
        const seedAssignmentBuffer =
          lane?.laneSeed?.levelAssignment?.assignmentBuffer ?? null;
        if (seedAssignmentBuffer && !terminalBuffers.includes(seedAssignmentBuffer)) {
          seedAssignmentBuffer.destroy?.();
          retiredBuffers.add(seedAssignmentBuffer);
          lane.laneSeed = {
            ...lane.laneSeed,
            levelAssignment: null,
            assignmentRetiredAfterTier0TerminalFence: true
          };
        }
        for (const [ref, buffer] of record.retainedBuffers) {
          if (retiredBuffers.has(buffer)) record.retainedBuffers.delete(ref);
        }
        tier0SupersededFamilyRetirement = Object.freeze({
          schema:
            'peercompute.ulg.worker-tier0-superseded-family-retirement.v0',
          status: 'tier0-superseded-family-retired-after-terminal-fence',
          terminalFenceSatisfied: true,
          retiredBufferCount: retiredBuffers.size,
          seedAssignmentRetired:
            lane?.laneSeed?.assignmentRetiredAfterTier0TerminalFence === true
        });
      } catch (error) {
        poisonWorkerResidentScheduleLane(record, {
          reason: 'tier0-superseded-family-retirement-failed',
          scheduleId,
          stepOrdinal: completedStepCount,
          terminalGpuFence
        });
        const scheduleError = workerResidentScheduleError(
          'tier0-superseded-family-retirement-failed',
          error instanceof Error ? error.message : String(error),
          {
            scheduleId,
            stepOrdinal: completedStepCount,
            stageId: TIER0_FUSED_RESIDENT_SEQUENCE_STAGE_ID,
            laneState: workerResidentScheduleLaneStateSnapshot(record, {
              laneId,
              stateKey
            })
          }
        );
        scheduleError.residentScheduleError.controlPlaneYieldReceipt =
          controlPlaneYieldReceipt;
        scheduleError.residentScheduleError.terminalGpuFence =
          terminalGpuFence;
        throw scheduleError;
      }
    }
    const terminalLastStepSummary = lastStepSummary
      ? {
          ...lastStepSummary,
          stageFenceSatisfied: lastStepSummary.gpuFenceSatisfied,
          stageFenceStatus: lastStepSummary.gpuFenceStatus,
          gpuFenceSatisfied: true,
          gpuFenceStatus:
            'gpu-fence-satisfied-by-resident-schedule-terminal',
          coveredByScheduleTerminalFence: true,
          terminalScheduleFenceSatisfied: true,
          authorityAdmissionReady: true
        }
      : null;
    const phaseVolumeSurfaceStressSubmissionEvidenceComplete = Boolean(
      phaseVolumeSurfaceStressRequired
      && cancelled === false
      && completedStepCount === stepCount
      && phaseVolumeSurfaceStressObservedStepCount === completedStepCount
      && phaseVolumeSurfaceStressExactSubmissionCount === completedStepCount
      && phaseVolumeSurfaceStressFirstIncompleteStepOrdinal == null
    );
    const twoLevelMechanicsCoverageComplete = Boolean(
      twoLevelMechanicsRequested
      && cancelled === false
      && completedStepCount === stepCount
      && twoLevelMechanicsAuthorityRequested === 'authoritative'
      && twoLevelMechanicsObservedStepCount === completedStepCount
      && twoLevelMechanicsExactAuthoritativeStepCount === completedStepCount
      && twoLevelMechanicsFirstIncompleteStepOrdinal == null
      && (
        !twoLevelCflFactorEvidenceRequired
        || (
          twoLevelMechanicsCflFactorObservedStepCount === completedStepCount
          && twoLevelMechanicsExactCflFactorCount === completedStepCount
          && twoLevelMechanicsFirstCflFactorMismatchStepOrdinal == null
        )
      )
      && (
        terminalRefluxReceiptRequired !== true
        || (
          terminalGpuFence?.terminalRefluxReceipt?.allStepsAdmitted === true
          && terminalGpuFence.terminalRefluxReceipt.admittedStepCount
            === completedStepCount
        )
      )
    );
    const twoLevelMechanicsEvidence = {
      schema:
        'peercompute.ulg.worker-resident-schedule-two-level-mechanics-evidence.v0',
      requested: twoLevelMechanicsRequested,
      authorityRequested: twoLevelMechanicsAuthorityRequested,
      fineSubstepCountRequested: twoLevelFineSubstepCountRequested,
      cflFactorEvidenceRequired: twoLevelCflFactorEvidenceRequired,
      cflFactorRequested: twoLevelCflFactorRequested,
      cflFactorObservedStepCount:
        twoLevelMechanicsCflFactorObservedStepCount,
      exactCflFactorCount: twoLevelMechanicsExactCflFactorCount,
      firstCflFactorMismatchStepOrdinal:
        twoLevelMechanicsFirstCflFactorMismatchStepOrdinal,
      lastCflFactor: twoLevelMechanicsLastCflFactor,
      observedStepCount: twoLevelMechanicsObservedStepCount,
      exactStatusCount: twoLevelMechanicsExactStatusCount,
      exactAuthorityCount: twoLevelMechanicsExactAuthorityCount,
      exactFineSubstepCount: twoLevelMechanicsExactFineSubstepCount,
      commitVerifiedCount: twoLevelMechanicsCommitVerifiedCount,
      exactAuthoritativeStepCount:
        twoLevelMechanicsExactAuthoritativeStepCount,
      authoritativeStepCount:
        twoLevelMechanicsExactAuthoritativeStepCount,
      terminalRefluxReceiptRequired,
      terminalRefluxReceipt:
        terminalGpuFence?.terminalRefluxReceipt ?? null,
      terminalRefluxAdmittedStepCount:
        terminalGpuFence?.terminalRefluxReceipt?.admittedStepCount ?? 0,
      firstIncompleteStepOrdinal:
        twoLevelMechanicsFirstIncompleteStepOrdinal,
      lastStep: twoLevelMechanicsLastStep,
      coverageComplete: twoLevelMechanicsCoverageComplete
    };
    if (
      twoLevelMechanicsRequested
      && cancelled === false
      && twoLevelMechanicsCoverageComplete !== true
    ) {
      poisonWorkerResidentScheduleLane(record, {
        reason: 'schedule-two-level-mechanics-evidence-incomplete',
        scheduleId,
        stepOrdinal:
          twoLevelMechanicsFirstCflFactorMismatchStepOrdinal
          ?? twoLevelMechanicsFirstIncompleteStepOrdinal
          ?? completedStepCount
          ?? null,
        terminalGpuFence
      });
      const error = workerResidentScheduleError(
        'schedule-two-level-mechanics-evidence-incomplete',
        'the authoritative two-level schedule did not preserve its exact requested execution profile',
        {
          scheduleId,
          stepOrdinal:
            twoLevelMechanicsFirstCflFactorMismatchStepOrdinal
            ?? twoLevelMechanicsFirstIncompleteStepOrdinal
            ?? completedStepCount
            ?? null,
          stageId: 'schroederResidentScheduleTwoLevelEvidence',
          laneState: workerResidentScheduleLaneStateSnapshot(record, {
            laneId,
            stateKey
          })
        }
      );
      error.residentScheduleError.controlPlaneYieldReceipt =
        controlPlaneYieldReceipt;
      error.residentScheduleError.terminalGpuFence = terminalGpuFence;
      error.residentScheduleError.twoLevelMechanicsEvidence =
        twoLevelMechanicsEvidence;
      throw error;
    }
    const terminalLane = record.schroederLane || null;
    const finalParticleLineage = exactWorkerScheduleParticleFamilyLineage({
      sphParticleUpload: terminalLane?.sphParticleUpload,
      mlsMpmParticleUpload: terminalLane?.mlsMpmParticleUpload
    });
    const terminalParticleFamilyCounts = Object.freeze({
      sphState: Number(terminalLane?.sphParticleState?.particleCount),
      sphUpload: Number(terminalLane?.sphParticleUpload?.particleCount),
      mlsMpmState: Number(terminalLane?.mlsMpmParticleState?.particleCount),
      mlsMpmUpload: Number(
        terminalLane?.mlsMpmParticleUpload?.particleCount
      )
    });
    const sourceParticleCount = scheduleStartParticleFamilyCounts.sphUpload;
    const targetParticleCount = terminalParticleFamilyCounts.sphUpload;
    const exactSourceParticleFamily = Boolean(
      Number.isSafeInteger(sourceParticleCount)
      && sourceParticleCount > 0
      && Object.values(scheduleStartParticleFamilyCounts).every(
        (count) => count === sourceParticleCount
      )
    );
    const terminalStepParticleCount = Number(
      terminalLastStepSummary?.particleCount
    );
    const exactTargetParticleFamily = Boolean(
      Number.isSafeInteger(targetParticleCount)
      && targetParticleCount > 0
      && Object.values(terminalParticleFamilyCounts).every(
        (count) => count === targetParticleCount
      )
      && terminalStepParticleCount === targetParticleCount
    );
    const particleCardinality = Object.freeze({
      schema: 'peercompute.ulg.worker-schedule-particle-cardinality.v0',
      status: exactSourceParticleFamily && exactTargetParticleFamily
        ? 'worker-schedule-particle-cardinality-exact'
        : 'worker-schedule-particle-cardinality-incomplete',
      sourceParticleCount,
      targetParticleCount,
      sourceSphStateParticleCount:
        scheduleStartParticleFamilyCounts.sphState,
      sourceSphUploadParticleCount:
        scheduleStartParticleFamilyCounts.sphUpload,
      sourceMlsMpmStateParticleCount:
        scheduleStartParticleFamilyCounts.mlsMpmState,
      sourceMlsMpmUploadParticleCount:
        scheduleStartParticleFamilyCounts.mlsMpmUpload,
      targetSphStateParticleCount: terminalParticleFamilyCounts.sphState,
      targetSphUploadParticleCount: terminalParticleFamilyCounts.sphUpload,
      targetMlsMpmStateParticleCount:
        terminalParticleFamilyCounts.mlsMpmState,
      targetMlsMpmUploadParticleCount:
        terminalParticleFamilyCounts.mlsMpmUpload,
      terminalStepParticleCount,
      exactSourceParticleFamily,
      exactTargetParticleFamily
    });
    const productEventBufferRetained = Boolean(
      observedProductHistoryHandle?.productEventBufferRetained === true
    );
    const productEventRowCount = Number(
      observedProductHistoryHandle?.productEventRowCount
    );
    const exactProductEventRowCount = Number.isSafeInteger(
      productEventRowCount
    )
      && productEventRowCount > 0
      && productEventRowCount
        <= SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT;
    const exactProductHistoryLiveBound = Boolean(
      productHistoryLiveBoundObservation?.schema
        === 'peercompute.ulg.sph-product-history-live-bound-observation.v0'
      && Number.isSafeInteger(
        productHistoryLiveBoundObservation.observedLiveRowCount
      )
      && productHistoryLiveBoundObservation.observedLiveRowCount > 0
      && productHistoryLiveBoundObservation.arenaRowCapacity
        === productEventRowCount
      && productHistoryLiveBoundObservation.readbackByteLength
        === Uint32Array.BYTES_PER_ELEMENT
      && productHistoryLiveBoundObservation.arenaIdentity?.schema
        === 'peercompute.ulg.sph-resident-product-history-arena-identity.v0'
      && productHistoryLiveBoundObservation.arenaIdentity?.status
        === 'retained-product-history-arena-authenticated'
      && productHistoryLiveBoundObservation.arenaIdentity?.rowCapacity
        === productEventRowCount
    );
    const exactProductHistoryArenaIdentity = Boolean(
      observedProductHistoryArenaIdentity?.schema
        === 'peercompute.ulg.sph-resident-product-history-arena-identity.v0'
      && observedProductHistoryArenaIdentity?.status
        === 'retained-product-history-arena-authenticated'
      && observedProductHistoryArenaIdentity?.rowCapacity
        === productEventRowCount
    );
    const retainedProductGasBoundaryActionable = Boolean(
      productEventBufferRetained
      && exactProductEventRowCount
      && exactProductHistoryArenaIdentity
      && terminalGpuFence?.fenceSatisfied === true
      && cancelled === false
    );
    const prospectiveWriterEvidence = Object.freeze({
      schema: ULG_WORKER_SCHEDULE_PROSPECTIVE_WRITER_EVIDENCE_SCHEMA,
      status: retainedProductGasBoundaryActionable
        ? 'worker-retained-product-gas-boundary-actionable'
        : productEventBufferRetained && exactProductEventRowCount
          ? 'worker-retained-product-gas-boundary-uncertain'
          : 'worker-retained-product-gas-boundary-inactive',
      gasBoundaryActionable: retainedProductGasBoundaryActionable,
      source: productEventBufferRetained && exactProductEventRowCount
        ? 'worker-retained-product-event-buffer'
        : null,
      productEventBufferRetained: Boolean(
        productEventBufferRetained && exactProductEventRowCount
      ),
      productEventRowCount: exactProductEventRowCount
        ? productEventRowCount
        : 0,
      productHistoryArenaIdentity:
        observedProductHistoryArenaIdentity == null
          ? null
          : Object.freeze({ ...observedProductHistoryArenaIdentity }),
      productHistoryLiveBoundObservation:
        !exactProductHistoryLiveBound
          ? null
          : Object.freeze({ ...productHistoryLiveBoundObservation }),
      terminalGpuFenceSatisfied: terminalGpuFence?.fenceSatisfied === true,
      scheduleCancelled: cancelled === true
    });
    let nextScheduleLawActivationObservation = null;
    if (reactionActivationObservationExpected) {
      const gpuObservation = reactionActivationGpuObservation;
      const observationContractMatches = Boolean(
        gpuObservation
        && gpuObservation.predicateRevision
          === SCHROEDER_SPATIAL_REACTION_ACTIVATION_PREDICATE_REVISION
        && gpuObservation.producerRoute
          === expectedReactionActivationProducerRoute
        && gpuObservation.sampleStage
          === expectedReactionActivationSampleStage
        && gpuObservation.nodeDomain === 'fixed-phase-carrier-slot'
        && gpuObservation.motionEnvelope
          === scheduleReactionActivationMotionEnvelope
      );
      if (gpuObservation && !observationContractMatches) {
        reactionActivationObservationFailureReason =
          'reaction-activation-motion-envelope-contract-mismatch';
      }
      const observationSucceeded = Boolean(
        gpuObservation?.schema
          === ULG_SCHROEDER_SPATIAL_REACTION_ACTIVATION_OBSERVATION_SCHEMA
        && gpuObservation.observationSucceeded === true
        && gpuObservation.uncertainty === false
        && Number.isSafeInteger(gpuObservation.triggeredSourceCount)
        && gpuObservation.triggeredSourceCount >= 0
        && (
          gpuObservation.motionEnvelope
            ?.thermalPhaseEvolutionEnabled !== true
          || gpuObservation.triggeredSourceCount
            === gpuObservation.particleCount
        )
        && observationContractMatches
      );
      const uncertainty = !observationSucceeded;
      const triggeredSourceCount = observationSucceeded
        ? gpuObservation.triggeredSourceCount
        : null;
      nextScheduleLawActivationObservation = Object.freeze({
        schema: ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_SCHEMA,
        status: observationSucceeded
          ? 'dynamic-law-routing-observation-ready'
          : 'dynamic-law-routing-observation-uncertain',
        sourceScheduleId: scheduleId,
        targetScheduleRequestId:
          admittedTargetScheduleAuthority?.targetScheduleRequestId ?? null,
        targetScheduleAuthorityFingerprint:
          admittedTargetScheduleAuthority?.requestFingerprint ?? null,
        laneId,
        stateKey,
        lawFamily: 'reaction',
        predicateRevision:
          gpuObservation?.predicateRevision
          ?? SCHROEDER_SPATIAL_REACTION_ACTIVATION_PREDICATE_REVISION,
        predicate:
          SPH_REACTION_MOTION_ENVELOPE_PREDICATE,
        producerRoute:
          expectedReactionActivationProducerRoute,
        sampleStage:
          expectedReactionActivationSampleStage,
        nodeDomain: 'fixed-phase-carrier-slot',
        motionEnvelope:
          scheduleReactionActivationMotionEnvelope,
        shadowOnly: SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY,
        routingAuthority: SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY,
        executionGating: SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE,
        observationSucceeded,
        triggered: uncertainty || triggeredSourceCount > 0,
        triggeredSourceCount,
        uncertainty,
        rawEvidenceWord: observationSucceeded
          ? gpuObservation.rawEvidenceWord
          : (gpuObservation ? 0xffff_ffff : null),
        particleCount:
          gpuObservation?.particleCount
          ?? reactionActivationObservationDescriptor.particleCount,
        reactionCount:
          gpuObservation?.reactionCount
          ?? reactionActivationObservationDescriptor.reactionCount,
        reactionTableFingerprint:
          gpuObservation?.reactionTableFingerprint
          ?? reactionActivationObservationDescriptor.reactionTableFingerprint
          ?? admittedTargetScheduleAuthority?.tableFingerprints
            ?.watchReactionTableFingerprint
          ?? null,
        prospectiveWriterEvidence,
        mapAsyncCount: gpuObservation?.mapAsyncCount
          ?? reactionActivationObservationMapAsyncCount,
        readbackByteLength: gpuObservation
          ? Uint32Array.BYTES_PER_ELEMENT
          : 0,
        fullParticleReadbackPerformed: false,
        terminalLineage: finalParticleLineage
          ? Object.freeze({ ...finalParticleLineage })
          : null,
        failureReason: observationSucceeded
          ? null
          : (
              reactionActivationObservationFailureReason
              || (gpuObservation?.uncertainty === true
                ? 'gpu-reaction-activation-evidence-fail-closed'
                : 'reaction-activation-observation-unavailable')
            ),
        failurePolicy: WORKER_DYNAMIC_LAW_OBSERVATION_FAILURE_POLICY
      });
    }
    if (terminalLane) {
      terminalLane.nextScheduleTargetAuthority =
        admittedTargetScheduleAuthority;
      terminalLane.nextScheduleLawActivationObservation =
        nextScheduleLawActivationObservation;
    }
    const finalRetainedBufferRefs = tier0RouteSelected
      ? [...tier0RetainedBufferRefs]
      : [...(lastMechanicsStageResult?.retainedBufferRefs || [])];
    executionRouteReceipt = Object.freeze({
      schema: ULG_WORKER_SCHEDULE_EXECUTION_ROUTE_RECEIPT_SCHEMA,
      status: tier0RouteSelected
        ? 'tier0-fused-resident-sequence-admitted'
        : 'canonical-schroeder-admitted',
      scheduleId,
      laneId,
      stateKey,
      route: executionRouteDecision.route,
      routeDecisionStatus: executionRouteDecision.status,
      activationReceipt: scheduleLawActivation,
      targetScheduleAuthority: admittedTargetScheduleAuthority,
      predecessorTargetTokenConsumption,
      nextScheduleLawActivationObservation,
      topologyAttestation: (
        tier0RouteSelected || phaseCarrierOneToFourExecution
      )
        ? tier0TopologyAttestation
        : null,
      phaseCarrierOneToFourTransition:
        phaseCarrierOneToFourTransitionReceipt,
      particleCardinality,
      blockers: [...executionRouteDecision.blockers],
      transition: phaseCarrierOneToFourExecution
        ? 'tier0-one-to-four-to-canonical-schedule-boundary'
        : executionRouteDecision.transition,
      execution: Object.freeze({
        requestedStepCount: stepCount,
        completedStepCount,
        atomicSchedule: tier0RouteSelected,
        progressMode: tier0RouteSelected
          ? 'terminal-only'
          : 'per-canonical-step',
        cancellationMode: tier0RouteSelected
          ? 'terminal-only-after-atomic-submit'
          : 'between-canonical-steps',
        preflightSchema:
          tier0ExecutionValidation?.preflight?.schema ?? null,
        preflightStatus:
          tier0ExecutionValidation?.preflight?.status ?? null,
        fusedSequenceSchema:
          tier0ExecutionValidation?.fused?.schema ?? null,
        fusedSequenceStatus:
          tier0ExecutionValidation?.fused?.status ?? null,
        commandSubmissionCount:
          tier0ExecutionValidation?.fused?.commandSubmissionCount ?? null,
        internalPositionSubstepCount:
          tier0ExecutionValidation?.fused?.internalPositionSubstepCount
          ?? null,
        fullParticleReadbackPerformed: tier0RouteSelected ? false : null,
        fullParticleReadbackFree: tier0RouteSelected ? true : null,
        mapAsyncCount: tier0RouteSelected ? 0 : null,
        readbackBytes: tier0RouteSelected ? 0 : null,
        residentContinuationReady: tier0RouteSelected ? true : null,
        canonicalSpatialEpochGenerated: !tier0RouteSelected,
        canonicalSpatialGenerationId:
          tier0RouteSelected ? null : previousEpochSeal?.generationId ?? null,
        finalEpochSealRequired: !tier0RouteSelected,
        terminalFenceSatisfied: true,
        sameWorkerDevice: true,
        submittedCleanupOwnership:
          tier0ExecutionValidation?.fused?.submittedCleanupOwnership ?? null,
        submittedCleanupRegistrationCount:
          tier0ExecutionValidation?.fused
            ?.submittedCleanupRegistrationCount ?? null,
        submittedCleanupRelease: tier0SubmittedCleanupRelease,
        phaseCarrierOneToFourMaterialized:
          phaseCarrierOneToFourAdopted,
        phaseCarrierOneToFourCommandSubmissionCount:
          phaseCarrierOneToFourExecution?.commandSubmissionCount ?? 0,
        phaseCarrierOneToFourFullParticleReadbackPerformed:
          phaseCarrierOneToFourExecution
            ?.fullParticleReadbackPerformed ?? false,
        phaseCarrierOneToFourSourceRetirement
      }),
      lineage: Object.freeze({
        source: tier0RouteSelected
          ? { ...tier0SourceLineage }
          : (phaseCarrierOneToFourExecution?.lineage?.source
            ? { ...phaseCarrierOneToFourExecution.lineage.source }
            : (scheduleStartTier0ContinuationIdentity
            ? { ...scheduleStartTier0ContinuationIdentity }
            : (tier0SourceLineage ? { ...tier0SourceLineage } : null))),
        target: finalParticleLineage
          ? { ...finalParticleLineage }
          : null,
        storageGenerationDelta: tier0RouteSelected ? 1 : null,
        physicsTickDelta: tier0RouteSelected ? stepCount : null,
        committedPositionEpochDelta: tier0RouteSelected ? 1 : null,
        topologyChanged: tier0RouteSelected
          ? false
          : (phaseCarrierOneToFourExecution ? true : null),
        hierarchyIdentityChanged: tier0RouteSelected
          ? false
          : (phaseCarrierOneToFourExecution ? false : null),
        exactParticleFamily: Boolean(finalParticleLineage)
      }),
      retainedBufferRefs: finalRetainedBufferRefs,
      supersededFamilyRetirement: tier0SupersededFamilyRetirement,
      authority: Object.freeze({
        workerTerminalFence: 'satisfied',
        computeManager: 'pending',
        stateManager: 'pending',
        presentation: 'pending'
      })
    });
    return {
      schema: ULG_WORKER_RESIDENT_SCHEDULE_RESULT_SCHEMA,
      status: cancelled
        ? 'worker-resident-schedule-cancelled'
        : 'worker-resident-schedule-completed',
      scheduleId,
      laneId,
      stateKey,
      requestedStepCount: stepCount,
      completedStepCount,
      cancelled,
      controlPlaneYieldReceipt,
      // Worker-clock phase stamps (see declaration): consecutive schedule
      // results on one lane share this clock, so the inter-schedule
      // turnaround is directly computable from them.
      scheduleFunctionEnteredAtMs,
      scheduleFirstStepStartedAtMs,
      scheduleLastStepEndedAtMs,
      tailTerminalFenceDoneAtMs,
      productHistoryLiveBoundObservation,
      lawActivationReceipt: scheduleLawActivation,
      predecessorTargetTokenConsumption,
      nextScheduleLawActivationObservation,
      executionRouteReceipt,
      phaseCarrierOneToFourTransition:
        phaseCarrierOneToFourTransitionReceipt,
      particleCardinality,
      submitBurstObservation: {
        ...resolveSubmitBurstEligibility(),
        opened: submitBurstCloseStats != null,
        stats: submitBurstCloseStats
      },
      submitCensus: submitCensus.size > 0
        ? Object.fromEntries(submitCensus)
        : null,
      resultAssembledAtMs: workerResidentScheduleNowMs(),
      progressEverySteps,
      queueDrainIntervalSteps:
        ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS,
      queueDrainCheckpointCount: queueDrainCheckpoints.length,
      queueDrainCheckpoints,
      retainedBufferRefs: finalRetainedBufferRefs,
      finalMechanicsLineage: finalParticleLineage
        ? { ...finalParticleLineage }
        : null,
      finalEpochIdentity: tier0RouteSelected
        ? { ...tier0ExpectedLineage }
        : workerResidentScheduleEpochIdentity(previousEpochSeal),
      finalEpochSeal: tier0RouteSelected ? null : previousEpochSeal,
      perStepSummaries: {
        schema: 'peercompute.ulg.worker-resident-schedule-step-summaries.v0',
        ringCapacity: ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_RING_CAPACITY,
        totalStepCount: completedStepCount,
        droppedStepCount: droppedStepSummaryCount,
        lastStep: terminalLastStepSummary,
        ring: stepSummaryRing,
        phaseVolumeSurfaceStress: {
          schema:
            'peercompute.ulg.worker-resident-schedule-surface-stress-evidence.v0',
          required: phaseVolumeSurfaceStressRequired,
          observedStepCount: phaseVolumeSurfaceStressObservedStepCount,
          expectedSubmissionCount:
            phaseVolumeSurfaceStressRequired ? completedStepCount : 0,
          exactSubmissionCount:
            phaseVolumeSurfaceStressExactSubmissionCount,
          submissionEvidenceComplete:
            phaseVolumeSurfaceStressSubmissionEvidenceComplete,
          firstIncompleteStepOrdinal:
            phaseVolumeSurfaceStressFirstIncompleteStepOrdinal,
          finalSubmissionStepOrdinal:
            phaseVolumeSurfaceStressFinalSubmissionStepOrdinal,
          finalSubmission: phaseVolumeSurfaceStressFinalSubmission
        },
        twoLevelMechanics: twoLevelMechanicsEvidence
      },
      gpuFence: terminalGpuFence
    };
  } finally {
    // The loop-level finally closes before terminal result/error assembly so
    // its receipt can prove cleanup. This outer idempotent close also covers
    // any future control-flow path inserted between allocation and that loop.
    scheduleControlPlaneTaskYielder?.close();
    scheduleControlPlaneTaskYielder = null;
    const terminalLane = retainedLanes.get(laneKey)?.schroederLane ?? null;
    if (terminalLane?.residentStepOptions) {
      delete terminalLane.residentStepOptions[
        SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_TARGET_OPTION
      ];
    }
    if (terminalRefluxRingBuffer) {
      try {
        if (terminalRefluxRingBuffer.mapState !== 'unmapped') {
          terminalRefluxRingBuffer.unmap?.();
        }
      } catch { /* continue to destroy the schedule-owned ring */ }
      try { terminalRefluxRingBuffer.destroy?.(); } catch {}
      terminalRefluxRingBuffer = null;
    }
    if (activeWorkerResidentScheduleByLaneKey.get(laneKey) === state) {
      activeWorkerResidentScheduleByLaneKey.delete(laneKey);
    }
    for (const cancelKey of cancelKeys) {
      if (activeWorkerResidentScheduleByCancelKey.get(cancelKey) === state) {
        activeWorkerResidentScheduleByCancelKey.delete(cancelKey);
      }
    }
  }
}

function workerPressureHasFollowingGridUpdate(data = null) {
  const stageOrder = data?.residentStagePlanStageOrder;
  if (!Array.isArray(stageOrder)) return false;
  const pressureIndex = stageOrder.indexOf('pressureInterface');
  const gridUpdateIndex = stageOrder.indexOf('gridUpdate');
  return pressureIndex >= 0 && gridUpdateIndex === pressureIndex + 1;
}

function workerPressureRetainedForceRowsHandoff(result = null) {
  const forceRowsBuffer = result?.forceRowsBuffer
    || result?.pressureInterfaceForceRowsBuffer
    || null;
  const forceRowCount = firstPositiveInteger([
    result?.forceRowCount,
    result?.pressureInterfaceForceSolver?.forceRowCount
  ]);
  const forceRowByteLength = firstPositiveInteger([
    result?.forceRowByteLength,
    result?.forceRowsBufferByteLength,
    result?.pressureInterfaceForceRowsBufferByteLength
  ]);
  let destroyDescriptor = null;
  try {
    destroyDescriptor = Object.getOwnPropertyDescriptor(
      result,
      'destroyForceRowsBuffer'
    );
  } catch {
    return false;
  }
  return Boolean(
    forceRowsBuffer
    && isGpuBufferLike(forceRowsBuffer)
    && forceRowCount > 0
    && forceRowByteLength > 0
    && destroyDescriptor
    && Object.hasOwn(destroyDescriptor, 'value')
    && typeof destroyDescriptor.value === 'function'
    && (
      result?.pressureInterfaceForceRowsBufferRetained === true
      || result?.pressureInterfaceForceRowsRetained === true
      || result?.pressureInterfaceForceSolver?.forceRowsBufferRetained === true
    )
  );
}

function workerPressureCompletionReceipt(result = null) {
  if (!result || typeof result !== 'object') return null;
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(
      result,
      'pressureCompletionReceipt'
    );
  } catch {
    return null;
  }
  return descriptor && Object.hasOwn(descriptor, 'value')
    ? descriptor.value
    : null;
}

function createWorkerExactPressureGridForceHandoff(
  result = null,
  device = null,
  {
    laneKey = null,
    laneId = null,
    stateKey = null
  } = {}
) {
  const forceRowsBuffer = result?.forceRowsBuffer
    || result?.pressureInterfaceForceRowsBuffer
    || null;
  const forceRowCount = firstPositiveInteger([
    result?.forceRowCount,
    result?.pressureInterfaceForceSolver?.forceRowCount
  ]);
  const forceRowByteLength = firstPositiveInteger([
    result?.forceRowByteLength,
    result?.forceRowsBufferByteLength,
    result?.pressureInterfaceForceRowsBufferByteLength
  ]);
  const sourceSolver = result?.pressureInterfaceForceSolver || null;
  const pressureCompletionReceipt =
    workerPressureCompletionReceipt(result);
  let destroyDescriptor = null;
  try {
    destroyDescriptor = Object.getOwnPropertyDescriptor(
      result,
      'destroyForceRowsBuffer'
    );
  } catch {
    return null;
  }
  const destroyForceRowsBuffer = destroyDescriptor
    && Object.hasOwn(destroyDescriptor, 'value')
    && typeof destroyDescriptor.value === 'function'
      ? destroyDescriptor.value
      : null;
  if (
    !device
    || !laneKey
    || !laneId
    || !stateKey
    || !pressureCompletionReceipt
    || !destroyForceRowsBuffer
    || !isGpuBufferLike(forceRowsBuffer)
    || forceRowCount <= 0
    || forceRowByteLength <= 0
    || sourceSolver?.status !== 'pressure-interface-force-solver-ready'
  ) return null;
  const publication = Object.freeze({
    schema:
      'peercompute.ulg.worker-exact-pressure-interface-grid-handoff.v1',
    status: 'worker-retained-pressure-interface-output-admitted',
    committed: true,
    sameDeviceQueueOrdered: true,
    laneId,
    stateKey,
    pressureInterfaceForceRowCount: forceRowCount,
    outputFamilies: Object.freeze(['pressure-interface-force-rows'])
  });
  const admission = Object.freeze({
    schema:
      'peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0',
    status: 'pressure-interface-grid-force-consumption-approved',
    gridForceApplicationApproved: true,
    committed: true,
    sameDeviceQueueOrdered: true,
    laneId,
    stateKey,
    pressureInterfaceForceRowCount: forceRowCount,
    outputFamilies: publication.outputFamilies,
    pressureInterfacePublication: publication
  });
  const solver = Object.freeze({
    ...sourceSolver,
    forceApplicationStatus:
      'pressure-interface-grid-force-consumer-approved',
    gridForceApplicationApproved: true,
    gridForceApplicationAdmission: admission
  });
  const handoff = {
    schema:
      'peercompute.ulg.worker-exact-pressure-interface-grid-handoff-owner.v1',
    status: 'ready',
    device,
    laneKey,
    laneId,
    stateKey,
    sourceResult: result,
    pressureCompletionReceipt,
    forceRowsBuffer,
    forceRowCount,
    forceRowByteLength,
    solver,
    admission,
    retirementCount: 0,
    retireAfterGridSubmit() {
      if (
        handoff.status !== 'borrowed-by-gridUpdate'
        || handoff.retirementCount !== 0
        || result.forceRowsBuffer !== forceRowsBuffer
      ) return false;
      destroyForceRowsBuffer();
      handoff.retirementCount = 1;
      handoff.status = 'retired-after-gridUpdate-submit';
      return true;
    }
  };
  return handoff;
}

function workerExactPressureGridUpdateHandoffReady(
  data = null,
  rawResult = null,
  workerDevice = null,
  { laneKey = null, laneId = null, stateKey = null } = {}
) {
  const handoff = exactPressureGridHandoffByStageData.get(data);
  const updatedGridBuffer = rawResult?.updatedGridBuffer
    || rawResult?.gpuResult?.updatedGridBuffer
    || null;
  const updatedGridBufferByteLength = firstPositiveInteger([
    rawResult?.updatedGridBufferByteLength,
    rawResult?.gpuResult?.updatedGridBufferByteLength
  ]);
  return Boolean(
    handoff
    && handoff.status === 'borrowed-by-gridUpdate'
    && handoff.device === workerDevice
    && handoff.laneKey === laneKey
    && handoff.laneId === laneId
    && handoff.stateKey === stateKey
    && data?.pressureInterfaceForceRowsBuffer === handoff.forceRowsBuffer
    && data?.pressureInterfaceForceSolver === handoff.solver
    && data?.pressureInterfaceGridForceAdmission === handoff.admission
    && rawResult?.backend === 'webgpu'
    && (
      rawResult?.pressureInterfaceForceRowsBufferSubmitted === true
      || rawResult?.gpuResult?.pressureInterfaceForceRowsBufferSubmitted === true
    )
    && firstPositiveInteger([
      rawResult?.pressureInterfaceForceRowCount
    ]) === handoff.forceRowCount
    && (
      rawResult?.queueCompletionStatus === 'queue-submitted-cleanup-deferred'
      || rawResult?.queueCompletionStatus === 'queue-submitted'
    )
    && isGpuBufferLike(updatedGridBuffer)
    && updatedGridBufferByteLength > 0
  );
}

function workerPressureUsesExactQueueOrderedGasAuthority(data = null, device = null) {
  if (
    data?.cpuSeededGasPressureAuthority
    && device
    && isExactSphCpuSeededGasPressureAuthorityGpu(
      data.cpuSeededGasPressureAuthority,
      device
    )
  ) return true;
  const retainedSource = data?.pressureInterfaceGasCellFieldImport
    ?.retainedGasCellFieldSource
    || data?.gasCellFieldImport?.retainedGasCellFieldSource
    || null;
  return Boolean(
    retainedSource
    && isExactSphSpatialGasPressureAuthoritySource(retainedSource)
  );
}

async function completeWorkerQueueFence({
  stageId,
  data,
  rawResult,
  workerDeviceResult,
  exactQueueOrderedGasPressureAuthorityExpected = false,
  finalConsumerReleasePromise = null,
  deferToResidentScheduleTerminal = false
}) {
  const shouldFence = data?.preferWebGpu === true
    && data?.readbackMode === NO_FULL_READBACK_MODE
    && rawResult?.backend === 'webgpu';
  const queue = workerDeviceResult?.device?.queue || data?.deviceResult?.device?.queue || null;
  const fenceSchema = rawResult?.gpuFence?.schema
    || rawResult?.gpuFenceReport?.schema
    || 'peercompute.compute.gpu-fence-report.v0';
  const applyFencePatch = (fencePatch) => {
    rawResult.queueCompletionStatus = fencePatch.queueCompletionStatus;
    rawResult.queueCompletionMethod = fencePatch.queueCompletionMethod;
    if (fencePatch.queueCompletionErrorName != null) {
      rawResult.queueCompletionErrorName = fencePatch.queueCompletionErrorName;
    }
    if (fencePatch.queueCompletionErrorMessage != null) {
      rawResult.queueCompletionErrorMessage = fencePatch.queueCompletionErrorMessage;
    }
    rawResult.gpuFence = {
      ...(rawResult.gpuFence || rawResult.gpuFenceReport || {}),
      ...fencePatch
    };
    rawResult.gpuFenceReport = {
      ...(rawResult.gpuFenceReport || rawResult.gpuFence || {}),
      ...fencePatch
    };
    for (const authorityKey of [
      'spatialGasLedgerProducerStageTaskAuthority',
      'gasCellEosProducerStageTaskAuthority',
      'pressureInterfaceStageTaskAuthority',
      'mechanicsP2gStageTaskAuthority',
      'mechanicsGridUpdateStageTaskAuthority',
      'mechanicsG2pStageTaskAuthority',
      'thermalPhaseStageTaskAuthority',
      'reactionProductStageTaskAuthority'
    ]) {
      if (!rawResult?.[authorityKey]
        || typeof rawResult[authorityKey] !== 'object') continue;
      rawResult[authorityKey] = {
        ...rawResult[authorityKey],
        gpuFenceSatisfied: fencePatch.fenceSatisfied === true,
        gpuFenceStatus: fencePatch.status || null,
        ...(fencePatch.pressureCompletionReceiptValidated === true
          ? {
              gpuFenceDelegationStatus:
                'satisfied-worker-exact-pressure-completion-receipt'
            }
          : {})
      };
    }
    return fencePatch;
  };
  if (
    (stageId === 'pressureInterface' || stageId === 'gasCellEosProducer')
    && typeof finalConsumerReleasePromise?.then === 'function'
  ) {
    try {
      const released = await finalConsumerReleasePromise;
      return applyFencePatch({
        schema: fenceSchema,
        required: rawResult?.gpuFence?.required === true || rawResult?.gpuFenceReport?.required === true,
        fenceSatisfied: released === true,
        status: released === true ? 'gpu-fence-satisfied' : 'gpu-fence-unsatisfied',
        reason: released === true
          ? `${stageId}-final-consumer-release-fence-satisfied`
          : `${stageId}-final-consumer-release-fence-unconfirmed`,
        queueCompletionStatus: released === true
          ? 'queue-work-completed-by-final-consumer-release'
          : 'queue-completion-unconfirmed-by-final-consumer-release',
        queueCompletionMethod: 'spatial-gas-ledger-eos-final-consumer-release-promise',
        finalConsumerReleaseFenceUsed: true,
        source: 'ulg-mechanics-resident-stage-worker'
      });
    } catch (error) {
      return applyFencePatch({
        schema: fenceSchema,
        required: rawResult?.gpuFence?.required === true || rawResult?.gpuFenceReport?.required === true,
        fenceSatisfied: false,
        status: 'gpu-fence-unsatisfied',
        reason: `${stageId}-final-consumer-release-fence-rejected`,
        queueCompletionStatus: 'queue-completion-error',
        queueCompletionMethod: 'spatial-gas-ledger-eos-final-consumer-release-promise',
        queueCompletionErrorName: error instanceof Error ? error.name : null,
        queueCompletionErrorMessage: error instanceof Error ? error.message : String(error),
        finalConsumerReleaseFenceUsed: true,
        source: 'ulg-mechanics-resident-stage-worker'
      });
    }
  }
  if (!shouldFence) return null;
  if (deferToResidentScheduleTerminal) {
    return applyFencePatch({
      schema: fenceSchema,
      required: true,
      fenceSatisfied: false,
      status: 'gpu-fence-deferred-to-resident-schedule-terminal',
      reason: `${stageId}-same-worker-resident-schedule-terminal-fence-deferred`,
      queueCompletionStatus:
        'queue-submitted-same-worker-resident-schedule-terminal-fence-deferred',
      queueCompletionMethod: 'same-worker-webgpu-queue-in-order',
      cpuQueueFenceBypassed: true,
      sameWorkerGpuHandoff: true,
      residentScheduleTerminalFenceDeferred: true,
      source: 'ulg-mechanics-resident-stage-worker'
    });
  }
  const workerDevice = workerDeviceResult?.device
    || data?.deviceResult?.device
    || null;
  const pressureCompletionReceipt = stageId === 'pressureInterface'
    ? workerPressureCompletionReceipt(rawResult)
    : null;
  const pressureRetainedForceRowsHandoff = stageId === 'pressureInterface'
    && workerPressureRetainedForceRowsHandoff(rawResult);
  const pressureFollowingGridUpdate = stageId === 'pressureInterface'
    && workerPressureHasFollowingGridUpdate(data);
  const pressureCompletionTransitionCandidate = Boolean(
    pressureCompletionReceipt
    && workerDevice
    && pressureRetainedForceRowsHandoff
    && pressureFollowingGridUpdate
  );
  if (
    stageId === 'pressureInterface'
    && exactQueueOrderedGasPressureAuthorityExpected
    && workerDevice
    && pressureRetainedForceRowsHandoff
    && pressureFollowingGridUpdate
    && !pressureCompletionReceipt
  ) {
    return applyFencePatch({
      schema: fenceSchema,
      required: rawResult?.gpuFence?.required === true
        || rawResult?.gpuFenceReport?.required === true,
      fenceSatisfied: false,
      status: 'gpu-fence-unsatisfied',
      reason:
        'pressureInterface-completion-receipt-missing-before-gridUpdate',
      queueCompletionStatus:
        'queue-completion-receipt-missing-fail-closed',
      queueCompletionMethod:
        'exact-pressure-completion-receipt-validation',
      pressureCompletionReceiptValidated: false,
      pressureCompletionReceiptRejected: true,
      retainedForceRowsHandoff: true,
      followingGridUpdatePlanned: true,
      queueOrderedGasPressureRetirement: false,
      cpuQueueFenceBypassed: false,
      sameWorkerGpuHandoff: false,
      source: 'ulg-mechanics-resident-stage-worker'
    });
  }
  if (pressureCompletionTransitionCandidate) {
    const pressureCompletionReceiptValidated =
      isExactSphPressureInterfaceCompletionReceipt(
      pressureCompletionReceipt,
      workerDevice,
      rawResult
      );
    if (pressureCompletionReceiptValidated) {
      return applyFencePatch({
        schema: fenceSchema,
        required: rawResult?.gpuFence?.required === true
          || rawResult?.gpuFenceReport?.required === true,
        fenceSatisfied: true,
        status: 'gpu-fence-satisfied',
        reason:
          'pressureInterface-exact-completion-receipt-ordered-before-following-gridUpdate',
        queueCompletionStatus:
          'queue-submitted-same-worker-grid-update-handoff-no-host-wait',
        queueCompletionMethod:
          'exact-pressure-completion-receipt+same-worker-webgpu-queue-in-order',
        pressureCompletionReceiptValidated: true,
        retainedForceRowsHandoff: true,
        followingGridUpdatePlanned: true,
        queueOrderedGasPressureRetirement: true,
        cpuQueueFenceBypassed: true,
        sameWorkerGpuHandoff: true,
        source: 'ulg-mechanics-resident-stage-worker'
      });
    }
    return applyFencePatch({
      schema: fenceSchema,
      required: rawResult?.gpuFence?.required === true
        || rawResult?.gpuFenceReport?.required === true,
      fenceSatisfied: false,
      status: 'gpu-fence-unsatisfied',
      reason:
        'pressureInterface-completion-receipt-rejected-before-gridUpdate',
      queueCompletionStatus:
        'queue-completion-receipt-rejected-fail-closed',
      queueCompletionMethod:
        'exact-pressure-completion-receipt-validation',
      pressureCompletionReceiptValidated: false,
      pressureCompletionReceiptRejected: true,
      retainedForceRowsHandoff: true,
      followingGridUpdatePlanned: true,
      queueOrderedGasPressureRetirement: false,
      cpuQueueFenceBypassed: false,
      sameWorkerGpuHandoff: false,
      source: 'ulg-mechanics-resident-stage-worker'
    });
  }
  const exactPressureGridHandoff = stageId === 'gridUpdate'
    ? exactPressureGridHandoffByStageData.get(data)
    : null;
  if (exactPressureGridHandoff) {
    const laneId = normalizeString(
      data?.gpuResidentLane?.laneId
        ?? data?.gpuFenceRequirement?.laneId,
      null
    );
    const stateKey = normalizeString(
      data?.gpuResidentLane?.stateKey
        ?? data?.gpuFenceRequirement?.stateKey,
      null
    );
    const laneKey = laneKeyForParts({ laneId, stateKey });
    if (workerExactPressureGridUpdateHandoffReady(
      data,
      rawResult,
      workerDevice,
      { laneKey, laneId, stateKey }
    )) {
      let forceRowsRetired = false;
      let retirementError = null;
      try {
        forceRowsRetired =
          exactPressureGridHandoff.retireAfterGridSubmit() === true;
      } catch (error) {
        retirementError = error;
        exactPressureGridHandoff.status =
          'quarantined-after-gridUpdate-submit-retirement-error';
      }
      exactPressureGridHandoffByStageData.delete(data);
      if (forceRowsRetired) {
        return applyFencePatch({
          schema: fenceSchema,
          required: rawResult?.gpuFence?.required === true
            || rawResult?.gpuFenceReport?.required === true,
          fenceSatisfied: true,
          status: 'gpu-fence-satisfied',
          reason:
            'gridUpdate-consumed-exact-worker-pressure-force-rows-no-host-wait',
          queueCompletionStatus:
            'queue-submitted-worker-retained-grid-no-host-wait',
          queueCompletionMethod:
            'exact-worker-pressure-grid-handoff+same-worker-webgpu-queue-in-order',
          pressureInterfaceForceRowsRetiredAfterGridSubmit: true,
          cpuQueueFenceBypassed: true,
          sameWorkerGpuHandoff: true,
          source: 'ulg-mechanics-resident-stage-worker'
        });
      }
      return applyFencePatch({
        schema: fenceSchema,
        required: rawResult?.gpuFence?.required === true
          || rawResult?.gpuFenceReport?.required === true,
        fenceSatisfied: false,
        status: 'gpu-fence-unsatisfied',
        reason:
          'gridUpdate-exact-pressure-force-row-retirement-failed',
        queueCompletionStatus:
          'queue-submitted-pressure-force-row-retirement-quarantined',
        queueCompletionMethod:
          'exact-worker-pressure-grid-handoff-retirement',
        queueCompletionErrorName:
          retirementError instanceof Error ? retirementError.name : null,
        queueCompletionErrorMessage:
          retirementError instanceof Error
            ? retirementError.message
            : (retirementError ? String(retirementError) : null),
        pressureInterfaceForceRowsRetiredAfterGridSubmit: false,
        cpuQueueFenceBypassed: false,
        sameWorkerGpuHandoff: false,
        source: 'ulg-mechanics-resident-stage-worker'
      });
    }
    exactPressureGridHandoff.status = 'ready';
    exactPressureGridHandoffByStageData.delete(data);
    return applyFencePatch({
      schema: fenceSchema,
      required: rawResult?.gpuFence?.required === true
        || rawResult?.gpuFenceReport?.required === true,
      fenceSatisfied: false,
      status: 'gpu-fence-unsatisfied',
      reason: 'gridUpdate-exact-pressure-grid-handoff-rejected',
      queueCompletionStatus:
        'queue-completion-pressure-grid-handoff-rejected-fail-closed',
      queueCompletionMethod:
        'exact-worker-pressure-grid-handoff-validation',
      pressureInterfaceForceRowsRetiredAfterGridSubmit: false,
      cpuQueueFenceBypassed: false,
      sameWorkerGpuHandoff: false,
      source: 'ulg-mechanics-resident-stage-worker'
    });
  }
  if (stageId === 'spatialGasLedgerProducer' || stageId === 'gasCellEosProducer') {
    return applyFencePatch({
      schema: fenceSchema,
      required: rawResult?.gpuFence?.required === true || rawResult?.gpuFenceReport?.required === true,
      fenceSatisfied: true,
      status: 'gpu-fence-satisfied',
      reason: `${stageId}-same-worker-final-consumer-fence-deferred`,
      queueCompletionStatus: 'queue-submitted-same-worker-final-consumer-fence-deferred',
      queueCompletionMethod: 'same-worker-webgpu-queue-in-order',
      cpuQueueFenceBypassed: true,
      finalConsumerFenceDeferred: true,
      sameWorkerGpuHandoff: true,
      source: 'ulg-mechanics-resident-stage-worker'
    });
  }
  if (typeof queue?.onSubmittedWorkDone !== 'function') {
    return applyFencePatch({
      schema: fenceSchema,
      required: rawResult?.gpuFence?.required === true || rawResult?.gpuFenceReport?.required === true,
      status: 'worker-queue-fence-unavailable',
      fenceSatisfied: false,
      reason: 'worker-webgpu-device-queue-missing',
      queueCompletionStatus: 'queue-completion-unavailable',
      queueCompletionMethod: null,
      source: 'ulg-mechanics-resident-stage-worker'
    });
  }
  try {
    await queue.onSubmittedWorkDone();
  } catch (error) {
    const sentinelFence = await completeWorkerQueueFenceWithSentinelReadback({
      device: workerDeviceResult?.device || data?.deviceResult?.device || null,
      stageId,
      fenceSchema,
      originalError: error
    });
    if (sentinelFence?.fenceSatisfied === true) {
      return applyFencePatch(sentinelFence);
    }
    if (sameWorkerQueueFenceFallbackAllowed({ data, rawResult, workerDeviceResult, stageId })) {
      return applyFencePatch({
        schema: fenceSchema,
        required: rawResult?.gpuFence?.required === true || rawResult?.gpuFenceReport?.required === true,
        fenceSatisfied: true,
        status: 'gpu-fence-satisfied',
        reason: `${stageId}-same-worker-queue-ordering-evidenced`,
        queueCompletionStatus: 'queue-submitted-same-worker-gpu-handoff-no-cpu-fence',
        queueCompletionMethod: 'same-worker-webgpu-queue-in-order',
        queueCompletionFallbackFrom: 'worker-device.queue.onSubmittedWorkDone',
        queueCompletionFallbackStatus: sentinelFence?.queueCompletionFallbackStatus || null,
        queueCompletionFallbackErrorName: sentinelFence?.queueCompletionFallbackErrorName || null,
        queueCompletionFallbackErrorMessage: sentinelFence?.queueCompletionFallbackErrorMessage || null,
        queueCompletionOriginalErrorName: error instanceof Error ? error.name : null,
        queueCompletionOriginalErrorMessage: error instanceof Error ? error.message : String(error),
        cpuQueueFenceBypassed: true,
        sameWorkerGpuHandoff: true,
        source: 'ulg-mechanics-resident-stage-worker'
      });
    }
    const fencePatch = {
      schema: fenceSchema,
      required: rawResult?.gpuFence?.required === true || rawResult?.gpuFenceReport?.required === true,
      fenceSatisfied: false,
      status: 'gpu-fence-unsatisfied',
      reason: `${stageId}-worker-queue-completion-error`,
      queueCompletionStatus: 'queue-completion-error',
      queueCompletionMethod: 'worker-device.queue.onSubmittedWorkDone',
      queueCompletionErrorName: error instanceof Error ? error.name : null,
      queueCompletionErrorMessage: error instanceof Error ? error.message : String(error),
      queueCompletionFallbackStatus: sentinelFence?.queueCompletionFallbackStatus || null,
      queueCompletionFallbackErrorName: sentinelFence?.queueCompletionFallbackErrorName || null,
      queueCompletionFallbackErrorMessage: sentinelFence?.queueCompletionFallbackErrorMessage || null,
      source: 'ulg-mechanics-resident-stage-worker'
    };
    return applyFencePatch(fencePatch);
  }
  const fencePatch = {
    schema: fenceSchema,
    required: rawResult?.gpuFence?.required === true || rawResult?.gpuFenceReport?.required === true,
    fenceSatisfied: true,
    status: 'gpu-fence-satisfied',
    reason: `${stageId}-worker-queue-completion-evidenced`,
    queueCompletionStatus: 'queue-work-completed',
    queueCompletionMethod: 'worker-device.queue.onSubmittedWorkDone',
    source: 'ulg-mechanics-resident-stage-worker'
  };
  return applyFencePatch(fencePatch);
}

async function completeWorkerQueueFenceWithSentinelReadback({
  device,
  stageId,
  fenceSchema,
  originalError
} = {}) {
  if (
    !device?.createBuffer
    || !device?.createCommandEncoder
    || typeof device?.queue?.submit !== 'function'
  ) {
    return {
      fenceSatisfied: false,
      queueCompletionFallbackStatus: 'sentinel-readback-unavailable',
      queueCompletionFallbackErrorName: null,
      queueCompletionFallbackErrorMessage: 'worker WebGPU device cannot create a sentinel queue fence'
    };
  }
  let sourceBuffer = null;
  let readbackBuffer = null;
  try {
    sourceBuffer = device.createBuffer({
      label: 'ulg-worker-queue-fence-sentinel-source',
      size: 4,
      usage: GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    });
    device.queue.writeBuffer(sourceBuffer, 0, new Uint32Array([0x756c6701]));
    readbackBuffer = device.createBuffer({
      label: 'ulg-worker-queue-fence-sentinel-readback',
      size: 4,
      usage: GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.MAP_READ
    });
    const encoder = device.createCommandEncoder({
      label: 'ulg-worker-queue-fence-sentinel'
    });
    encoder.copyBufferToBuffer(sourceBuffer, 0, readbackBuffer, 0, 4);
    device.queue.submit([encoder.finish()]);
    await readbackBuffer.mapAsync(GPU_MAP_MODE.READ);
    readbackBuffer.getMappedRange();
    readbackBuffer.unmap();
    return {
      schema: fenceSchema,
      required: true,
      fenceSatisfied: true,
      status: 'gpu-fence-satisfied',
      reason: `${stageId}-worker-queue-completion-sentinel-readback-evidenced`,
      queueCompletionStatus: 'sentinel-readback-map-completed',
      queueCompletionMethod: 'mapAsync(worker-queue-fence-sentinel)',
      queueCompletionFallbackFrom: 'worker-device.queue.onSubmittedWorkDone',
      queueCompletionFallbackErrorName: originalError instanceof Error ? originalError.name : null,
      queueCompletionFallbackErrorMessage: originalError instanceof Error ? originalError.message : String(originalError),
      source: 'ulg-mechanics-resident-stage-worker'
    };
  } catch (error) {
    return {
      fenceSatisfied: false,
      queueCompletionFallbackStatus: 'sentinel-readback-error',
      queueCompletionFallbackErrorName: error instanceof Error ? error.name : null,
      queueCompletionFallbackErrorMessage: error instanceof Error ? error.message : String(error)
    };
  } finally {
    try {
      sourceBuffer?.destroy?.();
    } catch {}
    try {
      readbackBuffer?.destroy?.();
    } catch {}
  }
}

function baseStageData(payload = {}) {
  const context = workerContext(payload);
  const common = context.common || {};
  const stageId = normalizeString(payload.stage?.id, null);
  const stageSpecificOptions = context.stageOptions?.[stageId] || {};
  const stageOptionSnapshot = { ...common, ...stageSpecificOptions };
  const laneId = normalizeString(payload.lease?.laneId ?? payload.lane?.laneId, null);
  const stateKey = normalizeString(payload.lease?.stateKey ?? payload.lane?.stateKey, null);
  const domainKey = normalizeString(payload.lease?.domainKey ?? payload.lane?.domainKey, null);
  const pressureImportValue = stageId === 'pressureInterface'
    ? stageOptionSnapshot.pressureInterfaceGasCellFieldImport
      || stageOptionSnapshot.gasCellFieldImport
      || null
    : null;
  const pressureImportGraphCapture = pressureImportValue
    && typeof pressureImportValue === 'object'
    ? exactGasPressureTransportGraphCapture(pressureImportValue)
    : null;
  const localGasCellFieldReady = stageId === 'pressureInterface'
    ? pressureInterfaceLocalGasCellFieldReadyFromOptions(
        stageOptionSnapshot,
        pressureImportGraphCapture
      )
    : false;
  const directOpaqueCpuSeededGasPressureHandoff = Boolean(
    stageId === 'gasCellEosProducer'
    && (context.preferWebGpu === true || common.preferWebGpu === true)
    && (context.readbackMode || common.readbackMode)
      === NO_FULL_READBACK_MODE
  );
  const retainedBufferRefs = stageId === SCHROEDER_LANE_SEED_STAGE_ID
    ? ['schroeder-lane-seed-level-assignment-buffer']
    : stageId === SCHROEDER_SPATIAL_EPOCH_STAGE_ID
    ? ['schroeder-spatial-epoch-directory-buffer']
    : stageId === SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID
    ? ['sph-state-buffer', 'sph-thermo-buffer', 'mls-mpm-mechanics-buffer']
    : stageId === 'p2g'
    ? ['mls-mpm-p2g-grid-buffer']
    : (stageId === 'gridUpdate'
      ? ['mls-mpm-grid-update-buffer']
      : (stageId === 'pressureInterface'
        ? [
            'pressure-interface-force-rows-buffer',
            ...(pressureInterfaceSourceKeyBufferReadyFromOptions(stageOptionSnapshot)
              ? ['sph-interface-source-key-buffer']
              : []),
            ...(localGasCellFieldReady
              ? ['resident-gas-pressure-cells-buffer']
              : [])
          ]
        : (stageId === 'thermalPhase'
          ? ['sph-state-buffer', 'sph-thermo-buffer']
          : (stageId === 'reactionProduct'
            ? ['sph-state-buffer', 'sph-thermo-buffer', 'mls-mpm-mechanics-buffer', 'resident-product-mass-buffer']
            : (stageId === 'spatialGasLedgerProducer'
              ? ['resident-spatial-gas-species-ledger-buffer']
            : (stageId === 'gasCellEosProducer'
              ? (directOpaqueCpuSeededGasPressureHandoff
                  ? []
                  : ['resident-gas-pressure-cells-buffer'])
              : ['sph-state-buffer', 'mls-mpm-mechanics-buffer']))))));
  const data = {
    ...common,
    ...stageSpecificOptions,
    preferWebGpu: context.preferWebGpu === true || common.preferWebGpu === true,
    readbackMode: context.readbackMode || common.readbackMode || 'full-parity-readback',
    useWorkerRetainedG2pInput: context.useWorkerRetainedG2pInput === true
      || context.useRetainedG2pAsInput === true
      || common.useWorkerRetainedG2pInput === true,
    captureRetainedCompactSnapshotExportSources:
      context.captureRetainedCompactSnapshotExportSources === true
      || context.retainedCompactSnapshotExportRequested === true
      || common.captureRetainedCompactSnapshotExportSources === true
      || common.retainedCompactSnapshotExportRequested === true,
    residentStagePlanStageOrder: Array.isArray(
      context.residentStagePlanStageOrder
    )
      ? [...context.residentStagePlanStageOrder]
      : [],
    computeTaskId: `${context.taskIdPrefix || 'ulg-worker:mechanics-stage'}:${stageId}`,
    lawGraphNode: {
      schema: 'peercompute.ulg.law-graph-node-task-ref.v0',
      nodeId: payload.stage?.lawNodeId || `ulg-mls-mpm-mechanics-${stageId}-stage`,
      solverId: `ulg-mls-mpm-mechanics-${stageId}-stage`,
      runtimeTarget: 'gpu-hub-resident-stage-worker',
      readFamilies: [...(payload.stage?.reads || [])],
      writeFamilies: [...(payload.stage?.writes || [])]
    },
    expectedOutputFamilies: [...(payload.stage?.writes || [])],
    gpuFenceRequirement: laneId && stateKey
      ? {
          schema: 'peercompute.compute.gpu-fence-requirement.v0',
          required: true,
          laneId,
          stateKey,
          queueFencePolicy: payload.lease?.queueFencePolicy || 'queue.onSubmittedWorkDone-before-admission',
          retainedBufferRefs,
          source: 'ulg-mechanics-resident-stage-worker'
        }
      : null,
    gpuResidentLane: laneId && stateKey
      ? {
          schema: 'peercompute.compute.gpu-resident-lane-task.v0',
          enabled: true,
          localExecution: 'worker',
          laneId,
          stateKey,
          domainKey,
          solverId: 'ulg-mls-mpm-mechanics-stage-worker',
          owner: 'ulg-mls-mpm-mechanics-law',
          retainedBufferRefs
        }
      : null
  };
  if (pressureImportGraphCapture) {
    exactGasPressureTransportGraphByStageData.set(
      data,
      pressureImportGraphCapture
    );
  }
  return data;
}

function stageDataForPayload(payload = {}, record) {
  const stageId = normalizeString(payload.stage?.id, null);
  const data = baseStageData(payload);
  if (
    stageId === SCHROEDER_LANE_SEED_STAGE_ID
    || stageId === SCHROEDER_SPATIAL_EPOCH_STAGE_ID
    || stageId === SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID
  ) {
    // The SS worker-lane stage runners retain their epoch generation and
    // post-step buffers on the lane record; hand it to them the same way the
    // exact gas transport graph rides its stage data.
    workerSchroederLaneRecordByStageData.set(data, record);
  }
  if (stageId === 'spatialGasLedgerProducer') {
    const previousResidentProductMass = previousWorkerResidentProductMass(record);
    if (previousResidentProductMass) {
      data.residentProductMass = previousResidentProductMass;
      data.productEventBuffer = previousResidentProductMass.productEventBuffer;
      data.productEventRowCount = previousResidentProductMass.productEventRowCount;
      data.productEventStrideFloats = previousResidentProductMass.productEventStrideFloats;
      data.workerResidentProductMassContinuity = {
        schema: 'peercompute.ulg.worker-resident-product-mass-continuity.v0',
        status: 'previous-reaction-product-resident-mass-reused',
        sourceStage: 'reactionProduct',
        productEventRowCount: previousResidentProductMass.productEventRowCount,
        productEventBufferRetained: true
      };
    }
  }
  if (stageId === 'gridUpdate') {
    data.p2gGridProjection = record.stageResults.p2g || payload.input;
    const pressureInterfaceOutput = record.stageResults.pressureInterface || null;
    const exactHandoff = record.pressureInterfaceGridForceHandoff;
    const laneId = normalizeString(
      payload.lease?.laneId ?? payload.lane?.laneId,
      null
    );
    const stateKey = normalizeString(
      payload.lease?.stateKey ?? payload.lane?.stateKey,
      null
    );
    const suppliedDevice = data.deviceResult?.device || data.device || null;
    const exactHandoffReady = Boolean(
      exactHandoff?.status === 'ready'
      && exactHandoff.laneKey === record.key
      && exactHandoff.laneId === laneId
      && exactHandoff.stateKey === stateKey
      && exactHandoff.device === record.workerDevice
      && (!suppliedDevice || suppliedDevice === exactHandoff.device)
      && exactHandoff.sourceResult === pressureInterfaceOutput
      && workerPressureHasFollowingGridUpdate(data)
    );
    if (exactHandoffReady) {
      exactHandoff.status = 'borrowed-by-gridUpdate';
      data.pressureInterfaceForceRowsBuffer = exactHandoff.forceRowsBuffer;
      data.pressureInterfaceForceSolver = exactHandoff.solver;
      data.pressureInterfaceGridForceAdmission = exactHandoff.admission;
      Object.defineProperty(data, 'workerExactPressureGridHandoffRequired', {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
      });
      exactPressureGridHandoffByStageData.set(data, exactHandoff);
    } else {
      const suppliedPublication = data.pressureInterfaceGridForceAdmission
        ?.pressureInterfacePublication;
      if (suppliedPublication?.schema
        === 'peercompute.ulg.worker-exact-pressure-interface-grid-handoff.v1') {
        data.pressureInterfaceGridForceAdmission = null;
        data.pressureInterfaceForceRowsBuffer = null;
      }
      if (pressureInterfaceOutput?.forceRowsBuffer) {
        data.pressureInterfaceForceRowsBuffer =
          pressureInterfaceOutput.forceRowsBuffer;
      }
      if (!data.pressureInterfaceForceSolver
        && pressureInterfaceOutput?.pressureInterfaceForceSolver) {
        data.pressureInterfaceForceSolver =
          pressureInterfaceOutput.pressureInterfaceForceSolver;
      }
    }
  }
  if (stageId === 'pressureInterface') {
    const cpuSeededGasPressureAuthority =
      workerCpuSeededGasPressureAuthority(record);
    if (cpuSeededGasPressureAuthority) {
      data.cpuSeededGasPressureAuthority = cpuSeededGasPressureAuthority;
      data.gasCellEosProducerResult =
        record.stageResults.gasCellEosProducer;
    }
    const gasCellField = gasCellEosProducerGasCellField(record);
    if (gasCellField?.localPressureGradientReady) {
      data.gasPressureSummary = pressureSummaryWithGasCellEosProducer(record, data.gasPressureSummary || data.pressureSummary || null);
      data.pressureFeedback = pressureFeedbackWithGasCellEosProducer(record, data.pressureFeedback || null);
    }
    const retainedPressureImport = retainedGasCellEosProducerPressureImport(record);
    if (retainedPressureImport) {
      data.gasCellEosProducerResult = record.stageResults.gasCellEosProducer;
      data.pressureInterfaceGasCellFieldImport = retainedPressureImport;
      data.gasCellFieldImport = retainedPressureImport;
      data.pressureInterfaceGasCellFieldAdmission =
        retainedPressureImport.pressureInterfaceGasCellFieldAdmission;
    }
  }
  if (stageId === 'gasCellEosProducer') {
    const spatialGasLedgerProducerResult =
      record.stageResults.spatialGasLedgerProducer || null;
    const spatialLedger = spatialGasLedgerProducerResult?.spatialGasSpeciesLedger || null;
    data.spatialGasLedgerProducerResult = spatialGasLedgerProducerResult;
    data.retainedSpatialGasLedgerSource =
      spatialGasLedgerProducerResult?.retainedSpatialGasLedgerSource || null;
    if (spatialLedger?.status === 'spatial-gas-species-ledger-ready') {
      data.spatialGasSpeciesLedger = spatialLedger;
      const baseSummary = data.gasPressureSummary || data.pressureSummary || {};
      data.gasPressureSummary = {
        ...baseSummary,
        schema: baseSummary.schema || 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
        status: baseSummary.status || 'worker-spatial-gas-ledger-producer-pressure-summary-local',
        source: baseSummary.source || 'worker-spatial-gas-ledger-producer-stage',
        spatialGasSpeciesLedger: spatialLedger
      };
      data.pressureSummary = data.pressureSummary
        ? { ...data.pressureSummary, spatialGasSpeciesLedger: spatialLedger }
        : data.gasPressureSummary;
    }
  }
  if (stageId === 'g2p') {
    data.gridUpdate = record.stageResults.gridUpdate || payload.input;
  }
  if (stageId === 'thermalPhase') {
    const g2pOutput = retainedG2pOutput(record);
    const retainedThermoBuffer = record.retainedThermoBuffer || data?.sourceThermoBuffer || data?.sphParticleUpload?.thermoBuffer || null;
    data.sourceStateBuffer = data.sourceStateBuffer || g2pOutput?.stateBuffer || data?.sphParticleUpload?.stateBuffer || null;
    data.sourceThermoBuffer = retainedThermoBuffer;
    if (data.sourceStateBuffer || retainedThermoBuffer) {
      data.sphParticleUpload = {
        ...(data.sphParticleUpload || {}),
        schema: data.sphParticleUpload?.schema || 'peercompute.ulg.worker-retained-sph-particle-upload.v0',
        status: 'webgpu-uploaded',
        workerRetained: true,
        sourceStage: data.sourceStateBuffer === g2pOutput?.stateBuffer ? 'g2p' : (data.sphParticleUpload?.sourceStage || 'thermal-phase-input'),
        stateBuffer: data.sourceStateBuffer || data.sphParticleUpload?.stateBuffer || null,
        thermoBuffer: retainedThermoBuffer || data.sphParticleUpload?.thermoBuffer || null
      };
    }
  }
  if (stageId === 'reactionProduct') {
    const g2pOutput = retainedG2pOutput(record);
    const thermalOutput = retainedThermalOutput(record);
    const retainedThermoBuffer = thermalOutput?.thermoBuffer
      || record.retainedThermoBuffer
      || data?.sourceThermoBuffer
      || data?.sphParticleUpload?.thermoBuffer
      || null;
    data.sourceStateBuffer = data.sourceStateBuffer
      || thermalOutput?.stateBuffer
      || g2pOutput?.stateBuffer
      || data?.sphParticleUpload?.stateBuffer
      || null;
    data.sourceThermoBuffer = retainedThermoBuffer;
    data.sourceMechanicsBuffer = data.sourceMechanicsBuffer
      || g2pOutput?.mechanicsBuffer
      || data?.mlsMpmParticleUpload?.mechanicsBuffer
      || null;
    if (data.reactionStepOptions && typeof data.reactionStepOptions === 'object') {
      Object.assign(data, data.reactionStepOptions);
    }
    if (data.sourceStateBuffer || retainedThermoBuffer) {
      data.sphParticleUpload = {
        ...(data.sphParticleUpload || {}),
        schema: data.sphParticleUpload?.schema || 'peercompute.ulg.worker-retained-sph-particle-upload.v0',
        status: 'webgpu-uploaded',
        workerRetained: true,
        sourceStage: thermalOutput?.stateBuffer ? 'thermalPhase' : (data.sphParticleUpload?.sourceStage || 'g2p'),
        stateBuffer: data.sourceStateBuffer || data.sphParticleUpload?.stateBuffer || null,
        thermoBuffer: retainedThermoBuffer || data.sphParticleUpload?.thermoBuffer || null
      };
    }
    if (data.sourceMechanicsBuffer) {
      data.mlsMpmParticleUpload = {
        ...(data.mlsMpmParticleUpload || {}),
        schema: data.mlsMpmParticleUpload?.schema || 'peercompute.ulg.worker-retained-mls-mpm-particle-upload.v0',
        status: 'webgpu-uploaded',
        workerRetained: true,
        sourceStage: 'g2p',
        mechanicsBuffer: data.sourceMechanicsBuffer
      };
    }
  }
  return data;
}

function workerPressureConsumedRetainedGasRows(result = null) {
  const retainedRowsStatus = result?.retainedGasPressureRowsStatus
    || result?.pressureInterfaceForceSolver?.retainedGasPressureRowsStatus
    || null;
  const cpuSeededAuthorityConsumed = retainedRowsStatus
    === 'cpu-seeded-gas-pressure-authority-admitted-exact-source';
  return Boolean(
    result?.backend === 'webgpu'
    && result?.status === 'pressure-interface-stage-solver-ready'
    && (
      result?.pressureInterfaceGasCellFieldImportReady === true
      || cpuSeededAuthorityConsumed
    )
    && (
      retainedRowsStatus === 'retained-gas-pressure-rows-admitted-same-device'
      || retainedRowsStatus
        === 'retained-gas-pressure-authority-v4-admitted-exact-source'
      || cpuSeededAuthorityConsumed
    )
  );
}

function scheduleWorkerGasCellEosFinalConsumerRelease({
  record,
  pressureInterfaceGasCellFieldImport = null,
  gasCellEosProducerResult = null,
  retainedGasPressureRowsConsumed = false,
  pressureStageStatus = 'completed'
} = {}) {
  const release = scheduleSphGasCellEosFinalConsumerRelease({
    pressureInterfaceGasCellFieldImport,
    gasCellEosProducerResult:
      gasCellEosProducerResult || record?.stageResults?.gasCellEosProducer || null,
    spatialGasLedgerProducerResult:
      record?.stageResults?.spatialGasLedgerProducer || null,
    device: record?.workerDevice || null,
    retainedGasPressureRowsConsumed,
    pressureStageStatus
  });
  return {
    ...release,
    releasePromise: typeof release.releasePromise?.then === 'function'
      ? Promise.resolve(release.releasePromise).catch(() => false)
      : null
  };
}

async function finalizeWorkerGasCellEosOwner(payload = {}) {
  const record = getLaneRecord(payload);
  const context = workerContext(payload);
  const pressureStageStatus = normalizeString(
    context.gasCellEosFinalConsumerPressureStageStatus,
    'not-run'
  );
  const release = scheduleWorkerGasCellEosFinalConsumerRelease({
    record,
    pressureStageStatus
  });
  let releaseConfirmed = null;
  if (typeof release.releasePromise?.then === 'function') {
    releaseConfirmed = await release.releasePromise;
  } else if (
    release.scheduled === true
    && (
      release.cleanupMode === 'exact-unconsumed-authority-discard'
      || release.cleanupMode
        === 'same-queue-pressure-final-consumer-retirement'
    )
  ) {
    releaseConfirmed = true;
  }
  const value = {
    schema: 'peercompute.ulg.worker-gas-cell-eos-finalizer.v0',
    status: release.status,
    stageId: GAS_CELL_EOS_FINALIZER_STAGE_ID,
    releaseScheduled: release.scheduled === true,
    releaseSource: release.source,
    releaseError: release.error,
    releaseAlreadyScheduled: release.alreadyScheduled === true,
    releaseConfirmed,
    cleanupMode: release.cleanupMode || null,
    deferredCleanupReadbackTelemetry:
      release.deferredCleanupReadbackTelemetry || null
  };
  return {
    value,
    retainedBufferRefs: [],
    gpuFence: {
      schema: 'peercompute.compute.gpu-fence-report.v0',
      required: true,
      fenceSatisfied: releaseConfirmed === true,
      status: releaseConfirmed === true
        ? 'gpu-fence-satisfied'
        : 'gpu-fence-unsatisfied',
      reason: releaseConfirmed === true
        ? 'worker-gas-cell-eos-finalizer-release-confirmed'
        : release.status
    },
    summary: value
  };
}

export async function runUlgMechanicsResidentStageWorkerPayload(
  payload = {},
  scheduleFenceDeferralToken = null
) {
  const stageId = normalizeString(payload.stage?.id, null);
  const residentScheduleFenceDeferralAuthorized =
    scheduleFenceDeferralToken
      === WORKER_RESIDENT_SCHEDULE_FENCE_DEFERRAL_TOKEN;
  const callLaneKey = laneKeyFor(payload);
  const activeSchedule = activeWorkerResidentScheduleByLaneKey.get(callLaneKey);
  if (activeSchedule && !residentScheduleFenceDeferralAuthorized) {
    const error = new Error(
      `Worker resident lane ${callLaneKey} is owned by active schedule ${activeSchedule.scheduleId}`
    );
    error.code = 'ERR_ULG_WORKER_RESIDENT_SCHEDULE_LANE_BUSY';
    throw error;
  }
  if (
    residentScheduleFenceDeferralAuthorized
    && (
      !activeSchedule
      || activeSchedule.laneKey !== callLaneKey
      || !WORKER_RESIDENT_SCHEDULE_PRIVATE_RETURN_STAGE_IDS.has(stageId)
    )
  ) {
    throw workerResidentScheduleError(
      'schedule-private-stage-authority-invalid',
      `${stageId || 'unknown-stage'} is not an active canonical schedule stage`,
      {
        scheduleId: activeSchedule?.scheduleId ?? null,
        stageId
      }
    );
  }
  const existingRecord = retainedLanes.get(callLaneKey) || null;
  if (existingRecord?.residentSchedulePoison) {
    const error = new Error(
      `Worker resident lane ${callLaneKey} is poisoned: ${existingRecord.residentSchedulePoison.reason}`
    );
    error.code = 'ERR_ULG_WORKER_RESIDENT_SCHEDULE_LANE_POISONED';
    error.residentSchedulePoison = existingRecord.residentSchedulePoison;
    throw error;
  }
  if (stageId === GAS_CELL_EOS_FINALIZER_STAGE_ID) {
    return finalizeWorkerGasCellEosOwner(payload);
  }
  const runner = STAGE_RUNNERS[stageId];
  if (typeof runner !== 'function') {
    throw new Error(`Unsupported ULG mechanics resident worker stage: ${stageId || 'missing-stage'}`);
  }
  const record = getLaneRecord(payload);
  const data = stageDataForPayload(payload, record);
  if (residentScheduleFenceDeferralAuthorized) {
    workerResidentScheduleFenceDeferredStageData.add(data);
  }
  const workerDeviceResult = await getWorkerDeviceResult(data.preferWebGpu === true, data);
  if (workerDeviceResult) {
    data.deviceResult = workerDeviceResult;
    data.navigatorRef = globalThis.navigator;
    record.workerDevice = workerDeviceResult.device || null;
    if (record.workerDevice?.queue?.submit) {
      // Arm the submit-burst wrappers the moment the worker device exists,
      // BEFORE any lane buffer is created: arming is passthrough until a
      // schedule opens a burst, but only buffers created after arming carry
      // the creation stamps that let held-submit-safe destroys and
      // writeBuffer calls be distinguished from ones that must flush first.
      try {
        armWorkerQueueSubmitBurst(record.workerDevice);
      } catch {
        // A device without the full queue surface simply never bursts.
      }
    }
  }
  if (
    data.cpuSeededGasPressureAuthority
    && !isExactSphCpuSeededGasPressureAuthorityGpu(
      data.cpuSeededGasPressureAuthority,
      workerDeviceResult?.device || null
    )
  ) {
    throw new Error(
      'Worker pressure stage rejected a foreign, replayed, or cross-device CPU-seeded gas-pressure authority'
    );
  }
  const workerAdoptedStorageRematerialization = applyWorkerAdoptedStorageRematerialization({
    stageId,
    data,
    record,
    workerDeviceResult
  });
  if (stageId === SCHROEDER_LANE_SEED_STAGE_ID) {
    // The seed stage fails closed with the exact W1 verdict when the
    // particle-storage descriptor was malformed or the rematerialization was
    // never requested.
    workerSchroederLaneSeedRematerializationByStageData.set(
      data,
      workerAdoptedStorageRematerialization
    );
  }
  // Rematerialized adopted storage is the authoritative topology swap; when
  // it supplied the particle inputs, the retained-g2p continuation must not
  // overwrite them.
  const workerRetainedContinuationInput = workerAdoptedStorageRematerialization?.applied === true
    ? {
        status: 'skipped-worker-retained-g2p-input-superseded-by-adopted-storage',
        requested: data?.useWorkerRetainedG2pInput === true,
        sourceStage: 'schroeder-adopted-particle-storage-worker-rematerialization'
      }
    : applyWorkerRetainedContinuationInput({
        stageId,
        data,
        record,
        workerDeviceResult
      });
  const workerRetainedThermoInput = applyWorkerRetainedThermoInput({
    stageId,
    data,
    record,
    workerDeviceResult
  });
  const workerRetainedGasCellFieldImportInput = applyWorkerRetainedGasCellFieldImport({
    stageId,
    data,
    record
  });
  if (stageId === 'pressureInterface') {
    synchronizePressureInterfaceRetainedInputRefs(data);
  }
  const workerExactQueueOrderedGasPressureAuthority =
    stageId === 'pressureInterface'
    && workerPressureUsesExactQueueOrderedGasAuthority(
      data,
      workerDeviceResult?.device || null
    );
  const workerExactPressureGridForceHandoff = stageId === 'gridUpdate'
    ? exactPressureGridHandoffByStageData.get(data) || null
    : null;
  let rawResult = null;
  let workerRetainedGasCellEosReleaseScheduled = false;
  let workerRetainedGasCellEosReleasePromise = null;
  let workerRetainedGasCellEosReleaseStatus = null;
  let workerRetainedGasCellEosReleaseSource = null;
  let workerRetainedGasCellEosReleaseError = null;
  let workerPressureCompletionTransitionDeferred = false;
  const pressureStageExpected = workerContext(payload).includePressureInterfaceStage !== false;
  try {
    rawResult = await runner(data);
  } finally {
    if (
      stageId === 'gridUpdate'
      && !rawResult
      && workerExactPressureGridForceHandoff?.status
        === 'borrowed-by-gridUpdate'
    ) {
      workerExactPressureGridForceHandoff.status = 'ready';
      exactPressureGridHandoffByStageData.delete(data);
    }
    const pressureStageTerminal = stageId === 'pressureInterface';
    const gasProducerFailed = stageId === 'gasCellEosProducer' && !rawResult;
    const gasProducerHasNoPressureConsumer = stageId === 'gasCellEosProducer'
      && rawResult
      && !pressureStageExpected;
    workerPressureCompletionTransitionDeferred = Boolean(
      pressureStageTerminal
      && rawResult
      && workerExactQueueOrderedGasPressureAuthority
      && workerPressureCompletionReceipt(rawResult)
      && workerPressureRetainedForceRowsHandoff(rawResult)
      && workerPressureHasFollowingGridUpdate(data)
    );
    if (
      (pressureStageTerminal && !workerPressureCompletionTransitionDeferred)
      || gasProducerFailed
      || gasProducerHasNoPressureConsumer
    ) {
      const release = scheduleWorkerGasCellEosFinalConsumerRelease({
        record,
        pressureInterfaceGasCellFieldImport:
          data.pressureInterfaceGasCellFieldImport || null,
        gasCellEosProducerResult:
          stageId === 'gasCellEosProducer' ? rawResult : null,
        retainedGasPressureRowsConsumed:
          pressureStageTerminal
            ? workerPressureConsumedRetainedGasRows(rawResult)
            : false,
        pressureStageStatus: pressureStageTerminal
          ? (rawResult ? 'completed' : 'error')
          : (gasProducerFailed ? 'error' : 'omitted')
      });
      workerRetainedGasCellEosReleaseScheduled = release.scheduled === true;
      workerRetainedGasCellEosReleasePromise = release.releasePromise;
      workerRetainedGasCellEosReleaseStatus = release.status;
      workerRetainedGasCellEosReleaseSource = release.source;
      workerRetainedGasCellEosReleaseError = release.error;
    } else if (workerPressureCompletionTransitionDeferred) {
      workerRetainedGasCellEosReleaseStatus =
        'gas-cell-eos-final-consumer-release-deferred-to-exact-pressure-completion-transition';
      workerRetainedGasCellEosReleaseSource =
        'pressure-interface-completion-receipt';
    }
  }
  const compactSnapshotExportSources = stageId === 'g2p'
    && data.captureRetainedCompactSnapshotExportSources === true
    ? await captureUlgMechanicsResidentStageWorkerCompactSnapshotExportSources({
        device: workerDeviceResult?.device || data.device || null,
        record,
        source: rawResult?.gpuResult || rawResult,
        laneId: payload.lease?.laneId || payload.lane?.laneId || null,
        stateKey: payload.lease?.stateKey || payload.lane?.stateKey || null,
        sourceStageId: 'g2p'
      })
    : null;
  const workerQueueFence = await completeWorkerQueueFence({
    stageId,
    data,
    rawResult,
    workerDeviceResult,
    exactQueueOrderedGasPressureAuthorityExpected:
      workerExactQueueOrderedGasPressureAuthority,
    finalConsumerReleasePromise: workerRetainedGasCellEosReleasePromise,
    deferToResidentScheduleTerminal:
      residentScheduleFenceDeferralAuthorized
  });
  if (workerPressureCompletionTransitionDeferred) {
    if (workerQueueFence?.pressureCompletionReceiptValidated === true) {
      workerRetainedGasCellEosReleaseScheduled = true;
      workerRetainedGasCellEosReleasePromise = null;
      workerRetainedGasCellEosReleaseStatus =
        'gas-cell-eos-final-consumer-retired-queue-ordered-after-pressure-submit';
      workerRetainedGasCellEosReleaseSource =
        'exact-pressure-completion-receipt';
      workerRetainedGasCellEosReleaseError = null;
      record.pressureInterfaceGridForceHandoff =
        createWorkerExactPressureGridForceHandoff(
          rawResult,
          workerDeviceResult?.device || null,
          {
            laneKey: record.key,
            laneId: normalizeString(
              payload.lease?.laneId ?? payload.lane?.laneId,
              null
            ),
            stateKey: normalizeString(
              payload.lease?.stateKey ?? payload.lane?.stateKey,
              null
            )
          }
        );
      if (!record.pressureInterfaceGridForceHandoff) {
        workerRetainedGasCellEosReleaseScheduled = false;
        workerRetainedGasCellEosReleaseStatus =
          'gas-cell-eos-final-consumer-pressure-grid-handoff-owner-missing';
        workerRetainedGasCellEosReleaseError =
          'exact pressure completion could not retain its grid handoff owner';
      }
    } else {
      record.pressureInterfaceGridForceHandoff = null;
      const release = scheduleWorkerGasCellEosFinalConsumerRelease({
        record,
        pressureInterfaceGasCellFieldImport:
          data.pressureInterfaceGasCellFieldImport || null,
        retainedGasPressureRowsConsumed:
          workerPressureConsumedRetainedGasRows(rawResult),
        pressureStageStatus: rawResult ? 'completed' : 'error'
      });
      workerRetainedGasCellEosReleaseScheduled = release.scheduled === true;
      workerRetainedGasCellEosReleasePromise = release.releasePromise;
      workerRetainedGasCellEosReleaseStatus = release.status;
      workerRetainedGasCellEosReleaseSource = release.source;
      workerRetainedGasCellEosReleaseError = release.error;
    }
  }
  if (
    stageId === 'gridUpdate'
    && workerExactPressureGridForceHandoff?.status
      === 'retired-after-gridUpdate-submit'
  ) {
    record.pressureInterfaceGridForceHandoff = null;
  }
  const workerRetainedThermoOutput = recordWorkerRetainedThermoOutput({
    stageId,
    rawResult,
    record
  });
  record.stageResults[stageId] = rawResult;
  if (residentScheduleFenceDeferralAuthorized) {
    // These two direct schedule calls never cross postMessage. Their runners
    // already registered the exact bounded buffer descriptors above, and the
    // schedule publishes only its own compact progress/terminal receipts.
    // Avoid the public transport path's defensive gas-authority graph walk,
    // deep clone, copy-budget construction, and recursive ref discovery.
    return privateWorkerResidentScheduleStageResult({
      stageId,
      rawResult,
      record,
      payload,
      callLaneKey,
      activeSchedule,
      workerQueueFence
    });
  }
  const exactGasPressureAuthoritySource =
    exactGasPressureAuthoritySourceFromResult(rawResult)
    || exactGasPressureAuthoritySourceFromResult(
      data.pressureInterfaceGasCellFieldImport || data.gasCellFieldImport || null
    );
  const gasPressureTransportBoundary = exactGasPressureTransportBoundary(
    exactGasPressureAuthoritySource
  );
  const cloneableResult = cloneableValue(
    rawResult,
    record,
    stageId,
    'result',
    new WeakSet(),
    gasPressureTransportBoundary
  );
  const copyBudget = workerStageCopyBudget({
    result: cloneableResult,
    readbackMode: data.readbackMode
  });
  if (data.gpuResidentLane && typeof data.gpuResidentLane === 'object') {
    const laneRetainedBufferRefs = gasPressureTransportBoundary
      ? (data.gpuResidentLane.retainedBufferRefs || [])
          .filter((ref) => !isGasPressureBufferRef(ref))
      : data.gpuResidentLane.retainedBufferRefs;
    const workerLaneRequirement = {
      ...data.gpuResidentLane,
      ...(Array.isArray(laneRetainedBufferRefs)
        ? { retainedBufferRefs: laneRetainedBufferRefs }
        : {}),
      copyBudget
    };
    cloneableResult.gpuResidentLane = workerLaneRequirement;
    cloneableResult.gpuResidentLaneRequirement = workerLaneRequirement;
  }
  const workerRetainedBufferRefs = [...new Set(retainedWorkerRefs(cloneableResult))];
  const retainedBufferRefs = [...new Set([
    ...retainedRefsForStageResult(stageId, rawResult),
    ...workerRetainedBufferRefs
  ])].filter((ref) => (
    !gasPressureTransportBoundary || !isGasPressureBufferRef(ref)
  ));
  const workerRetainedGasPressureBufferRefs = gasPressureTransportBoundary
    ? []
    : uniqueStringList([
    ...(cloneableResult.workerRetainedGasPressureBufferRefs || []),
    ...(cloneableResult.retainedGasCellFieldSource?.workerRetainedGasPressureBufferRefs || []),
    ...workerRetainedBufferRefs.filter(isGasPressureBufferRef)
    ]);
  cloneableResult.retainedBufferRefs = retainedBufferRefs;
  if (workerRetainedGasPressureBufferRefs.length > 0) {
    cloneableResult.workerRetainedGasPressureBufferRefs = workerRetainedGasPressureBufferRefs;
    if (
      cloneableResult.retainedGasCellFieldSource
      && typeof cloneableResult.retainedGasCellFieldSource === 'object'
      && cloneableResult.retainedGasCellFieldSource.telemetryOnly !== true
    ) {
      cloneableResult.retainedGasCellFieldSource = {
        ...cloneableResult.retainedGasCellFieldSource,
        workerRetainedGasPressureBufferRefs: workerRetainedGasPressureBufferRefs
      };
    }
    if (cloneableResult.pressureInterfaceGasCellFieldImport && typeof cloneableResult.pressureInterfaceGasCellFieldImport === 'object') {
      cloneableResult.pressureInterfaceGasCellFieldImport = {
        ...cloneableResult.pressureInterfaceGasCellFieldImport,
        workerRetainedGasPressureBufferRefs: uniqueStringList([
          ...(cloneableResult.pressureInterfaceGasCellFieldImport.workerRetainedGasPressureBufferRefs || []),
          ...workerRetainedGasPressureBufferRefs
        ])
      };
    }
  }
  cloneableResult.workerResidentStage = {
    schema: ULG_MECHANICS_RESIDENT_STAGE_WORKER_RESULT_SCHEMA,
    status: 'worker-stage-completed',
    stageId,
    laneId: payload.lease?.laneId || payload.lane?.laneId || null,
    stateKey: payload.lease?.stateKey || payload.lane?.stateKey || null,
    retainedWithinWorker: true,
    workerWebGpuRequested: data.preferWebGpu === true,
    workerWebGpuStatus: rawResult?.webgpuStatus?.status || workerDeviceResult?.status || null,
    workerWebGpuFallback: rawResult?.webgpuStatus?.fallback || null,
    workerDeviceCached: Boolean(workerDeviceResult?.device),
    workerDeviceSource: workerDeviceResult?.workerDeviceSource || null,
    workerDeviceProvided: workerDeviceResult?.workerDeviceProvided === true,
    workerQueueFence,
    workerQueueFenceSatisfied: workerQueueFence?.fenceSatisfied === true,
    workerRetainedContinuationInput,
    workerRetainedContinuationInputStatus: workerRetainedContinuationInput?.status || null,
    workerAdoptedStorageRematerialization,
    workerAdoptedStorageRematerializationStatus:
      workerAdoptedStorageRematerialization?.status || null,
    workerAdoptedStorageRematerializationApplied:
      workerAdoptedStorageRematerialization?.applied === true,
    workerRetainedThermoInput,
    workerRetainedThermoInputStatus: workerRetainedThermoInput?.status || null,
    workerRetainedGasCellFieldImportInput,
    workerRetainedGasCellFieldImportInputStatus: workerRetainedGasCellFieldImportInput?.status || null,
    workerRetainedGasCellFieldImportApplied: workerRetainedGasCellFieldImportInput?.applied === true,
    workerRetainedGasCellEosReleaseScheduled,
    workerRetainedGasCellEosReleaseStatus,
    workerRetainedGasCellEosReleaseSource,
    workerRetainedGasCellEosReleaseError,
    workerRetainedThermoOutput,
    workerRetainedThermoOutputStatus: workerRetainedThermoOutput?.status || null,
    compactSnapshotExportSources,
    compactSnapshotExportSourceStatus: compactSnapshotExportSources?.status || null,
    compactSnapshotExportOwnedSourcesReady: compactSnapshotExportSources?.exportOwnedSourceReady === true,
    retainedBufferRefs,
    workerRetainedBufferRefs,
    retainedBufferRegistryEntryCount: record.retainedBuffers.size,
    cloneableResultReturned: true
  };
  return {
    value: cloneableResult,
    retainedBufferRefs,
    gpuFence: cloneableResult.gpuFence || cloneableResult.gpuFenceReport || null,
    summary: {
      schema: ULG_MECHANICS_RESIDENT_STAGE_WORKER_RESULT_SCHEMA,
      status: 'worker-stage-completed',
      stageId,
      backend: cloneableResult.backend || null,
      workerWebGpuStatus: cloneableResult.workerResidentStage.workerWebGpuStatus,
      workerQueueFenceSatisfied: cloneableResult.workerResidentStage.workerQueueFenceSatisfied,
      workerRetainedContinuationInputStatus: cloneableResult.workerResidentStage.workerRetainedContinuationInputStatus,
      workerAdoptedStorageRematerializationStatus:
        cloneableResult.workerResidentStage.workerAdoptedStorageRematerializationStatus,
      workerAdoptedStorageRematerializationApplied:
        cloneableResult.workerResidentStage.workerAdoptedStorageRematerializationApplied,
      workerRetainedThermoInputStatus: cloneableResult.workerResidentStage.workerRetainedThermoInputStatus,
      workerRetainedThermoOutputStatus: cloneableResult.workerResidentStage.workerRetainedThermoOutputStatus,
      compactSnapshotExportSourceStatus: cloneableResult.workerResidentStage.compactSnapshotExportSourceStatus,
      compactSnapshotExportOwnedSourcesReady: cloneableResult.workerResidentStage.compactSnapshotExportOwnedSourcesReady,
      retainedBufferRefCount: retainedBufferRefs.length,
      workerRetainedBufferRefCount: workerRetainedBufferRefs.length,
      retainedBufferRegistryEntryCount:
        cloneableResult.workerResidentStage.retainedBufferRegistryEntryCount
    }
  };
}

function postWorkerResult(id, result) {
  globalThis.self.postMessage({
    type: 'resident-stage-result',
    id,
    result
  });
}

function postWorkerError(id, error) {
  globalThis.self.postMessage({
    type: 'resident-stage-error',
    id,
    error: error instanceof Error ? error.message : String(error)
  });
}

if (typeof globalThis.self?.addEventListener === 'function') {
  globalThis.self.addEventListener('message', (event) => {
    const message = event.data || {};
    if (message.type === 'run-resident-stage') {
      runUlgMechanicsResidentStageWorkerPayload(message.payload || {})
        .then((result) => postWorkerResult(message.id, result))
        .catch((error) => postWorkerError(message.id, error));
      return;
    }
    if (message.type === 'run-resident-schedule') {
      runUlgMechanicsResidentStageWorkerSchedulePayload(message.payload || {}, {
        id: message.id,
        postProgress: (progress) => {
          // Fire-and-forget progress envelope; cloneable-only by
          // construction (seals, identity words, worker-retained refs).
          globalThis.self.postMessage({
            type: 'resident-schedule-progress',
            id: message.id,
            progress
          });
        }
      })
        .then((result) => globalThis.self.postMessage({
          type: 'resident-schedule-result',
          id: message.id,
          result
        }))
        .catch((error) => globalThis.self.postMessage({
          type: 'resident-schedule-error',
          id: message.id,
          error: error?.residentScheduleError || {
            schema: ULG_WORKER_RESIDENT_SCHEDULE_ERROR_SCHEMA,
            scheduleId: null,
            stepOrdinal: null,
            stageId: null,
            reason: 'schedule-error',
            message: error instanceof Error ? error.message : String(error),
            laneState: null
          }
        }));
      return;
    }
    if (message.type === 'cancel-resident-schedule') {
      // The flag is observed by the running schedule BETWEEN steps; the
      // terminal 'resident-schedule-result' with cancelled: true (under the
      // schedule's own id) is the acknowledgement.
      cancelUlgMechanicsResidentStageWorkerSchedule(message.id);
    }
  });
}
