import {
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferDevice,
  webGpuBufferMatchesDevice
} from './sphGpuDeviceIdentity.js';
import {
  schroederAuthorityTypedArrayFingerprint
} from './schroederAuthorityFingerprint.js';
import {
  encodeMlsMpmParticleMotionWatchBins,
  encodeMlsMpmParticleSeparationPasses,
  resolvePostSeparationMotionWatchBinCandidate
} from './sphG2pGpuKernel.js';
import {
  SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT,
  SPH_REACTION_MOTION_ENVELOPE_MAX_FUTURE_SUBSTEPS,
  SPH_REACTION_MOTION_ENVELOPE_PREDICATE_REVISION,
  SPH_REACTION_ACTIVATION_OBSERVATION_ENCODED_COUNT_BIAS,
  SPH_REACTION_ACTIVATION_OBSERVATION_ENCODED_FAILURE_WORD,
  SPH_REACTION_ACTIVATION_OBSERVATION_PUBLIC_FAILURE_WORD,
  ULG_SPH_REACTION_ACTIVATION_OBSERVATION_FATAL_ERROR_CODE,
  ULG_SPH_REACTION_ACTIVATION_OBSERVATION_SCHEMA,
  assertSphReactionMotionEnvelopeBoxDimsMatch,
  assertSphReactionMotionEnvelopeRulePrefix,
  isExactSphReactionMotionEnvelope,
  sphReactionMotionEnvelopeWgsl
} from './sphReactionMotionEnvelope.js';

export const ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_PROPOSAL_SCHEMA =
  'peercompute.ulg.sph-reaction-motion-envelope-watch-proposal.v2';

export const SPH_REACTION_MOTION_ENVELOPE_WATCH_PIPELINE_REVISION =
  'terminal-fixed-carrier-bins-driver-safe-products-sealed-v9';

export const ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_FATAL_ERROR_CODE =
  ULG_SPH_REACTION_ACTIVATION_OBSERVATION_FATAL_ERROR_CODE;

export const ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_DEVICE_LOST_ERROR_CODE =
  'ERR_ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_DEVICE_LOST';

const TIER0_WATCH_PRODUCER = Object.freeze({
  producerRoute: 'tier0-fused-resident-sequence',
  sampleStage: 'tier0-terminal-post-separation-motion-envelope',
  nodeDomain: 'fixed-phase-carrier-slot',
  encodedIntoCallerSubmission: true,
  ownedCommandSubmissionCount: 0,
  encodedStatus: 'tier0-terminal-reaction-motion-watch-encoded'
});
const CANONICAL_WATCH_PRODUCER = Object.freeze({
  producerRoute: 'canonical-schroeder',
  sampleStage:
    'canonical-terminal-published-carrier-family-motion-envelope',
  nodeDomain: 'fixed-phase-carrier-slot',
  encodedIntoCallerSubmission: false,
  ownedCommandSubmissionCount: 1,
  encodedStatus: 'canonical-terminal-reaction-motion-watch-encoded'
});

const WORKGROUP_SIZE = 64;
const REACTION_RECORD_FLOATS = 12;
const PARAMS_BYTES = 96;
const CONTROL_WORDS = 7;
const CONTROL_BYTES = CONTROL_WORDS * Uint32Array.BYTES_PER_ELEMENT;
const OBSERVATION_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const OBSERVATION_SENTINEL =
  SPH_REACTION_ACTIVATION_OBSERVATION_PUBLIC_FAILURE_WORD;
const ENCODED_OBSERVATION_FAILURE_WORD =
  SPH_REACTION_ACTIVATION_OBSERVATION_ENCODED_FAILURE_WORD;
const ENCODED_OBSERVATION_COUNT_BIAS =
  SPH_REACTION_ACTIVATION_OBSERVATION_ENCODED_COUNT_BIAS;
const MAX_EXACT_F32_INTEGER =
  SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT;
const MAX_U32 = 0xffff_ffff;
const MAX_I32 = 0x7fff_ffff;
const WATCH_STORAGE_BINDING_COUNT = 6;
const F32_OPERAND = new Float32Array(1);
const U32_OPERAND = new Uint32Array(F32_OPERAND.buffer);

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};
const GPU_MAP_MODE = { READ: globalThis.GPUMapMode?.READ ?? 1 };
const proposalRecords = new WeakMap();
const watchDeviceLifecycles = new WeakMap();

function watchDeviceLifecycleFor(device) {
  if (!device?.lost?.then) return null;
  let lifecycle = watchDeviceLifecycles.get(device);
  if (lifecycle) return lifecycle;
  lifecycle = {
    terminalObserved: false,
    terminalPromise: null,
    records: new Set()
  };
  watchDeviceLifecycles.set(device, lifecycle);
  const retire = () => {
    lifecycle.terminalObserved = true;
    for (const record of [...lifecycle.records]) {
      record.submissionCompletionObserved = true;
      record.quarantined = false;
      record.destroyOwned?.();
    }
    return 'device-terminal';
  };
  // Exactly one listener is installed for a device. Individual proposals
  // register only while live, so a long-lived device does not retain every
  // completed schedule through its never-settled lost promise.
  lifecycle.terminalPromise = Promise.resolve(device.lost).then(retire, retire);
  return lifecycle;
}

// Keep native/integration callers on the exact module instance that owns the
// private terminal-bin brand. Development servers may otherwise materialize
// two query-versioned copies of sphG2pGpuKernel.js, whose WeakMaps correctly
// refuse one another's candidates.
export const encodeSphReactionMotionEnvelopeWatchTerminalBinsWebGpu =
  encodeMlsMpmParticleSeparationPasses;

function exactPositiveU32(value, label, maximum = 0xffff_ffff) {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < 1
    || value > maximum
  ) {
    throw new RangeError(`${label} must be an integer in [1, ${maximum}]`);
  }
  return value;
}

function exactPositiveDeviceLimit(device, name) {
  const value = device?.limits?.[name];
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < 1
  ) {
    throw new RangeError(
      `reaction motion watch requires exact device.limits.${name}`
    );
  }
  return value;
}

function reactionMotionWatchDeviceLimits(device) {
  return Object.freeze({
    maxBufferSize: exactPositiveDeviceLimit(device, 'maxBufferSize'),
    maxStorageBufferBindingSize: exactPositiveDeviceLimit(
      device,
      'maxStorageBufferBindingSize'
    ),
    maxUniformBufferBindingSize: exactPositiveDeviceLimit(
      device,
      'maxUniformBufferBindingSize'
    ),
    maxStorageBuffersPerShaderStage: exactPositiveDeviceLimit(
      device,
      'maxStorageBuffersPerShaderStage'
    ),
    maxComputeWorkgroupsPerDimension: exactPositiveDeviceLimit(
      device,
      'maxComputeWorkgroupsPerDimension'
    )
  });
}

function checkedPositiveProduct(values, label, maximum = Number.MAX_SAFE_INTEGER) {
  let product = 1;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError(`${label} factors must be positive safe integers`);
    }
    if (product > Math.floor(maximum / value)) {
      throw new RangeError(`${label} exceeds its exact integer domain`);
    }
    product *= value;
  }
  return product;
}

function exactPositiveWatchF32(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number`);
  }
  F32_OPERAND[0] = value;
  const rounded = F32_OPERAND[0];
  const absoluteBits = U32_OPERAND[0] & 0x7fff_ffff;
  if (
    !Number.isFinite(rounded)
    || rounded <= 0
    || absoluteBits >= 0x7f7f_ffff
  ) {
    throw new RangeError(`${label} is outside the admitted finite f32 domain`);
  }
  return rounded;
}

function exactNonnegativeWatchF32(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a nonnegative finite number`);
  }
  F32_OPERAND[0] = value;
  const rounded = F32_OPERAND[0];
  const absoluteBits = U32_OPERAND[0] & 0x7fff_ffff;
  if (
    !Number.isFinite(rounded)
    || rounded < 0
    || absoluteBits >= 0x7f7f_ffff
  ) {
    throw new RangeError(`${label} is outside the admitted finite f32 domain`);
  }
  return rounded;
}

function exactBufferByteLength(byteLength, label, limits) {
  if (!Number.isSafeInteger(byteLength) || byteLength < 4) {
    throw new RangeError(`${label} must have an exact positive byte length`);
  }
  if (byteLength > limits.maxBufferSize) {
    throw new RangeError(`${label} exceeds device.limits.maxBufferSize`);
  }
  return byteLength;
}

function exactStorageByteLength(byteLength, label, limits) {
  exactBufferByteLength(byteLength, label, limits);
  if (byteLength > limits.maxStorageBufferBindingSize) {
    throw new RangeError(
      `${label} exceeds device.limits.maxStorageBufferBindingSize`
    );
  }
  return byteLength;
}

function requireBuffer(device, buffer, label, minimumBytes = 4) {
  if (
    !buffer
    || !webGpuBufferMatchesDevice(buffer, device)
  ) {
    throw new TypeError(`${label} must be a live buffer on the watch device`);
  }
  if (
    typeof buffer.size !== 'number'
    || !Number.isSafeInteger(buffer.size)
    || buffer.size < minimumBytes
  ) {
    throw new RangeError(`${label} is smaller than ${minimumBytes} bytes`);
  }
  return tagWebGpuBufferDevice(buffer, device);
}

function requireStorageBuffer(
  device,
  buffer,
  label,
  minimumBytes,
  limits
) {
  exactStorageByteLength(minimumBytes, label, limits);
  const admitted = requireBuffer(device, buffer, label, minimumBytes);
  exactBufferByteLength(admitted.size, label, limits);
  return admitted;
}

function createBuffer(device, descriptor) {
  return tagWebGpuBufferDevice(device.createBuffer(descriptor), device);
}

function reactionRecordArray(reactionTable) {
  if (reactionTable?.schema !== ULG_SPH_GPU_REACTION_TABLE_SCHEMA) {
    throw new TypeError('reaction watch requires a packed SPH reaction table');
  }
  const reactionCount = exactPositiveU32(
    reactionTable.reactionCount,
    'reactionTable.reactionCount',
    MAX_EXACT_F32_INTEGER
  );
  const combined = reactionTable.combinedRecords instanceof Float32Array
    ? reactionTable.combinedRecords
    : reactionTable.records;
  if (!(combined instanceof Float32Array)) {
    throw new TypeError('reactionTable records must be a Float32Array');
  }
  if (
    typeof SharedArrayBuffer === 'function'
    && combined.buffer instanceof SharedArrayBuffer
  ) {
    throw new TypeError(
      'reactionTable records cannot use shared mutable storage'
    );
  }
  const minimumFloats = reactionCount * REACTION_RECORD_FLOATS;
  if (combined.length < minimumFloats) {
    throw new RangeError(
      `reactionTable records have ${combined.length} floats; ${minimumFloats} required`
    );
  }
  if (
    Object.hasOwn(reactionTable, 'recordStrideFloats')
    && reactionTable.recordStrideFloats !== REACTION_RECORD_FLOATS
  ) {
    throw new RangeError('reactionTable recordStrideFloats must equal 12');
  }
  if (
    Object.hasOwn(reactionTable, 'combinedRecordCount')
    && (
      !Number.isSafeInteger(reactionTable.combinedRecordCount)
      || reactionTable.combinedRecordCount !== combined.length / 4
    )
  ) {
    throw new RangeError('reactionTable combinedRecordCount is inconsistent');
  }
  if (
    Object.hasOwn(reactionTable, 'status')
    && ![
      'derived-reaction-table-ready',
      'static-table-cache-hit'
    ].includes(reactionTable.status)
  ) {
    throw new TypeError('reactionTable status is not an admitted ready status');
  }
  if (
    reactionTable.combinedRecords instanceof Float32Array
    && Object.hasOwn(reactionTable, 'records')
  ) {
    const records = reactionTable.records;
    if (!(records instanceof Float32Array) || records.length !== minimumFloats) {
      throw new RangeError('reactionTable record prefix length is inconsistent');
    }
    if (
      typeof SharedArrayBuffer === 'function'
      && records.buffer instanceof SharedArrayBuffer
    ) {
      throw new TypeError(
        'reactionTable record prefix cannot use shared mutable storage'
      );
    }
    for (let index = 0; index < minimumFloats; index += 1) {
      if (!Object.is(records[index], combined[index])) {
        throw new TypeError(
          'reactionTable combined-record prefix does not match records'
        );
      }
    }
  }
  assertSphReactionMotionEnvelopeRulePrefix(
    combined,
    reactionCount,
    'reactionTable'
  );
  return { reactionCount, combined };
}

function maximumReactionContactRadiusM(reactionCount, combined) {
  let maximum = 0;
  for (let index = 0; index < reactionCount; index += 1) {
    const offset = index * REACTION_RECORD_FLOATS;
    const radius = combined[offset + 5];
    const status = combined[offset + 8];
    if (status === 1 && Number.isFinite(radius) && radius > 0) {
      maximum = Math.max(maximum, Math.fround(radius));
    }
  }
  return maximum;
}

function exactWatchDispatchWorkgroups(invocationCount, limits, label) {
  const workgroups = Math.max(1, Math.ceil(invocationCount / WORKGROUP_SIZE));
  if (
    !Number.isSafeInteger(workgroups)
    || workgroups > limits.maxComputeWorkgroupsPerDimension
  ) {
    throw new RangeError(
      `${label} exceeds device.limits.maxComputeWorkgroupsPerDimension`
    );
  }
  return workgroups;
}

function exactNeighborBinLayout(neighborBins, limits) {
  const capacity = exactPositiveU32(
    neighborBins.capacity,
    'neighborBins.capacity'
  );
  if (capacity === MAX_U32) {
    throw new RangeError('neighborBins.capacity cannot reserve a count prefix');
  }
  const nx = exactPositiveU32(neighborBins.nx, 'neighborBins.nx', MAX_I32);
  const ny = exactPositiveU32(neighborBins.ny, 'neighborBins.ny', MAX_I32);
  const nz = exactPositiveU32(neighborBins.nz, 'neighborBins.nz', MAX_I32);
  const cellCount = exactPositiveU32(
    neighborBins.cellCount,
    'neighborBins.cellCount'
  );
  const exactCellCount = checkedPositiveProduct(
    [nx, ny, nz],
    'neighborBins cell-count product',
    MAX_U32
  );
  if (cellCount !== exactCellCount) {
    throw new RangeError(
      'neighborBins.cellCount does not equal the exact axis product'
    );
  }
  const wordLength = checkedPositiveProduct(
    [cellCount, capacity + 1],
    'neighborBins combined word length',
    MAX_U32
  );
  const byteLength = checkedPositiveProduct(
    [wordLength, Uint32Array.BYTES_PER_ELEMENT],
    'neighborBins combined byte length'
  );
  exactStorageByteLength(byteLength, 'neighborBins.binsBuffer', limits);
  const cellSizeM = exactPositiveWatchF32(
    neighborBins.cellSizeM,
    'neighborBins.cellSizeM'
  );
  return Object.freeze({
    ...neighborBins,
    capacity,
    nx,
    ny,
    nz,
    cellCount,
    cellSizeM,
    wordLength,
    byteLength
  });
}

function createParams({
  particleCount,
  reactionCount,
  neighborBins,
  maximumContactRadiusM,
  motionEnvelope
}) {
  const data = new ArrayBuffer(PARAMS_BYTES);
  const view = new DataView(data);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, reactionCount, true);
  view.setUint32(8, 3, true);
  view.setUint32(12, neighborBins.capacity, true);
  view.setUint32(16, neighborBins.nx, true);
  view.setUint32(20, neighborBins.ny, true);
  view.setUint32(24, neighborBins.nz, true);
  view.setUint32(28, neighborBins.cellCount, true);
  view.setFloat32(32, neighborBins.cellSizeM, true);
  view.setFloat32(36, maximumContactRadiusM, true);
  view.setUint32(40, motionEnvelope.cflFactorF32Bits, true);
  view.setUint32(44, motionEnvelope.gridSpacingF32Bits, true);
  view.setUint32(48, motionEnvelope.maxFutureSubsteps, true);
  view.setUint32(
    52,
    motionEnvelope.separationDisplacementEnabled ? 1 : 0,
    true
  );
  view.setUint32(56, 2, true);
  view.setUint32(60, 3, true);
  view.setUint32(64, 8, true);
  view.setUint32(68, 4, true);
  view.setUint32(
    72,
    motionEnvelope.thermalPhaseEvolutionEnabled ? 1 : 0,
    true
  );
  view.setUint32(76, 0, true);
  view.setUint32(80, motionEnvelope.boxDimsF32Bits[0], true);
  view.setUint32(84, motionEnvelope.boxDimsF32Bits[1], true);
  view.setUint32(88, motionEnvelope.boxDimsF32Bits[2], true);
  view.setUint32(
    92,
    motionEnvelope.contactCorrectionEnabled ? 1 : 0,
    true
  );
  return data;
}

export const sphReactionMotionEnvelopeWatchWgsl = /* wgsl */ `
struct ReactionMotionWatchParams {
  particle_count: u32,
  reaction_count: u32,
  reaction_record_stride_vec4s: u32,
  bin_capacity: u32,
  bin_nx: u32,
  bin_ny: u32,
  bin_nz: u32,
  bin_cell_count: u32,
  bin_cell_size_m: f32,
  maximum_contact_radius_m: f32,
  cfl_factor: f32,
  grid_spacing_m: f32,
  max_future_substeps: u32,
  separation_enabled: u32,
  state_stride_vec4s: u32,
  thermo_stride_vec4s: u32,
  mechanics_stride_vec4s: u32,
  max_bin_scan_radius: u32,
  thermal_phase_evolution_enabled: u32,
  reserved0: u32,
  box_dim_x_m: f32,
  box_dim_y_m: f32,
  box_dim_z_m: f32,
  contact_correction_enabled: u32,
};

@group(0) @binding(0) var<storage, read> terminal_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> terminal_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> terminal_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> terminal_bins: array<u32>;
@group(0) @binding(5) var<storage, read_write> watch_control: array<atomic<u32>>;
@group(0) @binding(6) var<uniform> params: ReactionMotionWatchParams;

${sphReactionMotionEnvelopeWgsl}

const WATCH_RESULT_WORD: u32 = 0u;
const WATCH_TRIGGERED_COUNT_WORD: u32 = 1u;
const WATCH_MAX_REST_DIAMETER_BITS_WORD: u32 = 2u;
const WATCH_COMPLETION_FAILURE_WORD: u32 = 3u;
const WATCH_BINNED_SOURCE_COUNT_WORD: u32 = 4u;
const WATCH_ACTIVE_SOURCE_COUNT_WORD: u32 = 5u;
const WATCH_PREPARE_ADMITTED_WORD: u32 = 6u;
const WATCH_ENCODED_FAILURE: u32 = ${ENCODED_OBSERVATION_FAILURE_WORD}u;
const WATCH_COUNT_BIAS: u32 = ${ENCODED_OBSERVATION_COUNT_BIAS}u;
const WATCH_MAX_EXACT_COUNT: u32 = ${MAX_EXACT_F32_INTEGER}u;
const WATCH_MAX_FUTURE_SUBSTEPS: u32 = ${
  SPH_REACTION_MOTION_ENVELOPE_MAX_FUTURE_SUBSTEPS
}u;

fn watch_fail_closed() {
  atomicOr(&watch_control[WATCH_COMPLETION_FAILURE_WORD], 0x80000000u);
}

fn watch_bounded_add(word: u32, value: u32) {
  let previous = atomicAdd(&watch_control[word], value);
  if (previous > 0xffffffffu - value) {
    watch_fail_closed();
  }
}

fn watch_u32_product_equals(
  first: u32,
  second: u32,
  third: u32,
  expected: u32
) -> bool {
  if (first == 0u || second == 0u || third == 0u) {
    return false;
  }
  // Prove the mathematical product through exact factorization of the bounded
  // expected value. This is equivalent to guarded multiplication, but avoids
  // a dynamic UINT_MAX divisor that crashes some native Vulkan shader
  // compilers before pipeline creation can return an error.
  if (expected % first != 0u) {
    return false;
  }
  let after_first = expected / first;
  return after_first % second == 0u
    && after_first / second == third;
}

fn watch_params_admitted() -> bool {
  if (
    arrayLength(&watch_control) < ${CONTROL_WORDS}u
    || params.particle_count == 0u
    || params.particle_count > WATCH_MAX_EXACT_COUNT
    || params.reaction_count == 0u
    || params.reaction_count > WATCH_MAX_EXACT_COUNT
    || params.max_future_substeps == 0u
    || params.max_future_substeps > WATCH_MAX_FUTURE_SUBSTEPS
    || params.reaction_record_stride_vec4s != 3u
    || params.state_stride_vec4s != 2u
    || params.thermo_stride_vec4s != 3u
    || params.mechanics_stride_vec4s != 8u
    || params.max_bin_scan_radius != 4u
    || params.bin_capacity == 0u
    || params.bin_capacity == 0xffffffffu
    || params.bin_nx == 0u
    || params.bin_nx > 0x7fffffffu
    || params.bin_ny == 0u
    || params.bin_ny > 0x7fffffffu
    || params.bin_nz == 0u
    || params.bin_nz > 0x7fffffffu
    || params.bin_cell_count == 0u
    || !watch_u32_product_equals(
      params.bin_nx,
      params.bin_ny,
      params.bin_nz,
      params.bin_cell_count
    )
    || params.particle_count
      > arrayLength(&terminal_state) / params.state_stride_vec4s
    || params.particle_count
      > arrayLength(&terminal_thermo) / params.thermo_stride_vec4s
    || params.particle_count
      > arrayLength(&terminal_mechanics) / params.mechanics_stride_vec4s
    || params.reaction_count
      > arrayLength(&reaction_records) / params.reaction_record_stride_vec4s
    || params.bin_cell_count
      > arrayLength(&terminal_bins) / (params.bin_capacity + 1u)
    || !(params.bin_cell_size_m > 0.0)
    || !reaction_motion_finite(params.bin_cell_size_m)
    || params.maximum_contact_radius_m < 0.0
    || !reaction_motion_finite(params.maximum_contact_radius_m)
  ) {
    return false;
  }
  return true;
}

fn watch_exact_nonnegative_f32_integer(value: f32, upper: f32) -> bool {
  return reaction_motion_finite(value)
    && value >= 0.0
    && value <= upper
    && floor(value) == value;
}

fn watch_rule_prefix_admitted(reaction_index: u32) -> bool {
  if (reaction_index >= params.reaction_count) {
    return true;
  }
  let base = reaction_index * params.reaction_record_stride_vec4s;
  if (base + 2u >= arrayLength(&reaction_records)) {
    return false;
  }
  let row0 = reaction_records[base];
  let row1 = reaction_records[base + 1u];
  let row2 = reaction_records[base + 2u];
  if (
    !reaction_motion_vec4_finite(row0)
    || !reaction_motion_vec4_finite(row1)
    || !reaction_motion_vec4_finite(row2)
    || !(row2.x == 1.0 || row2.x == 254.0 || row2.x == 255.0)
  ) {
    return false;
  }
  if (row2.x != 1.0) {
    return true;
  }
  return watch_exact_nonnegative_f32_integer(
      row0.x,
      f32(WATCH_MAX_EXACT_COUNT)
    )
    && watch_exact_nonnegative_f32_integer(
      row0.y,
      f32(WATCH_MAX_EXACT_COUNT)
    )
    && row0.x != row0.y
    && watch_exact_nonnegative_f32_integer(
      row0.z,
      f32(WATCH_MAX_EXACT_COUNT)
    )
    && row0.w >= 0.0
    && row1.y >= 0.0
    && reaction_motion_finite(row1.y * row1.y)
    && watch_exact_nonnegative_f32_integer(row1.z, 2147483647.0)
    && row1.z < 2147483648.0
    && watch_exact_nonnegative_f32_integer(row1.w, 2147483647.0)
    && row1.w < 2147483648.0;
}

fn watch_source_admitted(index: u32) -> bool {
  let state_offset = index * params.state_stride_vec4s;
  let thermo_offset = index * params.thermo_stride_vec4s;
  let mechanics_offset = index * params.mechanics_stride_vec4s;
  if (
    state_offset + 1u >= arrayLength(&terminal_state)
    || thermo_offset + 2u >= arrayLength(&terminal_thermo)
    || mechanics_offset + 7u >= arrayLength(&terminal_mechanics)
  ) {
    return false;
  }
  for (var row = 0u; row < 2u; row = row + 1u) {
    if (!reaction_motion_vec4_finite(terminal_state[state_offset + row])) {
      return false;
    }
  }
  for (var row = 0u; row < 3u; row = row + 1u) {
    if (!reaction_motion_vec4_finite(terminal_thermo[thermo_offset + row])) {
      return false;
    }
  }
  for (var row = 0u; row < 8u; row = row + 1u) {
    if (!reaction_motion_vec4_finite(terminal_mechanics[mechanics_offset + row])) {
      return false;
    }
  }
  // The mutation shader admits wildcard masks before converting phase_id.
  // A negative phase could therefore mutate there while this watch treated
  // it as a non-match. Reject the row at the fail-closed source boundary.
  return terminal_thermo[thermo_offset].y >= 0.0;
}

fn watch_phase_mask_satisfied(mask_f: f32, phase_id_f: f32) -> bool {
  if (
    !reaction_motion_finite(mask_f)
    || !reaction_motion_finite(phase_id_f)
    || mask_f < 0.0
    || phase_id_f < 0.0
  ) {
    return false;
  }
  let mask = u32(mask_f + 0.5);
  if (mask == 0u) {
    return true;
  }
  let phase_id = u32(phase_id_f + 0.5);
  return phase_id < 31u && (mask & (1u << phase_id)) != 0u;
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn prepare(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (!watch_params_admitted()) {
    watch_fail_closed();
    return;
  }
  if (index == 0u) {
    atomicStore(&watch_control[WATCH_PREPARE_ADMITTED_WORD], 1u);
  }
  if (index < params.reaction_count && !watch_rule_prefix_admitted(index)) {
    watch_fail_closed();
  }
  if (index < params.bin_cell_count) {
    if (index >= arrayLength(&terminal_bins)) {
      watch_fail_closed();
    } else {
      let cell_count = terminal_bins[index];
      if (cell_count > params.bin_capacity) {
        watch_fail_closed();
      } else {
        watch_bounded_add(WATCH_BINNED_SOURCE_COUNT_WORD, cell_count);
        for (var entry = 0u; entry < cell_count; entry = entry + 1u) {
          let slot = params.bin_cell_count
            + index * params.bin_capacity + entry;
          if (
            slot >= arrayLength(&terminal_bins)
            || terminal_bins[slot] >= params.particle_count
          ) {
            watch_fail_closed();
          }
        }
      }
    }
  }
  if (index >= params.particle_count) {
    return;
  }
  if (
    !(params.cfl_factor > 0.0)
    || !reaction_motion_finite(params.cfl_factor)
    || !(params.grid_spacing_m > 0.0)
    || !reaction_motion_finite(params.grid_spacing_m)
    || params.separation_enabled > 1u
    || params.contact_correction_enabled > 1u
    || params.thermal_phase_evolution_enabled > 1u
    || !reaction_motion_box_dims_admitted(vec3<f32>(
      params.box_dim_x_m,
      params.box_dim_y_m,
      params.box_dim_z_m
    ))
    || !watch_source_admitted(index)
  ) {
    watch_fail_closed();
    return;
  }
  let state0 = terminal_state[index * params.state_stride_vec4s];
  if (state0.w <= 0.0) {
    return;
  }
  if (!reaction_motion_position_inside_box(
    state0.xyz,
    vec3<f32>(
      params.box_dim_x_m,
      params.box_dim_y_m,
      params.box_dim_z_m
    )
  )) {
    watch_fail_closed();
    return;
  }
  watch_bounded_add(WATCH_ACTIVE_SOURCE_COUNT_WORD, 1u);
  if (
    params.separation_enabled == 0u
    && params.contact_correction_enabled == 0u
  ) {
    return;
  }
  let rest_volume_m3 = terminal_mechanics[
    index * params.mechanics_stride_vec4s + 4u
  ].w;
  let diameter_m = reaction_motion_rest_diameter_upper(rest_volume_m3);
  if (!(diameter_m > 0.0) || !reaction_motion_finite(diameter_m)) {
    watch_fail_closed();
    return;
  }
  atomicMax(
    &watch_control[WATCH_MAX_REST_DIAMETER_BITS_WORD],
    bitcast<u32>(diameter_m)
  );
}

fn watch_pair_triggered(
  self_index: u32,
  other_index: u32,
  relative_reach_m: f32
) -> bool {
  if (
    other_index == self_index
    || other_index >= params.particle_count
  ) {
    return false;
  }
  if (!watch_source_admitted(other_index)) {
    watch_fail_closed();
    return false;
  }
  let other_state0 = terminal_state[
    other_index * params.state_stride_vec4s
  ];
  if (other_state0.w <= 0.0) {
    return false;
  }
  let self_state0 = terminal_state[self_index * params.state_stride_vec4s];
  let self_thermo0 = terminal_thermo[
    self_index * params.thermo_stride_vec4s
  ];
  let other_thermo0 = terminal_thermo[
    other_index * params.thermo_stride_vec4s
  ];
  let distance_m = length(self_state0.xyz - other_state0.xyz);
  if (!reaction_motion_finite(distance_m)) {
    watch_fail_closed();
    return false;
  }
  for (
    var reaction_index = 0u;
    reaction_index < params.reaction_count;
    reaction_index = reaction_index + 1u
  ) {
    let base = reaction_index * params.reaction_record_stride_vec4s;
    let row0 = reaction_records[base];
    let row1 = reaction_records[base + 1u];
    let row2 = reaction_records[base + 2u];
    if (!reaction_motion_finite(row2.x)) {
      watch_fail_closed();
      continue;
    }
    if (row2.x != 1.0) {
      continue;
    }
    if (
      !all(vec4<bool>(
        reaction_motion_finite(row0.x),
        reaction_motion_finite(row0.y),
        reaction_motion_finite(row0.z),
        reaction_motion_finite(row0.w)
      ))
      || !all(vec4<bool>(
        reaction_motion_finite(row1.x),
        reaction_motion_finite(row1.y),
        reaction_motion_finite(row1.z),
        reaction_motion_finite(row1.w)
      ))
    ) {
      watch_fail_closed();
      continue;
    }
    // A zero-radius ready row cannot mutate and is a deterministic non-match.
    // Same-material active rows are rejected by the host prefix contract:
    // phase-disambiguated A=A rows can mutate, so treating them as inert here
    // would publish a false zero.
    if (!(row1.y > 0.0)) {
      continue;
    }
    var self_mask = 0.0;
    var other_mask = 0.0;
    if (self_thermo0.x == row0.x && other_thermo0.x == row0.y) {
      self_mask = row1.z;
      other_mask = row1.w;
    } else if (
      self_thermo0.x == row0.y && other_thermo0.x == row0.x
    ) {
      self_mask = row1.w;
      other_mask = row1.z;
    } else {
      continue;
    }
    if (
      !watch_phase_mask_satisfied(self_mask, self_thermo0.y)
      || !watch_phase_mask_satisfied(other_mask, other_thermo0.y)
      || max(self_thermo0.z, other_thermo0.z) < row0.w
    ) {
      continue;
    }
    let expanded_radius_m = reaction_motion_upward(
      row1.y + relative_reach_m
    );
    if (!reaction_motion_finite(expanded_radius_m)) {
      watch_fail_closed();
      continue;
    }
    if (distance_m <= expanded_radius_m) {
      return true;
    }
  }
  return false;
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn watch(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let source_index = global_id.x;
  if (source_index >= params.particle_count) {
    return;
  }
  if (
    atomicLoad(&watch_control[WATCH_PREPARE_ADMITTED_WORD]) != 1u
    || (atomicLoad(&watch_control[WATCH_COMPLETION_FAILURE_WORD])
      & 0x80000000u) != 0u
  ) {
    return;
  }
  var triggered = false;
  if (!watch_source_admitted(source_index)) {
    watch_fail_closed();
  } else {
    let source_state0 = terminal_state[
      source_index * params.state_stride_vec4s
    ];
    if (params.thermal_phase_evolution_enabled != 0u) {
      // Thermal execution can change temperature and phase without motion,
      // while phase migration/transfer and constitutive refresh can replace
      // row4.w with a larger rest volume or activate a dormant carrier. Until
      // a separately proved reachability envelope exists, count every fixed
      // carrier slot trigger-positive before consulting terminal mass, phase,
      // temperature, or diameter. Keeping the latch inside the GPU observation
      // prevents a torn or omitted host shortcut from manufacturing quiescence.
      triggered = true;
    }
    if (
      source_state0.w > 0.0
      && params.particle_count > 1u
      && !triggered
    ) {
      let max_rest_diameter_m = bitcast<f32>(atomicLoad(
        &watch_control[WATCH_MAX_REST_DIAMETER_BITS_WORD]
      ));
      let max_abs_position_m = max(
        abs(source_state0.x),
        max(abs(source_state0.y), abs(source_state0.z))
      );
      let relative_reach_m = reaction_motion_relative_reach_upper(
        params.max_future_substeps,
        params.cfl_factor,
        params.grid_spacing_m,
        max_rest_diameter_m,
        params.separation_enabled != 0u,
        params.contact_correction_enabled != 0u,
        vec3<f32>(
          params.box_dim_x_m,
          params.box_dim_y_m,
          params.box_dim_z_m
        ),
        max_abs_position_m,
        params.maximum_contact_radius_m
      );
      let search_radius_m = reaction_motion_upward(
        reaction_motion_upward(params.maximum_contact_radius_m)
          + relative_reach_m
      );
      if (
        !reaction_motion_finite(relative_reach_m)
        || !reaction_motion_finite(search_radius_m)
        || !(params.bin_cell_size_m > 0.0)
        || !reaction_motion_finite(params.bin_cell_size_m)
      ) {
        watch_fail_closed();
      } else {
        let scan_radius_cells = ceil(
          search_radius_m / params.bin_cell_size_m
        );
        if (
          !reaction_motion_finite(scan_radius_cells)
          || scan_radius_cells >= f32(params.max_bin_scan_radius)
        ) {
          // Deliberate conservative fast path. A horizon wider than the compact
          // neighborhood wakes the law family; it never manufactures a zero by
          // truncating the spatial scan. The comparison occurs before the u32
          // conversion/addition so an infinite or out-of-range quotient cannot
          // wrap UINT_MAX + 1 back to a zero-cell scan.
          triggered = true;
        } else {
          let raw_scan_radius = u32(scan_radius_cells) + 1u;
          // Exact shared ABI with the post-separation bin-fill kernel.
          let inv_cell = 1.0 / max(params.bin_cell_size_m, 1.0e-9);
          let cx = i32(clamp(
            u32(max(source_state0.x, 0.0) * inv_cell),
            0u,
            params.bin_nx - 1u
          ));
          let cy = i32(clamp(
            u32(max(source_state0.y, 0.0) * inv_cell),
            0u,
            params.bin_ny - 1u
          ));
          let cz = i32(clamp(
            u32(max(source_state0.z, 0.0) * inv_cell),
            0u,
            params.bin_nz - 1u
          ));
          let scan_radius = i32(raw_scan_radius);
          for (var oz = -scan_radius; oz <= scan_radius; oz = oz + 1) {
            let nz = cz + oz;
            if (nz < 0 || nz >= i32(params.bin_nz)) { continue; }
            for (var oy = -scan_radius; oy <= scan_radius; oy = oy + 1) {
              let ny = cy + oy;
              if (ny < 0 || ny >= i32(params.bin_ny)) { continue; }
              for (var ox = -scan_radius; ox <= scan_radius; ox = ox + 1) {
                let nx = cx + ox;
                if (nx < 0 || nx >= i32(params.bin_nx)) { continue; }
                let cell = (u32(nz) * params.bin_ny + u32(ny))
                  * params.bin_nx + u32(nx);
                let count = min(terminal_bins[cell], params.bin_capacity);
                for (var entry = 0u; entry < count; entry = entry + 1u) {
                  let slot = params.bin_cell_count
                    + cell * params.bin_capacity + entry;
                  if (slot >= arrayLength(&terminal_bins)) {
                    watch_fail_closed();
                    continue;
                  }
                  if (watch_pair_triggered(
                    source_index,
                    terminal_bins[slot],
                    relative_reach_m
                  )) {
                    triggered = true;
                    break;
                  }
                }
                if (triggered) { break; }
              }
              if (triggered) { break; }
            }
            if (triggered) { break; }
          }
        }
      }
    }
  }
  if (triggered) {
    atomicAdd(&watch_control[WATCH_TRIGGERED_COUNT_WORD], 1u);
  }
  atomicAdd(&watch_control[WATCH_COMPLETION_FAILURE_WORD], 1u);
}

@compute @workgroup_size(1)
fn seal(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u || arrayLength(&watch_control) < ${CONTROL_WORDS}u) {
    return;
  }
  let control = atomicLoad(&watch_control[WATCH_COMPLETION_FAILURE_WORD]);
  let count = atomicLoad(&watch_control[WATCH_TRIGGERED_COUNT_WORD]);
  let admitted = (control & 0x80000000u) == 0u
    && (control & 0x7fffffffu) == params.particle_count
    && count <= params.particle_count
    && atomicLoad(&watch_control[WATCH_PREPARE_ADMITTED_WORD]) == 1u
    && atomicLoad(&watch_control[WATCH_BINNED_SOURCE_COUNT_WORD])
      == atomicLoad(&watch_control[WATCH_ACTIVE_SOURCE_COUNT_WORD]);
  atomicStore(
    &watch_control[WATCH_RESULT_WORD],
    select(WATCH_ENCODED_FAILURE, count + WATCH_COUNT_BIAS, admitted)
  );
}
`;

const WATCH_PREPARE_ENTRY_MARKER =
  `\n@compute @workgroup_size(${WORKGROUP_SIZE})\nfn prepare`;
const WATCH_SCAN_ENTRY_MARKER = '\nfn watch_pair_triggered(';
const WATCH_SEAL_ENTRY_MARKER = '\n@compute @workgroup_size(1)\nfn seal';

function splitReactionMotionEnvelopeWatchWgsl(source) {
  const prepareStart = source.indexOf(WATCH_PREPARE_ENTRY_MARKER);
  const watchStart = source.indexOf(WATCH_SCAN_ENTRY_MARKER);
  const sealStart = source.indexOf(WATCH_SEAL_ENTRY_MARKER);
  if (
    prepareStart < 0
    || watchStart <= prepareStart
    || sealStart <= watchStart
  ) {
    throw new Error('reaction motion watch WGSL entry markers are inconsistent');
  }
  const shared = source.slice(0, prepareStart);
  return Object.freeze({
    prepare: `${shared}${source.slice(prepareStart, watchStart)}`,
    watch: `${shared}${source.slice(watchStart, sealStart)}`,
    seal: `${shared}${source.slice(sealStart)}`
  });
}

const reactionMotionEnvelopeWatchEntryWgsl =
  splitReactionMotionEnvelopeWatchWgsl(sphReactionMotionEnvelopeWatchWgsl);

// Dawn validates the combined source as one contract artifact, but each native
// pipeline receives only its own entry point. In particular, this keeps the
// small prepare call graph out of the driver module that contains the nested
// neighbor scan. NVIDIA's Vulkan compiler has been observed to terminate the
// GPU process while compiling the former three-entry module even though WGSL
// validation succeeds.
export const sphReactionMotionEnvelopeWatchPrepareWgsl =
  reactionMotionEnvelopeWatchEntryWgsl.prepare;
export const sphReactionMotionEnvelopeWatchScanWgsl =
  reactionMotionEnvelopeWatchEntryWgsl.watch;
export const sphReactionMotionEnvelopeWatchSealWgsl =
  reactionMotionEnvelopeWatchEntryWgsl.seal;

function observationFailure(error, mapAsyncCount) {
  const failure = error instanceof Error ? error : new Error(String(error));
  try {
    Object.defineProperty(failure, 'reactionActivationObservationMapAsyncCount', {
      value: mapAsyncCount
    });
    return failure;
  } catch {
    return new Error(failure.message, { cause: failure });
  }
}

function fatalObservationFailure(error, ErrorType = Error) {
  const failure = error instanceof Error
    ? error
    : new ErrorType(String(error));
  try {
    Object.defineProperties(failure, {
      code: {
        value: ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_FATAL_ERROR_CODE
      },
      reactionActivationObservationFatal: { value: true }
    });
    return failure;
  } catch {
    const wrapped = new ErrorType(failure.message, { cause: failure });
    wrapped.code = ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_FATAL_ERROR_CODE;
    wrapped.reactionActivationObservationFatal = true;
    return wrapped;
  }
}

function watchDeviceLostFailure(message) {
  const failure = message instanceof Error ? message : new Error(String(message));
  try {
    Object.defineProperties(failure, {
      code: {
        value:
          ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_DEVICE_LOST_ERROR_CODE
      },
      reactionActivationObservationDeviceLost: { value: true }
    });
    return failure;
  } catch {
    const wrapped = new Error(failure.message, { cause: failure });
    wrapped.code =
      ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_DEVICE_LOST_ERROR_CODE;
    wrapped.reactionActivationObservationDeviceLost = true;
    return wrapped;
  }
}

function assertObservationAuthenticity(record, proposal, resolvedDevice) {
  let currentTable;
  let currentFingerprint;
  try {
    currentTable = reactionRecordArray(record.reactionTable);
    currentFingerprint = schroederAuthorityTypedArrayFingerprint(
      currentTable.combined,
      'reaction-table-combined-records-v2'
    );
  } catch (error) {
    throw fatalObservationFailure(error, TypeError);
  }
  if (
    resolvedDevice !== record.device
    || currentTable.reactionCount !== record.reactionCount
    || currentTable.reactionCount !== proposal.reactionCount
    || currentTable.combined !== record.reactionRecords
    || currentFingerprint !== record.reactionTableFingerprint
    || record.reactionTable !== proposal.reactionTable
    || record.reactionMotionEnvelope !== proposal.reactionMotionEnvelope
    || !isExactSphReactionMotionEnvelope(record.reactionMotionEnvelope)
    || !webGpuBufferMatchesDevice(record.controlBuffer, resolvedDevice)
    || !webGpuBufferMatchesDevice(record.readbackBuffer, resolvedDevice)
    || record.controlBuffer.size !== CONTROL_BYTES
    || record.readbackBuffer.size !== OBSERVATION_BYTES
  ) {
    throw fatalObservationFailure(
      'reaction motion observation failed immutable authenticity',
      TypeError
    );
  }
  return true;
}

/**
 * Encode a terminal Tier0 watch on the fused command encoder. No submission or
 * mapping occurs here. The returned private capability owns only its small
 * watch resources; the borrowed terminal bins may retire at the schedule
 * fence after this encoder's four-byte copy completes.
 */
function encodeReactionMotionEnvelopeWatchForRoute({
  device,
  encoder,
  terminalStateBuffer,
  terminalThermoBuffer,
  terminalMechanicsBuffer,
  reactionTable,
  reactionMotionEnvelope,
  boxDimsM,
  neighborBins = null,
  particleCount,
  producer,
  ownedTerminalBinBuffers = [],
  onOwnedTerminalBinBuffersAdmitted = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer || !encoder) {
    throw new TypeError('reaction motion watch requires a device and encoder');
  }
  if (!isExactSphReactionMotionEnvelope(reactionMotionEnvelope)) {
    throw new TypeError('reaction motion watch requires an exact sealed envelope');
  }
  assertSphReactionMotionEnvelopeBoxDimsMatch(
    reactionMotionEnvelope,
    boxDimsM,
    'reaction motion watch boxDimsM'
  );
  if (producer !== TIER0_WATCH_PRODUCER && producer !== CANONICAL_WATCH_PRODUCER) {
    throw new TypeError('reaction motion watch requires a sealed producer route');
  }
  const watchLabelPrefix = producer === CANONICAL_WATCH_PRODUCER
    ? 'ulg-canonical-terminal-reaction-motion-watch'
    : 'ulg-tier0-reaction-motion-watch';
  const limits = reactionMotionWatchDeviceLimits(device);
  if (limits.maxStorageBuffersPerShaderStage < WATCH_STORAGE_BINDING_COUNT) {
    throw new RangeError(
      `reaction motion watch requires at least ${
        WATCH_STORAGE_BINDING_COUNT
      } storage buffers per shader stage`
    );
  }
  exactStorageByteLength(CONTROL_BYTES, 'watch control buffer', limits);
  exactBufferByteLength(OBSERVATION_BYTES, 'watch readback buffer', limits);
  exactBufferByteLength(PARAMS_BYTES, 'watch params buffer', limits);
  if (PARAMS_BYTES > limits.maxUniformBufferBindingSize) {
    throw new RangeError(
      'reaction motion watch params exceed maxUniformBufferBindingSize'
    );
  }
  const count = exactPositiveU32(
    particleCount,
    'particleCount',
    MAX_EXACT_F32_INTEGER
  );
  const stateByteLength = checkedPositiveProduct(
    [count, 2, 4, Float32Array.BYTES_PER_ELEMENT],
    'terminalStateBuffer byte length'
  );
  const thermoByteLength = checkedPositiveProduct(
    [count, 3, 4, Float32Array.BYTES_PER_ELEMENT],
    'terminalThermoBuffer byte length'
  );
  const mechanicsByteLength = checkedPositiveProduct(
    [count, 8, 4, Float32Array.BYTES_PER_ELEMENT],
    'terminalMechanicsBuffer byte length'
  );
  const stateBuffer = requireStorageBuffer(
    device,
    terminalStateBuffer,
    'terminalStateBuffer',
    stateByteLength,
    limits
  );
  const thermoBuffer = requireStorageBuffer(
    device,
    terminalThermoBuffer,
    'terminalThermoBuffer',
    thermoByteLength,
    limits
  );
  const mechanicsBuffer = requireStorageBuffer(
    device,
    terminalMechanicsBuffer,
    'terminalMechanicsBuffer',
    mechanicsByteLength,
    limits
  );
  const { reactionCount, combined } = reactionRecordArray(reactionTable);
  const reactionRecordFloatLength = checkedPositiveProduct(
    [reactionCount, REACTION_RECORD_FLOATS],
    'reaction record prefix length'
  );
  const reactionRecordByteLength = checkedPositiveProduct(
    [reactionRecordFloatLength, Float32Array.BYTES_PER_ELEMENT],
    'reaction record prefix byte length'
  );
  exactStorageByteLength(
    reactionRecordByteLength,
    'reaction record prefix',
    limits
  );
  const reactionRecordPrefix = combined.subarray(0, reactionRecordFloatLength);
  const reactionTableFingerprint =
    schroederAuthorityTypedArrayFingerprint(
      combined,
      'reaction-table-combined-records-v2'
    );
  const maximumContactRadiusM = exactNonnegativeWatchF32(
    maximumReactionContactRadiusM(reactionCount, combined),
    'reactionTable maximum contact radius'
  );
  const resolvedNeighborBins = resolvePostSeparationMotionWatchBinCandidate(
    neighborBins,
    {
      device,
      encoder,
      stateBuffer,
      mechanicsBuffer,
      particleCount: count
    }
  );
  const neighborBinLayout = resolvedNeighborBins
    ? exactNeighborBinLayout(resolvedNeighborBins, limits)
    : null;
  const binsReady = Boolean(neighborBinLayout);
  const binsBuffer = neighborBinLayout
    ? requireStorageBuffer(
        device,
        neighborBinLayout.binsBuffer,
        'neighborBins.binsBuffer',
        neighborBinLayout.byteLength,
        limits
      )
    : null;
  const prepareWorkgroups = neighborBinLayout
    ? exactWatchDispatchWorkgroups(
        Math.max(count, reactionCount, neighborBinLayout.cellCount),
        limits,
        'reaction motion watch prepare dispatch'
      )
    : 0;
  const watchWorkgroups = neighborBinLayout
    ? exactWatchDispatchWorkgroups(
        count,
        limits,
        'reaction motion watch scan dispatch'
      )
    : 0;

  if (!Array.isArray(ownedTerminalBinBuffers)) {
    throw new TypeError('ownedTerminalBinBuffers must be an array');
  }
  const ownedBuffers = [];
  for (const buffer of ownedTerminalBinBuffers) {
    if (
      !buffer
      || !webGpuBufferMatchesDevice(buffer, device)
      || ownedBuffers.includes(buffer)
      || buffer === stateBuffer
      || buffer === thermoBuffer
      || buffer === mechanicsBuffer
    ) {
      for (const owned of ownedBuffers) {
        try { owned.destroy?.(); } catch {}
      }
      throw new TypeError(
        'owned terminal-bin buffers must be distinct same-device private buffers'
      );
    }
    const admittedBuffer = requireBuffer(
      device,
      buffer,
      'owned terminal-bin buffer'
    );
    exactBufferByteLength(
      admittedBuffer.size,
      'owned terminal-bin buffer',
      limits
    );
    ownedBuffers.push(admittedBuffer);
  }
  onOwnedTerminalBinBuffersAdmitted?.();
  let controlBuffer = null;
  let readbackBuffer = null;
  let reactionRecordBuffer = null;
  let paramsBuffer = null;
  let encodingStatus = 'fail-closed-terminal-bins-unavailable';
  let dispatchCount = 0;
  try {
    controlBuffer = createBuffer(device, {
      label: `${watchLabelPrefix}-control`,
      size: CONTROL_BYTES,
      usage: GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST
    });
    controlBuffer = requireStorageBuffer(
      device,
      controlBuffer,
      'watch control buffer',
      CONTROL_BYTES,
      limits
    );
    ownedBuffers.push(controlBuffer);
    readbackBuffer = createBuffer(device, {
      label: `${watchLabelPrefix}-readback`,
      size: OBSERVATION_BYTES,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
    readbackBuffer = requireBuffer(
      device,
      readbackBuffer,
      'watch readback buffer',
      OBSERVATION_BYTES
    );
    exactBufferByteLength(
      readbackBuffer.size,
      'watch readback buffer',
      limits
    );
    ownedBuffers.push(readbackBuffer);
    // WebGPU allocations begin zeroed. Zero is the compact failure code, so a
    // missing prepare/watch/seal/copy can never manufacture a successful zero.
    if (binsReady) {
      reactionRecordBuffer = createBuffer(device, {
        label: `${watchLabelPrefix}-records`,
        size: reactionRecordByteLength,
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      });
      reactionRecordBuffer = requireStorageBuffer(
        device,
        reactionRecordBuffer,
        'watch reaction record buffer',
        reactionRecordByteLength,
        limits
      );
      ownedBuffers.push(reactionRecordBuffer);
      paramsBuffer = createBuffer(device, {
        label: `${watchLabelPrefix}-params`,
        size: PARAMS_BYTES,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      });
      paramsBuffer = requireBuffer(
        device,
        paramsBuffer,
        'watch params buffer',
        PARAMS_BYTES
      );
      exactBufferByteLength(paramsBuffer.size, 'watch params buffer', limits);
      if (paramsBuffer.size > limits.maxUniformBufferBindingSize) {
        throw new RangeError(
          'watch params buffer exceeds maxUniformBufferBindingSize'
        );
      }
      ownedBuffers.push(paramsBuffer);
      device.queue.writeBuffer(reactionRecordBuffer, 0, reactionRecordPrefix);
      device.queue.writeBuffer(paramsBuffer, 0, createParams({
        particleCount: count,
        reactionCount,
        neighborBins: neighborBinLayout,
        maximumContactRadiusM,
        motionEnvelope: reactionMotionEnvelope
      }));
      const bindings = [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'read-only-storage'),
        computeBufferBinding(4, 'read-only-storage'),
        computeBufferBinding(5, 'storage'),
        computeBufferBinding(6, 'uniform')
      ];
      const pipelineFor = (entryPoint) => {
        const code = reactionMotionEnvelopeWatchEntryWgsl[entryPoint];
        if (typeof code !== 'string') {
          throw new RangeError(
            `unknown reaction motion watch entry point: ${entryPoint}`
          );
        }
        return createCachedExplicitComputePipeline(device, {
          cacheKey: `ulg-tier0-reaction-motion-watch.${
            SPH_REACTION_MOTION_ENVELOPE_WATCH_PIPELINE_REVISION
          }.${entryPoint}`,
          label: `${watchLabelPrefix}-${entryPoint}`,
          code,
          entryPoint,
          bindings
        });
      };
      const preparePipeline = pipelineFor('prepare');
      const watchPipeline = pipelineFor('watch');
      const sealPipeline = pipelineFor('seal');
      const entries = [
        {
          binding: 0,
          resource: { buffer: stateBuffer, offset: 0, size: stateByteLength }
        },
        {
          binding: 1,
          resource: { buffer: thermoBuffer, offset: 0, size: thermoByteLength }
        },
        {
          binding: 2,
          resource: {
            buffer: mechanicsBuffer,
            offset: 0,
            size: mechanicsByteLength
          }
        },
        {
          binding: 3,
          resource: {
            buffer: reactionRecordBuffer,
            offset: 0,
            size: reactionRecordByteLength
          }
        },
        {
          binding: 4,
          resource: {
            buffer: binsBuffer,
            offset: 0,
            size: neighborBinLayout.byteLength
          }
        },
        {
          binding: 5,
          resource: { buffer: controlBuffer, offset: 0, size: CONTROL_BYTES }
        },
        {
          binding: 6,
          resource: { buffer: paramsBuffer, offset: 0, size: PARAMS_BYTES }
        }
      ];
      const bindGroupFor = (pipeline, label) => device.createBindGroup({
        label,
        layout: pipeline.bindGroupLayout,
        entries
      });
      const preparePass = encoder.beginComputePass({
        label: `${watchLabelPrefix}-prepare`
      });
      preparePass.setPipeline(preparePipeline.pipeline);
      preparePass.setBindGroup(0, bindGroupFor(
        preparePipeline,
        `${watchLabelPrefix}-prepare-bindings`
      ));
      preparePass.dispatchWorkgroups(prepareWorkgroups);
      preparePass.end();
      const watchPass = encoder.beginComputePass({
        label: `${watchLabelPrefix}-scan`
      });
      watchPass.setPipeline(watchPipeline.pipeline);
      watchPass.setBindGroup(0, bindGroupFor(
        watchPipeline,
        `${watchLabelPrefix}-scan-bindings`
      ));
      watchPass.dispatchWorkgroups(watchWorkgroups);
      watchPass.end();
      const sealPass = encoder.beginComputePass({
        label: `${watchLabelPrefix}-seal`
      });
      sealPass.setPipeline(sealPipeline.pipeline);
      sealPass.setBindGroup(0, bindGroupFor(
        sealPipeline,
        `${watchLabelPrefix}-seal-bindings`
      ));
      sealPass.dispatchWorkgroups(1);
      sealPass.end();
      encodingStatus = producer.encodedStatus;
      dispatchCount = 3;
    }
    encoder.copyBufferToBuffer(
      controlBuffer,
      0,
      readbackBuffer,
      0,
      OBSERVATION_BYTES
    );
  } catch (error) {
    for (const buffer of ownedBuffers) {
      try { buffer.destroy?.(); } catch {}
    }
    throw error;
  }

  let destroyed = false;
  let submitted = false;
  let proposal = null;
  const retiredOwnedBuffers = new Set();
  const record = {
    device,
    particleCount: count,
    stateBuffer,
    thermoBuffer,
    mechanicsBuffer,
    binsBuffer,
    reactionTable,
    reactionCount,
    reactionRecords: combined,
    reactionTableFingerprint,
    reactionMotionEnvelope,
    producer,
    controlBuffer,
    readbackBuffer,
    ownedBuffers,
    submitted: false,
    consumed: false,
    inFlight: false,
    mapCompletionObserved: false,
    submissionCompletionObserved: false,
    deviceLifecycle: null,
    destroyOwned: null,
    releaseRequested: false,
    quarantined: false,
    fallbackCompletionArmed: false,
    releaseFailureCount: 0
  };
  const destroyOwned = () => {
    if (destroyed) return false;
    for (const buffer of ownedBuffers) {
      if (retiredOwnedBuffers.has(buffer)) continue;
      try {
        buffer.destroy?.();
        retiredOwnedBuffers.add(buffer);
      } catch {
        record.releaseFailureCount += 1;
      }
    }
    if (retiredOwnedBuffers.size !== ownedBuffers.length) {
      record.quarantined = true;
      return false;
    }
    destroyed = true;
    record.quarantined = false;
    record.deviceLifecycle?.records.delete(record);
    return true;
  };
  record.destroyOwned = destroyOwned;
  let armCanonicalReleaseCompletion = () => false;
  const destroy = () => {
    if (destroyed) return false;
    record.releaseRequested = true;
    if (record.inFlight) {
      if (record.producer === CANONICAL_WATCH_PRODUCER) {
        if (record.submissionCompletionObserved === true) {
          return destroyOwned();
        }
        // A concurrent MAP_READ can reject without supplying completion
        // authority. Arm the standalone submission's success-only fence now
        // so a healthy device does not retain the quarantined watch forever.
        armCanonicalReleaseCompletion();
      }
      return true;
    }
    if (
      submitted
      && record.mapCompletionObserved !== true
      && record.submissionCompletionObserved !== true
    ) {
      // A rejected/absent queue fence is not destruction authority. Keep the
      // private buffers reachable through the proposal so explicit lane or
      // device teardown can retire them. A standalone canonical submit arms a
      // success-only release fence on explicit destruction; the Tier0 route
      // keeps using its caller-owned terminal fence.
      record.quarantined = true;
      if (record.producer === CANONICAL_WATCH_PRODUCER) {
        armCanonicalReleaseCompletion();
      }
      return false;
    }
    return destroyOwned();
  };
  const markSubmittedWork = () => {
    if (destroyed || submitted) return false;
    submitted = true;
    record.submitted = true;
    return true;
  };
  const completeSubmittedWork = () => {
    if (destroyed || !submitted) return false;
    // The registered cleanup owner and the observation path can present the
    // same authentic terminal-fence success. Replaying that authority is
    // idempotent; it is not a second submission completion.
    if (record.submissionCompletionObserved) {
      if (
        record.releaseRequested
        && (
          !record.inFlight
          || record.producer === CANONICAL_WATCH_PRODUCER
        )
      ) {
        return destroyOwned();
      }
      return true;
    }
    record.submissionCompletionObserved = true;
    record.quarantined = false;
    if (
      record.releaseRequested
      && (
        !record.inFlight
        || record.producer === CANONICAL_WATCH_PRODUCER
      )
    ) {
      return destroyOwned();
    }
    return true;
  };
  armCanonicalReleaseCompletion = () => {
    if (
      record.fallbackCompletionArmed === true
      || typeof record.device?.queue?.onSubmittedWorkDone !== 'function'
    ) return false;
    let completion;
    try {
      completion = record.device.queue.onSubmittedWorkDone();
    } catch {
      return false;
    }
    if (!completion || typeof completion.then !== 'function') return false;
    record.fallbackCompletionArmed = true;
    Promise.resolve(completion).then(
      () => {
        try { completeSubmittedWork(); } catch {}
      },
      () => {
        // Rejection does not authorize destruction. The record remains in the
        // shared device-loss lifecycle with releaseRequested=true.
        if (!destroyed) record.quarantined = true;
      }
    );
    return true;
  };
  record.completeSubmittedWork = completeSubmittedWork;
  record.deviceLifecycle = watchDeviceLifecycleFor(device);
  if (record.deviceLifecycle?.terminalObserved) {
    record.submissionCompletionObserved = true;
    destroyOwned();
  } else {
    record.deviceLifecycle?.records.add(record);
  }
  proposal = Object.freeze({
    schema: ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_PROPOSAL_SCHEMA,
    status: encodingStatus,
    ready: true,
    backend: 'webgpu',
    particleCount: count,
    reactionCount,
    reactionTable,
    reactionTableFingerprint,
    reactionMotionEnvelope,
    predicateRevision: SPH_REACTION_MOTION_ENVELOPE_PREDICATE_REVISION,
    producerRoute: producer.producerRoute,
    sampleStage: producer.sampleStage,
    nodeDomain: producer.nodeDomain,
    shadowOnly: true,
    dispatchCount,
    encodedIntoCallerSubmission: producer.encodedIntoCallerSubmission,
    ownedCommandSubmissionCount: producer.ownedCommandSubmissionCount,
    mapAsyncCount: 0,
    readbackByteLength: OBSERVATION_BYTES,
    fullParticleReadbackPerformed: false,
    terminalBinsAdmitted: binsReady,
    terminalBinOverflowPolicy: 'gpu-sentinel-on-any-cell-over-capacity',
    markSubmittedWork,
    destroy,
    get released() { return destroyed; },
    get submitted() { return submitted; },
    get quarantined() { return record.quarantined; },
    get releaseFailureCount() { return record.releaseFailureCount; }
  });
  record.proposal = proposal;
  proposalRecords.set(proposal, record);
  return proposal;
}

/** Encode the Tier0 watch into the fused route's existing submission. */
export function encodeSphReactionMotionEnvelopeWatchWebGpu(args = {}) {
  return encodeReactionMotionEnvelopeWatchForRoute({
    ...args,
    producer: TIER0_WATCH_PRODUCER,
    ownedTerminalBinBuffers: []
  });
}

/**
 * Build and submit a compact canonical watch over the exact closure-terminal
 * state/thermo/mechanics family. The worker's existing schedule-terminal fence
 * orders this submission before the single four-byte map; this function takes
 * no host fence of its own.
 */
export function runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
  device,
  terminalStateBuffer,
  terminalThermoBuffer,
  terminalMechanicsBuffer,
  reactionTable,
  reactionMotionEnvelope,
  particleCount,
  boxDimsM
} = {}) {
  if (
    !device?.createCommandEncoder
    || !device.queue?.submit
    || !isExactSphReactionMotionEnvelope(reactionMotionEnvelope)
  ) {
    throw new TypeError(
      'canonical terminal reaction watch requires a live device and sealed envelope'
    );
  }
  const deviceLifecycle = watchDeviceLifecycleFor(device);
  if (deviceLifecycle?.terminalObserved === true) {
    throw watchDeviceLostFailure(
      'canonical terminal reaction watch rejects an already-lost device'
    );
  }
  const encoder = device.createCommandEncoder({
    label: 'ulg-canonical-terminal-reaction-motion-watch'
  });
  let bins = null;
  let proposal = null;
  let submitted = false;
  let terminalBinOwnershipTransferred = false;
  try {
    bins = encodeMlsMpmParticleMotionWatchBins(device, encoder, {
      stateBuffer: terminalStateBuffer,
      mechanicsBuffer: terminalMechanicsBuffer,
      particleCount,
      boxDimsM,
      cellSizeFloorM: reactionMotionEnvelope.gridSpacingM
    });
    proposal = encodeReactionMotionEnvelopeWatchForRoute({
      device,
      encoder,
      terminalStateBuffer,
      terminalThermoBuffer,
      terminalMechanicsBuffer,
      reactionTable,
      reactionMotionEnvelope,
      boxDimsM,
      neighborBins: bins.postSeparationThermalBinCandidate,
      particleCount,
      producer: CANONICAL_WATCH_PRODUCER,
      ownedTerminalBinBuffers: [...bins.transientBuffers],
      onOwnedTerminalBinBuffersAdmitted() {
        terminalBinOwnershipTransferred = true;
      }
    });
    if (proposal.released === true) {
      throw watchDeviceLostFailure(
        'canonical terminal reaction watch lost its device before submission'
      );
    }
    device.queue.submit([encoder.finish()]);
    submitted = true;
    if (proposal.markSubmittedWork() !== true) {
      // This cannot occur for a freshly minted private proposal. If internal
      // state is ever violated after submit, retain every referenced buffer in
      // the per-device lifecycle rather than destroying queued resources.
      throw new Error(
        'canonical terminal reaction watch rejected its command submission'
      );
    }
    return proposal;
  } catch (error) {
    if (!proposal) {
      if (!terminalBinOwnershipTransferred) {
        for (const buffer of bins?.transientBuffers || []) {
          try { buffer.destroy?.(); } catch {}
        }
      }
    } else if (!submitted) {
      proposal.destroy?.();
    }
    throw error;
  }
}

/**
 * Authenticate the exact borrowed terminal particle family behind a compact
 * proposal. Public proposal fields intentionally do not expose GPU buffers;
 * only this module's private WeakMap record can answer the identity check.
 */
export function sphReactionMotionEnvelopeWatchMatchesTerminalStorageFamily(
  proposal,
  {
    device = null,
    terminalStateBuffer = null,
    terminalThermoBuffer = null,
    terminalMechanicsBuffer = null,
    particleCount = null
  } = {}
) {
  const record = proposalRecords.get(proposal);
  return Boolean(
    record
    && record.proposal === proposal
    && proposal?.schema
      === ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_PROPOSAL_SCHEMA
    && device != null
    && record.device === device
    && record.stateBuffer === terminalStateBuffer
    && record.thermoBuffer === terminalThermoBuffer
    && record.mechanicsBuffer === terminalMechanicsBuffer
    && Number.isSafeInteger(particleCount)
    && particleCount >= 1
    && record.particleCount === particleCount
    && proposal.particleCount === particleCount
  );
}

/**
 * Admit completion only through the module's private proposal record. The
 * worker calls this after its terminal queue fence succeeds; a copied or
 * structurally forged proposal cannot release the watch buffers.
 */
export function markSphReactionMotionEnvelopeWatchSubmittedWorkCompleted(
  proposal,
  { device = null } = {}
) {
  const record = proposalRecords.get(proposal);
  if (
    !record
    || record.proposal !== proposal
    || proposal?.schema
      !== ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_PROPOSAL_SCHEMA
    || (device != null && record.device !== device)
  ) return false;
  return record.completeSubmittedWork();
}

export async function observeSphReactionMotionEnvelopeWatch(
  proposal,
  { device = null } = {}
) {
  let mapAsyncCount = 0;
  try {
    const record = proposalRecords.get(proposal);
    if (
      !record
      || record.proposal !== proposal
      || proposal?.schema
        !== ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_PROPOSAL_SCHEMA
      || proposal.ready !== true
      || proposal.released === true
      || record.submitted !== true
      || record.consumed === true
    ) {
      throw fatalObservationFailure(
        'reaction motion observation requires a submitted live authentic proposal',
        TypeError
      );
    }
    const resolvedDevice = device || webGpuBufferDevice(record.readbackBuffer);
    assertObservationAuthenticity(record, proposal, resolvedDevice);
    record.consumed = true;
    record.inFlight = true;
    let mapped = false;
    let encodedEvidenceWord;
    try {
      mapAsyncCount = 1;
      if (record.deviceLifecycle?.terminalObserved) {
        throw watchDeviceLostFailure(
          'reaction motion observation aborted because the WebGPU device was lost'
        );
      }
      const mapPromise = Promise.resolve(
        record.readbackBuffer.mapAsync(GPU_MAP_MODE.READ)
      );
      // If device loss wins the race, retain a rejection handler on the late
      // map result. A lost implementation is allowed to reject MAP_READ after
      // the observation has already failed closed.
      mapPromise.catch(() => {});
      const completion = record.deviceLifecycle?.terminalPromise
        ? await Promise.race([
            mapPromise.then(() => 'mapped'),
            record.deviceLifecycle.terminalPromise
          ])
        : await mapPromise.then(() => 'mapped');
      if (completion !== 'mapped') {
        throw watchDeviceLostFailure(
          'reaction motion observation aborted because the WebGPU device was lost while MAP_READ was pending'
        );
      }
      // Successful MAP_READ completion orders after the copy that sealed this
      // word, so proposal-owned buffers can be destroyed without taking a
      // second queue fence after the worker's terminal boundary map.
      record.mapCompletionObserved = true;
      mapped = true;
      const mappedRange = record.readbackBuffer.getMappedRange(
        0,
        OBSERVATION_BYTES
      );
      if (
        !mappedRange
        || typeof mappedRange.byteLength !== 'number'
        || mappedRange.byteLength !== OBSERVATION_BYTES
      ) {
        throw fatalObservationFailure(
          'reaction motion observation returned a malformed mapped range',
          RangeError
        );
      }
      encodedEvidenceWord = new Uint32Array(mappedRange, 0, 1)[0];
    } finally {
      try {
        if (mapped) record.readbackBuffer.unmap();
      } finally {
        record.inFlight = false;
        if (
          record.releaseRequested
          && (
            record.mapCompletionObserved === true
            || record.submissionCompletionObserved === true
          )
        ) {
          record.destroyOwned?.();
        } else if (record.releaseRequested) {
          record.quarantined = true;
        }
      }
    }
    // The table can be changed while MAP_READ is pending. Recompute the exact
    // count, identity, and fingerprint after the await before admitting bytes
    // uploaded from the earlier snapshot.
    assertObservationAuthenticity(record, proposal, resolvedDevice);
    const uncertainty =
      encodedEvidenceWord === ENCODED_OBSERVATION_FAILURE_WORD;
    if (
      !uncertainty
      && (
        !Number.isSafeInteger(encodedEvidenceWord)
        || encodedEvidenceWord < ENCODED_OBSERVATION_COUNT_BIAS
        || encodedEvidenceWord
          > proposal.particleCount + ENCODED_OBSERVATION_COUNT_BIAS
      )
    ) {
      throw fatalObservationFailure(
        'reaction motion observation exceeded its authenticated source domain',
        RangeError
      );
    }
    const triggeredSourceCount = uncertainty
      ? null
      : encodedEvidenceWord - ENCODED_OBSERVATION_COUNT_BIAS;
    if (
      !uncertainty
      && proposal.reactionMotionEnvelope.thermalPhaseEvolutionEnabled === true
      && triggeredSourceCount !== proposal.particleCount
    ) {
      throw fatalObservationFailure(
        'thermal/phase-latched reaction motion observation did not trigger every fixed carrier slot'
      );
    }
    const rawEvidenceWord = uncertainty
      ? OBSERVATION_SENTINEL
      : triggeredSourceCount;
    return Object.freeze({
      schema: ULG_SPH_REACTION_ACTIVATION_OBSERVATION_SCHEMA,
      status: uncertainty
        ? 'reaction-activation-observation-uncertain'
        : 'reaction-activation-observation-ready',
      predicateRevision: proposal.predicateRevision,
      producerRoute: proposal.producerRoute,
      sampleStage: proposal.sampleStage,
      nodeDomain: proposal.nodeDomain,
      motionEnvelope: proposal.reactionMotionEnvelope,
      shadowOnly: true,
      routingAuthority: false,
      observationSucceeded: !uncertainty,
      triggered: uncertainty || triggeredSourceCount > 0,
      triggeredSourceCount,
      uncertainty,
      rawEvidenceWord,
      particleCount: proposal.particleCount,
      reactionCount: proposal.reactionCount,
      reactionTableFingerprint: proposal.reactionTableFingerprint,
      mapAsyncCount: 1,
      readbackByteLength: OBSERVATION_BYTES,
      fullParticleReadbackPerformed: false
    });
  } catch (error) {
    throw observationFailure(error, mapAsyncCount);
  }
}
