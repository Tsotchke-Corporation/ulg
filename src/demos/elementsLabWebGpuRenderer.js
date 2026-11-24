// True WebGPU 3D Volumetric, Zero-Copy Instanced MD & Live Polytope-Atlas
// Fragment Renderer for `elements-lab.html` (`src/demos/elementsLabWebGpuRenderer.js`).
//
// Zero 2D-canvas CPU readback rendering and zero canned camera auto-rotation:
//   1. `renderVolume3D`: WGSL 3D volumetric raymarching directly from GPU
//      storage buffers (Nuclear Fermi rho_p/rho_n, Atomic rho(r)+|Y_lm|^2+spin
//      (rho_up - rho_down) computed strictly on WebGPU, 3D FFT Bloch charge
//      density + Fermi-surface isosurface, and 3D Molecular RHF orbitals).
//   2. `renderLiveMd`: Zero-copy instanced 3D Phong/Fresnel sphere + periodic
//      simulation-box wireframe pipeline reading `liveMdSession.positionsBuffer`
//      and `liveMdSession.velocitiesBuffer` DIRECTLY on the GPU!
//   3. `renderPolytopeAtlas`: Live WGSL `eval_polytope_atlas_2d` fragment shader
//      evaluating packed `A x <= b` half-spaces + Clenshaw Chebyshev density
//      contours directly from `currentAtlas.packedGpuAtlas.data` on WebGPU!

import { evaluatePolytopeAtlasWgsl } from '../../ulg-gpu-abi/src/materialFoundationAbi.js';

const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

// Compute shader: synthesize 3D composite nuclear Fermi density volume for multi-atom compounds on WebGPU!
const COMPOSITE_NUCLEAR_VOL_WGSL = /* wgsl */ `
struct CompNucParams {
  dim: u32,
  site_count: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<uniform> params: CompNucParams;
// site_pos_r: vec4(x_unit, y_unit, z_unit, radius_unit)
@group(0) @binding(1) var<storage, read> site_pos_r: array<vec4<f32>>;
// site_meta: vec4(Z, N, skin_ratio, weight)
@group(0) @binding(2) var<storage, read> site_meta: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> vol_out: array<vec4<f32>>;

@compute @workgroup_size(64)
fn build_composite_nuclear_volume(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dim = params.dim;
  let total = dim * dim * dim;
  let idx = gid.x;
  if (idx >= total) { return; }
  let ix = idx % dim;
  let iy = (idx / dim) % dim;
  let iz = idx / (dim * dim);
  let p = (vec3<f32>(f32(ix) + 0.5, f32(iy) + 0.5, f32(iz) + 0.5) / f32(dim)) * 2.0 - 1.0;

  var accum_col = vec3<f32>(0.0);
  var accum_d = 0.0;
  let n_sites = params.site_count;
  for (var s = 0u; s < n_sites; s = s + 1u) {
    let pr = site_pos_r[s];
    let smeta = site_meta[s];
    let d = length(p - pr.xyz);
    let r0 = max(0.08, pr.w);
    let diff_a = max(0.025, r0 * 0.24);
    let rho_p = 1.0 / (1.0 + exp((d - r0) / diff_a));
    let rho_n = 1.0 / (1.0 + exp((d - r0 * smeta.z) / diff_a));
    let n_frac = smeta.y / max(1.0, smeta.x + smeta.y);
    let core_c = mix(vec3<f32>(1.0, 0.54, 0.24), vec3<f32>(0.32, 0.78, 1.0), clamp((rho_n - rho_p) * 3.0 + n_frac * 0.35, 0.0, 1.0));
    let w = max(rho_p, rho_n) * smeta.w;
    accum_col = accum_col + core_c * w;
    accum_d = accum_d + w;
  }
  let dens = clamp(accum_d, 0.0, 1.0);
  let col = select(vec3<f32>(0.0), accum_col / max(1.0e-5, accum_d), accum_d > 1.0e-5);
  vol_out[idx] = vec4<f32>(col, dens);
}
`;

// Compute shader: live single-point GPU Polytope Atlas evaluation (identical WGSL eval_polytope_atlas_2d!)
const POLYTOPE_PROBE_COMPUTE_WGSL = /* wgsl */ `
${evaluatePolytopeAtlasWgsl}

struct ProbeParams {
  temperature_k: f32,
  pressure_pa: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> params: ProbeParams;
@group(0) @binding(1) var<storage, read> polytope_atlas: array<f32>;
@group(0) @binding(2) var<storage, read_write> probe_out: array<vec4<f32>>;

@compute @workgroup_size(64)
fn probe_polytope_point(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x != 0u) { return; }
  probe_out[0u] = eval_polytope_atlas_2d(&polytope_atlas, params.temperature_k, params.pressure_pa);
}
`;

// Compute shader: synthesize 3D Atomic Orbital + Angular |Y_lm|^2 + Spin Density (rho_up - rho_down) strictly on GPU!
const ATOMIC_VOLUME_COMPUTE_WGSL = /* wgsl */ `
struct AtomVolParams {
  dim: u32,
  n_grid: u32,
  valence_l: u32,
  unpaired_count: u32,
  r_max_bohr: f32,
  spin_fraction: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> params: AtomVolParams;
@group(0) @binding(1) var<storage, read> r_grid: array<f32>;
@group(0) @binding(2) var<storage, read> rho_grid: array<f32>;
@group(0) @binding(3) var<storage, read_write> vol_out: array<vec4<f32>>;

fn sample_radial_rho(rr: f32) -> f32 {
  let n = params.n_grid;
  if (n < 2u || rr >= r_grid[n - 1u]) { return 0.0; }
  if (rr <= r_grid[0u]) { return rho_grid[0u]; }
  var lo = 0u;
  var hi = n - 1u;
  for (var iter = 0u; iter < 10u; iter = iter + 1u) {
    let mid = (lo + hi) >> 1u;
    if (r_grid[mid] < rr) { lo = mid; } else { hi = mid; }
  }
  let r0 = r_grid[lo];
  let r1 = max(r0 + 1e-6, r_grid[hi]);
  let t = clamp((rr - r0) / (r1 - r0), 0.0, 1.0);
  return mix(rho_grid[lo], rho_grid[hi], t);
}

fn angular_ylm_sq(dir: vec3<f32>, l: u32) -> f32 {
  let ct = dir.y;
  let st2 = max(0.0, 1.0 - ct * ct);
  let c2p = select(1.0, (dir.x * dir.x - dir.z * dir.z) / max(1e-5, st2), st2 > 1e-5);
  if (l == 0u) {
    return 1.0;
  } else if (l == 1u) {
    // p_z orbital lobe |Y_10|^2 ~ 3 cos^2(theta)
    return 0.25 + 2.25 * ct * ct;
  } else if (l == 2u) {
    // d_{z^2} / d_{x^2-y^2} hybrid valence lobe |Y_20|^2 + |Y_22|^2
    let d0 = (3.0 * ct * ct - 1.0);
    let d2 = st2 * c2p;
    return 0.22 + 0.55 * (d0 * d0) + 0.95 * (d2 * d2);
  }
  // f-shell octupolar |Y_30|^2
  let f0 = ct * (5.0 * ct * ct - 3.0);
  return 0.2 + 0.45 * f0 * f0;
}

@compute @workgroup_size(64)
fn build_atomic_volume(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dim = params.dim;
  let total = dim * dim * dim;
  let idx = gid.x;
  if (idx >= total) { return; }
  let ix = idx % dim;
  let iy = (idx / dim) % dim;
  let iz = idx / (dim * dim);
  let p = (vec3<f32>(f32(ix) + 0.5, f32(iy) + 0.5, f32(iz) + 0.5) / f32(dim) * 2.0 - 1.0) * params.r_max_bohr;
  let rr = length(p);
  let dir = p / max(1e-5, rr);
  let rho = max(0.0, sample_radial_rho(rr));
  let shell_prob = pow(clamp(4.0 * 3.14159265 * rr * rr * rho * 0.28, 0.0, 4.0), 0.55);
  let ang = angular_ylm_sq(dir, params.valence_l);
  let core_w = exp(-rr * 0.85);
  let valence_w = 1.0 - core_w;
  let total_d = clamp(shell_prob * (core_w + valence_w * ang * 0.72), 0.0, 1.0);

  // Spin density (rho_up - rho_down): positive lobes (amber/gold) vs negative spin-nodal phase (cyan)
  let spin_mag = clamp(params.spin_fraction * valence_w * shell_prob * ang * 1.15, 0.0, 1.0);
  let sign_lobe = select(1.0, sign(3.0 * dir.y * dir.y - 1.0), params.valence_l >= 2u);
  let r_col = clamp(0.18 * total_d + max(0.0, sign_lobe) * spin_mag * 0.95, 0.0, 1.0);
  let g_col = clamp(0.68 * total_d + spin_mag * 0.35, 0.0, 1.0);
  let b_col = clamp(0.98 * total_d + max(0.0, -sign_lobe) * spin_mag * 0.85, 0.0, 1.0);
  vol_out[idx] = vec4<f32>(r_col, g_col, b_col, total_d);
}
`;

// Fullscreen 3D Volume Raymarching Fragment Shader (supports 4-channel RGBA volumes & 1-channel scalar Bloch density!)
const VOLUME_RAYMARCH_WGSL = /* wgsl */ `
struct VolRenderUniforms {
  resolution: vec2<f32>,
  yaw: f32,
  pitch: f32,
  dim: u32,
  channels: u32,
  mode_flags: u32, // bit 0: show Fermi isosurface contour
  pad0: u32,
  tint: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: VolRenderUniforms;
@group(0) @binding(1) var<storage, read> vol_data: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> scalar_data: array<f32>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_fullscreen(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.uv = pts[vid];
  return out;
}

fn rotate_cam(v: vec3<f32>, yaw: f32, pitch: f32) -> vec3<f32> {
  let cp = cos(pitch); let sp = sin(pitch);
  let cy = cos(yaw); let sy = sin(yaw);
  let v1 = vec3<f32>(v.x, v.y * cp - v.z * sp, v.y * sp + v.z * cp);
  return vec3<f32>(v1.x * cy + v1.z * sy, v1.y, -v1.x * sy + v1.z * cy);
}

fn fetch_voxel(i: vec3<u32>) -> vec4<f32> {
  let dim = u.dim;
  let idx = (i.z * dim + i.y) * dim + i.x;
  if (u.channels == 4u) {
    return vol_data[idx];
  }
  let s = scalar_data[idx];
  // Contrast-stretched periodic Bloch charge peaks + sharp Fermi isosurface shell (never over-exposed!)
  let mod_s = pow(clamp((s - 0.12) / 0.88, 0.0, 1.0), 2.4);
  let iso = select(0.0, exp(-pow((s - 0.52) * 18.0, 2.0)), (u.mode_flags & 1u) != 0u);
  let col = mix(u.tint.rgb * (0.25 + 0.90 * mod_s), vec3<f32>(1.0, 0.84, 0.35), iso * 0.85);
  return vec4<f32>(col, clamp(mod_s * 0.24 + iso * 0.38, 0.0, 0.65));
}

fn sample_voxel(p_unit: vec3<f32>) -> vec4<f32> {
  let d = f32(u.dim);
  let g = clamp((p_unit * 0.5 + 0.5) * d - 0.5, vec3<f32>(0.0), vec3<f32>(d - 1.001));
  let i0 = vec3<u32>(floor(g));
  let i1 = min(i0 + vec3<u32>(1u), vec3<u32>(u.dim - 1u));
  let f = fract(g);
  let c000 = fetch_voxel(vec3<u32>(i0.x, i0.y, i0.z));
  let c100 = fetch_voxel(vec3<u32>(i1.x, i0.y, i0.z));
  let c010 = fetch_voxel(vec3<u32>(i0.x, i1.y, i0.z));
  let c110 = fetch_voxel(vec3<u32>(i1.x, i1.y, i0.z));
  let c001 = fetch_voxel(vec3<u32>(i0.x, i0.y, i1.z));
  let c101 = fetch_voxel(vec3<u32>(i1.x, i0.y, i1.z));
  let c011 = fetch_voxel(vec3<u32>(i0.x, i1.y, i1.z));
  let c111 = fetch_voxel(vec3<u32>(i1.x, i1.y, i1.z));
  let c00 = mix(c000, c100, f.x);
  let c10 = mix(c010, c110, f.x);
  let c01 = mix(c001, c101, f.x);
  let c11 = mix(c011, c111, f.x);
  return mix(mix(c00, c10, f.y), mix(c01, c11, f.y), f.z);
}

@fragment
fn fs_raymarch(in: VsOut) -> @location(0) vec4<f32> {
  let aspect = u.resolution.x / max(1.0, u.resolution.y);
  let ndc = vec2<f32>(in.uv.x * aspect, in.uv.y);
  let ro = rotate_cam(vec3<f32>(0.0, 0.0, 2.85), u.yaw, u.pitch);
  let rd = normalize(rotate_cam(normalize(vec3<f32>(ndc * 0.62, -1.0)), u.yaw, u.pitch));

  // Ray-box intersection against [-1, 1]^3
  let inv_rd = 1.0 / select(rd, vec3<f32>(1e-5), abs(rd) < vec3<f32>(1e-5));
  let t0 = (-1.0 - ro) * inv_rd;
  let t1 = (1.0 - ro) * inv_rd;
  let tmin_v = min(t0, t1);
  let tmax_v = max(t0, t1);
  let t_enter = max(max(tmin_v.x, tmin_v.y), max(tmin_v.z, 0.0));
  let t_exit = min(min(tmax_v.x, tmax_v.y), tmax_v.z);

  // Clean deep-space scientific lab backdrop
  let bg = vec3<f32>(0.020, 0.035, 0.067) + 0.022 * exp(-dot(ndc, ndc) * 1.4) * u.tint.rgb;
  if (t_exit <= t_enter) {
    return vec4<f32>(bg, 1.0);
  }

  let steps = 56u;
  let dt = (t_exit - t_enter) / f32(steps);
  var accum_rgb = vec3<f32>(0.0);
  var accum_a = 0.0;
  for (var s = 0u; s < steps; s = s + 1u) {
    let t = t_enter + (f32(s) + 0.5) * dt;
    let p = ro + rd * t;
    let v = sample_voxel(p);
    let alpha = clamp(v.w * dt * 2.1, 0.0, 0.92);
    let rem = 1.0 - accum_a;
    accum_rgb = accum_rgb + rem * v.rgb * alpha * 1.55;
    accum_a = accum_a + rem * alpha;
    if (accum_a > 0.985) { break; }
  }

  // Subtle bounding-box edge highlight at enter/exit planes
  let p_in = abs(ro + rd * t_enter);
  let edge_d = max(min(abs(1.0 - p_in.x), abs(1.0 - p_in.y)), min(abs(1.0 - p_in.y), abs(1.0 - p_in.z)));
  let box_wire = smoothstep(0.022, 0.0, edge_d) * 0.16;

  let final_rgb = accum_rgb + (1.0 - accum_a) * bg + vec3<f32>(0.34, 0.76, 1.0) * box_wire;
  return vec4<f32>(clamp(final_rgb, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
`;

// Zero-Copy Instanced 3D Sphere Renderer reading `positionsBuffer` & `velocitiesBuffer` DIRECTLY on WebGPU!
const INSTANCED_ATOMS_WGSL = /* wgsl */ `
struct AtomRenderUniforms {
  resolution: vec2<f32>,
  yaw: f32,
  pitch: f32,
  box_l: vec4<f32>,      // (Lx, Ly, Lz, atomRadiusFrac)
  base_tint: vec4<f32>,  // (r, g, b, velocityColorScale)
};

@group(0) @binding(0) var<uniform> u: AtomRenderUniforms;
@group(0) @binding(1) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> velocities: array<vec4<f32>>;

struct VsOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec3<f32>,
};

fn world_to_view(p_norm: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.yaw); let sy = sin(u.yaw);
  let cp = cos(u.pitch); let sp = sin(u.pitch);
  let x1 = p_norm.x * cy - p_norm.z * sy;
  let z1 = p_norm.x * sy + p_norm.z * cy;
  let y2 = p_norm.y * cp - z1 * sp;
  let z2 = p_norm.y * sp + z1 * cp + 3.35;
  return vec3<f32>(x1, y2, z2);
}

@vertex
fn vs_atom(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let pos4 = positions[iid];
  let vel4 = velocities[iid];
  let half_box = max(vec3<f32>(0.5), u.box_l.xyz * 0.5);
  let p_norm = (pos4.xyz - half_box) / half_box;
  let view = world_to_view(p_norm);

  let aspect = u.resolution.x / max(1.0, u.resolution.y);
  let fov_scale = 1.65;
  let rad = u.box_l.w;
  let cx = (view.x * fov_scale) / max(0.35, view.z * aspect);
  let cy = (view.y * fov_scale) / max(0.35, view.z);
  let rx = (rad * fov_scale) / max(0.35, view.z * aspect);
  let ry = (rad * fov_scale) / max(0.35, view.z);
  let depth_z = clamp((view.z - 0.35) / 8.0, 0.001, 0.999);

  // Velocity-magnitude thermal kinetic energy coloring (live GPU velocitiesBuffer!)
  let speed = length(vel4.xyz);
  let heat = clamp(speed * u.base_tint.w, 0.0, 1.0);
  let cold_col = mix(vec3<f32>(0.28, 0.68, 1.0), u.base_tint.rgb, 0.45);
  let warm_col = vec3<f32>(1.0, 0.56, 0.22);
  let hot_col = vec3<f32>(1.0, 0.92, 0.55);
  let col = select(
    mix(cold_col, warm_col, heat * 2.0),
    mix(warm_col, hot_col, (heat - 0.5) * 2.0),
    heat > 0.5
  );

  var out: VsOut;
  out.clip_pos = vec4<f32>(cx + corner.x * rx, cy + corner.y * ry, depth_z, 1.0);
  out.local_uv = corner;
  out.color = col;
  return out;
}

@fragment
fn fs_atom(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let nz = sqrt(max(0.0, 1.0 - r2));
  let n = normalize(vec3<f32>(in.local_uv.x, in.local_uv.y, nz));
  let light = normalize(vec3<f32>(-0.42, 0.62, 0.66));
  let diff = max(0.14, dot(n, light));
  let half_v = normalize(light + vec3<f32>(0.0, 0.0, 1.0));
  let spec = pow(max(0.0, dot(n, half_v)), 28.0) * 0.72;
  let rim = pow(1.0 - nz, 2.5) * 0.28;
  let rgb = in.color * diff + vec3<f32>(1.0) * spec + vec3<f32>(0.38, 0.76, 1.0) * rim;
  return vec4<f32>(clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

// Periodic Simulation-Box Wireframe Lines (24 vertices = 12 edges)
@vertex
fn vs_wire(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4<f32> {
  var edges = array<vec3<f32>, 24>(
    vec3<f32>(-1,-1,-1), vec3<f32>( 1,-1,-1),
    vec3<f32>(-1, 1,-1), vec3<f32>( 1, 1,-1),
    vec3<f32>(-1,-1, 1), vec3<f32>( 1,-1, 1),
    vec3<f32>(-1, 1, 1), vec3<f32>( 1, 1, 1),
    vec3<f32>(-1,-1,-1), vec3<f32>(-1, 1,-1),
    vec3<f32>( 1,-1,-1), vec3<f32>( 1, 1,-1),
    vec3<f32>(-1,-1, 1), vec3<f32>(-1, 1, 1),
    vec3<f32>( 1,-1, 1), vec3<f32>( 1, 1, 1),
    vec3<f32>(-1,-1,-1), vec3<f32>(-1,-1, 1),
    vec3<f32>( 1,-1,-1), vec3<f32>( 1,-1, 1),
    vec3<f32>(-1, 1,-1), vec3<f32>(-1, 1, 1),
    vec3<f32>( 1, 1,-1), vec3<f32>( 1, 1, 1)
  );
  let view = world_to_view(edges[vid]);
  let aspect = u.resolution.x / max(1.0, u.resolution.y);
  let fov_scale = 1.65;
  let cx = (view.x * fov_scale) / max(0.35, view.z * aspect);
  let cy = (view.y * fov_scale) / max(0.35, view.z);
  let depth_z = clamp((view.z - 0.35) / 8.0, 0.001, 0.999);
  return vec4<f32>(cx, cy, depth_z, 1.0);
}

@fragment
fn fs_wire() -> @location(0) vec4<f32> {
  return vec4<f32>(0.34, 0.76, 1.0, 0.32);
}
`;

// Live GPU Convex Polytope Atlas Fragment Shader: evaluates `eval_polytope_atlas_2d` directly per pixel!
const POLYTOPE_ATLAS_SHADER_WGSL = /* wgsl */ `
${evaluatePolytopeAtlasWgsl}

struct PolyRenderUniforms {
  log_t_min: f32,
  log_t_max: f32,
  log_p_min: f32,
  log_p_max: f32,
  probe_fx: f32,
  probe_fy: f32,
  probe_active: f32,
  pad0: f32,
};

@group(0) @binding(0) var<uniform> u: PolyRenderUniforms;
@group(0) @binding(1) var<storage, read> polytope_atlas: array<f32>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_poly(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.uv = pts[vid] * 0.5 + 0.5;
  return out;
}

@fragment
fn fs_poly(in: VsOut) -> @location(0) vec4<f32> {
  // Subtle frame margin
  if (in.uv.x < 0.06 || in.uv.x > 0.96 || in.uv.y < 0.08 || in.uv.y > 0.90) {
    return vec4<f32>(0.024, 0.042, 0.078, 1.0);
  }
  let fx = (in.uv.x - 0.06) / 0.90;
  let fy = (in.uv.y - 0.08) / 0.82;
  let log_t = mix(u.log_t_min, u.log_t_max, fx);
  let log_p = mix(u.log_p_min, u.log_p_max, fy);
  let T = pow(10.0, log_t);
  let P = pow(10.0, log_p);

  let eval_res = eval_polytope_atlas_2d(&polytope_atlas, T, P);
  var col = vec3<f32>(0.04, 0.05, 0.08);
  if (eval_res.w < 0.5) {
    // Fail-closed outside-domain hatching
    let hatch = step(0.88, fract((in.uv.x + in.uv.y) * 28.0)) * 0.075;
    col = vec3<f32>(0.06, 0.045, 0.075) + vec3<f32>(hatch, hatch * 0.45, hatch * 0.55);
  } else {
    let rho = max(1e-6, eval_res.x);
    let margin = eval_res.y;
    let pcode = u32(max(0.0, floor(eval_res.z + 0.5)));
    var base_col = vec3<f32>(0.34, 0.76, 1.0); // solid
    if (pcode == 1u) { base_col = vec3<f32>(0.20, 0.83, 0.60); } // liquid
    else if (pcode == 2u) { base_col = vec3<f32>(0.98, 0.57, 0.24); } // gas
    else if (pcode >= 3u) { base_col = vec3<f32>(0.75, 0.52, 0.99); } // plasma

    // Density contour lines in log10(rho) + crisp slanted coexistence facet edge highlight
    let log_rho = log2(rho) * 0.3010299956639812;
    let iso_shade = 0.58 + 0.32 * clamp((log_rho + 2.0) / 6.5, 0.0, 1.0);
    let contour = smoothstep(0.06, 0.0, abs(fract(log_rho * 1.5) - 0.5)) * 0.22;
    let facet_edge = smoothstep(0.018, 0.0, margin) * 0.65;
    col = base_col * iso_shade + vec3<f32>(contour) + vec3<f32>(0.95, 0.98, 1.0) * facet_edge;
  }

  // Interactive GPU (T, log10 P) probe crosshair & glowing reticle
  if (u.probe_active > 0.5) {
    let dx = abs(fx - u.probe_fx);
    let dy = abs(fy - u.probe_fy);
    let d_pt = sqrt(dx * dx + dy * dy);
    let line_x = smoothstep(0.0038, 0.0, dx) * 0.34;
    let line_y = smoothstep(0.0042, 0.0, dy) * 0.34;
    let ring = smoothstep(0.006, 0.0, abs(d_pt - 0.022)) * 0.95;
    let dot_c = smoothstep(0.007, 0.0, d_pt) * 0.95;
    col = mix(col, vec3<f32>(1.0, 0.95, 0.62), clamp(line_x + line_y + ring + dot_c, 0.0, 1.0));
  }
  return vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
`;

// MoonLab-Grade High-Density (50K..500K) 3D Quantum Orbital Point-Cloud Renderer
// Reads resident GPU `pointsBuffer` from `orbitalPointCloudWebGpu.js` ZERO-COPY!
const ORBITAL_CLOUD_RENDER_WGSL = /* wgsl */ `
struct OrbitalCloudUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  cam_style: vec4<f32>,     // (cam_dist, point_size, opacity, alt_shell_colors)
  color_a: vec4<f32>,       // (r, g, b, show_guides)
  color_b: vec4<f32>,       // (r, g, b, nuc_radius)
};

@group(0) @binding(0) var<uniform> u: OrbitalCloudUniforms;
@group(0) @binding(1) var<storage, read> points: array<vec4<f32>>;

struct VsOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

fn project_pt(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.cam_style.x;
  return vec3<f32>(x1, y2, z2);
}

@vertex
fn vs_cloud(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let pt = points[iid];
  let view = project_pt(pt.xyz);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.95;
  let inv_z = 1.0 / max(0.25, view.z);
  let cx = view.x * fov * inv_z / aspect;
  let cy = view.y * fov * inv_z;

  // Ultra-crisp MoonLab dusty sprite radius & delicate per-point alpha (zero solid-white core blowout!)
  let min_px = 0.95 / max(1.0, u.res_yaw_pitch.y);
  let world_r = max(min_px * 1.15, u.cam_style.y * 0.65 * fov * inv_z);
  let rx = world_r / aspect;
  let ry = world_r;

  let shade = abs(pt.w);
  let is_a = pt.w >= 0.0;
  let base_rgb = select(
    u.color_a.rgb,
    select(u.color_b.rgb, u.color_a.rgb, is_a),
    u.cam_style.w > 0.5
  );

  var out: VsOut;
  out.clip_pos = vec4<f32>(cx + corner.x * rx, cy + corner.y * ry, 0.5, 1.0);
  out.local_uv = corner;
  out.color = vec4<f32>(base_rgb * shade, u.cam_style.z * 0.22);
  return out;
}

@fragment
fn fs_cloud(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let soft = exp(-r2 * 3.2) * (1.0 - r2);
  let a = in.color.a * soft;
  return vec4<f32>(in.color.rgb * a, a);
}

// Nucleus core billboard at (0, 0, 0)
@vertex
fn vs_nucleus(@builtin(vertex_index) vid: u32) -> VsOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let view = project_pt(vec3<f32>(0.0));
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.95;
  let inv_z = 1.0 / max(0.25, view.z);
  let rad = max(0.012, u.color_b.w * fov * inv_z);
  var out: VsOut;
  out.clip_pos = vec4<f32>(
    view.x * fov * inv_z / aspect + corner.x * rad / aspect,
    view.y * fov * inv_z + corner.y * rad,
    0.4, 1.0
  );
  out.local_uv = corner;
  out.color = vec4<f32>(0.95, 0.96, 1.0, 0.9);
  return out;
}

@fragment
fn fs_nucleus(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let core = exp(-r2 * 4.5);
  return vec4<f32>(in.color.rgb * core, core * 0.92);
}

// Cartesian floor grid + XYZ axes (matches MoonLab "Show cartesian grid + axes"!)
struct GuideOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) col: vec4<f32>,
};

@vertex
fn vs_guides(@builtin(vertex_index) vid: u32) -> GuideOut {
  // 22 grid lines (11 along X, 11 along Z -> 44 verts) + 3 RGB axes (6 verts) = 50 verts
  var p = vec3<f32>(0.0);
  var col = vec4<f32>(0.24, 0.28, 0.36, 0.45);
  if (vid < 22u) {
    let line_i = vid / 2u;
    let end_i = vid % 2u;
    let z_pos = -1.0 + (f32(line_i) / 10.0) * 2.0;
    let x_pos = select(-1.0, 1.0, end_i == 1u);
    p = vec3<f32>(x_pos, -1.0, z_pos);
  } else if (vid < 44u) {
    let k = vid - 22u;
    let line_i = k / 2u;
    let end_i = k % 2u;
    let x_pos = -1.0 + (f32(line_i) / 10.0) * 2.0;
    let z_pos = select(-1.0, 1.0, end_i == 1u);
    p = vec3<f32>(x_pos, -1.0, z_pos);
  } else {
    let a = vid - 44u;
    if (a == 0u) { p = vec3<f32>(0.0, -1.0, 0.0); col = vec4<f32>(0.95, 0.35, 0.35, 0.85); }
    else if (a == 1u) { p = vec3<f32>(1.15, -1.0, 0.0); col = vec4<f32>(0.95, 0.35, 0.35, 0.85); }
    else if (a == 2u) { p = vec3<f32>(0.0, -1.0, 0.0); col = vec4<f32>(0.35, 0.92, 0.48, 0.85); }
    else if (a == 3u) { p = vec3<f32>(0.0, 0.15, 0.0); col = vec4<f32>(0.35, 0.92, 0.48, 0.85); }
    else if (a == 4u) { p = vec3<f32>(0.0, -1.0, 0.0); col = vec4<f32>(0.38, 0.65, 1.0, 0.85); }
    else { p = vec3<f32>(0.0, -1.0, 1.15); col = vec4<f32>(0.38, 0.65, 1.0, 0.85); }
  }
  let view = project_pt(p);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.95;
  let inv_z = 1.0 / max(0.25, view.z);
  var out: GuideOut;
  out.clip_pos = vec4<f32>(view.x * fov * inv_z / aspect, view.y * fov * inv_z, 0.5, 1.0);
  out.col = col;
  return out;
}

@fragment
fn fs_guides(in: GuideOut) -> @location(0) vec4<f32> {
  return in.col;
}
`;

// Real-Time 3D WebGPU 2D-Maxwell Wave-Field + Driven MoonLab-Grade 3D Atomic Electron-Shell Renderer
// Reads live 128x128x4 2D Maxwell-ADE-FDTD storage buffers (`ez_field`, `shell_state`)
// AND the active element/compound GPU Dirac-KS orbital point cloud (`shell_pts`) ZERO-COPY!
const PHOTON_SHELL_SCENE_WGSL = /* wgsl */ `
struct PhotonSceneUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  grid_meta: vec4<f32>,     // (nx, ny, slab_x0, slab_x1)
  wave_meta: vec4<f32>,     // (mode_mono, is_metal, shell_pts_per_atom, cam_dist)
  slab_tint: vec4<f32>,     // (srgb.r, srgb.g, srgb.b, shell_opacity)
  probe_rgb: vec4<f32>,     // (probe.r, probe.g, probe.b, wave_gain)
};

@group(0) @binding(0) var<uniform> u: PhotonSceneUniforms;
@group(0) @binding(1) var<storage, read> ez_field: array<f32>;
@group(0) @binding(2) var<storage, read> shell_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> shell_pts: array<vec4<f32>>;

struct WavePlaneOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

fn project_ps(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.wave_meta.w;
  return vec3<f32>(x1, y2, z2);
}

fn world_to_clip(p: vec3<f32>) -> vec4<f32> {
  let view = project_ps(p);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.85;
  let z_safe = max(0.3, view.z);
  // True perspective-correct clip coordinates (w = z_safe) so quad UV interpolation has ZERO diagonal kink!
  return vec4<f32>(view.x * fov / aspect, view.y * fov, 0.5 * z_safe, z_safe);
}

// 1. High-resolution 2D Maxwell Wave-Field Plane (bilinearly sampled 128x128x4 GPU EM field!)
//    Renders real incident white photon packet, real reflected Gold/Silver packet, real Snell
//    refraction & wavelength compression inside dielectrics, and real local shell absorption glow!
@vertex
fn vs_wave_plane(@builtin(vertex_index) vid: u32) -> WavePlaneOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 1.0)
  );
  let uv = quad[vid];
  // Map 2D optical cavity [0,1]^2 onto tilted 3D world plane [-1.45, +1.45] x [-1.45, +1.45]
  let wx = (uv.x * 2.0 - 1.0) * 1.45;
  let wz = (uv.y * 2.0 - 1.0) * 1.45;
  var out: WavePlaneOut;
  out.clip_pos = world_to_clip(vec3<f32>(wx, 0.0, wz));
  out.uv = uv;
  return out;
}

fn bilerp_ez(ch: u32, gx: f32, gy: f32) -> f32 {
  let nx = u32(u.grid_meta.x);
  let ny = u32(u.grid_meta.y);
  let base = ch * nx * ny;
  let x0 = u32(clamp(floor(gx), 0.0, f32(nx - 2u)));
  let y0 = u32(clamp(floor(gy), 0.0, f32(ny - 2u)));
  let fx = fract(clamp(gx, 0.0, f32(nx - 2u)));
  let fy = fract(clamp(gy, 0.0, f32(ny - 2u)));
  let v00 = ez_field[base + y0 * nx + x0];
  let v10 = ez_field[base + y0 * nx + (x0 + 1u)];
  let v01 = ez_field[base + (y0 + 1u) * nx + x0];
  let v11 = ez_field[base + (y0 + 1u) * nx + (x0 + 1u)];
  return mix(mix(v00, v10, fx), mix(v01, v11, fx), fy);
}

fn bilerp_shell(ch: u32, gx: f32, gy: f32) -> vec4<f32> {
  let nx = u32(u.grid_meta.x);
  let ny = u32(u.grid_meta.y);
  let base = ch * nx * ny;
  let x0 = u32(clamp(floor(gx), 0.0, f32(nx - 2u)));
  let y0 = u32(clamp(floor(gy), 0.0, f32(ny - 2u)));
  let fx = fract(clamp(gx, 0.0, f32(nx - 2u)));
  let fy = fract(clamp(gy, 0.0, f32(ny - 2u)));
  let v00 = shell_state[base + y0 * nx + x0];
  let v10 = shell_state[base + y0 * nx + (x0 + 1u)];
  let v01 = shell_state[base + (y0 + 1u) * nx + x0];
  let v11 = shell_state[base + (y0 + 1u) * nx + (x0 + 1u)];
  return mix(mix(v00, v10, fx), mix(v01, v11, fx), fy);
}

@fragment
fn fs_wave_plane(in: WavePlaneOut) -> @location(0) vec4<f32> {
  let nx = u.grid_meta.x;
  let ny = u.grid_meta.y;
  let gx = in.uv.x * (nx - 1.0);
  let gy = in.uv.y * (ny - 1.0);

  let in_slab = gx >= u.grid_meta.z && gx <= u.grid_meta.w && gy >= 12.0 && gy <= ny - 13.0;
  // Crisp micro-cavity spatial ruler grid (every 8 cells = 160 nm) so wavelength compression is obvious!
  let grid_x = smoothstep(0.06, 0.0, abs(fract(gx / 8.0) - 0.5));
  let grid_y = smoothstep(0.06, 0.0, abs(fract(gy / 8.0) - 0.5));
  let grid_line = max(grid_x, grid_y) * 0.055;

  var bg = vec3<f32>(0.012, 0.019, 0.036) + vec3<f32>(0.24, 0.38, 0.58) * grid_line;
  if (in_slab) {
    bg = bg + u.slab_tint.rgb * select(0.08, 0.13, u.wave_meta.y > 0.5);
  }
  // Sharp Fresnel optical interface highlight at x = slab_x0 and x = slab_x1
  let face0 = exp(-pow((gx - u.grid_meta.z) * 1.1, 2.0)) * select(0.0, 0.55, gy >= 12.0 && gy <= ny - 13.0);
  let face1 = exp(-pow((gx - u.grid_meta.w) * 1.1, 2.0)) * select(0.0, 0.32, gy >= 12.0 && gy <= ny - 13.0);
  bg = bg + (u.slab_tint.rgb * 0.65 + vec3<f32>(0.35)) * (face0 + face1);

  let gain = u.probe_rgb.w;
  var wave_rgb = vec3<f32>(0.0);
  var shell_glow = vec3<f32>(0.0);

  if (u.wave_meta.x > 0.5) {
    // Single-lambda coherent wave visualization: positive crests bright spectral color, troughs deep complementary!
    let ez = bilerp_ez(3u, gx, gy) * gain;
    let ss = bilerp_shell(3u, gx, gy);
    let pos_w = max(0.0, ez);
    let neg_w = max(0.0, -ez);
    let crest_col = u.probe_rgb.rgb;
    let trough_col = mix(u.probe_rgb.rgb * 0.45, vec3<f32>(0.18, 0.42, 0.85), 0.45);
    wave_rgb = crest_col * pow(min(1.8, pos_w * 2.4), 0.85) + trough_col * pow(min(1.6, neg_w * 2.1), 0.9);
    let abs_e = clamp(abs(ss.z) * 28.0 + abs(ss.x) * 0.6, 0.0, 1.0);
    shell_glow = vec3<f32>(0.85, 0.55, 1.0) * abs_e * 0.55;
  } else {
    // Real RGB 3-Channel White Light Maxwell Wavepacket:
    //   Incident beam: E_R ≈ E_G ≈ E_B -> PURE LUMINOUS WHITE WAVEFRONTS!
    //   Reflected off Relativistic Gold: Blue absorbed by 5d shells -> RADIANT GOLDEN REFLECTED WAVEFRONTS!
    //   Reflected off Non-Relativistic Gold / Silver: E_R ≈ E_G ≈ E_B -> MIRROR SILVER-WHITE WAVEFRONTS!
    //   Refracted inside Dielectric (H2O, Diamond, NaCl): Snell-bent compressed wavefronts!
    let er = bilerp_ez(0u, gx, gy) * gain;
    let eg = bilerp_ez(1u, gx, gy) * gain;
    let eb = bilerp_ez(2u, gx, gy) * gain;

    // Show crisp wave crests (phase-preserving brightness so individual wavefronts are razor sharp!)
    let ar = abs(er);
    let ag = abs(eg);
    let ab = abs(eb);
    let amp_rgb = vec3<f32>(ar, ag, ab);
    let peak = max(ar, max(ag, ab));
    // Soft tone-mapped luminous optical intensity keeping true RGB ratios intact!
    let tone = pow(clamp(peak * 2.5, 0.0, 3.0), 0.82) / max(1e-4, peak);
    let phase_boost = 0.72 + 0.38 * smoothstep(-0.15, 0.25, (er + eg + eb) * 0.33);
    wave_rgb = amp_rgb * tone * 0.52 * phase_boost;

    // Real local shell dipole excitation / blue-absorption glow inside slab
    if (in_slab) {
      let s0 = bilerp_shell(0u, gx, gy);
      let s1 = bilerp_shell(1u, gx, gy);
      let s2 = bilerp_shell(2u, gx, gy);
      let b_abs = clamp(abs(s2.z) * 34.0, 0.0, 1.0);
      let tot_p = clamp((abs(s0.x) + abs(s1.x) + abs(s2.x)) * 0.45, 0.0, 1.0);
      shell_glow = vec3<f32>(0.65, 0.32, 1.0) * b_abs * 0.65 + u.slab_tint.rgb * tot_p * 0.32;
    }
  }

  let col = bg + wave_rgb + shell_glow;
  return vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

// 2. MoonLab-Grade 3D Atomic Electron-Shell Point Clouds Embedded Inside the Optical Slab!
//    Every electron sample reads the live 2D Maxwell field shell_state(x, y) directly on GPU,
//    physically oscillating vertically along E_z proportional to bound polarization P(x,y,t) & J_D(x,y,t)
//    and glowing brightly where photons resonantly excite the electron shells!
struct ShellDotOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@vertex
fn vs_driven_shells(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> ShellDotOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let pts_per_atom = max(1u, u32(u.wave_meta.z));
  let site_idx = iid / pts_per_atom;
  let pt_idx = iid % pts_per_atom;
  let raw_pt = shell_pts[pt_idx];

  // Tile 4 (X) x 5 (Z) = 20 real 3D Dirac-KS atomic electron-shell clouds cleanly across the slab!
  let sx = site_idx % 4u;
  let sz = (site_idx / 4u) % 5u;
  let nx = u.grid_meta.x;
  let ny = u.grid_meta.y;
  let gx_site = mix(u.grid_meta.z + 5.0, u.grid_meta.w - 5.0, (f32(sx) + 0.5) / 4.0);
  let gy_site = mix(22.0, ny - 23.0, (f32(sz) + 0.5) / 5.0);

  let cx_w = ((gx_site / (nx - 1.0)) * 2.0 - 1.0) * 1.45;
  let cz_w = ((gy_site / (ny - 1.0)) * 2.0 - 1.0) * 1.45;
  let atom_rad = 0.145;
  var wpos = vec3<f32>(cx_w, 0.08, cz_w) + raw_pt.xyz * atom_rad;

  // Read live 2D Maxwell polarization & shell absorption at this atom's exact (gx, gy) cell!
  let cell_x = u32(clamp(gx_site, 1.0, nx - 2.0));
  let cell_y = u32(clamp(gy_site, 1.0, ny - 2.0));
  let nx_u = u32(nx);
  let ny_u = u32(ny);
  let cell_off = cell_y * nx_u + cell_x;

  var pol_disp = 0.0;
  var abs_excite = 0.0;
  var blue_abs = 0.0;
  if (u.wave_meta.x > 0.5) {
    let sp = shell_state[3u * nx_u * ny_u + cell_off];
    pol_disp = sp.x * 0.45 + sp.y * 2.4;
    abs_excite = clamp(abs(sp.z) * 28.0 + abs(sp.x) * 0.85, 0.0, 1.0);
  } else {
    let s0 = shell_state[0u * nx_u * ny_u + cell_off];
    let s1 = shell_state[1u * nx_u * ny_u + cell_off];
    let s2 = shell_state[2u * nx_u * ny_u + cell_off];
    pol_disp = 0.22 * (s0.x + s1.x + s2.x) + 1.4 * (s0.y + s1.y + s2.y);
    abs_excite = clamp((abs(s0.z) + abs(s1.z) + abs(s2.z)) * 22.0 + abs(pol_disp) * 0.55, 0.0, 1.0);
    blue_abs = clamp(abs(s2.z) * 38.0, 0.0, 1.0);
  }

  // Real physical electron-cloud dipole oscillation driven by live GPU Maxwell field E_z!
  wpos.y = wpos.y + clamp(pol_disp * 0.16, -0.24, 0.24);

  let view = project_ps(wpos);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.85;
  let inv_z = 1.0 / max(0.3, view.z);
  let rad = max(1.5 / max(1.0, u.res_yaw_pitch.y), 0.0095 * fov * inv_z);

  let is_a = raw_pt.w >= 0.0;
  let shade = abs(raw_pt.w);
  let base_shell = select(
    mix(vec3<f32>(0.42, 0.22, 0.92), u.slab_tint.rgb, 0.35),
    mix(vec3<f32>(0.92, 0.95, 1.0), u.slab_tint.rgb, 0.50),
    is_a
  );
  let excite_col = mix(vec3<f32>(1.0, 0.85, 0.36), vec3<f32>(0.72, 0.40, 1.0), blue_abs);
  let final_rgb = mix(base_shell, excite_col, abs_excite * 0.82) * shade * (0.85 + 1.15 * abs_excite);

  var out: ShellDotOut;
  out.clip_pos = vec4<f32>(
    view.x * fov * inv_z / aspect + corner.x * rad / aspect,
    view.y * fov * inv_z + corner.y * rad,
    0.45, 1.0
  );
  out.local_uv = corner;
  out.color = vec4<f32>(final_rgb, clamp(u.slab_tint.w * 0.32 + abs_excite * 0.20, 0.04, 0.36));
  return out;
}

@fragment
fn fs_shell_dot(in: ShellDotOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let soft = exp(-r2 * 3.0) * (1.0 - r2);
  let a = in.color.a * soft;
  return vec4<f32>(in.color.rgb * a, a);
}
`;

// Single-Atom Time-Dependent Kohn-Sham (TD-KS) Electron Cloud <-> Photon Wavepacket
// Renderer: renders BOTH the live 180K-point MoonLab-grade evolving quantum superposition
//   |psi(r,t)|^2 = rho_00 |phi_0|^2 + rho_11 |phi_1|^2 + 2 Re(rho_01) phi_0 phi_1
// AND the volumetric incident photon wavefront + retarded spherical Hertzian dipole
// re-radiation rings E_rad(r,t) ~ sin(theta) d''(t - r/c) / r!
const TDKS_PHOTON_CLOUD_WGSL = /* wgsl */ `
struct TdksUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  cam_time: vec4<f32>,      // (cam_dist, time_fs, pulse_t0, pulse_width)
  bloch_state: vec4<f32>,   // (rho00, rho11, 2*Re[rho01], e_now)
  wave_rgb: vec4<f32>,      // (omega_rad_fs, mode_mono, hist_cursor, hist_len)
  refl_srgb: vec4<f32>,     // (emergent_r, emergent_g, emergent_b, blue_rho11)
  probe_rgb: vec4<f32>,     // (probe_r, probe_g, probe_b, point_size)
};

@group(0) @binding(0) var<uniform> u: TdksUniforms;
@group(0) @binding(1) var<storage, read> pair_pos: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> pair_amp: array<vec4<f32>>;
// rad_hist: 4 channels * 128 retarded dipole acceleration samples (channel 0=R, 1=G, 2=B, 3=Probe)
@group(0) @binding(3) var<storage, read> rad_hist: array<f32>;

struct TdksFieldOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) world_xy: vec2<f32>,
};

fn project_tdks(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.cam_time.x;
  return vec3<f32>(x1, y2, z2);
}

fn sample_retarded_dipole(ch: u32, r_world: f32) -> f32 {
  let hlen = u32(max(8.0, u.wave_rgb.w));
  let cur = u32(u.wave_rgb.z);
  // Propagation delay in ring-buffer steps (~24 steps per unit world radius -> clear visible spherical wave rings!)
  let lag = r_world * 24.0;
  let lag0 = u32(floor(lag));
  if (lag0 + 1u >= hlen) { return 0.0; }
  let f = fract(lag);
  let idx0 = (cur + hlen - (lag0 % hlen)) % hlen;
  let idx1 = (cur + hlen - ((lag0 + 1u) % hlen)) % hlen;
  let base = ch * hlen;
  return mix(rad_hist[base + idx0], rad_hist[base + idx1], f);
}

// 1. Volumetric 3D Electromagnetic Wavepacket + Retarded Concentric Dipole Radiation Plane (z = 0 cutting through atom!)
@vertex
fn vs_tdks_field(@builtin(vertex_index) vid: u32) -> TdksFieldOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let q = quad[vid];
  let wxy = vec2<f32>(q.x * 2.15, q.y * 1.45);
  let view = project_tdks(vec3<f32>(wxy.x, wxy.y, 0.0));
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.92;
  let z_safe = max(0.3, view.z);
  var out: TdksFieldOut;
  out.clip_pos = vec4<f32>(view.x * fov / aspect, view.y * fov, 0.55 * z_safe, z_safe);
  out.world_xy = wxy;
  return out;
}

@fragment
fn fs_tdks_field(in: TdksFieldOut) -> @location(0) vec4<f32> {
  let x = in.world_xy.x;
  let y = in.world_xy.y;
  let r = length(in.world_xy);
  let beam_env_y = exp(-0.5 * (y / 0.72) * (y / 0.72));
  let c_vis = 0.56; // visual speed of light (world units / fs)
  let t_ret_inc = u.cam_time.y - x / c_vis;
  let dt_inc = t_ret_inc - u.cam_time.z;
  let env_inc = exp(-0.5 * (dt_inc / u.cam_time.w) * (dt_inc / u.cam_time.w)) * beam_env_y;

  // Angular radiation pattern of a Y-polarized oscillating quantum dipole d_y(t): sin(theta_y) = |x| / r
  let sin_dip = clamp(abs(x) / max(0.08, r), 0.12, 1.0);
  let r_falloff = smoothstep(0.14, 0.34, r) / (0.55 + r * 1.05);

  var col = vec3<f32>(0.006, 0.009, 0.018);

  // Subtle polar optical reference rings around the atom
  let ring_d = smoothstep(0.012, 0.0, abs(fract(r * 1.5) - 0.5)) * 0.045 * smoothstep(2.1, 0.2, r);
  col = col + vec3<f32>(0.25, 0.40, 0.65) * ring_d;

  if (u.wave_rgb.y > 0.5) {
    // Single-lambda coherent wavepacket + exact retarded Hertzian dipole re-radiation rings!
    let e_inc = env_inc * cos(u.wave_rgb.x * dt_inc);
    let e_rad = sample_retarded_dipole(3u, r) * sin_dip * r_falloff * 1.65;
    // Left of atom (x < 0): incident + backscattered; Right of atom (x > 0): phase-shifted transmitted superposition!
    let e_tot = e_inc + e_rad;
    let inc_glow = abs(e_inc) * 0.42;
    let rad_glow = abs(e_rad) * 0.85;
    let crest = max(0.0, e_tot);
    let trough = max(0.0, -e_tot);
    let c_pos = u.probe_rgb.rgb;
    let c_neg = mix(u.probe_rgb.rgb * 0.35, vec3<f32>(0.18, 0.38, 0.85), 0.5);
    col = col + c_pos * crest * 0.52 + c_neg * trough * 0.36 + u.probe_rgb.rgb * (rad_glow * 0.55 + inc_glow * 0.15);
  } else {
    // RGB White-Light Photon Wavepacket colliding with the Quantum Electron Cloud!
    //   Incident packet (x < 0): pure luminous WHITE wavefronts (R = G = B)!
    //   Retarded spherical dipole re-radiation rings: colored in the EXACT live emergent
    //   scattered spectrum (GOLD on Relativistic Gold because Blue is absorbed into 6p; SILVER when Relativistic OFF!)
    let om_r = 3.09; // 610nm rad/fs
    let om_g = 3.52; // 535nm rad/fs
    let om_b = 4.28; // 440nm rad/fs
    let inc_r = env_inc * cos(om_r * dt_inc);
    let inc_g = env_inc * cos(om_g * dt_inc);
    let inc_b = env_inc * cos(om_b * dt_inc);

    let rad_r = sample_retarded_dipole(0u, r) * sin_dip * r_falloff * 1.55;
    let rad_g = sample_retarded_dipole(1u, r) * sin_dip * r_falloff * 1.55;
    let rad_b = sample_retarded_dipole(2u, r) * sin_dip * r_falloff * 1.55;

    // Weight re-radiated RGB rings by the real emergent FDTD reflectance spectrum so Gold radiates GOLD rings & Silver radiates SILVER!
    let refl = max(u.refl_srgb.rgb, vec3<f32>(0.18));
    let sc_rgb = vec3<f32>(abs(rad_r) * refl.r, abs(rad_g) * refl.g, abs(rad_b) * refl.b);
    // Incident wavefront attenuates smoothly past the atom according to real absorption while dipole wave radiates outward!
    let trans_att = select(1.0, 0.45 + 0.55 * (1.0 - u.refl_srgb.w), x > 0.0);
    let inc_rgb = vec3<f32>(abs(inc_r), abs(inc_g), abs(inc_b) * trans_att) * 0.34;

    col = col + inc_rgb + sc_rgb * 0.78;
    // Highlight concentric dipole re-radiation crests subtly
    let dip_wave = abs(rad_r + rad_g + rad_b) * 0.33;
    col = col + refl * smoothstep(0.18, 0.75, dip_wave) * 0.35;
  }

  // Smooth edge vignette so field blends cleanly into deep MoonLab void
  let vig = smoothstep(2.2, 1.35, abs(x)) * smoothstep(1.48, 0.95, abs(y));
  return vec4<f32>(clamp(col * vig, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

// 2. Live 180K-Point MoonLab-Grade Evolving Quantum Electron Cloud |psi(r,t)|^2!
//    Evaluates exact quantum superposition probability weight:
//      w_i(t) = rho_00 |phi_0|^2 + rho_11 |phi_1|^2 + 2 Re(rho_01) phi_0 phi_1
//    NO fake rigid shift — the actual 3D quantum cloud sloshes through opposite-parity
//    interference AND blooms into the excited orbital |phi_1|^2 as photons are absorbed!
struct TdksPtOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@vertex
fn vs_tdks_cloud(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> TdksPtOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let pos4 = pair_pos[iid];
  let amp4 = pair_amp[iid];

  let rho00 = u.bloch_state.x;
  let rho11 = u.bloch_state.y;
  let two_re01 = u.bloch_state.z;

  let p0_sq = amp4.x * amp4.x;
  let p1_sq = amp4.y * amp4.y;
  let cross = two_re01 * amp4.x * amp4.y;
  let prob_w = max(0.0, rho00 * p0_sq + rho11 * p1_sq + cross);

  // Subtle physical Stark polarizability breathing (secondary to quantum interference!)
  let p_world = pos4.xyz * 0.92 + vec3<f32>(0.0, u.bloch_state.w * 0.045 * (0.4 + pos4.w), 0.0);
  let view = project_tdks(p_world);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.92;
  let inv_z = 1.0 / max(0.3, view.z);

  let min_px = 0.95 / max(1.0, u.res_yaw_pitch.y);
  let world_r = max(min_px * 1.15, u.probe_rgb.w * 0.62 * fov * inv_z);

  // Color decomposition strictly by quantum-mechanical contribution at this 3D point:
  //   Ground shell (phi_0^2): MoonLab crisp white / royal violet (#FFFFFF / #612BDE)
  //   Dipole interference (+cross / -cross): electric cyan / warm amber polarization shift
  //   Excited shell population (rho_11 * phi_1^2): radiant resonant gold-magenta bloom!
  let base_gnd = select(vec3<f32>(0.42, 0.22, 0.94), vec3<f32>(0.96, 0.97, 1.0), amp4.w >= 0.0);
  let exc_col = vec3<f32>(1.0, 0.78, 0.24); // Radiant resonant excitation gold
  let dip_col = select(vec3<f32>(0.32, 0.82, 1.0), vec3<f32>(1.0, 0.52, 0.85), cross >= 0.0);

  let gnd_frac = (rho00 * p0_sq) / max(1e-4, prob_w);
  let exc_frac = (rho11 * p1_sq) / max(1e-4, prob_w);
  let dip_frac = clamp(abs(cross) / max(1e-4, prob_w), 0.0, 0.85);

  var rgb = base_gnd * clamp(gnd_frac, 0.0, 1.0) + exc_col * clamp(exc_frac * 1.4, 0.0, 1.2);
  rgb = mix(rgb, dip_col, dip_frac * 0.65);
  let shade = clamp(0.96 - 0.35 * pos4.w, 0.3, 1.0);
  let alpha = clamp(0.052 * sqrt(prob_w), 0.0, 0.22);

  var out: TdksPtOut;
  out.clip_pos = vec4<f32>(
    view.x * fov * inv_z / aspect + corner.x * world_r / aspect,
    view.y * fov * inv_z + corner.y * world_r,
    0.45, 1.0
  );
  out.local_uv = corner;
  out.color = vec4<f32>(rgb * shade, alpha);
  return out;
}

@fragment
fn fs_tdks_cloud(in: TdksPtOut) -> @location(0) vec4<f32> {
  if (in.color.a <= 0.004) { discard; }
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let soft = exp(-r2 * 3.1) * (1.0 - r2);
  let a = in.color.a * soft;
  return vec4<f32>(in.color.rgb * a, a);
}
`;

export function createElementsLabWebGpuRenderer(device, canvas) {
  const ctx = canvas.getContext('webgpu');
  if (!ctx) {
    throw new Error('Failed to acquire WebGPU canvas context on #gpu-canvas');
  }
  const format = navigator.gpu.getPreferredCanvasFormat();
  let configuredW = 0;
  let configuredH = 0;
  function configureCanvas(w, h) {
    canvas.width = w;
    canvas.height = h;
    ctx.configure({
      device,
      format,
      alphaMode: 'opaque',
      usage: 0x10 | 0x01 // RENDER_ATTACHMENT | COPY_SRC
    });
    configuredW = w;
    configuredH = h;
  }
  configureCanvas(Math.max(320, canvas.clientWidth || 640), Math.max(240, canvas.clientHeight || 480));

  // Pipelines
  const atomicComputeModule = device.createShaderModule({ code: ATOMIC_VOLUME_COMPUTE_WGSL, label: 'ulg-lab-atomic-vol-cs' });
  const atomicComputePipe = device.createComputePipeline({
    label: 'ulg-lab-atomic-vol-pipe',
    layout: 'auto',
    compute: { module: atomicComputeModule, entryPoint: 'build_atomic_volume' }
  });

  const volModule = device.createShaderModule({ code: VOLUME_RAYMARCH_WGSL, label: 'ulg-lab-vol-raymarch' });
  const volPipe = device.createRenderPipeline({
    label: 'ulg-lab-vol-raymarch-pipe',
    layout: 'auto',
    vertex: { module: volModule, entryPoint: 'vs_fullscreen' },
    fragment: { module: volModule, entryPoint: 'fs_raymarch', targets: [{ format }] },
    primitive: { topology: 'triangle-list' }
  });

  const atomModule = device.createShaderModule({ code: INSTANCED_ATOMS_WGSL, label: 'ulg-lab-instanced-atoms' });
  const atomPipe = device.createRenderPipeline({
    label: 'ulg-lab-instanced-atoms-pipe',
    layout: 'auto',
    vertex: { module: atomModule, entryPoint: 'vs_atom' },
    fragment: { module: atomModule, entryPoint: 'fs_atom', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
  });
  const wirePipe = device.createRenderPipeline({
    label: 'ulg-lab-md-wireframe-pipe',
    layout: 'auto',
    vertex: { module: atomModule, entryPoint: 'vs_wire' },
    fragment: {
      module: atomModule,
      entryPoint: 'fs_wire',
      targets: [{
        format,
        blend: {
          color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
        }
      }]
    },
    primitive: { topology: 'line-list' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less' }
  });

  const polyModule = device.createShaderModule({ code: POLYTOPE_ATLAS_SHADER_WGSL, label: 'ulg-lab-polytope-shader' });
  const polyPipe = device.createRenderPipeline({
    label: 'ulg-lab-polytope-pipe',
    layout: 'auto',
    vertex: { module: polyModule, entryPoint: 'vs_poly' },
    fragment: { module: polyModule, entryPoint: 'fs_poly', targets: [{ format }] },
    primitive: { topology: 'triangle-list' }
  });

  const compNucModule = device.createShaderModule({ code: COMPOSITE_NUCLEAR_VOL_WGSL, label: 'ulg-lab-comp-nuc-cs' });
  const compNucPipe = device.createComputePipeline({
    label: 'ulg-lab-comp-nuc-pipe',
    layout: 'auto',
    compute: { module: compNucModule, entryPoint: 'build_composite_nuclear_volume' }
  });

  const polyProbeModule = device.createShaderModule({ code: POLYTOPE_PROBE_COMPUTE_WGSL, label: 'ulg-lab-poly-probe-cs' });
  const polyProbePipe = device.createComputePipeline({
    label: 'ulg-lab-poly-probe-pipe',
    layout: 'auto',
    compute: { module: polyProbeModule, entryPoint: 'probe_polytope_point' }
  });

  // MoonLab-Grade Quantum Orbital Point-Cloud Pipelines (premultiplied additive soft glow!)
  const additiveBlend = {
    color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }
  };
  const alphaBlend = {
    color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
  };

  const cloudModule = device.createShaderModule({ code: ORBITAL_CLOUD_RENDER_WGSL, label: 'ulg-lab-orbital-cloud' });
  const cloudPipe = device.createRenderPipeline({
    label: 'ulg-lab-orbital-cloud-pipe',
    layout: 'auto',
    vertex: { module: cloudModule, entryPoint: 'vs_cloud' },
    fragment: { module: cloudModule, entryPoint: 'fs_cloud', targets: [{ format, blend: additiveBlend }] },
    primitive: { topology: 'triangle-list' }
  });
  const nucleusPipe = device.createRenderPipeline({
    label: 'ulg-lab-orbital-nuc-pipe',
    layout: 'auto',
    vertex: { module: cloudModule, entryPoint: 'vs_nucleus' },
    fragment: { module: cloudModule, entryPoint: 'fs_nucleus', targets: [{ format, blend: additiveBlend }] },
    primitive: { topology: 'triangle-list' }
  });
  const guidePipe = device.createRenderPipeline({
    label: 'ulg-lab-orbital-guides-pipe',
    layout: 'auto',
    vertex: { module: cloudModule, entryPoint: 'vs_guides' },
    fragment: { module: cloudModule, entryPoint: 'fs_guides', targets: [{ format, blend: alphaBlend }] },
    primitive: { topology: 'line-list' }
  });

  // Live 3D 2D-Maxwell Wave-Field + Driven Electron-Shell Scene Pipelines
  const psModule = device.createShaderModule({ code: PHOTON_SHELL_SCENE_WGSL, label: 'ulg-lab-photon-shell-scene' });
  const psPlanePipe = device.createRenderPipeline({
    label: 'ulg-lab-ps-wave-plane-pipe',
    layout: 'auto',
    vertex: { module: psModule, entryPoint: 'vs_wave_plane' },
    fragment: { module: psModule, entryPoint: 'fs_wave_plane', targets: [{ format }] },
    primitive: { topology: 'triangle-list' }
  });
  const psShellPipe = device.createRenderPipeline({
    label: 'ulg-lab-ps-shells-pipe',
    layout: 'auto',
    vertex: { module: psModule, entryPoint: 'vs_driven_shells' },
    fragment: { module: psModule, entryPoint: 'fs_shell_dot', targets: [{ format, blend: additiveBlend }] },
    primitive: { topology: 'triangle-list' }
  });

  const cloudUniformBuf = device.createBuffer({ size: 64, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const psUniformBuf = device.createBuffer({ size: 80, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const compNucPosBuf = device.createBuffer({ size: 256, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  const compNucMetaBuf = device.createBuffer({ size: 256, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });

  // Single-Atom TD-KS Quantum Electron Cloud <-> Photon Wavepacket Pipelines
  const tdksModule = device.createShaderModule({ code: TDKS_PHOTON_CLOUD_WGSL, label: 'ulg-lab-tdks-photon-cloud' });
  const tdksFieldPipe = device.createRenderPipeline({
    label: 'ulg-lab-tdks-field-pipe',
    layout: 'auto',
    vertex: { module: tdksModule, entryPoint: 'vs_tdks_field' },
    fragment: { module: tdksModule, entryPoint: 'fs_tdks_field', targets: [{ format }] },
    primitive: { topology: 'triangle-list' }
  });
  const tdksCloudPipe = device.createRenderPipeline({
    label: 'ulg-lab-tdks-cloud-pipe',
    layout: 'auto',
    vertex: { module: tdksModule, entryPoint: 'vs_tdks_cloud' },
    fragment: { module: tdksModule, entryPoint: 'fs_tdks_cloud', targets: [{ format, blend: additiveBlend }] },
    primitive: { topology: 'triangle-list' }
  });
  const tdksUniformBuf = device.createBuffer({ size: 96, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const tdksRadHistBuf = device.createBuffer({ size: 4 * 128 * 4, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });

  // Reusable uniforms & dummy placeholder buffers
  const volUniformBuf = device.createBuffer({ size: 48, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const atomUniformBuf = device.createBuffer({ size: 48, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const polyUniformBuf = device.createBuffer({ size: 32, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const polyProbeUniformBuf = device.createBuffer({ size: 16, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const polyProbeOutBuf = device.createBuffer({ size: 16, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const polyProbeReadBuf = device.createBuffer({ size: 16, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
  const compNucParamsBuf = device.createBuffer({ size: 16, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  let cachedCompNucVolBuf = null;
  let cachedCompNucDim = 0;
  let polyProbeBusy = false;
  const dummyVec4Buf = device.createBuffer({ size: 16, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  const dummyScalarBuf = device.createBuffer({ size: 16, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });

  let depthTex = null;
  let depthW = 0;
  let depthH = 0;

  let cachedVolBuf = null;
  let cachedVolSize = 0;
  let cachedScalarBuf = null;
  let cachedScalarSize = 0;
  let cachedPolyBuf = null;
  let cachedPolySize = 0;
  let cachedAtomicVolBuf = null;
  let cachedAtomicDim = 0;
  let cachedAtomicRBuf = null;
  let cachedAtomicRSize = 0;
  let cachedAtomicRhoBuf = null;
  let cachedAtomicRhoSize = 0;
  const atomicParamsBuf = device.createBuffer({ size: 32, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  let cachedLatticePosBuf = null;
  let cachedLatticePosSize = 0;
  let cachedLatticeVelBuf = null;
  let cachedLatticeVelSize = 0;

  let lastVec4Ref = null;
  let lastScalarRef = null;
  let lastPolyRef = null;
  let lastLatticeRef = null;

  function ensureCanvasSize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(240, Math.floor(rect.height));
    if (canvas.width !== w || canvas.height !== h || configuredW !== w || configuredH !== h) {
      configureCanvas(w, h);
    }
    if (!depthTex || depthW !== w || depthH !== h) {
      if (depthTex) depthTex.destroy();
      depthTex = device.createTexture({
        size: [w, h],
        format: 'depth24plus',
        usage: 0x10 // GPUTextureUsage.RENDER_ATTACHMENT
      });
      depthW = w;
      depthH = h;
    }
    return { w, h };
  }

  /**
   * Generate 3D atomic orbital + |Y_lm|^2 + spin density (rho_up - rho_down)
   * directly on WebGPU into a resident GPU storage buffer (0 CPU readback!).
   */
  function buildAtomicVolumeOnGpu({ rGrid, rhoGrid, valenceL = 0, unpairedCount = 0, totalElectrons = 1, dim = 32 }) {
    const nGrid = rGrid.length;
    const totalVoxels = dim * dim * dim;
    const byteSize = totalVoxels * 16;
    if (!cachedAtomicVolBuf || cachedAtomicDim !== dim) {
      if (cachedAtomicVolBuf) cachedAtomicVolBuf.destroy();
      cachedAtomicVolBuf = device.createBuffer({
        label: 'ulg-lab-atomic-vol-3d',
        size: byteSize,
        usage: GPU_BUFFER_USAGE.STORAGE
      });
      cachedAtomicDim = dim;
    }
    const rBytes = Math.max(16, nGrid * 4);
    if (!cachedAtomicRBuf || cachedAtomicRSize < rBytes) {
      cachedAtomicRBuf = device.createBuffer({ size: rBytes, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
      cachedAtomicRSize = rBytes;
    }
    if (!cachedAtomicRhoBuf || cachedAtomicRhoSize < rBytes) {
      cachedAtomicRhoBuf = device.createBuffer({ size: rBytes, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
      cachedAtomicRhoSize = rBytes;
    }
    const rArr = Float32Array.from(rGrid);
    const rhoArr = Float32Array.from(rhoGrid);
    const rMaxPlot = Math.min(8.5, rArr[nGrid - 1] || 8.0);
    const spinFrac = unpairedCount > 0 ? Math.min(1.0, (unpairedCount / Math.max(1, Math.min(10, totalElectrons))) * 1.4) : 0.0;
    const pData = new ArrayBuffer(32);
    new Uint32Array(pData, 0, 4).set([dim, nGrid, valenceL >>> 0, unpairedCount >>> 0]);
    new Float32Array(pData, 16, 4).set([rMaxPlot, spinFrac, 0, 0]);

    device.queue.writeBuffer(cachedAtomicRBuf, 0, rArr);
    device.queue.writeBuffer(cachedAtomicRhoBuf, 0, rhoArr);
    device.queue.writeBuffer(atomicParamsBuf, 0, pData);

    const bg = device.createBindGroup({
      layout: atomicComputePipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: atomicParamsBuf } },
        { binding: 1, resource: { buffer: cachedAtomicRBuf } },
        { binding: 2, resource: { buffer: cachedAtomicRhoBuf } },
        { binding: 3, resource: { buffer: cachedAtomicVolBuf } }
      ]
    });
    const enc = device.createCommandEncoder({ label: 'ulg-lab-atomic-vol-enc' });
    const pass = enc.beginComputePass();
    pass.setPipeline(atomicComputePipe);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(totalVoxels / 64));
    pass.end();
    device.queue.submit([enc.finish()]);
    return { buffer: cachedAtomicVolBuf, dim };
  }

  function renderVolume3D({
    gpuVec4Buffer = null,
    vec4Data = null,
    scalarData = null,
    dim = 24,
    channels = 4,
    yaw = 0.48,
    pitch = 0.28,
    tint = [0.34, 0.76, 1.0],
    showFermiIso = false
  }) {
    const { w, h } = ensureCanvasSize();
    let vBuf = dummyVec4Buf;
    let sBuf = dummyScalarBuf;
    if (channels === 4) {
      if (gpuVec4Buffer) {
        vBuf = gpuVec4Buffer;
      } else if (vec4Data) {
        const bytes = Math.max(16, vec4Data.byteLength);
        if (!cachedVolBuf || cachedVolSize < bytes) {
          if (cachedVolBuf) cachedVolBuf.destroy();
          cachedVolBuf = device.createBuffer({ size: bytes, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
          cachedVolSize = bytes;
          lastVec4Ref = null;
        }
        if (lastVec4Ref !== vec4Data) {
          device.queue.writeBuffer(cachedVolBuf, 0, vec4Data);
          lastVec4Ref = vec4Data;
        }
        vBuf = cachedVolBuf;
      }
    } else if (scalarData) {
      const bytes = Math.max(16, scalarData.byteLength);
      if (!cachedScalarBuf || cachedScalarSize < bytes) {
        if (cachedScalarBuf) cachedScalarBuf.destroy();
        cachedScalarBuf = device.createBuffer({ size: bytes, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
        cachedScalarSize = bytes;
        lastScalarRef = null;
      }
      if (lastScalarRef !== scalarData) {
        device.queue.writeBuffer(cachedScalarBuf, 0, scalarData);
        lastScalarRef = scalarData;
      }
      sBuf = cachedScalarBuf;
    }

    const uBuf = new ArrayBuffer(48);
    new Float32Array(uBuf, 0, 4).set([w, h, yaw, pitch]);
    new Uint32Array(uBuf, 16, 4).set([dim >>> 0, channels >>> 0, showFermiIso ? 1 : 0, 0]);
    new Float32Array(uBuf, 32, 4).set([tint[0] ?? 0.34, tint[1] ?? 0.76, tint[2] ?? 1.0, 1.0]);
    device.queue.writeBuffer(volUniformBuf, 0, uBuf);

    const bg = device.createBindGroup({
      layout: volPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: volUniformBuf } },
        { binding: 1, resource: { buffer: vBuf } },
        { binding: 2, resource: { buffer: sBuf } }
      ]
    });

    const enc = device.createCommandEncoder({ label: 'ulg-lab-render-vol' });
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.02, g: 0.035, b: 0.067, a: 1 }
      }]
    });
    pass.setPipeline(volPipe);
    pass.setBindGroup(0, bg);
    pass.draw(3);
    pass.end();
    device.queue.submit([enc.finish()]);
  }

  /**
   * Zero-copy WebGPU instanced MD renderer: reads `positionsBuffer` and
   * `velocitiesBuffer` DIRECTLY from `liveMdSession` on the GPU!
   */
  function renderLiveMd({
    positionsBuffer,
    velocitiesBuffer,
    atomCount,
    boxLengthsA,
    yaw = 0.45,
    pitch = 0.32,
    tint = [0.65, 0.80, 0.96],
    velocityColorScale = 28.0
  }) {
    if (!positionsBuffer || !velocitiesBuffer || !(atomCount > 0)) return;
    const { w, h } = ensureCanvasSize();
    const lx = Number(boxLengthsA?.[0] || 10);
    const ly = Number(boxLengthsA?.[1] || lx);
    const lz = Number(boxLengthsA?.[2] || lx);
    const radiusFrac = Math.max(0.055, Math.min(0.14, 0.56 / Math.cbrt(Math.max(8, atomCount))));

    const uData = new Float32Array([
      w, h, yaw, pitch,
      lx, ly, lz, radiusFrac,
      tint[0] ?? 0.65, tint[1] ?? 0.80, tint[2] ?? 0.96, velocityColorScale
    ]);
    device.queue.writeBuffer(atomUniformBuf, 0, uData);

    const atomBg = device.createBindGroup({
      layout: atomPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: atomUniformBuf } },
        { binding: 1, resource: { buffer: positionsBuffer } },
        { binding: 2, resource: { buffer: velocitiesBuffer } }
      ]
    });
    const wireBg = device.createBindGroup({
      layout: wirePipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: atomUniformBuf } }
      ]
    });

    const enc = device.createCommandEncoder({ label: 'ulg-lab-render-md' });
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.02, g: 0.035, b: 0.067, a: 1 }
      }],
      depthStencilAttachment: {
        view: depthTex.createView(),
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
        depthClearValue: 1.0
      }
    });
    pass.setPipeline(atomPipe);
    pass.setBindGroup(0, atomBg);
    pass.draw(6, atomCount);

    pass.setPipeline(wirePipe);
    pass.setBindGroup(0, wireBg);
    pass.draw(24, 1);

    pass.end();
    device.queue.submit([enc.finish()]);
  }

  /**
   * Render a static 3D ionic/covalent crystal lattice on WebGPU (for ionic
   * compounds in Tab 5 where molecular RHF is not applicable).
   */
  function renderStaticCrystalLattice({ positions, velocities, atomCount, boxLengthsA, yaw, pitch, tint }) {
    if (!positions || !velocities || !(atomCount > 0)) return;
    const pBytes = Math.max(16, positions.byteLength);
    const vBytes = Math.max(16, velocities.byteLength);
    if (!cachedLatticePosBuf || cachedLatticePosSize < pBytes) {
      cachedLatticePosBuf = device.createBuffer({ size: pBytes, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
      cachedLatticePosSize = pBytes;
      lastLatticeRef = null;
    }
    if (!cachedLatticeVelBuf || cachedLatticeVelSize < vBytes) {
      cachedLatticeVelBuf = device.createBuffer({ size: vBytes, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
      cachedLatticeVelSize = vBytes;
      lastLatticeRef = null;
    }
    if (lastLatticeRef !== positions) {
      device.queue.writeBuffer(cachedLatticePosBuf, 0, positions);
      device.queue.writeBuffer(cachedLatticeVelBuf, 0, velocities);
      lastLatticeRef = positions;
    }
    renderLiveMd({
      positionsBuffer: cachedLatticePosBuf,
      velocitiesBuffer: cachedLatticeVelBuf,
      atomCount,
      boxLengthsA,
      yaw,
      pitch,
      tint,
      velocityColorScale: 1.0
    });
  }

  function getPolytopeAxisBounds(atlas) {
    if (!atlas?.polytopes?.length) {
      return { minLt: 1, maxLt: 4.2, minLp: 2, maxLp: 10 };
    }
    const minLt = Math.log10(Math.max(1, Math.min(...atlas.polytopes.map((p) => p.axes[0].min))));
    const maxLt = Math.log10(Math.max(10, Math.max(...atlas.polytopes.map((p) => p.axes[0].max))));
    const minLp = Math.min(...atlas.polytopes.map((p) => Math.log10(p.axes[1].min)));
    const maxLp = Math.max(...atlas.polytopes.map((p) => Math.log10(p.axes[1].max)));
    // Add 8% fail-closed border margin around the convex hull so users can probe OUTSIDE the domain too!
    const padT = Math.max(0.12, (maxLt - minLt) * 0.08);
    const padP = Math.max(0.35, (maxLp - minLp) * 0.08);
    return { minLt: minLt - padT, maxLt: maxLt + padT, minLp: minLp - padP, maxLp: maxLp + padP };
  }

  function ensurePolytopeBuffer(atlas) {
    const packed = atlas.packedGpuAtlas.data;
    const bytes = Math.max(64, packed.byteLength);
    if (!cachedPolyBuf || cachedPolySize < bytes) {
      if (cachedPolyBuf) cachedPolyBuf.destroy();
      cachedPolyBuf = device.createBuffer({ size: bytes, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
      cachedPolySize = bytes;
      lastPolyRef = null;
    }
    if (lastPolyRef !== packed) {
      device.queue.writeBuffer(cachedPolyBuf, 0, packed);
      lastPolyRef = packed;
    }
    return cachedPolyBuf;
  }

  /**
   * Synthesize a 3D composite multi-nucleus Fermi density volume directly on WebGPU
   * for backfed compounds (`H2O`, `NaCl`, `FeO`, `235UF6`, etc.).
   */
  function buildCompositeNuclearVolumeOnGpu(nuclei = [], dim = 24) {
    if (!Array.isArray(nuclei) || nuclei.length === 0) return null;
    const totalVoxels = dim * dim * dim;
    const byteSize = totalVoxels * 16;
    if (!cachedCompNucVolBuf || cachedCompNucDim !== dim) {
      if (cachedCompNucVolBuf) cachedCompNucVolBuf.destroy();
      cachedCompNucVolBuf = device.createBuffer({
        label: 'ulg-lab-comp-nuc-vol-3d',
        size: byteSize,
        usage: GPU_BUFFER_USAGE.STORAGE
      });
      cachedCompNucDim = dim;
    }
    const n = Math.min(16, nuclei.length);
    const posR = new Float32Array(n * 4);
    const meta = new Float32Array(n * 4);
    let maxCoord = 0.01;
    for (let i = 0; i < n; i += 1) {
      maxCoord = Math.max(maxCoord, Math.abs(nuclei[i].x || 0), Math.abs(nuclei[i].y || 0), Math.abs(nuclei[i].z || 0));
    }
    const scale = n === 1 ? 0 : (0.58 / maxCoord);
    for (let i = 0; i < n; i += 1) {
      const s = nuclei[i];
      const rFm = Math.max(1.2, Number(s.chargeRadiusFm || 3.0));
      const radUnit = Math.max(0.14, Math.min(0.36, 0.12 + 0.032 * rFm));
      posR.set([(s.x || 0) * scale, (s.y || 0) * scale, (s.z || 0) * scale, radUnit], i * 4);
      meta.set([Math.max(1, Number(s.Z || 1)), Math.max(0, Number(s.N || 0)), 1.05, 0.95], i * 4);
    }
    device.queue.writeBuffer(compNucParamsBuf, 0, new Uint32Array([dim >>> 0, n >>> 0, 0, 0]));
    device.queue.writeBuffer(compNucPosBuf, 0, posR);
    device.queue.writeBuffer(compNucMetaBuf, 0, meta);

    const bg = device.createBindGroup({
      layout: compNucPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: compNucParamsBuf } },
        { binding: 1, resource: { buffer: compNucPosBuf } },
        { binding: 2, resource: { buffer: compNucMetaBuf } },
        { binding: 3, resource: { buffer: cachedCompNucVolBuf } }
      ]
    });
    const enc = device.createCommandEncoder({ label: 'ulg-lab-comp-nuc-enc' });
    const pass = enc.beginComputePass();
    pass.setPipeline(compNucPipe);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(totalVoxels / 64));
    pass.end();
    device.queue.submit([enc.finish()]);
    return { buffer: cachedCompNucVolBuf, dim };
  }

  /**
   * Execute live single-point GPU `eval_polytope_atlas_2d` query for the interactive
   * Polytope Atlas cursor (strictly fail-closed when outside the convex hull!).
   */
  async function probePolytopeAtlasOnGpu(atlas, temperatureK, pressurePa) {
    if (!atlas?.packedGpuAtlas?.data || polyProbeBusy) return null;
    polyProbeBusy = true;
    try {
      const polyBuf = ensurePolytopeBuffer(atlas);
      device.queue.writeBuffer(polyProbeUniformBuf, 0, new Float32Array([Number(temperatureK), Number(pressurePa), 0, 0]));
      const bg = device.createBindGroup({
        layout: polyProbePipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: polyProbeUniformBuf } },
          { binding: 1, resource: { buffer: polyBuf } },
          { binding: 2, resource: { buffer: polyProbeOutBuf } }
        ]
      });
      const enc = device.createCommandEncoder({ label: 'ulg-lab-poly-probe' });
      const pass = enc.beginComputePass();
      pass.setPipeline(polyProbePipe);
      pass.setBindGroup(0, bg);
      pass.dispatchWorkgroups(1);
      pass.end();
      enc.copyBufferToBuffer(polyProbeOutBuf, 0, polyProbeReadBuf, 0, 16);
      device.queue.submit([enc.finish()]);
      await polyProbeReadBuf.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
      const out = new Float32Array(polyProbeReadBuf.getMappedRange().slice(0, 16));
      polyProbeReadBuf.unmap();
      const hit = out[3] > 0.5;
      const phaseCode = Math.round(out[2]);
      const phaseNames = ['solid', 'liquid', 'gas', 'plasma'];
      return Object.freeze({
        temperatureK: Number(temperatureK),
        pressurePa: Number(pressurePa),
        hit,
        failClosed: !hit,
        densityKgPerM3: hit ? out[0] : null,
        margin: out[1],
        phaseCode: hit ? phaseCode : -1,
        phase: hit ? (phaseNames[Math.max(0, Math.min(3, phaseCode))] || 'solid') : 'OUT OF DOMAIN (FAIL-CLOSED)'
      });
    } finally {
      polyProbeBusy = false;
    }
  }

  /**
   * Live WebGPU Polytope Atlas shader evaluating packed `A x <= b` + Clenshaw
   * Chebyshev density contours directly on the GPU!
   */
  function renderPolytopeAtlas(atlas, probe = null) {
    if (!atlas?.packedGpuAtlas?.data || !atlas?.polytopes?.length) return;
    ensureCanvasSize();
    const polyBuf = ensurePolytopeBuffer(atlas);
    const { minLt, maxLt, minLp, maxLp } = getPolytopeAxisBounds(atlas);
    const probeActive = probe && Number.isFinite(probe.fx) && Number.isFinite(probe.fy) ? 1.0 : 0.0;
    device.queue.writeBuffer(polyUniformBuf, 0, new Float32Array([
      minLt,
      maxLt,
      minLp,
      maxLp,
      probeActive > 0.5 ? probe.fx : -1.0,
      probeActive > 0.5 ? probe.fy : -1.0,
      probeActive,
      0.0
    ]));

    const bg = device.createBindGroup({
      layout: polyPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: polyUniformBuf } },
        { binding: 1, resource: { buffer: polyBuf } }
      ]
    });

    const enc = device.createCommandEncoder({ label: 'ulg-lab-render-polytope' });
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.02, g: 0.035, b: 0.067, a: 1 }
      }]
    });
    pass.setPipeline(polyPipe);
    pass.setBindGroup(0, bg);
    pass.draw(3);
    pass.end();
    device.queue.submit([enc.finish()]);
  }

  /**
   * Render MoonLab-grade 50K–500K 3D quantum orbital point cloud directly from
   * `orbitalPointCloudWebGpu`'s resident GPU buffer (zero CPU vertex copy!).
   */
  function renderOrbitalPointCloud({
    pointsBuffer,
    pointCount,
    yaw = 0.48,
    pitch = 0.30,
    camDist = 2.65,
    pointSize = 0.011,
    opacity = 0.22,
    alternateShellColors = true,
    colorA = [1.0, 1.0, 1.0],
    colorB = [0.38, 0.17, 0.87], // MoonLab #612BDE
    showGuides = false,
    showNucleus = true
  }) {
    if (!pointsBuffer || !(pointCount > 0)) return;
    const { w, h } = ensureCanvasSize();
    device.queue.writeBuffer(cloudUniformBuf, 0, new Float32Array([
      w, h, yaw, pitch,
      camDist, pointSize, opacity, alternateShellColors ? 1.0 : 0.0,
      colorA[0] ?? 1.0, colorA[1] ?? 1.0, colorA[2] ?? 1.0, showGuides ? 1.0 : 0.0,
      colorB[0] ?? 0.38, colorB[1] ?? 0.17, colorB[2] ?? 0.87, 0.018
    ]));

    const cloudBg = device.createBindGroup({
      layout: cloudPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: cloudUniformBuf } },
        { binding: 1, resource: { buffer: pointsBuffer } }
      ]
    });
    const nucBg = device.createBindGroup({
      layout: nucleusPipe.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: cloudUniformBuf } }]
    });
    const guideBg = showGuides
      ? device.createBindGroup({
        layout: guidePipe.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: cloudUniformBuf } }]
      })
      : null;

    const enc = device.createCommandEncoder({ label: 'ulg-lab-render-orbital-cloud' });
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.008, g: 0.011, b: 0.020, a: 1 }
      }]
    });
    if (showGuides && guideBg) {
      pass.setPipeline(guidePipe);
      pass.setBindGroup(0, guideBg);
      pass.draw(50);
    }
    pass.setPipeline(cloudPipe);
    pass.setBindGroup(0, cloudBg);
    pass.draw(6, pointCount);
    if (showNucleus) {
      pass.setPipeline(nucleusPipe);
      pass.setBindGroup(0, nucBg);
      pass.draw(6);
    }
    pass.end();
    device.queue.submit([enc.finish()]);
  }

  /**
   * Render live 3D WebGPU 2D-Maxwell Wave-Field + MoonLab-Grade Driven Atomic
   * Electron-Shell Simulation reading `photonShellSession` GPU buffers ZERO-COPY!
   */
  function renderPhotonShellScene({
    photonSession,
    shellPointsBuffer,
    shellPointCount = 1800,
    yaw = 0.08,
    pitch = 1.05, // Crisp tilted top-3/4 optical bench view showing oblique Snell bending & Gold reflection!
    camDist = 3.25,
    modeMono = false,
    probeRgb = [0.22, 0.96, 0.44],
    slabTint = [0.94, 0.85, 0.52],
    waveGain = 1.0
  }) {
    if (!photonSession?.ezFieldBuffer || !photonSession?.shellStateBuffer) return;
    const { w, h } = ensureCanvasSize();
    const maxPts = shellPointsBuffer ? Math.floor(shellPointsBuffer.size / 16) : 0;
    const ptsPerAtom = Math.max(256, Math.min(2000, maxPts, Math.trunc(shellPointCount)));
    const atomSites = 20; // 4 x 5 atomic Dirac-KS electron shells inside the slab
    const params = photonSession.getParams();

    device.queue.writeBuffer(psUniformBuf, 0, new Float32Array([
      w, h, yaw, pitch,
      photonSession.nx, photonSession.ny, photonSession.slabX0, photonSession.slabX1,
      modeMono ? 1.0 : 0.0, params.isMetal ? 1.0 : 0.0, ptsPerAtom, camDist,
      slabTint[0] ?? 0.85, slabTint[1] ?? 0.85, slabTint[2] ?? 0.9, 0.24,
      probeRgb[0] ?? 0.25, probeRgb[1] ?? 0.92, probeRgb[2] ?? 0.45, waveGain
    ]));

    const planeBg = device.createBindGroup({
      layout: psPlanePipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: psUniformBuf } },
        { binding: 1, resource: { buffer: photonSession.ezFieldBuffer } },
        { binding: 2, resource: { buffer: photonSession.shellStateBuffer } }
      ]
    });
    const shellBg = (shellPointsBuffer && ptsPerAtom > 0)
      ? device.createBindGroup({
        layout: psShellPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: psUniformBuf } },
          { binding: 2, resource: { buffer: photonSession.shellStateBuffer } },
          { binding: 3, resource: { buffer: shellPointsBuffer } }
        ]
      })
      : null;

    const enc = device.createCommandEncoder({ label: 'ulg-lab-render-photon-shell' });
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.008, g: 0.012, b: 0.024, a: 1 }
      }]
    });
    pass.setPipeline(psPlanePipe);
    pass.setBindGroup(0, planeBg);
    pass.draw(6);

    if (shellBg) {
      pass.setPipeline(psShellPipe);
      pass.setBindGroup(0, shellBg);
      pass.draw(6, ptsPerAtom * atomSites);
    }
    pass.end();
    device.queue.submit([enc.finish()]);
  }

  /**
   * Render Single-Atom Time-Dependent Kohn-Sham (TD-KS) Electron Cloud <-> Photon
   * Wavepacket Interaction: 180K-point MoonLab quantum cloud evolving exact
   * |c0(t) phi0 + c1(t) phi1|^2 interference + retarded spherical dipole re-radiation!
   */
  function renderTdksPhotonCloudScene({
    pairCloud,
    blochSession,
    yaw = 0.24,
    pitch = 0.20,
    camDist = 2.85,
    modeMono = false,
    probeRgb = [0.35, 0.55, 1.0],
    emergentReflSrgb = [0.94, 0.86, 0.65],
    pointSize = 0.012
  }) {
    if (!pairCloud?.posBuffer || !pairCloud?.ampBuffer || !blochSession) return;
    const { w, h } = ensureCanvasSize();

    // Pack all 4 channels' 128-slot retarded dipole acceleration histories (2 KB)
    const hLen = blochSession.historyLen;
    const flatHist = new Float32Array(4 * hLen);
    for (let c = 0; c < 4; c += 1) {
      flatHist.set(blochSession.channels[c].radHistory, c * hLen);
    }
    device.queue.writeBuffer(tdksRadHistBuf, 0, flatHist);

    // Choose active Bloch channel driving the 3D quantum cloud interference:
    //   Mono mode -> tunable probe channel 3; RGB mode -> weighted superposition highlighting resonant Blue channel 2!
    const chDrive = modeMono ? blochSession.channels[3] : blochSession.channels[2];
    const chR = blochSession.channels[0];
    const chG = blochSession.channels[1];
    const chB = blochSession.channels[2];
    const rho11 = modeMono
      ? chDrive.rho11
      : Math.max(chB.rho11, 0.5 * (chR.rho11 + chG.rho11));
    const rho00 = Math.max(0.02, 1.0 - rho11);
    const twoRe01 = modeMono
      ? 2.0 * chDrive.rho01Re
      : (0.75 * chR.rho01Re + 0.75 * chG.rho01Re + 1.1 * chB.rho01Re);
    const eNow = modeMono ? chDrive.eNow : (chR.eNow + chG.eNow + chB.eNow) * 0.45;

    device.queue.writeBuffer(tdksUniformBuf, 0, new Float32Array([
      w, h, yaw, pitch,
      camDist, blochSession.getTimeFs(), blochSession.pulseT0Fs, blochSession.pulseWidthFs,
      rho00, rho11, twoRe01, eNow,
      chDrive.omega, modeMono ? 1.0 : 0.0, blochSession.getHistCursor(), hLen,
      emergentReflSrgb[0] ?? 0.9, emergentReflSrgb[1] ?? 0.85, emergentReflSrgb[2] ?? 0.7, chB.rho11,
      probeRgb[0] ?? 0.35, probeRgb[1] ?? 0.55, probeRgb[2] ?? 1.0, pointSize
    ]));

    const fieldBg = device.createBindGroup({
      layout: tdksFieldPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: tdksUniformBuf } },
        { binding: 3, resource: { buffer: tdksRadHistBuf } }
      ]
    });
    const cloudBg = device.createBindGroup({
      layout: tdksCloudPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: tdksUniformBuf } },
        { binding: 1, resource: { buffer: pairCloud.posBuffer } },
        { binding: 2, resource: { buffer: pairCloud.ampBuffer } }
      ]
    });

    const enc = device.createCommandEncoder({ label: 'ulg-lab-render-tdks' });
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.005, g: 0.008, b: 0.016, a: 1 }
      }]
    });
    pass.setPipeline(tdksFieldPipe);
    pass.setBindGroup(0, fieldBg);
    pass.draw(6);

    pass.setPipeline(tdksCloudPipe);
    pass.setBindGroup(0, cloudBg);
    pass.draw(6, pairCloud.pointCount);
    pass.end();
    device.queue.submit([enc.finish()]);
  }

  return Object.freeze({
    backend: 'webgpu',
    format,
    buildAtomicVolumeOnGpu,
    buildCompositeNuclearVolumeOnGpu,
    renderVolume3D,
    renderOrbitalPointCloud,
    renderPhotonShellScene,
    renderTdksPhotonCloudScene,
    renderLiveMd,
    renderStaticCrystalLattice,
    renderPolytopeAtlas,
    probePolytopeAtlasOnGpu,
    getPolytopeAxisBounds
  });
}
