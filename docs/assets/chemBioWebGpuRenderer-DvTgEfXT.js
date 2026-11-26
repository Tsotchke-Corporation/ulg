import{t as e}from"./webgpuCompat-C1bfdHJP.js";var t=Object.freeze({COPY_DST:8,UNIFORM:64,STORAGE:128});function n(e){let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]}function r(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function i(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function a(e,t){let n=new Float32Array(16);for(let r=0;r<4;r+=1)for(let i=0;i<4;i+=1)n[r*4+i]=e[0+i]*t[r*4+0]+e[4+i]*t[r*4+1]+e[8+i]*t[r*4+2]+e[12+i]*t[r*4+3];return n}function o(e,t,n,r){let i=1/Math.tan(e*.5),a=1/(n-r),o=new Float32Array(16);return o[0]=i/Math.max(.1,t),o[5]=i,o[10]=r*a,o[11]=-1,o[14]=r*n*a,o}function s(e,t,a){let o=n([e[0]-t[0],e[1]-t[1],e[2]-t[2]]),s=n(r(a,o)),c=r(o,s),l=new Float32Array(16);return l[0]=s[0],l[4]=s[1],l[8]=s[2],l[12]=-i(s,e),l[1]=c[0],l[5]=c[1],l[9]=c[2],l[13]=-i(c,e),l[2]=o[0],l[6]=o[1],l[10]=o[2],l[14]=-i(o,e),l[3]=0,l[7]=0,l[11]=0,l[15]=1,{view:l,right:s,up:c,forward:[-o[0],-o[1],-o[2]]}}var c=`
struct RenderUniforms {
  view_proj: mat4x4<f32>,
  cam_pos_mode: vec4<f32>,   // xyz = camPos, w = renderStyle
  cam_right_esp: vec4<f32>,  // xyz = camRight, w = espBlend (0..1)
  cam_up_time: vec4<f32>,    // xyz = camUp, w = timeSec
  field_info: vec4<f32>,     // x = fieldMode, y = fieldW, z = fieldH, w = sphereScale
  extra_info: vec4<f32>,     // x = countA, y = countB, z = pointSize, w = bgStyle (0=org, 1=bio)
};
`,l=`
${c}
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
`,u=`
${c}

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
  let wpos = a.pos_m.xyz + to_cam * (rad * 0.72) + (u.cam_right_esp.xyz * qv.x + u.cam_up_time.xyz * qv.y) * rad;
  var out: VsOut;
  out.pos = u.view_proj * vec4<f32>(wpos, 1.0);
  out.local_uv = qv;
  out.color = mix(a.vis_z.rgb, esp_color(a.vel_q.w), u.cam_right_esp.w);
  out.charge = a.vel_q.w;
  out.world_pos = a.pos_m.xyz;
  return out;
}

@fragment
fn fs_org_atom(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let nz = sqrt(max(0.0, 1.0 - r2));
  let n_view = normalize(vec3<f32>(in.local_uv.x, in.local_uv.y, nz));
  let l1 = normalize(vec3<f32>(0.55, 0.72, 0.58));
  let l2 = normalize(vec3<f32>(-0.65, -0.35, 0.55));
  let diff1 = max(dot(n_view, l1), 0.0);
  let diff2 = max(dot(n_view, l2), 0.0) * 0.35;
  let h1 = normalize(l1 + vec3<f32>(0.0, 0.0, 1.0));
  let spec = pow(max(dot(n_view, h1), 0.0), 42.0) * 0.85;
  let fres = pow(max(0.0, 1.0 - nz), 3.0) * 0.42;
  let rim_tint = select(vec3<f32>(0.38, 0.76, 1.0), vec3<f32>(1.0, 0.45, 0.32), in.charge < -0.18);
  let col = in.color * (0.24 + 0.92 * diff1 + diff2) + vec3<f32>(spec) + rim_tint * fres;
  return vec4<f32>(col, 1.0);
}
`,d=`
${c}

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
`,f=`
${c}

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
`,p=`
${c}

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
};

@vertex
fn vs_bio_bead(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VsOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let qv = quad[vid];
  let b = beads[iid];
  let rad = max(0.06, b.col_r.w) * u.field_info.w;
  let to_cam = normalize(u.cam_pos_mode.xyz - b.pos_a.xyz);
  let wpos = b.pos_a.xyz + to_cam * (rad * 0.65) + (u.cam_right_esp.xyz * qv.x + u.cam_up_time.xyz * qv.y) * rad;
  var out: VsOut;
  out.pos = u.view_proj * vec4<f32>(wpos, 1.0);
  out.local_uv = qv;
  out.color = b.col_r.rgb;
  out.aux = b.vel_b.w;
  return out;
}

@fragment
fn fs_bio_bead(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let nz = sqrt(max(0.0, 1.0 - r2));
  let n_view = normalize(vec3<f32>(in.local_uv.x, in.local_uv.y, nz));
  let l1 = normalize(vec3<f32>(0.48, 0.78, 0.56));
  let l2 = normalize(vec3<f32>(-0.55, -0.30, 0.62));
  let diff = max(dot(n_view, l1), 0.0) * 0.92 + max(dot(n_view, l2), 0.0) * 0.30;
  let h1 = normalize(l1 + vec3<f32>(0.0, 0.0, 1.0));
  let spec = pow(max(dot(n_view, h1), 0.0), 34.0) * 0.65;
  let fres = pow(max(0.0, 1.0 - nz), 2.8) * 0.38;
  let col = in.color * (0.26 + diff) + vec3<f32>(spec) + in.color * fres * 0.85;
  return vec4<f32>(col, 1.0);
}
`,m=`
${c}

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
  // Cull wrapped / detached links cleanly
  if (dist < 1e-4 || dist > 3.6) {
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
  let thick = select(0.16, 0.10, link_mode == 2u) * u.field_info.w;
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
`,h=`
${c}

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
  let gx = 96u;
  let gy = 96u;
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
  let sy = sample_field_bilinear(in.uv + vec2<f32>(0.0, eps));
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
    dhx = (sx.x - sx.y) - (s.x - s.y);
    dhy = (sy.x - sy.y) - (s.x - s.y);
  } else if (fmode == 1u) {
    // Belousov-Zhabotinsky Oregonator Spiral Waves: midnight indigo -> blazing cyan -> incandescent gold!
    let u_act = clamp(s.x, 0.0, 1.2);
    let v_inh = clamp(s.y * 2.2, 0.0, 1.2);
    col = vec3<f32>(0.03, 0.04, 0.12);
    col = mix(col, vec3<f32>(0.18, 0.28, 0.78), smoothstep(0.06, 0.55, v_inh));
    col = mix(col, vec3<f32>(0.12, 0.92, 1.0), smoothstep(0.18, 0.65, u_act));
    col = mix(col, vec3<f32>(1.35, 0.92, 0.28), smoothstep(0.60, 0.96, u_act));
    dhx = sx.x - s.x;
    dhy = sy.x - s.x;
  } else if (fmode == 2u) {
    // Prebiotic RAF Autocatalytic Network: warm amber feedstock + emerald autocatalyst + glowing violet polymer!
    let f_feed = clamp(s.x, 0.0, 1.2);
    let x_cat = clamp(s.y * 1.4, 0.0, 1.3);
    let y_pol = clamp(s.z * 1.4, 0.0, 1.3);
    col = vec3<f32>(0.04, 0.05, 0.09)
      + vec3<f32>(0.42, 0.24, 0.06) * f_feed * 0.65
      + vec3<f32>(0.10, 0.95, 0.56) * x_cat * 0.95
      + vec3<f32>(0.68, 0.36, 1.25) * y_pol * 0.95;
    dhx = (sx.y + sx.z) - (s.y + s.z);
    dhy = (sy.y + sy.z) - (s.y + s.z);
  } else if (fmode == 3u) {
    // Hodgkin-Huxley Excitable Membrane Voltage V_m (-75 mV -> +35 mV) + refractory K+ h/n trail!
    let vn = clamp((s.x + 75.0) / 110.0, 0.0, 1.15);
    let refr = clamp((s.z - 0.32) * 2.4, 0.0, 1.0);
    col = vec3<f32>(0.025, 0.04, 0.11);
    col = mix(col, vec3<f32>(0.24, 0.14, 0.54), refr * 0.85);
    col = mix(col, vec3<f32>(0.12, 0.72, 1.0), smoothstep(0.18, 0.55, vn));
    col = mix(col, vec3<f32>(1.45, 0.88, 0.22), smoothstep(0.55, 0.92, vn));
    col = mix(col, vec3<f32>(1.65, 1.55, 1.35), smoothstep(0.88, 1.08, vn));
    dhx = (sx.x - s.x) * 0.02;
    dhy = (sy.x - s.x) * 0.02;
  } else {
    // Turing Morphogenesis: deep navy basin -> emerald teal -> glowing golden morphogen ridges!
    let v_act = clamp(s.y * 2.3, 0.0, 1.3);
    col = vec3<f32>(0.02, 0.055, 0.11);
    col = mix(col, vec3<f32>(0.06, 0.54, 0.58), smoothstep(0.08, 0.48, v_act));
    col = mix(col, vec3<f32>(0.22, 0.96, 0.64), smoothstep(0.42, 0.82, v_act));
    col = mix(col, vec3<f32>(1.28, 0.96, 0.34), smoothstep(0.78, 1.12, v_act));
    dhx = (sx.y - s.y) * 2.4;
    dhy = (sy.y - s.y) * 2.4;
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
`,g=`
@group(0) @binding(0) var hdr_tex: texture_2d<f32>;
@group(0) @binding(1) var hdr_samp: sampler;

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
  let mapped = aces_film(hdr * 1.12);
  let srgb = pow(max(mapped, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.2));
  return vec4<f32>(srgb, 1.0);
}
`;function _(n,r,{bgStyle:i=0}={}){let c=r.getContext(`webgpu`),{format:_}=e(c,n,{preferCopySrc:!0}),v=n.createBuffer({label:`ulg-chembio-render-uniforms`,size:144,usage:t.UNIFORM|t.COPY_DST}),y=new Float32Array(36),b={depthWriteEnabled:!0,depthCompare:`less`,format:`depth24plus`},x={depthWriteEnabled:!1,depthCompare:`less`,format:`depth24plus`},S=[{format:`rgba16float`}],C=[{format:`rgba16float`,blend:{color:{srcFactor:`one`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}}}],w=(e,t,r,i,a,o)=>{let s=n.createShaderModule({label:e,code:t});return n.createRenderPipeline({label:e,layout:`auto`,vertex:{module:s,entryPoint:r},fragment:{module:s,entryPoint:i,targets:a},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:o})},T=w(`chembio-bg`,l,`vs_bg`,`fs_bg`,S,{depthWriteEnabled:!1,depthCompare:`always`,format:`depth24plus`}),E=w(`chembio-org-atom`,u,`vs_org_atom`,`fs_org_atom`,S,b),D=w(`chembio-org-bond`,d,`vs_org_bond`,`fs_org_bond`,S,b),O=w(`chembio-pi-mo`,f,`vs_pi_mo`,`fs_pi_mo`,C,x),k=w(`chembio-bio-bead`,p,`vs_bio_bead`,`fs_bio_bead`,S,b),A=w(`chembio-bio-link`,m,`vs_bio_link`,`fs_bio_link`,S,b),j=w(`chembio-field`,h,`vs_field`,`fs_field`,S,b),M=n.createShaderModule({label:`chembio-tonemap`,code:g}),N=n.createRenderPipeline({label:`chembio-tonemap`,layout:`auto`,vertex:{module:M,entryPoint:`vs_tone`},fragment:{module:M,entryPoint:`fs_tone`,targets:[{format:_}]},primitive:{topology:`triangle-list`,cullMode:`none`}}),P=n.createSampler({magFilter:`linear`,minFilter:`linear`}),F=n.createBindGroup({layout:T.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:v}}]}),I=null,L=null,R=null,z=0,B=0,V=!1,H=new WeakMap,U=new WeakMap,W=new WeakMap,G=new WeakMap,K=new WeakMap,q=new WeakMap,J={yaw:.55,pitch:.42,dist:9.5,target:[0,0,0],fovDeg:42};function Y(){let e=Math.max(64,r.width|0),t=Math.max(64,r.height|0);if(!(e===z&&t===B&&I&&L)){if(z=e,B=t,I)try{I.destroy()}catch{}if(L)try{L.destroy()}catch{}I=n.createTexture({size:[e,t],format:`rgba16float`,usage:20}),L=n.createTexture({size:[e,t],format:`depth24plus`,usage:16}),R=n.createBindGroup({layout:N.getBindGroupLayout(0),entries:[{binding:0,resource:I.createView()},{binding:1,resource:P}]})}}function X(e={}){Number.isFinite(e.yaw)&&(J.yaw=e.yaw),Number.isFinite(e.pitch)&&(J.pitch=Math.max(-1.45,Math.min(1.45,e.pitch))),Number.isFinite(e.dist)&&(J.dist=Math.max(2.2,Math.min(48,e.dist))),Array.isArray(e.target)&&e.target.length===3&&(J.target=[e.target[0],e.target[1],e.target[2]])}function ee(e,t,n=Math.min(2,window.devicePixelRatio||1)){let i=Math.max(64,Math.round(e*n)),a=Math.max(64,Math.round(t*n));(r.width!==i||r.height!==a)&&(r.width=i,r.height=a),Y()}function Z(e,t,r,i){let a=e.get(r);return a||(a=n.createBindGroup({layout:t.getBindGroupLayout(0),entries:i}),e.set(r,a)),a}let Q=new Float32Array(16),$=1.6;function te(e={}){if(V)return;Y();let t=Math.cos(J.pitch),r=[J.target[0]+J.dist*t*Math.sin(J.yaw),J.target[1]+J.dist*Math.sin(J.pitch),J.target[2]+J.dist*t*Math.cos(J.yaw)],{view:l,right:u,up:d}=s(r,J.target,[0,1,0]);$=z/Math.max(1,B);let f=a(o(J.fovDeg*Math.PI/180,$,.1,200),l);Q.set(f),y.set(f,0),y[16]=r[0],y[17]=r[1],y[18]=r[2],y[19]=e.style||0,y[20]=u[0],y[21]=u[1],y[22]=u[2],y[23]=e.espBlend??0,y[24]=d[0],y[25]=d[1],y[26]=d[2],y[27]=e.timeSec??0,y[28]=e.fieldMode??0,y[29]=e.fieldW??128,y[30]=e.fieldH??128,y[31]=e.sphereScale??1,y[32]=e.countA??0,y[33]=e.bioLinkMode??0,y[34]=e.piPointSize??.17,y[35]=i,n.queue.writeBuffer(v,0,y);let p=n.createCommandEncoder({label:`chembio-frame`}),m=p.beginRenderPass({colorAttachments:[{view:I.createView(),clearValue:{r:.008,g:.012,b:.024,a:1},loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:L.createView(),depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});if(m.setPipeline(T),m.setBindGroup(0,F),m.draw(3),e.fieldBuffer){let t=Z(q,j,e.fieldBuffer,[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:e.fieldBuffer}}]);m.setPipeline(j),m.setBindGroup(0,t),m.draw(9216*6)}if(e.orgAtomsBuffer&&e.orgAtomCount>0){if(e.orgBondsBuffer&&e.orgBondCount>0){let t=Z(U,D,e.orgBondsBuffer,[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:e.orgAtomsBuffer}},{binding:2,resource:{buffer:e.orgBondsBuffer}}]);m.setPipeline(D),m.setBindGroup(0,t),m.draw(6,e.orgBondCount)}let t=Z(H,E,e.orgAtomsBuffer,[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:e.orgAtomsBuffer}}]);if(m.setPipeline(E),m.setBindGroup(0,t),m.draw(6,e.orgAtomCount),e.piCloudBuffer&&e.piCloudCount>0&&e.showPiMo!==!1){let t=Z(W,O,e.piCloudBuffer,[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:e.piCloudBuffer}}]);m.setPipeline(O),m.setBindGroup(0,t),m.draw(6,e.piCloudCount)}}if(e.bioBeadsBuffer&&e.bioBeadCount>0){if(e.bioLinkCount>0&&e.bioLinkMode>0){let t=Z(K,A,e.bioBeadsBuffer,[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:e.bioBeadsBuffer}}]);m.setPipeline(A),m.setBindGroup(0,t),m.draw(6,e.bioLinkCount)}let t=Z(G,k,e.bioBeadsBuffer,[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:e.bioBeadsBuffer}}]);m.setPipeline(k),m.setBindGroup(0,t),m.draw(6,e.bioBeadCount)}m.end();let h=c.getCurrentTexture().createView(),g=p.beginRenderPass({colorAttachments:[{view:h,clearValue:{r:.008,g:.012,b:.024,a:1},loadOp:`clear`,storeOp:`store`}]});g.setPipeline(N),g.setBindGroup(0,R),g.draw(3),g.end(),n.queue.submit([p.finish()])}function ne(){if(!V){V=!0;try{v.destroy()}catch{}if(I)try{I.destroy()}catch{}if(L)try{L.destroy()}catch{}}}return Object.freeze({camera:J,setCamera:X,getViewProj:()=>Q,getAspect:()=>$,projectWorld(e,t,n){let[r,i,a]=e,o=Q[0]*r+Q[4]*i+Q[8]*a+Q[12],s=Q[1]*r+Q[5]*i+Q[9]*a+Q[13],c=Q[2]*r+Q[6]*i+Q[10]*a+Q[14],l=Q[3]*r+Q[7]*i+Q[11]*a+Q[15];if(l<=.02)return{visible:!1,sx:-999,sy:-999};let u=o/l,d=s/l,f=c/l;return{visible:f>=0&&f<=1,sx:(u*.5+.5)*t,sy:(.5-d*.5)*n}},resize:ee,renderFrame:te,dispose:ne})}export{_ as t};