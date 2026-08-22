import {
  cloneMlsMpmParticleStateForNext,
  cloneSphParticleStateForNext,
  runSphSpatialGasLedgerProducerStageComputeTask,
  runSphGasCellEosProducerStageComputeTask,
  runSphPressureInterfaceStageComputeTask,
  runSphReactionProductStageComputeTask,
  runSphThermalPhaseStageComputeTask,
  runMlsMpmMechanicsG2pStageComputeTask,
  runMlsMpmMechanicsGridUpdateStageComputeTask,
  runMlsMpmMechanicsP2gStageComputeTask,
  normalizePressureInterfaceGasCellFieldImport,
  scheduleSphGasCellEosFinalConsumerRelease
} from '../runtime/sph/sphMlsMpmGpuStep.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_IDENTITY_UINTS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
} from '../runtime/sph/sphGpuBuffers.js';
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
  releaseSchroederSpatialEpochGenerationAfterQueue,
  runSchroederSpatialEpochGenerationWebGpu
} from '../runtime/sph/schroederSpatialEpochGpu.js';
import {
  resolveSchroederParticleBufferFamilyGeneration,
  runSchroederLevelAssignmentWebGpu,
  runSchroederSameLevelMechanicsWebGpu
} from '../runtime/sph/schroederHierarchyGpu.js';
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
  prewarmCachedExplicitComputePipeline
} from '../runtime/webgpuComputeLayout.js';

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
const SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID = 'schroederSameLevelMechanics';
const SCHROEDER_LANE_SEED_STAGE_ID = 'schroederLaneSeed';
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
export const ULG_WORKER_SCHROEDER_W1_TWO_LEVEL_REFUSAL_REASON =
  'w1-single-level-only';
export const ULG_WORKER_RESIDENT_SCHEDULE_RESULT_SCHEMA =
  'peercompute.ulg.worker-resident-schedule-result.v0';
export const ULG_WORKER_RESIDENT_SCHEDULE_PROGRESS_SCHEMA =
  'peercompute.ulg.worker-resident-schedule-progress.v0';
export const ULG_WORKER_RESIDENT_SCHEDULE_ERROR_SCHEMA =
  'peercompute.ulg.worker-resident-schedule-error.v0';
export const ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_SCHEMA =
  'peercompute.ulg.worker-resident-schedule-step-summary.v0';
// The worker-side batched schedule cap matches the sodium preset's historical
// 128-step resident batching (src/runtime/sphPhaseScenarioPresets.js;
// plan/todo/ss-regression.md correction 1).
export const ULG_WORKER_RESIDENT_SCHEDULE_MAX_STEP_COUNT = 128;
// Terminal schedule results keep the LAST step's full summary plus a compact
// fixed-capacity per-step ring so envelopes stay bounded for any stepCount.
export const ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_RING_CAPACITY = 32;
const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
};
const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};
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
const exactGasPressureTransportGraphByStageData = new WeakMap();
const exactPressureGridHandoffByStageData = new WeakMap();
let workerDeviceResultPromise = null;

function normalizeString(value, fallback = null) {
  const text = String(value ?? '').trim();
  return text || fallback;
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
      && phaseLaneCount === 4
      && phaseLaneStride === lineageCapacity
      && companionStart === lineageCapacity
      && companionCapacity === 3 * lineageCapacity
      && particleCapacity === 4 * lineageCapacity
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
          : {})
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
      && left.stableLaneAddress === right.stableLaneAddress;
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
      }
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
          mechanicsBuffer:
            record.schroederLane?.mlsMpmParticleUpload?.mechanicsBuffer || null,
          particleCount:
            record.schroederLane?.particleCount
            ?? schroederLaneUpload.particleCount
            ?? null,
          stateStrideFloats: schroederLaneUpload.stateStrideFloats ?? null,
          thermoStrideFloats: schroederLaneUpload.thermoStrideFloats ?? null,
          stateBufferByteLength: schroederLaneUpload.stateBufferByteLength ?? null,
          thermoBufferByteLength: schroederLaneUpload.thermoBufferByteLength ?? null
        }
      : null;
  const source = sourceStageId === 'g2p' ? g2p : schroederLaneSource;
  const exportSources = sourceStageId === 'g2p'
    && record.compactSnapshotExportSources?.status === 'worker-retained-compact-snapshot-export-sources-ready'
    && record.compactSnapshotExportSources?.exportOwnedSourceReady === true
    ? record.compactSnapshotExportSources
    : null;
  const thermoBuffer = record.retainedThermoBuffer || source?.thermoBuffer || null;
  const resolvedParticleCount = Math.max(0, Math.floor(Number(
    particleCount ?? source?.particleCount
  ) || 0));
  const resolvedStateStrideFloats = Math.max(1, Math.floor(Number(
    stateStrideFloats ?? source?.stateStrideFloats
  ) || 8));
  const resolvedThermoStrideFloats = Math.max(12, Math.floor(Number(
    thermoStrideFloats ?? source?.thermoStrideFloats
  ) || 12));
  const resolvedStateByteLength = positiveByteLength(
    stateByteLength,
    source?.stateBufferByteLength,
    resolvedParticleCount * resolvedStateStrideFloats * Float32Array.BYTES_PER_ELEMENT
  );
  const resolvedThermoByteLength = positiveByteLength(
    thermoByteLength,
    record.retainedThermoBufferByteLength,
    source?.thermoBufferByteLength,
    resolvedParticleCount * resolvedThermoStrideFloats * Float32Array.BYTES_PER_ELEMENT
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
    particleCount: resolvedParticleCount,
    stateStrideFloats: resolvedStateStrideFloats,
    thermoStrideFloats: resolvedThermoStrideFloats,
    stateBufferByteLength: exportSources?.stateBufferByteLength || resolvedStateByteLength,
    thermoBufferByteLength: resolvedThermoByteLength,
    mechanicsBufferByteLength: exportSources?.mechanicsBufferByteLength || positiveByteLength(source.mechanicsBufferByteLength),
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
  let resolvedPhaseCarrierPlan = null;
  try {
    const sourcePhaseCarrierPlan = phaseCarrierPlan !== undefined
      ? phaseCarrierPlan
      : (record?.phaseCarrierPlan
          || record?.adoptedStorageRematerialization?.phaseCarrierPlan
          || null);
    resolvedPhaseCarrierPlan = clonePhaseCarrierPlanForParticleCount(
      sourcePhaseCarrierPlan,
      resolvedParticleCount,
      'worker retained compact snapshot phaseCarrierPlan'
    );
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
    const resolvedStep = Number.isFinite(Number(step)) ? Number(step) : null;
    const resolvedTime = Number.isFinite(Number(time)) ? Number(time) : null;
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
      sphState,
      sphThermo,
      mlsMpmMechanics
    };
    const byteLength = sphState.byteLength + sphThermo.byteLength + mlsMpmMechanics.byteLength;
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
      mlsMpmMechanicsByteLength: mlsMpmMechanics.byteLength,
      phaseCarrierPlan: resolvedPhaseCarrierPlan ? { ...resolvedPhaseCarrierPlan } : null,
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
    schema: 'peercompute.ulg.worker-rematerialized-adopted-storage-sph-particle-upload.v0',
    status: 'webgpu-uploaded',
    workerRetained: true,
    sourceStage: 'schroeder-adopted-particle-storage-worker-rematerialization',
    particleCount: retained.particleCount,
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
    schema: 'peercompute.ulg.worker-rematerialized-adopted-storage-mls-mpm-particle-upload.v0',
    status: 'webgpu-uploaded',
    workerRetained: true,
    sourceStage: 'schroeder-adopted-particle-storage-worker-rematerialization',
    particleCount: retained.particleCount,
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
// W1 is physics-only. Deliberately left on the scene path: render-proxy
// publication (portable summary, render LOD, local retained render buffers),
// phase-volume assignment-overlay feedback caching, the pre-integration
// owner-scope pressure diagnostic, product-placement accumulation, host
// timing/progress marks, and prior-execution cleanup claim records.
//
// TODO(native-arm): real-GPU coverage for these two stages belongs to the
// native WebGPU test arm (see tests/*.native.test.mjs). The node tests drive
// the real epoch builder on the synthetic fake-device fixture and pin the
// mechanics-stage contract through the injectable
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

function workerSchroederTwoLevelRequested(data = {}) {
  return data?.enableTwoLevelMechanics === true
    || data?.twoLevelMechanicsAuthority === 'authoritative'
    || (Array.isArray(data?.mechanicsLevels) && data.mechanicsLevels.length > 1);
}

function refuseWorkerSchroederTwoLevel(stageId, data = {}) {
  if (!workerSchroederTwoLevelRequested(data)) return;
  throw workerSchroederStageError(
    stageId,
    ULG_WORKER_SCHROEDER_W1_TWO_LEVEL_REFUSAL_REASON,
    'two-level Schroeder mechanics stays on the scene path in refactor increment W1'
  );
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
// Fire-and-forget and fail-open per the primitive's semantics: every
// descriptor is fired without awaiting, compile failures resolve inside the
// primitive (never reject the lane), and a throwing enumeration is reported
// truthfully instead of blocking admission.
export function prewarmWorkerSchroederLaneComputePipelines(device, {
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
  let firedCount = 0;
  for (const descriptor of descriptors) {
    try {
      // Fire-and-forget: prewarm failures never gate lane admission.
      prewarmCachedExplicitComputePipeline(device, descriptor).catch(() => {});
      firedCount += 1;
    } catch {
      // A malformed descriptor is an enumeration bug, not a lane blocker.
    }
  }
  return {
    schema: 'peercompute.ulg.worker-schroeder-lane-pipeline-prewarm.v0',
    status: 'worker-lane-pipeline-prewarm-completed',
    reason: null,
    requestedCount: descriptors.length,
    firedCount
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
  return async function workerSchroederLaneLevelAssignmentProvider() {
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
}

async function runWorkerSchroederLaneSeedStage(data = {}) {
  const stageId = SCHROEDER_LANE_SEED_STAGE_ID;
  const record = workerSchroederLaneRecord(stageId, data);
  refuseWorkerSchroederTwoLevel(stageId, data);
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
  const seedOptions = data.schroederLaneSeed
    && typeof data.schroederLaneSeed === 'object'
    ? data.schroederLaneSeed
    : {};
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
    laneSeed,
    sphParticleUpload: seededSphUpload,
    mlsMpmParticleUpload: seededMlsUpload,
    particleCount
  };
  const seedLevelAssignmentBufferRef = retainGpuBuffer(
    record,
    stageId,
    'laneSeed.levelAssignment.assignmentBuffer',
    execution.assignmentBuffer
  );
  // W4b/W5: lane admission fires the pipeline prewarm hook (fire-and-forget;
  // reports a truthful summary of the SS descriptors it fired).
  const pipelinePrewarm = prewarmWorkerSchroederLaneComputePipelines(device);
  return {
    schema: ULG_WORKER_SCHROEDER_LANE_SEED_STAGE_SCHEMA,
    status: 'worker-schroeder-lane-seeded',
    pipelinePrewarm,
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
  refuseWorkerSchroederTwoLevel(stageId, data);
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
  let generation;
  try {
    generation = await generationRunner({
      device,
      ...(levelAssignment ? { levelAssignment } : { activeNodeList }),
      particleCount,
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
      selectedLevel: data.selectedLevel ?? 0,
      ...(data.mechanicsGrid ? { mechanicsGrid: data.mechanicsGrid } : {}),
      ...(Number.isInteger(data.spatialEpochArenaCount)
        ? { directArenaCount: data.spatialEpochArenaCount }
        : {}),
      mechanicsFieldPairV2Enabled: data.enableMechanicsFieldPairV2 === true,
      exactNearCellTreeEnabled: data.exactNearCellTreeEnabled !== false,
      gpuTimestampRecorder: null
    });
  } catch (error) {
    releaseWorkerSchroederSuccessorLeaseQuietly(successorConsumption, device);
    throw error;
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
      runtimeCacheHit: generation.runtimeCacheHit === true,
      particleCount
    },
    ...retainedRefDescriptors
  };
}

async function runWorkerSchroederSameLevelMechanicsStage(data = {}) {
  const stageId = SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID;
  const record = workerSchroederLaneRecord(stageId, data);
  refuseWorkerSchroederTwoLevel(stageId, data);
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
  if (currentSeal.mechanicsLevelCount > 1) {
    throw workerSchroederStageError(
      stageId,
      ULG_WORKER_SCHROEDER_W1_TWO_LEVEL_REFUSAL_REASON,
      'the retained generation carries more than one mechanics level view'
    );
  }
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
  let kernelResult = null;
  let successorLeaseReleasePromise = null;
  try {
    kernelResult = await kernelRunner({
      device,
      sphParticleState: sphParticleStateForKernel,
      mlsMpmParticleState: mlsMpmParticleStateForKernel,
      sphParticleUpload,
      mlsMpmParticleUpload,
      spatialEpochGeneration: generation,
      enableSpatialEpochGeneration: false,
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
      enableTwoLevelMechanics: false,
      twoLevelMechanicsAuthority: 'observation',
      enableMechanicsFieldPairV2: data.enableMechanicsFieldPairV2 === true,
      boxDimsM: data.boxDimsM ?? [5, 5, 5],
      ...(data.dt != null ? { dt: data.dt } : {}),
      ...(data.gravityMPerS2 != null
        ? { gravityMPerS2: data.gravityMPerS2 }
        : {}),
      ...(data.cflFactor != null ? { cflFactor: data.cflFactor } : {}),
      ...(data.readbackMode ? { readbackMode: data.readbackMode } : {}),
      ...(data.residentStepOptions
        && typeof data.residentStepOptions === 'object'
        ? { residentStepOptions: data.residentStepOptions }
        : {})
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
  // The retained generation fed exactly this step; release it queue-ordered
  // behind the step's submissions and keep the post-step buffers as the
  // lane's continuation state for the next schroederSpatialEpoch.
  lane.epochConsumed = true;
  const epochReleaseScheduled =
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, device)
      === true;
  lane.epochReleaseScheduled = epochReleaseScheduled;
  lane.epochReleasePromise = generation.releasePromise ?? null;
  lane.successorConsumption = null;
  lane.levelAssignment = null;
  lane.activeNodeList = null;
  lane.sphParticleUpload = nextSphUpload;
  lane.mlsMpmParticleUpload = nextMlsUpload;
  lane.successorSourceFamily = nextSuccessorSourceFamily;
  lane.particleCount = nextSphUpload?.particleCount ?? lane.particleCount ?? null;
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
  return {
    schema: ULG_WORKER_SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_SCHEMA,
    status: 'worker-schroeder-same-level-mechanics-completed',
    backend: residentStep.backend || 'webgpu',
    readbackMode: residentStep.readbackMode ?? data.readbackMode ?? null,
    epochSeal: currentSeal,
    epochConsumed: true,
    epochReleaseScheduled,
    residentStepSummary: {
      backend: residentStep.backend ?? null,
      status: residentStep.status ?? null,
      stageStatus: { ...(residentStep.stageStatus || {}) },
      stageBackends: { ...(residentStep.stageBackends || {}) },
      readbackMode: residentStep.readbackMode ?? null,
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
// TODO(W4): global schedule admission (queueing/fairness across lanes and
// against single-stage messages) arrives with increment W4; until then the
// per-lane exclusivity above is the only admission control.
//
// Cancellation ('cancel-resident-schedule') sets a flag the loop checks only
// BETWEEN steps: the in-flight step always completes and releases per W1
// semantics, then the driver posts a terminal result with cancelled: true and
// the truthful completedStepCount. The loop awaits a plain microtask yield
// between steps; the per-stage device fences are what actually yield the
// worker's macrotask queue so cancel messages can be delivered mid-batch.

const SCHROEDER_EPOCH_ADVANCING_IDENTITY_WORD_FIELDS = Object.freeze([
  'physicsTick',
  'positionEpoch'
]);
const activeWorkerResidentScheduleByLaneKey = new Map();
const activeWorkerResidentScheduleByCancelKey = new Map();
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
    laneSeedConsumed: lane?.laneSeed?.consumed === true
  };
}

// A schedule step that aborted after its epoch stage retained a fresh sealed
// generation (identity regression, or a mechanics-stage error) must not leave
// that generation pinned unconsumed: a follow-up single 'run-resident-stage'
// epoch message on the same lane has to keep working. Release it queue-ordered
// exactly like consumption would have, but only when the retained generation
// is provably the one THIS step built.
function releaseWorkerResidentScheduleUnconsumedStepEpoch(record, stepSeal, {
  releaseSuccessorLease = false
} = {}) {
  const lane = record?.schroederLane || null;
  if (!stepSeal || !lane?.epochGeneration || lane.epochConsumed === true) {
    return false;
  }
  if (lane.epochSeal?.generationId !== stepSeal.generationId) return false;
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
  const released =
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, lane.device)
      === true;
  lane.epochConsumed = true;
  lane.epochReleasedWithoutMechanicsStep = true;
  lane.epochReleaseScheduled = released;
  lane.epochReleasePromise = generation.releasePromise ?? null;
  return released;
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
  { id = null, postProgress = null } = {}
) {
  const schedule = payload.schedule && typeof payload.schedule === 'object'
    ? payload.schedule
    : {};
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
    cancelRequested: false
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
  try {
    const baseContext = workerContext(payload);
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
    const epochOptionsForStep = async (stepOrdinal, previousEpochSeal) => {
      const {
        scheduleStepOptionsProvider: ignoredProvider,
        ...stepZeroOptions
      } = baseEpochOptions;
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
    const mechanicsOptionsForStep = (epochSeal) => {
      const {
        expectedSpatialEpochSeal: ignoredExpectedSeal,
        ...continuationOptions
      } = baseMechanicsOptions;
      // The driver pins each step's mechanics stage to the seal of the
      // generation IT just built; a caller-supplied seal is only valid for
      // one generation and would go stale on step 2.
      return { ...continuationOptions, expectedSpatialEpochSeal: epochSeal };
    };
    const record = getLaneRecord(payload);
    // W4a: a seeded lane's epoch-identity monotonicity baseline is the SEED
    // lineage. The step that consumes the retained seeded assignment must
    // carry exactly the seeded identity words (the epoch it builds IS the
    // seeded epoch); every other unpreceded first step on a seeded lane —
    // including a schedule started after single-stage messages consumed the
    // seed — must strictly advance beyond the seeded words.
    const scheduleStartLane = record.schroederLane || null;
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
    let completedStepCount = 0;
    let cancelled = false;
    let previousEpochSeal = null;
    let lastMechanicsStageResult = null;
    let lastStepSummary = null;
    const stepSummaryRing = [];
    let droppedStepSummaryCount = 0;
    for (let stepOrdinal = 1; stepOrdinal <= stepCount; stepOrdinal += 1) {
      // Microtask yield between steps; cancellation is observed here and
      // never mid-stage.
      await Promise.resolve();
      if (state.cancelRequested) {
        cancelled = true;
        break;
      }
      let currentStepSeal = null;
      let epochStageResult = null;
      let mechanicsStageResult = null;
      let mechanicsStageStarted = false;
      try {
        epochStageResult = await runUlgMechanicsResidentStageWorkerPayload(
          scheduleStagePayload(
            SCHROEDER_SPATIAL_EPOCH_STAGE_ID,
            ['schroeder-level-assignment'],
            ['schroeder-spatial-epoch'],
            await epochOptionsForStep(stepOrdinal, previousEpochSeal)
          )
        );
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
        mechanicsStageResult = await runUlgMechanicsResidentStageWorkerPayload(
          scheduleStagePayload(
            SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_ID,
            ['schroeder-spatial-epoch', 'sph-particle-state', 'mls-mpm-mechanics'],
            ['sph-particle-state', 'mls-mpm-mechanics'],
            mechanicsOptionsForStep(currentStepSeal)
          )
        );
      } catch (error) {
        // The W1 stage finally-blocks already released the successor-family
        // lease when the mechanics stage ran; drop the epoch this step built
        // (if it is still retained unconsumed) so the lane stays consistent
        // and restartable by a plain 'run-resident-stage' epoch message.
        releaseWorkerResidentScheduleUnconsumedStepEpoch(
          record,
          currentStepSeal,
          { releaseSuccessorLease: !mechanicsStageStarted }
        );
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
          throw error;
        }
        throw workerResidentScheduleError(
          normalizeString(error?.reason, null) || 'schedule-step-stage-error',
          error?.message != null ? String(error.message) : String(error),
          {
            scheduleId,
            stepOrdinal,
            stageId: normalizeString(error?.stageId, null),
            laneState
          }
        );
      }
      completedStepCount = stepOrdinal;
      previousEpochSeal = currentStepSeal;
      lastMechanicsStageResult = mechanicsStageResult;
      const epochIdentity =
        workerResidentScheduleEpochIdentity(currentStepSeal);
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
        particleCount:
          mechanicsStageResult.value?.postStep?.particleCount ?? null,
        successorSourceFamilyRetained:
          mechanicsStageResult.value?.postStep?.successorSourceFamilyRetained
            === true,
        retainedBufferRefs: [...(mechanicsStageResult.retainedBufferRefs || [])],
        gpuFenceSatisfied:
          mechanicsStageResult.gpuFence?.fenceSatisfied === true
      };
      stepSummaryRing.push({
        stepOrdinal,
        generationId: currentStepSeal.generationId ?? null,
        storageGeneration: currentStepSeal.storageGeneration ?? null,
        physicsTick: currentStepSeal.physicsTick ?? null,
        positionEpoch: currentStepSeal.positionEpoch ?? null,
        mechanicsStatus: mechanicsStageResult.value?.status ?? null
      });
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
    }
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
      progressEverySteps,
      retainedBufferRefs: [
        ...(lastMechanicsStageResult?.retainedBufferRefs || [])
      ],
      finalEpochIdentity: workerResidentScheduleEpochIdentity(previousEpochSeal),
      finalEpochSeal: previousEpochSeal,
      perStepSummaries: {
        schema: 'peercompute.ulg.worker-resident-schedule-step-summaries.v0',
        ringCapacity: ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_RING_CAPACITY,
        totalStepCount: completedStepCount,
        droppedStepCount: droppedStepSummaryCount,
        lastStep: lastStepSummary,
        ring: stepSummaryRing
      },
      gpuFence: lastMechanicsStageResult?.gpuFence ?? null
    };
  } finally {
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
  finalConsumerReleasePromise = null
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

export async function runUlgMechanicsResidentStageWorkerPayload(payload = {}) {
  const stageId = normalizeString(payload.stage?.id, null);
  if (stageId === GAS_CELL_EOS_FINALIZER_STAGE_ID) {
    return finalizeWorkerGasCellEosOwner(payload);
  }
  const runner = STAGE_RUNNERS[stageId];
  if (typeof runner !== 'function') {
    throw new Error(`Unsupported ULG mechanics resident worker stage: ${stageId || 'missing-stage'}`);
  }
  const record = getLaneRecord(payload);
  const data = stageDataForPayload(payload, record);
  const workerDeviceResult = await getWorkerDeviceResult(data.preferWebGpu === true, data);
  if (workerDeviceResult) {
    data.deviceResult = workerDeviceResult;
    data.navigatorRef = globalThis.navigator;
    record.workerDevice = workerDeviceResult.device || null;
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
    finalConsumerReleasePromise: workerRetainedGasCellEosReleasePromise
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
      workerRetainedBufferRefCount: workerRetainedBufferRefs.length
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
