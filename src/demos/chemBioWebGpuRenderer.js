// Shared Direct-WebGPU HDR Renderer for ULG Organic Chemistry & Emergent Biology Flagship Labs
// (`src/demos/chemBioWebGpuRenderer.js`).
//
// Zero Three.js, 1 queue.submit/frame, rgba16float HDR + ACES tonemapping + depth24plus!
// Directly renders zero-copy GPU buffers produced by ULG's 8 Organic & Biology law modules:
//   1. 64-byte OrgAtom lit ray-spheres (with continuous ESP partial-charge heatmap blend!)
//   2. 32-byte OrgBond dynamic covalent bond-order cylinders + glowing cyan H-bond beams!
//   3. 16-byte pi-MO volumetric orbital clouds (cyan + / rose-magenta - glowing lobes!)
//   4. 48-byte Biology beads (Amphiphile lipids, Biopolymer residues, Quasispecies replicators, Active agents!)
//   5. 3D Polymer Backbone tube links (connects consecutive residues i -> i+1 cleanly in 3D!)
//   6. 128x128 Spatial Field Renderer (Frank Chiral, BZ Spirals, Prebiotic RAF, Hodgkin-Huxley Voltage,
//      AND 3D displaced Turing Morphogenesis landscape with overlaid 3D chemotactic agents!)

import { configureCompatibleWebGpuCanvas } from '../runtime/shared/webgpuCompat.js';

const GPU_BUF = Object.freeze({
  COPY_DST: 0x0008,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

// ---- Minimal Exact 3D Camera Math ----
function normalize3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function cross3(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function mat4Mul(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0]
        + a[1 * 4 + r] * b[c * 4 + 1]
        + a[2 * 4 + r] * b[c * 4 + 2]
        + a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}
function buildPerspective(fovRad, aspect, near, far) {
  const f = 1.0 / Math.tan(fovRad * 0.5);
  const nf = 1.0 / (near - far);
  const m = new Float32Array(16);
  m[0] = f / Math.max(0.1, aspect);
  m[5] = f;
  m[10] = far * nf;
  m[11] = -1.0;
  m[14] = far * near * nf;
  return m;
}
function buildLookAt(eye, target, up) {
  const z = normalize3([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
  const x = normalize3(cross3(up, z));
  const y = cross3(z, x);
  const m = new Float32Array(16);
  m[0] = x[0]; m[4] = x[1]; m[8] = x[2]; m[12] = -dot3(x, eye);
  m[1] = y[0]; m[5] = y[1]; m[9] = y[2]; m[13] = -dot3(y, eye);
  m[2] = z[0]; m[6] = z[1]; m[10] = z[2]; m[14] = -dot3(z, eye);
  m[3] = 0; m[7] = 0; m[11] = 0; m[15] = 1;
  return { view: m, right: x, up: y, forward: [-z[0], -z[1], -z[2]] };
}

// =========================================================================
// WGSL Shaders (Strict: zero `meta` identifier, zero inverted `smoothstep`)
// =========================================================================

const COMMON_UNIFORMS_WGSL = /* wgsl */ `
struct RenderUniforms {
  view_proj: mat4x4<f32>,
  cam_pos_mode: vec4<f32>,   // xyz = camPos, w = renderStyle
  cam_right_esp: vec4<f32>,  // xyz = camRight, w = espBlend (0..1)
  cam_up_time: vec4<f32>,    // xyz = camUp, w = timeSec
  field_info: vec4<f32>,     // x = fieldMode, y = fieldW, z = fieldH, w = sphereScale
  extra_info: vec4<f32>,     // x = countA, y = countB, z = pointSize, w = bgStyle (0=org, 1=bio)
};
`;

const BACKDROP_WGSL = /* wgsl */ `
${COMMON_UNIFORMS_WGSL}
@group(0) @binding(0) var<uniform> u: RenderUniforms;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_bg(@builtin(vertex_index) vid: u32) -> VsOut {
  var p = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  var out: VsOut;
  out.pos = vec4<f32>(p[vid], 0.9999, 1.0);
  out.uv = p[vid] * 0.5 + 0.5;
  return out;
}

@fragment
fn fs_bg(in: VsOut) -> @location(0) vec4<f32> {
  let d = length(in.uv - vec2<f32>(0.5, 0.48));
  let vig = 1.0 - smoothstep(0.18, 1.05, d);
  let is_bio = u.extra_info.w > 0.5;
  let core = select(vec3<f32>(0.025, 0.048, 0.105), vec3<f32>(0.018, 0.062, 0.088), is_bio);
  let edge = select(vec3<f32>(0.008, 0.012, 0.024), vec3<f32>(0.006, 0.016, 0.024), is_bio);
  let grid = sin(in.uv.x * 62.83) * sin(in.uv.y * 62.83);
  let subtle = max(0.0, grid - 0.985) * 0.035;
  return vec4<f32>(mix(edge, core, vig) + vec3<f32>(subtle), 1.0);
}
`;

// 1. Organic Atoms (64-byte OrgAtom) Lit Ray-Sphere Billboard Pipeline
const ORG_ATOM_WGSL = /* wgsl */ `
${COMMON_UNIFORMS_WGSL}

struct OrgAtom {
  pos_m: vec4<f32>,
  vel_q: vec4<f32>,
  frc_r: vec4<f32>,
  vis_z: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: RenderUniforms;
@group(0) @binding(1) var<storage, read> atoms: array<OrgAtom>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec3<f32>,
  @location(2) charge: f32,
  @location(3) world_pos: vec3<f32>,
  @location(4) rad_w: f32,
};

struct FsOut {
  @location(0) color: vec4<f32>,
  @builtin(frag_depth) depth: f32,
};

fn esp_color(q: f32) -> vec3<f32> {
  let t = clamp(q * 2.2, -1.0, 1.0);
  if (t < 0.0) {
    return mix(vec3<f32>(0.88, 0.92, 0.96), vec3<f32>(1.0, 0.18, 0.22), -t);
  }
  return mix(vec3<f32>(0.88, 0.92, 0.96), vec3<f32>(0.16, 0.56, 1.0), t);
}

@vertex
fn vs_org_atom(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VsOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let qv = quad[vid];
  let a = atoms[iid];
  let rep_mode = u32(round(u.cam_pos_mode.w)); // 0=Ball&Stick, 1=Space-Fill CPK (Bondi vdW), 2=Licorice
  let base_rad = clamp(a.frc_r.w * 0.56 + 0.08, 0.22, 0.62);
  let vdw_rad = clamp(a.frc_r.w * 1.48 + 0.42, 0.92, 1.95);
  let lic_rad = 0.175;
  let rad = select(select(base_rad, vdw_rad, rep_mode == 1u), lic_rad, rep_mode == 2u) * u.field_info.w;
  let to_cam = normalize(u.cam_pos_mode.xyz - a.pos_m.xyz);
  let wpos = a.pos_m.xyz + to_cam * (rad * 0.35) + (u.cam_right_esp.xyz * qv.x + u.cam_up_time.xyz * qv.y) * (rad * 1.08);
  var out: VsOut;
  out.pos = u.view_proj * vec4<f32>(wpos, 1.0);
  out.local_uv = qv * 1.08;
  out.color = mix(a.vis_z.rgb, esp_color(a.vel_q.w), u.cam_right_esp.w);
  out.charge = a.vel_q.w;
  out.world_pos = a.pos_m.xyz;
  out.rad_w = rad;
  return out;
}

@fragment
fn fs_org_atom(in: VsOut) -> FsOut {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let nz = sqrt(max(0.0, 1.0 - r2));
  let n_view = normalize(vec3<f32>(in.local_uv.x, in.local_uv.y, nz));
  let to_cam = normalize(u.cam_pos_mode.xyz - in.world_pos);
  let p_surf = in.world_pos + (u.cam_right_esp.xyz * in.local_uv.x + u.cam_up_time.xyz * in.local_uv.y + to_cam * nz) * in.rad_w;
  let clip = u.view_proj * vec4<f32>(p_surf, 1.0);
  let l1 = normalize(vec3<f32>(0.55, 0.72, 0.58));
  let l2 = normalize(vec3<f32>(-0.65, -0.35, 0.55));
  let diff1 = max(dot(n_view, l1), 0.0);
  let diff2 = max(dot(n_view, l2), 0.0) * 0.35;
  let h1 = normalize(l1 + vec3<f32>(0.0, 0.0, 1.0));
  let spec = pow(max(dot(n_view, h1), 0.0), 46.0) * 0.92;
  let fres = pow(max(0.0, 1.0 - nz), 3.0) * 0.45;
  let rim_tint = select(vec3<f32>(0.38, 0.76, 1.0), vec3<f32>(1.0, 0.45, 0.32), in.charge < -0.18);
  let col = in.color * (0.24 + 0.94 * diff1 + diff2) + vec3<f32>(spec) + rim_tint * fres;
  var out: FsOut;
  out.color = vec4<f32>(col, 1.0);
  out.depth = clamp(clip.z / max(1e-5, clip.w), 0.0, 1.0);
  return out;
}
`;

// 2. Organic Dynamic Covalent Bonds + Dashed Cyan H-Bonds Pipeline
const ORG_BOND_WGSL = /* wgsl */ `
${COMMON_UNIFORMS_WGSL}

struct OrgAtom {
  pos_m: vec4<f32>,
  vel_q: vec4<f32>,
  frc_r: vec4<f32>,
  vis_z: vec4<f32>,
};

struct OrgBond {
  ab_ord: vec4<f32>,
  dyn: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: RenderUniforms;
@group(0) @binding(1) var<storage, read> atoms: array<OrgAtom>;
@group(0) @binding(2) var<storage, read> bonds: array<OrgBond>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) along_across: vec2<f32>,
  @location(1) color: vec3<f32>,
  @location(2) bond_info: vec2<f32>, // x = liveOrder, y = isHBond
};

@vertex
fn vs_org_bond(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VsOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(0.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 1.0)
  );
  let qv = quad[vid];
  let b = bonds[iid];
  let ia = u32(b.ab_ord.x + 0.5);
  let ib = u32(b.ab_ord.y + 0.5);
  let live_ord = b.dyn.x;
  let is_hb = b.dyn.w;
  var out: VsOut;
  let rep_mode = u32(round(u.cam_pos_mode.w));
  if (live_ord < 0.04 || (rep_mode == 1u && is_hb < 0.5)) {
    out.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    out.along_across = vec2<f32>(0.0);
    out.color = vec3<f32>(0.0);
    out.bond_info = vec2<f32>(0.0);
    return out;
  }

  let pa = atoms[ia].pos_m.xyz;
  let pb = atoms[ib].pos_m.xyz;
  let mid = mix(pa, pb, qv.x);
  let dir = pb - pa;
  let dlen = max(length(dir), 1e-4);
  let axis = dir / dlen;
  let view_dir = normalize(u.cam_pos_mode.xyz - mid);
  var side = cross(axis, view_dir);
  if (length(side) < 1e-4) { side = u.cam_right_esp.xyz; } else { side = normalize(side); }

  let cov_thick = select(0.085 + 0.065 * clamp(live_ord, 0.2, 2.5), 0.165, rep_mode == 2u);
  let base_thick = select(
    cov_thick,
    select(0.055, 0.045 + 0.055 * clamp(live_ord, 0.0, 1.0), is_hb > 1.5),
    is_hb > 0.5
  );
  let wpos = mid + side * (qv.y * base_thick * u.field_info.w);
  let ca = atoms[ia].vis_z.rgb;
  let cb = atoms[ib].vis_z.rgb;
  let cov_col = mix(mix(ca, cb, smoothstep(0.38, 0.62, qv.x)), vec3<f32>(0.76, 0.86, 0.98), 0.35);
  let pi_glow = select(vec3<f32>(0.0), vec3<f32>(0.18, 0.42, 0.55), live_ord > 1.32 && is_hb < 0.5);
  let nonbond_col = select(vec3<f32>(0.18, 0.96, 1.0), vec3<f32>(1.0, 0.72, 0.18) * (0.55 + 0.85 * clamp(live_ord, 0.0, 1.0)), is_hb > 1.5);

  out.pos = u.view_proj * vec4<f32>(wpos, 1.0);
  out.along_across = qv;
  out.color = select(cov_col + pi_glow, nonbond_col, is_hb > 0.5);
  out.bond_info = vec2<f32>(live_ord, is_hb);
  return out;
}

@fragment
fn fs_org_bond(in: VsOut) -> @location(0) vec4<f32> {
  let across = in.along_across.y;
  let cy = sqrt(max(0.0, 1.0 - across * across));
  if (in.bond_info.y > 1.5) {
    // Live GPU van der Waals / steric bearing-race force bridge (dashed warm gold pulses!)
    let dash = sin(in.along_across.x * 28.0 - u.cam_up_time.w * 5.0);
    if (dash < -0.15) { discard; }
    let pulse = clamp(in.bond_info.x, 0.0, 1.0);
    return vec4<f32>(in.color * (0.65 + 0.85 * cy), 0.72 * pulse);
  }
  if (in.bond_info.y > 0.5) {
    // Dashed glowing cyan H-bond beam
    let dash = sin(in.along_across.x * 36.0 - u.cam_up_time.w * 4.0);
    if (dash < 0.0) { discard; }
    return vec4<f32>(in.color * (0.7 + 0.8 * cy), 0.92);
  }
  // Subtle double/aromatic dual-rail highlight when bond order >= 1.35!
  let ord = in.bond_info.x;
  var rail = 1.0;
  if (ord >= 1.35) {
    let groove = abs(across);
    rail = 0.72 + 0.58 * smoothstep(0.18, 0.62, groove);
  }
  let shade = (0.34 + 0.76 * cy) * rail;
  let spec = pow(max(0.0, cy), 14.0) * 0.42;
  return vec4<f32>(in.color * shade + vec3<f32>(spec), 1.0);
}
`;

// 3. Translucent Additive 3D pi-MO Wavefunction Lobes (16-byte vec4)
const PI_MO_CLOUD_WGSL = /* wgsl */ `
${COMMON_UNIFORMS_WGSL}

@group(0) @binding(0) var<uniform> u: RenderUniforms;
@group(0) @binding(1) var<storage, read> pts: array<vec4<f32>>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) amp: f32,
};

@vertex
fn vs_pi_mo(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VsOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let qv = quad[vid];
  let pt = pts[iid];
  let sz = u.extra_info.z * (0.65 + 0.55 * abs(pt.w));
  let wpos = pt.xyz + (u.cam_right_esp.xyz * qv.x + u.cam_up_time.xyz * qv.y) * sz;
  var out: VsOut;
  out.pos = u.view_proj * vec4<f32>(wpos, 1.0);
  out.local_uv = qv;
  out.amp = pt.w;
  return out;
}

@fragment
fn fs_pi_mo(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let g = exp(-r2 * 3.4);
  let pos_col = vec3<f32>(0.12, 0.84, 1.0);
  let neg_col = vec3<f32>(1.0, 0.24, 0.68);
  let col = select(neg_col, pos_col, in.amp >= 0.0);
  let alpha = clamp(abs(in.amp) * g * 0.135, 0.0, 0.36);
  return vec4<f32>(col * alpha * 1.15, alpha);
}
`;

// 4. Biology 48-byte Particle Bead Pipeline (Amphiphiles, Biopolymer Residues, Replicators, Active Agents!)
const BIO_BEAD_WGSL = /* wgsl */ `
${COMMON_UNIFORMS_WGSL}

struct BioBead {
  pos_a: vec4<f32>,
  vel_b: vec4<f32>,
  col_r: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: RenderUniforms;
@group(0) @binding(1) var<storage, read> beads: array<BioBead>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec3<f32>,
  @location(2) aux: f32,
  @location(3) world_pos: vec3<f32>,
  @location(4) rad_w: f32,
};

struct FsOut {
  @location(0) color: vec4<f32>,
  @builtin(frag_depth) depth: f32,
};

@vertex
fn vs_bio_bead(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VsOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let qv = quad[vid];
  let b = beads[iid];
  var out: VsOut;
  // Interactive 3D Protocell Vesicle Cutaway Plane (extra_info.x = clipZ; >= 100 disables!)
  if (u.extra_info.x < 90.0 && b.pos_a.z > u.extra_info.x) {
    out.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    out.local_uv = vec2<f32>(0.0);
    out.color = vec3<f32>(0.0);
    out.aux = 0.0;
    out.world_pos = vec3<f32>(0.0);
    out.rad_w = 0.0;
    return out;
  }
  let rad = max(0.06, b.col_r.w) * u.field_info.w;
  let to_cam = normalize(u.cam_pos_mode.xyz - b.pos_a.xyz);
  let wpos = b.pos_a.xyz + to_cam * (rad * 0.35) + (u.cam_right_esp.xyz * qv.x + u.cam_up_time.xyz * qv.y) * (rad * 1.08);
  out.pos = u.view_proj * vec4<f32>(wpos, 1.0);
  out.local_uv = qv * 1.08;
  out.color = b.col_r.rgb;
  out.aux = b.vel_b.w;
  out.world_pos = b.pos_a.xyz;
  out.rad_w = rad;
  return out;
}

@fragment
fn fs_bio_bead(in: VsOut) -> FsOut {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let nz = sqrt(max(0.0, 1.0 - r2));
  let n_view = normalize(vec3<f32>(in.local_uv.x, in.local_uv.y, nz));
  let to_cam = normalize(u.cam_pos_mode.xyz - in.world_pos);
  let p_surf = in.world_pos + (u.cam_right_esp.xyz * in.local_uv.x + u.cam_up_time.xyz * in.local_uv.y + to_cam * nz) * in.rad_w;
  let clip = u.view_proj * vec4<f32>(p_surf, 1.0);
  let l1 = normalize(vec3<f32>(0.48, 0.78, 0.56));
  let l2 = normalize(vec3<f32>(-0.55, -0.30, 0.62));
  let diff = max(dot(n_view, l1), 0.0) * 0.94 + max(dot(n_view, l2), 0.0) * 0.32;
  let h1 = normalize(l1 + vec3<f32>(0.0, 0.0, 1.0));
  let spec = pow(max(dot(n_view, h1), 0.0), 38.0) * 0.72;
  let fres = pow(max(0.0, 1.0 - nz), 2.8) * 0.44;
  // Subtle glowing cutaway cross-section rim right near clipZ plane!
  let cut_rim = select(0.0, (1.0 - smoothstep(0.0, 0.85, abs(in.world_pos.z - u.extra_info.x))) * 0.55, u.extra_info.x < 90.0);
  let col = in.color * (0.26 + diff) + vec3<f32>(spec) + in.color * fres * 0.88 + vec3<f32>(0.24, 0.96, 0.84) * cut_rim;
  var out: FsOut;
  out.color = vec4<f32>(col, 1.0);
  out.depth = clamp(clip.z / max(1e-5, clip.w), 0.0, 1.0);
  return out;
}
`;

// 5. Biology Sequential Chain / Amphiphile Link Tubes (connects consecutive 48-byte BioBeads!)
//    stride=1 for Biopolymer Backbone (i -> i+1), stride=3 for 3-bead Amphiphiles (0->1, 1->2)!
const BIO_LINK_WGSL = /* wgsl */ `
${COMMON_UNIFORMS_WGSL}

struct BioBead {
  pos_a: vec4<f32>,
  vel_b: vec4<f32>,
  col_r: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: RenderUniforms;
@group(0) @binding(1) var<storage, read> beads: array<BioBead>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) along_across: vec2<f32>,
  @location(1) color: vec3<f32>,
};

@vertex
fn vs_bio_link(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VsOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(0.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 1.0)
  );
  let qv = quad[vid];
  let link_mode = u32(u.extra_info.y + 0.5); // 1=chain i->i+1, 2=amphiphile (0->1, 1->2 inside 3-bead)
  var ia: u32 = iid;
  var ib: u32 = iid + 1u;
  if (link_mode == 2u) {
    let lip = iid / 2u;
    let seg = iid % 2u;
    ia = lip * 3u + seg;
    ib = ia + 1u;
  }
  let ba = beads[ia];
  let bb = beads[ib];
  let pa = ba.pos_a.xyz;
  let pb = bb.pos_a.xyz;
  let d = pb - pa;
  let dist = length(d);
  var out: VsOut;
  // Cull wrapped / detached links OR links past the interactive vesicle cutaway plane!
  if (dist < 1e-4 || dist > 3.6 || (u.extra_info.x < 90.0 && max(pa.z, pb.z) > u.extra_info.x)) {
    out.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    out.along_across = vec2<f32>(0.0);
    out.color = vec3<f32>(0.0);
    return out;
  }
  let mid = mix(pa, pb, qv.x);
  let axis = d / dist;
  let view_dir = normalize(u.cam_pos_mode.xyz - mid);
  var side = cross(axis, view_dir);
  if (length(side) < 1e-4) { side = u.cam_right_esp.xyz; } else { side = normalize(side); }
  // Sculpted 3D protein backbone ribbon (link_mode == 1) vs slender lipid acyl chains (link_mode == 2)
  let thick = select(0.24, 0.11, link_mode == 2u) * u.field_info.w;
  let wpos = mid + side * (qv.y * thick);
  out.pos = u.view_proj * vec4<f32>(wpos, 1.0);
  out.along_across = qv;
  out.color = mix(ba.col_r.rgb, bb.col_r.rgb, qv.x);
  return out;
}

@fragment
fn fs_bio_link(in: VsOut) -> @location(0) vec4<f32> {
  let cy = sqrt(max(0.0, 1.0 - in.along_across.y * in.along_across.y));
  let col = in.color * (0.32 + 0.72 * cy) + vec3<f32>(pow(cy, 12.0) * 0.28);
  return vec4<f32>(col, 1.0);
}
`;

// 6. Spatial 128x128 Field Shader (Frank Chiral / BZ Spirals / Prebiotic RAF / Hodgkin-Huxley / 3D Turing!)
const FIELD_PLANE_WGSL = /* wgsl */ `
${COMMON_UNIFORMS_WGSL}

@group(0) @binding(0) var<uniform> u: RenderUniforms;
@group(0) @binding(1) var<storage, read> field_data: array<vec4<f32>>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) world_pos: vec3<f32>,
};

fn sample_field_bilinear(uv_in: vec2<f32>) -> vec4<f32> {
  let w = u32(u.field_info.y + 0.5);
  let h = u32(u.field_info.z + 0.5);
  let fx = fract(uv_in.x) * f32(w) - 0.5;
  let fy = fract(uv_in.y) * f32(h) - 0.5;
  let x0 = u32((i32(floor(fx)) % i32(w) + i32(w)) % i32(w));
  let y0 = u32((i32(floor(fy)) % i32(h) + i32(h)) % i32(h));
  let x1 = (x0 + 1u) % w;
  let y1 = (y0 + 1u) % h;
  let tx = fract(fx);
  let ty = fract(fy);
  let c00 = field_data[y0 * w + x0];
  let c10 = field_data[y0 * w + x1];
  let c01 = field_data[y1 * w + x0];
  let c11 = field_data[y1 * w + x1];
  return mix(mix(c00, c10, tx), mix(c01, c11, tx), ty);
}

// Render 128x128 smooth quad plane in 3D space ([-6.4, +6.4] on X-Z plane, displaced vertically by field value!)
@vertex
fn vs_field(@builtin(vertex_index) vid: u32) -> VsOut {
  let gx = 128u;
  let gy = 128u;
  let cell = vid / 6u;
  let corner = vid % 6u;
  let cx = cell % gx;
  let cy = cell / gx;
  var off = array<vec2<u32>, 6>(
    vec2<u32>(0u, 0u), vec2<u32>(1u, 0u), vec2<u32>(1u, 1u),
    vec2<u32>(0u, 0u), vec2<u32>(1u, 1u), vec2<u32>(0u, 1u)
  );
  let p = vec2<u32>(cx, cy) + off[corner];
  let uv = vec2<f32>(f32(p.x) / f32(gx), f32(p.y) / f32(gy));
  let s = sample_field_bilinear(uv);
  let fmode = u32(u.field_info.x + 0.5);

  var elev = 0.0;
  if (fmode == 0u) {
    // Frank chiral domains: L raises slightly, D dips slightly!
    elev = (s.x - s.y) * 0.55;
  } else if (fmode == 1u) {
    // BZ Oregonator spiral wave crests
    elev = s.x * 0.72;
  } else if (fmode == 2u) {
    // Prebiotic RAF autocatalytic polymer peaks
    elev = (s.y + s.z * 0.7) * 0.55;
  } else if (fmode == 3u) {
    // Hodgkin-Huxley action potential wave height!
    elev = clamp((s.x + 65.0) / 100.0, -0.1, 1.2) * 0.95;
  } else {
    // Turing morphogen activator ridges (aligned right beneath 3D chemotactic agents!)
    elev = s.y * 1.15 - 0.18;
  }

  let span = select(6.4, 8.0, fmode == 4u);
  let wpos = vec3<f32>((uv.x - 0.5) * 2.0 * span, elev, (uv.y - 0.5) * 2.0 * span);
  var out: VsOut;
  out.pos = u.view_proj * vec4<f32>(wpos, 1.0);
  out.uv = uv;
  out.world_pos = wpos;
  return out;
}

@fragment
fn fs_field(in: VsOut) -> @location(0) vec4<f32> {
  let eps = 1.0 / max(u.field_info.y, 64.0);
  let s = sample_field_bilinear(in.uv);
  let sx = sample_field_bilinear(in.uv + vec2<f32>(eps, 0.0));
  let sxm = sample_field_bilinear(in.uv - vec2<f32>(eps, 0.0));
  let sy = sample_field_bilinear(in.uv + vec2<f32>(0.0, eps));
  let sym = sample_field_bilinear(in.uv - vec2<f32>(0.0, eps));
  let fmode = u32(u.field_info.x + 0.5);

  var col = vec3<f32>(0.05, 0.08, 0.14);
  var dhx = 0.0;
  var dhy = 0.0;

  if (fmode == 0u) {
    // Frank Chiral: L = electric cyan, D = vivid magenta, racemic boundary = deep obsidian!
    let L = clamp(s.x * 1.35, 0.0, 1.4);
    let D = clamp(s.y * 1.35, 0.0, 1.4);
    let ee = (L - D) / max(L + D, 0.05);
    let purity = abs(ee);
    let l_col = vec3<f32>(0.06, 0.88, 1.0);
    let d_col = vec3<f32>(1.0, 0.22, 0.68);
    let dom = mix(d_col, l_col, smoothstep(-0.35, 0.35, ee));
    let racemic = vec3<f32>(0.04, 0.05, 0.09);
    col = mix(racemic, dom * (0.35 + 0.85 * min(1.0, L + D)), smoothstep(0.08, 0.62, purity));
    dhx = 0.5 * ((sx.x - sx.y) - (sxm.x - sxm.y));
    dhy = 0.5 * ((sy.x - sy.y) - (sym.x - sym.y));
  } else if (fmode == 1u) {
    // Belousov-Zhabotinsky Oregonator Spiral Waves: midnight indigo -> blazing cyan -> incandescent gold!
    let u_act = clamp(s.x, 0.0, 1.2);
    let v_inh = clamp(s.y * 2.2, 0.0, 1.2);
    col = vec3<f32>(0.03, 0.04, 0.12);
    col = mix(col, vec3<f32>(0.18, 0.28, 0.78), smoothstep(0.06, 0.55, v_inh));
    col = mix(col, vec3<f32>(0.12, 0.92, 1.0), smoothstep(0.18, 0.65, u_act));
    col = mix(col, vec3<f32>(1.35, 0.92, 0.28), smoothstep(0.60, 0.96, u_act));
    dhx = 0.5 * (sx.x - sxm.x);
    dhy = 0.5 * (sy.x - sym.x);
  } else if (fmode == 2u) {
    // Prebiotic RAF Autocatalytic Network: warm amber feedstock + emerald autocatalyst + glowing violet polymer!
    let f_feed = clamp(s.x, 0.0, 1.2);
    let x_cat = clamp(s.y * 1.4, 0.0, 1.3);
    let y_pol = clamp(s.z * 1.4, 0.0, 1.3);
    col = vec3<f32>(0.04, 0.05, 0.09)
      + vec3<f32>(0.42, 0.24, 0.06) * f_feed * 0.65
      + vec3<f32>(0.10, 0.95, 0.56) * x_cat * 0.95
      + vec3<f32>(0.68, 0.36, 1.25) * y_pol * 0.95;
    dhx = 0.5 * ((sx.y + sx.z) - (sxm.y + sxm.z));
    dhy = 0.5 * ((sy.y + sy.z) - (sym.y + sym.z));
  } else if (fmode == 3u) {
    // Hodgkin-Huxley Excitable Membrane Voltage V_m (-75 mV -> +35 mV) + refractory K+ h/n trail!
    let vn = clamp((s.x + 75.0) / 110.0, 0.0, 1.15);
    let refr = clamp((s.z - 0.32) * 2.4, 0.0, 1.0);
    col = vec3<f32>(0.025, 0.04, 0.11);
    col = mix(col, vec3<f32>(0.24, 0.14, 0.54), refr * 0.85);
    col = mix(col, vec3<f32>(0.12, 0.72, 1.0), smoothstep(0.18, 0.55, vn));
    col = mix(col, vec3<f32>(1.45, 0.88, 0.22), smoothstep(0.55, 0.92, vn));
    col = mix(col, vec3<f32>(1.65, 1.55, 1.35), smoothstep(0.88, 1.08, vn));
    dhx = 0.5 * (sx.x - sxm.x) * 0.02;
    dhy = 0.5 * (sy.x - sym.x) * 0.02;
  } else {
    // Turing Morphogenesis: deep navy basin -> emerald teal -> glowing golden morphogen ridges!
    let v_act = clamp(s.y * 2.3, 0.0, 1.3);
    col = vec3<f32>(0.02, 0.055, 0.11);
    col = mix(col, vec3<f32>(0.06, 0.54, 0.58), smoothstep(0.08, 0.48, v_act));
    col = mix(col, vec3<f32>(0.22, 0.96, 0.64), smoothstep(0.42, 0.82, v_act));
    col = mix(col, vec3<f32>(1.28, 0.96, 0.34), smoothstep(0.78, 1.12, v_act));
    dhx = 0.5 * (sx.y - sxm.y) * 2.4;
    dhy = 0.5 * (sy.y - sym.y) * 2.4;
  }

  let n = normalize(vec3<f32>(-dhx * 16.0, 1.0, -dhy * 16.0));
  let l = normalize(vec3<f32>(0.45, 0.85, 0.35));
  let v = normalize(u.cam_pos_mode.xyz - in.world_pos);
  let h = normalize(l + v);
  let diff = 0.65 + 0.42 * max(dot(n, l), 0.0);
  let spec = pow(max(dot(n, h), 0.0), 36.0) * 0.32;

  // Subtle physical coordinate border frame
  let edge_d = min(min(in.uv.x, 1.0 - in.uv.x), min(in.uv.y, 1.0 - in.uv.y));
  let rim = (1.0 - smoothstep(0.0, 0.012, edge_d)) * 0.25;
  return vec4<f32>(col * diff + vec3<f32>(spec) + vec3<f32>(0.35, 0.72, 1.0) * rim, 1.0);
}
`;

// 6B. Interactive 3D Xenobiology Specimen Vivarium / Aquarium Mesh Shader (48-byte vertices: pos_part, norm_zone, col_emiss)
const SPECIMEN_MESH_WGSL = /* wgsl */ `
${COMMON_UNIFORMS_WGSL}

@group(0) @binding(0) var<uniform> u: RenderUniforms;

struct VsIn {
  @location(0) pos_part: vec4<f32>,
  @location(1) norm_zone: vec4<f32>,
  @location(2) col_emiss: vec4<f32>,
};

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) world_pos: vec3<f32>,
  @location(1) norm: vec3<f32>,
  @location(2) col_emiss: vec4<f32>,
  @location(3) zone: f32,
};

@vertex
fn vs_spec_mesh(in: VsIn) -> VsOut {
  var out: VsOut;
  out.pos = u.view_proj * vec4<f32>(in.pos_part.xyz, 1.0);
  out.world_pos = in.pos_part.xyz;
  out.norm = in.norm_zone.xyz;
  out.col_emiss = in.col_emiss;
  out.zone = in.norm_zone.w;
  return out;
}

@fragment
fn fs_spec_mesh(in: VsOut) -> @location(0) vec4<f32> {
  let n = normalize(in.norm);
  let v = normalize(u.cam_pos_mode.xyz - in.world_pos);
  let l1 = normalize(vec3<f32>(0.42, 0.86, 0.48));
  let l2 = normalize(vec3<f32>(-0.62, 0.28, -0.58));
  let ndl1 = max(dot(n, l1), 0.0);
  let ndl2 = max(dot(n, l2), 0.0);
  let ndv = max(dot(n, v), 0.0);
  let h1 = normalize(l1 + v);
  let spec = pow(max(dot(n, h1), 0.0), 34.0) * select(0.55, 0.22, in.zone < 1.5);
  let fres = pow(max(0.0, 1.0 - ndv), 2.8);
  // Subtle aquatic / bio-chamber caustic shimmer on vivarium floor & organic dermis!
  let caust = 0.5 + 0.5 * sin(in.world_pos.x * 4.2 + u.cam_up_time.w * 2.1) * cos(in.world_pos.z * 4.5 - u.cam_up_time.w * 1.7);
  let caustic_tint = vec3<f32>(0.14, 0.42, 0.48) * caust * (0.10 + 0.16 * max(0.0, n.y));
  let base = in.col_emiss.rgb;
  let emiss = max(0.0, in.col_emiss.w);
  let col = base * (0.24 + 0.88 * ndl1 + 0.30 * ndl2) + vec3<f32>(0.92, 0.98, 1.0) * spec + base * fres * 0.42 + caustic_tint + base * emiss * 1.25;
  return vec4<f32>(col, 1.0);
}

@fragment
fn fs_spec_glass(in: VsOut) -> @location(0) vec4<f32> {
  let n = normalize(in.norm);
  let v = normalize(u.cam_pos_mode.xyz - in.world_pos);
  let ndv = abs(dot(n, v));
  let fres = pow(max(0.0, 1.0 - ndv), 2.4);
  if (in.zone > 5.5) {
    // Glowing active lab tool beam (Thermal Laser, Cryo-Jet, Probe, Neuro-Stim, Biopsy!)
    let beam = in.col_emiss.rgb * (1.25 + 0.65 * ndv);
    let a = clamp(in.col_emiss.w * 0.55, 0.25, 0.95);
    return vec4<f32>(beam * a, a);
  }
  // Translucent refractive glass aquarium walls + top solvent meniscus shimmer!
  let ripple = 0.85 + 0.15 * sin(in.world_pos.x * 5.0 + u.cam_up_time.w * 2.4) * cos(in.world_pos.z * 5.0 - u.cam_up_time.w * 1.9);
  let alpha = clamp(in.col_emiss.w * (0.45 + 1.35 * fres) * ripple, 0.05, 0.62);
  let col = in.col_emiss.rgb * (0.85 + 1.25 * fres) + vec3<f32>(0.62, 0.94, 1.0) * fres * 0.45;
  return vec4<f32>(col * alpha, alpha);
}
`;

// 7. 2-Pass Half-Resolution Kawase HDR Bloom + ACES Tonemap & Gamma Blit Pass
const BLOOM_WGSL = /* wgsl */ `
struct BloomParams {
  inv_res: vec2<f32>,
  threshold: f32,
  mode: f32,
};
@group(0) @binding(0) var<uniform> bp: BloomParams;
@group(0) @binding(1) var src_tex: texture_2d<f32>;
@group(0) @binding(2) var src_samp: sampler;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_bloom(@builtin(vertex_index) vid: u32) -> VsOut {
  var p = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  var out: VsOut;
  out.pos = vec4<f32>(p[vid], 0.0, 1.0);
  out.uv = vec2<f32>(p[vid].x * 0.5 + 0.5, 0.5 - p[vid].y * 0.5);
  return out;
}

@fragment
fn fs_bloom(in: VsOut) -> @location(0) vec4<f32> {
  let d = bp.inv_res * select(1.25, 2.25, bp.mode > 0.5);
  let c0 = textureSample(src_tex, src_samp, in.uv + vec2<f32>(-d.x, -d.y)).rgb;
  let c1 = textureSample(src_tex, src_samp, in.uv + vec2<f32>( d.x, -d.y)).rgb;
  let c2 = textureSample(src_tex, src_samp, in.uv + vec2<f32>(-d.x,  d.y)).rgb;
  let c3 = textureSample(src_tex, src_samp, in.uv + vec2<f32>( d.x,  d.y)).rgb;
  let avg = (c0 + c1 + c2 + c3) * 0.25;
  if (bp.mode < 0.5) {
    let lum = dot(avg, vec3<f32>(0.2126, 0.7152, 0.0722));
    let w = max(0.0, lum - bp.threshold) / max(1e-4, lum);
    return vec4<f32>(avg * w, 1.0);
  }
  return vec4<f32>(avg, 1.0);
}
`;

const TONEMAP_WGSL = /* wgsl */ `
@group(0) @binding(0) var hdr_tex: texture_2d<f32>;
@group(0) @binding(1) var hdr_samp: sampler;
@group(0) @binding(2) var bloom_tex: texture_2d<f32>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_tone(@builtin(vertex_index) vid: u32) -> VsOut {
  var p = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  var out: VsOut;
  out.pos = vec4<f32>(p[vid], 0.0, 1.0);
  out.uv = vec2<f32>(p[vid].x * 0.5 + 0.5, 0.5 - p[vid].y * 0.5);
  return out;
}

fn aces_film(x: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

@fragment
fn fs_tone(in: VsOut) -> @location(0) vec4<f32> {
  let hdr = textureSample(hdr_tex, hdr_samp, in.uv).rgb;
  let bloom = textureSample(bloom_tex, hdr_samp, in.uv).rgb;
  let mapped = aces_film((hdr + bloom * 0.42) * 1.12);
  let srgb = pow(max(mapped, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.2));
  return vec4<f32>(srgb, 1.0);
}
`;

export function createChemBioWebGpuRenderer(device, canvas, { bgStyle = 0 } = {}) {
  const ctx = canvas.getContext('webgpu');
  const { format } = configureCompatibleWebGpuCanvas(ctx, device, { preferCopySrc: true });

  const uniformBuf = device.createBuffer({
    label: 'ulg-chembio-render-uniforms',
    size: 144,
    usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST
  });
  const uniformF32 = new Float32Array(36);

  const depthState = { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' };
  const depthReadOnly = { depthWriteEnabled: false, depthCompare: 'less', format: 'depth24plus' };
  const hdrTarget = [{ format: 'rgba16float' }];
  const hdrAlphaTarget = [{
    format: 'rgba16float',
    blend: {
      color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
    }
  }];
  const additiveTarget = [{
    format: 'rgba16float',
    blend: {
      color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }
    }
  }];

  const makePipeline = (label, code, vs, fs, targets, depthStencil) => {
    const mod = device.createShaderModule({ label, code });
    return device.createRenderPipeline({
      label,
      layout: 'auto',
      vertex: { module: mod, entryPoint: vs },
      fragment: { module: mod, entryPoint: fs, targets },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil
    });
  };

  const bgPipe = makePipeline('chembio-bg', BACKDROP_WGSL, 'vs_bg', 'fs_bg', hdrTarget, {
    depthWriteEnabled: false, depthCompare: 'always', format: 'depth24plus'
  });
  const orgAtomPipe = makePipeline('chembio-org-atom', ORG_ATOM_WGSL, 'vs_org_atom', 'fs_org_atom', hdrTarget, depthState);
  const orgBondPipe = makePipeline('chembio-org-bond', ORG_BOND_WGSL, 'vs_org_bond', 'fs_org_bond', hdrAlphaTarget, depthState);
  const piMoPipe = makePipeline('chembio-pi-mo', PI_MO_CLOUD_WGSL, 'vs_pi_mo', 'fs_pi_mo', additiveTarget, depthReadOnly);
  const bioBeadPipe = makePipeline('chembio-bio-bead', BIO_BEAD_WGSL, 'vs_bio_bead', 'fs_bio_bead', hdrTarget, depthState);
  const bioLinkPipe = makePipeline('chembio-bio-link', BIO_LINK_WGSL, 'vs_bio_link', 'fs_bio_link', hdrTarget, depthState);
  const fieldPipe = makePipeline('chembio-field', FIELD_PLANE_WGSL, 'vs_field', 'fs_field', hdrTarget, depthState);

  const specMod = device.createShaderModule({ label: 'chembio-spec-mesh', code: SPECIMEN_MESH_WGSL });
  const specVertexBuffers = [{
    arrayStride: 48,
    attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x4' },
      { shaderLocation: 1, offset: 16, format: 'float32x4' },
      { shaderLocation: 2, offset: 32, format: 'float32x4' }
    ]
  }];
  const specSolidPipe = device.createRenderPipeline({
    label: 'chembio-spec-solid',
    layout: 'auto',
    vertex: { module: specMod, entryPoint: 'vs_spec_mesh', buffers: specVertexBuffers },
    fragment: { module: specMod, entryPoint: 'fs_spec_mesh', targets: hdrTarget },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: depthState
  });
  const specGlassPipe = device.createRenderPipeline({
    label: 'chembio-spec-glass',
    layout: 'auto',
    vertex: { module: specMod, entryPoint: 'vs_spec_mesh', buffers: specVertexBuffers },
    fragment: { module: specMod, entryPoint: 'fs_spec_glass', targets: hdrAlphaTarget },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: depthReadOnly
  });
  const specSolidBg = device.createBindGroup({
    layout: specSolidPipe.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuf } }]
  });
  const specGlassBg = device.createBindGroup({
    layout: specGlassPipe.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuf } }]
  });

  const bloomMod = device.createShaderModule({ label: 'chembio-bloom', code: BLOOM_WGSL });
  const bloomPipe = device.createRenderPipeline({
    label: 'chembio-bloom',
    layout: 'auto',
    vertex: { module: bloomMod, entryPoint: 'vs_bloom' },
    fragment: { module: bloomMod, entryPoint: 'fs_bloom', targets: hdrTarget },
    primitive: { topology: 'triangle-list', cullMode: 'none' }
  });
  const bloomExtractBuf = device.createBuffer({ label: 'chembio-bloom-ext', size: 16, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const bloomBlurBuf = device.createBuffer({ label: 'chembio-bloom-blur', size: 16, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });

  const toneMod = device.createShaderModule({ label: 'chembio-tonemap', code: TONEMAP_WGSL });
  const tonePipe = device.createRenderPipeline({
    label: 'chembio-tonemap',
    layout: 'auto',
    vertex: { module: toneMod, entryPoint: 'vs_tone' },
    fragment: { module: toneMod, entryPoint: 'fs_tone', targets: [{ format }] },
    primitive: { topology: 'triangle-list', cullMode: 'none' }
  });
  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
  const bgBindGroup = device.createBindGroup({
    layout: bgPipe.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuf } }]
  });

  let hdrTex = null;
  let depthTex = null;
  let bloomTexA = null;
  let bloomTexB = null;
  let bloomExtractBg = null;
  let bloomBlurBg = null;
  let toneBindGroup = null;
  let curW = 0;
  let curH = 0;
  let disposed = false;

  // Bind-group weak caches keyed by resident GPU buffers so steady-state churn is 0!
  const atomBgCache = new WeakMap();
  const bondBgCache = new WeakMap();
  const piBgCache = new WeakMap();
  const bioBeadBgCache = new WeakMap();
  const bioLinkBgCache = new WeakMap();
  const fieldBgCache = new WeakMap();

  const camera = {
    yaw: 0.55,
    pitch: 0.42,
    dist: 9.5,
    target: [0, 0, 0],
    fovDeg: 42
  };

  function ensureTargets() {
    const w = Math.max(64, canvas.width | 0);
    const h = Math.max(64, canvas.height | 0);
    if (w === curW && h === curH && hdrTex && depthTex && bloomTexA && bloomTexB) return;
    curW = w;
    curH = h;
    if (hdrTex) try { hdrTex.destroy(); } catch {}
    if (depthTex) try { depthTex.destroy(); } catch {}
    if (bloomTexA) try { bloomTexA.destroy(); } catch {}
    if (bloomTexB) try { bloomTexB.destroy(); } catch {}
    const bw = Math.max(32, w >> 1);
    const bh = Math.max(32, h >> 1);
    hdrTex = device.createTexture({
      size: [w, h],
      format: 'rgba16float',
      usage: 0x10 | 0x04 // RENDER_ATTACHMENT | TEXTURE_BINDING
    });
    depthTex = device.createTexture({
      size: [w, h],
      format: 'depth24plus',
      usage: 0x10 // RENDER_ATTACHMENT
    });
    bloomTexA = device.createTexture({ size: [bw, bh], format: 'rgba16float', usage: 0x10 | 0x04 });
    bloomTexB = device.createTexture({ size: [bw, bh], format: 'rgba16float', usage: 0x10 | 0x04 });
    device.queue.writeBuffer(bloomExtractBuf, 0, new Float32Array([1 / w, 1 / h, 0.82, 0.0]));
    device.queue.writeBuffer(bloomBlurBuf, 0, new Float32Array([1 / bw, 1 / bh, 0.0, 1.0]));
    bloomExtractBg = device.createBindGroup({
      layout: bloomPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bloomExtractBuf } },
        { binding: 1, resource: hdrTex.createView() },
        { binding: 2, resource: sampler }
      ]
    });
    bloomBlurBg = device.createBindGroup({
      layout: bloomPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bloomBlurBuf } },
        { binding: 1, resource: bloomTexA.createView() },
        { binding: 2, resource: sampler }
      ]
    });
    toneBindGroup = device.createBindGroup({
      layout: tonePipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: hdrTex.createView() },
        { binding: 1, resource: sampler },
        { binding: 2, resource: bloomTexB.createView() }
      ]
    });
  }

  function setCamera(patch = {}) {
    if (Number.isFinite(patch.yaw)) camera.yaw = patch.yaw;
    if (Number.isFinite(patch.pitch)) camera.pitch = Math.max(-1.45, Math.min(1.45, patch.pitch));
    if (Number.isFinite(patch.dist)) camera.dist = Math.max(2.2, Math.min(48.0, patch.dist));
    if (Array.isArray(patch.target) && patch.target.length === 3) {
      camera.target = [patch.target[0], patch.target[1], patch.target[2]];
    }
  }

  function resize(cssW, cssH, dpr = Math.min(2, window.devicePixelRatio || 1)) {
    const w = Math.max(64, Math.round(cssW * dpr));
    const h = Math.max(64, Math.round(cssH * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ensureTargets();
  }

  function getCachedBg(cache, pipe, keyBuf, entries) {
    let bg = cache.get(keyBuf);
    if (!bg) {
      bg = device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries });
      cache.set(keyBuf, bg);
    }
    return bg;
  }

  let lastVp = new Float32Array(16);
  let lastAspect = 1.6;

  function renderFrame(scene = {}) {
    if (disposed) return;
    ensureTargets();

    const cp = Math.cos(camera.pitch);
    const eye = [
      camera.target[0] + camera.dist * cp * Math.sin(camera.yaw),
      camera.target[1] + camera.dist * Math.sin(camera.pitch),
      camera.target[2] + camera.dist * cp * Math.cos(camera.yaw)
    ];
    const { view, right, up } = buildLookAt(eye, camera.target, [0, 1, 0]);
    lastAspect = curW / Math.max(1, curH);
    const proj = buildPerspective((camera.fovDeg * Math.PI) / 180, lastAspect, 0.1, 200.0);
    const vp = mat4Mul(proj, view);
    lastVp.set(vp);

    uniformF32.set(vp, 0);
    uniformF32[16] = eye[0]; uniformF32[17] = eye[1]; uniformF32[18] = eye[2]; uniformF32[19] = scene.style || 0;
    uniformF32[20] = right[0]; uniformF32[21] = right[1]; uniformF32[22] = right[2]; uniformF32[23] = scene.espBlend ?? 0;
    uniformF32[24] = up[0]; uniformF32[25] = up[1]; uniformF32[26] = up[2]; uniformF32[27] = scene.timeSec ?? 0;
    uniformF32[28] = scene.fieldMode ?? 0;
    uniformF32[29] = scene.fieldW ?? 128;
    uniformF32[30] = scene.fieldH ?? 128;
    uniformF32[31] = scene.sphereScale ?? 1.0;
    uniformF32[32] = Number.isFinite(Number(scene.clipZ)) ? Number(scene.clipZ) : 999.0;
    uniformF32[33] = scene.bioLinkMode ?? 0;
    uniformF32[34] = scene.piPointSize ?? 0.17;
    uniformF32[35] = bgStyle;
    device.queue.writeBuffer(uniformBuf, 0, uniformF32);

    const enc = device.createCommandEncoder({ label: 'chembio-frame' });

    // Pass 1: HDR 3D Scene
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: hdrTex.createView(),
        clearValue: { r: 0.008, g: 0.012, b: 0.024, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store'
      }],
      depthStencilAttachment: {
        view: depthTex.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      }
    });

    // Backdrop
    pass.setPipeline(bgPipe);
    pass.setBindGroup(0, bgBindGroup);
    pass.draw(3);

    // Optional Spatial Field Plane (Frank Chiral / BZ / RAF / HH / Turing)
    if (scene.fieldBuffer) {
      const fbg = getCachedBg(fieldBgCache, fieldPipe, scene.fieldBuffer, [
        { binding: 0, resource: { buffer: uniformBuf } },
        { binding: 1, resource: { buffer: scene.fieldBuffer } }
      ]);
      pass.setPipeline(fieldPipe);
      pass.setBindGroup(0, fbg);
      pass.draw(128 * 128 * 6);
    }

    // Optional Organic Molecule (Bonds + Atoms + Additive pi-MO Cloud)
    if (scene.orgAtomsBuffer && scene.orgAtomCount > 0) {
      if (scene.orgBondsBuffer && scene.orgBondCount > 0) {
        const bbg = getCachedBg(bondBgCache, orgBondPipe, scene.orgBondsBuffer, [
          { binding: 0, resource: { buffer: uniformBuf } },
          { binding: 1, resource: { buffer: scene.orgAtomsBuffer } },
          { binding: 2, resource: { buffer: scene.orgBondsBuffer } }
        ]);
        pass.setPipeline(orgBondPipe);
        pass.setBindGroup(0, bbg);
        pass.draw(6, scene.orgBondCount);
      }
      const abg = getCachedBg(atomBgCache, orgAtomPipe, scene.orgAtomsBuffer, [
        { binding: 0, resource: { buffer: uniformBuf } },
        { binding: 1, resource: { buffer: scene.orgAtomsBuffer } }
      ]);
      pass.setPipeline(orgAtomPipe);
      pass.setBindGroup(0, abg);
      pass.draw(6, scene.orgAtomCount);

      if (scene.piCloudBuffer && scene.piCloudCount > 0 && scene.showPiMo !== false) {
        const pbg = getCachedBg(piBgCache, piMoPipe, scene.piCloudBuffer, [
          { binding: 0, resource: { buffer: uniformBuf } },
          { binding: 1, resource: { buffer: scene.piCloudBuffer } }
        ]);
        pass.setPipeline(piMoPipe);
        pass.setBindGroup(0, pbg);
        pass.draw(6, scene.piCloudCount);
      }
    }

    // Optional 3D Specimen Vivarium Solid Mesh (Organism + Containment Frame + Rocks)
    if (scene.specimenSolidBuffer && scene.specimenSolidVertCount > 0) {
      pass.setPipeline(specSolidPipe);
      pass.setBindGroup(0, specSolidBg);
      pass.setVertexBuffer(0, scene.specimenSolidBuffer);
      pass.draw(scene.specimenSolidVertCount);
    }

    // Optional Biology 48-byte Beads + Optional Polymer/Amphiphile Link Tubes
    if (scene.bioBeadsBuffer && scene.bioBeadCount > 0) {
      if (scene.bioLinkCount > 0 && scene.bioLinkMode > 0) {
        const lbg = getCachedBg(bioLinkBgCache, bioLinkPipe, scene.bioBeadsBuffer, [
          { binding: 0, resource: { buffer: uniformBuf } },
          { binding: 1, resource: { buffer: scene.bioBeadsBuffer } }
        ]);
        pass.setPipeline(bioLinkPipe);
        pass.setBindGroup(0, lbg);
        pass.draw(6, scene.bioLinkCount);
      }
      const kbg = getCachedBg(bioBeadBgCache, bioBeadPipe, scene.bioBeadsBuffer, [
        { binding: 0, resource: { buffer: uniformBuf } },
        { binding: 1, resource: { buffer: scene.bioBeadsBuffer } }
      ]);
      pass.setPipeline(bioBeadPipe);
      pass.setBindGroup(0, kbg);
      pass.draw(6, scene.bioBeadCount);
    }

    // Optional Translucent Fresnel Aquarium Glass Walls + Active Tool Beams (drawn after opaque organism & motes!)
    if (scene.specimenGlassBuffer && scene.specimenGlassVertCount > 0) {
      pass.setPipeline(specGlassPipe);
      pass.setBindGroup(0, specGlassBg);
      pass.setVertexBuffer(0, scene.specimenGlassBuffer);
      pass.draw(scene.specimenGlassVertCount);
    }

    pass.end();

    // Pass 2: 2-Pass Half-Res Kawase HDR Bloom
    const b1 = enc.beginRenderPass({
      colorAttachments: [{ view: bloomTexA.createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }]
    });
    b1.setPipeline(bloomPipe);
    b1.setBindGroup(0, bloomExtractBg);
    b1.draw(3);
    b1.end();

    const b2 = enc.beginRenderPass({
      colorAttachments: [{ view: bloomTexB.createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }]
    });
    b2.setPipeline(bloomPipe);
    b2.setBindGroup(0, bloomBlurBg);
    b2.draw(3);
    b2.end();

    // Pass 3: ACES Tonemap + Bloom Composite to Swapchain
    const swapView = ctx.getCurrentTexture().createView();
    const tpass = enc.beginRenderPass({
      colorAttachments: [{
        view: swapView,
        clearValue: { r: 0.008, g: 0.012, b: 0.024, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });
    tpass.setPipeline(tonePipe);
    tpass.setBindGroup(0, toneBindGroup);
    tpass.draw(3);
    tpass.end();

    device.queue.submit([enc.finish()]);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    try { uniformBuf.destroy(); } catch {}
    try { bloomExtractBuf.destroy(); } catch {}
    try { bloomBlurBuf.destroy(); } catch {}
    if (hdrTex) try { hdrTex.destroy(); } catch {}
    if (depthTex) try { depthTex.destroy(); } catch {}
    if (bloomTexA) try { bloomTexA.destroy(); } catch {}
    if (bloomTexB) try { bloomTexB.destroy(); } catch {}
  }

  return Object.freeze({
    camera,
    setCamera,
    getViewProj: () => lastVp,
    getAspect: () => lastAspect,
    unprojectRay(ndcX, ndcY) {
      const cp = Math.cos(camera.pitch);
      const eye = [
        camera.target[0] + camera.dist * cp * Math.sin(camera.yaw),
        camera.target[1] + camera.dist * Math.sin(camera.pitch),
        camera.target[2] + camera.dist * cp * Math.cos(camera.yaw)
      ];
      const { right, up, forward } = buildLookAt(eye, camera.target, [0, 1, 0]);
      const tanHalf = Math.tan(((camera.fovDeg * Math.PI) / 180) * 0.5);
      const dir = normalize3([
        forward[0] + right[0] * (ndcX * lastAspect * tanHalf) + up[0] * (ndcY * tanHalf),
        forward[1] + right[1] * (ndcX * lastAspect * tanHalf) + up[1] * (ndcY * tanHalf),
        forward[2] + right[2] * (ndcX * lastAspect * tanHalf) + up[2] * (ndcY * tanHalf)
      ]);
      return { origin: eye, dir };
    },
    projectWorld(worldPos, cssW, cssH) {
      const [x, y, z] = worldPos;
      const cx = lastVp[0] * x + lastVp[4] * y + lastVp[8] * z + lastVp[12];
      const cy = lastVp[1] * x + lastVp[5] * y + lastVp[9] * z + lastVp[13];
      const cz = lastVp[2] * x + lastVp[6] * y + lastVp[10] * z + lastVp[14];
      const cw = lastVp[3] * x + lastVp[7] * y + lastVp[11] * z + lastVp[15];
      if (cw <= 0.02) return { visible: false, sx: -999, sy: -999 };
      const ndcX = cx / cw;
      const ndcY = cy / cw;
      const ndcZ = cz / cw;
      return {
        visible: ndcZ >= 0 && ndcZ <= 1,
        sx: (ndcX * 0.5 + 0.5) * cssW,
        sy: (0.5 - ndcY * 0.5) * cssH
      };
    },
    resize,
    renderFrame,
    dispose
  });
}
