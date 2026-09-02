import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  deferSubmittedWorkCleanup
} from '../webgpuComputeLayout.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_IDENTITY_UINTS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
} from './sphGpuBuffers.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferDevice
} from './sphGpuDeviceIdentity.js';
import { createGpuReadbackTelemetry } from './sphGpuReadbackTelemetry.js';

export const ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_PLAN_SCHEMA =
  'peercompute.ulg.sph-phase-carrier-one-to-four-plan.v0';
export const ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_EXECUTION_SCHEMA =
  'peercompute.ulg.sph-phase-carrier-one-to-four-execution.v0';
export const ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_COUNT_SUMMARY_SCHEMA =
  'peercompute.ulg.sph-phase-carrier-one-to-four-count-summary.v0';
export const ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_LINEAGE_SCHEMA =
  'peercompute.ulg.sph-phase-carrier-one-to-four-lineage.v0';

const ULG_SPH_PHASE_CARRIER_PLAN_SCHEMA =
  'peercompute.ulg.sph-phase-carrier-plan.v2';
const STABLE_LANE_ADDRESS =
  'phaseLane*phaseLaneStride+lineageIndex';
const PHASE_LANE_COUNT = 4;
const PHASE_COMPANION_RESERVED_STATUS = 254;
const WORKGROUP_SIZE = 64;
export const ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_KERNEL_REVISION =
  'phase-carrier-one-to-four-lane-major-reserved-companions-v0';
export const ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_IDENTITY_CORRESPONDENCE_REVISION =
  'render-domain-u32-duplicated-slot-correspondence-lane-major-v0';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const CALLER_TERMINAL_FENCE_CLEANUP = 'caller-terminal-fence';
const DEFERRED_QUEUE_FENCE_CLEANUP = 'deferred-queue-fence';

const LINEAGE_FIELDS = Object.freeze([
  'storageGeneration',
  'physicsTick',
  'physicsSubstep',
  'positionEpoch',
  'topologyEpoch',
  'chartEpoch',
  'levelEpoch',
  'supportEpoch'
]);

const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

function exactU32(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function exactLineage(upload = null) {
  if (!upload || typeof upload !== 'object') return null;
  const lineage = {};
  for (const field of LINEAGE_FIELDS) {
    if (!exactU32(upload[field])) return null;
    lineage[field] = upload[field];
  }
  if (
    lineage.storageGeneration < 1
    || (
      upload.bufferFamilyGeneration != null
      && upload.bufferFamilyGeneration !== lineage.storageGeneration
    )
  ) return null;
  return lineage;
}

function exactParticleFamilyLineage(sphParticleUpload, mlsMpmParticleUpload) {
  const sph = exactLineage(sphParticleUpload);
  const mechanics = exactLineage(mlsMpmParticleUpload);
  if (!sph || !mechanics) return null;
  return LINEAGE_FIELDS.every((field) => sph[field] === mechanics[field])
    ? sph
    : null;
}

export function deriveSphPhaseCarrierOneToFourLineage(sourceLineage) {
  const source = exactLineage(sourceLineage);
  if (
    !source
    || source.storageGeneration === 0xffff_ffff
    || source.topologyEpoch === 0xffff_ffff
  ) {
    throw new RangeError(
      'Phase-carrier 1-to-4 materialization requires an incrementable exact source lineage'
    );
  }
  const target = Object.freeze({
    ...source,
    storageGeneration: source.storageGeneration + 1,
    topologyEpoch: source.topologyEpoch + 1
  });
  return Object.freeze({
    schema: ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_LINEAGE_SCHEMA,
    status: 'phase-carrier-one-to-four-lineage-ready',
    source: Object.freeze({ ...source }),
    target,
    deltas: Object.freeze({
      storageGeneration: 1,
      physicsTick: 0,
      physicsSubstep: 0,
      positionEpoch: 0,
      topologyEpoch: 1,
      chartEpoch: 0,
      levelEpoch: 0,
      supportEpoch: 0
    })
  });
}

function validateSingleLanePlan(plan, particleCount) {
  const count = Number(particleCount);
  const accepted = Number.isSafeInteger(count)
    && count > 0
    && plan?.schema === ULG_SPH_PHASE_CARRIER_PLAN_SCHEMA
    && plan?.status === 'phase-lane-capacity-ready'
    && Number(plan.lineageCapacity) === count
    && Number(plan.primaryCapacity) === count
    && Number(plan.phaseLaneCount) === 1
    && Number(plan.phaseLaneStride) === count
    && Number(plan.companionStart) === count
    && Number(plan.companionCapacity) === 0
    && Number(plan.particleCapacity) === count
    && plan.stableLaneAddress === STABLE_LANE_ADDRESS
    && plan.phaseCompanionLanesRequired === false;
  if (!accepted) {
    throw new RangeError(
      'Phase-carrier 1-to-4 materialization requires the exact laws-quiescent single-lane plan'
    );
  }
  return count;
}

function phaseCarrierTopologyEquals(left, right) {
  return Boolean(
    left
    && right
    && left.schema === right.schema
    && left.status === right.status
    && Number(left.lineageCapacity) === Number(right.lineageCapacity)
    && Number(left.primaryCapacity) === Number(right.primaryCapacity)
    && Number(left.phaseLaneCount) === Number(right.phaseLaneCount)
    && Number(left.phaseLaneStride) === Number(right.phaseLaneStride)
    && Number(left.companionStart) === Number(right.companionStart)
    && Number(left.companionCapacity) === Number(right.companionCapacity)
    && Number(left.particleCapacity) === Number(right.particleCapacity)
    && left.stableLaneAddress === right.stableLaneAddress
    && (left.phaseCompanionLanesRequired === true)
      === (right.phaseCompanionLanesRequired === true)
  );
}

function terminalPhaseCarrierPlan(sourceParticleCount) {
  const terminalParticleCount = sourceParticleCount * PHASE_LANE_COUNT;
  return Object.freeze({
    schema: ULG_SPH_PHASE_CARRIER_PLAN_SCHEMA,
    status: 'phase-lane-capacity-ready',
    lineageCapacity: sourceParticleCount,
    primaryCapacity: sourceParticleCount,
    phaseLaneCount: PHASE_LANE_COUNT,
    phaseLaneStride: sourceParticleCount,
    companionStart: sourceParticleCount,
    companionCapacity: terminalParticleCount - sourceParticleCount,
    particleCapacity: terminalParticleCount,
    stableLaneAddress: STABLE_LANE_ADDRESS,
    phaseCompanionLanesRequired: true,
    reason: 'static-schedule-law-activation-requires-four-phase-carrier-lanes'
  });
}

export function createSphPhaseCarrierOneToFourMaterializationPlan({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload,
  mlsMpmParticleUpload,
  phaseCarrierPlan = sphParticleUpload?.phaseCarrierPlan
    ?? sphParticleState?.phaseCarrierPlan
    ?? null
} = {}) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError(
      'Phase-carrier 1-to-4 materialization requires a packed SPH particle state'
    );
  }
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError(
      'Phase-carrier 1-to-4 materialization requires a packed MLS-MPM particle state'
    );
  }
  if (
    sphParticleUpload?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
    || sphParticleUpload.status !== 'webgpu-uploaded'
    || sphParticleUpload.destroyed === true
  ) {
    throw new TypeError(
      'Phase-carrier 1-to-4 materialization requires one resident SPH upload descriptor'
    );
  }
  if (
    mlsMpmParticleUpload?.schema
      !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA
    || mlsMpmParticleUpload.status !== 'webgpu-uploaded'
    || mlsMpmParticleUpload.destroyed === true
  ) {
    throw new TypeError(
      'Phase-carrier 1-to-4 materialization requires one resident MLS-MPM upload descriptor'
    );
  }
  const sourceParticleCount = Number(sphParticleUpload?.particleCount);
  if (
    !Number.isSafeInteger(sourceParticleCount)
    || sourceParticleCount <= 0
    || sourceParticleCount !== Number(mlsMpmParticleUpload?.particleCount)
    || sourceParticleCount !== Number(sphParticleState.particleCount)
    || sourceParticleCount !== Number(mlsMpmParticleState.particleCount)
  ) {
    throw new RangeError(
      'Phase-carrier 1-to-4 materialization requires exact matching positive source counts'
    );
  }
  validateSingleLanePlan(phaseCarrierPlan, sourceParticleCount);
  for (const candidate of [
    sphParticleState.phaseCarrierPlan,
    mlsMpmParticleState.phaseCarrierPlan,
    sphParticleUpload.phaseCarrierPlan,
    mlsMpmParticleUpload.phaseCarrierPlan
  ]) {
    if (!phaseCarrierTopologyEquals(phaseCarrierPlan, candidate)) {
      throw new RangeError(
        'Phase-carrier 1-to-4 materialization rejected torn source topology descriptors'
      );
    }
  }
  if (sourceParticleCount > Math.floor(0xffff_ffff / PHASE_LANE_COUNT)) {
    throw new RangeError(
      'Phase-carrier 1-to-4 terminal particle count exceeds the u32 address domain'
    );
  }
  const sourceLineage = exactParticleFamilyLineage(
    sphParticleUpload,
    mlsMpmParticleUpload
  );
  if (!sourceLineage) {
    throw new RangeError(
      'Phase-carrier 1-to-4 materialization requires one exact source particle-family lineage'
    );
  }
  for (const state of [sphParticleState, mlsMpmParticleState]) {
    const stateLineage = exactLineage(state);
    if (
      !stateLineage
      || LINEAGE_FIELDS.some(
        (field) => stateLineage[field] !== sourceLineage[field]
      )
    ) {
      throw new RangeError(
        'Phase-carrier 1-to-4 materialization rejected torn CPU-metadata lineage descriptors'
      );
    }
  }
  const lineage = deriveSphPhaseCarrierOneToFourLineage(sourceLineage);
  const terminalParticleCount = sourceParticleCount * PHASE_LANE_COUNT;
  const companionParticleCount = terminalParticleCount - sourceParticleCount;
  const phaseCarrierPlanOut = terminalPhaseCarrierPlan(sourceParticleCount);
  const countSummary = Object.freeze({
    schema: ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_COUNT_SUMMARY_SCHEMA,
    status: 'phase-carrier-one-to-four-counts-exact',
    sourceParticleCount,
    terminalParticleCount,
    companionParticleCount,
    sourceToTerminalRatio: PHASE_LANE_COUNT,
    sourceLineageCount: sourceParticleCount,
    terminalLineageCount: sourceParticleCount,
    phaseLaneCount: PHASE_LANE_COUNT,
    phaseLaneStride: sourceParticleCount,
    stableLaneAddress: STABLE_LANE_ADDRESS,
    terminalIndexFromSource:
      'phaseLane*sourceParticleCount+sourceParticleIndex',
    sourceIndexFromTerminal:
      'terminalParticleIndex%sourceParticleCount',
    phaseLaneFromTerminal:
      'floor(terminalParticleIndex/sourceParticleCount)',
    exactCountAuthority: true
  });
  const bytesPerFloat = Float32Array.BYTES_PER_ELEMENT;
  const bytesPerUint = Uint32Array.BYTES_PER_ELEMENT;
  const sourceStateBufferByteLength =
    sourceParticleCount * SPH_GPU_PARTICLE_STATE_FLOATS * bytesPerFloat;
  const sourceThermoBufferByteLength =
    sourceParticleCount * SPH_GPU_PARTICLE_THERMO_FLOATS * bytesPerFloat;
  const sourceMechanicsBufferByteLength =
    sourceParticleCount
      * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
      * bytesPerFloat;
  const sourceIdentityBufferByteLength =
    sourceParticleCount * SPH_GPU_PARTICLE_IDENTITY_UINTS * bytesPerUint;
  if (
    sphParticleUpload.stateBufferByteLength !== sourceStateBufferByteLength
    || sphParticleUpload.thermoBufferByteLength
      !== sourceThermoBufferByteLength
    || mlsMpmParticleUpload.mechanicsBufferByteLength
      !== sourceMechanicsBufferByteLength
    || sphParticleUpload.identityBufferByteLength
      !== sourceIdentityBufferByteLength
  ) {
    throw new RangeError(
      'Phase-carrier 1-to-4 materialization rejected torn source byte-length descriptors'
    );
  }
  const sourceIdentityRevision = String(
    sphParticleUpload.identityRevision ?? ''
  ).trim();
  if (
    sphParticleUpload.identitySchema
      !== ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
    || sphParticleUpload.identityStrideBytes
      !== SPH_GPU_PARTICLE_IDENTITY_UINTS * bytesPerUint
    || !sourceIdentityRevision
  ) {
    throw new RangeError(
      'Phase-carrier 1-to-4 materialization requires exact identity schema, stride, and revision authority'
    );
  }
  return Object.freeze({
    schema: ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_PLAN_SCHEMA,
    status: 'phase-carrier-one-to-four-plan-ready',
    sourceParticleCount,
    terminalParticleCount,
    companionParticleCount,
    phaseLaneCount: PHASE_LANE_COUNT,
    phaseLaneStride: sourceParticleCount,
    reservedCompanionStatus: PHASE_COMPANION_RESERVED_STATUS,
    stableLaneAddress: STABLE_LANE_ADDRESS,
    sourcePhaseCarrierPlan: Object.freeze({ ...phaseCarrierPlan }),
    phaseCarrierPlan: phaseCarrierPlanOut,
    countSummary,
    lineage,
    sourceStateBufferByteLength,
    sourceThermoBufferByteLength,
    sourceMechanicsBufferByteLength,
    sourceIdentityBufferByteLength,
    stateBufferByteLength:
      terminalParticleCount * SPH_GPU_PARTICLE_STATE_FLOATS * bytesPerFloat,
    thermoBufferByteLength:
      terminalParticleCount * SPH_GPU_PARTICLE_THERMO_FLOATS * bytesPerFloat,
    mechanicsBufferByteLength:
      terminalParticleCount
        * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
        * bytesPerFloat,
    identityBufferByteLength:
      terminalParticleCount * SPH_GPU_PARTICLE_IDENTITY_UINTS * bytesPerUint,
    publicationFamilies: Object.freeze([
      'state',
      'thermo',
      'mechanics',
      'identity'
    ]),
    identityCorrespondence:
      'duplicate-source-render-domain-identity-across-four-fixed-phase-lanes',
    identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
    identityStrideBytes:
      SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
    sourceIdentityRevision,
    materializationKernelRevision:
      ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_KERNEL_REVISION,
    identityCorrespondenceRevision:
      ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_IDENTITY_CORRESPONDENCE_REVISION,
    cardinalityChanged: true,
    routingAuthority: false,
    dynamicLawRoutingAuthority: false,
    fullParticleReadbackRequired: false
  });
}

function requireSourceBuffer({
  buffer,
  name,
  device,
  byteLength
}) {
  if (!buffer || webGpuBufferDevice(buffer) !== device) {
    throw new TypeError(
      `Phase-carrier 1-to-4 ${name} must belong to the runtime device`
    );
  }
  if (
    !Number.isSafeInteger(Number(buffer.size))
    || Number(buffer.size) < byteLength
  ) {
    throw new RangeError(
      `Phase-carrier 1-to-4 ${name} is smaller than its exact source count`
    );
  }
  const usage = Number(buffer.usage);
  if (
    !Number.isSafeInteger(usage)
    || (usage & GPU_BUFFER_USAGE.STORAGE) !== GPU_BUFFER_USAGE.STORAGE
  ) {
    throw new RangeError(
      `Phase-carrier 1-to-4 ${name} lacks GPUBufferUsage.STORAGE`
    );
  }
}

function createOutputBuffer(device, label, byteLength) {
  return tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: Math.max(4, byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  }), device);
}

function createParamsArray(plan) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint32(0, plan.sourceParticleCount, true);
  view.setUint32(4, plan.terminalParticleCount, true);
  view.setUint32(8, plan.phaseLaneCount, true);
  view.setUint32(12, PHASE_COMPANION_RESERVED_STATUS, true);
  return buffer;
}

function exactPositiveDeviceLimit(device, name) {
  const value = Number(device?.limits?.[name]);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(
      `Phase-carrier 1-to-4 materialization requires exact ${name} device authority`
    );
  }
  return value;
}

function validateMaterializationDeviceLimits(device, plan) {
  const maxStorageBuffersPerShaderStage = exactPositiveDeviceLimit(
    device,
    'maxStorageBuffersPerShaderStage'
  );
  const maxBufferSize = exactPositiveDeviceLimit(device, 'maxBufferSize');
  const maxStorageBufferBindingSize = exactPositiveDeviceLimit(
    device,
    'maxStorageBufferBindingSize'
  );
  const maxComputeWorkgroupsPerDimension = exactPositiveDeviceLimit(
    device,
    'maxComputeWorkgroupsPerDimension'
  );
  if (maxStorageBuffersPerShaderStage < 8) {
    throw new RangeError(
      'Phase-carrier 1-to-4 materialization requires eight storage buffers per shader stage'
    );
  }
  const storageByteLengths = [
    plan.sourceStateBufferByteLength,
    plan.sourceThermoBufferByteLength,
    plan.sourceMechanicsBufferByteLength,
    plan.sourceIdentityBufferByteLength,
    plan.stateBufferByteLength,
    plan.thermoBufferByteLength,
    plan.mechanicsBufferByteLength,
    plan.identityBufferByteLength
  ];
  if (storageByteLengths.some(
    (byteLength) => byteLength > maxBufferSize
      || byteLength > maxStorageBufferBindingSize
  )) {
    throw new RangeError(
      'Phase-carrier 1-to-4 materialization exceeds the exact buffer or storage-binding device limit'
    );
  }
  const dispatchWorkgroupCount = Math.ceil(
    plan.terminalParticleCount / WORKGROUP_SIZE
  );
  if (dispatchWorkgroupCount > maxComputeWorkgroupsPerDimension) {
    throw new RangeError(
      'Phase-carrier 1-to-4 materialization exceeds the exact compute-dispatch device limit'
    );
  }
  return Object.freeze({
    maxStorageBuffersPerShaderStage,
    maxBufferSize,
    maxStorageBufferBindingSize,
    maxComputeWorkgroupsPerDimension,
    dispatchWorkgroupCount
  });
}

export const sphPhaseCarrierOneToFourMaterializationWgsl = /* wgsl */ `
struct PhaseCarrierOneToFourParams {
  source_particle_count: u32,
  terminal_particle_count: u32,
  phase_lane_count: u32,
  reserved_status: u32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> source_identity: array<u32>;
@group(0) @binding(4) var<storage, read_write> out_state: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> out_thermo: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> out_mechanics: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> out_identity: array<u32>;
@group(0) @binding(8) var<uniform> params: PhaseCarrierOneToFourParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let terminal_index = global_id.x;
  if (terminal_index >= params.terminal_particle_count) { return; }
  let source_index = terminal_index % params.source_particle_count;
  let phase_lane = terminal_index / params.source_particle_count;
  if (phase_lane >= params.phase_lane_count) { return; }

  let source_state_base = source_index * 2u;
  let target_state_base = terminal_index * 2u;
  let source_thermo_base = source_index * 3u;
  let target_thermo_base = terminal_index * 3u;
  let source_mechanics_base = source_index * 8u;
  let target_mechanics_base = terminal_index * 8u;

  out_identity[terminal_index] = source_identity[source_index];
  if (phase_lane == 0u) {
    out_state[target_state_base] = source_state[source_state_base];
    out_state[target_state_base + 1u] = source_state[source_state_base + 1u];
    out_thermo[target_thermo_base] = source_thermo[source_thermo_base];
    out_thermo[target_thermo_base + 1u] = source_thermo[source_thermo_base + 1u];
    out_thermo[target_thermo_base + 2u] = source_thermo[source_thermo_base + 2u];
    for (var row = 0u; row < 8u; row = row + 1u) {
      out_mechanics[target_mechanics_base + row] =
        source_mechanics[source_mechanics_base + row];
    }
    return;
  }

  let source_position_mass = source_state[source_state_base];
  let source_velocity_energy = source_state[source_state_base + 1u];
  let source_thermo2 = source_thermo[source_thermo_base + 2u];
  out_state[target_state_base] = vec4<f32>(source_position_mass.xyz, 0.0);
  out_state[target_state_base + 1u] = vec4<f32>(
    0.0,
    0.0,
    0.0,
    source_velocity_energy.w
  );
  out_thermo[target_thermo_base] = source_thermo[source_thermo_base];
  out_thermo[target_thermo_base + 1u] = source_thermo[source_thermo_base + 1u];
  out_thermo[target_thermo_base + 2u] = vec4<f32>(
    source_thermo2.x,
    0.0,
    f32(params.reserved_status),
    0.0
  );
  for (var row = 0u; row < 8u; row = row + 1u) {
    out_mechanics[target_mechanics_base + row] =
      source_mechanics[source_mechanics_base + row];
  }
  out_mechanics[target_mechanics_base + 4u].w = 0.0;
  out_mechanics[target_mechanics_base + 5u].y = f32(params.reserved_status);
  out_mechanics[target_mechanics_base + 6u].w = f32(params.reserved_status);
  out_mechanics[target_mechanics_base + 7u].w = 0.0;
}
`;

function derivedIdentityRevision(sourceRevision, plan) {
  const prefix = String(sourceRevision ?? 'identity-revision-unset').trim()
    || 'identity-revision-unset';
  return `${prefix}:phase-carrier-1-to-4:${plan.sourceParticleCount}->${
    plan.terminalParticleCount
  }:sg${plan.lineage.target.storageGeneration}:te${
    plan.lineage.target.topologyEpoch
  }`;
}

function materializedDescriptors({
  plan,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload,
  mlsMpmParticleUpload,
  stateBuffer,
  thermoBuffer,
  mechanicsBuffer,
  identityBuffer
}) {
  const target = plan.lineage.target;
  const identityRevision = derivedIdentityRevision(
    sphParticleUpload.identityRevision ?? sphParticleState.identityRevision,
    plan
  );
  const lineageWords = Object.fromEntries(
    LINEAGE_FIELDS.map((field) => [field, target[field]])
  );
  const nextSphParticleUpload = {
    ...sphParticleUpload,
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    destroyed: false,
    particleCount: plan.terminalParticleCount,
    ...lineageWords,
    bufferFamilyGeneration: target.storageGeneration,
    stateBuffer,
    thermoBuffer,
    identityBuffer,
    stateBufferByteLength: plan.stateBufferByteLength,
    thermoBufferByteLength: plan.thermoBufferByteLength,
    identityBufferByteLength: plan.identityBufferByteLength,
    identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
    identityStrideBytes:
      SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
    identityRequired: true,
    identityRevision,
    identityOwnership: 'owned-phase-carrier-one-to-four-materialization',
    renderDomainKeys: { ...(sphParticleUpload.renderDomainKeys || {}) },
    phaseCarrierPlan: { ...plan.phaseCarrierPlan },
    activeGridDispatchPlanHint: null,
    ownsStateBuffer: true,
    ownsThermoBuffer: true,
    ownsIdentityBuffer: true,
    ownsMaterialPropertyBankWarmInputBuffer: false,
    ownsMaterialPropertyBankParticleSizeBuffer: false
  };
  const nextMlsMpmParticleUpload = {
    ...mlsMpmParticleUpload,
    schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    destroyed: false,
    particleCount: plan.terminalParticleCount,
    ...lineageWords,
    bufferFamilyGeneration: target.storageGeneration,
    mechanicsBuffer,
    mechanicsBufferByteLength: plan.mechanicsBufferByteLength,
    phaseCarrierPlan: { ...plan.phaseCarrierPlan },
    activeGridDispatchPlanHint: null,
    ownsMechanicsBuffer: true,
    ownsMaterialPropertyBankWarmInputBuffer: false,
    ownsMaterialPropertyBankParticleSizeBuffer: false
  };
  const nextSphParticleState = {
    ...sphParticleState,
    status: 'gpu-resident-unread-ready',
    particleCount: plan.terminalParticleCount,
    ...lineageWords,
    step: target.physicsTick,
    phaseCarrierPlan: { ...plan.phaseCarrierPlan },
    identityRevision,
    cpuStateStale: true,
    cpuIdentityStale: true,
    residentActiveGridDispatchHint: null,
    residentActiveGridDispatchPlanHint: null
  };
  const nextMlsMpmParticleState = {
    ...mlsMpmParticleState,
    status: 'gpu-resident-unread-ready',
    particleCount: plan.terminalParticleCount,
    ...lineageWords,
    step: target.physicsTick,
    phaseCarrierPlan: { ...plan.phaseCarrierPlan },
    cpuStateStale: true
  };
  return {
    identityRevision,
    nextSphParticleUpload,
    nextMlsMpmParticleUpload,
    nextSphParticleState,
    nextMlsMpmParticleState
  };
}

export function sphPhaseCarrierOneToFourPipelineDescriptor() {
  return Object.freeze({
    cacheKey: 'ulg-sph-phase-carrier-one-to-four.v0',
    label: 'ulg-sph-phase-carrier-one-to-four',
    code: sphPhaseCarrierOneToFourMaterializationWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'storage'),
      computeBufferBinding(6, 'storage'),
      computeBufferBinding(7, 'storage'),
      computeBufferBinding(8, 'uniform')
    ]
  });
}

export function enumerateSphPhaseCarrierOneToFourPrewarmPipelineDescriptors() {
  return [sphPhaseCarrierOneToFourPipelineDescriptor()];
}

export function createSphPhaseCarrierOneToFourMaterializationWebGpuEncoderStage({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload,
  mlsMpmParticleUpload,
  phaseCarrierPlan = sphParticleUpload?.phaseCarrierPlan
    ?? sphParticleState?.phaseCarrierPlan
    ?? null
} = {}) {
  if (
    !device?.createBuffer
    || !device?.createBindGroup
    || !device?.createCommandEncoder
    || !device.queue?.writeBuffer
  ) {
    throw new TypeError(
      'Phase-carrier 1-to-4 materialization requires a WebGPU-like device'
    );
  }
  const plan = createSphPhaseCarrierOneToFourMaterializationPlan({
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    phaseCarrierPlan
  });
  const deviceLimits = validateMaterializationDeviceLimits(device, plan);
  for (const requirement of [
    {
      buffer: sphParticleUpload?.stateBuffer,
      name: 'sourceStateBuffer',
      byteLength: plan.sourceStateBufferByteLength
    },
    {
      buffer: sphParticleUpload?.thermoBuffer,
      name: 'sourceThermoBuffer',
      byteLength: plan.sourceThermoBufferByteLength
    },
    {
      buffer: mlsMpmParticleUpload?.mechanicsBuffer,
      name: 'sourceMechanicsBuffer',
      byteLength: plan.sourceMechanicsBufferByteLength
    },
    {
      buffer: sphParticleUpload?.identityBuffer,
      name: 'sourceIdentityBuffer',
      byteLength: plan.sourceIdentityBufferByteLength
    }
  ]) {
    requireSourceBuffer({ ...requirement, device });
  }
  if (new Set([
    sphParticleUpload.stateBuffer,
    sphParticleUpload.thermoBuffer,
    mlsMpmParticleUpload.mechanicsBuffer,
    sphParticleUpload.identityBuffer
  ]).size !== 4) {
    throw new RangeError(
      'Phase-carrier 1-to-4 materialization requires one exact four-buffer source family'
    );
  }

  const allocated = [];
  const destroyAllocated = () => {
    let firstError = null;
    for (const buffer of allocated.splice(0)) {
      try { buffer.destroy?.(); } catch (error) { firstError ??= error; }
    }
    if (firstError) throw firstError;
  };
  try {
    const stateBuffer = createOutputBuffer(
      device,
      'ulg-sph-phase-carrier-one-to-four-state',
      plan.stateBufferByteLength
    );
    allocated.push(stateBuffer);
    const thermoBuffer = createOutputBuffer(
      device,
      'ulg-sph-phase-carrier-one-to-four-thermo',
      plan.thermoBufferByteLength
    );
    allocated.push(thermoBuffer);
    const mechanicsBuffer = createOutputBuffer(
      device,
      'ulg-sph-phase-carrier-one-to-four-mechanics',
      plan.mechanicsBufferByteLength
    );
    allocated.push(mechanicsBuffer);
    const identityBuffer = createOutputBuffer(
      device,
      'ulg-sph-phase-carrier-one-to-four-identity',
      plan.identityBufferByteLength
    );
    allocated.push(identityBuffer);
    const paramsBuffer = tagWebGpuBufferDevice(device.createBuffer({
      label: 'ulg-sph-phase-carrier-one-to-four-params',
      size: 16,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    }), device);
    allocated.push(paramsBuffer);
    device.queue.writeBuffer(paramsBuffer, 0, createParamsArray(plan));

    const pipeline = createCachedExplicitComputePipeline(
      device,
      sphPhaseCarrierOneToFourPipelineDescriptor()
    );
    const bindGroup = device.createBindGroup({
      layout: pipeline.bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: sphParticleUpload.stateBuffer,
            size: plan.sourceStateBufferByteLength
          }
        },
        {
          binding: 1,
          resource: {
            buffer: sphParticleUpload.thermoBuffer,
            size: plan.sourceThermoBufferByteLength
          }
        },
        {
          binding: 2,
          resource: {
            buffer: mlsMpmParticleUpload.mechanicsBuffer,
            size: plan.sourceMechanicsBufferByteLength
          }
        },
        {
          binding: 3,
          resource: {
            buffer: sphParticleUpload.identityBuffer,
            size: plan.sourceIdentityBufferByteLength
          }
        },
        { binding: 4, resource: { buffer: stateBuffer, size: plan.stateBufferByteLength } },
        { binding: 5, resource: { buffer: thermoBuffer, size: plan.thermoBufferByteLength } },
        { binding: 6, resource: { buffer: mechanicsBuffer, size: plan.mechanicsBufferByteLength } },
        { binding: 7, resource: { buffer: identityBuffer, size: plan.identityBufferByteLength } },
        { binding: 8, resource: { buffer: paramsBuffer, size: 16 } }
      ]
    });
    const descriptors = materializedDescriptors({
      plan,
      sphParticleState,
      mlsMpmParticleState,
      sphParticleUpload,
      mlsMpmParticleUpload,
      stateBuffer,
      thermoBuffer,
      mechanicsBuffer,
      identityBuffer
    });
    let submittedCleanupCompleted = false;
    let outputCleanupCompleted = false;
    const cleanupSubmittedWork = () => {
      if (submittedCleanupCompleted) return true;
      paramsBuffer.destroy?.();
      const index = allocated.indexOf(paramsBuffer);
      if (index >= 0) allocated.splice(index, 1);
      submittedCleanupCompleted = true;
      return true;
    };
    const cleanupRetainedOutput = () => {
      if (outputCleanupCompleted) return true;
      for (const buffer of [
        stateBuffer,
        thermoBuffer,
        mechanicsBuffer,
        identityBuffer
      ]) {
        buffer.destroy?.();
        const index = allocated.indexOf(buffer);
        if (index >= 0) allocated.splice(index, 1);
      }
      outputCleanupCompleted = true;
      return true;
    };
    const result = {
      ...plan,
      schema: ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_EXECUTION_SCHEMA,
      status: 'phase-carrier-one-to-four-materialization-ready-to-submit',
      backend: 'webgpu',
      planSchema: plan.schema,
      pipelineCacheStatus: pipeline.cacheStatus,
      stateBuffer,
      thermoBuffer,
      mechanicsBuffer,
      identityBuffer,
      ...descriptors,
      nextParticleUploads: Object.freeze({
        sphParticleUpload: descriptors.nextSphParticleUpload,
        mlsMpmParticleUpload: descriptors.nextMlsMpmParticleUpload
      }),
      readbackMode: NO_FULL_READBACK_MODE,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'sph-phase-carrier-one-to-four-materialization',
        mapAsyncCount: 0,
        readbackBytes: 0,
        hostQueueFenceCount: 0
      }),
      commandSubmissionCount: 0,
      validationErrorScopeCount: 0,
      validationErrorScopeStatus: 'not-observed',
      validationErrorObserved: false,
      validationErrorMessage: null,
      routingAuthority: false,
      dynamicLawRoutingAuthority: false,
      deviceLimits,
      publicationComplete: true,
      publicationFamilies: [...plan.publicationFamilies],
      destroyOutputParticleBuffers: cleanupRetainedOutput
    };
    return {
      schema:
        'peercompute.ulg.sph-phase-carrier-one-to-four-encoder-stage.v0',
      status: 'phase-carrier-one-to-four-encoder-stage-ready',
      plan,
      result,
      stateBuffer,
      thermoBuffer,
      mechanicsBuffer,
      identityBuffer,
      encode(encoder) {
        const pass = encoder.beginComputePass({
          label: 'ulg-sph-phase-carrier-one-to-four'
        });
        pass.setPipeline(pipeline.pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(deviceLimits.dispatchWorkgroupCount);
        pass.end();
      },
      cleanupSubmittedWork,
      cleanupRetainedOutput,
      cleanupConstructionFailure: destroyAllocated
    };
  } catch (error) {
    try { destroyAllocated(); } catch {}
    throw error;
  }
}

export async function runSphPhaseCarrierOneToFourMaterializationWebGpu({
  submittedWorkCleanup = DEFERRED_QUEUE_FENCE_CLEANUP,
  ...args
} = {}) {
  if (
    submittedWorkCleanup !== DEFERRED_QUEUE_FENCE_CLEANUP
    && submittedWorkCleanup !== CALLER_TERMINAL_FENCE_CLEANUP
  ) {
    throw new RangeError(
      'Phase-carrier 1-to-4 submittedWorkCleanup must be deferred-queue-fence or caller-terminal-fence'
    );
  }
  const device = args.device;
  if (
    typeof device?.pushErrorScope !== 'function'
    || typeof device?.popErrorScope !== 'function'
  ) {
    throw new TypeError(
      'Phase-carrier 1-to-4 materialization requires WebGPU validation error scopes'
    );
  }
  device.pushErrorScope('validation');
  let validationScopeOpen = true;
  let stage = null;
  let submitted = false;
  try {
    stage = createSphPhaseCarrierOneToFourMaterializationWebGpuEncoderStage(
      args
    );
    const encoder = device.createCommandEncoder();
    stage.encode(encoder);
    device.queue.submit([encoder.finish()]);
    submitted = true;
    stage.result.commandSubmissionCount = 1;
    stage.result.validationErrorScopeCount = 1;
    let validationError = null;
    let validationScopeFailure = null;
    try {
      validationError = await device.popErrorScope();
    } catch (error) {
      validationScopeFailure = error;
    } finally {
      validationScopeOpen = false;
    }
    stage.result.validationErrorObserved = Boolean(validationError);
    stage.result.validationErrorMessage = validationError
      ? String(validationError.message ?? validationError)
      : (validationScopeFailure
        ? String(validationScopeFailure.message ?? validationScopeFailure)
        : null);
    stage.result.validationErrorScopeStatus = validationScopeFailure
      ? 'validation-error-scope-resolution-failed'
      : (validationError
        ? 'validation-error-observed'
        : 'validation-error-scope-clean');
    stage.result.status = validationError || validationScopeFailure
      ? 'phase-carrier-one-to-four-materialization-publication-invalid'
      : 'phase-carrier-one-to-four-materialization-submitted';
    stage.result.submittedWorkCleanupMode = submittedWorkCleanup;
    if (submittedWorkCleanup === CALLER_TERMINAL_FENCE_CLEANUP) {
      stage.result.submittedWorkCleanupStatus =
        'held-for-caller-terminal-fence';
      Object.defineProperty(stage.result, 'cleanupSubmittedWork', {
        value: stage.cleanupSubmittedWork,
        enumerable: false
      });
    } else {
      try {
        stage.result.submittedWorkCleanupStatus =
          'deferred-after-host-queue-fence';
        stage.result.submittedWorkCleanupCompletion =
          deferSubmittedWorkCleanup(device, stage.cleanupSubmittedWork);
        stage.result.hostQueueFenceCount = 1;
        stage.result.deferredCleanupHostQueueFenceCount = 1;
      } catch (error) {
        stage.result.status =
          'phase-carrier-one-to-four-materialization-publication-invalid';
        stage.result.submittedWorkCleanupStatus =
          'held-after-deferred-cleanup-registration-failed';
        stage.result.submittedWorkCleanupFailure = String(
          error?.message ?? error
        );
        Object.defineProperty(stage.result, 'cleanupSubmittedWork', {
          value: stage.cleanupSubmittedWork,
          enumerable: false
        });
      }
    }
    return stage.result;
  } catch (error) {
    if (validationScopeOpen) {
      try { await device.popErrorScope(); } catch {}
      validationScopeOpen = false;
    }
    if (!submitted) {
      try { stage?.cleanupSubmittedWork(); } catch {}
      try { stage?.cleanupRetainedOutput(); } catch {}
      throw error;
    }
    // Once queue.submit succeeds the buffers remain caller-owned until a
    // queue or schedule terminal fence, even if local receipt assembly fails.
    stage.result.status =
      'phase-carrier-one-to-four-materialization-publication-invalid';
    stage.result.postSubmitPublicationError = String(error?.message ?? error);
    stage.result.submittedWorkCleanupMode = CALLER_TERMINAL_FENCE_CLEANUP;
    stage.result.submittedWorkCleanupStatus =
      'held-after-post-submit-publication-failure';
    Object.defineProperty(stage.result, 'cleanupSubmittedWork', {
      value: stage.cleanupSubmittedWork,
      enumerable: false
    });
    return stage.result;
  }
}

export function validateSphPhaseCarrierOneToFourExecution(result, {
  device = null,
  sourceParticleCount = null,
  sourceLineage = null
} = {}) {
  const failures = [];
  const sourceCount = Number(sourceParticleCount ?? result?.sourceParticleCount);
  const terminalCount = sourceCount * PHASE_LANE_COUNT;
  if (
    result?.schema !== ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_EXECUTION_SCHEMA
  ) failures.push('execution-schema');
  if (
    result?.status !== 'phase-carrier-one-to-four-materialization-submitted'
  ) failures.push('execution-status');
  if (
    result?.validationErrorScopeCount !== 1
    || result?.validationErrorScopeStatus !== 'validation-error-scope-clean'
    || result?.validationErrorObserved !== false
    || result?.validationErrorMessage !== null
  ) failures.push('validation-error-scope');
  if (!Number.isSafeInteger(sourceCount) || sourceCount <= 0) {
    failures.push('source-particle-count');
  }
  if (result?.sourceParticleCount !== sourceCount) {
    failures.push('source-particle-count-mismatch');
  }
  if (result?.terminalParticleCount !== sourceCount * PHASE_LANE_COUNT) {
    failures.push('terminal-particle-count');
  }
  if (result?.companionParticleCount !== sourceCount * 3) {
    failures.push('companion-particle-count');
  }
  if (
    result?.countSummary?.schema
      !== ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_COUNT_SUMMARY_SCHEMA
    || result.countSummary.sourceParticleCount !== sourceCount
    || result.countSummary.terminalParticleCount !== sourceCount * 4
    || result.countSummary.exactCountAuthority !== true
  ) failures.push('count-summary');
  if (
    result?.phaseCarrierPlan?.phaseLaneCount !== 4
    || result.phaseCarrierPlan.phaseLaneStride !== sourceCount
    || result.phaseCarrierPlan.particleCapacity !== sourceCount * 4
    || result.phaseCarrierPlan.stableLaneAddress !== STABLE_LANE_ADDRESS
  ) failures.push('terminal-phase-carrier-plan');
  try {
    validateSingleLanePlan(result?.sourcePhaseCarrierPlan, sourceCount);
  } catch {
    failures.push('source-phase-carrier-plan');
  }
  if (!phaseCarrierTopologyEquals(
    result?.phaseCarrierPlan,
    terminalPhaseCarrierPlan(sourceCount)
  )) failures.push('phase-carrier-plan-shape');
  const sourceIdentityRevision = String(
    result?.sourceIdentityRevision ?? ''
  ).trim();
  const terminalIdentityRevision = String(result?.identityRevision ?? '').trim();
  if (
    result?.identitySchema !== ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
    || result?.identityStrideBytes
      !== SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT
    || !sourceIdentityRevision
    || !terminalIdentityRevision
    || terminalIdentityRevision !== derivedIdentityRevision(
      sourceIdentityRevision,
      result
    )
    || result?.materializationKernelRevision
      !== ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_KERNEL_REVISION
    || result?.identityCorrespondenceRevision
      !== ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_IDENTITY_CORRESPONDENCE_REVISION
    || result?.identityCorrespondence
      !== 'duplicate-source-render-domain-identity-across-four-fixed-phase-lanes'
  ) failures.push('identity-correspondence-authority');
  if (
    result?.publicationComplete !== true
    || !Array.isArray(result?.publicationFamilies)
    || result.publicationFamilies.length !== 4
    || !['state', 'thermo', 'mechanics', 'identity'].every(
      (family, index) => result.publicationFamilies[index] === family
    )
  ) failures.push('publication-family');
  if (
    result?.commandSubmissionCount !== 1
    || result?.fullParticleReadbackPerformed !== false
    || result?.mapAsyncCount !== 0
    || result?.readbackBytes !== 0
  ) failures.push('gpu-residency');
  if (
    result?.routingAuthority !== false
    || result?.dynamicLawRoutingAuthority !== false
  ) failures.push('routing-authority');
  const dispatchWorkgroupCount = Math.ceil(terminalCount / WORKGROUP_SIZE);
  if (
    !Number.isSafeInteger(result?.deviceLimits?.maxBufferSize)
    || !Number.isSafeInteger(
      result?.deviceLimits?.maxStorageBufferBindingSize
    )
    || !Number.isSafeInteger(
      result?.deviceLimits?.maxComputeWorkgroupsPerDimension
    )
    || result?.deviceLimits?.maxStorageBuffersPerShaderStage < 8
    || result?.deviceLimits?.dispatchWorkgroupCount !== dispatchWorkgroupCount
    || result?.deviceLimits?.maxComputeWorkgroupsPerDimension
      < dispatchWorkgroupCount
    || Math.max(
      Number(result?.stateBufferByteLength) || 0,
      Number(result?.thermoBufferByteLength) || 0,
      Number(result?.mechanicsBufferByteLength) || 0,
      Number(result?.identityBufferByteLength) || 0
    ) > result?.deviceLimits?.maxBufferSize
    || Math.max(
      Number(result?.stateBufferByteLength) || 0,
      Number(result?.thermoBufferByteLength) || 0,
      Number(result?.mechanicsBufferByteLength) || 0,
      Number(result?.identityBufferByteLength) || 0
    ) > result?.deviceLimits?.maxStorageBufferBindingSize
  ) failures.push('device-limits');
  const expectedSource = sourceLineage ? exactLineage(sourceLineage) : null;
  if (sourceLineage && !expectedSource) failures.push('expected-source-lineage');
  if (
    expectedSource
    && LINEAGE_FIELDS.some(
      (field) => result?.lineage?.source?.[field] !== expectedSource[field]
    )
  ) failures.push('source-lineage-mismatch');
  let expectedTarget = null;
  if (expectedSource) {
    try {
      expectedTarget = deriveSphPhaseCarrierOneToFourLineage(
        expectedSource
      ).target;
    } catch {
      failures.push('target-lineage-unavailable');
    }
  }
  if (
    expectedTarget
    && LINEAGE_FIELDS.some(
      (field) => result?.lineage?.target?.[field] !== expectedTarget[field]
    )
  ) failures.push('target-lineage-mismatch');
  for (const [family, buffer, byteLength, uploadBuffer] of [
    [
      'state',
      result?.stateBuffer,
      terminalCount * SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      result?.nextSphParticleUpload?.stateBuffer
    ],
    [
      'thermo',
      result?.thermoBuffer,
      terminalCount * SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      result?.nextSphParticleUpload?.thermoBuffer
    ],
    [
      'mechanics',
      result?.mechanicsBuffer,
      terminalCount
        * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
        * Float32Array.BYTES_PER_ELEMENT,
      result?.nextMlsMpmParticleUpload?.mechanicsBuffer
    ],
    [
      'identity',
      result?.identityBuffer,
      terminalCount * SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
      result?.nextSphParticleUpload?.identityBuffer
    ]
  ]) {
    if (!buffer || buffer !== uploadBuffer) failures.push(`${family}-publication`);
    if (
      !Number.isSafeInteger(Number(buffer?.size))
      || Number(buffer.size) !== byteLength
    ) {
      failures.push(`${family}-byte-length`);
    }
    const usage = Number(buffer?.usage);
    if (
      !Number.isSafeInteger(usage)
      || (usage & GPU_BUFFER_USAGE.STORAGE) !== GPU_BUFFER_USAGE.STORAGE
      || (usage & GPU_BUFFER_USAGE.COPY_SRC) !== GPU_BUFFER_USAGE.COPY_SRC
    ) failures.push(`${family}-usage`);
    if (device && webGpuBufferDevice(buffer) !== device) {
      failures.push(`${family}-device`);
    }
  }
  if (new Set([
    result?.stateBuffer,
    result?.thermoBuffer,
    result?.mechanicsBuffer,
    result?.identityBuffer
  ]).size !== 4) failures.push('terminal-buffer-family-distinctness');
  const targetUploads = exactParticleFamilyLineage(
    result?.nextSphParticleUpload,
    result?.nextMlsMpmParticleUpload
  );
  if (!targetUploads) failures.push('terminal-upload-lineage');
  if (
    targetUploads
    && LINEAGE_FIELDS.some(
      (field) => targetUploads[field] !== result?.lineage?.target?.[field]
    )
  ) failures.push('terminal-upload-lineage-mismatch');
  for (const state of [
    result?.nextSphParticleState,
    result?.nextMlsMpmParticleState
  ]) {
    const stateLineage = exactLineage(state);
    if (
      !stateLineage
      || LINEAGE_FIELDS.some(
        (field) => stateLineage[field] !== result?.lineage?.target?.[field]
      )
    ) failures.push('terminal-state-lineage');
  }
  if (
    result?.nextSphParticleUpload?.schema
      !== ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
    || result?.nextSphParticleUpload?.status !== 'webgpu-uploaded'
    || result?.nextSphParticleUpload?.destroyed === true
    || result?.nextMlsMpmParticleUpload?.schema
      !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA
    || result?.nextMlsMpmParticleUpload?.status !== 'webgpu-uploaded'
    || result?.nextMlsMpmParticleUpload?.destroyed === true
    || result?.nextSphParticleUpload?.particleCount !== terminalCount
    || result?.nextMlsMpmParticleUpload?.particleCount !== terminalCount
    || result?.nextSphParticleUpload?.stateBufferByteLength
      !== result?.stateBufferByteLength
    || result?.nextSphParticleUpload?.thermoBufferByteLength
      !== result?.thermoBufferByteLength
    || result?.nextSphParticleUpload?.identityBufferByteLength
      !== result?.identityBufferByteLength
    || result?.nextMlsMpmParticleUpload?.mechanicsBufferByteLength
      !== result?.mechanicsBufferByteLength
    || result?.nextSphParticleUpload?.identitySchema
      !== ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
    || result?.nextSphParticleUpload?.identityStrideBytes
      !== SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT
    || result?.nextSphParticleUpload?.identityRevision
      !== terminalIdentityRevision
    || result?.nextSphParticleUpload?.bufferFamilyGeneration
      !== result?.lineage?.target?.storageGeneration
    || result?.nextMlsMpmParticleUpload?.bufferFamilyGeneration
      !== result?.lineage?.target?.storageGeneration
    || !phaseCarrierTopologyEquals(
      result?.nextSphParticleUpload?.phaseCarrierPlan,
      result?.phaseCarrierPlan
    )
    || !phaseCarrierTopologyEquals(
      result?.nextMlsMpmParticleUpload?.phaseCarrierPlan,
      result?.phaseCarrierPlan
    )
    || result?.nextSphParticleState?.schema
      !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
    || result?.nextSphParticleState?.status !== 'gpu-resident-unread-ready'
    || result?.nextMlsMpmParticleState?.schema
      !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA
    || result?.nextMlsMpmParticleState?.status !== 'gpu-resident-unread-ready'
    || result?.nextSphParticleState?.particleCount !== terminalCount
    || result?.nextMlsMpmParticleState?.particleCount !== terminalCount
    || result?.nextSphParticleState?.identityRevision
      !== terminalIdentityRevision
    || !phaseCarrierTopologyEquals(
      result?.nextSphParticleState?.phaseCarrierPlan,
      result?.phaseCarrierPlan
    )
    || !phaseCarrierTopologyEquals(
      result?.nextMlsMpmParticleState?.phaseCarrierPlan,
      result?.phaseCarrierPlan
    )
    || result?.nextSphParticleState?.cpuStateStale !== true
    || result?.nextSphParticleState?.cpuIdentityStale !== true
    || result?.nextMlsMpmParticleState?.cpuStateStale !== true
    || result?.nextParticleUploads?.sphParticleUpload
      !== result?.nextSphParticleUpload
    || result?.nextParticleUploads?.mlsMpmParticleUpload
      !== result?.nextMlsMpmParticleUpload
  ) failures.push('terminal-descriptors');
  return Object.freeze({
    schema:
      'peercompute.ulg.sph-phase-carrier-one-to-four-validation.v0',
    status: failures.length === 0
      ? 'phase-carrier-one-to-four-execution-valid'
      : 'phase-carrier-one-to-four-execution-invalid',
    valid: failures.length === 0,
    failures: Object.freeze(failures),
    sourceParticleCount: sourceCount,
    terminalParticleCount: Number(result?.terminalParticleCount) || 0,
    sourceLineage: expectedSource ? Object.freeze({ ...expectedSource }) : null,
    targetLineage: targetUploads ? Object.freeze({ ...targetUploads }) : null
  });
}
