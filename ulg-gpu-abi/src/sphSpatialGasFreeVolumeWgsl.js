import {
  SPH_SPATIAL_GAS_FREE_VOLUME_MAGIC,
  SPH_SPATIAL_GAS_FREE_VOLUME_ROW_WORDS,
  SPH_SPATIAL_GAS_FREE_VOLUME_STATUS,
  SPH_SPATIAL_GAS_FREE_VOLUME_VERSION,
  SPH_SPATIAL_GAS_FREE_VOLUME_WORKGROUP_SIZE
} from './sphSpatialGasFreeVolume.js';

const u32 = (value) => `${Number(value) >>> 0}u`;

export function createSphSpatialGasFreeVolumeWgsl(layout) {
  if (
    !layout
    || layout.rowWords !== SPH_SPATIAL_GAS_FREE_VOLUME_ROW_WORDS
    || layout.cellCapacity < 1
    || layout.rowsWordLength !== layout.cellCapacity * layout.rowWords
  ) {
    throw new TypeError('gas free-volume WGSL requires one canonical layout');
  }
  return /* wgsl */ `
struct GasFreeVolumeParams {
  cell_capacity: u32,
  fine_field_capacity: u32,
  coarse_field_capacity: u32,
  exact_level_count: u32,
  generation_id: u32,
  source_generation: u32,
  directory_generation: u32,
  storage_generation: u32,
  chart_id: u32,
  selected_level: i32,
  nx: u32,
  ny: u32,
  nz: u32,
  grid_shift: i32,
  grid_spacing_m: f32,
  overfill_tolerance_relative: f32,
  overfill_tolerance_absolute_m3: f32,
  box_min_x: f32,
  box_min_y: f32,
  box_min_z: f32,
  box_max_x: f32,
  box_max_y: f32,
  box_max_z: f32,
  fine_moment_generation: u32,
  coarse_moment_generation: u32,
  parent_completion_ordinal: u32,
  directory_capacity_words: u32,
  directory_key_offset_words: u32,
  fine_moment_field_capacity: u32,
  coarse_moment_field_capacity: u32,
  parent_capacity_words: u32,
  fine_grid_node_count: u32,
  fine_grid_spacing_m: f32,
  coarse_grid_node_count: u32,
  coarse_grid_spacing_m: f32,
  source_device_ordinal: u32,
  source_lane_ordinal: u32,
  source_lease_token: u32,
  source_family_id: u32,
  source_physics_tick: u32,
  source_physics_substep: u32,
  source_position_epoch: u32,
  source_topology_epoch: u32,
  source_chart_epoch: u32,
  source_level_epoch: u32,
  source_support_epoch: u32,
  fine_completion_ordinal: u32,
  coarse_completion_ordinal: u32,
  fine_scatter_dispatch_x: u32,
  fine_scatter_dispatch_y: u32,
  coarse_scatter_dispatch_x: u32,
  coarse_scatter_dispatch_y: u32,
  keyed_lookup_max_steps: u32,
  reserved22: u32,
  reserved23: u32,
  reserved24: u32,
  reserved25: u32,
  reserved26: u32,
  reserved27: u32,
  reserved28: u32,
  reserved29: u32,
  reserved30: u32,
  reserved31: u32,
};

@group(0) @binding(0) var<storage, read> gas_directory: array<u32>;
@group(0) @binding(1) var<storage, read> fine_moment_control: array<u32>;
@group(0) @binding(2) var<storage, read> fine_moment_rows: array<u32>;
@group(0) @binding(3) var<storage, read> coarse_moment_control: array<u32>;
@group(0) @binding(4) var<storage, read> coarse_moment_rows: array<u32>;
@group(0) @binding(5) var<storage, read> parent_field_view: array<u32>;
@group(0) @binding(6) var<storage, read_write> output_control: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> output_rows: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> params: GasFreeVolumeParams;

const OUTPUT_MAGIC: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_MAGIC)};
const OUTPUT_VERSION: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_VERSION)};
const REDUCTION_VERSION: u32 = 2u;
const ROW_WORDS: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_ROW_WORDS)};
const WORKGROUP_SIZE: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_WORKGROUP_SIZE)};
const READY: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.READY)};
const ADMITTED: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.ADMITTED)};
const FAIL_CLOSED: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.FAIL_CLOSED)};
const INVALID_DIRECTORY: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.INVALID_DIRECTORY)};
const INVALID_MOMENT: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.INVALID_MOMENT)};
const INVALID_PARENT: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.INVALID_PARENT)};
const INVALID_GEOMETRY: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.INVALID_GEOMETRY)};
const OVERFILLED: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.OVERFILLED)};
const NONFINITE_VOLUME: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.NONFINITE_VOLUME)};
const COUNT_MISMATCH: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.COUNT_MISMATCH)};
const DIRECTORY_MAGIC: u32 = 0x53534531u;
const DIRECTORY_VERSION: u32 = 1u;
const MOMENT_MAGIC: u32 = 0x53505631u;
const MOMENT_VERSION: u32 = 1u;
const PARENT_MAGIC: u32 = 0x53504631u;
const PARENT_VERSION: u32 = 1u;
const READY_ADMITTED: u32 = 3u;
const REJECT_MASK: u32 = 0xfffffffcu;
const MOMENT_ROW_WORDS: u32 = 12u;
const CONDENSED_SOLID: u32 = 1u;
const CONDENSED_LIQUID: u32 = 2u;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= bitcast<f32>(0x7f7fffffu);
}

fn decoded_order_key(value: u32) -> i32 {
  return bitcast<i32>(value ^ 0x80000000u);
}

fn dense_node_for_cell(x: i32, y: i32, z: i32) -> u32 {
  let dx = x + params.grid_shift;
  let dy = y + params.grid_shift;
  let dz = z + params.grid_shift;
  if (
    dx < 0 || dy < 0 || dz < 0
    || dx >= i32(params.nx)
    || dy >= i32(params.ny)
    || dz >= i32(params.nz)
  ) {
    return 0xffffffffu;
  }
  return u32(dx) * params.ny * params.nz + u32(dy) * params.nz + u32(dz);
}

fn directory_ready() -> bool {
  if (arrayLength(&gas_directory) < 48u) { return false; }
  let status = gas_directory[2u];
  return gas_directory[0u] == DIRECTORY_MAGIC
    && gas_directory[1u] == DIRECTORY_VERSION
    && (status & READY_ADMITTED) == READY_ADMITTED
    && (status & 28u) == 0u
    && gas_directory[3u] == params.directory_generation
    && gas_directory[8u] == params.storage_generation
    && gas_directory[18u] <= params.cell_capacity
    && gas_directory[19u] == params.cell_capacity
    && gas_directory[22u] == params.directory_capacity_words
    && gas_directory[25u] == 5u
    && gas_directory[26u] == 5u
    && gas_directory[28u] == 48u
    && gas_directory[29u] == params.directory_key_offset_words
    && gas_directory[35u] != 0u
    && gas_directory[36u] == params.directory_generation
    && gas_directory[38u] == gas_directory[18u]
    && gas_directory[39u] == 1u
    && gas_directory[40u] == 0u
    && gas_directory[41u] == 1u;
}

fn moment_ready(
  control: ptr<storage, array<u32>, read>,
  expected_generation: u32,
  expected_level: i32,
  expected_field_capacity: u32,
  expected_grid_node_count: u32,
  expected_grid_spacing_m: f32,
  expected_completion_ordinal: u32
) -> bool {
  if (arrayLength(control) < 64u) { return false; }
  let status = (*control)[2u];
  return (*control)[0u] == MOMENT_MAGIC
    && (*control)[1u] == MOMENT_VERSION
    && (status & READY_ADMITTED) == READY_ADMITTED
    && (status & REJECT_MASK) == 0u
    && (*control)[3u] == expected_generation
    && (*control)[4u] == params.source_device_ordinal
    && (*control)[5u] == params.source_lane_ordinal
    && (*control)[6u] == params.source_lease_token
    && (*control)[7u] == params.source_family_id
    && (*control)[8u] == params.storage_generation
    && (*control)[9u] == params.source_physics_tick
    && (*control)[10u] == params.source_physics_substep
    && (*control)[11u] == params.source_position_epoch
    && (*control)[12u] == params.source_topology_epoch
    && (*control)[13u] == params.source_chart_epoch
    && (*control)[14u] == params.source_level_epoch
    && (*control)[15u] == params.source_support_epoch
    && bitcast<i32>((*control)[20u]) == expected_level
    && (*control)[21u] == expected_grid_node_count
    && bitcast<f32>((*control)[22u]) == expected_grid_spacing_m
    && (*control)[23u] == expected_completion_ordinal
    && (*control)[19u] == expected_field_capacity
    && (*control)[18u] <= expected_field_capacity
    && (*control)[29u] == MOMENT_ROW_WORDS
    && (*control)[35u] == 32u
    && (*control)[36u] == 16u
    && (*control)[37u] == 0u
    && (*control)[38u] == 0u;
}

fn parent_ready() -> bool {
  if (params.exact_level_count == 1u) { return true; }
  if (arrayLength(&parent_field_view) < 80u) { return false; }
  let status = parent_field_view[2u];
  return parent_field_view[0u] == PARENT_MAGIC
    && parent_field_view[1u] == PARENT_VERSION
    && (status & READY_ADMITTED) == READY_ADMITTED
    && (status & REJECT_MASK) == 0u
    && parent_field_view[3u] == params.source_generation
    && parent_field_view[8u] == params.storage_generation
    && parent_field_view[17u] == bitcast<u32>(params.selected_level)
    && parent_field_view[23u] == params.nx
    && parent_field_view[24u] == params.ny
    && parent_field_view[25u] == params.nz
    && bitcast<i32>(parent_field_view[27u]) == params.grid_shift
    && bitcast<f32>(parent_field_view[29u]) == params.grid_spacing_m
    && parent_field_view[31u] == params.coarse_field_capacity
    && parent_field_view[37u] <= parent_field_view[33u]
    && parent_field_view[44u] == params.parent_completion_ordinal
    && parent_field_view[55u] <= params.parent_capacity_words
    && parent_field_view[56u] == params.parent_capacity_words
    && parent_field_view[67u] == 2u;
}

fn condensed_family(family: u32) -> bool {
  return family == CONDENSED_SOLID || family == CONDENSED_LIQUID;
}

fn row_volume(rows: ptr<storage, array<u32>, read>, field: u32) -> f32 {
  let base = field * MOMENT_ROW_WORDS;
  if (
    base > arrayLength(rows)
    || MOMENT_ROW_WORDS > arrayLength(rows) - base
    || (*rows)[base + 9u] != READY_ADMITTED
  ) {
    return -1.0;
  }
  let volume = bitcast<f32>((*rows)[base + 4u]);
  return select(-1.0, volume, finite_f32(volume) && volume >= 0.0);
}

fn fail(flag: u32, counter_word: u32) {
  atomicOr(&output_control[3u], flag);
  atomicAdd(&output_control[counter_word], 1u);
}

fn directory_cell_order(cell: u32, target_dense: u32) -> i32 {
  let base = params.directory_key_offset_words + cell * 5u;
  let chart = gas_directory[base];
  if (chart < params.chart_id) { return -1; }
  if (chart > params.chart_id) { return 1; }
  let level = decoded_order_key(gas_directory[base + 1u]);
  if (level < params.selected_level) { return -1; }
  if (level > params.selected_level) { return 1; }
  let yz = params.ny * params.nz;
  let dense_x = target_dense / yz;
  let dense_yz = target_dense - dense_x * yz;
  let dense_y = dense_yz / params.nz;
  let dense_z = dense_yz - dense_y * params.nz;
  let target_x = i32(dense_x) - params.grid_shift;
  let target_y = i32(dense_y) - params.grid_shift;
  let target_z = i32(dense_z) - params.grid_shift;
  let x = decoded_order_key(gas_directory[base + 2u]);
  if (x < target_x) { return -1; }
  if (x > target_x) { return 1; }
  let y = decoded_order_key(gas_directory[base + 3u]);
  if (y < target_y) { return -1; }
  if (y > target_y) { return 1; }
  let z = decoded_order_key(gas_directory[base + 4u]);
  if (z < target_z) { return -1; }
  if (z > target_z) { return 1; }
  return 0;
}

fn find_gas_cell(target_dense: u32) -> u32 {
  var low = 0u;
  var high = gas_directory[18u];
  var steps = 0u;
  loop {
    if (low >= high || steps >= params.keyed_lookup_max_steps) { break; }
    let middle = low + (high - low) / 2u;
    if (directory_cell_order(middle, target_dense) < 0) {
      low = middle + 1u;
    } else {
      high = middle;
    }
    steps = steps + 1u;
  }
  if (
    low < gas_directory[18u]
    && directory_cell_order(low, target_dense) == 0
  ) {
    return low;
  }
  return 0xffffffffu;
}

fn atomic_add_condensed(cell: u32, contribution: f32) -> bool {
  if (!finite_f32(contribution) || contribution < 0.0) { return false; }
  let condensed_target = &output_rows[cell * ROW_WORDS + 1u];
  var observed = atomicLoad(condensed_target);
  loop {
    let current = bitcast<f32>(observed);
    let next = current + contribution;
    if (!finite_f32(current) || !finite_f32(next) || next < 0.0) {
      return false;
    }
    let exchanged = atomicCompareExchangeWeak(
      condensed_target,
      observed,
      bitcast<u32>(next)
    );
    if (exchanged.exchanged) { return true; }
    observed = exchanged.old_value;
  }
}

fn scatter_to_gas_cell(target_dense: u32, contribution: f32) -> bool {
  let cell = find_gas_cell(target_dense);
  return cell == 0xffffffffu || atomic_add_condensed(cell, contribution);
}

@compute @workgroup_size(1)
fn validate_gas_free_volume_authority() {
  if (!directory_ready()) {
    fail(INVALID_DIRECTORY, 16u);
    return;
  }
  if (!moment_ready(
    &fine_moment_control,
    params.fine_moment_generation,
    params.selected_level - select(0, 1, params.exact_level_count == 2u),
    params.fine_moment_field_capacity,
    params.fine_grid_node_count,
    params.fine_grid_spacing_m,
    params.fine_completion_ordinal
  )) {
    fail(INVALID_MOMENT, 17u);
    return;
  }
  if (params.exact_level_count == 2u) {
    if (!moment_ready(
      &coarse_moment_control,
      params.coarse_moment_generation,
      params.selected_level,
      params.coarse_moment_field_capacity,
      params.coarse_grid_node_count,
      params.coarse_grid_spacing_m,
      params.coarse_completion_ordinal
    )) {
      fail(INVALID_MOMENT, 17u);
      return;
    }
    if (!parent_ready()) {
      fail(INVALID_PARENT, 18u);
    }
  }
}

@compute @workgroup_size(${SPH_SPATIAL_GAS_FREE_VOLUME_WORKGROUP_SIZE})
fn scatter_fine_condensed_volume(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (atomicLoad(&output_control[3u]) != 0u) { return; }
  let linear_group = workgroup_id.x
    + workgroup_id.y * params.fine_scatter_dispatch_x;
  let field = linear_group * WORKGROUP_SIZE + local_id.x;
  if (field >= fine_moment_control[18u]) { return; }
  let base = field * MOMENT_ROW_WORDS;
  let volume = row_volume(&fine_moment_rows, field);
  if (!finite_f32(volume) || volume < 0.0) {
    fail(INVALID_MOMENT, 17u);
    return;
  }
  if (!condensed_family(fine_moment_rows[base + 1u])) { return; }
  if (params.exact_level_count == 1u) {
    let target_dense = fine_moment_rows[base];
    if (
      target_dense >= params.fine_grid_node_count
      || !scatter_to_gas_cell(target_dense, volume)
    ) {
      fail(NONFINITE_VOLUME, 21u);
    }
    return;
  }
  let parent_key_offset = parent_field_view[48u];
  let edge_offset_offset = parent_field_view[51u];
  let edge_parent_offset = parent_field_view[52u];
  let edge_weight_offset = parent_field_view[53u];
  if (
    edge_offset_offset + field + 1u >= arrayLength(&parent_field_view)
  ) {
    fail(INVALID_PARENT, 18u);
    return;
  }
  let begin = parent_field_view[edge_offset_offset + field];
  let end = parent_field_view[edge_offset_offset + field + 1u];
  if (
    begin > end
    || end > parent_field_view[38u]
    || edge_parent_offset + end > arrayLength(&parent_field_view)
    || edge_weight_offset + end > arrayLength(&parent_field_view)
  ) {
    fail(INVALID_PARENT, 18u);
    return;
  }
  for (var edge = begin; edge < end; edge = edge + 1u) {
    let parent = parent_field_view[edge_parent_offset + edge];
    if (
      parent >= parent_field_view[37u]
      || parent_key_offset + parent * 4u + 4u
        > arrayLength(&parent_field_view)
    ) {
      fail(INVALID_PARENT, 18u);
      return;
    }
    let target_dense = parent_field_view[parent_key_offset + parent * 4u];
    let weight = bitcast<f32>(parent_field_view[edge_weight_offset + edge]);
    if (
      target_dense >= params.coarse_grid_node_count
      || !finite_f32(weight)
      || weight < 0.0
      || !scatter_to_gas_cell(target_dense, volume * weight)
    ) {
      fail(INVALID_PARENT, 18u);
      return;
    }
  }
}

@compute @workgroup_size(${SPH_SPATIAL_GAS_FREE_VOLUME_WORKGROUP_SIZE})
fn scatter_coarse_condensed_volume(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (
    params.exact_level_count != 2u
    || atomicLoad(&output_control[3u]) != 0u
  ) {
    return;
  }
  let linear_group = workgroup_id.x
    + workgroup_id.y * params.coarse_scatter_dispatch_x;
  let field = linear_group * WORKGROUP_SIZE + local_id.x;
  if (field >= coarse_moment_control[18u]) { return; }
  let base = field * MOMENT_ROW_WORDS;
  let volume = row_volume(&coarse_moment_rows, field);
  if (!finite_f32(volume) || volume < 0.0) {
    fail(INVALID_MOMENT, 17u);
    return;
  }
  if (!condensed_family(coarse_moment_rows[base + 1u])) { return; }
  let parent_key_offset = parent_field_view[48u];
  let coarse_map_offset = parent_field_view[54u];
  if (coarse_map_offset + field >= arrayLength(&parent_field_view)) {
    fail(INVALID_PARENT, 18u);
    return;
  }
  let parent = parent_field_view[coarse_map_offset + field];
  if (
    parent >= parent_field_view[37u]
    || parent_key_offset + parent * 4u + 4u
      > arrayLength(&parent_field_view)
  ) {
    fail(INVALID_PARENT, 18u);
    return;
  }
  let target_dense = parent_field_view[parent_key_offset + parent * 4u];
  if (
    target_dense >= params.coarse_grid_node_count
    || !scatter_to_gas_cell(target_dense, volume)
  ) {
    fail(INVALID_PARENT, 18u);
  }
}

@compute @workgroup_size(${SPH_SPATIAL_GAS_FREE_VOLUME_WORKGROUP_SIZE})
fn build_gas_free_volume(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x
    + workgroup_id.y * max(gas_directory[42u], 1u);
  let cell = linear_group * WORKGROUP_SIZE + local_id.x;
  if (!directory_ready()) {
    return;
  }
  if (cell >= gas_directory[18u]) { return; }
  let output = cell * ROW_WORDS;
  let authority_errors = atomicLoad(&output_control[3u]);
  if (authority_errors != 0u) {
    atomicStore(
      &output_rows[output + 3u],
      FAIL_CLOSED | authority_errors
    );
    return;
  }
  let key = params.directory_key_offset_words + cell * 5u;
  let chart = gas_directory[key];
  let level = decoded_order_key(gas_directory[key + 1u]);
  let x = decoded_order_key(gas_directory[key + 2u]);
  let y = decoded_order_key(gas_directory[key + 3u]);
  let z = decoded_order_key(gas_directory[key + 4u]);
  let target_dense = dense_node_for_cell(x, y, z);
  if (
    chart != params.chart_id
    || level != params.selected_level
    || target_dense == 0xffffffffu
  ) {
    atomicStore(
      &output_rows[output + 3u],
      FAIL_CLOSED | INVALID_GEOMETRY
    );
    fail(INVALID_GEOMETRY, 19u);
    return;
  }
  let cell_min = vec3<f32>(f32(x), f32(y), f32(z)) * params.grid_spacing_m;
  let cell_max = cell_min + vec3<f32>(params.grid_spacing_m);
  let overlap = max(
    vec3<f32>(0.0),
    min(cell_max, vec3<f32>(
      params.box_max_x, params.box_max_y, params.box_max_z
    )) - max(cell_min, vec3<f32>(
      params.box_min_x, params.box_min_y, params.box_min_z
    ))
  );
  let geometric = overlap.x * overlap.y * overlap.z;
  let condensed = bitcast<f32>(atomicLoad(&output_rows[output + 1u]));
  if (!finite_f32(geometric) || !finite_f32(condensed) || condensed < 0.0) {
    atomicStore(
      &output_rows[output + 3u],
      FAIL_CLOSED | NONFINITE_VOLUME
    );
    fail(NONFINITE_VOLUME, 21u);
    return;
  }
  if (!(geometric > 0.0)) {
    atomicStore(
      &output_rows[output + 3u],
      FAIL_CLOSED | INVALID_GEOMETRY
    );
    fail(INVALID_GEOMETRY, 19u);
    return;
  }
  let tolerance = max(
    params.overfill_tolerance_absolute_m3,
    geometric * params.overfill_tolerance_relative
  );
  if (condensed > geometric + tolerance) {
    atomicStore(&output_rows[output + 3u], FAIL_CLOSED | OVERFILLED);
    fail(OVERFILLED, 20u);
    return;
  }
  atomicStore(&output_rows[output], bitcast<u32>(geometric));
  atomicStore(&output_rows[output + 1u], bitcast<u32>(condensed));
  atomicStore(
    &output_rows[output + 2u],
    bitcast<u32>(max(0.0, geometric - condensed))
  );
  atomicStore(&output_rows[output + 3u], READY | ADMITTED);
  atomicAdd(&output_control[15u], 1u);
}

@compute @workgroup_size(1)
fn finalize_gas_free_volume() {
  let directory_ok = directory_ready();
  let cell_count = select(0u, gas_directory[18u], directory_ok);
  let completed = atomicLoad(&output_control[15u]);
  atomicStore(&output_control[0u], OUTPUT_MAGIC);
  atomicStore(&output_control[1u], OUTPUT_VERSION);
  atomicStore(&output_control[4u], params.generation_id);
  atomicStore(&output_control[5u], params.source_generation);
  atomicStore(&output_control[6u], params.directory_generation);
  atomicStore(&output_control[7u], params.storage_generation);
  atomicStore(&output_control[8u], params.cell_capacity);
  atomicStore(&output_control[9u], ROW_WORDS);
  atomicStore(&output_control[10u], params.exact_level_count);
  atomicStore(&output_control[11u], bitcast<u32>(params.selected_level));
  atomicStore(&output_control[12u], params.fine_moment_generation);
  atomicStore(&output_control[13u], params.coarse_moment_generation);
  atomicStore(&output_control[14u], params.parent_completion_ordinal);
  atomicStore(&output_control[22u], cell_count);
  atomicStore(&output_control[23u], 0u);
  atomicStore(&output_control[24u], gas_directory[42u]);
  atomicStore(&output_control[25u], gas_directory[43u]);
  atomicStore(&output_control[26u], gas_directory[44u]);
  atomicStore(&output_control[27u], REDUCTION_VERSION);
  atomicStore(&output_control[28u], params.fine_scatter_dispatch_x);
  atomicStore(&output_control[29u], params.fine_scatter_dispatch_y);
  atomicStore(&output_control[30u], params.coarse_scatter_dispatch_x);
  atomicStore(&output_control[31u], params.coarse_scatter_dispatch_y);
  atomicStore(&output_control[32u], params.keyed_lookup_max_steps);
  if (!directory_ok || completed != cell_count || atomicLoad(&output_control[3u]) != 0u) {
    if (completed != cell_count) {
      atomicOr(&output_control[3u], COUNT_MISMATCH);
    }
    atomicStore(&output_control[2u], FAIL_CLOSED | atomicLoad(&output_control[3u]));
  } else {
    atomicStore(&output_control[2u], READY | ADMITTED);
  }
}
`;
}
