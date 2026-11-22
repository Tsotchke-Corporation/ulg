import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline,
  unwrapWebGpuCacheDevice
} from '../webgpuComputeLayout.js';
import {
  SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_RECORD_BYTES
} from './sphResidentProductHistoryGpu.js';
import {
  createSphExactResidentProductHistorySourceRowChecksWgsl
} from './sphExactResidentProductHistoryWgsl.js';

export const RESIDENT_PRODUCT_HISTORY_PARALLEL_BLOCK_ROWS = 256;
export const RESIDENT_PRODUCT_HISTORY_PARALLEL_MIN_BLOCKS = 3;
const META_HEADER_WORDS = 16;
const GPU_BUFFER_USAGE = {
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8
};

const scratchByDevice = new WeakMap();

function nextPow2(value, minValue = 256) {
  let out = Math.max(minValue, 1);
  while (out < value && out < 0x4000_0000) out *= 2;
  return out;
}

function exactLayoutCacheSuffix(layout) {
  if (!layout) return 'legacy';
  return `exact:${layout.format?.quantumExponent ?? 0}:${layout.massWordCount}:${layout.rationalWordCount}:${layout.rowWords}`;
}

export function computeResidentProductHistoryParallelBlockPlan({
  sourceARowCount = 0,
  sourceBRowCount = 0,
  sourceAUsesParentCount = false,
  parentRowCapacity = 0,
  emittedRowCapacity = 0,
  exactHistoryLayout = null,
  emittedSourceKind = 1,
  maxWorkgroupsPerDimension = 65535
} = {}) {
  const rawMaxA = sourceAUsesParentCount ? parentRowCapacity : sourceARowCount;
  const maxRowsA = exactHistoryLayout && emittedSourceKind === 0
    ? emittedRowCapacity
    : rawMaxA;
  const maxRowsB = exactHistoryLayout && emittedSourceKind === 1
    ? emittedRowCapacity
    : sourceBRowCount;
  const blocksA = maxRowsA > 0
    ? Math.ceil(maxRowsA / RESIDENT_PRODUCT_HISTORY_PARALLEL_BLOCK_ROWS)
    : 0;
  const blocksB = maxRowsB > 0
    ? Math.ceil(maxRowsB / RESIDENT_PRODUCT_HISTORY_PARALLEL_BLOCK_ROWS)
    : 0;
  const totalBlocks = blocksA + blocksB;
  const limit = Math.max(1, Math.min(65535, Math.floor(Number(maxWorkgroupsPerDimension) || 65535)));
  const eligible = totalBlocks >= RESIDENT_PRODUCT_HISTORY_PARALLEL_MIN_BLOCKS
    && totalBlocks <= limit;
  return {
    maxRowsA,
    maxRowsB,
    blocksA,
    blocksB,
    totalBlocks,
    eligible
  };
}

export function createSphResidentProductHistoryParallelAppendWgsl(exactHistoryLayout = null) {
  const isExact = Boolean(exactHistoryLayout);
  const elemType = isExact ? 'vec4<u32>' : 'vec4<f32>';
  const metaBinding = isExact ? 7 : 6;
  const maskBinding = isExact ? 8 : 7;
  const exactRowStrideVec4 = isExact ? exactHistoryLayout.rowWords / 4 : 8;

  const extraParamsFields = isExact
    ? `  expected_emitted_generation: u32,
  expected_emitted_seal: u32,
  expected_emitted_capacity: u32,
  expected_emitted_stride_vec4: u32,
  emitted_source_kind: u32,
  reserved0: u32,
  reserved1: u32,
  reserved2: u32,`
    : '';

  const emittedControlBinding = isExact
    ? '@group(0) @binding(6) var<storage, read> emitted_control: array<u32>;\n'
    : '';

  const rowPredicatesWgsl = isExact
    ? `${createSphExactResidentProductHistorySourceRowChecksWgsl(exactHistoryLayout)}
fn history_source_row_live(kind: u32, row: u32, stride: u32) -> bool {
  return exact_history_live(kind, row);
}
fn history_source_row_valid(kind: u32, row: u32, stride: u32) -> bool {
  return exact_history_valid(kind, row);
}`
    : `fn history_source_row_live(source_kind: u32, row: u32, stride: u32) -> bool {
  let base = row * stride;
  if (source_kind == 0u) {
    let bound = arrayLength(&source_a_rows);
    if (stride < 8u || base > bound || stride > bound - base) { return false; }
    let row2 = source_a_rows[base + 2u];
    let row3 = source_a_rows[base + 3u];
    let row4 = source_a_rows[base + 4u];
    let row7 = source_a_rows[base + 7u];
    return row4.z == 1.0 && row7.z == 1.0 && row2.w > 0.0 && row4.y > 0.0 && row3.y > 0.0;
  }
  let bound = arrayLength(&source_b_rows);
  if (stride < 8u || base > bound || stride > bound - base) { return false; }
  let row2 = source_b_rows[base + 2u];
  let row3 = source_b_rows[base + 3u];
  let row4 = source_b_rows[base + 4u];
  let row7 = source_b_rows[base + 7u];
  return row4.z == 1.0 && row7.z == 1.0 && row2.w > 0.0 && row4.y > 0.0 && row3.y > 0.0;
}
fn history_source_row_valid(source_kind: u32, row: u32, stride: u32) -> bool {
  return true;
}`;

  const validateSourceCountsWgsl = isExact
    ? `  if (
    arrayLength(&emitted_control) < 12u
    || emitted_control[0u] != HISTORY_CONTROL_MAGIC
    || emitted_control[1u] != HISTORY_CONTROL_VERSION
    || emitted_control[2u] != HISTORY_CONTROL_READY
    || emitted_control[4u] != params.expected_emitted_capacity
    || emitted_control[5u] != params.expected_emitted_stride_vec4
    || emitted_control[6u] != params.expected_emitted_generation
    || emitted_control[7u] != params.expected_emitted_seal
    || emitted_control[3u] > params.expected_emitted_capacity
    || emitted_control[11u] != 0u
    || params.row_stride_vec4 != ${exactRowStrideVec4}u
    || params.expected_emitted_stride_vec4 != ${exactRowStrideVec4}u
    || params.emitted_source_kind > 1u
    || params.reserved0 != 0u
    || params.reserved1 != 0u
    || params.reserved2 != 0u
  ) {
    history_fail(HISTORY_ERROR_SOURCE);
    atomicStore(&par_meta[0u], 1u);
    return;
  }
  let parent_count = parent_control[3u];
  let raw_source_a_count = select(
    params.source_a_row_count,
    parent_count,
    params.source_a_uses_parent_count == 1u
  );
  let source_a_count = select(raw_source_a_count, emitted_control[3u], params.emitted_source_kind == 0u);
  let source_b_count = select(params.source_b_row_count, emitted_control[3u], params.emitted_source_kind == 1u);
  let raw_max_a = select(
    params.source_a_row_count,
    params.expected_parent_row_capacity,
    params.source_a_uses_parent_count == 1u
  );
  let max_rows_a = select(raw_max_a, params.expected_emitted_capacity, params.emitted_source_kind == 0u);
  let max_rows_b = select(params.source_b_row_count, params.expected_emitted_capacity, params.emitted_source_kind == 1u);`
    : `  let parent_count = parent_control[3u];
  let source_a_count = select(
    params.source_a_row_count,
    parent_count,
    params.source_a_uses_parent_count == 1u
  );
  let source_b_count = params.source_b_row_count;
  let max_rows_a = select(
    params.source_a_row_count,
    params.expected_parent_row_capacity,
    params.source_a_uses_parent_count == 1u
  );
  let max_rows_b = params.source_b_row_count;`;

  return /* wgsl */ `
struct ResidentProductHistoryAppendParams {
  source_a_row_count: u32,
  source_b_row_count: u32,
  row_capacity: u32,
  row_stride_vec4: u32,
  reuse_parent_prefix: u32,
  source_a_uses_parent_count: u32,
  expected_parent_generation: u32,
  expected_parent_seal: u32,
  next_generation: u32,
  next_seal: u32,
  expected_parent_row_capacity: u32,
  expected_parent_row_stride_vec4: u32,
${extraParamsFields}
};

@group(0) @binding(0) var<storage, read_write> history_rows: array<${elemType}>;
@group(0) @binding(1) var<storage, read> source_a_rows: array<${elemType}>;
@group(0) @binding(2) var<storage, read> source_b_rows: array<${elemType}>;
@group(0) @binding(3) var<storage, read> parent_control: array<u32>;
@group(0) @binding(4) var<storage, read_write> next_control: array<u32>;
@group(0) @binding(5) var<uniform> params: ResidentProductHistoryAppendParams;
${emittedControlBinding}@group(0) @binding(${metaBinding}) var<storage, read_write> par_meta: array<atomic<u32>>;
@group(0) @binding(${maskBinding}) var<storage, read_write> live_mask: array<u32>;

const HISTORY_CONTROL_MAGIC: u32 = 0x50484731u;
const HISTORY_CONTROL_VERSION: u32 = 1u;
const HISTORY_CONTROL_READY: u32 = 1u;
const HISTORY_CONTROL_FAILED: u32 = 0x80000000u;
const HISTORY_ERROR_PARENT: u32 = 1u;
const HISTORY_ERROR_SOURCE: u32 = 2u;
const HISTORY_ERROR_CAPACITY: u32 = 4u;
const HISTORY_WG_SIZE: u32 = 256u;
const META_HEADER_WORDS: u32 = ${META_HEADER_WORDS}u;

${rowPredicatesWgsl}

fn history_fail(error: u32) {
  if (arrayLength(&next_control) < 12u) { return; }
  next_control[0u] = HISTORY_CONTROL_MAGIC;
  next_control[1u] = HISTORY_CONTROL_VERSION;
  next_control[2u] = HISTORY_CONTROL_FAILED;
  next_control[3u] = 0u;
  next_control[4u] = params.row_capacity;
  next_control[5u] = params.row_stride_vec4;
  next_control[6u] = params.next_generation;
  next_control[7u] = params.next_seal;
  next_control[8u] = 0u;
  next_control[9u] = 1u;
  next_control[10u] = 1u;
  next_control[11u] = error;
}

@compute @workgroup_size(1)
fn validate_header(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u) { return; }
  if (arrayLength(&par_meta) < META_HEADER_WORDS) {
    history_fail(HISTORY_ERROR_CAPACITY);
    return;
  }
  atomicStore(&par_meta[0u], 1u);
  atomicStore(&par_meta[10u], 0u);
  atomicStore(&par_meta[11u], 0u);
  if (
    arrayLength(&parent_control) < 12u
    || arrayLength(&next_control) < 12u
    || parent_control[0u] != HISTORY_CONTROL_MAGIC
    || parent_control[1u] != HISTORY_CONTROL_VERSION
    || parent_control[2u] != HISTORY_CONTROL_READY
    || parent_control[4u] != params.expected_parent_row_capacity
    || parent_control[5u] != params.expected_parent_row_stride_vec4
    || parent_control[6u] != params.expected_parent_generation
    || parent_control[7u] != params.expected_parent_seal
    || params.expected_parent_row_stride_vec4 != params.row_stride_vec4
    || parent_control[3u] > params.expected_parent_row_capacity
  ) {
    history_fail(HISTORY_ERROR_PARENT);
    return;
  }
  let stride = params.row_stride_vec4;
  let capacity = params.row_capacity;
  if (stride < 8u || capacity == 0u || capacity > arrayLength(&history_rows) / stride) {
    history_fail(HISTORY_ERROR_CAPACITY);
    return;
  }
${validateSourceCountsWgsl}
  if (
    source_a_count > arrayLength(&source_a_rows) / stride
    || source_b_count > arrayLength(&source_b_rows) / stride
  ) {
    history_fail(HISTORY_ERROR_SOURCE);
    return;
  }
  let blocks_a = (max_rows_a + 255u) / 256u;
  let blocks_b = (max_rows_b + 255u) / 256u;
  let total_blocks = blocks_a + blocks_b;
  if (
    arrayLength(&par_meta) < META_HEADER_WORDS + total_blocks * 2u
    || arrayLength(&live_mask) < total_blocks * 8u
  ) {
    history_fail(HISTORY_ERROR_CAPACITY);
    return;
  }
  let base_count = select(0u, parent_count, params.reuse_parent_prefix == 1u);
  atomicStore(&par_meta[2u], source_a_count);
  atomicStore(&par_meta[3u], source_b_count);
  atomicStore(&par_meta[4u], base_count);
  atomicStore(&par_meta[5u], stride);
  atomicStore(&par_meta[6u], capacity);
  atomicStore(&par_meta[7u], blocks_a);
  atomicStore(&par_meta[8u], blocks_b);
  atomicStore(&par_meta[9u], total_blocks);
  atomicStore(&par_meta[0u], 0u);
}

var<workgroup> wg_abort: u32;
var<workgroup> wg_kind: u32;
var<workgroup> wg_row_start: u32;
var<workgroup> wg_limit: u32;
var<workgroup> wg_stride: u32;
var<workgroup> wg_dest_base: u32;
var<workgroup> wg_block_count: u32;
var<workgroup> wg_total_blocks: u32;
var<workgroup> wg_base_count: u32;
var<workgroup> wg_capacity: u32;
var<workgroup> wg_invalid: atomic<u32>;
var<workgroup> wg_scan: array<u32, 256>;
var<workgroup> wg_live_rows: array<u32, 256>;

@compute @workgroup_size(256)
fn classify_blocks(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let wg = workgroup_id.x;
  let lid = local_id.x;
  if (lid == 0u) {
    let status = atomicLoad(&par_meta[0u]);
    let total_blocks = atomicLoad(&par_meta[9u]);
    atomicStore(&wg_invalid, 0u);
    if (status != 0u || wg >= total_blocks) {
      wg_abort = 1u;
    } else {
      let blocks_a = atomicLoad(&par_meta[7u]);
      let is_b = wg >= blocks_a;
      let local_block = select(wg, wg - blocks_a, is_b);
      let limit = select(atomicLoad(&par_meta[2u]), atomicLoad(&par_meta[3u]), is_b);
      let row_start = local_block * HISTORY_WG_SIZE;
      if (row_start >= limit) {
        atomicStore(&par_meta[META_HEADER_WORDS + wg], 0u);
        wg_abort = 1u;
      } else {
        wg_abort = 0u;
        wg_kind = select(0u, 1u, is_b);
        wg_row_start = row_start;
        wg_limit = limit;
        wg_stride = atomicLoad(&par_meta[5u]);
      }
    }
  }
  if (workgroupUniformLoad(&wg_abort) != 0u) { return; }
  let kind = workgroupUniformLoad(&wg_kind);
  let row_start = workgroupUniformLoad(&wg_row_start);
  let limit = workgroupUniformLoad(&wg_limit);
  let stride = workgroupUniformLoad(&wg_stride);

  let row = row_start + lid;
  var is_live = false;
  if (row < limit) {
    if (!history_source_row_valid(kind, row, stride)) {
      atomicStore(&wg_invalid, 1u);
    } else {
      is_live = history_source_row_live(kind, row, stride);
    }
  }
  wg_scan[lid] = select(0u, 1u, is_live);
  workgroupBarrier();
  if (lid < 8u) {
    var mask = 0u;
    let base_bit = lid * 32u;
    for (var b = 0u; b < 32u; b = b + 1u) {
      if (wg_scan[base_bit + b] != 0u) {
        mask = mask | (1u << b);
      }
    }
    live_mask[wg * 8u + lid] = mask;
  }
  workgroupBarrier();
  for (var offset = HISTORY_WG_SIZE >> 1u; offset > 0u; offset = offset >> 1u) {
    if (lid < offset) {
      wg_scan[lid] = wg_scan[lid] + wg_scan[lid + offset];
    }
    workgroupBarrier();
  }
  if (lid == 0u) {
    atomicStore(&par_meta[META_HEADER_WORDS + wg], wg_scan[0u]);
    if (atomicLoad(&wg_invalid) != 0u) {
      atomicStore(&par_meta[10u], 1u);
    }
  }
}

@compute @workgroup_size(256)
fn scan_blocks_and_seal(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (workgroup_id.x != 0u) { return; }
  let lid = local_id.x;
  if (lid == 0u) {
    let status = atomicLoad(&par_meta[0u]);
    if (status != 0u) {
      wg_abort = 1u;
    } else if (atomicLoad(&par_meta[10u]) != 0u) {
      history_fail(HISTORY_ERROR_SOURCE);
      atomicStore(&par_meta[0u], 1u);
      wg_abort = 1u;
    } else {
      wg_abort = 0u;
      wg_total_blocks = atomicLoad(&par_meta[9u]);
      wg_base_count = atomicLoad(&par_meta[4u]);
      wg_stride = atomicLoad(&par_meta[5u]);
      wg_capacity = atomicLoad(&par_meta[6u]);
    }
  }
  if (workgroupUniformLoad(&wg_abort) != 0u) { return; }
  let total_blocks = workgroupUniformLoad(&wg_total_blocks);
  let base_count = workgroupUniformLoad(&wg_base_count);
  let stride = workgroupUniformLoad(&wg_stride);
  let capacity = workgroupUniformLoad(&wg_capacity);

  var running_total = 0u;
  for (var chunk = 0u; chunk < total_blocks; chunk = chunk + HISTORY_WG_SIZE) {
    let idx = chunk + lid;
    var val = 0u;
    if (idx < total_blocks) {
      val = atomicLoad(&par_meta[META_HEADER_WORDS + idx]);
    }
    wg_scan[lid] = val;
    workgroupBarrier();
    var s = val;
    for (var d = 1u; d < HISTORY_WG_SIZE; d = d << 1u) {
      var addend = 0u;
      if (lid >= d) { addend = wg_scan[lid - d]; }
      workgroupBarrier();
      s = s + addend;
      wg_scan[lid] = s;
      workgroupBarrier();
    }
    if (idx < total_blocks) {
      atomicStore(&par_meta[META_HEADER_WORDS + total_blocks + idx], running_total + (s - val));
    }
    running_total = running_total + wg_scan[HISTORY_WG_SIZE - 1u];
    workgroupBarrier();
  }
  if (lid == 0u) {
    if (running_total > capacity || base_count > capacity - running_total) {
      history_fail(HISTORY_ERROR_CAPACITY);
      atomicStore(&par_meta[0u], 1u);
    } else {
      let destination = base_count + running_total;
      next_control[0u] = HISTORY_CONTROL_MAGIC;
      next_control[1u] = HISTORY_CONTROL_VERSION;
      next_control[2u] = HISTORY_CONTROL_READY;
      next_control[3u] = destination;
      next_control[4u] = capacity;
      next_control[5u] = stride;
      next_control[6u] = params.next_generation;
      next_control[7u] = params.next_seal;
      next_control[8u] = (destination + 63u) / 64u;
      next_control[9u] = 1u;
      next_control[10u] = 1u;
      next_control[11u] = 0u;
      atomicStore(&par_meta[11u], running_total);
      if (running_total == 0u) {
        atomicStore(&par_meta[0u], 2u);
      }
    }
  }
}

@compute @workgroup_size(256)
fn scatter_blocks(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let wg = workgroup_id.x;
  let lid = local_id.x;
  if (lid == 0u) {
    let status = atomicLoad(&par_meta[0u]);
    let total_blocks = atomicLoad(&par_meta[9u]);
    var block_count = 0u;
    if (status == 0u && wg < total_blocks) {
      block_count = atomicLoad(&par_meta[META_HEADER_WORDS + wg]);
    }
    if (status != 0u || block_count == 0u) {
      wg_abort = 1u;
    } else {
      let blocks_a = atomicLoad(&par_meta[7u]);
      let is_b = wg >= blocks_a;
      let local_block = select(wg, wg - blocks_a, is_b);
      wg_abort = 0u;
      wg_kind = select(0u, 1u, is_b);
      wg_row_start = local_block * HISTORY_WG_SIZE;
      wg_dest_base = atomicLoad(&par_meta[4u]) + atomicLoad(&par_meta[META_HEADER_WORDS + total_blocks + wg]);
      wg_stride = atomicLoad(&par_meta[5u]);
      wg_block_count = block_count;
    }
  }
  if (workgroupUniformLoad(&wg_abort) != 0u) { return; }
  let kind = workgroupUniformLoad(&wg_kind);
  let row_start = workgroupUniformLoad(&wg_row_start);
  let dest_base = workgroupUniformLoad(&wg_dest_base);
  let stride = workgroupUniformLoad(&wg_stride);
  let block_count = workgroupUniformLoad(&wg_block_count);

  let mask_word = live_mask[wg * 8u + (lid >> 5u)];
  let is_live = ((mask_word >> (lid & 31u)) & 1u) != 0u;
  let val = select(0u, 1u, is_live);
  wg_scan[lid] = val;
  workgroupBarrier();
  var s = val;
  for (var d = 1u; d < HISTORY_WG_SIZE; d = d << 1u) {
    var addend = 0u;
    if (lid >= d) { addend = wg_scan[lid - d]; }
    workgroupBarrier();
    s = s + addend;
    wg_scan[lid] = s;
    workgroupBarrier();
  }
  if (is_live) {
    wg_live_rows[s - 1u] = row_start + lid;
  }
  workgroupBarrier();
  let copy_vec4s = block_count * stride;
  for (var k = lid; k < copy_vec4s; k = k + HISTORY_WG_SIZE) {
    let item = k / stride;
    let comp = k - item * stride;
    let src_row = wg_live_rows[item];
    if (kind == 0u) {
      history_rows[(dest_base + item) * stride + comp] = source_a_rows[src_row * stride + comp];
    } else {
      history_rows[(dest_base + item) * stride + comp] = source_b_rows[src_row * stride + comp];
    }
  }
}
`;
}

function acquireParallelAppendScratch(device, totalBlocks) {
  const keyDevice = unwrapWebGpuCacheDevice(device);
  let entry = scratchByDevice.get(keyDevice);
  const neededCapacity = nextPow2(totalBlocks, 256);
  if (entry && !entry.destroyed && entry.blockCapacity >= neededCapacity) {
    return entry;
  }
  if (entry && !entry.destroyed) {
    const oldMeta = entry.metaBuffer;
    const oldMask = entry.liveMaskBuffer;
    if (device.queue?.onSubmittedWorkDone) {
      void device.queue.onSubmittedWorkDone().then(() => {
        try { oldMeta?.destroy?.(); } catch {}
        try { oldMask?.destroy?.(); } catch {}
      }, () => {
        try { oldMeta?.destroy?.(); } catch {}
        try { oldMask?.destroy?.(); } catch {}
      });
    } else {
      try { oldMeta?.destroy?.(); } catch {}
      try { oldMask?.destroy?.(); } catch {}
    }
  }
  const metaBytes = (META_HEADER_WORDS + neededCapacity * 2) * 4;
  const maskBytes = neededCapacity * 8 * 4;
  const metaBuffer = device.createBuffer({
    label: `ulg-sph-resident-product-history-parallel-meta-${neededCapacity}`,
    size: metaBytes,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const liveMaskBuffer = device.createBuffer({
    label: `ulg-sph-resident-product-history-parallel-mask-${neededCapacity}`,
    size: maskBytes,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const created = {
    blockCapacity: neededCapacity,
    metaBuffer,
    liveMaskBuffer,
    destroyed: false
  };
  scratchByDevice.set(keyDevice, created);
  if (!entry && device?.lost && typeof device.lost.then === 'function') {
    Promise.resolve(device.lost).then(() => {
      const cur = scratchByDevice.get(keyDevice);
      if (cur && !cur.destroyed) {
        cur.destroyed = true;
        try { cur.metaBuffer?.destroy?.(); } catch {}
        try { cur.liveMaskBuffer?.destroy?.(); } catch {}
      }
    }).catch(() => {});
  }
  return created;
}

export function encodeResidentProductHistoryParallelAppendPass({
  device,
  encoder,
  historyBuffer,
  sourceABuffer,
  sourceBBuffer,
  parentControlBuffer,
  parentControlOffsetBytes = 0,
  nextControlBuffer,
  nextControlOffsetBytes = 0,
  paramsBuffer,
  emittedControlBuffer = null,
  emittedControlOffsetBytes = 0,
  exactHistoryLayout = null,
  totalBlocks
} = {}) {
  const isExact = Boolean(exactHistoryLayout);
  const scratch = acquireParallelAppendScratch(device, totalBlocks);
  const suffix = exactLayoutCacheSuffix(exactHistoryLayout);
  const code = createSphResidentProductHistoryParallelAppendWgsl(exactHistoryLayout);
  const bindings = [
    computeBufferBinding(0, 'storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'uniform'),
    ...(isExact ? [computeBufferBinding(6, 'read-only-storage')] : []),
    computeBufferBinding(isExact ? 7 : 6, 'storage'),
    computeBufferBinding(isExact ? 8 : 7, 'storage')
  ];
  const getPipe = (entryPoint) => createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-sph-resident-product-history-parallel-append-v1:${suffix}:${entryPoint}`,
    label: `ulg-sph-resident-product-history-filtered-append-${entryPoint}`,
    code,
    entryPoint,
    bindings
  });
  const pValidate = getPipe('validate_header');
  const pClassify = getPipe('classify_blocks');
  const pScan = getPipe('scan_blocks_and_seal');
  const pScatter = getPipe('scatter_blocks');

  const bindGroup = createCachedExplicitBindGroup(device, {
    label: 'ulg-sph-resident-product-history-parallel-append-bg',
    layout: pValidate.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: historyBuffer } },
      { binding: 1, resource: { buffer: sourceABuffer } },
      { binding: 2, resource: { buffer: sourceBBuffer } },
      {
        binding: 3,
        resource: {
          buffer: parentControlBuffer,
          offset: parentControlOffsetBytes,
          size: SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_RECORD_BYTES
        }
      },
      {
        binding: 4,
        resource: {
          buffer: nextControlBuffer,
          offset: nextControlOffsetBytes,
          size: SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_RECORD_BYTES
        }
      },
      { binding: 5, resource: { buffer: paramsBuffer } },
      ...(isExact
        ? [{
            binding: 6,
            resource: {
              buffer: emittedControlBuffer,
              offset: emittedControlOffsetBytes,
              size: SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_RECORD_BYTES
            }
          }]
        : []),
      { binding: isExact ? 7 : 6, resource: { buffer: scratch.metaBuffer } },
      { binding: isExact ? 8 : 7, resource: { buffer: scratch.liveMaskBuffer } }
    ]
  });

  const pass = encoder.beginComputePass({
    label: 'ulg-sph-resident-product-history-filtered-append'
  });
  pass.setBindGroup(0, bindGroup);
  pass.setPipeline(pValidate.pipeline);
  pass.dispatchWorkgroups(1);
  pass.setPipeline(pClassify.pipeline);
  pass.dispatchWorkgroups(totalBlocks);
  pass.setPipeline(pScan.pipeline);
  pass.dispatchWorkgroups(1);
  pass.setPipeline(pScatter.pipeline);
  pass.dispatchWorkgroups(totalBlocks);
  pass.end();
  return { totalBlocks, scratch };
}
