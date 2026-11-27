// Pure Direct-WebGPU Continuous-Zoom Multiscale Renderer for ULG Universes
// (`src/demos/ulgUniversesRenderer.js`).
//
// Zero Three.js overhead, zero per-frame CPU particle readbacks, zero serial 1-thread compute passes,
// ONE coalesced GPUCommandEncoder & 1 `queue.submit` per frame!
// Supports simultaneous multi-scale crossfading (up to 2 zero-copy resident GPU particle clouds
// + depth-correct photorealistic FBM/Rayleigh/cutaway spheres + zero-copy MD crystal atoms
// + relativistic Doppler accretion disks / planetary rings + 3D lines + 3D nuclear volume
// + fullscreen Schwarzschild lensing, Hyperdrive streaks, ACES tone-mapping, and Retro CRT).

import { configureCompatibleWebGpuCanvas } from '../runtime/shared/webgpuCompat.js';

const GPU_BUF = Object.freeze({
  COPY_DST: 0x0008,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

const GPU_TEX = Object.freeze({
  TEXTURE_BINDING: 0x0004,
  RENDER_ATTACHMENT: 0x0010
});

const CAMERA_WGSL = /* wgsl */ `
struct CameraUniforms {
  view_proj: mat4x4<f32>,
  cam_pos: vec4<f32>,    // xyz = camera world position, w = timeSec
  cam_right: vec4<f32>,  // xyz = right basis, w = aspect
  cam_up: vec4<f32>,     // xyz = up basis, w = fovTanHalf
  cam_fwd: vec4<f32>,    // xyz = forward basis, w = log10SpanM
  extra0: vec4<f32>,     // mode-specific floats
  extra1: vec4<f32>,     // mode-specific floats
  extra2: vec4<f32>,     // mode-specific floats
  em_sensor: vec4<f32>,  // x = log10LambdaMin [-13..+1], y = log10LambdaMax, z = sensorActive (0|1), w = gain
  em_aux: vec4<f32>,     // x = ambientTempK, y = sunFluxOrEclipse, z = skyOptDepth, w = flags (bit0=skipSurfaceFog, bit1=reversedLogDepth)
  star_light: vec4<f32>, // rgb = linear host-star light spectrum, w = perceptual inverse-square irradiance gain [0.14..1.85]
  sph_geo: vec4<f32>,    // x = sphGeoW (0=inactive), y = sphGeoH, z = sphGeoSphereIdx, w = seaLevelNorm
};

// Unified Reversed Logarithmic Depth Buffer [0.1 m .. 10^14 m (~668 AU)]!
// Maps w in [0 .. 1e14 m] onto WebGPU [1.0 .. 0.0] reversed-Z with zero z-fighting so
// 0.2 m surface rocks, 5 km mountains, 384,400 km moons, 150,000,000 km Suns, and outer planets
// coexist at TRUE physical meters in one depth buffer without any fixed-distance skybox hacks!
const LOG_DEPTH_INV_FAR: f32 = 0.0215021426; // 1.0 / log2(1.0e14 + 1.0)
fn apply_log_depth_vs(clip: vec4<f32>, flags_f: f32) -> vec4<f32> {
  let flags = u32(round(max(0.0, flags_f)));
  if ((flags & 2u) == 0u || clip.w <= 0.0) { return clip; }
  let z_rev_log = clamp(1.0 - log2(max(1e-4, clip.w + 1.0)) * LOG_DEPTH_INV_FAR, 1e-6, 0.999999);
  return vec4<f32>(clip.x, clip.y, z_rev_log * clip.w, clip.w);
}
fn eval_frag_depth(clip: vec4<f32>, flags_f: f32) -> f32 {
  let flags = u32(round(max(0.0, flags_f)));
  if ((flags & 2u) != 0u && clip.w > 0.0) {
    return clamp(1.0 - log2(max(1e-4, clip.w + 1.0)) * LOG_DEPTH_INV_FAR, 1e-6, 0.999999);
  }
  return clamp(clip.z / max(1e-5, clip.w), 0.0, 1.0);
}
`;

// Shared Overflow-Safe Full-Spectrum EM Sensor Spectral Mapper (10^-13 m Gamma -> 10^+1 m Radio).
// Strictly bit-exact bypass when cam.em_sensor.z < 0.5 (native Human Visible mode)!
const EM_SENSOR_WGSL = /* wgsl */ `
fn em_band_weight(log_lam: f32, center: f32, half_w: f32) -> f32 {
  let d = (log_lam - center) / max(0.08, half_w);
  return exp(-(d * d));
}

fn em_planck_response(log_lam: f32, temp_k: f32) -> f32 {
  let t_safe = max(2.7, temp_k);
  // x = h c / (lambda k_B T); log10(h c / k_B) = -1.842006
  let log10_x = clamp(-1.842006 - log_lam - log(t_safe) * 0.43429448, -8.0, 1.86);
  let x = pow(10.0, log10_x);
  // Exact dimensionless Planck spectral brightness B_nu(x) / B_nu(x_peak) = (x^3 / (exp(x) - 1)) / 1.421435:
  //   - Peaks cleanly at 1.0 when x = 2.82144 (exact Wien frequency peak!)
  //   - Falls smoothly as x^2 -> 0 in Rayleigh-Jeans radio (so 2.725 K empty space is pitch-black in 21cm Radio!)
  //   - Falls exponentially as x^3 exp(-x) -> 0 on the Wien short-wavelength side (honest thermal contrast!)
  var rel = 0.0;
  if (x < 0.01) {
    rel = (x * x) / (1.421435 * (1.0 + 0.5 * x));
  } else {
    rel = ((x * x * x) / max(1e-6, exp(x) - 1.0)) / 1.421435;
  }
  return clamp(pow(max(0.0, rel), 0.55) * 1.15, 0.0, 2.4);
}

fn em_channel_at(
  log_lam: f32,
  vis_lum: f32,
  temp_k: f32,
  uv_aur: f32,
  xray_synch: f32,
  radio_hi: f32,
  gamma_511: f32
) -> f32 {
  let w_vis = em_band_weight(log_lam, -6.26, 0.28);
  let w_uv  = em_band_weight(log_lam, -7.25, 0.72);
  let w_xr  = em_band_weight(log_lam, -9.45, 1.25);
  let w_gam = em_band_weight(log_lam, -12.1, 1.05);
  let w_rad = smoothstep(-2.4, -0.6, log_lam);
  let thermal = em_planck_response(log_lam, temp_k);
  return vis_lum * w_vis * 1.15
    + thermal
    + uv_aur * w_uv * 1.65
    + xray_synch * w_xr * 1.85
    + radio_hi * w_rad * 1.75
    + gamma_511 * w_gam * 2.10;
}

fn em_sensor_map_rgb(
  vis_rgb: vec3<f32>,
  temp_k: f32,
  uv_aur: f32,
  xray_synch: f32,
  radio_hi: f32,
  gamma_511: f32
) -> vec3<f32> {
  if (cam.em_sensor.z < 0.5) {
    return vis_rgb;
  }
  let l_min = min(cam.em_sensor.x, cam.em_sensor.y);
  let l_max = max(l_min + 0.12, max(cam.em_sensor.x, cam.em_sensor.y));
  let gain = max(0.2, cam.em_sensor.w);
  let vis_lum = dot(vis_rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  // Shortest wavelength caret (lambda_min, highest energy) -> Blue/Violet; Mid -> Green; Longest (lambda_max) -> Red
  let l_b = mix(l_min, l_max, 0.17);
  let l_g = mix(l_min, l_max, 0.50);
  let l_r = mix(l_min, l_max, 0.83);
  let sb = em_channel_at(l_b, vis_rgb.b, temp_k, uv_aur, xray_synch, radio_hi, gamma_511);
  let sg = em_channel_at(l_g, vis_rgb.g, temp_k, uv_aur, xray_synch, radio_hi, gamma_511);
  let sr = em_channel_at(l_r, vis_rgb.r, temp_k, uv_aur, xray_synch, radio_hi, gamma_511);
  // Subtle spectral false-color contrast boost when the active window is narrowband
  let base_e = vec3<f32>(sr, sg, sb) * gain;
  let mean_e = (sr + sg + sb) * 0.333333;
  let vivid = mix(vec3<f32>(mean_e), base_e, 1.28);
  return max(vec3<f32>(0.0), vivid) + vec3<f32>(0.003, 0.005, 0.010) * clamp(vis_lum, 0.0, 0.25);
}
`;

const BACKDROP_WGSL = /* wgsl */ `
${CAMERA_WGSL}
${EM_SENSOR_WGSL}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) ndc: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  // Reversed-Z Infinite Far Plane: z = 0.0 is farthest infinity!
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.ndc = pts[vid];
  return out;
}

fn hash31(p: vec3<f32>) -> f32 {
  var q = fract(p * 0.1031);
  q = q + dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

fn star_layer(dir: vec3<f32>, scale: f32, thresh: f32) -> vec3<f32> {
  let p = dir * scale;
  let cell = floor(p);
  let f = fract(p) - 0.5;
  let h = hash31(cell);
  if (h < thresh) { return vec3<f32>(0.0); }
  let jitter = vec3<f32>(hash31(cell + 17.1), hash31(cell + 41.7), hash31(cell + 73.3)) - 0.5;
  let d = length(f - jitter * 0.52);
  let spark = exp(-d * d * 78.0) * smoothstep(thresh, 1.0, h);
  let temp = hash31(cell + 99.9);
  let col = mix(vec3<f32>(0.68, 0.82, 1.0), vec3<f32>(1.0, 0.84, 0.64), temp);
  return col * spark;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let fov = cam.cam_up.w;
  let aspect = cam.cam_right.w;
  let dir = normalize(
    cam.cam_fwd.xyz
    + cam.cam_right.xyz * (in.ndc.x * aspect * fov)
    + cam.cam_up.xyz * (in.ndc.y * fov)
  );
  let log_span = cam.cam_fwd.w;
  // Subtle Milky Way galactic band visible ONLY when no live parent GPU galaxy skybox is active!
  let live_parent_sky = clamp(cam.extra0.y, 0.0, 1.0);
  let gal_vis = (1.0 - smoothstep(17.0, 23.0, log_span)) * smoothstep(-4.0, 4.0, log_span) * (1.0 - 0.88 * live_parent_sky);
  let gal_axis = dir.y * 2.8 + dir.x * 0.72;
  let gal_band = exp(-(gal_axis * gal_axis) * 4.5);
  let dust = 0.5 + 0.5 * sin(dir.x * 4.5 + dir.z * 3.2) * cos(dir.y * 3.9 - dir.x * 2.8);
  let base_void = mix(vec3<f32>(0.005, 0.009, 0.020), vec3<f32>(0.004, 0.007, 0.015), 1.0 - smoothstep(-8.0, 0.0, log_span));
  var col = base_void + vec3<f32>(0.028, 0.036, 0.068) * gal_band * dust * (0.25 + 0.75 * gal_vis);

  let star_vis = (smoothstep(-6.0, 6.0, log_span) * 0.85 + 0.15) * (1.0 - 0.65 * live_parent_sky);
  let stars = star_layer(dir, 58.0, 0.972) * 1.15 * star_vis
    + star_layer(dir, 130.0, 0.978) * 0.68 * star_vis
    + star_layer(dir, 230.0, 0.986) * 0.32 * star_vis;
  col = col + stars;

  // In full-spectrum EM mode, CMB 2.725 K microwave glow stays subtle (0.24x) in mm-wave & dark in 21cm Radio!
  if (cam.em_sensor.z > 0.5) {
    let cmb_aniso = 2.725 + 0.22 * sin(dir.x * 7.5 + dir.y * 5.2) * cos(dir.z * 6.8 - dir.x * 4.1);
    let hi_plane = gal_band * (0.35 + 0.65 * dust) * 0.14;
    let star_lum = dot(stars, vec3<f32>(0.3, 0.5, 0.2));
    let em_bg = em_sensor_map_rgb(col, mix(cmb_aniso, 6500.0, clamp(star_lum, 0.0, 1.0)), star_lum * 0.5, star_lum * 0.18, hi_plane, 0.0);
    col = em_bg * mix(0.22, 0.95, clamp(star_lum * 2.5, 0.0, 1.0));
  }
  return vec4<f32>(col, 1.0);
}
`;

// Planetary Surface Atmospheric Sky Dome + Dynamic Sunrise/Sunset + Eclipse + Night Milky Way!
//   extra0: vec4(skyZenith.r, skyZenith.g, skyZenith.b, skyOpticalDepth)
//   extra1: vec4(lightDir.x, lightDir.y, lightDir.z, curvInv2R)
//   extra2: vec4(skyHorizon.r, skyHorizon.g, skyHorizon.b, isMagmaOrRogue)
const SURFACE_SKY_WGSL = /* wgsl */ `
${CAMERA_WGSL}
${EM_SENSOR_WGSL}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) ndc: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  // Reversed-Z Infinite Far Plane: z = 0.0 is farthest infinity!
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.ndc = pts[vid];
  return out;
}

fn hash31_s(p: vec3<f32>) -> f32 {
  var q = fract(p * 0.1031);
  q = q + dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

fn star_layer_s(dir: vec3<f32>, scale: f32, thresh: f32) -> vec3<f32> {
  let p = dir * scale;
  let cell = floor(p);
  let f = fract(p) - 0.5;
  let h = hash31_s(cell);
  if (h < thresh) { return vec3<f32>(0.0); }
  let jitter = vec3<f32>(hash31_s(cell + 17.1), hash31_s(cell + 41.7), hash31_s(cell + 73.3)) - 0.5;
  let d = length(f - jitter * 0.50);
  let spark = exp(-d * d * 82.0) * smoothstep(thresh, 1.0, h);
  let temp = hash31_s(cell + 99.9);
  return mix(vec3<f32>(0.72, 0.84, 1.0), vec3<f32>(1.0, 0.86, 0.66), temp) * spark;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let fov = cam.cam_up.w;
  let aspect = cam.cam_right.w;
  let dir = normalize(
    cam.cam_fwd.xyz
    + cam.cam_right.xyz * (in.ndc.x * aspect * fov)
    + cam.cam_up.xyz * (in.ndc.y * fov)
  );
  let sky_zen_day = cam.extra0.rgb;
  let opt_depth = clamp(cam.extra0.w, 0.0, 1.0);
  let sun_dir = normalize(cam.extra1.xyz);
  let sky_hor_day = cam.extra2.rgb;
  let eclipse_f = clamp(cam.em_aux.y, 0.04, 1.0);
  let star_rgb = cam.star_light.rgb;
  let star_flux = clamp(cam.star_light.w, 0.14, 1.85);
  let sky_star_gain = clamp(0.24 + 0.76 * star_flux, 0.22, 1.45);
  let sky_star_tint = mix(vec3<f32>(1.0), star_rgb, 0.68);

  // Physical Chapman airmass day -> golden/crimson sunset twilight -> deep starlit night cycle!
  let sun_elev = sun_dir.y;
  let day_f = smoothstep(-0.12, 0.24, sun_elev) * eclipse_f;
  let twi_d = (sun_elev - 0.02) / 0.14;
  let sunset_w = exp(-(twi_d * twi_d)) * opt_depth * eclipse_f;
  let night_zen = vec3<f32>(0.004, 0.008, 0.022);
  let night_hor = vec3<f32>(0.014, 0.022, 0.044);
  let sky_zen = mix(night_zen, sky_zen_day * sky_star_tint * sky_star_gain, day_f) + vec3<f32>(0.18, 0.10, 0.24) * sky_star_tint * sunset_w * 0.45 * sky_star_gain;
  let sky_hor = mix(night_hor, sky_hor_day * sky_star_tint * sky_star_gain, day_f) + vec3<f32>(0.96, 0.40, 0.14) * sky_star_tint * sunset_w * 0.82 * sky_star_gain;

  // Smooth elevation gradient from horizon haze band to deep zenith sky!
  let elev = clamp(dir.y, -0.35, 1.0);
  let sky_t = pow(clamp((elev + 0.04) / 1.04, 0.0, 1.0), 0.56);
  var col = mix(sky_hor, sky_zen, sky_t);

  // Directional crimson-gold horizon sunset glow centered toward the setting/rising sun azimuth
  let hor_cos = max(0.0, dot(normalize(vec3<f32>(dir.x, 0.0, dir.z) + vec3<f32>(1e-5, 0.0, 0.0)), normalize(vec3<f32>(sun_dir.x, 0.0, sun_dir.z) + vec3<f32>(1e-5, 0.0, 0.0))));
  let sunset_band = exp(-abs(dir.y) * 5.2) * pow(hor_cos, 3.0) * sunset_w;
  col = col + vec3<f32>(1.15, 0.44, 0.12) * sky_star_tint * sunset_band * 0.85 * sky_star_gain;

  // Subtle below-horizon horizon-haze fill so curved TinyPlanet terrain melts seamlessly into the horizon!
  if (dir.y < 0.0) {
    let below = 1.0 - smoothstep(-0.36, 0.0, dir.y);
    col = mix(col, sky_hor * mix(0.96, 0.84, opt_depth), below);
  }

  // Forward Mie solar scattering + crisp HDR solar glow (masked cleanly below horizon!)
  let sun_above = smoothstep(-0.04, 0.02, sun_elev);
  let cos_sun = dot(dir, sun_dir);
  let sun_halo = (pow(max(0.0, cos_sun), 10.0) * (0.24 + 0.48 * opt_depth)
    + pow(max(0.0, cos_sun), 64.0) * (0.50 + 0.60 * opt_depth)) * sun_above * eclipse_f * sky_star_gain;
  let sun_col = mix(star_rgb, vec3<f32>(1.0, 0.58, 0.24) * sky_star_tint, clamp(sunset_w + opt_depth * 0.35, 0.0, 1.0));
  col = col + sun_col * sun_halo;

  // Crisp stars & Milky Way shine brightly in airless vacuum AND on atmospheric night sides / during solar eclipses!
  let atm_clear = 1.0 - smoothstep(0.03, 0.36, opt_depth * day_f);
  let star_vis = clamp(atm_clear * smoothstep(-0.02, 0.14, dir.y), 0.0, 1.0);
  if (star_vis > 0.02) {
    let rot_a = cam.cam_pos.w * 0.004;
    let cr = cos(rot_a); let sr = sin(rot_a);
    let sdir = vec3<f32>(dir.x * cr - dir.z * sr, dir.y, dir.x * sr + dir.z * cr);
    let mw_axis = sdir.y * 2.4 + sdir.x * 0.85;
    let mw_band = exp(-(mw_axis * mw_axis) * 4.2) * (0.55 + 0.45 * sin(sdir.x * 5.2 + sdir.z * 3.8));
    let stars = star_layer_s(sdir, 62.0, 0.970) * 1.25
      + star_layer_s(sdir, 140.0, 0.978) * 0.72
      + star_layer_s(sdir, 240.0, 0.986) * 0.35;
    col = col + (stars + vec3<f32>(0.045, 0.058, 0.105) * mw_band) * star_vis;
  }

  // Live 3D Geodynamo Surface Sky Aurorae ([O I] 557.7 nm emerald -> cyan-teal -> [O I] 630 nm / N2+ violet-crimson curtains)!
  // Exact 3D spherical thermosphere shell ray-intersection (R_p = 6371 km, h = 105..280 km) so magnetic curtains
  // arch majestically from 5° above the mountain horizon all the way to zenith at twilight & midnight!
  // Strictly gated by live geodynamo B-field, atmospheric optical depth, geomagnetic oval latitude, & dark-sky radiance
  // (0 at high noon in sunlit blue sky, 0 on unmagnetized/vacuum worlds like Moon/Mars!).
  let aurora_str = clamp(cam.sph_geo.x, 0.0, 2.5);
  let obs_lat_rad = cam.sph_geo.y;
  var aur_uv_sig = 0.0;
  if (aurora_str > 0.005 && opt_depth > 0.03 && dir.y > 0.015) {
    // True sky-brightness contrast gating: vivid across midnight, dusk, dawn & solar eclipses; washed out by sunlit daytime sky!
    let dark_vis = clamp(1.0 - smoothstep(-0.04, 0.24, sun_elev) * opt_depth * eclipse_f, 0.0, 1.0);
    if (dark_vis > 0.01) {
      let hor_fade = smoothstep(0.015, 0.095, dir.y) * (1.0 - smoothstep(0.92, 0.998, dir.y) * 0.18);
      let t_aur = cam.cam_pos.w * 0.42;
      let r_planet_km = 6371.0;
      // Poleward geomagnetic oval offset (arcs sit closer to zenith at polar latitudes, sweeping dramatically across the lower horizon at mid-latitudes!)
      let lat_abs = abs(obs_lat_rad);
      let oval_shift_km = mix(360.0, 75.0, smoothstep(0.35, 1.15, lat_abs));
      var aur_col = vec3<f32>(0.0);
      // 8 physical thermospheric emission shells from 105 km (emerald O I 557.7 nm / N2 pink) -> 275 km (crimson/violet O I 630 nm / N2+)
      for (var k = 0u; k < 8u; k = k + 1u) {
        let fk = f32(k) / 7.0;
        let h_km = 105.0 + fk * 170.0;
        // Exact ray intersection with curved spherical upper-atmosphere shell at radius (R_p + h_km)
        let b_s = r_planet_km * dir.y;
        let s_km = -b_s + sqrt(max(1.0, b_s * b_s + 2.0 * r_planet_km * h_km + h_km * h_km));
        let p_km = dir.xz * s_km;
        let r_hor_km = length(p_km);
        let az_km = atan2(p_km.y, p_km.x);
        // Three sweeping, undulating Birkeland geomagnetic curtains spanning 150..780 km horizontal shell distance
        // (naturally visible right across 6°..65° elevation above the horizon mountains AND overhead!)
        let fold_a = sin(az_km * 2.0 + t_aur * 0.48 + fk * 0.22) * 95.0
          + cos(az_km * 5.0 - t_aur * 0.74 + p_km.x * 0.0045) * 48.0;
        let d_a = (r_hor_km - (oval_shift_km + 95.0 + fold_a)) / (52.0 + fk * 28.0);
        let curt_a = exp(-(d_a * d_a));

        let fold_b = cos(az_km * 3.0 - t_aur * 0.56 - fk * 0.18) * 115.0
          + sin(az_km * 6.0 + t_aur * 0.82 + p_km.y * 0.0042) * 56.0;
        let d_b = (r_hor_km - (oval_shift_km + 275.0 + fold_b)) / (68.0 + fk * 34.0);
        let curt_b = exp(-(d_b * d_b));

        let fold_c = sin(az_km * 4.0 + t_aur * 0.38) * 80.0;
        let d_c = (r_hor_km - (oval_shift_km + 485.0 + fold_c)) / (85.0 + fk * 40.0);
        let curt_c = exp(-(d_c * d_c)) * 0.72;

        // Crisp vertical magnetic-field-aligned electron precipitation ray striations!
        let ray_p = az_km * 26.0 + fold_a * 0.032 + t_aur * 1.9;
        let ray_q = az_km * 15.0 - t_aur * 1.3 + p_km.x * 0.011;
        let rays = 0.44 + 0.56 * max(0.0, sin(ray_p) * cos(ray_q) * 0.7 + 0.35 * sin(az_km * 41.0 - t_aur * 2.5));
        let sheet = (curt_a + curt_b * 0.88 + curt_c) * rays;

        // Real upper-atmosphere atomic spectroscopy by altitude h_km:
        //   105-120 km: pink/magenta N2 lower fringe + electric emerald [O I] 557.7 nm
        //   120-190 km: bright emerald-cyan [O I] 557.7 nm
        //   190-275 km: crimson-violet [O I] 630.0 nm & N2+ 427.8 nm upper crown!
        let c_base = vec3<f32>(0.24, 1.00, 0.52);
        let c_mid  = vec3<f32>(0.10, 0.90, 0.74);
        let c_top  = vec3<f32>(0.72, 0.16, 0.94);
        let slice_c = select(mix(c_mid, c_top, (fk - 0.42) / 0.58), mix(c_base, c_mid, fk / 0.42), fk < 0.42);
        let alt_w = (1.28 - fk * 0.52) * smoothstep(0.0, 0.18, fk + 0.06);
        aur_col = aur_col + slice_c * sheet * alt_w * 0.42;
      }
      let aur_gain = aurora_str * dark_vis * hor_fade;
      col = col + aur_col * aur_gain;
      aur_uv_sig = clamp(length(aur_col) * aur_gain * 0.90, 0.0, 2.0);
    }
  }

  col = em_sensor_map_rgb(col, mix(2.725, max(50.0, cam.em_aux.x * 0.82), opt_depth * 0.65), sunset_w * 0.3 + sun_halo * 0.4 + aur_uv_sig * 1.2, aur_uv_sig * 0.25, star_vis * 0.12 + aur_uv_sig * 0.35, 0.0);
  return vec4<f32>(col, 1.0);
}
`;

// Planetary Surface 3D Terrain & Articulated Solid Vehicle (Rover + Drone) Lit Shader!
// Consumes 48-byte vertices directly from GPU terrain_verts & vehicleVertBuf:
//   @location(0) pos_curv:  vec4(x, y_curved, z, rawHeight)
//   @location(1) norm_tag:  vec4(nx, ny, nz, tag)  0=rock, 1=ice/highland, 2=ocean, 3=magma, 4=vehicle
//   @location(2) col_emiss: vec4(r, g, b, emissive)
const SURFACE_MESH_WGSL = /* wgsl */ `
${CAMERA_WGSL}
${EM_SENSOR_WGSL}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;

struct VsIn {
  @location(0) pos_curv: vec4<f32>,
  @location(1) norm_tag: vec4<f32>,
  @location(2) col_emiss: vec4<f32>,
};

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) world_pos: vec3<f32>,
  @location(1) norm: vec3<f32>,
  @location(2) albedo: vec3<f32>,
  @location(3) surf_info: vec3<f32>, // x = tag, y = emissive, z = rawHeight
};

@vertex
fn vs_main(in: VsIn) -> VsOut {
  var out: VsOut;
  out.pos = apply_log_depth_vs(cam.view_proj * vec4<f32>(in.pos_curv.xyz, 1.0), cam.em_aux.w);
  out.world_pos = in.pos_curv.xyz;
  out.norm = in.norm_tag.xyz;
  out.albedo = in.col_emiss.rgb;
  out.surf_info = vec3<f32>(in.norm_tag.w, in.col_emiss.w, in.pos_curv.w);
  return out;
}

fn surf_hash(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453);
}

// Smooth C2 quintic value noise with exact analytical (val, d/dx, d/dy) — zero grid-cell faceting!
fn surf_noise_d(p: vec2<f32>) -> vec3<f32> {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  let du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  let a = surf_hash(i);
  let b = surf_hash(i + vec2<f32>(1.0, 0.0));
  let c = surf_hash(i + vec2<f32>(0.0, 1.0));
  let d = surf_hash(i + vec2<f32>(1.0, 1.0));
  let k0 = a;
  let k1 = b - a;
  let k2 = c - a;
  let k3 = a - b - c + d;
  let val = k0 + k1 * u.x + k2 * u.y + k3 * u.x * u.y;
  let dx = (k1 + k3 * u.y) * du.x;
  let dy = (k2 + k3 * u.x) * du.y;
  return vec3<f32>(val, dx, dy);
}

fn surf_noise(p: vec2<f32>) -> f32 {
  return surf_noise_d(p).x;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let sky_zen = cam.extra0.rgb;
  let opt_depth = clamp(cam.extra0.w, 0.0, 1.0);
  let sun_dir = normalize(cam.extra1.xyz);
  let sky_hor = cam.extra2.rgb;

  var n = normalize(in.norm);
  let view_v = cam.cam_pos.xyz - in.world_pos;
  let dist = length(view_v);
  let v = view_v / max(1e-4, dist);
  let half_v = normalize(sun_dir + v);

  let tag = in.surf_info.x;
  let emissive = in.surf_info.y;
  let raw_h = in.surf_info.z;

  // Rotated tri-scale analytical C2 micro-normal relief + stratigraphic cliff banding on natural terrain!
  var base_col = in.albedo;
  if (tag < 3.5 && (tag < 1.5 || tag > 2.5)) {
    let p_xz = in.world_pos.xz;
    let rot1 = vec2<f32>(p_xz.x * 0.80 - p_xz.y * 0.60, p_xz.x * 0.60 + p_xz.y * 0.80);
    let rot2 = vec2<f32>(p_xz.x * 0.36 + p_xz.y * 0.93, -p_xz.x * 0.93 + p_xz.y * 0.36);
    let n1 = surf_noise_d(p_xz * 0.32);
    let n2 = surf_noise_d(rot1 * 1.15 + vec2<f32>(11.3, -7.1));
    let n3 = surf_noise_d(rot2 * 3.40 - vec2<f32>(5.7, 13.4));
    // Transform rotated analytical gradients back into world XZ frame
    let d2_x = n2.y * 0.80 + n2.z * 0.60;
    let d2_z = -n2.y * 0.60 + n2.z * 0.80;
    let d3_x = n3.y * 0.36 - n3.z * 0.93;
    let d3_z = n3.y * 0.93 + n3.z * 0.36;
    let bump_fade = 1.0 - smoothstep(14.0, 78.0, dist);
    let bump_s = select(0.14, 0.08, tag > 0.5 && tag < 1.5) * bump_fade;
    let gx = n1.y * 0.55 + d2_x * 0.32 + d3_x * 0.13;
    let gz = n1.z * 0.55 + d2_z * 0.32 + d3_z * 0.13;
    n = normalize(n - vec3<f32>(gx * bump_s, 0.0, gz * bump_s));
    let grain = 0.87 + 0.14 * n1.x + 0.09 * n2.x + 0.05 * n3.x;
    // Geological sedimentary / basaltic strata bands on steeper canyon/crater walls
    let slope_w = smoothstep(0.12, 0.44, 1.0 - n.y);
    let strata = 0.90 + 0.16 * sin(raw_h * 3.4 + n1.x * 2.6);
    base_col = base_col * grain * mix(1.0, strata, slope_w * 0.78);
    // Wet darkened shoreline sand + crisp coastal moisture band right above liquid sea level!
    let wet_shore = (1.0 - smoothstep(0.0, 2.2, abs(raw_h - 0.35))) * smoothstep(-0.3, 0.5, raw_h);
    base_col = mix(base_col, base_col * 0.62, wet_shore * 0.55);
  }

  let ndl = max(0.0, dot(n, sun_dir));
  let ndv = max(0.0, dot(n, v));
  let fresnel = pow(max(0.0, 1.0 - ndv), 3.8);

  let skip_fog = (u32(round(max(0.0, cam.em_aux.w))) & 1u) != 0u;
  let eclipse_f = select(clamp(cam.em_aux.y, 0.06, 1.0), 1.0, skip_fog);
  let sun_day = select(smoothstep(-0.10, 0.18, sun_dir.y) * eclipse_f, 1.0, skip_fog);
  let twi_d = (sun_dir.y - 0.03) / 0.14;
  let sunset_w = select(exp(-(twi_d * twi_d)) * opt_depth * eclipse_f, 0.0, skip_fog);

  // Hemispheric sky-bounce ambient (genuinely dark starlit night on planet/comet dark side!)
  let star_rgb = cam.star_light.rgb;
  let star_flux = clamp(cam.star_light.w, 0.14, 1.85);
  let surf_star_l = select(star_rgb * star_flux, mix(vec3<f32>(1.0), star_rgb, 0.45) * clamp(0.45 + 0.55 * star_flux, 0.45, 1.35), skip_fog);
  let sky_gain = select(clamp(0.26 + 0.74 * star_flux, 0.22, 1.40), 1.0, skip_fog);
  let hemi_up = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
  let amb_sky_day = mix(sky_hor * 0.42 + vec3<f32>(0.04, 0.05, 0.07), sky_zen * 0.55 + vec3<f32>(0.05, 0.06, 0.09), hemi_up) * mix(vec3<f32>(1.0), star_rgb, 0.55) * sky_gain;
  let amb_sky_night = mix(vec3<f32>(0.007, 0.010, 0.018), vec3<f32>(0.020, 0.030, 0.054), opt_depth);
  let amb_sky = select(mix(amb_sky_night, amb_sky_day, sun_day), vec3<f32>(0.24, 0.28, 0.34), skip_fog);
  let amb_gain = select(mix(0.20, 0.55, opt_depth * sun_day + 0.15), 0.42, skip_fog);
  let sun_tint = mix(
    mix(vec3<f32>(1.05, 1.02, 0.96), vec3<f32>(1.12, 0.95, 0.78), opt_depth * 0.35),
    vec3<f32>(1.25, 0.56, 0.24),
    sunset_w * 0.68
  ) * surf_star_l;

  // Subtle emerald-cyan UFO ventral landing pool on pitch-black night sides so terrain stays navigable in true darkness!
  let night_pool = select(exp(-dist * dist / (110.0 * 110.0)) * (1.0 - sun_day) * 0.24, 0.0, skip_fog || tag > 3.5);
  var lit = base_col * (amb_sky * amb_gain + sun_tint * (ndl * 1.18 * sun_day) + vec3<f32>(0.34, 0.92, 0.72) * night_pool);

  if (tag > 1.5 && tag < 2.5) {
    // Liquid ocean/sea surface (general H2O / CH4 / NH3 / H2SO4 solvent shaded from vertex albedo + live GPU waves!)
    let t = cam.cam_pos.w;
    let p_w = in.world_pos.xz;
    let ph1 = dot(p_w, vec2<f32>(0.86, 0.51)) * 0.72 + t * 1.9;
    let ph2 = dot(p_w, vec2<f32>(-0.42, 0.91)) * 1.18 - t * 1.5;
    let ph3 = dot(p_w, vec2<f32>(0.31, -0.95)) * 1.95 + t * 2.4;
    let wn = (surf_noise(p_w * 0.65 + vec2<f32>(t * 0.35, -t * 0.28)) - 0.5) * 0.05;
    let wx = sin(ph1) * 0.024 + cos(ph2) * 0.018 + sin(ph3) * 0.012 + wn;
    let wz = cos(ph1) * 0.020 - sin(ph2) * 0.022 + cos(ph3) * 0.012 - wn;
    let nw = normalize(n + vec3<f32>(wx, 0.0, wz));
    let hw = normalize(sun_dir + v);
    let w_spec = pow(max(0.0, dot(nw, hw)), 84.0) * 1.35 * sun_day;
    let w_fres = pow(max(0.0, 1.0 - max(0.0, dot(nw, v))), 3.2);
    let foam_n = surf_noise(p_w * 1.35 + vec2<f32>(t * 0.4, t * 0.25));
    let foam_wave = clamp(emissive, 0.0, 1.0);
    let foam = clamp(smoothstep(0.68, 0.92, foam_n + sin(ph1) * 0.14) * 0.16 + foam_wave * 0.55, 0.0, 0.85);
    let sky_refl = mix(vec3<f32>(0.03, 0.05, 0.10), sky_hor * 0.95 + in.albedo * 0.45, sun_day);
    let foam_col = mix(in.albedo * 1.65, vec3<f32>(0.90, 0.96, 1.0), 0.72);
    lit = mix(lit, sky_refl, w_fres * 0.70) + sun_tint * w_spec + foam_col * foam * (0.25 + 0.85 * ndl * sun_day);
  } else if (tag > 3.5) {
    // Metallic Rover, Drone, & UFO hardware: crisp Blinn-Phong specular + rim edge highlight!
    let m_spec = pow(max(0.0, dot(n, half_v)), 48.0) * 0.72 * (0.25 + 0.75 * sun_day);
    let rim_col = select(sky_hor * 0.38 * sun_day + vec3<f32>(0.14, 0.18, 0.24), vec3<f32>(0.22, 0.28, 0.36), skip_fog);
    lit = lit + sun_tint * m_spec + rim_col * fresnel * 0.48;
  } else {
    // Mineral sheen + sparkling crystalline snow/ice micro-glint on snow-covered slopes!
    let r_spec = pow(max(0.0, dot(n, half_v)), 20.0) * select(0.08, 0.32, tag > 0.5 && tag < 1.5) * sun_day;
    let snow_sparkle = select(0.0, smoothstep(0.88, 0.98, surf_noise(in.world_pos.xz * 7.5 + v.xz * 1.4)) * 0.42 * sun_day, tag > 0.5 && tag < 1.5);
    lit = lit + sun_tint * (r_spec + snow_sparkle);
  }

  // Per-pixel volcanic basalt-fissure glow enhancement on Magma Ocean worlds (zero blocky vertex borders!)
  var emiss_eff = select(emissive, 0.0, tag > 1.5 && tag < 2.5);
  var emiss_col = in.albedo;
  if (!skip_fog && cam.extra2.w > 0.5 && tag < 3.5) {
    let f1 = surf_noise(in.world_pos.xz * 0.38 + vec2<f32>(3.1, -5.2));
    let f2 = surf_noise(in.world_pos.xz * 1.15 - vec2<f32>(7.4, 2.8));
    let vein = 1.0 - smoothstep(0.03, 0.16, abs((f1 * 0.7 + f2 * 0.3) - 0.5));
    let molten = clamp(emissive * (0.65 + 0.55 * f2) + vein * 1.15, 0.0, 2.2);
    emiss_eff = molten;
    emiss_col = mix(vec3<f32>(1.0, 0.24, 0.03), vec3<f32>(1.0, 0.86, 0.32), clamp(molten * 0.62, 0.0, 1.0));
  }
  lit = lit + emiss_col * emiss_eff * 1.20;

  var final_col = lit;
  if (!skip_fog) {
    // Exponential atmospheric perspective fog + smooth +-6 km 2-ring GPU clipmap horizon fade!
    let horiz_dist = length(in.world_pos.xz - cam.cam_pos.xz);
    let fog_density = mix(0.000045, 0.00028, opt_depth);
    let fog_amt = clamp(1.0 - exp(-dist * fog_density), 0.0, 0.82);
    let patch_edge = smoothstep(4200.0, 5850.0, horiz_dist);
    let total_fog = clamp(max(fog_amt, patch_edge), 0.0, 1.0);
    let fog_hor = mix(vec3<f32>(0.014, 0.022, 0.044), sky_hor, sun_day) + vec3<f32>(0.96, 0.40, 0.14) * sunset_w * 0.75;
    // Low-sun aerial-perspective Mie forward-scattering golden god-rays!
    let mie_ray = pow(max(0.0, dot(-v, sun_dir)), 7.0) * opt_depth * sun_day * clamp(total_fog * 1.4, 0.0, 0.65);
    final_col = mix(lit, fog_hor, total_fog) + sun_tint * mie_ray * 0.32;
  }

  // Full-spectrum EM sensor mapping: real FLIR thermal inertia (warm oceans, cool alpine ridges, hot craters & UFO!)
  if (cam.em_sensor.z > 0.5) {
    let amb_t = max(35.0, cam.em_aux.x);
    let veh_heat = select(0.0, 210.0 + emiss_eff * 380.0, tag > 3.5);
    let lava_heat = emiss_eff * 1450.0;
    let sun_heat = ndl * sun_day * 42.0;
    let ocean_inertia = select(0.0, 26.0, tag > 1.5 && tag < 2.5);
    let elev_lapse = -clamp(in.world_pos.y, -24.0, 140.0) * 0.72;
    let slope_contrast = (n.y - 0.78) * 32.0 + (1.0 - dot(in.albedo, vec3<f32>(0.333))) * 22.0;
    let surf_temp_k = max(25.0, amb_t + veh_heat + lava_heat + sun_heat + ocean_inertia + elev_lapse + slope_contrast);
    let radio_sig = select(0.0, 0.55, tag > 3.5);
    final_col = em_sensor_map_rgb(final_col, surf_temp_k, 0.0, 0.0, radio_sig, 0.0);
  }
  return vec4<f32>(final_col, 1.0);
}
`;

// Hardware GPU-Instanced Planetary Flora, Xenobiota & Indigenous Settlement Spires!
// Reads 1 storage buffer (`flora_instances`, 48 B/inst) + 32 B template verts (`pos_part`, `norm_kind`).
const SURFACE_FLORA_INSTANCED_WGSL = /* wgsl */ `
${CAMERA_WGSL}
${EM_SENSOR_WGSL}

struct FloraInstance {
  pos_scale: vec4<f32>, // xyz = curved world base, w = heightScale (<= 0 culled)
  rot_kind: vec4<f32>,  // x = yawRad, y = radialScale, z = kindId (0..2), w = snowWeight
  col_emiss: vec4<f32>, // rgb = canopy/facade albedo, w = emissiveWindow
};

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> instances: array<FloraInstance>;

struct VsIn {
  @location(0) pos_part: vec4<f32>,  // xyz = local unit coords, w = partId (0=trunk/base, 1=canopy, 2=window/beacon)
  @location(1) norm_kind: vec4<f32>, // xyz = local normal, w = kindId (0=conifer, 1=broadleaf/xeno, 2=settlement)
};

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) world_pos: vec3<f32>,
  @location(1) norm: vec3<f32>,
  @location(2) col_emiss: vec4<f32>,
  @location(3) flora_info: vec3<f32>, // x = partId, y = kindId, z = snowWeight
};

@vertex
fn vs_main(in: VsIn, @builtin(instance_index) iid: u32) -> VsOut {
  let inst = instances[iid];
  let scale_h = inst.pos_scale.w;
  if (scale_h <= 0.01 || abs(inst.rot_kind.z - in.norm_kind.w) > 0.4) {
    var culled: VsOut;
    culled.pos = vec4<f32>(2.0, 2.0, -1.0, 1.0);
    culled.world_pos = vec3<f32>(0.0);
    culled.norm = vec3<f32>(0.0, 1.0, 0.0);
    culled.col_emiss = vec4<f32>(0.0);
    culled.flora_info = vec3<f32>(0.0);
    return culled;
  }
  let cy = cos(inst.rot_kind.x);
  let sy = sin(inst.rot_kind.x);
  let r_sc = inst.rot_kind.y * scale_h;
  let lx = in.pos_part.x * r_sc;
  let ly = in.pos_part.y * scale_h;
  let lz = in.pos_part.z * r_sc;
  let rx = lx * cy - lz * sy;
  let rz = lx * sy + lz * cy;
  // Exact live per-frame TinyPlanet spherical curvature matching generate_surface_terrain_mesh to 0.000 m!
  // cam.extra1.w = 1/(2R), cam.extra2.w = focusX, cam.em_aux.z = focusZ
  let dx_c = inst.pos_scale.x - cam.extra2.w;
  let dz_c = inst.pos_scale.z - cam.em_aux.z;
  let curv_drop = (dx_c * dx_c + dz_c * dz_c) * cam.extra1.w;
  let base_curved = vec3<f32>(inst.pos_scale.x, inst.pos_scale.y - curv_drop, inst.pos_scale.z);
  let wp = base_curved + vec3<f32>(rx, ly, rz);
  let nx = in.norm_kind.x * cy - in.norm_kind.z * sy;
  let nz = in.norm_kind.x * sy + in.norm_kind.z * cy;

  var out: VsOut;
  out.pos = apply_log_depth_vs(cam.view_proj * vec4<f32>(wp, 1.0), cam.em_aux.w);
  out.world_pos = wp;
  out.norm = normalize(vec3<f32>(nx, in.norm_kind.y, nz));
  out.col_emiss = inst.col_emiss;
  out.flora_info = vec3<f32>(in.pos_part.w, inst.rot_kind.z, inst.rot_kind.w);
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let sky_zen = cam.extra0.rgb;
  let opt_depth = clamp(cam.extra0.w, 0.0, 1.0);
  let sun_dir = normalize(cam.extra1.xyz);
  let sky_hor = cam.extra2.rgb;
  let eclipse_f = clamp(cam.em_aux.y, 0.06, 1.0);
  let sun_day = smoothstep(-0.10, 0.18, sun_dir.y) * eclipse_f;
  let twi_d = (sun_dir.y - 0.03) / 0.14;
  let sunset_w = exp(-(twi_d * twi_d)) * opt_depth * eclipse_f;

  let n = normalize(in.norm);
  let ndl = max(0.0, dot(n, sun_dir));
  let part_id = in.flora_info.x;
  let kind_id = in.flora_info.y;

  var base_col = in.col_emiss.rgb;
  var emiss = 0.0;
  if (part_id < 0.5) {
    // Trunk or structural base (kind 6 = indigenous settlement facade)
    base_col = select(vec3<f32>(0.34, 0.23, 0.15), in.col_emiss.rgb * 0.72, kind_id > 5.5);
  } else if (part_id > 1.5) {
    // Glowing habitation windows & spire beacons shine brightly at twilight & night!
    base_col = vec3<f32>(1.0, 0.86, 0.54);
    emiss = in.col_emiss.w * (0.45 + 1.45 * (1.0 - sun_day));
  } else if (kind_id < 5.5 && in.col_emiss.w > 0.05) {
    // Subtle nocturnal bioluminescence on exotic cryo-solvent / coral / buoyant kelp flora!
    emiss = in.col_emiss.w * (0.35 + 0.95 * (1.0 - sun_day));
  }

  let star_rgb_f = cam.star_light.rgb;
  let star_flux_f = clamp(cam.star_light.w, 0.14, 1.85);
  let amb_day = mix(sky_hor * 0.36 + vec3<f32>(0.05), sky_zen * 0.48 + vec3<f32>(0.06), clamp(n.y * 0.5 + 0.5, 0.0, 1.0)) * mix(vec3<f32>(1.0), star_rgb_f, 0.55) * clamp(0.26 + 0.74 * star_flux_f, 0.22, 1.40);
  let amb = mix(vec3<f32>(0.025, 0.036, 0.062), amb_day, sun_day);
  let sun_tint = mix(vec3<f32>(1.06, 1.02, 0.94), vec3<f32>(1.24, 0.56, 0.24), sunset_w * 0.65) * star_rgb_f * star_flux_f;
  var col = base_col * (amb * 0.52 + sun_tint * (ndl * 1.15 * sun_day)) + base_col * emiss;

  let dist = length(cam.cam_pos.xyz - in.world_pos);
  let horiz_dist = length(in.world_pos.xz - cam.cam_pos.xz);
  let fog_amt = clamp(1.0 - exp(-dist * mix(0.000045, 0.00028, opt_depth)), 0.0, 0.82);
  let patch_edge = smoothstep(4200.0, 5850.0, horiz_dist);
  let fog_hor = mix(vec3<f32>(0.014, 0.022, 0.044), sky_hor, sun_day) + vec3<f32>(0.96, 0.40, 0.14) * sunset_w * 0.75;
  col = mix(col, fog_hor, clamp(max(fog_amt, patch_edge), 0.0, 1.0));

  if (cam.em_sensor.z > 0.5) {
    let t_k = max(40.0, cam.em_aux.x) + select(8.0, 95.0, kind_id > 5.5);
    let rad_sig = select(0.0, 1.25, kind_id > 5.5);
    col = em_sensor_map_rgb(col, t_k, 0.0, 0.0, rad_sig, 0.0);
  }
  return vec4<f32>(col, 1.0);
}
`;

// Translucent & Glowing Volumetric FX Shader:
//   tag 5.0 = Glowing Emerald-Green Translucent Glass Bubble Dome / Shield Ripple (Fresnel rim glass!)
//   tag 6.0 = Glowing Yellow Conical Tractor Beam / 360° Rim EM Laser / Antimatter Annihilation Beam!
const TRANSLUCENT_FX_WGSL = /* wgsl */ `
${CAMERA_WGSL}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;

struct VsIn {
  @location(0) pos_curv: vec4<f32>,
  @location(1) norm_tag: vec4<f32>,
  @location(2) col_alpha: vec4<f32>,
};

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) world_pos: vec3<f32>,
  @location(1) norm: vec3<f32>,
  @location(2) col_alpha: vec4<f32>,
  @location(3) tag: f32,
};

@vertex
fn vs_main(in: VsIn) -> VsOut {
  var out: VsOut;
  out.pos = apply_log_depth_vs(cam.view_proj * vec4<f32>(in.pos_curv.xyz, 1.0), cam.em_aux.w);
  out.world_pos = in.pos_curv.xyz;
  out.norm = in.norm_tag.xyz;
  out.col_alpha = in.col_alpha;
  out.tag = in.norm_tag.w;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let n = normalize(in.norm);
  let v = normalize(cam.cam_pos.xyz - in.world_pos);
  let ndv = abs(dot(n, v));
  let fres = pow(max(0.0, 1.0 - ndv), 2.4);
  let sun_dir = normalize(vec3<f32>(0.55, 0.72, 0.42));
  let half_v = normalize(sun_dir + v);
  let spec = pow(max(0.0, abs(dot(n, half_v))), 64.0);

  if (in.tag < 5.5) {
    // Glowing emerald-green translucent glass dome bubble (bright glossy rim + transparent center!)
    let glass_col = in.col_alpha.rgb * (0.72 + 1.35 * fres) + vec3<f32>(0.78, 1.0, 0.88) * spec * 1.15;
    let alpha = clamp(in.col_alpha.a * (0.45 + 0.85 * fres + 0.45 * spec), 0.14, 0.92);
    return vec4<f32>(glass_col * alpha, alpha);
  }
  // Yellow conical tractor beam & 360° rim EM Laser / Antimatter beams (luminous soft edge falloff!)
  let beam_edge = 0.42 + 0.78 * pow(max(0.0, ndv), 0.75);
  let alpha = clamp(in.col_alpha.a * beam_edge, 0.04, 0.96);
  let glow = in.col_alpha.rgb * (1.28 + 0.55 * ndv);
  return vec4<f32>(glow * alpha, alpha);
}
`;

// Zero-copy resident GPU particle billboard renderer supporting 5 canonical ULG layouts:
//   mode 0: L0 Supergalactic TreePM (16 floats/particle) — Millennium-style filaments & superclusters
//   mode 1: L1 Flat-Rotation Spiral Galaxy (8 floats/star; vel_r.w < 0 = invisible dark-matter halo!)
//   mode 2: L3 Self-Gravitating Hydro Plasma (16 floats/parcel) — blackbody + nuclear fusion glow
//   mode 3: L6 Quantum Orbital Point Cloud (4 floats/point) — signed phase / shell parity
//   mode 4: L2 Solar System Real-Scale N-Body Asteroids & Minor Bodies (16 floats/body, f32x2 double-float!)
const PARTICLE_CLOUD_WGSL = /* wgsl */ `
${CAMERA_WGSL}
${EM_SENSOR_WGSL}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> raw_f32: array<f32>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) shape: f32, // 0 = crisp glowing star/spark, 1 = soft volumetric 3D cloud billow, 2 = CFD flow streak
  @location(3) em_sig: vec4<f32>, // x = tempK, y = uv_aur, z = xray_synch, w = radio_hi
  @location(4) em_gam: f32,       // gamma-ray pulse / 511 keV emission
};

// Exact 32-bit Murmur3 integer avalanche hash -> full 24-bit uniform [0, 1) (ZERO f32 sin() mantissa collapse!)
// Salting with independent u32 constants gives completely uncorrelated class, frequency, phase, and pulse width per star!
fn gal_hash_u32(v_in: u32) -> f32 {
  var x = v_in;
  x = (x ^ (x >> 16u)) * 0x7feb352du;
  x = (x ^ (x >> 15u)) * 0x846ca68bu;
  x = x ^ (x >> 16u);
  return f32(x & 0x00ffffffu) * (1.0 / 16777216.0);
}

fn gal_star_hash(iid: u32) -> f32 {
  return gal_hash_u32(iid ^ 0x13579bdfu);
}

fn blackbody_rgb(log10_t: f32) -> vec3<f32> {
  if (log10_t < 2.2) { return vec3<f32>(0.42, 0.24, 0.78); }
  if (log10_t < 3.45) {
    let f = clamp((log10_t - 2.2) / 1.25, 0.0, 1.0);
    return mix(vec3<f32>(0.78, 0.28, 0.14), vec3<f32>(1.0, 0.56, 0.20), f);
  }
  if (log10_t < 4.1) {
    let f = clamp((log10_t - 3.45) / 0.65, 0.0, 1.0);
    return mix(vec3<f32>(1.0, 0.62, 0.24), vec3<f32>(1.0, 0.96, 0.84), f);
  }
  let f = clamp((log10_t - 4.1) / 2.2, 0.0, 1.0);
  return mix(vec3<f32>(0.96, 0.98, 1.0), vec3<f32>(0.42, 0.78, 1.0), f);
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let uv = corners[vid % 6u];
  let mode = u32(round(cam.extra0.x));
  let world_scale = cam.extra0.y;
  let pt_size_base = cam.extra0.z;
  let alpha_gain = cam.extra0.w;

  var p_world = vec3<f32>(0.0);
  var col = vec3<f32>(0.6, 0.85, 1.0);
  var pt_size = pt_size_base;
  var alpha = alpha_gain;
  var shape = 0.0;
  var streak_axis = vec3<f32>(0.0);
  var streak_len = 0.0;

  if (mode == 0u) {
    // L0: Full 93-Gly (28,500 Mpc, R_H = 46.5 Gly) Observable-Universe Lightcone Cosmic Web!
    // Evolves a physically resolved periodic FLRW 2LPT + TreePM box (box_sz = 1,425 Mpc, dx ~ 44 Mpc),
    // tiled seamlessly via GPU instancing across a 5x5x5 spherical Observable-Universe lightcone (extra2.z = rawCount,
    // extra2.w = R_H_mpc = 14,250 Mpc) with octahedral tile symmetry (zero repeating stripes) & radial lookback redshift z(r)!
    let is_sky = world_scale < 0.0;
    let box_sz = max(10.0, cam.extra1.w);
    let raw_cnt = u32(round(max(0.0, cam.extra2.z)));
    let obs_rad = max(0.0, cam.extra2.w);
    let tiled_obs = (raw_cnt > 0u) && (obs_rad > 100.0) && !is_sky;

    var p_idx = iid;
    var cell_off = vec3<f32>(0.0);
    var tile_rot_id = 0u;
    var outer_tile_att = 1.0;
    if (tiled_obs) {
      // Distribute ALL instances UNIFORMLY across the 5x5x5 spherical Observable Universe lightcone
      // (INCLUDING center cell (0,0,0)!) so there is ZERO overexposed white blob in the center!
      let c_raw = iid % 125u;
      let tx = i32(c_raw % 5u) - 2;
      let ty = i32((c_raw / 5u) % 5u) - 2;
      let tz = i32(c_raw / 25u) - 2;
      let r2_t = tx * tx + ty * ty + tz * tz;
      if (r2_t > 5) {
        var culled_t: VsOut;
        culled_t.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
        culled_t.color = vec4<f32>(0.0);
        culled_t.uv = vec2<f32>(0.0);
        return culled_t;
      }
      p_idx = ((iid / 125u) * 19u + c_raw * 97u) % raw_cnt;
      cell_off = vec3<f32>(f32(tx), f32(ty), f32(tz));
      tile_rot_id = select(c_raw, 0u, r2_t == 0);
      outer_tile_att = select(select(0.95, 0.86, r2_t >= 2), 0.72, r2_t >= 4);
    }

    let o = p_idx * 16u;
    var raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    var raw_v = vec3<f32>(raw_f32[o + 4u], raw_f32[o + 5u], raw_f32[o + 6u]);
    if (tiled_obs && tile_rot_id > 0u) {
      // Deterministic octahedral 3D symmetry per outer lightcone cell -> organic filament network with zero grid repetition!
      let perm = tile_rot_id % 3u;
      if (perm == 1u) { raw_p = raw_p.yzx; raw_v = raw_v.yzx; }
      else if (perm == 2u) { raw_p = raw_p.zxy; raw_v = raw_v.zxy; }
      if ((tile_rot_id & 1u) != 0u) { raw_p.x = -raw_p.x; raw_v.x = -raw_v.x; }
      if ((tile_rot_id & 2u) != 0u) { raw_p.y = -raw_p.y; raw_v.y = -raw_v.y; }
      if ((tile_rot_id & 4u) != 0u) { raw_p.z = -raw_p.z; raw_v.z = -raw_v.z; }
    }
    let tile_pitch = select(box_sz, (obs_rad * 2.0) / 5.0, tiled_obs);
    let obs_pos = select(raw_p, (cell_off + raw_p / box_sz) * tile_pitch, tiled_obs);

    let a_scale = select(1.0, max(0.02, cam.extra2.x), cam.extra2.x > 0.001);
    let bb_mode = clamp(cam.extra2.y, 0.0, 1.0);
    // Exact linear FLRW metric expansion r_phys(t) = a(t) * x_comoving (no unphysical a^0.72 warp!)
    let a_expand = mix(1.0, clamp(a_scale, 0.08, 1.12), bb_mode);
    let rel_c = obs_pos - cam.extra1.xyz;
    let d_rel_c = length(rel_c);
    // Smooth spherical Observable-Universe Particle Horizon vignette at R_H = 46.5 Gly (14,250 Mpc)
    let r_hor_norm = select(length(raw_p) / max(1.0, box_sz * 0.5), length(obs_pos) / max(1.0, obs_rad), tiled_obs);
    let sphere_fade = 1.0 - smoothstep(0.84, 1.0, r_hor_norm);
    if (sphere_fade < 0.01 || (is_sky && d_rel_c < 2.0)) {
      var culled0: VsOut;
      culled0.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled0.color = vec4<f32>(0.0);
      culled0.uv = vec2<f32>(0.0);
      return culled0;
    }
    p_world = select(rel_c * (world_scale * a_expand), cam.cam_pos.xyz + (rel_c / max(1e-3, d_rel_c)) * (-world_scale), is_sky);
    let rho = clamp(raw_f32[o + 7u], 0.04, 1.0);
    let is_baryon = raw_f32[o + 12u] > 0.5;
    let col_void = vec3<f32>(0.14, 0.18, 0.62);
    let col_fil = vec3<f32>(0.18, 0.66, 1.0);
    let col_node = vec3<f32>(1.0, 0.74, 0.28);
    var c_dm = mix(col_void, col_fil, smoothstep(0.08, 0.54, rho));
    c_dm = mix(c_dm, col_node, smoothstep(0.58, 0.95, rho));
    let c_bar = mix(vec3<f32>(0.94, 0.40, 0.22), vec3<f32>(1.0, 0.82, 0.36), smoothstep(0.18, 0.90, rho));
    let sky_att = select(1.0, clamp(42.0 / (16.0 + d_rel_c), 0.35, 1.85), is_sky);
    var web_col = select(c_dm, c_bar, is_baryon) * (0.80 + 1.05 * pow(rho, 0.90));

    // Radial cosmological lookback redshift z(r) across the 93-Gly Observable Lightcone!
    //   Local z~0 (center): vivid sapphire/cyan filaments -> Cosmic Noon z~1-3 (mid): amber-gold
    //   -> Cosmic Dawn z~6-10 (outer): crimson-violet -> Planck CMB Horizon Shell (r -> R_H): glowing amber-microwave rim!
    if (tiled_obs && bb_mode < 0.5) {
      let mid_z = smoothstep(0.32, 0.72, r_hor_norm);
      let deep_z = smoothstep(0.68, 0.95, r_hor_norm);
      let cmb_rim = smoothstep(0.88, 0.99, r_hor_norm);
      web_col = mix(web_col, web_col * vec3<f32>(1.18, 0.92, 0.74), mid_z * 0.55);
      web_col = mix(web_col, vec3<f32>(0.98, 0.36, 0.46) * (0.55 + 0.85 * rho), deep_z * 0.52);
      web_col = mix(web_col, vec3<f32>(1.25, 0.68, 0.24) * (0.70 + 0.60 * rho), cmb_rim * 0.62);
    }

    // Continuous FLRW Big Bang fireball blackbody shift T(z) = 2.7255 / a(t):
    if (bb_mode > 0.5 && !is_sky) {
      let early_w = 1.0 - smoothstep(0.08, 0.58, a_scale);
      let hot_plasma = vec3<f32>(0.82, 0.94, 1.45);
      let recomb_gold = vec3<f32>(1.38, 0.86, 0.34);
      let dawn_crim = vec3<f32>(1.05, 0.32, 0.42);
      var era_col = mix(hot_plasma, recomb_gold, smoothstep(0.05, 0.18, a_scale));
      era_col = mix(era_col, dawn_crim, smoothstep(0.20, 0.42, a_scale));
      web_col = mix(web_col, era_col * (0.85 + 0.75 * rho), early_w);
    }

    col = web_col;
    pt_size = pt_size_base * (0.54 + 0.92 * pow(rho, 0.85)) * select(1.0, 0.68 + 0.52 * sky_att, is_sky) * select(1.0, 1.12, tiled_obs && tile_rot_id > 0u);
    alpha = alpha_gain * (0.28 + 0.72 * pow(rho, 0.92)) * sphere_fade * sky_att * outer_tile_att;
    if (!is_sky) {
      let v_mag = length(raw_v);
      if (bb_mode < 0.5 && v_mag > 0.65 && (iid & 3u) == 0u) {
        streak_axis = raw_v / v_mag;
        streak_len = clamp(pt_size * (1.8 + v_mag * 0.75), pt_size * 1.4, pt_size * 4.2);
        shape = 2.0;
      } else if (!is_baryon && rho > 0.42 && (iid & 1u) == 0u) {
        shape = 1.0;
        pt_size = pt_size * 1.48;
        alpha = alpha * 0.58;
      }
    }
  } else if (mode == 1u) {
    // L1: Realistic Flat-Rotation Spiral Galaxy (8 floats/star: pos, mass, vel, popTag)
    // popTag < 0 => invisible dark-matter NFW halo particle (provides REAL GPU gravity for flat rotation curve!)
    // When world_scale < 0.0, renders the LIVE 32,768-star Milky Way skyband from THIS star's exact galactocentric position!
    let o = iid * 8u;
    let pop_tag = raw_f32[o + 7u];
    let is_sky = world_scale < 0.0;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    let rel_g = raw_p - cam.extra1.xyz;
    let d_rel_g = length(rel_g);
    if (pop_tag < 0.0 || (is_sky && d_rel_g < 0.08)) {
      var culled: VsOut;
      culled.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled.color = vec4<f32>(0.0);
      culled.uv = vec2<f32>(0.0);
      return culled;
    }
    p_world = select(rel_g * world_scale, cam.cam_pos.xyz + (rel_g / max(1e-4, d_rel_g)) * (-world_scale), is_sky);
    let m = raw_f32[o + 3u];
    // pop_tag encodes astrophysical population (HDR linear colors tone-mapped cleanly via ACES!):
    //   [0.01..0.35]: warm golden-amber bulge & old disk K/M/G stars
    //   [0.35..0.78]: young blue-white spiral-arm O/B/A stars
    //   [0.78..1.10]: rose-magenta H-alpha / H II star-forming knots
    let warm_bulge = vec3<f32>(1.0, 0.68, 0.34);
    let gold_core = vec3<f32>(1.0, 0.84, 0.52);
    let ob_blue = vec3<f32>(0.42, 0.74, 1.0);
    let h2_rose = vec3<f32>(1.0, 0.32, 0.58);
    let sky_att = select(1.0, clamp(4.2 / (0.85 + d_rel_g), 0.24, 2.15), is_sky);
    if (pop_tag < 0.35) {
      let f = clamp(pop_tag / 0.35, 0.0, 1.0);
      col = mix(gold_core, warm_bulge, f);
      pt_size = pt_size_base * (0.45 + 0.55 * (1.0 - f));
      alpha = alpha_gain * (0.24 + 0.34 * (1.0 - f));
      if (!is_sky && pop_tag < 0.14 && (iid & 3u) == 0u) {
        // Soft volumetric golden bulge radiance
        shape = 1.0;
        pt_size = pt_size * 1.9;
        alpha = alpha * 0.45;
      }
    } else if (pop_tag < 0.78) {
      let f = clamp((pop_tag - 0.35) / 0.43, 0.0, 1.0);
      // Real ISM wavelength-dependent dust extinction: tau(lambda) = tau_V * (0.55 um / lambda)^1.7!
      // Dark optical spiral dust lanes physically become transparent when switched to JWST IR (1-20 um)!
      let mid_log_lam = 0.5 * (cam.em_sensor.x + cam.em_sensor.y);
      let ir_pierce = select(0.0, smoothstep(-6.05, -5.05, mid_log_lam), cam.em_sensor.z > 0.5);
      let r_gal = length(raw_p.xz);
      let arm_phi = atan2(raw_p.z, raw_p.x);
      let dust_lane = smoothstep(0.58, 0.95, sin(arm_phi * 2.0 - log(max(0.4, r_gal)) * 4.4)) * smoothstep(1.1, 4.4, r_gal) * (1.0 - smoothstep(7.5, 11.8, r_gal)) * (1.0 - ir_pierce * 0.85);
      col = mix(vec3<f32>(0.86, 0.91, 1.0), ob_blue, f) * (1.0 - dust_lane * 0.56);
      pt_size = pt_size_base * (0.44 + 0.74 * f);
      alpha = alpha_gain * (0.28 + 0.56 * f) * (1.0 - dust_lane * 0.36);
      // Subtle 4-point optical diffraction spikes on blazing young O/B supergiants!
      if (!is_sky && f > 0.74 && gal_star_hash(iid ^ 0x55aa33ccu) > 0.945) {
        shape = 3.0;
        pt_size = pt_size * 2.35;
      }
    } else {
      let f = clamp((pop_tag - 0.78) / 0.32, 0.0, 1.0);
      col = mix(h2_rose, vec3<f32>(1.0, 0.56, 0.78), f);
      pt_size = pt_size_base * (0.95 + 0.78 * f);
      alpha = alpha_gain * (0.36 + 0.44 * f);
      if (!is_sky && f > 0.45 && (iid & 3u) == 0u) {
        shape = 1.0;
        pt_size = pt_size * 1.45;
      }
    }
    if (m > 25.0) {
      // Galactic nucleus soft warm amber glow (zero giant black hole at 100 kly!)
      col = vec3<f32>(1.0, 0.88, 0.62);
      pt_size = pt_size_base * 1.8;
      alpha = alpha_gain * 0.55;
    }
    if (is_sky) {
      pt_size = pt_size * (0.65 + 0.55 * sky_att);
      alpha = alpha * sky_att;
    } else if (cam.em_sensor.z > 0.5) {
      // Multi-Wavelength Galactic Exotic Sources stand out dramatically when EM Sensor carets shift out of Optical!
      let l_min = min(cam.em_sensor.x, cam.em_sensor.y);
      let l_max = max(cam.em_sensor.x, cam.em_sensor.y);
      let in_radio = smoothstep(-2.8, -1.0, l_max);
      let in_gamma = 1.0 - smoothstep(-12.2, -10.4, l_min);
      let in_xray = smoothstep(-11.8, -10.2, l_max) * (1.0 - smoothstep(-8.8, -7.4, l_min));
      let in_uv = smoothstep(-8.2, -7.4, l_max) * (1.0 - smoothstep(-6.7, -6.2, l_min));
      let gh = gal_star_hash(iid);
      let is_pulsar = (gh > 0.986 && pop_tag >= 0.20);
      let is_xrb = (gh > 0.974 && gh <= 0.986 && pop_tag >= 0.10);
      let t_sec = cam.cam_pos.w;
      if (is_pulsar) {
        // Independent 32-bit salted hashes -> completely asynchronous per-pulsar spin frequency (0.22..4.84 Hz, 22x spread),
        // independent random initial phase [0..2pi), and distinct lighthouse beam duty width!
        let h_freq = gal_hash_u32(iid ^ 0x9e3779b9u);
        let h_phase = gal_hash_u32(iid ^ 0x517cc1b7u);
        let h_duty = gal_hash_u32(iid ^ 0x243f6a88u);
        let f_hz = 0.22 * pow(22.0, h_freq);
        let phase = h_phase * 6.2831853;
        let sharp = 6.0 + h_duty * 18.0;
        let beam = pow(max(0.0, cos(t_sec * f_hz * 6.2831853 + phase)), sharp);
        let boost_band = max(in_radio, in_gamma);
        pt_size = min(pt_size_base * 2.35, pt_size * (1.0 + boost_band * (0.95 + 1.45 * beam)));
        alpha = clamp(alpha * (0.45 + boost_band * (0.85 + 1.95 * beam)), 0.05, 1.0);
      } else if (is_xrb) {
        // Accreting Stellar-Mass Black-Hole / Neutron-Star X-Ray Binary with independent MRI QPO frequency & phase!
        let x_freq = 1.4 + gal_hash_u32(iid ^ 0x6a09e667u) * 8.2;
        let x_phase = gal_hash_u32(iid ^ 0xbb67ae85u) * 6.2831853;
        let qpo = 0.55 + 0.45 * sin(t_sec * x_freq + x_phase);
        pt_size = pt_size * (1.0 + in_xray * (1.9 + 1.4 * qpo));
        alpha = clamp(alpha * (0.60 + in_xray * (1.5 + 1.8 * qpo)), 0.05, 1.0);
      } else if (pop_tag >= 0.78) {
        // Massive OB Starburst / H II knots blaze in UV & Far-IR!
        pt_size = pt_size * (1.0 + in_uv * 1.15);
      } else {
        // Dim ordinary main-sequence stars slightly in extreme non-optical bands so pulsars & X-ray binaries pop clearly!
        let exotic_band = clamp(in_gamma + in_xray * 0.85 + in_radio * 0.45, 0.0, 0.88);
        alpha = alpha * (1.0 - exotic_band * 0.62);
      }
    }
  } else if (mode == 2u) {
    // L3: Self-Gravitating Hydro / 3D MLS-MPM Stellar Fusion Plasma (16 floats/parcel)
    // Purely physical (log_t, log_rho, log_eps) radiative-transport thermalization across
    // ALL stellar classes (1,150 K Brown Dwarf -> 3,450 K Red Supergiant -> 5,778 K G2V Sun -> 28,500 K O/B Supergiant!):
    let o = iid * 16u;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let log_t = raw_f32[o + 8u];
    let log_rho = raw_f32[o + 9u];
    let log_eps = raw_f32[o + 11u];
    let fusion_glow = smoothstep(-0.5, 4.5, log_eps);
    let dens_w = clamp((log_rho + 18.0) / 22.0, 0.15, 1.0);
    let teff_log = select(3.76, cam.extra1.w, cam.extra1.w > 2.5);
    let thick_star = smoothstep(3.05, 3.85, log_t);
    // Physical convective photosphere color driven continuously by stellar effective temperature T_eff & local thermal buoyancy!
    let t_phot = clamp(mix(teff_log, clamp(log_t - 2.35, 3.0, 4.7), 0.36), 3.0, 4.65);
    let c_bd = vec3<f32>(0.76, 0.16, 0.28);      // 1,150 K T/Y Brown Dwarf methane-ember
    let c_rsg = vec3<f32>(1.00, 0.22, 0.05);     // 3,450 K M-supergiant Betelgeuse ruby-crimson
    let c_sun = vec3<f32>(1.00, 0.72, 0.24);     // 5,778 K G2V solar amber-gold
    let c_ob = vec3<f32>(0.38, 0.74, 1.00);      // 28,500 K O/B sapphire-blue supergiant
    var phot_col = mix(c_bd, c_rsg, smoothstep(3.05, 3.48, t_phot));
    phot_col = mix(phot_col, c_sun, smoothstep(3.52, 3.82, t_phot));
    phot_col = mix(phot_col, c_ob, smoothstep(3.88, 4.38, t_phot));
    // Hot upwelling convective granules brighten toward cream/white-hot core while sinking intergranular lanes deepen!
    let env_t = clamp((log_t - 4.8) / 2.6, 0.0, 1.0);
    let core_tint = mix(vec3<f32>(1.0, 0.88, 0.62), vec3<f32>(0.78, 0.94, 1.0), smoothstep(3.85, 4.30, teff_log));
    let solar_mid = mix(phot_col * (0.72 + 0.52 * env_t), core_tint, smoothstep(0.55, 0.98, env_t) * 0.72);
    let sn_flash = smoothstep(7.7, 8.6, log_t);
    let star_col = mix(solar_mid, vec3<f32>(0.74, 0.94, 1.0), clamp(fusion_glow * 0.44 + sn_flash * 0.82, 0.0, 1.0));
    let cloud_col = mix(blackbody_rgb(log_t), vec3<f32>(0.58, 0.94, 1.0), fusion_glow * 0.55);
    col = mix(cloud_col, star_col, thick_star) * (0.94 + 0.92 * fusion_glow + 0.35 * sn_flash);
    pt_size = pt_size_base * (0.76 + 1.08 * dens_w);
    alpha = alpha_gain * (0.30 + 0.58 * dens_w);
  } else if (mode == 3u) {
    // L6: Quantum Orbital Point Cloud (4 floats/point: vec4(x, y, z, packed_meta))
    // When world_scale < 0.0, renders as a faint faraway electron-shell sky enveloping the L7 femtometer nucleus!
    let o = iid * 4u;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    let is_sky = world_scale < 0.0;
    let d_q = length(raw_p);
    if (is_sky && d_q < 0.04) {
      var culled3: VsOut;
      culled3.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled3.color = vec4<f32>(0.0);
      culled3.uv = vec2<f32>(0.0);
      return culled3;
    }
    p_world = select(raw_p * world_scale, cam.cam_pos.xyz + (raw_p / max(1e-4, d_q)) * (-world_scale), is_sky);
    let packed_meta = raw_f32[o + 3u];
    let mag = clamp(abs(packed_meta), 0.15, 1.0);
    let pos_phase = packed_meta >= 0.0;
    let c_pos = cam.extra1.rgb;
    let c_neg = cam.extra2.rgb;
    col = select(c_neg, c_pos, pos_phase) * (0.70 + 0.95 * mag);
    pt_size = pt_size_base * (0.72 + 0.55 * mag);
    alpha = alpha_gain * (0.30 + 0.70 * mag);
  } else if (mode == 13u) {
    // Mode 13: Crisp Pinpoint Hypervelocity Planetesimal Impactors & Molten Shock Sparks around Volumetric 3D SPH Protoplanet!
    // (When Live Volumetric Protoplanet is active, heavy interior bulk is ray-marched directly from the 3D SPH grid,
    //  so Mode 13 only renders fiery incoming LHB impactors & sparkling incandescent ejecta — ZERO giant polka dots!)
    let o = iid * 16u;
    let act = raw_f32[o + 15u];
    let sp = raw_f32[o + 8u];
    let shock = raw_f32[o + 11u];
    let only_impactors = cam.extra1.w > 0.5;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    let raw_v = vec3<f32>(raw_f32[o + 4u], raw_f32[o + 5u], raw_f32[o + 6u]);
    let r_p13 = length(raw_p);
    // During live volumetric protoplanet rendering, ONLY show fiery incoming space impactor meteor streaks
    // outside the crust (species == 3 && r >= 1.00) — volumetric Mode 1 already renders all 3D interior & shock glows!
    if (act < 0.5 || (only_impactors && (abs(sp - 3.0) > 0.35 || r_p13 < 1.00))) {
      var culled13: VsOut;
      culled13.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled13.color = vec4<f32>(0.0);
      culled13.uv = vec2<f32>(0.0);
      return culled13;
    }
    p_world = cam.extra1.xyz + raw_p * world_scale;
    let temp_n = clamp(raw_f32[o + 7u], 0.0, 1.0);
    let thick = raw_f32[o + 10u];
    let v_mag13 = length(raw_v);
    if (abs(sp - 3.0) < 0.3) {
      // Blazing velocity-stretched hypervelocity LHB planetesimal meteor streak!
      col = vec3<f32>(1.0, 0.86, 0.42) * (1.55 + shock * 0.5);
      pt_size = pt_size_base * 0.58;
      if (v_mag13 > 0.15) {
        streak_axis = raw_v / v_mag13;
        streak_len = clamp(pt_size * (2.6 + v_mag13 * 1.4), pt_size * 1.8, pt_size * 6.5);
        shape = 2.0;
      }
    } else if (shock >= 0.25) {
      // Glowing white-orange impact shock spark
      col = mix(vec3<f32>(1.0, 0.45, 0.08), vec3<f32>(1.0, 0.94, 0.66), clamp(shock * 0.65, 0.0, 1.0)) * 1.4;
      pt_size = pt_size_base * 0.44;
    } else if (sp < 0.5) {
      col = mix(vec3<f32>(1.0, 0.62, 0.14), vec3<f32>(1.0, 0.94, 0.68), temp_n);
      pt_size = pt_size_base * 0.52;
    } else if (abs(sp - 1.0) < 0.3) {
      col = mix(vec3<f32>(0.54, 0.18, 0.10), vec3<f32>(1.0, 0.44, 0.10), temp_n);
      pt_size = pt_size_base * 0.46;
    } else if (abs(sp - 2.0) < 0.3) {
      col = mix(vec3<f32>(0.26, 0.58, 0.34), vec3<f32>(0.84, 0.78, 0.64), clamp(thick * 0.8, 0.0, 1.0));
      pt_size = pt_size_base * 0.48;
    } else {
      col = vec3<f32>(0.14, 0.58, 0.96);
      pt_size = pt_size_base * 0.42;
    }
    alpha = alpha_gain * select(0.55, 0.95, abs(sp - 3.0) < 0.3 || shock >= 0.25);
  } else if (mode == 12u) {
    // Mode 12: Rescaled Parent L5 Crystal Lattice Skybox enveloping the L6 Quantum Atom (4 floats/atom: x,y,z,w)!
    let o = iid * 4u;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]) - cam.extra1.xyz;
    let d_l = length(raw_p);
    if (d_l < 0.25) {
      var culled12: VsOut;
      culled12.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled12.color = vec4<f32>(0.0);
      culled12.uv = vec2<f32>(0.0);
      return culled12;
    }
    let sky_r = abs(world_scale);
    p_world = cam.cam_pos.xyz + (raw_p / max(1e-4, d_l)) * sky_r;
    let att = clamp(6.0 / (1.5 + d_l), 0.25, 1.6);
    col = cam.extra2.rgb * (0.65 + 0.55 * att);
    pt_size = pt_size_base * (0.75 + 0.65 * att);
    alpha = alpha_gain * att;
    shape = 1.0;
  } else if (mode == 4u) {
    // Mode 4: L2 Real-Scale Solar System Minor Bodies / Main & Kuiper Belt Asteroids (f32x2 double-float!)
    let skip_n = u32(round(cam.extra1.w));
    if (iid < skip_n) {
      var culled: VsOut;
      culled.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled.color = vec4<f32>(0.0);
      culled.uv = vec2<f32>(0.0);
      return culled;
    }
    let o = iid * 16u;
    let dx = (raw_f32[o + 0u] - cam.extra1.x) + (raw_f32[o + 4u] - cam.extra2.x);
    let dy = (raw_f32[o + 1u] - cam.extra1.y) + (raw_f32[o + 5u] - cam.extra2.y);
    let dz = (raw_f32[o + 2u] - cam.extra1.z) + (raw_f32[o + 6u] - cam.extra2.z);
    p_world = vec3<f32>(dx, dy, dz) * world_scale;
    let kind_f = raw_f32[o + 11u];
    col = select(vec3<f32>(0.78, 0.70, 0.56), vec3<f32>(0.54, 0.76, 1.0), kind_f > 6.5);
    pt_size = pt_size_base;
    alpha = alpha_gain * 0.75;
  } else if (mode == 5u) {
    // Mode 5: L3 3D Self-Gravitating Resistive MHD Nebular Collapse & Magnetocentrifugal Bipolar Jets!
    let o = iid * 16u;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let b_mag = raw_f32[o + 7u];
    let rho = raw_f32[o + 11u];
    let u_int = raw_f32[o + 12u];
    let jet_out = raw_f32[o + 13u];
    let dens_f = clamp(log(1.0 + rho * 2.8) * 0.58, 0.0, 1.0);
    let jet_f = smoothstep(0.04, 0.45, jet_out) * smoothstep(0.05, 0.35, b_mag);
    let mag_f = clamp(b_mag * 0.72, 0.0, 1.0);
    // Warm dusty molecular cloud & golden collapsing accretion disk -> electric cyan/violet MHD jet plasma!
    let dust_col = mix(vec3<f32>(0.76, 0.28, 0.32), vec3<f32>(1.0, 0.64, 0.20), dens_f);
    let core_col = mix(dust_col, vec3<f32>(1.0, 0.92, 0.66), smoothstep(0.45, 0.95, dens_f + u_int * 0.22));
    let jet_col = mix(vec3<f32>(0.24, 0.82, 1.0), vec3<f32>(0.76, 0.46, 1.0), mag_f);
    col = mix(core_col, jet_col * 1.55, clamp(jet_f * 0.90 + mag_f * 0.18 * (1.0 - dens_f), 0.0, 1.0));
    pt_size = pt_size_base * (0.58 + 0.82 * dens_f + 0.75 * jet_f);
    alpha = alpha_gain * (0.26 + 0.56 * dens_f + 0.62 * jet_f);
  } else if (mode == 6u) {
    // Mode 6: L2 Volumetric Swirling Protoplanetary Accretion Disk (velocity-aligned Keplerian spiral streaks +
    // soft translucent nebula gas mist + shock-heated glowing protoplanet cores — ZERO grainy static dots!)
    let o = iid * 16u;
    let is_live = raw_f32[o + 15u];
    if (is_live < 0.5 || raw_f32[o + 3u] <= 0.0) {
      var culled6: VsOut;
      culled6.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled6.color = vec4<f32>(0.0);
      culled6.uv = vec2<f32>(0.0);
      return culled6;
    }
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    let raw_v = vec3<f32>(raw_f32[o + 4u], raw_f32[o + 5u], raw_f32[o + 6u]);
    let r_au6 = max(0.02, raw_f32[o + 11u]);
    let r_xz6 = max(1e-4, length(raw_p.xz));
    // Continuous radial morphism from log-radial disk overview (blend=0) -> exact 1:1 physical linear AU (blend=1)!
    let au_blend = clamp(cam.extra1.w, 0.0, 1.0);
    let au_scale = max(0.0, cam.extra2.x);
    let r_log_w = r_xz6 * world_scale;
    let r_lin_w = r_au6 * au_scale;
    let r_eff_w = select(r_log_w, mix(r_log_w, r_lin_w, au_blend), au_scale > 1e-6);
    let xz_dir = raw_p.xz / r_xz6;
    let y_eff_w = raw_p.y * (r_eff_w / r_xz6);
    p_world = vec3<f32>(xz_dir.x * r_eff_w, y_eff_w, xz_dir.y * r_eff_w) - cam.extra1.xyz;
    let temp_k = raw_f32[o + 8u];
    let ice_f = clamp(raw_f32[o + 9u], 0.0, 1.0);
    let gas_env = clamp(raw_f32[o + 10u], 0.0, 1.0);
    let r_vis6 = length(raw_p.xz);
    let hot_t = clamp((temp_k - 180.0) / 720.0, 0.0, 1.0);
    let shock_flare = smoothstep(550.0, 1350.0, temp_k);
    // Warm incandescent silicate/Fe inner nebula -> pearl-turquoise snow-line mist -> deep sapphire-violet Kuiper haze
    let inner_col = mix(vec3<f32>(0.88, 0.36, 0.12), vec3<f32>(1.0, 0.84, 0.46), hot_t);
    let snow_col = vec3<f32>(0.42, 0.84, 1.0);
    let outer_col = mix(vec3<f32>(0.18, 0.42, 0.88), vec3<f32>(0.54, 0.78, 1.0), smoothstep(0.9, 5.2, r_vis6));
    var neb_col = mix(inner_col, mix(snow_col, outer_col, smoothstep(0.35, 0.92, ice_f)), smoothstep(0.08, 0.82, ice_f));
    neb_col = mix(neb_col, vec3<f32>(1.0, 0.95, 0.78) * 1.45, shock_flare * 0.65 + gas_env * 0.35);
    col = neb_col;
    let v_mag6 = length(raw_v);
    let is_mist = (iid & 3u) == 0u;
    if (is_mist) {
      // Soft luminous translucent volumetric gas/dust cloud layer weaving spiral arms together!
      shape = 1.0;
      pt_size = pt_size_base * (3.2 + 1.8 * ice_f);
      alpha = alpha_gain * (0.095 + 0.08 * (1.0 - ice_f * 0.35) + 0.08 * shock_flare);
    } else if (v_mag6 > 0.25) {
      // Fine silky velocity-aligned Keplerian plasma & pebble orbital streams!
      shape = 2.0;
      streak_axis = raw_v / v_mag6;
      pt_size = pt_size_base * (0.50 + 0.32 * shock_flare);
      streak_len = clamp(pt_size * (3.6 + v_mag6 * 0.72), pt_size * 2.8, pt_size * 7.2);
      alpha = alpha_gain * (0.16 + 0.22 * shock_flare + 0.14 * (1.0 - ice_f * 0.35));
    } else {
      pt_size = pt_size_base * 0.62;
      alpha = alpha_gain * 0.22;
    }
  } else if (mode == 7u) {
    // Mode 7: Relativistic Kerr/BZ Jet (real camera-angle Doppler beaming!), Magnetar Flares/Pulsar Beams, & BNS Kilonova r-Process Ejecta!
    let o = iid * 16u;
    let is_live = raw_f32[o + 15u];
    if (is_live < 0.5) {
      var culled7: VsOut;
      culled7.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled7.color = vec4<f32>(0.0);
      culled7.uv = vec2<f32>(0.0);
      return culled7;
    }
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let role = raw_f32[o + 3u];
    let vel = vec3<f32>(raw_f32[o + 4u], raw_f32[o + 5u], raw_f32[o + 6u]);
    let gamma = max(1.0, raw_f32[o + 7u]);
    let t_norm = clamp(raw_f32[o + 8u], 0.0, 2.0);
    let aux_ye = raw_f32[o + 9u];
    let emiss = clamp(raw_f32[o + 10u], 0.0, 2.6);
    // Live relativistic Doppler beaming factor delta = 1 / (Gamma * (1 - beta * cos(theta)))!
    // Orbiting into a Quasar jet cone naturally boosts it into a blazing blue-white Blazar!
    let to_obs = normalize(cam.cam_pos.xyz - p_world);
    let v_mag = length(vel);
    let beta = sqrt(max(0.0, 1.0 - 1.0 / (gamma * gamma)));
    let cos_th = select(0.0, dot(vel / v_mag, to_obs), v_mag > 1e-4);
    let doppler = clamp(1.0 / max(0.28, gamma * (1.0 - min(0.88, beta) * cos_th)), 0.35, 3.2);
    let beam_boost = mix(1.0, pow(doppler, 1.35), smoothstep(1.15, 2.5, gamma));
    if (role > 0.5 && role < 1.5) {
      // Relativistic BZ Jet / Polar Lighthouse Beam / Blue Polar Kilonova Wind
      col = mix(vec3<f32>(0.24, 0.72, 1.0), vec3<f32>(0.88, 0.96, 1.0), clamp(beam_boost * 0.45, 0.0, 1.0)) * (0.9 + 0.85 * emiss) * beam_boost;
      pt_size = pt_size_base * (0.65 + 0.55 * min(2.0, beam_boost));
      alpha = alpha_gain * clamp(0.32 + 0.48 * emiss * min(1.8, beam_boost), 0.05, 0.95);
    } else if (role >= 1.5) {
      // Red Lanthanide r-Process Kilonova / Magnetar Giant Flare Fireball / Dusty Torus
      let is_red_rproc = aux_ye > 0.01 && aux_ye < 0.25;
      let base_c = select(
        mix(vec3<f32>(0.92, 0.34, 0.72), vec3<f32>(1.0, 0.86, 0.42), clamp(t_norm * 0.65, 0.0, 1.0)),
        mix(vec3<f32>(0.96, 0.26, 0.14), vec3<f32>(1.0, 0.70, 0.26), clamp(t_norm * 0.7, 0.0, 1.0)),
        is_red_rproc
      );
      col = base_c * (0.75 + 0.95 * emiss);
      pt_size = pt_size_base * (0.82 + 0.65 * clamp(emiss * 0.5, 0.0, 1.0));
      alpha = alpha_gain * clamp(0.26 + 0.52 * emiss, 0.05, 0.92);
    } else {
      // Novikov-Thorne Hot Kerr Accretion Disk / Twisted Magnetosphere Loops
      let disk_c = mix(vec3<f32>(1.0, 0.42, 0.14), vec3<f32>(0.94, 0.96, 1.0), clamp(t_norm * 0.75, 0.0, 1.0));
      col = disk_c * (0.8 + 0.7 * emiss) * mix(1.0, doppler, 0.45);
      pt_size = pt_size_base * (0.62 + 0.52 * min(1.5, t_norm));
      alpha = alpha_gain * clamp(0.30 + 0.48 * emiss, 0.06, 0.88);
    }
  } else if (mode == 8u) {
    // Mode 8: Photoionized / Reflection / Wolf-Rayet Nebulae + Embedded Protostars + Dual-Tail Comets!
    // Real ISM wavelength-dependent dust optical depth tau(lambda) = tau_V * (0.55 um / lambda)^1.7:
    // Switching Optical -> JWST IR physically turns dusty Pillars of Creation translucent and reveals
    // blazing embedded fiery ruby protostars & collimated Herbig-Haro outflow jets inside!
    let o = iid * 16u;
    let is_live = raw_f32[o + 15u];
    if (is_live < 0.5) {
      var culled8: VsOut;
      culled8.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled8.color = vec4<f32>(0.0);
      culled8.uv = vec2<f32>(0.0);
      return culled8;
    }
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    let raw_v8 = vec3<f32>(raw_f32[o + 4u], raw_f32[o + 5u], raw_f32[o + 6u]);
    let sp_tag = raw_f32[o + 3u];
    let is_comet_tail = cam.extra1.w > 0.5;
    p_world = select((raw_p - cam.extra1.xyz) * world_scale, cam.extra1.xyz + raw_p * world_scale, is_comet_tail);
    let ha = clamp(raw_f32[o + 8u], 0.0, 2.0);
    let o3 = clamp(raw_f32[o + 9u], 0.0, 2.0);
    let s2_dust = clamp(raw_f32[o + 10u], 0.0, 2.0);
    let mid_log_lam8 = 0.5 * (cam.em_sensor.x + cam.em_sensor.y);
    let ir_pierce8 = select(0.0, smoothstep(-6.05, -5.05, mid_log_lam8), cam.em_sensor.z > 0.5);
    let c_ha = vec3<f32>(1.0, 0.28, 0.44) * ha;
    let c_o3 = vec3<f32>(0.16, 0.88, 1.0) * o3;
    let c_s2 = vec3<f32>(1.0, 0.72, 0.28) * s2_dust;
    let tot = max(0.12, ha + o3 + s2_dust);
    col = (c_ha + c_o3 + c_s2) * (0.95 / pow(tot, 0.28));
    if (is_comet_tail) {
      // Crisp Rosetta-style velocity-stretched sublimation gas & dust tail filaments (ZERO bokeh dots over nucleus!)
      let r_com = length(raw_p);
      let nuc_clear = smoothstep(0.32, 0.88, r_com);
      let v8_mag = length(raw_v8);
      if (nuc_clear < 0.03) {
        var culled8c: VsOut;
        culled8c.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
        culled8c.color = vec4<f32>(0.0);
        culled8c.uv = vec2<f32>(0.0);
        return culled8c;
      }
      if (v8_mag > 0.15) {
        shape = 2.0;
        streak_axis = raw_v8 / v8_mag;
        pt_size = pt_size_base * (0.55 + 0.55 * min(1.2, tot));
        streak_len = clamp(pt_size * (4.5 + v8_mag * 1.4), pt_size * 3.5, pt_size * 10.0);
      } else {
        shape = 1.0;
        pt_size = pt_size_base * 1.1;
      }
      alpha = alpha_gain * nuc_clear * clamp(0.14 + 0.34 * min(1.4, tot), 0.03, 0.65);
    } else if (sp_tag > 3.5) {
      // Embedded protostars & Herbig-Haro jets veiled in optical dust, blazing in JWST IR!
      let vis_veil = mix(0.24, 1.95, ir_pierce8);
      col = mix(vec3<f32>(1.0, 0.34, 0.16), vec3<f32>(1.0, 0.88, 0.56), ir_pierce8) * vis_veil;
      pt_size = pt_size_base * mix(0.65, 2.35, ir_pierce8);
      alpha = alpha_gain * clamp(mix(0.20, 1.45, ir_pierce8), 0.06, 1.0);
      shape = select(0.0, 3.0, ir_pierce8 > 0.35);
    } else if (sp_tag < 0.5) {
      // Dense molecular dust pillar column: opaque sculpted silhouettes in optical, translucent warm PAH veil in JWST IR!
      col = col * mix(0.68, 0.95, ir_pierce8);
      pt_size = pt_size_base * (0.95 + 0.75 * min(1.4, tot)) * mix(1.35, 1.05, ir_pierce8);
      alpha = alpha_gain * clamp(0.32 + 0.52 * min(1.5, tot), 0.05, 0.90) * mix(1.0, 0.42, ir_pierce8);
      shape = 1.0;
    } else {
      pt_size = pt_size_base * (0.85 + 0.72 * min(1.5, tot)) * 1.25;
      alpha = alpha_gain * clamp(0.24 + 0.56 * min(1.5, tot), 0.05, 0.90);
      shape = 1.0;
    }
  } else if (mode == 9u) {
    // Mode 9: Roche-Limit Tidal Disruption Debris, Shepherd-Moon Rings, Giant Impact Ejecta, & Cryovolcanic Ice Plumes!
    let o = iid * 16u;
    let is_live = raw_f32[o + 15u];
    if (is_live < 0.5) {
      var culled9: VsOut;
      culled9.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled9.color = vec4<f32>(0.0);
      culled9.uv = vec2<f32>(0.0);
      return culled9;
    }
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let intact = raw_f32[o + 7u];
    let t_norm = clamp(raw_f32[o + 8u], 0.0, 2.0);
    let role = raw_f32[o + 10u];
    if (role > 1.5 && role < 2.5) {
      // Cryovolcanic icy water-vapor plume crystals
      col = vec3<f32>(0.68, 0.92, 1.0) * (0.85 + 0.45 * t_norm);
      pt_size = pt_size_base * 0.85;
      alpha = alpha_gain * 0.58;
    } else if (t_norm > 0.72) {
      // Incandescent molten silicate Giant-Impact / Red-Giant engulfment debris
      col = mix(vec3<f32>(0.96, 0.34, 0.10), vec3<f32>(1.0, 0.88, 0.48), clamp((t_norm - 0.72) * 1.1, 0.0, 1.0));
      pt_size = pt_size_base * (0.78 + 0.45 * min(1.2, t_norm));
      alpha = alpha_gain * 0.72;
    } else {
      // Icy/rocky Roche ring & rubble-pile particles
      col = mix(vec3<f32>(0.88, 0.80, 0.66), vec3<f32>(0.76, 0.88, 1.0), select(0.25, 0.75, intact > 0.5));
      pt_size = pt_size_base * select(0.65, 0.95, intact > 0.5);
      alpha = alpha_gain * 0.64;
    }
  } else if (mode == 10u) {
    // Mode 10: Cosmological Baryon & Radiation (CMB ΔT/T Shell, Reionization H II Bubbles, & Galaxy Cluster X-Ray ICM + DM!)
    let o = iid * 16u;
    let raw_p = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    p_world = (raw_p - cam.extra1.xyz) * world_scale;
    let rho = clamp(raw_f32[o + 7u], 0.05, 6.0);
    let temp_k = raw_f32[o + 8u];
    let x_hii = clamp(raw_f32[o + 9u], 0.0, 1.0);
    let sz_dt = raw_f32[o + 10u];
    let is_dm = raw_f32[o + 11u] > 0.5;
    let flags = u32(round(raw_f32[o + 14u]));
    if ((flags & 1u) != 0u) {
      // CMB Recombination Acoustic Surface (authentic Planck cold-indigo -> deep-teal -> amber-gold -> vermilion ΔT/T!)
      let f = clamp(sz_dt * 0.56 + 0.5, 0.0, 1.0);
      let c_cold = vec3<f32>(0.04, 0.18, 0.88);
      let c_teal = vec3<f32>(0.10, 0.62, 0.72);
      let c_warm = vec3<f32>(0.96, 0.74, 0.18);
      let c_hot  = vec3<f32>(0.95, 0.26, 0.06);
      if (f < 0.35) {
        col = mix(c_cold, c_teal, f / 0.35);
      } else if (f < 0.68) {
        col = mix(c_teal, c_warm, (f - 0.35) / 0.33);
      } else {
        col = mix(c_warm, c_hot, (f - 0.68) / 0.32);
      }
      pt_size = pt_size_base * 1.05;
      alpha = alpha_gain * 0.72;
    } else if ((flags & 2u) != 0u) {
      // Cosmic Dawn Reionization: Neutral dark-crimson HI web vs glowing electric-cyan H II ionization bubbles!
      let c_hi = vec3<f32>(0.48, 0.12, 0.34);
      let c_hii = vec3<f32>(0.10, 0.82, 1.0);
      let c_pop3 = vec3<f32>(1.0, 0.86, 0.44);
      col = mix(c_hi, c_hii, smoothstep(0.08, 0.72, x_hii));
      col = mix(col, c_pop3, smoothstep(0.84, 0.99, x_hii));
      pt_size = pt_size_base * (0.62 + 0.75 * x_hii);
      alpha = alpha_gain * (0.24 + 0.68 * x_hii);
    } else {
      // Bullet-Cluster Galaxy Cluster Merger: Vivid Magenta-Rose X-Ray Shocked ICM vs Deep Electric-Blue DM Lensing Halos!
      let x_em = clamp(log(1.0 + max(0.0, temp_k * 1e-7) * rho) * 0.55, 0.15, 1.15);
      col = select(
        mix(vec3<f32>(0.96, 0.16, 0.48), vec3<f32>(1.0, 0.62, 0.24), clamp(x_em * 0.65, 0.0, 1.0)),
        vec3<f32>(0.14, 0.48, 1.0) * (0.75 + 0.55 * min(1.3, rho * 0.35)),
        is_dm
      );
      pt_size = pt_size_base * select(0.75 + 0.48 * min(1.1, x_em), 1.05, is_dm);
      alpha = alpha_gain * select(0.32 + 0.45 * min(1.0, x_em), 0.72, is_dm);
    }
  } else {
    // Mode 11: Planetary Surface Jump-Rocket Exhaust Flames, Ballistic Regolith Dust, & Drone Rotor Downwash!
    let o = iid * 16u;
    let is_live = raw_f32[o + 15u];
    if (is_live < 0.05) {
      var culled11: VsOut;
      culled11.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      culled11.color = vec4<f32>(0.0);
      culled11.uv = vec2<f32>(0.0);
      return culled11;
    }
    var rp = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]);
    let role = raw_f32[o + 3u];
    // Apply exact TinyPlanet spherical curvature drop to surface plumes (roles 0..2);
    // keep 3D volumetric atmospheric CFD cloud strata & vortex tracers (roles 3..4) in true 3D space!
    if (role < 2.5) {
      let dx_c = rp.x - cam.extra1.x;
      let dz_c = rp.z - cam.extra1.z;
      rp.y = rp.y - (dx_c * dx_c + dz_c * dz_c) * cam.extra1.w;
    }
    p_world = rp * world_scale;
    let age = raw_f32[o + 7u];
    let base_rgb = vec3<f32>(raw_f32[o + 8u], raw_f32[o + 9u], raw_f32[o + 10u]);
    let max_life = max(0.15, raw_f32[o + 11u]);
    let sz = max(0.10, raw_f32[o + 12u]);
    let life_f = clamp(age / max_life, 0.0, 1.0);
    let fade = (1.0 - life_f) * smoothstep(0.0, 0.08, life_f + 0.04);
    if (role < 0.5) {
      // Blazing jump-rocket exhaust: cyan-white hot Mach diamond core -> incandescent orange tail!
      let flame_c = mix(vec3<f32>(0.90, 0.96, 1.0), vec3<f32>(1.0, 0.40, 0.06), clamp(life_f * 2.1, 0.0, 1.0));
      col = flame_c * (2.1 - 0.9 * life_f);
      pt_size = pt_size_base * sz * (0.72 + 1.15 * life_f);
      alpha = alpha_gain * fade * 0.36;
    } else if (role < 1.5) {
      // Sunlit ballistic regolith / dust plume (gentle additive weight so dust never blows out to pure white!)
      col = base_rgb * (0.48 + 0.22 * (1.0 - life_f));
      pt_size = pt_size_base * sz * (0.48 + 0.92 * life_f);
      alpha = alpha_gain * fade * 0.052;
    } else if (role < 2.5) {
      // Subtle drone rotor downwash dust ring & fine wind-blown atmospheric motes!
      col = base_rgb * 0.52;
      pt_size = pt_size_base * sz * (0.42 + 0.55 * life_f);
      alpha = alpha_gain * fade * 0.068;
    } else if (role < 3.5) {
      // 3D Volumetric Atmospheric CFD Cloud Strata Bank (sculpted sunlit overhead cumulus/NH3/NH4SH billows — never additive whiteout!)
      let puff_fade = sin(clamp(life_f, 0.0, 1.0) * 3.1415926);
      let d_cam = length(p_world - cam.cam_pos.xyz);
      let near_fade = smoothstep(22.0, 62.0, d_cam);
      col = base_rgb * 0.68;
      pt_size = pt_size_base * sz * 1.48 * (0.85 + 0.25 * puff_fade);
      alpha = alpha_gain * is_live * (0.35 + 0.45 * puff_fade) * near_fade * 0.078;
      shape = 1.0;
    } else {
      // Sleek Translucent Velocity-Aligned 3D CFD Flow Ribbon / Eddy Streamline!
      let s_fade = sin(clamp(life_f, 0.0, 1.0) * 3.1415926);
      let v_raw = vec3<f32>(raw_f32[o + 4u], raw_f32[o + 5u], raw_f32[o + 6u]);
      let v_mag = length(v_raw);
      col = base_rgb * 0.96;
      pt_size = pt_size_base * max(0.24, sz * 0.36);
      alpha = alpha_gain * is_live * (0.32 + 0.68 * s_fade) * 0.34;
      if (v_mag > 0.12) {
        streak_axis = v_raw / v_mag;
        streak_len = clamp(v_mag * 0.28, 1.1, 4.2);
        shape = 2.0;
      }
    }
  }

  var world_corner: vec3<f32>;
  if (shape > 1.5 && shape < 2.5) {
    // Orient billboard cleanly along projected 3D CFD velocity vector so airflow curves visually in 3D!
    let to_cam = normalize(cam.cam_pos.xyz - p_world);
    let side = normalize(cross(streak_axis, to_cam) + vec3<f32>(0.0, 1e-4, 0.0));
    world_corner = p_world
      + streak_axis * (uv.x * streak_len)
      + side * (uv.y * pt_size * 0.42);
  } else {
    // Clamp non-sky particle billboard radius vs camera distance so a star passing right past the lens
    // never explodes into a screen-filling blob!
    let d_cam_p = length(p_world - cam.cam_pos.xyz);
    let safe_pt_sz = select(min(pt_size, max(0.015, d_cam_p * 0.085)), pt_size, world_scale < 0.0 || (shape > 0.5 && shape < 1.5));
    world_corner = p_world
      + cam.cam_right.xyz * (uv.x * safe_pt_sz)
      + cam.cam_up.xyz * (uv.y * safe_pt_sz);
  }
  let clip_raw = cam.view_proj * vec4<f32>(world_corner, 1.0);
  var clip = apply_log_depth_vs(clip_raw, cam.em_aux.w);
  // True celestial backdrop starfield sits at farthest reversed-Z infinity just behind true-metric planets/suns!
  if (world_scale < 0.0 && clip.w > 0.0) {
    clip.z = 1.0e-6 * clip.w;
  }

  var out: VsOut;
  out.pos = clip;
  out.color = vec4<f32>(col, alpha);
  out.uv = uv;
  out.shape = shape;
  // Physical EM spectral signature per cosmological/astrophysical particle layout!
  var em_t = 3200.0;
  var em_uv = 0.0;
  var em_xr = 0.0;
  var em_rad = 0.0;
  var em_gam = 0.0;
  if (mode == 0u) {
    let o0 = iid * 16u;
    let is_bar = raw_f32[o0 + 12u] > 0.5;
    let rho0 = clamp(raw_f32[o0 + 7u], 0.04, 1.0);
    em_t = select(2.725, 4.0e6 * (0.2 + rho0), is_bar);
    em_xr = select(0.0, rho0 * 1.4, is_bar);
    em_rad = select(0.04 * rho0, 0.75 * rho0, is_bar);
  } else if (mode == 1u) {
    let o1 = iid * 8u;
    let pt1 = raw_f32[o1 + 7u];
    let m1 = raw_f32[o1 + 3u];
    let gh = gal_star_hash(iid);
    let is_pulsar = (gh > 0.986 && pt1 >= 0.20);
    let is_xrb = (gh > 0.974 && gh <= 0.986 && pt1 >= 0.10);
    let t_sec = cam.cam_pos.w;
    if (m1 > 25.0) {
      // Central SMBH Sgr A* relativistic core: bright Radio synchrotron + X-Ray + Gamma!
      em_t = 3.5e7; em_uv = 1.8; em_xr = 4.2; em_rad = 4.8; em_gam = 3.5;
    } else if (is_pulsar) {
      let h_freq = gal_hash_u32(iid ^ 0x9e3779b9u);
      let h_phase = gal_hash_u32(iid ^ 0x517cc1b7u);
      let h_duty = gal_hash_u32(iid ^ 0x243f6a88u);
      let f_hz = 0.22 * pow(22.0, h_freq);
      let phase = h_phase * 6.2831853;
      let sharp = 6.0 + h_duty * 18.0;
      let beam = pow(max(0.0, cos(t_sec * f_hz * 6.2831853 + phase)), sharp);
      em_t = 8.0e5;
      em_rad = 1.4 + 10.5 * beam;
      em_gam = 1.2 + 9.2 * beam;
      em_xr = 0.4 + 2.0 * beam;
    } else if (is_xrb) {
      let x_freq = 1.4 + gal_hash_u32(iid ^ 0x6a09e667u) * 8.2;
      let x_phase = gal_hash_u32(iid ^ 0xbb67ae85u) * 6.2831853;
      let qpo = 0.55 + 0.45 * sin(t_sec * x_freq + x_phase);
      em_t = 2.2e7;
      em_xr = 5.5 + 4.0 * qpo;
      em_uv = 1.6;
      em_rad = 0.75 * qpo;
    } else {
      em_t = select(select(3800.0, 14000.0, pt1 >= 0.35), 42000.0, pt1 >= 0.78);
      em_uv = select(select(0.06, 0.95, pt1 >= 0.35), 3.4, pt1 >= 0.78);
      // 21 cm neutral Hydrogen (H I) spiral arms & cold molecular dust filaments!
      let rp1 = vec2<f32>(raw_f32[o1], raw_f32[o1 + 2u]);
      let r_g1 = length(rp1);
      let phi1 = atan2(rp1.y, rp1.x);
      let hi_arm = smoothstep(0.35, 0.92, sin(phi1 * 2.0 - log(max(0.4, r_g1)) * 4.4)) * smoothstep(1.0, 4.0, r_g1);
      em_rad = select(0.45 + 1.45 * hi_arm, 0.25 + 0.65 * hi_arm, pt1 >= 0.78);
    }
  } else if (mode == 2u) {
    let o2 = iid * 16u;
    let lt2 = clamp(raw_f32[o2 + 8u], 1.5, 8.2);
    em_t = pow(10.0, lt2);
    em_uv = smoothstep(3.8, 5.4, lt2) * 1.2;
    em_xr = smoothstep(5.8, 7.6, lt2) * 1.8;
  } else if (mode == 7u) {
    em_t = 1.2e7;
    em_xr = 1.65;
    em_rad = 1.45; // Relativistic synchrotron jet & hot Kerr disk!
    em_gam = 1.15;
  } else if (mode == 8u) {
    let o8 = iid * 16u;
    let sp8 = raw_f32[o8 + 3u];
    em_t = select(select(11000.0, 185.0, sp8 < 0.5), 1850.0, sp8 > 3.5);
    em_uv = select(0.95, 0.12, sp8 < 0.5);
    em_xr = select(0.15, 0.85, sp8 > 1.5 && sp8 < 2.5);
    em_rad = select(0.35, 1.25, sp8 < 0.5);
  } else if (mode == 9u) {
    let o9 = iid * 16u;
    let tn9 = clamp(raw_f32[o9 + 8u], 0.1, 2.0);
    em_t = 350.0 + tn9 * 95000.0;
    em_uv = smoothstep(0.7, 1.8, tn9) * 1.4;
    em_xr = smoothstep(1.1, 1.9, tn9) * 2.2;
  } else if (mode == 10u) {
    let o10 = iid * 16u;
    let flags10 = u32(round(raw_f32[o10 + 14u]));
    if ((flags10 & 1u) != 0u) {
      em_t = 2.725 + raw_f32[o10 + 10u] * 0.25;
      em_rad = 0.2;
    } else if ((flags10 & 2u) != 0u) {
      em_t = 9000.0 * clamp(raw_f32[o10 + 9u], 0.02, 1.0);
      em_rad = 1.35 * (1.0 - clamp(raw_f32[o10 + 9u], 0.0, 1.0)); // 21cm neutral HI cosmic dawn!
      em_uv = clamp(raw_f32[o10 + 9u], 0.0, 1.0) * 1.3;
    } else {
      let dm10 = raw_f32[o10 + 11u] > 0.5;
      em_t = select(max(1e6, raw_f32[o10 + 8u]), 2.725, dm10);
      em_xr = select(1.85, 0.0, dm10);
    }
  } else if (mode == 11u) {
    em_t = max(80.0, cam.em_aux.x) + select(0.0, 1600.0, shape < 0.5);
  }
  out.em_sig = vec4<f32>(em_t, em_uv, em_xr, em_rad);
  out.em_gam = em_gam;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.uv, in.uv);
  if (r2 > 1.0) { discard; }
  var w: f32;
  var rgb = in.color.rgb;
  if (in.shape > 2.5) {
    // Crisp 4-point Hubble/JWST optical diffraction spikes around blazing O/B supergiants & embedded IR protostars!
    let core_s = exp(-28.0 * r2) * 1.35;
    let sp_x = exp(-abs(in.uv.y) * 26.0) * exp(-abs(in.uv.x) * 2.8) * 0.62;
    let sp_y = exp(-abs(in.uv.x) * 26.0) * exp(-abs(in.uv.y) * 2.8) * 0.62;
    let halo_s = exp(-5.0 * r2) * 0.25;
    w = core_s + sp_x + sp_y + halo_s;
  } else if (in.shape > 1.5) {
    // Sleek glowing 3D aerodynamic CFD streamline ribbon!
    let core_y = exp(-7.5 * in.uv.y * in.uv.y);
    let tip_x = max(0.0, 1.0 - in.uv.x * in.uv.x);
    w = core_y * tip_x * 1.15;
  } else if (in.shape > 0.5) {
    // Sculpted volumetric 3D cloud billow: warm sunlit tops + cooler shaded underside + organic lobe edge!
    let lobe = 0.88 + 0.12 * sin(in.uv.x * 5.2 + in.uv.y * 3.1) * cos(in.uv.y * 4.7 - in.uv.x * 2.4);
    let soft = max(0.0, 1.0 - r2 * lobe);
    w = soft * soft * 0.76;
    let top_sun = clamp(in.uv.y * 0.45 + 0.62, 0.38, 1.14);
    let cloud_tint = mix(vec3<f32>(0.72, 0.78, 0.88), vec3<f32>(1.06, 1.02, 0.96), clamp(in.uv.y * 0.5 + 0.5, 0.0, 1.0));
    rgb = rgb * cloud_tint * top_sun;
  } else {
    let core = exp(-6.2 * r2);
    let halo = exp(-2.2 * r2) * 0.28;
    w = core + halo;
  }
  rgb = em_sensor_map_rgb(rgb, in.em_sig.x, in.em_sig.y, in.em_sig.z, in.em_sig.w, in.em_gam);
  return vec4<f32>(rgb * w * in.color.a, in.color.a * w);
}
`;

// Photorealistic analytical depth-correct ray-sphere lit shader:
//   - Multi-octave 3D Value/Gradient FBM terrain, oceans, clouds, polar caps, & Rayleigh atmosphere
//   - True physical radii + subtle telescopic pinpoint albedo glint ONLY when disk < ~2.5 px!
//   - True 3D octant cutaway for GPU-solved hydrostatic planetary interiors
//   - Crisp metallic/ruby-amber proton & cool-silver neutron spheres for L7 quantized nucleons
const LIT_SPHERE_WGSL = /* wgsl */ `
${CAMERA_WGSL}
${EM_SENSOR_WGSL}

// 5 vec4s (80 bytes) per sphere instance:
//   pos_r:  vec4(x, y, z, true_radius)
//   color0: vec4(r, g, b, kind)   kind: 0=star, 1=terrestrial/ocean/rocky, 2=gas-giant/haze, 3=ice/moon, 4=cutaway-planet, 5=black-hole/nucleus, 6=nucleon, 7=magma
//   color1: vec4(r2, g2, b2, atm_strength)
//   params: vec4(r_core_norm, r_mantle_norm, cutaway_active, seed)
//   sp_info: vec4(tempK, civTechK, dysonCoverage, flags)
struct SphereInstance {
  pos_r: vec4<f32>,
  color0: vec4<f32>,
  color1: vec4<f32>,
  params: vec4<f32>,
  sp_info: vec4<f32>,
};

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> spheres: array<SphereInstance>;
// Zero-copy live GPU Planetary Baroclinic Atmosphere + Triboelectric Lightning + Aurora + CFD Flow grid!
// 3 vec4 per cell: [i*3+0]=em0(rhoQ, phi, eMag, flash), [i*3+1]=vis(cloud, dust, lightningGlow, auroraEnv), [i*3+2]=cfd_flow(uEast, vNorth, vort, tAnom)
@group(0) @binding(2) var<storage, read> atmo_em_grid: array<vec4<f32>>;
// Zero-copy live GPU 3D SPH Planetary Genesis Spherical Geology Map (W x H):
//   vec4(elevNorm [-1..1], crustComp [0..1], thermalVolc [0..1], moistureRiver [0..1])
@group(0) @binding(3) var<storage, read> sph_geology_grid: array<vec4<f32>>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) center: vec3<f32>,
  @location(1) radius: f32,
  @location(2) world_quad: vec3<f32>,
  @location(3) color0: vec4<f32>,
  @location(4) color1: vec4<f32>,
  @location(5) params: vec4<f32>,
  @location(6) quad_uv: vec2<f32>,
  @location(7) pinpoint_w: f32,
  @location(8) @interpolate(flat) inst_id: u32,
  @location(9) sp_info: vec4<f32>,
};

struct FsOut {
  @location(0) color: vec4<f32>,
  @builtin(frag_depth) depth: f32,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let uv = corners[vid % 6u];
  let sp = spheres[iid];
  let center = sp.pos_r.xyz;
  let radius = sp.pos_r.w;
  let kind = u32(round(sp.color0.w));

  let to_cam_v = cam.cam_pos.xyz - center;
  let dist = max(1e-5, length(to_cam_v));
  let to_cam = to_cam_v / dist;
  let right = normalize(cross(cam.cam_up.xyz, to_cam));
  let up = cross(to_cam, right);

  // Compute approximate apparent radius in screen height fraction:
  let app_frac = radius / max(1e-5, dist * cam.cam_up.w);
  let min_glint_frac = select(0.0062, 0.013, kind == 0u);
  let pinpoint_w = 1.0 - smoothstep(min_glint_frac * 0.55, min_glint_frac * 2.2, app_frac);
  let min_world_half = dist * cam.cam_up.w * min_glint_frac;

  let disp_pad = max(0.0, sp.sp_info.w) * 1.40;
  let halo_inflate = max(select(1.24, 1.54, kind == 0u || kind == 5u), 1.08 + disp_pad);
  let base_inflate = radius * select(max(1.54, 1.15 + disp_pad), halo_inflate, dist > radius * 2.6);
  let inflate = max(base_inflate, select(0.0, min_world_half, kind <= 4u));
  let world_quad = center + to_cam * min(radius * 0.15, dist * 0.05) + right * (uv.x * inflate) + up * (uv.y * inflate);

  var out: VsOut;
  out.pos = apply_log_depth_vs(cam.view_proj * vec4<f32>(world_quad, 1.0), cam.em_aux.w);
  out.center = center;
  out.radius = radius;
  out.world_quad = world_quad;
  out.color0 = sp.color0;
  out.color1 = sp.color1;
  out.params = sp.params;
  out.quad_uv = uv;
  out.pinpoint_w = select(0.0, pinpoint_w, kind <= 4u);
  out.inst_id = iid;
  out.sp_info = sp.sp_info;
  return out;
}

fn sample_live_atmo_slot(n_hit: vec3<f32>, w_u: u32, h_u: u32, slot: u32) -> vec4<f32> {
  let lon = atan2(n_hit.z, n_hit.x); // [-pi, pi]
  let lat = asin(clamp(n_hit.y, -1.0, 1.0)); // [-pi/2, pi/2]
  let u = fract(lon / 6.28318530718 + 0.5);
  let v = clamp(0.5 - lat / 3.14159265359, 0.0, 0.9999);
  let gx = u * f32(w_u) - 0.5;
  let gy = v * f32(h_u) - 0.5;
  let x0 = i32(floor(gx));
  let y0 = i32(floor(gy));
  let fx = fract(gx);
  let fy = fract(gy);
  let wi = i32(w_u);
  let hi = i32(h_u);
  let ix0 = u32(((x0 % wi) + wi) % wi);
  let ix1 = u32((((x0 + 1) % wi) + wi) % wi);
  let iy0 = u32(clamp(y0, 0, hi - 1));
  let iy1 = u32(clamp(y0 + 1, 0, hi - 1));
  let c00 = atmo_em_grid[(iy0 * w_u + ix0) * 3u + slot];
  let c10 = atmo_em_grid[(iy0 * w_u + ix1) * 3u + slot];
  let c01 = atmo_em_grid[(iy1 * w_u + ix0) * 3u + slot];
  let c11 = atmo_em_grid[(iy1 * w_u + ix1) * 3u + slot];
  return mix(mix(c00, c10, fx), mix(c01, c11, fx), fy);
}

fn sample_live_atmo_vis(n_hit: vec3<f32>, w_u: u32, h_u: u32) -> vec4<f32> {
  return sample_live_atmo_slot(n_hit, w_u, h_u, 1u);
}

fn sample_live_atmo_flow(n_hit: vec3<f32>, w_u: u32, h_u: u32) -> vec4<f32> {
  return sample_live_atmo_slot(n_hit, w_u, h_u, 2u);
}

fn sample_sph_geology(n_hit: vec3<f32>, w_u: u32, h_u: u32) -> vec4<f32> {
  let lon = atan2(n_hit.z, n_hit.x);
  let lat = asin(clamp(n_hit.y, -1.0, 1.0));
  let u = fract(lon / 6.28318530718 + 0.5);
  let v = clamp(0.5 - lat / 3.14159265359, 0.0, 0.9999);
  let gx = u * f32(w_u) - 0.5;
  let gy = v * f32(h_u) - 0.5;
  let x0 = i32(floor(gx));
  let y0 = i32(floor(gy));
  let fx = fract(gx);
  let fy = fract(gy);
  let wi = i32(w_u);
  let hi = i32(h_u);
  let ix0 = u32(((x0 % wi) + wi) % wi);
  let ix1 = u32((((x0 + 1) % wi) + wi) % wi);
  let iy0 = u32(clamp(y0, 0, hi - 1));
  let iy1 = u32(clamp(y0 + 1, 0, hi - 1));
  let c00 = sph_geology_grid[iy0 * w_u + ix0];
  let c10 = sph_geology_grid[iy0 * w_u + ix1];
  let c01 = sph_geology_grid[iy1 * w_u + ix0];
  let c11 = sph_geology_grid[iy1 * w_u + ix1];
  return mix(mix(c00, c10, fx), mix(c01, c11, fx), fy);
}

fn hash3(p_in: vec3<f32>) -> f32 {
  var p = fract(p_in * 0.3183099 + vec3<f32>(0.1, 0.2, 0.3));
  p = p * 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

fn vnoise3(x: vec3<f32>) -> f32 {
  let i = floor(x);
  let f = fract(x);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i + vec3<f32>(0.0, 0.0, 0.0)), hash3(i + vec3<f32>(1.0, 0.0, 0.0)), u.x),
        mix(hash3(i + vec3<f32>(0.0, 1.0, 0.0)), hash3(i + vec3<f32>(1.0, 1.0, 0.0)), u.x), u.y),
    mix(mix(hash3(i + vec3<f32>(0.0, 0.0, 1.0)), hash3(i + vec3<f32>(1.0, 0.0, 1.0)), u.x),
        mix(hash3(i + vec3<f32>(0.0, 1.0, 1.0)), hash3(i + vec3<f32>(1.0, 1.0, 1.0)), u.x), u.y),
    u.z
  );
}

fn fbm5(p_in: vec3<f32>) -> f32 {
  var p = p_in;
  var sum = 0.0;
  var amp = 0.5;
  for (var i = 0u; i < 5u; i = i + 1u) {
    sum = sum + amp * vnoise3(p);
    p = p * 2.07 + vec3<f32>(13.7, -9.2, 5.4);
    amp = amp * 0.5;
  }
  return sum;
}

fn is_cutaway_octant(p_loc: vec3<f32>, cut_active: f32) -> bool {
  return cut_active > 0.5 && p_loc.x > 0.0 && p_loc.y > 0.0 && p_loc.z > 0.0;
}

// Smooth full-resolution 3D filamentary Birkeland polar aurora curtains (zero coarse grid beads!)
fn eval_filament_aurora(n_hit: vec3<f32>, env_str: f32, time_s: f32, seed_v: vec3<f32>) -> f32 {
  if (env_str <= 0.01) { return 0.0; }
  let lon = atan2(n_hit.z, n_hit.x);
  let lat = asin(clamp(n_hit.y, -1.0, 1.0));
  let warp = fbm5(vec3<f32>(n_hit.x * 5.5, n_hit.y * 2.5, n_hit.z * 5.5) + vec3<f32>(time_s * 0.08, 0.0, -time_s * 0.06) + seed_v * 0.3);
  let rib1 = exp(-pow((sin(lat * 26.0 + warp * 4.8 + sin(lon * 3.0 + time_s * 0.22) * 0.8)), 2.0) * 14.0);
  let rib2 = exp(-pow((sin(lat * 42.0 - warp * 3.6 + cos(lon * 5.0 - time_s * 0.18) * 0.9)), 2.0) * 18.0);
  let rays = 0.45 + 0.55 * fbm5(vec3<f32>(cos(lon * 2.0) * 11.0, lat * 6.0, sin(lon * 2.0) * 11.0) + vec3<f32>(0.0, time_s * 0.14, 0.0));
  let shimmer = 0.65 + 0.35 * sin(lon * 7.0 + warp * 5.0 + time_s * 0.9);
  return clamp(env_str * (rib1 * 0.85 + rib2 * 0.55) * rays * shimmer * 1.45, 0.0, 1.8);
}

@fragment
fn fs_main(in: VsOut) -> FsOut {
  let ro = cam.cam_pos.xyz - in.center;
  let rd = normalize(in.world_quad - cam.cam_pos.xyz);
  let r = in.radius;
  // Scale-normalized precision-safe ray-sphere intersection: ZERO f32 overflow or cancellation
  // from 0.2 m all the way out to 10^14 m true-metric Suns, Moons, and outer gas giants!
  let ro_len = max(1.0, length(ro));
  let s_inv = 1.0 / ro_len;
  let ro_n = ro * s_inv;
  let r_n = r * s_inv;
  let b_n = dot(ro_n, rd);
  let perp_n = ro_n - rd * b_n;
  let disc_n = r_n * r_n - dot(perp_n, perp_n);

  let kind = u32(round(in.color0.w));
  // Per-body radial star illumination when cam.extra1.w > 0.5 (L2 multi-planet view: cam.extra1.xyz = live host star world pos!),
  // or directional host-star vector when cam.extra1.w <= 0.5 (L4 orbital / surface sky view)!
  let to_star_l = cam.extra1.xyz - in.center;
  let light_dir = select(
    normalize(cam.extra1.xyz),
    normalize(to_star_l),
    cam.extra1.w > 0.5 && length(to_star_l) > 1e-4
  );
  let cut_active = in.params.z;

  // True 3D Ray-Marched SPH Surface Displacement & Rotational Oblateness (NEVER featureless perfect spheres!):
  //   sp_info.w > 0 -> 3D SPH topographic / irregular asteroid relief amplitude disp_amp (0.045..0.28)
  //   sp_info.w < 0 -> Rotational equatorial oblateness f = -sp_info.w on fast-spinning gas/ice giants
  let live_sph_any = (cam.sph_geo.x > 1.5) && (in.inst_id == u32(round(cam.sph_geo.z))) && (cut_active < 0.5)
    && (kind == 1u || kind == 3u || kind == 4u || kind == 7u);
  let disp_amp = select(0.0, clamp(in.sp_info.w, 0.0, 0.56), live_sph_any && in.sp_info.w > 0.002);
  let oblate_f = select(0.0, clamp(-in.sp_info.w, 0.0, 0.16), !live_sph_any && in.sp_info.w < -0.002 && (kind == 2u || kind == 3u));

  var hit_override = false;
  var t_hit_n = 0.0;
  var p_hit_n_disp = vec3<f32>(0.0);
  var n_hit_geom = vec3<f32>(0.0, 1.0, 0.0);

  if (disp_amp > 0.002) {
    let r_bound = r_n * (1.0 + disp_amp * 1.12);
    let r_floor = r_n * max(0.32, 1.0 - disp_amp * 1.06);
    let disc_b = r_bound * r_bound - dot(perp_n, perp_n);
    if (disc_b >= 0.0) {
      let sq_b = sqrt(disc_b);
      let t_enter = max(1.0e-7, -b_n - sq_b);
      let t_exit = -b_n + sq_b;
      if (t_exit > t_enter) {
        let disc_f = r_floor * r_floor - dot(perp_n, perp_n);
        let t_f_ent = select(t_exit, -b_n - sqrt(max(0.0, disc_f)), disc_f >= 0.0);
        let t_end = select(t_exit, min(t_exit, t_f_ent), disc_f >= 0.0 && t_f_ent > t_enter);
        let gw_m = u32(round(cam.sph_geo.x));
        let gh_m = u32(round(cam.sph_geo.y));
        let has_ocean_g = (kind == 1u || kind == 4u) && (in.color1.b > in.color1.r + 0.14);
        let sea_lvl_g = select(-1.5, cam.sph_geo.w, has_ocean_g);
        var t_prev = t_enter;
        var t_lo = t_enter;
        var t_hi = t_end;
        var found_s = false;
        // 56 steps on dramatically displaced bilobed comets/asteroids (eliminates cylindrical stepping holes!)
        let n_march = select(24u, 56u, disp_amp > 0.10);
        for (var ms = 1u; ms <= n_march; ms = ms + 1u) {
          let t_cur = mix(t_enter, t_end, f32(ms) / f32(n_march));
          let p_cur = ro_n + rd * t_cur;
          let r_cur = length(p_cur);
          let d_cur = p_cur / max(1e-7, r_cur);
          let e_raw = sample_sph_geology(d_cur, gw_m, gh_m).x;
          let e_g = select(e_raw, max(e_raw, sea_lvl_g), has_ocean_g);
          let r_surf = r_n * (1.0 + disp_amp * e_g);
          if (r_cur <= r_surf) {
            t_lo = t_prev;
            t_hi = t_cur;
            found_s = true;
            break;
          }
          t_prev = t_cur;
        }
        if (!found_s && disc_f >= 0.0 && t_f_ent > t_enter) {
          t_lo = t_prev;
          t_hi = t_end;
          found_s = true;
        }
        if (found_s) {
          for (var bs = 0u; bs < 6u; bs = bs + 1u) {
            let t_mid = 0.5 * (t_lo + t_hi);
            let p_mid = ro_n + rd * t_mid;
            let r_mid = length(p_mid);
            let d_mid = p_mid / max(1e-7, r_mid);
            let e_m = sample_sph_geology(d_mid, gw_m, gh_m).x;
            let e_mg = select(e_m, max(e_m, sea_lvl_g), has_ocean_g);
            let r_sm = r_n * (1.0 + disp_amp * e_mg);
            if (r_mid <= r_sm) { t_hi = t_mid; } else { t_lo = t_mid; }
          }
          t_hit_n = 0.5 * (t_lo + t_hi);
          p_hit_n_disp = ro_n + rd * t_hit_n;
          n_hit_geom = normalize(p_hit_n_disp);
          hit_override = true;
        }
      }
    }
  } else if (oblate_f > 0.002) {
    let inv_y = 1.0 / (1.0 - oblate_f);
    let ro_o = vec3<f32>(ro_n.x, ro_n.y * inv_y, ro_n.z);
    let rd_o_raw = vec3<f32>(rd.x, rd.y * inv_y, rd.z);
    let rd_o_len = length(rd_o_raw);
    let rd_o = rd_o_raw / max(1e-7, rd_o_len);
    let b_o = dot(ro_o, rd_o);
    let perp_o = ro_o - rd_o * b_o;
    let disc_o = r_n * r_n - dot(perp_o, perp_o);
    if (disc_o >= 0.0) {
      let sq_o = sqrt(disc_o);
      var t_o = -b_o - sq_o;
      if (t_o < 1.0e-7) { t_o = -b_o + sq_o; }
      if (t_o >= 1.0e-7) {
        t_hit_n = t_o / max(1e-7, rd_o_len);
        p_hit_n_disp = ro_n + rd * t_hit_n;
        let p_o = ro_o + rd_o * t_o;
        n_hit_geom = normalize(vec3<f32>(p_o.x, p_o.y * inv_y, p_o.z));
        hit_override = true;
      }
    }
  }

  let use_custom_hit = (disp_amp > 0.002) || (oblate_f > 0.002);
  let missed_body = select((disc_n < 0.0), !hit_override, use_custom_hit);
  if (missed_body) {
    // 1. Sub-pixel astronomical pinpoint glint when true physical disk is < ~2.5 px at AU distances
    if (in.pinpoint_w > 0.02) {
      let q2 = dot(in.quad_uv, in.quad_uv);
      if (q2 < 1.0) {
        let g_core = exp(-8.0 * q2);
        let g_halo = exp(-2.6 * q2) * select(0.32, 0.58, kind == 0u);
        let glint_col = mix(in.color0.rgb, vec3<f32>(1.0, 0.98, 0.94), select(0.45, 0.65, kind == 0u));
        let alpha = clamp((g_core + g_halo) * in.pinpoint_w * select(0.95, 1.25, kind == 0u), 0.0, 1.0);
        var out_g: FsOut;
        var g_rgb = glint_col * (g_core * 1.45 + g_halo) * in.pinpoint_w;
        if (cam.em_sensor.z > 0.5) {
          g_rgb = em_sensor_map_rgb(g_rgb, max(100.0, in.sp_info.x), select(0.0, 0.6, kind == 0u), select(0.0, 0.25, kind == 0u), in.sp_info.y * 0.4, 0.0);
        }
        out_g.color = vec4<f32>(g_rgb, alpha);
        let clip_g = cam.view_proj * vec4<f32>(in.center, 1.0);
        out_g.depth = eval_frag_depth(clip_g, cam.em_aux.w);
        return out_g;
      }
    }
    // 2. Physical solar corona glow for stars (kind 0) & Rayleigh atmospheric halo for planets (kind 1/4)
    let closest_n = max(0.0, -b_n);
    let d_min = length(ro_n + rd * closest_n) / max(1e-7, r_n);
    let halo_clip = cam.view_proj * vec4<f32>(in.center, 1.0);
    let halo_depth = max(1.0e-6, eval_frag_depth(halo_clip, cam.em_aux.w) * 0.999);
    if (kind == 0u && d_min < 1.48) {
      let edge_fade = 1.0 - smoothstep(1.24, 1.46, d_min);
      let p_lim = normalize(ro_n + rd * closest_n);
      let lim_ang = atan2(p_lim.y, p_lim.x + p_lim.z * 0.5);
      // Sculpted magnetic coronal streamer rays + fiery arched solar prominence loops!
      let streamer = 0.72 + 0.28 * pow(0.5 + 0.5 * sin(lim_ang * 5.0 + cam.cam_pos.w * 0.14), 2.0);
      let prom_arch = exp(-pow((d_min - 1.11) / 0.055, 2.0)) * smoothstep(0.72, 0.96, sin(lim_ang * 7.0 - cam.cam_pos.w * 0.18 + in.params.w));
      let corona = (exp(-(d_min - 1.0) * 6.4) * 0.82 * streamer + prom_arch * 0.65) * (1.0 - clamp(in.sp_info.z * 0.75, 0.0, 0.8)) * edge_fade;
      if (corona < 0.015) { discard; }
      var out_c: FsOut;
      var c_rgb = (in.color0.rgb * (exp(-(d_min - 1.0) * 6.4) * 1.35 * streamer) + mix(in.color1.rgb, vec3<f32>(1.0, 0.34, 0.10), 0.65) * prom_arch * 1.45) * (1.0 - clamp(in.sp_info.z * 0.75, 0.0, 0.8)) * edge_fade;
      if (cam.em_sensor.z > 0.5) {
        // Hot 1.5 MK solar corona blazes brightly in EUV / Soft X-Ray!
        c_rgb = em_sensor_map_rgb(c_rgb, 1.5e6, corona * 1.4, corona * 1.8, corona * 0.3, 0.0);
      }
      out_c.color = vec4<f32>(c_rgb, clamp(corona, 0.0, 1.0));
      // Reversed-Z far depth on translucent corona so background nebulae/disks never get clipped by a square box!
      out_c.depth = 0.0;
      return out_c;
    }
    if (kind == 5u && dot(in.color0.rgb, in.color0.rgb) < 0.001 && d_min < 1.44) {
      // EHT M87* / Sgr A* Razor-Sharp Asymmetric Relativistic Doppler-Brightened n=1 Gravitational Photon Ring!
      let bh_edge = 1.0 - smoothstep(1.22, 1.42, d_min);
      let p_lim_bh = normalize(ro_n + rd * closest_n);
      let dopp_side = clamp(0.65 + 0.58 * dot(p_lim_bh, cam.cam_right.xyz - cam.cam_up.xyz * 0.42), 0.22, 1.45);
      let n1_ring = exp(-pow((d_min - 1.055) / 0.032, 2.0)) * 2.15;
      let einstein_h = exp(-(d_min - 1.0) * 9.5) * 0.52;
      let bh_glow = (n1_ring + einstein_h) * dopp_side * bh_edge;
      if (bh_glow < 0.015) { discard; }
      var bh_rgb = mix(vec3<f32>(0.96, 0.36, 0.08), vec3<f32>(1.0, 0.92, 0.72), clamp(n1_ring * 0.45 * dopp_side, 0.0, 1.0)) * bh_glow;
      if (cam.em_sensor.z > 0.5) {
        bh_rgb = em_sensor_map_rgb(bh_rgb, 1.5e7, bh_glow * 0.8, bh_glow * 1.9, bh_glow * 2.6, bh_glow * 0.7);
      }
      var out_bh: FsOut;
      out_bh.color = vec4<f32>(bh_rgb, clamp(bh_glow * 0.75, 0.0, 1.0));
      out_bh.depth = 0.0;
      return out_bh;
    }
    if ((kind == 1u || kind == 4u) && in.color1.w > 0.25 && d_min < 1.07) {
      let h_atmo = exp(-(d_min - 1.0) * 42.0) * in.color1.w * 0.62;
      if (h_atmo < 0.012) { discard; }
      let lit_side = clamp(dot(normalize(ro_n + rd * closest_n), light_dir) * 0.8 + 0.35, 0.0, 1.0);
      var out_a: FsOut;
      out_a.color = vec4<f32>(vec3<f32>(0.34, 0.68, 1.0) * h_atmo * lit_side, h_atmo * lit_side);
      out_a.depth = 0.0;
      return out_a;
    }
    discard;
  }

  var t_hit = 0.0;
  var p_hit = vec3<f32>(0.0);
  var n_hit = vec3<f32>(0.0, 1.0, 0.0);
  if (hit_override) {
    t_hit = t_hit_n * ro_len;
    p_hit = p_hit_n_disp * ro_len;
    n_hit = n_hit_geom;
  } else {
    let sqrt_dn = sqrt(max(0.0, disc_n));
    t_hit_n = -b_n - sqrt_dn;
    if (t_hit_n < 1.0e-7) { t_hit_n = -b_n + sqrt_dn; }
    if (t_hit_n < 1.0e-7) { discard; }
    t_hit = t_hit_n * ro_len;
    p_hit = (ro_n + rd * t_hit_n) * ro_len;
    n_hit = normalize(ro_n + rd * t_hit_n);
  }
  var is_interior = false;

  // True 3D Cutaway Plane intersection when user enables L4 Planetary Interior Cutaway
  if ((kind == 4u || kind == 1u || kind == 2u) && is_cutaway_octant(p_hit, cut_active)) {
    var best_t = 1e20;
    var best_n = vec3<f32>(0.0, 1.0, 0.0);
    if (abs(rd.x) > 1e-5) {
      let tx = -ro.x / rd.x;
      if (tx > 1e-6 && tx < best_t) {
        let q = ro + rd * tx;
        if (dot(q, q) <= r * r && q.y >= 0.0 && q.z >= 0.0) {
          best_t = tx;
          best_n = vec3<f32>(select(1.0, -1.0, rd.x > 0.0), 0.0, 0.0);
        }
      }
    }
    if (abs(rd.y) > 1e-5) {
      let ty = -ro.y / rd.y;
      if (ty > 1e-6 && ty < best_t) {
        let q = ro + rd * ty;
        if (dot(q, q) <= r * r && q.x >= 0.0 && q.z >= 0.0) {
          best_t = ty;
          best_n = vec3<f32>(0.0, select(1.0, -1.0, rd.y > 0.0), 0.0);
        }
      }
    }
    if (abs(rd.z) > 1e-5) {
      let tz = -ro.z / rd.z;
      if (tz > 1e-6 && tz < best_t) {
        let q = ro + rd * tz;
        if (dot(q, q) <= r * r && q.x >= 0.0 && q.y >= 0.0) {
          best_t = tz;
          best_n = vec3<f32>(0.0, 0.0, select(1.0, -1.0, rd.z > 0.0));
        }
      }
    }
    if (best_t < 1e19) {
      t_hit = best_t;
      p_hit = ro + rd * t_hit;
      n_hit = best_n;
      is_interior = true;
    } else {
      discard;
    }
  }

  let view_dir = -rd;
  let ndv = max(0.0, dot(n_hit, view_dir));
  let raw_ndl = dot(n_hit, light_dir);
  // Analytical Ring-on-Planet Shadow (Cassini + Encke divisions cast directly onto Saturn / Uranus cloud tops!)
  // Packed when !hasSphGeo && focusedRing: cam.sph_geo = (ringN.x, ringN.y, ringN.z, sphereIdx), cam.extra0.zw = (rInRatio, rOutRatio)
  var ring_on_planet_sh = 1.0;
  if (cam.sph_geo.x <= 1.5 && cam.extra0.w > 1.05 && in.inst_id == u32(round(cam.sph_geo.w)) && raw_ndl > -0.02) {
    let r_n_sh = normalize(cam.sph_geo.xyz);
    let denom_rs = dot(light_dir, r_n_sh);
    if (abs(denom_rs) > 1e-4) {
      let t_rs = -dot(p_hit, r_n_sh) / denom_rs;
      if (t_rs > 0.0) {
        let q_rs = p_hit + light_dir * t_rs;
        let rq_ratio = length(q_rs) / max(1e-5, r);
        let r_in_rat = max(1.05, cam.extra0.z);
        let r_out_rat = max(r_in_rat + 0.05, cam.extra0.w);
        if (rq_ratio >= r_in_rat && rq_ratio <= r_out_rat) {
          let u_rs = clamp((rq_ratio - r_in_rat) / max(1e-4, r_out_rat - r_in_rat), 0.0, 1.0);
          let c_rs = (u_rs - 0.60) * 32.0;
          let e_rs = (u_rs - 0.88) * 55.0;
          let tau_rs = smoothstep(0.0, 0.06, u_rs) * (1.0 - smoothstep(0.94, 1.0, u_rs))
            * (1.0 - 0.88 * exp(-(c_rs * c_rs))) * (1.0 - 0.60 * exp(-(e_rs * e_rs)))
            * (0.74 + 0.26 * sin(u_rs * 76.0) * cos(u_rs * 27.0));
          ring_on_planet_sh = clamp(1.0 - tau_rs * 0.82, 0.14, 1.0);
        }
      }
    }
  }
  let ndl = max(0.0, raw_ndl) * ring_on_planet_sh;
  let soft_term = smoothstep(-0.08, 0.14, raw_ndl);
  // Real host-star spectral color & inverse-square irradiance attenuation (cam.star_light)!
  let star_rgb = cam.star_light.rgb;
  let star_flux = clamp(cam.star_light.w, 0.14, 1.85);
  let star_dir_l = star_rgb * star_flux;
  // Warm Rayleigh/Mie sunset glow along the day-night terminator tinted by host star spectrum
  let term_d = (raw_ndl - 0.04) / 0.16;
  let term_sunset = exp(-(term_d * term_d)) * in.color1.w;
  let half_v = normalize(light_dir + view_dir);
  let spec = pow(max(0.0, dot(n_hit, half_v)), 44.0);
  let fresnel = pow(max(0.0, 1.0 - ndv), 3.6);
  let seed_v = vec3<f32>(in.params.w * 2.13, in.params.w * 1.47, in.params.w * 3.19);

  var col = vec3<f32>(0.8);
  var em_temp_k = max(45.0, in.sp_info.x);
  var em_uv = 0.0;
  var em_xr = 0.0;
  var em_rad = 0.0;
  let civ_k = max(0.0, in.sp_info.y);
  let dyson_tau = clamp(in.sp_info.z, 0.0, 0.94);

  if (kind == 0u) {
    // Realistic convective solar photosphere with multi-scale granulation, magnetic sunspots/faculae, limb darkening, & Dyson swarm occultation!
    let g1 = fbm5(n_hit * 8.5 + seed_v + vec3<f32>(cam.cam_pos.w * 0.04, 0.0, 0.0));
    let g2 = fbm5(n_hit * 22.0 - seed_v);
    let gran = clamp(0.65 * g1 + 0.35 * g2, 0.0, 1.0);
    let lat_belt = exp(-pow((abs(n_hit.y) - 0.28) * 5.2, 2.0));
    let spot_n = fbm5(n_hit * 5.2 + seed_v * 1.7 + vec3<f32>(cam.cam_pos.w * 0.015, 0.0, 0.0));
    let sunspot = smoothstep(0.74, 0.86, spot_n) * lat_belt;
    let faculae = smoothstep(0.64, 0.74, spot_n) * (1.0 - sunspot) * lat_belt * (1.0 - ndv * 0.55);
    let limb = pow(max(0.0, ndv), 0.52);
    col = mix(in.color1.rgb, in.color0.rgb, 0.35 + 0.65 * gran) * (0.58 + 0.85 * limb);
    col = mix(col, in.color1.rgb * 0.22, sunspot * 0.82) + vec3<f32>(1.0, 0.95, 0.78) * faculae * 0.38;
    if (dyson_tau > 0.01) {
      // Orbiting geometric Dyson swarm rings/collectors dim visible photosphere by exp(-tau_Dyson) and radiate 420 K IR waste heat!
      let d_lat = abs(sin(n_hit.y * 18.0 + cam.cam_pos.w * 0.35));
      let d_lon = abs(sin(atan2(n_hit.z, n_hit.x) * 22.0 - cam.cam_pos.w * 0.5));
      let swarm_mesh = smoothstep(0.75 - dyson_tau * 0.65, 0.95, max(d_lat, d_lon));
      let occ = clamp(dyson_tau * (0.55 + 0.55 * swarm_mesh), 0.0, 0.92);
      col = col * (1.0 - occ) + vec3<f32>(0.18, 0.11, 0.08) * occ * (0.4 + 0.6 * fresnel);
      em_temp_k = mix(em_temp_k, 420.0, occ);
      em_rad = dyson_tau * 0.9;
    }
    em_uv = smoothstep(4500.0, 12000.0, em_temp_k) * 1.1;
    em_xr = smoothstep(8000.0, 30000.0, em_temp_k) * 0.9 + (1.0 - limb) * 0.35;
  } else if (is_interior) {
    // Exact GPU-solved planetary cutaway shells!
    let r_norm = length(p_hit) / max(1e-6, r);
    let r_core = clamp(in.params.x, 0.12, 0.85);
    let r_mantle = clamp(in.params.y, r_core + 0.04, 0.99);
    let r_inner = r_core * 0.46;
    let conv = fbm5(p_hit / max(1e-6, r) * 7.5 + seed_v);
    var shell_col = in.color0.rgb;
    if (r_norm < r_inner) {
      shell_col = vec3<f32>(1.0, 0.93, 0.68) * (0.92 + 0.14 * conv);
    } else if (r_norm < r_core) {
      let f = (r_norm - r_inner) / max(0.02, r_core - r_inner);
      shell_col = mix(vec3<f32>(1.0, 0.68, 0.20), vec3<f32>(0.94, 0.34, 0.10), f) * (0.85 + 0.25 * conv);
    } else if (r_norm < r_mantle) {
      let f = (r_norm - r_core) / max(0.02, r_mantle - r_core);
      shell_col = mix(vec3<f32>(0.76, 0.24, 0.12), vec3<f32>(0.38, 0.26, 0.18), f) * (0.78 + 0.35 * conv);
    } else {
      shell_col = in.color1.rgb;
    }
    let edge_core = smoothstep(0.007, 0.016, abs(r_norm - r_core));
    let edge_mantle = smoothstep(0.007, 0.016, abs(r_norm - r_mantle));
    shell_col = shell_col * (0.55 + 0.45 * edge_core * edge_mantle);
    let shade = 0.52 + 0.48 * max(0.25, dot(n_hit, normalize(vec3<f32>(0.55, 0.72, 0.45))));
    col = shell_col * shade;
    em_temp_k = mix(5400.0, em_temp_k, clamp(r_norm, 0.0, 1.0));
  } else if (kind == 2u) {
    // Banded Gas / Dense-Cloud World with LIVE GPU Flow-Map Advected Spherical CFD Jets, Cyclonic Vorticity Eddies, Lightning & Smooth 3D Filamentary Aurorae!
    let live_atmo2 = cam.extra2.w > 0.5 && in.inst_id == u32(round(cam.extra2.z));
    var flow_3d = vec3<f32>(0.0);
    var vort2 = 0.0;
    var t_anom2 = 0.0;
    var av2 = vec4<f32>(0.0);
    if (live_atmo2) {
      let aw = u32(round(cam.extra2.x));
      let ah = u32(round(cam.extra2.y));
      av2 = sample_live_atmo_vis(n_hit, aw, ah);
      let cfd2 = sample_live_atmo_flow(n_hit, aw, ah);
      let east2 = normalize(vec3<f32>(-n_hit.z, 0.0, n_hit.x) + vec3<f32>(1e-5, 0.0, 0.0));
      let north2 = cross(east2, n_hit);
      flow_3d = east2 * cfd2.x + north2 * cfd2.y;
      vort2 = cfd2.z;
      t_anom2 = cfd2.w;
    }
    // Dual-phase flow-map advection along live spherical CFD velocity -> unmistakably flowing jet bands & swirling vortices!
    let ph0 = fract(cam.cam_pos.w * 0.16);
    let ph1 = fract(ph0 + 0.5);
    let ph_w = abs(2.0 * ph0 - 1.0);
    let p_adv0 = normalize(n_hit - flow_3d * (ph0 * 0.24));
    let p_adv1 = normalize(n_hit - flow_3d * (ph1 * 0.24));
    let turb0 = fbm5(p_adv0 * 6.0 + seed_v);
    let turb1 = fbm5(p_adv1 * 6.0 + seed_v);
    let turb = mix(turb0, turb1, ph_w);
    let kh0 = fbm5(vec3<f32>(p_adv0.x * 8.5 + turb * 1.1, p_adv0.y * 28.0, p_adv0.z * 8.5 - turb * 1.1) + seed_v);
    let kh1 = fbm5(vec3<f32>(p_adv1.x * 8.5 + turb * 1.1, p_adv1.y * 28.0, p_adv1.z * 8.5 - turb * 1.1) + seed_v);
    let kh_shear = mix(kh0, kh1, ph_w);
    let lat = n_hit.y * 16.5 + (turb - 0.5) * 3.4 + (kh_shear - 0.5) * 0.95 + vort2 * 0.42;
    let band = 0.5 + 0.5 * sin(lat) * cos(lat * 0.45 + turb * 1.6);
    let fine_jet = mix(
      fbm5(vec3<f32>(p_adv0.x * 5.2, p_adv0.y * 24.0, p_adv0.z * 5.2) + seed_v),
      fbm5(vec3<f32>(p_adv1.x * 5.2, p_adv1.y * 24.0, p_adv1.z * 5.2) + seed_v),
      ph_w
    );
    var base = mix(in.color1.rgb * 0.74, in.color0.rgb * 1.14, clamp(0.14 + 0.56 * band + 0.30 * fine_jet, 0.0, 1.0));
    // Visible cyclonic upwelling & baroclinic jet shear streaks directly from live GPU CFD!
    let spd2 = length(flow_3d);
    let eddy_crest = smoothstep(0.28, 1.45, abs(vort2)) * (0.45 + 0.55 * kh_shear);
    let jet_filament = smoothstep(0.45, 1.35, spd2) * smoothstep(0.48, 0.82, fine_jet);
    base = mix(base, mix(in.color0.rgb, vec3<f32>(1.0, 0.96, 0.88), 0.58), clamp(eddy_crest * 0.48 + jet_filament * 0.28, 0.0, 0.65));
    // Warm deep-belt glow where cyclonic divergence / warm t_anom clears upper ammonia decks
    base = mix(base, in.color1.rgb * 0.62 + vec3<f32>(0.24, 0.08, 0.03), smoothstep(0.35, 1.1, t_anom2) * 0.22);
    // Subtle polar cool atmospheric darkening + anticyclonic storm oval vortex
    let polar_haze = smoothstep(0.68, 0.96, abs(n_hit.y));
    base = mix(base, in.color1.rgb * 0.68 + vec3<f32>(0.08, 0.12, 0.20), polar_haze * 0.45);
    let spot_lon = atan2(n_hit.z, n_hit.x) - fract(in.params.w * 0.37) * 6.283 + 3.1415 - cam.cam_pos.w * 0.025;
    let spot_d = length(vec2<f32>(sin(spot_lon * 0.5) * 1.35, (n_hit.y + 0.34) * 3.4));
    let spot_w = (1.0 - smoothstep(0.14, 0.34, spot_d)) * smoothstep(0.35, 0.75, in.color0.r);
    let spot_swirl = 0.72 + 0.28 * sin(spot_d * 24.0 + turb * 5.0 - cam.cam_pos.w * 0.8);
    base = mix(base, mix(in.color0.rgb, vec3<f32>(0.92, 0.42, 0.22), 0.58) * spot_swirl, spot_w * 0.78);
    var em_fx = vec3<f32>(0.0);
    if (live_atmo2) {
      let storm_w = smoothstep(0.24, 0.76, av2.x);
      base = mix(base, mix(in.color0.rgb, vec3<f32>(0.98, 0.93, 0.84), 0.55), storm_w * 0.36);
      // Crisp high-frequency micro-spark lightning leaders (never blocky 128x64 white squares!), brightest on twilight/night side!
      let bolt_spark = smoothstep(0.56, 0.82, fbm5(n_hit * 46.0 + vec3<f32>(cam.cam_pos.w * 2.4, 0.0, -cam.cam_pos.w * 1.9)));
      let bolt = smoothstep(0.42, 1.15, av2.z) * (0.28 + 0.72 * bolt_spark);
      em_fx = em_fx + vec3<f32>(0.68, 0.90, 1.0) * bolt * (0.26 + 1.55 * (1.0 - ndl));
      // Smooth full-resolution 3D Birkeland auroral curtain ribbons (ZERO coarse grid beads!)
      let aur = eval_filament_aurora(n_hit, av2.w, cam.cam_pos.w, seed_v);
      em_fx = em_fx + mix(vec3<f32>(0.20, 0.84, 1.0), vec3<f32>(0.66, 0.32, 1.0), clamp((abs(n_hit.y) - 0.72) * 3.5, 0.0, 1.0)) * aur * (0.48 + 0.92 * (1.0 - ndl));
      // Deep-troposphere thermal belt clearing (5-10 um IR bright belts vs cool ammonia zones, like Juno/JWST!)
      em_temp_k = em_temp_k * (0.82 + 0.72 * (1.0 - band) + 0.34 * clamp(t_anom2, -0.4, 1.4) + 0.32 * eddy_crest) + bolt * 850.0;
      em_uv = aur * 1.95 + polar_haze * 0.58 * (0.35 + 0.65 * ndl) + (0.22 + 0.48 * band) * ndl;
      em_rad = bolt * 1.5 + aur * 1.1 + 0.42 * (0.4 + 0.6 * abs(vort2)); // Jovian decametric synchrotron & lightning sferics!
    } else {
      em_temp_k = em_temp_k * (0.84 + 0.64 * (1.0 - band));
      em_uv = polar_haze * 0.45 * (0.3 + 0.7 * ndl) + band * 0.36 * ndl;
    }
    let atm = vec3<f32>(0.58, 0.76, 1.0) * fresnel * in.color1.w;
    let sunset = vec3<f32>(0.95, 0.44, 0.16) * term_sunset * 0.14 * star_dir_l;
    col = base * (vec3<f32>(0.03) + star_dir_l * (0.04 + 0.98 * ndl) * soft_term) + sunset + atm * (vec3<f32>(0.03) + star_dir_l * (0.14 + 0.86 * ndl)) + em_fx;
  } else if (kind == 1u || kind == 4u) {
    // Terrestrial / Ocean / Mars / Mercury / Carbon World:
    // Driven zero-copy by ULG's 3D GPU SPH Planetary Genesis spherical geology map when active
    // (real differentiated continents, subduction mountain chains, craters & eroded river basins — ZERO Perlin blobs!),
    // with distant multi-body fallback for tiny un-focused background planets in L2.
    let live_sph_geo = cam.sph_geo.x > 1.5 && in.inst_id == u32(round(cam.sph_geo.z));
    let has_ocean = in.color1.b > in.color1.r + 0.14;
    var surf = in.color0.rgb;
    var water_spec = 0.0;
    var bump_strength = 0.0;
    var is_land_hab = 0.0;
    var em_volc = vec3<f32>(0.0);
    var elev_center = 0.5;
    var detail = 0.5;

    if (live_sph_geo) {
      let gw = u32(round(cam.sph_geo.x));
      let gh = u32(round(cam.sph_geo.y));
      let g0 = sample_sph_geology(n_hit, gw, gh);
      let elev_sph = g0.x;      // [-1..1] true SPH differentiated crust elevation
      let crust_comp = g0.y;    // [0..1] basalt/ejecta -> felsic granite / orogenic peak
      let thermal_v = g0.z;     // [0..1] mantle plume heat / rift volcanism / impact melt
      let moist_r = g0.w;       // [0..1] hydraulic moisture & carved river valleys
      // Continuous post-SPH thermal cooling (cool_heat in [0..1] passed in cam.extra0.z):
      //   As a newly differentiated world radiates heat away (T^4), primordial lava fissures dim smoothly
      //   from molten orange -> cherry red -> basalt, steam rains out filling oceans from the lowest basins up,
      //   and temperate biomes & polar ice caps emerge naturally (ZERO 1-frame snap!).
      let cool_heat = clamp(cam.extra0.z, 0.0, 1.0);
      let rainout_f = 1.0 - smoothstep(0.14, 0.78, cool_heat);
      let bio_cool_f = 1.0 - smoothstep(0.05, 0.44, cool_heat);
      let sea_lvl_base = select(-1.5, cam.sph_geo.w, has_ocean);
      let sea_lvl = select(-1.5, sea_lvl_base - (1.0 - rainout_f) * 0.62, has_ocean);
      elev_center = elev_sph;
      // Subtle micro-grain (< 3%) ONLY for sub-texel rock crispness (never alters continents!)
      let micro_g = vnoise3(n_hit * 36.0 + seed_v) * 0.06;
      // Sharp tectonic crust-cooling magma fissures (high exponent = crisp thin lava veins between dark obsidian plates!)
      let cool_crack = pow(clamp(1.0 - abs(fbm5(n_hit * 8.0 + seed_v) * 2.0 - 1.0), 0.0, 1.0), 5.5);

      if (has_ocean) {
        if (elev_sph < sea_lvl) {
          let depth_f = clamp((sea_lvl - elev_sph) / 0.56, 0.0, 1.0);
          // Crisp narrow coastal aquamarine shelf dropping cleanly into deep royal-sapphire abyssal oceans!
          let shelf = mix(vec3<f32>(0.08, 0.56, 0.72), vec3<f32>(0.03, 0.24, 0.54), smoothstep(0.0, 0.11, depth_f));
          let abyss = in.color1.rgb * vec3<f32>(0.36, 0.48, 0.70);
          surf = mix(shelf, abyss, smoothstep(0.08, 0.72, depth_f));
          // Subtle mid-ocean ridge bathymetry shimmer
          surf = mix(surf, vec3<f32>(0.08, 0.32, 0.58), thermal_v * 0.20 * (1.0 - depth_f * 0.5));
          water_spec = spec * 0.88;
        } else {
          let h_land = clamp((elev_sph - sea_lvl) / max(0.32, 0.90 - sea_lvl), 0.0, 1.0);
          let sand_coast = vec3<f32>(0.72, 0.65, 0.46);
          let desert = vec3<f32>(0.70, 0.56, 0.34);
          let savanna = vec3<f32>(0.40, 0.49, 0.22);
          let lush_forest = mix(vec3<f32>(0.09, 0.34, 0.13), in.color0.rgb * 1.15, 0.38);
          let mtn_rock = mix(vec3<f32>(0.36, 0.33, 0.30), vec3<f32>(0.54, 0.51, 0.47), crust_comp);
          let raw_basalt = mix(vec3<f32>(0.10, 0.09, 0.10), vec3<f32>(0.24, 0.20, 0.18), crust_comp);
          // Rich multi-biome vegetation driven directly by GPU Hadley-cell & watershed moisture (NASA Blue Marble palette!)
          let humid_w = clamp(moist_r * 1.10 - h_land * 0.24 + micro_g * 0.7, 0.0, 1.0);
          var bio_col = mix(desert, savanna, smoothstep(0.18, 0.42, humid_w));
          bio_col = mix(bio_col, lush_forest, smoothstep(0.38, 0.68, humid_w));
          bio_col = mix(raw_basalt, bio_col, bio_cool_f);
          // Thin sandy coastline rim right above sea level
          surf = mix(mix(raw_basalt, sand_coast, rainout_f), bio_col, smoothstep(0.0, 0.045, h_land));
          // Subtle deep-sapphire dendritic river threads only in peak MFD valley bottoms (ZERO neon turquoise blotches!)
          let river_v = smoothstep(0.91, 0.96, moist_r) * (1.0 - smoothstep(0.14, 0.40, h_land)) * rainout_f;
          surf = mix(surf, vec3<f32>(0.04, 0.24, 0.48), river_v * 0.62);
          surf = mix(surf, mix(raw_basalt, mtn_rock, bio_cool_f), smoothstep(0.42, 0.74, h_land + crust_comp * 0.14));
          surf = mix(surf, vec3<f32>(0.94, 0.97, 1.00), smoothstep(0.68, 0.88, h_land) * bio_cool_f);
          bump_strength = 0.42 + 0.68 * h_land;
          is_land_hab = (1.0 - smoothstep(0.30, 0.72, h_land)) * (1.0 - smoothstep(0.58, 0.84, abs(n_hit.y))) * bio_cool_f;
          // Active subduction/rift volcanic glow + continuous cooling crust magma fissures during late planetary genesis!
          let rift_cool = cool_heat * clamp(cool_crack * 1.15 + max(0.0, thermal_v - 0.55) * 0.55, 0.0, 1.0);
          if (thermal_v > 0.78 || rift_cool > 0.24) {
            let v_glow = max(smoothstep(0.78, 0.98, thermal_v), smoothstep(0.24, 0.85, rift_cool));
            let cool_lava_c = mix(vec3<f32>(0.72, 0.12, 0.015), vec3<f32>(0.98, 0.38, 0.05), clamp(cool_heat * 0.8 + thermal_v * 0.3, 0.0, 1.0));
            em_volc = cool_lava_c * v_glow * (0.85 + 0.55 * cool_heat);
            em_temp_k = mix(em_temp_k, 1450.0, v_glow);
          }
        }
        let polar = smoothstep(0.77, 0.91, abs(n_hit.y) + elev_sph * 0.08 + micro_g) * bio_cool_f;
        surf = mix(surf, vec3<f32>(0.92, 0.96, 1.00), polar);
        bump_strength = bump_strength * (1.0 - polar * 0.72);
        is_land_hab = is_land_hab * (1.0 - polar);
      } else {
        // Stagnant-lid cratered / arid / iron / carbon / sulfur-volcanic worlds driven directly by SPH geology!
        let h_n = clamp(elev_sph * 0.5 + 0.5, 0.0, 1.0);
        let mare_col = in.color1.rgb * 0.76;
        let high_col = in.color0.rgb * (0.86 + 0.24 * crust_comp + micro_g);
        surf = mix(mare_col, high_col, smoothstep(0.24, 0.76, h_n + crust_comp * 0.18));
        surf = mix(surf, vec3<f32>(0.10, 0.08, 0.09), cool_heat * 0.65);
        let ejecta_bright = smoothstep(0.30, 0.44, crust_comp) * (1.0 - smoothstep(0.46, 0.62, crust_comp));
        surf = mix(surf, min(vec3<f32>(1.0), in.color0.rgb * 1.24), ejecta_bright * 0.32 * bio_cool_f);
        let polar = smoothstep(0.84, 0.94, abs(n_hit.y) + micro_g) * bio_cool_f;
        surf = mix(surf, vec3<f32>(0.88, 0.91, 0.95), polar * select(0.0, 0.85, in.color1.w > 0.12));
        let is_sulfur_volc = (in.color0.r > 0.85 && in.color0.g > 0.72 && in.color0.b < 0.45 && in.color1.w < 0.05);
        let dry_cool_rift = cool_heat * clamp(cool_crack * 1.15 + max(0.0, thermal_v - 0.58) * 0.45, 0.0, 1.0);
        if (is_sulfur_volc) {
          let caldera = smoothstep(0.26, 0.42, thermal_v + micro_g * 1.4);
          let lava_spot = smoothstep(0.34, 0.44, thermal_v);
          surf = mix(surf, vec3<f32>(0.12, 0.09, 0.08), caldera * 0.85);
          em_volc = vec3<f32>(1.0, 0.38, 0.06) * lava_spot * 2.2;
          em_temp_k = mix(em_temp_k, 1480.0, lava_spot);
        } else if (thermal_v > 0.76 || dry_cool_rift > 0.24) {
          let v_glow = max(smoothstep(0.76, 0.96, thermal_v), smoothstep(0.24, 0.85, dry_cool_rift));
          surf = mix(surf, vec3<f32>(0.09, 0.07, 0.07), v_glow * 0.65);
          em_volc = mix(vec3<f32>(0.76, 0.14, 0.015), vec3<f32>(0.98, 0.36, 0.04), cool_heat) * v_glow * (0.95 + 0.45 * cool_heat);
          em_temp_k = mix(em_temp_k, 1450.0, v_glow);
        }
        bump_strength = 0.52;
        is_land_hab = (1.0 - smoothstep(0.55, 0.82, abs(n_hit.y))) * 0.65 * bio_cool_f;
      }
    } else {
      // Lightweight fallback for distant non-focused planets in L2 system view
      let elev = fbm5(n_hit * 3.4 + seed_v);
      detail = fbm5(n_hit * 14.0 + seed_v * 1.7);
      elev_center = elev;
      if (has_ocean) {
        let sea_lvl = 0.51;
        if (elev < sea_lvl) {
          let depth_f = clamp((sea_lvl - elev) / 0.26, 0.0, 1.0);
          let shelf = mix(vec3<f32>(0.10, 0.62, 0.76), vec3<f32>(0.06, 0.36, 0.64), smoothstep(0.0, 0.22, depth_f));
          surf = mix(shelf, in.color1.rgb * 0.68, smoothstep(0.16, 0.95, depth_f));
          water_spec = spec * 0.74;
        } else {
          let h_land = clamp((elev - sea_lvl) / 0.32, 0.0, 1.0);
          let desert = vec3<f32>(0.68, 0.58, 0.38);
          let mtn = vec3<f32>(0.48, 0.46, 0.44);
          let arid = smoothstep(0.25, 0.72, detail) * (1.0 - abs(n_hit.y));
          surf = mix(in.color0.rgb * (0.75 + 0.45 * detail), desert, arid * 0.55);
          surf = mix(surf, mtn, smoothstep(0.42, 0.85, h_land));
          surf = mix(surf, vec3<f32>(0.92, 0.95, 0.98), smoothstep(0.76, 0.95, h_land));
          bump_strength = 0.32 + 0.58 * h_land;
          is_land_hab = (1.0 - smoothstep(0.28, 0.68, h_land)) * (1.0 - smoothstep(0.55, 0.82, abs(n_hit.y)));
        }
        let polar = smoothstep(0.76, 0.90, abs(n_hit.y) + (detail - 0.5) * 0.14);
        surf = mix(surf, vec3<f32>(0.90, 0.94, 0.98), polar);
        bump_strength = bump_strength * (1.0 - polar * 0.75);
        is_land_hab = is_land_hab * (1.0 - polar);
      } else {
        let crater = smoothstep(0.32, 0.68, detail);
        surf = mix(in.color1.rgb, in.color0.rgb, clamp(elev * 1.15 - 0.1 + 0.25 * crater, 0.0, 1.0));
        let polar = smoothstep(0.84, 0.94, abs(n_hit.y) + (detail - 0.5) * 0.08);
        surf = mix(surf, vec3<f32>(0.88, 0.90, 0.94), polar * select(0.0, 0.85, in.color1.w > 0.12));
        let is_sulfur_volc = (in.color0.r > 0.85 && in.color0.g > 0.72 && in.color0.b < 0.45 && in.color1.w < 0.05);
        if (is_sulfur_volc) {
          let cald_n = fbm5(n_hit * 19.0 + seed_v * 2.1);
          let caldera = smoothstep(0.74, 0.86, cald_n);
          let lava_spot = smoothstep(0.82, 0.90, cald_n);
          surf = mix(surf, vec3<f32>(0.12, 0.09, 0.08), caldera * 0.85);
          em_volc = vec3<f32>(1.0, 0.38, 0.06) * lava_spot * 2.2;
          em_temp_k = mix(em_temp_k, 1480.0, lava_spot);
        }
        bump_strength = 0.58;
        is_land_hab = (1.0 - smoothstep(0.55, 0.82, abs(n_hit.y))) * 0.65;
      }
    }

    // Crisp 1-texel central-difference topographic relief normal + 4-step horizon self-shadowing (ZERO blurry bumps!)
    var ndl_relief = ndl;
    if (bump_strength > 0.01) {
      let up_ref = select(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), abs(n_hit.y) > 0.92);
      let t1 = normalize(cross(up_ref, n_hit));
      let t2 = cross(n_hit, t1);
      if (live_sph_geo) {
        let gw = u32(round(cam.sph_geo.x));
        let gh = u32(round(cam.sph_geo.y));
        let eps_g = 3.14159265 / max(64.0, f32(gh));
        let e1p = sample_sph_geology(normalize(n_hit + t1 * eps_g), gw, gh).x;
        let e1m = sample_sph_geology(normalize(n_hit - t1 * eps_g), gw, gh).x;
        let e2p = sample_sph_geology(normalize(n_hit + t2 * eps_g), gw, gh).x;
        let e2m = sample_sph_geology(normalize(n_hit - t2 * eps_g), gw, gh).x;
        let relief_gain = bump_strength * select(2.45, 3.6, disp_amp > 0.10);
        let n_relief = normalize(n_hit + (t1 * (e1m - e1p) + t2 * (e2m - e2p)) * relief_gain);
        ndl_relief = max(0.0, dot(n_relief, light_dir));
        // Real 4-step topographic self-shadowing across mountain cordilleras, canyons & crater rims!
        if (disp_amp > 0.005 && raw_ndl > -0.04 && raw_ndl < 0.65) {
          let l_tang = light_dir - n_hit * raw_ndl;
          let lt_len = length(l_tang);
          if (lt_len > 1e-4) {
            let l_dir_t = l_tang / lt_len;
            let tan_alt = max(0.0, raw_ndl) / lt_len;
            var topo_sh = 1.0;
            for (var sh = 1u; sh <= 4u; sh = sh + 1u) {
              let d_ang = f32(sh) * 0.011;
              let e_sh = sample_sph_geology(normalize(n_hit + l_dir_t * d_ang), gw, gh).x;
              let dh_sh = (e_sh - elev_center) * disp_amp;
              if (dh_sh > d_ang * tan_alt + 0.0005) {
                topo_sh = min(topo_sh, clamp(1.0 - (dh_sh - d_ang * tan_alt) * 24.0, 0.28, 1.0));
              }
            }
            ndl_relief = ndl_relief * topo_sh;
          }
        }
      } else {
        let eps_b = 0.014;
        let e1 = fbm5(normalize(n_hit + t1 * eps_b) * 3.4 + seed_v) + 0.24 * fbm5(normalize(n_hit + t1 * eps_b) * 14.0 + seed_v * 1.7);
        let e2 = fbm5(normalize(n_hit + t2 * eps_b) * 3.4 + seed_v) + 0.24 * fbm5(normalize(n_hit + t2 * eps_b) * 14.0 + seed_v * 1.7);
        let e0 = elev_center + 0.24 * detail;
        let n_relief = normalize(n_hit + (t1 * (e0 - e1) + t2 * (e0 - e2)) * (bump_strength * 5.2));
        ndl_relief = max(0.0, dot(n_relief, light_dir));
      }
    }

    // Live zero-copy GPU baroclinic CFD clouds (flow-map advected!), dust storms, Paschen lightning, & smooth 3D aurorae!
    let live_atmo = cam.extra2.w > 0.5 && in.inst_id == u32(round(cam.extra2.z));
    var em_lightning = vec3<f32>(0.0);
    var em_aurora = vec3<f32>(0.0);
    var em_cities = vec3<f32>(0.0);
    var cloud_cover = 0.0;
    if (live_atmo) {
      let aw = u32(round(cam.extra2.x));
      let ah = u32(round(cam.extra2.y));
      let av = sample_live_atmo_vis(n_hit, aw, ah);
      let cfd = sample_live_atmo_flow(n_hit, aw, ah);
      let east1 = normalize(vec3<f32>(-n_hit.z, 0.0, n_hit.x) + vec3<f32>(1e-5, 0.0, 0.0));
      let north1 = cross(east1, n_hit);
      let flow1 = east1 * cfd.x + north1 * cfd.y;
      let ph0 = fract(cam.cam_pos.w * 0.14);
      let ph1 = fract(ph0 + 0.5);
      let ph_w = abs(2.0 * ph0 - 1.0);
      let pa0 = normalize(n_hit - flow1 * (ph0 * 0.20));
      let pa1 = normalize(n_hit - flow1 * (ph1 * 0.20));
      let wisp1 = mix(fbm5(pa0 * 10.5 + seed_v * 0.6), fbm5(pa1 * 10.5 + seed_v * 0.6), ph_w);
      let wisp2 = mix(fbm5(pa0 * 23.0 - seed_v), fbm5(pa1 * 23.0 - seed_v), ph_w);
      let cloud_wisp = clamp(wisp1 * 0.68 + wisp2 * 0.42, 0.0, 1.0);
      let vort_boost = smoothstep(0.35, 1.6, abs(cfd.z)) * 0.24;
      let cloud_raw = (av.x + vort_boost) * (0.55 + 0.85 * cloud_wisp);
      let cloud_d = smoothstep(0.18, 0.70, cloud_raw) * 0.90;
      cloud_cover = cloud_d;
      // Crisp 3D cloud drop-shadow cast onto ocean & continents directly away from host-star light_dir!
      let n_sh = normalize(n_hit + light_dir * 0.018);
      let av_sh = sample_live_atmo_vis(n_sh, aw, ah);
      let cloud_shadow = smoothstep(0.22, 0.72, av_sh.x * (0.55 + 0.85 * cloud_wisp)) * 0.30 * ndl;
      surf = surf * (1.0 - cloud_shadow);
      // Vivid billowing rust-amber aeolian dust fronts modulated by fine turbulent eddies
      let dust_d = smoothstep(0.15, 0.66, av.y * (0.65 + 0.65 * wisp1)) * 0.80;
      surf = mix(surf, vec3<f32>(0.88, 0.48, 0.22), dust_d * select(0.76, 0.18, has_ocean));
      surf = mix(surf, vec3<f32>(0.97, 0.985, 1.0), cloud_d * 0.92);
      water_spec = water_spec * (1.0 - max(cloud_d, dust_d));
      // Real Paschen dielectric-breakdown lightning: crisp localized convective pinpoint flashes inside active storm cores!
      let spark_n = fbm5(n_hit * 34.0 + vec3<f32>(cam.cam_pos.w * 1.8, -cam.cam_pos.w * 1.3, 4.1));
      let spark_core = smoothstep(0.56, 0.82, spark_n);
      let bolt = smoothstep(0.42, 1.20, av.z) * spark_core;
      let bolt_col = mix(vec3<f32>(0.84, 0.56, 1.0), vec3<f32>(0.76, 0.95, 1.0), select(0.20, 1.0, has_ocean));
      em_lightning = bolt_col * bolt * (2.6 + 2.2 * (1.0 - ndl));
      // Smooth full-resolution 3D Birkeland polar auroral curtains (emerald 557.7 nm O I -> violet N2+)!
      let aur = eval_filament_aurora(n_hit, av.w, cam.cam_pos.w, seed_v);
      em_aurora = mix(vec3<f32>(0.12, 0.96, 0.54), vec3<f32>(0.58, 0.28, 1.0), clamp((abs(n_hit.y) - 0.80) * 4.0, 0.0, 1.0)) * aur * (0.45 + 0.95 * (1.0 - ndl));
      em_uv = aur * 1.25;
      em_rad = bolt * 1.2;
    } else if (in.color1.w > 0.45) {
      let c_raw = fbm5(n_hit * 4.8 + vec3<f32>(cam.cam_pos.w * 0.012, 2.4, -1.9) + seed_v);
      let cloud = smoothstep(0.52, 0.74, c_raw) * 0.78;
      cloud_cover = cloud;
      surf = mix(surf, vec3<f32>(0.95, 0.97, 1.0), cloud);
      water_spec = water_spec * (1.0 - cloud);
    }

    // Emergent orbital night-side civilization city light networks & radio technosignatures (civTechK >= 0.45)!
    if (civ_k >= 0.45 && is_land_hab > 0.05) {
      let night_w = 1.0 - smoothstep(-0.14, 0.08, raw_ndl);
      let c_net = fbm5(n_hit * 28.0 + seed_v * 2.3);
      let c_hub = fbm5(n_hit * 64.0 - seed_v * 1.9);
      let city_mask = smoothstep(0.58, 0.80, c_net) * smoothstep(0.50, 0.78, c_hub) * is_land_hab * (1.0 - cloud_cover * 0.7);
      let tech_gain = clamp((civ_k - 0.40) * 1.8, 0.0, 1.6);
      em_cities = vec3<f32>(1.0, 0.78, 0.36) * city_mask * night_w * tech_gain * 1.45;
      em_rad = em_rad + city_mask * tech_gain * 1.85;
    }

    let ndl_eff = mix(ndl_relief, ndl, cloud_cover * 0.85);
    let cool_atm_h = select(0.0, clamp(cam.extra0.z, 0.0, 1.0), live_sph_geo);
    let rayleigh_base = mix(vec3<f32>(0.78, 0.50, 0.30), vec3<f32>(0.30, 0.68, 1.0), select(0.25, 1.0, has_ocean));
    let rayleigh = mix(rayleigh_base, vec3<f32>(1.0, 0.44, 0.14), cool_atm_h * 0.82);
    let atm = rayleigh * fresnel * max(in.color1.w, cool_atm_h * 0.68) * 0.98;
    let sunset = mix(vec3<f32>(0.98, 0.44, 0.14), vec3<f32>(1.0, 0.52, 0.18), select(0.0, 1.0, has_ocean)) * term_sunset * (0.16 + 0.24 * cloud_cover + 0.25 * fresnel) * star_dir_l;
    col = surf * (vec3<f32>(0.028) + star_dir_l * (0.03 + 0.98 * ndl_eff) * soft_term) + sunset + star_dir_l * water_spec * ndl + atm * (vec3<f32>(0.03) + star_dir_l * (0.14 + 0.86 * ndl)) + em_lightning + em_aurora + em_cities + em_volc;
  } else if (kind == 3u) {
    // Cratered Moon / Icy World / Atmospheric Ice Giant (Uranus & Neptune):
    // Gate rocky crater relief strictly on airless moons (atm < 0.28) so Ice Giants have silky atmospheric methane bands!
    let crater_w = 1.0 - smoothstep(0.08, 0.28, in.color1.w);
    let live_sph3 = cam.sph_geo.x > 1.5 && in.inst_id == u32(round(cam.sph_geo.z));
    let up_r3 = select(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), abs(n_hit.y) > 0.92);
    let t1_3 = normalize(cross(up_r3, n_hit));
    let t2_3 = cross(n_hit, t1_3);
    var ndl_c = ndl;
    var base = in.color0.rgb;
    if (live_sph3) {
      let gw3 = u32(round(cam.sph_geo.x));
      let gh3 = u32(round(cam.sph_geo.y));
      let eps3 = 3.14159265 / max(64.0, f32(gh3));
      let g3 = sample_sph_geology(n_hit, gw3, gh3);
      let g3xp = sample_sph_geology(normalize(n_hit + t1_3 * eps3), gw3, gh3).x;
      let g3xm = sample_sph_geology(normalize(n_hit - t1_3 * eps3), gw3, gh3).x;
      let g3yp = sample_sph_geology(normalize(n_hit + t2_3 * eps3), gw3, gh3).x;
      let g3ym = sample_sph_geology(normalize(n_hit - t2_3 * eps3), gw3, gh3).x;
      let relief3 = select(2.8 * max(0.35, crater_w), 3.4, disp_amp > 0.10);
      let n_crater = normalize(n_hit + (t1_3 * (g3xm - g3xp) + t2_3 * (g3ym - g3yp)) * relief3);
      ndl_c = max(0.0, dot(n_crater, light_dir));
      if (disp_amp > 0.005 && raw_ndl > -0.04 && raw_ndl < 0.72) {
        let l_tang3 = light_dir - n_hit * raw_ndl;
        let lt_len3 = length(l_tang3);
        if (lt_len3 > 1e-4) {
          let l_dir3 = l_tang3 / lt_len3;
          let tan_alt3 = max(0.0, raw_ndl) / lt_len3;
          var sh3 = 1.0;
          for (var s3 = 1u; s3 <= 4u; s3 = s3 + 1u) {
            let da3 = f32(s3) * 0.014;
            let e_s3 = sample_sph_geology(normalize(n_hit + l_dir3 * da3), gw3, gh3).x;
            let dh3 = (e_s3 - g3.x) * disp_amp;
            if (dh3 > da3 * tan_alt3 + 0.0006) {
              sh3 = min(sh3, clamp(1.0 - (dh3 - da3 * tan_alt3) * 26.0, 0.22, 1.0));
            }
          }
          ndl_c = ndl_c * sh3;
        }
      }
      base = mix(in.color1.rgb, in.color0.rgb, clamp(g3.x * 0.55 + 0.45 + g3.y * 0.25, 0.0, 1.0));
      // Cryo-tectonic rifts & subsurface-ocean tidal plumes driven by live SPH thermal channel!
      if (g3.z > 0.36) {
        let rift_c = smoothstep(0.36, 0.80, g3.z);
        let stain_col = mix(vec3<f32>(0.54, 0.30, 0.20), vec3<f32>(0.34, 0.78, 0.98), smoothstep(0.84, 0.95, in.color0.b));
        base = mix(base, stain_col, rift_c * 0.72);
      }
    } else {
      let n1 = fbm5(n_hit * 6.0 + seed_v);
      let n2 = fbm5(n_hit * 18.0 - seed_v);
      let c_x = fbm5(normalize(n_hit + t1_3 * 0.012) * 18.0 - seed_v);
      let c_y = fbm5(normalize(n_hit + t2_3 * 0.012) * 18.0 - seed_v);
      let n_crater = normalize(n_hit + (t1_3 * (n2 - c_x) + t2_3 * (n2 - c_y)) * (2.4 * crater_w));
      ndl_c = max(0.0, dot(n_crater, light_dir));
      let ig_band = 0.5 + 0.32 * sin(n_hit.y * 14.0 + n1 * 1.4) + 0.18 * fbm5(n_hit * vec3<f32>(3.0, 11.0, 3.0) + seed_v);
      let rocky_mix = clamp(0.2 + 0.7 * n1 + 0.25 * n2, 0.0, 1.0);
      base = mix(in.color1.rgb, in.color0.rgb, mix(clamp(ig_band, 0.18, 0.92), rocky_mix, crater_w));
      if (in.color0.b > 0.68 && in.color1.w < 0.12) {
        let l1 = abs(fbm5(n_hit * 8.5 + seed_v) - 0.5);
        let l2 = abs(fbm5(n_hit * 13.5 - seed_v * 1.6) - 0.5);
        let crack = max(1.0 - smoothstep(0.008, 0.032, l1), 1.0 - smoothstep(0.008, 0.028, l2));
        let stain_col = mix(vec3<f32>(0.54, 0.30, 0.20), vec3<f32>(0.36, 0.72, 0.96), smoothstep(0.88, 0.96, in.color0.b));
        base = mix(base, stain_col, crack * 0.62);
      }
    }
    var em_ice = vec3<f32>(0.0);
    if (cam.extra2.w > 0.5 && in.inst_id == u32(round(cam.extra2.z))) {
      let aw = u32(round(cam.extra2.x));
      let ah = u32(round(cam.extra2.y));
      let av = sample_live_atmo_vis(n_hit, aw, ah);
      let cfd3 = sample_live_atmo_flow(n_hit, aw, ah);
      let east3 = normalize(vec3<f32>(-n_hit.z, 0.0, n_hit.x) + vec3<f32>(1e-5, 0.0, 0.0));
      let north3 = cross(east3, n_hit);
      let flow3 = east3 * cfd3.x + north3 * cfd3.y;
      let ph0 = fract(cam.cam_pos.w * 0.16);
      let ph1 = fract(ph0 + 0.5);
      let ph_w = abs(2.0 * ph0 - 1.0);
      let band3 = mix(
        fbm5(normalize(n_hit - flow3 * (ph0 * 0.22)) * vec3<f32>(6.0, 22.0, 6.0) + seed_v),
        fbm5(normalize(n_hit - flow3 * (ph1 * 0.22)) * vec3<f32>(6.0, 22.0, 6.0) + seed_v),
        ph_w
      );
      base = mix(base, vec3<f32>(0.88, 0.95, 1.0), clamp(av.x * 0.45 + smoothstep(0.42, 0.82, band3) * 0.32 + smoothstep(0.35, 1.4, abs(cfd3.z)) * 0.22, 0.0, 0.68));
      let bolt = smoothstep(0.32, 1.15, av.z);
      em_ice = em_ice + vec3<f32>(0.68, 0.92, 1.0) * bolt * (1.7 + 1.2 * (1.0 - ndl));
      let aur3 = eval_filament_aurora(n_hit, av.w, cam.cam_pos.w, seed_v);
      em_ice = em_ice + vec3<f32>(0.24, 0.96, 0.72) * aur3 * (0.45 + 0.90 * (1.0 - ndl));
      em_uv = aur3 * 1.2;
      em_rad = bolt * 1.1 + aur3 * 0.6;
    }
    let atm = vec3<f32>(0.42, 0.76, 1.0) * fresnel * in.color1.w;
    col = base * (vec3<f32>(0.03) + star_dir_l * (0.04 + 0.96 * ndl_c) * soft_term) + star_dir_l * spec * 0.16 * ndl + atm * (vec3<f32>(0.03) + star_dir_l * (0.15 + 0.85 * ndl)) + em_ice;
  } else if (kind == 5u) {
    // Event horizon shadow OR glowing atomic nucleus pin
    let is_black_hole = dot(in.color0.rgb, in.color0.rgb) < 0.001;
    if (is_black_hole) {
      let photon_rim = pow(max(0.0, 1.0 - ndv), 4.8);
      col = vec3<f32>(1.0, 0.88, 0.64) * photon_rim * 1.4;
      em_xr = photon_rim * 1.8;
    } else {
      let base = mix(in.color0.rgb, in.color1.rgb, 0.25 + 0.45 * fresnel);
      col = base * (0.3 + 0.75 * ndl) + vec3<f32>(1.0) * spec * 0.65;
    }
  } else if (kind == 7u) {
    // Kind 7: Incandescent Hadean Magma Ocean World driven by live SPH mantle convection plumes & thin basalt rafts!
    let live_sph7 = cam.sph_geo.x > 1.5 && in.inst_id == u32(round(cam.sph_geo.z));
    var rift = 0.5;
    var basalt = vec3<f32>(0.14, 0.10, 0.10);
    if (live_sph7) {
      let g7 = sample_sph_geology(n_hit, u32(round(cam.sph_geo.x)), u32(round(cam.sph_geo.y)));
      rift = clamp(g7.z * 1.15 - g7.y * 0.45, 0.0, 1.0);
      basalt = mix(vec3<f32>(0.09, 0.07, 0.08), vec3<f32>(0.26, 0.18, 0.15), g7.y);
    } else {
      let crust = fbm5(n_hit * 4.2 + seed_v);
      let cracks = fbm5(n_hit * 13.5 - seed_v * 1.4);
      rift = smoothstep(0.46, 0.64, abs(crust - 0.50) * -2.0 + 0.72 + (cracks - 0.5) * 0.35);
      basalt = mix(vec3<f32>(0.10, 0.08, 0.09), vec3<f32>(0.24, 0.16, 0.14), cracks);
    }
    let lava = mix(vec3<f32>(0.96, 0.22, 0.04), vec3<f32>(1.0, 0.86, 0.32), smoothstep(0.35, 0.92, rift));
    let atm = vec3<f32>(1.0, 0.48, 0.18) * fresnel * in.color1.w * 0.9;
    col = basalt * (vec3<f32>(0.04) + star_dir_l * (0.06 + 0.85 * ndl) * soft_term) + lava * rift * 1.65 + atm * (vec3<f32>(0.08) + star_dir_l * (0.30 + 0.65 * ndl));
    em_temp_k = mix(850.0, 2200.0, rift);
  } else {
    // Kind 6: Quantized L7 Nuclear Protons (warm ruby-amber) & Neutrons (cool sapphire-silver)
    let base = mix(in.color0.rgb, in.color1.rgb, 0.22 + 0.55 * fresnel);
    col = base * (0.28 + 0.76 * ndl) + vec3<f32>(1.0, 0.96, 0.92) * spec * 0.72 + in.color0.rgb * fresnel * 0.35;
  }

  col = em_sensor_map_rgb(col, em_temp_k, em_uv, em_xr, em_rad, 0.0);
  let world_hit = cam.cam_pos.xyz + rd * t_hit;
  let clip = cam.view_proj * vec4<f32>(world_hit, 1.0);
  var out: FsOut;
  out.color = vec4<f32>(col, 1.0);
  out.depth = eval_frag_depth(clip, cam.em_aux.w);
  return out;
}
`;

// Zero-copy WebGPU MD Atom Sphere Shader reading `mdSession.positionsBuffer` & `velocitiesBuffer` directly!
// Preserves true Gate 1 optical reflectance for solid crystals while smoothly highlighting molten/vapor atoms!
const MD_SPHERE_WGSL = /* wgsl */ `
${CAMERA_WGSL}
${EM_SENSOR_WGSL}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> md_pos: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> md_vel: array<vec4<f32>>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) center: vec3<f32>,
  @location(1) radius: f32,
  @location(2) world_quad: vec3<f32>,
  @location(3) tint: vec3<f32>,
  @location(4) alpha_fade: f32,
};

struct FsOut {
  @location(0) color: vec4<f32>,
  @builtin(frag_depth) depth: f32,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let uv = corners[vid % 6u];
  let p_raw = md_pos[iid];
  let v_raw = md_vel[iid];
  let half_box = cam.extra0.xyz;
  let world_scale = cam.extra0.w;
  let radius = cam.extra1.w;
  let alpha_fade = clamp(cam.extra2.x, 0.0, 1.0);
  let ideal_coord = max(4.0, cam.extra2.w);

  let center = (p_raw.xyz - half_box) * world_scale;
  let raw_coord = p_raw.w;
  // On frame 0 before first neighbor build raw_coord can be 0; treat 0 as crystal base color!
  let coord_frac = select(clamp(raw_coord / ideal_coord, 0.0, 1.2), 1.0, raw_coord < 0.01);
  let speed = length(v_raw.xyz);
  let heat = clamp(speed * 1.4, 0.0, 1.0);

  // True Gate 1 optical reflectance for solid crystals; warm amber glow on melted low-coord atoms
  let base_rgb = cam.extra1.rgb;
  let liq_rgb = mix(base_rgb, vec3<f32>(1.0, 0.56, 0.20), 0.52);
  let vap_rgb = mix(base_rgb, vec3<f32>(0.42, 0.84, 1.0), 0.55);
  var tint = mix(vap_rgb, liq_rgb, smoothstep(0.08, 0.35, coord_frac));
  tint = mix(tint, base_rgb, smoothstep(0.35, 0.72, coord_frac));
  tint = mix(tint, vec3<f32>(1.0, 0.82, 0.48), heat * 0.22);

  let to_cam = normalize(cam.cam_pos.xyz - center);
  let right = normalize(cross(cam.cam_up.xyz, to_cam));
  let up = cross(to_cam, right);
  let world_quad = center + to_cam * (radius * 0.15) + right * (uv.x * radius * 1.24) + up * (uv.y * radius * 1.24);

  var out: VsOut;
  out.pos = apply_log_depth_vs(cam.view_proj * vec4<f32>(world_quad, 1.0), cam.em_aux.w);
  out.center = center;
  out.radius = radius;
  out.world_quad = world_quad;
  out.tint = tint;
  out.alpha_fade = alpha_fade;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> FsOut {
  let ro = cam.cam_pos.xyz - in.center;
  let rd = normalize(in.world_quad - cam.cam_pos.xyz);
  let b = dot(ro, rd);
  let c = dot(ro, ro) - in.radius * in.radius;
  let disc = b * b - c;
  if (disc < 0.0) { discard; }
  let t_hit = -b - sqrt(disc);
  if (t_hit < 0.001) { discard; }
  let p_hit = ro + rd * t_hit;
  let n = normalize(p_hit);
  let light = normalize(vec3<f32>(0.62, 0.80, 0.52));
  let light2 = normalize(vec3<f32>(-0.55, -0.30, 0.75));
  let view = -rd;
  let ndl = max(0.0, dot(n, light));
  let ndl2 = max(0.0, dot(n, light2));
  let ndv_m = max(0.0, dot(n, view));
  let spec = pow(max(0.0, dot(n, normalize(light + view))), 56.0);
  // Schlick Fresnel + deep-lattice cavity ambient occlusion for crisp crystal facets!
  let f0 = 0.08;
  let schlick = f0 + (1.0 - f0) * pow(max(0.0, 1.0 - ndv_m), 4.0);
  let cav_ao = 0.72 + 0.28 * smoothstep(-0.35, 0.85, n.y);
  var col = in.tint * (0.20 + 0.80 * ndl + 0.20 * ndl2) * cav_ao + vec3<f32>(1.0, 0.98, 0.94) * spec * 0.78 + mix(in.tint, vec3<f32>(0.72, 0.90, 1.0), 0.45) * schlick * 0.42;
  col = em_sensor_map_rgb(col, max(50.0, cam.em_aux.x), 0.0, 0.0, 0.0, 0.0);
  let clip = cam.view_proj * vec4<f32>(in.center + p_hit, 1.0);
  var out: FsOut;
  out.color = vec4<f32>(col * in.alpha_fade, in.alpha_fade);
  out.depth = eval_frag_depth(clip, cam.em_aux.w);
  return out;
}
`;

// Relativistic Doppler-Beamed Accretion Disk (Galactic Core SMBH) & Planetary Rings (Saturn)
const DISK_WGSL = /* wgsl */ `
${CAMERA_WGSL}
${EM_SENSOR_WGSL}

struct DiskInstance {
  center_r_in: vec4<f32>,
  normal_r_out: vec4<f32>,
  color_kind: vec4<f32>,
  shadow_info: vec4<f32>, // x = planet_radius, y = oblate_f, z = pad, w = pad
};

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> disks: array<DiskInstance>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) local_xy: vec2<f32>,
  @location(1) r_in: f32,
  @location(2) r_out: f32,
  @location(3) color_kind: vec4<f32>,
  @location(4) world_pos: vec3<f32>,
  @location(5) center: vec3<f32>,
  @location(6) ring_n: vec3<f32>,
  @location(7) shadow_info: vec2<f32>,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let uv = corners[vid % 6u];
  let d = disks[iid];
  let n = normalize(d.normal_r_out.xyz);
  let ref_v = select(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), abs(n.y) > 0.9);
  let t1 = normalize(cross(ref_v, n));
  let t2 = cross(n, t1);
  let r_out = d.normal_r_out.w;
  let world_pos = d.center_r_in.xyz + (t1 * uv.x + t2 * uv.y) * r_out;

  var out: VsOut;
  out.pos = apply_log_depth_vs(cam.view_proj * vec4<f32>(world_pos, 1.0), cam.em_aux.w);
  out.local_xy = uv * r_out;
  out.r_in = d.center_r_in.w;
  out.r_out = r_out;
  out.color_kind = d.color_kind;
  out.world_pos = world_pos;
  out.center = d.center_r_in.xyz;
  out.ring_n = n;
  out.shadow_info = d.shadow_info.xy;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let r = length(in.local_xy);
  if (r > in.r_out || r < in.r_in) { discard; }
  let kind = u32(round(in.color_kind.w));

  if (kind == 0u) {
    let u = clamp((r - in.r_in) / max(1e-4, in.r_out - in.r_in), 0.0, 1.0);
    let ang = atan2(in.local_xy.y, in.local_xy.x);
    let shear = 0.55 + 0.45 * sin(ang * 3.0 + 16.0 / (u + 0.22) - cam.cam_pos.w * 2.2);
    let rel_p = in.world_pos - in.center;
    let tang = normalize(vec3<f32>(-rel_p.z, 0.0, rel_p.x) + vec3<f32>(1e-5));
    let view_dir = normalize(cam.cam_pos.xyz - in.world_pos);
    let beta = 0.44 / sqrt(max(0.18, u + 0.16));
    let doppler = clamp(1.0 + beta * dot(tang, view_dir), 0.35, 1.92);
    let beam = doppler * doppler;

    let hot_inner = vec3<f32>(0.90, 0.96, 1.0);
    let mid_gold = vec3<f32>(1.0, 0.66, 0.24);
    let cool_red = vec3<f32>(0.76, 0.18, 0.06);
    var col = mix(hot_inner, mid_gold, smoothstep(0.0, 0.35, u));
    col = mix(col, cool_red, smoothstep(0.30, 0.95, u));
    col = mix(col, vec3<f32>(0.75, 0.92, 1.0), clamp((doppler - 1.0) * 0.55, 0.0, 0.5));
    let radial_fade = (1.0 - smoothstep(0.58, 1.0, u)) * smoothstep(0.0, 0.07, u);
    let alpha = clamp(radial_fade * (0.48 + 0.52 * shear) * 0.92, 0.0, 1.0);
    var out_c = col * beam * (0.62 + 0.52 * shear);
    if (cam.em_sensor.z > 0.5) {
      let disk_t = mix(1.2e7, 4500.0, smoothstep(0.0, 0.85, u));
      out_c = em_sensor_map_rgb(out_c, disk_t, (1.0 - u) * 1.1, (1.0 - u) * 2.2 * beam, 0.55 * beam, 0.0);
    }
    return vec4<f32>(out_c * alpha, alpha);
  } else {
    // Saturn / Exoplanet Cassini-division ring system (with planetary eclipse shadow & cold 85 K IR emission!)
    let u = clamp((r - in.r_in) / max(1e-4, in.r_out - in.r_in), 0.0, 1.0);
    let c_x = (u - 0.60) * 32.0;
    let e_x = (u - 0.88) * 55.0;
    let cassini = 1.0 - 0.88 * exp(-(c_x * c_x));
    let encke = 1.0 - 0.60 * exp(-(e_x * e_x));
    let ringlets = 0.72 + 0.28 * sin(u * 76.0) * cos(u * 27.0);
    let fade = smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.92, 1.0, u));
    // Analytical oblate-spheroid planet shadow cast onto back half of ring plane (true deep Cassini umbra!)
    let rel_p = in.world_pos - in.center;
    let to_star_r = cam.extra1.xyz - in.center;
    let ldir = select(
      normalize(cam.extra1.xyz),
      normalize(to_star_r),
      cam.extra1.w > 0.5 && length(to_star_r) > 1e-4
    );
    let view_r = normalize(cam.cam_pos.xyz - in.world_pos);
    let n_r = normalize(in.ring_n);
    let planet_r = select(in.r_in * 0.78, in.shadow_info.x, in.shadow_info.x > 1e-4);
    let oblate_r = clamp(in.shadow_info.y, 0.0, 0.16);
    let along = dot(rel_p, ldir);
    let perp_v = rel_p - ldir * along;
    // Account for planetary oblateness along the spin/ring normal axis when testing eclipse umbra
    let perp_pole = dot(perp_v, n_r);
    let perp_eq = perp_v - n_r * perp_pole;
    let inv_pole = 1.0 / max(0.80, 1.0 - oblate_r);
    let perp_r = sqrt(dot(perp_eq, perp_eq) + (perp_pole * inv_pole) * (perp_pole * inv_pole));
    // True pitch-dark planetary umbra (0.02 ambient bounce, retiring the 12% glowing floor!)
    let ring_shadow = select(1.0, smoothstep(planet_r * 0.96, planet_r * 1.04, perp_r) * 0.98 + 0.02, along < 0.0);
    // Physical icy water-frost regolith back-scattering Henyey-Greenstein phase (g = -0.35!) + Seeliger opposition surge + solar incidence obliquity!
    let cos_phase = dot(-view_r, ldir);
    let g_hg = -0.35;
    let hg_phase = (1.0 - g_hg * g_hg) / max(0.22, pow(max(0.15, 1.0 + g_hg * g_hg - 2.0 * g_hg * cos_phase), 1.5));
    let opp_surge = 1.0 + 0.34 * pow(max(0.0, dot(view_r, ldir)), 8.0);
    let sun_obliq = clamp(0.26 + 0.74 * abs(dot(n_r, ldir)), 0.24, 1.0);
    let phase_gain = clamp((0.62 + 0.38 * hg_phase * opp_surge) * sun_obliq, 0.25, 1.65);
    let alpha = clamp(fade * cassini * encke * ringlets * 0.76, 0.0, 0.88);
    let ring_star_l = cam.star_light.rgb * clamp(cam.star_light.w, 0.16, 1.85);
    var ring_c = in.color_kind.rgb * (0.85 + 0.25 * ringlets) * ring_shadow * phase_gain * ring_star_l;
    ring_c = em_sensor_map_rgb(ring_c, 85.0, 0.0, 0.0, 0.08, 0.0);
    return vec4<f32>(ring_c * alpha, alpha);
  }
}
`;

const LINE_WGSL = /* wgsl */ `
${CAMERA_WGSL}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;

struct VsIn {
  @location(0) pos: vec3<f32>,
  @location(1) color: vec4<f32>,
};

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@vertex
fn vs_main(in: VsIn) -> VsOut {
  var out: VsOut;
  out.pos = apply_log_depth_vs(cam.view_proj * vec4<f32>(in.pos, 1.0), cam.em_aux.w);
  out.color = in.color;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  return in.color;
}
`;

// Translucent 3D Woods-Saxon Nuclear Potential + Live Visscher TDSE Wave Crest surrounding quantized nucleons!
const NUCLEAR_VOL_WGSL = /* wgsl */ `
${CAMERA_WGSL}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> vol_data: array<vec4<f32>>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) ndc: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.ndc = pts[vid];
  return out;
}

fn fetch_vox(i: vec3<u32>, dim: u32) -> vec4<f32> {
  return vol_data[(i.z * dim + i.y) * dim + i.x];
}

fn sample_vol(p_unit: vec3<f32>, dim: u32) -> vec4<f32> {
  let d = f32(dim);
  let g = clamp((p_unit * 0.5 + 0.5) * d - 0.5, vec3<f32>(0.0), vec3<f32>(d - 1.001));
  let i0 = vec3<u32>(floor(g));
  let i1 = min(i0 + vec3<u32>(1u), vec3<u32>(dim - 1u));
  let f = fract(g);
  let c000 = fetch_vox(vec3<u32>(i0.x, i0.y, i0.z), dim);
  let c100 = fetch_vox(vec3<u32>(i1.x, i0.y, i0.z), dim);
  let c010 = fetch_vox(vec3<u32>(i0.x, i1.y, i0.z), dim);
  let c110 = fetch_vox(vec3<u32>(i1.x, i1.y, i0.z), dim);
  let c001 = fetch_vox(vec3<u32>(i0.x, i0.y, i1.z), dim);
  let c101 = fetch_vox(vec3<u32>(i1.x, i0.y, i1.z), dim);
  let c011 = fetch_vox(vec3<u32>(i0.x, i1.y, i1.z), dim);
  let c111 = fetch_vox(vec3<u32>(i1.x, i1.y, i1.z), dim);
  return mix(mix(mix(c000, c100, f.x), mix(c010, c110, f.x), f.y),
             mix(mix(c001, c101, f.x), mix(c011, c111, f.x), f.y), f.z);
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let dim = u32(round(cam.extra0.x));
  let box_r = max(0.5, cam.extra0.y);
  let tdse_tun = cam.extra0.z;
  let tdse_crest_r = clamp(cam.extra0.w, 0.36, 0.95);
  let alpha_mul = clamp(cam.extra1.x, 0.0, 1.0);
  if (alpha_mul < 0.01) { discard; }

  let fov = cam.cam_up.w;
  let aspect = cam.cam_right.w;
  let ro = cam.cam_pos.xyz / box_r;
  let rd = normalize(
    cam.cam_fwd.xyz
    + cam.cam_right.xyz * (in.ndc.x * aspect * fov)
    + cam.cam_up.xyz * (in.ndc.y * fov)
  );

  let inv_rd = 1.0 / (rd + select(vec3<f32>(0.0), vec3<f32>(1e-6), abs(rd) < vec3<f32>(1e-6)));
  let t0 = (-1.0 - ro) * inv_rd;
  let t1 = (1.0 - ro) * inv_rd;
  let tmin_v = min(t0, t1);
  let tmax_v = max(t0, t1);
  let t_enter = max(0.0, max(tmin_v.x, max(tmin_v.y, tmin_v.z)));
  let t_exit = min(tmax_v.x, min(tmax_v.y, tmax_v.z));
  if (t_exit <= t_enter) { discard; }

  // 64-step raymarch with Interleaved Gradient Noise (IGN) jitter eliminating slice banding!
  let steps = 64u;
  let dt = (t_exit - t_enter) / f32(steps);
  let ign = fract(52.9829189 * fract(dot(in.pos.xy, vec2<f32>(0.06711056, 0.00583715))));
  var accum = vec3<f32>(0.0);
  var trans = 1.0;

  for (var s = 0u; s < steps; s = s + 1u) {
    let t = t_enter + (f32(s) + ign) * dt;
    let p = ro + rd * t;
    let v = sample_vol(p, dim);
    let rho_p = v.x;
    let rho_n = v.y;
    let dens = v.w;
    let rr = length(p);

    // Translucent Woods-Saxon potential aura + bright neutron-skin edge + emerald TDSE tunneling shell
    let edge_shell = dens * (1.0 - dens) * 4.0;
    let skin_col = mix(vec3<f32>(1.0, 0.45, 0.16), vec3<f32>(0.18, 0.84, 1.0), clamp((rho_n - rho_p) * 4.8 + 0.45, 0.0, 1.0));
    let tdse_x = (rr - tdse_crest_r) * 20.0;
    let tdse_ring = exp(-(tdse_x * tdse_x)) * (0.25 + 0.85 * clamp(tdse_tun * 5.0, 0.0, 1.0));
    let shell_col = vec3<f32>(0.24, 1.0, 0.72);

    let sigma = (edge_shell * 0.55 + tdse_ring * 0.65) * dt;
    let emit = (skin_col * edge_shell * 0.85 + shell_col * tdse_ring * 1.65) * dt;
    accum = accum + trans * emit;
    trans = trans * exp(-sigma);
    if (trans < 0.05) { break; }
  }
  let alpha = clamp((1.0 - trans) * alpha_mul, 0.0, 0.82);
  if (alpha < 0.004) { discard; }
  return vec4<f32>(accum * alpha_mul, alpha);
}
`;

// True Zero-Copy 3D Volumetric Radiative-Transfer Ray-Marcher for Live GPU Grids:
//   mode 0 = L3 3D MLS-MPM Stellar Core & Boiling Convective Photosphere (gridStateBuf: 3 vec4/cell)
//   mode 1 = L4 3D Multi-Material SPH Differentiating Protoplanet (gridValBuf: 2 vec4/cell)
const ASTRO_VOL_WGSL = /* wgsl */ `
${CAMERA_WGSL}
${EM_SENSOR_WGSL}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> vol_grid: array<vec4<f32>>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) ndc: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.ndc = pts[vid];
  return out;
}

fn av_hash3(p: vec3<f32>) -> f32 {
  let q = fract(p * vec3<f32>(0.1031, 0.1030, 0.0973));
  let q2 = q + dot(q, q.yxz + 33.33);
  return fract((q2.x + q2.y) * q2.z);
}

fn av_noise3(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let n000 = av_hash3(i + vec3<f32>(0.0, 0.0, 0.0));
  let n100 = av_hash3(i + vec3<f32>(1.0, 0.0, 0.0));
  let n010 = av_hash3(i + vec3<f32>(0.0, 1.0, 0.0));
  let n110 = av_hash3(i + vec3<f32>(1.0, 1.0, 0.0));
  let n001 = av_hash3(i + vec3<f32>(0.0, 0.0, 1.0));
  let n101 = av_hash3(i + vec3<f32>(1.0, 0.0, 1.0));
  let n011 = av_hash3(i + vec3<f32>(0.0, 1.0, 1.0));
  let n111 = av_hash3(i + vec3<f32>(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  );
}

fn sample_grid_trilin(p_unit: vec3<f32>, dim: u32, stride: u32, slot: u32) -> vec4<f32> {
  let d = f32(dim);
  let g = clamp((p_unit * 0.5 + 0.5) * (d - 1.0), vec3<f32>(0.0), vec3<f32>(d - 1.001));
  let i0 = vec3<u32>(floor(g));
  let i1 = min(i0 + vec3<u32>(1u), vec3<u32>(dim - 1u));
  let f = fract(g);
  let c000 = vol_grid[((i0.z * dim + i0.y) * dim + i0.x) * stride + slot];
  let c100 = vol_grid[((i0.z * dim + i0.y) * dim + i1.x) * stride + slot];
  let c010 = vol_grid[((i0.z * dim + i1.y) * dim + i0.x) * stride + slot];
  let c110 = vol_grid[((i0.z * dim + i1.y) * dim + i1.x) * stride + slot];
  let c001 = vol_grid[((i1.z * dim + i0.y) * dim + i0.x) * stride + slot];
  let c101 = vol_grid[((i1.z * dim + i0.y) * dim + i1.x) * stride + slot];
  let c011 = vol_grid[((i1.z * dim + i1.y) * dim + i0.x) * stride + slot];
  let c111 = vol_grid[((i1.z * dim + i1.y) * dim + i1.x) * stride + slot];
  return mix(
    mix(mix(c000, c100, f.x), mix(c010, c110, f.x), f.y),
    mix(mix(c001, c101, f.x), mix(c011, c111, f.x), f.y),
    f.z
  );
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let dim = u32(round(cam.extra0.x));
  let box_r = max(0.05, cam.extra0.y);
  let mode = u32(round(cam.extra0.z));
  let alpha_mul = clamp(cam.extra0.w, 0.0, 1.0);
  if (dim < 8u || alpha_mul < 0.01) { discard; }

  let center_w = cam.extra1.xyz;
  let param_a = cam.extra1.w;
  let fov = cam.cam_up.w;
  let aspect = cam.cam_right.w;
  let ro = (cam.cam_pos.xyz - center_w) / box_r;
  let rd = normalize(
    cam.cam_fwd.xyz
    + cam.cam_right.xyz * (in.ndc.x * aspect * fov)
    + cam.cam_up.xyz * (in.ndc.y * fov)
  );

  // Bounding sphere intersection inside unit cube (radius 1.0) for zero cube-corner seams
  let b_s = dot(ro, rd);
  let c_s = dot(ro, ro) - 1.0;
  let disc = b_s * b_s - c_s;
  if (disc <= 0.0) { discard; }
  let sq = sqrt(disc);
  let t_enter = max(0.0, -b_s - sq);
  let t_exit = -b_s + sq;
  if (t_exit <= t_enter) { discard; }

  let steps = 64u;
  let dt = (t_exit - t_enter) / f32(steps);
  let ign = fract(52.9829189 * fract(dot(in.pos.xy, vec2<f32>(0.06711056, 0.00583715))));
  let time_s = cam.extra2.z;
  var accum = vec3<f32>(0.0);
  var trans = 1.0;

  if (mode == 0u) {
    // MODE 0: LIVE 3D MLS-MPM STELLAR ENGINE — 100% PHYSICALLY OPAQUE OPTICAL PHOTOSPHERE +
    // TRUE WAVELENGTH-DEPENDENT EM RADIATIVE TRANSFER (EUV Loops / X-Ray & Gamma Nuclear Core Transparency / IR / Radio) +
    // OPTIONAL OPTICAL OCTANT CORE CUTAWAY (cam.extra2.y > 0.5)!
    let teff_log = clamp(param_a, 3.0, 5.1);
    let r_star_u = clamp(cam.extra2.x, 0.45, 0.92);
    let cutaway_on = cam.extra2.y > 0.5;
    let gen_f = cam.extra2.w;
    let em_active = cam.em_sensor.z > 0.5;
    let mid_log_lam = 0.5 * (cam.em_sensor.x + cam.em_sensor.y);
    // Physical wavelength-dependent bound-free envelope opacity:
    //   - Optical & IR: tau >> 1 (100% physically opaque photosphere — ZERO see-through background stars!)
    //   - EUV (log10 lam ~ -8..-6.9): optically thick chromosphere + blazing hot magnetic flare corona!
    //   - X-Ray & Gamma (log10 lam < -8.0): bound-free opacity drops ~lam^3, peeling the outer plasma open to reveal the live nuclear fusion heart!
    let xray_peel = select(0.0, 1.0 - smoothstep(-9.1, -7.5, mid_log_lam), em_active);
    let euv_band = select(0.0, smoothstep(-8.8, -8.2, mid_log_lam) * (1.0 - smoothstep(-7.2, -6.7, mid_log_lam)), em_active);
    let ir_band = select(0.0, smoothstep(-6.0, -5.0, mid_log_lam) * (1.0 - smoothstep(-3.4, -2.6, mid_log_lam)), em_active);
    let radio_band = select(0.0, smoothstep(-3.3, -2.1, mid_log_lam), em_active);

    let c_bd = vec3<f32>(0.74, 0.14, 0.26);
    let c_rsg = vec3<f32>(1.00, 0.24, 0.04);
    let c_sun = vec3<f32>(1.00, 0.62, 0.12);
    let c_pop2 = vec3<f32>(0.42, 0.76, 1.00);
    let c_pop3 = vec3<f32>(0.22, 0.58, 1.00);
    var phot_base = mix(c_bd, c_rsg, smoothstep(3.05, 3.48, teff_log));
    phot_base = mix(phot_base, c_sun, smoothstep(3.52, 3.82, teff_log));
    phot_base = mix(phot_base, c_pop2, smoothstep(3.84, 4.12, teff_log));
    phot_base = mix(phot_base, c_pop3, smoothstep(4.20, 4.78, teff_log));
    let lane_col = phot_base * vec3<f32>(0.24, 0.14, 0.20) + vec3<f32>(0.02, 0.06, 0.16) * smoothstep(3.85, 4.5, teff_log);
    let crest_col = mix(phot_base * 1.48, vec3<f32>(1.0, 0.96, 0.86), 0.36);
    let core_nuc_col = select(
      select(vec3<f32>(1.00, 0.84, 0.36), vec3<f32>(0.54, 0.88, 1.00), gen_f < 2.5),
      vec3<f32>(0.52, 0.40, 1.00),
      gen_f < 1.5
    );
    var hit_opaque = false;
    var core_xr_acc = 0.0;
    var flare_uv_acc = 0.0;

    for (var s = 0u; s < steps; s = s + 1u) {
      let t = t_enter + (f32(s) + ign) * dt;
      let p = ro + rd * t;
      let r = length(p);
      if (r >= 0.99) { continue; }
      let r_norm = r / r_star_u;
      // Optional Optical Octant Cutaway exposes live convective/radiative zones + blazing nuclear fusion heart!
      let in_cut_octant = cutaway_on && p.x > 0.0 && p.y > 0.0 && p.z > 0.0 && r_norm < 0.99;
      if (in_cut_octant) { continue; }

      let g0 = sample_grid_trilin(p, dim, 3u, 0u);
      let g1 = sample_grid_trilin(p, dim, 3u, 1u);
      let g2 = sample_grid_trilin(p, dim, 3u, 2u);
      let m_rho = g0.w;
      if (m_rho < 1e-4 && r_norm > 0.96) { continue; }
      let eps_tot = g1.z;
      let n_rad = p / max(1e-4, r);
      let v_rad = dot(g0.xyz, n_rad);

      // High-contrast 3D boiling convective granulation & sunspot magnetic pores advected by live MPM velocity!
      let gran_p = p * 10.5 - g0.xyz * 0.28 + vec3<f32>(time_s * 0.14, -time_s * 0.09, time_s * 0.11);
      let n1 = av_noise3(gran_p);
      let n2 = av_noise3(gran_p * 2.15 + vec3<f32>(4.1, -2.7, 3.3));
      let n3 = av_noise3(gran_p * 4.4 - vec3<f32>(1.9, 5.2, -3.8));
      let raw_cell = n1 * 0.52 + n2 * 0.32 + n3 * 0.16 + v_rad * 0.16;
      let ridge_cell = 1.0 - abs(raw_cell * 2.0 - 1.0);
      let gran_hi = pow(clamp(ridge_cell, 0.0, 1.0), 2.0);
      // Magnetic active-region dark sunspot umbrae (cool in optical, blazing bright in EUV/X-Ray!)
      let spot_n = av_noise3(p * 3.8 + vec3<f32>(2.3, -1.7, 4.1));
      let sunspot = smoothstep(0.73, 0.85, spot_n) * (1.0 - smoothstep(0.65, 0.90, abs(n_rad.y)));

      let dens_sc = clamp(pow(max(1e-4, m_rho) * pow(f32(dim) / 24.0, 3.0) * 6.8, 0.58), 0.15, 2.4);
      let mu_limb = abs(dot(n_rad, -rd));
      let limb_dark = 0.30 + 0.70 * pow(max(0.0, mu_limb), 0.58);

      // 1. PHYSICALLY OPAQUE PHOTOSPHERIC SHELL (r_norm <= 0.935) when NOT peeled open by X-Ray/Gamma!
      //    If viewing a cutaway interior face (near p.x==0 / p.y==0 / p.z==0 inside the star), reveal concentric
      //    interior convective -> radiative -> nuclear-burning strata cleanly!
      if (r_norm <= 0.935) {
        let is_cut_face = cutaway_on && (
          (p.x > -0.04 && p.y > -0.02 && p.z > -0.02)
          || (p.y > -0.04 && p.x > -0.02 && p.z > -0.02)
          || (p.z > -0.04 && p.x > -0.02 && p.y > -0.02)
        );
        let core_w = (1.0 - smoothstep(0.20, 0.44, r_norm)) * (0.65 + smoothstep(0.05, 8.0, eps_tot) * 0.95);
        let nuc_turb = 0.78 + 0.38 * av_noise3(p * 14.0 - vec3<f32>(time_s * 0.45));
        let core_emit = mix(core_nuc_col, vec3<f32>(0.98, 0.99, 1.0), smoothstep(0.42, 0.95, 1.0 - r_norm * 2.1) * 0.52)
          * (1.15 + smoothstep(0.2, 16.0, eps_tot + g2.z * 2.0 + g2.y) * 0.95) * nuc_turb;

        if (xray_peel < 0.18) {
          // OPAQUE OPTICAL / IR / EUV SURFACE OR CUTAWAY FACE (100% ZERO SEE-THROUGH!)
          var surf_c = mix(lane_col, crest_col, gran_hi) * limb_dark;
          surf_c = mix(surf_c, surf_c * 0.24, sunspot * (1.0 - euv_band));
          // Active magnetic plage / EUV coronal brightening over active sunspot regions!
          surf_c = surf_c + vec3<f32>(0.45, 0.85, 1.0) * (sunspot * 1.45 + gran_hi * 0.45) * euv_band;
          surf_c = mix(surf_c, mix(vec3<f32>(0.65, 0.12, 0.02), vec3<f32>(1.0, 0.65, 0.20), gran_hi) * limb_dark, ir_band * 0.65);
          if (is_cut_face && r_norm < 0.88) {
            // Concentric stellar interior: boiling outer convective zone -> warm radiative zone -> blazing nuclear core!
            let rad_col = mix(phot_base * 1.35, vec3<f32>(1.0, 0.92, 0.72), 0.42) * (0.72 + 0.35 * n2);
            let conv_col = mix(lane_col * 1.1, crest_col * 1.15, gran_hi);
            var interior_c = mix(rad_col, conv_col, smoothstep(0.62, 0.76, r_norm));
            interior_c = mix(interior_c, core_emit * 1.35, 1.0 - smoothstep(0.24, 0.44, r_norm));
            // Crisp radial zone-boundary lines at core & tachocline!
            let dtacho = (r_norm - 0.68) / 0.018;
            let tacho = exp(-(dtacho * dtacho)) * 0.45;
            let dcore = (r_norm - 0.36) / 0.018;
            let core_ring = exp(-(dcore * dcore)) * 0.55;
            surf_c = interior_c + vec3<f32>(1.0, 0.95, 0.85) * (tacho + core_ring);
          }
          accum = accum + trans * surf_c;
          trans = 0.0;
          hit_opaque = true;
          break;
        } else {
          // X-RAY / GAMMA-RAY HIGH-ENERGY TRANSPARENCY: outer photosphere becomes ghostly optically thin
          // indigo-violet plasma while the blazing live GPU thermonuclear fusion core glows brightly inside!
          let env_opac = mix(5.5, 0.18, xray_peel);
          let rim_shell = pow(max(0.0, 1.0 - mu_limb), 1.8) * smoothstep(0.62, 0.93, r_norm);
          let phot_ghost = vec3<f32>(0.14, 0.18, 0.58) * (0.14 + 0.55 * rim_shell) * (0.55 + 0.45 * gran_hi);
          let flare_knot = vec3<f32>(0.24, 0.78, 1.0) * sunspot * 0.75 * smoothstep(0.75, 0.93, r_norm);
          let core_tight = (1.0 - smoothstep(0.14, 0.38, r_norm)) * (0.75 + smoothstep(0.05, 10.0, eps_tot + g2.z) * 1.15);
          let sigma_x = (dens_sc * env_opac * 0.28 + core_tight * 2.4) * dt;
          let emit_x = (phot_ghost * dens_sc * 0.55 + flare_knot + core_emit * core_tight * 2.6) * dt;
          accum = accum + trans * emit_x;
          core_xr_acc = core_xr_acc + trans * core_tight * dt * 2.2;
          flare_uv_acc = flare_uv_acc + trans * (sunspot * 0.8 + rim_shell * 0.25) * dt;
          trans = trans * exp(-sigma_x);
          if (trans < 0.03) { break; }
          continue;
        }
      }

      // 2. TRANSLUCENT CHROMOSPHERIC SPICULES, PROMINENCES & CORONA (r_norm > 0.935)
      let dchrom = (r_norm - 0.96) / 0.055;
      let chromo_w = exp(-(dchrom * dchrom));
      let corona_w = smoothstep(0.92, 1.02, r_norm) * (1.0 - smoothstep(1.02, 1.32, r_norm));
      let flare_arch = pow(clamp(av_noise3(p * 6.5 - vec3<f32>(time_s * 0.25, time_s * 0.18, 0.0)), 0.0, 1.0), 2.4);
      let chromo_emit = mix(phot_base, vec3<f32>(1.0, 0.42, 0.16), select(0.58, 0.10, teff_log > 3.95))
        * (0.55 + 0.85 * gran_hi) * (1.0 + 1.5 * euv_band + 0.35 * xray_peel);
      let cor_emit = mix(phot_base, vec3<f32>(0.48, 0.84, 1.0), 0.42 + 0.45 * (euv_band + radio_band))
        * (0.35 + 1.15 * flare_arch) * (0.42 + 1.45 * euv_band + 1.25 * radio_band + 0.22 * xray_peel);
      let sigma_c = (chromo_w * dens_sc * 1.1 + corona_w * 0.18) * dt;
      let emit_c = (chromo_emit * chromo_w * dens_sc * 1.15 + cor_emit * corona_w * 0.42) * dt;
      accum = accum + trans * emit_c;
      flare_uv_acc = flare_uv_acc + trans * (chromo_w * 0.45 + flare_arch * corona_w * 0.55) * dt;
      trans = trans * exp(-sigma_c);
      if (trans < 0.02) { break; }
    }
    if (em_active) {
      let em_t = pow(10.0, teff_log);
      if (xray_peel > 0.25) {
        // True Chandra X-Ray / Fermi Gamma radiograph: crisp translucent indigo outer shell + blazing sapphire-white fusion heart!
        let xr_core = clamp(core_xr_acc * 1.35, 0.0, 2.2);
        let xr_rim = clamp(length(accum) * 0.65, 0.0, 1.2);
        accum = vec3<f32>(0.10, 0.18, 0.55) * xr_rim
          + vec3<f32>(0.36, 0.82, 1.00) * flare_uv_acc * 0.85
          + mix(core_nuc_col, vec3<f32>(0.92, 0.98, 1.0), clamp(xr_core * 0.55, 0.0, 0.82)) * (xr_core * 1.35);
      } else {
        let uv_s = clamp(flare_uv_acc * 1.4 + 0.35 * euv_band, 0.0, 1.6);
        let rad_s = clamp(length(accum) * (0.35 + 0.9 * radio_band), 0.0, 1.6);
        accum = em_sensor_map_rgb(accum, em_t, uv_s, core_xr_acc * 0.8, rad_s, 0.0);
      }
    }
    let alpha = select(clamp((1.0 - trans) * alpha_mul, 0.0, 0.98), alpha_mul, hit_opaque);
    if (alpha < 0.004) { discard; }
    return vec4<f32>(accum * alpha_mul, alpha);
  } else {
    // MODE 1: MLS-MPM-GRADE HYBRID 3D DENSITY-ISOSURFACE + ∇ρ NORMALS + MOLTEN RIFT PROTOPLANET!
    // Solidifies cooling obsidian/silicate crust plates with crisp 3D finite-difference ∇ρ surface-normal lighting
    // & specular reflections at 60 FPS (zero Marching Cubes overhead!), while early phases & Cutaway (extra2.y > 0.5)
    // expose the incandescent sinking Fe-Ni metallic core & churning crimson mantle plumes!
    let age_f = clamp(param_a, 0.0, 1.0);
    let has_ocean = cam.extra2.x > 0.5;
    let cutaway_on = cam.extra2.y > 0.5;
    let is_magma = cam.extra2.w > 0.5;
    let l_dir_raw = cam.sph_geo.xyz;
    let l_dir = select(normalize(vec3<f32>(0.65, 0.45, 0.60)), normalize(l_dir_raw), length(l_dir_raw) > 0.05);
    let h_fd = 2.0 / max(12.0, f32(dim));
    // Crisp 3D density isosurface threshold across ALL eras, physically contracting from +4% molten thermal
    // inflation in Era 1 (1.04 R_p) down to EXACT 1.000 R_p before the age_f = 0.45 crossfade onto LIT_SPHERE_WGSL
    // (eliminating ANY size disparity across 5K..57K SPH parcels & 32^3..64^3 grids!)
    let iso_thresh = mix(0.11, 0.09, age_f);
    let r_surf_lim = mix(1.04, 1.000, smoothstep(0.0, 0.45, age_f));
    let atm_outer_lim = r_surf_lim + mix(0.16, 0.06, age_f);
    var hit_solid = false;

    for (var s = 0u; s < steps; s = s + 1u) {
      let t = t_enter + (f32(s) + ign) * dt;
      let p = ro + rd * t;
      let r = length(p);
      if (r >= 0.99) { continue; }
      let r_body = r * 1.55;
      if (r_body > atm_outer_lim) { continue; }
      if (cutaway_on && p.x > 0.0 && p.y > 0.0 && p.z > 0.0 && r_body < 1.05) { continue; }

      let g0 = sample_grid_trilin(p, dim, 2u, 0u);
      let dens = g0.x;
      if (dens < 0.012 && r_body > r_surf_lim * 0.97) { continue; }
      let g1 = sample_grid_trilin(p, dim, 2u, 1u);
      let temp_n = clamp(g1.x, 0.0, 1.0);
      let rho0 = g1.y;
      let shock = clamp(g1.w, 0.0, 2.0);
      let n_rad = p / max(1e-4, r);

      // Advected 3D basalt plate & incandescent tectonic magma-rift cracks!
      let q_p = p * 11.5 - g0.yzw * 0.35 + vec3<f32>(time_s * 0.04);
      let n_a = av_noise3(q_p);
      let n_b = av_noise3(q_p * 2.3 + vec3<f32>(3.7, -2.1, 1.5));
      let n_c = av_noise3(q_p * 4.8 - vec3<f32>(1.4, 3.3, -2.7));
      let tex = n_a * 0.54 + n_b * 0.30 + n_c * 0.16;
      let crack = pow(clamp(1.0 - abs(n_a * 2.0 - 1.0), 0.0, 1.0), 2.5);
      // Cooled basaltic slag rafts floating on the boiling Era-1/Era-2 magma ocean!
      let slag_plate = smoothstep(0.42 - age_f * 0.28, 0.68 - age_f * 0.24, n_a * 0.7 + n_b * 0.3);

      let is_core = smoothstep(5.2, 6.8, rho0) * (1.0 - smoothstep(0.24, 0.50, r_body));
      let is_outer_shell = smoothstep(0.66, 0.88, r_body);
      let is_crust = max(1.0 - smoothstep(2.65, 3.30, rho0), is_outer_shell * (0.42 + 0.58 * age_f));
      let is_water = (1.0 - smoothstep(1.35, 2.15, rho0)) * select(0.0, 1.0, has_ocean);

      // MLS-MPM-GRADE 3D DENSITY-ISOSURFACE HIT (PIXEL-MATCHED TO LIT_SPHERE_WGSL RADIUS 1.000 R_p!):
      // Sharp 6-tap finite-difference ∇ρ surface normal + high-frequency magma/basalt micro-bump + glossy specular + Fresnel rim!
      let r_relief = r_surf_lim + (tex - 0.5) * 0.022;
      if (r_body <= r_relief && (dens > iso_thresh || r_body <= r_surf_lim * 0.985)) {
        let gx_p = sample_grid_trilin(p + vec3<f32>(h_fd, 0.0, 0.0), dim, 2u, 0u).x;
        let gx_m = sample_grid_trilin(p - vec3<f32>(h_fd, 0.0, 0.0), dim, 2u, 0u).x;
        let gy_p = sample_grid_trilin(p + vec3<f32>(0.0, h_fd, 0.0), dim, 2u, 0u).x;
        let gy_m = sample_grid_trilin(p - vec3<f32>(0.0, h_fd, 0.0), dim, 2u, 0u).x;
        let gz_p = sample_grid_trilin(p + vec3<f32>(0.0, 0.0, h_fd), dim, 2u, 0u).x;
        let gz_m = sample_grid_trilin(p - vec3<f32>(0.0, 0.0, h_fd), dim, 2u, 0u).x;
        let grad_rho = vec3<f32>(gx_p - gx_m, gy_p - gy_m, gz_p - gz_m);
        let grad_l = length(grad_rho);
        let n_fd = select(n_rad, -grad_rho / grad_l, grad_l > 1e-4);
        // Physical 3D surface micro-relief normal from advected crust/wave turbulence
        let bump_n = vec3<f32>(n_a - 0.5, n_b - 0.5, n_c - 0.5) * 0.36;
        let n_iso = normalize(mix(n_rad, n_fd, 0.70) + bump_n);
        let ndl = max(0.0, dot(n_iso, l_dir));
        let ndv = max(0.0, dot(n_iso, -rd));
        let half_v = normalize(l_dir - rd);
        let spec_pow = select(36.0, 76.0, is_water > 0.35 || slag_plate < 0.35 || is_magma);
        let spec = pow(max(0.0, dot(n_iso, half_v)), spec_pow) * (0.34 + 0.58 * max(is_water, 1.0 - slag_plate));
        let fres = pow(max(0.0, 1.0 - ndv), 3.2);

        let core_c = mix(vec3<f32>(1.0, 0.62, 0.12), vec3<f32>(1.0, 0.94, 0.72), 0.45 + 0.55 * tex) * 1.85;
        // Deep volcanic crimson-ember magma ocean + bright glowing lava fissures contrasting against dark obsidian slag!
        let magma_c = mix(vec3<f32>(0.10, 0.012, 0.008), vec3<f32>(0.96, 0.26, 0.025), pow(clamp(crack * 0.68 + temp_n * 0.28 + (1.0 - slag_plate) * 0.28, 0.0, 1.0), 1.55))
          * (0.48 + 0.85 * crack) + vec3<f32>(1.0, 0.56, 0.14) * pow(crack, 3.0) * 0.72;
        // Cooled obsidian / basaltic tectonic plates with realistic directional lighting & specular sheen!
        let rock_albedo = mix(vec3<f32>(0.042, 0.038, 0.048), vec3<f32>(0.24, 0.34, 0.20), select(0.06, 0.68, has_ocean) * age_f);
        let water_albedo = vec3<f32>(0.05, 0.30, 0.68);
        let base_albedo = mix(rock_albedo, water_albedo, is_water * age_f * 0.78);
        let lit_crust = base_albedo * (0.10 + 0.96 * ndl) + vec3<f32>(1.0, 0.88, 0.74) * spec * (0.30 + 0.65 * ndl);
        let rift_glow = vec3<f32>(0.98, 0.30, 0.03) * pow(crack, 1.65) * (0.95 + 1.05 * temp_n) * select(1.0, 1.75, is_magma) * (1.12 - 0.52 * age_f);
        let crust_blend = clamp(slag_plate * (0.64 + 0.36 * age_f) * select(1.0, 0.45, is_magma), 0.0, 1.0);
        var iso_c = mix(magma_c + vec3<f32>(1.0, 0.52, 0.22) * spec * 0.36, lit_crust + rift_glow, crust_blend);
        iso_c = mix(iso_c, core_c, is_core);
        // Glowing atmospheric volcanic vapor / steam Fresnel rim!
        let rim_c = select(vec3<f32>(1.0, 0.38, 0.10), vec3<f32>(0.34, 0.68, 1.0), has_ocean && age_f > 0.45);
        iso_c = iso_c + rim_c * fres * (0.48 + 0.34 * ndl) + vec3<f32>(1.0, 0.86, 0.50) * shock * 0.95;

        accum = accum + trans * iso_c;
        trans = 0.0;
        hit_solid = true;
        break;
      }

      // Outer tenuous silicate-vapor & steam impact atmosphere outside the solid/liquid isosurface
      // (confined to physical atmospheric scale height & fading cleanly during late cooling crossfade!)
      let atm_h_fade = 1.0 - smoothstep(r_surf_lim, atm_outer_lim, r_body);
      let vapor_col = select(vec3<f32>(0.95, 0.36, 0.08), vec3<f32>(0.42, 0.72, 1.0), has_ocean && age_f > 0.5);
      let dens_sc = clamp(dens * 1.4, 0.0, 0.28) * atm_h_fade * (1.0 - smoothstep(0.45, 0.90, age_f));
      let sigma = dens_sc * 0.42 * dt;
      let emit = (vapor_col * dens_sc * 0.52 + vec3<f32>(1.0, 0.84, 0.45) * shock * atm_h_fade * 0.65) * dt;
      accum = accum + trans * emit;
      trans = trans * exp(-sigma);
      if (trans < 0.03) { break; }
    }
    if (cam.em_sensor.z > 0.5) {
      accum = em_sensor_map_rgb(accum, mix(2800.0, 450.0, age_f), 0.18, 0.05, 0.15, 0.0);
    }
    let alpha = select(clamp((1.0 - trans) * alpha_mul, 0.0, 0.98), alpha_mul, hit_solid);
    if (alpha < 0.004) { discard; }
    return vec4<f32>(accum * alpha_mul, alpha);
  }
}
`;

// 2-Pass Half-Resolution Kawase HDR Bloom (Extract + Dual-Kawase Blur)
const BLOOM_WGSL = /* wgsl */ `
struct BloomUniforms {
  inv_res: vec2<f32>,
  threshold: f32,
  mode: f32, // 0 = bright-pass extract + 4-tap downsample, 1 = 4-tap Kawase blur
};

@group(0) @binding(0) var<uniform> u: BloomUniforms;
@group(0) @binding(1) var src_tex: texture_2d<f32>;
@group(0) @binding(2) var src_samp: sampler;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.uv = vec2<f32>(pts[vid].x * 0.5 + 0.5, 0.5 - pts[vid].y * 0.5);
  return out;
}

fn bright_clip(c: vec3<f32>, thresh: f32) -> vec3<f32> {
  let l = max(c.r, max(c.g, c.b));
  let soft = smoothstep(thresh * 0.72, thresh * 1.45, l);
  return c * soft * clamp(l - thresh * 0.65, 0.0, 6.0) / max(1e-4, l);
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let d = u.inv_res * select(1.25, 2.25, u.mode > 0.5);
  let cc = textureSample(src_tex, src_samp, in.uv).rgb;
  let c0 = textureSample(src_tex, src_samp, in.uv + vec2<f32>(-d.x, -d.y)).rgb;
  let c1 = textureSample(src_tex, src_samp, in.uv + vec2<f32>( d.x, -d.y)).rgb;
  let c2 = textureSample(src_tex, src_samp, in.uv + vec2<f32>(-d.x,  d.y)).rgb;
  let c3 = textureSample(src_tex, src_samp, in.uv + vec2<f32>( d.x,  d.y)).rgb;
  if (u.mode < 0.5) {
    let avg = (bright_clip(c0, u.threshold) + bright_clip(c1, u.threshold) + bright_clip(c2, u.threshold) + bright_clip(c3, u.threshold)) * 0.25;
    return vec4<f32>(avg, 1.0);
  }
  let blur = (cc * 2.0 + c0 + c1 + c2 + c3) * (1.0 / 6.0);
  return vec4<f32>(blur, 1.0);
}
`;

// Fullscreen Post-Processing Pass: Schwarzschild Lensing + Hyperdrive Streaks + Kawase HDR Bloom + Big Bang Flash + ACES + Retro CRT
const POST_WGSL = /* wgsl */ `
struct PostUniforms {
  resolution: vec2<f32>,
  bh_uv: vec2<f32>,
  bh_strength: f32,
  warp_amount: f32,
  flash_amount: f32,
  crt_enabled: f32,
  pixel_size: f32,
  time_sec: f32,
  bloom_strength: f32,
  pad1: f32,
  em_sensor: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: PostUniforms;
@group(0) @binding(1) var scene_tex: texture_2d<f32>;
@group(0) @binding(2) var scene_samp: sampler;
@group(0) @binding(3) var bloom_tex: texture_2d<f32>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.uv = vec2<f32>(pts[vid].x * 0.5 + 0.5, 0.5 - pts[vid].y * 0.5);
  return out;
}

fn aces_tonemap(x: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  var uv = in.uv;
  let aspect = u.resolution.x / max(1.0, u.resolution.y);

  if (u.crt_enabled > 0.5 && u.pixel_size > 1.0) {
    let step_uv = vec2<f32>(u.pixel_size) / max(vec2<f32>(1.0), u.resolution);
    uv = (floor(uv / step_uv) + 0.5) * step_uv;
  }

  // Exact Schwarzschild Einstein-ring deflection around projected SMBH UV (active ONLY at SMBH Core scale!)
  var photon_glow = vec3<f32>(0.0);
  if (u.bh_strength > 1e-6) {
    let d_aspect = vec2<f32>((uv.x - u.bh_uv.x) * aspect, uv.y - u.bh_uv.y);
    let r2 = dot(d_aspect, d_aspect);
    let r = sqrt(max(1e-6, r2));
    let rs = sqrt(u.bh_strength) * 0.65;
    let outside_shadow = smoothstep(rs * 0.85, rs * 1.25, r);
    let falloff = exp(-r2 * 18.0) * outside_shadow;
    let deflect = (u.bh_strength / max(r2 + rs * rs * 0.75, 0.0005)) * falloff;
    let dir_uv = vec2<f32>(d_aspect.x / aspect, d_aspect.y) / max(r, 1e-4);
    uv = clamp(uv - dir_uv * min(0.095, deflect * 0.11), vec2<f32>(0.001), vec2<f32>(0.999));
    let ring_x = (r - rs * 1.16) / max(0.005, rs * 0.22);
    let ring = exp(-(ring_x * ring_x)) * 0.48;
    photon_glow = vec3<f32>(1.0, 0.86, 0.64) * ring;
  }

  var col = textureSample(scene_tex, scene_samp, uv).rgb + photon_glow;
  let bloom_col = textureSample(bloom_tex, scene_samp, uv).rgb;
  if (u.bloom_strength > 0.001) {
    col = col + bloom_col * u.bloom_strength;
  }

  if (u.warp_amount > 0.005) {
    let from_c = uv - vec2<f32>(0.5, 0.5);
    var streak = vec3<f32>(0.0);
    for (var s = 1u; s <= 4u; s = s + 1u) {
      let f = f32(s) * 0.012 * u.warp_amount;
      let uv_r = clamp(uv - from_c * (f * 1.12), vec2<f32>(0.001), vec2<f32>(0.999));
      let uv_g = clamp(uv - from_c * f, vec2<f32>(0.001), vec2<f32>(0.999));
      let uv_b = clamp(uv - from_c * (f * 0.88), vec2<f32>(0.001), vec2<f32>(0.999));
      streak.r += textureSample(scene_tex, scene_samp, uv_r).r;
      streak.g += textureSample(scene_tex, scene_samp, uv_g).g;
      streak.b += textureSample(scene_tex, scene_samp, uv_b).b;
    }
    col = mix(col, (col + streak * 0.24) * (1.0 + 0.30 * u.warp_amount), clamp(u.warp_amount, 0.0, 0.72));
  }

  if (u.flash_amount > 0.002) {
    let rad = length((in.uv - vec2<f32>(0.5)) * vec2<f32>(aspect, 1.0));
    let burst = exp(-rad * rad * 1.8) * u.flash_amount;
    col = col + vec3<f32>(1.0, 0.92, 0.78) * burst * 2.0;
  }

  col = aces_tonemap(col * 1.12);

  if (u.crt_enabled > 0.5) {
    let scan = 0.82 + 0.18 * sin(in.uv.y * u.resolution.y * 1.65);
    let vig_d = length((in.uv - vec2<f32>(0.5)) * 1.38);
    let vig = clamp(1.0 - vig_d * vig_d * 0.45, 0.35, 1.0);
    col = col * scan * vig;
    col = mix(col, col * vec3<f32>(0.92, 1.04, 1.02), 0.35);
  }

  return vec4<f32>(col, 1.0);
}
`;

export function createUlgUniversesRenderer(device, canvas) {
  const ctx = canvas.getContext('webgpu');
  if (!ctx) throw new Error('WebGPU canvas context unavailable');
  const { format: presentFormat } = configureCompatibleWebGpuCanvas(ctx, device, { preferCopySrc: true });

  const sceneFormat = 'rgba16float';
  const depthFormat = 'depth32float'; // Reversed-Z Infinite Far Plane: crystal depth precision from 0.2 m -> 10^12 m!
  let width = 0;
  let height = 0;
  let sceneTex = null;
  let sceneView = null;
  let depthTex = null;
  let depthView = null;
  let bloomTexA = null;
  let bloomViewA = null;
  let bloomTexB = null;
  let bloomViewB = null;

  // Dedicated 240-byte CameraUniforms buffers (incl. EM Sensor, Host Starlight Spectrum, SPH Geology & Space-Mesh!)
  const camBuf = device.createBuffer({ label: 'uv-cam-base', size: 240, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const MAX_CLOUD_SLOTS = 4;
  const cloudCamBufs = Array.from({ length: MAX_CLOUD_SLOTS }, (_, idx) => device.createBuffer({
    label: `uv-cam-cloud-${idx}`,
    size: 240,
    usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST
  }));
  const auxCamBuf = device.createBuffer({ label: 'uv-cam-aux', size: 240, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const astroVolCamBuf = device.createBuffer({ label: 'uv-cam-astro-vol', size: 240, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const floraCamBuf = device.createBuffer({ label: 'uv-cam-flora', size: 240, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const spaceMeshCamBuf = device.createBuffer({ label: 'uv-cam-space-mesh', size: 240, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const postUniformBuf = device.createBuffer({ label: 'uv-post-uniform', size: 64, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const bloomExtractUniformBuf = device.createBuffer({ label: 'uv-bloom-extract-u', size: 16, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const bloomBlurUniformBuf = device.createBuffer({ label: 'uv-bloom-blur-u', size: 16, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

  const MAX_SPHERES = 320; // Supports up to U-238 (238 nucleons) + planets/moons/stars! (80 B/sphere)
  const sphereBuf = device.createBuffer({ label: 'uv-spheres', size: MAX_SPHERES * 80, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const MAX_DISKS = 16;
  const diskBuf = device.createBuffer({ label: 'uv-disks', size: MAX_DISKS * 64, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const MAX_LINE_VERTS = 24576;
  const lineBuf = device.createBuffer({ label: 'uv-lines', size: MAX_LINE_VERTS * 28, usage: GPU_BUF.VERTEX | GPU_BUF.COPY_DST });
  const MAX_COSMIC_VERTS = 16384;
  const cosmicMeshBuf = device.createBuffer({ label: 'uv-cosmic-mesh', size: MAX_COSMIC_VERTS * 48, usage: GPU_BUF.VERTEX | GPU_BUF.COPY_DST });
  const cosmicFxBuf = device.createBuffer({ label: 'uv-cosmic-fx', size: MAX_COSMIC_VERTS * 48, usage: GPU_BUF.VERTEX | GPU_BUF.COPY_DST });

  let nuclearVolBuf = device.createBuffer({ label: 'uv-nuclear-vol', size: 32 * 32 * 32 * 16, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  let nuclearVolCapacityBytes = 32 * 32 * 32 * 16;

  const mkMod = (label, code) => device.createShaderModule({ label, code });

  const backdropMod = mkMod('uv-backdrop', BACKDROP_WGSL);
  const backdropPipe = device.createRenderPipeline({
    label: 'uv-backdrop-pipe',
    layout: 'auto',
    vertex: { module: backdropMod, entryPoint: 'vs_main' },
    fragment: { module: backdropMod, entryPoint: 'fs_main', targets: [{ format: sceneFormat }] },
    primitive: { topology: 'triangle-list' },
    depthStencil: { format: depthFormat, depthWriteEnabled: false, depthCompare: 'always' }
  });
  const backdropBg = device.createBindGroup({
    layout: backdropPipe.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: camBuf } }]
  });

  const surfaceSkyMod = mkMod('uv-surface-sky', SURFACE_SKY_WGSL);
  const surfaceSkyPipe = device.createRenderPipeline({
    label: 'uv-surface-sky-pipe',
    layout: 'auto',
    vertex: { module: surfaceSkyMod, entryPoint: 'vs_main' },
    fragment: { module: surfaceSkyMod, entryPoint: 'fs_main', targets: [{ format: sceneFormat }] },
    primitive: { topology: 'triangle-list' },
    depthStencil: { format: depthFormat, depthWriteEnabled: false, depthCompare: 'always' }
  });
  const surfaceSkyBg = device.createBindGroup({
    layout: surfaceSkyPipe.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: auxCamBuf } }]
  });

  const surfaceMeshMod = mkMod('uv-surface-mesh', SURFACE_MESH_WGSL);
  const surfaceMeshPipe = device.createRenderPipeline({
    label: 'uv-surface-mesh-pipe',
    layout: 'auto',
    vertex: {
      module: surfaceMeshMod,
      entryPoint: 'vs_main',
      buffers: [{
        arrayStride: 48,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x4' },
          { shaderLocation: 1, offset: 16, format: 'float32x4' },
          { shaderLocation: 2, offset: 32, format: 'float32x4' }
        ]
      }]
    },
    fragment: {
      module: surfaceMeshMod,
      entryPoint: 'fs_main',
      targets: [{ format: sceneFormat }]
    },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: depthFormat, depthWriteEnabled: true, depthCompare: 'greater-equal' }
  });
  const surfaceMeshBg = device.createBindGroup({
    layout: surfaceMeshPipe.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: auxCamBuf } }]
  });
  const cosmicMeshBg = device.createBindGroup({
    layout: surfaceMeshPipe.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: spaceMeshCamBuf } }]
  });

  const surfaceFloraMod = mkMod('uv-surface-flora', SURFACE_FLORA_INSTANCED_WGSL);
  const surfaceFloraPipe = device.createRenderPipeline({
    label: 'uv-surface-flora-pipe',
    layout: 'auto',
    vertex: {
      module: surfaceFloraMod,
      entryPoint: 'vs_main',
      buffers: [{
        arrayStride: 32,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x4' },
          { shaderLocation: 1, offset: 16, format: 'float32x4' }
        ]
      }]
    },
    fragment: {
      module: surfaceFloraMod,
      entryPoint: 'fs_main',
      targets: [{ format: sceneFormat }]
    },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: depthFormat, depthWriteEnabled: true, depthCompare: 'greater-equal' }
  });
  const floraBgCache = new WeakMap();
  function getFloraBindGroup(instanceBuf) {
    let bg = floraBgCache.get(instanceBuf);
    if (!bg) {
      bg = device.createBindGroup({
        layout: surfaceFloraPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: floraCamBuf } },
          { binding: 1, resource: { buffer: instanceBuf } }
        ]
      });
      floraBgCache.set(instanceBuf, bg);
    }
    return bg;
  }

  const fxMod = mkMod('uv-translucent-fx', TRANSLUCENT_FX_WGSL);
  const translucentFxPipe = device.createRenderPipeline({
    label: 'uv-translucent-fx-pipe',
    layout: 'auto',
    vertex: {
      module: fxMod,
      entryPoint: 'vs_main',
      buffers: [{
        arrayStride: 48,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x4' },
          { shaderLocation: 1, offset: 16, format: 'float32x4' },
          { shaderLocation: 2, offset: 32, format: 'float32x4' }
        ]
      }]
    },
    fragment: {
      module: fxMod,
      entryPoint: 'fs_main',
      targets: [{
        format: sceneFormat,
        blend: {
          color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
        }
      }]
    },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: depthFormat, depthWriteEnabled: false, depthCompare: 'greater-equal' }
  });
  const surfaceFxBg = device.createBindGroup({
    layout: translucentFxPipe.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: auxCamBuf } }]
  });
  const cosmicFxBg = device.createBindGroup({
    layout: translucentFxPipe.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: spaceMeshCamBuf } }]
  });

  const cloudMod = mkMod('uv-cloud', PARTICLE_CLOUD_WGSL);
  const particleCloudPipe = device.createRenderPipeline({
    label: 'uv-cloud-pipe',
    layout: 'auto',
    vertex: { module: cloudMod, entryPoint: 'vs_main' },
    fragment: {
      module: cloudMod,
      entryPoint: 'fs_main',
      targets: [{
        format: sceneFormat,
        blend: {
          color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }
        }
      }]
    },
    primitive: { topology: 'triangle-list' },
    depthStencil: { format: depthFormat, depthWriteEnabled: false, depthCompare: 'greater-equal' }
  });
  const backdropCloudPipe = device.createRenderPipeline({
    label: 'uv-backdrop-cloud-pipe',
    layout: 'auto',
    vertex: { module: cloudMod, entryPoint: 'vs_main' },
    fragment: {
      module: cloudMod,
      entryPoint: 'fs_main',
      targets: [{
        format: sceneFormat,
        blend: {
          color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }
        }
      }]
    },
    primitive: { topology: 'triangle-list' },
    depthStencil: { format: depthFormat, depthWriteEnabled: false, depthCompare: 'always' }
  });

  const sphereMod = mkMod('uv-lit-sphere', LIT_SPHERE_WGSL);
  const litSpherePipe = device.createRenderPipeline({
    label: 'uv-lit-sphere-pipe',
    layout: 'auto',
    vertex: { module: sphereMod, entryPoint: 'vs_main' },
    fragment: {
      module: sphereMod,
      entryPoint: 'fs_main',
      targets: [{
        format: sceneFormat,
        blend: {
          color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
        }
      }]
    },
    primitive: { topology: 'triangle-list' },
    depthStencil: { format: depthFormat, depthWriteEnabled: true, depthCompare: 'greater-equal' }
  });
  const dummyAtmoBuf = device.createBuffer({ label: 'uv-dummy-atmo-em', size: 96, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const dummySphGeoBuf = device.createBuffer({ label: 'uv-dummy-sph-geo', size: 64, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const sphereBgCache = new WeakMap();
  function getLitSphereBindGroup(atmoBuf, sphGeoBuf = null) {
    const aBuf = atmoBuf || dummyAtmoBuf;
    const gBuf = sphGeoBuf || dummySphGeoBuf;
    let subMap = sphereBgCache.get(aBuf);
    if (!subMap) {
      subMap = new WeakMap();
      sphereBgCache.set(aBuf, subMap);
    }
    let bg = subMap.get(gBuf);
    if (!bg) {
      bg = device.createBindGroup({
        layout: litSpherePipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: camBuf } },
          { binding: 1, resource: { buffer: sphereBuf } },
          { binding: 2, resource: { buffer: aBuf } },
          { binding: 3, resource: { buffer: gBuf } }
        ]
      });
      subMap.set(gBuf, bg);
    }
    return bg;
  }

  const mdMod = mkMod('uv-md-sphere', MD_SPHERE_WGSL);
  const mdSpherePipe = device.createRenderPipeline({
    label: 'uv-md-sphere-pipe',
    layout: 'auto',
    vertex: { module: mdMod, entryPoint: 'vs_main' },
    fragment: {
      module: mdMod,
      entryPoint: 'fs_main',
      targets: [{
        format: sceneFormat,
        blend: {
          color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
        }
      }]
    },
    primitive: { topology: 'triangle-list' },
    depthStencil: { format: depthFormat, depthWriteEnabled: true, depthCompare: 'greater-equal' }
  });

  const diskMod = mkMod('uv-disk', DISK_WGSL);
  const diskPipe = device.createRenderPipeline({
    label: 'uv-disk-pipe',
    layout: 'auto',
    vertex: { module: diskMod, entryPoint: 'vs_main' },
    fragment: {
      module: diskMod,
      entryPoint: 'fs_main',
      targets: [{
        format: sceneFormat,
        blend: {
          color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
        }
      }]
    },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: depthFormat, depthWriteEnabled: false, depthCompare: 'greater-equal' }
  });
  const diskBg = device.createBindGroup({
    layout: diskPipe.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: camBuf } },
      { binding: 1, resource: { buffer: diskBuf } }
    ]
  });

  const lineMod = mkMod('uv-line', LINE_WGSL);
  const linePipe = device.createRenderPipeline({
    label: 'uv-line-pipe',
    layout: 'auto',
    vertex: {
      module: lineMod,
      entryPoint: 'vs_main',
      buffers: [{
        arrayStride: 28,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },
          { shaderLocation: 1, offset: 12, format: 'float32x4' }
        ]
      }]
    },
    fragment: {
      module: lineMod,
      entryPoint: 'fs_main',
      targets: [{
        format: sceneFormat,
        blend: {
          color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
        }
      }]
    },
    primitive: { topology: 'line-list' },
    depthStencil: { format: depthFormat, depthWriteEnabled: false, depthCompare: 'greater-equal' }
  });
  const lineBg = device.createBindGroup({
    layout: linePipe.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: camBuf } }]
  });

  const volMod = mkMod('uv-nuclear-vol', NUCLEAR_VOL_WGSL);
  const volumePipe = device.createRenderPipeline({
    label: 'uv-nuclear-vol-pipe',
    layout: 'auto',
    vertex: { module: volMod, entryPoint: 'vs_main' },
    fragment: {
      module: volMod,
      entryPoint: 'fs_main',
      targets: [{
        format: sceneFormat,
        blend: {
          color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
        }
      }]
    },
    primitive: { topology: 'triangle-list' },
    depthStencil: { format: depthFormat, depthWriteEnabled: false, depthCompare: 'always' }
  });
  let volumeBg = device.createBindGroup({
    layout: volumePipe.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: auxCamBuf } },
      { binding: 1, resource: { buffer: nuclearVolBuf } }
    ]
  });

  const astroVolMod = mkMod('uv-astro-vol', ASTRO_VOL_WGSL);
  const astroVolPipe = device.createRenderPipeline({
    label: 'uv-astro-vol-pipe',
    layout: 'auto',
    vertex: { module: astroVolMod, entryPoint: 'vs_main' },
    fragment: {
      module: astroVolMod,
      entryPoint: 'fs_main',
      targets: [{
        format: sceneFormat,
        blend: {
          color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
        }
      }]
    },
    primitive: { topology: 'triangle-list' },
    depthStencil: { format: depthFormat, depthWriteEnabled: false, depthCompare: 'always' }
  });
  const astroVolBgCache = new WeakMap();
  function getAstroVolBindGroup(gridBuf) {
    let bg = astroVolBgCache.get(gridBuf);
    if (!bg) {
      bg = device.createBindGroup({
        layout: astroVolPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: astroVolCamBuf } },
          { binding: 1, resource: { buffer: gridBuf } }
        ]
      });
      astroVolBgCache.set(gridBuf, bg);
    }
    return bg;
  }

  const bloomMod = mkMod('uv-bloom', BLOOM_WGSL);
  const bloomPipe = device.createRenderPipeline({
    label: 'uv-bloom-pipe',
    layout: 'auto',
    vertex: { module: bloomMod, entryPoint: 'vs_main' },
    fragment: { module: bloomMod, entryPoint: 'fs_main', targets: [{ format: sceneFormat }] },
    primitive: { topology: 'triangle-list' }
  });
  let bloomExtractBg = null;
  let bloomBlurBg = null;

  const postMod = mkMod('uv-post', POST_WGSL);
  const postPipe = device.createRenderPipeline({
    label: 'uv-post-pipe',
    layout: 'auto',
    vertex: { module: postMod, entryPoint: 'vs_main' },
    fragment: { module: postMod, entryPoint: 'fs_main', targets: [{ format: presentFormat }] },
    primitive: { topology: 'triangle-list' }
  });
  let postBg = null;

  const cloudBgCaches = Array.from({ length: MAX_CLOUD_SLOTS }, () => new WeakMap());
  const backdropCloudBgCaches = Array.from({ length: MAX_CLOUD_SLOTS }, () => new WeakMap());
  const mdBgCache = new WeakMap();

  function getCloudBindGroup(buf, slot, isBackdrop = false) {
    const cache = (isBackdrop ? backdropCloudBgCaches : cloudBgCaches)[slot];
    const uBuf = cloudCamBufs[slot];
    const pipeRef = isBackdrop ? backdropCloudPipe : particleCloudPipe;
    let bg = cache.get(buf);
    if (!bg) {
      bg = device.createBindGroup({
        layout: pipeRef.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uBuf } },
          { binding: 1, resource: { buffer: buf } }
        ]
      });
      cache.set(buf, bg);
    }
    return bg;
  }

  function getMdBindGroup(posBuf, velBuf) {
    let bg = mdBgCache.get(posBuf);
    if (!bg) {
      bg = device.createBindGroup({
        layout: mdSpherePipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: auxCamBuf } },
          { binding: 1, resource: { buffer: posBuf } },
          { binding: 2, resource: { buffer: velBuf } }
        ]
      });
      mdBgCache.set(posBuf, bg);
    }
    return bg;
  }

  function ensureRenderTargets(w, h) {
    const nw = Math.max(2, Math.floor(w));
    const nh = Math.max(2, Math.floor(h));
    if (sceneTex && width === nw && height === nh) return;
    width = nw;
    height = nh;
    const bw = Math.max(2, Math.floor(width / 2));
    const bh = Math.max(2, Math.floor(height / 2));
    configureCompatibleWebGpuCanvas(ctx, device, { preferCopySrc: true });
    sceneTex?.destroy();
    depthTex?.destroy();
    bloomTexA?.destroy();
    bloomTexB?.destroy();
    sceneTex = device.createTexture({
      label: 'uv-scene-color',
      size: [width, height],
      format: sceneFormat,
      usage: GPU_TEX.RENDER_ATTACHMENT | GPU_TEX.TEXTURE_BINDING
    });
    sceneView = sceneTex.createView();
    depthTex = device.createTexture({
      label: 'uv-scene-depth',
      size: [width, height],
      format: depthFormat,
      usage: GPU_TEX.RENDER_ATTACHMENT
    });
    depthView = depthTex.createView();
    bloomTexA = device.createTexture({
      label: 'uv-bloom-a',
      size: [bw, bh],
      format: sceneFormat,
      usage: GPU_TEX.RENDER_ATTACHMENT | GPU_TEX.TEXTURE_BINDING
    });
    bloomViewA = bloomTexA.createView();
    bloomTexB = device.createTexture({
      label: 'uv-bloom-b',
      size: [bw, bh],
      format: sceneFormat,
      usage: GPU_TEX.RENDER_ATTACHMENT | GPU_TEX.TEXTURE_BINDING
    });
    bloomViewB = bloomTexB.createView();
    device.queue.writeBuffer(bloomExtractUniformBuf, 0, new Float32Array([1.0 / width, 1.0 / height, 1.02, 0.0]));
    device.queue.writeBuffer(bloomBlurUniformBuf, 0, new Float32Array([1.0 / bw, 1.0 / bh, 1.02, 1.0]));
    bloomExtractBg = device.createBindGroup({
      layout: bloomPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bloomExtractUniformBuf } },
        { binding: 1, resource: sceneView },
        { binding: 2, resource: sampler }
      ]
    });
    bloomBlurBg = device.createBindGroup({
      layout: bloomPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bloomBlurUniformBuf } },
        { binding: 1, resource: bloomViewA },
        { binding: 2, resource: sampler }
      ]
    });
    postBg = device.createBindGroup({
      layout: postPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: postUniformBuf } },
        { binding: 1, resource: sceneView },
        { binding: 2, resource: sampler },
        { binding: 3, resource: bloomViewB }
      ]
    });
  }

  function uploadNuclearVolume(volumeData) {
    if (!volumeData || volumeData.byteLength === 0) return;
    if (volumeData.byteLength > nuclearVolCapacityBytes) {
      nuclearVolBuf.destroy();
      nuclearVolCapacityBytes = volumeData.byteLength;
      nuclearVolBuf = device.createBuffer({
        label: 'uv-nuclear-vol',
        size: nuclearVolCapacityBytes,
        usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST
      });
      volumeBg = device.createBindGroup({
        layout: volumePipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: auxCamBuf } },
          { binding: 1, resource: { buffer: nuclearVolBuf } }
        ]
      });
    }
    device.queue.writeBuffer(nuclearVolBuf, 0, volumeData);
  }

  const camData = new Float32Array(60);
  const postData = new Float32Array(16);
  const sphereStaging = new Float32Array(MAX_SPHERES * 20);
  const diskStaging = new Float32Array(MAX_DISKS * 16);
  const lineStaging = new Float32Array(MAX_LINE_VERTS * 7);

  function writeCam(targetBuf, camera, extra0, extra1, extra2, emSensorVec = null, emAuxVec = null, starLightVec = null, sphGeoVec = null) {
    camData.set(camera.viewProj, 0);
    camData.set([camera.pos[0], camera.pos[1], camera.pos[2], camera.timeSec || 0], 16);
    camData.set([camera.right[0], camera.right[1], camera.right[2], camera.aspect], 20);
    camData.set([camera.up[0], camera.up[1], camera.up[2], camera.fovTanHalf], 24);
    camData.set([camera.fwd[0], camera.fwd[1], camera.fwd[2], camera.log10SpanM ?? 24.8], 28);
    camData.set(extra0 || [0, 0, 0, 0], 32);
    camData.set(extra1 || [0, 0, 0, 0], 36);
    camData.set(extra2 || [0, 0, 0, 0], 40);
    camData.set(emSensorVec || [-6.42, -6.12, 0.0, 1.0], 44);
    camData.set(emAuxVec || [288.0, 1.0, 0.0, 0.0], 48);
    camData.set(starLightVec || [1.0, 0.97, 0.92, 1.0], 52);
    camData.set(sphGeoVec || [0, 0, -1, -1.5], 56);
    device.queue.writeBuffer(targetBuf, 0, camData);
  }

  function renderFrame({
    camera,
    particleClouds = [],  // Up to 4 simultaneous zero-copy GPU clouds for seamless cross-scale zoom!
    spheres = null,
    atmoEm = null,        // Optional zero-copy live GPU spherical baroclinic + triboelectric EM + CFD flow buffer!
    sphGeology = null,    // Optional zero-copy live GPU 3D SPH Planetary Genesis spherical geology map!
    surfaceScene = null,  // Optional live GPU Planetary Surface Terrain + Boulders + Flora + Rover/Drone/UFO + Translucent FX!
    cosmicMeshes = null,  // Optional `{ opaque: Float32Array, fx: Float32Array }` for 3D UFO/Remote UFOs/Probes in space!
    lightDir = [0.6, 0.75, 0.55],
    lightIsPoint = false, // True in L2 multi-planet view -> `lightDir` holds live host-star world pos for radial per-body illumination!
    coolingHeat = 0.0,    // Continuous post-SPH planetary cooling ramp [0..1] for focused SPH globe
    ringShadow = null,    // Optional `{ normal, rInRatio, rOutRatio, sphereIndex }` casting ring shadows onto focused ringed planet!
    starLight = [1.0, 0.97, 0.92, 1.0], // Physical linear host-star RGB + perceptual inverse-square irradiance gain!
    mdCloud = null,
    disks = null,
    lines = null,
    nuclearVol = null,
    astroVol = null,      // Optional zero-copy live 3D volumetric ray-marched MLS-MPM Star (mode 0) or SPH Protoplanet (mode 1)!
    emSensor = null,      // Optional `{ log10LambdaMin, log10LambdaMax, active, gain }` full-spectrum EM sensor window!
    post = {},
    stereoSbs = false,    // Optional Side-by-Side Stereo VR Preview split-eye post/viewport pass
    xrEyeTarget = null    // Optional native WebXR WebGPU `{ colorView, depthView, viewport }`
  }) {
    ensureRenderTargets(canvas.width, canvas.height);

    const emSensorVec = emSensor && emSensor.active
      ? [
        Number.isFinite(emSensor.log10LambdaMin) ? emSensor.log10LambdaMin : -6.42,
        Number.isFinite(emSensor.log10LambdaMax) ? emSensor.log10LambdaMax : -6.12,
        1.0,
        Math.max(0.2, Number(emSensor.gain) || 1.0)
      ]
      : [-6.42, -6.12, 0.0, 1.0];
    const baseAmbientTempK = Number(surfaceScene?.ambientTempK ?? surfaceScene?.env?.tempK ?? mdCloud?.tempK ?? 288.0);
    // Enable unified Reversed Logarithmic Depth Buffer (0.1 m -> 10^14 m) on ALL surface passes (bit 1 = 2.0)!
    const logDepthFlag = (surfaceScene && surfaceScene.env) ? 2.0 : 0.0;
    const baseEmAux = [baseAmbientTempK, Number(surfaceScene?.eclipseFactor ?? 1.0), Number(surfaceScene?.env?.skyOpticalDepth ?? 0.0), logDepthFlag];

    let sphereCount = 0;
    if (Array.isArray(spheres) && spheres.length > 0) {
      sphereCount = Math.min(MAX_SPHERES, spheres.length);
      for (let i = 0; i < sphereCount; i += 1) {
        const s = spheres[i];
        const o = i * 20;
        sphereStaging[o + 0] = s.pos[0];
        sphereStaging[o + 1] = s.pos[1];
        sphereStaging[o + 2] = s.pos[2];
        sphereStaging[o + 3] = s.radius;
        sphereStaging[o + 4] = s.color0[0];
        sphereStaging[o + 5] = s.color0[1];
        sphereStaging[o + 6] = s.color0[2];
        sphereStaging[o + 7] = s.kind ?? 1;
        sphereStaging[o + 8] = s.color1?.[0] ?? s.color0[0];
        sphereStaging[o + 9] = s.color1?.[1] ?? s.color0[1];
        sphereStaging[o + 10] = s.color1?.[2] ?? s.color0[2];
        sphereStaging[o + 11] = s.atm ?? 0.35;
        sphereStaging[o + 12] = s.rCore ?? 0.52;
        sphereStaging[o + 13] = s.rMantle ?? 0.94;
        sphereStaging[o + 14] = s.cutaway ? 1.0 : 0.0;
        sphereStaging[o + 15] = s.seed ?? (i + 1) * 1.37;
        sphereStaging[o + 16] = Number(s.tempK) || (s.kind === 0 ? 5778.0 : 288.0);
        sphereStaging[o + 17] = Number(s.civTechK) || 0.0;
        sphereStaging[o + 18] = Number(s.dysonCoverage) || 0.0;
        sphereStaging[o + 19] = Number(s.flags) || 0.0;
      }
      device.queue.writeBuffer(sphereBuf, 0, sphereStaging.subarray(0, sphereCount * 20));
    }

    let diskCount = 0;
    if (Array.isArray(disks) && disks.length > 0) {
      diskCount = Math.min(MAX_DISKS, disks.length);
      for (let i = 0; i < diskCount; i += 1) {
        const d = disks[i];
        const o = i * 16;
        diskStaging[o + 0] = d.center[0];
        diskStaging[o + 1] = d.center[1];
        diskStaging[o + 2] = d.center[2];
        diskStaging[o + 3] = d.rIn;
        diskStaging[o + 4] = d.normal[0];
        diskStaging[o + 5] = d.normal[1];
        diskStaging[o + 6] = d.normal[2];
        diskStaging[o + 7] = d.rOut;
        diskStaging[o + 8] = d.color?.[0] ?? 0.9;
        diskStaging[o + 9] = d.color?.[1] ?? 0.85;
        diskStaging[o + 10] = d.color?.[2] ?? 0.72;
        diskStaging[o + 11] = d.kind ?? 0;
        diskStaging[o + 12] = Number(d.planetRadius) || 0;
        diskStaging[o + 13] = Number(d.oblateF) || 0;
        diskStaging[o + 14] = 0;
        diskStaging[o + 15] = 0;
      }
      device.queue.writeBuffer(diskBuf, 0, diskStaging.subarray(0, diskCount * 16));
    }

    let lineVertCount = 0;
    if (lines && lines.length >= 14) {
      lineVertCount = Math.min(MAX_LINE_VERTS, Math.floor(lines.length / 7));
      lineStaging.set(lines.subarray(0, lineVertCount * 7), 0);
      device.queue.writeBuffer(lineBuf, 0, lineStaging.subarray(0, lineVertCount * 7));
    }

    let cosmicOpaqueCount = 0;
    let cosmicFxCount = 0;
    if (cosmicMeshes) {
      if (cosmicMeshes.opaque && cosmicMeshes.opaque.length >= 12) {
        cosmicOpaqueCount = Math.min(MAX_COSMIC_VERTS, Math.floor(cosmicMeshes.opaque.length / 12));
        device.queue.writeBuffer(cosmicMeshBuf, 0, cosmicMeshes.opaque.subarray(0, cosmicOpaqueCount * 12));
      }
      if (cosmicMeshes.fx && cosmicMeshes.fx.length >= 12) {
        cosmicFxCount = Math.min(MAX_COSMIC_VERTS, Math.floor(cosmicMeshes.fx.length / 12));
        device.queue.writeBuffer(cosmicFxBuf, 0, cosmicMeshes.fx.subarray(0, cosmicFxCount * 12));
      }
    }

    const activeClouds = (particleClouds || []).filter((c) => c && c.buffer && c.count > 0).slice(0, MAX_CLOUD_SLOTS);
    const hasLiveParentBackdrop = activeClouds.some((c) => c.isBackdrop);
    const hasAtmo = Boolean(atmoEm && atmoEm.buffer && atmoEm.width > 0 && atmoEm.height > 0);
    const hasSphGeo = Boolean(sphGeology && sphGeology.buffer && sphGeology.width > 0 && sphGeology.height > 0);
    const hasRingSh = Boolean(!hasSphGeo && ringShadow && ringShadow.rOutRatio > 1.05);
    const sphGeoVec = hasSphGeo
      ? [sphGeology.width, sphGeology.height, sphGeology.sphereIndex ?? 0, Number.isFinite(sphGeology.seaLevelNorm) ? sphGeology.seaLevelNorm : -0.05]
      : (hasRingSh
        ? [ringShadow.normal[0], ringShadow.normal[1], ringShadow.normal[2], ringShadow.sphereIndex ?? 0]
        : [0, 0, -1, -1.5]);
    const camExtra0Z = hasRingSh ? Number(ringShadow.rInRatio) : Math.max(0, Math.min(1, Number(coolingHeat) || 0));
    const camExtra0W = hasRingSh ? Number(ringShadow.rOutRatio) : 0;
    const starLightVec = (Array.isArray(starLight) && starLight.length >= 4)
      ? [Number(starLight[0]) || 1.0, Number(starLight[1]) || 0.97, Number(starLight[2]) || 0.92, Number(starLight[3]) || 1.0]
      : [1.0, 0.97, 0.92, 1.0];
    writeCam(
      camBuf,
      camera,
      [camera.level || 0, hasLiveParentBackdrop ? 1.0 : 0.0, camExtra0Z, camExtra0W],
      [lightDir[0], lightDir[1], lightDir[2], lightIsPoint ? 1.0 : 0.0],
      hasAtmo ? [atmoEm.width, atmoEm.height, atmoEm.sphereIndex ?? 0, 1.0] : [1, 1, -1, 0.0],
      emSensorVec,
      baseEmAux,
      starLightVec,
      sphGeoVec
    );
    // Dedicated clean space-mesh camera uniform (sky_hor=0, opt_depth=0, isMagma=0, flags=1 skipping aerial fog!)
    // Fixes UFO metallic/neon-yellow fog bleed when hovering in space at L0..L4!
    writeCam(
      spaceMeshCamBuf,
      camera,
      [0.06, 0.09, 0.14, 0.0],
      [lightDir[0], lightDir[1], lightDir[2], 0.0],
      [0.0, 0.0, 0.0, 0.0],
      emSensorVec,
      [320.0, 1.0, 0.0, 1.0],
      starLightVec
    );

    for (let slot = 0; slot < activeClouds.length; slot += 1) {
      const c = activeClouds[slot];
      const uBuf = cloudCamBufs[slot];
      writeCam(
        uBuf,
        camera,
        [c.mode, c.worldScale, c.pointSize, c.alphaGain],
        c.extra1 || [...(c.colorPos || [0, 0, 0]), 0],
        c.extra2 || [...(c.colorNeg || [0, 0, 0]), 0],
        emSensorVec,
        baseEmAux,
        starLightVec
      );
    }

    if (surfaceScene && surfaceScene.env) {
      const env = surfaceScene.env;
      const ld = surfaceScene.lightDir || lightDir;
      const curvInv2R = env.hasSolidCrust ? (1.0 / (2.0 * (env.tinyPlanetCurvatureRadiusM || 2800.0))) : 0.0;
      const surfAuroraVec = [
        Number(surfaceScene.auroraStrength) || 0.0,
        Number(surfaceScene.observerLatRad) || 0.0,
        Number(surfaceScene.dynamoMicroT) || 0.0,
        0.0
      ];
      writeCam(
        auxCamBuf,
        camera,
        [env.skyZenithRgb[0], env.skyZenithRgb[1], env.skyZenithRgb[2], env.skyOpticalDepth],
        [ld[0], ld[1], ld[2], curvInv2R],
        [env.skyHorizonRgb[0], env.skyHorizonRgb[1], env.skyHorizonRgb[2], env.isMagmaOcean ? 1.0 : 0.0],
        emSensorVec,
        baseEmAux,
        starLightVec,
        surfAuroraVec
      );
      const fp = surfaceScene.focusPos || camera.pos;
      writeCam(
        floraCamBuf,
        camera,
        [env.skyZenithRgb[0], env.skyZenithRgb[1], env.skyZenithRgb[2], env.skyOpticalDepth],
        [ld[0], ld[1], ld[2], curvInv2R],
        [env.skyHorizonRgb[0], env.skyHorizonRgb[1], env.skyHorizonRgb[2], fp[0] || 0],
        emSensorVec,
        [baseEmAux[0], baseEmAux[1], fp[2] || 0, baseEmAux[3]],
        starLightVec
      );
    } else if (mdCloud && mdCloud.positionsBuffer && mdCloud.velocitiesBuffer && mdCloud.count > 0) {
      writeCam(
        auxCamBuf,
        camera,
        [mdCloud.halfBox[0], mdCloud.halfBox[1], mdCloud.halfBox[2], mdCloud.worldScale],
        [mdCloud.baseRgb[0], mdCloud.baseRgb[1], mdCloud.baseRgb[2], mdCloud.radius],
        [mdCloud.alphaFade ?? 1.0, 0, 0, mdCloud.idealCoord || 12],
        emSensorVec,
        baseEmAux,
        starLightVec
      );
    } else if (nuclearVol && nuclearVol.dim > 0) {
      writeCam(
        auxCamBuf,
        camera,
        [nuclearVol.dim, nuclearVol.boxRadius || 3.4, nuclearVol.tdseTunneled || 0, nuclearVol.tdseCrestNorm || 0.72],
        [nuclearVol.alphaMul ?? 1.0, 0, 0, 0],
        [0, 0, 0, 0],
        emSensorVec,
        baseEmAux,
        starLightVec
      );
    }

    if (astroVol && astroVol.buffer && astroVol.dim >= 8) {
      const avL = astroVol.lightDir || lightDir;
      writeCam(
        astroVolCamBuf,
        camera,
        [astroVol.dim, astroVol.boxRadius || 6.0, astroVol.mode || 0, astroVol.alphaMul ?? 1.0],
        [astroVol.center?.[0] || 0, astroVol.center?.[1] || 0, astroVol.center?.[2] || 0, astroVol.paramA ?? 3.76],
        astroVol.extra2 || [0.72, 0.0, post.timeSec ?? 0, 3.0],
        emSensorVec,
        baseEmAux,
        starLightVec,
        [avL[0], avL[1], avL[2], 0]
      );
    }

    const bloomStrength = post.bloomStrength ?? 0.22;
    postData[0] = width;
    postData[1] = height;
    postData[2] = post.bhUv?.[0] ?? 0.5;
    postData[3] = post.bhUv?.[1] ?? 0.5;
    postData[4] = post.bhStrength ?? 0;
    postData[5] = post.warpAmount ?? 0;
    postData[6] = post.flashAmount ?? 0;
    postData[7] = post.crtEnabled ? 1.0 : 0.0;
    postData[8] = post.pixelSize ?? 3.0;
    postData[9] = post.timeSec ?? 0;
    postData[10] = bloomStrength;
    postData[11] = 0;
    postData[12] = emSensorVec[0];
    postData[13] = emSensorVec[1];
    postData[14] = emSensorVec[2];
    postData[15] = emSensorVec[3];
    device.queue.writeBuffer(postUniformBuf, 0, postData);

    const enc = device.createCommandEncoder({ label: 'uv-frame-fused' });
    {
      const pass = enc.beginRenderPass({
        colorAttachments: [{
          view: sceneView,
          clearValue: { r: 0.005, g: 0.009, b: 0.02, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store'
        }],
        depthStencilAttachment: {
          view: depthView,
          depthClearValue: 0.0, // Reversed-Z Infinite Far Plane clear value!
          depthLoadOp: 'clear',
          depthStoreOp: 'store'
        }
      });
      if (surfaceScene && surfaceScene.env) {
        pass.setPipeline(surfaceSkyPipe);
        pass.setBindGroup(0, surfaceSkyBg);
        pass.draw(3, 1, 0, 0);

        // Render live rescaled parent galaxy skyband behind vacuum/thin-sky/night planetary horizons BEFORE solid terrain!
        for (let slot = 0; slot < activeClouds.length; slot += 1) {
          const c = activeClouds[slot];
          if (!c.isBackdrop) continue;
          pass.setPipeline(backdropCloudPipe);
          pass.setBindGroup(0, getCloudBindGroup(c.buffer, slot, true));
          pass.draw(6, c.count, 0, 0);
        }

        // Render live celestial sky spheres (host sun(s), moons, sibling planets) & planetary rings BEHIND terrain mountains
        // with Reversed-Z depth testing so real mountains occlude setting suns & moons eclipse suns!
        if (sphereCount > 0) {
          pass.setPipeline(litSpherePipe);
          pass.setBindGroup(0, getLitSphereBindGroup(hasAtmo ? atmoEm.buffer : null, hasSphGeo ? sphGeology.buffer : null));
          pass.draw(6, sphereCount, 0, 0);
        }
        if (diskCount > 0) {
          pass.setPipeline(diskPipe);
          pass.setBindGroup(0, diskBg);
          pass.draw(6, diskCount, 0, 0);
        }

        if (!surfaceScene.hideTerrain && surfaceScene.terrainVertBuf && surfaceScene.terrainIdxBuf && surfaceScene.indexCount > 0) {
          pass.setPipeline(surfaceMeshPipe);
          pass.setBindGroup(0, surfaceMeshBg);
          pass.setVertexBuffer(0, surfaceScene.terrainVertBuf);
          pass.setIndexBuffer(surfaceScene.terrainIdxBuf, 'uint32');
          pass.drawIndexed(surfaceScene.indexCount, 1, 0, 0, 0);
        }
        if (surfaceScene.flora && surfaceScene.flora.instanceBuf && surfaceScene.flora.templateVertBuf
          && surfaceScene.flora.instanceCount > 0 && surfaceScene.flora.templateVertCount > 0) {
          pass.setPipeline(surfaceFloraPipe);
          pass.setBindGroup(0, getFloraBindGroup(surfaceScene.flora.instanceBuf));
          pass.setVertexBuffer(0, surfaceScene.flora.templateVertBuf);
          pass.draw(surfaceScene.flora.templateVertCount, surfaceScene.flora.instanceCount, 0, 0);
        }
        if (surfaceScene.boulderVertBuf && surfaceScene.boulderVertCount > 0) {
          pass.setPipeline(surfaceMeshPipe);
          pass.setBindGroup(0, surfaceMeshBg);
          pass.setVertexBuffer(0, surfaceScene.boulderVertBuf, 0, surfaceScene.boulderVertCount * 48);
          pass.draw(surfaceScene.boulderVertCount, 1, 0, 0);
        }
        if (surfaceScene.vehicleVertBuf && surfaceScene.vehicleVertCount > 0) {
          pass.setPipeline(surfaceMeshPipe);
          pass.setBindGroup(0, surfaceMeshBg);
          pass.setVertexBuffer(0, surfaceScene.vehicleVertBuf, 0, surfaceScene.vehicleVertCount * 48);
          pass.draw(surfaceScene.vehicleVertCount, 1, 0, 0);
        }
      } else {
        pass.setPipeline(backdropPipe);
        pass.setBindGroup(0, backdropBg);
        pass.draw(3, 1, 0, 0);

        // Render live rescaled parent-scale GPU simulation as true 3D celestial perspective skybox BEFORE foreground!
        for (let slot = 0; slot < activeClouds.length; slot += 1) {
          const c = activeClouds[slot];
          if (!c.isBackdrop) continue;
          pass.setPipeline(backdropCloudPipe);
          pass.setBindGroup(0, getCloudBindGroup(c.buffer, slot, true));
          pass.draw(6, c.count, 0, 0);
        }
      }

      if (lineVertCount > 0) {
        pass.setPipeline(linePipe);
        pass.setBindGroup(0, lineBg);
        pass.setVertexBuffer(0, lineBuf, 0, lineVertCount * 28);
        pass.draw(lineVertCount, 1, 0, 0);
      }

      if (!(surfaceScene && surfaceScene.env)) {
        if (sphereCount > 0) {
          pass.setPipeline(litSpherePipe);
          pass.setBindGroup(0, getLitSphereBindGroup(hasAtmo ? atmoEm.buffer : null, hasSphGeo ? sphGeology.buffer : null));
          pass.draw(6, sphereCount, 0, 0);
        }
        if (diskCount > 0) {
          pass.setPipeline(diskPipe);
          pass.setBindGroup(0, diskBg);
          pass.draw(6, diskCount, 0, 0);
        }
      }

      if (mdCloud && mdCloud.positionsBuffer && mdCloud.velocitiesBuffer && mdCloud.count > 0) {
        pass.setPipeline(mdSpherePipe);
        pass.setBindGroup(0, getMdBindGroup(mdCloud.positionsBuffer, mdCloud.velocitiesBuffer));
        pass.draw(6, mdCloud.count, 0, 0);
      }

      if (astroVol && astroVol.buffer && astroVol.dim >= 8) {
        pass.setPipeline(astroVolPipe);
        pass.setBindGroup(0, getAstroVolBindGroup(astroVol.buffer));
        pass.draw(3, 1, 0, 0);
      }

      if (!surfaceScene && cosmicOpaqueCount > 0) {
        pass.setPipeline(surfaceMeshPipe);
        pass.setBindGroup(0, cosmicMeshBg);
        pass.setVertexBuffer(0, cosmicMeshBuf, 0, cosmicOpaqueCount * 48);
        pass.draw(cosmicOpaqueCount, 1, 0, 0);
      }

      for (let slot = 0; slot < activeClouds.length; slot += 1) {
        const c = activeClouds[slot];
        if (c.isBackdrop) continue;
        pass.setPipeline(particleCloudPipe);
        pass.setBindGroup(0, getCloudBindGroup(c.buffer, slot, false));
        pass.draw(6, c.count, 0, 0);
      }

      if (nuclearVol && nuclearVol.dim > 0) {
        pass.setPipeline(volumePipe);
        pass.setBindGroup(0, volumeBg);
        pass.draw(3, 1, 0, 0);
      }

      // Translucent Glowing FX Pass LAST (Emerald Glass UFO Bubble, Yellow Conical Tractor Beam, 360° Rim EM Lasers & Antimatter Beams!)
      if (surfaceScene && surfaceScene.fxVertBuf && surfaceScene.fxVertCount > 0) {
        pass.setPipeline(translucentFxPipe);
        pass.setBindGroup(0, surfaceFxBg);
        pass.setVertexBuffer(0, surfaceScene.fxVertBuf, 0, surfaceScene.fxVertCount * 48);
        pass.draw(surfaceScene.fxVertCount, 1, 0, 0);
      } else if (!surfaceScene && cosmicFxCount > 0) {
        pass.setPipeline(translucentFxPipe);
        pass.setBindGroup(0, cosmicFxBg);
        pass.setVertexBuffer(0, cosmicFxBuf, 0, cosmicFxCount * 48);
        pass.draw(cosmicFxCount, 1, 0, 0);
      }
      pass.end();
    }

    // 2-Pass Half-Resolution Kawase HDR Bloom (bright-pass extract + soft halo blur before ACES!)
    if (bloomStrength > 0.001 && bloomExtractBg && bloomBlurBg) {
      const b1 = enc.beginRenderPass({
        colorAttachments: [{ view: bloomViewA, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }]
      });
      b1.setPipeline(bloomPipe);
      b1.setBindGroup(0, bloomExtractBg);
      b1.draw(3, 1, 0, 0);
      b1.end();

      const b2 = enc.beginRenderPass({
        colorAttachments: [{ view: bloomViewB, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }]
      });
      b2.setPipeline(bloomPipe);
      b2.setBindGroup(0, bloomBlurBg);
      b2.draw(3, 1, 0, 0);
      b2.end();
    }

    {
      const swapView = xrEyeTarget?.colorView || ctx.getCurrentTexture().createView();
      const postPass = enc.beginRenderPass({
        colorAttachments: [{
          view: swapView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: xrEyeTarget?.preserve ? 'load' : 'clear',
          storeOp: 'store'
        }]
      });
      if (xrEyeTarget?.viewport) {
        const vp = xrEyeTarget.viewport;
        postPass.setViewport(vp.x, vp.y, vp.width, vp.height, 0, 1);
      } else if (stereoSbs) {
        const halfW = Math.max(1, Math.floor(width * 0.5));
        postPass.setPipeline(postPipe);
        postPass.setBindGroup(0, postBg);
        postPass.setViewport(0, 0, halfW, height, 0, 1);
        postPass.draw(3, 1, 0, 0);
        postPass.setViewport(halfW, 0, width - halfW, height, 0, 1);
        postPass.draw(3, 1, 0, 0);
        postPass.end();
        device.queue.submit([enc.finish()]);
        return;
      }
      postPass.setPipeline(postPipe);
      postPass.setBindGroup(0, postBg);
      postPass.draw(3, 1, 0, 0);
      postPass.end();
    }
    device.queue.submit([enc.finish()]);
  }

  function dispose() {
    sceneTex?.destroy();
    depthTex?.destroy();
    bloomTexA?.destroy();
    bloomTexB?.destroy();
    for (const b of [
      camBuf, ...cloudCamBufs, auxCamBuf, astroVolCamBuf, spaceMeshCamBuf, postUniformBuf,
      bloomExtractUniformBuf, bloomBlurUniformBuf,
      sphereBuf, dummyAtmoBuf, dummySphGeoBuf, diskBuf, lineBuf, cosmicMeshBuf, cosmicFxBuf, nuclearVolBuf
    ]) {
      try { b.destroy(); } catch {}
    }
  }

  return Object.freeze({
    renderFrame,
    uploadNuclearVolume,
    dispose
  });
}
