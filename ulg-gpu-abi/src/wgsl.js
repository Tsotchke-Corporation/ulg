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
  _pad0: u32,
  _pad1: u32,
};

@group(0) @binding(0) var<storage, read> optical_records: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> optical_queries: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> optical_outputs: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> optical_params: OpticalLookupParams;

fn record_row(record_index: u32, row: u32) -> vec4<f32> {
  return optical_records[record_index * 6u + row];
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

  for (var record_index = 0u; record_index < optical_params.record_count; record_index = record_index + 1u) {
    let row0 = record_row(record_index, 0u);
    if (row0.x == query.x && row0.y == query.y) {
      let row1 = record_row(record_index, 1u);
      let row2 = record_row(record_index, 2u);
      let row4 = record_row(record_index, 4u);
      let row5 = record_row(record_index, 5u);
      matched_index = f32(record_index);
      out0 = vec4<f32>(row1.x, row1.y, row1.z, row2.z);
      out1 = vec4<f32>(row1.w, row2.x, row2.y, row2.w);
      out2 = vec4<f32>(row4.z, row4.w, row5.z, matched_index);
      break;
    }
  }

  optical_outputs[query_index * 3u] = out0;
  optical_outputs[query_index * 3u + 1u] = out1;
  optical_outputs[query_index * 3u + 2u] = out2;
}
`;

export const sphThermalStepWgsl = `
struct ThermalParams {
  particle_count: u32,
  material_count: u32,
  response_count: u32,
  _pad0: u32,
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
    out_sph_thermo[index * 3u + 2u] = vec4<f32>(source_row2.x, source_row2.y, 255.0, 0.0);
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
    out_sph_thermo[index * 3u + 2u] = vec4<f32>(source_row2.x, source_row2.y, 255.0, 0.0);
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
  out_sph_thermo[index * 3u + 2u] = vec4<f32>(source_row2.x, source_row2.y, 1.0, 0.0);
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
  let support = 2.0 * params.smoothing_length_m;
  var du = 0.0;

  for (var other = 0u; other < params.particle_count; other = other + 1u) {
    if (other == particle_index) {
      continue;
    }
    let other_pos_mass = state_pos_mass(other);
    let delta = position - vec3<f32>(other_pos_mass.x, other_pos_mass.y, other_pos_mass.z);
    let distance = length(delta);
    if (distance < support) {
      let weight = 1.0 - distance / support;
      let other_temperature = thermo_row0(other).z;
      let dE = params.conduction_rate * (other_temperature - temperature) * weight * params.dt;
      du = du + dE / mass;
    }
  }

  for (var face = 0u; face < 6u; face = face + 1u) {
    let distance = wall_distance(position, face);
    if (distance < params.wall_layer_m) {
      let weight = 1.0 - distance / params.wall_layer_m;
      let dE = params.wall_rate * (wall_temperature(face) - temperature) * weight * params.dt;
      du = du + dE / mass;
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
  _pad0: u32,
  _pad1: u32,
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

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> phase_response_records: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> phase_responses: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> proposals: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> out_sph_state: array<vec4<f32>>;
@group(0) @binding(9) var<storage, read_write> out_sph_thermo: array<vec4<f32>>;
@group(0) @binding(10) var<storage, read_write> out_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(11) var<uniform> params: ReactionParams;
@group(0) @binding(12) var<storage, read> thermal_graph_nodes: array<vec4<f32>>;
@group(0) @binding(13) var<storage, read> thermal_graph_samples: array<vec4<f32>>;

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
      vec4<f32>(source_row2.x, source_row2.y, 255.0, 0.0)
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
      vec4<f32>(source_row2.x, source_row2.y, 255.0, 0.0)
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
    vec4<f32>(source_row2.x, source_row2.y, 1.0, 0.0)
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
  out_sph_state[index * 2u] = sph_state[index * 2u];
  out_sph_state[index * 2u + 1u] = sph_state[index * 2u + 1u];
  out_sph_thermo[index * 3u] = sph_thermo[index * 3u];
  out_sph_thermo[index * 3u + 1u] = sph_thermo[index * 3u + 1u];
  out_sph_thermo[index * 3u + 2u] = sph_thermo[index * 3u + 2u];
  let mechanics_base = index * 8u;
  for (var row = 0u; row < 8u; row = row + 1u) {
    out_mls_mechanics[mechanics_base + row] = mls_mechanics[mechanics_base + row];
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
  let base = index * 8u;
  out_mls_mechanics[base] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  out_mls_mechanics[base + 1u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  out_mls_mechanics[base + 2u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  out_mls_mechanics[base + 3u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  out_mls_mechanics[base + 4u] = vec4<f32>(0.0, 0.0, 1.0, rest_volume);
  out_mls_mechanics[base + 5u] = vec4<f32>(mechanics.solid, mechanics.status, mechanics.bulk, mechanics.shear);
  out_mls_mechanics[base + 6u] = vec4<f32>(mechanics.lambda, mechanics.sound_speed, mechanics.eos_model, mechanics.status);
  out_mls_mechanics[base + 7u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
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

  var best_partner = -1.0;
  var best_reaction = -1.0;
  var best_role = 0.0;
  var best_distance2 = 3.402823e38;

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
    let contact_radius2 = rx1.y * rx1.y;
    for (var other = 0u; other < params.particle_count; other = other + 1u) {
      if (other == particle_index) {
        continue;
      }
      let other_thermo = thermo_row0(other);
      if (other_thermo.x != partner_material || !phase_mask_satisfied(partner_phase_mask, other_thermo.y)) {
        continue;
      }
      if (max(self_temperature, other_thermo.z) < activation_k) {
        continue;
      }
      let other_pos_mass = state_pos_mass(other);
      let delta = self_pos - vec3<f32>(other_pos_mass.x, other_pos_mass.y, other_pos_mass.z);
      let distance2 = dot(delta, delta);
      if (distance2 > contact_radius2) {
        continue;
      }
      if (
        distance2 < best_distance2
        || (distance2 == best_distance2 && f32(other) < best_partner)
      ) {
        best_partner = f32(other);
        best_reaction = f32(reaction_index);
        best_role = role;
        best_distance2 = distance2;
      }
    }
  }

  proposals[particle_index] = vec4<f32>(best_partner, best_reaction, best_role, best_distance2);
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
  let pos_mass = state_pos_mass(particle_index);
  let vel_u = state_vel_u(particle_index);
  let source_row2 = thermo_row2(particle_index);
  let next_u = vel_u.w - rx1.x;
  let resolved = resolve_thermal_rows(rx0.z, next_u, source_row2);

  out_sph_state[particle_index * 2u] = pos_mass;
  out_sph_state[particle_index * 2u + 1u] = vec4<f32>(vel_u.x, vel_u.y, vel_u.z, next_u);
  out_sph_thermo[particle_index * 3u] = resolved.row0;
  out_sph_thermo[particle_index * 3u + 1u] = resolved.row1;
  out_sph_thermo[particle_index * 3u + 2u] = resolved.row2;
  if (params.reset_mechanics != 0u) {
    write_reacted_mechanics(particle_index, pos_mass.w, resolved);
  } else {
    let mechanics_base = particle_index * 8u;
    for (var row = 0u; row < 8u; row = row + 1u) {
      out_mls_mechanics[mechanics_base + row] = mls_mechanics[mechanics_base + row];
    }
  }
}
`;

export const sphRenderRowsWgsl = `
struct RenderRowsParams {
  particle_count: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> render_rows: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: RenderRowsParams;

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
  render_rows[particle_index * 3u] = pos_mass;
  render_rows[particle_index * 3u + 1u] = vec4<f32>(thermo0.x, thermo0.y, thermo0.z, thermo2.z);
  render_rows[particle_index * 3u + 2u] = vec4<f32>(thermo0.w, thermo1.z, thermo2.y, 0.0);
}
`;

export const sphRenderFieldWgsl = `
struct RenderFieldParams {
  particle_count: u32,
  surface_count: u32,
  total_field_cells: u32,
  _pad0: u32,
  field_padding: f32,
  ref_edge_m: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> render_field_cells: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: RenderFieldParams;

fn render_row0(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * 3u];
}

fn render_row1(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * 3u + 1u];
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
    if (row1.x != material_id || row1.y != phase_id) {
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

  let out_index = field_offset + cell_index;
  if (out_index < params.total_field_cells) {
    render_field_cells[out_index] = vec4<f32>(density, palette);
  }
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
  if (next_j < 0.1) {
    let s = cubic_root_positive(0.1);
    nf00 = s; nf01 = 0.0; nf02 = 0.0;
    nf10 = 0.0; nf11 = s; nf12 = 0.0;
    nf20 = 0.0; nf21 = 0.0; nf22 = s;
    next_j = 0.1;
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
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

struct StressRows {
  x: vec3<f32>,
  y: vec3<f32>,
  z: vec3<f32>,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> grid_nodes: array<vec4<f32>>;
@group(0) @binding(4) var<uniform> params: P2gProjectionParams;

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
    return (rest_density_kg_per_m3 * sound_speed_m_per_s * sound_speed_m_per_s / 7.0)
      * (pow(ratio, 7.0) - 1.0);
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
  let node_index = global_id.x;
  if (node_index >= params.grid_node_count) {
    return;
  }

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

  var mass = 0.0;
  var momentum = vec3<f32>(0.0, 0.0, 0.0);

  for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
    let state_base = particle_index * 2u;
    let thermo_base = particle_index * 3u;
    let mechanics_base = particle_index * 8u;
    let pos_mass = sph_state[state_base];
    let vel_u = sph_state[state_base + 1u];
    let thermo0 = sph_thermo[thermo_base];
    let _thermo_status = sph_thermo[thermo_base + 2u].z;
    let p_grid = pos_mass.xyz * params.inv_grid_spacing_m;
    let base_x = i32(floor(p_grid.x - 0.5));
    let base_y = i32(floor(p_grid.y - 0.5));
    let base_z = i32(floor(p_grid.z - 0.5));
    let ox = node_i - base_x;
    let oy = node_j - base_y;
    let oz = node_k - base_z;
    if (ox < 0 || ox > 2 || oy < 0 || oy > 2 || oz < 0 || oz > 2) {
      continue;
    }

    let wx = quadratic_weights(p_grid.x - f32(base_x));
    let wy = quadratic_weights(p_grid.y - f32(base_y));
    let wz = quadratic_weights(p_grid.z - f32(base_z));
    let weight = weight_at(wx, ox) * weight_at(wy, oy) * weight_at(wz, oz);
    if (weight == 0.0) {
      continue;
    }

    let row0 = mls_mechanics[mechanics_base];
    let row1 = mls_mechanics[mechanics_base + 1u];
    let row2 = mls_mechanics[mechanics_base + 2u];
    let row3 = mls_mechanics[mechanics_base + 3u];
    let row4 = mls_mechanics[mechanics_base + 4u];
    let row5 = mls_mechanics[mechanics_base + 5u];
    let row6 = mls_mechanics[mechanics_base + 6u];
    let f00 = row0.x; let f01 = row0.y; let f02 = row0.z;
    let f10 = row0.w; let f11 = row1.x; let f12 = row1.y;
    let f20 = row1.z; let f21 = row1.w; let f22 = row2.x;
    let c00 = row2.y; let c01 = row2.z; let c02 = row2.w;
    let c10 = row3.x; let c11 = row3.y; let c12 = row3.z;
    let c20 = row3.w; let c21 = row4.x; let c22 = row4.y;
    let dpos = node_pos - pos_mass.xyz;
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
        let pressure = packed_pressure(density, thermo0.w, row6.y, row6.z);
        sigma = StressRows(
          vec3<f32>(-pressure, 0.0, 0.0),
          vec3<f32>(0.0, -pressure, 0.0),
          vec3<f32>(0.0, 0.0, -pressure)
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
    let affine_momentum = vec3<f32>(
      dot(aff_x, dpos),
      dot(aff_y, dpos),
      dot(aff_z, dpos)
    );
    let particle_momentum = pos_mass.w * vel_u.xyz + affine_momentum;
    mass = mass + weight * pos_mass.w;
    momentum = momentum + weight * particle_momentum;
  }

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
  pad_u0: u32,
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
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> p2g_grid_nodes: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> updated_grid_nodes: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: GridUpdateParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let node_index = global_id.x;
  if (node_index >= params.grid_node_count) {
    return;
  }

  let row0 = p2g_grid_nodes[node_index * 2u];
  let row1 = p2g_grid_nodes[node_index * 2u + 1u];
  let mass = row0.x;
  var velocity = vec3<f32>(0.0, 0.0, 0.0);
  var status = 0.0;

  if (mass > 0.0) {
    velocity = row0.yzw / mass + vec3<f32>(params.gravity_x, params.gravity_y, params.gravity_z) * params.dt;
    let vmax = params.cfl_factor * params.grid_spacing_m / max(params.dt, 1.0e-12);
    let speed2 = dot(velocity, velocity);
    if (speed2 > vmax * vmax) {
      velocity = velocity * (vmax / sqrt(speed2));
    }
    let node_pos = row1.xyz;
    if ((node_pos.x < params.grid_spacing_m && velocity.x < 0.0) || (node_pos.x > params.box_x - params.grid_spacing_m && velocity.x > 0.0)) {
      velocity.x = 0.0;
    }
    if ((node_pos.y < params.grid_spacing_m && velocity.y < 0.0) || (node_pos.y > params.box_y - params.grid_spacing_m && velocity.y > 0.0)) {
      velocity.y = 0.0;
    }
    if ((node_pos.z < params.grid_spacing_m && velocity.z < 0.0) || (node_pos.z > params.box_z - params.grid_spacing_m && velocity.z > 0.0)) {
      velocity.z = 0.0;
    }
    status = 1.0;
  }

  updated_grid_nodes[node_index * 2u] = vec4<f32>(mass, velocity.x, velocity.y, velocity.z);
  updated_grid_nodes[node_index * 2u + 1u] = vec4<f32>(row1.x, row1.y, row1.z, status);
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
  pad0: f32,
  pad1: f32,
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

  var position = pos_mass.xyz + params.dt * velocity;
  if (position.x < 0.0) { position.x = 0.0; if (velocity.x < 0.0) { velocity.x = 0.0; } }
  if (position.x > params.box_x) { position.x = params.box_x; if (velocity.x > 0.0) { velocity.x = 0.0; } }
  if (position.y < 0.0) { position.y = 0.0; if (velocity.y < 0.0) { velocity.y = 0.0; } }
  if (position.y > params.box_y) { position.y = params.box_y; if (velocity.y > 0.0) { velocity.y = 0.0; } }
  if (position.z < 0.0) { position.z = 0.0; if (velocity.z < 0.0) { velocity.z = 0.0; } }
  if (position.z > params.box_z) { position.z = params.box_z; if (velocity.z > 0.0) { velocity.z = 0.0; } }

  let f00 = row0.x; let f01 = row0.y; let f02 = row0.z;
  let f10 = row0.w; let f11 = row1.x; let f12 = row1.y;
  let f20 = row1.z; let f21 = row1.w; let f22 = row2.x;
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
  if (row5.x < 0.5) {
    next_j = max(next_j, 0.05);
    let s = g2p_cubic_root_positive(next_j);
    nf00 = s; nf01 = 0.0; nf02 = 0.0;
    nf10 = 0.0; nf11 = s; nf12 = 0.0;
    nf20 = 0.0; nf21 = 0.0; nf22 = s;
  }
  next_j = g2p_det3(nf00, nf01, nf02, nf10, nf11, nf12, nf20, nf21, nf22);
  if (next_j < 0.1) {
    let s = g2p_cubic_root_positive(0.1);
    nf00 = s; nf01 = 0.0; nf02 = 0.0;
    nf10 = 0.0; nf11 = s; nf12 = 0.0;
    nf20 = 0.0; nf21 = 0.0; nf22 = s;
    next_j = 0.1;
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

export const mlsMpmResidentSummaryPartialsWgsl = `
struct ResidentSummaryParams {
  particle_count: u32,
  grid_node_count: u32,
  partial_count: u32,
  pad_u1: u32,
};

@group(0) @binding(0) var<storage, read> source_sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> next_sph_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> next_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> updated_grid_nodes: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> partial_summaries: array<vec4<f32>>;
@group(0) @binding(6) var<uniform> params: ResidentSummaryParams;

var<workgroup> wg_active_grid_nodes: array<f32, 64>;
var<workgroup> wg_source_mass: array<f32, 64>;
var<workgroup> wg_next_mass: array<f32, 64>;
var<workgroup> wg_source_momentum_x: array<f32, 64>;
var<workgroup> wg_source_momentum_y: array<f32, 64>;
var<workgroup> wg_source_momentum_z: array<f32, 64>;
var<workgroup> wg_next_momentum_x: array<f32, 64>;
var<workgroup> wg_next_momentum_y: array<f32, 64>;
var<workgroup> wg_next_momentum_z: array<f32, 64>;
var<workgroup> wg_max_speed: array<f32, 64>;
var<workgroup> wg_max_displacement: array<f32, 64>;
var<workgroup> wg_min_volume_ratio_j: array<f32, 64>;
var<workgroup> wg_max_volume_ratio_j: array<f32, 64>;

@compute @workgroup_size(64)
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

  if (index < params.particle_count) {
    let state_base = index * 2u;
    let mechanics_base = index * 8u;
    let source_pos_mass = source_sph_state[state_base];
    let source_vel_u = source_sph_state[state_base + 1u];
    let next_pos_mass = next_sph_state[state_base];
    let next_vel_u = next_sph_state[state_base + 1u];

    source_mass = source_mass + source_pos_mass.w;
    next_mass = next_mass + next_pos_mass.w;
    source_momentum = source_momentum + source_pos_mass.w * source_vel_u.xyz;
    next_momentum = next_momentum + next_pos_mass.w * next_vel_u.xyz;
    max_speed2 = max(max_speed2, dot(next_vel_u.xyz, next_vel_u.xyz));
    let displacement = next_pos_mass.xyz - source_pos_mass.xyz;
    max_displacement2 = max(max_displacement2, dot(displacement, displacement));

    let next_j = next_mls_mechanics[mechanics_base + 4u].z;
    min_volume_ratio_j = min(min_volume_ratio_j, next_j);
    max_volume_ratio_j = max(max_volume_ratio_j, next_j);
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
  workgroupBarrier();

  var stride = 32u;
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
    }
    workgroupBarrier();
    if (stride == 1u) {
      break;
    }
    stride = stride / 2u;
  }

  if (lane == 0u) {
    let partial_base = workgroup_id.x * 5u;
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
  }
}
`;

export const mlsMpmResidentSummaryFinalizeWgsl = `
struct ResidentSummaryParams {
  particle_count: u32,
  grid_node_count: u32,
  partial_count: u32,
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

  for (var partial_index = 0u; partial_index < params.partial_count; partial_index = partial_index + 1u) {
    let base = partial_index * 5u;
    let row0 = partial_summaries[base];
    let row1 = partial_summaries[base + 1u];
    let row2 = partial_summaries[base + 2u];
    let row3 = partial_summaries[base + 3u];
    let row4 = partial_summaries[base + 4u];
    active_grid_nodes = active_grid_nodes + row0.z;
    source_mass = source_mass + row0.w;
    next_mass = next_mass + row1.x;
    source_momentum = source_momentum + vec3<f32>(row1.z, row1.w, row2.x);
    next_momentum = next_momentum + vec3<f32>(row2.y, row2.z, row2.w);
    max_speed = max(max_speed, row3.w);
    max_displacement = max(max_displacement, row4.x);
    min_volume_ratio_j = min(min_volume_ratio_j, row4.y);
    max_volume_ratio_j = max(max_volume_ratio_j, row4.z);
  }

  if (params.particle_count == 0u) {
    min_volume_ratio_j = 0.0;
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
}
`;

export const mlsMpmResidentSummaryWgsl = mlsMpmResidentSummaryPartialsWgsl;
