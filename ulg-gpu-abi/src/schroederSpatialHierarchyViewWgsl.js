export const schroederSpatialHierarchyViewWgsl = /* wgsl */ `
struct SchroederSpatialHierarchyViewParams {
  fine_grid_node_count: u32,
  coarse_grid_node_count: u32,
  fine_nx: u32,
  fine_ny: u32,
  fine_nz: u32,
  coarse_nx: u32,
  coarse_ny: u32,
  coarse_nz: u32,
  fine_shift: i32,
  coarse_shift: i32,
  fine_level: i32,
  coarse_level: i32,
  fine_spacing_m: f32,
  coarse_spacing_m: f32,
  weight_tolerance: f32,
  first_moment_tolerance_m: f32,
  fine_node_capacity: u32,
  coarse_node_capacity: u32,
  edge_capacity: u32,
  child_edge_capacity: u32,
  coarse_occupancy_word_count: u32,
  fine_node_offset_words: u32,
  coarse_node_offset_words: u32,
  edge_count_offset_words: u32,
  edge_offset_offset_words: u32,
  edge_parent_offset_words: u32,
  edge_weight_offset_words: u32,
  parent_of_fine_offset_words: u32,
  child_count_offset_words: u32,
  child_offset_offset_words: u32,
  child_index_offset_words: u32,
  required_words: u32,
  capacity_words: u32,
  generation_id: u32,
  device_ordinal: u32,
  lane_ordinal: u32,
  lease_token: u32,
  source_family_id: u32,
  storage_generation: u32,
  physics_tick: u32,
  physics_substep: u32,
  position_epoch: u32,
  topology_epoch: u32,
  chart_epoch: u32,
  level_epoch: u32,
  support_epoch: u32,
  completion_ordinal: u32,
  fine_mechanics_completion_ordinal: u32,
  coarse_mechanics_completion_ordinal: u32,
  workgroup_size: u32,
  cleared_words: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  pad3: u32,
  pad4: u32,
  pad5: u32,
  pad6: u32,
  pad7: u32,
  pad8: u32,
  pad9: u32,
  pad10: u32,
  pad11: u32,
};

@group(0) @binding(0) var<storage, read> fine_mechanics_view: array<u32>;
@group(0) @binding(1) var<storage, read> coarse_mechanics_view: array<u32>;
@group(0) @binding(2) var<storage, read_write> coarse_occupancy: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> coarse_occupancy_counts: array<u32>;
@group(0) @binding(4) var<storage, read> coarse_occupancy_offsets: array<u32>;
@group(0) @binding(5) var<storage, read_write> fine_edge_counts: array<u32>;
@group(0) @binding(6) var<storage, read> fine_edge_offsets: array<u32>;
@group(0) @binding(7) var<storage, read_write> child_counts: array<atomic<u32>>;
@group(0) @binding(8) var<storage, read> child_offsets: array<u32>;
@group(0) @binding(9) var<storage, read_write> child_cursors: array<atomic<u32>>;
@group(0) @binding(10) var<storage, read_write> hierarchy_view: array<atomic<u32>>;
@group(0) @binding(11) var<uniform> params: SchroederSpatialHierarchyViewParams;

const MECHANICS_HEADER_OFFSET: u32 = 20u;
const MECHANICS_NODE_OFFSET: u32 = 64u;
const MECHANICS_MAGIC: u32 = 0x534d5631u;
const MECHANICS_VERSION: u32 = 1u;
const MECHANICS_READY_ADMITTED: u32 = 3u;
const HIERARCHY_MAGIC: u32 = 0x53485631u;
const HIERARCHY_VERSION: u32 = 1u;
const HIERARCHY_READY: u32 = 1u;
const HIERARCHY_ADMITTED: u32 = 2u;
const HIERARCHY_FAIL_CLOSED: u32 = 4u;
const HIERARCHY_INVALID_SOURCE: u32 = 8u;
const HIERARCHY_CAPACITY_OVERFLOW: u32 = 16u;
const HIERARCHY_LEVEL_CONTRACT: u32 = 32u;
const HIERARCHY_CLIPPED_SUPPORT: u32 = 64u;

fn mechanics_word(view: ptr<storage, array<u32>, read>, column: u32) -> u32 {
  return (*view)[MECHANICS_HEADER_OFFSET + column];
}

fn fine_view_admitted() -> bool {
  return arrayLength(&fine_mechanics_view) >= MECHANICS_NODE_OFFSET
    && mechanics_word(&fine_mechanics_view, 0u) == MECHANICS_MAGIC
    && mechanics_word(&fine_mechanics_view, 1u) == MECHANICS_VERSION
    && (mechanics_word(&fine_mechanics_view, 2u) & MECHANICS_READY_ADMITTED)
      == MECHANICS_READY_ADMITTED
    && mechanics_word(&fine_mechanics_view, 3u) == params.generation_id
    && bitcast<i32>(mechanics_word(&fine_mechanics_view, 17u)) == params.fine_level
    && mechanics_word(&fine_mechanics_view, 18u) == params.fine_grid_node_count
    && mechanics_word(&fine_mechanics_view, 19u) == params.fine_nx
    && mechanics_word(&fine_mechanics_view, 20u) == params.fine_ny
    && mechanics_word(&fine_mechanics_view, 21u) == params.fine_nz
    && mechanics_word(&fine_mechanics_view, 22u) == u32(params.fine_shift)
    && mechanics_word(&fine_mechanics_view, 23u) == bitcast<u32>(params.fine_spacing_m)
    && mechanics_word(&fine_mechanics_view, 32u)
      == params.fine_mechanics_completion_ordinal;
}

fn coarse_view_admitted() -> bool {
  return arrayLength(&coarse_mechanics_view) >= MECHANICS_NODE_OFFSET
    && mechanics_word(&coarse_mechanics_view, 0u) == MECHANICS_MAGIC
    && mechanics_word(&coarse_mechanics_view, 1u) == MECHANICS_VERSION
    && (mechanics_word(&coarse_mechanics_view, 2u) & MECHANICS_READY_ADMITTED)
      == MECHANICS_READY_ADMITTED
    && mechanics_word(&coarse_mechanics_view, 3u) == params.generation_id
    && bitcast<i32>(mechanics_word(&coarse_mechanics_view, 17u)) == params.coarse_level
    && mechanics_word(&coarse_mechanics_view, 18u) == params.coarse_grid_node_count
    && mechanics_word(&coarse_mechanics_view, 19u) == params.coarse_nx
    && mechanics_word(&coarse_mechanics_view, 20u) == params.coarse_ny
    && mechanics_word(&coarse_mechanics_view, 21u) == params.coarse_nz
    && mechanics_word(&coarse_mechanics_view, 22u) == u32(params.coarse_shift)
    && mechanics_word(&coarse_mechanics_view, 23u) == bitcast<u32>(params.coarse_spacing_m)
    && mechanics_word(&coarse_mechanics_view, 32u)
      == params.coarse_mechanics_completion_ordinal;
}

fn dense_coords(index: u32, ny: u32, nz: u32) -> vec3<i32> {
  let plane = ny * nz;
  let x = index / plane;
  let remainder = index - x * plane;
  return vec3<i32>(i32(x), i32(remainder / nz), i32(remainder % nz));
}

fn coarse_dense_index(coords: vec3<i32>) -> u32 {
  if (
    any(coords < vec3<i32>(0))
    || coords.x >= i32(params.coarse_nx)
    || coords.y >= i32(params.coarse_ny)
    || coords.z >= i32(params.coarse_nz)
  ) {
    return params.coarse_grid_node_count;
  }
  return (u32(coords.x) * params.coarse_ny + u32(coords.y))
    * params.coarse_nz + u32(coords.z);
}

fn floor_div2(value: i32) -> i32 {
  return select(-((-value + 1) / 2), value / 2, value >= 0);
}

fn mark_coarse_dense(dense_index: u32) {
  if (dense_index >= params.coarse_grid_node_count) {
    atomicAdd(&hierarchy_view[39u], 1u);
    return;
  }
  let word = dense_index >> 5u;
  let bit = dense_index & 31u;
  if (word >= params.coarse_occupancy_word_count) {
    atomicAdd(&hierarchy_view[39u], 1u);
    return;
  }
  atomicOr(&coarse_occupancy[word], 1u << bit);
}

fn fine_support(fine_dense_index: u32) -> mat4x3<f32> {
  let indexed = dense_coords(fine_dense_index, params.fine_ny, params.fine_nz);
  let logical = vec3<f32>(indexed - vec3<i32>(params.fine_shift));
  let coarse_indexed = logical * 0.5 + vec3<f32>(f32(params.coarse_shift));
  let base = vec3<i32>(floor(coarse_indexed));
  let fraction = coarse_indexed - vec3<f32>(base);
  return mat4x3<f32>(
    vec3<f32>(base),
    fraction,
    logical,
    coarse_indexed
  );
}

fn edge_weight(fraction: vec3<f32>, corner: vec3<u32>) -> f32 {
  let wx = select(1.0 - fraction.x, fraction.x, corner.x == 1u);
  let wy = select(1.0 - fraction.y, fraction.y, corner.y == 1u);
  let wz = select(1.0 - fraction.z, fraction.z, corner.z == 1u);
  return wx * wy * wz;
}

fn compact_coarse_index(dense_index: u32) -> u32 {
  if (dense_index >= params.coarse_grid_node_count) {
    return params.coarse_node_capacity;
  }
  let word = dense_index >> 5u;
  let bit = dense_index & 31u;
  let bits = atomicLoad(&coarse_occupancy[word]);
  if ((bits & (1u << bit)) == 0u) {
    return params.coarse_node_capacity;
  }
  let lower_mask = (1u << bit) - 1u;
  return coarse_occupancy_offsets[word] + countOneBits(bits & lower_mask);
}

@compute @workgroup_size(64)
fn mark_from_fine(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let fine_index = global_id.x;
  if (!fine_view_admitted()) {
    if (fine_index == 0u) { atomicAdd(&hierarchy_view[38u], 1u); }
    return;
  }
  let fine_count = mechanics_word(&fine_mechanics_view, 26u);
  if (fine_index >= fine_count) { return; }
  let fine_dense = fine_mechanics_view[MECHANICS_NODE_OFFSET + fine_index];
  if (fine_dense >= params.fine_grid_node_count) {
    atomicAdd(&hierarchy_view[38u], 1u);
    return;
  }
  let support = fine_support(fine_dense);
  let base = vec3<i32>(support[0]);
  let fraction = support[1];
  var valid_weight = 0.0;
  for (var corner_id = 0u; corner_id < 8u; corner_id = corner_id + 1u) {
    let corner = vec3<u32>(corner_id & 1u, (corner_id >> 1u) & 1u, (corner_id >> 2u) & 1u);
    let weight = edge_weight(fraction, corner);
    if (!(weight > 0.0)) { continue; }
    let dense = coarse_dense_index(base + vec3<i32>(corner));
    if (dense >= params.coarse_grid_node_count) {
      atomicAdd(&hierarchy_view[41u], 1u);
      continue;
    }
    valid_weight = valid_weight + weight;
    mark_coarse_dense(dense);
  }
  if (!(valid_weight > 0.0)) { atomicAdd(&hierarchy_view[38u], 1u); }
}

@compute @workgroup_size(64)
fn mark_from_coarse(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let coarse_index = global_id.x;
  if (!coarse_view_admitted()) {
    if (coarse_index == 0u) { atomicAdd(&hierarchy_view[39u], 1u); }
    return;
  }
  let coarse_count = mechanics_word(&coarse_mechanics_view, 26u);
  if (coarse_index >= coarse_count) { return; }
  mark_coarse_dense(coarse_mechanics_view[MECHANICS_NODE_OFFSET + coarse_index]);
}

@compute @workgroup_size(64)
fn count_coarse_occupancy(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let word = global_id.x;
  if (word >= params.coarse_occupancy_word_count) { return; }
  coarse_occupancy_counts[word] = countOneBits(atomicLoad(&coarse_occupancy[word]));
}

@compute @workgroup_size(64)
fn scatter_coarse_nodes(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let word = global_id.x;
  if (word >= params.coarse_occupancy_word_count) { return; }
  let bits = atomicLoad(&coarse_occupancy[word]);
  let destination_base = coarse_occupancy_offsets[word];
  var local_rank = 0u;
  for (var bit = 0u; bit < 32u; bit = bit + 1u) {
    if ((bits & (1u << bit)) == 0u) { continue; }
    let dense_index = word * 32u + bit;
    let destination = destination_base + local_rank;
    if (
      dense_index < params.coarse_grid_node_count
      && destination < params.coarse_node_capacity
      && params.coarse_node_offset_words + destination < arrayLength(&hierarchy_view)
    ) {
      atomicStore(
        &hierarchy_view[params.coarse_node_offset_words + destination],
        dense_index
      );
    } else {
      atomicAdd(&hierarchy_view[40u], 1u);
    }
    local_rank = local_rank + 1u;
  }
}

@compute @workgroup_size(64)
fn prepare_fine_edges(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let fine_index = global_id.x;
  let fine_count = select(0u, mechanics_word(&fine_mechanics_view, 26u), fine_view_admitted());
  if (fine_index >= params.fine_node_capacity) { return; }
  if (fine_index >= fine_count) {
    fine_edge_counts[fine_index] = 0u;
    return;
  }
  let fine_dense = fine_mechanics_view[MECHANICS_NODE_OFFSET + fine_index];
  if (fine_dense >= params.fine_grid_node_count) {
    fine_edge_counts[fine_index] = 0u;
    atomicAdd(&hierarchy_view[38u], 1u);
    return;
  }
  atomicStore(&hierarchy_view[params.fine_node_offset_words + fine_index], fine_dense);
  let support = fine_support(fine_dense);
  let base = vec3<i32>(support[0]);
  let fraction = support[1];
  var count = 0u;
  for (var corner_id = 0u; corner_id < 8u; corner_id = corner_id + 1u) {
    let corner = vec3<u32>(corner_id & 1u, (corner_id >> 1u) & 1u, (corner_id >> 2u) & 1u);
    let weight = edge_weight(fraction, corner);
    let dense = coarse_dense_index(base + vec3<i32>(corner));
    if (weight > 0.0 && dense < params.coarse_grid_node_count) { count = count + 1u; }
  }
  fine_edge_counts[fine_index] = count;
  atomicStore(&hierarchy_view[params.edge_count_offset_words + fine_index], count);
}

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= bitcast<f32>(0x7f7fffffu);
}

fn atomic_max_nonnegative_f32(destination: ptr<storage, atomic<u32>, read_write>, value: f32) {
  if (finite_f32(value) && value >= 0.0) {
    atomicMax(destination, bitcast<u32>(value));
  }
}

@compute @workgroup_size(64)
fn scatter_fine_edges_and_count_children(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let fine_index = global_id.x;
  let fine_count = select(0u, mechanics_word(&fine_mechanics_view, 26u), fine_view_admitted());
  if (fine_index >= fine_count) { return; }
  let fine_dense = fine_mechanics_view[MECHANICS_NODE_OFFSET + fine_index];
  let support = fine_support(fine_dense);
  let base = vec3<i32>(support[0]);
  let fraction = support[1];
  let fine_logical = support[2];
  var total_weight = 0.0;
  for (var corner_id = 0u; corner_id < 8u; corner_id = corner_id + 1u) {
    let corner = vec3<u32>(corner_id & 1u, (corner_id >> 1u) & 1u, (corner_id >> 2u) & 1u);
    let raw_weight = edge_weight(fraction, corner);
    let dense = coarse_dense_index(base + vec3<i32>(corner));
    if (raw_weight > 0.0 && dense < params.coarse_grid_node_count) {
      total_weight = total_weight + raw_weight;
    }
  }
  if (!(total_weight > 0.0) || !finite_f32(total_weight)) {
    atomicAdd(&hierarchy_view[38u], 1u);
    return;
  }
  let edge_base = fine_edge_offsets[fine_index];
  atomicStore(&hierarchy_view[params.edge_offset_offset_words + fine_index], edge_base);
  var local_edge = 0u;
  var normalized_sum = 0.0;
  var reproduced_position = vec3<f32>(0.0);
  for (var corner_id = 0u; corner_id < 8u; corner_id = corner_id + 1u) {
    let corner = vec3<u32>(corner_id & 1u, (corner_id >> 1u) & 1u, (corner_id >> 2u) & 1u);
    let raw_weight = edge_weight(fraction, corner);
    let coords = base + vec3<i32>(corner);
    let dense = coarse_dense_index(coords);
    if (!(raw_weight > 0.0) || dense >= params.coarse_grid_node_count) { continue; }
    let compact_parent = compact_coarse_index(dense);
    let edge_index = edge_base + local_edge;
    if (
      compact_parent >= params.coarse_node_capacity
      || edge_index >= params.edge_capacity
    ) {
      atomicAdd(&hierarchy_view[40u], 1u);
      return;
    }
    let weight = raw_weight / total_weight;
    atomicStore(&hierarchy_view[params.edge_parent_offset_words + edge_index], compact_parent);
    atomicStore(&hierarchy_view[params.edge_weight_offset_words + edge_index], bitcast<u32>(weight));
    normalized_sum = normalized_sum + weight;
    reproduced_position = reproduced_position
      + weight * vec3<f32>(coords - vec3<i32>(params.coarse_shift)) * params.coarse_spacing_m;
    local_edge = local_edge + 1u;
  }
  let fine_position = fine_logical * params.fine_spacing_m;
  atomic_max_nonnegative_f32(&hierarchy_view[42u], abs(normalized_sum - 1.0));
  atomic_max_nonnegative_f32(
    &hierarchy_view[43u],
    length(reproduced_position - fine_position)
  );
  let strict_logical = vec3<i32>(
    floor_div2(i32(fine_logical.x)),
    floor_div2(i32(fine_logical.y)),
    floor_div2(i32(fine_logical.z))
  );
  let strict_dense = coarse_dense_index(strict_logical + vec3<i32>(params.coarse_shift));
  let strict_parent = compact_coarse_index(strict_dense);
  if (strict_parent >= params.coarse_node_capacity) {
    atomicAdd(&hierarchy_view[38u], 1u);
    return;
  }
  atomicStore(&hierarchy_view[params.parent_of_fine_offset_words + fine_index], strict_parent);
  atomicAdd(&child_counts[strict_parent], 1u);
}

@compute @workgroup_size(64)
fn scatter_children(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let fine_index = global_id.x;
  let fine_count = select(0u, mechanics_word(&fine_mechanics_view, 26u), fine_view_admitted());
  if (fine_index >= fine_count) { return; }
  let parent = atomicLoad(&hierarchy_view[params.parent_of_fine_offset_words + fine_index]);
  if (parent >= params.coarse_node_capacity) {
    atomicAdd(&hierarchy_view[38u], 1u);
    return;
  }
  let local_index = atomicAdd(&child_cursors[parent], 1u);
  let destination = child_offsets[parent] + local_index;
  if (destination >= params.child_edge_capacity) {
    atomicAdd(&hierarchy_view[40u], 1u);
    return;
  }
  atomicStore(&hierarchy_view[params.child_index_offset_words + destination], fine_index);
  atomicStore(&hierarchy_view[params.child_count_offset_words + parent], atomicLoad(&child_counts[parent]));
  atomicStore(&hierarchy_view[params.child_offset_offset_words + parent], child_offsets[parent]);
}

@compute @workgroup_size(1)
fn finalize_hierarchy() {
  let fine_count = select(0u, mechanics_word(&fine_mechanics_view, 26u), fine_view_admitted());
  let occupancy_last = params.coarse_occupancy_word_count - 1u;
  let coarse_count = coarse_occupancy_offsets[occupancy_last]
    + coarse_occupancy_counts[occupancy_last];
  let edge_last = params.fine_node_capacity - 1u;
  let edge_count = fine_edge_offsets[edge_last] + fine_edge_counts[edge_last];
  let invalid_fine = atomicLoad(&hierarchy_view[38u]);
  let invalid_coarse = atomicLoad(&hierarchy_view[39u]);
  var overflow = atomicLoad(&hierarchy_view[40u]);
  let clipped = atomicLoad(&hierarchy_view[41u]);
  let weight_residual = bitcast<f32>(atomicLoad(&hierarchy_view[42u]));
  let first_moment_residual = bitcast<f32>(atomicLoad(&hierarchy_view[43u]));
  if (
    fine_count > params.fine_node_capacity
    || coarse_count > params.coarse_node_capacity
    || edge_count > params.edge_capacity
    || fine_count > params.child_edge_capacity
    || params.required_words > params.capacity_words
    || params.capacity_words > arrayLength(&hierarchy_view)
  ) {
    overflow = overflow + 1u;
  }
  let level_contract = params.coarse_level == params.fine_level + 1
    && bitcast<u32>(params.coarse_spacing_m)
      == bitcast<u32>(params.fine_spacing_m * 2.0);
  let residuals_admitted = finite_f32(weight_residual)
    && finite_f32(first_moment_residual)
    && weight_residual <= params.weight_tolerance
    && first_moment_residual <= params.first_moment_tolerance_m;
  let admitted = fine_view_admitted()
    && coarse_view_admitted()
    && level_contract
    && invalid_fine == 0u
    && invalid_coarse == 0u
    && overflow == 0u
    && clipped == 0u
    && residuals_admitted;
  var status = HIERARCHY_READY | HIERARCHY_ADMITTED;
  if (!admitted) {
    status = HIERARCHY_FAIL_CLOSED;
    if (invalid_fine != 0u || invalid_coarse != 0u || !residuals_admitted) {
      status = status | HIERARCHY_INVALID_SOURCE;
    }
    if (overflow != 0u) { status = status | HIERARCHY_CAPACITY_OVERFLOW; }
    if (!level_contract) { status = status | HIERARCHY_LEVEL_CONTRACT; }
    if (clipped != 0u) { status = status | HIERARCHY_CLIPPED_SUPPORT; }
  }
  let dispatch_x = select(
    0u,
    (coarse_count + max(params.workgroup_size, 1u) - 1u)
      / max(params.workgroup_size, 1u),
    admitted && coarse_count > 0u
  );
  atomicStore(&hierarchy_view[0u], HIERARCHY_MAGIC);
  atomicStore(&hierarchy_view[1u], HIERARCHY_VERSION);
  atomicStore(&hierarchy_view[2u], status);
  atomicStore(&hierarchy_view[3u], params.generation_id);
  atomicStore(&hierarchy_view[4u], params.device_ordinal);
  atomicStore(&hierarchy_view[5u], params.lane_ordinal);
  atomicStore(&hierarchy_view[6u], params.lease_token);
  atomicStore(&hierarchy_view[7u], params.source_family_id);
  atomicStore(&hierarchy_view[8u], params.storage_generation);
  atomicStore(&hierarchy_view[9u], params.physics_tick);
  atomicStore(&hierarchy_view[10u], params.physics_substep);
  atomicStore(&hierarchy_view[11u], params.position_epoch);
  atomicStore(&hierarchy_view[12u], params.topology_epoch);
  atomicStore(&hierarchy_view[13u], params.chart_epoch);
  atomicStore(&hierarchy_view[14u], params.level_epoch);
  atomicStore(&hierarchy_view[15u], params.support_epoch);
  atomicStore(&hierarchy_view[16u], bitcast<u32>(params.fine_level));
  atomicStore(&hierarchy_view[17u], bitcast<u32>(params.coarse_level));
  atomicStore(&hierarchy_view[18u], params.fine_grid_node_count);
  atomicStore(&hierarchy_view[19u], params.coarse_grid_node_count);
  atomicStore(&hierarchy_view[20u], params.fine_nx);
  atomicStore(&hierarchy_view[21u], params.fine_ny);
  atomicStore(&hierarchy_view[22u], params.fine_nz);
  atomicStore(&hierarchy_view[23u], params.coarse_nx);
  atomicStore(&hierarchy_view[24u], params.coarse_ny);
  atomicStore(&hierarchy_view[25u], params.coarse_nz);
  atomicStore(&hierarchy_view[26u], u32(params.fine_shift));
  atomicStore(&hierarchy_view[27u], u32(params.coarse_shift));
  atomicStore(&hierarchy_view[28u], bitcast<u32>(params.fine_spacing_m));
  atomicStore(&hierarchy_view[29u], bitcast<u32>(params.coarse_spacing_m));
  atomicStore(&hierarchy_view[30u], params.fine_node_capacity);
  atomicStore(&hierarchy_view[31u], params.coarse_node_capacity);
  atomicStore(&hierarchy_view[32u], params.edge_capacity);
  atomicStore(&hierarchy_view[33u], params.child_edge_capacity);
  atomicStore(&hierarchy_view[34u], select(0u, fine_count, admitted));
  atomicStore(&hierarchy_view[35u], select(0u, coarse_count, admitted));
  atomicStore(&hierarchy_view[36u], select(0u, edge_count, admitted));
  atomicStore(&hierarchy_view[37u], select(0u, fine_count, admitted));
  atomicStore(&hierarchy_view[38u], invalid_fine);
  atomicStore(&hierarchy_view[39u], invalid_coarse);
  atomicStore(&hierarchy_view[40u], overflow);
  atomicStore(&hierarchy_view[41u], clipped);
  atomicStore(&hierarchy_view[42u], bitcast<u32>(weight_residual));
  atomicStore(&hierarchy_view[43u], bitcast<u32>(first_moment_residual));
  atomicStore(&hierarchy_view[44u], params.completion_ordinal);
  atomicStore(&hierarchy_view[45u], params.generation_id);
  atomicStore(&hierarchy_view[46u], params.fine_mechanics_completion_ordinal);
  atomicStore(&hierarchy_view[47u], params.coarse_mechanics_completion_ordinal);
  atomicStore(&hierarchy_view[48u], params.fine_node_offset_words);
  atomicStore(&hierarchy_view[49u], params.coarse_node_offset_words);
  atomicStore(&hierarchy_view[50u], params.edge_count_offset_words);
  atomicStore(&hierarchy_view[51u], params.edge_offset_offset_words);
  atomicStore(&hierarchy_view[52u], params.edge_parent_offset_words);
  atomicStore(&hierarchy_view[53u], params.edge_weight_offset_words);
  atomicStore(&hierarchy_view[54u], params.parent_of_fine_offset_words);
  atomicStore(&hierarchy_view[55u], params.child_count_offset_words);
  atomicStore(&hierarchy_view[56u], params.child_offset_offset_words);
  atomicStore(&hierarchy_view[57u], params.child_index_offset_words);
  atomicStore(&hierarchy_view[58u], params.required_words);
  atomicStore(&hierarchy_view[59u], params.capacity_words);
  atomicStore(&hierarchy_view[60u], dispatch_x);
  atomicStore(&hierarchy_view[61u], select(0u, 1u, admitted && coarse_count > 0u));
  atomicStore(&hierarchy_view[62u], select(0u, 1u, admitted && coarse_count > 0u));
  atomicStore(&hierarchy_view[63u], params.cleared_words);
  atomicStore(
    &hierarchy_view[64u],
    select(
      0u,
      (fine_count + max(params.workgroup_size, 1u) - 1u)
        / max(params.workgroup_size, 1u),
      admitted && fine_count > 0u
    )
  );
  atomicStore(&hierarchy_view[65u], select(0u, 1u, admitted && fine_count > 0u));
  atomicStore(&hierarchy_view[66u], select(0u, 1u, admitted && fine_count > 0u));
  atomicStore(&hierarchy_view[67u], 0u);
  atomicStore(&hierarchy_view[params.edge_offset_offset_words + fine_count], edge_count);
  atomicStore(&hierarchy_view[params.child_offset_offset_words + coarse_count], fine_count);
}
`;
