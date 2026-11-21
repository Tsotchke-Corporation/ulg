import {
  SPH_SPATIAL_GAS_FREE_VOLUME_AEROSOL_VERSION,
  SPH_SPATIAL_GAS_FREE_VOLUME_MAGIC,
  SPH_SPATIAL_GAS_FREE_VOLUME_MINIMUM_GAS_FRACTION,
  SPH_SPATIAL_GAS_FREE_VOLUME_ROW_WORDS,
  SPH_SPATIAL_GAS_FREE_VOLUME_STATUS,
  SPH_SPATIAL_GAS_FREE_VOLUME_VERSION,
  SPH_SPATIAL_GAS_FREE_VOLUME_WORKGROUP_SIZE
} from './sphSpatialGasFreeVolume.js';
import {
  schroederQuadraticControlVolumeProjectionWgsl
} from './schroederQuadraticControlVolumeProjectionWgsl.js';
import {
  SCHROEDER_QUADRATIC_CONTROL_VOLUME_PROJECTION_VERSION
} from './schroederQuadraticControlVolumeProjection.js';
import {
  SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS
} from './schroederSpatialScaleAtlas.js';

const u32 = (value) => `${Number(value) >>> 0}u`;

export function createSphSpatialGasFreeVolumeWgsl(layout, { aerosols = false } = {}) {
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
  projection_version: u32,
  control_volume_geometry_seal: u32,
  lower_x_cell: i32,
  lower_x_fraction: f32,
  upper_x_cell: i32,
  upper_x_fraction: f32,
  lower_y_cell: i32,
  lower_y_fraction: f32,
  upper_y_cell: i32,
  upper_y_fraction: f32,
  lower_z_cell: i32,
  lower_z_fraction: f32,
  upper_z_cell: i32,
  upper_z_fraction: f32,
  aerosol_enabled: u32,
  aerosol_family_id: u32,
  aerosol_generation: u32,
  aerosol_capacity: u32,
  aerosol_version: u32,
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
${aerosols ? /* wgsl */ `
struct AerosolGeometry {
  fine_nx: u32,
  fine_ny: u32,
  fine_nz: u32,
  fine_grid_shift: i32,
  levels: array<vec4<i32>,${SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS}>,
};
@group(0) @binding(9) var<storage, read> aerosol_parcels: array<u32>;
@group(0) @binding(10) var<uniform> aerosol_geometry: AerosolGeometry;
` : ''}

const OUTPUT_MAGIC: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_MAGIC)};
const OUTPUT_VERSION: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_VERSION)};
const REDUCTION_VERSION: u32 = 3u;
const PROJECTION_VERSION: u32 = ${u32(SCHROEDER_QUADRATIC_CONTROL_VOLUME_PROJECTION_VERSION)};
const ROW_WORDS: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_ROW_WORDS)};
const WORKGROUP_SIZE: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_WORKGROUP_SIZE)};
const AEROSOL_VERSION: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_AEROSOL_VERSION)};
const INVALID_AEROSOL: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.INVALID_AEROSOL)};
const READY: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.READY)};
const ADMITTED: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.ADMITTED)};
const FAIL_CLOSED: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.FAIL_CLOSED)};
const INVALID_DIRECTORY: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.INVALID_DIRECTORY)};
const INVALID_MOMENT: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.INVALID_MOMENT)};
const INVALID_PARENT: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.INVALID_PARENT)};
const INVALID_GEOMETRY: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.INVALID_GEOMETRY)};
const OVERFILLED: u32 = ${u32(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.OVERFILLED)};
const MINIMUM_GAS_FRACTION: f32 = ${SPH_SPATIAL_GAS_FREE_VOLUME_MINIMUM_GAS_FRACTION};
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

${schroederQuadraticControlVolumeProjectionWgsl}

fn finite_f32(value: f32) -> bool {
  return (bitcast<u32>(value) & 0x7f800000u) != 0x7f800000u;
}

fn control_volume_geometry_ready() -> bool {
  if (params.projection_version != PROJECTION_VERSION
    || !finite_f32(params.grid_spacing_m) || !(params.grid_spacing_m > 0.0)) {
    return false;
  }
  let bounds = array<u32, 12>(
    bitcast<u32>(params.lower_x_cell), bitcast<u32>(params.lower_x_fraction),
    bitcast<u32>(params.upper_x_cell), bitcast<u32>(params.upper_x_fraction),
    bitcast<u32>(params.lower_y_cell), bitcast<u32>(params.lower_y_fraction),
    bitcast<u32>(params.upper_y_cell), bitcast<u32>(params.upper_y_fraction),
    bitcast<u32>(params.lower_z_cell), bitcast<u32>(params.lower_z_fraction),
    bitcast<u32>(params.upper_z_cell), bitcast<u32>(params.upper_z_fraction));
  return params.control_volume_geometry_seal == qcv_descriptor_seal(
      params.projection_version, params.grid_spacing_m,
      vec3<i32>(-params.grid_shift), vec3<u32>(params.nx, params.ny, params.nz),
      params.nx * params.ny * params.nz, params.chart_id, params.selected_level,
      bounds)
    && qcv_primal_axis_extent(params.lower_x_cell, params.lower_x_cell,
      params.lower_x_fraction, params.upper_x_cell, params.upper_x_fraction) > 0.0
    && qcv_primal_axis_extent(params.lower_y_cell, params.lower_y_cell,
      params.lower_y_fraction, params.upper_y_cell, params.upper_y_fraction) > 0.0
    && qcv_primal_axis_extent(params.lower_z_cell, params.lower_z_cell,
      params.lower_z_fraction, params.upper_z_cell, params.upper_z_fraction) > 0.0;
}

fn decoded_order_key(value: u32) -> i32 {
  return bitcast<i32>(value ^ 0x80000000u);
}

fn coordinate_for_dense_node(dense: u32) -> vec3<i32> {
  let yz = params.ny * params.nz;
  let x = dense / yz;
  let remainder = dense - x * yz;
  let y = remainder / params.nz;
  let z = remainder - y * params.nz;
  return vec3<i32>(i32(x), i32(y), i32(z)) - vec3<i32>(params.grid_shift);
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

fn directory_cell_order(cell: u32, sought_cell: vec3<i32>) -> i32 {
  let base = params.directory_key_offset_words + cell * 5u;
  let chart = gas_directory[base];
  if (chart < params.chart_id) { return -1; }
  if (chart > params.chart_id) { return 1; }
  let level = decoded_order_key(gas_directory[base + 1u]);
  if (level < params.selected_level) { return -1; }
  if (level > params.selected_level) { return 1; }
  let x = decoded_order_key(gas_directory[base + 2u]);
  if (x < sought_cell.x) { return -1; }
  if (x > sought_cell.x) { return 1; }
  let y = decoded_order_key(gas_directory[base + 3u]);
  if (y < sought_cell.y) { return -1; }
  if (y > sought_cell.y) { return 1; }
  let z = decoded_order_key(gas_directory[base + 4u]);
  if (z < sought_cell.z) { return -1; }
  if (z > sought_cell.z) { return 1; }
  return 0;
}

fn find_gas_cell(sought_cell: vec3<i32>) -> u32 {
  var low = 0u;
  var high = gas_directory[18u];
  var steps = 0u;
  loop {
    if (low >= high || steps >= params.keyed_lookup_max_steps) { break; }
    let middle = low + (high - low) / 2u;
    if (directory_cell_order(middle, sought_cell) < 0) {
      low = middle + 1u;
    } else {
      high = middle;
    }
    steps = steps + 1u;
  }
  if (
    low < gas_directory[18u]
    && directory_cell_order(low, sought_cell) == 0
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
  if (!finite_f32(contribution) || contribution < 0.0) { return false; }
  if (contribution == 0.0) { return true; }
  let node = coordinate_for_dense_node(target_dense);
  let x = qcv_axis_projection(node.x, params.lower_x_cell,
    params.lower_x_fraction, params.upper_x_cell, params.upper_x_fraction);
  let y = qcv_axis_projection(node.y, params.lower_y_cell,
    params.lower_y_fraction, params.upper_y_cell, params.upper_y_fraction);
  let z = qcv_axis_projection(node.z, params.lower_z_cell,
    params.lower_z_fraction, params.upper_z_cell, params.upper_z_fraction);
  if (x.valid == 0u || y.valid == 0u || z.valid == 0u
    || !(x.capacity > 0.0) || !(y.capacity > 0.0) || !(z.capacity > 0.0)) {
    fail(INVALID_GEOMETRY, 19u);
    return false;
  }
  // W is conservative over every primal target. Absent sparse gas keys are
  // ambient support: omit them without renormalizing the remaining weights.
  for (var ix = 0u; ix < 2u; ix = ix + 1u) {
    let wx = select(x.weight0, x.weight1, ix == 1u);
    if (wx == 0.0) { continue; }
    for (var iy = 0u; iy < 2u; iy = iy + 1u) {
      let wy = select(y.weight0, y.weight1, iy == 1u);
      if (wy == 0.0) { continue; }
      for (var iz = 0u; iz < 2u; iz = iz + 1u) {
        let wz = select(z.weight0, z.weight1, iz == 1u);
        if (wz == 0.0) { continue; }
        let sought_cell = vec3<i32>(select(x.cell0, x.cell1, ix == 1u),
          select(y.cell0, y.cell1, iy == 1u),
          select(z.cell0, z.cell1, iz == 1u));
        let cell = find_gas_cell(sought_cell);
        if (cell != 0xffffffffu
          && !atomic_add_condensed(cell, contribution * wx * wy * wz)) {
          return false;
        }
      }
    }
  }
  return true;
}

@compute @workgroup_size(1)
fn validate_gas_free_volume_authority() {
  if ((params.aerosol_enabled == 0u && (params.aerosol_family_id != 0u
      || params.aerosol_generation != 0u || params.aerosol_capacity != 0u
      || params.aerosol_version != 0u))
    || (params.aerosol_enabled != 0u && (params.aerosol_enabled != 1u
      || params.aerosol_family_id == 0u || params.aerosol_capacity == 0u
      || params.aerosol_version != AEROSOL_VERSION))) {
    fail(INVALID_AEROSOL, 41u);
    return;
  }
  if (!control_volume_geometry_ready()) {
    fail(INVALID_GEOMETRY, 19u);
    return;
  }
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

${aerosols ? /* wgsl */ `
// This is the same quadratic B used by the phase-volume moment producer.
// Independent droplets are not mechanics fields: project their occupied
// m/rho directly through B, geometric adjacent-level A (when present), and W.
fn aerosol_quadratic_weight(fraction: f32, ordinal: u32) -> f32 {
  if (ordinal == 0u) {
    let value = 1.5 - fraction;
    return 0.5 * value * value;
  }
  if (ordinal == 1u) {
    let value = fraction - 1.0;
    return 0.75 - value * value;
  }
  let value = fraction - 0.5;
  return 0.5 * value * value;
}

// Compose every adjacent geometric A. Each axis retains at most two
// neighboring nodes; positive support is checked at every intermediate grid.
fn aerosol_chain_geometry_ready() -> bool {
  if(params.exact_level_count<1u || params.exact_level_count>${SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS}u){return false;}
  if(params.exact_level_count<=2u){return true;}
  if(any(aerosol_geometry.levels[0]!=vec4<i32>(i32(aerosol_geometry.fine_nx),
    i32(aerosol_geometry.fine_ny),i32(aerosol_geometry.fine_nz),aerosol_geometry.fine_grid_shift))){return false;}
  let last=aerosol_geometry.levels[params.exact_level_count-1u];
  if(any(last!=vec4<i32>(i32(params.nx),i32(params.ny),i32(params.nz),params.grid_shift))){return false;}
  var spacing=params.fine_grid_spacing_m;
  for(var level=1u;level<params.exact_level_count;level++){
    if(any(aerosol_geometry.levels[level].xyz<=vec3<i32>(0))){return false;}spacing*=2.0;
  }
  return spacing==params.grid_spacing_m;
}
fn aerosol_project_adjacent_chain(node:vec3<i32>,volume:f32)->bool {
  var lower=node;var upper_weight=vec3<f32>(0.0);
  for(var level=1u;level<params.exact_level_count;level++){
    let next_lower=vec3<i32>(floor(vec3<f32>(lower)*0.5));
    var next_upper_weight=vec3<f32>(0.0);
    for(var side=0;side<2;side++){
      let coordinate=vec3<f32>(lower+vec3<i32>(side))*0.5;
      let base=floor(coordinate);let fraction=coordinate-base;
      let weight=select(vec3<f32>(1.0)-upper_weight,upper_weight,side==1);
      // base is next_lower or next_lower+1. Accumulate the exact adjacent
      // interpolation contribution into the latter, retaining zero supports.
      next_upper_weight+=weight*select(fraction,vec3<f32>(1.0),base>vec3<f32>(next_lower));
    }
    lower=next_lower;upper_weight=next_upper_weight;
    let grid=aerosol_geometry.levels[level];
    for(var axis=0u;axis<3u;axis++){
      let low=lower[axis]+grid.w;
      if((upper_weight[axis]<1.0 && (low<0 || low>=grid[axis]))
        || (upper_weight[axis]>0.0 && (low+1<0 || low+1>=grid[axis]))){return false;}
    }
  }
  let indexed=lower+vec3<i32>(params.grid_shift);
  for(var corner=0u;corner<8u;corner++){
    let offset=vec3<u32>((corner>>2u)&1u,(corner>>1u)&1u,corner&1u);
    let weights=select(vec3<f32>(1.0)-upper_weight,upper_weight,offset==vec3<u32>(1u));
    let weight=weights.x*weights.y*weights.z;if(weight==0.0){continue;}
    let destination=indexed+vec3<i32>(offset);
    let dense=(u32(destination.x)*params.ny+u32(destination.y))*params.nz+u32(destination.z);
    if(!scatter_to_gas_cell(dense,volume*weight)){return false;}
  }
  return true;
}

fn aerosol_project_fine_node(node: vec3<i32>, volume: f32) -> bool {
  let indexed = node + vec3<i32>(aerosol_geometry.fine_grid_shift);
  if (any(indexed < vec3<i32>(0))
    || any(indexed >= vec3<i32>(i32(aerosol_geometry.fine_nx),
      i32(aerosol_geometry.fine_ny), i32(aerosol_geometry.fine_nz)))) {
    return false;
  }
  if (params.exact_level_count == 1u) {
    let dense = (u32(indexed.x) * params.ny + u32(indexed.y))
      * params.nz + u32(indexed.z);
    return scatter_to_gas_cell(dense, volume);
  }
  if(params.exact_level_count>2u){return aerosol_project_adjacent_chain(node,volume);}
  // Exact geometric A from the canonical 2:1 hierarchy. No invented material
  // key or CSR field is needed. Positive support outside the admitted coarse
  // grid is rejected, not clipped and redistributed among surviving nodes.
  let coarse_indexed = vec3<f32>(node) * 0.5 + f32(params.grid_shift);
  let base_f = floor(coarse_indexed);
  let base = vec3<i32>(base_f);
  let fraction = coarse_indexed - base_f;
  for (var corner = 0u; corner < 8u; corner = corner + 1u) {
    let offset = vec3<u32>((corner >> 2u) & 1u, (corner >> 1u) & 1u, corner & 1u);
    let weights = select(vec3<f32>(1.0) - fraction, fraction,
      offset == vec3<u32>(1u));
    let weight = weights.x * weights.y * weights.z;
    if (weight == 0.0) { continue; }
    let coarse = base + vec3<i32>(offset);
    if (any(coarse < vec3<i32>(0))
      || any(coarse >= vec3<i32>(i32(params.nx), i32(params.ny), i32(params.nz)))) {
      return false;
    }
    let dense = (u32(coarse.x) * params.ny + u32(coarse.y))
      * params.nz + u32(coarse.z);
    if (!scatter_to_gas_cell(dense, volume * weight)) { return false; }
  }
  return true;
}

@compute @workgroup_size(${SPH_SPATIAL_GAS_FREE_VOLUME_WORKGROUP_SIZE})
fn scatter_aerosol_condensed_volume(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(num_workgroups) groups: vec3<u32>
) {
  let slot = (workgroup_id.x + workgroup_id.y * groups.x
    + workgroup_id.z * groups.x * groups.y) * WORKGROUP_SIZE + local_id.x;
  if (slot >= params.aerosol_capacity) { return; }
  // Count every sparse slot once, including holes and failures. No invocation
  // resets counters; the producing encoder clears them before any dispatch.
  atomicAdd(&output_control[39u], 1u);
  if (atomicLoad(&output_control[3u]) != 0u) { return; }
  if (!aerosol_chain_geometry_ready() || params.aerosol_enabled != 1u || params.aerosol_version != AEROSOL_VERSION
    || params.aerosol_capacity > arrayLength(&aerosol_parcels) / 24u
    || aerosol_geometry.fine_nx * aerosol_geometry.fine_ny * aerosol_geometry.fine_nz
      != params.fine_grid_node_count
    || !finite_f32(params.fine_grid_spacing_m) || !(params.fine_grid_spacing_m > 0.0)
    || (params.exact_level_count == 1u && (aerosol_geometry.fine_nx != params.nx
      || aerosol_geometry.fine_ny != params.ny || aerosol_geometry.fine_nz != params.nz
      || aerosol_geometry.fine_grid_shift != params.grid_shift))
    || (params.exact_level_count == 2u
      && params.grid_spacing_m != 2.0 * params.fine_grid_spacing_m)) {
    fail(INVALID_AEROSOL, 41u);
    return;
  }
  let row = slot * 24u;
  let status = aerosol_parcels[row + 22u];
  if (status == 0u) {
    for (var lane = 0u; lane < 24u; lane = lane + 1u) {
      if (aerosol_parcels[row + lane] != 0u) {
        fail(INVALID_AEROSOL, 41u);
        return;
      }
    }
    return;
  }
  let mass = bitcast<f32>(aerosol_parcels[row + 3u]);
  let density = bitcast<f32>(aerosol_parcels[row + 9u]);
  let phase = aerosol_parcels[row + 13u];
  let source_kind = aerosol_parcels[row + 23u];
  let position = vec3<f32>(bitcast<f32>(aerosol_parcels[row]),
    bitcast<f32>(aerosol_parcels[row + 1u]), bitcast<f32>(aerosol_parcels[row + 2u]));
  if (status != 1u || !condensed_family(phase)
    || aerosol_parcels[row + 12u] == 0u || aerosol_parcels[row + 12u] > 0xffffffu
    || aerosol_parcels[row + 11u] != 0u
    || (source_kind != 1u && source_kind != 2u)
    || (source_kind == 1u && (aerosol_parcels[row + 18u] != 0xffffffffu
      || aerosol_parcels[row + 19u] != 0u))
    || (source_kind == 2u && aerosol_parcels[row + 18u] == 0xffffffffu)
    || (aerosol_parcels[row + 14u] | aerosol_parcels[row + 15u]) == 0u
    || (aerosol_parcels[row + 16u] | aerosol_parcels[row + 17u]) == 0u
    || (aerosol_parcels[row + 20u] | aerosol_parcels[row + 21u]) == 0u
    || !finite_f32(mass) || !(mass > 0.0)
    || !finite_f32(density) || !(density > 0.0)
    || !finite_f32(position.x) || !finite_f32(position.y) || !finite_f32(position.z)) {
    fail(INVALID_AEROSOL, 41u);
    return;
  }
  for (var lane = 4u; lane <= 10u; lane = lane + 1u) {
    let value = bitcast<f32>(aerosol_parcels[row + lane]);
    // Signed internal energy is reference-dependent and remains admissible.
    if (!finite_f32(value) || (lane >= 8u && !(value > 0.0))) {
      fail(INVALID_AEROSOL, 41u);
      return;
    }
  }
  let volume = mass / density;
  let grid_position = position * (1.0 / params.fine_grid_spacing_m);
  if (!finite_f32(volume) || !(volume > 0.0)
    || !finite_f32(grid_position.x) || !finite_f32(grid_position.y) || !finite_f32(grid_position.z)
    || any(abs(grid_position) > vec3<f32>(2147483000.0))) {
    fail(INVALID_AEROSOL, 41u);
    return;
  }
  let base_f = floor(grid_position - vec3<f32>(0.5));
  let base = vec3<i32>(base_f);
  let fraction = grid_position - base_f;
  atomicAdd(&output_control[40u], 1u);
  for (var stencil = 0u; stencil < 27u; stencil = stencil + 1u) {
    let offset = vec3<u32>(stencil / 9u, (stencil % 9u) / 3u, stencil % 3u);
    let weight = aerosol_quadratic_weight(fraction.x, offset.x)
      * aerosol_quadratic_weight(fraction.y, offset.y)
      * aerosol_quadratic_weight(fraction.z, offset.z);
    if (weight == 0.0) { continue; }
    if (!aerosol_project_fine_node(base + vec3<i32>(offset), volume * weight)) {
      fail(INVALID_AEROSOL, 41u);
      return;
    }
  }
}
` : ''}

@compute @workgroup_size(${SPH_SPATIAL_GAS_FREE_VOLUME_WORKGROUP_SIZE})
fn build_gas_free_volume(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(num_workgroups) num_workgroups: vec3<u32>
) {
  // A1: the directory's staged consumer dispatch (words 42..44, written with
  // the indirect arguments) admits exactly the groups the indirect launch
  // runs, so a direct launch over a cell-capacity ceiling is equivalent.
  let linear_group = workgroup_id.x
    + workgroup_id.y * num_workgroups.x
    + workgroup_id.z * num_workgroups.x * num_workgroups.y;
  if (
    gas_directory[44u] == 0u
    || linear_group >= gas_directory[42u] * gas_directory[43u]
  ) {
    return;
  }
  let cell = linear_group * WORKGROUP_SIZE + local_id.x;
  if (!directory_ready()) {
    return;
  }
  if (cell >= gas_directory[18u]) { return; }
  let output = cell * ROW_WORDS;
  if (params.aerosol_enabled != 0u
    && atomicLoad(&output_control[39u]) != params.aerosol_capacity) {
    fail(INVALID_AEROSOL | COUNT_MISMATCH, 41u);
  }
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
  if (
    chart != params.chart_id
    || level != params.selected_level
  ) {
    atomicStore(
      &output_rows[output + 3u],
      FAIL_CLOSED | INVALID_GEOMETRY
    );
    fail(INVALID_GEOMETRY, 19u);
    return;
  }
  let overlap = vec3<f32>(
    qcv_primal_axis_extent(x, params.lower_x_cell,
      params.lower_x_fraction, params.upper_x_cell, params.upper_x_fraction),
    qcv_primal_axis_extent(y, params.lower_y_cell,
      params.lower_y_fraction, params.upper_y_cell, params.upper_y_fraction),
    qcv_primal_axis_extent(z, params.lower_z_cell,
      params.lower_z_fraction, params.upper_z_cell, params.upper_z_fraction)
  ) * params.grid_spacing_m;
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
  // Minimum gas volume fraction: the condensed share is capped so the gas
  // keeps MINIMUM_GAS_FRACTION of the cell (see the constant's declaration).
  // Overlap beyond the f32 tolerance is counted (word 20) as evidence, not
  // rejected. The row stays exact: free == geometric - condensed_effective.
  let tolerance = max(
    params.overfill_tolerance_absolute_m3,
    geometric * params.overfill_tolerance_relative
  );
  if (condensed > geometric + tolerance) {
    atomicAdd(&output_control[20u], 1u);
  }
  let condensed_effective = min(
    condensed,
    geometric * (1.0 - MINIMUM_GAS_FRACTION)
  );
  atomicStore(&output_rows[output], bitcast<u32>(geometric));
  atomicStore(&output_rows[output + 1u], bitcast<u32>(condensed_effective));
  atomicStore(
    &output_rows[output + 2u],
    bitcast<u32>(geometric - condensed_effective)
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
  atomicStore(&output_control[33u], params.projection_version);
  atomicStore(&output_control[34u], params.control_volume_geometry_seal);
  atomicStore(&output_control[35u], params.aerosol_enabled);
  atomicStore(&output_control[36u], params.aerosol_family_id);
  atomicStore(&output_control[37u], params.aerosol_generation);
  atomicStore(&output_control[38u], params.aerosol_capacity);
  atomicStore(&output_control[42u], params.aerosol_version);
  if (params.aerosol_enabled != 0u
    && atomicLoad(&output_control[39u]) != params.aerosol_capacity) {
    fail(INVALID_AEROSOL | COUNT_MISMATCH, 41u);
  }
  if (!directory_ok || completed != cell_count || atomicLoad(&output_control[3u]) != 0u) {
    if (completed != cell_count) {
      atomicOr(&output_control[3u], COUNT_MISMATCH);
    }
    atomicStore(&output_control[2u], FAIL_CLOSED | atomicLoad(&output_control[3u]));
  } else {
    atomicStore(&output_control[2u], READY | ADMITTED);
    if (params.aerosol_enabled == 1u) {
      atomicStore(&output_control[43u], params.generation_id);
    }
  }
}
`;
}
