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
  _pad1: f32,
  _pad2: f32,
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

fn thermal_temperature_slope(material_id: f32, specific_internal_energy: f32) -> f32 {
  var material_response_offset = 0u;
  var material_response_count = 0u;
  var found_material = false;
  for (var record_index = 0u; record_index < params.material_count; record_index = record_index + 1u) {
    let record = phase_response_records[record_index];
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

  var selected = material_response_offset;
  for (var local = 0u; local < material_response_count; local = local + 1u) {
    let candidate = material_response_offset + local;
    let row1 = response_row1(candidate);
    selected = candidate;
    if (specific_internal_energy <= row1.y || local + 1u == material_response_count) {
      break;
    }
  }

  let response0 = response_row0(selected);
  if (response0.w != 1.0 || response0.z < 0.0) {
    return 0.0;
  }
  return temperature_slope_from_graph(u32(response0.z), specific_internal_energy);
}

fn material_bank_warm_input_anchor() -> f32 {
  if (params.material_bank_warm_input_row_count == 0u) {
    return 0.0;
  }
  // Non-authoritative warm-input presence probe. The value is intentionally
  // zeroed so closure-derived thermal graphs remain the only thermal source.
  return material_bank_warm_input_rows[0u].x * 0.0;
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
    let record = phase_response_records[record_index];
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
  let position = vec3<f32>(pos_mass.x, pos_mass.y, pos_mass.z);
  let mass = max(pos_mass.w, 1.0e-30);
  let temperature = row0.z;
	  let temperature_slope = thermal_temperature_slope(row0.x, vel_u.w);
	  let support = 2.0 * params.smoothing_length_m;
	  var du = material_bank_warm_input_anchor();
	  var conduction_du = 0.0;
	  var neighbor_min_temperature = temperature;
	  var neighbor_max_temperature = temperature;

	  for (var other = 0u; other < params.particle_count; other = other + 1u) {
	    if (other == particle_index) {
      continue;
    }
	    let other_pos_mass = state_pos_mass(other);
	    let delta = position - vec3<f32>(other_pos_mass.x, other_pos_mass.y, other_pos_mass.z);
	    let distance = length(delta);
	    if (distance < support) {
	      let weight = 1.0 - distance / support;
	      let other_row0 = thermo_row0(other);
	      let other_vel_u = state_vel_u(other);
	      let other_temperature = other_row0.z;
	      neighbor_min_temperature = min(neighbor_min_temperature, other_temperature);
	      neighbor_max_temperature = max(neighbor_max_temperature, other_temperature);
	      let other_temperature_slope = thermal_temperature_slope(other_row0.x, other_vel_u.w);
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
	      let current_temperature = temperature + du * temperature_slope;
	      let raw_du_specific = params.wall_rate * (face_wall_temperature - current_temperature) * weight * params.dt / mass;
	      du = du + clamp_wall_du_specific(raw_du_specific, current_temperature, face_wall_temperature, temperature_slope);
	    }
	  }

  let next_u = vel_u.w + du;
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
  _pad0: u32,
  _pad1: u32,
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

const REACTION_PARTICLE_RECORD_VEC4S: u32 = 13u;

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
    let record = phase_response_records[record_index];
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

fn copy_particle(index: u32) {
  let base = index * REACTION_PARTICLE_RECORD_VEC4S;
  for (var row = 0u; row < REACTION_PARTICLE_RECORD_VEC4S; row = row + 1u) {
    out_particle_records[base + row] = particle_records[base + row];
  }
}

fn copy_particle_with_mass(index: u32, mass_kg: f32) {
  copy_particle(index);
  let base = index * REACTION_PARTICLE_RECORD_VEC4S;
  let pos_mass = particle_records[base];
  out_particle_records[base] = vec4<f32>(pos_mass.x, pos_mass.y, pos_mass.z, max(mass_kg, 0.0));
  let rest_density = particle_records[base + 2u].w;
  if (rest_density > 0.0) {
    let mechanics_base = base + 5u;
    let volume_row = out_particle_records[mechanics_base + 4u];
    out_particle_records[mechanics_base + 4u] = vec4<f32>(volume_row.x, volume_row.y, volume_row.z, max(mass_kg, 0.0) / rest_density);
  }
}

fn write_reacted_mechanics(index: u32, mass_kg: f32, resolved: ThermalRows) {
  let mechanics = find_product_mechanics(resolved.row0.x, resolved.row0.y);
  var rest_density = resolved.row0.w;
  if (rest_density <= 0.0) {
    rest_density = mechanics.rest_density;
  }
  var rest_volume = 0.0;
  if (rest_density > 0.0) {
    rest_volume = mass_kg / rest_density;
  }
  let out_base = index * REACTION_PARTICLE_RECORD_VEC4S + 5u;
  out_particle_records[out_base] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  out_particle_records[out_base + 1u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  out_particle_records[out_base + 2u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  out_particle_records[out_base + 3u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  out_particle_records[out_base + 4u] = vec4<f32>(0.0, 0.0, 1.0, rest_volume);
  out_particle_records[out_base + 5u] = vec4<f32>(mechanics.solid, mechanics.status, mechanics.bulk, mechanics.shear);
  out_particle_records[out_base + 6u] = vec4<f32>(mechanics.lambda, mechanics.sound_speed, mechanics.eos_model, mechanics.status);
  out_particle_records[out_base + 7u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
}

fn write_product_particle(index: u32, material_id: f32, mass_kg: f32, next_u: f32) {
  let pos_mass = state_pos_mass(index);
  let vel_u = state_vel_u(index);
  let source_row2 = thermo_row2(index);
  let resolved = resolve_thermal_rows(material_id, next_u, source_row2);
  let out_base = index * REACTION_PARTICLE_RECORD_VEC4S;
  out_particle_records[out_base] = vec4<f32>(pos_mass.x, pos_mass.y, pos_mass.z, max(mass_kg, 0.0));
  out_particle_records[out_base + 1u] = vec4<f32>(vel_u.x, vel_u.y, vel_u.z, next_u);
  out_particle_records[out_base + 2u] = resolved.row0;
  out_particle_records[out_base + 3u] = resolved.row1;
  out_particle_records[out_base + 4u] = resolved.row2;
  if (params.reset_mechanics != 0u) {
    write_reacted_mechanics(index, max(mass_kg, 0.0), resolved);
  } else {
    let mechanics_base = index * REACTION_PARTICLE_RECORD_VEC4S + 5u;
    for (var row = 0u; row < 8u; row = row + 1u) {
      out_particle_records[mechanics_base + row] = particle_records[mechanics_base + row];
    }
  }
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
      return ReactantTerm(term0.y, term0.z, term0.w, term2.z);
    }
  }
  return ReactantTerm(0.0, 0.0, 0.0, 0.0);
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
    if (reaction_particle_bin_ready()) {
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
  if (proposal.x < 0.0 || proposal.y < 0.0) {
    copy_particle(particle_index);
    return;
  }
  let partner_index = u32(proposal.x + 0.5);
  if (partner_index >= params.particle_count) {
    copy_particle(particle_index);
    return;
  }
  let partner_proposal = proposals[partner_index];
  if (partner_proposal.x < 0.0 || u32(partner_proposal.x + 0.5) != particle_index || partner_proposal.y != proposal.y) {
    copy_particle(particle_index);
    return;
  }

  let reaction_index = u32(proposal.y + 0.5);
  let rx0 = reaction_row0(reaction_index);
  let rx1 = reaction_row1(reaction_index);
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let pos_mass = state_pos_mass(particle_index);
  let partner_pos_mass = state_pos_mass(partner_index);
  let vel_u = state_vel_u(particle_index);
  let partner_vel_u = state_vel_u(partner_index);
  let self_thermo = thermo_row0(particle_index);
  let partner_thermo = thermo_row0(partner_index);
  let product_term_count = u32(max(header1.x, 0.0));
  let self_term = reactant_term_for_material(reaction_index, self_thermo.x);
  let partner_term = reactant_term_for_material(reaction_index, partner_thermo.x);
  let has_stoichiometry = self_term.status == 1.0
    && partner_term.status == 1.0
    && self_term.coefficient > 0.0
    && partner_term.coefficient > 0.0
    && self_term.molar_mass > 0.0
    && partner_term.molar_mass > 0.0
    && product_term_count > 0u;

  if (!has_stoichiometry) {
    var legacy_product_material_id = rx0.z;
    var legacy_next_mass = pos_mass.w;
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
    }
    write_product_particle(particle_index, legacy_product_material_id, legacy_next_mass, legacy_next_u);
    return;
  }

  let self_limiting_extent = pos_mass.w / max(self_term.coefficient * self_term.molar_mass, 1.0e-20);
  let partner_limiting_extent = partner_pos_mass.w / max(partner_term.coefficient * partner_term.molar_mass, 1.0e-20);
  let extent_mol = min(self_limiting_extent, partner_limiting_extent);
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
  let source0_consumed = min(source0_pos_mass.w, extent_mol * source0_term.coefficient * source0_term.molar_mass);
  let source1_consumed = min(source1_pos_mass.w, extent_mol * source1_term.coefficient * source1_term.molar_mass);
  let source0_remaining = max(source0_pos_mass.w - source0_consumed, 0.0);
  let source1_remaining = max(source1_pos_mass.w - source1_consumed, 0.0);
  let source0_free = source0_remaining <= max(source0_pos_mass.w, 1.0) * 1.0e-7;
  let source1_free = source1_remaining <= max(source1_pos_mass.w, 1.0) * 1.0e-7;
  let product_u = ((self_consumed * vel_u.w) + (partner_consumed * partner_vel_u.w) - rx1.x * consumed_mass) / consumed_mass;
  let product_mass_scale = consumed_mass / raw_product_mass;

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
      let product_term = product_term_for_visible_slot(reaction_index, local_product_slot);
      emitted_product_mass = extent_mol * product_term.coefficient * product_term.molar_mass * product_mass_scale;
    }
  }

  if (emits_product) {
    let product_term = product_term_for_visible_slot(reaction_index, local_product_slot);
    if (product_term.status == 1.0 && product_term.material_id > 0.0 && emitted_product_mass > 0.0) {
      write_product_particle(particle_index, product_term.material_id, emitted_product_mass, product_u);
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
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
  _pad3: u32,
};

struct ReactantTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  status: f32,
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

fn reactant_term_for_material(reaction_index: u32, material_id: f32) -> ReactantTerm {
  let header0 = reaction_header_row0(reaction_index);
  let reactant_term_offset = u32(max(header0.y, 0.0));
  let reactant_term_count = u32(max(header0.z, 0.0));
  for (var local = 0u; local < reactant_term_count; local = local + 1u) {
    let term_index = reactant_term_offset + local;
    let term0 = reactant_term_row0(term_index);
    let term2 = reactant_term_row2(term_index);
    if (term0.y == material_id && term2.z == 1.0) {
      return ReactantTerm(term0.y, term0.z, term0.w, term2.z);
    }
  }
  return ReactantTerm(0.0, 0.0, 0.0, 0.0);
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
              let extent_mol = min(self_extent, partner_extent);
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
  _pad1: u32,
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
  _pad1: u32,
  _pad2: u32,
  _pad3: u32,
};

struct ReactantTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  status: f32,
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

fn reactant_term_for_material(reaction_index: u32, material_id: f32) -> ReactantTerm {
  let header0 = reaction_header_row0(reaction_index);
  let reactant_term_offset = u32(max(header0.y, 0.0));
  let reactant_term_count = u32(max(header0.z, 0.0));
  for (var local = 0u; local < reactant_term_count; local = local + 1u) {
    let term_index = reactant_term_offset + local;
    let term0 = reactant_term_row0(term_index);
    let term2 = reactant_term_row2(term_index);
    if (term0.y == material_id && term2.z == 1.0) {
      return ReactantTerm(term0.y, term0.z, term0.w, term2.z);
    }
  }
  return ReactantTerm(0.0, 0.0, 0.0, 0.0);
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
      let extent_mol = min(source_extent, partner_extent);
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
  _pad1: u32,
  _pad2: u32,
  _pad3: u32,
};

struct ReactantTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  status: f32,
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

fn reactant_term_for_material(reaction_index: u32, material_id: f32) -> ReactantTerm {
  let header0 = reaction_header_row0(reaction_index);
  let reactant_term_offset = u32(max(header0.y, 0.0));
  let reactant_term_count = u32(max(header0.z, 0.0));
  for (var local = 0u; local < reactant_term_count; local = local + 1u) {
    let term_index = reactant_term_offset + local;
    let term0 = reactant_term_row0(term_index);
    let term2 = reactant_term_row2(term_index);
    if (term0.y == material_id && term2.z == 1.0) {
      return ReactantTerm(term0.y, term0.z, term0.w, term2.z);
    }
  }
  return ReactantTerm(0.0, 0.0, 0.0, 0.0);
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
  let extent_mol = min(source_extent, partner_extent);
  let source_consumed = min(source_pos_mass.w, extent_mol * source_term.coefficient * source_term.molar_mass);
  let partner_consumed = min(partner_source_pos_mass.w, extent_mol * partner_term.coefficient * partner_term.molar_mass);
  let consumed_mass = source_consumed + partner_consumed;
  let raw_product_mass = product_raw_mass_sum_for_extent(reaction_index, extent_mol);
  if (extent_mol <= 0.0 || consumed_mass <= 0.0 || raw_product_mass <= 0.0) {
    return;
  }
  let mass_scale = consumed_mass / raw_product_mass;
  let row_mass = extent_mol * coefficient * molar_mass * mass_scale;
  let row_moles = row_mass / molar_mass;
	  let next0 = next_thermo[particle_index * 3u];
	  let next1 = next_thermo[partner_index * 3u];
	  var visible_mass_kg = 0.0;
	  var phase_id = target_phase_id;
	  var temperature_k = 0.5 * (source_row0.z + partner_source_row0.z);
	  var rest_density_kg_per_m3 = 0.0;
	  if (next0.x == material_id) {
	    visible_mass_kg = visible_mass_kg + next_state[particle_index * 2u].w;
	    phase_id = select(phase_id, next0.y, phase_id <= 0.0);
	    temperature_k = next0.z;
	    rest_density_kg_per_m3 = next0.w;
	  }
	  if (next1.x == material_id) {
	    visible_mass_kg = visible_mass_kg + next_state[partner_index * 2u].w;
	    phase_id = select(phase_id, next1.y, phase_id <= 0.0);
	    temperature_k = next1.z;
	    rest_density_kg_per_m3 = next1.w;
	  }
  let unplaced_mass_kg = max(row_mass - visible_mass_kg, 0.0);
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
	  let support_volume_m3 = select(
	    0.0,
	    unplaced_mass_kg / max(rest_density_kg_per_m3, 1.0e-20),
	    unplaced_mass_kg > 0.0 && rest_density_kg_per_m3 > 0.0
	  );
	  let midpoint = 0.5 * (source_pos_mass.xyz + partner_source_pos_mass.xyz);
	  product_events[out_base] = vec4<f32>(midpoint.x, midpoint.y, midpoint.z, row_mass);
	  product_events[out_base + 1u] = vec4<f32>(material_id, f32(product_term_index), f32(reaction_index), f32(particle_index));
	  product_events[out_base + 2u] = vec4<f32>(f32(partner_index), row_moles, routing_id, phase_id);
	  product_events[out_base + 3u] = vec4<f32>(visible_mass_kg, unplaced_mass_kg, coefficient, molar_mass);
	  product_events[out_base + 4u] = vec4<f32>(temperature_k, rest_density_kg_per_m3, 1.0, 0.0);
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
	    0.0
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
  _pad1: u32,
  _pad2: u32,
  _pad3: u32,
};

struct ReactantTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  status: f32,
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

fn reactant_term_for_material(reaction_index: u32, material_id: f32) -> ReactantTerm {
  let header0 = reaction_header_row0(reaction_index);
  let reactant_term_offset = u32(max(header0.y, 0.0));
  let reactant_term_count = u32(max(header0.z, 0.0));
  for (var local = 0u; local < reactant_term_count; local = local + 1u) {
    let term_index = reactant_term_offset + local;
    let term0 = reactant_term_row0(term_index);
    let term2 = reactant_term_row2(term_index);
    if (term0.y == material_id && term2.z == 1.0) {
      return ReactantTerm(term0.y, term0.z, term0.w, term2.z);
    }
  }
  return ReactantTerm(0.0, 0.0, 0.0, 0.0);
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
      let extent_mol = min(source_extent, partner_extent);
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
  _pad1: u32,
  _pad2: u32,
  _pad3: u32,
};

struct ReactantTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  status: f32,
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

fn reactant_term_for_material(reaction_index: u32, material_id: f32) -> ReactantTerm {
  let header0 = reaction_header_row0(reaction_index);
  let reactant_term_offset = u32(max(header0.y, 0.0));
  let reactant_term_count = u32(max(header0.z, 0.0));
  for (var local = 0u; local < reactant_term_count; local = local + 1u) {
    let term_index = reactant_term_offset + local;
    let term0 = reactant_term_row0(term_index);
    let term2 = reactant_term_row2(term_index);
    if (term0.y == material_id && term2.z == 1.0) {
      return ReactantTerm(term0.y, term0.z, term0.w, term2.z);
    }
  }
  return ReactantTerm(0.0, 0.0, 0.0, 0.0);
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
      let extent_mol = min(source_extent, partner_extent);
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

const RENDER_ROW_VEC4_STRIDE: u32 = 4u;
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
  render_rows[render_row_base] = pos_mass;
  render_rows[render_row_base + 1u] = vec4<f32>(thermo0.x, thermo0.y, thermo0.z, thermo2.z);
  render_rows[render_row_base + 2u] = vec4<f32>(thermo0.w, thermo1.z, thermo2.y, render_domain_id);
  render_rows[render_row_base + 3u] = vec4<f32>(current_volume_m3, particle_radius_m, effective_volume_ratio_j, pressure_pa);
}
`;

export const sphRenderFieldWgsl = `
struct RenderFieldParams {
	  particle_count: u32,
	  surface_count: u32,
	  total_field_cells: u32,
	  product_event_count: u32,
  field_padding: f32,
  ref_edge_m: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
	@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> render_field_cells: array<vec4<f32>>;
	@group(0) @binding(3) var<uniform> params: RenderFieldParams;
	@group(0) @binding(4) var<storage, read> product_events: array<vec4<f32>>;

const RENDER_FIELD_RENDER_ROW_VEC4_STRIDE: u32 = 4u;

fn render_row0(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_FIELD_RENDER_ROW_VEC4_STRIDE];
}

fn render_row1(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_FIELD_RENDER_ROW_VEC4_STRIDE + 1u];
}

fn render_row2(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_FIELD_RENDER_ROW_VEC4_STRIDE + 2u];
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
  let color = vec3<f32>(s2.y, s2.z, s2.w);
  let span = 1.0 - 2.0 * params.field_padding;
  let ref_edge = max(params.ref_edge_m, 1.0e-12);

  var density = 0.0;
  var palette = vec3<f32>(0.0, 0.0, 0.0);
	  for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
    let row0 = render_row0(particle_index);
    let row1 = render_row1(particle_index);
    let row2 = render_row2(particle_index);
    if (
      row1.x != material_id
      || row1.y != phase_id
      || (render_domain_id > 0.0 && row2.w != render_domain_id)
    ) {
      continue;
    }
    let particle = vec3<f32>(
      clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
      clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
      clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
    );
    let delta = cell - particle;
    let dist2 = dot(delta, delta);
    let value = strength / (0.000001 + dist2) - subtract;
	    if (value > 0.0) {
	      density = density + value;
	      let ratio = sqrt(dist2) / max(support_norm, 1.0e-6);
	      palette = palette + color * smooth_palette_weight(ratio);
	    }
	  }

	  for (var event_index = 0u; event_index < params.product_event_count; event_index = event_index + 1u) {
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

  let out_index = field_offset + cell_index;
  if (out_index < params.total_field_cells) {
    render_field_cells[out_index] = vec4<f32>(density, palette);
  }
}
`;

export const sphMaterialInterfaceCandidatesWgsl = `
struct InterfaceCandidateParams {
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

  let value = render_field_cells[field_offset + cell_index].x;
  let neighbor = render_field_cells[field_offset + field_index_3d(nx, ny, nz, resolution)].x;
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
  _pad0: u32,
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

fn compact_surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn compact_surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn compact_field_index_3d(x: u32, y: u32, z: u32, resolution: u32) -> u32 {
  return z * resolution * resolution + y * resolution + x;
}

fn compact_write_candidate(row0: vec4<f32>, row1: vec4<f32>, row2: vec4<f32>, row3: vec4<f32>) {
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

  let value = render_field_cells[field_offset + cell_index].x;
  let neighbor = render_field_cells[field_offset + compact_field_index_3d(nx, ny, nz, resolution)].x;
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
  compact_write_candidate(
    vec4<f32>(f32(surface_index), s0.x, s0.y, f32(axis)),
    vec4<f32>(centroid, area_m2),
    vec4<f32>(normal, normal_area.x),
    vec4<f32>(normal_area.y, normal_area.z, sign, 1.0)
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
  return render_field_cells[field_offset + mc_field_index_3d(x, y, z, resolution)].x;
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
    let density = render_field_cells[field_offset + cell_index].x;
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
  return render_field_cells[field_offset + sv_field_index_3d(x, y, z, resolution)].x;
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
  } else if (next_j > MECHANICS_MAX_VOLUME_RATIO_J) {
    let scale = cubic_root_positive(MECHANICS_MAX_VOLUME_RATIO_J / max(next_j, 1.0e-12));
    nf00 = nf00 * scale; nf01 = nf01 * scale; nf02 = nf02 * scale;
    nf10 = nf10 * scale; nf11 = nf11 * scale; nf12 = nf12 * scale;
    nf20 = nf20 * scale; nf21 = nf21 * scale; nf22 = nf22 * scale;
    next_j = MECHANICS_MAX_VOLUME_RATIO_J;
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
  pad1: u32,
};

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
    return max(0.0, sound_speed_m_per_s * sound_speed_m_per_s * (density_kg_per_m3 - rest_density_kg_per_m3));
  }
  if (eos_model_id > 0.5 && eos_model_id < 1.5) {
    let ratio = density_kg_per_m3 / max(rest_density_kg_per_m3, 1.0e-9);
    let pressure = (rest_density_kg_per_m3 * sound_speed_m_per_s * sound_speed_m_per_s / 7.0)
      * (pow(ratio, 7.0) - 1.0);
    return pressure;
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
  let f00 = row0.x; let f01 = row0.y; let f02 = row0.z;
  let f10 = row0.w; let f11 = row1.x; let f12 = row1.y;
  let f20 = row1.z; let f21 = row1.w; let f22 = row2.x;
  let c00 = row2.y; let c01 = row2.z; let c02 = row2.w;
  let c10 = row3.x; let c11 = row3.y; let c12 = row3.z;
  let c20 = row3.w; let c21 = row4.x; let c22 = row4.y;
  let volume = max(row4.w * max(row4.z, 1.0e-9), 0.0);
  var sigma = StressRows(vec3<f32>(0.0), vec3<f32>(0.0), vec3<f32>(0.0));
  if (params.dt != 0.0 && volume > 0.0) {
    if (row5.x > 0.5 && row5.w > 0.0) {
      sigma = corotated_stress(
        f00, f01, f02,
        f10, f11, f12,
        f20, f21, f22,
        row5.w,
        row6.x
      );
    } else {
      let density = pos_mass.w / max(volume, 1.0e-30);
      let pressure = params.internal_pressure_scale * (
        packed_pressure(density, thermo0.w, row6.y, row6.z) + max(row7.x, 0.0)
      );
      let dynamic_viscosity = max(row7.y, 0.0);
      let div_third = (c00 + c11 + c22) / 3.0;
      let visc00 = 2.0 * dynamic_viscosity * (c00 - div_third);
      let visc11 = 2.0 * dynamic_viscosity * (c11 - div_third);
      let visc22 = 2.0 * dynamic_viscosity * (c22 - div_third);
      let visc01 = dynamic_viscosity * (c01 + c10);
      let visc02 = dynamic_viscosity * (c02 + c20);
      let visc12 = dynamic_viscosity * (c12 + c21);
      sigma = StressRows(
        vec3<f32>(-pressure + visc00, visc01, visc02),
        vec3<f32>(visc01, -pressure + visc11, visc12),
        vec3<f32>(visc02, visc12, -pressure + visc22)
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
    let speed2 = dot(velocity, velocity);
    if (speed2 > vmax * vmax) {
      velocity = velocity * (vmax / sqrt(speed2));
    }
    let node_pos = row1.xyz;
    let boundary_epsilon_m = max(1.0e-7, abs(params.grid_spacing_m) * 1.0e-6);
    let floor_no_slip_limit_m = params.grid_spacing_m - boundary_epsilon_m;
    if (node_pos.y < floor_no_slip_limit_m) {
      let floor_gap_m = max(0.0, node_pos.y);
      let floor_response_alpha = wall_barrier_response_alpha(mass, floor_gap_m);
      velocity.y = wall_barrier_corrected_normal_velocity(velocity.y, mass, floor_gap_m);
      let tangential_keep = 1.0 - floor_response_alpha;
      velocity.x = velocity.x * tangential_keep;
      velocity.z = velocity.z * tangential_keep;
      if (floor_response_alpha >= 1.0 - 1.0e-6) {
        velocity.x = 0.0;
        velocity.z = 0.0;
      }
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
};

@group(0) @binding(0) var<storage, read> interface_elements: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> pressure_force_rows: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: PressureInterfaceParams;
@group(0) @binding(3) var<storage, read> gas_pressure_cells: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> contact_policy_rows: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> contact_kinematics_rows: array<vec4<f32>>;

fn pressure_for_centroid(centroid: vec3<f32>) -> f32 {
  if (params.pressure_model_id != 1u || params.gas_pressure_cell_count == 0u) {
    return params.pressure_pa;
  }
  var best_pressure = params.pressure_pa;
  var best_distance2 = 1.0e30;
  for (var cell_index = 0u; cell_index < params.gas_pressure_cell_count; cell_index = cell_index + 1u) {
    let row0 = gas_pressure_cells[cell_index * 3u];
    let row1 = gas_pressure_cells[cell_index * 3u + 1u];
    let row2 = gas_pressure_cells[cell_index * 3u + 2u];
    if (row0.w > 0.0 && row1.w >= 0.0) {
      let delta = centroid - row1.xyz;
      let distance2 = dot(delta, delta);
      if (distance2 < best_distance2) {
        best_distance2 = distance2;
        best_pressure = max(0.0, row1.w + dot(row2.xyz, delta));
      }
    }
  }
  return best_pressure;
}

fn contact_pressure_for_element(material_id: f32, phase_id: f32, area_m2: f32, kinematics: vec4<f32>) -> f32 {
  if (params.contact_pair_response_enabled <= 0.0 || params.contact_policy_row_count == 0u) {
    return 0.0;
  }
  if (kinematics.w <= 0.0) {
    return 0.0;
  }
  var selected_pressure = 0.0;
  for (var row_index = 0u; row_index < params.contact_policy_row_count; row_index = row_index + 1u) {
    let row0 = contact_policy_rows[row_index * 4u];
    let row1 = contact_policy_rows[row_index * 4u + 1u];
    let row2 = contact_policy_rows[row_index * 4u + 2u];
    let status = row2.y;
    let material_match = abs(material_id - row0.x) < 0.5 || abs(material_id - row0.y) < 0.5;
    let phase_row_a = row0.z;
    let phase_row_b = row0.w;
    let phase_match = (phase_row_a <= 0.5 && phase_row_b <= 0.5)
      || abs(phase_id - phase_row_a) < 0.5
      || abs(phase_id - phase_row_b) < 0.5;
    if (status > 0.0 && material_match && phase_match) {
      let support_radius_m = max(row1.z, 1.0e-6);
      let gap_m = max(kinematics.x, 0.0);
      let normal_velocity_m_per_s = kinematics.y;
      let closing_speed_m_per_s = max(-normal_velocity_m_per_s, 0.0);
      if (gap_m > support_radius_m && (closing_speed_m_per_s <= 0.0 || gap_m > support_radius_m * 2.0)) {
        continue;
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
      let contact_pressure_pa = min(
        max(elastic_pressure_pa + damping_pressure_pa + inertial_pressure_pa, 0.0),
        row_cap_pa
      );
      selected_pressure = max(selected_pressure, contact_pressure_pa);
    }
  }
  return selected_pressure;
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
  let gas_pressure_pa = pressure_for_centroid(centroid);
  let contact_pressure_pa = contact_pressure_for_element(row0.y, row0.z, area, contact_kinematics_rows[element_index]);
  let pressure_pa = gas_pressure_pa + contact_pressure_pa;
  var normal_area = vec3<f32>(row2.w, row3.x, row3.y);
  if (dot(normal_area, normal_area) <= 1.0e-24) {
    normal_area = row2.xyz * area;
  }
  let ready = select(0.0, 1.0, status > 0.0 && area > 0.0 && pressure_pa >= 0.0);
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

@group(0) @binding(0) var<storage, read> interface_elements: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> particle_state_rows: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> particle_thermo_rows: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> contact_policy_rows: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> contact_kinematics_rows: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> params: ContactKinematicsParams;
@group(0) @binding(6) var<storage, read> particle_bin_counts: array<u32>;
@group(0) @binding(7) var<storage, read> particle_bin_indices: array<u32>;

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
  target_phase_id: f32
) -> CkParticleCandidate {
  var candidate = CkParticleCandidate(
    0u,
    0u,
    0.0,
    0.0,
    vec3<f32>(0.0),
    0.0
  );
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
  contact_kinematics_rows[element_index] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
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

  if (ck_particle_bin_ready()) {
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
              target_phase_id
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
        target_phase_id
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
  contact_kinematics_rows[element_index] = vec4<f32>(
    gap_m,
    relative_normal_velocity_m_per_s,
    representative_mass_kg,
    1.0
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
  pad_u0: u32,
  pad_u1: u32,
  grid_spacing_m: f32,
  inv_grid_spacing_m: f32,
  dt: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  internal_pressure_scale: f32,
  liquid_wall_damping_alpha: f32,
  liquid_wall_damping_distance_m: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> updated_grid_nodes: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> out_sph_state: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> out_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(6) var<uniform> params: G2pParams;

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

fn g2p_particle_wall_clearance(rest_volume_m3: f32) -> f32 {
  if (rest_volume_m3 <= 0.0) {
    return 0.0;
  }
  var clearance = 0.5 * g2p_cubic_root_positive(rest_volume_m3);
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
  let previous_bounded = g2p_clamp(previous_j, 0.995, 1.005);
  let lower = max(0.995, previous_bounded / 1.5);
  let upper = min(1.005, previous_bounded * 1.5);
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
  } else if (next_j > G2P_MAX_VOLUME_RATIO_J) {
    let scale = g2p_cubic_root_positive(G2P_MAX_VOLUME_RATIO_J / max(next_j, 1.0e-12));
    nf00 = nf00 * scale; nf01 = nf01 * scale; nf02 = nf02 * scale;
    nf10 = nf10 * scale; nf11 = nf11 * scale; nf12 = nf12 * scale;
    nf20 = nf20 * scale; nf21 = nf21 * scale; nf22 = nf22 * scale;
    next_j = G2P_MAX_VOLUME_RATIO_J;
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

fn material_bank_warm_input_anchor() -> f32 {
  if (params.material_bank_warm_input_row_count == 0u) {
    return 0.0;
  }
  return material_bank_warm_input_rows[0u].x * 0.0;
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
  if (previous_rest_volume <= 0.0 || rest_volume <= 0.0) {
    return false;
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
  let phase_mechanics = find_phase_mechanics(thermo0.x, thermo0.y);
  if (phase_mechanics.status != 1.0) {
    return;
  }

  var rest_density = thermo0.w;
  if (rest_density <= 0.0) {
    rest_density = phase_mechanics.rest_density;
  }
  var rest_volume = 0.0;
  if (rest_density > 0.0) {
    rest_volume = max(state0.w, 0.0) / rest_density;
  }
  rest_volume = rest_volume + material_bank_warm_input_anchor();

  var row4 = out_mechanics[mechanics_base + 4u];
  let row5 = out_mechanics[mechanics_base + 5u];
  let row6 = out_mechanics[mechanics_base + 6u];
  if (mechanics_refresh_should_reset(row4, row5, row6, phase_mechanics, rest_volume)) {
    out_mechanics[mechanics_base] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
    out_mechanics[mechanics_base + 1u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
    out_mechanics[mechanics_base + 2u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
    out_mechanics[mechanics_base + 3u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    row4 = vec4<f32>(0.0, 0.0, 1.0, rest_volume);
  }
  out_mechanics[mechanics_base + 4u] = vec4<f32>(row4.x, row4.y, row4.z, rest_volume);
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
  let row7 = out_mechanics[mechanics_base + 7u];
  out_mechanics[mechanics_base + 7u] = vec4<f32>(
    row7.x,
    phase_mechanics.dynamic_viscosity,
    phase_mechanics.surface_tension,
    row7.w
  );
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
  pad_u1: u32,
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

    source_mass = source_mass + source_pos_mass.w;
    next_mass = next_mass + next_pos_mass.w;
    source_momentum = source_momentum + source_pos_mass.w * source_vel_u.xyz;
    next_momentum = next_momentum + next_pos_mass.w * next_vel_u.xyz;
    if (source_pos_mass.w > 0.0) {
      source_position_mass = source_position_mass + source_pos_mass.w * source_pos_mass.xyz;
      source_min = min(source_min, source_pos_mass.xyz);
      source_max = max(source_max, source_pos_mass.xyz);
      source_bounds_status = 1.0;
    }
    if (next_pos_mass.w > 0.0) {
      next_position_mass = next_position_mass + next_pos_mass.w * next_pos_mass.xyz;
      next_min = min(next_min, next_pos_mass.xyz);
      next_max = max(next_max, next_pos_mass.xyz);
      next_bounds_status = 1.0;
    }
    max_speed2 = max(max_speed2, dot(next_vel_u.xyz, next_vel_u.xyz));
    let displacement = next_pos_mass.xyz - source_pos_mass.xyz;
    max_displacement2 = max(max_displacement2, dot(displacement, displacement));
    let particle_speed2 = dot(next_vel_u.xyz, next_vel_u.xyz);
    let in_base_cohort = index >= params.base_start_index && index < params.base_end_index;
    let in_drop_cohort = index >= params.drop_start_index && index < params.drop_end_index;
    if (in_base_cohort && next_pos_mass.w > 0.0) {
      base_cohort_mass = base_cohort_mass + next_pos_mass.w;
      base_cohort_position_mass = base_cohort_position_mass + next_pos_mass.w * next_pos_mass.xyz;
      base_cohort_min = min(base_cohort_min, next_pos_mass.xyz);
      base_cohort_max = max(base_cohort_max, next_pos_mass.xyz);
      base_cohort_max_speed2 = max(base_cohort_max_speed2, particle_speed2);
      base_cohort_status = 1.0;
    }
    if (in_drop_cohort && next_pos_mass.w > 0.0) {
      drop_cohort_mass = drop_cohort_mass + next_pos_mass.w;
      drop_cohort_position_mass = drop_cohort_position_mass + next_pos_mass.w * next_pos_mass.xyz;
      drop_cohort_min = min(drop_cohort_min, next_pos_mass.xyz);
      drop_cohort_max = max(drop_cohort_max, next_pos_mass.xyz);
      drop_cohort_max_speed2 = max(drop_cohort_max_speed2, particle_speed2);
      drop_cohort_status = 1.0;
    }

    let next_j = next_mls_mechanics[mechanics_base + 4u].z;
    min_volume_ratio_j = min(min_volume_ratio_j, next_j);
    max_volume_ratio_j = max(max_volume_ratio_j, next_j);

    let particle_mass = max(next_pos_mass.w, 0.0);
    let phase_fractions = max(thermo_row1, vec4<f32>(0.0));
    phase_mass_solid = phase_mass_solid + particle_mass * phase_fractions.x;
    phase_mass_liquid = phase_mass_liquid + particle_mass * phase_fractions.y;
    phase_mass_gas = phase_mass_gas + particle_mass * phase_fractions.z;
    phase_mass_plasma = phase_mass_plasma + particle_mass * phase_fractions.w;
    phase_mass_total = phase_mass_total + particle_mass * (
      phase_fractions.x + phase_fractions.y + phase_fractions.z + phase_fractions.w
    );

    let temperature_k = thermo_row0.z;
    if (temperature_k > 0.0) {
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
    }
    workgroupBarrier();
    if (stride == 1u) {
      break;
    }
    stride = stride / 2u;
  }

  if (lane == 0u) {
    let partial_base = workgroup_id.x * 21u;
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
  pad_u1: u32,
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

  for (var partial_index = 0u; partial_index < params.partial_count; partial_index = partial_index + 1u) {
    let base = partial_index * 21u;
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
  }

  if (params.particle_count == 0u) {
    min_volume_ratio_j = 0.0;
  }
  if (finite_temperature_count == 0.0) {
    min_temperature_k = 0.0;
    max_temperature_k = 0.0;
  }

  var temperature_mass_weighted_mean_k = 0.0;
  if (phase_mass_total > 0.0) {
    temperature_mass_weighted_mean_k = temperature_mass_sum / phase_mass_total;
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
  return value == value && value > 0.0;
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
  let mass_kg = max(sph_state[state_offset + 3u], 0.0);
  let material_id = sph_thermo[thermo_offset + 0u];
  let phase_id = sph_thermo[thermo_offset + 1u];
  let rest_density_kg_per_m3 = max(sph_thermo[thermo_offset + 3u], 0.0);
  let smoothing_length_m = max(sph_thermo[thermo_offset + 8u], 0.0);
  let visual_radius_m = max(sph_thermo[thermo_offset + 11u], 0.0);
  let volume_ratio_j = max(mls_mpm_mechanics[mechanics_offset + 18u], 0.0);
  let rest_volume_m3 = max(mls_mpm_mechanics[mechanics_offset + 19u], 0.0);
  let mechanics_volume_m3 = rest_volume_m3 * max(volume_ratio_j, 0.000001);
  var represented_volume_m3 = mechanics_volume_m3;
  if (!ss_positive(represented_volume_m3) && ss_positive(rest_density_kg_per_m3) && ss_positive(mass_kg)) {
    represented_volume_m3 = mass_kg / rest_density_kg_per_m3;
  }

  let physical_radius_m = ss_volume_radius(represented_volume_m3);
  var support_radius_m = physical_radius_m * max(params.support_radius_scale, 0.0);
  var status = 1.0;
  if (!ss_positive(support_radius_m)) {
    support_radius_m = max(max(smoothing_length_m, visual_radius_m), params.fallback_support_radius_m);
    status = status + 2.0;
  }
  if (ss_positive(params.min_support_radius_m) && support_radius_m < params.min_support_radius_m) {
    support_radius_m = params.min_support_radius_m;
    status = status + 4.0;
  }
  if (ss_positive(params.max_support_radius_m) && support_radius_m > params.max_support_radius_m) {
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
  level_assignments[assignment_offset + 5u] = mechanics_volume_m3;
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
};

@group(0) @binding(0) var<storage, read> level_assignments: array<f32>;
@group(0) @binding(1) var<storage, read_write> active_nodes: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederActiveNodeParams;

const SCHROEDER_ASSIGNMENT_STRIDE: u32 = 16u;
const SCHROEDER_ACTIVE_NODE_STRIDE: u32 = 16u;

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
  let level = level_assignments[assignment_offset + 0u];
  let native_dx = max(level_assignments[assignment_offset + 1u], 0.000001);
  let support_radius = max(level_assignments[assignment_offset + 2u], 0.0);
  let assignment_status = level_assignments[assignment_offset + 10u];
  let position = vec3<f32>(
    level_assignments[assignment_offset + 12u],
    level_assignments[assignment_offset + 13u],
    level_assignments[assignment_offset + 14u]
  );
  let chart_id = level_assignments[assignment_offset + 15u];
  let tile_spacing = ss_active_tile_spacing(native_dx);
  let support_inflation = max(params.support_inflate_cells, 0.0) * native_dx;
  let expanded_support = support_radius + support_inflation;
  let min_tile = floor((position - vec3<f32>(expanded_support)) / tile_spacing);
  let max_tile = floor((position + vec3<f32>(expanded_support)) / tile_spacing);
  let status = select(32.0, 1.0, assignment_status > 0.0 && support_radius >= 0.0);

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
