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

export {
  createSphReactionStepWgsl,
  sphReactionStepWgsl,
  sphReactionProductEventCompactWgsl,
  createSphReactionProductEventCompactWgsl,
  sphResidentProductHistoryFilteredAppendWgsl,
  sphReactionProductEventPlacementEnvelopeWgsl,
  sphReactionProductEventPlacementWgsl,
  createSphReactionSummaryPartialsWgsl,
  sphReactionSummaryPartialsWgsl,
  sphReactionSummaryFinalizeWgsl,
  createSphReactionProductInventoryWgsl,
  sphReactionProductInventoryWgsl,
  createSphReactionProductEventWgsl,
  sphReactionProductEventWgsl,
  createSphReactionAtomResidualWgsl,
  sphReactionAtomResidualWgsl,
  createSphReactionGasSpeciesSummaryWgsl,
  sphReactionGasSpeciesSummaryWgsl
} from './sphReactionWgsl.js';

export {
  sphRenderRowsWgsl,
  sphRenderFieldWgsl,
  sphRenderFieldMotionWgsl,
  sphMaterialInterfaceCandidatesWgsl,
  sphMaterialInterfaceCompactCandidatesWgsl,
  sphRenderMarchingCubeCellsWgsl,
  sphRenderFieldSurfaceSummaryWgsl,
  sphRenderSurfaceVerticesWgsl,
  sphRenderSurfaceDrawWgsl
} from './sphRenderWgsl.js';

export {
  mlsMpmMechanicsPredictWgsl,
  mlsMpmP2gGridProjectionWgsl,
  mlsMpmGridUpdateWgsl,
  sphPressureInterfaceForceRowsWgsl,
  sphPressureInterfaceParticleBinsWgsl,
  sphPressureInterfaceContactKinematicsWgsl,
  mlsMpmTrialDeformationWgsl,
  mlsMpmG2pReconstructWgsl,
  SEPARATION_BIN_CAPACITY,
  mlsMpmParticleSeparationBinFillWgsl,
  mlsMpmParticleSeparationComputeWgsl,
  mlsMpmParticleSeparationApplyWgsl,
  mlsMpmMechanicsRefreshWgsl,
  mlsMpmResidentSummaryPartialsWgsl,
  mlsMpmResidentSummaryFinalizeWgsl,
  mlsMpmResidentSummaryWgsl,
  mlsMpmActiveGridDispatchFromSummaryWgsl
} from './mlsMpmWgsl.js';

export {
  schroederLevelAssignmentWgsl,
  schroederActiveNodeListWgsl,
  schroederPhaseVolumeAssignmentOverlayIndexWgsl,
  schroederActiveNodeIndexWgsl,
  schroederActiveNodeSortedIndexWgsl,
  schroederLawQueueWgsl,
  schroederLawNeighborCandidateWgsl,
  schroederCrossLevelCouplingWgsl,
  schroederConservationSummaryWgsl,
  schroederCrossLevelTransferWgsl,
  schroederCrossLevelStateDeltaWgsl,
  schroederCrossLevelStateDeltaMergeWgsl,
  schroederHierarchyAggregateWgsl,
  schroederPhaseVolumeTargetAggregateWgsl,
  schroederHierarchyAggregateNodeReduceWgsl,
  schroederHierarchyAggregateNodeBucketReduceWgsl,
  schroederFarAggregateCandidateWgsl,
  schroederFarAggregateForceSummaryWgsl,
  schroederFarAggregateDiagnosticSummaryWgsl,
  schroederFarAggregateLawConsumerWgsl,
  schroederFarAggregateLawConsumerDiagnosticSummaryWgsl,
  schroederFarAggregateGasStateDeltaWgsl,
  schroederFarAggregateGasCellImportWgsl,
  schroederFarAggregateForceApplicationWgsl,
  schroederPhaseVolumeMigrationWgsl,
  schroederPhaseVolumeSplitMergeProposalWgsl,
  schroederPhaseVolumeSplitMergeApplyWgsl,
  schroederParticleStorageAllocationWgsl,
  schroederParticleStorageSlotAssignmentWgsl,
  schroederParticleStorageMaterializationWgsl,
  schroederPhaseVolumeLevelUpdateWgsl,
  schroederPhaseVolumeDiagnosticSummaryWgsl,
  schroederCrossLevelGridCouplingSharedWgsl,
  schroederCrossLevelGridRestrictionWgsl,
  schroederSameGridMomentumAccumulationWgsl,
  schroederCrossLevelGridProlongationWgsl,
  schroederCrossLevelGridConservationSummaryWgsl,
  schroederCrossLevelGridVelocityDeltaProlongationWgsl,
  schroederCrossLevelGridRestrictionCompactWgsl,
  schroederCrossLevelGridProlongationCompactWgsl,
  schroederCrossLevelGridVelocityDeltaProlongationCompactWgsl,
  schroederParticleStorageCountSummaryWgsl,
  schroederParticleStorageCompactionWgsl
} from './schroederHierarchyWgsl.js';

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
// Response-aligned phase thermal conductivities (W/m/K), from the closure
// derived phase response table (same ladder as phase_responses).
@group(0) @binding(13) var<storage, read> response_thermal_conductivities: array<f32>;
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

// Types 3/4/5 declare liquid+gas / solid+liquid+gas / gas-only caloric rosters.
// Return (response index, Umin, Umax, status): 0=legacy, 1=ready, -1=rejected.
// All declared branches remain present even when their U domains overlap. All
// sensible-heat consumers must use the same exact one-hot phase selection.
fn thermal_phase_caloric_selection(
  material_id: f32,
  specific_internal_energy: f32,
  phase_id: f32,
  phase_fractions: vec4<f32>
) -> vec4<f32> {
  let rejected = vec4<f32>(0.0, 0.0, 0.0, -1.0);
  if (params.material_count > arrayLength(&phase_response_records) / 2u) { return rejected; }
  var matching_records = 0u;
  for (var index = 0u; index < params.material_count; index = index + 1u) {
    if (phase_response_records[index * 2u].x == material_id) {
      matching_records = matching_records + 1u;
    }
  }
  if (matching_records > 1u) { return rejected; }
  for (var record_index = 0u; record_index < params.material_count; record_index = record_index + 1u) {
    if (record_index * 2u + 1u >= arrayLength(&phase_response_records)) { return rejected; }
    let record = phase_response_records[record_index * 2u];
    if (record.x != material_id) { continue; }
    if (record.y < 0.0 || floor(record.y) != record.y
      || record.z <= 0.0 || floor(record.z) != record.z
      || !thermal_value_finite(record.y) || !thermal_value_finite(record.z)
      || record.y + record.z > f32(params.response_count)
      || record.y + record.z > f32(arrayLength(&phase_responses) / 4u)) { return rejected; }
    let start = u32(record.y);
    let count = u32(record.z);
    var explicit_caloric = false;
    for (var local = 0u; local < count; local = local + 1u) {
      let kind = response_row0(start + local).y;
      if (kind != 1.0 && kind != 2.0) { explicit_caloric = true; }
    }
    if (!explicit_caloric) { return vec4<f32>(0.0); }
    let caloric_kind = response_row0(start).y;
    var expected_count = 0u;
    var expected_mask = 0u;
    if (caloric_kind == 3.0) { expected_count = 2u; expected_mask = 12u; }
    else if (caloric_kind == 4.0) { expected_count = 3u; expected_mask = 14u; }
    else if (caloric_kind == 5.0) { expected_count = 1u; expected_mask = 8u; }
    else { return rejected; }
    var expected_fractions = vec4<f32>(0.0);
    if (phase_id == 1.0) { expected_fractions.x = 1.0; }
    else if (phase_id == 2.0) { expected_fractions.y = 1.0; }
    else if (phase_id == 3.0) { expected_fractions.z = 1.0; }
    else { return rejected; }
    if (record.w != 1.0 || count != expected_count
      || (expected_mask & (1u << u32(phase_id))) == 0u
      || !thermal_value_finite(material_id) || material_id < 1.0
      || material_id > 16777215.0 || floor(material_id) != material_id
      || !thermal_value_finite(specific_internal_energy)
      || !all(phase_fractions == expected_fractions)) { return rejected; }
    var selected = rejected;
    var seen_phases = 0u;
    for (var local = 0u; local < count; local = local + 1u) {
      let index = start + local;
      let r0 = response_row0(index);
      let r1 = response_row1(index);
      let r2 = response_row2(index);
      let r3 = response_row3(index);
      if (r0.x != material_id || r0.y != caloric_kind || r0.w != 1.0
        || !thermal_value_finite(r0.z) || r0.z < 0.0 || floor(r0.z) != r0.z
        || (r1.z != 1.0 && r1.z != 2.0 && r1.z != 3.0) || r1.z != r1.w
        || !thermal_value_finite(r1.x) || !thermal_value_finite(r1.y) || r1.x >= r1.y
        || !thermal_value_finite(r2.x) || r2.x <= 0.0 || r2.x != r2.y
        || r2.z != 1.0 || r2.w != 1.0
        || !all(r3 == vec4<f32>(0.0, 1.0, 0.0, 0.0))) { return rejected; }
      let phase_bit = 1u << u32(r1.z);
      if ((expected_mask & phase_bit) == 0u || (seen_phases & phase_bit) != 0u) { return rejected; }
      seen_phases = seen_phases | phase_bit;
      let node_count = arrayLength(&thermal_graph_nodes);
      if (r0.z >= f32(node_count / 4u)) { return rejected; }
      let node0 = thermal_graph_nodes[u32(r0.z) * 4u];
      let node = graph_node_row1(u32(r0.z));
      let node2 = thermal_graph_nodes[u32(r0.z) * 4u + 2u];
      let node3 = thermal_graph_nodes[u32(r0.z) * 4u + 3u];
      if (!all(node0 == vec4<f32>(1.0, 0.0, 1.0, 2.0))
        || node2.y != 0.0 || node2.z != 1.0
        || node3.y != material_id || node3.z != r1.z) { return rejected; }
      let sample_count = arrayLength(&thermal_graph_samples);
      if (sample_count < 2u || !thermal_value_finite(node.x)
        || node.x < 0.0 || floor(node.x) != node.x || node.y != 2.0
        || node.x > f32(sample_count - 2u) || node.z != r1.x || node.w != r1.y) { return rejected; }
      let first = thermal_graph_samples[u32(node.x)];
      let last = thermal_graph_samples[u32(node.x) + 1u];
      let energy_span = last.x - first.x;
      let slope = (last.y - first.y) / energy_span;
      if (first.x != r1.x || last.x != r1.y
        || !thermal_value_finite(first.y) || !thermal_value_finite(last.y)
        || first.y <= 0.0 || first.y >= last.y
        || !thermal_value_finite(energy_span) || energy_span <= 0.0
        || !thermal_value_finite(slope) || slope <= 0.0) { return rejected; }
      if (r1.z == phase_id && specific_internal_energy >= r1.x && specific_internal_energy <= r1.y) {
        selected = vec4<f32>(f32(index), r1.x, r1.y, 1.0);
      }
    }
    if (seen_phases != expected_mask) { return rejected; }
    return selected;
  }
  return vec4<f32>(0.0);
}

fn thermal_carrier_temperature(
  material_id: f32, specific_internal_energy: f32,
  phase_id: f32, phase_fractions: vec4<f32>, cached_temperature: f32
) -> f32 {
  let caloric = thermal_phase_caloric_selection(
    material_id, specific_internal_energy, phase_id, phase_fractions
  );
  if (caloric.w < 0.0) { return -1.0; }
  if (caloric.w == 1.0) {
    return sample_temperature_from_graph(u32(response_row0(u32(caloric.x)).z), specific_internal_energy);
  }
  return cached_temperature;
}

fn thermal_temperature_slope(
  material_id: f32,
  specific_internal_energy: f32,
  phase_id: f32,
  phase_fractions: vec4<f32>
) -> f32 {
  let caloric = thermal_phase_caloric_selection(
    material_id, specific_internal_energy, phase_id, phase_fractions
  );
  if (caloric.w < 0.0) { return 0.0; }
  if (caloric.w == 1.0) {
    return temperature_slope_from_graph(u32(response_row0(u32(caloric.x)).z), specific_internal_energy);
  }
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
  specific_internal_energy: f32,
  phase_id: f32,
  phase_fractions: vec4<f32>
) -> vec4<f32> {
  let caloric = thermal_phase_caloric_selection(
    material_id, specific_internal_energy, phase_id, phase_fractions
  );
  if (caloric.w < 0.0) { return vec4<f32>(specific_internal_energy, specific_internal_energy, 0.0, 0.0); }
  if (caloric.w == 1.0) { return vec4<f32>(caloric.y, caloric.z, 1.0, 1.0); }
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

// The response row a carrier's state selects: the explicit caloric row when
// the material declares one, otherwise the same legacy ladder selection as
// thermal_temperature_slope (pure phase, mixed plateau, containing interval,
// then the energy fallback). 0xffffffff when the data is missing.
fn thermal_selected_response_index(
  material_id: f32,
  specific_internal_energy: f32,
  phase_id: f32,
  phase_fractions: vec4<f32>
) -> u32 {
  let caloric = thermal_phase_caloric_selection(
    material_id, specific_internal_energy, phase_id, phase_fractions
  );
  if (caloric.w < 0.0) { return 0xffffffffu; }
  if (caloric.w == 1.0) { return u32(caloric.x); }
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
  if (!found_material || material_response_count == 0u) { return 0xffffffffu; }
  let classification = thermal_carrier_phase_classification(phase_id, phase_fractions);
  var fallback = material_response_offset;
  var fallback_found = false;
  var containing = 0xffffffffu;
  var mixed_plateau = 0xffffffffu;
  var pure_phase_response = 0xffffffffu;
  for (var local = 0u; local < material_response_count; local = local + 1u) {
    let candidate = material_response_offset + local;
    if (candidate >= params.response_count) { return 0xffffffffu; }
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
  return selected;
}

// Thermal conductivity (W/m/K) of the carrier's selected phase response; 0
// when missing (no conduction-limited exchange is then possible).
fn thermal_phase_conductivity(
  material_id: f32,
  specific_internal_energy: f32,
  phase_id: f32,
  phase_fractions: vec4<f32>
) -> f32 {
  let response_index = thermal_selected_response_index(
    material_id, specific_internal_energy, phase_id, phase_fractions
  );
  if (response_index >= params.response_count
    || response_index >= arrayLength(&response_thermal_conductivities)) { return 0.0; }
  let k = response_thermal_conductivities[response_index];
  return select(0.0, k, thermal_value_finite(k) && k > 0.0);
}

// Edge of the cube with the parcel's rest volume (m); 0 when unknown.
fn parcel_edge_m(mass_kg: f32, rest_density_kg_per_m3: f32) -> f32 {
  if (mass_kg <= 0.0 || rest_density_kg_per_m3 <= 0.0) { return 0.0; }
  return pow(mass_kg / rest_density_kg_per_m3, 1.0 / 3.0);
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
  let caloric = thermal_phase_caloric_selection(
    material_id, next_u, thermo_row0(index).y, source_row1
  );
  if (caloric.w < 0.0) {
    out_sph_thermo[index * 3u] = vec4<f32>(material_id, 0.0, 0.0, 0.0);
    out_sph_thermo[index * 3u + 1u] = vec4<f32>(0.0);
    out_sph_thermo[index * 3u + 2u] = vec4<f32>(source_row2.x, source_row2.y, 255.0, source_row2.w);
    return;
  }
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

  if (caloric.w == 1.0) { selected = u32(caloric.x); }

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
  let caloric = thermal_phase_caloric_selection(row0.x, vel_u.w, row0.y, row1);
  var temperature = row0.z;
  if (caloric.w == 1.0) {
    temperature = sample_temperature_from_graph(u32(response_row0(u32(caloric.x)).z), vel_u.w);
  }
	  let carrier_domain = thermal_carrier_energy_domain(row0.x, vel_u.w, row0.y, row1);
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
	              let other_temperature = thermal_carrier_temperature(
	                other_row0.x, other_vel_u.w, other_row0.y, other_row1, other_row0.z
	              );
	              if (other_temperature < 0.0) { continue; }
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
	      let other_temperature = thermal_carrier_temperature(
	        other_row0.x, other_vel_u.w, other_row0.y, other_row1, other_row0.z
	      );
	      if (other_temperature < 0.0) { continue; }
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

	  // Honest walls: an isothermal wall exchanges heat with a parcel only by
	  // conduction through the parcel's own phase conductivity k, over its face
	  // area a^2 (a = edge of the cube with its rest volume), across the path
	  // from its centre to the wall (at least a/2), and only while it touches
	  // the wall; parcels farther away reach the wall through their neighbours.
	  // params.wall_rate is only the on/off gate (the wall reservoir authority
	  // writes 0 when wall exchange is disabled); it is not an exchange rate.
	  let wall_parcel_edge_m = parcel_edge_m(mass, row0.w);
	  let wall_conductivity = thermal_phase_conductivity(row0.x, vel_u.w, row0.y, row1);
	  for (var face = 0u; face < 6u; face = face + 1u) {
	    let distance = wall_distance(position, face);
	    if (params.wall_rate > 0.0 && wall_conductivity > 0.0
	      && wall_parcel_edge_m > 0.0 && distance < wall_parcel_edge_m) {
	      let wall_path_m = max(distance, 0.5 * wall_parcel_edge_m);
	      let wall_conductance_w_per_k =
	        wall_conductivity * wall_parcel_edge_m * wall_parcel_edge_m / wall_path_m;
	      let face_wall_temperature = wall_temperature(face);
	      let current_u = vel_u.w + du;
	      let current_temperature = temperature + du * temperature_slope;
	      let raw_du_specific = wall_conductance_w_per_k * (face_wall_temperature - current_temperature) * params.dt / mass;
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

