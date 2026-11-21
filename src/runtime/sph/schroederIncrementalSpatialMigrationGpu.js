import {
  SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS,
  SCHROEDER_SPATIAL_EPOCH_KEY_WORDS,
  SCHROEDER_SPATIAL_EPOCH_MAGIC,
  SCHROEDER_SPATIAL_EPOCH_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_EPOCH_STATUS_CAPACITY_OVERFLOW,
  SCHROEDER_SPATIAL_EPOCH_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_EPOCH_STATUS_INVALID_SOURCE,
  SCHROEDER_SPATIAL_EPOCH_STATUS_READY,
  SCHROEDER_SPATIAL_EPOCH_VERSION,
  SCHROEDER_SPATIAL_QUERY_EVIDENCE_WORDS,
  SCHROEDER_SPATIAL_QUERY_GEOMETRY_SINGLE_CHART_POW2,
  ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
  createSchroederSpatialEpochBuildPlan,
  createSchroederSpatialEpochLayout
} from '../../../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_ACTIVE_NODE_V0
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsView.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  unwrapWebGpuCacheDevice
} from '../webgpuComputeLayout.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';
import {
  SCHROEDER_SPATIAL_EPOCH_PARAMS_BYTES,
  createSchroederSpatialEpochGpu
} from './schroederSpatialEpochGpu.js';

export const ULG_SCHROEDER_INCREMENTAL_SPATIAL_MIGRATION_SCHEMA =
  'peercompute.ulg.schroeder-incremental-spatial-migration.v1';
export const ULG_SCHROEDER_INCREMENTAL_SPATIAL_CERTIFICATE_SCHEMA =
  'peercompute.ulg.schroeder-incremental-spatial-certificate.v1';

export const SCHROEDER_INCREMENTAL_MIGRATION_MODE = Object.freeze({
  UNINITIALIZED: 0,
  ZERO_CHURN_REBASE: 1,
  ADJACENT_CELL_REPAIR: 2,
  FULL_RADIX_FALLBACK: 3
});

export const SCHROEDER_INCREMENTAL_FALLBACK_FLAG = Object.freeze({
  NONE: 0,
  NO_PREDECESSOR: 1 << 0,
  SOURCE_COUNT_CHANGED: 1 << 1,
  EPOCH_CONTRACT_CHANGED: 1 << 2,
  INVALID_SOURCE: 1 << 3,
  DISPLACEMENT_CERTIFICATE_EXCEEDED: 1 << 4,
  MULTI_CELL_JUMP: 1 << 5,
  MOVED_BUDGET_EXCEEDED: 1 << 6,
  CAPACITY_OVERFLOW: 1 << 7,
  FORCED_FULL_REBUILD: 1 << 8
});

export const SCHROEDER_INCREMENTAL_CERTIFICATE_WORDS = 16;

const UINT32_BYTES = 4;
const ACTIVE_NODE_STRIDE_FLOATS = 16;
const PARAMS_BYTES = 256;
const MAX_EXACT_F32_INTEGER = 0x00ff_ffff;
const SCAN_TILE_CELLS = 512;
const MAX_SCAN_BLOCKS = 1024;
const MAX_SUPPORTED_CELL_CAPACITY = SCAN_TILE_CELLS * MAX_SCAN_BLOCKS; // 524,288 cells
const CHUNK_SORT_SIZE = 1024;
const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x01,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  UNIFORM: 0x40,
  STORAGE: 0x80,
  INDIRECT: 0x100
});

function fnv1a32(text) {
  let hash = 0x811c9dc5;
  const str = String(text ?? '');
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i) & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function positiveInteger(value, label, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new RangeError(`${label} must be an integer in [1, ${max}]`);
  }
  return n;
}

function nonNegativeInteger(value, label, max = 0xffff_ffff) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max) {
    throw new RangeError(`${label} must be an integer in [0, ${max}]`);
  }
  return n;
}

function normalizeMaxMovedMembers(value = 16384) {
  const requested = positiveInteger(value, 'maxMovedMembers', 16384);
  for (const candidate of [1024, 2048, 4096, 8192, 16384]) {
    if (candidate >= requested) return candidate;
  }
  return 16384;
}

export function createSchroederIncrementalSpatialScratchLayout({
  maxSourceCount,
  cellCapacity,
  maxMovedMembers
}) {
  let cursor = 0;
  const reserve = (words) => {
    const start = cursor;
    cursor += words;
    return start;
  };
  const oldIncomingGroupOffset = reserve(cellCapacity); // cleared before pass
  const movedFlagOffset = reserve(maxSourceCount);
  const movedSourceOffset = reserve(maxMovedMembers);
  const movedNewKeyOffset = reserve(maxMovedMembers * SCHROEDER_SPATIAL_EPOCH_KEY_WORDS);
  const sortAOffset = reserve(maxMovedMembers);
  const sortBOffset = reserve(maxMovedMembers);
  const sortedMovedGroupOffset = reserve(maxMovedMembers);
  const destKeyOffset = reserve(maxMovedMembers * SCHROEDER_SPATIAL_EPOCH_KEY_WORDS);
  const destOffsetOffset = reserve(maxMovedMembers + 1);
  const destExistingOldCellOffset = reserve(maxMovedMembers);
  const destFinalCellOffset = reserve(maxMovedMembers);
  const newOnlyGroupsOffset = reserve(maxMovedMembers);
  const brandNewPrefixOffset = reserve(maxMovedMembers + 1);
  const survRankOldOffset = reserve(cellCapacity + 1);
  const memberPrefixOldOffset = reserve(cellCapacity + 1);
  const oldToNewCellOffset = reserve(cellCapacity);
  const dirtyOldCellsOffset = reserve(Math.min(cellCapacity, maxMovedMembers * 2));
  const blockSurvOffset = reserve(MAX_SCAN_BLOCKS);
  const blockMemOffset = reserve(MAX_SCAN_BLOCKS);
  const metaOffset = reserve(8); // [destGroupCount, brandNewCount, ...]

  return Object.freeze({
    oldIncomingGroupOffset,
    oldIncomingGroupWords: cellCapacity,
    movedFlagOffset,
    movedSourceOffset,
    movedNewKeyOffset,
    sortAOffset,
    sortBOffset,
    sortedMovedGroupOffset,
    destKeyOffset,
    destOffsetOffset,
    destExistingOldCellOffset,
    destFinalCellOffset,
    newOnlyGroupsOffset,
    brandNewPrefixOffset,
    survRankOldOffset,
    memberPrefixOldOffset,
    oldToNewCellOffset,
    dirtyOldCellsOffset,
    dirtyOldCellsCapacity: Math.min(cellCapacity, maxMovedMembers * 2),
    blockSurvOffset,
    blockMemOffset,
    destGroupCountWord: metaOffset + 0,
    brandNewCountWord: metaOffset + 1,
    totalWords: cursor,
    byteLength: cursor * UINT32_BYTES,
    atomicTotalWords: SCHROEDER_INCREMENTAL_CERTIFICATE_WORDS + cellCapacity,
    atomicByteLength: (SCHROEDER_INCREMENTAL_CERTIFICATE_WORDS + cellCapacity) * UINT32_BYTES
  });
}

export function createSchroederIncrementalSpatialMigrationWgsl(scratchLayout) {
  const S = scratchLayout;
  return /* wgsl */ `
struct MigrationParams {
  source_count: u32,
  source_capacity: u32,
  cell_capacity: u32,
  sort_key_word_count: u32,
  sort_mode: u32,
  generation_id: u32,
  device_ordinal: u32,
  lane_ordinal: u32,
  source_family_id: u32,
  storage_generation: u32,
  physics_tick: u32,
  physics_substep: u32,
  position_epoch: u32,
  topology_epoch: u32,
  chart_epoch: u32,
  level_epoch: u32,
  support_epoch: u32,
  lease_token: u32,
  build_ordinal: u32,
  sort_unique_ordinal: u32,
  chart_min: u32,
  chart_count: u32,
  level_min: i32,
  level_count: u32,
  cell_min_x: i32,
  cell_count_x: u32,
  cell_min_y: i32,
  cell_count_y: u32,
  cell_min_z: i32,
  cell_count_z: u32,
  header_words: u32,
  cell_keys_offset_words: u32,
  cell_offsets_offset_words: u32,
  cell_members_offset_words: u32,
  particle_to_cell_offset_words: u32,
  directory_capacity_words: u32,
  required_capacity_words: u32,
  key_dispatch_x: u32,
  assemble_dispatch_x: u32,
  consumer_dispatch_x_limit: u32,
  query_geometry_mode: u32,
  query_chart_id: u32,
  query_min_level: i32,
  query_max_level: i32,
  query_base_grid_spacing_m: f32,
  source_row_layout_id: u32,
  logical_count_gpu_authored: u32,
  physical_radix_count: u32,
  has_prev_source: u32,
  max_moved_members: u32,
  max_cell_jump: u32,
  max_disp_ratio: f32,
  prev_generation_id: u32,
  prev_cell_keys_offset_words: u32,
  prev_cell_offsets_offset_words: u32,
  prev_cell_members_offset_words: u32,
  prev_particle_to_cell_offset_words: u32,
  scan_workgroups: u32,
  directory_abi_version: u32,
  allow_membership_delta: u32,
  enforce_cell_jump_limit: u32,
  pad3: u32,
  pad4: u32,
  pad5: u32,
};

@group(0) @binding(0) var<uniform> params: MigrationParams;
@group(0) @binding(1) var<storage, read> source_rows: array<f32>;
@group(0) @binding(2) var<storage, read> prev_source_rows: array<f32>;
@group(0) @binding(3) var<storage, read> prev_directory: array<u32>;
@group(0) @binding(4) var<storage, read_write> directory: array<u32>;
@group(0) @binding(5) var<storage, read_write> consumer_dispatch: array<u32>;
@group(0) @binding(6) var<storage, read_write> atomics_buf: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> scratch: array<u32>;
@group(0) @binding(8) var<storage, read> active_source_view: array<u32>;

const MAGIC: u32 = 0x53534531u;
const ABI_VERSION: u32 = 1u;
const ACTIVE_SOURCE_MAGIC: u32 = 0x53535631u;
const ACTIVE_SOURCE_VERSION: u32 = 1u;
const ACTIVE_SOURCE_STATUS_EXACT: u32 = 3u;
const ACTIVE_SOURCE_STATUS_REJECTED: u32 = 0xfcu;
const ACTIVE_SOURCE_HEADER_WORDS: u32 = 64u;
const ACTIVE_SOURCE_MISSING: u32 = 0xffffffffu;
const ACTIVE_NODE_STRIDE: u32 = 16u;
const EXACT_KEY_WORDS: u32 = 5u;
const SORT_MODE_BOUNDED_ATLAS: u32 = 1u;
const SORT_MODE_LEXICOGRAPHIC: u32 = 2u;
const QUERY_GEOMETRY_GENERIC: u32 = 0u;
const QUERY_GEOMETRY_SINGLE_CHART_POW2: u32 = 1u;
const SOURCE_LAYOUT_LEVEL_ASSIGNMENT: u32 = 1u;
const SOURCE_LAYOUT_ACTIVE_NODE: u32 = 2u;
const SOURCE_ADAPTER_ACTIVE_NODE_ROWS: u32 = 1u;
const SOURCE_ADAPTER_EXACT_NEAR_QUERY: u32 = 2u;
const QUERY_EVIDENCE_WORDS: u32 = 6u;
const STATUS_READY: u32 = 1u;
const STATUS_ADMITTED: u32 = 2u;
const STATUS_FAIL_CLOSED: u32 = 4u;
const STATUS_INVALID_SOURCE: u32 = 8u;
const STATUS_CAPACITY_OVERFLOW: u32 = 16u;

const MODE_ZERO_CHURN_REBASE: u32 = 1u;
const MODE_ADJACENT_CELL_REPAIR: u32 = 2u;

const FLAG_NO_PREDECESSOR: u32 = 1u;
const FLAG_SOURCE_COUNT_CHANGED: u32 = 2u;
const FLAG_INVALID_SOURCE: u32 = 8u;
const FLAG_DISP_EXCEEDED: u32 = 16u;
const FLAG_MULTI_CELL_JUMP: u32 = 32u;
const FLAG_MOVED_BUDGET_EXCEEDED: u32 = 64u;
const FLAG_CAPACITY_OVERFLOW: u32 = 128u;

// atomics_buf layout:
// 0: mode, 1: fallbackFlags, 2: movedMemberCount, 3: dirtyOldCellCount,
// 4: insertedCellCount, 5: droppedCellCount, 6: admittedCellCount,
// 7: maxDispRatioBits, 8: maxCellJumpLinf, 9: generationId,
// 10: prevGenerationId, 11: admitted, 12: invalidSourceCount,
// 13: overflowCount, 14: occupiedLevelMaskLow, 15: occupiedLevelMaskHigh,
// 16..16+cellCapacity-1: old_cell_outgoing[c]
const OUTGOING_BASE: u32 = 16u;

const S_OLD_INCOMING_GROUP: u32 = ${S.oldIncomingGroupOffset}u;
const S_MOVED_FLAG: u32 = ${S.movedFlagOffset}u;
const S_MOVED_SOURCE: u32 = ${S.movedSourceOffset}u;
const S_MOVED_NEW_KEY: u32 = ${S.movedNewKeyOffset}u;
const S_SORT_A: u32 = ${S.sortAOffset}u;
const S_SORT_B: u32 = ${S.sortBOffset}u;
const S_SORTED_MOVED_GROUP: u32 = ${S.sortedMovedGroupOffset}u;
const S_DEST_KEY: u32 = ${S.destKeyOffset}u;
const S_DEST_OFFSET: u32 = ${S.destOffsetOffset}u;
const S_DEST_EXISTING_OLD: u32 = ${S.destExistingOldCellOffset}u;
const S_DEST_FINAL_CELL: u32 = ${S.destFinalCellOffset}u;
const S_NEW_ONLY_GROUPS: u32 = ${S.newOnlyGroupsOffset}u;
const S_BRAND_NEW_PREFIX: u32 = ${S.brandNewPrefixOffset}u;
const S_SURV_RANK_OLD: u32 = ${S.survRankOldOffset}u;
const S_MEMBER_PREFIX_OLD: u32 = ${S.memberPrefixOldOffset}u;
const S_OLD_TO_NEW_CELL: u32 = ${S.oldToNewCellOffset}u;
const S_DIRTY_OLD_CELLS: u32 = ${S.dirtyOldCellsOffset}u;
const S_DIRTY_CAPACITY: u32 = ${S.dirtyOldCellsCapacity}u;
const S_BLOCK_SURV: u32 = ${S.blockSurvOffset}u;
const S_BLOCK_MEM: u32 = ${S.blockMemOffset}u;
const S_DEST_GROUP_COUNT: u32 = ${S.destGroupCountWord}u;
const S_BRAND_NEW_COUNT: u32 = ${S.brandNewCountWord}u;

const MAX_EXACT_F32_INTEGER: f32 = 16777215.0;
const MIN_SAFE_I32_F32: f32 = -2147483520.0;
const MAX_SAFE_I32_F32: f32 = 2147483520.0;

fn finite_f32(v: f32) -> bool {
  return v == v && abs(v) <= 3.402823e38;
}
fn integral_f32(v: f32) -> bool {
  return finite_f32(v) && v == trunc(v);
}
fn safe_i32_f32(v: f32) -> bool {
  return finite_f32(v) && v >= MIN_SAFE_I32_F32 && v <= MAX_SAFE_I32_F32;
}
fn signed_order_key(v: i32) -> u32 {
  return bitcast<u32>(v) ^ 0x80000000u;
}
fn abs_diff_u32(a: u32, b: u32) -> u32 {
  return select(b - a, a - b, a >= b);
}
fn low_bits_mask(bit_count: u32) -> u32 {
  if (bit_count == 0u) { return 0u; }
  if (bit_count >= 32u) { return 0xffffffffu; }
  return (1u << bit_count) - 1u;
}

fn v2_active_source_view_admitted() -> bool {
  let bound_words = arrayLength(&active_source_view);
  if (bound_words < ACTIVE_SOURCE_HEADER_WORDS) { return false; }
  let status = active_source_view[2u];
  let physical_count = active_source_view[16u];
  let physical_capacity = active_source_view[17u];
  let active_count = active_source_view[18u];
  let active_capacity = active_source_view[19u];
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  let capacity_words = active_source_view[27u];
  return params.logical_count_gpu_authored == 1u
    && params.physical_radix_count <= params.source_capacity
    && active_source_view[0u] == ACTIVE_SOURCE_MAGIC
    && active_source_view[1u] == ACTIVE_SOURCE_VERSION
    && (status & ACTIVE_SOURCE_STATUS_EXACT) == ACTIVE_SOURCE_STATUS_EXACT
    && (status & ACTIVE_SOURCE_STATUS_REJECTED) == 0u
    && active_source_view[3u] == params.generation_id
    && active_source_view[4u] == params.device_ordinal
    && active_source_view[5u] == params.lane_ordinal
    && active_source_view[6u] == params.lease_token
    && active_source_view[7u] == params.source_family_id
    && active_source_view[8u] == params.storage_generation
    && active_source_view[9u] == params.physics_tick
    && active_source_view[10u] == params.physics_substep
    && active_source_view[11u] == params.position_epoch
    && active_source_view[12u] == params.topology_epoch
    && active_source_view[13u] == params.chart_epoch
    && active_source_view[14u] == params.level_epoch
    && active_source_view[15u] == params.support_epoch
    && physical_count == params.source_count
    && physical_count <= physical_capacity
    && physical_capacity == params.source_capacity
    && active_count <= active_capacity
    && active_count <= params.physical_radix_count
    && active_capacity == params.physical_radix_count
    && active_capacity <= physical_capacity
    && active_source_view[20u] == physical_count - active_count
    && active_source_view[21u] == 0u
    && active_source_view[22u] == 0u
    && active_source_view[23u] == SOURCE_LAYOUT_LEVEL_ASSIGNMENT
    && active_source_view[24u] == ACTIVE_NODE_STRIDE
    && active_to_physical == ACTIVE_SOURCE_HEADER_WORDS
    && physical_to_active == active_to_physical + active_capacity
    && capacity_words == physical_to_active + physical_capacity
    && capacity_words <= bound_words
    && active_source_view[29u] == params.build_ordinal
    && active_source_view[30u] == params.build_ordinal
    && active_source_view[33u] == active_count
    && active_source_view[34u] == active_count
    && active_source_view[35u] == active_count
    && active_source_view[36u] <= physical_count
    && active_source_view[43u] == active_count * 27u
    && active_source_view[47u] != 0u;
}

fn count_contract_ready() -> bool {
  if (params.directory_abi_version == 2u) {
    return v2_active_source_view_admitted()
      && params.source_row_layout_id == SOURCE_LAYOUT_LEVEL_ASSIGNMENT
      && params.source_count <= params.source_capacity
      && params.physical_radix_count <= params.source_capacity;
  }
  return params.directory_abi_version == ABI_VERSION
    && params.logical_count_gpu_authored <= 1u
    && params.physical_radix_count <= params.source_capacity
    && params.source_count <= params.physical_radix_count
    && (
      params.logical_count_gpu_authored != 0u
      || params.source_count == params.physical_radix_count
    );
}

fn live_source_count() -> u32 {
  if (!count_contract_ready()) { return 0u; }
  if (params.directory_abi_version == 2u) {
    return active_source_view[18u];
  }
  return params.source_count;
}

fn prev_active_count() -> u32 {
  if (params.directory_abi_version == 2u) {
    return prev_directory[37u];
  }
  return prev_directory[16u];
}

fn physical_source_for_active(active_ordinal: u32) -> u32 {
  let active_count = live_source_count();
  if (active_ordinal >= active_count) {
    return ACTIVE_SOURCE_MISSING;
  }
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  let physical_source = active_source_view[active_to_physical + active_ordinal];
  if (
    physical_source >= params.source_count
    || active_source_view[physical_to_active + physical_source] != active_ordinal
  ) {
    return ACTIVE_SOURCE_MISSING;
  }
  return physical_source;
}

fn prev_directory_admitted() -> bool {
  let st = prev_directory[2u];
  let is_v2 = params.directory_abi_version == 2u;
  let count_ok = select(
    prev_directory[16u] == params.source_count
      || (
        params.allow_membership_delta != 0u
        && params.logical_count_gpu_authored != 0u
        && prev_directory[16u] <= params.physical_radix_count
      ),
    prev_directory[16u] == params.source_count
      && prev_directory[37u] <= params.physical_radix_count
      && prev_directory[37u] <= params.source_count,
    is_v2
  );
  return prev_directory[0u] == MAGIC
    && prev_directory[1u] == params.directory_abi_version
    && (st & (STATUS_READY | STATUS_ADMITTED)) == (STATUS_READY | STATUS_ADMITTED)
    && (st & STATUS_FAIL_CLOSED) == 0u
    && prev_directory[3u] == params.prev_generation_id
    && count_ok
    && prev_directory[18u] <= params.cell_capacity;
}

fn exact_near_query_profile_ready() -> bool {
  if (params.query_geometry_mode == QUERY_GEOMETRY_GENERIC) { return true; }
  if (params.directory_abi_version != 2u && params.logical_count_gpu_authored != 0u) { return false; }
  if (params.query_geometry_mode != QUERY_GEOMETRY_SINGLE_CHART_POW2) { return false; }
  let min_order = signed_order_key(params.query_min_level);
  let max_order = signed_order_key(params.query_max_level);
  if (max_order < min_order || max_order - min_order >= 64u) { return false; }
  let min_spacing = params.query_base_grid_spacing_m * exp2(f32(params.query_min_level));
  let max_spacing = params.query_base_grid_spacing_m * exp2(f32(params.query_max_level));
  return params.query_chart_id <= 0x00ffffffu
    && finite_f32(params.query_base_grid_spacing_m)
    && params.query_base_grid_spacing_m > 0.0
    && finite_f32(min_spacing)
    && min_spacing >= 0.000001
    && finite_f32(max_spacing)
    && max_spacing > 0.0;
}

fn repair_aborted() -> bool {
  return atomicLoad(&atomics_buf[1]) != 0u;
}

@compute @workgroup_size(256)
fn detect_departed_members(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x == 0u) {
    if (!count_contract_ready() || !prev_directory_admitted()) {
      atomicOr(&atomics_buf[1], FLAG_NO_PREDECESSOR);
    }
  }
  if (!count_contract_ready() || !prev_directory_admitted()) { return; }
  let prev_count = prev_active_count();
  let p = gid.x;
  if (p >= prev_count) { return; }
  let is_v2 = params.directory_abi_version == 2u;
  let member = prev_directory[params.prev_cell_members_offset_words + p];
  if (member >= params.source_capacity) {
    atomicOr(&atomics_buf[1], FLAG_NO_PREDECESSOR);
    return;
  }
  var departed = false;
  if (is_v2) {
    let physical_to_active = active_source_view[26u];
    departed = member >= params.source_count
      || active_source_view[physical_to_active + member] == ACTIVE_SOURCE_MISSING;
  } else {
    departed = member >= live_source_count();
  }
  if (departed) {
    if (params.allow_membership_delta == 0u) {
      atomicOr(&atomics_buf[1], FLAG_SOURCE_COUNT_CHANGED);
      return;
    }
    let prev_raw = prev_directory[params.prev_particle_to_cell_offset_words + member];
    if (is_v2 && prev_raw == 0u) {
      atomicOr(&atomics_buf[1], FLAG_NO_PREDECESSOR);
      return;
    }
    let old_c = select(prev_raw, prev_raw - 1u, is_v2);
    if (old_c >= prev_directory[18u]) {
      atomicOr(&atomics_buf[1], FLAG_NO_PREDECESSOR);
      return;
    }
    scratch[S_MOVED_FLAG + member] = 1u;
    atomicAdd(&atomics_buf[OUTGOING_BASE + old_c], 1u);
  } else {
    scratch[S_MOVED_FLAG + member] = 0u;
  }
}

var<workgroup> wg_mask_lo: atomic<u32>;
var<workgroup> wg_mask_hi: atomic<u32>;
var<workgroup> wg_max_disp: atomic<u32>;
var<workgroup> wg_max_jump: atomic<u32>;

@compute @workgroup_size(256)
fn detect_moved_members(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  if (lid.x == 0u) {
    atomicStore(&wg_mask_lo, 0u);
    atomicStore(&wg_mask_hi, 0u);
    atomicStore(&wg_max_disp, 0u);
    atomicStore(&wg_max_jump, 0u);
    if (gid.x == 0u && (!count_contract_ready() || !prev_directory_admitted())) {
      atomicOr(&atomics_buf[1], FLAG_NO_PREDECESSOR);
    }
  }
  workgroupBarrier();

  let is_v2 = params.directory_abi_version == 2u;
  let live_count = live_source_count();
  let idx = gid.x;
  if (idx < live_count && count_contract_ready() && prev_directory_admitted()) {
    let i = select(idx, physical_source_for_active(idx), is_v2);
    if (is_v2 && i == ACTIVE_SOURCE_MISSING) {
      atomicAdd(&atomics_buf[12], 1u);
      atomicOr(&atomics_buf[1], FLAG_INVALID_SOURCE);
    } else {
    let row = i * ACTIVE_NODE_STRIDE;
    let source_layout = params.source_row_layout_id;
    let level_f = source_rows[row + 0u];
    var native_spacing = 0.0;
    var source_particle_f = f32(i);
    var status_f = 0.0;
    var layout_ok = true;
    if (source_layout == SOURCE_LAYOUT_LEVEL_ASSIGNMENT) {
      native_spacing = source_rows[row + 1u];
      status_f = source_rows[row + 10u];
    } else if (source_layout == SOURCE_LAYOUT_ACTIVE_NODE) {
      native_spacing = source_rows[row + 8u];
      source_particle_f = source_rows[row + 10u];
      status_f = source_rows[row + 11u];
    } else {
      layout_ok = false;
    }
    let pos = vec3<f32>(source_rows[row + 12u], source_rows[row + 13u], source_rows[row + 14u]);
    let chart_f = source_rows[row + 15u];

    let fields_valid = layout_ok
      && integral_f32(level_f)
      && integral_f32(source_particle_f)
      && integral_f32(chart_f)
      && integral_f32(status_f)
      && status_f >= 0.0 && status_f <= 255.0
      && finite_f32(native_spacing) && native_spacing > 0.0
      && finite_f32(pos.x) && finite_f32(pos.y) && finite_f32(pos.z);

    var row_admitted = fields_valid
      && source_particle_f == f32(i)
      && i <= 16777215u
      && (u32(round(status_f)) & 31u) > 0u
      && (u32(round(status_f)) & 128u) == 0u
      && chart_f >= 0.0 && chart_f <= MAX_EXACT_F32_INTEGER
      && level_f >= MIN_SAFE_I32_F32 && level_f <= MAX_SAFE_I32_F32;

    if (row_admitted && params.query_geometry_mode == QUERY_GEOMETRY_SINGLE_CHART_POW2) {
      let row_chart = u32(round(chart_f));
      let row_level = i32(round(level_f));
      let row_level_order = signed_order_key(row_level);
      let q_min = signed_order_key(params.query_min_level);
      let q_max = signed_order_key(params.query_max_level);
      let expected_spacing = params.query_base_grid_spacing_m * exp2(f32(row_level));
      row_admitted = exact_near_query_profile_ready()
        && row_chart == params.query_chart_id
        && row_level_order >= q_min && row_level_order <= q_max
        && bitcast<u32>(native_spacing) == bitcast<u32>(expected_spacing)
        && (u32(round(status_f)) & 64u) == 0u;
    } else if (row_admitted && params.query_geometry_mode != QUERY_GEOMETRY_GENERIC) {
      row_admitted = false;
    }

    if (!row_admitted) {
      atomicAdd(&atomics_buf[12], 1u);
      atomicOr(&atomics_buf[1], FLAG_INVALID_SOURCE);
    } else {
      let cell_f = floor(pos / native_spacing);
      var cell_valid = safe_i32_f32(cell_f.x) && safe_i32_f32(cell_f.y) && safe_i32_f32(cell_f.z);
      if (cell_valid && params.chart_count > 0u) {
        let b_ord = vec3<u32>(signed_order_key(i32(cell_f.x)), signed_order_key(i32(cell_f.y)), signed_order_key(i32(cell_f.z)));
        let b_min = vec3<u32>(signed_order_key(params.cell_min_x), signed_order_key(params.cell_min_y), signed_order_key(params.cell_min_z));
        let b_off = b_ord - b_min;
        cell_valid = b_ord.x >= b_min.x && b_off.x < params.cell_count_x
          && b_ord.y >= b_min.y && b_off.y < params.cell_count_y
          && b_ord.z >= b_min.z && b_off.z < params.cell_count_z;
      }
      if (!cell_valid) {
        atomicAdd(&atomics_buf[12], 1u);
        atomicOr(&atomics_buf[1], FLAG_INVALID_SOURCE);
      } else {
        let chart = u32(round(chart_f));
        let level = i32(round(level_f));
        let level_order = signed_order_key(level);
        let cell_order = vec3<u32>(
          signed_order_key(i32(cell_f.x)),
          signed_order_key(i32(cell_f.y)),
          signed_order_key(i32(cell_f.z))
        );
        if (params.sort_mode == SORT_MODE_BOUNDED_ATLAS) {
          let c_off = chart - params.chart_min;
          let l_min = signed_order_key(params.level_min);
          let c_min = vec3<u32>(signed_order_key(params.cell_min_x), signed_order_key(params.cell_min_y), signed_order_key(params.cell_min_z));
          let l_off = level_order - l_min;
          let xyz_off = cell_order - c_min;
          let in_atlas = chart >= params.chart_min && c_off < params.chart_count
            && level_order >= l_min && l_off < params.level_count
            && cell_order.x >= c_min.x && xyz_off.x < params.cell_count_x
            && cell_order.y >= c_min.y && xyz_off.y < params.cell_count_y
            && cell_order.z >= c_min.z && xyz_off.z < params.cell_count_z;
          if (!in_atlas) {
            atomicAdd(&atomics_buf[12], 1u);
            atomicOr(&atomics_buf[1], FLAG_INVALID_SOURCE);
          }
        } else if (params.sort_mode != SORT_MODE_LEXICOGRAPHIC) {
          atomicAdd(&atomics_buf[12], 1u);
          atomicOr(&atomics_buf[1], FLAG_INVALID_SOURCE);
        }

        if (params.query_geometry_mode == QUERY_GEOMETRY_SINGLE_CHART_POW2) {
          let q_min = signed_order_key(params.query_min_level);
          let level_ordinal = level_order - q_min;
          if (level_ordinal < 32u) {
            atomicOr(&wg_mask_lo, 1u << level_ordinal);
          } else if (level_ordinal < 64u) {
            atomicOr(&wg_mask_hi, 1u << (level_ordinal - 32u));
          }
        }

        if (params.has_prev_source != 0u && params.max_disp_ratio > 0.0) {
          let prev_pos = vec3<f32>(
            prev_source_rows[row + 12u],
            prev_source_rows[row + 13u],
            prev_source_rows[row + 14u]
          );
          let delta = pos - prev_pos;
          let disp_ratio = length(delta) / native_spacing;
          if (!finite_f32(disp_ratio) || disp_ratio > params.max_disp_ratio) {
            atomicOr(&atomics_buf[1], FLAG_DISP_EXCEEDED);
            atomicMax(&wg_max_disp, 0x7f7fffffu);
          } else {
            atomicMax(&wg_max_disp, bitcast<u32>(max(disp_ratio, 0.0)));
          }
        }

        let prev_raw = prev_directory[params.prev_particle_to_cell_offset_words + i];
        let prev_cell_count = prev_directory[18u];
        let was_active = select((i < prev_active_count()), (prev_raw > 0u), is_v2);
        if (!was_active) {
          if (params.allow_membership_delta == 0u) {
            atomicOr(&atomics_buf[1], FLAG_SOURCE_COUNT_CHANGED);
          } else {
            scratch[S_MOVED_FLAG + i] = 1u;
            let slot = atomicAdd(&atomics_buf[2], 1u);
            if (slot < params.max_moved_members) {
              scratch[S_MOVED_SOURCE + slot] = i;
              let nk = S_MOVED_NEW_KEY + slot * EXACT_KEY_WORDS;
              scratch[nk + 0u] = chart;
              scratch[nk + 1u] = level_order;
              scratch[nk + 2u] = cell_order.x;
              scratch[nk + 3u] = cell_order.y;
              scratch[nk + 4u] = cell_order.z;
            } else {
              atomicOr(&atomics_buf[1], FLAG_MOVED_BUDGET_EXCEEDED);
            }
          }
        } else {
          let old_c = select(prev_raw, prev_raw - 1u, is_v2);
          if (old_c >= prev_cell_count) {
            atomicOr(&atomics_buf[1], FLAG_NO_PREDECESSOR);
          } else {
            let k_base = params.prev_cell_keys_offset_words + old_c * EXACT_KEY_WORDS;
            let k0 = prev_directory[k_base + 0u];
            let k1 = prev_directory[k_base + 1u];
            let k2 = prev_directory[k_base + 2u];
            let k3 = prev_directory[k_base + 3u];
            let k4 = prev_directory[k_base + 4u];

            var jump: u32 = 0u;
            if (chart != k0 || level_order != k1) {
              jump = 0xffffffffu;
            } else {
              jump = max(abs_diff_u32(cell_order.x, k2), max(abs_diff_u32(cell_order.y, k3), abs_diff_u32(cell_order.z, k4)));
            }
            atomicMax(&wg_max_jump, jump);
            if (params.enforce_cell_jump_limit != 0u && jump > params.max_cell_jump) {
              atomicOr(&atomics_buf[1], FLAG_MULTI_CELL_JUMP);
            }

            let moved = (chart != k0) || (level_order != k1)
              || (cell_order.x != k2) || (cell_order.y != k3) || (cell_order.z != k4);
            scratch[S_MOVED_FLAG + i] = select(0u, 1u, moved);
            if (moved) {
              let slot = atomicAdd(&atomics_buf[2], 1u);
              atomicAdd(&atomics_buf[OUTGOING_BASE + old_c], 1u);
              if (slot < params.max_moved_members) {
                scratch[S_MOVED_SOURCE + slot] = i;
                let nk = S_MOVED_NEW_KEY + slot * EXACT_KEY_WORDS;
                scratch[nk + 0u] = chart;
                scratch[nk + 1u] = level_order;
                scratch[nk + 2u] = cell_order.x;
                scratch[nk + 3u] = cell_order.y;
                scratch[nk + 4u] = cell_order.z;
              } else {
                atomicOr(&atomics_buf[1], FLAG_MOVED_BUDGET_EXCEEDED);
              }
            }
          }
        }
      }
    }
    }
  }
  workgroupBarrier();
  if (lid.x == 0u) {
    let lo = atomicLoad(&wg_mask_lo);
    let hi = atomicLoad(&wg_mask_hi);
    let md = atomicLoad(&wg_max_disp);
    let mj = atomicLoad(&wg_max_jump);
    if (lo != 0u) { atomicOr(&atomics_buf[14], lo); }
    if (hi != 0u) { atomicOr(&atomics_buf[15], hi); }
    if (md != 0u) { atomicMax(&atomics_buf[7], md); }
    if (mj != 0u) { atomicMax(&atomics_buf[8], mj); }
  }
}

fn moved_slot_less(slot_a: u32, slot_b: u32) -> bool {
  if (slot_a == slot_b) { return false; }
  if (slot_b == 0xffffffffu) { return true; }
  if (slot_a == 0xffffffffu) { return false; }
  let ka = S_MOVED_NEW_KEY + slot_a * EXACT_KEY_WORDS;
  let kb = S_MOVED_NEW_KEY + slot_b * EXACT_KEY_WORDS;
  for (var w = 0u; w < EXACT_KEY_WORDS; w = w + 1u) {
    let va = scratch[ka + w];
    let vb = scratch[kb + w];
    if (va != vb) { return va < vb; }
  }
  return scratch[S_MOVED_SOURCE + slot_a] < scratch[S_MOVED_SOURCE + slot_b];
}

var<workgroup> wg_sort_slots: array<u32, 1024>;
var<workgroup> wg_u_aborted: u32;
var<workgroup> wg_u_moved: u32;

@compute @workgroup_size(256)
fn sort_moved_chunks(
  @builtin(workgroup_id) wid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  if (lid.x == 0u) {
    wg_u_aborted = atomicLoad(&atomics_buf[1]);
    wg_u_moved = atomicLoad(&atomics_buf[2]);
  }
  let aborted = workgroupUniformLoad(&wg_u_aborted);
  let M = workgroupUniformLoad(&wg_u_moved);
  let chunk_base = wid.x * 1024u;
  if (aborted != 0u || chunk_base >= M) { return; }
  let chunk_len = min(1024u, M - chunk_base);
  let tid = lid.x;
  for (var k = 0u; k < 4u; k = k + 1u) {
    let local_idx = tid + k * 256u;
    wg_sort_slots[local_idx] = select(0xffffffffu, chunk_base + local_idx, local_idx < chunk_len);
  }
  workgroupBarrier();

  for (var size = 2u; size <= 1024u; size = size << 1u) {
    for (var stride = size >> 1u; stride > 0u; stride = stride >> 1u) {
      for (var p = 0u; p < 2u; p = p + 1u) {
        let pair_id = tid + p * 256u;
        let i = (pair_id / stride) * (2u * stride) + (pair_id % stride);
        let j = i + stride;
        let asc = (i & size) == 0u;
        let a = wg_sort_slots[i];
        let b = wg_sort_slots[j];
        let swap = select(moved_slot_less(a, b), moved_slot_less(b, a), asc);
        if (swap) {
          wg_sort_slots[i] = b;
          wg_sort_slots[j] = a;
        }
      }
      workgroupBarrier();
    }
  }

  for (var k = 0u; k < 4u; k = k + 1u) {
    let local_idx = tid + k * 256u;
    if (local_idx < chunk_len) {
      scratch[S_SORT_A + chunk_base + local_idx] = wg_sort_slots[local_idx];
    }
  }
}

fn merge_runs_step(idx: u32, width: u32, in_base: u32, out_base: u32) {
  let M = atomicLoad(&atomics_buf[2]);
  if (repair_aborted() || idx >= M) { return; }
  let pair_base = (idx / (2u * width)) * (2u * width);
  let mid = min(pair_base + width, M);
  let end_idx = min(pair_base + 2u * width, M);
  let my_slot = scratch[in_base + idx];
  if (mid >= end_idx) {
    scratch[out_base + idx] = my_slot;
    return;
  }
  if (idx < mid) {
    var lo = mid;
    var hi = end_idx;
    while (lo < hi) {
      let m = (lo + hi) >> 1u;
      if (moved_slot_less(scratch[in_base + m], my_slot)) {
        lo = m + 1u;
      } else {
        hi = m;
      }
    }
    let out_pos = pair_base + (idx - pair_base) + (lo - mid);
    scratch[out_base + out_pos] = my_slot;
  } else {
    var lo = pair_base;
    var hi = mid;
    while (lo < hi) {
      let m = (lo + hi) >> 1u;
      if (moved_slot_less(scratch[in_base + m], my_slot)) {
        lo = m + 1u;
      } else {
        hi = m;
      }
    }
    let out_pos = pair_base + (idx - mid) + (lo - pair_base);
    scratch[out_base + out_pos] = my_slot;
  }
}

@compute @workgroup_size(256)
fn merge_w1024(@builtin(global_invocation_id) gid: vec3<u32>) {
  merge_runs_step(gid.x, 1024u, S_SORT_A, S_SORT_B);
}
@compute @workgroup_size(256)
fn merge_w2048(@builtin(global_invocation_id) gid: vec3<u32>) {
  merge_runs_step(gid.x, 2048u, S_SORT_B, S_SORT_A);
}
@compute @workgroup_size(256)
fn merge_w4096(@builtin(global_invocation_id) gid: vec3<u32>) {
  merge_runs_step(gid.x, 4096u, S_SORT_A, S_SORT_B);
}
@compute @workgroup_size(256)
fn merge_w8192(@builtin(global_invocation_id) gid: vec3<u32>) {
  merge_runs_step(gid.x, 8192u, S_SORT_B, S_SORT_A);
}

fn moved_slots_same_key(slot_a: u32, slot_b: u32) -> bool {
  let ka = S_MOVED_NEW_KEY + slot_a * EXACT_KEY_WORDS;
  let kb = S_MOVED_NEW_KEY + slot_b * EXACT_KEY_WORDS;
  for (var w = 0u; w < EXACT_KEY_WORDS; w = w + 1u) {
    if (scratch[ka + w] != scratch[kb + w]) { return false; }
  }
  return true;
}

fn compare_dest_vs_prev_cell(dest_g: u32, prev_c: u32) -> i32 {
  let dk = S_DEST_KEY + dest_g * EXACT_KEY_WORDS;
  let pk = params.prev_cell_keys_offset_words + prev_c * EXACT_KEY_WORDS;
  for (var w = 0u; w < EXACT_KEY_WORDS; w = w + 1u) {
    let va = scratch[dk + w];
    let vb = prev_directory[pk + w];
    if (va < vb) { return -1; }
    if (va > vb) { return 1; }
  }
  return 0;
}

fn find_prev_cell_exact(dest_g: u32, prev_count: u32) -> u32 {
  var lo = 0u;
  var hi = prev_count;
  while (lo < hi) {
    let mid = (lo + hi) >> 1u;
    let cmp = compare_dest_vs_prev_cell(dest_g, mid);
    if (cmp == 0) { return mid; }
    if (cmp > 0) { lo = mid + 1u; } else { hi = mid; }
  }
  return 0xffffffffu;
}

var<workgroup> wg_scan_a: array<u32, 256>;
var<workgroup> wg_scan_b: array<u32, 256>;
var<workgroup> wg_running_a: u32;
var<workgroup> wg_running_b: u32;

@compute @workgroup_size(256)
fn classify_moved_groups(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  if (tid == 0u) {
    wg_u_aborted = atomicLoad(&atomics_buf[1]);
    wg_u_moved = atomicLoad(&atomics_buf[2]);
    wg_running_a = 0u;
    wg_running_b = 0u;
  }
  let aborted = workgroupUniformLoad(&wg_u_aborted);
  let M = workgroupUniformLoad(&wg_u_moved);
  if (aborted != 0u) { return; }
  if (M == 0u) {
    if (tid == 0u) {
      scratch[S_DEST_GROUP_COUNT] = 0u;
      scratch[S_BRAND_NEW_COUNT] = 0u;
      scratch[S_BRAND_NEW_PREFIX + 0u] = 0u;
    }
    return;
  }

  // Step A: group sorted moved slots [0..M) into G unique destination cells.
  for (var base = 0u; base < M; base = base + 256u) {
    let idx = base + tid;
    var is_head = 0u;
    var my_slot = 0u;
    if (idx < M) {
      my_slot = scratch[S_SORT_A + idx];
      if (idx == 0u) {
        is_head = 1u;
      } else {
        let prev_slot = scratch[S_SORT_A + idx - 1u];
        is_head = select(1u, 0u, moved_slots_same_key(prev_slot, my_slot));
      }
    }
    wg_scan_a[tid] = is_head;
    workgroupBarrier();
    // Hillis-Steele inclusive scan over 256 elements
    for (var d = 1u; d < 256u; d = d << 1u) {
      let add_v = select(0u, wg_scan_a[tid - d], tid >= d);
      workgroupBarrier();
      wg_scan_a[tid] = wg_scan_a[tid] + add_v;
      workgroupBarrier();
    }
    let inc = wg_running_a + wg_scan_a[tid];
    if (idx < M) {
      let g = inc - 1u;
      scratch[S_SORTED_MOVED_GROUP + idx] = g;
      if (is_head != 0u) {
        scratch[S_DEST_OFFSET + g] = idx;
        let sk = S_MOVED_NEW_KEY + my_slot * EXACT_KEY_WORDS;
        let dk = S_DEST_KEY + g * EXACT_KEY_WORDS;
        for (var w = 0u; w < EXACT_KEY_WORDS; w = w + 1u) {
          scratch[dk + w] = scratch[sk + w];
        }
      }
    }
    workgroupBarrier();
    if (tid == 255u) {
      wg_running_a = inc;
    }
    workgroupBarrier();
  }

  let G = workgroupUniformLoad(&wg_running_a);
  if (tid == 0u) {
    scratch[S_DEST_GROUP_COUNT] = G;
    scratch[S_DEST_OFFSET + G] = M;
    wg_running_a = 0u;
    wg_running_b = 0u;
  }
  workgroupBarrier();

  // Step B: binary search each unique destination cell in prev_cell_keys & prefix-sum brand-new cells.
  let prev_cell_count = prev_directory[18u];
  for (var base = 0u; base < G; base = base + 256u) {
    let g = base + tid;
    var is_new = 0u;
    var new_mem = 0u;
    if (g < G) {
      let found_old = find_prev_cell_exact(g, prev_cell_count);
      scratch[S_DEST_EXISTING_OLD + g] = found_old;
      if (found_old != 0xffffffffu) {
        scratch[S_OLD_INCOMING_GROUP + found_old] = g + 1u;
      } else {
        is_new = 1u;
        new_mem = scratch[S_DEST_OFFSET + g + 1u] - scratch[S_DEST_OFFSET + g];
      }
    }
    wg_scan_a[tid] = is_new;
    wg_scan_b[tid] = new_mem;
    workgroupBarrier();
    for (var d = 1u; d < 256u; d = d << 1u) {
      let add_a = select(0u, wg_scan_a[tid - d], tid >= d);
      let add_b = select(0u, wg_scan_b[tid - d], tid >= d);
      workgroupBarrier();
      wg_scan_a[tid] = wg_scan_a[tid] + add_a;
      wg_scan_b[tid] = wg_scan_b[tid] + add_b;
      workgroupBarrier();
    }
    let exc_new = wg_running_a + wg_scan_a[tid] - is_new;
    let exc_mem = wg_running_b + wg_scan_b[tid] - new_mem;
    if (g < G && is_new != 0u) {
      scratch[S_NEW_ONLY_GROUPS + exc_new] = g;
      scratch[S_BRAND_NEW_PREFIX + exc_new] = exc_mem;
    }
    workgroupBarrier();
    if (tid == 255u) {
      wg_running_a = wg_running_a + wg_scan_a[255u];
      wg_running_b = wg_running_b + wg_scan_b[255u];
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let B = wg_running_a;
    scratch[S_BRAND_NEW_COUNT] = B;
    scratch[S_BRAND_NEW_PREFIX + B] = wg_running_b;
    atomicStore(&atomics_buf[4], B);
  }
}

fn eval_old_cell(c: u32, prev_count: u32) -> vec2<u32> {
  if (c >= prev_count) { return vec2<u32>(0u, 0u); }
  let old_cnt = prev_directory[params.prev_cell_offsets_offset_words + c + 1u]
    - prev_directory[params.prev_cell_offsets_offset_words + c];
  let out_cnt = atomicLoad(&atomics_buf[OUTGOING_BASE + c]);
  if (out_cnt > old_cnt) {
    atomicOr(&atomics_buf[1], FLAG_INVALID_SOURCE);
    return vec2<u32>(0u, 0u);
  }
  let in_grp1 = scratch[S_OLD_INCOMING_GROUP + c];
  var in_cnt = 0u;
  if (in_grp1 != 0u) {
    let g = in_grp1 - 1u;
    in_cnt = scratch[S_DEST_OFFSET + g + 1u] - scratch[S_DEST_OFFSET + g];
  }
  let new_cnt = old_cnt - out_cnt + in_cnt;
  return vec2<u32>(select(0u, 1u, new_cnt > 0u), new_cnt);
}

var<workgroup> wg_tile_surv: array<u32, 512>;
var<workgroup> wg_tile_mem: array<u32, 512>;

@compute @workgroup_size(256)
fn scan_old_cells_local(
  @builtin(workgroup_id) wid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  if (lid.x == 0u) {
    wg_u_aborted = atomicLoad(&atomics_buf[1]);
  }
  let aborted = workgroupUniformLoad(&wg_u_aborted);
  let prev_count = prev_directory[18u];
  let base = wid.x * 512u;
  if (aborted != 0u || base >= prev_count) { return; }
  let tid = lid.x;
  let c0 = base + 2u * tid;
  let c1 = c0 + 1u;
  let v0 = eval_old_cell(c0, prev_count);
  let v1 = eval_old_cell(c1, prev_count);
  wg_tile_surv[2u * tid] = v0.x;
  wg_tile_mem[2u * tid] = v0.y;
  wg_tile_surv[2u * tid + 1u] = v1.x;
  wg_tile_mem[2u * tid + 1u] = v1.y;

  var offset = 1u;
  for (var d = 256u; d > 0u; d = d >> 1u) {
    workgroupBarrier();
    if (tid < d) {
      let ai = offset * (2u * tid + 1u) - 1u;
      let bi = offset * (2u * tid + 2u) - 1u;
      wg_tile_surv[bi] = wg_tile_surv[bi] + wg_tile_surv[ai];
      wg_tile_mem[bi] = wg_tile_mem[bi] + wg_tile_mem[ai];
    }
    offset = offset << 1u;
  }
  if (tid == 0u) {
    scratch[S_BLOCK_SURV + wid.x] = wg_tile_surv[511u];
    scratch[S_BLOCK_MEM + wid.x] = wg_tile_mem[511u];
    wg_tile_surv[511u] = 0u;
    wg_tile_mem[511u] = 0u;
  }
  for (var d = 1u; d < 512u; d = d << 1u) {
    offset = offset >> 1u;
    workgroupBarrier();
    if (tid < d) {
      let ai = offset * (2u * tid + 1u) - 1u;
      let bi = offset * (2u * tid + 2u) - 1u;
      let ts = wg_tile_surv[ai];
      let tm = wg_tile_mem[ai];
      wg_tile_surv[ai] = wg_tile_surv[bi];
      wg_tile_mem[ai] = wg_tile_mem[bi];
      wg_tile_surv[bi] = wg_tile_surv[bi] + ts;
      wg_tile_mem[bi] = wg_tile_mem[bi] + tm;
    }
  }
  workgroupBarrier();
  if (c0 < prev_count) {
    scratch[S_SURV_RANK_OLD + c0] = wg_tile_surv[2u * tid];
    scratch[S_MEMBER_PREFIX_OLD + c0] = wg_tile_mem[2u * tid];
  }
  if (c1 < prev_count) {
    scratch[S_SURV_RANK_OLD + c1] = wg_tile_surv[2u * tid + 1u];
    scratch[S_MEMBER_PREFIX_OLD + c1] = wg_tile_mem[2u * tid + 1u];
  }
}

@compute @workgroup_size(256)
fn scan_old_cells_top(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  if (tid == 0u) {
    wg_u_aborted = atomicLoad(&atomics_buf[1]);
    wg_running_a = 0u;
    wg_running_b = 0u;
  }
  let aborted = workgroupUniformLoad(&wg_u_aborted);
  if (aborted != 0u) { return; }
  let prev_count = prev_directory[18u];
  let num_blocks = (prev_count + 511u) / 512u;
  for (var base = 0u; base < num_blocks; base = base + 256u) {
    let b = base + tid;
    let s = select(0u, scratch[S_BLOCK_SURV + b], b < num_blocks);
    let m = select(0u, scratch[S_BLOCK_MEM + b], b < num_blocks);
    wg_scan_a[tid] = s;
    wg_scan_b[tid] = m;
    workgroupBarrier();
    for (var d = 1u; d < 256u; d = d << 1u) {
      let add_a = select(0u, wg_scan_a[tid - d], tid >= d);
      let add_b = select(0u, wg_scan_b[tid - d], tid >= d);
      workgroupBarrier();
      wg_scan_a[tid] = wg_scan_a[tid] + add_a;
      wg_scan_b[tid] = wg_scan_b[tid] + add_b;
      workgroupBarrier();
    }
    if (b < num_blocks) {
      scratch[S_BLOCK_SURV + b] = wg_running_a + wg_scan_a[tid] - s;
      scratch[S_BLOCK_MEM + b] = wg_running_b + wg_scan_b[tid] - m;
    }
    workgroupBarrier();
    if (tid == 255u) {
      wg_running_a = wg_running_a + wg_scan_a[255u];
      wg_running_b = wg_running_b + wg_scan_b[255u];
    }
    workgroupBarrier();
  }
  if (tid == 0u) {
    scratch[S_SURV_RANK_OLD + prev_count] = wg_running_a;
    scratch[S_MEMBER_PREFIX_OLD + prev_count] = wg_running_b;
    let total_cells = wg_running_a + scratch[S_BRAND_NEW_COUNT];
    atomicStore(&atomics_buf[6], total_cells);
    if (total_cells > params.cell_capacity) {
      atomicAdd(&atomics_buf[13], total_cells - params.cell_capacity);
      atomicOr(&atomics_buf[1], FLAG_CAPACITY_OVERFLOW);
    }
  }
}

@compute @workgroup_size(256)
fn scan_old_cells_add(
  @builtin(workgroup_id) wid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let prev_count = prev_directory[18u];
  let base = wid.x * 512u;
  if (repair_aborted() || base >= prev_count) { return; }
  let bs = scratch[S_BLOCK_SURV + wid.x];
  let bm = scratch[S_BLOCK_MEM + wid.x];
  if (bs == 0u && bm == 0u) { return; }
  let c0 = base + 2u * lid.x;
  let c1 = c0 + 1u;
  if (c0 < prev_count) {
    scratch[S_SURV_RANK_OLD + c0] = scratch[S_SURV_RANK_OLD + c0] + bs;
    scratch[S_MEMBER_PREFIX_OLD + c0] = scratch[S_MEMBER_PREFIX_OLD + c0] + bm;
  }
  if (c1 < prev_count) {
    scratch[S_SURV_RANK_OLD + c1] = scratch[S_SURV_RANK_OLD + c1] + bs;
    scratch[S_MEMBER_PREFIX_OLD + c1] = scratch[S_MEMBER_PREFIX_OLD + c1] + bm;
  }
}

fn count_brand_new_before_prev(prev_c: u32, B: u32) -> u32 {
  var lo = 0u;
  var hi = B;
  while (lo < hi) {
    let mid = (lo + hi) >> 1u;
    let g = scratch[S_NEW_ONLY_GROUPS + mid];
    if (compare_dest_vs_prev_cell(g, prev_c) < 0) {
      lo = mid + 1u;
    } else {
      hi = mid;
    }
  }
  return lo;
}

fn count_prev_before_brand_new(dest_g: u32, prev_count: u32) -> u32 {
  var lo = 0u;
  var hi = prev_count;
  while (lo < hi) {
    let mid = (lo + hi) >> 1u;
    if (compare_dest_vs_prev_cell(dest_g, mid) > 0) {
      lo = mid + 1u;
    } else {
      hi = mid;
    }
  }
  return lo;
}

@compute @workgroup_size(256)
fn emit_surviving_old_cells(@builtin(global_invocation_id) gid: vec3<u32>) {
  let prev_count = prev_directory[18u];
  let c = gid.x;
  if (repair_aborted() || c >= prev_count) { return; }
  let old_cnt = prev_directory[params.prev_cell_offsets_offset_words + c + 1u]
    - prev_directory[params.prev_cell_offsets_offset_words + c];
  let out_cnt = atomicLoad(&atomics_buf[OUTGOING_BASE + c]);
  let in_grp1 = scratch[S_OLD_INCOMING_GROUP + c];
  let in_cnt = select(
    0u,
    scratch[S_DEST_OFFSET + in_grp1] - scratch[S_DEST_OFFSET + in_grp1 - 1u],
    in_grp1 != 0u
  );
  let new_cnt = old_cnt - out_cnt + in_cnt;
  if (new_cnt == 0u) {
    scratch[S_OLD_TO_NEW_CELL + c] = 0xffffffffu;
    atomicAdd(&atomics_buf[5], 1u);
    return;
  }
  let B = scratch[S_BRAND_NEW_COUNT];
  let b_before = select(0u, count_brand_new_before_prev(c, B), B > 0u);
  let final_c = scratch[S_SURV_RANK_OLD + c] + b_before;
  let final_off = scratch[S_MEMBER_PREFIX_OLD + c] + scratch[S_BRAND_NEW_PREFIX + b_before];
  scratch[S_OLD_TO_NEW_CELL + c] = final_c;
  if (in_grp1 != 0u) {
    scratch[S_DEST_FINAL_CELL + (in_grp1 - 1u)] = final_c;
  }
  if (final_c < params.cell_capacity) {
    let src_k = params.prev_cell_keys_offset_words + c * EXACT_KEY_WORDS;
    let dst_k = params.cell_keys_offset_words + final_c * EXACT_KEY_WORDS;
    for (var w = 0u; w < EXACT_KEY_WORDS; w = w + 1u) {
      directory[dst_k + w] = prev_directory[src_k + w];
    }
    directory[params.cell_offsets_offset_words + final_c] = final_off;
  }
  if (out_cnt > 0u || in_grp1 != 0u) {
    let d_slot = atomicAdd(&atomics_buf[3], 1u);
    if (d_slot < S_DIRTY_CAPACITY) {
      scratch[S_DIRTY_OLD_CELLS + d_slot] = c;
    } else {
      atomicOr(&atomics_buf[1], FLAG_MOVED_BUDGET_EXCEEDED);
    }
  }
}

@compute @workgroup_size(256)
fn emit_brand_new_cells(@builtin(global_invocation_id) gid: vec3<u32>) {
  let B = scratch[S_BRAND_NEW_COUNT];
  let b = gid.x;
  if (repair_aborted() || b >= B) { return; }
  let prev_count = prev_directory[18u];
  let g = scratch[S_NEW_ONLY_GROUPS + b];
  let c_before = count_prev_before_brand_new(g, prev_count);
  let final_c = scratch[S_SURV_RANK_OLD + c_before] + b;
  let final_off = scratch[S_MEMBER_PREFIX_OLD + c_before] + scratch[S_BRAND_NEW_PREFIX + b];
  scratch[S_DEST_FINAL_CELL + g] = final_c;
  if (final_c < params.cell_capacity) {
    let src_k = S_DEST_KEY + g * EXACT_KEY_WORDS;
    let dst_k = params.cell_keys_offset_words + final_c * EXACT_KEY_WORDS;
    for (var w = 0u; w < EXACT_KEY_WORDS; w = w + 1u) {
      directory[dst_k + w] = scratch[src_k + w];
    }
    directory[params.cell_offsets_offset_words + final_c] = final_off;
  }
}

@compute @workgroup_size(256)
fn copy_clean_old_members(@builtin(global_invocation_id) gid: vec3<u32>) {
  let p = gid.x;
  let prev_count = prev_active_count();
  if (repair_aborted() || p >= prev_count) { return; }
  let is_v2 = params.directory_abi_version == 2u;
  let member = prev_directory[params.prev_cell_members_offset_words + p];
  let prev_raw = prev_directory[params.prev_particle_to_cell_offset_words + member];
  let old_c = select(prev_raw, prev_raw - 1u, is_v2);
  if (
    atomicLoad(&atomics_buf[OUTGOING_BASE + old_c]) != 0u
    || scratch[S_OLD_INCOMING_GROUP + old_c] != 0u
  ) {
    return;
  }
  let final_c = scratch[S_OLD_TO_NEW_CELL + old_c];
  let local_idx = p - prev_directory[params.prev_cell_offsets_offset_words + old_c];
  let dst_pos = directory[params.cell_offsets_offset_words + final_c] + local_idx;
  directory[params.cell_members_offset_words + dst_pos] = member;
  directory[params.particle_to_cell_offset_words + member] = select(final_c, final_c + 1u, is_v2);
}

@compute @workgroup_size(256)
fn copy_brand_new_cell_members(@builtin(global_invocation_id) gid: vec3<u32>) {
  let k = gid.x;
  let M = atomicLoad(&atomics_buf[2]);
  if (repair_aborted() || k >= M) { return; }
  let is_v2 = params.directory_abi_version == 2u;
  let g = scratch[S_SORTED_MOVED_GROUP + k];
  if (scratch[S_DEST_EXISTING_OLD + g] != 0xffffffffu) { return; }
  let final_c = scratch[S_DEST_FINAL_CELL + g];
  let local_idx = k - scratch[S_DEST_OFFSET + g];
  let slot = scratch[S_SORT_A + k];
  let member = scratch[S_MOVED_SOURCE + slot];
  let dst_pos = directory[params.cell_offsets_offset_words + final_c] + local_idx;
  directory[params.cell_members_offset_words + dst_pos] = member;
  directory[params.particle_to_cell_offset_words + member] = select(final_c, final_c + 1u, is_v2);
}

@compute @workgroup_size(64)
fn merge_dirty_cell_members(@builtin(global_invocation_id) gid: vec3<u32>) {
  let d = gid.x;
  let D = atomicLoad(&atomics_buf[3]);
  if (repair_aborted() || d >= D) { return; }
  let is_v2 = params.directory_abi_version == 2u;
  let old_c = scratch[S_DIRTY_OLD_CELLS + d];
  let final_c = scratch[S_OLD_TO_NEW_CELL + old_c];
  let rev_val = select(final_c, final_c + 1u, is_v2);
  var out_pos = directory[params.cell_offsets_offset_words + final_c];
  var p = prev_directory[params.prev_cell_offsets_offset_words + old_c];
  let p_end = prev_directory[params.prev_cell_offsets_offset_words + old_c + 1u];
  let in_grp1 = scratch[S_OLD_INCOMING_GROUP + old_c];
  var q = select(0u, scratch[S_DEST_OFFSET + in_grp1 - 1u], in_grp1 != 0u);
  let q_end = select(0u, scratch[S_DEST_OFFSET + in_grp1], in_grp1 != 0u);

  loop {
    if (p >= p_end) { break; }
    let pm = prev_directory[params.prev_cell_members_offset_words + p];
    if (scratch[S_MOVED_FLAG + pm] == 0u) { break; }
    p = p + 1u;
  }

  loop {
    if (p >= p_end && q >= q_end) { break; }
    let old_m = select(0xffffffffu, prev_directory[params.prev_cell_members_offset_words + p], p < p_end);
    var in_m = 0xffffffffu;
    if (q < q_end) {
      in_m = scratch[S_MOVED_SOURCE + scratch[S_SORT_A + q]];
    }
    if (old_m < in_m) {
      directory[params.cell_members_offset_words + out_pos] = old_m;
      directory[params.particle_to_cell_offset_words + old_m] = rev_val;
      out_pos = out_pos + 1u;
      p = p + 1u;
      loop {
        if (p >= p_end) { break; }
        let pm = prev_directory[params.prev_cell_members_offset_words + p];
        if (scratch[S_MOVED_FLAG + pm] == 0u) { break; }
        p = p + 1u;
      }
    } else {
      directory[params.cell_members_offset_words + out_pos] = in_m;
      directory[params.particle_to_cell_offset_words + in_m] = rev_val;
      out_pos = out_pos + 1u;
      q = q + 1u;
    }
  }
}

@compute @workgroup_size(1)
fn finalize_migrated_directory() {
  let is_v2 = params.directory_abi_version == 2u;
  let counts_ready = count_contract_ready();
  let flags = atomicLoad(&atomics_buf[1]);
  let moved_count = atomicLoad(&atomics_buf[2]);
  let invalid_source_count = atomicLoad(&atomics_buf[12]);
  let cell_overflow = atomicLoad(&atomics_buf[13]);
  let live_count = live_source_count();
  let prev_count = prev_directory[18u];
  let logical_unique_count = select(
    0u,
    scratch[S_SURV_RANK_OLD + prev_count] + scratch[S_BRAND_NEW_COUNT],
    flags == 0u && counts_ready
  );
  let directory_capacity_ready = params.directory_capacity_words >= params.required_capacity_words;
  let overflow_free = cell_overflow == 0u
    && logical_unique_count <= params.cell_capacity
    && logical_unique_count <= live_count
    && directory_capacity_ready
    && (flags & FLAG_CAPACITY_OVERFLOW) == 0u;
  let overflow_count = cell_overflow + select(0u, 1u, !directory_capacity_ready);

  let has_query_evidence = params.query_geometry_mode == QUERY_GEOMETRY_SINGLE_CHART_POW2;
  let query_level_count = select(
    0u,
    signed_order_key(params.query_max_level) - signed_order_key(params.query_min_level) + 1u,
    has_query_evidence
  );
  let occupied_level_mask_low = atomicLoad(&atomics_buf[14]);
  let occupied_level_mask_high = atomicLoad(&atomics_buf[15]);
  let allowed_low = low_bits_mask(min(query_level_count, 32u));
  let allowed_high = low_bits_mask(select(0u, query_level_count - 32u, query_level_count > 32u));
  let mask_ready = !has_query_evidence || (
    (live_count == 0u || (occupied_level_mask_low | occupied_level_mask_high) != 0u)
    && (occupied_level_mask_low & ~allowed_low) == 0u
    && (occupied_level_mask_high & ~allowed_high) == 0u
  );

  let admitted = flags == 0u
    && counts_ready
    && invalid_source_count == 0u
    && overflow_free
    && exact_near_query_profile_ready()
    && mask_ready;

  var status = STATUS_READY;
  if (admitted) {
    status = status | STATUS_ADMITTED;
  } else {
    status = status | STATUS_FAIL_CLOSED;
  }
  if (invalid_source_count != 0u) {
    status = status | STATUS_INVALID_SOURCE;
  }
  if (!overflow_free) {
    status = status | STATUS_CAPACITY_OVERFLOW;
  }

  let admitted_cell_count = select(0u, logical_unique_count, admitted);
  if (admitted && admitted_cell_count <= params.cell_capacity) {
    directory[params.cell_offsets_offset_words + admitted_cell_count] = live_count;
  }

  let dispatch_group_count = (admitted_cell_count + 63u) / 64u;
  let dispatch_x_limit = max(params.consumer_dispatch_x_limit, 1u);
  let has_consumer_work = admitted && admitted_cell_count > 0u;
  let dispatch_x = select(0u, min(dispatch_group_count, dispatch_x_limit), has_consumer_work);
  let dispatch_y = select(0u, (dispatch_group_count + dispatch_x_limit - 1u) / dispatch_x_limit, has_consumer_work);
  consumer_dispatch[0] = dispatch_x;
  consumer_dispatch[1] = dispatch_y;
  consumer_dispatch[2] = select(0u, 1u, has_consumer_work);

  let query_evidence_offset_words = params.particle_to_cell_offset_words
    + select(params.physical_radix_count, params.source_capacity, is_v2);
  if (has_query_evidence) {
    directory[query_evidence_offset_words + 0u] = params.query_chart_id;
    directory[query_evidence_offset_words + 1u] = bitcast<u32>(params.query_min_level);
    directory[query_evidence_offset_words + 2u] = bitcast<u32>(params.query_max_level);
    directory[query_evidence_offset_words + 3u] = bitcast<u32>(params.query_base_grid_spacing_m);
    directory[query_evidence_offset_words + 4u] = occupied_level_mask_low;
    directory[query_evidence_offset_words + 5u] = occupied_level_mask_high;
  }

  let live_required_words = params.header_words
    + logical_unique_count * EXACT_KEY_WORDS
    + logical_unique_count + 1u
    + select(live_count * 2u, live_count + params.source_count, is_v2)
    + select(0u, QUERY_EVIDENCE_WORDS, has_query_evidence);
  let reverse_high_water_words = select(
    select(params.header_words, params.particle_to_cell_offset_words + live_count, live_count > 0u),
    select(params.header_words, params.particle_to_cell_offset_words + params.source_count, params.source_count > 0u),
    is_v2
  );
  let live_physical_high_water_words = max(
    max(
      select(params.header_words, params.cell_keys_offset_words + logical_unique_count * EXACT_KEY_WORDS, logical_unique_count > 0u),
      params.cell_offsets_offset_words + logical_unique_count + 1u
    ),
    max(
      select(params.header_words, params.cell_members_offset_words + live_count, live_count > 0u),
      max(
        reverse_high_water_words,
        select(params.header_words, query_evidence_offset_words + QUERY_EVIDENCE_WORDS, has_query_evidence)
      )
    )
  );

  directory[0] = MAGIC;
  directory[1] = params.directory_abi_version;
  directory[2] = status;
  directory[3] = params.generation_id;
  directory[4] = params.device_ordinal;
  directory[5] = params.lane_ordinal;
  directory[6] = params.lease_token;
  directory[7] = params.source_family_id;
  directory[8] = params.storage_generation;
  directory[9] = params.physics_tick;
  directory[10] = params.physics_substep;
  directory[11] = params.position_epoch;
  directory[12] = params.topology_epoch;
  directory[13] = params.chart_epoch;
  directory[14] = params.level_epoch;
  directory[15] = params.support_epoch;
  directory[16] = select(live_count, params.source_count, is_v2);
  directory[17] = params.source_capacity;
  directory[18] = admitted_cell_count;
  directory[19] = params.cell_capacity;
  directory[20] = live_required_words;
  directory[21] = select(0u, live_required_words, admitted);
  directory[22] = params.directory_capacity_words;
  directory[23] = invalid_source_count;
  directory[24] = overflow_count;
  directory[25] = EXACT_KEY_WORDS;
  directory[26] = params.sort_key_word_count;
  directory[27] = params.sort_mode;
  directory[28] = params.header_words;
  directory[29] = params.cell_keys_offset_words;
  directory[30] = params.cell_offsets_offset_words;
  directory[31] = params.cell_members_offset_words;
  directory[32] = params.particle_to_cell_offset_words;
  directory[33] = params.build_ordinal;
  directory[34] = params.sort_unique_ordinal;
  directory[35] = select(0u, params.build_ordinal, admitted);
  directory[36] = params.generation_id;
  directory[37] = live_count;
  directory[38] = admitted_cell_count;
  directory[39] = select(0u, 1u, admitted);
  directory[40] = select(1u, 0u, overflow_free);
  directory[41] = select(4u, select(1u, 3u, is_v2), admitted);
  directory[42] = consumer_dispatch[0];
  directory[43] = consumer_dispatch[1];
  directory[44] = consumer_dispatch[2];
  directory[45] = params.header_words + 4u + 3u + 8u + 3u + 1u;
  directory[46] = select(SOURCE_ADAPTER_ACTIVE_NODE_ROWS, SOURCE_ADAPTER_EXACT_NEAR_QUERY, has_query_evidence);
  directory[47] = select(params.directory_capacity_words, live_physical_high_water_words, admitted);

  let zero_churn = moved_count == 0u && live_count == prev_active_count();
  atomicStore(&atomics_buf[0], select(MODE_ADJACENT_CELL_REPAIR, MODE_ZERO_CHURN_REBASE, zero_churn));
  atomicStore(&atomics_buf[6], admitted_cell_count);
  atomicStore(&atomics_buf[9], params.generation_id);
  atomicStore(&atomics_buf[10], params.prev_generation_id);
  atomicStore(&atomics_buf[11], select(0u, 1u, admitted));
}
`;
}

function packMigrationParams(plan, {
  hasPrevSource,
  maxMovedMembers,
  maxCellJump,
  maxDisplacementSpacingMultiple,
  prevExecution,
  consumerDispatchXLimit,
  logicalSourceCountGpuAuthored = false,
  directoryAbiVersion = 1,
  allowMembershipDelta = false,
  enforceCellJumpLimit = true
}) {
  const buf = new ArrayBuffer(PARAMS_BYTES);
  const view = new DataView(buf);
  let offset = 0;
  const u32 = (v) => { view.setUint32(offset, v >>> 0, true); offset += 4; };
  const i32 = (v) => { view.setInt32(offset, v | 0, true); offset += 4; };
  const f32 = (v) => { view.setFloat32(offset, v, true); offset += 4; };

  const atlas = plan.atlas || {
    chartMin: 0,
    chartCount: 0,
    levelMin: 0,
    levelCount: 0,
    cellMin: [0, 0, 0],
    cellCount: [0, 0, 0]
  };
  u32(plan.sourceCount);
  u32(plan.sourceCapacity);
  u32(plan.cellCapacity);
  u32(plan.sortKeyWordCount);
  u32(plan.sortMode);
  u32(plan.generationId);
  u32(plan.deviceOrdinal);
  u32(plan.laneOrdinal);
  u32(plan.sourceFamilyId);
  u32(plan.storageGeneration);
  u32(plan.physicsTick);
  u32(plan.physicsSubstep);
  u32(plan.positionEpoch);
  u32(plan.topologyEpoch);
  u32(plan.chartEpoch);
  u32(plan.levelEpoch);
  u32(plan.supportEpoch);
  u32(plan.leaseToken);
  u32(plan.buildOrdinal);
  u32(plan.sortUniqueOrdinal);
  u32(atlas.chartMin);
  u32(atlas.chartCount);
  i32(atlas.levelMin);
  u32(atlas.levelCount);
  i32(atlas.cellMin[0]);
  u32(atlas.cellCount[0]);
  i32(atlas.cellMin[1]);
  u32(atlas.cellCount[1]);
  i32(atlas.cellMin[2]);
  u32(atlas.cellCount[2]);
  u32(plan.layout.headerWords);
  u32(plan.layout.cellKeysOffsetWords);
  u32(plan.layout.cellOffsetsOffsetWords);
  u32(plan.layout.cellMembersOffsetWords);
  u32(plan.layout.particleToCellOffsetWords);
  u32(plan.layout.wordLength);
  u32(plan.requiredDirectoryCapacityWords);
  u32(consumerDispatchXLimit);
  u32(consumerDispatchXLimit);
  u32(consumerDispatchXLimit);
  u32(plan.queryGeometryMode);
  u32(plan.queryChartId);
  i32(plan.queryMinLevel);
  i32(plan.queryMaxLevel);
  f32(plan.queryBaseGridSpacingM);
  u32(plan.sourceRowLayoutId);
  u32(logicalSourceCountGpuAuthored ? 1 : 0);
  u32(
    logicalSourceCountGpuAuthored && Number.isSafeInteger(plan.activeSourceCapacity)
      ? plan.activeSourceCapacity
      : plan.sourceCount
  );
  if (offset !== SCHROEDER_SPATIAL_EPOCH_PARAMS_BYTES) {
    throw new Error(`expected ${SCHROEDER_SPATIAL_EPOCH_PARAMS_BYTES} base bytes, got ${offset}`);
  }

  u32(hasPrevSource ? 1 : 0);
  u32(maxMovedMembers);
  u32(maxCellJump);
  f32(maxDisplacementSpacingMultiple);
  u32(prevExecution?.generationId ?? 0);
  u32(prevExecution?.layout?.cellKeysOffsetWords ?? plan.layout.cellKeysOffsetWords);
  u32(prevExecution?.layout?.cellOffsetsOffsetWords ?? plan.layout.cellOffsetsOffsetWords);
  u32(prevExecution?.layout?.cellMembersOffsetWords ?? plan.layout.cellMembersOffsetWords);
  u32(prevExecution?.layout?.particleToCellOffsetWords ?? plan.layout.particleToCellOffsetWords);
  u32(Math.ceil(plan.cellCapacity / SCAN_TILE_CELLS));
  u32(directoryAbiVersion === 2 ? 2 : 1);
  u32(allowMembershipDelta ? 1 : 0);
  u32(enforceCellJumpLimit ? 1 : 0);
  while (offset < PARAMS_BYTES) u32(0);
  return new Uint8Array(buf);
}

export function parseSchroederIncrementalSpatialCertificate(words) {
  const u = words instanceof Uint32Array ? words : new Uint32Array(words);
  const f = new Float32Array(u.buffer, u.byteOffset, Math.min(u.length, SCHROEDER_INCREMENTAL_CERTIFICATE_WORDS));
  return Object.freeze({
    schema: ULG_SCHROEDER_INCREMENTAL_SPATIAL_CERTIFICATE_SCHEMA,
    mode: u[0],
    modeName: u[0] === 1
      ? 'zero-churn-rebase'
      : u[0] === 2
        ? 'adjacent-cell-repair'
        : u[0] === 3
          ? 'full-radix-fallback'
          : 'uninitialized',
    fallbackFlags: u[1],
    movedMemberCount: u[2],
    dirtyOldCellCount: u[3],
    insertedCellCount: u[4],
    droppedCellCount: u[5],
    admittedCellCount: u[6],
    maxDisplacementRatio: f[7],
    maxCellJumpLinf: u[8],
    generationId: u[9],
    predecessorGenerationId: u[10],
    admitted: u[11] === 1,
    invalidSourceCount: u[12],
    overflowCount: u[13]
  });
}

const ENTRY_POINTS = Object.freeze([
  'detect_departed_members',
  'detect_moved_members',
  'sort_moved_chunks',
  'merge_w1024',
  'merge_w2048',
  'merge_w4096',
  'merge_w8192',
  'classify_moved_groups',
  'scan_old_cells_local',
  'scan_old_cells_top',
  'scan_old_cells_add',
  'emit_surviving_old_cells',
  'emit_brand_new_cells',
  'copy_clean_old_members',
  'copy_brand_new_cell_members',
  'merge_dirty_cell_members',
  'finalize_migrated_directory'
]);

/**
 * A2 Incremental Spatial Membership Migration (`ulg-a2-incremental-spatial`):
 *
 * Maintains exact `SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI` v1 CSR directories across
 * steps in a single GPU compute pass using moved-member flags, conservative
 * displacement & single-cell-jump certificates, surgical sorted-CSR repair, and
 * immutable generation arenas, with automatic fail-closed fallback to the trusted
 * full GPU radix rebuild (`createSchroederSpatialEpochGpu`) on bootstrap, capacity/
 * epoch changes, or adversarial motion.
 */
export function createSchroederIncrementalSpatialMigrationGpu(device, {
  maxSourceCount,
  cellCapacity = maxSourceCount,
  maxMovedMembers = 16384,
  arenaCount = 3,
  maxCellJump = 1,
  maxDisplacementSpacingMultiple = 1.0,
  label = 'ulg-schroeder-incremental-spatial-migration'
} = {}) {
  if (!device?.createBuffer || !device?.createComputePipeline) {
    throw new TypeError('Incremental spatial migration requires a WebGPU device');
  }
  const resolvedMaxSourceCount = positiveInteger(maxSourceCount, 'maxSourceCount', MAX_EXACT_F32_INTEGER);
  const resolvedCellCapacity = positiveInteger(
    cellCapacity,
    'cellCapacity',
    Math.min(resolvedMaxSourceCount, MAX_SUPPORTED_CELL_CAPACITY)
  );
  const resolvedMaxMovedMembers = normalizeMaxMovedMembers(
    Math.min(maxMovedMembers, Math.max(1024, resolvedMaxSourceCount))
  );
  const resolvedArenaCount = positiveInteger(arenaCount, 'arenaCount', 8);
  if (resolvedArenaCount < 2) {
    throw new RangeError('Incremental spatial migration requires arenaCount >= 2 for immutable generations');
  }
  const resolvedMaxCellJump = nonNegativeInteger(maxCellJump, 'maxCellJump', 1024);
  const resolvedMaxDisp = Number(maxDisplacementSpacingMultiple);
  if (!(Number.isFinite(resolvedMaxDisp) && resolvedMaxDisp > 0)) {
    throw new RangeError('maxDisplacementSpacingMultiple must be a finite positive number');
  }

  const layout = createSchroederSpatialEpochLayout({
    sourceCapacity: resolvedMaxSourceCount,
    cellCapacity: resolvedCellCapacity
  });
  const scratchLayout = createSchroederIncrementalSpatialScratchLayout({
    maxSourceCount: resolvedMaxSourceCount,
    cellCapacity: resolvedCellCapacity,
    maxMovedMembers: resolvedMaxMovedMembers
  });

  const rawDevice = unwrapWebGpuCacheDevice(device);
  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'storage'),
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(8, 'read-only-storage')
  ];
  const wgsl = createSchroederIncrementalSpatialMigrationWgsl(scratchLayout);
  const cachePrefix = `ulg-a2-inc-spatial-${resolvedMaxSourceCount}-${resolvedCellCapacity}-${resolvedMaxMovedMembers}.v2`;
  const pipelines = Object.fromEntries(ENTRY_POINTS.map((entryPoint) => [
    entryPoint,
    createCachedExplicitComputePipeline(rawDevice, {
      cacheKey: `${cachePrefix}:${entryPoint}`,
      label: `${label}-${entryPoint}`,
      code: wgsl,
      entryPoint,
      bindings
    })
  ]));

  const fallbackRuntime = createSchroederSpatialEpochGpu(device, {
    maxSourceCount: resolvedMaxSourceCount,
    cellCapacity: resolvedCellCapacity,
    directoryAbiVersion: SCHROEDER_SPATIAL_EPOCH_VERSION,
    arenaCount: resolvedArenaCount,
    label: `${label}-trusted-radix-fallback`
  });

  const createOwned = (bufLabel, size, usage) => tagWebGpuBufferDevice(
    device.createBuffer({ label: bufLabel, size: Math.max(16, size), usage }),
    device
  );

  const paramsBuffer = createOwned(`${label}-params`, PARAMS_BYTES, GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST);
  const scratchBuffer = createOwned(`${label}-scratch`, scratchLayout.byteLength, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST);
  const certReadbackBuffer = createOwned(
    `${label}-cert-readback`,
    SCHROEDER_INCREMENTAL_CERTIFICATE_WORDS * UINT32_BYTES,
    GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  );

  const arenas = Array.from({ length: resolvedArenaCount }, (_, arenaIndex) => ({
    arenaIndex,
    inUse: false,
    directoryBuffer: createOwned(
      `${label}-arena-${arenaIndex}-directory`,
      layout.byteLength,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    ),
    consumerDispatchBuffer: createOwned(
      `${label}-arena-${arenaIndex}-consumer-dispatch`,
      3 * UINT32_BYTES,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.INDIRECT
    ),
    atomicsBuffer: createOwned(
      `${label}-arena-${arenaIndex}-atomics`,
      scratchLayout.atomicByteLength,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    )
  }));

  const deviceId = webGpuDeviceId(device);
  const defaultDeviceOrdinal = fnv1a32(deviceId);
  const maxWorkgroupsPerDim = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'maxComputeWorkgroupsPerDimension'
  );
  let destroyed = false;

  function acquireIncrementalArena(forbiddenBuffer = null) {
    const arena = arenas.find((a) => !a.inUse && a.directoryBuffer !== forbiddenBuffer) || null;
    if (!arena) {
      const err = new Error(`${label} incremental arena ring exhausted`);
      err.code = 'ERR_SCHROEDER_INCREMENTAL_ARENA_EXHAUSTED';
      throw err;
    }
    arena.inUse = true;
    return arena;
  }

  function staticFallbackReason({
    sourceCount,
    prevExecution,
    forceFullRebuild,
    topologyEpoch,
    chartEpoch,
    levelEpoch,
    supportEpoch,
    sortMode,
    sourceRowLayoutId
  }) {
    if (forceFullRebuild) return SCHROEDER_INCREMENTAL_FALLBACK_FLAG.FORCED_FULL_REBUILD;
    if (!prevExecution || prevExecution.released === true || !prevExecution.directoryBuffer) {
      return SCHROEDER_INCREMENTAL_FALLBACK_FLAG.NO_PREDECESSOR;
    }
    if (sourceCount === 0 || prevExecution.sourceCount !== sourceCount) {
      return SCHROEDER_INCREMENTAL_FALLBACK_FLAG.SOURCE_COUNT_CHANGED;
    }
    if (
      prevExecution.topologyEpoch !== topologyEpoch
      || prevExecution.chartEpoch !== chartEpoch
      || prevExecution.levelEpoch !== levelEpoch
      || prevExecution.supportEpoch !== supportEpoch
      || prevExecution.sortModeName !== sortMode
      || prevExecution.sourceRowLayoutId !== sourceRowLayoutId
    ) {
      return SCHROEDER_INCREMENTAL_FALLBACK_FLAG.EPOCH_CONTRACT_CHANGED;
    }
    return 0;
  }

  function encodeFullFallback(encoder, options, fallbackFlags) {
    const {
      prevExecution: _prevExecution,
      prevSourceBuffer: _prevSourceBuffer,
      forceFullRebuild: _forceFullRebuild,
      maxCellJumpOverride: _maxCellJumpOverride,
      maxDisplacementOverride: _maxDisplacementOverride,
      ...epochOptions
    } = options;
    const fbExec = fallbackRuntime.encode(encoder, epochOptions);
    const certWords = new Uint32Array(SCHROEDER_INCREMENTAL_CERTIFICATE_WORDS);
    certWords[0] = SCHROEDER_INCREMENTAL_MIGRATION_MODE.FULL_RADIX_FALLBACK;
    certWords[1] = fallbackFlags >>> 0;
    certWords[9] = fbExec.generationId >>> 0;
    certWords[10] = (options.prevExecution?.generationId ?? 0) >>> 0;
    certWords[11] = 1;
    return Object.freeze({
      schema: ULG_SCHROEDER_INCREMENTAL_SPATIAL_MIGRATION_SCHEMA,
      epochSchema: ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
      mode: 'full-radix-fallback',
      staticFallbackFlags: fallbackFlags,
      generationId: fbExec.generationId,
      sourceCount: fbExec.sourceCount,
      topologyEpoch: fbExec.topologyEpoch,
      chartEpoch: fbExec.chartEpoch,
      levelEpoch: fbExec.levelEpoch,
      supportEpoch: fbExec.supportEpoch,
      sortModeName: options.sortMode ?? 'bounded-atlas-u32',
      sourceRowLayoutId: fbExec.sourceRowLayoutId,
      layout: fbExec.layout,
      directoryBuffer: fbExec.directoryBuffer,
      consumerDispatchBuffer: fbExec.consumerDispatchBuffer,
      certificateBuffer: null,
      staticCertificate: parseSchroederIncrementalSpatialCertificate(certWords),
      encodedComputePassCount: fbExec.encodedComputePassCount,
      encodedDispatchCount: fbExec.encodedDispatchCount,
      fallbackExecution: fbExec,
      get released() { return fbExec.released; },
      markSubmitted() { return fallbackRuntime.markExecutionSubmitted(fbExec); },
      release({ discardedEncoder = false } = {}) {
        if (discardedEncoder) return fallbackRuntime.releaseExecution(fbExec, { discardedEncoder: true });
        if (fallbackRuntime.canReleaseExecutionQueueOrdered(fbExec)) {
          return fallbackRuntime.releaseExecutionQueueOrdered(fbExec);
        }
        return fallbackRuntime.releaseExecutionAfter(fbExec, device.queue.onSubmittedWorkDone());
      }
    });
  }

  function encode(encoder, options = {}) {
    if (destroyed) throw new Error(`${label} is destroyed`);
    const {
      sourceBuffer,
      prevSourceBuffer = null,
      prevExecution = null,
      sourceCount,
      sourceRowLayoutId = SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_ACTIVE_NODE_V0,
      sortMode = 'bounded-atlas-u32',
      atlas = null,
      generationId = 1,
      deviceOrdinal = defaultDeviceOrdinal,
      laneOrdinal = 0,
      sourceFamily = 'schroeder-active-node-particles',
      sourceFamilyId = null,
      storageGeneration = 0,
      physicsTick = 0,
      physicsSubstep = 0,
      positionEpoch = 0,
      topologyEpoch = 0,
      chartEpoch = 0,
      levelEpoch = 0,
      supportEpoch = 0,
      leaseToken = 0,
      buildOrdinal = 1,
      sortUniqueOrdinal = 1,
      exactNearQueryProfile = null,
      forceFullRebuild = false,
      maxCellJumpOverride = null,
      maxDisplacementOverride = null
    } = options;

    if (!sourceBuffer || !webGpuBufferMatchesDevice(sourceBuffer, device)) {
      throw new TypeError('sourceBuffer must belong to the migration runtime WebGPU device');
    }
    if (prevSourceBuffer && !webGpuBufferMatchesDevice(prevSourceBuffer, device)) {
      throw new TypeError('prevSourceBuffer must belong to the migration runtime WebGPU device');
    }
    const resolvedSourceCount = nonNegativeInteger(sourceCount, 'sourceCount', resolvedMaxSourceCount);
    const fbFlags = staticFallbackReason({
      sourceCount: resolvedSourceCount,
      prevExecution,
      forceFullRebuild,
      topologyEpoch,
      chartEpoch,
      levelEpoch,
      supportEpoch,
      sortMode,
      sourceRowLayoutId
    });
    if (fbFlags !== 0) {
      return encodeFullFallback(encoder, { ...options, sortMode, sourceRowLayoutId }, fbFlags);
    }
    if (prevExecution.directoryBuffer && !webGpuBufferMatchesDevice(prevExecution.directoryBuffer, device)) {
      throw new TypeError('prevExecution.directoryBuffer belongs to a different device');
    }

    const resolvedSourceFamilyId = sourceFamilyId == null ? fnv1a32(sourceFamily) : sourceFamilyId;
    const plan = createSchroederSpatialEpochBuildPlan({
      sourceCount: resolvedSourceCount,
      sourceCapacity: resolvedMaxSourceCount,
      sourceRowLayoutId,
      cellCapacity: resolvedCellCapacity,
      sortMode,
      atlas,
      generationId,
      deviceOrdinal,
      laneOrdinal,
      sourceFamilyId: resolvedSourceFamilyId,
      storageGeneration,
      physicsTick,
      physicsSubstep,
      positionEpoch,
      topologyEpoch,
      chartEpoch,
      levelEpoch,
      supportEpoch,
      leaseToken,
      buildOrdinal,
      sortUniqueOrdinal,
      exactNearQueryProfile
    });

    // Acquire a distinct immutable arena so prevExecution.directoryBuffer is NEVER mutated in place.
    const arena = acquireIncrementalArena(prevExecution.directoryBuffer);
    let submitted = false;
    let released = false;
    try {
      const packedParams = packMigrationParams(plan, {
        hasPrevSource: Boolean(prevSourceBuffer),
        maxMovedMembers: resolvedMaxMovedMembers,
        maxCellJump: maxCellJumpOverride == null ? resolvedMaxCellJump : nonNegativeInteger(maxCellJumpOverride, 'maxCellJumpOverride', 1024),
        maxDisplacementSpacingMultiple: maxDisplacementOverride == null ? resolvedMaxDisp : Number(maxDisplacementOverride),
        prevExecution,
        consumerDispatchXLimit: maxWorkgroupsPerDim
      });
      device.queue.writeBuffer(paramsBuffer, 0, packedParams);

      encoder.clearBuffer(arena.atomicsBuffer);
      encoder.clearBuffer(
        scratchBuffer,
        scratchLayout.oldIncomingGroupOffset * UINT32_BYTES,
        scratchLayout.oldIncomingGroupWords * UINT32_BYTES
      );
      encoder.clearBuffer(arena.directoryBuffer, 0, SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS * UINT32_BYTES);
      encoder.clearBuffer(arena.consumerDispatchBuffer);

      const sourceBindBytes = Math.min(
        Number(sourceBuffer.size) || resolvedMaxSourceCount * ACTIVE_NODE_STRIDE_FLOATS * 4,
        resolvedMaxSourceCount * ACTIVE_NODE_STRIDE_FLOATS * 4
      );
      const prevSourceBindBuffer = prevSourceBuffer || sourceBuffer;
      const prevSourceBindBytes = Math.min(
        Number(prevSourceBindBuffer.size) || sourceBindBytes,
        resolvedMaxSourceCount * ACTIVE_NODE_STRIDE_FLOATS * 4
      );
      const bindGroup = device.createBindGroup({
        label: `${label}-bind-group`,
        layout: pipelines.detect_moved_members.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: paramsBuffer, offset: 0, size: PARAMS_BYTES } },
          { binding: 1, resource: { buffer: sourceBuffer, offset: 0, size: sourceBindBytes } },
          { binding: 2, resource: { buffer: prevSourceBindBuffer, offset: 0, size: prevSourceBindBytes } },
          { binding: 3, resource: { buffer: prevExecution.directoryBuffer } },
          { binding: 4, resource: { buffer: arena.directoryBuffer } },
          { binding: 5, resource: { buffer: arena.consumerDispatchBuffer } },
          { binding: 6, resource: { buffer: arena.atomicsBuffer } },
          { binding: 7, resource: { buffer: scratchBuffer } },
          { binding: 8, resource: { buffer: prevExecution.directoryBuffer } }
        ]
      });

      const nGroups = Math.ceil(resolvedSourceCount / 256);
      const movedGroups = Math.ceil(resolvedMaxMovedMembers / 256);
      const chunkGroups = Math.ceil(resolvedMaxMovedMembers / CHUNK_SORT_SIZE);
      const scanGroups = Math.ceil(resolvedCellCapacity / SCAN_TILE_CELLS);
      const cellGroups = Math.ceil(resolvedCellCapacity / 256);
      const dirtyGroups = Math.ceil(scratchLayout.dirtyOldCellsCapacity / 64);

      const pass = encoder.beginComputePass({ label });
      pass.setBindGroup(0, bindGroup);
      const dispatches = [
        ['detect_departed_members', nGroups],
        ['detect_moved_members', nGroups],
        ['sort_moved_chunks', chunkGroups],
        ['merge_w1024', movedGroups],
        ['merge_w2048', movedGroups],
        ['merge_w4096', movedGroups],
        ['merge_w8192', movedGroups],
        ['classify_moved_groups', 1],
        ['scan_old_cells_local', scanGroups],
        ['scan_old_cells_top', 1],
        ['scan_old_cells_add', scanGroups],
        ['emit_surviving_old_cells', cellGroups],
        ['emit_brand_new_cells', movedGroups],
        ['copy_clean_old_members', nGroups],
        ['copy_brand_new_cell_members', movedGroups],
        ['merge_dirty_cell_members', dirtyGroups],
        ['finalize_migrated_directory', 1]
      ];
      for (const [entry, groups] of dispatches) {
        pass.setPipeline(pipelines[entry].pipeline);
        pass.dispatchWorkgroups(Math.max(1, groups));
      }
      pass.end();

      return Object.freeze({
        schema: ULG_SCHROEDER_INCREMENTAL_SPATIAL_MIGRATION_SCHEMA,
        epochSchema: ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
        mode: 'incremental-gpu-encoded',
        staticFallbackFlags: 0,
        generationId: plan.generationId,
        sourceCount: plan.sourceCount,
        topologyEpoch: plan.topologyEpoch,
        chartEpoch: plan.chartEpoch,
        levelEpoch: plan.levelEpoch,
        supportEpoch: plan.supportEpoch,
        sortModeName: sortMode,
        sourceRowLayoutId: plan.sourceRowLayoutId,
        layout: plan.layout,
        directoryBuffer: arena.directoryBuffer,
        consumerDispatchBuffer: arena.consumerDispatchBuffer,
        certificateBuffer: arena.atomicsBuffer,
        staticCertificate: null,
        encodedComputePassCount: 1,
        encodedDispatchCount: dispatches.length,
        fallbackExecution: null,
        get released() { return released; },
        markSubmitted() {
          submitted = true;
          return true;
        },
        release() {
          if (released) return false;
          released = true;
          arena.inUse = false;
          return true;
        }
      });
    } catch (error) {
      arena.inUse = false;
      throw error;
    }
  }

  async function readCertificate(execution) {
    if (execution?.staticCertificate) return execution.staticCertificate;
    if (!execution?.certificateBuffer) return null;
    const enc = device.createCommandEncoder({ label: `${label}-read-cert` });
    enc.copyBufferToBuffer(
      execution.certificateBuffer,
      0,
      certReadbackBuffer,
      0,
      SCHROEDER_INCREMENTAL_CERTIFICATE_WORDS * UINT32_BYTES
    );
    device.queue.submit([enc.finish()]);
    await certReadbackBuffer.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const words = new Uint32Array(certReadbackBuffer.getMappedRange().slice(0));
    certReadbackBuffer.unmap();
    return parseSchroederIncrementalSpatialCertificate(words);
  }

  /**
   * Transactional step with automatic trusted GPU radix fallback:
   * runs the 1-pass incremental GPU migration when statically eligible, inspects
   * only the fixed 64-byte conservative displacement/churn certificate, and if
   * the GPU failed closed (e.g., adversarial multi-cell motion or moved budget
   * overflow), automatically retires the fail-closed attempt and executes the
   * trusted full GPU radix rebuild into a fresh immutable generation ID.
   */
  async function stepWithTrustedFallback(options = {}) {
    const encoder = device.createCommandEncoder({ label: `${label}-step` });
    const attempt = encode(encoder, options);
    device.queue.submit([encoder.finish()]);
    attempt.markSubmitted();
    const certificate = await readCertificate(attempt);
    if (certificate?.admitted) {
      return { execution: attempt, certificate, retriedOnFallback: false, failedClosedDirectoryStatus: null };
    }

    // Read the 3rd header word + consumerDispatch of the rejected attempt to prove
    // it sealed STATUS_FAIL_CLOSED and [0, 0, 0] consumer dispatch before fallback!
    const proofStaging = device.createBuffer({
      size: 32,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
    const proofEnc = device.createCommandEncoder({ label: `${label}-fail-closed-proof` });
    proofEnc.copyBufferToBuffer(attempt.directoryBuffer, 0, proofStaging, 0, 16);
    proofEnc.copyBufferToBuffer(attempt.consumerDispatchBuffer, 0, proofStaging, 16, 12);
    device.queue.submit([proofEnc.finish()]);
    await proofStaging.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const proofWords = new Uint32Array(proofStaging.getMappedRange().slice(0));
    proofStaging.unmap();
    proofStaging.destroy();
    const failedClosedProof = Object.freeze({
      statusFlags: proofWords[2],
      failClosedBitSet: (proofWords[2] & SCHROEDER_SPATIAL_EPOCH_STATUS_FAIL_CLOSED) !== 0,
      admittedBitSet: (proofWords[2] & SCHROEDER_SPATIAL_EPOCH_STATUS_ADMITTED) !== 0,
      consumerDispatch: [proofWords[4], proofWords[5], proofWords[6]]
    });
    attempt.release();

    const retryGenerationId = (Number(options.generationId) || 1) + 1;
    const retryBuildOrdinal = (Number(options.buildOrdinal) || 1) + 1;
    const fbEnc = device.createCommandEncoder({ label: `${label}-trusted-retry` });
    const fallbackExec = encode(fbEnc, {
      ...options,
      generationId: retryGenerationId,
      buildOrdinal: retryBuildOrdinal,
      forceFullRebuild: true
    });
    device.queue.submit([fbEnc.finish()]);
    fallbackExec.markSubmitted();
    return {
      execution: fallbackExec,
      certificate: Object.freeze({
        ...certificate,
        mode: SCHROEDER_INCREMENTAL_MIGRATION_MODE.FULL_RADIX_FALLBACK,
        modeName: 'full-radix-fallback',
        admitted: true,
        generationId: retryGenerationId
      }),
      retriedOnFallback: true,
      failedClosedDirectoryStatus: failedClosedProof
    };
  }

  function destroy() {
    if (destroyed) return false;
    destroyed = true;
    paramsBuffer.destroy();
    scratchBuffer.destroy();
    certReadbackBuffer.destroy();
    for (const arena of arenas) {
      arena.directoryBuffer.destroy();
      arena.consumerDispatchBuffer.destroy();
      arena.atomicsBuffer.destroy();
    }
    fallbackRuntime.destroy();
    return true;
  }

  return Object.freeze({
    schema: ULG_SCHROEDER_INCREMENTAL_SPATIAL_MIGRATION_SCHEMA,
    directoryLayout: layout,
    scratchLayout,
    maxSourceCount: resolvedMaxSourceCount,
    cellCapacity: resolvedCellCapacity,
    maxMovedMembers: resolvedMaxMovedMembers,
    arenaCount: resolvedArenaCount,
    maxCellJump: resolvedMaxCellJump,
    maxDisplacementSpacingMultiple: resolvedMaxDisp,
    fallbackRuntime,
    encode,
    readCertificate,
    stepWithTrustedFallback,
    destroy
  });
}

/**
 * Lightweight target-arena encoder for live `createSchroederSpatialEpochGpu`
 * integration (A2). Writes the single-pass 16-dispatch incremental CSR
 * directory directly into caller-owned immutable target arena buffers without
 * allocating duplicate directory arenas.
 */
export function createSchroederIncrementalSpatialMigrationEncoder(device, {
  maxSourceCount,
  cellCapacity = maxSourceCount,
  maxMovedMembers = 16384,
  maxCellJump = 1,
  maxDisplacementSpacingMultiple = 1.0,
  allowMembershipDelta = false,
  enforceCellJumpLimit = true,
  label = 'ulg-schroeder-incremental-spatial-encoder'
} = {}) {
  if (!device?.createBuffer || !device?.createComputePipeline) {
    throw new TypeError('Incremental spatial migration encoder requires a WebGPU device');
  }
  const resolvedMaxSourceCount = positiveInteger(maxSourceCount, 'maxSourceCount', MAX_EXACT_F32_INTEGER);
  const resolvedCellCapacity = positiveInteger(
    cellCapacity,
    'cellCapacity',
    Math.min(resolvedMaxSourceCount, MAX_SUPPORTED_CELL_CAPACITY)
  );
  const resolvedMaxMovedMembers = normalizeMaxMovedMembers(
    Math.min(maxMovedMembers, Math.max(1024, resolvedMaxSourceCount))
  );
  const resolvedMaxCellJump = nonNegativeInteger(maxCellJump, 'maxCellJump', 1024);
  const resolvedMaxDisp = Number(maxDisplacementSpacingMultiple);
  if (!(Number.isFinite(resolvedMaxDisp) && resolvedMaxDisp >= 0)) {
    throw new RangeError('maxDisplacementSpacingMultiple must be a finite non-negative number');
  }
  const scratchLayout = createSchroederIncrementalSpatialScratchLayout({
    maxSourceCount: resolvedMaxSourceCount,
    cellCapacity: resolvedCellCapacity,
    maxMovedMembers: resolvedMaxMovedMembers
  });
  const rawDevice = unwrapWebGpuCacheDevice(device);
  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'storage'),
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(8, 'read-only-storage')
  ];
  const wgsl = createSchroederIncrementalSpatialMigrationWgsl(scratchLayout);
  const cachePrefix = `ulg-a2-inc-spatial-${resolvedMaxSourceCount}-${resolvedCellCapacity}-${resolvedMaxMovedMembers}.v2`;
  const pipelines = Object.fromEntries(ENTRY_POINTS.map((entryPoint) => [
    entryPoint,
    createCachedExplicitComputePipeline(rawDevice, {
      cacheKey: `${cachePrefix}:${entryPoint}`,
      label: `${label}-${entryPoint}`,
      code: wgsl,
      entryPoint,
      bindings
    })
  ]));
  const createOwned = (bufLabel, size, usage) => tagWebGpuBufferDevice(
    device.createBuffer({ label: bufLabel, size: Math.max(16, size), usage }),
    device
  );
  const paramsBuffersByTarget = new WeakMap();
  const ownedParamsBuffers = [];
  const bindGroupCache = new Map();
  const bufferIds = new WeakMap();
  let nextBufferId = 1;
  const bufferId = (buf) => {
    let id = bufferIds.get(buf);
    if (!id) {
      id = nextBufferId;
      nextBufferId += 1;
      bufferIds.set(buf, id);
    }
    return id;
  };
  const paramsBufferForTarget = (targetDirectoryBuffer) => {
    let buf = paramsBuffersByTarget.get(targetDirectoryBuffer);
    if (!buf) {
      buf = createOwned(
        `${label}-params-${ownedParamsBuffers.length}`,
        PARAMS_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      );
      paramsBuffersByTarget.set(targetDirectoryBuffer, buf);
      ownedParamsBuffers.push(buf);
    }
    return buf;
  };
  const scratchBuffer = createOwned(`${label}-scratch`, scratchLayout.byteLength, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST);
  const atomicsBuffer = createOwned(
    `${label}-atomics`,
    scratchLayout.atomicByteLength,
    GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  );
  const maxWorkgroupsPerDim = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'maxComputeWorkgroupsPerDimension'
  );
  let destroyed = false;

  function encodeIntoTarget(encoder, {
    plan,
    sourceBuffer,
    prevSourceBuffer = null,
    prevExecution,
    targetDirectoryBuffer,
    targetConsumerDispatchBuffer,
    directoryAbiVersion = 1,
    logicalSourceCountGpuAuthored = false,
    logicalSourceCountAuthority = null,
    activeSourceViewBuffer = null,
    activeSourceViewBindingSize = null,
    maxCellJumpOverride = null,
    maxDisplacementOverride = null
  }) {
    if (destroyed) throw new Error(`${label} is destroyed`);
    if (!prevExecution?.directoryBuffer || prevExecution.directoryBuffer === targetDirectoryBuffer) {
      throw new TypeError('Incremental spatial migration requires a distinct immutable predecessor directoryBuffer');
    }
    const isV2 = directoryAbiVersion === 2;
    const targetParamsBuffer = paramsBufferForTarget(targetDirectoryBuffer);
    const usePrevSource = Boolean(prevSourceBuffer && resolvedMaxDisp > 0);
    const packedParams = packMigrationParams(plan, {
      hasPrevSource: usePrevSource,
      maxMovedMembers: resolvedMaxMovedMembers,
      maxCellJump: maxCellJumpOverride == null
        ? resolvedMaxCellJump
        : nonNegativeInteger(maxCellJumpOverride, 'maxCellJumpOverride', 1024),
      maxDisplacementSpacingMultiple: maxDisplacementOverride == null
        ? resolvedMaxDisp
        : Number(maxDisplacementOverride),
      prevExecution,
      consumerDispatchXLimit: maxWorkgroupsPerDim,
      logicalSourceCountGpuAuthored: Boolean(isV2 || logicalSourceCountGpuAuthored),
      directoryAbiVersion: isV2 ? 2 : 1,
      allowMembershipDelta,
      enforceCellJumpLimit
    });
    device.queue.writeBuffer(targetParamsBuffer, 0, packedParams);
    if (!isV2 && logicalSourceCountGpuAuthored && logicalSourceCountAuthority?.buffer) {
      encoder.copyBufferToBuffer(
        logicalSourceCountAuthority.buffer,
        logicalSourceCountAuthority.byteOffset ?? 0,
        targetParamsBuffer,
        0,
        UINT32_BYTES
      );
    }
    encoder.clearBuffer(atomicsBuffer);
    encoder.clearBuffer(
      scratchBuffer,
      scratchLayout.oldIncomingGroupOffset * UINT32_BYTES,
      scratchLayout.oldIncomingGroupWords * UINT32_BYTES
    );

    const sourceBindBytes = Math.min(
      Number(sourceBuffer.size) || resolvedMaxSourceCount * ACTIVE_NODE_STRIDE_FLOATS * 4,
      resolvedMaxSourceCount * ACTIVE_NODE_STRIDE_FLOATS * 4
    );
    const prevSourceBindBuffer = usePrevSource ? prevSourceBuffer : sourceBuffer;
    const prevSourceBindBytes = Math.min(
      Number(prevSourceBindBuffer.size) || sourceBindBytes,
      resolvedMaxSourceCount * ACTIVE_NODE_STRIDE_FLOATS * 4
    );
    const viewBuffer = isV2 && activeSourceViewBuffer
      ? activeSourceViewBuffer
      : prevExecution.directoryBuffer;
    const viewSize = isV2 && activeSourceViewBuffer && activeSourceViewBindingSize != null
      ? activeSourceViewBindingSize
      : undefined;
    const bgKey = `${bufferId(targetParamsBuffer)}:${bufferId(sourceBuffer)}:${sourceBindBytes}:${bufferId(prevSourceBindBuffer)}:${prevSourceBindBytes}:${bufferId(prevExecution.directoryBuffer)}:${bufferId(targetDirectoryBuffer)}:${bufferId(targetConsumerDispatchBuffer)}:${bufferId(viewBuffer)}:${viewSize ?? 0}`;
    let bindGroup = bindGroupCache.get(bgKey);
    if (!bindGroup) {
      if (bindGroupCache.size >= 64) bindGroupCache.clear();
      bindGroup = device.createBindGroup({
        label: `${label}-bind-group`,
        layout: pipelines.detect_moved_members.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: targetParamsBuffer, offset: 0, size: PARAMS_BYTES } },
          { binding: 1, resource: { buffer: sourceBuffer, offset: 0, size: sourceBindBytes } },
          { binding: 2, resource: { buffer: prevSourceBindBuffer, offset: 0, size: prevSourceBindBytes } },
          { binding: 3, resource: { buffer: prevExecution.directoryBuffer } },
          { binding: 4, resource: { buffer: targetDirectoryBuffer } },
          { binding: 5, resource: { buffer: targetConsumerDispatchBuffer } },
          { binding: 6, resource: { buffer: atomicsBuffer } },
          { binding: 7, resource: { buffer: scratchBuffer } },
          {
            binding: 8,
            resource: viewSize != null
              ? { buffer: viewBuffer, offset: 0, size: viewSize }
              : { buffer: viewBuffer }
          }
        ]
      });
      bindGroupCache.set(bgKey, bindGroup);
    }

    const workCount = Math.max(plan.sourceCount, plan.activeSourceCapacity ?? 0);
    const nGroups = Math.ceil(workCount / 256);
    const movedGroups = Math.ceil(resolvedMaxMovedMembers / 256);
    const chunkGroups = Math.ceil(resolvedMaxMovedMembers / CHUNK_SORT_SIZE);
    const scanGroups = Math.ceil(resolvedCellCapacity / SCAN_TILE_CELLS);
    const cellGroups = Math.ceil(resolvedCellCapacity / 256);
    const dirtyGroups = Math.ceil(scratchLayout.dirtyOldCellsCapacity / 64);

    const pass = encoder.beginComputePass({ label });
    pass.setBindGroup(0, bindGroup);
    const dispatches = [
      ['detect_departed_members', nGroups],
      ['detect_moved_members', nGroups],
      ['sort_moved_chunks', chunkGroups],
      ['merge_w1024', movedGroups],
      ['merge_w2048', movedGroups],
      ['merge_w4096', movedGroups],
      ['merge_w8192', movedGroups],
      ['classify_moved_groups', 1],
      ['scan_old_cells_local', scanGroups],
      ['scan_old_cells_top', 1],
      ['scan_old_cells_add', scanGroups],
      ['emit_surviving_old_cells', cellGroups],
      ['emit_brand_new_cells', movedGroups],
      ['copy_clean_old_members', nGroups],
      ['copy_brand_new_cell_members', movedGroups],
      ['merge_dirty_cell_members', dirtyGroups],
      ['finalize_migrated_directory', 1]
    ];
    for (const [entry, groups] of dispatches) {
      pass.setPipeline(pipelines[entry].pipeline);
      pass.dispatchWorkgroups(Math.max(1, groups));
    }
    pass.end();

    return Object.freeze({
      encodedComputePassCount: 1,
      encodedDispatchCount: dispatches.length,
      clearedWordCount: scratchLayout.atomicTotalWords + scratchLayout.oldIncomingGroupWords,
      paramsWriteCount: 1,
      certificateBuffer: atomicsBuffer
    });
  }

  function ownedBuffers() {
    return [
      ...ownedParamsBuffers.map((buffer, idx) => ({
        role: `spatial-incremental-params-${idx}`,
        arenaIndex: -1,
        buffer
      })),
      { role: 'spatial-incremental-scratch', arenaIndex: -1, buffer: scratchBuffer },
      { role: 'spatial-incremental-atomics', arenaIndex: -1, buffer: atomicsBuffer }
    ];
  }

  function destroy() {
    if (destroyed) return false;
    destroyed = true;
    bindGroupCache.clear();
    for (const buf of ownedParamsBuffers) buf.destroy?.();
    ownedParamsBuffers.length = 0;
    scratchBuffer.destroy?.();
    atomicsBuffer.destroy?.();
    return true;
  }

  return Object.freeze({
    schema: ULG_SCHROEDER_INCREMENTAL_SPATIAL_MIGRATION_SCHEMA,
    scratchLayout,
    maxSourceCount: resolvedMaxSourceCount,
    cellCapacity: resolvedCellCapacity,
    maxMovedMembers: resolvedMaxMovedMembers,
    encodeIntoTarget,
    ownedBuffers,
    destroy
  });
}
