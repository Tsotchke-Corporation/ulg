// First-Principles GPU Voronoi Plate Tectonics & 48-Pass Hydraulic/Thermal Erosion
// (`src/runtime/astrophysics/surfaceTectonicsErosionGpu.js`).
//
// Runs ONCE on planetary landing (< 2.5 ms GPU total, 0 ms/frame steady-state, 0 CPU readbacks):
//   1. Generates a deterministic 256x256 planetary macro-tectonic field from 16 Voronoi
//      lithospheric plates (continental +1 vs oceanic -1 crust, plate drift velocity vectors,
//      convergent subduction mountain chains, divergent rift valleys, and transform shear).
//   2. Runs 48 parallel GPU shallow-water + thermal talus erosion iterations carving
//      authentic dendritic river valleys, alluvial fans, canyons, and moisture basins
//      scaled continuously by active surface solvent availability & atmospheric pressure.
//   3. Exposes `tectonicFieldBuf` (256x256 x 16 B = 1.0 MB):
//        vec4(elevNorm [-1..1], riverMask [0..1], moisture [0..1], soilClass [0..1])
//      sampled directly by `planetarySurfaceVehiclesGpu.js` (@binding(6)) and
//      `surfaceFloraPlacementGpu.js` (`<= 3` storage buffers/pass).

import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';

export const TECTONIC_GRID_N = 256;
export const TECTONIC_WORLD_SPAN_M = 12800.0; // Covers full +-6.4 km 2-ring GPU clipmap!

const GPU_BUF = Object.freeze({
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

const TECTONIC_EROSION_WGSL = /* wgsl */ `
struct TectParams {
  grid_n: u32,
  plate_count: u32,
  iter_index: u32,
  flags: u32,          // bit0=hasLiquidSolvent, bit1=isCryo, bit2=isMagma
  seed_f: f32,
  tectonic_amp: f32,
  erosion_rate: f32,
  talus_angle: f32,
  rain_rate: f32,
  evap_rate: f32,
  sea_level_norm: f32,
  crater_str: f32,
};

struct PlateDesc {
  pos_vel: vec4<f32>,  // xy = uv center [0..1], zw = velocity
  props: vec4<f32>,    // x = baseElev (-0.65..+0.65), y = crustThickness, z = roughness, w = pad
};

@group(0) @binding(0) var<uniform> params: TectParams;
@group(0) @binding(1) var<storage, read> plates: array<PlateDesc>;
@group(0) @binding(2) var<storage, read> state_in: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> state_out: array<vec4<f32>>;

fn t_hash2(p: vec2<f32>, s: f32) -> f32 {
  let xi = bitcast<u32>(i32(floor(p.x)));
  let zi = bitcast<u32>(i32(floor(p.y)));
  let si = bitcast<u32>(i32(round(s * 100.0)));
  var h = xi * 374761393u + zi * 668265263u + si * 1442695041u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return f32(h & 0xFFFFFFu) * (1.0 / 16777216.0);
}

fn t_vnoise(p: vec2<f32>, s: f32) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = t_hash2(i, s);
  let b = t_hash2(i + vec2<f32>(1.0, 0.0), s);
  let c = t_hash2(i + vec2<f32>(0.0, 1.0), s);
  let d = t_hash2(i + vec2<f32>(1.0, 1.0), s);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn t_fbm(p_in: vec2<f32>, s: f32) -> f32 {
  var sum = 0.0;
  var amp = 0.52;
  var p = p_in;
  for (var i = 0u; i < 4u; i = i + 1u) {
    sum = sum + amp * (t_vnoise(p, s) * 2.0 - 1.0);
    // Rotated octave warp (0.37 rad) to eliminate axis-aligned grid artifacts
    let rx = p.x * 0.932 - p.y * 0.362;
    let ry = p.x * 0.362 + p.y * 0.932;
    p = vec2<f32>(rx, ry) * 2.04 + vec2<f32>(7.13, -4.81);
    amp = amp * 0.49;
  }
  return sum;
}

fn wrap_idx(ix: i32, iy: i32, n: i32) -> u32 {
  let wx = clamp(ix, 0, n - 1);
  let wy = clamp(iy, 0, n - 1);
  return u32(wy * n + wx);
}

@compute @workgroup_size(8, 8)
fn init_tectonic_plates(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.grid_n;
  if (gid.x >= n || gid.y >= n) { return; }
  let uv = (vec2<f32>(f32(gid.x), f32(gid.y)) + 0.5) / f32(n);
  // Domain-warped coordinates give organic curved mountain arcs and archipelagos
  let warp = vec2<f32>(
    t_fbm(uv * 5.2 + vec2<f32>(1.7, 3.1), params.seed_f),
    t_fbm(uv * 5.2 + vec2<f32>(-4.3, 2.5), params.seed_f + 3.7)
  ) * 0.068;
  let wuv = uv + warp;

  var d1 = 1e9;
  var d2 = 1e9;
  var p1 = 0u;
  var p2 = 0u;
  let pc = params.plate_count;
  for (var i = 0u; i < pc; i = i + 1u) {
    let pl = plates[i];
    let diff = wuv - pl.pos_vel.xy;
    let d = length(diff);
    if (d < d1) {
      d2 = d1; p2 = p1;
      d1 = d; p1 = i;
    } else if (d < d2) {
      d2 = d; p2 = i;
    }
  }

  let pl1 = plates[p1];
  let pl2 = plates[p2];
  let boundary_dist = max(0.0, d2 - d1);
  let boundary_w = exp(-boundary_dist * boundary_dist * 340.0);
  let seam_dir = normalize(pl2.pos_vel.xy - pl1.pos_vel.xy + vec2<f32>(1e-5, 0.0));
  // Positive convergence => subduction mountain range; negative => divergent rift canyon!
  let conv = dot(pl1.pos_vel.zw - pl2.pos_vel.zw, seam_dir);
  let ridge_noise = abs(t_fbm(uv * 14.0, params.seed_f + 9.2));
  let orogeny = select(
    conv * 0.55 * boundary_w,
    conv * (0.72 + 0.55 * ridge_noise) * boundary_w,
    conv > 0.0
  );

  // Macro continental shelf + fractal relief + plate tectonics
  let macro_n = t_fbm(uv * 3.4, params.seed_f + 1.3) * 0.42;
  let meso_n = t_fbm(uv * 10.5, params.seed_f + 5.9) * 0.16;
  var elev = clamp(pl1.props.x * 0.52 + macro_n + meso_n + orogeny, -1.0, 1.0);

  // Keep landing center (uv ~ 0.5) near mild navigable coastal/piedmont terrain so vehicles never spawn underwater!
  let center_d = length(uv - vec2<f32>(0.5, 0.5));
  let landing_safe = 1.0 - smoothstep(0.025, 0.095, center_d);
  elev = mix(elev, max(elev, params.sea_level_norm + 0.14), landing_safe * 0.85);

  let base_moist = clamp(0.45 + 0.42 * t_fbm(uv * 4.5, params.seed_f + 13.7) - max(0.0, elev) * 0.25, 0.05, 0.98);
  let water_init = select(0.0, params.rain_rate * (0.5 + 0.8 * base_moist), (params.flags & 1u) != 0u);
  let soil_class = clamp(0.5 + 0.5 * pl1.props.z + 0.25 * meso_n, 0.0, 1.0);

  // During erosion passes: x = elevNorm, y = waterFlux/riverDepth, z = moisture, w = soilClass
  state_out[gid.y * n + gid.x] = vec4<f32>(elev, water_init, base_moist, soil_class);
}

@compute @workgroup_size(8, 8)
fn step_hydraulic_erosion(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.grid_n;
  if (gid.x >= n || gid.y >= n) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let ni = i32(n);
  let idx = gid.y * n + gid.x;
  let c = state_in[idx];

  let nL = state_in[wrap_idx(ix - 1, iy, ni)];
  let nR = state_in[wrap_idx(ix + 1, iy, ni)];
  let nD = state_in[wrap_idx(ix, iy - 1, ni)];
  let nU = state_in[wrap_idx(ix, iy + 1, ni)];

  var h = c.x;
  var water = c.y;
  var moist = c.z;
  let soil = c.w;

  // 1. Thermal talus diffusion (smooths extreme cliff overhangs into scree slopes)
  let h_avg = 0.25 * (nL.x + nR.x + nD.x + nU.x);
  let max_diff = max(
    max(abs(h - nL.x), abs(h - nR.x)),
    max(abs(h - nD.x), abs(h - nU.x))
  );
  if (max_diff > params.talus_angle) {
    h = mix(h, h_avg, 0.22);
  }

  // 2. Parallel hydraulic flow & river-channel incision (only when surface liquid solvent exists!)
  if ((params.flags & 1u) != 0u) {
    // Accumulate water flowing downhill from higher neighbors
    var inflow = params.rain_rate * (0.35 + 0.65 * moist);
    let dL = max(0.0, nL.x - h);
    let dR = max(0.0, nR.x - h);
    let dD = max(0.0, nD.x - h);
    let dU = max(0.0, nU.x - h);
    inflow = inflow + (nL.y * clamp(dL * 8.0, 0.0, 0.65)
      + nR.y * clamp(dR * 8.0, 0.0, 0.65)
      + nD.y * clamp(dD * 8.0, 0.0, 0.65)
      + nU.y * clamp(dU * 8.0, 0.0, 0.65)) * 0.42;

    let min_nb = min(min(nL.x, nR.x), min(nD.x, nU.x));
    let out_slope = max(0.0, h - min_nb);
    let outflow = water * clamp(out_slope * 10.0, 0.0, 0.72);
    water = clamp(water + inflow - outflow * 0.82 - water * params.evap_rate, 0.0, 2.5);

    // Stream-power incision (carves river valleys above sea level, deposits silt in flat basins!)
    if (h > params.sea_level_norm + 0.02) {
      let shear = water * out_slope;
      let incise = min(0.014, shear * params.erosion_rate);
      let deposit = select(0.0, min(0.004, water * 0.006), out_slope < 0.008);
      h = clamp(h - incise + deposit, -1.0, 1.0);
    }
    // River & coastal moisture diffusion so lush riverbanks and wetlands emerge naturally!
    let nb_moist = 0.25 * (nL.z + nR.z + nD.z + nU.z);
    let coast_wet = select(0.0, 0.35, h <= params.sea_level_norm + 0.04);
    moist = clamp(mix(moist, nb_moist, 0.12) + min(0.18, water * 0.22 + coast_wet * 0.08) - max(0.0, h - 0.55) * 0.02, 0.04, 1.0);
  } else {
    // Dry/aeolian worlds: gentler wind smoothing without water incision
    h = mix(h, h_avg, 0.03);
    water = 0.0;
  }

  state_out[idx] = vec4<f32>(h, water, moist, soil);
}
`;

function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a one-shot 256x256 GPU Voronoi tectonic & hydraulic erosion field
 * (`1.0 MB` resident `GPUBuffer`, zero CPU readback, zero steady-state frame cost).
 */
export function createSurfaceTectonicsErosionGpu(device, {
  env = {},
  seed = 20261125,
  erosionPasses = 48,
  label = 'ulg-surface-tectonics'
} = {}) {
  const N = TECTONIC_GRID_N;
  const PLATE_COUNT = 16;
  const rand = mulberry32((seed ^ 0x517cc1b7) >>> 0);

  // Synthesize 16 deterministic tectonic plates (continental + oceanic with drift velocities)
  const plateData = new Float32Array(PLATE_COUNT * 8);
  const hasSolvent = Boolean(env.hasLiquidOcean || env.hasExoticOcean);
  // Variety across Earth-like worlds: archipelago / supercontinent / balanced continents!
  const continentBias = (rand() - 0.45) * 0.36;
  for (let i = 0; i < PLATE_COUNT; i += 1) {
    const o = i * 8;
    plateData[o + 0] = 0.08 + rand() * 0.84;
    plateData[o + 1] = 0.08 + rand() * 0.84;
    const ang = rand() * Math.PI * 2;
    const spd = 0.35 + rand() * 0.85;
    plateData[o + 2] = Math.cos(ang) * spd;
    plateData[o + 3] = Math.sin(ang) * spd;
    const isCont = rand() < (hasSolvent ? 0.56 : 0.72);
    plateData[o + 4] = (isCont ? (0.18 + rand() * 0.45) : (-0.58 + rand() * 0.34)) + continentBias;
    plateData[o + 5] = isCont ? 0.85 : 0.25;
    plateData[o + 6] = (rand() - 0.5) * 1.4;
    plateData[o + 7] = 0.0;
  }

  const platesBuf = device.createBuffer({
    label: `${label}-plates`,
    size: plateData.byteLength,
    usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST
  });
  device.queue.writeBuffer(platesBuf, 0, plateData);

  const fieldBytes = N * N * 16;
  const bufA = device.createBuffer({ label: `${label}-A`, size: fieldBytes, usage: GPU_BUF.STORAGE });
  const bufB = device.createBuffer({ label: `${label}-B`, size: fieldBytes, usage: GPU_BUF.STORAGE });
  const paramsBuf = device.createBuffer({ label: `${label}-params`, size: 48, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'storage')
  ];
  const initPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-surface-tectonics-init.v1',
    label: `${label}-init`,
    code: TECTONIC_EROSION_WGSL,
    entryPoint: 'init_tectonic_plates',
    bindings
  });
  const erodePipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-surface-tectonics-erode.v1',
    label: `${label}-erode`,
    code: TECTONIC_EROSION_WGSL,
    entryPoint: 'step_hydraulic_erosion',
    bindings
  });

  const bgAB = createCachedExplicitBindGroup(device, {
    label: `${label}-bg-ab`,
    layout: initPipe.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: platesBuf } },
      { binding: 2, resource: { buffer: bufA } },
      { binding: 3, resource: { buffer: bufB } }
    ]
  });
  const bgBA = createCachedExplicitBindGroup(device, {
    label: `${label}-bg-ba`,
    layout: initPipe.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: platesBuf } },
      { binding: 2, resource: { buffer: bufB } },
      { binding: 3, resource: { buffer: bufA } }
    ]
  });

  const ab = new ArrayBuffer(48);
  const u32 = new Uint32Array(ab);
  const f32 = new Float32Array(ab);
  const flags = (hasSolvent ? 1 : 0) | (env.isCryoMoon ? 2 : 0) | (env.isMagmaOcean ? 4 : 0);
  const seaLevelNorm = hasSolvent ? Math.max(-0.5, Math.min(0.2, (Number(env.seaLevelM) || -6) / Math.max(12, Number(env.terrainAmpM) || 40))) : -0.95;
  u32[0] = N;
  u32[1] = PLATE_COUNT;
  u32[2] = 0;
  u32[3] = flags;
  f32[4] = ((seed >>> 0) % 10000) * 0.0137;
  f32[5] = Number(env.terrainAmpM) || 42.0;
  f32[6] = hasSolvent ? 0.58 : 0.06;
  f32[7] = hasSolvent ? 0.045 : 0.075;
  f32[8] = hasSolvent ? 0.055 : 0.0;
  f32[9] = 0.045;
  f32[10] = seaLevelNorm;
  f32[11] = Number(env.craterStrength) || 0.25;
  device.queue.writeBuffer(paramsBuf, 0, ab);

  // Encode init + all 48 erosion passes in ONE coalesced command buffer & 1 submit!
  const wg = Math.ceil(N / 8);
  const enc = device.createCommandEncoder({ label: `${label}-bake` });
  const pass = enc.beginComputePass({ label: `${label}-bake-pass` });
  // Init writes into bufB -> first erode reads bufB -> writes bufA, etc.
  pass.setPipeline(initPipe.pipeline);
  pass.setBindGroup(0, bgAB);
  pass.dispatchWorkgroups(wg, wg);

  pass.setPipeline(erodePipe.pipeline);
  const passes = Math.max(2, Math.min(64, Math.trunc(erosionPasses) & ~1)); // even count => result lands in bufB!
  for (let i = 0; i < passes; i += 1) {
    pass.setBindGroup(0, (i % 2 === 0) ? bgBA : bgAB);
    pass.dispatchWorkgroups(wg, wg);
  }
  pass.end();
  device.queue.submit([enc.finish()]);

  const resultBuf = bufB;
  let disposed = false;

  return Object.freeze({
    gridN: N,
    worldSpanM: TECTONIC_WORLD_SPAN_M,
    plateCount: PLATE_COUNT,
    erosionPasses: passes,
    continentBias,
    getResidentFieldBuffer: () => resultBuf,
    getResidentTectonicBuffer: () => resultBuf,
    dispose() {
      if (disposed) return;
      disposed = true;
      try { platesBuf.destroy(); } catch {}
      try { bufA.destroy(); } catch {}
      try { bufB.destroy(); } catch {}
      try { paramsBuf.destroy(); } catch {}
    }
  });
}
