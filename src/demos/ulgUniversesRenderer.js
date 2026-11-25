// Pure Direct-WebGPU Multiscale Renderer for ULG Universes (`src/demos/ulgUniversesRenderer.js`).
//
// Zero Three.js overhead, zero per-frame CPU particle readbacks, zero serial 1-thread compute passes:
//   1. Deep-space procedural starfield & nebula backdrop (`backdropPipe`)
//   2. Zero-copy GPU-resident glowing particle clouds (`particleCloudPipe`) reading
//      directly from L0 TreePM (stride 16), L1 Scale-Atlas Galaxy (stride 8),
//      L3 Self-Gravitating Hydro Plasma (stride 16), and L6 Dirac-KS Orbital Cloud (stride 4)
//   3. Depth-correct `@builtin(frag_depth)` analytical ray-sphere lit shader (`litSpherePipe`)
//      for L2 Star System bodies, L4 GPU-solved Planetary Cutaway Interior Globe, and L6 Molecule Nuclei
//   4. Zero-copy GPU-resident MD atom sphere shader (`mdSpherePipe`) reading
//      `mdSession.positionsBuffer` & `mdSession.velocitiesBuffer` directly on GPU
//   5. Translucent annular disk shader (`diskPipe`) for L1 Relativistic Doppler-Beamed
//      SMBH Accretion Disk & L2 Planetary Rings
//   6. 3D line renderer (`linePipe`) for L2 osculating Keplerian orbits, Travel Path, & L5 MD cell
//   7. 3D Volumetric Raymarcher (`volumePipe`) for L7 Woods-Saxon Nuclear Proton/Neutron Skin
//   8. Fullscreen Post-Processing Pass (`postPipe`): WGSL Schwarzschild Einstein-ring
//      gravitational lensing, Hyperdrive radial warp streaks, Big Bang flash, ACES tone-mapping,
//      and optional Retro CRT scanlines + pixelation!

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
  cam_fwd: vec4<f32>,    // xyz = forward basis, w = scaleAux
  extra0: vec4<f32>,     // mode-specific floats
  extra1: vec4<f32>,     // mode-specific floats
  extra2: vec4<f32>,     // mode-specific floats
};
`;

const BACKDROP_WGSL = /* wgsl */ `
${CAMERA_WGSL}

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
  out.pos = vec4<f32>(pts[vid], 0.9999, 1.0);
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
  let d = length(f - jitter * 0.55);
  let spark = exp(-d * d * 58.0) * smoothstep(thresh, 1.0, h);
  let temp = hash31(cell + 99.9);
  let col = mix(vec3<f32>(0.68, 0.82, 1.0), vec3<f32>(1.0, 0.86, 0.68), temp);
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
  let level_f = cam.extra0.x;
  let gal_band = exp(-pow(dir.y * 2.4 + dir.x * 0.65, 2.0) * 3.8);
  let neb1 = 0.5 + 0.5 * sin(dir.x * 4.2 + dir.z * 3.1) * cos(dir.y * 3.7 - dir.x * 2.5);
  let neb2 = 0.5 + 0.5 * cos(dir.z * 5.8 - dir.y * 4.1);

  let deep_col = mix(vec3<f32>(0.008, 0.014, 0.032), vec3<f32>(0.025, 0.042, 0.088), gal_band * neb1);
  let accent_tint = select(
    vec3<f32>(0.06, 0.03, 0.11),
    vec3<f32>(0.015, 0.055, 0.095),
    level_f >= 4.5
  );
  var col = deep_col + accent_tint * gal_band * neb2 * 0.42;

  // Multi-scale crisp world-space background starfield (fades gently at quantum/nuclear scales)
  let star_vis = select(1.0, 0.35, level_f >= 4.5);
  col = col + star_layer(dir, 52.0, 0.968) * 1.15 * star_vis;
  col = col + star_layer(dir, 118.0, 0.976) * 0.72 * star_vis;
  col = col + star_layer(dir, 210.0, 0.985) * 0.35 * star_vis;
  return vec4<f32>(col, 1.0);
}
`;

// Zero-copy resident GPU particle billboard renderer supporting 4 canonical ULG buffer layouts!
const PARTICLE_CLOUD_WGSL = /* wgsl */ `
${CAMERA_WGSL}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> raw_f32: array<f32>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) uv: vec2<f32>,
};

fn blackbody_rgb(log10_t: f32) -> vec3<f32> {
  if (log10_t < 2.2) {
    return vec3<f32>(0.55, 0.34, 0.88);
  }
  if (log10_t < 3.45) {
    let f = clamp((log10_t - 2.2) / 1.25, 0.0, 1.0);
    return mix(vec3<f32>(0.78, 0.30, 0.18), vec3<f32>(1.0, 0.56, 0.22), f);
  }
  if (log10_t < 4.1) {
    let f = clamp((log10_t - 3.45) / 0.65, 0.0, 1.0);
    return mix(vec3<f32>(1.0, 0.62, 0.25), vec3<f32>(1.0, 0.96, 0.82), f);
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

  if (mode == 0u) {
    // L0: Supergalactic TreePM (16 floats/particle)
    let o = iid * 16u;
    p_world = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]) * world_scale;
    let rho = clamp(raw_f32[o + 7u], 0.06, 1.0);
    let is_baryon = raw_f32[o + 12u] > 0.5;
    let col_dm = mix(vec3<f32>(0.18, 0.34, 0.92), vec3<f32>(0.34, 0.88, 1.0), rho);
    let col_node = mix(col_dm, vec3<f32>(1.0, 0.90, 0.52), smoothstep(0.46, 0.98, rho));
    col = select(col_node, mix(vec3<f32>(0.95, 0.36, 0.24), vec3<f32>(1.0, 0.84, 0.45), rho), is_baryon);
    pt_size = pt_size_base * (0.65 + 1.55 * rho);
    alpha = alpha_gain * (0.28 + 0.72 * rho);
  } else if (mode == 1u) {
    // L1: Galactic Scale-Atlas Multipole (8 floats/star: pos, mass, vel, radius)
    let o = iid * 8u;
    p_world = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]) * world_scale;
    let m = raw_f32[o + 3u];
    let vel = vec3<f32>(raw_f32[o + 4u], raw_f32[o + 5u], raw_f32[o + 6u]);
    let speed = length(vel);
    // Physically classify stellar population from live orbital speed & mass (ZERO origin distance check!)
    let hot = clamp((speed - 3.6) / 6.5, 0.0, 1.0);
    let is_smbh = m > 50.0;
    let blue_arm = vec3<f32>(0.42, 0.78, 1.0);
    let warm_disk = vec3<f32>(1.0, 0.84, 0.58);
    let amber_core = vec3<f32>(1.0, 0.62, 0.30);
    let mass_w = clamp(m * 14.0, 0.0, 1.0);
    col = mix(mix(amber_core, warm_disk, mass_w), blue_arm, hot * 0.85);
    if (is_smbh) {
      col = vec3<f32>(1.0, 0.94, 0.80);
      pt_size = pt_size_base * 0.4;
      alpha = 0.0; // SMBH rendered by relativistic accretion disk + lensing shader
    } else {
      pt_size = pt_size_base * (0.55 + 1.35 * clamp(raw_f32[o + 7u] * 14.0, 0.2, 1.6));
      alpha = alpha_gain * (0.35 + 0.65 * clamp(mass_w + 0.35 * hot, 0.0, 1.0));
    }
  } else if (mode == 2u) {
    // L3: Self-Gravitating Hydro Plasma (16 floats/parcel)
    let o = iid * 16u;
    p_world = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]) * world_scale;
    let log_t = raw_f32[o + 8u];
    let log_rho = raw_f32[o + 9u];
    let log_eps = raw_f32[o + 11u];
    let fusion_glow = smoothstep(-2.0, 4.0, log_eps);
    let dens_w = clamp((log_rho + 18.0) / 22.0, 0.15, 1.0);
    col = mix(blackbody_rgb(log_t), vec3<f32>(0.65, 0.96, 1.0), fusion_glow * 0.55);
    col = col * (0.9 + 0.85 * fusion_glow);
    pt_size = pt_size_base * (0.7 + 1.2 * dens_w);
    alpha = alpha_gain * (0.32 + 0.68 * dens_w);
  } else {
    // L6: Quantum Orbital Point Cloud (4 floats/point: vec4(x, y, z, packed_meta))
    let o = iid * 4u;
    p_world = vec3<f32>(raw_f32[o], raw_f32[o + 1u], raw_f32[o + 2u]) * world_scale;
    let packed_meta = raw_f32[o + 3u];
    let mag = clamp(abs(packed_meta), 0.15, 1.0);
    let pos_phase = packed_meta >= 0.0;
    let c_pos = cam.extra1.rgb;
    let c_neg = cam.extra2.rgb;
    col = select(c_neg, c_pos, pos_phase) * (0.65 + 0.85 * mag);
    pt_size = pt_size_base * (0.72 + 0.55 * mag);
    alpha = alpha_gain * (0.30 + 0.70 * mag);
  }

  let world_corner = p_world
    + cam.cam_right.xyz * (uv.x * pt_size)
    + cam.cam_up.xyz * (uv.y * pt_size);
  let clip = cam.view_proj * vec4<f32>(world_corner, 1.0);

  var out: VsOut;
  out.pos = clip;
  out.color = vec4<f32>(col, alpha);
  out.uv = uv;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.uv, in.uv);
  if (r2 > 1.0) { discard; }
  let core = exp(-5.2 * r2);
  let halo = exp(-1.9 * r2) * 0.35;
  let w = core + halo;
  return vec4<f32>(in.color.rgb * w * in.color.a, in.color.a * w);
}
`;

// Analytical depth-correct ray-sphere lit shader for L2 Star System, L4 Cutaway Planet Globe, & L6 Nuclei
const LIT_SPHERE_WGSL = /* wgsl */ `
${CAMERA_WGSL}

// 4 vec4s (64 bytes) per sphere instance:
//   pos_r:  vec4(x, y, z, radius)
//   color0: vec4(r, g, b, kind)   kind: 0=star, 1=rocky/ocean, 2=gas-giant, 3=ice/moon, 4=cutaway-planet, 5=atom
//   color1: vec4(r2, g2, b2, spec/atm)
//   params: vec4(r_core_norm, r_mantle_norm, cutaway_active, seed)
struct SphereInstance {
  pos_r: vec4<f32>,
  color0: vec4<f32>,
  color1: vec4<f32>,
  params: vec4<f32>,
};

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> spheres: array<SphereInstance>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) center: vec3<f32>,
  @location(1) radius: f32,
  @location(2) world_quad: vec3<f32>,
  @location(3) color0: vec4<f32>,
  @location(4) color1: vec4<f32>,
  @location(5) params: vec4<f32>,
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

  let to_cam = normalize(cam.cam_pos.xyz - center);
  let right = normalize(cross(cam.cam_up.xyz, to_cam));
  let up = cross(to_cam, right);
  let dist = length(cam.cam_pos.xyz - center);
  let inflate = radius * select(1.42, 1.18, dist > radius * 2.5);
  let world_quad = center + to_cam * (radius * 0.15) + right * (uv.x * inflate) + up * (uv.y * inflate);

  var out: VsOut;
  out.pos = cam.view_proj * vec4<f32>(world_quad, 1.0);
  out.center = center;
  out.radius = radius;
  out.world_quad = world_quad;
  out.color0 = sp.color0;
  out.color1 = sp.color1;
  out.params = sp.params;
  return out;
}

fn fbm3(p: vec3<f32>) -> f32 {
  let a = sin(p.x * 2.7 + p.y * 1.9) * cos(p.z * 2.3 - p.x * 1.4);
  let b = sin(p.y * 5.3 - p.z * 4.7) * cos(p.x * 4.9 + p.y * 3.1) * 0.5;
  let c = sin(p.z * 11.1 + p.x * 9.7) * 0.25;
  return 0.5 + 0.35 * (a + b + c);
}

fn is_cutaway_octant(p_loc: vec3<f32>, cut_active: f32) -> bool {
  return cut_active > 0.5 && p_loc.x > 0.0 && p_loc.y > 0.0 && p_loc.z > 0.0;
}

@fragment
fn fs_main(in: VsOut) -> FsOut {
  let ro = cam.cam_pos.xyz - in.center;
  let rd = normalize(in.world_quad - cam.cam_pos.xyz);
  let r = in.radius;
  let b = dot(ro, rd);
  let c = dot(ro, ro) - r * r;
  let disc = b * b - c;

  let kind = u32(round(in.color0.w));
  let light_dir = normalize(cam.extra1.xyz);
  let cut_active = in.params.z;

  if (disc < 0.0) {
    // Soft corona glow ONLY for stars (kind 0)
    if (kind == 0u) {
      let closest = max(0.0, -b);
      let d_min = length(ro + rd * closest) / max(1e-4, r);
      if (d_min < 1.38) {
        let corona = exp(-(d_min - 1.0) * 6.5) * 0.72;
        var out_c: FsOut;
        out_c.color = vec4<f32>(in.color0.rgb * corona * 1.4, corona);
        let clip_c = cam.view_proj * vec4<f32>(in.center + ro + rd * closest, 1.0);
        out_c.depth = clamp(clip_c.z / max(1e-5, clip_c.w), 0.0, 0.9999);
        return out_c;
      }
    }
    discard;
  }

  let sqrt_d = sqrt(disc);
  var t_hit = -b - sqrt_d;
  if (t_hit < 0.001) { t_hit = -b + sqrt_d; }
  if (t_hit < 0.001) { discard; }

  var p_hit = ro + rd * t_hit;
  var n_hit = normalize(p_hit);
  var is_interior = false;

  // True 3D Cutaway Plane intersection for L4 Planetary Interior Globe
  if (kind == 4u && is_cutaway_octant(p_hit, cut_active)) {
    var best_t = 1e20;
    var best_n = vec3<f32>(0.0, 1.0, 0.0);
    // Test 3 coordinate planes x=0, y=0, z=0 inside sphere radius
    if (abs(rd.x) > 1e-5) {
      let tx = -ro.x / rd.x;
      if (tx > 0.001 && tx < best_t) {
        let q = ro + rd * tx;
        if (dot(q, q) <= r * r && q.y >= 0.0 && q.z >= 0.0) {
          best_t = tx;
          best_n = vec3<f32>(select(1.0, -1.0, rd.x > 0.0), 0.0, 0.0);
        }
      }
    }
    if (abs(rd.y) > 1e-5) {
      let ty = -ro.y / rd.y;
      if (ty > 0.001 && ty < best_t) {
        let q = ro + rd * ty;
        if (dot(q, q) <= r * r && q.x >= 0.0 && q.z >= 0.0) {
          best_t = ty;
          best_n = vec3<f32>(0.0, select(1.0, -1.0, rd.y > 0.0), 0.0);
        }
      }
    }
    if (abs(rd.z) > 1e-5) {
      let tz = -ro.z / rd.z;
      if (tz > 0.001 && tz < best_t) {
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
  let ndl = max(0.0, dot(n_hit, light_dir));
  let half_v = normalize(light_dir + view_dir);
  let spec = pow(max(0.0, dot(n_hit, half_v)), 36.0);
  let fresnel = pow(1.0 - ndv, 3.2);

  var col = vec3<f32>(0.8);

  if (kind == 0u) {
    // Convective stellar photosphere with limb darkening
    let gran = fbm3(n_hit * 4.5 + vec3<f32>(in.params.w * 2.1, cam.cam_pos.w * 0.08, 0.0));
    let limb = pow(ndv, 0.45);
    col = mix(in.color1.rgb, in.color0.rgb, 0.45 + 0.55 * gran) * (0.72 + 0.65 * limb);
  } else if (is_interior) {
    // Exact GPU-solved planetary cutaway shells!
    let r_norm = length(p_hit) / max(1e-4, r);
    let r_core = clamp(in.params.x, 0.12, 0.85);
    let r_mantle = clamp(in.params.y, r_core + 0.04, 0.99);
    let r_inner = r_core * 0.48;
    var shell_col = in.color0.rgb;
    if (r_norm < r_inner) {
      // Solid crystalline Fe inner core (hot white-gold)
      shell_col = vec3<f32>(1.0, 0.92, 0.64);
    } else if (r_norm < r_core) {
      // Molten metallic Fe outer core (incandescent amber-orange)
      let f = (r_norm - r_inner) / max(0.02, r_core - r_inner);
      shell_col = mix(vec3<f32>(1.0, 0.68, 0.22), vec3<f32>(0.94, 0.36, 0.12), f);
    } else if (r_norm < r_mantle) {
      // High-pressure silicate mantle (deep crimson-ochre to olivine)
      let f = (r_norm - r_core) / max(0.02, r_mantle - r_core);
      shell_col = mix(vec3<f32>(0.76, 0.24, 0.14), vec3<f32>(0.42, 0.32, 0.24), f);
    } else {
      // Crust / Hydrosphere shell
      shell_col = in.color1.rgb;
    }
    // Crisp dark contour lines at exact GPU-solved layer transitions
    let edge_core = smoothstep(0.008, 0.018, abs(r_norm - r_core));
    let edge_mantle = smoothstep(0.008, 0.018, abs(r_norm - r_mantle));
    shell_col = shell_col * (0.55 + 0.45 * edge_core * edge_mantle);
    let shade = 0.48 + 0.52 * max(0.25, dot(n_hit, normalize(vec3<f32>(0.55, 0.7, 0.45))));
    col = shell_col * shade;
  } else if (kind == 2u) {
    // Banded Gas Giant with zonal jets
    let band = 0.5 + 0.5 * sin(n_hit.y * 19.0 + fbm3(n_hit * 5.0 + in.params.w) * 2.2);
    let base = mix(in.color0.rgb, in.color1.rgb, band);
    let atm = vec3<f32>(0.52, 0.72, 1.0) * fresnel * in.color1.w;
    col = base * (0.12 + 0.92 * ndl) + atm * (0.2 + 0.8 * ndl);
  } else if (kind == 1u || kind == 4u) {
    // Terrestrial / Ocean world with continents, water specular, & Rayleigh limb
    let cont = fbm3(n_hit * 3.4 + vec3<f32>(in.params.w * 3.7));
    let is_land = cont > 0.50;
    let base = select(in.color1.rgb, in.color0.rgb, is_land);
    let water_spec = select(spec * 0.55, spec * 0.08, is_land);
    let atm = vec3<f32>(0.36, 0.72, 1.0) * fresnel * in.color1.w;
    col = base * (0.12 + 0.92 * ndl) + vec3<f32>(1.0, 0.96, 0.9) * water_spec * ndl + atm * (0.25 + 0.75 * ndl);
  } else {
    // Ice / Metallic Atom / Molecule Nucleus / Pitch-Black Event Horizon Shadow
    let is_black_hole = dot(in.color0.rgb, in.color0.rgb) < 0.001;
    if (is_black_hole) {
      let photon_rim = pow(1.0 - ndv, 4.5);
      col = vec3<f32>(1.0, 0.88, 0.62) * photon_rim * 1.45;
    } else {
      let base = mix(in.color0.rgb, in.color1.rgb, 0.25 + 0.5 * fresnel);
      col = base * (0.22 + 0.78 * ndl) + vec3<f32>(1.0, 0.98, 0.95) * spec * 0.62 + base * fresnel * 0.28;
    }
  }

  let world_hit = in.center + p_hit;
  let clip = cam.view_proj * vec4<f32>(world_hit, 1.0);
  var out: FsOut;
  out.color = vec4<f32>(col, 1.0);
  out.depth = clamp(clip.z / max(1e-5, clip.w), 0.0, 0.9999);
  return out;
}
`;

// Zero-copy WebGPU MD Atom Sphere Shader reading `mdSession.positionsBuffer` & `velocitiesBuffer` directly!
const MD_SPHERE_WGSL = /* wgsl */ `
${CAMERA_WGSL}

@group(0) @binding(0) var<uniform> cam: CameraUniforms;
@group(0) @binding(1) var<storage, read> md_pos: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> md_vel: array<vec4<f32>>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) center: vec3<f32>,
  @location(1) radius: f32,
  @location(2) world_quad: vec3<f32>,
  @location(3) tint: vec3<f32>,
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
  let ideal_coord = max(4.0, cam.extra2.w);

  let center = (p_raw.xyz - half_box) * world_scale;
  let coord_frac = clamp(p_raw.w / ideal_coord, 0.0, 1.2);
  let speed = length(v_raw.xyz);
  let heat = clamp(speed * 2.2, 0.0, 1.0);

  // Blend Gate 1 optical reflectance (solid crystal) -> warm amber (liquid) -> electric cyan (vapor)
  let base_rgb = cam.extra1.rgb;
  let liq_rgb = mix(base_rgb, vec3<f32>(1.0, 0.52, 0.18), 0.55);
  let vap_rgb = vec3<f32>(0.38, 0.86, 1.0);
  var tint = mix(vap_rgb, liq_rgb, smoothstep(0.15, 0.55, coord_frac));
  tint = mix(tint, base_rgb, smoothstep(0.55, 0.92, coord_frac));
  tint = mix(tint, vec3<f32>(1.0, 0.85, 0.55), heat * 0.25);

  let to_cam = normalize(cam.cam_pos.xyz - center);
  let right = normalize(cross(cam.cam_up.xyz, to_cam));
  let up = cross(to_cam, right);
  let world_quad = center + to_cam * (radius * 0.15) + right * (uv.x * radius * 1.24) + up * (uv.y * radius * 1.24);

  var out: VsOut;
  out.pos = cam.view_proj * vec4<f32>(world_quad, 1.0);
  out.center = center;
  out.radius = radius;
  out.world_quad = world_quad;
  out.tint = tint;
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
  let light = normalize(vec3<f32>(0.6, 0.8, 0.5));
  let view = -rd;
  let ndl = max(0.0, dot(n, light));
  let spec = pow(max(0.0, dot(n, normalize(light + view))), 42.0);
  let rim = pow(1.0 - max(0.0, dot(n, view)), 2.8);
  let col = in.tint * (0.24 + 0.80 * ndl) + vec3<f32>(1.0, 0.98, 0.95) * spec * 0.58 + in.tint * rim * 0.25;
  let clip = cam.view_proj * vec4<f32>(in.center + p_hit, 1.0);
  var out: FsOut;
  out.color = vec4<f32>(col, 1.0);
  out.depth = clamp(clip.z / max(1e-5, clip.w), 0.0, 0.9999);
  return out;
}
`;

// Relativistic Doppler-Beamed Accretion Disk (L1 SMBH) & Planetary Rings (L2 Gas Giant)
const DISK_WGSL = /* wgsl */ `
${CAMERA_WGSL}

// 3 vec4s (48 bytes) per disk:
//   center_r_in: vec4(x, y, z, r_inner)
//   normal_r_out: vec4(nx, ny, nz, r_outer)
//   color_kind: vec4(r, g, b, kind)   kind: 0=relativistic-accretion-disk, 1=planetary-ring
struct DiskInstance {
  center_r_in: vec4<f32>,
  normal_r_out: vec4<f32>,
  color_kind: vec4<f32>,
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
  out.pos = cam.view_proj * vec4<f32>(world_pos, 1.0);
  out.local_xy = uv * r_out;
  out.r_in = d.center_r_in.w;
  out.r_out = r_out;
  out.color_kind = d.color_kind;
  out.world_pos = world_pos;
  out.center = d.center_r_in.xyz;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let r = length(in.local_xy);
  if (r > in.r_out) { discard; }
  let kind = u32(round(in.color_kind.w));

  if (kind == 0u) {
    // Relativistic Doppler-Beamed Accretion Disk outside the pitch-black Event Horizon sphere
    if (r < in.r_in) { discard; }
    let u = clamp((r - in.r_in) / max(1e-4, in.r_out - in.r_in), 0.0, 1.0);
    let ang = atan2(in.local_xy.y, in.local_xy.x);
    let shear = 0.55 + 0.45 * sin(ang * 3.0 + 14.0 / (u + 0.25) - cam.cam_pos.w * 2.4);
    // Tangent velocity vector in disk plane -> relativistic Doppler beaming
    let rel_p = in.world_pos - in.center;
    let tang = normalize(vec3<f32>(-rel_p.z, 0.0, rel_p.x) + vec3<f32>(1e-5));
    let view_dir = normalize(cam.cam_pos.xyz - in.world_pos);
    let beta = 0.42 / sqrt(max(0.2, u + 0.18));
    let doppler = clamp(1.0 + beta * dot(tang, view_dir), 0.35, 1.85);
    let beam = doppler * doppler;

    let hot_inner = vec3<f32>(0.90, 0.96, 1.0);
    let mid_gold = vec3<f32>(1.0, 0.66, 0.24);
    let cool_red = vec3<f32>(0.76, 0.18, 0.06);
    var col = mix(hot_inner, mid_gold, smoothstep(0.0, 0.35, u));
    col = mix(col, cool_red, smoothstep(0.30, 0.95, u));
    col = mix(col, vec3<f32>(0.75, 0.92, 1.0), clamp((doppler - 1.0) * 0.55, 0.0, 0.5));
    let radial_fade = (1.0 - smoothstep(0.58, 1.0, u)) * smoothstep(0.0, 0.07, u);
    let alpha = clamp(radial_fade * (0.48 + 0.52 * shear) * 0.92, 0.0, 1.0);
    return vec4<f32>(col * beam * (0.62 + 0.52 * shear) * alpha, alpha);
  } else {
    // Planetary ring system with Cassini division & subtle banding
    if (r < in.r_in) { discard; }
    let u = clamp((r - in.r_in) / max(1e-4, in.r_out - in.r_in), 0.0, 1.0);
    let cassini = 1.0 - 0.85 * exp(-pow((u - 0.58) * 28.0, 2.0));
    let ringlets = 0.72 + 0.28 * sin(u * 68.0) * cos(u * 23.0);
    let fade = smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.88, 1.0, u));
    let alpha = clamp(fade * cassini * ringlets * 0.68, 0.0, 0.85);
    return vec4<f32>(in.color_kind.rgb * (0.85 + 0.25 * ringlets) * alpha, alpha);
  }
}
`;

// Crisp 3D Line renderer for Keplerian orbits, Travel Path, & MD simulation cell
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
  out.pos = cam.view_proj * vec4<f32>(in.pos, 1.0);
  out.color = in.color;
  return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  return in.color;
}
`;

// 3D Volumetric Raymarcher for L7 Atomic Nucleus (Woods-Saxon proton core + neutron skin + TDSE halo)
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
  let box_r = max(1.0, cam.extra0.y);
  let tdse_tun = cam.extra0.z;
  let tdse_crest_r = clamp(cam.extra0.w, 0.35, 0.96);

  let fov = cam.cam_up.w;
  let aspect = cam.cam_right.w;
  let ro = cam.cam_pos.xyz / box_r;
  let rd = normalize(
    cam.cam_fwd.xyz
    + cam.cam_right.xyz * (in.ndc.x * aspect * fov)
    + cam.cam_up.xyz * (in.ndc.y * fov)
  );

  // Ray-box intersection against [-1, 1]^3
  let inv_rd = 1.0 / (rd + select(vec3<f32>(0.0), vec3<f32>(1e-6), abs(rd) < vec3<f32>(1e-6)));
  let t0 = (-1.0 - ro) * inv_rd;
  let t1 = (1.0 - ro) * inv_rd;
  let tmin_v = min(t0, t1);
  let tmax_v = max(t0, t1);
  let t_enter = max(0.0, max(tmin_v.x, max(tmin_v.y, tmin_v.z)));
  let t_exit = min(tmax_v.x, min(tmax_v.y, tmax_v.z));
  if (t_exit <= t_enter) { discard; }

  let steps = 56u;
  let dt = (t_exit - t_enter) / f32(steps);
  var accum = vec3<f32>(0.0);
  var trans = 1.0;

  for (var s = 0u; s < steps; s = s + 1u) {
    let t = t_enter + (f32(s) + 0.5) * dt;
    let p = ro + rd * t;
    let v = sample_vol(p, dim);
    let rho_p = v.x;
    let rho_n = v.y;
    let dens = v.w;
    let rr = length(p);

    // Proton core (rich fiery amber-orange) vs Neutron skin (vivid electric cyan)
    let skin = clamp((rho_n - rho_p) * 5.2 + smoothstep(0.36, 0.64, rr) * 0.65, 0.0, 1.0);
    let nuc_col = mix(vec3<f32>(1.0, 0.40, 0.10), vec3<f32>(0.14, 0.84, 1.0), skin);
    // Live GPU Visscher TDSE tunneling probability wave crest shell!
    let shell_ring = exp(-pow((rr - tdse_crest_r) * 18.0, 2.0)) * (0.28 + 0.72 * clamp(tdse_tun * 5.0, 0.0, 1.0));
    let shell_col = vec3<f32>(0.24, 1.0, 0.72);

    let sigma = (dens * 2.8 + shell_ring * 1.1) * dt;
    let emit = (nuc_col * pow(dens, 1.25) * 1.45 + shell_col * shell_ring * 1.85) * dt;
    accum = accum + trans * emit;
    trans = trans * exp(-sigma);
    if (trans < 0.015) { break; }
  }
  let alpha = clamp(1.0 - trans, 0.0, 1.0);
  if (alpha < 0.004) { discard; }
  return vec4<f32>(accum, alpha);
}
`;

// Fullscreen Post-Processing Pass: Schwarzschild Lensing + Hyperdrive Warp + Big Bang Flash + ACES + Retro CRT!
const POST_WGSL = /* wgsl */ `
struct PostUniforms {
  resolution: vec2<f32>,
  bh_uv: vec2<f32>,         // Projected screen UV [0..1] of active SMBH
  bh_strength: f32,         // Einstein radius squared strength (0 = disabled)
  warp_amount: f32,         // Hyperdrive radial streak strength [0..1]
  flash_amount: f32,        // Big Bang primordial flash [0..1]
  crt_enabled: f32,         // 1.0 = Retro CRT scanlines & vignette ON
  pixel_size: f32,          // Pixelation step [1..6] when CRT enabled
  time_sec: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> u: PostUniforms;
@group(0) @binding(1) var scene_tex: texture_2d<f32>;
@group(0) @binding(2) var scene_samp: sampler;

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

  // Optional Retro CRT pixelation quantization
  if (u.crt_enabled > 0.5 && u.pixel_size > 1.0) {
    let step_uv = vec2<f32>(u.pixel_size) / max(vec2<f32>(1.0), u.resolution);
    uv = (floor(uv / step_uv) + 0.5) * step_uv;
  }

  // Exact Schwarzschild Einstein-ring deflection around projected active SMBH UV
  var photon_glow = vec3<f32>(0.0);
  if (u.bh_strength > 1e-6) {
    let d_aspect = vec2<f32>((uv.x - u.bh_uv.x) * aspect, uv.y - u.bh_uv.y);
    let r2 = dot(d_aspect, d_aspect);
    let r = sqrt(max(1e-6, r2));
    let rs = sqrt(u.bh_strength) * 0.65;
    let outside_shadow = smoothstep(rs * 0.72, rs * 1.18, r);
    let falloff = exp(-r2 * 24.0) * outside_shadow;
    let deflect = (u.bh_strength / max(r2 + rs * rs * 0.85, 0.0006)) * falloff;
    let dir_uv = vec2<f32>(d_aspect.x / aspect, d_aspect.y) / max(r, 1e-4);
    uv = clamp(uv - dir_uv * min(0.085, deflect * 0.095), vec2<f32>(0.001), vec2<f32>(0.999));
    // Crisp golden-white Einstein photon ring just outside the shadow radius
    let ring = exp(-pow((r - rs * 1.15) / max(0.005, rs * 0.22), 2.0)) * 0.52;
    photon_glow = vec3<f32>(1.0, 0.86, 0.62) * ring;
  }

  var col = textureSample(scene_tex, scene_samp, uv).rgb + photon_glow;

  // Hyperdrive chromatic radial warp streaks (active ONLY during warp transitions)
  if (u.warp_amount > 0.005) {
    let from_c = uv - vec2<f32>(0.5, 0.5);
    var streak = vec3<f32>(0.0);
    for (var s = 1u; s <= 5u; s = s + 1u) {
      let f = f32(s) * 0.018 * u.warp_amount;
      let uv_r = clamp(uv - from_c * (f * 1.15), vec2<f32>(0.001), vec2<f32>(0.999));
      let uv_g = clamp(uv - from_c * f, vec2<f32>(0.001), vec2<f32>(0.999));
      let uv_b = clamp(uv - from_c * (f * 0.85), vec2<f32>(0.001), vec2<f32>(0.999));
      streak.r += textureSample(scene_tex, scene_samp, uv_r).r;
      streak.g += textureSample(scene_tex, scene_samp, uv_g).g;
      streak.b += textureSample(scene_tex, scene_samp, uv_b).b;
    }
    col = mix(col, (col + streak * 0.28) * (1.0 + 0.45 * u.warp_amount), clamp(u.warp_amount, 0.0, 0.85));
  }

  // Big Bang flash decay
  if (u.flash_amount > 0.002) {
    let rad = length((in.uv - vec2<f32>(0.5)) * vec2<f32>(aspect, 1.0));
    let burst = exp(-rad * rad * 1.8) * u.flash_amount;
    col = col + vec3<f32>(1.0, 0.92, 0.78) * burst * 2.2;
  }

  col = aces_tonemap(col * 1.12);

  // Optional Retro CRT scanlines, phosphor tint & subtle vignette
  if (u.crt_enabled > 0.5) {
    let scan = 0.82 + 0.18 * sin(in.uv.y * u.resolution.y * 1.65);
    let vig_d = length((in.uv - vec2<f32>(0.5)) * 1.38);
    let vig = clamp(1.0 - vig_d * vig_d * 0.45, 0.35, 1.0);
    col = col * scan * vig;
    // Gentle cool-phosphor glow tint
    col = mix(col, col * vec3<f32>(0.92, 1.04, 1.02), 0.35);
  }

  return vec4<f32>(col, 1.0);
}
`;

export function createUlgUniversesRenderer(device, canvas) {
  const ctx = canvas.getContext('webgpu');
  if (!ctx) throw new Error('WebGPU canvas context unavailable');
  const presentFormat = navigator.gpu.getPreferredCanvasFormat();

  function configureSwapchain() {
    const configs = [
      { device, format: presentFormat, alphaMode: 'opaque', usage: 0x10 | 0x01 },
      { device, format: presentFormat, alphaMode: 'opaque' },
      { device, format: presentFormat, alphaMode: 'premultiplied' }
    ];
    let lastErr = null;
    for (const cfg of configs) {
      try {
        ctx.configure(cfg);
        return;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr) throw lastErr;
  }
  configureSwapchain();

  const sceneFormat = 'rgba8unorm';
  const depthFormat = 'depth24plus';

  let width = 0;
  let height = 0;
  let sceneTex = null;
  let sceneView = null;
  let depthTex = null;
  let depthView = null;

  const camBuf = device.createBuffer({
    label: 'uv-cam-uniform',
    size: 176, // mat4 (64) + 7 * vec4 (112) = 176
    usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST
  });
  const stageCamBuf = device.createBuffer({
    label: 'uv-stage-cam-uniform',
    size: 176,
    usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST
  });
  const postUniformBuf = device.createBuffer({
    label: 'uv-post-uniform',
    size: 48,
    usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST
  });
  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

  // Dynamic reusable instance/geometry buffers
  const MAX_SPHERES = 128;
  const sphereBuf = device.createBuffer({
    label: 'uv-spheres',
    size: MAX_SPHERES * 64,
    usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST
  });
  const MAX_DISKS = 16;
  const diskBuf = device.createBuffer({
    label: 'uv-disks',
    size: MAX_DISKS * 48,
    usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST
  });
  const MAX_LINE_VERTS = 16384;
  const lineBuf = device.createBuffer({
    label: 'uv-lines',
    size: MAX_LINE_VERTS * 28, // vec3 pos (12) + vec4 col (16) = 28 bytes
    usage: GPU_BUF.VERTEX | GPU_BUF.COPY_DST
  });

  // Nuclear 3D volume storage buffer (resized on demand)
  let nuclearVolBuf = device.createBuffer({
    label: 'uv-nuclear-vol',
    size: 32 * 32 * 32 * 16,
    usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST
  });
  let nuclearVolCapacityBytes = 32 * 32 * 32 * 16;

  // Create Render Pipelines
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
    depthStencil: { format: depthFormat, depthWriteEnabled: false, depthCompare: 'less-equal' }
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
    depthStencil: { format: depthFormat, depthWriteEnabled: true, depthCompare: 'less-equal' }
  });
  const litSphereBg = device.createBindGroup({
    layout: litSpherePipe.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: camBuf } },
      { binding: 1, resource: { buffer: sphereBuf } }
    ]
  });

  const mdMod = mkMod('uv-md-sphere', MD_SPHERE_WGSL);
  const mdSpherePipe = device.createRenderPipeline({
    label: 'uv-md-sphere-pipe',
    layout: 'auto',
    vertex: { module: mdMod, entryPoint: 'vs_main' },
    fragment: { module: mdMod, entryPoint: 'fs_main', targets: [{ format: sceneFormat }] },
    primitive: { topology: 'triangle-list' },
    depthStencil: { format: depthFormat, depthWriteEnabled: true, depthCompare: 'less-equal' }
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
    depthStencil: { format: depthFormat, depthWriteEnabled: false, depthCompare: 'less-equal' }
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
    depthStencil: { format: depthFormat, depthWriteEnabled: false, depthCompare: 'less-equal' }
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
      { binding: 0, resource: { buffer: stageCamBuf } },
      { binding: 1, resource: { buffer: nuclearVolBuf } }
    ]
  });

  const postMod = mkMod('uv-post', POST_WGSL);
  const postPipe = device.createRenderPipeline({
    label: 'uv-post-pipe',
    layout: 'auto',
    vertex: { module: postMod, entryPoint: 'vs_main' },
    fragment: { module: postMod, entryPoint: 'fs_main', targets: [{ format: presentFormat }] },
    primitive: { topology: 'triangle-list' }
  });
  let postBg = null;

  // WeakMap bind-group caches for zero-churn steady-state resident buffer rendering
  const cloudBgCache = new WeakMap();
  const mdBgCache = new WeakMap();

  function getCloudBindGroup(buf) {
    let bg = cloudBgCache.get(buf);
    if (!bg) {
      bg = device.createBindGroup({
        layout: particleCloudPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: stageCamBuf } },
          { binding: 1, resource: { buffer: buf } }
        ]
      });
      cloudBgCache.set(buf, bg);
    }
    return bg;
  }

  function getMdBindGroup(posBuf, velBuf) {
    let bg = mdBgCache.get(posBuf);
    if (!bg) {
      bg = device.createBindGroup({
        layout: mdSpherePipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: stageCamBuf } },
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
    configureSwapchain();
    sceneTex?.destroy();
    depthTex?.destroy();
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
    postBg = device.createBindGroup({
      layout: postPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: postUniformBuf } },
        { binding: 1, resource: sceneView },
        { binding: 2, resource: sampler }
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
          { binding: 0, resource: { buffer: stageCamBuf } },
          { binding: 1, resource: { buffer: nuclearVolBuf } }
        ]
      });
    }
    device.queue.writeBuffer(nuclearVolBuf, 0, volumeData);
  }

  const camData = new Float32Array(44);
  const postData = new Float32Array(12);
  const sphereStaging = new Float32Array(MAX_SPHERES * 16);
  const diskStaging = new Float32Array(MAX_DISKS * 12);
  const lineStaging = new Float32Array(MAX_LINE_VERTS * 7);

  function writeCam(targetBuf, camera, extra0, extra1, extra2) {
    camData.set(camera.viewProj, 0);
    camData.set([camera.pos[0], camera.pos[1], camera.pos[2], camera.timeSec || 0], 16);
    camData.set([camera.right[0], camera.right[1], camera.right[2], camera.aspect], 20);
    camData.set([camera.up[0], camera.up[1], camera.up[2], camera.fovTanHalf], 24);
    camData.set([camera.fwd[0], camera.fwd[1], camera.fwd[2], camera.level || 0], 28);
    camData.set(extra0 || [0, 0, 0, 0], 32);
    camData.set(extra1 || [0, 0, 0, 0], 36);
    camData.set(extra2 || [0, 0, 0, 0], 40);
    device.queue.writeBuffer(targetBuf, 0, camData);
  }

  function renderFrame({
    camera,
    particleCloud = null, // { buffer, count, mode, worldScale, pointSize, alphaGain, colorPos, colorNeg }
    spheres = null,       // Array of { pos, radius, color0, kind, color1, atm, rCore, rMantle, cutaway, seed }
    lightDir = [0.6, 0.75, 0.55],
    mdCloud = null,       // { positionsBuffer, velocitiesBuffer, count, halfBox, worldScale, radius, baseRgb, idealCoord }
    disks = null,         // Array of { center, rIn, normal, rOut, color, kind }
    lines = null,         // Float32Array packed [x,y,z, r,g,b,a, ...] (7 floats per vertex)
    nuclearVol = null,    // { dim, boxRadius, tdseTunneled, tdseCrestNorm }
    post = {}             // { bhUv, bhStrength, warpAmount, flashAmount, crtEnabled, pixelSize, timeSec }
  }) {
    ensureRenderTargets(canvas.width, canvas.height);

    // Prepare instance buffers BEFORE command encoding
    let sphereCount = 0;
    if (Array.isArray(spheres) && spheres.length > 0) {
      sphereCount = Math.min(MAX_SPHERES, spheres.length);
      for (let i = 0; i < sphereCount; i += 1) {
        const s = spheres[i];
        const o = i * 16;
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
      }
      device.queue.writeBuffer(sphereBuf, 0, sphereStaging.subarray(0, sphereCount * 16));
    }

    let diskCount = 0;
    if (Array.isArray(disks) && disks.length > 0) {
      diskCount = Math.min(MAX_DISKS, disks.length);
      for (let i = 0; i < diskCount; i += 1) {
        const d = disks[i];
        const o = i * 12;
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
      }
      device.queue.writeBuffer(diskBuf, 0, diskStaging.subarray(0, diskCount * 12));
    }

    let lineVertCount = 0;
    if (lines && lines.length >= 14) {
      lineVertCount = Math.min(MAX_LINE_VERTS, Math.floor(lines.length / 7));
      const slice = lines.subarray(0, lineVertCount * 7);
      lineStaging.set(slice, 0);
      device.queue.writeBuffer(lineBuf, 0, lineStaging.subarray(0, lineVertCount * 7));
    }

    // Write ALL uniform buffers upfront -> ONE single coalesced GPUCommandEncoder & 1 queue.submit/frame!
    writeCam(
      camBuf,
      camera,
      [camera.level || 0, 0, 0, 0],
      [lightDir[0], lightDir[1], lightDir[2], 0],
      [0, 0, 0, 0]
    );
    if (particleCloud && particleCloud.buffer && particleCloud.count > 0) {
      writeCam(
        stageCamBuf,
        camera,
        [particleCloud.mode, particleCloud.worldScale, particleCloud.pointSize, particleCloud.alphaGain],
        [...(particleCloud.colorPos || [0.22, 0.86, 1.0]), 0],
        [...(particleCloud.colorNeg || [1.0, 0.68, 0.24]), 0]
      );
    } else if (mdCloud && mdCloud.positionsBuffer && mdCloud.velocitiesBuffer && mdCloud.count > 0) {
      writeCam(
        stageCamBuf,
        camera,
        [mdCloud.halfBox[0], mdCloud.halfBox[1], mdCloud.halfBox[2], mdCloud.worldScale],
        [mdCloud.baseRgb[0], mdCloud.baseRgb[1], mdCloud.baseRgb[2], mdCloud.radius],
        [0, 0, 0, mdCloud.idealCoord || 12]
      );
    } else if (nuclearVol && nuclearVol.dim > 0) {
      writeCam(
        stageCamBuf,
        camera,
        [nuclearVol.dim, nuclearVol.boxRadius || 3.4, nuclearVol.tdseTunneled || 0, nuclearVol.tdseCrestNorm || 0.72],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      );
    }

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
    postData[10] = 0;
    postData[11] = 0;
    device.queue.writeBuffer(postUniformBuf, 0, postData);

    const enc = device.createCommandEncoder({ label: 'uv-frame-fused' });
    // Render Pass 1: Backdrop + Lines + Spheres + Disks + Active Zero-Copy Stage (Cloud / MD / Nuclear Vol)
    {
      const pass = enc.beginRenderPass({
        colorAttachments: [{
          view: sceneView,
          clearValue: { r: 0.01, g: 0.015, b: 0.03, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store'
        }],
        depthStencilAttachment: {
          view: depthView,
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'store'
        }
      });
      pass.setPipeline(backdropPipe);
      pass.setBindGroup(0, backdropBg);
      pass.draw(3, 1, 0, 0);

      if (lineVertCount > 0) {
        pass.setPipeline(linePipe);
        pass.setBindGroup(0, lineBg);
        pass.setVertexBuffer(0, lineBuf, 0, lineVertCount * 28);
        pass.draw(lineVertCount, 1, 0, 0);
      }

      if (sphereCount > 0) {
        pass.setPipeline(litSpherePipe);
        pass.setBindGroup(0, litSphereBg);
        pass.draw(6, sphereCount, 0, 0);
      }

      if (diskCount > 0) {
        pass.setPipeline(diskPipe);
        pass.setBindGroup(0, diskBg);
        pass.draw(6, diskCount, 0, 0);
      }

      if (particleCloud && particleCloud.buffer && particleCloud.count > 0) {
        pass.setPipeline(particleCloudPipe);
        pass.setBindGroup(0, getCloudBindGroup(particleCloud.buffer));
        pass.draw(6, particleCloud.count, 0, 0);
      } else if (mdCloud && mdCloud.positionsBuffer && mdCloud.velocitiesBuffer && mdCloud.count > 0) {
        pass.setPipeline(mdSpherePipe);
        pass.setBindGroup(0, getMdBindGroup(mdCloud.positionsBuffer, mdCloud.velocitiesBuffer));
        pass.draw(6, mdCloud.count, 0, 0);
      } else if (nuclearVol && nuclearVol.dim > 0) {
        pass.setPipeline(volumePipe);
        pass.setBindGroup(0, volumeBg);
        pass.draw(3, 1, 0, 0);
      }
      pass.end();
    }

    // Render Pass 2: Fullscreen Post-Processing onto Swapchain (Schwarzschild Lensing + Hyperdrive + ACES + CRT)
    {
      const swapView = ctx.getCurrentTexture().createView();
      const postPass = enc.beginRenderPass({
        colorAttachments: [{
          view: swapView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store'
        }]
      });
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
    for (const b of [camBuf, stageCamBuf, postUniformBuf, sphereBuf, diskBuf, lineBuf, nuclearVolBuf]) {
      try { b.destroy(); } catch {}
    }
  }

  return Object.freeze({
    renderFrame,
    uploadNuclearVolume,
    dispose
  });
}
