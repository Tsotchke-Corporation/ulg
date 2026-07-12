import {
  SCHROEDER_ACTIVE_NODE_ROW_LAYOUT,
  ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  SCHROEDER_SPARSE_HIERARCHY_EVIDENCE_LAYOUT,
  SCHROEDER_SPARSE_HIERARCHY_EVIDENCE_WORDS,
  SCHROEDER_SPARSE_HIERARCHY_KEY_LAYOUT,
  SCHROEDER_SPARSE_HIERARCHY_KEY_WORDS,
  SCHROEDER_SPARSE_HIERARCHY_NODE_LAYOUT,
  SCHROEDER_SPARSE_HIERARCHY_NODE_WORDS,
  SCHROEDER_SPARSE_HIERARCHY_OVERFLOW_RETAINED_BUDGET,
  SCHROEDER_SPARSE_HIERARCHY_OVERFLOW_SCRATCH_BUDGET,
  ULG_SCHROEDER_SPARSE_HIERARCHY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_SPARSE_HIERARCHY_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSparseHierarchy.js';
import {
  createWebGpuRadixUniquePlan,
  createWebGpuStableRadixScanUnique,
  createWebGpuU32ExclusiveScan,
  createWebGpuU32ScanPlan,
  WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_DEFAULT,
  WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_MAX
} from '../webgpuRadixScanUnique.js';
import {
  SCHROEDER_SPARSE_GRID_VIEW_DISPATCH_WORDS,
  SCHROEDER_SPARSE_GRID_VIEW_HEADER_WORDS,
  SCHROEDER_SPARSE_GRID_VIEW_INVALID_INDEX,
  SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_DISPATCH,
  SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_HASH_PROBE,
  SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_NODE_ARENA,
  SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_PRIMITIVE,
  SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_SOURCE_IDENTITY,
  SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_UNSUPPORTED_SOURCE,
  SCHROEDER_SPARSE_GRID_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPARSE_GRID_VIEW_STATUS_FAIL_CLOSED,
  SCHROEDER_SPARSE_GRID_VIEW_STATUS_READY,
  SCHROEDER_SPARSE_GRID_VIEW_STENCIL_NODE_COUNT,
  SCHROEDER_SPARSE_GRID_VIEW_STENCIL_WIDTH,
  ULG_SCHROEDER_SPARSE_GRID_VIEW_EXECUTION_SCHEMA,
  ULG_SCHROEDER_SPARSE_GRID_VIEW_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSparseGridView.js';
import { schroederSparseGridViewWgsl } from '../../../ulg-gpu-abi/src/schroederSparseGridViewWgsl.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

export * from '../../../ulg-gpu-abi/src/schroederSparseHierarchy.js';
export * from '../../../ulg-gpu-abi/src/schroederSparseGridView.js';
export { schroederSparseGridViewWgsl };

export const SCHROEDER_SPARSE_HIERARCHY_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPARSE_HIERARCHY_DEFAULT_RETAINED_ARENA_BYTES = 64 * 1024 * 1024;
export const SCHROEDER_SPARSE_HIERARCHY_DEFAULT_SCRATCH_ARENA_BYTES = 64 * 1024 * 1024;
export const SCHROEDER_SPARSE_HIERARCHY_DEFAULT_MAX_TILES_PER_SOURCE = 512;
export const SCHROEDER_SPARSE_GRID_DEFAULT_ARENA_BYTES = 64 * 1024 * 1024;
export const SCHROEDER_SPARSE_GRID_INVALID_INDEX = SCHROEDER_SPARSE_GRID_VIEW_INVALID_INDEX;

const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const ACTIVE_NODE_STRIDE_FLOATS = SCHROEDER_ACTIVE_NODE_ROW_LAYOUT.length;
const UNIFORM_BYTES = 256;
const U32_MAX = 0xffffffff;
const SPARSE_GRID_ACCUMULATOR_BYTES_PER_NODE = 4 * UINT32_BYTES;
const SPARSE_GRID_P2G_BYTES_PER_NODE = 8 * UINT32_BYTES;
const SPARSE_GRID_UPDATED_BYTES_PER_NODE = 8 * UINT32_BYTES;
const SPARSE_GRID_REVERSE_LOOKUP_BYTES_PER_NODE = UINT32_BYTES;
const SPARSE_GRID_HASH_WORDS_PER_SLOT = 2;
const SPARSE_GRID_HASH_LOAD_FACTOR_DENOMINATOR = 2;
const SPARSE_GRID_HASH_MIN_CAPACITY = 16;
const PRODUCT_EVENT_STRIDE_VEC4 = 8;
const PRESSURE_FORCE_STRIDE_VEC4 = 4;
export const SCHROEDER_SPARSE_GRID_HASH_MAX_PROBES = 128;
const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

function integer(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer in [${min}, ${max}]`);
  }
  return number;
}

function alignedBytes(byteLength, alignment = 4) {
  return Math.max(4, Math.ceil(byteLength / alignment) * alignment);
}

function nextPowerOfTwo(value) {
  const requested = Math.max(1, Math.ceil(Number(value) || 1));
  let result = 1;
  while (result < requested) result *= 2;
  return result;
}

function sparseGridViewLayout(gridNodeCapacity) {
  const capacity = Math.max(0, Math.floor(Number(gridNodeCapacity) || 0));
  const hashCapacity = capacity > 0
    ? nextPowerOfTwo(Math.max(
        SPARSE_GRID_HASH_MIN_CAPACITY,
        capacity * SPARSE_GRID_HASH_LOAD_FACTOR_DENOMINATOR
      ))
    : 0;
  const hashKeyWordOffset = SCHROEDER_SPARSE_GRID_VIEW_HEADER_WORDS;
  const hashValueWordOffset = hashKeyWordOffset + hashCapacity;
  const reverseMappingWordOffset = hashValueWordOffset + hashCapacity;
  const viewBufferByteLength = alignedBytes(
    (reverseMappingWordOffset + capacity) * UINT32_BYTES
  );
  return {
    gridNodeCapacity: capacity,
    hashCapacity,
    hashKeyWordOffset,
    hashValueWordOffset,
    reverseMappingWordOffset,
    viewBufferByteLength
  };
}

function dispatchShapeFor(elementCount, maxComputeWorkgroupsPerDimension = 65535) {
  const groupCount = Math.max(1, Math.ceil(elementCount / SCHROEDER_SPARSE_HIERARCHY_WORKGROUP_SIZE));
  const x = Math.min(groupCount, maxComputeWorkgroupsPerDimension);
  const y = Math.ceil(groupCount / x);
  if (y > maxComputeWorkgroupsPerDimension) {
    throw new RangeError(
      `Schroeder sparse hierarchy requires ${groupCount} workgroups, beyond the 2D dispatch limit`
    );
  }
  return [x, y, 1];
}

function scanTransientBytes(plan) {
  return plan.levelCount * UNIFORM_BYTES;
}

function sparseHierarchyArenaBytes({ sourceRowCount, routeCapacity }) {
  const radix = createWebGpuRadixUniquePlan({
    elementCount: routeCapacity,
    keyWordCount: SCHROEDER_SPARSE_HIERARCHY_KEY_WORDS,
    keyStrideWords: SCHROEDER_SPARSE_HIERARCHY_KEY_WORDS
  });
  const sourceScan = createWebGpuU32ScanPlan({ elementCount: sourceRowCount });
  const retainedArenaBytes = alignedBytes(routeCapacity * UINT32_BYTES)
    + radix.sortedIndexByteLength
    + radix.uniqueKeyByteLength
    + radix.uniqueOffsetByteLength
    + radix.evidenceByteLength
    + radix.indirectDispatchByteLength
    + alignedBytes(routeCapacity * SCHROEDER_SPARSE_HIERARCHY_NODE_WORDS * UINT32_BYTES)
    + alignedBytes(SCHROEDER_SPARSE_HIERARCHY_EVIDENCE_WORDS * UINT32_BYTES)
    + alignedBytes(3 * UINT32_BYTES);
  const scratchArenaBytes = alignedBytes(
    routeCapacity * SCHROEDER_SPARSE_HIERARCHY_KEY_WORDS * UINT32_BYTES
  )
    + alignedBytes(sourceRowCount * UINT32_BYTES) * 2
    + radix.sortedIndexByteLength
    + radix.histogramByteLength * 2
    + radix.headByteLength * 2
    + radix.histogramScanPlan.scratchByteLength
    + radix.headScanPlan.scratchByteLength
    + sourceScan.scratchByteLength
    + radix.passCount * UNIFORM_BYTES
    + UNIFORM_BYTES
    + scanTransientBytes(radix.histogramScanPlan)
    + scanTransientBytes(radix.headScanPlan)
    + scanTransientBytes(sourceScan)
    + UNIFORM_BYTES;
  return {
    retainedArenaBytes,
    scratchArenaBytes,
    radixPlan: radix,
    sourceScanPlan: sourceScan,
    largestStorageBufferBytes: Math.max(
      routeCapacity * SCHROEDER_SPARSE_HIERARCHY_NODE_WORDS * UINT32_BYTES,
      routeCapacity * SCHROEDER_SPARSE_HIERARCHY_KEY_WORDS * UINT32_BYTES,
      radix.uniqueKeyByteLength,
      radix.sortedIndexByteLength,
      sourceRowCount * UINT32_BYTES
    )
  };
}

function maximumCapacityWithinBudgets({
  sourceRowCount,
  retainedArenaByteBudget,
  scratchArenaByteBudget,
  upperBound
}) {
  let low = 0;
  let high = Math.max(1, upperBound);
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const bytes = sparseHierarchyArenaBytes({ sourceRowCount, routeCapacity: middle });
    if (
      bytes.retainedArenaBytes <= retainedArenaByteBudget
      && bytes.scratchArenaBytes <= scratchArenaByteBudget
    ) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}

export function createSchroederSparseHierarchyArenaPlan({
  sourceRowCount,
  fineLevel = 0,
  coarseLevel = fineLevel + 1,
  retainedArenaByteBudget = SCHROEDER_SPARSE_HIERARCHY_DEFAULT_RETAINED_ARENA_BYTES,
  scratchArenaByteBudget = SCHROEDER_SPARSE_HIERARCHY_DEFAULT_SCRATCH_ARENA_BYTES,
  routeCapacity = null,
  maxTilesPerSource = SCHROEDER_SPARSE_HIERARCHY_DEFAULT_MAX_TILES_PER_SOURCE,
  maxBufferSize = Number.POSITIVE_INFINITY,
  maxStorageBufferBindingSize = Number.POSITIVE_INFINITY,
  maxComputeWorkgroupsPerDimension = 65535
} = {}) {
  const sourceCount = integer(sourceRowCount, 'sourceRowCount', { min: 1, max: U32_MAX });
  const fine = integer(fineLevel, 'fineLevel', { min: -0x7fffffff, max: 0x7fffffff });
  const coarse = integer(coarseLevel, 'coarseLevel', { min: -0x7fffffff, max: 0x7fffffff });
  if (coarse !== fine + 1) {
    throw new RangeError('Schroeder sparse hierarchy currently admits exactly two adjacent levels');
  }
  const retainedBudget = integer(retainedArenaByteBudget, 'retainedArenaByteBudget', {
    min: 1,
    max: U32_MAX
  });
  const scratchBudget = integer(scratchArenaByteBudget, 'scratchArenaByteBudget', {
    min: 1,
    max: U32_MAX
  });
  const sourceTileLimit = integer(maxTilesPerSource, 'maxTilesPerSource', {
    min: 1,
    max: Math.floor(U32_MAX / sourceCount)
  });
  const possibleRouteCount = Math.min(U32_MAX, sourceCount * sourceTileLimit);
  const maxCapacityByBudget = maximumCapacityWithinBudgets({
    sourceRowCount: sourceCount,
    retainedArenaByteBudget: retainedBudget,
    scratchArenaByteBudget: scratchBudget,
    upperBound: possibleRouteCount
  });
  const requestedCapacity = routeCapacity == null
    ? maxCapacityByBudget
    : integer(routeCapacity, 'routeCapacity', { min: 1, max: possibleRouteCount });
  const capacity = Math.max(1, requestedCapacity);
  const bytes = sparseHierarchyArenaBytes({ sourceRowCount: sourceCount, routeCapacity: capacity });
  let overflowFlags = 0;
  if (bytes.retainedArenaBytes > retainedBudget) {
    overflowFlags |= SCHROEDER_SPARSE_HIERARCHY_OVERFLOW_RETAINED_BUDGET;
  }
  if (bytes.scratchArenaBytes > scratchBudget) {
    overflowFlags |= SCHROEDER_SPARSE_HIERARCHY_OVERFLOW_SCRATCH_BUDGET;
  }
  if (bytes.largestStorageBufferBytes > maxBufferSize
    || bytes.largestStorageBufferBytes > maxStorageBufferBindingSize) {
    overflowFlags |= SCHROEDER_SPARSE_HIERARCHY_OVERFLOW_SCRATCH_BUDGET;
  }
  const admitted = overflowFlags === 0 && maxCapacityByBudget > 0;
  const sourceDispatch = dispatchShapeFor(sourceCount, maxComputeWorkgroupsPerDimension);
  const routeDispatch = dispatchShapeFor(capacity, maxComputeWorkgroupsPerDimension);
  return {
    schema: ULG_SCHROEDER_SPARSE_HIERARCHY_SCHEMA,
    status: admitted
      ? 'schroeder-sparse-two-level-arena-plan-admitted'
      : 'schroeder-sparse-two-level-arena-plan-fail-closed',
    admitted,
    overflowFlags,
    sourceRowCount: sourceCount,
    activeNodeStrideFloats: ACTIVE_NODE_STRIDE_FLOATS,
    fineLevel: fine,
    coarseLevel: coarse,
    levelCount: 2,
    thirdLevelHold: true,
    routeCapacity: capacity,
    maxUniqueNodeCount: capacity,
    maxTilesPerSource: sourceTileLimit,
    possibleRouteCount,
    maxCapacityByBudget,
    retainedArenaByteBudget: retainedBudget,
    scratchArenaByteBudget: scratchBudget,
    retainedArenaBytes: bytes.retainedArenaBytes,
    scratchArenaBytes: bytes.scratchArenaBytes,
    largestStorageBufferBytes: bytes.largestStorageBufferBytes,
    sourceDispatch,
    routeDispatch,
    maxComputeWorkgroupsPerDimension,
    keyWordCount: SCHROEDER_SPARSE_HIERARCHY_KEY_WORDS,
    keyLayout: [...SCHROEDER_SPARSE_HIERARCHY_KEY_LAYOUT],
    compactNodeStrideWords: SCHROEDER_SPARSE_HIERARCHY_NODE_WORDS,
    compactNodeLayout: [...SCHROEDER_SPARSE_HIERARCHY_NODE_LAYOUT],
    evidenceWordCount: SCHROEDER_SPARSE_HIERARCHY_EVIDENCE_WORDS,
    evidenceLayout: [...SCHROEDER_SPARSE_HIERARCHY_EVIDENCE_LAYOUT],
    routeKeyByteLength: alignedBytes(
      capacity * SCHROEDER_SPARSE_HIERARCHY_KEY_WORDS * UINT32_BYTES
    ),
    routeSourceIndexByteLength: alignedBytes(capacity * UINT32_BYTES),
    sourceCountByteLength: alignedBytes(sourceCount * UINT32_BYTES),
    sourceOffsetByteLength: alignedBytes(sourceCount * UINT32_BYTES),
    compactNodeByteLength: alignedBytes(
      capacity * SCHROEDER_SPARSE_HIERARCHY_NODE_WORDS * UINT32_BYTES
    ),
    evidenceByteLength: alignedBytes(SCHROEDER_SPARSE_HIERARCHY_EVIDENCE_WORDS * UINT32_BYTES),
    indirectDispatchByteLength: alignedBytes(3 * UINT32_BYTES),
    radixPlan: bytes.radixPlan,
    sourceScanPlan: bytes.sourceScanPlan,
    arenaPolicy: 'explicit-byte-bounded-retained-and-scratch-arenas',
    compaction: 'exact-stable-u32-radix-unique-csr',
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false,
    submissionOwnership: 'caller'
  };
}

export function createSchroederSparseHierarchyParamsArray(plan, generationId = 0) {
  const generation = integer(generationId, 'generationId', { max: U32_MAX });
  const buffer = new ArrayBuffer(UNIFORM_BYTES);
  const view = new DataView(buffer);
  view.setUint32(0, plan.sourceRowCount, true);
  view.setUint32(4, plan.routeCapacity, true);
  view.setUint32(8, plan.activeNodeStrideFloats, true);
  view.setUint32(12, plan.maxTilesPerSource, true);
  view.setInt32(16, plan.fineLevel, true);
  view.setInt32(20, plan.coarseLevel, true);
  view.setUint32(24, plan.sourceDispatch[0], true);
  view.setUint32(28, plan.routeDispatch[0], true);
  view.setUint32(32, generation, true);
  view.setUint32(36, plan.retainedArenaBytes, true);
  view.setUint32(40, plan.scratchArenaBytes, true);
  view.setUint32(44, SCHROEDER_SPARSE_HIERARCHY_KEY_WORDS, true);
  view.setUint32(48, plan.maxComputeWorkgroupsPerDimension, true);
  return buffer;
}

export const schroederSparseHierarchyWgsl = /* wgsl */ `
struct SparseHierarchyParams {
  source_row_count: u32,
  route_capacity: u32,
  active_node_stride: u32,
  max_tiles_per_source: u32,
  fine_level: i32,
  coarse_level: i32,
  source_dispatch_x: u32,
  route_dispatch_x: u32,
  generation_id: u32,
  retained_arena_bytes: u32,
  scratch_arena_bytes: u32,
  key_word_count: u32,
  max_dispatch_dimension: u32,
};

@group(0) @binding(0) var<storage, read> active_nodes: array<f32>;
@group(0) @binding(1) var<storage, read_write> source_route_counts: array<u32>;
@group(0) @binding(2) var<storage, read> source_route_offsets: array<u32>;
@group(0) @binding(3) var<storage, read_write> route_keys: array<u32>;
@group(0) @binding(4) var<storage, read_write> route_source_indices: array<u32>;
@group(0) @binding(5) var<storage, read_write> evidence: array<atomic<u32>>;
@group(0) @binding(6) var<uniform> params: SparseHierarchyParams;

const KEY_WORDS: u32 = 5u;
const INVALID_KEY: u32 = 0xffffffffu;
const OVERFLOW_ROUTE_ARENA: u32 = 1u;
const OVERFLOW_INVALID_SOURCE: u32 = 2u;
const OVERFLOW_SOURCE_SPAN: u32 = 4u;

fn linear_group(group_id: vec3<u32>, dispatch_x: u32) -> u32 {
  return group_id.x + group_id.y * dispatch_x;
}

fn valid_exact_integer(value: f32) -> bool {
  return value == value && abs(value) <= 16777215.0 && value == round(value);
}

fn sortable_i32(value: i32) -> u32 {
  return bitcast<u32>(value) ^ 0x80000000u;
}

@compute @workgroup_size(64)
fn initialize_routes(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let index = linear_group(group_id, params.route_dispatch_x) * 64u + local_id.x;
  if (index >= params.route_capacity) {
    return;
  }
  if (index == 0u) {
    atomicStore(&evidence[0], params.generation_id);
    atomicStore(&evidence[1], params.source_row_count);
    atomicStore(&evidence[2], params.route_capacity);
    atomicStore(&evidence[3], 0u);
    atomicStore(&evidence[4], 0u);
    atomicStore(&evidence[5], 0u);
    atomicStore(&evidence[6], 0u);
    atomicStore(&evidence[7], 0u);
    atomicStore(&evidence[8], 0u);
    atomicStore(&evidence[9], 0u);
    atomicStore(&evidence[10], params.retained_arena_bytes);
    atomicStore(&evidence[11], params.scratch_arena_bytes);
    atomicStore(&evidence[12], bitcast<u32>(params.fine_level));
    atomicStore(&evidence[13], bitcast<u32>(params.coarse_level));
    atomicStore(&evidence[14], 1u);
    atomicStore(&evidence[15], 1u);
  }
  let key_base = index * KEY_WORDS;
  for (var word = 0u; word < KEY_WORDS; word = word + 1u) {
    route_keys[key_base + word] = INVALID_KEY;
  }
  route_source_indices[index] = INVALID_KEY;
}

@compute @workgroup_size(64)
fn count_routes(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let source_index = linear_group(group_id, params.source_dispatch_x) * 64u + local_id.x;
  if (source_index >= params.source_row_count) {
    return;
  }
  source_route_counts[source_index] = 0u;
  let row = source_index * params.active_node_stride;
  let status = active_nodes[row + 11u];
  let level_value = active_nodes[row + 0u];
  if (!valid_exact_integer(status) || status < 0.0 || !valid_exact_integer(level_value)) {
    atomicAdd(&evidence[8], 1u);
    atomicOr(&evidence[7], OVERFLOW_INVALID_SOURCE);
    return;
  }
  if ((u32(status) & 1u) == 0u) {
    return;
  }
  let level = i32(level_value);
  if (level < params.fine_level || level > params.coarse_level) {
    return;
  }
  let chart_value = active_nodes[row + 15u];
  let min_x_value = active_nodes[row + 1u];
  let min_y_value = active_nodes[row + 2u];
  let min_z_value = active_nodes[row + 3u];
  let max_x_value = active_nodes[row + 4u];
  let max_y_value = active_nodes[row + 5u];
  let max_z_value = active_nodes[row + 6u];
  if (!valid_exact_integer(chart_value)
    || !valid_exact_integer(min_x_value) || !valid_exact_integer(min_y_value)
    || !valid_exact_integer(min_z_value) || !valid_exact_integer(max_x_value)
    || !valid_exact_integer(max_y_value) || !valid_exact_integer(max_z_value)
    || max_x_value < min_x_value || max_y_value < min_y_value || max_z_value < min_z_value) {
    atomicAdd(&evidence[8], 1u);
    atomicOr(&evidence[7], OVERFLOW_INVALID_SOURCE);
    return;
  }
  let span_x = u32(max_x_value - min_x_value + 1.0);
  let span_y = u32(max_y_value - min_y_value + 1.0);
  let span_z = u32(max_z_value - min_z_value + 1.0);
  var within_limit = span_x > 0u && span_y > 0u && span_z > 0u;
  within_limit = within_limit && span_x <= params.max_tiles_per_source;
  within_limit = within_limit && span_y <= params.max_tiles_per_source / max(span_x, 1u);
  let span_xy = select(0u, span_x * span_y, within_limit);
  within_limit = within_limit && span_z <= params.max_tiles_per_source / max(span_xy, 1u);
  if (!within_limit) {
    atomicAdd(&evidence[9], 1u);
    atomicOr(&evidence[7], OVERFLOW_SOURCE_SPAN);
    return;
  }
  let route_count = span_xy * span_z;
  source_route_counts[source_index] = route_count;
  atomicAdd(&evidence[3], route_count);
}

@compute @workgroup_size(64)
fn emit_routes(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let source_index = linear_group(group_id, params.source_dispatch_x) * 64u + local_id.x;
  if (source_index >= params.source_row_count) {
    return;
  }
  let route_count = source_route_counts[source_index];
  if (route_count == 0u) {
    return;
  }
  let row = source_index * params.active_node_stride;
  let level = i32(active_nodes[row + 0u]);
  let chart = i32(active_nodes[row + 15u]);
  let min_x = i32(active_nodes[row + 1u]);
  let min_y = i32(active_nodes[row + 2u]);
  let min_z = i32(active_nodes[row + 3u]);
  let span_x = u32(active_nodes[row + 4u] - active_nodes[row + 1u] + 1.0);
  let span_y = u32(active_nodes[row + 5u] - active_nodes[row + 2u] + 1.0);
  let route_base = source_route_offsets[source_index];
  for (var local_route = 0u; local_route < route_count; local_route = local_route + 1u) {
    let destination = route_base + local_route;
    if (destination >= params.route_capacity) {
      atomicOr(&evidence[7], OVERFLOW_ROUTE_ARENA);
      continue;
    }
    let tile_x = min_x + i32(local_route % span_x);
    let tile_y = min_y + i32((local_route / span_x) % span_y);
    let tile_z = min_z + i32(local_route / (span_x * span_y));
    let key_base = destination * KEY_WORDS;
    route_keys[key_base + 0u] = sortable_i32(chart);
    route_keys[key_base + 1u] = sortable_i32(level);
    route_keys[key_base + 2u] = sortable_i32(tile_x);
    route_keys[key_base + 3u] = sortable_i32(tile_y);
    route_keys[key_base + 4u] = sortable_i32(tile_z);
    route_source_indices[destination] = source_index;
  }
}
`;

export const schroederSparseHierarchyFinalizeWgsl = /* wgsl */ `
@group(0) @binding(0) var<storage, read> primitive_evidence: array<u32>;
@group(0) @binding(1) var<storage, read_write> evidence: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> compact_dispatch: array<u32>;
@group(0) @binding(3) var<uniform> params: SparseHierarchyParams;

struct SparseHierarchyParams {
  source_row_count: u32,
  route_capacity: u32,
  active_node_stride: u32,
  max_tiles_per_source: u32,
  fine_level: i32,
  coarse_level: i32,
  source_dispatch_x: u32,
  route_dispatch_x: u32,
  generation_id: u32,
  retained_arena_bytes: u32,
  scratch_arena_bytes: u32,
  key_word_count: u32,
  max_dispatch_dimension: u32,
};

const STATUS_READY: u32 = 1u;
const STATUS_ADMITTED: u32 = 2u;
const STATUS_FAIL_CLOSED: u32 = 4u;
const OVERFLOW_ROUTE_ARENA: u32 = 1u;

@compute @workgroup_size(1)
fn finalize_admission() {
  let source_count = atomicLoad(&evidence[1]);
  let route_capacity = atomicLoad(&evidence[2]);
  let requested = atomicLoad(&evidence[3]);
  let emitted = min(requested, route_capacity);
  atomicStore(&evidence[4], emitted);
  if (requested > route_capacity) {
    atomicOr(&evidence[7], OVERFLOW_ROUTE_ARENA);
  }
  let padded_sentinel_present = emitted < route_capacity;
  let primitive_unique_count = primitive_evidence[2];
  let valid_unique_count = primitive_unique_count
    - select(0u, 1u, padded_sentinel_present && primitive_unique_count > 0u);
  atomicStore(&evidence[5], valid_unique_count);
  let overflow_flags = atomicLoad(&evidence[7]);
  let admitted = overflow_flags == 0u && source_count > 0u && requested <= route_capacity;
  atomicStore(&evidence[6], select(0u, 1u, admitted));
  atomicStore(&evidence[14], STATUS_READY
    | select(STATUS_FAIL_CLOSED, STATUS_ADMITTED, admitted));
  let group_count = (valid_unique_count + 63u) / 64u;
  let dispatch_x = min(group_count, params.max_dispatch_dimension);
  var dispatch_y = 1u;
  if (dispatch_x > 0u) {
    dispatch_y = (group_count + dispatch_x - 1u) / dispatch_x;
  }
  compact_dispatch[0] = dispatch_x;
  compact_dispatch[1] = dispatch_y;
  compact_dispatch[2] = 1u;
}
`;

export const schroederSparseHierarchyMaterializeWgsl = /* wgsl */ `
@group(0) @binding(0) var<storage, read> unique_keys: array<u32>;
@group(0) @binding(1) var<storage, read> unique_offsets: array<u32>;
@group(0) @binding(2) var<storage, read_write> evidence: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> compact_nodes: array<u32>;
@group(0) @binding(4) var<uniform> params: SparseHierarchyParams;

struct SparseHierarchyParams {
  source_row_count: u32,
  route_capacity: u32,
  active_node_stride: u32,
  max_tiles_per_source: u32,
  fine_level: i32,
  coarse_level: i32,
  source_dispatch_x: u32,
  route_dispatch_x: u32,
  generation_id: u32,
  retained_arena_bytes: u32,
  scratch_arena_bytes: u32,
  key_word_count: u32,
  max_dispatch_dimension: u32,
};

const KEY_WORDS: u32 = 5u;
const NODE_WORDS: u32 = 16u;

@compute @workgroup_size(64)
fn materialize_nodes(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let unique_count = atomicLoad(&evidence[5]);
  let group_count = (unique_count + 63u) / 64u;
  let dispatch_x = min(group_count, params.max_dispatch_dimension);
  let node_index = (group_id.x + group_id.y * dispatch_x) * 64u + local_id.x;
  if (atomicLoad(&evidence[6]) == 0u || node_index >= unique_count) {
    return;
  }
  let key_base = node_index * KEY_WORDS;
  let node_base = node_index * NODE_WORDS;
  for (var word = 0u; word < KEY_WORDS; word = word + 1u) {
    compact_nodes[node_base + word] = unique_keys[key_base + word];
  }
  let span_start = unique_offsets[node_index];
  let span_end = unique_offsets[node_index + 1u];
  compact_nodes[node_base + 5u] = span_start;
  compact_nodes[node_base + 6u] = span_end;
  compact_nodes[node_base + 7u] = span_end - span_start;
  compact_nodes[node_base + 8u] = unique_keys[key_base + 1u] ^ 0x80000000u;
  compact_nodes[node_base + 9u] = unique_keys[key_base + 0u] ^ 0x80000000u;
  compact_nodes[node_base + 10u] = unique_keys[key_base + 2u] ^ 0x80000000u;
  compact_nodes[node_base + 11u] = unique_keys[key_base + 3u] ^ 0x80000000u;
  compact_nodes[node_base + 12u] = unique_keys[key_base + 4u] ^ 0x80000000u;
  compact_nodes[node_base + 13u] = atomicLoad(&evidence[0]);
  compact_nodes[node_base + 14u] = 1u;
  compact_nodes[node_base + 15u] = 0u;
}
`;

function assertDevice(device) {
  if (!device?.createBuffer || !device?.createShaderModule
    || !device?.createComputePipeline || !device?.createBindGroup
    || !device?.queue?.writeBuffer) {
    throw new TypeError('Schroeder sparse hierarchy requires a WebGPU-like device');
  }
}

function createBuffer(device, label, size, extraUsage = 0) {
  const byteLength = alignedBytes(size);
  const maxBufferSize = Number(device.limits?.maxBufferSize ?? Number.POSITIVE_INFINITY);
  const maxStorageBufferBindingSize = Number(
    device.limits?.maxStorageBufferBindingSize ?? Number.POSITIVE_INFINITY
  );
  if (byteLength > maxBufferSize || byteLength > maxStorageBufferBindingSize) {
    throw new RangeError(`${label} byte length ${byteLength} exceeds the WebGPU device limit`);
  }
  return device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
      | GPU_BUFFER_USAGE.COPY_DST | extraUsage
  });
}

function createPipelines(device, label) {
  const buildModule = device.createShaderModule({
    label: `${label}-build-shader`,
    code: schroederSparseHierarchyWgsl
  });
  const finalizeModule = device.createShaderModule({
    label: `${label}-finalize-shader`,
    code: schroederSparseHierarchyFinalizeWgsl
  });
  const materializeModule = device.createShaderModule({
    label: `${label}-materialize-shader`,
    code: schroederSparseHierarchyMaterializeWgsl
  });
  const pipeline = (suffix, module, entryPoint) => device.createComputePipeline({
    label: `${label}-${suffix}`,
    layout: 'auto',
    compute: { module, entryPoint }
  });
  return {
    initialize: pipeline('initialize-routes', buildModule, 'initialize_routes'),
    count: pipeline('count-routes', buildModule, 'count_routes'),
    emit: pipeline('emit-routes', buildModule, 'emit_routes'),
    finalize: pipeline('finalize-admission', finalizeModule, 'finalize_admission'),
    materialize: pipeline('materialize-nodes', materializeModule, 'materialize_nodes')
  };
}

function timestampPassDescriptor(timestampProfiler, label, metadata) {
  return timestampProfiler?.beginComputePassDescriptor
    ? timestampProfiler.beginComputePassDescriptor(label, metadata)
    : { label };
}

function activeNodeCount(activeNodeList) {
  return integer(
    activeNodeList?.activeCandidateCount ?? activeNodeList?.particleCount,
    'activeNodeList.activeCandidateCount',
    { min: 1, max: U32_MAX }
  );
}

function assertActiveNodeList(activeNodeList, plan) {
  if (
    activeNodeList?.schema !== ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA
    && activeNodeList?.schema !== ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA
  ) {
    throw new TypeError('Schroeder sparse hierarchy requires a Schroeder active-node list');
  }
  if (activeNodeCount(activeNodeList) !== plan.sourceRowCount) {
    throw new RangeError('Schroeder sparse hierarchy source row count must match its arena plan');
  }
  const stride = integer(
    activeNodeList.activeNodeStrideFloats ?? ACTIVE_NODE_STRIDE_FLOATS,
    'activeNodeList.activeNodeStrideFloats',
    { min: 1 }
  );
  if (stride !== ACTIVE_NODE_STRIDE_FLOATS) {
    throw new RangeError('Schroeder sparse hierarchy requires the current active-node row layout');
  }
  const buffer = activeNodeList.activeNodeBuffer ?? activeNodeList.buffer ?? null;
  if (!buffer) {
    throw new TypeError('Schroeder sparse hierarchy requires a retained active-node GPUBuffer');
  }
  return buffer;
}

export function createSchroederSparseHierarchyGpu(device, {
  plan,
  label = 'ulg-schroeder-sparse-hierarchy'
} = {}) {
  assertDevice(device);
  if (plan?.schema !== ULG_SCHROEDER_SPARSE_HIERARCHY_SCHEMA) {
    throw new TypeError('createSchroederSparseHierarchyGpu requires a sparse hierarchy arena plan');
  }
  if (!plan.admitted) {
    throw new RangeError('Schroeder sparse hierarchy arena plan is not admitted');
  }
  const pipelines = createPipelines(device, label);
  const routeCountBuffer = createBuffer(device, `${label}-source-route-counts`, plan.sourceCountByteLength);
  const routeOffsetBuffer = createBuffer(device, `${label}-source-route-offsets`, plan.sourceOffsetByteLength);
  const routeKeyBuffer = createBuffer(device, `${label}-route-keys`, plan.routeKeyByteLength);
  const routeSourceIndexBuffer = createBuffer(
    device,
    `${label}-route-source-indices`,
    plan.routeSourceIndexByteLength
  );
  const compactNodeBuffer = createBuffer(device, `${label}-compact-nodes`, plan.compactNodeByteLength);
  const evidenceBuffer = createBuffer(device, `${label}-evidence`, plan.evidenceByteLength);
  const compactDispatchIndirectBuffer = createBuffer(
    device,
    `${label}-compact-dispatch`,
    plan.indirectDispatchByteLength,
    GPU_BUFFER_USAGE.INDIRECT
  );
  const sourceScan = createWebGpuU32ExclusiveScan(device, {
    maxElementCount: plan.sourceRowCount,
    label: `${label}-source-route-scan`,
    maxComputeWorkgroupsPerDimension: plan.maxComputeWorkgroupsPerDimension
  });
  const radixUnique = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: plan.routeCapacity,
    maxKeyWordCount: SCHROEDER_SPARSE_HIERARCHY_KEY_WORDS,
    label: `${label}-route-radix-unique`,
    maxComputeWorkgroupsPerDimension: plan.maxComputeWorkgroupsPerDimension
  });
  const retainedAllocations = [
    { role: 'route-source-membership', buffer: routeSourceIndexBuffer },
    { role: 'compact-unique-nodes', buffer: compactNodeBuffer },
    { role: 'fixed-admission-evidence', buffer: evidenceBuffer },
    { role: 'compact-node-indirect-dispatch', buffer: compactDispatchIndirectBuffer }
  ];
  const scratchAllocations = [
    { role: 'source-route-counts', buffer: routeCountBuffer },
    { role: 'source-route-offsets', buffer: routeOffsetBuffer },
    { role: 'expanded-route-keys', buffer: routeKeyBuffer }
  ];
  let destroyed = false;

  function encode(encoder, {
    activeNodeList,
    generationId = 0,
    timestampProfiler = null,
    timestampMetadata = {}
  } = {}) {
    if (destroyed) throw new Error(`${label} is destroyed`);
    if (!encoder?.beginComputePass || !encoder?.clearBuffer) {
      throw new TypeError('Schroeder sparse hierarchy encoding requires a caller-owned GPUCommandEncoder');
    }
    const activeNodeBuffer = assertActiveNodeList(activeNodeList, plan);
    const generation = integer(generationId, 'generationId', { max: U32_MAX });
    const paramsBuffer = device.createBuffer({
      label: `${label}-params-${generation}`,
      size: UNIFORM_BYTES,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederSparseHierarchyParamsArray(plan, generation));
    encoder.clearBuffer(routeCountBuffer);
    encoder.clearBuffer(routeOffsetBuffer);
    encoder.clearBuffer(compactNodeBuffer);
    encoder.clearBuffer(evidenceBuffer);
    encoder.clearBuffer(compactDispatchIndirectBuffer);
    const initializeBindGroup = device.createBindGroup({
      label: `${label}-initialize-bind-group-${generation}`,
      layout: pipelines.initialize.getBindGroupLayout(0),
      entries: [
        { binding: 3, resource: { buffer: routeKeyBuffer } },
        { binding: 4, resource: { buffer: routeSourceIndexBuffer } },
        { binding: 5, resource: { buffer: evidenceBuffer } },
        { binding: 6, resource: { buffer: paramsBuffer, size: 64 } }
      ]
    });
    const countBindGroup = device.createBindGroup({
      label: `${label}-count-bind-group-${generation}`,
      layout: pipelines.count.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: activeNodeBuffer } },
        { binding: 1, resource: { buffer: routeCountBuffer } },
        { binding: 5, resource: { buffer: evidenceBuffer } },
        { binding: 6, resource: { buffer: paramsBuffer, size: 64 } }
      ]
    });
    const emitBindGroup = device.createBindGroup({
      label: `${label}-emit-bind-group-${generation}`,
      layout: pipelines.emit.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: activeNodeBuffer } },
        { binding: 1, resource: { buffer: routeCountBuffer } },
        { binding: 2, resource: { buffer: routeOffsetBuffer } },
        { binding: 3, resource: { buffer: routeKeyBuffer } },
        { binding: 4, resource: { buffer: routeSourceIndexBuffer } },
        { binding: 5, resource: { buffer: evidenceBuffer } },
        { binding: 6, resource: { buffer: paramsBuffer, size: 64 } }
      ]
    });
    let pass = encoder.beginComputePass(timestampPassDescriptor(
      timestampProfiler,
      `${label}InitializeRoutes`,
      { ...timestampMetadata, generationId: generation }
    ));
    pass.setPipeline(pipelines.initialize);
    pass.setBindGroup(0, initializeBindGroup);
    pass.dispatchWorkgroups(...plan.routeDispatch);
    pass.end();

    pass = encoder.beginComputePass(timestampPassDescriptor(
      timestampProfiler,
      `${label}CountRoutes`,
      { ...timestampMetadata, generationId: generation }
    ));
    pass.setPipeline(pipelines.count);
    pass.setBindGroup(0, countBindGroup);
    pass.dispatchWorkgroups(...plan.sourceDispatch);
    pass.end();

    const sourceScanEncoding = sourceScan.prepare({
      inputBuffer: routeCountBuffer,
      outputBuffer: routeOffsetBuffer,
      elementCount: plan.sourceRowCount
    });
    sourceScan.encodePrepared(encoder, sourceScanEncoding, {
      timestampProfiler,
      timestampMetadata: { ...timestampMetadata, generationId: generation },
      labelPrefix: `${label}SourceRoute`
    });

    pass = encoder.beginComputePass(timestampPassDescriptor(
      timestampProfiler,
      `${label}EmitRoutes`,
      { ...timestampMetadata, generationId: generation }
    ));
    pass.setPipeline(pipelines.emit);
    pass.setBindGroup(0, emitBindGroup);
    pass.dispatchWorkgroups(...plan.sourceDispatch);
    pass.end();

    const radixEncoding = radixUnique.encodeSortUnique(encoder, {
      keyBuffer: routeKeyBuffer,
      elementCount: plan.routeCapacity,
      keyWordCount: SCHROEDER_SPARSE_HIERARCHY_KEY_WORDS,
      keyStrideWords: SCHROEDER_SPARSE_HIERARCHY_KEY_WORDS,
      generationId: generation,
      consumerWorkgroupSize: SCHROEDER_SPARSE_HIERARCHY_WORKGROUP_SIZE,
      timestampProfiler,
      timestampMetadata
    });
    const finalizeBindGroup = device.createBindGroup({
      label: `${label}-finalize-bind-group-${generation}`,
      layout: pipelines.finalize.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: radixEncoding.uniqueEvidenceBuffer } },
        { binding: 1, resource: { buffer: evidenceBuffer } },
        { binding: 2, resource: { buffer: compactDispatchIndirectBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer, size: 64 } }
      ]
    });
    pass = encoder.beginComputePass(timestampPassDescriptor(
      timestampProfiler,
      `${label}FinalizeAdmission`,
      { ...timestampMetadata, generationId: generation }
    ));
    pass.setPipeline(pipelines.finalize);
    pass.setBindGroup(0, finalizeBindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();

    const materializeBindGroup = device.createBindGroup({
      label: `${label}-materialize-bind-group-${generation}`,
      layout: pipelines.materialize.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: radixEncoding.uniqueKeysBuffer } },
        { binding: 1, resource: { buffer: radixEncoding.uniqueOffsetsBuffer } },
        { binding: 2, resource: { buffer: evidenceBuffer } },
        { binding: 3, resource: { buffer: compactNodeBuffer } },
        { binding: 4, resource: { buffer: paramsBuffer, size: 64 } }
      ]
    });
    pass = encoder.beginComputePass(timestampPassDescriptor(
      timestampProfiler,
      `${label}MaterializeNodes`,
      { ...timestampMetadata, generationId: generation }
    ));
    pass.setPipeline(pipelines.materialize);
    pass.setBindGroup(0, materializeBindGroup);
    pass.dispatchWorkgroupsIndirect(compactDispatchIndirectBuffer, 0);
    pass.end();

    return {
      ...plan,
      schema: ULG_SCHROEDER_SPARSE_HIERARCHY_EXECUTION_SCHEMA,
      sparseHierarchySchema: plan.schema,
      status: 'schroeder-sparse-two-level-hierarchy-encoded',
      generationId: generation,
      activeNodeSourceSchema: activeNodeList.schema,
      activeNodeSourceStatus: activeNodeList.status ?? null,
      activeNodeSourceTileCellCount: integer(
        activeNodeList.tileCellCount ?? 8,
        'activeNodeList.tileCellCount',
        { min: 1, max: 64 }
      ),
      compactNodeBuffer,
      compactNodeBufferByteLength: plan.compactNodeByteLength,
      routeSourceIndexBuffer,
      sortedRouteIndexBuffer: radixEncoding.sortedIndicesBuffer,
      sourceMembershipOffsetBuffer: radixEncoding.uniqueOffsetsBuffer,
      uniqueKeyBuffer: radixEncoding.uniqueKeysBuffer,
      evidenceBuffer,
      compactDispatchIndirectBuffer,
      retainedGpuBuffers: true,
      readbackMode: 'no-full-readback',
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: true,
      stateMutationStatus: 'sparse-hierarchy-derived-no-authoritative-state-mutation',
      authorityStatus: 'compute-manager-gpuhub-lane-retained-artifact-awaiting-consumer',
      sourceMembershipEncoding: 'stable-route-permutation-plus-exact-unique-csr',
      radixPassCount: radixEncoding.radixPassCount,
      transientBuffers: [paramsBuffer],
      sourceScanEncoding,
      radixEncoding,
      releaseTransientBuffers() {
        sourceScan.releaseTransientBuffers(sourceScanEncoding);
        radixUnique.releaseTransientBuffers(radixEncoding);
        paramsBuffer.destroy?.();
      }
    };
  }

  return {
    schema: ULG_SCHROEDER_SPARSE_HIERARCHY_SCHEMA,
    status: 'schroeder-sparse-two-level-hierarchy-runtime-ready',
    plan,
    encode,
    allocationEntries() {
      return {
        retained: [
          ...retainedAllocations,
          ...radixUnique.allocationEntries().filter(({ role }) => (
            role === 'radix-sorted-indices-a'
            || role === 'unique-keys'
            || role === 'unique-offsets'
            || role === 'unique-evidence'
            || role === 'unique-dispatch-indirect'
          ))
        ],
        scratch: [
          ...scratchAllocations,
          ...sourceScan.allocationEntries(),
          ...radixUnique.allocationEntries().filter(({ role }) => !(
            role === 'radix-sorted-indices-a'
            || role === 'unique-keys'
            || role === 'unique-offsets'
            || role === 'unique-evidence'
            || role === 'unique-dispatch-indirect'
          ))
        ]
      };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const { buffer } of [...retainedAllocations, ...scratchAllocations]) {
        buffer.destroy?.();
      }
      sourceScan.destroy();
      radixUnique.destroy();
    }
  };
}

function gridDims(value) {
  if (!Array.isArray(value) || value.length < 3) {
    throw new TypeError('Schroeder sparse grid view requires three grid dimensions');
  }
  return value.slice(0, 3).map((entry, axis) => integer(
    entry,
    `gridDims[${axis}]`,
    { min: 1, max: U32_MAX }
  ));
}

function sparseGridRadixArenaLayout(gridNodeCapacity, {
  minUniformBufferOffsetAlignment = UNIFORM_BYTES,
  retainedParamsSlotCount = WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_DEFAULT
} = {}) {
  const radixPlan = createWebGpuRadixUniquePlan({
    elementCount: Math.max(1, gridNodeCapacity),
    keyWordCount: 1,
    keyStrideWords: 1
  });
  const paramsOffsetAlignment = Math.max(
    UNIFORM_BYTES,
    integer(
      minUniformBufferOffsetAlignment,
      'minUniformBufferOffsetAlignment',
      { min: 1, max: U32_MAX }
    )
  );
  const resolvedRetainedParamsSlotCount = integer(
    retainedParamsSlotCount,
    'retainedParamsSlotCount',
    { min: 1, max: WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_MAX }
  );
  const radixParamsSlotStrideByteLength = radixPlan.passCount * paramsOffsetAlignment;
  const uniqueParamsSlotStrideByteLength = paramsOffsetAlignment;
  const retainedParamsArenaByteLength = resolvedRetainedParamsSlotCount * (
    radixParamsSlotStrideByteLength + uniqueParamsSlotStrideByteLength
  );
  const retainedScanParamsByteLength = (
    radixPlan.histogramScanPlan.levelCount + radixPlan.headScanPlan.levelCount
  ) * UNIFORM_BYTES;
  const retainedByteLength =
    radixPlan.sortedIndexByteLength * 2
    + radixPlan.histogramByteLength * 2
    + radixPlan.headByteLength * 2
    + radixPlan.uniqueKeyByteLength
    + radixPlan.uniqueOffsetByteLength
    + radixPlan.evidenceByteLength
    + radixPlan.indirectDispatchByteLength
    + radixPlan.histogramScanPlan.scratchByteLength
    + radixPlan.headScanPlan.scratchByteLength
    + retainedScanParamsByteLength
    + retainedParamsArenaByteLength;
  const transientByteLength = 0;
  const scanLargestBuffer = (scanPlan) => scanPlan.levels.reduce(
    (largest, scanLevel) => Math.max(
      largest,
      scanLevel.blockSumsByteLength,
      scanLevel.blockOffsetsByteLength
    ),
    0
  );
  return {
    radixPlan,
    paramsOffsetAlignment,
    retainedParamsSlotCount: resolvedRetainedParamsSlotCount,
    radixParamsSlotStrideByteLength,
    uniqueParamsSlotStrideByteLength,
    retainedParamsArenaByteLength,
    retainedScanParamsByteLength,
    radixRetainedByteLength: retainedByteLength,
    radixTransientByteLength: transientByteLength,
    radixPeakByteLength: retainedByteLength + transientByteLength,
    radixLargestStorageBufferByteLength: Math.max(
      radixPlan.sortedIndexByteLength,
      radixPlan.histogramByteLength,
      radixPlan.headByteLength,
      radixPlan.uniqueKeyByteLength,
      radixPlan.uniqueOffsetByteLength,
      scanLargestBuffer(radixPlan.histogramScanPlan),
      scanLargestBuffer(radixPlan.headScanPlan)
    )
  };
}

function sparseGridActualNodeArenaLayout(gridNodeCapacity, paramsArenaOptions = {}) {
  const capacity = Math.max(0, Math.floor(Number(gridNodeCapacity) || 0));
  const viewLayout = sparseGridViewLayout(capacity);
  const radix = sparseGridRadixArenaLayout(Math.max(1, capacity), paramsArenaOptions);
  const candidateKeyBufferByteLength = alignedBytes(capacity * UINT32_BYTES);
  const dispatchIndirectByteLength = alignedBytes(
    SCHROEDER_SPARSE_GRID_VIEW_DISPATCH_WORDS * UINT32_BYTES
  );
  const accumulatorBufferByteLength = alignedBytes(
    capacity * SPARSE_GRID_ACCUMULATOR_BYTES_PER_NODE
  );
  const p2gGridBufferByteLength = alignedBytes(capacity * SPARSE_GRID_P2G_BYTES_PER_NODE);
  const updatedGridBufferByteLength = alignedBytes(
    capacity * SPARSE_GRID_UPDATED_BYTES_PER_NODE
  );
  const mechanicsByteLength = accumulatorBufferByteLength
    + p2gGridBufferByteLength
    + updatedGridBufferByteLength;
  const retainedCompactionByteLength = viewLayout.viewBufferByteLength
    + candidateKeyBufferByteLength
    + dispatchIndirectByteLength
    + radix.radixRetainedByteLength;
  const transientCompactionByteLength = radix.radixTransientByteLength + UNIFORM_BYTES;
  return {
    ...viewLayout,
    ...radix,
    candidateKeyBufferByteLength,
    dispatchIndirectByteLength,
    accumulatorBufferByteLength,
    p2gGridBufferByteLength,
    updatedGridBufferByteLength,
    mechanicsByteLength,
    retainedCompactionByteLength,
    transientCompactionByteLength,
    peakAllocatedByteLength: retainedCompactionByteLength
      + transientCompactionByteLength
      + mechanicsByteLength,
    largestStorageBufferByteLength: Math.max(
      viewLayout.viewBufferByteLength,
      candidateKeyBufferByteLength,
      accumulatorBufferByteLength,
      p2gGridBufferByteLength,
      updatedGridBufferByteLength,
      radix.radixLargestStorageBufferByteLength
    )
  };
}

export function createSchroederSparseGridViewPlan({
  gridDims: requestedGridDims,
  gridShift = 1,
  gridSpacingM = null,
  selectedLevel = 0,
  chartId = 0,
  tileCellCount = 8,
  activeTileCapacity = null,
  particleCapacity = activeTileCapacity,
  particleStateStrideVec4 = 2,
  levelAssignmentStrideFloats = 16,
  arenaByteBudget = SCHROEDER_SPARSE_GRID_DEFAULT_ARENA_BYTES,
  maxBufferSize = Number.POSITIVE_INFINITY,
  maxStorageBufferBindingSize = Number.POSITIVE_INFINITY,
  maxComputeWorkgroupsPerDimension = 65535,
  minUniformBufferOffsetAlignment = UNIFORM_BYTES,
  retainedParamsSlotCount = WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_DEFAULT
} = {}) {
  const dims = gridDims(requestedGridDims);
  const fullGridNodeCount = dims.reduce((product, value) => product * value, 1);
  if (!Number.isSafeInteger(fullGridNodeCount) || fullGridNodeCount > U32_MAX) {
    throw new RangeError('Schroeder sparse grid full node count exceeds u32 addressing');
  }
  const shift = integer(gridShift, 'gridShift', { min: 0, max: 0x7fffffff });
  const productionGridSpacing = gridSpacingM == null ? null : Number(gridSpacingM);
  if (productionGridSpacing != null
    && (!Number.isFinite(productionGridSpacing) || !(productionGridSpacing > 0))) {
    throw new RangeError('gridSpacingM must be a positive finite number when provided');
  }
  const level = integer(selectedLevel, 'selectedLevel', {
    min: -0x7fffffff,
    max: 0x7fffffff
  });
  const chart = integer(chartId, 'chartId', { min: -0x7fffffff, max: 0x7fffffff });
  const cellsPerTileAxis = integer(tileCellCount, 'tileCellCount', { min: 1, max: 64 });
  const sourceParticleCapacity = integer(particleCapacity, 'particleCapacity', {
    min: 1,
    max: U32_MAX
  });
  const stateStrideVec4 = integer(particleStateStrideVec4, 'particleStateStrideVec4', {
    min: 1,
    max: 0xffff
  });
  const assignmentStride = integer(
    levelAssignmentStrideFloats,
    'levelAssignmentStrideFloats',
    { min: 2, max: 0xffff }
  );
  const sourceWorkgroupCount = Math.ceil(
    sourceParticleCapacity / SCHROEDER_SPARSE_HIERARCHY_WORKGROUP_SIZE
  );
  const buildInvocationAddressable = sourceWorkgroupCount <= maxComputeWorkgroupsPerDimension;
  const budget = integer(arenaByteBudget, 'arenaByteBudget', { min: 1, max: U32_MAX });
  const layoutForCapacity = (capacity) => sparseGridActualNodeArenaLayout(capacity, {
    minUniformBufferOffsetAlignment,
    retainedParamsSlotCount
  });
  const capacityFits = (capacity) => {
    if (!(capacity > 0)) return false;
    const layout = layoutForCapacity(capacity);
    return layout.hashCapacity <= U32_MAX
      && layout.viewBufferByteLength <= maxBufferSize
      && layout.viewBufferByteLength <= maxStorageBufferBindingSize
      && layout.accumulatorBufferByteLength <= maxBufferSize
      && layout.accumulatorBufferByteLength <= maxStorageBufferBindingSize
      && layout.p2gGridBufferByteLength <= maxBufferSize
      && layout.p2gGridBufferByteLength <= maxStorageBufferBindingSize
      && layout.updatedGridBufferByteLength <= maxBufferSize
      && layout.updatedGridBufferByteLength <= maxStorageBufferBindingSize
      && layout.candidateKeyBufferByteLength <= maxBufferSize
      && layout.candidateKeyBufferByteLength <= maxStorageBufferBindingSize
      && layout.retainedParamsArenaByteLength <= maxBufferSize
      && layout.largestStorageBufferByteLength <= maxBufferSize
      && layout.largestStorageBufferByteLength <= maxStorageBufferBindingSize
      && layout.peakAllocatedByteLength <= budget;
  };
  let low = 0;
  let high = fullGridNodeCount;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (capacityFits(middle)) low = middle;
    else high = middle - 1;
  }
  const gridNodeCapacity = low;
  const layout = layoutForCapacity(gridNodeCapacity);
  const {
    hashCapacity,
    hashKeyWordOffset,
    hashValueWordOffset,
    reverseMappingWordOffset,
    viewBufferByteLength,
    accumulatorBufferByteLength,
    p2gGridBufferByteLength,
    updatedGridBufferByteLength,
    mechanicsByteLength,
    candidateKeyBufferByteLength,
    dispatchIndirectByteLength,
    retainedCompactionByteLength,
    transientCompactionByteLength,
    peakAllocatedByteLength,
    radixPlan,
    paramsOffsetAlignment,
    retainedParamsSlotCount: resolvedRetainedParamsSlotCount,
    radixParamsSlotStrideByteLength,
    uniqueParamsSlotStrideByteLength,
    retainedParamsArenaByteLength,
    retainedScanParamsByteLength,
    radixRetainedByteLength,
    radixTransientByteLength,
    radixPeakByteLength,
    largestStorageBufferByteLength
  } = layout;
  const admitted = buildInvocationAddressable
    && gridNodeCapacity > 0
    && capacityFits(gridNodeCapacity);
  return {
    schema: ULG_SCHROEDER_SPARSE_GRID_VIEW_SCHEMA,
    status: admitted
      ? 'schroeder-sparse-grid-actual-node-plan-admitted'
      : 'schroeder-sparse-grid-actual-node-plan-fail-closed',
    admitted,
    gridDims: dims,
    gridShift: shift,
    gridSpacingM: productionGridSpacing,
    selectedLevel: level,
    chartId: chart,
    tileCellCount: cellsPerTileAxis,
    activeTileCapacity: activeTileCapacity == null
      ? null
      : integer(activeTileCapacity, 'activeTileCapacity', { min: 1, max: U32_MAX }),
    sourceParticleCapacity,
    particleStateStrideVec4: stateStrideVec4,
    levelAssignmentStrideFloats: assignmentStride,
    stencilWidth: SCHROEDER_SPARSE_GRID_VIEW_STENCIL_WIDTH,
    stencilNodeCount: SCHROEDER_SPARSE_GRID_VIEW_STENCIL_NODE_COUNT,
    declaredBuildInvocationCapacity: sourceParticleCapacity,
    buildInvocationAddressable,
    sourceParticleDispatch: [Math.max(1, sourceWorkgroupCount), 1, 1],
    declaredActivityNodeCapacity: null,
    declaredActivityCapacityFullyAdmitted: null,
    fullGridNodeCount,
    gridNodeCapacity,
    hashCapacity,
    hashMaxProbes: SCHROEDER_SPARSE_GRID_HASH_MAX_PROBES,
    hashLoadFactorMaximum: 1 / SPARSE_GRID_HASH_LOAD_FACTOR_DENOMINATOR,
    arenaByteBudget: budget,
    viewBufferByteLength,
    accumulatorBufferByteLength,
    p2gGridBufferByteLength,
    updatedGridBufferByteLength,
    mechanicsByteLength,
    candidateKeyBufferByteLength,
    retainedCompactionByteLength,
    transientCompactionByteLength,
    peakAllocatedByteLength,
    radixPlan,
    radixPassCount: radixPlan.passCount,
    radixParamsOffsetAlignment: paramsOffsetAlignment,
    radixRetainedParamsSlotCount: resolvedRetainedParamsSlotCount,
    radixParamsSlotStrideByteLength,
    uniqueParamsSlotStrideByteLength,
    radixRetainedParamsArenaByteLength: retainedParamsArenaByteLength,
    radixRetainedScanParamsByteLength: retainedScanParamsByteLength,
    radixRetainedByteLength,
    radixTransientByteLength,
    radixPeakByteLength,
    largestStorageBufferByteLength,
    mappingWordOffset: hashKeyWordOffset,
    hashKeyWordOffset,
    hashValueWordOffset,
    reverseMappingWordOffset,
    dispatchIndirectByteLength,
    dispatchIndirectByteOffset: 0,
    buildDispatchIndirectByteOffset: 6 * UINT32_BYTES,
    hashInitDispatchIndirectByteOffset: 3 * UINT32_BYTES,
    materializeDispatchIndirectByteOffset: 6 * UINT32_BYTES,
    maxComputeWorkgroupsPerDimension,
    storageMode: 'byte-bounded-actual-p2g-node-radix-compact-grid-arena',
    lookupInitializationScope: 'gpu-byte-bounded-hash-and-candidate-arena-no-full-grid-clear',
    tileExpansionMode: 'disabled-actual-current-particle-quadratic-stencil-keys',
    candidateGenerationMode: 'source-family-parallel-exact-touched-grid-node-keys',
    gridSpacingAuthority: productionGridSpacing == null
      ? 'schroeder-level-assignment-native-grid-spacing'
      : 'production-p2g-grid-spacing',
    compactionMode: 'open-addressed-dedup-then-stable-u32-radix-scan-unique',
    compactOrdering: 'ascending-full-grid-node-index',
    runtimeOverflowPolicy: 'fixed-header-evidence-and-zero-consumer-indirect',
    admissionMode: 'same-device-gpu-evidence-and-zero-indirect-fail-closed',
    supportedSourceFamilies: [
      'particle-state',
      'reaction-product-events',
      'pressure-force-rows'
    ],
    failClosedSourceFamilies: [],
    memoryAuthority: 'unique-node-capacity-not-route-or-tile-cell-capacity',
    fullParticleReadbackRequired: false,
    cpuReferenceRequired: false
  };
}

export function createSchroederSparseGridViewParamsArray(plan, generationId = 0, {
  hierarchyGenerationId = generationId,
  residentParticleCount = false,
  unsupportedSourceFamilyMask = 0,
  sourceIdentityMismatch = false,
  productEventSource = null,
  pressureForceSource = null
} = {}) {
  const buffer = new ArrayBuffer(UNIFORM_BYTES);
  const view = new DataView(buffer);
  view.setUint32(0, plan.fullGridNodeCount, true);
  view.setUint32(4, plan.gridNodeCapacity, true);
  view.setUint32(8, plan.gridDims[0], true);
  view.setUint32(12, plan.gridDims[1], true);
  view.setUint32(16, plan.gridDims[2], true);
  view.setUint32(20, plan.gridShift, true);
  view.setInt32(24, plan.selectedLevel, true);
  view.setInt32(28, plan.chartId, true);
  view.setUint32(32, plan.sourceParticleCapacity, true);
  view.setUint32(36, plan.levelAssignmentStrideFloats, true);
  view.setUint32(40, plan.particleStateStrideVec4, true);
  view.setUint32(44, plan.hashKeyWordOffset, true);
  view.setUint32(48, plan.hashValueWordOffset, true);
  view.setUint32(52, plan.reverseMappingWordOffset, true);
  view.setUint32(56, integer(generationId, 'generationId', { max: U32_MAX }), true);
  view.setUint32(60, plan.maxComputeWorkgroupsPerDimension, true);
  view.setUint32(64, plan.hashCapacity, true);
  view.setUint32(68, plan.hashMaxProbes, true);
  view.setUint32(72, integer(unsupportedSourceFamilyMask, 'unsupportedSourceFamilyMask', {
    max: U32_MAX
  }), true);
  view.setFloat32(76, plan.gridSpacingM ?? 0, true);
  view.setUint32(80, residentParticleCount ? 1 : 0, true);
  view.setUint32(84, integer(hierarchyGenerationId, 'hierarchyGenerationId', {
    max: U32_MAX
  }), true);
  view.setUint32(88, sourceIdentityMismatch ? 1 : 0, true);
  view.setUint32(92, SCHROEDER_SPARSE_GRID_VIEW_STENCIL_WIDTH, true);
  const writeSource = (wordOffset, source) => {
    const byteOffset = wordOffset * UINT32_BYTES;
    view.setUint32(byteOffset, source?.enabled === true ? 1 : 0, true);
    view.setUint32(byteOffset + 4, source?.rowCapacity ?? 0, true);
    view.setUint32(byteOffset + 8, source?.rowStrideVec4 ?? 0, true);
    view.setUint32(byteOffset + 12, source?.generationId ?? 0, true);
    view.setUint32(byteOffset + 16, source?.identity?.generation ?? 0, true);
    view.setUint32(byteOffset + 20, source?.identity?.positionEpoch ?? 0, true);
    view.setUint32(byteOffset + 24, source?.identity?.leaseTokenLow ?? 0, true);
    view.setUint32(byteOffset + 28, source?.identity?.leaseTokenHigh ?? 0, true);
    view.setUint32(byteOffset + 32, source?.identity?.sourceCount ?? 0, true);
    view.setUint32(byteOffset + 36, source?.identity?.consumerBit ?? 0, true);
  };
  writeSource(24, productEventSource);
  writeSource(34, pressureForceSource);
  return buffer;
}

const legacyTileExpandedSchroederSparseGridViewWgsl = /* wgsl */ `
struct SparseGridViewParams {
  full_grid_node_count: u32,
  grid_node_capacity: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  grid_shift: u32,
  selected_level: i32,
  chart_id: i32,
  tile_cell_count: u32,
  hash_key_word_offset: u32,
  hash_value_word_offset: u32,
  reverse_mapping_word_offset: u32,
  generation_id: u32,
  init_dispatch_x: u32,
  max_dispatch_dimension: u32,
  peak_allocated_bytes: u32,
  physical_hash_capacity: u32,
  hash_max_probes: u32,
  active_tile_capacity: u32,
};

@group(0) @binding(0) var<storage, read> compact_nodes: array<u32>;
@group(0) @binding(1) var<storage, read> hierarchy_evidence: array<u32>;
@group(0) @binding(2) var<storage, read_write> sparse_view: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> grid_dispatch: array<u32>;
@group(0) @binding(4) var<uniform> params: SparseGridViewParams;

const INVALID_INDEX: u32 = 0xffffffffu;
const NODE_WORDS: u32 = 16u;
const STATUS_READY: u32 = 1u;
const STATUS_ADMITTED: u32 = 2u;
const STATUS_FAIL_CLOSED: u32 = 4u;
const OVERFLOW_GRID_ARENA: u32 = 1u;
const OVERFLOW_HASH_PROBE: u32 = 2u;
const OVERFLOW_BUILD_DISPATCH: u32 = 4u;

fn linear_group(group_id: vec3<u32>, dispatch_x: u32) -> u32 {
  return group_id.x + group_id.y * dispatch_x;
}

fn hash_grid_index(value: u32) -> u32 {
  var hash = value;
  hash = hash ^ (hash >> 16u);
  hash = hash * 0x7feb352du;
  hash = hash ^ (hash >> 15u);
  hash = hash * 0x846ca68bu;
  return hash ^ (hash >> 16u);
}

fn next_power_of_two(value: u32) -> u32 {
  let bounded_value = max(value, 1u);
  return 1u << (32u - countLeadingZeros(bounded_value - 1u));
}

@compute @workgroup_size(1)
fn initialize_view() {
  atomicStore(&sparse_view[0], params.generation_id);
  atomicStore(&sparse_view[1], 0u);
  atomicStore(&sparse_view[2], 0u);
  atomicStore(&sparse_view[3], 0u);
  atomicStore(&sparse_view[4], 0u);
  atomicStore(&sparse_view[5], params.full_grid_node_count);
  atomicStore(&sparse_view[6], params.grid_node_capacity);
  atomicStore(&sparse_view[7], bitcast<u32>(params.selected_level));
  atomicStore(&sparse_view[8], bitcast<u32>(params.chart_id));
  atomicStore(&sparse_view[9], params.tile_cell_count);
  atomicStore(&sparse_view[10], params.hash_key_word_offset);
  atomicStore(&sparse_view[11], params.hash_value_word_offset);
  atomicStore(&sparse_view[12], params.reverse_mapping_word_offset);
  atomicStore(&sparse_view[13], 0u);
  atomicStore(&sparse_view[14], STATUS_READY);
  atomicStore(&sparse_view[15], 0u);
  grid_dispatch[0] = 0u;
  grid_dispatch[1] = 1u;
  grid_dispatch[2] = 1u;
  grid_dispatch[3] = 0u;
  grid_dispatch[4] = 1u;
  grid_dispatch[5] = 1u;
  grid_dispatch[6] = 0u;
  grid_dispatch[7] = 1u;
  grid_dispatch[8] = 1u;
}

@compute @workgroup_size(1)
fn prepare_build_dispatch() {
  if (hierarchy_evidence[6] == 0u || params.physical_hash_capacity == 0u) {
    return;
  }
  let unique_node_count = hierarchy_evidence[5];
  atomicStore(&sparse_view[15], unique_node_count);
  let cells = params.tile_cell_count;
  let cell_count = cells * cells * cells;
  if (cell_count == 0u || unique_node_count > params.active_tile_capacity) {
    atomicOr(&sparse_view[4], OVERFLOW_BUILD_DISPATCH);
    return;
  }
  let invocation_count = unique_node_count * cell_count;
  let activity_upper_bound = min(invocation_count, params.grid_node_capacity);
  if (activity_upper_bound > 0x40000000u) {
    atomicOr(&sparse_view[4], OVERFLOW_GRID_ARENA);
    return;
  }
  let desired_hash_capacity = next_power_of_two(max(16u, activity_upper_bound * 2u));
  if (desired_hash_capacity > params.physical_hash_capacity) {
    atomicOr(&sparse_view[4], OVERFLOW_GRID_ARENA);
    return;
  }
  atomicStore(&sparse_view[13], desired_hash_capacity);
  let init_group_count = (desired_hash_capacity + 63u) / 64u;
  let init_dispatch_x = min(init_group_count, params.max_dispatch_dimension);
  var init_dispatch_y = 1u;
  if (init_dispatch_x > 0u) {
    init_dispatch_y = (init_group_count + init_dispatch_x - 1u) / init_dispatch_x;
  }
  if (init_dispatch_y > params.max_dispatch_dimension) {
    atomicOr(&sparse_view[4], OVERFLOW_BUILD_DISPATCH);
    return;
  }
  grid_dispatch[6] = init_dispatch_x;
  grid_dispatch[7] = init_dispatch_y;
  grid_dispatch[8] = 1u;
  let group_count = (invocation_count + 63u) / 64u;
  let dispatch_x = min(group_count, params.max_dispatch_dimension);
  var dispatch_y = 1u;
  if (dispatch_x > 0u) {
    dispatch_y = (group_count + dispatch_x - 1u) / dispatch_x;
  }
  if (dispatch_y > params.max_dispatch_dimension) {
    atomicOr(&sparse_view[4], OVERFLOW_BUILD_DISPATCH);
    return;
  }
  grid_dispatch[3] = dispatch_x;
  grid_dispatch[4] = dispatch_y;
  grid_dispatch[5] = 1u;
}

@compute @workgroup_size(64)
fn initialize_hash_slots(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let hash_capacity = atomicLoad(&sparse_view[13]);
  let init_group_count = (hash_capacity + 63u) / 64u;
  let dispatch_x = min(init_group_count, params.max_dispatch_dimension);
  let index = linear_group(group_id, dispatch_x) * 64u + local_id.x;
  if (index >= hash_capacity) {
    return;
  }
  atomicStore(&sparse_view[params.hash_key_word_offset + index], INVALID_INDEX);
  atomicStore(&sparse_view[params.hash_value_word_offset + index], INVALID_INDEX);
}

@compute @workgroup_size(64)
fn build_view(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  if (hierarchy_evidence[6] == 0u || atomicLoad(&sparse_view[4]) != 0u) {
    return;
  }
  let cells = params.tile_cell_count;
  let cell_count = cells * cells * cells;
  let unique_node_count = atomicLoad(&sparse_view[15]);
  let invocation_count = unique_node_count * cell_count;
  let group_count = (invocation_count + 63u) / 64u;
  let dispatch_x = min(group_count, params.max_dispatch_dimension);
  let invocation_index = linear_group(group_id, dispatch_x) * 64u + local_id.x;
  if (cell_count == 0u || invocation_index >= invocation_count) {
    return;
  }
  let node_index = invocation_index / cell_count;
  let local_cell = invocation_index - node_index * cell_count;
  let node_base = node_index * NODE_WORDS;
  if (bitcast<i32>(compact_nodes[node_base + 8u]) != params.selected_level
    || bitcast<i32>(compact_nodes[node_base + 9u]) != params.chart_id) {
    return;
  }
  let tile_x = bitcast<i32>(compact_nodes[node_base + 10u]);
  let tile_y = bitcast<i32>(compact_nodes[node_base + 11u]);
  let tile_z = bitcast<i32>(compact_nodes[node_base + 12u]);
  let local_x = local_cell % cells;
  let local_y = (local_cell / cells) % cells;
  let local_z = local_cell / (cells * cells);
  let logical_x = tile_x * i32(cells) + i32(local_x);
  let logical_y = tile_y * i32(cells) + i32(local_y);
  let logical_z = tile_z * i32(cells) + i32(local_z);
  let storage_x = logical_x + i32(params.grid_shift);
  let storage_y = logical_y + i32(params.grid_shift);
  let storage_z = logical_z + i32(params.grid_shift);
  if (storage_x < 0 || storage_y < 0 || storage_z < 0
    || storage_x >= i32(params.grid_nx)
    || storage_y >= i32(params.grid_ny)
    || storage_z >= i32(params.grid_nz)) {
    return;
  }
  let full_index = (u32(storage_x) * params.grid_ny + u32(storage_y))
    * params.grid_nz + u32(storage_z);
  let hash_capacity = atomicLoad(&sparse_view[13]);
  if (hash_capacity == 0u) {
    atomicOr(&sparse_view[4], OVERFLOW_GRID_ARENA);
    return;
  }
  let slot_mask = hash_capacity - 1u;
  let start_slot = hash_grid_index(full_index) & slot_mask;
  for (var probe = 0u; probe < params.hash_max_probes; probe = probe + 1u) {
    let slot = (start_slot + probe) & slot_mask;
    let key_index = params.hash_key_word_offset + slot;
    var occupied_key = INVALID_INDEX;
    var slot_resolved = false;
    for (var retry = 0u; retry < 8u; retry = retry + 1u) {
      let claim = atomicCompareExchangeWeak(
        &sparse_view[key_index],
        INVALID_INDEX,
        full_index
      );
      if (claim.exchanged) {
        let compact_index = atomicAdd(&sparse_view[2], 1u);
        if (compact_index >= params.grid_node_capacity) {
          atomicOr(&sparse_view[4], OVERFLOW_GRID_ARENA);
          return;
        }
        atomicStore(
          &sparse_view[params.hash_value_word_offset + slot],
          compact_index
        );
        atomicStore(
          &sparse_view[params.reverse_mapping_word_offset + compact_index],
          full_index
        );
        return;
      }
      if (claim.old_value != INVALID_INDEX) {
        occupied_key = claim.old_value;
        slot_resolved = true;
        break;
      }
    }
    if (!slot_resolved) {
      atomicOr(&sparse_view[4], OVERFLOW_HASH_PROBE);
      return;
    }
    if (occupied_key == full_index) {
      // Duplicate coverage is expected at neighboring support halos. The
      // first claimant publishes the compact value and reverse row before
      // the ordered build pass completes; later passes cannot observe a
      // partially published entry.
      return;
    }
  }
  atomicOr(&sparse_view[4], OVERFLOW_HASH_PROBE);
}

@compute @workgroup_size(1)
fn finalize_view() {
  let requested = atomicLoad(&sparse_view[2]);
  let overflow = atomicLoad(&sparse_view[4]);
  let hierarchy_admitted = hierarchy_evidence[6] != 0u;
  let admitted = hierarchy_admitted && overflow == 0u
    && requested > 0u && requested <= params.grid_node_capacity;
  let count = min(requested, params.grid_node_capacity);
  atomicStore(&sparse_view[1], count);
  atomicStore(&sparse_view[3], select(0u, 1u, admitted));
  atomicStore(&sparse_view[14], STATUS_READY
    | select(STATUS_FAIL_CLOSED, STATUS_ADMITTED, admitted));
  let group_count = select(0u, (count + 63u) / 64u, admitted);
  grid_dispatch[0] = min(group_count, params.max_dispatch_dimension);
  grid_dispatch[1] = select(
    1u,
    (group_count + max(grid_dispatch[0], 1u) - 1u) / max(grid_dispatch[0], 1u),
    group_count > 0u
  );
  grid_dispatch[2] = 1u;
}
`;

export function assertSchroederSparseGridView(view, {
  device = null,
  selectedLevel = null,
  generationId = null
} = {}) {
  if (view?.schema !== ULG_SCHROEDER_SPARSE_GRID_VIEW_EXECUTION_SCHEMA) {
    throw new TypeError('Expected a Schroeder sparse grid view execution descriptor');
  }
  if (!view.plan?.admitted || !view.viewBuffer || !view.dispatchIndirectBuffer
    || !view.actualNodeKeyBuffer || view.plan.candidateGenerationMode
      !== 'source-family-parallel-exact-touched-grid-node-keys') {
    throw new RangeError('Schroeder sparse grid view is not host-plan admitted');
  }
  if (device && (!webGpuBufferMatchesDevice(view.viewBuffer, device)
    || !webGpuBufferMatchesDevice(view.dispatchIndirectBuffer, device)
    || !webGpuBufferMatchesDevice(view.candidateKeyBuffer, device)
    || !webGpuBufferMatchesDevice(view.actualNodeKeyBuffer, device))) {
    throw new Error('Schroeder sparse grid view rejected cross-device buffers');
  }
  if (selectedLevel != null && view.selectedLevel !== Math.round(Number(selectedLevel))) {
    throw new RangeError('Schroeder sparse grid view level mismatch');
  }
  if (generationId != null && view.generationId !== Math.round(Number(generationId))) {
    throw new RangeError('Schroeder sparse grid view generation mismatch');
  }
  return view;
}

function sparseSourceU32(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= U32_MAX
    ? number >>> 0
    : null;
}

function sparseSourceIdentity(source) {
  const identity = source?.identity ?? source?.sourceIdentity ?? null;
  if (!identity) return null;
  const normalized = {
    generation: sparseSourceU32(identity.generation),
    positionEpoch: sparseSourceU32(identity.positionEpoch),
    leaseTokenLow: sparseSourceU32(identity.leaseTokenLow),
    leaseTokenHigh: sparseSourceU32(identity.leaseTokenHigh),
    sourceCount: sparseSourceU32(identity.sourceCount),
    consumerBit: sparseSourceU32(identity.consumerBit)
  };
  return Object.values(normalized).some((value) => value == null)
    ? null
    : normalized;
}

function sparseSourceLeaseIdentity(source) {
  const lease = source?.leaseIdentity ?? source?.lease ?? null;
  if (
    lease?.schema !== 'peercompute.compute.gpu-resident-lane-lease-identity.v0'
    || lease.authoritative !== true
  ) {
    return null;
  }
  for (const field of ['leaseId', 'laneId', 'stateKey', 'sourceFamily']) {
    if (typeof lease[field] !== 'string' || lease[field].length === 0) return null;
  }
  return lease;
}

function sparseSourceIdentityMatches(left, right) {
  if (!left || !right) return false;
  return [
    'generation',
    'positionEpoch',
    'leaseTokenLow',
    'leaseTokenHigh',
    'sourceCount',
    'consumerBit'
  ].every((field) => left[field] === right[field]);
}

function sparseSourceLeaseMatches(left, right) {
  if (!left || !right) return false;
  return ['leaseId', 'laneId', 'stateKey', 'sourceFamily']
    .every((field) => left[field] === right[field]);
}

function normalizeSparseGridSource(device, source, {
  rowStrideVec4,
  metadataMinimumBytes,
  bufferField,
  metadataBufferField,
  dispatchBufferField,
  rowCapacityField
}) {
  if (!source) return null;
  const buffer = source[bufferField] ?? source.buffer ?? null;
  const metadataBuffer = source[metadataBufferField] ?? source.metadataBuffer ?? null;
  const dispatchIndirectBuffer = source[dispatchBufferField]
    ?? source.dispatchIndirectBuffer
    ?? null;
  const identityEvidenceBuffer = source.identityEvidenceBuffer
    ?? source.residentNeighborhoodBuffer
    ?? null;
  const rowCapacity = sparseSourceU32(source[rowCapacityField] ?? source.rowCapacity);
  const generationId = sparseSourceU32(source.generationId);
  const identity = sparseSourceIdentity(source);
  const expectedIdentity = sparseSourceIdentity({
    identity: source.expectedIdentity ?? source.identity
  });
  const leaseIdentity = sparseSourceLeaseIdentity(source);
  const expectedLeaseIdentity = sparseSourceLeaseIdentity({
    leaseIdentity: source.expectedLeaseIdentity ?? source.leaseIdentity ?? source.lease
  });
  const dispatchIndirectByteOffset = sparseSourceU32(
    source.dispatchIndirectByteOffset ?? source.dispatchIndirectOffsetBytes ?? 0
  );
  const requiredRowBytes = rowCapacity == null
    ? Number.POSITIVE_INFINITY
    : rowCapacity * rowStrideVec4 * 4 * Float32Array.BYTES_PER_ELEMENT;
  const buffers = [
    buffer,
    metadataBuffer,
    dispatchIndirectBuffer,
    identityEvidenceBuffer
  ];
  const buffersPresent = buffers.every(Boolean);
  const buffersSameDevice = buffers.filter(Boolean)
    .every((candidate) => webGpuBufferMatchesDevice(candidate, device));
  const hostAdmitted = buffersPresent
    && buffersSameDevice
    && rowCapacity != null
    && rowCapacity > 0
    && generationId != null
    && dispatchIndirectByteOffset != null
    && dispatchIndirectByteOffset % UINT32_BYTES === 0
    && Number(buffer?.size ?? requiredRowBytes) >= requiredRowBytes
    && Number(metadataBuffer?.size ?? 0) >= metadataMinimumBytes
    && Number(dispatchIndirectBuffer?.size ?? 0) >= dispatchIndirectByteOffset + 3 * UINT32_BYTES
    && Number(identityEvidenceBuffer?.size ?? 0) >= 40 * UINT32_BYTES
    && sparseSourceIdentityMatches(identity, expectedIdentity)
    && sparseSourceLeaseMatches(leaseIdentity, expectedLeaseIdentity);
  return {
    enabled: true,
    hostAdmitted,
    buffer,
    metadataBuffer,
    dispatchIndirectBuffer,
    dispatchIndirectByteOffset: dispatchIndirectByteOffset ?? 0,
    identityEvidenceBuffer,
    rowCapacity: rowCapacity ?? 0,
    rowStrideVec4,
    generationId: generationId ?? 0,
    identity: identity ?? {
      generation: 0,
      positionEpoch: 0,
      leaseTokenLow: 0,
      leaseTokenHigh: 0,
      sourceCount: 0,
      consumerBit: 0
    },
    expectedIdentity,
    leaseIdentity,
    expectedLeaseIdentity
  };
}

export function createSchroederSparseGridViewGpu(device, {
  hierarchy,
  plan,
  label = 'ulg-schroeder-sparse-grid-view'
} = {}) {
  assertDevice(device);
  if (hierarchy?.schema !== ULG_SCHROEDER_SPARSE_HIERARCHY_EXECUTION_SCHEMA) {
    throw new TypeError('Schroeder sparse grid view requires a sparse hierarchy execution');
  }
  if (!hierarchy.evidenceBuffer || !webGpuBufferMatchesDevice(hierarchy.evidenceBuffer, device)) {
    throw new Error('Schroeder sparse grid view requires same-device hierarchy evidence');
  }
  if (plan?.schema !== ULG_SCHROEDER_SPARSE_GRID_VIEW_SCHEMA || !plan.admitted) {
    throw new RangeError('Schroeder sparse grid view requires an admitted byte-bounded plan');
  }
  const viewBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-lookup-evidence`,
    size: plan.viewBufferByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  const dispatchIndirectBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-dispatch-indirect`,
    size: plan.dispatchIndirectByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT
      | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  const candidateKeyBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-actual-node-candidates`,
    size: plan.candidateKeyBufferByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  const radixUnique = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: plan.gridNodeCapacity,
    maxKeyWordCount: 1,
    label: `${label}-actual-node-radix-unique`,
    maxComputeWorkgroupsPerDimension: plan.maxComputeWorkgroupsPerDimension,
    retainConstantScanParamsBuffers: true,
    retainedParamsSlotCount: plan.radixRetainedParamsSlotCount
  });
  const module = device.createShaderModule({ label: `${label}-shader`, code: schroederSparseGridViewWgsl });
  const pipeline = (entryPoint) => device.createComputePipeline({
    label: `${label}-${entryPoint}`,
    layout: 'auto',
    compute: { module, entryPoint }
  });
  const pipelines = {
    initialize: pipeline('initialize_view'),
    validateSource: pipeline('validate_source'),
    validateProductEventSource: pipeline('validate_product_event_source'),
    validatePressureForceSource: pipeline('validate_pressure_force_source'),
    prepareBuild: pipeline('prepare_build_dispatch'),
    initializeHashSlots: pipeline('initialize_hash_slots'),
    build: pipeline('build_view'),
    buildProductEvent: pipeline('build_product_event_view'),
    buildPressureForce: pipeline('build_pressure_force_view'),
    materialize: pipeline('materialize_sorted_nodes'),
    finalize: pipeline('finalize_view')
  };
  let destroyed = false;

  function encode(encoder, {
    generationId = hierarchy.generationId,
    particleStateBuffer = null,
    particleLevelAssignmentBuffer = null,
    particleCountResidency = null,
    productEventSource = null,
    pressureForceSource = null,
    timestampProfiler = null,
    timestampMetadata = {}
  } = {}) {
    if (destroyed) throw new Error(`${label} is destroyed`);
    if (!encoder?.beginComputePass || !encoder?.clearBuffer) {
      throw new TypeError('Schroeder sparse grid view requires a caller-owned command encoder');
    }
    const generation = integer(generationId, 'generationId', { max: U32_MAX });
    const residentParticleCount = particleCountResidency?.ready === true;
    const particleCountMetadataBuffer = residentParticleCount
      ? particleCountResidency.metadataBuffer
      : hierarchy.evidenceBuffer;
    const normalizedProductEventSource = normalizeSparseGridSource(
      device,
      productEventSource,
      {
        rowStrideVec4: PRODUCT_EVENT_STRIDE_VEC4,
        metadataMinimumBytes: 16 * UINT32_BYTES,
        bufferField: 'productEventBuffer',
        metadataBufferField: 'productEventMetadataBuffer',
        dispatchBufferField: 'productEventDispatchIndirectBuffer',
        rowCapacityField: 'productEventCapacity'
      }
    );
    const normalizedPressureForceSource = normalizeSparseGridSource(
      device,
      pressureForceSource,
      {
        rowStrideVec4: PRESSURE_FORCE_STRIDE_VEC4,
        metadataMinimumBytes: 4 * UINT32_BYTES,
        bufferField: 'forceRowsBuffer',
        metadataBufferField: 'candidateMetadataBuffer',
        dispatchBufferField: 'candidateDispatchIndirectBuffer',
        rowCapacityField: 'forceRowCapacity'
      }
    );
    const sourceBuffersMissing = !particleStateBuffer || !particleLevelAssignmentBuffer;
    const sourceDeviceMismatch = [
      particleStateBuffer,
      particleLevelAssignmentBuffer,
      ...(residentParticleCount ? [
        particleCountResidency.metadataBuffer,
        particleCountResidency.dispatchIndirectBuffer
      ] : [])
    ].filter(Boolean).some((buffer) => !webGpuBufferMatchesDevice(buffer, device));
    const unsupportedSourceFamilyMask = 0;
    const sourceIdentityMismatch = sourceBuffersMissing
      || sourceDeviceMismatch
      || generation !== hierarchy.generationId
      || (normalizedProductEventSource
        && !normalizedProductEventSource.hostAdmitted)
      || (normalizedPressureForceSource
        && !normalizedPressureForceSource.hostAdmitted);
    const paramsBuffer = tagWebGpuBufferDevice(device.createBuffer({
      label: `${label}-params-${generation}`,
      size: UNIFORM_BYTES,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    }), device);
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederSparseGridViewParamsArray(
      plan,
      generation,
      {
        hierarchyGenerationId: hierarchy.generationId,
        residentParticleCount,
        unsupportedSourceFamilyMask,
        sourceIdentityMismatch,
        productEventSource: normalizedProductEventSource,
        pressureForceSource: normalizedPressureForceSource
      }
    ));
    encoder.clearBuffer(dispatchIndirectBuffer);
    const bindGroup = (pipelineValue, entries) => device.createBindGroup({
      label: `${label}-${generation}-bind-group`,
      layout: pipelineValue.getBindGroupLayout(0),
      entries
    });
    let pass = encoder.beginComputePass(timestampPassDescriptor(
      timestampProfiler,
      `${label}InitializeHeader`,
      { ...timestampMetadata, generationId: generation }
    ));
    pass.setPipeline(pipelines.initialize);
    pass.setBindGroup(0, bindGroup(pipelines.initialize, [
      { binding: 3, resource: { buffer: viewBuffer } },
      { binding: 6, resource: { buffer: dispatchIndirectBuffer } },
      { binding: 9, resource: { buffer: paramsBuffer, size: UNIFORM_BYTES } }
    ]));
    pass.dispatchWorkgroups(1);
    pass.end();
    pass = encoder.beginComputePass(timestampPassDescriptor(
      timestampProfiler,
      `${label}InitializeActualNodeStorage`,
      { ...timestampMetadata, generationId: generation }
    ));
    pass.setPipeline(pipelines.initializeHashSlots);
    pass.setBindGroup(0, bindGroup(pipelines.initializeHashSlots, [
      { binding: 3, resource: { buffer: viewBuffer } },
      { binding: 4, resource: { buffer: candidateKeyBuffer } },
      { binding: 9, resource: { buffer: paramsBuffer, size: UNIFORM_BYTES } }
    ]));
    pass.dispatchWorkgroups(...dispatchShapeFor(
      Math.max(plan.hashCapacity, plan.gridNodeCapacity),
      plan.maxComputeWorkgroupsPerDimension
    ));
    pass.end();
    pass = encoder.beginComputePass(timestampPassDescriptor(
      timestampProfiler,
      `${label}ValidateActualNodeSource`,
      { ...timestampMetadata, generationId: generation }
    ));
    pass.setPipeline(pipelines.validateSource);
    pass.setBindGroup(0, bindGroup(pipelines.validateSource, [
      { binding: 2, resource: { buffer: hierarchy.evidenceBuffer } },
      { binding: 3, resource: { buffer: viewBuffer } },
      { binding: 5, resource: { buffer: particleCountMetadataBuffer } },
      { binding: 9, resource: { buffer: paramsBuffer, size: UNIFORM_BYTES } }
    ]));
    pass.dispatchWorkgroups(1);
    pass.end();
    pass = encoder.beginComputePass(timestampPassDescriptor(
      timestampProfiler,
      `${label}BuildView`,
      { ...timestampMetadata, generationId: generation }
    ));
    pass.setPipeline(pipelines.build);
    pass.setBindGroup(0, bindGroup(pipelines.build, [
      { binding: 0, resource: { buffer: particleStateBuffer || hierarchy.evidenceBuffer } },
      { binding: 1, resource: { buffer: particleLevelAssignmentBuffer || hierarchy.evidenceBuffer } },
      { binding: 3, resource: { buffer: viewBuffer } },
      { binding: 4, resource: { buffer: candidateKeyBuffer } },
      { binding: 5, resource: { buffer: particleCountMetadataBuffer } },
      { binding: 9, resource: { buffer: paramsBuffer, size: UNIFORM_BYTES } }
    ]));
    if (residentParticleCount) {
      pass.dispatchWorkgroupsIndirect(
        particleCountResidency.dispatchIndirectBuffer,
        particleCountResidency.activeDispatchIndirectByteOffset ?? 0
      );
    } else {
    pass.dispatchWorkgroups(...plan.sourceParticleDispatch);
    }
    pass.end();
    if (normalizedProductEventSource?.hostAdmitted) {
      pass = encoder.beginComputePass(timestampPassDescriptor(
        timestampProfiler,
        `${label}ValidateProductEventSource`,
        { ...timestampMetadata, generationId: generation }
      ));
      pass.setPipeline(pipelines.validateProductEventSource);
      pass.setBindGroup(0, bindGroup(pipelines.validateProductEventSource, [
        { binding: 3, resource: { buffer: viewBuffer } },
        { binding: 5, resource: { buffer: normalizedProductEventSource.metadataBuffer } },
        {
          binding: 9,
          resource: { buffer: paramsBuffer, size: UNIFORM_BYTES }
        },
        {
          binding: 10,
          resource: { buffer: normalizedProductEventSource.identityEvidenceBuffer }
        }
      ]));
      pass.dispatchWorkgroups(1);
      pass.end();
      pass = encoder.beginComputePass(timestampPassDescriptor(
        timestampProfiler,
        `${label}BuildProductEventView`,
        { ...timestampMetadata, generationId: generation }
      ));
      pass.setPipeline(pipelines.buildProductEvent);
      pass.setBindGroup(0, bindGroup(pipelines.buildProductEvent, [
        { binding: 0, resource: { buffer: normalizedProductEventSource.buffer } },
        { binding: 3, resource: { buffer: viewBuffer } },
        { binding: 4, resource: { buffer: candidateKeyBuffer } },
        { binding: 5, resource: { buffer: normalizedProductEventSource.metadataBuffer } },
        {
          binding: 9,
          resource: { buffer: paramsBuffer, size: UNIFORM_BYTES }
        }
      ]));
      pass.dispatchWorkgroupsIndirect(
        normalizedProductEventSource.dispatchIndirectBuffer,
        normalizedProductEventSource.dispatchIndirectByteOffset
      );
      pass.end();
    }
    if (normalizedPressureForceSource?.hostAdmitted) {
      pass = encoder.beginComputePass(timestampPassDescriptor(
        timestampProfiler,
        `${label}ValidatePressureForceSource`,
        { ...timestampMetadata, generationId: generation }
      ));
      pass.setPipeline(pipelines.validatePressureForceSource);
      pass.setBindGroup(0, bindGroup(pipelines.validatePressureForceSource, [
        { binding: 3, resource: { buffer: viewBuffer } },
        { binding: 5, resource: { buffer: normalizedPressureForceSource.metadataBuffer } },
        {
          binding: 9,
          resource: { buffer: paramsBuffer, size: UNIFORM_BYTES }
        },
        {
          binding: 10,
          resource: { buffer: normalizedPressureForceSource.identityEvidenceBuffer }
        }
      ]));
      pass.dispatchWorkgroups(1);
      pass.end();
      pass = encoder.beginComputePass(timestampPassDescriptor(
        timestampProfiler,
        `${label}BuildPressureForceView`,
        { ...timestampMetadata, generationId: generation }
      ));
      pass.setPipeline(pipelines.buildPressureForce);
      pass.setBindGroup(0, bindGroup(pipelines.buildPressureForce, [
        { binding: 0, resource: { buffer: normalizedPressureForceSource.buffer } },
        { binding: 3, resource: { buffer: viewBuffer } },
        { binding: 4, resource: { buffer: candidateKeyBuffer } },
        { binding: 5, resource: { buffer: normalizedPressureForceSource.metadataBuffer } },
        {
          binding: 9,
          resource: { buffer: paramsBuffer, size: UNIFORM_BYTES }
        }
      ]));
      pass.dispatchWorkgroupsIndirect(
        normalizedPressureForceSource.dispatchIndirectBuffer,
        normalizedPressureForceSource.dispatchIndirectByteOffset
      );
      pass.end();
    }
    const radixEncoding = radixUnique.encodeSortUnique(encoder, {
      keyBuffer: candidateKeyBuffer,
      elementCount: plan.gridNodeCapacity,
      keyWordCount: 1,
      keyStrideWords: 1,
      generationId: generation,
      consumerWorkgroupSize: SCHROEDER_SPARSE_HIERARCHY_WORKGROUP_SIZE,
      timestampProfiler,
      timestampMetadata: {
        ...timestampMetadata,
        generationId: generation,
        stage: 'actual-grid-node-stable-unique'
      }
    });
    pass = encoder.beginComputePass(timestampPassDescriptor(
      timestampProfiler,
      `${label}PrepareBuildDispatch`,
      { ...timestampMetadata, generationId: generation }
    ));
    pass.setPipeline(pipelines.prepareBuild);
    pass.setBindGroup(0, bindGroup(pipelines.prepareBuild, [
      { binding: 3, resource: { buffer: viewBuffer } },
      { binding: 6, resource: { buffer: dispatchIndirectBuffer } },
      { binding: 7, resource: { buffer: radixEncoding.uniqueEvidenceBuffer } },
      { binding: 8, resource: { buffer: radixEncoding.uniqueKeysBuffer } },
      { binding: 9, resource: { buffer: paramsBuffer, size: UNIFORM_BYTES } }
    ]));
    pass.dispatchWorkgroups(1);
    pass.end();
    pass = encoder.beginComputePass(timestampPassDescriptor(
      timestampProfiler,
      `${label}MaterializeSortedActualNodes`,
      { ...timestampMetadata, generationId: generation }
    ));
    pass.setPipeline(pipelines.materialize);
    pass.setBindGroup(0, bindGroup(pipelines.materialize, [
      { binding: 3, resource: { buffer: viewBuffer } },
      { binding: 8, resource: { buffer: radixEncoding.uniqueKeysBuffer } },
      { binding: 9, resource: { buffer: paramsBuffer, size: UNIFORM_BYTES } }
    ]));
    pass.dispatchWorkgroupsIndirect(
      dispatchIndirectBuffer,
      plan.materializeDispatchIndirectByteOffset
    );
    pass.end();
    pass = encoder.beginComputePass(timestampPassDescriptor(
      timestampProfiler,
      `${label}FinalizeView`,
      { ...timestampMetadata, generationId: generation }
    ));
    pass.setPipeline(pipelines.finalize);
    pass.setBindGroup(0, bindGroup(pipelines.finalize, [
      { binding: 2, resource: { buffer: hierarchy.evidenceBuffer } },
      { binding: 3, resource: { buffer: viewBuffer } },
      { binding: 6, resource: { buffer: dispatchIndirectBuffer } },
      { binding: 9, resource: { buffer: paramsBuffer, size: UNIFORM_BYTES } }
    ]));
    pass.dispatchWorkgroups(1);
    pass.end();
    let transientBuffersReleased = false;
    return {
      ...plan,
      schema: ULG_SCHROEDER_SPARSE_GRID_VIEW_EXECUTION_SCHEMA,
      sparseGridViewSchema: plan.schema,
      status: unsupportedSourceFamilyMask !== 0 || sourceIdentityMismatch
        ? 'schroeder-sparse-grid-actual-node-source-fail-closed-encoded'
        : 'schroeder-sparse-grid-actual-node-view-encoded',
      generationId: generation,
      hierarchyGenerationId: hierarchy.generationId,
      deviceId: webGpuDeviceId(device),
      viewBuffer,
      viewBufferByteLength: plan.viewBufferByteLength,
      evidenceBuffer: viewBuffer,
      evidenceBufferByteLength: SCHROEDER_SPARSE_GRID_VIEW_HEADER_WORDS * UINT32_BYTES,
      candidateKeyBuffer,
      candidateKeyBufferByteLength: plan.candidateKeyBufferByteLength,
      actualNodeKeyBuffer: radixEncoding.uniqueKeysBuffer,
      actualNodeKeyCapacity: plan.gridNodeCapacity,
      actualNodeKeyOrdering: plan.compactOrdering,
      actualNodeCandidateGenerationMode: plan.candidateGenerationMode,
      actualNodeRadixPassCount: radixEncoding.radixPassCount,
      primitiveUniqueEvidenceBuffer: radixEncoding.uniqueEvidenceBuffer,
      dispatchIndirectBuffer,
      dispatchIndirectBufferByteLength: plan.dispatchIndirectByteLength,
      dispatchIndirectByteOffset: plan.dispatchIndirectByteOffset,
      buildDispatchIndirectByteOffset: plan.buildDispatchIndirectByteOffset,
      hashInitDispatchIndirectByteOffset: plan.hashInitDispatchIndirectByteOffset,
      materializeDispatchIndirectByteOffset: plan.materializeDispatchIndirectByteOffset,
      particleSourceStatus: sourceIdentityMismatch
        ? 'particle-source-identity-fail-closed'
        : 'current-retained-particle-source-encoded',
      particleCountAuthority: residentParticleCount
        ? 'gpu-authored-residency-metadata'
        : 'host-known-particle-capacity',
      unsupportedSourceFamilyMask,
      reactionProductEventSourceStatus: productEventSource
        ? (normalizedProductEventSource?.hostAdmitted
          ? (productEventSource.status ?? 'current-product-event-source-encoded')
          : 'fail-closed-product-event-source-identity')
        : 'not-requested',
      pressureForceSourceStatus: pressureForceSource
        ? (normalizedPressureForceSource?.hostAdmitted
          ? (pressureForceSource.status ?? 'current-pressure-force-source-encoded')
          : 'fail-closed-pressure-force-source-identity')
        : 'not-requested',
      pressureCentroidOrderStatus: pressureForceSource
        ? (pressureForceSource.centroidOrderStatus
          ?? 'fail-closed-pressure-centroid-order-unspecified')
        : 'not-requested',
      sourceIntegrationAdmission: unsupportedSourceFamilyMask !== 0
        ? 'fail-closed-zero-consumer-indirect'
        : (sourceIdentityMismatch
          ? 'fail-closed-source-identity-zero-consumer-indirect'
          : [productEventSource, pressureForceSource].some(Boolean)
            ? 'mixed-source-family-gpu-admission-encoded'
            : 'particle-source-gpu-admission-encoded'),
      productEventSourceIdentity: normalizedProductEventSource?.identity ?? null,
      productEventSourceExpectedIdentity:
        normalizedProductEventSource?.expectedIdentity ?? null,
      productEventSourceLeaseIdentity:
        normalizedProductEventSource?.leaseIdentity ?? null,
      productEventSourceExpectedLeaseIdentity:
        normalizedProductEventSource?.expectedLeaseIdentity ?? null,
      productEventSourceHostAdmitted:
        normalizedProductEventSource?.hostAdmitted ?? null,
      productEventSourceGenerationId:
        normalizedProductEventSource?.generationId ?? null,
      productEventSourceLeaseId:
        normalizedProductEventSource?.leaseIdentity?.leaseId ?? null,
      productEventSourceMetadataBuffer:
        normalizedProductEventSource?.metadataBuffer ?? null,
      productEventSourceDispatchIndirectBuffer:
        normalizedProductEventSource?.dispatchIndirectBuffer ?? null,
      pressureForceSourceIdentity: normalizedPressureForceSource?.identity ?? null,
      pressureForceSourceExpectedIdentity:
        normalizedPressureForceSource?.expectedIdentity ?? null,
      pressureForceSourceLeaseIdentity:
        normalizedPressureForceSource?.leaseIdentity ?? null,
      pressureForceSourceExpectedLeaseIdentity:
        normalizedPressureForceSource?.expectedLeaseIdentity ?? null,
      pressureForceSourceHostAdmitted:
        normalizedPressureForceSource?.hostAdmitted ?? null,
      pressureForceSourceGenerationId:
        normalizedPressureForceSource?.generationId ?? null,
      pressureForceSourceLeaseId:
        normalizedPressureForceSource?.leaseIdentity?.leaseId ?? null,
      pressureForceSourceMetadataBuffer:
        normalizedPressureForceSource?.metadataBuffer ?? null,
      pressureForceSourceDispatchIndirectBuffer:
        normalizedPressureForceSource?.dispatchIndirectBuffer ?? null,
      plan,
      readbackMode: 'no-full-readback',
      normalHotLoopReadbackFree: true,
      transientBuffers: [paramsBuffer, ...radixEncoding.transientBuffers],
      radixEncoding,
      releaseTransientBuffers() {
        if (transientBuffersReleased) return;
        transientBuffersReleased = true;
        radixUnique.releaseTransientBuffers(radixEncoding);
        paramsBuffer.destroy?.();
      }
    };
  }

  return {
    schema: ULG_SCHROEDER_SPARSE_GRID_VIEW_SCHEMA,
    status: 'schroeder-sparse-grid-view-runtime-ready',
    plan,
    hierarchy,
    viewBuffer,
    candidateKeyBuffer,
    dispatchIndirectBuffer,
    encode,
    allocationEntries() {
      return [
        { role: 'actual-node-sparse-view', buffer: viewBuffer },
        { role: 'actual-node-candidates', buffer: candidateKeyBuffer },
        { role: 'actual-node-consumer-dispatch', buffer: dispatchIndirectBuffer },
        ...radixUnique.allocationEntries().map((entry) => ({
          ...entry,
          role: `actual-node-${entry.role}`
        }))
      ];
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      viewBuffer.destroy?.();
      candidateKeyBuffer.destroy?.();
      dispatchIndirectBuffer.destroy?.();
      radixUnique.destroy();
    }
  };
}
