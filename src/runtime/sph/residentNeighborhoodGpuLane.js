import {
  RESIDENT_NEIGHBORHOOD_CHART_FLAG
} from '../../../ulg-gpu-abi/src/residentNeighborhoodBuilderWgsl.js';
import {
  RESIDENT_NEIGHBORHOOD_CONSUMER,
  RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG,
  RESIDENT_NEIGHBORHOOD_UNASSIGNED_SUPPORT_CLASS
} from '../../../ulg-gpu-abi/src/residentNeighborhood.js';
import {
  createResidentNeighborhoodDescriptor,
  encodeResidentNeighborhoodSignedOrderKey
} from './residentNeighborhoodGpu.js';
import {
  createResidentNeighborhoodGpuBuilder,
  normalizeResidentNeighborhoodDenseUniformChart,
  planResidentNeighborhoodGpuBuilderStrategy,
  planResidentNeighborhoodGpuBuilderAllocations,
  RESIDENT_NEIGHBORHOOD_GENERATION_CONTROL_SLOT_COUNT_DEFAULT
} from './residentNeighborhoodGpuBuilder.js';
import {
  WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_DEFAULT,
  WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_MAX,
  webGpuDispatchShapeId
} from '../webgpuRadixScanUnique.js';
import { tagWebGpuBufferDevice, webGpuDeviceId } from './sphGpuDeviceIdentity.js';
import {
  computeBufferBinding,
  createExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import {
  createResidentNeighborhoodMutationCertificateSlotWords,
  RESIDENT_NEIGHBORHOOD_MUTATION_ACCUMULATOR_BYTES,
  RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_MAGIC,
  RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_SLOT_COUNT_DEFAULT,
  RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_VERSION,
  RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG,
  RESIDENT_NEIGHBORHOOD_MUTATION_FLAG,
  RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_BYTES,
  RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX,
  RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_STATE,
  RESIDENT_NEIGHBORHOOD_MUTATION_STAGE,
  residentNeighborhoodMutationStageId
} from '../../../ulg-gpu-abi/src/residentNeighborhoodMutationCertificate.js';

export const ULG_RESIDENT_NEIGHBORHOOD_GPU_LANE_SCHEMA =
  'peercompute.ulg.resident-neighborhood-gpu-lane.v0';
export const ULG_RESIDENT_NEIGHBORHOOD_GENERATION_REUSE_ADMISSION_SCHEMA =
  'peercompute.ulg.resident-neighborhood-generation-reuse-admission.v0';

const UINT32_MAX = 0xffff_ffff;
const U32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const SOURCE_METADATA_STRIDE_U32 = 8;
const SOURCE_METADATA_PARAMS_U32 = 32;
const OFFSET_ALIGNMENT_MIN_BYTES = 256;
const SUPPORT_CLASS_ID = 0;
const COMPUTE_MANAGER_LEASE_IDENTITY_SCHEMA =
  'peercompute.compute.gpu-resident-lane-lease-identity.v0';
const LANE_POOLS = new WeakMap();
const LANE_REQUIREMENTS = new WeakMap();
const GENERATION_REQUIREMENTS = new WeakMap();
const MAX_IN_FLIGHT_SUBMISSIONS = 2;
const SKIN_REUSE_DISPATCH_SHAPE_CAPACITY = 32;
const SKIN_REUSE_DISPATCH_HEADER_U32 = 4;
const SKIN_REUSE_DISPATCH_ROW_U32 = 3;
const SKIN_REUSE_DISPATCH_TEMPLATE_BASE_U32 = SKIN_REUSE_DISPATCH_HEADER_U32;
const SKIN_REUSE_DISPATCH_GATE_BASE_U32 = SKIN_REUSE_DISPATCH_TEMPLATE_BASE_U32
  + SKIN_REUSE_DISPATCH_SHAPE_CAPACITY * SKIN_REUSE_DISPATCH_ROW_U32;
const SKIN_REUSE_DISPATCH_BANK_U32 = SKIN_REUSE_DISPATCH_GATE_BASE_U32
  + SKIN_REUSE_DISPATCH_SHAPE_CAPACITY * SKIN_REUSE_DISPATCH_ROW_U32;
const MUTATION_CERTIFICATE_ALIGNMENT_MIN_BYTES = 256;

const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const CONSUMER_BITS = Object.freeze({
  mechanics: RESIDENT_NEIGHBORHOOD_CONSUMER.MECHANICS,
  contact: RESIDENT_NEIGHBORHOOD_CONSUMER.CONTACT,
  thermal: RESIDENT_NEIGHBORHOOD_CONSUMER.THERMAL,
  radiation: RESIDENT_NEIGHBORHOOD_CONSUMER.RADIATION,
  reaction: RESIDENT_NEIGHBORHOOD_CONSUMER.REACTION,
  pressureInterface: RESIDENT_NEIGHBORHOOD_CONSUMER.PRESSURE_INTERFACE,
  solidKinematics: RESIDENT_NEIGHBORHOOD_CONSUMER.SOLID_KINEMATICS,
  ssUniqueNodeCompaction: RESIDENT_NEIGHBORHOOD_CONSUMER.SS_UNIQUE_NODE_COMPACTION
});

const SOURCE_METADATA_INITIALIZER_WGSL = /* wgsl */ `
struct InitParams {
  rows: array<vec4<u32>, 8>,
};

@group(0) @binding(0) var<storage, read_write> chart_rows: array<u32>;
@group(0) @binding(1) var<storage, read_write> assignment_rows: array<u32>;
@group(0) @binding(2) var<uniform> params: InitParams;

fn p(index: u32) -> u32 {
  return params.rows[index >> 2u][index & 3u];
}

@compute @workgroup_size(64)
fn initialize_source_metadata(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * p(17u);
  let source_index = linear_group * 64u + local_id.x;
  if (source_index >= p(0u)) {
    return;
  }
  let row = source_index * 8u;
  chart_rows[row] = p(2u);
  chart_rows[row + 1u] = p(3u);
  chart_rows[row + 2u] = p(4u);
  chart_rows[row + 3u] = p(5u);
  chart_rows[row + 4u] = p(6u);
  chart_rows[row + 5u] = p(7u);
  chart_rows[row + 6u] = p(1u);
  chart_rows[row + 7u] = p(8u);
  for (var slot = 0u; slot < 8u; slot = slot + 1u) {
    assignment_rows[p(18u) + row + slot] = p(9u + slot);
  }
}
`;

export const residentNeighborhoodSkinReuseProofWgsl = /* wgsl */ `
struct BuilderParams {
  rows: array<vec4<u32>, 16>,
};

struct U64Parts {
  low: u32,
  high: u32,
};

@group(0) @binding(0) var<storage, read> current_position_words: array<u32>;
@group(0) @binding(1) var<storage, read_write> reference_positions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> proof_evidence: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> dispatch_bank: array<u32>;
@group(0) @binding(4) var<storage, read_write> packed_candidate_csr: array<u32>;
@group(0) @binding(5) var<storage, read_write> capacity_evidence: array<u32>;
@group(0) @binding(6) var<storage, read_write> cell_csr: array<u32>;
@group(0) @binding(7) var<uniform> builder_params: BuilderParams;
@group(0) @binding(8) var<storage, read_write> proof_counters: array<atomic<u32>>;

fn p(index: u32) -> u32 {
  return builder_params.rows[index >> 2u][index & 3u];
}

fn add_u64(left: U64Parts, right: U64Parts) -> U64Parts {
  let low = left.low + right.low;
  let carry = select(0u, 1u, low < left.low);
  return U64Parts(low, left.high + right.high + carry);
}

fn multiply_u32_small(value: u32, factor: u32) -> U64Parts {
  let low_product = (value & 0xffffu) * factor;
  let high_product = (value >> 16u) * factor;
  let shifted_high = high_product << 16u;
  let low = low_product + shifted_high;
  let carry = select(0u, 1u, low < low_product);
  return U64Parts(low, (high_product >> 16u) + carry);
}

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

fn finite_vec3(value: vec3<f32>) -> bool {
  return finite_f32(value.x) && finite_f32(value.y) && finite_f32(value.z);
}

fn linear_source(
  local_id: vec3<u32>,
  workgroup_id: vec3<u32>
) -> u32 {
  let linear_group = workgroup_id.x + workgroup_id.y * p(47u);
  return linear_group * 64u + local_id.x;
}

fn current_position(index: u32) -> vec3<f32> {
  let base = index * p(5u) + p(6u);
  return vec3<f32>(
    bitcast<f32>(current_position_words[base]),
    bitcast<f32>(current_position_words[base + 1u]),
    bitcast<f32>(current_position_words[base + 2u])
  );
}

@compute @workgroup_size(64)
fn measure_skin_displacement(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let index = linear_source(local_id, workgroup_id);
  if (index >= p(0u)) {
    return;
  }
  let current = current_position(index);
  let reference = reference_positions[index];
  if (!finite_vec3(current) || reference.w != 1.0 || !finite_vec3(reference.xyz)) {
    atomicOr(&proof_evidence[1u], 1u);
    return;
  }
  let displacement = current - reference.xyz;
  let distance_squared = dot(displacement, displacement);
  if (!finite_f32(distance_squared) || distance_squared < 0.0) {
    atomicOr(&proof_evidence[1u], 1u);
    return;
  }
  atomicMax(&proof_evidence[0u], bitcast<u32>(distance_squared));
}

@compute @workgroup_size(64)
fn finalize_skin_reuse(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let row = global_id.x;
  let template_count = min(dispatch_bank[0u], ${SKIN_REUSE_DISPATCH_SHAPE_CAPACITY}u);
  let skin_distance = bitcast<f32>(p(32u));
  let max_distance_squared = bitcast<f32>(atomicLoad(&proof_evidence[0u]));
  let invalid = atomicLoad(&proof_evidence[1u]) != 0u;
  let prior_admitted = packed_candidate_csr[31u] == 1u
    && packed_candidate_csr[33u] == 0u
    && packed_candidate_csr[5u] == p(0u);
  let within_skin = finite_f32(skin_distance) && skin_distance > 0.0
    && finite_f32(max_distance_squared)
    && 4.0 * max_distance_squared <= skin_distance * skin_distance;
  let reuse = !invalid && prior_admitted && within_skin;
  let rebuild = !reuse;

  if (row < template_count) {
    let template_base = dispatch_bank[2u] + row * 3u;
    let gate_base = dispatch_bank[1u] + row * 3u;
    dispatch_bank[gate_base] = select(dispatch_bank[template_base], 0u, reuse);
    dispatch_bank[gate_base + 1u] = select(dispatch_bank[template_base + 1u], 1u, reuse);
    dispatch_bank[gate_base + 2u] = select(dispatch_bank[template_base + 2u], 1u, reuse);
  }

  if (row != 0u) {
    return;
  }
  atomicStore(&proof_evidence[2u], select(0u, 1u, reuse));
  atomicStore(&proof_evidence[3u], select(0u, 1u, rebuild));
  atomicStore(&proof_evidence[4u], p(1u));
  atomicStore(&proof_evidence[5u], p(4u));
  atomicStore(&proof_evidence[6u], bitcast<u32>(sqrt(max(max_distance_squared, 0.0))));
  atomicStore(&proof_evidence[7u], p(32u));
  atomicAdd(&proof_counters[0u], 1u);
  if (reuse) {
    atomicAdd(&proof_counters[1u], 1u);
  } else {
    atomicAdd(&proof_counters[2u], 1u);
  }
  if (!reuse) {
    return;
  }

  cell_csr[1u] = p(1u);
  cell_csr[2u] = p(2u);
  cell_csr[3u] = p(3u);
  cell_csr[4u] = p(4u);
  packed_candidate_csr[1u] = p(1u);
  packed_candidate_csr[2u] = p(2u);
  packed_candidate_csr[3u] = p(3u);
  packed_candidate_csr[4u] = p(4u);
  packed_candidate_csr[27u] = bitcast<u32>(sqrt(max(max_distance_squared, 0.0)));
  packed_candidate_csr[28u] = bitcast<u32>(0.5 * skin_distance);
  packed_candidate_csr[29u] = 7u;
  packed_candidate_csr[30u] = p(36u);
  packed_candidate_csr[31u] = 1u;
  packed_candidate_csr[32u] = 0u;
  packed_candidate_csr[33u] = 0u;

  capacity_evidence[0u] = p(46u);
  capacity_evidence[1u] = p(1u);
  capacity_evidence[2u] = p(2u);
  capacity_evidence[3u] = p(3u);
  capacity_evidence[4u] = p(0u);
  capacity_evidence[5u] = cell_csr[6u];
  capacity_evidence[6u] = cell_csr[7u];
  capacity_evidence[8u] = 0u;
  capacity_evidence[9u] = packed_candidate_csr[9u];
  capacity_evidence[10u] = packed_candidate_csr[10u];
  capacity_evidence[12u] = 0u;
  capacity_evidence[13u] = packed_candidate_csr[13u];
  capacity_evidence[14u] = packed_candidate_csr[14u];
  capacity_evidence[16u] = 0u;
  capacity_evidence[17u] = packed_candidate_csr[9u];
  capacity_evidence[18u] = packed_candidate_csr[10u];
  capacity_evidence[20u] = 0u;
  capacity_evidence[21u] = packed_candidate_csr[13u];
  capacity_evidence[22u] = packed_candidate_csr[14u];
  capacity_evidence[24u] = 0u;
  capacity_evidence[25u] = packed_candidate_csr[18u];
  capacity_evidence[26u] = packed_candidate_csr[19u];
  capacity_evidence[28u] = 0u;
  var required_bytes = U64Parts(0u, 0u);
  required_bytes = add_u64(
    required_bytes,
    multiply_u32_small(cell_csr[6u], p(12u) * 4u)
  );
  required_bytes = add_u64(
    required_bytes,
    multiply_u32_small(cell_csr[6u] + 1u, 4u)
  );
  required_bytes = add_u64(
    required_bytes,
    multiply_u32_small(p(0u), 4u)
  );
  required_bytes = add_u64(
    required_bytes,
    multiply_u32_small(packed_candidate_csr[34u], 4u)
  );
  required_bytes = add_u64(
    required_bytes,
    multiply_u32_small(p(9u), p(44u) * 4u)
  );
  required_bytes = add_u64(
    required_bytes,
    multiply_u32_small(p(31u), 4u)
  );
  capacity_evidence[29u] = required_bytes.low;
  capacity_evidence[30u] = required_bytes.high;
  capacity_evidence[31u] = required_bytes.low;
  capacity_evidence[32u] = required_bytes.high;
  capacity_evidence[35u] = 0u;
  capacity_evidence[36u] = 0u;
  capacity_evidence[39u] = p(36u);
  capacity_evidence[40u] = 0u;
  capacity_evidence[41u] = 1u;
  capacity_evidence[42u] = packed_candidate_csr[38u];
  capacity_evidence[43u] = 0u;
}

@compute @workgroup_size(64)
fn capture_rebuild_reference(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let index = linear_source(local_id, workgroup_id);
  if (index >= p(0u) || packed_candidate_csr[31u] != 1u
    || packed_candidate_csr[33u] != 0u) {
    return;
  }
  let position = current_position(index);
  if (!finite_vec3(position)) {
    reference_positions[index] = vec4<f32>(0.0);
    return;
  }
  reference_positions[index] = vec4<f32>(position, 1.0);
}
`;

export const residentNeighborhoodMutationCertificateProofWgsl = /* wgsl */ `
@group(0) @binding(0) var<storage, read_write> mutation_accumulator: array<atomic<u32>>;
@group(0) @binding(1) var<storage, read_write> mutation_slot: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> dispatch_bank: array<u32>;
@group(0) @binding(3) var<storage, read_write> packed_candidate_csr: array<u32>;
@group(0) @binding(4) var<storage, read_write> capacity_evidence: array<u32>;
@group(0) @binding(5) var<storage, read_write> cell_csr: array<u32>;
@group(0) @binding(6) var<storage, read_write> proof_counters: array<atomic<u32>>;

const MUTATION_MAGIC: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_MAGIC}u;
const MUTATION_VERSION: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_VERSION}u;
const SLOT_ARMED: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_STATE.ARMED}u;
const SLOT_REUSED: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_STATE.REUSED}u;
const SLOT_REBUILT: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_STATE.REBUILT}u;
const SLOT_REBUILD_FAILED: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_STATE.REBUILD_FAILED}u;
const FORCE_REBUILD: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG.FORCE_REBUILD}u;

fn mutation_finite(value: f32) -> bool {
  return value == value && value >= 0.0 && value <= 3.402823466e+38;
}

fn mutation_next_up(value: f32) -> f32 {
  if (!mutation_finite(value)) { return bitcast<f32>(0x7f800000u); }
  if (value == 0.0) { return 0.0; }
  return bitcast<f32>(bitcast<u32>(value) + 1u);
}

fn mutation_slot_valid() -> bool {
  return arrayLength(&mutation_slot) >= 16u
    && atomicLoad(&mutation_slot[0u]) == MUTATION_MAGIC
    && atomicLoad(&mutation_slot[1u]) == MUTATION_VERSION
    && atomicLoad(&mutation_slot[11u]) == SLOT_ARMED;
}

@compute @workgroup_size(64)
fn finalize_mutation_reuse(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;
  let template_count = min(dispatch_bank[0u], ${SKIN_REUSE_DISPATCH_SHAPE_CAPACITY}u);
  let slot_valid = mutation_slot_valid();
  let accumulator_ready = atomicLoad(&mutation_accumulator[0u]) == MUTATION_MAGIC
    && atomicLoad(&mutation_accumulator[1u]) == MUTATION_VERSION
    && atomicLoad(&mutation_accumulator[2u]) == 1u;
  let nonce = atomicLoad(&mutation_slot[2u]);
  let target_generation = atomicLoad(&mutation_slot[4u]);
  let target_epoch = atomicLoad(&mutation_slot[7u]);
  let source_count = atomicLoad(&mutation_slot[8u]);
  let stage_upper = bitcast<f32>(atomicLoad(&mutation_slot[12u]));
  let mutation_flags = atomicLoad(&mutation_slot[13u]);
  let writer_seen = atomicLoad(&mutation_slot[14u]) == 1u;
  let prior_nonce = atomicLoad(&mutation_accumulator[8u]);
  let prior_epoch = atomicLoad(&mutation_accumulator[4u]);
  let prior_upper = bitcast<f32>(atomicLoad(&mutation_accumulator[5u]));
  let nonce_valid = prior_nonce != 0xffffffffu && nonce == prior_nonce + 1u;
  let epoch_valid = target_epoch > prior_epoch;
  let source_valid = source_count == packed_candidate_csr[5u]
    && source_count == atomicLoad(&mutation_accumulator[7u]);
  let authority_valid = atomicLoad(&mutation_slot[9u])
    == atomicLoad(&mutation_accumulator[15u]);
  let prior_admitted = packed_candidate_csr[31u] == 1u
    && packed_candidate_csr[33u] == 0u;
  let forced = (atomicLoad(&mutation_slot[10u]) & FORCE_REBUILD) != 0u;
  let arithmetic_valid = mutation_finite(stage_upper) && mutation_finite(prior_upper);
  let next_upper = mutation_next_up(prior_upper + stage_upper);
  let displacement_budget = bitcast<f32>(packed_candidate_csr[28u]);
  let within_skin = arithmetic_valid && mutation_finite(next_upper)
    && mutation_finite(displacement_budget)
    && next_upper <= displacement_budget;
  let reuse = slot_valid && accumulator_ready && nonce_valid && epoch_valid
    && source_valid && authority_valid && prior_admitted && writer_seen
    && mutation_flags == 0u && !forced && within_skin;

  if (row < template_count) {
    let template_base = dispatch_bank[2u] + row * 3u;
    let gate_base = dispatch_bank[1u] + row * 3u;
    dispatch_bank[gate_base] = select(dispatch_bank[template_base], 0u, reuse);
    dispatch_bank[gate_base + 1u] = select(dispatch_bank[template_base + 1u], 1u, reuse);
    dispatch_bank[gate_base + 2u] = select(dispatch_bank[template_base + 2u], 1u, reuse);
  }
  if (row != 0u) { return; }

  atomicAdd(&mutation_accumulator[10u], 1u);
  atomicAdd(&proof_counters[0u], 1u);
  atomicStore(&mutation_accumulator[13u], atomicLoad(&mutation_slot[3u]));
  atomicStore(&mutation_accumulator[14u], bitcast<u32>(stage_upper));
  if (!reuse) {
    atomicStore(&mutation_accumulator[2u], 0u);
    atomicStore(&mutation_accumulator[6u], mutation_flags | select(0u, 0x80000000u, !slot_valid));
    atomicAdd(&mutation_accumulator[12u], 1u);
    atomicAdd(&proof_counters[2u], 1u);
    return;
  }

  atomicStore(&mutation_accumulator[4u], target_epoch);
  atomicStore(&mutation_accumulator[5u], bitcast<u32>(next_upper));
  atomicStore(&mutation_accumulator[8u], nonce);
  atomicAdd(&mutation_accumulator[11u], 1u);
  atomicAdd(&proof_counters[1u], 1u);
  atomicStore(&mutation_slot[11u], SLOT_REUSED);
  cell_csr[1u] = target_generation;
  cell_csr[2u] = atomicLoad(&mutation_slot[5u]);
  cell_csr[3u] = atomicLoad(&mutation_slot[6u]);
  cell_csr[4u] = target_epoch;
  packed_candidate_csr[1u] = target_generation;
  packed_candidate_csr[2u] = atomicLoad(&mutation_slot[5u]);
  packed_candidate_csr[3u] = atomicLoad(&mutation_slot[6u]);
  packed_candidate_csr[4u] = target_epoch;
  packed_candidate_csr[27u] = bitcast<u32>(next_upper);
  packed_candidate_csr[29u] = 7u;
  packed_candidate_csr[31u] = 1u;
  packed_candidate_csr[32u] = 0u;
  packed_candidate_csr[33u] = 0u;
  capacity_evidence[1u] = target_generation;
  capacity_evidence[2u] = atomicLoad(&mutation_slot[5u]);
  capacity_evidence[3u] = atomicLoad(&mutation_slot[6u]);
  capacity_evidence[4u] = source_count;
  capacity_evidence[40u] = 0u;
  capacity_evidence[41u] = 1u;
}

@compute @workgroup_size(1)
fn commit_rebuild_reference(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u || !mutation_slot_valid()) { return; }
  let admitted = packed_candidate_csr[31u] == 1u
    && packed_candidate_csr[33u] == 0u
    && packed_candidate_csr[1u] == atomicLoad(&mutation_slot[4u])
    && packed_candidate_csr[4u] == atomicLoad(&mutation_slot[7u])
    && packed_candidate_csr[5u] == atomicLoad(&mutation_slot[8u]);
  if (!admitted) {
    atomicStore(&mutation_accumulator[2u], 0u);
    atomicStore(&mutation_accumulator[6u], 0x40000000u);
    atomicStore(&mutation_slot[11u], SLOT_REBUILD_FAILED);
    return;
  }
  atomicStore(&mutation_accumulator[0u], MUTATION_MAGIC);
  atomicStore(&mutation_accumulator[1u], MUTATION_VERSION);
  atomicStore(&mutation_accumulator[2u], 1u);
  atomicStore(&mutation_accumulator[3u], atomicLoad(&mutation_slot[7u]));
  atomicStore(&mutation_accumulator[4u], atomicLoad(&mutation_slot[7u]));
  atomicStore(&mutation_accumulator[5u], 0u);
  atomicStore(&mutation_accumulator[6u], 0u);
  atomicStore(&mutation_accumulator[7u], atomicLoad(&mutation_slot[8u]));
  atomicStore(&mutation_accumulator[8u], atomicLoad(&mutation_slot[2u]));
  atomicStore(&mutation_accumulator[9u], atomicLoad(&mutation_slot[4u]));
  atomicStore(&mutation_accumulator[13u], atomicLoad(&mutation_slot[3u]));
  atomicStore(&mutation_accumulator[14u], 0u);
  atomicStore(&mutation_accumulator[15u], atomicLoad(&mutation_slot[9u]));
  atomicStore(&mutation_slot[11u], SLOT_REBUILT);
}
`;

function uint32(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > UINT32_MAX) {
    throw new RangeError(`${label} must be a uint32`);
  }
  return number >>> 0;
}

function checkedUint32Add(base, offset, label) {
  const left = uint32(base, `${label} base`);
  const right = uint32(offset, `${label} offset`);
  const sum = left + right;
  if (sum > UINT32_MAX) {
    throw new RangeError(`${label} exceeds uint32 range`);
  }
  return sum;
}

export function residentNeighborhoodMutationEpochsForStep(step) {
  const absoluteStep = uint32(step, 'absoluteStep');
  const preStep = 3 * absoluteStep;
  const postG2p = preStep + 1;
  const postSeparation = preStep + 2;
  const postReaction = preStep + 3;
  if (postReaction > UINT32_MAX) {
    throw new RangeError('resident neighborhood mutation epoch exceeds uint32 range');
  }
  return Object.freeze({
    absoluteStep,
    preStep,
    postG2p,
    postSeparation,
    postReaction
  });
}

/**
 * A generation can remain authoritative until positions mutate or the lane's
 * immutable consumer/support contract changes. This admission reads metadata
 * only; it never maps resident buffers or creates host-owned particle state.
 */
export function residentNeighborhoodGenerationReuseAdmission({
  lane,
  generation,
  positionMutationApplied = false
} = {}) {
  const currentGenerationAdmitted = generation?.hostAdmission === true
    && generation?.encoded === true;
  const consumerRequirementsUnchanged = Boolean(
    lane
    && generation
    && LANE_REQUIREMENTS.get(lane) === GENERATION_REQUIREMENTS.get(generation)
  );
  const blockers = [
    positionMutationApplied === true ? 'position-mutation-applied' : null,
    currentGenerationAdmitted ? null : 'current-generation-not-admitted',
    consumerRequirementsUnchanged ? null : 'consumer-requirements-changed'
  ].filter(Boolean);
  const reusable = blockers.length === 0;
  return Object.freeze({
    schema: ULG_RESIDENT_NEIGHBORHOOD_GENERATION_REUSE_ADMISSION_SCHEMA,
    status: reusable
      ? 'resident-neighborhood-generation-reuse-admitted'
      : 'resident-neighborhood-generation-rebuild-required',
    reusable,
    positionMutationApplied: positionMutationApplied === true,
    currentGenerationAdmitted,
    consumerRequirementsUnchanged,
    generation: generation?.descriptor?.generation ?? null,
    positionEpoch: generation?.descriptor?.positionValidity?.positionEpoch ?? null,
    reasonCodes: Object.freeze(blockers)
  });
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > UINT32_MAX) {
    throw new RangeError(`${label} must be a positive uint32`);
  }
  return number;
}

function finitePositive(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new RangeError(`${label} must be a positive finite number`);
  }
  return number;
}

function finiteNonNegative(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new RangeError(`${label} must be a non-negative finite number`);
  }
  return number;
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function float32Bits(value) {
  const view = new DataView(new ArrayBuffer(U32_BYTES));
  view.setFloat32(0, Number(value), true);
  return view.getUint32(0, true);
}

function createBuffer(device, { label, size, usage }) {
  return tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: Math.max(4, Math.ceil(size / 4) * 4),
    usage
  }), device);
}

function exactBindingResource(resource) {
  return {
    buffer: resource.buffer,
    offset: resource.byteOffset ?? 0,
    size: resource.byteLength
  };
}

function writeSupportClassRows(target, supportClasses) {
  target.fill(0);
  for (let index = 0; index < supportClasses.length; index += 1) {
    const supportClass = supportClasses[index];
    const offset = index * SOURCE_METADATA_STRIDE_U32;
    target[offset] = supportClass.supportClassId;
    target[offset + 1] = supportClass.consumerMask;
    target[offset + 2] = encodeResidentNeighborhoodSignedOrderKey(supportClass.minLevelDelta);
    target[offset + 3] = encodeResidentNeighborhoodSignedOrderKey(supportClass.maxLevelDelta);
    target[offset + 4] = supportClass.cellRadius;
    target[offset + 5] = supportClass.maxCandidatesPerSource;
    target[offset + 6] = supportClass.generation;
    target[offset + 7] = supportClass.flags;
  }
  return target;
}

function alignedByteOffset(value, alignment) {
  const offset = Number(value);
  const divisor = positiveInteger(alignment, 'byte alignment');
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new RangeError('byte offset must be a non-negative safe integer');
  }
  return Math.ceil(offset / divisor) * divisor;
}

function greatestCommonDivisor(left, right) {
  let a = positiveInteger(left, 'alignment left');
  let b = positiveInteger(right, 'alignment right');
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function checkedMultiply(left, right, label) {
  const value = left * right;
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} exceeds safe integer range`);
  return value;
}

function createGenerationMetadataArenaLayout({
  supportClassCount,
  slotCount,
  minUniformBufferOffsetAlignment = OFFSET_ALIGNMENT_MIN_BYTES,
  minStorageBufferOffsetAlignment = OFFSET_ALIGNMENT_MIN_BYTES
} = {}) {
  const classes = positiveInteger(supportClassCount, 'supportClassCount');
  const slots = positiveInteger(slotCount, 'retainedGenerationSlotCount');
  const uniformAlignment = Math.max(
    OFFSET_ALIGNMENT_MIN_BYTES,
    positiveInteger(minUniformBufferOffsetAlignment, 'minUniformBufferOffsetAlignment')
  );
  const storageAlignment = Math.max(
    OFFSET_ALIGNMENT_MIN_BYTES,
    positiveInteger(minStorageBufferOffsetAlignment, 'minStorageBufferOffsetAlignment')
  );
  const slotAlignment = checkedMultiply(
    uniformAlignment / greatestCommonDivisor(uniformAlignment, storageAlignment),
    storageAlignment,
    'combined buffer offset alignment'
  );
  const supportClassByteLength = checkedMultiply(
    classes,
    SOURCE_METADATA_STRIDE_U32 * U32_BYTES,
    'support-class row bytes'
  );
  const supportClassByteOffset = 0;
  const paramsByteOffset = alignedByteOffset(supportClassByteLength, uniformAlignment);
  const slotStrideByteLength = alignedByteOffset(
    paramsByteOffset + SOURCE_METADATA_PARAMS_U32 * U32_BYTES,
    slotAlignment
  );
  return Object.freeze({
    slotCount: slots,
    uniformAlignment,
    storageAlignment,
    slotAlignment,
    supportClassByteLength,
    supportClassByteOffset,
    paramsByteOffset,
    slotStrideByteLength,
    byteLength: checkedMultiply(slots, slotStrideByteLength, 'generation metadata arena bytes')
  });
}

function normalizeOrigin(originM) {
  if ((!Array.isArray(originM) && !ArrayBuffer.isView(originM)) || originM.length < 3) {
    throw new TypeError('originM must contain x, y, and z');
  }
  return [0, 1, 2].map((axis) => {
    const value = Number(originM[axis]);
    if (!Number.isFinite(value)) throw new RangeError(`originM[${axis}] must be finite`);
    return value;
  });
}

function normalizeConsumers(consumers) {
  if (!Array.isArray(consumers) || consumers.length === 0) {
    throw new TypeError('consumers must be a non-empty array');
  }
  const names = [...new Set(consumers)];
  let mask = 0;
  const assignment = {};
  for (const name of Object.keys(CONSUMER_BITS)) {
    assignment[name] = RESIDENT_NEIGHBORHOOD_UNASSIGNED_SUPPORT_CLASS;
  }
  for (const name of names) {
    const bit = CONSUMER_BITS[name];
    if (!bit) throw new RangeError(`unknown resident-neighborhood consumer ${name}`);
    mask = (mask | bit) >>> 0;
    assignment[name] = SUPPORT_CLASS_ID;
  }
  return { names: Object.freeze(names), mask, assignment: Object.freeze(assignment) };
}

function assertLeaseAuthorityIdentity(identity, { laneId, stateKey, sourceFamily }) {
  if (identity?.schema !== COMPUTE_MANAGER_LEASE_IDENTITY_SCHEMA
    || identity.authoritative !== true) {
    throw new TypeError('authoritative lane encode requires ComputeManager lease identity');
  }
  for (const [field, expected] of [
    ['leaseId', null],
    ['laneId', laneId],
    ['stateKey', stateKey],
    ['sourceFamily', sourceFamily]
  ]) {
    if (typeof identity[field] !== 'string' || identity[field].length === 0) {
      throw new TypeError(`leaseAuthorityIdentity.${field} must be a non-empty string`);
    }
    if (expected !== null && identity[field] !== expected) {
      throw new RangeError(`leaseAuthorityIdentity.${field} does not match the lane`);
    }
  }
  return identity;
}

function structuralPoolKey(options) {
  const supportClasses = options.supportClasses || null;
  const sourceSupportAssignments = options.sourceSupportAssignments || null;
  return JSON.stringify({
    sourceCount: options.sourceCount,
    supportDistanceM: options.supportDistanceM,
    cellSizeM: options.cellSizeM ?? options.supportDistanceM,
    originM: options.originM ?? [0, 0, 0],
    chartId: options.chartId ?? 0,
    level: options.level ?? 0,
    consumers: options.consumers ?? ['mechanics'],
    maxCandidatesPerSource: options.maxCandidatesPerSource ?? 32,
    candidateCapacity: options.candidateCapacity
      ?? options.sourceCount * (options.maxCandidatesPerSource ?? 32),
    laneId: options.laneId ?? 'compute-manager-resident-mechanics-lane',
    stateKey: options.stateKey ?? 'sph-particle-hot-state',
    sourceFamily: options.sourceFamily ?? 'sph-particle-state',
    sourceMetadataMode: options.sourceMetadataMode ?? 'uniform-gpu-expanded',
    denseUniformChart: options.denseUniformChart ?? null,
    builderStrategy: options.builderStrategy ?? 'auto',
    directSegmentedMasked: options.directSegmentedMasked === true,
    retainedParamsSlotCount: options.retainedParamsSlotCount
      ?? WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_DEFAULT,
    retainedGenerationSlotCount: options.retainedGenerationSlotCount
      ?? RESIDENT_NEIGHBORHOOD_GENERATION_CONTROL_SLOT_COUNT_DEFAULT,
    skinDistanceM: options.skinDistanceM ?? 0,
    mutationCertificateCapability: options.mutationCertificateCapability === true,
    supportClasses,
    sourceSupportAssignments
  });
}

function dispatchShape(sourceCount, maxDimension) {
  const groupCount = Math.max(1, Math.ceil(sourceCount / 64));
  const x = Math.min(groupCount, maxDimension);
  const y = Math.ceil(groupCount / x);
  if (y > maxDimension) {
    throw new RangeError(`source metadata workgroup count ${groupCount} exceeds dispatch limits`);
  }
  return [x, y, 1];
}

/**
 * Resolve a concrete global candidate budget that fits both the builder's
 * four-word staging rows and the packed two-word CSR rows on this device.
 */
export function resolveResidentNeighborhoodGpuLaneCapacity({
  device,
  sourceCount,
  requestedMaxCandidatesPerSource = 32
} = {}) {
  const count = positiveInteger(sourceCount, 'sourceCount');
  const requested = positiveInteger(
    requestedMaxCandidatesPerSource,
    'requestedMaxCandidatesPerSource'
  );
  const advertisedLimits = [
    Number(device?.limits?.maxStorageBufferBindingSize),
    Number(device?.limits?.maxBufferSize)
  ].filter((value) => Number.isFinite(value) && value > 0);
  const bindingLimit = advertisedLimits.length > 0
    ? Math.floor(Math.min(...advertisedLimits))
    : 0;
  if (!(bindingLimit > 0)) {
    return {
      status: 'resident-neighborhood-capacity-unavailable',
      admitted: false,
      reason: 'storage-buffer-binding-limit-unavailable',
      sourceCount: count,
      requestedMaxCandidatesPerSource: requested,
      maxCandidatesPerSource: 0,
      candidateCapacity: 0
    };
  }
  const alignedSourceOffsetCount = Math.ceil((count + 1) / 4) * 4;
  const fixedPackedBytes = 40 * U32_BYTES
    + alignedSourceOffsetCount * U32_BYTES
    + count * SOURCE_METADATA_STRIDE_U32 * U32_BYTES;
  const scratchCapacity = Math.floor(bindingLimit / (4 * U32_BYTES));
  const packedCapacity = Math.floor(Math.max(0, bindingLimit - fixedPackedBytes) / (2 * U32_BYTES));
  const deviceCandidateCapacity = Math.min(scratchCapacity, packedCapacity, UINT32_MAX);
  const maxCandidatesPerSource = Math.min(
    requested,
    Math.floor(deviceCandidateCapacity / count)
  );
  const candidateCapacity = count * maxCandidatesPerSource;
  return {
    status: maxCandidatesPerSource > 0
      ? 'resident-neighborhood-capacity-admitted'
      : 'resident-neighborhood-capacity-unavailable',
    admitted: maxCandidatesPerSource > 0,
    reason: maxCandidatesPerSource > 0 ? null : 'device-capacity-below-one-candidate-per-source',
    sourceCount: count,
    requestedMaxCandidatesPerSource: requested,
    maxCandidatesPerSource,
    candidateCapacity,
    deviceCandidateCapacity,
    storageBufferBindingLimitBytes: bindingLimit,
    stagingByteLength: candidateCapacity * 4 * U32_BYTES,
    packedCandidateByteLength: candidateCapacity * 2 * U32_BYTES,
    fixedPackedByteLength: fixedPackedBytes
  };
}

/**
 * Owns reusable production-lane metadata and a resident-neighborhood builder.
 * Every generation is recorded into a caller-owned encoder; this object never
 * submits, maps, reads back, or creates a scheduler.
 */
export function createResidentNeighborhoodGpuLane(device, {
  sourceCount,
  supportDistanceM,
  cellSizeM = supportDistanceM,
  originM = [0, 0, 0],
  chartId = 0,
  level = 0,
  consumers = ['mechanics'],
  supportClasses = null,
  sourceSupportAssignments = null,
  sourceMetadataMode = 'uniform-gpu-expanded',
  denseUniformChart = null,
  maxCandidatesPerSource = 32,
  candidateCapacity = sourceCount * maxCandidatesPerSource,
  generationBase = 1,
  positionEpochBase = generationBase,
  leaseIdPrefix = 'resident-neighborhood',
  laneId = 'compute-manager-resident-mechanics-lane',
  stateKey = 'sph-particle-hot-state',
  sourceFamily = 'sph-particle-state',
  leaseTokenLow = generationBase,
  leaseTokenHigh = positionEpochBase,
  authoritative = true,
  skinDistanceM = 0,
  maxDisplacementM = 0,
  mutationCertificateCapability = false,
  builderStrategy = 'auto',
  directSegmentedMasked = false,
  retainedParamsSlotCount = WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_DEFAULT,
  retainedGenerationSlotCount = RESIDENT_NEIGHBORHOOD_GENERATION_CONTROL_SLOT_COUNT_DEFAULT,
  label = 'ulg-resident-neighborhood-production-lane'
} = {}) {
  if (!device?.createBuffer || !device?.createShaderModule
    || !device?.createComputePipeline || !device?.createBindGroup
    || !device?.queue?.writeBuffer) {
    throw new TypeError('resident neighborhood lane requires a WebGPU-like device');
  }
  const count = positiveInteger(sourceCount, 'sourceCount');
  const maxDimension = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'maxComputeWorkgroupsPerDimension'
  );
  const supportDistance = finitePositive(supportDistanceM, 'supportDistanceM');
  const cellSize = finitePositive(cellSizeM, 'cellSizeM');
  const resolvedOrigin = normalizeOrigin(originM);
  const resolvedConsumers = normalizeConsumers(consumers);
  const perSourceCapacity = positiveInteger(maxCandidatesPerSource, 'maxCandidatesPerSource');
  const globalCandidateCapacity = positiveInteger(candidateCapacity, 'candidateCapacity');
  const resolvedRetainedGenerationSlotCount = positiveInteger(
    retainedGenerationSlotCount,
    'retainedGenerationSlotCount'
  );
  if (resolvedRetainedGenerationSlotCount > WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_MAX) {
    throw new RangeError(
      `retainedGenerationSlotCount exceeds ${WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_MAX}`
    );
  }
  if (globalCandidateCapacity < count) {
    throw new RangeError('candidateCapacity must provide at least one row per source');
  }
  const cellRadius = Math.ceil(supportDistance / cellSize);
  if (cellRadius < 1 || cellRadius > 1024) {
    throw new RangeError('supportDistanceM/cellSizeM produces an unsupported cell radius');
  }
  const resolvedLaneId = nonEmptyString(laneId, 'laneId');
  const resolvedStateKey = nonEmptyString(stateKey, 'stateKey');
  const resolvedSourceFamily = nonEmptyString(sourceFamily, 'sourceFamily');
  const resolvedLeasePrefix = nonEmptyString(leaseIdPrefix, 'leaseIdPrefix');
  const resolvedGenerationBase = uint32(generationBase, 'generationBase');
  const resolvedPositionEpochBase = uint32(positionEpochBase, 'positionEpochBase');
  const resolvedLeaseTokenLow = uint32(leaseTokenLow, 'leaseTokenLow');
  const resolvedLeaseTokenHigh = uint32(leaseTokenHigh, 'leaseTokenHigh');
  const requestedSkinDistance = finiteNonNegative(skinDistanceM, 'skinDistanceM');
  const resolvedSkinDistance = requestedSkinDistance;
  const resolvedMaxDisplacement = finiteNonNegative(maxDisplacementM, 'maxDisplacementM');
  const resolvedSourceMetadataMode = String(sourceMetadataMode);
  if (!['uniform-gpu-expanded', 'external-gpu-per-source'].includes(resolvedSourceMetadataMode)) {
    throw new RangeError(
      'sourceMetadataMode must be uniform-gpu-expanded or external-gpu-per-source'
    );
  }
  const configuredSupportClasses = Array.isArray(supportClasses) && supportClasses.length > 0
    ? supportClasses.map((entry) => ({ ...entry }))
    : [{
        supportClassId: SUPPORT_CLASS_ID,
        consumerMask: resolvedConsumers.mask,
        minLevelDelta: 0,
        maxLevelDelta: 0,
        cellRadius,
        maxCandidatesPerSource: perSourceCapacity,
        flags: RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.EXACT_NEAR_REQUIRED
          | RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.INCLUDE_SOURCE_CELL
      }];
  const configuredSourceSupportAssignments = sourceSupportAssignments
    ?? { uniform: resolvedConsumers.assignment };
  const maxConfiguredCellRadius = Math.max(
    1,
    ...configuredSupportClasses.map((entry) => uint32(entry.cellRadius, 'supportClass.cellRadius'))
  );
  const skinCellPadding = Math.ceil(resolvedSkinDistance / cellSize);
  const maxBuilderCellRadius = maxConfiguredCellRadius + skinCellPadding;
  if (maxBuilderCellRadius > 1024) {
    throw new RangeError('support radius plus skin exceeds the portable cell-search bound');
  }
  const resolvedDenseUniformChart = normalizeResidentNeighborhoodDenseUniformChart(
    denseUniformChart == null
      ? null
      : {
          ...denseUniformChart,
          chartId,
          level,
          cellSizeM: cellSize,
          originM: resolvedOrigin
        },
    {
      sourceCount: count,
      maxCellRadius: maxBuilderCellRadius,
      sourceMetadataMode: resolvedSourceMetadataMode,
      supportClasses: configuredSupportClasses
    }
  );
  const builderStrategyPlan = planResidentNeighborhoodGpuBuilderStrategy({
    sourceCount: count,
    requestedStrategy: builderStrategy,
    denseUniformChart: resolvedDenseUniformChart,
    maxComputeWorkgroupsPerDimension: maxDimension
  });
  const dispatch = dispatchShape(count, maxDimension);
  const metadataByteLength = count * SOURCE_METADATA_STRIDE_U32 * U32_BYTES;
  const generationMetadataArenaLayout = resolvedSourceMetadataMode === 'uniform-gpu-expanded'
    ? createGenerationMetadataArenaLayout({
        supportClassCount: configuredSupportClasses.length,
        slotCount: resolvedRetainedGenerationSlotCount,
        minUniformBufferOffsetAlignment:
          device.limits?.minUniformBufferOffsetAlignment ?? OFFSET_ALIGNMENT_MIN_BYTES,
        minStorageBufferOffsetAlignment:
          device.limits?.minStorageBufferOffsetAlignment ?? OFFSET_ALIGNMENT_MIN_BYTES
      })
    : null;
  const skinReuseEnabled = resolvedSkinDistance > 0
    && resolvedSourceMetadataMode === 'uniform-gpu-expanded';
  const mutationCertificateEnabled = mutationCertificateCapability === true
    && skinReuseEnabled;
  const legacySkinReuseEnabled = skinReuseEnabled && !mutationCertificateEnabled;
  const mutationCertificateSlotStrideBytes = mutationCertificateEnabled
    ? alignedByteOffset(
        RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_BYTES,
        Math.max(
          MUTATION_CERTIFICATE_ALIGNMENT_MIN_BYTES,
          positiveInteger(
            device.limits?.minStorageBufferOffsetAlignment
              ?? MUTATION_CERTIFICATE_ALIGNMENT_MIN_BYTES,
            'minStorageBufferOffsetAlignment'
          )
        )
      )
    : 0;
  const mutationCertificateSlotCount =
    RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_SLOT_COUNT_DEFAULT;
  const mutationCertificateArenaByteLength = checkedMultiply(
    mutationCertificateSlotStrideBytes,
    mutationCertificateSlotCount,
    'mutation certificate arena bytes'
  );
  let chartLevelBuffer = null;
  let sourceSupportAssignmentBuffer = null;
  let generationMetadataArenaBuffer = null;
  let initializerPipeline = null;
  let skinProofMeasurePipeline = null;
  let skinProofFinalizePipeline = null;
  let skinReferenceCapturePipeline = null;
  let skinReferencePositionBuffer = null;
  let skinProofEvidenceBuffer = null;
  let mutationProofFinalizePipeline = null;
  let mutationProofFinalizeBindGroupLayout = null;
  let mutationReferenceCommitPipeline = null;
  let mutationReferenceCommitBindGroupLayout = null;
  let mutationCertificateAccumulatorBuffer = null;
  let mutationCertificateArenaBuffer = null;
  let skinDispatchBankBuffer = null;
  let skinProofCountersBuffer = null;
  let builder = null;
  try {
    if (resolvedSourceMetadataMode === 'uniform-gpu-expanded') {
      chartLevelBuffer = createBuffer(device, {
        label: `${label}-chart-level-rows`,
        size: metadataByteLength,
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
      });
      sourceSupportAssignmentBuffer = createBuffer(device, {
        label: `${label}-source-support-assignment-rows`,
        size: metadataByteLength,
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
      });
      const maxBufferSize = Number(device.limits?.maxBufferSize ?? Number.POSITIVE_INFINITY);
      if (generationMetadataArenaLayout.byteLength > maxBufferSize) {
        throw new RangeError(
          `generation metadata arena byte length ${generationMetadataArenaLayout.byteLength} `
            + `exceeds maxBufferSize ${maxBufferSize}`
        );
      }
      generationMetadataArenaBuffer = createBuffer(device, {
        label: `${label}-generation-metadata-control-arena`,
        size: generationMetadataArenaLayout.byteLength,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.STORAGE
          | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      });
      const module = device.createShaderModule({
        label: `${label}-source-metadata-initializer`,
        code: SOURCE_METADATA_INITIALIZER_WGSL
      });
      initializerPipeline = device.createComputePipeline({
        label: `${label}-source-metadata-initializer`,
        layout: 'auto',
        compute: { module, entryPoint: 'initialize_source_metadata' }
      });
    }
    if (legacySkinReuseEnabled) {
      skinReferencePositionBuffer = createBuffer(device, {
        label: `${label}-skin-reference-positions`,
        size: count * 4 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
      });
      skinProofEvidenceBuffer = createBuffer(device, {
        label: `${label}-skin-proof-evidence`,
        size: 8 * U32_BYTES,
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      });
      skinDispatchBankBuffer = createBuffer(device, {
        label: `${label}-skin-dispatch-bank`,
        size: SKIN_REUSE_DISPATCH_BANK_U32 * U32_BYTES,
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.INDIRECT
      });
      skinProofCountersBuffer = createBuffer(device, {
        label: `${label}-skin-proof-counters`,
        size: 4 * U32_BYTES,
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      });
      const dispatchBankHeader = new Uint32Array(SKIN_REUSE_DISPATCH_HEADER_U32);
      dispatchBankHeader[0] = 0;
      dispatchBankHeader[1] = SKIN_REUSE_DISPATCH_GATE_BASE_U32;
      dispatchBankHeader[2] = SKIN_REUSE_DISPATCH_TEMPLATE_BASE_U32;
      dispatchBankHeader[3] = SKIN_REUSE_DISPATCH_SHAPE_CAPACITY;
      device.queue.writeBuffer(skinDispatchBankBuffer, 0, dispatchBankHeader);
      const skinModule = device.createShaderModule({
        label: `${label}-skin-reuse-proof`,
        code: residentNeighborhoodSkinReuseProofWgsl
      });
      const createSkinPipeline = (suffix, entryPoint) => device.createComputePipeline({
        label: `${label}-skin-${suffix}`,
        layout: 'auto',
        compute: { module: skinModule, entryPoint }
      });
      skinProofMeasurePipeline = createSkinPipeline(
        'measure-displacement',
        'measure_skin_displacement'
      );
      skinProofFinalizePipeline = createSkinPipeline('finalize-reuse', 'finalize_skin_reuse');
      skinReferenceCapturePipeline = createSkinPipeline(
        'capture-reference',
        'capture_rebuild_reference'
      );
    }
    if (mutationCertificateEnabled) {
      const maxBufferSize = Number(device.limits?.maxBufferSize ?? Number.POSITIVE_INFINITY);
      const maxBindingSize = Number(
        device.limits?.maxStorageBufferBindingSize ?? Number.POSITIVE_INFINITY
      );
      if (mutationCertificateArenaByteLength > maxBufferSize
        || RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_BYTES > maxBindingSize) {
        throw new RangeError('resident mutation certificate arena exceeds device limits');
      }
      mutationCertificateAccumulatorBuffer = createBuffer(device, {
        label: `${label}-mutation-certificate-accumulator`,
        size: RESIDENT_NEIGHBORHOOD_MUTATION_ACCUMULATOR_BYTES,
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      });
      mutationCertificateArenaBuffer = createBuffer(device, {
        label: `${label}-mutation-certificate-slot-arena`,
        size: mutationCertificateArenaByteLength,
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      });
      skinDispatchBankBuffer = createBuffer(device, {
        label: `${label}-skin-dispatch-bank`,
        size: SKIN_REUSE_DISPATCH_BANK_U32 * U32_BYTES,
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.INDIRECT
      });
      skinProofCountersBuffer = createBuffer(device, {
        label: `${label}-skin-proof-counters`,
        size: 4 * U32_BYTES,
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      });
      const dispatchBankHeader = new Uint32Array(SKIN_REUSE_DISPATCH_HEADER_U32);
      dispatchBankHeader[0] = 0;
      dispatchBankHeader[1] = SKIN_REUSE_DISPATCH_GATE_BASE_U32;
      dispatchBankHeader[2] = SKIN_REUSE_DISPATCH_TEMPLATE_BASE_U32;
      dispatchBankHeader[3] = SKIN_REUSE_DISPATCH_SHAPE_CAPACITY;
      device.queue.writeBuffer(skinDispatchBankBuffer, 0, dispatchBankHeader);
      const skinModule = device.createShaderModule({
        label: `${label}-mutation-certificate-proof`,
        code: residentNeighborhoodMutationCertificateProofWgsl
      });
      const dynamicMutationSlotBinding = computeBufferBinding(1, 'storage', {
        hasDynamicOffset: true,
        minBindingSize: RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_BYTES
      });
      const finalizePipeline = createExplicitComputePipeline(device, {
        label: `${label}-skin-finalize-mutation-reuse`,
        module: skinModule,
        entryPoint: 'finalize_mutation_reuse',
        bindings: [
          computeBufferBinding(0, 'storage'),
          dynamicMutationSlotBinding,
          computeBufferBinding(2, 'storage'),
          computeBufferBinding(3, 'storage'),
          computeBufferBinding(4, 'storage'),
          computeBufferBinding(5, 'storage'),
          computeBufferBinding(6, 'storage')
        ]
      });
      mutationProofFinalizePipeline = finalizePipeline.pipeline;
      mutationProofFinalizeBindGroupLayout = finalizePipeline.bindGroupLayout;
      const commitPipeline = createExplicitComputePipeline(device, {
        label: `${label}-skin-commit-reference-checkpoint`,
        module: skinModule,
        entryPoint: 'commit_rebuild_reference',
        bindings: [
          computeBufferBinding(0, 'storage'),
          dynamicMutationSlotBinding,
          computeBufferBinding(3, 'storage')
        ]
      });
      mutationReferenceCommitPipeline = commitPipeline.pipeline;
      mutationReferenceCommitBindGroupLayout = commitPipeline.bindGroupLayout;
    }
    builder = createResidentNeighborhoodGpuBuilder(device, {
      maxSourceCount: count,
      maxSupportClassCount: configuredSupportClasses.length,
      maxCandidateScratchCount: globalCandidateCapacity,
      maxCellRadius: maxBuilderCellRadius,
      reuseSingleArena: true,
      retainConstantScanParamsBuffers: true,
      retainedParamsSlotCount,
      retainedGenerationSlotCount: resolvedRetainedGenerationSlotCount,
      buildStrategy: builderStrategyPlan.strategy,
      directSegmentedMasked,
      label: `${label}-builder`
    });
  } catch (error) {
    builder?.destroy();
    chartLevelBuffer?.destroy?.();
    sourceSupportAssignmentBuffer?.destroy?.();
    generationMetadataArenaBuffer?.destroy?.();
    skinReferencePositionBuffer?.destroy?.();
    skinProofEvidenceBuffer?.destroy?.();
    mutationCertificateAccumulatorBuffer?.destroy?.();
    mutationCertificateArenaBuffer?.destroy?.();
    skinDispatchBankBuffer?.destroy?.();
    skinProofCountersBuffer?.destroy?.();
    throw error;
  }
  const activeGenerations = new Set();
  const activePreparedGenerations = new Set();
  const generationMetadataArenaEntry = generationMetadataArenaBuffer
    ? {
        role: 'resident-neighborhood-generation-metadata-control-arena',
        buffer: generationMetadataArenaBuffer,
        owned: true,
        lifetime: 'persistent-workspace',
        byteLength: generationMetadataArenaBuffer.size,
        slotCount: generationMetadataArenaLayout.slotCount,
        slotStrideByteLength: generationMetadataArenaLayout.slotStrideByteLength
      }
    : null;
  const generationMetadataSlots = generationMetadataArenaBuffer
    ? Array.from({ length: generationMetadataArenaLayout.slotCount }, (_, slotIndex) => {
        const slotBaseByteOffset = slotIndex * generationMetadataArenaLayout.slotStrideByteLength;
        return {
          slotIndex,
          slotBaseByteOffset,
          inUse: false,
          paramsBuffer: generationMetadataArenaBuffer,
          paramsByteOffset: slotBaseByteOffset + generationMetadataArenaLayout.paramsByteOffset,
          supportClassBuffer: generationMetadataArenaBuffer,
          supportClassByteOffset:
            slotBaseByteOffset + generationMetadataArenaLayout.supportClassByteOffset,
          metadataParamsWords: new Uint32Array(SOURCE_METADATA_PARAMS_U32),
          supportClassWords: new Uint32Array(
            configuredSupportClasses.length * SOURCE_METADATA_STRIDE_U32
          ),
          initializerBindGroup: null,
          skinProofBindGroupRecords: []
        };
      })
    : [];
  const requirementsToken = Object.freeze({});
  const mutationCertificateLaneToken = Object.freeze({});
  const preparedGenerationLaneToken = Object.freeze({});
  const mutationCertificateSlots = mutationCertificateArenaBuffer
    ? Array.from({ length: mutationCertificateSlotCount }, (_, slotIndex) => ({
        slotIndex,
        byteOffset: slotIndex * mutationCertificateSlotStrideBytes,
        inUse: false,
        certificate: null
      }))
    : [];
  let destroyed = false;
  let skinReferenceCaptureEncoded = false;
  let skinReferenceCheckpointEncoded = false;
  let skinEncodedIndirectDispatchCount = 0;
  let mutationCertificateNonce = 0;
  const skinDispatchShapeRows = new Map();

  const skinDispatchIndirectProvider = skinDispatchBankBuffer
    ? Object.freeze({
        buffer: skinDispatchBankBuffer,
        byteOffsetFor(dispatch, suppliedShapeId = null) {
          skinEncodedIndirectDispatchCount += 1;
          const shapeId = suppliedShapeId ?? webGpuDispatchShapeId(dispatch);
          let row = skinDispatchShapeRows.get(shapeId);
          if (row === undefined) {
            row = skinDispatchShapeRows.size;
            if (row >= SKIN_REUSE_DISPATCH_SHAPE_CAPACITY) {
              throw new RangeError(
                `skin reuse requires more than ${SKIN_REUSE_DISPATCH_SHAPE_CAPACITY} dispatch shapes`
              );
            }
            const normalized = new Uint32Array([
              uint32(dispatch[0], 'dispatch[0]'),
              uint32(dispatch[1] ?? 1, 'dispatch[1]'),
              uint32(dispatch[2] ?? 1, 'dispatch[2]')
            ]);
            skinDispatchShapeRows.set(shapeId, row);
            device.queue.writeBuffer(
              skinDispatchBankBuffer,
              (SKIN_REUSE_DISPATCH_TEMPLATE_BASE_U32
                + row * SKIN_REUSE_DISPATCH_ROW_U32) * U32_BYTES,
              normalized
            );
            device.queue.writeBuffer(
              skinDispatchBankBuffer,
              0,
              new Uint32Array([skinDispatchShapeRows.size])
            );
          }
          return (SKIN_REUSE_DISPATCH_GATE_BASE_U32
            + row * SKIN_REUSE_DISPATCH_ROW_U32) * U32_BYTES;
        }
      })
    : null;

  function acquireGenerationMetadataSlot() {
    const available = generationMetadataSlots.find((slot) => !slot.inUse);
    if (available) {
      available.inUse = true;
      return available;
    }
    const error = new Error(
      `resident neighborhood generation metadata arena exhausted `
        + `(${generationMetadataArenaLayout?.slotCount ?? 0} unresolved generations)`
    );
    error.code = 'ERR_RESIDENT_NEIGHBORHOOD_GENERATION_METADATA_ARENA_FULL';
    error.slotCount = generationMetadataArenaLayout?.slotCount ?? 0;
    throw error;
  }

  function releaseGenerationMetadataSlot(slot) {
    if (slot) slot.inUse = false;
  }

  function encodeSkinProof(encoder, prepared, {
    timestampProfiler = null,
    timestampMetadata = {},
    bindGroupCache = null,
    keepComputePassOpen = false
  } = {}) {
    if (!skinDispatchIndirectProvider || !skinReferenceCaptureEncoded) return null;
    if (typeof encoder.clearBuffer !== 'function') {
      throw new TypeError('skin reuse proof requires GPUCommandEncoder.clearBuffer support');
    }
    const timestampActive = Boolean(
      timestampProfiler?.beginComputePassDescriptor
        && timestampProfiler.active !== false
    );
    encoder.clearBuffer(skinProofEvidenceBuffer);
    const cacheRecords = bindGroupCache
      ? (bindGroupCache.skinProofBindGroupRecords ||= [])
      : [];
    let cacheRecord = cacheRecords.find((entry) => (
      entry.positionBuffer === prepared.resources.inputs.positions.buffer
        && entry.paramsBuffer === prepared.resources.scratch.params.buffer
        && entry.paramsByteOffset === prepared.resources.scratch.params.byteOffset
        && entry.sourceCandidateCsrBuffer
          === prepared.resources.outputs.sourceCandidateCsr.buffer
        && entry.capacityEvidenceBuffer === prepared.resources.outputs.capacityEvidence.buffer
        && entry.capacityEvidenceByteOffset
          === prepared.resources.outputs.capacityEvidence.byteOffset
        && entry.cellCsrBuffer === prepared.resources.outputs.cellCsr.buffer
    )) || null;
    const measureBindGroupCacheHit = Boolean(cacheRecord?.measureBindGroup);
    const measureBindGroup = cacheRecord?.measureBindGroup || device.createBindGroup({
        label: `${label}-skin-measure-bind-group`,
        layout: skinProofMeasurePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: prepared.resources.inputs.positions.buffer } },
          { binding: 1, resource: { buffer: skinReferencePositionBuffer } },
          { binding: 2, resource: { buffer: skinProofEvidenceBuffer } },
          {
            binding: 7,
            resource: exactBindingResource(prepared.resources.scratch.params)
          }
        ]
      });
    const groupedProofPass = timestampActive
      ? null
      : encoder.beginComputePass({ label: `${label}-grouped-skin-proof` });
    const measurePass = groupedProofPass || encoder.beginComputePass(
      timestampActive
        ? timestampProfiler.beginComputePassDescriptor(`${label}SkinDisplacementMeasure`, {
            ...timestampMetadata,
            residentNeighborhoodStage: 'skin-displacement-measure',
            generation: prepared.generation,
            positionEpoch: prepared.positionEpoch
          })
        : { label: `${label}-skin-displacement-measure` }
    );
    measurePass.setPipeline(skinProofMeasurePipeline);
    measurePass.setBindGroup(0, measureBindGroup);
    measurePass.dispatchWorkgroups(...prepared.dispatch);
    if (!groupedProofPass) measurePass.end();

    const finalizeBindGroupCacheHit = Boolean(cacheRecord?.finalizeBindGroup);
    const finalizeBindGroup = cacheRecord?.finalizeBindGroup || device.createBindGroup({
        label: `${label}-skin-finalize-bind-group`,
        layout: skinProofFinalizePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 2, resource: { buffer: skinProofEvidenceBuffer } },
          { binding: 3, resource: { buffer: skinDispatchBankBuffer } },
          {
            binding: 4,
            resource: { buffer: prepared.resources.outputs.sourceCandidateCsr.buffer }
          },
          {
            binding: 5,
            resource: exactBindingResource(prepared.resources.outputs.capacityEvidence)
          },
          { binding: 6, resource: { buffer: prepared.resources.outputs.cellCsr.buffer } },
          {
            binding: 7,
            resource: exactBindingResource(prepared.resources.scratch.params)
          },
          { binding: 8, resource: { buffer: skinProofCountersBuffer } }
        ]
      });
    if (!cacheRecord && bindGroupCache) {
      cacheRecord = {
        positionBuffer: prepared.resources.inputs.positions.buffer,
        paramsBuffer: prepared.resources.scratch.params.buffer,
        paramsByteOffset: prepared.resources.scratch.params.byteOffset,
        sourceCandidateCsrBuffer: prepared.resources.outputs.sourceCandidateCsr.buffer,
        capacityEvidenceBuffer: prepared.resources.outputs.capacityEvidence.buffer,
        capacityEvidenceByteOffset: prepared.resources.outputs.capacityEvidence.byteOffset,
        cellCsrBuffer: prepared.resources.outputs.cellCsr.buffer,
        measureBindGroup,
        finalizeBindGroup,
        captureBindGroup: null
      };
      cacheRecords.push(cacheRecord);
    } else if (cacheRecord) {
      cacheRecord.measureBindGroup = measureBindGroup;
      cacheRecord.finalizeBindGroup = finalizeBindGroup;
    }
    const finalizePass = groupedProofPass || encoder.beginComputePass(
      timestampActive
        ? timestampProfiler.beginComputePassDescriptor(`${label}SkinReuseFinalize`, {
            ...timestampMetadata,
            residentNeighborhoodStage: 'skin-reuse-finalize',
            generation: prepared.generation,
            positionEpoch: prepared.positionEpoch
          })
        : { label: `${label}-skin-reuse-finalize` }
    );
    finalizePass.setPipeline(skinProofFinalizePipeline);
    finalizePass.setBindGroup(0, finalizeBindGroup);
    finalizePass.dispatchWorkgroups(1, 1, 1);
    if (!keepComputePassOpen) finalizePass.end();
    return {
      schema: 'peercompute.ulg.resident-neighborhood-skin-reuse-proof.v0',
      status: 'resident-neighborhood-skin-reuse-proof-encoded-gpu-authoritative',
      evidenceBuffer: skinProofEvidenceBuffer,
      dispatchIndirectProvider: skinDispatchIndirectProvider,
      referencePositionBuffer: skinReferencePositionBuffer,
      generation: prepared.generation,
      positionEpoch: prepared.positionEpoch,
      skinDistanceM: resolvedSkinDistance,
      displacementBudgetM: resolvedSkinDistance * 0.5,
      decisionAuthority: 'same-encoder-gpu-reduction',
      encodedComputePassCount: timestampActive ? 2 : 1,
      bindGroupCreationCount:
        Number(!measureBindGroupCacheHit) + Number(!finalizeBindGroupCacheHit),
      bindGroupReuseCount:
        Number(measureBindGroupCacheHit) + Number(finalizeBindGroupCacheHit),
      computePass: keepComputePassOpen ? finalizePass : null,
      mapPerformed: false,
      readbackPerformed: false
    };
  }

  function encodeSkinReferenceCapture(encoder, prepared, {
    dispatchIndirectProvider = null,
    timestampProfiler = null,
    timestampMetadata = {},
    bindGroupCache = null,
    computePass = null
  } = {}) {
    if (!skinReferenceCapturePipeline) return null;
    const cacheRecords = bindGroupCache
      ? (bindGroupCache.skinProofBindGroupRecords ||= [])
      : [];
    let cacheRecord = cacheRecords.find((entry) => (
      entry.positionBuffer === prepared.resources.inputs.positions.buffer
        && entry.paramsBuffer === prepared.resources.scratch.params.buffer
        && entry.paramsByteOffset === prepared.resources.scratch.params.byteOffset
        && entry.sourceCandidateCsrBuffer
          === prepared.resources.outputs.sourceCandidateCsr.buffer
    )) || null;
    const bindGroupCacheHit = Boolean(cacheRecord?.captureBindGroup);
    const bindGroup = cacheRecord?.captureBindGroup || device.createBindGroup({
        label: `${label}-skin-reference-capture-bind-group`,
        layout: skinReferenceCapturePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: prepared.resources.inputs.positions.buffer } },
          { binding: 1, resource: { buffer: skinReferencePositionBuffer } },
          {
            binding: 4,
            resource: { buffer: prepared.resources.outputs.sourceCandidateCsr.buffer }
          },
          {
            binding: 7,
            resource: exactBindingResource(prepared.resources.scratch.params)
          }
        ]
      });
    if (cacheRecord) {
      cacheRecord.captureBindGroup = bindGroup;
    } else if (bindGroupCache) {
      cacheRecord = {
        positionBuffer: prepared.resources.inputs.positions.buffer,
        paramsBuffer: prepared.resources.scratch.params.buffer,
        paramsByteOffset: prepared.resources.scratch.params.byteOffset,
        sourceCandidateCsrBuffer: prepared.resources.outputs.sourceCandidateCsr.buffer,
        capacityEvidenceBuffer: prepared.resources.outputs.capacityEvidence.buffer,
        capacityEvidenceByteOffset: prepared.resources.outputs.capacityEvidence.byteOffset,
        cellCsrBuffer: prepared.resources.outputs.cellCsr.buffer,
        measureBindGroup: null,
        finalizeBindGroup: null,
        captureBindGroup: bindGroup
      };
      cacheRecords.push(cacheRecord);
    }
    const pass = computePass || encoder.beginComputePass(
      timestampProfiler?.beginComputePassDescriptor
        && timestampProfiler.active !== false
        ? timestampProfiler.beginComputePassDescriptor(`${label}SkinReferenceCapture`, {
            ...timestampMetadata,
            residentNeighborhoodStage: 'skin-reference-capture',
            generation: prepared.generation,
            positionEpoch: prepared.positionEpoch
          })
        : { label: `${label}-skin-reference-capture` }
    );
    pass.setPipeline(skinReferenceCapturePipeline);
    pass.setBindGroup(0, bindGroup);
    if (dispatchIndirectProvider) {
      if (!pass.dispatchWorkgroupsIndirect) {
        throw new TypeError('gated skin reference capture requires indirect dispatch support');
      }
      pass.dispatchWorkgroupsIndirect(
        dispatchIndirectProvider.buffer,
        dispatchIndirectProvider.byteOffsetFor(prepared.dispatch)
      );
    } else {
      pass.dispatchWorkgroups(...prepared.dispatch);
    }
    if (!computePass) pass.end();
    skinReferenceCaptureEncoded = true;
    return {
      status: dispatchIndirectProvider
        ? 'skin-reference-capture-gated-by-rebuild-admission'
        : 'skin-reference-capture-initial-build',
      dispatchMode: dispatchIndirectProvider ? 'gpu-indirect-gated' : 'direct-initial-build',
      encodedComputePassCount: computePass ? 0 : 1,
      bindGroupCreationCount: bindGroupCacheHit ? 0 : 1,
      bindGroupReuseCount: bindGroupCacheHit ? 1 : 0
    };
  }

  function allocateMutationCertificate({
    stageKind,
    targetGeneration,
    leaseTokenLow: targetLeaseTokenLow,
    leaseTokenHigh: targetLeaseTokenHigh,
    targetPositionEpoch,
    sourceCount = count,
    authorityEpoch = 0,
    forceRebuild = false,
    authorityRebase = false,
    continuityRejected = false,
    writerSeen = false
  } = {}, { allowReferenceCheckpoint = false } = {}) {
    if (!mutationCertificateArenaBuffer) return null;
    if (destroyed) throw new Error(`${label} is destroyed`);
    const resolvedStageKind = residentNeighborhoodMutationStageId(stageKind);
    if (resolvedStageKind === RESIDENT_NEIGHBORHOOD_MUTATION_STAGE.REFERENCE_CHECKPOINT
      && !allowReferenceCheckpoint) {
      throw new RangeError(
        'REFERENCE_CHECKPOINT is reserved for a lane-authored rebuild checkpoint'
      );
    }
    if (writerSeen && !allowReferenceCheckpoint) {
      throw new RangeError('mutation writerSeen must be authored by the GPU writer stage');
    }
    const resolvedSourceCount = uint32(sourceCount, 'mutation sourceCount');
    if (resolvedSourceCount !== count) {
      throw new RangeError(`mutation sourceCount ${resolvedSourceCount} does not match lane ${count}`);
    }
    if (mutationCertificateNonce >= UINT32_MAX) {
      const error = new RangeError('resident mutation certificate nonce exhausted');
      error.code = 'ERR_RESIDENT_NEIGHBORHOOD_MUTATION_NONCE_EXHAUSTED';
      throw error;
    }
    const slot = mutationCertificateSlots.find((entry) => !entry.inUse);
    if (!slot) {
      const error = new Error(
        `resident mutation certificate arena exhausted (${mutationCertificateSlotCount} slots)`
      );
      error.code = 'ERR_RESIDENT_NEIGHBORHOOD_MUTATION_ARENA_FULL';
      error.slotCount = mutationCertificateSlotCount;
      throw error;
    }
    let controlFlags = forceRebuild
      ? RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG.FORCE_REBUILD
      : 0;
    if (authorityRebase) {
      controlFlags |= RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG.AUTHORITY_REBASE;
      controlFlags |= RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG.FORCE_REBUILD;
    }
    if (continuityRejected) {
      controlFlags |= RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG.CONTINUITY_REJECTED;
      controlFlags |= RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG.FORCE_REBUILD;
    }
    const nonce = mutationCertificateNonce + 1;
    const words = createResidentNeighborhoodMutationCertificateSlotWords({
      nonce,
      stageKind: resolvedStageKind,
      targetGeneration,
      leaseTokenLow: targetLeaseTokenLow,
      leaseTokenHigh: targetLeaseTokenHigh,
      targetPositionEpoch,
      sourceCount: resolvedSourceCount,
      authorityEpoch,
      controlFlags,
      writerSeen
    });
    device.queue.writeBuffer(mutationCertificateArenaBuffer, slot.byteOffset, words);
    mutationCertificateNonce = nonce;
    slot.inUse = true;
    const certificate = {
      schema: 'peercompute.ulg.resident-neighborhood-mutation-certificate.v0',
      status: 'resident-neighborhood-mutation-certificate-armed',
      laneToken: mutationCertificateLaneToken,
      slot,
      buffer: mutationCertificateArenaBuffer,
      byteOffset: slot.byteOffset,
      byteLength: RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_BYTES,
      slotIndex: slot.slotIndex,
      slotStrideByteLength: mutationCertificateSlotStrideBytes,
      nonce,
      stageKind: words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.STAGE_KIND],
      targetGeneration: words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.TARGET_GENERATION],
      leaseTokenLow: words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.LEASE_TOKEN_LOW],
      leaseTokenHigh: words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.LEASE_TOKEN_HIGH],
      targetPositionEpoch:
        words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.TARGET_POSITION_EPOCH],
      sourceCount: resolvedSourceCount,
      authorityEpoch: words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.AUTHORITY_EPOCH],
      controlFlags: words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.CONTROL_FLAGS],
      writerSeen: writerSeen === true,
      decisionEncoded: false,
      consumedByGeneration: false,
      reservedByGeneration: null,
      released: false,
      writerBindingResource: {
        buffer: mutationCertificateArenaBuffer,
        offset: 0,
        size: RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_BYTES
      },
      writerBindingDynamicOffset: slot.byteOffset,
      writerBindingDynamicOffsets: Object.freeze([slot.byteOffset])
    };
    slot.certificate = certificate;
    return certificate;
  }

  function acquireMutationCertificate(args = {}) {
    return allocateMutationCertificate(args, { allowReferenceCheckpoint: false });
  }

  function assertMutationCertificate(certificate, {
    preparedGeneration = null,
    allowDecisionEncoded = false
  } = {}) {
    if (!certificate || certificate.laneToken !== mutationCertificateLaneToken
      || certificate.released || certificate.slot?.certificate !== certificate) {
      throw new TypeError('mutation certificate is not an active certificate for this lane');
    }
    if (certificate.consumedByGeneration) {
      throw new Error('mutation certificate was already consumed by a generation');
    }
    if (certificate.reservedByGeneration
      && certificate.reservedByGeneration !== preparedGeneration) {
      throw new Error('mutation certificate is reserved by another prepared generation');
    }
    if (certificate.decisionEncoded && !allowDecisionEncoded) {
      throw new Error('mutation certificate decision was already finalized');
    }
    return certificate;
  }

  function releaseMutationCertificate(certificate, preparedGeneration = null) {
    if (!certificate || certificate.laneToken !== mutationCertificateLaneToken
      || certificate.released) return false;
    if (certificate.reservedByGeneration
      && certificate.reservedByGeneration !== preparedGeneration) return false;
    certificate.released = true;
    certificate.status = 'resident-neighborhood-mutation-certificate-released';
    certificate.reservedByGeneration = null;
    certificate.slot.inUse = false;
    certificate.slot.certificate = null;
    return true;
  }

  function encodeMutationDecision(encoder, prepared, certificate, {
    timestampProfiler = null,
    timestampMetadata = {},
    bindGroupCache = null,
    computePass = null,
    preparedGeneration = null
  } = {}) {
    const resolvedCertificate = assertMutationCertificate(certificate, { preparedGeneration });
    if (!skinDispatchIndirectProvider || !skinReferenceCheckpointEncoded) return null;
    if (resolvedCertificate.targetGeneration !== prepared.generation
      || resolvedCertificate.targetPositionEpoch !== prepared.positionEpoch) {
      throw new RangeError('mutation certificate generation/position epoch mismatch');
    }
    const timestampActive = Boolean(
      timestampProfiler?.beginComputePassDescriptor
        && timestampProfiler.active !== false
    );
    const cacheRecords = bindGroupCache
      ? (bindGroupCache.skinProofBindGroupRecords ||= [])
      : [];
    let cacheRecord = cacheRecords.find((entry) => (
      entry.sourceCandidateCsrBuffer
          === prepared.resources.outputs.sourceCandidateCsr.buffer
        && entry.capacityEvidenceBuffer === prepared.resources.outputs.capacityEvidence.buffer
        && entry.capacityEvidenceByteOffset
          === prepared.resources.outputs.capacityEvidence.byteOffset
        && entry.cellCsrBuffer === prepared.resources.outputs.cellCsr.buffer
    )) || null;
    const finalizeBindGroupCacheHit = Boolean(cacheRecord?.finalizeBindGroup);
    const finalizeBindGroup = cacheRecord?.finalizeBindGroup || device.createBindGroup({
        label: `${label}-mutation-certificate-finalize-bind-group`,
        layout: mutationProofFinalizeBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: mutationCertificateAccumulatorBuffer } },
          { binding: 1, resource: resolvedCertificate.writerBindingResource },
          { binding: 2, resource: { buffer: skinDispatchBankBuffer } },
          {
            binding: 3,
            resource: { buffer: prepared.resources.outputs.sourceCandidateCsr.buffer }
          },
          {
            binding: 4,
            resource: exactBindingResource(prepared.resources.outputs.capacityEvidence)
          },
          { binding: 5, resource: { buffer: prepared.resources.outputs.cellCsr.buffer } },
          { binding: 6, resource: { buffer: skinProofCountersBuffer } }
        ]
      });
    if (!cacheRecord && bindGroupCache) {
      cacheRecord = {
        sourceCandidateCsrBuffer: prepared.resources.outputs.sourceCandidateCsr.buffer,
        capacityEvidenceBuffer: prepared.resources.outputs.capacityEvidence.buffer,
        capacityEvidenceByteOffset: prepared.resources.outputs.capacityEvidence.byteOffset,
        cellCsrBuffer: prepared.resources.outputs.cellCsr.buffer,
        finalizeBindGroup,
        commitBindGroup: null
      };
      cacheRecords.push(cacheRecord);
    } else if (cacheRecord) {
      cacheRecord.finalizeBindGroup = finalizeBindGroup;
    }
    const finalizePass = computePass || encoder.beginComputePass(
      timestampActive
        ? timestampProfiler.beginComputePassDescriptor(`${label}MutationCertificateFinalize`, {
            ...timestampMetadata,
            residentNeighborhoodStage: 'mutation-certificate-finalize',
            generation: prepared.generation,
            positionEpoch: prepared.positionEpoch
          })
        : { label: `${label}-mutation-certificate-finalize` }
    );
    finalizePass.setPipeline(mutationProofFinalizePipeline);
    finalizePass.setBindGroup(
      0,
      finalizeBindGroup,
      resolvedCertificate.writerBindingDynamicOffsets
    );
    finalizePass.dispatchWorkgroups(1, 1, 1);
    if (!computePass) finalizePass.end();
    resolvedCertificate.decisionEncoded = true;
    resolvedCertificate.status = 'resident-neighborhood-mutation-decision-encoded';
    return {
      schema: 'peercompute.ulg.resident-neighborhood-mutation-certificate-decision.v0',
      status: 'resident-neighborhood-mutation-certificate-decision-encoded',
      evidenceBuffer: mutationCertificateAccumulatorBuffer,
      mutationSlotBuffer: mutationCertificateArenaBuffer,
      mutationSlotByteOffset: resolvedCertificate.byteOffset,
      dispatchIndirectProvider: skinDispatchIndirectProvider,
      generation: prepared.generation,
      positionEpoch: prepared.positionEpoch,
      skinDistanceM: resolvedSkinDistance,
      displacementBudgetM: resolvedSkinDistance * 0.5,
      decisionAuthority: 'mutation-authored-upward-rounded-l1-cumulative-gpu-certificate',
      encodedComputePassCount: computePass ? 0 : 1,
      bindGroupCreationCount: Number(!finalizeBindGroupCacheHit),
      bindGroupReuseCount: Number(finalizeBindGroupCacheHit),
      computePass,
      mapPerformed: false,
      readbackPerformed: false
    };
  }

  function encodeReferenceCheckpointCommit(encoder, prepared, certificate, {
    dispatchIndirectProvider = null,
    timestampProfiler = null,
    timestampMetadata = {},
    bindGroupCache = null,
    computePass = null,
    preparedGeneration = null
  } = {}) {
    if (!mutationReferenceCommitPipeline) return null;
    const resolvedCertificate = assertMutationCertificate(certificate, {
      preparedGeneration,
      allowDecisionEncoded: true
    });
    const cacheRecords = bindGroupCache
      ? (bindGroupCache.skinProofBindGroupRecords ||= [])
      : [];
    let cacheRecord = cacheRecords.find((entry) => (
      entry.sourceCandidateCsrBuffer
          === prepared.resources.outputs.sourceCandidateCsr.buffer
    )) || null;
    const bindGroupCacheHit = Boolean(cacheRecord?.commitBindGroup);
    const bindGroup = cacheRecord?.commitBindGroup || device.createBindGroup({
        label: `${label}-mutation-reference-checkpoint-bind-group`,
        layout: mutationReferenceCommitBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: mutationCertificateAccumulatorBuffer } },
          { binding: 1, resource: resolvedCertificate.writerBindingResource },
          { binding: 3, resource: { buffer: prepared.resources.outputs.sourceCandidateCsr.buffer } }
        ]
      });
    if (cacheRecord) {
      cacheRecord.commitBindGroup = bindGroup;
    } else if (bindGroupCache) {
      cacheRecord = {
        sourceCandidateCsrBuffer: prepared.resources.outputs.sourceCandidateCsr.buffer,
        capacityEvidenceBuffer: prepared.resources.outputs.capacityEvidence.buffer,
        capacityEvidenceByteOffset: prepared.resources.outputs.capacityEvidence.byteOffset,
        cellCsrBuffer: prepared.resources.outputs.cellCsr.buffer,
        finalizeBindGroup: null,
        commitBindGroup: bindGroup
      };
      cacheRecords.push(cacheRecord);
    }
    const pass = computePass || encoder.beginComputePass(
      timestampProfiler?.beginComputePassDescriptor
        && timestampProfiler.active !== false
        ? timestampProfiler.beginComputePassDescriptor(`${label}MutationReferenceCheckpoint`, {
            ...timestampMetadata,
            residentNeighborhoodStage: 'mutation-reference-checkpoint',
            generation: prepared.generation,
            positionEpoch: prepared.positionEpoch
          })
        : { label: `${label}-mutation-reference-checkpoint` }
    );
    pass.setPipeline(mutationReferenceCommitPipeline);
    pass.setBindGroup(0, bindGroup, resolvedCertificate.writerBindingDynamicOffsets);
    if (dispatchIndirectProvider) {
      if (!pass.dispatchWorkgroupsIndirect) {
        throw new TypeError('gated mutation reference checkpoint requires indirect dispatch support');
      }
      pass.dispatchWorkgroupsIndirect(
        dispatchIndirectProvider.buffer,
        dispatchIndirectProvider.byteOffsetFor([1, 1, 1], 'mutation-reference-checkpoint')
      );
    } else {
      pass.dispatchWorkgroups(1, 1, 1);
    }
    if (!computePass) pass.end();
    skinReferenceCheckpointEncoded = true;
    return {
      status: dispatchIndirectProvider
        ? 'mutation-reference-checkpoint-gated-by-rebuild-admission'
        : 'mutation-reference-checkpoint-initial-build',
      dispatchMode: dispatchIndirectProvider ? 'gpu-indirect-gated' : 'direct-initial-build',
      encodedComputePassCount: computePass ? 0 : 1,
      bindGroupCreationCount: bindGroupCacheHit ? 0 : 1,
      bindGroupReuseCount: bindGroupCacheHit ? 1 : 0
    };
  }

  function prepareGeneration(encoder, {
    positionBuffer,
    positionStrideU32 = 8,
    positionOffsetU32 = 0,
    chartLevelBuffer: providedChartLevelBuffer = null,
    chartLevelByteOffset = 0,
    supportClassBuffer: providedSupportClassBuffer = null,
    supportClassByteOffset = 0,
    sourceSupportAssignmentBuffer: providedSourceSupportAssignmentBuffer = null,
    sourceSupportAssignmentByteOffset = 0,
    leaseAuthorityIdentity = null,
    encodeSourceMetadata = null,
    mutationCertificate = null,
    mutationAuthorityEpoch = 0,
    timestampProfiler = null,
    timestampMetadata = {},
    mutationPhase = 'post-position-mutation',
    substepIndex = 0,
    generation = checkedUint32Add(
      resolvedGenerationBase,
      substepIndex,
      'generation'
    ),
    positionEpoch = checkedUint32Add(
      resolvedPositionEpochBase,
      substepIndex,
      'positionEpoch'
    ),
    generationLeaseTokenLow = checkedUint32Add(
      resolvedLeaseTokenLow,
      substepIndex,
      'generationLeaseTokenLow'
    ),
    generationLeaseTokenHigh = checkedUint32Add(
      resolvedLeaseTokenHigh,
      substepIndex,
      'generationLeaseTokenHigh'
    )
  } = {}) {
    if (destroyed) throw new Error(`${label} is destroyed`);
    if (!encoder?.beginComputePass || !encoder?.copyBufferToBuffer) {
      throw new TypeError('resident neighborhood generation requires a caller-owned encoder');
    }
    const resolvedGeneration = uint32(generation, 'generation');
    const resolvedPositionEpoch = uint32(positionEpoch, 'positionEpoch');
    const identity = authoritative
      ? assertLeaseAuthorityIdentity(leaseAuthorityIdentity, {
          laneId: resolvedLaneId,
          stateKey: resolvedStateKey,
          sourceFamily: resolvedSourceFamily
        })
      : (leaseAuthorityIdentity
          ? assertLeaseAuthorityIdentity(leaseAuthorityIdentity, {
              laneId: resolvedLaneId,
              stateKey: resolvedStateKey,
              sourceFamily: resolvedSourceFamily
            })
          : null);
    const tokenLow = uint32(generationLeaseTokenLow, 'generationLeaseTokenLow');
    const tokenHigh = uint32(generationLeaseTokenHigh, 'generationLeaseTokenHigh');
    const resolvedMutationAuthorityEpoch = uint32(
      mutationAuthorityEpoch,
      'mutationAuthorityEpoch'
    );
    const suppliedMutationCertificate = mutationCertificate !== null;
    let activeMutationCertificate = mutationCertificate;
    if (activeMutationCertificate) {
      assertMutationCertificate(activeMutationCertificate);
      if (activeMutationCertificate.targetGeneration !== resolvedGeneration
        || activeMutationCertificate.leaseTokenLow !== tokenLow
        || activeMutationCertificate.leaseTokenHigh !== tokenHigh
        || activeMutationCertificate.targetPositionEpoch !== resolvedPositionEpoch
        || activeMutationCertificate.sourceCount !== count
        || activeMutationCertificate.authorityEpoch !== resolvedMutationAuthorityEpoch) {
        throw new RangeError('mutation certificate target identity does not match generation');
      }
      if (!skinReferenceCheckpointEncoded) {
        const error = new Error(
          'certified mutation reuse requires a predecessor rebuild checkpoint'
        );
        error.code = 'ERR_RESIDENT_NEIGHBORHOOD_MUTATION_NO_REFERENCE_CHECKPOINT';
        throw error;
      }
    } else if (mutationCertificateEnabled) {
      activeMutationCertificate = allocateMutationCertificate({
        stageKind: RESIDENT_NEIGHBORHOOD_MUTATION_STAGE.REFERENCE_CHECKPOINT,
        targetGeneration: resolvedGeneration,
        leaseTokenLow: tokenLow,
        leaseTokenHigh: tokenHigh,
        targetPositionEpoch: resolvedPositionEpoch,
        authorityEpoch: resolvedMutationAuthorityEpoch,
        forceRebuild: true,
        writerSeen: false
      }, { allowReferenceCheckpoint: true });
    }
    const leaseId = identity?.leaseId ?? `${resolvedLeasePrefix}:${resolvedGeneration}`;
    const descriptor = createResidentNeighborhoodDescriptor({
      generation: resolvedGeneration,
      leaseId,
      laneId: resolvedLaneId,
      stateKey: resolvedStateKey,
      sourceFamily: resolvedSourceFamily,
      deviceId: webGpuDeviceId(device) || '',
      leaseTokenLow: tokenLow,
      leaseTokenHigh: tokenHigh,
      leaseAuthorityIdentity: identity,
      supportClasses: configuredSupportClasses,
      sourceSupportAssignments: configuredSourceSupportAssignments,
      positionEpoch: resolvedPositionEpoch,
      skinDistanceM: resolvedSkinDistance,
      maxDisplacementM: resolvedMaxDisplacement,
      sourceCount: count,
      requiredUniqueCellCount: count,
      requiredCellMemberCount: count,
      requiredCandidateCount: globalCandidateCapacity,
      capacities: {
        uniqueCellCount: count,
        cellOffsetCount: count + 1,
        cellMemberCount: count,
        sourceOffsetCount: count + 1,
        sourceSupportAssignmentCount: count,
        candidateCount: globalCandidateCapacity
      }
    });
    let paramsBuffer = null;
    let paramsByteOffset = 0;
    let supportClassBuffer = providedSupportClassBuffer;
    let resolvedSupportClassByteOffset = supportClassByteOffset;
    let resolvedChartLevelBuffer = providedChartLevelBuffer;
    let resolvedSourceSupportAssignmentBuffer = providedSourceSupportAssignmentBuffer;
    let ownsSupportClassBuffer = false;
    let generationMetadataSlot = null;
    if (resolvedSourceMetadataMode === 'external-gpu-per-source') {
      if (!resolvedChartLevelBuffer || !supportClassBuffer
        || !resolvedSourceSupportAssignmentBuffer) {
        throw new TypeError(
          'external-gpu-per-source metadata requires chart, support-class, and assignment buffers'
        );
      }
    } else {
      generationMetadataSlot = acquireGenerationMetadataSlot();
      resolvedChartLevelBuffer = chartLevelBuffer;
      resolvedSourceSupportAssignmentBuffer = sourceSupportAssignmentBuffer;
      const params = generationMetadataSlot.metadataParamsWords;
      params.fill(0);
      params[0] = count;
      params[1] = resolvedGeneration;
      params[2] = uint32(chartId, 'chartId');
      params[3] = encodeResidentNeighborhoodSignedOrderKey(level);
      params[4] = float32Bits(cellSize);
      params[5] = float32Bits(resolvedOrigin[0]);
      params[6] = float32Bits(resolvedOrigin[1]);
      params[7] = float32Bits(resolvedOrigin[2]);
      params[8] = RESIDENT_NEIGHBORHOOD_CHART_FLAG.VALID
        | RESIDENT_NEIGHBORHOOD_CHART_FLAG.DYADIC_LEVELS;
      params.set(descriptor.sourceSupportAssignments.rows, 9);
      params[17] = dispatch[0];
      params[18] = descriptor.packedCsr.regions.sourceSupportAssignments.baseU32;
      paramsBuffer = generationMetadataSlot.paramsBuffer;
      paramsByteOffset = generationMetadataSlot.paramsByteOffset;
      const supportClassRows = writeSupportClassRows(
        generationMetadataSlot.supportClassWords,
        descriptor.supportClasses
      );
      supportClassBuffer = generationMetadataSlot.supportClassBuffer;
      resolvedSupportClassByteOffset = generationMetadataSlot.supportClassByteOffset;
      device.queue.writeBuffer(paramsBuffer, paramsByteOffset, params);
      device.queue.writeBuffer(
        supportClassBuffer,
        resolvedSupportClassByteOffset,
        supportClassRows
      );
    }
    let build = null;
    try {
      const preparedBuild = builder.prepare({
        descriptor,
        positionBuffer,
        positionStrideU32,
        positionOffsetU32,
        chartLevelBuffer: resolvedChartLevelBuffer,
        chartLevelByteOffset,
        supportClassBuffer,
        supportClassByteOffset: resolvedSupportClassByteOffset,
        sourceSupportAssignmentBuffer: resolvedSourceSupportAssignmentBuffer,
        sourceSupportAssignmentByteOffset,
        denseUniformChart: resolvedDenseUniformChart,
        sourceMetadataMode: resolvedSourceMetadataMode,
        sourceMetadataDirectGpuWrite:
          resolvedSourceMetadataMode === 'uniform-gpu-expanded'
      });
      build = preparedBuild;
      const conditionalLegacySkinReuse = legacySkinReuseEnabled
        && resolvedSourceMetadataMode === 'uniform-gpu-expanded'
        && skinDispatchIndirectProvider !== null
        && skinReferenceCaptureEncoded;
      const conditionalMutationCertificateReuse = mutationCertificateEnabled
        && mutationCertificate !== null
        && resolvedSourceMetadataMode === 'uniform-gpu-expanded'
        && skinDispatchIndirectProvider !== null
        && skinReferenceCheckpointEncoded;
      const conditionalSkinReuse = conditionalLegacySkinReuse
        || conditionalMutationCertificateReuse;
      const timestampActive = Boolean(
        timestampProfiler?.beginComputePassDescriptor
          && timestampProfiler.active !== false
      );
      const generationTimestampMetadata = timestampActive
        ? {
            ...timestampMetadata,
            generation: resolvedGeneration,
            positionEpoch: resolvedPositionEpoch,
            mutationPhase
          }
        : null;
      const groupConditionalAuxiliaryPasses = conditionalSkinReuse && !timestampActive;
      const groupInitialMutationBuild = mutationCertificateEnabled
        && !conditionalSkinReuse
        && preparedBuild.directSegmentedMasked === true
        && !timestampActive;
      const groupBuilderAuxiliaryPasses = groupConditionalAuxiliaryPasses
        || groupInitialMutationBuild;
      if (resolvedSourceMetadataMode === 'uniform-gpu-expanded') {
        builder.encodePrelude(encoder, preparedBuild, {
          conditionalGeneration: conditionalSkinReuse
        });
      }
      const encodedIndirectDispatchCountBefore = skinEncodedIndirectDispatchCount;
      const preparedGeneration = {
        schema: 'peercompute.ulg.resident-neighborhood-prepared-generation.v0',
        status: 'resident-neighborhood-generation-prepared',
        laneToken: preparedGenerationLaneToken,
        encoder,
        preparedBuild,
        mutationCertificate: activeMutationCertificate,
        suppliedMutationCertificate,
        generation: resolvedGeneration,
        positionEpoch: resolvedPositionEpoch,
        leaseTokenLow: tokenLow,
        leaseTokenHigh: tokenHigh,
        sourceCount: count,
        authorityEpoch: resolvedMutationAuthorityEpoch,
        conditionalLegacySkinReuse,
        conditionalMutationCertificateReuse,
        conditionalSkinReuse,
        decisionRequired: conditionalSkinReuse,
        decisionRecorded: false,
        skinReuseProof: null,
        finished: false,
        cancelled: false,
        result: null,
        writerBindingResource: conditionalMutationCertificateReuse
          ? activeMutationCertificate.writerBindingResource
          : null,
        writerBindingDynamicOffset: conditionalMutationCertificateReuse
          ? activeMutationCertificate.writerBindingDynamicOffset
          : null,
        writerBindingDynamicOffsets: conditionalMutationCertificateReuse
          ? activeMutationCertificate.writerBindingDynamicOffsets
          : null,
        _finish: null,
        _cancel: null,
        _generationMetadataSlot: generationMetadataSlot,
        _timestampProfiler: timestampProfiler,
        _generationTimestampMetadata: generationTimestampMetadata
      };
      if (activeMutationCertificate) {
        activeMutationCertificate.reservedByGeneration = preparedGeneration;
        activeMutationCertificate.status = conditionalMutationCertificateReuse
          ? 'resident-neighborhood-mutation-certificate-generation-reserved'
          : 'resident-neighborhood-rebuild-checkpoint-reserved';
      }
      activePreparedGenerations.add(preparedGeneration);
      const finishPrepared = () => {
      if (preparedGeneration.finished || preparedGeneration.cancelled) {
        throw new Error('prepared resident neighborhood generation is no longer active');
      }
      if (conditionalSkinReuse && !preparedGeneration.decisionRecorded) {
        throw new Error('prepared resident neighborhood generation requires a finalized decision');
      }
      const skinReuseProof = preparedGeneration.skinReuseProof;
      let recordUniformSourceMetadata = null;
      let initializerBindGroupCreationCount = 0;
      let initializerBindGroupReuseCount = 0;
      if (resolvedSourceMetadataMode === 'uniform-gpu-expanded') {
        const initializerBindGroupCacheHit = Boolean(generationMetadataSlot.initializerBindGroup);
        const bindGroup = generationMetadataSlot.initializerBindGroup
          || device.createBindGroup({
            label: `${label}-metadata-arena-${generationMetadataSlot.slotIndex}-source-metadata`,
            layout: initializerPipeline.getBindGroupLayout(0),
            entries: [
              {
                binding: 0,
                resource: { buffer: preparedBuild.resources.scratch.metadata.buffer }
              },
              {
                binding: 1,
                resource: {
                  buffer: preparedBuild.resources.outputs.sourceCandidateCsr.buffer
                }
              },
              {
                binding: 2,
                resource: {
                  buffer: paramsBuffer,
                  offset: paramsByteOffset,
                  size: SOURCE_METADATA_PARAMS_U32 * U32_BYTES
                }
              }
            ]
          });
        generationMetadataSlot.initializerBindGroup = bindGroup;
        initializerBindGroupCreationCount = initializerBindGroupCacheHit ? 0 : 1;
        initializerBindGroupReuseCount = initializerBindGroupCacheHit ? 1 : 0;
        const sourceMetadataLabel = `${label}SourceMetadata`;
        recordUniformSourceMetadata = (pass) => {
          pass.setPipeline(initializerPipeline);
          pass.setBindGroup(0, bindGroup);
          if (conditionalSkinReuse) {
            pass.dispatchWorkgroupsIndirect(
              skinDispatchIndirectProvider.buffer,
              skinDispatchIndirectProvider.byteOffsetFor(dispatch)
            );
          } else {
            pass.dispatchWorkgroups(...dispatch);
          }
        };
        if (!groupBuilderAuxiliaryPasses) {
          const pass = encoder.beginComputePass(
            timestampActive
              ? timestampProfiler.beginComputePassDescriptor(sourceMetadataLabel, {
                  ...generationTimestampMetadata,
                  residentNeighborhoodStage: 'source-metadata'
                })
              : { label: `${label}-generation-${resolvedGeneration}-source-metadata` }
          );
          recordUniformSourceMetadata(pass);
          pass.end();
        }
      } else if (encodeSourceMetadata !== null) {
        if (typeof encodeSourceMetadata !== 'function') {
          throw new TypeError('encodeSourceMetadata must be a function when provided');
        }
        encodeSourceMetadata(encoder, {
          generation: resolvedGeneration,
          positionEpoch: resolvedPositionEpoch,
          sourceCount: count,
          chartLevelBuffer: resolvedChartLevelBuffer,
          chartLevelByteOffset,
          supportClassBuffer,
          supportClassByteOffset,
          sourceSupportAssignmentBuffer: resolvedSourceSupportAssignmentBuffer,
          sourceSupportAssignmentByteOffset,
          supportClasses: descriptor.supportClasses,
          sourceSupportAssignments: descriptor.sourceSupportAssignments,
          mutationPhase
        });
      }
      let skinReferenceCapture = null;
      const encodeReferenceUpdate = (options) => mutationCertificateEnabled
        ? (activeMutationCertificate
            ? encodeReferenceCheckpointCommit(
                encoder,
                preparedBuild,
                activeMutationCertificate,
                options
              )
            : null)
        : encodeSkinReferenceCapture(encoder, preparedBuild, options);
      const recordGroupedSkinReferenceCapture = groupBuilderAuxiliaryPasses
        ? (pass) => {
            skinReferenceCapture = encodeReferenceUpdate({
              dispatchIndirectProvider: skinDispatchIndirectProvider,
              timestampProfiler,
              bindGroupCache: generationMetadataSlot,
              computePass: pass,
              preparedGeneration,
              timestampMetadata: generationTimestampMetadata
            });
          }
        : null;
      const initialGroupedComputePass = groupInitialMutationBuild
        ? encoder.beginComputePass({
            label: `${label}-initial-mutation-checkpoint-build`
          })
        : null;
      build = builder.encodePrepared(encoder, preparedBuild, {
        timestampProfiler,
        timestampMetadata: generationTimestampMetadata,
        dispatchIndirectProvider: conditionalSkinReuse
          ? skinDispatchIndirectProvider
          : null,
        preserveAuthoritativeOutputs: conditionalSkinReuse,
        recordConditionalPrefix: groupBuilderAuxiliaryPasses
          ? recordUniformSourceMetadata
          : null,
        recordConditionalSuffix: recordGroupedSkinReferenceCapture,
        conditionalComputePass: initialGroupedComputePass
      });
      if (!groupBuilderAuxiliaryPasses) {
        skinReferenceCapture = encodeReferenceUpdate({
          dispatchIndirectProvider: conditionalSkinReuse
            ? skinDispatchIndirectProvider
            : null,
          timestampProfiler,
          bindGroupCache: generationMetadataSlot,
          preparedGeneration,
          timestampMetadata: generationTimestampMetadata
        });
      }
      const encodedConditionalIndirectDispatchCount = conditionalSkinReuse
        ? skinEncodedIndirectDispatchCount - encodedIndirectDispatchCountBefore
        : 0;
      const record = {
        build,
        paramsBuffer,
        paramsByteOffset,
        supportClassBuffer,
        supportClassByteOffset: resolvedSupportClassByteOffset,
        ownsSupportClassBuffer,
        generationMetadataSlot,
        mutationCertificate: activeMutationCertificate,
        released: false
      };
      build.productionLane = {
        schema: ULG_RESIDENT_NEIGHBORHOOD_GPU_LANE_SCHEMA,
        status: 'resident-neighborhood-production-generation-encoded',
        laneId: resolvedLaneId,
        stateKey: resolvedStateKey,
        sourceFamily: resolvedSourceFamily,
        leaseId,
        authoritative: descriptor.lease.authoritative,
        generation: resolvedGeneration,
        positionEpoch: resolvedPositionEpoch,
        mutationPhase,
        substepIndex,
        consumers: [...resolvedConsumers.names],
        supportDistanceM: supportDistance,
        cellSizeM: cellSize,
        cellRadius,
        skinCellPadding,
        maxBuilderCellRadius,
        maxCandidatesPerSource: perSourceCapacity,
        candidateCapacity: globalCandidateCapacity,
        builderStrategy: builderStrategyPlan.strategy,
        builderStrategyPlan,
        denseUniformChart: resolvedDenseUniformChart,
        directSegmentedMasked: build.directSegmentedMasked === true,
        encodingTelemetry: {
          encodedDispatchCount: (build.encodingTelemetry?.encodedDispatchCount ?? 0)
            + (conditionalLegacySkinReuse ? 2 : (conditionalMutationCertificateReuse ? 1 : 0))
            + (skinReferenceCapture ? 1 : 0)
            + (resolvedSourceMetadataMode === 'uniform-gpu-expanded' ? 1 : 0),
          encodedComputePassCount: (build.encodingTelemetry?.encodedComputePassCount ?? 0)
            + (skinReuseProof?.encodedComputePassCount ?? 0)
            + (skinReferenceCapture?.encodedComputePassCount ?? 0)
            + (resolvedSourceMetadataMode === 'uniform-gpu-expanded'
                && !groupBuilderAuxiliaryPasses ? 1 : 0)
            + Number(groupInitialMutationBuild),
          bindGroupCreationCount: (build.encodingTelemetry?.bindGroupCreationCount ?? 0)
            + (skinReuseProof?.bindGroupCreationCount ?? 0)
            + (skinReferenceCapture?.bindGroupCreationCount ?? 0)
            + initializerBindGroupCreationCount,
          bindGroupReuseCount: (build.encodingTelemetry?.bindGroupReuseCount ?? 0)
            + (skinReuseProof?.bindGroupReuseCount ?? 0)
            + (skinReferenceCapture?.bindGroupReuseCount ?? 0)
            + initializerBindGroupReuseCount,
          perGenerationControlArrayAllocationCount:
            (build.encodingTelemetry?.perGenerationControlArrayAllocationCount ?? 0),
          perGenerationMetadataControlArrayAllocationCount: 0,
          retainedHostTemplateWriteCount:
            (build.encodingTelemetry?.retainedControlTemplateWriteCount ?? 0)
              + (resolvedSourceMetadataMode === 'uniform-gpu-expanded' ? 2 : 0),
          hostEncodingAllocationProxyCount:
            (build.encodingTelemetry?.hostEncodingAllocationProxyCount ?? 0)
              + (skinReuseProof?.bindGroupCreationCount ?? 0)
              + (skinReferenceCapture?.bindGroupCreationCount ?? 0)
              + initializerBindGroupCreationCount,
          conditionalGeneration: conditionalSkinReuse,
          conditionalPassGrouping: groupBuilderAuxiliaryPasses
            ? (groupInitialMutationBuild
                ? 'initial-source-metadata-direct-builder-checkpoint-one-pass'
                : (conditionalLegacySkinReuse
                ? (builderStrategyPlan.strategy === 'direct'
                    ? 'skin-proof-pass-plus-one-indirect-builder-pass'
                    : 'skin-proof-prefix-radix-postfix-legal-pass-groups')
                : (builderStrategyPlan.strategy === 'direct'
                    ? 'mutation-certificate-decision-plus-one-indirect-builder-pass'
                    : 'mutation-certificate-prefix-radix-postfix-legal-pass-groups')))
            : 'timestamp-attributed-or-initial-generation-passes',
          skinGateStorageToIndirectPassBoundaryPreserved: true,
          commandsScaleWithRequestedGenerationCount: true
        },
        skinReuse: skinReuseProof
          ? {
              status: skinReuseProof.status,
              gpuProofEncoded: true,
              conditionalRebuildEncoded: true,
              referenceCapture: skinReferenceCapture?.status ?? null,
              skinDistanceM: resolvedSkinDistance,
              requestedSkinDistanceM: requestedSkinDistance,
              displacementBudgetM: resolvedSkinDistance * 0.5,
              decisionAuthority: skinReuseProof.decisionAuthority,
              encodedDispatchCommandsStillPresent: true,
              encodedConditionalIndirectDispatchCount,
              encodedProofPassCount: skinReuseProof.encodedComputePassCount,
              encodedReferenceCapturePassCount:
                skinReferenceCapture?.encodedComputePassCount ?? 0,
              groupedConditionalAuxiliaryPasses:
                groupBuilderAuxiliaryPasses,
              shaderWorkSkippedWhenReuseAdmitted: true
            }
          : {
              status: skinReferenceCapture
                ? (mutationCertificateEnabled
                    ? 'resident-neighborhood-mutation-reference-checkpoint-initialized'
                    : 'resident-neighborhood-skin-reference-initialized')
                : 'resident-neighborhood-skin-reuse-disabled',
              gpuProofEncoded: false,
              conditionalRebuildEncoded: false,
              referenceCapture: skinReferenceCapture?.status ?? null,
              skinDistanceM: resolvedSkinDistance,
              requestedSkinDistanceM: requestedSkinDistance,
              displacementBudgetM: resolvedSkinDistance * 0.5,
              decisionAuthority: null,
              encodedDispatchCommandsStillPresent: false,
              encodedConditionalIndirectDispatchCount: 0,
              encodedProofPassCount: 0,
              encodedReferenceCapturePassCount:
                skinReferenceCapture?.encodedComputePassCount ?? 0,
              groupedConditionalAuxiliaryPasses: false,
              shaderWorkSkippedWhenReuseAdmitted: false
            },
        sourceMetadataInitialization: resolvedSourceMetadataMode === 'external-gpu-per-source'
          ? 'external-gpu-per-source-same-device'
          : (conditionalSkinReuse
              ? 'uniform-gpu-expanded-same-encoder-gpu-rebuild-gated'
              : 'uniform-gpu-expanded-same-encoder'),
        sourceMetadataWriteTarget: resolvedSourceMetadataMode === 'uniform-gpu-expanded'
          ? 'builder-resident-metadata-and-packed-assignment-output-direct'
          : 'external-caller-owned',
        commandEncoderOwnership: 'caller',
        submissionOwnership: 'caller',
        queueSubmitPerformed: false,
        mapPerformed: false,
        readbackPerformed: false,
        gpuTimestampRequested: Boolean(timestampProfiler?.active),
        schedulerCreated: false
      };
      build.productionLaneValidation = {
        generation: resolvedGeneration,
        positionEpoch: resolvedPositionEpoch,
        maxDisplacementM: resolvedMaxDisplacement,
        gpuSkinReuseProof: skinReuseProof
          ? {
              schema: skinReuseProof.schema,
              evidenceBuffer: conditionalMutationCertificateReuse
                ? mutationCertificateAccumulatorBuffer
                : skinProofEvidenceBuffer,
              mutationSlotBuffer: conditionalMutationCertificateReuse
                ? mutationCertificateArenaBuffer
                : null,
              mutationSlotByteOffset: conditionalMutationCertificateReuse
                ? (activeMutationCertificate?.byteOffset ?? null)
                : null,
              dispatchBankBuffer: skinDispatchBankBuffer,
              referencePositionBuffer: conditionalLegacySkinReuse
                ? skinReferencePositionBuffer
                : null,
              countersBuffer: skinProofCountersBuffer,
              skinDistanceM: resolvedSkinDistance,
              displacementBudgetM: resolvedSkinDistance * 0.5,
              mapPerformed: false,
              readbackPerformed: false
            }
          : null,
        leaseId,
        laneId: resolvedLaneId,
        stateKey: resolvedStateKey,
        sourceFamily: resolvedSourceFamily,
        leaseTokenLow: descriptor.lease.tokenLow,
        leaseTokenHigh: descriptor.lease.tokenHigh
      };
      GENERATION_REQUIREMENTS.set(build, requirementsToken);
      build.releaseProductionLaneGeneration = () => releaseGeneration(record);
      if (activeMutationCertificate) {
        activeMutationCertificate.consumedByGeneration = true;
        activeMutationCertificate.reservedByGeneration = null;
        activeMutationCertificate.status =
          'resident-neighborhood-mutation-certificate-generation-consumed';
      }
      activePreparedGenerations.delete(preparedGeneration);
      activeGenerations.add(record);
      preparedGeneration.finished = true;
      preparedGeneration.status = 'resident-neighborhood-generation-finished';
      preparedGeneration.result = build;
      return build;
      };
      preparedGeneration._finish = finishPrepared;
      preparedGeneration._cancel = () => {
        builder.release(build);
        if (!generationMetadataSlot) paramsBuffer?.destroy?.();
        if (ownsSupportClassBuffer) supportClassBuffer?.destroy?.();
        releaseGenerationMetadataSlot(generationMetadataSlot);
        releaseMutationCertificate(activeMutationCertificate, preparedGeneration);
      };
      return preparedGeneration;
    } catch (error) {
      if (build) builder.release(build);
      if (!generationMetadataSlot) paramsBuffer?.destroy?.();
      if (ownsSupportClassBuffer) supportClassBuffer?.destroy?.();
      releaseGenerationMetadataSlot(generationMetadataSlot);
      releaseMutationCertificate(activeMutationCertificate);
      throw error;
    }
  }

  function assertPreparedGeneration(value) {
    if (!value || value.laneToken !== preparedGenerationLaneToken) {
      throw new TypeError('prepared generation is not owned by this resident neighborhood lane');
    }
    if (value.finished) throw new Error('prepared generation was already finished');
    if (value.cancelled || !activePreparedGenerations.has(value)) {
      throw new Error('prepared generation was already cancelled or released');
    }
    return value;
  }

  function recordPreparedGenerationDecision(preparedGeneration, {
    computePass = null,
    allowOwnedPass = false
  } = {}) {
    const prepared = assertPreparedGeneration(preparedGeneration);
    if (!prepared.decisionRequired) {
      throw new Error('prepared generation does not require a mutation decision');
    }
    if (prepared.decisionRecorded) {
      throw new Error('prepared generation mutation decision was already finalized');
    }
    let proof;
    if (prepared.conditionalLegacySkinReuse) {
      if (computePass) {
        throw new TypeError('legacy skin proof does not accept an external mutation writer pass');
      }
      proof = encodeSkinProof(prepared.encoder, prepared.preparedBuild, {
        timestampProfiler: prepared._timestampProfiler,
        bindGroupCache: prepared._generationMetadataSlot,
        keepComputePassOpen: false,
        timestampMetadata: prepared._generationTimestampMetadata
      });
    } else {
      if (!computePass && !allowOwnedPass) {
        throw new TypeError(
          'mutation decision finalization requires a caller-owned already-open compute pass'
        );
      }
      if (computePass && (!computePass.setPipeline || !computePass.setBindGroup
        || !computePass.dispatchWorkgroups)) {
        throw new TypeError('mutation decision requires a WebGPU-like compute pass');
      }
      proof = encodeMutationDecision(
        prepared.encoder,
        prepared.preparedBuild,
        prepared.mutationCertificate,
        {
          timestampProfiler: prepared._timestampProfiler,
          bindGroupCache: prepared._generationMetadataSlot,
          timestampMetadata: prepared._generationTimestampMetadata,
          computePass,
          preparedGeneration: prepared
        }
      );
    }
    if (!proof) throw new Error('mutation decision proof could not be encoded');
    prepared.skinReuseProof = proof;
    prepared.decisionRecorded = true;
    prepared.status = 'resident-neighborhood-generation-decision-finalized';
    return proof;
  }

  function recordMutationDecision(preparedGeneration, computePass) {
    const prepared = assertPreparedGeneration(preparedGeneration);
    if (!prepared.conditionalMutationCertificateReuse) {
      throw new Error('prepared generation is not a certified mutation writer generation');
    }
    return recordPreparedGenerationDecision(prepared, { computePass });
  }

  function finishGeneration(preparedGeneration) {
    const prepared = assertPreparedGeneration(preparedGeneration);
    return prepared._finish();
  }

  function cancelPreparedGeneration(preparedGeneration) {
    if (!preparedGeneration || preparedGeneration.laneToken !== preparedGenerationLaneToken) {
      throw new TypeError('prepared generation is not owned by this resident neighborhood lane');
    }
    if (preparedGeneration.finished || preparedGeneration.cancelled
      || !activePreparedGenerations.has(preparedGeneration)) return false;
    activePreparedGenerations.delete(preparedGeneration);
    preparedGeneration.cancelled = true;
    preparedGeneration.status = 'resident-neighborhood-generation-cancelled';
    preparedGeneration._cancel();
    return true;
  }

  function encodeGeneration(encoder, args = {}) {
    const prepared = prepareGeneration(encoder, args);
    try {
      if (prepared.decisionRequired) {
        recordPreparedGenerationDecision(prepared, { allowOwnedPass: true });
      }
      return finishGeneration(prepared);
    } catch (error) {
      cancelPreparedGeneration(prepared);
      throw error;
    }
  }

  function releaseGeneration(value) {
    const record = activeGenerations.has(value)
      ? value
      : [...activeGenerations].find((candidate) => candidate.build === value);
    if (!record || record.released) return false;
    record.released = true;
    activeGenerations.delete(record);
    builder.release(record.build);
    if (!record.generationMetadataSlot) record.paramsBuffer?.destroy?.();
    if (record.ownsSupportClassBuffer) record.supportClassBuffer?.destroy?.();
    releaseGenerationMetadataSlot(record.generationMetadataSlot);
    releaseMutationCertificate(record.mutationCertificate);
    return true;
  }

  const lane = {
    schema: ULG_RESIDENT_NEIGHBORHOOD_GPU_LANE_SCHEMA,
    status: 'resident-neighborhood-gpu-lane-ready',
    sourceCount: count,
    consumers: [...resolvedConsumers.names],
    consumerMask: resolvedConsumers.mask,
    supportDistanceM: supportDistance,
    cellSizeM: cellSize,
    cellRadius,
    skinCellPadding,
    maxBuilderCellRadius,
    maxCandidatesPerSource: perSourceCapacity,
    candidateCapacity: globalCandidateCapacity,
    laneId: resolvedLaneId,
    stateKey: resolvedStateKey,
    sourceFamily: resolvedSourceFamily,
    authoritative: authoritative === true,
    sourceMetadataMode: resolvedSourceMetadataMode,
    supportClassCount: configuredSupportClasses.length,
    builderStrategy: builderStrategyPlan.strategy,
    builderStrategyPlan,
    denseUniformChart: resolvedDenseUniformChart,
    directSegmentedMasked: directSegmentedMasked === true,
    retainedParamsSlotCount: builder.retainedParamsSlotCount,
    retainedGenerationSlotCount: resolvedRetainedGenerationSlotCount,
    generationMetadataArenaLayout,
    skinReuseEnabled,
    skinDistanceM: resolvedSkinDistance,
    skinDisplacementBudgetM: resolvedSkinDistance * 0.5,
    mutationCertificateCapabilityEnabled: mutationCertificateEnabled,
    mutationCertificate: mutationCertificateEnabled
      ? Object.freeze({
          schema: 'peercompute.ulg.resident-neighborhood-mutation-certificate.v0',
          status: 'resident-neighborhood-mutation-certificate-ready',
          accumulatorBuffer: mutationCertificateAccumulatorBuffer,
          slotArenaBuffer: mutationCertificateArenaBuffer,
          slotCount: mutationCertificateSlotCount,
          slotStrideByteLength: mutationCertificateSlotStrideBytes,
          slotByteLength: RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_BYTES,
          arithmetic: 'upward-rounded-l1-stage-max-plus-upward-rounded-cumulative-sum',
          fullParticleReferenceBufferAllocated: false,
          fullParticleMeasurePipelineCreated: false
        })
      : null,
    generationBase: resolvedGenerationBase,
    positionEpochBase: resolvedPositionEpochBase,
    leaseTokenLowBase: resolvedLeaseTokenLow,
    leaseTokenHighBase: resolvedLeaseTokenHigh,
    commandEncoderOwnership: 'caller',
    submissionOwnership: 'caller',
    queueSubmitPerformed: false,
    mapPerformed: false,
    readbackPerformed: false,
    schedulerCreated: false,
    acquireMutationCertificate,
    releaseMutationCertificate,
    prepareGeneration,
    recordMutationDecision,
    finishGeneration,
    cancelPreparedGeneration,
    encodeGeneration,
    releaseGeneration,
    allocationEntries(value = null) {
      const classifyBuilderEntries = (entries) => entries.map((entry) => ({
        ...entry,
        lifetime: (
          entry.role?.startsWith('resident-neighborhood-arena-')
          || entry.role?.startsWith('resident-neighborhood-generation-')
          || entry.role?.startsWith('radix-') && !entry.role.includes('transient')
          || entry.role?.startsWith('unique-')
          || entry.role === 'scan-params-retained'
          || entry.role?.startsWith('scan-level-')
        )
          ? 'persistent-workspace'
          : 'transient-submission'
      }));
      const base = [
        chartLevelBuffer
          ? {
              role: 'resident-neighborhood-chart-level-rows',
              buffer: chartLevelBuffer,
              owned: true,
              lifetime: 'persistent-workspace'
            }
          : null,
        sourceSupportAssignmentBuffer
          ? {
              role: 'resident-neighborhood-source-support-assignment-rows',
              buffer: sourceSupportAssignmentBuffer,
              owned: true,
              lifetime: 'persistent-workspace'
            }
          : null,
        generationMetadataArenaEntry,
        skinReferencePositionBuffer
          ? {
              role: 'resident-neighborhood-skin-reference-positions',
              buffer: skinReferencePositionBuffer,
              owned: true,
              lifetime: 'persistent-workspace'
            }
          : null,
        skinProofEvidenceBuffer
          ? {
              role: 'resident-neighborhood-skin-proof-evidence',
              buffer: skinProofEvidenceBuffer,
              owned: true,
              lifetime: 'persistent-workspace'
            }
          : null,
        mutationCertificateAccumulatorBuffer
          ? {
              role: 'resident-neighborhood-mutation-certificate-accumulator',
              buffer: mutationCertificateAccumulatorBuffer,
              owned: true,
              lifetime: 'persistent-workspace'
            }
          : null,
        mutationCertificateArenaBuffer
          ? {
              role: 'resident-neighborhood-mutation-certificate-slot-arena',
              buffer: mutationCertificateArenaBuffer,
              owned: true,
              lifetime: 'persistent-workspace',
              slotCount: mutationCertificateSlotCount,
              slotStrideByteLength: mutationCertificateSlotStrideBytes
            }
          : null,
        skinDispatchBankBuffer
          ? {
              role: 'resident-neighborhood-skin-dispatch-bank',
              buffer: skinDispatchBankBuffer,
              owned: true,
              lifetime: 'persistent-workspace'
            }
          : null,
        skinProofCountersBuffer
          ? {
              role: 'resident-neighborhood-skin-proof-counters',
              buffer: skinProofCountersBuffer,
              owned: true,
              lifetime: 'persistent-workspace'
            }
          : null
      ].filter(Boolean);
      if (value) {
        const record = [...activeGenerations].find((candidate) => candidate.build === value);
        return [
          ...base,
          ...(record ? [
            record.paramsBuffer && !record.generationMetadataSlot
              ? {
                  role: 'resident-neighborhood-source-metadata-params',
                  buffer: record.paramsBuffer,
                  owned: true,
                  lifetime: 'transient-submission'
                }
              : null,
            record.ownsSupportClassBuffer && !record.generationMetadataSlot
              ? {
                  role: 'resident-neighborhood-support-classes',
                  buffer: record.supportClassBuffer,
                  owned: true,
                  lifetime: 'transient-submission'
                }
              : null
          ].filter(Boolean) : []),
          ...classifyBuilderEntries(builder.allocationEntries(value))
        ];
      }
      return [
        ...base,
        ...[...activeGenerations].flatMap((record) => [
          record.paramsBuffer && !record.generationMetadataSlot
            ? {
                role: 'resident-neighborhood-source-metadata-params',
                buffer: record.paramsBuffer,
                owned: true,
                lifetime: 'transient-submission'
              }
            : null,
          record.ownsSupportClassBuffer
            ? {
                role: 'resident-neighborhood-support-classes',
                buffer: record.supportClassBuffer,
                owned: true,
                lifetime: 'transient-submission'
              }
            : null
        ].filter(Boolean)),
        ...classifyBuilderEntries(builder.allocationEntries())
      ];
    },
    allocationPlan(generationCount = 1) {
      const liveGenerations = positiveInteger(generationCount, 'generationCount');
      const builderPlan = planResidentNeighborhoodGpuBuilderAllocations({
        sourceCount: count,
        supportClassCount: configuredSupportClasses.length,
        candidateCapacity: globalCandidateCapacity,
        generationCount: liveGenerations,
        maxComputeWorkgroupsPerDimension: maxDimension,
        retainConstantScanParamsBuffers: true,
        retainedParamsSlotCount: builder.retainedParamsSlotCount,
        retainedGenerationSlotCount: resolvedRetainedGenerationSlotCount,
        minUniformBufferOffsetAlignment:
          device.limits?.minUniformBufferOffsetAlignment ?? 256,
        minStorageBufferOffsetAlignment:
          device.limits?.minStorageBufferOffsetAlignment ?? 256,
        retainGenerationControlArena: true
      });
      const lanePersistentByteLength = resolvedSourceMetadataMode === 'uniform-gpu-expanded'
        ? metadataByteLength * 2 + generationMetadataArenaLayout.byteLength
        : 0;
      const skinReusePersistentByteLength = skinReferencePositionBuffer
        ? skinReferencePositionBuffer.size
          + skinProofEvidenceBuffer.size
          + skinDispatchBankBuffer.size
          + skinProofCountersBuffer.size
        : (mutationCertificateAccumulatorBuffer
            ? mutationCertificateAccumulatorBuffer.size
              + mutationCertificateArenaBuffer.size
              + skinDispatchBankBuffer.size
              + skinProofCountersBuffer.size
            : 0);
      const laneGenerationLocalByteLength = 0;
      return {
        schema: 'peercompute.ulg.resident-neighborhood-lane-allocation-plan.v0',
        status: 'resident-neighborhood-lane-allocation-plan-ready',
        exact: true,
        sourceMetadataMode: resolvedSourceMetadataMode,
        liveGenerationCount: liveGenerations,
        builder: builderPlan,
        lanePersistentByteLength,
        skinReusePersistentByteLength,
        laneGenerationLocalByteLength,
        retainedGenerationSlotCount: resolvedSourceMetadataMode === 'uniform-gpu-expanded'
          ? resolvedRetainedGenerationSlotCount
          : 0,
        generationMetadataArenaByteLength:
          generationMetadataArenaLayout?.byteLength ?? 0,
        generationMetadataSlotStrideByteLength:
          generationMetadataArenaLayout?.slotStrideByteLength ?? 0,
        laneGenerationResidency: resolvedSourceMetadataMode === 'uniform-gpu-expanded'
          ? 'bounded-retained-control-arena-fence-leased-slots'
          : 'external-caller-owned',
        peakAllocatedByteLength: builderPlan.peakAllocatedByteLength
          + lanePersistentByteLength
          + skinReusePersistentByteLength
          + laneGenerationLocalByteLength * liveGenerations,
        arenaPolicy: builderPlan.arenaPolicy,
        liveGenerationPolicy: builderPlan.liveGenerationPolicy
      };
    },
    destroy() {
      if (destroyed) return;
      for (const prepared of [...activePreparedGenerations]) {
        cancelPreparedGeneration(prepared);
      }
      for (const record of [...activeGenerations]) releaseGeneration(record);
      builder.destroy();
      chartLevelBuffer?.destroy?.();
      sourceSupportAssignmentBuffer?.destroy?.();
      generationMetadataArenaBuffer?.destroy?.();
      generationMetadataArenaBuffer = null;
      skinReferencePositionBuffer?.destroy?.();
      skinProofEvidenceBuffer?.destroy?.();
      mutationCertificateAccumulatorBuffer?.destroy?.();
      mutationCertificateArenaBuffer?.destroy?.();
      mutationCertificateSlots.length = 0;
      skinDispatchBankBuffer?.destroy?.();
      skinProofCountersBuffer?.destroy?.();
      generationMetadataSlots.length = 0;
      destroyed = true;
    }
  };
  LANE_REQUIREMENTS.set(lane, requirementsToken);
  return lane;
}

export function acquireResidentNeighborhoodGpuLane(device, options = {}) {
  if (!device || (typeof device !== 'object' && typeof device !== 'function')) {
    throw new TypeError('resident neighborhood lane pool requires a device object');
  }
  const key = structuralPoolKey(options);
  let pool = LANE_POOLS.get(device);
  if (!pool) {
    pool = new Map();
    LANE_POOLS.set(device, pool);
  }
  let entry = pool.get(key);
  const reused = Boolean(entry);
  if (!entry) {
    const lane = createResidentNeighborhoodGpuLane(device, options);
    entry = {
      lane,
      inFlightCount: 0,
      acquisitionOrdinal: 0,
      destroyed: false
    };
    pool.set(key, entry);
  }
  if (entry.destroyed) throw new Error('resident neighborhood pooled lane is destroyed');
  if (entry.inFlightCount >= MAX_IN_FLIGHT_SUBMISSIONS) {
    const error = new Error('resident neighborhood pooled lane in-flight submission window is full');
    error.code = 'ERR_RESIDENT_NEIGHBORHOOD_LANE_IN_FLIGHT';
    error.inFlightCount = entry.inFlightCount;
    error.maxInFlightSubmissions = MAX_IN_FLIGHT_SUBMISSIONS;
    throw error;
  }
  const identity = options.authoritative === false
    ? (options.leaseAuthorityIdentity || null)
    : assertLeaseAuthorityIdentity(options.leaseAuthorityIdentity, {
        laneId: entry.lane.laneId,
        stateKey: entry.lane.stateKey,
        sourceFamily: entry.lane.sourceFamily
      });
  const acquisitionGenerationBase = uint32(
    options.generationBase ?? entry.lane.generationBase,
    'generationBase'
  );
  const acquisitionPositionEpochBase = uint32(
    options.positionEpochBase ?? entry.lane.positionEpochBase,
    'positionEpochBase'
  );
  entry.inFlightCount += 1;
  entry.acquisitionOrdinal += 1;
  let released = false;
  const generations = new Set();
  const preparedGenerations = new Set();
  const mutationCertificates = new Set();
  const release = () => {
    if (released) return false;
    for (const prepared of preparedGenerations) {
      entry.lane.cancelPreparedGeneration(prepared);
    }
    preparedGenerations.clear();
    for (const generation of generations) entry.lane.releaseGeneration(generation);
    generations.clear();
    for (const certificate of mutationCertificates) {
      entry.lane.releaseMutationCertificate(certificate);
    }
    mutationCertificates.clear();
    entry.inFlightCount = Math.max(0, entry.inFlightCount - 1);
    released = true;
    return true;
  };
  return {
    schema: 'peercompute.ulg.resident-neighborhood-gpu-lane-acquisition.v0',
    status: reused
      ? 'resident-neighborhood-gpu-lane-reused'
      : 'resident-neighborhood-gpu-lane-created',
    lane: entry.lane,
    reused,
    acquisitionOrdinal: entry.acquisitionOrdinal,
    leaseId: identity?.leaseId ?? null,
    generationBase: acquisitionGenerationBase,
    positionEpochBase: acquisitionPositionEpochBase,
    singleFlight: true,
    orderedReuseWindow: true,
    inFlightSubmissionCountAtAcquire: entry.inFlightCount,
    maxInFlightSubmissions: MAX_IN_FLIGHT_SUBMISSIONS,
    acquireMutationCertificate(args = {}) {
      if (released) throw new Error('resident neighborhood lane acquisition is released');
      const substepIndex = uint32(args.substepIndex ?? 0, 'substepIndex');
      const certificate = entry.lane.acquireMutationCertificate({
        ...args,
        targetGeneration: args.targetGeneration ?? args.generation ?? checkedUint32Add(
          acquisitionGenerationBase,
          substepIndex,
          'mutation targetGeneration'
        ),
        targetPositionEpoch: args.targetPositionEpoch ?? args.positionEpoch ?? checkedUint32Add(
          acquisitionPositionEpochBase,
          substepIndex,
          'mutation targetPositionEpoch'
        ),
        leaseTokenLow: args.leaseTokenLow ?? args.generationLeaseTokenLow ?? checkedUint32Add(
          entry.lane.leaseTokenLowBase,
          substepIndex,
          'mutation leaseTokenLow'
        ),
        leaseTokenHigh: args.leaseTokenHigh ?? args.generationLeaseTokenHigh ?? checkedUint32Add(
          entry.lane.leaseTokenHighBase,
          substepIndex,
          'mutation leaseTokenHigh'
        )
      });
      if (certificate) mutationCertificates.add(certificate);
      return certificate;
    },
    prepareGeneration(encoder, args = {}) {
      if (released) throw new Error('resident neighborhood lane acquisition is released');
      const substepIndex = uint32(args.substepIndex ?? 0, 'substepIndex');
      const prepared = entry.lane.prepareGeneration(encoder, {
        ...args,
        substepIndex,
        generation: args.generation ?? checkedUint32Add(
          acquisitionGenerationBase,
          substepIndex,
          'generation'
        ),
        positionEpoch: args.positionEpoch ?? checkedUint32Add(
          acquisitionPositionEpochBase,
          substepIndex,
          'positionEpoch'
        ),
        leaseAuthorityIdentity: args.leaseAuthorityIdentity ?? identity
      });
      preparedGenerations.add(prepared);
      if (args.mutationCertificate) mutationCertificates.delete(args.mutationCertificate);
      return prepared;
    },
    recordMutationDecision(prepared, computePass) {
      if (released) throw new Error('resident neighborhood lane acquisition is released');
      if (!preparedGenerations.has(prepared)) {
        throw new TypeError('prepared generation is not active for this lane acquisition');
      }
      return entry.lane.recordMutationDecision(prepared, computePass);
    },
    finishGeneration(prepared) {
      if (released) throw new Error('resident neighborhood lane acquisition is released');
      if (!preparedGenerations.has(prepared)) {
        throw new TypeError('prepared generation is not active for this lane acquisition');
      }
      const build = entry.lane.finishGeneration(prepared);
      preparedGenerations.delete(prepared);
      generations.add(build);
      return build;
    },
    cancelPreparedGeneration(prepared) {
      if (!preparedGenerations.has(prepared)) return false;
      const cancelled = entry.lane.cancelPreparedGeneration(prepared);
      preparedGenerations.delete(prepared);
      mutationCertificates.delete(prepared.mutationCertificate);
      return cancelled;
    },
    encodeGeneration(encoder, args = {}) {
      if (released) throw new Error('resident neighborhood lane acquisition is released');
      const substepIndex = uint32(args.substepIndex ?? 0, 'substepIndex');
      const build = entry.lane.encodeGeneration(encoder, {
        ...args,
        substepIndex,
        generation: args.generation ?? checkedUint32Add(
          acquisitionGenerationBase,
          substepIndex,
          'generation'
        ),
        positionEpoch: args.positionEpoch ?? checkedUint32Add(
          acquisitionPositionEpochBase,
          substepIndex,
          'positionEpoch'
        ),
        leaseAuthorityIdentity: args.leaseAuthorityIdentity ?? identity
      });
      generations.add(build);
      if (args.mutationCertificate) {
        args.mutationCertificate.consumedByGeneration = true;
        mutationCertificates.delete(args.mutationCertificate);
      }
      return build;
    },
    release,
    releaseAfterSubmittedWork(completedWork) {
      if (!completedWork || typeof completedWork.then !== 'function') {
        throw new TypeError('releaseAfterSubmittedWork requires a queue completion promise');
      }
      return Promise.resolve(completedWork).then(
        () => release(),
        (error) => {
          release();
          throw error;
        }
      );
    }
  };
}

export function destroyResidentNeighborhoodGpuLanePool(device) {
  const pool = LANE_POOLS.get(device);
  if (!pool) return 0;
  let destroyedCount = 0;
  for (const entry of pool.values()) {
    if (entry.destroyed) continue;
    entry.lane.destroy();
    entry.destroyed = true;
    entry.inFlightCount = 0;
    destroyedCount += 1;
  }
  pool.clear();
  LANE_POOLS.delete(device);
  return destroyedCount;
}
