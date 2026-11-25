// Extracted from ulgMechanicsResidentStage.worker.js (Gate 6 Phase D mechanical decomposition).

import {
  ULG_WORKER_TIER0_PRESENTATION_QOS_MAX_SUBSTEPS_PER_SUBMISSION,
  isExactWorkerTier0PresentationQosBoundaryProof,
  resolveWorkerTier0PresentationQosSubsteps,
  workerTier0PresentationQosBoundaryFrameSerials
} from '../runtime/sph/sphWorkerPresentationQos.js';
import {
  ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V2,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V4,
  describeSphSpatialGasPressureAuthority,
  isExactSphSpatialGasPressureAuthoritySource
} from '../runtime/sph/sphSpatialGasLedgerEosGpu.js';
import {
  SCHROEDER_SPATIAL_REACTION_ACTIVATION_PREDICATE_REVISION,
  ULG_SCHROEDER_SPATIAL_REACTION_ACTIVATION_OBSERVATION_SCHEMA,
  enumerateSchroederSpatialReactionDiscoveryPrewarmPipelineDescriptors,
  observeSchroederSpatialReactionDiscoveryActivation,
  schroederSpatialReactionDiscoveryDeviceRuntimeAllocationOwnership
} from '../runtime/sph/schroederSpatialReactionDiscoveryProposalGpu.js';
import {
  SPH_REACTION_ACTIVATION_OBSERVATION_PUBLIC_FAILURE_WORD,
  SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT,
  SPH_REACTION_MOTION_ENVELOPE_PREDICATE,
  ULG_SPH_REACTION_ACTIVATION_OBSERVATION_FATAL_ERROR_CODE,
  createSphReactionMotionEnvelope
} from '../runtime/sph/sphReactionMotionEnvelope.js';
import {
  ULG_WORKER_PHASE_CARRIER_ONE_TO_FOUR_TRANSITION_SCHEMA as ULG_WORKER_PHASE_CARRIER_ONE_TO_FOUR_TRANSITION_ROUTE_SCHEMA,
  ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_SCHEMA as ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_ROUTE_SCHEMA,
  ULG_WORKER_SCHEDULE_PROSPECTIVE_WRITER_EVIDENCE_SCHEMA,
  WORKER_DYNAMIC_LAW_OBSERVATION_FAILURE_POLICY,
  exactWorkerDynamicLawObservationSelf,
  workerRouteValuesEqual
} from '../runtime/sph/schroederWorkerScheduleRouteEvidence.js';


export const ULG_MECHANICS_RESIDENT_STAGE_WORKER_PROTOCOL_SCHEMA = 'peercompute.ulg.mechanics-resident-stage-worker.v0';
export const ULG_MECHANICS_RESIDENT_STAGE_WORKER_RESULT_SCHEMA = 'peercompute.ulg.mechanics-resident-stage-worker-result.v0';
export const ULG_MECHANICS_RESIDENT_STAGE_WORKER_RETAINED_PARTICLE_STATE_SCHEMA =
  'peercompute.ulg.mechanics-resident-stage-worker-retained-particle-state.v0';
export const ULG_MECHANICS_RESIDENT_STAGE_WORKER_RETAINED_COMPACT_SNAPSHOT_EXPORT_SCHEMA =
  'peercompute.ulg.mechanics-resident-stage-worker-retained-compact-snapshot-export.v0';
export const ULG_WORKER_RESIDENT_SCHEDULE_SPATIAL_KEY_CHURN_OBSERVATION_SCHEMA =
  'peercompute.ulg.worker-resident-schedule-spatial-key-churn-observation.v0';
export const ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA =
  'peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0';
export const ULG_SPH_PHASE_CARRIER_PLAN_V1_SCHEMA = 'peercompute.ulg.sph-phase-carrier-plan.v1';
export const ULG_SPH_PHASE_CARRIER_PLAN_V2_SCHEMA = 'peercompute.ulg.sph-phase-carrier-plan.v2';

export const NO_FULL_READBACK_MODE = 'no-full-readback';
export const GAS_CELL_EOS_FINALIZER_STAGE_ID = 'gasCellEosFinalizer';
export const SCHROEDER_SPATIAL_EPOCH_STAGE_ID = 'schroederSpatialEpoch';
// Diagnostic-only queue-fence recorder for the epoch generation stage; see
// runWorkerSchroederSpatialEpochStage. Fences serialize the queue, so this
// exists only under residentGpuTimestampProfile=1.
export const SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID = 'schroederSameLevelMechanics';
export const SCHROEDER_LANE_SEED_STAGE_ID = 'schroederLaneSeed';
export const TIER0_FUSED_RESIDENT_SEQUENCE_STAGE_ID =
  'tier0FusedResidentSequence';
export const WORKER_SCHROEDER_SCHEDULE_TRANSPORT_STAGE_IDS = Object.freeze(
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
export const WORKER_ADOPTED_STORAGE_REMATERIALIZATION_STAGE_IDS = Object.freeze(
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
  'peercompute.ulg.worker-schedule-law-activation-receipt.v1';
export const ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_SCHEMA =
  ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_ROUTE_SCHEMA;
export const ULG_WORKER_TIER0_TOPOLOGY_ATTESTATION_SCHEMA =
  'peercompute.ulg.worker-tier0-topology-attestation.v0';
export const ULG_WORKER_PHASE_CARRIER_ONE_TO_FOUR_TRANSITION_SCHEMA =
  ULG_WORKER_PHASE_CARRIER_ONE_TO_FOUR_TRANSITION_ROUTE_SCHEMA;
export const SPH_FRESH_DISPERSED_MEDIUM_OPTICS_REPLACEMENT_SCHEMA =
  'peercompute.ulg.sph-fresh-dispersed-medium-optics-replacement.v0';
export const WORKER_FRESH_DISPERSED_MEDIUM_OPTICS_REJECTION_QUARANTINE_SCHEMA =
  'peercompute.ulg.worker-fresh-dispersed-medium-optics-rejection-quarantine.v0';
export const WORKER_FRESH_DISPERSED_MEDIUM_OPTICS_REJECTION_INCOMPLETE_REASON =
  'fresh-dispersed-medium-optics-rejection-incomplete';
export const WORKER_FRESH_DISPERSED_MEDIUM_OPTICS_COMMIT_QUARANTINE_SCHEMA =
  'peercompute.ulg.worker-fresh-dispersed-medium-optics-commit-quarantine.v0';
export const WORKER_FRESH_DISPERSED_MEDIUM_OPTICS_COMMIT_INCOMPLETE_REASON =
  'fresh-dispersed-medium-optics-commit-retirement-incomplete';
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
// A stalled renderer must not become a new physics completion requirement.
// This is a wall-clock failure bound, not a claimed presentation cadence.
export const ULG_WORKER_CANONICAL_PRESENTATION_BOUNDARY_TIMEOUT_MS = 100;
// A presentation-coupled Tier0 lane must return to the compositor often
// enough to sustain the 54 Hz interactive floor. This cap is route-generic:
// materials and scenarios still run the same kernels and differ only in their
// authored laws/conditions. Larger configured mechanics bursts remain valid
// when no presentation boundary callback is attached.
export { ULG_WORKER_TIER0_PRESENTATION_QOS_MAX_SUBSTEPS_PER_SUBMISSION };
// Terminal schedule results keep the LAST step's full summary plus a compact
// fixed-capacity per-step ring so envelopes stay bounded for any stepCount.
export const ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_RING_CAPACITY = 64;
export const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
};
export const GPU_MAP_MODE = {
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

export function exactReactionActivationGpuObservation(value, {
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

export function malformedReactionActivationObservationError(message) {
  const error = new Error(message);
  error.code = ULG_SPH_REACTION_ACTIVATION_OBSERVATION_FATAL_ERROR_CODE;
  error.reactionActivationObservationFatal = true;
  return error;
}

export const EXACT_GAS_PRESSURE_TRANSPORT_RAW_ALIAS_KEYS = new Set([
  'gasPressureCellsBuffer',
  'retainedGasPressureCellsBuffer',
  'pressureInterfaceGasPressureCellsBuffer',
  'gasAuthorityControlBuffer',
  'retainedGasAuthorityControlBuffer',
  'pressureInterfaceGasAuthorityControlBuffer'
]);
export const EXACT_GAS_PRESSURE_TRANSPORT_CAPABILITY_KEYS = new Set([
  'releaseAfterFinalConsumerQueue',
  'deferredCleanupReadbackTelemetrySnapshot',
  'releasePromise'
]);
export const WORKER_LOCAL_PRESSURE_AUTHORITY_KEYS = new Set([
  'cpuSeededGasPressureAuthority',
  'pressureCompletionReceipt'
]);
export const EXACT_GAS_PRESSURE_TRANSPORT_RETIRED_SCHEMA_KEYS = new Set([
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V2,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V4
]);
export const EXACT_GAS_PRESSURE_TRANSPORT_GRAPH_KEYS = Object.freeze([
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
export const EXACT_GAS_PRESSURE_TRANSPORT_CAPTURE_KEYS = Object.freeze([
  ...new Set([
    ...EXACT_GAS_PRESSURE_TRANSPORT_GRAPH_KEYS,
    ...EXACT_GAS_PRESSURE_TRANSPORT_RAW_ALIAS_KEYS,
    ...EXACT_GAS_PRESSURE_TRANSPORT_READINESS_KEYS
  ])
]);

