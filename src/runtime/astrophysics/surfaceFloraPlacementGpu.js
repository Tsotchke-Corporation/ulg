// First-Principles GPU-Instanced Planetary Flora, Xenobiota & Civilization Structures
// (`src/runtime/astrophysics/surfaceFloraPlacementGpu.js`).
//
// Strictly Star Spec v0.4 & GPU-Native compliant:
//   - ZERO hardcoded species/planet names; vegetation density, canopy pigment, stem
//     buckling height `H ~ (9.81/g)^0.45`, seasonal snow/foliage coloration, and
//     emergent indigenous settlement towers all derive directly from live physics!
//   - 1 GPU compute dispatch (`@workgroup_size(64)`, `<= 3` storage buffers) populates
//     up to `1,024` 48-byte instance records (`48 KB`) whenever the player moves across
//     a macro cell or seasonal snowline shifts — 0 ms steady-state cost!
//   - Rendered via hardware instancing (`SURFACE_FLORA_INSTANCED_WGSL`) in 1 draw call.

import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';

export const FLORA_GRID_SIDE = 32;
export const FLORA_MAX_INSTANCES = FLORA_GRID_SIDE * FLORA_GRID_SIDE; // 1024
export const FLORA_INSTANCE_STRIDE_BYTES = 48; // 3 x vec4<f32>

const GPU_BUF = Object.freeze({
  COPY_DST: 0x0008,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

const FLORA_PLACEMENT_WGSL = /* wgsl */ `
struct FloraParams {
  grid_side: u32,
  flags: u32,            // bit0=biosphereActive, bit1=hasLiquidOcean, bit2=hasCiv, bit3=isExoticSolvent
  tect_n: u32,
  pad0: u32,
  center_x: f32,
  center_z: f32,
  spacing_m: f32,
  seed_f: f32,
  terrain_amp: f32,
  crater_str: f32,
  sea_level: f32,
  snowline_m: f32,
  curv_inv_2r: f32,
  focus_x: f32,
  focus_z: f32,
  buckling_scale: f32,   // Euler buckling height scale (9.81/g)^0.45
  pigment_rgb: vec4<f32>,// rgb = Wien stellar photosynthetic pigment, w = biosphereViability [0..1]
  season_aux: vec4<f32>, // x = autumnShift [0..1], y = civTechK [0..2], z = tectWorldSpanM, w = seaIceFrac
};

// 48-byte GPU instance record read directly by SURFACE_FLORA_INSTANCED_WGSL:
//   pos_scale: vec4(wx, wy_curved, wz, scaleH)  (scaleH <= 0 => culled!)
//   rot_kind:  vec4(yawRad, radialScale, kindId, snowWeight)  kind: 0=conifer, 1=broadleaf/xeno, 2=settlement
//   col_emiss: vec4(r, g, b, emissiveWindow)
struct FloraInstance {
  pos_scale: vec4<f32>,
  rot_kind: vec4<f32>,
  col_emiss: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: FloraParams;
@group(0) @binding(1) var<storage, read> tectonic_field: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> deform_field: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> instances: array<FloraInstance>;

fn f_hash2(ix: f32, iz: f32, s: f32) -> f32 {
  let xi = bitcast<u32>(i32(floor(ix)));
  let zi = bitcast<u32>(i32(floor(iz)));
  let si = bitcast<u32>(i32(round(s * 100.0)));
  var h = xi * 374761393u + zi * 668265263u + si * 1442695041u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return f32(h & 0xFFFFFFu) * (1.0 / 16777216.0);
}

fn f_vnoise2(x: f32, z: f32, s: f32) -> f32 {
  let ix = floor(x); let iz = floor(z);
  let fx = x - ix; let fz = z - iz;
  let ux = fx * fx * (3.0 - 2.0 * fx);
  let uz = fz * fz * (3.0 - 2.0 * fz);
  let a = f_hash2(ix, iz, s);
  let b = f_hash2(ix + 1.0, iz, s);
  let c = f_hash2(ix, iz + 1.0, s);
  let d = f_hash2(ix + 1.0, iz + 1.0, s);
  return mix(mix(a, b, ux), mix(c, d, ux), uz);
}

fn f_fbm2(x_in: f32, z_in: f32, s: f32) -> f32 {
  var sum = 0.0; var amp = 0.52; var fx = x_in; var fz = z_in;
  for (var i = 0u; i < 4u; i = i + 1u) {
    sum = sum + amp * (f_vnoise2(fx, fz, s) * 2.0 - 1.0);
    fx = fx * 2.03 + 11.7; fz = fz * 2.03 - 7.3; amp = amp * 0.48;
  }
  return sum;
}

fn sample_tect(x: f32, z: f32) -> vec4<f32> {
  let span = max(1000.0, params.season_aux.z);
  let u = clamp((x / span) + 0.5, 0.0, 0.999);
  let v = clamp((z / span) + 0.5, 0.0, 0.999);
  let n = params.tect_n;
  let ix = min(n - 1u, u32(floor(u * f32(n))));
  let iy = min(n - 1u, u32(floor(v * f32(n))));
  return tectonic_field[iy * n + ix];
}

fn sample_def(x: f32, z: f32) -> vec4<f32> {
  let half_m = 384.0;
  if (abs(x) >= half_m || abs(z) >= half_m) { return vec4<f32>(0.0); }
  let u = clamp((x / half_m) * 0.5 + 0.5, 0.0, 0.999);
  let v = clamp((z / half_m) * 0.5 + 0.5, 0.0, 0.999);
  let ix = min(127u, u32(floor(u * 127.0)));
  let iy = min(127u, u32(floor(v * 127.0)));
  return deform_field[iy * 128u + ix];
}

fn f_crater_field(x: f32, z: f32, scale: f32, s: f32) -> f32 {
  let sx = x * scale; let sz = z * scale;
  let cx = floor(sx); let cz = floor(sz);
  var best = 0.0;
  for (var dz = -1; dz <= 1; dz = dz + 1) {
    for (var dx = -1; dx <= 1; dx = dx + 1) {
      let gx = cx + f32(dx); let gz = cz + f32(dz);
      let h = f_hash2(gx, gz, s + 7.3);
      if (h < 0.56) { continue; }
      let ox = gx + 0.18 + 0.64 * f_hash2(gx, gz, s + 19.1);
      let oz = gz + 0.18 + 0.64 * f_hash2(gx, gz, s + 37.7);
      let rad = 0.22 + 0.28 * f_hash2(gx, gz, s + 53.3);
      let d = length(vec2<f32>(sx - ox, sz - oz)) / rad;
      if (d < 1.38) {
        if (d < 0.84) {
          let q = d / 0.84;
          best = best - 0.42 * (1.0 - q * q);
        } else {
          let rt = (d - 0.84) / 0.54;
          best = best + 0.19 * sin(rt * 3.14159265) * (1.0 - 0.35 * rt);
        }
      }
    }
  }
  return best;
}

fn eval_ground_h(x: f32, z: f32) -> f32 {
  let r0 = length(vec2<f32>(x, z));
  let a = clamp((r0 - 18.0) / 52.0, 0.0, 1.0);
  let apron = a * a * (3.0 - 2.0 * a);
  let rolling = f_fbm2(x * 0.0055, z * 0.0055, params.seed_f) * params.terrain_amp;
  let ridge = abs(f_fbm2(x * 0.011 + 5.1, z * 0.011 - 3.4, params.seed_f + 2.1)) * (params.terrain_amp * 0.36);
  let detail = f_fbm2(x * 0.032, z * 0.032, params.seed_f + 4.9) * (params.terrain_amp * 0.08);
  var craters = 0.0;
  if (params.crater_str > 0.02) {
    craters = (f_crater_field(x, z, 0.0075, params.seed_f) * params.terrain_amp * 0.72
      + f_crater_field(x, z, 0.024, params.seed_f + 11.0) * params.terrain_amp * 0.24) * params.crater_str;
  }
  let tect = sample_tect(x, z);
  let tect_blend = smoothstep(240.0, 560.0, r0);
  let tect_h = tect.x * (params.terrain_amp * 0.42) * tect_blend;
  let def = sample_def(x, z);
  return (rolling + ridge * 0.45 + detail + craters + tect_h) * (0.10 + 0.90 * apron) + def.x;
}

@compute @workgroup_size(64)
fn place_surface_flora(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  let side = params.grid_side;
  let total = side * side;
  if (idx >= total) { return; }

  var inst: FloraInstance;
  inst.pos_scale = vec4<f32>(0.0, -9999.0, 0.0, 0.0);
  inst.rot_kind = vec4<f32>(0.0);
  inst.col_emiss = vec4<f32>(0.0);

  let bio_on = (params.flags & 1u) != 0u;
  let civ_on = (params.flags & 4u) != 0u;
  if (!bio_on && !civ_on) {
    instances[idx] = inst;
    return;
  }

  let gx = idx % side;
  let gz = idx / side;
  let half = f32(side) * 0.5;
  let cell_x = floor(params.center_x / params.spacing_m) + (f32(gx) - half);
  let cell_z = floor(params.center_z / params.spacing_m) + (f32(gz) - half);

  let jx = (f_hash2(cell_x, cell_z, params.seed_f + 17.3) - 0.5) * 0.78;
  let jz = (f_hash2(cell_x, cell_z, params.seed_f + 43.1) - 0.5) * 0.78;
  let wx = (cell_x + 0.5 + jx) * params.spacing_m;
  let wz = (cell_z + 0.5 + jz) * params.spacing_m;

  // Keep immediate spawn pad (r < 22 m) clear for Rover/UFO landing
  if (length(vec2<f32>(wx, wz)) < 22.0) {
    instances[idx] = inst;
    return;
  }

  let def = sample_def(wx, wz);
  // Scorched/vaporized laser or missile craters burn away vegetation!
  if (def.w > 0.35 || def.y > 600.0 || def.x < -1.0) {
    instances[idx] = inst;
    return;
  }

  let h = eval_ground_h(wx, wz);
  let has_ocean = (params.flags & 2u) != 0u;
  if (has_ocean && h < params.sea_level + 1.2) {
    instances[idx] = inst;
    return;
  }

  let eps = 3.5;
  let hL = eval_ground_h(wx - eps, wz);
  let hR = eval_ground_h(wx + eps, wz);
  let hD = eval_ground_h(wx, wz - eps);
  let hU = eval_ground_h(wx, wz + eps);
  let n_vec = normalize(vec3<f32>(hL - hR, 2.0 * eps, hD - hU));
  let slope = 1.0 - clamp(n_vec.y, 0.0, 1.0);
  if (slope > 0.44) {
    instances[idx] = inst;
    return;
  }

  let tect = sample_tect(wx, wz);
  if (has_ocean && tect.y > 1.78 && slope < 0.12) {
    instances[idx] = inst;
    return;
  }
  let moisture = tect.z;
  let viability = params.pigment_rgb.w;
  let r_sel = f_hash2(cell_x, cell_z, params.seed_f + 81.9);
  let r_sz = f_hash2(cell_x, cell_z, params.seed_f + 109.7);
  let yaw = f_hash2(cell_x, cell_z, params.seed_f + 131.3) * 6.2831853;

  // Check for indigenous civilization settlement spire on flat fertile lowlands!
  let civ_k = params.season_aux.y;
  let is_civ_slot = civ_on && civ_k >= 0.35 && slope < 0.14 && h < params.snowline_m - 6.0
    && r_sel > (0.985 - min(0.06, civ_k * 0.035));

  var kind = 0.0;
  var scale_h = 0.0;
  var rad_scale = 1.0;
  var col = params.pigment_rgb.rgb;
  var emiss = 0.0;
  let snow_w = smoothstep(params.snowline_m - 6.0, params.snowline_m + 10.0, h);

  if (is_civ_slot) {
    kind = 2.0; // Indigenous habitation tower / geodesic dome with glowing warm windows!
    scale_h = (6.5 + r_sz * 11.5) * clamp(params.buckling_scale, 0.7, 1.8);
    rad_scale = 0.95 + r_sz * 0.55;
    col = mix(vec3<f32>(0.76, 0.80, 0.86), vec3<f32>(0.92, 0.84, 0.72), r_sz);
    emiss = 0.55 + 0.65 * clamp(civ_k, 0.0, 1.5);
  } else if (bio_on) {
    // Biological flora density modulated by moisture, viability & altitude!
    let alt_fade = 1.0 - smoothstep(params.snowline_m - 2.0, params.snowline_m + 22.0, h);
    let dens = clamp(viability * (0.28 + 0.78 * moisture) * alt_fade, 0.0, 0.95);
    if (r_sel > dens) {
      instances[idx] = inst;
      return;
    }
    let is_alpine = snow_w > 0.25 || (r_sz < 0.45 && moisture < 0.55);
    kind = select(1.0, 0.0, is_alpine);
    scale_h = (5.2 + r_sz * 9.8) * clamp(params.buckling_scale, 0.55, 2.4);
    rad_scale = select(1.05 + r_sz * 0.45, 0.72 + r_sz * 0.30, is_alpine);

    // Emergent orbital autumn / seasonal foliage hue shift & alpine snow dusting
    let autumn = params.season_aux.x * select(1.0, 0.18, is_alpine);
    let autumn_col = vec3<f32>(0.82, 0.42, 0.14);
    col = mix(params.pigment_rgb.rgb * (0.78 + 0.42 * r_sz), autumn_col, autumn * 0.72);
    col = mix(col, vec3<f32>(0.88, 0.93, 0.98), snow_w * 0.68);
    // Exotic cryo-solvent worlds can exhibit subtle bioluminescence!
    if ((params.flags & 8u) != 0u) {
      emiss = 0.18 + 0.28 * r_sz;
    }
  } else {
    instances[idx] = inst;
    return;
  }

  // Store raw uncurved ground height h — spherical curvature -(dx^2+dz^2)*curv_inv_2r is applied
  // LIVE every frame in SURFACE_FLORA_INSTANCED_WGSL so trees NEVER sink into terrain or hop when moving!
  inst.pos_scale = vec4<f32>(wx, h, wz, scale_h);
  inst.rot_kind = vec4<f32>(yaw, rad_scale, kind, snow_w);
  inst.col_emiss = vec4<f32>(col, emiss);
  instances[idx] = inst;
}
`;

/**
 * Build a compact 3D template mesh vertex buffer for GPU-instanced trees, alien
 * flora canopies, and indigenous civilization domes (each vertex = 8 floats:
 * `pos_part(x,y,z,partId)` + `norm_kind(nx,ny,nz,kindId)` where `partId`:
 * `0 = trunk/base`, `1 = canopy/dome`, `2 = lit window/beacon`).
 */
export function buildFloraTemplateMeshFloats() {
  const verts = [];
  const pushTri = (p0, p1, p2, n0, n1, n2, partId, kindId) => {
    verts.push(
      p0[0], p0[1], p0[2], partId, n0[0], n0[1], n0[2], kindId,
      p1[0], p1[1], p1[2], partId, n1[0], n1[1], n1[2], kindId,
      p2[0], p2[1], p2[2], partId, n2[0], n2[1], n2[2], kindId
    );
  };
  const pushCone = (y0, y1, r0, r1, sides, partId, kindId) => {
    const dy = Math.max(1e-4, y1 - y0);
    const slope = (r0 - r1) / dy;
    for (let s = 0; s < sides; s += 1) {
      const a0 = (s / sides) * Math.PI * 2;
      const a1 = ((s + 1) / sides) * Math.PI * 2;
      const c0 = Math.cos(a0); const s0 = Math.sin(a0);
      const c1 = Math.cos(a1); const s1 = Math.sin(a1);
      const l0 = Math.hypot(c0, slope, s0) || 1;
      const l1 = Math.hypot(c1, slope, s1) || 1;
      const n0 = [c0 / l0, slope / l0, s0 / l0];
      const n1 = [c1 / l1, slope / l1, s1 / l1];
      const b0 = [c0 * r0, y0, s0 * r0];
      const b1 = [c1 * r0, y0, s1 * r0];
      const t0 = [c0 * r1, y1, s0 * r1];
      const t1 = [c1 * r1, y1, s1 * r1];
      pushTri(b0, b1, t1, n0, n1, n1, partId, kindId);
      if (r1 > 1e-4) pushTri(b0, t1, t0, n0, n1, n0, partId, kindId);
    }
  };

  // Kind 0: Conifer / Alpine Tree (trunk + 3 layered tiered pine cones)
  pushCone(-0.05, 0.34, 0.08, 0.05, 5, 0.0, 0.0);
  pushCone(0.24, 0.62, 0.36, 0.08, 6, 1.0, 0.0);
  pushCone(0.48, 0.84, 0.28, 0.05, 6, 1.0, 0.0);
  pushCone(0.70, 1.05, 0.19, 0.001, 6, 1.0, 0.0);

  // Kind 1: Broadleaf / Xenobiota Canopy Tree (tapered stem + broad domed layered crown)
  pushCone(-0.05, 0.48, 0.09, 0.05, 6, 0.0, 1.0);
  pushCone(0.42, 0.72, 0.26, 0.48, 7, 1.0, 1.0);
  pushCone(0.72, 1.00, 0.48, 0.18, 7, 1.0, 1.0);
  pushCone(0.98, 1.08, 0.18, 0.001, 7, 1.0, 1.0);

  // Kind 2: Indigenous Settlement Spire / Geodesic Habitation Tower + Glowing Window Band + Beacon
  pushCone(-0.05, 0.42, 0.44, 0.38, 8, 0.0, 2.0);
  pushCone(0.42, 0.54, 0.40, 0.40, 8, 2.0, 2.0); // Glowing warm habitation windows!
  pushCone(0.54, 0.86, 0.38, 0.16, 8, 1.0, 2.0);
  pushCone(0.86, 1.15, 0.05, 0.01, 6, 2.0, 2.0); // Radio/optical spire beacon!

  return new Float32Array(verts);
}

export function createSurfaceFloraPlacementGpu(device, {
  tectonicFieldBuf,
  deformFieldBuf,
  label = 'ulg-surface-flora'
} = {}) {
  const instanceBuf = device.createBuffer({
    label: `${label}-instances`,
    size: FLORA_MAX_INSTANCES * FLORA_INSTANCE_STRIDE_BYTES,
    usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST
  });
  const templateFloats = buildFloraTemplateMeshFloats();
  const templateVertCount = Math.floor(templateFloats.length / 8);
  const templateVertBuf = device.createBuffer({
    label: `${label}-template-verts`,
    size: templateFloats.byteLength,
    usage: GPU_BUF.VERTEX | GPU_BUF.COPY_DST
  });
  device.queue.writeBuffer(templateVertBuf, 0, templateFloats);

  const paramsBuf = device.createBuffer({
    label: `${label}-params`,
    size: 96,
    usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST
  });
  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'storage')
  ];
  const placePipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-surface-flora-placement.v1',
    label: `${label}-place`,
    code: FLORA_PLACEMENT_WGSL,
    entryPoint: 'place_surface_flora',
    bindings
  });
  const bg = createCachedExplicitBindGroup(device, {
    label: `${label}-bg`,
    layout: placePipe.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: tectonicFieldBuf } },
      { binding: 2, resource: { buffer: deformFieldBuf } },
      { binding: 3, resource: { buffer: instanceBuf } }
    ]
  });

  const ab = new ArrayBuffer(96);
  const u32 = new Uint32Array(ab);
  const f32 = new Float32Array(ab);
  let lastSnapKey = '';
  let activeCount = 0;
  let disposed = false;

  function encodePlacementIfNeeded(encoder, {
    centerX = 0,
    centerZ = 0,
    focusX = 0,
    focusZ = 0,
    env = {},
    xeno = null,
    snowlineM = 28.0,
    autumnShift = 0.0,
    seaIceFrac = 0.0,
    tectWorldSpanM = 12800.0,
    tectN = 256,
    force = false
  } = {}) {
    if (disposed) return false;
    const allowSurfaceFlora = Boolean(
      env?.hasSolidCrust
      && !env?.isMagmaOcean
      && !env?.isMinorBody
      && !env?.isComet
      && !env?.isCryoMoon
      && (Number(env?.pressurePa) || 0) >= 500
      && xeno?.solvent !== 'H2O-subsurface'
      && xeno?.solvent !== 'none'
    );
    const bioActive = allowSurfaceFlora && Boolean(xeno && xeno.biosphereViability >= 0.18);
    const civActive = allowSurfaceFlora && Boolean(xeno && xeno.civTechK >= 0.35);
    if (!bioActive && !civActive) {
      activeCount = 0;
      return false;
    }
    const spacingM = 26.0;
    const snapX = Math.floor(centerX / spacingM);
    const snapZ = Math.floor(centerZ / spacingM);
    const snapKey = `${snapX}:${snapZ}:${Math.round(snowlineM)}:${Math.round(autumnShift * 20)}`;
    if (!force && snapKey === lastSnapKey) {
      activeCount = FLORA_MAX_INSTANCES;
      return false;
    }
    lastSnapKey = snapKey;
    activeCount = FLORA_MAX_INSTANCES;

    const flags = (bioActive ? 1 : 0)
      | ((env.hasLiquidOcean || env.hasExoticOcean) ? 2 : 0)
      | (civActive ? 4 : 0)
      | (xeno?.solvent && xeno.solvent !== 'H2O' ? 8 : 0);

    u32[0] = FLORA_GRID_SIDE;
    u32[1] = flags;
    u32[2] = tectN;
    u32[3] = 0;
    f32[4] = centerX;
    f32[5] = centerZ;
    f32[6] = spacingM;
    f32[7] = (((Number(env.seed) || 1) % 997) * 0.13) + 1.7;
    f32[8] = Number(env.terrainAmpM) || 42.0;
    f32[9] = Number(env.craterStrength) || 0.2;
    f32[10] = Number(env.seaLevelM) || -6.0;
    f32[11] = snowlineM;
    f32[12] = env.hasSolidCrust ? (1.0 / (2.0 * (Number(env.tinyPlanetCurvatureRadiusM) || 2800.0))) : 0.0;
    f32[13] = focusX;
    f32[14] = focusZ;
    f32[15] = Number(xeno?.bucklingHeightScale) || 1.0;
    const pig = xeno?.pigmentRgb || [0.16, 0.52, 0.22];
    f32[16] = pig[0];
    f32[17] = pig[1];
    f32[18] = pig[2];
    f32[19] = Number(xeno?.biosphereViability) || 0.5;
    f32[20] = autumnShift;
    f32[21] = Number(xeno?.civTechK) || 0.0;
    f32[22] = tectWorldSpanM;
    f32[23] = seaIceFrac;
    device.queue.writeBuffer(paramsBuf, 0, ab);

    const pass = encoder.beginComputePass({ label: `${label}-pass` });
    pass.setPipeline(placePipe.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(FLORA_MAX_INSTANCES / 64));
    pass.end();
    return true;
  }

  return Object.freeze({
    maxInstances: FLORA_MAX_INSTANCES,
    templateVertCount,
    get activeInstanceCount() { return activeCount; },
    getResidentInstancesBuffer: () => instanceBuf,
    getResidentTemplateVertBuffer: () => templateVertBuf,
    encodePlacementIfNeeded,
    dispose() {
      if (disposed) return;
      disposed = true;
      try { instanceBuf.destroy(); } catch {}
      try { templateVertBuf.destroy(); } catch {}
      try { paramsBuf.destroy(); } catch {}
    }
  });
}
