import {
  SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_BYTES,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1,
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  createSchroederSpatialExactNearTraversalV1Wgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNearTraversalWgsl.js';
import {
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import {
  finalizeSchroederSpatialExactNearConsumerReceipt,
  isFinalizedSchroederSpatialExactNearConsumerReceipt,
  resolveSchroederSpatialExactNearConsumerGeneration
} from './schroederSpatialEpochGpu.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice
} from './sphGpuDeviceIdentity.js';

export const ULG_SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_SCHEMA =
  'peercompute.ulg.schroeder-spatial-reaction-discovery-proposal.v1';
export const SCHROEDER_SPATIAL_REACTION_DISCOVERY_CONSUMER_ID =
  'reaction-discovery';
export const SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_ROW_LAYOUT =
  Object.freeze([
    'partnerParticleIndex:f32',
    'reactionIndex:f32',
    'reactantRole:f32',
    'distanceSquaredM2:f32'
  ]);
export const SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_ROW_FLOATS = 4;
export const SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_WORDS = 16;
export const SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_LAYOUT =
  Object.freeze([
    'sourceDispatchCount:u32',
    'directoryAdmissionCount:u32',
    'directoryRejectionCount:u32',
    'candidateVisitCount:u32',
    'compatiblePairCount:u32',
    'malformedTraversalCount:u32',
    'proposalCount:u32',
    'sealedRowCount:u32',
    'sourceIdentityRejectionCount:u32',
    'supportProfileId:u32',
    'generationId:u32',
    'supportEpoch:u32',
    'particleCount:u32',
    'reactionCount:u32',
    'privateLookupBuildCount:u32',
    'overflowCount:u32'
  ]);

const WORKGROUP_SIZE = 64;
const REACTION_RECORD_VEC4S = 3;
const REACTION_RECORD_FLOATS = REACTION_RECORD_VEC4S * 4;
const MAX_EXACT_F32_INTEGER = 0x00ff_ffff;
const PARAMS_BYTES = 32;
const reactionDiscoveryArenaCaches = new WeakMap();

const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

function exactPositiveU32(value, label, max = 0xffff_ffff) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < 1
    || value > max
  ) {
    throw new RangeError(`${label} must be an integer in [1, ${max}]`);
  }
  return value;
}

function finitePositive(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number`);
  }
  return value;
}

function requireBuffer(device, buffer, label) {
  if (!buffer || !webGpuBufferMatchesDevice(buffer, device)) {
    throw new TypeError(`${label} must be a live buffer on the canonical generation device`);
  }
  return buffer;
}

function requireMinimumBufferBytes(buffer, byteLength, label) {
  if (
    Number.isFinite(Number(buffer?.size))
    && Number(buffer.size) < byteLength
  ) {
    throw new RangeError(`${label} has ${buffer.size} bytes; ${byteLength} required`);
  }
  return buffer;
}

function requireStorageCapacity(device, byteLength, label) {
  if (!Number.isSafeInteger(byteLength) || byteLength < 4) {
    throw new RangeError(`${label} byte length is not safely addressable`);
  }
  const limits = [
    Number(device?.limits?.maxBufferSize),
    Number(device?.limits?.maxStorageBufferBindingSize)
  ].filter((value) => Number.isFinite(value) && value > 0);
  const limit = limits.length > 0 ? Math.min(...limits) : Number.MAX_SAFE_INTEGER;
  if (byteLength > limit) {
    throw new RangeError(`${label} requires ${byteLength} bytes; device limit is ${limit}`);
  }
  return byteLength;
}

function createBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: Math.max(4, size),
    usage
  }), device);
}

function powerOfTwoByteCapacity(requiredBytes) {
  let capacity = 4;
  while (capacity < requiredBytes) capacity *= 2;
  return capacity;
}

function arenaCacheForDevice(device) {
  let cache = reactionDiscoveryArenaCaches.get(device);
  if (!cache) {
    cache = new Map();
    reactionDiscoveryArenaCaches.set(device, cache);
  }
  return cache;
}

function destroyArenaEntry(entry) {
  entry.proposalBuffer?.destroy?.();
  entry.evidenceBuffer?.destroy?.();
  entry.expectationBuffer?.destroy?.();
  entry.paramsBuffer?.destroy?.();
  entry.reactionRecordBuffer?.destroy?.();
  entry.destroyed = true;
}

function acquireReactionDiscoveryArenaResources({
  device,
  generation,
  proposalBytes,
  localReactionRecordBytes
}) {
  const arenaIndex = generation?.execution?.arenaIndex;
  if (!Number.isInteger(arenaIndex) || arenaIndex < 0) {
    throw new TypeError('reaction discovery requires a canonical generation arena index');
  }
  const cache = arenaCacheForDevice(device);
  let entry = cache.get(arenaIndex) || null;
  if (entry?.inUse === true) {
    if (entry.generation?.execution?.released === true) {
      entry.inUse = false;
      entry.generation = null;
    } else {
      throw new Error(
        `reaction discovery arena ${arenaIndex} is already leased by generation ${entry.generationId}`
      );
    }
  }
  if (
    entry?.inUse === false
    && entry.generation
    && entry.generation.execution?.released !== true
  ) {
    throw new Error(
      `reaction discovery arena ${arenaIndex} remains quarantined by live generation ${entry.generationId}`
    );
  }
  let bufferCreationCount = 0;
  if (!entry || entry.destroyed === true) {
    entry = {
      arenaIndex,
      proposalBuffer: null,
      proposalCapacityBytes: 0,
      evidenceBuffer: null,
      expectationBuffer: null,
      paramsBuffer: null,
      reactionRecordBuffer: null,
      reactionRecordCapacityBytes: 0,
      generation: null,
      generationId: null,
      inUse: false,
      destroyed: false,
      totalBufferCreationCount: 0,
      acquisitionCount: 0
    };
    cache.set(arenaIndex, entry);
  }
  if (entry.proposalCapacityBytes < proposalBytes) {
    entry.proposalBuffer?.destroy?.();
    entry.proposalCapacityBytes = powerOfTwoByteCapacity(proposalBytes);
    requireStorageCapacity(
      device,
      entry.proposalCapacityBytes,
      'reaction discovery cached proposal buffer'
    );
    entry.proposalBuffer = createBuffer(
      device,
      `ulg-schroeder-spatial-reaction-discovery-proposals-arena-${arenaIndex}`,
      entry.proposalCapacityBytes,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
    );
    bufferCreationCount += 1;
  }
  if (!entry.evidenceBuffer) {
    entry.evidenceBuffer = createBuffer(
      device,
      `ulg-schroeder-spatial-reaction-discovery-evidence-arena-${arenaIndex}`,
      SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_WORDS
        * Uint32Array.BYTES_PER_ELEMENT,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    );
    bufferCreationCount += 1;
  }
  if (!entry.expectationBuffer) {
    entry.expectationBuffer = createBuffer(
      device,
      `ulg-schroeder-spatial-reaction-discovery-expectation-arena-${arenaIndex}`,
      SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_BYTES,
      GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    );
    bufferCreationCount += 1;
  }
  if (!entry.paramsBuffer) {
    entry.paramsBuffer = createBuffer(
      device,
      `ulg-schroeder-spatial-reaction-discovery-params-arena-${arenaIndex}`,
      PARAMS_BYTES,
      GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    );
    bufferCreationCount += 1;
  }
  if (
    localReactionRecordBytes > 0
    && entry.reactionRecordCapacityBytes < localReactionRecordBytes
  ) {
    entry.reactionRecordBuffer?.destroy?.();
    entry.reactionRecordCapacityBytes = powerOfTwoByteCapacity(
      localReactionRecordBytes
    );
    requireStorageCapacity(
      device,
      entry.reactionRecordCapacityBytes,
      'reaction discovery cached reaction record buffer'
    );
    entry.reactionRecordBuffer = createBuffer(
      device,
      `ulg-schroeder-spatial-reaction-discovery-records-arena-${arenaIndex}`,
      entry.reactionRecordCapacityBytes,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    );
    bufferCreationCount += 1;
  }
  const lease = Object.freeze({
    arenaIndex,
    generationId: generation.execution.generationId,
    acquisitionOrdinal: entry.acquisitionCount + 1
  });
  entry.acquisitionCount += 1;
  entry.totalBufferCreationCount += bufferCreationCount;
  entry.inUse = true;
  entry.generation = generation;
  entry.generationId = generation.execution.generationId;
  entry.lease = lease;
  return { entry, lease, bufferCreationCount };
}

function releaseReactionDiscoveryArenaResources(entry, lease) {
  if (!entry || entry.lease !== lease || entry.inUse !== true) return false;
  entry.inUse = false;
  entry.lease = null;
  return true;
}

/** Destroy idle per-arena buffers, normally only when the owning device exits. */
export function destroySchroederSpatialReactionDiscoveryProposalCache(device) {
  const cache = reactionDiscoveryArenaCaches.get(device);
  if (!cache) return false;
  for (const entry of cache.values()) {
    if (entry.generation && entry.generation.execution?.released !== true) {
      throw new Error(
        `cannot destroy live reaction discovery arena ${entry.arenaIndex}`
      );
    }
  }
  for (const entry of cache.values()) destroyArenaEntry(entry);
  cache.clear();
  reactionDiscoveryArenaCaches.delete(device);
  return true;
}

/**
 * Validate the narrow handoff consumed by the canonical reaction resolver.
 * Receipt authenticity, generation identity, device ownership, row shape, and
 * live buffer capacity are all checked here so the chemistry kernel need not
 * duplicate spatial-control-plane rules.
 */
export function resolveSchroederSpatialReactionDiscoveryProposalForConsumer(
  proposal,
  {
    device,
    generation,
    particleCount = generation?.source?.sourceCount,
    reactionCount = proposal?.reactionCount
  } = {}
) {
  const reject = (status, reason) => Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_SCHEMA,
    status,
    reason,
    ready: false,
    admitted: false
  });
  if (
    proposal?.schema !== ULG_SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_SCHEMA
    || proposal.ready !== true
    || proposal.released === true
  ) {
    return reject(
      'schroeder-spatial-reaction-discovery-proposal-rejected-contract',
      'reaction discovery proposal is not a live submitted v1 artifact'
    );
  }
  if (
    proposal.consumerId !== SCHROEDER_SPATIAL_REACTION_DISCOVERY_CONSUMER_ID
    || proposal.supportProfileId
      !== SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1
    || proposal.proposalRowStrideFloats
      !== SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_ROW_FLOATS
    || proposal.traversalCount !== 1
    || proposal.privateLookupBuildCount !== 0
    || proposal.fixedCandidateBuildCount !== 0
    || proposal.exhaustiveTraversalCount !== 0
    || proposal.candidateBudget !== null
    || proposal.fullReadbackPerformed !== false
  ) {
    return reject(
      'schroeder-spatial-reaction-discovery-proposal-rejected-invariants',
      'reaction discovery proposal violates the exact-near residency contract'
    );
  }
  if (
    proposal.generation !== generation
    || proposal.generationId !== generation?.execution?.generationId
    || generation?.execution?.released === true
    || generation?.releaseScheduled === true
  ) {
    return reject(
      'schroeder-spatial-reaction-discovery-proposal-rejected-generation',
      'reaction discovery proposal is not bound to the live consumer generation'
    );
  }
  if (
    proposal.particleCount !== particleCount
    || proposal.reactionCount !== reactionCount
  ) {
    return reject(
      'schroeder-spatial-reaction-discovery-proposal-rejected-count',
      'reaction discovery proposal count does not match the chemistry consumer'
    );
  }
  if (!isFinalizedSchroederSpatialExactNearConsumerReceipt(proposal.receipt)) {
    return reject(
      'schroeder-spatial-reaction-discovery-proposal-rejected-receipt',
      'reaction discovery proposal lacks an authentic finalized consumer receipt'
    );
  }
  if (
    proposal.receipt.consumerId !== proposal.consumerId
    || proposal.receipt.supportProfileId !== proposal.supportProfileId
    || proposal.receipt.generationId !== proposal.generationId
  ) {
    return reject(
      'schroeder-spatial-reaction-discovery-proposal-rejected-receipt-identity',
      'reaction discovery receipt identity does not match the artifact'
    );
  }
  if (
    !proposal.proposalBuffer
    || !proposal.evidenceBuffer
    || !proposal.reactionRecordBuffer
    || !webGpuBufferMatchesDevice(proposal.proposalBuffer, device)
    || !webGpuBufferMatchesDevice(proposal.evidenceBuffer, device)
    || !webGpuBufferMatchesDevice(proposal.reactionRecordBuffer, device)
  ) {
    return reject(
      'schroeder-spatial-reaction-discovery-proposal-rejected-device',
      'reaction discovery buffers do not belong to the consumer device'
    );
  }
  const requiredProposalBytes = particleCount
    * SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_ROW_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  if (
    proposal.proposalBufferByteLength !== requiredProposalBytes
    || (
      Number.isFinite(Number(proposal.proposalBuffer.size))
      && Number(proposal.proposalBuffer.size) < requiredProposalBytes
    )
  ) {
    return reject(
      'schroeder-spatial-reaction-discovery-proposal-rejected-capacity',
      'reaction discovery proposal buffer is smaller than its authenticated row set'
    );
  }
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_SCHEMA,
    status: 'schroeder-spatial-reaction-discovery-proposal-admitted',
    reason: null,
    ready: true,
    admitted: true,
    proposalBuffer: proposal.proposalBuffer,
    evidenceBuffer: proposal.evidenceBuffer,
    reactionRecordBuffer: proposal.reactionRecordBuffer,
    particleCount,
    reactionCount,
    generationId: proposal.generationId,
    epochIdentity: proposal.epochIdentity,
    receipt: proposal.receipt
  });
}

function reactionRecordArray(reactionTable) {
  if (reactionTable?.schema !== ULG_SPH_GPU_REACTION_TABLE_SCHEMA) {
    throw new TypeError('canonical reaction discovery requires a packed SPH reaction table');
  }
  const reactionCount = exactPositiveU32(
    reactionTable.reactionCount,
    'reactionTable.reactionCount',
    MAX_EXACT_F32_INTEGER
  );
  if (!(reactionTable.records instanceof Float32Array)) {
    throw new TypeError('reactionTable.records must be a Float32Array');
  }
  const requiredFloats = reactionCount * REACTION_RECORD_FLOATS;
  if (reactionTable.records.length < requiredFloats) {
    throw new RangeError(
      `reactionTable.records has ${reactionTable.records.length} floats; ${requiredFloats} required`
    );
  }
  const combined = reactionTable.combinedRecords instanceof Float32Array
    ? reactionTable.combinedRecords
    : reactionTable.records;
  if (combined.length < requiredFloats) {
    throw new RangeError('reaction table combined records do not contain every reaction header');
  }
  return { reactionCount, combined };
}

/**
 * The discovery traversal needs one complete broad-phase envelope. Contact
 * radii are immutable reaction-table data, so reducing them on the host does
 * not inspect particle state or introduce a spatial fallback/readback.
 */
export function maxReactionContactRadiusM(reactionTable) {
  const { reactionCount } = reactionRecordArray(reactionTable);
  let maximum = 0;
  for (let reactionIndex = 0; reactionIndex < reactionCount; reactionIndex += 1) {
    const offset = reactionIndex * REACTION_RECORD_FLOATS;
    const status = reactionTable.records[offset + 8];
    const radius = reactionTable.records[offset + 5];
    if (Math.round(status) !== 1 || !Number.isFinite(radius) || radius <= 0) continue;
    maximum = Math.max(maximum, Math.fround(radius));
  }
  return maximum;
}

function createParamsArray({
  particleCount,
  reactionCount,
  maximumContactRadiusM
}) {
  const data = new ArrayBuffer(PARAMS_BYTES);
  const view = new DataView(data);
  view.setUint32(0, exactPositiveU32(
    particleCount,
    'particleCount',
    MAX_EXACT_F32_INTEGER
  ), true);
  view.setUint32(4, exactPositiveU32(
    reactionCount,
    'reactionCount',
    MAX_EXACT_F32_INTEGER
  ), true);
  view.setUint32(8, REACTION_RECORD_VEC4S, true);
  view.setUint32(12, SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1, true);
  view.setFloat32(16, maximumContactRadiusM > 0
    ? finitePositive(maximumContactRadiusM, 'maximumContactRadiusM')
    : 0, true);
  view.setUint32(20, 16, true);
  view.setUint32(24, 3, true);
  view.setUint32(28, 2, true);
  return data;
}

const exactNearTraversalWgsl = createSchroederSpatialExactNearTraversalV1Wgsl({
  directoryBindingName: 'spatial_directory'
});

export const schroederSpatialReactionDiscoveryProposalWgsl = /* wgsl */ `
struct ReactionDiscoveryParams {
  particle_count: u32,
  reaction_count: u32,
  reaction_record_stride_vec4s: u32,
  support_profile_id: u32,
  maximum_contact_radius_m: f32,
  active_node_stride_floats: u32,
  thermo_stride_vec4s: u32,
  state_stride_vec4s: u32,
};

@group(0) @binding(0) var<storage, read> active_node_rows: array<f32>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(5) var<storage, read_write> reaction_proposals: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> traversal_evidence: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> spatial_expectation: SchroederSpatialExactNearExpectationV1;
@group(0) @binding(8) var<uniform> params: ReactionDiscoveryParams;

${exactNearTraversalWgsl}

const REACTION_DISCOVERY_INVALID_INDEX: f32 = -1.0;
const REACTION_DISCOVERY_MAX_F32: f32 = 3.402823e38;

fn reaction_discovery_invalid_proposal() -> vec4<f32> {
  return vec4<f32>(
    REACTION_DISCOVERY_INVALID_INDEX,
    REACTION_DISCOVERY_INVALID_INDEX,
    0.0,
    REACTION_DISCOVERY_MAX_F32
  );
}

fn reaction_discovery_increment_counter(counter_index: u32) {
  let previous = atomicAdd(&traversal_evidence[counter_index], 1u);
  if (previous == 0xffffffffu) {
    atomicStore(&traversal_evidence[15u], 1u);
  }
}

fn reaction_discovery_source_row_admitted(source_index: u32) -> bool {
  let offset = source_index * params.active_node_stride_floats;
  if (offset > arrayLength(&active_node_rows)
      || params.active_node_stride_floats > arrayLength(&active_node_rows) - offset) {
    return false;
  }
  let row_source = active_node_rows[offset + 10u];
  let status = active_node_rows[offset + 11u];
  let position = vec3<f32>(
    active_node_rows[offset + 12u],
    active_node_rows[offset + 13u],
    active_node_rows[offset + 14u]
  );
  return row_source == f32(source_index)
    && status > 0.0
    && status < 32.0
    && all(vec3<bool>(
      ss_exact_near_finite(position.x),
      ss_exact_near_finite(position.y),
      ss_exact_near_finite(position.z)
    ));
}

fn reaction_discovery_position(source_index: u32) -> vec3<f32> {
  let offset = source_index * params.active_node_stride_floats;
  return vec3<f32>(
    active_node_rows[offset + 12u],
    active_node_rows[offset + 13u],
    active_node_rows[offset + 14u]
  );
}

fn reaction_discovery_thermo0(source_index: u32) -> vec4<f32> {
  return source_thermo[source_index * params.thermo_stride_vec4s];
}

fn reaction_discovery_mass(source_index: u32) -> f32 {
  return source_state[source_index * params.state_stride_vec4s].w;
}

fn reaction_discovery_consider_pair(
  self_index: u32,
  other_index: u32,
  self_material: f32,
  self_position: vec3<f32>,
  best: ptr<function, vec4<f32>>
) {
  if (other_index == self_index || other_index >= params.particle_count) {
    return;
  }
  reaction_discovery_increment_counter(3u);
  if (!reaction_discovery_source_row_admitted(other_index)) {
    atomicAdd(&traversal_evidence[8u], 1u);
    return;
  }
  if (reaction_discovery_mass(other_index) <= 0.0) {
    return;
  }
  let other_material = reaction_discovery_thermo0(other_index).x;
  let other_position = reaction_discovery_position(other_index);
  let displacement = self_position - other_position;
  let distance_squared = dot(displacement, displacement);
  if (!ss_exact_near_finite(distance_squared)) {
    atomicAdd(&traversal_evidence[5u], 1u);
    return;
  }

  for (
    var reaction_index = 0u;
    reaction_index < params.reaction_count;
    reaction_index = reaction_index + 1u
  ) {
    let reaction_base = reaction_index * params.reaction_record_stride_vec4s;
    let row0 = reaction_records[reaction_base];
    let row1 = reaction_records[reaction_base + 1u];
    let row2 = reaction_records[reaction_base + 2u];
    if (row2.x != 1.0 || !ss_exact_near_finite(row1.y) || row1.y <= 0.0) {
      continue;
    }
    var role = 0.0;
    if (self_material == row0.x && other_material == row0.y) {
      role = 1.0;
    } else if (self_material == row0.y && other_material == row0.x) {
      role = 2.0;
    } else {
      continue;
    }
    if (distance_squared > row1.y * row1.y) {
      continue;
    }
    reaction_discovery_increment_counter(4u);
    let current_partner = select(0xffffffffu, u32((*best).x + 0.5), (*best).x >= 0.0);
    let current_reaction = select(0xffffffffu, u32((*best).y + 0.5), (*best).y >= 0.0);
    if (
      distance_squared < (*best).w
      || (
        distance_squared == (*best).w
        && (
          other_index < current_partner
          || (other_index == current_partner && reaction_index < current_reaction)
        )
      )
    ) {
      *best = vec4<f32>(
        f32(other_index),
        f32(reaction_index),
        role,
        distance_squared
      );
    }
  }
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn propose(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  reaction_proposals[particle_index] = reaction_discovery_invalid_proposal();
  atomicAdd(&traversal_evidence[0u], 1u);
  if (
    spatial_expectation.support_profile_id != params.support_profile_id
    || !ss_exact_near_directory_admitted(spatial_expectation)
  ) {
    atomicAdd(&traversal_evidence[2u], 1u);
    return;
  }
  atomicAdd(&traversal_evidence[1u], 1u);
  if (
    arrayLength(&source_thermo) < params.particle_count * params.thermo_stride_vec4s
    || arrayLength(&source_state) < params.particle_count * params.state_stride_vec4s
    || arrayLength(&reaction_records)
      < params.reaction_count * params.reaction_record_stride_vec4s
    || !reaction_discovery_source_row_admitted(particle_index)
  ) {
    atomicAdd(&traversal_evidence[8u], 1u);
    return;
  }
  if (reaction_discovery_mass(particle_index) <= 0.0) {
    return;
  }
  if (
    !ss_exact_near_finite(params.maximum_contact_radius_m)
    || params.maximum_contact_radius_m < 0.0
  ) {
    atomicAdd(&traversal_evidence[5u], 1u);
    return;
  }
  if (params.maximum_contact_radius_m == 0.0) {
    return;
  }

  let self_position = reaction_discovery_position(particle_index);
  let self_material = reaction_discovery_thermo0(particle_index).x;
  var best = reaction_discovery_invalid_proposal();
  var malformed = false;

  for (
    var level_ordinal = 0u;
    level_ordinal < spatial_expectation.level_count;
    level_ordinal = level_ordinal + 1u
  ) {
    if (!ss_exact_near_level_occupied(spatial_expectation, level_ordinal)) {
      continue;
    }
    let level = spatial_expectation.min_level + i32(level_ordinal);
    let spacing_m = spatial_expectation.base_grid_spacing_m * exp2(f32(level));
    if (!ss_exact_near_finite(spacing_m) || spacing_m <= 0.0) {
      malformed = true;
      break;
    }
    let center_cell = vec3<i32>(floor(self_position / spacing_m));
    let radius_cells = max(0, i32(min(
      ceil(params.maximum_contact_radius_m / spacing_m),
      2147483520.0
    )));
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
    let level_begin = ss_exact_near_lower_bound_cell_key(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(0u)
    );
    let level_end = ss_exact_near_upper_bound_cell_key(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(0xffffffffu)
    );
    var x_cursor = ss_exact_near_lower_bound_cell_key_range(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(minimum_order.x, 0u, 0u),
      level_begin,
      level_end
    );
    for (
      var x_iteration = 0u;
      x_iteration < spatial_expectation.source_count && x_cursor < level_end;
      x_iteration = x_iteration + 1u
    ) {
      let x_order = ss_exact_near_cell_key_word(spatial_expectation, x_cursor, 2u);
      if (x_order > maximum_order.x) {
        x_cursor = level_end;
        continue;
      }
      let x_end = ss_exact_near_upper_bound_cell_key_range(
        spatial_expectation,
        spatial_expectation.chart_id,
        level_order,
        vec3<u32>(x_order, 0xffffffffu, 0xffffffffu),
        x_cursor,
        level_end
      );
      if (x_end <= x_cursor) {
        malformed = true;
        break;
      }
      var y_cursor = ss_exact_near_lower_bound_cell_key_range(
        spatial_expectation,
        spatial_expectation.chart_id,
        level_order,
        vec3<u32>(x_order, minimum_order.y, 0u),
        x_cursor,
        x_end
      );
      for (
        var y_iteration = 0u;
        y_iteration < spatial_expectation.source_count && y_cursor < x_end;
        y_iteration = y_iteration + 1u
      ) {
        let y_order = ss_exact_near_cell_key_word(spatial_expectation, y_cursor, 3u);
        if (y_order > maximum_order.y) {
          y_cursor = x_end;
          continue;
        }
        let y_end = ss_exact_near_upper_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, 0xffffffffu),
          y_cursor,
          x_end
        );
        if (y_end <= y_cursor) {
          malformed = true;
          break;
        }
        let z_begin = ss_exact_near_lower_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, minimum_order.z),
          y_cursor,
          y_end
        );
        let z_end = ss_exact_near_upper_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, maximum_order.z),
          z_begin,
          y_end
        );
        for (
          var cell_index = z_begin;
          cell_index < z_end;
          cell_index = cell_index + 1u
        ) {
          let member_range = ss_exact_near_cell_member_range(
            spatial_expectation,
            cell_index
          );
          if (member_range.admitted == 0u) {
            malformed = true;
            break;
          }
          for (
            var member_offset = member_range.begin;
            member_offset < member_range.end;
            member_offset = member_offset + 1u
          ) {
            let lookup = ss_exact_near_source_at_member(
              spatial_expectation,
              member_offset
            );
            if (lookup.admitted == 0u) {
              malformed = true;
              break;
            }
            reaction_discovery_consider_pair(
              particle_index,
              lookup.source_index,
              self_material,
              self_position,
              &best
            );
          }
          if (malformed) {
            break;
          }
        }
        if (malformed) {
          break;
        }
        y_cursor = y_end;
      }
      if (malformed || y_cursor < x_end) {
        malformed = true;
        break;
      }
      x_cursor = x_end;
    }
    if (malformed || x_cursor < level_end) {
      malformed = true;
      break;
    }
  }

  if (malformed) {
    atomicAdd(&traversal_evidence[5u], 1u);
    return;
  }
  if (best.x >= 0.0 && best.y >= 0.0) {
    reaction_proposals[particle_index] = best;
    reaction_discovery_increment_counter(6u);
  }
}

// This second dispatch performs no lookup. It turns any directory, source, or
// traversal rejection into a complete invalid proposal set before a later
// chemistry kernel can observe the artifact.
@compute @workgroup_size(${WORKGROUP_SIZE})
fn seal(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  let fail_closed = atomicLoad(&traversal_evidence[2u]) != 0u
    || atomicLoad(&traversal_evidence[5u]) != 0u
    || atomicLoad(&traversal_evidence[8u]) != 0u
    || atomicLoad(&traversal_evidence[15u]) != 0u
    || atomicLoad(&traversal_evidence[0u]) != params.particle_count
    || atomicLoad(&traversal_evidence[1u]) != params.particle_count;
  if (fail_closed) {
    reaction_proposals[particle_index] = reaction_discovery_invalid_proposal();
  }
  reaction_discovery_increment_counter(7u);
}
`;

function createResidentGpuEvidence({
  authentication,
  proposalBuffer,
  evidenceBuffer,
  byteLength,
  capacityByteLength = byteLength
}) {
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA,
    status: 'schroeder-spatial-exact-near-gpu-authenticated',
    gpuAuthenticated: true,
    consumerId: authentication.consumerId,
    supportProfileId: authentication.supportProfileId,
    generationId: authentication.generationId,
    epochIdentity: authentication.epochIdentity,
    traversalCount: 1,
    // Dynamic counters remain resident in evidenceBuffer. These receipt fields
    // attest the fixed byte contract without a synchronization readback.
    candidateVisitCount: 0,
    consumerMaskHitCount: 0,
    migratedProposalCount: authentication.sourceCount,
    candidateBytesRequired: byteLength,
    candidateBytesAdmitted: byteLength,
    candidateBytesCapacity: capacityByteLength,
    candidateOverflowBytes: 0,
    privateLookupBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    overflowed: false,
    partialPublication: false,
    fallbackObserved: false,
    fullReadbackPerformed: false,
    residentCounterBuffer: evidenceBuffer,
    residentProposalBuffer: proposalBuffer,
    residentCountersObserved: false,
    failClosedSealDispatchCount: 1
  });
}

/**
 * Discover at most one deterministic material/contact candidate per particle
 * from the immutable canonical ss-spatial-epoch.v1 directory. This pass does
 * not test temperature or phase activation: the reaction stage must recheck
 * those fields against its post-thermal input before mutating topology.
 */
export function runSchroederSpatialReactionDiscoveryProposalWebGpu({
  device,
  generation,
  sphParticleState = null,
  sphParticleUpload = null,
  sourceStateBuffer = null,
  sourceThermoBuffer = null,
  reactionTable,
  reactionRecordBuffer = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer || !device.queue?.submit) {
    throw new TypeError('canonical reaction discovery requires a WebGPU-like device');
  }
  const particleCount = exactPositiveU32(
    generation?.source?.sourceCount,
    'generation.source.sourceCount',
    MAX_EXACT_F32_INTEGER
  );
  if (
    sphParticleState?.particleCount != null
    && sphParticleState.particleCount !== particleCount
  ) {
    throw new RangeError('reaction discovery particle count does not match the canonical epoch');
  }
  const { reactionCount, combined } = reactionRecordArray(reactionTable);
  const maximumContactRadiusM = maxReactionContactRadiusM(reactionTable);
  const stateBuffer = requireBuffer(
    device,
    sourceStateBuffer || sphParticleUpload?.stateBuffer,
    'reaction discovery sourceStateBuffer'
  );
  const thermoBuffer = requireBuffer(
    device,
    sourceThermoBuffer || sphParticleUpload?.thermoBuffer,
    'reaction discovery sourceThermoBuffer'
  );
  const activeNodeBuffer = requireBuffer(
    device,
    generation?.source?.activeNodeBuffer,
    'reaction discovery canonical activeNodeBuffer'
  );
  requireMinimumBufferBytes(
    stateBuffer,
    particleCount * 2 * 4 * Float32Array.BYTES_PER_ELEMENT,
    'reaction discovery sourceStateBuffer'
  );
  requireMinimumBufferBytes(
    thermoBuffer,
    particleCount * 3 * 4 * Float32Array.BYTES_PER_ELEMENT,
    'reaction discovery sourceThermoBuffer'
  );
  const authentication = resolveSchroederSpatialExactNearConsumerGeneration(
    generation,
    {
      device,
      runtime: generation.runtime,
      consumerId: SCHROEDER_SPATIAL_REACTION_DISCOVERY_CONSUMER_ID,
      supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1,
      sourceBuffer: activeNodeBuffer,
      expected: {
        generationId: generation.execution?.generationId,
        sourceCount: particleCount,
        storageGeneration: generation.execution?.storageGeneration,
        physicsTick: generation.execution?.physicsTick,
        physicsSubstep: generation.execution?.physicsSubstep,
        positionEpoch: generation.execution?.positionEpoch,
        topologyEpoch: generation.execution?.topologyEpoch,
        supportEpoch: generation.execution?.supportEpoch
      }
    }
  );
  if (authentication?.ready !== true || authentication.authenticated !== true) {
    throw new TypeError(
      authentication?.reason || 'reaction discovery could not authenticate the canonical generation'
    );
  }
  const directoryBuffer = requireBuffer(
    device,
    authentication.directoryBuffer,
    'reaction discovery canonical directoryBuffer'
  );

  requireStorageCapacity(
    device,
    combined.byteLength,
    'reaction discovery reaction record buffer'
  );
  const proposalByteLength = particleCount
    * SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_ROW_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  requireStorageCapacity(
    device,
    proposalByteLength,
    'reaction discovery proposal buffer'
  );
  const arenaResources = acquireReactionDiscoveryArenaResources({
    device,
    generation,
    proposalBytes: proposalByteLength,
    localReactionRecordBytes: reactionRecordBuffer ? 0 : combined.byteLength
  });
  const { entry: arenaEntry, lease: arenaLease } = arenaResources;
  const resolvedReactionRecordBuffer = reactionRecordBuffer
    ? requireBuffer(device, reactionRecordBuffer, 'reaction discovery reactionRecordBuffer')
    : arenaEntry.reactionRecordBuffer;
  requireMinimumBufferBytes(
    resolvedReactionRecordBuffer,
    combined.byteLength,
    'reaction discovery reactionRecordBuffer'
  );
  if (!reactionRecordBuffer) {
    device.queue.writeBuffer(resolvedReactionRecordBuffer, 0, combined);
  }

  const proposalBuffer = arenaEntry.proposalBuffer;
  const evidenceInitial = new Uint32Array(
    SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_WORDS
  );
  evidenceInitial[9] = SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1;
  evidenceInitial[10] = authentication.generationId;
  evidenceInitial[11] = authentication.epochIdentity.supportEpoch;
  evidenceInitial[12] = particleCount;
  evidenceInitial[13] = reactionCount;
  const evidenceBuffer = arenaEntry.evidenceBuffer;
  const expectationBuffer = arenaEntry.expectationBuffer;
  const paramsBuffer = arenaEntry.paramsBuffer;
  device.queue.writeBuffer(expectationBuffer, 0, authentication.expectationData);
  device.queue.writeBuffer(paramsBuffer, 0, createParamsArray({
    particleCount,
    reactionCount,
    maximumContactRadiusM
  }));
  device.queue.writeBuffer(evidenceBuffer, 0, evidenceInitial);

  const proposalPipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-schroeder-spatial-reaction-discovery-proposal.v1',
    label: 'ulg-schroeder-spatial-reaction-discovery-proposal',
    code: schroederSpatialReactionDiscoveryProposalWgsl,
    entryPoint: 'propose',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'read-only-storage'),
      computeBufferBinding(5, 'storage'),
      computeBufferBinding(6, 'storage'),
      computeBufferBinding(7, 'uniform'),
      computeBufferBinding(8, 'uniform')
    ]
  });
  const sealPipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-schroeder-spatial-reaction-discovery-proposal.v1',
    label: 'ulg-schroeder-spatial-reaction-discovery-seal',
    code: schroederSpatialReactionDiscoveryProposalWgsl,
    entryPoint: 'seal',
    bindings: [
      computeBufferBinding(5, 'storage'),
      computeBufferBinding(6, 'storage'),
      computeBufferBinding(8, 'uniform')
    ]
  });
  const proposalBindGroup = device.createBindGroup({
    label: 'ulg-schroeder-spatial-reaction-discovery-proposal-bindings',
    layout: proposalPipeline.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: activeNodeBuffer } },
      { binding: 1, resource: { buffer: thermoBuffer } },
      { binding: 2, resource: { buffer: stateBuffer } },
      { binding: 3, resource: { buffer: resolvedReactionRecordBuffer } },
      { binding: 4, resource: { buffer: directoryBuffer } },
      { binding: 5, resource: { buffer: proposalBuffer } },
      { binding: 6, resource: { buffer: evidenceBuffer } },
      { binding: 7, resource: { buffer: expectationBuffer } },
      { binding: 8, resource: { buffer: paramsBuffer } }
    ]
  });
  const sealBindGroup = device.createBindGroup({
    label: 'ulg-schroeder-spatial-reaction-discovery-seal-bindings',
    layout: sealPipeline.bindGroupLayout,
    entries: [
      { binding: 5, resource: { buffer: proposalBuffer } },
      { binding: 6, resource: { buffer: evidenceBuffer } },
      { binding: 8, resource: { buffer: paramsBuffer } }
    ]
  });
  const workgroups = Math.max(1, Math.ceil(particleCount / WORKGROUP_SIZE));
  const encoder = device.createCommandEncoder({
    label: 'ulg-schroeder-spatial-reaction-discovery'
  });
  const proposalPass = encoder.beginComputePass({
    label: 'ulg-schroeder-spatial-reaction-discovery-proposal'
  });
  proposalPass.setPipeline(proposalPipeline.pipeline);
  proposalPass.setBindGroup(0, proposalBindGroup);
  proposalPass.dispatchWorkgroups(workgroups);
  proposalPass.end();
  const sealPass = encoder.beginComputePass({
    label: 'ulg-schroeder-spatial-reaction-discovery-seal'
  });
  sealPass.setPipeline(sealPipeline.pipeline);
  sealPass.setBindGroup(0, sealBindGroup);
  sealPass.dispatchWorkgroups(workgroups);
  sealPass.end();
  device.queue.submit([encoder.finish()]);

  const gpuEvidence = createResidentGpuEvidence({
    authentication,
    proposalBuffer,
    evidenceBuffer,
    byteLength: proposalByteLength,
    capacityByteLength: arenaEntry.proposalCapacityBytes
  });
  const receipt = finalizeSchroederSpatialExactNearConsumerReceipt(
    authentication,
    gpuEvidence
  );
  let destroyed = false;
  // Per-arena uniforms are intentionally retained. The spatial runtime cannot
  // reuse this arena until its generation retires, so no submitted-work
  // callback or transient buffer destruction is required between ticks.
  const cleanupTemporaryBuffersAfterSubmittedWork = () => false;
  const destroy = () => {
    if (destroyed) return false;
    destroyed = true;
    return releaseReactionDiscoveryArenaResources(arenaEntry, arenaLease);
  };

  return {
    schema: ULG_SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_SCHEMA,
    status: 'schroeder-spatial-reaction-discovery-proposal-submitted',
    ready: true,
    backend: 'webgpu',
    consumerId: SCHROEDER_SPATIAL_REACTION_DISCOVERY_CONSUMER_ID,
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1,
    particleCount,
    reactionCount,
    maximumContactRadiusM,
    generation,
    generationId: authentication.generationId,
    epochIdentity: authentication.epochIdentity,
    sourcePositionAuthority: 'same-epoch-pre-integration-particle-state',
    sourceThermalAuthority: 'same-epoch-pre-thermal-particle-state',
    activationValidation: 'deferred-post-thermal-reaction-resolve',
    proposalSelection: 'nearest-compatible-material-contact-then-partner-then-reaction',
    proposalBuffer,
    proposalBufferByteLength: proposalByteLength,
    proposalBufferCapacityByteLength: arenaEntry.proposalCapacityBytes,
    proposalRowLayout: SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_ROW_LAYOUT,
    proposalRowStrideFloats: SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_ROW_FLOATS,
    reactionRecordBuffer: resolvedReactionRecordBuffer,
    reactionRecordBufferOwned: false,
    reactionRecordBufferOwnership: reactionRecordBuffer
      ? 'borrowed-caller-buffer'
      : 'per-device-canonical-generation-arena-cache',
    reactionRecordBufferCapacityByteLength: reactionRecordBuffer
      ? Number(reactionRecordBuffer.size) || combined.byteLength
      : arenaEntry.reactionRecordCapacityBytes,
    evidenceBuffer,
    evidenceBufferByteLength: evidenceInitial.byteLength,
    evidenceLayout: SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_LAYOUT,
    authentication,
    gpuEvidence,
    receipt,
    bufferOwnership: 'per-device-canonical-generation-arena-cache',
    spatialArenaIndex: arenaEntry.arenaIndex,
    arenaAcquisitionOrdinal: arenaLease.acquisitionOrdinal,
    bufferCreationCount: arenaResources.bufferCreationCount,
    arenaTotalBufferCreationCount: arenaEntry.totalBufferCreationCount,
    arenaWarmReuse: arenaResources.bufferCreationCount === 0,
    traversalCount: 1,
    sealDispatchCount: 1,
    directoryBuildCount: 0,
    privateLookupBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    candidateBudget: null,
    candidateMaterialization: 'one-deterministic-best-row-per-source',
    fallbackObserved: false,
    fullReadbackPerformed: false,
    readbackMode: 'no-full-readback',
    cleanupTemporaryBuffersAfterSubmittedWork,
    destroy,
    get released() {
      return destroyed;
    }
  };
}
