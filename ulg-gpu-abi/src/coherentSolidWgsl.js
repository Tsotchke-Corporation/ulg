const coherentSolidParamsWgsl = /* wgsl */ `
struct CoherentSolidParams {
  body_count: u32,
  member_count: u32,
  body_capacity: u32,
  member_capacity: u32,
  source_generation_id: u32,
  target_generation_id: u32,
  lease_id: u32,
  lease_epoch: u32,
  membership_index_count: u32,
  body_dispatch_x: u32,
  member_dispatch_x: u32,
  workgroup_size: u32,
  dt_s: f32,
  external_acceleration_x: f32,
  external_acceleration_y: f32,
  external_acceleration_z: f32,
  quaternion_norm_tolerance: f32,
  mass_relative_tolerance: f32,
  local_center_of_mass_tolerance_m: f32,
  inertia_symmetry_tolerance_kg_m2: f32,
  inertia_inverse_tolerance: f32,
  member_inertia_relative_tolerance: f32,
  transform_position_tolerance_m: f32,
  transform_velocity_tolerance_m_s: f32,
  momentum_update_tolerance: f32,
  finite_magnitude_limit: f32,
  body_linear_dispatch_x: u32,
  member_generation_id: u32,
  target_chart_id: i32,
  target_level_id: i32,
  target_hierarchy_generation: u32,
  chart_transition_enabled: u32,
};

const FRAME_WORDS: u32 = 80u;
const MEMBER_WORDS: u32 = 40u;
const WRENCH_INPUT_WORDS: u32 = 12u;
const TRANSFORMED_MEMBER_WORDS: u32 = 20u;
const BODY_WRENCH_WORDS: u32 = 16u;
const BODY_INVARIANT_WORDS: u32 = 40u;
const ROW_ACTIVE: u32 = 1u;
const ROW_FAIL_CLOSED: u32 = 0x80000000u;
const MOTION_DYNAMIC: u32 = 1u;
const INVARIANT_READY: u32 = 1u;
const INVARIANT_ADMISSIBLE: u32 = 2u;
const INVARIANT_FAIL_CLOSED: u32 = 4u;
const INVARIANT_AWAITING_STATE_MANAGER: u32 = 8u;

fn frame_word(body_index: u32, word: u32) -> u32 {
  return body_index * FRAME_WORDS + word;
}

fn member_word(member_index: u32, word: u32) -> u32 {
  return member_index * MEMBER_WORDS + word;
}

fn wrench_input_word(member_index: u32, word: u32) -> u32 {
  return member_index * WRENCH_INPUT_WORDS + word;
}

fn transformed_word(member_index: u32, word: u32) -> u32 {
  return member_index * TRANSFORMED_MEMBER_WORDS + word;
}

fn body_wrench_word(body_index: u32, word: u32) -> u32 {
  return body_index * BODY_WRENCH_WORDS + word;
}

fn body_invariant_word(body_index: u32, word: u32) -> u32 {
  return body_index * BODY_INVARIANT_WORDS + word;
}

fn finite_scalar(value: f32, limit: f32) -> bool {
  return value == value && abs(value) <= limit;
}

fn finite_vec3(value: vec3<f32>, limit: f32) -> bool {
  return finite_scalar(value.x, limit)
    && finite_scalar(value.y, limit)
    && finite_scalar(value.z, limit);
}

fn finite_vec4(value: vec4<f32>, limit: f32) -> bool {
  return finite_scalar(value.x, limit)
    && finite_scalar(value.y, limit)
    && finite_scalar(value.z, limit)
    && finite_scalar(value.w, limit);
}

fn normalize_quaternion(value: vec4<f32>) -> vec4<f32> {
  let norm_squared = dot(value, value);
  if (!(norm_squared > 1e-30) || !(norm_squared == norm_squared)) {
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
  }
  return value * inverseSqrt(norm_squared);
}

fn quaternion_conjugate(value: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(-value.xyz, value.w);
}

fn quaternion_multiply(left: vec4<f32>, right: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(
    left.w * right.xyz + right.w * left.xyz + cross(left.xyz, right.xyz),
    left.w * right.w - dot(left.xyz, right.xyz)
  );
}

fn quaternion_rotate(quaternion: vec4<f32>, value: vec3<f32>) -> vec3<f32> {
  let q = normalize_quaternion(quaternion);
  let twice_cross = 2.0 * cross(q.xyz, value);
  return value + q.w * twice_cross + cross(q.xyz, twice_cross);
}

fn quaternion_inverse_rotate(quaternion: vec4<f32>, value: vec3<f32>) -> vec3<f32> {
  return quaternion_rotate(quaternion_conjugate(normalize_quaternion(quaternion)), value);
}

fn quaternion_step_world(
  quaternion: vec4<f32>,
  omega_world: vec3<f32>,
  dt_s: f32
) -> vec4<f32> {
  let angular_speed = length(omega_world);
  let half_angle = 0.5 * angular_speed * dt_s;
  var delta = vec4<f32>(0.5 * omega_world * dt_s, 1.0);
  if (angular_speed > 1e-8) {
    delta = vec4<f32>(omega_world * (sin(half_angle) / angular_speed), cos(half_angle));
  }
  return normalize_quaternion(quaternion_multiply(delta, normalize_quaternion(quaternion)));
}

fn body_inverse_inertia_times(frame: ptr<storage, array<u32>, read>, base: u32, value: vec3<f32>) -> vec3<f32> {
  return vec3<f32>(
    bitcast<f32>((*frame)[base + 44u]) * value.x
      + bitcast<f32>((*frame)[base + 45u]) * value.y
      + bitcast<f32>((*frame)[base + 46u]) * value.z,
    bitcast<f32>((*frame)[base + 48u]) * value.x
      + bitcast<f32>((*frame)[base + 49u]) * value.y
      + bitcast<f32>((*frame)[base + 50u]) * value.z,
    bitcast<f32>((*frame)[base + 52u]) * value.x
      + bitcast<f32>((*frame)[base + 53u]) * value.y
      + bitcast<f32>((*frame)[base + 54u]) * value.z
  );
}

fn world_angular_velocity(
  frame: ptr<storage, array<u32>, read>,
  base: u32,
  quaternion: vec4<f32>,
  angular_momentum_world: vec3<f32>
) -> vec3<f32> {
  let angular_momentum_body = quaternion_inverse_rotate(quaternion, angular_momentum_world);
  return quaternion_rotate(
    quaternion,
    body_inverse_inertia_times(frame, base, angular_momentum_body)
  );
}

fn atomic_max_positive(destination: ptr<storage, atomic<u32>, read_write>, value: f32) {
  if (value == value && value >= 0.0) {
    atomicMax(destination, bitcast<u32>(value));
  }
}
`;

export const coherentSolidWrenchWgsl = /* wgsl */ `${coherentSolidParamsWgsl}
@group(0) @binding(0) var<storage, read> source_frames: array<u32>;
@group(0) @binding(1) var<storage, read> members: array<u32>;
@group(0) @binding(2) var<storage, read> body_member_offsets: array<u32>;
@group(0) @binding(3) var<storage, read> body_member_indices: array<u32>;
@group(0) @binding(4) var<storage, read> member_wrench_inputs: array<u32>;
@group(0) @binding(5) var<storage, read_write> body_wrenches: array<u32>;
@group(0) @binding(6) var<storage, read_write> global_evidence: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> params: CoherentSolidParams;

var<workgroup> reduce_force_x: array<f32, 64>;
var<workgroup> reduce_force_y: array<f32, 64>;
var<workgroup> reduce_force_z: array<f32, 64>;
var<workgroup> reduce_torque_x: array<f32, 64>;
var<workgroup> reduce_torque_y: array<f32, 64>;
var<workgroup> reduce_torque_z: array<f32, 64>;
var<workgroup> reduce_invalid: array<u32, 64>;

@compute @workgroup_size(64)
fn reduce_body_wrench(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let body_index = workgroup_id.x + workgroup_id.y * params.body_dispatch_x;
  let lane = local_id.x;
  var force_sum = vec3<f32>(0.0);
  var torque_sum = vec3<f32>(0.0);
  var invalid_count = 0u;
  var start = 0u;
  var end = 0u;
  var frame_valid = false;
  var membership_range_valid = false;
  var body_id = 0u;
  var component_generation = 0u;

  if (body_index < params.body_count) {
    let frame_base = frame_word(body_index, 0u);
    body_id = source_frames[frame_base + 0u];
    component_generation = source_frames[frame_base + 1u];
    frame_valid = source_frames[frame_base + 9u] == params.source_generation_id
      && source_frames[frame_base + 10u] == params.lease_id
      && source_frames[frame_base + 11u] == params.lease_epoch
      && (source_frames[frame_base + 79u] & ROW_ACTIVE) != 0u;
    start = body_member_offsets[body_index];
    end = body_member_offsets[body_index + 1u];
    membership_range_valid = end >= start && end <= params.membership_index_count;
    if (!membership_range_valid) {
      frame_valid = false;
      if (lane == 0u) {
        invalid_count = 1u;
      }
    }
    if (frame_valid) {
      let frame_position = vec3<f32>(
        bitcast<f32>(source_frames[frame_base + 13u]),
        bitcast<f32>(source_frames[frame_base + 14u]),
        bitcast<f32>(source_frames[frame_base + 15u])
      );
      let frame_quaternion = vec4<f32>(
        bitcast<f32>(source_frames[frame_base + 16u]),
        bitcast<f32>(source_frames[frame_base + 17u]),
        bitcast<f32>(source_frames[frame_base + 18u]),
        bitcast<f32>(source_frames[frame_base + 19u])
      );
      var membership_position = start + lane;
      loop {
        if (membership_position >= end) {
          break;
        }
        let member_index = body_member_indices[membership_position];
        var member_valid = member_index < params.member_count;
        if (member_valid) {
          let member_base = member_word(member_index, 0u);
          let input_base = wrench_input_word(member_index, 0u);
          member_valid = members[member_base + 0u] == body_index
            && members[member_base + 1u] == body_id
            && members[member_base + 3u] == component_generation
            && members[member_base + 4u] == params.member_generation_id
            && (members[member_base + 39u] & ROW_ACTIVE) != 0u
            && member_wrench_inputs[input_base + 0u] == members[member_base + 2u]
            && member_wrench_inputs[input_base + 1u] == body_id
            && member_wrench_inputs[input_base + 2u] == component_generation
            && member_wrench_inputs[input_base + 3u] == params.source_generation_id
            && (member_wrench_inputs[input_base + 7u] & ROW_ACTIVE) != 0u;
          if (member_valid) {
            let local_position = vec3<f32>(
              bitcast<f32>(members[member_base + 8u]),
              bitcast<f32>(members[member_base + 9u]),
              bitcast<f32>(members[member_base + 10u])
            );
            let force = vec3<f32>(
              bitcast<f32>(member_wrench_inputs[input_base + 4u]),
              bitcast<f32>(member_wrench_inputs[input_base + 5u]),
              bitcast<f32>(member_wrench_inputs[input_base + 6u])
            );
            let direct_torque = vec3<f32>(
              bitcast<f32>(member_wrench_inputs[input_base + 8u]),
              bitcast<f32>(member_wrench_inputs[input_base + 9u]),
              bitcast<f32>(member_wrench_inputs[input_base + 10u])
            );
            let world_offset = quaternion_rotate(frame_quaternion, local_position);
            let world_position = frame_position + world_offset;
            if (finite_vec3(world_position, params.finite_magnitude_limit)
              && finite_vec3(force, params.finite_magnitude_limit)
              && finite_vec3(direct_torque, params.finite_magnitude_limit)) {
              force_sum = force_sum + force;
              torque_sum = torque_sum + cross(world_offset, force) + direct_torque;
            } else {
              member_valid = false;
              atomicAdd(&global_evidence[11], 1u);
            }
          }
        }
        if (!member_valid) {
          invalid_count = invalid_count + 1u;
          atomicAdd(&global_evidence[10], 1u);
        }
        membership_position = membership_position + 64u;
      }
    }
  }

  reduce_force_x[lane] = force_sum.x;
  reduce_force_y[lane] = force_sum.y;
  reduce_force_z[lane] = force_sum.z;
  reduce_torque_x[lane] = torque_sum.x;
  reduce_torque_y[lane] = torque_sum.y;
  reduce_torque_z[lane] = torque_sum.z;
  reduce_invalid[lane] = invalid_count;
  workgroupBarrier();

  var reduction_stride = 32u;
  loop {
    if (lane < reduction_stride) {
      reduce_force_x[lane] = reduce_force_x[lane] + reduce_force_x[lane + reduction_stride];
      reduce_force_y[lane] = reduce_force_y[lane] + reduce_force_y[lane + reduction_stride];
      reduce_force_z[lane] = reduce_force_z[lane] + reduce_force_z[lane + reduction_stride];
      reduce_torque_x[lane] = reduce_torque_x[lane] + reduce_torque_x[lane + reduction_stride];
      reduce_torque_y[lane] = reduce_torque_y[lane] + reduce_torque_y[lane + reduction_stride];
      reduce_torque_z[lane] = reduce_torque_z[lane] + reduce_torque_z[lane + reduction_stride];
      reduce_invalid[lane] = reduce_invalid[lane] + reduce_invalid[lane + reduction_stride];
    }
    workgroupBarrier();
    if (reduction_stride == 1u) {
      break;
    }
    reduction_stride = reduction_stride >> 1u;
  }

  if (body_index < params.body_count && lane == 0u) {
    let output_base = body_wrench_word(body_index, 0u);
    body_wrenches[output_base + 0u] = body_id;
    body_wrenches[output_base + 1u] = component_generation;
    body_wrenches[output_base + 2u] = params.source_generation_id;
    body_wrenches[output_base + 3u] = params.lease_id;
    body_wrenches[output_base + 4u] = bitcast<u32>(reduce_force_x[0]);
    body_wrenches[output_base + 5u] = bitcast<u32>(reduce_force_y[0]);
    body_wrenches[output_base + 6u] = bitcast<u32>(reduce_force_z[0]);
    body_wrenches[output_base + 7u] = 0u;
    body_wrenches[output_base + 8u] = bitcast<u32>(reduce_torque_x[0]);
    body_wrenches[output_base + 9u] = bitcast<u32>(reduce_torque_y[0]);
    body_wrenches[output_base + 10u] = bitcast<u32>(reduce_torque_z[0]);
    body_wrenches[output_base + 11u] = 0u;
    body_wrenches[output_base + 12u] = select(0u, end - start, membership_range_valid);
    body_wrenches[output_base + 13u] = reduce_invalid[0];
    body_wrenches[output_base + 14u] = select(
      ROW_FAIL_CLOSED,
      ROW_ACTIVE,
      frame_valid && reduce_invalid[0] == 0u
    );
    body_wrenches[output_base + 15u] = 0u;
    if (frame_valid && reduce_invalid[0] == 0u) {
      atomicAdd(&global_evidence[7], 1u);
    } else {
      atomicAdd(&global_evidence[8], 1u);
    }
  }
}
`;

export const coherentSolidIntegrateWgsl = /* wgsl */ `${coherentSolidParamsWgsl}
@group(0) @binding(0) var<storage, read> source_frames: array<u32>;
@group(0) @binding(1) var<storage, read> body_wrenches: array<u32>;
@group(0) @binding(2) var<storage, read_write> target_frames: array<u32>;
@group(0) @binding(3) var<storage, read_write> global_evidence: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: CoherentSolidParams;

@compute @workgroup_size(64)
fn integrate_frames(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let body_index = (workgroup_id.x + workgroup_id.y * params.body_linear_dispatch_x) * 64u + local_id.x;
  if (body_index >= params.body_count) {
    return;
  }
  let source_base = frame_word(body_index, 0u);
  let target_base = frame_word(body_index, 0u);
  let wrench_base = body_wrench_word(body_index, 0u);
  for (var word = 0u; word < FRAME_WORDS; word = word + 1u) {
    target_frames[target_base + word] = source_frames[source_base + word];
  }

  let body_id = source_frames[source_base + 0u];
  let component_generation = source_frames[source_base + 1u];
  let motion_mode = source_frames[source_base + 7u];
  let mass = bitcast<f32>(source_frames[source_base + 28u]);
  let quaternion = vec4<f32>(
    bitcast<f32>(source_frames[source_base + 16u]),
    bitcast<f32>(source_frames[source_base + 17u]),
    bitcast<f32>(source_frames[source_base + 18u]),
    bitcast<f32>(source_frames[source_base + 19u])
  );
  let source_position = vec3<f32>(
    bitcast<f32>(source_frames[source_base + 13u]),
    bitcast<f32>(source_frames[source_base + 14u]),
    bitcast<f32>(source_frames[source_base + 15u])
  );
  let source_linear_momentum = vec3<f32>(
    bitcast<f32>(source_frames[source_base + 20u]),
    bitcast<f32>(source_frames[source_base + 21u]),
    bitcast<f32>(source_frames[source_base + 22u])
  );
  let source_angular_momentum = vec3<f32>(
    bitcast<f32>(source_frames[source_base + 24u]),
    bitcast<f32>(source_frames[source_base + 25u]),
    bitcast<f32>(source_frames[source_base + 26u])
  );
  let force = vec3<f32>(
    bitcast<f32>(body_wrenches[wrench_base + 4u]),
    bitcast<f32>(body_wrenches[wrench_base + 5u]),
    bitcast<f32>(body_wrenches[wrench_base + 6u])
  );
  let torque = vec3<f32>(
    bitcast<f32>(body_wrenches[wrench_base + 8u]),
    bitcast<f32>(body_wrenches[wrench_base + 9u]),
    bitcast<f32>(body_wrenches[wrench_base + 10u])
  );

  let source_valid = source_frames[source_base + 9u] == params.source_generation_id
    && source_frames[source_base + 10u] == params.lease_id
    && source_frames[source_base + 11u] == params.lease_epoch
    && (source_frames[source_base + 79u] & ROW_ACTIVE) != 0u;
  let wrench_valid = body_wrenches[wrench_base + 0u] == body_id
    && body_wrenches[wrench_base + 1u] == component_generation
    && body_wrenches[wrench_base + 2u] == params.source_generation_id
    && body_wrenches[wrench_base + 3u] == params.lease_id
    && (body_wrenches[wrench_base + 14u] & ROW_ACTIVE) != 0u;
  var finite_state = finite_scalar(mass, params.finite_magnitude_limit) && mass > 0.0
    && finite_scalar(params.dt_s, params.finite_magnitude_limit) && params.dt_s >= 0.0
    && finite_vec4(quaternion, params.finite_magnitude_limit)
    && finite_vec3(source_position, params.finite_magnitude_limit)
    && finite_vec3(source_linear_momentum, params.finite_magnitude_limit)
    && finite_vec3(source_angular_momentum, params.finite_magnitude_limit)
    && finite_vec3(force, params.finite_magnitude_limit)
    && finite_vec3(torque, params.finite_magnitude_limit);
  if (!source_valid || !wrench_valid || !finite_state) {
    target_frames[target_base + 79u] = ROW_FAIL_CLOSED;
    if (!source_valid) {
      atomicAdd(&global_evidence[9], 1u);
    }
    if (!wrench_valid) {
      atomicAdd(&global_evidence[10], 1u);
    }
    if (!finite_state) {
      atomicAdd(&global_evidence[11], 1u);
    }
    atomicAdd(&global_evidence[8], 1u);
    return;
  }

  var target_position = source_position;
  var target_quaternion = normalize_quaternion(quaternion);
  var target_linear_momentum = source_linear_momentum;
  var target_angular_momentum = source_angular_momentum;
  if (motion_mode == MOTION_DYNAMIC) {
    let external_acceleration = vec3<f32>(
      params.external_acceleration_x,
      params.external_acceleration_y,
      params.external_acceleration_z
    );
    target_linear_momentum = source_linear_momentum
      + (force + mass * external_acceleration) * params.dt_s;
    target_angular_momentum = source_angular_momentum + torque * params.dt_s;
    target_position = source_position + (target_linear_momentum / mass) * params.dt_s;
    let omega_world = world_angular_velocity(
      &source_frames,
      source_base,
      target_quaternion,
      target_angular_momentum
    );
    target_quaternion = quaternion_step_world(target_quaternion, omega_world, params.dt_s);
  }

  if (!finite_vec3(target_position, params.finite_magnitude_limit)
    || !finite_vec4(target_quaternion, params.finite_magnitude_limit)
    || !finite_vec3(target_linear_momentum, params.finite_magnitude_limit)
    || !finite_vec3(target_angular_momentum, params.finite_magnitude_limit)) {
    target_frames[target_base + 79u] = ROW_FAIL_CLOSED;
    atomicAdd(&global_evidence[11], 1u);
    atomicAdd(&global_evidence[8], 1u);
    return;
  }

  target_frames[target_base + 2u] = source_frames[source_base + 2u] + 1u;
  target_frames[target_base + 9u] = params.target_generation_id;
  target_frames[target_base + 10u] = params.lease_id;
  target_frames[target_base + 11u] = params.lease_epoch;
  target_frames[target_base + 13u] = bitcast<u32>(target_position.x);
  target_frames[target_base + 14u] = bitcast<u32>(target_position.y);
  target_frames[target_base + 15u] = bitcast<u32>(target_position.z);
  target_frames[target_base + 16u] = bitcast<u32>(target_quaternion.x);
  target_frames[target_base + 17u] = bitcast<u32>(target_quaternion.y);
  target_frames[target_base + 18u] = bitcast<u32>(target_quaternion.z);
  target_frames[target_base + 19u] = bitcast<u32>(target_quaternion.w);
  target_frames[target_base + 20u] = bitcast<u32>(target_linear_momentum.x);
  target_frames[target_base + 21u] = bitcast<u32>(target_linear_momentum.y);
  target_frames[target_base + 22u] = bitcast<u32>(target_linear_momentum.z);
  target_frames[target_base + 24u] = bitcast<u32>(target_angular_momentum.x);
  target_frames[target_base + 25u] = bitcast<u32>(target_angular_momentum.y);
  target_frames[target_base + 26u] = bitcast<u32>(target_angular_momentum.z);
  target_frames[target_base + 78u] = source_frames[source_base + 78u] + 1u;
  if (params.chart_transition_enabled != 0u) {
    target_frames[target_base + 4u] = bitcast<u32>(params.target_chart_id);
    target_frames[target_base + 5u] = params.target_hierarchy_generation;
    target_frames[target_base + 6u] = bitcast<u32>(params.target_level_id);
  }
  target_frames[target_base + 79u] = ROW_ACTIVE;

  let expected_linear_momentum = select(
    source_linear_momentum,
    source_linear_momentum + (force + mass * vec3<f32>(
      params.external_acceleration_x,
      params.external_acceleration_y,
      params.external_acceleration_z
    )) * params.dt_s,
    motion_mode == MOTION_DYNAMIC
  );
  let expected_angular_momentum = select(
    source_angular_momentum,
    source_angular_momentum + torque * params.dt_s,
    motion_mode == MOTION_DYNAMIC
  );
  atomic_max_positive(&global_evidence[20], length(target_linear_momentum - expected_linear_momentum));
  atomic_max_positive(&global_evidence[21], length(target_angular_momentum - expected_angular_momentum));
  atomicAdd(&global_evidence[5], 1u);
}
`;

export const coherentSolidTransformWgsl = /* wgsl */ `${coherentSolidParamsWgsl}
@group(0) @binding(0) var<storage, read> target_frames: array<u32>;
@group(0) @binding(1) var<storage, read> members: array<u32>;
@group(0) @binding(2) var<storage, read_write> transformed_members: array<u32>;
@group(0) @binding(3) var<storage, read_write> global_evidence: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: CoherentSolidParams;

@compute @workgroup_size(64)
fn transform_members(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let member_index = (workgroup_id.x + workgroup_id.y * params.member_dispatch_x) * 64u + local_id.x;
  if (member_index >= params.member_count) {
    return;
  }
  let member_base = member_word(member_index, 0u);
  let output_base = transformed_word(member_index, 0u);
  let body_index = members[member_base + 0u];
  if (body_index >= params.body_count) {
    transformed_members[output_base + 18u] = ROW_FAIL_CLOSED;
    atomicAdd(&global_evidence[8], 1u);
    return;
  }
  let frame_base = frame_word(body_index, 0u);
  let body_id = target_frames[frame_base + 0u];
  let component_generation = target_frames[frame_base + 1u];
  let valid = members[member_base + 1u] == body_id
    && members[member_base + 3u] == component_generation
    && members[member_base + 4u] == params.member_generation_id
    && (members[member_base + 39u] & ROW_ACTIVE) != 0u
    && target_frames[frame_base + 9u] == params.target_generation_id
    && target_frames[frame_base + 10u] == params.lease_id
    && target_frames[frame_base + 11u] == params.lease_epoch
    && (target_frames[frame_base + 79u] & ROW_ACTIVE) != 0u;
  if (!valid) {
    transformed_members[output_base + 18u] = ROW_FAIL_CLOSED;
    atomicAdd(&global_evidence[10], 1u);
    return;
  }

  let quaternion = vec4<f32>(
    bitcast<f32>(target_frames[frame_base + 16u]),
    bitcast<f32>(target_frames[frame_base + 17u]),
    bitcast<f32>(target_frames[frame_base + 18u]),
    bitcast<f32>(target_frames[frame_base + 19u])
  );
  let center_of_mass = vec3<f32>(
    bitcast<f32>(target_frames[frame_base + 13u]),
    bitcast<f32>(target_frames[frame_base + 14u]),
    bitcast<f32>(target_frames[frame_base + 15u])
  );
  let mass = bitcast<f32>(target_frames[frame_base + 28u]);
  let linear_momentum = vec3<f32>(
    bitcast<f32>(target_frames[frame_base + 20u]),
    bitcast<f32>(target_frames[frame_base + 21u]),
    bitcast<f32>(target_frames[frame_base + 22u])
  );
  let angular_momentum = vec3<f32>(
    bitcast<f32>(target_frames[frame_base + 24u]),
    bitcast<f32>(target_frames[frame_base + 25u]),
    bitcast<f32>(target_frames[frame_base + 26u])
  );
  let local_position = vec3<f32>(
    bitcast<f32>(members[member_base + 8u]),
    bitcast<f32>(members[member_base + 9u]),
    bitcast<f32>(members[member_base + 10u])
  );
  let world_offset = quaternion_rotate(quaternion, local_position);
  let world_position = center_of_mass + world_offset;
  let omega_world = world_angular_velocity(
    &target_frames,
    frame_base,
    quaternion,
    angular_momentum
  );
  let world_velocity = linear_momentum / mass + cross(omega_world, world_offset);
  if (!finite_vec3(world_position, params.finite_magnitude_limit)
    || !finite_vec3(world_velocity, params.finite_magnitude_limit)) {
    transformed_members[output_base + 18u] = ROW_FAIL_CLOSED;
    atomicAdd(&global_evidence[11], 1u);
    return;
  }

  transformed_members[output_base + 0u] = body_id;
  transformed_members[output_base + 1u] = members[member_base + 2u];
  transformed_members[output_base + 2u] = component_generation;
  transformed_members[output_base + 3u] = params.target_generation_id;
  transformed_members[output_base + 4u] = bitcast<u32>(world_position.x);
  transformed_members[output_base + 5u] = bitcast<u32>(world_position.y);
  transformed_members[output_base + 6u] = bitcast<u32>(world_position.z);
  transformed_members[output_base + 7u] = 0u;
  transformed_members[output_base + 8u] = bitcast<u32>(world_velocity.x);
  transformed_members[output_base + 9u] = bitcast<u32>(world_velocity.y);
  transformed_members[output_base + 10u] = bitcast<u32>(world_velocity.z);
  transformed_members[output_base + 11u] = 0u;
  transformed_members[output_base + 12u] = members[member_base + 8u];
  transformed_members[output_base + 13u] = members[member_base + 9u];
  transformed_members[output_base + 14u] = members[member_base + 10u];
  transformed_members[output_base + 15u] = members[member_base + 11u];
  transformed_members[output_base + 16u] = members[member_base + 12u];
  transformed_members[output_base + 17u] = members[member_base + 15u];
  transformed_members[output_base + 18u] = ROW_ACTIVE;
  transformed_members[output_base + 19u] = body_index;
  atomicAdd(&global_evidence[6], 1u);
}
`;

export const coherentSolidInvariantWgsl = /* wgsl */ `${coherentSolidParamsWgsl}
@group(0) @binding(0) var<storage, read> target_frames: array<u32>;
@group(0) @binding(1) var<storage, read> members: array<u32>;
@group(0) @binding(2) var<storage, read> body_member_offsets: array<u32>;
@group(0) @binding(3) var<storage, read> body_member_indices: array<u32>;
@group(0) @binding(4) var<storage, read> transformed_members: array<u32>;
@group(0) @binding(5) var<storage, read_write> body_invariants: array<u32>;
@group(0) @binding(6) var<storage, read_write> global_evidence: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> params: CoherentSolidParams;

struct BodyInvariantPartial {
  mass: f32,
  moment: vec3<f32>,
  inertia_row_0: vec3<f32>,
  max_position_residual: f32,
  inertia_row_1: vec3<f32>,
  max_velocity_residual: f32,
  inertia_row_2: vec3<f32>,
  invalid_count: u32,
};

var<workgroup> invariant_partials: array<BodyInvariantPartial, 64>;

fn maximum_matrix_residual(left: vec3<f32>, right: vec3<f32>) -> f32 {
  let difference = abs(left - right);
  return max(difference.x, max(difference.y, difference.z));
}

@compute @workgroup_size(64)
fn reduce_body_invariants(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let body_index = workgroup_id.x + workgroup_id.y * params.body_dispatch_x;
  let lane = local_id.x;
  var partial: BodyInvariantPartial;
  partial.mass = 0.0;
  partial.moment = vec3<f32>(0.0);
  partial.inertia_row_0 = vec3<f32>(0.0);
  partial.inertia_row_1 = vec3<f32>(0.0);
  partial.inertia_row_2 = vec3<f32>(0.0);
  partial.max_position_residual = 0.0;
  partial.max_velocity_residual = 0.0;
  partial.invalid_count = 0u;
  var start = 0u;
  var end = 0u;
  var frame_valid = false;
  var membership_range_valid = false;

  if (body_index < params.body_count) {
    let frame_base = frame_word(body_index, 0u);
    let body_id = target_frames[frame_base + 0u];
    let component_generation = target_frames[frame_base + 1u];
    frame_valid = target_frames[frame_base + 9u] == params.target_generation_id
      && target_frames[frame_base + 10u] == params.lease_id
      && target_frames[frame_base + 11u] == params.lease_epoch
      && (target_frames[frame_base + 79u] & ROW_ACTIVE) != 0u;
    start = body_member_offsets[body_index];
    end = body_member_offsets[body_index + 1u];
    membership_range_valid = end >= start && end <= params.membership_index_count;
    if (!membership_range_valid) {
      frame_valid = false;
      if (lane == 0u) {
        partial.invalid_count = 1u;
      }
    }
    if (frame_valid) {
      let quaternion = vec4<f32>(
        bitcast<f32>(target_frames[frame_base + 16u]),
        bitcast<f32>(target_frames[frame_base + 17u]),
        bitcast<f32>(target_frames[frame_base + 18u]),
        bitcast<f32>(target_frames[frame_base + 19u])
      );
      let center_of_mass = vec3<f32>(
        bitcast<f32>(target_frames[frame_base + 13u]),
        bitcast<f32>(target_frames[frame_base + 14u]),
        bitcast<f32>(target_frames[frame_base + 15u])
      );
      let frame_mass = bitcast<f32>(target_frames[frame_base + 28u]);
      let linear_momentum = vec3<f32>(
        bitcast<f32>(target_frames[frame_base + 20u]),
        bitcast<f32>(target_frames[frame_base + 21u]),
        bitcast<f32>(target_frames[frame_base + 22u])
      );
      let angular_momentum = vec3<f32>(
        bitcast<f32>(target_frames[frame_base + 24u]),
        bitcast<f32>(target_frames[frame_base + 25u]),
        bitcast<f32>(target_frames[frame_base + 26u])
      );
      let omega_world = world_angular_velocity(
        &target_frames,
        frame_base,
        quaternion,
        angular_momentum
      );
      var membership_position = start + lane;
      loop {
        if (membership_position >= end) {
          break;
        }
        let member_index = body_member_indices[membership_position];
        var member_valid = member_index < params.member_count;
        if (member_valid) {
          let member_base = member_word(member_index, 0u);
          let transformed_base = transformed_word(member_index, 0u);
          member_valid = members[member_base + 0u] == body_index
            && members[member_base + 1u] == body_id
            && members[member_base + 3u] == component_generation
            && members[member_base + 4u] == params.member_generation_id
            && (members[member_base + 39u] & ROW_ACTIVE) != 0u
            && transformed_members[transformed_base + 0u] == body_id
            && transformed_members[transformed_base + 1u] == members[member_base + 2u]
            && transformed_members[transformed_base + 2u] == component_generation
            && transformed_members[transformed_base + 3u] == params.target_generation_id
            && (transformed_members[transformed_base + 18u] & ROW_ACTIVE) != 0u;
          if (member_valid) {
            let local_position = vec3<f32>(
              bitcast<f32>(members[member_base + 8u]),
              bitcast<f32>(members[member_base + 9u]),
              bitcast<f32>(members[member_base + 10u])
            );
            let member_mass = bitcast<f32>(members[member_base + 12u]);
            let intrinsic_row_0 = vec3<f32>(
              bitcast<f32>(members[member_base + 16u]),
              bitcast<f32>(members[member_base + 17u]),
              bitcast<f32>(members[member_base + 18u])
            );
            let intrinsic_row_1 = vec3<f32>(
              bitcast<f32>(members[member_base + 20u]),
              bitcast<f32>(members[member_base + 21u]),
              bitcast<f32>(members[member_base + 22u])
            );
            let intrinsic_row_2 = vec3<f32>(
              bitcast<f32>(members[member_base + 24u]),
              bitcast<f32>(members[member_base + 25u]),
              bitcast<f32>(members[member_base + 26u])
            );
            let world_position = vec3<f32>(
              bitcast<f32>(transformed_members[transformed_base + 4u]),
              bitcast<f32>(transformed_members[transformed_base + 5u]),
              bitcast<f32>(transformed_members[transformed_base + 6u])
            );
            let world_velocity = vec3<f32>(
              bitcast<f32>(transformed_members[transformed_base + 8u]),
              bitcast<f32>(transformed_members[transformed_base + 9u]),
              bitcast<f32>(transformed_members[transformed_base + 10u])
            );
            let world_offset = quaternion_rotate(quaternion, local_position);
            let expected_position = center_of_mass + world_offset;
            let expected_velocity = linear_momentum / frame_mass + cross(omega_world, world_offset);
            member_valid = finite_scalar(member_mass, params.finite_magnitude_limit)
              && member_mass >= 0.0
              && finite_vec3(local_position, params.finite_magnitude_limit)
              && finite_vec3(world_position, params.finite_magnitude_limit)
              && finite_vec3(world_velocity, params.finite_magnitude_limit);
            if (member_valid) {
              let x = local_position.x;
              let y = local_position.y;
              let z = local_position.z;
              partial.mass = partial.mass + member_mass;
              partial.moment = partial.moment + member_mass * local_position;
              partial.inertia_row_0 = partial.inertia_row_0 + intrinsic_row_0 + vec3<f32>(
                member_mass * (y * y + z * z),
                -member_mass * x * y,
                -member_mass * x * z
              );
              partial.inertia_row_1 = partial.inertia_row_1 + intrinsic_row_1 + vec3<f32>(
                -member_mass * y * x,
                member_mass * (x * x + z * z),
                -member_mass * y * z
              );
              partial.inertia_row_2 = partial.inertia_row_2 + intrinsic_row_2 + vec3<f32>(
                -member_mass * z * x,
                -member_mass * z * y,
                member_mass * (x * x + y * y)
              );
              partial.max_position_residual = max(
                partial.max_position_residual,
                length(world_position - expected_position)
              );
              partial.max_velocity_residual = max(
                partial.max_velocity_residual,
                length(world_velocity - expected_velocity)
              );
            }
          }
        }
        if (!member_valid) {
          partial.invalid_count = partial.invalid_count + 1u;
        }
        membership_position = membership_position + 64u;
      }
    }
  }

  invariant_partials[lane] = partial;
  workgroupBarrier();
  var reduction_stride = 32u;
  loop {
    if (lane < reduction_stride) {
      let right = invariant_partials[lane + reduction_stride];
      invariant_partials[lane].mass = invariant_partials[lane].mass + right.mass;
      invariant_partials[lane].moment = invariant_partials[lane].moment + right.moment;
      invariant_partials[lane].inertia_row_0 = invariant_partials[lane].inertia_row_0 + right.inertia_row_0;
      invariant_partials[lane].inertia_row_1 = invariant_partials[lane].inertia_row_1 + right.inertia_row_1;
      invariant_partials[lane].inertia_row_2 = invariant_partials[lane].inertia_row_2 + right.inertia_row_2;
      invariant_partials[lane].max_position_residual = max(
        invariant_partials[lane].max_position_residual,
        right.max_position_residual
      );
      invariant_partials[lane].max_velocity_residual = max(
        invariant_partials[lane].max_velocity_residual,
        right.max_velocity_residual
      );
      invariant_partials[lane].invalid_count = invariant_partials[lane].invalid_count + right.invalid_count;
    }
    workgroupBarrier();
    if (reduction_stride == 1u) {
      break;
    }
    reduction_stride = reduction_stride >> 1u;
  }

  if (body_index < params.body_count && lane == 0u) {
    let frame_base = frame_word(body_index, 0u);
    let output_base = body_invariant_word(body_index, 0u);
    let reduced = invariant_partials[0];
    let frame_mass = bitcast<f32>(target_frames[frame_base + 28u]);
    let quaternion = vec4<f32>(
      bitcast<f32>(target_frames[frame_base + 16u]),
      bitcast<f32>(target_frames[frame_base + 17u]),
      bitcast<f32>(target_frames[frame_base + 18u]),
      bitcast<f32>(target_frames[frame_base + 19u])
    );
    let inertia_row_0 = vec3<f32>(
      bitcast<f32>(target_frames[frame_base + 32u]),
      bitcast<f32>(target_frames[frame_base + 33u]),
      bitcast<f32>(target_frames[frame_base + 34u])
    );
    let inertia_row_1 = vec3<f32>(
      bitcast<f32>(target_frames[frame_base + 36u]),
      bitcast<f32>(target_frames[frame_base + 37u]),
      bitcast<f32>(target_frames[frame_base + 38u])
    );
    let inertia_row_2 = vec3<f32>(
      bitcast<f32>(target_frames[frame_base + 40u]),
      bitcast<f32>(target_frames[frame_base + 41u]),
      bitcast<f32>(target_frames[frame_base + 42u])
    );
    let inverse_row_0 = vec3<f32>(
      bitcast<f32>(target_frames[frame_base + 44u]),
      bitcast<f32>(target_frames[frame_base + 45u]),
      bitcast<f32>(target_frames[frame_base + 46u])
    );
    let inverse_row_1 = vec3<f32>(
      bitcast<f32>(target_frames[frame_base + 48u]),
      bitcast<f32>(target_frames[frame_base + 49u]),
      bitcast<f32>(target_frames[frame_base + 50u])
    );
    let inverse_row_2 = vec3<f32>(
      bitcast<f32>(target_frames[frame_base + 52u]),
      bitcast<f32>(target_frames[frame_base + 53u]),
      bitcast<f32>(target_frames[frame_base + 54u])
    );
    let mass_relative_residual = abs(reduced.mass - frame_mass) / max(abs(frame_mass), 1e-20);
    let local_center_of_mass_residual = length(reduced.moment) / max(abs(reduced.mass), 1e-20);
    let inertia_scale = max(
      1e-20,
      max(
        max(max(abs(inertia_row_0.x), abs(inertia_row_0.y)), abs(inertia_row_0.z)),
        max(
          max(max(abs(inertia_row_1.x), abs(inertia_row_1.y)), abs(inertia_row_1.z)),
          max(max(abs(inertia_row_2.x), abs(inertia_row_2.y)), abs(inertia_row_2.z))
        )
      )
    );
    let member_inertia_residual = max(
      maximum_matrix_residual(reduced.inertia_row_0, inertia_row_0),
      max(
        maximum_matrix_residual(reduced.inertia_row_1, inertia_row_1),
        maximum_matrix_residual(reduced.inertia_row_2, inertia_row_2)
      )
    ) / inertia_scale;
    let inertia_symmetry_residual = max(
      abs(inertia_row_0.y - inertia_row_1.x),
      max(abs(inertia_row_0.z - inertia_row_2.x), abs(inertia_row_1.z - inertia_row_2.y))
    );
    let product_row_0 = vec3<f32>(
      dot(inertia_row_0, vec3<f32>(inverse_row_0.x, inverse_row_1.x, inverse_row_2.x)),
      dot(inertia_row_0, vec3<f32>(inverse_row_0.y, inverse_row_1.y, inverse_row_2.y)),
      dot(inertia_row_0, vec3<f32>(inverse_row_0.z, inverse_row_1.z, inverse_row_2.z))
    );
    let product_row_1 = vec3<f32>(
      dot(inertia_row_1, vec3<f32>(inverse_row_0.x, inverse_row_1.x, inverse_row_2.x)),
      dot(inertia_row_1, vec3<f32>(inverse_row_0.y, inverse_row_1.y, inverse_row_2.y)),
      dot(inertia_row_1, vec3<f32>(inverse_row_0.z, inverse_row_1.z, inverse_row_2.z))
    );
    let product_row_2 = vec3<f32>(
      dot(inertia_row_2, vec3<f32>(inverse_row_0.x, inverse_row_1.x, inverse_row_2.x)),
      dot(inertia_row_2, vec3<f32>(inverse_row_0.y, inverse_row_1.y, inverse_row_2.y)),
      dot(inertia_row_2, vec3<f32>(inverse_row_0.z, inverse_row_1.z, inverse_row_2.z))
    );
    let inertia_inverse_residual = max(
      maximum_matrix_residual(product_row_0, vec3<f32>(1.0, 0.0, 0.0)),
      max(
        maximum_matrix_residual(product_row_1, vec3<f32>(0.0, 1.0, 0.0)),
        maximum_matrix_residual(product_row_2, vec3<f32>(0.0, 0.0, 1.0))
      )
    );
    let quaternion_norm = length(quaternion);
    let quaternion_residual = abs(quaternion_norm - 1.0);
    let linear_momentum = vec3<f32>(
      bitcast<f32>(target_frames[frame_base + 20u]),
      bitcast<f32>(target_frames[frame_base + 21u]),
      bitcast<f32>(target_frames[frame_base + 22u])
    );
    let angular_momentum = vec3<f32>(
      bitcast<f32>(target_frames[frame_base + 24u]),
      bitcast<f32>(target_frames[frame_base + 25u]),
      bitcast<f32>(target_frames[frame_base + 26u])
    );
    let omega_world = world_angular_velocity(
      &target_frames,
      frame_base,
      quaternion,
      angular_momentum
    );
    let speed = length(linear_momentum) / frame_mass;
    let kinetic_energy = 0.5 * dot(linear_momentum, linear_momentum) / frame_mass
      + 0.5 * dot(angular_momentum, omega_world);
    let center_of_mass = vec3<f32>(
      bitcast<f32>(target_frames[frame_base + 13u]),
      bitcast<f32>(target_frames[frame_base + 14u]),
      bitcast<f32>(target_frames[frame_base + 15u])
    );
    let maximum_state_magnitude = max(
      max(length(center_of_mass), length(linear_momentum)),
      max(length(angular_momentum), max(abs(frame_mass), abs(kinetic_energy)))
    );
    let numerically_admissible = frame_valid
      && reduced.invalid_count == 0u
      && quaternion_residual <= params.quaternion_norm_tolerance
      && mass_relative_residual <= params.mass_relative_tolerance
      && local_center_of_mass_residual <= params.local_center_of_mass_tolerance_m
      && inertia_symmetry_residual <= params.inertia_symmetry_tolerance_kg_m2
      && inertia_inverse_residual <= params.inertia_inverse_tolerance
      && member_inertia_residual <= params.member_inertia_relative_tolerance
      && reduced.max_position_residual <= params.transform_position_tolerance_m
      && reduced.max_velocity_residual <= params.transform_velocity_tolerance_m_s
      && finite_scalar(kinetic_energy, params.finite_magnitude_limit)
      && kinetic_energy >= 0.0;
    let invariant_status = select(
      INVARIANT_READY | INVARIANT_FAIL_CLOSED | INVARIANT_AWAITING_STATE_MANAGER,
      INVARIANT_READY | INVARIANT_ADMISSIBLE | INVARIANT_AWAITING_STATE_MANAGER,
      numerically_admissible
    );

    body_invariants[output_base + 0u] = target_frames[frame_base + 0u];
    body_invariants[output_base + 1u] = target_frames[frame_base + 1u];
    body_invariants[output_base + 2u] = params.target_generation_id;
    body_invariants[output_base + 3u] = params.lease_id;
    body_invariants[output_base + 4u] = select(0u, end - start, membership_range_valid);
    body_invariants[output_base + 5u] = reduced.invalid_count;
    body_invariants[output_base + 6u] = invariant_status;
    body_invariants[output_base + 7u] = 0u;
    body_invariants[output_base + 8u] = bitcast<u32>(reduced.mass);
    body_invariants[output_base + 9u] = bitcast<u32>(mass_relative_residual);
    body_invariants[output_base + 10u] = bitcast<u32>(local_center_of_mass_residual);
    body_invariants[output_base + 11u] = bitcast<u32>(reduced.max_position_residual);
    body_invariants[output_base + 12u] = bitcast<u32>(reduced.max_velocity_residual);
    body_invariants[output_base + 13u] = bitcast<u32>(quaternion_residual);
    body_invariants[output_base + 14u] = bitcast<u32>(inertia_symmetry_residual);
    body_invariants[output_base + 15u] = bitcast<u32>(inertia_inverse_residual);
    body_invariants[output_base + 16u] = bitcast<u32>(member_inertia_residual);
    body_invariants[output_base + 17u] = bitcast<u32>(length(linear_momentum));
    body_invariants[output_base + 18u] = bitcast<u32>(length(angular_momentum));
    body_invariants[output_base + 19u] = bitcast<u32>(kinetic_energy);
    body_invariants[output_base + 20u] = target_frames[frame_base + 13u];
    body_invariants[output_base + 21u] = target_frames[frame_base + 14u];
    body_invariants[output_base + 22u] = target_frames[frame_base + 15u];
    body_invariants[output_base + 23u] = bitcast<u32>(speed);
    body_invariants[output_base + 24u] = bitcast<u32>(quaternion_norm);
    body_invariants[output_base + 25u] = bitcast<u32>(frame_mass);
    body_invariants[output_base + 26u] = target_frames[frame_base + 31u];
    body_invariants[output_base + 27u] = bitcast<u32>(maximum_state_magnitude);
    body_invariants[output_base + 28u] = target_frames[frame_base + 64u];
    body_invariants[output_base + 29u] = target_frames[frame_base + 65u];
    body_invariants[output_base + 30u] = target_frames[frame_base + 78u];
    body_invariants[output_base + 31u] = 0u;
    body_invariants[output_base + 32u] = target_frames[frame_base + 16u];
    body_invariants[output_base + 33u] = target_frames[frame_base + 17u];
    body_invariants[output_base + 34u] = target_frames[frame_base + 18u];
    body_invariants[output_base + 35u] = target_frames[frame_base + 19u];
    body_invariants[output_base + 36u] = target_frames[frame_base + 4u];
    body_invariants[output_base + 37u] = target_frames[frame_base + 5u];
    body_invariants[output_base + 38u] = target_frames[frame_base + 6u];
    body_invariants[output_base + 39u] = target_frames[frame_base + 2u];

    atomicAdd(&global_evidence[23], 1u);
    if (!numerically_admissible) {
      atomicAdd(&global_evidence[24], 1u);
    }
  }
}
`;

export const coherentSolidFinalizeEvidenceWgsl = /* wgsl */ `${coherentSolidParamsWgsl}
@group(0) @binding(0) var<storage, read> body_invariants: array<u32>;
@group(0) @binding(1) var<storage, read_write> global_evidence: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> params: CoherentSolidParams;

struct GlobalInvariantPartial {
  max_quaternion: f32,
  max_mass: f32,
  max_local_com: f32,
  max_inertia_symmetry: f32,
  max_inertia_inverse: f32,
  max_member_inertia: f32,
  max_transform_position: f32,
  max_transform_velocity: f32,
  rejected_count: u32,
  invalid_count: u32,
};

var<workgroup> global_partials: array<GlobalInvariantPartial, 64>;

@compute @workgroup_size(64)
fn finalize_evidence(@builtin(local_invocation_id) local_id: vec3<u32>) {
  let lane = local_id.x;
  var partial: GlobalInvariantPartial;
  partial.max_quaternion = 0.0;
  partial.max_mass = 0.0;
  partial.max_local_com = 0.0;
  partial.max_inertia_symmetry = 0.0;
  partial.max_inertia_inverse = 0.0;
  partial.max_member_inertia = 0.0;
  partial.max_transform_position = 0.0;
  partial.max_transform_velocity = 0.0;
  partial.rejected_count = 0u;
  partial.invalid_count = 0u;
  var body_index = lane;
  loop {
    if (body_index >= params.body_count) {
      break;
    }
    let base = body_invariant_word(body_index, 0u);
    let valid = body_invariants[base + 2u] == params.target_generation_id
      && body_invariants[base + 3u] == params.lease_id
      && (body_invariants[base + 6u] & INVARIANT_READY) != 0u;
    if (valid) {
      partial.max_quaternion = max(partial.max_quaternion, bitcast<f32>(body_invariants[base + 13u]));
      partial.max_mass = max(partial.max_mass, bitcast<f32>(body_invariants[base + 9u]));
      partial.max_local_com = max(partial.max_local_com, bitcast<f32>(body_invariants[base + 10u]));
      partial.max_inertia_symmetry = max(
        partial.max_inertia_symmetry,
        bitcast<f32>(body_invariants[base + 14u])
      );
      partial.max_inertia_inverse = max(
        partial.max_inertia_inverse,
        bitcast<f32>(body_invariants[base + 15u])
      );
      partial.max_member_inertia = max(
        partial.max_member_inertia,
        bitcast<f32>(body_invariants[base + 16u])
      );
      partial.max_transform_position = max(
        partial.max_transform_position,
        bitcast<f32>(body_invariants[base + 11u])
      );
      partial.max_transform_velocity = max(
        partial.max_transform_velocity,
        bitcast<f32>(body_invariants[base + 12u])
      );
      if ((body_invariants[base + 6u] & INVARIANT_ADMISSIBLE) == 0u) {
        partial.rejected_count = partial.rejected_count + 1u;
      }
    } else {
      partial.invalid_count = partial.invalid_count + 1u;
    }
    body_index = body_index + 64u;
  }
  global_partials[lane] = partial;
  workgroupBarrier();

  var reduction_stride = 32u;
  loop {
    if (lane < reduction_stride) {
      let right = global_partials[lane + reduction_stride];
      global_partials[lane].max_quaternion = max(global_partials[lane].max_quaternion, right.max_quaternion);
      global_partials[lane].max_mass = max(global_partials[lane].max_mass, right.max_mass);
      global_partials[lane].max_local_com = max(global_partials[lane].max_local_com, right.max_local_com);
      global_partials[lane].max_inertia_symmetry = max(
        global_partials[lane].max_inertia_symmetry,
        right.max_inertia_symmetry
      );
      global_partials[lane].max_inertia_inverse = max(
        global_partials[lane].max_inertia_inverse,
        right.max_inertia_inverse
      );
      global_partials[lane].max_member_inertia = max(
        global_partials[lane].max_member_inertia,
        right.max_member_inertia
      );
      global_partials[lane].max_transform_position = max(
        global_partials[lane].max_transform_position,
        right.max_transform_position
      );
      global_partials[lane].max_transform_velocity = max(
        global_partials[lane].max_transform_velocity,
        right.max_transform_velocity
      );
      global_partials[lane].rejected_count = global_partials[lane].rejected_count + right.rejected_count;
      global_partials[lane].invalid_count = global_partials[lane].invalid_count + right.invalid_count;
    }
    workgroupBarrier();
    if (reduction_stride == 1u) {
      break;
    }
    reduction_stride = reduction_stride >> 1u;
  }

  if (lane == 0u) {
    let reduced = global_partials[0];
    let complete_counts = atomicLoad(&global_evidence[5]) == params.body_count
      && atomicLoad(&global_evidence[6]) == params.member_count
      && atomicLoad(&global_evidence[7]) == params.body_count
      && atomicLoad(&global_evidence[23]) == params.body_count;
    let clean_inputs = atomicLoad(&global_evidence[8]) == 0u
      && atomicLoad(&global_evidence[9]) == 0u
      && atomicLoad(&global_evidence[10]) == 0u
      && atomicLoad(&global_evidence[11]) == 0u
      && reduced.invalid_count == 0u;
    let numerically_admissible = complete_counts && clean_inputs && reduced.rejected_count == 0u
      && atomicLoad(&global_evidence[20]) <= bitcast<u32>(params.momentum_update_tolerance)
      && atomicLoad(&global_evidence[21]) <= bitcast<u32>(params.momentum_update_tolerance);
    let status = select(
      INVARIANT_READY | INVARIANT_FAIL_CLOSED | INVARIANT_AWAITING_STATE_MANAGER,
      INVARIANT_READY | INVARIANT_ADMISSIBLE | INVARIANT_AWAITING_STATE_MANAGER,
      numerically_admissible
    );
    atomicStore(&global_evidence[0], params.target_generation_id);
    atomicStore(&global_evidence[1], params.lease_id);
    atomicStore(&global_evidence[2], params.lease_epoch);
    atomicStore(&global_evidence[3], params.body_count);
    atomicStore(&global_evidence[4], params.member_count);
    atomicStore(&global_evidence[12], bitcast<u32>(reduced.max_quaternion));
    atomicStore(&global_evidence[13], bitcast<u32>(reduced.max_mass));
    atomicStore(&global_evidence[14], bitcast<u32>(reduced.max_local_com));
    atomicStore(&global_evidence[15], bitcast<u32>(reduced.max_inertia_symmetry));
    atomicStore(&global_evidence[16], bitcast<u32>(reduced.max_inertia_inverse));
    atomicStore(&global_evidence[17], bitcast<u32>(reduced.max_member_inertia));
    atomicStore(&global_evidence[18], bitcast<u32>(reduced.max_transform_position));
    atomicStore(&global_evidence[19], bitcast<u32>(reduced.max_transform_velocity));
    atomicStore(&global_evidence[22], select(0u, 1u, numerically_admissible));
    atomicStore(&global_evidence[24], reduced.rejected_count);
    atomicStore(&global_evidence[25], 15u);
    atomicStore(&global_evidence[26], 0u);
    atomicStore(&global_evidence[27], params.source_generation_id);
    atomicStore(&global_evidence[28], status);
    atomicStore(&global_evidence[29], 64u);
    atomicStore(&global_evidence[30], 1u);
    atomicStore(&global_evidence[31], 1u);
  }
}
`;

export const coherentSolidFailCloseFramesWgsl = /* wgsl */ `${coherentSolidParamsWgsl}
@group(0) @binding(0) var<storage, read_write> target_frames: array<u32>;
@group(0) @binding(1) var<storage, read_write> global_evidence: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> params: CoherentSolidParams;

@compute @workgroup_size(64)
fn fail_close_rejected_frames(@builtin(global_invocation_id) id: vec3<u32>) {
  let body_index = id.x + id.y * params.body_linear_dispatch_x * params.workgroup_size;
  if (body_index >= params.body_count) { return; }
  let frame_base = frame_word(body_index, 0u);
  let global_status = atomicLoad(&global_evidence[28]);
  let global_admissible = atomicLoad(&global_evidence[0]) == params.target_generation_id
    && atomicLoad(&global_evidence[1]) == params.lease_id
    && atomicLoad(&global_evidence[2]) == params.lease_epoch
    && atomicLoad(&global_evidence[3]) == params.body_count
    && atomicLoad(&global_evidence[4]) == params.member_count
    && atomicLoad(&global_evidence[22]) == 1u
    && (global_status & INVARIANT_READY) != 0u
    && (global_status & INVARIANT_ADMISSIBLE) != 0u
    && (global_status & INVARIANT_FAIL_CLOSED) == 0u;
  let frame_matches = target_frames[frame_base + 9u] == params.target_generation_id
    && target_frames[frame_base + 10u] == params.lease_id
    && target_frames[frame_base + 11u] == params.lease_epoch
    && (target_frames[frame_base + 79u] & ROW_ACTIVE) != 0u;
  if (!global_admissible || !frame_matches) {
    target_frames[frame_base + 79u] = ROW_FAIL_CLOSED;
  }
}
`;

export function coherentSolidWgslForWorkgroupSize(source, workgroupSize = 64) {
  const size = Number(workgroupSize);
  if (!Number.isInteger(size) || size < 16 || size > 256 || (size & (size - 1)) !== 0) {
    throw new RangeError('coherent-solid workgroup size must be a power of two in [16, 256]');
  }
  const half = size >>> 1;
  return String(source)
    .replaceAll('@workgroup_size(64)', `@workgroup_size(${size})`)
    .replaceAll('array<f32, 64>', `array<f32, ${size}>`)
    .replaceAll('array<u32, 64>', `array<u32, ${size}>`)
    .replaceAll('array<BodyInvariantPartial, 64>', `array<BodyInvariantPartial, ${size}>`)
    .replaceAll('array<GlobalInvariantPartial, 64>', `array<GlobalInvariantPartial, ${size}>`)
    .replaceAll('membership_position = membership_position + 64u;',
      `membership_position = membership_position + ${size}u;`)
    .replaceAll(') * 64u + local_id.x;', `) * ${size}u + local_id.x;`)
    .replaceAll('body_index = body_index + 64u;', `body_index = body_index + ${size}u;`)
    .replaceAll('var reduction_stride = 32u;', `var reduction_stride = ${half}u;`)
    .replaceAll('atomicStore(&global_evidence[29], 64u);',
      `atomicStore(&global_evidence[29], ${size}u);`);
}
