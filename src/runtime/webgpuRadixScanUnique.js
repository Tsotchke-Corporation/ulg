import {
  ULG_WEBGPU_RADIX_UNIQUE_SCHEMA,
  ULG_WEBGPU_U32_SCAN_SCHEMA,
  WEBGPU_RADIX_UNIQUE_EVIDENCE_ROW_LAYOUT,
  WEBGPU_INDIRECT_DISPATCH_ROW_LAYOUT
} from '../../ulg-gpu-abi/src/parallelPrimitives.js';

export {
  ULG_WEBGPU_RADIX_UNIQUE_SCHEMA,
  ULG_WEBGPU_U32_SCAN_SCHEMA
};

export const WEBGPU_SCAN_WORKGROUP_SIZE = 256;
export const WEBGPU_SCAN_ELEMENTS_PER_WORKGROUP = WEBGPU_SCAN_WORKGROUP_SIZE * 2;
export const WEBGPU_SCAN_FUSED_TOP_ADD_MAX_ELEMENT_COUNT = 32_768;
export const WEBGPU_RADIX_BITS_PER_PASS = 4;
export const WEBGPU_RADIX_BUCKET_COUNT = 1 << WEBGPU_RADIX_BITS_PER_PASS;
export const WEBGPU_RADIX_PASSES_PER_WORD = 32 / WEBGPU_RADIX_BITS_PER_PASS;
export const WEBGPU_RADIX_MAX_KEY_WORDS = 8;
export const WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_DEFAULT = 128;
export const WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_MAX = 1024;
export const WEBGPU_RADIX_SCATTER_WORKGROUP_STORAGE_BYTES =
  WEBGPU_SCAN_WORKGROUP_SIZE * WEBGPU_RADIX_BUCKET_COUNT * Uint32Array.BYTES_PER_ELEMENT;
export const WEBGPU_RADIX_UNIQUE_CLEARED_WORD_COUNT =
  WEBGPU_RADIX_UNIQUE_EVIDENCE_ROW_LAYOUT.length
  + WEBGPU_INDIRECT_DISPATCH_ROW_LAYOUT.length
  + 1;

const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const UNIFORM_ROW_BYTES = 256;
const WEBGPU_SCAN_RUNTIME_INTERNALS = new WeakMap();
const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

function positiveInteger(value, label, { max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new RangeError(`${label} must be an integer in [1, ${max}]`);
  }
  return number;
}

function nonNegativeInteger(value, label, { max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > max) {
    throw new RangeError(`${label} must be an integer in [0, ${max}]`);
  }
  return number;
}

function alignedBytes(byteLength, alignment = 4) {
  return Math.max(4, Math.ceil(byteLength / alignment) * alignment);
}

function uniformOffsetAlignment(device) {
  const alignment = positiveInteger(
    device?.limits?.minUniformBufferOffsetAlignment ?? UNIFORM_ROW_BYTES,
    'device.limits.minUniformBufferOffsetAlignment',
    { max: 0xffffffff }
  );
  return Math.max(UNIFORM_ROW_BYTES, alignment);
}

function signaturesMatch(left, right) {
  return left?.length === right?.length
    && left.every((value, index) => Object.is(value, right[index]));
}

function bindGroupSignature(pipeline, entries) {
  return [
    pipeline,
    ...entries.flatMap((entry) => [
      entry.binding,
      entry.resource?.buffer,
      entry.resource?.offset ?? 0,
      entry.resource?.size ?? null
    ])
  ];
}

function groupCountFor(elementCount) {
  return Math.ceil(elementCount / WEBGPU_SCAN_ELEMENTS_PER_WORKGROUP);
}

function radixGroupCountFor(elementCount) {
  return Math.ceil(elementCount / WEBGPU_SCAN_WORKGROUP_SIZE);
}

function dispatchShapeFor(groupCount, maxComputeWorkgroupsPerDimension = 65535) {
  const maxDimension = positiveInteger(
    maxComputeWorkgroupsPerDimension,
    'maxComputeWorkgroupsPerDimension',
    { max: 0xffffffff }
  );
  const x = Math.min(groupCount, maxDimension);
  const y = Math.ceil(groupCount / x);
  if (y > maxDimension) {
    throw new RangeError(
      `workgroup count ${groupCount} exceeds 2D dispatch capacity ${maxDimension}x${maxDimension}`
    );
  }
  return [x, y, 1];
}

function assertDevice(device) {
  if (!device?.createBuffer || !device?.createShaderModule
    || !device?.createComputePipeline || !device?.createBindGroup
    || !device?.queue?.writeBuffer) {
    throw new TypeError('GPU radix/scan/unique requires a WebGPU-like device');
  }
}

function createBuffer(device, label, wordCount, extraUsage = 0) {
  const resolvedWordCount = positiveInteger(wordCount, `${label} wordCount`, { max: 0xffffffff });
  const byteLength = alignedBytes(resolvedWordCount * UINT32_BYTES);
  const maxBufferSize = Number(device.limits?.maxBufferSize ?? Number.POSITIVE_INFINITY);
  const maxStorageBufferBindingSize = Number(
    device.limits?.maxStorageBufferBindingSize ?? Number.POSITIVE_INFINITY
  );
  if (byteLength > maxBufferSize) {
    throw new RangeError(`${label} byte length ${byteLength} exceeds maxBufferSize ${maxBufferSize}`);
  }
  if (byteLength > maxStorageBufferBindingSize) {
    throw new RangeError(
      `${label} byte length ${byteLength} exceeds maxStorageBufferBindingSize ${maxStorageBufferBindingSize}`
    );
  }
  return device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
      | GPU_BUFFER_USAGE.COPY_DST | extraUsage
  });
}

function profiledPassDescriptor(timestampProfiler, label, metadata = {}) {
  return timestampProfiler?.beginComputePassDescriptor
    ? timestampProfiler.beginComputePassDescriptor(label, metadata)
    : { label };
}

function timestampProfilingIsActive(timestampProfiler) {
  return Boolean(
    timestampProfiler?.beginComputePassDescriptor
      && timestampProfiler.active !== false
  );
}

export function webGpuDispatchShapeId(dispatch) {
  if (!Array.isArray(dispatch) && !ArrayBuffer.isView(dispatch)) {
    throw new TypeError('dispatch must be an array-like [x, y, z] value');
  }
  if (dispatch.length < 1 || dispatch.length > 3) {
    throw new RangeError('dispatch must contain between one and three dimensions');
  }
  const dimensions = [0, 1, 2].map((axis) => positiveInteger(
    dispatch[axis] ?? 1,
    `dispatch[${axis}]`,
    { max: 0xffff_ffff }
  ));
  return `webgpu-dispatch:${dimensions[0]}:${dimensions[1]}:${dimensions[2]}`;
}

function resolveIndirectDispatch(dispatchIndirectProvider, dispatch) {
  if (!dispatchIndirectProvider) return null;
  if (!dispatchIndirectProvider.buffer) {
    throw new TypeError('dispatchIndirectProvider.buffer is required');
  }
  if (typeof dispatchIndirectProvider.byteOffsetFor !== 'function') {
    throw new TypeError('dispatchIndirectProvider.byteOffsetFor must be a function');
  }
  const shapeId = webGpuDispatchShapeId(dispatch);
  const byteOffset = Number(dispatchIndirectProvider.byteOffsetFor(dispatch, shapeId));
  if (!Number.isInteger(byteOffset) || byteOffset < 0 || byteOffset % 4 !== 0) {
    throw new RangeError(`indirect dispatch offset for ${shapeId} must be an aligned byte offset`);
  }
  return { buffer: dispatchIndirectProvider.buffer, byteOffset, shapeId };
}

function encodeComputeDispatch(
  pass,
  pipeline,
  bindGroup,
  dispatch,
  dispatchIndirectProvider = null
) {
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  const indirect = resolveIndirectDispatch(dispatchIndirectProvider, dispatch);
  if (indirect) {
    if (typeof pass.dispatchWorkgroupsIndirect !== 'function') {
      throw new TypeError('indirect dispatch provider requires dispatchWorkgroupsIndirect support');
    }
    pass.dispatchWorkgroupsIndirect(indirect.buffer, indirect.byteOffset);
  } else {
    pass.dispatchWorkgroups(...dispatch);
  }
}

function encodeProfiledComputeDispatch(
  encoder,
  timestampProfiler,
  label,
  metadata,
  pipeline,
  bindGroup,
  dispatch,
  dispatchIndirectProvider = null
) {
  const pass = encoder.beginComputePass(profiledPassDescriptor(
    timestampProfiler,
    label,
    metadata
  ));
  encodeComputeDispatch(
    pass,
    pipeline,
    bindGroup,
    dispatch,
    dispatchIndirectProvider
  );
  pass.end();
}

export const webGpuU32ExclusiveScanWgsl = /* wgsl */ `
struct ScanParams {
  element_count: u32,
  dispatch_x: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<storage, read_write> scan_values_a: array<u32>;
@group(0) @binding(1) var<storage, read_write> scan_values_b: array<u32>;
@group(0) @binding(2) var<storage, read_write> scan_values_aux: array<u32>;
@group(0) @binding(3) var<uniform> scan_params: ScanParams;
@group(0) @binding(4) var<storage, read_write> scan_fused_lower_values: array<u32>;
@group(0) @binding(5) var<uniform> scan_fused_lower_params: ScanParams;

var<workgroup> scan_values: array<u32, 512>;

@compute @workgroup_size(256)
fn scan_blocks(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * scan_params.dispatch_x;
  let scan_group_count = (scan_params.element_count + 511u) / 512u;
  let group_valid = linear_group < scan_group_count;
  let block_base = linear_group * 512u;
  let first = block_base + local_id.x * 2u;
  let second = first + 1u;
  var first_value = 0u;
  var second_value = 0u;
  if (group_valid && first < scan_params.element_count) {
    first_value = scan_values_a[first];
  }
  if (group_valid && second < scan_params.element_count) {
    second_value = scan_values_a[second];
  }
  scan_values[local_id.x * 2u] = first_value;
  scan_values[local_id.x * 2u + 1u] = second_value;

  var offset = 1u;
  for (var width = 256u; width > 0u; width = width >> 1u) {
    workgroupBarrier();
    if (local_id.x < width) {
      let left = offset * (2u * local_id.x + 1u) - 1u;
      let right = offset * (2u * local_id.x + 2u) - 1u;
      scan_values[right] = scan_values[right] + scan_values[left];
    }
    offset = offset << 1u;
  }

  if (group_valid && local_id.x == 0u) {
    scan_values_aux[linear_group] = scan_values[511u];
    scan_values[511u] = 0u;
  }

  for (var width = 1u; width < 512u; width = width << 1u) {
    offset = offset >> 1u;
    workgroupBarrier();
    if (local_id.x < width) {
      let left = offset * (2u * local_id.x + 1u) - 1u;
      let right = offset * (2u * local_id.x + 2u) - 1u;
      let prior = scan_values[left];
      scan_values[left] = scan_values[right];
      scan_values[right] = scan_values[right] + prior;
    }
  }

  workgroupBarrier();
  if (group_valid && first < scan_params.element_count) {
    scan_values_b[first] = scan_values[local_id.x * 2u];
  }
  if (group_valid && second < scan_params.element_count) {
    scan_values_b[second] = scan_values[local_id.x * 2u + 1u];
  }
}

@compute @workgroup_size(256)
fn add_scanned_block_offsets(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * scan_params.dispatch_x;
  let local_index = global_id.x - workgroup_id.x * 256u;
  let first = linear_group * 512u + local_index * 2u;
  let second = first + 1u;
  if (first >= scan_params.element_count) {
    return;
  }
  let offset = scan_values_b[linear_group];
  if (first < scan_params.element_count) {
    scan_values_a[first] = scan_values_a[first] + offset;
  }
  if (second < scan_params.element_count) {
    scan_values_a[second] = scan_values_a[second] + offset;
  }
}

// The final hierarchy level always has exactly one workgroup. For bounded
// lower levels that workgroup can apply its freshly scanned block offsets
// before it exits, preserving the parallel lower scan while removing one
// otherwise separate dispatch boundary.
@compute @workgroup_size(256)
fn scan_top_and_add_lower(
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let first = local_id.x * 2u;
  let second = first + 1u;
  var first_value = 0u;
  var second_value = 0u;
  if (first < scan_params.element_count) {
    first_value = scan_values_a[first];
  }
  if (second < scan_params.element_count) {
    second_value = scan_values_a[second];
  }
  scan_values[first] = first_value;
  scan_values[second] = second_value;

  var offset = 1u;
  for (var width = 256u; width > 0u; width = width >> 1u) {
    workgroupBarrier();
    if (local_id.x < width) {
      let left = offset * (2u * local_id.x + 1u) - 1u;
      let right = offset * (2u * local_id.x + 2u) - 1u;
      scan_values[right] = scan_values[right] + scan_values[left];
    }
    offset = offset << 1u;
  }

  if (local_id.x == 0u) {
    scan_values_aux[0] = scan_values[511u];
    scan_values[511u] = 0u;
  }

  for (var width = 1u; width < 512u; width = width << 1u) {
    offset = offset >> 1u;
    workgroupBarrier();
    if (local_id.x < width) {
      let left = offset * (2u * local_id.x + 1u) - 1u;
      let right = offset * (2u * local_id.x + 2u) - 1u;
      let prior = scan_values[left];
      scan_values[left] = scan_values[right];
      scan_values[right] = scan_values[right] + prior;
    }
  }

  workgroupBarrier();
  if (first < scan_params.element_count) {
    scan_values_b[first] = scan_values[first];
  }
  if (second < scan_params.element_count) {
    scan_values_b[second] = scan_values[second];
  }

  for (var lower_index = local_id.x;
    lower_index < scan_fused_lower_params.element_count;
    lower_index = lower_index + 256u) {
    let block_index = lower_index / 512u;
    scan_fused_lower_values[lower_index] = scan_fused_lower_values[lower_index]
      + scan_values[block_index];
  }
}
`;

export const webGpuStableRadixWgsl = /* wgsl */ `
struct RadixParams {
  element_count: u32,
  workgroup_count: u32,
  key_stride_words: u32,
  key_word_index: u32,
  bit_offset: u32,
  key_word_count: u32,
  generation_id: u32,
  dispatch_x: u32,
};

@group(0) @binding(0) var<storage, read> radix_keys: array<u32>;
@group(0) @binding(1) var<storage, read> radix_indices_in: array<u32>;
@group(0) @binding(2) var<storage, read_write> radix_indices_out: array<u32>;
@group(0) @binding(3) var<storage, read_write> radix_histograms: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read> radix_histogram_offsets: array<u32>;
@group(0) @binding(5) var<uniform> radix_params: RadixParams;

var<workgroup> local_histogram: array<atomic<u32>, 16>;
// Scatter uses four vec4 rows per invocation for a 16-lane one-hot prefix.
// Its per-entrypoint allocation is exactly 16 KiB; histogram's disjoint
// entrypoint uses local_histogram instead, so the two allocations are not summed.
var<workgroup> digit_prefix: array<vec4<u32>, 1024>;

fn record_digit(record_index: u32) -> u32 {
  let key_index = record_index * radix_params.key_stride_words + radix_params.key_word_index;
  return (radix_keys[key_index] >> radix_params.bit_offset) & 15u;
}

@compute @workgroup_size(256)
fn initialize_indices(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * radix_params.dispatch_x;
  let index = linear_group * 256u + local_id.x;
  if (linear_group < radix_params.workgroup_count && index < radix_params.element_count) {
    radix_indices_out[index] = index;
  }
}

@compute @workgroup_size(256)
fn histogram(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (local_id.x < 16u) {
    atomicStore(&local_histogram[local_id.x], 0u);
  }
  workgroupBarrier();
  let linear_group = workgroup_id.x + workgroup_id.y * radix_params.dispatch_x;
  let index = linear_group * 256u + local_id.x;
  let group_valid = linear_group < radix_params.workgroup_count;
  if (group_valid && index < radix_params.element_count) {
    let record_index = radix_indices_in[index];
    atomicAdd(&local_histogram[record_digit(record_index)], 1u);
  }
  workgroupBarrier();
  if (group_valid && local_id.x < 16u) {
    let destination = local_id.x * radix_params.workgroup_count + linear_group;
    atomicStore(&radix_histograms[destination], atomicLoad(&local_histogram[local_id.x]));
  }
}

fn one_hot_quad(digit: u32, quad: u32) -> vec4<u32> {
  var row = vec4<u32>(0u);
  if (digit / 4u == quad) {
    row[digit & 3u] = 1u;
  }
  return row;
}

@compute @workgroup_size(256)
fn scatter(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * radix_params.dispatch_x;
  let index = linear_group * 256u + local_id.x;
  let valid = linear_group < radix_params.workgroup_count
    && index < radix_params.element_count;
  var record_index = 0u;
  var digit = 0u;
  if (valid) {
    record_index = radix_indices_in[index];
    digit = record_digit(record_index);
  }
  let prefix_base = local_id.x * 4u;
  for (var quad = 0u; quad < 4u; quad = quad + 1u) {
    digit_prefix[prefix_base + quad] = select(vec4<u32>(0u), one_hot_quad(digit, quad), valid);
  }
  workgroupBarrier();

  for (var offset = 1u; offset < 256u; offset = offset << 1u) {
    var add0 = vec4<u32>(0u);
    var add1 = vec4<u32>(0u);
    var add2 = vec4<u32>(0u);
    var add3 = vec4<u32>(0u);
    if (local_id.x >= offset) {
      let prior_base = (local_id.x - offset) * 4u;
      add0 = digit_prefix[prior_base];
      add1 = digit_prefix[prior_base + 1u];
      add2 = digit_prefix[prior_base + 2u];
      add3 = digit_prefix[prior_base + 3u];
    }
    workgroupBarrier();
    digit_prefix[prefix_base] = digit_prefix[prefix_base] + add0;
    digit_prefix[prefix_base + 1u] = digit_prefix[prefix_base + 1u] + add1;
    digit_prefix[prefix_base + 2u] = digit_prefix[prefix_base + 2u] + add2;
    digit_prefix[prefix_base + 3u] = digit_prefix[prefix_base + 3u] + add3;
    workgroupBarrier();
  }

  if (valid) {
    let inclusive_rank = digit_prefix[prefix_base + digit / 4u][digit & 3u];
    let group_base = radix_histogram_offsets[
      digit * radix_params.workgroup_count + linear_group
    ];
    radix_indices_out[group_base + inclusive_rank - 1u] = record_index;
  }
}
`;

export const webGpuSortedUniqueWgsl = /* wgsl */ `
struct UniqueParams {
  element_count: u32,
  key_stride_words: u32,
  key_word_count: u32,
  generation_id: u32,
  consumer_workgroup_size: u32,
  dispatch_x: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<storage, read> unique_source_keys: array<u32>;
@group(0) @binding(1) var<storage, read> unique_sorted_indices: array<u32>;
@group(0) @binding(2) var<storage, read_write> unique_head_flags: array<u32>;
@group(0) @binding(3) var<storage, read> unique_head_offsets: array<u32>;
@group(0) @binding(4) var<storage, read_write> unique_output_keys: array<u32>;
@group(0) @binding(5) var<storage, read_write> unique_output_offsets: array<u32>;
@group(0) @binding(6) var<storage, read_write> unique_evidence: array<u32>;
@group(0) @binding(7) var<storage, read_write> unique_dispatch: array<u32>;
@group(0) @binding(8) var<uniform> unique_params: UniqueParams;

fn keys_equal(left_record: u32, right_record: u32) -> bool {
  let left_base = left_record * unique_params.key_stride_words;
  let right_base = right_record * unique_params.key_stride_words;
  for (var word = 0u; word < unique_params.key_word_count; word = word + 1u) {
    if (unique_source_keys[left_base + word] != unique_source_keys[right_base + word]) {
      return false;
    }
  }
  return true;
}

@compute @workgroup_size(256)
fn mark_heads(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * unique_params.dispatch_x;
  let index = linear_group * 256u + local_id.x;
  if (index >= unique_params.element_count) {
    return;
  }
  if (index == 0u) {
    unique_head_flags[index] = 1u;
    return;
  }
  let current = unique_sorted_indices[index];
  let previous = unique_sorted_indices[index - 1u];
  unique_head_flags[index] = select(1u, 0u, keys_equal(current, previous));
}

@compute @workgroup_size(256)
fn scatter_unique(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * unique_params.dispatch_x;
  let sorted_position = linear_group * 256u + local_id.x;
  if (sorted_position >= unique_params.element_count
    || unique_head_flags[sorted_position] == 0u) {
    return;
  }
  let unique_index = unique_head_offsets[sorted_position];
  let source_record = unique_sorted_indices[sorted_position];
  let source_base = source_record * unique_params.key_stride_words;
  let output_base = unique_index * unique_params.key_word_count;
  for (var word = 0u; word < unique_params.key_word_count; word = word + 1u) {
    unique_output_keys[output_base + word] = unique_source_keys[source_base + word];
  }
  unique_output_offsets[unique_index] = sorted_position;
}

@compute @workgroup_size(1)
fn finalize_unique() {
  var unique_count = 0u;
  if (unique_params.element_count > 0u) {
    let last = unique_params.element_count - 1u;
    unique_count = unique_head_offsets[last] + unique_head_flags[last];
  }
  unique_output_offsets[unique_count] = unique_params.element_count;
  unique_evidence[0] = unique_params.generation_id;
  unique_evidence[1] = unique_params.element_count;
  unique_evidence[2] = unique_count;
  unique_evidence[3] = 1u;
  unique_evidence[4] = 0u;
  unique_evidence[5] = unique_params.key_word_count;
  unique_evidence[6] = unique_params.key_stride_words;
  unique_evidence[7] = 1u;
  unique_dispatch[0] = (unique_count + unique_params.consumer_workgroup_size - 1u)
    / unique_params.consumer_workgroup_size;
  unique_dispatch[1] = 1u;
  unique_dispatch[2] = 1u;
}
`;

export function createWebGpuU32ScanPlan({
  elementCount,
  maxComputeWorkgroupsPerDimension = 65535
} = {}) {
  const resolvedElementCount = positiveInteger(elementCount, 'elementCount', { max: 0xffffffff });
  const levels = [];
  let count = resolvedElementCount;
  while (true) {
    const groupCount = groupCountFor(count);
    levels.push({
      level: levels.length,
      elementCount: count,
      groupCount,
      dispatch: dispatchShapeFor(groupCount, maxComputeWorkgroupsPerDimension),
      blockSumsByteLength: alignedBytes(groupCount * UINT32_BYTES),
      blockOffsetsByteLength: groupCount > 1 ? alignedBytes(groupCount * UINT32_BYTES) : 0
    });
    if (groupCount <= 1) break;
    count = groupCount;
  }
  return {
    schema: ULG_WEBGPU_U32_SCAN_SCHEMA,
    status: 'webgpu-u32-exclusive-scan-plan-ready',
    elementCount: resolvedElementCount,
    workgroupSize: WEBGPU_SCAN_WORKGROUP_SIZE,
    elementsPerWorkgroup: WEBGPU_SCAN_ELEMENTS_PER_WORKGROUP,
    maxComputeWorkgroupsPerDimension,
    levelCount: levels.length,
    levels,
    scratchByteLength: levels.reduce(
      (sum, level) => sum + level.blockSumsByteLength + level.blockOffsetsByteLength,
      0
    ),
    readbackRequired: false
  };
}

export function webGpuU32ScanFusedTopLevelIndex(plan) {
  if (!plan?.levels || plan.levels.length < 2) return null;
  const lowerLevel = plan.levels[plan.levels.length - 2];
  return lowerLevel.elementCount <= WEBGPU_SCAN_FUSED_TOP_ADD_MAX_ELEMENT_COUNT
    ? plan.levels.length - 1
    : null;
}

export function webGpuU32ScanEncodedDispatchCount(plan) {
  if (!plan?.levels || plan.levels.length < 1) {
    throw new TypeError('scan plan with at least one level is required');
  }
  return plan.levels.length * 2 - 1
    - (webGpuU32ScanFusedTopLevelIndex(plan) === null ? 0 : 1);
}

export function createWebGpuRadixUniquePlan({
  elementCount,
  keyWordCount,
  keyStrideWords = keyWordCount,
  maxComputeWorkgroupsPerDimension = 65535
} = {}) {
  const resolvedElementCount = positiveInteger(elementCount, 'elementCount', { max: 0xffffffff });
  const resolvedKeyWordCount = positiveInteger(keyWordCount, 'keyWordCount', {
    max: WEBGPU_RADIX_MAX_KEY_WORDS
  });
  const resolvedKeyStrideWords = positiveInteger(keyStrideWords, 'keyStrideWords', {
    max: 0xffff
  });
  if (resolvedKeyStrideWords < resolvedKeyWordCount) {
    throw new RangeError('keyStrideWords must be greater than or equal to keyWordCount');
  }
  const workgroupCount = radixGroupCountFor(resolvedElementCount);
  const histogramElementCount = workgroupCount * WEBGPU_RADIX_BUCKET_COUNT;
  const passCount = resolvedKeyWordCount * WEBGPU_RADIX_PASSES_PER_WORD;
  return {
    schema: ULG_WEBGPU_RADIX_UNIQUE_SCHEMA,
    status: 'webgpu-stable-multiword-radix-unique-plan-ready',
    elementCount: resolvedElementCount,
    keyWordCount: resolvedKeyWordCount,
    keyStrideWords: resolvedKeyStrideWords,
    workgroupSize: WEBGPU_SCAN_WORKGROUP_SIZE,
    workgroupCount,
    workgroupDispatch: dispatchShapeFor(workgroupCount, maxComputeWorkgroupsPerDimension),
    radixBitsPerPass: WEBGPU_RADIX_BITS_PER_PASS,
    bucketCount: WEBGPU_RADIX_BUCKET_COUNT,
    passesPerWord: WEBGPU_RADIX_PASSES_PER_WORD,
    passCount,
    histogramElementCount,
    histogramScanPlan: createWebGpuU32ScanPlan({
      elementCount: histogramElementCount,
      maxComputeWorkgroupsPerDimension
    }),
    headScanPlan: createWebGpuU32ScanPlan({
      elementCount: resolvedElementCount,
      maxComputeWorkgroupsPerDimension
    }),
    sortedIndexByteLength: alignedBytes(resolvedElementCount * UINT32_BYTES),
    histogramByteLength: alignedBytes(histogramElementCount * UINT32_BYTES),
    headByteLength: alignedBytes(resolvedElementCount * UINT32_BYTES),
    uniqueKeyByteLength: alignedBytes(
      resolvedElementCount * resolvedKeyWordCount * UINT32_BYTES
    ),
    uniqueOffsetByteLength: alignedBytes((resolvedElementCount + 1) * UINT32_BYTES),
    evidenceByteLength: WEBGPU_RADIX_UNIQUE_EVIDENCE_ROW_LAYOUT.length * UINT32_BYTES,
    indirectDispatchByteLength: WEBGPU_INDIRECT_DISPATCH_ROW_LAYOUT.length * UINT32_BYTES,
    stable: true,
    lexicographicWordOrder: 'most-significant-key-word-first',
    implementationOrder: 'least-significant-digit-and-key-word-first',
    recordsMoved: false,
    readbackRequired: false
  };
}

function createScanPipelines(device, label) {
  const module = device.createShaderModule({
    label: `${label}-shader`,
    code: webGpuU32ExclusiveScanWgsl
  });
  return {
    scan: device.createComputePipeline({
      label: `${label}-blocks`,
      layout: 'auto',
      compute: { module, entryPoint: 'scan_blocks' }
    }),
    add: device.createComputePipeline({
      label: `${label}-add-block-offsets`,
      layout: 'auto',
      compute: { module, entryPoint: 'add_scanned_block_offsets' }
    }),
    fusedTopAdd: device.createComputePipeline({
      label: `${label}-fused-top-add`,
      layout: 'auto',
      compute: { module, entryPoint: 'scan_top_and_add_lower' }
    })
  };
}

export function createWebGpuU32ExclusiveScan(device, {
  maxElementCount,
  label = 'ulg-webgpu-u32-scan',
  maxComputeWorkgroupsPerDimension: requestedMaxComputeWorkgroupsPerDimension = null,
  retainParamsBuffer = false,
  fixedElementCount = null,
  retainedParamsSlotCount = 1
} = {}) {
  assertDevice(device);
  const resolvedMaxElementCount = positiveInteger(maxElementCount, 'maxElementCount', {
    max: 0xffffffff
  });
  const deviceMaxComputeWorkgroupsPerDimension = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'device.limits.maxComputeWorkgroupsPerDimension',
    { max: 0xffffffff }
  );
  const maxComputeWorkgroupsPerDimension = requestedMaxComputeWorkgroupsPerDimension == null
    ? deviceMaxComputeWorkgroupsPerDimension
    : Math.min(
      deviceMaxComputeWorkgroupsPerDimension,
      positiveInteger(
        requestedMaxComputeWorkgroupsPerDimension,
        'maxComputeWorkgroupsPerDimension',
        { max: 0xffffffff }
      )
    );
  const maxPlan = createWebGpuU32ScanPlan({
    elementCount: resolvedMaxElementCount,
    maxComputeWorkgroupsPerDimension
  });
  const resolvedFixedElementCount = retainParamsBuffer && fixedElementCount != null
    ? positiveInteger(
        fixedElementCount,
        'fixedElementCount',
        { max: resolvedMaxElementCount }
      )
    : null;
  const retainedParamsPlan = resolvedFixedElementCount === null
    ? maxPlan
    : createWebGpuU32ScanPlan({
        elementCount: resolvedFixedElementCount,
        maxComputeWorkgroupsPerDimension
      });
  const resolvedRetainedParamsSlotCount = retainParamsBuffer
    ? positiveInteger(retainedParamsSlotCount, 'retainedParamsSlotCount', {
        max: WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_MAX
      })
    : 0;
  const retainedParamsSlotStrideBytes = retainedParamsPlan.levelCount * UNIFORM_ROW_BYTES;
  const pipelines = createScanPipelines(device, label);
  const persistentParamsBuffer = retainParamsBuffer
    ? device.createBuffer({
        label: `${label}-params-retained`,
        size: retainedParamsSlotStrideBytes * resolvedRetainedParamsSlotCount,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      })
    : null;
  const blockSums = maxPlan.levels.map((level) => createBuffer(
    device,
    `${label}-level-${level.level}-block-sums`,
    level.groupCount
  ));
  const blockOffsets = maxPlan.levels.map((level) => level.groupCount > 1
    ? createBuffer(device, `${label}-level-${level.level}-block-offsets`, level.groupCount)
    : null);
  const transients = new Set();
  const retainedPreparedScans = persistentParamsBuffer ? new WeakMap() : null;
  const retainedParamsLastCount = Array.from(
    { length: resolvedRetainedParamsSlotCount },
    () => null
  );
  const retainedVariableParamsLeaseOwner = {};
  const retainedVariableParamsLeaseByPrepared = new WeakMap();
  const retainedVariableParamsSlots = persistentParamsBuffer
    && resolvedFixedElementCount === null
    ? Array.from(
        { length: resolvedRetainedParamsSlotCount },
        (_, slotIndex) => ({ slotIndex, inUse: false })
      )
    : null;
  let destroyed = false;

  function retainedVariableParamsSlotError(slotIndex) {
    const error = new Error(`${label} retained variable params slot ${slotIndex} is in use`);
    error.code = 'ERR_WEBGPU_SCAN_PARAMS_SLOT_IN_USE';
    error.slotIndex = slotIndex;
    error.slotCapacity = resolvedRetainedParamsSlotCount;
    return error;
  }

  function assertRetainedVariableParamsSlotAvailable(slotIndex) {
    if (retainedVariableParamsSlots?.[slotIndex]?.inUse) {
      throw retainedVariableParamsSlotError(slotIndex);
    }
  }

  function acquireRetainedVariableParamsSlot(slotIndex) {
    if (!retainedVariableParamsSlots) return null;
    assertRetainedVariableParamsSlotAvailable(slotIndex);
    const slot = retainedVariableParamsSlots[slotIndex];
    slot.inUse = true;
    let released = false;
    return {
      owner: retainedVariableParamsLeaseOwner,
      slotIndex,
      release() {
        if (released) return false;
        released = true;
        slot.inUse = false;
        return true;
      }
    };
  }

  function releasePreparedLease(value) {
    const lease = value && typeof value === 'object'
      ? retainedVariableParamsLeaseByPrepared.get(value) ?? null
      : null;
    if (lease?.owner !== retainedVariableParamsLeaseOwner) return false;
    const released = lease.release();
    if (released) retainedVariableParamsLeaseByPrepared.delete(value);
    return released;
  }

  function releasePrepared(value, { discardedEncoder = false } = {}) {
    const lease = value && typeof value === 'object'
      ? retainedVariableParamsLeaseByPrepared.get(value) ?? null
      : null;
    if (lease?.owner !== retainedVariableParamsLeaseOwner) return false;
    if (discardedEncoder !== true) {
      throw new TypeError(
        `${label} releasePrepared requires { discardedEncoder: true }; `
        + 'use releasePreparedAfter with a submission-fence thenable after submission'
      );
    }
    return releasePreparedLease(value);
  }

  function releasePreparedAfter(value, submissionFence) {
    if (!submissionFence?.then) {
      throw new TypeError('submissionFence must be a thenable that resolves after GPU completion');
    }
    return Promise.resolve(submissionFence).then(() => releasePreparedLease(value));
  }

  function releasePreparedResources(value, options = {}) {
    const lease = value && typeof value === 'object'
      ? retainedVariableParamsLeaseByPrepared.get(value) ?? null
      : null;
    if (lease?.owner === retainedVariableParamsLeaseOwner && options.discardedEncoder !== true) {
      throw new TypeError(
        `${label} retained variable params require { discardedEncoder: true }; `
        + 'use releasePreparedAfter with a submission-fence thenable after submission'
      );
    }
    for (const buffer of value?.transientBuffers || []) {
      if (!transients.has(buffer)) continue;
      transients.delete(buffer);
      buffer.destroy?.();
    }
    return releasePreparedLease(value);
  }

  function prepare({
    inputBuffer,
    outputBuffer,
    elementCount,
    retainedParamsSlotIndex = 0
  }) {
    if (destroyed) throw new Error(`${label} is destroyed`);
    if (!inputBuffer || !outputBuffer) {
      throw new TypeError('exclusive scan requires inputBuffer and outputBuffer');
    }
    const resolvedCount = positiveInteger(elementCount, 'elementCount', {
      max: resolvedMaxElementCount
    });
    if (resolvedFixedElementCount !== null && resolvedCount !== resolvedFixedElementCount) {
      throw new RangeError(
        `${label} retained scan params require fixed elementCount ${resolvedFixedElementCount}`
      );
    }
    const resolvedSlotIndex = persistentParamsBuffer
      ? nonNegativeInteger(retainedParamsSlotIndex, 'retainedParamsSlotIndex', {
          max: resolvedRetainedParamsSlotCount - 1
        })
      : 0;
    assertRetainedVariableParamsSlotAvailable(resolvedSlotIndex);
    const plan = resolvedFixedElementCount === null
      ? createWebGpuU32ScanPlan({
          elementCount: resolvedCount,
          maxComputeWorkgroupsPerDimension
        })
      : retainedParamsPlan;
    const paramsBaseOffset = persistentParamsBuffer
      ? resolvedSlotIndex * retainedParamsSlotStrideBytes
      : 0;
    const fusedTopLevelIndex = webGpuU32ScanFusedTopLevelIndex(plan);
    const topologyKey = `${plan.levelCount}:${fusedTopLevelIndex ?? 'none'}`;
    const cachedTopology = retainedPreparedScans
      ?.get(inputBuffer)
      ?.get(outputBuffer)
      ?.[resolvedSlotIndex] ?? null;
    const preparedScanCacheHit = cachedTopology?.topologyKey === topologyKey;
    const paramsBuffer = persistentParamsBuffer || device.createBuffer({
      label: `${label}-params-${resolvedCount}`,
      size: plan.levelCount * UNIFORM_ROW_BYTES,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    const paramsData = new Uint32Array((plan.levelCount * UNIFORM_ROW_BYTES) / UINT32_BYTES);
    for (const level of plan.levels) {
      paramsData[(level.level * UNIFORM_ROW_BYTES) / UINT32_BYTES] = level.elementCount;
      paramsData[(level.level * UNIFORM_ROW_BYTES) / UINT32_BYTES + 1] = level.dispatch[0];
    }
    const paramsWritePerformed = !persistentParamsBuffer
      || retainedParamsLastCount[resolvedSlotIndex] !== resolvedCount;
    if (!persistentParamsBuffer) transients.add(paramsBuffer);

    const levels = [];
    let levelInput = inputBuffer;
    let levelOutput = outputBuffer;
    for (const level of plan.levels) {
      const scanBindGroup = level.level === fusedTopLevelIndex
        ? null
        : preparedScanCacheHit
          ? cachedTopology.levels[level.level].scanBindGroup
          : device.createBindGroup({
            label: `${label}-scan-level-${level.level}`,
            layout: pipelines.scan.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: { buffer: levelInput } },
              { binding: 1, resource: { buffer: levelOutput } },
              { binding: 2, resource: { buffer: blockSums[level.level] } },
              {
                binding: 3,
                resource: {
                  buffer: paramsBuffer,
                  offset: paramsBaseOffset + level.level * UNIFORM_ROW_BYTES,
                  size: 16
                }
              }
            ]
          });
      levels.push({ ...level, inputBuffer: levelInput, outputBuffer: levelOutput, scanBindGroup });
      if (level.groupCount > 1) {
        levelInput = blockSums[level.level];
        levelOutput = blockOffsets[level.level];
      }
    }
    for (let levelIndex = levels.length - 2; levelIndex >= 0; levelIndex -= 1) {
      const level = levels[levelIndex];
      if (levelIndex === fusedTopLevelIndex - 1) continue;
      level.addBindGroup = preparedScanCacheHit
        ? cachedTopology.levels[level.level].addBindGroup
        : device.createBindGroup({
            label: `${label}-add-level-${level.level}`,
            layout: pipelines.add.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: { buffer: level.outputBuffer } },
              { binding: 1, resource: { buffer: blockOffsets[level.level] } },
              {
                binding: 3,
                resource: {
                  buffer: paramsBuffer,
                  offset: paramsBaseOffset + level.level * UNIFORM_ROW_BYTES,
                  size: 16
                }
              }
            ]
          });
    }
    if (fusedTopLevelIndex !== null) {
      const topLevel = levels[fusedTopLevelIndex];
      const lowerLevel = levels[fusedTopLevelIndex - 1];
      topLevel.fusedTopAddBindGroup = preparedScanCacheHit
        ? cachedTopology.levels[topLevel.level].fusedTopAddBindGroup
        : device.createBindGroup({
            label: `${label}-fused-top-${topLevel.level}-add-${lowerLevel.level}`,
            layout: pipelines.fusedTopAdd.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: { buffer: topLevel.inputBuffer } },
              { binding: 1, resource: { buffer: topLevel.outputBuffer } },
              { binding: 2, resource: { buffer: blockSums[topLevel.level] } },
              {
                binding: 3,
                resource: {
                  buffer: paramsBuffer,
                  offset: paramsBaseOffset + topLevel.level * UNIFORM_ROW_BYTES,
                  size: 16
                }
              },
              { binding: 4, resource: { buffer: lowerLevel.outputBuffer } },
              {
                binding: 5,
                resource: {
                  buffer: paramsBuffer,
                  offset: paramsBaseOffset + lowerLevel.level * UNIFORM_ROW_BYTES,
                  size: 16
                }
              }
            ]
          });
    }
    const encodedDispatchCount = webGpuU32ScanEncodedDispatchCount(plan);
    const retainedVariableParamsSlotLease = acquireRetainedVariableParamsSlot(resolvedSlotIndex);
    try {
      if (paramsWritePerformed) {
        device.queue.writeBuffer(paramsBuffer, paramsBaseOffset, paramsData);
        if (persistentParamsBuffer) retainedParamsLastCount[resolvedSlotIndex] = resolvedCount;
      }
      const prepared = {
        plan,
        paramsBuffer,
        paramsData,
        paramsBaseOffset,
        retainedParamsSlotIndex: persistentParamsBuffer ? resolvedSlotIndex : null,
        levels,
        fusedTopLevelIndex,
        fusedTopAddEnabled: fusedTopLevelIndex !== null,
        encodedDispatchCount,
        bindGroupCreationCount: preparedScanCacheHit ? 0 : encodedDispatchCount,
        paramsWritePerformed,
        paramsWriteCount: paramsWritePerformed ? 1 : 0,
        preparedScanCacheHit,
        transientBuffers: persistentParamsBuffer ? [] : [paramsBuffer],
        paramsBufferResidency: persistentParamsBuffer ? 'retained-reused' : 'transient-per-encode'
      };
      if (retainedVariableParamsSlotLease) {
        retainedVariableParamsLeaseByPrepared.set(prepared, retainedVariableParamsSlotLease);
      }
      if (retainedPreparedScans && !preparedScanCacheHit) {
        let byOutput = retainedPreparedScans.get(inputBuffer);
        if (!byOutput) {
          byOutput = new WeakMap();
          retainedPreparedScans.set(inputBuffer, byOutput);
        }
        let bySlot = byOutput.get(outputBuffer);
        if (!bySlot) {
          bySlot = Array.from({ length: resolvedRetainedParamsSlotCount }, () => null);
          byOutput.set(outputBuffer, bySlot);
        }
        bySlot[resolvedSlotIndex] = {
          topologyKey,
          levels: levels.map(({ scanBindGroup, addBindGroup, fusedTopAddBindGroup }) => ({
            scanBindGroup,
            addBindGroup,
            fusedTopAddBindGroup
          }))
        };
      }
      return prepared;
    } catch (error) {
      retainedVariableParamsSlotLease?.release();
      throw error;
    }
  }

  function encodePrepared(encoder, prepared, {
    timestampProfiler = null,
    timestampMetadata = {},
    labelPrefix = label,
    computePass = null,
    dispatchIndirectProvider = null
  } = {}) {
    if (!encoder?.beginComputePass) {
      throw new TypeError('exclusive scan encoding requires a GPUCommandEncoder-like object');
    }
    const timestampActive = timestampProfilingIsActive(timestampProfiler);
    if (computePass && timestampActive) {
      throw new Error('exclusive scan cannot share a compute pass while timestamp profiling is active');
    }
    if (computePass && (!computePass.setPipeline || !computePass.dispatchWorkgroups)) {
      throw new TypeError('computePass must be a GPUComputePassEncoder-like object');
    }

    if (timestampActive) {
      for (const level of prepared.levels) {
        if (level.level === prepared.fusedTopLevelIndex) {
          encodeProfiledComputeDispatch(
            encoder,
            timestampProfiler,
            `${labelPrefix}ScanTopAddL${level.level}`,
            {
              ...timestampMetadata,
              scanLevel: level.level,
              elementCount: level.elementCount,
              fusedLowerLevel: level.level - 1
            },
            pipelines.fusedTopAdd,
            level.fusedTopAddBindGroup,
            [1, 1, 1],
            dispatchIndirectProvider
          );
          continue;
        }
        encodeProfiledComputeDispatch(
          encoder,
          timestampProfiler,
          `${labelPrefix}ScanBlocksL${level.level}`,
          { ...timestampMetadata, scanLevel: level.level, elementCount: level.elementCount },
          pipelines.scan,
          level.scanBindGroup,
          level.dispatch,
          dispatchIndirectProvider
        );
      }
      for (let levelIndex = prepared.levels.length - 2; levelIndex >= 0; levelIndex -= 1) {
        if (levelIndex === prepared.fusedTopLevelIndex - 1) continue;
        const level = prepared.levels[levelIndex];
        encodeProfiledComputeDispatch(
          encoder,
          timestampProfiler,
          `${labelPrefix}ScanAddL${level.level}`,
          { ...timestampMetadata, scanLevel: level.level, elementCount: level.elementCount },
          pipelines.add,
          level.addBindGroup,
          level.dispatch,
          dispatchIndirectProvider
        );
      }
      return prepared;
    }

    const pass = computePass || encoder.beginComputePass({
      label: `${labelPrefix}GroupedScan`
    });
    for (const level of prepared.levels) {
      if (level.level === prepared.fusedTopLevelIndex) {
        encodeComputeDispatch(
          pass,
          pipelines.fusedTopAdd,
          level.fusedTopAddBindGroup,
          [1, 1, 1],
          dispatchIndirectProvider
        );
        continue;
      }
      encodeComputeDispatch(
        pass,
        pipelines.scan,
        level.scanBindGroup,
        level.dispatch,
        dispatchIndirectProvider
      );
    }
    for (let levelIndex = prepared.levels.length - 2; levelIndex >= 0; levelIndex -= 1) {
      if (levelIndex === prepared.fusedTopLevelIndex - 1) continue;
      const level = prepared.levels[levelIndex];
      encodeComputeDispatch(
        pass,
        pipelines.add,
        level.addBindGroup,
        level.dispatch,
        dispatchIndirectProvider
      );
    }
    if (!computePass) pass.end();
    return prepared;
  }

  const runtime = {
    schema: ULG_WEBGPU_U32_SCAN_SCHEMA,
    status: 'webgpu-u32-exclusive-scan-ready',
    pipelineCount: Object.keys(pipelines).length,
    maxElementCount: resolvedMaxElementCount,
    fixedElementCount: resolvedFixedElementCount,
    retainedParamsSlotCount: resolvedRetainedParamsSlotCount,
    retainedParamsSlotStrideBytes: persistentParamsBuffer
      ? retainedParamsSlotStrideBytes
      : 0,
    maxPlan,
    blockSums,
    blockOffsets,
    prepare,
    encodePrepared,
    encode(encoder, args, options = {}) {
      const prepared = prepare(args);
      try {
        encodePrepared(encoder, prepared, options);
        return prepared;
      } catch (error) {
        for (const buffer of prepared.transientBuffers || []) {
          if (!transients.has(buffer)) continue;
          transients.delete(buffer);
          buffer.destroy?.();
        }
        releasePreparedLease(prepared);
        throw error;
      }
    },
    releasePrepared,
    releasePreparedAfter,
    releaseTransientBuffers: releasePreparedResources,
    allocationEntries() {
      return [
        ...(persistentParamsBuffer
          ? [{ role: 'scan-params-retained', buffer: persistentParamsBuffer }]
          : []),
        ...blockSums.map((buffer, level) => ({ role: `scan-level-${level}-block-sums`, buffer })),
        ...blockOffsets.map((buffer, level) => buffer
          ? { role: `scan-level-${level}-block-offsets`, buffer }
          : null).filter(Boolean),
        ...[...transients].map((buffer) => ({ role: 'scan-params-transient', buffer }))
      ];
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      persistentParamsBuffer?.destroy?.();
      for (const buffer of blockSums) buffer.destroy?.();
      for (const buffer of blockOffsets) buffer?.destroy?.();
      for (const buffer of transients) buffer.destroy?.();
      transients.clear();
      retainedParamsLastCount.fill(null);
      for (const slot of retainedVariableParamsSlots || []) slot.inUse = false;
    }
  };
  WEBGPU_SCAN_RUNTIME_INTERNALS.set(runtime, {
    hasPreparedLease(value) {
      return retainedVariableParamsLeaseByPrepared.has(value);
    },
    releasePreparedLease
  });
  return runtime;
}

function createRadixPipelines(device, label) {
  const radixModule = device.createShaderModule({
    label: `${label}-radix-shader`,
    code: webGpuStableRadixWgsl
  });
  const uniqueModule = device.createShaderModule({
    label: `${label}-unique-shader`,
    code: webGpuSortedUniqueWgsl
  });
  const pipeline = (suffix, module, entryPoint) => device.createComputePipeline({
    label: `${label}-${suffix}`,
    layout: 'auto',
    compute: { module, entryPoint }
  });
  return {
    initialize: pipeline('initialize', radixModule, 'initialize_indices'),
    histogram: pipeline('histogram', radixModule, 'histogram'),
    scatter: pipeline('scatter', radixModule, 'scatter'),
    markHeads: pipeline('mark-heads', uniqueModule, 'mark_heads'),
    scatterUnique: pipeline('scatter-unique', uniqueModule, 'scatter_unique'),
    finalizeUnique: pipeline('finalize-unique', uniqueModule, 'finalize_unique')
  };
}

export function createWebGpuStableRadixScanUnique(device, {
  maxElementCount,
  maxKeyWordCount = WEBGPU_RADIX_MAX_KEY_WORDS,
  label = 'ulg-webgpu-radix-unique',
  maxComputeWorkgroupsPerDimension: requestedMaxComputeWorkgroupsPerDimension = null,
  retainConstantScanParamsBuffers = false,
  retainVariableScanParamsBuffers = false,
  retainedParamsSlotCount = WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_DEFAULT
} = {}) {
  assertDevice(device);
  const resolvedMaxElementCount = positiveInteger(maxElementCount, 'maxElementCount', {
    max: 0xffffffff
  });
  const resolvedMaxKeyWordCount = positiveInteger(maxKeyWordCount, 'maxKeyWordCount', {
    max: WEBGPU_RADIX_MAX_KEY_WORDS
  });
  const deviceMaxComputeWorkgroupsPerDimension = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'device.limits.maxComputeWorkgroupsPerDimension',
    { max: 0xffffffff }
  );
  const maxComputeWorkgroupsPerDimension = requestedMaxComputeWorkgroupsPerDimension == null
    ? deviceMaxComputeWorkgroupsPerDimension
    : Math.min(
      deviceMaxComputeWorkgroupsPerDimension,
      positiveInteger(
        requestedMaxComputeWorkgroupsPerDimension,
        'maxComputeWorkgroupsPerDimension',
        { max: 0xffffffff }
      )
    );
  const maxComputeWorkgroupStorageSize = positiveInteger(
    device.limits?.maxComputeWorkgroupStorageSize
      ?? WEBGPU_RADIX_SCATTER_WORKGROUP_STORAGE_BYTES,
    'device.limits.maxComputeWorkgroupStorageSize',
    { max: 0xffffffff }
  );
  if (maxComputeWorkgroupStorageSize < WEBGPU_RADIX_SCATTER_WORKGROUP_STORAGE_BYTES) {
    throw new RangeError(
      `${label} scatter entry point requires ${WEBGPU_RADIX_SCATTER_WORKGROUP_STORAGE_BYTES} bytes `
      + `of workgroup storage but device.limits.maxComputeWorkgroupStorageSize is `
      + `${maxComputeWorkgroupStorageSize}`
    );
  }
  const retainControlParams = retainConstantScanParamsBuffers === true;
  const resolvedRetainedParamsSlotCount = retainControlParams
    ? positiveInteger(retainedParamsSlotCount, 'retainedParamsSlotCount', {
        max: WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_MAX
      })
    : 0;
  const paramsOffsetAlignment = uniformOffsetAlignment(device);
  const maxRadixPassCount = resolvedMaxKeyWordCount * WEBGPU_RADIX_PASSES_PER_WORD;
  const radixParamsSlotStrideBytes = maxRadixPassCount * paramsOffsetAlignment;
  const uniqueParamsSlotStrideBytes = paramsOffsetAlignment;
  const maxBufferSize = Number(device.limits?.maxBufferSize ?? Number.MAX_SAFE_INTEGER);
  const maxUniformBufferBindingSize = Number(
    device.limits?.maxUniformBufferBindingSize ?? Number.MAX_SAFE_INTEGER
  );
  const checkedArenaByteLength = (slotStrideBytes, role) => {
    const byteLength = resolvedRetainedParamsSlotCount * slotStrideBytes;
    if (!Number.isSafeInteger(byteLength) || byteLength > maxBufferSize) {
      throw new RangeError(`${label} ${role} params arena requires ${byteLength} bytes beyond device capacity`);
    }
    if (32 > maxUniformBufferBindingSize) {
      throw new RangeError(`${label} ${role} params binding exceeds maxUniformBufferBindingSize`);
    }
    return byteLength;
  };
  const maxWorkgroups = radixGroupCountFor(resolvedMaxElementCount);
  const maxHistogramElements = maxWorkgroups * WEBGPU_RADIX_BUCKET_COUNT;
  const pipelines = createRadixPipelines(device, label);
  const sortedIndicesA = createBuffer(device, `${label}-sorted-indices-a`, resolvedMaxElementCount);
  const sortedIndicesB = createBuffer(device, `${label}-sorted-indices-b`, resolvedMaxElementCount);
  const histogramBuffer = createBuffer(device, `${label}-histograms`, maxHistogramElements);
  const histogramOffsetsBuffer = createBuffer(
    device,
    `${label}-histogram-offsets`,
    maxHistogramElements
  );
  const headFlagsBuffer = createBuffer(device, `${label}-head-flags`, resolvedMaxElementCount);
  const headOffsetsBuffer = createBuffer(device, `${label}-head-offsets`, resolvedMaxElementCount);
  const uniqueKeysBuffer = createBuffer(
    device,
    `${label}-unique-keys`,
    resolvedMaxElementCount * resolvedMaxKeyWordCount
  );
  const uniqueOffsetsBuffer = createBuffer(
    device,
    `${label}-unique-offsets`,
    resolvedMaxElementCount + 1
  );
  const evidenceBuffer = createBuffer(device, `${label}-evidence`, 8);
  const dispatchIndirectBuffer = createBuffer(
    device,
    `${label}-dispatch-indirect`,
    3,
    GPU_BUFFER_USAGE.INDIRECT
  );
  const radixParamsArena = retainControlParams
    ? device.createBuffer({
        label: `${label}-radix-params-retained-arena`,
        size: checkedArenaByteLength(radixParamsSlotStrideBytes, 'radix'),
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      })
    : null;
  const uniqueParamsArena = retainControlParams
    ? device.createBuffer({
        label: `${label}-unique-params-retained-arena`,
        size: checkedArenaByteLength(uniqueParamsSlotStrideBytes, 'unique'),
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      })
    : null;
  const histogramScan = createWebGpuU32ExclusiveScan(device, {
    maxElementCount: maxHistogramElements,
    label: `${label}-histogram-scan`,
    maxComputeWorkgroupsPerDimension,
    retainParamsBuffer: retainConstantScanParamsBuffers,
    fixedElementCount: retainVariableScanParamsBuffers ? null : maxHistogramElements,
    retainedParamsSlotCount: retainVariableScanParamsBuffers
      ? (resolvedRetainedParamsSlotCount || 1)
      : 1
  });
  const headScan = createWebGpuU32ExclusiveScan(device, {
    maxElementCount: resolvedMaxElementCount,
    label: `${label}-head-scan`,
    maxComputeWorkgroupsPerDimension,
    retainParamsBuffer: retainConstantScanParamsBuffers,
    fixedElementCount: retainVariableScanParamsBuffers ? null : resolvedMaxElementCount,
    retainedParamsSlotCount: retainVariableScanParamsBuffers
      ? (resolvedRetainedParamsSlotCount || 1)
      : 1
  });
  const attachPreparedScanLease = (parentLease, scanRuntime, prepared) => {
    const internals = WEBGPU_SCAN_RUNTIME_INTERNALS.get(scanRuntime);
    if (!parentLease || !internals?.hasPreparedLease(prepared)) return false;
    return parentLease.addChildLease({
      release: () => internals.releasePreparedLease(prepared)
    });
  };
  const transients = new Set();
  const retainedParamsSlots = Array.from(
    { length: resolvedRetainedParamsSlotCount },
    (_, slotIndex) => ({
      slotIndex,
      inUse: false,
      radixByteOffset: slotIndex * radixParamsSlotStrideBytes,
      uniqueByteOffset: slotIndex * uniqueParamsSlotStrideBytes,
      bindGroups: new Map()
    })
  );
  const retainedParamsLeaseByExecution = new WeakMap();
  const ownedExecutions = new WeakSet();
  let destroyed = false;

  function attachRetainedParamsLease(execution, lease) {
    ownedExecutions.add(execution);
    if (lease) retainedParamsLeaseByExecution.set(execution, lease);
    return execution;
  }

  function acquireRetainedParamsSlot(requestedSlotIndex = null) {
    if (!retainControlParams) return null;
    let slot = null;
    if (requestedSlotIndex !== null && requestedSlotIndex !== undefined) {
      const slotIndex = nonNegativeInteger(requestedSlotIndex, 'retainedParamsSlotIndex', {
        max: resolvedRetainedParamsSlotCount - 1
      });
      slot = retainedParamsSlots[slotIndex];
    } else {
      for (let slotIndex = 0; slotIndex < resolvedRetainedParamsSlotCount; slotIndex += 1) {
        if (!retainedParamsSlots[slotIndex].inUse) {
          slot = retainedParamsSlots[slotIndex];
          break;
        }
      }
    }
    if (!slot || slot.inUse) {
      const error = new Error(`${label} retained params slot arena is exhausted`);
      error.code = 'ERR_WEBGPU_RADIX_PARAMS_ARENA_EXHAUSTED';
      error.slotCapacity = resolvedRetainedParamsSlotCount;
      error.requestedSlotIndex = requestedSlotIndex ?? null;
      throw error;
    }
    slot.inUse = true;
    let released = false;
    const childLeases = new Set();
    return {
      slot,
      addChildLease(childLease) {
        if (!childLease?.release) return false;
        if (released) {
          childLease.release();
          return false;
        }
        childLeases.add(childLease);
        return true;
      },
      release() {
        if (released) return false;
        released = true;
        for (const childLease of childLeases) childLease.release();
        childLeases.clear();
        slot.inUse = false;
        return true;
      }
    };
  }

  function retainedBindGroup(slot, cacheKey, pipeline, bindLabel, entries, telemetry) {
    const signature = bindGroupSignature(pipeline, entries);
    const cached = slot?.bindGroups.get(cacheKey) ?? null;
    if (cached && signaturesMatch(cached.signature, signature)) {
      telemetry.reused += 1;
      return cached.bindGroup;
    }
    const bindGroup = device.createBindGroup({
      label: bindLabel,
      layout: pipeline.getBindGroupLayout(0),
      entries
    });
    if (slot) slot.bindGroups.set(cacheKey, { signature, bindGroup });
    telemetry.created += 1;
    return bindGroup;
  }

  function assertEncoding({ elementCount, keyWordCount, keyStrideWords }) {
    if (destroyed) throw new Error(`${label} is destroyed`);
    const count = nonNegativeInteger(elementCount, 'elementCount', {
      max: resolvedMaxElementCount
    });
    const words = positiveInteger(keyWordCount, 'keyWordCount', {
      max: resolvedMaxKeyWordCount
    });
    const stride = positiveInteger(keyStrideWords, 'keyStrideWords', { max: 0xffff });
    if (stride < words) throw new RangeError('keyStrideWords must cover keyWordCount');
    return { count, words, stride };
  }

  function createRadixParams({ count, words, stride, generationId }, retainedParamsLease = null) {
    const passCount = words * WEBGPU_RADIX_PASSES_PER_WORD;
    const retainedSlot = retainedParamsLease?.slot ?? null;
    const buffer = retainedSlot?.inUse === true
      ? radixParamsArena
      : device.createBuffer({
          label: `${label}-radix-params-${generationId}`,
          size: Math.max(paramsOffsetAlignment, passCount * paramsOffsetAlignment),
          usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
        });
    const byteOffset = retainedSlot?.radixByteOffset ?? 0;
    const data = new Uint32Array(
      Math.max(paramsOffsetAlignment, passCount * paramsOffsetAlignment) / UINT32_BYTES
    );
    const workgroupCount = radixGroupCountFor(count);
    const workgroupDispatch = dispatchShapeFor(
      workgroupCount,
      maxComputeWorkgroupsPerDimension
    );
    let passIndex = 0;
    for (let word = words - 1; word >= 0; word -= 1) {
      for (let shift = 0; shift < 32; shift += WEBGPU_RADIX_BITS_PER_PASS) {
        const base = (passIndex * paramsOffsetAlignment) / UINT32_BYTES;
        data[base] = count;
        data[base + 1] = workgroupCount;
        data[base + 2] = stride;
        data[base + 3] = word;
        data[base + 4] = shift;
        data[base + 5] = words;
        data[base + 6] = generationId;
        data[base + 7] = workgroupDispatch[0];
        passIndex += 1;
      }
    }
    device.queue.writeBuffer(buffer, byteOffset, data);
    if (!retainedSlot) transients.add(buffer);
    return {
      buffer,
      byteOffset,
      transientBuffer: retainedSlot ? null : buffer,
      paramsSlotIndex: retainedSlot?.slotIndex ?? null,
      paramsBufferResidency: retainedSlot ? 'retained-slot-arena' : 'transient-per-encode'
    };
  }

  function encodeSortInternal(encoder, {
    keyBuffer,
    elementCount,
    keyWordCount,
    keyStrideWords = keyWordCount,
    generationId = 0,
    timestampProfiler = null,
    timestampMetadata = {},
    dispatchIndirectProvider = null
  } = {}, retainedParamsLease = null) {
    if (!encoder?.beginComputePass) {
      throw new TypeError('stable radix encoding requires a GPUCommandEncoder-like object');
    }
    if (!keyBuffer) throw new TypeError('stable radix encoding requires keyBuffer');
    const { count, words, stride } = assertEncoding({
      elementCount,
      keyWordCount,
      keyStrideWords
    });
    if (count === 0) {
      return attachRetainedParamsLease({
        schema: ULG_WEBGPU_RADIX_UNIQUE_SCHEMA,
        status: 'webgpu-stable-radix-empty',
        elementCount: 0,
        sortedIndicesBuffer: sortedIndicesA,
        transientBuffers: []
      }, retainedParamsLease);
    }
    const generation = nonNegativeInteger(generationId, 'generationId', { max: 0xffffffff });
    if (retainControlParams && !retainedParamsLease?.slot?.inUse) {
      throw new Error(`${label} retained radix encoding requires an active params slot lease`);
    }
    const params = createRadixParams(
      { count, words, stride, generationId: generation },
      retainedParamsLease
    );
    const paramsBuffer = params.buffer;
    const paramsBaseOffset = params.byteOffset;
    const workgroupCount = radixGroupCountFor(count);
    const workgroupDispatch = dispatchShapeFor(
      workgroupCount,
      maxComputeWorkgroupsPerDimension
    );
    const histogramElementCount = workgroupCount * WEBGPU_RADIX_BUCKET_COUNT;
    const histogramScanEncoding = histogramScan.prepare({
      inputBuffer: histogramBuffer,
      outputBuffer: histogramOffsetsBuffer,
      elementCount: histogramElementCount,
      retainedParamsSlotIndex: retainVariableScanParamsBuffers
        ? (retainedParamsLease?.slot?.slotIndex ?? 0)
        : 0
    });
    attachPreparedScanLease(retainedParamsLease, histogramScan, histogramScanEncoding);
    const transientBuffers = [
      ...(params.transientBuffer ? [params.transientBuffer] : []),
      ...histogramScanEncoding.transientBuffers
    ];
    const bindGroupTelemetry = { created: 0, reused: 0 };

    const initializeEntries = [
      { binding: 2, resource: { buffer: sortedIndicesA } },
      {
        binding: 5,
        resource: { buffer: paramsBuffer, offset: paramsBaseOffset, size: 32 }
      }
    ];
    const initializeBindGroup = retainedBindGroup(
      retainedParamsLease?.slot,
      'radix-initialize',
      pipelines.initialize,
      `${label}-initialize-bind-group`,
      initializeEntries,
      bindGroupTelemetry
    );
    let input = sortedIndicesA;
    let output = sortedIndicesB;
    let passIndex = 0;
    const digitCommands = [];
    for (let word = words - 1; word >= 0; word -= 1) {
      for (let shift = 0; shift < 32; shift += WEBGPU_RADIX_BITS_PER_PASS) {
        const paramsOffset = paramsBaseOffset + passIndex * paramsOffsetAlignment;
        const histogramEntries = [
          { binding: 0, resource: { buffer: keyBuffer } },
          { binding: 1, resource: { buffer: input } },
          { binding: 3, resource: { buffer: histogramBuffer } },
          { binding: 5, resource: { buffer: paramsBuffer, offset: paramsOffset, size: 32 } }
        ];
        const histogramBindGroup = retainedBindGroup(
          retainedParamsLease?.slot,
          `radix-histogram-${passIndex}`,
          pipelines.histogram,
          `${label}-histogram-${word}-${shift}`,
          histogramEntries,
          bindGroupTelemetry
        );
        const scatterEntries = [
          { binding: 0, resource: { buffer: keyBuffer } },
          { binding: 1, resource: { buffer: input } },
          { binding: 2, resource: { buffer: output } },
          { binding: 4, resource: { buffer: histogramOffsetsBuffer } },
          { binding: 5, resource: { buffer: paramsBuffer, offset: paramsOffset, size: 32 } }
        ];
        const scatterBindGroup = retainedBindGroup(
          retainedParamsLease?.slot,
          `radix-scatter-${passIndex}`,
          pipelines.scatter,
          `${label}-scatter-${word}-${shift}`,
          scatterEntries,
          bindGroupTelemetry
        );
        digitCommands.push({
          word,
          shift,
          histogramBindGroup,
          scatterBindGroup
        });
        [input, output] = [output, input];
        passIndex += 1;
      }
    }

    const timestampActive = timestampProfilingIsActive(timestampProfiler);
    const groupedPass = timestampActive
      ? null
      : encoder.beginComputePass({ label: `${label}GroupedRadixSort` });
    if (timestampActive) {
      encodeProfiledComputeDispatch(
        encoder,
        timestampProfiler,
        `${label}Initialize`,
        { ...timestampMetadata, generationId: generation, elementCount: count },
        pipelines.initialize,
        initializeBindGroup,
        workgroupDispatch,
        dispatchIndirectProvider
      );
    } else {
      encodeComputeDispatch(
        groupedPass,
        pipelines.initialize,
        initializeBindGroup,
        workgroupDispatch,
        dispatchIndirectProvider
      );
    }

    for (const command of digitCommands) {
      const commandMetadata = {
        ...timestampMetadata,
        generationId: generation,
        keyWord: command.word,
        bitOffset: command.shift
      };
      if (timestampActive) {
        encodeProfiledComputeDispatch(
          encoder,
          timestampProfiler,
          `${label}Histogram`,
          commandMetadata,
          pipelines.histogram,
          command.histogramBindGroup,
          workgroupDispatch,
          dispatchIndirectProvider
        );
      } else {
        encodeComputeDispatch(
          groupedPass,
          pipelines.histogram,
          command.histogramBindGroup,
          workgroupDispatch,
          dispatchIndirectProvider
        );
      }

      histogramScan.encodePrepared(encoder, histogramScanEncoding, {
        timestampProfiler,
        timestampMetadata: commandMetadata,
        labelPrefix: `${label}RadixHistogram`,
        computePass: groupedPass,
        dispatchIndirectProvider
      });

      if (timestampActive) {
        encodeProfiledComputeDispatch(
          encoder,
          timestampProfiler,
          `${label}Scatter`,
          commandMetadata,
          pipelines.scatter,
          command.scatterBindGroup,
          workgroupDispatch,
          dispatchIndirectProvider
        );
      } else {
        encodeComputeDispatch(
          groupedPass,
          pipelines.scatter,
          command.scatterBindGroup,
          workgroupDispatch,
          dispatchIndirectProvider
        );
      }
    }
    groupedPass?.end();
    return attachRetainedParamsLease({
      schema: ULG_WEBGPU_RADIX_UNIQUE_SCHEMA,
      status: 'webgpu-stable-multiword-radix-encoded',
      generationId: generation,
      elementCount: count,
      keyWordCount: words,
      keyStrideWords: stride,
      passCount: passIndex,
      sortedIndicesBuffer: input,
      histogramElementCount,
      encodedDispatchCount: 1 + passIndex * (
        2 + histogramScanEncoding.encodedDispatchCount
      ),
      encodedComputePassCount: timestampActive
        ? 1 + passIndex * (2 + histogramScanEncoding.encodedDispatchCount)
        : 1,
      bindGroupCreationCount: bindGroupTelemetry.created
        + histogramScanEncoding.bindGroupCreationCount,
      bindGroupReuseCount: bindGroupTelemetry.reused
        + Math.max(
          0,
          passIndex - (histogramScanEncoding.preparedScanCacheHit ? 0 : 1)
        ) * histogramScanEncoding.encodedDispatchCount,
      paramsBufferCreationCount: params.transientBuffer ? 1 : 0,
      paramsWriteCount: 1 + (histogramScanEncoding.paramsWriteCount ?? 0),
      paramsSlotIndex: params.paramsSlotIndex,
      paramsBufferResidency: params.paramsBufferResidency,
      readbackPerformed: false,
      transientBuffers
    }, retainedParamsLease);
  }

  function createUniqueParams({
    count,
    words,
    stride,
    generationId,
    consumerWorkgroupSize,
    dispatchX
  }, retainedParamsLease = null) {
    const retainedSlot = retainedParamsLease?.slot ?? null;
    const buffer = retainedSlot?.inUse === true
      ? uniqueParamsArena
      : device.createBuffer({
          label: `${label}-unique-params-${generationId}`,
          size: paramsOffsetAlignment,
          usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
        });
    const byteOffset = retainedSlot?.uniqueByteOffset ?? 0;
    device.queue.writeBuffer(buffer, byteOffset, new Uint32Array([
      count,
      stride,
      words,
      generationId,
      consumerWorkgroupSize,
      dispatchX,
      0,
      0
    ]));
    if (!retainedSlot) transients.add(buffer);
    return {
      buffer,
      byteOffset,
      transientBuffer: retainedSlot ? null : buffer,
      paramsSlotIndex: retainedSlot?.slotIndex ?? null,
      paramsBufferResidency: retainedSlot ? 'retained-slot-arena' : 'transient-per-encode'
    };
  }

  function encodeUniqueInternal(encoder, {
    keyBuffer,
    sortedIndicesBuffer,
    elementCount,
    keyWordCount,
    keyStrideWords = keyWordCount,
    generationId = 0,
    consumerWorkgroupSize = 64,
    timestampProfiler = null,
    timestampMetadata = {},
    dispatchIndirectProvider = null
  } = {}, retainedParamsLease = null) {
    if (!encoder?.beginComputePass || !encoder?.clearBuffer) {
      throw new TypeError('unique encoding requires a GPUCommandEncoder-like object');
    }
    if (!keyBuffer || !sortedIndicesBuffer) {
      throw new TypeError('unique encoding requires keyBuffer and sortedIndicesBuffer');
    }
    const { count, words, stride } = assertEncoding({
      elementCount,
      keyWordCount,
      keyStrideWords
    });
    const generation = nonNegativeInteger(generationId, 'generationId', { max: 0xffffffff });
    const consumerWidth = positiveInteger(consumerWorkgroupSize, 'consumerWorkgroupSize', {
      max: 1024
    });
    const workgroupCount = count > 0 ? radixGroupCountFor(count) : 1;
    const workgroupDispatch = dispatchShapeFor(
      workgroupCount,
      maxComputeWorkgroupsPerDimension
    );
    if (retainControlParams && !retainedParamsLease?.slot?.inUse) {
      throw new Error(`${label} retained unique encoding requires an active params slot lease`);
    }
    const params = createUniqueParams({
      count,
      words,
      stride,
      generationId: generation,
      consumerWorkgroupSize: consumerWidth,
      dispatchX: workgroupDispatch[0]
    }, retainedParamsLease);
    const paramsBuffer = params.buffer;
    const paramsOffset = params.byteOffset;
    const transientBuffers = params.transientBuffer ? [params.transientBuffer] : [];
    const bindGroupTelemetry = { created: 0, reused: 0 };
    encoder.clearBuffer(evidenceBuffer);
    encoder.clearBuffer(dispatchIndirectBuffer);
    encoder.clearBuffer(uniqueOffsetsBuffer, 0, UINT32_BYTES);

    let markBindGroup = null;
    let headScanEncoding = null;
    let scatterBindGroup = null;
    if (count > 0) {
      const markEntries = [
        { binding: 0, resource: { buffer: keyBuffer } },
        { binding: 1, resource: { buffer: sortedIndicesBuffer } },
        { binding: 2, resource: { buffer: headFlagsBuffer } },
        { binding: 8, resource: { buffer: paramsBuffer, offset: paramsOffset, size: 32 } }
      ];
      markBindGroup = retainedBindGroup(
        retainedParamsLease?.slot,
        'unique-mark-heads',
        pipelines.markHeads,
        `${label}-mark-heads-bind-group`,
        markEntries,
        bindGroupTelemetry
      );
      headScanEncoding = headScan.prepare({
        inputBuffer: headFlagsBuffer,
        outputBuffer: headOffsetsBuffer,
        elementCount: count,
        retainedParamsSlotIndex: retainVariableScanParamsBuffers
          ? (retainedParamsLease?.slot?.slotIndex ?? 0)
          : 0
      });
      attachPreparedScanLease(retainedParamsLease, headScan, headScanEncoding);
      transientBuffers.push(...headScanEncoding.transientBuffers);
      const scatterEntries = [
        { binding: 0, resource: { buffer: keyBuffer } },
        { binding: 1, resource: { buffer: sortedIndicesBuffer } },
        { binding: 2, resource: { buffer: headFlagsBuffer } },
        { binding: 3, resource: { buffer: headOffsetsBuffer } },
        { binding: 4, resource: { buffer: uniqueKeysBuffer } },
        { binding: 5, resource: { buffer: uniqueOffsetsBuffer } },
        { binding: 8, resource: { buffer: paramsBuffer, offset: paramsOffset, size: 32 } }
      ];
      scatterBindGroup = retainedBindGroup(
        retainedParamsLease?.slot,
        'unique-scatter',
        pipelines.scatterUnique,
        `${label}-scatter-unique-bind-group`,
        scatterEntries,
        bindGroupTelemetry
      );
    }

    const finalizeEntries = [
      { binding: 2, resource: { buffer: headFlagsBuffer } },
      { binding: 3, resource: { buffer: headOffsetsBuffer } },
      { binding: 5, resource: { buffer: uniqueOffsetsBuffer } },
      { binding: 6, resource: { buffer: evidenceBuffer } },
      { binding: 7, resource: { buffer: dispatchIndirectBuffer } },
      { binding: 8, resource: { buffer: paramsBuffer, offset: paramsOffset, size: 32 } }
    ];
    const finalizeBindGroup = retainedBindGroup(
      retainedParamsLease?.slot,
      'unique-finalize',
      pipelines.finalizeUnique,
      `${label}-finalize-unique-bind-group`,
      finalizeEntries,
      bindGroupTelemetry
    );
    const timestampActive = timestampProfilingIsActive(timestampProfiler);
    const commandMetadata = {
      ...timestampMetadata,
      generationId: generation,
      elementCount: count
    };
    const groupedPass = timestampActive
      ? null
      : encoder.beginComputePass({ label: `${label}GroupedUnique` });
    if (count > 0) {
      if (timestampActive) {
        encodeProfiledComputeDispatch(
          encoder,
          timestampProfiler,
          `${label}MarkUniqueHeads`,
          commandMetadata,
          pipelines.markHeads,
          markBindGroup,
          workgroupDispatch,
          dispatchIndirectProvider
        );
      } else {
        encodeComputeDispatch(
          groupedPass,
          pipelines.markHeads,
          markBindGroup,
          workgroupDispatch,
          dispatchIndirectProvider
        );
      }

      headScan.encodePrepared(encoder, headScanEncoding, {
        timestampProfiler,
        timestampMetadata: { ...timestampMetadata, generationId: generation },
        labelPrefix: `${label}UniqueHead`,
        computePass: groupedPass,
        dispatchIndirectProvider
      });

      if (timestampActive) {
        encodeProfiledComputeDispatch(
          encoder,
          timestampProfiler,
          `${label}ScatterUnique`,
          commandMetadata,
          pipelines.scatterUnique,
          scatterBindGroup,
          workgroupDispatch,
          dispatchIndirectProvider
        );
      } else {
        encodeComputeDispatch(
          groupedPass,
          pipelines.scatterUnique,
          scatterBindGroup,
          workgroupDispatch,
          dispatchIndirectProvider
        );
      }
    }

    if (timestampActive) {
      encodeProfiledComputeDispatch(
        encoder,
        timestampProfiler,
        `${label}FinalizeUnique`,
        commandMetadata,
        pipelines.finalizeUnique,
        finalizeBindGroup,
        [1, 1, 1],
        dispatchIndirectProvider
      );
    } else {
      encodeComputeDispatch(
        groupedPass,
        pipelines.finalizeUnique,
        finalizeBindGroup,
        [1, 1, 1],
        dispatchIndirectProvider
      );
      groupedPass.end();
    }

    return attachRetainedParamsLease({
      schema: ULG_WEBGPU_RADIX_UNIQUE_SCHEMA,
      status: 'webgpu-sorted-unique-csr-encoded',
      generationId: generation,
      elementCount: count,
      keyWordCount: words,
      keyStrideWords: stride,
      sortedIndicesBuffer,
      uniqueHeadFlagsBuffer: headFlagsBuffer,
      uniqueGroupIndexBySortedPositionBuffer: headOffsetsBuffer,
      uniqueKeysBuffer,
      uniqueOffsetsBuffer,
      uniqueEvidenceBuffer: evidenceBuffer,
      uniqueDispatchIndirectBuffer: dispatchIndirectBuffer,
      uniqueKeyCapacity: resolvedMaxElementCount,
      uniqueOffsetCapacity: resolvedMaxElementCount + 1,
      consumerWorkgroupSize: consumerWidth,
      encodedDispatchCount: (count > 0
        ? 2 + headScanEncoding.encodedDispatchCount
        : 0) + 1,
      encodedComputePassCount: timestampActive
        ? ((count > 0 ? 2 + headScanEncoding.encodedDispatchCount : 0) + 1)
        : 1,
      bindGroupCreationCount: bindGroupTelemetry.created
        + (headScanEncoding?.bindGroupCreationCount ?? 0),
      bindGroupReuseCount: bindGroupTelemetry.reused
        + (headScanEncoding?.preparedScanCacheHit
            ? headScanEncoding.encodedDispatchCount
            : 0),
      paramsBufferCreationCount: params.transientBuffer ? 1 : 0,
      paramsWriteCount: 1 + (headScanEncoding?.paramsWriteCount ?? 0),
      clearedWordCount: WEBGPU_RADIX_UNIQUE_CLEARED_WORD_COUNT,
      paramsSlotIndex: params.paramsSlotIndex,
      paramsBufferResidency: params.paramsBufferResidency,
      readbackPerformed: false,
      transientBuffers
    }, retainedParamsLease);
  }

  const releasedExecutions = new WeakSet();

  function assertOwnedExecution(value) {
    if (!value || typeof value !== 'object' || value.schema !== ULG_WEBGPU_RADIX_UNIQUE_SCHEMA) {
      throw new TypeError('releaseExecution requires a radix/scan/unique execution result');
    }
    if (!ownedExecutions.has(value)) {
      const error = new Error(`${label} cannot release an execution owned by another runtime`);
      error.code = 'ERR_WEBGPU_RADIX_FOREIGN_EXECUTION';
      throw error;
    }
  }

  function finalizeReleaseExecution(value) {
    assertOwnedExecution(value);
    if (releasedExecutions.has(value)) return false;
    histogramScan.releaseTransientBuffers(value);
    headScan.releaseTransientBuffers(value);
    for (const buffer of value.transientBuffers || []) {
      if (!transients.has(buffer)) continue;
      transients.delete(buffer);
      buffer.destroy?.();
    }
    retainedParamsLeaseByExecution.get(value)?.release?.();
    retainedParamsLeaseByExecution.delete(value);
    releasedExecutions.add(value);
    return true;
  }

  function releaseExecution(value, { discardedEncoder = false } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError(
        `${label} releaseExecution is only for a discarded encoder; `
        + 'use releaseExecutionAfter with a submission-fence thenable after submission'
      );
    }
    return finalizeReleaseExecution(value);
  }

  async function releaseExecutionAfter(value, submissionFence) {
    if (!submissionFence?.then) {
      throw new TypeError('releaseExecutionAfter requires a submission-fence thenable');
    }
    assertOwnedExecution(value);
    if (releasedExecutions.has(value)) return false;
    await submissionFence;
    return finalizeReleaseExecution(value);
  }

  return {
    schema: ULG_WEBGPU_RADIX_UNIQUE_SCHEMA,
    status: 'webgpu-stable-radix-scan-unique-ready',
    pipelineCount:
      Object.keys(pipelines).length
      + histogramScan.pipelineCount
      + headScan.pipelineCount,
    maxElementCount: resolvedMaxElementCount,
    maxKeyWordCount: resolvedMaxKeyWordCount,
    retainedParamsSlotCount: resolvedRetainedParamsSlotCount,
    variableRetainedScanCounts: retainControlParams && retainVariableScanParamsBuffers === true,
    paramsOffsetAlignment,
    radixParamsSlotStrideBytes: retainControlParams ? radixParamsSlotStrideBytes : 0,
    uniqueParamsSlotStrideBytes: retainControlParams ? uniqueParamsSlotStrideBytes : 0,
    encodeSort(encoder, args = {}) {
      if (!retainControlParams || Number(args.elementCount) === 0) {
        return encodeSortInternal(encoder, args);
      }
      const lease = acquireRetainedParamsSlot(args.retainedParamsSlotIndex);
      try {
        return encodeSortInternal(encoder, args, lease);
      } catch (error) {
        lease.release();
        throw error;
      }
    },
    encodeUnique(encoder, args = {}) {
      if (!retainControlParams) return encodeUniqueInternal(encoder, args);
      const lease = acquireRetainedParamsSlot(args.retainedParamsSlotIndex);
      try {
        return encodeUniqueInternal(encoder, args, lease);
      } catch (error) {
        lease.release();
        throw error;
      }
    },
    encodeSortUnique(encoder, args = {}) {
      const lease = retainControlParams
        ? acquireRetainedParamsSlot(args.retainedParamsSlotIndex)
        : null;
      try {
        const sorted = encodeSortInternal(encoder, args, lease);
        const unique = encodeUniqueInternal(encoder, {
          ...args,
          sortedIndicesBuffer: sorted.sortedIndicesBuffer
        }, lease);
        const execution = {
          ...unique,
          status: 'webgpu-stable-radix-sort-unique-csr-encoded',
          radixPassCount: sorted.passCount ?? 0,
          histogramElementCount: sorted.histogramElementCount ?? 0,
          encodedDispatchCount: (sorted.encodedDispatchCount ?? 0)
            + (unique.encodedDispatchCount ?? 0),
          encodedComputePassCount: (sorted.encodedComputePassCount ?? 0)
            + (unique.encodedComputePassCount ?? 0),
          bindGroupCreationCount: (sorted.bindGroupCreationCount ?? 0)
            + (unique.bindGroupCreationCount ?? 0),
          bindGroupReuseCount: (sorted.bindGroupReuseCount ?? 0)
            + (unique.bindGroupReuseCount ?? 0),
          paramsBufferCreationCount: (sorted.paramsBufferCreationCount ?? 0)
            + (unique.paramsBufferCreationCount ?? 0),
          paramsWriteCount: (sorted.paramsWriteCount ?? 0)
            + (unique.paramsWriteCount ?? 0),
          clearedWordCount: unique.clearedWordCount ?? 0,
          transientBuffers: [...sorted.transientBuffers, ...unique.transientBuffers]
        };
        return attachRetainedParamsLease(execution, lease);
      } catch (error) {
        lease?.release();
        throw error;
      }
    },
    releaseExecution,
    releaseExecutionAfter,
    allocationEntries() {
      return [
        { role: 'radix-sorted-indices-a', buffer: sortedIndicesA },
        { role: 'radix-sorted-indices-b', buffer: sortedIndicesB },
        { role: 'radix-histograms', buffer: histogramBuffer },
        { role: 'radix-histogram-offsets', buffer: histogramOffsetsBuffer },
        { role: 'unique-head-flags', buffer: headFlagsBuffer },
        { role: 'unique-head-offsets', buffer: headOffsetsBuffer },
        { role: 'unique-keys', buffer: uniqueKeysBuffer },
        { role: 'unique-offsets', buffer: uniqueOffsetsBuffer },
        { role: 'unique-evidence', buffer: evidenceBuffer },
        { role: 'unique-dispatch-indirect', buffer: dispatchIndirectBuffer },
        ...(radixParamsArena
          ? [{ role: 'radix-params-retained-arena', buffer: radixParamsArena }]
          : []),
        ...(uniqueParamsArena
          ? [{ role: 'unique-params-retained-arena', buffer: uniqueParamsArena }]
          : []),
        ...histogramScan.allocationEntries(),
        ...headScan.allocationEntries(),
        ...[...transients].map((buffer) => ({ role: 'radix-unique-params-transient', buffer }))
      ];
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const buffer of [
        sortedIndicesA,
        sortedIndicesB,
        histogramBuffer,
        histogramOffsetsBuffer,
        headFlagsBuffer,
        headOffsetsBuffer,
        uniqueKeysBuffer,
        uniqueOffsetsBuffer,
        evidenceBuffer,
        dispatchIndirectBuffer,
        radixParamsArena,
        uniqueParamsArena
      ]) buffer?.destroy?.();
      histogramScan.destroy();
      headScan.destroy();
      for (const buffer of transients) buffer.destroy?.();
      transients.clear();
      for (const slot of retainedParamsSlots) {
        slot.inUse = false;
        slot.bindGroups.clear();
      }
    }
  };
}
