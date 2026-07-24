import {
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_CONSUMER_WORKGROUP_SIZE,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_DISPATCH_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAGIC,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_RANKS_PER_LANE,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_CAPACITY_OVERFLOW,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_IDENTITY_MISMATCH,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_INVALID_SOURCE,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_NONFINITE,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_READY,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_UNSUPPORTED_SOURCE,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_VERSION,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_WORKGROUP_SIZE
} from './schroederSpatialActiveRankView.js';

function u32(value) {
  return `${value >>> 0}u`;
}

export function createSchroederSpatialActiveRankViewBuildWgsl(layout) {
  if (
    !layout
    || layout.headerWords !== SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_WORDS
    || layout.sourceCapacity < 1
    || layout.sourceCapacity > SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT
    || layout.rankPrefixCapacity !== layout.sourceCapacity + 1
    || layout.activeRankCapacity !== layout.sourceCapacity
    || layout.activeRanksOffsetWords
      !== layout.rankPrefixOffsetWords + layout.rankPrefixCapacity
    || layout.activeSourceIndexCapacity !== layout.sourceCapacity
    || layout.activeSourceIndicesOffsetWords
      !== layout.activeRanksOffsetWords + layout.activeRankCapacity
    || layout.wordLength
      !== layout.activeSourceIndicesOffsetWords + layout.activeSourceIndexCapacity
  ) {
    throw new TypeError('active-rank view layout is not a canonical bounded v1 layout');
  }
  return /* wgsl */ `
@group(0) @binding(0) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(1) var<storage, read> spatial_source_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> active_rank_view: array<u32>;

const VIEW_MAGIC: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAGIC)};
const VIEW_VERSION: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_VERSION)};
const VIEW_HEADER_WORDS: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_WORDS)};
const VIEW_SOURCE_CAPACITY: u32 = ${u32(layout.sourceCapacity)};
const VIEW_PREFIX_OFFSET: u32 = ${u32(layout.rankPrefixOffsetWords)};
const VIEW_PREFIX_CAPACITY: u32 = ${u32(layout.rankPrefixCapacity)};
const VIEW_ACTIVE_RANKS_OFFSET: u32 = ${u32(layout.activeRanksOffsetWords)};
const VIEW_ACTIVE_RANK_CAPACITY: u32 = ${u32(layout.activeRankCapacity)};
const VIEW_ACTIVE_SOURCE_INDICES_OFFSET: u32 = ${u32(layout.activeSourceIndicesOffsetWords)};
const VIEW_ACTIVE_SOURCE_INDEX_CAPACITY: u32 = ${u32(layout.activeSourceIndexCapacity)};
const VIEW_CAPACITY_WORDS: u32 = ${u32(layout.wordLength)};
const VIEW_DISPATCH_OFFSET: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_DISPATCH_OFFSET_WORDS)};
const VIEW_DISPATCH_WORDS: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_DISPATCH_WORDS)};
const VIEW_MAX_SOURCE_COUNT: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT)};
const VIEW_RANKS_PER_LANE: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_RANKS_PER_LANE)};
const PRODUCER_WORKGROUP_SIZE: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_WORKGROUP_SIZE)};
const CONSUMER_WORKGROUP_SIZE: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_CONSUMER_WORKGROUP_SIZE)};
const VIEW_STATUS_READY: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_READY)};
const VIEW_STATUS_ADMITTED: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_ADMITTED)};
const VIEW_STATUS_FAIL_CLOSED: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_FAIL_CLOSED)};
const VIEW_STATUS_INVALID_SOURCE: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_INVALID_SOURCE)};
const VIEW_STATUS_CAPACITY_OVERFLOW: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_CAPACITY_OVERFLOW)};
const VIEW_STATUS_UNSUPPORTED_SOURCE: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_UNSUPPORTED_SOURCE)};
const VIEW_STATUS_IDENTITY_MISMATCH: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_IDENTITY_MISMATCH)};
const VIEW_STATUS_NONFINITE: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_NONFINITE)};
const DIRECTORY_MAGIC: u32 = 0x53534531u;
const DIRECTORY_VERSION: u32 = 1u;
const DIRECTORY_STATUS_EXACT: u32 = 3u;
const SOURCE_LAYOUT_LEVEL_ASSIGNMENT: u32 = 1u;
const SOURCE_ROW_WORDS: u32 = 16u;
const FINGERPRINT_BASIS: u32 = 2166136261u;
const FINGERPRINT_PRIME: u32 = 16777619u;

var<workgroup> lane_active_counts: array<u32, ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_WORKGROUP_SIZE}>;
var<workgroup> lane_active_offsets: array<u32, ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_WORKGROUP_SIZE}>;
var<workgroup> invalid_source_count: atomic<u32>;
var<workgroup> nonfinite_source_count: atomic<u32>;
var<workgroup> dormant_source_count: atomic<u32>;
var<workgroup> producer_admitted: u32;
var<workgroup> total_active_count: u32;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn fold_fingerprint(value: u32, word: u32) -> u32 {
  return (value ^ word) * FINGERPRINT_PRIME;
}

fn replay_guard_token() -> u32 {
  var value = fold_fingerprint(FINGERPRINT_BASIS, spatial_directory[3u]);
  value = fold_fingerprint(value, spatial_directory[7u]);
  value = fold_fingerprint(value, spatial_directory[8u]);
  value = fold_fingerprint(value, spatial_directory[9u]);
  value = fold_fingerprint(value, spatial_directory[10u]);
  value = fold_fingerprint(value, spatial_directory[11u]);
  value = fold_fingerprint(value, spatial_directory[12u]);
  value = fold_fingerprint(value, spatial_directory[13u]);
  value = fold_fingerprint(value, spatial_directory[14u]);
  value = fold_fingerprint(value, spatial_directory[15u]);
  return fold_fingerprint(value, spatial_directory[35u]);
}

fn header_fingerprint(
  replay_token: u32,
  active_count: u32,
  dormant_count: u32
) -> u32 {
  var value = fold_fingerprint(replay_token, VIEW_PREFIX_OFFSET);
  value = fold_fingerprint(value, VIEW_PREFIX_CAPACITY);
  value = fold_fingerprint(value, VIEW_ACTIVE_RANKS_OFFSET);
  value = fold_fingerprint(value, VIEW_ACTIVE_RANK_CAPACITY);
  value = fold_fingerprint(value, VIEW_ACTIVE_SOURCE_INDICES_OFFSET);
  value = fold_fingerprint(value, VIEW_ACTIVE_SOURCE_INDEX_CAPACITY);
  value = fold_fingerprint(value, active_count);
  value = fold_fingerprint(value, dormant_count);
  return fold_fingerprint(value, SOURCE_LAYOUT_LEVEL_ASSIGNMENT);
}

fn directory_admitted() -> bool {
  if (
    arrayLength(&spatial_directory) < 48u
    || arrayLength(&active_rank_view) < VIEW_CAPACITY_WORDS
  ) { return false; }
  let source_count = spatial_directory[16u];
  let source_capacity = spatial_directory[17u];
  let cell_count = spatial_directory[18u];
  let cell_capacity = spatial_directory[19u];
  let directory_capacity = spatial_directory[22u];
  let cell_offsets = spatial_directory[30u];
  let cell_members = spatial_directory[31u];
  let particle_to_cell = spatial_directory[32u];
  return spatial_directory[0u] == DIRECTORY_MAGIC
    && spatial_directory[1u] == DIRECTORY_VERSION
    && spatial_directory[2u] == DIRECTORY_STATUS_EXACT
    && spatial_directory[28u] == 48u
    && spatial_directory[25u] == 5u
    && spatial_directory[35u] == spatial_directory[33u]
    && source_capacity == VIEW_SOURCE_CAPACITY
    && source_count <= source_capacity
    && source_count <= VIEW_MAX_SOURCE_COUNT
    && cell_count <= cell_capacity
    && directory_capacity <= arrayLength(&spatial_directory)
    && spatial_directory[47u] <= directory_capacity
    && cell_offsets <= directory_capacity
    && cell_count + 1u <= directory_capacity - cell_offsets
    && cell_members <= directory_capacity
    && source_count <= directory_capacity - cell_members
    && particle_to_cell <= directory_capacity
    && source_count <= directory_capacity - particle_to_cell
    && source_count <= arrayLength(&spatial_source_rows) / SOURCE_ROW_WORDS;
}

fn seal_header(
  status: u32,
  active_count: u32,
  dormant_count: u32,
  invalid_count: u32
) {
  let admitted = (status & VIEW_STATUS_ADMITTED) != 0u
    && (status & VIEW_STATUS_FAIL_CLOSED) == 0u;
  let sealed_active_count = select(0u, active_count, admitted);
  let sealed_dormant_count = select(0u, dormant_count, admitted);
  let dispatch_x = select(
    0u,
    max(
      1u,
      (sealed_active_count + CONSUMER_WORKGROUP_SIZE - 1u)
        / CONSUMER_WORKGROUP_SIZE
    ),
    admitted
  );
  let replay_token = select(0u, replay_guard_token(), admitted);
  active_rank_view[0u] = VIEW_MAGIC;
  active_rank_view[1u] = VIEW_VERSION;
  active_rank_view[2u] = status;
  for (var word = 3u; word <= 15u; word = word + 1u) {
    active_rank_view[word] = spatial_directory[word];
  }
  active_rank_view[16u] = spatial_directory[16u];
  active_rank_view[17u] = spatial_directory[17u];
  active_rank_view[18u] = spatial_directory[18u];
  active_rank_view[19u] = spatial_directory[19u];
  active_rank_view[20u] = VIEW_HEADER_WORDS;
  active_rank_view[21u] = VIEW_PREFIX_OFFSET;
  active_rank_view[22u] = VIEW_PREFIX_CAPACITY;
  active_rank_view[23u] = VIEW_ACTIVE_RANKS_OFFSET;
  active_rank_view[24u] = VIEW_ACTIVE_RANK_CAPACITY;
  active_rank_view[25u] = VIEW_CAPACITY_WORDS;
  active_rank_view[26u] = sealed_active_count;
  active_rank_view[27u] = sealed_dormant_count;
  active_rank_view[28u] = invalid_count;
  active_rank_view[29u] = SOURCE_LAYOUT_LEVEL_ASSIGNMENT;
  active_rank_view[30u] = spatial_directory[46u];
  active_rank_view[31u] = spatial_directory[31u];
  active_rank_view[32u] = spatial_directory[35u];
  active_rank_view[33u] = select(0u, spatial_directory[35u], admitted);
  active_rank_view[34u] = spatial_directory[33u];
  active_rank_view[35u] = CONSUMER_WORKGROUP_SIZE;
  active_rank_view[36u] = VIEW_DISPATCH_OFFSET;
  active_rank_view[37u] = VIEW_DISPATCH_WORDS;
  active_rank_view[38u] = spatial_directory[22u];
  active_rank_view[39u] = spatial_directory[47u];
  active_rank_view[40u] = replay_token;
  active_rank_view[41u] = select(
    0u,
    header_fingerprint(replay_token, sealed_active_count, sealed_dormant_count),
    admitted
  );
  active_rank_view[42u] = VIEW_MAX_SOURCE_COUNT;
  active_rank_view[43u] = VIEW_RANKS_PER_LANE;
  active_rank_view[44u] = dispatch_x;
  active_rank_view[45u] = 1u;
  active_rank_view[46u] = 1u;
  active_rank_view[47u] = VIEW_HEADER_WORDS;
  active_rank_view[48u] = select(VIEW_HEADER_WORDS, VIEW_CAPACITY_WORDS, admitted);
  active_rank_view[49u] = VIEW_ACTIVE_SOURCE_INDICES_OFFSET;
  active_rank_view[50u] = VIEW_ACTIVE_SOURCE_INDEX_CAPACITY;
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_WORKGROUP_SIZE})
fn build_active_rank_view(
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let lane = local_id.x;
  if (lane == 0u) {
    atomicStore(&invalid_source_count, 0u);
    atomicStore(&nonfinite_source_count, 0u);
    atomicStore(&dormant_source_count, 0u);
    producer_admitted = select(0u, 1u, directory_admitted());
    total_active_count = 0u;
  }
  lane_active_counts[lane] = 0u;
  lane_active_offsets[lane] = 0u;
  workgroupBarrier();
  let source_count = select(
    0u,
    spatial_directory[16u],
    producer_admitted != 0u
  );
  let chunk_size = (source_count + PRODUCER_WORKGROUP_SIZE - 1u)
    / PRODUCER_WORKGROUP_SIZE;
  let rank_begin = lane * chunk_size;
  let rank_end = min(source_count, rank_begin + chunk_size);
  var active_mask: array<u32, ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_RANKS_PER_LANE}>;
  var active_source_indices: array<u32, ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_RANKS_PER_LANE}>;
  var local_active_count = 0u;
  var local_dormant_count = 0u;
  var local_invalid_count = 0u;
  var local_nonfinite_count = 0u;
  for (var rank = rank_begin; rank < rank_end; rank = rank + 1u) {
    let local_rank = rank - rank_begin;
    let source_index = spatial_directory[spatial_directory[31u] + rank];
    if (source_index >= source_count) {
      local_invalid_count = local_invalid_count + 1u;
      continue;
    }
    let source_base = source_index * SOURCE_ROW_WORDS;
    let support_radius = spatial_source_rows[source_base + 2u];
    let represented_volume = spatial_source_rows[source_base + 3u];
    let rest_volume = spatial_source_rows[source_base + 4u];
    let current_volume = spatial_source_rows[source_base + 5u];
    let mass = spatial_source_rows[source_base + 6u];
    let finite = finite_f32(support_radius)
      && finite_f32(represented_volume)
      && finite_f32(rest_volume)
      && finite_f32(current_volume)
      && finite_f32(mass);
    if (!finite) {
      local_invalid_count = local_invalid_count + 1u;
      local_nonfinite_count = local_nonfinite_count + 1u;
      continue;
    }
    let dormant = bitcast<u32>(support_radius) == 0u
      && bitcast<u32>(represented_volume) == 0u
      && bitcast<u32>(rest_volume) == 0u
      && bitcast<u32>(current_volume) == 0u
      && bitcast<u32>(mass) == 0u;
    let row_active = mass > 0.0
      && support_radius >= 0.0
      && represented_volume >= 0.0
      && rest_volume > 0.0
      // Mechanical consumers accept a row only while its current volume is
      // positive. Keep the producer's dense projection identical so a
      // zero-volume positive-mass row cannot pass one side and fail the
      // per-rank membership seal on the other.
      && current_volume > 0.0;
    if (row_active) {
      active_mask[local_rank] = 1u;
      active_source_indices[local_rank] = source_index;
      local_active_count = local_active_count + 1u;
    } else if (dormant) {
      local_dormant_count = local_dormant_count + 1u;
    } else {
      local_invalid_count = local_invalid_count + 1u;
    }
  }
  lane_active_counts[lane] = local_active_count;
  if (local_invalid_count != 0u) {
    atomicAdd(&invalid_source_count, local_invalid_count);
  }
  if (local_nonfinite_count != 0u) {
    atomicAdd(&nonfinite_source_count, local_nonfinite_count);
  }
  if (local_dormant_count != 0u) {
    atomicAdd(&dormant_source_count, local_dormant_count);
  }
  workgroupBarrier();

  if (lane == 0u) {
    var running = 0u;
    for (var scan_lane = 0u; scan_lane < PRODUCER_WORKGROUP_SIZE; scan_lane = scan_lane + 1u) {
      lane_active_offsets[scan_lane] = running;
      running = running + lane_active_counts[scan_lane];
    }
    total_active_count = running;
  }
  workgroupBarrier();
  let invalid_count = atomicLoad(&invalid_source_count);
  let dormant_count = atomicLoad(&dormant_source_count);
  let rows_admitted = producer_admitted != 0u
    && invalid_count == 0u
    && total_active_count <= source_count
    && total_active_count + dormant_count == source_count;
  if (rows_admitted) {
    var prefix = lane_active_offsets[lane];
    for (var rank = rank_begin; rank < rank_end; rank = rank + 1u) {
      let local_rank = rank - rank_begin;
      active_rank_view[VIEW_PREFIX_OFFSET + rank] = prefix;
      if (active_mask[local_rank] != 0u) {
        active_rank_view[VIEW_ACTIVE_RANKS_OFFSET + prefix] = rank;
        active_rank_view[VIEW_ACTIVE_SOURCE_INDICES_OFFSET + prefix] =
          active_source_indices[local_rank];
        prefix = prefix + 1u;
      }
    }
  }
  storageBarrier();
  workgroupBarrier();
  if (lane == 0u) {
    if (producer_admitted == 0u) {
      seal_header(
        VIEW_STATUS_READY
          | VIEW_STATUS_FAIL_CLOSED
          | VIEW_STATUS_IDENTITY_MISMATCH,
        0u,
        0u,
        1u
      );
    } else if (!rows_admitted) {
      var status = VIEW_STATUS_READY
        | VIEW_STATUS_FAIL_CLOSED
        | VIEW_STATUS_INVALID_SOURCE;
      if (atomicLoad(&nonfinite_source_count) != 0u) {
        status = status | VIEW_STATUS_NONFINITE;
      }
      seal_header(status, 0u, 0u, invalid_count);
    } else {
      active_rank_view[VIEW_PREFIX_OFFSET + source_count] = total_active_count;
      seal_header(
        VIEW_STATUS_READY | VIEW_STATUS_ADMITTED,
        total_active_count,
        dormant_count,
        0u
      );
    }
  }
}
`;
}
