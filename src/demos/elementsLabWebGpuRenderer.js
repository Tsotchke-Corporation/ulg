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
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080,
  COPY_DST: 0x0008
});

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
  if (eval_res.w < 0.5) {
    // Fail-closed outside-domain hatching
    let hatch = step(0.88, fract((in.uv.x + in.uv.y) * 28.0)) * 0.06;
    return vec4<f32>(vec3<f32>(0.04, 0.05, 0.08) + hatch, 1.0);
  }

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
  let col = base_col * iso_shade + vec3<f32>(contour) + vec3<f32>(0.95, 0.98, 1.0) * facet_edge;
  return vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
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

  // Reusable uniforms & dummy placeholder buffers
  const volUniformBuf = device.createBuffer({ size: 48, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const atomUniformBuf = device.createBuffer({ size: 48, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const polyUniformBuf = device.createBuffer({ size: 16, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
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

  /**
   * Live WebGPU Polytope Atlas shader evaluating packed `A x <= b` + Clenshaw
   * Chebyshev density contours directly on the GPU!
   */
  function renderPolytopeAtlas(atlas) {
    if (!atlas?.packedGpuAtlas?.data || !atlas?.polytopes?.length) return;
    ensureCanvasSize();
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

    const minLt = Math.log10(Math.max(1, Math.min(...atlas.polytopes.map((p) => p.axes[0].min))));
    const maxLt = Math.log10(Math.max(10, Math.max(...atlas.polytopes.map((p) => p.axes[0].max))));
    const minLp = Math.min(...atlas.polytopes.map((p) => Math.log10(p.axes[1].min)));
    const maxLp = Math.max(...atlas.polytopes.map((p) => Math.log10(p.axes[1].max)));
    device.queue.writeBuffer(polyUniformBuf, 0, new Float32Array([minLt, maxLt, minLp, maxLp]));

    const bg = device.createBindGroup({
      layout: polyPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: polyUniformBuf } },
        { binding: 1, resource: { buffer: cachedPolyBuf } }
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

  return Object.freeze({
    backend: 'webgpu',
    format,
    buildAtomicVolumeOnGpu,
    renderVolume3D,
    renderLiveMd,
    renderStaticCrystalLattice,
    renderPolytopeAtlas
  });
}
