import {
  schroederSpatialExactNearTraversalV1Wgsl
} from './schroederSpatialExactNearTraversalWgsl.js';
import {
  SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_MAGIC,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS
} from './sphReactionProductPlacementReceipt.js';
import {
  sphDispersedMediumOpticsWgsl
} from './sphDispersedMediumWgsl.js';

export {
  sphReactionStrictGateFinalizeWgsl
} from './sphReactionStrictGateWgsl.js';

export {
  schroederSpatialAggregateStacklessTraversalWgsl,
  schroederSpatialAggregateViewWgsl
} from './schroederSpatialAggregateViewWgsl.js';
export {
  SPH_REACTION_PRODUCT_PLACEMENT_CAPTURE_VALUE_ROWS,
  SPH_REACTION_PRODUCT_PLACEMENT_DIRECT_VALUE_ROWS,
  SPH_REACTION_PRODUCT_PLACEMENT_EVENT_PLAN_ROWS,
  SPH_REACTION_PRODUCT_PLACEMENT_LAW,
  SPH_REACTION_PRODUCT_PLACEMENT_SUMMARY_VALUE_ROWS,
  sphReactionProductPlacementCaptureApplyWgsl,
  sphReactionProductPlacementCaptureReduceWgsl,
  sphReactionProductPlacementDirectApplyWgsl,
  sphReactionProductPlacementDirectPlanWgsl,
  sphReactionProductPlacementDirectReduceWgsl,
  sphReactionProductPlacementEventApplyWgsl,
  sphReactionProductPlacementFinalizeWgsl,
  sphReactionProductPlacementPlanWgsl,
  sphReactionProductPlacementPreflightWgsl,
  sphReactionProductPlacementSummaryApplyWgsl,
  sphReactionProductPlacementSummaryReduceWgsl,
  sphReactionProductPlacementTransactionalAuxiliaryMaterializeWgsl,
  sphReactionProductPlacementTransactionalAuxiliaryPublishWgsl,
  sphReactionProductPlacementTransactionalDestinationRecoveryWgsl,
  sphReactionProductPlacementTransactionalPublishWgsl,
  sphReactionProductPlacementTransactionalTerminalWgsl
} from './sphReactionProductPlacementSegmentedWgsl.js';

export const commonWgsl = `
struct TensorDescriptor {
  offset_words: u32,
  length_words: u32,
  dtype: u32,
  tensor_layout: u32,
};

struct ClosureTableSample {
  axis: f32,
  value: f32,
  derivative: f32,
  _pad0: f32,
};

fn complex64_mul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(
    a.x * b.x - a.y * b.y,
    a.x * b.y + a.y * b.x
  );
}

fn complex64_norm2(value: vec2<f32>) -> f32 {
  return dot(value, value);
}
`;

export const carrierStepWgsl = `
${commonWgsl}

struct CarrierBody {
  x: f32,
  v: f32,
  mass: f32,
  _pad0: f32,
};

struct CarrierParams {
  dt: f32,
  sample_count: u32,
  step: u32,
  _pad0: u32,
};

@group(0) @binding(0) var<storage, read_write> bodies: array<CarrierBody>;
@group(0) @binding(1) var<storage, read> samples: array<ClosureTableSample>;
@group(0) @binding(2) var<uniform> params: CarrierParams;

fn sample_derivative(r: f32) -> f32 {
  if (params.sample_count <= 1u) {
    return 0.0;
  }
  var left_index = 0u;
  var right_index = params.sample_count - 1u;
  for (var index = 0u; index + 1u < params.sample_count; index = index + 1u) {
    let left = samples[index].axis;
    let right = samples[index + 1u].axis;
    if (r >= left && r <= right) {
      left_index = index;
      right_index = index + 1u;
      break;
    }
  }
  let left = samples[left_index];
  let right = samples[right_index];
  if (right.axis == left.axis) {
    return left.derivative;
  }
  let t = clamp((r - left.axis) / (right.axis - left.axis), 0.0, 1.0);
  return left.derivative + t * (right.derivative - left.derivative);
}

fn pair_forces(left_x: f32, right_x: f32) -> vec2<f32> {
  let dx = right_x - left_x;
  let r = abs(dx);
  var direction = 1.0;
  if (dx < 0.0) {
    direction = -1.0;
  }
  let dEdr = sample_derivative(r);
  return vec2<f32>(dEdr * direction, -dEdr * direction);
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x > 0u) {
    return;
  }
  let dt = params.dt;
  let first = pair_forces(bodies[0].x, bodies[1].x);
  var left_v = bodies[0].v + 0.5 * (first.x / bodies[0].mass) * dt;
  var right_v = bodies[1].v + 0.5 * (first.y / bodies[1].mass) * dt;
  bodies[0].x = bodies[0].x + left_v * dt;
  bodies[1].x = bodies[1].x + right_v * dt;
  let second = pair_forces(bodies[0].x, bodies[1].x);
  left_v = left_v + 0.5 * (second.x / bodies[0].mass) * dt;
  right_v = right_v + 0.5 * (second.y / bodies[1].mass) * dt;
  bodies[0].v = left_v;
  bodies[1].v = right_v;
}
`;

export const closureLawGraphEvalWgsl = `
${commonWgsl}

struct ClosureLawGraphNode {
  op_id: f32,
  input_slot: f32,
  output_slot: f32,
  derivative_slot: f32,
  sample_offset: f32,
  sample_count: f32,
  domain_min: f32,
  domain_max: f32,
  edge_offset: f32,
  edge_count: f32,
  interpolation_id: f32,
  status_flag_id: f32,
  provenance_index: f32,
  material_id: f32,
  phase_id: f32,
  _pad0: f32,
};

struct ClosureLawGraphEdge {
  source_slot: f32,
  destination_node: f32,
  unit_id: f32,
  sensitivity_tag: f32,
};

struct ClosureLawGraphSlot {
  value: f32,
  derivative: f32,
  status: f32,
  _pad0: f32,
};

struct ClosureLawGraphStatus {
  node_id: f32,
  status: f32,
  observed_input: f32,
  limit: f32,
};

struct ClosureLawGraphParams {
  node_count: u32,
  slot_count: u32,
  sample_count: u32,
  status_count: u32,
};

@group(0) @binding(0) var<storage, read> graph_nodes: array<ClosureLawGraphNode>;
@group(0) @binding(1) var<storage, read> graph_edges: array<ClosureLawGraphEdge>;
@group(0) @binding(2) var<storage, read> graph_samples: array<ClosureTableSample>;
@group(0) @binding(3) var<storage, read_write> graph_slots: array<ClosureLawGraphSlot>;
@group(0) @binding(4) var<storage, read_write> graph_status: array<ClosureLawGraphStatus>;
@group(0) @binding(5) var<uniform> graph_params: ClosureLawGraphParams;

fn graph_u32(value: f32) -> u32 {
  return u32(max(value, 0.0));
}

fn write_node_status(node_index: u32, status: f32, observed_input: f32, limit: f32) {
  if (node_index >= graph_params.status_count) {
    return;
  }
  graph_status[node_index].node_id = f32(node_index);
  graph_status[node_index].status = status;
  graph_status[node_index].observed_input = observed_input;
  graph_status[node_index].limit = limit;
}

fn sample_table_linear(node: ClosureLawGraphNode, x: f32) -> vec2<f32> {
  let offset = graph_u32(node.sample_offset);
  let count = graph_u32(node.sample_count);
  var left_index = offset;
  var right_index = offset + count - 1u;
  for (var index = offset; index + 1u < offset + count; index = index + 1u) {
    let left_axis = graph_samples[index].axis;
    let right_axis = graph_samples[index + 1u].axis;
    if (x >= left_axis && x <= right_axis) {
      left_index = index;
      right_index = index + 1u;
      break;
    }
  }
  let left = graph_samples[left_index];
  let right = graph_samples[right_index];
  if (right.axis == left.axis) {
    return vec2<f32>(left.value, left.derivative);
  }
  let t = clamp((x - left.axis) / (right.axis - left.axis), 0.0, 1.0);
  return vec2<f32>(
    left.value + t * (right.value - left.value),
    left.derivative + t * (right.derivative - left.derivative)
  );
}

fn sample_table_step(node: ClosureLawGraphNode, x: f32) -> vec2<f32> {
  let offset = graph_u32(node.sample_offset);
  let count = graph_u32(node.sample_count);
  var selected_index = offset;
  for (var index = offset; index < offset + count; index = index + 1u) {
    let axis = graph_samples[index].axis;
    if (x >= axis) {
      selected_index = index;
    } else {
      break;
    }
  }
  let selected = graph_samples[selected_index];
  return vec2<f32>(selected.value, 0.0);
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x > 0u) {
    return;
  }
  for (var node_index = 0u; node_index < graph_params.node_count; node_index = node_index + 1u) {
    let node = graph_nodes[node_index];
    let input_slot = graph_u32(node.input_slot);
    let output_slot = graph_u32(node.output_slot);
    let derivative_slot = graph_u32(node.derivative_slot);
    let sample_count = graph_u32(node.sample_count);
    let is_table_linear = node.op_id == 1.0;
    let is_table_step = node.op_id == 2.0;
    if ((!is_table_linear && !is_table_step) || (is_table_linear && sample_count < 2u) || (is_table_step && sample_count < 1u)) {
      write_node_status(node_index, 4.0, node.op_id, 0.0);
      continue;
    }
    if (input_slot >= graph_params.slot_count || output_slot >= graph_params.slot_count || derivative_slot >= graph_params.slot_count) {
      write_node_status(node_index, 4.0, f32(input_slot), 0.0);
      continue;
    }
    let x = graph_slots[input_slot].value;
    if (x < node.domain_min) {
      graph_slots[output_slot].status = 2.0;
      graph_slots[derivative_slot].status = 2.0;
      write_node_status(node_index, 2.0, x, node.domain_min);
      continue;
    }
    if (x > node.domain_max) {
      graph_slots[output_slot].status = 3.0;
      graph_slots[derivative_slot].status = 3.0;
      write_node_status(node_index, 3.0, x, node.domain_max);
      continue;
    }
    var sampled = vec2<f32>(0.0, 0.0);
    if (is_table_step) {
      sampled = sample_table_step(node, x);
    } else {
      sampled = sample_table_linear(node, x);
    }
    graph_slots[output_slot].value = sampled.x;
    graph_slots[output_slot].derivative = sampled.y;
    graph_slots[output_slot].status = 1.0;
    graph_slots[derivative_slot].value = sampled.y;
    graph_slots[derivative_slot].derivative = 0.0;
    graph_slots[derivative_slot].status = 1.0;
    write_node_status(node_index, 1.0, x, 0.0);
  }
}
`;

export const carrierGraphStepWgsl = `
${commonWgsl}

struct CarrierBody {
  x: f32,
  v: f32,
  mass: f32,
  _pad0: f32,
};

struct ClosureLawGraphNode {
  op_id: f32,
  input_slot: f32,
  output_slot: f32,
  derivative_slot: f32,
  sample_offset: f32,
  sample_count: f32,
  domain_min: f32,
  domain_max: f32,
  edge_offset: f32,
  edge_count: f32,
  interpolation_id: f32,
  status_flag_id: f32,
  provenance_index: f32,
  material_id: f32,
  phase_id: f32,
  _pad0: f32,
};

struct ClosureLawGraphSlot {
  value: f32,
  derivative: f32,
  status: f32,
  _pad0: f32,
};

struct ClosureLawGraphStatus {
  node_id: f32,
  status: f32,
  observed_input: f32,
  limit: f32,
};

struct CarrierGraphParams {
  dt: f32,
  node_count: u32,
  slot_count: u32,
  status_count: u32,
  step: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<storage, read_write> bodies: array<CarrierBody>;
@group(0) @binding(1) var<storage, read> graph_nodes: array<ClosureLawGraphNode>;
@group(0) @binding(2) var<storage, read> graph_samples: array<ClosureTableSample>;
@group(0) @binding(3) var<storage, read_write> graph_slots: array<ClosureLawGraphSlot>;
@group(0) @binding(4) var<storage, read_write> graph_status: array<ClosureLawGraphStatus>;
@group(0) @binding(5) var<uniform> params: CarrierGraphParams;

fn graph_u32(value: f32) -> u32 {
  return u32(max(value, 0.0));
}

fn write_graph_status(node_index: u32, status: f32, observed_input: f32, limit: f32) {
  if (node_index >= params.status_count) {
    return;
  }
  graph_status[node_index].node_id = f32(node_index);
  graph_status[node_index].status = status;
  graph_status[node_index].observed_input = observed_input;
  graph_status[node_index].limit = limit;
}

fn sample_graph_table(node: ClosureLawGraphNode, x: f32) -> vec2<f32> {
  let offset = graph_u32(node.sample_offset);
  let count = graph_u32(node.sample_count);
  var left_index = offset;
  var right_index = offset + count - 1u;
  for (var index = offset; index + 1u < offset + count; index = index + 1u) {
    let left_axis = graph_samples[index].axis;
    let right_axis = graph_samples[index + 1u].axis;
    if (x >= left_axis && x <= right_axis) {
      left_index = index;
      right_index = index + 1u;
      break;
    }
  }
  let left = graph_samples[left_index];
  let right = graph_samples[right_index];
  if (right.axis == left.axis) {
    return vec2<f32>(left.value, left.derivative);
  }
  let t = clamp((x - left.axis) / (right.axis - left.axis), 0.0, 1.0);
  return vec2<f32>(
    left.value + t * (right.value - left.value),
    left.derivative + t * (right.derivative - left.derivative)
  );
}

fn evaluate_derivative_from_graph(r: f32) -> f32 {
  if (params.node_count == 0u) {
    return 0.0;
  }
  let node = graph_nodes[0u];
  let input_slot = graph_u32(node.input_slot);
  let output_slot = graph_u32(node.output_slot);
  let derivative_slot = graph_u32(node.derivative_slot);
  if (node.op_id != 1.0 || input_slot >= params.slot_count || output_slot >= params.slot_count || derivative_slot >= params.slot_count) {
    write_graph_status(0u, 4.0, node.op_id, 0.0);
    return 0.0;
  }
  graph_slots[input_slot].value = r;
  graph_slots[input_slot].status = 1.0;
  if (r < node.domain_min) {
    graph_slots[output_slot].status = 2.0;
    graph_slots[derivative_slot].status = 2.0;
    write_graph_status(0u, 2.0, r, node.domain_min);
    return 0.0;
  }
  if (r > node.domain_max) {
    graph_slots[output_slot].status = 3.0;
    graph_slots[derivative_slot].status = 3.0;
    write_graph_status(0u, 3.0, r, node.domain_max);
    return 0.0;
  }
  let sampled = sample_graph_table(node, r);
  graph_slots[output_slot].value = sampled.x;
  graph_slots[output_slot].derivative = sampled.y;
  graph_slots[output_slot].status = 1.0;
  graph_slots[derivative_slot].value = sampled.y;
  graph_slots[derivative_slot].status = 1.0;
  write_graph_status(0u, 1.0, r, 0.0);
  return sampled.y;
}

fn pair_forces(left_x: f32, right_x: f32) -> vec2<f32> {
  let dx = right_x - left_x;
  let r = abs(dx);
  var direction = 1.0;
  if (dx < 0.0) {
    direction = -1.0;
  }
  let dEdr = evaluate_derivative_from_graph(r);
  return vec2<f32>(dEdr * direction, -dEdr * direction);
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x > 0u) {
    return;
  }
  let dt = params.dt;
  let first = pair_forces(bodies[0].x, bodies[1].x);
  var left_v = bodies[0].v + 0.5 * (first.x / bodies[0].mass) * dt;
  var right_v = bodies[1].v + 0.5 * (first.y / bodies[1].mass) * dt;
  bodies[0].x = bodies[0].x + left_v * dt;
  bodies[1].x = bodies[1].x + right_v * dt;
  let second = pair_forces(bodies[0].x, bodies[1].x);
  left_v = left_v + 0.5 * (second.x / bodies[0].mass) * dt;
  right_v = right_v + 0.5 * (second.y / bodies[1].mass) * dt;
  bodies[0].v = left_v;
  bodies[1].v = right_v;
}
`;

export const opticalLookupWgsl = `
struct OpticalLookupParams {
  record_count: u32,
  query_count: u32,
  material_bank_pbr_warm_input_row_count: u32,
  _pad1: u32,
};

@group(0) @binding(0) var<storage, read> optical_records: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> optical_queries: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> optical_outputs: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> optical_params: OpticalLookupParams;
@group(0) @binding(4) var<storage, read> material_bank_pbr_warm_input_rows: array<vec4<f32>>;

fn record_row(record_index: u32, row: u32) -> vec4<f32> {
  return optical_records[record_index * 6u + row];
}

fn material_bank_pbr_warm_input_anchor() -> f32 {
  if (optical_params.material_bank_pbr_warm_input_row_count == 0u) {
    return 0.0;
  }
  return material_bank_pbr_warm_input_rows[0u].x * 0.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let query_index = global_id.x;
  if (query_index >= optical_params.query_count) {
    return;
  }

  let query = optical_queries[query_index];
  var matched_index = -1.0;
  var out0 = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  var out1 = vec4<f32>(0.0, 0.0, 0.0, 1.0);
  var out2 = vec4<f32>(0.0, 0.0, 255.0, -1.0);
  var out3 = vec4<f32>(0.0, 0.0, 0.0, query.z);

  for (var record_index = 0u; record_index < optical_params.record_count; record_index = record_index + 1u) {
    let row0 = record_row(record_index, 0u);
    let row5 = record_row(record_index, 5u);
    if (row0.x == query.x && row0.y == query.y && row5.w == query.z) {
      let row1 = record_row(record_index, 1u);
      let row2 = record_row(record_index, 2u);
      let row4 = record_row(record_index, 4u);
      matched_index = f32(record_index);
      let warm_input_anchor = material_bank_pbr_warm_input_anchor();
      out0 = vec4<f32>(row1.x + warm_input_anchor, row1.y, row1.z, row2.z);
      out1 = vec4<f32>(row1.w, row2.x, row2.y, row2.w);
      out2 = vec4<f32>(row4.z, row4.w, row5.z, matched_index);
      out3 = vec4<f32>(row5.x, row4.y, row4.x, row5.w);
      break;
    }
  }

  optical_outputs[query_index * 4u] = out0;
  optical_outputs[query_index * 4u + 1u] = out1;
  optical_outputs[query_index * 4u + 2u] = out2;
  optical_outputs[query_index * 4u + 3u] = out3;
}
`;

export const sphThermalStepWgsl = `
struct ThermalParams {
  particle_count: u32,
  material_count: u32,
  response_count: u32,
  material_bank_warm_input_row_count: u32,
  dt: f32,
  smoothing_length_m: f32,
  conduction_rate: f32,
  wall_rate: f32,
  wall_layer_m: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  wall_x_min_k: f32,
  wall_x_max_k: f32,
  wall_y_min_k: f32,
  wall_y_max_k: f32,
  wall_z_min_k: f32,
  wall_z_max_k: f32,
  bins_enabled: u32,
  bin_capacity: u32,
  bin_nx: u32,
  bin_ny: u32,
  bin_nz: u32,
  bin_cell_size_m: f32,
  max_pair_support_m: f32,
  ambient_temperature_k: f32,
  _pad_b: f32,
  ambient_radiation_exchange_enabled: u32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> phase_response_records: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> phase_responses: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> thermal_graph_nodes: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> thermal_graph_samples: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> out_sph_state: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> out_sph_thermo: array<vec4<f32>>;
@group(0) @binding(8) var<uniform> params: ThermalParams;
@group(0) @binding(9) var<storage, read> material_bank_warm_input_rows: array<vec4<f32>>;
// Shared per-substep neighbor bins (built by the separation bin-fill pass):
// counts prefix [0, cell_count) then entry slots. When bins_enabled == 0
// (standalone/legacy paths) the kernel falls back to the exhaustive pair
// scan and a tiny placeholder buffer is bound.
@group(0) @binding(10) var<storage, read> thermal_bins: array<u32>;

const PAIR_CONDUCTION_RELAXATION_LIMIT: f32 = 0.25;

fn state_pos_mass(index: u32) -> vec4<f32> {
  return sph_state[index * 2u];
}

fn state_vel_u(index: u32) -> vec4<f32> {
  return sph_state[index * 2u + 1u];
}

fn thermo_row0(index: u32) -> vec4<f32> {
  return sph_thermo[index * 3u];
}

fn thermo_row1(index: u32) -> vec4<f32> {
  return sph_thermo[index * 3u + 1u];
}

fn thermo_row2(index: u32) -> vec4<f32> {
  return sph_thermo[index * 3u + 2u];
}

fn response_row0(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u];
}

fn response_row1(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u + 1u];
}

fn response_row2(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u + 2u];
}

fn response_row3(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u + 3u];
}

fn graph_node_row1(graph_index: u32) -> vec4<f32> {
  return thermal_graph_nodes[graph_index * 4u + 1u];
}

fn sample_temperature_from_graph(graph_index: u32, specific_internal_energy: f32) -> f32 {
  let node1 = graph_node_row1(graph_index);
  let sample_offset = u32(max(node1.x, 0.0));
  let sample_count = u32(max(node1.y, 0.0));
  if (sample_count < 2u) {
    return 0.0;
  }
  let domain_min = node1.z;
  let domain_max = node1.w;
  let x = clamp(specific_internal_energy, domain_min, domain_max);
  var left_index = sample_offset;
  var right_index = sample_offset + sample_count - 1u;
  for (var index = sample_offset; index + 1u < sample_offset + sample_count; index = index + 1u) {
    let left_axis = thermal_graph_samples[index].x;
    let right_axis = thermal_graph_samples[index + 1u].x;
    if (x >= left_axis && x <= right_axis) {
      left_index = index;
      right_index = index + 1u;
      break;
    }
  }
  let left = thermal_graph_samples[left_index];
  let right = thermal_graph_samples[right_index];
  if (right.x == left.x) {
    return left.y;
  }
  let t = clamp((x - left.x) / (right.x - left.x), 0.0, 1.0);
  return left.y + t * (right.y - left.y);
}

fn temperature_slope_from_graph(graph_index: u32, specific_internal_energy: f32) -> f32 {
  let node1 = graph_node_row1(graph_index);
  let sample_offset = u32(max(node1.x, 0.0));
  let sample_count = u32(max(node1.y, 0.0));
  if (sample_count < 2u) {
    return 0.0;
  }
  let domain_min = node1.z;
  let domain_max = node1.w;
  let x = clamp(specific_internal_energy, domain_min, domain_max);
  var left_index = sample_offset;
  var right_index = sample_offset + sample_count - 1u;
  for (var index = sample_offset; index + 1u < sample_offset + sample_count; index = index + 1u) {
    let left_axis = thermal_graph_samples[index].x;
    let right_axis = thermal_graph_samples[index + 1u].x;
    if (x >= left_axis && x <= right_axis) {
      left_index = index;
      right_index = index + 1u;
      break;
    }
  }
  let left = thermal_graph_samples[left_index];
  let right = thermal_graph_samples[right_index];
  if (right.x == left.x) {
    return 0.0;
  }
  return (right.y - left.y) / (right.x - left.x);
}

fn thermal_carrier_phase_classification(
  phase_id: f32,
  phase_fractions: vec4<f32>
) -> vec2<u32> {
  let epsilon = 1.0e-6;
  let fraction_sum = phase_fractions.x + phase_fractions.y
    + phase_fractions.z + phase_fractions.w;
  let valid = all(phase_fractions >= vec4<f32>(0.0))
    && all(phase_fractions <= vec4<f32>(1.0 + epsilon))
    && abs(fraction_sum - 1.0) <= epsilon;
  var positive_count = 0u;
  if (phase_fractions.x > 0.0) { positive_count = positive_count + 1u; }
  if (phase_fractions.y > 0.0) { positive_count = positive_count + 1u; }
  if (phase_fractions.z > 0.0) { positive_count = positive_count + 1u; }
  if (phase_fractions.w > 0.0) { positive_count = positive_count + 1u; }
  let carrier_phase = u32(clamp(round(phase_id), 0.0, 4.0));
  var pure_phase = 0u;
  if (valid && positive_count == 1u) {
    if (carrier_phase == 1u && abs(phase_fractions.x - 1.0) <= epsilon) {
      pure_phase = 1u;
    } else if (carrier_phase == 2u && abs(phase_fractions.y - 1.0) <= epsilon) {
      pure_phase = 2u;
    } else if (carrier_phase == 3u && abs(phase_fractions.z - 1.0) <= epsilon) {
      pure_phase = 3u;
    } else if (carrier_phase == 4u && abs(phase_fractions.w - 1.0) <= epsilon) {
      pure_phase = 4u;
    }
  }
  return vec2<u32>(pure_phase, select(0u, 1u, valid && positive_count >= 2u));
}

fn thermal_temperature_slope(
  material_id: f32,
  specific_internal_energy: f32,
  phase_id: f32,
  phase_fractions: vec4<f32>
) -> f32 {
  var material_response_offset = 0u;
  var material_response_count = 0u;
  var found_material = false;
  for (var record_index = 0u; record_index < params.material_count; record_index = record_index + 1u) {
    let record = phase_response_records[record_index * 2u];
    if (record.x == material_id) {
      material_response_offset = u32(record.y);
      material_response_count = u32(record.z);
      found_material = true;
      break;
    }
  }

  if (!found_material || material_response_count == 0u) {
    return 0.0;
  }

  let classification = thermal_carrier_phase_classification(phase_id, phase_fractions);
  var fallback = material_response_offset;
  var fallback_found = false;
  var containing = 0xffffffffu;
  var mixed_plateau = 0xffffffffu;
  var pure_phase_response = 0xffffffffu;
  for (var local = 0u; local < material_response_count; local = local + 1u) {
    let candidate = material_response_offset + local;
    if (candidate >= params.response_count) { return 0.0; }
    let row0 = response_row0(candidate);
    let row1 = response_row1(candidate);
    if (!fallback_found) {
      fallback = candidate;
      if (specific_internal_energy <= row1.y || local + 1u == material_response_count) {
        fallback_found = true;
      }
    }
    if (specific_internal_energy >= row1.x && specific_internal_energy <= row1.y) {
      if (containing == 0xffffffffu) { containing = candidate; }
      let phase_from = u32(clamp(round(row1.z), 0.0, 4.0));
      let phase_to = u32(clamp(round(row1.w), 0.0, 4.0));
      if (
        classification.x != 0u
        && phase_from == classification.x
        && phase_to == classification.x
      ) {
        pure_phase_response = candidate;
      }
      if (classification.y == 1u && abs(row0.y - 2.0) < 0.5) {
        mixed_plateau = candidate;
      }
    }
  }

  var selected = fallback;
  if (containing != 0xffffffffu) { selected = containing; }
  if (mixed_plateau != 0xffffffffu) { selected = mixed_plateau; }
  if (pure_phase_response != 0xffffffffu) { selected = pure_phase_response; }
  let response0 = response_row0(selected);
  if (response0.w != 1.0 || response0.z < 0.0) {
    return 0.0;
  }
  return temperature_slope_from_graph(u32(response0.z), specific_internal_energy);
}

fn thermal_value_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

// Resolve the finite response-energy interval that contains the live carrier.
// At an exact shared knot every adjacent containing interval participates, so
// the carrier can move in either physically valid direction without a
// phase-label-dependent deadlock. Missing or malformed response data fails
// closed with status 0.
fn thermal_carrier_energy_domain(
  material_id: f32,
  specific_internal_energy: f32
) -> vec4<f32> {
  if (!thermal_value_finite(specific_internal_energy)) {
    return vec4<f32>(0.0);
  }
  var material_response_offset = 0u;
  var material_response_count = 0u;
  var found_material = false;
  for (var record_index = 0u; record_index < params.material_count; record_index = record_index + 1u) {
    let record = phase_response_records[record_index * 2u];
    if (record.x == material_id) {
      if (record.w != 1.0 || record.y < 0.0 || record.z <= 0.0) {
        return vec4<f32>(specific_internal_energy, specific_internal_energy, 0.0, 0.0);
      }
      material_response_offset = u32(record.y);
      material_response_count = u32(record.z);
      found_material = true;
      break;
    }
  }
  if (!found_material || material_response_count == 0u) {
    return vec4<f32>(specific_internal_energy, specific_internal_energy, 0.0, 0.0);
  }

  var energy_lo = 3.402823466e+38;
  var energy_hi = -3.402823466e+38;
  var containing_count = 0u;
  for (var local = 0u; local < material_response_count; local = local + 1u) {
    let candidate = material_response_offset + local;
    if (candidate >= params.response_count) {
      return vec4<f32>(specific_internal_energy, specific_internal_energy, 0.0, 0.0);
    }
    let response0 = response_row0(candidate);
    let response1 = response_row1(candidate);
    if (
      response0.x != material_id
      || response0.w != 1.0
      || !thermal_value_finite(response1.x)
      || !thermal_value_finite(response1.y)
      || response1.x > response1.y
    ) {
      return vec4<f32>(specific_internal_energy, specific_internal_energy, 0.0, 0.0);
    }
    if (
      specific_internal_energy >= response1.x
      && specific_internal_energy <= response1.y
    ) {
      energy_lo = min(energy_lo, response1.x);
      energy_hi = max(energy_hi, response1.y);
      containing_count = containing_count + 1u;
    }
  }
  if (containing_count == 0u || energy_lo > energy_hi) {
    return vec4<f32>(specific_internal_energy, specific_internal_energy, 0.0, 0.0);
  }
  return vec4<f32>(energy_lo, energy_hi, 1.0, f32(containing_count));
}

fn clamp_du_to_energy_domain(
  d_u_specific: f32,
  current_u: f32,
  energy_lo: f32,
  energy_hi: f32
) -> f32 {
  if (
    !thermal_value_finite(d_u_specific)
    || !thermal_value_finite(current_u)
    || !thermal_value_finite(energy_lo)
    || !thermal_value_finite(energy_hi)
    || energy_lo > current_u
    || energy_hi < current_u
    || energy_lo > energy_hi
  ) {
    return 0.0;
  }
  return clamp(d_u_specific, energy_lo - current_u, energy_hi - current_u);
}

fn material_bank_warm_input_anchor() -> f32 {
  if (params.material_bank_warm_input_row_count == 0u) {
    return 0.0;
  }
  // Non-authoritative warm-input presence probe. The value is intentionally
  // zeroed so closure-derived thermal graphs remain the only thermal source.
  return material_bank_warm_input_rows[0u].x * 0.0;
}

const STEFAN_BOLTZMANN_W_PER_M2_K4: f32 = 5.670374419e-8;
// Pair radiation is truncated where the disc-to-disc view factor falls below
// ~0.4% (d > 4*(r_i+r_j)); beyond that range the ambient term is the
// aggregate radiative sink/source.
const RADIATION_PAIR_RANGE_RADII: f32 = 4.0;

fn pow4(x: f32) -> f32 {
  let x2 = x * x;
  return x2 * x2;
}

// Gray-body emissivity for the material, packed at table build into the
// phase-response record's second vec4 (Kirchhoff: absorptivity from the
// derived optical closure). Unknown materials return 0 - no radiation is the
// fail-safe for a material without a derived absorption response.
fn thermal_emissivity(material_id: f32) -> f32 {
  for (var record_index = 0u; record_index < params.material_count; record_index = record_index + 1u) {
    let record = phase_response_records[record_index * 2u];
    if (record.x == material_id) {
      return clamp(phase_response_records[record_index * 2u + 1u].x, 0.0, 1.0);
    }
  }
  return 0.0;
}

// Exchange area between two particles modelled as discs: the emitter's disc
// pi*r_i^2 scaled by the solid-angle fraction of the receiver r_j^2/(4 d^2).
// Symmetric in (i, j), so gather-side pair exchange conserves energy. Capped
// at the parallel-plate contact limit pi*min(r_i, r_j)^2 (view factor F = 1
// across the smaller face) so contact-range radiation never exceeds the
// closed-form two-plate bound.
fn radiative_view_area_m2(r_i: f32, r_j: f32, distance_m: f32) -> f32 {
  if (r_i <= 0.0 || r_j <= 0.0) {
    return 0.0;
  }
  let d2 = max(distance_m * distance_m, 1.0e-12);
  let geometric = 3.14159265359 * r_i * r_i * (r_j * r_j) / (4.0 * d2);
  let contact_limit = 3.14159265359 * min(r_i, r_j) * min(r_i, r_j);
  return min(geometric, contact_limit);
}

fn clamp_wall_du_specific(d_u_specific: f32, temperature_k: f32, wall_temperature_k: f32, temperature_slope: f32) -> f32 {
  if (temperature_slope <= 0.0) {
    return d_u_specific;
  }
  let next_temperature_k = temperature_k + d_u_specific * temperature_slope;
  let crosses_cold_wall = temperature_k > wall_temperature_k && next_temperature_k < wall_temperature_k;
  let crosses_hot_wall = temperature_k < wall_temperature_k && next_temperature_k > wall_temperature_k;
  if (crosses_cold_wall || crosses_hot_wall) {
    return (wall_temperature_k - temperature_k) / temperature_slope;
  }
  return d_u_specific;
}

// Conduction requires contact. The global support 2h is derived from the
// condensed-phase spacing; coarse low-density particles (gases) are
// physically larger than h — a particle of mass m at rest density rho
// occupies a nominal radius r = (3m/(4*pi*rho))^(1/3). A pair conducts when
// closer than max(2h, r_i + r_j). The pair support is symmetric in (i, j),
// so gather-side energy exchange stays pairwise-consistent.
fn particle_nominal_radius_m(mass_kg: f32, rest_density_kg_per_m3: f32) -> f32 {
  if (mass_kg <= 0.0 || rest_density_kg_per_m3 <= 0.0) {
    return 0.0;
  }
  return pow(0.238732414637843 * mass_kg / rest_density_kg_per_m3, 1.0 / 3.0);
}

fn clamp_pair_conduction_energy(
  d_e: f32,
  temperature_k: f32,
  other_temperature_k: f32,
  temperature_slope: f32,
  other_temperature_slope: f32,
  mass_kg: f32,
  other_mass_kg: f32
) -> f32 {
  if (d_e == 0.0) {
    return 0.0;
  }
  let gap_k = other_temperature_k - temperature_k;
  if (gap_k == 0.0 || sign(d_e) != sign(gap_k)) {
    return d_e;
  }
  let response_per_j = temperature_slope / max(mass_kg, 1.0e-30)
    + other_temperature_slope / max(other_mass_kg, 1.0e-30);
  if (response_per_j <= 0.0) {
    return d_e;
  }
  let equalizing_energy_j = abs(gap_k) / response_per_j;
  let limit_j = equalizing_energy_j * PAIR_CONDUCTION_RELAXATION_LIMIT;
  return sign(d_e) * min(abs(d_e), limit_j);
}

fn clamp_du_to_temperature_range(
  d_u_specific: f32,
  temperature_k: f32,
  temperature_slope: f32,
  min_temperature_k: f32,
  max_temperature_k: f32
) -> f32 {
  if (temperature_slope <= 0.0 || d_u_specific == 0.0) {
    return d_u_specific;
  }
  let next_temperature_k = temperature_k + d_u_specific * temperature_slope;
  if (next_temperature_k < min_temperature_k) {
    return (min_temperature_k - temperature_k) / temperature_slope;
  }
  if (next_temperature_k > max_temperature_k) {
    return (max_temperature_k - temperature_k) / temperature_slope;
  }
  return d_u_specific;
}

fn phase_fraction(phase_id: f32, solid: f32, liquid: f32, gas: f32, plasma: f32) -> f32 {
  if (phase_id == 1.0) { return solid; }
  if (phase_id == 2.0) { return liquid; }
  if (phase_id == 3.0) { return gas; }
  if (phase_id == 4.0) { return plasma; }
  return 0.0;
}

fn write_thermal_state(index: u32, material_id: f32, next_u: f32, source_row1: vec4<f32>, source_row2: vec4<f32>) {
  var material_response_offset = 0u;
  var material_response_count = 0u;
  var found_material = false;
  for (var record_index = 0u; record_index < params.material_count; record_index = record_index + 1u) {
    let record = phase_response_records[record_index * 2u];
    if (record.x == material_id) {
      material_response_offset = u32(record.y);
      material_response_count = u32(record.z);
      found_material = true;
      break;
    }
  }

  if (!found_material || material_response_count == 0u) {
    out_sph_thermo[index * 3u] = vec4<f32>(material_id, 0.0, 0.0, source_row1.x);
    out_sph_thermo[index * 3u + 1u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    out_sph_thermo[index * 3u + 2u] = vec4<f32>(source_row2.x, source_row2.y, 255.0, source_row2.w);
    return;
  }

  var selected = material_response_offset;
  for (var local = 0u; local < material_response_count; local = local + 1u) {
    let candidate = material_response_offset + local;
    let row1 = response_row1(candidate);
    selected = candidate;
    if (next_u <= row1.y || local + 1u == material_response_count) {
      break;
    }
  }

  let response0 = response_row0(selected);
  let response1 = response_row1(selected);
  let response2 = response_row2(selected);
  let response3 = response_row3(selected);
  if (response0.w != 1.0 || response0.z < 0.0) {
    out_sph_thermo[index * 3u] = vec4<f32>(material_id, 0.0, 0.0, source_row1.x);
    out_sph_thermo[index * 3u + 1u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    out_sph_thermo[index * 3u + 2u] = vec4<f32>(source_row2.x, source_row2.y, 255.0, source_row2.w);
    return;
  }
  let denom = max(response1.y - response1.x, 1.0e-12);
  let alpha = clamp((next_u - response1.x) / denom, 0.0, 1.0);
  let temperature_k = sample_temperature_from_graph(u32(response0.z), next_u);
  let from_fraction = clamp(response3.x * alpha + response3.y, 0.0, 1.0);
  let to_fraction = clamp(response3.z * alpha + response3.w, 0.0, 1.0);
  let solid = phase_fraction(response1.z, from_fraction, 0.0, 0.0, 0.0)
    + phase_fraction(response1.w, to_fraction, 0.0, 0.0, 0.0);
  let liquid = phase_fraction(response1.z, 0.0, from_fraction, 0.0, 0.0)
    + phase_fraction(response1.w, 0.0, to_fraction, 0.0, 0.0);
  let gas = phase_fraction(response1.z, 0.0, 0.0, from_fraction, 0.0)
    + phase_fraction(response1.w, 0.0, 0.0, to_fraction, 0.0);
  let plasma = phase_fraction(response1.z, 0.0, 0.0, 0.0, from_fraction)
    + phase_fraction(response1.w, 0.0, 0.0, 0.0, to_fraction);
  var phase_id = response1.z;
  var rest_density = response2.x;
  if (response0.y == 2.0 && alpha >= 0.5 && response2.w == 1.0) {
    phase_id = response1.w;
  }
  if (response0.y == 2.0 && alpha >= 0.5 && response2.z == 1.0) {
    rest_density = response2.y;
  }

  out_sph_thermo[index * 3u] = vec4<f32>(material_id, phase_id, temperature_k, rest_density);
  out_sph_thermo[index * 3u + 1u] = vec4<f32>(solid, liquid, gas, plasma);
  out_sph_thermo[index * 3u + 2u] = vec4<f32>(source_row2.x, source_row2.y, 1.0, source_row2.w);
}

fn wall_temperature(face_index: u32) -> f32 {
  if (face_index == 0u) { return params.wall_x_min_k; }
  if (face_index == 1u) { return params.wall_x_max_k; }
  if (face_index == 2u) { return params.wall_y_min_k; }
  if (face_index == 3u) { return params.wall_y_max_k; }
  if (face_index == 4u) { return params.wall_z_min_k; }
  return params.wall_z_max_k;
}

fn wall_distance(position: vec3<f32>, face_index: u32) -> f32 {
  if (face_index == 0u) { return position.x; }
  if (face_index == 1u) { return params.box_x - position.x; }
  if (face_index == 2u) { return position.y; }
  if (face_index == 3u) { return params.box_y - position.y; }
  if (face_index == 4u) { return position.z; }
  return params.box_z - position.z;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let pos_mass = state_pos_mass(particle_index);
  let vel_u = state_vel_u(particle_index);
  let row0 = thermo_row0(particle_index);
  let row1 = thermo_row1(particle_index);
  let row2 = thermo_row2(particle_index);
  if (!(pos_mass.w > 0.0)) {
    out_sph_state[particle_index * 2u] = pos_mass;
    out_sph_state[particle_index * 2u + 1u] = vel_u;
    out_sph_thermo[particle_index * 3u] = row0;
    out_sph_thermo[particle_index * 3u + 1u] = row1;
    out_sph_thermo[particle_index * 3u + 2u] = row2;
    return;
  }
  let position = vec3<f32>(pos_mass.x, pos_mass.y, pos_mass.z);
  let mass = max(pos_mass.w, 1.0e-30);
  let temperature = row0.z;
	  let carrier_domain = thermal_carrier_energy_domain(row0.x, vel_u.w);
	  let carrier_domain_ready = carrier_domain.z == 1.0;
	  var carrier_u_lo = vel_u.w;
	  var carrier_u_hi = vel_u.w;
	  if (carrier_domain_ready) {
	    carrier_u_lo = carrier_domain.x;
	    carrier_u_hi = carrier_domain.y;
	  }
	  let temperature_slope = thermal_temperature_slope(row0.x, vel_u.w, row0.y, row1);
	  let support = 2.0 * params.smoothing_length_m;
	  let self_nominal_radius_m = particle_nominal_radius_m(mass, row0.w);
	  let self_emissivity = thermal_emissivity(row0.x);
	  var du = material_bank_warm_input_anchor();
	  var conduction_du = 0.0;
	  var neighbor_min_temperature = temperature;
	  var neighbor_max_temperature = temperature;

	  let scan_support = max(support, params.max_pair_support_m);
	  // Bins can only serve pairs their scan radius reaches. Coarse low-density
	  // scenes have contact radii spanning many bin cells (an F2 gas particle's
	  // nominal radius is metres); those scenes are also small-n, so the
	  // exhaustive pair scan is the right structure for them. Self-select.
	  let bins_cover_support = scan_support <= 5.0 * max(params.bin_cell_size_m, 1.0e-9);
	  if (params.bins_enabled == 1u && params.bin_capacity > 0u && bins_cover_support) {
	    // Neighbor-bin scan: the shared per-substep bins hold every massive
	    // particle; the scan radius covers the conduction support even when
	    // the cell size was chosen for the (smaller) separation rest distance.
	    let inv_cell = 1.0 / max(params.bin_cell_size_m, 1.0e-9);
	    let scan_r = i32(clamp(u32(ceil(scan_support * inv_cell)), 1u, 5u));
	    let cx = i32(clamp(u32(max(position.x, 0.0) * inv_cell), 0u, params.bin_nx - 1u));
	    let cy = i32(clamp(u32(max(position.y, 0.0) * inv_cell), 0u, params.bin_ny - 1u));
	    let cz = i32(clamp(u32(max(position.z, 0.0) * inv_cell), 0u, params.bin_nz - 1u));
	    for (var oz = -scan_r; oz <= scan_r; oz = oz + 1) {
	      let nz = cz + oz;
	      if (nz < 0 || nz >= i32(params.bin_nz)) { continue; }
	      for (var oy = -scan_r; oy <= scan_r; oy = oy + 1) {
	        let ny = cy + oy;
	        if (ny < 0 || ny >= i32(params.bin_ny)) { continue; }
	        for (var ox = -scan_r; ox <= scan_r; ox = ox + 1) {
	          let nx = cx + ox;
	          if (nx < 0 || nx >= i32(params.bin_nx)) { continue; }
	          let cell = (u32(nz) * params.bin_ny + u32(ny)) * params.bin_nx + u32(nx);
	          let total_cells = params.bin_nx * params.bin_ny * params.bin_nz;
	          let cell_count = min(thermal_bins[cell], params.bin_capacity);
	          for (var entry = 0u; entry < cell_count; entry = entry + 1u) {
	            let other = thermal_bins[total_cells + cell * params.bin_capacity + entry];
	            if (other == particle_index) { continue; }
	            let other_pos_mass = state_pos_mass(other);
	            if (!(other_pos_mass.w > 0.0)) { continue; }
	            let delta = position - vec3<f32>(other_pos_mass.x, other_pos_mass.y, other_pos_mass.z);
	            let distance = length(delta);
	            let other_row0 = thermo_row0(other);
	            let other_row1 = thermo_row1(other);
	            let other_nominal_radius_m = particle_nominal_radius_m(other_pos_mass.w, other_row0.w);
	            let pair_radii_m = self_nominal_radius_m + other_nominal_radius_m;
	            let pair_support = max(support, pair_radii_m);
	            let radiation_support = RADIATION_PAIR_RANGE_RADII * pair_radii_m;
	            if (distance < max(pair_support, radiation_support)) {
	              let other_vel_u = state_vel_u(other);
	              let other_temperature = other_row0.z;
	              neighbor_min_temperature = min(neighbor_min_temperature, other_temperature);
	              neighbor_max_temperature = max(neighbor_max_temperature, other_temperature);
	              let other_temperature_slope = thermal_temperature_slope(
	                other_row0.x,
	                other_vel_u.w,
	                other_row0.y,
	                other_row1
	              );
	              if (distance < pair_support) {
	                let weight = 1.0 - distance / pair_support;
	                let raw_dE = params.conduction_rate * (other_temperature - temperature) * weight * params.dt;
	                let dE = clamp_pair_conduction_energy(
	                  raw_dE,
	                  temperature,
	                  other_temperature,
	                  temperature_slope,
	                  other_temperature_slope,
	                  mass,
	                  other_pos_mass.w
	                );
	                conduction_du = conduction_du + dE / mass;
	              }
	              // Gray-body pair radiation over the disc view area; shares the
	              // conduction equalization clamp so one substep never crosses
	              // the pair equilibrium, and the aggregate neighbor-range clamp
	              // below bounds the total like conduction.
	              if (self_emissivity > 0.0 && distance < radiation_support) {
	                let other_emissivity = thermal_emissivity(other_row0.x);
	                if (other_emissivity > 0.0) {
	                  let view_area_m2 = radiative_view_area_m2(self_nominal_radius_m, other_nominal_radius_m, distance);
	                  let raw_rad_dE = self_emissivity * other_emissivity * STEFAN_BOLTZMANN_W_PER_M2_K4
	                    * (pow4(other_temperature) - pow4(temperature)) * view_area_m2 * params.dt;
	                  let rad_dE = clamp_pair_conduction_energy(
	                    raw_rad_dE,
	                    temperature,
	                    other_temperature,
	                    temperature_slope,
	                    other_temperature_slope,
	                    mass,
	                    other_pos_mass.w
	                  );
	                  conduction_du = conduction_du + rad_dE / mass;
	                }
	              }
	            }
	          }
	        }
	      }
	    }
	  } else {
	  for (var other = 0u; other < params.particle_count; other = other + 1u) {
	    if (other == particle_index) {
      continue;
    }
	    let other_pos_mass = state_pos_mass(other);
	    if (!(other_pos_mass.w > 0.0)) { continue; }
	    let delta = position - vec3<f32>(other_pos_mass.x, other_pos_mass.y, other_pos_mass.z);
	    let distance = length(delta);
	    let other_row0 = thermo_row0(other);
	    let other_row1 = thermo_row1(other);
	    let other_nominal_radius_m = particle_nominal_radius_m(other_pos_mass.w, other_row0.w);
	    let pair_radii_m = self_nominal_radius_m + other_nominal_radius_m;
	    let pair_support = max(support, pair_radii_m);
	    let radiation_support = RADIATION_PAIR_RANGE_RADII * pair_radii_m;
	    if (distance < max(pair_support, radiation_support)) {
	      let other_vel_u = state_vel_u(other);
	      let other_temperature = other_row0.z;
	      neighbor_min_temperature = min(neighbor_min_temperature, other_temperature);
	      neighbor_max_temperature = max(neighbor_max_temperature, other_temperature);
	      let other_temperature_slope = thermal_temperature_slope(
	        other_row0.x,
	        other_vel_u.w,
	        other_row0.y,
	        other_row1
	      );
	      if (distance < pair_support) {
	        let weight = 1.0 - distance / pair_support;
	        let raw_dE = params.conduction_rate * (other_temperature - temperature) * weight * params.dt;
	        let dE = clamp_pair_conduction_energy(
	          raw_dE,
	          temperature,
	          other_temperature,
	          temperature_slope,
	          other_temperature_slope,
	          mass,
	          other_pos_mass.w
	        );
	        conduction_du = conduction_du + dE / mass;
	      }
	      // Gray-body pair radiation over the disc view area; shares the
	      // conduction equalization clamp so one substep never crosses
	      // the pair equilibrium, and the aggregate neighbor-range clamp
	      // below bounds the total like conduction.
	      if (self_emissivity > 0.0 && distance < radiation_support) {
	        let other_emissivity = thermal_emissivity(other_row0.x);
	        if (other_emissivity > 0.0) {
	          let view_area_m2 = radiative_view_area_m2(self_nominal_radius_m, other_nominal_radius_m, distance);
	          let raw_rad_dE = self_emissivity * other_emissivity * STEFAN_BOLTZMANN_W_PER_M2_K4
	            * (pow4(other_temperature) - pow4(temperature)) * view_area_m2 * params.dt;
	          let rad_dE = clamp_pair_conduction_energy(
	            raw_rad_dE,
	            temperature,
	            other_temperature,
	            temperature_slope,
	            other_temperature_slope,
	            mass,
	            other_pos_mass.w
	          );
	          conduction_du = conduction_du + rad_dE / mass;
	        }
	      }
	    }
	  }
	  }
	  du = du + clamp_du_to_temperature_range(
	    conduction_du,
	    temperature,
	    temperature_slope,
	    neighbor_min_temperature,
	    neighbor_max_temperature
	  );

	  for (var face = 0u; face < 6u; face = face + 1u) {
	    let distance = wall_distance(position, face);
	    if (distance < params.wall_layer_m) {
	      let weight = 1.0 - distance / params.wall_layer_m;
	      let face_wall_temperature = wall_temperature(face);
	      let current_u = vel_u.w + du;
	      let current_temperature = temperature + du * temperature_slope;
	      let raw_du_specific = params.wall_rate * (face_wall_temperature - current_temperature) * weight * params.dt / mass;
	      let equilibrium_limited_du = clamp_wall_du_specific(
	        raw_du_specific,
	        current_temperature,
	        face_wall_temperature,
	        temperature_slope
	      );
	      du = du + clamp_du_to_energy_domain(
	        equilibrium_limited_du,
	        current_u,
	        carrier_u_lo,
	        carrier_u_hi
	      );
	    }
	  }

	  // Radiative exchange with the ambient environment (box interior at
	  // params.ambient_temperature_k): full-sphere gray-body Stefan-Boltzmann.
	  // This is a documented open-system source/sink (the environment absorbs
	  // or supplies the energy, like the wall coupling above). The crossing
	  // clamp guarantees a substep never overshoots past ambient equilibrium.
	  if (
	    params.ambient_radiation_exchange_enabled == 1u
	    && self_emissivity > 0.0
	    && self_nominal_radius_m > 0.0
	    && params.ambient_temperature_k > 0.0
	  ) {
	    let surface_area_m2 = 4.0 * 3.14159265359 * self_nominal_radius_m * self_nominal_radius_m;
	    let current_u = vel_u.w + du;
	    let current_temperature = temperature + du * temperature_slope;
	    let raw_ambient_dE = self_emissivity * STEFAN_BOLTZMANN_W_PER_M2_K4
	      * (pow4(params.ambient_temperature_k) - pow4(current_temperature))
	      * surface_area_m2 * params.dt;
	    let equilibrium_limited_du = clamp_wall_du_specific(
	      raw_ambient_dE / mass,
	      current_temperature,
	      params.ambient_temperature_k,
	      temperature_slope
	    );
	    du = du + clamp_du_to_energy_domain(
	      equilibrium_limited_du,
	      current_u,
	      carrier_u_lo,
	      carrier_u_hi
	    );
	  }

  var next_u = select(0.0, vel_u.w, thermal_value_finite(vel_u.w));
  let candidate_next_u = vel_u.w + du;
  if (carrier_domain_ready) {
    next_u = clamp(
      select(vel_u.w, candidate_next_u, thermal_value_finite(candidate_next_u)),
      carrier_u_lo,
      carrier_u_hi
    );
  }
  out_sph_state[particle_index * 2u] = pos_mass;
  out_sph_state[particle_index * 2u + 1u] = vec4<f32>(vel_u.x, vel_u.y, vel_u.z, next_u);
  write_thermal_state(particle_index, row0.x, next_u, row1, row2);
}
`;

export const sphReactionStepWgsl = `
struct ReactionParams {
  particle_count: u32,
  reaction_count: u32,
  product_phase_count: u32,
  material_count: u32,
  response_count: u32,
  reset_mechanics: u32,
  reactant_term_count: u32,
  product_term_count: u32,
  gas_product_count: u32,
  // Substep duration for the interface-flux extent law; 0 disables the cap
  // (legacy whole-particle consumption) so stale packers stay well-defined.
  dt_s: f32,
  // 1 when the host authenticated header/reactant/product rows. Only 0 with
  // every extended section absent is the distinguishable legacy schema.
  reaction_table_mode: u32,
  _pad2: u32,
};

struct ReactionParticleBinParams {
  particle_count: u32,
  cell_count: u32,
  bin_capacity: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  bins_enabled: u32,
  _pad0: u32,
  origin_x_m: f32,
  origin_y_m: f32,
  origin_z_m: f32,
  cell_size_m: f32,
  inv_cell_size_m: f32,
  box_x_m: f32,
  box_y_m: f32,
  box_z_m: f32,
};

struct SchroederReactionLawQueueParams {
  enabled: u32,
  active_node_count: u32,
  law_queue_stride: u32,
  reaction_mask: u32,
};

struct SchroederReactionLawNeighborParams {
  enabled: u32,
  candidate_count: u32,
  candidate_stride: u32,
  candidate_budget: u32,
  reaction_mask: u32,
  source_span_count: u32,
  source_span_stride: u32,
  source_span_enabled: u32,
};

struct ThermalRows {
  row0: vec4<f32>,
  row1: vec4<f32>,
  row2: vec4<f32>,
};

struct ProductMechanics {
  rest_density: f32,
  bulk: f32,
  shear: f32,
  lambda: f32,
  sound_speed: f32,
  eos_model: f32,
  solid: f32,
  status: f32,
};

struct ReactantTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  status: f32,
  // Interface mass flux [kg/m^2/s] this reactant can deliver to a reactive
  // contact at the reference temperature (kinetic-theory effusion for gases,
  // Clausius-Clapeyron vapor carrier for volatile condensed reactants, 0 when
  // no transport pathway is derivable). Packed by the reaction-table builder.
  interface_flux: f32,
};

struct ProductTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  routing_id: f32,
  status: f32,
};

@group(0) @binding(0) var<storage, read> particle_records: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_sph_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> unpack_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> source_sph_thermo: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> phase_response_records: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> phase_responses: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> proposals: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> out_particle_records: array<vec4<f32>>;
@group(0) @binding(9) var<storage, read_write> unpack_sph_state: array<vec4<f32>>;
@group(0) @binding(10) var<storage, read_write> unpack_sph_thermo: array<vec4<f32>>;
@group(0) @binding(11) var<uniform> params: ReactionParams;
@group(0) @binding(12) var<storage, read> thermal_graph_nodes: array<vec4<f32>>;
@group(0) @binding(13) var<storage, read> thermal_graph_samples: array<vec4<f32>>;
@group(0) @binding(14) var<storage, read_write> pack_particle_records: array<vec4<f32>>;
@group(0) @binding(15) var<storage, read> source_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(16) var<storage, read_write> reaction_particle_bin_counts: array<atomic<u32>>;
@group(0) @binding(17) var<storage, read_write> reaction_particle_bin_indices: array<u32>;
@group(0) @binding(18) var<storage, read_write> reaction_particle_bin_metadata: array<atomic<u32>>;
@group(0) @binding(19) var<uniform> reaction_particle_bin_params: ReactionParticleBinParams;
@group(0) @binding(20) var<storage, read> schroeder_reaction_law_queue_rows: array<f32>;
@group(0) @binding(21) var<uniform> schroeder_reaction_law_queue_params: SchroederReactionLawQueueParams;
@group(0) @binding(22) var<storage, read> schroeder_reaction_neighbor_candidate_rows: array<f32>;
@group(0) @binding(23) var<uniform> schroeder_reaction_neighbor_candidate_params: SchroederReactionLawNeighborParams;
@group(0) @binding(24) var<storage, read> schroeder_reaction_source_span_rows: array<f32>;

const REACTION_PARTICLE_RECORD_VEC4S: u32 = 13u;
const SCHROEDER_REACTION_LAW_QUEUE_STRIDE: u32 = 32u;
const SCHROEDER_REACTION_LAW_QUEUE_STATUS_OFFSET: u32 = 3u;
const SCHROEDER_REACTION_LAW_QUEUE_LAW_MASK_OFFSET: u32 = 12u;
const SCHROEDER_REACTION_LAW_QUEUE_REACTION_ELIGIBLE_OFFSET: u32 = 13u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_STRIDE: u32 = 16u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_OFFSET: u32 = 0u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_NEIGHBOR_OFFSET: u32 = 1u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_LAW_MASK_OFFSET: u32 = 2u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_STATUS_OFFSET: u32 = 3u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_STATUS_READY: f32 = 1.0;
const SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_STRIDE: u32 = 4u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_SOURCE_OFFSET: u32 = 0u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_START_OFFSET: u32 = 1u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_COUNT_OFFSET: u32 = 2u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_STATUS_OFFSET: u32 = 3u;
const REACTION_AVOGADRO_PER_MOL: f32 = 6.02214076e23;

fn state_pos_mass(index: u32) -> vec4<f32> {
  return particle_records[index * REACTION_PARTICLE_RECORD_VEC4S];
}

fn state_vel_u(index: u32) -> vec4<f32> {
  return particle_records[index * REACTION_PARTICLE_RECORD_VEC4S + 1u];
}

fn thermo_row0(index: u32) -> vec4<f32> {
  return particle_records[index * REACTION_PARTICLE_RECORD_VEC4S + 2u];
}

fn thermo_row1(index: u32) -> vec4<f32> {
  return particle_records[index * REACTION_PARTICLE_RECORD_VEC4S + 3u];
}

fn thermo_row2(index: u32) -> vec4<f32> {
  return particle_records[index * REACTION_PARTICLE_RECORD_VEC4S + 4u];
}

fn reaction_row0(reaction_index: u32) -> vec4<f32> {
  return reaction_records[reaction_index * 3u];
}

fn reaction_row1(reaction_index: u32) -> vec4<f32> {
  return reaction_records[reaction_index * 3u + 1u];
}

fn reaction_row2(reaction_index: u32) -> vec4<f32> {
  return reaction_records[reaction_index * 3u + 2u];
}

fn product_phase_row0(record_index: u32) -> vec4<f32> {
  return reaction_records[(params.reaction_count + record_index) * 3u];
}

fn product_phase_row1(record_index: u32) -> vec4<f32> {
  return reaction_records[(params.reaction_count + record_index) * 3u + 1u];
}

fn product_phase_row2(record_index: u32) -> vec4<f32> {
  return reaction_records[(params.reaction_count + record_index) * 3u + 2u];
}

fn reaction_header_row0(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u];
}

fn reaction_header_row1(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u + 1u];
}

fn reaction_header_row2(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u + 2u];
}

fn product_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u];
}

fn product_term_row1(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 1u];
}

fn reactant_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u];
}

fn reactant_term_row2(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u + 2u];
}

fn response_row0(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u];
}

fn response_row1(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u + 1u];
}

fn response_row2(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u + 2u];
}

fn response_row3(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u + 3u];
}

fn graph_node_row1(graph_index: u32) -> vec4<f32> {
  return thermal_graph_nodes[graph_index * 4u + 1u];
}

fn sample_temperature_from_graph(graph_index: u32, specific_internal_energy: f32) -> f32 {
  let node1 = graph_node_row1(graph_index);
  let sample_offset = u32(max(node1.x, 0.0));
  let sample_count = u32(max(node1.y, 0.0));
  if (sample_count < 2u) {
    return 0.0;
  }
  let domain_min = node1.z;
  let domain_max = node1.w;
  let x = clamp(specific_internal_energy, domain_min, domain_max);
  var left_index = sample_offset;
  var right_index = sample_offset + sample_count - 1u;
  for (var index = sample_offset; index + 1u < sample_offset + sample_count; index = index + 1u) {
    let left_axis = thermal_graph_samples[index].x;
    let right_axis = thermal_graph_samples[index + 1u].x;
    if (x >= left_axis && x <= right_axis) {
      left_index = index;
      right_index = index + 1u;
      break;
    }
  }
  let left = thermal_graph_samples[left_index];
  let right = thermal_graph_samples[right_index];
  if (right.x == left.x) {
    return left.y;
  }
  let t = clamp((x - left.x) / (right.x - left.x), 0.0, 1.0);
  return left.y + t * (right.y - left.y);
}

fn reaction_value_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn represented_entity_count_from_mass(
  mass_kg: f32,
  molar_mass_kg_per_mol: f32
) -> f32 {
  if (
    !reaction_value_finite(mass_kg)
    || !reaction_value_finite(molar_mass_kg_per_mol)
    || !(mass_kg > 0.0)
    || !(molar_mass_kg_per_mol > 0.0)
  ) {
    return 0.0;
  }
  return mass_kg / molar_mass_kg_per_mol * REACTION_AVOGADRO_PER_MOL;
}

fn phase_mask_satisfied(mask_f: f32, phase_id_f: f32) -> bool {
  let mask = u32(mask_f + 0.5);
  if (mask == 0u) {
    return true;
  }
  let phase_id = u32(phase_id_f + 0.5);
  if (phase_id >= 31u) {
    return false;
  }
  return (mask & (1u << phase_id)) != 0u;
}

fn phase_fraction(phase_id: f32, solid: f32, liquid: f32, gas: f32, plasma: f32) -> f32 {
  if (phase_id == 1.0) { return solid; }
  if (phase_id == 2.0) { return liquid; }
  if (phase_id == 3.0) { return gas; }
  if (phase_id == 4.0) { return plasma; }
  return 0.0;
}

fn resolve_thermal_rows(material_id: f32, next_u: f32, source_row2: vec4<f32>) -> ThermalRows {
  var material_response_offset = 0u;
  var material_response_count = 0u;
  var found_material = false;
  for (var record_index = 0u; record_index < params.material_count; record_index = record_index + 1u) {
    let record = phase_response_records[record_index * 2u];
    if (record.x == material_id) {
      material_response_offset = u32(record.y);
      material_response_count = u32(record.z);
      found_material = true;
      break;
    }
  }

  if (!found_material || material_response_count == 0u) {
    return ThermalRows(
      vec4<f32>(material_id, 0.0, 0.0, 0.0),
      vec4<f32>(0.0, 0.0, 0.0, 0.0),
      vec4<f32>(source_row2.x, source_row2.y, 255.0, source_row2.w)
    );
  }

  var selected = material_response_offset;
  for (var local = 0u; local < material_response_count; local = local + 1u) {
    let candidate = material_response_offset + local;
    let row1 = response_row1(candidate);
    selected = candidate;
    if (next_u <= row1.y || local + 1u == material_response_count) {
      break;
    }
  }

  let response0 = response_row0(selected);
  let response1 = response_row1(selected);
  let response2 = response_row2(selected);
  let response3 = response_row3(selected);
  if (response0.w != 1.0 || response0.z < 0.0) {
    return ThermalRows(
      vec4<f32>(material_id, 0.0, 0.0, 0.0),
      vec4<f32>(0.0, 0.0, 0.0, 0.0),
      vec4<f32>(source_row2.x, source_row2.y, 255.0, source_row2.w)
    );
  }
  let denom = max(response1.y - response1.x, 1.0e-12);
  let alpha = clamp((next_u - response1.x) / denom, 0.0, 1.0);
  let temperature_k = sample_temperature_from_graph(u32(response0.z), next_u);
  let from_fraction = clamp(response3.x * alpha + response3.y, 0.0, 1.0);
  let to_fraction = clamp(response3.z * alpha + response3.w, 0.0, 1.0);
  let solid = phase_fraction(response1.z, from_fraction, 0.0, 0.0, 0.0)
    + phase_fraction(response1.w, to_fraction, 0.0, 0.0, 0.0);
  let liquid = phase_fraction(response1.z, 0.0, from_fraction, 0.0, 0.0)
    + phase_fraction(response1.w, 0.0, to_fraction, 0.0, 0.0);
  let gas = phase_fraction(response1.z, 0.0, 0.0, from_fraction, 0.0)
    + phase_fraction(response1.w, 0.0, 0.0, to_fraction, 0.0);
  let plasma = phase_fraction(response1.z, 0.0, 0.0, 0.0, from_fraction)
    + phase_fraction(response1.w, 0.0, 0.0, 0.0, to_fraction);
  var phase_id = response1.z;
  var rest_density = response2.x;
  if (response0.y == 2.0 && alpha >= 0.5 && response2.w == 1.0) {
    phase_id = response1.w;
  }
  if (response0.y == 2.0 && alpha >= 0.5 && response2.z == 1.0) {
    rest_density = response2.y;
  }

  return ThermalRows(
    vec4<f32>(material_id, phase_id, temperature_k, rest_density),
    vec4<f32>(solid, liquid, gas, plasma),
    vec4<f32>(source_row2.x, source_row2.y, 1.0, source_row2.w)
  );
}

fn find_product_mechanics(material_id: f32, phase_id: f32) -> ProductMechanics {
  for (var record_index = 0u; record_index < params.product_phase_count; record_index = record_index + 1u) {
    let row0 = product_phase_row0(record_index);
    if (row0.x == material_id && row0.y == phase_id) {
      let row1 = product_phase_row1(record_index);
      let row2 = product_phase_row2(record_index);
      return ProductMechanics(row0.z, row0.w, row1.x, row1.y, row1.z, row1.w, row2.x, row2.y);
    }
  }
  return ProductMechanics(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 255.0);
}

fn product_output_ready(
  index: u32,
  material_id: f32,
  mass_kg: f32,
  source_support_volume_m3: f32,
  next_u: f32,
  velocity: vec3<f32>
) -> bool {
  if (
    !reaction_value_finite(material_id)
    || !reaction_value_finite(mass_kg)
    || !reaction_value_finite(source_support_volume_m3)
    || !reaction_value_finite(next_u)
    || !all(velocity == velocity)
    || !all(abs(velocity) <= vec3<f32>(3.402823e38))
    || !(material_id > 0.0)
    || !(mass_kg > 0.0)
    || !(source_support_volume_m3 > 0.0)
  ) {
    return false;
  }
  let resolved = resolve_thermal_rows(material_id, next_u, thermo_row2(index));
  let mechanics = find_product_mechanics(resolved.row0.x, resolved.row0.y);
  let resolved_finite = all(resolved.row0 == resolved.row0)
    && all(resolved.row1 == resolved.row1)
    && all(resolved.row2 == resolved.row2)
    && all(abs(resolved.row0) <= vec4<f32>(3.402823e38))
    && all(abs(resolved.row1) <= vec4<f32>(3.402823e38))
    && all(abs(resolved.row2) <= vec4<f32>(3.402823e38));
  let mechanics_finite =
    reaction_value_finite(mechanics.rest_density)
    && reaction_value_finite(mechanics.bulk)
    && reaction_value_finite(mechanics.shear)
    && reaction_value_finite(mechanics.lambda)
    && reaction_value_finite(mechanics.sound_speed)
    && reaction_value_finite(mechanics.eos_model)
    && reaction_value_finite(mechanics.solid)
    && reaction_value_finite(mechanics.status);
  if (
    !resolved_finite
    || !mechanics_finite
    || resolved.row0.x != material_id
    || !(resolved.row0.y > 0.0)
    || !(resolved.row0.w > 0.0)
    || resolved.row2.z != 1.0
    || mechanics.status != 1.0
    || !(mechanics.rest_density > 0.0)
  ) {
    return false;
  }
  let rest_volume = mass_kg / resolved.row0.w;
  return reaction_value_finite(rest_volume)
    && rest_volume > 0.0;
}

fn copy_particle(index: u32) {
  let base = index * REACTION_PARTICLE_RECORD_VEC4S;
  for (var row = 0u; row < REACTION_PARTICLE_RECORD_VEC4S; row = row + 1u) {
    out_particle_records[base + row] = particle_records[base + row];
  }
}

fn particle_current_volume(index: u32) -> f32 {
  let mechanics_base = index * REACTION_PARTICLE_RECORD_VEC4S + 5u;
  let volume_row = particle_records[mechanics_base + 4u];
  let constitutive_row = particle_records[mechanics_base + 5u];
  let eos_row = particle_records[mechanics_base + 6u];
  let current_volume = volume_row.z * volume_row.w;
  return select(
    -1.0,
    current_volume,
    reaction_value_finite(volume_row.z)
      && reaction_value_finite(volume_row.w)
      && reaction_value_finite(current_volume)
      && volume_row.z > 0.0
      && volume_row.w > 0.0
      && current_volume > 0.0
      && constitutive_row.y == 1.0
      && eos_row.w == 1.0
  );
}

fn copy_particle_with_mass(index: u32, mass_kg: f32) {
  copy_particle(index);
  let base = index * REACTION_PARTICLE_RECORD_VEC4S;
  let pos_mass = particle_records[base];
  let next_mass = max(mass_kg, 0.0);
  out_particle_records[base] = vec4<f32>(pos_mass.x, pos_mass.y, pos_mass.z, next_mass);
  let mechanics_base = base + 5u;
  let volume_row = out_particle_records[mechanics_base + 4u];
  if (pos_mass.w > 0.0) {
    // A partially consumed carrier retains its deformation and the same
    // specific current volume. Scaling V0 by the surviving mass fraction
    // retires exactly the consumed share; replacement product material is
    // born independently at its own target reference state. Uniform
    // composition makes represented entities proportional to the same mass
    // fraction.
    let surviving_fraction = clamp(next_mass / pos_mass.w, 0.0, 1.0);
    let thermo2 = out_particle_records[base + 4u];
    out_particle_records[base + 4u] = vec4<f32>(
      thermo2.x,
      thermo2.y * surviving_fraction,
      thermo2.z,
      thermo2.w
    );
    if (volume_row.w > 0.0) {
      out_particle_records[mechanics_base + 4u] = vec4<f32>(
        volume_row.x,
        volume_row.y,
        volume_row.z,
        volume_row.w * surviving_fraction
      );
    }
  }
}

fn write_reacted_mechanics(index: u32, mass_kg: f32, _source_support_volume_m3: f32, resolved: ThermalRows) {
  let mechanics = find_product_mechanics(resolved.row0.x, resolved.row0.y);
  var rest_density = resolved.row0.w;
  if (rest_density <= 0.0) {
    rest_density = mechanics.rest_density;
  }
  var rest_volume = 0.0;
  if (rest_density > 0.0) {
    rest_volume = mass_kg / rest_density;
  }
  // Every caller authenticates the consumed source support volume before
  // reaching this mutation, but that support is routing geometry rather than
  // deformation authority for a newly born material. Chemical products start
  // relaxed at their target reference density, matching phase-component
  // materialization and preventing gas-scale support from becoming enormous
  // condensed-product strain.
  let deformation_j = 1.0;
  let deformation_scale = 1.0;
  let out_base = index * REACTION_PARTICLE_RECORD_VEC4S + 5u;
  out_particle_records[out_base] = vec4<f32>(deformation_scale, 0.0, 0.0, 0.0);
  out_particle_records[out_base + 1u] = vec4<f32>(deformation_scale, 0.0, 0.0, 0.0);
  out_particle_records[out_base + 2u] = vec4<f32>(deformation_scale, 0.0, 0.0, 0.0);
  out_particle_records[out_base + 3u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  out_particle_records[out_base + 4u] = vec4<f32>(0.0, 0.0, deformation_j, rest_volume);
  out_particle_records[out_base + 5u] = vec4<f32>(mechanics.solid, mechanics.status, mechanics.bulk, mechanics.shear);
  out_particle_records[out_base + 6u] = vec4<f32>(mechanics.lambda, mechanics.sound_speed, mechanics.eos_model, mechanics.status);
  out_particle_records[out_base + 7u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
}

fn write_product_particle(
  index: u32,
  material_id: f32,
  mass_kg: f32,
  current_volume_m3: f32,
  next_u: f32,
  velocity: vec3<f32>,
  represented_entity_count: f32
) -> bool {
  if (
    !reaction_value_finite(represented_entity_count)
    || !(represented_entity_count > 0.0)
    || !product_output_ready(
    index,
    material_id,
    mass_kg,
    current_volume_m3,
    next_u,
    velocity
    )
  ) {
    return false;
  }
  let pos_mass = state_pos_mass(index);
  let source_row2 = thermo_row2(index);
  let resolved = resolve_thermal_rows(material_id, next_u, source_row2);
  let out_base = index * REACTION_PARTICLE_RECORD_VEC4S;
  out_particle_records[out_base] = vec4<f32>(pos_mass.x, pos_mass.y, pos_mass.z, max(mass_kg, 0.0));
  out_particle_records[out_base + 1u] = vec4<f32>(velocity.x, velocity.y, velocity.z, next_u);
  out_particle_records[out_base + 2u] = resolved.row0;
  out_particle_records[out_base + 3u] = resolved.row1;
  out_particle_records[out_base + 4u] = vec4<f32>(
    resolved.row2.x,
    max(represented_entity_count, 0.0),
    resolved.row2.z,
    resolved.row2.w
  );
  if (params.reset_mechanics != 0u) {
    write_reacted_mechanics(index, max(mass_kg, 0.0), current_volume_m3, resolved);
  } else {
    let mechanics_base = index * REACTION_PARTICLE_RECORD_VEC4S + 5u;
    for (var row = 0u; row < 8u; row = row + 1u) {
      out_particle_records[mechanics_base + row] = particle_records[mechanics_base + row];
    }
    let volume_row = out_particle_records[mechanics_base + 4u];
    if (current_volume_m3 > 0.0 && volume_row.z > 0.0) {
      out_particle_records[mechanics_base + 4u] = vec4<f32>(
        volume_row.xyz,
        current_volume_m3 / volume_row.z
      );
    }
  }
  return true;
}


// Interface-flux extent cap [mol] for one reacting pair over one substep.
// A contact event may only convert as much matter as transport can deliver
// through the contact interface: extent_rate = A_contact * max_i(nu_i /
// (coef_i * M_i)) where nu_i is reactant i's interface mass flux [kg/m^2/s]
// at its current temperature and the max expresses that the mobile species'
// pathway governs (e.g. water vapor reaching a sodium surface). A_contact is
// the contact disc of the smaller rest-volume radius - the same contact
// geometry the pair-conduction law uses - so thermal and chemical transport
// see one consistent interface. nu scales as sqrt(T/T_ref) (effusion flux
// rho*vbar/4 with vbar ~ sqrt(T)); the vapor-carrier density's exponential
// Clausius-Clapeyron growth with T is NOT modelled - a conservative,
// documented frontier gap. When neither reactant carries a derivable flux
// (nu_i = 0: condensed-condensed, non-volatile) or dt is 0 (stale packer),
// the cap disables and the stoichiometric availability bound alone applies -
// the pre-flux-law behavior. Every module that computes a reaction extent
// (apply, summary partials, product inventory, product events, atom
// residual, gas species) MUST apply this identical cap or their ledgers
// disagree and phantom product mass appears.
const INTERFACE_FLUX_REFERENCE_TEMPERATURE_K: f32 = 293.15;

fn interface_flux_extent_cap_mol(
  self_mass_kg: f32,
  self_rest_density: f32,
  self_temperature_k: f32,
  self_coefficient: f32,
  self_molar_mass: f32,
  self_interface_flux: f32,
  partner_mass_kg: f32,
  partner_rest_density: f32,
  partner_temperature_k: f32,
  partner_coefficient: f32,
  partner_molar_mass: f32,
  partner_interface_flux: f32,
  dt_s: f32
) -> f32 {
  let no_cap = 3.0e38;
  if (dt_s <= 0.0) {
    return no_cap;
  }
  let self_rate = self_interface_flux
    * sqrt(max(self_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(self_coefficient * self_molar_mass, 1.0e-20);
  let partner_rate = partner_interface_flux
    * sqrt(max(partner_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(partner_coefficient * partner_molar_mass, 1.0e-20);
  let mobile_rate = max(self_rate, partner_rate);
  if (mobile_rate <= 0.0) {
    return no_cap;
  }
  let self_radius = pow(
    max(3.0 * self_mass_kg / (12.5663706 * max(self_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let partner_radius = pow(
    max(3.0 * partner_mass_kg / (12.5663706 * max(partner_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let contact_radius = min(self_radius, partner_radius);
  let contact_area = 3.14159265 * contact_radius * contact_radius;
  return mobile_rate * contact_area * dt_s;
}



fn reaction_extended_stoichiometry_enabled() -> bool {
  return params.reaction_table_mode == 1u;
}

fn reaction_stoichiometry_header_ready(reaction_index: u32) -> bool {
  if (!reaction_extended_stoichiometry_enabled()) {
    return false;
  }
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let header2 = reaction_header_row2(reaction_index);
  if (
    !all(vec4<bool>(
      reaction_value_finite(header0.x),
      reaction_value_finite(header0.y),
      reaction_value_finite(header0.z),
      reaction_value_finite(header0.w)
    ))
    || !reaction_value_finite(header1.x)
    || header0.x != f32(reaction_index)
    || header0.y < 0.0
    || header0.y != floor(header0.y)
    || header0.z != 2.0
    || header0.w < 0.0
    || header0.w != floor(header0.w)
    || header1.x < 1.0
    || header1.x != floor(header1.x)
    || header2.z != 1.0
  ) {
    return false;
  }
  let reactant_term_offset = u32(header0.y);
  let reactant_term_count = u32(header0.z);
  let product_term_offset = u32(header0.w);
  let product_term_count = u32(header1.x);
  return reactant_term_offset <= params.reactant_term_count
    && reactant_term_count <= params.reactant_term_count - reactant_term_offset
    && product_term_offset <= params.product_term_count
    && product_term_count <= params.product_term_count - product_term_offset;
}

fn reactant_term_for_material(reaction_index: u32, material_id: f32) -> ReactantTerm {
  if (!reaction_stoichiometry_header_ready(reaction_index)) {
    return ReactantTerm(0.0, 0.0, 0.0, 0.0, 0.0);
  }
  let header0 = reaction_header_row0(reaction_index);
  let reactant_term_offset = u32(header0.y);
  let reactant_term_count = u32(header0.z);
  for (var local = 0u; local < reactant_term_count; local = local + 1u) {
    let term_index = reactant_term_offset + local;
    let term0 = reactant_term_row0(term_index);
    let term2 = reactant_term_row2(term_index);
    if (
      term0.x == f32(reaction_index)
      && term0.y == material_id
      && reaction_value_finite(term0.z)
      && reaction_value_finite(term0.w)
      && term0.z > 0.0
      && term0.w > 0.0
      && term2.z == 1.0
    ) {
      return ReactantTerm(term0.y, term0.z, term0.w, term2.z, term2.w);
    }
  }
  return ReactantTerm(0.0, 0.0, 0.0, 0.0, 0.0);
}

fn reaction_product_terms_ready(reaction_index: u32) -> bool {
  if (!reaction_stoichiometry_header_ready(reaction_index)) {
    return false;
  }
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(header0.w);
  let product_term_count = u32(header1.x);
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (
      term0.x != f32(reaction_index)
      || !reaction_value_finite(term0.y)
      || !reaction_value_finite(term0.z)
      || !reaction_value_finite(term0.w)
      || term0.y <= 0.0
      || term0.z <= 0.0
      || term0.w <= 0.0
      || (term1.y != 0.0 && term1.y != 1.0)
      || term1.z <= 0.0
      || term1.w != 1.0
    ) {
      return false;
    }
  }
  return true;
}

fn product_term_for_local_slot(reaction_index: u32, local_slot: u32) -> ProductTerm {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_count = u32(max(header1.x, 0.0));
  if (product_term_count == 0u) {
    let rx0 = reaction_row0(reaction_index);
    return ProductTerm(rx0.z, 1.0, 0.0, 0.0, 1.0);
  }
  let product_term_offset = u32(max(header0.w, 0.0));
  let local = min(local_slot, product_term_count - 1u);
  let term_index = product_term_offset + local;
  let term0 = product_term_row0(term_index);
  let term1 = product_term_row1(term_index);
  return ProductTerm(term0.y, term0.z, term0.w, term1.y, term1.w);
}

fn product_term_for_visible_slot(reaction_index: u32, visible_slot: u32) -> ProductTerm {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_count = u32(max(header1.x, 0.0));
  let product_term_offset = u32(max(header0.w, 0.0));
  var visible_index = 0u;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term_index = product_term_offset + local;
    let term0 = product_term_row0(term_index);
    let term1 = product_term_row1(term_index);
    let condensed = term1.y < 0.5;
    if (term1.w == 1.0 && condensed) {
      if (visible_index == visible_slot) {
        return ProductTerm(term0.y, term0.z, term0.w, term1.y, term1.w);
      }
      visible_index = visible_index + 1u;
    }
  }
  return ProductTerm(0.0, 0.0, 0.0, 0.0, 0.0);
}

fn product_visible_term_count(reaction_index: u32) -> u32 {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_count = u32(max(header1.x, 0.0));
  let product_term_offset = u32(max(header0.w, 0.0));
  var visible_count = 0u;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term1.y < 0.5) {
      visible_count = visible_count + 1u;
    }
  }
  return visible_count;
}

fn product_term_for_gas_slot(reaction_index: u32, gas_slot: u32) -> ProductTerm {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_count = u32(max(header1.x, 0.0));
  let product_term_offset = u32(max(header0.w, 0.0));
  // Clamp to the last gas term: a lone gas product placed from both freed
  // parent slots receives each parent's own consumed-mass share, so the
  // total placed mass still sums to the stoichiometric product mass.
  var gas_count = 0u;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term1.y >= 0.5) {
      gas_count = gas_count + 1u;
    }
  }
  if (gas_count == 0u) {
    return ProductTerm(0.0, 0.0, 0.0, 0.0, 0.0);
  }
  let target_slot = min(gas_slot, gas_count - 1u);
  var gas_index = 0u;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term_index = product_term_offset + local;
    let term0 = product_term_row0(term_index);
    let term1 = product_term_row1(term_index);
    if (term1.w == 1.0 && term1.y >= 0.5) {
      if (gas_index == target_slot) {
        return ProductTerm(term0.y, term0.z, term0.w, term1.y, term1.w);
      }
      gas_index = gas_index + 1u;
    }
  }
  return ProductTerm(0.0, 0.0, 0.0, 0.0, 0.0);
}

fn product_term_for_parent_slot(reaction_index: u32, parent_slot: u32) -> ProductTerm {
  // Condensed products claim freed parent slots first (they inherit the
  // condensed-pressure role of the consumed reactant); the remaining freed
  // slots place the GAS products as real eos=2 particles. Before this,
  // gas products only ever existed as immovable product-event mass/pressure
  // sources: the event kernel's visible-mass accounting now sees the placed
  // particle and zeroes the event's unplaced share, so the event compacts
  // away on the next pass -- mass is conserved between the two ledgers.
  let visible_count = product_visible_term_count(reaction_index);
  if (parent_slot < visible_count) {
    return product_term_for_visible_slot(reaction_index, parent_slot);
  }
  return product_term_for_gas_slot(reaction_index, parent_slot - visible_count);
}

fn product_raw_mass_sum(reaction_index: u32, extent_mol: f32) -> f32 {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  var sum = 0.0;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term0.z > 0.0 && term0.w > 0.0) {
      sum = sum + extent_mol * term0.z * term0.w;
    }
  }
  return sum;
}

@compute @workgroup_size(64)
fn pack_source(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  let source_state_base = particle_index * 2u;
  let source_thermo_base = particle_index * 3u;
  let source_mechanics_base = particle_index * 8u;
  let out_base = particle_index * REACTION_PARTICLE_RECORD_VEC4S;
  pack_particle_records[out_base] = source_sph_state[source_state_base];
  pack_particle_records[out_base + 1u] = source_sph_state[source_state_base + 1u];
  pack_particle_records[out_base + 2u] = source_sph_thermo[source_thermo_base];
  pack_particle_records[out_base + 3u] = source_sph_thermo[source_thermo_base + 1u];
  pack_particle_records[out_base + 4u] = source_sph_thermo[source_thermo_base + 2u];
  for (var row = 0u; row < 8u; row = row + 1u) {
    pack_particle_records[out_base + 5u + row] = source_mls_mechanics[source_mechanics_base + row];
  }
}

fn reaction_particle_bin_ready() -> bool {
  return reaction_particle_bin_params.bins_enabled != 0u
    && reaction_particle_bin_params.cell_count > 0u
    && reaction_particle_bin_params.bin_capacity > 0u
    && reaction_particle_bin_params.grid_nx > 0u
    && reaction_particle_bin_params.grid_ny > 0u
    && reaction_particle_bin_params.grid_nz > 0u
    && reaction_particle_bin_params.cell_size_m > 0.0;
}

fn schroeder_reaction_law_queue_enabled() -> bool {
  return schroeder_reaction_law_queue_params.enabled != 0u
    && schroeder_reaction_law_queue_params.active_node_count > 0u
    && schroeder_reaction_law_queue_params.law_queue_stride > 0u
    && schroeder_reaction_law_queue_params.reaction_mask != 0u;
}

fn schroeder_reaction_law_queue_allows_particle(particle_index: u32) -> bool {
  if (!schroeder_reaction_law_queue_enabled()) {
    return true;
  }
  if (particle_index >= schroeder_reaction_law_queue_params.active_node_count) {
    return false;
  }
  let queue_stride = max(
    schroeder_reaction_law_queue_params.law_queue_stride,
    SCHROEDER_REACTION_LAW_QUEUE_STRIDE
  );
  let queue_offset = particle_index * queue_stride;
  let queue_status = schroeder_reaction_law_queue_rows[
    queue_offset + SCHROEDER_REACTION_LAW_QUEUE_STATUS_OFFSET
  ];
  let row_enabled = queue_status > 0.0 && queue_status < 32.0;
  let law_mask = u32(max(round(schroeder_reaction_law_queue_rows[
    queue_offset + SCHROEDER_REACTION_LAW_QUEUE_LAW_MASK_OFFSET
  ]), 0.0));
  let reaction_eligible = schroeder_reaction_law_queue_rows[
    queue_offset + SCHROEDER_REACTION_LAW_QUEUE_REACTION_ELIGIBLE_OFFSET
  ] > 0.5;
  return row_enabled
    && reaction_eligible
    && ((law_mask & schroeder_reaction_law_queue_params.reaction_mask) != 0u);
}

fn schroeder_reaction_neighbor_candidates_enabled() -> bool {
  return schroeder_reaction_neighbor_candidate_params.enabled != 0u
    && schroeder_reaction_neighbor_candidate_params.candidate_count > 0u
    && schroeder_reaction_neighbor_candidate_params.candidate_stride > 0u
    && schroeder_reaction_neighbor_candidate_params.reaction_mask != 0u;
}

fn schroeder_reaction_source_spans_enabled() -> bool {
  return schroeder_reaction_neighbor_candidates_enabled()
    && schroeder_reaction_neighbor_candidate_params.source_span_enabled != 0u
    && schroeder_reaction_neighbor_candidate_params.source_span_count > 0u
    && schroeder_reaction_neighbor_candidate_params.source_span_stride > 0u;
}

fn schroeder_reaction_neighbor_candidate_span(particle_index: u32) -> vec4<u32> {
  if (!schroeder_reaction_source_spans_enabled()
      || particle_index >= schroeder_reaction_neighbor_candidate_params.source_span_count) {
    return vec4<u32>(0u, 0u, 0u, 0u);
  }
  let source_span_stride = max(
    schroeder_reaction_neighbor_candidate_params.source_span_stride,
    SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_STRIDE
  );
  let span_offset = particle_index * source_span_stride;
  let status = schroeder_reaction_source_span_rows[
    span_offset + SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_STATUS_OFFSET
  ];
  if (abs(status - SCHROEDER_REACTION_LAW_NEIGHBOR_STATUS_READY) > 0.5) {
    return vec4<u32>(0u, 0u, 0u, 0u);
  }
  let row_source = u32(max(round(schroeder_reaction_source_span_rows[
    span_offset + SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_SOURCE_OFFSET
  ]), 0.0));
  if (row_source != particle_index) {
    return vec4<u32>(0u, 0u, 0u, 0u);
  }
  let span_start = u32(max(round(schroeder_reaction_source_span_rows[
    span_offset + SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_START_OFFSET
  ]), 0.0));
  let span_count = u32(max(round(schroeder_reaction_source_span_rows[
    span_offset + SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_COUNT_OFFSET
  ]), 0.0));
  return vec4<u32>(span_start, span_count, 1u, 0u);
}

fn schroeder_reaction_neighbor_candidate_partner(particle_index: u32, candidate_index: u32) -> u32 {
  if (!schroeder_reaction_neighbor_candidates_enabled()
      || candidate_index >= schroeder_reaction_neighbor_candidate_params.candidate_count) {
    return 4294967295u;
  }
  let candidate_stride = max(
    schroeder_reaction_neighbor_candidate_params.candidate_stride,
    SCHROEDER_REACTION_LAW_NEIGHBOR_STRIDE
  );
  let candidate_offset = candidate_index * candidate_stride;
  let status = schroeder_reaction_neighbor_candidate_rows[
    candidate_offset + SCHROEDER_REACTION_LAW_NEIGHBOR_STATUS_OFFSET
  ];
  if (abs(status - SCHROEDER_REACTION_LAW_NEIGHBOR_STATUS_READY) > 0.5) {
    return 4294967295u;
  }
  let row_source = u32(max(round(schroeder_reaction_neighbor_candidate_rows[
    candidate_offset + SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_OFFSET
  ]), 0.0));
  if (row_source != particle_index) {
    return 4294967295u;
  }
  let law_mask = u32(max(round(schroeder_reaction_neighbor_candidate_rows[
    candidate_offset + SCHROEDER_REACTION_LAW_NEIGHBOR_LAW_MASK_OFFSET
  ]), 0.0));
  if ((law_mask & schroeder_reaction_neighbor_candidate_params.reaction_mask) == 0u) {
    return 4294967295u;
  }
  return u32(max(round(schroeder_reaction_neighbor_candidate_rows[
    candidate_offset + SCHROEDER_REACTION_LAW_NEIGHBOR_NEIGHBOR_OFFSET
  ]), 0.0));
}

fn reaction_particle_bin_coord(value: f32, axis_count: u32) -> u32 {
  if (axis_count <= 1u) {
    return 0u;
  }
  let raw = floor(value * reaction_particle_bin_params.inv_cell_size_m);
  return u32(clamp(raw, 0.0, f32(axis_count - 1u)));
}

fn reaction_particle_bin_cell_index(coords: vec3<u32>) -> u32 {
  return coords.x
    + coords.y * reaction_particle_bin_params.grid_nx
    + coords.z * reaction_particle_bin_params.grid_nx * reaction_particle_bin_params.grid_ny;
}

@compute @workgroup_size(64)
fn bin_particles(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (
    !reaction_particle_bin_ready()
    || particle_index >= reaction_particle_bin_params.particle_count
    || particle_index >= params.particle_count
  ) {
    return;
  }
  let state0 = state_pos_mass(particle_index);
  if (state0.w <= 0.0) {
    return;
  }
  let relative = state0.xyz - vec3<f32>(
    reaction_particle_bin_params.origin_x_m,
    reaction_particle_bin_params.origin_y_m,
    reaction_particle_bin_params.origin_z_m
  );
  let coords = vec3<u32>(
    reaction_particle_bin_coord(relative.x, reaction_particle_bin_params.grid_nx),
    reaction_particle_bin_coord(relative.y, reaction_particle_bin_params.grid_ny),
    reaction_particle_bin_coord(relative.z, reaction_particle_bin_params.grid_nz)
  );
  let cell_index = reaction_particle_bin_cell_index(coords);
  if (cell_index >= reaction_particle_bin_params.cell_count) {
    return;
  }
  let slot = atomicAdd(&reaction_particle_bin_counts[cell_index], 1u);
  if (slot < reaction_particle_bin_params.bin_capacity) {
    reaction_particle_bin_indices[cell_index * reaction_particle_bin_params.bin_capacity + slot] = particle_index;
  } else {
    atomicAdd(&reaction_particle_bin_metadata[0u], 1u);
  }
}

fn reaction_partner_candidate(
  particle_index: u32,
  other: u32,
  reaction_index: u32,
  partner_material: f32,
  partner_phase_mask: f32,
  role: f32,
  activation_k: f32,
  contact_radius2: f32,
  self_temperature: f32,
  self_pos: vec3<f32>,
  best: vec4<f32>
) -> vec4<f32> {
  if (other == particle_index || other >= params.particle_count) {
    return best;
  }
  let other_thermo = thermo_row0(other);
  if (other_thermo.x != partner_material || !phase_mask_satisfied(partner_phase_mask, other_thermo.y)) {
    return best;
  }
  if (max(self_temperature, other_thermo.z) < activation_k) {
    return best;
  }
  let other_pos_mass = state_pos_mass(other);
  if (other_pos_mass.w <= 0.0) {
    return best;
  }
  let delta = self_pos - vec3<f32>(other_pos_mass.x, other_pos_mass.y, other_pos_mass.z);
  let distance2 = dot(delta, delta);
  if (distance2 > contact_radius2) {
    return best;
  }
  if (
    distance2 < best.w
    || (distance2 == best.w && f32(other) < best.x)
  ) {
    return vec4<f32>(f32(other), f32(reaction_index), role, distance2);
  }
  return best;
}

@compute @workgroup_size(64)
fn propose(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  let using_schroeder_candidate_rows = schroeder_reaction_neighbor_candidates_enabled();
  if (!using_schroeder_candidate_rows && !schroeder_reaction_law_queue_allows_particle(particle_index)) {
    proposals[particle_index] = vec4<f32>(-1.0, -1.0, 0.0, 0.0);
    return;
  }

  let self_thermo = thermo_row0(particle_index);
  let self_material = self_thermo.x;
  let self_phase = self_thermo.y;
  let self_temperature = self_thermo.z;
  let self_pos_mass = state_pos_mass(particle_index);
  let self_pos = vec3<f32>(self_pos_mass.x, self_pos_mass.y, self_pos_mass.z);

  var best = vec4<f32>(-1.0, -1.0, 0.0, 3.402823e38);

  for (var reaction_index = 0u; reaction_index < params.reaction_count; reaction_index = reaction_index + 1u) {
    let rx0 = reaction_row0(reaction_index);
    let rx1 = reaction_row1(reaction_index);
    let rx2 = reaction_row2(reaction_index);
    if (rx2.x != 1.0) {
      continue;
    }

    var partner_material = 0.0;
    var partner_phase_mask = 0.0;
    var role = 0.0;
    if (self_material == rx0.x && phase_mask_satisfied(rx1.z, self_phase)) {
      partner_material = rx0.y;
      partner_phase_mask = rx1.w;
      role = 1.0;
    } else if (self_material == rx0.y && phase_mask_satisfied(rx1.w, self_phase)) {
      partner_material = rx0.x;
      partner_phase_mask = rx1.z;
      role = 2.0;
    } else {
      continue;
    }

    let activation_k = rx0.w;
    if (rx1.y <= 0.0) {
      continue;
    }
    let contact_radius2 = rx1.y * rx1.y;
    if (using_schroeder_candidate_rows) {
      let span = schroeder_reaction_neighbor_candidate_span(particle_index);
      var candidate_start = 0u;
      var candidate_end = schroeder_reaction_neighbor_candidate_params.candidate_count;
      if (span.z != 0u) {
        candidate_start = min(span.x, schroeder_reaction_neighbor_candidate_params.candidate_count);
        let max_span_count = schroeder_reaction_neighbor_candidate_params.candidate_count - candidate_start;
        candidate_end = candidate_start + min(span.y, max_span_count);
      }
      for (var candidate_index = candidate_start; candidate_index < candidate_end; candidate_index = candidate_index + 1u) {
        let other = schroeder_reaction_neighbor_candidate_partner(particle_index, candidate_index);
        if (other >= params.particle_count) {
          continue;
        }
        best = reaction_partner_candidate(
          particle_index,
          other,
          reaction_index,
          partner_material,
          partner_phase_mask,
          role,
          activation_k,
          contact_radius2,
          self_temperature,
          self_pos,
          best
        );
      }
    } else if (reaction_particle_bin_ready()) {
      let relative_self = self_pos - vec3<f32>(
        reaction_particle_bin_params.origin_x_m,
        reaction_particle_bin_params.origin_y_m,
        reaction_particle_bin_params.origin_z_m
      );
      let center_coords = vec3<i32>(
        i32(reaction_particle_bin_coord(relative_self.x, reaction_particle_bin_params.grid_nx)),
        i32(reaction_particle_bin_coord(relative_self.y, reaction_particle_bin_params.grid_ny)),
        i32(reaction_particle_bin_coord(relative_self.z, reaction_particle_bin_params.grid_nz))
      );
      let radius_cells = min(
        i32(8),
        max(1, i32(ceil(rx1.y / reaction_particle_bin_params.cell_size_m)))
      );
      for (var dz = -radius_cells; dz <= radius_cells; dz = dz + 1) {
        let cz = center_coords.z + dz;
        if (cz < 0 || cz >= i32(reaction_particle_bin_params.grid_nz)) {
          continue;
        }
        for (var dy = -radius_cells; dy <= radius_cells; dy = dy + 1) {
          let cy = center_coords.y + dy;
          if (cy < 0 || cy >= i32(reaction_particle_bin_params.grid_ny)) {
            continue;
          }
          for (var dx = -radius_cells; dx <= radius_cells; dx = dx + 1) {
            let cx = center_coords.x + dx;
            if (cx < 0 || cx >= i32(reaction_particle_bin_params.grid_nx)) {
              continue;
            }
            let cell_index = reaction_particle_bin_cell_index(vec3<u32>(u32(cx), u32(cy), u32(cz)));
            if (cell_index >= reaction_particle_bin_params.cell_count) {
              continue;
            }
            let count = min(
              atomicLoad(&reaction_particle_bin_counts[cell_index]),
              reaction_particle_bin_params.bin_capacity
            );
            for (var slot = 0u; slot < count; slot = slot + 1u) {
              let other = reaction_particle_bin_indices[cell_index * reaction_particle_bin_params.bin_capacity + slot];
              best = reaction_partner_candidate(
                particle_index,
                other,
                reaction_index,
                partner_material,
                partner_phase_mask,
                role,
                activation_k,
                contact_radius2,
                self_temperature,
                self_pos,
                best
              );
            }
          }
        }
      }
    } else {
      for (var other = 0u; other < params.particle_count; other = other + 1u) {
        best = reaction_partner_candidate(
          particle_index,
          other,
          reaction_index,
          partner_material,
          partner_phase_mask,
          role,
          activation_k,
          contact_radius2,
          self_temperature,
          self_pos,
          best
        );
      }
    }
  }

  proposals[particle_index] = best;
}

@compute @workgroup_size(64)
fn resolve(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let proposal = proposals[particle_index];
  if (
    !all(vec4<bool>(
      reaction_value_finite(proposal.x),
      reaction_value_finite(proposal.y),
      reaction_value_finite(proposal.z),
      reaction_value_finite(proposal.w)
    ))
    || proposal.x < 0.0
    || proposal.x != floor(proposal.x)
    || proposal.x >= f32(params.particle_count)
    || proposal.y < 0.0
    || proposal.y != floor(proposal.y)
    || proposal.y >= f32(params.reaction_count)
    || proposal.w < 0.0
  ) {
    copy_particle(particle_index);
    return;
  }
  let partner_index = u32(proposal.x + 0.5);
  if (partner_index >= params.particle_count) {
    copy_particle(particle_index);
    return;
  }
  let partner_proposal = proposals[partner_index];
  if (
    !all(vec4<bool>(
      reaction_value_finite(partner_proposal.x),
      reaction_value_finite(partner_proposal.y),
      reaction_value_finite(partner_proposal.z),
      reaction_value_finite(partner_proposal.w)
    ))
    || partner_proposal.x < 0.0
    || partner_proposal.x != floor(partner_proposal.x)
    || u32(partner_proposal.x) != particle_index
    || partner_proposal.y != proposal.y
    || partner_proposal.w < 0.0
  ) {
    copy_particle(particle_index);
    return;
  }

  let reaction_index = u32(proposal.y + 0.5);
  if (reaction_index >= params.reaction_count) {
    copy_particle(particle_index);
    return;
  }
  let rx0 = reaction_row0(reaction_index);
  let rx1 = reaction_row1(reaction_index);
  let rx2 = reaction_row2(reaction_index);
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let pos_mass = state_pos_mass(particle_index);
  let partner_pos_mass = state_pos_mass(partner_index);
  let vel_u = state_vel_u(particle_index);
  let partner_vel_u = state_vel_u(partner_index);
  let self_thermo = thermo_row0(particle_index);
  let partner_thermo = thermo_row0(partner_index);
  // Discovery is intentionally allowed to run against immutable x_n before
  // thermal and mechanics commit. Revalidate every chemistry-sensitive field
  // against the current post-thermal state before any material/topology
  // mutation. A stale contact candidate can therefore only become a no-op.
  let self_is_a = self_thermo.x == rx0.x
    && partner_thermo.x == rx0.y
    && phase_mask_satisfied(rx1.z, self_thermo.y)
    && phase_mask_satisfied(rx1.w, partner_thermo.y);
  let self_is_b = self_thermo.x == rx0.y
    && partner_thermo.x == rx0.x
    && phase_mask_satisfied(rx1.w, self_thermo.y)
    && phase_mask_satisfied(rx1.z, partner_thermo.y);
  let pair_delta = pos_mass.xyz - partner_pos_mass.xyz;
  let current_distance2 = dot(pair_delta, pair_delta);
  let contact_radius2 = rx1.y * rx1.y;
  let expected_self_role = select(2.0, 1.0, self_is_a);
  let expected_partner_role = select(1.0, 2.0, self_is_a);
  if (
    !all(vec4<bool>(
      reaction_value_finite(pos_mass.x),
      reaction_value_finite(pos_mass.y),
      reaction_value_finite(pos_mass.z),
      reaction_value_finite(pos_mass.w)
    ))
    || !all(vec4<bool>(
      reaction_value_finite(partner_pos_mass.x),
      reaction_value_finite(partner_pos_mass.y),
      reaction_value_finite(partner_pos_mass.z),
      reaction_value_finite(partner_pos_mass.w)
    ))
    || pos_mass.w <= 0.0
    || partner_pos_mass.w <= 0.0
    || !reaction_value_finite(rx0.x)
    || !reaction_value_finite(rx0.y)
    || !reaction_value_finite(rx0.w)
    || !reaction_value_finite(rx1.y)
    || !reaction_value_finite(rx1.z)
    || !reaction_value_finite(rx1.w)
    || !reaction_value_finite(self_thermo.x)
    || !reaction_value_finite(self_thermo.y)
    || !reaction_value_finite(self_thermo.z)
    || !reaction_value_finite(partner_thermo.x)
    || !reaction_value_finite(partner_thermo.y)
    || !reaction_value_finite(partner_thermo.z)
    || !reaction_value_finite(current_distance2)
    || !reaction_value_finite(contact_radius2)
    || rx2.x != 1.0
    || rx1.y <= 0.0
    || self_is_a == self_is_b
    || proposal.z != expected_self_role
    || partner_proposal.z != expected_partner_role
    || max(self_thermo.z, partner_thermo.z) < rx0.w
    || current_distance2 > contact_radius2
  ) {
    copy_particle(particle_index);
    return;
  }
  let self_current_volume = particle_current_volume(particle_index);
  let partner_current_volume = particle_current_volume(partner_index);
  if (!(self_current_volume > 0.0) || !(partner_current_volume > 0.0)) {
    copy_particle(particle_index);
    return;
  }
  let product_term_count = u32(max(header1.x, 0.0));
  let self_term = reactant_term_for_material(reaction_index, self_thermo.x);
  let partner_term = reactant_term_for_material(reaction_index, partner_thermo.x);
  let has_stoichiometry = self_term.status == 1.0
    && partner_term.status == 1.0
    && self_term.coefficient > 0.0
    && partner_term.coefficient > 0.0
    && self_term.molar_mass > 0.0
    && partner_term.molar_mass > 0.0
    && product_term_count > 0u
    && reaction_product_terms_ready(reaction_index);

  if (!has_stoichiometry) {
    if (reaction_extended_stoichiometry_enabled()) {
      // A current-schema row with a missing, corrupt, cross-reaction, or
      // out-of-range term is a deterministic no-op. Falling through to the
      // old whole-parent conversion here destroys excess unequal-mass
      // reactant and mints product mass.
      copy_particle(particle_index);
      return;
    }
    var legacy_product_material_id = rx0.z;
    var legacy_next_mass = pos_mass.w;
    var legacy_represented_entity_count = thermo_row2(particle_index).y;
    let legacy_next_u = vel_u.w - rx1.x;
    if (product_term_count > 0u) {
      let product_term_offset = u32(max(header0.w, 0.0));
      let slot_index = select(1u, 0u, particle_index < partner_index);
      let local_term = min(slot_index, product_term_count - 1u);
      let term_index = product_term_offset + local_term;
      let term0 = product_term_row0(term_index);
      let term1 = product_term_row1(term_index);
      legacy_product_material_id = term0.y;
      if (product_term_count > 1u) {
        legacy_next_mass = max((pos_mass.w + partner_pos_mass.w) * term1.x, 0.0);
      }
      legacy_represented_entity_count = represented_entity_count_from_mass(
        legacy_next_mass,
        term0.w
      );
    } else if (pos_mass.w > 0.0) {
      legacy_represented_entity_count = thermo_row2(particle_index).y
        * clamp(legacy_next_mass / pos_mass.w, 0.0, 1.0);
    }
    var legacy_current_volume = self_current_volume
      * legacy_next_mass / max(pos_mass.w, 1.0e-20);
    if (product_term_count > 1u) {
      let pair_current_volume = self_current_volume
        + partner_current_volume;
      legacy_current_volume = pair_current_volume * legacy_next_mass
        / max(pos_mass.w + partner_pos_mass.w, 1.0e-20);
    }
    let legacy_written = write_product_particle(
      particle_index,
      legacy_product_material_id,
      legacy_next_mass,
      legacy_current_volume,
      legacy_next_u,
      vel_u.xyz,
      legacy_represented_entity_count
    );
    if (!legacy_written) {
      copy_particle(particle_index);
    }
    return;
  }

  let self_limiting_extent = pos_mass.w / max(self_term.coefficient * self_term.molar_mass, 1.0e-20);
  let partner_limiting_extent = partner_pos_mass.w / max(partner_term.coefficient * partner_term.molar_mass, 1.0e-20);
  // Stoichiometric availability is the CAP; the interface flux sets the rate.
  let extent_availability_mol = min(self_limiting_extent, partner_limiting_extent);
  let extent_flux_cap_mol = interface_flux_extent_cap_mol(
    pos_mass.w, self_thermo.w, self_thermo.z,
    self_term.coefficient, self_term.molar_mass, self_term.interface_flux,
    partner_pos_mass.w, partner_thermo.w, partner_thermo.z,
    partner_term.coefficient, partner_term.molar_mass, partner_term.interface_flux,
    params.dt_s
  );
  let extent_mol = min(extent_availability_mol, extent_flux_cap_mol);
  let self_consumed = min(pos_mass.w, extent_mol * self_term.coefficient * self_term.molar_mass);
  let partner_consumed = min(partner_pos_mass.w, extent_mol * partner_term.coefficient * partner_term.molar_mass);
  let consumed_mass = self_consumed + partner_consumed;
  let raw_product_mass = product_raw_mass_sum(reaction_index, extent_mol);
  if (extent_mol <= 0.0 || consumed_mass <= 0.0 || raw_product_mass <= 0.0) {
    copy_particle(particle_index);
    return;
  }

  let source0_index = min(particle_index, partner_index);
  let source1_index = max(particle_index, partner_index);
  let source0_pos_mass = state_pos_mass(source0_index);
  let source1_pos_mass = state_pos_mass(source1_index);
  let source0_thermo = thermo_row0(source0_index);
  let source1_thermo = thermo_row0(source1_index);
  let source0_term = reactant_term_for_material(reaction_index, source0_thermo.x);
  let source1_term = reactant_term_for_material(reaction_index, source1_thermo.x);
  let source0_current_volume = particle_current_volume(source0_index);
  let source1_current_volume = particle_current_volume(source1_index);
  let source0_consumed = min(source0_pos_mass.w, extent_mol * source0_term.coefficient * source0_term.molar_mass);
  let source1_consumed = min(source1_pos_mass.w, extent_mol * source1_term.coefficient * source1_term.molar_mass);
  let consumed_current_volume =
    source0_current_volume * source0_consumed
      / max(source0_pos_mass.w, 1.0e-20)
    + source1_current_volume * source1_consumed
      / max(source1_pos_mass.w, 1.0e-20);
  let source0_remaining = max(source0_pos_mass.w - source0_consumed, 0.0);
  let source1_remaining = max(source1_pos_mass.w - source1_consumed, 0.0);
  let source0_free = source0_remaining <= max(source0_pos_mass.w, 1.0) * 1.0e-7;
  let source1_free = source1_remaining <= max(source1_pos_mass.w, 1.0) * 1.0e-7;
  let product_mass_scale = consumed_mass / raw_product_mass;

  // Products are born at the consumed pair's mass-weighted COM velocity.
  // Momentum accounting: unconsumed remainders keep their own velocities, so
  // total momentum consumed*v_com + sum(remainder_i*v_i) equals the pair's
  // pre-reaction momentum exactly. The old behavior (each product inherits
  // one parent's full velocity) ejected hot products from the interface at
  // the pre-contact approach speed, carrying the reaction enthalpy away and
  // starving ignition (fork9 energy audit).
  let source0_vel_u = state_vel_u(source0_index);
  let source1_vel_u = state_vel_u(source1_index);
  let source0_velocity = source0_vel_u.xyz;
  let source1_velocity = source1_vel_u.xyz;
  let product_com_velocity = (source0_velocity * source0_consumed + source1_velocity * source1_consumed)
    / max(consumed_mass, 1.0e-20);
  let consumed_total_energy =
    source0_consumed * (source0_vel_u.w + 0.5 * dot(source0_velocity, source0_velocity))
    + source1_consumed * (source1_vel_u.w + 0.5 * dot(source1_velocity, source1_velocity));
  // Changing two reactant velocities to one COM velocity is an inelastic
  // merge. Preserve total energy by thermalizing the relative kinetic energy;
  // rx1.x is specific reaction enthalpy per kg of products (negative when
  // exothermic), so subtracting it adds released chemical heat.
  let product_u = (
    consumed_total_energy
    - rx1.x * consumed_mass
    - 0.5 * consumed_mass * dot(product_com_velocity, product_com_velocity)
  ) / max(consumed_mass, 1.0e-20);
  // Validate every product lane against one deterministic source row before
  // either reacting invocation mutates. A corrupt phase/mechanics record
  // therefore rejects the pair atomically rather than publishing one product.
  for (var product_local = 0u; product_local < product_term_count; product_local = product_local + 1u) {
    let product_term_index = u32(max(header0.w, 0.0)) + product_local;
    let product_term0 = product_term_row0(product_term_index);
    let product_term1 = product_term_row1(product_term_index);
    let product_mass = extent_mol * product_term0.z * product_term0.w
      * product_mass_scale;
    let product_current_volume = consumed_current_volume
      * product_mass / max(consumed_mass, 1.0e-20);
    if (
      product_term1.w != 1.0
      || !product_output_ready(
        source0_index,
        product_term0.y,
        product_mass,
        product_current_volume,
        product_u,
        product_com_velocity
      )
    ) {
      copy_particle(particle_index);
      return;
    }
  }

  var emits_product = false;
  var local_product_slot = 0u;
  var emitted_product_mass = 0.0;
  if (product_term_count == 1u) {
    if (particle_index == source0_index && source0_free) {
      emits_product = true;
      emitted_product_mass = select(consumed_mass, source0_consumed, source1_free);
    }
    if (particle_index == source1_index && source1_free) {
      emits_product = true;
      local_product_slot = select(0u, 1u, source0_free);
      emitted_product_mass = select(consumed_mass, source1_consumed, source0_free);
    }
  } else {
    if (particle_index == source0_index && source0_free) {
      emits_product = true;
      local_product_slot = 0u;
    }
    if (particle_index == source1_index && source1_free) {
      emits_product = true;
      local_product_slot = select(0u, 1u, source0_free);
    }
    if (emits_product && local_product_slot < product_term_count) {
      let product_term = product_term_for_parent_slot(reaction_index, local_product_slot);
      emitted_product_mass = extent_mol * product_term.coefficient * product_term.molar_mass * product_mass_scale;
    }
  }

  if (emits_product) {
    // Freed parent slots place condensed products first, then gas products
    // (product_term_for_parent_slot): the H2/gas term that previously only
    // existed as a frozen product event becomes a real eos=2 particle here.
    let product_term = product_term_for_parent_slot(reaction_index, local_product_slot);
    if (product_term.status == 1.0 && product_term.material_id > 0.0 && emitted_product_mass > 0.0) {
      let emitted_product_current_volume = consumed_current_volume
        * emitted_product_mass / max(consumed_mass, 1.0e-20);
      let product_written = write_product_particle(
        particle_index,
        product_term.material_id,
        emitted_product_mass,
        emitted_product_current_volume,
        product_u,
        product_com_velocity,
        represented_entity_count_from_mass(
          emitted_product_mass,
          product_term.molar_mass
        )
      );
      if (product_written) {
        return;
      }
      copy_particle(particle_index);
      return;
    }
  }

  let self_remaining = max(pos_mass.w - self_consumed, 0.0);
  copy_particle_with_mass(particle_index, self_remaining);
}

@compute @workgroup_size(64)
fn unpack(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  let base = particle_index * REACTION_PARTICLE_RECORD_VEC4S;
  unpack_sph_state[particle_index * 2u] = out_particle_records[base];
  unpack_sph_state[particle_index * 2u + 1u] = out_particle_records[base + 1u];
  unpack_sph_thermo[particle_index * 3u] = out_particle_records[base + 2u];
  unpack_sph_thermo[particle_index * 3u + 1u] = out_particle_records[base + 3u];
  unpack_sph_thermo[particle_index * 3u + 2u] = out_particle_records[base + 4u];
  let mechanics_base = particle_index * 8u;
  for (var row = 0u; row < 8u; row = row + 1u) {
    unpack_mls_mechanics[mechanics_base + row] = out_particle_records[base + 5u + row];
  }
}
`;

export const sphReactionProductEventCompactWgsl = `
struct ProductEventCompactParams {
  row_count: u32,
  row_stride_vec4: u32,
  group_count: u32,
  _pad1: u32,
};

@group(0) @binding(0) var<storage, read> source_events: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> compact_events: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> compact_counts: array<u32>;
@group(0) @binding(3) var<uniform> params: ProductEventCompactParams;
@group(0) @binding(4) var<storage, read_write> placement_completion_receipt: array<u32>;
@group(0) @binding(5) var<storage, read_write> compact_local_prefix_flags: array<u32>;
@group(0) @binding(6) var<storage, read_write> compact_group_counts: array<u32>;
@group(0) @binding(7) var<storage, read_write> compact_group_offsets: array<u32>;

var<workgroup> compact_scan_rows: array<u32, 64>;

// Single-invocation loop keeps compacted row order identical to source order so
// downstream f32 accumulations over events stay deterministic across runs.
@compute @workgroup_size(1)
fn compact_rows(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u) {
    return;
  }
  let stride = params.row_stride_vec4;
  if (stride < 8u) {
    return;
  }
  var live_rows = 0u;
  for (var row = 0u; row < params.row_count; row = row + 1u) {
    let base = row * stride;
    let event_row2 = source_events[base + 2u];
    let unplaced_mass_kg = source_events[base + 3u].y;
    let event_row4 = source_events[base + 4u];
    let event_row7 = source_events[base + 7u];
    let status = event_row4.z;
    let phase_id = event_row2.w;
    let rest_density = event_row4.y;
    let mechanics_status = event_row7.z;
    if (
      status != 1.0
      || mechanics_status != 1.0
      || !(phase_id > 0.0)
      || !(rest_density > 0.0)
      || unplaced_mass_kg <= 0.0
    ) {
      continue;
    }
    let out_base = live_rows * stride;
    for (var component = 0u; component < stride; component = component + 1u) {
      compact_events[out_base + component] = source_events[base + component];
    }
    live_rows = live_rows + 1u;
  }
  compact_counts[0] = live_rows;
}

// Compatibility-only compactor for callers without canonical placement
// authority. The authenticated Slice 8 route never creates this pipeline.
@compute @workgroup_size(1)
fn compact_placement_rows(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u) { return; }
  let stride = params.row_stride_vec4;
  if (stride < 8u) {
    compact_counts[0] = 0u;
    return;
  }
  var live_rows = 0u;
  for (var row = 0u; row < params.row_count; row = row + 1u) {
    let base = row * stride;
    let product_mass_kg = max(source_events[base].w, 0.0);
    let unplaced_mass_kg = max(source_events[base + 3u].y, 0.0);
    if (!(product_mass_kg > 0.0 || unplaced_mass_kg > 0.0)) { continue; }
    let out_base = live_rows * stride;
    for (var component = 0u; component < stride; component = component + 1u) {
      compact_events[out_base + component] = source_events[base + component];
    }
    live_rows = live_rows + 1u;
  }
  compact_counts[0] = live_rows;
}

// Count live placement rows and compute an exclusive stable prefix inside each
// 64-row group. This replaces the old single invocation N x product-term
// compaction scan. The high bit stores liveness; the remaining bits store the
// group-local exclusive prefix.
@compute @workgroup_size(64)
fn count_placement_rows(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let row = global_id.x;
  let lane = local_id.x;
  var live = 0u;
  let stride = params.row_stride_vec4;
  if (row < params.row_count && stride >= 8u) {
    let base = row * stride;
    let product_mass_kg = max(source_events[base].w, 0.0);
    let unplaced_mass_kg = max(source_events[base + 3u].y, 0.0);
    live = select(0u, 1u, product_mass_kg > 0.0 || unplaced_mass_kg > 0.0);
  }
  compact_scan_rows[lane] = live;
  workgroupBarrier();
  var offset = 1u;
  loop {
    if (offset >= 64u) { break; }
    var preceding = 0u;
    if (lane >= offset) {
      preceding = compact_scan_rows[lane - offset];
    }
    workgroupBarrier();
    let current = compact_scan_rows[lane];
    workgroupBarrier();
    compact_scan_rows[lane] = current + preceding;
    workgroupBarrier();
    offset = offset * 2u;
  }
  if (row < params.row_count && row < arrayLength(&compact_local_prefix_flags)) {
    let inclusive = compact_scan_rows[lane];
    let exclusive = inclusive - live;
    compact_local_prefix_flags[row] = exclusive | select(0u, 0x80000000u, live != 0u);
  }
  if (lane == 63u && workgroup_id.x < arrayLength(&compact_group_counts)) {
    compact_group_counts[workgroup_id.x] = compact_scan_rows[63u];
  }
  if (
    row == 0u
    && arrayLength(&placement_completion_receipt) >= ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS}u
  ) {
    placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactCountPassCount}] = 1u;
    placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactionInputVisitCount}] = params.row_count;
  }
}

// Scan only the group totals (ceil(N/64)), never the dense event capacity.
@compute @workgroup_size(1)
fn scan_placement_row_groups(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u) { return; }
  var total = 0u;
  var overflow = 0u;
  let group_count = min(params.group_count, arrayLength(&compact_group_counts));
  for (var group = 0u; group < group_count; group = group + 1u) {
    if (group >= arrayLength(&compact_group_offsets)) {
      overflow = overflow + 1u;
      continue;
    }
    compact_group_offsets[group] = total;
    let next_total = total + compact_group_counts[group];
    if (next_total < total || next_total > params.row_count) {
      overflow = overflow + 1u;
    }
    total = min(next_total, params.row_count);
  }
  compact_counts[0] = select(total, 0u, overflow != 0u);
  if (arrayLength(&placement_completion_receipt) >= ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS}u) {
    placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactScanPassCount}] = 1u;
    placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.activeEventCount}] = compact_counts[0];
    placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactionLiveFlagCount}] = total;
    placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactionOverflowCount}] = overflow;
  }
}

// Scatter every live row independently. group offset + local exclusive prefix
// is the stable source-order destination index.
@compute @workgroup_size(64)
fn scatter_placement_rows(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let row = global_id.x;
  if (row == 0u && arrayLength(&placement_completion_receipt) >= ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS}u) {
    placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactScatterPassCount}] = 1u;
  }
  if (
    row >= params.row_count
    || row >= arrayLength(&compact_local_prefix_flags)
    || workgroup_id.x >= arrayLength(&compact_group_offsets)
  ) {
    return;
  }
  let packed_prefix = compact_local_prefix_flags[row];
  if ((packed_prefix & 0x80000000u) == 0u) { return; }
  let destination = compact_group_offsets[workgroup_id.x]
    + (packed_prefix & 0x7fffffffu);
  if (destination >= compact_counts[0]) { return; }
  let stride = params.row_stride_vec4;
  let source_base = row * stride;
  let destination_base = destination * stride;
  for (var component = 0u; component < stride; component = component + 1u) {
    compact_events[destination_base + component] = source_events[source_base + component];
  }
}
`;

// Resident product history is append-only after product placement. This
// kernel filters each new source before appending it to a stable live prefix,
// so the hot loop never needs to map a compacted count. Each published logical
// view owns an immutable aligned control record; later views may share the
// data buffer without widening an older view's readable prefix.
export const sphResidentProductHistoryFilteredAppendWgsl = `
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
};

@group(0) @binding(0) var<storage, read_write> history_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_a_rows: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_b_rows: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> parent_control: array<u32>;
@group(0) @binding(4) var<storage, read_write> next_control: array<u32>;
@group(0) @binding(5) var<uniform> params: ResidentProductHistoryAppendParams;

const HISTORY_CONTROL_MAGIC: u32 = 0x50484731u;
const HISTORY_CONTROL_VERSION: u32 = 1u;
const HISTORY_CONTROL_READY: u32 = 1u;
const HISTORY_CONTROL_FAILED: u32 = 0x80000000u;
const HISTORY_ERROR_PARENT: u32 = 1u;
const HISTORY_ERROR_SOURCE: u32 = 2u;
const HISTORY_ERROR_CAPACITY: u32 = 4u;

fn history_source_row_live(
  source_kind: u32,
  row: u32,
  stride: u32
) -> bool {
  let base = row * stride;
  if (source_kind == 0u) {
    let bound = arrayLength(&source_a_rows);
    if (stride < 8u || base > bound || stride > bound - base) {
      return false;
    }
    let row2 = source_a_rows[base + 2u];
    let row3 = source_a_rows[base + 3u];
    let row4 = source_a_rows[base + 4u];
    let row7 = source_a_rows[base + 7u];
    return row4.z == 1.0
      && row7.z == 1.0
      && row2.w > 0.0
      && row4.y > 0.0
      && row3.y > 0.0;
  }
  let bound = arrayLength(&source_b_rows);
  if (stride < 8u || base > bound || stride > bound - base) {
    return false;
  }
  let row2 = source_b_rows[base + 2u];
  let row3 = source_b_rows[base + 3u];
  let row4 = source_b_rows[base + 4u];
  let row7 = source_b_rows[base + 7u];
  return row4.z == 1.0
    && row7.z == 1.0
    && row2.w > 0.0
    && row4.y > 0.0
    && row3.y > 0.0;
}

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

fn history_copy_source_row(
  source_kind: u32,
  source_row: u32,
  destination_row: u32,
  stride: u32
) {
  let source_base = source_row * stride;
  let destination_base = destination_row * stride;
  for (var component = 0u; component < stride; component = component + 1u) {
    if (source_kind == 0u) {
      history_rows[destination_base + component] =
        source_a_rows[source_base + component];
    } else {
      history_rows[destination_base + component] =
        source_b_rows[source_base + component];
    }
  }
}

@compute @workgroup_size(1)
fn append_filtered_sources(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u) { return; }
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
    || params.expected_parent_row_stride_vec4
      != params.row_stride_vec4
    || parent_control[3u] > params.expected_parent_row_capacity
  ) {
    history_fail(HISTORY_ERROR_PARENT);
    return;
  }
  let stride = params.row_stride_vec4;
  let capacity = params.row_capacity;
  if (
    stride < 8u
    || capacity == 0u
    || capacity > arrayLength(&history_rows) / stride
  ) {
    history_fail(HISTORY_ERROR_CAPACITY);
    return;
  }
  let parent_count = parent_control[3u];
  let source_a_count = select(
    params.source_a_row_count,
    parent_count,
    params.source_a_uses_parent_count == 1u
  );
  if (
    source_a_count > arrayLength(&source_a_rows) / stride
    || params.source_b_row_count > arrayLength(&source_b_rows) / stride
  ) {
    history_fail(HISTORY_ERROR_SOURCE);
    return;
  }
  var appended_count = 0u;
  for (var row = 0u; row < source_a_count; row = row + 1u) {
    if (history_source_row_live(0u, row, stride)) {
      appended_count = appended_count + 1u;
    }
  }
  for (var row = 0u; row < params.source_b_row_count; row = row + 1u) {
    if (history_source_row_live(1u, row, stride)) {
      appended_count = appended_count + 1u;
    }
  }
  let base_count = select(
    0u,
    parent_count,
    params.reuse_parent_prefix == 1u
  );
  if (appended_count > capacity || base_count > capacity - appended_count) {
    history_fail(HISTORY_ERROR_CAPACITY);
    return;
  }
  var destination = base_count;
  for (var row = 0u; row < source_a_count; row = row + 1u) {
    if (history_source_row_live(0u, row, stride)) {
      history_copy_source_row(0u, row, destination, stride);
      destination = destination + 1u;
    }
  }
  for (var row = 0u; row < params.source_b_row_count; row = row + 1u) {
    if (history_source_row_live(1u, row, stride)) {
      history_copy_source_row(1u, row, destination, stride);
      destination = destination + 1u;
    }
  }
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
}
`;

// Places unplaced product-event mass into spare (zero-mass) particle slots so
// gas products become real mechanics citizens instead of immovable event
// sources. Single-invocation deterministic loop (same policy as the event
// compactor): event order and slot-claim order are stable across runs.
// Conservation: the event carries the products' mass share, COM velocity,
// specific internal energy (parent energies + enthalpy share), temperature,
// rest density, and mechanics; placing it moves those amounts verbatim from
// the event ledger onto one particle and zeroes the event, so the event
// splat and the particle P2G never both see the same mass.
const sphReactionProductEventPlacementCombinedWgsl = `
struct ProductEventPlacementParams {
  particle_count: u32,
  event_row_count: u32,
  event_stride_vec4: u32,
  state_stride_vec4: u32,
  thermo_stride_vec4: u32,
  mechanics_stride_vec4: u32,
  min_placed_mass_kg: f32,
  product_term_count: u32,
  box_x_m: f32,
  box_y_m: f32,
  box_z_m: f32,
  box_clamp_enabled: u32,
  canonical_spatial_enabled: u32,
  generation_id: u32,
  support_profile_id: u32,
  receipt_version: u32,
};

@group(0) @binding(0) var<storage, read_write> product_events: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> next_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> next_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> next_mechanics: array<vec4<f32>>;
@group(0) @binding(4) var<uniform> params: ProductEventPlacementParams;
@group(0) @binding(5) var<storage, read_write> placement_summary: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read> compact_counts: array<u32>;
// ULG_PRODUCT_PLACEMENT_SPATIAL_BINDINGS_BEGIN
@group(0) @binding(9) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(10) var<uniform> spatial_expectation: SchroederSpatialExactNearExpectationV1;
@group(0) @binding(11) var<storage, read> frozen_placement_source_state: array<vec4<f32>>;
@group(0) @binding(12) var<storage, read_write> placement_decisions: array<vec4<f32>>;
@group(0) @binding(13) var<storage, read_write> placement_control: array<vec4<f32>>;
@group(0) @binding(14) var<storage, read_write> placement_completion_receipt: array<u32>;

${schroederSpatialExactNearTraversalV1Wgsl}
// ULG_PRODUCT_PLACEMENT_SPATIAL_BINDINGS_END

const PHASE_COMPANION_RESERVED_STATUS: f32 = 254.0;
const REACTION_PRODUCT_PLACEMENT_AVOGADRO_PER_MOL: f32 = 6.02214076e23;

fn placement_represented_entity_count_for_product_mass(
  mass_kg: f32,
  molar_mass_kg_per_mol: f32
) -> f32 {
  if (
    !(mass_kg > 0.0)
    || !(molar_mass_kg_per_mol > 0.0)
    || mass_kg != mass_kg
    || molar_mass_kg_per_mol != molar_mass_kg_per_mol
  ) {
    return 0.0;
  }
  let represented_entity_count = mass_kg / molar_mass_kg_per_mol
    * REACTION_PRODUCT_PLACEMENT_AVOGADRO_PER_MOL;
  return select(
    0.0,
    represented_entity_count,
    represented_entity_count == represented_entity_count
      && abs(represented_entity_count) <= 3.0e38
  );
}

fn placement_product_event_moles_match_mass(
  product_mass_kg: f32,
  product_moles: f32,
  molar_mass_kg_per_mol: f32
) -> bool {
  if (
    !(product_mass_kg > 0.0)
    || !(product_moles > 0.0)
    || !(molar_mass_kg_per_mol > 0.0)
    || product_mass_kg != product_mass_kg
    || product_moles != product_moles
    || molar_mass_kg_per_mol != molar_mass_kg_per_mol
  ) {
    return false;
  }
  let derived_moles = product_mass_kg / molar_mass_kg_per_mol;
  if (
    !(derived_moles > 0.0)
    || derived_moles != derived_moles
    || abs(derived_moles) > 3.0e38
  ) {
    return false;
  }
  let tolerance = max(
    1.0e-20,
    1.0e-5 * max(abs(product_moles), abs(derived_moles))
  );
  return abs(product_moles - derived_moles) <= tolerance;
}

fn placement_summary_base(product_term_index: u32) -> u32 {
  return product_term_index * 8u;
}

fn record_placement_identity(base: u32, row1: vec4<f32>, row2: vec4<f32>) {
  placement_summary[base] = vec4<f32>(row1.x, row1.y, row1.z, row2.z);
  let header = placement_summary[base + 1u];
  placement_summary[base + 1u] = vec4<f32>(row2.w, 1.0, header.z, header.w);
}

fn record_ready_product(base: u32, product_mass_kg: f32, direct_placed_mass_kg: f32) {
  let header = placement_summary[base + 1u];
  placement_summary[base + 1u] = vec4<f32>(header.x, header.y, header.z + 1.0, header.w);
  let counts = placement_summary[base + 2u];
  placement_summary[base + 2u] = vec4<f32>(
    counts.x + select(0.0, 1.0, direct_placed_mass_kg > 0.0),
    counts.y,
    counts.z,
    counts.w
  );
  let masses = placement_summary[base + 4u];
  placement_summary[base + 4u] = vec4<f32>(
    masses.x + product_mass_kg,
    masses.y + direct_placed_mass_kg,
    masses.z,
    masses.w
  );
  let maxima = placement_summary[base + 7u];
  placement_summary[base + 7u] = vec4<f32>(maxima.x, maxima.y, maxima.z, max(maxima.w, product_mass_kg));
}

fn record_placement_candidate(base: u32) {
  let header = placement_summary[base + 1u];
  placement_summary[base + 1u] = vec4<f32>(header.x, header.y, header.z, header.w + 1.0);
}

fn record_rejected_placement(base: u32, rejected_mass_kg: f32) {
  let counts = placement_summary[base + 3u];
  placement_summary[base + 3u] = vec4<f32>(counts.x, counts.y, counts.z + 1.0, counts.w);
  let masses = placement_summary[base + 5u];
  placement_summary[base + 5u] = vec4<f32>(masses.x, masses.y, masses.z, masses.w + rejected_mass_kg);
}

fn record_unplaced(base: u32, mass_kg: f32, subthreshold: bool) {
  let counts = placement_summary[base + 3u];
  placement_summary[base + 3u] = vec4<f32>(
    counts.x + 1.0,
    counts.y + select(0.0, 1.0, subthreshold),
    counts.z,
    counts.w
  );
  let masses = placement_summary[base + 5u];
  placement_summary[base + 5u] = vec4<f32>(
    masses.x,
    masses.y + mass_kg,
    masses.z + select(0.0, mass_kg, subthreshold),
    masses.w
  );
  let maxima = placement_summary[base + 6u];
  placement_summary[base + 6u] = vec4<f32>(maxima.x, maxima.y, maxima.z, max(maxima.w, mass_kg));
}

fn record_capture_merge(base: u32, mass_kg: f32, post_merge_mass_kg: f32, distance_m: f32) {
  let counts = placement_summary[base + 2u];
  placement_summary[base + 2u] = vec4<f32>(counts.x, counts.y, counts.z + 1.0, counts.w);
  let masses = placement_summary[base + 4u];
  placement_summary[base + 4u] = vec4<f32>(masses.x, masses.y, masses.z, masses.w + mass_kg);
  let maxima = placement_summary[base + 6u];
  placement_summary[base + 6u] = vec4<f32>(
    maxima.x,
    max(maxima.y, mass_kg),
    max(maxima.z, post_merge_mass_kg),
    maxima.w
  );
  let distances = placement_summary[base + 7u];
  placement_summary[base + 7u] = vec4<f32>(max(distances.x, distance_m), distances.y, distances.z, distances.w);
}

fn record_fallback_merge(base: u32, mass_kg: f32, post_merge_mass_kg: f32, distance_m: f32) {
  let counts = placement_summary[base + 2u];
  placement_summary[base + 2u] = vec4<f32>(counts.x, counts.y, counts.z, counts.w + 1.0);
  let masses = placement_summary[base + 5u];
  placement_summary[base + 5u] = vec4<f32>(masses.x + mass_kg, masses.y, masses.z, masses.w);
  let maxima = placement_summary[base + 6u];
  placement_summary[base + 6u] = vec4<f32>(
    maxima.x,
    max(maxima.y, mass_kg),
    max(maxima.z, post_merge_mass_kg),
    maxima.w
  );
  let distances = placement_summary[base + 7u];
  placement_summary[base + 7u] = vec4<f32>(distances.x, max(distances.y, distance_m), distances.z, distances.w);
}

fn record_spare_placement(base: u32, mass_kg: f32, support_radius_m: f32) {
  let counts = placement_summary[base + 2u];
  placement_summary[base + 2u] = vec4<f32>(counts.x, counts.y + 1.0, counts.z, counts.w);
  let masses = placement_summary[base + 4u];
  placement_summary[base + 4u] = vec4<f32>(masses.x, masses.y, masses.z + mass_kg, masses.w);
  let maxima = placement_summary[base + 6u];
  placement_summary[base + 6u] = vec4<f32>(max(maxima.x, mass_kg), maxima.y, maxima.z, maxima.w);
  let distances = placement_summary[base + 7u];
  placement_summary[base + 7u] = vec4<f32>(distances.x, distances.y, max(distances.z, support_radius_m), distances.w);
}

fn record_phase_routed_event(base: u32) {
  let counts = placement_summary[base + 3u];
  placement_summary[base + 3u] = vec4<f32>(counts.xyz, counts.w + 1.0);
}

fn placement_phase_is_liquid(phase_id: f32) -> bool {
  return phase_id >= 1.5 && phase_id < 2.5;
}

fn placement_phase_is_condensed(phase_id: f32) -> bool {
  return phase_id > 0.5 && phase_id < 2.5;
}

fn placement_phase_is_gas(phase_id: f32) -> bool {
  return phase_id >= 2.5 && phase_id < 3.5;
}

fn placement_reactant_radius_m(pos_mass: vec4<f32>, thermo0: vec4<f32>) -> f32 {
  if (!(pos_mass.w > 0.0) || !(thermo0.w > 0.0)) {
    return 0.0;
  }
  return pow(
    max(3.0 * pos_mass.w / (12.5663706 * thermo0.w), 1.0e-30),
    1.0 / 3.0
  );
}

fn placement_support_fits_box(support_radius_m: f32) -> bool {
  if (params.box_clamp_enabled == 0u) {
    return true;
  }
  let box_dims = vec3<f32>(params.box_x_m, params.box_y_m, params.box_z_m);
  let max_margin_m = 0.5 * min(box_dims.x, min(box_dims.y, box_dims.z));
  return support_radius_m <= max_margin_m;
}

fn placement_clamp_to_box(position: vec3<f32>, support_margin_m: f32) -> vec3<f32> {
  if (params.box_clamp_enabled == 0u) {
    return position;
  }
  let box_dims = vec3<f32>(params.box_x_m, params.box_y_m, params.box_z_m);
  let max_margin_m = 0.5 * min(box_dims.x, min(box_dims.y, box_dims.z));
  let margin_m = clamp(support_margin_m, 0.0, max_margin_m);
  return clamp(
    position,
    vec3<f32>(margin_m),
    box_dims - vec3<f32>(margin_m)
  );
}

fn placement_pair_preserving_shift(
  source_position: vec3<f32>,
  partner_position: vec3<f32>,
  desired_shift: vec3<f32>,
  support_margin_m: f32
) -> vec4<f32> {
  if (params.box_clamp_enabled == 0u) {
    return vec4<f32>(desired_shift, 1.0);
  }
  let box_dims = vec3<f32>(params.box_x_m, params.box_y_m, params.box_z_m);
  let max_margin_m = 0.5 * min(box_dims.x, min(box_dims.y, box_dims.z));
  if (support_margin_m > max_margin_m) {
    return vec4<f32>(desired_shift, 0.0);
  }
  let margin_m = max(support_margin_m, 0.0);
  let lower = max(
    vec3<f32>(margin_m) - source_position,
    vec3<f32>(margin_m) - partner_position
  );
  let upper = min(
    box_dims - vec3<f32>(margin_m) - source_position,
    box_dims - vec3<f32>(margin_m) - partner_position
  );
  if (!all(lower <= upper)) {
    return vec4<f32>(desired_shift, 0.0);
  }
  let bounded_shift = clamp(desired_shift, lower, upper);
  let shift_error = bounded_shift - desired_shift;
  if (dot(shift_error, shift_error) > 1.0e-10) {
    return vec4<f32>(desired_shift, 0.0);
  }
  return vec4<f32>(bounded_shift, 1.0);
}

// Reaction placement must use the current reacting pair rather than the
// render-cadence material-interface table: source state is fresh for this
// reaction tick, deterministic, and already GPU resident. Select the
// condensed host (liquid first, then any condensed phase, then higher rest
// density, then lower stable particle index), point toward the other carrier,
// and route the gas center beyond the other reactant's surface by the gas
// support radius. As a merged bubble grows, its center advances by the radius
// growth so its volume does not expand back through the reacting pair.
// A zero w lane means the derivation failed and callers retain the midpoint.
fn placement_gas_target(
  source_index: u32,
  partner_index: u32,
  fallback_position: vec3<f32>,
  product_support_radius_m: f32
) -> vec4<f32> {
  if (
    source_index >= params.particle_count
    || partner_index >= params.particle_count
    || source_index == partner_index
  ) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let source_pos_mass = source_state[source_index * params.state_stride_vec4];
  let partner_pos_mass = source_state[partner_index * params.state_stride_vec4];
  let source_thermo0 = source_thermo[source_index * params.thermo_stride_vec4];
  let partner_thermo0 = source_thermo[partner_index * params.thermo_stride_vec4];
  let source_radius_m = placement_reactant_radius_m(source_pos_mass, source_thermo0);
  let partner_radius_m = placement_reactant_radius_m(partner_pos_mass, partner_thermo0);
  if (!(source_radius_m > 0.0) || !(partner_radius_m > 0.0)) {
    return vec4<f32>(fallback_position, 0.0);
  }

  let source_liquid = placement_phase_is_liquid(source_thermo0.y);
  let partner_liquid = placement_phase_is_liquid(partner_thermo0.y);
  let source_condensed = placement_phase_is_condensed(source_thermo0.y);
  let partner_condensed = placement_phase_is_condensed(partner_thermo0.y);
  var host_is_source = source_index < partner_index;
  if (source_liquid != partner_liquid) {
    host_is_source = source_liquid;
  } else if (source_condensed != partner_condensed) {
    host_is_source = source_condensed;
  } else if (abs(source_thermo0.w - partner_thermo0.w) > 1.0e-6) {
    host_is_source = source_thermo0.w > partner_thermo0.w;
  }

  let host_position = select(partner_pos_mass.xyz, source_pos_mass.xyz, host_is_source);
  let free_position = select(source_pos_mass.xyz, partner_pos_mass.xyz, host_is_source);
  let free_radius_m = select(source_radius_m, partner_radius_m, host_is_source);
  let host_to_free = free_position - host_position;
  let separation2 = dot(host_to_free, host_to_free);
  if (!(separation2 > 1.0e-20)) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let contact_radius_m = min(source_radius_m, partner_radius_m);
  let outward_normal = host_to_free / sqrt(separation2);
  let product_radius_m = max(product_support_radius_m, 0.0);
  if (!placement_support_fits_box(product_radius_m)) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let required_clearance_m = free_radius_m + product_radius_m;
  var target_position = free_position + outward_normal * required_clearance_m;
  target_position = placement_clamp_to_box(target_position, product_radius_m);
  let final_clearance_m = dot(target_position - free_position, outward_normal);
  if (final_clearance_m < required_clearance_m - 1.0e-5) {
    return vec4<f32>(fallback_position, 0.0);
  }
  return vec4<f32>(target_position, contact_radius_m);
}

fn placement_route_gas_merge_position(
  original_event_position: vec3<f32>,
  routed_event_position: vec3<f32>,
  phase_id: f32,
  event_support_radius_m: f32,
  merged_rest_volume_m3: f32,
  fallback_position: vec3<f32>
) -> vec4<f32> {
  if (!placement_phase_is_gas(phase_id) || !(merged_rest_volume_m3 > 0.0)) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let route = routed_event_position - original_event_position;
  let route_length2 = dot(route, route);
  if (!(route_length2 > 1.0e-20)) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let merged_support_radius_m = pow(
    max(merged_rest_volume_m3 * 0.238732414637843, 1.0e-30),
    1.0 / 3.0
  );
  if (!placement_support_fits_box(merged_support_radius_m)) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let growth_offset_m = max(merged_support_radius_m - event_support_radius_m, 0.0);
  let outward_normal = route / sqrt(route_length2);
  let required_position = routed_event_position + outward_normal * growth_offset_m;
  let outward_penetration_m = max(
    dot(required_position - fallback_position, outward_normal),
    0.0
  );
  let projected_position = fallback_position + outward_normal * outward_penetration_m;
  let clamped_position = placement_clamp_to_box(projected_position, merged_support_radius_m);
  if (dot(clamped_position - required_position, outward_normal) < -1.0e-5) {
    return vec4<f32>(fallback_position, 0.0);
  }
  return vec4<f32>(clamped_position, 1.0);
}

fn placement_particle_rest_volume_m3(particle_index: u32) -> f32 {
  if (particle_index >= params.particle_count) {
    return 0.0;
  }
  let mechanics_row4 = next_mechanics[
    particle_index * params.mechanics_stride_vec4 + 4u
  ];
  if (mechanics_row4.w > 0.0) {
    return mechanics_row4.w;
  }
  let state0 = next_state[particle_index * params.state_stride_vec4];
  let thermo0 = next_thermo[particle_index * params.thermo_stride_vec4];
  if (state0.w > 0.0 && thermo0.w > 0.0) {
    return state0.w / thermo0.w;
  }
  return 0.0;
}

// ULG_PRODUCT_PLACEMENT_SPATIAL_CLASSIFICATION_BEGIN
// LEGACY TEMPLATE-ONLY CLASSIFICATION BODY. The exported commit module removes
// this entire marked region before shader compilation. Slice 8 production uses
// sphReactionProductEventSpatialClassificationWgsl plus the parallel envelope
// module; no runtime pipeline can select the serial helper below.
struct PlacementCaptureResult {
  slot: u32,
  malformed: u32,
  distance_m: f32,
  _pad0: f32,
};

// The canonical directory indexes immutable fresh post-reaction placement
// positions, while placement observes its separately initialized destination.
// A radius/displacement envelope keeps lookup complete before exact filtering.
// ULG_PRODUCT_PLACEMENT_ENVELOPE_HELPER_BEGIN
fn placement_live_radius_and_displacement_envelope() -> vec2<f32> {
  var maximum_radius_m = 0.0;
  var maximum_displacement_m = 0.0;
  for (var candidate = 0u; candidate < params.particle_count; candidate = candidate + 1u) {
    let authority_state0 = frozen_placement_source_state[candidate * params.state_stride_vec4];
    let state0 = next_state[candidate * params.state_stride_vec4];
    let thermo0 = next_thermo[candidate * params.thermo_stride_vec4];
    // Fixed-capacity generations contain zero-mass spare rows. An activated
    // spare belongs to the placed destination, never to this frozen query.
    if (authority_state0.w <= 0.0 || state0.w <= 0.0 || thermo0.w <= 0.0) {
      continue;
    }
    let radius_m = pow(
      max(3.0 * state0.w / (12.5663706 * thermo0.w), 1.0e-30),
      1.0 / 3.0
    );
    maximum_radius_m = max(maximum_radius_m, radius_m);
    maximum_displacement_m = max(
      maximum_displacement_m,
      length(state0.xyz - authority_state0.xyz)
    );
  }
  return vec2<f32>(maximum_radius_m, maximum_displacement_m);
}
// ULG_PRODUCT_PLACEMENT_ENVELOPE_HELPER_END

fn placement_consider_capture_candidate(
  candidate: u32,
  event_position: vec3<f32>,
  event_material_id: f32,
  event_phase_id: f32,
  event_support_radius_m: f32,
  current: PlacementCaptureResult
) -> PlacementCaptureResult {
  if (candidate >= params.particle_count) {
    return current;
  }
  let authority_state0 = frozen_placement_source_state[candidate * params.state_stride_vec4];
  let candidate_state = next_state[candidate * params.state_stride_vec4];
  if (authority_state0.w <= 0.0 || candidate_state.w <= 0.0) {
    return current;
  }
  let candidate_row0 = next_thermo[candidate * params.thermo_stride_vec4];
  if (
    candidate_row0.x != event_material_id
    || candidate_row0.y != event_phase_id
    || !(candidate_row0.w > 0.0)
  ) {
    return current;
  }
  let candidate_radius_m = pow(
    max(3.0 * candidate_state.w / (12.5663706 * candidate_row0.w), 1.0e-30),
    1.0 / 3.0
  );
  let capture_radius_m = 4.0 * (event_support_radius_m + candidate_radius_m);
  let delta = event_position - candidate_state.xyz;
  let distance_m = length(delta);
  if (
    distance_m <= capture_radius_m
    && (
      distance_m < current.distance_m
      || (distance_m == current.distance_m && candidate < current.slot)
    )
  ) {
    return PlacementCaptureResult(candidate, current.malformed, distance_m, 0.0);
  }
  return current;
}

// Query the fresh frozen placement source by its authenticated exact-near
// directory. The source-to-destination displacement envelope ensures the
// per-carrier capture law cannot omit a valid pre-existing carrier.
fn placement_find_capture_ss(
  event_position: vec3<f32>,
  event_material_id: f32,
  event_phase_id: f32,
  event_support_radius_m: f32,
  maximum_live_radius_m: f32,
  maximum_live_displacement_m: f32
) -> PlacementCaptureResult {
  var result = PlacementCaptureResult(
    params.particle_count,
    0u,
    3.0e38,
    0.0
  );
  if (
    params.canonical_spatial_enabled == 0u
    || spatial_expectation.source_count != params.particle_count
    || !ss_exact_near_directory_admitted(spatial_expectation)
  ) {
    result.malformed = select(0u, 1u, params.canonical_spatial_enabled != 0u);
    return result;
  }
  let search_radius_m = 4.0 * (
    max(event_support_radius_m, 0.0) + max(maximum_live_radius_m, 0.0)
  ) + max(maximum_live_displacement_m, 0.0);
  if (!ss_exact_near_finite(search_radius_m)) {
    result.malformed = 1u;
    return result;
  }

  var malformed = false;
  for (
    var level_ordinal = 0u;
    level_ordinal < spatial_expectation.level_count;
    level_ordinal = level_ordinal + 1u
  ) {
    if (!ss_exact_near_level_occupied(spatial_expectation, level_ordinal)) {
      continue;
    }
    let level = spatial_expectation.min_level + i32(level_ordinal);
    let spacing_m = spatial_expectation.base_grid_spacing_m * exp2(f32(level));
    if (!ss_exact_near_finite(spacing_m) || spacing_m <= 0.0) {
      malformed = true;
      break;
    }
    let center_cell = vec3<i32>(floor(event_position / spacing_m));
    let radius_cells = max(0, i32(min(
      ceil(search_radius_m / spacing_m),
      2147483520.0
    )));
    let minimum_cell = vec3<i32>(
      ss_exact_near_saturating_sub_radius(center_cell.x, radius_cells),
      ss_exact_near_saturating_sub_radius(center_cell.y, radius_cells),
      ss_exact_near_saturating_sub_radius(center_cell.z, radius_cells)
    );
    let maximum_cell = vec3<i32>(
      ss_exact_near_saturating_add_radius(center_cell.x, radius_cells),
      ss_exact_near_saturating_add_radius(center_cell.y, radius_cells),
      ss_exact_near_saturating_add_radius(center_cell.z, radius_cells)
    );
    let level_order = ss_exact_near_signed_order_key(level);
    let minimum_order = vec3<u32>(
      ss_exact_near_signed_order_key(minimum_cell.x),
      ss_exact_near_signed_order_key(minimum_cell.y),
      ss_exact_near_signed_order_key(minimum_cell.z)
    );
    let maximum_order = vec3<u32>(
      ss_exact_near_signed_order_key(maximum_cell.x),
      ss_exact_near_signed_order_key(maximum_cell.y),
      ss_exact_near_signed_order_key(maximum_cell.z)
    );
    let level_begin = ss_exact_near_lower_bound_cell_key(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(0u)
    );
    let level_end = ss_exact_near_upper_bound_cell_key(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(0xffffffffu)
    );
    var x_cursor = ss_exact_near_lower_bound_cell_key_range(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(minimum_order.x, 0u, 0u),
      level_begin,
      level_end
    );
    for (
      var x_iteration = 0u;
      x_iteration < spatial_expectation.source_count && x_cursor < level_end;
      x_iteration = x_iteration + 1u
    ) {
      let x_order = ss_exact_near_cell_key_word(spatial_expectation, x_cursor, 2u);
      if (x_order > maximum_order.x) {
        x_cursor = level_end;
        continue;
      }
      let x_end = ss_exact_near_upper_bound_cell_key_range(
        spatial_expectation,
        spatial_expectation.chart_id,
        level_order,
        vec3<u32>(x_order, 0xffffffffu, 0xffffffffu),
        x_cursor,
        level_end
      );
      if (x_end <= x_cursor) {
        malformed = true;
        break;
      }
      var y_cursor = ss_exact_near_lower_bound_cell_key_range(
        spatial_expectation,
        spatial_expectation.chart_id,
        level_order,
        vec3<u32>(x_order, minimum_order.y, 0u),
        x_cursor,
        x_end
      );
      for (
        var y_iteration = 0u;
        y_iteration < spatial_expectation.source_count && y_cursor < x_end;
        y_iteration = y_iteration + 1u
      ) {
        let y_order = ss_exact_near_cell_key_word(spatial_expectation, y_cursor, 3u);
        if (y_order > maximum_order.y) {
          y_cursor = x_end;
          continue;
        }
        let y_end = ss_exact_near_upper_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, 0xffffffffu),
          y_cursor,
          x_end
        );
        if (y_end <= y_cursor) {
          malformed = true;
          break;
        }
        let z_begin = ss_exact_near_lower_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, minimum_order.z),
          y_cursor,
          y_end
        );
        let z_end = ss_exact_near_upper_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, maximum_order.z),
          z_begin,
          y_end
        );
        for (var cell_index = z_begin; cell_index < z_end; cell_index = cell_index + 1u) {
          let member_range = ss_exact_near_cell_member_range(
            spatial_expectation,
            cell_index
          );
          if (member_range.admitted == 0u) {
            malformed = true;
            break;
          }
          for (
            var member_offset = member_range.begin;
            member_offset < member_range.end;
            member_offset = member_offset + 1u
          ) {
            let lookup = ss_exact_near_source_at_member(
              spatial_expectation,
              member_offset
            );
            if (lookup.admitted == 0u) {
              malformed = true;
              break;
            }
            result = placement_consider_capture_candidate(
              lookup.source_index,
              event_position,
              event_material_id,
              event_phase_id,
              event_support_radius_m,
              result
            );
          }
          if (malformed) {
            break;
          }
        }
        if (malformed) {
          break;
        }
        y_cursor = y_end;
      }
      if (malformed || y_cursor < x_end) {
        malformed = true;
        break;
      }
      x_cursor = x_end;
    }
    if (malformed || x_cursor < level_end) {
      malformed = true;
      break;
    }
  }
  result.malformed = select(0u, 1u, malformed);
  return result;
}

// Build one immutable envelope for the parallel event classifier. This is a
// source-family pass once per reaction step, rather than once per event.
// ULG_PRODUCT_PLACEMENT_ENVELOPE_ENTRY_BEGIN
@compute @workgroup_size(1)
fn prepare_placement_spatial_envelope(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  if (global_id.x != 0u || arrayLength(&placement_control) == 0u) {
    return;
  }
  placement_control[0] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  if (params.canonical_spatial_enabled == 0u) {
    return;
  }
  let envelope = placement_live_radius_and_displacement_envelope();
  placement_control[0] = vec4<f32>(envelope, 1.0, 0.0);
}
// ULG_PRODUCT_PLACEMENT_ENVELOPE_ENTRY_END

// Resolve the expensive exact-near capture query independently for every
// compact event. The following single-lane commit pass consumes these stable
// decisions in ascending event order, preserving deterministic reductions
// without serializing the spatial traversal itself.
@compute @workgroup_size(64)
fn classify_product_events(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let event = global_id.x;
  let active_event_count = min(compact_counts[0], params.event_row_count);
  if (event >= active_event_count || event >= arrayLength(&placement_decisions)) {
    return;
  }
  placement_decisions[event] = vec4<f32>(
    f32(params.particle_count),
    3.0e38,
    0.0,
    0.0
  );
  let stride = params.event_stride_vec4;
  if (
    params.canonical_spatial_enabled == 0u
    || stride < 8u
    || arrayLength(&placement_control) == 0u
    || placement_control[0].z != 1.0
  ) {
    placement_decisions[event].z = 2.0;
    return;
  }
  let base = event * stride;
  let row0 = product_events[base];
  let row1 = product_events[base + 1u];
  let row2 = product_events[base + 2u];
  let row3 = product_events[base + 3u];
  let row4 = product_events[base + 4u];
  let row5 = product_events[base + 5u];
  let row7 = product_events[base + 7u];
  let event_valid = row4.z == 1.0
    && row7.z == 1.0
    && row2.w > 0.0
    && row4.y > 0.0;
  let unplaced_mass_kg = max(row3.y, 0.0);
  if (!event_valid || unplaced_mass_kg <= params.min_placed_mass_kg) {
    // Valid direct-only and subthreshold events need no capture query. The
    // commit pass still handles their provenance and disposition.
    placement_decisions[event].z = select(2.0, 1.0, event_valid);
    return;
  }
  var support_radius_m = 0.05;
  if (row5.w > 0.0) {
    support_radius_m = pow(row5.w * 0.238732414637843, 1.0 / 3.0);
  }
  var event_position = row0.xyz;
  if (placement_phase_is_gas(row2.w) && row0.w > 0.0) {
    let source_index_f = round(row1.w);
    let partner_index_f = round(row2.x);
    let pair_indices_valid = source_index_f >= 0.0
      && partner_index_f >= 0.0
      && source_index_f < f32(params.particle_count)
      && partner_index_f < f32(params.particle_count);
    if (pair_indices_valid) {
      let gas_target = placement_gas_target(
        u32(source_index_f),
        u32(partner_index_f),
        event_position,
        support_radius_m
      );
      if (gas_target.w > 0.0) {
        event_position = gas_target.xyz;
      }
    }
  }
  let capture = placement_find_capture_ss(
    event_position,
    row1.x,
    row2.w,
    support_radius_m,
    placement_control[0].x,
    placement_control[0].y
  );
  placement_decisions[event] = vec4<f32>(
    f32(capture.slot),
    capture.distance_m,
    select(1.0, 2.0, capture.malformed != 0u),
    0.0
  );
}

// ULG_PRODUCT_PLACEMENT_SPATIAL_CLASSIFICATION_END

// ULG_PRODUCT_PLACEMENT_COMMIT_BEGIN
fn placement_direct_carrier_matches(
  particle_index: u32,
  material_id: f32,
  phase_id: f32
) -> bool {
  if (particle_index >= params.particle_count) {
    return false;
  }
  let state0 = next_state[particle_index * params.state_stride_vec4];
  let thermo0 = next_thermo[particle_index * params.thermo_stride_vec4];
  return state0.w > 0.0
    && abs(thermo0.x - material_id) < 0.5
    && abs(thermo0.y - phase_id) < 0.5;
}

// Direct placement can replace one freed parent before this pass. Relocate it
// only when exactly one endpoint owns this product term; two matching
// endpoints are a multi-carrier product and must retain their separation.
fn placement_route_direct_gas_carrier(
  source_index: u32,
  partner_index: u32,
  material_id: f32,
  phase_id: f32,
  original_event_position: vec3<f32>,
  target_position: vec3<f32>,
  event_support_radius_m: f32
) -> bool {
  let source_matches = placement_direct_carrier_matches(source_index, material_id, phase_id);
  let partner_matches = placement_direct_carrier_matches(partner_index, material_id, phase_id);
  if (!source_matches && !partner_matches) {
    return false;
  }
  if (source_matches && partner_matches) {
    let source_state_base = source_index * params.state_stride_vec4;
    let partner_state_base = partner_index * params.state_stride_vec4;
    let source_state0 = next_state[source_state_base];
    let partner_state0 = next_state[partner_state_base];
    let source_rest_volume_m3 = placement_particle_rest_volume_m3(source_index);
    let partner_rest_volume_m3 = placement_particle_rest_volume_m3(partner_index);
    if (!(source_rest_volume_m3 > 0.0) || !(partner_rest_volume_m3 > 0.0)) {
      return false;
    }
    let source_support_radius_m = pow(
      max(source_rest_volume_m3 * 0.238732414637843, 1.0e-30),
      1.0 / 3.0
    );
    let partner_support_radius_m = pow(
      max(partner_rest_volume_m3 * 0.238732414637843, 1.0e-30),
      1.0 / 3.0
    );
    let direct_support_radius_m = max(source_support_radius_m, partner_support_radius_m);
    let current_midpoint = 0.5 * (source_state0.xyz + partner_state0.xyz);
    let pair_separation = source_state0.xyz - partner_state0.xyz;
    let pair_support_radius_m = 0.5 * sqrt(dot(pair_separation, pair_separation))
      + direct_support_radius_m;
    let pair_support_volume_m3 = pair_support_radius_m
      * pair_support_radius_m
      * pair_support_radius_m
      / 0.238732414637843;
    let projected_route = placement_route_gas_merge_position(
      original_event_position,
      target_position,
      phase_id,
      event_support_radius_m,
      pair_support_volume_m3,
      current_midpoint
    );
    if (projected_route.w <= 0.0) {
      return false;
    }
    let shift = projected_route.xyz - current_midpoint;
    let bounded_shift = placement_pair_preserving_shift(
      source_state0.xyz,
      partner_state0.xyz,
      shift,
      direct_support_radius_m
    );
    if (bounded_shift.w <= 0.0) {
      return false;
    }
    next_state[source_state_base] = vec4<f32>(source_state0.xyz + bounded_shift.xyz, source_state0.w);
    next_state[partner_state_base] = vec4<f32>(partner_state0.xyz + bounded_shift.xyz, partner_state0.w);
    return true;
  }
  let direct_index = select(partner_index, source_index, source_matches);
  let state_base = direct_index * params.state_stride_vec4;
  let state0 = next_state[state_base];
  let direct_rest_volume_m3 = placement_particle_rest_volume_m3(direct_index);
  if (!(direct_rest_volume_m3 > 0.0)) {
    return false;
  }
  let direct_route = placement_route_gas_merge_position(
    original_event_position,
    target_position,
    phase_id,
    event_support_radius_m,
    direct_rest_volume_m3,
    state0.xyz
  );
  if (direct_route.w <= 0.0) {
    return false;
  }
  next_state[state_base] = vec4<f32>(direct_route.xyz, state0.w);
  return true;
}

@compute @workgroup_size(1)
fn place_product_events(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u) {
    return;
  }
  if (arrayLength(&placement_completion_receipt) < ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS}u) {
    return;
  }
  placement_completion_receipt[0] = ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_MAGIC}u;
  placement_completion_receipt[1] = ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION}u;
  placement_completion_receipt[2] = params.generation_id;
  placement_completion_receipt[3] = params.support_profile_id;
  placement_completion_receipt[4] = params.event_row_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.status}] = ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.PENDING}u;
  let stride = params.event_stride_vec4;
  if (stride < 8u) {
    placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.status}] = ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.CONTRACT_REJECTED}u;
    return;
  }
  var cursor = 0u;
  let active_event_count = min(compact_counts[0], params.event_row_count);
  let classifier_ready_count = placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierReadyCount}];
  let classifier_rejected_count = placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierRejectedCount}];
  let classifier_unknown_count = placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierUnknownCount}];
  if (params.canonical_spatial_enabled != 0u) {
    // Seal the complete parallel decision set before the first destination
    // mutation. Status 2 is reserved for missing/malformed canonical spatial
    // authority; one such row rejects placement for the whole batch rather
    // than publishing a partially applied prefix.
    if (
      params.receipt_version != ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION}u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactCountPassCount}] != 1u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactScanPassCount}] != 1u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactScatterPassCount}] != 1u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.activeEventCount}] != active_event_count
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactionOverflowCount}] != 0u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopePartialPassCount}] != 1u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopeFinalizePassCount}] != 1u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopeAdmitted}] != 1u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierPassCount}] != 1u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareFlagPassCount}] != 2u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareScanPassCount}] != 2u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareAssignPassCount}] != 2u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.overflowFlags}] != 0u
      || active_event_count > arrayLength(&placement_decisions)
    ) {
      placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.status}] = ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.CONTRACT_REJECTED}u;
      return;
    }
    if (
      classifier_ready_count + classifier_rejected_count
        + classifier_unknown_count != active_event_count
      || classifier_unknown_count != 0u
    ) {
      placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.status}] = ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.CANONICAL_DECISION_REJECTED}u;
      return;
    }
  }
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.applyPassCount}] = 1u;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.serialConflictFoldPassCount}] = select(0u, 1u, active_event_count > 0u);
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.serialConflictFoldEventCount}] = active_event_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.maxSerialConflictFoldSize}] = active_event_count;
  // Mark every product-term accumulator row as executed only after the full
  // canonical decision set is sealed. Identity is written only by non-empty
  // events below; dense empty event rows must not overwrite a real term
  // identity. Keeping this after preflight makes rejection all-or-nothing for
  // both particle state and placement provenance.
  for (var product_term_index = 0u; product_term_index < params.product_term_count; product_term_index = product_term_index + 1u) {
    let summary_base = placement_summary_base(product_term_index);
    let header = placement_summary[summary_base + 1u];
    placement_summary[summary_base + 1u] = vec4<f32>(header.x, 1.0, header.z, header.w);
  }
  var processed_event_count = 0u;
  var capture_merge_event_count = 0u;
  var spare_placement_event_count = 0u;
  var direct_only_event_count = 0u;
  var fallback_event_count = 0u;
  var subthreshold_event_count = 0u;
  var no_carrier_event_count = 0u;
  var rejected_event_count = 0u;
  var unknown_disposition_count = 0u;
  for (var event = 0u; event < active_event_count; event = event + 1u) {
    processed_event_count = processed_event_count + 1u;
    let base = event * stride;
    let event_row0_header = product_events[base];
    let event_row1_header = product_events[base + 1u];
    let row3 = product_events[base + 3u];
    let row4 = product_events[base + 4u];
    let event_row2_header = product_events[base + 2u];
    let event_row5_header = product_events[base + 5u];
    let event_row7_header = product_events[base + 7u];
    let product_term_index = u32(max(event_row1_header.y, 0.0));
    if (product_term_index >= params.product_term_count) {
      rejected_event_count = rejected_event_count + 1u;
      continue;
    }
    let summary_base = placement_summary_base(product_term_index);
    let unplaced_mass_kg = max(row3.y, 0.0);
    let event_product_mass_kg = max(event_row0_header.w, 0.0);
    let unplaced_represented_entity_count =
      placement_represented_entity_count_for_product_mass(
        unplaced_mass_kg,
        row3.w
      );
    if (event_product_mass_kg > 0.0 || unplaced_mass_kg > 0.0) {
      record_placement_identity(summary_base, event_row1_header, event_row2_header);
    }
    let status = row4.z;
    let event_valid = !(
      status != 1.0
      || event_row7_header.z != 1.0
      || !(event_row2_header.y > 0.0)
      || !(event_row2_header.w > 0.0)
      || !(row3.w > 0.0)
      || !(row4.y > 0.0)
      || !placement_product_event_moles_match_mass(
        event_product_mass_kg,
        event_row2_header.y,
        row3.w
      )
      || (unplaced_mass_kg > 0.0
        && !(unplaced_represented_entity_count > 0.0))
    );
    if (!event_valid) {
      rejected_event_count = rejected_event_count + 1u;
      // Reject the whole non-empty event, including a direct-only event whose
      // unplaced lane is zero. Using only unplaced mass here made an invalid
      // direct placement disappear from the accumulator while the term still
      // looked executed and partition-complete.
      let rejected_payload_mass_kg = max(event_product_mass_kg, unplaced_mass_kg);
      if (rejected_payload_mass_kg > 0.0) {
        record_rejected_placement(summary_base, rejected_payload_mass_kg);
        // Invalid payloads must not remain eligible for the retained grid
        // splat or compaction consumers after the placement gate rejects them.
        product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
        product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 8.0);
      }
      continue;
    }
    let event_direct_placed_mass_kg = min(max(row3.x, 0.0), event_product_mass_kg);
    if (event_product_mass_kg > 0.0) {
      record_ready_product(summary_base, event_product_mass_kg, event_direct_placed_mass_kg);
    }
    var event_support_radius_m = 0.05;
    if (event_row5_header.w > 0.0) {
      event_support_radius_m = pow(
        event_row5_header.w * 0.238732414637843,
        1.0 / 3.0
      );
    }
    var event_position = event_row0_header.xyz;
    var event_phase_route_complete = false;
    if (placement_phase_is_gas(event_row2_header.w) && event_product_mass_kg > 0.0) {
      let source_index_f = round(event_row1_header.w);
      let partner_index_f = round(event_row2_header.x);
      let pair_indices_valid = source_index_f >= 0.0
        && partner_index_f >= 0.0
        && source_index_f < f32(params.particle_count)
        && partner_index_f < f32(params.particle_count);
      if (pair_indices_valid) {
        let source_index = u32(source_index_f);
        let partner_index = u32(partner_index_f);
        let gas_target = placement_gas_target(
          source_index,
          partner_index,
          event_position,
          event_support_radius_m
        );
        if (gas_target.w > 0.0) {
          event_position = gas_target.xyz;
          product_events[base] = vec4<f32>(event_position, event_row0_header.w);
          var direct_route_complete = true;
          if (event_direct_placed_mass_kg > 0.0) {
            direct_route_complete = placement_route_direct_gas_carrier(
              source_index,
              partner_index,
              event_row1_header.x,
              event_row2_header.w,
              event_row0_header.xyz,
              event_position,
              event_support_radius_m
            );
          }
          event_phase_route_complete = direct_route_complete;
        }
      }
    }
    if (unplaced_mass_kg <= 0.0) {
      direct_only_event_count = direct_only_event_count + 1u;
      if (event_phase_route_complete) {
        record_phase_routed_event(summary_base);
      }
      product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
      product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 2.0);
      continue;
    }
    record_placement_candidate(summary_base);
    if (unplaced_mass_kg <= params.min_placed_mass_kg) {
      subthreshold_event_count = subthreshold_event_count + 1u;
      record_unplaced(summary_base, unplaced_mass_kg, true);
      if (event_phase_route_complete) {
        record_phase_routed_event(summary_base);
      }
      product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 6.0);
      continue;
    }
    let event_row0 = event_row0_header;
    let event_row1 = event_row1_header;
    let event_row2 = product_events[base + 2u];
    let event_row4b = product_events[base + 4u];
    let event_row5 = product_events[base + 5u];
    let event_material_id = event_row1.x;
    let event_phase_id = event_row2.w;
    // Merge-first: with the interface-flux extent law, burning pairs emit a
    // small product event EVERY substep; minting a spare particle for each
    // would exhaust the spare pool within milliseconds. Physically the new
    // product joins the molten crown / gas bubble already at the interface,
    // so fold the event into the nearest same-material same-phase particle
    // within a capture radius (4x combined rest radii). Mass, momentum, and
    // energy move verbatim (mass-weighted merges), so conservation is exact.
    var merge_slot = params.particle_count;
    var merge_distance = 3.0e38;
    var nearest_slot = params.particle_count;
    var nearest_distance = 3.0e38;
    if (params.canonical_spatial_enabled != 0u) {
      let decision = placement_decisions[event];
      if (decision.z != 1.0) {
        // A malformed canonical traversal may not fall through to private
        // search or mutate destination particles. Retain the event mass for the
        // existing product sidecar/grid consumer and make the miss explicit.
        record_unplaced(summary_base, unplaced_mass_kg, false);
        no_carrier_event_count = no_carrier_event_count + 1u;
        product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 7.0);
        continue;
      }
      if (decision.x >= 0.0 && decision.x < f32(params.particle_count)) {
        merge_slot = u32(round(decision.x));
        merge_distance = decision.y;
      }
    } else {
      for (var candidate = 0u; candidate < params.particle_count; candidate = candidate + 1u) {
        let candidate_state = next_state[candidate * params.state_stride_vec4];
        if (candidate_state.w <= 0.0) {
          continue;
        }
        let candidate_row0 = next_thermo[candidate * params.thermo_stride_vec4];
        if (candidate_row0.x != event_material_id) {
          continue;
        }
        let candidate_rest_density = max(candidate_row0.w, 1.0e-6);
        let candidate_radius = pow(
          max(3.0 * candidate_state.w / (12.5663706 * candidate_rest_density), 1.0e-30),
          1.0 / 3.0
        );
        let capture_radius = 4.0 * (event_support_radius_m + candidate_radius);
        let delta = event_position - candidate_state.xyz;
        let distance = length(delta);
        if (
          candidate_row0.y == event_phase_id
          && distance <= capture_radius
          && distance < merge_distance
        ) {
          merge_distance = distance;
          merge_slot = candidate;
        }
        if (distance < nearest_distance) {
          nearest_distance = distance;
          nearest_slot = candidate;
        }
      }
    }
    if (merge_slot < params.particle_count) {
      capture_merge_event_count = capture_merge_event_count + 1u;
      let state_base = merge_slot * params.state_stride_vec4;
      let particle_pos_mass = next_state[state_base];
      let particle_vel_u = next_state[state_base + 1u];
      let merged_mass = particle_pos_mass.w + unplaced_mass_kg;
      let inv_merged = 1.0 / max(merged_mass, 1.0e-20);
      var merged_position = (particle_pos_mass.xyz * particle_pos_mass.w + event_position * unplaced_mass_kg) * inv_merged;
      let merged_velocity = (particle_vel_u.xyz * particle_pos_mass.w + event_row5.xyz * unplaced_mass_kg) * inv_merged;
      let merged_u = (particle_vel_u.w * particle_pos_mass.w + event_row4b.w * unplaced_mass_kg) * inv_merged;
      let mechanics_base = merge_slot * params.mechanics_stride_vec4;
      let mechanics_row4 = next_mechanics[mechanics_base + 4u];
      var merged_rest_volume = mechanics_row4.w;
      if (event_row4b.y > 0.0) {
        merged_rest_volume = merged_rest_volume + unplaced_mass_kg / event_row4b.y;
      }
      if (placement_phase_is_gas(event_phase_id)) {
        let merged_route = placement_route_gas_merge_position(
          event_row0_header.xyz,
          event_position,
          event_phase_id,
          event_support_radius_m,
          merged_rest_volume,
          merged_position
        );
        if (merged_route.w > 0.0) {
          merged_position = merged_route.xyz;
        } else {
          event_phase_route_complete = false;
        }
      }
      next_state[state_base] = vec4<f32>(merged_position, merged_mass);
      next_state[state_base + 1u] = vec4<f32>(merged_velocity, merged_u);
      let thermo_base = merge_slot * params.thermo_stride_vec4;
      let particle_thermo0 = next_thermo[thermo_base];
      let particle_thermo2 = next_thermo[thermo_base + 2u];
      let merged_temperature = (particle_thermo0.z * particle_pos_mass.w + event_row4b.x * unplaced_mass_kg) * inv_merged;
      next_thermo[thermo_base] = vec4<f32>(particle_thermo0.x, particle_thermo0.y, merged_temperature, particle_thermo0.w);
      next_thermo[thermo_base + 2u] = vec4<f32>(
        particle_thermo2.x,
        particle_thermo2.y + unplaced_represented_entity_count,
        particle_thermo2.z,
        particle_thermo2.w
      );
      // Rest volume grows by the event's share so density stays consistent.
      next_mechanics[mechanics_base + 4u] = vec4<f32>(mechanics_row4.x, mechanics_row4.y, mechanics_row4.z, merged_rest_volume);
      record_capture_merge(summary_base, unplaced_mass_kg, merged_mass, merge_distance);
      if (event_phase_route_complete) {
        record_phase_routed_event(summary_base);
      }
      // Consume the event. row3.x remains the direct/spare placed share;
      // merged mass is derived exactly as total - placed - unplaced.
      product_events[base + 3u] = vec4<f32>(row3.x, 0.0, row3.z, row3.w);
      product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
      product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 4.0);
      continue;
    }
    // Canonical placement receives an ascending, prefix-scanned spare slot in
    // decision.w. The legacy route retains its cursor scan; it is unreachable
    // once fresh authenticated SS placement authority is selected.
    var slot = params.particle_count;
    if (params.canonical_spatial_enabled != 0u) {
      let assigned_spare = placement_decisions[event].w;
      if (assigned_spare >= 0.0 && assigned_spare < f32(params.particle_count)) {
        slot = u32(round(assigned_spare));
      }
    } else {
      for (var candidate = cursor; candidate < params.particle_count; candidate = candidate + 1u) {
        let candidate_thermo_base = candidate * params.thermo_stride_vec4;
        let candidate_reserved_for_phase =
          abs(next_thermo[candidate_thermo_base + 2u].z - PHASE_COMPANION_RESERVED_STATUS) < 0.5;
        if (
          next_state[candidate * params.state_stride_vec4].w <= 0.0
          && !candidate_reserved_for_phase
        ) {
          slot = candidate;
          break;
        }
      }
    }
    if (slot >= params.particle_count) {
      // No later event can make an occupied or phase-reserved row available in
      // this commit. Latch exhaustion so the fixed-capacity phase-companion
      // reserve is scanned once, not once per remaining product event.
      cursor = params.particle_count;
      if (params.canonical_spatial_enabled != 0u) {
        // The canonical route never drops into an unauthenticated all-particle
        // fallback. Keep the mass resident in the event sidecar until a later
        // epoch supplies capacity or a hierarchy-authenticated fallback view.
        record_unplaced(summary_base, unplaced_mass_kg, false);
        no_carrier_event_count = no_carrier_event_count + 1u;
        if (event_phase_route_complete) {
          record_phase_routed_event(summary_base);
        }
        product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 7.0);
        continue;
      }
      // Global nearest-material fallback is only needed after deterministic
      // spare exhaustion. Keep it out of the normal per-event hot path.
      if (nearest_slot >= params.particle_count) {
        for (var candidate = 0u; candidate < params.particle_count; candidate = candidate + 1u) {
          let candidate_state = next_state[candidate * params.state_stride_vec4];
          if (candidate_state.w <= 0.0) {
            continue;
          }
          let candidate_row0 = next_thermo[candidate * params.thermo_stride_vec4];
          if (candidate_row0.x != event_material_id) {
            continue;
          }
          let distance = length(event_position - candidate_state.xyz);
          if (
            distance < nearest_distance
            || (distance == nearest_distance && candidate < nearest_slot)
          ) {
            nearest_distance = distance;
            nearest_slot = candidate;
          }
        }
      }
      if (nearest_slot < params.particle_count) {
        // No spare capacity but a same-material carrier exists somewhere:
        // terminal fallback merge (see nearest_slot rationale above).
        merge_slot = nearest_slot;
        let state_base = merge_slot * params.state_stride_vec4;
        let particle_pos_mass = next_state[state_base];
        let particle_vel_u = next_state[state_base + 1u];
        let merged_mass = particle_pos_mass.w + unplaced_mass_kg;
        let inv_merged = 1.0 / max(merged_mass, 1.0e-20);
        var merged_position = (particle_pos_mass.xyz * particle_pos_mass.w + event_position * unplaced_mass_kg) * inv_merged;
        let merged_velocity = (particle_vel_u.xyz * particle_pos_mass.w + event_row5.xyz * unplaced_mass_kg) * inv_merged;
        let merged_u = (particle_vel_u.w * particle_pos_mass.w + event_row4b.w * unplaced_mass_kg) * inv_merged;
        let mechanics_base = merge_slot * params.mechanics_stride_vec4;
        let mechanics_row4 = next_mechanics[mechanics_base + 4u];
        var merged_rest_volume = mechanics_row4.w;
        if (event_row4b.y > 0.0) {
          merged_rest_volume = merged_rest_volume + unplaced_mass_kg / event_row4b.y;
        }
        let thermo_base = merge_slot * params.thermo_stride_vec4;
        let particle_thermo0 = next_thermo[thermo_base];
        let particle_thermo2 = next_thermo[thermo_base + 2u];
        if (placement_phase_is_gas(event_phase_id)) {
          if (abs(particle_thermo0.y - event_phase_id) < 0.5) {
            let merged_route = placement_route_gas_merge_position(
              event_row0_header.xyz,
              event_position,
              event_phase_id,
              event_support_radius_m,
              merged_rest_volume,
              merged_position
            );
            if (merged_route.w > 0.0) {
              merged_position = merged_route.xyz;
            } else {
              event_phase_route_complete = false;
            }
          } else {
            // Preserve the conserving terminal merge but do not teleport a
            // condensed carrier or claim that the gas reached its interface
            // route. The thermal solver remains responsible for phase change.
            event_phase_route_complete = false;
          }
        }
        next_state[state_base] = vec4<f32>(merged_position, merged_mass);
        next_state[state_base + 1u] = vec4<f32>(merged_velocity, merged_u);
        let merged_temperature = (particle_thermo0.z * particle_pos_mass.w + event_row4b.x * unplaced_mass_kg) * inv_merged;
        next_thermo[thermo_base] = vec4<f32>(particle_thermo0.x, particle_thermo0.y, merged_temperature, particle_thermo0.w);
        next_thermo[thermo_base + 2u] = vec4<f32>(
          particle_thermo2.x,
          particle_thermo2.y + unplaced_represented_entity_count,
          particle_thermo2.z,
          particle_thermo2.w
        );
        next_mechanics[mechanics_base + 4u] = vec4<f32>(mechanics_row4.x, mechanics_row4.y, mechanics_row4.z, merged_rest_volume);
        record_fallback_merge(summary_base, unplaced_mass_kg, merged_mass, nearest_distance);
        fallback_event_count = fallback_event_count + 1u;
        if (event_phase_route_complete) {
          record_phase_routed_event(summary_base);
        }
        product_events[base + 3u] = vec4<f32>(row3.x, 0.0, row3.z, row3.w);
        product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
        product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 5.0);
        continue;
      }
      // No spare capacity and no same-material carrier anywhere: the event
      // stays live and keeps feeding the grid splat ledger, so no mass is
      // lost either way.
      record_unplaced(summary_base, unplaced_mass_kg, false);
      no_carrier_event_count = no_carrier_event_count + 1u;
      if (event_phase_route_complete) {
        record_phase_routed_event(summary_base);
      }
      product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 7.0);
      continue;
    }
    if (params.canonical_spatial_enabled == 0u) {
      cursor = slot + 1u;
    }
    let row0 = product_events[base];
    let row1 = product_events[base + 1u];
    let row2 = product_events[base + 2u];
    let row5 = product_events[base + 5u];
    let row6 = product_events[base + 6u];
    let row7 = product_events[base + 7u];
    let material_id = row1.x;
    let phase_id = row2.w;
    let temperature_k = row4.x;
    var rest_density = row4.y;
    let product_u = row4.w;
    let support_volume_m3 = row5.w;
    let state_base = slot * params.state_stride_vec4;
    next_state[state_base] = vec4<f32>(row0.x, row0.y, row0.z, unplaced_mass_kg);
    next_state[state_base + 1u] = vec4<f32>(row5.x, row5.y, row5.z, product_u);
    // Thermo rows: single-phase product at the event temperature. Phase
    // fractions are the one-hot of the product term's target phase.
    let thermo_base = slot * params.thermo_stride_vec4;
    let solid_fraction = select(0.0, 1.0, phase_id > 0.5 && phase_id < 1.5);
    let liquid_fraction = select(0.0, 1.0, phase_id >= 1.5 && phase_id < 2.5);
    let gas_fraction = select(0.0, 1.0, phase_id >= 2.5 && phase_id < 3.5);
    let plasma_fraction = select(0.0, 1.0, phase_id >= 3.5);
    // Smoothing length / visual radius from the event's support volume
    // (mass over product rest density), the same rest-volume radius the
    // demo derives at build time.
    var support_radius_m = 0.05;
    if (support_volume_m3 > 0.0) {
      support_radius_m = pow(support_volume_m3 * 0.238732414637843, 1.0 / 3.0);
    }
    next_thermo[thermo_base] = vec4<f32>(material_id, phase_id, temperature_k, rest_density);
    next_thermo[thermo_base + 1u] = vec4<f32>(solid_fraction, liquid_fraction, gas_fraction, plasma_fraction);
    next_thermo[thermo_base + 2u] = vec4<f32>(
      support_radius_m,
      unplaced_represented_entity_count,
      1.0,
      support_radius_m
    );
    // Mechanics: fresh rest state (F = I, J = 1) with the event's product
    // mechanics -- mirrors write_reacted_mechanics in the reaction kernel.
    var rest_volume = 0.0;
    if (rest_density > 0.0) {
      rest_volume = unplaced_mass_kg / rest_density;
    }
    let mechanics_base = slot * params.mechanics_stride_vec4;
    next_mechanics[mechanics_base] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
    next_mechanics[mechanics_base + 1u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
    next_mechanics[mechanics_base + 2u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
    next_mechanics[mechanics_base + 3u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    next_mechanics[mechanics_base + 4u] = vec4<f32>(0.0, 0.0, 1.0, rest_volume);
    next_mechanics[mechanics_base + 5u] = vec4<f32>(row7.y, row7.z, row6.x, row6.y);
    next_mechanics[mechanics_base + 6u] = vec4<f32>(row6.z, row6.w, row7.x, row7.z);
    next_mechanics[mechanics_base + 7u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    record_spare_placement(summary_base, unplaced_mass_kg, support_radius_m);
    spare_placement_event_count = spare_placement_event_count + 1u;
    if (event_phase_route_complete) {
      record_phase_routed_event(summary_base);
    }
    // Consume the event: zero its unplaced share and status so the compactor
    // and the grid splat drop it this substep.
    product_events[base + 3u] = vec4<f32>(row3.x + unplaced_mass_kg, 0.0, row3.z, row3.w);
    product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
    product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 3.0);
  }
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.applyVisitedCount}] = processed_event_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.directOnlyEventCount}] = direct_only_event_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.sparePlacementEventCount}] = spare_placement_event_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.captureMergeEventCount}] = capture_merge_event_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.fallbackEventCount}] = fallback_event_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.subthresholdEventCount}] = subthreshold_event_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.noCarrierEventCount}] = no_carrier_event_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.rejectedEventCount}] = rejected_event_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.unknownDispositionCount}] = unknown_disposition_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.privateLookupBuildCount}] = 0u;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.exhaustiveTraversalCount}] = 0u;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.status}] = ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.COMPLETE}u;
}
// ULG_PRODUCT_PLACEMENT_COMMIT_END
`;

const PRODUCT_PLACEMENT_SPATIAL_BINDINGS_PATTERN =
  /\/\/ ULG_PRODUCT_PLACEMENT_SPATIAL_BINDINGS_BEGIN[\s\S]*?\/\/ ULG_PRODUCT_PLACEMENT_SPATIAL_BINDINGS_END\n/;
const PRODUCT_PLACEMENT_SPATIAL_CLASSIFICATION_PATTERN =
  /\/\/ ULG_PRODUCT_PLACEMENT_SPATIAL_CLASSIFICATION_BEGIN[\s\S]*?\/\/ ULG_PRODUCT_PLACEMENT_SPATIAL_CLASSIFICATION_END\n/;

// Native WebGPU drivers compile each pipeline entry point independently.
// Keep the exact-near classifier and deterministic commit in separate WGSL
// modules so the large traversal is validated once and never recompiled for
// the commit-only pipeline.
export const sphReactionProductEventPlacementEnvelopeWgsl = `
struct ProductEventPlacementParams {
  particle_count: u32,
  event_row_count: u32,
  event_stride_vec4: u32,
  state_stride_vec4: u32,
  thermo_stride_vec4: u32,
  mechanics_stride_vec4: u32,
  min_placed_mass_kg: f32,
  product_term_count: u32,
  box_x_m: f32,
  box_y_m: f32,
  box_z_m: f32,
  box_clamp_enabled: u32,
  canonical_spatial_enabled: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<storage, read> next_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> next_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> frozen_placement_source_state: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: ProductEventPlacementParams;
@group(0) @binding(4) var<storage, read_write> placement_control: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> placement_completion_receipt: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> envelope_partials: array<vec4<f32>>;

var<workgroup> envelope_radius: array<f32, 64>;
var<workgroup> envelope_displacement: array<f32, 64>;
var<workgroup> envelope_admitted_count: array<u32, 64>;

fn placement_envelope_finite_scalar(value: f32) -> bool {
  return value == value && abs(value) < 3.0e38;
}

fn placement_envelope_finite_vec4(value: vec4<f32>) -> bool {
  return all(value == value) && all(abs(value) < vec4<f32>(3.0e38));
}

fn placement_envelope_reject_motion_bound() {
  atomicOr(
    &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.overflowFlags}],
    ${SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS.MOTION_BOUND_REJECTED}u
  );
}

fn placement_envelope_record_visit() {
  let previous = atomicAdd(
    &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopeInputVisitCount}],
    1u
  );
  if (previous == 0xffffffffu) {
    atomicOr(
      &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.overflowFlags}],
      ${SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS.ATOMIC_COUNTER}u
    );
  }
}

@compute @workgroup_size(64)
fn reduce_placement_spatial_envelope(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let candidate = global_id.x;
  let lane = local_id.x;
  var radius_m = 0.0;
  var displacement_m = 0.0;
  var admitted = 0u;
  if (candidate < params.particle_count) {
    placement_envelope_record_visit();
    let authority_state0 = frozen_placement_source_state[
      candidate * params.state_stride_vec4
    ];
    let state0 = next_state[candidate * params.state_stride_vec4];
    let thermo0 = next_thermo[candidate * params.thermo_stride_vec4];
    let finite_inputs = placement_envelope_finite_vec4(authority_state0)
      && placement_envelope_finite_vec4(state0)
      && placement_envelope_finite_vec4(thermo0);
    let nonnegative_inputs = authority_state0.w >= 0.0
      && state0.w >= 0.0
      && thermo0.w >= 0.0;
    let authority_active = authority_state0.w > 0.0;
    let current_active = state0.w > 0.0;
    if (
      params.canonical_spatial_enabled == 0u
      || !finite_inputs
      || !nonnegative_inputs
      || (current_active && (!authority_active || !(thermo0.w > 0.0)))
    ) {
      placement_envelope_reject_motion_bound();
    } else if (current_active) {
      admitted = 1u;
      radius_m = pow(
        max(3.0 * state0.w / (12.5663706 * thermo0.w), 1.0e-30),
        1.0 / 3.0
      );
      displacement_m = length(state0.xyz - authority_state0.xyz);
      if (
        !placement_envelope_finite_scalar(radius_m)
        || !placement_envelope_finite_scalar(displacement_m)
        || radius_m < 0.0
        || displacement_m < 0.0
      ) {
        radius_m = 0.0;
        displacement_m = 0.0;
        admitted = 0u;
        placement_envelope_reject_motion_bound();
      }
    }
  }
  envelope_radius[lane] = radius_m;
  envelope_displacement[lane] = displacement_m;
  envelope_admitted_count[lane] = admitted;
  workgroupBarrier();
  var width = 32u;
  loop {
    if (width == 0u) { break; }
    if (lane < width) {
      envelope_radius[lane] = max(
        envelope_radius[lane],
        envelope_radius[lane + width]
      );
      envelope_displacement[lane] = max(
        envelope_displacement[lane],
        envelope_displacement[lane + width]
      );
      envelope_admitted_count[lane] = envelope_admitted_count[lane]
        + envelope_admitted_count[lane + width];
    }
    workgroupBarrier();
    width = width / 2u;
  }
  if (lane == 0u && workgroup_id.x < arrayLength(&envelope_partials)) {
    envelope_partials[workgroup_id.x] = vec4<f32>(
      envelope_radius[0],
      envelope_displacement[0],
      f32(envelope_admitted_count[0]),
      1.0
    );
  }
  if (candidate == 0u) {
    atomicStore(
      &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopePartialPassCount}],
      1u
    );
  }
}

@compute @workgroup_size(1)
fn finalize_placement_spatial_envelope(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  if (global_id.x != 0u || arrayLength(&placement_control) == 0u) { return; }
  placement_control[0] = vec4<f32>(0.0);
  var maximum_radius_m = 0.0;
  var maximum_displacement_m = 0.0;
  var admitted_count = 0u;
  let partial_count = min(
    (params.particle_count + 63u) / 64u,
    arrayLength(&envelope_partials)
  );
  for (var partial = 0u; partial < partial_count; partial = partial + 1u) {
    let row = envelope_partials[partial];
    maximum_radius_m = max(maximum_radius_m, row.x);
    maximum_displacement_m = max(maximum_displacement_m, row.y);
    admitted_count = admitted_count + u32(max(row.z, 0.0));
  }
  let admitted = params.canonical_spatial_enabled != 0u
    && partial_count == (params.particle_count + 63u) / 64u
    && atomicLoad(
      &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopeInputVisitCount}]
    ) == params.particle_count
    && (
      atomicLoad(
        &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.overflowFlags}]
      ) & ${SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS.MOTION_BOUND_REJECTED}u
    ) == 0u;
  placement_control[0] = vec4<f32>(
    maximum_radius_m,
    maximum_displacement_m,
    select(0.0, 1.0, admitted),
    f32(admitted_count)
  );
  atomicStore(
    &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopeFinalizePassCount}],
    1u
  );
  atomicStore(
    &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopeAdmitted}],
    select(0u, 1u, admitted)
  );
}
`;

export const sphReactionProductEventPlacementWgsl =
  sphReactionProductEventPlacementCombinedWgsl
    .replace(
      PRODUCT_PLACEMENT_SPATIAL_BINDINGS_PATTERN,
      '@group(0) @binding(9) var<storage, read> placement_decisions: array<vec4<f32>>;\n@group(0) @binding(10) var<storage, read_write> placement_completion_receipt: array<u32>;\n'
    )
    .replace(PRODUCT_PLACEMENT_SPATIAL_CLASSIFICATION_PATTERN, '')
    .replaceAll('// ULG_PRODUCT_PLACEMENT_COMMIT_BEGIN\n', '')
    .replaceAll('// ULG_PRODUCT_PLACEMENT_COMMIT_END\n', '');

export const sphReactionSummaryPartialsWgsl = `
struct ReactionSummaryParams {
  particle_count: u32,
  reaction_count: u32,
  product_phase_count: u32,
  reactant_term_count: u32,
  product_term_count: u32,
  gas_product_count: u32,
  partial_count: u32,
  has_proposals: u32,
  // Offset 32 is the shared packer's atom_term_count lane (used by the
  // atom-residual summary kernel); keep it reserved here.
  _pad0: u32,
  // Substep duration for the interface-flux extent law; must match the apply
  // kernel's dt_s so ledger and application agree. 0 disables the cap.
  dt_s: f32,
  _pad2: u32,
  _pad3: u32,
};

struct ReactantTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  status: f32,
  // Interface mass flux [kg/m^2/s] this reactant can deliver to a reactive
  // contact at the reference temperature (kinetic-theory effusion for gases,
  // Clausius-Clapeyron vapor carrier for volatile condensed reactants, 0 when
  // no transport pathway is derivable). Packed by the reaction-table builder.
  interface_flux: f32,
};

struct ProductMechanics {
  rest_density: f32,
  effective_bulk: f32,
  shear: f32,
  lambda: f32,
  sound_speed: f32,
  eos_model_id: f32,
  solid_flag: f32,
  status: f32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> next_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> next_thermo: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> partial_summaries: array<vec4<f32>>;
@group(0) @binding(6) var<uniform> params: ReactionSummaryParams;
@group(0) @binding(7) var<storage, read> proposals: array<vec4<f32>>;

var<workgroup> wg_changed_material: array<f32, 64>;
var<workgroup> wg_changed_mass: array<f32, 64>;
var<workgroup> wg_visible_product_mass: array<f32, 64>;
var<workgroup> wg_visible_gas_product_mass: array<f32, 64>;
var<workgroup> wg_output_gas_phase_mass: array<f32, 64>;
var<workgroup> wg_source_mass: array<f32, 64>;
var<workgroup> wg_next_mass: array<f32, 64>;
var<workgroup> wg_thermal_ready: array<f32, 64>;
var<workgroup> wg_thermal_problem: array<f32, 64>;
var<workgroup> wg_finite_temperature: array<f32, 64>;
var<workgroup> wg_canonical_events: array<f32, 64>;
var<workgroup> wg_consumed_reactant_mass: array<f32, 64>;
var<workgroup> wg_expected_product_mass: array<f32, 64>;
var<workgroup> wg_raw_product_mass: array<f32, 64>;
var<workgroup> wg_ledger_visible_product_mass: array<f32, 64>;
var<workgroup> wg_ledger_unplaced_product_mass: array<f32, 64>;
var<workgroup> wg_ledger_gas_product_mass: array<f32, 64>;
var<workgroup> wg_ledger_visible_gas_product_mass: array<f32, 64>;
var<workgroup> wg_ledger_unplaced_gas_product_mass: array<f32, 64>;
var<workgroup> wg_sealed_box_gas_product_moles: array<f32, 64>;
var<workgroup> wg_reaction_heat: array<f32, 64>;
var<workgroup> wg_ledger_mass_residual: array<f32, 64>;
var<workgroup> wg_ledger_ready_events: array<f32, 64>;
var<workgroup> wg_ledger_problem_events: array<f32, 64>;
var<workgroup> wg_mutual_pairs: array<f32, 64>;

fn product_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u];
}

fn product_term_row1(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 1u];
}

fn reaction_row1(reaction_index: u32) -> vec4<f32> {
  return reaction_records[reaction_index * 3u + 1u];
}

fn reaction_header_row0(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u];
}

fn reaction_header_row1(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u + 1u];
}

fn reactant_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u];
}

fn reactant_term_row2(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u + 2u];
}

// Interface-flux extent cap [mol] for one reacting pair over one substep.
// A contact event may only convert as much matter as transport can deliver
// through the contact interface: extent_rate = A_contact * max_i(nu_i /
// (coef_i * M_i)) where nu_i is reactant i's interface mass flux [kg/m^2/s]
// at its current temperature and the max expresses that the mobile species'
// pathway governs (e.g. water vapor reaching a sodium surface). A_contact is
// the contact disc of the smaller rest-volume radius - the same contact
// geometry the pair-conduction law uses - so thermal and chemical transport
// see one consistent interface. nu scales as sqrt(T/T_ref) (effusion flux
// rho*vbar/4 with vbar ~ sqrt(T)); the vapor-carrier density's exponential
// Clausius-Clapeyron growth with T is NOT modelled - a conservative,
// documented frontier gap. When neither reactant carries a derivable flux
// (nu_i = 0: condensed-condensed, non-volatile) or dt is 0 (stale packer),
// the cap disables and the stoichiometric availability bound alone applies -
// the pre-flux-law behavior. Every module that computes a reaction extent
// (apply, summary partials, product inventory, product events, atom
// residual, gas species) MUST apply this identical cap or their ledgers
// disagree and phantom product mass appears.
const INTERFACE_FLUX_REFERENCE_TEMPERATURE_K: f32 = 293.15;

fn interface_flux_extent_cap_mol(
  self_mass_kg: f32,
  self_rest_density: f32,
  self_temperature_k: f32,
  self_coefficient: f32,
  self_molar_mass: f32,
  self_interface_flux: f32,
  partner_mass_kg: f32,
  partner_rest_density: f32,
  partner_temperature_k: f32,
  partner_coefficient: f32,
  partner_molar_mass: f32,
  partner_interface_flux: f32,
  dt_s: f32
) -> f32 {
  let no_cap = 3.0e38;
  if (dt_s <= 0.0) {
    return no_cap;
  }
  let self_rate = self_interface_flux
    * sqrt(max(self_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(self_coefficient * self_molar_mass, 1.0e-20);
  let partner_rate = partner_interface_flux
    * sqrt(max(partner_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(partner_coefficient * partner_molar_mass, 1.0e-20);
  let mobile_rate = max(self_rate, partner_rate);
  if (mobile_rate <= 0.0) {
    return no_cap;
  }
  let self_radius = pow(
    max(3.0 * self_mass_kg / (12.5663706 * max(self_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let partner_radius = pow(
    max(3.0 * partner_mass_kg / (12.5663706 * max(partner_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let contact_radius = min(self_radius, partner_radius);
  let contact_area = 3.14159265 * contact_radius * contact_radius;
  return mobile_rate * contact_area * dt_s;
}

fn reactant_term_for_material(reaction_index: u32, material_id: f32) -> ReactantTerm {
  let header0 = reaction_header_row0(reaction_index);
  let reactant_term_offset = u32(max(header0.y, 0.0));
  let reactant_term_count = u32(max(header0.z, 0.0));
  for (var local = 0u; local < reactant_term_count; local = local + 1u) {
    let term_index = reactant_term_offset + local;
    let term0 = reactant_term_row0(term_index);
    let term2 = reactant_term_row2(term_index);
    if (term0.y == material_id && term2.z == 1.0) {
      return ReactantTerm(term0.y, term0.z, term0.w, term2.z, term2.w);
    }
  }
  return ReactantTerm(0.0, 0.0, 0.0, 0.0, 0.0);
}

fn product_raw_mass_sum_for_extent(reaction_index: u32, extent_mol: f32) -> f32 {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  var sum = 0.0;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term0.z > 0.0 && term0.w > 0.0) {
      sum = sum + extent_mol * term0.z * term0.w;
    }
  }
  return sum;
}

fn product_term_material_match(reaction_index: u32, material_id: f32) -> bool {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term0.y == material_id) {
      return true;
    }
  }
  return false;
}

fn gas_product_term_material_match(reaction_index: u32, material_id: f32) -> bool {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term1.y == 1.0 && term0.y == material_id) {
      return true;
    }
  }
  return false;
}

fn gas_product_mass_for_extent(reaction_index: u32, extent_mol: f32, mass_scale: f32) -> vec2<f32> {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  var mass_kg = 0.0;
  var moles = 0.0;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term1.y == 1.0 && term0.z > 0.0 && term0.w > 0.0) {
      moles = moles + extent_mol * term0.z * mass_scale;
      mass_kg = mass_kg + extent_mol * term0.z * term0.w * mass_scale;
    }
  }
  return vec2<f32>(mass_kg, moles);
}

fn product_term_match(material_id: f32) -> bool {
  for (var term_index = 0u; term_index < params.product_term_count; term_index = term_index + 1u) {
    let term0 = product_term_row0(term_index);
    let term1 = product_term_row1(term_index);
    if (term1.w == 1.0 && term0.y == material_id) {
      return true;
    }
  }
  return false;
}

fn gas_product_term_match(material_id: f32) -> bool {
  for (var term_index = 0u; term_index < params.product_term_count; term_index = term_index + 1u) {
    let term0 = product_term_row0(term_index);
    let term1 = product_term_row1(term_index);
    if (term1.w == 1.0 && term1.y == 1.0 && term0.y == material_id) {
      return true;
    }
  }
  return false;
}

@compute @workgroup_size(64)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let local = local_id.x;
  let particle_index = global_id.x;
  wg_changed_material[local] = 0.0;
  wg_changed_mass[local] = 0.0;
  wg_visible_product_mass[local] = 0.0;
  wg_visible_gas_product_mass[local] = 0.0;
  wg_output_gas_phase_mass[local] = 0.0;
  wg_source_mass[local] = 0.0;
  wg_next_mass[local] = 0.0;
  wg_thermal_ready[local] = 0.0;
  wg_thermal_problem[local] = 0.0;
  wg_finite_temperature[local] = 0.0;
  wg_canonical_events[local] = 0.0;
  wg_consumed_reactant_mass[local] = 0.0;
  wg_expected_product_mass[local] = 0.0;
  wg_raw_product_mass[local] = 0.0;
  wg_ledger_visible_product_mass[local] = 0.0;
  wg_ledger_unplaced_product_mass[local] = 0.0;
  wg_ledger_gas_product_mass[local] = 0.0;
  wg_ledger_visible_gas_product_mass[local] = 0.0;
  wg_ledger_unplaced_gas_product_mass[local] = 0.0;
  wg_sealed_box_gas_product_moles[local] = 0.0;
  wg_reaction_heat[local] = 0.0;
  wg_ledger_mass_residual[local] = 0.0;
  wg_ledger_ready_events[local] = 0.0;
  wg_ledger_problem_events[local] = 0.0;
  wg_mutual_pairs[local] = 0.0;

  if (particle_index < params.particle_count) {
    let source_pos_mass = source_state[particle_index * 2u];
    let next_pos_mass = next_state[particle_index * 2u];
    let source_row0 = source_thermo[particle_index * 3u];
    let next_row0 = next_thermo[particle_index * 3u];
    let next_row2 = next_thermo[particle_index * 3u + 2u];
    wg_source_mass[local] = source_pos_mass.w;
    wg_next_mass[local] = next_pos_mass.w;
    if (source_row0.x != next_row0.x) {
      wg_changed_material[local] = 1.0;
    }
    if (abs(source_pos_mass.w - next_pos_mass.w) > max(max(source_pos_mass.w, next_pos_mass.w), 1.0) * 1.0e-7) {
      wg_changed_mass[local] = 1.0;
    }
    if (product_term_match(next_row0.x)) {
      wg_visible_product_mass[local] = next_pos_mass.w;
    }
    if (gas_product_term_match(next_row0.x)) {
      wg_visible_gas_product_mass[local] = next_pos_mass.w;
    }
    if (next_row0.y == 3.0) {
      wg_output_gas_phase_mass[local] = next_pos_mass.w;
    }
    if (next_row2.z == 1.0) {
      wg_thermal_ready[local] = 1.0;
    } else {
      wg_thermal_problem[local] = 1.0;
    }
    if (next_row0.z == next_row0.z) {
      wg_finite_temperature[local] = 1.0;
    }

    if (params.has_proposals != 0u) {
      let proposal = proposals[particle_index];
      if (proposal.x >= 0.0 && proposal.y >= 0.0) {
        let partner_index = u32(proposal.x + 0.5);
        if (partner_index < params.particle_count && particle_index < partner_index) {
          let partner_proposal = proposals[partner_index];
          if (partner_proposal.x >= 0.0 && u32(partner_proposal.x + 0.5) == particle_index && partner_proposal.y == proposal.y) {
            wg_mutual_pairs[local] = 1.0;
            let reaction_index = u32(proposal.y + 0.5);
            let partner_source_pos_mass = source_state[partner_index * 2u];
            let self_source_row0 = source_thermo[particle_index * 3u];
            let partner_source_row0 = source_thermo[partner_index * 3u];
            let self_term = reactant_term_for_material(reaction_index, self_source_row0.x);
            let partner_term = reactant_term_for_material(reaction_index, partner_source_row0.x);
            let header1 = reaction_header_row1(reaction_index);
            let product_term_count = u32(max(header1.x, 0.0));
            let has_stoichiometry = self_term.status == 1.0
              && partner_term.status == 1.0
              && self_term.coefficient > 0.0
              && partner_term.coefficient > 0.0
              && self_term.molar_mass > 0.0
              && partner_term.molar_mass > 0.0
              && product_term_count > 0u;
            if (has_stoichiometry) {
              let self_extent = source_pos_mass.w / max(self_term.coefficient * self_term.molar_mass, 1.0e-20);
              let partner_extent = partner_source_pos_mass.w / max(partner_term.coefficient * partner_term.molar_mass, 1.0e-20);
              // Mirror of the apply kernel's flux-capped extent so ledger and
              // application account the same consumed mass.
              let extent_availability_mol = min(self_extent, partner_extent);
              let extent_flux_cap_mol = interface_flux_extent_cap_mol(
                source_pos_mass.w, self_source_row0.w, self_source_row0.z,
                self_term.coefficient, self_term.molar_mass, self_term.interface_flux,
                partner_source_pos_mass.w, partner_source_row0.w, partner_source_row0.z,
                partner_term.coefficient, partner_term.molar_mass, partner_term.interface_flux,
                params.dt_s
              );
              let extent_mol = min(extent_availability_mol, extent_flux_cap_mol);
              let self_consumed = min(source_pos_mass.w, extent_mol * self_term.coefficient * self_term.molar_mass);
              let partner_consumed = min(partner_source_pos_mass.w, extent_mol * partner_term.coefficient * partner_term.molar_mass);
              let consumed_mass = self_consumed + partner_consumed;
              let raw_product_mass = product_raw_mass_sum_for_extent(reaction_index, extent_mol);
              if (extent_mol > 0.0 && consumed_mass > 0.0 && raw_product_mass > 0.0) {
                let mass_scale = consumed_mass / raw_product_mass;
                let partner_next_pos_mass = next_state[partner_index * 2u];
                let self_next_row0 = next_thermo[particle_index * 3u];
                let partner_next_row0 = next_thermo[partner_index * 3u];
                var event_visible_product_mass = 0.0;
                var event_visible_gas_product_mass = 0.0;
                if (product_term_material_match(reaction_index, self_next_row0.x)) {
                  event_visible_product_mass = event_visible_product_mass + next_pos_mass.w;
                }
                if (product_term_material_match(reaction_index, partner_next_row0.x)) {
                  event_visible_product_mass = event_visible_product_mass + partner_next_pos_mass.w;
                }
                if (gas_product_term_material_match(reaction_index, self_next_row0.x)) {
                  event_visible_gas_product_mass = event_visible_gas_product_mass + next_pos_mass.w;
                }
                if (gas_product_term_material_match(reaction_index, partner_next_row0.x)) {
                  event_visible_gas_product_mass = event_visible_gas_product_mass + partner_next_pos_mass.w;
                }
                let gas = gas_product_mass_for_extent(reaction_index, extent_mol, mass_scale);
                let rx1 = reaction_row1(reaction_index);
                wg_canonical_events[local] = 1.0;
                wg_consumed_reactant_mass[local] = consumed_mass;
                wg_expected_product_mass[local] = consumed_mass;
                wg_raw_product_mass[local] = raw_product_mass;
                wg_ledger_visible_product_mass[local] = event_visible_product_mass;
                wg_ledger_unplaced_product_mass[local] = max(consumed_mass - event_visible_product_mass, 0.0);
                wg_ledger_gas_product_mass[local] = gas.x;
                wg_ledger_visible_gas_product_mass[local] = event_visible_gas_product_mass;
                wg_ledger_unplaced_gas_product_mass[local] = max(gas.x - event_visible_gas_product_mass, 0.0);
                wg_sealed_box_gas_product_moles[local] = gas.y;
                wg_reaction_heat[local] = -rx1.x * consumed_mass;
                wg_ledger_mass_residual[local] = raw_product_mass - consumed_mass;
                wg_ledger_ready_events[local] = 1.0;
              } else {
                wg_ledger_problem_events[local] = 1.0;
              }
            } else {
              wg_ledger_problem_events[local] = 1.0;
            }
          }
        }
      }
    }
  }

  workgroupBarrier();
  var stride = 32u;
  loop {
    if (local < stride) {
      wg_changed_material[local] = wg_changed_material[local] + wg_changed_material[local + stride];
      wg_changed_mass[local] = wg_changed_mass[local] + wg_changed_mass[local + stride];
      wg_visible_product_mass[local] = wg_visible_product_mass[local] + wg_visible_product_mass[local + stride];
      wg_visible_gas_product_mass[local] = wg_visible_gas_product_mass[local] + wg_visible_gas_product_mass[local + stride];
      wg_output_gas_phase_mass[local] = wg_output_gas_phase_mass[local] + wg_output_gas_phase_mass[local + stride];
      wg_source_mass[local] = wg_source_mass[local] + wg_source_mass[local + stride];
      wg_next_mass[local] = wg_next_mass[local] + wg_next_mass[local + stride];
      wg_thermal_ready[local] = wg_thermal_ready[local] + wg_thermal_ready[local + stride];
      wg_thermal_problem[local] = wg_thermal_problem[local] + wg_thermal_problem[local + stride];
      wg_finite_temperature[local] = wg_finite_temperature[local] + wg_finite_temperature[local + stride];
      wg_canonical_events[local] = wg_canonical_events[local] + wg_canonical_events[local + stride];
      wg_consumed_reactant_mass[local] = wg_consumed_reactant_mass[local] + wg_consumed_reactant_mass[local + stride];
      wg_expected_product_mass[local] = wg_expected_product_mass[local] + wg_expected_product_mass[local + stride];
      wg_raw_product_mass[local] = wg_raw_product_mass[local] + wg_raw_product_mass[local + stride];
      wg_ledger_visible_product_mass[local] = wg_ledger_visible_product_mass[local] + wg_ledger_visible_product_mass[local + stride];
      wg_ledger_unplaced_product_mass[local] = wg_ledger_unplaced_product_mass[local] + wg_ledger_unplaced_product_mass[local + stride];
      wg_ledger_gas_product_mass[local] = wg_ledger_gas_product_mass[local] + wg_ledger_gas_product_mass[local + stride];
      wg_ledger_visible_gas_product_mass[local] = wg_ledger_visible_gas_product_mass[local] + wg_ledger_visible_gas_product_mass[local + stride];
      wg_ledger_unplaced_gas_product_mass[local] = wg_ledger_unplaced_gas_product_mass[local] + wg_ledger_unplaced_gas_product_mass[local + stride];
      wg_sealed_box_gas_product_moles[local] = wg_sealed_box_gas_product_moles[local] + wg_sealed_box_gas_product_moles[local + stride];
      wg_reaction_heat[local] = wg_reaction_heat[local] + wg_reaction_heat[local + stride];
      wg_ledger_mass_residual[local] = wg_ledger_mass_residual[local] + wg_ledger_mass_residual[local + stride];
      wg_ledger_ready_events[local] = wg_ledger_ready_events[local] + wg_ledger_ready_events[local + stride];
      wg_ledger_problem_events[local] = wg_ledger_problem_events[local] + wg_ledger_problem_events[local + stride];
      wg_mutual_pairs[local] = wg_mutual_pairs[local] + wg_mutual_pairs[local + stride];
    }
    workgroupBarrier();
    if (stride == 1u) {
      break;
    }
    stride = stride / 2u;
  }

  if (local == 0u) {
    let base = workgroup_id.x * 8u;
    partial_summaries[base] = vec4<f32>(
      wg_changed_material[0u],
      wg_changed_mass[0u],
      wg_visible_product_mass[0u],
      wg_visible_gas_product_mass[0u]
    );
    partial_summaries[base + 1u] = vec4<f32>(
      wg_output_gas_phase_mass[0u],
      wg_source_mass[0u],
      wg_next_mass[0u],
      wg_next_mass[0u] - wg_source_mass[0u]
    );
    partial_summaries[base + 2u] = vec4<f32>(
      wg_thermal_ready[0u],
      wg_thermal_problem[0u],
      wg_finite_temperature[0u],
      1.0
    );
    partial_summaries[base + 3u] = vec4<f32>(
      wg_canonical_events[0u],
      wg_consumed_reactant_mass[0u],
      wg_expected_product_mass[0u],
      wg_raw_product_mass[0u]
    );
    partial_summaries[base + 4u] = vec4<f32>(
      wg_ledger_visible_product_mass[0u],
      wg_ledger_unplaced_product_mass[0u],
      wg_ledger_gas_product_mass[0u],
      wg_ledger_visible_gas_product_mass[0u]
    );
    partial_summaries[base + 5u] = vec4<f32>(
      wg_ledger_unplaced_gas_product_mass[0u],
      wg_sealed_box_gas_product_moles[0u],
      wg_reaction_heat[0u],
      wg_ledger_mass_residual[0u]
    );
    partial_summaries[base + 6u] = vec4<f32>(
      wg_ledger_ready_events[0u],
      wg_ledger_problem_events[0u],
      wg_mutual_pairs[0u],
      select(0.0, 1.0, params.has_proposals != 0u)
    );
    partial_summaries[base + 7u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
}
`;

export const sphReactionSummaryFinalizeWgsl = `
struct ReactionSummaryParams {
  particle_count: u32,
  reaction_count: u32,
  product_phase_count: u32,
  reactant_term_count: u32,
  product_term_count: u32,
  gas_product_count: u32,
  partial_count: u32,
  has_proposals: u32,
  _pad0: u32,
  // Interface-flux extent law substep duration (offset 36 in the shared
  // summary params packer); must match the apply kernel's dt_s.
  dt_s: f32,
  _pad2: u32,
  _pad3: u32,
};

@group(0) @binding(0) var<storage, read> partial_summaries: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> reaction_summary: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: ReactionSummaryParams;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x > 0u) {
    return;
  }
  var changed_material = 0.0;
  var changed_mass = 0.0;
  var visible_product_mass = 0.0;
  var visible_gas_product_mass = 0.0;
  var output_gas_phase_mass = 0.0;
  var source_mass = 0.0;
  var next_mass = 0.0;
  var thermal_ready = 0.0;
  var thermal_problem = 0.0;
  var finite_temperature = 0.0;
  var canonical_events = 0.0;
  var consumed_reactant_mass = 0.0;
  var expected_product_mass = 0.0;
  var raw_product_mass = 0.0;
  var ledger_visible_product_mass = 0.0;
  var ledger_unplaced_product_mass = 0.0;
  var ledger_gas_product_mass = 0.0;
  var ledger_visible_gas_product_mass = 0.0;
  var ledger_unplaced_gas_product_mass = 0.0;
  var sealed_box_gas_product_moles = 0.0;
  var reaction_heat = 0.0;
  var ledger_mass_residual = 0.0;
  var ledger_ready_events = 0.0;
  var ledger_problem_events = 0.0;
  var mutual_pairs = 0.0;
  var compact_ledger_available = 0.0;
  for (var partial_index = 0u; partial_index < params.partial_count; partial_index = partial_index + 1u) {
    let base = partial_index * 8u;
    let row0 = partial_summaries[base];
    let row1 = partial_summaries[base + 1u];
    let row2 = partial_summaries[base + 2u];
    let row3 = partial_summaries[base + 3u];
    let row4 = partial_summaries[base + 4u];
    let row5 = partial_summaries[base + 5u];
    let row6 = partial_summaries[base + 6u];
    changed_material = changed_material + row0.x;
    changed_mass = changed_mass + row0.y;
    visible_product_mass = visible_product_mass + row0.z;
    visible_gas_product_mass = visible_gas_product_mass + row0.w;
    output_gas_phase_mass = output_gas_phase_mass + row1.x;
    source_mass = source_mass + row1.y;
    next_mass = next_mass + row1.z;
    thermal_ready = thermal_ready + row2.x;
    thermal_problem = thermal_problem + row2.y;
    finite_temperature = finite_temperature + row2.z;
    canonical_events = canonical_events + row3.x;
    consumed_reactant_mass = consumed_reactant_mass + row3.y;
    expected_product_mass = expected_product_mass + row3.z;
    raw_product_mass = raw_product_mass + row3.w;
    ledger_visible_product_mass = ledger_visible_product_mass + row4.x;
    ledger_unplaced_product_mass = ledger_unplaced_product_mass + row4.y;
    ledger_gas_product_mass = ledger_gas_product_mass + row4.z;
    ledger_visible_gas_product_mass = ledger_visible_gas_product_mass + row4.w;
    ledger_unplaced_gas_product_mass = ledger_unplaced_gas_product_mass + row5.x;
    sealed_box_gas_product_moles = sealed_box_gas_product_moles + row5.y;
    reaction_heat = reaction_heat + row5.z;
    ledger_mass_residual = ledger_mass_residual + row5.w;
    ledger_ready_events = ledger_ready_events + row6.x;
    ledger_problem_events = ledger_problem_events + row6.y;
    mutual_pairs = mutual_pairs + row6.z;
    compact_ledger_available = max(compact_ledger_available, row6.w);
  }
  reaction_summary[0u] = vec4<f32>(
    f32(params.particle_count),
    f32(params.reaction_count),
    f32(params.product_term_count),
    f32(params.gas_product_count)
  );
  reaction_summary[1u] = vec4<f32>(
    changed_material,
    changed_mass,
    visible_product_mass,
    visible_gas_product_mass
  );
  reaction_summary[2u] = vec4<f32>(
    output_gas_phase_mass,
    source_mass,
    next_mass,
    next_mass - source_mass
  );
  reaction_summary[3u] = vec4<f32>(
    thermal_ready,
    thermal_problem,
    finite_temperature,
    1.0
  );
  reaction_summary[4u] = vec4<f32>(
    canonical_events,
    consumed_reactant_mass,
    expected_product_mass,
    raw_product_mass
  );
  reaction_summary[5u] = vec4<f32>(
    ledger_visible_product_mass,
    ledger_unplaced_product_mass,
    ledger_gas_product_mass,
    ledger_visible_gas_product_mass
  );
  reaction_summary[6u] = vec4<f32>(
    ledger_unplaced_gas_product_mass,
    sealed_box_gas_product_moles,
    reaction_heat,
    ledger_mass_residual
  );
  reaction_summary[7u] = vec4<f32>(
    ledger_ready_events,
    ledger_problem_events,
    mutual_pairs,
    compact_ledger_available
  );
}
`;

export const sphReactionProductInventoryWgsl = `
struct ReactionSummaryParams {
  particle_count: u32,
  reaction_count: u32,
  product_phase_count: u32,
  reactant_term_count: u32,
  product_term_count: u32,
  gas_product_count: u32,
  partial_count: u32,
  has_proposals: u32,
  _pad0: u32,
  // Interface-flux extent law substep duration (offset 36 in the shared
  // summary params packer); must match the apply kernel's dt_s.
  dt_s: f32,
  _pad2: u32,
  _pad3: u32,
};

struct ReactantTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  status: f32,
  // Interface mass flux [kg/m^2/s] at the reference temperature — the
  // transport prefactor for the interface-flux extent law (see the shared
  // helper); packed by the reaction-table builder in the term row pad lane.
  interface_flux: f32,
};

struct ProductMechanics {
  rest_density: f32,
  effective_bulk: f32,
  shear: f32,
  lambda: f32,
  sound_speed: f32,
  eos_model_id: f32,
  solid_flag: f32,
  status: f32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> next_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> next_thermo: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> proposals: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> product_inventory: array<vec4<f32>>;
@group(0) @binding(7) var<uniform> params: ReactionSummaryParams;

fn reaction_header_row0(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u];
}

fn reaction_header_row1(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u + 1u];
}

fn reactant_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u];
}

fn reactant_term_row2(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u + 2u];
}

fn product_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u];
}

fn product_term_row1(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 1u];
}

fn product_term_row3(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 3u];
}

// Interface-flux extent cap [mol] for one reacting pair over one substep.
// A contact event may only convert as much matter as transport can deliver
// through the contact interface: extent_rate = A_contact * max_i(nu_i /
// (coef_i * M_i)) where nu_i is reactant i's interface mass flux [kg/m^2/s]
// at its current temperature and the max expresses that the mobile species'
// pathway governs (e.g. water vapor reaching a sodium surface). A_contact is
// the contact disc of the smaller rest-volume radius - the same contact
// geometry the pair-conduction law uses - so thermal and chemical transport
// see one consistent interface. nu scales as sqrt(T/T_ref) (effusion flux
// rho*vbar/4 with vbar ~ sqrt(T)); the vapor-carrier density's exponential
// Clausius-Clapeyron growth with T is NOT modelled - a conservative,
// documented frontier gap. When neither reactant carries a derivable flux
// (nu_i = 0: condensed-condensed, non-volatile) or dt is 0 (stale packer),
// the cap disables and the stoichiometric availability bound alone applies -
// the pre-flux-law behavior. Every module that computes a reaction extent
// (apply, summary partials, product inventory, product events, atom
// residual, gas species) MUST apply this identical cap or their ledgers
// disagree and phantom product mass appears.
const INTERFACE_FLUX_REFERENCE_TEMPERATURE_K: f32 = 293.15;

fn interface_flux_extent_cap_mol(
  self_mass_kg: f32,
  self_rest_density: f32,
  self_temperature_k: f32,
  self_coefficient: f32,
  self_molar_mass: f32,
  self_interface_flux: f32,
  partner_mass_kg: f32,
  partner_rest_density: f32,
  partner_temperature_k: f32,
  partner_coefficient: f32,
  partner_molar_mass: f32,
  partner_interface_flux: f32,
  dt_s: f32
) -> f32 {
  let no_cap = 3.0e38;
  if (dt_s <= 0.0) {
    return no_cap;
  }
  let self_rate = self_interface_flux
    * sqrt(max(self_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(self_coefficient * self_molar_mass, 1.0e-20);
  let partner_rate = partner_interface_flux
    * sqrt(max(partner_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(partner_coefficient * partner_molar_mass, 1.0e-20);
  let mobile_rate = max(self_rate, partner_rate);
  if (mobile_rate <= 0.0) {
    return no_cap;
  }
  let self_radius = pow(
    max(3.0 * self_mass_kg / (12.5663706 * max(self_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let partner_radius = pow(
    max(3.0 * partner_mass_kg / (12.5663706 * max(partner_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let contact_radius = min(self_radius, partner_radius);
  let contact_area = 3.14159265 * contact_radius * contact_radius;
  return mobile_rate * contact_area * dt_s;
}

fn reactant_term_for_material(reaction_index: u32, material_id: f32) -> ReactantTerm {
  let header0 = reaction_header_row0(reaction_index);
  let reactant_term_offset = u32(max(header0.y, 0.0));
  let reactant_term_count = u32(max(header0.z, 0.0));
  for (var local = 0u; local < reactant_term_count; local = local + 1u) {
    let term_index = reactant_term_offset + local;
    let term0 = reactant_term_row0(term_index);
    let term2 = reactant_term_row2(term_index);
    if (term0.y == material_id && term2.z == 1.0) {
      return ReactantTerm(term0.y, term0.z, term0.w, term2.z, term2.w);
    }
  }
  return ReactantTerm(0.0, 0.0, 0.0, 0.0, 0.0);
}

fn product_raw_mass_sum_for_extent(reaction_index: u32, extent_mol: f32) -> f32 {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  var sum = 0.0;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term0.z > 0.0 && term0.w > 0.0) {
      sum = sum + extent_mol * term0.z * term0.w;
    }
  }
  return sum;
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let product_term_index = global_id.x;
  if (product_term_index >= params.product_term_count) {
    return;
  }
  let term0 = product_term_row0(product_term_index);
  let term1 = product_term_row1(product_term_index);
  let term3 = product_term_row3(product_term_index);
  let reaction_index = u32(max(term0.x, 0.0));
  let material_id = term0.y;
  let coefficient = term0.z;
  let molar_mass = term0.w;
  let routing_id = term1.y;
  let status = term1.w;
  let charge = term3.z;
  var raw_mass_kg = 0.0;
  var mass_kg = 0.0;
  var moles = 0.0;
  var visible_mass_kg = 0.0;
  var event_count = 0.0;
  var mass_scale_acc = 0.0;

  if (params.has_proposals != 0u && status == 1.0 && molar_mass > 0.0 && coefficient > 0.0) {
    for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
      let proposal = proposals[particle_index];
      if (proposal.x < 0.0 || proposal.y < 0.0 || u32(proposal.y + 0.5) != reaction_index) {
        continue;
      }
      let partner_index = u32(proposal.x + 0.5);
      if (partner_index >= params.particle_count || particle_index >= partner_index) {
        continue;
      }
      let partner_proposal = proposals[partner_index];
      if (partner_proposal.x < 0.0 || u32(partner_proposal.x + 0.5) != particle_index || partner_proposal.y != proposal.y) {
        continue;
      }
      let source_pos_mass = source_state[particle_index * 2u];
      let partner_source_pos_mass = source_state[partner_index * 2u];
      let source_row0 = source_thermo[particle_index * 3u];
      let partner_source_row0 = source_thermo[partner_index * 3u];
      let source_term = reactant_term_for_material(reaction_index, source_row0.x);
      let partner_term = reactant_term_for_material(reaction_index, partner_source_row0.x);
      let has_stoichiometry = source_term.status == 1.0
        && partner_term.status == 1.0
        && source_term.coefficient > 0.0
        && partner_term.coefficient > 0.0
        && source_term.molar_mass > 0.0
        && partner_term.molar_mass > 0.0;
      if (!has_stoichiometry) {
        continue;
      }
      let source_extent = source_pos_mass.w / max(source_term.coefficient * source_term.molar_mass, 1.0e-20);
      let partner_extent = partner_source_pos_mass.w / max(partner_term.coefficient * partner_term.molar_mass, 1.0e-20);
      // Identical flux cap as the apply kernel so every ledger agrees on the
      // consumed extent (divergence here mints phantom product mass).
      let extent_availability_mol = min(source_extent, partner_extent);
      let extent_flux_cap_mol = interface_flux_extent_cap_mol(
        source_pos_mass.w, source_row0.w, source_row0.z,
        source_term.coefficient, source_term.molar_mass, source_term.interface_flux,
        partner_source_pos_mass.w, partner_source_row0.w, partner_source_row0.z,
        partner_term.coefficient, partner_term.molar_mass, partner_term.interface_flux,
        params.dt_s
      );
      let extent_mol = min(extent_availability_mol, extent_flux_cap_mol);
      let source_consumed = min(source_pos_mass.w, extent_mol * source_term.coefficient * source_term.molar_mass);
      let partner_consumed = min(partner_source_pos_mass.w, extent_mol * partner_term.coefficient * partner_term.molar_mass);
      let consumed_mass = source_consumed + partner_consumed;
      let raw_product_mass = product_raw_mass_sum_for_extent(reaction_index, extent_mol);
      if (extent_mol <= 0.0 || consumed_mass <= 0.0 || raw_product_mass <= 0.0) {
        continue;
      }
      let mass_scale = consumed_mass / raw_product_mass;
      let row_raw_mass = extent_mol * coefficient * molar_mass;
      let row_mass = row_raw_mass * mass_scale;
      raw_mass_kg = raw_mass_kg + row_raw_mass;
      mass_kg = mass_kg + row_mass;
      moles = moles + row_mass / molar_mass;
      mass_scale_acc = mass_scale_acc + mass_scale;
      let next0 = next_thermo[particle_index * 3u];
      let next1 = next_thermo[partner_index * 3u];
      if (next0.x == material_id) {
        visible_mass_kg = visible_mass_kg + next_state[particle_index * 2u].w;
      }
      if (next1.x == material_id) {
        visible_mass_kg = visible_mass_kg + next_state[partner_index * 2u].w;
      }
      event_count = event_count + 1.0;
    }
  }

  let out_base = product_term_index * 4u;
  let unplaced_mass_kg = max(mass_kg - visible_mass_kg, 0.0);
  let mean_mass_scale = select(0.0, mass_scale_acc / event_count, event_count > 0.0);
  product_inventory[out_base] = vec4<f32>(material_id, mass_kg, visible_mass_kg, unplaced_mass_kg);
  product_inventory[out_base + 1u] = vec4<f32>(moles, event_count, f32(product_term_index), f32(reaction_index));
  product_inventory[out_base + 2u] = vec4<f32>(routing_id, moles * charge, raw_mass_kg - mass_kg, status);
  product_inventory[out_base + 3u] = vec4<f32>(coefficient, molar_mass, raw_mass_kg, mean_mass_scale);
}
`;

export const sphReactionProductEventWgsl = `
struct ReactionSummaryParams {
  particle_count: u32,
  reaction_count: u32,
  product_phase_count: u32,
  reactant_term_count: u32,
  product_term_count: u32,
  gas_product_count: u32,
  partial_count: u32,
  has_proposals: u32,
  atom_term_count: u32,
  // Interface-flux extent law substep duration (offset 36 in the shared
  // summary params packer); must match the apply kernel's dt_s.
  dt_s: f32,
  _pad2: u32,
  _pad3: u32,
};

struct ReactantTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  status: f32,
  // Interface mass flux [kg/m^2/s] at the reference temperature — the
  // transport prefactor for the interface-flux extent law (see the shared
  // helper); packed by the reaction-table builder in the term row pad lane.
  interface_flux: f32,
};

struct ProductMechanics {
  rest_density: f32,
  effective_bulk: f32,
  shear: f32,
  lambda: f32,
  sound_speed: f32,
  eos_model_id: f32,
  solid_flag: f32,
  status: f32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> next_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> next_thermo: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> proposals: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> product_events: array<vec4<f32>>;
@group(0) @binding(7) var<uniform> params: ReactionSummaryParams;
@group(0) @binding(8) var<storage, read> source_mechanics: array<vec4<f32>>;

fn reaction_header_row0(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u];
}

fn reaction_header_row1(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u + 1u];
}

fn reactant_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u];
}

fn reactant_term_row2(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u + 2u];
}

fn product_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u];
}

fn product_term_row1(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let product_base = header_base + params.reaction_count * 4u + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 1u];
}

fn product_term_row2(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let product_base = header_base + params.reaction_count * 4u + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 2u];
}

fn product_term_row3(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let product_base = header_base + params.reaction_count * 4u + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 3u];
}

fn product_phase_row0(phase_index: u32) -> vec4<f32> {
  let phase_base = params.reaction_count * 3u;
  return reaction_records[phase_base + phase_index * 3u];
}

fn product_phase_row1(phase_index: u32) -> vec4<f32> {
  let phase_base = params.reaction_count * 3u;
  return reaction_records[phase_base + phase_index * 3u + 1u];
}

fn product_phase_row2(phase_index: u32) -> vec4<f32> {
  let phase_base = params.reaction_count * 3u;
  return reaction_records[phase_base + phase_index * 3u + 2u];
}

fn resolved_product_phase_id(term_index: u32, target_phase_id: f32, material_id: f32) -> f32 {
  if (target_phase_id > 0.0) {
    return target_phase_id;
  }
  let term2 = product_term_row2(term_index);
  let term3 = product_term_row3(term_index);
  let phase_offset = u32(max(term2.w, 0.0));
  let phase_count = u32(max(term3.x, 0.0));
  if (phase_count != 1u || phase_offset >= params.product_phase_count) {
    return 0.0;
  }
  let phase0 = product_phase_row0(phase_offset);
  let phase2 = product_phase_row2(phase_offset);
  if (phase0.x != material_id || !(phase0.y > 0.0) || !(phase0.z > 0.0) || phase2.y != 1.0) {
    return 0.0;
  }
  return phase0.y;
}

fn reaction_row1(reaction_index: u32) -> vec4<f32> {
  return reaction_records[reaction_index * 3u + 1u];
}

// Mirrors product_term_for_parent_slot in the apply kernel, but returns the
// packed product-term index so event provenance can attribute the exact
// freed-parent assignment. Material matching is not sufficient: distinct
// terms may share a material, and reactant remainder mass may share it too.
fn product_term_index_for_parent_slot(reaction_index: u32, parent_slot: u32) -> u32 {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  var condensed_count = 0u;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term1.y < 0.5) {
      condensed_count = condensed_count + 1u;
    }
  }
  if (parent_slot < condensed_count) {
    var condensed_index = 0u;
    for (var local = 0u; local < product_term_count; local = local + 1u) {
      let term_index = product_term_offset + local;
      let term1 = product_term_row1(term_index);
      if (term1.w == 1.0 && term1.y < 0.5) {
        if (condensed_index == parent_slot) {
          return term_index;
        }
        condensed_index = condensed_index + 1u;
      }
    }
  }
  var gas_count = 0u;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term1.y >= 0.5) {
      gas_count = gas_count + 1u;
    }
  }
  if (gas_count == 0u) {
    return 0xffffffffu;
  }
  let gas_slot = min(parent_slot - condensed_count, gas_count - 1u);
  var gas_index = 0u;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term_index = product_term_offset + local;
    let term1 = product_term_row1(term_index);
    if (term1.w == 1.0 && term1.y >= 0.5) {
      if (gas_index == gas_slot) {
        return term_index;
      }
      gas_index = gas_index + 1u;
    }
  }
  return 0xffffffffu;
}

fn product_mechanics_for(material_id: f32, phase_id: f32) -> ProductMechanics {
  for (var phase_index = 0u; phase_index < params.product_phase_count; phase_index = phase_index + 1u) {
    let row0 = product_phase_row0(phase_index);
    let row1 = product_phase_row1(phase_index);
    let row2 = product_phase_row2(phase_index);
    if (row0.x == material_id && row0.y == phase_id && row2.y == 1.0) {
      return ProductMechanics(
        row0.z,
        row0.w,
        row1.x,
        row1.y,
        row1.z,
        row1.w,
        row2.x,
        row2.y
      );
    }
  }
  return ProductMechanics(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
}

// Interface-flux extent cap [mol] for one reacting pair over one substep.
// A contact event may only convert as much matter as transport can deliver
// through the contact interface: extent_rate = A_contact * max_i(nu_i /
// (coef_i * M_i)) where nu_i is reactant i's interface mass flux [kg/m^2/s]
// at its current temperature and the max expresses that the mobile species'
// pathway governs (e.g. water vapor reaching a sodium surface). A_contact is
// the contact disc of the smaller rest-volume radius - the same contact
// geometry the pair-conduction law uses - so thermal and chemical transport
// see one consistent interface. nu scales as sqrt(T/T_ref) (effusion flux
// rho*vbar/4 with vbar ~ sqrt(T)); the vapor-carrier density's exponential
// Clausius-Clapeyron growth with T is NOT modelled - a conservative,
// documented frontier gap. When neither reactant carries a derivable flux
// (nu_i = 0: condensed-condensed, non-volatile) or dt is 0 (stale packer),
// the cap disables and the stoichiometric availability bound alone applies -
// the pre-flux-law behavior. Every module that computes a reaction extent
// (apply, summary partials, product inventory, product events, atom
// residual, gas species) MUST apply this identical cap or their ledgers
// disagree and phantom product mass appears.
const INTERFACE_FLUX_REFERENCE_TEMPERATURE_K: f32 = 293.15;

fn interface_flux_extent_cap_mol(
  self_mass_kg: f32,
  self_rest_density: f32,
  self_temperature_k: f32,
  self_coefficient: f32,
  self_molar_mass: f32,
  self_interface_flux: f32,
  partner_mass_kg: f32,
  partner_rest_density: f32,
  partner_temperature_k: f32,
  partner_coefficient: f32,
  partner_molar_mass: f32,
  partner_interface_flux: f32,
  dt_s: f32
) -> f32 {
  let no_cap = 3.0e38;
  if (dt_s <= 0.0) {
    return no_cap;
  }
  let self_rate = self_interface_flux
    * sqrt(max(self_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(self_coefficient * self_molar_mass, 1.0e-20);
  let partner_rate = partner_interface_flux
    * sqrt(max(partner_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(partner_coefficient * partner_molar_mass, 1.0e-20);
  let mobile_rate = max(self_rate, partner_rate);
  if (mobile_rate <= 0.0) {
    return no_cap;
  }
  let self_radius = pow(
    max(3.0 * self_mass_kg / (12.5663706 * max(self_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let partner_radius = pow(
    max(3.0 * partner_mass_kg / (12.5663706 * max(partner_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let contact_radius = min(self_radius, partner_radius);
  let contact_area = 3.14159265 * contact_radius * contact_radius;
  return mobile_rate * contact_area * dt_s;
}

fn reactant_term_for_material(reaction_index: u32, material_id: f32) -> ReactantTerm {
  let header0 = reaction_header_row0(reaction_index);
  let reactant_term_offset = u32(max(header0.y, 0.0));
  let reactant_term_count = u32(max(header0.z, 0.0));
  for (var local = 0u; local < reactant_term_count; local = local + 1u) {
    let term_index = reactant_term_offset + local;
    let term0 = reactant_term_row0(term_index);
    let term2 = reactant_term_row2(term_index);
    if (term0.y == material_id && term2.z == 1.0) {
      return ReactantTerm(term0.y, term0.z, term0.w, term2.z, term2.w);
    }
  }
  return ReactantTerm(0.0, 0.0, 0.0, 0.0, 0.0);
}

fn product_raw_mass_sum_for_extent(reaction_index: u32, extent_mol: f32) -> f32 {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  var sum = 0.0;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term0.z > 0.0 && term0.w > 0.0) {
      sum = sum + extent_mol * term0.z * term0.w;
    }
  }
  return sum;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let linear_index = global_id.x;
  let event_capacity = params.particle_count * params.product_term_count;
  if (linear_index >= event_capacity || params.particle_count == 0u) {
    return;
  }
  let particle_index = linear_index / params.product_term_count;
  let product_term_index = linear_index - particle_index * params.product_term_count;
	  let out_base = linear_index * 8u;
	  product_events[out_base] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
	  product_events[out_base + 1u] = vec4<f32>(0.0, f32(product_term_index), 0.0, f32(particle_index));
	  product_events[out_base + 2u] = vec4<f32>(-1.0, 0.0, 0.0, 0.0);
	  product_events[out_base + 3u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
	  product_events[out_base + 4u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
	  product_events[out_base + 5u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
	  product_events[out_base + 6u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
	  product_events[out_base + 7u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  if (params.has_proposals == 0u || particle_index >= params.particle_count) {
    return;
  }

  let term0 = product_term_row0(product_term_index);
  let term1 = product_term_row1(product_term_index);
  let reaction_index = u32(max(term0.x, 0.0));
  let material_id = term0.y;
	  let coefficient = term0.z;
	  let molar_mass = term0.w;
	  let routing_id = term1.y;
	  let target_phase_id = term1.z;
	  let status = term1.w;
  let proposal = proposals[particle_index];
  if (proposal.x < 0.0 || proposal.y < 0.0 || u32(proposal.y + 0.5) != reaction_index || status != 1.0 || molar_mass <= 0.0 || coefficient <= 0.0) {
    return;
  }
  let partner_index = u32(proposal.x + 0.5);
  if (partner_index >= params.particle_count || particle_index >= partner_index) {
    return;
  }
  let partner_proposal = proposals[partner_index];
  if (partner_proposal.x < 0.0 || u32(partner_proposal.x + 0.5) != particle_index || partner_proposal.y != proposal.y) {
    return;
  }

  let source_pos_mass = source_state[particle_index * 2u];
  let partner_source_pos_mass = source_state[partner_index * 2u];
  let source_row0 = source_thermo[particle_index * 3u];
  let partner_source_row0 = source_thermo[partner_index * 3u];
  let source_term = reactant_term_for_material(reaction_index, source_row0.x);
  let partner_term = reactant_term_for_material(reaction_index, partner_source_row0.x);
  let has_stoichiometry = source_term.status == 1.0
    && partner_term.status == 1.0
    && source_term.coefficient > 0.0
    && partner_term.coefficient > 0.0
    && source_term.molar_mass > 0.0
    && partner_term.molar_mass > 0.0;
  if (!has_stoichiometry) {
    return;
  }
  let source_extent = source_pos_mass.w / max(source_term.coefficient * source_term.molar_mass, 1.0e-20);
  let partner_extent = partner_source_pos_mass.w / max(partner_term.coefficient * partner_term.molar_mass, 1.0e-20);
  // Identical flux cap as the apply kernel so every ledger agrees on the
  // consumed extent (divergence here mints phantom product mass).
  let extent_availability_mol = min(source_extent, partner_extent);
  let extent_flux_cap_mol = interface_flux_extent_cap_mol(
    source_pos_mass.w, source_row0.w, source_row0.z,
    source_term.coefficient, source_term.molar_mass, source_term.interface_flux,
    partner_source_pos_mass.w, partner_source_row0.w, partner_source_row0.z,
    partner_term.coefficient, partner_term.molar_mass, partner_term.interface_flux,
    params.dt_s
  );
  let extent_mol = min(extent_availability_mol, extent_flux_cap_mol);
  let source_consumed = min(source_pos_mass.w, extent_mol * source_term.coefficient * source_term.molar_mass);
  let partner_consumed = min(partner_source_pos_mass.w, extent_mol * partner_term.coefficient * partner_term.molar_mass);
  let consumed_mass = source_consumed + partner_consumed;
  let source_volume_row = source_mechanics[particle_index * 8u + 4u];
  let partner_volume_row = source_mechanics[partner_index * 8u + 4u];
  let source_constitutive_row = source_mechanics[particle_index * 8u + 5u];
  let partner_constitutive_row = source_mechanics[partner_index * 8u + 5u];
  let source_eos_row = source_mechanics[particle_index * 8u + 6u];
  let partner_eos_row = source_mechanics[partner_index * 8u + 6u];
  let source_current_volume = source_volume_row.z * source_volume_row.w;
  let partner_current_volume = partner_volume_row.z * partner_volume_row.w;
  if (
    !all(vec4<bool>(
      source_volume_row.z > 0.0,
      source_volume_row.w > 0.0,
      source_current_volume > 0.0,
      source_current_volume == source_current_volume
    ))
    || !all(vec4<bool>(
      partner_volume_row.z > 0.0,
      partner_volume_row.w > 0.0,
      partner_current_volume > 0.0,
      partner_current_volume == partner_current_volume
    ))
    || abs(source_current_volume) > 3.402823e38
    || abs(partner_current_volume) > 3.402823e38
    || source_constitutive_row.y != 1.0
    || partner_constitutive_row.y != 1.0
    || source_eos_row.w != 1.0
    || partner_eos_row.w != 1.0
  ) {
    return;
  }
  let consumed_current_volume =
    source_current_volume * source_consumed / max(source_pos_mass.w, 1.0e-20)
    + partner_current_volume * partner_consumed / max(partner_source_pos_mass.w, 1.0e-20);
  let raw_product_mass = product_raw_mass_sum_for_extent(reaction_index, extent_mol);
  if (extent_mol <= 0.0 || consumed_mass <= 0.0 || raw_product_mass <= 0.0) {
    return;
  }
  let mass_scale = consumed_mass / raw_product_mass;
  let row_mass = extent_mol * coefficient * molar_mass * mass_scale;
  let row_moles = row_mass / molar_mass;
  let row_current_volume = consumed_current_volume * row_mass / max(consumed_mass, 1.0e-20);
	  let next0 = next_thermo[particle_index * 3u];
	  let next1 = next_thermo[partner_index * 3u];
	  var phase_id = resolved_product_phase_id(product_term_index, target_phase_id, material_id);
	  var temperature_k = 0.5 * (source_row0.z + partner_source_row0.z);
	  var rest_density_kg_per_m3 = 0.0;
	  if (next0.x == material_id) {
	    phase_id = select(phase_id, next0.y, phase_id <= 0.0);
	    temperature_k = next0.z;
	    rest_density_kg_per_m3 = next0.w;
	  }
	  if (next1.x == material_id) {
	    phase_id = select(phase_id, next1.y, phase_id <= 0.0);
	    temperature_k = next1.z;
	    rest_density_kg_per_m3 = next1.w;
	  }
	  let source_remaining = max(source_pos_mass.w - source_consumed, 0.0);
	  let partner_remaining = max(partner_source_pos_mass.w - partner_consumed, 0.0);
	  let source_free = source_remaining <= max(source_pos_mass.w, 1.0) * 1.0e-7;
	  let partner_free = partner_remaining <= max(partner_source_pos_mass.w, 1.0) * 1.0e-7;
	  let reaction_product_term_count = u32(max(reaction_header_row1(reaction_index).x, 0.0));
	  var direct_placed_mass_kg = 0.0;
	  if (source_free && product_term_index_for_parent_slot(reaction_index, 0u) == product_term_index) {
	    direct_placed_mass_kg = direct_placed_mass_kg + select(
	      row_mass,
	      source_consumed,
	      reaction_product_term_count == 1u && partner_free
	    );
	  }
	  let partner_parent_slot = select(0u, 1u, source_free);
	  if (partner_free && product_term_index_for_parent_slot(reaction_index, partner_parent_slot) == product_term_index) {
	    direct_placed_mass_kg = direct_placed_mass_kg + select(
	      row_mass,
	      partner_consumed,
	      reaction_product_term_count == 1u && source_free
	    );
	  }
	  direct_placed_mass_kg = min(max(direct_placed_mass_kg, 0.0), row_mass);
	  let unplaced_mass_kg = max(row_mass - direct_placed_mass_kg, 0.0);
	  let product_mechanics = product_mechanics_for(material_id, phase_id);
	  rest_density_kg_per_m3 = select(
	    rest_density_kg_per_m3,
	    product_mechanics.rest_density,
	    rest_density_kg_per_m3 <= 0.0 && product_mechanics.rest_density > 0.0
	  );
	  let source_velocity = source_state[particle_index * 2u + 1u].xyz;
	  let partner_velocity = source_state[partner_index * 2u + 1u].xyz;
	  let product_velocity = (source_velocity * source_consumed + partner_velocity * partner_consumed)
	    / max(consumed_mass, 1.0e-20);
	  // Specific internal energy is identical to the apply kernel: the consumed
	  // total (internal + kinetic) energy, plus reaction heat, minus the product
	  // COM kinetic energy. Relative approach kinetic energy is thermalized.
	  let source_u = source_state[particle_index * 2u + 1u].w;
	  let partner_u = source_state[partner_index * 2u + 1u].w;
	  let rx1 = reaction_row1(reaction_index);
	  let consumed_total_energy =
	    source_consumed * (source_u + 0.5 * dot(source_velocity, source_velocity))
	    + partner_consumed * (partner_u + 0.5 * dot(partner_velocity, partner_velocity));
	  let product_u = (
	    consumed_total_energy
	    - rx1.x * consumed_mass
	    - 0.5 * consumed_mass * dot(product_velocity, product_velocity)
	  ) / max(consumed_mass, 1.0e-20);
	  let support_volume_m3 = row_current_volume
	    * unplaced_mass_kg / max(row_mass, 1.0e-20);
	  let event_ready = phase_id > 0.0
	    && rest_density_kg_per_m3 > 0.0
	    && product_mechanics.status == 1.0
	    && (unplaced_mass_kg <= 0.0 || support_volume_m3 > 0.0);
	  let midpoint = 0.5 * (source_pos_mass.xyz + partner_source_pos_mass.xyz);
	  product_events[out_base] = vec4<f32>(midpoint.x, midpoint.y, midpoint.z, row_mass);
	  product_events[out_base + 1u] = vec4<f32>(material_id, f32(product_term_index), f32(reaction_index), f32(particle_index));
	  product_events[out_base + 2u] = vec4<f32>(f32(partner_index), row_moles, routing_id, phase_id);
	  product_events[out_base + 3u] = vec4<f32>(direct_placed_mass_kg, unplaced_mass_kg, coefficient, molar_mass);
	  product_events[out_base + 4u] = vec4<f32>(
	    temperature_k,
	    rest_density_kg_per_m3,
	    select(0.0, 1.0, event_ready),
	    product_u
	  );
	  product_events[out_base + 5u] = vec4<f32>(product_velocity.x, product_velocity.y, product_velocity.z, support_volume_m3);
	  product_events[out_base + 6u] = vec4<f32>(
	    product_mechanics.effective_bulk,
	    product_mechanics.shear,
	    product_mechanics.lambda,
	    product_mechanics.sound_speed
	  );
	  product_events[out_base + 7u] = vec4<f32>(
	    product_mechanics.eos_model_id,
	    product_mechanics.solid_flag,
	    product_mechanics.status,
	    select(0.0, 1.0, event_ready)
	  );
	}
`;

export const sphReactionAtomResidualWgsl = `
struct ReactionSummaryParams {
  particle_count: u32,
  reaction_count: u32,
  product_phase_count: u32,
  reactant_term_count: u32,
  product_term_count: u32,
  gas_product_count: u32,
  partial_count: u32,
  has_proposals: u32,
  atom_term_count: u32,
  // Interface-flux extent law substep duration (offset 36 in the shared
  // summary params packer); must match the apply kernel's dt_s.
  dt_s: f32,
  _pad2: u32,
  _pad3: u32,
};

struct ReactantTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  status: f32,
  // Interface mass flux [kg/m^2/s] at the reference temperature — the
  // transport prefactor for the interface-flux extent law (see the shared
  // helper); packed by the reaction-table builder in the term row pad lane.
  interface_flux: f32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> proposals: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> atom_residuals: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> params: ReactionSummaryParams;

fn reaction_header_row0(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u];
}

fn reaction_header_row1(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u + 1u];
}

fn reactant_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u];
}

fn reactant_term_row2(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u + 2u];
}

fn product_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u];
}

fn product_term_row1(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 1u];
}

fn atom_term_row(atom_term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  let gas_base = product_base + params.product_term_count * 4u;
  let atom_base = gas_base + params.gas_product_count * 2u;
  return reaction_records[atom_base + atom_term_index * 2u];
}

fn atom_term_row1(atom_term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  let gas_base = product_base + params.product_term_count * 4u;
  let atom_base = gas_base + params.gas_product_count * 2u;
  return reaction_records[atom_base + atom_term_index * 2u + 1u];
}

// Interface-flux extent cap [mol] for one reacting pair over one substep.
// A contact event may only convert as much matter as transport can deliver
// through the contact interface: extent_rate = A_contact * max_i(nu_i /
// (coef_i * M_i)) where nu_i is reactant i's interface mass flux [kg/m^2/s]
// at its current temperature and the max expresses that the mobile species'
// pathway governs (e.g. water vapor reaching a sodium surface). A_contact is
// the contact disc of the smaller rest-volume radius - the same contact
// geometry the pair-conduction law uses - so thermal and chemical transport
// see one consistent interface. nu scales as sqrt(T/T_ref) (effusion flux
// rho*vbar/4 with vbar ~ sqrt(T)); the vapor-carrier density's exponential
// Clausius-Clapeyron growth with T is NOT modelled - a conservative,
// documented frontier gap. When neither reactant carries a derivable flux
// (nu_i = 0: condensed-condensed, non-volatile) or dt is 0 (stale packer),
// the cap disables and the stoichiometric availability bound alone applies -
// the pre-flux-law behavior. Every module that computes a reaction extent
// (apply, summary partials, product inventory, product events, atom
// residual, gas species) MUST apply this identical cap or their ledgers
// disagree and phantom product mass appears.
const INTERFACE_FLUX_REFERENCE_TEMPERATURE_K: f32 = 293.15;

fn interface_flux_extent_cap_mol(
  self_mass_kg: f32,
  self_rest_density: f32,
  self_temperature_k: f32,
  self_coefficient: f32,
  self_molar_mass: f32,
  self_interface_flux: f32,
  partner_mass_kg: f32,
  partner_rest_density: f32,
  partner_temperature_k: f32,
  partner_coefficient: f32,
  partner_molar_mass: f32,
  partner_interface_flux: f32,
  dt_s: f32
) -> f32 {
  let no_cap = 3.0e38;
  if (dt_s <= 0.0) {
    return no_cap;
  }
  let self_rate = self_interface_flux
    * sqrt(max(self_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(self_coefficient * self_molar_mass, 1.0e-20);
  let partner_rate = partner_interface_flux
    * sqrt(max(partner_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(partner_coefficient * partner_molar_mass, 1.0e-20);
  let mobile_rate = max(self_rate, partner_rate);
  if (mobile_rate <= 0.0) {
    return no_cap;
  }
  let self_radius = pow(
    max(3.0 * self_mass_kg / (12.5663706 * max(self_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let partner_radius = pow(
    max(3.0 * partner_mass_kg / (12.5663706 * max(partner_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let contact_radius = min(self_radius, partner_radius);
  let contact_area = 3.14159265 * contact_radius * contact_radius;
  return mobile_rate * contact_area * dt_s;
}

fn reactant_term_for_material(reaction_index: u32, material_id: f32) -> ReactantTerm {
  let header0 = reaction_header_row0(reaction_index);
  let reactant_term_offset = u32(max(header0.y, 0.0));
  let reactant_term_count = u32(max(header0.z, 0.0));
  for (var local = 0u; local < reactant_term_count; local = local + 1u) {
    let term_index = reactant_term_offset + local;
    let term0 = reactant_term_row0(term_index);
    let term2 = reactant_term_row2(term_index);
    if (term0.y == material_id && term2.z == 1.0) {
      return ReactantTerm(term0.y, term0.z, term0.w, term2.z, term2.w);
    }
  }
  return ReactantTerm(0.0, 0.0, 0.0, 0.0, 0.0);
}

fn product_raw_mass_sum_for_extent(reaction_index: u32, extent_mol: f32) -> f32 {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  var sum = 0.0;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term0.z > 0.0 && term0.w > 0.0) {
      sum = sum + extent_mol * term0.z * term0.w;
    }
  }
  return sum;
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let atom_term_index = global_id.x;
  if (atom_term_index >= params.atom_term_count) {
    return;
  }
  let atom0 = atom_term_row(atom_term_index);
  let atom1 = atom_term_row1(atom_term_index);
  let reaction_index = u32(max(atom0.x, 0.0));
  let term_kind_id = atom0.y;
  let source_term_index = atom0.z;
  let atomic_number_z = atom0.w;
  let atoms_per_formula = atom1.x;
  let coefficient = atom1.y;
  let charge = atom1.z;
  let status = atom1.w;
  var atom_residual_mol = 0.0;
  var charge_residual_mol = 0.0;
  var event_count = 0.0;

  if (params.has_proposals != 0u && status == 1.0 && atomic_number_z > 0.0 && atoms_per_formula > 0.0 && coefficient > 0.0) {
    for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
      let proposal = proposals[particle_index];
      if (proposal.x < 0.0 || proposal.y < 0.0 || u32(proposal.y + 0.5) != reaction_index) {
        continue;
      }
      let partner_index = u32(proposal.x + 0.5);
      if (partner_index >= params.particle_count || particle_index >= partner_index) {
        continue;
      }
      let partner_proposal = proposals[partner_index];
      if (partner_proposal.x < 0.0 || u32(partner_proposal.x + 0.5) != particle_index || partner_proposal.y != proposal.y) {
        continue;
      }
      let source_pos_mass = source_state[particle_index * 2u];
      let partner_source_pos_mass = source_state[partner_index * 2u];
      let source_row0 = source_thermo[particle_index * 3u];
      let partner_source_row0 = source_thermo[partner_index * 3u];
      let source_term = reactant_term_for_material(reaction_index, source_row0.x);
      let partner_term = reactant_term_for_material(reaction_index, partner_source_row0.x);
      let has_stoichiometry = source_term.status == 1.0
        && partner_term.status == 1.0
        && source_term.coefficient > 0.0
        && partner_term.coefficient > 0.0
        && source_term.molar_mass > 0.0
        && partner_term.molar_mass > 0.0;
      if (!has_stoichiometry) {
        continue;
      }
      let source_extent = source_pos_mass.w / max(source_term.coefficient * source_term.molar_mass, 1.0e-20);
      let partner_extent = partner_source_pos_mass.w / max(partner_term.coefficient * partner_term.molar_mass, 1.0e-20);
      // Identical flux cap as the apply kernel so every ledger agrees on the
      // consumed extent (divergence here mints phantom product mass).
      let extent_availability_mol = min(source_extent, partner_extent);
      let extent_flux_cap_mol = interface_flux_extent_cap_mol(
        source_pos_mass.w, source_row0.w, source_row0.z,
        source_term.coefficient, source_term.molar_mass, source_term.interface_flux,
        partner_source_pos_mass.w, partner_source_row0.w, partner_source_row0.z,
        partner_term.coefficient, partner_term.molar_mass, partner_term.interface_flux,
        params.dt_s
      );
      let extent_mol = min(extent_availability_mol, extent_flux_cap_mol);
      let source_consumed = min(source_pos_mass.w, extent_mol * source_term.coefficient * source_term.molar_mass);
      let partner_consumed = min(partner_source_pos_mass.w, extent_mol * partner_term.coefficient * partner_term.molar_mass);
      let consumed_mass = source_consumed + partner_consumed;
      let raw_product_mass = product_raw_mass_sum_for_extent(reaction_index, extent_mol);
      if (extent_mol <= 0.0 || consumed_mass <= 0.0 || raw_product_mass <= 0.0) {
        continue;
      }
      let mass_scale = consumed_mass / raw_product_mass;
      let product_side_scale = select(1.0, mass_scale, term_kind_id == 2.0);
      let sign = select(-1.0, 1.0, term_kind_id == 2.0);
      let term_moles = extent_mol * coefficient * product_side_scale;
      atom_residual_mol = atom_residual_mol + sign * term_moles * atoms_per_formula;
      charge_residual_mol = charge_residual_mol + sign * term_moles * charge;
      event_count = event_count + 1.0;
    }
  }

  let out_base = atom_term_index * 2u;
  atom_residuals[out_base] = vec4<f32>(f32(reaction_index), atomic_number_z, atom_residual_mol, charge_residual_mol);
  atom_residuals[out_base + 1u] = vec4<f32>(event_count, term_kind_id, source_term_index, status);
}
`;

export const sphReactionGasSpeciesSummaryWgsl = `
struct ReactionSummaryParams {
  particle_count: u32,
  reaction_count: u32,
  product_phase_count: u32,
  reactant_term_count: u32,
  product_term_count: u32,
  gas_product_count: u32,
  partial_count: u32,
  has_proposals: u32,
  _pad0: u32,
  // Interface-flux extent law substep duration (offset 36 in the shared
  // summary params packer); must match the apply kernel's dt_s.
  dt_s: f32,
  _pad2: u32,
  _pad3: u32,
};

struct ReactantTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  status: f32,
  // Interface mass flux [kg/m^2/s] at the reference temperature — the
  // transport prefactor for the interface-flux extent law (see the shared
  // helper); packed by the reaction-table builder in the term row pad lane.
  interface_flux: f32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> next_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> next_thermo: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> proposals: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> gas_species_summaries: array<vec4<f32>>;
@group(0) @binding(7) var<uniform> params: ReactionSummaryParams;

fn reaction_row1(reaction_index: u32) -> vec4<f32> {
  return reaction_records[reaction_index * 3u + 1u];
}

fn reaction_header_row0(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u];
}

fn reaction_header_row1(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u + 1u];
}

fn reactant_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u];
}

fn reactant_term_row2(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u + 2u];
}

fn product_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u];
}

fn product_term_row1(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 1u];
}

fn gas_product_row0(gas_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  let gas_base = product_base + params.product_term_count * 4u;
  return reaction_records[gas_base + gas_index * 2u];
}

fn gas_product_row1(gas_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  let gas_base = product_base + params.product_term_count * 4u;
  return reaction_records[gas_base + gas_index * 2u + 1u];
}

// Interface-flux extent cap [mol] for one reacting pair over one substep.
// A contact event may only convert as much matter as transport can deliver
// through the contact interface: extent_rate = A_contact * max_i(nu_i /
// (coef_i * M_i)) where nu_i is reactant i's interface mass flux [kg/m^2/s]
// at its current temperature and the max expresses that the mobile species'
// pathway governs (e.g. water vapor reaching a sodium surface). A_contact is
// the contact disc of the smaller rest-volume radius - the same contact
// geometry the pair-conduction law uses - so thermal and chemical transport
// see one consistent interface. nu scales as sqrt(T/T_ref) (effusion flux
// rho*vbar/4 with vbar ~ sqrt(T)); the vapor-carrier density's exponential
// Clausius-Clapeyron growth with T is NOT modelled - a conservative,
// documented frontier gap. When neither reactant carries a derivable flux
// (nu_i = 0: condensed-condensed, non-volatile) or dt is 0 (stale packer),
// the cap disables and the stoichiometric availability bound alone applies -
// the pre-flux-law behavior. Every module that computes a reaction extent
// (apply, summary partials, product inventory, product events, atom
// residual, gas species) MUST apply this identical cap or their ledgers
// disagree and phantom product mass appears.
const INTERFACE_FLUX_REFERENCE_TEMPERATURE_K: f32 = 293.15;

fn interface_flux_extent_cap_mol(
  self_mass_kg: f32,
  self_rest_density: f32,
  self_temperature_k: f32,
  self_coefficient: f32,
  self_molar_mass: f32,
  self_interface_flux: f32,
  partner_mass_kg: f32,
  partner_rest_density: f32,
  partner_temperature_k: f32,
  partner_coefficient: f32,
  partner_molar_mass: f32,
  partner_interface_flux: f32,
  dt_s: f32
) -> f32 {
  let no_cap = 3.0e38;
  if (dt_s <= 0.0) {
    return no_cap;
  }
  let self_rate = self_interface_flux
    * sqrt(max(self_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(self_coefficient * self_molar_mass, 1.0e-20);
  let partner_rate = partner_interface_flux
    * sqrt(max(partner_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(partner_coefficient * partner_molar_mass, 1.0e-20);
  let mobile_rate = max(self_rate, partner_rate);
  if (mobile_rate <= 0.0) {
    return no_cap;
  }
  let self_radius = pow(
    max(3.0 * self_mass_kg / (12.5663706 * max(self_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let partner_radius = pow(
    max(3.0 * partner_mass_kg / (12.5663706 * max(partner_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let contact_radius = min(self_radius, partner_radius);
  let contact_area = 3.14159265 * contact_radius * contact_radius;
  return mobile_rate * contact_area * dt_s;
}

fn reactant_term_for_material(reaction_index: u32, material_id: f32) -> ReactantTerm {
  let header0 = reaction_header_row0(reaction_index);
  let reactant_term_offset = u32(max(header0.y, 0.0));
  let reactant_term_count = u32(max(header0.z, 0.0));
  for (var local = 0u; local < reactant_term_count; local = local + 1u) {
    let term_index = reactant_term_offset + local;
    let term0 = reactant_term_row0(term_index);
    let term2 = reactant_term_row2(term_index);
    if (term0.y == material_id && term2.z == 1.0) {
      return ReactantTerm(term0.y, term0.z, term0.w, term2.z, term2.w);
    }
  }
  return ReactantTerm(0.0, 0.0, 0.0, 0.0, 0.0);
}

fn product_raw_mass_sum_for_extent(reaction_index: u32, extent_mol: f32) -> f32 {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  var sum = 0.0;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term0.z > 0.0 && term0.w > 0.0) {
      sum = sum + extent_mol * term0.z * term0.w;
    }
  }
  return sum;
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let gas_index = global_id.x;
  if (gas_index >= params.gas_product_count) {
    return;
  }
  let gas0 = gas_product_row0(gas_index);
  let gas1 = gas_product_row1(gas_index);
  let reaction_index = u32(max(gas0.x, 0.0));
  let material_id = gas0.z;
  let moles_per_extent = gas0.w;
  let molar_mass = gas1.x;
  let status = gas1.z;
  var mass_kg = 0.0;
  var moles = 0.0;
  var visible_mass_kg = 0.0;
  var event_count = 0.0;

  if (params.has_proposals != 0u && status == 1.0 && molar_mass > 0.0 && moles_per_extent > 0.0) {
    for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
      let proposal = proposals[particle_index];
      if (proposal.x < 0.0 || proposal.y < 0.0 || u32(proposal.y + 0.5) != reaction_index) {
        continue;
      }
      let partner_index = u32(proposal.x + 0.5);
      if (partner_index >= params.particle_count || particle_index >= partner_index) {
        continue;
      }
      let partner_proposal = proposals[partner_index];
      if (partner_proposal.x < 0.0 || u32(partner_proposal.x + 0.5) != particle_index || partner_proposal.y != proposal.y) {
        continue;
      }
      let source_pos_mass = source_state[particle_index * 2u];
      let partner_source_pos_mass = source_state[partner_index * 2u];
      let source_row0 = source_thermo[particle_index * 3u];
      let partner_source_row0 = source_thermo[partner_index * 3u];
      let source_term = reactant_term_for_material(reaction_index, source_row0.x);
      let partner_term = reactant_term_for_material(reaction_index, partner_source_row0.x);
      let has_stoichiometry = source_term.status == 1.0
        && partner_term.status == 1.0
        && source_term.coefficient > 0.0
        && partner_term.coefficient > 0.0
        && source_term.molar_mass > 0.0
        && partner_term.molar_mass > 0.0;
      if (!has_stoichiometry) {
        continue;
      }
      let source_extent = source_pos_mass.w / max(source_term.coefficient * source_term.molar_mass, 1.0e-20);
      let partner_extent = partner_source_pos_mass.w / max(partner_term.coefficient * partner_term.molar_mass, 1.0e-20);
      // Identical flux cap as the apply kernel so every ledger agrees on the
      // consumed extent (divergence here mints phantom product mass).
      let extent_availability_mol = min(source_extent, partner_extent);
      let extent_flux_cap_mol = interface_flux_extent_cap_mol(
        source_pos_mass.w, source_row0.w, source_row0.z,
        source_term.coefficient, source_term.molar_mass, source_term.interface_flux,
        partner_source_pos_mass.w, partner_source_row0.w, partner_source_row0.z,
        partner_term.coefficient, partner_term.molar_mass, partner_term.interface_flux,
        params.dt_s
      );
      let extent_mol = min(extent_availability_mol, extent_flux_cap_mol);
      let source_consumed = min(source_pos_mass.w, extent_mol * source_term.coefficient * source_term.molar_mass);
      let partner_consumed = min(partner_source_pos_mass.w, extent_mol * partner_term.coefficient * partner_term.molar_mass);
      let consumed_mass = source_consumed + partner_consumed;
      let raw_product_mass = product_raw_mass_sum_for_extent(reaction_index, extent_mol);
      if (extent_mol <= 0.0 || consumed_mass <= 0.0 || raw_product_mass <= 0.0) {
        continue;
      }
      let mass_scale = consumed_mass / raw_product_mass;
      let species_mass = extent_mol * moles_per_extent * molar_mass * mass_scale;
      let species_moles = species_mass / molar_mass;
      let next0 = next_thermo[particle_index * 3u];
      let next1 = next_thermo[partner_index * 3u];
      let next_mass0 = next_state[particle_index * 2u].w;
      let next_mass1 = next_state[partner_index * 2u].w;
      mass_kg = mass_kg + species_mass;
      moles = moles + species_moles;
      if (next0.x == material_id) {
        visible_mass_kg = visible_mass_kg + next_mass0;
      }
      if (next1.x == material_id) {
        visible_mass_kg = visible_mass_kg + next_mass1;
      }
      event_count = event_count + 1.0;
    }
  }

  let out_base = gas_index * 2u;
  gas_species_summaries[out_base] = vec4<f32>(material_id, mass_kg, moles, visible_mass_kg);
  gas_species_summaries[out_base + 1u] = vec4<f32>(max(mass_kg - visible_mass_kg, 0.0), event_count, f32(gas_index), status);
}
`;

export const sphRenderRowsWgsl = `
struct RenderRowsParams {
  particle_count: u32,
  render_domain_base_count: u32,
  render_domain_drop_count: u32,
  has_mechanics: u32,
  max_support_radius_m: f32,
  max_gas_radius_m: f32,
  material_bank_particle_size_row_count: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> render_rows: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: RenderRowsParams;
@group(0) @binding(4) var<storage, read> mls_mpm_mechanics: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> material_bank_particle_size_rows: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> particle_identity: array<u32>;

const RENDER_ROW_VEC4_STRIDE: u32 = 5u;
const MATERIAL_BANK_PARTICLE_SIZE_ROW_VEC4_STRIDE: u32 = 4u;
const MATERIAL_BANK_GPU_ROW_STATUS_READY: u32 = 1u;
const RENDER_ROW_MAX_PARTICLE_RADIUS_GROWTH_RATIO: f32 = 4.0;
const RENDER_ROW_MAX_VOLUME_RATIO_J: f32 = 64.0;

fn radius_from_volume_m(volume_m3: f32) -> f32 {
  if (volume_m3 <= 0.0) {
    return 0.0;
  }
  return pow((3.0 * volume_m3) / (4.0 * 3.141592653589793), 1.0 / 3.0);
}

fn volume_from_radius_m(radius_m: f32) -> f32 {
  if (radius_m <= 0.0) {
    return 0.0;
  }
  return (4.0 * 3.141592653589793 * radius_m * radius_m * radius_m) / 3.0;
}

fn material_bank_rest_volume_for_role(role_id: f32) -> f32 {
  if (role_id <= 0.0 || params.material_bank_particle_size_row_count == 0u) {
    return 0.0;
  }
  var row_index = 0u;
  loop {
    if (row_index >= params.material_bank_particle_size_row_count) {
      break;
    }
    let base = row_index * MATERIAL_BANK_PARTICLE_SIZE_ROW_VEC4_STRIDE;
    let row0 = material_bank_particle_size_rows[base];
    let row1 = material_bank_particle_size_rows[base + 1u];
    let row3 = material_bank_particle_size_rows[base + 3u];
    let row_status = u32(row3.x + 0.5);
    if (abs(row0.x - role_id) < 0.5 && row_status == MATERIAL_BANK_GPU_ROW_STATUS_READY) {
      if (row1.w > 0.0) {
        return row1.w;
      }
      if (row1.z > 0.0) {
        return volume_from_radius_m(row1.z);
      }
    }
    row_index = row_index + 1u;
  }
  return 0.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let pos_mass = sph_state[particle_index * 2u];
  let thermo0 = sph_thermo[particle_index * 3u];
  let thermo1 = sph_thermo[particle_index * 3u + 1u];
  let thermo2 = sph_thermo[particle_index * 3u + 2u];
  var render_domain_id: f32 = 0.0;
  if (params.render_domain_base_count > 0u && particle_index < params.render_domain_base_count) {
    render_domain_id = 1.0;
  }
  if (
    render_domain_id == 0.0
    && params.render_domain_drop_count > 0u
    && particle_index >= params.render_domain_base_count
    && particle_index < params.render_domain_base_count + params.render_domain_drop_count
  ) {
    render_domain_id = 2.0;
  }
  // Stable body identity is independent of mutable thermodynamic/mechanics
  // state. Positive explicit ids override the legacy contiguous base/drop
  // ranges; zero preserves that fallback and is the required spare/product
  // slot identity.
  let explicit_render_domain_id = particle_identity[particle_index];
  if (explicit_render_domain_id > 0u) {
    render_domain_id = f32(explicit_render_domain_id);
  }
  var volume_ratio_j = 1.0;
  var rest_volume_m3 = 0.0;
  var pressure_pa = 0.0;
  let visual_particle_radius_m = thermo2.w;
  if (thermo0.w > 0.0 && pos_mass.w > 0.0) {
    rest_volume_m3 = pos_mass.w / thermo0.w;
  }
  if (visual_particle_radius_m > 0.0) {
    rest_volume_m3 = volume_from_radius_m(visual_particle_radius_m);
  }
  let bank_rest_volume_m3 = material_bank_rest_volume_for_role(render_domain_id);
  if (bank_rest_volume_m3 > 0.0 && visual_particle_radius_m <= 0.0) {
    rest_volume_m3 = bank_rest_volume_m3;
  }
  if (params.has_mechanics != 0u) {
    let mechanics4 = mls_mpm_mechanics[particle_index * 8u + 4u];
    let mechanics7 = mls_mpm_mechanics[particle_index * 8u + 7u];
    volume_ratio_j = max(mechanics4.z, 1.0e-9);
    if (mechanics4.w > 0.0 && visual_particle_radius_m <= 0.0) {
      rest_volume_m3 = mechanics4.w;
    }
    pressure_pa = max(mechanics7.x, 0.0);
  }
  let raw_volume_ratio_j = max(volume_ratio_j, 1.0e-9);
  let raw_current_volume_m3 = max(rest_volume_m3 * raw_volume_ratio_j, 0.0);
  let rest_particle_radius_m = radius_from_volume_m(rest_volume_m3);
  let raw_particle_radius_m = radius_from_volume_m(raw_current_volume_m3);
  var current_volume_m3 = raw_current_volume_m3;
  var particle_radius_m = raw_particle_radius_m;
  var effective_volume_ratio_j = raw_volume_ratio_j;
  if (
    rest_particle_radius_m > 0.0
    && raw_particle_radius_m > rest_particle_radius_m * RENDER_ROW_MAX_PARTICLE_RADIUS_GROWTH_RATIO
  ) {
    particle_radius_m = rest_particle_radius_m * RENDER_ROW_MAX_PARTICLE_RADIUS_GROWTH_RATIO;
    current_volume_m3 = rest_volume_m3 * RENDER_ROW_MAX_VOLUME_RATIO_J;
    effective_volume_ratio_j = RENDER_ROW_MAX_VOLUME_RATIO_J;
  }
  if (params.max_support_radius_m > 0.0 && particle_radius_m > params.max_support_radius_m) {
    particle_radius_m = params.max_support_radius_m;
    current_volume_m3 = volume_from_radius_m(params.max_support_radius_m);
    if (rest_volume_m3 > 0.0) {
      effective_volume_ratio_j = max(current_volume_m3 / rest_volume_m3, 1.0e-9);
    }
  }
  if (
    u32(thermo0.y + 0.5) == 3u
    && params.max_gas_radius_m > 0.0
    && particle_radius_m > params.max_gas_radius_m
  ) {
    particle_radius_m = params.max_gas_radius_m;
    current_volume_m3 = volume_from_radius_m(params.max_gas_radius_m);
    if (rest_volume_m3 > 0.0) {
      effective_volume_ratio_j = max(current_volume_m3 / rest_volume_m3, 1.0e-9);
    }
  }
  let render_row_base = particle_index * RENDER_ROW_VEC4_STRIDE;
  // Spare product slots (zero mass) must never match a render surface or
  // decode into a sphere instance: mask their material id to 0.
  let render_material_id = select(thermo0.x, 0.0, pos_mass.w <= 0.0);
  render_rows[render_row_base] = pos_mass;
  render_rows[render_row_base + 1u] = vec4<f32>(render_material_id, thermo0.y, thermo0.z, thermo2.z);
  render_rows[render_row_base + 2u] = vec4<f32>(thermo0.w, thermo1.z, thermo2.y, render_domain_id);
  render_rows[render_row_base + 3u] = vec4<f32>(current_volume_m3, particle_radius_m, effective_volume_ratio_j, pressure_pa);
  // Tri-phase split (thermo row1 = solid/liquid/gas/plasma fractions): the
  // render field weights each particle's contribution per phase surface so
  // transition-boundary particles morph between surfaces instead of popping.
  // Pads row4.yzw carry the particle velocity so the render-field kernel can
  // measure per-cell velocity dispersion (splash-shard smear correction).
  let render_vel_u = sph_state[particle_index * 2u + 1u];
  render_rows[render_row_base + 4u] = vec4<f32>(thermo1.x, render_vel_u.x, render_vel_u.y, render_vel_u.z);
}
`;

export const sphRenderFieldWgsl = `
${sphDispersedMediumOpticsWgsl}
struct RenderFieldParams {
	  particle_count: u32,
	  surface_count: u32,
	  total_field_cells: u32,
	  product_event_count: u32,
  field_padding: f32,
  ref_edge_m: f32,
  // Render refresh interval (s): a cell whose particles diverge at sigma_v
  // smears its mass over sigma_v*dt between refreshes; the metaball
  // correction below folds that spread into the sample distance.
  render_smear_dt_s: f32,
  dispersed_medium_enabled: u32,
};

struct RenderProductHistoryGateParams {
  gate_required: u32,
  expected_magic: u32,
  expected_version: u32,
  expected_ready_status: u32,
  expected_generation: u32,
  expected_seal: u32,
  expected_row_capacity: u32,
  expected_row_stride_vec4: u32,
};

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
	@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> render_field_cells: array<vec4<f32>>;
	@group(0) @binding(3) var<uniform> params: RenderFieldParams;
	@group(0) @binding(4) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> product_history_control: array<u32>;
@group(0) @binding(6) var<uniform> product_history_gate: RenderProductHistoryGateParams;
@group(0) @binding(7) var<storage, read> dispersed_medium_optics_rows: array<SphDispersedMediumOptics>;

const RENDER_FIELD_RENDER_ROW_VEC4_STRIDE: u32 = 5u;

fn render_product_history_ready() -> bool {
  if (product_history_gate.gate_required == 0u) {
    return true;
  }
  return arrayLength(&product_history_control) >= 8u
    && product_history_control[0u] == product_history_gate.expected_magic
    && product_history_control[1u] == product_history_gate.expected_version
    && product_history_control[2u] == product_history_gate.expected_ready_status
    && product_history_control[3u] <= product_history_control[4u]
    && product_history_control[4u] == product_history_gate.expected_row_capacity
    && product_history_control[5u] == product_history_gate.expected_row_stride_vec4
    && product_history_control[6u] == product_history_gate.expected_generation
    && product_history_control[7u] == product_history_gate.expected_seal;
}

fn render_product_event_count() -> u32 {
  if (product_history_gate.gate_required != 0u) {
    return product_history_control[3u];
  }
  return params.product_event_count;
}

fn render_row0(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_FIELD_RENDER_ROW_VEC4_STRIDE];
}

fn render_row1(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_FIELD_RENDER_ROW_VEC4_STRIDE + 1u];
}

fn render_row2(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_FIELD_RENDER_ROW_VEC4_STRIDE + 2u];
}

fn render_row3(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_FIELD_RENDER_ROW_VEC4_STRIDE + 3u];
}

fn render_row4(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_FIELD_RENDER_ROW_VEC4_STRIDE + 4u];
}

// Phase weight of a particle for a phase-keyed surface: solid/liquid/gas
// surfaces take the particle's phase FRACTION (transition-boundary particles
// contribute partially to both sides, which keeps apparent volume persistent
// and stops surfaces blinking as hard phase flags flip); other phase ids fall
// back to the exact phase-id match.
fn render_phase_weight(surface_phase_id: f32, row_phase_id: f32, gas_fraction: f32, solid_fraction: f32) -> f32 {
  let gas = clamp(gas_fraction, 0.0, 1.0);
  let solid = clamp(solid_fraction, 0.0, 1.0);
  let liquid = clamp(1.0 - gas - solid, 0.0, 1.0);
  if (surface_phase_id == 1.0) { return solid; }
  if (surface_phase_id == 2.0) { return liquid; }
  if (surface_phase_id == 3.0) { return gas; }
  return select(0.0, 1.0, row_phase_id == surface_phase_id);
}

fn surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

	fn surface_row2(surface_index: u32) -> vec4<f32> {
	  return render_surfaces[surface_index * 4u + 2u];
	}

	fn surface_row3(surface_index: u32) -> vec4<f32> {
	  return render_surfaces[surface_index * 4u + 3u];
	}

	fn product_event_row0(event_index: u32) -> vec4<f32> {
	  return product_events[event_index * 8u];
	}

	fn product_event_row1(event_index: u32) -> vec4<f32> {
	  return product_events[event_index * 8u + 1u];
	}

	fn product_event_row2(event_index: u32) -> vec4<f32> {
	  return product_events[event_index * 8u + 2u];
	}

	fn product_event_row3(event_index: u32) -> vec4<f32> {
	  return product_events[event_index * 8u + 3u];
	}

	fn product_event_row4(event_index: u32) -> vec4<f32> {
	  return product_events[event_index * 8u + 4u];
	}

fn smooth_palette_weight(ratio: f32) -> f32 {
  let t = clamp(ratio, 0.0, 1.0);
  return 1.0 - t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

fn phase_partitioned_metaball_strength(
  full_strength: f32,
  phase_weight: f32,
  isolation: f32,
  subtract: f32
) -> f32 {
  let fraction = clamp(phase_weight, 0.0, 1.0);
  let volume_scale_squared = pow(fraction * fraction, 0.3333333333333333);
  let zero_radius_strength = max(isolation + subtract, 0.0) * 0.000001;
  return full_strength * volume_scale_squared
    + zero_radius_strength * (1.0 - volume_scale_squared);
}

fn metaball_support_norm(strength: f32, subtract: f32) -> f32 {
  return sqrt(max(strength / max(subtract, 1.0e-12) - 0.000001, 0.0));
}

const RENDER_FIELD_F32_FINITE_MAX: f32 = 3.402823466e+38;
const RENDER_FIELD_F32_MIN_NORMAL: f32 = 1.175494351e-38;

fn render_field_saturating_nonnegative_add(a: f32, b: f32) -> f32 {
  if (!(a > 0.0)) { return max(0.0, b); }
  if (!(b > 0.0)) { return max(0.0, a); }
  if (a >= RENDER_FIELD_F32_FINITE_MAX - b) {
    return RENDER_FIELD_F32_FINITE_MAX;
  }
  let sum = a + b;
  return select(0.0, sum, sum >= RENDER_FIELD_F32_MIN_NORMAL);
}

fn render_field_saturating_nonnegative_product(a: f32, b: f32) -> f32 {
  if (!(a > 0.0) || !(b > 0.0)) { return 0.0; }
  let product = a * b;
  if (!(product <= RENDER_FIELD_F32_FINITE_MAX)) {
    return RENDER_FIELD_F32_FINITE_MAX;
  }
  if (product < RENDER_FIELD_F32_MIN_NORMAL) { return 0.0; }
  return product;
}

struct RenderFieldPositiveF32Scale {
  mantissa: f32,
  exponent: i32,
  nonzero: u32,
  _pad: u32,
};

fn render_field_decompose_f32_magnitude(
  value: f32
) -> RenderFieldPositiveF32Scale {
  let bits = bitcast<u32>(value) & 0x7fffffffu;
  let raw_exponent = (bits >> 23u) & 0xffu;
  let fraction = bits & 0x007fffffu;
  if (bits == 0u || raw_exponent == 0xffu) {
    return RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u);
  }
  if (raw_exponent == 0u) {
    let highest = 31u - countLeadingZeros(fraction);
    let shift = 23u - highest;
    let normalized = fraction << shift;
    return RenderFieldPositiveF32Scale(
      bitcast<f32>(0x3f800000u | (normalized & 0x007fffffu)),
      i32(highest) - 149,
      1u,
      0u
    );
  }
  return RenderFieldPositiveF32Scale(
    bitcast<f32>(0x3f800000u | fraction),
    i32(raw_exponent) - 127,
    1u,
    0u
  );
}

fn render_field_balanced_optical_product(
  cross_section_m2: f32,
  cell_weight: f32,
  inverse_cell_edge_per_m: f32
) -> f32 {
  let cross_section =
    render_field_decompose_f32_magnitude(cross_section_m2);
  let weight = render_field_decompose_f32_magnitude(cell_weight);
  let inverse_edge =
    render_field_decompose_f32_magnitude(inverse_cell_edge_per_m);
  if (
    cross_section.nonzero == 0u
    || weight.nonzero == 0u
    || inverse_edge.nonzero == 0u
  ) {
    return 0.0;
  }
  var mantissa = (
    (cross_section.mantissa * weight.mantissa)
    * inverse_edge.mantissa
  ) * inverse_edge.mantissa;
  var exponent = cross_section.exponent
    + weight.exponent
    + 2 * inverse_edge.exponent;
  for (
    var iteration = 0u;
    iteration < 4u && mantissa >= 2.0;
    iteration = iteration + 1u
  ) {
    mantissa = mantissa * 0.5;
    exponent = exponent + 1;
  }
  if (exponent < -126) { return 0.0; }
  if (exponent > 127) { return RENDER_FIELD_F32_FINITE_MAX; }
  return bitcast<f32>(
    (u32(exponent + 127) << 23u)
    | (bitcast<u32>(mantissa) & 0x007fffffu)
  );
}

fn render_field_balanced_signed_optical_product(
  signed_cross_section_m2: f32,
  cell_weight: f32,
  inverse_cell_edge_per_m: f32
) -> f32 {
  let magnitude = render_field_balanced_optical_product(
    signed_cross_section_m2,
    cell_weight,
    inverse_cell_edge_per_m
  );
  if (magnitude == 0.0) { return 0.0; }
  let sign_bit = bitcast<u32>(signed_cross_section_m2) & 0x80000000u;
  return bitcast<f32>(bitcast<u32>(magnitude) | sign_bit);
}

struct RenderFieldWeightedTemperatureAccumulator {
  weight: RenderFieldPositiveF32Scale,
  weighted_temperature: RenderFieldPositiveF32Scale,
};

struct RenderFieldSignedF32ScaleAccumulator {
  positive: RenderFieldPositiveF32Scale,
  negative: RenderFieldPositiveF32Scale,
};

fn render_field_normalized_mantissa_at_exponent(
  mantissa: f32,
  exponent: i32
) -> f32 {
  if (exponent < -126) { return 0.0; }
  return bitcast<f32>(
    (u32(exponent + 127) << 23u)
    | (bitcast<u32>(mantissa) & 0x007fffffu)
  );
}

fn render_field_add_positive_scales(
  left: RenderFieldPositiveF32Scale,
  right: RenderFieldPositiveF32Scale
) -> RenderFieldPositiveF32Scale {
  if (left.nonzero == 0u) { return right; }
  if (right.nonzero == 0u) { return left; }
  var base_exponent: i32;
  var mantissa: f32;
  if (right.exponent >= left.exponent) {
    let scaled_left = render_field_normalized_mantissa_at_exponent(
      left.mantissa,
      left.exponent - right.exponent
    );
    base_exponent = right.exponent;
    mantissa = right.mantissa + scaled_left;
  } else {
    let scaled_right = render_field_normalized_mantissa_at_exponent(
      right.mantissa,
      right.exponent - left.exponent
    );
    base_exponent = left.exponent;
    mantissa = left.mantissa + scaled_right;
  }
  if (mantissa >= 2.0) {
    mantissa = mantissa * 0.5;
    base_exponent = base_exponent + 1;
  }
  return RenderFieldPositiveF32Scale(
    mantissa,
    base_exponent,
    1u,
    0u
  );
}

fn render_field_compare_positive_scales(
  left: RenderFieldPositiveF32Scale,
  right: RenderFieldPositiveF32Scale
) -> i32 {
  if (left.nonzero == 0u) {
    return select(0, -1, right.nonzero != 0u);
  }
  if (right.nonzero == 0u) { return 1; }
  if (left.exponent != right.exponent) {
    return select(-1, 1, left.exponent > right.exponent);
  }
  if (left.mantissa == right.mantissa) { return 0; }
  return select(-1, 1, left.mantissa > right.mantissa);
}

fn render_field_subtract_positive_scales(
  larger: RenderFieldPositiveF32Scale,
  smaller: RenderFieldPositiveF32Scale
) -> RenderFieldPositiveF32Scale {
  if (larger.nonzero == 0u) {
    return RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u);
  }
  if (smaller.nonzero == 0u) { return larger; }
  let scaled_smaller = render_field_normalized_mantissa_at_exponent(
    smaller.mantissa,
    smaller.exponent - larger.exponent
  );
  let residual = larger.mantissa - scaled_smaller;
  let normalized_residual = render_field_decompose_f32_magnitude(residual);
  if (normalized_residual.nonzero == 0u) {
    return RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u);
  }
  return RenderFieldPositiveF32Scale(
    normalized_residual.mantissa,
    larger.exponent + normalized_residual.exponent,
    1u,
    0u
  );
}

fn render_field_positive_scale_value(
  scale: RenderFieldPositiveF32Scale
) -> f32 {
  if (scale.nonzero == 0u || scale.exponent < -126) { return 0.0; }
  if (scale.exponent > 127) { return RENDER_FIELD_F32_FINITE_MAX; }
  return bitcast<f32>(
    (u32(scale.exponent + 127) << 23u)
    | (bitcast<u32>(scale.mantissa) & 0x007fffffu)
  );
}

fn render_field_accumulate_signed_scale(
  state: RenderFieldSignedF32ScaleAccumulator,
  sample: f32
) -> RenderFieldSignedF32ScaleAccumulator {
  if (
    sample == 0.0
    || !(sample == sample)
    || abs(sample) > RENDER_FIELD_F32_FINITE_MAX
  ) {
    return state;
  }
  let sample_scale = render_field_decompose_f32_magnitude(sample);
  if (sample_scale.nonzero == 0u) { return state; }
  if ((bitcast<u32>(sample) & 0x80000000u) != 0u) {
    return RenderFieldSignedF32ScaleAccumulator(
      state.positive,
      render_field_add_positive_scales(state.negative, sample_scale)
    );
  }
  return RenderFieldSignedF32ScaleAccumulator(
    render_field_add_positive_scales(state.positive, sample_scale),
    state.negative
  );
}

fn render_field_signed_scale_sum(
  state: RenderFieldSignedF32ScaleAccumulator
) -> f32 {
  let comparison = render_field_compare_positive_scales(
    state.positive,
    state.negative
  );
  if (comparison == 0) { return 0.0; }
  let positive = comparison > 0;
  var larger = state.negative;
  var smaller = state.positive;
  if (positive) {
    larger = state.positive;
    smaller = state.negative;
  }
  let magnitude = render_field_positive_scale_value(
    render_field_subtract_positive_scales(larger, smaller)
  );
  return select(-magnitude, magnitude, positive);
}

fn render_field_multiply_positive_scales(
  left: RenderFieldPositiveF32Scale,
  right: RenderFieldPositiveF32Scale
) -> RenderFieldPositiveF32Scale {
  if (left.nonzero == 0u || right.nonzero == 0u) {
    return RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u);
  }
  var mantissa = left.mantissa * right.mantissa;
  var exponent = left.exponent + right.exponent;
  if (mantissa >= 2.0) {
    mantissa = mantissa * 0.5;
    exponent = exponent + 1;
  }
  return RenderFieldPositiveF32Scale(mantissa, exponent, 1u, 0u);
}

fn render_field_divide_positive_scales(
  numerator: RenderFieldPositiveF32Scale,
  denominator: RenderFieldPositiveF32Scale
) -> f32 {
  if (numerator.nonzero == 0u || denominator.nonzero == 0u) {
    return 0.0;
  }
  var mantissa = numerator.mantissa / denominator.mantissa;
  var exponent = numerator.exponent - denominator.exponent;
  if (mantissa < 1.0) {
    mantissa = mantissa * 2.0;
    exponent = exponent - 1;
  } else if (mantissa >= 2.0) {
    mantissa = mantissa * 0.5;
    exponent = exponent + 1;
  }
  if (exponent < -126) { return 0.0; }
  if (exponent > 127) { return RENDER_FIELD_F32_FINITE_MAX; }
  return bitcast<f32>(
    (u32(exponent + 127) << 23u)
    | (bitcast<u32>(mantissa) & 0x007fffffu)
  );
}

// Accumulate numerator (temperature * extinction) and denominator
// independently as normalized mantissa/exponent scales. This retains both
// unequal high-dynamic-range weights and tiny weights whose large temperature
// can still make a representable contribution.
fn render_field_accumulate_weighted_temperature(
  state: RenderFieldWeightedTemperatureAccumulator,
  sample: f32,
  sample_weight: f32
) -> RenderFieldWeightedTemperatureAccumulator {
  if (
    !(sample_weight > 0.0)
    || !(sample == sample)
    || abs(sample) > RENDER_FIELD_F32_FINITE_MAX
  ) {
    return state;
  }
  let sample_scale = render_field_decompose_f32_magnitude(sample_weight);
  if (sample_scale.nonzero == 0u) { return state; }
  let next_weight = render_field_add_positive_scales(
    state.weight,
    sample_scale
  );
  let finite_sample = clamp(sample, 0.0, RENDER_FIELD_F32_FINITE_MAX);
  let temperature_scale = render_field_decompose_f32_magnitude(finite_sample);
  if (temperature_scale.nonzero == 0u) {
    return RenderFieldWeightedTemperatureAccumulator(
      next_weight,
      state.weighted_temperature
    );
  }
  return RenderFieldWeightedTemperatureAccumulator(
    next_weight,
    render_field_add_positive_scales(
      state.weighted_temperature,
      render_field_multiply_positive_scales(
        sample_scale,
        temperature_scale
      )
    )
  );
}

fn render_field_cic_axis_weight(
  cell_index: u32,
  particle_coordinate: f32,
  resolution: u32
) -> f32 {
  let particle_cell = clamp(particle_coordinate, 0.0, 1.0) * f32(resolution);
  var weight = max(0.0, 1.0 - abs(f32(cell_index) - particle_cell));
  if (cell_index == 0u) {
    weight = weight + max(0.0, 1.0 - abs(-1.0 - particle_cell));
  }
  if (cell_index + 1u == resolution) {
    weight = weight + max(0.0, 1.0 - abs(f32(resolution) - particle_cell));
  }
  return min(1.0, weight);
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let cell_index = global_id.x;
  let surface_index = global_id.y;
  if (surface_index >= params.surface_count) {
    return;
  }

  let s0 = surface_row0(surface_index);
  let s1 = surface_row1(surface_index);
  let s2 = surface_row2(surface_index);
  let s3 = surface_row3(surface_index);
  let field_offset = u32(s0.z);
  let field_cell_count = u32(s0.w);
  if (cell_index >= field_cell_count) {
    return;
  }
  let out_index = field_offset + cell_index;
  if (out_index >= params.total_field_cells) {
    return;
  }
  // Product history and particle rows form one visible step. A pending,
  // failed, forged, or mismatched history view invalidates the whole step:
  // zero both rows explicitly so a caller-owned pooled output cannot retain a
  // stale frame, and do so before reading either source family.
  if (!render_product_history_ready()) {
    render_field_cells[out_index * 2u] = vec4<f32>(0.0);
    render_field_cells[out_index * 2u + 1u] = vec4<f32>(0.0);
    return;
  }
  let authenticated_product_event_count = render_product_event_count();

  let resolution = max(u32(s1.x), 1u);
  let xy_count = resolution * resolution;
  let z = cell_index / xy_count;
  let rem = cell_index - z * xy_count;
  let y = rem / resolution;
  let x = rem - y * resolution;
  let inv_resolution = 1.0 / f32(resolution);
  let cell = vec3<f32>(
    f32(x) * inv_resolution,
    f32(y) * inv_resolution,
    f32(z) * inv_resolution
  );

  let material_id = s0.x;
  let phase_id = s0.y;
  let render_domain_id = max(s3.x, 0.0);
  let subtract = max(s1.z, 1.0e-12);
  let strength = s1.w;
  let support_norm = sqrt(abs(strength) / subtract);
  // Render-field ABI v1 uses negative surface row2.x as the mode sentinel for
  // retained per-particle radius. Positive values keep the legacy radiusNorm
  // behavior inside v1; v0 consumers must reject the v1 schema. The
  // surface-wide strength remains the product-event fallback.
  let particle_radius_scale = select(0.0, -s2.x, s2.x < 0.0);
  let color = vec3<f32>(s2.y, s2.z, s2.w);
  let span = 1.0 - 2.0 * params.field_padding;
  let ref_edge = max(params.ref_edge_m, 1.0e-12);
  let particle_radius_norm_scale = particle_radius_scale * span / ref_edge;
  // Conservative sparse voxel proxy for an under-resolved physical radius.
  // sqrt(3/(4N^2) + kernel epsilon) is the tight interior 3-D point-sampling
  // bound. It prevents an all-negative field without claiming exact geometry.
  let particle_radius_floor_norm = select(
    0.0,
    sqrt(0.75 * inv_resolution * inv_resolution + 0.000001),
    particle_radius_scale > 0.0
  );
  var density = 0.0;
  var palette = vec3<f32>(0.0, 0.0, 0.0);
  // Density-weighted particle temperature for per-fragment emission. Product
  // event row4.x is not yet closure-resolved from product_u for every route,
  // so treating it as authoritative here could invent visible heat.
  var temperature_weighted = 0.0;
  var temperature_weight = 0.0;
  // Positive optical-state surfaces become exclusive collective-medium
  // routes whenever the authenticated sidecar is enabled. No ready match
  // means an empty surface, never a fallback copy of carrier geometry.
  let dispersed_surface_active = params.dispersed_medium_enabled != 0u
    && s3.y > 0.0;
  var dispersed_scattering_optical_depth = 0.0;
  var dispersed_absorption_optical_depth = 0.0;
  var dispersed_scattering_asymmetry = RenderFieldSignedF32ScaleAccumulator(
    RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u),
    RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u)
  );
  var dispersed_temperature = RenderFieldWeightedTemperatureAccumulator(
    RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u),
    RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u)
  );
  // Velocity moments (weights = the same positive metaball values) for the
  // splash-shard smear correction: cell dispersion sigma_v^2 = E|v|^2-|Ev|^2
  // is zero for a coherently moving or single-particle cell, so only cells
  // bridging DIVERGING droplets are corrected.
  var velocity_weighted = vec3<f32>(0.0, 0.0, 0.0);
  var velocity_sq_weighted = 0.0;
	  for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
    let row0 = render_row0(particle_index);
    let row1 = render_row1(particle_index);
    let row2 = render_row2(particle_index);
    let row3 = render_row3(particle_index);
    if (params.dispersed_medium_enabled != 0u) {
      let dispersed = dispersed_medium_optics_rows[particle_index];
      if (
        sph_dispersed_medium_optics_row_is_ready(dispersed)
        && dispersed.optical_state_id > 0.0
        && dispersed.optical_state_id == s3.y
      ) {
        // optical_state_id is the exact collective-medium surface route.
        // The constituent material/phase intentionally remain independent of
        // both this surface and the aligned carrier particle.
        let dispersed_particle = vec3<f32>(
          clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
          clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
          clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
        );
        let cell_weight = render_field_cic_axis_weight(x, dispersed_particle.x, resolution)
          * render_field_cic_axis_weight(y, dispersed_particle.y, resolution)
          * render_field_cic_axis_weight(z, dispersed_particle.z, resolution);
        if (cell_weight > 0.0) {
          // Deposit each extensive cross-section with a conservative
          // particle-to-grid cloud-in-cell kernel. Dividing by the physical
          // cell face area yields dimensionless optical depth through that
          // cell; the marching-cubes threshold is therefore tau = 1 rather
          // than a material-specific opacity knob.
          // Evaluate sigma * weight / edge^2 as two ordered inverse-edge
          // products. Squaring edge can overflow for a very large domain and
          // squaring its inverse can underflow before sigma rescales it; this
          // ordering keeps every representable final optical depth finite.
          let inverse_cell_edge_per_m = min(
            RENDER_FIELD_F32_FINITE_MAX,
            (span * f32(resolution)) / ref_edge
          );
          let scattering_optical_depth = render_field_balanced_optical_product(
            dispersed.scattering_cross_section_m2,
            cell_weight,
            inverse_cell_edge_per_m
          );
          let absorption_optical_depth = render_field_balanced_optical_product(
            dispersed.absorption_cross_section_m2,
            cell_weight,
            inverse_cell_edge_per_m
          );
          let asymmetry_optical_depth = render_field_balanced_signed_optical_product(
            dispersed.scattering_asymmetry_cross_section_m2,
            cell_weight,
            inverse_cell_edge_per_m
          );
          dispersed_scattering_optical_depth = render_field_saturating_nonnegative_add(
            dispersed_scattering_optical_depth,
            scattering_optical_depth
          );
          dispersed_absorption_optical_depth = render_field_saturating_nonnegative_add(
            dispersed_absorption_optical_depth,
            absorption_optical_depth
          );
          dispersed_scattering_asymmetry = render_field_accumulate_signed_scale(
            dispersed_scattering_asymmetry,
            asymmetry_optical_depth
          );
          // Keep scattering and absorption as separate extensive weights so
          // max+max does not clip before the balanced temperature accumulator.
          dispersed_temperature = render_field_accumulate_weighted_temperature(
            dispersed_temperature,
            row1.z,
            scattering_optical_depth
          );
          dispersed_temperature = render_field_accumulate_weighted_temperature(
            dispersed_temperature,
            row1.z,
            absorption_optical_depth
          );
        }
      }
    }
    // A positive optical-state surface is an exclusive collective-medium
    // route. Once the authenticated sidecar path has been considered, do not
    // also execute legacy carrier metaball/temperature/velocity math that the
    // CPU reference deliberately bypasses for this surface.
    if (dispersed_surface_active) {
      continue;
    }
    if (
      row1.x != material_id
      || (render_domain_id > 0.0 && row2.w != render_domain_id)
    ) {
      continue;
    }
    let row4 = render_row4(particle_index);
    let phase_weight = render_phase_weight(phase_id, row1.y, row2.y, row4.x);
    if (phase_weight <= 0.0) {
      continue;
    }
    let particle = vec3<f32>(
      clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
      clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
      clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
    );
    let delta = cell - particle;
    let dist2 = dot(delta, delta);
    let particle_radius_norm = select(
      0.0,
      max(row3.y * particle_radius_norm_scale, particle_radius_floor_norm),
      particle_radius_scale > 0.0 && row3.y > 0.0
    );
    let full_particle_strength = select(
      strength,
      (s1.y + subtract) * particle_radius_norm * particle_radius_norm,
      particle_radius_norm > 0.0
    );
    let particle_strength = phase_partitioned_metaball_strength(
      full_particle_strength,
      phase_weight,
      s1.y,
      subtract
    );
    let particle_support_norm = metaball_support_norm(particle_strength, subtract);
    let value = particle_strength / (0.000001 + dist2) - subtract;
    if (value > 0.0) {
      density = density + value;
      let ratio = sqrt(dist2) / max(particle_support_norm, 1.0e-6);
      palette = palette + color * smooth_palette_weight(ratio);
      temperature_weighted = temperature_weighted + row1.z * value;
      temperature_weight = temperature_weight + value;
      let particle_velocity = row4.yzw;
      velocity_weighted = velocity_weighted + particle_velocity * value;
      velocity_sq_weighted = velocity_sq_weighted + dot(particle_velocity, particle_velocity) * value;
    }
  }

  let dispersed_scattering_asymmetry_optical_depth = clamp(
    render_field_signed_scale_sum(dispersed_scattering_asymmetry),
    -dispersed_scattering_optical_depth,
    dispersed_scattering_optical_depth
  );

  if (dispersed_surface_active) {
    let dispersed_total_optical_depth = render_field_saturating_nonnegative_add(
      dispersed_scattering_optical_depth,
      dispersed_absorption_optical_depth
    );
    density = render_field_saturating_nonnegative_product(
      max(s1.y, 0.0),
      dispersed_total_optical_depth
    );
    palette = select(vec3<f32>(0.0), color, dispersed_total_optical_depth > 0.0);
    temperature_weighted = 0.0;
    temperature_weight = f32(dispersed_temperature.weight.nonzero);
  }

  // Splash-shard smear correction: mass in a dispersing cell spreads over
  // L = sigma_v * render_smear_dt between refreshes, so each contribution is
  // re-sampled at the smeared distance (dist2 + L^2, in normalized field
  // units). Coherent cells (sigma_v ~ 0) skip the pass entirely, keeping
  // solids, resting pools, and single-particle cohorts bit-exact; the guard
  // threshold is fp-noise scale (L < 1e-5 of the field edge), not a tunable.
  if (!dispersed_surface_active && temperature_weight > 0.0 && params.render_smear_dt_s > 0.0) {
    let mean_velocity = velocity_weighted / temperature_weight;
    let dispersion_sq_ms = max(0.0, velocity_sq_weighted / temperature_weight - dot(mean_velocity, mean_velocity));
    let smear_norm = sqrt(dispersion_sq_ms) * params.render_smear_dt_s * span / ref_edge;
    let smear_sq = smear_norm * smear_norm;
    if (smear_sq > 1.0e-10) {
      var corrected_density = 0.0;
      var corrected_palette = vec3<f32>(0.0, 0.0, 0.0);
      var corrected_temperature_weighted = 0.0;
      var corrected_temperature_weight = 0.0;
	      for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
        let row0 = render_row0(particle_index);
        let row1 = render_row1(particle_index);
        let row2 = render_row2(particle_index);
        let row3 = render_row3(particle_index);
        if (
          row1.x != material_id
          || (render_domain_id > 0.0 && row2.w != render_domain_id)
        ) {
          continue;
        }
        let phase_weight = render_phase_weight(phase_id, row1.y, row2.y, render_row4(particle_index).x);
        if (phase_weight <= 0.0) {
          continue;
        }
        let particle = vec3<f32>(
          clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
          clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
          clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
        );
        let delta = cell - particle;
        let dist2 = dot(delta, delta) + smear_sq;
        let particle_radius_norm = select(
          0.0,
          max(row3.y * particle_radius_norm_scale, particle_radius_floor_norm),
          particle_radius_scale > 0.0 && row3.y > 0.0
        );
        let full_particle_strength = select(
          strength,
          (s1.y + subtract) * particle_radius_norm * particle_radius_norm,
          particle_radius_norm > 0.0
        );
        let particle_strength = phase_partitioned_metaball_strength(
          full_particle_strength,
          phase_weight,
          s1.y,
          subtract
        );
        let particle_support_norm = metaball_support_norm(particle_strength, subtract);
        let value = particle_strength / (0.000001 + dist2) - subtract;
        if (value > 0.0) {
          corrected_density = corrected_density + value;
          let ratio = sqrt(dist2) / max(particle_support_norm, 1.0e-6);
          corrected_palette = corrected_palette + color * smooth_palette_weight(ratio);
          corrected_temperature_weighted = corrected_temperature_weighted + row1.z * value;
          corrected_temperature_weight = corrected_temperature_weight + value;
        }
      }
      density = corrected_density;
      palette = corrected_palette;
      temperature_weighted = corrected_temperature_weighted;
      temperature_weight = corrected_temperature_weight;
    }
  }

	  for (var event_index = 0u; !dispersed_surface_active && event_index < authenticated_product_event_count; event_index = event_index + 1u) {
	    let event0 = product_event_row0(event_index);
	    let event1 = product_event_row1(event_index);
	    let event2 = product_event_row2(event_index);
	    let event3 = product_event_row3(event_index);
	    let event4 = product_event_row4(event_index);
	    let event_material_id = event1.x;
	    let event_phase_id = event2.w;
	    let event_unplaced_mass_kg = event3.y;
	    let event_status = event4.z;
	    if (
	      event_status != 1.0
	      || event_unplaced_mass_kg <= 0.0
	      || event_material_id != material_id
	      || (event_phase_id > 0.0 && event_phase_id != phase_id)
	    ) {
	      continue;
	    }
	    let event_position = vec3<f32>(
	      clamp(params.field_padding + (event0.x / ref_edge) * span, 0.001, 0.999),
	      clamp(params.field_padding + (event0.y / ref_edge) * span, 0.001, 0.999),
	      clamp(params.field_padding + (event0.z / ref_edge) * span, 0.001, 0.999)
	    );
	    let delta = cell - event_position;
	    let dist2 = dot(delta, delta);
	    let value = strength / (0.000001 + dist2) - subtract;
	    if (value > 0.0) {
	      density = density + value;
	      let ratio = sqrt(dist2) / max(support_norm, 1.0e-6);
	      palette = palette + color * smooth_palette_weight(ratio);
	    }
	  }

  let mean_temperature_k = select(
    select(0.0, temperature_weighted / max(temperature_weight, 1.0e-6), temperature_weight > 0.0),
    render_field_divide_positive_scales(
      dispersed_temperature.weighted_temperature,
      dispersed_temperature.weight
    ),
    dispersed_surface_active
  );
  render_field_cells[out_index * 2u] = vec4<f32>(density, palette);
  render_field_cells[out_index * 2u + 1u] = vec4<f32>(
    mean_temperature_k,
    dispersed_scattering_optical_depth,
    dispersed_absorption_optical_depth,
    dispersed_scattering_asymmetry_optical_depth
  );
}
`;

export const sphMaterialInterfaceCandidatesWgsl = `
struct InterfaceCandidateParams {
  surface_count: u32,
  total_field_cells: u32,
  candidate_count: u32,
  source_key_enabled: u32,
  field_padding: f32,
  ref_edge_m: f32,
  isolation_scale: f32,
  _pad1: f32,
};

@group(0) @binding(0) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_field_cells: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> interface_candidates: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: InterfaceCandidateParams;

fn surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn field_index_3d(x: u32, y: u32, z: u32, resolution: u32) -> u32 {
  return z * resolution * resolution + y * resolution + x;
}

fn write_candidate(candidate_index: u32, row0: vec4<f32>, row1: vec4<f32>, row2: vec4<f32>, row3: vec4<f32>) {
  if (candidate_index >= params.candidate_count) {
    return;
  }
  let base = candidate_index * 4u;
  interface_candidates[base] = row0;
  interface_candidates[base + 1u] = row1;
  interface_candidates[base + 2u] = row2;
  interface_candidates[base + 3u] = row3;
}

fn physical_coord_m(coord: f32, resolution: u32) -> f32 {
  let span = max(1.0e-12, 1.0 - 2.0 * params.field_padding);
  return ((((coord + 0.5) / f32(resolution)) - params.field_padding) * max(params.ref_edge_m, 1.0e-12)) / span;
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let local_candidate_index = global_id.x;
  let surface_index = global_id.y;
  if (surface_index >= params.surface_count) {
    return;
  }

  let s0 = surface_row0(surface_index);
  let s1 = surface_row1(surface_index);
  let field_offset = u32(s0.z);
  let field_cell_count = u32(s0.w);
  let cell_index = local_candidate_index / 3u;
  let axis = local_candidate_index - cell_index * 3u;
  if (cell_index >= field_cell_count) {
    return;
  }

  let candidate_index = field_offset * 3u + local_candidate_index;
  let base_row0 = vec4<f32>(f32(surface_index), s0.x, s0.y, f32(axis));
  write_candidate(
    candidate_index,
    base_row0,
    vec4<f32>(0.0, 0.0, 0.0, 0.0),
    vec4<f32>(0.0, 0.0, 0.0, 0.0),
    vec4<f32>(0.0, 0.0, 0.0, 0.0)
  );

  let resolution = max(u32(s1.x), 1u);
  let xy_count = resolution * resolution;
  let z = cell_index / xy_count;
  let rem = cell_index - z * xy_count;
  let y = rem / resolution;
  let x = rem - y * resolution;

  var nx = x;
  var ny = y;
  var nz = z;
  if (axis == 0u) {
    nx = x + 1u;
  } else if (axis == 1u) {
    ny = y + 1u;
  } else {
    nz = z + 1u;
  }
  if (nx >= resolution || ny >= resolution || nz >= resolution) {
    return;
  }

  let value = render_field_cells[(field_offset + cell_index) * 2u].x;
  let neighbor = render_field_cells[(field_offset + field_index_3d(nx, ny, nz, resolution)) * 2u].x;
  let isolation = s1.y * params.isolation_scale;
  let inside = value >= isolation;
  let neighbor_inside = neighbor >= isolation;
  if (inside == neighbor_inside) {
    return;
  }

  var sign = -1.0;
  if (inside) {
    sign = 1.0;
  }
  var normal = vec3<f32>(0.0, 0.0, 0.0);
  if (axis == 0u) {
    normal.x = sign;
  } else if (axis == 1u) {
    normal.y = sign;
  } else {
    normal.z = sign;
  }

  let span = max(1.0e-12, 1.0 - 2.0 * params.field_padding);
  let cell_size_m = max(params.ref_edge_m, 1.0e-12) / (span * f32(resolution));
  let area_m2 = cell_size_m * cell_size_m;
  let centroid = vec3<f32>(
    physical_coord_m((f32(x) + f32(nx)) * 0.5, resolution),
    physical_coord_m((f32(y) + f32(ny)) * 0.5, resolution),
    physical_coord_m((f32(z) + f32(nz)) * 0.5, resolution)
  );
  let normal_area = normal * area_m2;
  write_candidate(
    candidate_index,
    base_row0,
    vec4<f32>(centroid, area_m2),
    vec4<f32>(normal, normal_area.x),
    vec4<f32>(normal_area.y, normal_area.z, sign, 1.0)
  );
}
`;

export const sphMaterialInterfaceCompactCandidatesWgsl = `
struct InterfaceCandidateParams {
  surface_count: u32,
  total_field_cells: u32,
  candidate_count: u32,
  source_key_enabled: u32,
  field_padding: f32,
  ref_edge_m: f32,
  isolation_scale: f32,
  _pad1: f32,
};

@group(0) @binding(0) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_field_cells: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> interface_candidates: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: InterfaceCandidateParams;
@group(0) @binding(4) var<storage, read_write> compact_metadata: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> source_index_field: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> interface_source_keys: array<vec4<f32>>;

fn compact_surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn compact_surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn compact_field_index_3d(x: u32, y: u32, z: u32, resolution: u32) -> u32 {
  return z * resolution * resolution + y * resolution + x;
}

fn compact_write_candidate(
  row0: vec4<f32>,
  row1: vec4<f32>,
  row2: vec4<f32>,
  row3: vec4<f32>,
  source_field_index: u32
) {
  let compact_index = atomicAdd(&compact_metadata[0], 1u);
  let capacity = atomicLoad(&compact_metadata[2]);
  if (compact_index >= capacity) {
    atomicAdd(&compact_metadata[1], 1u);
    return;
  }
  let base = compact_index * 4u;
  interface_candidates[base] = row0;
  interface_candidates[base + 1u] = row1;
  interface_candidates[base + 2u] = row2;
  interface_candidates[base + 3u] = row3;
  var source_particle_index = 0.0;
  var key_status = 0.0;
  if (params.source_key_enabled != 0u && source_field_index < params.total_field_cells) {
    let packed_source_key = atomicLoad(&source_index_field[source_field_index]);
    if (packed_source_key > 0u) {
      source_particle_index = f32(packed_source_key - 1u);
      key_status = 1.0;
    }
  }
  interface_source_keys[compact_index] = vec4<f32>(
    f32(compact_index),
    source_particle_index,
    key_status,
    0.0
  );
}

fn compact_physical_coord_m(coord: f32, resolution: u32) -> f32 {
  let span = max(1.0e-12, 1.0 - 2.0 * params.field_padding);
  return ((((coord + 0.5) / f32(resolution)) - params.field_padding) * max(params.ref_edge_m, 1.0e-12)) / span;
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let local_candidate_index = global_id.x;
  let surface_index = global_id.y;
  if (surface_index >= params.surface_count) {
    return;
  }

  let s0 = compact_surface_row0(surface_index);
  let s1 = compact_surface_row1(surface_index);
  let field_offset = u32(s0.z);
  let field_cell_count = u32(s0.w);
  let cell_index = local_candidate_index / 3u;
  let axis = local_candidate_index - cell_index * 3u;
  if (cell_index >= field_cell_count) {
    return;
  }

  let resolution = max(u32(s1.x), 1u);
  let xy_count = resolution * resolution;
  let z = cell_index / xy_count;
  let rem = cell_index - z * xy_count;
  let y = rem / resolution;
  let x = rem - y * resolution;

  var nx = x;
  var ny = y;
  var nz = z;
  if (axis == 0u) {
    nx = x + 1u;
  } else if (axis == 1u) {
    ny = y + 1u;
  } else {
    nz = z + 1u;
  }
  if (nx >= resolution || ny >= resolution || nz >= resolution) {
    return;
  }

  let value = render_field_cells[(field_offset + cell_index) * 2u].x;
  let neighbor_cell_index = compact_field_index_3d(nx, ny, nz, resolution);
  let neighbor = render_field_cells[(field_offset + neighbor_cell_index) * 2u].x;
  let isolation = s1.y * params.isolation_scale;
  let inside = value >= isolation;
  let neighbor_inside = neighbor >= isolation;
  if (inside == neighbor_inside) {
    return;
  }

  var sign = -1.0;
  if (inside) {
    sign = 1.0;
  }
  var normal = vec3<f32>(0.0, 0.0, 0.0);
  if (axis == 0u) {
    normal.x = sign;
  } else if (axis == 1u) {
    normal.y = sign;
  } else {
    normal.z = sign;
  }

  let span = max(1.0e-12, 1.0 - 2.0 * params.field_padding);
  let cell_size_m = max(params.ref_edge_m, 1.0e-12) / (span * f32(resolution));
  let area_m2 = cell_size_m * cell_size_m;
  let centroid = vec3<f32>(
    compact_physical_coord_m((f32(x) + f32(nx)) * 0.5, resolution),
    compact_physical_coord_m((f32(y) + f32(ny)) * 0.5, resolution),
    compact_physical_coord_m((f32(z) + f32(nz)) * 0.5, resolution)
  );
  let normal_area = normal * area_m2;
  let source_field_index = field_offset + select(neighbor_cell_index, cell_index, inside);
  compact_write_candidate(
    vec4<f32>(f32(surface_index), s0.x, s0.y, f32(axis)),
    vec4<f32>(centroid, area_m2),
    vec4<f32>(normal, normal_area.x),
    vec4<f32>(normal_area.y, normal_area.z, sign, 1.0),
    source_field_index
  );
}
`;

export const sphRenderMarchingCubeCellsWgsl = `
struct MarchingCubesCandidateParams {
  surface_count: u32,
  total_field_cells: u32,
  candidate_count: u32,
  _pad0: u32,
  field_padding: f32,
  ref_edge_m: f32,
  isolation_scale: f32,
  _pad1: f32,
};

@group(0) @binding(0) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_field_cells: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> marching_cubes_candidates: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: MarchingCubesCandidateParams;

fn mc_surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn mc_surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn mc_field_index_3d(x: u32, y: u32, z: u32, resolution: u32) -> u32 {
  return z * resolution * resolution + y * resolution + x;
}

fn mc_density(field_offset: u32, x: u32, y: u32, z: u32, resolution: u32) -> f32 {
  return render_field_cells[(field_offset + mc_field_index_3d(x, y, z, resolution)) * 2u].x;
}

fn mc_physical_coord_m(coord: f32, resolution: u32) -> f32 {
  let span = max(1.0e-12, 1.0 - 2.0 * params.field_padding);
  return (((coord / f32(resolution)) - params.field_padding) * max(params.ref_edge_m, 1.0e-12)) / span;
}

fn mc_edge_crossing(a: f32, b: f32, isolation: f32) -> u32 {
  if ((a >= isolation) != (b >= isolation)) {
    return 1u;
  }
  return 0u;
}

fn mc_write_candidate(candidate_index: u32, row0: vec4<f32>, row1: vec4<f32>, row2: vec4<f32>, row3: vec4<f32>) {
  if (candidate_index >= params.candidate_count) {
    return;
  }
  let base = candidate_index * 4u;
  marching_cubes_candidates[base] = row0;
  marching_cubes_candidates[base + 1u] = row1;
  marching_cubes_candidates[base + 2u] = row2;
  marching_cubes_candidates[base + 3u] = row3;
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let local_voxel_index = global_id.x;
  let surface_index = global_id.y;
  if (surface_index >= params.surface_count) {
    return;
  }

  let s0 = mc_surface_row0(surface_index);
  let s1 = mc_surface_row1(surface_index);
  let field_offset = u32(s0.z);
  let field_cell_count = u32(s0.w);
  let resolution = max(u32(s1.x), 1u);
  if (resolution <= 1u) {
    return;
  }

  let voxel_resolution = resolution - 1u;
  let voxel_xy_count = voxel_resolution * voxel_resolution;
  let voxel_count = voxel_xy_count * voxel_resolution;
  if (local_voxel_index >= voxel_count || local_voxel_index >= field_cell_count) {
    return;
  }

  let candidate_index = field_offset + local_voxel_index;
  let z = local_voxel_index / voxel_xy_count;
  let rem = local_voxel_index - z * voxel_xy_count;
  let y = rem / voxel_resolution;
  let x = rem - y * voxel_resolution;
  let isolation = s1.y * params.isolation_scale;

  let v0 = mc_density(field_offset, x, y, z, resolution);
  let v1 = mc_density(field_offset, x + 1u, y, z, resolution);
  let v2 = mc_density(field_offset, x + 1u, y + 1u, z, resolution);
  let v3 = mc_density(field_offset, x, y + 1u, z, resolution);
  let v4 = mc_density(field_offset, x, y, z + 1u, resolution);
  let v5 = mc_density(field_offset, x + 1u, y, z + 1u, resolution);
  let v6 = mc_density(field_offset, x + 1u, y + 1u, z + 1u, resolution);
  let v7 = mc_density(field_offset, x, y + 1u, z + 1u, resolution);

  var corner_mask = 0u;
  if (v0 >= isolation) { corner_mask = corner_mask | 1u; }
  if (v1 >= isolation) { corner_mask = corner_mask | 2u; }
  if (v2 >= isolation) { corner_mask = corner_mask | 4u; }
  if (v3 >= isolation) { corner_mask = corner_mask | 8u; }
  if (v4 >= isolation) { corner_mask = corner_mask | 16u; }
  if (v5 >= isolation) { corner_mask = corner_mask | 32u; }
  if (v6 >= isolation) { corner_mask = corner_mask | 64u; }
  if (v7 >= isolation) { corner_mask = corner_mask | 128u; }

  var edge_crossing_count = 0u;
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v0, v1, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v1, v2, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v2, v3, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v3, v0, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v4, v5, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v5, v6, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v6, v7, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v7, v4, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v0, v4, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v1, v5, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v2, v6, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v3, v7, isolation);

  let cell_is_active = corner_mask != 0u && corner_mask != 255u;
  let reserved_triangle_count = select(0.0, 12.0, cell_is_active);
  let reserved_vertex_count = reserved_triangle_count * 3.0;
  let status = select(0.0, 1.0, cell_is_active);
  let span = max(1.0e-12, 1.0 - 2.0 * params.field_padding);
  let cell_size_m = max(params.ref_edge_m, 1.0e-12) / (span * f32(resolution));
  let center = vec3<f32>(
    mc_physical_coord_m(f32(x) + 0.5, resolution),
    mc_physical_coord_m(f32(y) + 0.5, resolution),
    mc_physical_coord_m(f32(z) + 0.5, resolution)
  );
  let density_min = min(min(min(v0, v1), min(v2, v3)), min(min(v4, v5), min(v6, v7)));
  let density_max = max(max(max(v0, v1), max(v2, v3)), max(max(v4, v5), max(v6, v7)));

  mc_write_candidate(
    candidate_index,
    vec4<f32>(f32(surface_index), s0.x, s0.y, f32(local_voxel_index)),
    vec4<f32>(center, cell_size_m),
    vec4<f32>(f32(corner_mask), f32(edge_crossing_count), reserved_triangle_count, reserved_vertex_count),
    vec4<f32>(density_min, density_max, isolation, status)
  );
}
`;

export const sphRenderFieldSurfaceSummaryWgsl = `
struct SurfaceSummaryParams {
  surface_count: u32,
  total_field_cells: u32,
  _pad0: u32,
  _pad1: u32,
  field_padding: f32,
  ref_edge_m: f32,
  isolation_scale: f32,
  _pad2: f32,
};

@group(0) @binding(0) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_field_cells: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> surface_summary_rows: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: SurfaceSummaryParams;

fn ss_surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn ss_surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn ss_surface_row3(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 3u];
}

fn ss_field_index_3d(x: u32, y: u32, z: u32, resolution: u32) -> u32 {
  return z * resolution * resolution + y * resolution + x;
}

fn ss_physical_coord_m(coord: f32, resolution: u32) -> f32 {
  let span = max(1.0e-12, 1.0 - 2.0 * params.field_padding);
  return (((coord / f32(resolution)) - params.field_padding) * max(params.ref_edge_m, 1.0e-12)) / span;
}

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let surface_index = global_id.x;
  if (surface_index >= params.surface_count) {
    return;
  }
  let row0 = ss_surface_row0(surface_index);
  let row1 = ss_surface_row1(surface_index);
  let row3 = ss_surface_row3(surface_index);
  let field_offset = u32(max(0.0, round(row0.z)));
  let field_cell_count = u32(max(0.0, round(row0.w)));
  let resolution = max(1u, u32(max(1.0, round(row1.x))));
  let isolation = max(0.0, row1.y * params.isolation_scale);
  let bounded_cell_count = min(field_cell_count, resolution * resolution * resolution);
  var active_cell_count = 0u;
  var max_density = 0.0;
  var min_pos = vec3<f32>(1.0e30, 1.0e30, 1.0e30);
  var max_pos = vec3<f32>(-1.0e30, -1.0e30, -1.0e30);
  for (var cell_index = 0u; cell_index < bounded_cell_count; cell_index = cell_index + 1u) {
    let density = render_field_cells[(field_offset + cell_index) * 2u].x;
    max_density = max(max_density, density);
    if (density >= isolation && density > 0.0) {
      let xy = resolution * resolution;
      let z = cell_index / xy;
      let rem = cell_index - z * xy;
      let y = rem / resolution;
      let x = rem - y * resolution;
      let pos = vec3<f32>(
        ss_physical_coord_m(f32(x), resolution),
        ss_physical_coord_m(f32(y), resolution),
        ss_physical_coord_m(f32(z), resolution)
      );
      min_pos = min(min_pos, pos);
      max_pos = max(max_pos, pos);
      active_cell_count = active_cell_count + 1u;
    }
  }
  let has_active_cells = active_cell_count > 0u;
  let min_active = select(vec3<f32>(0.0, 0.0, 0.0), min_pos, has_active_cells);
  let max_active = select(vec3<f32>(0.0, 0.0, 0.0), max_pos, has_active_cells);
  let center = select(vec3<f32>(0.0, 0.0, 0.0), (min_active + max_active) * 0.5, has_active_cells);
  let radius = select(0.0, length(max_active - center), has_active_cells);
  let cell_size_m = max(params.ref_edge_m, 1.0e-12)
    / max(1.0e-12, (1.0 - 2.0 * params.field_padding) * f32(resolution));
  let base = surface_index * 5u;
  surface_summary_rows[base] = vec4<f32>(f32(surface_index), row0.x, row0.y, row3.y);
  surface_summary_rows[base + 1u] = vec4<f32>(f32(active_cell_count), f32(active_cell_count), max_density, isolation);
  surface_summary_rows[base + 2u] = vec4<f32>(min_active, select(0.0, 1.0, has_active_cells));
  surface_summary_rows[base + 3u] = vec4<f32>(max_active, cell_size_m);
  surface_summary_rows[base + 4u] = vec4<f32>(center, radius);
}
`;

export const sphRenderSurfaceVerticesWgsl = `
struct SurfaceVertexParams {
  surface_count: u32,
  max_vertex_rows: u32,
  total_field_cells: u32,
  emission_mode: u32,
  field_padding: f32,
  ref_edge_m: f32,
  isolation_scale: f32,
  _pad1: f32,
};

struct SurfaceVertexCounter {
  vertex_count: atomic<u32>,
  overflow_count: atomic<u32>,
  _pad0: u32,
  _pad1: u32,
};

@group(0) @binding(0) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_field_cells: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> surface_vertices: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: SurfaceVertexParams;
@group(0) @binding(4) var<storage, read_write> surface_vertex_counter: SurfaceVertexCounter;

fn sv_surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn sv_surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn sv_surface_row3(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 3u];
}

fn sv_field_index_3d(x: u32, y: u32, z: u32, resolution: u32) -> u32 {
  return z * resolution * resolution + y * resolution + x;
}

fn sv_density(field_offset: u32, x: u32, y: u32, z: u32, resolution: u32) -> f32 {
  return render_field_cells[(field_offset + sv_field_index_3d(x, y, z, resolution)) * 2u].x;
}

fn sv_physical_coord_m(coord: f32, resolution: u32) -> f32 {
  let span = max(1.0e-12, 1.0 - 2.0 * params.field_padding);
  return (((coord / f32(resolution)) - params.field_padding) * max(params.ref_edge_m, 1.0e-12)) / span;
}

fn sv_corner_position(corner: u32, x: u32, y: u32, z: u32, resolution: u32) -> vec3<f32> {
  var cx = x;
  var cy = y;
  var cz = z;
  if (corner == 1u || corner == 2u || corner == 5u || corner == 6u) { cx = x + 1u; }
  if (corner == 2u || corner == 3u || corner == 6u || corner == 7u) { cy = y + 1u; }
  if (corner >= 4u) { cz = z + 1u; }
  return vec3<f32>(
    sv_physical_coord_m(f32(cx), resolution),
    sv_physical_coord_m(f32(cy), resolution),
    sv_physical_coord_m(f32(cz), resolution)
  );
}

fn sv_corner_density(field_offset: u32, corner: u32, x: u32, y: u32, z: u32, resolution: u32) -> f32 {
  var cx = x;
  var cy = y;
  var cz = z;
  if (corner == 1u || corner == 2u || corner == 5u || corner == 6u) { cx = x + 1u; }
  if (corner == 2u || corner == 3u || corner == 6u || corner == 7u) { cy = y + 1u; }
  if (corner >= 4u) { cz = z + 1u; }
  return sv_density(field_offset, cx, cy, cz, resolution);
}

fn sv_tetra_corner(tetra_index: u32, slot: u32) -> u32 {
  if (tetra_index == 0u) {
    if (slot == 0u) { return 0u; }
    if (slot == 1u) { return 5u; }
    if (slot == 2u) { return 1u; }
    return 6u;
  }
  if (tetra_index == 1u) {
    if (slot == 0u) { return 0u; }
    if (slot == 1u) { return 1u; }
    if (slot == 2u) { return 2u; }
    return 6u;
  }
  if (tetra_index == 2u) {
    if (slot == 0u) { return 0u; }
    if (slot == 1u) { return 2u; }
    if (slot == 2u) { return 3u; }
    return 6u;
  }
  if (tetra_index == 3u) {
    if (slot == 0u) { return 0u; }
    if (slot == 1u) { return 3u; }
    if (slot == 2u) { return 7u; }
    return 6u;
  }
  if (tetra_index == 4u) {
    if (slot == 0u) { return 0u; }
    if (slot == 1u) { return 7u; }
    if (slot == 2u) { return 4u; }
    return 6u;
  }
  if (slot == 0u) { return 0u; }
  if (slot == 1u) { return 4u; }
  if (slot == 2u) { return 5u; }
  return 6u;
}

fn sv_interpolate(a: vec3<f32>, b: vec3<f32>, value_a: f32, value_b: f32, isolation: f32) -> vec3<f32> {
  let denom = value_b - value_a;
  let t = select(0.5, clamp((isolation - value_a) / denom, 0.0, 1.0), abs(denom) > 1.0e-12);
  return a + (b - a) * t;
}

fn sv_triangle_normal(a: vec3<f32>, b: vec3<f32>, c: vec3<f32>) -> vec3<f32> {
  let n = cross(b - a, c - a);
  let len = length(n);
  if (len <= 1.0e-12) {
    return vec3<f32>(0.0, 0.0, 0.0);
  }
  return n / len;
}

fn sv_write_vertex(
  row_index: u32,
  surface_index: u32,
  material_id: f32,
  phase_id: f32,
  triangle_index: u32,
  vertex_index: u32,
  position: vec3<f32>,
  normal: vec3<f32>,
  optical_state_id: f32,
  density: f32,
  isolation: f32,
  source_voxel_index: u32
) {
  if (row_index >= params.max_vertex_rows) {
    return;
  }
  let base = row_index * 4u;
  surface_vertices[base] = vec4<f32>(f32(surface_index), material_id, phase_id, f32(triangle_index));
  surface_vertices[base + 1u] = vec4<f32>(f32(vertex_index), position.x, position.y, position.z);
  surface_vertices[base + 2u] = vec4<f32>(normal.x, normal.y, normal.z, optical_state_id);
  surface_vertices[base + 3u] = vec4<f32>(density, isolation, f32(source_voxel_index), 1.0);
}

fn sv_emit_triangle(
  base_vertex_row: u32,
  local_vertex_offset: u32,
  surface_index: u32,
  material_id: f32,
  phase_id: f32,
  optical_state_id: f32,
  source_voxel_index: u32,
  isolation: f32,
  outward_hint: vec3<f32>,
  a: vec3<f32>,
  b: vec3<f32>,
  c: vec3<f32>
) -> u32 {
  if (local_vertex_offset + 2u >= 36u) {
    return local_vertex_offset;
  }
  var va = a;
  var vb = b;
  var vc = c;
  var normal = sv_triangle_normal(va, vb, vc);
  if (dot(normal, outward_hint) < 0.0) {
    vb = c;
    vc = b;
    normal = sv_triangle_normal(va, vb, vc);
  }
  var write_base = base_vertex_row + local_vertex_offset;
  if (params.emission_mode == 1u) {
    write_base = atomicAdd(&surface_vertex_counter.vertex_count, 3u);
  }
  if (write_base + 2u >= params.max_vertex_rows) {
    if (params.emission_mode == 1u) {
      atomicAdd(&surface_vertex_counter.overflow_count, 3u);
    }
    return local_vertex_offset + 3u;
  }
  let triangle_index = write_base / 3u;
  sv_write_vertex(write_base, surface_index, material_id, phase_id, triangle_index, 0u, va, normal, optical_state_id, isolation, isolation, source_voxel_index);
  sv_write_vertex(write_base + 1u, surface_index, material_id, phase_id, triangle_index, 1u, vb, normal, optical_state_id, isolation, isolation, source_voxel_index);
  sv_write_vertex(write_base + 2u, surface_index, material_id, phase_id, triangle_index, 2u, vc, normal, optical_state_id, isolation, isolation, source_voxel_index);
  return local_vertex_offset + 3u;
}

fn sv_emit_tetra(
  tetra_index: u32,
  base_vertex_row: u32,
  local_vertex_offset: u32,
  surface_index: u32,
  material_id: f32,
  phase_id: f32,
  optical_state_id: f32,
  field_offset: u32,
  x: u32,
  y: u32,
  z: u32,
  resolution: u32,
  source_voxel_index: u32,
  isolation: f32
) -> u32 {
  var inside: array<u32, 4>;
  var outside: array<u32, 4>;
  var inside_count = 0u;
  var outside_count = 0u;
  for (var slot = 0u; slot < 4u; slot = slot + 1u) {
    let corner = sv_tetra_corner(tetra_index, slot);
    let density = sv_corner_density(field_offset, corner, x, y, z, resolution);
    if (density >= isolation) {
      inside[inside_count] = corner;
      inside_count = inside_count + 1u;
    } else {
      outside[outside_count] = corner;
      outside_count = outside_count + 1u;
    }
  }
  if (inside_count == 0u || inside_count == 4u) {
    return local_vertex_offset;
  }
  var offset = local_vertex_offset;
  if (inside_count == 1u || inside_count == 3u) {
    let source = select(outside[0], inside[0], inside_count == 1u);
    let target0 = select(inside[0], outside[0], inside_count == 1u);
    let target1 = select(inside[1], outside[1], inside_count == 1u);
    let target2 = select(inside[2], outside[2], inside_count == 1u);
    let ps = sv_corner_position(source, x, y, z, resolution);
    let vs = sv_corner_density(field_offset, source, x, y, z, resolution);
    let p0 = sv_interpolate(ps, sv_corner_position(target0, x, y, z, resolution), vs, sv_corner_density(field_offset, target0, x, y, z, resolution), isolation);
    let p1 = sv_interpolate(ps, sv_corner_position(target1, x, y, z, resolution), vs, sv_corner_density(field_offset, target1, x, y, z, resolution), isolation);
    let p2 = sv_interpolate(ps, sv_corner_position(target2, x, y, z, resolution), vs, sv_corner_density(field_offset, target2, x, y, z, resolution), isolation);
    let target_center = (
      sv_corner_position(target0, x, y, z, resolution)
      + sv_corner_position(target1, x, y, z, resolution)
      + sv_corner_position(target2, x, y, z, resolution)
    ) / 3.0;
    let outward_hint = select(ps - target_center, target_center - ps, inside_count == 1u);
    offset = sv_emit_triangle(base_vertex_row, offset, surface_index, material_id, phase_id, optical_state_id, source_voxel_index, isolation, outward_hint, p0, p1, p2);
    return offset;
  }

  let inside_a = inside[0];
  let inside_b = inside[1];
  let outside_a = outside[0];
  let outside_b = outside[1];
  let pia = sv_corner_position(inside_a, x, y, z, resolution);
  let pib = sv_corner_position(inside_b, x, y, z, resolution);
  let poa = sv_corner_position(outside_a, x, y, z, resolution);
  let pob = sv_corner_position(outside_b, x, y, z, resolution);
  let via = sv_corner_density(field_offset, inside_a, x, y, z, resolution);
  let vib = sv_corner_density(field_offset, inside_b, x, y, z, resolution);
  let voa = sv_corner_density(field_offset, outside_a, x, y, z, resolution);
  let vob = sv_corner_density(field_offset, outside_b, x, y, z, resolution);
  let edge_a0 = sv_interpolate(pia, poa, via, voa, isolation);
  let edge_a1 = sv_interpolate(pia, pob, via, vob, isolation);
  let edge_b0 = sv_interpolate(pib, poa, vib, voa, isolation);
  let edge_b1 = sv_interpolate(pib, pob, vib, vob, isolation);
  let outward_hint = ((poa + pob) * 0.5) - ((pia + pib) * 0.5);
  offset = sv_emit_triangle(base_vertex_row, offset, surface_index, material_id, phase_id, optical_state_id, source_voxel_index, isolation, outward_hint, edge_a0, edge_a1, edge_b0);
  offset = sv_emit_triangle(base_vertex_row, offset, surface_index, material_id, phase_id, optical_state_id, source_voxel_index, isolation, outward_hint, edge_b0, edge_a1, edge_b1);
  return offset;
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let local_voxel_index = global_id.x;
  let surface_index = global_id.y;
  if (surface_index >= params.surface_count) {
    return;
  }

  let s0 = sv_surface_row0(surface_index);
  let s1 = sv_surface_row1(surface_index);
  let s3 = sv_surface_row3(surface_index);
  let field_offset = u32(s0.z);
  let field_cell_count = u32(s0.w);
  let resolution = max(u32(s1.x), 1u);
  if (resolution <= 1u) {
    return;
  }

  let voxel_resolution = resolution - 1u;
  let voxel_xy_count = voxel_resolution * voxel_resolution;
  let voxel_count = voxel_xy_count * voxel_resolution;
  if (local_voxel_index >= voxel_count || local_voxel_index >= field_cell_count) {
    return;
  }

  let z = local_voxel_index / voxel_xy_count;
  let rem = local_voxel_index - z * voxel_xy_count;
  let y = rem / voxel_resolution;
  let x = rem - y * voxel_resolution;
  let isolation = s1.y * params.isolation_scale;
  var local_vertex_offset = 0u;
  let base_vertex_row = (field_offset + local_voxel_index) * 36u;
  for (var tetra_index = 0u; tetra_index < 6u; tetra_index = tetra_index + 1u) {
    local_vertex_offset = sv_emit_tetra(
      tetra_index,
      base_vertex_row,
      local_vertex_offset,
      surface_index,
      s0.x,
      s0.y,
      s3.y,
      field_offset,
      x,
      y,
      z,
      resolution,
      local_voxel_index,
      isolation
    );
  }
}
`;

export const sphRenderSurfaceDrawWgsl = `
struct SurfaceDrawParams {
  surface_count: u32,
  source_vertex_row_count: u32,
  max_compact_vertex_rows: u32,
  source_vertex_counter_mode: u32,
};

struct SurfaceDrawVertexCounter {
  vertex_count: u32,
  overflow_count: u32,
  _pad0: u32,
  _pad1: u32,
};

@group(0) @binding(0) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_surface_vertices: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> compact_surface_vertices: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> surface_draw_rows: array<vec4<f32>>;
@group(0) @binding(4) var<uniform> params: SurfaceDrawParams;
@group(0) @binding(5) var<storage, read_write> surface_draw_indirect_rows: array<vec4<u32>>;
@group(0) @binding(6) var<storage, read> source_vertex_counter: SurfaceDrawVertexCounter;
@group(0) @binding(7) var<storage, read_write> surface_draw_aggregate_indirect: array<vec4<u32>>;

fn sd_surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn sd_surface_row3(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 3u];
}

fn sd_vertex_row0(row_index: u32) -> vec4<f32> {
  return source_surface_vertices[row_index * 4u];
}

fn sd_vertex_row1(row_index: u32) -> vec4<f32> {
  return source_surface_vertices[row_index * 4u + 1u];
}

fn sd_vertex_row2(row_index: u32) -> vec4<f32> {
  return source_surface_vertices[row_index * 4u + 2u];
}

fn sd_vertex_row3(row_index: u32) -> vec4<f32> {
  return source_surface_vertices[row_index * 4u + 3u];
}

fn sd_surface_index_from_row(row0: vec4<f32>) -> u32 {
  return u32(max(0.0, round(row0.x)));
}

fn sd_is_active(row3: vec4<f32>) -> bool {
  return row3.w > 0.0;
}

fn sd_source_vertex_row_count() -> u32 {
  if (params.source_vertex_counter_mode == 1u) {
    return min(params.source_vertex_row_count, source_vertex_counter.vertex_count);
  }
  return params.source_vertex_row_count;
}

fn sd_transparency_class(phase_id: f32) -> f32 {
  let phase = u32(max(0.0, round(phase_id)));
  if (phase == 3u) {
    return 3.0;
  }
  if (phase == 2u) {
    return 2.0;
  }
  return 0.0;
}

fn sd_write_compact_vertex(
  write_row: u32,
  source_surface_index: u32,
  source_row0: vec4<f32>,
  source_row1: vec4<f32>,
  source_row2: vec4<f32>,
  source_row3: vec4<f32>
) {
  if (write_row >= params.max_compact_vertex_rows) {
    return;
  }
  let base = write_row * 4u;
  compact_surface_vertices[base] = vec4<f32>(
    f32(source_surface_index),
    source_row0.y,
    source_row0.z,
    f32(write_row / 3u)
  );
  compact_surface_vertices[base + 1u] = vec4<f32>(
    f32(write_row % 3u),
    source_row1.y,
    source_row1.z,
    source_row1.w
  );
  compact_surface_vertices[base + 2u] = source_row2;
  compact_surface_vertices[base + 3u] = source_row3;
}

fn sd_write_draw_row(
  surface_index: u32,
  material_id: f32,
  phase_id: f32,
  optical_state_id: f32,
  vertex_offset: u32,
  vertex_count: u32,
  triangle_offset: u32,
  triangle_count: u32,
  render_order: f32,
  transparency_class_id: f32,
  depth_write_flag: f32,
  status: f32,
  bounds_center: vec3<f32>,
  bounds_radius_m: f32
) {
  let base = surface_index * 4u;
  surface_draw_rows[base] = vec4<f32>(f32(surface_index), material_id, phase_id, optical_state_id);
  surface_draw_rows[base + 1u] = vec4<f32>(f32(vertex_offset), f32(vertex_count), f32(triangle_offset), f32(triangle_count));
  surface_draw_rows[base + 2u] = vec4<f32>(render_order, transparency_class_id, depth_write_flag, status);
  surface_draw_rows[base + 3u] = vec4<f32>(bounds_center, bounds_radius_m);
}

fn sd_write_draw_indirect_row(
  surface_index: u32,
  vertex_count: u32,
  instance_count: u32,
  first_vertex: u32,
  first_instance: u32
) {
  surface_draw_indirect_rows[surface_index] = vec4<u32>(
    vertex_count,
    instance_count,
    first_vertex,
    first_instance
  );
}

fn sd_write_aggregate_indirect_row(vertex_count: u32) {
  let aligned_vertex_count = vertex_count - (vertex_count % 3u);
  surface_draw_aggregate_indirect[0] = vec4<u32>(
    aligned_vertex_count,
    select(0u, 1u, aligned_vertex_count >= 3u),
    0u,
    0u
  );
}

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let surface_index = global_id.x;
  if (surface_index >= params.surface_count) {
    return;
  }

  let surface_row0 = sd_surface_row0(surface_index);
  let surface_row3 = sd_surface_row3(surface_index);
  let source_vertex_row_count = sd_source_vertex_row_count();
  if (surface_index == 0u) {
    sd_write_aggregate_indirect_row(source_vertex_row_count);
  }
  var prefix_vertex_count = 0u;
  for (var row_index = 0u; row_index < source_vertex_row_count; row_index = row_index + 1u) {
    let row0 = sd_vertex_row0(row_index);
    let row3 = sd_vertex_row3(row_index);
    let source_surface_index = sd_surface_index_from_row(row0);
    if (sd_is_active(row3) && source_surface_index < surface_index) {
      prefix_vertex_count = prefix_vertex_count + 1u;
    }
  }

  var vertex_count = 0u;
  var min_pos = vec3<f32>(1.0e30, 1.0e30, 1.0e30);
  var max_pos = vec3<f32>(-1.0e30, -1.0e30, -1.0e30);
  for (var row_index = 0u; row_index < source_vertex_row_count; row_index = row_index + 1u) {
    let row0 = sd_vertex_row0(row_index);
    let row1 = sd_vertex_row1(row_index);
    let row2 = sd_vertex_row2(row_index);
    let row3 = sd_vertex_row3(row_index);
    let source_surface_index = sd_surface_index_from_row(row0);
    if (sd_is_active(row3) && source_surface_index == surface_index) {
      let write_row = prefix_vertex_count + vertex_count;
      sd_write_compact_vertex(write_row, source_surface_index, row0, row1, row2, row3);
      let position = vec3<f32>(row1.y, row1.z, row1.w);
      min_pos = min(min_pos, position);
      max_pos = max(max_pos, position);
      vertex_count = vertex_count + 1u;
    }
  }

  let surface_is_active = vertex_count > 0u;
  let triangle_count = vertex_count / 3u;
  let vertex_offset = select(0u, prefix_vertex_count, surface_is_active);
  let triangle_offset = select(0u, prefix_vertex_count / 3u, surface_is_active);
  let bounds_center = select(vec3<f32>(0.0, 0.0, 0.0), (min_pos + max_pos) * 0.5, surface_is_active);
  let bounds_delta = max_pos - bounds_center;
  let bounds_radius_m = select(0.0, length(bounds_delta), surface_is_active);
  let explicit_transparency_class_id = surface_row3.z;
  let transparency_class_id = select(
    sd_transparency_class(surface_row0.y),
    explicit_transparency_class_id,
    explicit_transparency_class_id >= 0.0
  );
  let render_order = transparency_class_id * 1000.0 + f32(surface_index);
  let explicit_depth_write_flag = surface_row3.w;
  let depth_write_flag = select(
    select(1.0, 0.0, transparency_class_id > 0.0),
    explicit_depth_write_flag,
    explicit_depth_write_flag >= 0.0
  );
  sd_write_draw_row(
    surface_index,
    surface_row0.x,
    surface_row0.y,
    surface_row3.y,
    vertex_offset,
    vertex_count,
    triangle_offset,
    triangle_count,
    render_order,
    transparency_class_id,
    depth_write_flag,
    select(0.0, 1.0, surface_is_active),
    bounds_center,
    bounds_radius_m
  );
  sd_write_draw_indirect_row(
    surface_index,
    select(0u, vertex_count, surface_is_active),
    select(0u, 1u, surface_is_active),
    vertex_offset,
    surface_index
  );
}
`;

export const mlsMpmMechanicsPredictWgsl = `
struct MechanicsParams {
  particle_count: u32,
  dt: f32,
  gravity_x: f32,
  gravity_y: f32,
  gravity_z: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> out_sph_state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> out_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> params: MechanicsParams;

fn det3(
  f00: f32, f01: f32, f02: f32,
  f10: f32, f11: f32, f12: f32,
  f20: f32, f21: f32, f22: f32
) -> f32 {
  return f00 * (f11 * f22 - f12 * f21)
    - f01 * (f10 * f22 - f12 * f20)
    + f02 * (f10 * f21 - f11 * f20);
}

fn cubic_root_positive(value: f32) -> f32 {
  return exp(log(max(value, 1.0e-12)) / 3.0);
}

const MECHANICS_MIN_VOLUME_RATIO_J: f32 = 0.1;
const MECHANICS_MAX_RADIUS_GROWTH_RATIO: f32 = 4.0;
const MECHANICS_MAX_VOLUME_RATIO_J: f32 = 64.0;
// Same gas-aware expansion bound as the G2P integrator (see
// G2P_MAX_VOLUME_RATIO_J_GAS): the prediction must not clamp J tighter than
// the authoritative state writer or expanded gas would be priced at a frozen
// 64x-volume density in the stress path.
const MECHANICS_MAX_VOLUME_RATIO_J_GAS: f32 = 1000.0;

fn mechanics_max_volume_ratio_j(eos_model_id: f32) -> f32 {
  let is_gas = eos_model_id > 1.5 && eos_model_id < 2.5;
  return select(MECHANICS_MAX_VOLUME_RATIO_J, MECHANICS_MAX_VOLUME_RATIO_J_GAS, is_gas);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let state_base = particle_index * 2u;
  let mechanics_base = particle_index * 8u;
  let pos_mass = sph_state[state_base];
  let vel_u = sph_state[state_base + 1u];
  let _thermo_status = sph_thermo[particle_index * 3u + 2u].z;

  var velocity = vec3<f32>(vel_u.x, vel_u.y, vel_u.z)
    + vec3<f32>(params.gravity_x, params.gravity_y, params.gravity_z) * params.dt;
  var position = vec3<f32>(pos_mass.x, pos_mass.y, pos_mass.z) + velocity * params.dt;
  let box_dims = vec3<f32>(params.box_x, params.box_y, params.box_z);

  if (position.x < 0.0) {
    position.x = 0.0;
    if (velocity.x < 0.0) { velocity.x = 0.0; }
  }
  if (position.x > box_dims.x) {
    position.x = box_dims.x;
    if (velocity.x > 0.0) { velocity.x = 0.0; }
  }
  if (position.y < 0.0) {
    position.y = 0.0;
    if (velocity.y < 0.0) { velocity.y = 0.0; }
  }
  if (position.y > box_dims.y) {
    position.y = box_dims.y;
    if (velocity.y > 0.0) { velocity.y = 0.0; }
  }
  if (position.z < 0.0) {
    position.z = 0.0;
    if (velocity.z < 0.0) { velocity.z = 0.0; }
  }
  if (position.z > box_dims.z) {
    position.z = box_dims.z;
    if (velocity.z > 0.0) { velocity.z = 0.0; }
  }

  let row0 = mls_mechanics[mechanics_base];
  let row1 = mls_mechanics[mechanics_base + 1u];
  let row2 = mls_mechanics[mechanics_base + 2u];
  let row3 = mls_mechanics[mechanics_base + 3u];
  let row4 = mls_mechanics[mechanics_base + 4u];
  let row5 = mls_mechanics[mechanics_base + 5u];
  let row6 = mls_mechanics[mechanics_base + 6u];
  let row7 = mls_mechanics[mechanics_base + 7u];

  let f00 = row0.x; let f01 = row0.y; let f02 = row0.z;
  let f10 = row0.w; let f11 = row1.x; let f12 = row1.y;
  let f20 = row1.z; let f21 = row1.w; let f22 = row2.x;
  let c00 = row2.y; let c01 = row2.z; let c02 = row2.w;
  let c10 = row3.x; let c11 = row3.y; let c12 = row3.z;
  let c20 = row3.w; let c21 = row4.x; let c22 = row4.y;

  let g00 = 1.0 + params.dt * c00; let g01 = params.dt * c01; let g02 = params.dt * c02;
  let g10 = params.dt * c10; let g11 = 1.0 + params.dt * c11; let g12 = params.dt * c12;
  let g20 = params.dt * c20; let g21 = params.dt * c21; let g22 = 1.0 + params.dt * c22;

  var nf00 = g00 * f00 + g01 * f10 + g02 * f20;
  var nf01 = g00 * f01 + g01 * f11 + g02 * f21;
  var nf02 = g00 * f02 + g01 * f12 + g02 * f22;
  var nf10 = g10 * f00 + g11 * f10 + g12 * f20;
  var nf11 = g10 * f01 + g11 * f11 + g12 * f21;
  var nf12 = g10 * f02 + g11 * f12 + g12 * f22;
  var nf20 = g20 * f00 + g21 * f10 + g22 * f20;
  var nf21 = g20 * f01 + g21 * f11 + g22 * f21;
  var nf22 = g20 * f02 + g21 * f12 + g22 * f22;
  var next_j = det3(nf00, nf01, nf02, nf10, nf11, nf12, nf20, nf21, nf22);

  if (row5.x < 0.5) {
    next_j = max(next_j, 0.05);
    let s = cubic_root_positive(next_j);
    nf00 = s; nf01 = 0.0; nf02 = 0.0;
    nf10 = 0.0; nf11 = s; nf12 = 0.0;
    nf20 = 0.0; nf21 = 0.0; nf22 = s;
  }

  next_j = det3(nf00, nf01, nf02, nf10, nf11, nf12, nf20, nf21, nf22);
  if (next_j < MECHANICS_MIN_VOLUME_RATIO_J) {
    let s = cubic_root_positive(MECHANICS_MIN_VOLUME_RATIO_J);
    nf00 = s; nf01 = 0.0; nf02 = 0.0;
    nf10 = 0.0; nf11 = s; nf12 = 0.0;
    nf20 = 0.0; nf21 = 0.0; nf22 = s;
    next_j = MECHANICS_MIN_VOLUME_RATIO_J;
  } else if (next_j > mechanics_max_volume_ratio_j(row6.z)) {
    let max_volume_ratio_j = mechanics_max_volume_ratio_j(row6.z);
    let scale = cubic_root_positive(max_volume_ratio_j / max(next_j, 1.0e-12));
    nf00 = nf00 * scale; nf01 = nf01 * scale; nf02 = nf02 * scale;
    nf10 = nf10 * scale; nf11 = nf11 * scale; nf12 = nf12 * scale;
    nf20 = nf20 * scale; nf21 = nf21 * scale; nf22 = nf22 * scale;
    next_j = max_volume_ratio_j;
  }

  out_sph_state[state_base] = vec4<f32>(position.x, position.y, position.z, pos_mass.w);
  out_sph_state[state_base + 1u] = vec4<f32>(velocity.x, velocity.y, velocity.z, vel_u.w);
  out_mls_mechanics[mechanics_base] = vec4<f32>(nf00, nf01, nf02, nf10);
  out_mls_mechanics[mechanics_base + 1u] = vec4<f32>(nf11, nf12, nf20, nf21);
  out_mls_mechanics[mechanics_base + 2u] = vec4<f32>(nf22, c00, c01, c02);
  out_mls_mechanics[mechanics_base + 3u] = vec4<f32>(c10, c11, c12, c20);
  out_mls_mechanics[mechanics_base + 4u] = vec4<f32>(c21, c22, next_j, row4.w);
  out_mls_mechanics[mechanics_base + 5u] = row5;
  out_mls_mechanics[mechanics_base + 6u] = row6;
  out_mls_mechanics[mechanics_base + 7u] = row7;
}
`;

export const mlsMpmP2gGridProjectionWgsl = `
struct P2gProjectionParams {
  particle_count: u32,
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  shift: u32,
  grid_spacing_m: f32,
  inv_grid_spacing_m: f32,
  dt: f32,
  resident_product_event_count: u32,
  internal_pressure_scale: f32,
  schroeder_filter_enabled: u32,
  schroeder_selected_level: i32,
  schroeder_assignment_stride_floats: u32,
  schroeder_spatial_directory_enabled: u32,
  schroeder_spatial_storage_generation: u32,
  grid_density_pressure_enabled: u32,
  ambient_pressure_pa: f32,
  external_gauge_pressure_pa: f32,
  external_gauge_pressure_enabled: u32,
  schroeder_spatial_position_epoch: u32,
  schroeder_spatial_topology_epoch: u32,
  schroeder_spatial_required: u32,
  schroeder_spatial_generation_id: u32,
  schroeder_spatial_device_ordinal: u32,
  schroeder_spatial_lane_ordinal: u32,
  schroeder_spatial_lease_token: u32,
  schroeder_spatial_source_family_id: u32,
  schroeder_spatial_physics_tick: u32,
  schroeder_spatial_physics_substep: u32,
  schroeder_spatial_chart_epoch: u32,
  schroeder_spatial_level_epoch: u32,
  schroeder_spatial_support_epoch: u32,
  schroeder_spatial_pad0: u32,
  schroeder_spatial_pad1: u32,
  schroeder_spatial_pad2: u32,
};

// Monaghan artificial-viscosity coefficient, applied as a BULK term under
// compression at its use site below -- never as shear viscosity.
//
// Baked as a constant rather than carried in P2gProjectionParams on purpose.
// The three params pads are aliased to different meanings in different derived
// variants -- pad0 is the spatial-evidence flag, pad1 is sourceRowLayoutId in
// the mechanics-field variant, pad2 is completionOrdinal there and an epoch
// cross-check in the base -- so no pad is free in every variant, and growing
// the struct shifts the fields that createActiveGridP2gProjectionWgsl and
// createMechanicsFieldP2gProjectionWgsl append after it. Making this
// host-configurable again means extending the struct and updating all three
// writers together.
const ARTIFICIAL_BULK_VISCOSITY_ALPHA: f32 = 0.04;

struct StressRows {
  x: vec3<f32>,
  y: vec3<f32>,
  z: vec3<f32>,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> grid_accumulators: array<atomic<i32>>;
@group(0) @binding(4) var<uniform> params: P2gProjectionParams;
@group(0) @binding(5) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> grid_nodes: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read> schroeder_level_assignments: array<f32>;
@group(0) @binding(8) var<storage, read> schroeder_spatial_directory: array<u32>;
// NOTE: P2G must stay at <= 8 storage buffers so it runs on DEFAULT WebGPU
// device limits (maxStorageBuffersPerShaderStage = 8). A binding 9 for the
// (disabled, superseded-by-separation-pass) spatial-density EOS previously
// invalidated every P2G pipeline on default-limit devices, silently zeroing
// grids for standalone/test consumers.

const P2G_ATOMIC_SCALE: f32 = 65536.0;
const P2G_ATOMIC_INV_SCALE: f32 = 1.0 / P2G_ATOMIC_SCALE;

fn p2g_quantize(value: f32) -> i32 {
  return i32(round(clamp(value * P2G_ATOMIC_SCALE, -2147483000.0, 2147483000.0)));
}

fn quadratic_weights(fx: f32) -> vec3<f32> {
  let a = 1.5 - fx;
  let b = fx - 1.0;
  let c = fx - 0.5;
  return vec3<f32>(0.5 * a * a, 0.75 - b * b, 0.5 * c * c);
}

fn weight_at(weights: vec3<f32>, offset: i32) -> f32 {
  if (offset == 0) { return weights.x; }
  if (offset == 1) { return weights.y; }
  if (offset == 2) { return weights.z; }
  return 0.0;
}

fn p2g_weight_at(weights: vec3<f32>, offset: i32) -> f32 {
  return weight_at(weights, offset);
}

fn p2g_storage_index(i: u32, j: u32, k: u32) -> u32 {
  return (i * params.grid_ny + j) * params.grid_nz + k;
}

fn p2g_node_enabled(i: u32, j: u32, k: u32) -> bool {
  return true;
}

const SCHROEDER_SPATIAL_MAGIC: u32 = 0x53534531u;
const SCHROEDER_SPATIAL_VERSION: u32 = 1u;
const SCHROEDER_SPATIAL_STATUS_READY: u32 = 1u;
const SCHROEDER_SPATIAL_STATUS_ADMITTED: u32 = 2u;
const SCHROEDER_SPATIAL_STATUS_FAIL_CLOSED: u32 = 4u;
const SCHROEDER_SPATIAL_STATUS_INVALID_SOURCE: u32 = 8u;
const SCHROEDER_SPATIAL_STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const SCHROEDER_SPATIAL_PRIMITIVE_STATUS_READY: u32 = 1u;
const SCHROEDER_SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED: u32 = 4u;
const SCHROEDER_SPATIAL_HEADER_WORDS: u32 = 48u;
const SCHROEDER_SPATIAL_KEY_WORDS: u32 = 5u;
const SCHROEDER_SPATIAL_SORT_BOUNDED_ATLAS_U32: u32 = 1u;
const SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5: u32 = 2u;
const SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS: u32 = 1u;
const SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY: u32 = 2u;

fn p2g_spatial_range_within(start: u32, count: u32, limit: u32) -> bool {
  return start <= limit && count <= limit - start;
}

fn p2g_spatial_directory_admitted() -> bool {
  if (params.schroeder_spatial_directory_enabled == 0u) {
    return false;
  }
  let bound_words = arrayLength(&schroeder_spatial_directory);
  if (bound_words < SCHROEDER_SPATIAL_HEADER_WORDS) {
    return false;
  }
  let flags = schroeder_spatial_directory[2u];
  let source_count = schroeder_spatial_directory[16u];
  let source_capacity = schroeder_spatial_directory[17u];
  let cell_count = schroeder_spatial_directory[18u];
  let cell_capacity = schroeder_spatial_directory[19u];
  let logical_required_words = schroeder_spatial_directory[20u];
  let logical_admitted_words = schroeder_spatial_directory[21u];
  let directory_capacity_words = schroeder_spatial_directory[22u];
  let cell_keys_offset_words = schroeder_spatial_directory[29u];
  let cell_offsets_offset_words = schroeder_spatial_directory[30u];
  let cell_members_offset_words = schroeder_spatial_directory[31u];
  let particle_to_cell_offset_words = schroeder_spatial_directory[32u];
  let physical_upper_bound_words = schroeder_spatial_directory[47u];
  let rejected_flags = SCHROEDER_SPATIAL_STATUS_FAIL_CLOSED
    | SCHROEDER_SPATIAL_STATUS_INVALID_SOURCE
    | SCHROEDER_SPATIAL_STATUS_CAPACITY_OVERFLOW;
  let sort_key_words = schroeder_spatial_directory[26u];
  let sort_mode = schroeder_spatial_directory[27u];
  let sort_mode_admitted = (
    sort_mode == SCHROEDER_SPATIAL_SORT_BOUNDED_ATLAS_U32
      && sort_key_words == 1u
  ) || (
    sort_mode == SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5
      && sort_key_words == SCHROEDER_SPATIAL_KEY_WORDS
  );
  let build_ordinal = schroeder_spatial_directory[33u];
  let primitive_status = schroeder_spatial_directory[41u];
  if (
    directory_capacity_words > bound_words
    || directory_capacity_words < SCHROEDER_SPATIAL_HEADER_WORDS
    || cell_keys_offset_words > directory_capacity_words
    || cell_offsets_offset_words > directory_capacity_words
    || cell_members_offset_words > directory_capacity_words
    || particle_to_cell_offset_words > directory_capacity_words
    || cell_capacity > (directory_capacity_words - cell_keys_offset_words)
      / SCHROEDER_SPATIAL_KEY_WORDS
    || cell_offsets_offset_words < cell_keys_offset_words
      + cell_capacity * SCHROEDER_SPATIAL_KEY_WORDS
    || cell_capacity + 1u > directory_capacity_words - cell_offsets_offset_words
    || cell_members_offset_words < cell_offsets_offset_words + cell_capacity + 1u
    || source_capacity > directory_capacity_words - cell_members_offset_words
    || particle_to_cell_offset_words < cell_members_offset_words + source_capacity
    || source_capacity > directory_capacity_words - particle_to_cell_offset_words
  ) {
    return false;
  }
  return schroeder_spatial_directory[0u] == SCHROEDER_SPATIAL_MAGIC
    // v1 and v2 directory ABIs share this gate's header invariants; see the
    // authority-module version note. Pinning v1 froze all v2 mechanics.
    && (
      schroeder_spatial_directory[1u] == SCHROEDER_SPATIAL_VERSION
      || schroeder_spatial_directory[1u] == SCHROEDER_SPATIAL_VERSION + 1u
    )
    && (flags & (SCHROEDER_SPATIAL_STATUS_READY | SCHROEDER_SPATIAL_STATUS_ADMITTED))
      == (SCHROEDER_SPATIAL_STATUS_READY | SCHROEDER_SPATIAL_STATUS_ADMITTED)
    && (flags & rejected_flags) == 0u
    && schroeder_spatial_directory[3u] == params.schroeder_spatial_generation_id
    && params.schroeder_spatial_generation_id > 0u
    && schroeder_spatial_directory[4u] == params.schroeder_spatial_device_ordinal
    && schroeder_spatial_directory[5u] == params.schroeder_spatial_lane_ordinal
    && schroeder_spatial_directory[6u] == params.schroeder_spatial_lease_token
    && schroeder_spatial_directory[7u] == params.schroeder_spatial_source_family_id
    && schroeder_spatial_directory[8u] == params.schroeder_spatial_storage_generation
    && schroeder_spatial_directory[9u] == params.schroeder_spatial_physics_tick
    && schroeder_spatial_directory[10u] == params.schroeder_spatial_physics_substep
    && schroeder_spatial_directory[11u] == params.schroeder_spatial_position_epoch
    && schroeder_spatial_directory[12u] == params.schroeder_spatial_topology_epoch
    && schroeder_spatial_directory[13u] == params.schroeder_spatial_chart_epoch
    && schroeder_spatial_directory[14u] == params.schroeder_spatial_level_epoch
    && schroeder_spatial_directory[15u] == params.schroeder_spatial_support_epoch
    && source_count == params.particle_count
    && source_count > 0u
    && source_count <= source_capacity
    && cell_count > 0u
    && cell_count <= source_count
    && cell_count <= cell_capacity
    && logical_required_words == logical_admitted_words
    && logical_admitted_words >= SCHROEDER_SPATIAL_HEADER_WORDS
    && logical_admitted_words <= physical_upper_bound_words
    && schroeder_spatial_directory[23u] == 0u
    && schroeder_spatial_directory[24u] == 0u
    && schroeder_spatial_directory[25u] == SCHROEDER_SPATIAL_KEY_WORDS
    && sort_mode_admitted
    && schroeder_spatial_directory[28u] == SCHROEDER_SPATIAL_HEADER_WORDS
    && cell_keys_offset_words == SCHROEDER_SPATIAL_HEADER_WORDS
    && build_ordinal != 0u
    && schroeder_spatial_directory[34u] == build_ordinal
    && schroeder_spatial_directory[35u] == build_ordinal
    && schroeder_spatial_directory[36u] == params.schroeder_spatial_generation_id
    && schroeder_spatial_directory[37u] == source_count
    && schroeder_spatial_directory[38u] == cell_count
    && schroeder_spatial_directory[39u] != 0u
    && schroeder_spatial_directory[40u] == 0u
    && (primitive_status & SCHROEDER_SPATIAL_PRIMITIVE_STATUS_READY) != 0u
    && (primitive_status & SCHROEDER_SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED) == 0u
    && schroeder_spatial_directory[45u] >= SCHROEDER_SPATIAL_HEADER_WORDS
    && (
      schroeder_spatial_directory[46u]
        == SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS
      || schroeder_spatial_directory[46u]
        == SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    )
    && physical_upper_bound_words <= directory_capacity_words
    && p2g_spatial_range_within(
      cell_keys_offset_words,
      cell_count * SCHROEDER_SPATIAL_KEY_WORDS,
      physical_upper_bound_words
    )
    && p2g_spatial_range_within(
      cell_offsets_offset_words,
      cell_count + 1u,
      physical_upper_bound_words
    )
    && p2g_spatial_range_within(
      cell_members_offset_words,
      source_count,
      physical_upper_bound_words
    )
    && p2g_spatial_range_within(
      particle_to_cell_offset_words,
      source_count,
      physical_upper_bound_words
    );
}

fn p2g_spatial_particle_level(particle_index: u32) -> i32 {
  let cell_count = schroeder_spatial_directory[18u];
  let cell_keys_offset_words = schroeder_spatial_directory[29u];
  let particle_to_cell_offset_words = schroeder_spatial_directory[32u];
  // Reverse map is cell-index-plus-one ('cell-index-plus-one-zero-dormant');
  // zero = dormant/missing sentinel. A raw decode silently rejected the
  // final cell's occupants and shifted every other lookup by one cell.
  let reverse_entry = schroeder_spatial_directory[particle_to_cell_offset_words + particle_index];
  if (reverse_entry == 0u) {
    return bitcast<i32>(0x80000000u);
  }
  let cell_index = reverse_entry - 1u;
  if (cell_index >= cell_count) {
    return bitcast<i32>(0x80000000u);
  }
  let level_order_key = schroeder_spatial_directory[
    cell_keys_offset_words + cell_index * SCHROEDER_SPATIAL_KEY_WORDS + 1u
  ];
  return bitcast<i32>(level_order_key ^ 0x80000000u);
}

// Canonical SS mechanics admits particles through the directory reverse map.
// The assignment-row lookup remains the safe fallback for explicitly
// noncanonical callers and for any malformed/stale GPU generation. Never turn
// a provenance failure into a zero-physics frame.
fn p2g_particle_enabled(particle_index: u32) -> bool {
  let spatial_admitted = p2g_spatial_directory_admitted();
  if (spatial_admitted) {
    let spatial_level = p2g_spatial_particle_level(particle_index);
    // A malformed reverse-map entry is a provenance failure for this
    // particle, not authority to remove it from mechanics.
    if (spatial_level != bitcast<i32>(0x80000000u)) {
      return spatial_level == params.schroeder_selected_level;
    }
  }
  if (params.schroeder_filter_enabled == 0u) {
    return true;
  }
  let stride = max(params.schroeder_assignment_stride_floats, 1u);
  let assignment_offset = particle_index * stride;
  let level = i32(round(schroeder_level_assignments[assignment_offset]));
  return level == params.schroeder_selected_level;
}

fn p2g_finalize_node_index(global_index: u32) -> u32 {
  if (global_index >= params.grid_node_count) {
    return params.grid_node_count;
  }
  return global_index;
}

fn p2g_try_storage_index(node_i: i32, node_j: i32, node_k: i32) -> u32 {
  let i = node_i + i32(params.shift);
  let j = node_j + i32(params.shift);
  let k = node_k + i32(params.shift);
  if (
    i < 0 || j < 0 || k < 0
    || i >= i32(params.grid_nx)
    || j >= i32(params.grid_ny)
    || k >= i32(params.grid_nz)
  ) {
    return params.grid_node_count;
  }
  let storage_i = u32(i);
  let storage_j = u32(j);
  let storage_k = u32(k);
  if (!p2g_node_enabled(storage_i, storage_j, storage_k)) {
    return params.grid_node_count;
  }
  return p2g_storage_index(storage_i, storage_j, storage_k);
}

fn p2g_atomic_add(node_index: u32, mass: f32, momentum: vec3<f32>) {
  let base = node_index * 4u;
  atomicAdd(&grid_accumulators[base], p2g_quantize(mass));
  atomicAdd(&grid_accumulators[base + 1u], p2g_quantize(momentum.x));
  atomicAdd(&grid_accumulators[base + 2u], p2g_quantize(momentum.y));
  atomicAdd(&grid_accumulators[base + 3u], p2g_quantize(momentum.z));
}

fn product_event_row0(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u];
}

fn product_event_row1(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 1u];
}

fn product_event_row2(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 2u];
}

fn product_event_row3(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 3u];
}

fn product_event_row4(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 4u];
}

fn product_event_row5(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 5u];
}

fn product_event_row6(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 6u];
}

fn product_event_row7(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 7u];
}

fn det3(
  f00: f32, f01: f32, f02: f32,
  f10: f32, f11: f32, f12: f32,
  f20: f32, f21: f32, f22: f32
) -> f32 {
  return f00 * (f11 * f22 - f12 * f21)
    - f01 * (f10 * f22 - f12 * f20)
    + f02 * (f10 * f21 - f11 * f20);
}

fn packed_pressure(density_kg_per_m3: f32, rest_density_kg_per_m3: f32, sound_speed_m_per_s: f32, eos_model_id: f32) -> f32 {
  if (density_kg_per_m3 <= 0.0 || rest_density_kg_per_m3 <= 0.0 || sound_speed_m_per_s <= 0.0) {
    return 0.0;
  }
  if (eos_model_id > 1.5 && eos_model_id < 2.5) {
    // Gas pressure push is capped near a few times the rest density so a
    // just-vaporized particle at condensed packing exerts a bounded,
    // saturation-scale expansion pressure instead of c^2*(1000 - 0.6).
    let effective_density = min(density_kg_per_m3, rest_density_kg_per_m3 * 3.0);
    return max(0.0, sound_speed_m_per_s * sound_speed_m_per_s * (effective_density - rest_density_kg_per_m3));
  }
  if (eos_model_id > 0.5 && eos_model_id < 1.5) {
    let ratio = density_kg_per_m3 / max(rest_density_kg_per_m3, 1.0e-9);
    let stiffness = rest_density_kg_per_m3 * sound_speed_m_per_s * sound_speed_m_per_s / 7.0;
    let pressure = stiffness * (pow(ratio, 7.0) - 1.0);
    // Cavitation clamp: a liquid cannot sustain bulk-scale tension - it
    // cavitates. The unbounded signed Tait tension acted as huge artificial
    // cohesion and drove the MLS-MPM tensile pairing instability (particles
    // collapsing to mm separation and beading into pearl-string clumps).
    // Keep a small restoring band below rest density for volume correction,
    // floored at a cavitation-scale fraction of the Tait stiffness.
    return max(pressure, -0.05 * stiffness);
  }
  return 0.0;
}

fn corotated_stress(
  f00: f32, f01: f32, f02: f32,
  f10: f32, f11: f32, f12: f32,
  f20: f32, f21: f32, f22: f32,
  mu: f32,
  lambda: f32
) -> StressRows {
  var r0 = f00; var r1 = f01; var r2 = f02;
  var r3 = f10; var r4 = f11; var r5 = f12;
  var r6 = f20; var r7 = f21; var r8 = f22;
  for (var it = 0u; it < 12u; it = it + 1u) {
    let rd = det3(r0, r1, r2, r3, r4, r5, r6, r7, r8);
    if (abs(rd) < 1.0e-12) {
      break;
    }
    let id = 1.0 / rd;
    let t0 = (r4 * r8 - r5 * r7) * id; let t3 = (r2 * r7 - r1 * r8) * id; let t6 = (r1 * r5 - r2 * r4) * id;
    let t1 = (r5 * r6 - r3 * r8) * id; let t4 = (r0 * r8 - r2 * r6) * id; let t7 = (r2 * r3 - r0 * r5) * id;
    let t2 = (r3 * r7 - r4 * r6) * id; let t5 = (r1 * r6 - r0 * r7) * id; let t8 = (r0 * r4 - r1 * r3) * id;
    let n0 = 0.5 * (r0 + t0); let n1 = 0.5 * (r1 + t1); let n2 = 0.5 * (r2 + t2);
    let n3 = 0.5 * (r3 + t3); let n4 = 0.5 * (r4 + t4); let n5 = 0.5 * (r5 + t5);
    let n6 = 0.5 * (r6 + t6); let n7 = 0.5 * (r7 + t7); let n8 = 0.5 * (r8 + t8);
    let diff = abs(n0 - r0) + abs(n4 - r4) + abs(n8 - r8);
    r0 = n0; r1 = n1; r2 = n2;
    r3 = n3; r4 = n4; r5 = n5;
    r6 = n6; r7 = n7; r8 = n8;
    if (diff < 1.0e-10) {
      break;
    }
  }

  let j = det3(f00, f01, f02, f10, f11, f12, f20, f21, f22);
  if (abs(j) < 1.0e-12) {
    return StressRows(vec3<f32>(0.0), vec3<f32>(0.0), vec3<f32>(0.0));
  }
  let jid = 1.0 / j;
  let ft0 = (f11 * f22 - f12 * f21) * jid; let ft3 = (f02 * f21 - f01 * f22) * jid; let ft6 = (f01 * f12 - f02 * f11) * jid;
  let ft1 = (f12 * f20 - f10 * f22) * jid; let ft4 = (f00 * f22 - f02 * f20) * jid; let ft7 = (f02 * f10 - f00 * f12) * jid;
  let ft2 = (f10 * f21 - f11 * f20) * jid; let ft5 = (f01 * f20 - f00 * f21) * jid; let ft8 = (f00 * f11 - f01 * f10) * jid;
  let c = lambda * (j - 1.0) * j;
  let p0 = 2.0 * mu * (f00 - r0) + c * ft0; let p1 = 2.0 * mu * (f01 - r1) + c * ft1; let p2 = 2.0 * mu * (f02 - r2) + c * ft2;
  let p3 = 2.0 * mu * (f10 - r3) + c * ft3; let p4 = 2.0 * mu * (f11 - r4) + c * ft4; let p5 = 2.0 * mu * (f12 - r5) + c * ft5;
  let p6 = 2.0 * mu * (f20 - r6) + c * ft6; let p7 = 2.0 * mu * (f21 - r7) + c * ft7; let p8 = 2.0 * mu * (f22 - r8) + c * ft8;
  return StressRows(
    vec3<f32>((p0 * f00 + p1 * f01 + p2 * f02) * jid, (p0 * f10 + p1 * f11 + p2 * f12) * jid, (p0 * f20 + p1 * f21 + p2 * f22) * jid),
    vec3<f32>((p3 * f00 + p4 * f01 + p5 * f02) * jid, (p3 * f10 + p4 * f11 + p5 * f12) * jid, (p3 * f20 + p4 * f21 + p5 * f22) * jid),
    vec3<f32>((p6 * f00 + p7 * f01 + p8 * f02) * jid, (p6 * f10 + p7 * f11 + p8 * f12) * jid, (p6 * f20 + p7 * f21 + p8 * f22) * jid)
  );
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  if (!p2g_particle_enabled(particle_index)) {
    return;
  }

  let state_base = particle_index * 2u;
  let thermo_base = particle_index * 3u;
  let mechanics_base = particle_index * 8u;
  let pos_mass = sph_state[state_base];
  let vel_u = sph_state[state_base + 1u];
  let thermo0 = sph_thermo[thermo_base];
  let _thermo_status = sph_thermo[thermo_base + 2u].z;
  if (!(pos_mass.w > 0.0)) {
    return;
  }

  let p_grid = pos_mass.xyz * params.inv_grid_spacing_m;
  let base_x = i32(floor(p_grid.x - 0.5));
  let base_y = i32(floor(p_grid.y - 0.5));
  let base_z = i32(floor(p_grid.z - 0.5));
  let wx = quadratic_weights(p_grid.x - f32(base_x));
  let wy = quadratic_weights(p_grid.y - f32(base_y));
  let wz = quadratic_weights(p_grid.z - f32(base_z));

  let row0 = mls_mechanics[mechanics_base];
  let row1 = mls_mechanics[mechanics_base + 1u];
  let row2 = mls_mechanics[mechanics_base + 2u];
  let row3 = mls_mechanics[mechanics_base + 3u];
  let row4 = mls_mechanics[mechanics_base + 4u];
  let row5 = mls_mechanics[mechanics_base + 5u];
  let row6 = mls_mechanics[mechanics_base + 6u];
  let row7 = mls_mechanics[mechanics_base + 7u];
  let thermo1 = sph_thermo[thermo_base + 1u];
  let f00 = row0.x; let f01 = row0.y; let f02 = row0.z;
  let f10 = row0.w; let f11 = row1.x; let f12 = row1.y;
  let f20 = row1.z; let f21 = row1.w; let f22 = row2.x;
  let c00 = row2.y; let c01 = row2.z; let c02 = row2.w;
  let c10 = row3.x; let c11 = row3.y; let c12 = row3.z;
  let c20 = row3.w; let c21 = row4.x; let c22 = row4.y;
  // Current volume is authoritative only when both stored V0 and J are
  // finite-positive. Do not manufacture a pressure volume by clamping an
  // invalid determinant.
  let volume = select(
    0.0,
    row4.w * row4.z,
    row4.w > 0.0 && row4.z > 0.0
  );
  var resolved_absolute_pressure_pa = max(params.ambient_pressure_pa, 0.0);
  var sigma = StressRows(vec3<f32>(0.0), vec3<f32>(0.0), vec3<f32>(0.0));
  if (volume > 0.0) {
    if (row5.x > 0.5 && row5.w > 0.0) {
      sigma = corotated_stress(
        f00, f01, f02,
        f10, f11, f12,
        f20, f21, f22,
        row5.w,
        row6.x
      );
      // Positive Cauchy trace is tensile in the corotated convention, so the
      // scalar mechanical pressure is -tr(sigma)/3.
      resolved_absolute_pressure_pa = max(
        0.0,
        params.ambient_pressure_pa
          - (sigma.x.x + sigma.y.y + sigma.z.z) / 3.0
      );
    } else {
      let density = pos_mass.w / max(volume, 1.0e-30);
      // Pressure comes from the EOS via the tracked volume ratio J only. The
      // per-particle static hydrostatic prestress (row7.x) is intentionally
      // NOT added: a depth-frozen pressure field becomes unbalanced as soon
      // as particles circulate and pumps energy into the liquid.
      // On a vaporization plateau the growing gas fraction exerts a reduced-
      // speed isothermal gas pressure. row6.y is the material sound speed
      // after the host's acoustic-CFL reduction, so admitted gas must use it
      // just like every other packed EOS. Bypassing it with P_atm/rho_rest
      // silently restored the physical sound speed and made the explicit
      // mechanics step unstable.
      //
      // rho_reference scales the standard-atmosphere rest density to the
      // configured ambient pressure. This preserves zero gauge pressure at
      // rho_rest under one atmosphere while making the stiffness c^2 and
      // therefore convergent toward the physical EOS as dt is refined.
      let gas_fraction = clamp(thermo1.z, 0.0, 1.0);
      let gas_reference_density = thermo0.w * params.ambient_pressure_pa / 101325.0;
      let gas_partial_pressure = row6.y * row6.y * (density - gas_reference_density);
      let packed_material_pressure = packed_pressure(density, thermo0.w, row6.y, row6.z);
      let gas_eos = row6.z > 1.5 && row6.z < 2.5;
      // Admitted gas uses the ambient-referenced branch; the packed bounded
      // branch remains available for positionless product-event sidecars that
      // do not carry the ambient-pressure inputs yet.
      let pressure = params.internal_pressure_scale * select(
        packed_material_pressure,
        gas_fraction * gas_partial_pressure,
        gas_eos
      );
      resolved_absolute_pressure_pa = max(
        0.0,
        params.ambient_pressure_pa + pressure
      );
      // row7.y is the material's PHYSICAL shear viscosity. Artificial
      // viscosity is deliberately not folded into it: the deviatoric terms
      // below are traceless, so anything added to row7.y resists shear and
      // does nothing in compression -- the exact opposite of what a
      // shock-stabilizing artificial viscosity is for. Folding alpha*rho*c*h
      // into it gave water ~2000 Pa.s of shear viscosity against a physical
      // 0.001, roughly two million times too much: thicker than molasses,
      // which is why liquids crept instead of flowing.
      let dynamic_viscosity = max(row7.y, 0.0);
      let div_third = (c00 + c11 + c22) / 3.0;
      // The artificial term therefore appears here, as a bulk pressure gated
      // on compression: zeta = alpha * rho * c * h, p = -zeta * div(v) when
      // div(v) < 0. It damps acoustic oscillation without opposing shear.
      //
      // It is deliberately NOT folded into resolved_absolute_pressure_pa
      // above: that lane carries thermodynamic pressure authority, and a
      // numerical stabilizer is not a physical pressure.
      let velocity_divergence = 3.0 * div_third;
      let artificial_bulk_viscosity = ARTIFICIAL_BULK_VISCOSITY_ALPHA
        * density
        * max(row6.y, 0.0)
        * params.grid_spacing_m;
      let artificial_bulk_pressure = select(
        0.0,
        -artificial_bulk_viscosity * velocity_divergence,
        velocity_divergence < 0.0
      );
      let total_pressure = pressure + artificial_bulk_pressure;
      let visc00 = 2.0 * dynamic_viscosity * (c00 - div_third);
      let visc11 = 2.0 * dynamic_viscosity * (c11 - div_third);
      let visc22 = 2.0 * dynamic_viscosity * (c22 - div_third);
      let visc01 = dynamic_viscosity * (c01 + c10);
      let visc02 = dynamic_viscosity * (c02 + c20);
      let visc12 = dynamic_viscosity * (c12 + c21);
      sigma = StressRows(
        vec3<f32>(-total_pressure + visc00, visc01, visc02),
        vec3<f32>(visc01, -total_pressure + visc11, visc12),
        vec3<f32>(visc02, visc12, -total_pressure + visc22)
      );
    }
    if (params.external_gauge_pressure_enabled != 0u) {
      // The interface gas load is an external boundary traction. Internal EOS
      // pressure is represented by -pI and expands a free body in this P2G
      // weak form; the equivalent inward gas traction therefore adds +pI.
      // solid+liquid excludes gas and plasma while remaining continuous
      // through a phase transition.
      let condensed_fraction = clamp(thermo1.x + thermo1.y, 0.0, 1.0);
      let external_pressure = params.external_gauge_pressure_pa * condensed_fraction;
      sigma = StressRows(
        sigma.x + vec3<f32>(external_pressure, 0.0, 0.0),
        sigma.y + vec3<f32>(0.0, external_pressure, 0.0),
        sigma.z + vec3<f32>(0.0, 0.0, external_pressure)
      );
    }
  }
  let stress_scale = -params.dt * volume * 4.0 * params.inv_grid_spacing_m * params.inv_grid_spacing_m;
  let aff_x = vec3<f32>(
    pos_mass.w * c00 + stress_scale * sigma.x.x,
    pos_mass.w * c01 + stress_scale * sigma.x.y,
    pos_mass.w * c02 + stress_scale * sigma.x.z
  );
  let aff_y = vec3<f32>(
    pos_mass.w * c10 + stress_scale * sigma.y.x,
    pos_mass.w * c11 + stress_scale * sigma.y.y,
    pos_mass.w * c12 + stress_scale * sigma.y.z
  );
  let aff_z = vec3<f32>(
    pos_mass.w * c20 + stress_scale * sigma.z.x,
    pos_mass.w * c21 + stress_scale * sigma.z.y,
    pos_mass.w * c22 + stress_scale * sigma.z.z
  );

  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let node_i = base_x + ox;
        let node_j = base_y + oy;
        let node_k = base_z + oz;
        let node_index = p2g_try_storage_index(node_i, node_j, node_k);
        if (node_index >= params.grid_node_count) {
          continue;
        }
        let weight = p2g_weight_at(wx, ox) * p2g_weight_at(wy, oy) * p2g_weight_at(wz, oz);
        if (weight == 0.0) {
          continue;
        }
        let node_pos = vec3<f32>(
          f32(node_i) * params.grid_spacing_m,
          f32(node_j) * params.grid_spacing_m,
          f32(node_k) * params.grid_spacing_m
        );
        let dpos = node_pos - pos_mass.xyz;
        let affine_momentum = vec3<f32>(
          dot(aff_x, dpos),
          dot(aff_y, dpos),
          dot(aff_z, dpos)
        );
        let particle_momentum = pos_mass.w * vel_u.xyz + affine_momentum;
        p2g_atomic_add(node_index, weight * pos_mass.w, weight * particle_momentum);
      }
    }
  }
}

@compute @workgroup_size(64)
fn scatter_product_events(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let event_index = global_id.x;
  if (event_index >= params.resident_product_event_count) {
    return;
  }

  let event0 = product_event_row0(event_index);
  let event3 = product_event_row3(event_index);
  let event4 = product_event_row4(event_index);
  let event5 = product_event_row5(event_index);
  let event6 = product_event_row6(event_index);
  let event7 = product_event_row7(event_index);
  let event_unplaced_mass_kg = event3.y;
  let event_status = event4.z;
  if (event_status != 1.0 || event_unplaced_mass_kg <= 0.0) {
    return;
  }

  let event_grid = event0.xyz * params.inv_grid_spacing_m;
  let base_x = i32(floor(event_grid.x - 0.5));
  let base_y = i32(floor(event_grid.y - 0.5));
  let base_z = i32(floor(event_grid.z - 0.5));
  let wx = quadratic_weights(event_grid.x - f32(base_x));
  let wy = quadratic_weights(event_grid.y - f32(base_y));
  let wz = quadratic_weights(event_grid.z - f32(base_z));
  let support_volume_m3 = max(event5.w, 0.0);
  let rest_density_kg_per_m3 = event4.y;
  let sound_speed_m_per_s = event6.w;
  let eos_model_id = event7.x;

  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let node_i = base_x + ox;
        let node_j = base_y + oy;
        let node_k = base_z + oz;
        let node_index = p2g_try_storage_index(node_i, node_j, node_k);
        if (node_index >= params.grid_node_count) {
          continue;
        }
        let weight = p2g_weight_at(wx, ox) * p2g_weight_at(wy, oy) * p2g_weight_at(wz, oz);
        if (weight == 0.0) {
          continue;
        }
        var pressure_affine = vec3<f32>(0.0);
        if (params.dt != 0.0 && support_volume_m3 > 0.0) {
          let event_density = event_unplaced_mass_kg / max(support_volume_m3, 1.0e-30);
          let event_pressure = params.internal_pressure_scale * packed_pressure(
            event_density,
            rest_density_kg_per_m3,
            sound_speed_m_per_s,
            eos_model_id
          );
          let event_stress_scale = -params.dt * support_volume_m3 * 4.0 * params.inv_grid_spacing_m * params.inv_grid_spacing_m;
          let diagonal_affine = event_stress_scale * -event_pressure;
          let node_pos = vec3<f32>(
            f32(node_i) * params.grid_spacing_m,
            f32(node_j) * params.grid_spacing_m,
            f32(node_k) * params.grid_spacing_m
          );
          let event_dpos = node_pos - event0.xyz;
          pressure_affine = vec3<f32>(
            diagonal_affine * event_dpos.x,
            diagonal_affine * event_dpos.y,
            diagonal_affine * event_dpos.z
          );
        }
        p2g_atomic_add(
          node_index,
          weight * event_unplaced_mass_kg,
          weight * (event_unplaced_mass_kg * event5.xyz + pressure_affine)
        );
      }
    }
  }
}

@compute @workgroup_size(64)
fn finalize_grid(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let node_index = p2g_finalize_node_index(global_id.x);
  if (node_index >= params.grid_node_count) {
    return;
  }

  let accumulator_base = node_index * 4u;
  let mass = f32(atomicLoad(&grid_accumulators[accumulator_base])) * P2G_ATOMIC_INV_SCALE;
  let momentum = vec3<f32>(
    f32(atomicLoad(&grid_accumulators[accumulator_base + 1u])) * P2G_ATOMIC_INV_SCALE,
    f32(atomicLoad(&grid_accumulators[accumulator_base + 2u])) * P2G_ATOMIC_INV_SCALE,
    f32(atomicLoad(&grid_accumulators[accumulator_base + 3u])) * P2G_ATOMIC_INV_SCALE
  );

  let plane = params.grid_ny * params.grid_nz;
  let i = node_index / plane;
  let rem = node_index - i * plane;
  let j = rem / params.grid_nz;
  let k = rem - j * params.grid_nz;
  let node_i = i32(i) - i32(params.shift);
  let node_j = i32(j) - i32(params.shift);
  let node_k = i32(k) - i32(params.shift);
  let node_pos = vec3<f32>(
    f32(node_i) * params.grid_spacing_m,
    f32(node_j) * params.grid_spacing_m,
    f32(node_k) * params.grid_spacing_m
  );

  let status = select(0.0, 1.0, mass > 0.0);
  grid_nodes[node_index * 2u] = vec4<f32>(mass, momentum.x, momentum.y, momentum.z);
  grid_nodes[node_index * 2u + 1u] = vec4<f32>(node_pos.x, node_pos.y, node_pos.z, status);
}
`;

export const mlsMpmGridUpdateWgsl = `
struct GridUpdateParams {
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  shift: u32,
  pressure_force_row_count: u32,
  pad_u1: u32,
  pad_u2: u32,
  grid_spacing_m: f32,
  dt: f32,
  gravity_x: f32,
  gravity_y: f32,
  gravity_z: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  cfl_factor: f32,
  wall_barrier_elastic_stiffness_n_per_m: f32,
  wall_barrier_contact_scale: f32,
  wall_barrier_min_gap_m: f32,
};

@group(0) @binding(0) var<storage, read> p2g_grid_nodes: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> updated_grid_nodes: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: GridUpdateParams;
@group(0) @binding(3) var<storage, read> pressure_force_rows: array<vec4<f32>>;

fn grid_update_quadratic_weights(fx: f32) -> vec3<f32> {
  let a = 1.5 - fx;
  let b = fx - 1.0;
  let c = fx - 0.5;
  return vec3<f32>(0.5 * a * a, 0.75 - b * b, 0.5 * c * c);
}

fn grid_update_weight_at(weights: vec3<f32>, offset: i32) -> f32 {
  if (offset == 0) { return weights.x; }
  if (offset == 1) { return weights.y; }
  if (offset == 2) { return weights.z; }
  return 0.0;
}

fn grid_update_clamp01(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn wall_barrier_response_alpha(node_mass_kg: f32, gap_m: f32) -> f32 {
  let min_gap_m = max(1.0e-12, abs(params.wall_barrier_min_gap_m));
  let effective_gap_m = max(max(gap_m, 0.0), min_gap_m);
  let barrier_normal_stiffness = select(0.0, node_mass_kg / (effective_gap_m * effective_gap_m), node_mass_kg > 0.0);
  let normal_stiffness = max(0.0, barrier_normal_stiffness + max(params.wall_barrier_elastic_stiffness_n_per_m, 0.0));
  let stiffness_ratio = select(0.0, normal_stiffness * params.dt * params.dt / node_mass_kg, node_mass_kg > 0.0 && params.dt > 0.0);
  return grid_update_clamp01((stiffness_ratio / (1.0 + stiffness_ratio)) * grid_update_clamp01(params.wall_barrier_contact_scale));
}

fn wall_barrier_corrected_normal_velocity(normal_velocity_m_per_s: f32, node_mass_kg: f32, gap_m: f32) -> f32 {
  let response_alpha = wall_barrier_response_alpha(node_mass_kg, gap_m);
  let inward_velocity_m_per_s = max(0.0, -normal_velocity_m_per_s);
  var corrected_normal_velocity_m_per_s = normal_velocity_m_per_s + inward_velocity_m_per_s * response_alpha;
  if (response_alpha >= 1.0 - 1.0e-6 && corrected_normal_velocity_m_per_s < 1.0e-6 && normal_velocity_m_per_s < 0.0) {
    corrected_normal_velocity_m_per_s = 0.0;
  }
  return corrected_normal_velocity_m_per_s;
}

fn grid_update_clamp_velocity_to_speed(
  velocity: vec3<f32>,
  max_speed_m_per_s: f32
) -> vec3<f32> {
  // Squaring an otherwise finite f32 velocity can overflow. Comparing
  // dot(v,v) with vmax*vmax then degenerates to inf > inf == false and
  // silently bypasses the CFL bound. Normalize by the largest component
  // first so the only squared norm is in [0, 3].
  let finite_velocity = all(vec3<bool>(
    (bitcast<u32>(velocity.x) & 0x7fffffffu) < 0x7f800000u,
    (bitcast<u32>(velocity.y) & 0x7fffffffu) < 0x7f800000u,
    (bitcast<u32>(velocity.z) & 0x7fffffffu) < 0x7f800000u
  ));
  let finite_cap =
    (bitcast<u32>(max_speed_m_per_s) & 0x7fffffffu) < 0x7f800000u;
  if (!finite_velocity || !finite_cap || !(max_speed_m_per_s > 0.0)) {
    return vec3<f32>(0.0);
  }
  // Leave a 2^-16 relative debit for division, normalization, and the final
  // multiply. The reaction motion envelope uses the unguarded CFL distance,
  // so this makes the published velocity strictly conservative.
  let guarded_max_speed = max_speed_m_per_s * 0.9999847412109375;
  if (!(guarded_max_speed > 0.0)) {
    return vec3<f32>(0.0);
  }
  let largest_component = max(
    max(abs(velocity.x), abs(velocity.y)),
    abs(velocity.z)
  );
  if (largest_component > 0.0) {
    let largest_bits = bitcast<u32>(largest_component);
    if (largest_bits < 0x00800000u || largest_bits > 0x7e800000u) {
      return vec3<f32>(0.0);
    }
    let scaled_velocity = velocity / largest_component;
    let scaled_length = length(scaled_velocity);
    if (
      !((bitcast<u32>(scaled_length) & 0x7fffffffu) < 0x7f800000u)
      || !(scaled_length > 0.0)
    ) {
      return vec3<f32>(0.0);
    }
    if (largest_component > guarded_max_speed / scaled_length) {
      return scaled_velocity * (guarded_max_speed / scaled_length);
    }
  }
  return velocity;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let node_index = global_id.x;
  if (node_index >= params.grid_node_count) {
    return;
  }

  let row0 = p2g_grid_nodes[node_index * 2u];
  let row1 = p2g_grid_nodes[node_index * 2u + 1u];
  let mass = row0.x;
  var momentum = row0.yzw;
  let node_i = i32(round(row1.x / max(params.grid_spacing_m, 1.0e-12)));
  let node_j = i32(round(row1.y / max(params.grid_spacing_m, 1.0e-12)));
  let node_k = i32(round(row1.z / max(params.grid_spacing_m, 1.0e-12)));

  if (mass > 0.0) {
    for (var force_index = 0u; force_index < params.pressure_force_row_count; force_index = force_index + 1u) {
      let force_row1 = pressure_force_rows[force_index * 4u + 1u];
      let force_row2 = pressure_force_rows[force_index * 4u + 2u];
      let force_row3 = pressure_force_rows[force_index * 4u + 3u];
      if (force_row3.w <= 0.0) {
        continue;
      }
      let force_grid = force_row1.xyz / max(params.grid_spacing_m, 1.0e-12);
      let base_x = i32(floor(force_grid.x - 0.5));
      let base_y = i32(floor(force_grid.y - 0.5));
      let base_z = i32(floor(force_grid.z - 0.5));
      let ox = node_i - base_x;
      let oy = node_j - base_y;
      let oz = node_k - base_z;
      if (ox < 0 || ox > 2 || oy < 0 || oy > 2 || oz < 0 || oz > 2) {
        continue;
      }
      let wx = grid_update_quadratic_weights(force_grid.x - f32(base_x));
      let wy = grid_update_quadratic_weights(force_grid.y - f32(base_y));
      let wz = grid_update_quadratic_weights(force_grid.z - f32(base_z));
      let weight = grid_update_weight_at(wx, ox) * grid_update_weight_at(wy, oy) * grid_update_weight_at(wz, oz);
      momentum = momentum + params.dt * weight * force_row2.xyz;
    }
  }

  var velocity = vec3<f32>(0.0, 0.0, 0.0);
  var status = 0.0;

  if (mass > 0.0) {
    velocity = momentum / mass + vec3<f32>(params.gravity_x, params.gravity_y, params.gravity_z) * params.dt;
    let vmax = params.cfl_factor * params.grid_spacing_m / max(params.dt, 1.0e-12);
    velocity = grid_update_clamp_velocity_to_speed(velocity, vmax);
    let node_pos = row1.xyz;
    let boundary_epsilon_m = max(1.0e-7, abs(params.grid_spacing_m) * 1.0e-6);
    let floor_no_slip_limit_m = params.grid_spacing_m - boundary_epsilon_m;
    if (node_pos.y < floor_no_slip_limit_m) {
      let floor_gap_m = max(0.0, node_pos.y);
      // Free-slip floor: only the normal component is corrected, matching the
      // x/z walls. Grid-level tangential kill created a one-cell-thick
      // artificial boundary layer that froze liquid spreading (dam-break
      // fronts crept at ~0.1 m/s); near-wall dissipation is handled by the
      // tunable liquid wall damping in G2P instead.
      velocity.y = wall_barrier_corrected_normal_velocity(velocity.y, mass, floor_gap_m);
    }
    if (node_pos.x <= params.grid_spacing_m + boundary_epsilon_m && velocity.x < 0.0) {
      velocity.x = wall_barrier_corrected_normal_velocity(
        velocity.x,
        mass,
        max(0.0, node_pos.x - params.grid_spacing_m + boundary_epsilon_m)
      );
    }
    if (node_pos.x >= params.box_x - params.grid_spacing_m - boundary_epsilon_m && velocity.x > 0.0) {
      velocity.x = -wall_barrier_corrected_normal_velocity(
        -velocity.x,
        mass,
        max(0.0, params.box_x - params.grid_spacing_m - node_pos.x + boundary_epsilon_m)
      );
    }
    if (node_pos.y >= params.box_y - params.grid_spacing_m - boundary_epsilon_m && velocity.y > 0.0) {
      velocity.y = -wall_barrier_corrected_normal_velocity(
        -velocity.y,
        mass,
        max(0.0, params.box_y - params.grid_spacing_m - node_pos.y + boundary_epsilon_m)
      );
    }
    if (node_pos.z <= params.grid_spacing_m + boundary_epsilon_m && velocity.z < 0.0) {
      velocity.z = wall_barrier_corrected_normal_velocity(
        velocity.z,
        mass,
        max(0.0, node_pos.z - params.grid_spacing_m + boundary_epsilon_m)
      );
    }
    if (node_pos.z >= params.box_z - params.grid_spacing_m - boundary_epsilon_m && velocity.z > 0.0) {
      velocity.z = -wall_barrier_corrected_normal_velocity(
        -velocity.z,
        mass,
        max(0.0, params.box_z - params.grid_spacing_m - node_pos.z + boundary_epsilon_m)
      );
    }
    velocity = grid_update_clamp_velocity_to_speed(velocity, vmax);
    status = 1.0;
  }

  updated_grid_nodes[node_index * 2u] = vec4<f32>(mass, velocity.x, velocity.y, velocity.z);
  updated_grid_nodes[node_index * 2u + 1u] = vec4<f32>(row1.x, row1.y, row1.z, status);
}
`;

export const sphPressureInterfaceForceRowsWgsl = `
struct PressureInterfaceParams {
  element_count: u32,
  pressure_pa: f32,
  gas_pressure_cell_count: u32,
  pressure_model_id: u32,
  contact_policy_row_count: u32,
  contact_response_scale: f32,
  contact_max_pressure_pa: f32,
  contact_pair_response_enabled: f32,
  gas_authority_execution_generation: u32,
  gas_authority_storage_generation: u32,
  gas_pressure_cell_capacity: u32,
  gas_pressure_cell_stride_floats: u32,
};

@group(0) @binding(0) var<storage, read> interface_elements: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> pressure_force_rows: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: PressureInterfaceParams;
@group(0) @binding(3) var<storage, read> gas_pressure_cells: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> contact_policy_rows: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> contact_kinematics_rows: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> gas_authority_control: array<u32>;

const GAS_AUTHORITY_MAGIC: u32 = 0x53474133u;
const GAS_AUTHORITY_VERSION: u32 = 3u;
const GAS_AUTHORITY_REQUIRED_READY: u32 = 31u;
const GAS_AUTHORITY_EMPTY: u32 = 32u;
const GAS_AUTHORITY_FAILED: u32 = 0x80000000u;
const GAS_AUTHORITY_UNKNOWN_STATUS_MASK: u32 = 0x7fffffc0u;
const GAS_AUTHORITY_INVALID_COUNT: u32 = 0xffffffffu;
const GAS_AUTHORITY_F32_MAX: f32 = 3.402823466e38;

fn authenticated_gas_pressure_cell_count() -> u32 {
  if (
    params.pressure_model_id != 2u
    || arrayLength(&gas_authority_control) < 32u
    || gas_authority_control[0u] != GAS_AUTHORITY_MAGIC
    || gas_authority_control[1u] != GAS_AUTHORITY_VERSION
    || (gas_authority_control[2u] & GAS_AUTHORITY_REQUIRED_READY)
      != GAS_AUTHORITY_REQUIRED_READY
    || (gas_authority_control[2u] & GAS_AUTHORITY_FAILED) != 0u
    || (gas_authority_control[2u] & GAS_AUTHORITY_UNKNOWN_STATUS_MASK) != 0u
    || gas_authority_control[3u] != 0u
    || gas_authority_control[4u] != params.gas_authority_execution_generation
    || gas_authority_control[5u] != params.gas_authority_execution_generation
    || gas_authority_control[6u] != params.gas_authority_storage_generation
    || gas_authority_control[7u] != params.gas_pressure_cell_capacity
    || gas_authority_control[30u] != params.gas_pressure_cell_stride_floats
    || gas_authority_control[31u] != gas_authority_control[10u]
    || params.gas_pressure_cell_stride_floats != 12u
    || params.gas_pressure_cell_capacity > 0x55555555u
    || arrayLength(&gas_pressure_cells) < params.gas_pressure_cell_capacity * 3u
  ) {
    return GAS_AUTHORITY_INVALID_COUNT;
  }
  let live_count = gas_authority_control[8u];
  let directory_generation = gas_authority_control[9u];
  let directory_cell_count = gas_authority_control[10u];
  let ready_pressure_count = gas_authority_control[11u];
  let empty = (gas_authority_control[2u] & GAS_AUTHORITY_EMPTY) != 0u;
  if (
    live_count > params.gas_pressure_cell_capacity
    || directory_generation == 0u
    || directory_cell_count > live_count
    || ready_pressure_count != directory_cell_count
    || (empty && (live_count != 0u || directory_cell_count != 0u))
    || (!empty && (live_count == 0u || directory_cell_count == 0u))
  ) {
    return GAS_AUTHORITY_INVALID_COUNT;
  }
  return ready_pressure_count;
}

fn pressure_for_centroid(centroid: vec3<f32>) -> vec2<f32> {
  if (params.pressure_model_id == 0u) {
    return vec2<f32>(params.pressure_pa, 1.0);
  }
  var pressure_cell_count = params.gas_pressure_cell_count;
  if (params.pressure_model_id == 2u) {
    pressure_cell_count = authenticated_gas_pressure_cell_count();
    if (pressure_cell_count == GAS_AUTHORITY_INVALID_COUNT) {
      return vec2<f32>(0.0, 0.0);
    }
  } else if (params.pressure_model_id != 1u) {
    return vec2<f32>(params.pressure_pa, 1.0);
  }
  if (pressure_cell_count == 0u) {
    return vec2<f32>(
      select(params.pressure_pa, 0.0, params.pressure_model_id == 2u),
      1.0
    );
  }
  var best_pressure = select(
    params.pressure_pa,
    0.0,
    params.pressure_model_id == 2u
  );
  var best_distance2 = 1.0e30;
  var usable_pressure_cell_count = 0u;
  for (var cell_index = 0u; cell_index < pressure_cell_count; cell_index = cell_index + 1u) {
    let row0 = gas_pressure_cells[cell_index * 3u];
    let row1 = gas_pressure_cells[cell_index * 3u + 1u];
    let row2 = gas_pressure_cells[cell_index * 3u + 2u];
    let finite_row = all(abs(row1) <= vec4<f32>(GAS_AUTHORITY_F32_MAX))
      && all(abs(row2.xyz) <= vec3<f32>(GAS_AUTHORITY_F32_MAX));
    if (row0.w > 0.0 && row1.w >= 0.0 && finite_row) {
      let delta = centroid - row1.xyz;
      let distance2 = dot(delta, delta);
      let local_pressure = row1.w + dot(row2.xyz, delta);
      let finite_sample = abs(distance2) <= GAS_AUTHORITY_F32_MAX
        && abs(local_pressure) <= GAS_AUTHORITY_F32_MAX;
      if (finite_sample) {
        usable_pressure_cell_count = usable_pressure_cell_count + 1u;
      }
      if (finite_sample && distance2 < best_distance2) {
        best_distance2 = distance2;
        best_pressure = max(0.0, local_pressure);
      }
    }
  }
  let pressure_sample_valid = params.pressure_model_id != 2u
    || usable_pressure_cell_count > 0u;
  return vec2<f32>(best_pressure, select(0.0, 1.0, pressure_sample_valid));
}

fn contact_policy_element_side(row_index: u32, material_id: f32, phase_id: f32) -> u32 {
  let row0 = contact_policy_rows[row_index * 4u];
  let row2 = contact_policy_rows[row_index * 4u + 2u];
  if (row2.y <= 0.0) {
    return 0u;
  }
  let endpoint_a_match = abs(material_id - row0.x) < 0.5
    && (row0.z <= 0.5 || abs(phase_id - row0.z) < 0.5);
  let endpoint_b_match = abs(material_id - row0.y) < 0.5
    && (row0.w <= 0.5 || abs(phase_id - row0.w) < 0.5);
  let exact_phase_a = row0.z > 0.5 && abs(phase_id - row0.z) < 0.5;
  let exact_phase_b = row0.w > 0.5 && abs(phase_id - row0.w) < 0.5;
  if (endpoint_a_match && endpoint_b_match && exact_phase_b && !exact_phase_a) {
    return 2u;
  }
  if (endpoint_a_match) {
    return 1u;
  }
  return select(0u, 2u, endpoint_b_match);
}

fn contact_policy_matches_element(row_index: u32, material_id: f32, phase_id: f32) -> bool {
  return contact_policy_element_side(row_index, material_id, phase_id) != 0u;
}

fn contact_domain_pair_matches(policy_identity: vec4<f32>, element_identity: vec4<f32>) -> bool {
  if (policy_identity.w <= 0.5 || element_identity.z <= 0.5) {
    return false;
  }
  return (abs(policy_identity.x - element_identity.x) < 0.5
      && abs(policy_identity.y - element_identity.y) < 0.5)
    || (abs(policy_identity.x - element_identity.y) < 0.5
      && abs(policy_identity.y - element_identity.x) < 0.5);
}

fn contact_selected_domain_pair_matches(
  policy_identity: vec4<f32>,
  element_identity: vec4<f32>,
  element_side: u32
) -> bool {
  if (policy_identity.z <= 0.5) {
    return true;
  }
  if (policy_identity.w <= 0.5 || element_identity.z <= 0.5) {
    return false;
  }
  let expected_source_domain = select(policy_identity.y, policy_identity.x, element_side == 1u);
  let expected_target_domain = select(policy_identity.x, policy_identity.y, element_side == 1u);
  return abs(expected_source_domain - element_identity.x) < 0.5
    && abs(expected_target_domain - element_identity.y) < 0.5;
}

fn contact_pressure_for_policy_row(row_index: u32, area_m2: f32, kinematics: vec4<f32>) -> f32 {
  let row1 = contact_policy_rows[row_index * 4u + 1u];
  let row2 = contact_policy_rows[row_index * 4u + 2u];
  let support_radius_m = max(row1.z, 1.0e-6);
  let gap_m = max(kinematics.x, 0.0);
  let normal_velocity_m_per_s = kinematics.y;
  let closing_speed_m_per_s = max(-normal_velocity_m_per_s, 0.0);
  if (gap_m > support_radius_m && (closing_speed_m_per_s <= 0.0 || gap_m > support_radius_m * 2.0)) {
    return 0.0;
  }
  let effective_gap_m = max(gap_m, max(support_radius_m * 0.001, 1.0e-9));
  let proximity = clamp((support_radius_m - gap_m) / support_radius_m, 0.0, 1.0);
  let barrier_gain = proximity * min((support_radius_m / effective_gap_m) * (support_radius_m / effective_gap_m), 1000000.0);
  let elastic_pressure_pa = max(row1.x, 0.0) * max(row1.w, 0.0) * barrier_gain;
  let damping_pressure_pa = max(row1.y, 0.0) * closing_speed_m_per_s / support_radius_m;
  var inertial_pressure_pa = 0.0;
  if (kinematics.z > 0.0 && area_m2 > 0.0 && closing_speed_m_per_s > 0.0) {
    inertial_pressure_pa = kinematics.z * closing_speed_m_per_s * closing_speed_m_per_s / max(area_m2 * effective_gap_m, 1.0e-12);
  }
  var row_cap_pa = params.contact_max_pressure_pa;
  if (row2.x > 0.0) {
    row_cap_pa = min(row2.x, params.contact_max_pressure_pa);
  }
  return min(
    max(elastic_pressure_pa + damping_pressure_pa + inertial_pressure_pa, 0.0),
    row_cap_pa
  );
}

fn contact_pressure_for_element(
  material_id: f32,
  phase_id: f32,
  area_m2: f32,
  kinematics: vec4<f32>,
  element_identity: vec4<f32>
) -> f32 {
  if (params.contact_pair_response_enabled <= 0.0 || params.contact_policy_row_count == 0u) {
    return 0.0;
  }
  if (kinematics.w != kinematics.w) {
    return 0.0;
  }
  // Exact-near and resident GPU derivations carry the selected policy as a
  // one-based token in element_identity.w.  Once present it is authoritative:
  // never reselect a different row or fall back after a malformed token.
  let selected_policy_token = element_identity.w;
  if (kinematics.w == 2.0) {
    if (
      selected_policy_token != selected_policy_token
      || abs(selected_policy_token) > 16777216.0
    ) {
      return 0.0;
    }
    if (
      selected_policy_token != trunc(selected_policy_token)
      || selected_policy_token < 1.0
      || selected_policy_token > f32(params.contact_policy_row_count)
    ) {
      return 0.0;
    }
    let selected_policy_row = u32(selected_policy_token) - 1u;
    let selected_element_side = contact_policy_element_side(
      selected_policy_row,
      material_id,
      phase_id
    );
    if (selected_element_side == 0u) {
      return 0.0;
    }
    let selected_policy_identity = contact_policy_rows[selected_policy_row * 4u + 3u];
    if (!contact_selected_domain_pair_matches(
      selected_policy_identity,
      element_identity,
      selected_element_side
    )) {
      return 0.0;
    }
    return contact_pressure_for_policy_row(selected_policy_row, area_m2, kinematics);
  }
  if (
    kinematics.w != 1.0
    || selected_policy_token != selected_policy_token
    || selected_policy_token != 0.0
  ) {
    return 0.0;
  }
  var generic_row = 4294967295u;
  var generic_count = 0u;
  var exact_domain_row = 4294967295u;
  var exact_domain_count = 0u;
  for (var row_index = 0u; row_index < params.contact_policy_row_count; row_index = row_index + 1u) {
    if (!contact_policy_matches_element(row_index, material_id, phase_id)) {
      continue;
    }
    let policy_identity = contact_policy_rows[row_index * 4u + 3u];
    let body_specific = policy_identity.z > 0.5;
    if (!body_specific) {
      if (generic_count == 0u) {
        generic_row = row_index;
      }
      generic_count = generic_count + 1u;
    } else if (contact_domain_pair_matches(policy_identity, element_identity)) {
      if (exact_domain_count == 0u) {
        exact_domain_row = row_index;
      }
      exact_domain_count = exact_domain_count + 1u;
    }
  }

  var selected_row = 4294967295u;
  if (element_identity.z > 0.5 && exact_domain_count == 1u) {
    selected_row = exact_domain_row;
  } else if (generic_count > 0u) {
    // A missing pair, no exact pair, or an ambiguous exact pair may use only
    // an explicit generic material/phase fallback. Never silently select one
    // of several body-specific rows.
    selected_row = generic_row;
  }
  if (selected_row == 4294967295u) {
    return 0.0;
  }
  return contact_pressure_for_policy_row(selected_row, area_m2, kinematics);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let element_index = global_id.x;
  if (element_index >= params.element_count) {
    return;
  }

  let row0 = interface_elements[element_index * 4u];
  let row1 = interface_elements[element_index * 4u + 1u];
  let row2 = interface_elements[element_index * 4u + 2u];
  let row3 = interface_elements[element_index * 4u + 3u];
  let centroid = row1.xyz;
  let area = row1.w;
  let status = row3.w;
  // Gas/plasma carriers already receive this pressure through their EOS
  // stress. Feeding it back as traction on their own extracted surface would
  // double-count the same pressure, with a catastrophic area/mass ratio for
  // newly produced gas particles.
  let gas_pressure_sample = pressure_for_centroid(centroid);
  let gas_pressure_pa = select(
    gas_pressure_sample.x,
    0.0,
    row0.z == 3.0 || row0.z == 4.0
  );
  let contact_kinematics = contact_kinematics_rows[element_index * 2u];
  let contact_identity = contact_kinematics_rows[element_index * 2u + 1u];
  let contact_pressure_pa = contact_pressure_for_element(
    row0.y,
    row0.z,
    area,
    contact_kinematics,
    contact_identity
  );
  let pressure_pa = gas_pressure_pa + contact_pressure_pa;
  var normal_area = vec3<f32>(row2.w, row3.x, row3.y);
  if (dot(normal_area, normal_area) <= 1.0e-24) {
    normal_area = row2.xyz * area;
  }
  let gas_authority_or_contact_ready = params.pressure_model_id != 2u
    || gas_pressure_sample.y > 0.0
    || contact_pressure_pa > 0.0;
  let ready = select(
    0.0,
    1.0,
    status > 0.0
      && area > 0.0
      && pressure_pa >= 0.0
      && gas_authority_or_contact_ready
  );
  let material_force = -pressure_pa * normal_area * ready;
  let gas_reaction_force = -material_force;

  pressure_force_rows[element_index * 4u] = row0;
  pressure_force_rows[element_index * 4u + 1u] = vec4<f32>(row1.xyz, area);
  pressure_force_rows[element_index * 4u + 2u] = vec4<f32>(material_force, gas_reaction_force.x);
  pressure_force_rows[element_index * 4u + 3u] = vec4<f32>(gas_reaction_force.y, gas_reaction_force.z, pressure_pa, ready);
}
`;

export const sphPressureInterfaceParticleBinsWgsl = `
struct ParticleBinParams {
  particle_count: u32,
  cell_count: u32,
  bin_capacity: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  bins_enabled: u32,
  _pad0: u32,
  origin_x_m: f32,
  origin_y_m: f32,
  origin_z_m: f32,
  cell_size_m: f32,
  inv_cell_size_m: f32,
  box_x_m: f32,
  box_y_m: f32,
  box_z_m: f32,
};

@group(0) @binding(0) var<storage, read> particle_state_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> particle_bin_counts: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> particle_bin_indices: array<u32>;
@group(0) @binding(3) var<storage, read_write> particle_bin_metadata: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: ParticleBinParams;

fn particle_bin_state_row0(particle_index: u32) -> vec4<f32> {
  return particle_state_rows[particle_index * 2u];
}

fn particle_bin_clamp_coord(value: f32, axis_count: u32) -> u32 {
  if (axis_count <= 1u) {
    return 0u;
  }
  let raw = floor(value * params.inv_cell_size_m);
  let clamped = clamp(raw, 0.0, f32(axis_count - 1u));
  return u32(clamped);
}

fn particle_bin_cell_index(coords: vec3<u32>) -> u32 {
  return coords.x + coords.y * params.grid_nx + coords.z * params.grid_nx * params.grid_ny;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (
    params.bins_enabled == 0u
    || particle_index >= params.particle_count
    || params.cell_count == 0u
    || params.bin_capacity == 0u
    || params.cell_size_m <= 0.0
  ) {
    return;
  }
  let state0 = particle_bin_state_row0(particle_index);
  if (state0.w <= 0.0) {
    return;
  }
  let relative = state0.xyz - vec3<f32>(params.origin_x_m, params.origin_y_m, params.origin_z_m);
  let coords = vec3<u32>(
    particle_bin_clamp_coord(relative.x, params.grid_nx),
    particle_bin_clamp_coord(relative.y, params.grid_ny),
    particle_bin_clamp_coord(relative.z, params.grid_nz)
  );
  let cell_index = particle_bin_cell_index(coords);
  if (cell_index >= params.cell_count) {
    return;
  }
  let slot = atomicAdd(&particle_bin_counts[cell_index], 1u);
  if (slot < params.bin_capacity) {
    particle_bin_indices[cell_index * params.bin_capacity + slot] = particle_index;
  } else {
    atomicAdd(&particle_bin_metadata[0u], 1u);
  }
}
`;

export const sphPressureInterfaceContactKinematicsWgsl = `
struct ContactKinematicsParams {
  element_count: u32,
  particle_count: u32,
  contact_policy_row_count: u32,
  derivation_enabled: u32,
  particle_bin_grid_enabled: u32,
  particle_bin_cell_count: u32,
  particle_bin_capacity: u32,
  particle_bin_grid_nx: u32,
  particle_bin_grid_ny: u32,
  particle_bin_grid_nz: u32,
  max_search_radius_m: f32,
  gap_floor_m: f32,
  particle_bin_origin_x_m: f32,
  particle_bin_origin_y_m: f32,
  particle_bin_origin_z_m: f32,
  particle_bin_cell_size_m: f32,
};

struct SchroederContactLawQueueParams {
  enabled: u32,
  active_node_count: u32,
  law_queue_stride: u32,
  law_mask: u32,
};

struct SchroederContactLawNeighborParams {
  enabled: u32,
  candidate_count: u32,
  candidate_stride: u32,
  law_mask: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
  _pad3: u32,
};

struct SchroederContactSourceSpanParams {
  enabled: u32,
  source_span_count: u32,
  source_span_stride: u32,
  broad_candidate_fallback_enabled: u32,
};

struct InterfaceSourceKeyParams {
  enabled: u32,
  row_count: u32,
  row_stride: u32,
  surface_index_fallback_enabled: u32,
};

@group(0) @binding(0) var<storage, read> interface_elements: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> particle_state_rows: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> particle_thermo_rows: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> contact_policy_rows: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> contact_kinematics_rows: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> params: ContactKinematicsParams;
@group(0) @binding(6) var<storage, read> particle_bin_counts: array<u32>;
@group(0) @binding(7) var<storage, read> particle_bin_indices: array<u32>;
@group(0) @binding(8) var<storage, read> schroeder_contact_law_queue_rows: array<f32>;
@group(0) @binding(9) var<uniform> schroeder_contact_law_queue_params: SchroederContactLawQueueParams;
@group(0) @binding(10) var<storage, read> schroeder_contact_neighbor_candidate_rows: array<f32>;
@group(0) @binding(11) var<uniform> schroeder_contact_neighbor_candidate_params: SchroederContactLawNeighborParams;
@group(0) @binding(12) var<storage, read> schroeder_contact_source_span_rows: array<f32>;
@group(0) @binding(13) var<uniform> schroeder_contact_source_span_params: SchroederContactSourceSpanParams;
@group(0) @binding(14) var<storage, read> interface_source_key_rows: array<f32>;
@group(0) @binding(15) var<uniform> interface_source_key_params: InterfaceSourceKeyParams;
@group(0) @binding(16) var<storage, read> particle_identity: array<u32>;

const SCHROEDER_CONTACT_LAW_QUEUE_STRIDE: u32 = 32u;
const SCHROEDER_CONTACT_LAW_QUEUE_STATUS_OFFSET: u32 = 3u;
const SCHROEDER_CONTACT_LAW_QUEUE_LAW_MASK_OFFSET: u32 = 12u;
const SCHROEDER_CONTACT_LAW_QUEUE_CONTACT_ELIGIBLE_OFFSET: u32 = 14u;
const SCHROEDER_CONTACT_LAW_QUEUE_INTERFACE_ELIGIBLE_OFFSET: u32 = 15u;
const SCHROEDER_CONTACT_LAW_NEIGHBOR_STRIDE: u32 = 16u;
const SCHROEDER_CONTACT_LAW_NEIGHBOR_SOURCE_OFFSET: u32 = 0u;
const SCHROEDER_CONTACT_LAW_NEIGHBOR_NEIGHBOR_OFFSET: u32 = 1u;
const SCHROEDER_CONTACT_LAW_NEIGHBOR_LAW_MASK_OFFSET: u32 = 2u;
const SCHROEDER_CONTACT_LAW_NEIGHBOR_STATUS_OFFSET: u32 = 3u;
const SCHROEDER_CONTACT_LAW_NEIGHBOR_STATUS_READY: f32 = 1.0;
const SCHROEDER_CONTACT_SOURCE_SPAN_STRIDE: u32 = 4u;
const SCHROEDER_CONTACT_SOURCE_SPAN_SOURCE_OFFSET: u32 = 0u;
const SCHROEDER_CONTACT_SOURCE_SPAN_START_OFFSET: u32 = 1u;
const SCHROEDER_CONTACT_SOURCE_SPAN_COUNT_OFFSET: u32 = 2u;
const SCHROEDER_CONTACT_SOURCE_SPAN_STATUS_OFFSET: u32 = 3u;
const INTERFACE_SOURCE_KEY_STRIDE: u32 = 4u;
const INTERFACE_SOURCE_KEY_ELEMENT_OFFSET: u32 = 0u;
const INTERFACE_SOURCE_KEY_SOURCE_OFFSET: u32 = 1u;
const INTERFACE_SOURCE_KEY_STATUS_OFFSET: u32 = 2u;

struct CkParticleCandidate {
  source_match: u32,
  target_match: u32,
  signed_m: f32,
  lateral2: f32,
  velocity: vec3<f32>,
  mass_kg: f32,
};

fn ck_state_row0(particle_index: u32) -> vec4<f32> {
  return particle_state_rows[particle_index * 2u];
}

fn ck_state_row1(particle_index: u32) -> vec4<f32> {
  return particle_state_rows[particle_index * 2u + 1u];
}

fn ck_thermo_row0(particle_index: u32) -> vec4<f32> {
  return particle_thermo_rows[particle_index * 3u];
}

fn ck_thermo_row2(particle_index: u32) -> vec4<f32> {
  return particle_thermo_rows[particle_index * 3u + 2u];
}

fn ck_phase_matches(particle_phase_id: f32, required_phase_id: f32) -> bool {
  return required_phase_id <= 0.5 || abs(particle_phase_id - required_phase_id) < 0.5;
}

fn ck_schroeder_law_queue_enabled() -> bool {
  return schroeder_contact_law_queue_params.enabled != 0u
    && schroeder_contact_law_queue_params.active_node_count > 0u
    && schroeder_contact_law_queue_params.law_queue_stride > 0u
    && schroeder_contact_law_queue_params.law_mask != 0u;
}

fn ck_schroeder_law_queue_allows_particle(particle_index: u32) -> bool {
  if (!ck_schroeder_law_queue_enabled()) {
    return true;
  }
  if (particle_index >= schroeder_contact_law_queue_params.active_node_count) {
    return false;
  }
  let queue_stride = max(
    schroeder_contact_law_queue_params.law_queue_stride,
    SCHROEDER_CONTACT_LAW_QUEUE_STRIDE
  );
  let queue_offset = particle_index * queue_stride;
  let queue_status = schroeder_contact_law_queue_rows[
    queue_offset + SCHROEDER_CONTACT_LAW_QUEUE_STATUS_OFFSET
  ];
  let row_enabled = queue_status > 0.0 && queue_status < 32.0;
  let law_mask = u32(max(round(schroeder_contact_law_queue_rows[
    queue_offset + SCHROEDER_CONTACT_LAW_QUEUE_LAW_MASK_OFFSET
  ]), 0.0));
  let contact_eligible = schroeder_contact_law_queue_rows[
    queue_offset + SCHROEDER_CONTACT_LAW_QUEUE_CONTACT_ELIGIBLE_OFFSET
  ] > 0.5;
  let interface_eligible = schroeder_contact_law_queue_rows[
    queue_offset + SCHROEDER_CONTACT_LAW_QUEUE_INTERFACE_ELIGIBLE_OFFSET
  ] > 0.5;
  return row_enabled
    && (contact_eligible || interface_eligible)
    && ((law_mask & schroeder_contact_law_queue_params.law_mask) != 0u);
}

fn ck_schroeder_neighbor_candidates_enabled() -> bool {
  return schroeder_contact_neighbor_candidate_params.enabled != 0u
    && schroeder_contact_neighbor_candidate_params.candidate_count > 0u
    && schroeder_contact_neighbor_candidate_params.candidate_stride > 0u
    && schroeder_contact_neighbor_candidate_params.law_mask != 0u;
}

fn ck_schroeder_source_spans_enabled() -> bool {
  return ck_schroeder_neighbor_candidates_enabled()
    && schroeder_contact_source_span_params.enabled != 0u
    && schroeder_contact_source_span_params.source_span_count > 0u
    && schroeder_contact_source_span_params.source_span_stride > 0u;
}

fn ck_schroeder_candidate_span(source_particle_index: u32) -> vec4<u32> {
  if (!ck_schroeder_source_spans_enabled()
      || source_particle_index >= schroeder_contact_source_span_params.source_span_count) {
    return vec4<u32>(0u, 0u, 0u, 0u);
  }
  let span_stride = max(
    schroeder_contact_source_span_params.source_span_stride,
    SCHROEDER_CONTACT_SOURCE_SPAN_STRIDE
  );
  let span_offset = source_particle_index * span_stride;
  let status = schroeder_contact_source_span_rows[
    span_offset + SCHROEDER_CONTACT_SOURCE_SPAN_STATUS_OFFSET
  ];
  if (abs(status - SCHROEDER_CONTACT_LAW_NEIGHBOR_STATUS_READY) > 0.5) {
    return vec4<u32>(0u, 0u, 0u, 0u);
  }
  let row_source = u32(max(round(schroeder_contact_source_span_rows[
    span_offset + SCHROEDER_CONTACT_SOURCE_SPAN_SOURCE_OFFSET
  ]), 0.0));
  if (row_source != source_particle_index) {
    return vec4<u32>(0u, 0u, 0u, 0u);
  }
  let span_start = min(
    u32(max(round(schroeder_contact_source_span_rows[
      span_offset + SCHROEDER_CONTACT_SOURCE_SPAN_START_OFFSET
    ]), 0.0)),
    schroeder_contact_neighbor_candidate_params.candidate_count
  );
  let span_count = u32(max(round(schroeder_contact_source_span_rows[
    span_offset + SCHROEDER_CONTACT_SOURCE_SPAN_COUNT_OFFSET
  ]), 0.0));
  return vec4<u32>(span_start, span_count, 1u, 0u);
}

fn ck_schroeder_candidate_particle(candidate_index: u32, endpoint: u32) -> u32 {
  if (!ck_schroeder_neighbor_candidates_enabled() || candidate_index >= schroeder_contact_neighbor_candidate_params.candidate_count) {
    return 4294967295u;
  }
  let candidate_stride = max(
    schroeder_contact_neighbor_candidate_params.candidate_stride,
    SCHROEDER_CONTACT_LAW_NEIGHBOR_STRIDE
  );
  let candidate_offset = candidate_index * candidate_stride;
  let status = schroeder_contact_neighbor_candidate_rows[
    candidate_offset + SCHROEDER_CONTACT_LAW_NEIGHBOR_STATUS_OFFSET
  ];
  if (abs(status - SCHROEDER_CONTACT_LAW_NEIGHBOR_STATUS_READY) > 0.5) {
    return 4294967295u;
  }
  let law_mask = u32(max(round(schroeder_contact_neighbor_candidate_rows[
    candidate_offset + SCHROEDER_CONTACT_LAW_NEIGHBOR_LAW_MASK_OFFSET
  ]), 0.0));
  if ((law_mask & schroeder_contact_neighbor_candidate_params.law_mask) == 0u) {
    return 4294967295u;
  }
  let offset = select(
    SCHROEDER_CONTACT_LAW_NEIGHBOR_SOURCE_OFFSET,
    SCHROEDER_CONTACT_LAW_NEIGHBOR_NEIGHBOR_OFFSET,
    endpoint != 0u
  );
  return u32(max(round(schroeder_contact_neighbor_candidate_rows[candidate_offset + offset]), 0.0));
}

fn ck_interface_source_particle_index(element_index: u32, fallback_surface_index: f32) -> u32 {
  if (
    interface_source_key_params.enabled != 0u
    && element_index < interface_source_key_params.row_count
    && interface_source_key_params.row_stride > 0u
  ) {
    let stride = max(interface_source_key_params.row_stride, INTERFACE_SOURCE_KEY_STRIDE);
    let source_key_offset = element_index * stride;
    let status = interface_source_key_rows[
      source_key_offset + INTERFACE_SOURCE_KEY_STATUS_OFFSET
    ];
    let row_element = u32(max(round(interface_source_key_rows[
      source_key_offset + INTERFACE_SOURCE_KEY_ELEMENT_OFFSET
    ]), 0.0));
    if (status > 0.5 && row_element == element_index) {
      return u32(max(round(interface_source_key_rows[
        source_key_offset + INTERFACE_SOURCE_KEY_SOURCE_OFFSET
      ]), 0.0));
    }
  }
  if (interface_source_key_params.surface_index_fallback_enabled != 0u) {
    return u32(max(round(fallback_surface_index), 0.0));
  }
  return 4294967295u;
}

fn ck_policy_matches_element(row0: vec4<f32>, row2: vec4<f32>, material_id: f32, phase_id: f32) -> bool {
  if (row2.y <= 0.0) {
    return false;
  }
  let material_match = abs(material_id - row0.x) < 0.5 || abs(material_id - row0.y) < 0.5;
  let phase_match = (row0.z <= 0.5 && row0.w <= 0.5)
    || abs(phase_id - row0.z) < 0.5
    || abs(phase_id - row0.w) < 0.5;
  return material_match && phase_match;
}

fn ck_normal_from_element(row2: vec4<f32>, row3: vec4<f32>) -> vec3<f32> {
  var normal = row2.xyz;
  if (dot(normal, normal) <= 1.0e-24) {
    normal = vec3<f32>(row2.w, row3.x, row3.y);
  }
  if (dot(normal, normal) <= 1.0e-24) {
    return vec3<f32>(0.0, 1.0, 0.0);
  }
  return normalize(normal);
}

fn ck_candidate_for_particle(
  particle_index: u32,
  centroid: vec3<f32>,
  normal: vec3<f32>,
  search_radius_m: f32,
  search_radius2: f32,
  element_material_id: f32,
  element_phase_id: f32,
  target_material_id: f32,
  target_phase_id: f32,
  law_queue_gate_required: bool
) -> CkParticleCandidate {
  var candidate = CkParticleCandidate(
    0u,
    0u,
    0.0,
    0.0,
    vec3<f32>(0.0),
    0.0
  );
  if (law_queue_gate_required && !ck_schroeder_law_queue_allows_particle(particle_index)) {
    return candidate;
  }
  let thermo0 = ck_thermo_row0(particle_index);
  let thermo2 = ck_thermo_row2(particle_index);
  if (thermo2.z <= 0.0) {
    return candidate;
  }
  let state0 = ck_state_row0(particle_index);
  let state1 = ck_state_row1(particle_index);
  if (state0.w <= 0.0) {
    return candidate;
  }
  let delta = state0.xyz - centroid;
  let signed_m = dot(delta, normal);
  let distance2 = dot(delta, delta);
  let lateral2 = max(distance2 - signed_m * signed_m, 0.0);
  if (lateral2 > search_radius2 || abs(signed_m) > search_radius_m) {
    return candidate;
  }
  let same_source_material = abs(thermo0.x - element_material_id) < 0.5 && ck_phase_matches(thermo0.y, element_phase_id);
  let same_target_material = abs(thermo0.x - target_material_id) < 0.5 && ck_phase_matches(thermo0.y, target_phase_id);
  candidate.source_match = select(0u, 1u, same_source_material);
  candidate.target_match = select(0u, 1u, same_target_material);
  candidate.signed_m = signed_m;
  candidate.lateral2 = lateral2;
  candidate.velocity = state1.xyz;
  candidate.mass_kg = state0.w;
  return candidate;
}

fn ck_particle_bin_ready() -> bool {
  return params.particle_bin_grid_enabled != 0u
    && params.particle_bin_cell_count > 0u
    && params.particle_bin_capacity > 0u
    && params.particle_bin_grid_nx > 0u
    && params.particle_bin_grid_ny > 0u
    && params.particle_bin_grid_nz > 0u
    && params.particle_bin_cell_size_m > 0.0;
}

fn ck_bin_cell_index(coords: vec3<u32>) -> u32 {
  return coords.x + coords.y * params.particle_bin_grid_nx + coords.z * params.particle_bin_grid_nx * params.particle_bin_grid_ny;
}

fn ck_bin_coord(value: f32, axis_count: u32) -> u32 {
  if (axis_count <= 1u) {
    return 0u;
  }
  let raw = floor(value / params.particle_bin_cell_size_m);
  return u32(clamp(raw, 0.0, f32(axis_count - 1u)));
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let element_index = global_id.x;
  if (element_index >= params.element_count) {
    return;
  }
  contact_kinematics_rows[element_index * 2u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  contact_kinematics_rows[element_index * 2u + 1u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  if (params.derivation_enabled == 0u || params.particle_count == 0u || params.contact_policy_row_count == 0u) {
    return;
  }

  let element_row0 = interface_elements[element_index * 4u];
  let element_row1 = interface_elements[element_index * 4u + 1u];
  let element_row2 = interface_elements[element_index * 4u + 2u];
  let element_row3 = interface_elements[element_index * 4u + 3u];
  let element_material_id = element_row0.y;
  let element_phase_id = element_row0.z;
  let centroid = element_row1.xyz;
  let area_m2 = element_row1.w;
  let element_status = element_row3.w;
  if (element_status <= 0.0 || area_m2 <= 0.0) {
    return;
  }

  var selected = false;
  var target_material_id = 0.0;
  var target_phase_id = 0.0;
  var support_radius_m = params.max_search_radius_m;
  for (var policy_index = 0u; policy_index < params.contact_policy_row_count; policy_index = policy_index + 1u) {
    let policy_row0 = contact_policy_rows[policy_index * 4u];
    let policy_row1 = contact_policy_rows[policy_index * 4u + 1u];
    let policy_row2 = contact_policy_rows[policy_index * 4u + 2u];
    if (!selected && ck_policy_matches_element(policy_row0, policy_row2, element_material_id, element_phase_id)) {
      let match_a = abs(element_material_id - policy_row0.x) < 0.5;
      target_material_id = select(policy_row0.x, policy_row0.y, match_a);
      target_phase_id = select(policy_row0.z, policy_row0.w, match_a);
      support_radius_m = max(policy_row1.z, support_radius_m);
      selected = true;
    }
  }
  if (!selected) {
    return;
  }

  let normal = ck_normal_from_element(element_row2, element_row3);
  let search_radius_m = max(max(support_radius_m * 2.0, params.max_search_radius_m), 1.0e-6);
  let search_radius2 = search_radius_m * search_radius_m;
  var source_score = 1.0e30;
  var target_score = 1.0e30;
  var source_index = 4294967295u;
  var target_index = 4294967295u;
  var source_signed_m = 0.0;
  var target_signed_m = 0.0;
  var source_velocity = vec3<f32>(0.0);
  var target_velocity = vec3<f32>(0.0);
  var source_mass_kg = 0.0;
  var target_mass_kg = 0.0;

  let element_source_particle_index = ck_interface_source_particle_index(element_index, element_row0.x);
  let schroeder_span = ck_schroeder_candidate_span(element_source_particle_index);
  let schroeder_span_ready = schroeder_span.z != 0u;
  let schroeder_broad_candidate_fallback =
    schroeder_contact_source_span_params.broad_candidate_fallback_enabled != 0u;
  if (ck_schroeder_neighbor_candidates_enabled() && (schroeder_span_ready || schroeder_broad_candidate_fallback)) {
    let candidate_start = select(0u, schroeder_span.x, schroeder_span_ready);
    let candidate_count = select(
      schroeder_contact_neighbor_candidate_params.candidate_count,
      min(schroeder_span.y, schroeder_contact_neighbor_candidate_params.candidate_count - candidate_start),
      schroeder_span_ready
    );
    let candidate_end = min(
      candidate_start + candidate_count,
      schroeder_contact_neighbor_candidate_params.candidate_count
    );
    for (var candidate_index = candidate_start; candidate_index < candidate_end; candidate_index = candidate_index + 1u) {
      for (var endpoint = 0u; endpoint < 2u; endpoint = endpoint + 1u) {
        let candidate_particle_index = ck_schroeder_candidate_particle(candidate_index, endpoint);
        if (candidate_particle_index >= params.particle_count) {
          continue;
        }
        let candidate = ck_candidate_for_particle(
          candidate_particle_index,
          centroid,
          normal,
          search_radius_m,
          search_radius2,
          element_material_id,
          element_phase_id,
          target_material_id,
          target_phase_id,
          false
        );
        let signed2 = candidate.signed_m * candidate.signed_m;
        if (candidate.source_match != 0u) {
          let source_side_penalty = select(0.0, search_radius2, candidate.signed_m > support_radius_m * 0.25);
          let score = candidate.lateral2 + signed2 + source_side_penalty;
          if (score < source_score) {
            source_score = score;
            source_index = candidate_particle_index;
            source_signed_m = candidate.signed_m;
            source_velocity = candidate.velocity;
            source_mass_kg = candidate.mass_kg;
          }
        }
        if (candidate.target_match != 0u) {
          let target_side_penalty = select(0.0, search_radius2, candidate.signed_m < -support_radius_m * 0.25);
          let score = candidate.lateral2 + signed2 + target_side_penalty;
          if (score < target_score) {
            target_score = score;
            target_index = candidate_particle_index;
            target_signed_m = candidate.signed_m;
            target_velocity = candidate.velocity;
            target_mass_kg = candidate.mass_kg;
          }
        }
      }
    }
  } else if (ck_particle_bin_ready()) {
    let relative_centroid = centroid - vec3<f32>(
      params.particle_bin_origin_x_m,
      params.particle_bin_origin_y_m,
      params.particle_bin_origin_z_m
    );
    let center_coords = vec3<i32>(
      i32(ck_bin_coord(relative_centroid.x, params.particle_bin_grid_nx)),
      i32(ck_bin_coord(relative_centroid.y, params.particle_bin_grid_ny)),
      i32(ck_bin_coord(relative_centroid.z, params.particle_bin_grid_nz))
    );
    let radius_cells = min(
      i32(8),
      max(1, i32(ceil(search_radius_m / params.particle_bin_cell_size_m)))
    );
    for (var dz = -radius_cells; dz <= radius_cells; dz = dz + 1) {
      let cz = center_coords.z + dz;
      if (cz < 0 || cz >= i32(params.particle_bin_grid_nz)) {
        continue;
      }
      for (var dy = -radius_cells; dy <= radius_cells; dy = dy + 1) {
        let cy = center_coords.y + dy;
        if (cy < 0 || cy >= i32(params.particle_bin_grid_ny)) {
          continue;
        }
        for (var dx = -radius_cells; dx <= radius_cells; dx = dx + 1) {
          let cx = center_coords.x + dx;
          if (cx < 0 || cx >= i32(params.particle_bin_grid_nx)) {
            continue;
          }
          let cell_index = ck_bin_cell_index(vec3<u32>(u32(cx), u32(cy), u32(cz)));
          if (cell_index >= params.particle_bin_cell_count) {
            continue;
          }
          let count = min(particle_bin_counts[cell_index], params.particle_bin_capacity);
          for (var slot = 0u; slot < count; slot = slot + 1u) {
            let particle_index = particle_bin_indices[cell_index * params.particle_bin_capacity + slot];
            if (particle_index >= params.particle_count) {
              continue;
            }
            let candidate = ck_candidate_for_particle(
              particle_index,
              centroid,
              normal,
              search_radius_m,
              search_radius2,
              element_material_id,
              element_phase_id,
              target_material_id,
              target_phase_id,
              true
            );
            let signed2 = candidate.signed_m * candidate.signed_m;
            if (candidate.source_match != 0u) {
              let source_side_penalty = select(0.0, search_radius2, candidate.signed_m > support_radius_m * 0.25);
              let score = candidate.lateral2 + signed2 + source_side_penalty;
              if (score < source_score) {
                source_score = score;
                source_index = particle_index;
                source_signed_m = candidate.signed_m;
                source_velocity = candidate.velocity;
                source_mass_kg = candidate.mass_kg;
              }
            }
            if (candidate.target_match != 0u) {
              let target_side_penalty = select(0.0, search_radius2, candidate.signed_m < -support_radius_m * 0.25);
              let score = candidate.lateral2 + signed2 + target_side_penalty;
              if (score < target_score) {
                target_score = score;
                target_index = particle_index;
                target_signed_m = candidate.signed_m;
                target_velocity = candidate.velocity;
                target_mass_kg = candidate.mass_kg;
              }
            }
          }
        }
      }
    }
  } else {
    for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
      let candidate = ck_candidate_for_particle(
        particle_index,
        centroid,
        normal,
        search_radius_m,
        search_radius2,
        element_material_id,
        element_phase_id,
        target_material_id,
        target_phase_id,
        true
      );
      let signed2 = candidate.signed_m * candidate.signed_m;
      if (candidate.source_match != 0u) {
        let source_side_penalty = select(0.0, search_radius2, candidate.signed_m > support_radius_m * 0.25);
        let score = candidate.lateral2 + signed2 + source_side_penalty;
        if (score < source_score) {
          source_score = score;
          source_index = particle_index;
          source_signed_m = candidate.signed_m;
          source_velocity = candidate.velocity;
          source_mass_kg = candidate.mass_kg;
        }
      }
      if (candidate.target_match != 0u) {
        let target_side_penalty = select(0.0, search_radius2, candidate.signed_m < -support_radius_m * 0.25);
        let score = candidate.lateral2 + signed2 + target_side_penalty;
        if (score < target_score) {
          target_score = score;
          target_index = particle_index;
          target_signed_m = candidate.signed_m;
          target_velocity = candidate.velocity;
          target_mass_kg = candidate.mass_kg;
        }
      }
    }
  }

  if (source_index == 4294967295u || target_index == 4294967295u || source_index == target_index) {
    return;
  }
  let signed_span_m = target_signed_m - source_signed_m;
  let direction_sign = select(-1.0, 1.0, signed_span_m >= 0.0);
  let gap_m = max(abs(signed_span_m), params.gap_floor_m);
  let relative_normal_velocity_m_per_s = dot(target_velocity - source_velocity, normal * direction_sign);
  var representative_mass_kg = 0.0;
  if (source_mass_kg > 0.0 && target_mass_kg > 0.0) {
    representative_mass_kg = (source_mass_kg * target_mass_kg) / max(source_mass_kg + target_mass_kg, 1.0e-12);
  }
  let source_domain_id = particle_identity[source_index];
  let target_domain_id = particle_identity[target_index];
  let domain_pair_ready = source_domain_id > 0u && target_domain_id > 0u;
  contact_kinematics_rows[element_index * 2u] = vec4<f32>(
    gap_m,
    relative_normal_velocity_m_per_s,
    representative_mass_kg,
    1.0
  );
  contact_kinematics_rows[element_index * 2u + 1u] = vec4<f32>(
    f32(source_domain_id),
    f32(target_domain_id),
    select(0.0, 1.0, domain_pair_ready),
    0.0
  );
}
`;

export const mlsMpmG2pReconstructWgsl = `
struct G2pParams {
  particle_count: u32,
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  shift: u32,
  schroeder_active_node_filter_enabled: u32,
  schroeder_selected_level: i32,
  grid_spacing_m: f32,
  inv_grid_spacing_m: f32,
  dt: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  internal_pressure_scale: f32,
  liquid_wall_damping_alpha: f32,
  liquid_wall_damping_distance_m: f32,
  schroeder_active_node_stride_floats: u32,
  schroeder_level_filter_enabled: u32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> updated_grid_nodes: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> out_sph_state: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> out_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(6) var<uniform> params: G2pParams;
@group(0) @binding(7) var<storage, read> schroeder_level_assignments: array<f32>;

fn g2p_quadratic_weights(fx: f32) -> vec3<f32> {
  let a = 1.5 - fx;
  let b = fx - 1.0;
  let c = fx - 0.5;
  return vec3<f32>(0.5 * a * a, 0.75 - b * b, 0.5 * c * c);
}

fn g2p_weight_at(weights: vec3<f32>, offset: i32) -> f32 {
  if (offset == 0) { return weights.x; }
  if (offset == 1) { return weights.y; }
  if (offset == 2) { return weights.z; }
  return 0.0;
}

fn g2p_det3(
  f00: f32, f01: f32, f02: f32,
  f10: f32, f11: f32, f12: f32,
  f20: f32, f21: f32, f22: f32
) -> f32 {
  return f00 * (f11 * f22 - f12 * f21)
    - f01 * (f10 * f22 - f12 * f20)
    + f02 * (f10 * f21 - f11 * f20);
}

fn g2p_cubic_root_positive(value: f32) -> f32 {
  return exp(log(max(value, 1.0e-12)) / 3.0);
}

const G2P_MIN_VOLUME_RATIO_J: f32 = 0.1;
const G2P_MAX_RADIUS_GROWTH_RATIO: f32 = 4.0;
const G2P_MAX_VOLUME_RATIO_J: f32 = 64.0;
// Gas particles expand until their density reaches the vacuum-expansion
// floor of 0.1% rest density (J_max = rho_rest/rho_floor = 1000) instead of
// the condensed-phase 64x volume cap. The fixed cap froze expanding gas at
// 64x rest volume, giving it a false liquid-like free surface (a discrete
// "gas top" a solid could rest in) while the pressure law kept pushing.
// With the gauge ideal-gas pressure (P proportional to rho ~ 1/J) the pair
// (pressure, volume) stays integrable as J grows: P at the floor is 1e-3 atm,
// so gas fills the domain and settles instead of pooling.
const G2P_MAX_VOLUME_RATIO_J_GAS: f32 = 1000.0;

fn g2p_max_volume_ratio_j(eos_model_id: f32) -> f32 {
  let is_gas = eos_model_id > 1.5 && eos_model_id < 2.5;
  return select(G2P_MAX_VOLUME_RATIO_J, G2P_MAX_VOLUME_RATIO_J_GAS, is_gas);
}

fn g2p_particle_wall_clearance(rest_volume_m3: f32) -> f32 {
  if (rest_volume_m3 <= 0.0) {
    return 0.0;
  }
  var clearance = 0.5 * g2p_cubic_root_positive(rest_volume_m3);
  // The wall boundary condition operates at grid resolution: a clearance
  // larger than half a cell builds a phantom forbidden shell inside the box.
  // Low-density phases made that shell meters thick (steam rest volume is
  // ~1.7 m^3/kg, so 0.5*v0^(1/3) pinned steam mid-air, "800 K water" to the
  // floor, and quench splash to a ceiling shelf at box_y - clearance).
  // Compressible parcels overlap walls physically; sub-cell wall response
  // belongs to the pressure law, not a rigid-ball radius.
  clearance = min(clearance, 0.5 * params.grid_spacing_m);
  let min_dim = min(params.box_x, min(params.box_y, params.box_z));
  if (min_dim > 0.0) {
    clearance = min(clearance, 0.49 * min_dim);
  }
  return clearance;
}

fn g2p_clamp(value: f32, lower: f32, upper: f32) -> f32 {
  return min(max(value, lower), upper);
}

fn g2p_condensed_target_j(raw_next_j: f32, previous_j: f32) -> f32 {
  let previous_bounded = g2p_clamp(previous_j, 0.95, 1.05);
  let lower = max(0.95, previous_bounded / 1.5);
  let upper = min(1.05, previous_bounded * 1.5);
  return g2p_clamp(raw_next_j, lower, upper);
}

fn g2p_grid_index(i: i32, j: i32, k: i32) -> u32 {
  return (u32(i + i32(params.shift)) * params.grid_ny + u32(j + i32(params.shift))) * params.grid_nz + u32(k + i32(params.shift));
}

fn g2p_in_range(i: i32, j: i32, k: i32) -> bool {
  let ii = i + i32(params.shift);
  let jj = j + i32(params.shift);
  let kk = k + i32(params.shift);
  return ii >= 0 && jj >= 0 && kk >= 0
    && ii < i32(params.grid_nx)
    && jj < i32(params.grid_ny)
    && kk < i32(params.grid_nz);
}

// Level-filtered G2P with copy-through: only particles assigned to the
// selected level reconstruct from this grid; other particles copy their
// input state through unchanged so a coarser/finer pass (or the caller)
// keeps authority over them. Assignment rows are particle-parallel; the
// compacted active-node list is NOT and must never gate particles here.
fn g2p_particle_enabled(particle_index: u32) -> bool {
  if (params.schroeder_active_node_filter_enabled == 0u) {
    return true;
  }
  let stride = max(params.schroeder_active_node_stride_floats, 1u);
  let assignment_offset = particle_index * stride;
  let level = i32(round(schroeder_level_assignments[assignment_offset]));
  return level == params.schroeder_selected_level;
}

fn g2p_copy_input_particle(state_base: u32, mechanics_base: u32) {
  out_sph_state[state_base] = sph_state[state_base];
  out_sph_state[state_base + 1u] = sph_state[state_base + 1u];
  out_mls_mechanics[mechanics_base] = mls_mechanics[mechanics_base];
  out_mls_mechanics[mechanics_base + 1u] = mls_mechanics[mechanics_base + 1u];
  out_mls_mechanics[mechanics_base + 2u] = mls_mechanics[mechanics_base + 2u];
  out_mls_mechanics[mechanics_base + 3u] = mls_mechanics[mechanics_base + 3u];
  out_mls_mechanics[mechanics_base + 4u] = mls_mechanics[mechanics_base + 4u];
  out_mls_mechanics[mechanics_base + 5u] = mls_mechanics[mechanics_base + 5u];
  out_mls_mechanics[mechanics_base + 6u] = mls_mechanics[mechanics_base + 6u];
  out_mls_mechanics[mechanics_base + 7u] = mls_mechanics[mechanics_base + 7u];
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let state_base = particle_index * 2u;
  let mechanics_base = particle_index * 8u;
  if (!g2p_particle_enabled(particle_index)) {
    g2p_copy_input_particle(state_base, mechanics_base);
    return;
  }
  let pos_mass = sph_state[state_base];
  let vel_u = sph_state[state_base + 1u];
  let _thermo_status = sph_thermo[particle_index * 3u + 2u].z;
  let row0 = mls_mechanics[mechanics_base];
  let row1 = mls_mechanics[mechanics_base + 1u];
  let row2 = mls_mechanics[mechanics_base + 2u];
  let row3 = mls_mechanics[mechanics_base + 3u];
  let row4 = mls_mechanics[mechanics_base + 4u];
  let row5 = mls_mechanics[mechanics_base + 5u];
  let row6 = mls_mechanics[mechanics_base + 6u];
  let row7 = mls_mechanics[mechanics_base + 7u];

  let p_grid = pos_mass.xyz * params.inv_grid_spacing_m;
  let base_x = i32(floor(p_grid.x - 0.5));
  let base_y = i32(floor(p_grid.y - 0.5));
  let base_z = i32(floor(p_grid.z - 0.5));
  let wx = g2p_quadratic_weights(p_grid.x - f32(base_x));
  let wy = g2p_quadratic_weights(p_grid.y - f32(base_y));
  let wz = g2p_quadratic_weights(p_grid.z - f32(base_z));

  var velocity = vec3<f32>(0.0, 0.0, 0.0);
  var c00 = 0.0; var c01 = 0.0; var c02 = 0.0;
  var c10 = 0.0; var c11 = 0.0; var c12 = 0.0;
  var c20 = 0.0; var c21 = 0.0; var c22 = 0.0;
  var sampled_weight = 0.0;

  for (var a = 0i; a < 3i; a = a + 1i) {
    for (var b = 0i; b < 3i; b = b + 1i) {
      for (var c = 0i; c < 3i; c = c + 1i) {
        let node_i = base_x + a;
        let node_j = base_y + b;
        let node_k = base_z + c;
        if (!g2p_in_range(node_i, node_j, node_k)) {
          continue;
        }
        let weight = g2p_weight_at(wx, a) * g2p_weight_at(wy, b) * g2p_weight_at(wz, c);
        if (weight == 0.0) {
          continue;
        }
        let idx = g2p_grid_index(node_i, node_j, node_k);
        let grid_row = updated_grid_nodes[idx * 2u];
        let grid_meta = updated_grid_nodes[idx * 2u + 1u];
        if (!(grid_row.x > 0.0) && !(grid_meta.w > 0.0)) {
          continue;
        }
        sampled_weight = sampled_weight + weight;
        let grid_velocity = grid_row.yzw;
        velocity = velocity + weight * grid_velocity;
        let dpos = (vec3<f32>(f32(node_i), f32(node_j), f32(node_k)) - p_grid) * params.grid_spacing_m;
        let s = 4.0 * params.inv_grid_spacing_m * params.inv_grid_spacing_m * weight;
        c00 = c00 + s * grid_velocity.x * dpos.x;
        c01 = c01 + s * grid_velocity.x * dpos.y;
        c02 = c02 + s * grid_velocity.x * dpos.z;
        c10 = c10 + s * grid_velocity.y * dpos.x;
        c11 = c11 + s * grid_velocity.y * dpos.y;
        c12 = c12 + s * grid_velocity.y * dpos.z;
        c20 = c20 + s * grid_velocity.z * dpos.x;
        c21 = c21 + s * grid_velocity.z * dpos.y;
        c22 = c22 + s * grid_velocity.z * dpos.z;
      }
    }
  }
  if (sampled_weight > 1.0e-8 && sampled_weight < 0.999999) {
    let normalization = 1.0 / sampled_weight;
    velocity = velocity * normalization;
    c00 = c00 * normalization; c01 = c01 * normalization; c02 = c02 * normalization;
    c10 = c10 * normalization; c11 = c11 * normalization; c12 = c12 * normalization;
    c20 = c20 * normalization; c21 = c21 * normalization; c22 = c22 * normalization;
  }

  var position = pos_mass.xyz + params.dt * velocity;
  let wall_clearance = g2p_particle_wall_clearance(row4.w);
  let upper_x = max(wall_clearance, params.box_x - wall_clearance);
  let upper_y = max(wall_clearance, params.box_y - wall_clearance);
  let upper_z = max(wall_clearance, params.box_z - wall_clearance);
  if (position.x < wall_clearance) { position.x = wall_clearance; if (velocity.x < 0.0) { velocity.x = 0.0; } }
  if (position.x > upper_x) { position.x = upper_x; if (velocity.x > 0.0) { velocity.x = 0.0; } }
  if (position.y < wall_clearance) { position.y = wall_clearance; if (velocity.y < 0.0) { velocity.y = 0.0; } }
  if (position.y > upper_y) { position.y = upper_y; if (velocity.y > 0.0) { velocity.y = 0.0; } }
  if (position.z < wall_clearance) { position.z = wall_clearance; if (velocity.z < 0.0) { velocity.z = 0.0; } }
  if (position.z > upper_z) { position.z = upper_z; if (velocity.z > 0.0) { velocity.z = 0.0; } }

  let f00 = row0.x; let f01 = row0.y; let f02 = row0.z;
  let f10 = row0.w; let f11 = row1.x; let f12 = row1.y;
  let f20 = row1.z; let f21 = row1.w; let f22 = row2.x;
  let solid = row5.x > 0.5;
  let condensed = solid || (row6.z > 0.5 && row6.z < 1.5);
  if (!solid && condensed && params.liquid_wall_damping_alpha > 0.0 && params.liquid_wall_damping_distance_m > 0.0) {
    let floor_distance = max(position.y - wall_clearance, 0.0);
    if (floor_distance < params.liquid_wall_damping_distance_m) {
      let q = 1.0 - floor_distance / params.liquid_wall_damping_distance_m;
      let keep = g2p_clamp(1.0 - params.liquid_wall_damping_alpha * q * q, 0.0, 1.0);
      velocity = velocity * keep;
    }
  }
  let deformation_disabled = !solid && (row6.z < 0.5 || params.internal_pressure_scale == 0.0);
  if (deformation_disabled) {
    c00 = 0.0; c01 = 0.0; c02 = 0.0;
    c10 = 0.0; c11 = 0.0; c12 = 0.0;
    c20 = 0.0; c21 = 0.0; c22 = 0.0;
  }
  let g00 = 1.0 + params.dt * c00; let g01 = params.dt * c01; let g02 = params.dt * c02;
  let g10 = params.dt * c10; let g11 = 1.0 + params.dt * c11; let g12 = params.dt * c12;
  let g20 = params.dt * c20; let g21 = params.dt * c21; let g22 = 1.0 + params.dt * c22;

  var nf00 = g00 * f00 + g01 * f10 + g02 * f20;
  var nf01 = g00 * f01 + g01 * f11 + g02 * f21;
  var nf02 = g00 * f02 + g01 * f12 + g02 * f22;
  var nf10 = g10 * f00 + g11 * f10 + g12 * f20;
  var nf11 = g10 * f01 + g11 * f11 + g12 * f21;
  var nf12 = g10 * f02 + g11 * f12 + g12 * f22;
  var nf20 = g20 * f00 + g21 * f10 + g22 * f20;
  var nf21 = g20 * f01 + g21 * f11 + g22 * f21;
  var nf22 = g20 * f02 + g21 * f12 + g22 * f22;
  var next_j = g2p_det3(nf00, nf01, nf02, nf10, nf11, nf12, nf20, nf21, nf22);
  if (deformation_disabled) {
    nf00 = f00; nf01 = f01; nf02 = f02;
    nf10 = f10; nf11 = f11; nf12 = f12;
    nf20 = f20; nf21 = f21; nf22 = f22;
    next_j = row4.z;
  } else if (condensed) {
    let target_j = g2p_condensed_target_j(next_j, row4.z);
    if (!solid) {
      let s = g2p_cubic_root_positive(target_j);
      nf00 = s; nf01 = 0.0; nf02 = 0.0;
      nf10 = 0.0; nf11 = s; nf12 = 0.0;
      nf20 = 0.0; nf21 = 0.0; nf22 = s;
    } else if (next_j > 1.0e-12) {
      let scale = g2p_cubic_root_positive(target_j / next_j);
      nf00 = nf00 * scale; nf01 = nf01 * scale; nf02 = nf02 * scale;
      nf10 = nf10 * scale; nf11 = nf11 * scale; nf12 = nf12 * scale;
      nf20 = nf20 * scale; nf21 = nf21 * scale; nf22 = nf22 * scale;
    } else {
      let s = g2p_cubic_root_positive(target_j);
      nf00 = s; nf01 = 0.0; nf02 = 0.0;
      nf10 = 0.0; nf11 = s; nf12 = 0.0;
      nf20 = 0.0; nf21 = 0.0; nf22 = s;
    }
    next_j = target_j;
  } else if (row5.x < 0.5) {
    next_j = max(next_j, 0.05);
    let s = g2p_cubic_root_positive(next_j);
    nf00 = s; nf01 = 0.0; nf02 = 0.0;
    nf10 = 0.0; nf11 = s; nf12 = 0.0;
    nf20 = 0.0; nf21 = 0.0; nf22 = s;
  }
  next_j = g2p_det3(nf00, nf01, nf02, nf10, nf11, nf12, nf20, nf21, nf22);
  if (next_j < G2P_MIN_VOLUME_RATIO_J) {
    let s = g2p_cubic_root_positive(G2P_MIN_VOLUME_RATIO_J);
    nf00 = s; nf01 = 0.0; nf02 = 0.0;
    nf10 = 0.0; nf11 = s; nf12 = 0.0;
    nf20 = 0.0; nf21 = 0.0; nf22 = s;
    next_j = G2P_MIN_VOLUME_RATIO_J;
  } else if (next_j > g2p_max_volume_ratio_j(row6.z)) {
    let max_volume_ratio_j = g2p_max_volume_ratio_j(row6.z);
    let scale = g2p_cubic_root_positive(max_volume_ratio_j / max(next_j, 1.0e-12));
    nf00 = nf00 * scale; nf01 = nf01 * scale; nf02 = nf02 * scale;
    nf10 = nf10 * scale; nf11 = nf11 * scale; nf12 = nf12 * scale;
    nf20 = nf20 * scale; nf21 = nf21 * scale; nf22 = nf22 * scale;
    next_j = max_volume_ratio_j;
  }

  out_sph_state[state_base] = vec4<f32>(position.x, position.y, position.z, pos_mass.w);
  out_sph_state[state_base + 1u] = vec4<f32>(velocity.x, velocity.y, velocity.z, vel_u.w);
  out_mls_mechanics[mechanics_base] = vec4<f32>(nf00, nf01, nf02, nf10);
  out_mls_mechanics[mechanics_base + 1u] = vec4<f32>(nf11, nf12, nf20, nf21);
  out_mls_mechanics[mechanics_base + 2u] = vec4<f32>(nf22, c00, c01, c02);
  out_mls_mechanics[mechanics_base + 3u] = vec4<f32>(c10, c11, c12, c20);
  out_mls_mechanics[mechanics_base + 4u] = vec4<f32>(c21, c22, next_j, row4.w);
  out_mls_mechanics[mechanics_base + 5u] = row5;
  out_mls_mechanics[mechanics_base + 6u] = row6;
  out_mls_mechanics[mechanics_base + 7u] = row7;
}
`;

// Excluded-volume particle separation. MLS-MPM volume tracking (J from the
// grid velocity gradient) is blind to sub-grid-cell interpenetration: two
// particles inside one cell sample the same velocity field, so their relative
// divergence is zero and J never registers the overlap. The pair rest
// distance is derived from each particle's own rest volume (d = cbrt(V0)),
// making the law material-agnostic. Solid-solid pairs are skipped because the
// elastic constitutive law already models interatomic repulsion for a
// connected lattice; gas is skipped because gas compressibility is owned by
// the gas EOS. The projection is symmetric and inverse-mass weighted, so it
// conserves pair momentum and center of mass exactly.
export const SEPARATION_BIN_CAPACITY = 64;

export const mlsMpmParticleSeparationBinFillWgsl = `
struct SeparationParams {
  particle_count: u32,
  relaxation: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  normal_velocity_damping: f32,
  bin_nx: u32,
  bin_ny: u32,
  bin_nz: u32,
  bin_capacity: u32,
  bin_cell_size_m: f32,
  grid_spacing_m: f32,
};

@group(0) @binding(0) var<storage, read> in_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> in_mechanics: array<vec4<f32>>;
// Combined bins: [0, cell_count) = per-cell counts, then cell_count +
// cell * capacity + slot = entry indices. One buffer keeps consumers within
// the default 10-storage-buffer per-stage limit.
@group(0) @binding(2) var<storage, read_write> bins: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> params: SeparationParams;

fn bin_fill_cell_index(position: vec3<f32>) -> u32 {
  let inv = 1.0 / max(params.bin_cell_size_m, 1.0e-9);
  let cx = clamp(u32(max(position.x, 0.0) * inv), 0u, params.bin_nx - 1u);
  let cy = clamp(u32(max(position.y, 0.0) * inv), 0u, params.bin_ny - 1u);
  let cz = clamp(u32(max(position.z, 0.0) * inv), 0u, params.bin_nz - 1u);
  return (cz * params.bin_ny + cy) * params.bin_nx + cx;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  if (params.relaxation <= 0.0 && params.normal_velocity_damping <= 0.0) {
    return;
  }
  let pos_mass = in_state[particle_index * 2u];
  if (pos_mass.w <= 0.0) {
    return;
  }
  // Every massive particle is binned (gas included): the bins are shared
  // with thermal pair conduction, and the separation consumer already
  // filters phases per pair.
  let cell = bin_fill_cell_index(pos_mass.xyz);
  let cell_count = params.bin_nx * params.bin_ny * params.bin_nz;
  let slot = atomicAdd(&bins[cell], 1u);
  if (slot < params.bin_capacity) {
    atomicStore(&bins[cell_count + cell * params.bin_capacity + slot], particle_index);
  }
}
`;

export const mlsMpmParticleSeparationComputeWgsl = `
struct SeparationParams {
  particle_count: u32,
  relaxation: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  normal_velocity_damping: f32,
  bin_nx: u32,
  bin_ny: u32,
  bin_nz: u32,
  bin_capacity: u32,
  bin_cell_size_m: f32,
  grid_spacing_m: f32,
};

@group(0) @binding(0) var<storage, read> in_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> in_mechanics: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> corrections: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: SeparationParams;
// Combined bins layout: counts prefix then entry slots (see bin-fill).
@group(0) @binding(4) var<storage, read> bins: array<u32>;

fn separation_cbrt(volume_m3: f32) -> f32 {
  return pow(max(volume_m3, 1.0e-18), 1.0 / 3.0);
}

// 0 = excluded (gas/plasma/unknown), 1 = liquid, 2 = solid.
fn separation_phase_class(index: u32) -> u32 {
  let row5 = in_mechanics[index * 8u + 5u];
  let row6 = in_mechanics[index * 8u + 6u];
  if (row5.x > 0.5) {
    return 2u;
  }
  if (row6.z > 0.5 && row6.z < 1.5) {
    return 1u;
  }
  return 0u;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  corrections[particle_index * 2u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  corrections[particle_index * 2u + 1u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  if (params.relaxation <= 0.0 && params.normal_velocity_damping <= 0.0) {
    return;
  }
  let phase_class = separation_phase_class(particle_index);
  if (phase_class == 0u) {
    return;
  }
  let pos_mass = in_state[particle_index * 2u];
  if (pos_mass.w <= 0.0) {
    return;
  }
  let rest_volume = max(in_mechanics[particle_index * 8u + 4u].w, 0.0);
  if (rest_volume <= 0.0) {
    return;
  }
  let velocity = in_state[particle_index * 2u + 1u].xyz;
  let d_self = separation_cbrt(rest_volume);
  let w_self = 1.0 / max(pos_mass.w, 1.0e-30);
  var dx = vec3<f32>(0.0, 0.0, 0.0);
  var dv = vec3<f32>(0.0, 0.0, 0.0);
  // The bin cell size is >= every pair rest distance, so scanning the
  // 3x3x3 cell neighborhood covers all interacting pairs.
  let inv_cell = 1.0 / max(params.bin_cell_size_m, 1.0e-9);
  let cx = i32(clamp(u32(max(pos_mass.x, 0.0) * inv_cell), 0u, params.bin_nx - 1u));
  let cy = i32(clamp(u32(max(pos_mass.y, 0.0) * inv_cell), 0u, params.bin_ny - 1u));
  let cz = i32(clamp(u32(max(pos_mass.z, 0.0) * inv_cell), 0u, params.bin_nz - 1u));
  for (var oz = -1; oz <= 1; oz = oz + 1) {
    let nz = cz + oz;
    if (nz < 0 || nz >= i32(params.bin_nz)) {
      continue;
    }
    for (var oy = -1; oy <= 1; oy = oy + 1) {
      let ny = cy + oy;
      if (ny < 0 || ny >= i32(params.bin_ny)) {
        continue;
      }
      for (var ox = -1; ox <= 1; ox = ox + 1) {
        let nx = cx + ox;
        if (nx < 0 || nx >= i32(params.bin_nx)) {
          continue;
        }
        let cell = (u32(nz) * params.bin_ny + u32(ny)) * params.bin_nx + u32(nx);
        let total_cells = params.bin_nx * params.bin_ny * params.bin_nz;
        let cell_count = min(bins[cell], params.bin_capacity);
        for (var entry = 0u; entry < cell_count; entry = entry + 1u) {
          let other = bins[total_cells + cell * params.bin_capacity + entry];
          if (other == particle_index) {
            continue;
          }
          let other_pos_mass = in_state[other * 2u];
          if (other_pos_mass.w <= 0.0) {
            continue;
          }
          let other_class = separation_phase_class(other);
          if (other_class == 0u) {
            continue;
          }
          if (phase_class == 2u && other_class == 2u) {
            continue;
          }
          let other_rest_volume = max(in_mechanics[other * 8u + 4u].w, 0.0);
          if (other_rest_volume <= 0.0) {
            continue;
          }
          let pair_rest_distance = 0.5 * (d_self + separation_cbrt(other_rest_volume));
          let delta = pos_mass.xyz - other_pos_mass.xyz;
          var dist = length(delta);
          if (dist >= pair_rest_distance) {
            continue;
          }
          var normal = vec3<f32>(0.0, 1.0, 0.0);
          if (dist > 1.0e-9) {
            normal = delta / dist;
          } else {
            // Deterministic antisymmetric fallback for coincident particles:
            // hash the LOWER pair index into a unit direction so distinct
            // coincident pairs scatter isotropically instead of every twin
            // pair stacking along +/-y (reaction products spawn co-located at
            // the reacting pair's position, so y-only pushes built columns).
            // Both members hash the same index, so the pushes stay exactly
            // antisymmetric and conserve pair momentum.
            let low_index = min(particle_index, other);
            var h = low_index * 2654435761u + 0x9e3779b9u;
            h = (h ^ (h >> 16u)) * 2246822519u;
            h = h ^ (h >> 13u);
            let ux = f32(h & 1023u) / 511.5 - 1.0;
            let uy = f32((h >> 10u) & 1023u) / 511.5 - 1.0;
            let uz = f32((h >> 20u) & 1023u) / 511.5 - 1.0;
            let raw = vec3<f32>(ux, uy, uz);
            let raw_len = length(raw);
            let hashed = select(vec3<f32>(0.0, 1.0, 0.0), raw / max(raw_len, 1.0e-6), raw_len > 1.0e-4);
            normal = hashed * select(-1.0, 1.0, particle_index > other);
            dist = 0.0;
          }
          let w_other = 1.0 / max(other_pos_mass.w, 1.0e-30);
          let share = w_self / (w_self + w_other);
          dx = dx + params.relaxation * share * (pair_rest_distance - dist) * normal;
          let approach = dot(velocity - in_state[other * 2u + 1u].xyz, normal);
          if (approach < 0.0) {
            dv = dv - params.normal_velocity_damping * share * approach * normal;
          }
        }
      }
    }
  }
  // Bound the aggregate correction so deeply overlapped states relax over
  // several substeps instead of teleporting.
  let max_step = 0.5 * d_self;
  let dx_len = length(dx);
  if (dx_len > max_step) {
    dx = dx * (max_step / dx_len);
  }
  corrections[particle_index * 2u] = vec4<f32>(dx, 0.0);
  corrections[particle_index * 2u + 1u] = vec4<f32>(dv, 0.0);
}
`;

export const mlsMpmParticleSeparationApplyWgsl = `
struct SeparationParams {
  particle_count: u32,
  relaxation: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  normal_velocity_damping: f32,
  bin_nx: u32,
  bin_ny: u32,
  bin_nz: u32,
  bin_capacity: u32,
  bin_cell_size_m: f32,
  grid_spacing_m: f32,
};

@group(0) @binding(0) var<storage, read> corrections: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> in_mechanics: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> out_state: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: SeparationParams;

fn separation_apply_cbrt(volume_m3: f32) -> f32 {
  return pow(max(volume_m3, 1.0e-18), 1.0 / 3.0);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  if (params.relaxation <= 0.0 && params.normal_velocity_damping <= 0.0) {
    return;
  }
  let dx = corrections[particle_index * 2u].xyz;
  let dv = corrections[particle_index * 2u + 1u].xyz;
  if (dot(dx, dx) == 0.0 && dot(dv, dv) == 0.0) {
    return;
  }
  let pos_mass = out_state[particle_index * 2u];
  let vel_u = out_state[particle_index * 2u + 1u];
  var position = pos_mass.xyz + dx;
  var velocity = vel_u.xyz + dv;
  // Same finite-volume wall clearance contract as G2P, including the
  // half-cell cap (see g2p_particle_wall_clearance for the rationale).
  let rest_volume = max(in_mechanics[particle_index * 8u + 4u].w, 0.0);
  var wall_clearance = 0.0;
  if (rest_volume > 0.0) {
    wall_clearance = 0.5 * separation_apply_cbrt(rest_volume);
    if (params.grid_spacing_m > 0.0) {
      wall_clearance = min(wall_clearance, 0.5 * params.grid_spacing_m);
    }
    let min_dim = min(params.box_x, min(params.box_y, params.box_z));
    if (min_dim > 0.0) {
      wall_clearance = min(wall_clearance, 0.49 * min_dim);
    }
  }
  let upper_x = max(wall_clearance, params.box_x - wall_clearance);
  let upper_y = max(wall_clearance, params.box_y - wall_clearance);
  let upper_z = max(wall_clearance, params.box_z - wall_clearance);
  if (position.x < wall_clearance) { position.x = wall_clearance; if (velocity.x < 0.0) { velocity.x = 0.0; } }
  if (position.x > upper_x) { position.x = upper_x; if (velocity.x > 0.0) { velocity.x = 0.0; } }
  if (position.y < wall_clearance) { position.y = wall_clearance; if (velocity.y < 0.0) { velocity.y = 0.0; } }
  if (position.y > upper_y) { position.y = upper_y; if (velocity.y > 0.0) { velocity.y = 0.0; } }
  if (position.z < wall_clearance) { position.z = wall_clearance; if (velocity.z < 0.0) { velocity.z = 0.0; } }
  if (position.z > upper_z) { position.z = upper_z; if (velocity.z > 0.0) { velocity.z = 0.0; } }
  out_state[particle_index * 2u] = vec4<f32>(position, pos_mass.w);
  out_state[particle_index * 2u + 1u] = vec4<f32>(velocity, vel_u.w);
}
`;

export const mlsMpmMechanicsRefreshWgsl = `
struct MechanicsRefreshParams {
  particle_count: u32,
  phase_record_count: u32,
  material_bank_warm_input_row_count: u32,
  pad1: u32,
};

struct PhaseMechanics {
  rest_density: f32,
  bulk: f32,
  shear: f32,
  lambda: f32,
  sound_speed: f32,
  eos_model: f32,
  solid: f32,
  status: f32,
  dynamic_viscosity: f32,
  surface_tension: f32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> material_phase_records: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> out_mechanics: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> params: MechanicsRefreshParams;
@group(0) @binding(6) var<storage, read> material_bank_warm_input_rows: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> authority_validation: array<atomic<u32>>;

fn material_bank_warm_input_anchor() -> f32 {
  if (params.material_bank_warm_input_row_count == 0u) {
    return 0.0;
  }
  let value = material_bank_warm_input_rows[0u].x;
  if (value != value || abs(value) > 3.402823e38) {
    return 0.0;
  }
  return value * 0.0;
}

fn mechanics_refresh_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn mechanics_refresh_finite_vec4(value: vec4<f32>) -> bool {
  return all(value == value)
    && all(abs(value) <= vec4<f32>(3.402823e38));
}

fn mechanics_refresh_fail() {
  atomicOr(&authority_validation[0u], 1u);
}

fn mechanics_refresh_determinant(
  row0: vec4<f32>,
  row1: vec4<f32>,
  row2: vec4<f32>
) -> f32 {
  return row0.x * (row1.x * row2.x - row1.y * row1.w)
    - row0.y * (row0.w * row2.x - row1.y * row1.z)
    + row0.z * (row0.w * row1.w - row1.x * row1.z);
}

fn mechanics_refresh_determinant_matches(
  row0: vec4<f32>,
  row1: vec4<f32>,
  row2: vec4<f32>,
  volume_ratio_j: f32
) -> bool {
  let determinant = mechanics_refresh_determinant(row0, row1, row2);
  return mechanics_refresh_finite(determinant)
    && abs(determinant - volume_ratio_j)
      <= max(1.0e-5, abs(volume_ratio_j) * 1.0e-2);
}

fn phase_record_row0(record_index: u32) -> vec4<f32> {
  return material_phase_records[record_index * 3u];
}

fn phase_record_row1(record_index: u32) -> vec4<f32> {
  return material_phase_records[record_index * 3u + 1u];
}

fn phase_record_row2(record_index: u32) -> vec4<f32> {
  return material_phase_records[record_index * 3u + 2u];
}

fn find_phase_mechanics(material_id: f32, phase_id: f32) -> PhaseMechanics {
  for (var record_index = 0u; record_index < params.phase_record_count; record_index = record_index + 1u) {
    let row0 = phase_record_row0(record_index);
    if (row0.x == material_id && row0.y == phase_id) {
      let row1 = phase_record_row1(record_index);
      let row2 = phase_record_row2(record_index);
      return PhaseMechanics(row0.z, row0.w, row1.x, row1.y, row1.z, row1.w, row2.x, row2.y, row2.z, row2.w);
    }
  }
  return PhaseMechanics(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 255.0, 0.0, 0.0);
}

fn mechanics_refresh_should_reset(row4: vec4<f32>, row5: vec4<f32>, row6: vec4<f32>, phase_mechanics: PhaseMechanics, rest_volume: f32) -> bool {
  let previous_rest_volume = row4.w;
  if (!(rest_volume > 0.0)) {
    return false;
  }
  let previous_reference_valid = previous_rest_volume > 0.0
    && row4.z > 0.0
    && row5.y == 1.0
    && row6.w == 1.0;
  if (!previous_reference_valid) {
    return true;
  }
  let mechanics_model_changed = abs(row5.x - phase_mechanics.solid) > 0.5 || abs(row6.z - phase_mechanics.eos_model) > 0.5;
  if (!mechanics_model_changed) {
    return false;
  }
  let rest_ratio = max(previous_rest_volume / rest_volume, rest_volume / previous_rest_volume);
  return rest_ratio >= 2.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let mechanics_base = particle_index * 8u;
  for (var row = 0u; row < 8u; row = row + 1u) {
    out_mechanics[mechanics_base + row] = source_mechanics[mechanics_base + row];
  }

  let thermo0 = sph_thermo[particle_index * 3u];
  let state0 = sph_state[particle_index * 2u];
  if (state0.w == 0.0) {
    return;
  }
  if (
    !mechanics_refresh_finite_vec4(state0)
    || !mechanics_refresh_finite_vec4(thermo0)
    || !(state0.w > 0.0)
    || !(thermo0.w > 0.0)
  ) {
    mechanics_refresh_fail();
    return;
  }
  let phase_mechanics = find_phase_mechanics(thermo0.x, thermo0.y);
  let phase_mechanics_finite =
    mechanics_refresh_finite(phase_mechanics.rest_density)
    && mechanics_refresh_finite(phase_mechanics.bulk)
    && mechanics_refresh_finite(phase_mechanics.shear)
    && mechanics_refresh_finite(phase_mechanics.lambda)
    && mechanics_refresh_finite(phase_mechanics.sound_speed)
    && mechanics_refresh_finite(phase_mechanics.eos_model)
    && mechanics_refresh_finite(phase_mechanics.solid)
    && mechanics_refresh_finite(phase_mechanics.status)
    && mechanics_refresh_finite(phase_mechanics.dynamic_viscosity)
    && mechanics_refresh_finite(phase_mechanics.surface_tension);
  if (
    phase_mechanics.status != 1.0
    || !phase_mechanics_finite
    || !(phase_mechanics.rest_density > 0.0)
  ) {
    mechanics_refresh_fail();
    return;
  }

  let rest_density = thermo0.w;
  var rest_volume = state0.w / rest_density;
  rest_volume = rest_volume + material_bank_warm_input_anchor();
  if (!(rest_volume > 0.0) || !mechanics_refresh_finite(rest_volume)) {
    mechanics_refresh_fail();
    return;
  }

  var row0 = out_mechanics[mechanics_base];
  var row1 = out_mechanics[mechanics_base + 1u];
  var row2 = out_mechanics[mechanics_base + 2u];
  var row3 = out_mechanics[mechanics_base + 3u];
  var row4 = out_mechanics[mechanics_base + 4u];
  let row5 = out_mechanics[mechanics_base + 5u];
  let row6 = out_mechanics[mechanics_base + 6u];
  let row7 = out_mechanics[mechanics_base + 7u];
  let previous_current_volume = row4.z * row4.w;
  let previous_volume_authority_valid = row4.z > 0.0
    && row4.w > 0.0
    && previous_current_volume > 0.0
    && previous_current_volume == previous_current_volume
    && abs(previous_current_volume) <= 3.402823e38
    && row5.y == 1.0
    && row6.w == 1.0
    && mechanics_refresh_finite_vec4(row0)
    && mechanics_refresh_finite_vec4(row1)
    && mechanics_refresh_finite_vec4(row2)
    && mechanics_refresh_finite_vec4(row3)
    && mechanics_refresh_finite_vec4(row4)
    && mechanics_refresh_finite_vec4(row5)
    && mechanics_refresh_finite_vec4(row6)
    && mechanics_refresh_finite_vec4(row7)
    && mechanics_refresh_determinant_matches(row0, row1, row2, row4.z);
  if (!previous_volume_authority_valid) {
    mechanics_refresh_fail();
    return;
  }
  let current_volume = previous_current_volume;
  let next_volume_ratio_j = current_volume / rest_volume;
  if (
    !(next_volume_ratio_j > 0.0)
    || !mechanics_refresh_finite(next_volume_ratio_j)
  ) {
    mechanics_refresh_fail();
    return;
  }
  var next_row4_xy = row4.xy;
  if (mechanics_refresh_should_reset(row4, row5, row6, phase_mechanics, rest_volume)) {
    let isotropic_scale = pow(next_volume_ratio_j, 1.0 / 3.0);
    row0 = vec4<f32>(isotropic_scale, 0.0, 0.0, 0.0);
    row1 = vec4<f32>(isotropic_scale, 0.0, 0.0, 0.0);
    row2 = vec4<f32>(isotropic_scale, 0.0, 0.0, 0.0);
    row3 = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    next_row4_xy = vec2<f32>(0.0);
  } else {
    let deformation_scale = pow(
      next_volume_ratio_j / row4.z,
      1.0 / 3.0
    );
    if (!mechanics_refresh_finite(deformation_scale) || !(deformation_scale > 0.0)) {
      mechanics_refresh_fail();
      return;
    }
    row0 = row0 * deformation_scale;
    row1 = row1 * deformation_scale;
    row2 = vec4<f32>(
      row2.x * deformation_scale,
      row2.yzw
    );
  }
  if (
    !mechanics_refresh_finite_vec4(row0)
    || !mechanics_refresh_finite_vec4(row1)
    || !mechanics_refresh_finite_vec4(row2)
    || !mechanics_refresh_finite_vec4(row3)
    || !mechanics_refresh_determinant_matches(
      row0,
      row1,
      row2,
      next_volume_ratio_j
    )
  ) {
    mechanics_refresh_fail();
    return;
  }
  out_mechanics[mechanics_base] = row0;
  out_mechanics[mechanics_base + 1u] = row1;
  out_mechanics[mechanics_base + 2u] = row2;
  out_mechanics[mechanics_base + 3u] = row3;
  out_mechanics[mechanics_base + 4u] = vec4<f32>(
    next_row4_xy,
    next_volume_ratio_j,
    rest_volume
  );
  out_mechanics[mechanics_base + 5u] = vec4<f32>(
    phase_mechanics.solid,
    phase_mechanics.status,
    phase_mechanics.bulk,
    phase_mechanics.shear
  );
  out_mechanics[mechanics_base + 6u] = vec4<f32>(
    phase_mechanics.lambda,
    phase_mechanics.sound_speed,
    phase_mechanics.eos_model,
    phase_mechanics.status
  );
  out_mechanics[mechanics_base + 7u] = vec4<f32>(
    row7.x,
    phase_mechanics.dynamic_viscosity,
    phase_mechanics.surface_tension,
    row7.w
  );
}

@compute @workgroup_size(64)
fn commit_or_restore(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (
    particle_index >= params.particle_count
    || atomicLoad(&authority_validation[0u]) == 0u
  ) {
    return;
  }
  let mechanics_base = particle_index * 8u;
  for (var row = 0u; row < 8u; row = row + 1u) {
    out_mechanics[mechanics_base + row] =
      source_mechanics[mechanics_base + row];
  }
}
`;

export const mlsMpmResidentSummaryPartialsWgsl = `
struct ResidentSummaryParams {
  particle_count: u32,
  grid_node_count: u32,
  partial_count: u32,
  base_start_index: u32,
  base_end_index: u32,
  drop_start_index: u32,
  drop_end_index: u32,
  h2o_material_id: u32,
  phase_lineage_capacity: u32,
  phase_lane_count: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> source_sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> next_sph_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> next_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> updated_grid_nodes: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> partial_summaries: array<vec4<f32>>;
@group(0) @binding(6) var<uniform> params: ResidentSummaryParams;
@group(0) @binding(7) var<storage, read> next_sph_thermo: array<vec4<f32>>;

var<workgroup> wg_active_grid_nodes: array<f32, 32>;
var<workgroup> wg_source_mass: array<f32, 32>;
var<workgroup> wg_next_mass: array<f32, 32>;
var<workgroup> wg_source_momentum_x: array<f32, 32>;
var<workgroup> wg_source_momentum_y: array<f32, 32>;
var<workgroup> wg_source_momentum_z: array<f32, 32>;
var<workgroup> wg_next_momentum_x: array<f32, 32>;
var<workgroup> wg_next_momentum_y: array<f32, 32>;
var<workgroup> wg_next_momentum_z: array<f32, 32>;
var<workgroup> wg_max_speed: array<f32, 32>;
var<workgroup> wg_max_displacement: array<f32, 32>;
var<workgroup> wg_min_volume_ratio_j: array<f32, 32>;
var<workgroup> wg_max_volume_ratio_j: array<f32, 32>;
var<workgroup> wg_phase_mass_solid: array<f32, 32>;
var<workgroup> wg_phase_mass_liquid: array<f32, 32>;
var<workgroup> wg_phase_mass_gas: array<f32, 32>;
var<workgroup> wg_phase_mass_plasma: array<f32, 32>;
var<workgroup> wg_temperature_mass_sum: array<f32, 32>;
var<workgroup> wg_min_temperature_k: array<f32, 32>;
var<workgroup> wg_max_temperature_k: array<f32, 32>;
var<workgroup> wg_thermal_ready_count: array<f32, 32>;
var<workgroup> wg_thermal_problem_count: array<f32, 32>;
var<workgroup> wg_finite_temperature_count: array<f32, 32>;
var<workgroup> wg_phase_mass_total: array<f32, 32>;
var<workgroup> wg_source_position_mass_x: array<f32, 32>;
var<workgroup> wg_source_position_mass_y: array<f32, 32>;
var<workgroup> wg_source_position_mass_z: array<f32, 32>;
var<workgroup> wg_next_position_mass_x: array<f32, 32>;
var<workgroup> wg_next_position_mass_y: array<f32, 32>;
var<workgroup> wg_next_position_mass_z: array<f32, 32>;
var<workgroup> wg_source_min_x: array<f32, 32>;
var<workgroup> wg_source_min_y: array<f32, 32>;
var<workgroup> wg_source_min_z: array<f32, 32>;
var<workgroup> wg_source_max_x: array<f32, 32>;
var<workgroup> wg_source_max_y: array<f32, 32>;
var<workgroup> wg_source_max_z: array<f32, 32>;
var<workgroup> wg_next_min_x: array<f32, 32>;
var<workgroup> wg_next_min_y: array<f32, 32>;
var<workgroup> wg_next_min_z: array<f32, 32>;
var<workgroup> wg_next_max_x: array<f32, 32>;
var<workgroup> wg_next_max_y: array<f32, 32>;
var<workgroup> wg_next_max_z: array<f32, 32>;
var<workgroup> wg_source_bounds_status: array<f32, 32>;
var<workgroup> wg_next_bounds_status: array<f32, 32>;
var<workgroup> wg_base_cohort_mass: array<f32, 32>;
var<workgroup> wg_base_cohort_position_mass_x: array<f32, 32>;
var<workgroup> wg_base_cohort_position_mass_y: array<f32, 32>;
var<workgroup> wg_base_cohort_position_mass_z: array<f32, 32>;
var<workgroup> wg_base_cohort_min_x: array<f32, 32>;
var<workgroup> wg_base_cohort_min_y: array<f32, 32>;
var<workgroup> wg_base_cohort_min_z: array<f32, 32>;
var<workgroup> wg_base_cohort_max_x: array<f32, 32>;
var<workgroup> wg_base_cohort_max_y: array<f32, 32>;
var<workgroup> wg_base_cohort_max_z: array<f32, 32>;
var<workgroup> wg_base_cohort_max_speed: array<f32, 32>;
var<workgroup> wg_base_cohort_status: array<f32, 32>;
var<workgroup> wg_drop_cohort_mass: array<f32, 32>;
var<workgroup> wg_drop_cohort_position_mass_x: array<f32, 32>;
var<workgroup> wg_drop_cohort_position_mass_y: array<f32, 32>;
var<workgroup> wg_drop_cohort_position_mass_z: array<f32, 32>;
var<workgroup> wg_drop_cohort_min_x: array<f32, 32>;
var<workgroup> wg_drop_cohort_min_y: array<f32, 32>;
var<workgroup> wg_drop_cohort_min_z: array<f32, 32>;
var<workgroup> wg_drop_cohort_max_x: array<f32, 32>;
var<workgroup> wg_drop_cohort_max_y: array<f32, 32>;
var<workgroup> wg_drop_cohort_max_z: array<f32, 32>;
var<workgroup> wg_drop_cohort_max_speed: array<f32, 32>;
var<workgroup> wg_drop_cohort_status: array<f32, 32>;
var<workgroup> wg_h2o_gas_mass: array<f32, 32>;
var<workgroup> wg_h2o_gas_temperature_mass_sum: array<f32, 32>;
var<workgroup> wg_h2o_gas_phase_weight: array<f32, 32>;

@compute @workgroup_size(32)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let index = global_id.x;
  let lane = local_id.x;

  var active_grid_nodes = 0.0;
  if (index < params.grid_node_count) {
    let row0 = updated_grid_nodes[index * 2u];
    if (row0.x > 0.0) {
      active_grid_nodes = 1.0;
    }
  }

  var source_mass = 0.0;
  var next_mass = 0.0;
  var source_momentum = vec3<f32>(0.0);
  var next_momentum = vec3<f32>(0.0);
  var max_speed2 = 0.0;
  var max_displacement2 = 0.0;
  var min_volume_ratio_j = 3.4028234663852886e38;
  var max_volume_ratio_j = 0.0;
  var phase_mass_solid = 0.0;
  var phase_mass_liquid = 0.0;
  var phase_mass_gas = 0.0;
  var phase_mass_plasma = 0.0;
  var temperature_mass_sum = 0.0;
  var min_temperature_k = 3.4028234663852886e38;
  var max_temperature_k = 0.0;
  var thermal_ready_count = 0.0;
  var thermal_problem_count = 0.0;
  var finite_temperature_count = 0.0;
  var phase_mass_total = 0.0;
  var source_position_mass = vec3<f32>(0.0);
  var next_position_mass = vec3<f32>(0.0);
  var source_min = vec3<f32>(3.4028234663852886e38);
  var source_max = vec3<f32>(-3.4028234663852886e38);
  var next_min = vec3<f32>(3.4028234663852886e38);
  var next_max = vec3<f32>(-3.4028234663852886e38);
  var source_bounds_status = 0.0;
  var next_bounds_status = 0.0;
  var base_cohort_mass = 0.0;
  var base_cohort_position_mass = vec3<f32>(0.0);
  var base_cohort_min = vec3<f32>(3.4028234663852886e38);
  var base_cohort_max = vec3<f32>(-3.4028234663852886e38);
  var base_cohort_max_speed2 = 0.0;
  var base_cohort_status = 0.0;
  var drop_cohort_mass = 0.0;
  var drop_cohort_position_mass = vec3<f32>(0.0);
  var drop_cohort_min = vec3<f32>(3.4028234663852886e38);
  var drop_cohort_max = vec3<f32>(-3.4028234663852886e38);
  var drop_cohort_max_speed2 = 0.0;
  var drop_cohort_status = 0.0;
  var h2o_gas_mass = 0.0;
  var h2o_gas_temperature_mass_sum = 0.0;
  var h2o_gas_phase_weight = 0.0;

  if (index < params.particle_count) {
    let state_base = index * 2u;
    let thermo_base = index * 3u;
    let mechanics_base = index * 8u;
    let source_pos_mass = source_sph_state[state_base];
    let source_vel_u = source_sph_state[state_base + 1u];
    let next_pos_mass = next_sph_state[state_base];
    let next_vel_u = next_sph_state[state_base + 1u];
    let thermo_row0 = next_sph_thermo[thermo_base];
    let thermo_row1 = next_sph_thermo[thermo_base + 1u];
    let thermo_row2 = next_sph_thermo[thermo_base + 2u];
    // Phase-lane storage deliberately preserves state while its mass is zero.
    // Every next-state diagnostic must therefore use live mass as its
    // admission predicate instead of interpreting dormant payload values.
    let next_particle_live = next_pos_mass.w > 0.0;

    source_mass = source_mass + source_pos_mass.w;
    next_mass = next_mass + next_pos_mass.w;
    if (source_pos_mass.w > 0.0) {
      source_momentum = source_momentum + source_pos_mass.w * source_vel_u.xyz;
      source_position_mass = source_position_mass + source_pos_mass.w * source_pos_mass.xyz;
      source_min = min(source_min, source_pos_mass.xyz);
      source_max = max(source_max, source_pos_mass.xyz);
      source_bounds_status = 1.0;
    }
    if (next_particle_live) {
      next_momentum = next_momentum + next_pos_mass.w * next_vel_u.xyz;
      next_position_mass = next_position_mass + next_pos_mass.w * next_pos_mass.xyz;
      next_min = min(next_min, next_pos_mass.xyz);
      next_max = max(next_max, next_pos_mass.xyz);
      next_bounds_status = 1.0;
      max_speed2 = max(max_speed2, dot(next_vel_u.xyz, next_vel_u.xyz));
      let displacement = next_pos_mass.xyz - source_pos_mass.xyz;
      max_displacement2 = max(max_displacement2, dot(displacement, displacement));
    }
    let particle_speed2 = dot(next_vel_u.xyz, next_vel_u.xyz);
    let phase_lineage_v2 = params.phase_lineage_capacity > 0u
      && params.phase_lane_count == 4u
      && params.phase_lineage_capacity * params.phase_lane_count == params.particle_count;
    let cohort_index = select(
      index,
      index % max(params.phase_lineage_capacity, 1u),
      phase_lineage_v2
    );
    let in_base_cohort = cohort_index >= params.base_start_index
      && cohort_index < params.base_end_index;
    let in_drop_cohort = cohort_index >= params.drop_start_index
      && cohort_index < params.drop_end_index;
    if (in_base_cohort && next_particle_live) {
      base_cohort_mass = base_cohort_mass + next_pos_mass.w;
      base_cohort_position_mass = base_cohort_position_mass + next_pos_mass.w * next_pos_mass.xyz;
      base_cohort_min = min(base_cohort_min, next_pos_mass.xyz);
      base_cohort_max = max(base_cohort_max, next_pos_mass.xyz);
      base_cohort_max_speed2 = max(base_cohort_max_speed2, particle_speed2);
      base_cohort_status = 1.0;
    }
    if (in_drop_cohort && next_particle_live) {
      drop_cohort_mass = drop_cohort_mass + next_pos_mass.w;
      drop_cohort_position_mass = drop_cohort_position_mass + next_pos_mass.w * next_pos_mass.xyz;
      drop_cohort_min = min(drop_cohort_min, next_pos_mass.xyz);
      drop_cohort_max = max(drop_cohort_max, next_pos_mass.xyz);
      drop_cohort_max_speed2 = max(drop_cohort_max_speed2, particle_speed2);
      drop_cohort_status = 1.0;
    }

    let next_j = next_mls_mechanics[mechanics_base + 4u].z;
    if (next_particle_live) {
      min_volume_ratio_j = min(min_volume_ratio_j, next_j);
      max_volume_ratio_j = max(max_volume_ratio_j, next_j);

      let particle_mass = next_pos_mass.w;
      let phase_fractions = max(thermo_row1, vec4<f32>(0.0));
      phase_mass_solid = phase_mass_solid + particle_mass * phase_fractions.x;
      phase_mass_liquid = phase_mass_liquid + particle_mass * phase_fractions.y;
      phase_mass_gas = phase_mass_gas + particle_mass * phase_fractions.z;
      phase_mass_plasma = phase_mass_plasma + particle_mass * phase_fractions.w;
      phase_mass_total = phase_mass_total + particle_mass * (
        phase_fractions.x + phase_fractions.y + phase_fractions.z + phase_fractions.w
      );

      let temperature_k = thermo_row0.z;
      let particle_h2o_gas_mass = particle_mass * phase_fractions.z;
      if (u32(round(thermo_row0.x)) == params.h2o_material_id && particle_h2o_gas_mass > 0.0) {
        h2o_gas_mass = h2o_gas_mass + particle_h2o_gas_mass;
        h2o_gas_phase_weight = h2o_gas_phase_weight + phase_fractions.z;
        if (temperature_k >= 0.0 && temperature_k <= 3.4028234663852886e38) {
          h2o_gas_temperature_mass_sum = h2o_gas_temperature_mass_sum
            + particle_h2o_gas_mass * temperature_k;
        }
      }
      let finite_nonnegative_temperature = temperature_k >= 0.0
        && temperature_k <= 3.4028234663852886e38;
      if (finite_nonnegative_temperature) {
        temperature_mass_sum = temperature_mass_sum + particle_mass * temperature_k;
        min_temperature_k = min(min_temperature_k, temperature_k);
        max_temperature_k = max(max_temperature_k, temperature_k);
        finite_temperature_count = finite_temperature_count + 1.0;
      }
      if (thermo_row2.z == 1.0) {
        thermal_ready_count = thermal_ready_count + 1.0;
      } else {
        thermal_problem_count = thermal_problem_count + 1.0;
      }
    }
  }

  wg_active_grid_nodes[lane] = active_grid_nodes;
  wg_source_mass[lane] = source_mass;
  wg_next_mass[lane] = next_mass;
  wg_source_momentum_x[lane] = source_momentum.x;
  wg_source_momentum_y[lane] = source_momentum.y;
  wg_source_momentum_z[lane] = source_momentum.z;
  wg_next_momentum_x[lane] = next_momentum.x;
  wg_next_momentum_y[lane] = next_momentum.y;
  wg_next_momentum_z[lane] = next_momentum.z;
  wg_max_speed[lane] = sqrt(max_speed2);
  wg_max_displacement[lane] = sqrt(max_displacement2);
  wg_min_volume_ratio_j[lane] = min_volume_ratio_j;
  wg_max_volume_ratio_j[lane] = max_volume_ratio_j;
  wg_phase_mass_solid[lane] = phase_mass_solid;
  wg_phase_mass_liquid[lane] = phase_mass_liquid;
  wg_phase_mass_gas[lane] = phase_mass_gas;
  wg_phase_mass_plasma[lane] = phase_mass_plasma;
  wg_temperature_mass_sum[lane] = temperature_mass_sum;
  wg_min_temperature_k[lane] = min_temperature_k;
  wg_max_temperature_k[lane] = max_temperature_k;
  wg_thermal_ready_count[lane] = thermal_ready_count;
  wg_thermal_problem_count[lane] = thermal_problem_count;
  wg_finite_temperature_count[lane] = finite_temperature_count;
  wg_phase_mass_total[lane] = phase_mass_total;
  wg_source_position_mass_x[lane] = source_position_mass.x;
  wg_source_position_mass_y[lane] = source_position_mass.y;
  wg_source_position_mass_z[lane] = source_position_mass.z;
  wg_next_position_mass_x[lane] = next_position_mass.x;
  wg_next_position_mass_y[lane] = next_position_mass.y;
  wg_next_position_mass_z[lane] = next_position_mass.z;
  wg_source_min_x[lane] = source_min.x;
  wg_source_min_y[lane] = source_min.y;
  wg_source_min_z[lane] = source_min.z;
  wg_source_max_x[lane] = source_max.x;
  wg_source_max_y[lane] = source_max.y;
  wg_source_max_z[lane] = source_max.z;
  wg_next_min_x[lane] = next_min.x;
  wg_next_min_y[lane] = next_min.y;
  wg_next_min_z[lane] = next_min.z;
  wg_next_max_x[lane] = next_max.x;
  wg_next_max_y[lane] = next_max.y;
  wg_next_max_z[lane] = next_max.z;
  wg_source_bounds_status[lane] = source_bounds_status;
  wg_next_bounds_status[lane] = next_bounds_status;
  wg_base_cohort_mass[lane] = base_cohort_mass;
  wg_base_cohort_position_mass_x[lane] = base_cohort_position_mass.x;
  wg_base_cohort_position_mass_y[lane] = base_cohort_position_mass.y;
  wg_base_cohort_position_mass_z[lane] = base_cohort_position_mass.z;
  wg_base_cohort_min_x[lane] = base_cohort_min.x;
  wg_base_cohort_min_y[lane] = base_cohort_min.y;
  wg_base_cohort_min_z[lane] = base_cohort_min.z;
  wg_base_cohort_max_x[lane] = base_cohort_max.x;
  wg_base_cohort_max_y[lane] = base_cohort_max.y;
  wg_base_cohort_max_z[lane] = base_cohort_max.z;
  wg_base_cohort_max_speed[lane] = sqrt(base_cohort_max_speed2);
  wg_base_cohort_status[lane] = base_cohort_status;
  wg_drop_cohort_mass[lane] = drop_cohort_mass;
  wg_drop_cohort_position_mass_x[lane] = drop_cohort_position_mass.x;
  wg_drop_cohort_position_mass_y[lane] = drop_cohort_position_mass.y;
  wg_drop_cohort_position_mass_z[lane] = drop_cohort_position_mass.z;
  wg_drop_cohort_min_x[lane] = drop_cohort_min.x;
  wg_drop_cohort_min_y[lane] = drop_cohort_min.y;
  wg_drop_cohort_min_z[lane] = drop_cohort_min.z;
  wg_drop_cohort_max_x[lane] = drop_cohort_max.x;
  wg_drop_cohort_max_y[lane] = drop_cohort_max.y;
  wg_drop_cohort_max_z[lane] = drop_cohort_max.z;
  wg_drop_cohort_max_speed[lane] = sqrt(drop_cohort_max_speed2);
  wg_drop_cohort_status[lane] = drop_cohort_status;
  wg_h2o_gas_mass[lane] = h2o_gas_mass;
  wg_h2o_gas_temperature_mass_sum[lane] = h2o_gas_temperature_mass_sum;
  wg_h2o_gas_phase_weight[lane] = h2o_gas_phase_weight;
  workgroupBarrier();

  var stride = 16u;
  loop {
    if (lane < stride) {
      let other = lane + stride;
      wg_active_grid_nodes[lane] = wg_active_grid_nodes[lane] + wg_active_grid_nodes[other];
      wg_source_mass[lane] = wg_source_mass[lane] + wg_source_mass[other];
      wg_next_mass[lane] = wg_next_mass[lane] + wg_next_mass[other];
      wg_source_momentum_x[lane] = wg_source_momentum_x[lane] + wg_source_momentum_x[other];
      wg_source_momentum_y[lane] = wg_source_momentum_y[lane] + wg_source_momentum_y[other];
      wg_source_momentum_z[lane] = wg_source_momentum_z[lane] + wg_source_momentum_z[other];
      wg_next_momentum_x[lane] = wg_next_momentum_x[lane] + wg_next_momentum_x[other];
      wg_next_momentum_y[lane] = wg_next_momentum_y[lane] + wg_next_momentum_y[other];
      wg_next_momentum_z[lane] = wg_next_momentum_z[lane] + wg_next_momentum_z[other];
      wg_max_speed[lane] = max(wg_max_speed[lane], wg_max_speed[other]);
      wg_max_displacement[lane] = max(wg_max_displacement[lane], wg_max_displacement[other]);
      wg_min_volume_ratio_j[lane] = min(wg_min_volume_ratio_j[lane], wg_min_volume_ratio_j[other]);
      wg_max_volume_ratio_j[lane] = max(wg_max_volume_ratio_j[lane], wg_max_volume_ratio_j[other]);
      wg_phase_mass_solid[lane] = wg_phase_mass_solid[lane] + wg_phase_mass_solid[other];
      wg_phase_mass_liquid[lane] = wg_phase_mass_liquid[lane] + wg_phase_mass_liquid[other];
      wg_phase_mass_gas[lane] = wg_phase_mass_gas[lane] + wg_phase_mass_gas[other];
      wg_phase_mass_plasma[lane] = wg_phase_mass_plasma[lane] + wg_phase_mass_plasma[other];
      wg_temperature_mass_sum[lane] = wg_temperature_mass_sum[lane] + wg_temperature_mass_sum[other];
      wg_min_temperature_k[lane] = min(wg_min_temperature_k[lane], wg_min_temperature_k[other]);
      wg_max_temperature_k[lane] = max(wg_max_temperature_k[lane], wg_max_temperature_k[other]);
      wg_thermal_ready_count[lane] = wg_thermal_ready_count[lane] + wg_thermal_ready_count[other];
      wg_thermal_problem_count[lane] = wg_thermal_problem_count[lane] + wg_thermal_problem_count[other];
      wg_finite_temperature_count[lane] = wg_finite_temperature_count[lane] + wg_finite_temperature_count[other];
      wg_phase_mass_total[lane] = wg_phase_mass_total[lane] + wg_phase_mass_total[other];
      wg_source_position_mass_x[lane] = wg_source_position_mass_x[lane] + wg_source_position_mass_x[other];
      wg_source_position_mass_y[lane] = wg_source_position_mass_y[lane] + wg_source_position_mass_y[other];
      wg_source_position_mass_z[lane] = wg_source_position_mass_z[lane] + wg_source_position_mass_z[other];
      wg_next_position_mass_x[lane] = wg_next_position_mass_x[lane] + wg_next_position_mass_x[other];
      wg_next_position_mass_y[lane] = wg_next_position_mass_y[lane] + wg_next_position_mass_y[other];
      wg_next_position_mass_z[lane] = wg_next_position_mass_z[lane] + wg_next_position_mass_z[other];
      wg_source_min_x[lane] = min(wg_source_min_x[lane], wg_source_min_x[other]);
      wg_source_min_y[lane] = min(wg_source_min_y[lane], wg_source_min_y[other]);
      wg_source_min_z[lane] = min(wg_source_min_z[lane], wg_source_min_z[other]);
      wg_source_max_x[lane] = max(wg_source_max_x[lane], wg_source_max_x[other]);
      wg_source_max_y[lane] = max(wg_source_max_y[lane], wg_source_max_y[other]);
      wg_source_max_z[lane] = max(wg_source_max_z[lane], wg_source_max_z[other]);
      wg_next_min_x[lane] = min(wg_next_min_x[lane], wg_next_min_x[other]);
      wg_next_min_y[lane] = min(wg_next_min_y[lane], wg_next_min_y[other]);
      wg_next_min_z[lane] = min(wg_next_min_z[lane], wg_next_min_z[other]);
      wg_next_max_x[lane] = max(wg_next_max_x[lane], wg_next_max_x[other]);
      wg_next_max_y[lane] = max(wg_next_max_y[lane], wg_next_max_y[other]);
      wg_next_max_z[lane] = max(wg_next_max_z[lane], wg_next_max_z[other]);
      wg_source_bounds_status[lane] = max(wg_source_bounds_status[lane], wg_source_bounds_status[other]);
      wg_next_bounds_status[lane] = max(wg_next_bounds_status[lane], wg_next_bounds_status[other]);
      wg_base_cohort_mass[lane] = wg_base_cohort_mass[lane] + wg_base_cohort_mass[other];
      wg_base_cohort_position_mass_x[lane] = wg_base_cohort_position_mass_x[lane] + wg_base_cohort_position_mass_x[other];
      wg_base_cohort_position_mass_y[lane] = wg_base_cohort_position_mass_y[lane] + wg_base_cohort_position_mass_y[other];
      wg_base_cohort_position_mass_z[lane] = wg_base_cohort_position_mass_z[lane] + wg_base_cohort_position_mass_z[other];
      wg_base_cohort_min_x[lane] = min(wg_base_cohort_min_x[lane], wg_base_cohort_min_x[other]);
      wg_base_cohort_min_y[lane] = min(wg_base_cohort_min_y[lane], wg_base_cohort_min_y[other]);
      wg_base_cohort_min_z[lane] = min(wg_base_cohort_min_z[lane], wg_base_cohort_min_z[other]);
      wg_base_cohort_max_x[lane] = max(wg_base_cohort_max_x[lane], wg_base_cohort_max_x[other]);
      wg_base_cohort_max_y[lane] = max(wg_base_cohort_max_y[lane], wg_base_cohort_max_y[other]);
      wg_base_cohort_max_z[lane] = max(wg_base_cohort_max_z[lane], wg_base_cohort_max_z[other]);
      wg_base_cohort_max_speed[lane] = max(wg_base_cohort_max_speed[lane], wg_base_cohort_max_speed[other]);
      wg_base_cohort_status[lane] = max(wg_base_cohort_status[lane], wg_base_cohort_status[other]);
      wg_drop_cohort_mass[lane] = wg_drop_cohort_mass[lane] + wg_drop_cohort_mass[other];
      wg_drop_cohort_position_mass_x[lane] = wg_drop_cohort_position_mass_x[lane] + wg_drop_cohort_position_mass_x[other];
      wg_drop_cohort_position_mass_y[lane] = wg_drop_cohort_position_mass_y[lane] + wg_drop_cohort_position_mass_y[other];
      wg_drop_cohort_position_mass_z[lane] = wg_drop_cohort_position_mass_z[lane] + wg_drop_cohort_position_mass_z[other];
      wg_drop_cohort_min_x[lane] = min(wg_drop_cohort_min_x[lane], wg_drop_cohort_min_x[other]);
      wg_drop_cohort_min_y[lane] = min(wg_drop_cohort_min_y[lane], wg_drop_cohort_min_y[other]);
      wg_drop_cohort_min_z[lane] = min(wg_drop_cohort_min_z[lane], wg_drop_cohort_min_z[other]);
      wg_drop_cohort_max_x[lane] = max(wg_drop_cohort_max_x[lane], wg_drop_cohort_max_x[other]);
      wg_drop_cohort_max_y[lane] = max(wg_drop_cohort_max_y[lane], wg_drop_cohort_max_y[other]);
      wg_drop_cohort_max_z[lane] = max(wg_drop_cohort_max_z[lane], wg_drop_cohort_max_z[other]);
      wg_drop_cohort_max_speed[lane] = max(wg_drop_cohort_max_speed[lane], wg_drop_cohort_max_speed[other]);
      wg_drop_cohort_status[lane] = max(wg_drop_cohort_status[lane], wg_drop_cohort_status[other]);
      wg_h2o_gas_mass[lane] = wg_h2o_gas_mass[lane] + wg_h2o_gas_mass[other];
      wg_h2o_gas_temperature_mass_sum[lane] = wg_h2o_gas_temperature_mass_sum[lane]
        + wg_h2o_gas_temperature_mass_sum[other];
      wg_h2o_gas_phase_weight[lane] = wg_h2o_gas_phase_weight[lane] + wg_h2o_gas_phase_weight[other];
    }
    workgroupBarrier();
    if (stride == 1u) {
      break;
    }
    stride = stride / 2u;
  }

  if (lane == 0u) {
    let partial_base = workgroup_id.x * 22u;
    let momentum_delta = vec3<f32>(
      wg_next_momentum_x[0u] - wg_source_momentum_x[0u],
      wg_next_momentum_y[0u] - wg_source_momentum_y[0u],
      wg_next_momentum_z[0u] - wg_source_momentum_z[0u]
    );
    partial_summaries[partial_base] = vec4<f32>(
      0.0,
      0.0,
      wg_active_grid_nodes[0u],
      wg_source_mass[0u]
    );
    partial_summaries[partial_base + 1u] = vec4<f32>(
      wg_next_mass[0u],
      wg_next_mass[0u] - wg_source_mass[0u],
      wg_source_momentum_x[0u],
      wg_source_momentum_y[0u]
    );
    partial_summaries[partial_base + 2u] = vec4<f32>(
      wg_source_momentum_z[0u],
      wg_next_momentum_x[0u],
      wg_next_momentum_y[0u],
      wg_next_momentum_z[0u]
    );
    partial_summaries[partial_base + 3u] = vec4<f32>(
      momentum_delta.x,
      momentum_delta.y,
      momentum_delta.z,
      wg_max_speed[0u]
    );
    partial_summaries[partial_base + 4u] = vec4<f32>(
      wg_max_displacement[0u],
      wg_min_volume_ratio_j[0u],
      wg_max_volume_ratio_j[0u],
      1.0
    );
    partial_summaries[partial_base + 5u] = vec4<f32>(
      wg_phase_mass_solid[0u],
      wg_phase_mass_liquid[0u],
      wg_phase_mass_gas[0u],
      wg_phase_mass_plasma[0u]
    );
    partial_summaries[partial_base + 6u] = vec4<f32>(
      wg_temperature_mass_sum[0u],
      wg_min_temperature_k[0u],
      wg_max_temperature_k[0u],
      wg_thermal_ready_count[0u]
    );
    partial_summaries[partial_base + 7u] = vec4<f32>(
      wg_thermal_problem_count[0u],
      wg_finite_temperature_count[0u],
      wg_phase_mass_total[0u],
      1.0
    );
    partial_summaries[partial_base + 8u] = vec4<f32>(
      wg_source_position_mass_x[0u],
      wg_source_position_mass_y[0u],
      wg_source_position_mass_z[0u],
      wg_next_position_mass_x[0u]
    );
    partial_summaries[partial_base + 9u] = vec4<f32>(
      wg_next_position_mass_y[0u],
      wg_next_position_mass_z[0u],
      wg_source_min_x[0u],
      wg_source_min_y[0u]
    );
    partial_summaries[partial_base + 10u] = vec4<f32>(
      wg_source_min_z[0u],
      wg_source_max_x[0u],
      wg_source_max_y[0u],
      wg_source_max_z[0u]
    );
    partial_summaries[partial_base + 11u] = vec4<f32>(
      wg_next_min_x[0u],
      wg_next_min_y[0u],
      wg_next_min_z[0u],
      wg_next_max_x[0u]
    );
    partial_summaries[partial_base + 12u] = vec4<f32>(
      wg_next_max_y[0u],
      wg_next_max_z[0u],
      wg_source_bounds_status[0u],
      wg_next_bounds_status[0u]
    );
    partial_summaries[partial_base + 13u] = vec4<f32>(
      wg_source_mass[0u],
      wg_next_mass[0u],
      0.0,
      0.0
    );
    partial_summaries[partial_base + 14u] = vec4<f32>(
      max(wg_base_cohort_status[0u], wg_drop_cohort_status[0u]),
      f32(params.base_start_index),
      f32(params.base_end_index),
      f32(params.drop_start_index)
    );
    partial_summaries[partial_base + 15u] = vec4<f32>(
      f32(params.drop_end_index),
      wg_base_cohort_mass[0u],
      wg_base_cohort_position_mass_x[0u],
      wg_base_cohort_position_mass_y[0u]
    );
    partial_summaries[partial_base + 16u] = vec4<f32>(
      wg_base_cohort_position_mass_z[0u],
      wg_base_cohort_min_x[0u],
      wg_base_cohort_min_y[0u],
      wg_base_cohort_min_z[0u]
    );
    partial_summaries[partial_base + 17u] = vec4<f32>(
      wg_base_cohort_max_x[0u],
      wg_base_cohort_max_y[0u],
      wg_base_cohort_max_z[0u],
      wg_base_cohort_max_speed[0u]
    );
    partial_summaries[partial_base + 18u] = vec4<f32>(
      wg_drop_cohort_mass[0u],
      wg_drop_cohort_position_mass_x[0u],
      wg_drop_cohort_position_mass_y[0u],
      wg_drop_cohort_position_mass_z[0u]
    );
    partial_summaries[partial_base + 19u] = vec4<f32>(
      wg_drop_cohort_min_x[0u],
      wg_drop_cohort_min_y[0u],
      wg_drop_cohort_min_z[0u],
      wg_drop_cohort_max_x[0u]
    );
    partial_summaries[partial_base + 20u] = vec4<f32>(
      wg_drop_cohort_max_y[0u],
      wg_drop_cohort_max_z[0u],
      wg_drop_cohort_max_speed[0u],
      0.0
    );
    partial_summaries[partial_base + 21u] = vec4<f32>(
      wg_h2o_gas_mass[0u],
      wg_h2o_gas_temperature_mass_sum[0u],
      wg_h2o_gas_phase_weight[0u],
      select(0.0, 1.0, params.h2o_material_id > 0u)
    );
  }
}
`;

export const mlsMpmResidentSummaryFinalizeWgsl = `
struct ResidentSummaryParams {
  particle_count: u32,
  grid_node_count: u32,
  partial_count: u32,
  base_start_index: u32,
  base_end_index: u32,
  drop_start_index: u32,
  drop_end_index: u32,
  h2o_material_id: u32,
  phase_lineage_capacity: u32,
  phase_lane_count: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> partial_summaries: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> resident_summary: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: ResidentSummaryParams;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x > 0u) {
    return;
  }

  var active_grid_nodes = 0.0;
  var source_mass = 0.0;
  var next_mass = 0.0;
  var source_momentum = vec3<f32>(0.0);
  var next_momentum = vec3<f32>(0.0);
  var max_speed = 0.0;
  var max_displacement = 0.0;
  var min_volume_ratio_j = 3.4028234663852886e38;
  var max_volume_ratio_j = 0.0;
  var phase_mass_solid = 0.0;
  var phase_mass_liquid = 0.0;
  var phase_mass_gas = 0.0;
  var phase_mass_plasma = 0.0;
  var temperature_mass_sum = 0.0;
  var min_temperature_k = 3.4028234663852886e38;
  var max_temperature_k = 0.0;
  var thermal_ready_count = 0.0;
  var thermal_problem_count = 0.0;
  var finite_temperature_count = 0.0;
  var phase_mass_total = 0.0;
  var source_position_mass = vec3<f32>(0.0);
  var next_position_mass = vec3<f32>(0.0);
  var source_min = vec3<f32>(3.4028234663852886e38);
  var source_max = vec3<f32>(-3.4028234663852886e38);
  var next_min = vec3<f32>(3.4028234663852886e38);
  var next_max = vec3<f32>(-3.4028234663852886e38);
  var source_bounds_status = 0.0;
  var next_bounds_status = 0.0;
  var source_position_mass_total = 0.0;
  var next_position_mass_total = 0.0;
  var cohort_summary_status = 0.0;
  var base_cohort_mass = 0.0;
  var base_cohort_position_mass = vec3<f32>(0.0);
  var base_cohort_min = vec3<f32>(3.4028234663852886e38);
  var base_cohort_max = vec3<f32>(-3.4028234663852886e38);
  var base_cohort_max_speed = 0.0;
  var drop_cohort_mass = 0.0;
  var drop_cohort_position_mass = vec3<f32>(0.0);
  var drop_cohort_min = vec3<f32>(3.4028234663852886e38);
  var drop_cohort_max = vec3<f32>(-3.4028234663852886e38);
  var drop_cohort_max_speed = 0.0;
  var h2o_gas_mass = 0.0;
  var h2o_gas_temperature_mass_sum = 0.0;
  var h2o_gas_phase_weight = 0.0;
  var h2o_gas_summary_status = 0.0;

  for (var partial_index = 0u; partial_index < params.partial_count; partial_index = partial_index + 1u) {
    let base = partial_index * 22u;
    let row0 = partial_summaries[base];
    let row1 = partial_summaries[base + 1u];
    let row2 = partial_summaries[base + 2u];
    let row3 = partial_summaries[base + 3u];
    let row4 = partial_summaries[base + 4u];
    let row5 = partial_summaries[base + 5u];
    let row6 = partial_summaries[base + 6u];
    let row7 = partial_summaries[base + 7u];
    let row8 = partial_summaries[base + 8u];
    let row9 = partial_summaries[base + 9u];
    let row10 = partial_summaries[base + 10u];
    let row11 = partial_summaries[base + 11u];
    let row12 = partial_summaries[base + 12u];
    let row13 = partial_summaries[base + 13u];
    let row14 = partial_summaries[base + 14u];
    let row15 = partial_summaries[base + 15u];
    let row16 = partial_summaries[base + 16u];
    let row17 = partial_summaries[base + 17u];
    let row18 = partial_summaries[base + 18u];
    let row19 = partial_summaries[base + 19u];
    let row20 = partial_summaries[base + 20u];
    let row21 = partial_summaries[base + 21u];
    active_grid_nodes = active_grid_nodes + row0.z;
    source_mass = source_mass + row0.w;
    next_mass = next_mass + row1.x;
    source_momentum = source_momentum + vec3<f32>(row1.z, row1.w, row2.x);
    next_momentum = next_momentum + vec3<f32>(row2.y, row2.z, row2.w);
    max_speed = max(max_speed, row3.w);
    max_displacement = max(max_displacement, row4.x);
    min_volume_ratio_j = min(min_volume_ratio_j, row4.y);
    max_volume_ratio_j = max(max_volume_ratio_j, row4.z);
    phase_mass_solid = phase_mass_solid + row5.x;
    phase_mass_liquid = phase_mass_liquid + row5.y;
    phase_mass_gas = phase_mass_gas + row5.z;
    phase_mass_plasma = phase_mass_plasma + row5.w;
    temperature_mass_sum = temperature_mass_sum + row6.x;
    min_temperature_k = min(min_temperature_k, row6.y);
    max_temperature_k = max(max_temperature_k, row6.z);
    thermal_ready_count = thermal_ready_count + row6.w;
    thermal_problem_count = thermal_problem_count + row7.x;
    finite_temperature_count = finite_temperature_count + row7.y;
    phase_mass_total = phase_mass_total + row7.z;
    source_position_mass = source_position_mass + vec3<f32>(row8.x, row8.y, row8.z);
    next_position_mass = next_position_mass + vec3<f32>(row8.w, row9.x, row9.y);
    source_min = min(source_min, vec3<f32>(row9.z, row9.w, row10.x));
    source_max = max(source_max, vec3<f32>(row10.y, row10.z, row10.w));
    next_min = min(next_min, vec3<f32>(row11.x, row11.y, row11.z));
    next_max = max(next_max, vec3<f32>(row11.w, row12.x, row12.y));
    source_bounds_status = max(source_bounds_status, row12.z);
    next_bounds_status = max(next_bounds_status, row12.w);
    source_position_mass_total = source_position_mass_total + row13.x;
    next_position_mass_total = next_position_mass_total + row13.y;
    cohort_summary_status = max(cohort_summary_status, row14.x);
    base_cohort_mass = base_cohort_mass + row15.y;
    base_cohort_position_mass = base_cohort_position_mass + vec3<f32>(row15.z, row15.w, row16.x);
    base_cohort_min = min(base_cohort_min, vec3<f32>(row16.y, row16.z, row16.w));
    base_cohort_max = max(base_cohort_max, vec3<f32>(row17.x, row17.y, row17.z));
    base_cohort_max_speed = max(base_cohort_max_speed, row17.w);
    drop_cohort_mass = drop_cohort_mass + row18.x;
    drop_cohort_position_mass = drop_cohort_position_mass + vec3<f32>(row18.y, row18.z, row18.w);
    drop_cohort_min = min(drop_cohort_min, vec3<f32>(row19.x, row19.y, row19.z));
    drop_cohort_max = max(drop_cohort_max, vec3<f32>(row19.w, row20.x, row20.y));
    drop_cohort_max_speed = max(drop_cohort_max_speed, row20.z);
    h2o_gas_mass = h2o_gas_mass + row21.x;
    h2o_gas_temperature_mass_sum = h2o_gas_temperature_mass_sum + row21.y;
    h2o_gas_phase_weight = h2o_gas_phase_weight + row21.z;
    h2o_gas_summary_status = max(h2o_gas_summary_status, row21.w);
  }

  if (next_bounds_status == 0.0) {
    min_volume_ratio_j = 0.0;
    max_volume_ratio_j = 0.0;
  }
  if (finite_temperature_count == 0.0) {
    min_temperature_k = 0.0;
    max_temperature_k = 0.0;
  }

  var temperature_mass_weighted_mean_k = 0.0;
  if (phase_mass_total > 0.0) {
    temperature_mass_weighted_mean_k = temperature_mass_sum / phase_mass_total;
  }
  var h2o_gas_temperature_mass_weighted_mean_k = 0.0;
  if (h2o_gas_mass > 0.0) {
    h2o_gas_temperature_mass_weighted_mean_k = h2o_gas_temperature_mass_sum / h2o_gas_mass;
  }
  var source_center_of_mass = vec3<f32>(0.0);
  if (source_position_mass_total > 0.0) {
    source_center_of_mass = source_position_mass / source_position_mass_total;
  }
  var next_center_of_mass = vec3<f32>(0.0);
  if (next_position_mass_total > 0.0) {
    next_center_of_mass = next_position_mass / next_position_mass_total;
  }
  if (source_bounds_status == 0.0) {
    source_min = vec3<f32>(0.0);
    source_max = vec3<f32>(0.0);
  }
  if (next_bounds_status == 0.0) {
    next_min = vec3<f32>(0.0);
    next_max = vec3<f32>(0.0);
  }
  var base_cohort_center = vec3<f32>(0.0);
  if (base_cohort_mass > 0.0) {
    base_cohort_center = base_cohort_position_mass / base_cohort_mass;
  } else {
    base_cohort_min = vec3<f32>(0.0);
    base_cohort_max = vec3<f32>(0.0);
  }
  var drop_cohort_center = vec3<f32>(0.0);
  if (drop_cohort_mass > 0.0) {
    drop_cohort_center = drop_cohort_position_mass / drop_cohort_mass;
  } else {
    drop_cohort_min = vec3<f32>(0.0);
    drop_cohort_max = vec3<f32>(0.0);
  }

  let momentum_delta = next_momentum - source_momentum;
  resident_summary[0u] = vec4<f32>(
    f32(params.particle_count),
    f32(params.grid_node_count),
    active_grid_nodes,
    source_mass
  );
  resident_summary[1u] = vec4<f32>(
    next_mass,
    next_mass - source_mass,
    source_momentum.x,
    source_momentum.y
  );
  resident_summary[2u] = vec4<f32>(
    source_momentum.z,
    next_momentum.x,
    next_momentum.y,
    next_momentum.z
  );
  resident_summary[3u] = vec4<f32>(
    momentum_delta.x,
    momentum_delta.y,
    momentum_delta.z,
    max_speed
  );
  resident_summary[4u] = vec4<f32>(
    max_displacement,
    min_volume_ratio_j,
    max_volume_ratio_j,
    1.0
  );
  resident_summary[5u] = vec4<f32>(
    phase_mass_solid,
    phase_mass_liquid,
    phase_mass_gas,
    phase_mass_plasma
  );
  resident_summary[6u] = vec4<f32>(
    temperature_mass_weighted_mean_k,
    min_temperature_k,
    max_temperature_k,
    thermal_ready_count
  );
  resident_summary[7u] = vec4<f32>(
    thermal_problem_count,
    finite_temperature_count,
    phase_mass_total,
    1.0
  );
  resident_summary[8u] = vec4<f32>(
    source_center_of_mass.x,
    source_center_of_mass.y,
    source_center_of_mass.z,
    next_center_of_mass.x
  );
  resident_summary[9u] = vec4<f32>(
    next_center_of_mass.y,
    next_center_of_mass.z,
    source_min.x,
    source_min.y
  );
  resident_summary[10u] = vec4<f32>(
    source_min.z,
    source_max.x,
    source_max.y,
    source_max.z
  );
  resident_summary[11u] = vec4<f32>(
    next_min.x,
    next_min.y,
    next_min.z,
    next_max.x
  );
  resident_summary[12u] = vec4<f32>(
    next_max.y,
    next_max.z,
    source_bounds_status,
    next_bounds_status
  );
  resident_summary[13u] = vec4<f32>(
    source_position_mass_total,
    next_position_mass_total,
    0.0,
    0.0
  );
  resident_summary[14u] = vec4<f32>(
    cohort_summary_status,
    f32(params.base_start_index),
    f32(params.base_end_index),
    f32(params.drop_start_index)
  );
  resident_summary[15u] = vec4<f32>(
    f32(params.drop_end_index),
    base_cohort_mass,
    base_cohort_center.x,
    base_cohort_center.y
  );
  resident_summary[16u] = vec4<f32>(
    base_cohort_center.z,
    base_cohort_min.x,
    base_cohort_min.y,
    base_cohort_min.z
  );
  resident_summary[17u] = vec4<f32>(
    base_cohort_max.x,
    base_cohort_max.y,
    base_cohort_max.z,
    base_cohort_max_speed
  );
  resident_summary[18u] = vec4<f32>(
    drop_cohort_mass,
    drop_cohort_center.x,
    drop_cohort_center.y,
    drop_cohort_center.z
  );
  resident_summary[19u] = vec4<f32>(
    drop_cohort_min.x,
    drop_cohort_min.y,
    drop_cohort_min.z,
    drop_cohort_max.x
  );
  resident_summary[20u] = vec4<f32>(
    drop_cohort_max.y,
    drop_cohort_max.z,
    drop_cohort_max_speed,
    0.0
  );
  resident_summary[21u] = vec4<f32>(
    h2o_gas_mass,
    h2o_gas_temperature_mass_weighted_mean_k,
    h2o_gas_phase_weight,
    h2o_gas_summary_status
  );
}
`;

export const mlsMpmResidentSummaryWgsl = mlsMpmResidentSummaryPartialsWgsl;

export const mlsMpmActiveGridDispatchFromSummaryWgsl = `
struct ActiveGridDispatchFromSummaryParams {
  grid_dim_x: u32,
  grid_dim_y: u32,
  grid_dim_z: u32,
  grid_shift: i32,
  grid_node_count: u32,
  workgroup_size: u32,
  safety_cells: u32,
  summary_stride_floats: u32,
  grid_spacing_m: f32,
  dt_s: f32,
  substep_count: u32,
  pad0: u32,
  gravity_m_per_s2: vec3<f32>,
  pad1: f32,
};

@group(0) @binding(0) var<storage, read> resident_summary: array<f32>;
@group(0) @binding(1) var<storage, read_write> dispatch_args: array<u32>;
@group(0) @binding(2) var<storage, read_write> dispatch_metadata: array<u32>;
@group(0) @binding(3) var<uniform> params: ActiveGridDispatchFromSummaryParams;

fn ag_clamp_i32(value: i32, lo: i32, hi: i32) -> i32 {
  return min(max(value, lo), hi);
}

fn ag_start_axis(bounds_min: f32, expansion_m: f32, dim: u32, dx: f32) -> u32 {
  let raw_node_min = i32(floor((bounds_min - expansion_m) / dx - 0.5)) - 1;
  return u32(ag_clamp_i32(raw_node_min + params.grid_shift, 0, i32(dim) - 1));
}

fn ag_end_axis(bounds_max: f32, expansion_m: f32, dim: u32, dx: f32, start: u32) -> u32 {
  let raw_node_max = i32(floor((bounds_max + expansion_m) / dx - 0.5)) + 3;
  return u32(ag_clamp_i32(raw_node_max + params.grid_shift, i32(start), i32(dim) - 1));
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x > 0u) {
    return;
  }

  let dx = max(params.grid_spacing_m, 0.000001);
  let workgroup_size = max(params.workgroup_size, 1u);
  let full_grid_node_count = max(params.grid_node_count, 1u);
  let next_bounds_status = resident_summary[51u];
  let max_speed_m_per_s = max(resident_summary[15u], 0.0);
  let horizon_s = abs(params.dt_s) * f32(max(params.substep_count, 1u));
  let motion_m = vec3<f32>(
    max_speed_m_per_s * horizon_s + 0.5 * abs(params.gravity_m_per_s2.x) * horizon_s * horizon_s,
    max_speed_m_per_s * horizon_s + 0.5 * abs(params.gravity_m_per_s2.y) * horizon_s * horizon_s,
    max_speed_m_per_s * horizon_s + 0.5 * abs(params.gravity_m_per_s2.z) * horizon_s * horizon_s
  );
  let safety_margin_m = f32(max(params.safety_cells, 1u)) * dx;
  let expansion_m = motion_m + vec3<f32>(safety_margin_m);

  let next_min = vec3<f32>(resident_summary[44u], resident_summary[45u], resident_summary[46u]);
  let next_max = vec3<f32>(resident_summary[47u], resident_summary[48u], resident_summary[49u]);
  let start_x = ag_start_axis(next_min.x, expansion_m.x, params.grid_dim_x, dx);
  let start_y = ag_start_axis(next_min.y, expansion_m.y, params.grid_dim_y, dx);
  let start_z = ag_start_axis(next_min.z, expansion_m.z, params.grid_dim_z, dx);
  let end_x = ag_end_axis(next_max.x, expansion_m.x, params.grid_dim_x, dx, start_x);
  let end_y = ag_end_axis(next_max.y, expansion_m.y, params.grid_dim_y, dx, start_y);
  let end_z = ag_end_axis(next_max.z, expansion_m.z, params.grid_dim_z, dx, start_z);
  let count_x = max(1u, end_x - start_x + 1u);
  let count_y = max(1u, end_y - start_y + 1u);
  let count_z = max(1u, end_z - start_z + 1u);
  let active_node_count = count_x * count_y * count_z;
  let bounds_ready = next_bounds_status > 0.0;
  let use_active_grid = bounds_ready && active_node_count > 0u && active_node_count < full_grid_node_count;
  let dispatch_node_count = select(full_grid_node_count, active_node_count, use_active_grid);
  let workgroup_count_x = max(1u, (dispatch_node_count + workgroup_size - 1u) / workgroup_size);

  dispatch_args[0u] = workgroup_count_x;
  dispatch_args[1u] = 1u;
  dispatch_args[2u] = 1u;

  let status = select(select(2u, 3u, bounds_ready), 1u, use_active_grid);
  dispatch_metadata[0u] = status;
  dispatch_metadata[1u] = select(0u, 1u, use_active_grid);
  dispatch_metadata[2u] = full_grid_node_count;
  dispatch_metadata[3u] = dispatch_node_count;
  dispatch_metadata[4u] = start_x;
  dispatch_metadata[5u] = start_y;
  dispatch_metadata[6u] = start_z;
  dispatch_metadata[7u] = count_x;
  dispatch_metadata[8u] = count_y;
  dispatch_metadata[9u] = count_z;
  dispatch_metadata[10u] = end_x;
  dispatch_metadata[11u] = end_y;
  dispatch_metadata[12u] = end_z;
  dispatch_metadata[13u] = workgroup_count_x;
  dispatch_metadata[14u] = params.safety_cells;
  dispatch_metadata[15u] = select(0u, 1u, bounds_ready);
}
`;

export const schroederLevelAssignmentWgsl = `
struct SchroederLevelParams {
  particle_count: u32,
  min_level: i32,
  max_level: i32,
  flags: u32,
  base_grid_spacing_m: f32,
  target_support_cells: f32,
  support_radius_scale: f32,
  chart_id: f32,
  min_support_radius_m: f32,
  max_support_radius_m: f32,
  fallback_support_radius_m: f32,
  hysteresis_band: f32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<f32>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<f32>;
@group(0) @binding(2) var<storage, read> mls_mpm_mechanics: array<f32>;
@group(0) @binding(3) var<storage, read_write> level_assignments: array<f32>;
@group(0) @binding(4) var<uniform> params: SchroederLevelParams;

const SCHROEDER_STATE_STRIDE: u32 = 8u;
const SCHROEDER_THERMO_STRIDE: u32 = 12u;
const SCHROEDER_MECHANICS_STRIDE: u32 = 32u;
const SCHROEDER_ASSIGNMENT_STRIDE: u32 = 16u;
const SCHROEDER_PI: f32 = 3.141592653589793;

fn ss_positive(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38 && value > 0.0;
}

fn ss_volume_radius(volume_m3: f32) -> f32 {
  if (!ss_positive(volume_m3)) {
    return 0.0;
  }
  return pow((3.0 * volume_m3) / (4.0 * SCHROEDER_PI), 0.3333333333333333);
}

fn ss_clamp_i32(value: i32, lo: i32, hi: i32) -> i32 {
  return min(max(value, lo), hi);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let state_offset = particle_index * SCHROEDER_STATE_STRIDE;
  let thermo_offset = particle_index * SCHROEDER_THERMO_STRIDE;
  let mechanics_offset = particle_index * SCHROEDER_MECHANICS_STRIDE;
  let assignment_offset = particle_index * SCHROEDER_ASSIGNMENT_STRIDE;

  let px = sph_state[state_offset + 0u];
  let py = sph_state[state_offset + 1u];
  let pz = sph_state[state_offset + 2u];
  let mass_kg = sph_state[state_offset + 3u];
  let material_id = sph_thermo[thermo_offset + 0u];
  let phase_id = sph_thermo[thermo_offset + 1u];
  let rest_density_kg_per_m3 = sph_thermo[thermo_offset + 3u];
  let smoothing_length_m = max(sph_thermo[thermo_offset + 8u], 0.0);
  let visual_radius_m = max(sph_thermo[thermo_offset + 11u], 0.0);
  let volume_ratio_j = mls_mpm_mechanics[mechanics_offset + 18u];
  let rest_volume_m3 = mls_mpm_mechanics[mechanics_offset + 19u];
  let mechanics_volume_m3 = rest_volume_m3 * volume_ratio_j;
  let constitutive_status = mls_mpm_mechanics[mechanics_offset + 21u];
  let eos_status = mls_mpm_mechanics[mechanics_offset + 27u];
  if (mass_kg == 0.0) {
    let inactive_level = params.min_level;
    let inactive_dx = max(params.base_grid_spacing_m * exp2(f32(inactive_level)), 0.000001);
    level_assignments[assignment_offset + 0u] = f32(inactive_level);
    level_assignments[assignment_offset + 1u] = inactive_dx;
    level_assignments[assignment_offset + 2u] = 0.0;
    level_assignments[assignment_offset + 3u] = 0.0;
    level_assignments[assignment_offset + 4u] = 0.0;
    level_assignments[assignment_offset + 5u] = 0.0;
    level_assignments[assignment_offset + 6u] = 0.0;
    level_assignments[assignment_offset + 7u] = rest_density_kg_per_m3;
    level_assignments[assignment_offset + 8u] = phase_id;
    level_assignments[assignment_offset + 9u] = material_id;
    // The base SS epoch currently requires every fixed-capacity source row
    // to carry a structurally ready status. Mechanics consumers separately
    // exclude zero-mass rows from their compact/field views.
    level_assignments[assignment_offset + 10u] = 1.0;
    level_assignments[assignment_offset + 11u] = max(params.hysteresis_band, 0.0);
    level_assignments[assignment_offset + 12u] = px;
    level_assignments[assignment_offset + 13u] = py;
    level_assignments[assignment_offset + 14u] = pz;
    level_assignments[assignment_offset + 15u] = params.chart_id;
    return;
  }
  let current_volume_authority_valid =
    ss_positive(mass_kg)
    && ss_positive(rest_density_kg_per_m3)
    && ss_positive(volume_ratio_j)
    && ss_positive(rest_volume_m3)
    && ss_positive(mechanics_volume_m3)
    && constitutive_status == 1.0
    && eos_status == 1.0;
  if (!current_volume_authority_valid) {
    let rejected_level = params.min_level;
    let rejected_dx = max(
      params.base_grid_spacing_m * exp2(f32(rejected_level)),
      0.000001
    );
    level_assignments[assignment_offset + 0u] = f32(rejected_level);
    level_assignments[assignment_offset + 1u] = rejected_dx;
    level_assignments[assignment_offset + 2u] = 0.0;
    level_assignments[assignment_offset + 3u] = 0.0;
    level_assignments[assignment_offset + 4u] = 0.0;
    level_assignments[assignment_offset + 5u] = 0.0;
    level_assignments[assignment_offset + 6u] = mass_kg;
    level_assignments[assignment_offset + 7u] = rest_density_kg_per_m3;
    level_assignments[assignment_offset + 8u] = phase_id;
    level_assignments[assignment_offset + 9u] = material_id;
    level_assignments[assignment_offset + 10u] = 0.0;
    level_assignments[assignment_offset + 11u] = max(params.hysteresis_band, 0.0);
    level_assignments[assignment_offset + 12u] = px;
    level_assignments[assignment_offset + 13u] = py;
    level_assignments[assignment_offset + 14u] = pz;
    level_assignments[assignment_offset + 15u] = params.chart_id;
    return;
  }
  let source_volume_m3 = mechanics_volume_m3;
  let represented_volume_m3 = mechanics_volume_m3;

  let physical_radius_m = ss_volume_radius(source_volume_m3);
  var support_radius_m = physical_radius_m * max(params.support_radius_scale, 0.0);
  var status = 1.0;
  if (!ss_positive(support_radius_m)) {
    // Render radius, smoothing metadata, and density-derived geometry are not
    // permitted to manufacture support for an invalid current-volume row.
    support_radius_m = 0.0;
    status = 0.0;
  }
  if (
    status > 0.0
    && ss_positive(params.min_support_radius_m)
    && support_radius_m < params.min_support_radius_m
  ) {
    support_radius_m = params.min_support_radius_m;
    status = status + 4.0;
  }
  if (
    status > 0.0
    && ss_positive(params.max_support_radius_m)
    && support_radius_m > params.max_support_radius_m
  ) {
    support_radius_m = params.max_support_radius_m;
    status = status + 8.0;
  }

  let base_dx = max(params.base_grid_spacing_m, 0.000001);
  let target_cells = max(params.target_support_cells, 1.0);
  let native_dx_unclamped = max(support_radius_m / target_cells, 0.000001);
  let raw_level = i32(round(log2(native_dx_unclamped / base_dx)));
  let level = ss_clamp_i32(raw_level, params.min_level, params.max_level);
  let native_dx = base_dx * exp2(f32(level));
  if (level != raw_level) {
    status = status + 16.0;
  }

  level_assignments[assignment_offset + 0u] = f32(level);
  level_assignments[assignment_offset + 1u] = native_dx;
  level_assignments[assignment_offset + 2u] = support_radius_m;
  level_assignments[assignment_offset + 3u] = represented_volume_m3;
  level_assignments[assignment_offset + 4u] = rest_volume_m3;
  level_assignments[assignment_offset + 5u] = source_volume_m3;
  level_assignments[assignment_offset + 6u] = mass_kg;
  level_assignments[assignment_offset + 7u] = rest_density_kg_per_m3;
  level_assignments[assignment_offset + 8u] = phase_id;
  level_assignments[assignment_offset + 9u] = material_id;
  level_assignments[assignment_offset + 10u] = status;
  level_assignments[assignment_offset + 11u] = max(params.hysteresis_band, 0.0);
  level_assignments[assignment_offset + 12u] = px;
  level_assignments[assignment_offset + 13u] = py;
  level_assignments[assignment_offset + 14u] = pz;
  level_assignments[assignment_offset + 15u] = params.chart_id;
}
`;

export const schroederActiveNodeListWgsl = `
struct SchroederActiveNodeParams {
  particle_count: u32,
  tile_cell_count: u32,
  flags: u32,
  pad0: u32,
  support_inflate_cells: f32,
  min_tile_spacing_m: f32,
  max_tile_spacing_m: f32,
  pad1: f32,
  phase_volume_level_update_row_count: u32,
  phase_volume_level_update_stride: u32,
  phase_volume_level_update_enabled: u32,
  phase_volume_level_update_index_enabled: u32,
  pad3: vec4<u32>,
};

@group(0) @binding(0) var<storage, read> level_assignments: array<f32>;
@group(0) @binding(1) var<storage, read_write> active_nodes: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederActiveNodeParams;
@group(0) @binding(3) var<storage, read> phase_volume_level_updates: array<f32>;
@group(0) @binding(4) var<storage, read_write> phase_volume_level_update_index: array<atomic<u32>>;

const SCHROEDER_ASSIGNMENT_STRIDE: u32 = 16u;
const SCHROEDER_ACTIVE_NODE_STRIDE: u32 = 16u;
const SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_STRIDE: u32 = 32u;

fn ss_active_positive(value: f32) -> bool {
  return value == value && value > 0.0;
}

fn ss_active_tile_spacing(native_dx: f32) -> f32 {
  var tile_spacing = max(native_dx, 0.000001) * f32(max(params.tile_cell_count, 1u));
  if (ss_active_positive(params.min_tile_spacing_m)) {
    tile_spacing = max(tile_spacing, params.min_tile_spacing_m);
  }
  if (ss_active_positive(params.max_tile_spacing_m)) {
    tile_spacing = min(tile_spacing, params.max_tile_spacing_m);
  }
  return max(tile_spacing, 0.000001);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let assignment_offset = particle_index * SCHROEDER_ASSIGNMENT_STRIDE;
  let node_offset = particle_index * SCHROEDER_ACTIVE_NODE_STRIDE;
  var level = level_assignments[assignment_offset + 0u];
  var native_dx = max(level_assignments[assignment_offset + 1u], 0.000001);
  var support_radius = max(level_assignments[assignment_offset + 2u], 0.0);
  var assignment_status = level_assignments[assignment_offset + 10u];
  let position = vec3<f32>(
    level_assignments[assignment_offset + 12u],
    level_assignments[assignment_offset + 13u],
    level_assignments[assignment_offset + 14u]
  );
  let chart_id = level_assignments[assignment_offset + 15u];
  var overlay_applied = false;
  var overlay_rejected = false;
  if (
    params.phase_volume_level_update_enabled != 0u
    && params.phase_volume_level_update_row_count > 0u
  ) {
    var update_row = particle_index;
    var update_row_available = particle_index < params.phase_volume_level_update_row_count;
    if (params.phase_volume_level_update_index_enabled != 0u) {
      let indexed_row = atomicLoad(&phase_volume_level_update_index[particle_index]);
      update_row = indexed_row;
      update_row_available = indexed_row < params.phase_volume_level_update_row_count;
    }
    if (!update_row_available) {
      overlay_rejected = true;
    } else {
    let update_stride = max(
      params.phase_volume_level_update_stride,
      SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_STRIDE
    );
    let update_offset = update_row * update_stride;
    let source_particle_index = u32(max(round(phase_volume_level_updates[update_offset + 0u]), 0.0));
    let target_level = phase_volume_level_updates[update_offset + 2u];
    let update_status = phase_volume_level_updates[update_offset + 3u];
    let target_support_radius = phase_volume_level_updates[update_offset + 5u];
    let admission_approved = phase_volume_level_updates[update_offset + 17u];
    let target_grid_spacing_m = phase_volume_level_updates[update_offset + 21u];
    if (
      source_particle_index == particle_index
      && update_status > 0.0
      && admission_approved > 0.0
    ) {
      let assignment_level = level;
      level = target_level;
      if (ss_active_positive(target_grid_spacing_m)) {
        native_dx = target_grid_spacing_m;
      } else {
        native_dx = max(native_dx * exp2(target_level - assignment_level), 0.000001);
      }
      if (ss_active_positive(target_support_radius)) {
        support_radius = target_support_radius;
      }
      assignment_status = max(assignment_status, 1.0);
      overlay_applied = true;
    } else {
      overlay_rejected = true;
    }
    }
  }
  let tile_spacing = ss_active_tile_spacing(native_dx);
  let support_inflation = max(params.support_inflate_cells, 0.0) * native_dx;
  let expanded_support = support_radius + support_inflation;
  let min_tile = floor((position - vec3<f32>(expanded_support)) / tile_spacing);
  let max_tile = floor((position + vec3<f32>(expanded_support)) / tile_spacing);
  var status = select(32.0, 1.0, assignment_status > 0.0 && support_radius >= 0.0);
  if (overlay_applied) {
    status = status + 64.0;
  }
  if (overlay_rejected) {
    status = status + 128.0;
  }

  active_nodes[node_offset + 0u] = level;
  active_nodes[node_offset + 1u] = min_tile.x;
  active_nodes[node_offset + 2u] = min_tile.y;
  active_nodes[node_offset + 3u] = min_tile.z;
  active_nodes[node_offset + 4u] = max_tile.x;
  active_nodes[node_offset + 5u] = max_tile.y;
  active_nodes[node_offset + 6u] = max_tile.z;
  active_nodes[node_offset + 7u] = tile_spacing;
  active_nodes[node_offset + 8u] = native_dx;
  active_nodes[node_offset + 9u] = support_radius;
  active_nodes[node_offset + 10u] = f32(particle_index);
  active_nodes[node_offset + 11u] = status;
  active_nodes[node_offset + 12u] = position.x;
  active_nodes[node_offset + 13u] = position.y;
  active_nodes[node_offset + 14u] = position.z;
  active_nodes[node_offset + 15u] = chart_id;
}
`;

export const schroederPhaseVolumeAssignmentOverlayIndexWgsl = `
struct SchroederPhaseVolumeAssignmentOverlayIndexParams {
  particle_count: u32,
  level_update_row_count: u32,
  level_update_stride: u32,
  missing_row: u32,
};

@group(0) @binding(0) var<storage, read> level_update_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> source_particle_index_rows: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> params: SchroederPhaseVolumeAssignmentOverlayIndexParams;

const SCHROEDER_PVAI_LEVEL_UPDATE_STRIDE: u32 = 32u;

@compute @workgroup_size(64)
fn clear_index(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  atomicStore(&source_particle_index_rows[particle_index], params.missing_row);
}

@compute @workgroup_size(64)
fn build_index(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.level_update_row_count) {
    return;
  }
  let stride = max(params.level_update_stride, SCHROEDER_PVAI_LEVEL_UPDATE_STRIDE);
  let offset = row_index * stride;
  let source_particle_index = u32(max(round(level_update_rows[offset + 0u]), 0.0));
  let status = level_update_rows[offset + 3u];
  let admission_approved = level_update_rows[offset + 17u];
  if (
    source_particle_index >= params.particle_count
    || status <= 0.0
    || admission_approved <= 0.0
  ) {
    return;
  }
  atomicMin(&source_particle_index_rows[source_particle_index], row_index);
}
`;

export const schroederActiveNodeIndexWgsl = `
struct SchroederActiveNodeIndexParams {
  active_node_count: u32,
  active_node_stride: u32,
  bucket_count: u32,
  bucket_slot_capacity: u32,
  bucket_slot_count: u32,
  node_slot_count: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  pad3: u32,
  pad4: u32,
  pad5: u32,
  pad6: u32,
  pad7: u32,
  pad8: u32,
};

@group(0) @binding(0) var<storage, read> active_nodes: array<f32>;
@group(0) @binding(1) var<storage, read_write> bucket_counts: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> bucket_slots: array<u32>;
@group(0) @binding(3) var<storage, read_write> node_bucket_slots: array<u32>;
@group(0) @binding(4) var<storage, read_write> overflow_counters: array<atomic<u32>>;
@group(0) @binding(5) var<uniform> params: SchroederActiveNodeIndexParams;

const SCHROEDER_ACTIVE_NODE_INDEX_SENTINEL: u32 = 0xffffffffu;
const SCHROEDER_ACTIVE_NODE_INDEX_STRIDE: u32 = 16u;

fn ss_active_index_hash_mix(value: u32, seed: u32) -> u32 {
  var hash = seed ^ (value + 0x9e3779b9u + (seed << 6u) + (seed >> 2u));
  hash = hash ^ (hash >> 16u);
  hash = hash * 0x7feb352du;
  hash = hash ^ (hash >> 15u);
  hash = hash * 0x846ca68bu;
  return hash ^ (hash >> 16u);
}

fn ss_active_index_i32_bits(value: f32) -> u32 {
  return bitcast<u32>(i32(round(value)));
}

fn ss_active_index_bucket(active_offset: u32) -> u32 {
  var hash = 0x811c9dc5u;
  hash = ss_active_index_hash_mix(ss_active_index_i32_bits(active_nodes[active_offset + 0u]), hash);
  hash = ss_active_index_hash_mix(ss_active_index_i32_bits(active_nodes[active_offset + 1u]), hash);
  hash = ss_active_index_hash_mix(ss_active_index_i32_bits(active_nodes[active_offset + 2u]), hash);
  hash = ss_active_index_hash_mix(ss_active_index_i32_bits(active_nodes[active_offset + 3u]), hash);
  hash = ss_active_index_hash_mix(ss_active_index_i32_bits(active_nodes[active_offset + 15u]), hash);
  return hash % max(params.bucket_count, 1u);
}

fn ss_active_index_ready(active_offset: u32) -> bool {
  let status = active_nodes[active_offset + 11u];
  return status > 0.0 && status < 32.0;
}

@compute @workgroup_size(64)
fn clearIndex(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index < params.bucket_count) {
    atomicStore(&bucket_counts[index], 0u);
  }
  if (index < params.bucket_slot_count) {
    bucket_slots[index] = SCHROEDER_ACTIVE_NODE_INDEX_SENTINEL;
  }
  if (index < params.node_slot_count) {
    node_bucket_slots[index] = SCHROEDER_ACTIVE_NODE_INDEX_SENTINEL;
  }
  if (index < 4u) {
    atomicStore(&overflow_counters[index], 0u);
  }
}

@compute @workgroup_size(64)
fn assignIndex(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let active_index = global_id.x;
  if (active_index >= params.active_node_count) {
    return;
  }
  let active_stride = max(params.active_node_stride, SCHROEDER_ACTIVE_NODE_INDEX_STRIDE);
  let active_offset = active_index * active_stride;
  if (!ss_active_index_ready(active_offset)) {
    node_bucket_slots[active_index] = SCHROEDER_ACTIVE_NODE_INDEX_SENTINEL;
    return;
  }
  atomicAdd(&overflow_counters[1], 1u);
  let bucket_index = ss_active_index_bucket(active_offset);
  let slot_index = atomicAdd(&bucket_counts[bucket_index], 1u);
  if (slot_index >= params.bucket_slot_capacity) {
    atomicAdd(&overflow_counters[0], 1u);
    node_bucket_slots[active_index] = SCHROEDER_ACTIVE_NODE_INDEX_SENTINEL;
    return;
  }
  let absolute_slot = bucket_index * params.bucket_slot_capacity + slot_index;
  if (absolute_slot >= params.bucket_slot_count) {
    atomicAdd(&overflow_counters[0], 1u);
    node_bucket_slots[active_index] = SCHROEDER_ACTIVE_NODE_INDEX_SENTINEL;
    return;
  }
  bucket_slots[absolute_slot] = active_index;
  node_bucket_slots[active_index] = absolute_slot;
  atomicAdd(&overflow_counters[2], 1u);
}
`;

export const schroederActiveNodeSortedIndexWgsl = `
struct SchroederActiveNodeSortedIndexParams {
  active_node_count: u32,
  active_node_stride: u32,
  bucket_count: u32,
  bucket_range_offset_count: u32,
  flags: u32,
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
};

@group(0) @binding(0) var<storage, read> active_nodes: array<f32>;
@group(0) @binding(1) var<storage, read_write> bucket_counts: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> bucket_range_offsets: array<u32>;
@group(0) @binding(3) var<storage, read_write> bucket_cursors: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> sorted_active_indices: array<u32>;
@group(0) @binding(5) var<storage, read_write> diagnostic_counters: array<atomic<u32>>;
@group(0) @binding(6) var<uniform> params: SchroederActiveNodeSortedIndexParams;

const SCHROEDER_ACTIVE_NODE_SORTED_INDEX_SENTINEL: u32 = 0xffffffffu;
const SCHROEDER_ACTIVE_NODE_SORTED_INDEX_STRIDE: u32 = 16u;
const SCHROEDER_ACTIVE_NODE_SORTED_DIAGNOSTIC_READY_COUNT: u32 = 0u;
const SCHROEDER_ACTIVE_NODE_SORTED_DIAGNOSTIC_SCATTER_COUNT: u32 = 1u;
const SCHROEDER_ACTIVE_NODE_SORTED_DIAGNOSTIC_INACTIVE_COUNT: u32 = 2u;
const SCHROEDER_ACTIVE_NODE_SORTED_DIAGNOSTIC_TOTAL_COUNT: u32 = 3u;

fn ss_sorted_index_hash_mix(value: u32, seed: u32) -> u32 {
  var hash = seed ^ (value + 0x9e3779b9u + (seed << 6u) + (seed >> 2u));
  hash = hash ^ (hash >> 16u);
  hash = hash * 0x7feb352du;
  hash = hash ^ (hash >> 15u);
  hash = hash * 0x846ca68bu;
  return hash ^ (hash >> 16u);
}

fn ss_sorted_index_i32_bits(value: f32) -> u32 {
  return bitcast<u32>(i32(round(value)));
}

fn ss_sorted_index_bucket(active_offset: u32) -> u32 {
  var hash = 0x811c9dc5u;
  hash = ss_sorted_index_hash_mix(ss_sorted_index_i32_bits(active_nodes[active_offset + 0u]), hash);
  hash = ss_sorted_index_hash_mix(ss_sorted_index_i32_bits(active_nodes[active_offset + 1u]), hash);
  hash = ss_sorted_index_hash_mix(ss_sorted_index_i32_bits(active_nodes[active_offset + 2u]), hash);
  hash = ss_sorted_index_hash_mix(ss_sorted_index_i32_bits(active_nodes[active_offset + 3u]), hash);
  hash = ss_sorted_index_hash_mix(ss_sorted_index_i32_bits(active_nodes[active_offset + 15u]), hash);
  return hash % max(params.bucket_count, 1u);
}

fn ss_sorted_index_ready(active_offset: u32) -> bool {
  let status = active_nodes[active_offset + 11u];
  return status > 0.0 && status < 32.0;
}

@compute @workgroup_size(64)
fn clearSortedIndex(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index < params.bucket_count) {
    atomicStore(&bucket_counts[index], 0u);
    atomicStore(&bucket_cursors[index], 0u);
  }
  if (index < params.bucket_range_offset_count) {
    bucket_range_offsets[index] = 0u;
  }
  if (index < params.active_node_count) {
    sorted_active_indices[index] = SCHROEDER_ACTIVE_NODE_SORTED_INDEX_SENTINEL;
  }
  if (index < 4u) {
    atomicStore(&diagnostic_counters[index], 0u);
  }
}

@compute @workgroup_size(64)
fn countSortedIndex(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let active_index = global_id.x;
  if (active_index >= params.active_node_count) {
    return;
  }
  let active_stride = max(params.active_node_stride, SCHROEDER_ACTIVE_NODE_SORTED_INDEX_STRIDE);
  let active_offset = active_index * active_stride;
  if (!ss_sorted_index_ready(active_offset)) {
    atomicAdd(&diagnostic_counters[SCHROEDER_ACTIVE_NODE_SORTED_DIAGNOSTIC_INACTIVE_COUNT], 1u);
    return;
  }
  let bucket_index = ss_sorted_index_bucket(active_offset);
  atomicAdd(&bucket_counts[bucket_index], 1u);
  atomicAdd(&diagnostic_counters[SCHROEDER_ACTIVE_NODE_SORTED_DIAGNOSTIC_READY_COUNT], 1u);
}

@compute @workgroup_size(1)
fn prefixSortedIndex(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u) {
    return;
  }
  var running_total = 0u;
  var bucket_index = 0u;
  loop {
    if (bucket_index >= params.bucket_count) {
      break;
    }
    bucket_range_offsets[bucket_index] = running_total;
    atomicStore(&bucket_cursors[bucket_index], 0u);
    running_total = running_total + atomicLoad(&bucket_counts[bucket_index]);
    bucket_index = bucket_index + 1u;
  }
  if (params.bucket_range_offset_count > params.bucket_count) {
    bucket_range_offsets[params.bucket_count] = running_total;
  }
  atomicStore(&diagnostic_counters[SCHROEDER_ACTIVE_NODE_SORTED_DIAGNOSTIC_TOTAL_COUNT], running_total);
}

@compute @workgroup_size(64)
fn scatterSortedIndex(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let active_index = global_id.x;
  if (active_index >= params.active_node_count) {
    return;
  }
  let active_stride = max(params.active_node_stride, SCHROEDER_ACTIVE_NODE_SORTED_INDEX_STRIDE);
  let active_offset = active_index * active_stride;
  if (!ss_sorted_index_ready(active_offset)) {
    return;
  }
  let bucket_index = ss_sorted_index_bucket(active_offset);
  let slot = atomicAdd(&bucket_cursors[bucket_index], 1u);
  let destination = bucket_range_offsets[bucket_index] + slot;
  if (destination < params.active_node_count) {
    sorted_active_indices[destination] = active_index;
    atomicAdd(&diagnostic_counters[SCHROEDER_ACTIVE_NODE_SORTED_DIAGNOSTIC_SCATTER_COUNT], 1u);
  }
}
`;

export const schroederLawQueueWgsl = `
struct SchroederLawQueueParams {
  active_node_count: u32,
  active_node_stride: u32,
  law_queue_stride: u32,
  flags: u32,
  enabled_law_mask: f32,
  candidate_budget: f32,
  queue_epoch: f32,
  state_family_id: f32,
};

@group(0) @binding(0) var<storage, read> active_nodes: array<f32>;
@group(0) @binding(1) var<storage, read_write> law_queue_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederLawQueueParams;

const SCHROEDER_ACTIVE_NODE_STRIDE_FOR_LAW_QUEUE: u32 = 16u;
const SCHROEDER_LAW_QUEUE_STRIDE: u32 = 32u;
const SCHROEDER_LAW_REACTION_MASK: u32 = 1u;
const SCHROEDER_LAW_CONTACT_MASK: u32 = 2u;
const SCHROEDER_LAW_INTERFACE_MASK: u32 = 4u;

fn ss_law_queue_mask_enabled(mask: u32, bit: u32) -> bool {
  return (mask & bit) != 0u;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.active_node_count) {
    return;
  }
  let active_stride = max(params.active_node_stride, SCHROEDER_ACTIVE_NODE_STRIDE_FOR_LAW_QUEUE);
  let queue_stride = max(params.law_queue_stride, SCHROEDER_LAW_QUEUE_STRIDE);
  let active_offset = row_index * active_stride;
  let queue_offset = row_index * queue_stride;
  let active_status = active_nodes[active_offset + 11u];
  let active_node_enabled = active_status > 0.0 && active_status < 32.0;
  let law_mask = u32(max(round(params.enabled_law_mask), 0.0));
  let reaction_enabled = active_node_enabled && ss_law_queue_mask_enabled(law_mask, SCHROEDER_LAW_REACTION_MASK);
  let contact_enabled = active_node_enabled && ss_law_queue_mask_enabled(law_mask, SCHROEDER_LAW_CONTACT_MASK);
  let interface_enabled = active_node_enabled && ss_law_queue_mask_enabled(law_mask, SCHROEDER_LAW_INTERFACE_MASK);
  let status = select(32.0, 1.0, active_node_enabled && law_mask != 0u);
  let tile_min = vec3<f32>(
    active_nodes[active_offset + 1u],
    active_nodes[active_offset + 2u],
    active_nodes[active_offset + 3u]
  );
  let tile_max = vec3<f32>(
    active_nodes[active_offset + 4u],
    active_nodes[active_offset + 5u],
    active_nodes[active_offset + 6u]
  );
  let tile_span = max(tile_max - tile_min + vec3<f32>(1.0), vec3<f32>(0.0));
  let tile_cell_estimate = tile_span.x * tile_span.y * tile_span.z;
  let candidate_budget = max(params.candidate_budget, 0.0);
  let local_law_enabled = reaction_enabled || contact_enabled || interface_enabled;
  let estimated_candidate_count = select(
    0.0,
    min(max(tile_cell_estimate, 1.0), candidate_budget),
    local_law_enabled && candidate_budget > 0.0
  );

  law_queue_rows[queue_offset + 0u] = active_nodes[active_offset + 10u];
  law_queue_rows[queue_offset + 1u] = active_nodes[active_offset + 0u];
  law_queue_rows[queue_offset + 2u] = active_nodes[active_offset + 15u];
  law_queue_rows[queue_offset + 3u] = status;
  law_queue_rows[queue_offset + 4u] = tile_min.x;
  law_queue_rows[queue_offset + 5u] = tile_min.y;
  law_queue_rows[queue_offset + 6u] = tile_min.z;
  law_queue_rows[queue_offset + 7u] = tile_max.x;
  law_queue_rows[queue_offset + 8u] = tile_max.y;
  law_queue_rows[queue_offset + 9u] = tile_max.z;
  law_queue_rows[queue_offset + 10u] = active_nodes[active_offset + 7u];
  law_queue_rows[queue_offset + 11u] = active_nodes[active_offset + 9u];
  law_queue_rows[queue_offset + 12u] = f32(law_mask);
  law_queue_rows[queue_offset + 13u] = select(0.0, 1.0, reaction_enabled);
  law_queue_rows[queue_offset + 14u] = select(0.0, 1.0, contact_enabled);
  law_queue_rows[queue_offset + 15u] = select(0.0, 1.0, interface_enabled);
  law_queue_rows[queue_offset + 16u] = 0.0;
  law_queue_rows[queue_offset + 17u] = select(0.0, 1.0, local_law_enabled);
  law_queue_rows[queue_offset + 18u] = 0.0;
  law_queue_rows[queue_offset + 19u] = select(0.0, 1.0, reaction_enabled);
  law_queue_rows[queue_offset + 20u] = candidate_budget;
  law_queue_rows[queue_offset + 21u] = estimated_candidate_count;
  law_queue_rows[queue_offset + 22u] = 1.0;
  law_queue_rows[queue_offset + 23u] = 1.0;
  law_queue_rows[queue_offset + 24u] = params.state_family_id;
  law_queue_rows[queue_offset + 25u] = select(0.0, 1.0, local_law_enabled);
  law_queue_rows[queue_offset + 26u] = active_status;
  law_queue_rows[queue_offset + 27u] = f32(row_index);
  law_queue_rows[queue_offset + 28u] = params.queue_epoch;
  law_queue_rows[queue_offset + 29u] = 0.0;
  law_queue_rows[queue_offset + 30u] = 0.0;
  law_queue_rows[queue_offset + 31u] = 0.0;
}
`;

export const schroederLawNeighborCandidateWgsl = `
struct SchroederLawNeighborParams {
  law_queue_count: u32,
  active_node_count: u32,
  particle_count: u32,
  law_queue_stride: u32,
  active_node_stride: u32,
  neighbor_stride: u32,
  state_stride: u32,
  candidate_budget: u32,
  enabled_law_mask: u32,
  flags: u32,
  source_span_stride: u32,
  active_node_index_enabled: u32,
  active_node_index_bucket_count: u32,
  active_node_index_bucket_slot_capacity: u32,
  active_node_index_bucket_slot_count: u32,
  active_node_sorted_index_enabled: u32,
  active_node_sorted_bucket_count: u32,
  active_node_sorted_bucket_range_offset_count: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> law_queue_rows: array<f32>;
@group(0) @binding(1) var<storage, read> active_nodes: array<f32>;
@group(0) @binding(2) var<storage, read> sph_state_rows: array<f32>;
@group(0) @binding(3) var<storage, read_write> neighbor_candidate_rows: array<f32>;
@group(0) @binding(4) var<storage, read_write> source_candidate_span_rows: array<f32>;
@group(0) @binding(5) var<uniform> params: SchroederLawNeighborParams;
@group(0) @binding(6) var<storage, read> active_node_index_bucket_slots: array<u32>;
@group(0) @binding(7) var<storage, read_write> traversal_diagnostic_counters: array<atomic<u32>>;
@group(0) @binding(8) var<storage, read> active_node_sorted_bucket_range_offsets: array<u32>;
@group(0) @binding(9) var<storage, read> active_node_sorted_active_indices: array<u32>;

const SCHROEDER_LAW_NEIGHBOR_QUEUE_STRIDE: u32 = 32u;
const SCHROEDER_LAW_NEIGHBOR_ACTIVE_NODE_STRIDE: u32 = 16u;
const SCHROEDER_LAW_NEIGHBOR_ROW_STRIDE: u32 = 16u;
const SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_STRIDE: u32 = 4u;
const SCHROEDER_LAW_NEIGHBOR_STATE_STRIDE: u32 = 8u;
const SCHROEDER_LAW_NEIGHBOR_STATUS_READY: f32 = 1.0;
const SCHROEDER_LAW_NEIGHBOR_STATUS_INACTIVE: f32 = 32.0;
const SCHROEDER_LAW_NEIGHBOR_REACTION_MASK: u32 = 1u;
const SCHROEDER_LAW_NEIGHBOR_CONTACT_MASK: u32 = 2u;
const SCHROEDER_LAW_NEIGHBOR_INTERFACE_MASK: u32 = 4u;
const SCHROEDER_LAW_NEIGHBOR_ACTIVE_INDEX_SENTINEL: u32 = 0xffffffffu;
const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_COUNTER_COUNT: u32 = 8u;
const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_CANDIDATE_INVOCATIONS: u32 = 0u;
const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_BUCKET_ATTEMPTS: u32 = 1u;
const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_BUCKET_SELECTED: u32 = 2u;
const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_EXACT_FALLBACK_SCANS: u32 = 3u;
const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_EXACT_FALLBACK_SELECTED: u32 = 4u;
const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_INACTIVE_CANDIDATES: u32 = 5u;
const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_BUCKET_PRESSURE: u32 = 6u;
const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_SOURCE_SPANS: u32 = 7u;

fn ss_neighbor_diagnostic_add(counter_index: u32, value: u32) {
  if (counter_index < SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_COUNTER_COUNT && value > 0u) {
    atomicAdd(&traversal_diagnostic_counters[counter_index], value);
  }
}

fn ss_neighbor_state_pos_mass(particle_index: u32, state_stride: u32) -> vec4<f32> {
  let offset = particle_index * state_stride;
  return vec4<f32>(
    sph_state_rows[offset + 0u],
    sph_state_rows[offset + 1u],
    sph_state_rows[offset + 2u],
    sph_state_rows[offset + 3u]
  );
}

fn ss_neighbor_active_node_ready(active_offset: u32) -> bool {
  let active_status = active_nodes[active_offset + 11u];
  let source_particle = active_nodes[active_offset + 10u];
  return active_status > 0.0 && active_status < 32.0 && source_particle >= 0.0;
}

fn ss_neighbor_tiles_overlap(queue_offset: u32, active_offset: u32) -> bool {
  let same_level = abs(active_nodes[active_offset + 0u] - law_queue_rows[queue_offset + 1u]) < 0.5;
  let same_chart = abs(active_nodes[active_offset + 15u] - law_queue_rows[queue_offset + 2u]) < 0.5;
  let queue_min = vec3<f32>(
    law_queue_rows[queue_offset + 4u],
    law_queue_rows[queue_offset + 5u],
    law_queue_rows[queue_offset + 6u]
  );
  let queue_max = vec3<f32>(
    law_queue_rows[queue_offset + 7u],
    law_queue_rows[queue_offset + 8u],
    law_queue_rows[queue_offset + 9u]
  );
  let active_min = vec3<f32>(
    active_nodes[active_offset + 1u],
    active_nodes[active_offset + 2u],
    active_nodes[active_offset + 3u]
  );
  let active_max = vec3<f32>(
    active_nodes[active_offset + 4u],
    active_nodes[active_offset + 5u],
    active_nodes[active_offset + 6u]
  );
  let overlap = queue_min.x <= active_max.x && queue_max.x >= active_min.x
    && queue_min.y <= active_max.y && queue_max.y >= active_min.y
    && queue_min.z <= active_max.z && queue_max.z >= active_min.z;
  return same_level && same_chart && overlap;
}

fn ss_neighbor_active_index_enabled() -> bool {
  return params.active_node_index_enabled != 0u
    && params.active_node_index_bucket_count > 0u
    && params.active_node_index_bucket_slot_capacity > 0u
    && params.active_node_index_bucket_slot_count > 0u;
}

fn ss_neighbor_active_index_hash_mix(value: u32, seed: u32) -> u32 {
  var hash = seed ^ (value + 0x9e3779b9u + (seed << 6u) + (seed >> 2u));
  hash = hash ^ (hash >> 16u);
  hash = hash * 0x7feb352du;
  hash = hash ^ (hash >> 15u);
  hash = hash * 0x846ca68bu;
  return hash ^ (hash >> 16u);
}

fn ss_neighbor_active_index_i32_bits(value: f32) -> u32 {
  return bitcast<u32>(i32(round(value)));
}

fn ss_neighbor_active_index_bucket(queue_offset: u32) -> u32 {
  var hash = 0x811c9dc5u;
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 1u]), hash);
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 4u]), hash);
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 5u]), hash);
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 6u]), hash);
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 2u]), hash);
  return hash % max(params.active_node_index_bucket_count, 1u);
}

fn ss_neighbor_sorted_index_enabled() -> bool {
  return params.active_node_sorted_index_enabled != 0u
    && params.active_node_sorted_bucket_count > 0u
    && params.active_node_sorted_bucket_range_offset_count > params.active_node_sorted_bucket_count;
}

fn ss_neighbor_sorted_index_bucket(queue_offset: u32) -> u32 {
  var hash = 0x811c9dc5u;
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 1u]), hash);
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 4u]), hash);
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 5u]), hash);
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 6u]), hash);
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 2u]), hash);
  return hash % max(params.active_node_sorted_bucket_count, 1u);
}

fn ss_neighbor_sorted_range_start(queue_offset: u32) -> u32 {
  if (!ss_neighbor_sorted_index_enabled()) {
    return 0u;
  }
  let bucket_index = ss_neighbor_sorted_index_bucket(queue_offset);
  return active_node_sorted_bucket_range_offsets[bucket_index];
}

fn ss_neighbor_sorted_range_end(queue_offset: u32) -> u32 {
  if (!ss_neighbor_sorted_index_enabled()) {
    return 0u;
  }
  let bucket_index = ss_neighbor_sorted_index_bucket(queue_offset);
  return active_node_sorted_bucket_range_offsets[min(bucket_index + 1u, params.active_node_sorted_bucket_range_offset_count - 1u)];
}

fn ss_neighbor_sorted_index_contains(queue_offset: u32, active_index: u32) -> bool {
  if (!ss_neighbor_sorted_index_enabled()) {
    return false;
  }
  var cursor = ss_neighbor_sorted_range_start(queue_offset);
  let end = min(ss_neighbor_sorted_range_end(queue_offset), params.active_node_count);
  loop {
    if (cursor >= end) {
      break;
    }
    if (active_node_sorted_active_indices[cursor] == active_index) {
      return true;
    }
    cursor = cursor + 1u;
  }
  return false;
}

fn ss_neighbor_active_index_slot(queue_offset: u32, bucket_slot_index: u32) -> u32 {
  if (!ss_neighbor_active_index_enabled() || bucket_slot_index >= params.active_node_index_bucket_slot_capacity) {
    return SCHROEDER_LAW_NEIGHBOR_ACTIVE_INDEX_SENTINEL;
  }
  let bucket_index = ss_neighbor_active_index_bucket(queue_offset);
  let absolute_slot = bucket_index * params.active_node_index_bucket_slot_capacity + bucket_slot_index;
  if (absolute_slot >= params.active_node_index_bucket_slot_count) {
    return SCHROEDER_LAW_NEIGHBOR_ACTIVE_INDEX_SENTINEL;
  }
  return active_node_index_bucket_slots[absolute_slot];
}

fn ss_neighbor_active_index_contains(queue_offset: u32, active_index: u32) -> bool {
  if (!ss_neighbor_active_index_enabled()) {
    return false;
  }
  var bucket_slot_index = 0u;
  loop {
    if (bucket_slot_index >= params.active_node_index_bucket_slot_capacity) {
      break;
    }
    if (ss_neighbor_active_index_slot(queue_offset, bucket_slot_index) == active_index) {
      return true;
    }
    bucket_slot_index = bucket_slot_index + 1u;
  }
  return false;
}

fn ss_neighbor_active_index_bucket_full(queue_offset: u32) -> bool {
  if (!ss_neighbor_active_index_enabled()) {
    return false;
  }
  var occupied_count = 0u;
  var bucket_slot_index = 0u;
  loop {
    if (bucket_slot_index >= params.active_node_index_bucket_slot_capacity) {
      break;
    }
    let active_index = ss_neighbor_active_index_slot(queue_offset, bucket_slot_index);
    if (active_index == SCHROEDER_LAW_NEIGHBOR_ACTIVE_INDEX_SENTINEL) {
      return false;
    }
    occupied_count = occupied_count + 1u;
    bucket_slot_index = bucket_slot_index + 1u;
  }
  return occupied_count >= params.active_node_index_bucket_slot_capacity;
}

fn ss_neighbor_active_index_match_count(queue_offset: u32, source_active_index: u32, active_stride: u32) -> u32 {
  if (!ss_neighbor_active_index_enabled()) {
    return 0u;
  }
  var matched_count = 0u;
  var bucket_slot_index = 0u;
  loop {
    if (bucket_slot_index >= params.active_node_index_bucket_slot_capacity) {
      break;
    }
    let active_index = ss_neighbor_active_index_slot(queue_offset, bucket_slot_index);
    if (active_index < params.active_node_count && active_index != source_active_index) {
      let active_offset = active_index * active_stride;
      if (ss_neighbor_active_node_ready(active_offset) && ss_neighbor_tiles_overlap(queue_offset, active_offset)) {
        matched_count = matched_count + 1u;
      }
    }
    bucket_slot_index = bucket_slot_index + 1u;
  }
  return matched_count;
}

fn ss_neighbor_select_active_index_match(
  queue_offset: u32,
  source_active_index: u32,
  active_stride: u32,
  candidate_slot: u32
) -> u32 {
  if (!ss_neighbor_active_index_enabled()) {
    return params.active_node_count;
  }
  var matched_count = 0u;
  var bucket_slot_index = 0u;
  loop {
    if (bucket_slot_index >= params.active_node_index_bucket_slot_capacity) {
      break;
    }
    let active_index = ss_neighbor_active_index_slot(queue_offset, bucket_slot_index);
    if (active_index < params.active_node_count && active_index != source_active_index) {
      let active_offset = active_index * active_stride;
      if (ss_neighbor_active_node_ready(active_offset) && ss_neighbor_tiles_overlap(queue_offset, active_offset)) {
        if (matched_count == candidate_slot) {
          return active_index;
        }
        matched_count = matched_count + 1u;
      }
    }
    bucket_slot_index = bucket_slot_index + 1u;
  }
  return params.active_node_count;
}

fn ss_neighbor_sorted_index_match_count(queue_offset: u32, source_active_index: u32, active_stride: u32) -> u32 {
  if (!ss_neighbor_sorted_index_enabled()) {
    return 0u;
  }
  var matched_count = 0u;
  var cursor = ss_neighbor_sorted_range_start(queue_offset);
  let end = min(ss_neighbor_sorted_range_end(queue_offset), params.active_node_count);
  loop {
    if (cursor >= end) {
      break;
    }
    let active_index = active_node_sorted_active_indices[cursor];
    if (active_index < params.active_node_count && active_index != source_active_index) {
      let active_offset = active_index * active_stride;
      if (ss_neighbor_active_node_ready(active_offset) && ss_neighbor_tiles_overlap(queue_offset, active_offset)) {
        matched_count = matched_count + 1u;
      }
    }
    cursor = cursor + 1u;
  }
  return matched_count;
}

fn ss_neighbor_select_sorted_index_match(
  queue_offset: u32,
  source_active_index: u32,
  active_stride: u32,
  candidate_slot: u32
) -> u32 {
  if (!ss_neighbor_sorted_index_enabled()) {
    return params.active_node_count;
  }
  var matched_count = 0u;
  var cursor = ss_neighbor_sorted_range_start(queue_offset);
  let end = min(ss_neighbor_sorted_range_end(queue_offset), params.active_node_count);
  loop {
    if (cursor >= end) {
      break;
    }
    let active_index = active_node_sorted_active_indices[cursor];
    if (active_index < params.active_node_count && active_index != source_active_index) {
      let active_offset = active_index * active_stride;
      if (ss_neighbor_active_node_ready(active_offset) && ss_neighbor_tiles_overlap(queue_offset, active_offset)) {
        if (matched_count == candidate_slot) {
          return active_index;
        }
        matched_count = matched_count + 1u;
      }
    }
    cursor = cursor + 1u;
  }
  return params.active_node_count;
}

fn ss_neighbor_write_inactive(row_offset: u32, source_index: f32, queue_row_index: u32, queue_epoch: f32) {
  ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_INACTIVE_CANDIDATES, 1u);
  neighbor_candidate_rows[row_offset + 0u] = source_index;
  neighbor_candidate_rows[row_offset + 1u] = -1.0;
  neighbor_candidate_rows[row_offset + 2u] = 0.0;
  neighbor_candidate_rows[row_offset + 3u] = SCHROEDER_LAW_NEIGHBOR_STATUS_INACTIVE;
  neighbor_candidate_rows[row_offset + 4u] = 0.0;
  neighbor_candidate_rows[row_offset + 5u] = 0.0;
  neighbor_candidate_rows[row_offset + 6u] = 0.0;
  neighbor_candidate_rows[row_offset + 7u] = 0.0;
  neighbor_candidate_rows[row_offset + 8u] = 0.0;
  neighbor_candidate_rows[row_offset + 9u] = 0.0;
  neighbor_candidate_rows[row_offset + 10u] = 0.0;
  neighbor_candidate_rows[row_offset + 11u] = f32(queue_row_index);
  neighbor_candidate_rows[row_offset + 12u] = 0.0;
  neighbor_candidate_rows[row_offset + 13u] = 0.0;
  neighbor_candidate_rows[row_offset + 14u] = 0.0;
  neighbor_candidate_rows[row_offset + 15u] = queue_epoch;
}

fn ss_neighbor_write_source_span(source_index: u32, candidate_start: u32, candidate_count: u32, status: f32) {
  if (source_index >= params.particle_count) {
    return;
  }
  let source_span_stride = max(params.source_span_stride, SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_STRIDE);
  let span_offset = source_index * source_span_stride;
  source_candidate_span_rows[span_offset + 0u] = f32(source_index);
  source_candidate_span_rows[span_offset + 1u] = f32(candidate_start);
  source_candidate_span_rows[span_offset + 2u] = f32(candidate_count);
  source_candidate_span_rows[span_offset + 3u] = status;
  ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_SOURCE_SPANS, 1u);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candidate_index = global_id.x;
  let candidate_budget = max(params.candidate_budget, 1u);
  let candidate_count = params.law_queue_count * candidate_budget;
  if (candidate_index >= candidate_count) {
    return;
  }
  ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_CANDIDATE_INVOCATIONS, 1u);
  let queue_row_index = candidate_index / candidate_budget;
  let candidate_slot = candidate_index - queue_row_index * candidate_budget;
  let queue_stride = max(params.law_queue_stride, SCHROEDER_LAW_NEIGHBOR_QUEUE_STRIDE);
  let active_stride = max(params.active_node_stride, SCHROEDER_LAW_NEIGHBOR_ACTIVE_NODE_STRIDE);
  let neighbor_stride = max(params.neighbor_stride, SCHROEDER_LAW_NEIGHBOR_ROW_STRIDE);
  let state_stride = max(params.state_stride, SCHROEDER_LAW_NEIGHBOR_STATE_STRIDE);
  let candidate_start = queue_row_index * candidate_budget;
  let queue_offset = queue_row_index * queue_stride;
  let row_offset = candidate_index * neighbor_stride;
  let source_index_f = law_queue_rows[queue_offset + 0u];
  let queue_epoch = law_queue_rows[queue_offset + 28u];

  if (params.particle_count == 0u || params.active_node_count == 0u || queue_row_index >= params.law_queue_count) {
    ss_neighbor_write_inactive(row_offset, source_index_f, queue_row_index, queue_epoch);
    return;
  }

  let source_index = u32(max(round(source_index_f), 0.0));
  if (source_index >= params.particle_count) {
    ss_neighbor_write_inactive(row_offset, source_index_f, queue_row_index, queue_epoch);
    return;
  }

  let queue_status = law_queue_rows[queue_offset + 3u];
  let queue_enabled = queue_status > 0.0 && queue_status < 32.0;
  let row_law_mask = u32(max(round(law_queue_rows[queue_offset + 12u]), 0.0));
  let enabled_law_mask = row_law_mask & params.enabled_law_mask;
  let reaction_enabled = (enabled_law_mask & SCHROEDER_LAW_NEIGHBOR_REACTION_MASK) != 0u
    && law_queue_rows[queue_offset + 13u] > 0.5;
  let contact_enabled = (enabled_law_mask & SCHROEDER_LAW_NEIGHBOR_CONTACT_MASK) != 0u
    && law_queue_rows[queue_offset + 14u] > 0.5;
  let interface_enabled = (enabled_law_mask & SCHROEDER_LAW_NEIGHBOR_INTERFACE_MASK) != 0u
    && law_queue_rows[queue_offset + 15u] > 0.5;
  let local_law_enabled = reaction_enabled || contact_enabled || interface_enabled;
  if (candidate_slot == 0u) {
    let span_status = select(
      SCHROEDER_LAW_NEIGHBOR_STATUS_INACTIVE,
      SCHROEDER_LAW_NEIGHBOR_STATUS_READY,
      queue_enabled && local_law_enabled
    );
    ss_neighbor_write_source_span(source_index, candidate_start, candidate_budget, span_status);
  }
  if (!queue_enabled || !local_law_enabled) {
    ss_neighbor_write_inactive(row_offset, source_index_f, queue_row_index, queue_epoch);
    return;
  }

  var source_active_index = u32(max(round(law_queue_rows[queue_offset + 27u]), 0.0));
  if (source_active_index >= params.active_node_count) {
    source_active_index = min(queue_row_index, params.active_node_count - 1u);
  }
  var selected_active_index = params.active_node_count;
  var indexed_match_count = 0u;
  if (ss_neighbor_sorted_index_enabled()) {
    ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_BUCKET_ATTEMPTS, 1u);
    selected_active_index = ss_neighbor_select_sorted_index_match(
      queue_offset,
      source_active_index,
      active_stride,
      candidate_slot
    );
    if (selected_active_index < params.active_node_count) {
      ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_BUCKET_SELECTED, 1u);
    }
    if (selected_active_index >= params.active_node_count) {
      indexed_match_count = ss_neighbor_sorted_index_match_count(queue_offset, source_active_index, active_stride);
    }
  } else if (ss_neighbor_active_index_enabled()) {
    ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_BUCKET_ATTEMPTS, 1u);
    if (candidate_slot == 0u && ss_neighbor_active_index_bucket_full(queue_offset)) {
      ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_BUCKET_PRESSURE, 1u);
    }
    selected_active_index = ss_neighbor_select_active_index_match(
      queue_offset,
      source_active_index,
      active_stride,
      candidate_slot
    );
    if (selected_active_index < params.active_node_count) {
      ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_BUCKET_SELECTED, 1u);
    }
    if (selected_active_index >= params.active_node_count) {
      indexed_match_count = ss_neighbor_active_index_match_count(queue_offset, source_active_index, active_stride);
    }
  }
  var fallback_target_slot = candidate_slot;
  if (candidate_slot >= indexed_match_count) {
    fallback_target_slot = candidate_slot - indexed_match_count;
  }
  var matched_count = 0u;
  var scan_step = 0u;
  if (selected_active_index >= params.active_node_count) {
    ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_EXACT_FALLBACK_SCANS, 1u);
    loop {
      if (scan_step >= params.active_node_count) {
        break;
      }
      let active_index = (source_active_index + 1u + scan_step) % params.active_node_count;
      if (
        active_index != source_active_index
        && !ss_neighbor_sorted_index_contains(queue_offset, active_index)
        && !ss_neighbor_active_index_contains(queue_offset, active_index)
      ) {
        let active_offset = active_index * active_stride;
        if (ss_neighbor_active_node_ready(active_offset) && ss_neighbor_tiles_overlap(queue_offset, active_offset)) {
          if (matched_count == fallback_target_slot) {
            selected_active_index = active_index;
            ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_EXACT_FALLBACK_SELECTED, 1u);
            break;
          }
          matched_count = matched_count + 1u;
        }
      }
      scan_step = scan_step + 1u;
    }
  }
  if (selected_active_index >= params.active_node_count) {
    ss_neighbor_write_inactive(row_offset, source_index_f, queue_row_index, queue_epoch);
    return;
  }
  let selected_active_offset = selected_active_index * active_stride;
  let neighbor_index = u32(max(round(active_nodes[selected_active_offset + 10u]), 0.0));
  if (neighbor_index >= params.particle_count || neighbor_index == source_index) {
    ss_neighbor_write_inactive(row_offset, source_index_f, queue_row_index, queue_epoch);
    return;
  }
  let source_state = ss_neighbor_state_pos_mass(source_index, state_stride);
  let neighbor_state = ss_neighbor_state_pos_mass(neighbor_index, state_stride);
  let support_radius = max(max(law_queue_rows[queue_offset + 11u], active_nodes[selected_active_offset + 9u]), 0.000001);
  let delta = neighbor_state.xyz - source_state.xyz;
  let distance_m = length(delta);
  let within_support = distance_m <= support_radius;
  let masses_ready = source_state.w > 0.0 && neighbor_state.w > 0.0;
  if (!within_support || !masses_ready) {
    ss_neighbor_write_inactive(row_offset, source_index_f, queue_row_index, queue_epoch);
    return;
  }

  neighbor_candidate_rows[row_offset + 0u] = f32(source_index);
  neighbor_candidate_rows[row_offset + 1u] = f32(neighbor_index);
  neighbor_candidate_rows[row_offset + 2u] = f32(enabled_law_mask);
  neighbor_candidate_rows[row_offset + 3u] = SCHROEDER_LAW_NEIGHBOR_STATUS_READY;
  neighbor_candidate_rows[row_offset + 4u] = law_queue_rows[queue_offset + 1u];
  neighbor_candidate_rows[row_offset + 5u] = active_nodes[selected_active_offset + 0u];
  neighbor_candidate_rows[row_offset + 6u] = law_queue_rows[queue_offset + 2u];
  neighbor_candidate_rows[row_offset + 7u] = active_nodes[selected_active_offset + 15u];
  neighbor_candidate_rows[row_offset + 8u] = distance_m;
  neighbor_candidate_rows[row_offset + 9u] = support_radius;
  neighbor_candidate_rows[row_offset + 10u] = max(0.0, 1.0 - distance_m / support_radius);
  neighbor_candidate_rows[row_offset + 11u] = f32(queue_row_index);
  neighbor_candidate_rows[row_offset + 12u] = law_queue_rows[queue_offset + 16u];
  neighbor_candidate_rows[row_offset + 13u] = 0.0;
  neighbor_candidate_rows[row_offset + 14u] = select(0.0, 1.0, reaction_enabled)
    + select(0.0, 2.0, contact_enabled)
    + select(0.0, 4.0, interface_enabled)
    + 8.0;
  neighbor_candidate_rows[row_offset + 15u] = queue_epoch;
}
`;

export const schroederCrossLevelCouplingWgsl = `
struct SchroederCrossLevelParams {
  particle_count: u32,
  max_level: i32,
  parent_level_delta: i32,
  flags: u32,
  base_grid_spacing_m: f32,
  coupling_halo_cells: f32,
  min_coupling_radius_m: f32,
  max_coupling_radius_m: f32,
  tile_cell_count: u32,
  pad0: u32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> level_assignments: array<f32>;
@group(0) @binding(1) var<storage, read> active_nodes: array<f32>;
@group(0) @binding(2) var<storage, read_write> cross_level_couplings: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederCrossLevelParams;

const SCHROEDER_ASSIGNMENT_STRIDE: u32 = 16u;
const SCHROEDER_ACTIVE_NODE_STRIDE: u32 = 16u;
const SCHROEDER_CROSS_LEVEL_STRIDE: u32 = 16u;

fn ss_cross_positive(value: f32) -> bool {
  return value == value && value > 0.0;
}

fn ss_cross_clamp_radius(radius: f32) -> f32 {
  var clamped = max(radius, 0.0);
  if (ss_cross_positive(params.min_coupling_radius_m)) {
    clamped = max(clamped, params.min_coupling_radius_m);
  }
  if (ss_cross_positive(params.max_coupling_radius_m)) {
    clamped = min(clamped, params.max_coupling_radius_m);
  }
  return clamped;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let assignment_offset = particle_index * SCHROEDER_ASSIGNMENT_STRIDE;
  let node_offset = particle_index * SCHROEDER_ACTIVE_NODE_STRIDE;
  let coupling_offset = particle_index * SCHROEDER_CROSS_LEVEL_STRIDE;

  let child_level = i32(round(level_assignments[assignment_offset + 0u]));
  let child_dx = max(level_assignments[assignment_offset + 1u], 0.000001);
  let support_radius = max(level_assignments[assignment_offset + 2u], 0.0);
  let represented_volume_m3 = max(level_assignments[assignment_offset + 3u], 0.0);
  let mass_kg = max(level_assignments[assignment_offset + 6u], 0.0);
  let assignment_status = level_assignments[assignment_offset + 10u];
  let position = vec3<f32>(
    level_assignments[assignment_offset + 12u],
    level_assignments[assignment_offset + 13u],
    level_assignments[assignment_offset + 14u]
  );
  let chart_id = level_assignments[assignment_offset + 15u];
  let active_status = active_nodes[node_offset + 11u];

  let requested_delta = max(params.parent_level_delta, 1);
  let unclamped_parent_level = child_level + requested_delta;
  let parent_level = min(unclamped_parent_level, params.max_level);
  let level_delta = parent_level - child_level;
  let base_dx = max(params.base_grid_spacing_m, 0.000001);
  let parent_dx = base_dx * exp2(f32(parent_level));
  let parent_tile_spacing = max(parent_dx, 0.000001) * f32(max(params.tile_cell_count, 1u));
  let halo_radius = max(params.coupling_halo_cells, 0.0) * max(child_dx, parent_dx);
  let coupling_radius = ss_cross_clamp_radius(support_radius + halo_radius);
  let parent_cell = floor(position / max(parent_dx, 0.000001));
  var status = select(32.0, 1.0, assignment_status > 0.0 && active_status > 0.0 && child_dx > 0.0 && parent_dx > 0.0);
  if (parent_level == child_level) {
    status = status + 64.0;
  }

  cross_level_couplings[coupling_offset + 0u] = f32(particle_index);
  cross_level_couplings[coupling_offset + 1u] = f32(child_level);
  cross_level_couplings[coupling_offset + 2u] = f32(parent_level);
  cross_level_couplings[coupling_offset + 3u] = f32(level_delta);
  cross_level_couplings[coupling_offset + 4u] = child_dx;
  cross_level_couplings[coupling_offset + 5u] = parent_dx;
  cross_level_couplings[coupling_offset + 6u] = support_radius;
  cross_level_couplings[coupling_offset + 7u] = coupling_radius;
  cross_level_couplings[coupling_offset + 8u] = parent_cell.x;
  cross_level_couplings[coupling_offset + 9u] = parent_cell.y;
  cross_level_couplings[coupling_offset + 10u] = parent_cell.z;
  cross_level_couplings[coupling_offset + 11u] = parent_tile_spacing;
  cross_level_couplings[coupling_offset + 12u] = mass_kg;
  cross_level_couplings[coupling_offset + 13u] = represented_volume_m3;
  cross_level_couplings[coupling_offset + 14u] = status;
  cross_level_couplings[coupling_offset + 15u] = chart_id;
}
`;

export const schroederConservationSummaryWgsl = `
struct SchroederConservationSummaryParams {
  candidate_count: u32,
  cross_level_stride: u32,
  summary_stride: u32,
  flags: u32,
};

@group(0) @binding(0) var<storage, read> cross_level_couplings: array<f32>;
@group(0) @binding(1) var<storage, read_write> summary_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederConservationSummaryParams;

const SCHROEDER_SUMMARY_WORKGROUP_SIZE: u32 = 64u;
const SCHROEDER_DEFAULT_CROSS_LEVEL_STRIDE: u32 = 16u;
const SCHROEDER_DEFAULT_SUMMARY_STRIDE: u32 = 16u;

var<workgroup> wg_candidate_count: array<f32, 64>;
var<workgroup> wg_active_count: array<f32, 64>;
var<workgroup> wg_blocked_count: array<f32, 64>;
var<workgroup> wg_same_level_count: array<f32, 64>;
var<workgroup> wg_source_mass: array<f32, 64>;
var<workgroup> wg_restricted_mass: array<f32, 64>;
var<workgroup> wg_source_volume: array<f32, 64>;
var<workgroup> wg_restricted_volume: array<f32, 64>;
var<workgroup> wg_max_mass_residual: array<f32, 64>;
var<workgroup> wg_max_volume_residual: array<f32, 64>;
var<workgroup> wg_bad_weight_count: array<f32, 64>;
var<workgroup> wg_missing_parent_child_count: array<f32, 64>;

@compute @workgroup_size(64)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let particle_index = global_id.x;
  let local_index = local_id.x;
  let cross_stride = max(params.cross_level_stride, SCHROEDER_DEFAULT_CROSS_LEVEL_STRIDE);

  var candidate_count = 0.0;
  var active_count = 0.0;
  var blocked_count = 0.0;
  var same_level_count = 0.0;
  var source_mass = 0.0;
  var restricted_mass = 0.0;
  var source_volume = 0.0;
  var restricted_volume = 0.0;
  var max_mass_residual = 0.0;
  var max_volume_residual = 0.0;
  var bad_weight_count = 0.0;
  var missing_parent_child_count = 0.0;

  if (particle_index < params.candidate_count) {
    let offset = particle_index * cross_stride;
    let level_delta = cross_level_couplings[offset + 3u];
    let mass_kg = max(cross_level_couplings[offset + 12u], 0.0);
    let represented_volume_m3 = max(cross_level_couplings[offset + 13u], 0.0);
    let status = cross_level_couplings[offset + 14u];
    let active_candidate = select(0.0, 1.0, status > 0.0 && status < 32.0 && level_delta > 0.0);
    let blocked = select(0.0, 1.0, status >= 32.0 && status < 64.0);
    let same_level = select(0.0, 1.0, status >= 64.0 || level_delta <= 0.0);

    candidate_count = 1.0;
    active_count = active_candidate;
    blocked_count = blocked;
    same_level_count = same_level;
    source_mass = mass_kg;
    restricted_mass = mass_kg * active_candidate;
    source_volume = represented_volume_m3;
    restricted_volume = represented_volume_m3 * active_candidate;
    max_mass_residual = abs(source_mass - restricted_mass);
    max_volume_residual = abs(source_volume - restricted_volume);
    missing_parent_child_count = blocked;
  }

  wg_candidate_count[local_index] = candidate_count;
  wg_active_count[local_index] = active_count;
  wg_blocked_count[local_index] = blocked_count;
  wg_same_level_count[local_index] = same_level_count;
  wg_source_mass[local_index] = source_mass;
  wg_restricted_mass[local_index] = restricted_mass;
  wg_source_volume[local_index] = source_volume;
  wg_restricted_volume[local_index] = restricted_volume;
  wg_max_mass_residual[local_index] = max_mass_residual;
  wg_max_volume_residual[local_index] = max_volume_residual;
  wg_bad_weight_count[local_index] = bad_weight_count;
  wg_missing_parent_child_count[local_index] = missing_parent_child_count;
  workgroupBarrier();

  if (local_index == 0u) {
    var sum_candidate_count = 0.0;
    var sum_active_count = 0.0;
    var sum_blocked_count = 0.0;
    var sum_same_level_count = 0.0;
    var sum_source_mass = 0.0;
    var sum_restricted_mass = 0.0;
    var sum_source_volume = 0.0;
    var sum_restricted_volume = 0.0;
    var max_abs_mass_residual = 0.0;
    var max_abs_volume_residual = 0.0;
    var sum_bad_weight_count = 0.0;
    var sum_missing_parent_child_count = 0.0;
    for (var index = 0u; index < SCHROEDER_SUMMARY_WORKGROUP_SIZE; index = index + 1u) {
      sum_candidate_count = sum_candidate_count + wg_candidate_count[index];
      sum_active_count = sum_active_count + wg_active_count[index];
      sum_blocked_count = sum_blocked_count + wg_blocked_count[index];
      sum_same_level_count = sum_same_level_count + wg_same_level_count[index];
      sum_source_mass = sum_source_mass + wg_source_mass[index];
      sum_restricted_mass = sum_restricted_mass + wg_restricted_mass[index];
      sum_source_volume = sum_source_volume + wg_source_volume[index];
      sum_restricted_volume = sum_restricted_volume + wg_restricted_volume[index];
      max_abs_mass_residual = max(max_abs_mass_residual, wg_max_mass_residual[index]);
      max_abs_volume_residual = max(max_abs_volume_residual, wg_max_volume_residual[index]);
      sum_bad_weight_count = sum_bad_weight_count + wg_bad_weight_count[index];
      sum_missing_parent_child_count = sum_missing_parent_child_count + wg_missing_parent_child_count[index];
    }
    let summary_stride = max(params.summary_stride, SCHROEDER_DEFAULT_SUMMARY_STRIDE);
    let summary_offset = workgroup_id.x * summary_stride;
    let mass_residual = sum_source_mass - sum_restricted_mass;
    let volume_residual = sum_source_volume - sum_restricted_volume;
    summary_rows[summary_offset + 0u] = sum_candidate_count;
    summary_rows[summary_offset + 1u] = sum_active_count;
    summary_rows[summary_offset + 2u] = sum_blocked_count;
    summary_rows[summary_offset + 3u] = sum_same_level_count;
    summary_rows[summary_offset + 4u] = sum_source_mass;
    summary_rows[summary_offset + 5u] = sum_restricted_mass;
    summary_rows[summary_offset + 6u] = mass_residual;
    summary_rows[summary_offset + 7u] = sum_source_volume;
    summary_rows[summary_offset + 8u] = sum_restricted_volume;
    summary_rows[summary_offset + 9u] = volume_residual;
    summary_rows[summary_offset + 10u] = max_abs_mass_residual;
    summary_rows[summary_offset + 11u] = max_abs_volume_residual;
    summary_rows[summary_offset + 12u] = sum_bad_weight_count;
    summary_rows[summary_offset + 13u] = sum_missing_parent_child_count;
    summary_rows[summary_offset + 14u] = select(0.0, 1.0, sum_candidate_count > 0.0);
    summary_rows[summary_offset + 15u] = 0.0;
  }
}
`;

export const schroederCrossLevelTransferWgsl = `
struct SchroederCrossLevelTransferParams {
  candidate_count: u32,
  cross_level_stride: u32,
  state_stride: u32,
  transfer_stride: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> cross_level_couplings: array<f32>;
@group(0) @binding(1) var<storage, read> sph_state: array<f32>;
@group(0) @binding(2) var<storage, read_write> transfer_rows: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederCrossLevelTransferParams;

const SCHROEDER_DEFAULT_CROSS_LEVEL_TRANSFER_STRIDE: u32 = 24u;
const SCHROEDER_DEFAULT_CROSS_LEVEL_STRIDE_FOR_TRANSFER: u32 = 16u;
const SCHROEDER_DEFAULT_SPH_STATE_STRIDE_FOR_TRANSFER: u32 = 8u;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candidate_index = global_id.x;
  if (candidate_index >= params.candidate_count) {
    return;
  }

  let cross_stride = max(params.cross_level_stride, SCHROEDER_DEFAULT_CROSS_LEVEL_STRIDE_FOR_TRANSFER);
  let state_stride = max(params.state_stride, SCHROEDER_DEFAULT_SPH_STATE_STRIDE_FOR_TRANSFER);
  let transfer_stride = max(params.transfer_stride, SCHROEDER_DEFAULT_CROSS_LEVEL_TRANSFER_STRIDE);
  let cross_offset = candidate_index * cross_stride;
  let transfer_offset = candidate_index * transfer_stride;

  let source_particle_index = u32(max(cross_level_couplings[cross_offset + 0u], 0.0));
  let state_offset = source_particle_index * state_stride;
  let child_level = cross_level_couplings[cross_offset + 1u];
  let parent_level = cross_level_couplings[cross_offset + 2u];
  let level_delta = cross_level_couplings[cross_offset + 3u];
  let parent_cell = vec3<f32>(
    cross_level_couplings[cross_offset + 8u],
    cross_level_couplings[cross_offset + 9u],
    cross_level_couplings[cross_offset + 10u]
  );
  let source_mass_kg = max(cross_level_couplings[cross_offset + 12u], 0.0);
  let source_volume_m3 = max(cross_level_couplings[cross_offset + 13u], 0.0);
  let candidate_status = cross_level_couplings[cross_offset + 14u];
  let chart_id = cross_level_couplings[cross_offset + 15u];
  let velocity = vec3<f32>(
    sph_state[state_offset + 4u],
    sph_state[state_offset + 5u],
    sph_state[state_offset + 6u]
  );
  let specific_internal_energy = sph_state[state_offset + 7u];
  let transfer_weight = select(0.0, 1.0, candidate_status > 0.0 && candidate_status < 32.0 && level_delta > 0.0);
  let transfer_mass_kg = source_mass_kg * transfer_weight;
  let transfer_volume_m3 = source_volume_m3 * transfer_weight;
  let momentum = velocity * transfer_mass_kg;
  let internal_energy_j = specific_internal_energy * transfer_mass_kg;
  let transfer_status = select(32.0, 1.0, transfer_weight > 0.0);

  transfer_rows[transfer_offset + 0u] = f32(source_particle_index);
  transfer_rows[transfer_offset + 1u] = child_level;
  transfer_rows[transfer_offset + 2u] = parent_level;
  transfer_rows[transfer_offset + 3u] = level_delta;
  transfer_rows[transfer_offset + 4u] = parent_cell.x;
  transfer_rows[transfer_offset + 5u] = parent_cell.y;
  transfer_rows[transfer_offset + 6u] = parent_cell.z;
  transfer_rows[transfer_offset + 7u] = chart_id;
  transfer_rows[transfer_offset + 8u] = source_mass_kg;
  transfer_rows[transfer_offset + 9u] = transfer_mass_kg;
  transfer_rows[transfer_offset + 10u] = source_mass_kg - transfer_mass_kg;
  transfer_rows[transfer_offset + 11u] = source_volume_m3;
  transfer_rows[transfer_offset + 12u] = transfer_volume_m3;
  transfer_rows[transfer_offset + 13u] = source_volume_m3 - transfer_volume_m3;
  transfer_rows[transfer_offset + 14u] = momentum.x;
  transfer_rows[transfer_offset + 15u] = momentum.y;
  transfer_rows[transfer_offset + 16u] = momentum.z;
  transfer_rows[transfer_offset + 17u] = internal_energy_j;
  transfer_rows[transfer_offset + 18u] = velocity.x;
  transfer_rows[transfer_offset + 19u] = velocity.y;
  transfer_rows[transfer_offset + 20u] = velocity.z;
  transfer_rows[transfer_offset + 21u] = specific_internal_energy;
  transfer_rows[transfer_offset + 22u] = transfer_weight;
  transfer_rows[transfer_offset + 23u] = transfer_status;
}
`;

export const schroederCrossLevelStateDeltaWgsl = `
struct SchroederCrossLevelStateDeltaParams {
  candidate_count: u32,
  transfer_stride: u32,
  state_delta_stride: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  pad3: u32,
};

@group(0) @binding(0) var<storage, read> transfer_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> state_delta_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederCrossLevelStateDeltaParams;

const SCHROEDER_DEFAULT_TRANSFER_STRIDE_FOR_DELTA: u32 = 24u;
const SCHROEDER_DEFAULT_STATE_DELTA_STRIDE: u32 = 32u;

fn ss_delta_target_key(parent_cell: vec3<f32>, chart_id: f32, parent_level: f32) -> f32 {
  return chart_id * 268435456.0
    + parent_level * 16777216.0
    + parent_cell.z * 65536.0
    + parent_cell.y * 256.0
    + parent_cell.x;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candidate_index = global_id.x;
  if (candidate_index >= params.candidate_count) {
    return;
  }

  let transfer_stride = max(params.transfer_stride, SCHROEDER_DEFAULT_TRANSFER_STRIDE_FOR_DELTA);
  let state_delta_stride = max(params.state_delta_stride, SCHROEDER_DEFAULT_STATE_DELTA_STRIDE);
  let transfer_offset = candidate_index * transfer_stride;
  let state_delta_offset = candidate_index * state_delta_stride;

  let source_particle_index = transfer_rows[transfer_offset + 0u];
  let child_level = transfer_rows[transfer_offset + 1u];
  let parent_level = transfer_rows[transfer_offset + 2u];
  let level_delta = transfer_rows[transfer_offset + 3u];
  let parent_cell = vec3<f32>(
    transfer_rows[transfer_offset + 4u],
    transfer_rows[transfer_offset + 5u],
    transfer_rows[transfer_offset + 6u]
  );
  let chart_id = transfer_rows[transfer_offset + 7u];
  let transfer_mass_kg = transfer_rows[transfer_offset + 9u];
  let transfer_volume_m3 = transfer_rows[transfer_offset + 12u];
  let momentum = vec3<f32>(
    transfer_rows[transfer_offset + 14u],
    transfer_rows[transfer_offset + 15u],
    transfer_rows[transfer_offset + 16u]
  );
  let internal_energy_j = transfer_rows[transfer_offset + 17u];
  let transfer_weight = transfer_rows[transfer_offset + 22u];
  let transfer_status = transfer_rows[transfer_offset + 23u];
  let active_transfer = select(0.0, 1.0, transfer_status > 0.0 && transfer_status < 32.0 && transfer_weight > 0.0);
  let applied_mass_kg = transfer_mass_kg * active_transfer;
  let applied_volume_m3 = transfer_volume_m3 * active_transfer;
  let applied_momentum = momentum * active_transfer;
  let applied_internal_energy_j = internal_energy_j * active_transfer;
  let source_mass_delta_kg = -applied_mass_kg;
  let target_mass_delta_kg = applied_mass_kg;
  let source_volume_delta_m3 = -applied_volume_m3;
  let target_volume_delta_m3 = applied_volume_m3;
  let source_momentum_delta = -applied_momentum;
  let target_momentum_delta = applied_momentum;
  let source_internal_energy_delta_j = -applied_internal_energy_j;
  let target_internal_energy_delta_j = applied_internal_energy_j;
  let state_delta_status = select(32.0, 1.0, active_transfer > 0.0);

  state_delta_rows[state_delta_offset + 0u] = source_particle_index;
  state_delta_rows[state_delta_offset + 1u] = child_level;
  state_delta_rows[state_delta_offset + 2u] = parent_level;
  state_delta_rows[state_delta_offset + 3u] = level_delta;
  state_delta_rows[state_delta_offset + 4u] = parent_cell.x;
  state_delta_rows[state_delta_offset + 5u] = parent_cell.y;
  state_delta_rows[state_delta_offset + 6u] = parent_cell.z;
  state_delta_rows[state_delta_offset + 7u] = chart_id;
  state_delta_rows[state_delta_offset + 8u] = source_mass_delta_kg;
  state_delta_rows[state_delta_offset + 9u] = target_mass_delta_kg;
  state_delta_rows[state_delta_offset + 10u] = source_mass_delta_kg + target_mass_delta_kg;
  state_delta_rows[state_delta_offset + 11u] = source_volume_delta_m3;
  state_delta_rows[state_delta_offset + 12u] = target_volume_delta_m3;
  state_delta_rows[state_delta_offset + 13u] = source_volume_delta_m3 + target_volume_delta_m3;
  state_delta_rows[state_delta_offset + 14u] = source_momentum_delta.x;
  state_delta_rows[state_delta_offset + 15u] = source_momentum_delta.y;
  state_delta_rows[state_delta_offset + 16u] = source_momentum_delta.z;
  state_delta_rows[state_delta_offset + 17u] = target_momentum_delta.x;
  state_delta_rows[state_delta_offset + 18u] = target_momentum_delta.y;
  state_delta_rows[state_delta_offset + 19u] = target_momentum_delta.z;
  state_delta_rows[state_delta_offset + 20u] = source_momentum_delta.x + target_momentum_delta.x;
  state_delta_rows[state_delta_offset + 21u] = source_momentum_delta.y + target_momentum_delta.y;
  state_delta_rows[state_delta_offset + 22u] = source_momentum_delta.z + target_momentum_delta.z;
  state_delta_rows[state_delta_offset + 23u] = source_internal_energy_delta_j;
  state_delta_rows[state_delta_offset + 24u] = target_internal_energy_delta_j;
  state_delta_rows[state_delta_offset + 25u] = source_internal_energy_delta_j + target_internal_energy_delta_j;
  state_delta_rows[state_delta_offset + 26u] = transfer_weight * active_transfer;
  state_delta_rows[state_delta_offset + 27u] = ss_delta_target_key(parent_cell, chart_id, parent_level);
  state_delta_rows[state_delta_offset + 28u] = state_delta_status;
  state_delta_rows[state_delta_offset + 29u] = 1.0;
  state_delta_rows[state_delta_offset + 30u] = 1.0;
  state_delta_rows[state_delta_offset + 31u] = 0.0;
}
`;

export const schroederCrossLevelStateDeltaMergeWgsl = `
struct SchroederCrossLevelStateDeltaMergeParams {
  candidate_count: u32,
  state_delta_stride: u32,
  merge_stride: u32,
  flags: u32,
  merge_epoch: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> state_delta_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> merge_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederCrossLevelStateDeltaMergeParams;

const SCHROEDER_DEFAULT_STATE_DELTA_STRIDE_FOR_MERGE: u32 = 32u;
const SCHROEDER_DEFAULT_STATE_DELTA_MERGE_STRIDE: u32 = 32u;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candidate_index = global_id.x;
  if (candidate_index >= params.candidate_count) {
    return;
  }

  let state_delta_stride = max(params.state_delta_stride, SCHROEDER_DEFAULT_STATE_DELTA_STRIDE_FOR_MERGE);
  let merge_stride = max(params.merge_stride, SCHROEDER_DEFAULT_STATE_DELTA_MERGE_STRIDE);
  let state_delta_offset = candidate_index * state_delta_stride;
  let merge_offset = candidate_index * merge_stride;

  for (var column = 0u; column < 30u; column = column + 1u) {
    merge_rows[merge_offset + column] = state_delta_rows[state_delta_offset + column];
  }
  merge_rows[merge_offset + 30u] = 1.0;
  merge_rows[merge_offset + 31u] = params.merge_epoch;
}
`;

export const schroederHierarchyAggregateWgsl = `
struct SchroederHierarchyAggregateParams {
  row_count: u32,
  merge_stride: u32,
  aggregate_stride: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  pad3: u32,
};

@group(0) @binding(0) var<storage, read> merge_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> aggregate_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederHierarchyAggregateParams;

const SCHROEDER_DEFAULT_STATE_DELTA_MERGE_STRIDE_FOR_AGGREGATE: u32 = 32u;
const SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_STRIDE: u32 = 32u;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.row_count) {
    return;
  }

  let merge_stride = max(params.merge_stride, SCHROEDER_DEFAULT_STATE_DELTA_MERGE_STRIDE_FOR_AGGREGATE);
  let aggregate_stride = max(params.aggregate_stride, SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_STRIDE);
  let merge_offset = row_index * merge_stride;
  let aggregate_offset = row_index * aggregate_stride;

  let source_particle_index = merge_rows[merge_offset + 0u];
  let child_level = merge_rows[merge_offset + 1u];
  let parent_level = merge_rows[merge_offset + 2u];
  let level_delta = merge_rows[merge_offset + 3u];
  let parent_cell = vec3<f32>(
    merge_rows[merge_offset + 4u],
    merge_rows[merge_offset + 5u],
    merge_rows[merge_offset + 6u]
  );
  let chart_id = merge_rows[merge_offset + 7u];
  let source_mass_delta_kg = merge_rows[merge_offset + 8u];
  let target_mass_delta_kg = merge_rows[merge_offset + 9u];
  let mass_residual_kg = merge_rows[merge_offset + 10u];
  let source_volume_delta_m3 = merge_rows[merge_offset + 11u];
  let target_volume_delta_m3 = merge_rows[merge_offset + 12u];
  let volume_residual_m3 = merge_rows[merge_offset + 13u];
  let target_momentum = vec3<f32>(
    merge_rows[merge_offset + 17u],
    merge_rows[merge_offset + 18u],
    merge_rows[merge_offset + 19u]
  );
  let momentum_residual = vec3<f32>(
    merge_rows[merge_offset + 20u],
    merge_rows[merge_offset + 21u],
    merge_rows[merge_offset + 22u]
  );
  let target_internal_energy_j = merge_rows[merge_offset + 24u];
  let internal_energy_residual_j = merge_rows[merge_offset + 25u];
  let transfer_weight = merge_rows[merge_offset + 26u];
  let target_aggregate_key = merge_rows[merge_offset + 27u];
  let merge_status = merge_rows[merge_offset + 28u];
  let state_family_id = merge_rows[merge_offset + 29u];
  let admission_approved = merge_rows[merge_offset + 30u];
  let merge_epoch = merge_rows[merge_offset + 31u];
  let active_row = select(0.0, 1.0, merge_status > 0.0 && merge_status < 32.0 && admission_approved > 0.0);
  let aggregate_status = select(32.0, 1.0, active_row > 0.0);

  aggregate_rows[aggregate_offset + 0u] = target_aggregate_key;
  aggregate_rows[aggregate_offset + 1u] = parent_level;
  aggregate_rows[aggregate_offset + 2u] = chart_id;
  aggregate_rows[aggregate_offset + 3u] = aggregate_status;
  aggregate_rows[aggregate_offset + 4u] = parent_cell.x;
  aggregate_rows[aggregate_offset + 5u] = parent_cell.y;
  aggregate_rows[aggregate_offset + 6u] = parent_cell.z;
  aggregate_rows[aggregate_offset + 7u] = state_family_id;
  aggregate_rows[aggregate_offset + 8u] = target_mass_delta_kg * active_row;
  aggregate_rows[aggregate_offset + 9u] = target_volume_delta_m3 * active_row;
  aggregate_rows[aggregate_offset + 10u] = target_momentum.x * active_row;
  aggregate_rows[aggregate_offset + 11u] = target_momentum.y * active_row;
  aggregate_rows[aggregate_offset + 12u] = target_momentum.z * active_row;
  aggregate_rows[aggregate_offset + 13u] = target_internal_energy_j * active_row;
  aggregate_rows[aggregate_offset + 14u] = source_particle_index;
  aggregate_rows[aggregate_offset + 15u] = transfer_weight * active_row;
  aggregate_rows[aggregate_offset + 16u] = source_mass_delta_kg * active_row;
  aggregate_rows[aggregate_offset + 17u] = target_mass_delta_kg * active_row;
  aggregate_rows[aggregate_offset + 18u] = mass_residual_kg;
  aggregate_rows[aggregate_offset + 19u] = source_volume_delta_m3 * active_row;
  aggregate_rows[aggregate_offset + 20u] = target_volume_delta_m3 * active_row;
  aggregate_rows[aggregate_offset + 21u] = volume_residual_m3;
  aggregate_rows[aggregate_offset + 22u] = momentum_residual.x;
  aggregate_rows[aggregate_offset + 23u] = momentum_residual.y;
  aggregate_rows[aggregate_offset + 24u] = momentum_residual.z;
  aggregate_rows[aggregate_offset + 25u] = internal_energy_residual_j;
  aggregate_rows[aggregate_offset + 26u] = merge_epoch;
  aggregate_rows[aggregate_offset + 27u] = child_level;
  aggregate_rows[aggregate_offset + 28u] = level_delta;
  aggregate_rows[aggregate_offset + 29u] = 1.0;
  aggregate_rows[aggregate_offset + 30u] = admission_approved;
  aggregate_rows[aggregate_offset + 31u] = 0.0;
}
`;

export const schroederPhaseVolumeTargetAggregateWgsl = `
struct SchroederPhaseVolumeTargetAggregateParams {
  particle_count: u32,
  assignment_stride: u32,
  aggregate_stride: u32,
  flags: u32,
  min_level: i32,
  max_level: i32,
  pad0: u32,
  pad1: u32,
  base_grid_spacing_m: f32,
  target_support_cells: f32,
  support_radius_scale: f32,
  volume_expand_threshold: f32,
  gas_phase_id: f32,
  aggregate_epoch: f32,
  state_family_id: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> level_assignments: array<f32>;
@group(0) @binding(1) var<storage, read_write> aggregate_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederPhaseVolumeTargetAggregateParams;
@group(0) @binding(3) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> particle_identity: array<u32>;

const SCHROEDER_PVTA_ASSIGNMENT_STRIDE: u32 = 16u;
const SCHROEDER_PVTA_AGGREGATE_STRIDE: u32 = 32u;
const SCHROEDER_PVTA_STATE_VEC4_STRIDE: u32 = 2u;
const SCHROEDER_PVTA_THERMO_VEC4_STRIDE: u32 = 3u;
const SCHROEDER_PVTA_PI: f32 = 3.141592653589793;

// Mass-weighted temperature contribution (mass * T). Under the uniform
// heat capacity of a coherent same-material cell this is the thermal
// energy proxy the reducer sums, so a merged child's temperature becomes
// the mass-weighted cell average. pad2 carries the thermo vec4 stride;
// zero disables the binding.
fn ss_pvta_mass_temperature(particle_index: u32, mass_kg: f32) -> f32 {
  if (params.pad2 <= 0.0) {
    return 0.0;
  }
  let thermo_stride = max(u32(params.pad2), SCHROEDER_PVTA_THERMO_VEC4_STRIDE);
  let temperature_k = sph_thermo[particle_index * thermo_stride].z;
  return mass_kg * max(temperature_k, 0.0);
}

// Per-particle momentum for the contribution row so the reduced aggregate
// node carries true cell momentum for momentum-conserving merges. pad0
// carries the sph-state vec4 stride; zero disables the state binding
// (legacy callers keep zero-momentum contributions).
fn ss_pvta_particle_momentum(particle_index: u32, mass_kg: f32) -> vec3<f32> {
  if (params.pad0 == 0u) {
    return vec3<f32>(0.0, 0.0, 0.0);
  }
  let state_stride = max(params.pad0, SCHROEDER_PVTA_STATE_VEC4_STRIDE);
  let velocity = sph_state[particle_index * state_stride + 1u].xyz;
  return mass_kg * velocity;
}

fn ss_pvta_positive(value: f32) -> bool {
  return value == value && value > 0.0;
}

fn ss_pvta_clamp_i32(value: i32, lo: i32, hi: i32) -> i32 {
  return min(max(value, lo), hi);
}

fn ss_pvta_volume_radius(volume_m3: f32) -> f32 {
  if (!ss_pvta_positive(volume_m3)) {
    return 0.0;
  }
  return pow((3.0 * volume_m3) / (4.0 * SCHROEDER_PVTA_PI), 0.3333333333333333);
}

fn ss_pvta_level_from_support(support_radius_m: f32) -> i32 {
  let base_dx = max(params.base_grid_spacing_m, 0.000001);
  let target_cells = max(params.target_support_cells, 1.0);
  let native_dx_unclamped = max(support_radius_m / target_cells, 0.000001);
  let raw_level = i32(round(log2(native_dx_unclamped / base_dx)));
  return ss_pvta_clamp_i32(raw_level, params.min_level, params.max_level);
}

fn ss_pvta_write_empty(aggregate_offset: u32, assignment_offset: u32, particle_index: u32, status: f32) {
  aggregate_rows[aggregate_offset + 0u] = f32(particle_identity[particle_index]);
  aggregate_rows[aggregate_offset + 1u] = level_assignments[assignment_offset + 0u];
  aggregate_rows[aggregate_offset + 2u] = level_assignments[assignment_offset + 15u];
  aggregate_rows[aggregate_offset + 3u] = status;
  aggregate_rows[aggregate_offset + 4u] = 0.0;
  aggregate_rows[aggregate_offset + 5u] = 0.0;
  aggregate_rows[aggregate_offset + 6u] = 0.0;
  aggregate_rows[aggregate_offset + 7u] = params.state_family_id;
  for (var column = 8u; column < SCHROEDER_PVTA_AGGREGATE_STRIDE; column = column + 1u) {
    aggregate_rows[aggregate_offset + column] = 0.0;
  }
  aggregate_rows[aggregate_offset + 14u] = f32(particle_index);
  aggregate_rows[aggregate_offset + 26u] = params.aggregate_epoch;
  aggregate_rows[aggregate_offset + 27u] = level_assignments[assignment_offset + 0u];
  aggregate_rows[aggregate_offset + 29u] = 2.0;
  aggregate_rows[aggregate_offset + 30u] = 1.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let assignment_stride = max(params.assignment_stride, SCHROEDER_PVTA_ASSIGNMENT_STRIDE);
  let aggregate_stride = max(params.aggregate_stride, SCHROEDER_PVTA_AGGREGATE_STRIDE);
  let assignment_offset = particle_index * assignment_stride;
  let aggregate_offset = particle_index * aggregate_stride;

  let source_level = level_assignments[assignment_offset + 0u];
  let source_support = level_assignments[assignment_offset + 2u];
  let represented_volume = level_assignments[assignment_offset + 3u];
  let rest_volume = level_assignments[assignment_offset + 4u];
  let source_volume = level_assignments[assignment_offset + 5u];
  let mass_kg = level_assignments[assignment_offset + 6u];
  let phase_id = level_assignments[assignment_offset + 8u];
  let position = vec3<f32>(
    level_assignments[assignment_offset + 12u],
    level_assignments[assignment_offset + 13u],
    level_assignments[assignment_offset + 14u]
  );
  let chart_id = level_assignments[assignment_offset + 15u];

  if (!ss_pvta_positive(represented_volume) || !ss_pvta_positive(rest_volume) || !ss_pvta_positive(mass_kg)) {
    ss_pvta_write_empty(aggregate_offset, assignment_offset, particle_index, 32.0);
    return;
  }

  let volume_ratio = represented_volume / max(rest_volume, 0.000001);
  let gas_phase = abs(phase_id - params.gas_phase_id) < 0.5;
  let phase_expanded = gas_phase && volume_ratio >= max(params.volume_expand_threshold, 1.0);
  if (!phase_expanded) {
    ss_pvta_write_empty(aggregate_offset, assignment_offset, particle_index, 32.0);
    return;
  }

  let physical_support = ss_pvta_volume_radius(represented_volume) * max(params.support_radius_scale, 0.0);
  let target_support = max(physical_support, source_support);
  let target_level_i32 = ss_pvta_level_from_support(target_support);
  let target_level = f32(target_level_i32);
  let target_grid_spacing = max(params.base_grid_spacing_m, 0.000001) * exp2(target_level);
  let target_cell = floor(position / target_grid_spacing);
  let level_delta = target_level - source_level;

  aggregate_rows[aggregate_offset + 0u] = f32(particle_identity[particle_index]);
  aggregate_rows[aggregate_offset + 1u] = target_level;
  aggregate_rows[aggregate_offset + 2u] = chart_id;
  aggregate_rows[aggregate_offset + 3u] = 1.0;
  aggregate_rows[aggregate_offset + 4u] = target_cell.x;
  aggregate_rows[aggregate_offset + 5u] = target_cell.y;
  aggregate_rows[aggregate_offset + 6u] = target_cell.z;
  aggregate_rows[aggregate_offset + 7u] = params.state_family_id;
  aggregate_rows[aggregate_offset + 8u] = mass_kg;
  aggregate_rows[aggregate_offset + 9u] = represented_volume;
  let particle_momentum = ss_pvta_particle_momentum(particle_index, mass_kg);
  aggregate_rows[aggregate_offset + 10u] = particle_momentum.x;
  aggregate_rows[aggregate_offset + 11u] = particle_momentum.y;
  aggregate_rows[aggregate_offset + 12u] = particle_momentum.z;
  aggregate_rows[aggregate_offset + 13u] = ss_pvta_mass_temperature(particle_index, mass_kg);
  aggregate_rows[aggregate_offset + 14u] = f32(particle_index);
  aggregate_rows[aggregate_offset + 15u] = 1.0;
  aggregate_rows[aggregate_offset + 16u] = mass_kg;
  aggregate_rows[aggregate_offset + 17u] = mass_kg;
  aggregate_rows[aggregate_offset + 18u] = 0.0;
  aggregate_rows[aggregate_offset + 19u] = max(source_volume, rest_volume);
  aggregate_rows[aggregate_offset + 20u] = represented_volume;
  aggregate_rows[aggregate_offset + 21u] = 0.0;
  aggregate_rows[aggregate_offset + 22u] = 0.0;
  aggregate_rows[aggregate_offset + 23u] = 0.0;
  aggregate_rows[aggregate_offset + 24u] = 0.0;
  aggregate_rows[aggregate_offset + 25u] = 0.0;
  aggregate_rows[aggregate_offset + 26u] = params.aggregate_epoch;
  aggregate_rows[aggregate_offset + 27u] = source_level;
  aggregate_rows[aggregate_offset + 28u] = level_delta;
  aggregate_rows[aggregate_offset + 29u] = 2.0;
  aggregate_rows[aggregate_offset + 30u] = 1.0;
  aggregate_rows[aggregate_offset + 31u] = 0.0;
}
`;

export const schroederHierarchyAggregateNodeReduceWgsl = `
struct SchroederHierarchyAggregateNodeReduceParams {
  row_count: u32,
  aggregate_stride: u32,
  node_stride: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  pad3: u32,
};

@group(0) @binding(0) var<storage, read> aggregate_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> aggregate_node_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederHierarchyAggregateNodeReduceParams;

const SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_STRIDE_FOR_NODE: u32 = 32u;
const SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_NODE_STRIDE: u32 = 32u;

fn ss_node_same_key(lhs_offset: u32, rhs_offset: u32, aggregate_stride: u32) -> bool {
  let lhs_key = aggregate_rows[lhs_offset + 0u];
  let rhs_key = aggregate_rows[rhs_offset + 0u];
  let lhs_level = aggregate_rows[lhs_offset + 1u];
  let rhs_level = aggregate_rows[rhs_offset + 1u];
  let lhs_chart = aggregate_rows[lhs_offset + 2u];
  let rhs_chart = aggregate_rows[rhs_offset + 2u];
  let lhs_cell = vec3<f32>(
    aggregate_rows[lhs_offset + 4u],
    aggregate_rows[lhs_offset + 5u],
    aggregate_rows[lhs_offset + 6u]
  );
  let rhs_cell = vec3<f32>(
    aggregate_rows[rhs_offset + 4u],
    aggregate_rows[rhs_offset + 5u],
    aggregate_rows[rhs_offset + 6u]
  );
  return abs(lhs_key - rhs_key) < 0.5
    && abs(lhs_level - rhs_level) < 0.5
    && abs(lhs_chart - rhs_chart) < 0.5
    && all(abs(lhs_cell - rhs_cell) < vec3<f32>(0.5));
}

fn ss_node_active(offset: u32) -> bool {
  let status = aggregate_rows[offset + 3u];
  let admission = aggregate_rows[offset + 30u];
  return status > 0.0 && status < 32.0 && admission > 0.0;
}

fn ss_node_write_empty(node_offset: u32, source_offset: u32, status: f32) {
  aggregate_node_rows[node_offset + 0u] = aggregate_rows[source_offset + 0u];
  aggregate_node_rows[node_offset + 1u] = aggregate_rows[source_offset + 1u];
  aggregate_node_rows[node_offset + 2u] = aggregate_rows[source_offset + 2u];
  aggregate_node_rows[node_offset + 3u] = status;
  aggregate_node_rows[node_offset + 4u] = aggregate_rows[source_offset + 4u];
  aggregate_node_rows[node_offset + 5u] = aggregate_rows[source_offset + 5u];
  aggregate_node_rows[node_offset + 6u] = aggregate_rows[source_offset + 6u];
  aggregate_node_rows[node_offset + 7u] = aggregate_rows[source_offset + 7u];
  for (var column = 8u; column < SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_NODE_STRIDE; column = column + 1u) {
    aggregate_node_rows[node_offset + column] = 0.0;
  }
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.row_count) {
    return;
  }

  let aggregate_stride = max(params.aggregate_stride, SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_STRIDE_FOR_NODE);
  let node_stride = max(params.node_stride, SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_NODE_STRIDE);
  let source_offset = row_index * aggregate_stride;
  let node_offset = row_index * node_stride;

  if (!ss_node_active(source_offset)) {
    ss_node_write_empty(node_offset, source_offset, 32.0);
    return;
  }

  var duplicate_before = false;
  for (var prior_index = 0u; prior_index < row_index; prior_index = prior_index + 1u) {
    let prior_offset = prior_index * aggregate_stride;
    if (ss_node_active(prior_offset) && ss_node_same_key(source_offset, prior_offset, aggregate_stride)) {
      duplicate_before = true;
    }
  }

  if (duplicate_before) {
    ss_node_write_empty(node_offset, source_offset, 64.0);
    aggregate_node_rows[node_offset + 14u] = f32(row_index);
    aggregate_node_rows[node_offset + 16u] = 1.0;
    aggregate_node_rows[node_offset + 28u] = 1.0;
    aggregate_node_rows[node_offset + 29u] = 1.0;
    aggregate_node_rows[node_offset + 30u] = aggregate_rows[source_offset + 30u];
    return;
  }

  var total_mass = 0.0;
  var total_volume = 0.0;
  var total_momentum = vec3<f32>(0.0);
  var total_internal_energy = 0.0;
  var matching_count = 0.0;
  var suppressed_duplicate_count = 0.0;
  var mass_residual = 0.0;
  var volume_residual = 0.0;
  var momentum_residual = vec3<f32>(0.0);
  var internal_energy_residual = 0.0;
  var child_level_min = aggregate_rows[source_offset + 27u];
  var child_level_max = aggregate_rows[source_offset + 27u];
  var level_delta_max = aggregate_rows[source_offset + 28u];

  for (var scan_index = 0u; scan_index < params.row_count; scan_index = scan_index + 1u) {
    let scan_offset = scan_index * aggregate_stride;
    if (ss_node_active(scan_offset) && ss_node_same_key(source_offset, scan_offset, aggregate_stride)) {
      matching_count = matching_count + 1.0;
      total_mass = total_mass + aggregate_rows[scan_offset + 8u];
      total_volume = total_volume + aggregate_rows[scan_offset + 9u];
      total_momentum = total_momentum + vec3<f32>(
        aggregate_rows[scan_offset + 10u],
        aggregate_rows[scan_offset + 11u],
        aggregate_rows[scan_offset + 12u]
      );
      total_internal_energy = total_internal_energy + aggregate_rows[scan_offset + 13u];
      mass_residual = mass_residual + aggregate_rows[scan_offset + 18u];
      volume_residual = volume_residual + aggregate_rows[scan_offset + 21u];
      momentum_residual = momentum_residual + vec3<f32>(
        aggregate_rows[scan_offset + 22u],
        aggregate_rows[scan_offset + 23u],
        aggregate_rows[scan_offset + 24u]
      );
      internal_energy_residual = internal_energy_residual + aggregate_rows[scan_offset + 25u];
      child_level_min = min(child_level_min, aggregate_rows[scan_offset + 27u]);
      child_level_max = max(child_level_max, aggregate_rows[scan_offset + 27u]);
      level_delta_max = max(level_delta_max, aggregate_rows[scan_offset + 28u]);
    }
  }
  suppressed_duplicate_count = max(matching_count - 1.0, 0.0);

  aggregate_node_rows[node_offset + 0u] = aggregate_rows[source_offset + 0u];
  aggregate_node_rows[node_offset + 1u] = aggregate_rows[source_offset + 1u];
  aggregate_node_rows[node_offset + 2u] = aggregate_rows[source_offset + 2u];
  aggregate_node_rows[node_offset + 3u] = 1.0;
  aggregate_node_rows[node_offset + 4u] = aggregate_rows[source_offset + 4u];
  aggregate_node_rows[node_offset + 5u] = aggregate_rows[source_offset + 5u];
  aggregate_node_rows[node_offset + 6u] = aggregate_rows[source_offset + 6u];
  aggregate_node_rows[node_offset + 7u] = aggregate_rows[source_offset + 7u];
  aggregate_node_rows[node_offset + 8u] = total_mass;
  aggregate_node_rows[node_offset + 9u] = total_volume;
  aggregate_node_rows[node_offset + 10u] = total_momentum.x;
  aggregate_node_rows[node_offset + 11u] = total_momentum.y;
  aggregate_node_rows[node_offset + 12u] = total_momentum.z;
  aggregate_node_rows[node_offset + 13u] = total_internal_energy;
  aggregate_node_rows[node_offset + 14u] = f32(row_index);
  aggregate_node_rows[node_offset + 15u] = matching_count;
  aggregate_node_rows[node_offset + 16u] = suppressed_duplicate_count;
  aggregate_node_rows[node_offset + 17u] = mass_residual;
  aggregate_node_rows[node_offset + 18u] = volume_residual;
  aggregate_node_rows[node_offset + 19u] = momentum_residual.x;
  aggregate_node_rows[node_offset + 20u] = momentum_residual.y;
  aggregate_node_rows[node_offset + 21u] = momentum_residual.z;
  aggregate_node_rows[node_offset + 22u] = internal_energy_residual;
  aggregate_node_rows[node_offset + 23u] = aggregate_rows[source_offset + 26u];
  aggregate_node_rows[node_offset + 24u] = child_level_min;
  aggregate_node_rows[node_offset + 25u] = child_level_max;
  aggregate_node_rows[node_offset + 26u] = level_delta_max;
  aggregate_node_rows[node_offset + 27u] = 1.0;
  aggregate_node_rows[node_offset + 28u] = 1.0;
  aggregate_node_rows[node_offset + 29u] = 1.0;
  aggregate_node_rows[node_offset + 30u] = aggregate_rows[source_offset + 30u];
  aggregate_node_rows[node_offset + 31u] = 0.0;
}
`;

export const schroederHierarchyAggregateNodeBucketReduceWgsl = `
struct SchroederHierarchyAggregateNodeBucketReduceParams {
  row_count: u32,
  aggregate_stride: u32,
  node_stride: u32,
  flags: u32,
  bucket_count: u32,
  bucket_slot_capacity: u32,
  bucket_slot_count: u32,
  reduction_mode_id: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  pad3: u32,
  pad4: u32,
  pad5: u32,
  pad6: u32,
  pad7: u32,
};

@group(0) @binding(0) var<storage, read> aggregate_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> aggregate_node_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> bucket_counts: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> bucket_slots: array<u32>;
@group(0) @binding(4) var<storage, read_write> row_bucket_slots: array<u32>;
@group(0) @binding(5) var<uniform> params: SchroederHierarchyAggregateNodeBucketReduceParams;

const SCHROEDER_BUCKET_SENTINEL: u32 = 0xffffffffu;
const SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_STRIDE_FOR_BUCKET_NODE: u32 = 32u;
const SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_BUCKET_NODE_STRIDE: u32 = 32u;

fn ss_bucket_hash_mix(value: u32, seed: u32) -> u32 {
  var hash = seed ^ (value + 0x9e3779b9u + (seed << 6u) + (seed >> 2u));
  hash = hash ^ (hash >> 16u);
  hash = hash * 0x7feb352du;
  hash = hash ^ (hash >> 15u);
  hash = hash * 0x846ca68bu;
  return hash ^ (hash >> 16u);
}

fn ss_bucket_i32_bits(value: f32) -> u32 {
  return bitcast<u32>(i32(round(value)));
}

fn ss_bucket_hash(source_offset: u32) -> u32 {
  var hash = 0x811c9dc5u;
  hash = ss_bucket_hash_mix(ss_bucket_i32_bits(aggregate_rows[source_offset + 0u]), hash);
  hash = ss_bucket_hash_mix(ss_bucket_i32_bits(aggregate_rows[source_offset + 1u]), hash);
  hash = ss_bucket_hash_mix(ss_bucket_i32_bits(aggregate_rows[source_offset + 2u]), hash);
  hash = ss_bucket_hash_mix(ss_bucket_i32_bits(aggregate_rows[source_offset + 4u]), hash);
  hash = ss_bucket_hash_mix(ss_bucket_i32_bits(aggregate_rows[source_offset + 5u]), hash);
  hash = ss_bucket_hash_mix(ss_bucket_i32_bits(aggregate_rows[source_offset + 6u]), hash);
  return hash % max(params.bucket_count, 1u);
}

fn ss_bucket_node_same_key(lhs_offset: u32, rhs_offset: u32) -> bool {
  let lhs_key = aggregate_rows[lhs_offset + 0u];
  let rhs_key = aggregate_rows[rhs_offset + 0u];
  let lhs_level = aggregate_rows[lhs_offset + 1u];
  let rhs_level = aggregate_rows[rhs_offset + 1u];
  let lhs_chart = aggregate_rows[lhs_offset + 2u];
  let rhs_chart = aggregate_rows[rhs_offset + 2u];
  let lhs_cell = vec3<f32>(
    aggregate_rows[lhs_offset + 4u],
    aggregate_rows[lhs_offset + 5u],
    aggregate_rows[lhs_offset + 6u]
  );
  let rhs_cell = vec3<f32>(
    aggregate_rows[rhs_offset + 4u],
    aggregate_rows[rhs_offset + 5u],
    aggregate_rows[rhs_offset + 6u]
  );
  return abs(lhs_key - rhs_key) < 0.5
    && abs(lhs_level - rhs_level) < 0.5
    && abs(lhs_chart - rhs_chart) < 0.5
    && all(abs(lhs_cell - rhs_cell) < vec3<f32>(0.5));
}

fn ss_bucket_node_active(offset: u32) -> bool {
  let status = aggregate_rows[offset + 3u];
  let admission = aggregate_rows[offset + 30u];
  return status > 0.0 && status < 32.0 && admission > 0.0;
}

fn ss_bucket_write_empty(node_offset: u32, source_offset: u32, status: f32, capacity_status: f32) {
  aggregate_node_rows[node_offset + 0u] = aggregate_rows[source_offset + 0u];
  aggregate_node_rows[node_offset + 1u] = aggregate_rows[source_offset + 1u];
  aggregate_node_rows[node_offset + 2u] = aggregate_rows[source_offset + 2u];
  aggregate_node_rows[node_offset + 3u] = status;
  aggregate_node_rows[node_offset + 4u] = aggregate_rows[source_offset + 4u];
  aggregate_node_rows[node_offset + 5u] = aggregate_rows[source_offset + 5u];
  aggregate_node_rows[node_offset + 6u] = aggregate_rows[source_offset + 6u];
  aggregate_node_rows[node_offset + 7u] = aggregate_rows[source_offset + 7u];
  for (var column = 8u; column < SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_BUCKET_NODE_STRIDE; column = column + 1u) {
    aggregate_node_rows[node_offset + column] = 0.0;
  }
  aggregate_node_rows[node_offset + 28u] = f32(params.reduction_mode_id);
  aggregate_node_rows[node_offset + 29u] = capacity_status;
  aggregate_node_rows[node_offset + 30u] = aggregate_rows[source_offset + 30u];
}

@compute @workgroup_size(64)
fn clearBuckets(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index < params.bucket_count) {
    atomicStore(&bucket_counts[index], 0u);
  }
  if (index < params.bucket_slot_count) {
    bucket_slots[index] = SCHROEDER_BUCKET_SENTINEL;
  }
  if (index < params.row_count) {
    row_bucket_slots[index] = SCHROEDER_BUCKET_SENTINEL;
  }
}

@compute @workgroup_size(64)
fn assignBuckets(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.row_count) {
    return;
  }
  let aggregate_stride = max(params.aggregate_stride, SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_STRIDE_FOR_BUCKET_NODE);
  let source_offset = row_index * aggregate_stride;
  if (!ss_bucket_node_active(source_offset)) {
    row_bucket_slots[row_index] = SCHROEDER_BUCKET_SENTINEL;
    return;
  }
  let bucket_index = ss_bucket_hash(source_offset);
  let slot_index = atomicAdd(&bucket_counts[bucket_index], 1u);
  if (slot_index >= params.bucket_slot_capacity) {
    row_bucket_slots[row_index] = SCHROEDER_BUCKET_SENTINEL;
    return;
  }
  let absolute_slot = bucket_index * params.bucket_slot_capacity + slot_index;
  if (absolute_slot >= params.bucket_slot_count) {
    row_bucket_slots[row_index] = SCHROEDER_BUCKET_SENTINEL;
    return;
  }
  bucket_slots[absolute_slot] = row_index;
  row_bucket_slots[row_index] = absolute_slot;
}

@compute @workgroup_size(64)
fn reduceBuckets(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.row_count) {
    return;
  }

  let aggregate_stride = max(params.aggregate_stride, SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_STRIDE_FOR_BUCKET_NODE);
  let node_stride = max(params.node_stride, SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_BUCKET_NODE_STRIDE);
  let source_offset = row_index * aggregate_stride;
  let node_offset = row_index * node_stride;

  if (!ss_bucket_node_active(source_offset)) {
    ss_bucket_write_empty(node_offset, source_offset, 32.0, 1.0);
    return;
  }

  let assigned_slot = row_bucket_slots[row_index];
  let bucket_index = ss_bucket_hash(source_offset);
  let raw_bucket_count = atomicLoad(&bucket_counts[bucket_index]);
  let bucket_overflow = raw_bucket_count > params.bucket_slot_capacity;
  if (assigned_slot == SCHROEDER_BUCKET_SENTINEL || bucket_overflow) {
    ss_bucket_write_empty(node_offset, source_offset, 96.0, 96.0);
    aggregate_node_rows[node_offset + 14u] = f32(row_index);
    return;
  }

  let scan_count = min(raw_bucket_count, params.bucket_slot_capacity);
  let bucket_base = bucket_index * params.bucket_slot_capacity;
  var duplicate_before = false;
  for (var slot = 0u; slot < scan_count; slot = slot + 1u) {
    let other_index = bucket_slots[bucket_base + slot];
    if (other_index != SCHROEDER_BUCKET_SENTINEL && other_index < row_index) {
      let other_offset = other_index * aggregate_stride;
      if (ss_bucket_node_active(other_offset) && ss_bucket_node_same_key(source_offset, other_offset)) {
        duplicate_before = true;
      }
    }
  }

  if (duplicate_before) {
    ss_bucket_write_empty(node_offset, source_offset, 64.0, 1.0);
    aggregate_node_rows[node_offset + 14u] = f32(row_index);
    aggregate_node_rows[node_offset + 16u] = 1.0;
    return;
  }

  var total_mass = 0.0;
  var total_volume = 0.0;
  var total_momentum = vec3<f32>(0.0);
  var total_internal_energy = 0.0;
  var matching_count = 0.0;
  var mass_residual = 0.0;
  var volume_residual = 0.0;
  var momentum_residual = vec3<f32>(0.0);
  var internal_energy_residual = 0.0;
  var child_level_min = aggregate_rows[source_offset + 27u];
  var child_level_max = aggregate_rows[source_offset + 27u];
  var level_delta_max = aggregate_rows[source_offset + 28u];

  for (var slot = 0u; slot < scan_count; slot = slot + 1u) {
    let other_index = bucket_slots[bucket_base + slot];
    if (other_index != SCHROEDER_BUCKET_SENTINEL) {
      let scan_offset = other_index * aggregate_stride;
      if (ss_bucket_node_active(scan_offset) && ss_bucket_node_same_key(source_offset, scan_offset)) {
        matching_count = matching_count + 1.0;
        total_mass = total_mass + aggregate_rows[scan_offset + 8u];
        total_volume = total_volume + aggregate_rows[scan_offset + 9u];
        total_momentum = total_momentum + vec3<f32>(
          aggregate_rows[scan_offset + 10u],
          aggregate_rows[scan_offset + 11u],
          aggregate_rows[scan_offset + 12u]
        );
        total_internal_energy = total_internal_energy + aggregate_rows[scan_offset + 13u];
        mass_residual = mass_residual + aggregate_rows[scan_offset + 18u];
        volume_residual = volume_residual + aggregate_rows[scan_offset + 21u];
        momentum_residual = momentum_residual + vec3<f32>(
          aggregate_rows[scan_offset + 22u],
          aggregate_rows[scan_offset + 23u],
          aggregate_rows[scan_offset + 24u]
        );
        internal_energy_residual = internal_energy_residual + aggregate_rows[scan_offset + 25u];
        child_level_min = min(child_level_min, aggregate_rows[scan_offset + 27u]);
        child_level_max = max(child_level_max, aggregate_rows[scan_offset + 27u]);
        level_delta_max = max(level_delta_max, aggregate_rows[scan_offset + 28u]);
      }
    }
  }
  let suppressed_duplicate_count = max(matching_count - 1.0, 0.0);

  aggregate_node_rows[node_offset + 0u] = aggregate_rows[source_offset + 0u];
  aggregate_node_rows[node_offset + 1u] = aggregate_rows[source_offset + 1u];
  aggregate_node_rows[node_offset + 2u] = aggregate_rows[source_offset + 2u];
  aggregate_node_rows[node_offset + 3u] = 1.0;
  aggregate_node_rows[node_offset + 4u] = aggregate_rows[source_offset + 4u];
  aggregate_node_rows[node_offset + 5u] = aggregate_rows[source_offset + 5u];
  aggregate_node_rows[node_offset + 6u] = aggregate_rows[source_offset + 6u];
  aggregate_node_rows[node_offset + 7u] = aggregate_rows[source_offset + 7u];
  aggregate_node_rows[node_offset + 8u] = total_mass;
  aggregate_node_rows[node_offset + 9u] = total_volume;
  aggregate_node_rows[node_offset + 10u] = total_momentum.x;
  aggregate_node_rows[node_offset + 11u] = total_momentum.y;
  aggregate_node_rows[node_offset + 12u] = total_momentum.z;
  aggregate_node_rows[node_offset + 13u] = total_internal_energy;
  aggregate_node_rows[node_offset + 14u] = f32(row_index);
  aggregate_node_rows[node_offset + 15u] = matching_count;
  aggregate_node_rows[node_offset + 16u] = suppressed_duplicate_count;
  aggregate_node_rows[node_offset + 17u] = mass_residual;
  aggregate_node_rows[node_offset + 18u] = volume_residual;
  aggregate_node_rows[node_offset + 19u] = momentum_residual.x;
  aggregate_node_rows[node_offset + 20u] = momentum_residual.y;
  aggregate_node_rows[node_offset + 21u] = momentum_residual.z;
  aggregate_node_rows[node_offset + 22u] = internal_energy_residual;
  aggregate_node_rows[node_offset + 23u] = aggregate_rows[source_offset + 26u];
  aggregate_node_rows[node_offset + 24u] = child_level_min;
  aggregate_node_rows[node_offset + 25u] = child_level_max;
  aggregate_node_rows[node_offset + 26u] = level_delta_max;
  aggregate_node_rows[node_offset + 27u] = 1.0;
  aggregate_node_rows[node_offset + 28u] = f32(params.reduction_mode_id);
  aggregate_node_rows[node_offset + 29u] = 1.0;
  aggregate_node_rows[node_offset + 30u] = aggregate_rows[source_offset + 30u];
  aggregate_node_rows[node_offset + 31u] = 0.0;
}
`;

export const schroederFarAggregateCandidateWgsl = `
struct SchroederFarAggregateCandidateParams {
  active_node_count: u32,
  aggregate_node_count: u32,
  active_node_stride: u32,
  aggregate_node_stride: u32,
  candidate_stride: u32,
  candidate_budget: u32,
  enabled_far_law_mask: u32,
  flags: u32,
  base_grid_spacing_m: f32,
  opening_theta: f32,
  near_field_support_scale: f32,
  far_field_error_bound: f32,
  queue_epoch: f32,
  state_family_id: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<storage, read> active_nodes: array<f32>;
@group(0) @binding(1) var<storage, read> aggregate_node_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> far_candidate_rows: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederFarAggregateCandidateParams;

const SCHROEDER_DEFAULT_ACTIVE_NODE_STRIDE_FOR_FAR_AGGREGATE: u32 = 16u;
const SCHROEDER_DEFAULT_AGGREGATE_NODE_STRIDE_FOR_FAR_AGGREGATE: u32 = 32u;
const SCHROEDER_DEFAULT_FAR_AGGREGATE_CANDIDATE_STRIDE: u32 = 32u;

fn ss_far_active_node(offset: u32) -> bool {
  let status = active_nodes[offset + 11u];
  return status > 0.0 && status < 32.0;
}

fn ss_far_aggregate_node_active(offset: u32) -> bool {
  let status = aggregate_node_rows[offset + 3u];
  let admission = aggregate_node_rows[offset + 30u];
  let mass = aggregate_node_rows[offset + 8u];
  return status > 0.0 && status < 32.0 && admission > 0.0 && mass > 0.0;
}

fn ss_far_grid_spacing(level_id: f32) -> f32 {
  return max(params.base_grid_spacing_m, 0.000001) * exp2(level_id);
}

fn ss_far_aggregate_center(node_offset: u32, node_size_m: f32) -> vec3<f32> {
  return vec3<f32>(
    (aggregate_node_rows[node_offset + 4u] + 0.5) * node_size_m,
    (aggregate_node_rows[node_offset + 5u] + 0.5) * node_size_m,
    (aggregate_node_rows[node_offset + 6u] + 0.5) * node_size_m
  );
}

fn ss_far_write_empty(candidate_offset: u32, active_offset: u32, slot_index: u32, status: f32, accepted_count: f32, overflow: f32) {
  far_candidate_rows[candidate_offset + 0u] = active_nodes[active_offset + 10u];
  far_candidate_rows[candidate_offset + 1u] = active_nodes[active_offset + 0u];
  far_candidate_rows[candidate_offset + 2u] = -1.0;
  far_candidate_rows[candidate_offset + 3u] = 0.0;
  far_candidate_rows[candidate_offset + 4u] = active_nodes[active_offset + 15u];
  far_candidate_rows[candidate_offset + 5u] = 0.0;
  far_candidate_rows[candidate_offset + 6u] = f32(params.enabled_far_law_mask);
  far_candidate_rows[candidate_offset + 7u] = status;
  far_candidate_rows[candidate_offset + 8u] = 0.0;
  far_candidate_rows[candidate_offset + 9u] = 0.0;
  far_candidate_rows[candidate_offset + 10u] = params.opening_theta;
  far_candidate_rows[candidate_offset + 11u] = 0.0;
  far_candidate_rows[candidate_offset + 12u] = 0.0;
  far_candidate_rows[candidate_offset + 13u] = 0.0;
  far_candidate_rows[candidate_offset + 14u] = 0.0;
  far_candidate_rows[candidate_offset + 15u] = 0.0;
  far_candidate_rows[candidate_offset + 16u] = 0.0;
  far_candidate_rows[candidate_offset + 17u] = 0.0;
  far_candidate_rows[candidate_offset + 18u] = 0.0;
  far_candidate_rows[candidate_offset + 19u] = 0.0;
  far_candidate_rows[candidate_offset + 20u] = 0.0;
  far_candidate_rows[candidate_offset + 21u] = active_nodes[active_offset + 12u];
  far_candidate_rows[candidate_offset + 22u] = active_nodes[active_offset + 13u];
  far_candidate_rows[candidate_offset + 23u] = active_nodes[active_offset + 14u];
  far_candidate_rows[candidate_offset + 24u] = active_nodes[active_offset + 9u] * params.near_field_support_scale;
  far_candidate_rows[candidate_offset + 25u] = params.far_field_error_bound;
  far_candidate_rows[candidate_offset + 26u] = 0.0;
  far_candidate_rows[candidate_offset + 27u] = params.queue_epoch;
  far_candidate_rows[candidate_offset + 28u] = params.state_family_id;
  far_candidate_rows[candidate_offset + 29u] = f32(slot_index);
  far_candidate_rows[candidate_offset + 30u] = accepted_count;
  far_candidate_rows[candidate_offset + 31u] = overflow;
}

fn ss_far_write_candidate(
  candidate_offset: u32,
  active_offset: u32,
  node_offset: u32,
  node_index: u32,
  slot_index: u32,
  accepted_count: f32,
  distance_m: f32,
  node_size_m: f32,
  opening_ratio: f32,
  center_m: vec3<f32>
) {
  far_candidate_rows[candidate_offset + 0u] = active_nodes[active_offset + 10u];
  far_candidate_rows[candidate_offset + 1u] = active_nodes[active_offset + 0u];
  far_candidate_rows[candidate_offset + 2u] = f32(node_index);
  far_candidate_rows[candidate_offset + 3u] = aggregate_node_rows[node_offset + 1u];
  far_candidate_rows[candidate_offset + 4u] = active_nodes[active_offset + 15u];
  far_candidate_rows[candidate_offset + 5u] = aggregate_node_rows[node_offset + 2u];
  far_candidate_rows[candidate_offset + 6u] = f32(params.enabled_far_law_mask);
  far_candidate_rows[candidate_offset + 7u] = 1.0;
  far_candidate_rows[candidate_offset + 8u] = distance_m;
  far_candidate_rows[candidate_offset + 9u] = node_size_m;
  far_candidate_rows[candidate_offset + 10u] = params.opening_theta;
  far_candidate_rows[candidate_offset + 11u] = opening_ratio;
  far_candidate_rows[candidate_offset + 12u] = aggregate_node_rows[node_offset + 8u];
  far_candidate_rows[candidate_offset + 13u] = aggregate_node_rows[node_offset + 9u];
  far_candidate_rows[candidate_offset + 14u] = aggregate_node_rows[node_offset + 10u];
  far_candidate_rows[candidate_offset + 15u] = aggregate_node_rows[node_offset + 11u];
  far_candidate_rows[candidate_offset + 16u] = aggregate_node_rows[node_offset + 12u];
  far_candidate_rows[candidate_offset + 17u] = aggregate_node_rows[node_offset + 13u];
  far_candidate_rows[candidate_offset + 18u] = center_m.x;
  far_candidate_rows[candidate_offset + 19u] = center_m.y;
  far_candidate_rows[candidate_offset + 20u] = center_m.z;
  far_candidate_rows[candidate_offset + 21u] = active_nodes[active_offset + 12u];
  far_candidate_rows[candidate_offset + 22u] = active_nodes[active_offset + 13u];
  far_candidate_rows[candidate_offset + 23u] = active_nodes[active_offset + 14u];
  far_candidate_rows[candidate_offset + 24u] = active_nodes[active_offset + 9u] * params.near_field_support_scale;
  far_candidate_rows[candidate_offset + 25u] = params.far_field_error_bound;
  far_candidate_rows[candidate_offset + 26u] = 7.0;
  far_candidate_rows[candidate_offset + 27u] = params.queue_epoch;
  far_candidate_rows[candidate_offset + 28u] = params.state_family_id;
  far_candidate_rows[candidate_offset + 29u] = f32(slot_index);
  far_candidate_rows[candidate_offset + 30u] = accepted_count;
  far_candidate_rows[candidate_offset + 31u] = 0.0;
}

fn ss_far_candidate_admissible(active_offset: u32, node_offset: u32, source_m: vec3<f32>) -> vec4<f32> {
  let aggregate_level = aggregate_node_rows[node_offset + 1u];
  let node_size_m = ss_far_grid_spacing(aggregate_level);
  let center_m = ss_far_aggregate_center(node_offset, node_size_m);
  let distance_m = max(length(center_m - source_m), 0.000001);
  let near_field_radius_m = max(active_nodes[active_offset + 9u] * params.near_field_support_scale, 0.0);
  let opening_ratio = node_size_m / distance_m;
  let source_chart = active_nodes[active_offset + 15u];
  let aggregate_chart = aggregate_node_rows[node_offset + 2u];
  let same_chart = abs(source_chart - aggregate_chart) < 0.5;
  let far_enough = distance_m > near_field_radius_m;
  let opened = opening_ratio <= params.opening_theta;
  let is_live_node = ss_far_aggregate_node_active(node_offset);
  let accepted = select(0.0, 1.0, same_chart && far_enough && opened && is_live_node);
  return vec4<f32>(accepted, distance_m, node_size_m, opening_ratio);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  let candidate_budget = max(params.candidate_budget, 1u);
  let candidate_count = params.active_node_count * candidate_budget;
  if (row_index >= candidate_count) {
    return;
  }

  let source_index = row_index / candidate_budget;
  let slot_index = row_index - source_index * candidate_budget;
  let active_stride = max(params.active_node_stride, SCHROEDER_DEFAULT_ACTIVE_NODE_STRIDE_FOR_FAR_AGGREGATE);
  let aggregate_stride = max(params.aggregate_node_stride, SCHROEDER_DEFAULT_AGGREGATE_NODE_STRIDE_FOR_FAR_AGGREGATE);
  let candidate_stride = max(params.candidate_stride, SCHROEDER_DEFAULT_FAR_AGGREGATE_CANDIDATE_STRIDE);
  let active_offset = source_index * active_stride;
  let candidate_offset = row_index * candidate_stride;

  if (!ss_far_active_node(active_offset) || params.enabled_far_law_mask == 0u) {
    ss_far_write_empty(candidate_offset, active_offset, slot_index, 32.0, 0.0, 0.0);
    return;
  }

  let source_m = vec3<f32>(
    active_nodes[active_offset + 12u],
    active_nodes[active_offset + 13u],
    active_nodes[active_offset + 14u]
  );
  var accepted_count = 0u;
  var emitted = false;
  var overflow = false;

  for (var node_index = 0u; node_index < params.aggregate_node_count; node_index = node_index + 1u) {
    let node_offset = node_index * aggregate_stride;
    let admissible = ss_far_candidate_admissible(active_offset, node_offset, source_m);
    if (admissible.x > 0.0) {
      if (accepted_count == slot_index) {
        let node_size_m = admissible.z;
        let center_m = ss_far_aggregate_center(node_offset, node_size_m);
        ss_far_write_candidate(
          candidate_offset,
          active_offset,
          node_offset,
          node_index,
          slot_index,
          f32(accepted_count + 1u),
          admissible.y,
          node_size_m,
          admissible.w,
          center_m
        );
        emitted = true;
      }
      accepted_count = accepted_count + 1u;
      if (accepted_count > candidate_budget) {
        overflow = true;
      }
    }
  }

  if (!emitted) {
    let status = select(96.0, 128.0, overflow && slot_index + 1u == candidate_budget);
    ss_far_write_empty(candidate_offset, active_offset, slot_index, status, f32(accepted_count), select(0.0, 1.0, overflow));
  } else if (overflow && slot_index + 1u == candidate_budget) {
    far_candidate_rows[candidate_offset + 31u] = 1.0;
    far_candidate_rows[candidate_offset + 30u] = f32(accepted_count);
  }
}
`;

export const schroederFarAggregateForceSummaryWgsl = `
struct SchroederFarAggregateForceSummaryParams {
  active_node_count: u32,
  far_candidate_count: u32,
  candidate_stride: u32,
  summary_stride: u32,
  candidate_budget: u32,
  enabled_far_law_mask: u32,
  flags: u32,
  pad0: u32,
  gravitational_constant: f32,
  softening_length_m: f32,
  force_scale: f32,
  far_field_error_bound: f32,
  queue_epoch: f32,
  state_family_id: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> far_candidate_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> force_summary_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederFarAggregateForceSummaryParams;

const SCHROEDER_DEFAULT_FAR_AGGREGATE_CANDIDATE_STRIDE_FOR_FORCE: u32 = 32u;
const SCHROEDER_DEFAULT_FAR_AGGREGATE_FORCE_SUMMARY_STRIDE: u32 = 32u;

fn ss_far_force_write_empty(summary_offset: u32, source_index: u32, candidate_offset: u32, status: f32) {
  var source_particle = f32(source_index);
  var source_level = 0.0;
  var source_chart = 0.0;
  var source_position = vec3<f32>(0.0);
  if (candidate_offset < params.far_candidate_count * max(params.candidate_stride, SCHROEDER_DEFAULT_FAR_AGGREGATE_CANDIDATE_STRIDE_FOR_FORCE)) {
    source_particle = far_candidate_rows[candidate_offset + 0u];
    source_level = far_candidate_rows[candidate_offset + 1u];
    source_chart = far_candidate_rows[candidate_offset + 4u];
    source_position = vec3<f32>(
      far_candidate_rows[candidate_offset + 21u],
      far_candidate_rows[candidate_offset + 22u],
      far_candidate_rows[candidate_offset + 23u]
    );
  }
  force_summary_rows[summary_offset + 0u] = source_particle;
  force_summary_rows[summary_offset + 1u] = source_level;
  force_summary_rows[summary_offset + 2u] = source_chart;
  force_summary_rows[summary_offset + 3u] = f32(params.enabled_far_law_mask);
  force_summary_rows[summary_offset + 4u] = f32(source_index * max(params.candidate_budget, 1u));
  force_summary_rows[summary_offset + 5u] = f32(max(params.candidate_budget, 1u));
  force_summary_rows[summary_offset + 6u] = 0.0;
  force_summary_rows[summary_offset + 7u] = 0.0;
  force_summary_rows[summary_offset + 8u] = 0.0;
  force_summary_rows[summary_offset + 9u] = 0.0;
  force_summary_rows[summary_offset + 10u] = 0.0;
  force_summary_rows[summary_offset + 11u] = 0.0;
  force_summary_rows[summary_offset + 12u] = 0.0;
  force_summary_rows[summary_offset + 13u] = 0.0;
  force_summary_rows[summary_offset + 14u] = 0.0;
  force_summary_rows[summary_offset + 15u] = params.far_field_error_bound;
  force_summary_rows[summary_offset + 16u] = 0.0;
  force_summary_rows[summary_offset + 17u] = 0.0;
  force_summary_rows[summary_offset + 18u] = status;
  force_summary_rows[summary_offset + 19u] = params.queue_epoch;
  force_summary_rows[summary_offset + 20u] = params.state_family_id;
  force_summary_rows[summary_offset + 21u] = params.gravitational_constant;
  force_summary_rows[summary_offset + 22u] = params.softening_length_m;
  force_summary_rows[summary_offset + 23u] = 1.0;
  force_summary_rows[summary_offset + 24u] = source_position.x;
  force_summary_rows[summary_offset + 25u] = source_position.y;
  force_summary_rows[summary_offset + 26u] = source_position.z;
  force_summary_rows[summary_offset + 27u] = 0.0;
  force_summary_rows[summary_offset + 28u] = 0.0;
  force_summary_rows[summary_offset + 29u] = 0.0;
  force_summary_rows[summary_offset + 30u] = 0.0;
  force_summary_rows[summary_offset + 31u] = 0.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let source_index = global_id.x;
  if (source_index >= params.active_node_count) {
    return;
  }

  let candidate_stride = max(params.candidate_stride, SCHROEDER_DEFAULT_FAR_AGGREGATE_CANDIDATE_STRIDE_FOR_FORCE);
  let summary_stride = max(params.summary_stride, SCHROEDER_DEFAULT_FAR_AGGREGATE_FORCE_SUMMARY_STRIDE);
  let candidate_budget = max(params.candidate_budget, 1u);
  let candidate_offset_base = source_index * candidate_budget * candidate_stride;
  let summary_offset = source_index * summary_stride;

  if (params.enabled_far_law_mask == 0u) {
    ss_far_force_write_empty(summary_offset, source_index, candidate_offset_base, 32.0);
    return;
  }

  var source_particle = f32(source_index);
  var source_level = 0.0;
  var source_chart = 0.0;
  var source_position = vec3<f32>(0.0);
  var acceleration = vec3<f32>(0.0);
  var potential = 0.0;
  var total_mass = 0.0;
  var active_count = 0.0;
  var accepted_count = 0.0;
  var blocked_count = 0.0;
  var overflow_count = 0.0;
  var min_distance = 3.402823e38;
  var max_opening_ratio = 0.0;
  var max_error_bound = params.far_field_error_bound;
  var admissibility_flags = 0.0;

  for (var slot = 0u; slot < candidate_budget; slot = slot + 1u) {
    let candidate_index = source_index * candidate_budget + slot;
    if (candidate_index >= params.far_candidate_count) {
      continue;
    }
    let candidate_offset = candidate_index * candidate_stride;
    let status = far_candidate_rows[candidate_offset + 7u];
    if (slot == 0u) {
      source_particle = far_candidate_rows[candidate_offset + 0u];
      source_level = far_candidate_rows[candidate_offset + 1u];
      source_chart = far_candidate_rows[candidate_offset + 4u];
      source_position = vec3<f32>(
        far_candidate_rows[candidate_offset + 21u],
        far_candidate_rows[candidate_offset + 22u],
        far_candidate_rows[candidate_offset + 23u]
      );
      accepted_count = far_candidate_rows[candidate_offset + 30u];
    }
    if (far_candidate_rows[candidate_offset + 31u] > 0.0) {
      overflow_count = overflow_count + 1.0;
      accepted_count = max(accepted_count, far_candidate_rows[candidate_offset + 30u]);
    }
    if (status > 0.0 && status < 32.0) {
      let aggregate_mass = far_candidate_rows[candidate_offset + 12u];
      let distance_m = max(far_candidate_rows[candidate_offset + 8u], 0.000001);
      let center_m = vec3<f32>(
        far_candidate_rows[candidate_offset + 18u],
        far_candidate_rows[candidate_offset + 19u],
        far_candidate_rows[candidate_offset + 20u]
      );
      let direction_vector = center_m - source_position;
      let softened_distance = sqrt(distance_m * distance_m + params.softening_length_m * params.softening_length_m);
      let inv_distance = 1.0 / max(softened_distance, 0.000001);
      let direction = direction_vector * inv_distance;
      let acceleration_magnitude = params.gravitational_constant * aggregate_mass * inv_distance * inv_distance * params.force_scale;
      acceleration = acceleration + direction * acceleration_magnitude;
      potential = potential - params.gravitational_constant * aggregate_mass * inv_distance * params.force_scale;
      total_mass = total_mass + aggregate_mass;
      active_count = active_count + 1.0;
      min_distance = min(min_distance, distance_m);
      max_opening_ratio = max(max_opening_ratio, far_candidate_rows[candidate_offset + 11u]);
      max_error_bound = max(max_error_bound, far_candidate_rows[candidate_offset + 25u]);
      admissibility_flags = max(admissibility_flags, far_candidate_rows[candidate_offset + 26u]);
    } else if (status >= 32.0) {
      blocked_count = blocked_count + 1.0;
    }
  }

  let final_min_distance = select(0.0, min_distance, active_count > 0.0);
  var summary_status = select(32.0, 1.0, active_count > 0.0);
  if (overflow_count > 0.0) {
    summary_status = 128.0;
  }

  force_summary_rows[summary_offset + 0u] = source_particle;
  force_summary_rows[summary_offset + 1u] = source_level;
  force_summary_rows[summary_offset + 2u] = source_chart;
  force_summary_rows[summary_offset + 3u] = f32(params.enabled_far_law_mask);
  force_summary_rows[summary_offset + 4u] = f32(source_index * candidate_budget);
  force_summary_rows[summary_offset + 5u] = f32(candidate_budget);
  force_summary_rows[summary_offset + 6u] = accepted_count;
  force_summary_rows[summary_offset + 7u] = active_count;
  force_summary_rows[summary_offset + 8u] = acceleration.x;
  force_summary_rows[summary_offset + 9u] = acceleration.y;
  force_summary_rows[summary_offset + 10u] = acceleration.z;
  force_summary_rows[summary_offset + 11u] = potential;
  force_summary_rows[summary_offset + 12u] = total_mass;
  force_summary_rows[summary_offset + 13u] = final_min_distance;
  force_summary_rows[summary_offset + 14u] = max_opening_ratio;
  force_summary_rows[summary_offset + 15u] = max_error_bound;
  force_summary_rows[summary_offset + 16u] = overflow_count;
  force_summary_rows[summary_offset + 17u] = blocked_count;
  force_summary_rows[summary_offset + 18u] = summary_status;
  force_summary_rows[summary_offset + 19u] = params.queue_epoch;
  force_summary_rows[summary_offset + 20u] = params.state_family_id;
  force_summary_rows[summary_offset + 21u] = params.gravitational_constant;
  force_summary_rows[summary_offset + 22u] = params.softening_length_m;
  force_summary_rows[summary_offset + 23u] = 1.0;
  force_summary_rows[summary_offset + 24u] = source_position.x;
  force_summary_rows[summary_offset + 25u] = source_position.y;
  force_summary_rows[summary_offset + 26u] = source_position.z;
  force_summary_rows[summary_offset + 27u] = admissibility_flags;
  force_summary_rows[summary_offset + 28u] = 0.0;
  force_summary_rows[summary_offset + 29u] = 0.0;
  force_summary_rows[summary_offset + 30u] = 0.0;
  force_summary_rows[summary_offset + 31u] = 0.0;
}
`;

export const schroederFarAggregateDiagnosticSummaryWgsl = `
struct SchroederFarAggregateDiagnosticSummaryParams {
  force_summary_row_count: u32,
  force_summary_stride: u32,
  diagnostic_stride: u32,
  flags: u32,
  opening_theta: f32,
  far_field_error_bound: f32,
  acceleration_pressure_threshold: f32,
  queue_epoch: f32,
  state_family_id: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> force_summary_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> diagnostic_summary_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederFarAggregateDiagnosticSummaryParams;

const SCHROEDER_DEFAULT_FAR_AGGREGATE_FORCE_SUMMARY_STRIDE_FOR_DIAGNOSTICS: u32 = 32u;
const SCHROEDER_DEFAULT_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_STRIDE: u32 = 32u;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x > 0u) {
    return;
  }

  let force_summary_stride = max(
    params.force_summary_stride,
    SCHROEDER_DEFAULT_FAR_AGGREGATE_FORCE_SUMMARY_STRIDE_FOR_DIAGNOSTICS
  );
  let diagnostic_stride = max(
    params.diagnostic_stride,
    SCHROEDER_DEFAULT_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_STRIDE
  );
  let diagnostic_offset = 0u * diagnostic_stride;

  var active_source_count = 0.0;
  var empty_source_count = 0.0;
  var overflow_source_count = 0.0;
  var blocked_source_count = 0.0;
  var total_accepted_candidate_count = 0.0;
  var total_active_candidate_count = 0.0;
  var total_overflow_candidate_count = 0.0;
  var total_blocked_candidate_count = 0.0;
  var total_candidate_budget = 0.0;
  var max_opening_ratio = 0.0;
  var max_far_field_error_bound = 0.0;
  var max_acceleration_magnitude = 0.0;
  var max_potential_magnitude = 0.0;
  var total_aggregate_mass = 0.0;
  var min_distance = 3.402823e38;
  var max_candidate_budget = 0.0;
  var enabled_far_law_mask = 0.0;
  var queue_epoch = params.queue_epoch;
  var state_family_id = params.state_family_id;
  var max_acceleration_source_particle = -1.0;
  var acceleration_pressure_source_count = 0.0;
  var error_bound_pressure_source_count = 0.0;
  var opening_ratio_pressure_source_count = 0.0;

  for (var row_index = 0u; row_index < params.force_summary_row_count; row_index = row_index + 1u) {
    let row_offset = row_index * force_summary_stride;
    let candidate_budget = max(force_summary_rows[row_offset + 5u], 0.0);
    let accepted_candidate_count = max(force_summary_rows[row_offset + 6u], 0.0);
    let active_candidate_count = max(force_summary_rows[row_offset + 7u], 0.0);
    let acceleration = vec3<f32>(
      force_summary_rows[row_offset + 8u],
      force_summary_rows[row_offset + 9u],
      force_summary_rows[row_offset + 10u]
    );
    let potential_magnitude = abs(force_summary_rows[row_offset + 11u]);
    let aggregate_mass = max(force_summary_rows[row_offset + 12u], 0.0);
    let distance_m = force_summary_rows[row_offset + 13u];
    let opening_ratio = max(force_summary_rows[row_offset + 14u], 0.0);
    let far_error_bound = max(force_summary_rows[row_offset + 15u], 0.0);
    let overflow_count = max(force_summary_rows[row_offset + 16u], 0.0);
    let blocked_count = max(force_summary_rows[row_offset + 17u], 0.0);
    let row_status = force_summary_rows[row_offset + 18u];
    let acceleration_magnitude = length(acceleration);
    let active_source = row_status > 0.0 && row_status < 32.0 && active_candidate_count > 0.0;
    let empty_source = row_status >= 32.0 || active_candidate_count <= 0.0;
    let overflow_source = overflow_count > 0.0 || row_status >= 128.0;
    let blocked_source = blocked_count > 0.0;

    active_source_count = active_source_count + select(0.0, 1.0, active_source);
    empty_source_count = empty_source_count + select(0.0, 1.0, empty_source);
    overflow_source_count = overflow_source_count + select(0.0, 1.0, overflow_source);
    blocked_source_count = blocked_source_count + select(0.0, 1.0, blocked_source);
    total_accepted_candidate_count = total_accepted_candidate_count + accepted_candidate_count;
    total_active_candidate_count = total_active_candidate_count + active_candidate_count;
    total_overflow_candidate_count = total_overflow_candidate_count + overflow_count;
    total_blocked_candidate_count = total_blocked_candidate_count + blocked_count;
    total_candidate_budget = total_candidate_budget + candidate_budget;
    max_opening_ratio = max(max_opening_ratio, opening_ratio);
    max_far_field_error_bound = max(max_far_field_error_bound, far_error_bound);
    max_potential_magnitude = max(max_potential_magnitude, potential_magnitude);
    total_aggregate_mass = total_aggregate_mass + aggregate_mass;
    max_candidate_budget = max(max_candidate_budget, candidate_budget);
    enabled_far_law_mask = max(enabled_far_law_mask, force_summary_rows[row_offset + 3u]);
    queue_epoch = max(queue_epoch, force_summary_rows[row_offset + 19u]);
    state_family_id = max(state_family_id, force_summary_rows[row_offset + 20u]);
    if (active_source && distance_m > 0.0) {
      min_distance = min(min_distance, distance_m);
    }
    if (acceleration_magnitude > max_acceleration_magnitude) {
      max_acceleration_magnitude = acceleration_magnitude;
      max_acceleration_source_particle = force_summary_rows[row_offset + 0u];
    }
    acceleration_pressure_source_count = acceleration_pressure_source_count + select(
      0.0,
      1.0,
      params.acceleration_pressure_threshold > 0.0
        && acceleration_magnitude > params.acceleration_pressure_threshold
    );
    error_bound_pressure_source_count = error_bound_pressure_source_count + select(
      0.0,
      1.0,
      far_error_bound > params.far_field_error_bound
    );
    opening_ratio_pressure_source_count = opening_ratio_pressure_source_count + select(
      0.0,
      1.0,
      opening_ratio > params.opening_theta
    );
  }

  let final_min_distance = select(0.0, min_distance, min_distance < 3.402823e38);
  let source_denominator = max(f32(params.force_summary_row_count), 1.0);
  let active_source_denominator = max(active_source_count, 1.0);
  let overflow_pressure_ratio = overflow_source_count / source_denominator;
  let active_candidate_pressure_ratio = total_active_candidate_count / max(total_candidate_budget, 1.0);
  let error_bound_pressure_ratio = error_bound_pressure_source_count / active_source_denominator;
  let opening_ratio_pressure_ratio = opening_ratio_pressure_source_count / active_source_denominator;
  var summary_status = select(32.0, 1.0, active_source_count > 0.0);
  if (overflow_source_count > 0.0 || total_overflow_candidate_count > 0.0) {
    summary_status = 128.0;
  } else if (error_bound_pressure_source_count > 0.0 || opening_ratio_pressure_source_count > 0.0) {
    summary_status = 64.0;
  }

  diagnostic_summary_rows[diagnostic_offset + 0u] = f32(params.force_summary_row_count);
  diagnostic_summary_rows[diagnostic_offset + 1u] = active_source_count;
  diagnostic_summary_rows[diagnostic_offset + 2u] = empty_source_count;
  diagnostic_summary_rows[diagnostic_offset + 3u] = overflow_source_count;
  diagnostic_summary_rows[diagnostic_offset + 4u] = blocked_source_count;
  diagnostic_summary_rows[diagnostic_offset + 5u] = total_accepted_candidate_count;
  diagnostic_summary_rows[diagnostic_offset + 6u] = total_active_candidate_count;
  diagnostic_summary_rows[diagnostic_offset + 7u] = total_overflow_candidate_count;
  diagnostic_summary_rows[diagnostic_offset + 8u] = total_blocked_candidate_count;
  diagnostic_summary_rows[diagnostic_offset + 9u] = max_opening_ratio;
  diagnostic_summary_rows[diagnostic_offset + 10u] = max_far_field_error_bound;
  diagnostic_summary_rows[diagnostic_offset + 11u] = max_acceleration_magnitude;
  diagnostic_summary_rows[diagnostic_offset + 12u] = max_potential_magnitude;
  diagnostic_summary_rows[diagnostic_offset + 13u] = total_aggregate_mass;
  diagnostic_summary_rows[diagnostic_offset + 14u] = final_min_distance;
  diagnostic_summary_rows[diagnostic_offset + 15u] = max_candidate_budget;
  diagnostic_summary_rows[diagnostic_offset + 16u] = enabled_far_law_mask;
  diagnostic_summary_rows[diagnostic_offset + 17u] = queue_epoch;
  diagnostic_summary_rows[diagnostic_offset + 18u] = state_family_id;
  diagnostic_summary_rows[diagnostic_offset + 19u] = max_acceleration_source_particle;
  diagnostic_summary_rows[diagnostic_offset + 20u] = acceleration_pressure_source_count;
  diagnostic_summary_rows[diagnostic_offset + 21u] = error_bound_pressure_source_count;
  diagnostic_summary_rows[diagnostic_offset + 22u] = opening_ratio_pressure_source_count;
  diagnostic_summary_rows[diagnostic_offset + 23u] = overflow_pressure_ratio;
  diagnostic_summary_rows[diagnostic_offset + 24u] = active_candidate_pressure_ratio;
  diagnostic_summary_rows[diagnostic_offset + 25u] = error_bound_pressure_ratio;
  diagnostic_summary_rows[diagnostic_offset + 26u] = opening_ratio_pressure_ratio;
  diagnostic_summary_rows[diagnostic_offset + 27u] = 1.0;
  diagnostic_summary_rows[diagnostic_offset + 28u] = summary_status;
  diagnostic_summary_rows[diagnostic_offset + 29u] = 0.0;
  diagnostic_summary_rows[diagnostic_offset + 30u] = 0.0;
  diagnostic_summary_rows[diagnostic_offset + 31u] = 0.0;
}
`;

export const schroederFarAggregateLawConsumerWgsl = `
struct SchroederFarAggregateLawConsumerParams {
  force_summary_row_count: u32,
  force_summary_stride: u32,
  diagnostic_stride: u32,
  consumer_stride: u32,
  enabled_consumer_law_mask: u32,
  admission_approved: u32,
  flags: u32,
  pad0: u32,
  radiation_scale: f32,
  plasma_scale: f32,
  gas_summary_scale: f32,
  gas_temperature_k: f32,
  max_far_field_error_bound: f32,
  max_opening_ratio: f32,
  queue_epoch: f32,
  state_family_id: f32,
  gas_constant_proxy: f32,
  pad1: f32,
  pad2: f32,
  pad3: f32,
};

@group(0) @binding(0) var<storage, read> force_summary_rows: array<f32>;
@group(0) @binding(1) var<storage, read> diagnostic_summary_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> law_consumer_rows: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederFarAggregateLawConsumerParams;

const SCHROEDER_DEFAULT_FAR_AGGREGATE_FORCE_SUMMARY_STRIDE_FOR_CONSUMERS: u32 = 32u;
const SCHROEDER_DEFAULT_FAR_AGGREGATE_DIAGNOSTIC_STRIDE_FOR_CONSUMERS: u32 = 32u;
const SCHROEDER_DEFAULT_FAR_AGGREGATE_LAW_CONSUMER_STRIDE: u32 = 32u;
const SCHROEDER_FAR_LAW_RADIATION_MASK_WGSL: u32 = 16u;
const SCHROEDER_FAR_LAW_PLASMA_MASK_WGSL: u32 = 32u;
const SCHROEDER_FAR_LAW_GAS_SUMMARY_MASK_WGSL: u32 = 64u;
const SCHROEDER_FAR_LAW_CONSUMER_MASK_WGSL: u32 =
  SCHROEDER_FAR_LAW_RADIATION_MASK_WGSL
  | SCHROEDER_FAR_LAW_PLASMA_MASK_WGSL
  | SCHROEDER_FAR_LAW_GAS_SUMMARY_MASK_WGSL;

fn ss_consumer_mask_enabled(mask: u32, bit: u32) -> bool {
  return (mask & bit) != 0u;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.force_summary_row_count) {
    return;
  }

  let force_stride = max(
    params.force_summary_stride,
    SCHROEDER_DEFAULT_FAR_AGGREGATE_FORCE_SUMMARY_STRIDE_FOR_CONSUMERS
  );
  let diagnostic_stride = max(
    params.diagnostic_stride,
    SCHROEDER_DEFAULT_FAR_AGGREGATE_DIAGNOSTIC_STRIDE_FOR_CONSUMERS
  );
  let consumer_stride = max(
    params.consumer_stride,
    SCHROEDER_DEFAULT_FAR_AGGREGATE_LAW_CONSUMER_STRIDE
  );
  let force_offset = row_index * force_stride;
  let diagnostic_offset = 0u * diagnostic_stride;
  let consumer_offset = row_index * consumer_stride;

  let source_law_mask = u32(max(force_summary_rows[force_offset + 3u], 0.0));
  let enabled_consumer_mask = params.enabled_consumer_law_mask & SCHROEDER_FAR_LAW_CONSUMER_MASK_WGSL;
  let emitted_consumer_mask = source_law_mask & enabled_consumer_mask;
  let force_status = force_summary_rows[force_offset + 18u];
  let active_candidate_count = max(force_summary_rows[force_offset + 7u], 0.0);
  let accepted_candidate_count = max(force_summary_rows[force_offset + 6u], 0.0);
  let total_aggregate_mass = max(force_summary_rows[force_offset + 12u], 0.0);
  let min_distance_m = max(force_summary_rows[force_offset + 13u], 0.000001);
  let max_opening_ratio = max(force_summary_rows[force_offset + 14u], 0.0);
  let max_far_field_error_bound = max(force_summary_rows[force_offset + 15u], 0.0);
  let acceleration = vec3<f32>(
    force_summary_rows[force_offset + 8u],
    force_summary_rows[force_offset + 9u],
    force_summary_rows[force_offset + 10u]
  );
  let acceleration_magnitude = length(acceleration);
  let potential_magnitude = abs(force_summary_rows[force_offset + 11u]);
  let overflow_count = max(force_summary_rows[force_offset + 16u], 0.0);

  let error_pressure = max_far_field_error_bound > params.max_far_field_error_bound
    && params.max_far_field_error_bound > 0.0;
  let opening_pressure = max_opening_ratio > params.max_opening_ratio
    && params.max_opening_ratio > 0.0;
  let overflow_pressure = overflow_count > 0.0 || diagnostic_summary_rows[diagnostic_offset + 3u] > 0.0;
  let diagnostic_status = diagnostic_summary_rows[diagnostic_offset + 28u];

  let inv_distance2 = 1.0 / max(min_distance_m * min_distance_m, 0.000001);
  let volume_proxy = max(4.1887902047863905 * min_distance_m * min_distance_m * min_distance_m, 0.000001);
  let radiation_exposure = select(
    0.0,
    (potential_magnitude + total_aggregate_mass * inv_distance2) * params.radiation_scale,
    ss_consumer_mask_enabled(emitted_consumer_mask, SCHROEDER_FAR_LAW_RADIATION_MASK_WGSL)
  );
  let plasma_collective_acceleration = select(
    0.0,
    acceleration_magnitude * params.plasma_scale,
    ss_consumer_mask_enabled(emitted_consumer_mask, SCHROEDER_FAR_LAW_PLASMA_MASK_WGSL)
  );
  let gas_density_proxy = select(
    0.0,
    total_aggregate_mass / volume_proxy * params.gas_summary_scale,
    ss_consumer_mask_enabled(emitted_consumer_mask, SCHROEDER_FAR_LAW_GAS_SUMMARY_MASK_WGSL)
  );
  let gas_pressure_proxy = gas_density_proxy * max(params.gas_temperature_k, 0.0) * max(params.gas_constant_proxy, 0.0);

  var status = select(32.0, 1.0, active_candidate_count > 0.0 && force_status > 0.0 && force_status < 32.0);
  if (params.admission_approved == 0u) {
    status = 128.0;
  } else if (emitted_consumer_mask == 0u) {
    status = 96.0;
  } else if (error_pressure || opening_pressure || overflow_pressure) {
    status = 64.0;
  }

  law_consumer_rows[consumer_offset + 0u] = force_summary_rows[force_offset + 0u];
  law_consumer_rows[consumer_offset + 1u] = force_summary_rows[force_offset + 1u];
  law_consumer_rows[consumer_offset + 2u] = force_summary_rows[force_offset + 2u];
  law_consumer_rows[consumer_offset + 3u] = force_summary_rows[force_offset + 3u];
  law_consumer_rows[consumer_offset + 4u] = f32(enabled_consumer_mask);
  law_consumer_rows[consumer_offset + 5u] = f32(emitted_consumer_mask);
  law_consumer_rows[consumer_offset + 6u] = status;
  law_consumer_rows[consumer_offset + 7u] = force_status;
  law_consumer_rows[consumer_offset + 8u] = active_candidate_count;
  law_consumer_rows[consumer_offset + 9u] = accepted_candidate_count;
  law_consumer_rows[consumer_offset + 10u] = total_aggregate_mass;
  law_consumer_rows[consumer_offset + 11u] = min_distance_m;
  law_consumer_rows[consumer_offset + 12u] = max_opening_ratio;
  law_consumer_rows[consumer_offset + 13u] = max_far_field_error_bound;
  law_consumer_rows[consumer_offset + 14u] = acceleration_magnitude;
  law_consumer_rows[consumer_offset + 15u] = potential_magnitude;
  law_consumer_rows[consumer_offset + 16u] = radiation_exposure;
  law_consumer_rows[consumer_offset + 17u] = plasma_collective_acceleration;
  law_consumer_rows[consumer_offset + 18u] = gas_density_proxy;
  law_consumer_rows[consumer_offset + 19u] = gas_pressure_proxy;
  law_consumer_rows[consumer_offset + 20u] = select(0.0, 1.0, error_pressure);
  law_consumer_rows[consumer_offset + 21u] = select(0.0, 1.0, opening_pressure);
  law_consumer_rows[consumer_offset + 22u] = select(0.0, 1.0, overflow_pressure);
  law_consumer_rows[consumer_offset + 23u] = diagnostic_status;
  law_consumer_rows[consumer_offset + 24u] = f32(params.admission_approved);
  law_consumer_rows[consumer_offset + 25u] = 0.0;
  law_consumer_rows[consumer_offset + 26u] = 0.0;
  law_consumer_rows[consumer_offset + 27u] = params.queue_epoch;
  law_consumer_rows[consumer_offset + 28u] = params.state_family_id;
  law_consumer_rows[consumer_offset + 29u] = 1.0;
  law_consumer_rows[consumer_offset + 30u] = f32(row_index);
  law_consumer_rows[consumer_offset + 31u] = 0.0;
}
`;

export const schroederFarAggregateLawConsumerDiagnosticSummaryWgsl = `
struct SchroederFarAggregateLawConsumerDiagnosticSummaryParams {
  law_consumer_row_count: u32,
  law_consumer_stride: u32,
  diagnostic_stride: u32,
  flags: u32,
  radiation_pressure_threshold: f32,
  plasma_pressure_threshold: f32,
  gas_pressure_threshold: f32,
  queue_epoch: f32,
  state_family_id: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> law_consumer_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> diagnostic_summary_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederFarAggregateLawConsumerDiagnosticSummaryParams;

const SCHROEDER_DEFAULT_FAR_AGGREGATE_LAW_CONSUMER_STRIDE_FOR_DIAGNOSTICS: u32 = 32u;
const SCHROEDER_DEFAULT_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_STRIDE: u32 = 32u;
const SCHROEDER_FAR_LAW_RADIATION_DIAGNOSTIC_MASK_WGSL: u32 = 16u;
const SCHROEDER_FAR_LAW_PLASMA_DIAGNOSTIC_MASK_WGSL: u32 = 32u;
const SCHROEDER_FAR_LAW_GAS_DIAGNOSTIC_MASK_WGSL: u32 = 64u;

fn ss_consumer_diagnostic_mask_enabled(mask: u32, bit: u32) -> bool {
  return (mask & bit) != 0u;
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x > 0u) {
    return;
  }

  let consumer_stride = max(
    params.law_consumer_stride,
    SCHROEDER_DEFAULT_FAR_AGGREGATE_LAW_CONSUMER_STRIDE_FOR_DIAGNOSTICS
  );
  let diagnostic_stride = max(
    params.diagnostic_stride,
    SCHROEDER_DEFAULT_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_STRIDE
  );
  let diagnostic_offset = 0u * diagnostic_stride;

  var active_consumer_count = 0.0;
  var blocked_consumer_count = 0.0;
  var pressure_consumer_count = 0.0;
  var radiation_consumer_count = 0.0;
  var plasma_consumer_count = 0.0;
  var gas_summary_consumer_count = 0.0;
  var total_radiation_exposure = 0.0;
  var max_radiation_exposure = 0.0;
  var max_plasma_acceleration = 0.0;
  var total_gas_density = 0.0;
  var max_gas_pressure = 0.0;
  var total_aggregate_mass = 0.0;
  var max_acceleration = 0.0;
  var max_potential = 0.0;
  var max_opening_ratio = 0.0;
  var max_far_field_error = 0.0;
  var error_pressure_count = 0.0;
  var opening_pressure_count = 0.0;
  var overflow_pressure_count = 0.0;
  var enabled_consumer_mask_union = 0u;
  var emitted_consumer_mask_union = 0u;
  var max_radiation_source_particle = 0.0;
  var max_gas_pressure_source_particle = 0.0;

  for (var row_index = 0u; row_index < params.law_consumer_row_count; row_index = row_index + 1u) {
    let row_offset = row_index * consumer_stride;
    let source_particle_index = law_consumer_rows[row_offset + 0u];
    let enabled_consumer_mask = u32(max(law_consumer_rows[row_offset + 4u], 0.0));
    let emitted_consumer_mask = u32(max(law_consumer_rows[row_offset + 5u], 0.0));
    let status = law_consumer_rows[row_offset + 6u];
    let aggregate_mass = max(law_consumer_rows[row_offset + 10u], 0.0);
    let opening_ratio = max(law_consumer_rows[row_offset + 12u], 0.0);
    let far_field_error = max(law_consumer_rows[row_offset + 13u], 0.0);
    let acceleration_magnitude = max(law_consumer_rows[row_offset + 14u], 0.0);
    let potential_magnitude = max(law_consumer_rows[row_offset + 15u], 0.0);
    let radiation_exposure = max(law_consumer_rows[row_offset + 16u], 0.0);
    let plasma_acceleration = max(law_consumer_rows[row_offset + 17u], 0.0);
    let gas_density = max(law_consumer_rows[row_offset + 18u], 0.0);
    let gas_pressure = max(law_consumer_rows[row_offset + 19u], 0.0);
    let error_pressure = law_consumer_rows[row_offset + 20u] > 0.0;
    let opening_pressure = law_consumer_rows[row_offset + 21u] > 0.0;
    let overflow_pressure = law_consumer_rows[row_offset + 22u] > 0.0;

    enabled_consumer_mask_union = enabled_consumer_mask_union | enabled_consumer_mask;
    emitted_consumer_mask_union = emitted_consumer_mask_union | emitted_consumer_mask;

    if (status > 0.0 && status < 32.0) {
      active_consumer_count = active_consumer_count + 1.0;
    } else if (status >= 96.0 || status <= 0.0) {
      blocked_consumer_count = blocked_consumer_count + 1.0;
    }

    let radiation_pressure = params.radiation_pressure_threshold > 0.0
      && radiation_exposure > params.radiation_pressure_threshold;
    let plasma_pressure = params.plasma_pressure_threshold > 0.0
      && plasma_acceleration > params.plasma_pressure_threshold;
    let gas_pressure_limit = params.gas_pressure_threshold > 0.0
      && gas_pressure > params.gas_pressure_threshold;
    if (status >= 64.0 && status < 96.0
      || error_pressure
      || opening_pressure
      || overflow_pressure
      || radiation_pressure
      || plasma_pressure
      || gas_pressure_limit
    ) {
      pressure_consumer_count = pressure_consumer_count + 1.0;
    }
    if (error_pressure) {
      error_pressure_count = error_pressure_count + 1.0;
    }
    if (opening_pressure) {
      opening_pressure_count = opening_pressure_count + 1.0;
    }
    if (overflow_pressure) {
      overflow_pressure_count = overflow_pressure_count + 1.0;
    }

    if (ss_consumer_diagnostic_mask_enabled(emitted_consumer_mask, SCHROEDER_FAR_LAW_RADIATION_DIAGNOSTIC_MASK_WGSL)
      && radiation_exposure > 0.0
    ) {
      radiation_consumer_count = radiation_consumer_count + 1.0;
      total_radiation_exposure = total_radiation_exposure + radiation_exposure;
      if (radiation_exposure > max_radiation_exposure) {
        max_radiation_exposure = radiation_exposure;
        max_radiation_source_particle = source_particle_index;
      }
    }
    if (ss_consumer_diagnostic_mask_enabled(emitted_consumer_mask, SCHROEDER_FAR_LAW_PLASMA_DIAGNOSTIC_MASK_WGSL)
      && plasma_acceleration > 0.0
    ) {
      plasma_consumer_count = plasma_consumer_count + 1.0;
      max_plasma_acceleration = max(max_plasma_acceleration, plasma_acceleration);
    }
    if (ss_consumer_diagnostic_mask_enabled(emitted_consumer_mask, SCHROEDER_FAR_LAW_GAS_DIAGNOSTIC_MASK_WGSL)
      && gas_density > 0.0
    ) {
      gas_summary_consumer_count = gas_summary_consumer_count + 1.0;
      total_gas_density = total_gas_density + gas_density;
      if (gas_pressure > max_gas_pressure) {
        max_gas_pressure = gas_pressure;
        max_gas_pressure_source_particle = source_particle_index;
      }
    }

    total_aggregate_mass = total_aggregate_mass + aggregate_mass;
    max_acceleration = max(max_acceleration, acceleration_magnitude);
    max_potential = max(max_potential, potential_magnitude);
    max_opening_ratio = max(max_opening_ratio, opening_ratio);
    max_far_field_error = max(max_far_field_error, far_field_error);
  }

  var summary_status = 32.0;
  if (active_consumer_count > 0.0) {
    summary_status = 1.0;
  }
  if (pressure_consumer_count > 0.0) {
    summary_status = 64.0;
  }
  if (overflow_pressure_count > 0.0) {
    summary_status = 128.0;
  }

  diagnostic_summary_rows[diagnostic_offset + 0u] = f32(params.law_consumer_row_count);
  diagnostic_summary_rows[diagnostic_offset + 1u] = active_consumer_count;
  diagnostic_summary_rows[diagnostic_offset + 2u] = blocked_consumer_count;
  diagnostic_summary_rows[diagnostic_offset + 3u] = pressure_consumer_count;
  diagnostic_summary_rows[diagnostic_offset + 4u] = radiation_consumer_count;
  diagnostic_summary_rows[diagnostic_offset + 5u] = plasma_consumer_count;
  diagnostic_summary_rows[diagnostic_offset + 6u] = gas_summary_consumer_count;
  diagnostic_summary_rows[diagnostic_offset + 7u] = total_radiation_exposure;
  diagnostic_summary_rows[diagnostic_offset + 8u] = max_radiation_exposure;
  diagnostic_summary_rows[diagnostic_offset + 9u] = max_plasma_acceleration;
  diagnostic_summary_rows[diagnostic_offset + 10u] = total_gas_density;
  diagnostic_summary_rows[diagnostic_offset + 11u] = max_gas_pressure;
  diagnostic_summary_rows[diagnostic_offset + 12u] = total_aggregate_mass;
  diagnostic_summary_rows[diagnostic_offset + 13u] = max_acceleration;
  diagnostic_summary_rows[diagnostic_offset + 14u] = max_potential;
  diagnostic_summary_rows[diagnostic_offset + 15u] = max_opening_ratio;
  diagnostic_summary_rows[diagnostic_offset + 16u] = max_far_field_error;
  diagnostic_summary_rows[diagnostic_offset + 17u] = error_pressure_count;
  diagnostic_summary_rows[diagnostic_offset + 18u] = opening_pressure_count;
  diagnostic_summary_rows[diagnostic_offset + 19u] = overflow_pressure_count;
  diagnostic_summary_rows[diagnostic_offset + 20u] = f32(enabled_consumer_mask_union);
  diagnostic_summary_rows[diagnostic_offset + 21u] = f32(emitted_consumer_mask_union);
  diagnostic_summary_rows[diagnostic_offset + 22u] = params.queue_epoch;
  diagnostic_summary_rows[diagnostic_offset + 23u] = params.state_family_id;
  diagnostic_summary_rows[diagnostic_offset + 24u] = max_radiation_source_particle;
  diagnostic_summary_rows[diagnostic_offset + 25u] = max_gas_pressure_source_particle;
  diagnostic_summary_rows[diagnostic_offset + 26u] = 1.0;
  diagnostic_summary_rows[diagnostic_offset + 27u] = summary_status;
  diagnostic_summary_rows[diagnostic_offset + 28u] = 0.0;
  diagnostic_summary_rows[diagnostic_offset + 29u] = 0.0;
  diagnostic_summary_rows[diagnostic_offset + 30u] = 0.0;
  diagnostic_summary_rows[diagnostic_offset + 31u] = 0.0;
}
`;

export const schroederFarAggregateGasStateDeltaWgsl = `
struct SchroederFarAggregateGasStateDeltaParams {
  law_consumer_row_count: u32,
  law_consumer_stride: u32,
  gas_state_delta_stride: u32,
  admission_approved: u32,
  enabled_consumer_law_mask: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
  reference_pressure_pa: f32,
  pressure_delta_scale: f32,
  density_delta_scale: f32,
  gas_gamma: f32,
  queue_epoch: f32,
  state_family_id: f32,
  target_family_id: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> law_consumer_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> gas_state_delta_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederFarAggregateGasStateDeltaParams;

const SCHROEDER_DEFAULT_GAS_STATE_DELTA_LAW_CONSUMER_STRIDE: u32 = 32u;
const SCHROEDER_DEFAULT_FAR_AGGREGATE_GAS_STATE_DELTA_STRIDE: u32 = 32u;
const SCHROEDER_FAR_LAW_GAS_STATE_DELTA_MASK_WGSL: u32 = 64u;

fn ss_gas_delta_mask_enabled(mask: u32, bit: u32) -> bool {
  return (mask & bit) != 0u;
}

fn ss_gas_state_delta_write_blocked(row_offset: u32, consumer_offset: u32, row_index: u32, status: f32) {
  gas_state_delta_rows[row_offset + 0u] = law_consumer_rows[consumer_offset + 0u];
  gas_state_delta_rows[row_offset + 1u] = law_consumer_rows[consumer_offset + 1u];
  gas_state_delta_rows[row_offset + 2u] = law_consumer_rows[consumer_offset + 2u];
  gas_state_delta_rows[row_offset + 3u] = law_consumer_rows[consumer_offset + 5u];
  gas_state_delta_rows[row_offset + 4u] = 0.0;
  gas_state_delta_rows[row_offset + 5u] = 0.0;
  gas_state_delta_rows[row_offset + 6u] = 0.0;
  gas_state_delta_rows[row_offset + 7u] = max(params.reference_pressure_pa, 0.0);
  gas_state_delta_rows[row_offset + 8u] = 0.0;
  gas_state_delta_rows[row_offset + 9u] = 0.0;
  gas_state_delta_rows[row_offset + 10u] = 0.0;
  gas_state_delta_rows[row_offset + 11u] = 0.0;
  gas_state_delta_rows[row_offset + 12u] = law_consumer_rows[consumer_offset + 8u];
  gas_state_delta_rows[row_offset + 13u] = law_consumer_rows[consumer_offset + 9u];
  gas_state_delta_rows[row_offset + 14u] = law_consumer_rows[consumer_offset + 12u];
  gas_state_delta_rows[row_offset + 15u] = law_consumer_rows[consumer_offset + 13u];
  gas_state_delta_rows[row_offset + 16u] = law_consumer_rows[consumer_offset + 6u];
  gas_state_delta_rows[row_offset + 17u] = law_consumer_rows[consumer_offset + 23u];
  gas_state_delta_rows[row_offset + 18u] = f32(params.admission_approved);
  gas_state_delta_rows[row_offset + 19u] = 0.0;
  gas_state_delta_rows[row_offset + 20u] = 0.0;
  gas_state_delta_rows[row_offset + 21u] = params.queue_epoch;
  gas_state_delta_rows[row_offset + 22u] = params.state_family_id;
  gas_state_delta_rows[row_offset + 23u] = params.target_family_id;
  gas_state_delta_rows[row_offset + 24u] = law_consumer_rows[consumer_offset + 30u];
  gas_state_delta_rows[row_offset + 25u] = f32(row_index);
  gas_state_delta_rows[row_offset + 26u] = 1.0;
  gas_state_delta_rows[row_offset + 27u] = status;
  gas_state_delta_rows[row_offset + 28u] = 1.0;
  gas_state_delta_rows[row_offset + 29u] = 1.0;
  gas_state_delta_rows[row_offset + 30u] = 0.0;
  gas_state_delta_rows[row_offset + 31u] = 0.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.law_consumer_row_count) {
    return;
  }

  let consumer_stride = max(
    params.law_consumer_stride,
    SCHROEDER_DEFAULT_GAS_STATE_DELTA_LAW_CONSUMER_STRIDE
  );
  let delta_stride = max(
    params.gas_state_delta_stride,
    SCHROEDER_DEFAULT_FAR_AGGREGATE_GAS_STATE_DELTA_STRIDE
  );
  let consumer_offset = row_index * consumer_stride;
  let delta_offset = row_index * delta_stride;

  let emitted_consumer_mask = u32(max(law_consumer_rows[consumer_offset + 5u], 0.0));
  let enabled_mask = params.enabled_consumer_law_mask & SCHROEDER_FAR_LAW_GAS_STATE_DELTA_MASK_WGSL;
  let gas_enabled = ss_gas_delta_mask_enabled(emitted_consumer_mask & enabled_mask, SCHROEDER_FAR_LAW_GAS_STATE_DELTA_MASK_WGSL);
  let source_status = law_consumer_rows[consumer_offset + 6u];
  let gas_density = max(law_consumer_rows[consumer_offset + 18u], 0.0);
  let gas_pressure = max(law_consumer_rows[consumer_offset + 19u], 0.0);
  let aggregate_mass = max(law_consumer_rows[consumer_offset + 10u], 0.0);
  let active_candidate_count = max(law_consumer_rows[consumer_offset + 8u], 0.0);

  if (params.admission_approved == 0u) {
    ss_gas_state_delta_write_blocked(delta_offset, consumer_offset, row_index, 128.0);
    return;
  }
  if (!gas_enabled || source_status >= 96.0 || source_status <= 0.0 || gas_pressure <= 0.0 || gas_density <= 0.0) {
    ss_gas_state_delta_write_blocked(delta_offset, consumer_offset, row_index, 96.0);
    return;
  }

  let reference_pressure = max(params.reference_pressure_pa, 0.0);
  let pressure_delta = max(gas_pressure - reference_pressure, 0.0) * max(params.pressure_delta_scale, 0.0);
  let density_delta = gas_density * max(params.density_delta_scale, 0.0);
  let represented_volume = select(0.0, aggregate_mass / max(gas_density, 0.000001), aggregate_mass > 0.0);
  let gamma_minus_one = max(params.gas_gamma - 1.0, 0.1);
  let pressure_work_proxy = pressure_delta * represented_volume / gamma_minus_one;
  var status = select(32.0, 1.0, active_candidate_count > 0.0 && pressure_delta > 0.0);
  if (source_status >= 64.0 && source_status < 96.0) {
    status = 64.0;
  }

  gas_state_delta_rows[delta_offset + 0u] = law_consumer_rows[consumer_offset + 0u];
  gas_state_delta_rows[delta_offset + 1u] = law_consumer_rows[consumer_offset + 1u];
  gas_state_delta_rows[delta_offset + 2u] = law_consumer_rows[consumer_offset + 2u];
  gas_state_delta_rows[delta_offset + 3u] = f32(emitted_consumer_mask);
  gas_state_delta_rows[delta_offset + 4u] = aggregate_mass;
  gas_state_delta_rows[delta_offset + 5u] = gas_density;
  gas_state_delta_rows[delta_offset + 6u] = gas_pressure;
  gas_state_delta_rows[delta_offset + 7u] = reference_pressure;
  gas_state_delta_rows[delta_offset + 8u] = density_delta;
  gas_state_delta_rows[delta_offset + 9u] = pressure_delta;
  gas_state_delta_rows[delta_offset + 10u] = represented_volume;
  gas_state_delta_rows[delta_offset + 11u] = pressure_work_proxy;
  gas_state_delta_rows[delta_offset + 12u] = active_candidate_count;
  gas_state_delta_rows[delta_offset + 13u] = law_consumer_rows[consumer_offset + 9u];
  gas_state_delta_rows[delta_offset + 14u] = law_consumer_rows[consumer_offset + 12u];
  gas_state_delta_rows[delta_offset + 15u] = law_consumer_rows[consumer_offset + 13u];
  gas_state_delta_rows[delta_offset + 16u] = source_status;
  gas_state_delta_rows[delta_offset + 17u] = law_consumer_rows[consumer_offset + 23u];
  gas_state_delta_rows[delta_offset + 18u] = f32(params.admission_approved);
  gas_state_delta_rows[delta_offset + 19u] = 1.0;
  gas_state_delta_rows[delta_offset + 20u] = 0.0;
  gas_state_delta_rows[delta_offset + 21u] = params.queue_epoch;
  gas_state_delta_rows[delta_offset + 22u] = params.state_family_id;
  gas_state_delta_rows[delta_offset + 23u] = params.target_family_id;
  gas_state_delta_rows[delta_offset + 24u] = law_consumer_rows[consumer_offset + 30u];
  gas_state_delta_rows[delta_offset + 25u] = f32(row_index);
  gas_state_delta_rows[delta_offset + 26u] = 1.0;
  gas_state_delta_rows[delta_offset + 27u] = status;
  gas_state_delta_rows[delta_offset + 28u] = 1.0;
  gas_state_delta_rows[delta_offset + 29u] = 1.0;
  gas_state_delta_rows[delta_offset + 30u] = 0.0;
  gas_state_delta_rows[delta_offset + 31u] = 0.0;
}
`;

export const schroederFarAggregateGasCellImportWgsl = `
struct SchroederFarAggregateGasCellImportParams {
  gas_state_delta_row_count: u32,
  gas_state_delta_stride: u32,
  force_summary_row_count: u32,
  force_summary_stride: u32,
  gas_cell_stride: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
  default_cell_volume_m3: f32,
  queue_epoch: f32,
  state_family_id: f32,
  target_family_id: f32,
};

@group(0) @binding(0) var<storage, read> gas_state_delta_rows: array<f32>;
@group(0) @binding(1) var<storage, read> force_summary_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> gas_cell_rows: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederFarAggregateGasCellImportParams;

const SCHROEDER_DEFAULT_GAS_CELL_IMPORT_DELTA_STRIDE: u32 = 32u;
const SCHROEDER_DEFAULT_GAS_CELL_IMPORT_FORCE_SUMMARY_STRIDE: u32 = 32u;
const SCHROEDER_DEFAULT_GAS_CELL_IMPORT_PRESSURE_CELL_STRIDE: u32 = 12u;

fn ss_gas_cell_write_empty(cell_offset: u32) {
  gas_cell_rows[cell_offset + 0u] = 0.0;
  gas_cell_rows[cell_offset + 1u] = 0.0;
  gas_cell_rows[cell_offset + 2u] = 0.0;
  gas_cell_rows[cell_offset + 3u] = 0.0;
  gas_cell_rows[cell_offset + 4u] = 0.0;
  gas_cell_rows[cell_offset + 5u] = 0.0;
  gas_cell_rows[cell_offset + 6u] = 0.0;
  gas_cell_rows[cell_offset + 7u] = 0.0;
  gas_cell_rows[cell_offset + 8u] = 0.0;
  gas_cell_rows[cell_offset + 9u] = 0.0;
  gas_cell_rows[cell_offset + 10u] = 0.0;
  gas_cell_rows[cell_offset + 11u] = 0.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.gas_state_delta_row_count) {
    return;
  }

  let delta_stride = max(
    params.gas_state_delta_stride,
    SCHROEDER_DEFAULT_GAS_CELL_IMPORT_DELTA_STRIDE
  );
  let force_stride = max(
    params.force_summary_stride,
    SCHROEDER_DEFAULT_GAS_CELL_IMPORT_FORCE_SUMMARY_STRIDE
  );
  let cell_stride = max(
    params.gas_cell_stride,
    SCHROEDER_DEFAULT_GAS_CELL_IMPORT_PRESSURE_CELL_STRIDE
  );
  let delta_offset = row_index * delta_stride;
  let cell_offset = row_index * cell_stride;

  let status = gas_state_delta_rows[delta_offset + 27u];
  let pressure_import_required = gas_state_delta_rows[delta_offset + 28u] > 0.0;
  let admission_approved = gas_state_delta_rows[delta_offset + 18u] > 0.0;
  let mutation_required = gas_state_delta_rows[delta_offset + 19u] > 0.0;
  let full_readback_required = gas_state_delta_rows[delta_offset + 20u] > 0.0;
  let gas_pressure = max(gas_state_delta_rows[delta_offset + 6u], 0.0);
  let represented_volume = max(
    gas_state_delta_rows[delta_offset + 10u],
    max(params.default_cell_volume_m3, 0.0)
  );

  if (
    status <= 0.0
    || status >= 96.0
    || !pressure_import_required
    || !admission_approved
    || !mutation_required
    || full_readback_required
    || gas_pressure <= 0.0
    || represented_volume <= 0.0
  ) {
    ss_gas_cell_write_empty(cell_offset);
    return;
  }

  let consumer_row_index = u32(max(gas_state_delta_rows[delta_offset + 24u], 0.0));
  var force_row_index = row_index;
  if (consumer_row_index < params.force_summary_row_count) {
    force_row_index = consumer_row_index;
  }
  if (force_row_index >= params.force_summary_row_count) {
    ss_gas_cell_write_empty(cell_offset);
    return;
  }
  let force_offset = force_row_index * force_stride;
  let source_position = vec3<f32>(
    force_summary_rows[force_offset + 24u],
    force_summary_rows[force_offset + 25u],
    force_summary_rows[force_offset + 26u]
  );
  let source_level = max(gas_state_delta_rows[delta_offset + 1u], 0.0);
  let source_chart = max(gas_state_delta_rows[delta_offset + 2u], 0.0);

  gas_cell_rows[cell_offset + 0u] = gas_state_delta_rows[delta_offset + 0u];
  gas_cell_rows[cell_offset + 1u] = source_level;
  gas_cell_rows[cell_offset + 2u] = source_chart;
  gas_cell_rows[cell_offset + 3u] = 1.0;
  gas_cell_rows[cell_offset + 4u] = source_position.x;
  gas_cell_rows[cell_offset + 5u] = source_position.y;
  gas_cell_rows[cell_offset + 6u] = source_position.z;
  gas_cell_rows[cell_offset + 7u] = gas_pressure;
  gas_cell_rows[cell_offset + 8u] = 0.0;
  gas_cell_rows[cell_offset + 9u] = 0.0;
  gas_cell_rows[cell_offset + 10u] = 0.0;
  gas_cell_rows[cell_offset + 11u] = represented_volume;
}
`;

export const schroederFarAggregateForceApplicationWgsl = `
struct SchroederFarAggregateForceApplicationParams {
  particle_count: u32,
  force_summary_row_count: u32,
  force_summary_stride: u32,
  particle_state_stride: u32,
  application_stride: u32,
  admission_approved: u32,
  flags: u32,
  pad0: u32,
  dt_s: f32,
  acceleration_scale: f32,
  max_acceleration_m_per_s2: f32,
  max_far_field_error_bound: f32,
  max_opening_ratio: f32,
  queue_epoch: f32,
  state_family_id: f32,
  pad1: f32,
};

@group(0) @binding(0) var<storage, read> force_summary_rows: array<f32>;
@group(0) @binding(1) var<storage, read> particle_state_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> force_application_rows: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederFarAggregateForceApplicationParams;

const SCHROEDER_DEFAULT_FORCE_APPLICATION_FORCE_SUMMARY_STRIDE: u32 = 32u;
const SCHROEDER_DEFAULT_FORCE_APPLICATION_PARTICLE_STATE_STRIDE: u32 = 8u;
const SCHROEDER_DEFAULT_FORCE_APPLICATION_STRIDE: u32 = 32u;

fn ss_force_application_write_empty(row_offset: u32, force_offset: u32, status: f32) {
  force_application_rows[row_offset + 0u] = force_summary_rows[force_offset + 0u];
  force_application_rows[row_offset + 1u] = force_summary_rows[force_offset + 1u];
  force_application_rows[row_offset + 2u] = force_summary_rows[force_offset + 2u];
  force_application_rows[row_offset + 3u] = force_summary_rows[force_offset + 3u];
  force_application_rows[row_offset + 4u] = 0.0;
  force_application_rows[row_offset + 5u] = 0.0;
  force_application_rows[row_offset + 6u] = 0.0;
  force_application_rows[row_offset + 7u] = 0.0;
  force_application_rows[row_offset + 8u] = 0.0;
  force_application_rows[row_offset + 9u] = 0.0;
  force_application_rows[row_offset + 10u] = 0.0;
  force_application_rows[row_offset + 11u] = max(params.dt_s, 0.0);
  force_application_rows[row_offset + 12u] = 0.0;
  force_application_rows[row_offset + 13u] = 0.0;
  force_application_rows[row_offset + 14u] = 0.0;
  force_application_rows[row_offset + 15u] = 0.0;
  force_application_rows[row_offset + 16u] = 0.0;
  force_application_rows[row_offset + 17u] = force_summary_rows[force_offset + 11u];
  force_application_rows[row_offset + 18u] = force_summary_rows[force_offset + 7u];
  force_application_rows[row_offset + 19u] = force_summary_rows[force_offset + 6u];
  force_application_rows[row_offset + 20u] = force_summary_rows[force_offset + 14u];
  force_application_rows[row_offset + 21u] = force_summary_rows[force_offset + 15u];
  force_application_rows[row_offset + 22u] = 0.0;
  force_application_rows[row_offset + 23u] = force_summary_rows[force_offset + 18u];
  force_application_rows[row_offset + 24u] = f32(params.admission_approved);
  force_application_rows[row_offset + 25u] = 0.0;
  force_application_rows[row_offset + 26u] = 0.0;
  force_application_rows[row_offset + 27u] = params.queue_epoch;
  force_application_rows[row_offset + 28u] = params.state_family_id;
  force_application_rows[row_offset + 29u] = status;
  force_application_rows[row_offset + 30u] = 1.0;
  force_application_rows[row_offset + 31u] = 0.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.force_summary_row_count) {
    return;
  }

  let force_summary_stride = max(
    params.force_summary_stride,
    SCHROEDER_DEFAULT_FORCE_APPLICATION_FORCE_SUMMARY_STRIDE
  );
  let particle_state_stride = max(
    params.particle_state_stride,
    SCHROEDER_DEFAULT_FORCE_APPLICATION_PARTICLE_STATE_STRIDE
  );
  let application_stride = max(params.application_stride, SCHROEDER_DEFAULT_FORCE_APPLICATION_STRIDE);
  let force_offset = row_index * force_summary_stride;
  let application_offset = row_index * application_stride;

  if (params.admission_approved == 0u) {
    ss_force_application_write_empty(application_offset, force_offset, 128.0);
    return;
  }

  let source_particle_f = force_summary_rows[force_offset + 0u];
  let source_particle = u32(max(source_particle_f, 0.0));
  let source_in_range = source_particle < params.particle_count;
  if (!source_in_range) {
    ss_force_application_write_empty(application_offset, force_offset, 96.0);
    return;
  }

  let particle_offset = source_particle * particle_state_stride;
  let source_mass = max(particle_state_rows[particle_offset + 3u], 0.0);
  let raw_acceleration = vec3<f32>(
    force_summary_rows[force_offset + 8u],
    force_summary_rows[force_offset + 9u],
    force_summary_rows[force_offset + 10u]
  ) * params.acceleration_scale;
  let raw_acceleration_magnitude = length(raw_acceleration);
  var acceleration = raw_acceleration;
  if (params.max_acceleration_m_per_s2 > 0.0 && raw_acceleration_magnitude > params.max_acceleration_m_per_s2) {
    acceleration = raw_acceleration * (params.max_acceleration_m_per_s2 / max(raw_acceleration_magnitude, 0.000001));
  }

  let dt_s = max(params.dt_s, 0.0);
  let delta_velocity = acceleration * dt_s;
  let momentum_delta = delta_velocity * source_mass;
  let impulse_magnitude = length(momentum_delta);
  let kinetic_energy_delta = 0.5 * source_mass * dot(delta_velocity, delta_velocity);
  let active_candidate_count = max(force_summary_rows[force_offset + 7u], 0.0);
  let force_status = force_summary_rows[force_offset + 18u];
  let opening_ratio = max(force_summary_rows[force_offset + 14u], 0.0);
  let far_error_bound = max(force_summary_rows[force_offset + 15u], 0.0);
  let active_force = force_status > 0.0 && force_status < 32.0 && active_candidate_count > 0.0;
  let pressure_blocked = (
    (params.max_opening_ratio > 0.0 && opening_ratio > params.max_opening_ratio)
    || (params.max_far_field_error_bound > 0.0 && far_error_bound > params.max_far_field_error_bound)
  );
  var status = select(32.0, 1.0, active_force && source_mass > 0.0);
  if (pressure_blocked) {
    status = 64.0;
  }

  force_application_rows[application_offset + 0u] = source_particle_f;
  force_application_rows[application_offset + 1u] = force_summary_rows[force_offset + 1u];
  force_application_rows[application_offset + 2u] = force_summary_rows[force_offset + 2u];
  force_application_rows[application_offset + 3u] = force_summary_rows[force_offset + 3u];
  force_application_rows[application_offset + 4u] = source_mass;
  force_application_rows[application_offset + 5u] = acceleration.x;
  force_application_rows[application_offset + 6u] = acceleration.y;
  force_application_rows[application_offset + 7u] = acceleration.z;
  force_application_rows[application_offset + 8u] = delta_velocity.x;
  force_application_rows[application_offset + 9u] = delta_velocity.y;
  force_application_rows[application_offset + 10u] = delta_velocity.z;
  force_application_rows[application_offset + 11u] = dt_s;
  force_application_rows[application_offset + 12u] = momentum_delta.x;
  force_application_rows[application_offset + 13u] = momentum_delta.y;
  force_application_rows[application_offset + 14u] = momentum_delta.z;
  force_application_rows[application_offset + 15u] = impulse_magnitude;
  force_application_rows[application_offset + 16u] = kinetic_energy_delta;
  force_application_rows[application_offset + 17u] = force_summary_rows[force_offset + 11u];
  force_application_rows[application_offset + 18u] = active_candidate_count;
  force_application_rows[application_offset + 19u] = force_summary_rows[force_offset + 6u];
  force_application_rows[application_offset + 20u] = opening_ratio;
  force_application_rows[application_offset + 21u] = far_error_bound;
  force_application_rows[application_offset + 22u] = select(1.0, 64.0, pressure_blocked);
  force_application_rows[application_offset + 23u] = force_status;
  force_application_rows[application_offset + 24u] = 1.0;
  force_application_rows[application_offset + 25u] = 1.0;
  force_application_rows[application_offset + 26u] = 0.0;
  force_application_rows[application_offset + 27u] = params.queue_epoch;
  force_application_rows[application_offset + 28u] = params.state_family_id;
  force_application_rows[application_offset + 29u] = status;
  force_application_rows[application_offset + 30u] = 1.0;
  force_application_rows[application_offset + 31u] = 0.0;
}
`;

export const schroederPhaseVolumeMigrationWgsl = `
struct SchroederPhaseVolumeMigrationParams {
  particle_count: u32,
  aggregate_node_count: u32,
  assignment_stride: u32,
  aggregate_node_stride: u32,
  migration_stride: u32,
  min_level: i32,
  max_level: i32,
  flags: u32,
  base_grid_spacing_m: f32,
  target_support_cells: f32,
  support_radius_scale: f32,
  volume_expand_threshold: f32,
  coarsen_level_delta_threshold: f32,
  gas_phase_id: f32,
  migration_epoch: f32,
  aggregate_residual_tolerance: f32,
};

@group(0) @binding(0) var<storage, read> level_assignments: array<f32>;
@group(0) @binding(1) var<storage, read> aggregate_node_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> migration_rows: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederPhaseVolumeMigrationParams;
@group(0) @binding(4) var<storage, read> particle_identity: array<u32>;

const SCHROEDER_PVM_ASSIGNMENT_STRIDE: u32 = 16u;
const SCHROEDER_PVM_AGGREGATE_NODE_STRIDE: u32 = 32u;
const SCHROEDER_PVM_MIGRATION_STRIDE: u32 = 32u;
const SCHROEDER_PVM_PI: f32 = 3.141592653589793;

fn ss_pvm_positive(value: f32) -> bool {
  return value == value && value > 0.0;
}

fn ss_pvm_clamp_i32(value: i32, lo: i32, hi: i32) -> i32 {
  return min(max(value, lo), hi);
}

fn ss_pvm_volume_radius(volume_m3: f32) -> f32 {
  if (!ss_pvm_positive(volume_m3)) {
    return 0.0;
  }
  return pow((3.0 * volume_m3) / (4.0 * SCHROEDER_PVM_PI), 0.3333333333333333);
}

fn ss_pvm_level_from_support(support_radius_m: f32) -> i32 {
  let base_dx = max(params.base_grid_spacing_m, 0.000001);
  let target_cells = max(params.target_support_cells, 1.0);
  let native_dx_unclamped = max(support_radius_m / target_cells, 0.000001);
  let raw_level = i32(round(log2(native_dx_unclamped / base_dx)));
  return ss_pvm_clamp_i32(raw_level, params.min_level, params.max_level);
}

fn ss_pvm_grid_spacing_for_level(level: i32) -> f32 {
  return max(params.base_grid_spacing_m, 0.000001) * exp2(f32(level));
}

fn ss_pvm_active_aggregate_node(node_offset: u32) -> bool {
  let status = aggregate_node_rows[node_offset + 3u];
  let admission = aggregate_node_rows[node_offset + 30u];
  return status > 0.0 && status < 32.0 && admission > 0.0;
}

fn ss_pvm_same_cell(
  node_offset: u32,
  particle_domain: f32,
  target_level: i32,
  chart_id: f32,
  target_cell: vec3<f32>
) -> bool {
  let node_domain = aggregate_node_rows[node_offset + 0u];
  let node_level = aggregate_node_rows[node_offset + 1u];
  let node_chart = aggregate_node_rows[node_offset + 2u];
  let node_cell = vec3<f32>(
    aggregate_node_rows[node_offset + 4u],
    aggregate_node_rows[node_offset + 5u],
    aggregate_node_rows[node_offset + 6u]
  );
  return abs(node_domain - particle_domain) < 0.5
    && abs(node_level - f32(target_level)) < 0.5
    && abs(node_chart - chart_id) < 0.5
    && all(abs(node_cell - target_cell) < vec3<f32>(0.5));
}

fn ss_pvm_write_row(
  migration_offset: u32,
  particle_index: u32,
  source_level: f32,
  target_level: f32,
  status: f32,
  source_support: f32,
  target_support: f32,
  rest_volume: f32,
  represented_volume: f32,
  volume_ratio: f32,
  level_delta: f32,
  phase_id: f32,
  material_id: f32,
  aggregate_node_index: f32,
  aggregate_match_count: f32,
  aggregate_suppressed_duplicate_count: f32,
  aggregate_mass: f32,
  aggregate_volume: f32,
  aggregate_mass_residual: f32,
  aggregate_volume_residual: f32,
  source_grid_spacing: f32,
  target_grid_spacing: f32,
  aggregate_volume_ratio: f32,
  coarsen_eligible: f32,
  refine_required: f32,
  phase_volume_mode_id: f32,
  aggregate_coherence_status: f32,
  conservation_residual_status: f32,
  chart_id: f32,
  migration_mode_id: f32,
  state_admission_required: f32,
  refine_pressure_reason_mask: f32
) {
  migration_rows[migration_offset + 0u] = f32(particle_index);
  migration_rows[migration_offset + 1u] = source_level;
  migration_rows[migration_offset + 2u] = target_level;
  migration_rows[migration_offset + 3u] = status;
  migration_rows[migration_offset + 4u] = source_support;
  migration_rows[migration_offset + 5u] = target_support;
  migration_rows[migration_offset + 6u] = rest_volume;
  migration_rows[migration_offset + 7u] = represented_volume;
  migration_rows[migration_offset + 8u] = volume_ratio;
  migration_rows[migration_offset + 9u] = level_delta;
  migration_rows[migration_offset + 10u] = phase_id;
  migration_rows[migration_offset + 11u] = material_id;
  migration_rows[migration_offset + 12u] = aggregate_node_index;
  migration_rows[migration_offset + 13u] = aggregate_match_count;
  migration_rows[migration_offset + 14u] = aggregate_suppressed_duplicate_count;
  migration_rows[migration_offset + 15u] = aggregate_mass;
  migration_rows[migration_offset + 16u] = aggregate_volume;
  migration_rows[migration_offset + 17u] = aggregate_mass_residual;
  migration_rows[migration_offset + 18u] = aggregate_volume_residual;
  migration_rows[migration_offset + 19u] = source_grid_spacing;
  migration_rows[migration_offset + 20u] = target_grid_spacing;
  migration_rows[migration_offset + 21u] = aggregate_volume_ratio;
  migration_rows[migration_offset + 22u] = coarsen_eligible;
  migration_rows[migration_offset + 23u] = refine_required;
  migration_rows[migration_offset + 24u] = phase_volume_mode_id;
  migration_rows[migration_offset + 25u] = aggregate_coherence_status;
  migration_rows[migration_offset + 26u] = conservation_residual_status;
  migration_rows[migration_offset + 27u] = params.migration_epoch;
  migration_rows[migration_offset + 28u] = chart_id;
  migration_rows[migration_offset + 29u] = migration_mode_id;
  migration_rows[migration_offset + 30u] = state_admission_required;
  migration_rows[migration_offset + 31u] = refine_pressure_reason_mask;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let assignment_stride = max(params.assignment_stride, SCHROEDER_PVM_ASSIGNMENT_STRIDE);
  let aggregate_node_stride = max(params.aggregate_node_stride, SCHROEDER_PVM_AGGREGATE_NODE_STRIDE);
  let migration_stride = max(params.migration_stride, SCHROEDER_PVM_MIGRATION_STRIDE);
  let assignment_offset = particle_index * assignment_stride;
  let migration_offset = particle_index * migration_stride;

  let source_level = level_assignments[assignment_offset + 0u];
  let source_grid_spacing = level_assignments[assignment_offset + 1u];
  let source_support = level_assignments[assignment_offset + 2u];
  let represented_volume = level_assignments[assignment_offset + 3u];
  let rest_volume = level_assignments[assignment_offset + 4u];
  let phase_id = level_assignments[assignment_offset + 8u];
  let material_id = level_assignments[assignment_offset + 9u];
  let position = vec3<f32>(
    level_assignments[assignment_offset + 12u],
    level_assignments[assignment_offset + 13u],
    level_assignments[assignment_offset + 14u]
  );
  let chart_id = level_assignments[assignment_offset + 15u];
  let particle_domain = f32(particle_identity[particle_index]);

  if (!ss_pvm_positive(represented_volume) || !ss_pvm_positive(rest_volume)) {
    ss_pvm_write_row(
      migration_offset,
      particle_index,
      source_level,
      source_level,
      32.0,
      source_support,
      source_support,
      rest_volume,
      represented_volume,
      0.0,
      0.0,
      phase_id,
      material_id,
      -1.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      source_grid_spacing,
      source_grid_spacing,
      0.0,
      0.0,
      1.0,
      0.0,
      0.0,
      0.0,
      chart_id,
      1.0,
      1.0,
      0.0
    );
    return;
  }

  let volume_ratio = max(represented_volume / max(rest_volume, 0.000001), 0.0);
  let physical_support = ss_pvm_volume_radius(represented_volume) * max(params.support_radius_scale, 0.0);
  let target_support = max(physical_support, source_support);
  let target_level_i32 = ss_pvm_level_from_support(target_support);
  let target_level = f32(target_level_i32);
  let target_grid_spacing = ss_pvm_grid_spacing_for_level(target_level_i32);
  let level_delta = target_level - source_level;
  let target_cell = floor(position / max(target_grid_spacing, 0.000001));

  var aggregate_node_index = -1.0;
  var aggregate_match_count = 0.0;
  var aggregate_suppressed_duplicate_count = 0.0;
  var aggregate_mass = 0.0;
  var aggregate_volume = 0.0;
  var aggregate_mass_residual = 0.0;
  var aggregate_volume_residual = 0.0;
  for (var node_index = 0u; node_index < params.aggregate_node_count; node_index = node_index + 1u) {
    let node_offset = node_index * aggregate_node_stride;
    if (ss_pvm_active_aggregate_node(node_offset)
      && ss_pvm_same_cell(node_offset, particle_domain, target_level_i32, chart_id, target_cell)
      && aggregate_node_index < 0.0) {
      aggregate_node_index = f32(node_index);
      aggregate_match_count = aggregate_node_rows[node_offset + 15u];
      aggregate_suppressed_duplicate_count = aggregate_node_rows[node_offset + 16u];
      aggregate_mass = aggregate_node_rows[node_offset + 8u];
      aggregate_volume = aggregate_node_rows[node_offset + 9u];
      aggregate_mass_residual = aggregate_node_rows[node_offset + 17u];
      aggregate_volume_residual = aggregate_node_rows[node_offset + 18u];
    }
  }

  let gas_phase = abs(phase_id - params.gas_phase_id) < 0.5;
  let phase_expanded = gas_phase && volume_ratio >= max(params.volume_expand_threshold, 1.0);
  let aggregate_matched = aggregate_node_index >= 0.0;
  let aggregate_volume_ratio = select(0.0, aggregate_volume / max(rest_volume, 0.000001), aggregate_volume > 0.0);
  let residual_tolerance = max(params.aggregate_residual_tolerance, 0.0);
  let mass_residual_ok = abs(aggregate_mass_residual) <= residual_tolerance * max(abs(aggregate_mass), 1.0);
  let volume_residual_ok = abs(aggregate_volume_residual) <= residual_tolerance * max(abs(aggregate_volume), 1.0);
  let residual_ok = !aggregate_matched || (mass_residual_ok && volume_residual_ok);
  let aggregate_coherence_status = select(0.0, 1.0, aggregate_matched);
  let conservation_residual_status = select(2.0, 1.0, residual_ok);
  let delta_threshold = max(params.coarsen_level_delta_threshold, 0.0);
  let missing_aggregate_refine_pressure = phase_expanded && !aggregate_matched;
  let residual_refine_pressure = phase_expanded && aggregate_matched && !residual_ok;
  let sparse_surface_refine_pressure = phase_expanded
    && aggregate_matched
    && residual_ok
    && aggregate_match_count <= 1.0
    && level_delta >= delta_threshold;
  var refine_pressure_reason_mask_u32 = 0u;
  if (missing_aggregate_refine_pressure) {
    refine_pressure_reason_mask_u32 = refine_pressure_reason_mask_u32 | 1u;
  }
  if (residual_refine_pressure) {
    refine_pressure_reason_mask_u32 = refine_pressure_reason_mask_u32 | 2u;
  }
  if (sparse_surface_refine_pressure) {
    refine_pressure_reason_mask_u32 = refine_pressure_reason_mask_u32 | 4u;
  }
  let refine_pressure_reason_mask = f32(refine_pressure_reason_mask_u32);
  // Hysteresis: only INTEGRITY reasons (missing aggregate, residual
  // violation - bits 1|2) force a refine. The sparse-surface bit stays in
  // the telemetry mask but must not convert a coarsen-worthy lone particle
  // into a split: a just-merged particle is always alone in its cell, so
  // sparse-surface-as-refine manufactures a merge/split oscillation
  // (+N/-N admitted deltas alternating every step, freezing the physics at
  // a fixed point). Lone coarsen-eligible particles simply keep their
  // coarsen eligibility (the allocator ignores partnerless coarsen rows)
  // and in-place level migration handles them via the phase-volume level
  // update overlay.
  let integrity_refine_mask_u32 = refine_pressure_reason_mask_u32 & 3u;
  let coarsen = phase_expanded
    && level_delta >= delta_threshold
    && aggregate_matched
    && residual_ok
    && integrity_refine_mask_u32 == 0u;
  let refine = phase_expanded && integrity_refine_mask_u32 != 0u;

  var status = 1.0;
  if (phase_expanded) {
    status = status + 2.0;
  }
  if (coarsen) {
    status = status + 4.0;
  }
  if (aggregate_matched) {
    status = status + 8.0;
  }
  if (!residual_ok) {
    status = status + 16.0;
  }

  ss_pvm_write_row(
    migration_offset,
    particle_index,
    source_level,
    target_level,
    status,
    source_support,
    target_support,
    rest_volume,
    represented_volume,
    volume_ratio,
    level_delta,
    phase_id,
    material_id,
    aggregate_node_index,
    aggregate_match_count,
    aggregate_suppressed_duplicate_count,
    aggregate_mass,
    aggregate_volume,
    aggregate_mass_residual,
    aggregate_volume_residual,
    source_grid_spacing,
    target_grid_spacing,
    aggregate_volume_ratio,
    select(0.0, 1.0, coarsen),
    select(0.0, 1.0, refine),
    1.0,
    aggregate_coherence_status,
    conservation_residual_status,
    chart_id,
    1.0,
    1.0,
    refine_pressure_reason_mask
  );
}
`;

export const schroederPhaseVolumeSplitMergeProposalWgsl = `
struct SchroederPhaseVolumeSplitMergeProposalParams {
  migration_row_count: u32,
  migration_stride: u32,
  proposal_stride: u32,
  flags: u32,
  proposal_epoch: f32,
  state_family_id: f32,
  coarsen_mode_id: f32,
  refine_mode_id: f32,
  aggregate_node_count: u32,
  aggregate_node_stride: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> migration_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> proposal_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederPhaseVolumeSplitMergeProposalParams;
@group(0) @binding(3) var<storage, read> aggregate_node_rows: array<f32>;

const SCHROEDER_PVSMP_MIGRATION_STRIDE: u32 = 32u;
const SCHROEDER_PVSMP_PROPOSAL_STRIDE: u32 = 32u;
const SCHROEDER_PVSMP_AGGREGATE_NODE_STRIDE: u32 = 32u;

// Cell momentum for the merged child: the hierarchy aggregate node rows
// already reduce member momentum (columns 10-12); forward it so the
// materialized child can carry the mass-weighted cell velocity instead of
// the merge leader's. Returns zero when no aggregate node rows are bound.
fn ss_pvsmp_cell_momentum_energy(aggregate_node_index: f32) -> vec4<f32> {
  if (params.aggregate_node_count == 0u || aggregate_node_index < 0.0) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  let node_index = u32(aggregate_node_index);
  if (node_index >= params.aggregate_node_count) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  let node_stride = max(params.aggregate_node_stride, SCHROEDER_PVSMP_AGGREGATE_NODE_STRIDE);
  let node_offset = node_index * node_stride;
  if (aggregate_node_rows[node_offset + 3u] <= 0.0) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  return vec4<f32>(
    aggregate_node_rows[node_offset + 10u],
    aggregate_node_rows[node_offset + 11u],
    aggregate_node_rows[node_offset + 12u],
    aggregate_node_rows[node_offset + 13u]
  );
}

fn ss_pvsmp_active_migration(migration_offset: u32) -> bool {
  let status = migration_rows[migration_offset + 3u];
  return status > 0.0 && status < 32.0;
}

fn ss_pvsmp_write_empty(proposal_offset: u32, migration_offset: u32, status: f32) {
  proposal_rows[proposal_offset + 0u] = migration_rows[migration_offset + 0u];
  proposal_rows[proposal_offset + 1u] = migration_rows[migration_offset + 1u];
  proposal_rows[proposal_offset + 2u] = migration_rows[migration_offset + 2u];
  proposal_rows[proposal_offset + 3u] = status;
  for (var column = 4u; column < SCHROEDER_PVSMP_PROPOSAL_STRIDE; column = column + 1u) {
    proposal_rows[proposal_offset + column] = 0.0;
  }
  proposal_rows[proposal_offset + 27u] = params.proposal_epoch;
  proposal_rows[proposal_offset + 28u] = params.state_family_id;
  proposal_rows[proposal_offset + 29u] = 1.0;
  proposal_rows[proposal_offset + 30u] = 1.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.migration_row_count) {
    return;
  }

  let migration_stride = max(params.migration_stride, SCHROEDER_PVSMP_MIGRATION_STRIDE);
  let proposal_stride = max(params.proposal_stride, SCHROEDER_PVSMP_PROPOSAL_STRIDE);
  let migration_offset = row_index * migration_stride;
  let proposal_offset = row_index * proposal_stride;

  if (!ss_pvsmp_active_migration(migration_offset)) {
    ss_pvsmp_write_empty(proposal_offset, migration_offset, 32.0);
    return;
  }

  let coarsen_eligible = migration_rows[migration_offset + 22u];
  let refine_required = migration_rows[migration_offset + 23u];
  if (coarsen_eligible <= 0.0 && refine_required <= 0.0) {
    ss_pvsmp_write_empty(proposal_offset, migration_offset, 32.0);
    return;
  }

  let refine_pressure_reason_mask = migration_rows[migration_offset + 31u];
  let conservation_residual_status = migration_rows[migration_offset + 26u];
  let proposal_mode_id = select(
    0.0,
    select(params.coarsen_mode_id, params.refine_mode_id, refine_required > 0.0),
    coarsen_eligible > 0.0 || refine_required > 0.0
  );
  var status = 1.0;
  if (coarsen_eligible > 0.0) {
    status = status + 2.0;
  }
  if (refine_required > 0.0) {
    status = status + 4.0;
  }
  if (refine_pressure_reason_mask > 0.0) {
    status = status + 8.0;
  }
  if (conservation_residual_status > 1.0) {
    status = status + 16.0;
  }

  proposal_rows[proposal_offset + 0u] = migration_rows[migration_offset + 0u];
  proposal_rows[proposal_offset + 1u] = migration_rows[migration_offset + 1u];
  proposal_rows[proposal_offset + 2u] = migration_rows[migration_offset + 2u];
  proposal_rows[proposal_offset + 3u] = status;
  proposal_rows[proposal_offset + 4u] = proposal_mode_id;
  proposal_rows[proposal_offset + 5u] = coarsen_eligible;
  proposal_rows[proposal_offset + 6u] = refine_required;
  proposal_rows[proposal_offset + 7u] = refine_pressure_reason_mask;
  proposal_rows[proposal_offset + 8u] = migration_rows[migration_offset + 6u];
  proposal_rows[proposal_offset + 9u] = migration_rows[migration_offset + 7u];
  proposal_rows[proposal_offset + 10u] = migration_rows[migration_offset + 8u];
  proposal_rows[proposal_offset + 11u] = migration_rows[migration_offset + 9u];
  proposal_rows[proposal_offset + 12u] = migration_rows[migration_offset + 12u];
  proposal_rows[proposal_offset + 13u] = migration_rows[migration_offset + 13u];
  proposal_rows[proposal_offset + 14u] = migration_rows[migration_offset + 15u];
  proposal_rows[proposal_offset + 15u] = migration_rows[migration_offset + 16u];
  proposal_rows[proposal_offset + 16u] = migration_rows[migration_offset + 17u];
  proposal_rows[proposal_offset + 17u] = migration_rows[migration_offset + 18u];
  let cell_momentum_energy = select(
    vec4<f32>(0.0, 0.0, 0.0, 0.0),
    ss_pvsmp_cell_momentum_energy(migration_rows[migration_offset + 12u]),
    coarsen_eligible > 0.0
  );
  proposal_rows[proposal_offset + 18u] = cell_momentum_energy.x;
  proposal_rows[proposal_offset + 19u] = cell_momentum_energy.y;
  proposal_rows[proposal_offset + 20u] = cell_momentum_energy.z;
  proposal_rows[proposal_offset + 21u] = cell_momentum_energy.w;
  proposal_rows[proposal_offset + 22u] = migration_rows[migration_offset + 4u];
  proposal_rows[proposal_offset + 23u] = migration_rows[migration_offset + 5u];
  proposal_rows[proposal_offset + 24u] = migration_rows[migration_offset + 19u];
  proposal_rows[proposal_offset + 25u] = migration_rows[migration_offset + 20u];
  proposal_rows[proposal_offset + 26u] = migration_rows[migration_offset + 28u];
  proposal_rows[proposal_offset + 27u] = params.proposal_epoch;
  proposal_rows[proposal_offset + 28u] = params.state_family_id;
  proposal_rows[proposal_offset + 29u] = 1.0;
  proposal_rows[proposal_offset + 30u] = 1.0;
  proposal_rows[proposal_offset + 31u] = 1.0;
}
`;

export const schroederPhaseVolumeSplitMergeApplyWgsl = `
struct SchroederPhaseVolumeSplitMergeApplyParams {
  proposal_row_count: u32,
  proposal_stride: u32,
  apply_stride: u32,
  admission_approved: u32,
  apply_epoch: f32,
  state_family_id: f32,
  residual_tolerance: f32,
  flags: f32,
};

@group(0) @binding(0) var<storage, read> proposal_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> apply_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederPhaseVolumeSplitMergeApplyParams;

const SCHROEDER_PVSMA_PROPOSAL_STRIDE: u32 = 32u;
const SCHROEDER_PVSMA_APPLY_STRIDE: u32 = 32u;

fn ss_pvsma_active_proposal(proposal_offset: u32) -> bool {
  let status = proposal_rows[proposal_offset + 3u];
  return status > 0.0 && status < 32.0 && params.admission_approved > 0u;
}

fn ss_pvsma_write_empty(apply_offset: u32, proposal_offset: u32, status: f32) {
  apply_rows[apply_offset + 0u] = proposal_rows[proposal_offset + 0u];
  apply_rows[apply_offset + 1u] = proposal_rows[proposal_offset + 1u];
  apply_rows[apply_offset + 2u] = proposal_rows[proposal_offset + 2u];
  apply_rows[apply_offset + 3u] = status;
  for (var column = 4u; column < SCHROEDER_PVSMA_APPLY_STRIDE; column = column + 1u) {
    apply_rows[apply_offset + column] = 0.0;
  }
  apply_rows[apply_offset + 6u] = f32(params.admission_approved);
  apply_rows[apply_offset + 30u] = params.apply_epoch;
  apply_rows[apply_offset + 31u] = params.state_family_id;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.proposal_row_count) {
    return;
  }

  let proposal_stride = max(params.proposal_stride, SCHROEDER_PVSMA_PROPOSAL_STRIDE);
  let apply_stride = max(params.apply_stride, SCHROEDER_PVSMA_APPLY_STRIDE);
  let proposal_offset = row_index * proposal_stride;
  let apply_offset = row_index * apply_stride;

  if (!ss_pvsma_active_proposal(proposal_offset)) {
    ss_pvsma_write_empty(apply_offset, proposal_offset, 32.0);
    return;
  }

  let proposal_mode_id = proposal_rows[proposal_offset + 4u];
  let coarsen_eligible = proposal_rows[proposal_offset + 5u] > 0.0;
  let refine_required = proposal_rows[proposal_offset + 6u] > 0.0;
  let rest_volume_m3 = proposal_rows[proposal_offset + 8u];
  let represented_volume_m3 = proposal_rows[proposal_offset + 9u];
  let phase_volume_ratio = proposal_rows[proposal_offset + 10u];
  let level_delta = proposal_rows[proposal_offset + 11u];
  let aggregate_matching_count = max(proposal_rows[proposal_offset + 13u], 1.0);
  let aggregate_mass_kg = proposal_rows[proposal_offset + 14u];
  let aggregate_volume_m3 = proposal_rows[proposal_offset + 15u];
  let aggregate_mass_residual_kg = proposal_rows[proposal_offset + 16u];
  let aggregate_volume_residual_m3 = proposal_rows[proposal_offset + 17u];
  let residual_issue =
    abs(aggregate_mass_residual_kg) > params.residual_tolerance
    || abs(aggregate_volume_residual_m3) > params.residual_tolerance;

  var status = 1.0 + 8.0;
  if (coarsen_eligible) {
    status = status + 2.0;
  }
  if (refine_required) {
    status = status + 4.0;
  }
  if (residual_issue) {
    status = status + 16.0;
  }

  let coarsen_delta = 1.0 - aggregate_matching_count;
  let refine_delta = max(1.0, ceil(abs(level_delta))) - 1.0;
  let particle_count_delta = select(
    select(0.0, coarsen_delta, coarsen_eligible),
    refine_delta,
    refine_required
  );
  // Coarsen children carry the aggregated cell mass; refine children get
  // their mass divided from the source at materialization (zero here so the
  // divide-mass split path is unambiguous).
  let target_mass_kg = select(0.0, aggregate_mass_kg, coarsen_eligible && !refine_required);
  let target_volume_m3 = select(represented_volume_m3, aggregate_volume_m3, coarsen_eligible && !refine_required);

  apply_rows[apply_offset + 0u] = proposal_rows[proposal_offset + 0u];
  apply_rows[apply_offset + 1u] = proposal_rows[proposal_offset + 1u];
  apply_rows[apply_offset + 2u] = proposal_rows[proposal_offset + 2u];
  apply_rows[apply_offset + 3u] = status;
  apply_rows[apply_offset + 4u] = proposal_mode_id;
  apply_rows[apply_offset + 5u] = proposal_mode_id;
  apply_rows[apply_offset + 6u] = f32(params.admission_approved);
  apply_rows[apply_offset + 7u] = particle_count_delta;
  apply_rows[apply_offset + 8u] = 0.0;
  apply_rows[apply_offset + 9u] = target_mass_kg;
  apply_rows[apply_offset + 10u] = aggregate_mass_residual_kg;
  apply_rows[apply_offset + 11u] = 0.0;
  apply_rows[apply_offset + 12u] = target_volume_m3;
  apply_rows[apply_offset + 13u] = aggregate_volume_residual_m3;
  apply_rows[apply_offset + 14u] = proposal_rows[proposal_offset + 18u];
  apply_rows[apply_offset + 15u] = proposal_rows[proposal_offset + 19u];
  apply_rows[apply_offset + 16u] = proposal_rows[proposal_offset + 20u];
  apply_rows[apply_offset + 17u] = proposal_rows[proposal_offset + 21u];
  apply_rows[apply_offset + 18u] = rest_volume_m3;
  apply_rows[apply_offset + 19u] = represented_volume_m3;
  apply_rows[apply_offset + 20u] = phase_volume_ratio;
  apply_rows[apply_offset + 21u] = proposal_rows[proposal_offset + 12u];
  apply_rows[apply_offset + 22u] = aggregate_matching_count;
  apply_rows[apply_offset + 23u] = aggregate_mass_kg;
  apply_rows[apply_offset + 24u] = aggregate_volume_m3;
  apply_rows[apply_offset + 25u] = aggregate_mass_residual_kg;
  apply_rows[apply_offset + 26u] = aggregate_volume_residual_m3;
  apply_rows[apply_offset + 27u] = proposal_rows[proposal_offset + 22u];
  apply_rows[apply_offset + 28u] = proposal_rows[proposal_offset + 23u];
  apply_rows[apply_offset + 29u] = proposal_rows[proposal_offset + 26u];
  apply_rows[apply_offset + 30u] = params.apply_epoch;
  apply_rows[apply_offset + 31u] = params.state_family_id;
}
`;

export const schroederParticleStorageAllocationWgsl = `
struct SchroederParticleStorageAllocationParams {
  apply_row_count: u32,
  apply_stride: u32,
  allocation_stride: u32,
  admission_approved: u32,
  allocator_epoch: f32,
  state_family_id: f32,
  current_particle_capacity: f32,
  required_particle_capacity: f32,
  target_state_family_mask: f32,
  flags: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<storage, read> apply_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> allocation_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederParticleStorageAllocationParams;

const SCHROEDER_PSAL_APPLY_STRIDE: u32 = 32u;
const SCHROEDER_PSAL_ALLOCATION_STRIDE: u32 = 32u;

fn ss_psal_active_apply(apply_offset: u32) -> bool {
  let status = apply_rows[apply_offset + 3u];
  let apply_admission = apply_rows[apply_offset + 6u];
  return status > 0.0 && status < 32.0 && apply_admission > 0.0 && params.admission_approved > 0u;
}

fn ss_psal_coarsen_row(apply_offset: u32) -> bool {
  let status_bits = u32(max(apply_rows[apply_offset + 3u], 0.0));
  return (status_bits & 2u) != 0u && (status_bits & 4u) == 0u;
}

// Merge-group stamp eligibility: any merge-family row (status bit 2) whose
// apply row carries a valid aggregate node index. Broader than
// ss_psal_coarsen_row on purpose - rows that also carry bit 4 still belong
// to their merge group, and unstamped groups made the materializer fall
// back to leader-only mass (observed live as exact non-leader mass loss).
fn ss_psal_merge_group_stamp_row(apply_offset: u32) -> bool {
  let status_bits = u32(max(apply_rows[apply_offset + 3u], 0.0));
  return (status_bits & 2u) != 0u && apply_rows[apply_offset + 21u] >= 0.0;
}

struct SsPsalMergeGroup {
  member_count: u32,
  leader_source_index: f32,
};

// Exact same-cell merge-group scan over apply rows (aggregateNodeIndex at
// column 21). The lowest source particle index in the cell is the merge
// leader. O(rows^2) across the dispatch: the exact small-scene route, like
// the law-neighbor exact fallback; a sorted/keyed reduction is the
// escalation path for large row counts.
fn ss_psal_merge_group(apply_offset: u32, apply_stride: u32) -> SsPsalMergeGroup {
  let my_cell = apply_rows[apply_offset + 21u];
  var group = SsPsalMergeGroup(0u, apply_rows[apply_offset + 0u]);
  if (my_cell < 0.0) {
    return group;
  }
  for (var row = 0u; row < params.apply_row_count; row = row + 1u) {
    let other_offset = row * apply_stride;
    if (!ss_psal_active_apply(other_offset) || !ss_psal_coarsen_row(other_offset)) {
      continue;
    }
    if (apply_rows[other_offset + 21u] != my_cell) {
      continue;
    }
    group.member_count = group.member_count + 1u;
    group.leader_source_index = min(group.leader_source_index, apply_rows[other_offset + 0u]);
  }
  return group;
}

fn ss_psal_write_empty(allocation_offset: u32, apply_offset: u32, status: f32) {
  allocation_rows[allocation_offset + 0u] = apply_rows[apply_offset + 0u];
  allocation_rows[allocation_offset + 1u] = apply_rows[apply_offset + 1u];
  allocation_rows[allocation_offset + 2u] = apply_rows[apply_offset + 2u];
  allocation_rows[allocation_offset + 3u] = status;
  for (var column = 4u; column < SCHROEDER_PSAL_ALLOCATION_STRIDE; column = column + 1u) {
    allocation_rows[allocation_offset + column] = 0.0;
  }
  allocation_rows[allocation_offset + 6u] = f32(params.admission_approved);
  allocation_rows[allocation_offset + 9u] = -1.0;
  allocation_rows[allocation_offset + 11u] = -1.0;
  allocation_rows[allocation_offset + 13u] = params.required_particle_capacity;
  allocation_rows[allocation_offset + 14u] = params.current_particle_capacity;
  allocation_rows[allocation_offset + 29u] = params.allocator_epoch;
  allocation_rows[allocation_offset + 30u] = params.target_state_family_mask;
  allocation_rows[allocation_offset + 31u] = params.state_family_id;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.apply_row_count) {
    return;
  }

  let apply_stride = max(params.apply_stride, SCHROEDER_PSAL_APPLY_STRIDE);
  let allocation_stride = max(params.allocation_stride, SCHROEDER_PSAL_ALLOCATION_STRIDE);
  let apply_offset = row_index * apply_stride;
  let allocation_offset = row_index * allocation_stride;

  if (!ss_psal_active_apply(apply_offset)) {
    ss_psal_write_empty(allocation_offset, apply_offset, 32.0);
    return;
  }

  let particle_delta = apply_rows[apply_offset + 7u];
  var allocation_count = max(particle_delta, 0.0);
  var free_count = max(-particle_delta, 0.0);
  var divide_mass_split = false;
  let status_bits_self = u32(max(apply_rows[apply_offset + 3u], 0.0));
  if ((status_bits_self & 4u) != 0u) {
    // Mass-correct split: the source is replaced by (delta + 1) children,
    // each receiving source mass / child count at materialization, and the
    // source slot is freed. A zero-delta refine row keeps its particle.
    if (particle_delta >= 1.0) {
      allocation_count = particle_delta + 1.0;
      free_count = 1.0;
      divide_mass_split = true;
    } else {
      allocation_count = 0.0;
      free_count = 0.0;
    }
  } else if (ss_psal_coarsen_row(apply_offset)) {
    // Merge group semantics: exactly one leader per aggregate cell writes
    // the aggregated child (target mass/volume already carry the cell
    // aggregates), and every member, leader included, frees its own source
    // slot. Lone coarsen rows have nothing to merge with.
    let group = ss_psal_merge_group(apply_offset, apply_stride);
    if (group.member_count >= 2u) {
      let is_leader = apply_rows[apply_offset + 0u] == group.leader_source_index;
      allocation_count = select(0.0, 1.0, is_leader);
      free_count = 1.0;
    } else {
      allocation_count = 0.0;
      free_count = 0.0;
    }
  }
  let capacity_required_by_row = params.current_particle_capacity + allocation_count;
  let capacity_residual = max(capacity_required_by_row - params.required_particle_capacity, 0.0);
  let allocation_required = allocation_count > 0.0;
  let free_required = free_count > 0.0;

  var status = 1.0 + 8.0;
  if (allocation_required) {
    status = status + 2.0;
  }
  if (free_required) {
    status = status + 4.0;
  }
  if (capacity_residual > 0.0) {
    status = status + 16.0;
  }

  var slot_action_id = select(
    select(1.0, 3.0, allocation_required),
    2.0,
    free_required
  );
  if (divide_mass_split) {
    slot_action_id = 4.0;
  }

  allocation_rows[allocation_offset + 0u] = apply_rows[apply_offset + 0u];
  allocation_rows[allocation_offset + 1u] = apply_rows[apply_offset + 1u];
  allocation_rows[allocation_offset + 2u] = apply_rows[apply_offset + 2u];
  allocation_rows[allocation_offset + 3u] = status;
  allocation_rows[allocation_offset + 4u] = 1.0;
  allocation_rows[allocation_offset + 5u] = apply_rows[apply_offset + 4u];
  allocation_rows[allocation_offset + 6u] = f32(params.admission_approved);
  allocation_rows[allocation_offset + 7u] = particle_delta;
  allocation_rows[allocation_offset + 8u] = slot_action_id;
  allocation_rows[allocation_offset + 9u] = -1.0;
  allocation_rows[allocation_offset + 10u] = allocation_count;
  allocation_rows[allocation_offset + 11u] = -1.0;
  allocation_rows[allocation_offset + 12u] = free_count;
  allocation_rows[allocation_offset + 13u] = params.required_particle_capacity;
  allocation_rows[allocation_offset + 14u] = params.current_particle_capacity;
  allocation_rows[allocation_offset + 15u] = capacity_residual;
  allocation_rows[allocation_offset + 16u] = apply_rows[apply_offset + 8u];
  allocation_rows[allocation_offset + 17u] = apply_rows[apply_offset + 9u];
  // Coarsen rows repurpose the massResidual diagnostic column to carry the
  // merge-group cell id so the materializer can place merged children at
  // the group's mass-weighted centroid (first-moment conservation).
  allocation_rows[allocation_offset + 18u] = select(
    apply_rows[apply_offset + 10u],
    apply_rows[apply_offset + 21u],
    ss_psal_merge_group_stamp_row(apply_offset)
  );
  allocation_rows[allocation_offset + 19u] = apply_rows[apply_offset + 11u];
  allocation_rows[allocation_offset + 20u] = apply_rows[apply_offset + 12u];
  allocation_rows[allocation_offset + 21u] = apply_rows[apply_offset + 13u];
  allocation_rows[allocation_offset + 22u] = apply_rows[apply_offset + 14u];
  allocation_rows[allocation_offset + 23u] = apply_rows[apply_offset + 15u];
  allocation_rows[allocation_offset + 24u] = apply_rows[apply_offset + 16u];
  allocation_rows[allocation_offset + 25u] = apply_rows[apply_offset + 17u];
  allocation_rows[allocation_offset + 26u] = apply_rows[apply_offset + 21u];
  allocation_rows[allocation_offset + 27u] = apply_rows[apply_offset + 22u];
  allocation_rows[allocation_offset + 28u] = apply_rows[apply_offset + 29u];
  allocation_rows[allocation_offset + 29u] = params.allocator_epoch;
  allocation_rows[allocation_offset + 30u] = params.target_state_family_mask;
  allocation_rows[allocation_offset + 31u] = params.state_family_id;
}
`;

export const schroederParticleStorageSlotAssignmentWgsl = `
struct SchroederParticleStorageSlotAssignmentParams {
  allocation_row_count: u32,
  allocation_stride: u32,
  free_list_stride: u32,
  assignment_stride: u32,
  admission_approved: u32,
  flags: u32,
  assignment_epoch: f32,
  state_family_id: f32,
  target_state_family_mask: f32,
  max_slots_per_row: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<storage, read> allocation_rows: array<f32>;
@group(0) @binding(1) var<storage, read> free_list_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> assignment_rows: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederParticleStorageSlotAssignmentParams;

const SCHROEDER_PSSA_ALLOCATION_STRIDE: u32 = 32u;
const SCHROEDER_PSSA_FREE_LIST_STRIDE: u32 = 8u;
const SCHROEDER_PSSA_ASSIGNMENT_STRIDE: u32 = 32u;

fn ss_pssa_active_allocation(allocation_offset: u32) -> bool {
  let status = allocation_rows[allocation_offset + 3u];
  let allocation_admission = allocation_rows[allocation_offset + 6u];
  return status > 0.0 && status < 32.0 && allocation_admission > 0.0 && params.admission_approved > 0u;
}

// Per-WRITER slot compaction: the appended-slot window is consumed by rows
// that actually allocate targets, not by every row. The old row-indexed
// addressing (base + row_index * max_slots_per_row) silently refused writes
// for any writer whose ROW INDEX exceeded the free-list capacity while frees
// still executed - the torn-epoch mass-deletion source. O(rows) prefix per
// call; rows are bounded by the storage row budget (exact small-scene route).
fn ss_pssa_writer_slot_offset(row_index: u32, allocation_stride: u32) -> f32 {
  var offset = 0.0;
  for (var row = 0u; row < row_index; row = row + 1u) {
    let other = row * allocation_stride;
    if (!ss_pssa_active_allocation(other)) {
      continue;
    }
    offset = offset + max(allocation_rows[other + 10u], 0.0);
  }
  return offset;
}

fn ss_pssa_target_granted(row_index: u32, allocation_offset: u32, allocation_stride: u32) -> bool {
  let target_count = allocation_rows[allocation_offset + 10u];
  if (!(target_count > 0.0)) {
    return false;
  }
  let free_list_offset = 0u;
  let slot_capacity = free_list_rows[free_list_offset + 1u];
  let available_slot_count = free_list_rows[free_list_offset + 2u];
  let writer_offset = ss_pssa_writer_slot_offset(row_index, allocation_stride);
  return writer_offset + target_count <= slot_capacity
    && writer_offset + target_count <= available_slot_count;
}

// A merge participant may free its slot ONLY when its group's leader (the
// same-cell row that allocates the merged child) has a granted target.
// Frees without a written child delete mass; ungrouped free_required rows
// never free.
fn ss_pssa_free_allowed(
  row_index: u32,
  allocation_offset: u32,
  allocation_stride: u32,
  target_granted: bool
) -> bool {
  let free_count = allocation_rows[allocation_offset + 12u];
  if (!(free_count > 0.0)) {
    return false;
  }
  let slot_action = allocation_rows[allocation_offset + 8u];
  if (abs(slot_action - 2.0) >= 0.5) {
    // Non-merge frees (mass-correct splits free their own source alongside
    // their granted children) gate on this row's own grant when it writes.
    if (allocation_rows[allocation_offset + 10u] > 0.0) {
      return target_granted;
    }
    return true;
  }
  if (allocation_rows[allocation_offset + 10u] > 0.0) {
    // Merge leader: frees only alongside its granted child write.
    return target_granted;
  }
  let my_cell = allocation_rows[allocation_offset + 18u];
  if (my_cell < 0.0) {
    return false;
  }
  for (var row = 0u; row < params.allocation_row_count; row = row + 1u) {
    let other = row * allocation_stride;
    if (!ss_pssa_active_allocation(other)) {
      continue;
    }
    if (abs(allocation_rows[other + 8u] - 2.0) >= 0.5) {
      continue;
    }
    if (allocation_rows[other + 18u] != my_cell) {
      continue;
    }
    if (!(allocation_rows[other + 10u] > 0.0)) {
      continue;
    }
    if (ss_pssa_target_granted(row, other, allocation_stride)) {
      return true;
    }
  }
  return false;
}

fn ss_pssa_write_empty(assignment_offset: u32, allocation_offset: u32, free_list_offset: u32, status: f32) {
  assignment_rows[assignment_offset + 0u] = allocation_rows[allocation_offset + 0u];
  assignment_rows[assignment_offset + 1u] = allocation_rows[allocation_offset + 1u];
  assignment_rows[assignment_offset + 2u] = allocation_rows[allocation_offset + 2u];
  assignment_rows[assignment_offset + 3u] = status;
  for (var column = 4u; column < SCHROEDER_PSSA_ASSIGNMENT_STRIDE; column = column + 1u) {
    assignment_rows[assignment_offset + column] = 0.0;
  }
  assignment_rows[assignment_offset + 6u] = f32(params.admission_approved);
  assignment_rows[assignment_offset + 9u] = -1.0;
  assignment_rows[assignment_offset + 11u] = -1.0;
  assignment_rows[assignment_offset + 13u] = free_list_rows[free_list_offset + 0u];
  assignment_rows[assignment_offset + 14u] = free_list_rows[free_list_offset + 1u];
  assignment_rows[assignment_offset + 15u] = free_list_rows[free_list_offset + 2u];
  assignment_rows[assignment_offset + 29u] = params.assignment_epoch;
  assignment_rows[assignment_offset + 30u] = params.target_state_family_mask;
  assignment_rows[assignment_offset + 31u] = params.state_family_id;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.allocation_row_count) {
    return;
  }

  let allocation_stride = max(params.allocation_stride, SCHROEDER_PSSA_ALLOCATION_STRIDE);
  let free_list_stride = max(params.free_list_stride, SCHROEDER_PSSA_FREE_LIST_STRIDE);
  let assignment_stride = max(params.assignment_stride, SCHROEDER_PSSA_ASSIGNMENT_STRIDE);
  let allocation_offset = row_index * allocation_stride;
  let free_list_offset = 0u * free_list_stride;
  let assignment_offset = row_index * assignment_stride;

  if (!ss_pssa_active_allocation(allocation_offset)) {
    ss_pssa_write_empty(assignment_offset, allocation_offset, free_list_offset, 32.0);
    return;
  }

  let base_slot = free_list_rows[free_list_offset + 0u];
  let slot_capacity = free_list_rows[free_list_offset + 1u];
  let available_slot_count = free_list_rows[free_list_offset + 2u];
  let target_count = allocation_rows[allocation_offset + 10u];
  let free_count = allocation_rows[allocation_offset + 12u];
  let allocation_capacity_residual = allocation_rows[allocation_offset + 15u];
  let writer_slot_offset = ss_pssa_writer_slot_offset(row_index, allocation_stride);
  let row_slot_start = base_slot + writer_slot_offset;
  let target_slot_residual = max((writer_slot_offset + target_count) - slot_capacity, 0.0);
  let available_slot_residual = max((writer_slot_offset + target_count) - available_slot_count, 0.0);
  let target_granted = target_count > 0.0
    && target_slot_residual <= 0.0
    && available_slot_residual <= 0.0;
  let target_start = select(-1.0, row_slot_start, target_granted);
  let free_allowed = ss_pssa_free_allowed(row_index, allocation_offset, allocation_stride, target_granted);
  let free_start = select(-1.0, allocation_rows[allocation_offset + 0u], free_allowed);

  var status = 1.0 + 8.0;
  if (target_count > 0.0 && target_start >= 0.0) {
    status = status + 2.0;
  }
  let effective_free_count = select(0.0, free_count, free_allowed);
  if (effective_free_count > 0.0 && free_start >= 0.0) {
    status = status + 4.0;
  }
  if (target_slot_residual > 0.0 || available_slot_residual > 0.0 || allocation_capacity_residual > 0.0) {
    status = status + 16.0;
  }

  assignment_rows[assignment_offset + 0u] = allocation_rows[allocation_offset + 0u];
  assignment_rows[assignment_offset + 1u] = allocation_rows[allocation_offset + 1u];
  assignment_rows[assignment_offset + 2u] = allocation_rows[allocation_offset + 2u];
  assignment_rows[assignment_offset + 3u] = status;
  assignment_rows[assignment_offset + 4u] = 1.0;
  assignment_rows[assignment_offset + 5u] = allocation_rows[allocation_offset + 4u];
  assignment_rows[assignment_offset + 6u] = f32(params.admission_approved);
  assignment_rows[assignment_offset + 7u] = allocation_rows[allocation_offset + 7u];
  assignment_rows[assignment_offset + 8u] = allocation_rows[allocation_offset + 8u];
  assignment_rows[assignment_offset + 9u] = target_start;
  assignment_rows[assignment_offset + 10u] = target_count;
  assignment_rows[assignment_offset + 11u] = free_start;
  assignment_rows[assignment_offset + 12u] = effective_free_count;
  assignment_rows[assignment_offset + 13u] = base_slot;
  assignment_rows[assignment_offset + 14u] = slot_capacity;
  assignment_rows[assignment_offset + 15u] = available_slot_count;
  assignment_rows[assignment_offset + 16u] = allocation_capacity_residual;
  assignment_rows[assignment_offset + 17u] = max(target_slot_residual, available_slot_residual);
  assignment_rows[assignment_offset + 18u] = allocation_rows[allocation_offset + 16u];
  assignment_rows[assignment_offset + 19u] = allocation_rows[allocation_offset + 17u];
  assignment_rows[assignment_offset + 20u] = allocation_rows[allocation_offset + 18u];
  assignment_rows[assignment_offset + 21u] = allocation_rows[allocation_offset + 19u];
  assignment_rows[assignment_offset + 22u] = allocation_rows[allocation_offset + 20u];
  assignment_rows[assignment_offset + 23u] = allocation_rows[allocation_offset + 21u];
  assignment_rows[assignment_offset + 24u] = allocation_rows[allocation_offset + 22u];
  assignment_rows[assignment_offset + 25u] = allocation_rows[allocation_offset + 23u];
  assignment_rows[assignment_offset + 26u] = allocation_rows[allocation_offset + 24u];
  assignment_rows[assignment_offset + 27u] = allocation_rows[allocation_offset + 25u];
  assignment_rows[assignment_offset + 28u] = allocation_rows[allocation_offset + 28u];
  assignment_rows[assignment_offset + 29u] = params.assignment_epoch;
  assignment_rows[assignment_offset + 30u] = params.target_state_family_mask;
  assignment_rows[assignment_offset + 31u] = params.state_family_id;
}
`;

export const schroederParticleStorageMaterializationWgsl = `
struct SchroederParticleStorageMaterializationParams {
  assignment_row_count: u32,
  assignment_stride: u32,
  source_particle_count: u32,
  output_particle_capacity: u32,
  state_vec4_stride: u32,
  thermo_vec4_stride: u32,
  mechanics_vec4_stride: u32,
  materialization_stride: u32,
  admission_approved: u32,
  flags: u32,
  materialization_epoch: f32,
  state_family_id: f32,
  target_state_family_mask: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> assignment_rows: array<f32>;
@group(0) @binding(1) var<storage, read> source_sph_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_sph_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> source_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> out_sph_state: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> out_sph_thermo: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> out_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> materialization_rows: array<f32>;
@group(0) @binding(8) var<uniform> params: SchroederParticleStorageMaterializationParams;
@group(0) @binding(9) var<storage, read> source_particle_identity: array<u32>;
@group(0) @binding(10) var<storage, read_write> out_particle_identity: array<u32>;

const SCHROEDER_PSM_ASSIGNMENT_STRIDE: u32 = 32u;
const SCHROEDER_PSM_MATERIALIZATION_STRIDE: u32 = 32u;
const SCHROEDER_PSM_STATE_VEC4_STRIDE: u32 = 2u;
const SCHROEDER_PSM_THERMO_VEC4_STRIDE: u32 = 3u;
const SCHROEDER_PSM_MECHANICS_VEC4_STRIDE: u32 = 8u;

fn ss_psm_stride(value: u32, fallback: u32) -> u32 {
  return max(value, fallback);
}

fn ss_psm_index(value: f32) -> u32 {
  return u32(max(floor(value), 0.0));
}

// A merged particle can carry only one structural render-domain id. Never
// collapse particles from different initial bodies into a child whose domain
// would depend on which assignment row happened to lead the group.
fn ss_psm_merge_identity_compatible(
  assignment_offset: u32,
  source_index: u32,
  target_count: u32,
  free_start_value: f32,
  free_start: u32,
  free_count: u32
) -> bool {
  let assignment_action = assignment_rows[assignment_offset + 8u];
  let assignment_stride = ss_psm_stride(
    params.assignment_stride,
    SCHROEDER_PSM_ASSIGNMENT_STRIDE
  );
  var has_identity = false;
  var expected_identity = 0u;
  if (source_index < params.source_particle_count) {
    expected_identity = source_particle_identity[source_index];
    has_identity = true;
  }

  if (assignment_action == 2.0 && assignment_rows[assignment_offset + 20u] >= 0.0) {
    let merge_cell = assignment_rows[assignment_offset + 20u];
    for (var row = 0u; row < params.assignment_row_count; row = row + 1u) {
      let other_offset = row * assignment_stride;
      if (assignment_rows[other_offset + 8u] != 2.0
          || assignment_rows[other_offset + 20u] != merge_cell
          || assignment_rows[other_offset + 11u] < 0.0
          || !(assignment_rows[other_offset + 12u] > 0.0)) {
        continue;
      }
      let member_index = ss_psm_index(assignment_rows[other_offset + 0u]);
      if (member_index >= params.source_particle_count) {
        continue;
      }
      let member_identity = source_particle_identity[member_index];
      if (has_identity && member_identity != expected_identity) {
        return false;
      }
      expected_identity = member_identity;
      has_identity = true;
    }
  }

  // The alternate leader-plus-freed-range merge encoding has no per-member
  // action-2 rows. A one-child write that frees a range is compatible only
  // when every consumed source slot belongs to the leader's domain.
  if (target_count == 1u && free_start_value >= 0.0 && free_count > 0u) {
    for (var slot = 0u; slot < free_count; slot = slot + 1u) {
      let member_index = free_start + slot;
      if (member_index >= params.source_particle_count) {
        continue;
      }
      let member_identity = source_particle_identity[member_index];
      if (has_identity && member_identity != expected_identity) {
        return false;
      }
      expected_identity = member_identity;
      has_identity = true;
    }
  }
  return true;
}

fn ss_psm_target_mass(assignment_offset: u32, source_mass: f32) -> f32 {
  let target_mass = assignment_rows[assignment_offset + 19u];
  return select(source_mass, max(target_mass, 0.0), target_mass > 0.0);
}

fn ss_psm_source_represented_volume(source_index: u32, mechanics_stride: u32) -> f32 {
  if (source_index >= params.source_particle_count) {
    return 0.0;
  }
  let mechanics_base = source_index * mechanics_stride;
  let row4 = source_mls_mechanics[mechanics_base + 4u];
  return max(row4.z, 0.0) * max(row4.w, 0.0);
}

// Mass-weighted centroid of a merge group: merged children must conserve
// the FIRST MOMENT of the mass distribution (like momentum and thermal
// energy), not inherit the leader's position - leader placement relocates
// the whole group's mass to one member and visibly teleports matter when
// merge cells are large. Merge participants (slot action 2) carry their
// aggregate cell id in assignment column 20 (stamped by the allocation
// kernel over the massResidual diagnostic for coarsen rows only), so the
// group is recovered with the same exact same-cell scan the allocator
// used. Returns sum(m*x) in xyz and sum(m) in w; w <= 0 means no valid
// multi-member group and the caller keeps the leader position.
// F occupies vec4[0].xyzw, vec4[1].xyzw and vec4[2].x. Any producer that
// changes J must move F with it or det(F) == J stops holding.
fn ss_psm_deformation_determinant(
  row0: vec4<f32>, row1: vec4<f32>, row2: vec4<f32>
) -> f32 {
  let f00 = row0.x; let f01 = row0.y; let f02 = row0.z; let f10 = row0.w;
  let f11 = row1.x; let f12 = row1.y; let f20 = row1.z; let f21 = row1.w;
  let f22 = row2.x;
  return f00 * (f11 * f22 - f12 * f21)
    - f01 * (f10 * f22 - f12 * f20)
    + f02 * (f10 * f21 - f11 * f20);
}

// Isotropic rescale to a target determinant. Preserves the source's shape and
// anisotropy while restoring det(F) == J exactly enough for the admission
// checks that follow.
fn ss_psm_deformation_scale_for(current_det: f32, target_det: f32) -> f32 {
  if (!(current_det > 0.0) || !(target_det > 0.0)) { return 1.0; }
  let ratio = target_det / current_det;
  if (!(ratio > 0.0) || ratio != ratio) { return 1.0; }
  return pow(ratio, 1.0 / 3.0);
}

struct SsPsmMergeGroup {
  moment: vec3<f32>,
  mass: f32,
  momentum: vec3<f32>,
  mass_temperature: f32,
  // Latent heat lives in the phase fractions, not in temperature. Merging on
  // mass-weighted temperature alone conserves energy only when every member
  // shares one heat capacity and no member straddles a plateau, which is
  // exactly the case Slice 9 exists to handle. Carry the mass-weighted
  // fractions so a liquid+gas merge cannot create or destroy latent heat.
  mass_phase_fractions: vec4<f32>,
  // Represented current volume is the geometry authority: V_current = V0 * J.
  // Merges must conserve its sum rather than re-derive a child size from
  // mass / restDensity, which mints geometry the deformation state never had.
  current_volume: f32,
  rest_volume: f32,
  member_count: u32,
};

fn ss_psm_merge_group(assignment_offset: u32, state_stride: u32, thermo_stride: u32, mechanics_stride: u32) -> SsPsmMergeGroup {
  var group = SsPsmMergeGroup(vec3<f32>(0.0), 0.0, vec3<f32>(0.0), 0.0, vec4<f32>(0.0), 0.0, 0.0, 0u);
  if (assignment_rows[assignment_offset + 8u] != 2.0) {
    return group;
  }
  let my_cell = assignment_rows[assignment_offset + 20u];
  if (my_cell < 0.0) {
    return group;
  }
  let stride = ss_psm_stride(params.assignment_stride, SCHROEDER_PSM_ASSIGNMENT_STRIDE);
  for (var row = 0u; row < params.assignment_row_count; row = row + 1u) {
    let other_offset = row * stride;
    if (assignment_rows[other_offset + 8u] != 2.0) {
      continue;
    }
    if (assignment_rows[other_offset + 20u] != my_cell) {
      continue;
    }
    // Conservation join: only members whose FREE was actually granted count
    // toward the merged child. A member whose free was denied keeps its
    // slot and its mass; including it would create mass out of nothing
    // (observed live: children carrying full aggregate-stamp mass while
    // only some members freed, +88 kg on the boiling proof scene).
    if (assignment_rows[other_offset + 11u] < 0.0 || !(assignment_rows[other_offset + 12u] > 0.0)) {
      continue;
    }
    let member_index = u32(max(assignment_rows[other_offset + 0u], 0.0));
    if (member_index >= params.source_particle_count) {
      continue;
    }
    let member_state = source_sph_state[member_index * state_stride];
    let member_velocity = source_sph_state[member_index * state_stride + 1u];
    let member_temperature = source_sph_thermo[member_index * thermo_stride].z;
    let member_fractions = source_sph_thermo[member_index * thermo_stride + 1u];
    let member_mass = max(member_state.w, 0.0);
    group.moment = group.moment + member_state.xyz * member_mass;
    group.momentum = group.momentum + member_velocity.xyz * member_mass;
    group.mass_temperature = group.mass_temperature + max(member_temperature, 0.0) * member_mass;
    group.mass_phase_fractions =
      group.mass_phase_fractions + member_fractions * member_mass;
    let member_row4 = source_mls_mechanics[member_index * mechanics_stride + 4u];
    let member_rest_volume = max(member_row4.w, 0.0);
    let member_volume_ratio = max(member_row4.z, 0.0);
    group.rest_volume = group.rest_volume + member_rest_volume;
    group.current_volume =
      group.current_volume + member_rest_volume * member_volume_ratio;
    group.mass = group.mass + member_mass;
    group.member_count = group.member_count + 1u;
  }
  if (group.member_count < 2u || group.mass <= 0.0) {
    return SsPsmMergeGroup(vec3<f32>(0.0), 0.0, vec3<f32>(0.0), 0.0, vec4<f32>(0.0), 0.0, 0.0, 0u);
  }
  return group;
}

fn ss_psm_copy_particle(
  source_index: u32,
  target_index: u32,
  assignment_offset: u32,
  child_ordinal: u32,
  child_count: u32,
  freed_group: SsPsmMergeGroup,
  freed_includes_source: bool
) -> f32 {
  if (source_index >= params.source_particle_count || target_index >= params.output_particle_capacity) {
    return 0.0;
  }
  let state_stride = ss_psm_stride(params.state_vec4_stride, SCHROEDER_PSM_STATE_VEC4_STRIDE);
  let thermo_stride = ss_psm_stride(params.thermo_vec4_stride, SCHROEDER_PSM_THERMO_VEC4_STRIDE);
  let mechanics_stride = ss_psm_stride(params.mechanics_vec4_stride, SCHROEDER_PSM_MECHANICS_VEC4_STRIDE);
  let source_state_base = source_index * state_stride;
  let target_state_base = target_index * state_stride;
  let source_thermo_base = source_index * thermo_stride;
  let target_thermo_base = target_index * thermo_stride;
  let source_mechanics_base = source_index * mechanics_stride;
  let target_mechanics_base = target_index * mechanics_stride;

  let state0 = source_sph_state[source_state_base];
  let state1 = source_sph_state[source_state_base + 1u];
  // Slot action 4 is the mass-correct split: children divide the source
  // mass and represented volume evenly and are jittered deterministically
  // inside the child length scale so they do not stack.
  let divide_mass_split = assignment_rows[assignment_offset + 8u] == 4.0
    && child_count > 0u;
  let divisor = f32(max(child_count, 1u));
  // Merge (action 2) writes derive mass from the granted-free group scan or
  // degrade to a pure move of the leader; the aggregate target-mass stamp is
  // never authoritative for merges (it describes the whole aggregate cell,
  // not the members actually freed this epoch).
  let is_merge_write = assignment_rows[assignment_offset + 8u] == 2.0;
  var child_mass = state0.w;
  if (!is_merge_write) {
    child_mass = ss_psm_target_mass(assignment_offset, state0.w);
  }
  var child_position = state0.xyz;
  // Live merge-group scan: mass, first moment, momentum, and thermal energy
  // summed over the group members from the SOURCE buffers the materializer
  // itself copies from. This conserves all four invariants even when the
  // aggregate stamps (assignment cols 19/22/24-27) read zero because the
  // aggregate stage bound a superseded buffer (observed live: merges lost
  // exactly the non-leader members' mass).
  var merge_group = SsPsmMergeGroup(vec3<f32>(0.0), 0.0, vec3<f32>(0.0), 0.0, vec4<f32>(0.0), 0.0, 0.0, 0u);
  if (!divide_mass_split) {
    merge_group = ss_psm_merge_group(
      assignment_offset, state_stride, thermo_stride, mechanics_stride
    );
  }
  var merge_group_valid = merge_group.member_count >= 2u && merge_group.mass > 0.0;
  // Leader-with-freed-range merge encoding: one assignment row writes the
  // child and frees the merged-away members' source slots. When no action-2
  // participant rows exist, the freed range IS the merge group; combine it
  // with the leader (unless the leader's own slot is inside the range) so
  // mass, first moment, momentum, and thermal energy are conserved.
  if (!merge_group_valid && !divide_mass_split && child_count == 1u && freed_group.mass > 0.0) {
    var combined = freed_group;
    if (!freed_includes_source) {
      let leader_mass = max(state0.w, 0.0);
      let leader_velocity = source_sph_state[source_state_base + 1u];
      let leader_temperature = source_sph_thermo[source_thermo_base].z;
      combined.moment = combined.moment + state0.xyz * leader_mass;
      combined.momentum = combined.momentum + leader_velocity.xyz * leader_mass;
      combined.mass_temperature = combined.mass_temperature + max(leader_temperature, 0.0) * leader_mass;
      combined.mass = combined.mass + leader_mass;
      combined.member_count = combined.member_count + 1u;
    }
    if (combined.member_count >= 2u && combined.mass > 0.0) {
      merge_group = combined;
      merge_group_valid = true;
    }
  }
  if (divide_mass_split) {
    child_mass = max(state0.w, 0.0) / divisor;
    let child_volume = max(assignment_rows[assignment_offset + 22u], 0.0) / divisor;
    let child_scale = pow(max(child_volume, 1.0e-18), 0.3333333333333333);
    let corner = vec3<f32>(
      f32(child_ordinal & 1u) * 2.0 - 1.0,
      f32((child_ordinal >> 1u) & 1u) * 2.0 - 1.0,
      f32((child_ordinal >> 2u) & 1u) * 2.0 - 1.0
    );
    child_position = state0.xyz + 0.25 * child_scale * corner;
  }
  if (merge_group_valid) {
    child_mass = merge_group.mass;
    child_position = merge_group.moment / merge_group.mass;
  }
  out_sph_state[target_state_base] = vec4<f32>(
    child_position.x,
    child_position.y,
    child_position.z,
    child_mass
  );
  // Momentum-conserving merge: when the assignment row carries the cell
  // momentum (columns 24-26), the child velocity is momentum / child mass
  // instead of the merge leader's velocity. Cells with exactly zero total
  // momentum keep the leader velocity; that residual is bounded by the
  // leader speed and only occurs at measure-zero symmetric states.
  let target_momentum = vec3<f32>(
    assignment_rows[assignment_offset + 24u],
    assignment_rows[assignment_offset + 25u],
    assignment_rows[assignment_offset + 26u]
  );
  let momentum_provided = child_mass > 0.0
    && !divide_mass_split
    && !is_merge_write
    && (target_momentum.x != 0.0 || target_momentum.y != 0.0 || target_momentum.z != 0.0);
  if (merge_group_valid) {
    out_sph_state[target_state_base + 1u] = vec4<f32>(merge_group.momentum / merge_group.mass, state1.w);
  } else if (momentum_provided) {
    out_sph_state[target_state_base + 1u] = vec4<f32>(target_momentum / child_mass, state1.w);
  } else {
    out_sph_state[target_state_base + 1u] = state1;
  }

  let thermo0 = source_sph_thermo[source_thermo_base];
  let thermo1 = source_sph_thermo[source_thermo_base + 1u];
  let thermo2 = source_sph_thermo[source_thermo_base + 2u];
  // Merged child temperature: the assignment row's internal-energy column
  // carries the cell's summed mass*T, so T_child = sum(m*T) / child mass is
  // the mass-weighted average (exact thermal-energy conservation under the
  // cell's uniform heat capacity). Splits and rows without the sum keep the
  // source temperature, which conserves energy by construction.
  let cell_mass_temperature = assignment_rows[assignment_offset + 27u];
  var child_temperature = thermo0.z;
  if (merge_group_valid) {
    child_temperature = merge_group.mass_temperature / merge_group.mass;
  } else if (!divide_mass_split && !is_merge_write && cell_mass_temperature > 0.0 && child_mass > 0.0) {
    child_temperature = cell_mass_temperature / child_mass;
  }
  // Represented entity count scales with the mass ratio: uniform
  // composition means entities are proportional to mass for merges and
  // splits alike.
  let source_mass = max(state0.w, 1.0e-18);
  let entity_scale = child_mass / source_mass;
  out_sph_thermo[target_thermo_base] = vec4<f32>(
    thermo0.x,
    thermo0.y,
    child_temperature,
    thermo0.w
  );
  // A merged child carries the group's mass-weighted phase fractions. Copying
  // the leader's row instead would hand the child one member's latent-heat
  // state and silently rebalance the group's internal energy.
  var child_fractions = thermo1;
  if (merge_group_valid && merge_group.mass > 0.0) {
    child_fractions = merge_group.mass_phase_fractions / merge_group.mass;
  }
  out_sph_thermo[target_thermo_base + 1u] = child_fractions;
  out_sph_thermo[target_thermo_base + 2u] = vec4<f32>(
    thermo2.x,
    thermo2.y * entity_scale,
    max(thermo2.z, 1.0),
    thermo2.w
  );

  // Deformation rows are published after row4 below, once the child's J is
  // known, so det(F) == J holds for whatever this write publishes.
  let source_f0 = source_mls_mechanics[source_mechanics_base];
  let source_f1 = source_mls_mechanics[source_mechanics_base + 1u];
  let source_f2 = source_mls_mechanics[source_mechanics_base + 2u];
  out_mls_mechanics[target_mechanics_base + 3u] = source_mls_mechanics[source_mechanics_base + 3u];
  var row4 = source_mls_mechanics[source_mechanics_base + 4u];
  var target_rest_volume = row4.w;
  var target_volume_ratio = row4.z;
  if (divide_mass_split) {
    // A split divides the represented body, not its deformation state. Divide
    // the rest volume and keep J, so sum(V0 * J) is conserved exactly and F
    // still satisfies det(F) == J with no rescale at all.
    target_rest_volume = row4.w / divisor;
  } else if (merge_group_valid
      && merge_group.rest_volume > 0.0
      && merge_group.current_volume > 0.0) {
    // A merge conserves the group's represented current volume. Deriving the
    // child from mass / restDensity instead would mint geometry that no
    // member's deformation state ever had.
    target_rest_volume = merge_group.rest_volume;
    target_volume_ratio = merge_group.current_volume / merge_group.rest_volume;
  }
  if (target_rest_volume > 0.0 && target_volume_ratio > 0.0) {
    row4 = vec4<f32>(
      row4.x,
      row4.y,
      max(target_volume_ratio, 1.0e-9),
      target_rest_volume
    );
  }
  out_mls_mechanics[target_mechanics_base + 4u] = row4;
  let source_determinant =
    ss_psm_deformation_determinant(source_f0, source_f1, source_f2);
  let deformation_scale =
    ss_psm_deformation_scale_for(source_determinant, row4.z);
  out_mls_mechanics[target_mechanics_base] = source_f0 * deformation_scale;
  out_mls_mechanics[target_mechanics_base + 1u] = vec4<f32>(
    source_f1.xyz * deformation_scale,
    source_f1.w * deformation_scale
  );
  out_mls_mechanics[target_mechanics_base + 2u] = vec4<f32>(
    source_f2.x * deformation_scale,
    source_f2.y,
    source_f2.z,
    source_f2.w
  );
  out_mls_mechanics[target_mechanics_base + 5u] = source_mls_mechanics[source_mechanics_base + 5u];
  out_mls_mechanics[target_mechanics_base + 6u] = source_mls_mechanics[source_mechanics_base + 6u];
  out_mls_mechanics[target_mechanics_base + 7u] = source_mls_mechanics[source_mechanics_base + 7u];
  out_particle_identity[target_index] = source_particle_identity[source_index];
  return 1.0;
}

fn ss_psm_free_particle(source_index: u32) -> f32 {
  if (source_index >= params.source_particle_count) {
    return 0.0;
  }
  let state_stride = ss_psm_stride(params.state_vec4_stride, SCHROEDER_PSM_STATE_VEC4_STRIDE);
  let thermo_stride = ss_psm_stride(params.thermo_vec4_stride, SCHROEDER_PSM_THERMO_VEC4_STRIDE);
  let mechanics_stride = ss_psm_stride(params.mechanics_vec4_stride, SCHROEDER_PSM_MECHANICS_VEC4_STRIDE);
  let state_base = source_index * state_stride;
  let thermo_base = source_index * thermo_stride;
  let mechanics_base = source_index * mechanics_stride;
  let state0 = out_sph_state[state_base];
  out_sph_state[state_base] = vec4<f32>(state0.x, state0.y, state0.z, 0.0);
  out_sph_state[state_base + 1u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  let thermo2 = out_sph_thermo[thermo_base + 2u];
  // A freed lane represents no material. Retaining its entity count would
  // double-count the merged members beside the newly materialized child.
  out_sph_thermo[thermo_base + 2u] = vec4<f32>(thermo2.x, 0.0, 0.0, thermo2.w);
  let row4 = out_mls_mechanics[mechanics_base + 4u];
  out_mls_mechanics[mechanics_base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
  let row5 = out_mls_mechanics[mechanics_base + 5u];
  out_mls_mechanics[mechanics_base + 5u] = vec4<f32>(row5.x, 0.0, row5.z, row5.w);
  out_particle_identity[source_index] = 0u;
  return 1.0;
}

fn ss_psm_write_empty(materialization_offset: u32, assignment_offset: u32, status: f32) {
  materialization_rows[materialization_offset + 0u] = assignment_rows[assignment_offset + 0u];
  materialization_rows[materialization_offset + 1u] = assignment_rows[assignment_offset + 1u];
  materialization_rows[materialization_offset + 2u] = assignment_rows[assignment_offset + 2u];
  materialization_rows[materialization_offset + 3u] = status;
  for (var column = 4u; column < SCHROEDER_PSM_MATERIALIZATION_STRIDE; column = column + 1u) {
    materialization_rows[materialization_offset + column] = 0.0;
  }
  materialization_rows[materialization_offset + 6u] = f32(params.admission_approved);
  materialization_rows[materialization_offset + 8u] = assignment_rows[assignment_offset + 9u];
  materialization_rows[materialization_offset + 10u] = assignment_rows[assignment_offset + 11u];
  materialization_rows[materialization_offset + 25u] = params.target_state_family_mask;
  materialization_rows[materialization_offset + 26u] = assignment_rows[assignment_offset + 28u];
  materialization_rows[materialization_offset + 27u] = params.materialization_epoch;
  materialization_rows[materialization_offset + 28u] = params.state_family_id;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.assignment_row_count) {
    return;
  }

  let assignment_stride = ss_psm_stride(params.assignment_stride, SCHROEDER_PSM_ASSIGNMENT_STRIDE);
  let materialization_stride = ss_psm_stride(
    params.materialization_stride,
    SCHROEDER_PSM_MATERIALIZATION_STRIDE
  );
  let assignment_offset = row_index * assignment_stride;
  let materialization_offset = row_index * materialization_stride;
  let assignment_status = assignment_rows[assignment_offset + 3u];
  let assignment_admission = assignment_rows[assignment_offset + 6u];

  if (assignment_status <= 0.0 || assignment_status >= 32.0 || assignment_admission <= 0.0 || params.admission_approved == 0u) {
    ss_psm_write_empty(materialization_offset, assignment_offset, 32.0);
    return;
  }

  let source_index = ss_psm_index(assignment_rows[assignment_offset + 0u]);
  let target_start_value = assignment_rows[assignment_offset + 9u];
  let target_count = ss_psm_index(assignment_rows[assignment_offset + 10u]);
  let free_start_value = assignment_rows[assignment_offset + 11u];
  let free_count = ss_psm_index(assignment_rows[assignment_offset + 12u]);
  let target_start = ss_psm_index(target_start_value);
  let free_start = ss_psm_index(free_start_value);

  if (!ss_psm_merge_identity_compatible(
      assignment_offset,
      source_index,
      target_count,
      free_start_value,
      free_start,
      free_count
  )) {
    ss_psm_write_empty(materialization_offset, assignment_offset, 64.0);
    return;
  }

  // Freed-range conservation sums: the slots this row will free are the
  // merged-away members; their SOURCE state is still intact here (frees
  // zero the OUT buffers), so the child copy can conserve their mass,
  // first moment, momentum, and thermal energy.
  let freed_state_stride = ss_psm_stride(params.state_vec4_stride, SCHROEDER_PSM_STATE_VEC4_STRIDE);
  let freed_thermo_stride = ss_psm_stride(params.thermo_vec4_stride, SCHROEDER_PSM_THERMO_VEC4_STRIDE);
  var freed_group = SsPsmMergeGroup(vec3<f32>(0.0), 0.0, vec3<f32>(0.0), 0.0, vec4<f32>(0.0), 0.0, 0.0, 0u);
  var freed_includes_source = false;
  if (free_start_value >= 0.0 && free_count > 0u) {
    for (var slot = 0u; slot < free_count; slot = slot + 1u) {
      let member_index = free_start + slot;
      if (member_index >= params.source_particle_count) {
        continue;
      }
      if (member_index == source_index) {
        freed_includes_source = true;
      }
      let member_state = source_sph_state[member_index * freed_state_stride];
      let member_velocity = source_sph_state[member_index * freed_state_stride + 1u];
      let member_temperature = source_sph_thermo[member_index * freed_thermo_stride].z;
      let member_mass = max(member_state.w, 0.0);
      freed_group.moment = freed_group.moment + member_state.xyz * member_mass;
      freed_group.momentum = freed_group.momentum + member_velocity.xyz * member_mass;
      freed_group.mass_temperature = freed_group.mass_temperature + max(member_temperature, 0.0) * member_mass;
      freed_group.mass = freed_group.mass + member_mass;
      freed_group.member_count = freed_group.member_count + 1u;
    }
  }

  var written_target_count = 0.0;
  if (target_start_value >= 0.0 && target_count > 0u) {
    for (var slot = 0u; slot < target_count; slot = slot + 1u) {
      written_target_count = written_target_count + ss_psm_copy_particle(
        source_index,
        target_start + slot,
        assignment_offset,
        slot,
        target_count,
        freed_group,
        freed_includes_source
      );
    }
  }

  var freed_source_count = 0.0;
  if (free_start_value >= 0.0 && free_count > 0u) {
    for (var slot = 0u; slot < free_count; slot = slot + 1u) {
      freed_source_count = freed_source_count + ss_psm_free_particle(free_start + slot);
    }
  }

  var status = 1.0 + 8.0;
  if (written_target_count > 0.0) {
    status = status + 2.0;
  }
  if (freed_source_count > 0.0) {
    status = status + 4.0;
  }
  if (assignment_rows[assignment_offset + 16u] > 0.0 || assignment_rows[assignment_offset + 17u] > 0.0) {
    status = status + 16.0;
  }

  let state_stride = ss_psm_stride(params.state_vec4_stride, SCHROEDER_PSM_STATE_VEC4_STRIDE);
  let thermo_stride = ss_psm_stride(params.thermo_vec4_stride, SCHROEDER_PSM_THERMO_VEC4_STRIDE);
  let mechanics_stride = ss_psm_stride(params.mechanics_vec4_stride, SCHROEDER_PSM_MECHANICS_VEC4_STRIDE);
  var source_mass = 0.0;
  var source_status = 0.0;
  if (source_index < params.source_particle_count) {
    source_mass = source_sph_state[source_index * state_stride].w;
    source_status = source_sph_thermo[source_index * thermo_stride + 2u].z;
  }
  let source_volume = ss_psm_source_represented_volume(source_index, mechanics_stride);
  let target_volume = assignment_rows[assignment_offset + 22u];
  var target_volume_ratio = 0.0;
  if (source_index < params.source_particle_count) {
    let row4 = source_mls_mechanics[source_index * mechanics_stride + 4u];
    if (target_volume > 0.0 && row4.w > 0.0) {
      target_volume_ratio = target_volume / row4.w;
    } else {
      target_volume_ratio = row4.z;
    }
  }

  materialization_rows[materialization_offset + 0u] = assignment_rows[assignment_offset + 0u];
  materialization_rows[materialization_offset + 1u] = assignment_rows[assignment_offset + 1u];
  materialization_rows[materialization_offset + 2u] = assignment_rows[assignment_offset + 2u];
  materialization_rows[materialization_offset + 3u] = status;
  materialization_rows[materialization_offset + 4u] = 1.0;
  materialization_rows[materialization_offset + 5u] = assignment_rows[assignment_offset + 4u];
  materialization_rows[materialization_offset + 6u] = f32(params.admission_approved);
  materialization_rows[materialization_offset + 7u] = assignment_rows[assignment_offset + 7u];
  materialization_rows[materialization_offset + 8u] = assignment_rows[assignment_offset + 9u];
  materialization_rows[materialization_offset + 9u] = assignment_rows[assignment_offset + 10u];
  materialization_rows[materialization_offset + 10u] = assignment_rows[assignment_offset + 11u];
  materialization_rows[materialization_offset + 11u] = assignment_rows[assignment_offset + 12u];
  materialization_rows[materialization_offset + 12u] = select(-1.0, f32(target_start), written_target_count > 0.0);
  materialization_rows[materialization_offset + 13u] = written_target_count;
  materialization_rows[materialization_offset + 14u] = select(-1.0, f32(free_start), freed_source_count > 0.0);
  materialization_rows[materialization_offset + 15u] = freed_source_count;
  materialization_rows[materialization_offset + 16u] = source_mass;
  materialization_rows[materialization_offset + 17u] = assignment_rows[assignment_offset + 19u];
  materialization_rows[materialization_offset + 18u] = assignment_rows[assignment_offset + 20u];
  materialization_rows[materialization_offset + 19u] = source_volume;
  materialization_rows[materialization_offset + 20u] = target_volume;
  materialization_rows[materialization_offset + 21u] = assignment_rows[assignment_offset + 23u];
  materialization_rows[materialization_offset + 22u] = target_volume_ratio;
  materialization_rows[materialization_offset + 23u] = assignment_rows[assignment_offset + 16u];
  materialization_rows[materialization_offset + 24u] = assignment_rows[assignment_offset + 17u];
  materialization_rows[materialization_offset + 25u] = params.target_state_family_mask;
  materialization_rows[materialization_offset + 26u] = assignment_rows[assignment_offset + 28u];
  materialization_rows[materialization_offset + 27u] = params.materialization_epoch;
  materialization_rows[materialization_offset + 28u] = params.state_family_id;
  materialization_rows[materialization_offset + 29u] = source_status;
  materialization_rows[materialization_offset + 30u] = select(0.0, 1.0, written_target_count > 0.0);
  materialization_rows[materialization_offset + 31u] = select(0.0, 1.0, freed_source_count > 0.0);
}
`;

export const schroederPhaseVolumeLevelUpdateWgsl = `
struct SchroederPhaseVolumeLevelUpdateParams {
  migration_row_count: u32,
  migration_stride: u32,
  level_update_stride: u32,
  admission_approved: u32,
  state_family_id: f32,
  migration_epoch: f32,
  flags: u32,
  pad0: u32,
};

@group(0) @binding(0) var<storage, read> migration_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> level_update_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederPhaseVolumeLevelUpdateParams;

const SCHROEDER_PVLU_MIGRATION_STRIDE: u32 = 32u;
const SCHROEDER_PVLU_LEVEL_UPDATE_STRIDE: u32 = 32u;

fn ss_pvlu_active_migration(migration_offset: u32) -> bool {
  let status = migration_rows[migration_offset + 3u];
  return status > 0.0 && status < 32.0 && params.admission_approved > 0u;
}

fn ss_pvlu_write_empty(update_offset: u32, migration_offset: u32, status: f32) {
  level_update_rows[update_offset + 0u] = migration_rows[migration_offset + 0u];
  level_update_rows[update_offset + 1u] = migration_rows[migration_offset + 1u];
  level_update_rows[update_offset + 2u] = migration_rows[migration_offset + 2u];
  level_update_rows[update_offset + 3u] = status;
  for (var column = 4u; column < SCHROEDER_PVLU_LEVEL_UPDATE_STRIDE; column = column + 1u) {
    level_update_rows[update_offset + column] = 0.0;
  }
  level_update_rows[update_offset + 17u] = f32(params.admission_approved);
  level_update_rows[update_offset + 18u] = params.migration_epoch;
  level_update_rows[update_offset + 19u] = params.state_family_id;
  level_update_rows[update_offset + 30u] = 1.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.migration_row_count) {
    return;
  }

  let migration_stride = max(params.migration_stride, SCHROEDER_PVLU_MIGRATION_STRIDE);
  let level_update_stride = max(params.level_update_stride, SCHROEDER_PVLU_LEVEL_UPDATE_STRIDE);
  let migration_offset = row_index * migration_stride;
  let update_offset = row_index * level_update_stride;

  if (!ss_pvlu_active_migration(migration_offset)) {
    ss_pvlu_write_empty(update_offset, migration_offset, 32.0);
    return;
  }

  let coarsen_eligible = migration_rows[migration_offset + 22u];
  let refine_required = migration_rows[migration_offset + 23u];
  let aggregate_coherence_status = migration_rows[migration_offset + 25u];
  let conservation_residual_status = migration_rows[migration_offset + 26u];
  let refine_pressure_reason_mask = migration_rows[migration_offset + 31u];
  var status = 1.0;
  if (coarsen_eligible > 0.0) {
    status = status + 2.0;
  }
  if (refine_required > 0.0) {
    status = status + 4.0;
  }
  if (aggregate_coherence_status > 0.0) {
    status = status + 8.0;
  }
  if (conservation_residual_status > 1.0) {
    status = status + 16.0;
  }

  level_update_rows[update_offset + 0u] = migration_rows[migration_offset + 0u];
  level_update_rows[update_offset + 1u] = migration_rows[migration_offset + 1u];
  level_update_rows[update_offset + 2u] = migration_rows[migration_offset + 2u];
  level_update_rows[update_offset + 3u] = status;
  level_update_rows[update_offset + 4u] = migration_rows[migration_offset + 4u];
  level_update_rows[update_offset + 5u] = migration_rows[migration_offset + 5u];
  level_update_rows[update_offset + 6u] = migration_rows[migration_offset + 6u];
  level_update_rows[update_offset + 7u] = migration_rows[migration_offset + 7u];
  level_update_rows[update_offset + 8u] = migration_rows[migration_offset + 8u];
  level_update_rows[update_offset + 9u] = migration_rows[migration_offset + 9u];
  level_update_rows[update_offset + 10u] = migration_rows[migration_offset + 10u];
  level_update_rows[update_offset + 11u] = migration_rows[migration_offset + 11u];
  level_update_rows[update_offset + 12u] = migration_rows[migration_offset + 12u];
  level_update_rows[update_offset + 13u] = coarsen_eligible;
  level_update_rows[update_offset + 14u] = refine_required;
  level_update_rows[update_offset + 15u] = aggregate_coherence_status;
  level_update_rows[update_offset + 16u] = conservation_residual_status;
  level_update_rows[update_offset + 17u] = f32(params.admission_approved);
  level_update_rows[update_offset + 18u] = params.migration_epoch;
  level_update_rows[update_offset + 19u] = params.state_family_id;
  level_update_rows[update_offset + 20u] = migration_rows[migration_offset + 19u];
  level_update_rows[update_offset + 21u] = migration_rows[migration_offset + 20u];
  level_update_rows[update_offset + 22u] = migration_rows[migration_offset + 15u];
  level_update_rows[update_offset + 23u] = migration_rows[migration_offset + 16u];
  level_update_rows[update_offset + 24u] = migration_rows[migration_offset + 17u];
  level_update_rows[update_offset + 25u] = migration_rows[migration_offset + 18u];
  level_update_rows[update_offset + 26u] = 1.0;
  level_update_rows[update_offset + 27u] = migration_rows[migration_offset + 24u];
  level_update_rows[update_offset + 28u] = migration_rows[migration_offset + 28u];
  level_update_rows[update_offset + 29u] = 1.0;
  level_update_rows[update_offset + 30u] = 0.0;
  level_update_rows[update_offset + 31u] = refine_pressure_reason_mask;
}
`;

export const schroederPhaseVolumeDiagnosticSummaryWgsl = `
struct SchroederPhaseVolumeDiagnosticSummaryParams {
  level_update_row_count: u32,
  level_update_stride: u32,
  summary_stride: u32,
  flags: u32,
  phase_volume_expand_threshold: f32,
  migration_epoch: f32,
  state_family_id: f32,
  pad0: f32,
};

@group(0) @binding(0) var<storage, read> level_update_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> summary_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederPhaseVolumeDiagnosticSummaryParams;

const SCHROEDER_PVDS_LEVEL_UPDATE_STRIDE: u32 = 32u;
const SCHROEDER_PVDS_SUMMARY_STRIDE: u32 = 32u;

fn ss_pvds_active_update(offset: u32) -> bool {
  let status = level_update_rows[offset + 3u];
  let admission = level_update_rows[offset + 17u];
  return status > 0.0 && status < 32.0 && admission > 0.0;
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x > 0u) {
    return;
  }

  let level_update_stride = max(params.level_update_stride, SCHROEDER_PVDS_LEVEL_UPDATE_STRIDE);
  let summary_stride = max(params.summary_stride, SCHROEDER_PVDS_SUMMARY_STRIDE);
  let summary_offset = 0u * summary_stride;

  var active_count = 0.0;
  var coarsen_count = 0.0;
  var refine_count = 0.0;
  var coherent_count = 0.0;
  var residual_issue_count = 0.0;
  var min_source_level = 1000000.0;
  var max_source_level = -1000000.0;
  var min_target_level = 1000000.0;
  var max_target_level = -1000000.0;
  var max_positive_delta = 0.0;
  var max_negative_delta = 0.0;
  var total_rest_volume = 0.0;
  var total_represented_volume = 0.0;
  var total_aggregate_mass = 0.0;
  var total_aggregate_volume = 0.0;
  var total_abs_mass_residual = 0.0;
  var total_abs_volume_residual = 0.0;
  var steam_expansion_count = 0.0;
  var admitted_update_count = 0.0;
  var state_admission_required_count = 0.0;
  var visible_migration_count = 0.0;
  var aggregate_missing_count = 0.0;
  var level_changed_count = 0.0;
  var refine_pressure_count = 0.0;
  var refine_pressure_reason_mask = 0u;

  for (var row_index = 0u; row_index < params.level_update_row_count; row_index = row_index + 1u) {
    let offset = row_index * level_update_stride;
    if (ss_pvds_active_update(offset)) {
      let source_level = level_update_rows[offset + 1u];
      let target_level = level_update_rows[offset + 2u];
      let level_delta = level_update_rows[offset + 9u];
      let coarsen = level_update_rows[offset + 13u] > 0.0;
      let refine = level_update_rows[offset + 14u] > 0.0;
      let coherent_update = level_update_rows[offset + 15u] > 0.0;
      let residual_issue = level_update_rows[offset + 16u] > 1.0;
      let phase_volume_ratio = level_update_rows[offset + 8u];
      let row_refine_pressure_mask = u32(max(round(level_update_rows[offset + 31u]), 0.0));
      active_count = active_count + 1.0;
      coarsen_count = coarsen_count + select(0.0, 1.0, coarsen);
      refine_count = refine_count + select(0.0, 1.0, refine);
      coherent_count = coherent_count + select(0.0, 1.0, coherent_update);
      residual_issue_count = residual_issue_count + select(0.0, 1.0, residual_issue);
      min_source_level = min(min_source_level, source_level);
      max_source_level = max(max_source_level, source_level);
      min_target_level = min(min_target_level, target_level);
      max_target_level = max(max_target_level, target_level);
      max_positive_delta = max(max_positive_delta, max(level_delta, 0.0));
      max_negative_delta = min(max_negative_delta, min(level_delta, 0.0));
      total_rest_volume = total_rest_volume + level_update_rows[offset + 6u];
      total_represented_volume = total_represented_volume + level_update_rows[offset + 7u];
      total_aggregate_mass = total_aggregate_mass + level_update_rows[offset + 22u];
      total_aggregate_volume = total_aggregate_volume + level_update_rows[offset + 23u];
      total_abs_mass_residual = total_abs_mass_residual + abs(level_update_rows[offset + 24u]);
      total_abs_volume_residual = total_abs_volume_residual + abs(level_update_rows[offset + 25u]);
      steam_expansion_count = steam_expansion_count + select(
        0.0,
        1.0,
        phase_volume_ratio >= max(params.phase_volume_expand_threshold, 1.0)
      );
      admitted_update_count = admitted_update_count + select(0.0, 1.0, level_update_rows[offset + 17u] > 0.0);
      state_admission_required_count = state_admission_required_count + select(
        0.0,
        1.0,
        level_update_rows[offset + 30u] > 0.0
      );
      visible_migration_count = visible_migration_count + select(0.0, 1.0, coarsen || refine);
      aggregate_missing_count = aggregate_missing_count + select(0.0, 1.0, !coherent_update);
      level_changed_count = level_changed_count + select(0.0, 1.0, abs(target_level - source_level) > 0.5);
      refine_pressure_count = refine_pressure_count + select(0.0, 1.0, row_refine_pressure_mask != 0u);
      refine_pressure_reason_mask = refine_pressure_reason_mask | row_refine_pressure_mask;
    }
  }

  if (active_count == 0.0) {
    min_source_level = 0.0;
    max_source_level = 0.0;
    min_target_level = 0.0;
    max_target_level = 0.0;
  }

  summary_rows[summary_offset + 0u] = f32(params.level_update_row_count);
  summary_rows[summary_offset + 1u] = active_count;
  summary_rows[summary_offset + 2u] = coarsen_count;
  summary_rows[summary_offset + 3u] = refine_count;
  summary_rows[summary_offset + 4u] = coherent_count;
  summary_rows[summary_offset + 5u] = residual_issue_count;
  summary_rows[summary_offset + 6u] = min_source_level;
  summary_rows[summary_offset + 7u] = max_source_level;
  summary_rows[summary_offset + 8u] = min_target_level;
  summary_rows[summary_offset + 9u] = max_target_level;
  summary_rows[summary_offset + 10u] = max_positive_delta;
  summary_rows[summary_offset + 11u] = max_negative_delta;
  summary_rows[summary_offset + 12u] = total_rest_volume;
  summary_rows[summary_offset + 13u] = total_represented_volume;
  summary_rows[summary_offset + 14u] = total_aggregate_mass;
  summary_rows[summary_offset + 15u] = total_aggregate_volume;
  summary_rows[summary_offset + 16u] = total_abs_mass_residual;
  summary_rows[summary_offset + 17u] = total_abs_volume_residual;
  summary_rows[summary_offset + 18u] = steam_expansion_count;
  summary_rows[summary_offset + 19u] = admitted_update_count;
  summary_rows[summary_offset + 20u] = state_admission_required_count;
  summary_rows[summary_offset + 21u] = visible_migration_count;
  summary_rows[summary_offset + 22u] = aggregate_missing_count;
  summary_rows[summary_offset + 23u] = level_changed_count;
  summary_rows[summary_offset + 24u] = 1.0;
  summary_rows[summary_offset + 25u] = params.migration_epoch;
  summary_rows[summary_offset + 26u] = select(32.0, 1.0, active_count > 0.0);
  summary_rows[summary_offset + 27u] = max(params.phase_volume_expand_threshold, 1.0);
  summary_rows[summary_offset + 28u] = params.state_family_id;
  summary_rows[summary_offset + 29u] = 1.0;
  summary_rows[summary_offset + 30u] = refine_pressure_count;
  summary_rows[summary_offset + 31u] = f32(refine_pressure_reason_mask);
}
`;

export const schroederCrossLevelGridCouplingSharedWgsl = `
struct SchroederCrossLevelGridCouplingParams {
  fine_nx: u32,
  fine_ny: u32,
  fine_nz: u32,
  coarse_nx: u32,
  coarse_ny: u32,
  coarse_nz: u32,
  grid_stride: u32,
  flags: u32,
  fine_grid_spacing_m: f32,
  grid_origin_x_m: f32,
  grid_origin_y_m: f32,
  grid_origin_z_m: f32,
  grid_shift: i32,
  box_x_m: f32,
  box_y_m: f32,
  box_z_m: f32,
  delta_scale: f32,
  shared_accel_dt_x: f32,
  shared_accel_dt_y: f32,
  shared_accel_dt_z: f32,
  // CFL velocity ceiling of the coarse grid update (cfl * coarse_dx /
  // coarse_dt). The delta prolongation clamps its raw momentum/mass parent
  // read to this bound so it lives in the same representable velocity space
  // as the (already clamped) post-update grid. Zero disables the clamp.
  max_coarse_velocity_m_per_s: f32,
  coupling_pad0: f32,
  coupling_pad1: f32,
  coupling_pad2: f32,
};

const SCHROEDER_GRID_COUPLING_WORKGROUP_SIZE: u32 = 64u;
const SCHROEDER_GRID_COUPLING_FLAG_ACCUMULATE: u32 = 1u;
const SCHROEDER_GRID_COUPLING_FLAG_Z_FASTEST: u32 = 2u;
const SCHROEDER_GRID_COUPLING_FLAG_VELOCITY_GRIDS: u32 = 4u;
const SCHROEDER_GRID_COUPLING_FLAG_PRE_VELOCITY_GRID: u32 = 8u;

fn schroeder_grid_axis_coords(index: u32, dims: vec3<u32>, flags: u32) -> vec3<u32> {
  if ((flags & SCHROEDER_GRID_COUPLING_FLAG_Z_FASTEST) != 0u) {
    let plane = dims.y * dims.z;
    let x = index / plane;
    let rem = index - x * plane;
    return vec3<u32>(x, rem / dims.z, rem % dims.z);
  }
  return vec3<u32>(
    index % dims.x,
    (index / dims.x) % dims.y,
    index / (dims.x * dims.y)
  );
}

fn schroeder_grid_axis_index(coords: vec3<u32>, dims: vec3<u32>, flags: u32) -> u32 {
  if ((flags & SCHROEDER_GRID_COUPLING_FLAG_Z_FASTEST) != 0u) {
    return coords.x * dims.y * dims.z + coords.y * dims.z + coords.z;
  }
  return coords.x + dims.x * (coords.y + dims.y * coords.z);
}

fn schroeder_fine_support_axis(coarse_axis: u32, offset: i32, shift: i32) -> i32 {
  return 2 * (i32(coarse_axis) - shift) + shift + offset;
}

fn schroeder_coarse_interpolation_axis(fine_axis: u32, shift: i32) -> vec2<f32> {
  let coordinate = f32(i32(fine_axis) - shift) * 0.5 + f32(shift);
  let lower = floor(coordinate);
  return vec2<f32>(lower, coordinate - lower);
}

fn schroeder_linear_axis_weight(offset: i32) -> f32 {
  return select(0.5, 1.0, offset == 0);
}
`;

export const schroederCrossLevelGridRestrictionWgsl = `${schroederCrossLevelGridCouplingSharedWgsl}
@group(0) @binding(0) var<storage, read> fine_grid: array<f32>;
@group(0) @binding(1) var<storage, read_write> coarse_grid: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederCrossLevelGridCouplingParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let coarse_index = global_id.x;
  let coarse_dims = vec3<u32>(params.coarse_nx, params.coarse_ny, params.coarse_nz);
  let fine_dims = vec3<u32>(params.fine_nx, params.fine_ny, params.fine_nz);
  let coarse_count = coarse_dims.x * coarse_dims.y * coarse_dims.z;
  if (coarse_index >= coarse_count) {
    return;
  }
  let stride = max(params.grid_stride, 8u);
  let accumulate = (params.flags & SCHROEDER_GRID_COUPLING_FLAG_ACCUMULATE) != 0u;
  let coarse_coords = schroeder_grid_axis_coords(coarse_index, coarse_dims, params.flags);

  var mass_kg = 0.0;
  var momentum = vec3<f32>(0.0, 0.0, 0.0);
  for (var dz = -1i; dz <= 1i; dz = dz + 1i) {
    let fz = schroeder_fine_support_axis(coarse_coords.z, dz, params.grid_shift);
    if (fz < 0 || fz >= i32(fine_dims.z)) {
      continue;
    }
    let wz = schroeder_linear_axis_weight(dz);
    for (var dy = -1i; dy <= 1i; dy = dy + 1i) {
      let fy = schroeder_fine_support_axis(coarse_coords.y, dy, params.grid_shift);
      if (fy < 0 || fy >= i32(fine_dims.y)) {
        continue;
      }
      let wy = schroeder_linear_axis_weight(dy);
      for (var dx = -1i; dx <= 1i; dx = dx + 1i) {
        let fx = schroeder_fine_support_axis(coarse_coords.x, dx, params.grid_shift);
        if (fx < 0 || fx >= i32(fine_dims.x)) {
          continue;
        }
        let weight = schroeder_linear_axis_weight(dx) * wy * wz;
        let fine_index = schroeder_grid_axis_index(
          vec3<u32>(u32(fx), u32(fy), u32(fz)),
          fine_dims,
          params.flags
        );
        let fine_offset = fine_index * stride;
        let node_mass = max(fine_grid[fine_offset], 0.0);
        mass_kg = mass_kg + weight * node_mass;
        momentum = momentum + weight * vec3<f32>(
          fine_grid[fine_offset + 1u],
          fine_grid[fine_offset + 2u],
          fine_grid[fine_offset + 3u]
        );
      }
    }
  }

  let coarse_spacing_m = params.fine_grid_spacing_m * 2.0;
  let coarse_offset = coarse_index * stride;
  if (accumulate) {
    let total_mass = coarse_grid[coarse_offset] + mass_kg;
    coarse_grid[coarse_offset] = total_mass;
    coarse_grid[coarse_offset + 1u] = coarse_grid[coarse_offset + 1u] + momentum.x;
    coarse_grid[coarse_offset + 2u] = coarse_grid[coarse_offset + 2u] + momentum.y;
    coarse_grid[coarse_offset + 3u] = coarse_grid[coarse_offset + 3u] + momentum.z;
    coarse_grid[coarse_offset + 7u] = select(
      coarse_grid[coarse_offset + 7u],
      1.0,
      total_mass > 0.0
    );
  } else {
    coarse_grid[coarse_offset] = mass_kg;
    coarse_grid[coarse_offset + 1u] = momentum.x;
    coarse_grid[coarse_offset + 2u] = momentum.y;
    coarse_grid[coarse_offset + 3u] = momentum.z;
    coarse_grid[coarse_offset + 4u] = params.grid_origin_x_m
      + f32(i32(coarse_coords.x) - params.grid_shift) * coarse_spacing_m;
    coarse_grid[coarse_offset + 5u] = params.grid_origin_y_m
      + f32(i32(coarse_coords.y) - params.grid_shift) * coarse_spacing_m;
    coarse_grid[coarse_offset + 6u] = params.grid_origin_z_m
      + f32(i32(coarse_coords.z) - params.grid_shift) * coarse_spacing_m;
    coarse_grid[coarse_offset + 7u] = select(0.0, 1.0, mass_kg > 0.0);
  }
}
`;

export const schroederSameGridMomentumAccumulationWgsl = `
struct SchroederSameGridMomentumAccumulationParams {
  node_count: u32,
  grid_stride: u32,
  flags: u32,
  pad0: u32,
};

@group(0) @binding(0) var<storage, read> source_grid: array<f32>;
@group(0) @binding(1) var<storage, read_write> target_grid: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederSameGridMomentumAccumulationParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let node_index = global_id.x;
  if (node_index >= params.node_count) { return; }
  let stride = max(params.grid_stride, 8u);
  let offset = node_index * stride;
  let source_mass = max(source_grid[offset], 0.0);
  if (!(source_mass > 0.0)) { return; }
  let target_mass = max(target_grid[offset], 0.0);
  target_grid[offset] = target_mass + source_mass;
  target_grid[offset + 1u] = target_grid[offset + 1u] + source_grid[offset + 1u];
  target_grid[offset + 2u] = target_grid[offset + 2u] + source_grid[offset + 2u];
  target_grid[offset + 3u] = target_grid[offset + 3u] + source_grid[offset + 3u];
  if (!(target_mass > 0.0)) {
    target_grid[offset + 4u] = source_grid[offset + 4u];
    target_grid[offset + 5u] = source_grid[offset + 5u];
    target_grid[offset + 6u] = source_grid[offset + 6u];
  }
  target_grid[offset + 7u] = 1.0;
}
`;

export const schroederCrossLevelGridProlongationWgsl = `${schroederCrossLevelGridCouplingSharedWgsl}
@group(0) @binding(0) var<storage, read> coarse_grid: array<f32>;
@group(0) @binding(1) var<storage, read_write> fine_grid: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederCrossLevelGridCouplingParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let fine_index = global_id.x;
  let fine_dims = vec3<u32>(params.fine_nx, params.fine_ny, params.fine_nz);
  let coarse_dims = vec3<u32>(params.coarse_nx, params.coarse_ny, params.coarse_nz);
  let fine_count = fine_dims.x * fine_dims.y * fine_dims.z;
  if (fine_index >= fine_count) {
    return;
  }
  let stride = max(params.grid_stride, 8u);
  let fine_coords = schroeder_grid_axis_coords(fine_index, fine_dims, params.flags);
  let coarse_x = schroeder_coarse_interpolation_axis(fine_coords.x, params.grid_shift);
  let coarse_y = schroeder_coarse_interpolation_axis(fine_coords.y, params.grid_shift);
  let coarse_z = schroeder_coarse_interpolation_axis(fine_coords.z, params.grid_shift);
  let velocity_grids = (params.flags & SCHROEDER_GRID_COUPLING_FLAG_VELOCITY_GRIDS) != 0u;
  var interpolated_velocity = vec3<f32>(0.0);
  var weight_sum = 0.0;
  var complete = true;
  for (var oz = 0u; oz < 2u; oz = oz + 1u) {
    let cz = i32(coarse_z.x) + i32(oz);
    let wz = select(1.0 - coarse_z.y, coarse_z.y, oz == 1u);
    if (!(wz > 0.0)) { continue; }
    for (var oy = 0u; oy < 2u; oy = oy + 1u) {
      let cy = i32(coarse_y.x) + i32(oy);
      let wy = select(1.0 - coarse_y.y, coarse_y.y, oy == 1u);
      if (!(wy > 0.0)) { continue; }
      for (var ox = 0u; ox < 2u; ox = ox + 1u) {
        let cx = i32(coarse_x.x) + i32(ox);
        let wx = select(1.0 - coarse_x.y, coarse_x.y, ox == 1u);
        let weight = wx * wy * wz;
        if (!(weight > 0.0)) { continue; }
        if (
          cx < 0 || cy < 0 || cz < 0
          || cx >= i32(coarse_dims.x)
          || cy >= i32(coarse_dims.y)
          || cz >= i32(coarse_dims.z)
        ) {
          complete = false;
          continue;
        }
        let coarse_index = schroeder_grid_axis_index(
          vec3<u32>(u32(cx), u32(cy), u32(cz)),
          coarse_dims,
          params.flags
        );
        let coarse_offset = coarse_index * stride;
        let coarse_mass = coarse_grid[coarse_offset];
        if (!(coarse_mass > 0.0)) {
          complete = false;
          continue;
        }
        var parent_velocity = vec3<f32>(
          coarse_grid[coarse_offset + 1u],
          coarse_grid[coarse_offset + 2u],
          coarse_grid[coarse_offset + 3u]
        );
        if (!velocity_grids) { parent_velocity = parent_velocity / coarse_mass; }
        interpolated_velocity = interpolated_velocity + weight * parent_velocity;
        weight_sum = weight_sum + weight;
      }
    }
  }
  if (!complete || abs(weight_sum - 1.0) > 0.000001) {
    return;
  }
  let fine_offset = fine_index * stride;
  let fine_mass = max(fine_grid[fine_offset], 0.0);
  if (!(fine_mass > 0.0)) { return; }
  if (velocity_grids) {
    fine_grid[fine_offset + 1u] = interpolated_velocity.x;
    fine_grid[fine_offset + 2u] = interpolated_velocity.y;
    fine_grid[fine_offset + 3u] = interpolated_velocity.z;
  } else {
    fine_grid[fine_offset + 1u] = fine_mass * interpolated_velocity.x;
    fine_grid[fine_offset + 2u] = fine_mass * interpolated_velocity.y;
    fine_grid[fine_offset + 3u] = fine_mass * interpolated_velocity.z;
  }
}
`;

export const schroederCrossLevelGridConservationSummaryWgsl = `${schroederCrossLevelGridCouplingSharedWgsl}
@group(0) @binding(0) var<storage, read> fine_grid: array<f32>;
@group(0) @binding(1) var<storage, read> coarse_grid: array<f32>;
@group(0) @binding(2) var<storage, read_write> summary_row: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederCrossLevelGridCouplingParams;

const SCHROEDER_GRID_SUMMARY_WORKGROUP_SIZE: u32 = 64u;

var<workgroup> wg_fine_mass: array<f32, 64>;
var<workgroup> wg_fine_momentum_x: array<f32, 64>;
var<workgroup> wg_fine_momentum_y: array<f32, 64>;
var<workgroup> wg_fine_momentum_z: array<f32, 64>;
var<workgroup> wg_fine_active: array<f32, 64>;
var<workgroup> wg_coarse_mass: array<f32, 64>;
var<workgroup> wg_coarse_momentum_x: array<f32, 64>;
var<workgroup> wg_coarse_momentum_y: array<f32, 64>;
var<workgroup> wg_coarse_momentum_z: array<f32, 64>;
var<workgroup> wg_coarse_active: array<f32, 64>;

@compute @workgroup_size(64)
fn main(@builtin(local_invocation_id) local_id: vec3<u32>) {
  let local_index = local_id.x;
  let stride = max(params.grid_stride, 8u);
  let fine_count = params.fine_nx * params.fine_ny * params.fine_nz;
  let coarse_count = params.coarse_nx * params.coarse_ny * params.coarse_nz;

  var fine_mass = 0.0;
  var fine_momentum = vec3<f32>(0.0, 0.0, 0.0);
  var fine_active = 0.0;
  for (var index = local_index; index < fine_count; index = index + SCHROEDER_GRID_SUMMARY_WORKGROUP_SIZE) {
    let offset = index * stride;
    let node_mass = max(fine_grid[offset], 0.0);
    fine_mass = fine_mass + node_mass;
    fine_momentum = fine_momentum + vec3<f32>(
      fine_grid[offset + 1u],
      fine_grid[offset + 2u],
      fine_grid[offset + 3u]
    );
    fine_active = fine_active + select(0.0, 1.0, node_mass > 0.0);
  }

  var coarse_mass = 0.0;
  var coarse_momentum = vec3<f32>(0.0, 0.0, 0.0);
  var coarse_active = 0.0;
  for (var index = local_index; index < coarse_count; index = index + SCHROEDER_GRID_SUMMARY_WORKGROUP_SIZE) {
    let offset = index * stride;
    let node_mass = max(coarse_grid[offset], 0.0);
    coarse_mass = coarse_mass + node_mass;
    coarse_momentum = coarse_momentum + vec3<f32>(
      coarse_grid[offset + 1u],
      coarse_grid[offset + 2u],
      coarse_grid[offset + 3u]
    );
    coarse_active = coarse_active + select(0.0, 1.0, node_mass > 0.0);
  }

  wg_fine_mass[local_index] = fine_mass;
  wg_fine_momentum_x[local_index] = fine_momentum.x;
  wg_fine_momentum_y[local_index] = fine_momentum.y;
  wg_fine_momentum_z[local_index] = fine_momentum.z;
  wg_fine_active[local_index] = fine_active;
  wg_coarse_mass[local_index] = coarse_mass;
  wg_coarse_momentum_x[local_index] = coarse_momentum.x;
  wg_coarse_momentum_y[local_index] = coarse_momentum.y;
  wg_coarse_momentum_z[local_index] = coarse_momentum.z;
  wg_coarse_active[local_index] = coarse_active;
  workgroupBarrier();

  if (local_index == 0u) {
    var sum_fine_mass = 0.0;
    var sum_fine_momentum = vec3<f32>(0.0, 0.0, 0.0);
    var sum_fine_active = 0.0;
    var sum_coarse_mass = 0.0;
    var sum_coarse_momentum = vec3<f32>(0.0, 0.0, 0.0);
    var sum_coarse_active = 0.0;
    for (var index = 0u; index < SCHROEDER_GRID_SUMMARY_WORKGROUP_SIZE; index = index + 1u) {
      sum_fine_mass = sum_fine_mass + wg_fine_mass[index];
      sum_fine_momentum = sum_fine_momentum + vec3<f32>(
        wg_fine_momentum_x[index],
        wg_fine_momentum_y[index],
        wg_fine_momentum_z[index]
      );
      sum_fine_active = sum_fine_active + wg_fine_active[index];
      sum_coarse_mass = sum_coarse_mass + wg_coarse_mass[index];
      sum_coarse_momentum = sum_coarse_momentum + vec3<f32>(
        wg_coarse_momentum_x[index],
        wg_coarse_momentum_y[index],
        wg_coarse_momentum_z[index]
      );
      sum_coarse_active = sum_coarse_active + wg_coarse_active[index];
    }
    summary_row[0] = sum_fine_mass;
    summary_row[1] = sum_fine_momentum.x;
    summary_row[2] = sum_fine_momentum.y;
    summary_row[3] = sum_fine_momentum.z;
    summary_row[4] = sum_coarse_mass;
    summary_row[5] = sum_coarse_momentum.x;
    summary_row[6] = sum_coarse_momentum.y;
    summary_row[7] = sum_coarse_momentum.z;
    summary_row[8] = abs(sum_fine_mass - sum_coarse_mass);
    summary_row[9] = abs(sum_fine_momentum.x - sum_coarse_momentum.x);
    summary_row[10] = abs(sum_fine_momentum.y - sum_coarse_momentum.y);
    summary_row[11] = abs(sum_fine_momentum.z - sum_coarse_momentum.z);
    summary_row[12] = sum_fine_active;
    summary_row[13] = sum_coarse_active;
    summary_row[14] = 1.0;
    summary_row[15] = f32(params.flags);
  }
}
`;

export const schroederCrossLevelGridVelocityDeltaProlongationWgsl = `${schroederCrossLevelGridCouplingSharedWgsl}
@group(0) @binding(0) var<storage, read> coarse_pre_grid: array<f32>;
@group(0) @binding(1) var<storage, read> coarse_post_grid: array<f32>;
@group(0) @binding(2) var<storage, read_write> fine_grid: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederCrossLevelGridCouplingParams;

// Delta-form prolongation (AMR velocity correction): each massive fine node
// receives a trilinear interpolation of the coarse velocity change. The same
// dyadic basis is used by restriction, so complete supports preserve POU and
// reproduce affine coarse corrections. Wall response is part of the coarse
// target; no boundary-band early return is allowed to break the basis.
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let fine_index = global_id.x;
  let fine_dims = vec3<u32>(params.fine_nx, params.fine_ny, params.fine_nz);
  let coarse_dims = vec3<u32>(params.coarse_nx, params.coarse_ny, params.coarse_nz);
  let fine_count = fine_dims.x * fine_dims.y * fine_dims.z;
  if (fine_index >= fine_count) {
    return;
  }
  let stride = max(params.grid_stride, 8u);
  let fine_offset = fine_index * stride;
  let fine_mass = fine_grid[fine_offset];
  if (fine_mass <= 0.0) {
    return;
  }
  let fine_coords = schroeder_grid_axis_coords(fine_index, fine_dims, params.flags);
  let coarse_x = schroeder_coarse_interpolation_axis(fine_coords.x, params.grid_shift);
  let coarse_y = schroeder_coarse_interpolation_axis(fine_coords.y, params.grid_shift);
  let coarse_z = schroeder_coarse_interpolation_axis(fine_coords.z, params.grid_shift);
  let vmax = params.max_coarse_velocity_m_per_s;
  var pre_velocity = vec3<f32>(0.0);
  var post_velocity = vec3<f32>(0.0);
  var weight_sum = 0.0;
  var complete = true;
  for (var oz = 0u; oz < 2u; oz = oz + 1u) {
    let cz = i32(coarse_z.x) + i32(oz);
    let wz = select(1.0 - coarse_z.y, coarse_z.y, oz == 1u);
    if (!(wz > 0.0)) { continue; }
    for (var oy = 0u; oy < 2u; oy = oy + 1u) {
      let cy = i32(coarse_y.x) + i32(oy);
      let wy = select(1.0 - coarse_y.y, coarse_y.y, oy == 1u);
      if (!(wy > 0.0)) { continue; }
      for (var ox = 0u; ox < 2u; ox = ox + 1u) {
        let cx = i32(coarse_x.x) + i32(ox);
        let wx = select(1.0 - coarse_x.y, coarse_x.y, ox == 1u);
        let weight = wx * wy * wz;
        if (!(weight > 0.0)) { continue; }
        if (
          cx < 0 || cy < 0 || cz < 0
          || cx >= i32(coarse_dims.x)
          || cy >= i32(coarse_dims.y)
          || cz >= i32(coarse_dims.z)
        ) {
          complete = false;
          continue;
        }
        let coarse_offset = schroeder_grid_axis_index(
          vec3<u32>(u32(cx), u32(cy), u32(cz)),
          coarse_dims,
          params.flags
        ) * stride;
        let pre_mass = coarse_pre_grid[coarse_offset];
        let post_mass = coarse_post_grid[coarse_offset];
        if (
          !(pre_mass > 0.0) || !(post_mass > 0.0)
          || min(pre_mass, post_mass) < 0.5 * max(pre_mass, post_mass)
        ) {
          complete = false;
          continue;
        }
        var parent_pre_velocity = vec3<f32>(
          coarse_pre_grid[coarse_offset + 1u],
          coarse_pre_grid[coarse_offset + 2u],
          coarse_pre_grid[coarse_offset + 3u]
        );
        if ((params.flags & SCHROEDER_GRID_COUPLING_FLAG_PRE_VELOCITY_GRID) == 0u) {
          parent_pre_velocity = parent_pre_velocity / pre_mass;
        }
        if (vmax > 0.0) {
          let largest_pre_component = max(
            max(abs(parent_pre_velocity.x), abs(parent_pre_velocity.y)),
            abs(parent_pre_velocity.z)
          );
          if (largest_pre_component > 0.0) {
            let scaled_pre_velocity =
              parent_pre_velocity / largest_pre_component;
            let scaled_pre_length = max(
              length(scaled_pre_velocity),
              1.0e-30
            );
            if (largest_pre_component > vmax / scaled_pre_length) {
              parent_pre_velocity = scaled_pre_velocity
                * (vmax / scaled_pre_length);
            }
          }
        }
        let parent_post_velocity = vec3<f32>(
          coarse_post_grid[coarse_offset + 1u],
          coarse_post_grid[coarse_offset + 2u],
          coarse_post_grid[coarse_offset + 3u]
        );
        pre_velocity = pre_velocity + weight * parent_pre_velocity;
        post_velocity = post_velocity + weight * parent_post_velocity;
        weight_sum = weight_sum + weight;
      }
    }
  }
  if (!complete || abs(weight_sum - 1.0) > 0.000001) { return; }
  // delta_scale supports subcycled fine substeps: each substep applies its
  // time-interpolated share of the coarse correction (scale 1/substeps),
  // summing to the full delta across the coarse step. Zero means 1.
  // shared_accel_dt removes velocity change the fine level integrates
  // itself (gravity and other uniform shared accelerations times the
  // coarse dt), so the transferred delta carries only coarse-grid-specific
  // information and shared forces are not double counted.
  let scale = select(params.delta_scale, 1.0, params.delta_scale == 0.0);
  let shared_accel_dt = vec3<f32>(
    params.shared_accel_dt_x,
    params.shared_accel_dt_y,
    params.shared_accel_dt_z
  );
  var delta = (post_velocity - pre_velocity - shared_accel_dt) * scale;
  // Defense in depth: one substep's correction may not exceed its share of
  // the coarse solver's own velocity range (vmax * scale). With both
  // operands clamped above this is nearly redundant, but it bounds the
  // applied delta even if a future layout change reintroduces raw reads.
  if (vmax > 0.0) {
    let delta_budget = vmax * scale;
    let delta_speed2 = dot(delta, delta);
    if (delta_speed2 > delta_budget * delta_budget) {
      delta = delta * (delta_budget / sqrt(delta_speed2));
    }
  }
  fine_grid[fine_offset + 1u] = fine_grid[fine_offset + 1u] + delta.x;
  fine_grid[fine_offset + 2u] = fine_grid[fine_offset + 2u] + delta.y;
  fine_grid[fine_offset + 3u] = fine_grid[fine_offset + 3u] + delta.z;
}
`;

function schroederCompactHierarchyDispatchVariant(source, {
  invocationKind,
  hierarchyBinding,
  paramsBinding
}) {
  const paramsDeclaration = `@group(0) @binding(${hierarchyBinding}) var<uniform> params: SchroederCrossLevelGridCouplingParams;`;
  const replacementDeclaration = `@group(0) @binding(${hierarchyBinding}) var<storage, read> hierarchy_view: array<u32>;
@group(0) @binding(${paramsBinding}) var<uniform> params: SchroederCrossLevelGridCouplingParams;`;
  const compactIndexColumn = invocationKind == 'fine' ? '34u' : '35u';
  const nodeOffsetColumn = invocationKind == 'fine' ? '48u' : '49u';
  const denseName = invocationKind == 'fine' ? 'fine_index' : 'coarse_index';
  const invocationMapping = `let compact_${invocationKind}_index = global_id.x;
  let hierarchy_admitted = arrayLength(&hierarchy_view) >= 68u
    && hierarchy_view[0u] == 0x53485631u
    && hierarchy_view[1u] == 1u
    && (hierarchy_view[2u] & 3u) == 3u
    && hierarchy_view[18u] == params.fine_nx * params.fine_ny * params.fine_nz
    && hierarchy_view[19u] == params.coarse_nx * params.coarse_ny * params.coarse_nz
    && hierarchy_view[28u] == bitcast<u32>(params.fine_grid_spacing_m)
    && hierarchy_view[29u] == bitcast<u32>(params.fine_grid_spacing_m * 2.0);
  if (!hierarchy_admitted || compact_${invocationKind}_index >= hierarchy_view[${compactIndexColumn}]) {
    return;
  }
  let compact_node_offset = hierarchy_view[${nodeOffsetColumn}];
  if (compact_node_offset + compact_${invocationKind}_index >= arrayLength(&hierarchy_view)) {
    return;
  }
  let ${denseName} = hierarchy_view[compact_node_offset + compact_${invocationKind}_index];`;
  return source
    .replace(paramsDeclaration, replacementDeclaration)
    .replace(`let ${denseName} = global_id.x;`, invocationMapping);
}

export const schroederCrossLevelGridRestrictionCompactWgsl =
  schroederCompactHierarchyDispatchVariant(
    schroederCrossLevelGridRestrictionWgsl,
    { invocationKind: 'coarse', hierarchyBinding: 2, paramsBinding: 3 }
  );

export const schroederCrossLevelGridProlongationCompactWgsl =
  schroederCompactHierarchyDispatchVariant(
    schroederCrossLevelGridProlongationWgsl,
    { invocationKind: 'fine', hierarchyBinding: 2, paramsBinding: 3 }
  );

export const schroederCrossLevelGridVelocityDeltaProlongationCompactWgsl =
  schroederCompactHierarchyDispatchVariant(
    schroederCrossLevelGridVelocityDeltaProlongationWgsl,
    { invocationKind: 'fine', hierarchyBinding: 3, paramsBinding: 4 }
  );

export const schroederParticleStorageCountSummaryWgsl = `
struct SchroederParticleStorageCountSummaryParams {
  materialization_row_count: u32,
  materialization_stride: u32,
  source_particle_count: u32,
  flags: u32,
};

@group(0) @binding(0) var<storage, read> materialization_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> summary_row: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederParticleStorageCountSummaryParams;

const SCHROEDER_PSC_WORKGROUP_SIZE: u32 = 64u;

var<workgroup> wg_admitted_rows: array<f32, 64>;
var<workgroup> wg_written_target: array<f32, 64>;
var<workgroup> wg_appended_target: array<f32, 64>;
var<workgroup> wg_freed_source: array<f32, 64>;
var<workgroup> wg_source_mass: array<f32, 64>;
var<workgroup> wg_target_mass: array<f32, 64>;
var<workgroup> wg_mass_residual_max: array<f32, 64>;
var<workgroup> wg_blocked_rows: array<f32, 64>;

// Reduces admitted particle-storage materialization rows into one compact
// count summary. The authoritative count delta is append-only: written
// target slots at or beyond the source particle count extend the live
// range, while freed source slots become zero-mass holes until a future
// compaction pass exists, so they never shrink the count here.
@compute @workgroup_size(64)
fn main(@builtin(local_invocation_id) local_id: vec3<u32>) {
  let local_index = local_id.x;
  let stride = max(params.materialization_stride, 32u);

  var admitted_rows = 0.0;
  var written_target = 0.0;
  var appended_target = 0.0;
  var freed_source = 0.0;
  var source_mass = 0.0;
  var target_mass = 0.0;
  var mass_residual_max = 0.0;
  var blocked_rows = 0.0;
  for (var row = local_index; row < params.materialization_row_count; row = row + SCHROEDER_PSC_WORKGROUP_SIZE) {
    let offset = row * stride;
    let status = materialization_rows[offset + 3u];
    let admitted = materialization_rows[offset + 6u];
    if (status <= 0.0 || status >= 32.0 || admitted <= 0.0) {
      blocked_rows = blocked_rows + 1.0;
      continue;
    }
    admitted_rows = admitted_rows + 1.0;
    let written_start = materialization_rows[offset + 12u];
    let written_count = max(materialization_rows[offset + 13u], 0.0);
    let freed_count = max(materialization_rows[offset + 15u], 0.0);
    written_target = written_target + written_count;
    if (written_count > 0.0 && written_start >= f32(params.source_particle_count)) {
      appended_target = appended_target + written_count;
    }
    freed_source = freed_source + freed_count;
    source_mass = source_mass + max(materialization_rows[offset + 16u], 0.0);
    target_mass = target_mass + max(materialization_rows[offset + 17u], 0.0);
    mass_residual_max = max(mass_residual_max, abs(materialization_rows[offset + 18u]));
  }

  wg_admitted_rows[local_index] = admitted_rows;
  wg_written_target[local_index] = written_target;
  wg_appended_target[local_index] = appended_target;
  wg_freed_source[local_index] = freed_source;
  wg_source_mass[local_index] = source_mass;
  wg_target_mass[local_index] = target_mass;
  wg_mass_residual_max[local_index] = mass_residual_max;
  wg_blocked_rows[local_index] = blocked_rows;
  workgroupBarrier();

  if (local_index == 0u) {
    var sum_admitted = 0.0;
    var sum_written = 0.0;
    var sum_appended = 0.0;
    var sum_freed = 0.0;
    var sum_source_mass = 0.0;
    var sum_target_mass = 0.0;
    var max_mass_residual = 0.0;
    var sum_blocked = 0.0;
    for (var index = 0u; index < SCHROEDER_PSC_WORKGROUP_SIZE; index = index + 1u) {
      sum_admitted = sum_admitted + wg_admitted_rows[index];
      sum_written = sum_written + wg_written_target[index];
      sum_appended = sum_appended + wg_appended_target[index];
      sum_freed = sum_freed + wg_freed_source[index];
      sum_source_mass = sum_source_mass + wg_source_mass[index];
      sum_target_mass = sum_target_mass + wg_target_mass[index];
      max_mass_residual = max(max_mass_residual, wg_mass_residual_max[index]);
      sum_blocked = sum_blocked + wg_blocked_rows[index];
    }
    summary_row[0] = f32(params.materialization_row_count);
    summary_row[1] = sum_admitted;
    summary_row[2] = sum_written;
    summary_row[3] = sum_appended;
    summary_row[4] = sum_freed;
    summary_row[5] = sum_appended;
    summary_row[6] = sum_source_mass;
    summary_row[7] = sum_target_mass;
    summary_row[8] = max_mass_residual;
    summary_row[9] = sum_blocked;
    summary_row[10] = f32(params.source_particle_count);
    summary_row[11] = f32(params.source_particle_count) + sum_appended;
    summary_row[12] = 0.0;
    summary_row[13] = 0.0;
    summary_row[14] = 1.0;
    summary_row[15] = f32(params.flags);
  }
}
`;

export const schroederParticleStorageCompactionWgsl = `
struct SchroederParticleStorageCompactionParams {
  scan_slot_count: u32,
  state_vec4_stride: u32,
  thermo_vec4_stride: u32,
  mechanics_vec4_stride: u32,
  source_particle_count: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> in_sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> in_sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> in_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> out_sph_state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> out_sph_thermo: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> out_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> summary_row: array<f32>;
@group(0) @binding(7) var<uniform> params: SchroederParticleStorageCompactionParams;
@group(0) @binding(8) var<storage, read> in_particle_identity: array<u32>;
@group(0) @binding(9) var<storage, read_write> out_particle_identity: array<u32>;

const SCHROEDER_PSCOMP_WORKGROUP_SIZE: u32 = 64u;

var<workgroup> wg_live_counts: array<u32, 64>;
var<workgroup> wg_chunk_bases: array<u32, 64>;
var<workgroup> wg_live_mass: array<f32, 64>;
var<workgroup> wg_hole_count: array<f32, 64>;

fn ss_pscomp_slot_live(slot: u32) -> bool {
  let state_stride = max(params.state_vec4_stride, 2u);
  return in_sph_state[slot * state_stride].w > 0.0;
}

fn ss_pscomp_copy_slot(source_slot: u32, target_slot: u32) {
  let state_stride = max(params.state_vec4_stride, 2u);
  let thermo_stride = max(params.thermo_vec4_stride, 3u);
  let mechanics_stride = max(params.mechanics_vec4_stride, 8u);
  for (var part = 0u; part < state_stride; part = part + 1u) {
    out_sph_state[target_slot * state_stride + part] = in_sph_state[source_slot * state_stride + part];
  }
  for (var part = 0u; part < thermo_stride; part = part + 1u) {
    out_sph_thermo[target_slot * thermo_stride + part] = in_sph_thermo[source_slot * thermo_stride + part];
  }
  for (var part = 0u; part < mechanics_stride; part = part + 1u) {
    out_mls_mechanics[target_slot * mechanics_stride + part] =
      in_mls_mechanics[source_slot * mechanics_stride + part];
  }
  out_particle_identity[target_slot] = in_particle_identity[source_slot];
}

// Order-preserving stream compaction over the particle live range: freed
// (zero-mass) slots left by admitted split/merge materialization are removed
// so live particles occupy a dense [0, liveCount) range. One workgroup owns
// the pass: each thread counts live slots in its contiguous chunk, thread 0
// computes the exclusive prefix, then each thread scatters its chunk in
// order. Deterministic, no atomics; output buffers must be freshly created
// (WebGPU zero-initializes) so trailing slots stay empty.
@compute @workgroup_size(64)
fn main(@builtin(local_invocation_id) local_id: vec3<u32>) {
  let local_index = local_id.x;
  let chunk = (params.scan_slot_count + SCHROEDER_PSCOMP_WORKGROUP_SIZE - 1u)
    / SCHROEDER_PSCOMP_WORKGROUP_SIZE;
  let chunk_start = local_index * chunk;
  let chunk_end = min(chunk_start + chunk, params.scan_slot_count);

  var live_count = 0u;
  var live_mass = 0.0;
  var hole_count = 0.0;
  for (var slot = chunk_start; slot < chunk_end; slot = slot + 1u) {
    if (ss_pscomp_slot_live(slot)) {
      live_count = live_count + 1u;
      live_mass = live_mass + in_sph_state[slot * max(params.state_vec4_stride, 2u)].w;
    } else {
      hole_count = hole_count + 1.0;
    }
  }
  wg_live_counts[local_index] = live_count;
  wg_live_mass[local_index] = live_mass;
  wg_hole_count[local_index] = hole_count;
  workgroupBarrier();

  if (local_index == 0u) {
    var base = 0u;
    for (var index = 0u; index < SCHROEDER_PSCOMP_WORKGROUP_SIZE; index = index + 1u) {
      wg_chunk_bases[index] = base;
      base = base + wg_live_counts[index];
    }
  }
  workgroupBarrier();

  var target_slot = wg_chunk_bases[local_index];
  for (var slot = chunk_start; slot < chunk_end; slot = slot + 1u) {
    if (ss_pscomp_slot_live(slot)) {
      ss_pscomp_copy_slot(slot, target_slot);
      target_slot = target_slot + 1u;
    }
  }
  workgroupBarrier();

  if (local_index == 0u) {
    var total_live = 0.0;
    var total_mass = 0.0;
    var total_holes = 0.0;
    for (var index = 0u; index < SCHROEDER_PSCOMP_WORKGROUP_SIZE; index = index + 1u) {
      total_live = total_live + f32(wg_live_counts[index]);
      total_mass = total_mass + wg_live_mass[index];
      total_holes = total_holes + wg_hole_count[index];
    }
    summary_row[0] = f32(params.scan_slot_count);
    summary_row[1] = total_live;
    summary_row[2] = total_holes;
    summary_row[3] = total_mass;
    summary_row[4] = f32(params.source_particle_count);
    summary_row[5] = total_live - f32(params.source_particle_count);
    summary_row[6] = 0.0;
    summary_row[7] = 0.0;
    summary_row[8] = 0.0;
    summary_row[9] = 0.0;
    summary_row[10] = 0.0;
    summary_row[11] = total_live;
    summary_row[12] = 0.0;
    summary_row[13] = 0.0;
    summary_row[14] = 1.0;
    summary_row[15] = f32(params.flags);
  }
}
`;
