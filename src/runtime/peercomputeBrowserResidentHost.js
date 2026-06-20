import {
  attachResidentStateManagerCommitBridge,
  readResidentStepsCommittedWarmDelta
} from './peercomputeResidentCommitBridge.js';
import {
  RESIDENT_STATE_FAMILIES
} from './residentStateAuthority.js';
import {
  ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
  ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA,
  createMlsMpmMechanicsG2pStageComputeTask,
  createMlsMpmMechanicsGridUpdateStageComputeTask,
  createMlsMpmMechanicsP2gStageComputeTask,
  createMlsMpmMechanicsOnlyResidentStepsComputeTask,
  createMlsMpmResidentStepsComputeTask,
  createSphSpatialGasLedgerProducerStageComputeTask,
  createSphGasCellEosProducerStageComputeTask,
  runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks
} from './sph/sphMlsMpmGpuStep.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_FLOATS,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  buildMlsMpmGpuParticleBuffers,
  buildSphGpuParticleBuffers,
  decodeMlsMpmGpuParticleRows,
  decodeSphGpuParticleRows,
  uploadMlsMpmGpuParticleBuffers,
  uploadSphGpuParticleBuffers
} from './sph/sphGpuBuffers.js';
import { hashPayload } from '../../ulg-gpu-abi/src/index.js';

export const ULG_PEERCOMPUTE_RESIDENT_AUTHORITY_HOST_SCHEMA = 'peercompute.ulg.browser-resident-authority-host.v0';
export const ULG_PEERCOMPUTE_NODEKERNEL_FACADE_SCHEMA = 'peercompute.ulg.nodekernel-facade.v0';
export const ULG_PEERCOMPUTE_NODEKERNEL_AUTHORITY_SCHEMA = 'peercompute.ulg.nodekernel-authority.v0';
export const ULG_PEERCOMPUTE_NODEKERNEL_NETWORK_GATE_SCHEMA = 'peercompute.ulg.nodekernel-network-gate.v0';
export const ULG_PEERCOMPUTE_RESIDENT_SOLVER_REGISTRATION_SCHEMA = 'peercompute.ulg.resident-solver-registration.v0';
export const ULG_PEERCOMPUTE_REMOTE_PLACEMENT_GATE_SCHEMA = 'peercompute.ulg.remote-placement-gate.v0';
export const ULG_PEERCOMPUTE_REMOTE_PLACEMENT_ADMISSION_SCHEMA = 'peercompute.ulg.remote-placement-admission.v0';
export const ULG_RESIDENT_LAW_GRAPH_SCHEMA = 'peercompute.ulg.law-closure-graph.v0';
export const ULG_RESIDENT_LAW_GRAPH_MANIFEST_SCHEMA = 'peercompute.ulg.law-closure-graph-manifest.v0';
export const ULG_RESIDENT_LAW_STATE_FAMILY_CONTRACT_SCHEMA = 'peercompute.ulg.law-state-family-contract.v0';
export const ULG_RESIDENT_LAW_FAMILY_PROMOTION_ADMISSION_SCHEMA = 'peercompute.ulg.law-family-promotion-admission.v0';
export const ULG_RESIDENT_MECHANICS_PROMOTION_EVIDENCE_SCHEMA = 'peercompute.ulg.mechanics-promotion-evidence.v0';
export const ULG_RESIDENT_MECHANICS_PROMOTION_EVIDENCE_TASK_INPUT_SCHEMA = 'peercompute.ulg.mechanics-promotion-evidence-task-input.v0';
export const ULG_RESIDENT_MECHANICS_CHILD_DRY_RUN_TASK_INPUT_SCHEMA = 'peercompute.ulg.mechanics-child-dry-run-task-input.v0';
export const ULG_REMOTE_TASK_GRAPH_STATE_SEED_PAYLOAD_SCHEMA = 'peercompute.ulg.remote-task-graph-sph-mls-mpm-state-seed.v0';
export const ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_EXECUTOR_SCHEMA = 'peercompute.ulg.remote-task-graph-hot-buffer-refresh-executor.v0';
export const ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA = 'peercompute.ulg.remote-task-graph-hot-buffer-refresh-result.v0';
export const ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_AUTHORITY_REPORT_SCHEMA = 'peercompute.ulg.remote-task-graph-hot-buffer-refresh-authority-report.v0';
export const ULG_REMOTE_TASK_GRAPH_SUBMIT_REFRESH_REPORT_SCHEMA = 'peercompute.ulg.remote-task-graph-submit-refresh-report.v0';
export const ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_GRAPH_SCHEMA = 'peercompute.ulg.remote-task-graph-sph-mls-mpm-resident-graph.v0';
export const ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_SEED_NODE_SCHEMA = 'peercompute.ulg.remote-task-graph-sph-mls-mpm-seed-node.v0';
export const ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_MECHANICS_STAGE_SEED_NODE_SCHEMA = 'peercompute.ulg.remote-task-graph-sph-mls-mpm-mechanics-stage-seed-node.v0';
export const ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_MECHANICS_STAGE_COMPACT_SEED_SCHEMA = 'peercompute.ulg.remote-task-graph-sph-mls-mpm-mechanics-stage-compact-seed.v0';
export const ULG_REMOTE_TASK_GRAPH_COMPACT_LOCAL_REFRESH_CONTRACT_SCHEMA = 'peercompute.ulg.remote-task-graph-compact-local-refresh-contract.v0';
export const ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA = 'peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0';
export const ULG_REMOTE_TASK_GRAPH_SAME_DEVICE_RETAINED_BUFFER_IMPORT_SCHEMA = 'peercompute.ulg.remote-task-graph-same-device-retained-buffer-import.v0';
export const ULG_SPH_MLS_MPM_SAME_DEVICE_HOT_BUFFER_SOURCE_PUBLICATION_SCHEMA = 'peercompute.ulg.sph-mls-mpm-same-device-hot-buffer-source-publication.v0';
export const ULG_WORKER_RETAINED_ACCESS_CONTRACT_SCHEMA = 'peercompute.ulg.worker-retained-access-contract.v0';
export const ULG_WORKER_RETAINED_CONTINUATION_PLAN_SCHEMA = 'peercompute.ulg.worker-retained-continuation-plan.v0';
export const ULG_MECHANICS_WORKER_RETAINED_BUFFER_IMPORT_SCHEMA = 'peercompute.ulg.mechanics-worker-retained-buffer-import.v0';
export const ULG_MECHANICS_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA = 'peercompute.ulg.mechanics-worker-retained-hot-buffer-publication.v0';
export const ULG_THERMAL_PHASE_WORKER_RETAINED_BUFFER_IMPORT_SCHEMA = 'peercompute.ulg.thermal-phase-worker-retained-buffer-import.v0';
export const ULG_THERMAL_PHASE_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA = 'peercompute.ulg.thermal-phase-worker-retained-hot-buffer-publication.v0';
export const ULG_PRESSURE_INTERFACE_WORKER_RETAINED_BUFFER_IMPORT_SCHEMA = 'peercompute.ulg.pressure-interface-worker-retained-buffer-import.v0';
export const ULG_PRESSURE_INTERFACE_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA = 'peercompute.ulg.pressure-interface-worker-retained-hot-buffer-publication.v0';
export const ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_HOT_BUFFER_PUBLICATION_SCHEMA = 'peercompute.ulg.pressure-interface-gas-cell-field-admission-hot-buffer-publication.v0';
export const ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_HOT_BUFFER_PUBLICATION_SCHEMA = 'peercompute.ulg.pressure-interface-gas-cell-field-import-hot-buffer-publication.v0';
export const ULG_REACTION_PRODUCT_WORKER_RETAINED_BUFFER_IMPORT_SCHEMA = 'peercompute.ulg.reaction-product-worker-retained-buffer-import.v0';
export const ULG_REACTION_PRODUCT_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA = 'peercompute.ulg.reaction-product-worker-retained-hot-buffer-publication.v0';
export const ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_POST_STAGE_SEED_NODE_SCHEMA = 'peercompute.ulg.remote-task-graph-sph-mls-mpm-post-stage-seed-node.v0';
export const ULG_RESIDENT_LAW_GRAPH_ID = 'peercompute.ulg.local-sph-law-closure-graph';
export const ULG_RESIDENT_PASS_DAG_SOLVER_ID = 'ulg-mls-mpm-sph-resident-steps';
export const ULG_RESIDENT_PASS_DAG_NODE_ID = 'ulg-mls-mpm-sph-resident-pass-dag';
export const ULG_RESIDENT_LAW_FAMILY_METADATA_SCOPE = 'ulg-sph-law-family-metadata';

export const DEFAULT_PEERCOMPUTE_BROWSER_MODULE_URL = '/@fs/home/cos/projects/peercompute/peercompute/src/peercompute/index.js';
export const DEFAULT_PEERCOMPUTE_NODE_KERNEL_MODULE_URL = '/@fs/home/cos/projects/peercompute/peercompute/src/peercompute/nodeKernel/NodeKernel.js';
export const DEFAULT_PEERCOMPUTE_COMPUTE_MANAGER_MODULE_URL = '/@fs/home/cos/projects/peercompute/peercompute/src/peercompute/computeManager/ComputeManager.js';
export const DEFAULT_PEERCOMPUTE_STATE_MANAGER_MODULE_URL = '/@fs/home/cos/projects/peercompute/peercompute/src/peercompute/stateManager/StateManager.js';
export const DEFAULT_PEERCOMPUTE_GPU_HUB_MODULE_URL = '/@fs/home/cos/projects/peercompute/peercompute/src/peercompute/gpu/GPUHubManager.js';
export const DEFAULT_PEERCOMPUTE_REMOTE_RESULT_QUORUM_MODULE_URL = '/@fs/home/cos/projects/peercompute/peercompute/src/peercompute/computeManager/RemoteResultQuorumValidator.js';
export const DEFAULT_ULG_RESIDENT_COMPUTE_TASK_MODULE_PATH = '/src/runtime/sph/sphMlsMpmGpuStep.js';
export const DEFAULT_ULG_MECHANICS_RESIDENT_STAGE_WORKER_MODULE_PATH = '/src/services/ulgMechanicsResidentStage.worker.js';
export const DEFAULT_ULG_MECHANICS_PROMOTION_EVIDENCE_MODULE_PATH = '/src/runtime/mechanicsPromotionEvidence.js';

let sharedHostPromise = null;
let sharedHost = null;

function nowMs() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

function shortId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeString(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

function normalizePositiveInteger(value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function uniqueStringList(values = []) {
  return Array.from(new Set(normalizeStringList(values)));
}

function firstNonEmptyStringList(...candidates) {
  for (const candidate of candidates) {
    const values = uniqueStringList(candidate);
    if (values.length > 0) return values;
  }
  return [];
}

function retainedGasCellFieldSourceFrom(value = null) {
  if (!value || typeof value !== 'object') return null;
  const candidate = value.schema === ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA
    ? value
    : (value.retainedGasCellFieldSource
        || value.pressureInterfaceRetainedGasCellFieldSource
        || value.workerRetainedBufferImport?.retainedGasCellFieldSource
        || value.pressureInterfaceGasCellFieldImport?.retainedGasCellFieldSource
        || value.pressureInterfaceGasCellFieldAdmission?.retainedGasCellFieldSource
        || null);
  if (
    candidate?.schema === ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA
    && candidate?.status === 'pressure-interface-retained-gas-cell-field-source-ready'
  ) {
    return candidate;
  }
  return null;
}

function cloneSerializableValue(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function normalizeRemoteSeedPayload(payload = {}) {
  const state = payload?.state || payload?.sphState || null;
  if (!state || !Array.isArray(state.particles)) {
    throw new TypeError('ULG remote task-graph seed payload requires state.particles');
  }
  return {
    schema: payload.schema || ULG_REMOTE_TASK_GRAPH_STATE_SEED_PAYLOAD_SCHEMA,
    cacheKey: normalizeString(payload.cacheKey, null),
    stateKey: normalizeString(payload.stateKey, null),
    state,
    materialProperties: payload.materialProperties || {},
    initialParticleSpacing: payload.initialParticleSpacing || state.initialParticleSpacing || null,
    step: payload.step ?? state.step ?? 0,
    time: payload.time ?? state.time ?? 0
  };
}

function bufferByteLength(value) {
  return Number.isFinite(value?.byteLength) ? value.byteLength : 0;
}

function makeHotBufferKey({ hotBufferKey = null, hotBufferKeyPrefix = null, cacheKey = null, stateKey = null, lease = null } = {}) {
  const explicit = normalizeString(hotBufferKey, null);
  if (explicit) return explicit;
  const prefix = normalizeString(hotBufferKeyPrefix, 'ulg:remote-task-graph-hot-buffers');
  const key = normalizeString(cacheKey, null)
    || normalizeString(stateKey, null)
    || normalizeString(lease?.stateKey, null)
    || normalizeString(lease?.leaseId, null)
    || shortId();
  return `${prefix}:${key}`;
}

export function defaultSphMlsMpmSeedRefreshFamilies() {
  return [
    RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
    RESIDENT_STATE_FAMILIES.MECHANICS,
    RESIDENT_STATE_FAMILIES.THERMO_PHASE
  ];
}

function defaultRemoteRetainedBufferRefs(stateKey) {
  const key = normalizeString(stateKey, 'remote-state:ulg-sph-mls-mpm');
  return [
    `${key}:sph-state-buffer`,
    `${key}:sph-thermo-buffer`,
    `${key}:mls-mpm-mechanics-buffer`
  ];
}

function numericBufferView(value) {
  if (ArrayBuffer.isView(value)) return value;
  if (Array.isArray(value)) return Float32Array.from(value);
  return value;
}

function normalizePackedSphParticleState(packed = null) {
  if (!packed || typeof packed !== 'object') return packed;
  return {
    ...packed,
    state: numericBufferView(packed.state),
    thermo: numericBufferView(packed.thermo)
  };
}

function normalizePackedMlsMpmParticleState(packed = null) {
  if (!packed || typeof packed !== 'object') return packed;
  return {
    ...packed,
    mechanics: numericBufferView(packed.mechanics)
  };
}

function finiteSeedNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finiteSeedVector3(value, fallback) {
  const source = Array.isArray(value) ? value : fallback;
  return [0, 1, 2].map((index) => finiteSeedNumber(source?.[index], fallback[index]));
}

function remoteMechanicsStageOptionsFromState(state, sphParticleState = null, mlsMpmParticleState = null) {
  const mechanics = state?.gpuMechanics || {};
  return {
    dt: finiteSeedNumber(mechanics.dt, 5e-4),
    boxDimsM: finiteSeedVector3(state?.boxDimsM || state?.box?.dimensionsM || mechanics.boxDimsM, [5, 5, 5]),
    gravityMPerS2: finiteSeedVector3(mechanics.gravityMPerS2, [0, -9.80665, 0]),
    cflFactor: finiteSeedNumber(mechanics.gridCflFactor, 0.4),
    gridSpacingM: finiteSeedNumber(mechanics.gridSpacingM, sphParticleState?.smoothingLengthM || state?.smoothingLengthM || 0.5)
  };
}

function particlesFromDecodedSphMlsMpmRows(sourceParticles, sphRows, mechanicsRows, label = 'state seed') {
  if (sphRows.length !== sourceParticles.length || mechanicsRows.length !== sourceParticles.length) {
    throw new Error(`${label} particle count mismatch`);
  }
  return sourceParticles.map((particle, index) => {
    const sph = sphRows[index];
    const mechanics = mechanicsRows[index];
    return {
      ...particle,
      x: sph.positionM.map((value, axis) => finiteSeedNumber(value, particle.x?.[axis] ?? 0)),
      v: sph.velocityMPerS.map((value, axis) => finiteSeedNumber(value, particle.v?.[axis] ?? 0)),
      massKg: finiteSeedNumber(sph.massKg, particle.massKg),
      specificInternalEnergyJPerKg: finiteSeedNumber(
        sph.specificInternalEnergyJPerKg,
        particle.specificInternalEnergyJPerKg
      ),
      restDensityKgPerM3: finiteSeedNumber(sph.restDensityKgPerM3, particle.restDensityKgPerM3),
      mpmF: mechanics.deformationF.map((value, entryIndex) => finiteSeedNumber(value, particle.mpmF?.[entryIndex] ?? (entryIndex % 4 === 0 ? 1 : 0))),
      mpmC: mechanics.affineC.map((value, entryIndex) => finiteSeedNumber(value, particle.mpmC?.[entryIndex] ?? 0)),
      mpmJ: finiteSeedNumber(mechanics.volumeRatioJ, particle.mpmJ ?? 1),
      mpmVolume0: finiteSeedNumber(mechanics.restVolumeM3, particle.mpmVolume0),
      mpmSolid: mechanics.solidFlag >= 0.5,
      hydrostaticPressurePa: finiteSeedNumber(mechanics.hydrostaticPressurePa, particle.hydrostaticPressurePa ?? 0),
      dynamicViscosityPaS: finiteSeedNumber(mechanics.dynamicViscosityPaS, particle.dynamicViscosityPaS ?? 0),
      surfaceTensionNPerM: finiteSeedNumber(mechanics.surfaceTensionNPerM, particle.surfaceTensionNPerM ?? 0)
    };
  });
}

function buildPostStageSeedState({ stateSeedPayload, residentStageResult } = {}) {
  const initialPayload = normalizeRemoteSeedPayload(stateSeedPayload);
  const nextSphParticleState = normalizePackedSphParticleState(residentStageResult?.nextSphParticleState);
  const nextMlsMpmParticleState = normalizePackedMlsMpmParticleState(residentStageResult?.nextMlsMpmParticleState);
  if (!nextSphParticleState || !nextMlsMpmParticleState) {
    throw new Error('post-stage seed requires resident result nextSphParticleState and nextMlsMpmParticleState');
  }
  if (nextSphParticleState.cpuStateStale === true || nextMlsMpmParticleState.cpuStateStale === true) {
    throw new Error('post-stage seed cannot be derived from stale no-full-readback CPU mirrors');
  }
  const sphRows = decodeSphGpuParticleRows(nextSphParticleState);
  const mechanicsRows = decodeMlsMpmGpuParticleRows(nextMlsMpmParticleState);
  const sourceParticles = initialPayload.state.particles || [];
  const particles = particlesFromDecodedSphMlsMpmRows(sourceParticles, sphRows, mechanicsRows, 'post-stage seed');
  return {
    ...initialPayload.state,
    status: 'remote-post-stage-full-readback-seed-ready',
    step: nextSphParticleState.step ?? nextMlsMpmParticleState.step ?? residentStageResult?.finalStep?.particlePingPong?.nextStep ?? initialPayload.step,
    time: nextSphParticleState.time ?? nextMlsMpmParticleState.time ?? residentStageResult?.finalStep?.particlePingPong?.nextTime ?? initialPayload.time,
    particles
  };
}

function buildMechanicsStageSeedState({ stateSeedPayload, mechanicsG2pResult } = {}) {
  const initialPayload = normalizeRemoteSeedPayload(stateSeedPayload);
  const sourceSph = buildSphGpuParticleBuffers(initialPayload.state, {
    materialProperties: initialPayload.materialProperties,
    initialParticleSpacing: initialPayload.initialParticleSpacing
  });
  const sourceMlsMpm = buildMlsMpmGpuParticleBuffers(initialPayload.state, {
    materialProperties: initialPayload.materialProperties,
    initialParticleSpacing: initialPayload.initialParticleSpacing
  });
  const nextState = numericBufferView(mechanicsG2pResult?.state);
  const nextMechanics = numericBufferView(mechanicsG2pResult?.mechanics);
  if (!(nextState instanceof Float32Array) || !(nextMechanics instanceof Float32Array)) {
    throw new Error('mechanics stage seed requires full-readback G2P state and mechanics arrays');
  }
  if (mechanicsG2pResult?.fullReadbackPerformed === false || mechanicsG2pResult?.normalHotLoopReadbackFree === true) {
    throw new Error('mechanics stage seed cannot be derived from no-full-readback G2P output');
  }
  if (nextState.length !== sourceSph.state.length || nextMechanics.length !== sourceMlsMpm.mechanics.length) {
    throw new Error('mechanics stage seed G2P output length mismatch');
  }
  const nextSphParticleState = normalizePackedSphParticleState({
    ...sourceSph,
    state: nextState,
    step: initialPayload.step + 1,
    time: initialPayload.time + finiteSeedNumber(mechanicsG2pResult?.dt, 0)
  });
  const nextMlsMpmParticleState = normalizePackedMlsMpmParticleState({
    ...sourceMlsMpm,
    mechanics: nextMechanics,
    step: nextSphParticleState.step,
    time: nextSphParticleState.time
  });
  const sphRows = decodeSphGpuParticleRows(nextSphParticleState);
  const mechanicsRows = decodeMlsMpmGpuParticleRows(nextMlsMpmParticleState);
  const particles = particlesFromDecodedSphMlsMpmRows(
    initialPayload.state.particles || [],
    sphRows,
    mechanicsRows,
    'mechanics stage seed'
  );
  return {
    ...initialPayload.state,
    status: 'remote-mechanics-stage-full-readback-seed-ready',
    step: nextSphParticleState.step,
    time: nextSphParticleState.time,
    particles
  };
}

function mechanicsStageCompactOutputAvailable(mechanicsG2pResult = {}) {
  return Boolean(
    mechanicsG2pResult?.stateBuffer
      || mechanicsG2pResult?.mechanicsBuffer
      || finiteSeedNumber(mechanicsG2pResult?.stateBufferByteLength, 0) > 0
      || finiteSeedNumber(mechanicsG2pResult?.mechanicsBufferByteLength, 0) > 0
      || mechanicsG2pResult?.mechanicsG2pStageTaskEvidence?.outputBuffersRetained === true
  );
}

function buildCompactMechanicsStageSeedCandidate({
  stateSeedPayload,
  mechanicsG2pResult,
  stateFamilies = null,
  retainedBufferRefs = null,
  sourceNodeId = 'ulg-sph-mls-mpm-mechanics-g2p'
} = {}) {
  const initialPayload = normalizeRemoteSeedPayload(stateSeedPayload);
  const outputStateFamilies = [
    RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
    RESIDENT_STATE_FAMILIES.MECHANICS
  ];
  const resolvedStateFamilies = uniqueStringList(stateFamilies || outputStateFamilies)
    .filter((family) => outputStateFamilies.includes(family));
  const resolvedRetainedBufferRefs = uniqueStringList(
    retainedBufferRefs || defaultRemoteRetainedBufferRefs(initialPayload.stateKey)
  );
  const particleCount = finiteSeedNumber(
    mechanicsG2pResult?.particleCount,
    initialPayload.state.particles.length
  );
  const step = finiteSeedNumber(mechanicsG2pResult?.step, initialPayload.step + 1);
  const time = finiteSeedNumber(
    mechanicsG2pResult?.time,
    initialPayload.time + finiteSeedNumber(mechanicsG2pResult?.dt, 0)
  );
  const stateBufferByteLength = finiteSeedNumber(mechanicsG2pResult?.stateBufferByteLength, 0);
  const mechanicsBufferByteLength = finiteSeedNumber(mechanicsG2pResult?.mechanicsBufferByteLength, 0);
  const sameDeviceRetainedBufferImport = (
    mechanicsG2pResult?.sameDeviceRetainedBufferImport
    || mechanicsG2pResult?.localSameDeviceRetainedBufferImport
    || null
  );
  const sameDeviceSourceHotBufferKey = normalizeString(
    sameDeviceRetainedBufferImport?.sourceHotBufferKey
      || sameDeviceRetainedBufferImport?.hotBufferKey
      || sameDeviceRetainedBufferImport?.hotBufferRecordKey,
    null
  );
  const gpuFenceSatisfied = mechanicsG2pResult?.gpuFence?.fenceSatisfied === true
    || mechanicsG2pResult?.gpuFenceReport?.fenceSatisfied === true
    || false;
  const compactHash = hashPayload({
    schema: ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_MECHANICS_STAGE_COMPACT_SEED_SCHEMA,
    cacheKey: initialPayload.cacheKey,
    stateKey: initialPayload.stateKey,
    sourceNodeId,
    sourceResultSchema: mechanicsG2pResult?.computeTaskResultSchema || null,
    backend: mechanicsG2pResult?.backend || null,
    readbackMode: mechanicsG2pResult?.readbackMode || null,
    particleCount,
    step,
    time,
    stateFamilies: resolvedStateFamilies,
    retainedBufferRefs: resolvedRetainedBufferRefs,
    stateBufferByteLength,
    mechanicsBufferByteLength,
    sameDeviceSourceHotBufferKey,
    gpuFenceSatisfied
  });
  const hasSameDeviceLocalSource = Boolean(
    sameDeviceRetainedBufferImport
    && sameDeviceRetainedBufferImport.sameDevice === true
    && sameDeviceSourceHotBufferKey
  );
  return {
    schema: ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_MECHANICS_STAGE_COMPACT_SEED_SCHEMA,
    status: 'mechanics-stage-compact-output-ready',
    reason: 'compact-mechanics-stage-output-awaits-state-manager-admission-and-local-refresh',
    cacheKey: initialPayload.cacheKey,
    stateKey: initialPayload.stateKey,
    sourceNodeId,
    sourceResultSchema: mechanicsG2pResult?.computeTaskResultSchema || null,
    sourceBackend: mechanicsG2pResult?.backend || null,
    sourceReadbackMode: mechanicsG2pResult?.readbackMode || null,
    particleCount,
    step,
    time,
    hash: compactHash,
    derivationMode: 'mechanics-g2p-compact-retained-output-candidate',
    stateFamilies: resolvedStateFamilies,
    retainedBufferRefs: resolvedRetainedBufferRefs,
    outputBuffers: {
      stateBufferRetained: Boolean(mechanicsG2pResult?.stateBuffer || stateBufferByteLength > 0),
      mechanicsBufferRetained: Boolean(mechanicsG2pResult?.mechanicsBuffer || mechanicsBufferByteLength > 0),
      sameDeviceRetainedBufferImportAvailable: hasSameDeviceLocalSource,
      stateBufferByteLength,
      mechanicsBufferByteLength
    },
    ...(hasSameDeviceLocalSource ? {
      sameDeviceRetainedBufferImport: {
        schema: sameDeviceRetainedBufferImport.schema || ULG_REMOTE_TASK_GRAPH_SAME_DEVICE_RETAINED_BUFFER_IMPORT_SCHEMA,
        ...sameDeviceRetainedBufferImport,
        sourceHotBufferKey: sameDeviceSourceHotBufferKey,
        sameDevice: true
      }
    } : {}),
    localRefreshContract: {
      schema: ULG_REMOTE_TASK_GRAPH_COMPACT_LOCAL_REFRESH_CONTRACT_SCHEMA,
      status: hasSameDeviceLocalSource
        ? 'same-device-local-source-ready'
        : 'local-source-materialization-required',
      reason: hasSameDeviceLocalSource
        ? 'compact-candidate-carries-explicit-same-device-local-source'
        : 'compact-candidate-carries-remote-retained-refs-not-local-buffer-handles',
      sourceMode: 'compact-candidate',
      requiredStateFamilies: resolvedStateFamilies,
      requiredLocalSources: [
        {
          family: RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
          role: 'sph-state-buffer',
          byteLength: stateBufferByteLength,
          remoteRetainedBufferRefs: resolvedRetainedBufferRefs
        },
        {
          family: RESIDENT_STATE_FAMILIES.MECHANICS,
          role: 'mls-mpm-mechanics-buffer',
          byteLength: mechanicsBufferByteLength,
          remoteRetainedBufferRefs: resolvedRetainedBufferRefs
        }
      ],
      acceptedMaterializationModes: [
        'same-device-retained-buffer-import',
        'validated-compact-buffer-snapshot',
        'validated-local-state-seed'
      ],
      availableLocalSources: hasSameDeviceLocalSource
        ? [
            {
              mode: 'same-device-retained-buffer-import',
              schema: sameDeviceRetainedBufferImport.schema || ULG_REMOTE_TASK_GRAPH_SAME_DEVICE_RETAINED_BUFFER_IMPORT_SCHEMA,
              sourceHotBufferKey: sameDeviceSourceHotBufferKey,
              sameDevice: true
            }
          ]
        : [],
      remoteRetainedRefsUsableLocally: false,
      localSourceRequired: !hasSameDeviceLocalSource
    },
    gpuFenceSatisfied,
    fullReadbackPerformed: mechanicsG2pResult?.fullReadbackPerformed === true,
    normalHotLoopReadbackFree: mechanicsG2pResult?.normalHotLoopReadbackFree === true,
    admissionRequired: true,
    localRefreshRequired: true,
    refreshableByDefault: false,
    authoritativeByDefault: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function runUlgRemoteSphMlsMpmStateSeedGraphNode(input = {}) {
  const stateSeedPayload = normalizeRemoteSeedPayload(input.stateSeedPayload || input);
  const stateFamilies = uniqueStringList(input.stateFamilies || defaultSphMlsMpmSeedRefreshFamilies());
  const retainedBufferRefs = uniqueStringList(
    input.retainedBufferRefs || defaultRemoteRetainedBufferRefs(stateSeedPayload.stateKey)
  );
  return {
    schema: ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_SEED_NODE_SCHEMA,
    status: 'remote-sph-mls-mpm-state-seed-ready',
    cacheKey: stateSeedPayload.cacheKey,
    stateKey: stateSeedPayload.stateKey,
    sourceSchema: stateSeedPayload.schema,
    particleCount: stateSeedPayload.state.particles.length,
    step: stateSeedPayload.step,
    time: stateSeedPayload.time,
    stateFamilies,
    retainedBufferRefs,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function runUlgRemoteSphMlsMpmMechanicsStageSeedGraphNode(input = {}) {
  const stateSeedPayload = normalizeRemoteSeedPayload(input.stateSeedPayload || input);
  const mechanicsG2pResult = input.mechanicsG2pResult
    || input.g2pStageResult
    || input.nodeResults?.['ulg-sph-mls-mpm-mechanics-g2p']
    || null;
  if (!mechanicsG2pResult || typeof mechanicsG2pResult !== 'object') {
    throw new Error('mechanics stage seed node requires mechanicsG2pResult');
  }
  if (
    mechanicsG2pResult.computeTaskResultSchema
    && mechanicsG2pResult.computeTaskResultSchema !== ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_RESULT_SCHEMA
  ) {
    throw new Error(`mechanics stage seed node received unexpected G2P result schema: ${mechanicsG2pResult.computeTaskResultSchema}`);
  }
  const hasFullReadbackArrays = numericBufferView(mechanicsG2pResult?.state) instanceof Float32Array
    && numericBufferView(mechanicsG2pResult?.mechanics) instanceof Float32Array
    && mechanicsG2pResult?.fullReadbackPerformed !== false
    && mechanicsG2pResult?.normalHotLoopReadbackFree !== true;
  if (!hasFullReadbackArrays) {
    if (!mechanicsStageCompactOutputAvailable(mechanicsG2pResult)) {
      throw new Error('mechanics stage seed requires full-readback G2P arrays or retained compact G2P output buffers');
    }
    const compactMechanicsStageSeed = buildCompactMechanicsStageSeedCandidate({
      stateSeedPayload,
      mechanicsG2pResult,
      stateFamilies: input.stateFamilies,
      retainedBufferRefs: input.retainedBufferRefs,
      sourceNodeId: input.sourceNodeId || 'ulg-sph-mls-mpm-mechanics-g2p'
    });
    return {
      schema: ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_MECHANICS_STAGE_SEED_NODE_SCHEMA,
      status: 'remote-sph-mls-mpm-mechanics-stage-compact-seed-not-refreshable',
      reason: compactMechanicsStageSeed.reason,
      cacheKey: stateSeedPayload.cacheKey,
      stateKey: stateSeedPayload.stateKey,
      sourceSchema: stateSeedPayload.schema,
      particleCount: compactMechanicsStageSeed.particleCount,
      step: compactMechanicsStageSeed.step,
      time: compactMechanicsStageSeed.time,
      hash: compactMechanicsStageSeed.hash,
      stateFamilies: compactMechanicsStageSeed.stateFamilies,
      retainedBufferRefs: compactMechanicsStageSeed.retainedBufferRefs,
      compactMechanicsStageSeed,
      stateSeedPayload: null,
      refreshableByDefault: false,
      authoritativeByDefault: false,
      mechanicsStage: {
        nodeId: compactMechanicsStageSeed.sourceNodeId,
        computeTaskResultSchema: compactMechanicsStageSeed.sourceResultSchema,
        backend: compactMechanicsStageSeed.sourceBackend,
        readbackMode: compactMechanicsStageSeed.sourceReadbackMode,
        fullReadbackPerformed: false,
        compactOutputReady: true,
        localRefreshRequired: true,
        admissionRequired: true
      },
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  const mechanicsStageState = buildMechanicsStageSeedState({
    stateSeedPayload,
    mechanicsG2pResult
  });
  const mechanicsStageSeedHash = hashPayload({
    schema: ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_MECHANICS_STAGE_SEED_NODE_SCHEMA,
    cacheKey: stateSeedPayload.cacheKey,
    stateKey: stateSeedPayload.stateKey,
    step: mechanicsStageState.step,
    time: mechanicsStageState.time,
    state: mechanicsStageState
  });
  const mechanicsStageSeedPayload = {
    ...stateSeedPayload,
    state: mechanicsStageState,
    step: mechanicsStageState.step,
    time: mechanicsStageState.time,
    mechanicsStageSeed: {
      schema: ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_MECHANICS_STAGE_SEED_NODE_SCHEMA,
      status: 'mechanics-stage-state-seed-derived',
      sourceNodeId: input.sourceNodeId || 'ulg-sph-mls-mpm-mechanics-g2p',
      sourceResultSchema: mechanicsG2pResult.computeTaskResultSchema || null,
      sourceBackend: mechanicsG2pResult.backend || null,
      sourceReadbackMode: mechanicsG2pResult.readbackMode || null,
      hash: mechanicsStageSeedHash,
      derivationMode: 'mechanics-g2p-full-readback-candidate',
      authoritativeByDefault: false,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    }
  };
  const stateFamilies = uniqueStringList(input.stateFamilies || defaultSphMlsMpmSeedRefreshFamilies());
  const retainedBufferRefs = uniqueStringList(
    input.retainedBufferRefs || defaultRemoteRetainedBufferRefs(stateSeedPayload.stateKey)
  );
  return {
    schema: ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_MECHANICS_STAGE_SEED_NODE_SCHEMA,
    status: 'remote-sph-mls-mpm-mechanics-stage-state-seed-ready',
    cacheKey: stateSeedPayload.cacheKey,
    stateKey: stateSeedPayload.stateKey,
    sourceSchema: stateSeedPayload.schema,
    particleCount: mechanicsStageState.particles.length,
    step: mechanicsStageState.step,
    time: mechanicsStageState.time,
    hash: mechanicsStageSeedHash,
    stateFamilies,
    retainedBufferRefs,
    mechanicsStage: {
      nodeId: input.sourceNodeId || 'ulg-sph-mls-mpm-mechanics-g2p',
      computeTaskResultSchema: mechanicsG2pResult.computeTaskResultSchema || null,
      backend: mechanicsG2pResult.backend || null,
      readbackMode: mechanicsG2pResult.readbackMode || null,
      fullReadbackPerformed: mechanicsG2pResult.fullReadbackPerformed !== false
    },
    stateSeedPayload: mechanicsStageSeedPayload,
    authoritativeByDefault: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function runUlgRemoteSphMlsMpmPostStageSeedGraphNode(input = {}) {
  const stateSeedPayload = normalizeRemoteSeedPayload(input.stateSeedPayload || input);
  const residentStageResult = input.residentStageResult
    || input.residentResult
    || input.nodeResults?.['ulg-sph-mls-mpm-resident-steps']
    || null;
  if (!residentStageResult || typeof residentStageResult !== 'object') {
    throw new Error('post-stage seed node requires residentStageResult');
  }
  if (
    residentStageResult.computeTaskResultSchema
    && residentStageResult.computeTaskResultSchema !== ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_RESULT_SCHEMA
  ) {
    throw new Error(`post-stage seed node received unexpected resident result schema: ${residentStageResult.computeTaskResultSchema}`);
  }
  const postStageState = buildPostStageSeedState({
    stateSeedPayload,
    residentStageResult
  });
  const postStageSeedHash = hashPayload({
    schema: ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_POST_STAGE_SEED_NODE_SCHEMA,
    cacheKey: stateSeedPayload.cacheKey,
    stateKey: stateSeedPayload.stateKey,
    step: postStageState.step,
    time: postStageState.time,
    state: postStageState
  });
  const postStageSeedPayload = {
    ...stateSeedPayload,
    state: postStageState,
    step: postStageState.step,
    time: postStageState.time,
    postStageSeed: {
      schema: ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_POST_STAGE_SEED_NODE_SCHEMA,
      status: 'post-stage-state-seed-derived',
      sourceNodeId: input.sourceNodeId || 'ulg-sph-mls-mpm-resident-steps',
      sourceResultSchema: residentStageResult.computeTaskResultSchema || null,
      sourceBackend: residentStageResult.backend || null,
      sourceReadbackMode: residentStageResult.readbackMode || null,
      completedStepCount: residentStageResult.completedStepCount ?? null,
      hash: postStageSeedHash,
      derivationMode: 'resident-stage-full-readback-transitional',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    }
  };
  const stateFamilies = uniqueStringList(input.stateFamilies || defaultSphMlsMpmSeedRefreshFamilies());
  const retainedBufferRefs = uniqueStringList(
    input.retainedBufferRefs || defaultRemoteRetainedBufferRefs(stateSeedPayload.stateKey)
  );
  return {
    schema: ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_POST_STAGE_SEED_NODE_SCHEMA,
    status: 'remote-sph-mls-mpm-post-stage-state-seed-ready',
    cacheKey: stateSeedPayload.cacheKey,
    stateKey: stateSeedPayload.stateKey,
    sourceSchema: stateSeedPayload.schema,
    particleCount: postStageState.particles.length,
    step: postStageState.step,
    time: postStageState.time,
    hash: postStageSeedHash,
    stateFamilies,
    retainedBufferRefs,
    residentStage: {
      nodeId: input.sourceNodeId || 'ulg-sph-mls-mpm-resident-steps',
      computeTaskResultSchema: residentStageResult.computeTaskResultSchema || null,
      backend: residentStageResult.backend || null,
      readbackMode: residentStageResult.readbackMode || null,
      completedStepCount: residentStageResult.completedStepCount ?? null,
      gpuFenceSatisfied: residentStageResult.gpuFence?.fenceSatisfied === true
        || residentStageResult.gpuFenceReport?.fenceSatisfied === true
        || false
    },
    stateSeedPayload: postStageSeedPayload,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function remoteGraphCompactMechanicsStageCandidate(result = null) {
  const mechanicsStage = result?.nodeResults?.['ulg-sph-mls-mpm-mechanics-stage-state-seed'];
  return mechanicsStage?.compactMechanicsStageSeed || null;
}

export function selectRemoteGraphRefreshSeedPayload(result = null, options = {}) {
  const compactMechanicsStageCandidate = remoteGraphCompactMechanicsStageCandidate(result);
  const explicit = options?.validatedStateSeedPayload
    || options?.stateSeedPayloadOverride
    || null;
  if (explicit) {
    return {
      payload: normalizeRemoteSeedPayload(explicit),
      source: 'caller-validated-override',
      compactMechanicsStageCandidate
    };
  }
  if (options?.preferMechanicsStageSeed === true) {
    const mechanicsStage = result?.nodeResults?.['ulg-sph-mls-mpm-mechanics-stage-state-seed'];
    if (mechanicsStage?.stateSeedPayload) {
      return {
        payload: normalizeRemoteSeedPayload(mechanicsStage.stateSeedPayload),
        source: 'remote-mechanics-stage-state-seed-node',
        compactMechanicsStageCandidate
      };
    }
    if (compactMechanicsStageCandidate) {
      return {
        payload: null,
        source: 'remote-mechanics-stage-compact-seed-not-refreshable',
        compactMechanicsStageCandidate,
        blockRefresh: true,
        reason: 'mechanics-stage-compact-seed-requires-admitted-local-refresh-before-hot-buffer-refresh'
      };
    }
  }
  const postStage = result?.nodeResults?.['ulg-sph-mls-mpm-post-stage-state-seed'];
  if (postStage?.stateSeedPayload) {
    return {
      payload: normalizeRemoteSeedPayload(postStage.stateSeedPayload),
      source: 'remote-post-stage-state-seed-node',
      compactMechanicsStageCandidate
    };
  }
  return {
    payload: null,
    source: 'remote-cache-artifact-policy',
    compactMechanicsStageCandidate
  };
}

export function buildUlgSphMlsMpmRemoteSeedTaskGraph({
  state,
  materialProperties = {},
  initialParticleSpacing = null,
  graphId = null,
  cacheKey = null,
  stateKey = null,
  placementPolicy = null,
  targetPeerIds = null,
  cacheMode = 'record-only',
  seedTaskModulePath = '/src/runtime/peercomputeBrowserResidentHost.js',
  seedTaskExportName = 'runUlgRemoteSphMlsMpmStateSeedGraphNode',
  postStageSeedTaskModulePath = seedTaskModulePath,
  postStageSeedTaskExportName = 'runUlgRemoteSphMlsMpmPostStageSeedGraphNode',
  stateFamilies = defaultSphMlsMpmSeedRefreshFamilies(),
  retainedBufferRefs = null,
  readFamilies = null,
  writeFamilies = null,
  lawIds = null,
  extraCacheValues = null,
  includeResidentComputeStage = false,
  includePostStageSeed = false,
  residentTaskModulePath = DEFAULT_ULG_RESIDENT_COMPUTE_TASK_MODULE_PATH,
  includeMechanicsStageChain = false,
  includeMechanicsStageSeed = false,
  mechanicsStageTaskModulePath = residentTaskModulePath,
  mechanicsStageSeedTaskModulePath = seedTaskModulePath,
  mechanicsStageSeedTaskExportName = 'runUlgRemoteSphMlsMpmMechanicsStageSeedGraphNode',
  mechanicsStageReadbackMode = 'full-parity-readback',
  mechanicsStagePreferWebGpu = false,
  residentStepCount = 1,
  residentReadbackMode = 'full-parity-readback',
  residentPreferWebGpu = true,
  residentRequireGpuFence = false
} = {}) {
  if (includePostStageSeed && !includeResidentComputeStage) {
    throw new Error('includePostStageSeed requires includeResidentComputeStage');
  }
  if (includeMechanicsStageSeed && !includeMechanicsStageChain) {
    throw new Error('includeMechanicsStageSeed requires includeMechanicsStageChain');
  }
  const seedInput = normalizeRemoteSeedPayload({
    schema: ULG_REMOTE_TASK_GRAPH_STATE_SEED_PAYLOAD_SCHEMA,
    state,
    materialProperties,
    initialParticleSpacing,
    cacheKey,
    stateKey
  });
  const normalizedStateFamilies = uniqueStringList(stateFamilies);
  const seedHash = hashPayload({
    schema: ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_GRAPH_SCHEMA,
    state: seedInput.state,
    materialProperties: seedInput.materialProperties,
    initialParticleSpacing: seedInput.initialParticleSpacing,
    stateFamilies: normalizedStateFamilies,
    step: seedInput.step,
    time: seedInput.time
  });
  const resolvedCacheKey = normalizeString(cacheKey, `ulg-sph-mls-mpm-remote-seed:${seedHash}`);
  const resolvedStateKey = normalizeString(stateKey, `remote-state:ulg-sph-mls-mpm:${seedHash}`);
  const stateSeedPayload = {
    ...seedInput,
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey
  };
  const resolvedGraphId = normalizeString(graphId, `ulg-sph-mls-mpm-remote-seed:${seedHash}`);
  const resolvedRetainedBufferRefs = uniqueStringList(
    retainedBufferRefs || defaultRemoteRetainedBufferRefs(resolvedStateKey)
  );
  const resolvedPlacementPolicy = {
    requestedPlacement: 'peer',
    advisory: false,
    admitRemoteTaskGraphCacheArtifact: true,
    ...(placementPolicy || {})
  };
  if (Array.isArray(targetPeerIds) || typeof targetPeerIds === 'string') {
    resolvedPlacementPolicy.targetPeerIds = uniqueStringList(targetPeerIds);
  }
  const resolvedReadFamilies = uniqueStringList(readFamilies || normalizedStateFamilies);
  const resolvedWriteFamilies = uniqueStringList(writeFamilies || normalizedStateFamilies);
  const nodes = [{
    id: 'ulg-sph-mls-mpm-state-seed',
    task: {
      id: `${resolvedGraphId}:state-seed`,
      runtime: 'js',
      taskFamily: 'ulg-sph-mls-mpm-remote-state-seed',
      solverId: ULG_RESIDENT_PASS_DAG_SOLVER_ID,
      module: seedTaskModulePath,
      exportName: seedTaskExportName,
      data: {
        stateSeedPayload,
        stateFamilies: normalizedStateFamilies,
        retainedBufferRefs: resolvedRetainedBufferRefs
      }
    }
  }];
  let sphParticleState = null;
  let mlsMpmParticleState = null;
  if (includeResidentComputeStage || includeMechanicsStageChain) {
    sphParticleState = buildSphGpuParticleBuffers(stateSeedPayload.state, {
      materialProperties: stateSeedPayload.materialProperties,
      initialParticleSpacing: stateSeedPayload.initialParticleSpacing
    });
    mlsMpmParticleState = buildMlsMpmGpuParticleBuffers(stateSeedPayload.state, {
      materialProperties: stateSeedPayload.materialProperties,
      initialParticleSpacing: stateSeedPayload.initialParticleSpacing
    });
  }
  if (includeMechanicsStageChain) {
    const mechanicsOptions = remoteMechanicsStageOptionsFromState(
      stateSeedPayload.state,
      sphParticleState,
      mlsMpmParticleState
    );
    nodes.push({
      id: 'ulg-sph-mls-mpm-mechanics-p2g',
      dependsOn: ['ulg-sph-mls-mpm-state-seed'],
      cacheInput: {
        stage: 'mechanics-p2g',
        evidenceOnly: true,
        reads: ['sph-particle-state', 'mls-mpm-mechanics'],
        writes: ['mls-mpm-grid'],
        readbackMode: mechanicsStageReadbackMode
      },
      task: createMlsMpmMechanicsP2gStageComputeTask({
        modulePath: mechanicsStageTaskModulePath,
        taskId: `${resolvedGraphId}:mechanics-p2g`,
        sphParticleState,
        mlsMpmParticleState,
        gridSpacingM: mechanicsOptions.gridSpacingM,
        boxDimsM: mechanicsOptions.boxDimsM,
        dt: mechanicsOptions.dt,
        preferWebGpu: mechanicsStagePreferWebGpu,
        readbackMode: mechanicsStageReadbackMode
      })
    });
    nodes.push({
      id: 'ulg-sph-mls-mpm-mechanics-grid-update',
      dependsOn: ['ulg-sph-mls-mpm-mechanics-p2g'],
      resultInputs: {
        p2gGridProjection: 'ulg-sph-mls-mpm-mechanics-p2g'
      },
      cacheInput: {
        stage: 'mechanics-grid-update',
        evidenceOnly: true,
        reads: ['mls-mpm-grid'],
        writes: ['mls-mpm-grid'],
        readbackMode: mechanicsStageReadbackMode
      },
      task: createMlsMpmMechanicsGridUpdateStageComputeTask({
        modulePath: mechanicsStageTaskModulePath,
        taskId: `${resolvedGraphId}:mechanics-grid-update`,
        dt: mechanicsOptions.dt,
        gravityMPerS2: mechanicsOptions.gravityMPerS2,
        boxDimsM: mechanicsOptions.boxDimsM,
        cflFactor: mechanicsOptions.cflFactor,
        preferWebGpu: mechanicsStagePreferWebGpu,
        readbackMode: mechanicsStageReadbackMode
      })
    });
    nodes.push({
      id: 'ulg-sph-mls-mpm-mechanics-g2p',
      dependsOn: ['ulg-sph-mls-mpm-mechanics-grid-update'],
      resultInputs: {
        gridUpdate: 'ulg-sph-mls-mpm-mechanics-grid-update'
      },
      cacheInput: {
        stage: 'mechanics-g2p',
        evidenceOnly: true,
        reads: ['mls-mpm-grid', 'sph-particle-state', 'mls-mpm-mechanics'],
        writes: ['sph-particle-state', 'mls-mpm-mechanics'],
        readbackMode: mechanicsStageReadbackMode
      },
      task: createMlsMpmMechanicsG2pStageComputeTask({
        modulePath: mechanicsStageTaskModulePath,
        taskId: `${resolvedGraphId}:mechanics-g2p`,
        sphParticleState,
        mlsMpmParticleState,
        dt: mechanicsOptions.dt,
        boxDimsM: mechanicsOptions.boxDimsM,
        preferWebGpu: mechanicsStagePreferWebGpu,
        readbackMode: mechanicsStageReadbackMode
      })
    });
    if (includeMechanicsStageSeed) {
      nodes.push({
        id: 'ulg-sph-mls-mpm-mechanics-stage-state-seed',
        dependsOn: ['ulg-sph-mls-mpm-mechanics-g2p'],
        resultInputs: {
          mechanicsG2pResult: 'ulg-sph-mls-mpm-mechanics-g2p'
        },
        cacheInput: {
          stage: 'mechanics-stage-state-seed',
          sourceStage: 'mechanics-g2p',
          derivationMode: 'mechanics-g2p-full-readback-candidate',
          authoritativeByDefault: false,
          readbackMode: mechanicsStageReadbackMode
        },
        task: {
          id: `${resolvedGraphId}:mechanics-stage-state-seed`,
          runtime: 'js',
          taskFamily: 'ulg-sph-mls-mpm-mechanics-stage-state-seed',
          solverId: ULG_RESIDENT_PASS_DAG_SOLVER_ID,
          module: mechanicsStageSeedTaskModulePath,
          exportName: mechanicsStageSeedTaskExportName,
          data: {
            stateSeedPayload,
            stateFamilies: normalizedStateFamilies,
            retainedBufferRefs: resolvedRetainedBufferRefs,
            sourceNodeId: 'ulg-sph-mls-mpm-mechanics-g2p'
          }
        }
      });
    }
  }
  if (includeResidentComputeStage) {
    const normalizedResidentStepCount = Math.max(1, Math.round(Number(residentStepCount) || 1));
    const residentTask = createMlsMpmResidentStepsComputeTask({
      modulePath: residentTaskModulePath,
      taskId: `${resolvedGraphId}:resident-steps`,
      sphParticleState,
      mlsMpmParticleState,
      materialProperties: stateSeedPayload.materialProperties,
      preferWebGpu: residentPreferWebGpu,
      stepCount: normalizedResidentStepCount,
      readbackMode: residentReadbackMode,
      laneId: `remote-sph-mls-mpm-resident:${resolvedGraphId}`,
      stateKey: resolvedStateKey,
      domainKey: 'ulg-sph-mls-mpm-remote-resident-steps',
      retainedBufferRefs: resolvedRetainedBufferRefs,
      suppressCommitDelta: true,
      emitCommitDelta: false,
      compactSummaryMode: 'final-only',
      compactSummaryScope: 'particle-visual'
    });
    if (residentRequireGpuFence !== true) {
      residentTask.gpuFence = {
        ...(residentTask.gpuFence || {}),
        required: false,
        source: 'ulg-remote-seed-graph-resident-stage-evidence-only'
      };
      residentTask.webgpu = {
        ...(residentTask.webgpu || {}),
        requiresQueueFence: false
      };
      residentTask.data = {
        ...(residentTask.data || {}),
        gpuFenceRequirement: residentTask.gpuFence
      };
    }
    const residentDependsOn = includeMechanicsStageSeed
      ? ['ulg-sph-mls-mpm-mechanics-stage-state-seed']
      : includeMechanicsStageChain
      ? ['ulg-sph-mls-mpm-mechanics-g2p']
      : ['ulg-sph-mls-mpm-state-seed'];
    nodes.push({
      id: 'ulg-sph-mls-mpm-resident-steps',
      dependsOn: residentDependsOn,
      cacheInput: {
        stage: 'resident-steps',
        evidenceOnly: true,
        stepCount: normalizedResidentStepCount,
        readbackMode: residentReadbackMode
      },
      task: residentTask
    });
    if (includePostStageSeed) {
      nodes.push({
        id: 'ulg-sph-mls-mpm-post-stage-state-seed',
        dependsOn: ['ulg-sph-mls-mpm-resident-steps'],
        resultInputs: {
          residentStageResult: 'ulg-sph-mls-mpm-resident-steps'
        },
        cacheInput: {
          stage: 'post-stage-state-seed',
          sourceStage: 'resident-steps',
          derivationMode: 'resident-stage-full-readback-transitional',
          readbackMode: residentReadbackMode
        },
        task: {
          id: `${resolvedGraphId}:post-stage-state-seed`,
          runtime: 'js',
          taskFamily: 'ulg-sph-mls-mpm-post-stage-state-seed',
          solverId: ULG_RESIDENT_PASS_DAG_SOLVER_ID,
          module: postStageSeedTaskModulePath,
          exportName: postStageSeedTaskExportName,
          data: {
            stateSeedPayload,
            stateFamilies: normalizedStateFamilies,
            retainedBufferRefs: resolvedRetainedBufferRefs,
            sourceNodeId: 'ulg-sph-mls-mpm-resident-steps'
          }
        }
      });
    }
  }
  return {
    schema: ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_GRAPH_SCHEMA,
    graphId: resolvedGraphId,
    graphFamily: 'ulg-sph-mls-mpm-resident-state-seed',
    graphVersion: 'v0',
    lawGraphId: ULG_RESIDENT_LAW_GRAPH_ID,
    solverId: ULG_RESIDENT_PASS_DAG_SOLVER_ID,
    cacheMode,
    cacheKey: resolvedCacheKey,
    cachePolicy: {
      mode: cacheMode,
      scope: 'ulg-sph-mls-mpm-remote-state-seed'
    },
    cacheInputs: {
      graphFamily: 'ulg-sph-mls-mpm-resident-state-seed',
      graphVersion: 'v0',
      lawGraphId: ULG_RESIDENT_LAW_GRAPH_ID,
      lawIds: uniqueStringList(lawIds || [ULG_RESIDENT_PASS_DAG_NODE_ID]),
      stateRefs: [resolvedStateKey],
      retainedBufferRefs: resolvedRetainedBufferRefs,
      stateFamilies: normalizedStateFamilies,
      readFamilies: resolvedReadFamilies,
      writeFamilies: resolvedWriteFamilies,
      values: {
        seedHash,
        particleCount: stateSeedPayload.state.particles.length,
        step: stateSeedPayload.step,
        time: stateSeedPayload.time,
        materialKeys: Object.keys(stateSeedPayload.materialProperties || {}).sort(),
        ...(extraCacheValues && typeof extraCacheValues === 'object' ? extraCacheValues : {})
      }
    },
    cacheAdmission: {
      status: 'recorded-not-admitted',
      admitted: false,
      authority: 'node-kernel-state-manager-required',
      reason: 'remote-task-graph-cache-artifact-requires-nodekernel-admission'
    },
    placementPolicy: resolvedPlacementPolicy,
    stateSeedPayload,
    stateFamilies: normalizedStateFamilies,
    retainedBufferRefs: resolvedRetainedBufferRefs,
    gpuResidentLane: {
      enabled: true,
      laneId: `remote-sph-mls-mpm:${resolvedGraphId}`,
      stateKey: resolvedStateKey,
      domainKey: 'ulg-sph-mls-mpm-remote-state-seed',
      solverId: ULG_RESIDENT_PASS_DAG_SOLVER_ID,
      readFamilies: resolvedReadFamilies,
      writeFamilies: resolvedWriteFamilies,
      retainedBufferRefs: resolvedRetainedBufferRefs,
      queueFencePolicy: 'ordered-before-cache-artifact'
    },
    nodes
  };
}

export function refreshUlgSphMlsMpmHotBuffersFromRemoteSeed({
  device,
  stateSeedPayload,
  materialProperties = null,
  stateManager = null,
  cacheKey = null,
  stateKey = null,
  lease = null,
  hotBufferKey = null,
  hotBufferKeyPrefix = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('refreshUlgSphMlsMpmHotBuffersFromRemoteSeed requires a WebGPU-like device');
  }
  const payload = normalizeRemoteSeedPayload(stateSeedPayload);
  const resolvedCacheKey = normalizeString(cacheKey, payload.cacheKey);
  const resolvedStateKey = normalizeString(stateKey, payload.stateKey);
  const resolvedMaterialProperties = materialProperties || payload.materialProperties || {};
  const resolvedHotBufferKey = makeHotBufferKey({
    hotBufferKey,
    hotBufferKeyPrefix,
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    lease
  });

  const sphPacked = buildSphGpuParticleBuffers(payload.state, {
    materialProperties: resolvedMaterialProperties,
    initialParticleSpacing: payload.initialParticleSpacing
  });
  const mlsMpmPacked = buildMlsMpmGpuParticleBuffers(payload.state, {
    materialProperties: resolvedMaterialProperties,
    initialParticleSpacing: payload.initialParticleSpacing
  });
  const sphUpload = uploadSphGpuParticleBuffers(device, sphPacked);
  const mlsMpmUpload = uploadMlsMpmGpuParticleBuffers(device, mlsMpmPacked);
  const retainedBufferRefs = [
    `${resolvedHotBufferKey}:sph-state-buffer`,
    `${resolvedHotBufferKey}:sph-thermo-buffer`,
    `${resolvedHotBufferKey}:mls-mpm-mechanics-buffer`
  ];
  const hotBufferRecord = {
    schema: ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA,
    status: 'hot-buffer-refresh-stored',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    sourceSchema: payload.schema,
    particleCount: sphPacked.particleCount,
    step: payload.step,
    time: payload.time,
    retainedBufferRefs,
    localBufferRefs: retainedBufferRefs,
    sphPacked,
    mlsMpmPacked,
    sphUpload,
    mlsMpmUpload
  };
  stateManager?.setHotBuffer?.(resolvedHotBufferKey, hotBufferRecord);

  return {
    schema: ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA,
    status: 'ulg-sph-mls-mpm-hot-buffer-refresh-executed',
    executorSchema: ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_EXECUTOR_SCHEMA,
    sourceSchema: payload.schema,
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    particleCount: sphPacked.particleCount,
    step: payload.step,
    time: payload.time,
    localBufferRefs: retainedBufferRefs,
    retainedBufferRefs,
    uploadSchemas: {
      sph: sphUpload.schema,
      mlsMpm: mlsMpmUpload.schema
    },
    packedSchemas: {
      sph: sphPacked.schema,
      mlsMpm: mlsMpmPacked.schema
    },
    bytes: {
      sphStateBytes: bufferByteLength(sphPacked.state),
      sphThermoBytes: bufferByteLength(sphPacked.thermo),
      mlsMpmMechanicsBytes: bufferByteLength(mlsMpmPacked.mechanics)
    },
    gpuFence: {
      status: 'queue-work-completed',
      method: 'ulg-sph-mls-mpm-hot-buffer-refresh'
    }
  };
}

function snapshotFloat32Array(value, expectedLength, label) {
  let out = null;
  if (value instanceof Float32Array) {
    out = new Float32Array(value);
  } else if (ArrayBuffer.isView(value)) {
    out = new Float32Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  } else if (value instanceof ArrayBuffer) {
    out = new Float32Array(value.slice(0));
  } else if (Array.isArray(value)) {
    out = new Float32Array(value);
  }
  if (!out) {
    throw new TypeError(`compact buffer snapshot requires ${label} Float32 data`);
  }
  if (out.length !== expectedLength) {
    throw new TypeError(`compact buffer snapshot ${label} length ${out.length} does not match expected ${expectedLength}`);
  }
  return out;
}

export function refreshUlgSphMlsMpmHotBuffersFromCompactSnapshot({
  device,
  compactBufferSnapshot,
  materialProperties = null,
  stateManager = null,
  cacheKey = null,
  stateKey = null,
  lease = null,
  hotBufferKey = null,
  hotBufferKeyPrefix = null,
  compactCandidate = null,
  compactCandidateAuthority = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('refreshUlgSphMlsMpmHotBuffersFromCompactSnapshot requires a WebGPU-like device');
  }
  const snapshot = compactBufferSnapshot || compactCandidate?.compactBufferSnapshot || compactCandidateAuthority?.compactBufferSnapshot;
  if (!snapshot || typeof snapshot !== 'object') {
    throw new TypeError('refreshUlgSphMlsMpmHotBuffersFromCompactSnapshot requires a compact buffer snapshot');
  }
  const particleCount = Math.max(0, Math.trunc(finiteSeedNumber(snapshot.particleCount, 0)));
  const sphState = snapshotFloat32Array(
    snapshot.sphState || snapshot.sphStateRows || snapshot.state,
    particleCount * SPH_GPU_PARTICLE_STATE_FLOATS,
    'sphState'
  );
  const sphThermo = snapshotFloat32Array(
    snapshot.sphThermo || snapshot.sphThermoRows || snapshot.thermo,
    particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS,
    'sphThermo'
  );
  const mlsMpmMechanics = snapshotFloat32Array(
    snapshot.mlsMpmMechanics || snapshot.mlsMpmMechanicsRows || snapshot.mechanics,
    particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    'mlsMpmMechanics'
  );
  const resolvedCacheKey = normalizeString(cacheKey, snapshot.cacheKey || compactCandidate?.cacheKey || compactCandidateAuthority?.cacheKey || null);
  const resolvedStateKey = normalizeString(stateKey, snapshot.stateKey || compactCandidate?.stateKey || compactCandidateAuthority?.stateKey || null);
  const resolvedHotBufferKey = makeHotBufferKey({
    hotBufferKey,
    hotBufferKeyPrefix,
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    lease
  });
  const step = finiteSeedNumber(snapshot.step, compactCandidate?.step ?? compactCandidateAuthority?.step ?? 0);
  const time = finiteSeedNumber(snapshot.time, compactCandidate?.time ?? compactCandidateAuthority?.time ?? 0);
  const sphPacked = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
    status: 'compact-snapshot-gpu-buffer-ready',
    particleCount,
    dimension: finiteSeedNumber(snapshot.dimension, 3),
    step,
    time,
    smoothingLengthM: finiteSeedNumber(snapshot.smoothingLengthM, 0),
    stateLayout: [...SPH_GPU_PARTICLE_STATE_ROW_LAYOUT],
    thermoLayout: [...SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT],
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    thermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
    stateStrideBytes: SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    thermoStrideBytes: SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    state: sphState,
    thermo: sphThermo,
    metadata: [],
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
  const mlsMpmPacked = {
    schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
    status: 'compact-snapshot-gpu-buffer-ready',
    particleCount,
    step,
    time,
    mechanicsLayout: [...MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT],
    mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    mechanicsStrideBytes: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    mechanics: mlsMpmMechanics,
    metadata: [],
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
  const sphUpload = uploadSphGpuParticleBuffers(device, sphPacked);
  const mlsMpmUpload = uploadMlsMpmGpuParticleBuffers(device, mlsMpmPacked);
  const retainedBufferRefs = [
    `${resolvedHotBufferKey}:sph-state-buffer`,
    `${resolvedHotBufferKey}:sph-thermo-buffer`,
    `${resolvedHotBufferKey}:mls-mpm-mechanics-buffer`
  ];
  const hotBufferRecord = {
    schema: ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA,
    status: 'hot-buffer-refresh-stored',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    sourceSchema: snapshot.schema || ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA,
    sourceMode: 'compact-buffer-snapshot',
    particleCount,
    step,
    time,
    retainedBufferRefs,
    localBufferRefs: retainedBufferRefs,
    sphPacked,
    mlsMpmPacked,
    sphUpload,
    mlsMpmUpload
  };
  stateManager?.setHotBuffer?.(resolvedHotBufferKey, hotBufferRecord);
  return {
    schema: ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA,
    status: 'ulg-sph-mls-mpm-compact-snapshot-hot-buffer-refresh-executed',
    executorSchema: ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_EXECUTOR_SCHEMA,
    sourceSchema: snapshot.schema || ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA,
    sourceMode: 'compact-buffer-snapshot',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    particleCount,
    step,
    time,
    compactCandidateHash: compactCandidate?.hash || compactCandidateAuthority?.compactCandidate?.hash || null,
    localBufferRefs: retainedBufferRefs,
    retainedBufferRefs,
    uploadSchemas: {
      sph: sphUpload.schema,
      mlsMpm: mlsMpmUpload.schema
    },
    packedSchemas: {
      sph: sphPacked.schema,
      mlsMpm: mlsMpmPacked.schema
    },
    bytes: {
      sphStateBytes: bufferByteLength(sphPacked.state),
      sphThermoBytes: bufferByteLength(sphPacked.thermo),
      mlsMpmMechanicsBytes: bufferByteLength(mlsMpmPacked.mechanics)
    },
    gpuFence: {
      status: 'queue-work-completed',
      method: 'ulg-sph-mls-mpm-compact-buffer-snapshot-refresh'
    },
    materialProperties: materialProperties ? 'provided' : 'not-required'
  };
}

function blockedSameDeviceRetainedBufferImport({
  reason,
  source = null,
  cacheKey = null,
  stateKey = null,
  compactCandidate = null,
  compactCandidateAuthority = null,
  localRefreshContract = null,
  remoteRetainedBufferRefs = []
} = {}) {
  return {
    schema: ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA,
    status: 'blocked-same-device-retained-buffer-import',
    refreshed: false,
    executorSchema: ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_EXECUTOR_SCHEMA,
    sourceSchema: source?.schema || ULG_REMOTE_TASK_GRAPH_SAME_DEVICE_RETAINED_BUFFER_IMPORT_SCHEMA,
    sourceMode: 'same-device-retained-buffer-import',
    reason,
    cacheKey,
    stateKey,
    compactCandidateSchema: compactCandidate?.schema || null,
    compactCandidateHash: compactCandidate?.hash || compactCandidateAuthority?.compactCandidate?.hash || null,
    localRefreshContract,
    remoteRetainedBufferRefs,
    localBufferRefs: [],
    retainedBufferRefs: [],
    gpuFence: {
      status: 'not-submitted',
      method: 'same-device-retained-buffer-import-blocked'
    }
  };
}

export function refreshUlgSphMlsMpmHotBuffersFromSameDeviceRetainedBufferImport({
  sameDeviceRetainedBufferImport = null,
  stateManager = null,
  cacheKey = null,
  stateKey = null,
  lease = null,
  hotBufferKey = null,
  hotBufferKeyPrefix = null,
  compactCandidate = null,
  compactCandidateAuthority = null
} = {}) {
  const candidate = compactCandidate || compactCandidateAuthority?.compactCandidate || {};
  const source = sameDeviceRetainedBufferImport
    || candidate.sameDeviceRetainedBufferImport
    || candidate.localSameDeviceRetainedBufferImport
    || compactCandidateAuthority?.sameDeviceRetainedBufferImport
    || compactCandidateAuthority?.localSameDeviceRetainedBufferImport
    || null;
  const resolvedCacheKey = normalizeString(
    cacheKey,
    source?.cacheKey || candidate.cacheKey || compactCandidateAuthority?.cacheKey || null
  );
  const resolvedStateKey = normalizeString(
    stateKey,
    source?.stateKey || candidate.stateKey || compactCandidateAuthority?.stateKey || null
  );
  const localRefreshContract = candidate.localRefreshContract || compactCandidateAuthority?.localRefreshContract || null;
  const remoteRetainedBufferRefs = uniqueStringList(
    candidate.retainedBufferRefs || compactCandidateAuthority?.retainedBufferRefs || []
  );
  if (!source || typeof source !== 'object') {
    return blockedSameDeviceRetainedBufferImport({
      reason: 'same-device-retained-buffer-import-source-required',
      cacheKey: resolvedCacheKey,
      stateKey: resolvedStateKey,
      compactCandidate: candidate,
      compactCandidateAuthority,
      localRefreshContract,
      remoteRetainedBufferRefs
    });
  }
  if (source.sameDevice !== true) {
    return blockedSameDeviceRetainedBufferImport({
      reason: 'same-device-retained-buffer-import-requires-explicit-same-device-source',
      source,
      cacheKey: resolvedCacheKey,
      stateKey: resolvedStateKey,
      compactCandidate: candidate,
      compactCandidateAuthority,
      localRefreshContract,
      remoteRetainedBufferRefs
    });
  }
  if (!stateManager?.getHotBuffer || !stateManager?.setHotBuffer) {
    return blockedSameDeviceRetainedBufferImport({
      reason: 'state-manager-hot-storage-required-for-same-device-import',
      source,
      cacheKey: resolvedCacheKey,
      stateKey: resolvedStateKey,
      compactCandidate: candidate,
      compactCandidateAuthority,
      localRefreshContract,
      remoteRetainedBufferRefs
    });
  }
  const sourceHotBufferKey = normalizeString(
    source.sourceHotBufferKey || source.hotBufferKey || source.hotBufferRecordKey,
    null
  );
  if (!sourceHotBufferKey) {
    return blockedSameDeviceRetainedBufferImport({
      reason: 'same-device-retained-buffer-import-source-hot-buffer-key-required',
      source,
      cacheKey: resolvedCacheKey,
      stateKey: resolvedStateKey,
      compactCandidate: candidate,
      compactCandidateAuthority,
      localRefreshContract,
      remoteRetainedBufferRefs
    });
  }
  const sourceRecord = stateManager.getHotBuffer(sourceHotBufferKey);
  if (!sourceRecord) {
    return blockedSameDeviceRetainedBufferImport({
      reason: 'same-device-retained-buffer-import-source-hot-buffer-not-found',
      source,
      cacheKey: resolvedCacheKey,
      stateKey: resolvedStateKey,
      compactCandidate: candidate,
      compactCandidateAuthority,
      localRefreshContract,
      remoteRetainedBufferRefs
    });
  }
  const sourceRefs = uniqueStringList(sourceRecord.localBufferRefs || sourceRecord.retainedBufferRefs || []);
  const declaredRefs = uniqueStringList(source.localBufferRefs || source.retainedBufferRefs || []);
  const declaredRefsMatch = declaredRefs.every((ref) => sourceRefs.includes(ref));
  if (sourceRefs.length === 0 || (declaredRefs.length > 0 && !declaredRefsMatch)) {
    return blockedSameDeviceRetainedBufferImport({
      reason: sourceRefs.length === 0
        ? 'same-device-retained-buffer-import-source-has-no-local-refs'
        : 'same-device-retained-buffer-import-retained-refs-do-not-match-source',
      source,
      cacheKey: resolvedCacheKey,
      stateKey: resolvedStateKey,
      compactCandidate: candidate,
      compactCandidateAuthority,
      localRefreshContract,
      remoteRetainedBufferRefs
    });
  }
  if (!sourceRecord.sphUpload?.stateBuffer
    || !sourceRecord.sphUpload?.thermoBuffer
    || !sourceRecord.mlsMpmUpload?.mechanicsBuffer) {
    return blockedSameDeviceRetainedBufferImport({
      reason: 'same-device-retained-buffer-import-source-handles-missing',
      source,
      cacheKey: resolvedCacheKey,
      stateKey: resolvedStateKey,
      compactCandidate: candidate,
      compactCandidateAuthority,
      localRefreshContract,
      remoteRetainedBufferRefs
    });
  }

  const resolvedHotBufferKey = makeHotBufferKey({
    hotBufferKey,
    hotBufferKeyPrefix,
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    lease
  });
  const particleCount = Math.max(0, Math.trunc(finiteSeedNumber(
    sourceRecord.particleCount,
    source.particleCount ?? candidate.particleCount ?? compactCandidateAuthority?.particleCount ?? 0
  )));
  const step = finiteSeedNumber(sourceRecord.step, source.step ?? candidate.step ?? compactCandidateAuthority?.step ?? 0);
  const time = finiteSeedNumber(sourceRecord.time, source.time ?? candidate.time ?? compactCandidateAuthority?.time ?? 0);
  const hotBufferRecord = {
    schema: ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA,
    status: 'hot-buffer-refresh-stored',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    sourceSchema: source.schema || ULG_REMOTE_TASK_GRAPH_SAME_DEVICE_RETAINED_BUFFER_IMPORT_SCHEMA,
    sourceMode: 'same-device-retained-buffer-import',
    sameDevice: true,
    sameDeviceAliasOf: sourceHotBufferKey,
    sourceHotBufferKey,
    copyMode: 'zero-copy-local-hot-buffer-alias',
    particleCount,
    step,
    time,
    retainedBufferRefs: sourceRefs,
    localBufferRefs: sourceRefs,
    sphPacked: sourceRecord.sphPacked,
    mlsMpmPacked: sourceRecord.mlsMpmPacked,
    sphUpload: sourceRecord.sphUpload,
    mlsMpmUpload: sourceRecord.mlsMpmUpload
  };
  stateManager.setHotBuffer(resolvedHotBufferKey, hotBufferRecord);
  return {
    schema: ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA,
    status: 'ulg-sph-mls-mpm-same-device-retained-buffer-imported',
    refreshed: true,
    executorSchema: ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_EXECUTOR_SCHEMA,
    sourceSchema: source.schema || ULG_REMOTE_TASK_GRAPH_SAME_DEVICE_RETAINED_BUFFER_IMPORT_SCHEMA,
    sourceMode: 'same-device-retained-buffer-import',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    sameDevice: true,
    sameDeviceAliasOf: sourceHotBufferKey,
    sourceHotBufferKey,
    copyMode: 'zero-copy-local-hot-buffer-alias',
    particleCount,
    step,
    time,
    compactCandidateSchema: candidate.schema || null,
    compactCandidateHash: candidate.hash || compactCandidateAuthority?.compactCandidate?.hash || null,
    localRefreshContract,
    remoteRetainedBufferRefs,
    localBufferRefs: sourceRefs,
    retainedBufferRefs: sourceRefs,
    uploadSchemas: {
      sph: sourceRecord.sphUpload?.schema || null,
      mlsMpm: sourceRecord.mlsMpmUpload?.schema || null
    },
    packedSchemas: {
      sph: sourceRecord.sphPacked?.schema || null,
      mlsMpm: sourceRecord.mlsMpmPacked?.schema || null
    },
    bytes: {
      sphStateBytes: bufferByteLength(sourceRecord.sphPacked?.state),
      sphThermoBytes: bufferByteLength(sourceRecord.sphPacked?.thermo),
      mlsMpmMechanicsBytes: bufferByteLength(sourceRecord.mlsMpmPacked?.mechanics)
    },
    copyBudget: {
      uploadBytes: 0,
      readbackBytes: 0,
      retainedBytes: 0,
      compactSummaryBytes: 0
    },
    gpuFence: {
      status: 'queue-work-completed',
      method: 'ulg-sph-mls-mpm-same-device-retained-buffer-import'
    }
  };
}

export function publishUlgSphMlsMpmSameDeviceHotBufferSource({
  stateManager = null,
  cacheKey = null,
  stateKey = null,
  hotBufferKey = null,
  hotBufferKeyPrefix = null,
  lease = null,
  sphPacked = null,
  mlsMpmPacked = null,
  sphUpload = null,
  mlsMpmUpload = null,
  particleCount = null,
  step = null,
  time = null,
  sourceSchema = null,
  sourceMode = 'compute-manager-gpu-worker-output',
  sourceTaskId = null,
  sourceNodeId = null,
  sourceStage = null
} = {}) {
  if (!stateManager?.setHotBuffer) {
    throw new TypeError('publishUlgSphMlsMpmSameDeviceHotBufferSource requires StateManager hot storage');
  }
  if (!sphUpload?.stateBuffer || !sphUpload?.thermoBuffer || !mlsMpmUpload?.mechanicsBuffer) {
    throw new TypeError('same-device hot-buffer source publication requires SPH state/thermo and MLS-MPM mechanics upload handles');
  }
  const resolvedHotBufferKey = makeHotBufferKey({
    hotBufferKey,
    hotBufferKeyPrefix: hotBufferKeyPrefix || 'ulg:same-device-hot-buffer-source',
    cacheKey,
    stateKey,
    lease
  });
  const resolvedParticleCount = Math.max(0, Math.trunc(finiteSeedNumber(
    particleCount,
    sphPacked?.particleCount
      ?? mlsMpmPacked?.particleCount
      ?? sphUpload?.particleCount
      ?? mlsMpmUpload?.particleCount
      ?? 0
  )));
  const resolvedStep = finiteSeedNumber(
    step,
    sphPacked?.step ?? mlsMpmPacked?.step ?? sphUpload?.step ?? mlsMpmUpload?.step ?? 0
  );
  const resolvedTime = finiteSeedNumber(
    time,
    sphPacked?.time ?? mlsMpmPacked?.time ?? sphUpload?.time ?? mlsMpmUpload?.time ?? 0
  );
  const retainedBufferRefs = [
    `${resolvedHotBufferKey}:sph-state-buffer`,
    `${resolvedHotBufferKey}:sph-thermo-buffer`,
    `${resolvedHotBufferKey}:mls-mpm-mechanics-buffer`
  ];
  const hotBufferRecord = {
    schema: ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA,
    status: 'hot-buffer-source-stored',
    cacheKey: normalizeString(cacheKey, null),
    stateKey: normalizeString(stateKey, null),
    hotBufferKey: resolvedHotBufferKey,
    sourceSchema,
    sourceMode,
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    sameDevice: true,
    copyMode: 'zero-copy-local-hot-buffer-source',
    particleCount: resolvedParticleCount,
    step: resolvedStep,
    time: resolvedTime,
    retainedBufferRefs,
    localBufferRefs: retainedBufferRefs,
    sphPacked,
    mlsMpmPacked,
    sphUpload,
    mlsMpmUpload
  };
  stateManager.setHotBuffer(resolvedHotBufferKey, hotBufferRecord);
  const sameDeviceRetainedBufferImport = {
    schema: ULG_REMOTE_TASK_GRAPH_SAME_DEVICE_RETAINED_BUFFER_IMPORT_SCHEMA,
    status: 'same-device-retained-buffer-source-ready',
    cacheKey: normalizeString(cacheKey, null),
    stateKey: normalizeString(stateKey, null),
    sourceHotBufferKey: resolvedHotBufferKey,
    sameDevice: true,
    sourceMode,
    sourceSchema,
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    particleCount: resolvedParticleCount,
    step: resolvedStep,
    time: resolvedTime,
    retainedBufferRefs,
    localBufferRefs: retainedBufferRefs,
    copyMode: 'zero-copy-local-hot-buffer-source'
  };
  return {
    schema: ULG_SPH_MLS_MPM_SAME_DEVICE_HOT_BUFFER_SOURCE_PUBLICATION_SCHEMA,
    status: 'same-device-hot-buffer-source-published',
    cacheKey: normalizeString(cacheKey, null),
    stateKey: normalizeString(stateKey, null),
    hotBufferKey: resolvedHotBufferKey,
    sameDevice: true,
    sourceMode,
    sourceSchema,
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    particleCount: resolvedParticleCount,
    step: resolvedStep,
    time: resolvedTime,
    retainedBufferRefs,
    localBufferRefs: retainedBufferRefs,
    sameDeviceRetainedBufferImport
  };
}

function buildWorkerRetainedAccessContract({
  cacheKey = null,
  stateKey = null,
  hotBufferKey = null,
  sourceMode = 'worker-retained-buffer-refs',
  sourceSchema = null,
  sourceTaskId = null,
  sourceNodeId = null,
  sourceStage = null,
  workerModuleUrl = null,
  retainedBufferRefs = [],
  workerRetainedBufferRefs = [],
  outputFamilies = [],
  sameDeviceMainThreadHandlesAvailable = false,
  workerLocal = true,
  bufferResidency = 'worker-lane-gpu-buffer-retained',
  consumerAccessProtocol = 'same-worker-lane-retained-buffer-ref'
} = {}) {
  const retainedRefs = uniqueStringList(retainedBufferRefs);
  const workerRefs = uniqueStringList(workerRetainedBufferRefs.length > 0
    ? workerRetainedBufferRefs
    : retainedRefs);
  const sameDevice = sameDeviceMainThreadHandlesAvailable === true;
  return {
    schema: ULG_WORKER_RETAINED_ACCESS_CONTRACT_SCHEMA,
    status: sameDevice
      ? 'same-device-main-thread-source-ready'
      : 'worker-local-source-ready-main-thread-refresh-blocked',
    reason: sameDevice
      ? 'publication-carries-main-thread-addressable-gpu-handles'
      : 'worker-retained-gpu-handles-stay-private-to-the-worker-lane',
    cacheKey,
    stateKey,
    sourceHotBufferKey: hotBufferKey,
    sourceMode,
    sourceSchema,
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    workerModuleUrl,
    sameDevice,
    workerLocal: workerLocal !== false,
    bufferResidency,
    consumerAccessProtocol,
    outputFamilies: uniqueStringList(outputFamilies),
    retainedBufferRefs: retainedRefs.length > 0 ? retainedRefs : workerRefs,
    workerRetainedBufferRefs: workerRefs,
    localBufferRefs: [],
    mainThreadGpuHandlesAvailable: sameDevice,
    sameDeviceMainThreadHandlesAvailable: sameDevice,
    localMaterializationStatus: sameDevice
      ? 'same-device-retained-buffer-import-ready'
      : 'blocked-worker-private-gpu-handles',
    localMaterializationBlocker: sameDevice
      ? null
      : 'worker-retained-gpu-handles-are-not-main-thread-transferable',
    workerContinuationRequired: !sameDevice,
    workerContinuationProtocol: 'same-worker-lane-retained-buffer-ref',
    acceptedConsumerModes: sameDevice
      ? ['same-device-retained-buffer-import', 'same-worker-lane-retained-buffer-ref']
      : ['same-worker-lane-retained-buffer-ref'],
    acceptedMaterializationModes: sameDevice
      ? ['same-device-retained-buffer-import']
      : [],
    remoteRetainedRefsUsableLocally: false,
    stateManagerAdmissionRequired: true,
    authoritativeStateMutation: false
  };
}

function workerRetainedSourceRecordFrom({
  stateManager = null,
  source = null,
  hotBufferKey = null
} = {}) {
  if (source && typeof source === 'object') return source;
  const key = normalizeString(hotBufferKey, null);
  if (key && typeof stateManager?.getHotBuffer === 'function') {
    return stateManager.getHotBuffer(key) || null;
  }
  return null;
}

function workerRetainedAccessContractFrom(source = null) {
  if (!source || typeof source !== 'object') return null;
  const payload = source.payload && typeof source.payload === 'object'
    ? source.payload
    : null;
  return source.schema === ULG_WORKER_RETAINED_ACCESS_CONTRACT_SCHEMA
    ? source
    : (
        source.workerRetainedAccessContract
        || source.workerRetainedBufferImport?.workerRetainedAccessContract
        || payload?.workerRetainedAccessContract
        || payload?.workerRetainedBufferImport?.workerRetainedAccessContract
        || null
      );
}

export function planWorkerRetainedContinuationFromAccessContract({
  stateManager = null,
  source = null,
  hotBufferKey = null,
  workerRetainedAccessContract = null,
  workerRunner = null,
  requiredOutputFamilies = [],
  consumerStageId = null,
  consumerLawNodeId = null,
  requestedLaneId = null,
  requestedStateKey = null,
  requireWorkerRunner = true
} = {}) {
  const sourceRecord = workerRetainedSourceRecordFrom({ stateManager, source, hotBufferKey });
  const contract = workerRetainedAccessContract
    || workerRetainedAccessContractFrom(sourceRecord)
    || null;
  const resolvedHotBufferKey = normalizeString(
    hotBufferKey,
    sourceRecord?.hotBufferKey
      || sourceRecord?.payload?.hotBufferKey
      || contract?.sourceHotBufferKey
      || null
  );
  const requiredFamilies = uniqueStringList(requiredOutputFamilies);
  const outputFamilies = uniqueStringList(
    contract?.outputFamilies
      || sourceRecord?.outputFamilies
      || sourceRecord?.payload?.outputFamilies
      || []
  );
  const missingOutputFamilies = requiredFamilies.filter((family) => !outputFamilies.includes(family));
  const acceptedConsumerModes = uniqueStringList(contract?.acceptedConsumerModes || []);
  const workerRetainedBufferRefs = uniqueStringList(
    contract?.workerRetainedBufferRefs
      || sourceRecord?.workerRetainedBufferRefs
      || sourceRecord?.payload?.workerRetainedBufferRefs
      || sourceRecord?.workerRetainedBufferImport?.workerRetainedBufferRefs
      || sourceRecord?.payload?.workerRetainedBufferImport?.workerRetainedBufferRefs
      || []
  );
  const localBufferRefs = uniqueStringList(
    contract?.localBufferRefs
      || sourceRecord?.localBufferRefs
      || sourceRecord?.payload?.localBufferRefs
      || []
  );
  const resolvedWorkerRunner = workerRunner || sourceRecord?.workerRunner || sourceRecord?.workerBackend || null;
  const sameWorkerModeAccepted = acceptedConsumerModes.includes('same-worker-lane-retained-buffer-ref')
    || contract?.workerContinuationProtocol === 'same-worker-lane-retained-buffer-ref'
    || contract?.consumerAccessProtocol === 'same-worker-lane-retained-buffer-ref';
  const blocker = !contract
    ? 'worker-retained-access-contract-missing'
    : (contract.schema !== ULG_WORKER_RETAINED_ACCESS_CONTRACT_SCHEMA
      ? 'worker-retained-access-contract-schema-mismatch'
      : (missingOutputFamilies.length > 0
        ? 'worker-retained-continuation-output-family-mismatch'
        : (!sameWorkerModeAccepted
          ? 'same-worker-retained-ref-consumer-mode-not-accepted'
          : (workerRetainedBufferRefs.length === 0
            ? 'worker-retained-buffer-refs-missing'
            : (contract.workerLocal === false
              ? 'worker-retained-source-not-worker-local'
              : (requireWorkerRunner !== false && !resolvedWorkerRunner
                ? 'worker-retained-source-worker-runner-missing'
                : null))))));
  const ready = !blocker;
  return {
    schema: ULG_WORKER_RETAINED_CONTINUATION_PLAN_SCHEMA,
    status: ready
      ? 'same-worker-retained-continuation-ready'
      : 'blocked-worker-retained-continuation',
    blocker,
    useWorkerRetainedInput: ready,
    consumerMode: ready ? 'same-worker-lane-retained-buffer-ref' : null,
    consumerStageId: normalizeString(consumerStageId, null),
    consumerLawNodeId: normalizeString(consumerLawNodeId, null),
    requestedLaneId: normalizeString(requestedLaneId, null),
    requestedStateKey: normalizeString(requestedStateKey, null),
    cacheKey: contract?.cacheKey || sourceRecord?.cacheKey || sourceRecord?.payload?.cacheKey || null,
    stateKey: contract?.stateKey || sourceRecord?.stateKey || sourceRecord?.payload?.stateKey || null,
    sourceHotBufferKey: resolvedHotBufferKey,
    sourceStage: contract?.sourceStage || sourceRecord?.sourceStage || sourceRecord?.payload?.sourceStage || null,
    sourceNodeId: contract?.sourceNodeId || sourceRecord?.sourceNodeId || sourceRecord?.payload?.sourceNodeId || null,
    sourceTaskId: contract?.sourceTaskId || sourceRecord?.sourceTaskId || sourceRecord?.payload?.sourceTaskId || null,
    workerModuleUrl: contract?.workerModuleUrl || sourceRecord?.workerModuleUrl || sourceRecord?.payload?.workerModuleUrl || null,
    workerContinuationRequired: contract?.workerContinuationRequired === true,
    mainThreadGpuHandlesAvailable: contract?.mainThreadGpuHandlesAvailable === true,
    sameDeviceMainThreadHandlesAvailable: contract?.sameDeviceMainThreadHandlesAvailable === true,
    workerLocal: contract?.workerLocal !== false,
    bufferResidency: contract?.bufferResidency || sourceRecord?.bufferResidency || sourceRecord?.payload?.bufferResidency || null,
    workerContinuationProtocol: contract?.workerContinuationProtocol || null,
    consumerAccessProtocol: contract?.consumerAccessProtocol || null,
    acceptedConsumerModes,
    acceptedMaterializationModes: uniqueStringList(contract?.acceptedMaterializationModes || []),
    requiredOutputFamilies: requiredFamilies,
    outputFamilies,
    missingOutputFamilies,
    workerRetainedBufferRefs,
    workerRetainedBufferRefCount: workerRetainedBufferRefs.length,
    localBufferRefs,
    localBufferRefCount: localBufferRefs.length,
    workerRunnerAvailable: Boolean(resolvedWorkerRunner),
    sourceRecordStatus: sourceRecord?.status || sourceRecord?.payload?.status || null,
    sourceRecordSchema: sourceRecord?.schema || sourceRecord?.payload?.schema || null,
    accessContractStatus: contract?.status || null,
    accessContractReason: contract?.reason || null,
    localMaterializationStatus: contract?.localMaterializationStatus || null,
    localMaterializationBlocker: contract?.localMaterializationBlocker || null,
    stateManagerAdmissionRequired: contract?.stateManagerAdmissionRequired === true,
    authoritativeStateMutation: false
  };
}

export function publishUlgMechanicsWorkerRetainedHotBufferSource({
  stateManager = null,
  nodeKernel = null,
  cacheKey = null,
  stateKey = null,
  hotBufferKey = null,
  hotBufferKeyPrefix = null,
  lease = null,
  candidate = null,
  workerRunner = null,
  workerModuleUrl = null,
  sourceTaskId = null,
  sourceNodeId = null,
  sourceStage = 'g2p',
  scope = 'ulg-worker-retained-mechanics-publications',
  taskId = null,
  version = null
} = {}) {
  if (!stateManager?.setHotBuffer || !stateManager?.getHotBuffer || !stateManager?.commitDelta) {
    throw new TypeError('publishUlgMechanicsWorkerRetainedHotBufferSource requires StateManager hot storage and commitDelta');
  }
  if (!candidate || typeof candidate !== 'object') {
    throw new TypeError('worker retained hot-buffer publication requires a compact publication candidate');
  }
  const workerRetainedBufferRefs = uniqueStringList(
    candidate.workerRetainedBufferRefs || candidate.retainedBufferRefs || []
  );
  if (workerRetainedBufferRefs.length === 0) {
    throw new TypeError('worker retained hot-buffer publication requires worker-retained buffer refs');
  }
  const resolvedCacheKey = normalizeString(cacheKey, candidate.cacheKey || candidate.laneId || null);
  const resolvedStateKey = normalizeString(stateKey, candidate.stateKey || null);
  const resolvedHotBufferKey = makeHotBufferKey({
    hotBufferKey,
    hotBufferKeyPrefix: hotBufferKeyPrefix || 'ulg:mechanics-worker-retained-hot-buffer-source',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    lease
  });
  const committedAt = Date.now();
  const workerRetainedBufferImport = {
    schema: ULG_MECHANICS_WORKER_RETAINED_BUFFER_IMPORT_SCHEMA,
    status: 'worker-retained-buffer-source-ready',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    sourceHotBufferKey: resolvedHotBufferKey,
    sameDevice: false,
    workerLocal: true,
    sourceMode: 'worker-retained-buffer-refs',
    sourceSchema: candidate.schema || null,
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    workerModuleUrl: workerModuleUrl || candidate.workerModuleUrl || null,
    retainedBufferRefs: workerRetainedBufferRefs,
    workerRetainedBufferRefs,
    localBufferRefs: [],
    copyMode: 'zero-copy-worker-retained-ref-descriptor',
    stateManagerAdmissionRequired: true
  };
  const outputFamilies = uniqueStringList(candidate.outputFamilies || ['sph-particle-state', 'mls-mpm-mechanics']);
  const workerRetainedAccessContract = buildWorkerRetainedAccessContract({
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    sourceMode: workerRetainedBufferImport.sourceMode,
    sourceSchema: workerRetainedBufferImport.sourceSchema,
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    workerModuleUrl: workerRetainedBufferImport.workerModuleUrl,
    retainedBufferRefs: workerRetainedBufferRefs,
    workerRetainedBufferRefs,
    outputFamilies
  });
  workerRetainedBufferImport.workerRetainedAccessContract = workerRetainedAccessContract;
  const hotBufferRecord = {
    schema: ULG_MECHANICS_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA,
    status: 'worker-retained-hot-buffer-source-stored',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    sourceSchema: candidate.schema || null,
    sourceMode: 'worker-retained-buffer-refs',
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    sameDevice: false,
    workerLocal: true,
    copyMode: 'zero-copy-worker-retained-ref-descriptor',
    workerModuleUrl: workerRetainedBufferImport.workerModuleUrl,
    workerRunner,
    workerBackend: workerRunner,
    workerRetainedBufferRefs,
    retainedBufferRefs: workerRetainedBufferRefs,
    localBufferRefs: [],
    compactPublicationCandidate: cloneSerializableValue(candidate),
    workerRetainedBufferImport,
    workerRetainedAccessContract
  };
  stateManager.setHotBuffer(resolvedHotBufferKey, hotBufferRecord);
  const deltaScope = normalizeString(scope, 'ulg-worker-retained-mechanics-publications');
  const deltaTaskId = normalizeString(
    taskId,
    `ulg-worker-retained-mechanics-publication:${resolvedCacheKey || resolvedStateKey || resolvedHotBufferKey}`
  );
  const payload = {
    schema: ULG_MECHANICS_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA,
    status: 'worker-retained-mechanics-output-admitted',
    authority: nodeKernel ? 'nodekernel-state-manager' : 'state-manager-local-authority',
    nodeKernelPresent: Boolean(nodeKernel),
    nodeId: nodeKernel?.nodeId || null,
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    committedAt,
    sameDevice: false,
    workerLocal: true,
    sourceMode: 'worker-retained-buffer-refs',
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    workerModuleUrl: workerRetainedBufferImport.workerModuleUrl,
    retainedBufferRefs: workerRetainedBufferRefs,
    workerRetainedBufferRefs,
    localBufferRefs: [],
    outputFamilies,
    compactPublicationCandidate: cloneSerializableValue(candidate),
    workerRetainedBufferImport,
    workerRetainedAccessContract
  };
  const commitDelta = {
    taskId: deltaTaskId,
    scope: deltaScope,
    version: version ?? committedAt,
    timestamp: committedAt,
    payload
  };
  stateManager.commitDelta(commitDelta);
  return {
    ...payload,
    status: 'worker-retained-mechanics-output-published',
    committed: true,
    hotBufferStored: Boolean(stateManager.getHotBuffer(resolvedHotBufferKey)),
    commitDeltaTaskId: deltaTaskId,
    commitDeltaScope: deltaScope,
    commitDeltaTimestamp: committedAt
  };
}

export function publishUlgThermalPhaseWorkerRetainedHotBufferSource({
  stateManager = null,
  nodeKernel = null,
  cacheKey = null,
  stateKey = null,
  hotBufferKey = null,
  hotBufferKeyPrefix = null,
  lease = null,
  candidate = null,
  workerRunner = null,
  workerModuleUrl = null,
  sourceTaskId = null,
  sourceNodeId = 'ulg-thermal-phase-law',
  sourceStage = 'thermalPhase',
  scope = 'ulg-worker-retained-thermal-phase-publications',
  taskId = null,
  version = null
} = {}) {
  if (!stateManager?.setHotBuffer || !stateManager?.getHotBuffer || !stateManager?.commitDelta) {
    throw new TypeError('publishUlgThermalPhaseWorkerRetainedHotBufferSource requires StateManager hot storage and commitDelta');
  }
  if (!candidate || typeof candidate !== 'object') {
    throw new TypeError('thermal phase worker retained publication requires a compact publication candidate');
  }
  const workerRetainedBufferRefs = uniqueStringList(
    candidate.workerRetainedThermoBufferRefs
      || candidate.workerRetainedBufferRefs
      || candidate.retainedBufferRefs
      || []
  );
  if (workerRetainedBufferRefs.length === 0) {
    throw new TypeError('thermal phase worker retained publication requires worker-retained thermal buffer refs');
  }
  const resolvedCacheKey = normalizeString(cacheKey, candidate.cacheKey || candidate.laneId || null);
  const resolvedStateKey = normalizeString(stateKey, candidate.stateKey || null);
  const resolvedHotBufferKey = makeHotBufferKey({
    hotBufferKey,
    hotBufferKeyPrefix: hotBufferKeyPrefix || 'ulg:thermal-phase-worker-retained-hot-buffer-source',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    lease
  });
  const committedAt = Date.now();
  const workerRetainedBufferImport = {
    schema: ULG_THERMAL_PHASE_WORKER_RETAINED_BUFFER_IMPORT_SCHEMA,
    status: 'thermal-phase-worker-retained-buffer-source-ready',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    sourceHotBufferKey: resolvedHotBufferKey,
    sameDevice: false,
    workerLocal: true,
    sourceMode: 'worker-retained-thermal-phase-buffer-refs',
    sourceSchema: candidate.schema || null,
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    workerModuleUrl: workerModuleUrl || candidate.workerModuleUrl || null,
    retainedBufferRefs: workerRetainedBufferRefs,
    workerRetainedBufferRefs,
    localBufferRefs: [],
    copyMode: 'zero-copy-worker-retained-ref-descriptor',
    stateManagerAdmissionRequired: true
  };
  const outputFamilies = uniqueStringList(candidate.outputFamilies || ['sph-thermo-phase']);
  const workerRetainedAccessContract = buildWorkerRetainedAccessContract({
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    sourceMode: workerRetainedBufferImport.sourceMode,
    sourceSchema: workerRetainedBufferImport.sourceSchema,
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    workerModuleUrl: workerRetainedBufferImport.workerModuleUrl,
    retainedBufferRefs: workerRetainedBufferRefs,
    workerRetainedBufferRefs,
    outputFamilies
  });
  workerRetainedBufferImport.workerRetainedAccessContract = workerRetainedAccessContract;
  const hotBufferRecord = {
    schema: ULG_THERMAL_PHASE_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA,
    status: 'worker-retained-thermal-phase-hot-buffer-source-stored',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    sourceSchema: candidate.schema || null,
    sourceMode: 'worker-retained-thermal-phase-buffer-refs',
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    sameDevice: false,
    workerLocal: true,
    copyMode: 'zero-copy-worker-retained-ref-descriptor',
    workerModuleUrl: workerRetainedBufferImport.workerModuleUrl,
    workerRunner,
    workerBackend: workerRunner,
    workerRetainedBufferRefs,
    retainedBufferRefs: workerRetainedBufferRefs,
    localBufferRefs: [],
    thermalPhasePublicationCandidate: cloneSerializableValue(candidate),
    workerRetainedBufferImport,
    workerRetainedAccessContract
  };
  stateManager.setHotBuffer(resolvedHotBufferKey, hotBufferRecord);
  const deltaScope = normalizeString(scope, 'ulg-worker-retained-thermal-phase-publications');
  const deltaTaskId = normalizeString(
    taskId,
    `ulg-worker-retained-thermal-phase-publication:${resolvedCacheKey || resolvedStateKey || resolvedHotBufferKey}`
  );
  const payload = {
    schema: ULG_THERMAL_PHASE_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA,
    status: 'worker-retained-thermal-phase-output-admitted',
    authority: nodeKernel ? 'nodekernel-state-manager' : 'state-manager-local-authority',
    nodeKernelPresent: Boolean(nodeKernel),
    nodeId: nodeKernel?.nodeId || null,
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    committedAt,
    sameDevice: false,
    workerLocal: true,
    sourceMode: 'worker-retained-thermal-phase-buffer-refs',
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    workerModuleUrl: workerRetainedBufferImport.workerModuleUrl,
    retainedBufferRefs: workerRetainedBufferRefs,
    workerRetainedBufferRefs,
    localBufferRefs: [],
    outputFamilies,
    thermalPhasePublicationCandidate: cloneSerializableValue(candidate),
    workerRetainedBufferImport,
    workerRetainedAccessContract
  };
  const commitDelta = {
    taskId: deltaTaskId,
    scope: deltaScope,
    version: version ?? committedAt,
    timestamp: committedAt,
    payload
  };
  stateManager.commitDelta(commitDelta);
  return {
    ...payload,
    status: 'worker-retained-thermal-phase-output-published',
    committed: true,
    hotBufferStored: Boolean(stateManager.getHotBuffer(resolvedHotBufferKey)),
    commitDeltaTaskId: deltaTaskId,
    commitDeltaScope: deltaScope,
    commitDeltaTimestamp: committedAt
  };
}

export function publishUlgPressureInterfaceGasCellFieldImportSource({
  stateManager = null,
  nodeKernel = null,
  cacheKey = null,
  stateKey = null,
  hotBufferKey = null,
  hotBufferKeyPrefix = null,
  lease = null,
  source = null,
  gasCellFieldSnapshot = null,
  pressureInterfaceGasCellFieldAdmission = null,
  retainedGasPressureBufferRefs = [],
  workerRetainedGasPressureBufferRefs = [],
  sourceTaskId = null,
  sourceNodeId = 'ulg-resident-gas-pressure-law',
  sourceStage = 'residentGasPressure',
  scope = 'ulg-pressure-interface-gas-cell-field-imports',
  taskId = null,
  version = null
} = {}) {
  if (!stateManager?.setHotBuffer || !stateManager?.getHotBuffer || !stateManager?.commitDelta) {
    throw new TypeError('publishUlgPressureInterfaceGasCellFieldImportSource requires StateManager hot storage and commitDelta');
  }
  const sourceObject = source && typeof source === 'object' ? source : {};
  const resolvedGasCellFieldSnapshot = gasCellFieldSnapshot
    || sourceObject.gasCellFieldSnapshot
    || sourceObject.gasCellField
    || sourceObject.pressureFeedback?.gasCellField
    || null;
  const resolvedAdmission = pressureInterfaceGasCellFieldAdmission
    || sourceObject.pressureInterfaceGasCellFieldAdmission
    || sourceObject.gasCellFieldAdmission
    || sourceObject.admission
    || null;
  const retainedGasCellFieldSource = retainedGasCellFieldSourceFrom(sourceObject)
    || retainedGasCellFieldSourceFrom(resolvedAdmission)
    || null;
  const admissionApproved = resolvedAdmission?.schema === ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA
    && resolvedAdmission?.status === 'pressure-interface-gas-cell-field-consumption-approved'
    && resolvedAdmission?.gasCellFieldConsumptionApproved === true;
  if (!admissionApproved) {
    throw new TypeError('pressure/interface gas-cell field import requires admitted field-consumption evidence');
  }
  const resolvedRetainedGasPressureBufferRefs = retainedGasPressureBufferRefs.length > 0
    ? uniqueStringList(retainedGasPressureBufferRefs)
    : firstNonEmptyStringList(
        sourceObject.retainedGasPressureBufferRefs,
        sourceObject.pressureInterfaceGasCellFieldAdmission?.retainedGasPressureBufferRefs,
        resolvedAdmission.retainedGasPressureBufferRefs,
        retainedGasCellFieldSource?.retainedGasPressureBufferRefs
      );
  const resolvedWorkerRetainedGasPressureBufferRefs = workerRetainedGasPressureBufferRefs.length > 0
    ? uniqueStringList(workerRetainedGasPressureBufferRefs)
    : firstNonEmptyStringList(
        sourceObject.workerRetainedGasPressureBufferRefs,
        sourceObject.pressureInterfaceGasCellFieldAdmission?.workerRetainedGasPressureBufferRefs,
        resolvedAdmission.workerRetainedGasPressureBufferRefs,
        retainedGasCellFieldSource?.workerRetainedGasPressureBufferRefs
      );
  if (resolvedRetainedGasPressureBufferRefs.length === 0 && resolvedWorkerRetainedGasPressureBufferRefs.length === 0) {
    throw new TypeError('pressure/interface gas-cell field import requires retained gas-cell buffer refs');
  }
  if (
    resolvedGasCellFieldSnapshot?.localPressureGradientReady !== true
    || !Array.isArray(resolvedGasCellFieldSnapshot?.cells)
    || resolvedGasCellFieldSnapshot.cells.length === 0
  ) {
    throw new TypeError('pressure/interface gas-cell field import requires a ready local gas-cell snapshot');
  }
  const resolvedCacheKey = normalizeString(cacheKey, sourceObject.cacheKey || sourceObject.laneId || null);
  const resolvedStateKey = normalizeString(stateKey, sourceObject.stateKey || null);
  const resolvedHotBufferKey = makeHotBufferKey({
    hotBufferKey,
    hotBufferKeyPrefix: hotBufferKeyPrefix || 'ulg:pressure-interface-gas-cell-field-import-source',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    lease
  });
  const gasPressureCellRowCount = Math.max(
    0,
    Math.trunc(finiteSeedNumber(
      sourceObject.pressureInterfaceGasPressureCellRowCount
        ?? retainedGasCellFieldSource?.pressureInterfaceGasPressureCellRowCount,
      resolvedGasCellFieldSnapshot.cells.length
    ))
  );
  const gasPressureCellRowStrideFloats = Math.max(
    0,
    Math.trunc(finiteSeedNumber(
      sourceObject.pressureInterfaceGasPressureCellRowStrideFloats
        ?? retainedGasCellFieldSource?.pressureInterfaceGasPressureCellRowStrideFloats,
      12
    ))
  );
  const gasPressureCellRowByteLength = Math.max(
    0,
    Math.trunc(finiteSeedNumber(
      sourceObject.pressureInterfaceGasPressureCellRowByteLength
        ?? retainedGasCellFieldSource?.pressureInterfaceGasPressureCellRowByteLength,
      gasPressureCellRowCount * gasPressureCellRowStrideFloats * Float32Array.BYTES_PER_ELEMENT
    ))
  );
  const pressureInterfaceGasCellFieldImport = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
    status: 'pressure-interface-gas-cell-field-import-ready',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    sourceHotBufferKey: resolvedHotBufferKey,
    sourceSchema: sourceObject.schema || null,
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    retainedGasPressureBufferRefs: resolvedRetainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs: resolvedWorkerRetainedGasPressureBufferRefs,
    pressureInterfaceGasPressureCellRowCount: gasPressureCellRowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: gasPressureCellRowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: gasPressureCellRowByteLength,
    pressureInterfaceGasCellFieldAdmission: cloneSerializableValue(resolvedAdmission),
    retainedGasCellFieldSource: cloneSerializableValue(retainedGasCellFieldSource),
    gasCellFieldSnapshot: cloneSerializableValue(resolvedGasCellFieldSnapshot),
    stateManagerAdmissionRequired: true,
    authoritativeStateMutation: false
  };
  const committedAt = Date.now();
  const hotBufferRecord = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_HOT_BUFFER_PUBLICATION_SCHEMA,
    status: 'pressure-interface-gas-cell-field-import-hot-buffer-source-stored',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    sourceSchema: sourceObject.schema || null,
    sourceMode: 'state-manager-retained-gas-cell-field-import',
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    retainedGasPressureBufferRefs: resolvedRetainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs: resolvedWorkerRetainedGasPressureBufferRefs,
    pressureInterfaceGasPressureCellRowCount: gasPressureCellRowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: gasPressureCellRowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: gasPressureCellRowByteLength,
    pressureInterfaceGasCellFieldAdmission: cloneSerializableValue(resolvedAdmission),
    retainedGasCellFieldSource: cloneSerializableValue(retainedGasCellFieldSource),
    gasCellFieldSnapshot: cloneSerializableValue(resolvedGasCellFieldSnapshot),
    pressureInterfaceGasCellFieldImport
  };
  stateManager.setHotBuffer(resolvedHotBufferKey, hotBufferRecord);
  const deltaScope = normalizeString(scope, 'ulg-pressure-interface-gas-cell-field-imports');
  const deltaTaskId = normalizeString(
    taskId,
    `ulg-pressure-interface-gas-cell-field-import:${resolvedCacheKey || resolvedStateKey || resolvedHotBufferKey}`
  );
  const payload = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_HOT_BUFFER_PUBLICATION_SCHEMA,
    status: 'pressure-interface-gas-cell-field-import-admitted',
    authority: nodeKernel ? 'nodekernel-state-manager' : 'state-manager-local-authority',
    nodeKernelPresent: Boolean(nodeKernel),
    nodeId: nodeKernel?.nodeId || null,
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    committedAt,
    sourceMode: 'state-manager-retained-gas-cell-field-import',
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    retainedGasPressureBufferRefs: resolvedRetainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs: resolvedWorkerRetainedGasPressureBufferRefs,
    pressureInterfaceGasPressureCellRowCount: gasPressureCellRowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: gasPressureCellRowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: gasPressureCellRowByteLength,
    pressureInterfaceGasCellFieldAdmission: cloneSerializableValue(resolvedAdmission),
    retainedGasCellFieldSource: cloneSerializableValue(retainedGasCellFieldSource),
    gasCellFieldSnapshot: cloneSerializableValue(resolvedGasCellFieldSnapshot),
    pressureInterfaceGasCellFieldImport
  };
  const commitDelta = {
    taskId: deltaTaskId,
    scope: deltaScope,
    version: version ?? committedAt,
    timestamp: committedAt,
    payload
  };
  stateManager.commitDelta(commitDelta);
  return {
    ...payload,
    status: 'pressure-interface-gas-cell-field-import-published',
    committed: true,
    hotBufferStored: Boolean(stateManager.getHotBuffer(resolvedHotBufferKey)),
    commitDeltaTaskId: deltaTaskId,
    commitDeltaScope: deltaScope,
    commitDeltaTimestamp: committedAt
  };
}

export function publishUlgPressureInterfaceGasCellFieldAdmission({
  stateManager = null,
  nodeKernel = null,
  cacheKey = null,
  stateKey = null,
  hotBufferKey = null,
  hotBufferKeyPrefix = null,
  lease = null,
  source = null,
  gasCellFieldSnapshot = null,
  retainedGasPressureBufferRefs = [],
  workerRetainedGasPressureBufferRefs = [],
  sourceTaskId = null,
  sourceNodeId = 'ulg-resident-gas-pressure-law',
  sourceStage = 'residentGasPressure',
  scope = 'ulg-pressure-interface-gas-cell-field-admissions',
  taskId = null,
  version = null
} = {}) {
  if (!stateManager?.setHotBuffer || !stateManager?.getHotBuffer || !stateManager?.commitDelta) {
    throw new TypeError('publishUlgPressureInterfaceGasCellFieldAdmission requires StateManager hot storage and commitDelta');
  }
  const sourceObject = source && typeof source === 'object' ? source : {};
  const retainedGasCellFieldSource = retainedGasCellFieldSourceFrom(sourceObject);
  const resolvedGasCellFieldSnapshot = gasCellFieldSnapshot
    || sourceObject.gasCellFieldSnapshot
    || sourceObject.gasCellField
    || sourceObject.pressureFeedback?.gasCellField
    || null;
  if (
    resolvedGasCellFieldSnapshot?.localPressureGradientReady !== true
    || !Array.isArray(resolvedGasCellFieldSnapshot?.cells)
    || resolvedGasCellFieldSnapshot.cells.length === 0
  ) {
    throw new TypeError('pressure/interface gas-cell field admission requires a ready local gas-cell snapshot');
  }
  const resolvedRetainedGasPressureBufferRefs = retainedGasPressureBufferRefs.length > 0
    ? uniqueStringList(retainedGasPressureBufferRefs)
    : firstNonEmptyStringList(
        sourceObject.retainedGasPressureBufferRefs,
        retainedGasCellFieldSource?.retainedGasPressureBufferRefs
      );
  const resolvedWorkerRetainedGasPressureBufferRefs = workerRetainedGasPressureBufferRefs.length > 0
    ? uniqueStringList(workerRetainedGasPressureBufferRefs)
    : firstNonEmptyStringList(
        sourceObject.workerRetainedGasPressureBufferRefs,
        retainedGasCellFieldSource?.workerRetainedGasPressureBufferRefs
      );
  if (resolvedRetainedGasPressureBufferRefs.length === 0 && resolvedWorkerRetainedGasPressureBufferRefs.length === 0) {
    throw new TypeError('pressure/interface gas-cell field admission requires retained gas-cell buffer refs');
  }
  const resolvedCacheKey = normalizeString(cacheKey, sourceObject.cacheKey || sourceObject.laneId || null);
  const resolvedStateKey = normalizeString(stateKey, sourceObject.stateKey || null);
  const resolvedHotBufferKey = makeHotBufferKey({
    hotBufferKey,
    hotBufferKeyPrefix: hotBufferKeyPrefix || 'ulg:pressure-interface-gas-cell-field-admission-source',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    lease
  });
  const gasPressureCellRowCount = Math.max(0, Math.trunc(finiteSeedNumber(
    sourceObject.pressureInterfaceGasPressureCellRowCount
      ?? retainedGasCellFieldSource?.pressureInterfaceGasPressureCellRowCount,
    resolvedGasCellFieldSnapshot.cells.length
  )));
  const gasPressureCellRowStrideFloats = Math.max(
    0,
    Math.trunc(finiteSeedNumber(
      sourceObject.pressureInterfaceGasPressureCellRowStrideFloats
        ?? retainedGasCellFieldSource?.pressureInterfaceGasPressureCellRowStrideFloats,
      12
    ))
  );
  const gasPressureCellRowByteLength = Math.max(0, Math.trunc(finiteSeedNumber(
    sourceObject.pressureInterfaceGasPressureCellRowByteLength
      ?? retainedGasCellFieldSource?.pressureInterfaceGasPressureCellRowByteLength,
    gasPressureCellRowCount * gasPressureCellRowStrideFloats * Float32Array.BYTES_PER_ELEMENT
  )));
  const pressureInterfaceGasCellFieldAdmission = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    sourceHotBufferKey: resolvedHotBufferKey,
    sourceSchema: sourceObject.schema || null,
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    retainedGasPressureBufferRefs: resolvedRetainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs: resolvedWorkerRetainedGasPressureBufferRefs,
    retainedGasCellFieldSource: cloneSerializableValue(retainedGasCellFieldSource),
    pressureInterfaceGasPressureCellRowCount: gasPressureCellRowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: gasPressureCellRowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: gasPressureCellRowByteLength,
    spatialGasSpeciesLedgerSchema: sourceObject.spatialGasSpeciesLedgerSchema
      || resolvedGasCellFieldSnapshot.spatialGasSpeciesLedgerSchema
      || null,
    spatialGasSpeciesLedgerStatus: sourceObject.spatialGasSpeciesLedgerStatus
      || resolvedGasCellFieldSnapshot.spatialGasSpeciesLedgerStatus
      || null,
    residentSpatialGasSpeciesLedgerStatus: sourceObject.residentSpatialGasSpeciesLedgerStatus
      || resolvedGasCellFieldSnapshot.residentSpatialGasSpeciesLedgerStatus
      || null,
    pressureFieldMode: resolvedGasCellFieldSnapshot.pressureFieldMode || null,
    pressureFieldResolution: resolvedGasCellFieldSnapshot.pressureFieldResolution || null,
    authoritativeStateMutation: false,
    stateManagerAdmitted: true
  };
  const committedAt = Date.now();
  const hotBufferRecord = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_HOT_BUFFER_PUBLICATION_SCHEMA,
    status: 'pressure-interface-gas-cell-field-admission-hot-buffer-source-stored',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    sourceSchema: sourceObject.schema || null,
    sourceMode: 'state-manager-retained-gas-cell-field-admission',
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    retainedGasPressureBufferRefs: resolvedRetainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs: resolvedWorkerRetainedGasPressureBufferRefs,
    retainedGasCellFieldSource: cloneSerializableValue(retainedGasCellFieldSource),
    pressureInterfaceGasPressureCellRowCount: gasPressureCellRowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: gasPressureCellRowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: gasPressureCellRowByteLength,
    pressureInterfaceGasCellFieldAdmission: cloneSerializableValue(pressureInterfaceGasCellFieldAdmission),
    gasCellFieldSnapshot: cloneSerializableValue(resolvedGasCellFieldSnapshot)
  };
  stateManager.setHotBuffer(resolvedHotBufferKey, hotBufferRecord);
  const deltaScope = normalizeString(scope, 'ulg-pressure-interface-gas-cell-field-admissions');
  const deltaTaskId = normalizeString(
    taskId,
    `ulg-pressure-interface-gas-cell-field-admission:${resolvedCacheKey || resolvedStateKey || resolvedHotBufferKey}`
  );
  const payload = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_HOT_BUFFER_PUBLICATION_SCHEMA,
    status: 'pressure-interface-gas-cell-field-admission-admitted',
    authority: nodeKernel ? 'nodekernel-state-manager' : 'state-manager-local-authority',
    nodeKernelPresent: Boolean(nodeKernel),
    nodeId: nodeKernel?.nodeId || null,
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    committedAt,
    sourceMode: 'state-manager-retained-gas-cell-field-admission',
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    retainedGasPressureBufferRefs: resolvedRetainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs: resolvedWorkerRetainedGasPressureBufferRefs,
    retainedGasCellFieldSource: cloneSerializableValue(retainedGasCellFieldSource),
    pressureInterfaceGasPressureCellRowCount: gasPressureCellRowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: gasPressureCellRowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: gasPressureCellRowByteLength,
    pressureInterfaceGasCellFieldAdmission: cloneSerializableValue(pressureInterfaceGasCellFieldAdmission),
    gasCellFieldSnapshot: cloneSerializableValue(resolvedGasCellFieldSnapshot)
  };
  const commitDelta = {
    taskId: deltaTaskId,
    scope: deltaScope,
    version: version ?? committedAt,
    timestamp: committedAt,
    payload
  };
  stateManager.commitDelta(commitDelta);
  return {
    ...payload,
    status: 'pressure-interface-gas-cell-field-admission-published',
    committed: true,
    hotBufferStored: Boolean(stateManager.getHotBuffer(resolvedHotBufferKey)),
    commitDeltaTaskId: deltaTaskId,
    commitDeltaScope: deltaScope,
    commitDeltaTimestamp: committedAt
  };
}

export function publishUlgPressureInterfaceWorkerRetainedHotBufferSource({
  stateManager = null,
  nodeKernel = null,
  cacheKey = null,
  stateKey = null,
  hotBufferKey = null,
  hotBufferKeyPrefix = null,
  lease = null,
  candidate = null,
  workerRunner = null,
  workerModuleUrl = null,
  sourceTaskId = null,
  sourceNodeId = 'ulg-pressure-interface-force-law',
  sourceStage = 'pressureInterface',
  scope = 'ulg-worker-retained-pressure-interface-publications',
  taskId = null,
  version = null
} = {}) {
  if (!stateManager?.setHotBuffer || !stateManager?.getHotBuffer || !stateManager?.commitDelta) {
    throw new TypeError('publishUlgPressureInterfaceWorkerRetainedHotBufferSource requires StateManager hot storage and commitDelta');
  }
  if (!candidate || typeof candidate !== 'object') {
    throw new TypeError('pressure/interface worker retained publication requires a compact publication candidate');
  }
  const workerRetainedBufferRefs = uniqueStringList(
    candidate.workerRetainedPressureBufferRefs
      || candidate.workerRetainedBufferRefs
      || candidate.retainedPressureBufferRefs
      || candidate.retainedBufferRefs
      || []
  );
  const retainedPressureBufferRefs = uniqueStringList(
    candidate.retainedPressureBufferRefs
      || candidate.workerRetainedPressureBufferRefs
      || candidate.workerRetainedBufferRefs
      || workerRetainedBufferRefs
  );
  const workerRetainedGasPressureBufferRefs = uniqueStringList(
    candidate.workerRetainedGasPressureBufferRefs
      || candidate.retainedGasPressureBufferRefs
      || []
  );
  const retainedGasPressureBufferRefs = uniqueStringList(
    candidate.retainedGasPressureBufferRefs
      || candidate.workerRetainedGasPressureBufferRefs
      || []
  );
  if (workerRetainedBufferRefs.length === 0 && retainedPressureBufferRefs.length === 0) {
    throw new TypeError('pressure/interface worker retained publication requires pressure force-row refs');
  }
  const resolvedCacheKey = normalizeString(cacheKey, candidate.cacheKey || candidate.laneId || null);
  const resolvedStateKey = normalizeString(stateKey, candidate.stateKey || null);
  const resolvedHotBufferKey = makeHotBufferKey({
    hotBufferKey,
    hotBufferKeyPrefix: hotBufferKeyPrefix || 'ulg:pressure-interface-worker-retained-hot-buffer-source',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    lease
  });
  const forceRowCount = Math.max(0, Math.trunc(finiteSeedNumber(candidate.pressureInterfaceForceRowCount, 0)));
  const forceRowStrideFloats = Math.max(0, Math.trunc(finiteSeedNumber(candidate.pressureInterfaceForceRowStrideFloats, 0)));
  const forceRowByteLength = Math.max(0, Math.trunc(finiteSeedNumber(candidate.pressureInterfaceForceRowByteLength, 0)));
  const forceRowsBufferByteLength = Math.max(0, Math.trunc(finiteSeedNumber(
    candidate.pressureInterfaceForceRowsBufferByteLength,
    forceRowByteLength
  )));
  const forceRowsBufferRetained = candidate.pressureInterfaceForceRowsBufferRetained === true
    || workerRetainedBufferRefs.length > 0;
  const localPressureGradientReady = candidate.localPressureGradientReady === true;
  const pressureInterfaceGasCellFieldAdmissionSchema = normalizeString(
    candidate.pressureInterfaceGasCellFieldAdmissionSchema
      || candidate.pressureInterfaceGasCellFieldAdmission?.schema,
    null
  );
  const pressureInterfaceGasCellFieldAdmissionStatus = normalizeString(
    candidate.pressureInterfaceGasCellFieldAdmissionStatus
      || candidate.pressureInterfaceGasCellFieldAdmission?.status,
    localPressureGradientReady ? 'pressure-interface-gas-cell-field-admission-required' : 'not-required-uniform-pressure-field'
  );
  const pressureInterfaceGasCellFieldAdmissionApproved = !localPressureGradientReady
    || (
      candidate.pressureInterfaceGasCellFieldAdmissionApproved === true
      && pressureInterfaceGasCellFieldAdmissionSchema === ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA
      && pressureInterfaceGasCellFieldAdmissionStatus === 'pressure-interface-gas-cell-field-consumption-approved'
    );
  const pressureInterfaceGasCellFieldConsumerStatus = normalizeString(
    candidate.pressureInterfaceGasCellFieldConsumerStatus,
    localPressureGradientReady
      ? (pressureInterfaceGasCellFieldAdmissionApproved
          ? 'admitted-local-gas-cell-field-consumer-ready'
          : 'blocked-local-gas-cell-field-admission-required')
      : 'uniform-pressure-field-no-local-gas-cell-admission-required'
  );
  const gasPressureCellRowCount = Math.max(0, Math.trunc(finiteSeedNumber(candidate.pressureInterfaceGasPressureCellRowCount, 0)));
  const gasPressureCellRowStrideFloats = Math.max(0, Math.trunc(finiteSeedNumber(candidate.pressureInterfaceGasPressureCellRowStrideFloats, 0)));
  const gasPressureCellRowByteLength = Math.max(0, Math.trunc(finiteSeedNumber(candidate.pressureInterfaceGasPressureCellRowByteLength, 0)));
  const gasPressureCellRowsBufferRetained = candidate.pressureInterfaceGasPressureCellRowsBufferRetained === true
    || workerRetainedGasPressureBufferRefs.length > 0
    || retainedGasPressureBufferRefs.length > 0;
  const bufferResidency = normalizeString(
    candidate.pressureInterfaceBufferResidency,
    forceRowsBufferRetained ? 'worker-lane-gpu-buffer-retained' : 'cloneable-force-row-array'
  );
  const consumerAccessProtocol = normalizeString(
    candidate.pressureInterfaceConsumerAccessProtocol,
    forceRowsBufferRetained ? 'same-worker-lane-retained-buffer-ref' : 'cloneable-force-row-array'
  );
  if (
    !forceRowsBufferRetained
    || forceRowsBufferByteLength <= 0
    || bufferResidency !== 'worker-lane-gpu-buffer-retained'
    || consumerAccessProtocol !== 'same-worker-lane-retained-buffer-ref'
  ) {
    throw new TypeError('pressure/interface worker retained publication requires worker-lane GPU retained force-row buffers');
  }
  if (
    localPressureGradientReady
    && (
      gasPressureCellRowCount <= 0
      || gasPressureCellRowByteLength <= 0
      || !gasPressureCellRowsBufferRetained
      || (workerRetainedGasPressureBufferRefs.length === 0 && retainedGasPressureBufferRefs.length === 0)
    )
  ) {
    throw new TypeError('pressure/interface local gas-cell publication requires worker-lane GPU retained gas-cell buffers');
  }
  if (localPressureGradientReady && !pressureInterfaceGasCellFieldAdmissionApproved) {
    throw new TypeError('pressure/interface local gas-cell publication requires admitted gas-cell field consumption evidence');
  }
  const committedAt = Date.now();
  const retainedGasCellFieldSourceReady = localPressureGradientReady
    && gasPressureCellRowsBufferRetained
    && gasPressureCellRowCount > 0
    && gasPressureCellRowByteLength > 0
    && (workerRetainedGasPressureBufferRefs.length > 0 || retainedGasPressureBufferRefs.length > 0);
  const retainedGasCellFieldSource = retainedGasCellFieldSourceReady
    ? {
        schema: ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA,
        status: 'pressure-interface-retained-gas-cell-field-source-ready',
        cacheKey: resolvedCacheKey,
        stateKey: resolvedStateKey,
        sourceHotBufferKey: resolvedHotBufferKey,
        sourceMode: 'worker-retained-pressure-interface-gas-cell-field-source',
        sourceSchema: candidate.schema || null,
        sourceTaskId,
        sourceNodeId,
        sourceStage,
        workerModuleUrl: workerModuleUrl || candidate.workerModuleUrl || null,
        sameDevice: candidate.sameDeviceMainThreadHandlesAvailable === true,
        workerLocal: candidate.workerLocalRetainedRefsOnly !== false,
        copyMode: 'zero-copy-worker-retained-ref-descriptor',
        bufferResidency,
        consumerAccessProtocol,
        retainedGasPressureBufferRefs,
        workerRetainedGasPressureBufferRefs,
        pressureInterfaceGasPressureCellRowCount: gasPressureCellRowCount,
        pressureInterfaceGasPressureCellRowStrideFloats: gasPressureCellRowStrideFloats,
        pressureInterfaceGasPressureCellRowByteLength: gasPressureCellRowByteLength,
        pressureInterfaceGasPressureCellRowsBufferRetained: gasPressureCellRowsBufferRetained,
        pressureFieldMode: candidate.pressureFieldMode || null,
        pressureFieldResolution: candidate.pressureFieldResolution || null,
        localPressureGradientReady,
        localPressureGradientStatus: candidate.localPressureGradientStatus || null,
        localPressureGradientForceCouplingStatus: candidate.localPressureGradientForceCouplingStatus || null,
        pressureInterfaceGasCellFieldAdmissionSchema,
        pressureInterfaceGasCellFieldAdmissionStatus,
        pressureInterfaceGasCellFieldAdmissionApproved,
        pressureInterfaceGasCellFieldConsumerStatus,
        sourceFamilies: ['resident-gas-pressure'],
        stateManagerAdmissionRequired: true,
        authoritativeStateMutation: false
      }
    : null;
  const retainedSourceFamilies = uniqueStringList(
    candidate.retainedSourceFamilies || candidate.retainedGasCellFieldSourceFamilies || (
      retainedGasCellFieldSource ? ['resident-gas-pressure'] : []
    )
  );
  const workerRetainedBufferImport = {
    schema: ULG_PRESSURE_INTERFACE_WORKER_RETAINED_BUFFER_IMPORT_SCHEMA,
    status: 'pressure-interface-worker-retained-buffer-source-ready',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    sourceHotBufferKey: resolvedHotBufferKey,
    sameDevice: candidate.sameDeviceMainThreadHandlesAvailable === true,
    workerLocal: candidate.workerLocalRetainedRefsOnly !== false,
    sourceMode: 'worker-retained-pressure-interface-force-row-refs',
    sourceSchema: candidate.schema || null,
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    workerModuleUrl: workerModuleUrl || candidate.workerModuleUrl || null,
    retainedBufferRefs: retainedPressureBufferRefs.length > 0 ? retainedPressureBufferRefs : workerRetainedBufferRefs,
    workerRetainedBufferRefs,
    workerRetainedPressureBufferRefs: uniqueStringList(candidate.workerRetainedPressureBufferRefs || []),
    retainedPressureBufferRefs,
    localBufferRefs: [],
    copyMode: 'zero-copy-worker-retained-ref-descriptor',
    bufferResidency,
    consumerAccessProtocol,
    pressureInterfaceForceRowCount: forceRowCount,
    pressureInterfaceForceRowStrideFloats: forceRowStrideFloats,
    pressureInterfaceForceRowByteLength: forceRowByteLength,
    pressureInterfaceForceRowsBufferByteLength: forceRowsBufferByteLength,
    pressureInterfaceForceRowsBufferRetained: forceRowsBufferRetained,
    pressureFieldMode: candidate.pressureFieldMode || null,
    pressureFieldResolution: candidate.pressureFieldResolution || null,
    localPressureGradientReady,
    localPressureGradientStatus: candidate.localPressureGradientStatus || null,
    localPressureGradientForceCouplingStatus: candidate.localPressureGradientForceCouplingStatus || null,
    pressureInterfaceGasCellFieldAdmissionSchema,
    pressureInterfaceGasCellFieldAdmissionStatus,
    pressureInterfaceGasCellFieldAdmissionApproved,
    pressureInterfaceGasCellFieldConsumerStatus,
    workerRetainedGasPressureBufferRefs,
    retainedGasPressureBufferRefs,
    pressureInterfaceGasPressureCellRowCount: gasPressureCellRowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: gasPressureCellRowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: gasPressureCellRowByteLength,
    pressureInterfaceGasPressureCellRowsBufferRetained: gasPressureCellRowsBufferRetained,
    retainedGasCellFieldSourceSchema: retainedGasCellFieldSource?.schema || null,
    retainedGasCellFieldSourceStatus: retainedGasCellFieldSource?.status || (
      localPressureGradientReady ? 'blocked-retained-gas-cell-field-source-required' : 'not-required-uniform-pressure-field'
    ),
    retainedGasCellFieldSourceReady: Boolean(retainedGasCellFieldSource),
    retainedGasCellFieldSource: cloneSerializableValue(retainedGasCellFieldSource),
    retainedSourceFamilies,
    stateManagerAdmissionRequired: true,
    gridForceApplicationApproved: false
  };
  const outputFamilies = uniqueStringList(candidate.outputFamilies || ['pressure-interface-force-rows']);
  const workerRetainedAccessContract = buildWorkerRetainedAccessContract({
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    sourceMode: workerRetainedBufferImport.sourceMode,
    sourceSchema: workerRetainedBufferImport.sourceSchema,
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    workerModuleUrl: workerRetainedBufferImport.workerModuleUrl,
    retainedBufferRefs: workerRetainedBufferImport.retainedBufferRefs,
    workerRetainedBufferRefs,
    outputFamilies,
    sameDeviceMainThreadHandlesAvailable: workerRetainedBufferImport.sameDevice,
    workerLocal: workerRetainedBufferImport.workerLocal,
    bufferResidency,
    consumerAccessProtocol
  });
  workerRetainedBufferImport.workerRetainedAccessContract = workerRetainedAccessContract;
  const hotBufferRecord = {
    schema: ULG_PRESSURE_INTERFACE_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA,
    status: 'worker-retained-pressure-interface-hot-buffer-source-stored',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    sourceSchema: candidate.schema || null,
    sourceMode: 'worker-retained-pressure-interface-force-row-refs',
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    sameDevice: workerRetainedBufferImport.sameDevice,
    workerLocal: workerRetainedBufferImport.workerLocal,
    copyMode: 'zero-copy-worker-retained-ref-descriptor',
    workerModuleUrl: workerRetainedBufferImport.workerModuleUrl,
    workerRunner,
    workerBackend: workerRunner,
    workerRetainedBufferRefs,
    workerRetainedPressureBufferRefs: workerRetainedBufferImport.workerRetainedPressureBufferRefs,
    retainedPressureBufferRefs,
    retainedBufferRefs: workerRetainedBufferImport.retainedBufferRefs,
    localBufferRefs: [],
    bufferResidency,
    consumerAccessProtocol,
    pressureInterfaceForceRowCount: forceRowCount,
    pressureInterfaceForceRowStrideFloats: forceRowStrideFloats,
    pressureInterfaceForceRowByteLength: forceRowByteLength,
    pressureInterfaceForceRowsBufferByteLength: forceRowsBufferByteLength,
    pressureInterfaceForceRowsBufferRetained: forceRowsBufferRetained,
    pressureFieldMode: workerRetainedBufferImport.pressureFieldMode,
    pressureFieldResolution: workerRetainedBufferImport.pressureFieldResolution,
    localPressureGradientReady,
    localPressureGradientStatus: workerRetainedBufferImport.localPressureGradientStatus,
    localPressureGradientForceCouplingStatus: workerRetainedBufferImport.localPressureGradientForceCouplingStatus,
    pressureInterfaceGasCellFieldAdmissionSchema,
    pressureInterfaceGasCellFieldAdmissionStatus,
    pressureInterfaceGasCellFieldAdmissionApproved,
    pressureInterfaceGasCellFieldConsumerStatus,
    workerRetainedGasPressureBufferRefs,
    retainedGasPressureBufferRefs,
    pressureInterfaceGasPressureCellRowCount: gasPressureCellRowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: gasPressureCellRowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: gasPressureCellRowByteLength,
    pressureInterfaceGasPressureCellRowsBufferRetained: gasPressureCellRowsBufferRetained,
    retainedGasCellFieldSourceSchema: workerRetainedBufferImport.retainedGasCellFieldSourceSchema,
    retainedGasCellFieldSourceStatus: workerRetainedBufferImport.retainedGasCellFieldSourceStatus,
    retainedGasCellFieldSourceReady: workerRetainedBufferImport.retainedGasCellFieldSourceReady,
    retainedGasCellFieldSource: workerRetainedBufferImport.retainedGasCellFieldSource,
    retainedSourceFamilies,
    pressureInterfacePublicationCandidate: cloneSerializableValue(candidate),
    workerRetainedBufferImport,
    workerRetainedAccessContract
  };
  stateManager.setHotBuffer(resolvedHotBufferKey, hotBufferRecord);
  const deltaScope = normalizeString(scope, 'ulg-worker-retained-pressure-interface-publications');
  const deltaTaskId = normalizeString(
    taskId,
    `ulg-worker-retained-pressure-interface-publication:${resolvedCacheKey || resolvedStateKey || resolvedHotBufferKey}`
  );
  const payload = {
    schema: ULG_PRESSURE_INTERFACE_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA,
    status: 'worker-retained-pressure-interface-output-admitted',
    authority: nodeKernel ? 'nodekernel-state-manager' : 'state-manager-local-authority',
    nodeKernelPresent: Boolean(nodeKernel),
    nodeId: nodeKernel?.nodeId || null,
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    committedAt,
    sameDevice: workerRetainedBufferImport.sameDevice,
    workerLocal: workerRetainedBufferImport.workerLocal,
    sourceMode: 'worker-retained-pressure-interface-force-row-refs',
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    workerModuleUrl: workerRetainedBufferImport.workerModuleUrl,
    retainedBufferRefs: workerRetainedBufferImport.retainedBufferRefs,
    workerRetainedBufferRefs,
    workerRetainedPressureBufferRefs: workerRetainedBufferImport.workerRetainedPressureBufferRefs,
    retainedPressureBufferRefs,
    localBufferRefs: [],
    bufferResidency,
    consumerAccessProtocol,
    pressureInterfaceForceRowCount: forceRowCount,
    pressureInterfaceForceRowStrideFloats: forceRowStrideFloats,
    pressureInterfaceForceRowByteLength: forceRowByteLength,
    pressureInterfaceForceRowsBufferByteLength: forceRowsBufferByteLength,
    pressureInterfaceForceRowsBufferRetained: forceRowsBufferRetained,
    pressureFieldMode: workerRetainedBufferImport.pressureFieldMode,
    pressureFieldResolution: workerRetainedBufferImport.pressureFieldResolution,
    localPressureGradientReady,
    localPressureGradientStatus: workerRetainedBufferImport.localPressureGradientStatus,
    localPressureGradientForceCouplingStatus: workerRetainedBufferImport.localPressureGradientForceCouplingStatus,
    pressureInterfaceGasCellFieldAdmissionSchema,
    pressureInterfaceGasCellFieldAdmissionStatus,
    pressureInterfaceGasCellFieldAdmissionApproved,
    pressureInterfaceGasCellFieldConsumerStatus,
    workerRetainedGasPressureBufferRefs,
    retainedGasPressureBufferRefs,
    pressureInterfaceGasPressureCellRowCount: gasPressureCellRowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: gasPressureCellRowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: gasPressureCellRowByteLength,
    pressureInterfaceGasPressureCellRowsBufferRetained: gasPressureCellRowsBufferRetained,
    retainedGasCellFieldSourceSchema: workerRetainedBufferImport.retainedGasCellFieldSourceSchema,
    retainedGasCellFieldSourceStatus: workerRetainedBufferImport.retainedGasCellFieldSourceStatus,
    retainedGasCellFieldSourceReady: workerRetainedBufferImport.retainedGasCellFieldSourceReady,
    retainedGasCellFieldSource: workerRetainedBufferImport.retainedGasCellFieldSource,
    retainedSourceFamilies,
    outputFamilies,
    gridForceApplicationApproved: false,
    pressureInterfacePublicationCandidate: cloneSerializableValue(candidate),
    workerRetainedBufferImport,
    workerRetainedAccessContract
  };
  const commitDelta = {
    taskId: deltaTaskId,
    scope: deltaScope,
    version: version ?? committedAt,
    timestamp: committedAt,
    payload
  };
  stateManager.commitDelta(commitDelta);
  return {
    ...payload,
    status: 'worker-retained-pressure-interface-output-published',
    committed: true,
    hotBufferStored: Boolean(stateManager.getHotBuffer(resolvedHotBufferKey)),
    commitDeltaTaskId: deltaTaskId,
    commitDeltaScope: deltaScope,
    commitDeltaTimestamp: committedAt
  };
}

export function publishUlgReactionProductWorkerRetainedHotBufferSource({
  stateManager = null,
  nodeKernel = null,
  cacheKey = null,
  stateKey = null,
  hotBufferKey = null,
  hotBufferKeyPrefix = null,
  lease = null,
  candidate = null,
  workerRunner = null,
  workerModuleUrl = null,
  sourceTaskId = null,
  sourceNodeId = 'ulg-reaction-product-gas-law',
  sourceStage = 'reactionProduct',
  scope = 'ulg-worker-retained-reaction-product-publications',
  taskId = null,
  version = null
} = {}) {
  if (!stateManager?.setHotBuffer || !stateManager?.getHotBuffer || !stateManager?.commitDelta) {
    throw new TypeError('publishUlgReactionProductWorkerRetainedHotBufferSource requires StateManager hot storage and commitDelta');
  }
  if (!candidate || typeof candidate !== 'object') {
    throw new TypeError('reaction/product worker retained publication requires a compact publication candidate');
  }
  const workerRetainedBufferRefs = uniqueStringList(
    candidate.workerRetainedBufferRefs
      || candidate.retainedBufferRefs
      || []
  );
  if (workerRetainedBufferRefs.length === 0) {
    throw new TypeError('reaction/product worker retained publication requires worker-retained buffer refs');
  }
  const resolvedCacheKey = normalizeString(cacheKey, candidate.cacheKey || candidate.laneId || null);
  const resolvedStateKey = normalizeString(stateKey, candidate.stateKey || null);
  const resolvedHotBufferKey = makeHotBufferKey({
    hotBufferKey,
    hotBufferKeyPrefix: hotBufferKeyPrefix || 'ulg:reaction-product-worker-retained-hot-buffer-source',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    lease
  });
  const committedAt = Date.now();
  const workerRetainedBufferImport = {
    schema: ULG_REACTION_PRODUCT_WORKER_RETAINED_BUFFER_IMPORT_SCHEMA,
    status: 'reaction-product-worker-retained-buffer-source-ready',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    sourceHotBufferKey: resolvedHotBufferKey,
    sameDevice: false,
    workerLocal: true,
    sourceMode: 'worker-retained-reaction-product-buffer-refs',
    sourceSchema: candidate.schema || null,
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    workerModuleUrl: workerModuleUrl || candidate.workerModuleUrl || null,
    retainedBufferRefs: workerRetainedBufferRefs,
    workerRetainedBufferRefs,
    localBufferRefs: [],
    copyMode: 'zero-copy-worker-retained-ref-descriptor',
    stateManagerAdmissionRequired: true
  };
  const outputFamilies = uniqueStringList(candidate.outputFamilies || [
    'sph-particle-state',
    'sph-thermo-phase',
    'mls-mpm-mechanics',
    'resident-product-mass'
  ]);
  const workerRetainedAccessContract = buildWorkerRetainedAccessContract({
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    sourceMode: workerRetainedBufferImport.sourceMode,
    sourceSchema: workerRetainedBufferImport.sourceSchema,
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    workerModuleUrl: workerRetainedBufferImport.workerModuleUrl,
    retainedBufferRefs: workerRetainedBufferRefs,
    workerRetainedBufferRefs,
    outputFamilies
  });
  workerRetainedBufferImport.workerRetainedAccessContract = workerRetainedAccessContract;
  const hotBufferRecord = {
    schema: ULG_REACTION_PRODUCT_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA,
    status: 'worker-retained-reaction-product-hot-buffer-source-stored',
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    sourceSchema: candidate.schema || null,
    sourceMode: 'worker-retained-reaction-product-buffer-refs',
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    sameDevice: false,
    workerLocal: true,
    copyMode: 'zero-copy-worker-retained-ref-descriptor',
    workerModuleUrl: workerRetainedBufferImport.workerModuleUrl,
    workerRunner,
    workerBackend: workerRunner,
    workerRetainedBufferRefs,
    retainedBufferRefs: workerRetainedBufferRefs,
    localBufferRefs: [],
    reactionProductPublicationCandidate: cloneSerializableValue(candidate),
    workerRetainedBufferImport,
    workerRetainedAccessContract
  };
  stateManager.setHotBuffer(resolvedHotBufferKey, hotBufferRecord);
  const deltaScope = normalizeString(scope, 'ulg-worker-retained-reaction-product-publications');
  const deltaTaskId = normalizeString(
    taskId,
    `ulg-worker-retained-reaction-product-publication:${resolvedCacheKey || resolvedStateKey || resolvedHotBufferKey}`
  );
  const payload = {
    schema: ULG_REACTION_PRODUCT_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA,
    status: 'worker-retained-reaction-product-output-admitted',
    authority: nodeKernel ? 'nodekernel-state-manager' : 'state-manager-local-authority',
    nodeKernelPresent: Boolean(nodeKernel),
    nodeId: nodeKernel?.nodeId || null,
    cacheKey: resolvedCacheKey,
    stateKey: resolvedStateKey,
    hotBufferKey: resolvedHotBufferKey,
    committedAt,
    sameDevice: false,
    workerLocal: true,
    sourceMode: 'worker-retained-reaction-product-buffer-refs',
    sourceTaskId,
    sourceNodeId,
    sourceStage,
    workerModuleUrl: workerRetainedBufferImport.workerModuleUrl,
    retainedBufferRefs: workerRetainedBufferRefs,
    workerRetainedBufferRefs,
    localBufferRefs: [],
    outputFamilies,
    reactionProductPublicationCandidate: cloneSerializableValue(candidate),
    workerRetainedBufferImport,
    workerRetainedAccessContract
  };
  const commitDelta = {
    taskId: deltaTaskId,
    scope: deltaScope,
    version: version ?? committedAt,
    timestamp: committedAt,
    payload
  };
  stateManager.commitDelta(commitDelta);
  return {
    ...payload,
    status: 'worker-retained-reaction-product-output-published',
    committed: true,
    hotBufferStored: Boolean(stateManager.getHotBuffer(resolvedHotBufferKey)),
    commitDeltaTaskId: deltaTaskId,
    commitDeltaScope: deltaScope,
    commitDeltaTimestamp: committedAt
  };
}

export function createUlgSphMlsMpmHotBufferRefreshExecutor({
  device,
  materialProperties = null,
  hotBufferKey = null,
  hotBufferKeyPrefix = null
} = {}) {
  const executor = async ({
    cacheKey,
    stateSeedPayload,
    stateManager,
    lease
  } = {}) => refreshUlgSphMlsMpmHotBuffersFromRemoteSeed({
    device,
    stateSeedPayload,
    materialProperties,
    stateManager,
    cacheKey,
    lease,
    hotBufferKey,
    hotBufferKeyPrefix
  });
  executor.schema = ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_EXECUTOR_SCHEMA;
  return executor;
}

export function refreshUlgSphMlsMpmHotBuffersFromCompactCandidate({
  device,
  compactCandidateAuthority = null,
  compactCandidate = null,
  sameDeviceRetainedBufferImport = null,
  stateSeedPayload = null,
  materialProperties = null,
  stateManager = null,
  cacheKey = null,
  stateKey = null,
  lease = null,
  hotBufferKey = null,
  hotBufferKeyPrefix = null
} = {}) {
  const candidate = compactCandidate || compactCandidateAuthority?.compactCandidate || {};
  const localStateSeedPayload = stateSeedPayload
    || candidate.localStateSeedPayload
    || candidate.stateSeedPayload
    || compactCandidateAuthority?.localStateSeedPayload
    || compactCandidateAuthority?.stateSeedPayload
    || null;
  const compactBufferSnapshot = candidate.compactBufferSnapshot
    || candidate.localCompactBufferSnapshot
    || compactCandidateAuthority?.compactBufferSnapshot
    || compactCandidateAuthority?.localCompactBufferSnapshot
    || null;
  const sameDeviceImport = sameDeviceRetainedBufferImport
    || candidate.sameDeviceRetainedBufferImport
    || candidate.localSameDeviceRetainedBufferImport
    || compactCandidateAuthority?.sameDeviceRetainedBufferImport
    || compactCandidateAuthority?.localSameDeviceRetainedBufferImport
    || null;
  const resolvedCacheKey = normalizeString(cacheKey, candidate.cacheKey || compactCandidateAuthority?.cacheKey || null);
  const remoteRetainedBufferRefs = uniqueStringList(
    candidate.retainedBufferRefs || compactCandidateAuthority?.retainedBufferRefs || []
  );
  const localRefreshContract = candidate.localRefreshContract || compactCandidateAuthority?.localRefreshContract || null;
  if (sameDeviceImport) {
    const refresh = refreshUlgSphMlsMpmHotBuffersFromSameDeviceRetainedBufferImport({
      sameDeviceRetainedBufferImport: sameDeviceImport,
      stateManager,
      cacheKey: resolvedCacheKey,
      stateKey,
      lease,
      hotBufferKey,
      hotBufferKeyPrefix,
      compactCandidate: candidate,
      compactCandidateAuthority
    });
    return {
      ...refresh,
      compactCandidateSchema: candidate.schema || null,
      compactCandidateHash: candidate.hash || refresh.compactCandidateHash || null,
      localRefreshContract,
      remoteRetainedBufferRefs
    };
  }
  if (compactBufferSnapshot) {
    const refresh = refreshUlgSphMlsMpmHotBuffersFromCompactSnapshot({
      device,
      compactBufferSnapshot,
      materialProperties,
      stateManager,
      cacheKey: resolvedCacheKey,
      stateKey,
      lease,
      hotBufferKey,
      hotBufferKeyPrefix,
      compactCandidate: candidate,
      compactCandidateAuthority
    });
    return {
      ...refresh,
      compactCandidateSchema: candidate.schema || null,
      compactCandidateHash: candidate.hash || refresh.compactCandidateHash || null,
      localRefreshContract,
      remoteRetainedBufferRefs
    };
  }
  if (!localStateSeedPayload) {
    return {
      schema: ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA,
      status: 'blocked-compact-candidate-local-source-required',
      refreshed: false,
      executorSchema: ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_EXECUTOR_SCHEMA,
      sourceMode: 'compact-candidate',
      reason: 'compact-candidate-does-not-include-local-refresh-source',
      cacheKey: resolvedCacheKey,
      compactCandidateSchema: candidate.schema || null,
      compactCandidateHash: candidate.hash || null,
      localRefreshContract,
      remoteRetainedBufferRefs,
      localBufferRefs: [],
      retainedBufferRefs: [],
      gpuFence: {
        status: 'not-submitted',
        method: 'compact-candidate-local-source-required'
      }
    };
  }
  const refresh = refreshUlgSphMlsMpmHotBuffersFromRemoteSeed({
    device,
    stateSeedPayload: localStateSeedPayload,
    materialProperties,
    stateManager,
    cacheKey: resolvedCacheKey,
    stateKey,
    lease,
    hotBufferKey,
    hotBufferKeyPrefix
  });
  return {
    ...refresh,
    sourceMode: 'compact-candidate',
    compactCandidateSchema: candidate.schema || null,
    compactCandidateHash: candidate.hash || null,
    localRefreshContract,
    remoteRetainedBufferRefs
  };
}

export function createUlgSphMlsMpmCompactHotBufferRefreshExecutor({
  device,
  materialProperties = null,
  hotBufferKey = null,
  hotBufferKeyPrefix = null
} = {}) {
  const executor = async ({
    cacheKey,
    compactCandidateAuthority,
    compactCandidate,
    sameDeviceRetainedBufferImport,
    stateSeedPayload,
    stateManager,
    lease
  } = {}) => refreshUlgSphMlsMpmHotBuffersFromCompactCandidate({
    device,
    compactCandidateAuthority,
    compactCandidate,
    stateSeedPayload,
    materialProperties,
    stateManager,
    cacheKey,
    lease,
    hotBufferKey,
    hotBufferKeyPrefix
  });
  executor.schema = ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_EXECUTOR_SCHEMA;
  executor.sourceMode = 'compact-candidate';
  return executor;
}

async function importPeerComputeModule(moduleUrl) {
  const resolvedUrl = normalizeString(moduleUrl, null);
  if (!resolvedUrl) return {};
  return import(
    /* @vite-ignore */
    resolvedUrl
  );
}

async function importPeerComputeClasses({
  peercomputeModuleUrl = null,
  nodeKernelModuleUrl = DEFAULT_PEERCOMPUTE_NODE_KERNEL_MODULE_URL,
  computeManagerModuleUrl = DEFAULT_PEERCOMPUTE_COMPUTE_MANAGER_MODULE_URL,
  stateManagerModuleUrl = DEFAULT_PEERCOMPUTE_STATE_MANAGER_MODULE_URL,
  gpuHubModuleUrl = DEFAULT_PEERCOMPUTE_GPU_HUB_MODULE_URL,
  remoteResultQuorumModuleUrl = DEFAULT_PEERCOMPUTE_REMOTE_RESULT_QUORUM_MODULE_URL
} = {}) {
  const bundled = peercomputeModuleUrl
    ? await importPeerComputeModule(peercomputeModuleUrl)
    : {};
  const nodeKernelModule = bundled.NodeKernel
    ? bundled
    : await importPeerComputeModule(nodeKernelModuleUrl);
  const computeModule = bundled.ComputeManager
    ? bundled
    : await importPeerComputeModule(computeManagerModuleUrl);
  const stateModule = bundled.StateManager
    ? bundled
    : await importPeerComputeModule(stateManagerModuleUrl);
  let gpuModule = bundled.GPUHubManager ? bundled : {};
  if (!gpuModule.GPUHubManager && gpuHubModuleUrl) {
    try {
      gpuModule = await importPeerComputeModule(gpuHubModuleUrl);
    } catch (_) {
      gpuModule = {};
    }
  }
  let quorumModule = bundled.createRemoteResultQuorumValidator ? bundled : {};
  if (!quorumModule.createRemoteResultQuorumValidator && remoteResultQuorumModuleUrl) {
    try {
      quorumModule = await importPeerComputeModule(remoteResultQuorumModuleUrl);
    } catch (_) {
      quorumModule = {};
    }
  }
  return {
    NodeKernel: bundled.NodeKernel || nodeKernelModule.NodeKernel || null,
    ComputeManager: bundled.ComputeManager || computeModule.ComputeManager,
    StateManager: bundled.StateManager || stateModule.StateManager,
    GPUHubManager: bundled.GPUHubManager || gpuModule.GPUHubManager || null,
    createResidentStageWorkerBackend: bundled.createResidentStageWorkerBackend
      || gpuModule.createResidentStageWorkerBackend
      || null,
    createRemoteResultQuorumValidator: bundled.createRemoteResultQuorumValidator
      || quorumModule.createRemoteResultQuorumValidator
      || null
  };
}

function createNodeKernelFacade({
  hostId,
  computeManager,
  stateManager,
  gpuHub = null,
  config = {}
}) {
  return {
    schema: ULG_PEERCOMPUTE_NODEKERNEL_FACADE_SCHEMA,
    status: 'local-managers-initialized',
    hostId,
    config: { ...config },
    getComputeManager() {
      return computeManager;
    },
    getStateManager() {
      return stateManager;
    },
    getGPUHub() {
      return gpuHub;
    }
  };
}

function createDefaultNodeKernelConfig({
  docName,
  deltaNamespace,
  enablePersistence,
  disableNetworkProvider,
  disableBroadcast,
  enableWorkers,
  enableWebGPU,
  nodeKernelConfig = {}
}) {
  return {
    topology: 'distributed',
    topologyId: 'ulg-browser-resident-authority',
    roomId: docName,
    gameId: 'ulg',
    topicPrefix: 'ulg',
    useScopedTopics: true,
    storageMode: 'local',
    enableWebGPU,
    enableWorkers,
    enableGPUHub: true,
    enablePersistence,
    disableStateNetworkProvider: disableNetworkProvider,
    disableStateBroadcast: disableBroadcast,
    docName,
    deltaNamespace,
    bootstrapPeers: [],
    enableNetVizDebugTelemetry: false,
    enableNetVizSessionBroadcast: false,
    enableNetVizSessionDiscovery: false,
    enableRemoteComputeResponder: false,
    allowRemoteFunctionTasks: false,
    clockPolicy: { mode: 'independent', tickHz: 30, networkProfile: null },
    maxConnections: 0,
    maxIncomingPendingConnections: 0,
    maxParallelDials: 1,
    maxDialQueueLength: 1,
    maxPeerAddrsToDial: 1,
    ...nodeKernelConfig
  };
}

function createRemotePlacementAdmission({ admissionId }) {
  const admission = (payload = {}, context = {}) => ({
    schema: ULG_PEERCOMPUTE_REMOTE_PLACEMENT_ADMISSION_SCHEMA,
    admissionId,
    accepted: true,
    reason: 'ulg-remote-placement-gate-accepted',
    requestedPlacement: context?.placement?.requestedPlacement || null,
    solverId: payload?.solverId || null,
    taskFamily: payload?.taskFamily || null,
    gpuFenceRequired: payload?.gpuFence?.required === true,
    decidedAt: Date.now()
  });
  admission.placementAdmissionId = admissionId;
  return admission;
}

function summarizeRemotePlacementGate({
  nodeKernel = null,
  nodeKernelMode = 'facade',
  computeManager = null,
  remotePlacementConfig = null,
  remotePlacementCleared = false
} = {}) {
  const capabilities = computeManager?.getCapabilities?.() || {};
  const isRealNodeKernel = nodeKernelMode === 'real-peercompute-nodekernel';
  const nodeKernelStarted = nodeKernel?.isStarted === true;
  const networkManager = nodeKernel?.getNetworkManager?.() || nodeKernel?.networkManager || null;
  const networkStats = networkManager?.getNetworkStats?.() || {};
  const configured = Boolean(remotePlacementConfig?.primaryPeerId && capabilities.placementExecutor);
  const readyToPlace = Boolean(configured && isRealNodeKernel && nodeKernelStarted);
  const issues = [];
  if (!isRealNodeKernel) issues.push('real-nodekernel-required');
  if (!configured && !remotePlacementCleared) issues.push('remote-placement-not-configured');
  if (configured && !nodeKernelStarted) issues.push('nodekernel-network-not-started');
  if (configured && !capabilities.placementExecutor) issues.push('compute-manager-placement-executor-missing');
  if (remotePlacementConfig?.quorumEnabled && !capabilities.placementResultValidator) {
    issues.push('remote-result-quorum-validator-missing');
  }
  const status = remotePlacementCleared
    ? 'cleared'
    : !configured
      ? 'not-configured'
      : readyToPlace
        ? 'ready'
        : 'configured-network-not-started';
  return {
    schema: ULG_PEERCOMPUTE_REMOTE_PLACEMENT_GATE_SCHEMA,
    status,
    configured,
    readyToPlace,
    nodeKernelMode,
    nodeKernelStarted,
    networkConnected: networkStats?.isConnected === true,
    localPeerId: networkStats?.peerId || null,
    primaryPeerId: remotePlacementConfig?.primaryPeerId || null,
    replicaPeerIds: [...(remotePlacementConfig?.replicaPeerIds || [])],
    targetReplicaCount: remotePlacementConfig?.targetReplicaCount ?? null,
    quorumEnabled: remotePlacementConfig?.quorumEnabled === true,
    quorumResultCount: remotePlacementConfig?.quorumResultCount ?? null,
    executorId: capabilities.placementExecutorId || remotePlacementConfig?.executorId || null,
    admissionId: capabilities.placementAdmissionId || remotePlacementConfig?.admissionId || null,
    resultValidatorId: capabilities.placementResultValidatorId || remotePlacementConfig?.resultValidatorId || null,
    placementTimeoutMs: capabilities.placementTimeoutMs ?? remotePlacementConfig?.timeoutMs ?? null,
    remoteResultVerification: capabilities.remoteResultVerification === true,
    issues
  };
}

function createLawGraphNodeMetadata({
  nodeId,
  solverId,
  family,
  order,
  dependsOn = [],
  runtimeTarget = 'webgpu-resident-lane-child',
  cachePolicy = 'hot-gpu-lane-with-warm-closure-tables',
  validationGates = []
}) {
  return {
    schema: 'peercompute.ulg.law-graph-node-task-ref.v0',
    graphSchema: ULG_RESIDENT_LAW_GRAPH_SCHEMA,
    graphId: ULG_RESIDENT_LAW_GRAPH_ID,
    nodeId,
    solverId,
    family,
    order,
    parentNodeId: ULG_RESIDENT_PASS_DAG_NODE_ID,
    dependsOn,
    runtimeTarget,
    cachePolicy,
    validationGates: [
      'resident-authority-ledger',
      'gpu-fence-report',
      'state-manager-warm-delta',
      'cpu-reference-oracle',
      'visual-sequence-sanity',
      ...validationGates
    ]
  };
}

function createStateFamilyContract({
  nodeId,
  solverId,
  readFamilies = [],
  authoritativeWriteFamilies = [],
  transientWriteFamilies = [],
  diagnosticWriteFamilies = [],
  borrowedFamilies = [],
  currentAuthority = false,
  admissionMode = 'metadata-only-via-parent-pass-dag',
  authorityStatus = currentAuthority ? 'current-executable-authority' : 'prospective-authority-after-promotion',
  promotionPriority = null,
  promotionStatus = 'not-promoted',
  requiredAdmissionEvidence = [],
  mustNotWriteFamilies = null
} = {}) {
  const authoritativeWrites = uniqueStringList(authoritativeWriteFamilies);
  const transientWrites = uniqueStringList(transientWriteFamilies);
  const diagnosticWrites = uniqueStringList(diagnosticWriteFamilies);
  const explicitMustNotWriteFamilies = Array.isArray(mustNotWriteFamilies)
    ? uniqueStringList(mustNotWriteFamilies)
    : Object.values(RESIDENT_STATE_FAMILIES)
      .filter((family) => !authoritativeWrites.includes(family)
        && !transientWrites.includes(family)
        && !diagnosticWrites.includes(family));
  return {
    schema: ULG_RESIDENT_LAW_STATE_FAMILY_CONTRACT_SCHEMA,
    nodeId,
    solverId,
    readFamilies: uniqueStringList(readFamilies),
    authoritativeWriteFamilies: authoritativeWrites,
    transientWriteFamilies: transientWrites,
    diagnosticWriteFamilies: diagnosticWrites,
    borrowedFamilies: uniqueStringList(borrowedFamilies),
    mustNotWriteFamilies: explicitMustNotWriteFamilies,
    currentAuthority: currentAuthority === true,
    authorityStatus,
    admissionMode,
    promotionPriority: promotionPriority == null
      ? null
      : (Number.isFinite(Number(promotionPriority)) ? Number(promotionPriority) : null),
    promotionStatus,
    requiredAdmissionEvidence: uniqueStringList([
      'resident-authority-ledger',
      'gpu-fence-report',
      'state-manager-admission',
      ...requiredAdmissionEvidence
    ])
  };
}

export function createUlgResidentLawFamilyDescriptors() {
  const commonValidity = {
    units: 'SI',
    scaleRegime: 'continuum-particle',
    authority: 'NodeKernel/ComputeManager/StateManager',
    scientificValidation: false,
    independentExecutionValidation: false,
    fullPhysicsValidation: false
  };
  const commonWebGpu = {
    residency: 'gpu-lane-child-metadata',
    requiresQueueFence: true,
    lanePolicy: 'same-device-state-key',
    parentSolverId: ULG_RESIDENT_PASS_DAG_SOLVER_ID
  };
  const createDescriptor = ({
    id,
    kind,
    label,
    description,
    nodeId,
    family,
    order,
    dependsOn,
    inputFields,
    outputFields,
    conservedFields = [],
    cachePolicy,
    validationGates = [],
    stateFamilyContract = null
  }) => ({
    id,
    kind,
    version: '0.1.0',
    label,
    description,
    runtime: 'metadata',
    webgpu: { ...commonWebGpu },
    inputFields,
    outputFields,
    conservedFields,
    timestep: {
      mode: 'parent-pass-dag-substep',
      maxDt: null,
      subcycles: 1
    },
    affinity: {
      policy: 'state-key',
      keyFields: ['solverId', 'stateKey', 'domainKey', 'lawFamily']
    },
    warmDelta: {
      scope: ULG_RESIDENT_LAW_FAMILY_METADATA_SCOPE,
      schema: `peercompute.ulg.${id}.metadata-delta.v0`
    },
    validity: { ...commonValidity },
    metadata: {
      lawGraphNode: createLawGraphNodeMetadata({
        nodeId,
        solverId: id,
        family,
        order,
        dependsOn,
        cachePolicy,
        validationGates
      }),
      source: 'ulg-browser-resident-authority-host',
      parentLawGraphNodeId: ULG_RESIDENT_PASS_DAG_NODE_ID,
      parentSolverId: ULG_RESIDENT_PASS_DAG_SOLVER_ID,
      executableStatus: 'metadata-only-pass-dag-child',
      stateFamilyContract: stateFamilyContract || createStateFamilyContract({
        nodeId,
        solverId: id,
        promotionStatus: 'metadata-only-not-promoted'
      }),
      firstPrinciplesStatus: 'evidence-gated',
      authoritativeMutation: 'state-manager-admitted-delta-via-parent-pass-dag',
      requiredBeforeIndependentExecution: [
        'cpu-reference-oracle-parity',
        'law-family-state-owner-metadata',
        'same-device-gpu-lane-lease-and-fence',
        'committed-delta-admission',
        'visual-sequence-sanity'
      ]
    }
  });

  return [
    createDescriptor({
      id: 'ulg-mls-mpm-mechanics-law',
      kind: 'mls-mpm-mechanics-law-family',
      label: 'ULG MLS-MPM mechanics law family',
      description: 'Metadata authority node for deformation, transfer, gravity, boundary, and mechanics state updates currently executed inside the resident pass DAG.',
      nodeId: 'ulg-mls-mpm-mechanics-law',
      family: 'mechanics',
      order: 10,
      dependsOn: [],
      inputFields: [
        { name: 'sph-particle-state', unit: 'SI', location: 'resident-gpu-buffer', role: 'read' },
        { name: 'mls-mpm-mechanics', unit: 'SI', location: 'resident-gpu-buffer', role: 'read' },
        { name: 'pressure-interface-force-rows', unit: 'N', location: 'resident-gpu-buffer', role: 'read' }
      ],
      outputFields: [
        { name: 'sph-particle-state', unit: 'SI', location: 'resident-gpu-buffer', role: 'write' },
        { name: 'mls-mpm-mechanics', unit: 'SI', location: 'resident-gpu-buffer', role: 'write' }
      ],
      conservedFields: [
        { name: 'mass', unit: 'kg', role: 'conservation-check' },
        { name: 'linear-momentum', unit: 'kg*m/s', role: 'diagnostic' }
      ],
      validationGates: ['volume-stability', 'settling-oracle'],
      stateFamilyContract: createStateFamilyContract({
        nodeId: 'ulg-mls-mpm-mechanics-law',
        solverId: 'ulg-mls-mpm-mechanics-law',
        readFamilies: [
          RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
          RESIDENT_STATE_FAMILIES.MECHANICS,
          RESIDENT_STATE_FAMILIES.PRESSURE_INTERFACE
        ],
        authoritativeWriteFamilies: [
          RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
          RESIDENT_STATE_FAMILIES.MECHANICS
        ],
        borrowedFamilies: [
          RESIDENT_STATE_FAMILIES.PRESSURE_INTERFACE
        ],
        promotionPriority: 1,
        promotionStatus: 'first-promotion-candidate',
        requiredAdmissionEvidence: [
          'zero-force-rest-oracle',
          'gravity-only-oracle',
          'volume-stability',
          'pressure-disabled-ablation',
          'mechanics-only-child-task-envelope',
          'mechanics-child-stage-kernel-evidence',
          'mechanics-child-p2g-stage-evidence',
          'mechanics-child-grid-update-stage-evidence',
          'mechanics-child-g2p-stage-evidence',
          'mechanics-child-dry-run-parity'
        ]
      })
    }),
    createDescriptor({
      id: 'ulg-thermal-phase-law',
      kind: 'thermal-phase-law-family',
      label: 'ULG thermal and phase law family',
      description: 'Metadata authority node for wall heat transfer, temperature, latent heat, and phase classification currently executed inside the resident pass DAG.',
      nodeId: 'ulg-thermal-phase-law',
      family: 'thermal-phase',
      order: 20,
      dependsOn: ['ulg-mls-mpm-mechanics-law'],
      inputFields: [
        { name: 'sph-particle-state', unit: 'SI', location: 'resident-gpu-buffer', role: 'read' },
        { name: 'material-thermal-closures', unit: 'SI', location: 'closure-cache', role: 'read' },
        { name: 'wall-heat-boundary', unit: 'K', location: 'scenario-config', role: 'read' }
      ],
      outputFields: [
        { name: 'sph-thermo-phase', unit: 'SI', location: 'resident-gpu-buffer', role: 'write' }
      ],
      conservedFields: [
        { name: 'energy', unit: 'J', role: 'diagnostic' }
      ],
      validationGates: ['phase-boundary-oracle', 'energy-ledger'],
      stateFamilyContract: createStateFamilyContract({
        nodeId: 'ulg-thermal-phase-law',
        solverId: 'ulg-thermal-phase-law',
        readFamilies: [
          RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
          RESIDENT_STATE_FAMILIES.MECHANICS,
          RESIDENT_STATE_FAMILIES.THERMO_PHASE
        ],
        authoritativeWriteFamilies: [
          RESIDENT_STATE_FAMILIES.THERMO_PHASE
        ],
        promotionStatus: 'blocked-on-mechanics-promotion',
        requiredAdmissionEvidence: [
          'phase-boundary-oracle',
          'energy-ledger',
          'wall-heat-boundary-contract'
        ]
      })
    }),
    createDescriptor({
      id: 'ulg-reaction-product-gas-law',
      kind: 'reaction-product-gas-law-family',
      label: 'ULG reaction, product, and gas law family',
      description: 'Metadata authority node for reaction closures, product mass, gas ledgers, and first-principles chemistry scoping currently executed inside the resident pass DAG.',
      nodeId: 'ulg-reaction-product-gas-law',
      family: 'reaction-product-gas',
      order: 30,
      dependsOn: ['ulg-thermal-phase-law'],
      inputFields: [
        { name: 'sph-particle-state', unit: 'SI', location: 'resident-gpu-buffer', role: 'read' },
        { name: 'sph-thermo-phase', unit: 'SI', location: 'resident-gpu-buffer', role: 'read' },
        { name: 'reaction-closure-table', unit: 'SI', location: 'closure-cache', role: 'read' },
        { name: 'sedenion-periodic-table-scope', unit: null, location: 'closure-cache', role: 'read' }
      ],
      outputFields: [
        { name: 'resident-product-mass', unit: 'kg/mol', location: 'resident-gpu-buffer', role: 'write' },
        { name: 'resident-gas-ledger', unit: 'SI', location: 'resident-gpu-buffer', role: 'write' }
      ],
      conservedFields: [
        { name: 'mass', unit: 'kg', role: 'conservation-check' },
        { name: 'species', unit: 'mol', role: 'diagnostic' }
      ],
      cachePolicy: 'warm-closure-table-with-sedenion-reaction-scope',
      validationGates: ['reaction-mass-ledger', 'sedenion-scope-check'],
      stateFamilyContract: createStateFamilyContract({
        nodeId: 'ulg-reaction-product-gas-law',
        solverId: 'ulg-reaction-product-gas-law',
        readFamilies: [
          RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
          RESIDENT_STATE_FAMILIES.THERMO_PHASE,
          RESIDENT_STATE_FAMILIES.REACTION_PRODUCTS
        ],
        authoritativeWriteFamilies: [
          RESIDENT_STATE_FAMILIES.REACTION_PRODUCTS,
          RESIDENT_STATE_FAMILIES.GAS_PRESSURE
        ],
        promotionStatus: 'blocked-on-thermal-phase-promotion',
        requiredAdmissionEvidence: [
          'reaction-mass-ledger',
          'species-ledger',
          'sedenion-scope-check'
        ]
      })
    }),
    createDescriptor({
      id: 'ulg-pressure-interface-law',
      kind: 'pressure-interface-law-family',
      label: 'ULG pressure and interface law family',
      description: 'Metadata authority node for pressure, surface/interface coupling, and cross-material force rows currently executed inside the resident pass DAG.',
      nodeId: 'ulg-pressure-interface-law',
      family: 'pressure-interface',
      order: 40,
      dependsOn: ['ulg-reaction-product-gas-law'],
      inputFields: [
        { name: 'sph-particle-state', unit: 'SI', location: 'resident-gpu-buffer', role: 'read' },
        { name: 'sph-thermo-phase', unit: 'SI', location: 'resident-gpu-buffer', role: 'read' },
        { name: 'resident-gas-ledger', unit: 'SI', location: 'resident-gpu-buffer', role: 'read' },
        { name: 'material-interface-field', unit: 'SI', location: 'resident-gpu-buffer', role: 'read' }
      ],
      outputFields: [
        { name: 'pressure-interface-force-rows', unit: 'N', location: 'resident-gpu-buffer', role: 'write' }
      ],
      conservedFields: [
        { name: 'linear-momentum', unit: 'kg*m/s', role: 'diagnostic' },
        { name: 'energy', unit: 'J', role: 'diagnostic' }
      ],
      validationGates: ['pressure-disable-ablation', 'interface-force-ledger'],
      stateFamilyContract: createStateFamilyContract({
        nodeId: 'ulg-pressure-interface-law',
        solverId: 'ulg-pressure-interface-law',
        readFamilies: [
          RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
          RESIDENT_STATE_FAMILIES.THERMO_PHASE,
          RESIDENT_STATE_FAMILIES.GAS_PRESSURE,
          RESIDENT_STATE_FAMILIES.PRESSURE_INTERFACE
        ],
        authoritativeWriteFamilies: [
          RESIDENT_STATE_FAMILIES.PRESSURE_INTERFACE
        ],
        promotionStatus: 'blocked-on-reaction-product-gas-promotion',
        requiredAdmissionEvidence: [
          'pressure-disable-ablation',
          'interface-force-ledger',
          'zero-render-cadence-dependence'
        ]
      })
    })
  ];
}

function hasExecutableTarget(descriptor = {}) {
  return descriptor.hasExecutor === true
    || Boolean(descriptor.module || descriptor.fn || descriptor.wasm || descriptor.wasmSource || descriptor.source);
}

function cloneFields(fields = []) {
  return Array.isArray(fields)
    ? fields.map((field) => ({ ...field }))
    : [];
}

function fieldNames(fields = []) {
  return cloneFields(fields)
    .map((field) => String(field?.name || '').trim())
    .filter(Boolean);
}

function cloneStateFamilyContract(contract = null) {
  if (!contract || typeof contract !== 'object') return null;
  return {
    ...contract,
    readFamilies: uniqueStringList(contract.readFamilies),
    authoritativeWriteFamilies: uniqueStringList(contract.authoritativeWriteFamilies),
    transientWriteFamilies: uniqueStringList(contract.transientWriteFamilies),
    diagnosticWriteFamilies: uniqueStringList(contract.diagnosticWriteFamilies),
    borrowedFamilies: uniqueStringList(contract.borrowedFamilies),
    mustNotWriteFamilies: uniqueStringList(contract.mustNotWriteFamilies),
    requiredAdmissionEvidence: uniqueStringList(contract.requiredAdmissionEvidence)
  };
}

function addOwnerEntry(ownerMap, family, node) {
  if (!family) return;
  if (!ownerMap[family]) ownerMap[family] = [];
  ownerMap[family].push({
    schema: 'peercompute.ulg.law-state-family-owner-ref.v0',
    family,
    nodeId: node.nodeId,
    solverId: node.solverId,
    currentAuthority: node.currentAuthority,
    authorityStatus: node.authorityStatus,
    admissionMode: node.admissionMode,
    executableStatus: node.executableStatus,
    promotionStatus: node.promotionStatus,
    promotionPriority: node.promotionPriority
  });
}

function evidenceKeys(evidence = {}) {
  if (Array.isArray(evidence)) return uniqueStringList(evidence);
  if (evidence instanceof Set) return uniqueStringList(Array.from(evidence));
  if (!evidence || typeof evidence !== 'object') return [];
  const keys = [];
  const listFields = [
    evidence.evidence,
    evidence.passedEvidence,
    evidence.passed,
    evidence.satisfied,
    evidence.satisfiedEvidence
  ];
  for (const list of listFields) {
    keys.push(...uniqueStringList(list));
  }
  for (const [key, value] of Object.entries(evidence)) {
    if (value === true) keys.push(key);
  }
  return uniqueStringList(keys);
}

export function runUlgMechanicsPromotionEvidenceTask(data = {}) {
  const uniqueList = (values = []) => {
    const source = Array.isArray(values) ? values : (values == null ? [] : [values]);
    return Array.from(new Set(
      source.map((entry) => String(entry ?? '').trim()).filter(Boolean)
    ));
  };
  const firstNumber = (entry, fields = [], fallback = null) => {
    if (!entry || typeof entry !== 'object') return fallback;
    for (const field of fields) {
      const value = Number(entry[field]);
      if (Number.isFinite(value)) return value;
    }
    return fallback;
  };
  const firstString = (entry, fields = [], fallback = '') => {
    if (!entry || typeof entry !== 'object') return fallback;
    for (const field of fields) {
      const value = typeof entry[field] === 'string' ? entry[field].trim() : '';
      if (value) return value;
    }
    return fallback;
  };
  const checkFrom = (source, names = []) => {
    if (!source || typeof source !== 'object') return null;
    for (const name of names) {
      if (source[name] != null) return source[name];
    }
    return null;
  };
  const hasGoodStatus = (entry) => {
    if (entry === true) return true;
    if (!entry || typeof entry !== 'object') return false;
    if (entry.passed === true || entry.accepted === true || entry.ok === true) return true;
    const status = firstString(entry, ['status', 'reason', 'result']).toLowerCase();
    return ['pass', 'passed', 'ready', 'accepted', 'ok', 'good', 'stable'].includes(status)
      || status.endsWith('-pass')
      || status.endsWith('-ready')
      || status.endsWith('-accepted');
  };
  const absWithin = (entry, fields, toleranceFields, fallbackTolerance) => {
    if (!entry || typeof entry !== 'object') return true;
    const value = firstNumber(entry, fields, null);
    if (value == null) return true;
    const tolerance = Math.max(0, firstNumber(entry, toleranceFields, fallbackTolerance));
    return Math.abs(value) <= tolerance;
  };
  const rangeWithin = (entry, minFields, maxFields, fallbackMin, fallbackMax) => {
    if (!entry || typeof entry !== 'object') return true;
    const minValue = firstNumber(entry, minFields, null);
    const maxValue = firstNumber(entry, maxFields, null);
    const allowedMin = firstNumber(entry, ['minAllowedJ', 'minAllowed', 'lowerBound'], fallbackMin);
    const allowedMax = firstNumber(entry, ['maxAllowedJ', 'maxAllowed', 'upperBound'], fallbackMax);
    if (minValue != null && minValue < allowedMin) return false;
    if (maxValue != null && maxValue > allowedMax) return false;
    return true;
  };
  const mechanicsEvidence = data.mechanicsEvidence
    || data.evidenceReport
    || data.structuredEvidence
    || {};
  const requiredEvidence = uniqueList(data.requiredEvidence || []);
  const checks = {};
  const issues = [];
  const satisfiedEvidence = [];
  const record = (key, passed, issue, detail = {}) => {
    checks[key] = { key, passed: passed === true, ...detail };
    if (passed === true) {
      satisfiedEvidence.push(key);
    } else {
      issues.push(issue || `${key}-missing-or-failed`);
    }
  };

  const zeroForce = checkFrom(mechanicsEvidence, [
    'zeroForceRest',
    'zeroForceRestOracle',
    'zero-force-rest-oracle'
  ]);
  const zeroForcePassed = hasGoodStatus(zeroForce)
    && absWithin(zeroForce, ['maxDisplacementM', 'positionErrorM'], ['toleranceM', 'maxAllowedDisplacementM'], 1e-6)
    && absWithin(zeroForce, ['maxVelocityMPerS', 'velocityErrorMPerS'], ['toleranceVelocityMPerS', 'maxAllowedVelocityMPerS'], 1e-6)
    && absWithin(zeroForce, ['maxVolumeRatioDelta', 'volumeRatioDelta'], ['toleranceJ', 'maxAllowedVolumeRatioDelta'], 1e-6);
  record('zero-force-rest-oracle', zeroForcePassed, 'zero-force-rest-oracle-failed', {
    maxDisplacementM: firstNumber(zeroForce, ['maxDisplacementM', 'positionErrorM'], null),
    maxVelocityMPerS: firstNumber(zeroForce, ['maxVelocityMPerS', 'velocityErrorMPerS'], null),
    maxVolumeRatioDelta: firstNumber(zeroForce, ['maxVolumeRatioDelta', 'volumeRatioDelta'], null)
  });

  const gravityOnly = checkFrom(mechanicsEvidence, [
    'gravityOnly',
    'gravityOnlyOracle',
    'gravity-only-oracle'
  ]);
  const gravityOnlyPassed = hasGoodStatus(gravityOnly)
    && absWithin(gravityOnly, ['positionErrorM', 'maxPositionErrorM'], ['toleranceM', 'maxAllowedPositionErrorM'], 1e-5)
    && absWithin(gravityOnly, ['velocityErrorMPerS', 'maxVelocityErrorMPerS'], ['toleranceVelocityMPerS', 'maxAllowedVelocityErrorMPerS'], 1e-5);
  record('gravity-only-oracle', gravityOnlyPassed, 'gravity-only-oracle-failed', {
    positionErrorM: firstNumber(gravityOnly, ['positionErrorM', 'maxPositionErrorM'], null),
    velocityErrorMPerS: firstNumber(gravityOnly, ['velocityErrorMPerS', 'maxVelocityErrorMPerS'], null)
  });

  const volumeStability = checkFrom(mechanicsEvidence, [
    'volumeStability',
    'volume-stability'
  ]);
  const volumeStabilityPassed = hasGoodStatus(volumeStability)
    && rangeWithin(volumeStability, ['minVolumeRatioJ', 'minJ'], ['maxVolumeRatioJ', 'maxJ'], 0.95, 1.05);
  record('volume-stability', volumeStabilityPassed, 'volume-stability-failed', {
    minVolumeRatioJ: firstNumber(volumeStability, ['minVolumeRatioJ', 'minJ'], null),
    maxVolumeRatioJ: firstNumber(volumeStability, ['maxVolumeRatioJ', 'maxJ'], null)
  });

  const pressureDisabled = checkFrom(mechanicsEvidence, [
    'pressureDisabledAblation',
    'pressure-disabled-ablation'
  ]);
  const pressureDisabledPassed = hasGoodStatus(pressureDisabled)
    && absWithin(
      pressureDisabled,
      ['appliedImpulseMagnitudeNSeconds', 'maxAppliedImpulseMagnitudeNSeconds'],
      ['toleranceNSeconds', 'maxAllowedImpulseNSeconds'],
      1e-9
    );
  record('pressure-disabled-ablation', pressureDisabledPassed, 'pressure-disabled-ablation-failed', {
    appliedImpulseMagnitudeNSeconds: firstNumber(
      pressureDisabled,
      ['appliedImpulseMagnitudeNSeconds', 'maxAppliedImpulseMagnitudeNSeconds'],
      null
    )
  });

  const ownerMap = checkFrom(mechanicsEvidence, [
    'ownerMap',
    'lawFamilyStateOwnerMetadata',
    'law-family-state-owner-metadata',
    'residentAuthorityLedger',
    'resident-authority-ledger'
  ]);
  const firstCandidateNodeId = firstString(ownerMap, ['firstPromotionCandidateNodeId'], null);
  const ownerStatus = firstString(ownerMap, ['status', 'stateFamilyOwnerMapStatus'], null);
  const ownerPassed = hasGoodStatus(ownerMap)
    && (!firstCandidateNodeId || firstCandidateNodeId === 'ulg-mls-mpm-mechanics-law')
    && (!ownerStatus || ownerStatus === 'single-current-owner-per-family' || ownerStatus === 'pass');
  record('law-family-state-owner-metadata', ownerPassed, 'law-family-state-owner-metadata-failed', {
    firstPromotionCandidateNodeId: firstCandidateNodeId,
    stateFamilyOwnerMapStatus: ownerStatus
  });
  record('resident-authority-ledger', ownerPassed, 'resident-authority-ledger-failed', {
    firstPromotionCandidateNodeId: firstCandidateNodeId,
    stateFamilyOwnerMapStatus: ownerStatus
  });

  const gpuFence = checkFrom(mechanicsEvidence, [
    'gpuFence',
    'gpuFenceReport',
    'gpu-fence-report',
    'sameDeviceGpuLaneLeaseAndFence',
    'same-device-gpu-lane-lease-and-fence'
  ]);
  const gpuFencePassed = hasGoodStatus(gpuFence)
    && gpuFence?.fenceSatisfied !== false
    && gpuFence?.sameDevice !== false;
  record('gpu-fence-report', gpuFencePassed, 'gpu-fence-report-failed', {
    fenceSatisfied: gpuFence?.fenceSatisfied ?? null,
    sameDevice: gpuFence?.sameDevice ?? null
  });
  record('same-device-gpu-lane-lease-and-fence', gpuFencePassed, 'same-device-gpu-lane-lease-and-fence-failed', {
    fenceSatisfied: gpuFence?.fenceSatisfied ?? null,
    sameDevice: gpuFence?.sameDevice ?? null
  });

  const stateAdmission = checkFrom(mechanicsEvidence, [
    'stateManagerAdmission',
    'state-manager-admission'
  ]);
  const committedDelta = checkFrom(mechanicsEvidence, [
    'committedDeltaAdmission',
    'committed-delta-admission',
    'stateManagerCommit'
  ]);
  const stateAdmissionPassed = hasGoodStatus(stateAdmission) || hasGoodStatus(committedDelta);
  const committedDeltaPassed = hasGoodStatus(committedDelta) || hasGoodStatus(stateAdmission);
  record('state-manager-admission', stateAdmissionPassed, 'state-manager-admission-failed', {
    stateManagerAccepted: stateAdmission?.accepted ?? null,
    committedDeltaAccepted: committedDelta?.accepted ?? null
  });
  record('committed-delta-admission', committedDeltaPassed, 'committed-delta-admission-failed', {
    stateManagerAccepted: stateAdmission?.accepted ?? null,
    committedDeltaAccepted: committedDelta?.accepted ?? null
  });

  const visual = checkFrom(mechanicsEvidence, [
    'visualSequence',
    'visualSequenceSanity',
    'visual-sequence-sanity'
  ]);
  const visualFailedCount = firstNumber(visual, ['failedCount', 'failures'], 0);
  const visualPassed = hasGoodStatus(visual) && visualFailedCount === 0;
  record('visual-sequence-sanity', visualPassed, 'visual-sequence-sanity-failed', {
    failedCount: visualFailedCount
  });

  const conservedFields = checkFrom(mechanicsEvidence, [
    'conservedFields',
    'conservedFieldChecks',
    'conserved-field-checks'
  ]);
  const conservedPassed = hasGoodStatus(conservedFields)
    && absWithin(conservedFields, ['massDeltaKg', 'maxMassDeltaKg'], ['massToleranceKg', 'maxAllowedMassDeltaKg'], 1e-9)
    && absWithin(
      conservedFields,
      ['momentumDeltaMagnitude', 'maxMomentumDeltaMagnitude'],
      ['momentumTolerance', 'maxAllowedMomentumDeltaMagnitude'],
      1e-6
    );
  record('conserved-field-checks', conservedPassed, 'conserved-field-checks-failed', {
    massDeltaKg: firstNumber(conservedFields, ['massDeltaKg', 'maxMassDeltaKg'], null),
    momentumDeltaMagnitude: firstNumber(conservedFields, ['momentumDeltaMagnitude', 'maxMomentumDeltaMagnitude'], null)
  });

  const cpuParity = checkFrom(mechanicsEvidence, [
    'cpuReferenceOracleParity',
    'cpu-reference-oracle-parity'
  ]);
  const cpuParityPassed = hasGoodStatus(cpuParity) || (zeroForcePassed && gravityOnlyPassed);
  record('cpu-reference-oracle-parity', cpuParityPassed, 'cpu-reference-oracle-parity-failed', {
    zeroForceRestOraclePassed: zeroForcePassed,
    gravityOnlyOraclePassed: gravityOnlyPassed
  });

  const childDryRunParity = checkFrom(mechanicsEvidence, [
    'mechanicsChildDryRunParity',
    'mechanics-child-dry-run-parity'
  ]);
  const childDryRunParityPassed = hasGoodStatus(childDryRunParity)
    || (mechanicsEvidence?.schema === 'peercompute.ulg.mechanics-child-dry-run-evidence.v0'
      && mechanicsEvidence?.accepted === true);
  record('mechanics-child-dry-run-parity', childDryRunParityPassed, 'mechanics-child-dry-run-parity-failed', {
    comparisonPassed: childDryRunParity?.comparisonPassed ?? null,
    referencePassed: childDryRunParity?.referencePassed ?? null,
    candidatePassed: childDryRunParity?.candidatePassed ?? null,
    failedComparisons: Array.isArray(childDryRunParity?.failedComparisons)
      ? [...childDryRunParity.failedComparisons]
      : []
  });

  const mechanicsOnlyChildTaskEnvelope = checkFrom(mechanicsEvidence, [
    'mechanicsOnlyChildTaskEnvelope',
    'mechanics-only-child-task-envelope'
  ]);
  const mechanicsOnlyChildTaskEnvelopePassed = hasGoodStatus(mechanicsOnlyChildTaskEnvelope);
  record('mechanics-only-child-task-envelope', mechanicsOnlyChildTaskEnvelopePassed, 'mechanics-only-child-task-envelope-failed', {
    computeTaskSchema: mechanicsOnlyChildTaskEnvelope?.computeTaskSchema ?? null,
    computeTaskResultSchema: mechanicsOnlyChildTaskEnvelope?.computeTaskResultSchema ?? null,
    taskFamily: mechanicsOnlyChildTaskEnvelope?.taskFamily ?? null,
    lawGraphNodeId: mechanicsOnlyChildTaskEnvelope?.lawGraphNodeId ?? null,
    gpuFenceRequired: mechanicsOnlyChildTaskEnvelope?.gpuFenceRequired ?? null,
    gpuFenceSatisfied: mechanicsOnlyChildTaskEnvelope?.gpuFenceSatisfied ?? null,
    commitDeltaSuppressed: mechanicsOnlyChildTaskEnvelope?.commitDeltaSuppressed ?? null
  });

  const mechanicsChildStageKernelEvidence = checkFrom(mechanicsEvidence, [
    'mechanicsChildStageKernelEvidence',
    'mechanics-child-stage-kernel-evidence'
  ]);
  const mechanicsChildStageKernelEvidencePassed = hasGoodStatus(mechanicsChildStageKernelEvidence);
  record('mechanics-child-stage-kernel-evidence', mechanicsChildStageKernelEvidencePassed, 'mechanics-child-stage-kernel-evidence-failed', {
    lawGraphNodeId: mechanicsChildStageKernelEvidence?.lawGraphNodeId ?? null,
    completedStepCount: mechanicsChildStageKernelEvidence?.completedStepCount ?? null,
    requiredStageCount: Array.isArray(mechanicsChildStageKernelEvidence?.requiredStages)
      ? mechanicsChildStageKernelEvidence.requiredStages.length
      : null,
    forbiddenStageCount: Array.isArray(mechanicsChildStageKernelEvidence?.forbiddenStages)
      ? mechanicsChildStageKernelEvidence.forbiddenStages.length
      : null,
    pressureSuppressed: mechanicsChildStageKernelEvidence?.pressureInterface?.suppressed ?? null
  });

  const mechanicsChildP2gStageEvidence = checkFrom(mechanicsEvidence, [
    'mechanicsChildP2gStageEvidence',
    'mechanics-child-p2g-stage-evidence'
  ]);
  const mechanicsChildP2gStageEvidencePassed = hasGoodStatus(mechanicsChildP2gStageEvidence);
  record('mechanics-child-p2g-stage-evidence', mechanicsChildP2gStageEvidencePassed, 'mechanics-child-p2g-stage-evidence-failed', {
    lawGraphNodeId: mechanicsChildP2gStageEvidence?.lawGraphNodeId ?? null,
    completedStepCount: mechanicsChildP2gStageEvidence?.completedStepCount ?? null,
    stageId: mechanicsChildP2gStageEvidence?.stageId ?? null,
    backend: mechanicsChildP2gStageEvidence?.backend ?? null,
    pressureSuppressed: mechanicsChildP2gStageEvidence?.pressureInterface?.suppressed ?? null,
    promotionStatus: mechanicsChildP2gStageEvidence?.promotionStatus ?? null
  });

  const mechanicsChildGridUpdateStageEvidence = checkFrom(mechanicsEvidence, [
    'mechanicsChildGridUpdateStageEvidence',
    'mechanics-child-grid-update-stage-evidence'
  ]);
  const mechanicsChildGridUpdateStageEvidencePassed = hasGoodStatus(mechanicsChildGridUpdateStageEvidence);
  record('mechanics-child-grid-update-stage-evidence', mechanicsChildGridUpdateStageEvidencePassed, 'mechanics-child-grid-update-stage-evidence-failed', {
    lawGraphNodeId: mechanicsChildGridUpdateStageEvidence?.lawGraphNodeId ?? null,
    completedStepCount: mechanicsChildGridUpdateStageEvidence?.completedStepCount ?? null,
    stageId: mechanicsChildGridUpdateStageEvidence?.stageId ?? null,
    backend: mechanicsChildGridUpdateStageEvidence?.backend ?? null,
    pressureSuppressed: mechanicsChildGridUpdateStageEvidence?.pressureInterface?.suppressed ?? null,
    promotionStatus: mechanicsChildGridUpdateStageEvidence?.promotionStatus ?? null
  });

  const mechanicsChildG2pStageEvidence = checkFrom(mechanicsEvidence, [
    'mechanicsChildG2pStageEvidence',
    'mechanics-child-g2p-stage-evidence'
  ]);
  const mechanicsChildG2pStageEvidencePassed = hasGoodStatus(mechanicsChildG2pStageEvidence);
  record('mechanics-child-g2p-stage-evidence', mechanicsChildG2pStageEvidencePassed, 'mechanics-child-g2p-stage-evidence-failed', {
    lawGraphNodeId: mechanicsChildG2pStageEvidence?.lawGraphNodeId ?? null,
    completedStepCount: mechanicsChildG2pStageEvidence?.completedStepCount ?? null,
    stageId: mechanicsChildG2pStageEvidence?.stageId ?? null,
    backend: mechanicsChildG2pStageEvidence?.backend ?? null,
    pressureSuppressed: mechanicsChildG2pStageEvidence?.pressureInterface?.suppressed ?? null,
    promotionStatus: mechanicsChildG2pStageEvidence?.promotionStatus ?? null
  });

  const presentEvidence = uniqueList(satisfiedEvidence);
  const missingEvidence = requiredEvidence.filter((key) => !presentEvidence.includes(key));
  const accepted = issues.length === 0 && missingEvidence.length === 0;
  return {
    schema: 'peercompute.ulg.mechanics-promotion-evidence.v0',
    evidenceId: data.evidenceId || 'ulg-mechanics-promotion-evidence',
    accepted,
    status: accepted ? 'mechanics-promotion-evidence-ready' : 'mechanics-promotion-evidence-incomplete',
    reason: accepted
      ? 'mechanics-promotion-evidence-satisfied'
      : missingEvidence[0] || issues[0] || 'mechanics-promotion-evidence-incomplete',
    nodeId: data.nodeId || 'ulg-mls-mpm-mechanics-law',
    solverId: data.solverId || 'ulg-mls-mpm-mechanics-law',
    requiredEvidence,
    satisfiedEvidence: presentEvidence,
    presentEvidence,
    missingEvidence,
    issues: uniqueList([...issues, ...(missingEvidence.length > 0 ? ['required-evidence-missing'] : [])]),
    checks,
    scientificValidation: false,
    fullPhysicsValidation: false,
    taskWrapped: data.taskWrapped === true,
    decidedAt: Date.now()
  };
}

export function createUlgMechanicsPromotionEvidenceTask({
  requiredEvidence = [],
  mechanicsEvidence = {},
  solverId = 'ulg-mls-mpm-mechanics-law',
  nodeId = 'ulg-mls-mpm-mechanics-law',
  evidenceId = 'ulg-mechanics-promotion-evidence',
  taskId = null,
  stateKey = 'ulg:mechanics-promotion-evidence'
} = {}) {
  const resolvedTaskId = taskId || `${evidenceId}:${Date.now()}`;
  return {
    id: resolvedTaskId,
    runtime: 'js',
    taskFamily: 'ulg-mechanics-promotion-evidence',
    solverId,
    fn: runUlgMechanicsPromotionEvidenceTask,
    data: {
      schema: ULG_RESIDENT_MECHANICS_PROMOTION_EVIDENCE_TASK_INPUT_SCHEMA,
      requiredEvidence,
      mechanicsEvidence,
      solverId,
      nodeId,
      evidenceId,
      taskWrapped: true,
      stateKey
    },
    affinityKey: `${evidenceId}:${solverId}:${stateKey}`,
    suppressCommitDelta: true
  };
}

export function createUlgMechanicsChildDryRunTask({
  modulePath = DEFAULT_ULG_MECHANICS_PROMOTION_EVIDENCE_MODULE_PATH,
  referenceEvidence = null,
  dryRunOptions = {},
  authorityEvidence = {},
  ownerMap = null,
  gpuFence = null,
  stateManagerAdmission = null,
  committedDeltaAdmission = null,
  visualSequence = null,
  mechanicsOnlyChildTaskEvidence = null,
  comparisonTolerances = {},
  solverId = 'ulg-mls-mpm-mechanics-law',
  nodeId = 'ulg-mls-mpm-mechanics-law',
  evidenceId = 'ulg-mechanics-child-dry-run-evidence',
  taskId = null,
  stateKey = 'ulg:mechanics-child-dry-run'
} = {}) {
  const resolvedTaskId = taskId || `${evidenceId}:${Date.now()}`;
  return {
    id: resolvedTaskId,
    runtime: 'js',
    taskFamily: 'ulg-mechanics-child-dry-run',
    solverId,
    module: modulePath,
    exportName: 'runUlgMechanicsChildDryRunTask',
    data: {
      schema: ULG_RESIDENT_MECHANICS_CHILD_DRY_RUN_TASK_INPUT_SCHEMA,
      referenceEvidence,
      dryRunOptions,
      authorityEvidence,
      ownerMap,
      gpuFence,
      stateManagerAdmission,
      committedDeltaAdmission,
      visualSequence,
      mechanicsOnlyChildTaskEvidence,
      comparisonTolerances,
      solverId,
      nodeId,
      evidenceId,
      taskWrapped: true,
      stateKey
    },
    affinityKey: `${evidenceId}:${solverId}:${stateKey}`,
    suppressCommitDelta: true
  };
}

export function runUlgLawFamilyPromotionAdmissionTask(data = {}) {
  const uniqueList = (values = []) => {
    const source = Array.isArray(values) ? values : (values == null ? [] : [values]);
    return Array.from(new Set(
      source.map((entry) => String(entry ?? '').trim()).filter(Boolean)
    ));
  };
  const normalizeText = (value, fallback = null) => {
    const text = typeof value === 'string' ? value.trim() : '';
    return text || fallback;
  };
  const evidenceList = (evidence = {}) => {
    if (Array.isArray(evidence)) return uniqueList(evidence);
    if (!evidence || typeof evidence !== 'object') return [];
    const keys = [];
    for (const list of [
      evidence.evidence,
      evidence.passedEvidence,
      evidence.passed,
      evidence.satisfied,
      evidence.satisfiedEvidence
    ]) {
      keys.push(...uniqueList(list));
    }
    for (const [key, value] of Object.entries(evidence)) {
      if (value === true) keys.push(key);
    }
    return uniqueList(keys);
  };
  const manifest = data.lawGraphManifest || data.manifest || null;
  const requestedSolverId = normalizeText(data.solverId);
  const requestedNodeId = normalizeText(data.nodeId);
  const nodes = Array.isArray(manifest?.nodes) ? manifest.nodes : [];
  const node = nodes.find((entry) => (
    (requestedSolverId && entry.solverId === requestedSolverId)
    || (requestedNodeId && entry.nodeId === requestedNodeId)
  )) || null;
  const issues = [];
  if (!manifest) issues.push('law-graph-manifest-missing');
  if (!node) issues.push('law-family-node-not-found');
  if (node?.hasExecutor) issues.push('law-family-already-executable');
  if (node?.currentAuthority) issues.push('current-authority-node-not-promotable');
  if (node && node.nodeId !== manifest?.firstPromotionCandidateNodeId) {
    issues.push('promotion-order-blocked');
  }
  const requiredEvidence = uniqueList([
    ...(manifest?.promotionPolicy?.requiredGates || []),
    ...(node?.requiredBeforeIndependentExecution || []),
    ...(node?.requiredAdmissionEvidence || [])
  ]);
  const presentEvidence = evidenceList(data.evidence);
  const missingEvidence = requiredEvidence.filter((key) => !presentEvidence.includes(key));
  if (missingEvidence.length > 0) issues.push('required-evidence-missing');
  const accepted = issues.length === 0;
  return {
    schema: 'peercompute.ulg.law-family-promotion-admission.v0',
    admissionId: data.admissionId || 'ulg-law-family-promotion-admission',
    accepted,
    status: accepted ? 'promotion-admission-accepted' : 'promotion-admission-rejected',
    reason: accepted ? 'promotion-evidence-satisfied' : issues[0] || 'promotion-admission-rejected',
    graphId: manifest?.graphId || null,
    nodeId: node?.nodeId || requestedNodeId,
    solverId: node?.solverId || requestedSolverId,
    requestedRuntimeTarget: data.requestedRuntimeTarget || 'webgpu-resident-lane-child',
    currentAuthority: node?.currentAuthority === true,
    executableStatus: node?.executableStatus || null,
    firstPromotionCandidateNodeId: manifest?.firstPromotionCandidateNodeId || null,
    admittedFamilies: accepted ? [...(node?.authoritativeWriteResidentStateFamilies || [])] : [],
    requiredEvidence,
    presentEvidence,
    missingEvidence,
    issues: uniqueList(issues),
    stateFamilyOwnerMapStatus: manifest?.stateFamilyOwnerMapStatus || null,
    taskWrapped: data.taskWrapped === true,
    decidedAt: Date.now()
  };
}

export function createUlgLawFamilyPromotionAdmission({
  computeManager = null,
  lawGraphManifest = null,
  solverId = null,
  nodeId = null,
  evidence = {},
  requestedRuntimeTarget = 'webgpu-resident-lane-child',
  admissionId = 'ulg-law-family-promotion-admission'
} = {}) {
  const descriptors = lawGraphManifest
    ? []
    : (computeManager?.listSolvers?.() || []);
  const manifest = lawGraphManifest || createUlgResidentLawGraphManifest({ descriptors });
  return {
    ...runUlgLawFamilyPromotionAdmissionTask({
      lawGraphManifest: manifest,
      solverId,
      nodeId,
      evidence,
      requestedRuntimeTarget,
      admissionId
    }),
    schema: ULG_RESIDENT_LAW_FAMILY_PROMOTION_ADMISSION_SCHEMA,
    admissionId,
    taskWrapped: false
  };
}

export function createUlgLawFamilyPromotionAdmissionComputeTask({
  lawGraphManifest,
  solverId = null,
  nodeId = null,
  evidence = {},
  requestedRuntimeTarget = 'webgpu-resident-lane-child',
  admissionId = 'ulg-law-family-promotion-admission',
  taskId = null,
  stateKey = 'ulg:law-family-promotion-admission'
} = {}) {
  const requestedSolverId = normalizeString(solverId, null);
  const requestedNodeId = normalizeString(nodeId, null);
  const resolvedTaskId = taskId || `${admissionId}:${requestedSolverId || requestedNodeId || 'unknown'}:${Date.now()}`;
  return {
    id: resolvedTaskId,
    runtime: 'js',
    taskFamily: 'ulg-law-family-promotion-admission',
    solverId: requestedSolverId || requestedNodeId || 'ulg-law-family-promotion-admission',
    fn: runUlgLawFamilyPromotionAdmissionTask,
    data: {
      schema: 'peercompute.ulg.law-family-promotion-admission-task-input.v0',
      lawGraphManifest,
      solverId: requestedSolverId,
      nodeId: requestedNodeId,
      evidence,
      requestedRuntimeTarget,
      admissionId,
      taskWrapped: true,
      stateKey
    },
    affinityKey: `${admissionId}:${requestedSolverId || requestedNodeId || 'unknown'}:${stateKey}`,
    suppressCommitDelta: true
  };
}

export function createUlgResidentLawGraphManifest({
  descriptors = createUlgResidentSolverDescriptors(),
  graphId = ULG_RESIDENT_LAW_GRAPH_ID,
  graphSchema = ULG_RESIDENT_LAW_GRAPH_SCHEMA
} = {}) {
  const nodes = descriptors
    .filter((descriptor) => descriptor?.metadata?.lawGraphNode)
    .map((descriptor) => {
      const lawGraphNode = descriptor.metadata.lawGraphNode;
      const hasExecutor = hasExecutableTarget(descriptor);
      const inputFields = cloneFields(descriptor.inputFields || descriptor.inputs || []);
      const outputFields = cloneFields(descriptor.outputFields || descriptor.outputs || []);
      const conservedFields = cloneFields(descriptor.conservedFields || descriptor.conserved || []);
      const stateFamilyContract = cloneStateFamilyContract(descriptor.metadata?.stateFamilyContract);
      return {
        schema: 'peercompute.ulg.law-closure-graph-node.v0',
        graphId,
        nodeId: lawGraphNode.nodeId,
        solverId: descriptor.id,
        kind: descriptor.kind,
        label: descriptor.label || descriptor.id,
        family: lawGraphNode.family || descriptor.kind,
        order: lawGraphNode.order ?? 0,
        parentNodeId: lawGraphNode.parentNodeId || null,
        dependsOn: Array.isArray(lawGraphNode.dependsOn) ? [...lawGraphNode.dependsOn] : [],
        runtime: descriptor.runtime || 'js',
        runtimeTarget: lawGraphNode.runtimeTarget || null,
        hasExecutor,
        executableStatus: hasExecutor
          ? 'executable'
          : descriptor.metadata?.executableStatus || 'metadata-only',
        webgpuResidency: descriptor.webgpu?.residency || null,
        warmDeltaScope: descriptor.warmDelta?.scope || descriptor.scope || null,
        cachePolicy: lawGraphNode.cachePolicy || null,
        stateFamilyContract,
        currentAuthority: stateFamilyContract?.currentAuthority === true,
        authorityStatus: stateFamilyContract?.authorityStatus || null,
        admissionMode: stateFamilyContract?.admissionMode || null,
        promotionStatus: stateFamilyContract?.promotionStatus || null,
        promotionPriority: stateFamilyContract?.promotionPriority ?? null,
        validationGates: Array.isArray(lawGraphNode.validationGates)
          ? [...lawGraphNode.validationGates]
          : [],
        requiredBeforeIndependentExecution: Array.isArray(descriptor.metadata?.requiredBeforeIndependentExecution)
          ? [...descriptor.metadata.requiredBeforeIndependentExecution]
          : [],
        inputFields,
        outputFields,
        conservedFields,
        readStateFamilies: fieldNames(inputFields),
        writeStateFamilies: fieldNames(outputFields),
        conservedStateFamilies: fieldNames(conservedFields),
        readResidentStateFamilies: uniqueStringList(stateFamilyContract?.readFamilies),
        authoritativeWriteResidentStateFamilies: uniqueStringList(stateFamilyContract?.authoritativeWriteFamilies),
        transientWriteResidentStateFamilies: uniqueStringList(stateFamilyContract?.transientWriteFamilies),
        diagnosticWriteResidentStateFamilies: uniqueStringList(stateFamilyContract?.diagnosticWriteFamilies),
        mustNotWriteResidentStateFamilies: uniqueStringList(stateFamilyContract?.mustNotWriteFamilies),
        requiredAdmissionEvidence: uniqueStringList(stateFamilyContract?.requiredAdmissionEvidence)
      };
    })
    .sort((a, b) => (a.order - b.order) || a.nodeId.localeCompare(b.nodeId));

  const nodeIds = new Set(nodes.map((node) => node.nodeId));
  const edges = [];
  for (const node of nodes) {
    if (node.parentNodeId && nodeIds.has(node.parentNodeId)) {
      edges.push({
        schema: 'peercompute.ulg.law-closure-graph-edge.v0',
        graphId,
        fromNodeId: node.parentNodeId,
        toNodeId: node.nodeId,
        relation: 'parent-pass-dag-child'
      });
    }
    for (const dependencyNodeId of node.dependsOn) {
      edges.push({
        schema: 'peercompute.ulg.law-closure-graph-edge.v0',
        graphId,
        fromNodeId: dependencyNodeId,
        toNodeId: node.nodeId,
        relation: 'data-dependency'
      });
    }
  }
  const currentOwnerEntries = {};
  const prospectiveOwnerEntries = {};
  for (const node of nodes) {
    const writeFamilies = node.authoritativeWriteResidentStateFamilies || [];
    for (const family of writeFamilies) {
      if (node.currentAuthority) {
        addOwnerEntry(currentOwnerEntries, family, node);
      } else {
        addOwnerEntry(prospectiveOwnerEntries, family, node);
      }
    }
  }
  const currentStateFamilyOwners = Object.fromEntries(
    Object.entries(currentOwnerEntries).map(([family, owners]) => [family, owners[0] || null])
  );
  const prospectiveStateFamilyOwners = Object.fromEntries(
    Object.entries(prospectiveOwnerEntries).map(([family, owners]) => [family, owners])
  );
  const stateFamilyOwnerConflicts = Object.entries(currentOwnerEntries)
    .filter(([, owners]) => owners.length > 1)
    .map(([family, owners]) => ({
      family,
      ownerNodeIds: owners.map((owner) => owner.nodeId)
    }));
  const firstPromotionCandidate = nodes
    .filter((node) => !node.currentAuthority
      && node.promotionPriority != null
      && Number.isFinite(Number(node.promotionPriority)))
    .sort((a, b) => Number(a.promotionPriority) - Number(b.promotionPriority))[0] || null;

  return {
    schema: ULG_RESIDENT_LAW_GRAPH_MANIFEST_SCHEMA,
    graphSchema,
    graphId,
    authority: 'NodeKernel/ComputeManager/StateManager',
    source: 'ulg-browser-resident-authority-host',
    nodeCount: nodes.length,
    edgeCount: edges.length,
    executableNodeIds: nodes
      .filter((node) => node.hasExecutor)
      .map((node) => node.nodeId),
    metadataOnlyNodeIds: nodes
      .filter((node) => !node.hasExecutor)
      .map((node) => node.nodeId),
    currentStateFamilyOwners,
    prospectiveStateFamilyOwners,
    stateFamilyOwnerConflicts,
    stateFamilyOwnerMapStatus: stateFamilyOwnerConflicts.length > 0
      ? 'state-family-owner-conflict'
      : 'single-current-owner-per-family',
    firstPromotionCandidateNodeId: firstPromotionCandidate?.nodeId || null,
    firstPromotionCandidateSolverId: firstPromotionCandidate?.solverId || null,
    firstPromotionCandidateFamilies: firstPromotionCandidate?.authoritativeWriteResidentStateFamilies || [],
    readStateFamilies: Array.from(new Set(nodes.flatMap((node) => node.readStateFamilies))).sort(),
    writeStateFamilies: Array.from(new Set(nodes.flatMap((node) => node.writeStateFamilies))).sort(),
    conservedStateFamilies: Array.from(new Set(nodes.flatMap((node) => node.conservedStateFamilies))).sort(),
    readResidentStateFamilies: Array.from(new Set(nodes.flatMap((node) => node.readResidentStateFamilies))).sort(),
    authoritativeWriteResidentStateFamilies: Array.from(new Set(nodes.flatMap((node) => node.authoritativeWriteResidentStateFamilies))).sort(),
    transientWriteResidentStateFamilies: Array.from(new Set(nodes.flatMap((node) => node.transientWriteResidentStateFamilies))).sort(),
    diagnosticWriteResidentStateFamilies: Array.from(new Set(nodes.flatMap((node) => node.diagnosticWriteResidentStateFamilies))).sort(),
    promotionPolicy: {
      schema: 'peercompute.ulg.law-family-promotion-policy.v0',
      rule: 'metadata-only-until-gated',
      requiredGates: [
        'cpu-reference-oracle-parity',
        'conserved-field-checks',
        'same-device-gpu-lane-lease-and-fence',
        'state-manager-admission',
        'visual-sequence-sanity'
      ]
    },
    nodes,
    edges
  };
}

export function createUlgResidentSolverDescriptors({
  computeTaskModulePath = DEFAULT_ULG_RESIDENT_COMPUTE_TASK_MODULE_PATH
} = {}) {
  return [
    {
      id: ULG_RESIDENT_PASS_DAG_SOLVER_ID,
      kind: 'sph-mls-mpm-resident-pass-dag',
      version: '0.1.0',
      label: 'ULG SPH/MLS-MPM resident pass DAG',
      description: 'Same-device WebGPU resident SPH/MLS-MPM mechanics, thermal, reaction, pressure, and compact summary pass DAG.',
      runtime: 'js',
      module: computeTaskModulePath,
      exportName: 'runMlsMpmResidentStepsComputeTask',
      webgpu: {
        residency: 'gpu-lane',
        requiresQueueFence: true,
        lanePolicy: 'same-device-state-key',
        retainedBufferRefs: [
          'sph-state-buffer',
          'sph-thermo-buffer',
          'mls-mpm-mechanics-buffer'
        ]
      },
      inputFields: [
        { name: 'sph-particle-state', unit: 'SI', location: 'resident-gpu-buffer', role: 'read' },
        { name: 'mls-mpm-mechanics', unit: 'SI', location: 'resident-gpu-buffer', role: 'read' },
        { name: 'resident-product-mass', unit: 'kg/mol', location: 'resident-gpu-buffer', role: 'read' },
        { name: 'pressure-interface-force-rows', unit: 'N', location: 'resident-gpu-buffer', role: 'read' }
      ],
      outputFields: [
        { name: 'sph-particle-state', unit: 'SI', location: 'resident-gpu-buffer', role: 'write' },
        { name: 'sph-thermo-phase', unit: 'SI', location: 'resident-gpu-buffer', role: 'write' },
        { name: 'mls-mpm-mechanics', unit: 'SI', location: 'resident-gpu-buffer', role: 'write' },
        { name: 'resident-product-mass', unit: 'kg/mol', location: 'resident-gpu-buffer', role: 'write' },
        { name: 'resident-gas-ledger', unit: 'SI', location: 'resident-gpu-buffer', role: 'write' },
        { name: 'pressure-interface-force-rows', unit: 'N', location: 'resident-gpu-buffer', role: 'write' }
      ],
      conservedFields: [
        { name: 'mass', unit: 'kg', role: 'conservation-check' },
        { name: 'linear-momentum', unit: 'kg*m/s', role: 'diagnostic' },
        { name: 'energy', unit: 'J', role: 'diagnostic' }
      ],
      timestep: {
        mode: 'explicit-subcycled',
        maxDt: null,
        subcycles: 1
      },
      affinity: {
        policy: 'state-key',
        keyFields: ['solverId', 'stateKey', 'domainKey']
      },
      warmDelta: {
        scope: 'ulg-sph-resident-pass-dag',
        schema: 'peercompute.ulg.mls-mpm-resident-steps-state-delta.v0'
      },
      validity: {
        units: 'SI',
        scaleRegime: 'continuum-particle',
        authority: 'NodeKernel/ComputeManager/StateManager',
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      },
      metadata: {
        lawGraphNode: {
          schema: 'peercompute.ulg.law-graph-node-task-ref.v0',
          graphSchema: ULG_RESIDENT_LAW_GRAPH_SCHEMA,
          graphId: ULG_RESIDENT_LAW_GRAPH_ID,
          nodeId: ULG_RESIDENT_PASS_DAG_NODE_ID,
          solverId: ULG_RESIDENT_PASS_DAG_SOLVER_ID,
          runtimeTarget: 'webgpu-resident-lane',
          cachePolicy: 'hot-gpu-lane-with-warm-closure-tables',
          validationGates: [
            'resident-authority-ledger',
            'gpu-fence-report',
            'state-manager-warm-delta',
            'copy-budget',
            'compact-summary'
          ]
        },
        source: 'ulg-browser-resident-authority-host',
        stateFamilyContract: createStateFamilyContract({
          nodeId: ULG_RESIDENT_PASS_DAG_NODE_ID,
          solverId: ULG_RESIDENT_PASS_DAG_SOLVER_ID,
          readFamilies: [
            RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
            RESIDENT_STATE_FAMILIES.MECHANICS,
            RESIDENT_STATE_FAMILIES.THERMO_PHASE,
            RESIDENT_STATE_FAMILIES.REACTION_PRODUCTS,
            RESIDENT_STATE_FAMILIES.GAS_PRESSURE,
            RESIDENT_STATE_FAMILIES.PRESSURE_INTERFACE
          ],
          authoritativeWriteFamilies: [
            RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
            RESIDENT_STATE_FAMILIES.MECHANICS,
            RESIDENT_STATE_FAMILIES.THERMO_PHASE,
            RESIDENT_STATE_FAMILIES.REACTION_PRODUCTS,
            RESIDENT_STATE_FAMILIES.GAS_PRESSURE,
            RESIDENT_STATE_FAMILIES.PRESSURE_INTERFACE
          ],
          transientWriteFamilies: [
            RESIDENT_STATE_FAMILIES.GRID_ACCUMULATORS,
            RESIDENT_STATE_FAMILIES.GRID_UPDATE
          ],
          diagnosticWriteFamilies: [
            RESIDENT_STATE_FAMILIES.DIAGNOSTICS
          ],
          currentAuthority: true,
          admissionMode: 'state-manager-admitted-delta',
          authorityStatus: 'current-executable-pass-dag-authority',
          promotionStatus: 'parent-pass-dag-current-authority',
          requiredAdmissionEvidence: [
            'compact-commit-delta',
            'retained-buffer-refs',
            'copy-budget',
            'compact-summary'
          ]
        }),
        firstPrinciplesStatus: 'evidence-gated',
        authoritativeMutation: 'state-manager-admitted-delta'
      }
    },
    ...createUlgResidentLawFamilyDescriptors()
  ];
}

function registerUlgResidentSolverDescriptors(computeManager, {
  computeTaskModulePath = DEFAULT_ULG_RESIDENT_COMPUTE_TASK_MODULE_PATH
} = {}) {
  const descriptors = createUlgResidentSolverDescriptors({ computeTaskModulePath });
  const registered = [];
  const issues = [];
  if (!computeManager || typeof computeManager.registerSolver !== 'function') {
    return {
      schema: ULG_PEERCOMPUTE_RESIDENT_SOLVER_REGISTRATION_SCHEMA,
      status: 'not-available',
      solverIds: [],
      registeredCount: 0,
      issues: ['compute-manager-registerSolver-missing'],
      lawGraphManifest: null
    };
  }
  for (const descriptor of descriptors) {
    try {
      registered.push(computeManager.registerSolver(descriptor));
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }
  }
  return {
    schema: ULG_PEERCOMPUTE_RESIDENT_SOLVER_REGISTRATION_SCHEMA,
    status: issues.length ? 'partial' : 'registered',
    solverIds: registered.map((solver) => solver.id),
    registeredCount: registered.length,
    issues,
    descriptors: registered,
    lawGraphManifest: createUlgResidentLawGraphManifest({ descriptors: registered })
  };
}

function summarizeNodeKernelAuthority({
  nodeKernel,
  nodeKernelMode,
  source,
  fallbackReason = null,
  networkGateStatus = null
} = {}) {
  const isRealNodeKernel = nodeKernelMode === 'real-peercompute-nodekernel';
  const status = isRealNodeKernel ? nodeKernel?.getStatus?.() || null : null;
  const networkManager = nodeKernel?.getNetworkManager?.() || nodeKernel?.networkManager || null;
  const networkStats = status?.network || networkManager?.getNetworkStats?.() || {};
  const initialized = nodeKernel?.isInitialized === true
    || nodeKernel?.schema === ULG_PEERCOMPUTE_NODEKERNEL_FACADE_SCHEMA;
  const started = nodeKernel?.isStarted === true;
  return {
    schema: ULG_PEERCOMPUTE_NODEKERNEL_AUTHORITY_SCHEMA,
    status: isRealNodeKernel
      ? started
        ? 'started-connected'
        : 'initialized-not-started'
      : 'facade-fallback',
    mode: nodeKernelMode,
    source,
    constructorName: nodeKernel?.constructor?.name || null,
    initialized,
    started,
    nodeId: nodeKernel?.nodeId || null,
    networkManagerReady: Boolean(networkManager),
    networkConnected: networkStats?.isConnected === true,
    peerId: networkStats?.peerId || null,
    peerCount: networkStats?.peerCount ?? null,
    connections: networkStats?.connections ?? null,
    topology: status?.topology || nodeKernel?.config?.topology || null,
    topologyId: status?.topologyId || nodeKernel?.config?.topologyId || null,
    roomId: nodeKernel?.config?.roomId || null,
    networkGateStatus,
    fallbackReason
  };
}

function summarizeWorkerCapability({
  computeManager,
  nodeKernel,
  enableWorkers
} = {}) {
  const workerConstructorAvailable = typeof globalThis.Worker === 'function';
  const workerPolicy = computeManager?.getWorkerPolicy?.() || null;
  const stats = computeManager?.getStats?.() || null;
  const capabilities = computeManager?.getCapabilities?.() || null;
  const nodeKernelStatus = nodeKernel?.getStatus?.() || null;
  const effectiveEnableWorkers = computeManager?.config?.enableWorkers ?? enableWorkers;
  const supported = workerConstructorAvailable && effectiveEnableWorkers !== false;
  return {
    schema: 'peercompute.ulg.browser-worker-capability.v0',
    status: supported ? 'worker-capability-ready' : 'worker-capability-blocked',
    requestedEnableWorkers: enableWorkers !== false,
    effectiveEnableWorkers: effectiveEnableWorkers !== false,
    workerConstructorAvailable,
    globalScope: typeof globalThis.WorkerGlobalScope === 'function'
      && globalThis.self
      && globalThis.self instanceof globalThis.WorkerGlobalScope
      ? 'worker'
      : 'window-or-node',
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
    workerPolicy,
    workerCount: stats?.workerCount ?? capabilities?.workers ?? null,
    targetWorkers: stats?.targetWorkers ?? capabilities?.targetWorkers ?? workerPolicy?.targetWorkers ?? null,
    workerTasksCompleted: stats?.workerTasksCompleted ?? null,
    inlineTasksCompleted: stats?.inlineTasksCompleted ?? null,
    nodeKernelComputeWorkers: nodeKernelStatus?.compute?.stats?.workerCount ?? null,
    blocker: supported
      ? null
      : (!workerConstructorAvailable ? 'worker-constructor-unavailable' : 'enable-workers-false')
  };
}

export async function createPeerComputeResidentAuthorityHost({
  peercomputeModuleUrl = null,
  nodeKernelModuleUrl = DEFAULT_PEERCOMPUTE_NODE_KERNEL_MODULE_URL,
  computeManagerModuleUrl = DEFAULT_PEERCOMPUTE_COMPUTE_MANAGER_MODULE_URL,
  stateManagerModuleUrl = DEFAULT_PEERCOMPUTE_STATE_MANAGER_MODULE_URL,
  gpuHubModuleUrl = DEFAULT_PEERCOMPUTE_GPU_HUB_MODULE_URL,
  remoteResultQuorumModuleUrl = DEFAULT_PEERCOMPUTE_REMOTE_RESULT_QUORUM_MODULE_URL,
  computeTaskModulePath = DEFAULT_ULG_RESIDENT_COMPUTE_TASK_MODULE_PATH,
  preferNodeKernelAuthority = true,
  fallbackToDirectManagers = true,
  nodeKernelConfig = {},
  docName = `ulg-sph-resident-${Date.now()}-${shortId()}`,
  deltaNamespace = 'deltas',
  enablePersistence = false,
  disableNetworkProvider = true,
  disableBroadcast = true,
  enableWorkers = true,
  enableWebGPU = true,
  gpuDeviceId = 'gpu-device:ulg-browser-resident-host',
  acceptedScopes = ['ulg-sph-resident-pass-dag'],
  requireFenceSatisfied = true,
  initialState = null,
  onAdmission = null
} = {}) {
  const {
    NodeKernel,
    ComputeManager,
    StateManager,
    GPUHubManager,
    createResidentStageWorkerBackend,
    createRemoteResultQuorumValidator
  } = await importPeerComputeClasses({
    peercomputeModuleUrl,
    nodeKernelModuleUrl,
    computeManagerModuleUrl,
    stateManagerModuleUrl,
    gpuHubModuleUrl,
    remoteResultQuorumModuleUrl
  });
  if (typeof ComputeManager !== 'function') {
    throw new Error('PeerCompute module did not export ComputeManager');
  }
  if (typeof StateManager !== 'function') {
    throw new Error('PeerCompute module did not export StateManager');
  }
  let nodeKernel = null;
  let computeManager = null;
  let stateManager = null;
  let gpuHub = null;
  let source = 'peercompute-browser-local-authority-host';
  let nodeKernelMode = 'facade';
  let nodeKernelInitializationError = null;
  let nodeKernelNetworkGateStatus = 'not-started';

  if (preferNodeKernelAuthority && typeof NodeKernel === 'function') {
    try {
      nodeKernel = new NodeKernel(createDefaultNodeKernelConfig({
        docName,
        deltaNamespace,
        enablePersistence,
        disableNetworkProvider,
        disableBroadcast,
        enableWorkers,
        enableWebGPU,
        nodeKernelConfig
      }));
      await nodeKernel.initialize();
      computeManager = nodeKernel.getComputeManager?.() || nodeKernel.computeManager;
      stateManager = nodeKernel.getStateManager?.() || nodeKernel.stateManager;
      gpuHub = nodeKernel.getGPUHub?.() || nodeKernel.gpuHub || null;
      source = 'peercompute-browser-nodekernel-authority-host';
      nodeKernelMode = 'real-peercompute-nodekernel';
    } catch (error) {
      nodeKernelInitializationError = error instanceof Error ? error.message : String(error);
      if (!fallbackToDirectManagers) throw error;
      nodeKernel = null;
      computeManager = null;
      stateManager = null;
      gpuHub = null;
    }
  }

  if (!computeManager || !stateManager) {
    gpuHub = typeof GPUHubManager === 'function'
      ? new GPUHubManager()
      : null;
    stateManager = new StateManager(null, {
      docName,
      enablePersistence,
      disableNetworkProvider,
      disableBroadcast,
      deltaNamespace,
      hotStore: gpuHub?.getHotStore?.()
    });
    await stateManager.initialize(initialState || {
      nodeId: `ulg-browser-resident-${shortId()}`,
      topology: 'local-browser-authority',
      createdAt: Date.now()
    });
    computeManager = new ComputeManager({
      enableWorkers,
      enableWebGPU,
      gpuDeviceId,
      gpuHub
    });
    await computeManager.initialize();
    nodeKernel = createNodeKernelFacade({
      hostId: `ulg-peercompute-resident-host:${shortId()}`,
      computeManager,
      stateManager,
      gpuHub,
      config: {
        source,
        peercomputeModuleUrl,
        nodeKernelModuleUrl,
        computeManagerModuleUrl,
        stateManagerModuleUrl,
        gpuHubModuleUrl,
        docName,
        deltaNamespace,
        enablePersistence,
        disableNetworkProvider,
        disableBroadcast,
        enableWorkers,
        enableWebGPU,
        nodeKernelInitializationError
      }
    });
  }

  computeManager.ulgResidentComputeTaskModulePath = computeTaskModulePath;
  let remotePlacementConfig = null;
  let remotePlacementCleared = false;
  const solverRegistration = registerUlgResidentSolverDescriptors(computeManager, {
    computeTaskModulePath
  });
  computeManager.ulgLawFamilyPromotionAdmissionId = 'ulg-law-family-promotion-admission';
  computeManager.ulgLawFamilyPromotionAdmission = (request = {}) => createUlgLawFamilyPromotionAdmission({
    computeManager,
    lawGraphManifest: solverRegistration.lawGraphManifest,
    admissionId: computeManager.ulgLawFamilyPromotionAdmissionId,
    ...request
  });
  computeManager.submitUlgLawFamilyPromotionAdmissionTask = (request = {}) => {
    const task = createUlgLawFamilyPromotionAdmissionComputeTask({
      lawGraphManifest: solverRegistration.lawGraphManifest,
      admissionId: computeManager.ulgLawFamilyPromotionAdmissionId,
      ...request
    });
    return computeManager.submitTask(task);
  };
  computeManager.submitUlgMechanicsPromotionEvidenceTask = (request = {}) => {
    const task = createUlgMechanicsPromotionEvidenceTask(request);
    return computeManager.submitTask(task);
  };
  computeManager.submitUlgMechanicsChildDryRunTask = (request = {}) => {
    const task = createUlgMechanicsChildDryRunTask(request);
    return computeManager.submitTask(task);
  };
  computeManager.submitUlgMechanicsOnlyResidentStepsTask = (request = {}) => {
    const task = createMlsMpmMechanicsOnlyResidentStepsComputeTask({
      modulePath: computeTaskModulePath,
      ...request
    });
    return computeManager.submitTask(task);
  };
  computeManager.submitUlgMechanicsP2gStageTask = (request = {}) => {
    const task = createMlsMpmMechanicsP2gStageComputeTask({
      modulePath: computeTaskModulePath,
      ...request
    });
    return computeManager.submitTask(task);
  };
  computeManager.submitUlgMechanicsGridUpdateStageTask = (request = {}) => {
    const task = createMlsMpmMechanicsGridUpdateStageComputeTask({
      modulePath: computeTaskModulePath,
      ...request
    });
    return computeManager.submitTask(task);
  };
  computeManager.submitUlgMechanicsG2pStageTask = (request = {}) => {
    const task = createMlsMpmMechanicsG2pStageComputeTask({
      modulePath: computeTaskModulePath,
      ...request
    });
    return computeManager.submitTask(task);
  };
  computeManager.submitUlgGasCellEosProducerStageTask = (request = {}) => {
    const task = createSphGasCellEosProducerStageComputeTask({
      modulePath: computeTaskModulePath,
      ...request
    });
    return computeManager.submitTask(task);
  };
  computeManager.submitUlgSpatialGasLedgerProducerStageTask = (request = {}) => {
    const task = createSphSpatialGasLedgerProducerStageComputeTask({
      modulePath: computeTaskModulePath,
      ...request
    });
    return computeManager.submitTask(task);
  };
  computeManager.runUlgMechanicsStageTaskChain = (request = {}) => runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
    computeManager,
    nodeKernel,
    modulePath: computeTaskModulePath,
    residentAuthorityHost: host,
    ...request
  });
  const createUlgMechanicsResidentStageWorkerRunner = (options = {}) => {
    if (typeof createResidentStageWorkerBackend !== 'function') {
      throw new Error('PeerCompute createResidentStageWorkerBackend is not available');
    }
    return createResidentStageWorkerBackend({
      workerModuleUrl: options.workerModuleUrl || DEFAULT_ULG_MECHANICS_RESIDENT_STAGE_WORKER_MODULE_PATH,
      workerFactory: options.workerFactory,
      workerScriptType: options.workerScriptType || 'module',
      requestIdPrefix: options.requestIdPrefix || 'ulg-mechanics-resident-stage-worker',
      timeoutMs: options.timeoutMs ?? 30000
    });
  };
  const bridge = attachResidentStateManagerCommitBridge({
    computeManager,
    stateManager,
    acceptedScopes,
    requireFenceSatisfied,
    onAdmission
  });
  const hostId = `ulg-peercompute-resident-host:${shortId()}`;
  if (nodeKernel?.schema === ULG_PEERCOMPUTE_NODEKERNEL_FACADE_SCHEMA) {
    nodeKernel.hostId = hostId;
  }
  const host = {
    schema: ULG_PEERCOMPUTE_RESIDENT_AUTHORITY_HOST_SCHEMA,
    status: 'ready',
    hostId,
    source,
    peercomputeModuleUrl,
    nodeKernelModuleUrl,
    computeManagerModuleUrl,
    stateManagerModuleUrl,
    gpuHubModuleUrl,
    computeTaskModulePath,
    createResidentStageWorkerBackend,
    peercomputeResidentStageWorkerBridgeAvailable: typeof createResidentStageWorkerBackend === 'function',
    createUlgMechanicsResidentStageWorkerRunner,
    ulgMechanicsResidentStageWorkerModulePath: DEFAULT_ULG_MECHANICS_RESIDENT_STAGE_WORKER_MODULE_PATH,
    workerCapability: summarizeWorkerCapability({ computeManager, nodeKernel, enableWorkers }),
    nodeKernelMode,
    nodeKernelAuthority: summarizeNodeKernelAuthority({
      nodeKernel,
      nodeKernelMode,
      source,
      fallbackReason: nodeKernelInitializationError,
      networkGateStatus: nodeKernelNetworkGateStatus
    }),
    remotePlacementGate: summarizeRemotePlacementGate({
      nodeKernel,
      nodeKernelMode,
      computeManager,
      remotePlacementConfig,
      remotePlacementCleared
    }),
    solverRegistration,
    lawGraphManifest: solverRegistration.lawGraphManifest,
    computeManager,
    stateManager,
    gpuHub,
    nodeKernel,
    bridge,
    createdAtMs: nowMs(),
    getComputeManager() {
      return computeManager;
    },
    getStateManager() {
      return stateManager;
    },
    getGPUHub() {
      return gpuHub;
    },
    admitLawFamilyPromotion(request = {}) {
      return computeManager.ulgLawFamilyPromotionAdmission({
        lawGraphManifest: host.lawGraphManifest || solverRegistration.lawGraphManifest,
        ...request
      });
    },
    submitLawFamilyPromotionAdmissionTask(request = {}) {
      const task = createUlgLawFamilyPromotionAdmissionComputeTask({
        lawGraphManifest: host.lawGraphManifest || solverRegistration.lawGraphManifest,
        admissionId: computeManager.ulgLawFamilyPromotionAdmissionId,
        ...request
      });
      return computeManager.submitTask(task);
    },
    submitMechanicsPromotionEvidenceTask(request = {}) {
      return computeManager.submitUlgMechanicsPromotionEvidenceTask(request);
    },
    submitMechanicsChildDryRunTask(request = {}) {
      return computeManager.submitUlgMechanicsChildDryRunTask(request);
    },
    submitMechanicsOnlyResidentStepsTask(request = {}) {
      return computeManager.submitUlgMechanicsOnlyResidentStepsTask(request);
    },
    submitMechanicsP2gStageTask(request = {}) {
      return computeManager.submitUlgMechanicsP2gStageTask(request);
    },
    submitMechanicsGridUpdateStageTask(request = {}) {
      return computeManager.submitUlgMechanicsGridUpdateStageTask(request);
    },
    submitMechanicsG2pStageTask(request = {}) {
      return computeManager.submitUlgMechanicsG2pStageTask(request);
    },
    submitSpatialGasLedgerProducerStageTask(request = {}) {
      return computeManager.submitUlgSpatialGasLedgerProducerStageTask(request);
    },
    submitGasCellEosProducerStageTask(request = {}) {
      return computeManager.submitUlgGasCellEosProducerStageTask(request);
    },
    runMechanicsStageTaskChain(request = {}) {
      return computeManager.runUlgMechanicsStageTaskChain(request);
    },
    createRemoteSeedHotBufferRefreshExecutor(options = {}) {
      return createUlgSphMlsMpmHotBufferRefreshExecutor(options);
    },
    publishSameDeviceHotBufferSource(options = {}) {
      return publishUlgSphMlsMpmSameDeviceHotBufferSource({
        stateManager,
        ...options
      });
    },
    publishWorkerRetainedMechanicsStageOutput(options = {}) {
      return publishUlgMechanicsWorkerRetainedHotBufferSource({
        stateManager,
        nodeKernel,
        ...options
      });
    },
    planWorkerRetainedContinuation(options = {}) {
      return planWorkerRetainedContinuationFromAccessContract({
        stateManager,
        ...options
      });
    },
    publishWorkerRetainedThermalPhaseStageOutput(options = {}) {
      return publishUlgThermalPhaseWorkerRetainedHotBufferSource({
        stateManager,
        nodeKernel,
        ...options
      });
    },
    publishWorkerRetainedPressureInterfaceStageOutput(options = {}) {
      return publishUlgPressureInterfaceWorkerRetainedHotBufferSource({
        stateManager,
        nodeKernel,
        ...options
      });
    },
    publishPressureInterfaceGasCellFieldAdmission(options = {}) {
      return publishUlgPressureInterfaceGasCellFieldAdmission({
        stateManager,
        nodeKernel,
        ...options
      });
    },
    publishPressureInterfaceGasCellFieldImportSource(options = {}) {
      return publishUlgPressureInterfaceGasCellFieldImportSource({
        stateManager,
        nodeKernel,
        ...options
      });
    },
    publishWorkerRetainedReactionProductStageOutput(options = {}) {
      return publishUlgReactionProductWorkerRetainedHotBufferSource({
        stateManager,
        nodeKernel,
        ...options
      });
    },
    async refreshRemoteSeedHotBuffers(cacheKeyOrOptions, options = {}) {
      const source = cacheKeyOrOptions && typeof cacheKeyOrOptions === 'object'
        ? cacheKeyOrOptions
        : options;
      const cacheKey = normalizeString(
        typeof cacheKeyOrOptions === 'string'
          ? cacheKeyOrOptions
          : source?.cacheKey,
        null
      );
      const requestedAtMs = nowMs();
      const base = {
        schema: ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_AUTHORITY_REPORT_SCHEMA,
        status: 'blocked',
        hostId,
        cacheKey,
        requestedAtMs,
        authority: 'ulg-browser-resident-authority-host-nodekernel-refresh'
      };
      if (!cacheKey) {
        return {
          ...base,
          reason: 'cache-key-required'
        };
      }
      if (typeof nodeKernel?.commitRemoteTaskGraphStateSeed !== 'function'
        || typeof nodeKernel?.refreshRemoteTaskGraphHotBuffersFromSeed !== 'function') {
        return {
          ...base,
          status: 'nodekernel-refresh-unavailable',
          reason: 'real-nodekernel-remote-seed-refresh-api-required'
        };
      }
      const refreshExecutor = typeof source?.refreshExecutor === 'function'
        ? source.refreshExecutor
        : createUlgSphMlsMpmHotBufferRefreshExecutor({
            device: source?.device,
            materialProperties: source?.materialProperties,
            hotBufferKey: source?.hotBufferKey,
            hotBufferKeyPrefix: source?.hotBufferKeyPrefix
          });
      const allowedStateFamilies = source?.allowedStateFamilies ?? defaultSphMlsMpmSeedRefreshFamilies();
      const seed = source?.skipSeedCommit === true
        ? null
        : nodeKernel.commitRemoteTaskGraphStateSeed(cacheKey, {
            allowedStateFamilies,
            allowHotBufferRefresh: true,
            returnCommitDelta: source?.returnCommitDelta === true,
            validatedStateSeedPayload: source?.validatedStateSeedPayload,
            stateSeedPayloadOverride: source?.stateSeedPayloadOverride,
            stateSeedPayload: source?.stateSeedPayload,
            seedScope: source?.seedScope,
            taskId: source?.seedTaskId,
            deltaTaskId: source?.seedDeltaTaskId,
            version: source?.seedVersion
          });
      if (seed && seed.committed !== true) {
        return {
          ...base,
          status: 'seed-commit-blocked',
          reason: seed.reason || seed.status || 'remote-seed-commit-blocked',
          seed
        };
      }
      const refresh = await nodeKernel.refreshRemoteTaskGraphHotBuffersFromSeed(cacheKey, {
        refreshExecutor,
        returnCommitDelta: source?.returnCommitDelta === true,
        seedScope: source?.seedScope,
        seedTaskId: source?.seedTaskId,
        refreshScope: source?.refreshScope,
        refreshDeltaTaskId: source?.refreshDeltaTaskId,
        laneId: source?.laneId,
        stateKey: source?.stateKey,
        domainKey: source?.domainKey,
        solverId: source?.solverId,
        refreshTaskId: source?.refreshTaskId,
        copyBudget: source?.copyBudget,
        localRetainedBufferRefs: source?.localRetainedBufferRefs,
        forceRefresh: source?.forceRefresh === true
      });
      return {
        ...base,
        status: refresh?.refreshed === true
          ? 'remote-seed-hot-buffer-refresh-completed'
          : 'remote-seed-hot-buffer-refresh-not-completed',
        refreshed: refresh?.refreshed === true,
        seed,
        refresh,
        hotBufferKey: refresh?.refreshResult?.hotBufferKey || null,
        localBufferRefs: Array.isArray(refresh?.localBufferRefs)
          ? [...refresh.localBufferRefs]
          : []
      };
    },
    async refreshRemoteCompactCandidateHotBuffers(cacheKeyOrOptions, options = {}) {
      const source = cacheKeyOrOptions && typeof cacheKeyOrOptions === 'object'
        ? cacheKeyOrOptions
        : options;
      const cacheKey = normalizeString(
        typeof cacheKeyOrOptions === 'string'
          ? cacheKeyOrOptions
          : source?.cacheKey,
        null
      );
      const requestedAtMs = nowMs();
      const base = {
        schema: ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_AUTHORITY_REPORT_SCHEMA,
        status: 'blocked',
        sourceMode: 'compact-candidate',
        hostId,
        cacheKey,
        requestedAtMs,
        authority: 'ulg-browser-resident-authority-host-nodekernel-compact-refresh'
      };
      if (!cacheKey) {
        return {
          ...base,
          reason: 'cache-key-required'
        };
      }
      if (typeof nodeKernel?.refreshRemoteTaskGraphHotBuffersFromCompactCandidate !== 'function') {
        return {
          ...base,
          status: 'nodekernel-compact-refresh-unavailable',
          reason: 'real-nodekernel-remote-compact-refresh-api-required'
        };
      }
      const compactRefreshExecutor = source?.compactRefreshExecutor
        || source?.refreshExecutor
        || (source?.useDefaultCompactRefreshExecutor === true
          ? createUlgSphMlsMpmCompactHotBufferRefreshExecutor({
              device: source?.device,
              materialProperties: source?.materialProperties,
              hotBufferKey: source?.hotBufferKey,
              hotBufferKeyPrefix: source?.hotBufferKeyPrefix
            })
          : undefined);
      const refresh = await nodeKernel.refreshRemoteTaskGraphHotBuffersFromCompactCandidate(cacheKey, {
        ...source,
        cacheKey,
        refreshExecutor: compactRefreshExecutor,
        compactCandidateScope: source?.compactCandidateScope,
        compactCandidateTaskId: source?.compactCandidateTaskId,
        candidateId: source?.candidateId,
        localRetainedBufferRefs: source?.localRetainedBufferRefs,
        returnCommitDelta: source?.returnCommitDelta === true,
        refreshScope: source?.refreshScope,
        refreshDeltaTaskId: source?.refreshDeltaTaskId,
        laneId: source?.laneId,
        stateKey: source?.stateKey,
        domainKey: source?.domainKey,
        solverId: source?.solverId,
        refreshTaskId: source?.refreshTaskId,
        copyBudget: source?.copyBudget,
        forceRefresh: source?.forceRefresh === true
      });
      return {
        ...base,
        status: refresh?.refreshed === true
          ? 'remote-compact-candidate-hot-buffer-refresh-completed'
          : 'remote-compact-candidate-hot-buffer-refresh-not-completed',
        refreshed: refresh?.refreshed === true,
        refresh,
        hotBufferKey: refresh?.refreshResult?.hotBufferKey || null,
        localBufferRefs: Array.isArray(refresh?.localBufferRefs)
          ? [...refresh.localBufferRefs]
          : []
      };
    },
    async submitTaskGraphWithRemoteSeedHotBufferRefresh(graph = {}, options = {}) {
      const submittedAtMs = nowMs();
      const graphId = graph?.graphId || graph?.id || null;
      const base = {
        schema: ULG_REMOTE_TASK_GRAPH_SUBMIT_REFRESH_REPORT_SCHEMA,
        status: 'blocked',
        hostId,
        graphId,
        submittedAtMs,
        authority: 'ulg-browser-resident-authority-host-nodekernel-task-graph-refresh'
      };
      if (typeof nodeKernel?.submitTaskGraph !== 'function') {
        return {
          ...base,
          reason: 'nodekernel-submit-task-graph-required'
        };
      }
      const result = await nodeKernel.submitTaskGraph(graph);
      const preflight = result?.remoteTaskGraphCacheArtifactPreflight
        || result?.taskGraphPlacementProvenance?.cacheArtifactPreflight
        || null;
      const cacheKey = normalizeString(
        options.cacheKey
          || preflight?.cacheKey
          || result?.cacheKey
          || result?.cacheArtifact?.cacheKey,
        null
      );
      const imported = preflight?.importedLocally === true
        || preflight?.status === 'admitted-through-node-kernel-state-manager';
      if (!cacheKey || !imported) {
        return {
          ...base,
          status: 'task-graph-submitted-no-remote-seed-refresh',
          refreshed: false,
          reason: !cacheKey
            ? 'task-graph-result-did-not-provide-cache-key'
            : 'task-graph-result-was-not-an-admitted-imported-remote-cache-artifact',
          result,
          remoteTaskGraphCacheArtifactPreflight: preflight
        };
      }
      const refreshSeed = selectRemoteGraphRefreshSeedPayload(result, options);
      if (refreshSeed.blockRefresh === true && !refreshSeed.payload) {
        let compactCandidateAdmission = null;
        let compactCandidateRefreshReport = null;
        if (refreshSeed.compactMechanicsStageCandidate) {
          if (typeof nodeKernel?.commitRemoteTaskGraphCompactCandidate === 'function') {
            try {
              compactCandidateAdmission = nodeKernel.commitRemoteTaskGraphCompactCandidate(cacheKey, {
                allowedStateFamilies: options.allowedStateFamilies ?? defaultSphMlsMpmSeedRefreshFamilies(),
                compactMechanicsStageCandidate: refreshSeed.compactMechanicsStageCandidate,
                returnCommitDelta: options.returnCommitDelta === true,
                scope: options.compactCandidateScope,
                taskId: options.compactCandidateTaskId,
                deltaTaskId: options.compactCandidateDeltaTaskId,
                version: options.compactCandidateVersion
              });
            } catch (error) {
              compactCandidateAdmission = {
                status: 'compact-candidate-admission-threw',
                committed: false,
                reason: 'nodekernel-compact-candidate-admission-threw',
                message: String(error?.message || error)
              };
            }
          } else {
            compactCandidateAdmission = {
              status: 'compact-candidate-admission-unavailable',
              committed: false,
              reason: 'nodekernel-compact-candidate-api-required'
            };
          }
          if (options.attemptCompactCandidateRefresh === true) {
            compactCandidateRefreshReport = await host.refreshRemoteCompactCandidateHotBuffers(cacheKey, {
              ...options,
              compactCandidateScope: options.compactCandidateScope,
              compactCandidateTaskId: compactCandidateAdmission?.commitDeltaTaskId || options.compactCandidateTaskId,
              candidateId: refreshSeed.compactMechanicsStageCandidate.hash || options.candidateId,
              compactRefreshExecutor: options.compactRefreshExecutor || options.compactCandidateRefreshExecutor,
              returnCommitDelta: options.returnCommitDelta === true
            });
          }
        }
        return {
          ...base,
          status: 'task-graph-submitted-remote-seed-hot-buffer-refresh-blocked',
          refreshed: false,
          cacheKey,
          reason: refreshSeed.reason || refreshSeed.source,
          refreshSeedPayloadSource: refreshSeed.source,
          result,
          remoteTaskGraphCacheArtifactPreflight: preflight,
          compactMechanicsStageCandidate: refreshSeed.compactMechanicsStageCandidate || null,
          compactCandidateAdmission,
          compactCandidateAdmissionStatus: compactCandidateAdmission?.status || null,
          compactCandidateRefreshReport,
          refreshReport: null,
          hotBufferKey: null,
          localBufferRefs: []
        };
      }
      const refreshReport = await host.refreshRemoteSeedHotBuffers(cacheKey, {
        ...options,
        cacheKey,
        validatedStateSeedPayload: refreshSeed.payload || options.validatedStateSeedPayload,
        stateSeedPayloadOverride: refreshSeed.payload || options.stateSeedPayloadOverride
      });
      return {
        ...base,
        status: refreshReport.refreshed === true
          ? 'task-graph-submitted-remote-seed-hot-buffer-refreshed'
          : 'task-graph-submitted-remote-seed-hot-buffer-refresh-blocked',
        refreshed: refreshReport.refreshed === true,
        cacheKey,
        refreshSeedPayloadSource: refreshSeed.source,
        result,
        remoteTaskGraphCacheArtifactPreflight: preflight,
        compactMechanicsStageCandidate: refreshSeed.compactMechanicsStageCandidate || null,
        refreshReport,
        hotBufferKey: refreshReport.hotBufferKey || null,
        localBufferRefs: Array.isArray(refreshReport.localBufferRefs)
          ? [...refreshReport.localBufferRefs]
          : []
      };
    },
    refreshNodeKernelAuthorityStatus() {
      host.nodeKernelAuthority = summarizeNodeKernelAuthority({
        nodeKernel,
        nodeKernelMode,
        source,
        fallbackReason: nodeKernelInitializationError,
        networkGateStatus: nodeKernelNetworkGateStatus
      });
      host.workerCapability = summarizeWorkerCapability({ computeManager, nodeKernel, enableWorkers });
      return host.nodeKernelAuthority;
    },
    refreshRemotePlacementGateStatus() {
      host.remotePlacementGate = summarizeRemotePlacementGate({
        nodeKernel,
        nodeKernelMode,
        computeManager,
        remotePlacementConfig,
        remotePlacementCleared
      });
      return host.remotePlacementGate;
    },
    configureRemotePlacement({
      peerId = null,
      remotePeerId = null,
      primaryPeerId = null,
      replicaPeerIds = [],
      redundantPeerIds = [],
      targetReplicaCount = null,
      quorumResultCount = null,
      timeoutMs = 30000,
      primaryTimeoutMs = null,
      replicaTimeoutMs = null,
      executorId = null,
      admissionId = 'ulg-resident-remote-placement-admission',
      validationId = 'ulg-resident-remote-result-quorum',
      promoteReplicaOnPrimaryFailure = true
    } = {}) {
      const resolvedPrimaryPeerId = normalizeString(primaryPeerId, null)
        || normalizeString(peerId, null)
        || normalizeString(remotePeerId, null);
      if (nodeKernelMode !== 'real-peercompute-nodekernel' || typeof nodeKernel?.createNetworkPlacementExecutor !== 'function') {
        remotePlacementConfig = null;
        remotePlacementCleared = false;
        host.remotePlacementGate = {
          ...host.refreshRemotePlacementGateStatus(),
          status: 'unavailable',
          issues: ['real-nodekernel-placement-executor-required']
        };
        return host.remotePlacementGate;
      }
      if (!resolvedPrimaryPeerId) {
        remotePlacementConfig = null;
        remotePlacementCleared = false;
        return host.refreshRemotePlacementGateStatus();
      }
      const requestedReplicas = uniqueStringList([
        ...normalizeStringList(replicaPeerIds),
        ...normalizeStringList(redundantPeerIds)
      ]).filter((entry) => entry !== resolvedPrimaryPeerId);
      const resolvedTargetReplicaCount = normalizePositiveInteger(
        targetReplicaCount,
        1 + requestedReplicas.length,
        1,
        1024
      );
      const replicaLimit = Math.max(0, resolvedTargetReplicaCount - 1);
      const resolvedReplicaPeerIds = requestedReplicas.slice(0, replicaLimit);
      const quorumEnabled = resolvedReplicaPeerIds.length > 0;
      const resolvedQuorumResultCount = quorumEnabled
        ? normalizePositiveInteger(
            quorumResultCount,
            1 + resolvedReplicaPeerIds.length,
            2,
            1024
          )
        : 1;
      const normalizedTimeoutMs = normalizePositiveInteger(timeoutMs, 30000, 0, 3600000);
      const executorOptions = {
        executorId,
        peerId: resolvedPrimaryPeerId,
        primaryPeerId: resolvedPrimaryPeerId,
        replicaPeerIds: resolvedReplicaPeerIds,
        targetReplicaCount: 1 + resolvedReplicaPeerIds.length,
        timeoutMs: normalizedTimeoutMs,
        primaryTimeoutMs: primaryTimeoutMs == null ? undefined : normalizePositiveInteger(primaryTimeoutMs, normalizedTimeoutMs, 0, 3600000),
        replicaTimeoutMs: replicaTimeoutMs == null ? undefined : normalizePositiveInteger(replicaTimeoutMs, normalizedTimeoutMs, 0, 3600000),
        promoteReplicaOnPrimaryFailure
      };
      const placementExecutor = quorumEnabled
        ? nodeKernel.createRedundantNetworkPlacementExecutor(
            [resolvedPrimaryPeerId, ...resolvedReplicaPeerIds],
            executorOptions
          )
        : nodeKernel.createNetworkPlacementExecutor(resolvedPrimaryPeerId, executorOptions);
      const placementAdmission = createRemotePlacementAdmission({ admissionId });
      const placementResultValidator = quorumEnabled && typeof createRemoteResultQuorumValidator === 'function'
        ? createRemoteResultQuorumValidator({
            validationId,
            minReplicaCount: resolvedQuorumResultCount,
            minMatchingReplicas: resolvedQuorumResultCount
          })
        : null;
      computeManager.configurePlacementHooks?.({
        placementExecutor,
        placementExecutorId: placementExecutor.placementExecutorId,
        placementAdmission,
        placementAdmissionId: admissionId,
        placementResultValidator,
        placementResultValidatorId: placementResultValidator?.placementResultValidatorId || null,
        placementTimeoutMs: normalizedTimeoutMs,
        remoteResultVerification: true
      });
      remotePlacementConfig = {
        primaryPeerId: resolvedPrimaryPeerId,
        replicaPeerIds: resolvedReplicaPeerIds,
        targetReplicaCount: 1 + resolvedReplicaPeerIds.length,
        quorumEnabled,
        quorumResultCount: resolvedQuorumResultCount,
        timeoutMs: normalizedTimeoutMs,
        executorId: placementExecutor.placementExecutorId,
        admissionId,
        resultValidatorId: placementResultValidator?.placementResultValidatorId || null
      };
      remotePlacementCleared = false;
      return host.refreshRemotePlacementGateStatus();
    },
    clearRemotePlacement() {
      computeManager.configurePlacementHooks?.({
        placementExecutor: null,
        placementAdmission: null,
        placementResultValidator: null,
        placementTaskSigner: null,
        placementTimeoutMs: 30000
      });
      remotePlacementConfig = null;
      remotePlacementCleared = true;
      return host.refreshRemotePlacementGateStatus();
    },
    async startNodeKernelNetwork(bootstrapPeers = undefined) {
      if (nodeKernelMode !== 'real-peercompute-nodekernel' || typeof nodeKernel?.start !== 'function') {
        nodeKernelNetworkGateStatus = 'start-unavailable-facade-fallback';
        return {
          schema: ULG_PEERCOMPUTE_NODEKERNEL_NETWORK_GATE_SCHEMA,
          status: nodeKernelNetworkGateStatus,
          started: false,
          authority: host.refreshNodeKernelAuthorityStatus(),
          remotePlacementGate: host.refreshRemotePlacementGateStatus()
        };
      }
      if (nodeKernel.isStarted) {
        nodeKernelNetworkGateStatus = 'already-started';
        return {
          schema: ULG_PEERCOMPUTE_NODEKERNEL_NETWORK_GATE_SCHEMA,
          status: nodeKernelNetworkGateStatus,
          started: true,
          authority: host.refreshNodeKernelAuthorityStatus(),
          remotePlacementGate: host.refreshRemotePlacementGateStatus()
        };
      }
      try {
        nodeKernelNetworkGateStatus = 'starting';
        host.refreshNodeKernelAuthorityStatus();
        await nodeKernel.start(bootstrapPeers);
        nodeKernelNetworkGateStatus = 'started';
        return {
          schema: ULG_PEERCOMPUTE_NODEKERNEL_NETWORK_GATE_SCHEMA,
          status: nodeKernelNetworkGateStatus,
          started: nodeKernel.isStarted === true,
          authority: host.refreshNodeKernelAuthorityStatus(),
          remotePlacementGate: host.refreshRemotePlacementGateStatus()
        };
      } catch (error) {
        nodeKernelNetworkGateStatus = 'start-failed';
        const message = error instanceof Error ? error.message : String(error);
        const authority = host.refreshNodeKernelAuthorityStatus();
        return {
          schema: ULG_PEERCOMPUTE_NODEKERNEL_NETWORK_GATE_SCHEMA,
          status: nodeKernelNetworkGateStatus,
          started: false,
          error: message,
          authority,
          remotePlacementGate: host.refreshRemotePlacementGateStatus()
        };
      }
    },
    async stopNodeKernelNetwork() {
      if (nodeKernelMode !== 'real-peercompute-nodekernel') {
        nodeKernelNetworkGateStatus = 'stop-unavailable-facade-fallback';
        return {
          schema: ULG_PEERCOMPUTE_NODEKERNEL_NETWORK_GATE_SCHEMA,
          status: nodeKernelNetworkGateStatus,
          stopped: false,
          authority: host.refreshNodeKernelAuthorityStatus(),
          remotePlacementGate: host.refreshRemotePlacementGateStatus()
        };
      }
      const networkManager = nodeKernel?.getNetworkManager?.() || nodeKernel?.networkManager || null;
      if (!nodeKernel?.isStarted && networkManager?.isConnected !== true) {
        nodeKernelNetworkGateStatus = 'already-stopped';
        return {
          schema: ULG_PEERCOMPUTE_NODEKERNEL_NETWORK_GATE_SCHEMA,
          status: nodeKernelNetworkGateStatus,
          stopped: true,
          authority: host.refreshNodeKernelAuthorityStatus(),
          remotePlacementGate: host.refreshRemotePlacementGateStatus()
        };
      }
      try {
        if (typeof nodeKernel?.clearStateProviderSyncTimers === 'function') {
          nodeKernel.clearStateProviderSyncTimers();
        } else {
          nodeKernel?._clearStateProviderSyncTimers?.();
        }
        await networkManager?.disconnect?.();
        nodeKernel.isStarted = false;
        nodeKernel.stateManager?.write?.('status', 'initialized-local-network-stopped');
        nodeKernelNetworkGateStatus = 'stopped-network-only';
        return {
          schema: ULG_PEERCOMPUTE_NODEKERNEL_NETWORK_GATE_SCHEMA,
          status: nodeKernelNetworkGateStatus,
          stopped: true,
          authority: host.refreshNodeKernelAuthorityStatus(),
          remotePlacementGate: host.refreshRemotePlacementGateStatus()
        };
      } catch (error) {
        nodeKernelNetworkGateStatus = 'stop-failed';
        return {
          schema: ULG_PEERCOMPUTE_NODEKERNEL_NETWORK_GATE_SCHEMA,
          status: nodeKernelNetworkGateStatus,
          stopped: false,
          error: error instanceof Error ? error.message : String(error),
          authority: host.refreshNodeKernelAuthorityStatus(),
          remotePlacementGate: host.refreshRemotePlacementGateStatus()
        };
      }
    },
    readResidentStepsCommittedWarmDelta(options = {}) {
      return readResidentStepsCommittedWarmDelta(stateManager, options);
    },
    async destroy() {
      if (nodeKernelMode === 'real-peercompute-nodekernel') {
        if (nodeKernel?.isStarted) {
          await host.stopNodeKernelNetwork();
        } else {
          nodeKernel?._unregisterBrowserKernelHandle?.();
        }
      }
      await stateManager.destroy?.();
      host.status = 'destroyed';
      host.nodeKernelAuthority = {
        ...(host.nodeKernelAuthority || {}),
        status: 'destroyed',
        started: false
      };
      host.destroyedAtMs = nowMs();
      if (sharedHost === host) sharedHost = null;
      return {
        schema: ULG_PEERCOMPUTE_RESIDENT_AUTHORITY_HOST_SCHEMA,
        status: 'destroyed',
        hostId
      };
    }
  };
  return host;
}

export function summarizePeerComputeResidentAuthorityHost(host = null) {
  const residentDescriptors = Array.isArray(host?.solverRegistration?.descriptors)
    ? host.solverRegistration.descriptors
    : [];
  const residentLawFamilySolvers = residentDescriptors.filter(
    (solver) => solver?.metadata?.parentLawGraphNodeId === ULG_RESIDENT_PASS_DAG_NODE_ID
      && solver?.metadata?.executableStatus === 'metadata-only-pass-dag-child'
  );
  const residentExecutableSolvers = residentDescriptors.filter((solver) => solver?.hasExecutor === true);
  const lawGraphManifest = host?.lawGraphManifest || host?.solverRegistration?.lawGraphManifest || null;
  return {
    schema: ULG_PEERCOMPUTE_RESIDENT_AUTHORITY_HOST_SCHEMA,
    status: host?.status || 'not-configured',
    hostId: host?.hostId || null,
    source: host?.source || null,
    peercomputeModuleUrl: host?.peercomputeModuleUrl || null,
    computeTaskModulePath: host?.computeTaskModulePath || null,
    computeManagerReady: Boolean(host?.computeManager?.submitTask),
    stateManagerReady: Boolean(
      host?.stateManager?.getWarmDeltas
        || host?.stateManager?.readWarm
        || host?.stateManager?.getDataState
    ),
    nodeKernelFacade: host?.nodeKernel?.schema || null,
    bridgeStatus: host?.bridge?.status || null,
    nodeKernelAuthority: host?.nodeKernelAuthority?.schema || null,
    nodeKernelMode: host?.nodeKernelMode || null,
    nodeKernelReady: Boolean(host?.nodeKernelAuthority?.initialized),
    nodeKernelStarted: Boolean(host?.nodeKernelAuthority?.started),
    nodeKernelNetworkConnected: Boolean(host?.nodeKernelAuthority?.networkConnected),
    nodeKernelNetworkGateStatus: host?.nodeKernelAuthority?.networkGateStatus || null,
    nodeKernelConstructor: host?.nodeKernelAuthority?.constructorName || null,
    remotePlacementStatus: host?.remotePlacementGate?.status || null,
    remotePlacementConfigured: host?.remotePlacementGate?.configured === true,
    remotePlacementReady: host?.remotePlacementGate?.readyToPlace === true,
    remotePlacementExecutorId: host?.remotePlacementGate?.executorId || null,
    remotePlacementPrimaryPeerId: host?.remotePlacementGate?.primaryPeerId || null,
    remotePlacementReplicaPeerIds: Array.isArray(host?.remotePlacementGate?.replicaPeerIds)
      ? [...host.remotePlacementGate.replicaPeerIds]
      : [],
    remotePlacementQuorumEnabled: host?.remotePlacementGate?.quorumEnabled === true,
    remotePlacementIssues: Array.isArray(host?.remotePlacementGate?.issues)
      ? [...host.remotePlacementGate.issues]
      : [],
    residentSolverRegistrationStatus: host?.solverRegistration?.status || null,
    residentSolverIds: Array.isArray(host?.solverRegistration?.solverIds)
      ? [...host.solverRegistration.solverIds]
      : [],
    residentExecutableSolverIds: residentExecutableSolvers.map((solver) => solver.id),
    residentLawFamilySolverIds: residentLawFamilySolvers.map((solver) => solver.id),
    residentLawGraphId: residentLawFamilySolvers[0]?.metadata?.lawGraphNode?.graphId
      || residentExecutableSolvers[0]?.metadata?.lawGraphNode?.graphId
      || null,
    residentLawGraphManifestSchema: lawGraphManifest?.schema || null,
    residentLawGraphNodeCount: lawGraphManifest?.nodeCount ?? null,
    residentLawGraphEdgeCount: lawGraphManifest?.edgeCount ?? null,
    residentLawGraphExecutableNodeIds: Array.isArray(lawGraphManifest?.executableNodeIds)
      ? [...lawGraphManifest.executableNodeIds]
      : [],
    residentLawGraphMetadataOnlyNodeIds: Array.isArray(lawGraphManifest?.metadataOnlyNodeIds)
      ? [...lawGraphManifest.metadataOnlyNodeIds]
      : [],
    residentStateFamilyOwnerMapStatus: lawGraphManifest?.stateFamilyOwnerMapStatus || null,
    residentStateFamilyOwnerConflicts: Array.isArray(lawGraphManifest?.stateFamilyOwnerConflicts)
      ? lawGraphManifest.stateFamilyOwnerConflicts.map((conflict) => ({ ...conflict }))
      : [],
    residentCurrentStateFamilyOwnerNodeIds: lawGraphManifest?.currentStateFamilyOwners
      ? Object.fromEntries(
          Object.entries(lawGraphManifest.currentStateFamilyOwners)
            .map(([family, owner]) => [family, owner?.nodeId || null])
        )
      : {},
    residentProspectiveStateFamilyOwnerNodeIds: lawGraphManifest?.prospectiveStateFamilyOwners
      ? Object.fromEntries(
          Object.entries(lawGraphManifest.prospectiveStateFamilyOwners)
            .map(([family, owners]) => [family, (owners || []).map((owner) => owner.nodeId)])
        )
      : {},
    residentFirstPromotionCandidateNodeId: lawGraphManifest?.firstPromotionCandidateNodeId || null,
    residentFirstPromotionCandidateFamilies: Array.isArray(lawGraphManifest?.firstPromotionCandidateFamilies)
      ? [...lawGraphManifest.firstPromotionCandidateFamilies]
      : [],
    residentLawFamilyPromotionAdmissionReady: typeof host?.computeManager?.ulgLawFamilyPromotionAdmission === 'function',
    residentLawFamilyPromotionAdmissionTaskReady: typeof host?.computeManager?.submitUlgLawFamilyPromotionAdmissionTask === 'function'
      || typeof host?.submitLawFamilyPromotionAdmissionTask === 'function',
    residentLawFamilyPromotionAdmissionId: host?.computeManager?.ulgLawFamilyPromotionAdmissionId || null,
    residentMechanicsPromotionEvidenceTaskReady: typeof host?.computeManager?.submitUlgMechanicsPromotionEvidenceTask === 'function'
      || typeof host?.submitMechanicsPromotionEvidenceTask === 'function',
    residentMechanicsChildDryRunTaskReady: typeof host?.computeManager?.submitUlgMechanicsChildDryRunTask === 'function'
      || typeof host?.submitMechanicsChildDryRunTask === 'function',
    residentMechanicsOnlyResidentStepsTaskReady: typeof host?.computeManager?.submitUlgMechanicsOnlyResidentStepsTask === 'function'
      || typeof host?.submitMechanicsOnlyResidentStepsTask === 'function',
    residentMechanicsP2gStageTaskReady: typeof host?.computeManager?.submitUlgMechanicsP2gStageTask === 'function'
      || typeof host?.submitMechanicsP2gStageTask === 'function',
    residentMechanicsGridUpdateStageTaskReady: typeof host?.computeManager?.submitUlgMechanicsGridUpdateStageTask === 'function'
      || typeof host?.submitMechanicsGridUpdateStageTask === 'function',
    residentMechanicsG2pStageTaskReady: typeof host?.computeManager?.submitUlgMechanicsG2pStageTask === 'function'
      || typeof host?.submitMechanicsG2pStageTask === 'function',
    residentSpatialGasLedgerProducerStageTaskReady: typeof host?.computeManager?.submitUlgSpatialGasLedgerProducerStageTask === 'function'
      || typeof host?.submitSpatialGasLedgerProducerStageTask === 'function',
    residentGasCellEosProducerStageTaskReady: typeof host?.computeManager?.submitUlgGasCellEosProducerStageTask === 'function'
      || typeof host?.submitGasCellEosProducerStageTask === 'function',
    residentMechanicsStageTaskChainReady: typeof host?.computeManager?.runUlgMechanicsStageTaskChain === 'function'
      || typeof host?.runMechanicsStageTaskChain === 'function',
    workerCapabilitySchema: host?.workerCapability?.schema || null,
    workerCapabilityStatus: host?.workerCapability?.status || null,
    workerCapabilityBlocker: host?.workerCapability?.blocker || null,
    workerConstructorAvailable: host?.workerCapability?.workerConstructorAvailable ?? null,
    workerRequestedEnableWorkers: host?.workerCapability?.requestedEnableWorkers ?? null,
    workerEffectiveEnableWorkers: host?.workerCapability?.effectiveEnableWorkers ?? null,
    workerCount: host?.workerCapability?.workerCount ?? null,
    workerTargetWorkers: host?.workerCapability?.targetWorkers ?? null,
    peercomputeResidentStageWorkerBridgeAvailable: host?.peercomputeResidentStageWorkerBridgeAvailable === true,
    residentMechanicsStageWorkerRunnerFactoryReady: typeof host?.createUlgMechanicsResidentStageWorkerRunner === 'function',
    residentMechanicsStageWorkerModulePath: host?.ulgMechanicsResidentStageWorkerModulePath || null,
    residentSameDeviceHotBufferSourcePublicationReady: typeof host?.publishSameDeviceHotBufferSource === 'function',
    residentWorkerRetainedMechanicsPublicationReady: typeof host?.publishWorkerRetainedMechanicsStageOutput === 'function',
    residentWorkerRetainedContinuationPlannerReady: typeof host?.planWorkerRetainedContinuation === 'function',
    residentWorkerRetainedThermalPhasePublicationReady: typeof host?.publishWorkerRetainedThermalPhaseStageOutput === 'function',
    residentWorkerRetainedPressureInterfacePublicationReady: typeof host?.publishWorkerRetainedPressureInterfaceStageOutput === 'function',
    residentPressureInterfaceGasCellFieldAdmissionPublicationReady: typeof host?.publishPressureInterfaceGasCellFieldAdmission === 'function',
    residentPressureInterfaceGasCellFieldImportPublicationReady: typeof host?.publishPressureInterfaceGasCellFieldImportSource === 'function',
    residentWorkerRetainedReactionProductPublicationReady: typeof host?.publishWorkerRetainedReactionProductStageOutput === 'function',
    residentRemoteSeedHotBufferRefreshReady: typeof host?.refreshRemoteSeedHotBuffers === 'function',
    residentRemoteSeedHotBufferRefreshExecutorReady: typeof host?.createRemoteSeedHotBufferRefreshExecutor === 'function',
    residentTaskGraphSubmitRefreshReady: typeof host?.submitTaskGraphWithRemoteSeedHotBufferRefresh === 'function'
  };
}

export async function ensurePeerComputeResidentAuthorityHost(options = {}) {
  if (sharedHost?.status === 'ready') return sharedHost;
  if (!sharedHostPromise) {
    sharedHostPromise = createPeerComputeResidentAuthorityHost(options)
      .then((host) => {
        sharedHost = host;
        return host;
      })
      .finally(() => {
        sharedHostPromise = null;
      });
  }
  return sharedHostPromise;
}

export function getPeerComputeResidentAuthorityHost() {
  return sharedHost;
}
