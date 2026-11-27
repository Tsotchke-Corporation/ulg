// First-Principles GPU-Instanced Planetary Flora, Xenobiota & Civilization Structures
// (`surface-flora-placement@1`, `src/runtime/astrophysics/surfaceFloraPlacementGpu.js`).
//
// Strictly Star Spec v0.4 & GPU-Native compliant:
//   - ZERO hardcoded species/planet names; vegetation density, multi-species morph
//     distribution (6 genuinely distinct sculptural plant architectures — ZERO generic
//     mushroom caps! — plus indigenous settlement domes), canopy pigments, stem Euler
//     buckling height `H ~ (9.81/g)^0.38`, seasonal snow/foliage coloration all derive
//     directly from `xenobiologyEcologyEngine.js` & live planetary physics!
//   - 7 GPU-instanced template architectures:
//       0 = Alpine Spire Conifer (tiered needle whorls)
//       1 = Multi-Branching Asymmetric Crown Arbor (forked limbs + 4 sculpted foliage clusters)
//       2 = Swept-Frond Rosette Palm / Fern (curving trunk + 6 arched radiating fronds)
//       3 = Low-g / Dense-Air Buoyant Gas-Bladder Kelp Spire (twin stalks + lifting spheres)
//       4 = Cryo / Twilight Bioluminescent Branching Coral-Crystal Tower (glowing crystalline arms)
//       5 = High-g Buttressed Armored Baobab Monolith (root buttresses + wide layered canopy)
//       6 = Indigenous Civilization Geodesic Habitation Spire + Glowing Window Band + Beacon
//   - 1 GPU compute dispatch (`@workgroup_size(64)`, `<= 3` storage buffers) populates
//     up to `1,024` 48-byte instance records (`48 KB`) whenever the player crosses a macro cell.

import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import {
  LAW_ADAPTER_MODES,
  LAW_FALLBACK_POLICIES,
  LAW_SPATIAL_AUTHORITIES
} from '../sph/lawAdapterContract.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const FLORA_GRID_SIDE = 32;
export const FLORA_MAX_INSTANCES = FLORA_GRID_SIDE * FLORA_GRID_SIDE; // 1024
export const FLORA_INSTANCE_STRIDE_BYTES = 48; // 3 x vec4<f32>

export const SURFACE_FLORA_LAW_ADAPTER = Object.freeze({
  id: 'surface-flora-placement',
  lawNodeId: 'law:astrophysics-surface-flora-placement',
  orderConstraint: 'after:surface-tectonics-erosion',
  adapterMode: LAW_ADAPTER_MODES.SURFACE_INTERFACE,
  spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
  reads: Object.freeze(['tectonic-field', 'surface-deform-field', 'xenobiology-ecology-profile']),
  writes: Object.freeze(['surface-flora-instances']),
  accumulates: Object.freeze(['flora-biome-coverage']),
  pairedVolumeState: 'not-applicable',
  conservedQuantities: Object.freeze(['euler-buckling-height-bound', 'snowline-phenology-coupling']),
  validityDomain: Object.freeze({ requiresSolidCrust: true, minPressurePa: 500 }),
  fallbackPolicy: LAW_FALLBACK_POLICIES.EXACT_SUBSTEP,
  scaleRangeM: Object.freeze([1e0, 1.5e4]),
  fundamentalLaws: Object.freeze(['euler-column-buckling', 'kiang-canopy-photobiology', 'hydrologic-moisture-carrying-capacity'])
});

export function evaluateSurfaceFloraActivation(physicalState = {}) {
  const active = Boolean(physicalState.surfaceViewActive)
    && physicalState.hasSolidCrust !== false
    && !physicalState.isMagmaOcean
    && (Number(physicalState.surfacePressurePa ?? physicalState.pressurePa) || 0) >= 500
    && (Number(physicalState.biosphereViability) || 0) >= 0.18;
  return { active, reason: active ? 'viable-surface-flora-present' : 'sterile-or-orbital-dormant' };
}

export function registerSurfaceFloraModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  if (registry.hasModule?.('surface-flora-placement@1')) {
    return registry.resolveModule('surface-flora-placement@1')?.descriptor || null;
  }
  return registry.registerModule({
    method: { model: 'surface-flora-placement', version: 1 },
    kernel: {
      sourceModule: 'src/runtime/astrophysics/surfaceFloraPlacementGpu.js',
      entryPoint: 'place_surface_flora',
      workgroupSize: 64
    },
    parameterSchema: {
      biosphereViability: { type: 'number', min: 0, max: 1, required: false }
    },
    stateLayout: {
      tensorId: 'surface-flora-instances',
      dtype: 'f32',
      layout: 'interleaved',
      strideElements: 12,
      strideBytes: 48,
      fields: ['x', 'y', 'z', 'scale', 'yaw', 'morphId', 'snowFrac', 'biolum', 'r', 'g', 'b', 'alive']
    },
    scaleRangeM: [1, 1.5e4],
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    lawAdapter: SURFACE_FLORA_LAW_ADAPTER,
    async stepCapsule(capsule, { createSimulationArtifact }) {
      const p = capsule.input?.parameters || {};
      const summary = { maxInstances: FLORA_MAX_INSTANCES, biosphereViability: Number(p.biosphereViability ?? 0.5) };
      return createSimulationArtifact?.({ schema: 'ulg.astrophysics.surface-flora-placement.v1', summary }) ?? summary;
    }
  });
}

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
  baked_flora_count: u32,
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
  buckling_scale: f32,   // Euler buckling height scale (9.81/g)^0.38
  pigment_rgb: vec4<f32>,// rgb = primary stellar photopigment, w = biosphereViability [0..1]
  season_aux: vec4<f32>, // x = autumnShift [0..1], y = civTechK [0..2], z = tectWorldSpanM, w = seaIceFrac
  pigment2_rgb: vec4<f32>, // rgb = secondary clade pigment, w = biolumBase
  arch_cdf0: vec4<f32>,  // cumulative CDF thresholds for flora kinds [0, 1, 2, 3]
  arch_cdf1: vec4<f32>,  // x = CDF for kind 4 (biolum-coral), y = CDF for kind 5 (buttressed-monolith), zw = pad
};

// 48-byte GPU instance record read directly by SURFACE_FLORA_INSTANCED_WGSL:
//   pos_scale: vec4(wx, wy_raw_ground_h, wz, scaleH)  (scaleH <= 0 => culled!)
//   rot_kind:  vec4(yawRad, radialScale, kindId [0..6], snowWeight)
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
  let u = clamp((x / span) + 0.5, 0.0, 0.9999);
  let v = clamp((z / span) + 0.5, 0.0, 0.9999);
  let n = params.tect_n;
  let gf = vec2<f32>(u * f32(n - 1u), v * f32(n - 1u));
  let i0 = vec2<u32>(u32(floor(gf.x)), u32(floor(gf.y)));
  let i1 = vec2<u32>(min(n - 1u, i0.x + 1u), min(n - 1u, i0.y + 1u));
  let f = fract(gf);
  let c00 = tectonic_field[i0.y * n + i0.x];
  let c10 = tectonic_field[i0.y * n + i1.x];
  let c01 = tectonic_field[i1.y * n + i0.x];
  let c11 = tectonic_field[i1.y * n + i1.x];
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
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
  let def = sample_def(x, z);
  let has_sph = (params.flags & 16u) != 0u;
  if (has_sph) {
    // 100% Exact match with planetarySurfaceVehiclesGpu ZERO-Perlin SPH geology elevation!
    let tect = sample_tect(x, z);
    let tect0 = sample_tect(0.0, 0.0);
    let has_ocean = (params.flags & 2u) != 0u;
    let ref_val = select(tect0.x, params.arch_cdf1.z, has_ocean);
    let sph_h = (tect.x - ref_val) * (params.terrain_amp * 3.1);
    return sph_h + def.x;
  }
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

  if (length(vec2<f32>(wx, wz)) < 22.0) {
    instances[idx] = inst;
    return;
  }

  let def = sample_def(wx, wz);
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
  let has_sph_tect = (params.flags & 16u) != 0u;
  let river_thresh = select(1.78, 0.72, has_sph_tect);
  if (has_ocean && tect.y > river_thresh && slope < 0.16) {
    instances[idx] = inst;
    return;
  }
  let moisture = tect.z;
  let viability = params.pigment_rgb.w;
  let r_sel = f_hash2(cell_x, cell_z, params.seed_f + 81.9);
  let r_sz = f_hash2(cell_x, cell_z, params.seed_f + 109.7);
  let r_sp = f_hash2(cell_x, cell_z, params.seed_f + 157.3);
  let yaw = f_hash2(cell_x, cell_z, params.seed_f + 131.3) * 6.2831853;

  let civ_k = params.season_aux.y;
  let is_civ_slot = civ_on && civ_k >= 0.35 && slope < 0.14 && h < params.snowline_m - 6.0
    && r_sel > (0.985 - min(0.06, civ_k * 0.035));

  var kind = 1.0;
  var scale_h = 0.0;
  var rad_scale = 1.0;
  var col = params.pigment_rgb.rgb;
  var emiss = 0.0;
  let snow_w = smoothstep(params.snowline_m - 6.0, params.snowline_m + 10.0, h);

  if (is_civ_slot) {
    kind = 6.0; // Indigenous habitation tower / geodesic dome with glowing warm windows!
    scale_h = (6.8 + r_sz * 11.8) * clamp(params.buckling_scale, 0.7, 1.8);
    rad_scale = 0.95 + r_sz * 0.55;
    col = mix(vec3<f32>(0.76, 0.80, 0.86), vec3<f32>(0.92, 0.84, 0.72), r_sz);
    emiss = 0.55 + 0.65 * clamp(civ_k, 0.0, 1.5);
  } else if (bio_on) {
    let alt_fade = 1.0 - smoothstep(params.snowline_m - 2.0, params.snowline_m + 22.0, h);
    let dens = clamp(viability * (0.30 + 0.76 * moisture) * alt_fade, 0.0, 0.95);
    if (r_sel > dens) {
      instances[idx] = inst;
      return;
    }
    // Select among physically-weighted flora architectures from this world's clade distribution,
    // wrapped modulo params.baked_flora_count so 0% of trees are ever culled when a planet
    // evolves fewer than 6 unique flora/fungi clades!
    if (snow_w > 0.35 && params.arch_cdf0.x > 0.08) {
      kind = 0.0; // Alpine spire conifers hug snowy ridges
    } else if (r_sp < params.arch_cdf0.x) {
      kind = 0.0;
    } else if (r_sp < params.arch_cdf0.y) {
      kind = 1.0;
    } else if (r_sp < params.arch_cdf0.z) {
      kind = 2.0;
    } else if (r_sp < params.arch_cdf0.w) {
      kind = 3.0;
    } else if (r_sp < params.arch_cdf1.x) {
      kind = 4.0;
    } else {
      kind = 5.0;
    }
    let max_k = max(1u, min(6u, params.baked_flora_count));
    kind = f32(u32(round(kind)) % max_k);

    scale_h = (5.4 + r_sz * 9.8) * clamp(params.buckling_scale, 0.52, 2.5);
    rad_scale = select(0.95 + r_sz * 0.42, 0.74 + r_sz * 0.28, kind < 0.5 || (kind > 2.5 && kind < 3.5));

    let base_pig = mix(params.pigment_rgb.rgb, params.pigment2_rgb.rgb, clamp((kind * 0.19) + r_sz * 0.35, 0.0, 1.0));
    let autumn = params.season_aux.x * select(1.0, 0.18, kind < 0.5);
    let autumn_col = vec3<f32>(0.84, 0.44, 0.14);
    col = mix(base_pig * (0.80 + 0.38 * r_sz), autumn_col, autumn * 0.72);
    col = mix(col, vec3<f32>(0.88, 0.93, 0.98), snow_w * 0.68);
    if ((params.flags & 8u) != 0u || (kind > 3.5 && kind < 4.5) || (kind > 2.5 && kind < 3.5)) {
      emiss = max(params.pigment2_rgb.w, 0.18 + 0.32 * r_sz);
    }
  } else {
    instances[idx] = inst;
    return;
  }

  // Raw uncurved ground height h — spherical curvature applied LIVE every frame in SURFACE_FLORA_INSTANCED_WGSL!
  inst.pos_scale = vec4<f32>(wx, h, wz, scale_h);
  inst.rot_kind = vec4<f32>(yaw, rad_scale, kind, snow_w);
  inst.col_emiss = vec4<f32>(col, emiss);
  instances[idx] = inst;
}
`;

/**
 * Build 7 distinct sculpted procedural 3D template meshes for GPU-instanced ecosystems
 * (each vertex = 8 floats: `pos_part(x,y,z,partId)` + `norm_kind(nx,ny,nz,kindId)`):
 *   0 = Alpine Conifer Spire
 *   1 = Multi-Branching Forked Crown Arbor (ZERO mushroom caps!)
 *   2 = Swept-Frond Rosette Palm / Fern
 *   3 = Low-g Buoyant Gas-Bladder Kelp Spire
 *   4 = Bioluminescent Branching Coral-Crystal Tower
 *   5 = High-g Buttressed Baobab Monolith
 *   6 = Indigenous Geodesic Habitation Spire + Glowing Windows + Beacon
 */
export function buildFloraTemplateMeshFloats() {
  const verts = [];
  const norm3 = (v) => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const pushTri = (p0, p1, p2, n0, n1, n2, partId, kindId) => {
    verts.push(
      p0[0], p0[1], p0[2], partId, n0[0], n0[1], n0[2], kindId,
      p1[0], p1[1], p1[2], partId, n1[0], n1[1], n1[2], kindId,
      p2[0], p2[1], p2[2], partId, n2[0], n2[1], n2[2], kindId
    );
  };
  const pushCone = (y0, y1, r0, r1, sides, partId, kindId, ox = 0, oz = 0) => {
    const dy = Math.max(1e-4, y1 - y0);
    const slope = (r0 - r1) / dy;
    for (let s = 0; s < sides; s += 1) {
      const a0 = (s / sides) * Math.PI * 2;
      const a1 = ((s + 1) / sides) * Math.PI * 2;
      const c0 = Math.cos(a0); const s0 = Math.sin(a0);
      const c1 = Math.cos(a1); const s1 = Math.sin(a1);
      const n0 = norm3([c0, slope, s0]);
      const n1 = norm3([c1, slope, s1]);
      const b0 = [ox + c0 * r0, y0, oz + s0 * r0];
      const b1 = [ox + c1 * r0, y0, oz + s1 * r0];
      const t0 = [ox + c0 * r1, y1, oz + s0 * r1];
      const t1 = [ox + c1 * r1, y1, oz + s1 * r1];
      pushTri(b0, b1, t1, n0, n1, n1, partId, kindId);
      if (r1 > 1e-4) pushTri(b0, t1, t0, n0, n1, n0, partId, kindId);
    }
  };
  const pushBranch = (pA, pB, rA, rB, sides, partId, kindId) => {
    const d = [pB[0] - pA[0], pB[1] - pA[1], pB[2] - pA[2]];
    const len = Math.hypot(d[0], d[1], d[2]);
    if (len < 1e-4) return;
    const ax = [d[0] / len, d[1] / len, d[2] / len];
    const ref = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const r = norm3(cross(ref, ax));
    const f = cross(ax, r);
    const slope = (rA - rB) / len;
    for (let s = 0; s < sides; s += 1) {
      const a0 = (s / sides) * Math.PI * 2;
      const a1 = ((s + 1) / sides) * Math.PI * 2;
      const rad0 = [r[0] * Math.cos(a0) + f[0] * Math.sin(a0), r[1] * Math.cos(a0) + f[1] * Math.sin(a0), r[2] * Math.cos(a0) + f[2] * Math.sin(a0)];
      const rad1 = [r[0] * Math.cos(a1) + f[0] * Math.sin(a1), r[1] * Math.cos(a1) + f[1] * Math.sin(a1), r[2] * Math.cos(a1) + f[2] * Math.sin(a1)];
      const n0 = norm3([rad0[0] + ax[0] * slope, rad0[1] + ax[1] * slope, rad0[2] + ax[2] * slope]);
      const n1 = norm3([rad1[0] + ax[0] * slope, rad1[1] + ax[1] * slope, rad1[2] + ax[2] * slope]);
      const b0 = [pA[0] + rad0[0] * rA, pA[1] + rad0[1] * rA, pA[2] + rad0[2] * rA];
      const b1 = [pA[0] + rad1[0] * rA, pA[1] + rad1[1] * rA, pA[2] + rad1[2] * rA];
      const u0 = [pB[0] + rad0[0] * rB, pB[1] + rad0[1] * rB, pB[2] + rad0[2] * rB];
      const u1 = [pB[0] + rad1[0] * rB, pB[1] + rad1[1] * rB, pB[2] + rad1[2] * rB];
      pushTri(b0, b1, u1, n0, n1, n1, partId, kindId);
      if (rB > 1e-4) pushTri(b0, u1, u0, n0, n1, n0, partId, kindId);
    }
  };
  const pushCluster = (cx, cy, cz, rx, ry, partId, kindId) => {
    pushCone(cy - ry * 0.7, cy, rx * 0.45, rx, 6, partId, kindId, cx, cz);
    pushCone(cy, cy + ry * 0.9, rx, 0.002, 6, partId, kindId, cx, cz);
  };

  // Kind 0: Alpine Spire Conifer (trunk + 4 layered needle tiers)
  pushCone(-0.08, 0.36, 0.075, 0.045, 5, 0.0, 0.0);
  pushCone(0.22, 0.56, 0.36, 0.08, 6, 1.0, 0.0);
  pushCone(0.44, 0.78, 0.29, 0.06, 6, 1.0, 0.0);
  pushCone(0.64, 0.94, 0.21, 0.04, 6, 1.0, 0.0);
  pushCone(0.82, 1.12, 0.13, 0.001, 5, 1.0, 0.0);

  // Kind 1: Multi-Branching Asymmetric Crown Arbor (forked branches + 4 organic crown clusters — ZERO mushroom cap!)
  pushCone(-0.08, 0.48, 0.085, 0.048, 6, 0.0, 1.0);
  const b1 = [[0.24, 0.80, 0.12, 0.23, 0.18], [-0.22, 0.76, 0.18, 0.21, 0.17], [0.06, 0.84, -0.24, 0.22, 0.18], [-0.04, 0.96, 0.02, 0.26, 0.20]];
  for (const [bx, by, bz, cr, cy] of b1) {
    pushBranch([0, 0.42, 0], [bx, by, bz], 0.042, 0.018, 4, 0.0, 1.0);
    pushCluster(bx, by, bz, cr, cy, 1.0, 1.0);
  }

  // Kind 2: Swept-Frond Rosette Palm / Fern (curving trunk + 6 arched radiating frond blades!)
  pushBranch([0, -0.08, 0], [0.05, 0.44, 0.02], 0.07, 0.048, 5, 0.0, 2.0);
  pushBranch([0.05, 0.44, 0.02], [0.02, 0.78, -0.03], 0.048, 0.036, 5, 0.0, 2.0);
  const crown2 = [0.02, 0.78, -0.03];
  for (let fi = 0; fi < 6; fi += 1) {
    const a = (fi / 6) * Math.PI * 2;
    const ca = Math.cos(a); const sa = Math.sin(a);
    const mid = [crown2[0] + ca * 0.26, crown2[1] + 0.16, crown2[2] + sa * 0.26];
    const tip = [crown2[0] + ca * 0.50, crown2[1] - 0.04, crown2[2] + sa * 0.50];
    const side = [-sa * 0.09, 0.02, ca * 0.09];
    const nUp = [0, 1, 0];
    pushTri(crown2, tip, [mid[0] + side[0], mid[1], mid[2] + side[2]], nUp, nUp, nUp, 1.0, 2.0);
    pushTri(crown2, [mid[0] - side[0], mid[1], mid[2] - side[2]], tip, nUp, nUp, nUp, 1.0, 2.0);
  }

  // Kind 3: Low-g / Dense-Air Buoyant Gas-Bladder Kelp Spire (3 slender stalks + glowing lifting bladders!)
  const kelp = [[0.0, 1.15, 0.0, 0.16], [0.14, 0.88, 0.08, 0.12], [-0.12, 0.96, -0.10, 0.13]];
  for (const [kx, ky, kz, kr] of kelp) {
    pushBranch([kx * 0.4, -0.08, kz * 0.4], [kx * 0.8, ky * 0.52, kz * 0.8], 0.032, 0.022, 4, 0.0, 3.0);
    pushBranch([kx * 0.8, ky * 0.52, kz * 0.8], [kx, ky - kr, kz], 0.022, 0.018, 4, 0.0, 3.0);
    pushCluster(kx, ky, kz, kr, kr * 1.25, 1.0, 3.0);
  }

  // Kind 4: Cryo / Twilight Bioluminescent Branching Coral-Crystal Tower!
  pushCone(-0.08, 0.36, 0.11, 0.06, 5, 0.0, 4.0);
  for (let ci = 0; ci < 5; ci += 1) {
    const a = (ci / 5) * Math.PI * 2;
    const rad = 0.26 + (ci % 2) * 0.10;
    const hTop = 0.78 + (ci % 3) * 0.14;
    const pTip = [Math.cos(a) * rad, hTop, Math.sin(a) * rad];
    pushBranch([0, 0.30, 0], pTip, 0.055, 0.018, 5, 1.0, 4.0);
    pushCluster(pTip[0], pTip[1], pTip[2], 0.07, 0.10, 1.0, 4.0);
  }

  // Kind 5: High-g Buttressed Armored Baobab Monolith (flanged roots + squat wide layered crown)
  pushCone(-0.08, 0.58, 0.24, 0.14, 7, 0.0, 5.0);
  for (let bi = 0; bi < 4; bi += 1) {
    const a = (bi / 4) * Math.PI * 2;
    pushBranch([Math.cos(a) * 0.38, -0.06, Math.sin(a) * 0.38], [Math.cos(a) * 0.14, 0.36, Math.sin(a) * 0.14], 0.06, 0.03, 4, 0.0, 5.0);
  }
  pushCluster(0, 0.72, 0, 0.46, 0.20, 1.0, 5.0);
  pushCluster(0.18, 0.80, 0.12, 0.28, 0.16, 1.0, 5.0);
  pushCluster(-0.20, 0.78, -0.10, 0.26, 0.15, 1.0, 5.0);

  // Kind 6: Indigenous Settlement Spire / Geodesic Habitation Tower + Glowing Window Band + Beacon
  pushCone(-0.08, 0.42, 0.44, 0.38, 8, 0.0, 6.0);
  pushCone(0.42, 0.54, 0.40, 0.40, 8, 2.0, 6.0);
  pushCone(0.54, 0.86, 0.38, 0.16, 8, 1.0, 6.0);
  pushCone(0.86, 1.15, 0.05, 0.01, 6, 2.0, 6.0);

  return new Float32Array(verts);
}

/**
 * Build Kind-6 Indigenous Settlement Spire floats separately so GPU-baked per-planet
 * flora atlases (`organismSdfMorphogenesisGpu.js`) can append habitation spires cleanly.
 */
export function buildSettlementTemplateFloats() {
  const full = buildFloraTemplateMeshFloats();
  const out = [];
  for (let i = 0; i < full.length; i += 8) {
    if (full[i + 7] >= 5.5) {
      out.push(full[i], full[i + 1], full[i + 2], full[i + 3], full[i + 4], full[i + 5], full[i + 6], full[i + 7]);
    }
  }
  return new Float32Array(out);
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
  let templateFloats = buildFloraTemplateMeshFloats();
  let templateVertCount = Math.floor(templateFloats.length / 8);
  let templateVertBuf = device.createBuffer({
    label: `${label}-template-verts`,
    size: templateFloats.byteLength,
    usage: GPU_BUF.VERTEX | GPU_BUF.COPY_DST
  });
  device.queue.writeBuffer(templateVertBuf, 0, templateFloats);

  let bakedFloraCount = 6;

  function replaceTemplateMesh(nextFloats, speciesCount = 6) {
    if (disposed || !(nextFloats instanceof Float32Array) || nextFloats.length < 24) return false;
    const nextCount = Math.floor(nextFloats.length / 8);
    if (nextFloats.byteLength > templateVertBuf.size) {
      const oldBuf = templateVertBuf;
      templateVertBuf = device.createBuffer({
        label: `${label}-template-verts-baked`,
        size: nextFloats.byteLength,
        usage: GPU_BUF.VERTEX | GPU_BUF.COPY_DST
      });
      try { oldBuf.destroy(); } catch {}
    }
    device.queue.writeBuffer(templateVertBuf, 0, nextFloats);
    templateFloats = nextFloats;
    templateVertCount = nextCount;
    bakedFloraCount = Math.max(1, Math.min(6, Math.trunc(Number(speciesCount) || 6)));
    lastSnapKey = '';
    return true;
  }

  const paramsBuf = device.createBuffer({
    label: `${label}-params`,
    size: 144,
    usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST
  });
  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'storage')
  ];
  const placePipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-surface-flora-placement.v3-baked-wrap',
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

  const ab = new ArrayBuffer(144);
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
      && xeno?.solvent !== 'H2-He-cloud'
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
    const snapKey = `${snapX}:${snapZ}:${Math.round(snowlineM)}:${Math.round(autumnShift * 20)}:${bakedFloraCount}`;
    if (!force && snapKey === lastSnapKey) {
      activeCount = FLORA_MAX_INSTANCES;
      return false;
    }
    lastSnapKey = snapKey;
    activeCount = FLORA_MAX_INSTANCES;

    const flags = (bioActive ? 1 : 0)
      | ((env.hasLiquidOcean || env.hasExoticOcean) ? 2 : 0)
      | (civActive ? 4 : 0)
      | (xeno?.solvent && xeno.solvent !== 'H2O' ? 8 : 0)
      | (env.hasSphGeology ? 16 : 0);

    // Cumulative CDF from world's derived floraArchWeights [6]
    const w = Array.isArray(xeno?.floraArchWeights) && xeno.floraArchWeights.length === 6
      ? xeno.floraArchWeights
      : [0.35, 0.45, 0.10, 0.03, 0.03, 0.04];
    let c0 = w[0];
    let c1 = c0 + w[1];
    let c2 = c1 + w[2];
    let c3 = c2 + w[3];
    let c4 = c3 + w[4];
    const tot = Math.max(1e-4, c4 + w[5]);
    c0 /= tot; c1 /= tot; c2 /= tot; c3 /= tot; c4 /= tot;

    u32[0] = FLORA_GRID_SIDE;
    u32[1] = flags;
    u32[2] = tectN;
    u32[3] = bakedFloraCount;
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
    const pig2 = xeno?.secondaryPigmentRgb || [0.24, 0.62, 0.26];
    f32[16] = pig[0];
    f32[17] = pig[1];
    f32[18] = pig[2];
    f32[19] = Number(xeno?.biosphereViability) || 0.5;
    f32[20] = autumnShift;
    f32[21] = Number(xeno?.civTechK) || 0.0;
    f32[22] = tectWorldSpanM;
    f32[23] = seaIceFrac;
    f32[24] = pig2[0];
    f32[25] = pig2[1];
    f32[26] = pig2[2];
    f32[27] = xeno?.solvent !== 'H2O' ? 0.28 : 0.0;
    f32[28] = c0;
    f32[29] = c1;
    f32[30] = c2;
    f32[31] = c3;
    f32[32] = c4;
    f32[33] = 1.0;
    f32[34] = Number.isFinite(Number(env.sphSeaLevelNorm)) ? Number(env.sphSeaLevelNorm) : 0.0;
    f32[35] = 0.0;
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
    get templateVertCount() { return templateVertCount; },
    get activeInstanceCount() { return activeCount; },
    getResidentInstancesBuffer: () => instanceBuf,
    getResidentTemplateVertBuffer: () => templateVertBuf,
    replaceTemplateMesh,
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
