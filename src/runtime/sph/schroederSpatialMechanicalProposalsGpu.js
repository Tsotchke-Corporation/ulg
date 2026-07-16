import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1,
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  createSchroederSpatialExactNearTraversalV1Wgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNearTraversalWgsl.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  deferSubmittedWorkCleanup
} from '../webgpuComputeLayout.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';
import {
  finalizeSchroederSpatialExactNearConsumerReceipt,
  resolveSchroederSpatialExactNearConsumerGeneration
} from './schroederSpatialEpochGpu.js';

export const ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_SCHEMA =
  'peercompute.ulg.schroeder-spatial-mechanical-proposal.v1';
export const ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_BUFFER_SCHEMA =
  'peercompute.ulg.schroeder-spatial-mechanical-proposal-buffer.v1';
export const ULG_SCHROEDER_SPATIAL_CONSUMER_GPU_EVIDENCE_SCHEMA =
  'peercompute.ulg.schroeder-spatial-consumer-gpu-evidence.v1';

export const SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS = Object.freeze([
  Object.freeze({
    consumerId: 'pressure-contact-interface',
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1
  }),
  Object.freeze({
    consumerId: 'separation',
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1
  }),
  Object.freeze({
    consumerId: 'local-material-interface',
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1
  })
]);

export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MAGIC = 0x4d50_4831;
export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_VERSION = 1;
export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS = 16;
export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS = 8;
export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_FLOATS = 8;
export const SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS = 20;

export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_LAYOUT = Object.freeze([
  'magic:u32',
  'version:u32',
  'generationId:u32',
  'supportEpoch:u32',
  'particleCount:u32',
  'rowWords:u32',
  'pressureContactSupportProfileId:u32',
  'separationSupportProfileId:u32',
  'localMaterialInterfaceSupportProfileId:u32',
  'positionEpoch:u32',
  'topologyEpoch:u32',
  'storageGeneration:u32',
  'physicsTick:u32',
  'physicsSubstep:u32',
  'traversalCount:u32',
  'consumerCount:u32'
]);

export const SCHROEDER_SPATIAL_MECHANICAL_EVIDENCE_LAYOUT = Object.freeze([
  'sourceInvocationCount:atomic<u32>',
  'directoryAdmissionCount:atomic<u32>',
  'directoryRejectCount:atomic<u32>',
  'candidateVisitCount:atomic<u32>',
  'contactPairHitCount:atomic<u32>',
  'malformedTraversalCount:atomic<u32>',
  'proposalRowCount:atomic<u32>',
  'nonFiniteProposalCount:atomic<u32>',
  'evidenceMagic:u32',
  'pressureContactSupportProfileId:u32',
  'generationId:u32',
  'supportEpoch:u32',
  'traversalCount:u32',
  'consumerCount:u32',
  'privateLookupBuildCount:u32',
  'fixedCandidateBuildCount:u32',
  'exhaustiveTraversalCount:u32',
  'positionEpoch:u32',
  'topologyEpoch:u32',
  'storageGeneration:u32'
]);

const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const EXPECTATION_BYTES = 112;
const MECHANICAL_PARAMS_BYTES = 96;
const WORKGROUP_SIZE = 64;
const MECHANICAL_EVIDENCE_MAGIC = 0x4d45_5631;
const MECHANICAL_PROPOSAL_HEADER_BYTES =
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT;
const MECHANICAL_PROPOSAL_ROW_BYTES =
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS * Uint32Array.BYTES_PER_ELEMENT;
const mechanicalProposalPools = new WeakMap();
const liveMechanicalProposalArtifacts = new WeakSet();

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finiteVector3(value, fallback = [0, 0, 0]) {
  return [0, 1, 2].map((axis) => finiteNumber(value?.[axis], fallback[axis]));
}

function vectorScale(vector, scale) {
  return vector.map((value) => value * scale);
}

function vectorSubtract(left, right) {
  return left.map((value, axis) => value - right[axis]);
}

function vectorLength(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function dot3(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

/**
 * Small manufactured-pair policy oracle. This is deliberately not a
 * production neighbor fallback; it mirrors the per-pair WGSL eligibility
 * policy so focused tests can prove domain/material routing explicitly.
 */
export function classifySchroederSpatialMechanicalPair({
  phaseClass,
  otherPhaseClass,
  materialId,
  otherMaterialId,
  domainId = 0,
  otherDomainId = 0,
  identityEnabled = true
} = {}) {
  const selfClass = Math.trunc(finiteNumber(phaseClass, 0));
  const peerClass = Math.trunc(finiteNumber(otherPhaseClass, 0));
  if (selfClass === 0 || peerClass === 0) {
    return Object.freeze({ handled: false, reason: 'gas-or-eos-disabled' });
  }
  const sameMaterial = Math.abs(
    finiteNumber(materialId, 0) - finiteNumber(otherMaterialId, 0)
  ) < 0.5;
  const selfDomain = Math.max(0, Math.trunc(finiteNumber(domainId, 0)));
  const peerDomain = Math.max(0, Math.trunc(finiteNumber(otherDomainId, 0)));
  const sameBodySolid = selfClass === 2
    && peerClass === 2
    && sameMaterial
    && (
      identityEnabled !== true
      || selfDomain === 0
      || peerDomain === 0
      || selfDomain === peerDomain
    );
  if (sameBodySolid) {
    return Object.freeze({ handled: false, reason: 'same-body-solid' });
  }
  return Object.freeze({
    handled: true,
    reason: sameMaterial ? 'cross-domain-or-condensed-phase' : 'cross-material-interface'
  });
}

/** Small manufactured-pair oracle for the symmetric WGSL pair contribution. */
export function evaluateSchroederSpatialMechanicalPairProposal({
  position = [0, 0, 0],
  otherPosition = [0, 0, 0],
  velocity = [0, 0, 0],
  otherVelocity = [0, 0, 0],
  massKg = 1,
  otherMassKg = 1,
  restVolumeM3 = 1,
  otherRestVolumeM3 = 1,
  relaxation = 0.35,
  normalVelocityDamping = 0.25,
  selfIndex = 0,
  otherIndex = 1,
  ...pairPolicy
} = {}) {
  const policy = classifySchroederSpatialMechanicalPair(pairPolicy);
  const zero = Object.freeze([0, 0, 0]);
  const selfMass = Math.max(finiteNumber(massKg, 0), 0);
  const peerMass = Math.max(finiteNumber(otherMassKg, 0), 0);
  const selfVolume = Math.max(finiteNumber(restVolumeM3, 0), 0);
  const peerVolume = Math.max(finiteNumber(otherRestVolumeM3, 0), 0);
  if (!policy.handled || !(selfMass > 0) || !(peerMass > 0)
      || !(selfVolume > 0) || !(peerVolume > 0)) {
    return Object.freeze({
      ...policy,
      overlapM: 0,
      positionDeltaM: zero,
      otherPositionDeltaM: zero,
      velocityDeltaMPerS: zero,
      otherVelocityDeltaMPerS: zero
    });
  }
  const selfPosition = finiteVector3(position);
  const peerPosition = finiteVector3(otherPosition);
  const delta = vectorSubtract(selfPosition, peerPosition);
  const distanceM = vectorLength(delta);
  const selfDiameterM = Math.cbrt(Math.max(selfVolume, 1e-18));
  const peerDiameterM = Math.cbrt(Math.max(peerVolume, 1e-18));
  const restDistanceM = 0.5 * (selfDiameterM + peerDiameterM);
  const overlapM = Math.max(0, restDistanceM - distanceM);
  if (!(overlapM > 0)) {
    return Object.freeze({
      ...policy,
      handled: false,
      reason: 'outside-pair-support',
      restDistanceM,
      distanceM,
      overlapM: 0,
      positionDeltaM: zero,
      otherPositionDeltaM: zero,
      velocityDeltaMPerS: zero,
      otherVelocityDeltaMPerS: zero
    });
  }
  const normal = distanceM > 1e-9
    ? vectorScale(delta, 1 / distanceM)
    : [0, selfIndex > otherIndex ? 1 : -1, 0];
  const inverseMass = 1 / Math.max(selfMass, 1e-30);
  const otherInverseMass = 1 / Math.max(peerMass, 1e-30);
  const inverseMassSum = inverseMass + otherInverseMass;
  const share = inverseMass / inverseMassSum;
  const otherShare = otherInverseMass / inverseMassSum;
  const alpha = Math.max(0, finiteNumber(relaxation, 0));
  const beta = Math.min(1, Math.max(0, finiteNumber(normalVelocityDamping, 0)));
  const positionDeltaM = vectorScale(normal, alpha * share * overlapM);
  const otherPositionDeltaM = vectorScale(normal, -alpha * otherShare * overlapM);
  const approachMPerS = dot3(
    vectorSubtract(finiteVector3(velocity), finiteVector3(otherVelocity)),
    normal
  );
  const dampingSpeedMPerS = approachMPerS < 0 ? -beta * approachMPerS : 0;
  const velocityDeltaMPerS = vectorScale(normal, dampingSpeedMPerS * share);
  const otherVelocityDeltaMPerS = vectorScale(normal, -dampingSpeedMPerS * otherShare);
  return Object.freeze({
    ...policy,
    handled: true,
    reason: 'overlapping-condensed-pair',
    restDistanceM,
    distanceM,
    overlapM,
    normal: Object.freeze(normal),
    positionDeltaM: Object.freeze(positionDeltaM),
    otherPositionDeltaM: Object.freeze(otherPositionDeltaM),
    velocityDeltaMPerS: Object.freeze(velocityDeltaMPerS),
    otherVelocityDeltaMPerS: Object.freeze(otherVelocityDeltaMPerS)
  });
}

function exactU32(value, label, { positive = false } = {}) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < (positive ? 1 : 0)
    || value > 0xffff_ffff
  ) {
    throw new RangeError(`${label} must be an exact ${positive ? 'positive ' : ''}u32`);
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
    throw new RangeError(`${label} must be an exact i32`);
  }
  return value;
}

function requireBuffer(device, buffer, label) {
  if (!buffer || !webGpuBufferMatchesDevice(buffer, device)) {
    throw new TypeError(`${label} must be a live buffer on the canonical generation device`);
  }
  return buffer;
}

function resolveMechanicalSpatialAuthority({
  device,
  generation,
  sphParticleUpload,
  mlsMpmParticleUpload,
  particleCount
}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('canonical mechanical proposals require a WebGPU-like device');
  }
  const execution = generation?.execution || null;
  const source = generation?.source || null;
  const runtime = generation?.runtime || null;
  if (
    generation?.selected !== true
    || generation?.ready !== true
    || generation?.releaseScheduled === true
    || generation?.directoryBuildCount !== 1
    || generation?.privateLookupBuildCount !== 0
    || execution?.submitPerformed !== true
    || execution?.released === true
    || execution?.generationId == null
    || source?.ready !== true
    || source?.sourceCount !== particleCount
    || source?.exactNearQueryProfile?.ready !== true
    || execution?.exactNearQueryProfile?.ready !== true
    || execution?.queryGeometryEvidence !== execution.exactNearQueryProfile
    || runtime !== execution?.ownerRuntime
    || execution?.deviceId !== webGpuDeviceId(device)
  ) {
    throw new TypeError(
      'canonical mechanical proposals require one live submitted exact-near generation'
    );
  }
  if (
    typeof runtime?.ownsExecution === 'function'
    && runtime.ownsExecution(execution) !== true
  ) {
    throw new TypeError('canonical mechanical proposal generation is not owned by its runtime');
  }
  if (
    typeof runtime?.isExecutionSubmitted === 'function'
    && runtime.isExecutionSubmitted(execution) !== true
  ) {
    throw new TypeError('canonical mechanical proposal generation has no submitted-work proof');
  }
  const stateBuffer = requireBuffer(
    device,
    sphParticleUpload?.stateBuffer,
    'sphParticleUpload.stateBuffer'
  );
  const thermoBuffer = requireBuffer(
    device,
    sphParticleUpload?.thermoBuffer,
    'sphParticleUpload.thermoBuffer'
  );
  const mechanicsBuffer = requireBuffer(
    device,
    mlsMpmParticleUpload?.mechanicsBuffer,
    'mlsMpmParticleUpload.mechanicsBuffer'
  );
  const directoryBuffer = requireBuffer(
    device,
    execution.directoryBuffer,
    'generation.execution.directoryBuffer'
  );
  const identityBuffer = sphParticleUpload?.identityBuffer
    ? requireBuffer(device, sphParticleUpload.identityBuffer, 'sphParticleUpload.identityBuffer')
    : null;
  return {
    generation,
    execution,
    source,
    stateBuffer,
    thermoBuffer,
    mechanicsBuffer,
    identityBuffer,
    directoryBuffer
  };
}

export function createSchroederSpatialExactNearExpectationArray({
  generation,
  supportProfileId,
  derivationEnabled = true
} = {}) {
  const execution = generation?.execution || null;
  const source = generation?.source || null;
  const profile = execution?.exactNearQueryProfile || source?.exactNearQueryProfile || null;
  const layout = execution?.layout || null;
  if (!execution || !source || !profile || !layout) {
    throw new TypeError('exact-near expectation requires a complete generation execution');
  }
  const buffer = new ArrayBuffer(EXPECTATION_BYTES);
  const view = new DataView(buffer);
  const u32 = (offset, value, label, options) => {
    view.setUint32(offset, exactU32(value, label, options), true);
  };
  u32(0, source.sourceCount, 'source.sourceCount', { positive: true });
  u32(4, derivationEnabled ? 1 : 0, 'derivationEnabled');
  u32(8, supportProfileId, 'supportProfileId', { positive: true });
  u32(12, profile.chartId, 'profile.chartId');
  u32(16, profile.levelCount, 'profile.levelCount', { positive: true });
  u32(20, execution.generationId, 'execution.generationId', { positive: true });
  u32(24, execution.deviceOrdinal, 'execution.deviceOrdinal');
  u32(28, execution.laneOrdinal, 'execution.laneOrdinal');
  u32(32, execution.leaseToken, 'execution.leaseToken', { positive: true });
  u32(36, execution.sourceFamilyId, 'execution.sourceFamilyId', { positive: true });
  u32(40, execution.storageGeneration, 'execution.storageGeneration', { positive: true });
  u32(44, execution.physicsTick, 'execution.physicsTick');
  u32(48, execution.physicsSubstep, 'execution.physicsSubstep');
  u32(52, execution.positionEpoch, 'execution.positionEpoch');
  u32(56, execution.topologyEpoch, 'execution.topologyEpoch');
  u32(60, execution.chartEpoch, 'execution.chartEpoch');
  u32(64, execution.levelEpoch, 'execution.levelEpoch');
  u32(68, execution.supportEpoch, 'execution.supportEpoch');
  view.setInt32(72, exactI32(profile.minLevel, 'profile.minLevel'), true);
  view.setFloat32(76, finiteNumber(profile.baseGridSpacingM, 0), true);
  u32(80, layout.cellKeysOffsetWords, 'layout.cellKeysOffsetWords');
  u32(84, layout.cellOffsetsOffsetWords, 'layout.cellOffsetsOffsetWords');
  u32(88, layout.cellMembersOffsetWords, 'layout.cellMembersOffsetWords');
  u32(92, layout.particleToCellOffsetWords, 'layout.particleToCellOffsetWords');
  u32(96, layout.wordLength, 'layout.wordLength', { positive: true });
  u32(100, execution.sourceCapacity, 'execution.sourceCapacity', { positive: true });
  u32(104, execution.cellCapacity, 'execution.cellCapacity', { positive: true });
  return buffer;
}

function createMechanicalParamsArray({
  particleCount,
  relaxation,
  normalVelocityDamping,
  gridSpacingM,
  boxDimsM,
  identityEnabled,
  execution
}) {
  const dims = Array.isArray(boxDimsM) ? boxDimsM : [5, 5, 5];
  const buffer = new ArrayBuffer(MECHANICAL_PARAMS_BYTES);
  const view = new DataView(buffer);
  view.setUint32(0, exactU32(particleCount, 'particleCount', { positive: true }), true);
  view.setFloat32(4, Math.max(0, finiteNumber(relaxation, 0)), true);
  view.setFloat32(8, Math.min(1, Math.max(0, finiteNumber(normalVelocityDamping, 0))), true);
  view.setFloat32(12, Math.max(0, finiteNumber(gridSpacingM, 0)), true);
  view.setFloat32(16, finiteNumber(dims[0], 5), true);
  view.setFloat32(20, finiteNumber(dims[1], 5), true);
  view.setFloat32(24, finiteNumber(dims[2], 5), true);
  view.setUint32(28, identityEnabled ? 1 : 0, true);
  view.setUint32(32, SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1, true);
  view.setUint32(36, SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1, true);
  view.setUint32(40, SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1, true);
  view.setUint32(44, 0, true);
  view.setUint32(48, exactU32(execution?.generationId, 'execution.generationId', {
    positive: true
  }), true);
  view.setUint32(52, exactU32(execution?.supportEpoch, 'execution.supportEpoch'), true);
  view.setUint32(56, exactU32(execution?.positionEpoch, 'execution.positionEpoch'), true);
  view.setUint32(60, exactU32(execution?.topologyEpoch, 'execution.topologyEpoch'), true);
  view.setUint32(64, exactU32(
    execution?.storageGeneration,
    'execution.storageGeneration',
    { positive: true }
  ), true);
  view.setUint32(68, exactU32(execution?.physicsTick, 'execution.physicsTick'), true);
  view.setUint32(72, exactU32(execution?.physicsSubstep, 'execution.physicsSubstep'), true);
  view.setUint32(76, SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MAGIC, true);
  view.setUint32(80, SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_VERSION, true);
  view.setUint32(84, 1, true);
  view.setUint32(88, SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS.length, true);
  view.setUint32(92, SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS, true);
  return buffer;
}

function createMechanicalProposalHeader(execution, particleCount) {
  const words = new Uint32Array(SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS);
  words[0] = SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MAGIC;
  words[1] = SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_VERSION;
  words[2] = exactU32(execution?.generationId, 'execution.generationId', {
    positive: true
  });
  words[3] = exactU32(execution?.supportEpoch, 'execution.supportEpoch');
  words[4] = exactU32(particleCount, 'particleCount', { positive: true });
  words[5] = SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS;
  words[6] = SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1;
  words[7] = SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1;
  words[8] = SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1;
  words[9] = exactU32(execution?.positionEpoch, 'execution.positionEpoch');
  words[10] = exactU32(execution?.topologyEpoch, 'execution.topologyEpoch');
  words[11] = exactU32(
    execution?.storageGeneration,
    'execution.storageGeneration',
    { positive: true }
  );
  words[12] = exactU32(execution?.physicsTick, 'execution.physicsTick');
  words[13] = exactU32(execution?.physicsSubstep, 'execution.physicsSubstep');
  words[14] = 1;
  words[15] = SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS.length;
  return words;
}

const exactNearTraversalWgsl = createSchroederSpatialExactNearTraversalV1Wgsl({
  directoryBindingName: 'spatial_directory'
});

export const schroederSpatialMechanicalProposalWgsl = /* wgsl */ `
struct MechanicalProposalParams {
  particle_count: u32,
  relaxation: f32,
  normal_velocity_damping: f32,
  grid_spacing_m: f32,
  box_dims_m: vec3<f32>,
  identity_enabled: u32,
  contact_support_profile_id: u32,
  separation_support_profile_id: u32,
  interface_support_profile_id: u32,
  _pad0: u32,
  generation_id: u32,
  support_epoch: u32,
  position_epoch: u32,
  topology_epoch: u32,
  storage_generation: u32,
  physics_tick: u32,
  physics_substep: u32,
  proposal_magic: u32,
  proposal_version: u32,
  traversal_count: u32,
  consumer_count: u32,
  proposal_row_words: u32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> source_identity: array<u32>;
@group(0) @binding(4) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(5) var<storage, read_write> proposal_rows: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> traversal_evidence: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> spatial_expectation: SchroederSpatialExactNearExpectationV1;
@group(0) @binding(8) var<uniform> mechanical_params: MechanicalProposalParams;
@group(0) @binding(9) var<storage, read_write> global_support_bits: array<atomic<u32>>;

${exactNearTraversalWgsl}

fn mechanical_cbrt(volume_m3: f32) -> f32 {
  return pow(max(volume_m3, 1.0e-18), 1.0 / 3.0);
}

fn mechanical_phase_class(index: u32) -> u32 {
  let row5 = source_mechanics[index * 8u + 5u];
  let row6 = source_mechanics[index * 8u + 6u];
  if (row5.x > 0.5) { return 2u; }
  if (row6.z > 0.5 && row6.z < 1.5) { return 1u; }
  return 0u;
}

fn mechanical_same_body_solid_pair(self_index: u32, other_index: u32) -> bool {
  if (mechanical_phase_class(self_index) != 2u || mechanical_phase_class(other_index) != 2u) {
    return false;
  }
  let self_material = source_thermo[self_index * 3u].x;
  let other_material = source_thermo[other_index * 3u].x;
  if (abs(self_material - other_material) >= 0.5) { return false; }
  if (mechanical_params.identity_enabled == 0u) { return true; }
  let self_domain = source_identity[self_index];
  let other_domain = source_identity[other_index];
  return self_domain == 0u || other_domain == 0u || self_domain == other_domain;
}

@compute @workgroup_size(64)
fn reduce_support(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= mechanical_params.particle_count) { return; }
  let volume = max(source_mechanics[particle_index * 8u + 4u].w, 0.0);
  let mass = source_state[particle_index * 2u].w;
  if (volume <= 0.0 || mass <= 0.0) { return; }
  atomicMax(&global_support_bits[0u], bitcast<u32>(mechanical_cbrt(volume)));
}

fn mechanical_increment_local(counter: ptr<function, u32>) -> bool {
  if (*counter == 0xffffffffu) { return false; }
  *counter = *counter + 1u;
  return true;
}

fn mechanical_flush_evidence(index: u32, count: u32) -> bool {
  if (count == 0u) { return true; }
  let previous = atomicAdd(&traversal_evidence[index], count);
  return previous <= 0xffffffffu - count;
}

fn mechanical_visit_pair(
  self_index: u32,
  other_index: u32,
  self_pos_mass: vec4<f32>,
  self_velocity: vec3<f32>,
  self_diameter: f32,
  dx: ptr<function, vec3<f32>>,
  dv: ptr<function, vec3<f32>>,
  candidate_visit_count: ptr<function, u32>,
  contact_pair_hit_count: ptr<function, u32>,
  local_count_overflow: ptr<function, bool>
) {
  if (other_index == self_index || other_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_increment_local(candidate_visit_count)) {
    *local_count_overflow = true;
    return;
  }
  let self_class = mechanical_phase_class(self_index);
  let other_class = mechanical_phase_class(other_index);
  if (self_class == 0u || other_class == 0u || mechanical_same_body_solid_pair(self_index, other_index)) {
    return;
  }
  let other_pos_mass = source_state[other_index * 2u];
  if (other_pos_mass.w <= 0.0) { return; }
  let other_volume = max(source_mechanics[other_index * 8u + 4u].w, 0.0);
  if (other_volume <= 0.0) { return; }
  let pair_rest_distance = 0.5 * (self_diameter + mechanical_cbrt(other_volume));
  let delta = self_pos_mass.xyz - other_pos_mass.xyz;
  var distance = length(delta);
  if (distance >= pair_rest_distance) { return; }
  var normal = vec3<f32>(0.0, 1.0, 0.0);
  if (distance > 1.0e-9) {
    normal = delta / distance;
  } else {
    let low_index = min(self_index, other_index);
    var h = low_index * 2654435761u + 0x9e3779b9u;
    h = (h ^ (h >> 16u)) * 2246822519u;
    h = h ^ (h >> 13u);
    let raw = vec3<f32>(
      f32(h & 1023u) / 511.5 - 1.0,
      f32((h >> 10u) & 1023u) / 511.5 - 1.0,
      f32((h >> 20u) & 1023u) / 511.5 - 1.0
    );
    let raw_length = length(raw);
    let hashed = select(vec3<f32>(0.0, 1.0, 0.0), raw / max(raw_length, 1.0e-6), raw_length > 1.0e-4);
    normal = hashed * select(-1.0, 1.0, self_index > other_index);
    distance = 0.0;
  }
  let self_inverse_mass = 1.0 / max(self_pos_mass.w, 1.0e-30);
  let other_inverse_mass = 1.0 / max(other_pos_mass.w, 1.0e-30);
  let share = self_inverse_mass / (self_inverse_mass + other_inverse_mass);
  *dx = *dx + mechanical_params.relaxation * share * (pair_rest_distance - distance) * normal;
  let approach = dot(self_velocity - source_state[other_index * 2u + 1u].xyz, normal);
  if (approach < 0.0) {
    *dv = *dv - mechanical_params.normal_velocity_damping * share * approach * normal;
  }
  if (!mechanical_increment_local(contact_pair_hit_count)) {
    *local_count_overflow = true;
  }
}

@compute @workgroup_size(64)
fn propose(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= mechanical_params.particle_count) { return; }
  let proposal_row = ${SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS / 4}u
    + particle_index * 2u;
  proposal_rows[proposal_row] = vec4<f32>(0.0);
  proposal_rows[proposal_row + 1u] = vec4<f32>(0.0);
  atomicAdd(&traversal_evidence[0u], 1u);
  if (
    spatial_expectation.support_profile_id != mechanical_params.contact_support_profile_id
    || !ss_exact_near_directory_admitted(spatial_expectation)
  ) {
    atomicAdd(&traversal_evidence[2u], 1u);
    return;
  }
  atomicAdd(&traversal_evidence[1u], 1u);
  let self_class = mechanical_phase_class(particle_index);
  let self_pos_mass = source_state[particle_index * 2u];
  let self_volume = max(source_mechanics[particle_index * 8u + 4u].w, 0.0);
  if (self_class == 0u || self_pos_mass.w <= 0.0 || self_volume <= 0.0) {
    atomicAdd(&traversal_evidence[6u], 1u);
    return;
  }
  let self_diameter = mechanical_cbrt(self_volume);
  let global_max_diameter = bitcast<f32>(atomicLoad(&global_support_bits[0u]));
  let query_radius_m = 0.5 * (self_diameter + global_max_diameter);
  if (!ss_exact_near_finite(query_radius_m) || query_radius_m <= 0.0) {
    atomicAdd(&traversal_evidence[5u], 1u);
    return;
  }
  var dx = vec3<f32>(0.0);
  var dv = vec3<f32>(0.0);
  let self_velocity = source_state[particle_index * 2u + 1u].xyz;
  var candidate_visit_count = 0u;
  var contact_pair_hit_count = 0u;
  var local_count_overflow = false;
  var malformed = false;
  for (var level_ordinal = 0u; level_ordinal < spatial_expectation.level_count; level_ordinal = level_ordinal + 1u) {
    if (!ss_exact_near_level_occupied(spatial_expectation, level_ordinal)) { continue; }
    let level = spatial_expectation.min_level + i32(level_ordinal);
    let spacing_m = spatial_expectation.base_grid_spacing_m * exp2(f32(level));
    if (!ss_exact_near_finite(spacing_m) || spacing_m <= 0.0) { malformed = true; break; }
    let center_cell = vec3<i32>(floor(self_pos_mass.xyz / spacing_m));
    let radius_cells = max(0, i32(min(ceil(query_radius_m / spacing_m), 2147483520.0)));
    let minimum_cell = vec3<i32>(
      ss_exact_near_saturating_sub_radius(center_cell.x, radius_cells),
      ss_exact_near_saturating_sub_radius(center_cell.y, radius_cells),
      ss_exact_near_saturating_sub_radius(center_cell.z, radius_cells)
    );
    let maximum_cell = vec3<i32>(
      ss_exact_near_saturating_add_radius(center_cell.x, radius_cells),
      ss_exact_near_saturating_add_radius(center_cell.y, radius_cells),
      ss_exact_near_saturating_add_radius(center_cell.z, radius_cells)
    );
    let level_order = ss_exact_near_signed_order_key(level);
    let minimum_order = vec3<u32>(
      ss_exact_near_signed_order_key(minimum_cell.x),
      ss_exact_near_signed_order_key(minimum_cell.y),
      ss_exact_near_signed_order_key(minimum_cell.z)
    );
    let maximum_order = vec3<u32>(
      ss_exact_near_signed_order_key(maximum_cell.x),
      ss_exact_near_signed_order_key(maximum_cell.y),
      ss_exact_near_signed_order_key(maximum_cell.z)
    );
    let level_begin = ss_exact_near_lower_bound_cell_key(spatial_expectation, spatial_expectation.chart_id, level_order, vec3<u32>(0u));
    let level_end = ss_exact_near_upper_bound_cell_key(spatial_expectation, spatial_expectation.chart_id, level_order, vec3<u32>(0xffffffffu));
    var x_cursor = ss_exact_near_lower_bound_cell_key_range(
      spatial_expectation, spatial_expectation.chart_id, level_order,
      vec3<u32>(minimum_order.x, 0u, 0u), level_begin, level_end
    );
    for (var x_iteration = 0u; x_iteration < spatial_expectation.source_count && x_cursor < level_end; x_iteration = x_iteration + 1u) {
      let x_order = ss_exact_near_cell_key_word(spatial_expectation, x_cursor, 2u);
      if (x_order > maximum_order.x) { x_cursor = level_end; continue; }
      let x_end = ss_exact_near_upper_bound_cell_key_range(
        spatial_expectation, spatial_expectation.chart_id, level_order,
        vec3<u32>(x_order, 0xffffffffu, 0xffffffffu), x_cursor, level_end
      );
      if (x_end <= x_cursor) { malformed = true; break; }
      var y_cursor = ss_exact_near_lower_bound_cell_key_range(
        spatial_expectation, spatial_expectation.chart_id, level_order,
        vec3<u32>(x_order, minimum_order.y, 0u), x_cursor, x_end
      );
      for (var y_iteration = 0u; y_iteration < spatial_expectation.source_count && y_cursor < x_end; y_iteration = y_iteration + 1u) {
        let y_order = ss_exact_near_cell_key_word(spatial_expectation, y_cursor, 3u);
        if (y_order > maximum_order.y) { y_cursor = x_end; continue; }
        let y_end = ss_exact_near_upper_bound_cell_key_range(
          spatial_expectation, spatial_expectation.chart_id, level_order,
          vec3<u32>(x_order, y_order, 0xffffffffu), y_cursor, x_end
        );
        if (y_end <= y_cursor) { malformed = true; break; }
        let z_begin = ss_exact_near_lower_bound_cell_key_range(
          spatial_expectation, spatial_expectation.chart_id, level_order,
          vec3<u32>(x_order, y_order, minimum_order.z), y_cursor, y_end
        );
        let z_end = ss_exact_near_upper_bound_cell_key_range(
          spatial_expectation, spatial_expectation.chart_id, level_order,
          vec3<u32>(x_order, y_order, maximum_order.z), z_begin, y_end
        );
        for (var cell_index = z_begin; cell_index < z_end; cell_index = cell_index + 1u) {
          let member_range = ss_exact_near_cell_member_range(spatial_expectation, cell_index);
          if (member_range.admitted == 0u) { malformed = true; break; }
          for (var member_offset = member_range.begin; member_offset < member_range.end; member_offset = member_offset + 1u) {
            let lookup = ss_exact_near_source_at_member(spatial_expectation, member_offset);
            if (lookup.admitted == 0u) { malformed = true; break; }
            mechanical_visit_pair(
              particle_index,
              lookup.source_index,
              self_pos_mass,
              self_velocity,
              self_diameter,
              &dx,
              &dv,
              &candidate_visit_count,
              &contact_pair_hit_count,
              &local_count_overflow
            );
          }
          if (malformed) { break; }
        }
        if (malformed) { break; }
        y_cursor = y_end;
      }
      if (malformed || y_cursor < x_end) { malformed = true; break; }
      x_cursor = x_end;
    }
    if (malformed || x_cursor < level_end) { malformed = true; break; }
  }
  let candidate_count_admitted = mechanical_flush_evidence(
    3u,
    candidate_visit_count
  );
  let contact_hit_count_admitted = mechanical_flush_evidence(
    4u,
    contact_pair_hit_count
  );
  if (
    local_count_overflow
    || !candidate_count_admitted
    || !contact_hit_count_admitted
  ) {
    malformed = true;
  }
  if (malformed) {
    atomicAdd(&traversal_evidence[5u], 1u);
    return;
  }
  let max_step = 0.5 * self_diameter;
  let dx_length = length(dx);
  if (dx_length > max_step) { dx = dx * (max_step / dx_length); }
  if (
    !ss_exact_near_finite(dx.x)
    || !ss_exact_near_finite(dx.y)
    || !ss_exact_near_finite(dx.z)
    || !ss_exact_near_finite(dv.x)
    || !ss_exact_near_finite(dv.y)
    || !ss_exact_near_finite(dv.z)
  ) {
    atomicAdd(&traversal_evidence[7u], 1u);
    return;
  }
  proposal_rows[proposal_row] = vec4<f32>(dx, 0.0);
  proposal_rows[proposal_row + 1u] = vec4<f32>(dv, 0.0);
  atomicAdd(&traversal_evidence[6u], 1u);
}
`;

export const schroederSpatialMechanicalProposalApplyWgsl = /* wgsl */ `
struct MechanicalProposalParams {
  particle_count: u32,
  relaxation: f32,
  normal_velocity_damping: f32,
  grid_spacing_m: f32,
  box_dims_m: vec3<f32>,
  identity_enabled: u32,
  contact_support_profile_id: u32,
  separation_support_profile_id: u32,
  interface_support_profile_id: u32,
  _pad0: u32,
  generation_id: u32,
  support_epoch: u32,
  position_epoch: u32,
  topology_epoch: u32,
  storage_generation: u32,
  physics_tick: u32,
  physics_substep: u32,
  proposal_magic: u32,
  proposal_version: u32,
  traversal_count: u32,
  consumer_count: u32,
  proposal_row_words: u32,
};

@group(0) @binding(0) var<storage, read> proposal_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_mechanics: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> output_state: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> mechanical_params: MechanicalProposalParams;
@group(0) @binding(4) var<storage, read_write> traversal_evidence: array<atomic<u32>>;

fn mechanical_apply_cbrt(volume_m3: f32) -> f32 {
  return pow(max(volume_m3, 1.0e-18), 1.0 / 3.0);
}

fn mechanical_proposal_header_word(word: u32) -> u32 {
  return bitcast<u32>(proposal_rows[word / 4u][word % 4u]);
}

fn mechanical_complete_proposal_admitted() -> bool {
  if (
    arrayLength(&proposal_rows)
      < ${SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS / 4}u
        + mechanical_params.particle_count * 2u
    || arrayLength(&traversal_evidence) < ${SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS}u
  ) { return false; }
  if (
    mechanical_proposal_header_word(0u) != mechanical_params.proposal_magic
    || mechanical_proposal_header_word(1u) != mechanical_params.proposal_version
    || mechanical_proposal_header_word(2u) != mechanical_params.generation_id
    || mechanical_proposal_header_word(3u) != mechanical_params.support_epoch
    || mechanical_proposal_header_word(4u) != mechanical_params.particle_count
    || mechanical_proposal_header_word(5u) != mechanical_params.proposal_row_words
    || mechanical_proposal_header_word(6u) != mechanical_params.contact_support_profile_id
    || mechanical_proposal_header_word(7u) != mechanical_params.separation_support_profile_id
    || mechanical_proposal_header_word(8u) != mechanical_params.interface_support_profile_id
    || mechanical_proposal_header_word(9u) != mechanical_params.position_epoch
    || mechanical_proposal_header_word(10u) != mechanical_params.topology_epoch
    || mechanical_proposal_header_word(11u) != mechanical_params.storage_generation
    || mechanical_proposal_header_word(12u) != mechanical_params.physics_tick
    || mechanical_proposal_header_word(13u) != mechanical_params.physics_substep
    || mechanical_proposal_header_word(14u) != mechanical_params.traversal_count
    || mechanical_proposal_header_word(15u) != mechanical_params.consumer_count
  ) { return false; }
  return atomicLoad(&traversal_evidence[0u]) == mechanical_params.particle_count
    && atomicLoad(&traversal_evidence[1u]) == mechanical_params.particle_count
    && atomicLoad(&traversal_evidence[2u]) == 0u
    && atomicLoad(&traversal_evidence[5u]) == 0u
    && atomicLoad(&traversal_evidence[6u]) == mechanical_params.particle_count
    && atomicLoad(&traversal_evidence[7u]) == 0u
    && atomicLoad(&traversal_evidence[8u]) == ${MECHANICAL_EVIDENCE_MAGIC}u
    && atomicLoad(&traversal_evidence[9u]) == mechanical_params.contact_support_profile_id
    && atomicLoad(&traversal_evidence[10u]) == mechanical_params.generation_id
    && atomicLoad(&traversal_evidence[11u]) == mechanical_params.support_epoch
    && atomicLoad(&traversal_evidence[12u]) == mechanical_params.traversal_count
    && atomicLoad(&traversal_evidence[13u]) == mechanical_params.consumer_count
    && atomicLoad(&traversal_evidence[14u]) == 0u
    && atomicLoad(&traversal_evidence[15u]) == 0u
    && atomicLoad(&traversal_evidence[16u]) == 0u
    && atomicLoad(&traversal_evidence[17u]) == mechanical_params.position_epoch
    && atomicLoad(&traversal_evidence[18u]) == mechanical_params.topology_epoch
    && atomicLoad(&traversal_evidence[19u]) == mechanical_params.storage_generation;
}

@compute @workgroup_size(64)
fn apply(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= mechanical_params.particle_count) { return; }
  // A malformed or unauthenticated traversal invalidates the complete
  // consumer proposal set. Never partially apply rows from a torn epoch.
  if (!mechanical_complete_proposal_admitted()) { return; }
  let proposal_row = ${SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS / 4}u
    + particle_index * 2u;
  let dx = proposal_rows[proposal_row].xyz;
  let dv = proposal_rows[proposal_row + 1u].xyz;
  if (dot(dx, dx) == 0.0 && dot(dv, dv) == 0.0) { return; }
  let pos_mass = output_state[particle_index * 2u];
  let vel_u = output_state[particle_index * 2u + 1u];
  var position = pos_mass.xyz + dx;
  var velocity = vel_u.xyz + dv;
  let rest_volume = max(source_mechanics[particle_index * 8u + 4u].w, 0.0);
  var wall_clearance = 0.0;
  if (rest_volume > 0.0) {
    wall_clearance = 0.5 * mechanical_apply_cbrt(rest_volume);
    if (mechanical_params.grid_spacing_m > 0.0) {
      wall_clearance = min(wall_clearance, 0.5 * mechanical_params.grid_spacing_m);
    }
    let min_dimension = min(
      mechanical_params.box_dims_m.x,
      min(mechanical_params.box_dims_m.y, mechanical_params.box_dims_m.z)
    );
    if (min_dimension > 0.0) {
      wall_clearance = min(wall_clearance, 0.49 * min_dimension);
    }
  }
  let upper = max(vec3<f32>(wall_clearance), mechanical_params.box_dims_m - vec3<f32>(wall_clearance));
  if (position.x < wall_clearance) { position.x = wall_clearance; if (velocity.x < 0.0) { velocity.x = 0.0; } }
  if (position.x > upper.x) { position.x = upper.x; if (velocity.x > 0.0) { velocity.x = 0.0; } }
  if (position.y < wall_clearance) { position.y = wall_clearance; if (velocity.y < 0.0) { velocity.y = 0.0; } }
  if (position.y > upper.y) { position.y = upper.y; if (velocity.y > 0.0) { velocity.y = 0.0; } }
  if (position.z < wall_clearance) { position.z = wall_clearance; if (velocity.z < 0.0) { velocity.z = 0.0; } }
  if (position.z > upper.z) { position.z = upper.z; if (velocity.z > 0.0) { velocity.z = 0.0; } }
  output_state[particle_index * 2u] = vec4<f32>(position, pos_mass.w);
  output_state[particle_index * 2u + 1u] = vec4<f32>(velocity, vel_u.w);
}
`;

function createBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: Math.max(4, size),
    usage
  }), device);
}

function powerOfTwoCapacity(value) {
  let capacity = 1;
  while (capacity < value) capacity *= 2;
  return capacity;
}

function destroyMechanicalProposalPoolSlot(slot) {
  if (!slot || slot.destroyed === true) return false;
  for (const buffer of [
    slot.proposalBuffer,
    slot.evidenceBuffer,
    slot.supportBuffer,
    slot.expectationBuffer,
    slot.paramsBuffer,
    slot.identityDisabledBuffer
  ]) buffer?.destroy?.();
  slot.destroyed = true;
  slot.inUseGenerationId = null;
  slot.generation = null;
  return true;
}

function mechanicalProposalPoolSlot(
  device,
  particleCount,
  arenaIndex = 0,
  generation = null
) {
  let devicePools = mechanicalProposalPools.get(device);
  if (!devicePools) {
    devicePools = new Map();
    mechanicalProposalPools.set(device, devicePools);
  }
  const capacity = powerOfTwoCapacity(particleCount);
  const exactArenaIndex = exactU32(
    Math.max(0, Math.trunc(finiteNumber(arenaIndex, 0))),
    'generation.execution.arenaIndex'
  );
  const key = String(exactArenaIndex);
  let slot = devicePools.get(key);
  if (slot?.inUseGenerationId != null) {
    throw new Error(
      `mechanical proposal arena ${exactArenaIndex} is still leased by generation ${slot.inUseGenerationId}`
    );
  }
  const cacheHit = Boolean(
    slot
    && slot.destroyed !== true
    && slot.capacity >= capacity
  );
  const priorAllocationCount = slot?.totalBufferCreationCount ?? 0;
  if (!cacheHit) {
    destroyMechanicalProposalPoolSlot(slot);
    slot = {
    arenaIndex: exactArenaIndex,
    capacity,
    proposalBuffer: createBuffer(
      device,
      `ulg-schroeder-spatial-mechanical-contact-separation-proposals-${key}`,
      MECHANICAL_PROPOSAL_HEADER_BYTES + capacity * MECHANICAL_PROPOSAL_ROW_BYTES,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    ),
    evidenceBuffer: createBuffer(
      device,
      `ulg-schroeder-spatial-mechanical-consumer-evidence-${key}`,
      SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    ),
    supportBuffer: createBuffer(
      device,
      `ulg-schroeder-spatial-mechanical-global-support-bound-${key}`,
      Uint32Array.BYTES_PER_ELEMENT,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    ),
    expectationBuffer: createBuffer(
      device,
      `ulg-schroeder-spatial-mechanical-expectation-${key}`,
      EXPECTATION_BYTES,
      GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    ),
    paramsBuffer: createBuffer(
      device,
      `ulg-schroeder-spatial-mechanical-params-${key}`,
      MECHANICAL_PARAMS_BYTES,
      GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    ),
    identityDisabledBuffer: createBuffer(
      device,
      `ulg-schroeder-spatial-mechanical-identity-disabled-${key}`,
      capacity * Uint32Array.BYTES_PER_ELEMENT,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    ),
    destroyed: false,
    inUseGenerationId: null,
    generation: null,
    releaseScheduled: false,
    totalBufferCreationCount: priorAllocationCount + 6,
    acquisitionCount: 0
    };
    devicePools.set(key, slot);
  }
  slot.inUseGenerationId = generation?.execution?.generationId ?? null;
  slot.generation = generation;
  slot.releaseScheduled = false;
  slot.acquisitionCount += 1;
  return { slot, cacheHit };
}

export function destroySchroederSpatialMechanicalProposalRuntime(device) {
  const devicePools = mechanicalProposalPools.get(device);
  if (!devicePools) return false;
  for (const slot of devicePools.values()) destroyMechanicalProposalPoolSlot(slot);
  devicePools.clear();
  mechanicalProposalPools.delete(device);
  return true;
}

export function runSchroederSpatialMechanicalProposalWebGpu({
  device,
  generation,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload,
  mlsMpmParticleUpload,
  boxDimsM = [5, 5, 5],
  gridSpacingM = sphParticleState?.smoothingLengthM ?? 0,
  relaxation = mlsMpmParticleState?.particleSeparationRelaxation ?? 0.35,
  normalVelocityDamping =
    mlsMpmParticleState?.particleSeparationVelocityDamping ?? 0.25
} = {}) {
  const particleCount = Math.max(0, Math.trunc(finiteNumber(
    sphParticleState?.particleCount ?? mlsMpmParticleState?.particleCount,
    0
  )));
  if (particleCount < 1 || particleCount !== mlsMpmParticleState?.particleCount) {
    throw new RangeError('canonical mechanical proposals require matching positive particle counts');
  }
  const authority = resolveMechanicalSpatialAuthority({
    device,
    generation,
    sphParticleUpload,
    mlsMpmParticleUpload,
    particleCount
  });
  const consumerAuthentications = SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS.map(
    ({ consumerId, supportProfileId }) => {
      const authentication = resolveSchroederSpatialExactNearConsumerGeneration(
        generation,
        {
          device,
          runtime: generation.runtime,
          consumerId,
          supportProfileId,
          sourceBuffer: authority.source.sourceBuffer
            ?? authority.source.activeNodeBuffer
        }
      );
      if (authentication?.ready !== true || authentication.authenticated !== true) {
        const error = new Error(
          authentication?.reason
          || `Canonical spatial mechanical consumer ${consumerId} was not authenticated`
        );
        error.code = 'ERR_SCHROEDER_SPATIAL_MECHANICAL_AUTHENTICATION';
        throw error;
      }
      return authentication;
    }
  );
  const contactAuthentication = consumerAuthentications[0];
  const poolAcquisition = mechanicalProposalPoolSlot(
    device,
    particleCount,
    authority.execution.arenaIndex,
    generation
  );
  const pool = poolAcquisition.slot;
  const localIdentityBuffer = authority.identityBuffer
    ? null
    : pool.identityDisabledBuffer;
  const identityBuffer = authority.identityBuffer || localIdentityBuffer;
  const proposalBuffer = pool.proposalBuffer;
  const evidenceInitial = new Uint32Array(SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS);
  evidenceInitial[8] = MECHANICAL_EVIDENCE_MAGIC;
  evidenceInitial[9] = SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1;
  evidenceInitial[10] = authority.execution.generationId;
  evidenceInitial[11] = authority.execution.supportEpoch;
  evidenceInitial[12] = 1;
  evidenceInitial[13] = SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS.length;
  evidenceInitial[17] = authority.execution.positionEpoch;
  evidenceInitial[18] = authority.execution.topologyEpoch;
  evidenceInitial[19] = authority.execution.storageGeneration;
  const evidenceBuffer = pool.evidenceBuffer;
  const supportBuffer = pool.supportBuffer;
  const expectationBuffer = pool.expectationBuffer;
  const paramsBuffer = pool.paramsBuffer;
  device.queue.writeBuffer(
    expectationBuffer,
    0,
    contactAuthentication.expectationData
  );
  device.queue.writeBuffer(paramsBuffer, 0, createMechanicalParamsArray({
    particleCount,
    relaxation,
    normalVelocityDamping,
    gridSpacingM,
    boxDimsM,
    identityEnabled: Boolean(authority.identityBuffer),
    execution: authority.execution
  }));
  device.queue.writeBuffer(evidenceBuffer, 0, evidenceInitial);
  device.queue.writeBuffer(
    proposalBuffer,
    0,
    createMechanicalProposalHeader(authority.execution, particleCount)
  );

  const commonBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'storage'),
    computeBufferBinding(7, 'uniform'),
    computeBufferBinding(8, 'uniform'),
    computeBufferBinding(9, 'storage')
  ];
  const reductionPipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-schroeder-spatial-mechanical-support-reduction.v1',
    label: 'ulg-schroeder-spatial-mechanical-support-reduction',
    code: schroederSpatialMechanicalProposalWgsl,
    entryPoint: 'reduce_support',
    bindings: commonBindings
  });
  const proposalPipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-schroeder-spatial-mechanical-proposal.v1',
    label: 'ulg-schroeder-spatial-mechanical-proposal',
    code: schroederSpatialMechanicalProposalWgsl,
    entryPoint: 'propose',
    bindings: commonBindings
  });
  const applyPipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-schroeder-spatial-mechanical-proposal-apply.v1',
    label: 'ulg-schroeder-spatial-mechanical-proposal-apply',
    code: schroederSpatialMechanicalProposalApplyWgsl,
    entryPoint: 'apply',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform'),
      computeBufferBinding(4, 'storage')
    ]
  });
  const entries = [
    { binding: 0, resource: { buffer: authority.stateBuffer } },
    { binding: 1, resource: { buffer: authority.thermoBuffer } },
    { binding: 2, resource: { buffer: authority.mechanicsBuffer } },
    { binding: 3, resource: { buffer: identityBuffer } },
    { binding: 4, resource: { buffer: authority.directoryBuffer } },
    { binding: 5, resource: { buffer: proposalBuffer } },
    { binding: 6, resource: { buffer: evidenceBuffer } },
    { binding: 7, resource: { buffer: expectationBuffer } },
    { binding: 8, resource: { buffer: paramsBuffer } },
    { binding: 9, resource: { buffer: supportBuffer } }
  ];
  const reductionBindGroup = device.createBindGroup({
    layout: reductionPipeline.bindGroupLayout,
    entries
  });
  const proposalBindGroup = device.createBindGroup({
    layout: proposalPipeline.bindGroupLayout,
    entries
  });
  const encoder = device.createCommandEncoder({
    label: 'ulg-schroeder-spatial-mechanical-proposal'
  });
  encoder.clearBuffer(supportBuffer);
  encoder.clearBuffer(
    proposalBuffer,
    MECHANICAL_PROPOSAL_HEADER_BYTES,
    particleCount * MECHANICAL_PROPOSAL_ROW_BYTES
  );
  const workgroups = Math.max(1, Math.ceil(particleCount / WORKGROUP_SIZE));
  const reductionPass = encoder.beginComputePass({
    label: 'ulg-schroeder-spatial-mechanical-support-reduction'
  });
  reductionPass.setPipeline(reductionPipeline.pipeline);
  reductionPass.setBindGroup(0, reductionBindGroup);
  reductionPass.dispatchWorkgroups(workgroups);
  reductionPass.end();
  const proposalPass = encoder.beginComputePass({
    label: 'ulg-schroeder-spatial-mechanical-proposal'
  });
  proposalPass.setPipeline(proposalPipeline.pipeline);
  proposalPass.setBindGroup(0, proposalBindGroup);
  proposalPass.dispatchWorkgroups(workgroups);
  proposalPass.end();
  device.queue.submit([encoder.finish()]);

  // The mechanical traversal deliberately shares one complete superset walk
  // across contact, excluded-volume separation, and the local material
  // interface law. Each consumer still receives a distinct runtime-issued
  // receipt with its own immutable support-profile identity. The proposal
  // shader fail-closes application from its resident evidence buffer; no host
  // readback is needed to make that decision.
  const consumerReceipts = Object.freeze(Object.fromEntries(
    consumerAuthentications.map((authentication) => {
      const receipt = finalizeSchroederSpatialExactNearConsumerReceipt(
        authentication,
        Object.freeze({
          schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA,
          status: 'schroeder-spatial-exact-near-gpu-authenticated',
          gpuAuthenticated: true,
          consumerId: authentication.consumerId,
          supportProfileId: authentication.supportProfileId,
          generationId: authentication.generationId,
          epochIdentity: authentication.epochIdentity,
          traversalCount: 1,
          candidateVisitCount: 0,
          consumerMaskHitCount: 0,
          migratedProposalCount: particleCount,
          candidateBytesRequired: 0,
          candidateBytesAdmitted: 0,
          candidateBytesCapacity: 0,
          candidateOverflowBytes: 0,
          privateLookupBuildCount: 0,
          fixedCandidateBuildCount: 0,
          exhaustiveTraversalCount: 0,
          overflowed: false,
          partialPublication: false,
          fallbackObserved: false,
          fullReadbackPerformed: false
        })
      );
      return [authentication.consumerId, receipt];
    })
  ));

  let released = false;
  let releaseScheduled = false;
  const releaseLease = () => {
    if (released) return false;
    released = true;
    if (pool.inUseGenerationId === authority.execution.generationId) {
      pool.inUseGenerationId = null;
      pool.generation = null;
      pool.releaseScheduled = false;
    }
    return true;
  };
  const releaseAfterSubmittedWork = () => {
    if (releaseScheduled || released) return false;
    releaseScheduled = true;
    pool.releaseScheduled = true;
    deferSubmittedWorkCleanup(device, releaseLease);
    return true;
  };
  const artifact = {
    schema: ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_SCHEMA,
    status: 'schroeder-spatial-mechanical-proposal-submitted',
    ready: true,
    backend: 'webgpu',
    particleCount,
    generation,
    generationId: authority.execution.generationId,
    arenaIndex: authority.execution.arenaIndex ?? 0,
    proposalCapacity: pool.capacity,
    proposalPoolCacheHit: poolAcquisition.cacheHit,
    proposalPoolAllocationCount: pool.totalBufferCreationCount,
    proposalPoolAcquisitionCount: pool.acquisitionCount,
    supportEpoch: authority.execution.supportEpoch,
    sourcePositionAuthority: 'same-epoch-pre-integration-particle-state',
    supportProfiles: SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS,
    multiConsumerTraversal: true,
    traversalCount: 1,
    consumerAuthentications: Object.freeze([...consumerAuthentications]),
    consumerReceipts,
    consumerReceipt(consumerId) {
      return consumerReceipts[consumerId] ?? null;
    },
    proposalBuffer,
    proposalBufferSchema: ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_BUFFER_SCHEMA,
    proposalHeaderWords: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS,
    proposalHeaderLayout: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_LAYOUT,
    proposalRowByteOffset: MECHANICAL_PROPOSAL_HEADER_BYTES,
    proposalRowWords: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS,
    proposalRowStrideFloats: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_FLOATS,
    proposalBufferByteLength:
      MECHANICAL_PROPOSAL_HEADER_BYTES + particleCount * MECHANICAL_PROPOSAL_ROW_BYTES,
    evidence: Object.freeze({
      schema: ULG_SCHROEDER_SPATIAL_CONSUMER_GPU_EVIDENCE_SCHEMA,
      status: 'gpu-authenticated-traversal-submitted',
      buffer: evidenceBuffer,
      wordCount: SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS,
      layout: SCHROEDER_SPATIAL_MECHANICAL_EVIDENCE_LAYOUT,
      generationId: authority.execution.generationId,
      supportEpoch: authority.execution.supportEpoch,
      supportProfileIds: SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS.map(
        ({ supportProfileId }) => supportProfileId
      ),
      traversalCount: 1,
      privateBuildCount: 0,
      exhaustiveTraversalCount: 0,
      fixedCandidateBuildCount: 0,
      fullParticleReadbackPerformed: false
    }),
    directoryBuildCount: 0,
    sharedGenerationDirectoryBuildCount: 1,
    privateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    fixedCandidateBuildCount: 0,
    candidateBudget: null,
    fullParticleReadbackPerformed: false,
    readbackMode: 'no-full-readback',
    bufferOwnership: 'device-arena-runtime-cache',
    ownsProposalBuffer: false,
    ownsEvidenceBuffer: false,
    encodeApply(encoder, {
      stateBuffer,
      mechanicsBuffer = authority.mechanicsBuffer
    } = {}) {
      if (released || releaseScheduled) {
        throw new Error('mechanical proposal cannot apply after arena release begins');
      }
      requireBuffer(device, stateBuffer, 'mechanical proposal apply stateBuffer');
      requireBuffer(device, mechanicsBuffer, 'mechanical proposal apply mechanicsBuffer');
      const bindGroup = device.createBindGroup({
        layout: applyPipeline.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: proposalBuffer } },
          { binding: 1, resource: { buffer: mechanicsBuffer } },
          { binding: 2, resource: { buffer: stateBuffer } },
          { binding: 3, resource: { buffer: paramsBuffer } },
          { binding: 4, resource: { buffer: evidenceBuffer } }
        ]
      });
      const pass = encoder.beginComputePass({
        label: 'ulg-schroeder-spatial-mechanical-proposal-apply'
      });
      pass.setPipeline(applyPipeline.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.max(1, Math.ceil(particleCount / WORKGROUP_SIZE)));
      pass.end();
      return true;
    },
    cleanupTemporaryBuffersAfterSubmittedWork() {
      return false;
    },
    releaseAfterSubmittedWork,
    destroy: releaseAfterSubmittedWork,
    get released() { return released; },
    get releaseScheduled() { return releaseScheduled; }
  };
  Object.freeze(artifact);
  liveMechanicalProposalArtifacts.add(artifact);
  return artifact;
}

export function isLiveSchroederSpatialMechanicalProposal(
  proposal,
  { device = null, generation = null } = {}
) {
  return Boolean(
    proposal
    && liveMechanicalProposalArtifacts.has(proposal)
    && Object.isFrozen(proposal)
    && proposal.schema === ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_SCHEMA
    && proposal.status === 'schroeder-spatial-mechanical-proposal-submitted'
    && proposal.ready === true
    && proposal.released !== true
    && proposal.releaseScheduled !== true
    && proposal.generation === generation
    && proposal.generationId === generation?.execution?.generationId
    && proposal.supportEpoch === generation?.execution?.supportEpoch
    && proposal.traversalCount === 1
    && proposal.privateBuildCount === 0
    && proposal.fixedCandidateBuildCount === 0
    && proposal.exhaustiveTraversalCount === 0
    && proposal.fullParticleReadbackPerformed === false
    && webGpuBufferMatchesDevice(proposal.proposalBuffer, device)
    && webGpuBufferMatchesDevice(proposal.evidence?.buffer, device)
  );
}
