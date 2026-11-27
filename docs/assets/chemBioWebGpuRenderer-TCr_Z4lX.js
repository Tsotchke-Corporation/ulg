import{n as e,t}from"./ulgMaterialPbrWgsl-DR6dAUHI.js";var n=Object.freeze({COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128});function r(e){let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]}function i(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function a(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function o(e,t){let n=new Float32Array(16);for(let r=0;r<4;r+=1)for(let i=0;i<4;i+=1)n[r*4+i]=e[0+i]*t[r*4+0]+e[4+i]*t[r*4+1]+e[8+i]*t[r*4+2]+e[12+i]*t[r*4+3];return n}function s(e,t,n,r){let i=1/Math.tan(e*.5),a=1/(n-r),o=new Float32Array(16);return o[0]=i/Math.max(.1,t),o[5]=i,o[10]=r*a,o[11]=-1,o[14]=r*n*a,o}function c(e,t,n){let o=r([e[0]-t[0],e[1]-t[1],e[2]-t[2]]),s=r(i(n,o)),c=i(o,s),l=new Float32Array(16);return l[0]=s[0],l[4]=s[1],l[8]=s[2],l[12]=-a(s,e),l[1]=c[0],l[5]=c[1],l[9]=c[2],l[13]=-a(c,e),l[2]=o[0],l[6]=o[1],l[10]=o[2],l[14]=-a(o,e),l[3]=0,l[7]=0,l[11]=0,l[15]=1,{view:l,right:s,up:c,forward:[-o[0],-o[1],-o[2]]}}var l=`
struct RenderUniforms {
  view_proj: mat4x4<f32>,
  cam_pos_mode: vec4<f32>,   // xyz = camPos, w = renderStyle
  cam_right_esp: vec4<f32>,  // xyz = camRight, w = espBlend (0..1)
  cam_up_time: vec4<f32>,    // xyz = camUp, w = timeSec
  field_info: vec4<f32>,     // x = fieldMode, y = fieldW, z = fieldH, w = sphereScale
  extra_info: vec4<f32>,     // x = countA, y = countB, z = pointSize, w = bgStyle (0=org, 1=bio)
  org_tint_a: vec4<f32>,     // rgb = active organism primary pigment/solvent tint, w = tintStrength [0..1]
  org_tint_b: vec4<f32>,     // rgb = active organism secondary pigment/tail tint, w = modeAux
};
`,u=`
${l}
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
`,d=`
${l}
${t}

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
  @location(5) atomic_z: f32,
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
  out.atomic_z = a.vis_z.w;
  return out;
}

@fragment
fn fs_org_atom(in: VsOut) -> FsOut {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let nz = sqrt(max(0.0, 1.0 - r2));
  let n_view = normalize(vec3<f32>(in.local_uv.x, in.local_uv.y, nz));
  let v_view = vec3<f32>(0.0, 0.0, 1.0);
  let to_cam = normalize(u.cam_pos_mode.xyz - in.world_pos);
  let p_surf = in.world_pos + (u.cam_right_esp.xyz * in.local_uv.x + u.cam_up_time.xyz * in.local_uv.y + to_cam * nz) * in.rad_w;
  let clip = u.view_proj * vec4<f32>(p_surf, 1.0);
  let l1 = normalize(vec3<f32>(0.55, 0.72, 0.58));
  let l2 = normalize(vec3<f32>(-0.65, -0.35, 0.55));

  // Derive metallic cofactor vs organic covalent dielectric PBR directly from atomic number Z!
  let z = u32(round(max(1.0, in.atomic_z)));
  let is_metal_ion = (z == 11u || z == 12u || z == 13u || (z >= 19u && z <= 31u) || (z >= 37u && z <= 50u) || (z >= 55u && z <= 83u));
  let metallic = select(0.0, 0.88, is_metal_ion && u.cam_right_esp.w < 0.5);
  let roughness = select(0.26, 0.18, metallic > 0.5);
  let albedo_lin = ulg_srgb_to_linear(in.color);
  let ior_d = select(1.48, 1.62, z == 16u || z == 15u || z == 17u);
  let f0_rgb = mix(vec3<f32>(ulg_dielectric_f0(ior_d)), clamp(albedo_lin * 1.08, vec3<f32>(0.08), vec3<f32>(0.98)), metallic);
  let direct = ulg_pbr_direct(n_view, v_view, l1, albedo_lin, f0_rgb, metallic, roughness, vec3<f32>(2.40, 2.38, 2.32))
    + ulg_pbr_direct(n_view, v_view, l2, albedo_lin, f0_rgb, metallic, roughness, vec3<f32>(0.72, 0.86, 1.08));
  let env = ulg_pbr_env_hemi(
    n_view, v_view, albedo_lin, f0_rgb, metallic, roughness,
    vec3<f32>(0.24, 0.34, 0.50), vec3<f32>(0.12, 0.18, 0.28), vec3<f32>(0.04, 0.06, 0.10)
  );
  let fres_q = pow(max(0.0, 1.0 - nz), 3.2) * 0.22;
  let rim_tint = select(vec3<f32>(0.18, 0.52, 0.92), vec3<f32>(0.92, 0.22, 0.14), in.charge < -0.18);
  let col = direct + env + rim_tint * fres_q;
  var out: FsOut;
  out.color = vec4<f32>(col, 1.0);
  out.depth = clamp(clip.z / max(1e-5, clip.w), 0.0, 1.0);
  return out;
}
`,f=`
${l}
${t}

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
  let n_cyl = normalize(vec3<f32>(0.0, across, cy));
  let v_cyl = vec3<f32>(0.0, 0.0, 1.0);
  let l_cyl = normalize(vec3<f32>(0.45, 0.65, 0.60));
  let alb_b = ulg_srgb_to_linear(in.color) * rail;
  let f0_b = vec3<f32>(0.045);
  let col_b = ulg_pbr_direct(n_cyl, v_cyl, l_cyl, alb_b, f0_b, 0.08, 0.28, vec3<f32>(2.30, 2.28, 2.22))
    + ulg_pbr_env_hemi(n_cyl, v_cyl, alb_b, f0_b, 0.08, 0.28, vec3<f32>(0.24, 0.32, 0.44), vec3<f32>(0.12, 0.16, 0.24), vec3<f32>(0.04, 0.06, 0.09));
  return vec4<f32>(col_b, 1.0);
}
`,p=`
${l}

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
`,m=`
${l}
${t}

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
  let rad = max(0.012, b.col_r.w) * u.field_info.w;
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
  let v_view = vec3<f32>(0.0, 0.0, 1.0);
  // Blend bead biochemistry smoothly with active living organism's solvent/pigment palette when present!
  let org_mix = clamp(u.org_tint_a.w, 0.0, 1.0);
  let bead_luma = dot(in.color, vec3<f32>(0.299, 0.587, 0.114));
  let role_sel = smoothstep(-0.2, 0.9, in.color.b - in.color.r);
  let org_col = mix(u.org_tint_b.rgb, u.org_tint_a.rgb, role_sel) * (0.62 + 0.58 * bead_luma);
  let base_rgb = mix(in.color, org_col, org_mix);
  let albedo_lin = ulg_srgb_to_linear(base_rgb);
  let f0_bio = vec3<f32>(ulg_dielectric_f0(1.42)); // Biological lipid/protein dielectric IOR ~ 1.42
  let direct = ulg_pbr_direct(n_view, v_view, l1, albedo_lin, f0_bio, 0.0, 0.30, vec3<f32>(2.40, 2.38, 2.32))
    + ulg_pbr_direct(n_view, v_view, l2, albedo_lin, f0_bio, 0.0, 0.30, vec3<f32>(0.76, 0.90, 1.08));
  let env = ulg_pbr_env_hemi(
    n_view, v_view, albedo_lin, f0_bio, 0.0, 0.30,
    vec3<f32>(0.24, 0.38, 0.48), vec3<f32>(0.12, 0.20, 0.28), vec3<f32>(0.04, 0.07, 0.10)
  );
  // Subtle glowing cutaway cross-section rim right near clipZ plane!
  let cut_rim = select(0.0, (1.0 - smoothstep(0.0, 0.85, abs(in.world_pos.z - u.extra_info.x))) * 0.55, u.extra_info.x < 90.0);
  let col = direct + env + vec3<f32>(0.12, 0.86, 0.72) * cut_rim;
  var out: FsOut;
  out.color = vec4<f32>(col, 1.0);
  out.depth = clamp(clip.z / max(1e-5, clip.w), 0.0, 1.0);
  return out;
}
`,h=`
${l}
${t}

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
  let y = in.along_across.y;
  let cy = sqrt(max(0.0, 1.0 - y * y));
  let n_c = normalize(vec3<f32>(0.0, y, cy));
  let v_c = vec3<f32>(0.0, 0.0, 1.0);
  let l_c = normalize(vec3<f32>(0.42, 0.68, 0.60));
  let alb_l = ulg_srgb_to_linear(in.color);
  let f0_l = vec3<f32>(ulg_dielectric_f0(1.42));
  let col = ulg_pbr_direct(n_c, v_c, l_c, alb_l, f0_l, 0.0, 0.34, vec3<f32>(2.25, 2.22, 2.18))
    + ulg_pbr_env_hemi(n_c, v_c, alb_l, f0_l, 0.0, 0.34, vec3<f32>(0.22, 0.34, 0.44), vec3<f32>(0.12, 0.18, 0.24), vec3<f32>(0.04, 0.06, 0.09));
  return vec4<f32>(col, 1.0);
}
`,g=`
${l}
${t}

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
    // Organism Bioenergetics & Excitable Tissue Voltage V_m (-75 mV -> +35 mV) + refractory trail
    // tinted directly by the active organism's photopigment / metabolic redox spectrum!
    let vn = clamp((s.x + 75.0) / 110.0, 0.0, 1.15);
    let refr = clamp((s.z - 0.32) * 2.4, 0.0, 1.0);
    let om = clamp(u.org_tint_a.w, 0.0, 1.0);
    let wave_c = mix(vec3<f32>(0.12, 0.72, 1.0), clamp(u.org_tint_a.rgb * 1.45, vec3<f32>(0.1), vec3<f32>(1.4)), om * 0.75);
    let peak_c = mix(vec3<f32>(1.45, 0.88, 0.22), clamp(u.org_tint_b.rgb * 1.65 + vec3<f32>(0.25), vec3<f32>(0.2), vec3<f32>(1.6)), om * 0.65);
    let refr_c = mix(vec3<f32>(0.24, 0.14, 0.54), u.org_tint_b.rgb * 0.62, om * 0.65);
    col = vec3<f32>(0.025, 0.04, 0.11);
    col = mix(col, refr_c, refr * 0.85);
    col = mix(col, wave_c, smoothstep(0.18, 0.55, vn));
    col = mix(col, peak_c, smoothstep(0.55, 0.92, vn));
    col = mix(col, vec3<f32>(1.65, 1.55, 1.35), smoothstep(0.88, 1.08, vn));
    dhx = 0.5 * (sx.x - sxm.x) * 0.02;
    dhy = 0.5 * (sy.x - sym.x) * 0.02;
  } else {
    // Organism Embryonic Turing Morphogenesis: rendered directly in the active organism's
    // actual dermal/cuticle primaryRgb (org_tint_a) & secondaryRgb (org_tint_b) pigmentation!
    let v_act = clamp(s.y * 2.3, 0.0, 1.3);
    let om = clamp(u.org_tint_a.w, 0.0, 1.0);
    let c_base = mix(vec3<f32>(0.02, 0.045, 0.09), clamp(u.org_tint_b.rgb * 0.34, vec3<f32>(0.02), vec3<f32>(0.36)), om * 0.85);
    let c_mid = mix(vec3<f32>(0.06, 0.54, 0.58), clamp(u.org_tint_b.rgb * 0.96, vec3<f32>(0.05), vec3<f32>(1.05)), om * 0.92);
    let c_hi = mix(vec3<f32>(0.22, 0.96, 0.64), clamp(u.org_tint_a.rgb * 1.24, vec3<f32>(0.10), vec3<f32>(1.28)), om * 0.92);
    let c_ridge = mix(vec3<f32>(1.28, 0.96, 0.34), clamp(u.org_tint_a.rgb * 1.48 + vec3<f32>(0.12), vec3<f32>(0.22), vec3<f32>(1.45)), om * 0.85);
    col = c_base;
    col = mix(col, c_mid, smoothstep(0.08, 0.46, v_act));
    col = mix(col, c_hi, smoothstep(0.42, 0.80, v_act));
    col = mix(col, c_ridge, smoothstep(0.76, 1.10, v_act));
    dhx = 0.5 * (sx.y - sxm.y) * 2.4;
    dhy = 0.5 * (sy.y - sym.y) * 2.4;
  }

  let n = normalize(vec3<f32>(-dhx * 16.0, 1.0, -dhy * 16.0));
  let l = normalize(vec3<f32>(0.45, 0.85, 0.35));
  let v = normalize(u.cam_pos_mode.xyz - in.world_pos);
  let f0_fld = vec3<f32>(ulg_dielectric_f0(1.38));
  let lit_fld = ulg_pbr_direct(n, v, l, col, f0_fld, 0.0, 0.32, vec3<f32>(1.85, 1.85, 1.85))
    + ulg_pbr_env_hemi(n, v, col, f0_fld, 0.0, 0.32, vec3<f32>(0.48, 0.56, 0.68), vec3<f32>(0.34, 0.40, 0.48), vec3<f32>(0.18, 0.22, 0.28));

  // Subtle physical coordinate border frame
  let edge_d = min(min(in.uv.x, 1.0 - in.uv.x), min(in.uv.y, 1.0 - in.uv.y));
  let rim = (1.0 - smoothstep(0.0, 0.012, edge_d)) * 0.25;
  return vec4<f32>(lit_fld + vec3<f32>(0.35, 0.72, 1.0) * rim, 1.0);
}
`,_=`
${l}
${t}

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
  let base_lin = ulg_srgb_to_linear(in.col_emiss.rgb);
  let emiss = max(0.0, in.col_emiss.w);
  // Zone-specific physical dielectric/metallic PBR: vivarium substrate rock (zone<1.5) vs wet dermis/chitin/mineralized shell!
  let is_floor = in.zone < 1.5;
  let is_mineral_carapace = in.zone > 3.5 && in.zone < 5.5;
  let metallic = select(0.0, 0.22, is_mineral_carapace);
  let roughness = select(select(0.32, 0.24, is_mineral_carapace), 0.68, is_floor);
  let ior_bio = select(1.44, 1.54, is_floor || is_mineral_carapace);
  let f0_bio = mix(vec3<f32>(ulg_dielectric_f0(ior_bio)), base_lin, metallic);
  let direct = ulg_pbr_direct(n, v, l1, base_lin, f0_bio, metallic, roughness, vec3<f32>(2.45, 2.42, 2.34))
    + ulg_pbr_direct(n, v, l2, base_lin, f0_bio, metallic, roughness, vec3<f32>(0.74, 0.92, 1.06));
  let env = ulg_pbr_env_hemi(
    n, v, base_lin, f0_bio, metallic, roughness,
    vec3<f32>(0.22, 0.42, 0.52), vec3<f32>(0.12, 0.24, 0.30), vec3<f32>(0.04, 0.08, 0.10)
  );
  // Subtle aquatic / bio-chamber caustic shimmer + translucent dermal subsurface wrap!
  let caust = 0.5 + 0.5 * sin(in.world_pos.x * 4.2 + u.cam_up_time.w * 2.1) * cos(in.world_pos.z * 4.5 - u.cam_up_time.w * 1.7);
  let caustic_tint = vec3<f32>(0.08, 0.30, 0.36) * caust * (0.10 + 0.16 * max(0.0, n.y));
  let sss_wrap = select(max(0.0, (dot(n, l1) + 0.45) / 1.45) * base_lin * 0.18, vec3<f32>(0.0), is_floor);
  let col = direct + env + sss_wrap + caustic_tint + in.col_emiss.rgb * emiss * 1.25;
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
`,v=`
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
`,y=`
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
`;function b(t,i,{bgStyle:a=0}={}){let l=i.getContext(`webgpu`),{format:b}=e(l,t,{preferCopySrc:!0}),x=t.createBuffer({label:`ulg-chembio-render-uniforms`,size:176,usage:n.UNIFORM|n.COPY_DST}),S=new Float32Array(44),C={depthWriteEnabled:!0,depthCompare:`less`,format:`depth24plus`},w={depthWriteEnabled:!1,depthCompare:`less`,format:`depth24plus`},T=[{format:`rgba16float`}],E=[{format:`rgba16float`,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}],ee=[{format:`rgba16float`,blend:{color:{srcFactor:`one`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}}}],D=(e,n,r,i,a,o)=>{let s=t.createShaderModule({label:e,code:n});return t.createRenderPipeline({label:e,layout:`auto`,vertex:{module:s,entryPoint:r},fragment:{module:s,entryPoint:i,targets:a},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:o})},O=D(`chembio-bg`,u,`vs_bg`,`fs_bg`,T,{depthWriteEnabled:!1,depthCompare:`always`,format:`depth24plus`}),te=D(`chembio-org-atom`,d,`vs_org_atom`,`fs_org_atom`,T,C),ne=D(`chembio-org-bond`,f,`vs_org_bond`,`fs_org_bond`,E,C),re=D(`chembio-pi-mo`,p,`vs_pi_mo`,`fs_pi_mo`,ee,w),ie=D(`chembio-bio-bead`,m,`vs_bio_bead`,`fs_bio_bead`,T,C),k=D(`chembio-bio-link`,h,`vs_bio_link`,`fs_bio_link`,T,C),ae=D(`chembio-field`,g,`vs_field`,`fs_field`,T,C),A=t.createShaderModule({label:`chembio-spec-mesh`,code:_}),j=[{arrayStride:48,attributes:[{shaderLocation:0,offset:0,format:`float32x4`},{shaderLocation:1,offset:16,format:`float32x4`},{shaderLocation:2,offset:32,format:`float32x4`}]}],M=t.createRenderPipeline({label:`chembio-spec-solid`,layout:`auto`,vertex:{module:A,entryPoint:`vs_spec_mesh`,buffers:j},fragment:{module:A,entryPoint:`fs_spec_mesh`,targets:T},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:C}),N=t.createRenderPipeline({label:`chembio-spec-glass`,layout:`auto`,vertex:{module:A,entryPoint:`vs_spec_mesh`,buffers:j},fragment:{module:A,entryPoint:`fs_spec_glass`,targets:E},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:w}),oe=t.createBindGroup({layout:M.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:x}}]}),se=t.createBindGroup({layout:N.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:x}}]}),ce=t.createShaderModule({label:`chembio-bloom`,code:v}),P=t.createRenderPipeline({label:`chembio-bloom`,layout:`auto`,vertex:{module:ce,entryPoint:`vs_bloom`},fragment:{module:ce,entryPoint:`fs_bloom`,targets:T},primitive:{topology:`triangle-list`,cullMode:`none`}}),F=t.createBuffer({label:`chembio-bloom-ext`,size:16,usage:n.UNIFORM|n.COPY_DST}),I=t.createBuffer({label:`chembio-bloom-blur`,size:16,usage:n.UNIFORM|n.COPY_DST}),L=t.createShaderModule({label:`chembio-tonemap`,code:y}),R=t.createRenderPipeline({label:`chembio-tonemap`,layout:`auto`,vertex:{module:L,entryPoint:`vs_tone`},fragment:{module:L,entryPoint:`fs_tone`,targets:[{format:b}]},primitive:{topology:`triangle-list`,cullMode:`none`}}),z=t.createSampler({magFilter:`linear`,minFilter:`linear`}),le=t.createBindGroup({layout:O.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:x}}]}),B=null,V=null,H=null,U=null,W=null,G=null,K=null,q=0,J=0,Y=!1,ue=new WeakMap,de=new WeakMap,fe=new WeakMap,pe=new WeakMap,me=new WeakMap,he=new WeakMap,X={yaw:.55,pitch:.42,dist:9.5,target:[0,0,0],fovDeg:42};function ge(){let e=Math.max(64,i.width|0),n=Math.max(64,i.height|0);if(e===q&&n===J&&B&&V&&H&&U)return;if(q=e,J=n,B)try{B.destroy()}catch{}if(V)try{V.destroy()}catch{}if(H)try{H.destroy()}catch{}if(U)try{U.destroy()}catch{}let r=Math.max(32,e>>1),a=Math.max(32,n>>1);B=t.createTexture({size:[e,n],format:`rgba16float`,usage:20}),V=t.createTexture({size:[e,n],format:`depth24plus`,usage:16}),H=t.createTexture({size:[r,a],format:`rgba16float`,usage:20}),U=t.createTexture({size:[r,a],format:`rgba16float`,usage:20}),t.queue.writeBuffer(F,0,new Float32Array([1/e,1/n,.82,0])),t.queue.writeBuffer(I,0,new Float32Array([1/r,1/a,0,1])),W=t.createBindGroup({layout:P.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:B.createView()},{binding:2,resource:z}]}),G=t.createBindGroup({layout:P.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:I}},{binding:1,resource:H.createView()},{binding:2,resource:z}]}),K=t.createBindGroup({layout:R.getBindGroupLayout(0),entries:[{binding:0,resource:B.createView()},{binding:1,resource:z},{binding:2,resource:U.createView()}]})}function _e(e={}){Number.isFinite(e.yaw)&&(X.yaw=e.yaw),Number.isFinite(e.pitch)&&(X.pitch=Math.max(-1.45,Math.min(1.45,e.pitch))),Number.isFinite(e.dist)&&(X.dist=Math.max(2.2,Math.min(48,e.dist))),Array.isArray(e.target)&&e.target.length===3&&(X.target=[e.target[0],e.target[1],e.target[2]])}function ve(e,n,r=Math.min(2,window.devicePixelRatio||1)){let a=Math.max(512,Math.min(4096,Number(t?.limits?.maxTextureDimension2D)||4096)),o=Math.max(64,Math.min(a,Math.round(e*r))),s=Math.max(64,Math.min(a,Math.round(n*r)));(i.width!==o||i.height!==s)&&(i.width=o,i.height=s),ge()}function Z(e,n,r,i){let a=e.get(r);return a||(a=t.createBindGroup({layout:n.getBindGroupLayout(0),entries:i}),e.set(r,a)),a}let Q=new Float32Array(16),$=1.6;function ye(e={}){if(Y)return;ge();let n=Math.cos(X.pitch),r=[X.target[0]+X.dist*n*Math.sin(X.yaw),X.target[1]+X.dist*Math.sin(X.pitch),X.target[2]+X.dist*n*Math.cos(X.yaw)],{view:i,right:u,up:d}=c(r,X.target,[0,1,0]);$=q/Math.max(1,J);let f=o(s(X.fovDeg*Math.PI/180,$,.1,200),i);Q.set(f),S.set(f,0),S[16]=r[0],S[17]=r[1],S[18]=r[2],S[19]=e.style||0,S[20]=u[0],S[21]=u[1],S[22]=u[2],S[23]=e.espBlend??0,S[24]=d[0],S[25]=d[1],S[26]=d[2],S[27]=e.timeSec??0,S[28]=e.fieldMode??0,S[29]=e.fieldW??128,S[30]=e.fieldH??128,S[31]=e.sphereScale??1,S[32]=Number.isFinite(Number(e.clipZ))?Number(e.clipZ):999,S[33]=e.bioLinkMode??0,S[34]=e.piPointSize??.17,S[35]=a;let p=e.orgTintA||[.22,.85,.62,0],m=e.orgTintB||[.92,.68,.24,0];S[36]=p[0]??.22,S[37]=p[1]??.85,S[38]=p[2]??.62,S[39]=p[3]??0,S[40]=m[0]??.92,S[41]=m[1]??.68,S[42]=m[2]??.24,S[43]=m[3]??0,t.queue.writeBuffer(x,0,S);let h=t.createCommandEncoder({label:`chembio-frame`}),g=h.beginRenderPass({colorAttachments:[{view:B.createView(),clearValue:{r:.008,g:.012,b:.024,a:1},loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:V.createView(),depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});if(g.setPipeline(O),g.setBindGroup(0,le),g.draw(3),e.fieldBuffer){let t=Z(he,ae,e.fieldBuffer,[{binding:0,resource:{buffer:x}},{binding:1,resource:{buffer:e.fieldBuffer}}]);g.setPipeline(ae),g.setBindGroup(0,t),g.draw(16384*6)}if(e.orgAtomsBuffer&&e.orgAtomCount>0){if(e.orgBondsBuffer&&e.orgBondCount>0){let t=Z(de,ne,e.orgBondsBuffer,[{binding:0,resource:{buffer:x}},{binding:1,resource:{buffer:e.orgAtomsBuffer}},{binding:2,resource:{buffer:e.orgBondsBuffer}}]);g.setPipeline(ne),g.setBindGroup(0,t),g.draw(6,e.orgBondCount)}let t=Z(ue,te,e.orgAtomsBuffer,[{binding:0,resource:{buffer:x}},{binding:1,resource:{buffer:e.orgAtomsBuffer}}]);if(g.setPipeline(te),g.setBindGroup(0,t),g.draw(6,e.orgAtomCount),e.piCloudBuffer&&e.piCloudCount>0&&e.showPiMo!==!1){let t=Z(fe,re,e.piCloudBuffer,[{binding:0,resource:{buffer:x}},{binding:1,resource:{buffer:e.piCloudBuffer}}]);g.setPipeline(re),g.setBindGroup(0,t),g.draw(6,e.piCloudCount)}}if(e.specimenSolidBuffer&&e.specimenSolidVertCount>0&&(g.setPipeline(M),g.setBindGroup(0,oe),g.setVertexBuffer(0,e.specimenSolidBuffer),g.draw(e.specimenSolidVertCount)),e.bioBeadsBuffer&&e.bioBeadCount>0){if(e.bioLinkCount>0&&e.bioLinkMode>0){let t=Z(me,k,e.bioBeadsBuffer,[{binding:0,resource:{buffer:x}},{binding:1,resource:{buffer:e.bioBeadsBuffer}}]);g.setPipeline(k),g.setBindGroup(0,t),g.draw(6,e.bioLinkCount)}let t=Z(pe,ie,e.bioBeadsBuffer,[{binding:0,resource:{buffer:x}},{binding:1,resource:{buffer:e.bioBeadsBuffer}}]);g.setPipeline(ie),g.setBindGroup(0,t),g.draw(6,e.bioBeadCount)}e.specimenGlassBuffer&&e.specimenGlassVertCount>0&&(g.setPipeline(N),g.setBindGroup(0,se),g.setVertexBuffer(0,e.specimenGlassBuffer),g.draw(e.specimenGlassVertCount)),g.end();let _=h.beginRenderPass({colorAttachments:[{view:H.createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:`clear`,storeOp:`store`}]});_.setPipeline(P),_.setBindGroup(0,W),_.draw(3),_.end();let v=h.beginRenderPass({colorAttachments:[{view:U.createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:`clear`,storeOp:`store`}]});v.setPipeline(P),v.setBindGroup(0,G),v.draw(3),v.end();let y=l.getCurrentTexture().createView(),b=h.beginRenderPass({colorAttachments:[{view:y,clearValue:{r:.008,g:.012,b:.024,a:1},loadOp:`clear`,storeOp:`store`}]});b.setPipeline(R),b.setBindGroup(0,K),b.draw(3),b.end(),t.queue.submit([h.finish()])}function be(){if(!Y){Y=!0;try{x.destroy()}catch{}try{F.destroy()}catch{}try{I.destroy()}catch{}if(B)try{B.destroy()}catch{}if(V)try{V.destroy()}catch{}if(H)try{H.destroy()}catch{}if(U)try{U.destroy()}catch{}}}return Object.freeze({camera:X,setCamera:_e,getViewProj:()=>Q,getAspect:()=>$,unprojectRay(e,t){let n=Math.cos(X.pitch),i=[X.target[0]+X.dist*n*Math.sin(X.yaw),X.target[1]+X.dist*Math.sin(X.pitch),X.target[2]+X.dist*n*Math.cos(X.yaw)],{right:a,up:o,forward:s}=c(i,X.target,[0,1,0]),l=Math.tan(X.fovDeg*Math.PI/180*.5);return{origin:i,dir:r([s[0]+a[0]*(e*$*l)+o[0]*(t*l),s[1]+a[1]*(e*$*l)+o[1]*(t*l),s[2]+a[2]*(e*$*l)+o[2]*(t*l)])}},projectWorld(e,t,n){let[r,i,a]=e,o=Q[0]*r+Q[4]*i+Q[8]*a+Q[12],s=Q[1]*r+Q[5]*i+Q[9]*a+Q[13],c=Q[2]*r+Q[6]*i+Q[10]*a+Q[14],l=Q[3]*r+Q[7]*i+Q[11]*a+Q[15];if(l<=.02)return{visible:!1,sx:-999,sy:-999};let u=o/l,d=s/l,f=c/l;return{visible:f>=0&&f<=1,sx:(u*.5+.5)*t,sy:(.5-d*.5)*n}},resize:ve,renderFrame:ye,dispose:be})}export{b as t};