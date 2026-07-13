export const ULG_NATIVE_REFRACTION_TRANSPORT_WGSL_SCHEMA =
  'peercompute.ulg.native-refraction-transport-wgsl.v0';

/**
 * Shared native WebGPU refraction transport used by production rendering and
 * manufactured GPU validation. The functions are pure WGSL: callers supply
 * matrices, surface validity, geometry, and spectral complex-index inputs.
 */
export const ULG_NATIVE_REFRACTION_TRANSPORT_WGSL = /* wgsl */ `
struct RefractionProjectedPoint {
  uv: vec2<f32>,
  depth: f32,
  valid: f32,
};

struct RefractionWorldPoint {
  world_position: vec3<f32>,
  valid: f32,
};

struct RefractionSurfacePixel {
  pixel: vec2<u32>,
  uv: vec2<f32>,
  valid: f32,
};

struct RefractedPath {
  exit_uv: vec2<f32>,
  path_m: f32,
  valid: f32,
  exit_world: vec3<f32>,
  lateral_displacement_m: f32,
};

fn invalid_refracted_path() -> RefractedPath {
  return RefractedPath(
    vec2<f32>(0.0),
    0.0,
    0.0,
    vec3<f32>(0.0),
    0.0
  );
}

fn refraction_project_world_to_uv(
  world_position: vec3<f32>,
  view_projection: mat4x4<f32>
) -> RefractionProjectedPoint {
  let clip = view_projection * vec4<f32>(world_position, 1.0);
  if (!(clip.w > 1.0e-6)) {
    return RefractionProjectedPoint(vec2<f32>(0.0), 0.0, 0.0);
  }
  let ndc = clip.xyz / clip.w;
  let uv = vec2<f32>(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
  let depth = ndc.z * 0.5 + 0.5;
  let finite = all(uv == uv) && depth == depth
    && all(abs(uv) < vec2<f32>(1.0e20)) && abs(depth) < 1.0e20;
  let inside_view = all(uv >= vec2<f32>(0.001))
    && all(uv <= vec2<f32>(0.999))
    && depth >= 0.0 && depth <= 1.0;
  return RefractionProjectedPoint(
    uv,
    depth,
    select(0.0, 1.0, finite && inside_view)
  );
}

fn refraction_unproject_uv_depth(
  uv: vec2<f32>,
  depth: f32,
  inverse_view_projection: mat4x4<f32>
) -> RefractionWorldPoint {
  let input_valid = all(uv == uv) && depth == depth
    && all(uv >= vec2<f32>(0.0)) && all(uv <= vec2<f32>(1.0))
    && depth >= 0.0 && depth <= 1.0;
  if (!input_valid) {
    return RefractionWorldPoint(vec3<f32>(0.0), 0.0);
  }
  let ndc = vec3<f32>(
    uv.x * 2.0 - 1.0,
    1.0 - uv.y * 2.0,
    depth * 2.0 - 1.0
  );
  let world_h = inverse_view_projection * vec4<f32>(ndc, 1.0);
  if (!(abs(world_h.w) > 1.0e-8)) {
    return RefractionWorldPoint(vec3<f32>(0.0), 0.0);
  }
  let world_position = world_h.xyz / world_h.w;
  let finite = all(world_position == world_position)
    && all(abs(world_position) < vec3<f32>(1.0e20));
  return RefractionWorldPoint(
    world_position,
    select(0.0, 1.0, finite)
  );
}

fn refraction_surface_pixel(
  fragment_position_px: vec2<f32>,
  target_dimensions: vec2<u32>
) -> RefractionSurfacePixel {
  let finite = all(fragment_position_px == fragment_position_px)
    && all(abs(fragment_position_px) < vec2<f32>(1.0e20));
  if (!finite || target_dimensions.x <= 1u || target_dimensions.y <= 1u) {
    return RefractionSurfacePixel(vec2<u32>(0u), vec2<f32>(0.0), 0.0);
  }
  let floored = floor(fragment_position_px);
  let dimensions_f = vec2<f32>(target_dimensions);
  if (any(floored < vec2<f32>(0.0)) || any(floored >= dimensions_f)) {
    return RefractionSurfacePixel(vec2<u32>(0u), vec2<f32>(0.0), 0.0);
  }
  let pixel = vec2<u32>(floored);
  return RefractionSurfacePixel(
    pixel,
    (vec2<f32>(pixel) + vec2<f32>(0.5)) / dimensions_f,
    1.0
  );
}

fn refraction_rear_surface_admitted(
  front_depth: f32,
  back_depth: f32,
  entry_world: vec3<f32>,
  back_world: vec3<f32>,
  outward_normal: vec3<f32>,
  view_direction_to_camera: vec3<f32>,
  max_path_m: f32
) -> f32 {
  let scalar_inputs_finite = front_depth == front_depth
    && back_depth == back_depth
    && max_path_m == max_path_m
    && abs(front_depth) < 1.0e20
    && abs(back_depth) < 1.0e20
    && abs(max_path_m) < 1.0e20;
  let vector_inputs_finite = all(entry_world == entry_world)
    && all(back_world == back_world)
    && all(outward_normal == outward_normal)
    && all(view_direction_to_camera == view_direction_to_camera)
    && all(abs(entry_world) < vec3<f32>(1.0e20))
    && all(abs(back_world) < vec3<f32>(1.0e20))
    && all(abs(outward_normal) < vec3<f32>(1.0e20))
    && all(abs(view_direction_to_camera) < vec3<f32>(1.0e20));
  if (!scalar_inputs_finite || !vector_inputs_finite) {
    return 0.0;
  }
  if (!(front_depth >= 0.0 && front_depth <= 1.0
    && back_depth >= 0.0 && back_depth < 0.999999
    && back_depth > front_depth + 1.0e-5
    && max_path_m > 1.0e-6)) {
    return 0.0;
  }
  let normal_length_squared = dot(outward_normal, outward_normal);
  let view_length_squared = dot(view_direction_to_camera, view_direction_to_camera);
  if (!(normal_length_squared > 1.0e-8 && view_length_squared > 1.0e-8)) {
    return 0.0;
  }
  let normal = outward_normal / sqrt(normal_length_squared);
  let view_direction = view_direction_to_camera / sqrt(view_length_squared);
  if (!(dot(normal, view_direction) > 1.0e-5)) {
    return 0.0;
  }
  let to_back = back_world - entry_world;
  let rear_distance_m = length(to_back);
  let behind_entry = dot(to_back, -view_direction) > 1.0e-6;
  return select(
    0.0,
    1.0,
    rear_distance_m > 1.0e-6 && rear_distance_m <= max_path_m && behind_entry
  );
}

fn refracted_path_to_back_plane(
  entry_world: vec3<f32>,
  back_world: vec3<f32>,
  rear_surface_valid: f32,
  internal_direction: vec3<f32>,
  view_projection: mat4x4<f32>,
  max_path_m: f32
) -> RefractedPath {
  if (!(rear_surface_valid > 0.5)) {
    return invalid_refracted_path();
  }
  let thickness_axis = back_world - entry_world;
  let view_thickness_m = length(thickness_axis);
  if (!(view_thickness_m > 1.0e-6 && max_path_m > 1.0e-6)) {
    return invalid_refracted_path();
  }
  let axis = thickness_axis / view_thickness_m;
  let direction_length_squared = dot(internal_direction, internal_direction);
  if (!(direction_length_squared > 1.0e-8)) {
    return invalid_refracted_path();
  }
  let direction = internal_direction / sqrt(direction_length_squared);
  let axial_rate = dot(direction, axis);
  if (!(axial_rate > 1.0e-4)) {
    return invalid_refracted_path();
  }
  let path_m = view_thickness_m / axial_rate;
  if (!(path_m > 0.0 && path_m <= max_path_m)) {
    return invalid_refracted_path();
  }
  let exit_world = entry_world + direction * path_m;
  let projected = refraction_project_world_to_uv(exit_world, view_projection);
  if (!(projected.valid > 0.5)) {
    return invalid_refracted_path();
  }
  let lateral_displacement_m = length(exit_world - back_world);
  return RefractedPath(
    projected.uv,
    path_m,
    1.0,
    exit_world,
    lateral_displacement_m
  );
}

fn refraction_beer_lambert_transmission_rgb(
  absorption_coefficient_per_m: vec3<f32>,
  path_m: vec3<f32>
) -> vec3<f32> {
  let valid = all(absorption_coefficient_per_m == absorption_coefficient_per_m)
    && all(path_m == path_m)
    && all(absorption_coefficient_per_m >= vec3<f32>(0.0))
    && all(path_m >= vec3<f32>(0.0));
  if (!valid) {
    return vec3<f32>(0.0);
  }
  let optical_depth = min(
    absorption_coefficient_per_m * path_m,
    vec3<f32>(80.0)
  );
  return exp(-optical_depth);
}

fn refraction_beer_lambert_from_extinction_rgb(
  extinction_k: vec3<f32>,
  wavelength_m: vec3<f32>,
  path_m: vec3<f32>
) -> vec3<f32> {
  let valid = all(extinction_k == extinction_k)
    && all(wavelength_m == wavelength_m)
    && all(extinction_k >= vec3<f32>(0.0))
    && all(wavelength_m > vec3<f32>(0.0));
  if (!valid) {
    return vec3<f32>(0.0);
  }
  let absorption_coefficient_per_m = 12.566370614359172
    * extinction_k / wavelength_m;
  return refraction_beer_lambert_transmission_rgb(
    absorption_coefficient_per_m,
    path_m
  );
}
`;
