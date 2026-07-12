const coherentSolidResidentParamsWgsl = /* wgsl */ `
struct CoherentSolidResidentParams {
  body_count: u32,
  member_count: u32,
  proxy_count: u32,
  source_generation_id: u32,
  target_generation_id: u32,
  lease_id: u32,
  lease_epoch: u32,
  chart_id: i32,
  level_id: i32,
  hierarchy_generation: u32,
  source_position_epoch: u32,
  geometry_key: u32,
  topology_generation: u32,
  index_count: u32,
  has_particle_wrenches: u32,
  target_position_epoch: u32,
  source_chart_id: i32,
  source_level_id: i32,
  source_hierarchy_generation: u32,
  max_dispatch_workgroups_per_dimension: u32,
  body_dispatch_x: u32,
  member_dispatch_x: u32,
  proxy_dispatch_x: u32,
  proxy_output_limit: u32,
  workgroup_size: u32,
  proxy_generation_id: u32,
  chart_transition_enabled: u32,
  proxy_order_reused: u32,
};

const FRAME_WORDS: u32 = 80u;
const MEMBER_WORDS: u32 = 40u;
const LOCAL_PROXY_WORDS: u32 = 32u;
const WORLD_PROXY_WORDS: u32 = 24u;
const PARTICLE_WRENCH_WORDS: u32 = 12u;
const MEMBER_WRENCH_WORDS: u32 = 12u;
const BODY_INVARIANT_WORDS: u32 = 40u;
const PROXY_COMPACTION_EVIDENCE_WORDS: u32 = 16u;
const ROW_ACTIVE: u32 = 1u;
const ROW_FAIL_CLOSED: u32 = 0x80000000u;
const INVARIANT_ADMISSIBLE: u32 = 2u;

fn quaternion_rotate(quaternion: vec4<f32>, value: vec3<f32>) -> vec3<f32> {
  let norm_squared = dot(quaternion, quaternion);
  let q = select(vec4<f32>(0.0, 0.0, 0.0, 1.0), quaternion * inverseSqrt(norm_squared),
    norm_squared > 1e-30 && norm_squared == norm_squared);
  let twice_cross = 2.0 * cross(q.xyz, value);
  return value + q.w * twice_cross + cross(q.xyz, twice_cross);
}

fn inverse_inertia_times(frames: ptr<storage, array<u32>, read>, base: u32, value: vec3<f32>) -> vec3<f32> {
  return vec3<f32>(
    bitcast<f32>((*frames)[base + 44u]) * value.x
      + bitcast<f32>((*frames)[base + 45u]) * value.y
      + bitcast<f32>((*frames)[base + 46u]) * value.z,
    bitcast<f32>((*frames)[base + 48u]) * value.x
      + bitcast<f32>((*frames)[base + 49u]) * value.y
      + bitcast<f32>((*frames)[base + 50u]) * value.z,
    bitcast<f32>((*frames)[base + 52u]) * value.x
      + bitcast<f32>((*frames)[base + 53u]) * value.y
      + bitcast<f32>((*frames)[base + 54u]) * value.z
  );
}

fn world_angular_velocity(frames: ptr<storage, array<u32>, read>, base: u32, q: vec4<f32>, angular_momentum: vec3<f32>) -> vec3<f32> {
  let body_momentum = quaternion_rotate(vec4<f32>(-q.xyz, q.w), angular_momentum);
  return quaternion_rotate(q, inverse_inertia_times(frames, base, body_momentum));
}

fn linear_index(
  workgroup_id: vec3<u32>,
  local_id: vec3<u32>,
  dispatch_x: u32,
  workgroup_size: u32
) -> u32 {
  return (workgroup_id.x + workgroup_id.y * dispatch_x) * workgroup_size + local_id.x;
}
`;

export const coherentSolidParticleWrenchAdapterWgsl = /* wgsl */ `${coherentSolidResidentParamsWgsl}
@group(0) @binding(0) var<storage, read> members: array<u32>;
@group(0) @binding(1) var<storage, read> particle_wrenches: array<u32>;
@group(0) @binding(2) var<storage, read_write> member_wrenches: array<u32>;
@group(0) @binding(3) var<uniform> params: CoherentSolidResidentParams;

@compute @workgroup_size(64)
fn adapt_particle_member_wrenches(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let member_index = linear_index(
    workgroup_id,
    local_id,
    params.member_dispatch_x,
    params.workgroup_size
  );
  if (member_index >= params.member_count) { return; }
  let member_base = member_index * MEMBER_WORDS;
  let particle_base = member_index * PARTICLE_WRENCH_WORDS;
  let output_base = member_index * MEMBER_WRENCH_WORDS;
  let member_id = members[member_base + 2u];
  let body_id = members[member_base + 1u];
  let component_generation = members[member_base + 3u];
  let member_active = (members[member_base + 39u] & ROW_ACTIVE) != 0u;
  let source_valid = params.has_particle_wrenches == 0u || (
    particle_wrenches[particle_base + 0u] == member_id
    && particle_wrenches[particle_base + 1u] == body_id
    && particle_wrenches[particle_base + 10u] == params.source_position_epoch
    && (particle_wrenches[particle_base + 8u] & ROW_ACTIVE) != 0u
  );
  member_wrenches[output_base + 0u] = member_id;
  member_wrenches[output_base + 1u] = body_id;
  member_wrenches[output_base + 2u] = component_generation;
  member_wrenches[output_base + 3u] = params.source_generation_id;
  for (var word = 4u; word <= 6u; word = word + 1u) {
    member_wrenches[output_base + word] = select(0u, particle_wrenches[particle_base + word - 2u], params.has_particle_wrenches != 0u);
  }
  member_wrenches[output_base + 7u] = select(ROW_FAIL_CLOSED, ROW_ACTIVE, member_active && source_valid);
  for (var word = 8u; word <= 10u; word = word + 1u) {
    member_wrenches[output_base + word] = select(0u, particle_wrenches[particle_base + word - 3u], params.has_particle_wrenches != 0u);
  }
  member_wrenches[output_base + 11u] = select(0u, particle_wrenches[particle_base + 9u], params.has_particle_wrenches != 0u);
}
`;

export const coherentSolidContactKeyWgsl = /* wgsl */ `${coherentSolidResidentParamsWgsl}
@group(0) @binding(0) var<storage, read> local_proxies: array<u32>;
@group(0) @binding(1) var<storage, read_write> proxy_identity_keys: array<u32>;
@group(0) @binding(2) var<uniform> params: CoherentSolidResidentParams;

@compute @workgroup_size(64)
fn build_contact_proxy_identity_keys(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let proxy_index = linear_index(
    workgroup_id,
    local_id,
    params.proxy_dispatch_x,
    params.workgroup_size
  );
  if (proxy_index >= params.proxy_count) { return; }
  let local_base = proxy_index * LOCAL_PROXY_WORDS;
  let key_base = proxy_index * 2u;
  proxy_identity_keys[key_base + 0u] = local_proxies[local_base + 1u];
  proxy_identity_keys[key_base + 1u] = local_proxies[local_base + 2u];
}
`;

export const coherentSolidContactCompactionWgsl = /* wgsl */ `${coherentSolidResidentParamsWgsl}
@group(0) @binding(0) var<storage, read> target_frames: array<u32>;
@group(0) @binding(1) var<storage, read> local_proxies: array<u32>;
@group(0) @binding(2) var<storage, read> sorted_proxy_indices: array<u32>;
@group(0) @binding(3) var<storage, read> unique_proxy_offsets: array<u32>;
@group(0) @binding(4) var<storage, read> unique_proxy_evidence: array<u32>;
@group(0) @binding(5) var<storage, read_write> world_proxies: array<u32>;
@group(0) @binding(6) var<storage, read_write> proxy_evidence: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> proxy_dispatch: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> params: CoherentSolidResidentParams;
@group(0) @binding(9) var<storage, read_write> target_local_proxies: array<u32>;
@group(0) @binding(10) var<storage, read> proxy_dispatch_read: array<u32>;

@compute @workgroup_size(1)
fn prepare_contact_proxy_compaction() {
  let primitive_valid = unique_proxy_evidence[0] == params.target_generation_id
    && unique_proxy_evidence[1] == params.proxy_count
    && unique_proxy_evidence[3] == 1u
    && unique_proxy_evidence[4] == 0u
    && unique_proxy_evidence[5] == 2u;
  let unique_count = select(0u, unique_proxy_evidence[2], primitive_valid);
  let group_count = (unique_count + params.workgroup_size - 1u) / params.workgroup_size;
  let dispatch_x = min(max(group_count, 1u), params.max_dispatch_workgroups_per_dimension);
  let dispatch_y = select(
    1u,
    (group_count + dispatch_x - 1u) / dispatch_x,
    group_count > 0u
  );
  let dispatch_valid = dispatch_y <= params.max_dispatch_workgroups_per_dimension;
  atomicStore(&proxy_dispatch[0], select(0u, dispatch_x, primitive_valid && dispatch_valid));
  atomicStore(&proxy_dispatch[1], select(0u, dispatch_y, primitive_valid && dispatch_valid));
  atomicStore(&proxy_dispatch[2], select(0u, 1u, primitive_valid && dispatch_valid));
  atomicStore(&proxy_evidence[0], params.target_generation_id);
  atomicStore(&proxy_evidence[1], params.lease_id);
  atomicStore(&proxy_evidence[2], params.proxy_count);
  atomicStore(&proxy_evidence[3], unique_count);
  atomicStore(&proxy_evidence[4], 0u);
  atomicStore(&proxy_evidence[5], 0u);
  atomicStore(&proxy_evidence[6], 0u);
  atomicStore(&proxy_evidence[7], select(1u, 0u, dispatch_valid));
  atomicStore(&proxy_evidence[8], 0u);
  atomicStore(&proxy_evidence[9], bitcast<u32>(params.chart_id));
  atomicStore(&proxy_evidence[10], bitcast<u32>(params.level_id));
  atomicStore(&proxy_evidence[11], params.hierarchy_generation);
  atomicStore(&proxy_evidence[12], params.source_position_epoch);
  atomicStore(&proxy_evidence[13], params.target_position_epoch);
  atomicStore(&proxy_evidence[14], 0u);
  atomicStore(&proxy_evidence[15], params.workgroup_size);
}

@compute @workgroup_size(1)
fn prepare_reused_contact_proxy_order() {
  let previous_valid = unique_proxy_evidence[0] == params.source_generation_id
    && unique_proxy_evidence[1] == params.lease_id
    && unique_proxy_evidence[2] == params.proxy_count
    && unique_proxy_evidence[3] == params.proxy_count
    && unique_proxy_evidence[8] == 1u
    && unique_proxy_evidence[14] == 3u;
  let unique_count = select(0u, params.proxy_count, previous_valid);
  let group_count = (unique_count + params.workgroup_size - 1u) / params.workgroup_size;
  let dispatch_x = min(max(group_count, 1u), params.max_dispatch_workgroups_per_dimension);
  let dispatch_y = select(
    1u,
    (group_count + dispatch_x - 1u) / dispatch_x,
    group_count > 0u
  );
  let dispatch_valid = dispatch_y <= params.max_dispatch_workgroups_per_dimension;
  atomicStore(&proxy_dispatch[0], select(0u, dispatch_x, previous_valid && dispatch_valid));
  atomicStore(&proxy_dispatch[1], select(0u, dispatch_y, previous_valid && dispatch_valid));
  atomicStore(&proxy_dispatch[2], select(0u, 1u, previous_valid && dispatch_valid));
  atomicStore(&proxy_evidence[0], params.target_generation_id);
  atomicStore(&proxy_evidence[1], params.lease_id);
  atomicStore(&proxy_evidence[2], params.proxy_count);
  atomicStore(&proxy_evidence[3], unique_count);
  atomicStore(&proxy_evidence[4], 0u);
  atomicStore(&proxy_evidence[5], 0u);
  atomicStore(&proxy_evidence[6], 0u);
  atomicStore(&proxy_evidence[7], select(1u, 0u, dispatch_valid));
  atomicStore(&proxy_evidence[8], 0u);
  atomicStore(&proxy_evidence[9], bitcast<u32>(params.chart_id));
  atomicStore(&proxy_evidence[10], bitcast<u32>(params.level_id));
  atomicStore(&proxy_evidence[11], params.hierarchy_generation);
  atomicStore(&proxy_evidence[12], params.source_position_epoch);
  atomicStore(&proxy_evidence[13], params.target_position_epoch);
  atomicStore(&proxy_evidence[14], 0u);
  atomicStore(&proxy_evidence[15], params.workgroup_size);
}

@compute @workgroup_size(64)
fn transform_compacted_contact_proxies(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let unique_index = linear_index(
    workgroup_id,
    local_id,
    proxy_dispatch_read[0],
    params.workgroup_size
  );
  let unique_count = atomicLoad(&proxy_evidence[3]);
  if (unique_index >= unique_count) { return; }
  if (unique_index >= params.proxy_output_limit) {
    atomicAdd(&proxy_evidence[7], 1u);
    return;
  }
  var sorted_start = unique_index;
  var sorted_end = unique_index + 1u;
  var proxy_index = unique_index;
  if (params.proxy_order_reused == 0u) {
    sorted_start = unique_proxy_offsets[unique_index];
    sorted_end = unique_proxy_offsets[unique_index + 1u];
    proxy_index = sorted_proxy_indices[sorted_start];
  }
  let duplicate = sorted_end != sorted_start + 1u;
  let local_base = proxy_index * LOCAL_PROXY_WORDS;
  let output_base = unique_index * WORLD_PROXY_WORDS;
  let target_local_base = unique_index * LOCAL_PROXY_WORDS;
  let body_index = local_proxies[local_base + 0u];
  var valid = proxy_index < params.proxy_count
    && body_index < params.body_count
    && !duplicate;
  var frame_base = 0u;
  if (valid) {
    frame_base = body_index * FRAME_WORDS;
    valid = target_frames[frame_base + 0u] == local_proxies[local_base + 1u]
      && target_frames[frame_base + 1u] == local_proxies[local_base + 4u]
      && target_frames[frame_base + 9u] == params.target_generation_id
      && target_frames[frame_base + 10u] == params.lease_id
      && target_frames[frame_base + 11u] == params.lease_epoch
      && target_frames[frame_base + 64u] == local_proxies[local_base + 28u]
      && local_proxies[local_base + 5u] == params.proxy_generation_id
      && bitcast<i32>(local_proxies[local_base + 6u]) == params.source_level_id
      && (target_frames[frame_base + 79u] & ROW_ACTIVE) != 0u
      && (local_proxies[local_base + 30u] & ROW_ACTIVE) != 0u;
  }
  if (duplicate) {
    atomicAdd(&proxy_evidence[5], sorted_end - sorted_start - 1u);
  }
  if (!valid) {
    world_proxies[output_base + 7u] = ROW_FAIL_CLOSED;
    target_local_proxies[target_local_base + 30u] = ROW_FAIL_CLOSED;
    atomicAdd(&proxy_evidence[6], 1u);
    return;
  }
  for (var word = 0u; word < LOCAL_PROXY_WORDS; word = word + 1u) {
    target_local_proxies[target_local_base + word] = local_proxies[local_base + word];
  }
  target_local_proxies[target_local_base + 6u] = bitcast<u32>(params.level_id);
  let q = vec4<f32>(
    bitcast<f32>(target_frames[frame_base + 16u]),
    bitcast<f32>(target_frames[frame_base + 17u]),
    bitcast<f32>(target_frames[frame_base + 18u]),
    bitcast<f32>(target_frames[frame_base + 19u])
  );
  let center = vec3<f32>(
    bitcast<f32>(target_frames[frame_base + 13u]),
    bitcast<f32>(target_frames[frame_base + 14u]),
    bitcast<f32>(target_frames[frame_base + 15u])
  );
  let local_position = vec3<f32>(
    bitcast<f32>(local_proxies[local_base + 8u]),
    bitcast<f32>(local_proxies[local_base + 9u]),
    bitcast<f32>(local_proxies[local_base + 10u])
  );
  let world_offset = quaternion_rotate(q, local_position);
  let linear_velocity = vec3<f32>(
    bitcast<f32>(target_frames[frame_base + 20u]),
    bitcast<f32>(target_frames[frame_base + 21u]),
    bitcast<f32>(target_frames[frame_base + 22u])
  ) / bitcast<f32>(target_frames[frame_base + 28u]);
  let angular_momentum = vec3<f32>(
    bitcast<f32>(target_frames[frame_base + 24u]),
    bitcast<f32>(target_frames[frame_base + 25u]),
    bitcast<f32>(target_frames[frame_base + 26u])
  );
  let omega = world_angular_velocity(&target_frames, frame_base, q, angular_momentum);
  let world_position = center + world_offset;
  let world_normal = quaternion_rotate(q, vec3<f32>(
    bitcast<f32>(local_proxies[local_base + 12u]),
    bitcast<f32>(local_proxies[local_base + 13u]),
    bitcast<f32>(local_proxies[local_base + 14u])
  ));
  let world_velocity = linear_velocity + cross(omega, world_offset);
  world_proxies[output_base + 0u] = target_frames[frame_base + 0u];
  world_proxies[output_base + 1u] = local_proxies[local_base + 2u];
  world_proxies[output_base + 2u] = target_frames[frame_base + 1u];
  world_proxies[output_base + 3u] = params.target_generation_id;
  world_proxies[output_base + 4u] = bitcast<u32>(world_position.x);
  world_proxies[output_base + 5u] = bitcast<u32>(world_position.y);
  world_proxies[output_base + 6u] = bitcast<u32>(world_position.z);
  world_proxies[output_base + 7u] = ROW_ACTIVE;
  world_proxies[output_base + 8u] = bitcast<u32>(world_normal.x);
  world_proxies[output_base + 9u] = bitcast<u32>(world_normal.y);
  world_proxies[output_base + 10u] = bitcast<u32>(world_normal.z);
  world_proxies[output_base + 11u] = bitcast<u32>(params.level_id);
  world_proxies[output_base + 12u] = bitcast<u32>(world_velocity.x);
  world_proxies[output_base + 13u] = bitcast<u32>(world_velocity.y);
  world_proxies[output_base + 14u] = bitcast<u32>(world_velocity.z);
  world_proxies[output_base + 15u] = bitcast<u32>(params.chart_id);
  world_proxies[output_base + 16u] = local_proxies[local_base + 15u];
  world_proxies[output_base + 17u] = local_proxies[local_base + 16u];
  world_proxies[output_base + 18u] = local_proxies[local_base + 17u];
  world_proxies[output_base + 19u] = local_proxies[local_base + 23u];
  world_proxies[output_base + 20u] = local_proxies[local_base + 28u];
  world_proxies[output_base + 21u] = params.hierarchy_generation;
  world_proxies[output_base + 22u] = params.target_position_epoch;
  world_proxies[output_base + 23u] = local_proxies[local_base + 29u];
  atomicAdd(&proxy_evidence[4], 1u);
}

@compute @workgroup_size(1)
fn finalize_contact_proxy_compaction() {
  let admissible = atomicLoad(&proxy_evidence[0]) == params.target_generation_id
    && atomicLoad(&proxy_evidence[1]) == params.lease_id
    && atomicLoad(&proxy_evidence[2]) == params.proxy_count
    && atomicLoad(&proxy_evidence[3]) == params.proxy_count
    && atomicLoad(&proxy_evidence[3]) == atomicLoad(&proxy_evidence[4])
    && atomicLoad(&proxy_evidence[5]) == 0u
    && atomicLoad(&proxy_evidence[6]) == 0u
    && atomicLoad(&proxy_evidence[7]) == 0u;
  atomicStore(&proxy_evidence[8], select(0u, 1u, admissible));
  atomicStore(&proxy_evidence[14], select(5u, 3u, admissible));
}
`;

export const coherentSolidIndirectDrawWgsl = /* wgsl */ `${coherentSolidResidentParamsWgsl}
@group(0) @binding(0) var<storage, read> target_frames: array<u32>;
@group(0) @binding(1) var<storage, read> body_invariants: array<u32>;
@group(0) @binding(2) var<storage, read_write> instance_body_indices: array<u32>;
@group(0) @binding(3) var<storage, read_write> draw_indirect: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: CoherentSolidResidentParams;
@group(0) @binding(5) var<storage, read> proxy_compaction_evidence: array<u32>;

@compute @workgroup_size(1)
fn initialize_solid_draw() {
  atomicStore(&draw_indirect[0], params.index_count);
  atomicStore(&draw_indirect[1], 0u);
  atomicStore(&draw_indirect[2], 0u);
  atomicStore(&draw_indirect[3], 0u);
  atomicStore(&draw_indirect[4], 0u);
}

@compute @workgroup_size(64)
fn compact_solid_draw_instances(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let body_index = linear_index(
    workgroup_id,
    local_id,
    params.body_dispatch_x,
    params.workgroup_size
  );
  if (body_index >= params.body_count) { return; }
  let frame_base = body_index * FRAME_WORDS;
  let invariant_base = body_index * BODY_INVARIANT_WORDS;
  let valid = target_frames[frame_base + 9u] == params.target_generation_id
    && target_frames[frame_base + 10u] == params.lease_id
    && target_frames[frame_base + 11u] == params.lease_epoch
    && target_frames[frame_base + 60u] == params.geometry_key
    && target_frames[frame_base + 64u] == params.topology_generation
    && (target_frames[frame_base + 79u] & ROW_ACTIVE) != 0u
    && body_invariants[invariant_base + 2u] == params.target_generation_id
    && body_invariants[invariant_base + 3u] == params.lease_id
    && (body_invariants[invariant_base + 6u] & INVARIANT_ADMISSIBLE) != 0u
    && (params.proxy_count == 0u || (
      proxy_compaction_evidence[0] == params.target_generation_id
      && proxy_compaction_evidence[1] == params.lease_id
      && proxy_compaction_evidence[2] == params.proxy_count
      && proxy_compaction_evidence[8] == 1u
      && proxy_compaction_evidence[14] == 3u
    ));
  if (valid) {
    instance_body_indices[body_index] = body_index;
    atomicAdd(&draw_indirect[1], 1u);
  }
}
`;

export function coherentSolidResidentWgslForWorkgroupSize(source, workgroupSize = 64) {
  const size = Number(workgroupSize);
  if (!Number.isInteger(size) || size < 16 || size > 256 || (size & (size - 1)) !== 0) {
    throw new RangeError('coherent-solid resident workgroup size must be a power of two in [16, 256]');
  }
  return String(source).replaceAll('@workgroup_size(64)', `@workgroup_size(${size})`);
}
