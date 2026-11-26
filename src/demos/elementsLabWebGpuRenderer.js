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
  let iso_d = (s - 0.52) * 18.0;
  let iso = select(0.0, exp(-(iso_d * iso_d)), (u.mode_flags & 1u) != 0u);
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
  let inv_portrait = 1.0 / max(0.35, min(1.0, aspect));
  let ndc = vec2<f32>(in.uv.x * aspect, in.uv.y) * inv_portrait;
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
  let box_wire = (1.0 - smoothstep(0.0, 0.022, edge_d)) * 0.16;

  let final_rgb = accum_rgb + (1.0 - accum_a) * bg + vec3<f32>(0.34, 0.76, 1.0) * box_wire;
  return vec4<f32>(clamp(final_rgb, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
`;

// Zero-Copy Instanced 3D Sphere Renderer reading `positionsBuffer`, `velocitiesBuffer`, & `forcesBuffer` DIRECTLY on WebGPU!
const INSTANCED_ATOMS_WGSL = /* wgsl */ `
struct AtomRenderUniforms {
  resolution: vec2<f32>,
  yaw: f32,
  pitch: f32,
  box_l: vec4<f32>,        // (Lx, Ly, Lz, atomRadiusWorldA)
  ref_box_cam: vec4<f32>,  // (refLx, refLy, refLz, camDist)
  base_tint: vec4<f32>,    // (r, g, b, meltingTempK)
  render_cfg: vec4<f32>,   // (colorMode: 0=Temp 1=Phase/Coord 2=E_pot, eCohEv, wireMode: 0=live 1=refGhost, pad)
};

@group(0) @binding(0) var<uniform> u: AtomRenderUniforms;
@group(0) @binding(1) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> velocities: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> forces: array<vec4<f32>>;

struct VsOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec3<f32>,
  @location(2) view_z: f32,
  @location(3) view_rad: f32,
  @location(4) glow: f32,
};

struct FsOut {
  @location(0) color: vec4<f32>,
  @builtin(frag_depth) depth: f32,
};

fn world_to_view(p_norm: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.yaw); let sy = sin(u.yaw);
  let cp = cos(u.pitch); let sp = sin(u.pitch);
  let x1 = p_norm.x * cy - p_norm.z * sy;
  let z1 = p_norm.x * sy + p_norm.z * cy;
  let y2 = p_norm.y * cp - z1 * sp;
  let z2 = p_norm.y * sp + z1 * cp + max(1.65, u.ref_box_cam.w);
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
  let f4 = forces[iid];
  let half_box = max(vec3<f32>(0.5), u.box_l.xyz * 0.5);
  let ref_half = max(half_box, u.ref_box_cam.xyz * 0.5);
  let norm_half = max(ref_half.x, max(ref_half.y, ref_half.z));
  let p_norm = (pos4.xyz - half_box) / norm_half;
  let view = world_to_view(p_norm);

  let aspect = u.resolution.x / max(1.0, u.resolution.y);
  let fov_scale = 1.65 * min(1.0, aspect);
  let rad_world = u.box_l.w / norm_half;
  // Keep 100K-atom nanoscale spheres crisp without sub-pixel flicker or overdraw mush!
  let min_px_rad = (1.35 * max(0.5, view.z)) / max(1.0, min(u.resolution.x, u.resolution.y) * 0.5 * fov_scale);
  let rad = clamp(max(rad_world, min_px_rad), 0.004, 0.16);
  let cx = (view.x * fov_scale) / max(0.35, view.z * aspect);
  let cy = (view.y * fov_scale) / max(0.35, view.z);
  let rx = (rad * fov_scale) / max(0.35, view.z * aspect);
  let ry = (rad * fov_scale) / max(0.35, view.z);
  let depth_z = clamp((view.z - 0.35) / 10.0, 0.001, 0.999);

  let cmode = u32(round(u.render_cfg.x));
  var col = u.base_tint.rgb;
  var glow = 0.0;

  if (cmode == 1u) {
    // Emergent Structural Phase / First-Shell Coordination z_i / Z_ideal from GPU pos.w!
    let z_norm = clamp(pos4.w, 0.0, 1.25);
    let solid_c = mix(vec3<f32>(0.26, 0.72, 1.0), u.base_tint.rgb, 0.42);
    let liq_c = vec3<f32>(0.22, 0.88, 0.62);
    let surf_c = vec3<f32>(0.98, 0.74, 0.24);
    let vap_c = vec3<f32>(0.98, 0.42, 0.68);
    if (z_norm < 0.22) {
      col = vap_c;
      glow = 0.26;
    } else if (z_norm < 0.55) {
      col = mix(surf_c, liq_c, clamp((z_norm - 0.22) / 0.33, 0.0, 1.0));
      glow = 0.10;
    } else {
      col = mix(liq_c, solid_c, clamp((z_norm - 0.55) / 0.35, 0.0, 1.0));
      glow = 0.02;
    }
  } else if (cmode == 2u) {
    // Per-Atom Potential Energy / Local Strain Stress from GPU forcesBuffer.w!
    let e_scale = max(0.05, u.render_cfg.y);
    let u_rel = clamp(1.0 + f4.w / e_scale, 0.0, 1.4);
    let deep_c = vec3<f32>(0.22, 0.48, 0.96);
    let mid_c = vec3<f32>(0.22, 0.86, 0.72);
    let high_c = vec3<f32>(1.0, 0.48, 0.20);
    col = select(
      mix(deep_c, mid_c, clamp(u_rel * 1.4, 0.0, 1.0)),
      mix(mid_c, high_c, clamp((u_rel - 0.7) * 1.4, 0.0, 1.0)),
      u_rel > 0.7
    );
    glow = clamp((u_rel - 0.85) * 0.4, 0.0, 0.28);
  } else {
    // True Physical Per-Atom Kinetic Temperature T_i = m * v^2 / (3 k_B) normalized by T_m!
    let m_u = max(1.0, vel4.w);
    let v2 = dot(vel4.xyz, vel4.xyz);
    let t_atom_k = (m_u * v2) / (3.0 * 8.617333262e-5);
    let t_melt = max(25.0, u.base_tint.w);
    let heat = clamp(t_atom_k / (2.35 * t_melt), 0.0, 1.0);
    let cold_col = mix(vec3<f32>(0.28, 0.68, 1.0), u.base_tint.rgb, 0.52);
    let melt_col = vec3<f32>(1.0, 0.58, 0.18);
    let hot_col = vec3<f32>(1.0, 0.94, 0.64);
    col = select(
      mix(cold_col, melt_col, heat * 2.0),
      mix(melt_col, hot_col, (heat - 0.5) * 2.0),
      heat > 0.5
    );
    glow = clamp((heat - 0.62) * 0.55, 0.0, 0.28);
  }

  var out: VsOut;
  out.clip_pos = vec4<f32>(cx + corner.x * rx, cy + corner.y * ry, depth_z, 1.0);
  out.local_uv = corner;
  out.color = col;
  out.view_z = view.z;
  out.view_rad = rad;
  out.glow = glow;
  return out;
}

@fragment
fn fs_atom(in: VsOut) -> FsOut {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let nz = sqrt(max(0.0, 1.0 - r2));
  let n = normalize(vec3<f32>(in.local_uv.x, in.local_uv.y, nz));
  let key_l = normalize(vec3<f32>(-0.42, 0.64, 0.64));
  let fill_l = normalize(vec3<f32>(0.62, -0.35, 0.55));
  let diff = max(0.16, dot(n, key_l)) + 0.18 * max(0.0, dot(n, fill_l));
  let half_v = normalize(key_l + vec3<f32>(0.0, 0.0, 1.0));
  let spec = pow(max(0.0, dot(n, half_v)), 34.0) * 0.68;
  let rim = pow(max(0.0, 1.0 - nz), 2.4) * (0.26 + in.glow * 0.65);
  let ao = 0.84 + 0.16 * nz;
  let fog = clamp(1.0 - max(0.0, in.view_z - 3.6) * 0.10, 0.58, 1.0);
  let lit = (in.color * diff * ao + vec3<f32>(1.0) * spec + mix(vec3<f32>(0.38, 0.78, 1.0), in.color, 0.45) * rim + in.color * in.glow * 0.35) * fog;

  var out: FsOut;
  out.color = vec4<f32>(clamp(lit, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
  out.depth = clamp((in.view_z - nz * in.view_rad - 0.35) / 10.0, 0.001, 0.999);
  return out;
}

struct WireOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) color: vec4<f32>,
};

// Periodic Simulation-Box Wireframe Lines (24 vertices = 12 edges + optional 24-vertex gravity floor grid!)
@vertex
fn vs_wire(@builtin(vertex_index) vid: u32) -> WireOut {
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
  let live_half = max(vec3<f32>(0.5), u.box_l.xyz * 0.5);
  let ref_half = max(live_half, u.ref_box_cam.xyz * 0.5);
  let norm_half = max(ref_half.x, max(ref_half.y, ref_half.z));
  let is_ghost = u.render_cfg.z > 0.5;
  let grav_on = u.render_cfg.w > 0.5;
  let active_half = select(live_half, max(vec3<f32>(0.5), u.ref_box_cam.xyz * 0.5), is_ghost);
  let box_scale = active_half / norm_half;

  var p_unit = vec3<f32>(0.0);
  var col = select(vec4<f32>(0.34, 0.76, 1.0, 0.38), vec4<f32>(0.98, 0.80, 0.28, 0.36), is_ghost);
  if (vid < 24u) {
    p_unit = edges[vid];
    if (!is_ghost && grav_on && p_unit.y < -0.5) {
      col = vec4<f32>(0.98, 0.78, 0.34, 0.64);
    }
  } else {
    // 12 crisp floor grid lines (6 X-lines + 6 Z-lines) on the bottom gravity plane y = -1!
    let gi = vid - 24u;
    let line_id = gi / 2u;
    let end_id = gi % 2u;
    let is_z = line_id >= 6u;
    let frac = (f32((line_id % 6u) + 1u) / 7.0) * 2.0 - 1.0;
    let span = select(-1.0, 1.0, end_id == 1u);
    p_unit = select(vec3<f32>(frac, -1.0, span), vec3<f32>(span, -1.0, frac), is_z);
    col = vec4<f32>(0.96, 0.74, 0.32, 0.30);
  }
  let view = world_to_view(p_unit * box_scale);
  let aspect = u.resolution.x / max(1.0, u.resolution.y);
  let fov_scale = 1.65 * min(1.0, aspect);
  let cx = (view.x * fov_scale) / max(0.35, view.z * aspect);
  let cy = (view.y * fov_scale) / max(0.35, view.z);
  let depth_z = clamp((view.z - 0.35) / 10.0, 0.001, 0.999);
  var out: WireOut;
  out.clip_pos = vec4<f32>(cx, cy, depth_z, 1.0);
  out.color = col;
  return out;
}

@fragment
fn fs_wire(in: WireOut) -> @location(0) vec4<f32> {
  return in.color;
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
    let contour = (1.0 - smoothstep(0.0, 0.06, abs(fract(log_rho * 1.5) - 0.5))) * 0.22;
    let facet_edge = (1.0 - smoothstep(0.0, 0.018, margin)) * 0.65;
    col = base_col * iso_shade + vec3<f32>(contour) + vec3<f32>(0.95, 0.98, 1.0) * facet_edge;
  }

  // Interactive GPU (T, log10 P) probe crosshair & glowing reticle
  if (u.probe_active > 0.5) {
    let dx = abs(fx - u.probe_fx);
    let dy = abs(fy - u.probe_fy);
    let d_pt = sqrt(dx * dx + dy * dy);
    let line_x = (1.0 - smoothstep(0.0, 0.0038, dx)) * 0.34;
    let line_y = (1.0 - smoothstep(0.0, 0.0042, dy)) * 0.34;
    let ring = (1.0 - smoothstep(0.0, 0.006, abs(d_pt - 0.022))) * 0.95;
    let dot_c = (1.0 - smoothstep(0.0, 0.007, d_pt)) * 0.95;
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
  stark: vec4<f32>,         // (stark_mix_lambda, e_field_norm, 0, 0)
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
  // First-order Stark perturbation dipolar cloud shift opposite to applied +X electric field:
  // outer valence shells polarize more strongly (~r^2) than tight core shells!
  let r2_pt = dot(pt.xyz, pt.xyz);
  let stark_lam = u.stark.x;
  let pos_eff = pt.xyz - vec3<f32>(stark_lam * (0.42 + 0.85 * min(1.8, r2_pt)), 0.0, 0.0);
  let view = project_pt(pos_eff);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.95 * min(1.0, aspect);
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
  var base_rgb = select(
    u.color_a.rgb,
    select(u.color_b.rgb, u.color_a.rgb, is_a),
    u.cam_style.w > 0.5
  );
  if (abs(stark_lam) > 0.01) {
    let pol_side = clamp(-pos_eff.x * sign(stark_lam) * 1.4, -1.0, 1.0);
    let pol_col = select(vec3<f32>(1.0, 0.55, 0.28), vec3<f32>(0.32, 0.88, 1.0), pol_side >= 0.0);
    base_rgb = mix(base_rgb, pol_col, min(0.55, abs(stark_lam) * 1.15) * abs(pol_side));
  }

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
  let fov = 1.95 * min(1.0, aspect);
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
  let fov = 1.95 * min(1.0, aspect);
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
  let fov = 1.85 * min(1.0, aspect);
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
  let grid_x = 1.0 - smoothstep(0.0, 0.06, abs(fract(gx / 8.0) - 0.5));
  let grid_y = 1.0 - smoothstep(0.0, 0.06, abs(fract(gy / 8.0) - 0.5));
  let grid_line = max(grid_x, grid_y) * 0.055;

  var bg = vec3<f32>(0.012, 0.019, 0.036) + vec3<f32>(0.24, 0.38, 0.58) * grid_line;
  if (in_slab) {
    bg = bg + u.slab_tint.rgb * select(0.08, 0.13, u.wave_meta.y > 0.5);
  }
  // Sharp Fresnel optical interface highlight at x = slab_x0 and x = slab_x1
  let f0_d = (gx - u.grid_meta.z) * 1.1;
  let f1_d = (gx - u.grid_meta.w) * 1.1;
  let face0 = exp(-(f0_d * f0_d)) * select(0.0, 0.55, gy >= 12.0 && gy <= ny - 13.0);
  let face1 = exp(-(f1_d * f1_d)) * select(0.0, 0.32, gy >= 12.0 && gy <= ny - 13.0);
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
  let fov = 1.85 * min(1.0, aspect);
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

// Single-Atom 3D Self-Consistent Real-Space Maxwell-Kohn-Sham (3D Yee FDTD +
// 3D Orbital-Geometry Anisotropic Susceptibility + Dynamically Coupled 180K-pt
// Dirac-KS Electron Cloud) Renderer:
//   Pass 1 (`vs_tdks_field` / `fs_tdks_field`): Full-screen TRUE 3D volumetric
//     raymarcher of the live N^3 GPU Maxwell fields (E_tot, E_inc, P, J) —
//     ZERO flat 2D quad, ZERO hard quad border at ANY 360-deg orbit angle!
//   Pass 2 (`vs_tdks_cloud` / `fs_tdks_cloud`): 180K-pt Dirac-KS orbital cloud
//     where every point trilinearly samples the live 3D GPU polarization P(r,t)
//     and local excitation rho_11(r,t) to physically flex, phase-ripple, and
//     luminesce directly on the struck 3D orbital lobes without white core washout!
const TDKS_PHOTON_CLOUD_WGSL = /* wgsl */ `
struct TdksUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  cam_grid: vec4<f32>,      // (cam_dist, grid_n, world_half, field_view_mode)
  bloch_state: vec4<f32>,   // (rho00, rho11, 2*Re[rho01], e_now)
  wave_meta: vec4<f32>,     // (pol_mode, mode_mono, time_fs, point_size)
  refl_srgb: vec4<f32>,     // (emergent_r, emergent_g, emergent_b, blue_rho11)
  probe_rgb: vec4<f32>,     // (probe_r, probe_g, probe_b, atom_radius)
};

@group(0) @binding(0) var<uniform> u: TdksUniforms;
@group(0) @binding(1) var<storage, read> pair_pos: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> pair_amp: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> e_tot_3d: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> e_inc_3d: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> pol_3d: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> j_3d: array<vec4<f32>>;

struct TdksVolOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) ndc: vec2<f32>,
};

fn project_tdks(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.cam_grid.x;
  return vec3<f32>(x1, y2, z2);
}

// Exact mathematical inverse of project_tdks rotation (M^T = R_y(-yaw) * R_x(-pitch))
fn inv_rot_tdks(v: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let vx1 = v.x;
  let vy1 = v.y * cp + v.z * sp;
  let vz1 = -v.y * sp + v.z * cp;
  return vec3<f32>(
    vx1 * cy + vz1 * sy,
    vy1,
    -vx1 * sy + vz1 * cy
  );
}

fn grid_idx3(ix: u32, iy: u32, iz: u32, n: u32) -> u32 {
  return (iz * n + iy) * n + ix;
}

fn sample_grid_trilin_e_tot(p: vec3<f32>) -> vec4<f32> {
  let nf = max(4.0, u.cam_grid.y);
  let n = u32(nf);
  let wh = max(0.5, u.cam_grid.z);
  let uvw = (p / wh * 0.5 + 0.5) * nf - 0.5;
  if (uvw.x < 0.0 || uvw.y < 0.0 || uvw.z < 0.0 || uvw.x >= nf - 1.0 || uvw.y >= nf - 1.0 || uvw.z >= nf - 1.0) {
    return vec4<f32>(0.0);
  }
  let i0 = vec3<u32>(u32(floor(uvw.x)), u32(floor(uvw.y)), u32(floor(uvw.z)));
  let i1 = min(i0 + vec3<u32>(1u), vec3<u32>(n - 1u));
  let f = fract(uvw);
  let c000 = e_tot_3d[grid_idx3(i0.x, i0.y, i0.z, n)];
  let c100 = e_tot_3d[grid_idx3(i1.x, i0.y, i0.z, n)];
  let c010 = e_tot_3d[grid_idx3(i0.x, i1.y, i0.z, n)];
  let c110 = e_tot_3d[grid_idx3(i1.x, i1.y, i0.z, n)];
  let c001 = e_tot_3d[grid_idx3(i0.x, i0.y, i1.z, n)];
  let c101 = e_tot_3d[grid_idx3(i1.x, i0.y, i1.z, n)];
  let c011 = e_tot_3d[grid_idx3(i0.x, i1.y, i1.z, n)];
  let c111 = e_tot_3d[grid_idx3(i1.x, i1.y, i1.z, n)];
  let cx00 = mix(c000, c100, f.x);
  let cx10 = mix(c010, c110, f.x);
  let cx01 = mix(c001, c101, f.x);
  let cx11 = mix(c011, c111, f.x);
  return mix(mix(cx00, cx10, f.y), mix(cx01, cx11, f.y), f.z);
}

fn sample_grid_trilin_e_inc(p: vec3<f32>) -> vec4<f32> {
  let nf = max(4.0, u.cam_grid.y);
  let n = u32(nf);
  let wh = max(0.5, u.cam_grid.z);
  let uvw = (p / wh * 0.5 + 0.5) * nf - 0.5;
  if (uvw.x < 0.0 || uvw.y < 0.0 || uvw.z < 0.0 || uvw.x >= nf - 1.0 || uvw.y >= nf - 1.0 || uvw.z >= nf - 1.0) {
    return vec4<f32>(0.0);
  }
  let i0 = vec3<u32>(u32(floor(uvw.x)), u32(floor(uvw.y)), u32(floor(uvw.z)));
  let i1 = min(i0 + vec3<u32>(1u), vec3<u32>(n - 1u));
  let f = fract(uvw);
  let c000 = e_inc_3d[grid_idx3(i0.x, i0.y, i0.z, n)];
  let c100 = e_inc_3d[grid_idx3(i1.x, i0.y, i0.z, n)];
  let c010 = e_inc_3d[grid_idx3(i0.x, i1.y, i0.z, n)];
  let c110 = e_inc_3d[grid_idx3(i1.x, i1.y, i0.z, n)];
  let c001 = e_inc_3d[grid_idx3(i0.x, i0.y, i1.z, n)];
  let c101 = e_inc_3d[grid_idx3(i1.x, i0.y, i1.z, n)];
  let c011 = e_inc_3d[grid_idx3(i0.x, i1.y, i1.z, n)];
  let c111 = e_inc_3d[grid_idx3(i1.x, i1.y, i1.z, n)];
  let cx00 = mix(c000, c100, f.x);
  let cx10 = mix(c010, c110, f.x);
  let cx01 = mix(c001, c101, f.x);
  let cx11 = mix(c011, c111, f.x);
  return mix(mix(cx00, cx10, f.y), mix(cx01, cx11, f.y), f.z);
}

fn sample_grid_trilin_pol(p: vec3<f32>) -> vec4<f32> {
  let nf = max(4.0, u.cam_grid.y);
  let n = u32(nf);
  let wh = max(0.5, u.cam_grid.z);
  let uvw = (p / wh * 0.5 + 0.5) * nf - 0.5;
  if (uvw.x < 0.0 || uvw.y < 0.0 || uvw.z < 0.0 || uvw.x >= nf - 1.0 || uvw.y >= nf - 1.0 || uvw.z >= nf - 1.0) {
    return vec4<f32>(0.0);
  }
  let i0 = vec3<u32>(u32(floor(uvw.x)), u32(floor(uvw.y)), u32(floor(uvw.z)));
  let i1 = min(i0 + vec3<u32>(1u), vec3<u32>(n - 1u));
  let f = fract(uvw);
  let c000 = pol_3d[grid_idx3(i0.x, i0.y, i0.z, n)];
  let c100 = pol_3d[grid_idx3(i1.x, i0.y, i0.z, n)];
  let c010 = pol_3d[grid_idx3(i0.x, i1.y, i0.z, n)];
  let c110 = pol_3d[grid_idx3(i1.x, i1.y, i0.z, n)];
  let c001 = pol_3d[grid_idx3(i0.x, i0.y, i1.z, n)];
  let c101 = pol_3d[grid_idx3(i1.x, i0.y, i1.z, n)];
  let c011 = pol_3d[grid_idx3(i0.x, i1.y, i1.z, n)];
  let c111 = pol_3d[grid_idx3(i1.x, i1.y, i1.z, n)];
  let cx00 = mix(c000, c100, f.x);
  let cx10 = mix(c010, c110, f.x);
  let cx01 = mix(c001, c101, f.x);
  let cx11 = mix(c011, c111, f.x);
  return mix(mix(cx00, cx10, f.y), mix(cx01, cx11, f.y), f.z);
}

fn sample_grid_trilin_j(p: vec3<f32>) -> vec4<f32> {
  let nf = max(4.0, u.cam_grid.y);
  let n = u32(nf);
  let wh = max(0.5, u.cam_grid.z);
  let uvw = (p / wh * 0.5 + 0.5) * nf - 0.5;
  if (uvw.x < 0.0 || uvw.y < 0.0 || uvw.z < 0.0 || uvw.x >= nf - 1.0 || uvw.y >= nf - 1.0 || uvw.z >= nf - 1.0) {
    return vec4<f32>(0.0);
  }
  let i0 = vec3<u32>(u32(floor(uvw.x)), u32(floor(uvw.y)), u32(floor(uvw.z)));
  let i1 = min(i0 + vec3<u32>(1u), vec3<u32>(n - 1u));
  let f = fract(uvw);
  let c000 = j_3d[grid_idx3(i0.x, i0.y, i0.z, n)];
  let c100 = j_3d[grid_idx3(i1.x, i0.y, i0.z, n)];
  let c010 = j_3d[grid_idx3(i0.x, i1.y, i0.z, n)];
  let c110 = j_3d[grid_idx3(i1.x, i1.y, i0.z, n)];
  let c001 = j_3d[grid_idx3(i0.x, i0.y, i1.z, n)];
  let c101 = j_3d[grid_idx3(i1.x, i0.y, i1.z, n)];
  let c011 = j_3d[grid_idx3(i0.x, i1.y, i1.z, n)];
  let c111 = j_3d[grid_idx3(i1.x, i1.y, i1.z, n)];
  let cx00 = mix(c000, c100, f.x);
  let cx10 = mix(c010, c110, f.x);
  let cx01 = mix(c001, c101, f.x);
  let cx11 = mix(c011, c111, f.x);
  return mix(mix(cx00, cx10, f.y), mix(cx01, cx11, f.y), f.z);
}

// Pass 1: Full-screen TRUE 3D Volumetric Raymarcher of Live N^3 Maxwell-KS Fields
@vertex
fn vs_tdks_field(@builtin(vertex_index) vid: u32) -> TdksVolOut {
  var tri = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0)
  );
  let ndc = tri[vid];
  var out: TdksVolOut;
  out.clip_pos = vec4<f32>(ndc, 0.5, 1.0);
  out.ndc = ndc;
  return out;
}

@fragment
fn fs_tdks_field(in: TdksVolOut) -> @location(0) vec4<f32> {
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.92 * min(1.0, aspect);
  let d_view = normalize(vec3<f32>(in.ndc.x * aspect / fov, in.ndc.y / fov, 1.0));
  let ro = inv_rot_tdks(vec3<f32>(0.0, 0.0, -u.cam_grid.x));
  let rd = normalize(inv_rot_tdks(d_view));

  // Ray-sphere intersection against spherical optical cavity (R = 1.88 -> ZERO box edges ever!)
  let rad_cav = min(1.88, u.cam_grid.z * 0.94);
  let b_sph = dot(ro, rd);
  let c_sph = dot(ro, ro) - rad_cav * rad_cav;
  let disc = b_sph * b_sph - c_sph;
  if (disc <= 0.0) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  let sq = sqrt(disc);
  let t0 = max(0.05, -b_sph - sq);
  let t1 = -b_sph + sq;
  if (t1 <= t0) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }

  // Deterministic blue-noise-like screen jitter to eliminate volume slicing bands
  let jitter = fract(sin(dot(in.clip_pos.xy, vec2<f32>(12.9898, 78.233))) * 43758.5453);
  let steps = 56u;
  let dt = (t1 - t0) / f32(steps);

  let mode_mono = u.wave_meta.y > 0.5;
  let fview = u.cam_grid.w; // 0 = 3D Volume, 1 = Scattered Only, 2 = 3D Volume + Phase Cut
  let scatt_tint = select(
    clamp(u.refl_srgb.rgb * 1.10, vec3<f32>(0.24), vec3<f32>(1.0)),
    mix(u.probe_rgb.rgb, vec3<f32>(1.0, 0.84, 0.42), 0.28),
    mode_mono
  );
  let inc_tint_pos = select(vec3<f32>(0.52, 0.88, 1.00), mix(u.probe_rgb.rgb, vec3<f32>(0.45, 0.92, 1.0), 0.40), mode_mono);
  let inc_tint_neg = select(vec3<f32>(0.18, 0.36, 0.96), mix(u.probe_rgb.rgb * 0.42, vec3<f32>(0.24, 0.28, 0.96), 0.55), mode_mono);

  var acc_rgb = vec3<f32>(0.0);
  var acc_a = 0.0;

  for (var s = 0u; s < steps; s = s + 1u) {
    let t = t0 + (f32(s) + jitter) * dt;
    let p = ro + rd * t;
    let r = length(p);
    let sph_fade = smoothstep(rad_cav, rad_cav * 0.68, r);
    if (sph_fade <= 0.002) { continue; }

    let et4 = sample_grid_trilin_e_tot(p);
    let ei4 = sample_grid_trilin_e_inc(p);
    let es = et4.xyz - ei4.xyz;
    let es_mag = length(es);

    // 1. Live 3D Incident Photon Wavefront Sheets (sharp curved iso-crests, ZERO flat haze!)
    var step_rgb = vec3<f32>(0.0);
    var step_d = 0.0;
    if (fview < 0.5 || fview > 1.5) {
      let pol_signed = select(
        select(ei4.y, ei4.z, u.wave_meta.x > 0.5 && u.wave_meta.x < 1.5),
        ei4.y * 0.707 + ei4.z * 0.707,
        u.wave_meta.x > 1.5
      );
      // Thin iso-crest sheets around peaks & troughs -> unmistakable 3D marching wavefront planes!
      let a_pol = abs(pol_signed);
      let crest_sheet = smoothstep(0.24, 0.62, max(0.0, pol_signed));
      let trough_sheet = smoothstep(0.24, 0.62, max(0.0, -pol_signed));
      let crest_sharp = crest_sheet * crest_sheet;
      let trough_sharp = trough_sheet * trough_sheet;
      // Slight outer-beam rim highlight so the 3D cylindrical wavepacket reads cleanly from any angle
      let beam_r = length(p.yz);
      let rim_w = 0.65 + 0.55 * smoothstep(0.18, 0.72, beam_r) * (1.0 - smoothstep(0.78, 1.35, beam_r));
      step_rgb = step_rgb + (inc_tint_pos * crest_sharp * 1.15 + inc_tint_neg * trough_sharp * 0.72) * rim_w;
      step_d = step_d + (crest_sharp * 0.068 + trough_sharp * 0.044) * rim_w * clamp(a_pol, 0.0, 1.5);
    }

    // 2. Live 3D Scattered Multipole Wave Shells (E_scatt = E_tot - E_inc) curving & rippling off the orbital lobes!
    if (es_mag > 0.012) {
      let es_signed = select(
        select(es.y, es.z, u.wave_meta.x > 0.5 && u.wave_meta.x < 1.5),
        es.y * 0.707 + es.z * 0.707,
        u.wave_meta.x > 1.5
      );
      // Crisp positive/negative scattered wavefront crests wrapping in 3D around the lobes!
      let sc_pos = pow(smoothstep(0.025, 0.24, max(0.0, es_signed)), 1.45);
      let sc_neg = pow(smoothstep(0.025, 0.24, max(0.0, -es_signed)), 1.45);
      let cross_mag = select(length(vec2<f32>(es.x, es.z)), length(vec2<f32>(es.x, es.y)), u.wave_meta.x > 0.5 && u.wave_meta.x < 1.5);
      let sc_cross = pow(smoothstep(0.022, 0.20, cross_mag), 1.4);
      let sc_boost = select(1.0, 1.85, fview > 0.5 && fview < 1.5);
      let c_pos = select(scatt_tint, mix(scatt_tint, vec3<f32>(1.00, 0.86, 0.44), 0.22), mode_mono);
      let c_neg = vec3<f32>(0.98, 0.34, 0.72);
      let c_xpol = vec3<f32>(0.22, 0.96, 0.88);
      step_rgb = step_rgb + (c_pos * sc_pos * 1.75 + c_neg * sc_neg * 1.15 + c_xpol * sc_cross * 1.35) * sc_boost;
      step_d = step_d + (sc_pos * 0.095 + sc_neg * 0.065 + sc_cross * 0.075) * sc_boost;
    }

    // 3. Local 3D Orbital Energy Absorption Glow (E · J strictly inside struck lobes)
    if (r < 1.18) {
      let p4 = sample_grid_trilin_pol(p);
      let j4 = sample_grid_trilin_j(p);
      let abs_g = clamp(j4.w * 0.75 + p4.w * 0.55, 0.0, 1.2);
      if (abs_g > 0.05) {
        let abs_col = mix(vec3<f32>(1.0, 0.72, 0.18), vec3<f32>(1.0, 0.32, 0.74), clamp(p4.w * 1.3, 0.0, 1.0));
        step_rgb = step_rgb + abs_col * abs_g * 0.42;
        step_d = step_d + abs_g * 0.022;
      }
    }

    // Subtle crisp nucleus pinpoint at r = 0
    let nuc = exp(-r * r * 180.0);
    if (nuc > 0.02) {
      step_rgb = step_rgb + vec3<f32>(1.0, 0.94, 0.76) * nuc * 1.8;
      step_d = step_d + nuc * 0.18;
    }

    let a_step = clamp(step_d * sph_fade * (dt * 14.0), 0.0, 0.42);
    acc_rgb = acc_rgb + (1.0 - acc_a) * step_rgb * sph_fade * dt * 1.85;
    acc_a = acc_a + (1.0 - acc_a) * a_step;
    if (acc_a > 0.92) { break; }
  }

  // Optional crisp circular equatorial wave-diffraction phase cut (fview == 2, ZERO square edges!)
  if (fview > 1.5 && abs(rd.z) > 0.05) {
    let tz = -ro.z / rd.z;
    if (tz > 0.05) {
      let pz = ro + rd * tz;
      let rz = length(pz.xy);
      if (rz < 1.72) {
        let etz = sample_grid_trilin_e_tot(pz);
        let eiz = sample_grid_trilin_e_inc(pz);
        let esz = etz.xyz - eiz.xyz;
        let fade_z = 1.0 - smoothstep(1.18, 1.72, rz);
        let ph_val = etz.y + etz.z;
        let line_c = (1.0 - smoothstep(0.0, 0.09, abs(fract(ph_val * 2.2) - 0.5))) * smoothstep(0.05, 0.25, length(etz.xyz));
        let ring = (1.0 - smoothstep(0.0, 0.012, abs(rz - 1.05))) * 0.14;
        let cut_col = mix(vec3<f32>(0.28, 0.74, 1.0), scatt_tint, clamp(length(esz) * 2.4, 0.0, 1.0));
        acc_rgb = acc_rgb + (cut_col * (line_c * 0.28 + length(esz) * 0.42) + vec3<f32>(0.35, 0.55, 0.85) * ring) * fade_z;
        acc_a = clamp(acc_a + (line_c * 0.16 + ring) * fade_z, 0.0, 0.94);
      }
    }
  }

  // Soft filmic tone curve so overlapping 3D wavefronts stay vivid & legible without clipping!
  let mapped = acc_rgb / (vec3<f32>(1.0) + acc_rgb * 0.72);
  return vec4<f32>(mapped, clamp(acc_a, 0.0, 0.92));
}

// Pass 2: Dynamically Coupled 180K-Point 3D Dirac-KS Electron Cloud!
// Every point samples the LIVE 3D GPU polarization P(r,t), E_scatt(r,t), and local
// excited density rho_11(r,t) at its exact 3D position -> front lobes flex & light up
// BEFORE back lobes with true finite-c phase lag and razor-sharp nodal shells!
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

  let atom_r = max(0.5, u.probe_rgb.w);
  let p_base = pos4.xyz * (atom_r * 1.16);

  // LIVE 3D GPU FIELD COUPLING at this electron sample's exact 3D coordinate!
  let e_loc = sample_grid_trilin_e_tot(p_base);
  let ei_loc = sample_grid_trilin_e_inc(p_base);
  let pol_loc = sample_grid_trilin_pol(p_base);
  let j_loc = sample_grid_trilin_j(p_base);
  let e_scatt_loc = e_loc.xyz - ei_loc.xyz;

  // Local retarded 3D polarization deformation (front lobes react before rear lobes!)
  let disp = pol_loc.xyz * 0.26 + e_scatt_loc * 0.085;
  let p_world = p_base + disp;

  let rho11_loc = clamp(pol_loc.w * 0.90 + u.bloch_state.y * 0.22, 0.0, 0.96);
  let rho00_loc = max(0.10, 1.0 - rho11_loc);
  // Local dipole projection of P(r,t) along radial lobe vector drives opposite-parity interference!
  let r_hat = select(vec3<f32>(0.0, 1.0, 0.0), normalize(pos4.xyz), length(pos4.xyz) > 1e-4);
  let pol_proj = clamp(dot(pol_loc.xyz, r_hat) * 2.6 + u.bloch_state.z * 0.25, -1.6, 1.6);

  let p0_sq = amp4.x * amp4.x;
  let p1_sq = amp4.y * amp4.y;
  let cross = pol_proj * amp4.x * amp4.y;
  let prob_w = max(0.0, rho00_loc * p0_sq * 1.35 + rho11_loc * p1_sq * 0.95 + cross * 0.72);

  let view = project_tdks(p_world);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.92 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.3, view.z);

  let min_px = 1.0 / max(1.0, u.res_yaw_pitch.y);
  let world_r = clamp(u.wave_meta.w * 0.56 * fov * inv_z, min_px * 1.15, 0.0155);

  // High-contrast jewel-like MoonLab orbital lobes + crisp struck-lobe glow (ZERO white washout!):
  let base_gnd = select(vec3<f32>(0.48, 0.26, 1.00), vec3<f32>(0.88, 0.94, 1.00), amp4.w >= 0.0);
  let exc_col = vec3<f32>(1.00, 0.80, 0.22);
  let dip_col = select(vec3<f32>(0.20, 0.94, 1.00), vec3<f32>(1.00, 0.36, 0.82), pol_proj >= 0.0);

  let pol_mag = clamp(length(pol_loc.xyz) * 3.0 + length(j_loc.xyz) * 1.8, 0.0, 1.0);
  let exc_glow = clamp(rho11_loc * 1.45 + j_loc.w * 0.75, 0.0, 1.0);

  var rgb = mix(base_gnd, dip_col, pol_mag * 0.72);
  rgb = mix(rgb, exc_col, exc_glow * 0.78);

  // Crisp lobe definition with gentle core density cap so radial nodes & cloverleaf petals pop!
  let radial_att = mix(0.28, 1.0, smoothstep(0.06, 0.36, pos4.w));
  let shade = clamp(0.94 - 0.18 * pos4.w, 0.42, 0.98);
  let excite_boost = 1.0 + pol_mag * 0.48 + exc_glow * 0.52;
  let alpha = clamp(0.022 * pow(prob_w, 0.65) * radial_att * excite_boost, 0.0, 0.064);

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
  if (in.color.a <= 0.0008) { discard; }
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let soft = exp(-r2 * 3.6) * (1.0 - r2);
  let a = in.color.a * soft;
  return vec4<f32>(in.color.rgb * a, a);
}
`;

// ============================================================================
// 3D Instanced WebGPU Spin-Lattice (sLLG) Magnetic Arrows Renderer (Zero-Copy!)
// ============================================================================
const SPIN_LATTICE_RENDER_WGSL = /* wgsl */ `
struct SpinSceneUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  dims_cam: vec4<f32>,      // (nx, ny, nz, cam_dist)
  field_meta: vec4<f32>,    // (bz_tesla, is_afm, arrow_scale, 0)
};

@group(0) @binding(0) var<uniform> u: SpinSceneUniforms;
@group(0) @binding(1) var<storage, read> spins: array<vec4<f32>>;

struct SpinArrowOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) color: vec3<f32>,
  @location(1) shade: f32,
};

fn project_spin(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.dims_cam.w;
  return vec3<f32>(x1, y2, z2);
}

@vertex
fn vs_spin_arrow(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> SpinArrowOut {
  let nx = u32(max(1.0, u.dims_cam.x));
  let ny = u32(max(1.0, u.dims_cam.y));
  let nz = u32(max(1.0, u.dims_cam.z));
  let n_tot = nx * ny * nz;

  // Last instance (iid == n_tot) renders a large translucent external B_z field indicator beside the lattice!
  var center = vec3<f32>(0.0);
  var dir = vec3<f32>(0.0, 1.0, 0.0);
  var arrow_len = u.field_meta.z;
  var arrow_w = arrow_len * 0.28;
  var col = vec3<f32>(1.0, 0.85, 0.35);

  if (iid < n_tot) {
    let ix = iid % nx;
    let iy = (iid / nx) % ny;
    let iz = iid / (nx * ny);
    let fx = (f32(ix) / max(1.0, f32(nx - 1u))) * 2.0 - 1.0;
    let fy = (f32(iy) / max(1.0, f32(ny - 1u))) * 2.0 - 1.0;
    let fz = (f32(iz) / max(1.0, f32(nz - 1u))) * 2.0 - 1.0;
    center = vec3<f32>(fx, fz, fy) * 0.92; // Map physical magnetic z-axis UP onto world Y!
    let s4 = spins[iid];
    // Map spin (sx, sy, sz) -> world (sx, sz, sy) so +z magnetization points cleanly UP!
    dir = normalize(vec3<f32>(s4.x, s4.z, s4.y) + vec3<f32>(1e-5, 0.0, 0.0));
    let sz = clamp(s4.z, -1.0, 1.0);
    // Color by spin z-projection: -1 deep sapphire blue -> 0 emerald teal -> +1 radiant solar gold/crimson!
    let c_down = vec3<f32>(0.22, 0.50, 1.0);
    let c_mid = vec3<f32>(0.20, 0.88, 0.68);
    let c_up = vec3<f32>(1.0, 0.72, 0.22);
    col = select(mix(c_down, c_mid, sz + 1.0), mix(c_mid, c_up, sz), sz >= 0.0);
  } else {
    // External applied B_z field indicator on the right margin of the lattice
    let bz = u.field_meta.x;
    center = vec3<f32>(1.30, 0.0, 0.0);
    dir = vec3<f32>(0.0, select(-1.0, 1.0, bz >= 0.0), 0.0);
    arrow_len = clamp(abs(bz) * 0.14, 0.0, 0.65);
    arrow_w = select(0.0, 0.085, arrow_len > 0.02);
    col = select(vec3<f32>(0.35, 0.72, 1.0), vec3<f32>(1.0, 0.90, 0.35), bz >= 0.0);
  }

  // 2D camera-facing billboard arrow aligned strictly along the projected 3D spin direction!
  let view_c = project_spin(center);
  let view_tip = project_spin(center + dir * arrow_len);
  let view_tail = project_spin(center - dir * (arrow_len * 0.45));
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.90 * min(1.0, aspect);

  let inv_z_c = 1.0 / max(0.35, view_c.z);
  let p_tip = vec2<f32>(view_tip.x * fov / (max(0.35, view_tip.z) * aspect), view_tip.y * fov / max(0.35, view_tip.z));
  let p_tail = vec2<f32>(view_tail.x * fov / (max(0.35, view_tail.z) * aspect), view_tail.y * fov / max(0.35, view_tail.z));
  let axis_2d = p_tip - p_tail;
  let axis_len = max(0.008, length(axis_2d));
  let fwd = axis_2d / axis_len;
  let perp = vec2<f32>(-fwd.y / aspect, fwd.x * aspect);
  let perp_n = normalize(perp);

  // 9 vertices = 3 triangles: shaft quad (6 verts) + arrowhead triangle (3 verts)
  var local = array<vec2<f32>, 9>(
    vec2<f32>(0.0, -0.26), vec2<f32>(0.62, -0.26), vec2<f32>(0.62,  0.26),
    vec2<f32>(0.0, -0.26), vec2<f32>(0.62,  0.26), vec2<f32>(0.0,   0.26),
    vec2<f32>(0.54, -0.78), vec2<f32>(1.00,  0.00), vec2<f32>(0.54,  0.78)
  );
  let lv = local[vid];
  let half_w = arrow_w * fov * inv_z_c;
  let ndc = p_tail + fwd * (lv.x * axis_len) + vec2<f32>(perp_n.x / aspect, perp_n.y) * (lv.y * half_w);
  let depth_z = clamp((view_c.z - 0.35) / 8.0, 0.001, 0.999);

  var out: SpinArrowOut;
  out.clip_pos = vec4<f32>(ndc.x, ndc.y, depth_z, 1.0);
  out.color = col;
  out.shade = 0.55 + 0.45 * lv.x;
  return out;
}

@fragment
fn fs_spin_arrow(in: SpinArrowOut) -> @location(0) vec4<f32> {
  return vec4<f32>(in.color * in.shade, 1.0);
}
`;

// ============================================================================
// 3D WebGPU Electron-Phonon & Superconducting Transport Renderer (Zero-Copy!)
// ============================================================================
const ELECTRON_TRANSPORT_RENDER_WGSL = /* wgsl */ `
struct TransportSceneUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  cam_env: vec4<f32>,       // (cam_dist, phonon_vib_amp, time_s, is_superconducting)
  field_meta: vec4<f32>,    // (e_field_norm, carrier_count, 0, 0)
};

@group(0) @binding(0) var<uniform> u: TransportSceneUniforms;
@group(0) @binding(1) var<storage, read> c_pos: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> c_vel: array<vec4<f32>>;

struct TrPtOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

fn project_tr(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.cam_env.x;
  return vec3<f32>(x1, y2, z2);
}

// Pass 1: 4x4x4 = 64 vibrating crystal ion cores oscillating with Debye phonon amplitude!
@vertex
fn vs_phonon_ions(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> TrPtOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let ix = iid % 4u;
  let iy = (iid / 4u) % 4u;
  let iz = iid / 16u;
  var p = (vec3<f32>(f32(ix), f32(iy), f32(iz)) / 3.0) * 1.72 - 0.86;
  // Acoustic phonon displacement wave driven by exact bundle thermal phonon amplitude!
  let ph = u.cam_env.z * 7.5 + f32(ix) * 1.3 + f32(iy) * 1.7 + f32(iz) * 2.1;
  let amp = u.cam_env.y * 0.42;
  p = p + vec3<f32>(sin(ph), cos(ph * 1.13), sin(ph * 0.87 + 1.0)) * amp;

  let view = project_tr(p);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.90 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.35, view.z);
  let r = 0.048 * fov * inv_z;
  let col = select(vec3<f32>(0.28, 0.42, 0.62), vec3<f32>(0.36, 0.72, 0.88), u.cam_env.w > 0.5);

  var out: TrPtOut;
  out.clip_pos = vec4<f32>(
    view.x * fov * inv_z / aspect + corner.x * r / aspect,
    view.y * fov * inv_z + corner.y * r,
    0.55, 1.0
  );
  out.local_uv = corner;
  out.color = vec4<f32>(col, 0.45);
  return out;
}

// Pass 2: Streaming conduction electrons, holes, Cooper pairs & red phonon scattering flashes!
@vertex
fn vs_carriers(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> TrPtOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let p4 = c_pos[iid];
  let v4 = c_vel[iid];
  let ctype = p4.w;
  let flash = clamp(v4.w, 0.0, 1.0);

  let p_w = p4.xyz * 0.96;
  let view = project_tr(p_w);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.90 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.35, view.z);

  // Elongate moving carriers along velocity vector so drift vs random thermal motion is visually unmistakable!
  let view_tip = project_tr(p_w + v4.xyz * 0.24);
  let inv_zt = 1.0 / max(0.35, view_tip.z);
  let p0_2d = vec2<f32>(view.x * fov * inv_z / aspect, view.y * fov * inv_z);
  let p1_2d = vec2<f32>(view_tip.x * fov * inv_zt / aspect, view_tip.y * fov * inv_zt);
  let dv_2d = p1_2d - p0_2d;
  let dv_len = length(dv_2d);
  let fwd = select(vec2<f32>(1.0, 0.0), dv_2d / max(1e-5, dv_len), dv_len > 0.002);
  let perp = normalize(vec2<f32>(-fwd.y / aspect, fwd.x * aspect));

  let base_r = select(0.022, 0.032, ctype < -1.5) * fov * inv_z;
  let stretch = select(1.0, clamp(1.0 + dv_len / max(0.008, base_r), 1.0, 4.5), ctype != 0.0);
  let rad_x = base_r * stretch + flash * base_r * 1.4;
  let rad_y = base_r * (1.0 + flash * 1.2);
  let offset = fwd * (corner.x * rad_x) + vec2<f32>(perp.x / aspect, perp.y) * (corner.y * rad_y);

  var col = vec3<f32>(0.24, 0.84, 1.0); // normal electron: electric cyan
  var alpha = 0.78;
  if (ctype == 0.0) {
    col = vec3<f32>(0.42, 0.30, 0.65); // bound valence state: subtle violet
    alpha = 0.24;
  } else if (ctype > 0.5) {
    col = vec3<f32>(1.0, 0.38, 0.76); // thermally activated hole (+): radiant magenta
    alpha = 0.85;
  } else if (ctype < -1.5) {
    col = vec3<f32>(1.0, 0.86, 0.34); // superconducting Cooper pair: radiant gold!
    alpha = 0.92;
  }
  // Phonon scattering burst highlights collision site in bright orange-red!
  col = mix(col, vec3<f32>(1.0, 0.34, 0.14), flash * 0.90);

  var out: TrPtOut;
  out.clip_pos = vec4<f32>(p0_2d.x + offset.x, p0_2d.y + offset.y, 0.45, 1.0);
  out.local_uv = corner;
  out.color = vec4<f32>(col, alpha);
  return out;
}

@fragment
fn fs_tr_dot(in: TrPtOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let soft = exp(-r2 * 2.8) * (1.0 - r2);
  let a = in.color.a * soft;
  return vec4<f32>(in.color.rgb * a, a);
}
`;

// ============================================================================
// 3D Ball-and-Stick Molecule, Wiberg Bond Orders, Dipole Arrow & Multi-Species
// Crystal Renderer (`MOLECULE_3D_WGSL`) — Depth-Buffered Phong/Fresnel WebGPU!
// ============================================================================
const MOLECULE_3D_WGSL = /* wgsl */ `
struct MolSceneUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  cam_meta: vec4<f32>,      // (cam_dist, scale_norm, color_mode (0=CPK, 1=MEP), time_s)
  center_off: vec4<f32>,    // (cx, cy, cz, show_box)
  box_half: vec4<f32>,      // (hx, hy, hz, 0)
};

// atoms_pos_r: vec4(x, y, z, radius_world)
// atoms_meta:  vec4(cpk_r, cpk_g, cpk_b, mulliken_charge)
// seg_a:       vec4(ax, ay, az, radius_world)
// seg_b:       vec4(bx, by, bz, flags_and_order) -> flags: 0=solid bond, 1=dashed TS‡, 2=dipole arrow shaft, 3=dipole head
@group(0) @binding(0) var<uniform> u: MolSceneUniforms;
@group(0) @binding(1) var<storage, read> atoms_pos_r: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> atoms_meta: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> seg_a: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> seg_b: array<vec4<f32>>;

struct MolAtomOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec3<f32>,
  @location(2) rim_tint: vec3<f32>,
};

struct MolBondOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) uv_along: vec2<f32>, // x in [0,1] along bond, y in [-1,1] across cylinder
  @location(1) color: vec3<f32>,
  @location(2) mode_order: vec2<f32>, // (mode, order)
};

fn project_mol(p_raw: vec3<f32>) -> vec3<f32> {
  let p = (p_raw - u.center_off.xyz) * u.cam_meta.y;
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.cam_meta.x;
  return vec3<f32>(x1, y2, z2);
}

fn mep_color(q: f32) -> vec3<f32> {
  // Mulliken Electrostatic Potential coloring: δ- crimson-amber <-> 0 pearl <-> δ+ electric sapphire
  let t = clamp(q * 1.65, -1.0, 1.0);
  let c_neg = vec3<f32>(0.96, 0.28, 0.24);
  let c_mid = vec3<f32>(0.88, 0.91, 0.96);
  let c_pos = vec3<f32>(0.20, 0.56, 1.00);
  return select(mix(c_mid, c_neg, -t), mix(c_mid, c_pos, t), t >= 0.0);
}

@vertex
fn vs_mol_atom(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> MolAtomOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let pr = atoms_pos_r[iid];
  let ameta = atoms_meta[iid];
  let view = project_mol(pr.xyz);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.88 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.35, view.z);
  let rad = pr.w * u.cam_meta.y;
  let cx = view.x * fov * inv_z / aspect;
  let cy = view.y * fov * inv_z;
  let rx = rad * fov * inv_z / aspect;
  let ry = rad * fov * inv_z;
  let depth_z = clamp((view.z - rad * 0.62 - 0.35) / 10.0, 0.001, 0.999);

  let is_mep = u.cam_meta.z > 0.5;
  let col = select(ameta.rgb, mep_color(ameta.w), is_mep);
  let rim = select(vec3<f32>(0.42, 0.78, 1.0), mep_color(ameta.w * 1.4), is_mep);

  var out: MolAtomOut;
  out.clip_pos = vec4<f32>(cx + corner.x * rx, cy + corner.y * ry, depth_z, 1.0);
  out.local_uv = corner;
  out.color = col;
  out.rim_tint = rim;
  return out;
}

@fragment
fn fs_mol_atom(in: MolAtomOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let nz = sqrt(max(0.0, 1.0 - r2));
  let n = normalize(vec3<f32>(in.local_uv.x, in.local_uv.y, nz));
  let light1 = normalize(vec3<f32>(-0.42, 0.65, 0.63));
  let light2 = normalize(vec3<f32>(0.55, -0.30, 0.78));
  let diff = max(0.16, dot(n, light1)) * 0.86 + max(0.0, dot(n, light2)) * 0.24;
  let half_v = normalize(light1 + vec3<f32>(0.0, 0.0, 1.0));
  let spec = pow(max(0.0, dot(n, half_v)), 34.0) * 0.78;
  let rim = pow(max(0.0, 1.0 - nz), 2.6) * 0.32;
  let rgb = in.color * diff + vec3<f32>(1.0) * spec + in.rim_tint * rim;
  return vec4<f32>(clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

@vertex
fn vs_mol_bond(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> MolBondOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(0.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 1.0)
  );
  let q = quad[vid];
  let sa = seg_a[iid];
  let sb = seg_b[iid];
  let va = project_mol(sa.xyz);
  let vb = project_mol(sb.xyz);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.88 * min(1.0, aspect);

  let za = max(0.35, va.z);
  let zb = max(0.35, vb.z);
  let pa = vec2<f32>(va.x * fov / (za * aspect), va.y * fov / za);
  let pb = vec2<f32>(vb.x * fov / (zb * aspect), vb.y * fov / zb);
  let axis = pb - pa;
  let axis_len = max(1e-4, length(axis));
  let dir = axis / axis_len;
  let perp_raw = vec2<f32>(-dir.y * aspect, dir.x / aspect);
  let perp_n = normalize(perp_raw + vec2<f32>(1e-6, 0.0));

  let z_interp = mix(za, zb, q.x);
  let mode = floor(sb.w + 0.001);
  let order = fract(sb.w) * 4.0;
  let taper = select(1.0, max(0.0, 1.0 - q.x), mode >= 2.5);
  let half_w = sa.w * u.cam_meta.y * fov / z_interp * taper;
  let base_p = mix(pa, pb, q.x);
  let ndc = base_p + vec2<f32>(perp_n.x / aspect, perp_n.y) * (q.y * half_w);
  let depth_z = clamp((z_interp - 0.35) / 10.0 + 0.002, 0.001, 0.999);

  var col = vec3<f32>(0.74, 0.82, 0.94);
  if (mode >= 0.5 && mode < 1.5) {
    col = vec3<f32>(1.0, 0.62, 0.26);
  } else if (mode >= 1.5) {
    col = vec3<f32>(1.0, 0.86, 0.24);
  }

  var out: MolBondOut;
  out.clip_pos = vec4<f32>(ndc.x, ndc.y, depth_z, 1.0);
  out.uv_along = q;
  out.color = col;
  out.mode_order = vec2<f32>(mode, max(0.2, order));
  return out;
}

@fragment
fn fs_mol_bond(in: MolBondOut) -> @location(0) vec4<f32> {
  let mode = in.mode_order.x;
  if (mode >= 0.5 && mode < 1.5) {
    let dash = fract(in.uv_along.x * 7.5 - u.cam_meta.w * 0.35);
    if (dash > 0.54) { discard; }
  }
  let y = clamp(in.uv_along.y, -1.0, 1.0);
  let cyl_z = sqrt(max(0.02, 1.0 - y * y));
  let shade = 0.32 + 0.68 * max(0.0, y * 0.45 + cyl_z * 0.88);
  let spec = pow(max(0.0, y * 0.35 + cyl_z * 0.93), 18.0) * 0.45;
  let pulse = select(1.0, 0.85 + 0.25 * sin(u.cam_meta.w * 4.5), mode >= 0.5 && mode < 1.5);
  let rgb = (in.color * shade + vec3<f32>(0.95) * spec) * pulse;
  return vec4<f32>(clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

@vertex
fn vs_mol_box(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4<f32> {
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
  let p = u.center_off.xyz + edges[vid] * u.box_half.xyz;
  let view = project_mol(p);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.88 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.35, view.z);
  let depth_z = clamp((view.z - 0.35) / 10.0, 0.001, 0.999);
  return vec4<f32>(view.x * fov * inv_z / aspect, view.y * fov * inv_z, depth_z, 1.0);
}

@fragment
fn fs_mol_box() -> @location(0) vec4<f32> {
  return vec4<f32>(0.36, 0.78, 1.0, 0.36);
}
`;

// ============================================================================
// Zero-Copy 3D Reactive Chemistry MD Chamber Renderer (`REACTIVE_MD_RENDER_WGSL`)
// Reads `posBuffer` & `velBuffer` DIRECTLY from `reactiveChemistryMdWebGpu`!
// ============================================================================
const REACTIVE_MD_RENDER_WGSL = /* wgsl */ `
struct RxRenderUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  cam_meta: vec4<f32>,      // (cam_dist, radius_world, box_half, 0)
};

@group(0) @binding(0) var<uniform> u: RxRenderUniforms;
@group(0) @binding(1) var<storage, read> pos_sp: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> vel_flash: array<vec4<f32>>;

struct RxOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec3<f32>,
  @location(2) flash: f32,
};

fn project_rx(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.cam_meta.x;
  return vec3<f32>(x1, y2, z2);
}

@vertex
fn vs_rx_mol(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> RxOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let ps = pos_sp[iid];
  let vf = vel_flash[iid];
  let sp = u32(round(ps.w));
  let flash = clamp(vf.w, 0.0, 1.0);
  let view = project_rx(ps.xyz);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.78 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.35, view.z);
  let rad = u.cam_meta.y * (1.0 + flash * 0.55);
  let cx = view.x * fov * inv_z / aspect;
  let cy = view.y * fov * inv_z;
  let rx = rad * fov * inv_z / aspect;
  let ry = rad * fov * inv_z;
  let depth_z = clamp((view.z - 0.35) / 9.0, 0.001, 0.999);

  var col = vec3<f32>(0.22, 0.74, 0.98);
  if (sp == 1u) { col = vec3<f32>(0.99, 0.58, 0.22); }
  else if (sp == 2u) { col = vec3<f32>(0.20, 0.86, 0.60); }
  else if (sp >= 3u) { col = vec3<f32>(0.91, 0.46, 0.98); }

  var out: RxOut;
  out.clip_pos = vec4<f32>(cx + corner.x * rx, cy + corner.y * ry, depth_z, 1.0);
  out.local_uv = corner;
  out.color = col;
  out.flash = flash;
  return out;
}

@fragment
fn fs_rx_mol(in: RxOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let nz = sqrt(max(0.0, 1.0 - r2));
  let n = normalize(vec3<f32>(in.local_uv.x, in.local_uv.y, nz));
  let light = normalize(vec3<f32>(-0.4, 0.65, 0.64));
  let diff = max(0.18, dot(n, light));
  let half_v = normalize(light + vec3<f32>(0.0, 0.0, 1.0));
  let spec = pow(max(0.0, dot(n, half_v)), 26.0) * 0.72;
  let rim = pow(max(0.0, 1.0 - nz), 2.4) * 0.32;
  let base_rgb = in.color * diff + vec3<f32>(1.0) * spec + in.color * rim;
  let burst_rgb = vec3<f32>(1.0, 0.94, 0.62) * (0.95 + 0.45 * nz);
  let rgb = mix(base_rgb, burst_rgb, in.flash * 0.82);
  return vec4<f32>(clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

@vertex
fn vs_rx_box(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4<f32> {
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
  let view = project_rx(edges[vid] * u.cam_meta.z);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.78 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.35, view.z);
  let depth_z = clamp((view.z - 0.35) / 9.0, 0.001, 0.999);
  return vec4<f32>(view.x * fov * inv_z / aspect, view.y * fov * inv_z, depth_z, 1.0);
}

@fragment
fn fs_rx_box() -> @location(0) vec4<f32> {
  return vec4<f32>(0.42, 0.78, 1.0, 0.34);
}
`;

// ============================================================================
// True 3D Orbitable WebGPU Convex Polytope Phase Surface (log10 T, log10 P, log10 rho)
// + Chebyshev Residual Error Heatmap (`POLYTOPE_3D_SURFACE_WGSL`)!
// Evaluates `eval_polytope_atlas_2d` directly inside GPU vertex & fragment shaders!
// ============================================================================
const POLYTOPE_3D_SURFACE_WGSL = /* wgsl */ `
${evaluatePolytopeAtlasWgsl}

struct Poly3DUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  bounds: vec4<f32>,        // (min_lt, max_lt, min_lp, max_lp)
  height_cam: vec4<f32>,    // (min_lrho, max_lrho, cam_dist, grid_n)
  probe_state: vec4<f32>,   // (probe_fx, probe_fy, probe_active, mode: 0=3d-surface, 2=residual-2d)
  md_beacon: vec4<f32>,     // (md_fx, md_fy, md_active, show_wire_facets)
};

@group(0) @binding(0) var<uniform> u: Poly3DUniforms;
@group(0) @binding(1) var<storage, read> polytope_atlas: array<f32>;

struct Poly3DOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) uv_tp: vec2<f32>,
  @location(1) world_pos: vec3<f32>,
  @location(2) normal: vec3<f32>,
  @location(3) eval_vec: vec4<f32>,
};

struct LineOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) color: vec4<f32>,
};

fn project_p3d(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  // Positive pitch looks cleanly DOWN from above onto the 3D phase relief surface!
  let y2 = p.y * cp + z1 * sp;
  let z2 = -p.y * sp + z1 * cp + u.height_cam.z;
  return vec3<f32>(x1, y2, z2);
}

fn eval_surface_height(fx: f32, fy: f32) -> vec4<f32> {
  let log_t = mix(u.bounds.x, u.bounds.y, clamp(fx, 0.0, 1.0));
  let log_p = mix(u.bounds.z, u.bounds.w, clamp(fy, 0.0, 1.0));
  let T = pow(10.0, log_t);
  let P = pow(10.0, log_p);
  let res = eval_polytope_atlas_2d(&polytope_atlas, T, P);
  if (res.w < 0.5) {
    return vec4<f32>(-0.58, res.y, -1.0, 0.0);
  }
  let lrho = log2(max(1e-5, res.x)) * 0.3010299956639812;
  let h_norm = clamp((lrho - u.height_cam.x) / max(0.5, u.height_cam.y - u.height_cam.x), 0.0, 1.0);
  let y_world = h_norm * 1.12 - 0.50;
  return vec4<f32>(y_world, res.y, res.z, 1.0);
}

fn lookup_polytope_rel_err(T: f32, P: f32, fx: f32, fy: f32) -> vec2<f32> {
  let count = u32(polytope_atlas[0u]);
  let log_p = log2(max(1e-12, P)) * 0.3010299956639812;
  let lt_span = max(0.5, u.bounds.y - u.bounds.x);
  let lp_span = max(0.5, u.bounds.w - u.bounds.z);
  var best_err = -1.0;
  var best_margin = -1e9;
  var best_edge_dist = 1.0;
  for (var i = 0u; i < count; i = i + 1u) {
    let rec = 4u + i * 16u;
    let valid_flag = polytope_atlas[rec + 14u];
    if (valid_flag < 0.5) { continue; }
    let t_min = polytope_atlas[rec + 2u];
    let t_max = polytope_atlas[rec + 3u];
    let lp_min = polytope_atlas[rec + 4u];
    let lp_max = polytope_atlas[rec + 5u];
    if (T < t_min || T > t_max || log_p < lp_min || log_p > lp_max) { continue; }
    let f_count = u32(polytope_atlas[rec + 1u]);
    let f_off = u32(polytope_atlas[rec + 8u]);
    var min_slack = 1e9;
    var min_screen_d = 1.0;
    var inside = true;
    for (var fi = 0u; fi < f_count; fi = fi + 1u) {
      let fo = f_off + fi * 4u;
      let a_t = polytope_atlas[fo + 0u];
      let a_p = polytope_atlas[fo + 1u];
      let b_v = polytope_atlas[fo + 2u];
      let raw_s = b_v - (a_t * T + a_p * log_p);
      let slack = raw_s / max(1e-6, polytope_atlas[fo + 3u]);
      if (slack < -1e-4) { inside = false; break; }
      min_slack = min(min_slack, max(0.0, slack));
      // Normalize facet gradient into screen (fx, fy) coordinates so hairline width is uniform across all log-T decades!
      let g_fx = a_t * T * 2.30258509 * lt_span;
      let g_fy = a_p * lp_span;
      let screen_d = max(0.0, raw_s) / max(1e-5, length(vec2<f32>(g_fx, g_fy)));
      min_screen_d = min(min_screen_d, screen_d);
    }
    if (inside && min_slack >= best_margin) {
      best_margin = min_slack;
      best_err = polytope_atlas[rec + 10u];
      best_edge_dist = min_screen_d;
    }
  }
  return vec2<f32>(best_err, best_edge_dist);
}

@vertex
fn vs_poly3d_mesh(@builtin(vertex_index) vid: u32) -> Poly3DOut {
  let gn = u32(max(8.0, u.height_cam.w));
  let cell_idx = vid / 6u;
  let tri_v = vid % 6u;
  let cx = cell_idx % gn;
  let cy = cell_idx / gn;

  var offsets = array<vec2<u32>, 6>(
    vec2<u32>(0u, 0u), vec2<u32>(1u, 0u), vec2<u32>(1u, 1u),
    vec2<u32>(0u, 0u), vec2<u32>(1u, 1u), vec2<u32>(0u, 1u)
  );
  let off = offsets[tri_v];
  let fx = f32(cx + off.x) / f32(gn);
  let fy = f32(cy + off.y) / f32(gn);

  let ev = eval_surface_height(fx, fy);
  let eps = 1.0 / f32(gn);
  let ev_r = eval_surface_height(min(1.0, fx + eps), fy);
  let ev_u = eval_surface_height(fx, min(1.0, fy + eps));

  let world_x = (fx * 2.0 - 1.0) * 1.15;
  let world_z = (fy * 2.0 - 1.0) * 1.15;
  let world_y = ev.x;
  let wpos = vec3<f32>(world_x, world_y, world_z);

  let dx = 2.30 * eps;
  let tx = vec3<f32>(dx, ev_r.x - ev.x, 0.0);
  let tz = vec3<f32>(0.0, ev_u.x - ev.x, dx);
  let nrm = normalize(cross(tz, tx));

  let view = project_p3d(wpos);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.78 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.35, view.z);
  let depth_z = clamp((view.z - 0.35) / 10.0, 0.001, 0.999);

  var out: Poly3DOut;
  out.clip_pos = vec4<f32>(view.x * fov * inv_z / aspect, view.y * fov * inv_z, depth_z, 1.0);
  out.uv_tp = vec2<f32>(fx, fy);
  out.world_pos = wpos;
  out.normal = nrm;
  out.eval_vec = ev;
  return out;
}

@fragment
fn fs_poly3d_mesh(in: Poly3DOut) -> @location(0) vec4<f32> {
  let log_t = mix(u.bounds.x, u.bounds.y, in.uv_tp.x);
  let log_p = mix(u.bounds.z, u.bounds.w, in.uv_tp.y);
  let T = pow(10.0, log_t);
  let P = pow(10.0, log_p);
  let res = eval_polytope_atlas_2d(&polytope_atlas, T, P);

  let n = normalize(in.normal);
  let light1 = normalize(vec3<f32>(-0.45, 0.80, 0.40));
  let light2 = normalize(vec3<f32>(0.65, 0.45, -0.55));
  let diff = max(0.24, dot(n, light1)) * 0.85 + max(0.0, dot(n, light2)) * 0.28;
  let half_v = normalize(light1 + vec3<f32>(0.0, 0.35, 0.94));
  let spec = pow(max(0.0, dot(n, half_v)), 26.0) * 0.34;

  if (res.w < 0.5) {
    let hatch = step(0.84, fract((in.uv_tp.x + in.uv_tp.y) * 26.0)) * 0.14;
    let col = vec3<f32>(0.09, 0.04, 0.07) + vec3<f32>(hatch, hatch * 0.25, hatch * 0.35);
    return vec4<f32>(col, 1.0);
  }

  let rho = max(1e-5, res.x);
  let margin = res.y;
  let pcode = u32(max(0.0, floor(res.z + 0.5)));
  var base_col = vec3<f32>(0.24, 0.72, 1.00);
  if (pcode == 1u) { base_col = vec3<f32>(0.16, 0.85, 0.60); }
  else if (pcode == 2u) { base_col = vec3<f32>(0.99, 0.58, 0.22); }
  else if (pcode >= 3u) { base_col = vec3<f32>(0.76, 0.48, 1.00); }

  let lrho = log2(rho) * 0.3010299956639812;
  let contour = (1.0 - smoothstep(0.0, 0.055, abs(fract(lrho * 1.5) - 0.5))) * 0.11;
  let er_edge = lookup_polytope_rel_err(T, P, in.uv_tp.x, in.uv_tp.y).y;
  let facet_glow = select(0.0, (1.0 - smoothstep(0.0, 0.008, er_edge)) * 0.48, u.md_beacon.w > 0.5);
  let cliff = smoothstep(0.50, 0.96, 1.0 - abs(n.y)) * 0.14;

  var col = base_col * diff + vec3<f32>(spec * 0.7 + contour) + vec3<f32>(0.96, 0.92, 0.72) * facet_glow + base_col * cliff;
  if (u.probe_state.z > 0.5) {
    let d_pr = length(in.uv_tp - u.probe_state.xy);
    let ring = (1.0 - smoothstep(0.0, 0.012, abs(d_pr - 0.028))) * 0.95;
    let dot_p = (1.0 - smoothstep(0.0, 0.014, d_pr)) * 0.95;
    col = mix(col, vec3<f32>(1.0, 0.94, 0.45), clamp(ring + dot_p, 0.0, 1.0));
  }
  return vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

@vertex
fn vs_poly3d_lines(@builtin(vertex_index) vid: u32) -> LineOut {
  var p = vec3<f32>(0.0);
  var col = vec4<f32>(0.36, 0.72, 1.0, 0.32);

  let bx = 1.15;
  let y0 = -0.58;
  let y1 = 0.66;

  if (vid < 24u) {
    var box_e = array<vec3<f32>, 24>(
      vec3<f32>(-bx, y0, -bx), vec3<f32>( bx, y0, -bx),
      vec3<f32>(-bx, y0,  bx), vec3<f32>( bx, y0,  bx),
      vec3<f32>(-bx, y0, -bx), vec3<f32>(-bx, y0,  bx),
      vec3<f32>( bx, y0, -bx), vec3<f32>( bx, y0,  bx),
      vec3<f32>(-bx, y1, -bx), vec3<f32>( bx, y1, -bx),
      vec3<f32>(-bx, y1,  bx), vec3<f32>( bx, y1,  bx),
      vec3<f32>(-bx, y1, -bx), vec3<f32>(-bx, y1,  bx),
      vec3<f32>( bx, y1, -bx), vec3<f32>( bx, y1,  bx),
      vec3<f32>(-bx, y0, -bx), vec3<f32>(-bx, y1, -bx),
      vec3<f32>( bx, y0, -bx), vec3<f32>( bx, y1, -bx),
      vec3<f32>(-bx, y0,  bx), vec3<f32>(-bx, y1,  bx),
      vec3<f32>( bx, y0,  bx), vec3<f32>( bx, y1,  bx)
    );
    p = box_e[vid];
    if (vid < 2u) { col = vec4<f32>(1.0, 0.62, 0.32, 0.78); }
    else if (vid == 4u || vid == 5u) { col = vec4<f32>(0.34, 0.86, 1.0, 0.78); }
    else if (vid == 16u || vid == 17u) { col = vec4<f32>(0.34, 0.96, 0.66, 0.78); }
  } else if (vid < 40u) {
    let gi = vid - 24u;
    let line_id = gi / 2u;
    let end_id = gi % 2u;
    let is_z = line_id >= 4u;
    let k = f32((line_id % 4u) + 1u) / 5.0;
    let coord = (k * 2.0 - 1.0) * bx;
    let span = select(-bx, bx, end_id == 1u);
    p = select(vec3<f32>(coord, y0, span), vec3<f32>(span, y0, coord), is_z);
    col = vec4<f32>(0.34, 0.56, 0.82, 0.22);
  } else if (vid < 44u) {
    if (u.probe_state.z > 0.5) {
      let fx = clamp(u.probe_state.x, 0.0, 1.0);
      let fy = clamp(u.probe_state.y, 0.0, 1.0);
      let ev = eval_surface_height(fx, fy);
      let wx = (fx * 2.0 - 1.0) * bx;
      let wz = (fy * 2.0 - 1.0) * bx;
      let wy_top = select(y0 + 0.35, ev.x + 0.24, ev.w > 0.5);
      let pi = vid - 40u;
      if (pi == 0u) { p = vec3<f32>(wx, y0, wz); }
      else if (pi == 1u) { p = vec3<f32>(wx, wy_top, wz); }
      else if (pi == 2u) { p = vec3<f32>(wx - 0.08, wy_top, wz); }
      else { p = vec3<f32>(wx + 0.08, wy_top, wz); }
      col = select(vec4<f32>(1.0, 0.32, 0.32, 1.0), vec4<f32>(1.0, 0.92, 0.35, 1.0), ev.w > 0.5);
    } else {
      col = vec4<f32>(0.0);
    }
  } else {
    if (u.md_beacon.z > 0.5) {
      let fx = clamp(u.md_beacon.x, 0.0, 1.0);
      let fy = clamp(u.md_beacon.y, 0.0, 1.0);
      let ev = eval_surface_height(fx, fy);
      let wx = (fx * 2.0 - 1.0) * bx;
      let wz = (fy * 2.0 - 1.0) * bx;
      p = select(vec3<f32>(wx, y0, wz), vec3<f32>(wx, ev.x + 0.28, wz), vid == 45u);
      col = vec4<f32>(0.22, 0.96, 1.0, 0.95);
    } else {
      col = vec4<f32>(0.0);
    }
  }

  let view = project_p3d(p);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.78 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.35, view.z);
  let depth_z = clamp((view.z - 0.35) / 10.0, 0.001, 0.999);
  var out: LineOut;
  out.clip_pos = vec4<f32>(view.x * fov * inv_z / aspect, view.y * fov * inv_z, depth_z, 1.0);
  out.color = col;
  return out;
}

@fragment
fn fs_poly3d_lines(in: LineOut) -> @location(0) vec4<f32> {
  if (in.color.a <= 0.01) { discard; }
  return in.color;
}

struct ResOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_poly_residual(@builtin(vertex_index) vid: u32) -> ResOut {
  var pts = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  var out: ResOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.uv = pts[vid] * 0.5 + 0.5;
  return out;
}

@fragment
fn fs_poly_residual(in: ResOut) -> @location(0) vec4<f32> {
  if (in.uv.x < 0.06 || in.uv.x > 0.96 || in.uv.y < 0.08 || in.uv.y > 0.90) {
    return vec4<f32>(0.024, 0.042, 0.078, 1.0);
  }
  let fx = (in.uv.x - 0.06) / 0.90;
  let fy = (in.uv.y - 0.08) / 0.82;
  let T = pow(10.0, mix(u.bounds.x, u.bounds.y, fx));
  let P = pow(10.0, mix(u.bounds.z, u.bounds.w, fy));
  let er = lookup_polytope_rel_err(T, P, fx, fy);
  var col = vec3<f32>(0.05, 0.04, 0.07);
  if (er.x < 0.0) {
    let hatch = step(0.88, fract((in.uv.x + in.uv.y) * 28.0)) * 0.085;
    col = vec3<f32>(0.07, 0.04, 0.07) + vec3<f32>(hatch, hatch * 0.35, hatch * 0.45);
  } else {
    let log_e = log2(max(1e-5, er.x)) * 0.3010299956639812;
    let t = clamp((log_e + 4.5) / 3.2, 0.0, 1.0);
    let c0 = vec3<f32>(0.12, 0.24, 0.64);
    let c1 = vec3<f32>(0.14, 0.78, 0.66);
    let c2 = vec3<f32>(0.98, 0.78, 0.22);
    let c3 = vec3<f32>(0.96, 0.26, 0.28);
    if (t < 0.35) { col = mix(c0, c1, t / 0.35); }
    else if (t < 0.72) { col = mix(c1, c2, (t - 0.35) / 0.37); }
    else { col = mix(c2, c3, (t - 0.72) / 0.28); }
    let edge = (1.0 - smoothstep(0.0, 0.0055, er.y)) * 0.68;
    col = mix(col, vec3<f32>(0.96, 0.98, 1.0), edge);
  }
  if (u.probe_state.z > 0.5) {
    let d_pt = length(vec2<f32>(fx - u.probe_state.x, fy - u.probe_state.y));
    let ring = (1.0 - smoothstep(0.0, 0.006, abs(d_pt - 0.022))) * 0.95;
    col = mix(col, vec3<f32>(1.0, 0.95, 0.55), ring);
  }
  return vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
`;

function cpkColorForZ(Z) {
  const z = Math.max(1, Math.min(118, Math.trunc(Number(Z) || 1)));
  if (z === 1) return [0.95, 0.97, 1.00];
  if (z === 6) return [0.36, 0.40, 0.46];
  if (z === 7) return [0.24, 0.50, 0.98];
  if (z === 8) return [0.95, 0.24, 0.24];
  if (z === 9 || z === 17) return [0.22, 0.88, 0.46];
  if (z === 15) return [1.00, 0.55, 0.16];
  if (z === 16) return [0.98, 0.86, 0.22];
  if (z === 35) return [0.76, 0.26, 0.22];
  if (z === 53) return [0.64, 0.24, 0.86];
  if (z === 3 || z === 11 || z === 19 || z === 37 || z === 55 || z === 87) return [0.68, 0.46, 0.98];
  if (z === 4 || z === 12 || z === 20 || z === 38 || z === 56 || z === 88) return [0.30, 0.84, 0.36];
  if (z === 13 || z === 14 || z === 31 || z === 32 || z === 50 || z === 82) return [0.68, 0.76, 0.86];
  if (z === 26) return [0.90, 0.46, 0.26];
  if (z === 29) return [0.92, 0.54, 0.30];
  if (z === 47) return [0.85, 0.88, 0.94];
  if (z === 79) return [0.98, 0.82, 0.28];
  if (z === 30) return [0.56, 0.62, 0.86];
  if (z === 2 || z === 10 || z === 18 || z === 36 || z === 54 || z === 86 || z === 118) return [0.36, 0.88, 0.96];
  return [0.72, 0.76, 0.86];
}

function visualRadiusBohrForZ(Z) {
  const z = Math.max(1, Math.min(118, Math.trunc(Number(Z) || 1)));
  if (z === 1) return 0.54;
  if (z <= 2) return 0.58;
  if (z <= 10) return 0.78;
  if (z <= 18) return 0.94;
  if (z <= 36) return 1.04;
  return 1.14;
}

export function createElementsLabWebGpuRenderer(device, canvas) {
  const ctx = canvas.getContext('webgpu');
  if (!ctx) {
    throw new Error('Failed to acquire WebGPU canvas context on #gpu-canvas');
  }
  const format = navigator.gpu.getPreferredCanvasFormat();
  const maxTexDim = Math.max(2048, Number(device.limits?.maxTextureDimension2D) || 4096);
  let configuredW = 0;
  let configuredH = 0;
  function configureCanvas(w, h) {
    const safeW = Math.max(64, Math.min(maxTexDim, Math.trunc(w)));
    const safeH = Math.max(64, Math.min(maxTexDim, Math.trunc(h)));
    canvas.width = safeW;
    canvas.height = safeH;
    const configs = [
      { device, format, alphaMode: 'opaque', usage: 0x10 | 0x01 },
      { device, format, alphaMode: 'opaque' },
      { device, format, alphaMode: 'premultiplied' }
    ];
    let configured = false;
    let lastErr = null;
    for (const cfg of configs) {
      try {
        ctx.configure(cfg);
        configured = true;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!configured && lastErr) throw lastErr;
    configuredW = safeW;
    configuredH = safeH;
  }
  const initRect = canvas.getBoundingClientRect();
  const initMobile = typeof window !== 'undefined' && (window.innerWidth < 1120 || window.matchMedia?.('(pointer: coarse)')?.matches);
  const initDpr = Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, initMobile ? 1.5 : 2.0);
  configureCanvas(
    Math.max(64, Math.round((initRect.width || canvas.clientWidth || 640) * initDpr)),
    Math.max(64, Math.round((initRect.height || canvas.clientHeight || 480) * initDpr))
  );

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

  const cloudUniformBuf = device.createBuffer({ size: 80, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const psUniformBuf = device.createBuffer({ size: 80, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const compNucPosBuf = device.createBuffer({ size: 256, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  const compNucMetaBuf = device.createBuffer({ size: 256, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });

  // 3D Spin-Lattice (sLLG) & Electron-Phonon Transport Pipelines
  const spinModule = device.createShaderModule({ code: SPIN_LATTICE_RENDER_WGSL, label: 'ulg-lab-spin-llg-render' });
  const spinPipe = device.createRenderPipeline({
    label: 'ulg-lab-spin-arrow-pipe',
    layout: 'auto',
    vertex: { module: spinModule, entryPoint: 'vs_spin_arrow' },
    fragment: { module: spinModule, entryPoint: 'fs_spin_arrow', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
  });
  const spinUniformBuf = device.createBuffer({ size: 48, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });

  const trModule = device.createShaderModule({ code: ELECTRON_TRANSPORT_RENDER_WGSL, label: 'ulg-lab-electron-tr-render' });
  const trIonPipe = device.createRenderPipeline({
    label: 'ulg-lab-tr-ions-pipe',
    layout: 'auto',
    vertex: { module: trModule, entryPoint: 'vs_phonon_ions' },
    fragment: { module: trModule, entryPoint: 'fs_tr_dot', targets: [{ format, blend: additiveBlend }] },
    primitive: { topology: 'triangle-list' }
  });
  const trCarrierPipe = device.createRenderPipeline({
    label: 'ulg-lab-tr-carriers-pipe',
    layout: 'auto',
    vertex: { module: trModule, entryPoint: 'vs_carriers' },
    fragment: { module: trModule, entryPoint: 'fs_tr_dot', targets: [{ format, blend: additiveBlend }] },
    primitive: { topology: 'triangle-list' }
  });
  const trUniformBuf = device.createBuffer({ size: 48, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });

  // Single-Atom 3D Maxwell-Kohn-Sham Volumetric Wavefield + Coupled Dirac-KS Cloud Pipelines
  const tdksModule = device.createShaderModule({ code: TDKS_PHOTON_CLOUD_WGSL, label: 'ulg-lab-tdks-photon-cloud' });
  const tdksFieldPipe = device.createRenderPipeline({
    label: 'ulg-lab-tdks-field-pipe',
    layout: 'auto',
    vertex: { module: tdksModule, entryPoint: 'vs_tdks_field' },
    fragment: { module: tdksModule, entryPoint: 'fs_tdks_field', targets: [{ format, blend: alphaBlend }] },
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

  // 3D Ball-and-Stick Molecule, Wiberg Bonds, Dipole Arrow & Multi-Species Crystal Pipelines
  const mol3dModule = device.createShaderModule({ code: MOLECULE_3D_WGSL, label: 'ulg-lab-mol-3d' });
  const molAtomPipe = device.createRenderPipeline({
    label: 'ulg-lab-mol-atom-pipe',
    layout: 'auto',
    vertex: { module: mol3dModule, entryPoint: 'vs_mol_atom' },
    fragment: { module: mol3dModule, entryPoint: 'fs_mol_atom', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
  });
  const molBondPipe = device.createRenderPipeline({
    label: 'ulg-lab-mol-bond-pipe',
    layout: 'auto',
    vertex: { module: mol3dModule, entryPoint: 'vs_mol_bond' },
    fragment: { module: mol3dModule, entryPoint: 'fs_mol_bond', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
  });
  const molBoxPipe = device.createRenderPipeline({
    label: 'ulg-lab-mol-box-pipe',
    layout: 'auto',
    vertex: { module: mol3dModule, entryPoint: 'vs_mol_box' },
    fragment: { module: mol3dModule, entryPoint: 'fs_mol_box', targets: [{ format, blend: alphaBlend }] },
    primitive: { topology: 'line-list' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less' }
  });
  const molUniformBuf = device.createBuffer({ size: 64, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  let molAtomsPosBuf = device.createBuffer({ size: 256 * 16, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  let molAtomsMetaBuf = device.createBuffer({ size: 256 * 16, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  let molSegABuf = device.createBuffer({ size: 512 * 16, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  let molSegBBuf = device.createBuffer({ size: 512 * 16, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  let molAtomCap = 256;
  let molSegCap = 512;

  // Zero-Copy 3D Reactive Chemistry MD Chamber Pipelines
  const rxMdModule = device.createShaderModule({ code: REACTIVE_MD_RENDER_WGSL, label: 'ulg-lab-reactive-md-render' });
  const rxMolPipe = device.createRenderPipeline({
    label: 'ulg-lab-rx-mol-pipe',
    layout: 'auto',
    vertex: { module: rxMdModule, entryPoint: 'vs_rx_mol' },
    fragment: { module: rxMdModule, entryPoint: 'fs_rx_mol', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
  });
  const rxBoxPipe = device.createRenderPipeline({
    label: 'ulg-lab-rx-box-pipe',
    layout: 'auto',
    vertex: { module: rxMdModule, entryPoint: 'vs_rx_box' },
    fragment: { module: rxMdModule, entryPoint: 'fs_rx_box', targets: [{ format, blend: alphaBlend }] },
    primitive: { topology: 'line-list' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less' }
  });
  const rxUniformBuf = device.createBuffer({ size: 32, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });

  // True 3D Convex Polytope Surface + Axis Cage + Residual Heatmap Pipelines
  const poly3dModule = device.createShaderModule({ code: POLYTOPE_3D_SURFACE_WGSL, label: 'ulg-lab-polytope-3d' });
  const poly3dMeshPipe = device.createRenderPipeline({
    label: 'ulg-lab-poly3d-mesh-pipe',
    layout: 'auto',
    vertex: { module: poly3dModule, entryPoint: 'vs_poly3d_mesh' },
    fragment: { module: poly3dModule, entryPoint: 'fs_poly3d_mesh', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
  });
  const poly3dLinePipe = device.createRenderPipeline({
    label: 'ulg-lab-poly3d-lines-pipe',
    layout: 'auto',
    vertex: { module: poly3dModule, entryPoint: 'vs_poly3d_lines' },
    fragment: { module: poly3dModule, entryPoint: 'fs_poly3d_lines', targets: [{ format, blend: alphaBlend }] },
    primitive: { topology: 'line-list' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less' }
  });
  const polyResPipe = device.createRenderPipeline({
    label: 'ulg-lab-poly-residual-pipe',
    layout: 'auto',
    vertex: { module: poly3dModule, entryPoint: 'vs_poly_residual' },
    fragment: { module: poly3dModule, entryPoint: 'fs_poly_residual', targets: [{ format }] },
    primitive: { topology: 'triangle-list' }
  });
  const poly3dUniformBuf = device.createBuffer({ size: 80, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });

  // Reusable uniforms & dummy placeholder buffers
  const volUniformBuf = device.createBuffer({ size: 48, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const atomUniformBuf = device.createBuffer({ size: 80, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const refWireUniformBuf = device.createBuffer({ size: 80, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
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
    if (rect.width < 2 || rect.height < 2) {
      return { w: configuredW || 320, h: configuredH || 240 };
    }
    const isMobileVp = typeof window !== 'undefined' && (window.innerWidth < 1120 || window.matchMedia?.('(pointer: coarse)')?.matches);
    const dpr = Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, isMobileVp ? 1.5 : 2.0);
    const w = Math.max(64, Math.min(maxTexDim, Math.round(rect.width * dpr)));
    const h = Math.max(64, Math.min(maxTexDim, Math.round(rect.height * dpr)));
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
   * Zero-copy WebGPU instanced MD renderer: reads `positionsBuffer`,
   * `velocitiesBuffer`, and `forcesBuffer` DIRECTLY from `liveMdSession` on the GPU!
   */
  function renderLiveMd({
    positionsBuffer,
    velocitiesBuffer,
    forcesBuffer = null,
    atomCount,
    boxLengthsA,
    initBoxLengthsA = null,
    rNearestNeighborA = null,
    meltingPointK = 600,
    cohesiveEnergyEv = 1.5,
    colorMode = 0,
    gravityEnabled = false,
    yaw = 0.45,
    pitch = 0.32,
    camDist = 3.25,
    tint = [0.65, 0.80, 0.96]
  }) {
    if (!positionsBuffer || !velocitiesBuffer || !(atomCount > 0)) return;
    const { w, h } = ensureCanvasSize();
    const lx = Number(boxLengthsA?.[0] || 10);
    const ly = Number(boxLengthsA?.[1] || lx);
    const lz = Number(boxLengthsA?.[2] || lx);
    const rlx = Number(initBoxLengthsA?.[0] || lx);
    const rly = Number(initBoxLengthsA?.[1] || ly);
    const rlz = Number(initBoxLengthsA?.[2] || lz);
    const minL = Math.min(lx, ly, lz);
    const atomRadA = Number.isFinite(Number(rNearestNeighborA)) && Number(rNearestNeighborA) > 0.8
      ? Math.max(0.65, Math.min(2.6, 0.43 * Number(rNearestNeighborA)))
      : Math.max(0.65, minL * (0.48 / Math.cbrt(Math.max(8, atomCount))));
    const effCamDist = Math.max(1.75, Math.min(6.4, Number(camDist) || 3.25));
    const safeTm = Math.max(25, Number(meltingPointK) || 600);
    const safeEcoh = Math.max(0.08, Number(cohesiveEnergyEv) || 1.5);
    const gravFlag = gravityEnabled ? 1.0 : 0.0;

    const uData = new Float32Array([
      w, h, yaw, pitch,
      lx, ly, lz, atomRadA,
      rlx, rly, rlz, effCamDist,
      tint[0] ?? 0.65, tint[1] ?? 0.80, tint[2] ?? 0.96, safeTm,
      Number(colorMode) || 0, safeEcoh, 0.0, gravFlag
    ]);
    device.queue.writeBuffer(atomUniformBuf, 0, uData);

    const volRatio = (lx * ly * lz) / Math.max(1e-6, rlx * rly * rlz);
    const showRefWire = Math.abs(volRatio - 1.0) > 0.025;
    if (showRefWire) {
      const refData = new Float32Array(uData);
      refData[18] = 1.0; // wireMode = 1 (initial V0 gold ghost wireframe)
      device.queue.writeBuffer(refWireUniformBuf, 0, refData);
    }

    const atomBg = device.createBindGroup({
      layout: atomPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: atomUniformBuf } },
        { binding: 1, resource: { buffer: positionsBuffer } },
        { binding: 2, resource: { buffer: velocitiesBuffer } },
        { binding: 3, resource: { buffer: forcesBuffer || velocitiesBuffer } }
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
    pass.draw(gravityEnabled ? 48 : 24, 1);

    if (showRefWire) {
      const refWireBg = device.createBindGroup({
        layout: wirePipe.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: refWireUniformBuf } }]
      });
      pass.setBindGroup(0, refWireBg);
      pass.draw(24, 1);
    }

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
    showNucleus = true,
    starkMixLambda = 0.0,
    eFieldNorm = 0.0
  }) {
    if (!pointsBuffer || !(pointCount > 0)) return;
    const { w, h } = ensureCanvasSize();
    device.queue.writeBuffer(cloudUniformBuf, 0, new Float32Array([
      w, h, yaw, pitch,
      camDist, pointSize, opacity, alternateShellColors ? 1.0 : 0.0,
      colorA[0] ?? 1.0, colorA[1] ?? 1.0, colorA[2] ?? 1.0, showGuides ? 1.0 : 0.0,
      colorB[0] ?? 0.38, colorB[1] ?? 0.17, colorB[2] ?? 0.87, 0.018,
      starkMixLambda, eFieldNorm, 0.0, 0.0
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
   * Render Single-Atom True 3D Self-Consistent Maxwell–Kohn–Sham Wavepacket
   * Scattering & Dynamically Coupled 180K-Point Dirac–KS Electron Cloud (ZERO-COPY!).
   */
  function renderTdksPhotonCloudScene({
    pairCloud,
    blochSession,
    tdks3dSession = null,
    yaw = 0.24,
    pitch = 0.20,
    camDist = 3.15,
    modeMono = false,
    polMode = 0,
    fieldViewMode = 0,
    probeRgb = [0.35, 0.55, 1.0],
    emergentReflSrgb = [0.94, 0.86, 0.65],
    pointSize = 0.012
  }) {
    if (!pairCloud?.posBuffer || !pairCloud?.ampBuffer || !blochSession) return;
    const { w, h } = ensureCanvasSize();

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

    const gridN = tdks3dSession?.gridN || 1;
    const worldHalf = tdks3dSession?.worldHalf || 2.0;
    const atomRadius = tdks3dSession?.atomRadius || 1.05;
    const eTotBuf = tdks3dSession?.eFieldBuffer || dummyVec4Buf;
    const eIncBuf = tdks3dSession?.eIncBuffer || dummyVec4Buf;
    const polBuf = tdks3dSession?.polBuffer || dummyVec4Buf;
    const jBuf = tdks3dSession?.jBuffer || dummyVec4Buf;

    device.queue.writeBuffer(tdksUniformBuf, 0, new Float32Array([
      w, h, yaw, pitch,
      camDist, gridN, worldHalf, fieldViewMode,
      rho00, rho11, twoRe01, eNow,
      polMode, modeMono ? 1.0 : 0.0, blochSession.getTimeFs(), pointSize,
      emergentReflSrgb[0] ?? 0.9, emergentReflSrgb[1] ?? 0.85, emergentReflSrgb[2] ?? 0.7, chB.rho11,
      probeRgb[0] ?? 0.35, probeRgb[1] ?? 0.55, probeRgb[2] ?? 1.0, atomRadius
    ]));

    const fieldBg = device.createBindGroup({
      layout: tdksFieldPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: tdksUniformBuf } },
        { binding: 3, resource: { buffer: eTotBuf } },
        { binding: 4, resource: { buffer: eIncBuf } },
        { binding: 5, resource: { buffer: polBuf } },
        { binding: 6, resource: { buffer: jBuf } }
      ]
    });
    const cloudBg = device.createBindGroup({
      layout: tdksCloudPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: tdksUniformBuf } },
        { binding: 1, resource: { buffer: pairCloud.posBuffer } },
        { binding: 2, resource: { buffer: pairCloud.ampBuffer } },
        { binding: 3, resource: { buffer: eTotBuf } },
        { binding: 4, resource: { buffer: eIncBuf } },
        { binding: 5, resource: { buffer: polBuf } },
        { binding: 6, resource: { buffer: jBuf } }
      ]
    });

    const enc = device.createCommandEncoder({ label: 'ulg-lab-render-tdks' });
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.006, g: 0.010, b: 0.022, a: 1 }
      }]
    });
    if (tdks3dSession) {
      pass.setPipeline(tdksFieldPipe);
      pass.setBindGroup(0, fieldBg);
      pass.draw(3);
    }

    pass.setPipeline(tdksCloudPipe);
    pass.setBindGroup(0, cloudBg);
    pass.draw(6, pairCloud.pointCount);
    pass.end();
    device.queue.submit([enc.finish()]);
  }

  /**
   * Render 3D WebGPU Stochastic LLG Spin-Lattice Magnetic Arrows ZERO-COPY!
   */
  function renderSpinLatticeScene({
    spinsBuffer,
    dims = [10, 10, 10],
    yaw = 0.48,
    pitch = 0.32,
    camDist = 3.1,
    fieldBZTesla = 0.0,
    isAntiferro = false
  }) {
    if (!spinsBuffer) return;
    const { w, h } = ensureCanvasSize();
    const [nx, ny, nz] = dims;
    const arrowScale = 1.65 / Math.max(nx, ny, nz);
    device.queue.writeBuffer(spinUniformBuf, 0, new Float32Array([
      w, h, yaw, pitch,
      nx, ny, nz, camDist,
      fieldBZTesla, isAntiferro ? 1.0 : 0.0, arrowScale, 0.0
    ]));
    const bg = device.createBindGroup({
      layout: spinPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: spinUniformBuf } },
        { binding: 1, resource: { buffer: spinsBuffer } }
      ]
    });
    const enc = device.createCommandEncoder({ label: 'ulg-lab-render-spins' });
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.014, g: 0.022, b: 0.044, a: 1 }
      }],
      depthStencilAttachment: {
        view: depthTex.createView(),
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
        depthClearValue: 1.0
      }
    });
    pass.setPipeline(spinPipe);
    pass.setBindGroup(0, bg);
    pass.draw(9, nx * ny * nz + 1);
    pass.end();
    device.queue.submit([enc.finish()]);
  }

  /**
   * Render 3D WebGPU Drude-Boltzmann Electron-Phonon & Superconducting Transport ZERO-COPY!
   */
  function renderElectronTransportScene({
    posBuffer,
    velBuffer,
    carrierCount = 1024,
    yaw = 0.42,
    pitch = 0.28,
    camDist = 2.95,
    eFieldVPerM = 1e4,
    phononVibAmp = 0.03,
    timeS = 0,
    isSuperconducting = false
  }) {
    if (!posBuffer || !velBuffer || !(carrierCount > 0)) return;
    const { w, h } = ensureCanvasSize();
    device.queue.writeBuffer(trUniformBuf, 0, new Float32Array([
      w, h, yaw, pitch,
      camDist, phononVibAmp, timeS, isSuperconducting ? 1.0 : 0.0,
      eFieldVPerM / 1e4, carrierCount, 0.0, 0.0
    ]));
    const ionBg = device.createBindGroup({
      layout: trIonPipe.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: trUniformBuf } }]
    });
    const carBg = device.createBindGroup({
      layout: trCarrierPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: trUniformBuf } },
        { binding: 1, resource: { buffer: posBuffer } },
        { binding: 2, resource: { buffer: velBuffer } }
      ]
    });
    const enc = device.createCommandEncoder({ label: 'ulg-lab-render-transport' });
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: isSuperconducting
          ? { r: 0.012, g: 0.020, b: 0.056, a: 1 }
          : { r: 0.010, g: 0.016, b: 0.034, a: 1 }
      }]
    });
    pass.setPipeline(trIonPipe);
    pass.setBindGroup(0, ionBg);
    pass.draw(6, 64);
    pass.setPipeline(trCarrierPipe);
    pass.setBindGroup(0, carBg);
    pass.draw(6, carrierCount);
    pass.end();
    device.queue.submit([enc.finish()]);
  }

  function ensureMolBuffers(atomCount, segCount) {
    const needA = Math.max(16, atomCount);
    if (needA > molAtomCap) {
      molAtomCap = Math.max(needA, molAtomCap * 2);
      molAtomsPosBuf.destroy();
      molAtomsMetaBuf.destroy();
      molAtomsPosBuf = device.createBuffer({ size: molAtomCap * 16, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
      molAtomsMetaBuf = device.createBuffer({ size: molAtomCap * 16, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
    }
    const needS = Math.max(16, segCount);
    if (needS > molSegCap) {
      molSegCap = Math.max(needS, molSegCap * 2);
      molSegABuf.destroy();
      molSegBBuf.destroy();
      molSegABuf = device.createBuffer({ size: molSegCap * 16, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
      molSegBBuf = device.createBuffer({ size: molSegCap * 16, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
    }
  }

  function renderMoleculeScene({
    atoms = [],
    bonds = [],
    mullikenCharges = null,
    dipoleVecDebye = null,
    displacements = null,
    vibPhase = 0,
    vibAmplitude = 0.28,
    colorMode = 0,
    showDipole = true,
    orbitalCloud = null,
    yaw = 0.45,
    pitch = 0.28,
    camDist = 3.1,
    timeS = 0
  }) {
    if (!Array.isArray(atoms) || atoms.length === 0) return;
    const { w, h } = ensureCanvasSize();
    const nA = atoms.length;
    const vibSin = displacements ? Math.sin(vibPhase) * vibAmplitude : 0;
    const posList = atoms.map((a, i) => {
      const bx = Array.isArray(a.position) ? a.position[0] : (a.x || 0);
      const by = Array.isArray(a.position) ? a.position[1] : (a.y || 0);
      const bz = Array.isArray(a.position) ? a.position[2] : (a.z || 0);
      const d = displacements?.[i];
      return [
        bx + (d ? d[0] * vibSin : 0),
        by + (d ? d[1] * vibSin : 0),
        bz + (d ? d[2] * vibSin : 0)
      ];
    });
    let cx = 0; let cy = 0; let cz = 0;
    for (const p of posList) { cx += p[0]; cy += p[1]; cz += p[2]; }
    cx /= nA; cy /= nA; cz /= nA;

    let maxExtent = 1.65;
    for (let i = 0; i < nA; i += 1) {
      const p = posList[i];
      maxExtent = Math.max(maxExtent, Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz) + visualRadiusBohrForZ(atoms[i].Z));
    }
    const scaleNorm = 1.25 / maxExtent;

    const segs = [];
    for (const b of (bonds || [])) {
      const pa = posList[b.a];
      const pb = posList[b.b];
      if (!pa || !pb) continue;
      const dx = pb[0] - pa[0]; const dy = pb[1] - pa[1]; const dz = pb[2] - pa[2];
      const len = Math.hypot(dx, dy, dz);
      if (len < 1e-4) continue;
      const ux = dx / len; const uy = dy / len; const uz = dz / len;
      // Prefer Z-cross so horizontal bonds (e.g. O=C=O along X) stack double/triple bars cleanly vertically!
      const ref = Math.abs(uz) < 0.85 ? [0, 0, 1] : [0, 1, 0];
      let px = uy * ref[2] - uz * ref[1];
      let py = uz * ref[0] - ux * ref[2];
      let pz = ux * ref[1] - uy * ref[0];
      const pl = Math.max(1e-5, Math.hypot(px, py, pz));
      px /= pl; py /= pl; pz /= pl;

      const ord = Math.max(0.16, Math.min(3.5, Number(b.order) || 1.0));
      const kind = b.kind || (ord >= 2.45 ? 'triple' : (ord >= 1.55 ? 'double' : (ord >= 0.60 ? 'single' : 'partial')));
      const ordFrac = Math.min(0.99, ord / 4.0);
      if (kind === 'partial') {
        segs.push({ a: pa, b: pb, r: 0.11 + 0.08 * ord, modeOrder: 1.0 + ordFrac });
      } else if (kind === 'double') {
        const off = 0.16;
        for (const sgn of [-1, 1]) {
          segs.push({
            a: [pa[0] + px * off * sgn, pa[1] + py * off * sgn, pa[2] + pz * off * sgn],
            b: [pb[0] + px * off * sgn, pb[1] + py * off * sgn, pb[2] + pz * off * sgn],
            r: 0.11,
            modeOrder: 0.0 + ordFrac
          });
        }
      } else if (kind === 'triple') {
        const off = 0.20;
        for (const sgn of [-1, 0, 1]) {
          segs.push({
            a: [pa[0] + px * off * sgn, pa[1] + py * off * sgn, pa[2] + pz * off * sgn],
            b: [pb[0] + px * off * sgn, pb[1] + py * off * sgn, pb[2] + pz * off * sgn],
            r: 0.095,
            modeOrder: 0.0 + ordFrac
          });
        }
      } else {
        segs.push({ a: pa, b: pb, r: 0.15, modeOrder: 0.0 + ordFrac });
      }
    }

    if (showDipole && Array.isArray(dipoleVecDebye) && dipoleVecDebye.length === 3) {
      const dMag = Math.hypot(dipoleVecDebye[0], dipoleVecDebye[1], dipoleVecDebye[2]);
      if (dMag > 0.08) {
        const arrowLen = Math.min(maxExtent * 0.95, 0.7 + dMag * 0.36);
        const ux = dipoleVecDebye[0] / dMag;
        const uy = dipoleVecDebye[1] / dMag;
        const uz = dipoleVecDebye[2] / dMag;
        const tail = [cx - ux * arrowLen * 0.45, cy - uy * arrowLen * 0.45, cz - uz * arrowLen * 0.45];
        const mid = [cx + ux * arrowLen * 0.35, cy + uy * arrowLen * 0.35, cz + uz * arrowLen * 0.35];
        const tip = [cx + ux * arrowLen * 0.72, cy + uy * arrowLen * 0.72, cz + uz * arrowLen * 0.72];
        segs.push({ a: tail, b: mid, r: 0.09, modeOrder: 2.25 });
        segs.push({ a: mid, b: tip, r: 0.24, modeOrder: 3.25 });
      }
    }

    ensureMolBuffers(nA, Math.max(1, segs.length));
    const aPos = new Float32Array(nA * 4);
    const aMeta = new Float32Array(nA * 4);
    for (let i = 0; i < nA; i += 1) {
      const p = posList[i];
      const cpk = cpkColorForZ(atoms[i].Z);
      const q = Array.isArray(mullikenCharges) ? (Number(mullikenCharges[i]) || 0) : 0;
      aPos.set([p[0], p[1], p[2], visualRadiusBohrForZ(atoms[i].Z)], i * 4);
      aMeta.set([cpk[0], cpk[1], cpk[2], q], i * 4);
    }
    const sA = new Float32Array(Math.max(1, segs.length) * 4);
    const sB = new Float32Array(Math.max(1, segs.length) * 4);
    for (let i = 0; i < segs.length; i += 1) {
      const sg = segs[i];
      sA.set([sg.a[0], sg.a[1], sg.a[2], sg.r], i * 4);
      sB.set([sg.b[0], sg.b[1], sg.b[2], sg.modeOrder], i * 4);
    }

    device.queue.writeBuffer(molUniformBuf, 0, new Float32Array([
      w, h, yaw, pitch,
      camDist, scaleNorm, colorMode, timeS,
      cx, cy, cz, 0.0,
      maxExtent, maxExtent, maxExtent, 0.0
    ]));
    device.queue.writeBuffer(molAtomsPosBuf, 0, aPos);
    device.queue.writeBuffer(molAtomsMetaBuf, 0, aMeta);
    device.queue.writeBuffer(molSegABuf, 0, sA);
    device.queue.writeBuffer(molSegBBuf, 0, sB);

    const atomBg = device.createBindGroup({
      layout: molAtomPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: molUniformBuf } },
        { binding: 1, resource: { buffer: molAtomsPosBuf } },
        { binding: 2, resource: { buffer: molAtomsMetaBuf } }
      ]
    });
    const bondBg = segs.length > 0
      ? device.createBindGroup({
        layout: molBondPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: molUniformBuf } },
          { binding: 3, resource: { buffer: molSegABuf } },
          { binding: 4, resource: { buffer: molSegBBuf } }
        ]
      })
      : null;

    const enc = device.createCommandEncoder({ label: 'ulg-lab-render-mol3d' });
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.012, g: 0.020, b: 0.040, a: 1 }
      }],
      depthStencilAttachment: {
        view: depthTex.createView(),
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
        depthClearValue: 1.0
      }
    });
    if (bondBg) {
      pass.setPipeline(molBondPipe);
      pass.setBindGroup(0, bondBg);
      pass.draw(6, segs.length);
    }
    pass.setPipeline(molAtomPipe);
    pass.setBindGroup(0, atomBg);
    pass.draw(6, nA);
    pass.end();

    if (orbitalCloud?.pointsBuffer && orbitalCloud.pointCount > 0) {
      device.queue.writeBuffer(cloudUniformBuf, 0, new Float32Array([
        w, h, yaw, pitch,
        camDist, 0.013, 0.24, 1.0,
        1.0, 0.64, 0.30, 0.0,
        0.38, 0.72, 1.0, 0.014,
        0.0, 0.0, 0.0, 0.0
      ]));
      const cloudBg = device.createBindGroup({
        layout: cloudPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: cloudUniformBuf } },
          { binding: 1, resource: { buffer: orbitalCloud.pointsBuffer } }
        ]
      });
      const oPass = enc.beginRenderPass({
        colorAttachments: [{
          view: ctx.getCurrentTexture().createView(),
          loadOp: 'load',
          storeOp: 'store'
        }]
      });
      oPass.setPipeline(cloudPipe);
      oPass.setBindGroup(0, cloudBg);
      oPass.draw(6, orbitalCloud.pointCount);
      oPass.end();
    }
    device.queue.submit([enc.finish()]);
  }

  function renderMultiSpeciesCrystalScene({
    crystal,
    colorMode = 0,
    yaw = 0.48,
    pitch = 0.30,
    camDist = 3.25
  }) {
    if (!crystal?.positions || !(crystal.atomCount > 0)) return;
    const { w, h } = ensureCanvasSize();
    const nA = crystal.atomCount;
    const nB = crystal.bondCount || 0;
    const lx = crystal.boxLengthsA?.[0] || 8;
    const ly = crystal.boxLengthsA?.[1] || lx;
    const lz = crystal.boxLengthsA?.[2] || lx;
    const cx = lx * 0.5; const cy = ly * 0.5; const cz = lz * 0.5;
    const maxHalf = Math.max(lx, ly, lz) * 0.5;
    const scaleNorm = 1.05 / Math.max(1.0, maxHalf);

    ensureMolBuffers(nA, Math.max(1, nB));
    const aPos = new Float32Array(nA * 4);
    const aMeta = new Float32Array(nA * 4);
    for (let i = 0; i < nA; i += 1) {
      const px = crystal.positions[i * 4 + 0];
      const py = crystal.positions[i * 4 + 1];
      const pz = crystal.positions[i * 4 + 2];
      const rA = crystal.positions[i * 4 + 3];
      const Z = crystal.speciesMeta[i * 4 + 0];
      const q = crystal.speciesMeta[i * 4 + 1];
      const cpk = cpkColorForZ(Z);
      aPos.set([px, py, pz, Math.max(0.28, Math.min(0.68, rA * 0.42))], i * 4);
      aMeta.set([cpk[0], cpk[1], cpk[2], q * 0.55], i * 4);
    }
    const sA = new Float32Array(Math.max(1, nB) * 4);
    const sB = new Float32Array(Math.max(1, nB) * 4);
    for (let i = 0; i < nB; i += 1) {
      const ia = crystal.bonds[i * 2 + 0];
      const ib = crystal.bonds[i * 2 + 1];
      sA.set([crystal.positions[ia * 4], crystal.positions[ia * 4 + 1], crystal.positions[ia * 4 + 2], 0.11], i * 4);
      sB.set([crystal.positions[ib * 4], crystal.positions[ib * 4 + 1], crystal.positions[ib * 4 + 2], 0.25], i * 4);
    }

    device.queue.writeBuffer(molUniformBuf, 0, new Float32Array([
      w, h, yaw, pitch,
      camDist, scaleNorm, colorMode, 0.0,
      cx, cy, cz, 1.0,
      lx * 0.5, ly * 0.5, lz * 0.5, 0.0
    ]));
    device.queue.writeBuffer(molAtomsPosBuf, 0, aPos);
    device.queue.writeBuffer(molAtomsMetaBuf, 0, aMeta);
    device.queue.writeBuffer(molSegABuf, 0, sA);
    device.queue.writeBuffer(molSegBBuf, 0, sB);

    const atomBg = device.createBindGroup({
      layout: molAtomPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: molUniformBuf } },
        { binding: 1, resource: { buffer: molAtomsPosBuf } },
        { binding: 2, resource: { buffer: molAtomsMetaBuf } }
      ]
    });
    const bondBg = nB > 0
      ? device.createBindGroup({
        layout: molBondPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: molUniformBuf } },
          { binding: 3, resource: { buffer: molSegABuf } },
          { binding: 4, resource: { buffer: molSegBBuf } }
        ]
      })
      : null;
    const boxBg = device.createBindGroup({
      layout: molBoxPipe.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: molUniformBuf } }]
    });

    const enc = device.createCommandEncoder({ label: 'ulg-lab-render-multispecies-crystal' });
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.012, g: 0.020, b: 0.042, a: 1 }
      }],
      depthStencilAttachment: {
        view: depthTex.createView(),
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
        depthClearValue: 1.0
      }
    });
    if (bondBg) {
      pass.setPipeline(molBondPipe);
      pass.setBindGroup(0, bondBg);
      pass.draw(6, nB);
    }
    pass.setPipeline(molAtomPipe);
    pass.setBindGroup(0, atomBg);
    pass.draw(6, nA);
    pass.setPipeline(molBoxPipe);
    pass.setBindGroup(0, boxBg);
    pass.draw(24, 1);
    pass.end();
    device.queue.submit([enc.finish()]);
  }

  function renderReactiveMdScene({
    posBuffer,
    velBuffer,
    moleculeCount = 192,
    yaw = 0.45,
    pitch = 0.28,
    camDist = 3.15
  }) {
    if (!posBuffer || !velBuffer || !(moleculeCount > 0)) return;
    const { w, h } = ensureCanvasSize();
    device.queue.writeBuffer(rxUniformBuf, 0, new Float32Array([
      w, h, yaw, pitch,
      camDist, 0.078, 1.0, 0.0
    ]));
    const molBg = device.createBindGroup({
      layout: rxMolPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: rxUniformBuf } },
        { binding: 1, resource: { buffer: posBuffer } },
        { binding: 2, resource: { buffer: velBuffer } }
      ]
    });
    const boxBg = device.createBindGroup({
      layout: rxBoxPipe.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: rxUniformBuf } }]
    });
    const enc = device.createCommandEncoder({ label: 'ulg-lab-render-reactive-md' });
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.012, g: 0.018, b: 0.036, a: 1 }
      }],
      depthStencilAttachment: {
        view: depthTex.createView(),
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
        depthClearValue: 1.0
      }
    });
    pass.setPipeline(rxMolPipe);
    pass.setBindGroup(0, molBg);
    pass.draw(6, moleculeCount);
    pass.setPipeline(rxBoxPipe);
    pass.setBindGroup(0, boxBg);
    pass.draw(24, 1);
    pass.end();
    device.queue.submit([enc.finish()]);
  }

  function renderPolytopeAtlas3D({
    atlas,
    viewMode = '3d-surface',
    probe = null,
    mdTempK = null,
    yaw = 0.62,
    pitch = 0.56,
    camDist = 3.25,
    showFacetEdges = true
  }) {
    if (!atlas?.packedGpuAtlas?.data || !atlas?.polytopes?.length) return;
    if (viewMode === '2d-facets') {
      renderPolytopeAtlas(atlas, probe);
      return;
    }
    const { w, h } = ensureCanvasSize();
    const polyBuf = ensurePolytopeBuffer(atlas);
    const { minLt, maxLt, minLp, maxLp } = getPolytopeAxisBounds(atlas);
    const probeActive = probe && Number.isFinite(probe.fx) && Number.isFinite(probe.fy) ? 1.0 : 0.0;
    const mdActive = Number.isFinite(mdTempK) && mdTempK > 0 ? 1.0 : 0.0;
    const mdFx = mdActive > 0.5
      ? Math.max(0, Math.min(1, (Math.log10(Math.max(1, mdTempK)) - minLt) / Math.max(1e-6, maxLt - minLt)))
      : 0.5;
    const mdFy = Math.max(0, Math.min(1, (Math.log10(101325) - minLp) / Math.max(1e-6, maxLp - minLp)));
    const gridN = 68;

    device.queue.writeBuffer(poly3dUniformBuf, 0, new Float32Array([
      w, h, yaw, pitch,
      minLt, maxLt, minLp, maxLp,
      -2.2, 4.4, camDist, gridN,
      probeActive > 0.5 ? probe.fx : -1.0, probeActive > 0.5 ? probe.fy : -1.0, probeActive, viewMode === 'residual-map' ? 2.0 : 0.0,
      mdFx, mdFy, mdActive, showFacetEdges ? 1.0 : 0.0
    ]));

    if (viewMode === 'residual-map') {
      const bg = device.createBindGroup({
        layout: polyResPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: poly3dUniformBuf } },
          { binding: 1, resource: { buffer: polyBuf } }
        ]
      });
      const enc = device.createCommandEncoder({ label: 'ulg-lab-render-poly-res' });
      const pass = enc.beginRenderPass({
        colorAttachments: [{
          view: ctx.getCurrentTexture().createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0.02, g: 0.035, b: 0.067, a: 1 }
        }]
      });
      pass.setPipeline(polyResPipe);
      pass.setBindGroup(0, bg);
      pass.draw(3);
      pass.end();
      device.queue.submit([enc.finish()]);
      return;
    }

    const meshBg = device.createBindGroup({
      layout: poly3dMeshPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: poly3dUniformBuf } },
        { binding: 1, resource: { buffer: polyBuf } }
      ]
    });
    const lineBg = device.createBindGroup({
      layout: poly3dLinePipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: poly3dUniformBuf } },
        { binding: 1, resource: { buffer: polyBuf } }
      ]
    });

    const enc = device.createCommandEncoder({ label: 'ulg-lab-render-poly3d' });
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.012, g: 0.020, b: 0.042, a: 1 }
      }],
      depthStencilAttachment: {
        view: depthTex.createView(),
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
        depthClearValue: 1.0
      }
    });
    pass.setPipeline(poly3dMeshPipe);
    pass.setBindGroup(0, meshBg);
    pass.draw(gridN * gridN * 6);

    pass.setPipeline(poly3dLinePipe);
    pass.setBindGroup(0, lineBg);
    pass.draw(46);
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
    renderSpinLatticeScene,
    renderElectronTransportScene,
    renderMoleculeScene,
    renderMultiSpeciesCrystalScene,
    renderReactiveMdScene,
    renderLiveMd,
    renderStaticCrystalLattice,
    renderPolytopeAtlas,
    renderPolytopeAtlas3D,
    probePolytopeAtlasOnGpu,
    getPolytopeAxisBounds
  });
}
