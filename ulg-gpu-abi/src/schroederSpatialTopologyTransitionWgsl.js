import {
  SCHROEDER_SPATIAL_TOPOLOGY_STATE_STRIDE_WORDS,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_FINAL_SEAL,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_MAGIC,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_VERSION
} from './schroederSpatialTopologyTransition.js';

export const schroederSpatialTopologyTransitionWgsl = `
struct TopologyTransitionParams {
  source_count: u32,
  successor_count: u32,
  generation_id: u32,
  submission_nonce: u32,
  source_topology_epoch: u32,
  force_topology_advance: u32,
  receipt_version: u32,
  receipt_magic: u32,
};

@group(0) @binding(0) var<storage, read> source_state: array<f32>;
@group(0) @binding(1) var<storage, read> successor_state: array<f32>;
@group(0) @binding(2) var<uniform> params: TopologyTransitionParams;
@group(0) @binding(3) var<storage, read_write> receipt: array<atomic<u32>>;

fn topology_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

fn topology_valid_mass(value: f32) -> bool {
  return topology_finite(value) && value >= 0.0;
}

fn topology_source_mass(index: u32) -> f32 {
  return source_state[
    index * ${SCHROEDER_SPATIAL_TOPOLOGY_STATE_STRIDE_WORDS}u + 3u
  ];
}

fn topology_successor_mass(index: u32) -> f32 {
  return successor_state[
    index * ${SCHROEDER_SPATIAL_TOPOLOGY_STATE_STRIDE_WORDS}u + 3u
  ];
}

@compute @workgroup_size(64)
fn compare_topology(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  let comparison_count = max(params.source_count, params.successor_count);
  if (index == 0u) {
    atomicStore(&receipt[0], params.receipt_magic);
    atomicStore(&receipt[1], params.receipt_version);
    atomicStore(&receipt[2], params.generation_id);
    atomicStore(&receipt[3], params.submission_nonce);
    atomicStore(&receipt[4], params.source_topology_epoch);
    atomicStore(&receipt[5], params.source_count);
    atomicStore(&receipt[6], params.successor_count);
    atomicStore(&receipt[7], comparison_count);
    atomicStore(&receipt[17], params.force_topology_advance);
    atomicAdd(&receipt[8], 1u);
  }
  if (index >= comparison_count) { return; }

  var source_active = false;
  if (index < params.source_count) {
    let source_mass = topology_source_mass(index);
    if (!topology_valid_mass(source_mass)) {
      atomicAdd(&receipt[15], 1u);
    } else if (source_mass > 0.0) {
      source_active = true;
      atomicAdd(&receipt[10], 1u);
    }
  }

  var successor_active = false;
  if (index < params.successor_count) {
    let successor_mass = topology_successor_mass(index);
    if (!topology_valid_mass(successor_mass)) {
      atomicAdd(&receipt[16], 1u);
    } else if (successor_mass > 0.0) {
      successor_active = true;
      atomicAdd(&receipt[11], 1u);
    }
  }

  if (source_active != successor_active) {
    atomicAdd(&receipt[14], 1u);
    if (successor_active) {
      atomicAdd(&receipt[12], 1u);
    } else {
      atomicAdd(&receipt[13], 1u);
    }
  }
  atomicAdd(&receipt[9], 1u);
}

@compute @workgroup_size(1)
fn seal_topology(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u) { return; }
  atomicAdd(&receipt[18], 1u);
  let comparison_count = max(params.source_count, params.successor_count);
  let visited = atomicLoad(&receipt[9]);
  let source_active = atomicLoad(&receipt[10]);
  let successor_active = atomicLoad(&receipt[11]);
  let activated = atomicLoad(&receipt[12]);
  let deactivated = atomicLoad(&receipt[13]);
  let xor_count = atomicLoad(&receipt[14]);
  let invalid_source = atomicLoad(&receipt[15]);
  let invalid_successor = atomicLoad(&receipt[16]);
  let arithmetic_valid = source_active + activated
    == successor_active + deactivated;
  let partition_valid = xor_count == activated + deactivated;
  let dispatch_valid = atomicLoad(&receipt[8]) == 1u
    && visited == comparison_count
    && arithmetic_valid
    && partition_valid;
  let changed = xor_count > 0u || params.force_topology_advance != 0u;
  atomicStore(&receipt[19], select(0u, 1u, changed));

  var next_epoch = params.source_topology_epoch;
  var status = ${SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS.COMPLETE}u;
  if (!dispatch_valid) {
    status = ${SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS.INCOMPLETE_DISPATCH}u;
  } else if (invalid_source > 0u || invalid_successor > 0u) {
    status = ${SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS.INVALID_MASS}u;
  } else if (changed && params.source_topology_epoch == 0xffffffffu) {
    status = ${SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS.EPOCH_EXHAUSTED}u;
  } else if (changed) {
    next_epoch = params.source_topology_epoch + 1u;
  }
  atomicStore(&receipt[20], next_epoch);
  atomicStore(&receipt[21], status);
  // The seal is deliberately last. A copied receipt without this store is not
  // evidence that the comparison and all prior queue work completed.
  atomicStore(
    &receipt[23],
    select(0u, ${SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_FINAL_SEAL}u,
      status == ${SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS.COMPLETE}u)
  );
}
`;
