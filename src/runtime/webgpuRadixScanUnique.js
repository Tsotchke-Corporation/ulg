import {
  ULG_WEBGPU_RADIX_GPU_COUNT_SCHEMA,
  ULG_WEBGPU_RADIX_UNIQUE_SCHEMA,
  ULG_WEBGPU_U32_SCAN_SCHEMA,
  WEBGPU_PARALLEL_PRIMITIVE_STATUS_ADMITTED,
  WEBGPU_PARALLEL_PRIMITIVE_STATUS_COUNT_OVERFLOW,
  WEBGPU_PARALLEL_PRIMITIVE_STATUS_FAIL_CLOSED,
  WEBGPU_PARALLEL_PRIMITIVE_STATUS_INVALID_SEAL,
  WEBGPU_PARALLEL_PRIMITIVE_STATUS_INVALID_TOPOLOGY,
  WEBGPU_PARALLEL_PRIMITIVE_STATUS_READY,
  WEBGPU_RADIX_GPU_COUNT_ABI_VERSION,
  WEBGPU_RADIX_GPU_COUNT_CONTROL_HEADER_WORDS,
  WEBGPU_RADIX_GPU_COUNT_MAGIC,
  WEBGPU_RADIX_UNIQUE_EVIDENCE_ROW_LAYOUT,
  WEBGPU_INDIRECT_DISPATCH_ROW_LAYOUT
} from '../../ulg-gpu-abi/src/parallelPrimitives.js';
import {
  createCachedExplicitComputePipeline
} from './webgpuComputeLayout.js';

export {
  ULG_WEBGPU_RADIX_GPU_COUNT_SCHEMA,
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

function exactThenablePromise(value, errorMessage) {
  let then;
  try {
    then = value?.then;
  } catch (error) {
    throw error;
  }
  if (typeof then !== 'function') {
    throw new TypeError(errorMessage);
  }
  return new Promise((resolve, reject) => {
    try {
      Reflect.apply(then, value, [resolve, reject]);
    } catch (error) {
      reject(error);
    }
  });
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

function scanLevelCountForMaximum(elementCount) {
  let count = positiveInteger(elementCount, 'scan maximum element count', {
    max: 0xffffffff
  });
  let levelCount = 0;
  while (count > 0) {
    levelCount += 1;
    const groups = groupCountFor(count);
    if (groups <= 1) break;
    count = groups;
  }
  return levelCount;
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

export const WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD = Object.freeze({
  MAGIC: 0,
  ABI_VERSION: 1,
  STATUS_FLAGS: 2,
  EXPECTED_GENERATION_SEAL: 3,
  OBSERVED_GENERATION_SEAL: 4,
  LIVE_ELEMENT_COUNT: 5,
  MAXIMUM_ELEMENT_COUNT: 6,
  OVERFLOW_COUNT: 7,
  KEY_WORD_COUNT: 8,
  KEY_STRIDE_WORDS: 9,
  RADIX_WORKGROUP_COUNT: 10,
  HISTOGRAM_ELEMENT_COUNT: 11,
  CONSUMER_WORKGROUP_SIZE: 12,
  GENERATION_ID: 13,
  HISTOGRAM_SCAN_LEVEL_COUNT: 14,
  HEAD_SCAN_LEVEL_COUNT: 15,
  AUTHORITY_COUNT_OFFSET_WORDS: 16,
  AUTHORITY_SEAL_OFFSET_WORDS: 17,
  INDIRECT_ROW_COUNT: 18,
  COMPLETION_GENERATION_SEAL: 19,
  RADIX_DISPATCH_OFFSET_WORDS: 20,
  HISTOGRAM_SCAN_COUNT_OFFSET_WORDS: 21,
  HEAD_SCAN_COUNT_OFFSET_WORDS: 22,
  HISTOGRAM_SCAN_DISPATCH_OFFSET_WORDS: 23,
  HEAD_SCAN_DISPATCH_OFFSET_WORDS: 24,
  CONTROL_WORD_COUNT: 25,
  DISPATCH_X_LIMIT: 26
});

export function createWebGpuRadixGpuCountControlLayout({
  maxElementCount,
  maxComputeWorkgroupsPerDimension = 65535
} = {}) {
  const maximum = positiveInteger(maxElementCount, 'maxElementCount', {
    max: 0xffffffff
  });
  const maxRadixWorkgroups = radixGroupCountFor(maximum);
  const maxHistogramElementCount = maxRadixWorkgroups * WEBGPU_RADIX_BUCKET_COUNT;
  if (!Number.isSafeInteger(maxHistogramElementCount)
    || maxHistogramElementCount > 0xffffffff) {
    throw new RangeError('maximum radix histogram exceeds the u32-addressable range');
  }
  const histogramScanLevelCount = scanLevelCountForMaximum(maxHistogramElementCount);
  const headScanLevelCount = scanLevelCountForMaximum(maximum);
  const histogramScanCountOffsetWords = WEBGPU_RADIX_GPU_COUNT_CONTROL_HEADER_WORDS;
  const headScanCountOffsetWords =
    histogramScanCountOffsetWords + histogramScanLevelCount;
  const radixDispatchOffsetWords =
    headScanCountOffsetWords + headScanLevelCount;
  const histogramScanDispatchOffsetWords =
    radixDispatchOffsetWords + WEBGPU_INDIRECT_DISPATCH_ROW_LAYOUT.length;
  const headScanDispatchOffsetWords = histogramScanDispatchOffsetWords
    + histogramScanLevelCount * 2 * WEBGPU_INDIRECT_DISPATCH_ROW_LAYOUT.length;
  const controlWordCount = headScanDispatchOffsetWords
    + headScanLevelCount * 2 * WEBGPU_INDIRECT_DISPATCH_ROW_LAYOUT.length;
  const indirectRowCount = 1
    + histogramScanLevelCount * 2
    + headScanLevelCount * 2;

  // Validate every possible fixed-topology dispatch shape up front. Dynamic
  // live counts can only produce equal or smaller shapes.
  let scanCount = maxHistogramElementCount;
  dispatchShapeFor(maxRadixWorkgroups, maxComputeWorkgroupsPerDimension);
  for (let level = 0; level < histogramScanLevelCount; level += 1) {
    const groups = groupCountFor(scanCount);
    dispatchShapeFor(groups, maxComputeWorkgroupsPerDimension);
    scanCount = groups;
  }
  scanCount = maximum;
  for (let level = 0; level < headScanLevelCount; level += 1) {
    const groups = groupCountFor(scanCount);
    dispatchShapeFor(groups, maxComputeWorkgroupsPerDimension);
    scanCount = groups;
  }

  return Object.freeze({
    headerWordCount: WEBGPU_RADIX_GPU_COUNT_CONTROL_HEADER_WORDS,
    histogramScanLevelCount,
    headScanLevelCount,
    histogramScanCountOffsetWords,
    headScanCountOffsetWords,
    radixDispatchOffsetWords,
    radixDispatchOffsetBytes: radixDispatchOffsetWords * UINT32_BYTES,
    histogramScanDispatchOffsetWords,
    headScanDispatchOffsetWords,
    indirectRowCount,
    controlWordCount,
    controlByteLength: controlWordCount * UINT32_BYTES,
    dispatchRowWordCount: WEBGPU_INDIRECT_DISPATCH_ROW_LAYOUT.length
  });
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

function destroyBuffersExactlyOnce(buffers) {
  const destroyedBuffers = new Set();
  for (let index = buffers.length - 1; index >= 0; index -= 1) {
    const buffer = buffers[index];
    if (!buffer || destroyedBuffers.has(buffer)) continue;
    destroyedBuffers.add(buffer);
    try {
      buffer.destroy?.();
    } catch {
      // Rollback must keep visiting every successfully created buffer.  The
      // construction error remains the useful failure when a hostile test
      // double also throws from destroy().
    }
  }
}

function createOwnedBufferConstruction() {
  const buffers = [];
  const childRuntimes = [];
  let active = true;
  return {
    ownBuffer(buffer) {
      buffers.push(buffer);
      return buffer;
    },
    ownRuntime(runtime) {
      childRuntimes.push(runtime);
      return runtime;
    },
    commit() {
      active = false;
      buffers.length = 0;
      childRuntimes.length = 0;
    },
    rollback() {
      if (!active) return false;
      active = false;
      for (let index = childRuntimes.length - 1; index >= 0; index -= 1) {
        try {
          childRuntimes[index]?.destroy?.();
        } catch {
          // A child owns its buffer cleanup. Continue rolling back siblings and
          // direct allocations even if a hostile destroy implementation fails.
        }
      }
      destroyBuffersExactlyOnce(buffers);
      buffers.length = 0;
      childRuntimes.length = 0;
      return true;
    }
  };
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

// Small radix histograms are often cheaper to scan with one bounded GPU
// invocation than with a multi-dispatch hierarchical scan. This is an opt-in
// path: the general radix primitive remains fully parallel by default.
export const webGpuSerialRadixHistogramScanWgsl = /* wgsl */ `
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

@group(0) @binding(0) var<storage, read> radix_histograms: array<u32>;
@group(0) @binding(1) var<storage, read_write> radix_histogram_offsets: array<u32>;
@group(0) @binding(2) var<uniform> radix_params: RadixParams;

@compute @workgroup_size(1)
fn scan_histogram_serial() {
  let histogram_element_count = radix_params.workgroup_count * 16u;
  var running = 0u;
  for (var index = 0u; index < histogram_element_count; index = index + 1u) {
    radix_histogram_offsets[index] = running;
    running = running + radix_histograms[index];
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

export const webGpuRadixGpuCountPrepareWgsl = /* wgsl */ `
struct GpuCountConfig {
  authority_count_word: u32,
  authority_seal_word: u32,
  expected_generation_seal: u32,
  maximum_element_count: u32,
  key_word_count: u32,
  key_stride_words: u32,
  consumer_workgroup_size: u32,
  generation_id: u32,
  dispatch_x_limit: u32,
  histogram_scan_count_word: u32,
  head_scan_count_word: u32,
  radix_dispatch_word: u32,
  histogram_scan_dispatch_word: u32,
  head_scan_dispatch_word: u32,
  histogram_scan_level_count: u32,
  head_scan_level_count: u32,
  indirect_row_count: u32,
  control_word_count: u32,
  runtime_maximum_element_count: u32,
  _pad0: u32,
};

@group(0) @binding(0) var<storage, read> gpu_count_authority: array<u32>;
@group(0) @binding(1) var<storage, read_write> gpu_count_control: array<u32>;
@group(0) @binding(2) var<uniform> gpu_count_config: GpuCountConfig;

const CONTROL_MAGIC: u32 = ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.MAGIC}u;
const CONTROL_ABI_VERSION: u32 = ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.ABI_VERSION}u;
const CONTROL_STATUS: u32 = ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.STATUS_FLAGS}u;
const CONTROL_EXPECTED_SEAL: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.EXPECTED_GENERATION_SEAL}u;
const CONTROL_OBSERVED_SEAL: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.OBSERVED_GENERATION_SEAL}u;
const CONTROL_LIVE_COUNT: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.LIVE_ELEMENT_COUNT}u;
const CONTROL_MAX_COUNT: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.MAXIMUM_ELEMENT_COUNT}u;
const CONTROL_OVERFLOW_COUNT: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.OVERFLOW_COUNT}u;
const CONTROL_KEY_WORD_COUNT: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.KEY_WORD_COUNT}u;
const CONTROL_KEY_STRIDE: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.KEY_STRIDE_WORDS}u;
const CONTROL_RADIX_GROUP_COUNT: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.RADIX_WORKGROUP_COUNT}u;
const CONTROL_HISTOGRAM_COUNT: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.HISTOGRAM_ELEMENT_COUNT}u;
const CONTROL_CONSUMER_WORKGROUP_SIZE: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.CONSUMER_WORKGROUP_SIZE}u;
const CONTROL_GENERATION_ID: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.GENERATION_ID}u;
const CONTROL_HISTOGRAM_LEVEL_COUNT: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.HISTOGRAM_SCAN_LEVEL_COUNT}u;
const CONTROL_HEAD_LEVEL_COUNT: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.HEAD_SCAN_LEVEL_COUNT}u;
const CONTROL_AUTHORITY_COUNT_WORD: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.AUTHORITY_COUNT_OFFSET_WORDS}u;
const CONTROL_AUTHORITY_SEAL_WORD: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.AUTHORITY_SEAL_OFFSET_WORDS}u;
const CONTROL_INDIRECT_ROW_COUNT: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.INDIRECT_ROW_COUNT}u;
const CONTROL_COMPLETION_SEAL: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.COMPLETION_GENERATION_SEAL}u;
const CONTROL_RADIX_DISPATCH_WORD: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.RADIX_DISPATCH_OFFSET_WORDS}u;
const CONTROL_HISTOGRAM_COUNT_WORD: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.HISTOGRAM_SCAN_COUNT_OFFSET_WORDS}u;
const CONTROL_HEAD_COUNT_WORD: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.HEAD_SCAN_COUNT_OFFSET_WORDS}u;
const CONTROL_HISTOGRAM_DISPATCH_WORD: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.HISTOGRAM_SCAN_DISPATCH_OFFSET_WORDS}u;
const CONTROL_HEAD_DISPATCH_WORD: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.HEAD_SCAN_DISPATCH_OFFSET_WORDS}u;
const CONTROL_WORD_COUNT: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.CONTROL_WORD_COUNT}u;
const CONTROL_DISPATCH_X_LIMIT: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.DISPATCH_X_LIMIT}u;

const GPU_COUNT_MAGIC: u32 = ${WEBGPU_RADIX_GPU_COUNT_MAGIC}u;
const GPU_COUNT_ABI_VERSION: u32 = ${WEBGPU_RADIX_GPU_COUNT_ABI_VERSION}u;
const STATUS_READY: u32 = ${WEBGPU_PARALLEL_PRIMITIVE_STATUS_READY}u;
const STATUS_ADMITTED: u32 = ${WEBGPU_PARALLEL_PRIMITIVE_STATUS_ADMITTED}u;
const STATUS_FAIL_CLOSED: u32 = ${WEBGPU_PARALLEL_PRIMITIVE_STATUS_FAIL_CLOSED}u;
const STATUS_INVALID_SEAL: u32 = ${WEBGPU_PARALLEL_PRIMITIVE_STATUS_INVALID_SEAL}u;
const STATUS_COUNT_OVERFLOW: u32 =
  ${WEBGPU_PARALLEL_PRIMITIVE_STATUS_COUNT_OVERFLOW}u;
const STATUS_INVALID_TOPOLOGY: u32 =
  ${WEBGPU_PARALLEL_PRIMITIVE_STATUS_INVALID_TOPOLOGY}u;

fn ceil_groups(value: u32, width: u32) -> u32 {
  return value / width + select(0u, 1u, value % width != 0u);
}

fn write_dispatch(offset: u32, group_count: u32, enabled: bool) {
  if (!enabled || group_count == 0u) {
    gpu_count_control[offset] = 0u;
    gpu_count_control[offset + 1u] = 0u;
    gpu_count_control[offset + 2u] = 0u;
    return;
  }
  let dispatch_x = min(group_count, gpu_count_config.dispatch_x_limit);
  let dispatch_y = ceil_groups(group_count, dispatch_x);
  let shape_admitted = dispatch_y <= gpu_count_config.dispatch_x_limit;
  gpu_count_control[offset] = select(0u, dispatch_x, shape_admitted);
  gpu_count_control[offset + 1u] = select(0u, dispatch_y, shape_admitted);
  gpu_count_control[offset + 2u] = select(0u, 1u, shape_admitted);
}

fn prepare_scan(
  count_word: u32,
  dispatch_word: u32,
  level_count: u32,
  initial_count: u32,
  admitted: bool
) {
  var count = initial_count;
  for (var level = 0u; level < level_count; level = level + 1u) {
    let level_admitted = admitted && count > 0u;
    let group_count = select(0u, ceil_groups(count, 512u), level_admitted);
    gpu_count_control[count_word + level] = select(0u, count, level_admitted);
    let block_dispatch_word = dispatch_word + level * 6u;
    write_dispatch(block_dispatch_word, group_count, level_admitted);
    let parent_admitted =
      level_admitted && group_count > 1u && level + 1u < level_count;
    write_dispatch(block_dispatch_word + 3u, group_count, parent_admitted);
    count = select(0u, group_count, parent_admitted);
  }
}

@compute @workgroup_size(1)
fn prepare_gpu_count() {
  let observed_count =
    gpu_count_authority[gpu_count_config.authority_count_word];
  let observed_seal =
    gpu_count_authority[gpu_count_config.authority_seal_word];
  let topology_valid =
    gpu_count_config.maximum_element_count > 0u
    && gpu_count_config.maximum_element_count
      <= gpu_count_config.runtime_maximum_element_count
    && gpu_count_config.key_word_count > 0u
    && gpu_count_config.key_stride_words >= gpu_count_config.key_word_count
    && gpu_count_config.consumer_workgroup_size > 0u
    && gpu_count_config.dispatch_x_limit > 0u
    && gpu_count_config.histogram_scan_level_count > 0u
    && gpu_count_config.head_scan_level_count > 0u;
  let seal_valid =
    gpu_count_config.expected_generation_seal != 0u
    && observed_seal == gpu_count_config.expected_generation_seal;
  let overflowed =
    topology_valid && seal_valid
    && observed_count > gpu_count_config.maximum_element_count;
  let admitted = topology_valid && seal_valid && !overflowed;

  var status = STATUS_READY;
  if (!topology_valid) {
    status = status | STATUS_FAIL_CLOSED | STATUS_INVALID_TOPOLOGY;
  } else if (!seal_valid) {
    status = status | STATUS_FAIL_CLOSED | STATUS_INVALID_SEAL;
  } else if (overflowed) {
    status = status | STATUS_FAIL_CLOSED | STATUS_COUNT_OVERFLOW;
  } else {
    status = status | STATUS_ADMITTED;
  }

  let live_count = select(0u, observed_count, admitted);
  let radix_group_count = select(
    0u,
    ceil_groups(live_count, 256u),
    admitted && live_count > 0u
  );
  let histogram_count = radix_group_count * 16u;

  gpu_count_control[CONTROL_MAGIC] = GPU_COUNT_MAGIC;
  gpu_count_control[CONTROL_ABI_VERSION] = GPU_COUNT_ABI_VERSION;
  gpu_count_control[CONTROL_STATUS] = status;
  gpu_count_control[CONTROL_EXPECTED_SEAL] =
    gpu_count_config.expected_generation_seal;
  gpu_count_control[CONTROL_OBSERVED_SEAL] = observed_seal;
  gpu_count_control[CONTROL_LIVE_COUNT] = live_count;
  gpu_count_control[CONTROL_MAX_COUNT] =
    gpu_count_config.maximum_element_count;
  gpu_count_control[CONTROL_OVERFLOW_COUNT] = select(
    0u,
    observed_count - gpu_count_config.maximum_element_count,
    overflowed
  );
  gpu_count_control[CONTROL_KEY_WORD_COUNT] =
    gpu_count_config.key_word_count;
  gpu_count_control[CONTROL_KEY_STRIDE] =
    gpu_count_config.key_stride_words;
  gpu_count_control[CONTROL_RADIX_GROUP_COUNT] = radix_group_count;
  gpu_count_control[CONTROL_HISTOGRAM_COUNT] = histogram_count;
  gpu_count_control[CONTROL_CONSUMER_WORKGROUP_SIZE] =
    gpu_count_config.consumer_workgroup_size;
  gpu_count_control[CONTROL_GENERATION_ID] =
    gpu_count_config.generation_id;
  gpu_count_control[CONTROL_HISTOGRAM_LEVEL_COUNT] =
    gpu_count_config.histogram_scan_level_count;
  gpu_count_control[CONTROL_HEAD_LEVEL_COUNT] =
    gpu_count_config.head_scan_level_count;
  gpu_count_control[CONTROL_AUTHORITY_COUNT_WORD] =
    gpu_count_config.authority_count_word;
  gpu_count_control[CONTROL_AUTHORITY_SEAL_WORD] =
    gpu_count_config.authority_seal_word;
  gpu_count_control[CONTROL_INDIRECT_ROW_COUNT] =
    gpu_count_config.indirect_row_count;
  gpu_count_control[CONTROL_COMPLETION_SEAL] = select(
    0u,
    gpu_count_config.expected_generation_seal,
    admitted
  );
  gpu_count_control[CONTROL_RADIX_DISPATCH_WORD] =
    gpu_count_config.radix_dispatch_word;
  gpu_count_control[CONTROL_HISTOGRAM_COUNT_WORD] =
    gpu_count_config.histogram_scan_count_word;
  gpu_count_control[CONTROL_HEAD_COUNT_WORD] =
    gpu_count_config.head_scan_count_word;
  gpu_count_control[CONTROL_HISTOGRAM_DISPATCH_WORD] =
    gpu_count_config.histogram_scan_dispatch_word;
  gpu_count_control[CONTROL_HEAD_DISPATCH_WORD] =
    gpu_count_config.head_scan_dispatch_word;
  gpu_count_control[CONTROL_WORD_COUNT] =
    gpu_count_config.control_word_count;
  gpu_count_control[CONTROL_DISPATCH_X_LIMIT] =
    gpu_count_config.dispatch_x_limit;

  write_dispatch(
    gpu_count_config.radix_dispatch_word,
    radix_group_count,
    admitted && live_count > 0u
  );
  prepare_scan(
    gpu_count_config.histogram_scan_count_word,
    gpu_count_config.histogram_scan_dispatch_word,
    gpu_count_config.histogram_scan_level_count,
    histogram_count,
    admitted
  );
  prepare_scan(
    gpu_count_config.head_scan_count_word,
    gpu_count_config.head_scan_dispatch_word,
    gpu_count_config.head_scan_level_count,
    live_count,
    admitted
  );
}
`;

export const webGpuRadixGpuCountScanWgsl = /* wgsl */ `
struct GpuCountScanStatic {
  count_word: u32,
  block_dispatch_word: u32,
  add_dispatch_word: u32,
  _pad0: u32,
};

@group(0) @binding(0) var<storage, read> scan_input: array<u32>;
@group(0) @binding(1) var<storage, read_write> scan_output: array<u32>;
@group(0) @binding(2) var<storage, read_write> scan_block_sums: array<u32>;
@group(0) @binding(3) var<storage, read> scan_parent_offsets: array<u32>;
@group(0) @binding(4) var<storage, read> gpu_count_control: array<u32>;
@group(0) @binding(5) var<uniform> scan_static: GpuCountScanStatic;
@group(0) @binding(6) var<storage, read_write> scan_fused_lower_values: array<u32>;
@group(0) @binding(7) var<uniform> scan_fused_lower_static: GpuCountScanStatic;

const CONTROL_STATUS: u32 = ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.STATUS_FLAGS}u;
const CONTROL_EXPECTED_SEAL: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.EXPECTED_GENERATION_SEAL}u;
const CONTROL_COMPLETION_SEAL: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.COMPLETION_GENERATION_SEAL}u;
const STATUS_ADMITTED: u32 = ${WEBGPU_PARALLEL_PRIMITIVE_STATUS_ADMITTED}u;
const STATUS_FAIL_CLOSED: u32 = ${WEBGPU_PARALLEL_PRIMITIVE_STATUS_FAIL_CLOSED}u;

var<workgroup> scan_values: array<u32, 512>;

fn sealed_count() -> u32 {
  let status = gpu_count_control[CONTROL_STATUS];
  let sealed =
    (status & STATUS_ADMITTED) != 0u
    && (status & STATUS_FAIL_CLOSED) == 0u
    && gpu_count_control[CONTROL_COMPLETION_SEAL]
      == gpu_count_control[CONTROL_EXPECTED_SEAL];
  return select(0u, gpu_count_control[scan_static.count_word], sealed);
}

@compute @workgroup_size(256)
fn scan_gpu_count_blocks(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let count = sealed_count();
  let dispatch_x = gpu_count_control[scan_static.block_dispatch_word];
  let linear_group = workgroup_id.x + workgroup_id.y * dispatch_x;
  let scan_group_count =
    count / 512u + select(0u, 1u, count % 512u != 0u);
  let group_valid = linear_group < scan_group_count;
  let block_base = linear_group * 512u;
  let first = block_base + local_id.x * 2u;
  let second = first + 1u;
  var first_value = 0u;
  var second_value = 0u;
  if (group_valid && first < count) {
    first_value = scan_input[first];
  }
  if (group_valid && second < count) {
    second_value = scan_input[second];
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
    scan_block_sums[linear_group] = scan_values[511u];
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
  if (group_valid && first < count) {
    scan_output[first] = scan_values[local_id.x * 2u];
  }
  if (group_valid && second < count) {
    scan_output[second] = scan_values[local_id.x * 2u + 1u];
  }
}

@compute @workgroup_size(256)
fn add_gpu_count_block_offsets(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let count = sealed_count();
  let dispatch_x = gpu_count_control[scan_static.add_dispatch_word];
  let linear_group = workgroup_id.x + workgroup_id.y * dispatch_x;
  let first = linear_group * 512u + local_id.x * 2u;
  let second = first + 1u;
  if (first >= count) {
    return;
  }
  let block_offset = scan_parent_offsets[linear_group];
  scan_output[first] = scan_output[first] + block_offset;
  if (second < count) {
    scan_output[second] = scan_output[second] + block_offset;
  }
}

// The fixed GPU-count hierarchy retains every possible scan level so a
// GPU-authored live count can select its depth without a readback.  Whenever
// the top live level is one workgroup, that workgroup can scan the top block
// sums and apply the resulting offsets to the already-scanned lower level
// before it exits.  This is the GPU-count counterpart of the direct-count
// scan_top_and_add_lower path: the top dispatch remains indirect, so A=0,
// invalid seals, overflow, and shallower live hierarchies all stay fail-closed.
@compute @workgroup_size(256)
fn scan_gpu_count_top_and_add_lower(
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let count = sealed_count();
  let first = local_id.x * 2u;
  let second = first + 1u;
  var first_value = 0u;
  var second_value = 0u;
  if (first < count) {
    first_value = scan_input[first];
  }
  if (second < count) {
    second_value = scan_input[second];
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
    scan_block_sums[0] = scan_values[511u];
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
  if (first < count) {
    scan_output[first] = scan_values[first];
  }
  if (second < count) {
    scan_output[second] = scan_values[second];
  }

  let lower_status = gpu_count_control[CONTROL_STATUS];
  let lower_sealed =
    (lower_status & STATUS_ADMITTED) != 0u
    && (lower_status & STATUS_FAIL_CLOSED) == 0u
    && gpu_count_control[CONTROL_COMPLETION_SEAL]
      == gpu_count_control[CONTROL_EXPECTED_SEAL];
  let lower_count = select(
    0u,
    gpu_count_control[scan_fused_lower_static.count_word],
    lower_sealed
  );
  for (var lower_index = local_id.x;
    lower_index < lower_count;
    lower_index = lower_index + 256u) {
    let block_index = lower_index / 512u;
    scan_fused_lower_values[lower_index] =
      scan_fused_lower_values[lower_index] + scan_values[block_index];
  }
}
`;

export const webGpuRadixGpuCountWgsl = /* wgsl */ `
struct DigitStatic {
  key_word_index: u32,
  bit_offset: u32,
  _pad0: u32,
  _pad1: u32,
};

@group(0) @binding(0) var<storage, read> radix_keys: array<u32>;
@group(0) @binding(1) var<storage, read> radix_indices_in: array<u32>;
@group(0) @binding(2) var<storage, read_write> radix_indices_out: array<u32>;
@group(0) @binding(3) var<storage, read_write> radix_histograms: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read> radix_histogram_offsets: array<u32>;
@group(0) @binding(5) var<storage, read> gpu_count_control: array<u32>;
@group(0) @binding(6) var<uniform> digit_static: DigitStatic;

const CONTROL_STATUS: u32 = ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.STATUS_FLAGS}u;
const CONTROL_EXPECTED_SEAL: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.EXPECTED_GENERATION_SEAL}u;
const CONTROL_LIVE_COUNT: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.LIVE_ELEMENT_COUNT}u;
const CONTROL_MAX_COUNT: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.MAXIMUM_ELEMENT_COUNT}u;
const CONTROL_KEY_STRIDE: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.KEY_STRIDE_WORDS}u;
const CONTROL_RADIX_GROUP_COUNT: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.RADIX_WORKGROUP_COUNT}u;
const CONTROL_COMPLETION_SEAL: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.COMPLETION_GENERATION_SEAL}u;
const CONTROL_RADIX_DISPATCH_WORD: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.RADIX_DISPATCH_OFFSET_WORDS}u;
const STATUS_ADMITTED: u32 = ${WEBGPU_PARALLEL_PRIMITIVE_STATUS_ADMITTED}u;
const STATUS_FAIL_CLOSED: u32 = ${WEBGPU_PARALLEL_PRIMITIVE_STATUS_FAIL_CLOSED}u;

var<workgroup> local_histogram: array<atomic<u32>, 16>;
var<workgroup> digit_prefix: array<vec4<u32>, 1024>;

fn sealed_count() -> u32 {
  let status = gpu_count_control[CONTROL_STATUS];
  let sealed =
    (status & STATUS_ADMITTED) != 0u
    && (status & STATUS_FAIL_CLOSED) == 0u
    && gpu_count_control[CONTROL_COMPLETION_SEAL]
      == gpu_count_control[CONTROL_EXPECTED_SEAL];
  return select(
    0u,
    min(
      gpu_count_control[CONTROL_LIVE_COUNT],
      gpu_count_control[CONTROL_MAX_COUNT]
    ),
    sealed
  );
}

fn radix_dispatch_x() -> u32 {
  return gpu_count_control[
    gpu_count_control[CONTROL_RADIX_DISPATCH_WORD]
  ];
}

fn record_digit(record_index: u32) -> u32 {
  let key_index =
    record_index * gpu_count_control[CONTROL_KEY_STRIDE]
    + digit_static.key_word_index;
  return (radix_keys[key_index] >> digit_static.bit_offset) & 15u;
}

@compute @workgroup_size(256)
fn initialize_gpu_count_indices(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let count = sealed_count();
  let linear_group =
    workgroup_id.x + workgroup_id.y * radix_dispatch_x();
  let index = linear_group * 256u + local_id.x;
  if (linear_group < gpu_count_control[CONTROL_RADIX_GROUP_COUNT]
    && index < count) {
    radix_indices_out[index] = index;
  }
}

@compute @workgroup_size(256)
fn histogram_gpu_count(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (local_id.x < 16u) {
    atomicStore(&local_histogram[local_id.x], 0u);
  }
  workgroupBarrier();
  let count = sealed_count();
  let workgroup_count =
    gpu_count_control[CONTROL_RADIX_GROUP_COUNT];
  let linear_group =
    workgroup_id.x + workgroup_id.y * radix_dispatch_x();
  let index = linear_group * 256u + local_id.x;
  let group_valid = linear_group < workgroup_count;
  if (group_valid && index < count) {
    let record_index = radix_indices_in[index];
    atomicAdd(&local_histogram[record_digit(record_index)], 1u);
  }
  workgroupBarrier();
  if (group_valid && local_id.x < 16u) {
    let destination =
      local_id.x * workgroup_count + linear_group;
    atomicStore(
      &radix_histograms[destination],
      atomicLoad(&local_histogram[local_id.x])
    );
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
fn scatter_gpu_count(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let count = sealed_count();
  let workgroup_count =
    gpu_count_control[CONTROL_RADIX_GROUP_COUNT];
  let linear_group =
    workgroup_id.x + workgroup_id.y * radix_dispatch_x();
  let index = linear_group * 256u + local_id.x;
  let valid = linear_group < workgroup_count && index < count;
  var record_index = 0u;
  var digit = 0u;
  if (valid) {
    record_index = radix_indices_in[index];
    digit = record_digit(record_index);
  }
  let prefix_base = local_id.x * 4u;
  for (var quad = 0u; quad < 4u; quad = quad + 1u) {
    digit_prefix[prefix_base + quad] =
      select(vec4<u32>(0u), one_hot_quad(digit, quad), valid);
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
    digit_prefix[prefix_base + 1u] =
      digit_prefix[prefix_base + 1u] + add1;
    digit_prefix[prefix_base + 2u] =
      digit_prefix[prefix_base + 2u] + add2;
    digit_prefix[prefix_base + 3u] =
      digit_prefix[prefix_base + 3u] + add3;
    workgroupBarrier();
  }

  if (valid) {
    let inclusive_rank =
      digit_prefix[prefix_base + digit / 4u][digit & 3u];
    let group_base = radix_histogram_offsets[
      digit * workgroup_count + linear_group
    ];
    radix_indices_out[group_base + inclusive_rank - 1u] =
      record_index;
  }
}
`;

export const webGpuRadixGpuCountUniqueWgsl = /* wgsl */ `
@group(0) @binding(0) var<storage, read> unique_source_keys: array<u32>;
@group(0) @binding(1) var<storage, read> unique_sorted_indices: array<u32>;
@group(0) @binding(2) var<storage, read_write> unique_head_flags: array<u32>;
@group(0) @binding(3) var<storage, read> unique_head_offsets: array<u32>;
@group(0) @binding(4) var<storage, read_write> unique_output_keys: array<u32>;
@group(0) @binding(5) var<storage, read_write> unique_output_offsets: array<u32>;
@group(0) @binding(6) var<storage, read_write> unique_evidence: array<u32>;
@group(0) @binding(7) var<storage, read_write> unique_dispatch: array<u32>;
@group(0) @binding(8) var<storage, read> gpu_count_control: array<u32>;
@group(0) @binding(9) var<storage, read> gpu_count_authority: array<u32>;

const CONTROL_STATUS: u32 = ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.STATUS_FLAGS}u;
const CONTROL_EXPECTED_SEAL: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.EXPECTED_GENERATION_SEAL}u;
const CONTROL_LIVE_COUNT: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.LIVE_ELEMENT_COUNT}u;
const CONTROL_KEY_WORD_COUNT: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.KEY_WORD_COUNT}u;
const CONTROL_KEY_STRIDE: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.KEY_STRIDE_WORDS}u;
const CONTROL_CONSUMER_WORKGROUP_SIZE: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.CONSUMER_WORKGROUP_SIZE}u;
const CONTROL_GENERATION_ID: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.GENERATION_ID}u;
const CONTROL_AUTHORITY_COUNT_WORD: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.AUTHORITY_COUNT_OFFSET_WORDS}u;
const CONTROL_AUTHORITY_SEAL_WORD: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.AUTHORITY_SEAL_OFFSET_WORDS}u;
const CONTROL_COMPLETION_SEAL: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.COMPLETION_GENERATION_SEAL}u;
const CONTROL_RADIX_DISPATCH_WORD: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.RADIX_DISPATCH_OFFSET_WORDS}u;
const CONTROL_DISPATCH_X_LIMIT: u32 =
  ${WEBGPU_RADIX_GPU_COUNT_CONTROL_WORD.DISPATCH_X_LIMIT}u;
const STATUS_ADMITTED: u32 = ${WEBGPU_PARALLEL_PRIMITIVE_STATUS_ADMITTED}u;
const STATUS_FAIL_CLOSED: u32 = ${WEBGPU_PARALLEL_PRIMITIVE_STATUS_FAIL_CLOSED}u;
const STATUS_INVALID_SEAL: u32 = ${WEBGPU_PARALLEL_PRIMITIVE_STATUS_INVALID_SEAL}u;
const STATUS_COUNT_OVERFLOW: u32 =
  ${WEBGPU_PARALLEL_PRIMITIVE_STATUS_COUNT_OVERFLOW}u;

fn sealed_count() -> u32 {
  let status = gpu_count_control[CONTROL_STATUS];
  let sealed =
    (status & STATUS_ADMITTED) != 0u
    && (status & STATUS_FAIL_CLOSED) == 0u
    && gpu_count_control[CONTROL_COMPLETION_SEAL]
      == gpu_count_control[CONTROL_EXPECTED_SEAL];
  return select(0u, gpu_count_control[CONTROL_LIVE_COUNT], sealed);
}

fn radix_dispatch_x() -> u32 {
  return gpu_count_control[
    gpu_count_control[CONTROL_RADIX_DISPATCH_WORD]
  ];
}

fn keys_equal(left_record: u32, right_record: u32) -> bool {
  let stride = gpu_count_control[CONTROL_KEY_STRIDE];
  let left_base = left_record * stride;
  let right_base = right_record * stride;
  for (
    var word = 0u;
    word < gpu_count_control[CONTROL_KEY_WORD_COUNT];
    word = word + 1u
  ) {
    if (unique_source_keys[left_base + word]
      != unique_source_keys[right_base + word]) {
      return false;
    }
  }
  return true;
}

@compute @workgroup_size(256)
fn mark_gpu_count_heads(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let count = sealed_count();
  let linear_group =
    workgroup_id.x + workgroup_id.y * radix_dispatch_x();
  let index = linear_group * 256u + local_id.x;
  if (index >= count) {
    return;
  }
  if (index == 0u) {
    unique_head_flags[index] = 1u;
    return;
  }
  let current = unique_sorted_indices[index];
  let previous = unique_sorted_indices[index - 1u];
  unique_head_flags[index] =
    select(1u, 0u, keys_equal(current, previous));
}

@compute @workgroup_size(256)
fn scatter_gpu_count_unique(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let count = sealed_count();
  let linear_group =
    workgroup_id.x + workgroup_id.y * radix_dispatch_x();
  let sorted_position = linear_group * 256u + local_id.x;
  if (sorted_position >= count
    || unique_head_flags[sorted_position] == 0u) {
    return;
  }
  let unique_index = unique_head_offsets[sorted_position];
  let source_record = unique_sorted_indices[sorted_position];
  let key_word_count =
    gpu_count_control[CONTROL_KEY_WORD_COUNT];
  let source_base =
    source_record * gpu_count_control[CONTROL_KEY_STRIDE];
  let output_base = unique_index * key_word_count;
  for (var word = 0u; word < key_word_count; word = word + 1u) {
    unique_output_keys[output_base + word] =
      unique_source_keys[source_base + word];
  }
  unique_output_offsets[unique_index] = sorted_position;
}

fn write_consumer_dispatch(unique_count: u32, admitted: bool) {
  if (!admitted || unique_count == 0u) {
    unique_dispatch[0u] = 0u;
    unique_dispatch[1u] = 0u;
    unique_dispatch[2u] = 0u;
    return;
  }
  let consumer_width =
    gpu_count_control[CONTROL_CONSUMER_WORKGROUP_SIZE];
  let group_count =
    unique_count / consumer_width
    + select(0u, 1u, unique_count % consumer_width != 0u);
  let dispatch_limit =
    gpu_count_control[CONTROL_DISPATCH_X_LIMIT];
  let dispatch_x = min(group_count, dispatch_limit);
  let dispatch_y =
    group_count / dispatch_x
    + select(0u, 1u, group_count % dispatch_x != 0u);
  let shape_admitted = dispatch_y <= dispatch_limit;
  unique_dispatch[0u] = select(0u, dispatch_x, shape_admitted);
  unique_dispatch[1u] = select(0u, dispatch_y, shape_admitted);
  unique_dispatch[2u] = select(0u, 1u, shape_admitted);
}

@compute @workgroup_size(1)
fn finalize_gpu_count_unique() {
  let expected_seal =
    gpu_count_control[CONTROL_EXPECTED_SEAL];
  let authority_count = gpu_count_authority[
    gpu_count_control[CONTROL_AUTHORITY_COUNT_WORD]
  ];
  let authority_seal = gpu_count_authority[
    gpu_count_control[CONTROL_AUTHORITY_SEAL_WORD]
  ];
  var status = gpu_count_control[CONTROL_STATUS];
  let preflight_admitted =
    (status & STATUS_ADMITTED) != 0u
    && (status & STATUS_FAIL_CLOSED) == 0u;
  let authority_stable =
    authority_seal == expected_seal
    && authority_count == gpu_count_control[CONTROL_LIVE_COUNT]
    && gpu_count_control[CONTROL_COMPLETION_SEAL] == expected_seal;
  let admitted = preflight_admitted && authority_stable;
  if (preflight_admitted && !authority_stable) {
    status =
      (status & (~STATUS_ADMITTED))
      | STATUS_FAIL_CLOSED
      | STATUS_INVALID_SEAL;
  }

  let count = select(
    0u,
    gpu_count_control[CONTROL_LIVE_COUNT],
    admitted
  );
  var unique_count = 0u;
  if (count > 0u) {
    let last = count - 1u;
    unique_count =
      unique_head_offsets[last] + unique_head_flags[last];
  }
  unique_output_offsets[unique_count] = count;
  unique_evidence[0u] =
    gpu_count_control[CONTROL_GENERATION_ID];
  unique_evidence[1u] = select(authority_count, count, admitted);
  unique_evidence[2u] = unique_count;
  unique_evidence[3u] = select(0u, 1u, admitted);
  unique_evidence[4u] = select(
    0u,
    1u,
    (status & STATUS_COUNT_OVERFLOW) != 0u
  );
  unique_evidence[5u] =
    gpu_count_control[CONTROL_KEY_WORD_COUNT];
  unique_evidence[6u] =
    gpu_count_control[CONTROL_KEY_STRIDE];
  unique_evidence[7u] = status;
  write_consumer_dispatch(unique_count, admitted);
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

// Radix key widths, element capacities, and law/material identities are all
// runtime data. These fixed descriptors are therefore one physical pipeline
// bundle per WebGPU device, shared by every scan and radix runtime. Keeping
// role-specific names on buffers/passes (rather than pipeline cache identity)
// lets capture/direct/summary placement arenas reuse the same nine programs.
export function webGpuStableRadixPipelineDescriptors() {
  const descriptor = ({ cacheKey, label, code, entryPoint }) =>
    Object.freeze({
      cacheKey,
      label,
      code,
      entryPoint,
      bindings: Object.freeze([])
    });
  return Object.freeze({
    schema: 'peercompute.ulg.webgpu-stable-radix-pipeline-descriptors.v0',
    scanBlocks: descriptor({
      cacheKey: 'ulg-webgpu-u32-exclusive-scan.v1',
      label: 'ulg-webgpu-u32-exclusive-scan-blocks',
      code: webGpuU32ExclusiveScanWgsl,
      entryPoint: 'scan_blocks'
    }),
    scanAdd: descriptor({
      cacheKey: 'ulg-webgpu-u32-exclusive-scan.v1',
      label: 'ulg-webgpu-u32-exclusive-scan-add-block-offsets',
      code: webGpuU32ExclusiveScanWgsl,
      entryPoint: 'add_scanned_block_offsets'
    }),
    scanFusedTopAdd: descriptor({
      cacheKey: 'ulg-webgpu-u32-exclusive-scan.v1',
      label: 'ulg-webgpu-u32-exclusive-scan-fused-top-add',
      code: webGpuU32ExclusiveScanWgsl,
      entryPoint: 'scan_top_and_add_lower'
    }),
    initialize: descriptor({
      cacheKey: 'ulg-webgpu-stable-radix.v1',
      label: 'ulg-webgpu-stable-radix-initialize',
      code: webGpuStableRadixWgsl,
      entryPoint: 'initialize_indices'
    }),
    histogram: descriptor({
      cacheKey: 'ulg-webgpu-stable-radix.v1',
      label: 'ulg-webgpu-stable-radix-histogram',
      code: webGpuStableRadixWgsl,
      entryPoint: 'histogram'
    }),
    scatter: descriptor({
      cacheKey: 'ulg-webgpu-stable-radix.v1',
      label: 'ulg-webgpu-stable-radix-scatter',
      code: webGpuStableRadixWgsl,
      entryPoint: 'scatter'
    }),
    markHeads: descriptor({
      cacheKey: 'ulg-webgpu-sorted-unique.v1',
      label: 'ulg-webgpu-sorted-unique-mark-heads',
      code: webGpuSortedUniqueWgsl,
      entryPoint: 'mark_heads'
    }),
    scatterUnique: descriptor({
      cacheKey: 'ulg-webgpu-sorted-unique.v1',
      label: 'ulg-webgpu-sorted-unique-scatter',
      code: webGpuSortedUniqueWgsl,
      entryPoint: 'scatter_unique'
    }),
    finalizeUnique: descriptor({
      cacheKey: 'ulg-webgpu-sorted-unique.v1',
      label: 'ulg-webgpu-sorted-unique-finalize',
      code: webGpuSortedUniqueWgsl,
      entryPoint: 'finalize_unique'
    }),
    serialHistogramScan: descriptor({
      cacheKey: 'ulg-webgpu-serial-radix-histogram-scan.v1',
      label: 'ulg-webgpu-serial-radix-histogram-scan',
      code: webGpuSerialRadixHistogramScanWgsl,
      entryPoint: 'scan_histogram_serial'
    })
  });
}

export function enumerateWebGpuStableRadixPrewarmPipelineDescriptors({
  includeSerialHistogramScan = false
} = {}) {
  const table = webGpuStableRadixPipelineDescriptors();
  return [
    table.scanBlocks,
    table.scanAdd,
    table.scanFusedTopAdd,
    table.initialize,
    table.histogram,
    table.scatter,
    table.markHeads,
    table.scatterUnique,
    table.finalizeUnique,
    ...(includeSerialHistogramScan ? [table.serialHistogramScan] : [])
  ];
}

function createScanPipelines(device, _label) {
  const descriptors = webGpuStableRadixPipelineDescriptors();
  return {
    scan: createCachedExplicitComputePipeline(
      device,
      descriptors.scanBlocks
    ).pipeline,
    add: createCachedExplicitComputePipeline(
      device,
      descriptors.scanAdd
    ).pipeline,
    fusedTopAdd: createCachedExplicitComputePipeline(
      device,
      descriptors.scanFusedTopAdd
    ).pipeline
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
  const construction = createOwnedBufferConstruction();
  try {
  const pipelines = createScanPipelines(device, label);
  const persistentParamsBuffer = retainParamsBuffer
    ? construction.ownBuffer(device.createBuffer({
        label: `${label}-params-retained`,
        size: retainedParamsSlotStrideBytes * resolvedRetainedParamsSlotCount,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      }))
    : null;
  const blockSums = maxPlan.levels.map((level) => construction.ownBuffer(createBuffer(
    device,
    `${label}-level-${level.level}-block-sums`,
    level.groupCount
  )));
  const blockOffsets = maxPlan.levels.map((level) => level.groupCount > 1
    ? construction.ownBuffer(createBuffer(
        device,
        `${label}-level-${level.level}-block-offsets`,
        level.groupCount
      ))
    : null);
  const transients = new Set();
  const retainedPreparedScans = persistentParamsBuffer ? new WeakMap() : null;
  const retainedParamsLastCount = Array.from(
    { length: resolvedRetainedParamsSlotCount },
    () => null
  );
  const retainedVariableParamsLeaseOwner = {};
  const retainedVariableParamsLeaseByPrepared = new WeakMap();
  const ownedPreparedScans = new WeakSet();
  const releasedPreparedScans = new WeakSet();
  const ownedTransientBuffersByPrepared = new WeakMap();
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

  function canFinalizePrepared(value) {
    if (
      destroyed
      || !value
      || typeof value !== 'object'
      || !ownedPreparedScans.has(value)
      || releasedPreparedScans.has(value)
    ) return false;
    const lease = value && typeof value === 'object'
      ? retainedVariableParamsLeaseByPrepared.get(value) ?? null
      : null;
    return retainedVariableParamsSlots === null
      || lease?.owner === retainedVariableParamsLeaseOwner;
  }

  function releasePreparedLease(value) {
    if (!canFinalizePrepared(value)) return false;
    const lease = retainedVariableParamsLeaseByPrepared.get(value) ?? null;
    if (lease && lease.release() !== true) return false;
    if (lease) retainedVariableParamsLeaseByPrepared.delete(value);
    releasedPreparedScans.add(value);
    return true;
  }

  function destroyPreparedTransientBufferSnapshot(ownedBuffers) {
    const ownedTransientBuffers = [];
    for (const buffer of ownedBuffers || []) {
      if (!transients.has(buffer)) continue;
      transients.delete(buffer);
      ownedTransientBuffers.push(buffer);
    }
    destroyBuffersExactlyOnce(ownedTransientBuffers);
  }

  function finalizePrepared(value, {
    destroyTransientBuffers = true,
    ownedTransientBuffers = null
  } = {}) {
    if (!canFinalizePrepared(value)) return false;
    const authenticatedTransientBuffers = ownedTransientBuffers
      ?? ownedTransientBuffersByPrepared.get(value)
      ?? Object.freeze([]);
    const released = releasePreparedLease(value);
    if (!released) return false;
    ownedTransientBuffersByPrepared.delete(value);
    if (destroyTransientBuffers) {
      destroyPreparedTransientBufferSnapshot(authenticatedTransientBuffers);
    }
    return true;
  }

  function releasePrepared(value, { discardedEncoder = false } = {}) {
    if (!canFinalizePrepared(value)) return false;
    if (discardedEncoder !== true) {
      throw new TypeError(
        `${label} releasePrepared requires { discardedEncoder: true }; `
        + 'use releasePreparedAfter with a submission-fence thenable after submission'
      );
    }
    return finalizePrepared(value);
  }

  function releasePreparedAfter(value, submissionFence) {
    const authenticatedTransientBuffers = canFinalizePrepared(value)
      ? ownedTransientBuffersByPrepared.get(value) ?? Object.freeze([])
      : null;
    const fencePromise = exactThenablePromise(
      submissionFence,
      'submissionFence must be a thenable that resolves after GPU completion'
    );
    return fencePromise.then(() => (
      authenticatedTransientBuffers === null
        ? false
        : finalizePrepared(value, {
            ownedTransientBuffers: authenticatedTransientBuffers
          })
    ));
  }

  function canReleasePreparedQueueOrdered(value) {
    return persistentParamsBuffer !== null && canFinalizePrepared(value);
  }

  function releasePreparedQueueOrdered(value) {
    if (!canReleasePreparedQueueOrdered(value)) return false;
    return finalizePrepared(value, { destroyTransientBuffers: false });
  }

  function releasePreparedResources(value, options = {}) {
    if (!canFinalizePrepared(value)) return false;
    const lease = retainedVariableParamsLeaseByPrepared.get(value) ?? null;
    if (lease?.owner === retainedVariableParamsLeaseOwner && options.discardedEncoder !== true) {
      throw new TypeError(
        `${label} retained variable params require { discardedEncoder: true }; `
        + 'use releasePreparedAfter with a submission-fence thenable after submission'
      );
    }
    return finalizePrepared(value);
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
    let transientParamsBuffer = null;
    let retainedVariableParamsSlotLease = null;
    try {
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
    if (!persistentParamsBuffer) {
      transients.add(paramsBuffer);
      transientParamsBuffer = paramsBuffer;
    }

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
    retainedVariableParamsSlotLease = acquireRetainedVariableParamsSlot(resolvedSlotIndex);
      if (paramsWritePerformed) {
        device.queue.writeBuffer(paramsBuffer, paramsBaseOffset, paramsData);
        if (persistentParamsBuffer) retainedParamsLastCount[resolvedSlotIndex] = resolvedCount;
      }
      const ownedTransientBuffers = Object.freeze(
        persistentParamsBuffer ? [] : [paramsBuffer]
      );
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
        transientBuffers: [...ownedTransientBuffers],
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
      ownedTransientBuffersByPrepared.set(prepared, ownedTransientBuffers);
      ownedPreparedScans.add(prepared);
      return prepared;
    } catch (error) {
      retainedVariableParamsSlotLease?.release();
      if (transientParamsBuffer && transients.delete(transientParamsBuffer)) {
        destroyBuffersExactlyOnce([transientParamsBuffer]);
      }
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
        finalizePrepared(prepared);
        throw error;
      }
    },
    releasePrepared,
    releasePreparedAfter,
    canReleasePreparedQueueOrdered,
    releasePreparedQueueOrdered,
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
      destroyBuffersExactlyOnce([
        persistentParamsBuffer,
        ...blockSums,
        ...blockOffsets,
        ...transients
      ]);
      transients.clear();
      retainedParamsLastCount.fill(null);
      for (const slot of retainedVariableParamsSlots || []) slot.inUse = false;
    }
  };
  WEBGPU_SCAN_RUNTIME_INTERNALS.set(runtime, {
    hasPreparedLease(value) {
      return retainedVariableParamsLeaseByPrepared.has(value);
    },
    releasePreparedLease,
    finalizePreparedFromParent(value) {
      return finalizePrepared(value);
    }
  });
  construction.commit();
  return runtime;
  } catch (error) {
    construction.rollback();
    throw error;
  }
}

function createRadixPipelines(
  device,
  _label,
  { serialHistogramScanEnabled = false } = {}
) {
  const descriptors = webGpuStableRadixPipelineDescriptors();
  const pipeline = (descriptor) =>
    createCachedExplicitComputePipeline(device, descriptor).pipeline;
  return {
    initialize: pipeline(descriptors.initialize),
    histogram: pipeline(descriptors.histogram),
    scatter: pipeline(descriptors.scatter),
    ...(serialHistogramScanEnabled
      ? {
          serialHistogramScan: pipeline(descriptors.serialHistogramScan)
        }
      : {}),
    markHeads: pipeline(descriptors.markHeads),
    scatterUnique: pipeline(descriptors.scatterUnique),
    finalizeUnique: pipeline(descriptors.finalizeUnique)
  };
}

function createRadixGpuCountPipelines(device, label) {
  const prepareModule = device.createShaderModule({
    label: `${label}-gpu-count-prepare-shader`,
    code: webGpuRadixGpuCountPrepareWgsl
  });
  const scanModule = device.createShaderModule({
    label: `${label}-gpu-count-scan-shader`,
    code: webGpuRadixGpuCountScanWgsl
  });
  const radixModule = device.createShaderModule({
    label: `${label}-gpu-count-radix-shader`,
    code: webGpuRadixGpuCountWgsl
  });
  const uniqueModule = device.createShaderModule({
    label: `${label}-gpu-count-unique-shader`,
    code: webGpuRadixGpuCountUniqueWgsl
  });
  const pipeline = (suffix, module, entryPoint) => device.createComputePipeline({
    label: `${label}-gpu-count-${suffix}`,
    layout: 'auto',
    compute: { module, entryPoint }
  });
  return {
    prepare: pipeline('prepare', prepareModule, 'prepare_gpu_count'),
    scanBlocks: pipeline('scan-blocks', scanModule, 'scan_gpu_count_blocks'),
    scanAdd: pipeline('scan-add', scanModule, 'add_gpu_count_block_offsets'),
    scanFusedTopAdd: pipeline(
      'scan-fused-top-add',
      scanModule,
      'scan_gpu_count_top_and_add_lower'
    ),
    initialize: pipeline(
      'initialize',
      radixModule,
      'initialize_gpu_count_indices'
    ),
    histogram: pipeline('histogram', radixModule, 'histogram_gpu_count'),
    scatter: pipeline('scatter', radixModule, 'scatter_gpu_count'),
    markHeads: pipeline('mark-heads', uniqueModule, 'mark_gpu_count_heads'),
    scatterUnique: pipeline(
      'scatter-unique',
      uniqueModule,
      'scatter_gpu_count_unique'
    ),
    finalizeUnique: pipeline(
      'finalize-unique',
      uniqueModule,
      'finalize_gpu_count_unique'
    )
  };
}

export function createWebGpuStableRadixScanUnique(device, {
  maxElementCount,
  maxKeyWordCount = WEBGPU_RADIX_MAX_KEY_WORDS,
  label = 'ulg-webgpu-radix-unique',
  maxComputeWorkgroupsPerDimension: requestedMaxComputeWorkgroupsPerDimension = null,
  retainConstantScanParamsBuffers = false,
  retainVariableScanParamsBuffers = false,
  serialHistogramScanMaxElementCount = 0,
  retainedParamsSlotCount = WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_DEFAULT
} = {}) {
  assertDevice(device);
  const resolvedMaxElementCount = positiveInteger(maxElementCount, 'maxElementCount', {
    max: 0xffffffff
  });
  const resolvedMaxKeyWordCount = positiveInteger(maxKeyWordCount, 'maxKeyWordCount', {
    max: WEBGPU_RADIX_MAX_KEY_WORDS
  });
  const resolvedSerialHistogramScanMaxElementCount = nonNegativeInteger(
    serialHistogramScanMaxElementCount,
    'serialHistogramScanMaxElementCount',
    { max: 0xffffffff }
  );
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
  const gpuCountControlLayout = createWebGpuRadixGpuCountControlLayout({
    maxElementCount: resolvedMaxElementCount,
    maxComputeWorkgroupsPerDimension
  });
  const construction = createOwnedBufferConstruction();
  try {
  const pipelines = createRadixPipelines(device, label, {
    serialHistogramScanEnabled: resolvedSerialHistogramScanMaxElementCount > 0
  });
  const sortedIndicesA = construction.ownBuffer(createBuffer(
    device,
    `${label}-sorted-indices-a`,
    resolvedMaxElementCount
  ));
  const sortedIndicesB = construction.ownBuffer(createBuffer(
    device,
    `${label}-sorted-indices-b`,
    resolvedMaxElementCount
  ));
  const histogramBuffer = construction.ownBuffer(createBuffer(
    device,
    `${label}-histograms`,
    maxHistogramElements
  ));
  const histogramOffsetsBuffer = construction.ownBuffer(createBuffer(
    device,
    `${label}-histogram-offsets`,
    maxHistogramElements
  ));
  const headFlagsBuffer = construction.ownBuffer(createBuffer(
    device,
    `${label}-head-flags`,
    resolvedMaxElementCount
  ));
  const headOffsetsBuffer = construction.ownBuffer(createBuffer(
    device,
    `${label}-head-offsets`,
    resolvedMaxElementCount
  ));
  const uniqueKeysBuffer = construction.ownBuffer(createBuffer(
    device,
    `${label}-unique-keys`,
    resolvedMaxElementCount * resolvedMaxKeyWordCount
  ));
  const uniqueOffsetsBuffer = construction.ownBuffer(createBuffer(
    device,
    `${label}-unique-offsets`,
    resolvedMaxElementCount + 1
  ));
  const evidenceBuffer = construction.ownBuffer(createBuffer(
    device,
    `${label}-evidence`,
    8
  ));
  const dispatchIndirectBuffer = construction.ownBuffer(createBuffer(
    device,
    `${label}-dispatch-indirect`,
    3,
    GPU_BUFFER_USAGE.INDIRECT
  ));
  const radixParamsArena = retainControlParams
    ? construction.ownBuffer(device.createBuffer({
        label: `${label}-radix-params-retained-arena`,
        size: checkedArenaByteLength(radixParamsSlotStrideBytes, 'radix'),
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      }))
    : null;
  const uniqueParamsArena = retainControlParams
    ? construction.ownBuffer(device.createBuffer({
        label: `${label}-unique-params-retained-arena`,
        size: checkedArenaByteLength(uniqueParamsSlotStrideBytes, 'unique'),
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      }))
    : null;
  const histogramScan = construction.ownRuntime(createWebGpuU32ExclusiveScan(device, {
    maxElementCount: maxHistogramElements,
    label: `${label}-histogram-scan`,
    maxComputeWorkgroupsPerDimension,
    retainParamsBuffer: retainConstantScanParamsBuffers,
    fixedElementCount: retainVariableScanParamsBuffers ? null : maxHistogramElements,
    retainedParamsSlotCount: retainVariableScanParamsBuffers
      ? (resolvedRetainedParamsSlotCount || 1)
      : 1
  }));
  const headScan = construction.ownRuntime(createWebGpuU32ExclusiveScan(device, {
    maxElementCount: resolvedMaxElementCount,
    label: `${label}-head-scan`,
    maxComputeWorkgroupsPerDimension,
    retainParamsBuffer: retainConstantScanParamsBuffers,
    fixedElementCount: retainVariableScanParamsBuffers ? null : resolvedMaxElementCount,
    retainedParamsSlotCount: retainVariableScanParamsBuffers
      ? (resolvedRetainedParamsSlotCount || 1)
      : 1
  }));
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
  const ownedTransientBuffersByExecution = new WeakMap();
  const childPreparedScansByExecution = new WeakMap();
  let gpuCountResources = null;
  let destroyed = false;

  function ensureGpuCountResources() {
    if (gpuCountResources) return gpuCountResources;
    if (destroyed) throw new Error(`${label} is destroyed`);
    const resourceConstruction = createOwnedBufferConstruction();
    try {
    const gpuCountPipelines = createRadixGpuCountPipelines(device, label);
    const controlBuffer = resourceConstruction.ownBuffer(createBuffer(
      device,
      `${label}-gpu-count-control`,
      gpuCountControlLayout.controlWordCount,
      GPU_BUFFER_USAGE.INDIRECT
    ));
    // The radix output, histograms, scan scratch, evidence, and control row are
    // shared. One retained config row therefore deliberately enforces the
    // primitive's single-flight ownership contract.
    const gpuCountConfigSlotCount = 1;
    const gpuCountConfigArenaByteLength =
      gpuCountConfigSlotCount * paramsOffsetAlignment;
    if (!Number.isSafeInteger(gpuCountConfigArenaByteLength)
      || gpuCountConfigArenaByteLength > maxBufferSize) {
      throw new RangeError(
        `${label} GPU-count config arena requires `
        + `${gpuCountConfigArenaByteLength} bytes beyond device capacity`
      );
    }
    const configArena = resourceConstruction.ownBuffer(device.createBuffer({
      label: `${label}-gpu-count-config-retained-arena`,
      size: gpuCountConfigArenaByteLength,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    }));
    const configSlots = Array.from(
      { length: gpuCountConfigSlotCount },
      (_, slotIndex) => ({
        slotIndex,
        byteOffset: slotIndex * paramsOffsetAlignment,
        inUse: false,
        bindGroups: new Map()
      })
    );
    const digitStaticBuffer = resourceConstruction.ownBuffer(device.createBuffer({
      label: `${label}-gpu-count-digit-static`,
      size: maxRadixPassCount * paramsOffsetAlignment,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    }));
    const digitStaticData = new Uint32Array(
      maxRadixPassCount * paramsOffsetAlignment / UINT32_BYTES
    );
    let digitRow = 0;
    for (let word = resolvedMaxKeyWordCount - 1; word >= 0; word -= 1) {
      for (let shift = 0; shift < 32; shift += WEBGPU_RADIX_BITS_PER_PASS) {
        const base = digitRow * paramsOffsetAlignment / UINT32_BYTES;
        digitStaticData[base] = word;
        digitStaticData[base + 1] = shift;
        digitRow += 1;
      }
    }
    device.queue.writeBuffer(digitStaticBuffer, 0, digitStaticData);

    const totalScanStaticRows =
      gpuCountControlLayout.histogramScanLevelCount
      + gpuCountControlLayout.headScanLevelCount;
    const scanStaticBuffer = resourceConstruction.ownBuffer(device.createBuffer({
      label: `${label}-gpu-count-scan-static`,
      size: totalScanStaticRows * paramsOffsetAlignment,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    }));
    const scanStaticData = new Uint32Array(
      totalScanStaticRows * paramsOffsetAlignment / UINT32_BYTES
    );
    let scanStaticRow = 0;
    const writeScanStaticRows = (
      countOffsetWords,
      dispatchOffsetWords,
      levelCount
    ) => {
      const firstRow = scanStaticRow;
      for (let level = 0; level < levelCount; level += 1) {
        const base = scanStaticRow * paramsOffsetAlignment / UINT32_BYTES;
        scanStaticData[base] = countOffsetWords + level;
        scanStaticData[base + 1] = dispatchOffsetWords + level * 6;
        scanStaticData[base + 2] = dispatchOffsetWords + level * 6 + 3;
        scanStaticRow += 1;
      }
      return firstRow;
    };
    const histogramStaticFirstRow = writeScanStaticRows(
      gpuCountControlLayout.histogramScanCountOffsetWords,
      gpuCountControlLayout.histogramScanDispatchOffsetWords,
      gpuCountControlLayout.histogramScanLevelCount
    );
    const headStaticFirstRow = writeScanStaticRows(
      gpuCountControlLayout.headScanCountOffsetWords,
      gpuCountControlLayout.headScanDispatchOffsetWords,
      gpuCountControlLayout.headScanLevelCount
    );
    device.queue.writeBuffer(scanStaticBuffer, 0, scanStaticData);

    const allocationEntries = [
      { role: 'radix-gpu-count-control', buffer: controlBuffer },
      { role: 'radix-gpu-count-config-retained-arena', buffer: configArena },
      { role: 'radix-gpu-count-digit-static', buffer: digitStaticBuffer },
      { role: 'radix-gpu-count-scan-static', buffer: scanStaticBuffer }
    ];
    const createScanPopulation = ({
      prefix,
      maximumElementCount,
      levelCount,
      countOffsetWords,
      dispatchOffsetWords,
      firstStaticRow,
      sourceInputBuffer,
      sourceOutputBuffer
    }) => {
      const sums = [];
      const offsets = [];
      const levelMaximumElementCounts = [];
      let count = maximumElementCount;
      for (let level = 0; level < levelCount; level += 1) {
        levelMaximumElementCounts.push(count);
        const groupCount = groupCountFor(count);
        const sumsBuffer = resourceConstruction.ownBuffer(createBuffer(
          device,
          `${label}-gpu-count-${prefix}-level-${level}-sums`,
          groupCount
        ));
        const offsetsBuffer = resourceConstruction.ownBuffer(createBuffer(
          device,
          `${label}-gpu-count-${prefix}-level-${level}-offsets`,
          groupCount
        ));
        sums.push(sumsBuffer);
        offsets.push(offsetsBuffer);
        allocationEntries.push(
          { role: `radix-gpu-count-${prefix}-scan-sums`, buffer: sumsBuffer },
          { role: `radix-gpu-count-${prefix}-scan-offsets`, buffer: offsetsBuffer }
        );
        count = groupCount;
      }
      const fusedTopLevelIndex = levelCount >= 2
        && levelMaximumElementCounts[levelCount - 2]
          <= WEBGPU_SCAN_FUSED_TOP_ADD_MAX_ELEMENT_COUNT
        ? levelCount - 1
        : null;
      const levels = [];
      for (let level = 0; level < levelCount; level += 1) {
        const inputBuffer = level === 0 ? sourceInputBuffer : sums[level - 1];
        const outputBuffer = level === 0 ? sourceOutputBuffer : offsets[level - 1];
        const staticOffset =
          (firstStaticRow + level) * paramsOffsetAlignment;
        const blockBindGroup = device.createBindGroup({
          label: `${label}-gpu-count-${prefix}-scan-block-${level}`,
          layout: gpuCountPipelines.scanBlocks.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: inputBuffer } },
            { binding: 1, resource: { buffer: outputBuffer } },
            { binding: 2, resource: { buffer: sums[level] } },
            { binding: 4, resource: { buffer: controlBuffer } },
            {
              binding: 5,
              resource: {
                buffer: scanStaticBuffer,
                offset: staticOffset,
                size: 16
              }
            }
          ]
        });
        const addBindGroup = device.createBindGroup({
          label: `${label}-gpu-count-${prefix}-scan-add-${level}`,
          layout: gpuCountPipelines.scanAdd.getBindGroupLayout(0),
          entries: [
            { binding: 1, resource: { buffer: outputBuffer } },
            { binding: 3, resource: { buffer: offsets[level] } },
            { binding: 4, resource: { buffer: controlBuffer } },
            {
              binding: 5,
              resource: {
                buffer: scanStaticBuffer,
                offset: staticOffset,
                size: 16
              }
            }
          ]
        });
        const fusedTopAddBindGroup = level === fusedTopLevelIndex
          ? device.createBindGroup({
              label: `${label}-gpu-count-${prefix}-scan-fused-top-${level}`,
              layout:
                gpuCountPipelines.scanFusedTopAdd.getBindGroupLayout(0),
              entries: [
                { binding: 0, resource: { buffer: inputBuffer } },
                { binding: 1, resource: { buffer: outputBuffer } },
                { binding: 2, resource: { buffer: sums[level] } },
                { binding: 4, resource: { buffer: controlBuffer } },
                {
                  binding: 5,
                  resource: {
                    buffer: scanStaticBuffer,
                    offset: staticOffset,
                    size: 16
                  }
                },
                {
                  binding: 6,
                  resource: {
                    buffer: level === 1
                      ? sourceOutputBuffer
                      : offsets[level - 2]
                  }
                },
                {
                  binding: 7,
                  resource: {
                    buffer: scanStaticBuffer,
                    offset:
                      (firstStaticRow + level - 1)
                        * paramsOffsetAlignment,
                    size: 16
                  }
                }
              ]
            })
          : null;
        levels.push(Object.freeze({
          level,
          maximumElementCount: levelMaximumElementCounts[level],
          countOffsetWords: countOffsetWords + level,
          blockDispatchOffsetWords: dispatchOffsetWords + level * 6,
          blockDispatchOffsetBytes:
            (dispatchOffsetWords + level * 6) * UINT32_BYTES,
          addDispatchOffsetWords: dispatchOffsetWords + level * 6 + 3,
          addDispatchOffsetBytes:
            (dispatchOffsetWords + level * 6 + 3) * UINT32_BYTES,
          blockBindGroup,
          addBindGroup,
          fusedTopAddBindGroup
        }));
      }
      return Object.freeze({
        levels,
        fusedTopLevelIndex,
        fusedTopAddEnabled: fusedTopLevelIndex !== null,
        encodedDispatchCount:
          levels.length * 2 - 1 - (fusedTopLevelIndex === null ? 0 : 1)
      });
    };

    const histogramScanPopulation = createScanPopulation({
      prefix: 'histogram',
      maximumElementCount: maxHistogramElements,
      levelCount: gpuCountControlLayout.histogramScanLevelCount,
      countOffsetWords: gpuCountControlLayout.histogramScanCountOffsetWords,
      dispatchOffsetWords:
        gpuCountControlLayout.histogramScanDispatchOffsetWords,
      firstStaticRow: histogramStaticFirstRow,
      sourceInputBuffer: histogramBuffer,
      sourceOutputBuffer: histogramOffsetsBuffer
    });
    const headScanPopulation = createScanPopulation({
      prefix: 'head',
      maximumElementCount: resolvedMaxElementCount,
      levelCount: gpuCountControlLayout.headScanLevelCount,
      countOffsetWords: gpuCountControlLayout.headScanCountOffsetWords,
      dispatchOffsetWords: gpuCountControlLayout.headScanDispatchOffsetWords,
      firstStaticRow: headStaticFirstRow,
      sourceInputBuffer: headFlagsBuffer,
      sourceOutputBuffer: headOffsetsBuffer
    });

    const resources = {
      pipelines: gpuCountPipelines,
      controlBuffer,
      configArena,
      configSlotCount: gpuCountConfigSlotCount,
      digitStaticBuffer,
      scanStaticBuffer,
      histogramScanPopulation,
      headScanPopulation,
      allocationEntries,
      acquireConfigSlot(requestedSlotIndex = null) {
        let slot = null;
        if (requestedSlotIndex !== null && requestedSlotIndex !== undefined) {
          const slotIndex = nonNegativeInteger(
            requestedSlotIndex,
            'retainedParamsSlotIndex',
            { max: gpuCountConfigSlotCount - 1 }
          );
          slot = configSlots[slotIndex];
        } else {
          slot = configSlots.find((candidate) => !candidate.inUse) ?? null;
        }
        if (!slot || slot.inUse) {
          const error = new Error(
            `${label} already has a GPU-count execution in flight`
          );
          error.code = 'ERR_WEBGPU_RADIX_GPU_COUNT_EXECUTION_IN_FLIGHT';
          error.slotCapacity = gpuCountConfigSlotCount;
          error.requestedSlotIndex = requestedSlotIndex ?? null;
          throw error;
        }
        slot.inUse = true;
        let released = false;
        return {
          slot,
          release() {
            if (released) return false;
            released = true;
            slot.inUse = false;
            return true;
          }
        };
      },
      destroy() {
        destroyBuffersExactlyOnce(
          allocationEntries.map(({ buffer }) => buffer)
        );
        for (const slot of configSlots) {
          slot.inUse = false;
          slot.bindGroups.clear();
        }
      }
    };
    resourceConstruction.commit();
    gpuCountResources = resources;
    return resources;
    } catch (error) {
      resourceConstruction.rollback();
      throw error;
    }
  }

  function attachRetainedParamsLease(execution, lease, {
    ownedTransientBuffers = [],
    childPreparedScans = []
  } = {}) {
    const authenticatedTransientBuffers = Object.freeze([
      ...ownedTransientBuffers
    ]);
    const authenticatedChildPreparedScans = Object.freeze(
      childPreparedScans.map(({
        scanRuntime,
        internals: providedInternals,
        prepared
      }) => {
        const internals = providedInternals
          ?? WEBGPU_SCAN_RUNTIME_INTERNALS.get(scanRuntime);
        if (!internals?.finalizePreparedFromParent) {
          throw new Error(`${label} child scan cleanup capability is unavailable`);
        }
        return Object.freeze({ internals, prepared });
      })
    );
    ownedTransientBuffersByExecution.set(
      execution,
      authenticatedTransientBuffers
    );
    childPreparedScansByExecution.set(
      execution,
      authenticatedChildPreparedScans
    );
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
    const transientBuffer = retainedSlot ? null : buffer;
    try {
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
    if (transientBuffer) transients.add(transientBuffer);
    return {
      buffer,
      byteOffset,
      transientBuffer,
      paramsSlotIndex: retainedSlot?.slotIndex ?? null,
      paramsBufferResidency: retainedSlot ? 'retained-slot-arena' : 'transient-per-encode'
    };
    } catch (error) {
      if (transientBuffer) {
        transients.delete(transientBuffer);
        destroyBuffersExactlyOnce([transientBuffer]);
      }
      throw error;
    }
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
      }, retainedParamsLease, { ownedTransientBuffers: [] });
    }
    const generation = nonNegativeInteger(generationId, 'generationId', { max: 0xffffffff });
    if (retainControlParams && !retainedParamsLease?.slot?.inUse) {
      throw new Error(`${label} retained radix encoding requires an active params slot lease`);
    }
    let params = null;
    let histogramScanEncoding = null;
    try {
    params = createRadixParams(
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
    const serialHistogramScanEnabled = resolvedSerialHistogramScanMaxElementCount > 0
      && histogramElementCount > WEBGPU_SCAN_ELEMENTS_PER_WORKGROUP
      && histogramElementCount <= resolvedSerialHistogramScanMaxElementCount;
    histogramScanEncoding = serialHistogramScanEnabled
      ? null
      : histogramScan.prepare({
          inputBuffer: histogramBuffer,
          outputBuffer: histogramOffsetsBuffer,
          elementCount: histogramElementCount,
          retainedParamsSlotIndex: retainVariableScanParamsBuffers
            ? (retainedParamsLease?.slot?.slotIndex ?? 0)
            : 0
        });
    if (histogramScanEncoding) {
      attachPreparedScanLease(retainedParamsLease, histogramScan, histogramScanEncoding);
    }
    const transientBuffers = [
      ...(params.transientBuffer ? [params.transientBuffer] : []),
      ...(histogramScanEncoding?.transientBuffers ?? [])
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
    const serialHistogramScanBindGroup = serialHistogramScanEnabled
      ? retainedBindGroup(
          retainedParamsLease?.slot,
          'radix-serial-histogram-scan',
          pipelines.serialHistogramScan,
          `${label}-serial-histogram-scan-bind-group`,
          [
            { binding: 0, resource: { buffer: histogramBuffer } },
            { binding: 1, resource: { buffer: histogramOffsetsBuffer } },
            {
              binding: 2,
              resource: { buffer: paramsBuffer, offset: paramsBaseOffset, size: 32 }
            }
          ],
          bindGroupTelemetry
        )
      : null;
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

      if (serialHistogramScanEnabled) {
        if (timestampActive) {
          encodeProfiledComputeDispatch(
            encoder,
            timestampProfiler,
            `${label}RadixHistogramSerialScan`,
            commandMetadata,
            pipelines.serialHistogramScan,
            serialHistogramScanBindGroup,
            [1, 1, 1],
            dispatchIndirectProvider
          );
        } else {
          encodeComputeDispatch(
            groupedPass,
            pipelines.serialHistogramScan,
            serialHistogramScanBindGroup,
            [1, 1, 1],
            dispatchIndirectProvider
          );
        }
      } else {
        histogramScan.encodePrepared(encoder, histogramScanEncoding, {
          timestampProfiler,
          timestampMetadata: commandMetadata,
          labelPrefix: `${label}RadixHistogram`,
          computePass: groupedPass,
          dispatchIndirectProvider
        });
      }

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
      histogramScanMode: serialHistogramScanEnabled ? 'serial-small' : 'parallel-scan',
      encodedDispatchCount: 1 + passIndex * (serialHistogramScanEnabled
        ? 3
        : 2 + histogramScanEncoding.encodedDispatchCount),
      encodedComputePassCount: timestampActive
        ? 1 + passIndex * (serialHistogramScanEnabled
            ? 3
            : 2 + histogramScanEncoding.encodedDispatchCount)
        : 1,
      bindGroupCreationCount: bindGroupTelemetry.created
        + (histogramScanEncoding?.bindGroupCreationCount ?? 0),
      bindGroupReuseCount: bindGroupTelemetry.reused
        + (serialHistogramScanEnabled
          ? Math.max(0, passIndex - 1)
          : Math.max(
              0,
              passIndex - (histogramScanEncoding.preparedScanCacheHit ? 0 : 1)
            ) * histogramScanEncoding.encodedDispatchCount),
      paramsBufferCreationCount: params.transientBuffer ? 1 : 0,
      paramsWriteCount: 1 + (histogramScanEncoding?.paramsWriteCount ?? 0),
      paramsSlotIndex: params.paramsSlotIndex,
      paramsBufferResidency: params.paramsBufferResidency,
      readbackPerformed: false,
      transientBuffers
    }, retainedParamsLease, {
      ownedTransientBuffers: transientBuffers,
      childPreparedScans: histogramScanEncoding
        ? [{ scanRuntime: histogramScan, prepared: histogramScanEncoding }]
        : []
    });
    } catch (error) {
      if (histogramScanEncoding) {
        WEBGPU_SCAN_RUNTIME_INTERNALS
          .get(histogramScan)
          ?.finalizePreparedFromParent(histogramScanEncoding);
      }
      if (params?.transientBuffer && transients.delete(params.transientBuffer)) {
        destroyBuffersExactlyOnce([params.transientBuffer]);
      }
      throw error;
    }
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
    const transientBuffer = retainedSlot ? null : buffer;
    try {
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
    if (transientBuffer) transients.add(transientBuffer);
    return {
      buffer,
      byteOffset,
      transientBuffer,
      paramsSlotIndex: retainedSlot?.slotIndex ?? null,
      paramsBufferResidency: retainedSlot ? 'retained-slot-arena' : 'transient-per-encode'
    };
    } catch (error) {
      if (transientBuffer) {
        transients.delete(transientBuffer);
        destroyBuffersExactlyOnce([transientBuffer]);
      }
      throw error;
    }
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
    let params = null;
    let headScanEncoding = null;
    try {
    params = createUniqueParams({
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
    }, retainedParamsLease, {
      ownedTransientBuffers: transientBuffers,
      childPreparedScans: headScanEncoding
        ? [{ scanRuntime: headScan, prepared: headScanEncoding }]
        : []
    });
    } catch (error) {
      if (headScanEncoding) {
        WEBGPU_SCAN_RUNTIME_INTERNALS
          .get(headScan)
          ?.finalizePreparedFromParent(headScanEncoding);
      }
      if (params?.transientBuffer && transients.delete(params.transientBuffer)) {
        destroyBuffersExactlyOnce([params.transientBuffer]);
      }
      throw error;
    }
  }

  function encodeSortUniqueGpuCount(encoder, args = {}) {
    if (!encoder?.beginComputePass || !encoder?.clearBuffer) {
      throw new TypeError(
        'GPU-authored count radix encoding requires a GPUCommandEncoder-like object'
      );
    }
    const keyBuffer = args.keyBuffer;
    const authorityBuffer =
      args.authorityBuffer ?? args.countAuthorityBuffer;
    if (!keyBuffer || !authorityBuffer) {
      throw new TypeError(
        'GPU-authored count radix encoding requires keyBuffer and authorityBuffer'
      );
    }
    const maximum = positiveInteger(
      args.maxElementCount,
      'maxElementCount',
      { max: resolvedMaxElementCount }
    );
    const words = positiveInteger(args.keyWordCount, 'keyWordCount', {
      max: resolvedMaxKeyWordCount
    });
    const stride = positiveInteger(
      args.keyStrideWords ?? words,
      'keyStrideWords',
      { max: 0xffff }
    );
    if (stride < words) {
      throw new RangeError('keyStrideWords must cover keyWordCount');
    }
    const consumerWidth = positiveInteger(
      args.consumerWorkgroupSize ?? 64,
      'consumerWorkgroupSize',
      { max: 1024 }
    );
    const countByteOffset = nonNegativeInteger(
      args.authorityCountByteOffset ?? args.countByteOffset ?? 0,
      'authorityCountByteOffset',
      { max: 0xffff_fffc }
    );
    if (countByteOffset % UINT32_BYTES !== 0) {
      throw new RangeError('authorityCountByteOffset must be u32 aligned');
    }

    const sealDescriptor =
      args.generationSeal && typeof args.generationSeal === 'object'
        ? args.generationSeal
        : null;
    const expectedSeal = positiveInteger(
      sealDescriptor?.expected
        ?? sealDescriptor?.value
        ?? args.generationSeal,
      'generationSeal',
      { max: 0xffff_ffff }
    );
    const sealByteOffset = nonNegativeInteger(
      sealDescriptor?.byteOffset
        ?? args.authoritySealByteOffset
        ?? (countByteOffset + UINT32_BYTES),
      'authoritySealByteOffset',
      { max: 0xffff_fffc }
    );
    if (sealByteOffset % UINT32_BYTES !== 0) {
      throw new RangeError('authoritySealByteOffset must be u32 aligned');
    }
    if (sealByteOffset === countByteOffset) {
      throw new RangeError(
        'authority count and generation seal require distinct u32 words'
      );
    }
    if (Number.isFinite(Number(authorityBuffer.size))) {
      const authoritySize = Number(authorityBuffer.size);
      if (countByteOffset + UINT32_BYTES > authoritySize
        || sealByteOffset + UINT32_BYTES > authoritySize) {
        throw new RangeError(
          'authority count and generation seal offsets must be inside authorityBuffer'
        );
      }
    }
    if (Number.isFinite(Number(keyBuffer.size))) {
      const requiredKeyBytes = maximum * stride * UINT32_BYTES;
      if (!Number.isSafeInteger(requiredKeyBytes)
        || requiredKeyBytes > Number(keyBuffer.size)) {
        throw new RangeError(
          `keyBuffer must cover maxElementCount * keyStrideWords (${requiredKeyBytes} bytes)`
        );
      }
    }
    const generation = nonNegativeInteger(
      args.generationId ?? expectedSeal,
      'generationId',
      { max: 0xffff_ffff }
    );
    if (!gpuCountResources) {
      const error = new Error(
        `${label} GPU-count resources are not prepared; `
        + 'call prepareGpuCountResources() outside the encode hot loop'
      );
      error.code = 'ERR_WEBGPU_RADIX_GPU_COUNT_NOT_PREPARED';
      throw error;
    }
    const resources = gpuCountResources;
    const {
      pipelines: gpuCountPipelines,
      controlBuffer,
      configArena,
      digitStaticBuffer,
      histogramScanPopulation,
      headScanPopulation
    } = resources;
    const configLease = resources.acquireConfigSlot(
      args.retainedParamsSlotIndex
    );
    const bindGroupTelemetry = { created: 0, reused: 0 };
    const configOffset = configLease.slot.byteOffset;
    const configData = new Uint32Array(paramsOffsetAlignment / UINT32_BYTES);
    configData[0] = countByteOffset / UINT32_BYTES;
    configData[1] = sealByteOffset / UINT32_BYTES;
    configData[2] = expectedSeal;
    configData[3] = maximum;
    configData[4] = words;
    configData[5] = stride;
    configData[6] = consumerWidth;
    configData[7] = generation;
    configData[8] = maxComputeWorkgroupsPerDimension;
    configData[9] = gpuCountControlLayout.histogramScanCountOffsetWords;
    configData[10] = gpuCountControlLayout.headScanCountOffsetWords;
    configData[11] = gpuCountControlLayout.radixDispatchOffsetWords;
    configData[12] =
      gpuCountControlLayout.histogramScanDispatchOffsetWords;
    configData[13] = gpuCountControlLayout.headScanDispatchOffsetWords;
    configData[14] = gpuCountControlLayout.histogramScanLevelCount;
    configData[15] = gpuCountControlLayout.headScanLevelCount;
    configData[16] = gpuCountControlLayout.indirectRowCount;
    configData[17] = gpuCountControlLayout.controlWordCount;
    configData[18] = resolvedMaxElementCount;
    device.queue.writeBuffer(configArena, configOffset, configData);

    try {
      const prepareBindGroup = retainedBindGroup(
        configLease.slot,
        'gpu-count-prepare',
        gpuCountPipelines.prepare,
        `${label}-gpu-count-prepare-bind-group`,
        [
          { binding: 0, resource: { buffer: authorityBuffer } },
          { binding: 1, resource: { buffer: controlBuffer } },
          {
            binding: 2,
            resource: {
              buffer: configArena,
              offset: configOffset,
              size: 80
            }
          }
        ],
        bindGroupTelemetry
      );
      const initializeBindGroup = retainedBindGroup(
        configLease.slot,
        'gpu-count-initialize',
        gpuCountPipelines.initialize,
        `${label}-gpu-count-initialize-bind-group`,
        [
          { binding: 2, resource: { buffer: sortedIndicesA } },
          { binding: 5, resource: { buffer: controlBuffer } }
        ],
        bindGroupTelemetry
      );
      const skipDigitRows =
        (resolvedMaxKeyWordCount - words) * WEBGPU_RADIX_PASSES_PER_WORD;
      const fullDigitRows = Array.from(
        { length: words * WEBGPU_RADIX_PASSES_PER_WORD },
        (_, index) => skipDigitRows + index
      );
      const requestedDigitRows = args.significantDigitRows;
      const digitRows = requestedDigitRows == null
        ? fullDigitRows
        : Array.from(requestedDigitRows, (value, index) => {
            const row = nonNegativeInteger(
              value,
              `significantDigitRows[${index}]`,
              { max: maxRadixPassCount - 1 }
            );
            if (row < skipDigitRows) {
              throw new RangeError(
                'significantDigitRows must address only active key words'
              );
            }
            return row;
          });
      if (digitRows.length === 0) {
        throw new RangeError('significantDigitRows must retain at least one digit');
      }
      for (let index = 1; index < digitRows.length; index += 1) {
        if (digitRows[index] <= digitRows[index - 1]) {
          throw new RangeError(
            'significantDigitRows must be strictly increasing in LSD radix order'
          );
        }
      }
      let input = sortedIndicesA;
      let output = sortedIndicesB;
      const digitCommands = [];
      for (let passIndex = 0; passIndex < digitRows.length; passIndex += 1) {
        const digitRow = digitRows[passIndex];
        const digitOffset = digitRow * paramsOffsetAlignment;
        const digitResource = {
          buffer: digitStaticBuffer,
          offset: digitOffset,
          size: 16
        };
        const histogramBindGroup = retainedBindGroup(
          configLease.slot,
          `gpu-count-histogram-${digitRow}`,
          gpuCountPipelines.histogram,
          `${label}-gpu-count-histogram-${passIndex}`,
          [
            { binding: 0, resource: { buffer: keyBuffer } },
            { binding: 1, resource: { buffer: input } },
            { binding: 3, resource: { buffer: histogramBuffer } },
            { binding: 5, resource: { buffer: controlBuffer } },
            { binding: 6, resource: digitResource }
          ],
          bindGroupTelemetry
        );
        const scatterBindGroup = retainedBindGroup(
          configLease.slot,
          `gpu-count-scatter-${digitRow}`,
          gpuCountPipelines.scatter,
          `${label}-gpu-count-scatter-${passIndex}`,
          [
            { binding: 0, resource: { buffer: keyBuffer } },
            { binding: 1, resource: { buffer: input } },
            { binding: 2, resource: { buffer: output } },
            { binding: 4, resource: { buffer: histogramOffsetsBuffer } },
            { binding: 5, resource: { buffer: controlBuffer } },
            { binding: 6, resource: digitResource }
          ],
          bindGroupTelemetry
        );
        digitCommands.push({ histogramBindGroup, scatterBindGroup });
        [input, output] = [output, input];
      }
      const sortedIndicesBuffer = input;
      const markBindGroup = retainedBindGroup(
        configLease.slot,
        'gpu-count-mark-heads',
        gpuCountPipelines.markHeads,
        `${label}-gpu-count-mark-heads-bind-group`,
        [
          { binding: 0, resource: { buffer: keyBuffer } },
          { binding: 1, resource: { buffer: sortedIndicesBuffer } },
          { binding: 2, resource: { buffer: headFlagsBuffer } },
          { binding: 8, resource: { buffer: controlBuffer } }
        ],
        bindGroupTelemetry
      );
      const scatterUniqueBindGroup = retainedBindGroup(
        configLease.slot,
        'gpu-count-scatter-unique',
        gpuCountPipelines.scatterUnique,
        `${label}-gpu-count-scatter-unique-bind-group`,
        [
          { binding: 0, resource: { buffer: keyBuffer } },
          { binding: 1, resource: { buffer: sortedIndicesBuffer } },
          { binding: 2, resource: { buffer: headFlagsBuffer } },
          { binding: 3, resource: { buffer: headOffsetsBuffer } },
          { binding: 4, resource: { buffer: uniqueKeysBuffer } },
          { binding: 5, resource: { buffer: uniqueOffsetsBuffer } },
          { binding: 8, resource: { buffer: controlBuffer } }
        ],
        bindGroupTelemetry
      );
      const finalizeBindGroup = retainedBindGroup(
        configLease.slot,
        'gpu-count-finalize-unique',
        gpuCountPipelines.finalizeUnique,
        `${label}-gpu-count-finalize-unique-bind-group`,
        [
          { binding: 2, resource: { buffer: headFlagsBuffer } },
          { binding: 3, resource: { buffer: headOffsetsBuffer } },
          { binding: 5, resource: { buffer: uniqueOffsetsBuffer } },
          { binding: 6, resource: { buffer: evidenceBuffer } },
          { binding: 7, resource: { buffer: dispatchIndirectBuffer } },
          { binding: 8, resource: { buffer: controlBuffer } },
          { binding: 9, resource: { buffer: authorityBuffer } }
        ],
        bindGroupTelemetry
      );
      const gpuTimestampRecorder = args.gpuTimestampRecorder ?? null;
      const timestampProducerId =
        typeof args.timestampProducerId === 'string'
          && args.timestampProducerId.trim()
          ? args.timestampProducerId.trim()
          : 'webgpu-gpu-count-radix-sort-unique';
      const timestampSpan = gpuTimestampRecorder?.active === true
        && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
        ? gpuTimestampRecorder.beginEncoderSpan(encoder, {
            producerId: timestampProducerId,
            stage: 'gpu-count-radix-sort-unique',
            spanClass: 'same-grouped-production-compute-pass',
            ...(args.timestampMetadata || {}),
            elementCount: null,
            elementCountSource: 'authenticated-gpu-authority',
            maxElementCount: maximum,
            keyWordCount: words
          })
        : null;

      encoder.clearBuffer(controlBuffer);
      encoder.clearBuffer(evidenceBuffer);
      encoder.clearBuffer(dispatchIndirectBuffer);
      encoder.clearBuffer(uniqueOffsetsBuffer, 0, UINT32_BYTES);

      const preparePass = encoder.beginComputePass({
        label: `${label}GpuCountPrepare`
      });
      preparePass.setPipeline(gpuCountPipelines.prepare);
      preparePass.setBindGroup(0, prepareBindGroup);
      preparePass.dispatchWorkgroups(1, 1, 1);
      preparePass.end();

      const productionPass = encoder.beginComputePass({
        label: `${label}GroupedGpuCountRadixUnique`
      });
      // Direct-ceiling dispatch: dispatchWorkgroupsIndirect costs ~0.25 ms
      // of GPU-process CPU per call on Chromium (per-call indirect
      // validation), which dwarfs these tiny sorts. Every kernel here
      // element-guards against the control buffer's GPU-authored live
      // counts (zero when the seal/topology admission fails), so launching
      // the host-computable worst-case group count is observationally
      // identical for the live prefix and preserves fail-closed no-ops.
      // Only the parent-offset add keeps the indirect path: its live
      // dispatch is legitimately zero whenever a live level needs no
      // parent add, and running it anyway would apply stale offsets.
      // Folded (2D) ceilings also stay indirect: kernels decode
      // linear_group with the live dispatch_x, which only matches the
      // launched grid when the shape is one-dimensional.
      const directCeilingGroups = (groupCount) => (
        Number.isSafeInteger(groupCount)
        && groupCount > 0
        && groupCount <= maxComputeWorkgroupsPerDimension
          ? groupCount
          : null
      );
      const radixCeilingGroups = directCeilingGroups(
        Math.ceil(maximum / 256)
      );
      let encodedDirectCeilingCount = 0;
      let encodedIndirectCount = 0;
      const encodeIndirect = (pipeline, bindGroup, byteOffset, ceiling = null) => {
        productionPass.setPipeline(pipeline);
        productionPass.setBindGroup(0, bindGroup);
        if (ceiling != null) {
          productionPass.dispatchWorkgroups(ceiling, 1, 1);
          encodedDirectCeilingCount += 1;
          return;
        }
        encodedIndirectCount += 1;
        if (typeof productionPass.dispatchWorkgroupsIndirect !== 'function') {
          throw new TypeError(
            'GPU-authored count radix encoding requires dispatchWorkgroupsIndirect'
          );
        }
        productionPass.dispatchWorkgroupsIndirect(controlBuffer, byteOffset);
      };
      const encodeScan = (population) => {
        for (const level of population.levels) {
          const levelCeiling = directCeilingGroups(
            Math.ceil(level.maximumElementCount / 512)
          );
          if (level.level === population.fusedTopLevelIndex) {
            encodeIndirect(
              gpuCountPipelines.scanFusedTopAdd,
              level.fusedTopAddBindGroup,
              level.blockDispatchOffsetBytes,
              levelCeiling
            );
            continue;
          }
          encodeIndirect(
            gpuCountPipelines.scanBlocks,
            level.blockBindGroup,
            level.blockDispatchOffsetBytes,
            levelCeiling
          );
        }
        // The top scanned level has no parent offset to add. Lower levels are
        // still encoded at their fixed maximum depth and GPU-gated to zero
        // whenever the authored live count does not reach that recursion.
        for (let level = population.levels.length - 2; level >= 0; level -= 1) {
          if (level === population.fusedTopLevelIndex - 1) continue;
          const entry = population.levels[level];
          encodeIndirect(
            gpuCountPipelines.scanAdd,
            entry.addBindGroup,
            entry.addDispatchOffsetBytes
          );
        }
      };

      encodeIndirect(
        gpuCountPipelines.initialize,
        initializeBindGroup,
        gpuCountControlLayout.radixDispatchOffsetBytes,
        radixCeilingGroups
      );
      for (const command of digitCommands) {
        encodeIndirect(
          gpuCountPipelines.histogram,
          command.histogramBindGroup,
          gpuCountControlLayout.radixDispatchOffsetBytes,
          radixCeilingGroups
        );
        encodeScan(histogramScanPopulation);
        encodeIndirect(
          gpuCountPipelines.scatter,
          command.scatterBindGroup,
          gpuCountControlLayout.radixDispatchOffsetBytes,
          radixCeilingGroups
        );
      }
      encodeIndirect(
        gpuCountPipelines.markHeads,
        markBindGroup,
        gpuCountControlLayout.radixDispatchOffsetBytes,
        radixCeilingGroups
      );
      encodeScan(headScanPopulation);
      encodeIndirect(
        gpuCountPipelines.scatterUnique,
        scatterUniqueBindGroup,
        gpuCountControlLayout.radixDispatchOffsetBytes,
        radixCeilingGroups
      );
      productionPass.setPipeline(gpuCountPipelines.finalizeUnique);
      productionPass.setBindGroup(0, finalizeBindGroup);
      productionPass.dispatchWorkgroups(1, 1, 1);
      productionPass.end();
      if (timestampSpan) {
        gpuTimestampRecorder.endEncoderSpan(encoder, timestampSpan);
      }

      const radixPassCount = digitCommands.length;
      const productionDispatchCount =
        encodedDirectCeilingCount + encodedIndirectCount;
      return attachRetainedParamsLease({
        schema: ULG_WEBGPU_RADIX_UNIQUE_SCHEMA,
        countAuthoritySchema: ULG_WEBGPU_RADIX_GPU_COUNT_SCHEMA,
        status: 'webgpu-stable-radix-sort-unique-gpu-count-encoded',
        elementCount: null,
        elementCountSource: 'authenticated-gpu-authority',
        maxElementCount: maximum,
        runtimeMaxElementCount: resolvedMaxElementCount,
        generationId: generation,
        generationSeal: expectedSeal,
        authorityBuffer,
        authorityCountByteOffset: countByteOffset,
        authoritySealByteOffset: sealByteOffset,
        keyWordCount: words,
        keyStrideWords: stride,
        radixPassCount,
        significantDigitRows: Object.freeze([...digitRows]),
        sortedIndicesBuffer,
        uniqueHeadFlagsBuffer: headFlagsBuffer,
        uniqueGroupIndexBySortedPositionBuffer: headOffsetsBuffer,
        uniqueKeysBuffer,
        uniqueOffsetsBuffer,
        uniqueEvidenceBuffer: evidenceBuffer,
        uniqueDispatchIndirectBuffer: dispatchIndirectBuffer,
        uniqueKeyCapacity: resolvedMaxElementCount,
        uniqueOffsetCapacity: resolvedMaxElementCount + 1,
        gpuCountControlBuffer: controlBuffer,
        gpuCountControlLayout,
        histogramScanMode:
          histogramScanPopulation.fusedTopAddEnabled
            ? 'gpu-count-fixed-hierarchical-fused-top'
            : 'gpu-count-fixed-hierarchical',
        histogramScanFusedTopAddEnabled:
          histogramScanPopulation.fusedTopAddEnabled,
        headScanFusedTopAddEnabled:
          headScanPopulation.fusedTopAddEnabled,
        histogramScanEncodedDispatchCount:
          histogramScanPopulation.encodedDispatchCount,
        headScanEncodedDispatchCount:
          headScanPopulation.encodedDispatchCount,
        encodedDispatchCount: productionDispatchCount + 2,
        encodedIndirectDispatchCount: encodedIndirectCount,
        encodedDirectDispatchCount: encodedDirectCeilingCount + 2,
        encodedComputePassCount: 2,
        fixedMaximumTopology: true,
        timestampProducerId,
        executionConcurrency: 'single-flight-per-runtime',
        inactiveDispatchPolicy:
          'gpu-count-element-guarded-ceiling-with-indirect-parent-adds',
        paramsBufferCreationCount: 0,
        gpuBufferCreationCountDuringEncode: 0,
        bindGroupCreationCount: bindGroupTelemetry.created,
        bindGroupReuseCount: bindGroupTelemetry.reused,
        paramsWriteCount: 1,
        paramsSlotIndex: configLease.slot.slotIndex,
        paramsBufferResidency: 'retained-gpu-count-config-arena',
        clearedWordCount: WEBGPU_RADIX_UNIQUE_CLEARED_WORD_COUNT,
        gpuCountControlClearedWordCount:
          gpuCountControlLayout.controlWordCount,
        readbackPerformed: false,
        transientBuffers: []
      }, configLease, { ownedTransientBuffers: [] });
    } catch (error) {
      configLease.release();
      throw error;
    }
  }

  const releasedExecutions = new WeakSet();

  function executionReleaseRecord(value) {
    return Object.freeze({
      ownedTransientBuffers:
        ownedTransientBuffersByExecution.get(value) ?? Object.freeze([]),
      childPreparedScans:
        childPreparedScansByExecution.get(value) ?? Object.freeze([])
    });
  }

  function destroyExecutionTransientBuffers(value, releaseRecord = null) {
    if (!value || !ownedExecutions.has(value)) return false;
    const authenticatedReleaseRecord = releaseRecord
      ?? executionReleaseRecord(value);
    for (const { internals, prepared } of
      authenticatedReleaseRecord.childPreparedScans) {
      internals.finalizePreparedFromParent(prepared);
    }
    const ownedTransientBuffers = [];
    for (const buffer of authenticatedReleaseRecord.ownedTransientBuffers) {
      if (!transients.delete(buffer)) continue;
      ownedTransientBuffers.push(buffer);
    }
    destroyBuffersExactlyOnce(ownedTransientBuffers);
    ownedTransientBuffersByExecution.delete(value);
    childPreparedScansByExecution.delete(value);
    return true;
  }

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

  function finalizeReleaseExecution(value, releaseRecord = null) {
    assertOwnedExecution(value);
    if (releasedExecutions.has(value)) return false;
    destroyExecutionTransientBuffers(value, releaseRecord);
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

  function releaseExecutionQueueOrdered(value) {
    // The caller has submitted the execution and every consumer to the same
    // GPUQueue before relinquishing it. Releasing retained parameter slots and
    // destroying one-use buffers here is safe: later queue writes/submissions
    // are ordered after the submitted consumers, while GPUBuffer.destroy()
    // defers physical reclamation until those earlier uses finish.
    return finalizeReleaseExecution(value);
  }

  function canReleaseExecutionQueueOrdered(value) {
    return Boolean(
      value
      && typeof value === 'object'
      && value.schema === ULG_WEBGPU_RADIX_UNIQUE_SCHEMA
      && ownedExecutions.has(value)
      && !releasedExecutions.has(value)
    );
  }

  async function releaseExecutionAfter(value, submissionFence) {
    assertOwnedExecution(value);
    if (releasedExecutions.has(value)) return false;
    const authenticatedReleaseRecord = executionReleaseRecord(value);
    const fencePromise = exactThenablePromise(
      submissionFence,
      'releaseExecutionAfter requires a submission-fence thenable'
    );
    await fencePromise;
    return finalizeReleaseExecution(value, authenticatedReleaseRecord);
  }

  const runtime = {
    schema: ULG_WEBGPU_RADIX_UNIQUE_SCHEMA,
    status: 'webgpu-stable-radix-scan-unique-ready',
    get pipelineCount() {
      return Object.keys(pipelines).length
        + histogramScan.pipelineCount
        + headScan.pipelineCount;
    },
    get gpuCountPipelineCount() {
      return gpuCountResources
        ? Object.keys(gpuCountResources.pipelines).length
        : 0;
    },
    get totalPipelineCount() {
      return Object.keys(pipelines).length
        + histogramScan.pipelineCount
        + headScan.pipelineCount
        + (gpuCountResources
          ? Object.keys(gpuCountResources.pipelines).length
          : 0);
    },
    maxElementCount: resolvedMaxElementCount,
    maxKeyWordCount: resolvedMaxKeyWordCount,
    gpuCountControlLayout,
    serialHistogramScanMaxElementCount: resolvedSerialHistogramScanMaxElementCount,
    retainedParamsSlotCount: resolvedRetainedParamsSlotCount,
    variableRetainedScanCounts: retainControlParams && retainVariableScanParamsBuffers === true,
    paramsOffsetAlignment,
    radixParamsSlotStrideBytes: retainControlParams ? radixParamsSlotStrideBytes : 0,
    uniqueParamsSlotStrideBytes: retainControlParams ? uniqueParamsSlotStrideBytes : 0,
    prepareGpuCountResources() {
      const resources = ensureGpuCountResources();
      return Object.freeze({
        status: 'webgpu-radix-gpu-count-resources-prepared',
        pipelineCount: Object.keys(resources.pipelines).length,
        configSlotCount: resources.configSlotCount,
        executionConcurrency: 'single-flight-per-runtime',
        gpuBufferCreationCountDuringEncode: 0,
        controlBuffer: resources.controlBuffer,
        controlLayout: gpuCountControlLayout
      });
    },
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
      let sorted = null;
      let unique = null;
      try {
        const gpuTimestampRecorder = args.gpuTimestampRecorder ?? null;
        const sortTimestampProducerId = typeof args.sortTimestampProducerId === 'string'
          && args.sortTimestampProducerId.trim()
          ? args.sortTimestampProducerId.trim()
          : 'webgpu-stable-radix-sort';
        const uniqueTimestampProducerId = typeof args.uniqueTimestampProducerId === 'string'
          && args.uniqueTimestampProducerId.trim()
          ? args.uniqueTimestampProducerId.trim()
          : 'webgpu-sorted-unique';
        const sortTimestampSpan = gpuTimestampRecorder?.active === true
          && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
          ? gpuTimestampRecorder.beginEncoderSpan(encoder, {
              producerId: sortTimestampProducerId,
              stage: 'sort',
              spanClass: 'same-grouped-production-compute-pass',
              ...(args.timestampMetadata || {}),
              elementCount: Number(args.elementCount) || 0,
              keyWordCount: Number(args.keyWordCount) || 0
            })
          : null;
        sorted = encodeSortInternal(encoder, args, lease);
        if (sortTimestampSpan) {
          gpuTimestampRecorder.endEncoderSpan(encoder, sortTimestampSpan);
        }
        const uniqueTimestampSpan = gpuTimestampRecorder?.active === true
          && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
          ? gpuTimestampRecorder.beginEncoderSpan(encoder, {
              producerId: uniqueTimestampProducerId,
              stage: 'unique',
              spanClass: 'same-grouped-production-compute-pass',
              ...(args.timestampMetadata || {}),
              elementCount: Number(args.elementCount) || 0,
              keyWordCount: Number(args.keyWordCount) || 0
            })
          : null;
        unique = encodeUniqueInternal(encoder, {
          ...args,
          sortedIndicesBuffer: sorted.sortedIndicesBuffer
        }, lease);
        if (uniqueTimestampSpan) {
          gpuTimestampRecorder.endEncoderSpan(encoder, uniqueTimestampSpan);
        }
        const combinedOwnedTransientBuffers = [
          ...(ownedTransientBuffersByExecution.get(sorted) ?? []),
          ...(ownedTransientBuffersByExecution.get(unique) ?? [])
        ];
        const combinedChildPreparedScans = [
          ...(childPreparedScansByExecution.get(sorted) ?? []),
          ...(childPreparedScansByExecution.get(unique) ?? [])
        ];
        const execution = {
          ...unique,
          status: 'webgpu-stable-radix-sort-unique-csr-encoded',
          radixPassCount: sorted.passCount ?? 0,
          histogramElementCount: sorted.histogramElementCount ?? 0,
          histogramScanMode: sorted.histogramScanMode ?? 'none',
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
          transientBuffers: [...combinedOwnedTransientBuffers]
        };
        return attachRetainedParamsLease(execution, lease, {
          ownedTransientBuffers: combinedOwnedTransientBuffers,
          childPreparedScans: combinedChildPreparedScans
        });
      } catch (error) {
        destroyExecutionTransientBuffers(sorted);
        destroyExecutionTransientBuffers(unique);
        lease?.release();
        throw error;
      }
    },
    encodeSortUniqueGpuCount,
    releaseExecution,
    canReleaseExecutionQueueOrdered,
    releaseExecutionQueueOrdered,
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
        ...(gpuCountResources?.allocationEntries ?? []),
        ...histogramScan.allocationEntries(),
        ...headScan.allocationEntries(),
        ...[...transients].map((buffer) => ({ role: 'radix-unique-params-transient', buffer }))
      ];
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      destroyBuffersExactlyOnce([
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
      ]);
      histogramScan.destroy();
      headScan.destroy();
      gpuCountResources?.destroy();
      gpuCountResources = null;
      destroyBuffersExactlyOnce([...transients]);
      transients.clear();
      for (const slot of retainedParamsSlots) {
        slot.inUse = false;
        slot.bindGroups.clear();
      }
    }
  };
  construction.commit();
  return runtime;
  } catch (error) {
    construction.rollback();
    throw error;
  }
}
