// Shared production-native surface material shaders. Both page and worker
// renderers consume this module so optics, color encoding, and emission use
// the same generated WGSL without loading scene ownership or UI machinery.
import {
  ULG_NATIVE_REFRACTION_TRANSPORT_WGSL
} from './nativeRefractionTransportWgsl.js';

export const SPH_NATIVE_WEBGPU_BACKGROUND_WGSL = `
struct BackgroundParams {
  cover_scale: vec2<f32>,
  pad0: vec2<f32>,
};

@group(0) @binding(0) var background_image: texture_2d<f32>;
@group(0) @binding(1) var background_sampler: sampler;
@group(0) @binding(2) var<uniform> params: BackgroundParams;

struct BackgroundVertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> BackgroundVertexOutput {
  let positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  let position = positions[vertex_index];
  var output: BackgroundVertexOutput;
  output.position = vec4<f32>(position, 1.0, 1.0);
  output.uv = vec2<f32>(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  return output;
}

fn background_color(input: BackgroundVertexOutput) -> vec4<f32> {
  let uv = (input.uv - vec2<f32>(0.5)) * params.cover_scale + vec2<f32>(0.5);
  return vec4<f32>(textureSample(background_image, background_sampler, uv).rgb, 1.0);
}

@fragment
fn fs_main(input: BackgroundVertexOutput) -> @location(0) vec4<f32> {
  return background_color(input);
}

struct BackgroundMrtOutput {
  @location(0) base: vec4<f32>,
  @location(1) composite: vec4<f32>,
};

@fragment
fn fs_staged_mrt_main(input: BackgroundVertexOutput) -> BackgroundMrtOutput {
  let color = background_color(input);
  var output: BackgroundMrtOutput;
  output.base = color;
  output.composite = color;
  return output;
}
`;

export const SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL = `
struct CameraUniform {
  view_projection: mat4x4<f32>,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
  // The ids are constant per triangle; flat interpolation keeps them exact
  // even for degenerate (zero-area) marching-cubes triangles, whose
  // perspective barycentrics otherwise produce garbage ids that miss the
  // optical table and rasterize single blocked-red pixels.
  @location(1) @interpolate(flat) material_id: f32,
  @location(2) @interpolate(flat) phase_id: f32,
  @location(3) @interpolate(flat) optical_state_id: f32,
  @location(4) world_position: vec3<f32>,
  // Per-vertex field-sampled temperature, interpolated across the triangle so
  // emission varies per fragment (hot core, cooler rim). 0 = no field sample;
  // the emissive fn falls back to the per-surface uniform temperature.
  @location(5) emissive_temperature_k: f32,
};

// View direction for shading. The compact-position variant replaces this with
// the real camera-relative direction; the legacy vertex-row variant keeps a
// fixed plausible direction (its camera uniform is only a matrix).
fn resident_view_direction(world_position: vec3<f32>) -> vec3<f32> {
  return normalize(vec3<f32>(0.15, 0.25, 1.0));
}

// The compact production variant replaces this with the draw batch's admitted
// transparency class. Legacy vertex-row draws can only refract exact records.
fn refractive_draw_admitted() -> bool {
  return true;
}

// Legacy vertex-row draws retain the historical lighting exactly. The compact
// production variant replaces these helpers with its live scene-lighting
// uniform values without growing the retained camera ABI.
fn resident_ambient_irradiance() -> f32 {
  return 1.4;
}

fn resident_direct_light_scale() -> f32 {
  return 1.0;
}

fn resident_environment_light_scale() -> f32 {
  return 1.0;
}

// Thermal emission for hot materials. The compact variant supplies the
// surface's closure-derived emission temperature; the legacy variant has no
// temperature input and stays dark.
fn resident_surface_emissive(emissive_temperature_k: f32) -> vec3<f32> {
  return vec3<f32>(0.0);
}

// Piecewise-linear samples of the runtime radiation closure's
// Planck -> CIE 1931 -> sRGB chromaticity, decoded back to linear RGB for the
// renderer. The closure is valid from 800K through 6000K; hotter inputs retain
// its 6000K near-white chromaticity while radiance continues to follow T^4.
fn blackbody_chromaticity_linear_rgb(temperature_k: f32) -> vec3<f32> {
  let c800 = vec3<f32>(1.0, 0.0, 0.0);
  let c1300 = vec3<f32>(1.0, 0.096791621, 0.0);
  let c1850 = vec3<f32>(1.0, 0.230484590, 0.0);
  let c2200 = vec3<f32>(1.0, 0.313068766, 0.028089405);
  let c3000 = vec3<f32>(1.0, 0.484022759, 0.154496753);
  let c5500 = vec3<f32>(1.0, 0.851543201, 0.754730788);
  let c6000 = vec3<f32>(1.0, 0.900902375, 0.876112819);

  if (temperature_k <= 1300.0) {
    return mix(c800, c1300, clamp((temperature_k - 800.0) / 500.0, 0.0, 1.0));
  }
  if (temperature_k <= 1850.0) {
    return mix(c1300, c1850, (temperature_k - 1300.0) / 550.0);
  }
  if (temperature_k <= 2200.0) {
    return mix(c1850, c2200, (temperature_k - 1850.0) / 350.0);
  }
  if (temperature_k <= 3000.0) {
    return mix(c2200, c3000, (temperature_k - 2200.0) / 800.0);
  }
  if (temperature_k <= 5500.0) {
    return mix(c3000, c5500, (temperature_k - 3000.0) / 2500.0);
  }
  return mix(c5500, c6000, clamp((temperature_k - 5500.0) / 500.0, 0.0, 1.0));
}

fn blackbody_emission_rgb(temperature_k: f32) -> vec3<f32> {
  // Visible glow starts ~800K (Draper point).
  let t = clamp((temperature_k - 800.0) / 1400.0, 0.0, 1.4);
  if (t <= 0.0) {
    return vec3<f32>(0.0);
  }
  let color = blackbody_chromaticity_linear_rgb(temperature_k);
  // Sphere-lane parity: the particle bridge drives emissive at intensity
  // ~1.8x its material color; the previous t^2+0.15 scale left molten metal
  // surfaces reading matte next to their glowing sphere twins.
  //
  // Above the ramp's saturation anchor (t=1.0, 2200K) radiance follows
  // Stefan-Boltzmann T^4 relative to the anchor instead of clamping: the old
  // min(..., 2.6) flattened every temperature above ~2760K to one radiance,
  // so a 5000K reaction crown rendered the same orange as a 2200K blob.
  // ACES rolls the T^4 overshoot into white, giving hot cores the white-hot
  // read. Below the anchor the legacy quadratic is unchanged (molten-metal
  // range keeps its calibrated sphere-lane parity). Cap keeps accumulation
  // sane; ACES output stays bounded regardless.
  let quad_scale = min(1.9 * t * t + 0.2, 2.6);
  let rel = temperature_k / 2200.0;
  let stefan_scale = min(2.1 * rel * rel * rel * rel, 60.0);
  return color * select(quad_scale, stefan_scale, temperature_k > 2200.0);
}

@group(0) @binding(0) var<storage, read> surface_vertices: array<vec4<f32>>;
@group(0) @binding(1) var<uniform> camera_data: CameraUniform;
@group(0) @binding(2) var<storage, read> optical_records: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> spectral_samples: array<vec4<f32>>;

// Scene-color copy for screen-space refraction through transmissive
// dielectrics (water/ice). The copy is taken from the canvas after the opaque
// pass (background + opaque surfaces + box wireframe), so the transmitted
// term samples what is actually behind the surface instead of an analytic
// environment. A 1x1 dummy texture disables the path (textureDimensions
// gate) for the opaque pass, the legacy vertex-row lane, and non-native
// bridges whose canvas is not configured with COPY_SRC.
@group(1) @binding(0) var scene_color_copy: texture_2d<f32>;
@group(1) @binding(1) var scene_color_sampler: sampler;

// Prefiltered environment from the scene background image (latlong layout,
// mip chain indexed by roughness). A 1x1 dummy keeps the analytic hemisphere
// fallback when no background image is active.
@group(1) @binding(2) var env_map: texture_2d<f32>;
@group(1) @binding(3) var env_sampler: sampler;
// Native compact surfaces bind a full-resolution depth32float texture written
// by a front-culled backface pass. Legacy paths bind a 1x1 dummy and therefore
// fail closed to reflective/opaque PBR without ray bending.
@group(1) @binding(4) var refractive_back_depth: texture_depth_2d;
// Opaque scene depth copied after the opaque pass so screen-space refraction
// rejects foreground occluders (opaque_depth < in.position.z - eps) and only
// refracts objects inside or behind the dielectric surface. A 1x1 dummy skips
// depth filtering when unavailable.
@group(1) @binding(5) var opaque_scene_depth: texture_depth_2d;

struct RefractiveBackfaceGeometry {
  world_position: vec3<f32>,
  valid: f32,
};

fn resident_refractive_backface(in: VertexOut) -> RefractiveBackfaceGeometry {
  return RefractiveBackfaceGeometry(vec3<f32>(0.0), 0.0);
}

fn resident_refraction_max_path_m() -> f32 {
  return 0.0;
}

fn resident_refraction_inverse_view_projection() -> mat4x4<f32> {
  return mat4x4<f32>(
    vec4<f32>(1.0, 0.0, 0.0, 0.0),
    vec4<f32>(0.0, 1.0, 0.0, 0.0),
    vec4<f32>(0.0, 0.0, 1.0, 0.0),
    vec4<f32>(0.0, 0.0, 0.0, 1.0)
  );
}

${ULG_NATIVE_REFRACTION_TRANSPORT_WGSL}

fn env_latlong_sample(dir: vec3<f32>, roughness: f32) -> vec3<f32> {
  var d = dir;
  let len2 = dot(d, d);
  if (len2 <= 1.0e-8) {
    d = vec3<f32>(0.0, 1.0, 0.0);
  } else {
    d = d / sqrt(len2);
  }
  let u = atan2(d.z, d.x) * 0.15915494 + 0.5;
  let v = acos(clamp(d.y, -1.0, 1.0)) * 0.31830989;
  let mip_count = f32(textureNumLevels(env_map));
  let lod = clamp(roughness, 0.0, 1.0) * max(mip_count - 1.0, 0.0);
  let sampled = textureSampleLevel(env_map, env_sampler, vec2<f32>(u, v), lod).rgb;
  // The background image is display-encoded; shading runs in linear light.
  return pow(clamp(sampled, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(2.2));
}

fn sample_refracted_scene_color_at_uv(
  sample_uv: vec2<f32>,
  surface_front_depth: f32,
  depth_dims: vec2<u32>,
  color_dims: vec2<u32>
) -> vec4<f32> {
  let inv_vp = resident_refraction_inverse_view_projection();
  let fp = refraction_bilinear_footprint(sample_uv, depth_dims);
  let front_lin = refraction_linear_eye_depth(surface_front_depth, inv_vp);
  let depths = vec4<f32>(
    refraction_linear_eye_depth(textureLoad(opaque_scene_depth, fp.p00, 0), inv_vp),
    refraction_linear_eye_depth(textureLoad(opaque_scene_depth, fp.p10, 0), inv_vp),
    refraction_linear_eye_depth(textureLoad(opaque_scene_depth, fp.p01, 0), inv_vp),
    refraction_linear_eye_depth(textureLoad(opaque_scene_depth, fp.p11, 0), inv_vp)
  );
  let lin_eps = select(
    1.0e-4,
    max(front_lin * 5.0e-4, 1.0e-4),
    abs(inv_vp[2].w) > 1.0e-7
  );
  let w = refraction_depth_filtered_weights(fp.weights, depths, front_lin, lin_eps);
  let w_sum = w.x + w.y + w.z + w.w;
  if (w_sum >= 0.999) {
    let c = textureSampleLevel(scene_color_copy, scene_color_sampler, sample_uv, 0.0).rgb;
    return vec4<f32>(c, 1.0);
  }
  if (w_sum > 1.0e-4) {
    let c_max = max(vec2<i32>(color_dims), vec2<i32>(1)) - vec2<i32>(1);
    let c00 = textureLoad(scene_color_copy, clamp(fp.p00, vec2<i32>(0), c_max), 0).rgb;
    let c10 = textureLoad(scene_color_copy, clamp(fp.p10, vec2<i32>(0), c_max), 0).rgb;
    let c01 = textureLoad(scene_color_copy, clamp(fp.p01, vec2<i32>(0), c_max), 0).rgb;
    let c11 = textureLoad(scene_color_copy, clamp(fp.p11, vec2<i32>(0), c_max), 0).rgb;
    return vec4<f32>((c00 * w.x + c10 * w.y + c01 * w.z + c11 * w.w) / w_sum, 1.0);
  }
  return vec4<f32>(0.0, 0.0, 0.0, 0.0);
}

fn sample_refracted_scene_color_depth_rejected(
  exit_uv: vec2<f32>,
  surface_uv: vec2<f32>,
  surface_front_depth: f32,
  fallback_display: vec3<f32>
) -> vec3<f32> {
  let depth_dims = textureDimensions(opaque_scene_depth);
  let color_dims = textureDimensions(scene_color_copy, 0);
  if (depth_dims.x <= 1u || depth_dims.y <= 1u || color_dims.x <= 1u || color_dims.y <= 1u) {
    return textureSampleLevel(scene_color_copy, scene_color_sampler, exit_uv, 0.0).rgb;
  }
  let primary = sample_refracted_scene_color_at_uv(exit_uv, surface_front_depth, depth_dims, color_dims);
  if (primary.w > 0.5) {
    return primary.rgb;
  }
  let mid_uv = mix(surface_uv, exit_uv, 0.5);
  let mid_sample = sample_refracted_scene_color_at_uv(mid_uv, surface_front_depth, depth_dims, color_dims);
  if (mid_sample.w > 0.5) {
    return mid_sample.rgb;
  }
  let direct_sample = sample_refracted_scene_color_at_uv(surface_uv, surface_front_depth, depth_dims, color_dims);
  if (direct_sample.w > 0.5) {
    return direct_sample.rgb;
  }
  return fallback_display;
}

struct OpticalMaterial {
  base_color_linear: vec3<f32>,
  metalness: f32,
  roughness: f32,
  transmission: f32,
  opacity: f32,
  ior: f32,
  attenuation_linear: vec3<f32>,
  attenuation_distance_m: f32,
  absorption_coefficient_per_m: f32,
  scattering_coefficient_per_m: f32,
  optical_depth: f32,
  spectral_tint_linear: vec3<f32>,
  spectral_offset: f32,
  spectral_count: f32,
  status: f32,
  blocked: f32,
  found: f32,
};

fn id_equal(a: f32, b: f32) -> bool {
  return abs(round(a) - round(b)) < 0.5;
}

fn optical_record_count() -> u32 {
  return arrayLength(&optical_records) / 6u;
}

fn optical_record_row(record_index: u32, row_index: u32) -> vec4<f32> {
  return optical_records[record_index * 6u + row_index];
}

fn spectral_sample_count() -> u32 {
  return arrayLength(&spectral_samples) / 2u;
}

fn spectral_sample_row(sample_index: u32, row_index: u32) -> vec4<f32> {
  return spectral_samples[sample_index * 2u + row_index];
}

fn spectral_wavelength_rgb(wavelength_nm: f32) -> vec3<f32> {
  let w = clamp(wavelength_nm, 380.0, 780.0);
  var rgb = vec3<f32>(0.0);
  if (w < 440.0) {
    rgb = vec3<f32>(-(w - 440.0) / 60.0, 0.0, 1.0);
  } else if (w < 490.0) {
    rgb = vec3<f32>(0.0, (w - 440.0) / 50.0, 1.0);
  } else if (w < 510.0) {
    rgb = vec3<f32>(0.0, 1.0, -(w - 510.0) / 20.0);
  } else if (w < 580.0) {
    rgb = vec3<f32>((w - 510.0) / 70.0, 1.0, 0.0);
  } else if (w < 645.0) {
    rgb = vec3<f32>(1.0, -(w - 645.0) / 65.0, 0.0);
  } else {
    rgb = vec3<f32>(1.0, 0.0, 0.0);
  }
  let edge = select(
    select(1.0, 0.3 + 0.7 * (w - 380.0) / 40.0, w < 420.0),
    0.3 + 0.7 * (780.0 - w) / 80.0,
    w > 700.0
  );
  return pow(clamp(rgb * edge, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(2.2));
}

fn spectral_tint_from_samples(spectral_offset: f32, spectral_count_value: f32, transmission: f32) -> vec3<f32> {
  let total_samples = spectral_sample_count();
  let start = u32(max(0.0, round(spectral_offset)));
  let count = min(u32(max(0.0, round(spectral_count_value))), 32u);
  if (count == 0u || start >= total_samples) {
    return vec3<f32>(1.0);
  }
  var weighted = vec3<f32>(0.0);
  var weight_sum = 0.0;
  for (var local = 0u; local < 32u; local = local + 1u) {
    if (local >= count) {
      break;
    }
    let sample_index = start + local;
    if (sample_index >= total_samples) {
      break;
    }
    let row0 = spectral_sample_row(sample_index, 0u);
    let wavelength_rgb = spectral_wavelength_rgb(row0.x);
    let reflectance = clamp(row0.y, 0.0, 1.0);
    let transmittance = clamp(row0.z, 0.0, 1.0);
    let response = mix(reflectance, transmittance, clamp(transmission, 0.0, 1.0));
    weighted = weighted + wavelength_rgb * response;
    weight_sum = weight_sum + max(response, 0.0001);
  }
  if (!(weight_sum > 0.0)) {
    return vec3<f32>(1.0);
  }
  let tint = weighted / weight_sum;
  let max_channel = max(max(tint.r, tint.g), tint.b);
  return clamp(tint / max(max_channel, 0.0001), vec3<f32>(0.0), vec3<f32>(1.0));
}

struct SpectralComplexIndex {
  n_rgb: vec3<f32>,
  k_rgb: vec3<f32>,
  valid: f32,
};

fn spectral_complex_index_rgb(spectral_offset: f32, spectral_count_value: f32) -> SpectralComplexIndex {
  let total_samples = spectral_sample_count();
  let start = u32(max(0.0, round(spectral_offset)));
  let count = min(u32(max(0.0, round(spectral_count_value))), 32u);
  var n_rgb = vec3<f32>(1.0);
  var k_rgb = vec3<f32>(0.0);
  var found = vec3<f32>(0.0);
  var best_distance = vec3<f32>(1.0e9);
  for (var local = 0u; local < 32u; local = local + 1u) {
    if (local >= count) { break; }
    let sample_index = start + local;
    if (sample_index >= total_samples) { break; }
    let row0 = spectral_sample_row(sample_index, 0u);
    let row1 = spectral_sample_row(sample_index, 1u);
    let wavelength_nm = row0.x;
    let n = row1.y;
    let k = row1.z;
    if (!(wavelength_nm >= 380.0 && wavelength_nm <= 780.0 && n >= 1.0 && n < 10.0 && k >= 0.0 && k < 1.0e6)) {
      continue;
    }
    let red_distance = abs(wavelength_nm - 630.0);
    if (wavelength_nm >= 600.0 && red_distance < best_distance.r) {
      best_distance.r = red_distance;
      n_rgb.r = n;
      k_rgb.r = k;
      found.r = 1.0;
    }
    let green_distance = abs(wavelength_nm - 530.0);
    if (wavelength_nm >= 500.0 && wavelength_nm < 600.0 && green_distance < best_distance.g) {
      best_distance.g = green_distance;
      n_rgb.g = n;
      k_rgb.g = k;
      found.g = 1.0;
    }
    let blue_distance = abs(wavelength_nm - 480.0);
    if (wavelength_nm < 500.0 && blue_distance < best_distance.b) {
      best_distance.b = blue_distance;
      n_rgb.b = n;
      k_rgb.b = k;
      found.b = 1.0;
    }
  }
  let valid = select(0.0, 1.0, all(found > vec3<f32>(0.5)));
  return SpectralComplexIndex(n_rgb, k_rgb, valid);
}

fn complex_normal_fresnel_rgb(n_rgb: vec3<f32>, k_rgb: vec3<f32>) -> vec3<f32> {
  let numerator = (n_rgb - vec3<f32>(1.0)) * (n_rgb - vec3<f32>(1.0)) + k_rgb * k_rgb;
  let denominator = (n_rgb + vec3<f32>(1.0)) * (n_rgb + vec3<f32>(1.0)) + k_rgb * k_rgb;
  return clamp(numerator / max(denominator, vec3<f32>(1.0e-8)), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn fallback_optical_material(phase_id: f32) -> OpticalMaterial {
  var color = vec3<f32>(0.72, 0.9, 1.0);
  if (phase_id < 1.5) {
    color = vec3<f32>(0.88, 0.88, 0.82);
  } else if (phase_id < 2.5) {
    color = vec3<f32>(0.28, 0.7, 1.0);
  } else if (phase_id < 3.5) {
    color = vec3<f32>(0.86, 0.96, 1.0);
  }
  return OpticalMaterial(color, 0.0, 0.65, 0.0, 1.0, 1.0, vec3<f32>(1.0), 1.0e20, 0.0, 0.0, 0.0, vec3<f32>(1.0), 0.0, 0.0, 0.0, 1.0, 0.0);
}

fn find_optical_material(material_id: f32, phase_id: f32, optical_state_id: f32) -> OpticalMaterial {
  let count = optical_record_count();
  var fallback_index: i32 = -1;
  for (var record_index = 0u; record_index < count; record_index = record_index + 1u) {
    let row0 = optical_record_row(record_index, 0u);
    let row5 = optical_record_row(record_index, 5u);
    if (id_equal(row0.x, material_id) && id_equal(row0.y, phase_id)) {
      if (id_equal(row5.w, optical_state_id)) {
        let row1 = optical_record_row(record_index, 1u);
        let row2 = optical_record_row(record_index, 2u);
        let row3 = optical_record_row(record_index, 3u);
        let row4 = optical_record_row(record_index, 4u);
        let spectral_tint = spectral_tint_from_samples(row0.z, row0.w, row2.y);
        let spectral_tint_weight = 0.35 * (1.0 - clamp(row1.w, 0.0, 1.0));
        return OpticalMaterial(
          clamp(mix(row1.xyz, row1.xyz * spectral_tint, spectral_tint_weight), vec3<f32>(0.0), vec3<f32>(1.0)),
          clamp(row1.w, 0.0, 1.0),
          clamp(row2.x, 0.04, 1.0),
          clamp(row2.y, 0.0, 1.0),
          clamp(row2.z, 0.0, 1.0),
          max(row2.w, 1.0),
          clamp(row3.xyz, vec3<f32>(0.0), vec3<f32>(1.0)),
          max(row3.w, 0.00001),
          max(row4.x, 0.0),
          max(row4.y, 0.0),
          max(row5.x, 0.0),
          spectral_tint,
          row0.z,
          row0.w,
          row5.z,
          row5.y,
          1.0
        );
      }
      // State-zero fallback is valid only for an ordinary state-zero query.
      // Positive ids are reserved for canonical collective routes; falling
      // those back to bulk condensed optics would grant opacity to a missing
      // or mismatched route instead of failing closed.
      if (id_equal(optical_state_id, 0.0) && id_equal(row5.w, 0.0) && fallback_index < 0) {
        fallback_index = i32(record_index);
      }
    }
  }
  if (fallback_index >= 0) {
    let index = u32(fallback_index);
    let row0 = optical_record_row(index, 0u);
    let row1 = optical_record_row(index, 1u);
    let row2 = optical_record_row(index, 2u);
    let row3 = optical_record_row(index, 3u);
    let row4 = optical_record_row(index, 4u);
    let row5 = optical_record_row(index, 5u);
    let spectral_tint = spectral_tint_from_samples(row0.z, row0.w, row2.y);
    let spectral_tint_weight = 0.35 * (1.0 - clamp(row1.w, 0.0, 1.0));
    return OpticalMaterial(
      clamp(mix(row1.xyz, row1.xyz * spectral_tint, spectral_tint_weight), vec3<f32>(0.0), vec3<f32>(1.0)),
      clamp(row1.w, 0.0, 1.0),
      clamp(row2.x, 0.04, 1.0),
      0.0,
      1.0,
      1.0,
      clamp(row3.xyz, vec3<f32>(0.0), vec3<f32>(1.0)),
      max(row3.w, 0.00001),
      max(row4.x, 0.0),
      max(row4.y, 0.0),
      max(row5.x, 0.0),
      spectral_tint,
      0.0,
      0.0,
      1.0,
      row5.y,
      0.0
    );
  }
  return fallback_optical_material(phase_id);
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOut {
  let base = vertex_index * 4u;
  let row0 = surface_vertices[base];
  let row1 = surface_vertices[base + 1u];
  let row2 = surface_vertices[base + 2u];
  let position_m = vec3<f32>(row1.y, row1.z, row1.w);
  var out: VertexOut;
  var clip = camera_data.view_projection * vec4<f32>(position_m, 1.0);
  clip.z = clip.z * 0.5 + clip.w * 0.5;
  if (clip.w <= 0.0) {
    clip = vec4<f32>(2.0, 2.0, 1.0, 1.0);
  }
  out.position = clip;
  out.world_position = position_m;
  out.normal = normalize(row2.xyz + vec3<f32>(0.0001, 0.0002, 0.0003));
  out.material_id = row0.y;
  out.phase_id = row0.z;
  out.optical_state_id = row2.w;
  out.emissive_temperature_k = 0.0;
  return out;
}

fn resident_surface_color(in: VertexOut) -> vec4<f32> {
  let optical = find_optical_material(in.material_id, in.phase_id, in.optical_state_id);
  let blocked = optical.blocked > 0.5 || optical.status == 255.0;
  let optical_depth = clamp(optical.optical_depth, 0.0, 16.0);
  let absorption_depth = clamp(optical.absorption_coefficient_per_m * min(optical.attenuation_distance_m, 1.0), 0.0, 16.0);
  let attenuation_weight = clamp(1.0 - exp(-max(optical_depth, absorption_depth)), 0.0, 1.0);
  let attenuated_base = mix(
    optical.base_color_linear,
    optical.base_color_linear * optical.attenuation_linear,
    attenuation_weight
  );
  let base_color = select(attenuated_base, vec3<f32>(0.55, 0.05, 0.18), blocked);
  let normal = normalize(in.normal);
  let view_dir = resident_view_direction(in.world_position);
  // Positive optical-state ids are reserved for canonical collective routes.
  // Those routes retain the condensed phase for material identity but are
  // participating media, not polished condensed-material boundaries.
  let is_vapor = round(in.phase_id) == 3.0 || in.optical_state_id > 0.5;
  let roughness = clamp(optical.roughness, 0.04, 1.0);
  let metalness = clamp(optical.metalness, 0.0, 1.0);
  // Recovery retains the closure-admitted material IOR (water = 1.333).
  // The refactor-only molecular index is explicitly unvalidated and is not
  // granted rendering authority by this bounded port.
  let refractive_index = max(optical.ior, 1.0);
  let refractive_authority = optical.found > 0.5
    && optical.blocked < 0.5
    && abs(optical.status - 255.0) > 0.5
    && !is_vapor
    && refractive_index > 1.000001
    && refractive_draw_admitted();
  let dielectric_f0_scalar = pow(
    (refractive_index - 1.0) / (refractive_index + 1.0),
    2.0
  );
  let dielectric_f0 = select(vec3<f32>(0.04), vec3<f32>(dielectric_f0_scalar), refractive_authority);
  let spec_nk = spectral_complex_index_rgb(optical.spectral_offset, optical.spectral_count);
  let conductor_f0 = select(base_color, complex_normal_fresnel_rgb(spec_nk.n_rgb, spec_nk.k_rgb), spec_nk.valid > 0.5);
  let f0 = mix(dielectric_f0, conductor_f0, metalness);
  let ndotv = clamp(dot(normal, view_dir), 0.0, 1.0);
  // Sphere-lane PBR parity: the particle bridge renders through Three's
  // MeshPhysicalMaterial (GGX microfacet BRDF, energy-conserving Lambert)
  // under the scene's exact light set - ambient 1.4, hemisphere
  // (0xddffff/0x202a30) 0.9, key directional white 1.1 from (4,8,6), fill
  // 0xbfe9ff 0.5 from (-6,3,-4) - with a RoomEnvironment IBL. This shader
  // mirrors that: same lights, GGX + Smith + Schlick, split-sum environment
  // approximation, then the same ACESFilmic(exposure 1.08) tone pipeline.
  let backface = resident_refractive_backface(in);
  let refraction_max_path_m = resident_refraction_max_path_m();
  let refracted_path = refracted_path_to_back_plane(
    in.world_position,
    backface.world_position,
    backface.valid,
    refract(-view_dir, normal, 1.0 / refractive_index),
    camera_data.view_projection,
    refraction_max_path_m
  );
  let scene_color_available = textureDimensions(scene_color_copy, 0).x > 1u;
  let refracted_geometry_valid = refracted_path.valid > 0.5;
  let transmissive_surface = optical.transmission > 0.01
    && metalness < 0.1
    && !is_vapor
    && refractive_authority
    && refracted_geometry_valid
    && scene_color_available;
  // Three's MeshPhysicalMaterial transmission model: transmitted light
  // REPLACES diffuse reflection (energy conservation) - a clear medium has
  // almost no diffuse term. Adding full diffuse on top of transmission was
  // why surface water read as a bright milky blob while the sphere lane
  // rendered dark glass over the dark scene.
  let diffuse_weight = select(1.0, 1.0 - clamp(optical.transmission, 0.0, 1.0), transmissive_surface);
  let albedo = base_color * (1.0 - metalness) * diffuse_weight;
  let alpha_r = roughness * roughness;
  // Scene lights (linear-light colors x intensity, /pi folded into Lambert).
  let ambient_irradiance_value = max(resident_ambient_irradiance(), 0.0);
  let direct_light_scale = max(resident_direct_light_scale(), 0.0);
  let environment_light_scale = max(resident_environment_light_scale(), 0.0);
  let ambient_irradiance = vec3<f32>(ambient_irradiance_value);
  let hemi_sky = vec3<f32>(0.733, 1.0, 1.0);
  let hemi_ground = vec3<f32>(0.0144, 0.0241, 0.0306);
  let hemi_irradiance = mix(hemi_ground, hemi_sky, clamp(normal.y * 0.5 + 0.5, 0.0, 1.0))
    * 0.9 * direct_light_scale;
  let key_dir = normalize(vec3<f32>(4.0, 8.0, 6.0));
  let key_radiance = vec3<f32>(1.1) * direct_light_scale;
  let fill_dir = normalize(vec3<f32>(-6.0, 3.0, -4.0));
  let fill_radiance = vec3<f32>(0.518, 0.815, 1.0) * 0.5 * direct_light_scale;
  let inv_pi = 0.3183098862;
  let key_ndotl = clamp(dot(normal, key_dir), 0.0, 1.0);
  let fill_ndotl = clamp(dot(normal, fill_dir), 0.0, 1.0);
  let diffuse = albedo * inv_pi
    * (ambient_irradiance + hemi_irradiance + key_radiance * key_ndotl + fill_radiance * fill_ndotl);
  // GGX specular per directional light (D * V_SmithCorrelated * F_Schlick).
  var specular = vec3<f32>(0.0);
  {
    let a2 = alpha_r * alpha_r;
    let dirs = array<vec3<f32>, 2>(key_dir, fill_dir);
    let radiances = array<vec3<f32>, 2>(key_radiance, fill_radiance);
    for (var li = 0u; li < 2u; li = li + 1u) {
      let l = dirs[li];
      let ndotl = clamp(dot(normal, l), 0.0, 1.0);
      if (ndotl <= 0.0) { continue; }
      let h = normalize(l + view_dir);
      let ndoth = clamp(dot(normal, h), 0.0, 1.0);
      let vdoth = clamp(dot(view_dir, h), 0.0, 1.0);
      let d_denom = ndoth * ndoth * (a2 - 1.0) + 1.0;
      let d_ggx = a2 / max(3.14159265 * d_denom * d_denom, 1.0e-6);
      let v_smith = 0.5 / max(
        ndotl * (ndotv * (1.0 - alpha_r) + alpha_r) + ndotv * (ndotl * (1.0 - alpha_r) + alpha_r),
        1.0e-6
      );
      let f_schlick = f0 + (vec3<f32>(1.0) - f0) * pow(1.0 - vdoth, 5.0);
      specular = specular + radiances[li] * ndotl * d_ggx * v_smith * f_schlick;
    }
  }
  // Environment (RoomEnvironment stand-in): bright interior gradient sampled
  // by the split-sum approximation (Karis analytic env BRDF), so metals
  // reflect the room across the whole surface exactly like the sphere lane.
  var env_color = mix(vec3<f32>(0.23, 0.26, 0.30), vec3<f32>(0.85, 0.92, 1.0),
    clamp(normal.y * 0.5 + 0.5, 0.0, 1.0));
  if (textureDimensions(env_map, 0).x > 1u) {
    env_color = env_latlong_sample(reflect(-view_dir, normal), roughness);
  }
  let env_r = vec4<f32>(-1.0, -0.0275, -0.572, 0.022) * roughness
    + vec4<f32>(1.0, 0.0425, 1.04, -0.04);
  let env_a004 = min(env_r.x * env_r.x, exp2(-9.28 * ndotv)) * env_r.x + env_r.y;
  let env_ab = vec2<f32>(-1.04, 1.04) * env_a004 + env_r.zw;
  let env_specular = env_color * (f0 * env_ab.x + vec3<f32>(env_ab.y))
    * environment_light_scale;
  let scatter_haze = clamp(log2(1.0 + optical.scattering_coefficient_per_m) * 0.018, 0.0, 0.35);
  let rim = pow(1.0 - ndotv, 3.0) * scatter_haze;
  let ambient_visibility_scale = clamp(ambient_irradiance_value / 1.4, 0.0, 1.0);
  let emissive = resident_surface_emissive(in.emissive_temperature_k);
  // Keep physically derived thermal emission independent of the laboratory
  // illumination controls. Dark-lab mode removes incident light, not glow.
  var lit = diffuse + specular + env_specular
    + base_color * rim * ambient_visibility_scale
    + emissive;
  if (is_vapor && !blocked) {
    // This proxy is the boundary of an integrated extinction field, not a
    // material interface. Use an isotropic single-scattering source under the
    // admitted scene lights; normal-dependent GGX highlights would turn a
    // cloud into polished droplets even though no such boundary exists.
    let isotropic_phase = 0.07957747155; // 1 / (4 pi)
    let hemi_mean_radiance = 0.5 * (hemi_sky + hemi_ground)
      * 0.9 * direct_light_scale;
    let incident_radiance = ambient_irradiance
      + hemi_mean_radiance
      + key_radiance
      + fill_radiance;
    lit = base_color * incident_radiance * isotropic_phase + emissive;
  }
  // PBR transmission (MeshPhysicalMaterial model): transmissive dielectrics
  // render near-OPAQUE - transparency lives in the transmitted light, not in
  // alpha blending. Transmitted term = environment through the volume,
  // Beer-Lambert attenuated by the material's own absorption over its
  // attenuation distance, weighted by (1 - Fresnel) x transmission. The old
  // path drew water as a ghost alpha film (alpha = 1 - 0.72 x transmission).
  if (transmissive_surface) {
    let fresnel_rgb = clamp(
      f0 + (vec3<f32>(1.0) - f0) * pow(1.0 - ndotv, 5.0),
      vec3<f32>(0.0),
      vec3<f32>(1.0)
    );
    let path_m_rgb = vec3<f32>(refracted_path.path_m);
    let attenuation_sigma_rgb = -log(clamp(
      optical.attenuation_linear,
      vec3<f32>(1.0e-6),
      vec3<f32>(1.0)
    )) / max(optical.attenuation_distance_m, 1.0e-6);
    let transmitted_tint = refraction_beer_lambert_transmission_rgb(
      attenuation_sigma_rgb,
      path_m_rgb
    );
    let surface_px = refraction_surface_pixel(in.position.xy, textureDimensions(scene_color_copy, 0));
    let surface_uv = select(refracted_path.exit_uv, surface_px.uv, surface_px.valid > 0.5);
    let env_refract_linear = select(
      env_color,
      env_latlong_sample(refract(-view_dir, normal, 1.0 / refractive_index), roughness),
      textureDimensions(env_map, 0).x > 1u
    );
    let fallback_display = pow(clamp(env_refract_linear, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(1.0 / 2.2));
    let refracted = sample_refracted_scene_color_depth_rejected(
      refracted_path.exit_uv,
      surface_uv,
      in.position.z,
      fallback_display
    );
    // The canvas copy is display-encoded; shading runs in linear light.
    let refracted_linear = pow(clamp(refracted, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(2.2));
    let transmitted = refracted_linear * transmitted_tint;
    lit = lit + (vec3<f32>(1.0) - fresnel_rgb)
      * clamp(optical.transmission, 0.0, 1.0)
      * transmitted;
  }
  // Three tone pipeline: exposure, ACESFilmic, then display encode below.
  lit = lit * 1.08;
  let aces_a = lit * (2.51 * lit + vec3<f32>(0.03));
  let aces_b = lit * (2.43 * lit + vec3<f32>(0.59)) + vec3<f32>(0.14);
  lit = clamp(aces_a / aces_b, vec3<f32>(0.0), vec3<f32>(1.0));
  // Condensed dielectrics remain alpha-one: their transparency comes only
  // from the PBR transmitted-light term above.  Gas is different.  Until the
  // phase-volume integrator owns this pass, its surface proxy represents
  // Beer-Lambert coverage and must be premultiplied/non-depth-writing.  Treat
  // blocked vapor closures as visible diagnostics instead of invisible depth
  // occluders.
  // For a locally convex reconstructed volume, |n.v| is the normalized
  // line-of-sight chord of a spherical patch. Applying Beer-Lambert to that
  // physical path estimate softens the silhouette without inventing an
  // opacity curve or altering the transported optical depth.
  let projected_chord_fraction = clamp(ndotv, 0.0, 1.0);
  let projected_optical_depth = optical_depth * projected_chord_fraction;
  var vapor_alpha = clamp(1.0 - exp(-projected_optical_depth), 0.0, 1.0);
  // Positive optical-state ids are reserved for canonical collective routes.
  // Those routes fail closed when their typed closure is blocked; the legacy
  // red diagnostic remains available only for an ordinary gas surface.
  if (blocked && is_vapor && in.optical_state_id < 0.5) {
    vapor_alpha = 1.0;
  }
  let output_alpha = select(1.0, vapor_alpha, is_vapor);
  // The canvas format is non-sRGB (getPreferredCanvasFormat), so linear-light
  // shading must be display-encoded here or everything reads ~2x too dark.
  let display_lit = pow(clamp(lit, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(1.0 / 2.2));
  return vec4<f32>(display_lit * output_alpha, output_alpha);
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  return resident_surface_color(in);
}

`;

export const SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_CAMERA_UNIFORM_BYTE_LENGTH =
  16 * Float32Array.BYTES_PER_ELEMENT + 192 + 16 * Float32Array.BYTES_PER_ELEMENT;

export const SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL =
  SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL
    .replace(
      `struct CameraUniform {
  view_projection: mat4x4<f32>,
};`,
      `struct CameraUniform {
  view_projection: mat4x4<f32>,
  vertex_count: u32,
  source_stride_floats: u32,
  surface_index: u32,
  triangle_count: u32,
  material_id: f32,
  phase_id: f32,
  optical_state_id: f32,
  density: f32,
  isolation: f32,
  source_voxel_base: f32,
  transparency_class_id: f32,
  depth_write_flag: f32,
  render_order: f32,
  fallback_normal_x: f32,
  fallback_normal_y: f32,
  fallback_normal_z: f32,
  position_scale_m: f32,
  position_origin_x_m: f32,
  position_origin_y_m: f32,
  position_origin_z_m: f32,
  position_grid_bias: f32,
  position_transform_enabled: f32,
  ambient_light_suppression: f32,
  direct_light_suppression: f32,
  position_clamp_min_x_m: f32,
  position_clamp_min_y_m: f32,
  position_clamp_min_z_m: f32,
  position_clamp_max_x_m: f32,
  position_clamp_max_y_m: f32,
  position_clamp_max_z_m: f32,
  position_clamp_enabled: f32,
  environment_light_suppression: f32,
  bounds_center_x_m: f32,
  bounds_center_y_m: f32,
  bounds_center_z_m: f32,
  bounds_radius_m: f32,
  field_dim_x: u32,
  field_dim_y: u32,
  field_dim_z: u32,
  field_stride_x: u32,
  field_stride_y: u32,
  field_stride_z: u32,
  field_offset: u32,
  field_gradient_enabled: f32,
  camera_position_x_m: f32,
  camera_position_y_m: f32,
  camera_position_z_m: f32,
  emissive_temperature_k: f32,
  inverse_view_projection: mat4x4<f32>,
};`
    )
    .replace(
      `fn resident_view_direction(world_position: vec3<f32>) -> vec3<f32> {
  return normalize(vec3<f32>(0.15, 0.25, 1.0));
}`,
      `fn resident_view_direction(world_position: vec3<f32>) -> vec3<f32> {
  let camera_position = vec3<f32>(
    camera_data.camera_position_x_m,
    camera_data.camera_position_y_m,
    camera_data.camera_position_z_m
  );
  let to_camera = camera_position - world_position;
  if (dot(to_camera, to_camera) <= 0.000001) {
    return normalize(vec3<f32>(0.15, 0.25, 1.0));
  }
  return normalize(to_camera);
}`
    )
    .replace(
      `fn refractive_draw_admitted() -> bool {
  return true;
}`,
      `fn refractive_draw_admitted() -> bool {
  return abs(camera_data.transparency_class_id - 2.0) < 0.5;
}`
    )
    .replace(
      `fn resident_ambient_irradiance() -> f32 {
  return 1.4;
}

fn resident_direct_light_scale() -> f32 {
  return 1.0;
}

fn resident_environment_light_scale() -> f32 {
  return 1.0;
}`,
      `fn resident_ambient_irradiance() -> f32 {
  let suppression = clamp(camera_data.ambient_light_suppression, 0.0, 1.0);
  return mix(1.4, 0.03, suppression);
}

fn resident_direct_light_scale() -> f32 {
  return 1.0 - clamp(camera_data.direct_light_suppression, 0.0, 1.0);
}

fn resident_environment_light_scale() -> f32 {
  return 1.0 - clamp(camera_data.environment_light_suppression, 0.0, 1.0);
}`
    )
    .replace(
      `fn resident_refractive_backface(in: VertexOut) -> RefractiveBackfaceGeometry {
  return RefractiveBackfaceGeometry(vec3<f32>(0.0), 0.0);
}`,
      `fn resident_refractive_backface(in: VertexOut) -> RefractiveBackfaceGeometry {
  let dimensions = textureDimensions(refractive_back_depth);
  let surface_pixel = refraction_surface_pixel(in.position.xy, dimensions);
  if (!(surface_pixel.valid > 0.5)) {
    return RefractiveBackfaceGeometry(vec3<f32>(0.0), 0.0);
  }
  let back_depth = textureLoad(refractive_back_depth, surface_pixel.pixel, 0);
  let back_point = refraction_unproject_uv_depth(
    surface_pixel.uv,
    back_depth,
    camera_data.inverse_view_projection
  );
  if (!(back_point.valid > 0.5)) {
    return RefractiveBackfaceGeometry(vec3<f32>(0.0), 0.0);
  }
  let back_world = back_point.world_position;
  return RefractiveBackfaceGeometry(
    back_world,
    refraction_rear_surface_admitted(
      in.position.z,
      back_depth,
      in.world_position,
      back_world,
      in.normal,
      resident_view_direction(in.world_position),
      resident_refraction_max_path_m()
    )
  );
}`
    )
    .replace(
      `fn resident_refraction_max_path_m() -> f32 {
  return 0.0;
}

fn resident_refraction_inverse_view_projection() -> mat4x4<f32> {
  return mat4x4<f32>(
    vec4<f32>(1.0, 0.0, 0.0, 0.0),
    vec4<f32>(0.0, 1.0, 0.0, 0.0),
    vec4<f32>(0.0, 0.0, 1.0, 0.0),
    vec4<f32>(0.0, 0.0, 0.0, 1.0)
  );
}`,
      `fn resident_refraction_max_path_m() -> f32 {
  let radius_m = camera_data.bounds_radius_m;
  return select(
    0.0,
    2.0 * radius_m,
    radius_m == radius_m && abs(radius_m) < 1.0e20 && radius_m > 1.0e-6
  );
}

fn resident_refraction_inverse_view_projection() -> mat4x4<f32> {
  return camera_data.inverse_view_projection;
}`
    )
    .replace(
      `fn resident_surface_emissive(emissive_temperature_k: f32) -> vec3<f32> {
  return vec3<f32>(0.0);
}`,
      `fn resident_surface_emissive(emissive_temperature_k: f32) -> vec3<f32> {
  // Field-sampled per-fragment temperature when available; per-surface
  // closure temperature where the field is empty or unbound.
  let temperature_k = select(camera_data.emissive_temperature_k, emissive_temperature_k, emissive_temperature_k > 0.0);
  return blackbody_emission_rgb(temperature_k);
}`
    )
    .replace(
      '@group(0) @binding(0) var<storage, read> surface_vertices: array<vec4<f32>>;',
      `@group(0) @binding(0) var<storage, read> compact_position_rows: array<f32>;
@group(0) @binding(4) var<storage, read> compact_packed_normals: array<u32>;
@group(0) @binding(5) var<storage, read> compact_vertex_temperatures_k: array<f32>;`
    )
    .replace(
      /@vertex\nfn vs_main\(@builtin\(vertex_index\) vertex_index: u32\) -> VertexOut \{[\s\S]*?\n\}\n\nfn resident_surface_color/,
      `fn compact_position(vertex_index: u32) -> vec3<f32> {
  let offset = vertex_index * camera_data.source_stride_floats;
  return vec3<f32>(
    compact_position_rows[offset + 0u],
    compact_position_rows[offset + 1u],
    compact_position_rows[offset + 2u]
  );
}

fn compact_world_position(vertex_index: u32) -> vec3<f32> {
  var p = compact_position(vertex_index);
  if (camera_data.position_transform_enabled > 0.5) {
    p = vec3<f32>(
      camera_data.position_origin_x_m,
      camera_data.position_origin_y_m,
      camera_data.position_origin_z_m
    ) + (p + vec3<f32>(camera_data.position_grid_bias)) * camera_data.position_scale_m;
  }
  if (camera_data.position_clamp_enabled > 0.5) {
    p = clamp(
      p,
      vec3<f32>(
        camera_data.position_clamp_min_x_m,
        camera_data.position_clamp_min_y_m,
        camera_data.position_clamp_min_z_m
      ),
      vec3<f32>(
        camera_data.position_clamp_max_x_m,
        camera_data.position_clamp_max_y_m,
        camera_data.position_clamp_max_z_m
      )
    );
  }
  return p;
}

fn compact_normal(vertex_index: u32) -> vec3<f32> {
  let triangle_base = vertex_index - (vertex_index % 3u);
  let p0 = compact_world_position(triangle_base + 0u);
  let p1 = compact_world_position(triangle_base + 1u);
  let p2 = compact_world_position(triangle_base + 2u);
  let n = cross(p1 - p0, p2 - p0);
  if (length(n) <= 0.000000000001) {
    return normalize(vec3<f32>(
      camera_data.fallback_normal_x,
      camera_data.fallback_normal_y,
      camera_data.fallback_normal_z
    ) + vec3<f32>(0.0001, 0.0002, 0.0003));
  }
  return normalize(n);
}

fn octahedral_sign_not_zero(v: vec2<f32>) -> vec2<f32> {
  return select(vec2<f32>(-1.0), vec2<f32>(1.0), v >= vec2<f32>(0.0));
}

fn compact_packed_normal(vertex_index: u32) -> vec3<f32> {
  if (vertex_index >= arrayLength(&compact_packed_normals)) {
    return vec3<f32>(0.0);
  }
  let packed = compact_packed_normals[vertex_index];
  if (packed == 0x80008000u) {
    return vec3<f32>(0.0);
  }
  let oct = unpack2x16snorm(packed);
  var normal = vec3<f32>(oct, 1.0 - abs(oct.x) - abs(oct.y));
  if (normal.z < 0.0) {
    normal = vec3<f32>(
      (vec2<f32>(1.0) - abs(normal.yx)) * octahedral_sign_not_zero(normal.xy),
      normal.z
    );
  }
  let length_squared = dot(normal, normal);
  if (length_squared <= 0.000000000001) {
    return vec3<f32>(0.0);
  }
  return normal / sqrt(length_squared);
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOut {
  let position_m = compact_world_position(vertex_index);
  var out: VertexOut;
  var clip = camera_data.view_projection * vec4<f32>(position_m, 1.0);
  clip.z = clip.z * 0.5 + clip.w * 0.5;
  if (clip.w <= 0.0) {
    clip = vec4<f32>(2.0, 2.0, 1.0, 1.0);
  }
  out.position = clip;
  out.world_position = position_m;
  var normal = compact_normal(vertex_index);
  let smooth_normal = compact_packed_normal(vertex_index);
  if (dot(smooth_normal, smooth_normal) > 0.25) {
    normal = smooth_normal;
  }
  out.normal = normal;
  out.material_id = camera_data.material_id;
  out.phase_id = camera_data.phase_id;
  out.optical_state_id = camera_data.optical_state_id;
  var vertex_temperature_k = 0.0;
  if (vertex_index < arrayLength(&compact_vertex_temperatures_k)) {
    vertex_temperature_k = compact_vertex_temperatures_k[vertex_index];
  }
  out.emissive_temperature_k = vertex_temperature_k;
  return out;
}

fn resident_surface_color`
    );
