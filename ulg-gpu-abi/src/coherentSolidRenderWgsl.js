const coherentSolidRenderParamsWgsl = /* wgsl */ `
struct SolidRenderParams {
  body_index: u32,
  generation_id: u32,
  lease_id: u32,
  lease_epoch: u32,
  view_center_x_m: f32,
  view_center_y_m: f32,
  view_center_z_m: f32,
  inverse_half_width_per_m: f32,
  inverse_half_height_per_m: f32,
  depth_scale_per_m: f32,
  viewport_width_px: f32,
  viewport_height_px: f32,
  minor_grid_spacing_m: f32,
  major_grid_spacing_m: f32,
  exposure: f32,
  flags: u32,
};
`;

export const coherentSolidShapeRenderWgsl = /* wgsl */ `${coherentSolidRenderParamsWgsl}
@group(0) @binding(0) var<storage, read> resident_frames: array<u32>;
@group(0) @binding(1) var<storage, read> rest_vertices: array<f32>;
@group(0) @binding(2) var<uniform> params: SolidRenderParams;

const FRAME_WORDS: u32 = 80u;
const REST_VERTEX_FLOATS: u32 = 12u;
const ROW_ACTIVE: u32 = 1u;

struct SolidVertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) world_normal: vec3<f32>,
};

fn normalize_quaternion(value: vec4<f32>) -> vec4<f32> {
  let norm_squared = dot(value, value);
  if (!(norm_squared > 1e-30) || !(norm_squared == norm_squared)) {
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
  }
  return value * inverseSqrt(norm_squared);
}

fn quaternion_rotate(quaternion: vec4<f32>, value: vec3<f32>) -> vec3<f32> {
  let q = normalize_quaternion(quaternion);
  let twice_cross = 2.0 * cross(q.xyz, value);
  return value + q.w * twice_cross + cross(q.xyz, twice_cross);
}

@vertex
fn solid_vertex(@builtin(vertex_index) vertex_index: u32) -> SolidVertexOutput {
  let frame_base = params.body_index * FRAME_WORDS;
  let vertex_base = vertex_index * REST_VERTEX_FLOATS;
  let valid_frame = resident_frames[frame_base + 9u] == params.generation_id
    && resident_frames[frame_base + 10u] == params.lease_id
    && resident_frames[frame_base + 11u] == params.lease_epoch
    && (resident_frames[frame_base + 79u] & ROW_ACTIVE) != 0u;
  var output: SolidVertexOutput;
  if (!valid_frame) {
    output.position = vec4<f32>(2.0, 2.0, 1.0, 1.0);
    output.color = vec4<f32>(0.0);
    output.world_normal = vec3<f32>(0.0, 0.0, 1.0);
    return output;
  }
  let center_of_mass = vec3<f32>(
    bitcast<f32>(resident_frames[frame_base + 13u]),
    bitcast<f32>(resident_frames[frame_base + 14u]),
    bitcast<f32>(resident_frames[frame_base + 15u])
  );
  let quaternion = vec4<f32>(
    bitcast<f32>(resident_frames[frame_base + 16u]),
    bitcast<f32>(resident_frames[frame_base + 17u]),
    bitcast<f32>(resident_frames[frame_base + 18u]),
    bitcast<f32>(resident_frames[frame_base + 19u])
  );
  let local_position = vec3<f32>(
    rest_vertices[vertex_base + 0u],
    rest_vertices[vertex_base + 1u],
    rest_vertices[vertex_base + 2u]
  );
  let local_normal = vec3<f32>(
    rest_vertices[vertex_base + 4u],
    rest_vertices[vertex_base + 5u],
    rest_vertices[vertex_base + 6u]
  );
  let world_position = center_of_mass + quaternion_rotate(quaternion, local_position);
  let relative = world_position - vec3<f32>(
    params.view_center_x_m,
    params.view_center_y_m,
    params.view_center_z_m
  );
  output.position = vec4<f32>(
    relative.x * params.inverse_half_width_per_m,
    relative.y * params.inverse_half_height_per_m,
    clamp(0.5 - relative.z * params.depth_scale_per_m, 0.0, 1.0),
    1.0
  );
  output.color = vec4<f32>(
    rest_vertices[vertex_base + 8u],
    rest_vertices[vertex_base + 9u],
    rest_vertices[vertex_base + 10u],
    rest_vertices[vertex_base + 11u]
  );
  output.world_normal = normalize(quaternion_rotate(quaternion, local_normal));
  return output;
}

@fragment
fn solid_fragment(input: SolidVertexOutput) -> @location(0) vec4<f32> {
  let light_direction = normalize(vec3<f32>(-0.35, 0.72, 0.58));
  let diffuse = 0.28 + 0.72 * max(0.0, dot(input.world_normal, light_direction));
  let lit = input.color.rgb * diffuse * params.exposure;
  return vec4<f32>(lit, input.color.a);
}
`;

export const coherentSolidGridBackdropWgsl = /* wgsl */ `${coherentSolidRenderParamsWgsl}
@group(0) @binding(0) var<uniform> params: SolidRenderParams;

struct BackdropVertexOutput {
  @builtin(position) position: vec4<f32>,
};

@vertex
fn backdrop_vertex(@builtin(vertex_index) vertex_index: u32) -> BackdropVertexOutput {
  let x = f32((vertex_index << 1u) & 2u);
  let y = f32(vertex_index & 2u);
  var output: BackdropVertexOutput;
  output.position = vec4<f32>(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.999, 1.0);
  return output;
}

fn grid_line(world: vec2<f32>, spacing: f32) -> f32 {
  let coordinate = world / spacing;
  let distance_to_line = abs(fract(coordinate + 0.5) - 0.5) * spacing;
  let width = max(fwidth(world.x), fwidth(world.y)) * 0.72;
  return 1.0 - smoothstep(0.0, width, min(distance_to_line.x, distance_to_line.y));
}

@fragment
fn backdrop_fragment(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {
  let ndc = vec2<f32>(
    position.x / params.viewport_width_px * 2.0 - 1.0,
    1.0 - position.y / params.viewport_height_px * 2.0
  );
  let world = vec2<f32>(
    ndc.x / params.inverse_half_width_per_m + params.view_center_x_m,
    ndc.y / params.inverse_half_height_per_m + params.view_center_y_m
  );
  let minor = grid_line(world, params.minor_grid_spacing_m);
  let major = grid_line(world, params.major_grid_spacing_m);
  let background = vec3<f32>(0.012, 0.018, 0.022);
  let minor_color = vec3<f32>(0.055, 0.072, 0.078);
  let major_color = vec3<f32>(0.12, 0.145, 0.15);
  let color = mix(background, minor_color, minor * 0.72);
  return vec4<f32>(mix(color, major_color, major * 0.92), 1.0);
}
`;

export const coherentSolidNativeBridgeWgsl = /* wgsl */ `
struct NativeCamera {
  view_projection: mat4x4<f32>,
};

struct SolidDrawParams {
  generation_id: u32,
  lease_id: u32,
  lease_epoch: u32,
  geometry_key: u32,
  topology_generation: u32,
  flags: u32,
  exposure: f32,
  opacity: f32,
};

@group(0) @binding(0) var<storage, read> resident_frames: array<u32>;
@group(0) @binding(1) var<storage, read> rest_vertices: array<f32>;
@group(0) @binding(2) var<uniform> camera: NativeCamera;
@group(0) @binding(3) var<uniform> params: SolidDrawParams;
@group(0) @binding(4) var<storage, read> instance_body_indices: array<u32>;

const FRAME_WORDS: u32 = 80u;
const REST_VERTEX_FLOATS: u32 = 12u;
const ROW_ACTIVE: u32 = 1u;

struct NativeSolidVertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) world_normal: vec3<f32>,
};

fn normalize_quaternion(value: vec4<f32>) -> vec4<f32> {
  let norm_squared = dot(value, value);
  if (!(norm_squared > 1e-30) || !(norm_squared == norm_squared)) {
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
  }
  return value * inverseSqrt(norm_squared);
}

fn quaternion_rotate(quaternion: vec4<f32>, value: vec3<f32>) -> vec3<f32> {
  let q = normalize_quaternion(quaternion);
  let twice_cross = 2.0 * cross(q.xyz, value);
  return value + q.w * twice_cross + cross(q.xyz, twice_cross);
}

@vertex
fn native_solid_vertex(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
) -> NativeSolidVertexOutput {
  let body_index = instance_body_indices[instance_index];
  let frame_base = body_index * FRAME_WORDS;
  let vertex_base = vertex_index * REST_VERTEX_FLOATS;
  let valid_frame = resident_frames[frame_base + 9u] == params.generation_id
    && resident_frames[frame_base + 10u] == params.lease_id
    && resident_frames[frame_base + 11u] == params.lease_epoch
    && resident_frames[frame_base + 60u] == params.geometry_key
    && resident_frames[frame_base + 64u] == params.topology_generation
    && (resident_frames[frame_base + 79u] & ROW_ACTIVE) != 0u;
  var output: NativeSolidVertexOutput;
  if (!valid_frame) {
    output.position = vec4<f32>(2.0, 2.0, 1.0, 1.0);
    output.color = vec4<f32>(0.0);
    output.world_normal = vec3<f32>(0.0, 0.0, 1.0);
    return output;
  }
  let center_of_mass = vec3<f32>(
    bitcast<f32>(resident_frames[frame_base + 13u]),
    bitcast<f32>(resident_frames[frame_base + 14u]),
    bitcast<f32>(resident_frames[frame_base + 15u])
  );
  let quaternion = vec4<f32>(
    bitcast<f32>(resident_frames[frame_base + 16u]),
    bitcast<f32>(resident_frames[frame_base + 17u]),
    bitcast<f32>(resident_frames[frame_base + 18u]),
    bitcast<f32>(resident_frames[frame_base + 19u])
  );
  let local_position = vec3<f32>(
    rest_vertices[vertex_base + 0u],
    rest_vertices[vertex_base + 1u],
    rest_vertices[vertex_base + 2u]
  );
  let local_normal = vec3<f32>(
    rest_vertices[vertex_base + 4u],
    rest_vertices[vertex_base + 5u],
    rest_vertices[vertex_base + 6u]
  );
  let world_position = center_of_mass + quaternion_rotate(quaternion, local_position);
  output.position = camera.view_projection * vec4<f32>(world_position, 1.0);
  output.color = vec4<f32>(
    rest_vertices[vertex_base + 8u],
    rest_vertices[vertex_base + 9u],
    rest_vertices[vertex_base + 10u],
    1.0
  );
  output.world_normal = normalize(quaternion_rotate(quaternion, local_normal));
  return output;
}

@fragment
fn native_solid_fragment(input: NativeSolidVertexOutput) -> @location(0) vec4<f32> {
  let light_direction = normalize(vec3<f32>(-0.35, 0.72, 0.58));
  let diffuse = 0.3 + 0.7 * max(0.0, dot(input.world_normal, light_direction));
  return vec4<f32>(input.color.rgb * diffuse * params.exposure, 1.0);
}
`;
