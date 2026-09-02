import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_FLAG_ADMITTED,
  SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_PARAMS_BYTES,
  SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_WORKGROUP_SIZE,
  schroederFrozenLevelAssignmentRefreshWgsl
} from '../../../ulg-gpu-abi/src/schroederFrozenLevelAssignmentRefreshWgsl.js';
import {
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_BYTE_LENGTH,
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORDS
} from '../../../ulg-gpu-abi/src/schroederFrozenSpatialKeyChurn.js';
import {
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_FLAG_ADMITTED,
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_PARAMS_BYTES,
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORKGROUP_SIZE,
  schroederFrozenSpatialKeyChurnWgsl
} from '../../../ulg-gpu-abi/src/schroederFrozenSpatialKeyChurnWgsl.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';
import {
  createGpuReadbackTelemetry
} from './sphGpuReadbackTelemetry.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';

export const ULG_SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_SCHEMA =
  'peercompute.ulg.schroeder-frozen-level-assignment-refresh.v1';
export const SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_STATUS_ENCODED =
  'schroeder-frozen-level-assignment-refresh-gpu-encoded';
export const SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_STATUS_SUBMITTED =
  'schroeder-level-assignment-submitted';
export const SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_MODE = Object.freeze({
  FINE_SUBSTEP: 'frozen-fine-substep',
  MACRO_BOUNDARY: 'macro-boundary-full-reclassification',
  POST_CLOSURE: 'post-closure-full-reclassification'
});
export const ULG_SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_TARGET_SCHEMA =
  'peercompute.ulg.schroeder-frozen-spatial-key-churn-target.v0';
export const ULG_SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_COPY_SCHEMA =
  'peercompute.ulg.schroeder-frozen-spatial-key-churn-copy.v0';
export const SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_TARGETS_OPTION =
  'schroederFrozenSpatialKeyChurnTargets';
const SCHROEDER_POST_CLOSURE_TICK_MODE = Object.freeze({
  SAME_LOOKUP_TICK: 'same-lookup-tick',
  NEXT_TICK_SUCCESSOR: 'next-tick-successor'
});

const U32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const ASSIGNMENT_STRIDE_WORDS = SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length;
const STATE_STRIDE_WORDS = SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length;
const THERMO_STRIDE_WORDS = SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length;
const MECHANICS_STRIDE_WORDS =
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length;
const ASSIGNMENT_STRIDE_BYTES = ASSIGNMENT_STRIDE_WORDS * U32_BYTES;
const STATE_STRIDE_BYTES = STATE_STRIDE_WORDS * U32_BYTES;
const THERMO_STRIDE_BYTES = THERMO_STRIDE_WORDS * U32_BYTES;
const MECHANICS_STRIDE_BYTES = MECHANICS_STRIDE_WORDS * U32_BYTES;
const MAX_EXACT_F32_INTEGER = 0x00ff_ffff;
const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};
const FROZEN_REFRESH_PIPELINE_BINDINGS = Object.freeze([
  computeBufferBinding(0, 'read-only-storage'),
  computeBufferBinding(1, 'read-only-storage'),
  computeBufferBinding(2, 'storage'),
  computeBufferBinding(3, 'uniform')
]);
const FROZEN_REFRESH_PIPELINE_DESCRIPTOR = Object.freeze({
  cacheKey: 'ulg-schroeder-frozen-level-assignment-refresh.v1',
  label: 'ulg-schroeder-frozen-level-assignment-refresh',
  code: schroederFrozenLevelAssignmentRefreshWgsl,
  entryPoint: 'main',
  bindings: FROZEN_REFRESH_PIPELINE_BINDINGS
});
const FROZEN_SPATIAL_KEY_CHURN_CLASSIFY_PIPELINE_DESCRIPTOR = Object.freeze({
  cacheKey: 'ulg-schroeder-frozen-spatial-key-churn.v0',
  label: 'ulg-schroeder-frozen-spatial-key-churn-classify',
  code: schroederFrozenSpatialKeyChurnWgsl,
  entryPoint: 'classify',
  bindings: FROZEN_REFRESH_PIPELINE_BINDINGS
});
const FROZEN_SPATIAL_KEY_CHURN_SEAL_PIPELINE_DESCRIPTOR = Object.freeze({
  cacheKey: 'ulg-schroeder-frozen-spatial-key-churn.v0',
  label: 'ulg-schroeder-frozen-spatial-key-churn-seal',
  code: schroederFrozenSpatialKeyChurnWgsl,
  entryPoint: 'seal',
  bindings: FROZEN_REFRESH_PIPELINE_BINDINGS
});
const frozenFineSubstepAuthorityProofs = new WeakMap();
const admittedPostClosureLevelAssignments = new WeakMap();
const frozenSpatialKeyChurnTargetOrigins = new WeakMap();
const frozenSpatialKeyChurnTargetBufferOrigins = new WeakMap();

function refreshError(message, code, ErrorType = Error) {
  const error = new ErrorType(message);
  error.code = code;
  return error;
}

function refreshBackpressureError() {
  return refreshError(
    'all frozen level-assignment refresh arenas are retained or awaiting a queue fence',
    'ERR_SCHROEDER_FROZEN_REFRESH_BACKPRESSURE'
  );
}

function exactU32(value, label, { positive = false } = {}) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < (positive ? 1 : 0)
    || value > 0xffff_ffff
  ) {
    throw refreshError(
      `${label} must be an exact ${positive ? 'positive ' : ''}u32`,
      'ERR_SCHROEDER_FROZEN_REFRESH_IDENTITY',
      RangeError
    );
  }
  return value;
}

function exactI32(value, label) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < -0x8000_0000
    || value > 0x7fff_ffff
  ) {
    throw refreshError(
      `${label} must be an exact i32`,
      'ERR_SCHROEDER_FROZEN_REFRESH_IDENTITY',
      RangeError
    );
  }
  return value;
}

function positiveInteger(value, label, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw refreshError(
      `${label} must be an integer in [1, ${max}]`,
      'ERR_SCHROEDER_FROZEN_REFRESH_LAYOUT',
      RangeError
    );
  }
  return number;
}

function finiteBufferSize(buffer) {
  const size = Number(buffer?.size ?? buffer?.byteLength);
  return Number.isFinite(size) ? size : null;
}

function requireLiveSameDeviceBuffer(buffer, device, label, requiredBytes) {
  if (!buffer || (typeof buffer !== 'object' && typeof buffer !== 'function')) {
    throw refreshError(
      `${label} is required`,
      'ERR_SCHROEDER_FROZEN_REFRESH_SOURCE_BUFFER',
      TypeError
    );
  }
  if (buffer.destroyed === true) {
    throw refreshError(
      `${label} has already been destroyed`,
      'ERR_SCHROEDER_FROZEN_REFRESH_SOURCE_RELEASED'
    );
  }
  if (!webGpuBufferMatchesDevice(buffer, device)) {
    throw refreshError(
      `${label} belongs to another WebGPU device`,
      'ERR_SCHROEDER_FROZEN_REFRESH_DEVICE_MISMATCH'
    );
  }
  const size = finiteBufferSize(buffer);
  if (size != null && size < requiredBytes) {
    throw refreshError(
      `${label} has ${size} bytes; ${requiredBytes} required`,
      'ERR_SCHROEDER_FROZEN_REFRESH_BUFFER_SIZE',
      RangeError
    );
  }
  return buffer;
}

function requireDevice(device) {
  if (
    !device?.createBuffer
    || !device?.createShaderModule
    || !device?.createComputePipeline
    || !device?.createBindGroup
    || !device?.queue?.writeBuffer
    || !device?.queue?.onSubmittedWorkDone
  ) {
    throw new TypeError('frozen level-assignment refresh requires a WebGPU-like device');
  }
}

function requireEncoder(encoder) {
  if (!encoder?.clearBuffer || !encoder?.beginComputePass) {
    throw new TypeError(
      'frozen level-assignment refresh requires a caller-owned GPUCommandEncoder-like object'
    );
  }
}

function checkedByteLength(count, strideBytes, label) {
  const byteLength = count * strideBytes;
  if (!Number.isSafeInteger(byteLength) || byteLength < U32_BYTES) {
    throw refreshError(
      `${label} byte length is not safely addressable`,
      'ERR_SCHROEDER_FROZEN_REFRESH_LAYOUT',
      RangeError
    );
  }
  return byteLength;
}

function validatePriorLevelAssignment(prior, device, maxParticleCount) {
  if (
    prior?.schema !== ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA
    || prior?.status !== SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_STATUS_SUBMITTED
    || prior?.bufferFamilyGenerationStatus
      !== 'schroeder-particle-buffer-family-generation-ready'
  ) {
    throw refreshError(
      'priorLevelAssignment must be an admitted submitted level-assignment execution',
      'ERR_SCHROEDER_FROZEN_REFRESH_SOURCE_CONTRACT',
      TypeError
    );
  }
  if (prior.released === true) {
    throw refreshError(
      'priorLevelAssignment has already been released',
      'ERR_SCHROEDER_FROZEN_REFRESH_SOURCE_RELEASED'
    );
  }
  if (
    prior.assignmentSchema != null
    && prior.assignmentSchema !== ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA
  ) {
    throw refreshError(
      'priorLevelAssignment.assignmentSchema is not the level-assignment v0 ABI',
      'ERR_SCHROEDER_FROZEN_REFRESH_SOURCE_CONTRACT',
      TypeError
    );
  }
  const particleCount = positiveInteger(
    prior.particleCount,
    'priorLevelAssignment.particleCount',
    maxParticleCount
  );
  if (prior.assignmentStrideFloats !== ASSIGNMENT_STRIDE_WORDS) {
    throw refreshError(
      `priorLevelAssignment must use the ${ASSIGNMENT_STRIDE_WORDS}-float assignment row`,
      'ERR_SCHROEDER_FROZEN_REFRESH_LAYOUT',
      RangeError
    );
  }
  const assignmentByteLength = checkedByteLength(
    particleCount,
    ASSIGNMENT_STRIDE_BYTES,
    'assignment'
  );
  if (
    !Number.isInteger(prior.assignmentBufferByteLength)
    || prior.assignmentBufferByteLength < assignmentByteLength
  ) {
    throw refreshError(
      'priorLevelAssignment.assignmentBufferByteLength is incomplete',
      'ERR_SCHROEDER_FROZEN_REFRESH_BUFFER_SIZE',
      RangeError
    );
  }
  requireLiveSameDeviceBuffer(
    prior.assignmentBuffer,
    device,
    'priorLevelAssignment.assignmentBuffer',
    assignmentByteLength
  );
  if (prior.sourceStateBufferBorrowed !== true) {
    throw refreshError(
      'priorLevelAssignment must retain the exact borrowed source-state authority',
      'ERR_SCHROEDER_FROZEN_REFRESH_STATE_PROVENANCE'
    );
  }
  requireLiveSameDeviceBuffer(
    prior.sourceStateBuffer,
    device,
    'priorLevelAssignment.sourceStateBuffer',
    checkedByteLength(particleCount, STATE_STRIDE_BYTES, 'prior state')
  );

  const identity = {
    storageGeneration: exactU32(
      prior.storageGeneration,
      'priorLevelAssignment.storageGeneration',
      { positive: true }
    ),
    physicsTick: exactU32(prior.physicsTick, 'priorLevelAssignment.physicsTick'),
    physicsSubstep: exactU32(prior.physicsSubstep, 'priorLevelAssignment.physicsSubstep'),
    positionEpoch: exactU32(prior.positionEpoch, 'priorLevelAssignment.positionEpoch'),
    topologyEpoch: exactU32(prior.topologyEpoch, 'priorLevelAssignment.topologyEpoch'),
    chartEpoch: exactU32(prior.chartEpoch, 'priorLevelAssignment.chartEpoch'),
    levelEpoch: exactU32(prior.levelEpoch, 'priorLevelAssignment.levelEpoch'),
    supportEpoch: exactU32(prior.supportEpoch, 'priorLevelAssignment.supportEpoch')
  };
  if (
    !Number.isInteger(prior.minLevel)
    || !Number.isInteger(prior.maxLevel)
    || prior.minLevel > prior.maxLevel
    || prior.maxLevel - prior.minLevel + 1 > 64
  ) {
    throw refreshError(
      'priorLevelAssignment level range is invalid',
      'ERR_SCHROEDER_FROZEN_REFRESH_LEVEL_CONTRACT',
      RangeError
    );
  }
  const baseGridSpacingM = Math.fround(Number(prior.baseGridSpacingM));
  const minLevelSpacingM = baseGridSpacingM * (2 ** prior.minLevel);
  const maxLevelSpacingM = baseGridSpacingM * (2 ** prior.maxLevel);
  if (
    !Number.isInteger(prior.chartId)
    || prior.chartId < 0
    || prior.chartId > MAX_EXACT_F32_INTEGER
    || !(baseGridSpacingM > 0)
    || !Number.isFinite(minLevelSpacingM)
    || minLevelSpacingM < 0.000001
    || !Number.isFinite(maxLevelSpacingM)
  ) {
    throw refreshError(
      'priorLevelAssignment chart/base-spacing contract is invalid',
      'ERR_SCHROEDER_FROZEN_REFRESH_LEVEL_CONTRACT',
      RangeError
    );
  }
  return {
    particleCount,
    assignmentByteLength,
    identity,
    queryProfile: Object.freeze({
      chartId: prior.chartId,
      minLevel: prior.minLevel,
      maxLevel: prior.maxLevel,
      baseGridSpacingM
    })
  };
}

function validateCurrentState({
  currentSphParticleUpload,
  device,
  particleCount,
  priorIdentity,
  physicsTick,
  physicsSubstep
}) {
  const current = currentSphParticleUpload;
  if (
    current?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
    || current?.status !== 'webgpu-uploaded'
  ) {
    throw refreshError(
      'currentSphParticleUpload must be a retained SPH WebGPU buffer set',
      'ERR_SCHROEDER_FROZEN_REFRESH_CURRENT_STATE_CONTRACT',
      TypeError
    );
  }
  if (current.particleCount !== particleCount) {
    throw refreshError(
      'current SPH state particle count does not match the frozen assignment',
      'ERR_SCHROEDER_FROZEN_REFRESH_COUNT_MISMATCH',
      RangeError
    );
  }
  if (current.stateStrideBytes !== STATE_STRIDE_BYTES) {
    throw refreshError(
      `current SPH state must use the ${STATE_STRIDE_WORDS}-float state row`,
      'ERR_SCHROEDER_FROZEN_REFRESH_LAYOUT',
      RangeError
    );
  }
  const requiredStateBytes = checkedByteLength(particleCount, STATE_STRIDE_BYTES, 'current state');
  if (
    !Number.isInteger(current.stateBufferByteLength)
    || current.stateBufferByteLength < requiredStateBytes
  ) {
    throw refreshError(
      'currentSphParticleUpload.stateBufferByteLength is incomplete',
      'ERR_SCHROEDER_FROZEN_REFRESH_BUFFER_SIZE',
      RangeError
    );
  }
  requireLiveSameDeviceBuffer(
    current.stateBuffer,
    device,
    'currentSphParticleUpload.stateBuffer',
    requiredStateBytes
  );
  const storageGeneration = exactU32(
    current.storageGeneration ?? current.bufferFamilyGeneration,
    'currentSphParticleUpload.storageGeneration',
    { positive: true }
  );
  if (
    current.bufferFamilyGeneration != null
    && current.bufferFamilyGeneration !== storageGeneration
  ) {
    throw refreshError(
      'current SPH state buffer-family generations disagree',
      'ERR_SCHROEDER_FROZEN_REFRESH_STATE_PROVENANCE'
    );
  }
  if (String(current.bufferFamilyGenerationStatus ?? '').includes('rejected')) {
    throw refreshError(
      'current SPH state publishes a rejected buffer-family generation',
      'ERR_SCHROEDER_FROZEN_REFRESH_STATE_PROVENANCE'
    );
  }
  const targetPhysicsTick = exactU32(physicsTick, 'physicsTick');
  const targetPhysicsSubstep = exactU32(physicsSubstep, 'physicsSubstep');
  const positionEpoch = exactU32(current.positionEpoch, 'currentSphParticleUpload.positionEpoch');
  const topologyEpoch = exactU32(current.topologyEpoch, 'currentSphParticleUpload.topologyEpoch');
  const chartEpoch = exactU32(current.chartEpoch, 'currentSphParticleUpload.chartEpoch');
  if (targetPhysicsTick !== priorIdentity.physicsTick) {
    throw refreshError(
      'frozen level refresh cannot cross a macro physics tick',
      'ERR_SCHROEDER_FROZEN_REFRESH_MACRO_IDENTITY'
    );
  }
  if (
    current.physicsTick != null
    && exactU32(current.physicsTick, 'currentSphParticleUpload.physicsTick')
      !== targetPhysicsTick
  ) {
    throw refreshError(
      'current SPH state physicsTick disagrees with the requested refresh provenance',
      'ERR_SCHROEDER_FROZEN_REFRESH_STATE_PROVENANCE'
    );
  }
  if (
    current.physicsSubstep != null
    && exactU32(current.physicsSubstep, 'currentSphParticleUpload.physicsSubstep')
      !== targetPhysicsSubstep
  ) {
    throw refreshError(
      'current SPH state physicsSubstep disagrees with the requested refresh provenance',
      'ERR_SCHROEDER_FROZEN_REFRESH_STATE_PROVENANCE'
    );
  }
  if (targetPhysicsSubstep <= priorIdentity.physicsSubstep) {
    throw refreshError(
      'physicsSubstep must advance beyond the prior assignment',
      'ERR_SCHROEDER_FROZEN_REFRESH_STALE_POSITION'
    );
  }
  if (positionEpoch <= priorIdentity.positionEpoch) {
    throw refreshError(
      'current state positionEpoch must advance beyond the prior assignment',
      'ERR_SCHROEDER_FROZEN_REFRESH_STALE_POSITION'
    );
  }
  if (
    topologyEpoch !== priorIdentity.topologyEpoch
    || chartEpoch !== priorIdentity.chartEpoch
  ) {
    throw refreshError(
      'frozen level refresh cannot cross topology or chart epochs',
      'ERR_SCHROEDER_FROZEN_REFRESH_MACRO_IDENTITY'
    );
  }
  return {
    storageGeneration,
    physicsTick: targetPhysicsTick,
    physicsSubstep: targetPhysicsSubstep,
    positionEpoch,
    topologyEpoch,
    chartEpoch,
    stateBuffer: current.stateBuffer,
    stateBufferByteLength: requiredStateBytes
  };
}

function validateCurrentMechanics({
  currentMlsMpmParticleUpload,
  device,
  particleCount,
  currentState
}) {
  if (currentMlsMpmParticleUpload == null) return null;
  const current = currentMlsMpmParticleUpload;
  if (
    current?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA
    || current?.status !== 'webgpu-uploaded'
    || current.particleCount !== particleCount
    || current.mechanicsStrideBytes !== MECHANICS_STRIDE_BYTES
  ) {
    throw refreshError(
      'currentMlsMpmParticleUpload must be the matching retained MLS-MPM WebGPU buffer set',
      'ERR_SCHROEDER_FROZEN_REFRESH_CURRENT_MECHANICS_CONTRACT',
      TypeError
    );
  }
  const requiredMechanicsBytes = checkedByteLength(
    particleCount,
    MECHANICS_STRIDE_BYTES,
    'current mechanics'
  );
  if (
    !Number.isInteger(current.mechanicsBufferByteLength)
    || current.mechanicsBufferByteLength < requiredMechanicsBytes
  ) {
    throw refreshError(
      'currentMlsMpmParticleUpload.mechanicsBufferByteLength is incomplete',
      'ERR_SCHROEDER_FROZEN_REFRESH_BUFFER_SIZE',
      RangeError
    );
  }
  requireLiveSameDeviceBuffer(
    current.mechanicsBuffer,
    device,
    'currentMlsMpmParticleUpload.mechanicsBuffer',
    requiredMechanicsBytes
  );
  const storageGeneration = exactU32(
    current.storageGeneration ?? current.bufferFamilyGeneration,
    'currentMlsMpmParticleUpload.storageGeneration',
    { positive: true }
  );
  if (storageGeneration !== currentState.storageGeneration) {
    throw refreshError(
      'current SPH and MLS-MPM uploads do not belong to one buffer-family generation',
      'ERR_SCHROEDER_FROZEN_REFRESH_MECHANICS_PROVENANCE'
    );
  }
  for (const field of [
    'physicsTick',
    'physicsSubstep',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch'
  ]) {
    if (
      exactU32(current[field], `currentMlsMpmParticleUpload.${field}`)
      !== currentState[field]
    ) {
      throw refreshError(
        `current SPH and MLS-MPM uploads disagree on ${field}`,
        'ERR_SCHROEDER_FROZEN_REFRESH_MECHANICS_PROVENANCE'
      );
    }
  }
  return {
    storageGeneration,
    mechanicsBuffer: current.mechanicsBuffer,
    mechanicsBufferByteLength: requiredMechanicsBytes
  };
}

function validateFrozenFineSubstepDescriptorAuthority({
  priorLevelAssignment,
  currentSphParticleUpload,
  currentMlsMpmParticleUpload,
  device,
  particleCount,
  priorIdentity,
  currentState,
  currentMechanics
}) {
  const requiredThermoBytes = checkedByteLength(
    particleCount,
    THERMO_STRIDE_BYTES,
    'current thermo'
  );
  const sourceThermoBuffer = requireLiveSameDeviceBuffer(
    priorLevelAssignment.sourceThermoBuffer,
    device,
    'priorLevelAssignment.sourceThermoBuffer',
    requiredThermoBytes
  );
  if (
    priorLevelAssignment.sourceThermoBufferBorrowed !== true
    || currentSphParticleUpload.thermoBuffer !== sourceThermoBuffer
    || currentSphParticleUpload.thermoStrideBytes !== THERMO_STRIDE_BYTES
    || (
      Number.isInteger(currentSphParticleUpload.thermoBufferByteLength)
      && currentSphParticleUpload.thermoBufferByteLength < requiredThermoBytes
    )
  ) {
    throw refreshError(
      'frozen fine refresh requires the exact unchanged borrowed thermo descriptor source',
      'ERR_SCHROEDER_FROZEN_REFRESH_DESCRIPTOR_AUTHORITY'
    );
  }
  requireLiveSameDeviceBuffer(
    currentSphParticleUpload.thermoBuffer,
    device,
    'currentSphParticleUpload.thermoBuffer',
    requiredThermoBytes
  );
  if (
    currentMechanics == null
    || currentMlsMpmParticleUpload == null
    || priorLevelAssignment.sourceMechanicsBufferBorrowed !== true
    || !priorLevelAssignment.sourceMechanicsBuffer
  ) {
    throw refreshError(
      'frozen fine refresh requires exact prior and current mechanics-generation authority',
      'ERR_SCHROEDER_FROZEN_REFRESH_DESCRIPTOR_AUTHORITY'
    );
  }
  requireLiveSameDeviceBuffer(
    priorLevelAssignment.sourceMechanicsBuffer,
    device,
    'priorLevelAssignment.sourceMechanicsBuffer',
    checkedByteLength(particleCount, MECHANICS_STRIDE_BYTES, 'prior mechanics')
  );
  for (const field of ['levelEpoch', 'supportEpoch']) {
    const sphValue = exactU32(
      currentSphParticleUpload[field],
      `currentSphParticleUpload.${field}`
    );
    const mlsValue = exactU32(
      currentMlsMpmParticleUpload[field],
      `currentMlsMpmParticleUpload.${field}`
    );
    if (sphValue !== priorIdentity[field] || mlsValue !== sphValue) {
      throw refreshError(
        `frozen fine refresh cannot cross ${field}`,
        'ERR_SCHROEDER_FROZEN_REFRESH_DESCRIPTOR_AUTHORITY'
      );
    }
  }
  return {
    sourceThermoBuffer,
    sourceThermoBufferByteLength: requiredThermoBytes,
    currentMechanicsBuffer: currentMechanics.mechanicsBuffer,
    currentMechanicsBufferByteLength: currentMechanics.mechanicsBufferByteLength,
    storageGeneration: currentState.storageGeneration
  };
}

function exactFrozenFineSubstepAuthorityProof(
  proof,
  {
    runtime = null,
    priorLevelAssignment = null,
    currentSphParticleUpload = null,
    currentMlsMpmParticleUpload = null
  } = {}
) {
  const record = frozenFineSubstepAuthorityProofs.get(proof);
  return Boolean(
    record
    && proof?.schema
      === 'peercompute.ulg.schroeder-frozen-fine-substep-authority.v1'
    && proof.status
      === 'schroeder-frozen-fine-substep-authority-ready'
    && Object.isFrozen(proof)
    && (runtime == null || record.runtime === runtime)
    && (
      priorLevelAssignment == null
      || record.priorLevelAssignment === priorLevelAssignment
    )
    && (
      currentSphParticleUpload == null
      || record.currentSphParticleUpload === currentSphParticleUpload
    )
    && (
      currentMlsMpmParticleUpload == null
      || record.currentMlsMpmParticleUpload === currentMlsMpmParticleUpload
    )
    && record.priorLevelAssignment?.assignmentBuffer
      === proof.sourceAssignmentBuffer
    && record.currentSphParticleUpload?.stateBuffer
      === proof.currentStateBuffer
    && record.currentSphParticleUpload?.thermoBuffer
      === proof.frozenThermoBuffer
    && record.currentMlsMpmParticleUpload?.mechanicsBuffer
      === proof.currentMechanicsBuffer
  );
}

export function validateSchroederFrozenFineSubstepAuthorityProof(
  proof,
  expected = {}
) {
  return exactFrozenFineSubstepAuthorityProof(proof, expected);
}

function exactPostClosureLevelAssignmentRecord(
  levelAssignment,
  {
    device = null,
    lookupLevelAssignment = null,
    nextParticleUploads = null
  } = {}
) {
  const record = admittedPostClosureLevelAssignments.get(levelAssignment);
  return record
    && (device == null || record.device === device)
    && (
      lookupLevelAssignment == null
      || record.lookupLevelAssignment === lookupLevelAssignment
    )
    && (
      nextParticleUploads == null
      || record.nextParticleUploads === nextParticleUploads
    )
    ? record
    : null;
}

export function validateSchroederPostClosureLevelAssignment(
  levelAssignment,
  expected = {}
) {
  const record = exactPostClosureLevelAssignmentRecord(
    levelAssignment,
    expected
  );
  if (!record) return false;
  const { nextParticleUploads } = record;
  const sph = nextParticleUploads.sphParticleUpload;
  const mls = nextParticleUploads.mlsMpmParticleUpload;
  return Boolean(
    levelAssignment?.refreshMode
      === SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_MODE.POST_CLOSURE
    && levelAssignment.levelClassificationMode
      === 'post-closure-full-reclassification'
    && levelAssignment.levelReclassificationPerformed === true
    && levelAssignment.postClosureExactDescriptorSource === true
    && levelAssignment.assignmentBuffer === record.assignmentBuffer
    && levelAssignment.sourceStateBuffer === sph.stateBuffer
    && levelAssignment.sourceThermoBuffer === sph.thermoBuffer
    && levelAssignment.sourceMechanicsBuffer === mls.mechanicsBuffer
    && levelAssignment.sourceLookupAssignmentBuffer
      === record.lookupLevelAssignment.assignmentBuffer
    && levelAssignment.postClosureTickMode === record.postClosureTickMode
    && levelAssignment.sourceLookupPhysicsTick
      === record.sourceLookupPhysicsTick
    && levelAssignment.sourceLookupPhysicsSubstep
      === record.sourceLookupPhysicsSubstep
    && levelAssignment.particleCount === sph.particleCount
    && [
      'storageGeneration',
      'physicsTick',
      'physicsSubstep',
      'positionEpoch',
      'topologyEpoch',
      'chartEpoch',
      'levelEpoch',
      'supportEpoch'
    ].every((field) => (
      levelAssignment[field] === sph[field]
      && levelAssignment[field] === mls[field]
    ))
  );
}

function createParamsData(particleCount) {
  return new Uint32Array([
    particleCount,
    ASSIGNMENT_STRIDE_WORDS,
    STATE_STRIDE_WORDS,
    SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_FLAG_ADMITTED
  ]);
}

function createFrozenSpatialKeyChurnParamsData({
  particleCount,
  target,
  priorIdentity,
  currentIdentity,
  queryProfile,
  exactCellAtlas
}) {
  const data = new ArrayBuffer(SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_PARAMS_BYTES);
  const view = new DataView(data);
  const u32 = (word, value) => view.setUint32(word * U32_BYTES, value >>> 0, true);
  const i32 = (word, value) => view.setInt32(word * U32_BYTES, value | 0, true);
  const f32 = (word, value) => view.setFloat32(word * U32_BYTES, value, true);
  u32(0, particleCount);
  u32(1, ASSIGNMENT_STRIDE_WORDS);
  u32(2, STATE_STRIDE_WORDS);
  u32(3, SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_FLAG_ADMITTED);
  u32(4, target.stepOrdinal);
  u32(5, target.fineSubstepOrdinal);
  u32(6, priorIdentity.positionEpoch);
  u32(7, currentIdentity.positionEpoch);
  u32(8, priorIdentity.topologyEpoch);
  u32(9, priorIdentity.chartEpoch);
  u32(10, priorIdentity.levelEpoch);
  u32(11, priorIdentity.supportEpoch);
  u32(12, queryProfile.chartId);
  i32(13, queryProfile.minLevel);
  i32(14, queryProfile.maxLevel);
  f32(15, queryProfile.baseGridSpacingM);
  i32(16, exactCellAtlas.cellMin[0]);
  i32(17, exactCellAtlas.cellMin[1]);
  i32(18, exactCellAtlas.cellMin[2]);
  u32(19, exactCellAtlas.cellCount[0]);
  u32(20, exactCellAtlas.cellCount[1]);
  u32(21, exactCellAtlas.cellCount[2]);
  u32(22, 1);
  u32(23, 0);
  return new Uint32Array(data);
}

function validateFrozenSpatialKeyChurnExactCellAtlas(exactCellAtlas) {
  const cellMin = exactCellAtlas?.cellMin == null
    ? null
    : Array.from(exactCellAtlas.cellMin);
  const cellCount = exactCellAtlas?.cellCount == null
    ? null
    : Array.from(exactCellAtlas.cellCount);
  if (
    !cellMin
    || cellMin.length !== 3
    || !cellCount
    || cellCount.length !== 3
  ) {
    throw refreshError(
      'frozen spatial-key churn requires the canonical exact-cell atlas',
      'ERR_SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_ATLAS',
      TypeError
    );
  }
  const normalized = {
    cellMin: Object.freeze(cellMin.map(
      (value, axis) => exactI32(value, `exactCellAtlas.cellMin[${axis}]`)
    )),
    cellCount: Object.freeze(cellCount.map(
      (value, axis) => exactU32(
        value,
        `exactCellAtlas.cellCount[${axis}]`,
        { positive: true }
      )
    ))
  };
  if (normalized.cellMin.some((minimum, axis) => (
    minimum + normalized.cellCount[axis] - 1 > 0x7fff_ffff
  ))) {
    throw refreshError(
      'frozen spatial-key churn exact-cell atlas exceeds the signed cell domain',
      'ERR_SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_ATLAS',
      RangeError
    );
  }
  return Object.freeze(normalized);
}

function createOwnedBuffer(device, descriptor) {
  return tagWebGpuBufferDevice(device.createBuffer(descriptor), device);
}

/**
 * CPU manufactured-data oracle for the GPU kernel. It preserves every source
 * word, including NaN payloads, except the three position words.
 */
export function refreshSchroederFrozenLevelAssignmentRowsCpuOracle({
  priorAssignments,
  currentState,
  particleCount
} = {}) {
  if (!(priorAssignments instanceof Float32Array) || !(currentState instanceof Float32Array)) {
    throw new TypeError('frozen assignment CPU oracle requires Float32Array inputs');
  }
  const count = positiveInteger(particleCount, 'particleCount');
  if (priorAssignments.length < count * ASSIGNMENT_STRIDE_WORDS) {
    throw new RangeError('priorAssignments is shorter than particleCount');
  }
  if (currentState.length < count * STATE_STRIDE_WORDS) {
    throw new RangeError('currentState is shorter than particleCount');
  }
  const priorWords = new Uint32Array(
    priorAssignments.buffer,
    priorAssignments.byteOffset,
    priorAssignments.length
  );
  const stateWords = new Uint32Array(
    currentState.buffer,
    currentState.byteOffset,
    currentState.length
  );
  const refreshedWords = priorWords.slice(0, count * ASSIGNMENT_STRIDE_WORDS);
  for (let particleIndex = 0; particleIndex < count; particleIndex += 1) {
    const assignmentOffset = particleIndex * ASSIGNMENT_STRIDE_WORDS;
    const stateOffset = particleIndex * STATE_STRIDE_WORDS;
    refreshedWords[assignmentOffset + 12] = stateWords[stateOffset + 0];
    refreshedWords[assignmentOffset + 13] = stateWords[stateOffset + 1];
    refreshedWords[assignmentOffset + 14] = stateWords[stateOffset + 2];
  }
  return new Float32Array(refreshedWords.buffer);
}

/**
 * Reserve one disjoint MAP_READ ring slot for a frozen-refresh churn record.
 * The target is module-branded and single-use; only the refresh runtime can
 * consume it. Its copied bytes remain diagnostic-only until the worker's
 * existing schedule-terminal queue fence has completed.
 */
export function createSchroederFrozenSpatialKeyChurnTarget({
  device,
  scheduleId,
  laneId,
  stateKey,
  recordOrdinal,
  stepOrdinal,
  fineSubstepOrdinal,
  expectedParticleCount,
  targetBuffer,
  targetOffsetBytes
} = {}) {
  requireDevice(device);
  const resolvedRecordOrdinal = positiveInteger(recordOrdinal, 'recordOrdinal');
  const resolvedStepOrdinal = positiveInteger(stepOrdinal, 'stepOrdinal');
  const resolvedFineSubstepOrdinal = positiveInteger(
    fineSubstepOrdinal,
    'fineSubstepOrdinal'
  );
  const resolvedParticleCount = positiveInteger(
    expectedParticleCount,
    'expectedParticleCount'
  );
  const resolvedOffset = Number(targetOffsetBytes);
  const usage = Number(targetBuffer?.usage);
  const mapReadUsage = globalThis.GPUBufferUsage?.MAP_READ ?? 1;
  if (
    typeof scheduleId !== 'string'
    || scheduleId.length === 0
    || typeof laneId !== 'string'
    || laneId.length === 0
    || typeof stateKey !== 'string'
    || stateKey.length === 0
    || !Number.isSafeInteger(resolvedOffset)
    || resolvedOffset < 0
    || resolvedOffset
      !== (resolvedRecordOrdinal - 1)
        * SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_BYTE_LENGTH
    || resolvedOffset % U32_BYTES !== 0
    || !targetBuffer
    || targetBuffer.destroyed === true
    || !webGpuBufferMatchesDevice(targetBuffer, device)
    || targetBuffer.mapState !== 'unmapped'
    || !Number.isSafeInteger(usage)
    || (usage & GPU_BUFFER_USAGE.COPY_DST) !== GPU_BUFFER_USAGE.COPY_DST
    || (usage & mapReadUsage) !== mapReadUsage
    || Number(targetBuffer.size)
      < resolvedOffset + SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_BYTE_LENGTH
  ) {
    throw refreshError(
      'frozen spatial-key churn target requires one exact unmapped MAP_READ ring slot',
      'ERR_SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_TARGET',
      TypeError
    );
  }
  let bufferOrigin = frozenSpatialKeyChurnTargetBufferOrigins.get(targetBuffer);
  if (!bufferOrigin) {
    bufferOrigin = {
      deviceId: webGpuDeviceId(device),
      scheduleId,
      laneId,
      stateKey,
      reservedOffsets: new Set()
    };
    frozenSpatialKeyChurnTargetBufferOrigins.set(targetBuffer, bufferOrigin);
  }
  if (
    bufferOrigin.deviceId !== webGpuDeviceId(device)
    || bufferOrigin.scheduleId !== scheduleId
    || bufferOrigin.laneId !== laneId
    || bufferOrigin.stateKey !== stateKey
    || bufferOrigin.reservedOffsets.has(resolvedOffset)
  ) {
    throw refreshError(
      'frozen spatial-key churn ring identity or slot reservation is stale',
      'ERR_SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_TARGET'
    );
  }
  const target = Object.freeze({
    schema: ULG_SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_TARGET_SCHEMA,
    scheduleId,
    laneId,
    stateKey,
    recordOrdinal: resolvedRecordOrdinal,
    stepOrdinal: resolvedStepOrdinal,
    fineSubstepOrdinal: resolvedFineSubstepOrdinal,
    expectedParticleCount: resolvedParticleCount,
    targetBuffer,
    targetOffsetBytes: resolvedOffset,
    targetByteLength: SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_BYTE_LENGTH
  });
  frozenSpatialKeyChurnTargetOrigins.set(target, {
    target,
    deviceId: webGpuDeviceId(device),
    targetBuffer,
    targetOffsetBytes: resolvedOffset,
    consumed: false
  });
  bufferOrigin.reservedOffsets.add(resolvedOffset);
  return target;
}

function validateFrozenSpatialKeyChurnTarget({
  device,
  target,
  particleCount
}) {
  const origin = frozenSpatialKeyChurnTargetOrigins.get(target);
  if (
    !origin
    || origin.target !== target
    || origin.deviceId !== webGpuDeviceId(device)
    || origin.consumed === true
    || !Object.isFrozen(target)
    || target?.schema !== ULG_SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_TARGET_SCHEMA
    || target.expectedParticleCount !== particleCount
    || target.targetByteLength !== SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_BYTE_LENGTH
    || target.targetBuffer !== origin.targetBuffer
    || target.targetOffsetBytes !== origin.targetOffsetBytes
    || target.targetBuffer?.destroyed === true
    || !webGpuBufferMatchesDevice(target.targetBuffer, device)
    || target.targetBuffer?.mapState !== 'unmapped'
    || Number(target.targetBuffer?.size)
      < target.targetOffsetBytes + target.targetByteLength
  ) {
    throw refreshError(
      'frozen spatial-key churn encode requires one exact live reserved target',
      'ERR_SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_TARGET'
    );
  }
  return origin;
}

/**
 * Admit the output of the full level-assignment kernel at a macro boundary.
 * Fine-substep refresh and macro reclassification are deliberately distinct:
 * the copy kernel is never allowed to masquerade as N+1 classification.
 */
export function admitSchroederMacroBoundaryLevelAssignment({
  device,
  priorLevelAssignment,
  currentSphParticleUpload,
  macroBoundaryLevelAssignment,
  physicsTick = (priorLevelAssignment?.physicsTick ?? 0) + 1,
  physicsSubstep = 0,
  maxParticleCount = priorLevelAssignment?.particleCount
} = {}) {
  const prior = validatePriorLevelAssignment(
    priorLevelAssignment,
    device,
    positiveInteger(maxParticleCount, 'maxParticleCount')
  );
  const targetPhysicsTick = exactU32(physicsTick, 'physicsTick');
  const targetPhysicsSubstep = exactU32(physicsSubstep, 'physicsSubstep');
  if (
    targetPhysicsTick !== prior.identity.physicsTick + 1
    || targetPhysicsSubstep !== 0
  ) {
    throw refreshError(
      'macro-boundary reclassification requires exactly tick N+1/substep 0',
      'ERR_SCHROEDER_FROZEN_REFRESH_MACRO_IDENTITY'
    );
  }
  const current = currentSphParticleUpload;
  if (
    current?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
    || current?.status !== 'webgpu-uploaded'
    || current.particleCount !== prior.particleCount
    || current.stateStrideBytes !== STATE_STRIDE_BYTES
  ) {
    throw refreshError(
      'macro-boundary reclassification requires the exact retained successor SPH family',
      'ERR_SCHROEDER_FROZEN_REFRESH_CURRENT_STATE_CONTRACT',
      TypeError
    );
  }
  const requiredStateBytes = checkedByteLength(
    prior.particleCount,
    STATE_STRIDE_BYTES,
    'macro-boundary state'
  );
  requireLiveSameDeviceBuffer(
    current.stateBuffer,
    device,
    'currentSphParticleUpload.stateBuffer',
    requiredStateBytes
  );
  if (
    !Number.isInteger(current.stateBufferByteLength)
    || current.stateBufferByteLength < requiredStateBytes
  ) {
    throw refreshError(
      'macro-boundary state buffer length is incomplete',
      'ERR_SCHROEDER_FROZEN_REFRESH_BUFFER_SIZE',
      RangeError
    );
  }
  const currentIdentity = {
    storageGeneration: exactU32(
      current.storageGeneration ?? current.bufferFamilyGeneration,
      'currentSphParticleUpload.storageGeneration',
      { positive: true }
    ),
    physicsTick: exactU32(
      current.physicsTick,
      'currentSphParticleUpload.physicsTick'
    ),
    physicsSubstep: exactU32(
      current.physicsSubstep,
      'currentSphParticleUpload.physicsSubstep'
    ),
    positionEpoch: exactU32(
      current.positionEpoch,
      'currentSphParticleUpload.positionEpoch'
    ),
    topologyEpoch: exactU32(
      current.topologyEpoch,
      'currentSphParticleUpload.topologyEpoch'
    ),
    chartEpoch: exactU32(
      current.chartEpoch,
      'currentSphParticleUpload.chartEpoch'
    ),
    levelEpoch: exactU32(
      current.levelEpoch,
      'currentSphParticleUpload.levelEpoch'
    ),
    supportEpoch: exactU32(
      current.supportEpoch,
      'currentSphParticleUpload.supportEpoch'
    )
  };
  if (
    currentIdentity.physicsTick !== targetPhysicsTick
    || currentIdentity.physicsSubstep !== 0
    || currentIdentity.positionEpoch <= prior.identity.positionEpoch
    || currentIdentity.levelEpoch <= prior.identity.levelEpoch
    || currentIdentity.supportEpoch <= prior.identity.supportEpoch
  ) {
    throw refreshError(
      'macro-boundary successor must advance position, level, and support identity at N+1/substep 0',
      'ERR_SCHROEDER_FROZEN_REFRESH_MACRO_IDENTITY'
    );
  }
  const next = validatePriorLevelAssignment(
    macroBoundaryLevelAssignment,
    device,
    positiveInteger(maxParticleCount, 'maxParticleCount')
  );
  if (
    macroBoundaryLevelAssignment === priorLevelAssignment
    || macroBoundaryLevelAssignment.assignmentBuffer
      === priorLevelAssignment.assignmentBuffer
    || macroBoundaryLevelAssignment.sourceStateBuffer !== current.stateBuffer
    || macroBoundaryLevelAssignment.sourceStateBufferBorrowed !== true
    || next.particleCount !== prior.particleCount
    || next.identity.storageGeneration !== currentIdentity.storageGeneration
    || next.identity.physicsTick !== currentIdentity.physicsTick
    || next.identity.physicsSubstep !== currentIdentity.physicsSubstep
    || next.identity.positionEpoch !== currentIdentity.positionEpoch
    || next.identity.topologyEpoch !== currentIdentity.topologyEpoch
    || next.identity.chartEpoch !== currentIdentity.chartEpoch
    || next.identity.levelEpoch !== currentIdentity.levelEpoch
    || next.identity.supportEpoch !== currentIdentity.supportEpoch
  ) {
    throw refreshError(
      'macro-boundary assignment is not the fresh full reclassification of the exact successor family',
      'ERR_SCHROEDER_FROZEN_REFRESH_MACRO_RECLASSIFICATION'
    );
  }
  Object.assign(macroBoundaryLevelAssignment, {
    refreshSchema: ULG_SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_SCHEMA,
    refreshStatus: SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_STATUS_SUBMITTED,
    refreshMode:
      SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_MODE.MACRO_BOUNDARY,
    levelClassificationMode: 'macro-boundary-full-reclassification',
    levelReclassificationPerformed: true,
    sourceAssignmentBuffer: priorLevelAssignment.assignmentBuffer,
    sourceAssignmentStorageGeneration: prior.identity.storageGeneration,
    sourceAssignmentPhysicsSubstep: prior.identity.physicsSubstep,
    sourceAssignmentPositionEpoch: prior.identity.positionEpoch,
    macroPreviousLevelEpoch: prior.identity.levelEpoch,
    macroPreviousSupportEpoch: prior.identity.supportEpoch,
    macroPreviousPhysicsTick: prior.identity.physicsTick,
    fullParticleReadbackPerformed: false
  });
  return macroBoundaryLevelAssignment;
}

/**
 * Admit the one full classifier run over the exact state/thermo/mechanics
 * family produced by thermal -> reaction -> phase transfer. The earlier E*
 * assignment remains the lookup authority for those laws; this output is the
 * only assignment that may describe and publish their final continuation.
 */
export function admitSchroederPostClosureLevelAssignment({
  device,
  lookupLevelAssignment,
  nextParticleUploads,
  postClosureLevelAssignment,
  maxParticleCount = nextParticleUploads?.sphParticleUpload?.particleCount
} = {}) {
  if (!device || (typeof device !== 'object' && typeof device !== 'function')) {
    throw refreshError(
      'post-closure classification admission requires one WebGPU device identity',
      'ERR_SCHROEDER_POST_CLOSURE_ASSIGNMENT_DEVICE',
      TypeError
    );
  }
  const resolvedMaxParticleCount = positiveInteger(
    maxParticleCount,
    'maxParticleCount'
  );
  const lookup = validatePriorLevelAssignment(
    lookupLevelAssignment,
    device,
    resolvedMaxParticleCount
  );
  const sph = nextParticleUploads?.sphParticleUpload ?? null;
  const mls = nextParticleUploads?.mlsMpmParticleUpload ?? null;
  if (
    sph?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
    || sph.status !== 'webgpu-uploaded'
    || mls?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA
    || mls.status !== 'webgpu-uploaded'
    || sph.particleCount !== lookup.particleCount
    || mls.particleCount !== lookup.particleCount
    || sph.stateStrideBytes !== STATE_STRIDE_BYTES
    || sph.thermoStrideBytes !== THERMO_STRIDE_BYTES
    || mls.mechanicsStrideBytes !== MECHANICS_STRIDE_BYTES
  ) {
    throw refreshError(
      'post-closure classification requires one exact retained SPH/MLS-MPM family',
      'ERR_SCHROEDER_POST_CLOSURE_ASSIGNMENT_SOURCE',
      TypeError
    );
  }
  const requiredStateBytes = checkedByteLength(
    lookup.particleCount,
    STATE_STRIDE_BYTES,
    'post-closure state'
  );
  const requiredThermoBytes = checkedByteLength(
    lookup.particleCount,
    THERMO_STRIDE_BYTES,
    'post-closure thermo'
  );
  const requiredMechanicsBytes = checkedByteLength(
    lookup.particleCount,
    MECHANICS_STRIDE_BYTES,
    'post-closure mechanics'
  );
  requireLiveSameDeviceBuffer(
    sph.stateBuffer,
    device,
    'nextParticleUploads.sphParticleUpload.stateBuffer',
    requiredStateBytes
  );
  requireLiveSameDeviceBuffer(
    sph.thermoBuffer,
    device,
    'nextParticleUploads.sphParticleUpload.thermoBuffer',
    requiredThermoBytes
  );
  requireLiveSameDeviceBuffer(
    mls.mechanicsBuffer,
    device,
    'nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer',
    requiredMechanicsBytes
  );
  const currentIdentity = {};
  for (const field of [
    'storageGeneration',
    'physicsTick',
    'physicsSubstep',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch',
    'levelEpoch',
    'supportEpoch'
  ]) {
    const sphValue = exactU32(
      sph[field],
      `nextParticleUploads.sphParticleUpload.${field}`,
      { positive: field === 'storageGeneration' }
    );
    const mlsValue = exactU32(
      mls[field],
      `nextParticleUploads.mlsMpmParticleUpload.${field}`,
      { positive: field === 'storageGeneration' }
    );
    if (sphValue !== mlsValue) {
      throw refreshError(
        `post-closure SPH/MLS-MPM ${field} authority differs`,
        'ERR_SCHROEDER_POST_CLOSURE_ASSIGNMENT_IDENTITY'
      );
    }
    currentIdentity[field] = sphValue;
  }
  const sameLookupTick = (
    currentIdentity.physicsTick === lookup.identity.physicsTick
    && currentIdentity.physicsSubstep === lookup.identity.physicsSubstep
  );
  const nextTickSuccessor = (
    lookup.identity.physicsTick < 0xffff_ffff
    && currentIdentity.physicsTick === lookup.identity.physicsTick + 1
    && currentIdentity.physicsSubstep === 0
  );
  const postClosureTickMode = sameLookupTick
    ? SCHROEDER_POST_CLOSURE_TICK_MODE.SAME_LOOKUP_TICK
    : nextTickSuccessor
      ? SCHROEDER_POST_CLOSURE_TICK_MODE.NEXT_TICK_SUCCESSOR
      : null;
  if (
    postClosureTickMode == null
    || currentIdentity.storageGeneration <= lookup.identity.storageGeneration
    || currentIdentity.positionEpoch < lookup.identity.positionEpoch
    || currentIdentity.topologyEpoch < lookup.identity.topologyEpoch
    || currentIdentity.chartEpoch !== lookup.identity.chartEpoch
    || currentIdentity.levelEpoch <= lookup.identity.levelEpoch
    || currentIdentity.supportEpoch <= lookup.identity.supportEpoch
  ) {
    throw refreshError(
      'post-closure assignment must publish a fresh descriptor generation in the same lookup tick/substep or exactly the next tick at substep zero',
      'ERR_SCHROEDER_POST_CLOSURE_ASSIGNMENT_IDENTITY'
    );
  }
  const classified = validatePriorLevelAssignment(
    postClosureLevelAssignment,
    device,
    resolvedMaxParticleCount
  );
  if (
    postClosureLevelAssignment === lookupLevelAssignment
    || postClosureLevelAssignment.assignmentBuffer
      === lookupLevelAssignment.assignmentBuffer
    || postClosureLevelAssignment.kernelScope
      !== 'schroeder-gpu-level-assignment'
    || postClosureLevelAssignment.fullParticleReadbackPerformed !== false
    || postClosureLevelAssignment.sourceStateBuffer !== sph.stateBuffer
    || postClosureLevelAssignment.sourceStateBufferBorrowed !== true
    || postClosureLevelAssignment.sourceThermoBuffer !== sph.thermoBuffer
    || postClosureLevelAssignment.sourceThermoBufferBorrowed !== true
    || postClosureLevelAssignment.sourceMechanicsBuffer !== mls.mechanicsBuffer
    || postClosureLevelAssignment.sourceMechanicsBufferBorrowed !== true
    || classified.particleCount !== lookup.particleCount
    || Object.entries(currentIdentity).some(
      ([field, value]) => classified.identity[field] !== value
    )
  ) {
    throw refreshError(
      'post-closure assignment is not the fresh full classifier output for the exact continuation family',
      'ERR_SCHROEDER_POST_CLOSURE_ASSIGNMENT_PROVENANCE'
    );
  }
  Object.assign(postClosureLevelAssignment, {
    refreshSchema: ULG_SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_SCHEMA,
    refreshStatus: SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_STATUS_SUBMITTED,
    refreshMode:
      SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_MODE.POST_CLOSURE,
    levelClassificationMode: 'post-closure-full-reclassification',
    levelReclassificationPerformed: true,
    postClosureExactDescriptorSource: true,
    sourceLookupAssignmentBuffer: lookupLevelAssignment.assignmentBuffer,
    sourceLookupStorageGeneration: lookup.identity.storageGeneration,
    sourceLookupTopologyEpoch: lookup.identity.topologyEpoch,
    sourceLookupLevelEpoch: lookup.identity.levelEpoch,
    sourceLookupSupportEpoch: lookup.identity.supportEpoch,
    fullParticleReadbackPerformed: false
  });
  Object.defineProperties(postClosureLevelAssignment, {
    postClosureTickMode: {
      value: postClosureTickMode,
      enumerable: true
    },
    sourceLookupPhysicsTick: {
      value: lookup.identity.physicsTick,
      enumerable: true
    },
    sourceLookupPhysicsSubstep: {
      value: lookup.identity.physicsSubstep,
      enumerable: true
    }
  });
  admittedPostClosureLevelAssignments.set(postClosureLevelAssignment, {
    device,
    lookupLevelAssignment,
    nextParticleUploads,
    assignmentBuffer: postClosureLevelAssignment.assignmentBuffer,
    postClosureTickMode,
    sourceLookupPhysicsTick: lookup.identity.physicsTick,
    sourceLookupPhysicsSubstep: lookup.identity.physicsSubstep
  });
  return postClosureLevelAssignment;
}

export function createSchroederFrozenLevelAssignmentRefreshGpu(device, {
  maxParticleCount,
  arenaCount = 2,
  spatialKeyChurnObservationEnabled = false,
  label = 'ulg-schroeder-frozen-level-assignment-refresh'
} = {}) {
  requireDevice(device);
  if (typeof spatialKeyChurnObservationEnabled !== 'boolean') {
    throw new TypeError('spatialKeyChurnObservationEnabled must be a boolean');
  }
  const resolvedMaxParticleCount = positiveInteger(maxParticleCount, 'maxParticleCount');
  const resolvedArenaCount = positiveInteger(arenaCount, 'arenaCount', 8);
  const outputByteLength = checkedByteLength(
    resolvedMaxParticleCount,
    ASSIGNMENT_STRIDE_BYTES,
    'assignment arena'
  );
  const stateByteLength = checkedByteLength(
    resolvedMaxParticleCount,
    STATE_STRIDE_BYTES,
    'state binding'
  );
  const maxBufferSize = positiveInteger(
    device.limits?.maxBufferSize ?? 256 * 1024 * 1024,
    'device.limits.maxBufferSize'
  );
  const maxStorageBufferBindingSize = positiveInteger(
    device.limits?.maxStorageBufferBindingSize ?? maxBufferSize,
    'device.limits.maxStorageBufferBindingSize'
  );
  const maxWorkgroups = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'device.limits.maxComputeWorkgroupsPerDimension',
    0xffff_ffff
  );
  if ((device.limits?.maxStorageBuffersPerShaderStage ?? 8) < 3) {
    throw new RangeError('frozen level-assignment refresh requires three storage bindings');
  }
  for (const [role, byteLength] of [
    ['assignment arena', outputByteLength],
    ['state binding', stateByteLength]
  ]) {
    if (byteLength > maxBufferSize || byteLength > maxStorageBufferBindingSize) {
      throw new RangeError(`${role} requires ${byteLength} bytes beyond WebGPU limits`);
    }
  }
  const workgroups = Math.ceil(
    resolvedMaxParticleCount / SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_WORKGROUP_SIZE
  );
  if (workgroups > maxWorkgroups) {
    throw new RangeError(
      `frozen level-assignment refresh requires ${workgroups} workgroups beyond the device limit`
    );
  }

  // Program identity is device + stable execution ABI only. Particle count,
  // caller labels, material identity, and scenario configuration size the
  // instance-owned arenas below; none may trigger shader compilation.
  const {
    pipeline,
    bindGroupLayout
  } = createCachedExplicitComputePipeline(
    device,
    FROZEN_REFRESH_PIPELINE_DESCRIPTOR
  );
  const churnClassifyProgram = spatialKeyChurnObservationEnabled
    ? createCachedExplicitComputePipeline(
        device,
        FROZEN_SPATIAL_KEY_CHURN_CLASSIFY_PIPELINE_DESCRIPTOR
      )
    : null;
  const churnSealProgram = spatialKeyChurnObservationEnabled
    ? createCachedExplicitComputePipeline(
        device,
        FROZEN_SPATIAL_KEY_CHURN_SEAL_PIPELINE_DESCRIPTOR
      )
    : null;
  const churnClassifyPipeline = churnClassifyProgram?.pipeline ?? null;
  const churnSealPipeline = churnSealProgram?.pipeline ?? null;
  const churnClassifyBindGroupLayout =
    churnClassifyProgram?.bindGroupLayout ?? null;
  const churnSealBindGroupLayout = churnSealProgram?.bindGroupLayout ?? null;
  const arenas = Array.from({ length: resolvedArenaCount }, (_, arenaIndex) => ({
    arenaIndex,
    generation: 0,
    busy: false,
    retired: false,
    execution: null,
    releasePromise: null,
    destroyedOwnedBuffers: new Set(),
    assignmentBuffer: createOwnedBuffer(device, {
      label: `${label}-assignments-${arenaIndex}`,
      size: outputByteLength,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    }),
    paramsBuffer: createOwnedBuffer(device, {
      label: `${label}-params-${arenaIndex}`,
      size: SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_PARAMS_BYTES,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    }),
    spatialKeyChurnReceiptBuffer: spatialKeyChurnObservationEnabled
      ? createOwnedBuffer(device, {
          label: `${label}-spatial-key-churn-receipt-${arenaIndex}`,
          size: SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_BYTE_LENGTH,
          usage:
            GPU_BUFFER_USAGE.STORAGE
            | GPU_BUFFER_USAGE.COPY_SRC
            | GPU_BUFFER_USAGE.COPY_DST
        })
      : null,
    spatialKeyChurnParamsBuffer: spatialKeyChurnObservationEnabled
      ? createOwnedBuffer(device, {
          label: `${label}-spatial-key-churn-params-${arenaIndex}`,
          size: SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_PARAMS_BYTES,
          usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
        })
      : null
  }));
  const executionRetirements = new WeakMap();
  let destroyed = false;
  let deviceLossObserved = false;

  const arenaOwnedBuffers = (arena) => [
    arena.assignmentBuffer,
    arena.paramsBuffer,
    arena.spatialKeyChurnReceiptBuffer,
    arena.spatialKeyChurnParamsBuffer
  ].filter(Boolean);

  const destroyArenaOwnedBuffers = (arena) => {
    const failures = [];
    for (const buffer of arenaOwnedBuffers(arena)) {
      if (!buffer || arena.destroyedOwnedBuffers.has(buffer)) continue;
      try {
        buffer.destroy?.();
        arena.destroyedOwnedBuffers.add(buffer);
      } catch (error) {
        if (buffer.destroyed === true) {
          arena.destroyedOwnedBuffers.add(buffer);
        } else {
          failures.push(error);
        }
      }
    }
    if (failures.length > 0) {
      throw failures.length === 1
        ? failures[0]
        : new AggregateError(
          failures,
          'frozen level-assignment device-loss arena retirement was incomplete'
        );
    }
    return true;
  };

  const createRetirementRecord = (execution, arena) => {
    let resolveCompletion;
    const completionPromise = new Promise((resolve) => {
      resolveCompletion = resolve;
    });
    const record = {
      execution,
      arena,
      arenaGeneration: arena.generation,
      completed: false,
      completionPromise,
      resolveCompletion,
      activeAttempt: null,
      nextAttemptOrdinal: 0,
      deviceLossEvidence: null
    };
    executionRetirements.set(execution, record);
    return record;
  };

  const retirementRecordFor = (execution) => {
    const record = executionRetirements.get(execution);
    if (
      !record
      || execution?.ownerRuntime !== runtime
      || execution.arenaIndex !== record.arena.arenaIndex
      || execution.arenaGeneration !== record.arenaGeneration
    ) {
      throw refreshError(
        'frozen level-assignment execution is stale or belongs to another runtime',
        'ERR_SCHROEDER_FROZEN_REFRESH_FOREIGN_EXECUTION'
      );
    }
    return record;
  };

  const requireOwnedExecution = (execution) => {
    const arena = arenas[execution?.arenaIndex];
    if (
      !arena
      || arena.execution !== execution
      || execution.ownerRuntime !== runtime
      || execution.arenaGeneration !== arena.generation
    ) {
      throw refreshError(
        'frozen level-assignment execution is stale or belongs to another runtime',
        'ERR_SCHROEDER_FROZEN_REFRESH_FOREIGN_EXECUTION'
      );
    }
    return arena;
  };

  const finishRetirement = (record, { deviceLost = false } = {}) => {
    if (record.completed) return true;
    const { arena, execution } = record;
    if (
      arena.execution !== execution
      || execution.ownerRuntime !== runtime
      || execution.arenaGeneration !== record.arenaGeneration
    ) {
      throw refreshError(
        'frozen refresh arena ownership changed before retirement completed',
        'ERR_SCHROEDER_FROZEN_REFRESH_FOREIGN_EXECUTION'
      );
    }
    if (deviceLost) destroyArenaOwnedBuffers(arena);
    execution.released = true;
    execution.releaseScheduled = false;
    execution.status = deviceLost
      ? 'schroeder-frozen-level-assignment-refresh-device-loss-retired'
      : 'schroeder-frozen-level-assignment-refresh-released';
    execution.refreshStatus = execution.status;
    arena.execution = null;
    arena.busy = false;
    arena.retired = deviceLost === true;
    arena.releasePromise = null;
    record.activeAttempt = null;
    record.completed = true;
    record.resolveCompletion(true);
    return true;
  };

  const runtime = {
    schema: ULG_SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_SCHEMA,
    status: 'schroeder-frozen-level-assignment-refresh-runtime-ready',
    deviceId: webGpuDeviceId(device),
    maxParticleCount: resolvedMaxParticleCount,
    arenaCount: resolvedArenaCount,
    outputByteLength,
    spatialKeyChurnObservationEnabled,
    normalHotLoopReadbackFree: true,

    waitForAvailableArena() {
      if (destroyed) {
        return Promise.reject(refreshError(
          'frozen level-assignment refresh runtime is destroyed',
          'ERR_SCHROEDER_FROZEN_REFRESH_RUNTIME_DESTROYED'
        ));
      }
      if (deviceLossObserved) {
        return Promise.reject(refreshError(
          'frozen level-assignment refresh runtime observed device loss',
          'ERR_SCHROEDER_FROZEN_REFRESH_DEVICE_LOST'
        ));
      }
      if (arenas.some((arena) => !arena.busy && !arena.retired)) {
        return Promise.resolve(true);
      }
      const releasePromises = arenas
        .map((arena) => arena.releasePromise)
        .filter((promise) => promise && typeof promise.then === 'function');
      if (releasePromises.length === 0) {
        return Promise.reject(refreshBackpressureError());
      }
      return Promise.any(releasePromises.map((promise) => (
        Promise.resolve(promise).then((released) => {
          if (released === true) return true;
          throw refreshBackpressureError();
        })
      )));
    },

    proveFineSubstepAuthority({
      priorLevelAssignment,
      currentSphParticleUpload,
      currentMlsMpmParticleUpload,
      physicsTick = priorLevelAssignment?.physicsTick,
      physicsSubstep
    } = {}) {
      if (destroyed) {
        throw refreshError(
          'frozen level-assignment refresh runtime is destroyed',
          'ERR_SCHROEDER_FROZEN_REFRESH_RUNTIME_DESTROYED'
        );
      }
      const prior = validatePriorLevelAssignment(
        priorLevelAssignment,
        device,
        resolvedMaxParticleCount
      );
      const current = validateCurrentState({
        currentSphParticleUpload,
        device,
        particleCount: prior.particleCount,
        priorIdentity: prior.identity,
        physicsTick,
        physicsSubstep
      });
      const currentMechanics = validateCurrentMechanics({
        currentMlsMpmParticleUpload,
        device,
        particleCount: prior.particleCount,
        currentState: current
      });
      const descriptorAuthority =
        validateFrozenFineSubstepDescriptorAuthority({
          priorLevelAssignment,
          currentSphParticleUpload,
          currentMlsMpmParticleUpload,
          device,
          particleCount: prior.particleCount,
          priorIdentity: prior.identity,
          currentState: current,
          currentMechanics
        });
      const proof = Object.freeze({
        schema: 'peercompute.ulg.schroeder-frozen-fine-substep-authority.v1',
        status: 'schroeder-frozen-fine-substep-authority-ready',
        ready: true,
        mode: 'sealed-topology-stable-mechanics-microstep',
        descriptorMutationPolicy:
          'macro-frozen-descriptors-position-only-with-exact-generation-proof',
        sourceAssignmentBuffer: priorLevelAssignment.assignmentBuffer,
        currentStateBuffer: current.stateBuffer,
        frozenThermoBuffer: descriptorAuthority.sourceThermoBuffer,
        currentMechanicsBuffer: descriptorAuthority.currentMechanicsBuffer,
        storageGeneration: current.storageGeneration,
        physicsTick: current.physicsTick,
        physicsSubstep: current.physicsSubstep,
        positionEpoch: current.positionEpoch,
        topologyEpoch: current.topologyEpoch,
        chartEpoch: current.chartEpoch,
        levelEpoch: prior.identity.levelEpoch,
        supportEpoch: prior.identity.supportEpoch
      });
      frozenFineSubstepAuthorityProofs.set(proof, {
        runtime,
        priorLevelAssignment,
        currentSphParticleUpload,
        currentMlsMpmParticleUpload
      });
      return proof;
    },

    async advance({
      refreshMode =
        SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_MODE.FINE_SUBSTEP,
      encoder = null,
      priorLevelAssignment,
      currentSphParticleUpload,
      currentMlsMpmParticleUpload = null,
      frozenFineSubstepAuthorityProof = null,
      spatialKeyChurnObservationTarget = null,
      spatialKeyChurnExactCellAtlas = null,
      physicsTick,
      physicsSubstep,
      macroBoundaryLevelAssignment = null,
      macroBoundaryLevelAssignmentRunner = null,
      macroBoundaryRunnerOptions = {}
    } = {}) {
      if (
        refreshMode
        === SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_MODE.FINE_SUBSTEP
      ) {
        return this.encode(encoder, {
          priorLevelAssignment,
          currentSphParticleUpload,
          currentMlsMpmParticleUpload,
          frozenFineSubstepAuthorityProof,
          spatialKeyChurnObservationTarget,
          spatialKeyChurnExactCellAtlas,
          physicsTick,
          physicsSubstep,
          refreshMode
        });
      }
      if (
        refreshMode
        !== SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_MODE.MACRO_BOUNDARY
      ) {
        throw refreshError(
          `unknown frozen assignment refreshMode ${refreshMode}`,
          'ERR_SCHROEDER_FROZEN_REFRESH_MODE',
          RangeError
        );
      }
      let assignment = macroBoundaryLevelAssignment;
      if (!assignment && typeof macroBoundaryLevelAssignmentRunner === 'function') {
        assignment = await macroBoundaryLevelAssignmentRunner({
          ...macroBoundaryRunnerOptions,
          device,
          priorLevelAssignment,
          currentSphParticleUpload,
          physicsTick,
          physicsSubstep
        });
      }
      if (!assignment) {
        throw refreshError(
          'macro-boundary refresh requires a full level-assignment runner or its exact output',
          'ERR_SCHROEDER_FROZEN_REFRESH_MACRO_RUNNER_REQUIRED',
          TypeError
        );
      }
      return this.admitMacroBoundaryReclassification({
        priorLevelAssignment,
        currentSphParticleUpload,
        macroBoundaryLevelAssignment: assignment,
        physicsTick,
        physicsSubstep
      });
    },

    admitMacroBoundaryReclassification({
      priorLevelAssignment,
      currentSphParticleUpload,
      macroBoundaryLevelAssignment,
      physicsTick,
      physicsSubstep = 0
    } = {}) {
      if (destroyed) {
        throw refreshError(
          'frozen level-assignment refresh runtime is destroyed',
          'ERR_SCHROEDER_FROZEN_REFRESH_RUNTIME_DESTROYED'
        );
      }
      if (deviceLossObserved) {
        throw refreshError(
          'frozen level-assignment refresh runtime observed device loss',
          'ERR_SCHROEDER_FROZEN_REFRESH_DEVICE_LOST'
        );
      }
      return admitSchroederMacroBoundaryLevelAssignment({
        device,
        priorLevelAssignment,
        currentSphParticleUpload,
        macroBoundaryLevelAssignment,
        physicsTick,
        physicsSubstep,
        maxParticleCount: resolvedMaxParticleCount
      });
    },

    encode(encoder, {
      priorLevelAssignment,
      currentSphParticleUpload,
      currentMlsMpmParticleUpload = null,
      frozenFineSubstepAuthorityProof = null,
      spatialKeyChurnObservationTarget = null,
      spatialKeyChurnExactCellAtlas = null,
      physicsTick = priorLevelAssignment?.physicsTick,
      physicsSubstep,
      refreshMode =
        SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_MODE.FINE_SUBSTEP
    } = {}) {
      if (destroyed) {
        throw refreshError(
          'frozen level-assignment refresh runtime is destroyed',
          'ERR_SCHROEDER_FROZEN_REFRESH_RUNTIME_DESTROYED'
        );
      }
      if (deviceLossObserved) {
        throw refreshError(
          'frozen level-assignment refresh runtime observed device loss',
          'ERR_SCHROEDER_FROZEN_REFRESH_DEVICE_LOST'
        );
      }
      if (
        refreshMode
        !== SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_MODE.FINE_SUBSTEP
      ) {
        throw refreshError(
          'encode only admits frozen fine-substep refresh; use advance for macro-boundary full reclassification',
          'ERR_SCHROEDER_FROZEN_REFRESH_MACRO_RUNNER_REQUIRED'
        );
      }
      requireEncoder(encoder);
      const prior = validatePriorLevelAssignment(
        priorLevelAssignment,
        device,
        resolvedMaxParticleCount
      );
      const current = validateCurrentState({
        currentSphParticleUpload,
        device,
        particleCount: prior.particleCount,
        priorIdentity: prior.identity,
        physicsTick,
        physicsSubstep
      });
      const currentMechanics = validateCurrentMechanics({
        currentMlsMpmParticleUpload,
        device,
        particleCount: prior.particleCount,
        currentState: current
      });
      const descriptorAuthority =
        validateFrozenFineSubstepDescriptorAuthority({
          priorLevelAssignment,
          currentSphParticleUpload,
          currentMlsMpmParticleUpload,
          device,
          particleCount: prior.particleCount,
          priorIdentity: prior.identity,
          currentState: current,
          currentMechanics
        });
      if (!exactFrozenFineSubstepAuthorityProof(
        frozenFineSubstepAuthorityProof,
        {
          runtime,
          priorLevelAssignment,
          currentSphParticleUpload,
          currentMlsMpmParticleUpload
        }
      )) {
        throw refreshError(
          'frozen fine refresh requires the exact controller-issued topology/generation proof',
          'ERR_SCHROEDER_FROZEN_REFRESH_AUTHORITY_PROOF'
        );
      }
      if (
        spatialKeyChurnObservationEnabled
          !== (spatialKeyChurnObservationTarget != null)
      ) {
        throw refreshError(
          spatialKeyChurnObservationEnabled
            ? 'diagnostic frozen refresh requires one exact spatial-key churn target'
            : 'production frozen refresh does not admit a spatial-key churn target',
          'ERR_SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_TARGET'
        );
      }
      let spatialKeyChurnTargetOrigin = null;
      let resolvedSpatialKeyChurnExactCellAtlas = null;
      if (spatialKeyChurnObservationTarget != null) {
        if (typeof encoder.copyBufferToBuffer !== 'function') {
          throw refreshError(
            'spatial-key churn observation requires caller-owned copy encoding',
            'ERR_SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_ENCODER',
            TypeError
          );
        }
        spatialKeyChurnTargetOrigin = validateFrozenSpatialKeyChurnTarget({
          device,
          target: spatialKeyChurnObservationTarget,
          particleCount: prior.particleCount
        });
        if (
          spatialKeyChurnObservationTarget.fineSubstepOrdinal
            !== current.physicsSubstep
        ) {
          throw refreshError(
            'spatial-key churn target fine-substep ordinal disagrees with the retained successor identity',
            'ERR_SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_TARGET'
          );
        }
        resolvedSpatialKeyChurnExactCellAtlas =
          validateFrozenSpatialKeyChurnExactCellAtlas(
            spatialKeyChurnExactCellAtlas
          );
      } else if (spatialKeyChurnExactCellAtlas != null) {
        throw refreshError(
          'production frozen refresh does not admit a diagnostic exact-cell atlas',
          'ERR_SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_ATLAS'
        );
      }
      const arena = arenas.find((candidate) => !candidate.busy && !candidate.retired);
      if (!arena) {
        throw refreshBackpressureError();
      }
      arena.busy = true;
      arena.generation += 1;
      try {
        device.queue.writeBuffer(
          arena.paramsBuffer,
          0,
          createParamsData(prior.particleCount)
        );
        if (spatialKeyChurnObservationTarget != null) {
          device.queue.writeBuffer(
            arena.spatialKeyChurnParamsBuffer,
            0,
            createFrozenSpatialKeyChurnParamsData({
              particleCount: prior.particleCount,
              target: spatialKeyChurnObservationTarget,
              priorIdentity: prior.identity,
              currentIdentity: current,
              queryProfile: prior.queryProfile,
              exactCellAtlas: resolvedSpatialKeyChurnExactCellAtlas
            })
          );
        }
        const bindGroup = device.createBindGroup({
          label: `${label}-bind-group-${arena.arenaIndex}-${arena.generation}`,
          layout: bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: priorLevelAssignment.assignmentBuffer } },
            { binding: 1, resource: { buffer: current.stateBuffer } },
            { binding: 2, resource: { buffer: arena.assignmentBuffer } },
            { binding: 3, resource: { buffer: arena.paramsBuffer } }
          ]
        });
        encoder.clearBuffer(arena.assignmentBuffer, 0, prior.assignmentByteLength);
        const pass = encoder.beginComputePass({
          label: `${label}-pass-${arena.arenaIndex}-${arena.generation}`
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(
          prior.particleCount / SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_WORKGROUP_SIZE
        ));
        pass.end();

        let spatialKeyChurnObservationCopy = null;
        if (spatialKeyChurnObservationTarget != null) {
          encoder.clearBuffer(
            arena.spatialKeyChurnReceiptBuffer,
            0,
            SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_BYTE_LENGTH
          );
          const churnClassifyBindGroup = device.createBindGroup({
            label:
              `${label}-spatial-key-churn-classify-bind-group-`
              + `${arena.arenaIndex}-${arena.generation}`,
            layout: churnClassifyBindGroupLayout,
            entries: [
              {
                binding: 0,
                resource: { buffer: priorLevelAssignment.assignmentBuffer }
              },
              {
                binding: 1,
                resource: { buffer: current.stateBuffer }
              },
              {
                binding: 2,
                resource: { buffer: arena.spatialKeyChurnReceiptBuffer }
              },
              {
                binding: 3,
                resource: { buffer: arena.spatialKeyChurnParamsBuffer }
              }
            ]
          });
          const churnSealBindGroup = device.createBindGroup({
            label:
              `${label}-spatial-key-churn-seal-bind-group-`
              + `${arena.arenaIndex}-${arena.generation}`,
            layout: churnSealBindGroupLayout,
            entries: [
              {
                binding: 2,
                resource: { buffer: arena.spatialKeyChurnReceiptBuffer }
              },
              {
                binding: 3,
                resource: { buffer: arena.spatialKeyChurnParamsBuffer }
              }
            ]
          });
          const churnClassifyPass = encoder.beginComputePass({
            label:
              `${label}-spatial-key-churn-classify-pass-`
              + `${arena.arenaIndex}-${arena.generation}`
          });
          churnClassifyPass.setPipeline(churnClassifyPipeline);
          churnClassifyPass.setBindGroup(0, churnClassifyBindGroup);
          churnClassifyPass.dispatchWorkgroups(Math.ceil(
            prior.particleCount
              / SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORKGROUP_SIZE
          ));
          churnClassifyPass.end();
          const churnSealPass = encoder.beginComputePass({
            label:
              `${label}-spatial-key-churn-seal-pass-`
              + `${arena.arenaIndex}-${arena.generation}`
          });
          churnSealPass.setPipeline(churnSealPipeline);
          churnSealPass.setBindGroup(0, churnSealBindGroup);
          churnSealPass.dispatchWorkgroups(1);
          churnSealPass.end();
          encoder.copyBufferToBuffer(
            arena.spatialKeyChurnReceiptBuffer,
            0,
            spatialKeyChurnObservationTarget.targetBuffer,
            spatialKeyChurnObservationTarget.targetOffsetBytes,
            SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_BYTE_LENGTH
          );
          spatialKeyChurnTargetOrigin.consumed = true;
          spatialKeyChurnObservationCopy = Object.freeze({
            schema: ULG_SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_COPY_SCHEMA,
            status: 'frozen-spatial-key-churn-copy-encoded-unverified',
            scheduleId: spatialKeyChurnObservationTarget.scheduleId,
            laneId: spatialKeyChurnObservationTarget.laneId,
            stateKey: spatialKeyChurnObservationTarget.stateKey,
            recordOrdinal: spatialKeyChurnObservationTarget.recordOrdinal,
            stepOrdinal: spatialKeyChurnObservationTarget.stepOrdinal,
            fineSubstepOrdinal:
              spatialKeyChurnObservationTarget.fineSubstepOrdinal,
            expectedParticleCount: prior.particleCount,
            expectedPhysicsSubstep: current.physicsSubstep,
            expectedPriorPositionEpoch: prior.identity.positionEpoch,
            expectedSuccessorPositionEpoch: current.positionEpoch,
            expectedTopologyEpoch: prior.identity.topologyEpoch,
            expectedChartEpoch: prior.identity.chartEpoch,
            expectedLevelEpoch: prior.identity.levelEpoch,
            expectedSupportEpoch: prior.identity.supportEpoch,
            exactCellAtlas: {
              cellMin: [...resolvedSpatialKeyChurnExactCellAtlas.cellMin],
              cellCount: [...resolvedSpatialKeyChurnExactCellAtlas.cellCount]
            },
            targetOffsetBytes:
              spatialKeyChurnObservationTarget.targetOffsetBytes,
            targetByteLength:
              SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_BYTE_LENGTH,
            recordWordLength: SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORDS,
            encodedIntoCallerSubmission: true,
            additionalQueueSubmissionCount: 0,
            fullParticleReadbackPerformed: false
          });
        }

        const execution = {
          ...priorLevelAssignment,
          schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
          assignmentSchema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA,
          status: SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_STATUS_ENCODED,
          refreshSchema: ULG_SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_SCHEMA,
          refreshStatus: SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_STATUS_ENCODED,
          refreshMode,
          backend: 'webgpu',
          kernelScope: 'schroeder-frozen-level-assignment-position-refresh',
          assignmentBuffer: arena.assignmentBuffer,
          assignmentBufferByteLength: prior.assignmentByteLength,
          assignments: new Float32Array(),
          retainedAssignmentBuffer: true,
          sourceStateBuffer: current.stateBuffer,
          sourceStateBufferBorrowed: true,
          sourceThermoBuffer: descriptorAuthority.sourceThermoBuffer,
          sourceThermoBufferBorrowed: true,
          sourceThermoBufferByteLength:
            descriptorAuthority.sourceThermoBufferByteLength,
          sourceMechanicsBuffer: currentMechanics?.mechanicsBuffer ?? null,
          sourceMechanicsBufferBorrowed: currentMechanics != null,
          sourceMechanicsBufferByteLength:
            currentMechanics?.mechanicsBufferByteLength ?? 0,
          sourceMechanicsProvenanceStatus: currentMechanics
            ? 'schroeder-frozen-level-assignment-refresh-current-mechanics-v0j-ready'
            : 'schroeder-frozen-level-assignment-refresh-current-mechanics-v0j-unavailable',
          frozenFineSubstepAuthorityProof,
          frozenFineSubstepAuthorityStatus:
            frozenFineSubstepAuthorityProof.status,
          storageGeneration: current.storageGeneration,
          physicsTick: current.physicsTick,
          physicsSubstep: current.physicsSubstep,
          positionEpoch: current.positionEpoch,
          topologyEpoch: prior.identity.topologyEpoch,
          chartEpoch: prior.identity.chartEpoch,
          levelEpoch: prior.identity.levelEpoch,
          supportEpoch: prior.identity.supportEpoch,
          sourceAssignmentBuffer: priorLevelAssignment.assignmentBuffer,
          sourceAssignmentStorageGeneration: prior.identity.storageGeneration,
          sourceAssignmentPhysicsSubstep: prior.identity.physicsSubstep,
          sourceAssignmentPositionEpoch: prior.identity.positionEpoch,
          macroLevelEpoch: prior.identity.levelEpoch,
          macroSupportEpoch: prior.identity.supportEpoch,
          macroChartEpoch: prior.identity.chartEpoch,
          macroTopologyEpoch: prior.identity.topologyEpoch,
          levelClassificationMode: 'frozen-macro-step-no-reclassification',
          positionAuthority: 'exact-retained-current-substep-state-buffer',
          copiedAssignmentWordsPerParticle: ASSIGNMENT_STRIDE_WORDS - 3,
          refreshedPositionWordsPerParticle: 3,
          levelReclassificationPerformed: false,
          fullReadbackPerformed: false,
          fullParticleReadbackPerformed: false,
          fullParticleReadbackFree: true,
          spatialKeyChurnObservationCopy,
          ...createGpuReadbackTelemetry({
            scope: 'schroeder-frozen-level-assignment-refresh'
          }),
          bufferFamilyGenerationStatus:
            'schroeder-particle-buffer-family-generation-ready',
          bufferFamilyGeneration: Object.freeze({
            schema: 'peercompute.ulg.schroeder-particle-buffer-family-generation.v1',
            status: 'schroeder-particle-buffer-family-generation-ready',
            ready: true,
            storageGeneration: current.storageGeneration,
            particleCount: prior.particleCount
          }),
          bufferOwnership: 'persistent-device-arena',
          arenaIndex: arena.arenaIndex,
          arenaGeneration: arena.generation,
          submitPerformed: false,
          releaseScheduled: false,
          released: false,
          destroyAssignmentBuffer: null,
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        Object.defineProperty(execution, 'ownerRuntime', {
          value: runtime,
          enumerable: false
        });
        arena.execution = execution;
        createRetirementRecord(execution, arena);
        return execution;
      } catch (error) {
        arena.busy = false;
        arena.execution = null;
        throw error;
      }
    },

    ownsExecution(execution) {
      try {
        requireOwnedExecution(execution);
        return true;
      } catch {
        return false;
      }
    },

    markExecutionSubmitted(execution) {
      const arena = requireOwnedExecution(execution);
      if (execution.released || !arena.busy) return false;
      execution.submitPerformed = true;
      execution.status = SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_STATUS_SUBMITTED;
      execution.refreshStatus =
        'schroeder-frozen-level-assignment-refresh-gpu-submitted';
      return true;
    },

    markExecutionSubmissionUncertain(execution) {
      const arena = requireOwnedExecution(execution);
      if (execution.released || !arena.busy) return false;
      // queue.submit already returned but normal acknowledgement failed. Treat
      // the arena as submitted and non-reusable so only a confirmed queue fence
      // (or explicit device-loss recovery) may release it.
      execution.submitPerformed = true;
      execution.status =
        'schroeder-frozen-level-assignment-refresh-submission-uncertain';
      execution.refreshStatus = execution.status;
      return true;
    },

    isExecutionSubmitted(execution) {
      return this.ownsExecution(execution) && execution.submitPerformed === true;
    },

    abandonExecution(execution) {
      const record = retirementRecordFor(execution);
      if (record.completed) return true;
      const arena = requireOwnedExecution(execution);
      if (execution.submitPerformed || execution.releaseScheduled) {
        throw refreshError(
          'submitted frozen refresh executions require releaseAfterQueue',
          'ERR_SCHROEDER_FROZEN_REFRESH_FENCE_REQUIRED'
        );
      }
      const retired = finishRetirement(record);
      execution.status = 'schroeder-frozen-level-assignment-refresh-abandoned';
      execution.refreshStatus = execution.status;
      return retired;
    },

    releaseAfterQueue(execution) {
      const record = retirementRecordFor(execution);
      if (record.completed) return record.completionPromise;
      if (deviceLossObserved) {
        return runtime.quarantineExecutionAfterDeviceLoss(execution);
      }
      const arena = requireOwnedExecution(execution);
      if (!execution.submitPerformed) {
        throw refreshError(
          'frozen refresh execution must be marked submitted before queue-fenced release',
          'ERR_SCHROEDER_FROZEN_REFRESH_NOT_SUBMITTED'
        );
      }
      if (record.activeAttempt) return record.activeAttempt.promise;
      execution.releaseScheduled = true;
      let ownerFence;
      try {
        ownerFence = device.queue.onSubmittedWorkDone();
      } catch (error) {
        execution.releaseScheduled = false;
        throw error;
      }
      if (!ownerFence || typeof ownerFence.then !== 'function') {
        execution.releaseScheduled = false;
        throw refreshError(
          'frozen refresh release requires a queue-fence thenable',
          'ERR_SCHROEDER_FROZEN_REFRESH_FENCE_REQUIRED'
        );
      }
      const attempt = {
        mode: 'queue-fence',
        ordinal: ++record.nextAttemptOrdinal,
        promise: null
      };
      record.activeAttempt = attempt;
      const releaseAttempt = Promise.resolve(ownerFence).then(
        () => {
          if (record.activeAttempt !== attempt) {
            return record.completionPromise;
          }
          return finishRetirement(record);
        },
        (error) => {
          if (record.activeAttempt !== attempt) {
            return record.completionPromise;
          }
          record.activeAttempt = null;
          if (arena.releasePromise === attempt.promise) arena.releasePromise = null;
          execution.releaseScheduled = false;
          execution.status =
            'schroeder-frozen-level-assignment-refresh-release-blocked';
          execution.refreshStatus = execution.status;
          throw error;
        }
      );
      attempt.promise = releaseAttempt;
      arena.releasePromise = releaseAttempt;
      return releaseAttempt;
    },

    releaseQueueOrdered(execution) {
      const record = retirementRecordFor(execution);
      if (record.completed) return true;
      if (deviceLossObserved) {
        throw refreshError(
          'device-lost frozen refresh requires quarantine retirement',
          'ERR_SCHROEDER_FROZEN_REFRESH_DEVICE_LOST'
        );
      }
      const arena = requireOwnedExecution(execution);
      if (!execution.submitPerformed || record.activeAttempt) {
        throw refreshError(
          'queue-ordered frozen refresh release requires one submitted execution with no active retirement',
          'ERR_SCHROEDER_FROZEN_REFRESH_QUEUE_ORDERED_RELEASE_STALE'
        );
      }
      // The exact successor refresh has already been submitted on this
      // device's only queue and is the last consumer of this assignment.
      // Reusing the persistent arena is therefore ordered without observing a
      // host queue-completion fence.
      execution.releaseScheduled = true;
      return finishRetirement(record);
    },

    quarantineExecutionAfterDeviceLoss(execution) {
      const record = retirementRecordFor(execution);
      if (record.completed) return record.completionPromise;
      const arena = requireOwnedExecution(execution);
      if (record.activeAttempt?.mode === 'device-loss') {
        return record.activeAttempt.promise;
      }
      const exactLossEvidence = record.deviceLossEvidence ?? device?.lost;
      if (!exactLossEvidence || typeof exactLossEvidence.then !== 'function') {
        throw refreshError(
          'device-loss quarantine requires the exact GPUDevice.lost promise',
          'ERR_SCHROEDER_FROZEN_REFRESH_DEVICE_LOSS_EVIDENCE',
          TypeError
        );
      }
      if (
        record.deviceLossEvidence != null
        && record.deviceLossEvidence !== exactLossEvidence
      ) {
        throw refreshError(
          'device-loss quarantine evidence changed for the same execution',
          'ERR_SCHROEDER_FROZEN_REFRESH_DEVICE_LOSS_EVIDENCE'
        );
      }
      record.deviceLossEvidence = exactLossEvidence;
      deviceLossObserved = true;
      if (record.activeAttempt) record.activeAttempt.promise.catch(() => {});
      const attempt = {
        mode: 'device-loss',
        ordinal: ++record.nextAttemptOrdinal,
        promise: null
      };
      record.activeAttempt = attempt;
      execution.releaseScheduled = true;
      execution.status =
        'schroeder-frozen-level-assignment-refresh-device-loss-quarantined';
      execution.refreshStatus = execution.status;
      runtime.status =
        'schroeder-frozen-level-assignment-refresh-runtime-device-loss-quarantined';
      const lossAttempt = Promise.resolve(exactLossEvidence).then(
        () => {
          if (record.activeAttempt !== attempt) {
            return record.completionPromise;
          }
          return finishRetirement(record, { deviceLost: true });
        },
        (error) => {
          if (record.activeAttempt !== attempt) {
            return record.completionPromise;
          }
          record.activeAttempt = null;
          if (arena.releasePromise === attempt.promise) arena.releasePromise = null;
          execution.status =
            'schroeder-frozen-level-assignment-refresh-device-loss-retirement-blocked';
          execution.refreshStatus = execution.status;
          throw error;
        }
      ).catch((error) => {
        if (record.activeAttempt === attempt) {
          record.activeAttempt = null;
          if (arena.releasePromise === attempt.promise) arena.releasePromise = null;
          execution.status =
            'schroeder-frozen-level-assignment-refresh-device-loss-retirement-blocked';
          execution.refreshStatus = execution.status;
        }
        throw error;
      });
      attempt.promise = lossAttempt;
      arena.releasePromise = lossAttempt;
      lossAttempt.catch(() => {});
      return lossAttempt;
    },

    executionRetirementCompletionPromise(execution) {
      return retirementRecordFor(execution).completionPromise;
    },

    destroy() {
      if (destroyed) return true;
      if (arenas.some((arena) => arena.busy)) return false;
      for (const arena of arenas) {
        destroyArenaOwnedBuffers(arena);
      }
      destroyed = true;
      this.status = 'schroeder-frozen-level-assignment-refresh-runtime-destroyed';
      return true;
    }
  };
  return runtime;
}
