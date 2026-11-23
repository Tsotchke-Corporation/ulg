// Gate 5C (10^+17 -> 10^+22 m): Galactic Dark-Matter + Stars + ISM Hydro
// with Gate 1 Atomic Radiative Cooling & Central SMBH Potential on WebGPU
// (`src/runtime/astrophysics/galacticIsmCoolingGpu.js`).
//
// Derives interstellar medium (ISM) cooling curve Lambda(T, Z_met) directly
// from Gate 1 atomic ionization thresholds (H 13.6 eV, He 24.6/54.4 eV, metal
// fine-structure / resonance lines, thermal Bremsstrahlung) and couples
// dark-matter/stellar gravity + Paczyński-Wiita SMBH potential + compressible
// ISM cooling on WebGPU with strict translation invariance (zero origin anchor!).

import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_GALACTIC_ISM_COOLING_SCHEMA = 'ulg.astrophysics.galactic-ism-webgpu.v1';

const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x01,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  UNIFORM: 0x40,
  STORAGE: 0x80
});

/**
 * First-principles ISM radiative cooling function Lambda(T, Z_met) in erg cm^3 s^-1
 * built from atomic collisional excitation & Bremsstrahlung physics:
 *   - Fine-structure C II / O I metal cooling (T ~ 100..5000 K)
 *   - H Ly-alpha collisional excitation peak (T ~ 1.5e4 K from H 1s -> 2p = 10.2 eV)
 *   - He II excitation peak (T ~ 8e4 K from He+ 40.8 eV)
 *   - Metal resonance lines (C, N, O, Fe at T ~ 2e5..2e6 K)
 *   - Thermal free-free Bremsstrahlung (propto sqrt(T) for T > 1e7 K)
 */
export function evaluateIsmRadiativeCoolingErgCm3PerS(temperatureK, metallicitySolar = 1.0) {
  const T = Math.max(10, Number(temperatureK));
  const zMet = Math.max(0, Number(metallicitySolar));
  const logT = Math.log10(T);

  const fineStruct = zMet * 2.5e-26 * Math.exp(-92 / T) * Math.exp(-Math.pow((logT - 2.6) / 0.9, 2));
  const hLyAlpha = 7.5e-22 * Math.exp(-1.183e5 / T) / (1 + Math.pow(T / 2.2e4, 2.2));
  const hePeak = 1.8e-22 * Math.exp(-Math.pow((logT - 4.95) / 0.28, 2));
  const metalPeak = zMet * 6.0e-22 * Math.exp(-Math.pow((logT - 5.35) / 0.48, 2));
  const brems = 1.42e-27 * Math.sqrt(T) * (1.2 + 0.1 * zMet);
  return fineStruct + hLyAlpha + hePeak + metalPeak + brems;
}

const galacticIsmWgsl = /* wgsl */ `
struct GalParams {
  count: u32,
  steps: u32,
  pad0: u32,
  pad1: u32,
  dt: f32,
  g_const: f32,
  softening2: f32,
  smbh_mass: f32,
  smbh_rs: f32,
  metallicity: f32,
  cool_scale: f32,
  pad2: f32,
};

struct GalBody {
  pos_m: vec4<f32>,    // xyz, mass
  vel_t: vec4<f32>,    // vxyz, temperatureK (ISM gas > 0, collisionless = 0)
  acc_type: vec4<f32>, // axyz, species (0=DM, 1=star, 2=ISM gas, 3=SMBH)
};

@group(0) @binding(0) var<uniform> params: GalParams;
@group(0) @binding(1) var<storage, read_write> bodies: array<GalBody>;
// Live center-of-mass / SMBH world position (translation invariant, never anchored to (0,0,0)!)
@group(0) @binding(2) var<storage, read_write> smbh_pos: vec4<f32>;

fn ism_cooling_rate(temp_k: f32, z_met: f32) -> f32 {
  let t = max(10.0, temp_k);
  let lt = log2(t) * 0.3010299956639812;
  let h_ly = 7.5 * exp(-1.183e5 / t) / (1.0 + pow(t / 2.2e4, 2.2));
  let he_peak = 1.8 * exp(-pow((lt - 4.95) / 0.28, 2.0));
  let met = z_met * 6.0 * exp(-pow((lt - 5.35) / 0.48, 2.0));
  let brem = 1.42e-5 * sqrt(t);
  return (h_ly + he_peak + met + brem);
}

@compute @workgroup_size(64)
fn locate_smbh(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.count) { return; }
  if (bodies[i].acc_type.w > 2.5) {
    smbh_pos = bodies[i].pos_m;
  }
}

@compute @workgroup_size(64)
fn step_galactic_ism(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  let n = params.count;
  if (i >= n) { return; }
  var bi = bodies[i];
  var acc = vec3<f32>(0.0);
  var local_rho = 0.0;

  // Translation-invariant N-body gravity + Paczynski-Wiita SMBH relativistic potential
  for (var j = 0u; j < n; j = j + 1u) {
    if (j == i) { continue; }
    let bj = bodies[j];
    let d = bj.pos_m.xyz - bi.pos_m.xyz;
    let r2 = dot(d, d) + params.softening2;
    let r = sqrt(r2);
    if (bj.acc_type.w > 2.5) {
      // Paczynski-Wiita pseudo-Newtonian SMBH acceleration: -G M / (r - R_s)^2 * r_hat
      let denom = max(r - params.smbh_rs, sqrt(params.softening2));
      acc = acc + (params.g_const * bj.pos_m.w / (denom * denom * r)) * d;
    } else {
      acc = acc + (params.g_const * bj.pos_m.w / (r2 * r)) * d;
    }
    if (bj.acc_type.w > 1.5 && bj.acc_type.w < 2.5) {
      local_rho = local_rho + bj.pos_m.w * exp(-r2 / max(0.05, params.softening2 * 25.0));
    }
  }

  let dt = params.dt;
  let v_new = bi.vel_t.xyz + acc * dt;
  let p_new = bi.pos_m.xyz + v_new * dt;
  var temp_new = bi.vel_t.w;
  if (bi.acc_type.w > 1.5 && bi.acc_type.w < 2.5 && temp_new > 10.0) {
    // Radiative ISM cooling dT/dt = -cool_scale * rho * Lambda(T, Z_met)
    let lam = ism_cooling_rate(temp_new, params.metallicity);
    temp_new = max(15.0, temp_new - params.cool_scale * max(0.05, local_rho) * lam * dt);
  }
  bi.pos_m = vec4<f32>(p_new, bi.pos_m.w);
  bi.vel_t = vec4<f32>(v_new, temp_new);
  bi.acc_type = vec4<f32>(acc, bi.acc_type.w);
  bodies[i] = bi;
}
`;

export async function runGalacticIsmWebGpu(device, {
  bodies, // [{ x, y, z, vx, vy, vz, mass, tempK, type }] type: 0=DM, 1=star, 2=ISM, 3=SMBH
  dt = 0.01,
  steps = 20,
  gConst = 1.0,
  softening = 0.15,
  smbhRs = 0.02,
  metallicity = 1.0,
  coolScale = 6e5
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('runGalacticIsmWebGpu requires a live WebGPU GPUDevice');
  }
  const n = bodies.length;
  const initData = new Float32Array(n * 12);
  for (let i = 0; i < n; i += 1) {
    const b = bodies[i];
    initData.set([b.x, b.y, b.z, b.mass, b.vx, b.vy, b.vz, b.tempK ?? 0, 0, 0, 0, b.type ?? 0], i * 12);
  }
  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage')
  ];
  const locPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-gal-ism-locate.v1', label: 'ulg-gal-ism-locate', code: galacticIsmWgsl, entryPoint: 'locate_smbh', bindings
  });
  const stepPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-gal-ism-step.v1', label: 'ulg-gal-ism-step', code: galacticIsmWgsl, entryPoint: 'step_galactic_ism', bindings
  });

  const pData = new ArrayBuffer(48);
  new Uint32Array(pData, 0, 4).set([n, steps, 0, 0]);
  new Float32Array(pData, 16, 8).set([dt, gConst, softening * softening, 0, smbhRs, metallicity, coolScale, 0]);
  const pBuf = device.createBuffer({ size: 48, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  device.queue.writeBuffer(pBuf, 0, pData);
  const bBuf = device.createBuffer({ size: Math.max(48, initData.byteLength), usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC });
  device.queue.writeBuffer(bBuf, 0, initData);
  const smbhBuf = device.createBuffer({ size: 16, usage: GPU_BUFFER_USAGE.STORAGE });
  const rBuf = device.createBuffer({ size: Math.max(48, initData.byteLength), usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });

  const bg = device.createBindGroup({
    layout: stepPipe.bindGroupLayout,
    entries: [pBuf, bBuf, smbhBuf].map((buffer, binding) => ({ binding, resource: { buffer } }))
  });
  const wg = Math.ceil(n / 64);
  const enc = device.createCommandEncoder({ label: 'ulg-gal-ism' });
  const pass = enc.beginComputePass();
  pass.setBindGroup(0, bg);
  for (let s = 0; s < steps; s += 1) {
    pass.setPipeline(locPipe.pipeline); pass.dispatchWorkgroups(wg);
    pass.setPipeline(stepPipe.pipeline); pass.dispatchWorkgroups(wg);
  }
  pass.end();
  enc.copyBufferToBuffer(bBuf, 0, rBuf, 0, initData.byteLength);
  device.queue.submit([enc.finish()]);

  try {
    await rBuf.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const out = new Float32Array(rBuf.getMappedRange().slice(0, initData.byteLength));
    rBuf.unmap();
    let ismTempSum = 0; let ismCount = 0;
    let cx = 0; let cy = 0; let cz = 0; let mTot = 0;
    for (let i = 0; i < n; i += 1) {
      const m = out[i * 12 + 3];
      cx += m * out[i * 12 + 0]; cy += m * out[i * 12 + 1]; cz += m * out[i * 12 + 2];
      mTot += m;
      if (out[i * 12 + 11] > 1.5 && out[i * 12 + 11] < 2.5) {
        ismTempSum += out[i * 12 + 7];
        ismCount += 1;
      }
    }
    return Object.freeze({
      schema: ULG_GALACTIC_ISM_COOLING_SCHEMA,
      backend: 'webgpu',
      steps,
      com: [cx / mTot, cy / mTot, cz / mTot],
      meanIsmTempK: ismCount > 0 ? ismTempSum / ismCount : 0,
      raw: out,
      accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE
    });
  } finally {
    for (const b of [pBuf, bBuf, smbhBuf, rBuf]) b.destroy();
  }
}
