// Gate 5A (10^+6 -> 10^+13 m): WebGPU Polytope-Atlas Planetary Interior
// Hydrostatic Structure & Symplectic / Scale-Atlas Multi-Body GPU Dynamics
// (`src/runtime/astrophysics/planetaryStructureGpu.js`).
//
// Bridges Gate 1-2 first-principles material bundles & Convex Polytope Atlases
// directly to planetary astrophysics on WebGPU:
//   1. `buildPlanetaryPolytopeAtlasWebGpu`: fits high-pressure (up to 1 TPa)
//      convex `A x <= b` + Chebyshev density polytopes strictly on WebGPU via
//      Gate 2 `fitConvexPolytopeWebGpu` over real Gate 1-2 material bundles.
//   2. `solvePlanetaryInteriorWebGpu`: integrates radial hydrostatic equilibrium
//      `dM/dr = 4 pi r^2 rho(P, T)` and `dP/dr = -G M(r) rho(P, T) / r^2`
//      directly inside a `@workgroup_size(64)` WebGPU compute shader evaluating
//      `eval_polytope_atlas_bank_2d` (`evaluatePolytopeAtlasWgsl`) inline —
//      strictly FAIL-CLOSED (`valid: false`, `reason: 'polytope-out-of-domain'`)
//      whenever any pressure/temperature state falls outside the polytope envelope!
//   3. `runSymplecticPlanetaryNBodyWebGpu`: symplectic Velocity-Verlet / Leapfrog
//      GPU N-body integrator (exact direct for compact systems or canonical
//      `SchroederScaleAtlas` multipole gravity for large-N planetary disks).

import { evaluateBundleDensityEos } from '../material/polytopeAtlasBuilder.js';
import { createMaterialPolytopeRegistry } from '../material/materialPolytopeRegistry.js';
import { fitConvexPolytopeWebGpu } from '../gpuMath/chebyshevPolytopeFitGpu.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import {
  createSchroederScaleAtlasGravitySolverWebGpu
} from '../sph/schroederScaleAtlasMultipoleGpu.js';
import {
  ULG_ACCURACY_TIERS,
  ULG_POLYTOPE_ATLAS_SCHEMA,
  evaluatePolytopeAtlasWgsl,
  packPolytopeAtlasBankForGpu,
  packPolytopeAtlasForGpu
} from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_PLANETARY_INTERIOR_SCHEMA = 'ulg.astrophysics.planetary-interior-polytope.v1';
export const ULG_PLANETARY_INTERIOR_GPU_SCHEMA = 'ulg.astrophysics.planetary-interior-webgpu.v1';
export const ULG_PLANETARY_NBODY_GPU_SCHEMA = 'ulg.astrophysics.planetary-symplectic-gpu.v1';

const G_SI = 6.67430e-11;
const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x01,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  UNIFORM: 0x40,
  STORAGE: 0x80
});

// Offline G7 advisory planetary references (PREM / NASA fact sheet — advisory only!)
export const G7_ADVISORY_PLANETARY_REFERENCES = Object.freeze({
  earth: Object.freeze({ massKg: 5.9722e24, radiusM: 6.371e6, moiFactor: 0.3307, centralPressureGPa: 364 }),
  mars: Object.freeze({ massKg: 6.4171e23, radiusM: 3.3895e6, moiFactor: 0.3644, centralPressureGPa: 40 })
});

/**
 * Compile a high-pressure planetary Convex Polytope Atlas (`1e4 .. 1e12 Pa`,
 * up to 1 TPa) strictly on WebGPU via Gate 2 `fitConvexPolytopeWebGpu` directly
 * from any Gate 1–2 material bundle (e.g. `Fe`, `SiO2`, `Al2O3`, `H2O`, `H2`).
 */
export async function buildPlanetaryPolytopeAtlasWebGpu(device, bundle, {
  minPressurePa = 1e4,
  maxPressurePa = 1e12,
  maxTemperatureK = 12000,
  degrees = [5, 5],
  relativeTolerance = 2.5e-2,
  maxBisectDepth = 3,
  materialIndex = 0
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('buildPlanetaryPolytopeAtlasWebGpu requires a live WebGPU GPUDevice');
  }
  if (!bundle || typeof bundle !== 'object' || !bundle.mechanical || !bundle.thermodynamic) {
    throw new TypeError('buildPlanetaryPolytopeAtlasWebGpu requires a valid Gate 1-2 material bundle');
  }
  const registry = createMaterialPolytopeRegistry();
  const tMelt = Math.max(15, Number(bundle.thermodynamic.meltingPointK ?? 300));
  const tBoil = Math.max(tMelt + 20, Number(bundle.thermodynamic.boilingPointK ?? tMelt * 1.5));
  const tIon = Math.max(tBoil * 2.5, Number(maxTemperatureK));
  const basePolytopes = registry.discoverMaterialPolytopes({
    materialKey: bundle.materialKey || bundle.symbol || bundle.formula,
    family: bundle.family || 'element',
    meltingPointK: tMelt,
    boilingPointK: tBoil,
    ionizationTempK: tIon,
    meltingSlopeKPerLogP: Number(bundle.thermodynamic.meltingSlopeKPerLogP ?? 120),
    boilingSlopeKPerLogP: Number(bundle.thermodynamic.boilingSlopeKPerLogP ?? 220),
    maxTemperatureK: Math.max(tIon * 1.5, Number(maxTemperatureK) * 1.5),
    minPressurePa: Number(minPressurePa),
    maxPressurePa: Number(maxPressurePa),
    accuracyTier: bundle.accuracyTier || ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    closureHash: bundle.closureHash || 'planetary-v1',
    provenance: bundle.provenance || { status: 'webgpu-derived', scientificValidation: false }
  });

  const allFitted = [];
  for (const poly of basePolytopes) {
    // Fit solid/liquid/gas/plasma in log-density space for guaranteed positivity and tight multi-decade accuracy
    const fitted = await fitConvexPolytopeWebGpu(
      device,
      poly,
      (T, P) => evaluateBundleDensityEos(bundle, poly.phase, T, P),
      {
        degrees,
        relativeTolerance,
        requirePositive: true,
        maxDepth: maxBisectDepth,
        propertyName: 'densityKgPerM3',
        logScale: true
      }
    );
    allFitted.push(...fitted.polytopes);
  }

  const packedGpuAtlas = packPolytopeAtlasForGpu(allFitted, { materialIndex });
  return Object.freeze({
    schema: ULG_POLYTOPE_ATLAS_SCHEMA,
    materialKey: bundle.materialKey || bundle.symbol || bundle.formula,
    minPressurePa: Number(minPressurePa),
    maxPressurePa: Number(maxPressurePa),
    polytopeCount: allFitted.length,
    polytopes: Object.freeze(allFitted),
    packedGpuAtlas,
    accuracyTier: bundle.accuracyTier || ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    provenance: Object.freeze({
      status: 'webgpu-polytope-fitted',
      scientificValidation: false
    })
  });
}

// =========================================================================
// WebGPU Radial Planetary Hydrostatic Equilibrium Solver (Inline Polytope Atlas!)
// =========================================================================
export const planetaryInteriorPolytopeWgsl = /* wgsl */ `
${evaluatePolytopeAtlasWgsl}

struct PlanetParams {
  model_count: u32,
  layer_count: u32,
  max_profile_samples: u32,
  converge_passes: u32,
  surface_pressure_pa: f32,
  radial_step_m: f32,
  max_radius_m: f32,
  g_si: f32,
};

// Layer spec: vec4(cum_mass_frac, temp_k, material_id_f32, pad)
// Model spec: vec4(central_pressure_pa, initial_est_mass_kg, pad0, pad1)
// Model out (3 vec4 per model):
//   [m*3 + 0]: vec4(total_mass_kg, radius_m, moi_factor, status_code)
//              status_code: 1.0 = converged-valid, 2.0 = fail-closed-polytope-out-of-domain, 3.0 = hit-max-radius
//   [m*3 + 1]: vec4(mean_density, surface_gravity, escape_vel, sample_count)
//   [m*3 + 2]: vec4(fail_pressure_pa, fail_temp_k, fail_layer_idx, min_polytope_margin)
@group(0) @binding(0) var<uniform> params: PlanetParams;
@group(0) @binding(1) var<storage, read> atlas_bank: array<f32>;
@group(0) @binding(2) var<storage, read> layer_specs: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> model_specs: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> model_out: array<vec4<f32>>;
// Profile buffer for model 0: 2 vec4 per sample:
//   [s*2 + 0]: vec4(radius_m, pressure_pa, density_kg_m3, mass_enclosed_kg)
//   [s*2 + 1]: vec4(gravity_m_s2, layer_idx_f32, phase_code, hit_flag)
@group(0) @binding(5) var<storage, read_write> profile_out: array<vec4<f32>>;

fn pick_layer_idx(mass_frac: f32) -> u32 {
  let n = params.layer_count;
  for (var i = 0u; i < n; i = i + 1u) {
    if (mass_frac <= layer_specs[i].x || i + 1u == n) {
      return i;
    }
  }
  return max(1u, n) - 1u;
}

@compute @workgroup_size(64)
fn solve_planetary_hydrostatic(@builtin(global_invocation_id) gid: vec3<u32>) {
  let mid = gid.x;
  if (mid >= params.model_count) { return; }

  let mspec = model_specs[mid];
  let p_center = mspec.x;
  var est_mass = max(1.0e20, mspec.y);
  let dr = max(2000.0, params.radial_step_m);
  let max_steps = u32(min(50000.0, ceil(params.max_radius_m / dr)));

  var final_mass = 0.0;
  var final_radius = 0.0;
  var final_moi = 0.0;
  var status_code = 1.0;
  var fail_p = 0.0;
  var fail_t = 0.0;
  var fail_layer = -1.0;
  var min_margin = 1.0e30;
  var sample_count = 0u;

  let passes = max(1u, params.converge_passes);
  for (var iter_pass = 0u; iter_pass < passes; iter_pass = iter_pass + 1u) {
    var r = 0.0;
    var m = 0.0;
    var p_cur = p_center;
    var I_moi_scaled = 0.0;
    var failed = false;
    var cur_samples = 0u;
    var pass_min_margin = 1.0e30;
    let is_last = (iter_pass + 1u == passes);

    for (var s = 0u; s < max_steps; s = s + 1u) {
      if (p_cur <= params.surface_pressure_pa || r >= params.max_radius_m) {
        break;
      }
      let lidx = pick_layer_idx(m / max(1.0e20, est_mass));
      let lspec = layer_specs[lidx];
      let temp_k = lspec.y;
      let mat_id = lspec.z;

      // Inline Gate 2 Convex Polytope Atlas evaluation (strictly fail-closed!)
      let eval_res = eval_polytope_atlas_bank_2d(&atlas_bank, mat_id, temp_k, p_cur);
      if (eval_res.w < 0.5 || !(eval_res.x > 0.0)) {
        failed = true;
        status_code = 2.0;
        fail_p = p_cur;
        fail_t = temp_k;
        fail_layer = f32(lidx);
        break;
      }
      let rho = eval_res.x;
      pass_min_margin = min(pass_min_margin, eval_res.y);

      // Midpoint RK2 radial hydrostatic step
      let r_mid = r + 0.5 * dr;
      let dM = 12.566370614 * r_mid * r_mid * rho * dr;
      let m_mid = m + 0.5 * dM;
      let g = select(0.0, (params.g_si * m_mid) / (r_mid * r_mid), r_mid > 1.0);
      let dP = -rho * g * dr;

      if (is_last && mid == 0u && cur_samples < params.max_profile_samples && ((s & 1u) == 0u || s < 16u)) {
        profile_out[cur_samples * 2u + 0u] = vec4<f32>(r, p_cur, rho, m);
        profile_out[cur_samples * 2u + 1u] = vec4<f32>(g, f32(lidx), eval_res.z, eval_res.w);
        cur_samples = cur_samples + 1u;
      }

      m = m + dM;
      // Scale into (Mm)^2 * (Yg) so f32 never overflows (>3.4e38) for planetary/substellar bodies
      let r_mm = r_mid * 1.0e-6;
      let dm_yg = dM * 1.0e-24;
      I_moi_scaled = I_moi_scaled + (2.0 / 3.0) * r_mm * r_mm * dm_yg;
      p_cur = p_cur + dP;
      r = r + dr;
    }

    if (failed) {
      final_mass = m;
      final_radius = r;
      final_moi = I_moi_scaled;
      sample_count = cur_samples;
      min_margin = -1.0;
      break;
    }
    status_code = select(1.0, 3.0, r >= params.max_radius_m && p_cur > params.surface_pressure_pa);
    final_mass = m;
    final_radius = r;
    final_moi = I_moi_scaled;
    est_mass = max(1.0e20, m);
    min_margin = pass_min_margin;
    sample_count = cur_samples;
  }

  let vol = (4.0 / 3.0) * 3.14159265359 * final_radius * final_radius * final_radius;
  let mean_rho = final_mass / max(1.0, vol);
  let surf_g = (params.g_si * final_mass) / max(1.0, final_radius * final_radius);
  let v_esc = sqrt((2.0 * params.g_si * final_mass) / max(1.0, final_radius));
  let r_final_mm = final_radius * 1.0e-6;
  let m_final_yg = final_mass * 1.0e-24;
  let moi_factor = final_moi / max(1.0e-20, m_final_yg * r_final_mm * r_final_mm);

  model_out[mid * 3u + 0u] = vec4<f32>(final_mass, final_radius, moi_factor, status_code);
  model_out[mid * 3u + 1u] = vec4<f32>(mean_rho, surf_g, v_esc, f32(sample_count));
  model_out[mid * 3u + 2u] = vec4<f32>(fail_p, fail_t, fail_layer, min_margin);
}
`;

/**
 * Integrate radial planetary hydrostatic equilibrium strictly on WebGPU using
 * packed Gate 2 Convex Polytope Atlases (`eval_polytope_atlas_bank_2d`).
 *
 * Strictly FAIL-CLOSED: returns `{ valid: false, failClosed: true, reason: 'polytope-out-of-domain' }`
 * whenever ANY layer query falls outside its packed Convex Polytope Atlas!
 *
 * Each layer accepts either a pre-built `atlas` (`buildPlanetaryPolytopeAtlasWebGpu`
 * or `packedGpuAtlas`) OR a Gate 1–2 `bundle` (auto-fitted up to `maxPressurePa` on GPU).
 */
export async function solvePlanetaryInteriorWebGpu(device, {
  centralPressurePa = 360e9,
  surfacePressurePa = 1e5,
  layers = [],
  radialStepM = 20000,
  maxRadiusM = 1.5e8,
  convergePasses = 3,
  maxProfileSamples = 256,
  autoFitMaxPressurePa = 1e12
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('solvePlanetaryInteriorWebGpu requires a live WebGPU GPUDevice');
  }
  if (!Array.isArray(layers) || layers.length === 0) {
    throw new TypeError('solvePlanetaryInteriorWebGpu requires at least one material layer');
  }

  // Ensure every layer has a real packed Convex Polytope Atlas
  const resolvedLayers = [];
  for (let i = 0; i < layers.length; i += 1) {
    const l = layers[i];
    let packedGpuAtlas = l.packedGpuAtlas || l.atlas?.packedGpuAtlas || null;
    if (!packedGpuAtlas && Array.isArray(l.polytopes) && l.polytopes.length > 0) {
      packedGpuAtlas = packPolytopeAtlasForGpu(l.polytopes, { materialIndex: i });
    }
    if (!packedGpuAtlas && l.bundle) {
      const built = await buildPlanetaryPolytopeAtlasWebGpu(device, l.bundle, {
        maxPressurePa: autoFitMaxPressurePa,
        materialIndex: i
      });
      packedGpuAtlas = built.packedGpuAtlas;
    }
    if (!packedGpuAtlas) {
      throw new TypeError(`Layer ${i} (${l.name || 'unnamed'}) must provide packedGpuAtlas, atlas, polytopes, or bundle`);
    }
    resolvedLayers.push({
      name: l.name || l.bundle?.materialKey || l.atlas?.materialKey || `layer-${i}`,
      massFractionTarget: Math.max(0, Number(l.massFractionTarget ?? 1)),
      tempK: Math.max(10, Number(l.tempK ?? 1500)),
      bundle: l.bundle || null,
      packedGpuAtlas,
      materialId: i
    });
  }

  const bank = packPolytopeAtlasBankForGpu(resolvedLayers.map((l) => ({
    materialId: l.materialId,
    materialKey: l.name,
    accuracyTier: l.bundle?.accuracyTier || ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    packedGpuAtlas: l.packedGpuAtlas
  })));

  const totalFrac = resolvedLayers.reduce((s, l) => s + l.massFractionTarget, 0) || 1;
  const layerData = new Float32Array(resolvedLayers.length * 4);
  let cum = 0;
  for (let i = 0; i < resolvedLayers.length; i += 1) {
    cum += resolvedLayers[i].massFractionTarget / totalFrac;
    layerData.set([cum, resolvedLayers[i].tempK, resolvedLayers[i].materialId, 0], i * 4);
  }

  const modelSpecs = new Float32Array([Number(centralPressurePa), 6e24, 0, 0]);
  const pAb = new ArrayBuffer(32);
  new Uint32Array(pAb, 0, 4).set([1, resolvedLayers.length, maxProfileSamples, convergePasses]);
  new Float32Array(pAb, 16, 4).set([Number(surfacePressurePa), Number(radialStepM), Number(maxRadiusM), G_SI]);

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage')
  ];
  const pipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-planetary-hydrostatic-polytope.v1',
    label: 'ulg-planetary-hydrostatic-polytope',
    code: planetaryInteriorPolytopeWgsl,
    entryPoint: 'solve_planetary_hydrostatic',
    bindings
  });

  const pBuf = device.createBuffer({ size: 32, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const bankBuf = device.createBuffer({ size: Math.max(64, bank.data.byteLength), usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  const layerBuf = device.createBuffer({ size: Math.max(16, layerData.byteLength), usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  const specBuf = device.createBuffer({ size: 16, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  const outBuf = device.createBuffer({ size: 48, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const profBuf = device.createBuffer({ size: maxProfileSamples * 32, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const readOut = device.createBuffer({ size: 48, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
  const readProf = device.createBuffer({ size: maxProfileSamples * 32, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });

  try {
    device.queue.writeBuffer(pBuf, 0, pAb);
    device.queue.writeBuffer(bankBuf, 0, bank.data);
    device.queue.writeBuffer(layerBuf, 0, layerData);
    device.queue.writeBuffer(specBuf, 0, modelSpecs);

    const bg = device.createBindGroup({
      layout: pipe.bindGroupLayout,
      entries: [pBuf, bankBuf, layerBuf, specBuf, outBuf, profBuf].map((buffer, binding) => ({ binding, resource: { buffer } }))
    });
    const enc = device.createCommandEncoder({ label: 'ulg-planetary-hydrostatic' });
    const pass = enc.beginComputePass();
    pass.setPipeline(pipe.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(1);
    pass.end();
    enc.copyBufferToBuffer(outBuf, 0, readOut, 0, 48);
    enc.copyBufferToBuffer(profBuf, 0, readProf, 0, maxProfileSamples * 32);
    device.queue.submit([enc.finish()]);

    await Promise.all([
      readOut.mapAsync(GPU_BUFFER_USAGE.MAP_READ),
      readProf.mapAsync(GPU_BUFFER_USAGE.MAP_READ)
    ]);
    const o = new Float32Array(readOut.getMappedRange().slice(0, 48));
    const profRaw = new Float32Array(readProf.getMappedRange().slice(0, maxProfileSamples * 32));
    readOut.unmap();
    readProf.unmap();

    const statusCode = Math.round(o[3]);
    const failClosed = statusCode === 2;
    const valid = statusCode === 1;
    const sampleCount = Math.min(maxProfileSamples, Math.max(0, Math.round(o[7])));
    const profile = [];
    for (let s = 0; s < sampleCount; s += 1) {
      const k = s * 8;
      const lidx = Math.min(resolvedLayers.length - 1, Math.max(0, Math.round(profRaw[k + 5])));
      profile.push(Object.freeze({
        radiusM: profRaw[k + 0],
        pressurePa: profRaw[k + 1],
        densityKgPerM3: profRaw[k + 2],
        massEnclosedKg: profRaw[k + 3],
        gravityMPerS2: profRaw[k + 4],
        layer: resolvedLayers[lidx].name,
        phaseCode: Math.round(profRaw[k + 6]),
        polytopeHit: profRaw[k + 7] > 0.5
      }));
    }

    const coreSigma = Number(resolvedLayers[0]?.bundle?.electromagnetic?.electricalConductivitySPerM ?? 0);
    return Object.freeze({
      schema: ULG_PLANETARY_INTERIOR_GPU_SCHEMA,
      backend: 'webgpu-polytope-atlas',
      valid,
      failClosed,
      reason: failClosed ? 'polytope-out-of-domain' : (statusCode === 3 ? 'max-radius-reached' : 'ok'),
      failureState: failClosed
        ? Object.freeze({
            pressurePa: o[8],
            temperatureK: o[9],
            layerIndex: Math.round(o[10]),
            layer: resolvedLayers[Math.max(0, Math.round(o[10]))]?.name ?? 'unknown'
          })
        : null,
      centralPressurePa: Number(centralPressurePa),
      totalMassKg: o[0],
      radiusM: o[1],
      moiFactor: o[2],
      meanDensityKgPerM3: o[4],
      surfaceGravityMPerS2: o[5],
      escapeVelocityMPerS: o[6],
      minPolytopeMargin: o[11],
      coreConductivitySPerM: coreSigma,
      dynamoCapable: valid && coreSigma > 1e4 && centralPressurePa > 1e10,
      layerCount: resolvedLayers.length,
      profile: Object.freeze(profile),
      accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
      provenance: Object.freeze({
        status: 'webgpu-polytope-atlas-derived',
        inlineWgslEvaluator: 'eval_polytope_atlas_bank_2d',
        scientificValidation: false
      })
    });
  } finally {
    for (const b of [pBuf, bankBuf, layerBuf, specBuf, outBuf, profBuf, readOut, readProf]) b.destroy();
  }
}

/**
 * Host analytic Murnaghan reference hydrostatic integrator (for lightweight unit
 * checks when no WebGPU device is present; production Gate 5A runtime uses
 * `solvePlanetaryInteriorWebGpu` with inline WGSL Convex Polytope Atlases).
 */
export function solvePlanetaryInteriorFromBundles({
  centralPressurePa = 360e9,
  surfacePressurePa = 1e5,
  layers = [],
  radialStepM = 20000,
  maxRadiusM = 1.5e8
} = {}) {
  if (!Array.isArray(layers) || layers.length === 0) {
    throw new TypeError('solvePlanetaryInteriorFromBundles requires at least one material layer');
  }
  const totalFrac = layers.reduce((s, l) => s + Math.max(0, Number(l.massFractionTarget ?? 1)), 0) || 1;
  let estTotalMassKg = 6e24;
  let profile = [];
  let totalMassKg = 0;
  let radiusM = 0;
  let moiKgM2 = 0;

  for (let pass = 0; pass < 3; pass += 1) {
    let r = 0;
    let m = 0;
    let P = Number(centralPressurePa);
    let I = 0;
    const curProfile = [];
    const cumTargets = [];
    let acc = 0;
    for (const l of layers) {
      acc += Math.max(0, Number(l.massFractionTarget ?? 1)) / totalFrac;
      cumTargets.push(acc);
    }

    const pickLayer = (massFrac) => {
      for (let i = 0; i < layers.length; i += 1) {
        if (massFrac <= cumTargets[i] || i === layers.length - 1) return layers[i];
      }
      return layers[layers.length - 1];
    };

    const dr = Math.max(2000, Number(radialStepM));
    while (P > surfacePressurePa && r < maxRadiusM) {
      const layer = pickLayer(m / Math.max(1e20, estTotalMassKg));
      const T = Number(layer.tempK ?? 1500);
      const phase = layer.phase ?? 'solid';
      const rho = evaluateBundleDensityEos(layer.bundle, phase, T, P);
      const rMid = r + 0.5 * dr;
      const dM = 4 * Math.PI * rMid * rMid * rho * dr;
      const mMid = m + 0.5 * dM;
      const g = rMid > 1 ? (G_SI * mMid) / (rMid * rMid) : 0;
      const dP = -rho * g * dr;

      if (curProfile.length < 400 || (curProfile.length % 2 === 0)) {
        curProfile.push({
          radiusM: r,
          pressurePa: P,
          densityKgPerM3: rho,
          massEnclosedKg: m,
          gravityMPerS2: g,
          layer: layer.name || layer.bundle.materialKey
        });
      }
      m += dM;
      I += (2 / 3) * rMid * rMid * dM;
      P += dP;
      r += dr;
    }
    totalMassKg = m;
    radiusM = r;
    moiKgM2 = I;
    profile = curProfile;
    estTotalMassKg = Math.max(1e20, totalMassKg);
  }

  const volumeM3 = (4 / 3) * Math.PI * (radiusM ** 3);
  const meanDensityKgPerM3 = totalMassKg / Math.max(1, volumeM3);
  const surfaceGravityMPerS2 = (G_SI * totalMassKg) / Math.max(1, radiusM * radiusM);
  const escapeVelocityMPerS = Math.sqrt((2 * G_SI * totalMassKg) / Math.max(1, radiusM));
  const moiFactor = moiKgM2 / Math.max(1, totalMassKg * radiusM * radiusM);
  const coreSigma = Number(layers[0]?.bundle?.electromagnetic?.electricalConductivitySPerM ?? 0);

  return Object.freeze({
    schema: ULG_PLANETARY_INTERIOR_SCHEMA,
    centralPressurePa: Number(centralPressurePa),
    totalMassKg,
    radiusM,
    meanDensityKgPerM3,
    surfaceGravityMPerS2,
    escapeVelocityMPerS,
    moiFactor,
    coreConductivitySPerM: coreSigma,
    dynamoCapable: coreSigma > 1e4 && centralPressurePa > 1e10,
    layerCount: layers.length,
    profile: Object.freeze(profile),
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    provenance: Object.freeze({
      status: 'analytic-murnaghan-cpu-reference',
      scientificValidation: false
    })
  });
}

// Symplectic Leapfrog GPU N-Body (translation-invariant, exact momentum & energy check;
// supports exact pairwise gravity for small planetary systems OR canonical SchroederScaleAtlas
// multipole gravity for large-N planetesimal disks!)
const symplecticNBodyWgsl = /* wgsl */ `
struct NBodyParams {
  body_count: u32,
  steps: u32,
  use_atlas_acc: u32,
  pad1: u32,
  dt: f32,
  g_const: f32,
  softening2: f32,
  pad2: f32,
};

@group(0) @binding(0) var<uniform> params: NBodyParams;
// interleaved 8-float body layout: [i*2 + 0] = pos_m(xyz, mass), [i*2 + 1] = vel_e(vxyz, potE)
@group(0) @binding(1) var<storage, read_write> bodies: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> acc: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> ss_acc_phi: array<vec4<f32>>;

@compute @workgroup_size(64)
fn compute_accel(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  let n = params.body_count;
  if (i >= n) { return; }
  let pi = bodies[i * 2u + 0u];
  if (params.use_atlas_acc != 0u) {
    let ap = ss_acc_phi[i];
    acc[i] = vec4<f32>(ap.xyz, 0.0);
    bodies[i * 2u + 1u].w = -0.5 * pi.w * ap.w;
    return;
  }
  var a = vec3<f32>(0.0);
  var phi = 0.0;
  for (var j = 0u; j < n; j = j + 1u) {
    if (j == i) { continue; }
    let pj = bodies[j * 2u + 0u];
    let d = pj.xyz - pi.xyz;
    let r2 = dot(d, d) + params.softening2;
    let inv_r = inverseSqrt(r2);
    let inv_r3 = inv_r * inv_r * inv_r;
    a = a + (params.g_const * pj.w * inv_r3) * d;
    phi = phi - params.g_const * pi.w * pj.w * inv_r;
  }
  acc[i] = vec4<f32>(a, 0.0);
  bodies[i * 2u + 1u].w = 0.5 * phi;
}

@compute @workgroup_size(64)
fn kick_drift(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.body_count) { return; }
  let dt = params.dt;
  let pm = bodies[i * 2u + 0u];
  let ve = bodies[i * 2u + 1u];
  let v_half = ve.xyz + 0.5 * dt * acc[i].xyz;
  bodies[i * 2u + 0u] = vec4<f32>(pm.xyz + v_half * dt, pm.w);
  bodies[i * 2u + 1u] = vec4<f32>(v_half, ve.w);
}

@compute @workgroup_size(64)
fn second_kick(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.body_count) { return; }
  let dt = params.dt;
  let ve = bodies[i * 2u + 1u];
  bodies[i * 2u + 1u] = vec4<f32>(ve.xyz + 0.5 * dt * acc[i].xyz, ve.w);
}
`;

export async function runSymplecticPlanetaryNBodyWebGpu(device, {
  bodies, // [{ x, y, z, vx, vy, vz, mass }]
  dt = 0.005,
  steps = 200,
  gConst = 1.0,
  softening = 1e-4,
  useScaleAtlasMultipole = false,
  boxHalf = 25.0
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('runSymplecticPlanetaryNBodyWebGpu requires a live WebGPU GPUDevice');
  }
  const n = bodies.length;
  const interleaved = new Float32Array(n * 8);
  for (let i = 0; i < n; i += 1) {
    const b = bodies[i];
    interleaved.set([b.x, b.y, b.z, b.mass, b.vx, b.vy, b.vz, 0], i * 8);
  }
  const useAtlas = Boolean(useScaleAtlasMultipole || n > 128);
  const ssAtlasGravity = useAtlas
    ? createSchroederScaleAtlasGravitySolverWebGpu(device, {
        maxCount: n,
        strideFloats: 8,
        chartLevel: 20,
        useAdjSoftening: false,
        qMass: 8192.0,
        qMom: 512.0,
        rCellFactor: 0.05,
        label: 'ulg-planetary-ss-atlas'
      })
    : null;

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'read-only-storage')
  ];
  const mk = (ep) => createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-planetary-symplectic-${ep}.v2-ss`,
    label: `ulg-planetary-symplectic-${ep}`,
    code: symplecticNBodyWgsl,
    entryPoint: ep,
    bindings
  });
  const accPipe = mk('compute_accel');
  const kdPipe = mk('kick_drift');
  const skPipe = mk('second_kick');

  const pData = new ArrayBuffer(32);
  new Uint32Array(pData, 0, 4).set([n, steps, useAtlas ? 1 : 0, 0]);
  new Float32Array(pData, 16, 4).set([dt, gConst, softening * softening, 0]);
  const pBuf = device.createBuffer({ size: 32, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  device.queue.writeBuffer(pBuf, 0, pData);
  const bodyBuf = device.createBuffer({ size: Math.max(32, interleaved.byteLength), usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC });
  device.queue.writeBuffer(bodyBuf, 0, interleaved);
  const accBuf = device.createBuffer({ size: Math.max(16, n * 16), usage: GPU_BUFFER_USAGE.STORAGE });
  const dummyAtlasBuf = useAtlas ? null : device.createBuffer({ size: 32, usage: GPU_BUFFER_USAGE.STORAGE });
  const rBody = device.createBuffer({ size: Math.max(32, interleaved.byteLength), usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });

  if (ssAtlasGravity) {
    ssAtlasGravity.writeParams({
      count: n,
      gravityG: gConst,
      softening2: softening * softening,
      boxHalf,
      theta2: 0.55 * 0.55
    });
  }

  const bg = device.createBindGroup({
    layout: accPipe.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: pBuf } },
      { binding: 1, resource: { buffer: bodyBuf } },
      { binding: 2, resource: { buffer: accBuf } },
      { binding: 3, resource: { buffer: useAtlas ? ssAtlasGravity.accPhiBuffer : dummyAtlasBuf } }
    ]
  });
  const wg = Math.ceil(n / 64);
  const enc = device.createCommandEncoder({ label: 'ulg-planetary-symplectic' });
  const pass = enc.beginComputePass();
  if (ssAtlasGravity) ssAtlasGravity.encodeIntoPass(pass, { srcBuffer: bodyBuf, count: n });
  pass.setBindGroup(0, bg);
  pass.setPipeline(accPipe.pipeline); pass.dispatchWorkgroups(wg);
  for (let s = 0; s < steps; s += 1) {
    pass.setPipeline(kdPipe.pipeline); pass.dispatchWorkgroups(wg);
    if (ssAtlasGravity) {
      ssAtlasGravity.encodeIntoPass(pass, { srcBuffer: bodyBuf, count: n });
      pass.setBindGroup(0, bg);
    }
    pass.setPipeline(accPipe.pipeline); pass.dispatchWorkgroups(wg);
    pass.setPipeline(skPipe.pipeline); pass.dispatchWorkgroups(wg);
  }
  pass.end();
  enc.copyBufferToBuffer(bodyBuf, 0, rBody, 0, interleaved.byteLength);
  device.queue.submit([enc.finish()]);

  try {
    await rBody.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const finalInterleaved = new Float32Array(rBody.getMappedRange().slice(0, interleaved.byteLength));
    rBody.unmap();
    const finalPos = new Float32Array(n * 4);
    const finalVel = new Float32Array(n * 4);
    let ke = 0; let pe = 0;
    let lx = 0; let ly = 0; let lz = 0;
    for (let i = 0; i < n; i += 1) {
      const x = finalInterleaved[i * 8 + 0]; const y = finalInterleaved[i * 8 + 1]; const z = finalInterleaved[i * 8 + 2]; const m = finalInterleaved[i * 8 + 3];
      const vx = finalInterleaved[i * 8 + 4]; const vy = finalInterleaved[i * 8 + 5]; const vz = finalInterleaved[i * 8 + 6]; const pot = finalInterleaved[i * 8 + 7];
      finalPos.set([x, y, z, m], i * 4);
      finalVel.set([vx, vy, vz, pot], i * 4);
      ke += 0.5 * m * (vx * vx + vy * vy + vz * vz);
      pe += pot;
      lx += m * (y * vz - z * vy);
      ly += m * (z * vx - x * vz);
      lz += m * (x * vy - y * vx);
    }
    return Object.freeze({
      schema: ULG_PLANETARY_NBODY_GPU_SCHEMA,
      backend: 'webgpu',
      gravityMode: useAtlas ? 'webgpu-schroeder-scale-atlas-multipole' : 'webgpu-symplectic-direct',
      steps,
      totalEnergy: ke + pe,
      kineticEnergy: ke,
      potentialEnergy: pe,
      angularMomentum: [lx, ly, lz],
      positions: finalPos,
      velocities: finalVel
    });
  } finally {
    ssAtlasGravity?.destroy();
    dummyAtlasBuf?.destroy();
    for (const b of [pBuf, bodyBuf, accBuf, rBody]) b.destroy();
  }
}
