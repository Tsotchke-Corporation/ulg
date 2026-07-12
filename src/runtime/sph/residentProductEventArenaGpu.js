import { createWebGpuU32ExclusiveScan } from '../webgpuRadixScanUnique.js';
import {
  SPH_GPU_REACTION_PRODUCT_EVENT_PREFIX_METADATA_U32_LAYOUT
} from '../../../ulg-gpu-abi/src/index.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice
} from './sphGpuDeviceIdentity.js';

export const ULG_SPH_RESIDENT_PRODUCT_EVENT_ARENA_SCHEMA =
  'peercompute.ulg.sph-resident-product-event-arena.v0';
export const ULG_SPH_RESIDENT_PRODUCT_EVENT_ARENA_EXECUTION_SCHEMA =
  'peercompute.ulg.sph-resident-product-event-arena-append-execution.v0';
export const ULG_SPH_RESIDENT_PRODUCT_EVENT_ARENA_CAPACITY_DESCRIPTOR_SCHEMA =
  'peercompute.ulg.sph-resident-product-event-arena-capacity-descriptor.v0';
export const SPH_RESIDENT_PRODUCT_EVENT_ARENA_CAPACITY_BUCKET_ROWS = 4096;
export const SPH_RESIDENT_PRODUCT_EVENT_ARENA_MAX_BYTES_DEFAULT = 128 * 1024 * 1024;
export const SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA_WORDS = 16;
export const SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA_BYTES =
  SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA_WORDS * Uint32Array.BYTES_PER_ELEMENT;
export const SPH_RESIDENT_PRODUCT_EVENT_ARENA_INDIRECT_BYTES = 3 * Uint32Array.BYTES_PER_ELEMENT;
const SPH_REACTION_PRODUCT_EVENT_PREFIX_METADATA_BYTES =
  SPH_GPU_REACTION_PRODUCT_EVENT_PREFIX_METADATA_U32_LAYOUT.length
  * Uint32Array.BYTES_PER_ELEMENT;
export const SPH_RESIDENT_PRODUCT_EVENT_ARENA_OVERFLOW_CAPACITY = 1;

export const SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA = Object.freeze({
  magic: 0,
  version: 1,
  occupiedRowCount: 2,
  activeRowCount: 3,
  capacityRows: 4,
  appendedRowCount: 5,
  overflowFlags: 6,
  generationId: 7,
  strideFloats: 8,
  historyCopiedRowCount: 9,
  appendSubmissionCount: 10,
  diagnosticMapCount: 11,
  appendBaseRow: 12,
  sourceRowCount: 13,
  sourceCapacityRows: 14,
  appendAdmitted: 15
});

const U32_MAX = 0xffffffff;
const METADATA_MAGIC = 0x554c4750;
const APPEND_WORKGROUP_SIZE = 64;
const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256
};
const GPU_MAP_MODE = { READ: globalThis.GPUMapMode?.READ ?? 1 };
const GPU_SHADER_STAGE_COMPUTE = globalThis.GPUShaderStage?.COMPUTE ?? 4;
const pipelineCache = new WeakMap();

export const residentProductEventArenaAppendWgsl = /* wgsl */ `
struct AppendParams {
  source_row_count: u32,
  stride_vec4: u32,
  capacity_rows: u32,
  generation_id: u32,
  history_copied_rows: u32,
  source_capacity_rows: u32,
  min_live_mass_kg: f32,
  _pad0: u32,
};

@group(0) @binding(0) var<storage, read> source_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> live_flags: array<u32>;
@group(0) @binding(2) var<storage, read> live_offsets: array<u32>;
@group(0) @binding(3) var<storage, read_write> arena_rows: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> metadata: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> dispatch_indirect: array<u32>;
@group(0) @binding(6) var<uniform> params: AppendParams;
@group(0) @binding(7) var<storage, read> source_prefix_metadata: array<u32>;

fn exact_source_prefix_valid() -> bool {
  return arrayLength(&source_prefix_metadata) >= 20u
    && source_prefix_metadata[0] == 0x554c4752u
    && source_prefix_metadata[1] == 0u
    && source_prefix_metadata[4] == params.source_row_count
    && source_prefix_metadata[6] <= params.source_row_count
    && source_prefix_metadata[7] == 0u
    && source_prefix_metadata[8] == 1u
    && source_prefix_metadata[9] == 1u
    && source_prefix_metadata[10] == source_prefix_metadata[6]
    && source_prefix_metadata[11] == params.stride_vec4 * 4u
    && source_prefix_metadata[17] == 4u;
}

fn source_invocation_index(
  local_id: vec3<u32>,
  workgroup_id: vec3<u32>
) -> u32 {
  var linear_group = workgroup_id.x;
  if (exact_source_prefix_valid()) {
    linear_group = workgroup_id.x
      + workgroup_id.y * max(source_prefix_metadata[12], 1u);
  }
  return linear_group * ${APPEND_WORKGROUP_SIZE}u + local_id.x;
}

@compute @workgroup_size(${APPEND_WORKGROUP_SIZE})
fn mark_live_source_rows(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let source_row = source_invocation_index(local_id, workgroup_id);
  let exact_count = select(
    params.source_row_count,
    source_prefix_metadata[6],
    exact_source_prefix_valid()
  );
  if (source_row >= exact_count || source_row >= params.source_capacity_rows) {
    return;
  }
  let stride = max(params.stride_vec4, 5u);
  let base = source_row * stride;
  let unplaced_mass_kg = source_rows[base + 3u].y;
  let status = source_rows[base + 4u].z;
  live_flags[source_row] = select(
    0u,
    1u,
    status == 1.0 && unplaced_mass_kg > params.min_live_mass_kg
  );
}

@compute @workgroup_size(1)
fn finalize_append(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u) { return; }
  let last = params.source_row_count - 1u;
  let append_count = live_offsets[last] + live_flags[last];
  let prior_occupied = atomicLoad(&metadata[2]);
  atomicStore(&metadata[5], 0u);
  atomicStore(&metadata[12], prior_occupied);
  atomicStore(&metadata[13], params.source_row_count);
  atomicStore(&metadata[14], params.source_capacity_rows);
  atomicStore(&metadata[15], 0u);
  atomicStore(&metadata[4], params.capacity_rows);
  atomicStore(&metadata[7], params.generation_id);
  if (params.history_copied_rows > 0u) {
    atomicStore(&metadata[9], params.history_copied_rows);
  }
  atomicAdd(&metadata[10], 1u);
  if (atomicLoad(&metadata[6]) != 0u) {
    dispatch_indirect[0] = 0u;
    dispatch_indirect[1] = 1u;
    dispatch_indirect[2] = 1u;
    return;
  }
  if (
    prior_occupied > params.capacity_rows
    || append_count > params.capacity_rows - min(prior_occupied, params.capacity_rows)
  ) {
    atomicOr(&metadata[6], ${SPH_RESIDENT_PRODUCT_EVENT_ARENA_OVERFLOW_CAPACITY}u);
    dispatch_indirect[0] = 0u;
    dispatch_indirect[1] = 1u;
    dispatch_indirect[2] = 1u;
    return;
  }
  let next_occupied = prior_occupied + append_count;
  atomicStore(&metadata[2], next_occupied);
  atomicStore(&metadata[3], next_occupied);
  atomicStore(&metadata[5], append_count);
  atomicStore(&metadata[15], 1u);
  dispatch_indirect[0] = (next_occupied + ${APPEND_WORKGROUP_SIZE - 1}u) / ${APPEND_WORKGROUP_SIZE}u;
  dispatch_indirect[1] = 1u;
  dispatch_indirect[2] = 1u;
}

@compute @workgroup_size(${APPEND_WORKGROUP_SIZE})
fn scatter_live_source_rows(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let source_row = source_invocation_index(local_id, workgroup_id);
  let exact_count = select(
    params.source_row_count,
    source_prefix_metadata[6],
    exact_source_prefix_valid()
  );
  if (
    source_row >= exact_count
    || live_flags[source_row] == 0u
    || atomicLoad(&metadata[15]) == 0u
  ) {
    return;
  }
  let destination_row = atomicLoad(&metadata[12]) + live_offsets[source_row];
  if (destination_row >= params.capacity_rows) {
    atomicOr(&metadata[6], ${SPH_RESIDENT_PRODUCT_EVENT_ARENA_OVERFLOW_CAPACITY}u);
    atomicStore(&metadata[15], 0u);
    return;
  }
  for (var component = 0u; component < params.stride_vec4; component = component + 1u) {
    arena_rows[destination_row * params.stride_vec4 + component] =
      source_rows[source_row * params.stride_vec4 + component];
  }
}
`;

function u32(value, label, { min = 0, max = U32_MAX } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer in [${min}, ${max}]`);
  }
  return number;
}

function assertDevice(device) {
  if (
    !device?.createBuffer
    || !device?.createCommandEncoder
    || !device?.createShaderModule
    || !device?.createComputePipeline
    || !device?.createBindGroupLayout
    || !device?.createPipelineLayout
    || !device?.createBindGroup
    || !device.queue?.writeBuffer
    || !device.queue?.submit
  ) {
    throw new TypeError('resident product-event arena requires a WebGPU-like device');
  }
}

function align4(value) {
  return Math.max(4, Math.ceil(value / 4) * 4);
}

function geometricCapacity(required, floor) {
  if (required === 0) return 0;
  let value = Math.max(1, floor);
  while (value < required && value <= U32_MAX / 2) value *= 2;
  return Math.max(required, value);
}

function deviceCapacityLimitRows(device, strideBytes, maxArenaBytes) {
  const maxBufferSize = Number(device?.limits?.maxBufferSize) || U32_MAX;
  const maxBindingSize = Number(device?.limits?.maxStorageBufferBindingSize) || maxBufferSize;
  return Math.max(0, Math.min(
    U32_MAX,
    Math.floor(maxArenaBytes / strideBytes),
    Math.floor(maxBufferSize / strideBytes),
    Math.floor(maxBindingSize / strideBytes)
  ));
}

export function reserveResidentProductEventArenaCapacity({
  requiredRowCount,
  currentCapacityRows = 0,
  bucketRows = SPH_RESIDENT_PRODUCT_EVENT_ARENA_CAPACITY_BUCKET_ROWS,
  maxCapacityRows = U32_MAX
} = {}) {
  const required = u32(requiredRowCount, 'requiredRowCount');
  const current = u32(currentCapacityRows, 'currentCapacityRows');
  const floor = u32(bucketRows, 'bucketRows', { min: 1 });
  const maximum = u32(maxCapacityRows, 'maxCapacityRows', { min: 1 });
  if (required > maximum) {
    throw Object.assign(
      new RangeError(`resident product-event arena requires ${required} rows; maximum is ${maximum}`),
      {
        status: 'resident-product-event-arena-capacity-overflow-fail-closed',
        requiredRowCount: required,
        maxCapacityRows: maximum,
        overflowFlags: SPH_RESIDENT_PRODUCT_EVENT_ARENA_OVERFLOW_CAPACITY
      }
    );
  }
  const fitsCurrentCapacity = required <= current;
  const geometric = required === 0 ? 0 : Math.min(maximum, geometricCapacity(required, floor));
  const reservedCapacityRows = fitsCurrentCapacity ? current : geometric;
  return {
    schema: 'peercompute.ulg.sph-resident-product-event-arena-capacity-reservation.v0',
    status: fitsCurrentCapacity
      ? 'resident-product-event-arena-capacity-reused'
      : 'resident-product-event-arena-capacity-grown-geometrically',
    requiredRowCount: required,
    currentCapacityRows: current,
    reservedCapacityRows,
    capacityHeadroomRows: reservedCapacityRows - required,
    bucketRows: floor,
    maxCapacityRows: maximum,
    fitsCurrentCapacity,
    growthRequired: !fitsCurrentCapacity,
    growthPolicy: 'grow-only-geometric-power-of-two-with-bounded-final-ceiling',
    overflowFlags: 0
  };
}

export function reserveResidentProductEventArenaBatchCapacity({
  requiredRowCount,
  currentCapacityRows = 0,
  maxCapacityRows = U32_MAX
} = {}) {
  const required = u32(requiredRowCount, 'requiredRowCount');
  const current = u32(currentCapacityRows, 'currentCapacityRows');
  const maximum = u32(maxCapacityRows, 'maxCapacityRows', { min: 1 });
  if (required > maximum) {
    throw Object.assign(
      new RangeError(`resident product-event arena requires ${required} rows; maximum is ${maximum}`),
      {
        status: 'resident-product-event-arena-capacity-overflow-fail-closed',
        requiredRowCount: required,
        maxCapacityRows: maximum,
        overflowFlags: SPH_RESIDENT_PRODUCT_EVENT_ARENA_OVERFLOW_CAPACITY
      }
    );
  }
  const fitsCurrentCapacity = required <= current;
  const reservedCapacityRows = fitsCurrentCapacity ? current : required;
  return {
    schema: 'peercompute.ulg.sph-resident-product-event-arena-capacity-reservation.v0',
    status: fitsCurrentCapacity
      ? 'resident-product-event-arena-capacity-reused'
      : 'resident-product-event-arena-batch-capacity-grown-to-exact-upper-bound',
    requiredRowCount: required,
    currentCapacityRows: current,
    reservedCapacityRows,
    capacityHeadroomRows: reservedCapacityRows - required,
    bucketRows: null,
    maxCapacityRows: maximum,
    fitsCurrentCapacity,
    growthRequired: !fitsCurrentCapacity,
    growthPolicy: 'exact-conservative-batch-upper-bound-no-geometric-overreservation',
    overflowFlags: 0
  };
}

function pipelines(device) {
  let cached = pipelineCache.get(device);
  if (cached) return cached;
  const module = device.createShaderModule({
    label: 'ulg-sph-resident-product-event-arena-append',
    code: residentProductEventArenaAppendWgsl
  });
  const bindGroupLayout = device.createBindGroupLayout({
    label: 'ulg-sph-resident-product-event-arena-append-layout',
    entries: [
      { binding: 0, visibility: GPU_SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPU_SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
      { binding: 2, visibility: GPU_SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: GPU_SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
      { binding: 4, visibility: GPU_SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
      { binding: 5, visibility: GPU_SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
      { binding: 6, visibility: GPU_SHADER_STAGE_COMPUTE, buffer: { type: 'uniform' } },
      { binding: 7, visibility: GPU_SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } }
    ]
  });
  const pipelineLayout = device.createPipelineLayout({
    label: 'ulg-sph-resident-product-event-arena-append-pipeline-layout',
    bindGroupLayouts: [bindGroupLayout]
  });
  const create = (entryPoint) => device.createComputePipeline({
    label: `ulg-sph-resident-product-event-arena-${entryPoint}`,
    layout: pipelineLayout,
    compute: { module, entryPoint }
  });
  cached = {
    mark: create('mark_live_source_rows'),
    finalize: create('finalize_append'),
    scatter: create('scatter_live_source_rows'),
    bindGroupLayout
  };
  pipelineCache.set(device, cached);
  return cached;
}

function initialMetadata({ capacityRows, generationId, strideFloats, sourceCapacityRows }) {
  const words = new Uint32Array(SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA_WORDS);
  words[SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.magic] = METADATA_MAGIC;
  words[SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.version] = 1;
  words[SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.capacityRows] = capacityRows;
  words[SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.generationId] = generationId;
  words[SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.strideFloats] = strideFloats;
  words[SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.sourceCapacityRows] = sourceCapacityRows;
  return words;
}

function createWorkspace(device, { sourceCapacityRows, label }) {
  const capacity = u32(sourceCapacityRows, 'sourceCapacityRows', { min: 1 });
  const flagsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-source-live-flags-${capacity}`,
    size: align4(capacity * 4),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  const offsetsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-source-live-offsets-${capacity}`,
    size: align4(capacity * 4),
    usage: GPU_BUFFER_USAGE.STORAGE
  }), device);
  const fallbackPrefixMetadataBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-source-prefix-disabled-${capacity}`,
    size: SPH_REACTION_PRODUCT_EVENT_PREFIX_METADATA_BYTES,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  device.queue.writeBuffer(
    fallbackPrefixMetadataBuffer,
    0,
    new Uint32Array(SPH_GPU_REACTION_PRODUCT_EVENT_PREFIX_METADATA_U32_LAYOUT.length)
  );
  const scan = createWebGpuU32ExclusiveScan(device, {
    maxElementCount: capacity,
    label: `${label}-source-live-scan-${capacity}`,
    retainParamsBuffer: true
  });
  return {
    sourceCapacityRows: capacity,
    flagsBuffer,
    offsetsBuffer,
    fallbackPrefixMetadataBuffer,
    scan,
    destroy() {
      flagsBuffer.destroy?.();
      offsetsBuffer.destroy?.();
      fallbackPrefixMetadataBuffer.destroy?.();
      scan.destroy?.();
    }
  };
}

export function createResidentProductEventArenaGpu(device, {
  strideFloats,
  capacityRows,
  sourceCapacityRows = capacityRows,
  maxCapacityRows = capacityRows,
  generationId = 1,
  label = 'ulg-sph-resident-product-event-arena'
} = {}) {
  assertDevice(device);
  const stride = u32(strideFloats, 'strideFloats', { min: 20 });
  if (stride % 4 !== 0) throw new RangeError('strideFloats must be vec4-aligned');
  const capacity = u32(capacityRows, 'capacityRows', { min: 1 });
  const sourceCapacity = u32(sourceCapacityRows, 'sourceCapacityRows', { min: 1 });
  const maximum = u32(maxCapacityRows, 'maxCapacityRows', { min: capacity });
  const generation = u32(generationId, 'generationId', { min: 1 });
  const strideBytes = stride * Float32Array.BYTES_PER_ELEMENT;
  const buffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-rows-${generation}`,
    size: align4(capacity * strideBytes),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  const metadataBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-metadata-${generation}`,
    size: SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA_BYTES,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  const dispatchIndirectBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-dispatch-indirect-${generation}`,
    size: SPH_RESIDENT_PRODUCT_EVENT_ARENA_INDIRECT_BYTES,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT
      | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  const paramsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-append-params-${generation}`,
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  const workspace = createWorkspace(device, { sourceCapacityRows: sourceCapacity, label });
  device.queue.writeBuffer(metadataBuffer, 0, initialMetadata({
    capacityRows: capacity,
    generationId: generation,
    strideFloats: stride,
    sourceCapacityRows: sourceCapacity
  }));
  device.queue.writeBuffer(dispatchIndirectBuffer, 0, new Uint32Array([0, 1, 1]));
  let destroyed = false;
  const arena = {
    schema: ULG_SPH_RESIDENT_PRODUCT_EVENT_ARENA_SCHEMA,
    status: 'resident-product-event-arena-ready',
    device,
    label,
    generationId: generation,
    strideFloats: stride,
    strideBytes,
    capacityRows: capacity,
    maxCapacityRows: maximum,
    occupiedRowCountUpperBound: 0,
    pendingEncoderSequenceToken: null,
    appendSubmissionCount: 0,
    diagnosticMapCount: 0,
    buffer,
    metadataBuffer,
    dispatchIndirectBuffer,
    paramsBuffer,
    workspace,
    retiredWorkspaces: [],
    destroyed: false,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      arena.destroyed = true;
      arena.status = 'resident-product-event-arena-destroyed';
      buffer.destroy?.();
      metadataBuffer.destroy?.();
      dispatchIndirectBuffer.destroy?.();
      paramsBuffer.destroy?.();
      arena.workspace.destroy();
      for (const retired of arena.retiredWorkspaces) {
        if (retired !== arena.workspace) retired.destroy();
      }
    }
  };
  return arena;
}

function normalizedSource(entry, strideBytes, index) {
  if (!entry?.buffer) throw new TypeError(`sources[${index}].buffer is required`);
  const rowCount = u32(entry.rowCount, `sources[${index}].rowCount`);
  const offsetBytes = u32(entry.offsetBytes ?? 0, `sources[${index}].offsetBytes`);
  const requiredByteLength = rowCount * strideBytes;
  const available = Number(entry.byteLength ?? entry.buffer?.size ?? requiredByteLength);
  if (!Number.isFinite(available) || available < offsetBytes + requiredByteLength) {
    throw new RangeError(`sources[${index}] is smaller than its declared row range`);
  }
  const prefixMetadataBuffer = entry.prefixMetadataBuffer
    || entry.productEventPrefixMetadataBuffer
    || null;
  const prefixDispatchIndirectBuffer = entry.prefixDispatchIndirectBuffer
    || entry.productEventDispatchIndirectBuffer
    || null;
  if (Boolean(prefixMetadataBuffer) !== Boolean(prefixDispatchIndirectBuffer)) {
    throw new TypeError(
      `sources[${index}] exact prefix requires both metadata and indirect dispatch buffers`
    );
  }
  if (prefixMetadataBuffer
    && Number(prefixMetadataBuffer.size ?? 0) < SPH_REACTION_PRODUCT_EVENT_PREFIX_METADATA_BYTES) {
    throw new RangeError(`sources[${index}].prefixMetadataBuffer is too small`);
  }
  if (prefixDispatchIndirectBuffer
    && Number(prefixDispatchIndirectBuffer.size ?? 0) < SPH_RESIDENT_PRODUCT_EVENT_ARENA_INDIRECT_BYTES) {
    throw new RangeError(`sources[${index}].prefixDispatchIndirectBuffer is too small`);
  }
  return {
    ...entry,
    rowCount,
    offsetBytes,
    requiredByteLength,
    prefixMetadataBuffer,
    prefixDispatchIndirectBuffer,
    exactPrefix: Boolean(prefixMetadataBuffer)
  };
}

function assertSourceDevice(device, source, index) {
  if (!webGpuBufferMatchesDevice(source.buffer, device)) {
    const error = new Error(`sources[${index}].buffer device mismatch`);
    error.code = 'ULG_RESIDENT_PRODUCT_EVENT_ARENA_SOURCE_DEVICE_MISMATCH';
    throw error;
  }
  for (const [label, buffer] of [
    ['prefixMetadataBuffer', source.prefixMetadataBuffer],
    ['prefixDispatchIndirectBuffer', source.prefixDispatchIndirectBuffer]
  ]) {
    if (buffer && !webGpuBufferMatchesDevice(buffer, device)) {
      const error = new Error(`sources[${index}].${label} device mismatch`);
      error.code = 'ULG_RESIDENT_PRODUCT_EVENT_ARENA_SOURCE_DEVICE_MISMATCH';
      throw error;
    }
  }
}

function ensureWorkspace(device, arena, requiredRows) {
  if (requiredRows <= arena.workspace.sourceCapacityRows) return false;
  const reservation = reserveResidentProductEventArenaCapacity({
    requiredRowCount: requiredRows,
    currentCapacityRows: arena.workspace.sourceCapacityRows,
    maxCapacityRows: arena.maxCapacityRows
  });
  const retired = arena.workspace;
  arena.workspace = createWorkspace(device, {
    sourceCapacityRows: reservation.reservedCapacityRows,
    label: arena.label
  });
  arena.retiredWorkspaces.push(retired);
  return true;
}

function createAppendParamsData(arena, sourceRowCount, historyCopiedRows) {
  const data = new ArrayBuffer(32);
  const view = new DataView(data);
  view.setUint32(0, sourceRowCount, true);
  view.setUint32(4, arena.strideFloats / 4, true);
  view.setUint32(8, arena.capacityRows, true);
  view.setUint32(12, arena.generationId, true);
  view.setUint32(16, historyCopiedRows, true);
  view.setUint32(20, arena.workspace.sourceCapacityRows, true);
  view.setFloat32(24, 0, true);
  return data;
}

function writeAppendParams(device, arena, sourceRowCount, historyCopiedRows) {
  device.queue.writeBuffer(
    arena.paramsBuffer,
    0,
    createAppendParamsData(arena, sourceRowCount, historyCopiedRows)
  );
}

function appendBindGroup(device, arena, source, {
  paramsBuffer = arena.paramsBuffer,
  paramsOffset = 0
} = {}) {
  const cached = pipelines(device);
  return device.createBindGroup({
    label: `${arena.label}-append-group-${arena.generationId}`,
    layout: cached.bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: source.buffer,
          offset: source.offsetBytes,
          size: Math.max(arena.strideBytes, source.requiredByteLength)
        }
      },
      { binding: 1, resource: { buffer: arena.workspace.flagsBuffer } },
      { binding: 2, resource: { buffer: arena.workspace.offsetsBuffer } },
      { binding: 3, resource: { buffer: arena.buffer } },
      { binding: 4, resource: { buffer: arena.metadataBuffer } },
      { binding: 5, resource: { buffer: arena.dispatchIndirectBuffer } },
      { binding: 6, resource: { buffer: paramsBuffer, offset: paramsOffset, size: 32 } },
      {
        binding: 7,
        resource: {
          buffer: source.prefixMetadataBuffer || arena.workspace.fallbackPrefixMetadataBuffer
        }
      }
    ]
  });
}

export function prepareResidentProductEventArenaGpuEncoderSequence(device, {
  arena = null,
  strideFloats = arena?.strideFloats,
  sourceRowCount,
  appendCount,
  bucketRows = SPH_RESIDENT_PRODUCT_EVENT_ARENA_CAPACITY_BUCKET_ROWS,
  maxArenaBytes = SPH_RESIDENT_PRODUCT_EVENT_ARENA_MAX_BYTES_DEFAULT,
  maxCapacityRows = null,
  generationId = (arena?.generationId ?? 0) + 1,
  label = arena?.label || 'ulg-sph-resident-product-event-arena'
} = {}) {
  assertDevice(device);
  const stride = u32(strideFloats, 'strideFloats', { min: 20 });
  if (stride % 4 !== 0) throw new RangeError('strideFloats must be vec4-aligned');
  const rowsPerAppend = u32(sourceRowCount, 'sourceRowCount', { min: 1 });
  const plannedAppendCount = u32(appendCount, 'appendCount', { min: 1 });
  if (arena) {
    if (arena.destroyed) throw new Error('resident product-event arena is destroyed');
    if (arena.device !== device) throw new Error('resident product-event arena device mismatch');
    if (arena.strideFloats !== stride) throw new RangeError('resident product-event arena stride mismatch');
    if (arena.pendingEncoderSequenceToken) {
      const error = new Error('resident product-event arena already has an unsubmitted encoder sequence');
      error.code = 'ULG_RESIDENT_PRODUCT_EVENT_ENCODER_SEQUENCE_IN_FLIGHT';
      throw error;
    }
  }
  const strideBytes = stride * Float32Array.BYTES_PER_ELEMENT;
  const deviceMaximum = deviceCapacityLimitRows(device, strideBytes, maxArenaBytes);
  const resolvedMaximum = Math.min(
    deviceMaximum,
    maxCapacityRows == null ? deviceMaximum : u32(maxCapacityRows, 'maxCapacityRows', { min: 1 })
  );
  const priorUpperBound = u32(
    arena?.occupiedRowCountUpperBound ?? 0,
    'arena.occupiedRowCountUpperBound'
  );
  if (rowsPerAppend > resolvedMaximum) {
    const error = new RangeError(
      `resident product-event encoder sequence source requires ${rowsPerAppend} rows; maximum is ${resolvedMaximum}`
    );
    error.code = 'ULG_RESIDENT_PRODUCT_EVENT_ENCODER_SEQUENCE_CAPACITY_OVERFLOW';
    error.requiredRowCount = rowsPerAppend;
    error.maxCapacityRows = resolvedMaximum;
    throw error;
  }
  const appendCountBeforeCapacity = Math.floor(
    Math.max(0, resolvedMaximum - priorUpperBound) / rowsPerAppend
  );
  const conservativeUpperBoundSaturated = plannedAppendCount > appendCountBeforeCapacity;
  const requiredRowCount = conservativeUpperBoundSaturated
    ? resolvedMaximum
    : priorUpperBound + rowsPerAppend * plannedAppendCount;
  const reservation = reserveResidentProductEventArenaBatchCapacity({
    requiredRowCount,
    currentCapacityRows: arena?.capacityRows ?? 0,
    maxCapacityRows: resolvedMaximum
  });
  reservation.conservativeUpperBoundSaturated = conservativeUpperBoundSaturated;
  reservation.requestedAppendCount = plannedAppendCount;
  reservation.appendCountBeforeCapacity = appendCountBeforeCapacity;
  reservation.overflowAdmission = 'gpu-metadata-capacity-flag-fail-closed';
  reservation.growthPolicy = conservativeUpperBoundSaturated
    ? 'fixed-approved-capacity-with-gpu-authored-overflow-admission'
    : reservation.growthPolicy;
  const grew = !arena || reservation.growthRequired;
  const target = grew
    ? createResidentProductEventArenaGpu(device, {
        strideFloats: stride,
        capacityRows: reservation.reservedCapacityRows,
        sourceCapacityRows: rowsPerAppend,
        maxCapacityRows: resolvedMaximum,
        generationId: arena ? arena.generationId + 1 : generationId,
        label
      })
    : arena;
  // This is a host-side capacity bound only. The exact occupied/live counts
  // remain GPU-authored in metadata, but consumers that must size fixed radix
  // work should not mistake future append capacity for current occupancy.
  target.occupiedRowCountUpperBound = priorUpperBound;
  const workspaceGrew = ensureWorkspace(device, target, rowsPerAppend);
  const historyCopiedRowCount = grew && arena
    ? Math.min(arena.capacityRows, priorUpperBound)
    : 0;
  const uniformSlotStrideBytes = 256;
  const paramsSlotsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-encoder-sequence-append-params-${target.generationId}`,
    size: uniformSlotStrideBytes * plannedAppendCount,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  const sequenceToken = {};
  const leasedArenas = [...new Set([arena, target].filter(Boolean))];
  for (const leasedArena of leasedArenas) {
    if (leasedArena.pendingEncoderSequenceToken) {
      paramsSlotsBuffer.destroy?.();
      if (grew) target.destroy();
      const error = new Error(
        'resident product-event arena already has an unsubmitted encoder sequence'
      );
      error.code = 'ULG_RESIDENT_PRODUCT_EVENT_ENCODER_SEQUENCE_IN_FLIGHT';
      throw error;
    }
  }
  for (const leasedArena of leasedArenas) {
    leasedArena.pendingEncoderSequenceToken = sequenceToken;
  }
  for (let index = 0; index < plannedAppendCount; index += 1) {
    device.queue.writeBuffer(
      paramsSlotsBuffer,
      index * uniformSlotStrideBytes,
      createAppendParamsData(target, rowsPerAppend, index === 0 ? historyCopiedRowCount : 0)
    );
  }
  let encodedAppendCount = 0;
  let historyCopyEncoded = false;
  let submitted = false;
  let cancelled = false;
  let paramsReleased = false;
  const appendEvidence = [];

  const releaseParams = () => {
    if (paramsReleased) return false;
    paramsReleased = true;
    paramsSlotsBuffer.destroy?.();
    return true;
  };
  const releaseSequenceLease = () => {
    for (const leasedArena of leasedArenas) {
      if (leasedArena.pendingEncoderSequenceToken === sequenceToken) {
        leasedArena.pendingEncoderSequenceToken = null;
      }
    }
  };
  const encodeHistoryCopy = (encoder) => {
    if (historyCopyEncoded) return;
    if (!grew) {
      historyCopyEncoded = true;
      return;
    }
    if (typeof encoder.clearBuffer !== 'function') {
      throw new TypeError('resident product-event arena initialization requires clearBuffer');
    }
    encoder.clearBuffer(target.buffer);
    if (arena && historyCopiedRowCount > 0) {
      encoder.copyBufferToBuffer(
        arena.buffer,
        0,
        target.buffer,
        0,
        historyCopiedRowCount * strideBytes
      );
    }
    if (arena) {
      encoder.copyBufferToBuffer(
        arena.metadataBuffer,
        0,
        target.metadataBuffer,
        0,
        SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA_BYTES
      );
      encoder.copyBufferToBuffer(
        arena.dispatchIndirectBuffer,
        0,
        target.dispatchIndirectBuffer,
        0,
        SPH_RESIDENT_PRODUCT_EVENT_ARENA_INDIRECT_BYTES
      );
    }
    historyCopyEncoded = true;
  };

  const sequence = {
    schema: 'peercompute.ulg.sph-resident-product-event-arena-encoder-sequence.v0',
    status: 'resident-product-event-arena-encoder-sequence-ready',
    device,
    arena: target,
    retiredArena: grew ? arena : null,
    grew,
    workspaceGrew,
    reservation,
    sourceRowCount: rowsPerAppend,
    appendCount: plannedAppendCount,
    strideFloats: stride,
    strideBytes,
    historyCopiedRowCount,
    paramsSlotsBuffer,
    uniformSlotStrideBytes,
    appendEvidence,
    get encodedAppendCount() {
      return encodedAppendCount;
    },
    get occupiedRowCountUpperBound() {
      return Math.min(
        target.capacityRows,
        priorUpperBound + rowsPerAppend * encodedAppendCount
      );
    },
    encodeInitialization(commandEncoder) {
      if (submitted || cancelled) {
        throw new Error('resident product-event encoder sequence is no longer writable');
      }
      if (!commandEncoder?.copyBufferToBuffer) {
        throw new TypeError('resident product-event initialization requires a caller-owned encoder');
      }
      encodeHistoryCopy(commandEncoder);
      return {
        initialized: true,
        grew,
        historyCopiedRowCount,
        commandEncoderOwnership: 'caller',
        queueSubmitPerformed: false,
        mapPerformed: false,
        readbackPerformed: false
      };
    },
    encodeAppend(commandEncoder, {
      source,
      sourceEpoch = 0,
      sourceGeneration = encodedAppendCount + 1,
      timestampProfiler = null,
      timestampMetadata = null
    } = {}) {
      if (submitted || cancelled) {
        throw new Error('resident product-event encoder sequence is no longer writable');
      }
      if (!commandEncoder?.beginComputePass || !commandEncoder?.copyBufferToBuffer) {
        throw new TypeError('resident product-event append requires a caller-owned command encoder');
      }
      if (encodedAppendCount >= plannedAppendCount) {
        throw new RangeError('resident product-event encoder sequence append capacity exhausted');
      }
      const normalized = normalizedSource({
        ...source,
        rowCount: source?.rowCount ?? rowsPerAppend
      }, strideBytes, encodedAppendCount);
      assertSourceDevice(device, normalized, encodedAppendCount);
      if (normalized.rowCount !== rowsPerAppend) {
        throw new RangeError(
          `resident product-event encoder sequence requires fixed source row count ${rowsPerAppend}`
        );
      }
      if (normalized.buffer === target.buffer) {
        throw new RangeError('resident product-event arena cannot append itself as a source');
      }
      encodeHistoryCopy(commandEncoder);
      const bindGroup = appendBindGroup(device, target, normalized, {
        paramsBuffer: paramsSlotsBuffer,
        paramsOffset: encodedAppendCount * uniformSlotStrideBytes
      });
      const cached = pipelines(device);
      const workgroups = Math.max(1, Math.ceil(rowsPerAppend / APPEND_WORKGROUP_SIZE));
      if (normalized.exactPrefix) {
        if (typeof commandEncoder.clearBuffer !== 'function') {
          throw new TypeError('exact product-event prefix append requires clearBuffer');
        }
        commandEncoder.clearBuffer(
          target.workspace.flagsBuffer,
          0,
          rowsPerAppend * Uint32Array.BYTES_PER_ELEMENT
        );
      }
      const stageDescriptor = (stage) => timestampProfiler?.beginComputePassDescriptor
        ? timestampProfiler.beginComputePassDescriptor(`residentProductEventArena${stage}`, {
            ...(timestampMetadata || {}),
            appendIndex: encodedAppendCount,
            sourceEpoch,
            sourceGeneration
          })
        : { label: `${label}-${stage.toLowerCase()}-${encodedAppendCount}` };
      let pass = commandEncoder.beginComputePass(stageDescriptor('Mark'));
      pass.setPipeline(cached.mark);
      pass.setBindGroup(0, bindGroup);
      if (normalized.exactPrefix) {
        if (typeof pass.dispatchWorkgroupsIndirect !== 'function') {
          throw new TypeError('exact product-event prefix append requires dispatchWorkgroupsIndirect');
        }
        pass.dispatchWorkgroupsIndirect(normalized.prefixDispatchIndirectBuffer, 0);
      } else {
        pass.dispatchWorkgroups(workgroups);
      }
      pass.end();
      const scanEncoding = target.workspace.scan.encode(commandEncoder, {
        inputBuffer: target.workspace.flagsBuffer,
        outputBuffer: target.workspace.offsetsBuffer,
        elementCount: rowsPerAppend
      }, {
        timestampProfiler,
        timestampMetadata: {
          ...(timestampMetadata || {}),
          appendIndex: encodedAppendCount,
          sourceEpoch,
          sourceGeneration
        },
        labelPrefix: `${label}-append-${encodedAppendCount}`
      });
      if (scanEncoding.transientBuffers.length !== 0) {
        throw new Error('resident product-event encoder sequence requires retained scan params');
      }
      pass = commandEncoder.beginComputePass(stageDescriptor('Finalize'));
      pass.setPipeline(cached.finalize);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(1);
      pass.end();
      pass = commandEncoder.beginComputePass(stageDescriptor('Scatter'));
      pass.setPipeline(cached.scatter);
      pass.setBindGroup(0, bindGroup);
      if (normalized.exactPrefix) {
        pass.dispatchWorkgroupsIndirect(normalized.prefixDispatchIndirectBuffer, 0);
      } else {
        pass.dispatchWorkgroups(workgroups);
      }
      pass.end();
      const evidence = Object.freeze({
        appendIndex: encodedAppendCount,
        sourceEpoch: u32(sourceEpoch, 'sourceEpoch'),
        sourceGeneration: u32(sourceGeneration, 'sourceGeneration'),
        sourceRowCount: rowsPerAppend,
        exactPrefixDispatchEncoded: normalized.exactPrefix,
        exactPrefixCountAuthority: normalized.exactPrefix
          ? 'source-prefix-metadata-word-6'
          : 'host-source-row-count',
        commandEncoderOwnership: 'caller',
        queueSubmitPerformed: false,
        mapPerformed: false,
        readbackPerformed: false
      });
      appendEvidence.push(evidence);
      encodedAppendCount += 1;
      target.occupiedRowCountUpperBound = Math.min(
        target.capacityRows,
        priorUpperBound + rowsPerAppend * encodedAppendCount
      );
      sequence.status = encodedAppendCount === plannedAppendCount
        ? 'resident-product-event-arena-encoder-sequence-fully-encoded'
        : 'resident-product-event-arena-encoder-sequence-partially-encoded';
      return evidence;
    },
    markSubmitted({
      queueCompletionStatus = 'queue-submitted',
      queueCompletionMethod = 'queue.submit'
    } = {}) {
      if (cancelled || submitted) return false;
      if (encodedAppendCount !== plannedAppendCount) {
        throw new Error(
          `resident product-event encoder sequence encoded ${encodedAppendCount}/${plannedAppendCount} appends`
        );
      }
      submitted = true;
      releaseSequenceLease();
      target.appendSubmissionCount += encodedAppendCount;
      target.status = 'resident-product-event-arena-append-submitted';
      sequence.status = 'resident-product-event-arena-encoder-sequence-submitted';
      sequence.queueCompletionStatus = queueCompletionStatus;
      sequence.queueCompletionMethod = queueCompletionMethod;
      return sequence;
    },
    cancelBeforeSubmit(reason = 'resident-product-event-encoder-sequence-cancelled') {
      if (submitted || cancelled) return false;
      cancelled = true;
      sequence.status = 'resident-product-event-arena-encoder-sequence-cancelled-before-submit';
      sequence.cancelReason = reason;
      target.occupiedRowCountUpperBound = priorUpperBound;
      releaseSequenceLease();
      releaseParams();
      if (grew) target.destroy();
      return true;
    },
    releaseSubmittedWork() {
      if (!submitted) return false;
      return releaseParams();
    },
    capacityDescriptor() {
      return createResidentProductEventArenaCapacityDescriptor(target);
    },
    queueSubmitPerformed: false,
    mapPerformed: false,
    readbackPerformed: false,
    normalHotLoopReadbackFree: true,
    fullReadbackPerformed: false
  };
  return sequence;
}

function encodePass(encoder, pipeline, bindGroup, label, workgroups) {
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(workgroups);
  pass.end();
}

export function appendResidentProductEventArenaGpu(device, {
  arena = null,
  sources = [],
  strideFloats = arena?.strideFloats,
  generationId = (arena?.generationId ?? 0) + 1,
  bucketRows = SPH_RESIDENT_PRODUCT_EVENT_ARENA_CAPACITY_BUCKET_ROWS,
  maxArenaBytes = SPH_RESIDENT_PRODUCT_EVENT_ARENA_MAX_BYTES_DEFAULT,
  maxCapacityRows = null,
  label = arena?.label || 'ulg-sph-resident-product-event-arena'
} = {}) {
  assertDevice(device);
  const stride = u32(strideFloats, 'strideFloats', { min: 20 });
  if (stride % 4 !== 0) throw new RangeError('strideFloats must be vec4-aligned');
  const strideBytes = stride * Float32Array.BYTES_PER_ELEMENT;
  if (arena) {
    if (arena.destroyed) throw new Error('resident product-event arena is destroyed');
    if (arena.device !== device) throw new Error('resident product-event arena device mismatch');
    if (arena.strideFloats !== stride) throw new RangeError('resident product-event arena stride mismatch');
  }
  const normalizedSources = sources
    .map((source, index) => {
      const normalized = normalizedSource(source, strideBytes, index);
      assertSourceDevice(device, normalized, index);
      return normalized;
    })
    .filter((source) => source.rowCount > 0);
  const sourceRowCount = normalizedSources.reduce((sum, source) => sum + source.rowCount, 0);
  const largestSourceRowCount = normalizedSources.reduce(
    (largest, source) => Math.max(largest, source.rowCount),
    1
  );
  const deviceMaximum = deviceCapacityLimitRows(device, strideBytes, maxArenaBytes);
  const resolvedMaximum = Math.min(
    deviceMaximum,
    maxCapacityRows == null ? deviceMaximum : u32(maxCapacityRows, 'maxCapacityRows', { min: 1 })
  );
  if (resolvedMaximum < 1) {
    throw new RangeError('resident product-event arena has no admissible device capacity');
  }
  const priorUpperBound = Math.min(
    resolvedMaximum,
    u32(arena?.occupiedRowCountUpperBound ?? 0, 'arena.occupiedRowCountUpperBound')
  );
  const rawRequiredUpperBound = priorUpperBound + sourceRowCount;
  const saturatedUpperBound = rawRequiredUpperBound > resolvedMaximum;
  const requiredUpperBound = Math.min(resolvedMaximum, rawRequiredUpperBound);
  const capacityReservation = reserveResidentProductEventArenaCapacity({
    requiredRowCount: Math.max(1, requiredUpperBound),
    currentCapacityRows: arena?.capacityRows ?? 0,
    bucketRows,
    maxCapacityRows: resolvedMaximum
  });
  const grew = !arena || capacityReservation.growthRequired;
  const target = grew
    ? createResidentProductEventArenaGpu(device, {
        strideFloats: stride,
        capacityRows: capacityReservation.reservedCapacityRows,
        sourceCapacityRows: Math.min(
          resolvedMaximum,
          reserveResidentProductEventArenaCapacity({
            requiredRowCount: largestSourceRowCount,
            bucketRows,
            maxCapacityRows: resolvedMaximum
          }).reservedCapacityRows
        ),
        maxCapacityRows: resolvedMaximum,
        generationId: arena ? arena.generationId + 1 : generationId,
        label
      })
    : arena;
  const workspaceGrew = ensureWorkspace(device, target, largestSourceRowCount);
  if (grew && arena) target.appendSubmissionCount = arena.appendSubmissionCount;
  const historyCopiedRowCount = grew && arena
    ? Math.min(arena.capacityRows, priorUpperBound)
    : 0;
  let firstSource = true;
  let queueSubmissionCount = 0;
  for (const source of normalizedSources) {
    if (source.buffer === target.buffer) {
      throw new RangeError('resident product-event arena cannot append itself as a source');
    }
    writeAppendParams(device, target, source.rowCount, firstSource ? historyCopiedRowCount : 0);
    const encoder = device.createCommandEncoder({
      label: `${label}-compact-append-${target.generationId}-${queueSubmissionCount}`
    });
    if (firstSource && grew && arena) {
      if (historyCopiedRowCount > 0) {
        encoder.copyBufferToBuffer(
          arena.buffer,
          0,
          target.buffer,
          0,
          historyCopiedRowCount * strideBytes
        );
      }
      encoder.copyBufferToBuffer(
        arena.metadataBuffer,
        0,
        target.metadataBuffer,
        0,
        SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA_BYTES
      );
      encoder.copyBufferToBuffer(
        arena.dispatchIndirectBuffer,
        0,
        target.dispatchIndirectBuffer,
        0,
        SPH_RESIDENT_PRODUCT_EVENT_ARENA_INDIRECT_BYTES
      );
    }
    const bindGroup = appendBindGroup(device, target, source);
    const cached = pipelines(device);
    const workgroups = Math.max(1, Math.ceil(source.rowCount / APPEND_WORKGROUP_SIZE));
    if (source.exactPrefix) {
      encoder.clearBuffer(
        target.workspace.flagsBuffer,
        0,
        source.rowCount * Uint32Array.BYTES_PER_ELEMENT
      );
      let pass = encoder.beginComputePass({ label: `${label}-mark-live-source-rows` });
      pass.setPipeline(cached.mark);
      pass.setBindGroup(0, bindGroup);
      if (typeof pass.dispatchWorkgroupsIndirect !== 'function') {
        throw new TypeError('exact product-event prefix append requires dispatchWorkgroupsIndirect');
      }
      pass.dispatchWorkgroupsIndirect(source.prefixDispatchIndirectBuffer, 0);
      pass.end();
    } else {
      encodePass(
        encoder,
        cached.mark,
        bindGroup,
        `${label}-mark-live-source-rows`,
        workgroups
      );
    }
    const scanEncoding = target.workspace.scan.encode(encoder, {
      inputBuffer: target.workspace.flagsBuffer,
      outputBuffer: target.workspace.offsetsBuffer,
      elementCount: source.rowCount
    });
    if (scanEncoding.transientBuffers.length !== 0) {
      throw new Error('resident product-event arena requires retained scan parameters');
    }
    encodePass(encoder, cached.finalize, bindGroup, `${label}-finalize-append`, 1);
    if (source.exactPrefix) {
      const pass = encoder.beginComputePass({ label: `${label}-scatter-live-source-rows` });
      pass.setPipeline(cached.scatter);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroupsIndirect(source.prefixDispatchIndirectBuffer, 0);
      pass.end();
    } else {
      encodePass(encoder, cached.scatter, bindGroup, `${label}-scatter-live-source-rows`, workgroups);
    }
    device.queue.submit([encoder.finish()]);
    queueSubmissionCount += 1;
    firstSource = false;
  }
  target.occupiedRowCountUpperBound = requiredUpperBound;
  target.appendSubmissionCount += queueSubmissionCount;
  target.status = saturatedUpperBound
    ? 'resident-product-event-arena-append-submitted-capacity-saturated-gpu-fail-closed'
    : 'resident-product-event-arena-append-submitted';
  const capacityDescriptor = createResidentProductEventArenaCapacityDescriptor(target);
  return {
    schema: ULG_SPH_RESIDENT_PRODUCT_EVENT_ARENA_EXECUTION_SCHEMA,
    status: target.status,
    arena: target,
    retiredArena: grew ? arena : null,
    grew,
    reused: !grew,
    workspaceGrew,
    capacityReservation,
    capacityDescriptor,
    sourceRowCount,
    sourceBufferCount: normalizedSources.length,
    occupiedRowCount: null,
    occupiedRowCountUpperBound: requiredUpperBound,
    historyCopiedRowCount,
    historyCopyPolicy: grew
      ? 'geometric-growth-only-copy-of-prior-bounded-prefix'
      : 'no-history-copy-on-normal-append',
    perStepHistoryCopyAvoided: historyCopiedRowCount === 0,
    sourceCompactionPolicy: 'deterministic-mark-exclusive-scan-finalize-scatter-live-source-prefix',
    stableSourceOrderingPreserved: true,
    queueSubmissionCount,
    queueFenceAwaited: false,
    queueCompletionStatus: 'queue-submitted-in-order-no-host-fence',
    queueCompletionMethod: 'queue.submit',
    mapPerformed: false,
    readbackBytes: 0,
    activeEventCount: null,
    activeEventCountAuthority: 'gpu-authored-metadata-word-3',
    activeEventCountMetadataWord: SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.activeRowCount,
    indirectDispatchBuffer: target.dispatchIndirectBuffer,
    indirectDispatchCountAuthority: 'gpu-authored-from-exact-dense-live-prefix',
    normalAppendAllocationFree: !grew && !workspaceGrew,
    capacityUpperBoundSaturated: saturatedUpperBound,
    capacityPlanningLimitation:
      'host upper-bound growth is conservative and may reach the 128 MiB ceiling before GPU live occupancy does',
    overflowPolicy: 'gpu-finalize-rejects-whole-append-and-sets-capacity-overflow-bit'
  };
}

export function createResidentProductEventArenaCapacityDescriptor(arena) {
  if (arena?.schema !== ULG_SPH_RESIDENT_PRODUCT_EVENT_ARENA_SCHEMA || arena.destroyed) {
    throw new TypeError('resident product-event arena capacity descriptor requires a live arena');
  }
  return {
    schema: ULG_SPH_RESIDENT_PRODUCT_EVENT_ARENA_CAPACITY_DESCRIPTOR_SCHEMA,
    status: 'resident-product-event-arena-capacity-ready',
    occupiedRowCount: null,
    occupiedRowCountUpperBound: arena.occupiedRowCountUpperBound,
    reservedRowCapacity: arena.capacityRows,
    capacityHeadroomRows: Math.max(0, arena.capacityRows - arena.occupiedRowCountUpperBound),
    maxCapacityRows: arena.maxCapacityRows,
    strideFloats: arena.strideFloats,
    strideBytes: arena.strideBytes,
    bufferByteLength: arena.buffer?.size ?? arena.capacityRows * arena.strideBytes,
    metadataBuffer: arena.metadataBuffer,
    metadataBufferByteLength: SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA_BYTES,
    dispatchIndirectBuffer: arena.dispatchIndirectBuffer,
    dispatchIndirectByteLength: SPH_RESIDENT_PRODUCT_EVENT_ARENA_INDIRECT_BYTES,
    activeEventCount: null,
    activeEventCountAuthority: 'gpu-authored-metadata-word-3',
    activeEventCountMetadataWord: SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.activeRowCount,
    occupiedEventCountAuthority: 'gpu-authored-metadata-word-2',
    occupiedEventCountMetadataWord: SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.occupiedRowCount,
    overflowFlagsMetadataWord: SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.overflowFlags,
    exactActiveEventSemantics: 'dense-prefix-of-status-ready-positive-unplaced-mass-rows',
    consumerDispatchPolicy: 'dispatch-workgroups-indirect-from-exact-gpu-active-prefix',
    capacityPlanningLimitation:
      'host upper-bound growth is conservative and may reach the policy ceiling with sparse live events',
    failClosedBounds: true,
    sameDeviceRequired: true
  };
}

export function decodeResidentProductEventArenaMetadata(value) {
  const words = value instanceof Uint32Array
    ? value
    : ArrayBuffer.isView(value)
      ? new Uint32Array(value.buffer, value.byteOffset, Math.floor(value.byteLength / 4))
      : value instanceof ArrayBuffer
        ? new Uint32Array(value)
        : null;
  if (!words || words.length < SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA_WORDS) {
    throw new RangeError('resident product-event arena metadata requires 16 u32 words');
  }
  const at = (key) => words[SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA[key]];
  return {
    schema: 'peercompute.ulg.sph-resident-product-event-arena-metadata.v0',
    status: at('overflowFlags') === 0
      ? 'resident-product-event-arena-metadata-ready'
      : 'resident-product-event-arena-metadata-overflow-fail-closed',
    magic: at('magic'),
    version: at('version'),
    occupiedRowCount: at('occupiedRowCount'),
    activeRowCount: at('activeRowCount'),
    capacityRows: at('capacityRows'),
    appendedRowCount: at('appendedRowCount'),
    overflowFlags: at('overflowFlags'),
    generationId: at('generationId'),
    strideFloats: at('strideFloats'),
    historyCopiedRowCount: at('historyCopiedRowCount'),
    appendSubmissionCount: at('appendSubmissionCount'),
    diagnosticMapCount: at('diagnosticMapCount'),
    appendBaseRow: at('appendBaseRow'),
    sourceRowCount: at('sourceRowCount'),
    sourceCapacityRows: at('sourceCapacityRows'),
    appendAdmitted: at('appendAdmitted') === 1,
    admitted: at('magic') === METADATA_MAGIC
      && at('overflowFlags') === 0
      && at('occupiedRowCount') === at('activeRowCount')
      && at('occupiedRowCount') <= at('capacityRows'),
    exactActiveEventSemantics: 'dense-prefix-of-status-ready-positive-unplaced-mass-rows'
  };
}

export async function mapResidentProductEventArenaMetadataDiagnostic(device, arena) {
  assertDevice(device);
  if (arena?.device !== device || arena.destroyed) {
    throw new Error('resident product-event arena diagnostic device mismatch or destroyed arena');
  }
  const readbackBuffer = device.createBuffer({
    label: `${arena.label}-metadata-diagnostic-${arena.generationId}`,
    size: SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA_BYTES,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  try {
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(
      arena.metadataBuffer,
      0,
      readbackBuffer,
      0,
      SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA_BYTES
    );
    device.queue.submit([encoder.finish()]);
    await readbackBuffer.mapAsync(GPU_MAP_MODE.READ);
    const result = decodeResidentProductEventArenaMetadata(
      new Uint32Array(readbackBuffer.getMappedRange()).slice()
    );
    readbackBuffer.unmap();
    arena.diagnosticMapCount += 1;
    return {
      ...result,
      diagnosticOnly: true,
      normalHotLoopReadback: false,
      mappedByteLength: SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA_BYTES
    };
  } finally {
    readbackBuffer.destroy?.();
  }
}
