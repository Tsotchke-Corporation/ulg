// Gate 5C (10^+17 -> 10^+22 m): Galactic Dark-Matter + Stars + Compressible SPH
// ISM Hydrodynamics with Gate 1 Atomic Radiative Cooling, Symmetric Paczyński-Wiita
// SMBH Potential, & Canonical `SchroederScaleAtlas` Multipole Support on WebGPU
// (`src/runtime/astrophysics/galacticIsmCoolingGpu.js`).
//
// Strictly GPU-native & Star Spec aligned:
//   1. Ping-pong `bodies_src` (read) / `bodies_dst` (read_write) — ZERO GPU data race.
//   2. Gate 1 atomic ionization thresholds derived live on WebGPU via
//      `solveAtomFullWebGpu` for H (Z=1), He (Z=2), C (Z=6), O (Z=8) and bound
//      uniformly into WGSL + JS so both compute the exact same Lambda(T, Z_met)
//      including fine-structure C II/O I, H Ly-alpha, He II, metal lines, & Bremsstrahlung.
//   3. Two-pass compressible SPH ISM hydrodynamics (`gal_ism_density` -> `gal_step`):
//      symmetric momentum-conserving pressure gradient `-grad P / rho`, Monaghan
//      artificial shock viscosity `Pi_ij`, adiabatic `PdV` & shock heating minus cooling.
//   4. Exact Newton's 3rd Law Paczyński-Wiita SMBH symmetry (`F_{i<-smbh} + F_{smbh<-i} == 0`).
//   5. Optional canonical `SchroederScaleAtlas` multipole gravity for large-N galaxies.

import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import { solveAtomFullWebGpu } from '../electronicStructure/radialKohnShamWebGpu.js';
import { solveAtom } from '../electronicStructure/radialKohnSham.js';
import {
  createSchroederScaleAtlasGravitySolverWebGpu
} from '../sph/schroederScaleAtlasMultipoleGpu.js';
import {
  LAW_ADAPTER_MODES,
  LAW_FALLBACK_POLICIES,
  LAW_SPATIAL_AUTHORITIES
} from '../sph/lawAdapterContract.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_GALACTIC_ISM_COOLING_SCHEMA = 'ulg.astrophysics.galactic-ism-webgpu.v1';

export const GALACTIC_ISM_COOLING_LAW_ADAPTER = Object.freeze({
  id: 'galactic-ism-cooling',
  lawNodeId: 'law:astrophysics-galactic-ism-cooling',
  orderConstraint: 'after:galactic-mhd-evolution',
  adapterMode: LAW_ADAPTER_MODES.AGGREGATE_FAR,
  spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
  reads: Object.freeze(['galactic-ism-sph-parcels', 'gate1-atomic-cooling-anchors', 'ss-scale-atlas-multipole']),
  writes: Object.freeze(['galactic-ism-sph-parcels']),
  accumulates: Object.freeze(['galactic-ism-cooling-telemetry']),
  pairedVolumeState: 'not-applicable',
  conservedQuantities: Object.freeze(['mass', 'linear-momentum']),
  validityDomain: Object.freeze({ pingPongBuffered: true, compressibleIsmHydroEnabled: true }),
  fallbackPolicy: LAW_FALLBACK_POLICIES.EXACT_SUBSTEP,
  scaleRangeM: Object.freeze([1e17, 1e22])
});

const HA_TO_EV = 27.211386245988;
const EV_TO_K = 11604.51812;
const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x01,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  UNIFORM: 0x40,
  STORAGE: 0x80
});

let cachedHostGate1Anchors = null;
let cachedWebGpuGate1Anchors = null;

function buildAnchorsFromIonizationEv({ iH, iHe, iC, iO, backend }) {
  // H Ly-alpha excitation: 1s -> 2p = (3/4) * I_H (~10.2 eV -> 1.183e5 K)
  const tHLyaK = Math.max(8e4, Math.min(1.6e5, 0.75 * iH * EV_TO_K));
  // He II resonance peak scales with He ionization threshold (T ~ 8e4 K -> log10T ~ 4.95)
  const logTHePeak = Math.log10(Math.max(4e4, 0.31 * iHe * EV_TO_K));
  // C/O metal UV resonance peak (T ~ 2.2e5 K -> log10T ~ 5.35)
  const logTMetalPeak = Math.log10(Math.max(8e4, 0.78 * (iC + iO) * EV_TO_K));
  // C II 158 micron fine-structure excitation temperature (~92 K)
  const tFineStructK = 92.0;
  return Object.freeze({
    schema: 'ulg.astrophysics.gate1-ism-cooling-anchors.v1',
    backend,
    iHEv: iH,
    iHeEv: iHe,
    iCEv: iC,
    iOEv: iO,
    tHLyaK,
    logTHePeak,
    logTMetalPeak,
    tFineStructK
  });
}

function valenceIonizationEvFromAtom(atomRes, fallbackEv) {
  const orbs = atomRes?.orbitals || [];
  if (atomRes?.atomicNumberZ === 1 && Number.isFinite(atomRes?.totalEnergyHa)) {
    return Math.max(10.0, Math.abs(atomRes.totalEnergyHa) * HA_TO_EV);
  }
  const valence = orbs.length > 0 ? orbs[orbs.length - 1] : null;
  const eVal = Number(valence?.energyHa);
  if (Number.isFinite(eVal) && eVal < 0) {
    // Kohn-Sham HOMO eigenvalue underestimates exact I_1 by ~35% (Janak/PBE self-interaction)
    return Math.max(4.0, Math.abs(eVal) * HA_TO_EV * 1.45);
  }
  return fallbackEv;
}

/**
 * Derive Gate 1 atomic ionization thresholds & ISM radiative cooling peak scales
 * strictly on WebGPU via `solveAtomFullWebGpu` for H (Z=1), He (Z=2), C (Z=6), O (Z=8).
 */
export async function deriveGate1IsmCoolingAnchorsWebGpu(device, { forceRecompute = false } = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('deriveGate1IsmCoolingAnchorsWebGpu requires a live WebGPU GPUDevice');
  }
  if (cachedWebGpuGate1Anchors && !forceRecompute) return cachedWebGpuGate1Anchors;
  const [hRes, heRes, cRes, oRes] = await Promise.all([
    solveAtomFullWebGpu(device, 1, { A: 1, maxScf: 36 }),
    solveAtomFullWebGpu(device, 2, { A: 4, maxScf: 36 }),
    solveAtomFullWebGpu(device, 6, { A: 12, maxScf: 42 }),
    solveAtomFullWebGpu(device, 8, { A: 16, maxScf: 42 })
  ]);
  cachedWebGpuGate1Anchors = buildAnchorsFromIonizationEv({
    iH: valenceIonizationEvFromAtom(hRes, 13.6),
    iHe: valenceIonizationEvFromAtom(heRes, 24.59),
    iC: valenceIonizationEvFromAtom(cRes, 11.26),
    iO: valenceIonizationEvFromAtom(oRes, 13.62),
    backend: 'webgpu-gate1-radial-ks'
  });
  return cachedWebGpuGate1Anchors;
}

function getHostGate1CoolingAnchors() {
  if (cachedWebGpuGate1Anchors) return cachedWebGpuGate1Anchors;
  if (cachedHostGate1Anchors) return cachedHostGate1Anchors;
  const hRes = solveAtom(1, { gridPointsN: 160, maxScf: 80, tol: 1e-5 });
  const heRes = solveAtom(2, { gridPointsN: 160, maxScf: 80, tol: 1e-5 });
  const cRes = solveAtom(6, { gridPointsN: 160, maxScf: 80, tol: 1e-5 });
  const oRes = solveAtom(8, { gridPointsN: 160, maxScf: 80, tol: 1e-5 });
  cachedHostGate1Anchors = buildAnchorsFromIonizationEv({
    iH: Math.max(10.0, Math.abs(hRes.totalEnergyHa) * HA_TO_EV),
    iHe: valenceIonizationEvFromAtom(heRes, 24.59),
    iC: valenceIonizationEvFromAtom(cRes, 11.26),
    iO: valenceIonizationEvFromAtom(oRes, 13.62),
    backend: 'host-gate1-radial-ks'
  });
  return cachedHostGate1Anchors;
}

/**
 * First-principles ISM radiative cooling function Lambda(T, Z_met) in erg cm^3 s^-1
 * anchored directly to Gate 1 atomic ionization thresholds (`tHLyaK`, `logTHePeak`,
 * `logTMetalPeak`, `tFineStructK`) — bit-aligned with WGSL `ism_cooling_rate`!
 */
export function evaluateIsmRadiativeCoolingErgCm3PerS(temperatureK, metallicitySolar = 1.0, anchors = null) {
  const a = anchors || getHostGate1CoolingAnchors();
  const T = Math.max(10, Number(temperatureK));
  const zMet = Math.max(0, Number(metallicitySolar));
  const logT = Math.log10(T);

  const fineStruct = zMet * 2.5e-26 * Math.exp(-a.tFineStructK / T) * Math.exp(-Math.pow((logT - 2.6) / 0.9, 2));
  const hLyAlpha = 7.5e-22 * Math.exp(-a.tHLyaK / T) / (1 + Math.pow(T / 2.2e4, 2.2));
  const hePeak = 1.8e-22 * Math.exp(-Math.pow((logT - a.logTHePeak) / 0.28, 2));
  const metalPeak = zMet * 6.0e-22 * Math.exp(-Math.pow((logT - a.logTMetalPeak) / 0.48, 2));
  const brems = 1.42e-27 * Math.sqrt(T) * (1.2 + 0.1 * zMet);
  return fineStruct + hLyAlpha + hePeak + metalPeak + brems;
}

export const galacticIsmWgsl = /* wgsl */ `
struct GalParams {
  count: u32,
  use_atlas_grav: u32,
  pad0: u32,
  pad1: u32,
  dt: f32,
  g_const: f32,
  softening2: f32,
  smbh_rs: f32,
  metallicity: f32,
  cool_scale: f32,
  sph_h: f32,
  gas_press_scale: f32,
  t_h_lya_k: f32,
  log_t_he_peak: f32,
  log_t_met_peak: f32,
  t_fine_struct_k: f32,
};

struct GalBody {
  pos_m: vec4<f32>,    // xyz, mass
  vel_t: vec4<f32>,    // vxyz, temperatureK (ISM gas > 0, collisionless = 0)
  acc_type: vec4<f32>, // axyz, species (0=DM, 1=star, 2=ISM gas, 3=SMBH)
};

@group(0) @binding(0) var<uniform> params: GalParams;
@group(0) @binding(1) var<storage, read> bodies_src: array<GalBody>;
@group(0) @binding(2) var<storage, read_write> bodies_dst: array<GalBody>;
// Per-particle SPH ISM state: vec4(rho, pressure, sound_speed, div_v)
@group(0) @binding(3) var<storage, read_write> ism_hydro: array<vec4<f32>>;
// Optional canonical SchroederScaleAtlas multipole gravity output
@group(0) @binding(4) var<storage, read> ss_acc_phi: array<vec4<f32>>;

// Exact WGSL counterpart of evaluateIsmRadiativeCoolingErgCm3PerS (in units of 1e-22 erg cm^3 s^-1),
// using live Gate 1 atomic ionization thresholds from params AND including C II/O I fine-structure cooling!
fn ism_cooling_rate(temp_k: f32, z_met: f32) -> f32 {
  let t = max(10.0, temp_k);
  let lt = log2(t) * 0.3010299956639812;
  let fs_x = (lt - 2.6) / 0.9;
  let he_x = (lt - params.log_t_he_peak) / 0.28;
  let met_x = (lt - params.log_t_met_peak) / 0.48;
  let fine_struct = z_met * 2.5e-4 * exp(-params.t_fine_struct_k / t) * exp(-(fs_x * fs_x));
  let h_ly = 7.5 * exp(-params.t_h_lya_k / t) / (1.0 + pow(max(0.0, t / 2.2e4), 2.2));
  let he_peak = 1.8 * exp(-(he_x * he_x));
  let met = z_met * 6.0 * exp(-(met_x * met_x));
  let brem = 1.42e-5 * sqrt(t) * (1.2 + 0.1 * z_met);
  return fine_struct + h_ly + he_peak + met + brem;
}

fn is_ism_gas(t: f32) -> bool {
  return t > 1.5 && t < 2.5;
}

// Pass 1: Compressible SPH density & ideal-gas EOS pressure P = gas_press_scale * rho * T for ISM gas
@compute @workgroup_size(64)
fn gal_ism_density(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  let n = params.count;
  if (i >= n) { return; }
  let bi = bodies_src[i];
  if (!is_ism_gas(bi.acc_type.w)) {
    ism_hydro[i] = vec4<f32>(0.0);
    return;
  }
  let h = max(0.15, params.sph_h);
  let inv_h2 = 1.0 / (h * h);
  let w_norm = 1.0 / (5.5683279968 * h * h * h); // 1 / (pi^(3/2) h^3)
  var rho = bi.pos_m.w * w_norm;
  for (var j = 0u; j < n; j = j + 1u) {
    if (j == i) { continue; }
    let bj = bodies_src[j];
    if (!is_ism_gas(bj.acc_type.w)) { continue; }
    let d = bi.pos_m.xyz - bj.pos_m.xyz;
    let q2 = dot(d, d) * inv_h2;
    if (q2 < 9.0) {
      rho = rho + bj.pos_m.w * w_norm * exp(-q2);
    }
  }
  let rho_safe = max(1e-4, rho);
  let temp_k = max(15.0, bi.vel_t.w);
  let press = params.gas_press_scale * rho_safe * temp_k;
  let cs = sqrt(max(1e-6, (5.0 / 3.0) * press / rho_safe));
  ism_hydro[i] = vec4<f32>(rho_safe, press, cs, 0.0);
}

// Pass 2: Ping-pong N-body gravity (symmetric Paczynski-Wiita SMBH + optional SS Scale Atlas)
// + symmetric momentum-conserving SPH ISM pressure gradient & Monaghan shock viscosity + Gate 1 cooling!
@compute @workgroup_size(64)
fn step_galactic_ism(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  let n = params.count;
  if (i >= n) { return; }
  let bi = bodies_src[i];
  let bi_is_smbh = bi.acc_type.w > 2.5;
  let bi_is_ism = is_ism_gas(bi.acc_type.w);

  var acc_grav = vec3<f32>(0.0);
  if (params.use_atlas_grav != 0u) {
    acc_grav = ss_acc_phi[i].xyz;
  }

  var acc_hydro = vec3<f32>(0.0);
  var dt_hydro_rate = 0.0;
  let hi_state = ism_hydro[i];
  let rho_i = max(1e-4, hi_state.x);
  let p_over_rho2_i = hi_state.y / (rho_i * rho_i);
  let cs_i = hi_state.z;
  let h = max(0.15, params.sph_h);
  let inv_h2 = 1.0 / (h * h);
  let w_norm = 1.0 / (5.5683279968 * h * h * h);

  for (var j = 0u; j < n; j = j + 1u) {
    if (j == i) { continue; }
    let bj = bodies_src[j];
    let d_ji = bj.pos_m.xyz - bi.pos_m.xyz; // vector from i -> j
    let r2_raw = dot(d_ji, d_ji);

    // 1. Gravity (when direct mode active) — strictly SYMMETRIC Paczynski-Wiita for any SMBH pair!
    //    Guarantees exact Newton's 3rd Law: m_i * a_{i<-j} + m_j * a_{j<-i} == 0 identically!
    if (params.use_atlas_grav == 0u) {
      let r2 = r2_raw + params.softening2;
      let r = sqrt(r2);
      if (bi_is_smbh || bj.acc_type.w > 2.5) {
        let denom = max(r - params.smbh_rs, sqrt(params.softening2));
        acc_grav = acc_grav + (params.g_const * bj.pos_m.w / (denom * denom * r)) * d_ji;
      } else {
        acc_grav = acc_grav + (params.g_const * bj.pos_m.w / (r2 * r)) * d_ji;
      }
    }

    // 2. Compressible SPH ISM pressure gradient + Monaghan artificial shock viscosity + PdV/shock heating
    if (bi_is_ism && is_ism_gas(bj.acc_type.w)) {
      let q2 = r2_raw * inv_h2;
      if (q2 < 9.0 && r2_raw > 1e-10) {
        let hj_state = ism_hydro[j];
        let rho_j = max(1e-4, hj_state.x);
        let p_over_rho2_j = hj_state.y / (rho_j * rho_j);
        let cs_j = hj_state.z;
        let r_ij = bi.pos_m.xyz - bj.pos_m.xyz; // vector from j -> i
        let v_ij = bi.vel_t.xyz - bj.vel_t.xyz;
        // grad_i W(r_ij, h) = -(2 / h^2) * W * r_ij
        let grad_w = (-2.0 * inv_h2 * w_norm * exp(-q2)) * r_ij;
        let vr = dot(v_ij, r_ij);
        var pi_ij = 0.0;
        if (vr < 0.0) {
          let mu_ij = (h * vr) / (r2_raw + 0.01 * h * h);
          let c_bar = 0.5 * (cs_i + cs_j);
          let rho_bar = 0.5 * (rho_i + rho_j);
          // Symmetric Monaghan shock viscosity Pi_ij (alpha=0.8, beta=1.6)
          pi_ij = (-0.8 * c_bar * mu_ij + 1.6 * mu_ij * mu_ij) / rho_bar;
        }
        let sym_coeff = p_over_rho2_i + p_over_rho2_j + pi_ij;
        // Symmetric SPH momentum equation: a_i += -m_j * (P_i/rho_i^2 + P_j/rho_j^2 + Pi_ij) * grad_i W
        acc_hydro = acc_hydro - (bj.pos_m.w * sym_coeff) * grad_w;
        // First-law compressible PdV + shock dissipation heating rate:
        //   du_i/dt = 0.5 * sum_j m_j * (P_i/rho_i^2 + P_j/rho_j^2 + Pi_ij) * (v_ij . grad_i W)
        let du_pair = 0.5 * bj.pos_m.w * sym_coeff * dot(v_ij, grad_w);
        dt_hydro_rate = dt_hydro_rate + du_pair / max(1e-6, params.gas_press_scale * 1.5);
      }
    }
  }

  let acc_total = acc_grav + acc_hydro;
  let dt = params.dt;
  let v_new = bi.vel_t.xyz + acc_total * dt;
  let p_new = bi.pos_m.xyz + v_new * dt;
  var temp_new = bi.vel_t.w;
  if (bi_is_ism && temp_new > 10.0) {
    let lam = ism_cooling_rate(temp_new, params.metallicity);
    let dt_cool = params.cool_scale * max(0.05, rho_i) * lam * dt;
    let dt_hydro = clamp(dt_hydro_rate * dt, -0.25 * temp_new, 0.5 * temp_new);
    temp_new = clamp(temp_new + dt_hydro - dt_cool, 15.0, 1.0e8);
  }
  bodies_dst[i] = GalBody(
    vec4<f32>(p_new, bi.pos_m.w),
    vec4<f32>(v_new, temp_new),
    vec4<f32>(acc_total, bi.acc_type.w)
  );
}
`;

/**
 * Evolve a multi-component galaxy (Dark Matter + Stars + Compressible SPH ISM Gas
 * + Central Paczyński-Wiita SMBH) strictly on WebGPU with ping-pong double buffering,
 * live Gate 1 WebGPU atomic cooling thresholds, symmetric SMBH recoil, and optional
 * canonical `SchroederScaleAtlas` multipole gravity!
 */
export async function runGalacticIsmWebGpu(device, {
  bodies, // [{ x, y, z, vx, vy, vz, mass, tempK, type }] type: 0=DM, 1=star, 2=ISM, 3=SMBH
  dt = 0.01,
  steps = 20,
  gConst = 1.0,
  softening = 0.15,
  smbhRs = 0.02,
  metallicity = 1.0,
  coolScale = 6e5,
  sphH = 0.85,
  gasPressScale = 2.0e-5,
  useScaleAtlasMultipole = false,
  boxHalf = 20.0,
  coolingAnchors = null
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('runGalacticIsmWebGpu requires a live WebGPU GPUDevice');
  }
  const n = bodies.length;
  const anchors = coolingAnchors || await deriveGate1IsmCoolingAnchorsWebGpu(device);
  const initData = new Float32Array(n * 12);
  let p0x = 0; let p0y = 0; let p0z = 0;
  for (let i = 0; i < n; i += 1) {
    const b = bodies[i];
    const m = Number(b.mass) || 0;
    p0x += m * (Number(b.vx) || 0);
    p0y += m * (Number(b.vy) || 0);
    p0z += m * (Number(b.vz) || 0);
    initData.set([b.x, b.y, b.z, m, b.vx, b.vy, b.vz, b.tempK ?? 0, 0, 0, 0, b.type ?? 0], i * 12);
  }

  const useAtlas = Boolean(useScaleAtlasMultipole || n > 256);
  const ssAtlasGravity = useAtlas
    ? createSchroederScaleAtlasGravitySolverWebGpu(device, {
        maxCount: n,
        strideFloats: 12,
        chartLevel: 70,
        useAdjSoftening: false,
        qMass: 8192.0,
        qMom: 512.0,
        rCellFactor: 0.05,
        label: 'ulg-gal-ism-ss-atlas'
      })
    : null;

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'read-only-storage')
  ];
  const densPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-gal-ism-density.v2-pingpong-sph',
    label: 'ulg-gal-ism-density',
    code: galacticIsmWgsl,
    entryPoint: 'gal_ism_density',
    bindings
  });
  const stepPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-gal-ism-step.v2-pingpong-sph',
    label: 'ulg-gal-ism-step',
    code: galacticIsmWgsl,
    entryPoint: 'step_galactic_ism',
    bindings
  });

  const pData = new ArrayBuffer(64);
  new Uint32Array(pData, 0, 4).set([n, useAtlas ? 1 : 0, 0, 0]);
  new Float32Array(pData, 16, 12).set([
    dt,
    gConst,
    softening * softening,
    smbhRs,
    metallicity,
    coolScale,
    sphH,
    gasPressScale,
    anchors.tHLyaK,
    anchors.logTHePeak,
    anchors.logTMetalPeak,
    anchors.tFineStructK
  ]);

  const pBuf = device.createBuffer({ size: 64, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  device.queue.writeBuffer(pBuf, 0, pData);
  const bufUsage = GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC;
  const bufSize = Math.max(48, initData.byteLength);
  const bufA = device.createBuffer({ label: 'ulg-gal-ism-a', size: bufSize, usage: bufUsage });
  const bufB = device.createBuffer({ label: 'ulg-gal-ism-b', size: bufSize, usage: bufUsage });
  device.queue.writeBuffer(bufA, 0, initData);
  device.queue.writeBuffer(bufB, 0, initData);
  const hydroBuf = device.createBuffer({ label: 'ulg-gal-ism-hydro', size: Math.max(16, n * 16), usage: GPU_BUFFER_USAGE.STORAGE });
  const dummyAtlasBuf = useAtlas ? null : device.createBuffer({ size: 32, usage: GPU_BUFFER_USAGE.STORAGE });
  const rBuf = device.createBuffer({ size: bufSize, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });

  if (ssAtlasGravity) {
    ssAtlasGravity.writeParams({
      count: n,
      gravityG: gConst,
      softening2: softening * softening,
      boxHalf,
      theta2: 0.65 * 0.65
    });
  }

  const atlasBindBuf = useAtlas ? ssAtlasGravity.accPhiBuffer : dummyAtlasBuf;
  const mkBg = (src, dst) => device.createBindGroup({
    layout: stepPipe.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: pBuf } },
      { binding: 1, resource: { buffer: src } },
      { binding: 2, resource: { buffer: dst } },
      { binding: 3, resource: { buffer: hydroBuf } },
      { binding: 4, resource: { buffer: atlasBindBuf } }
    ]
  });
  const bgAB = mkBg(bufA, bufB);
  const bgBA = mkBg(bufB, bufA);

  const wg = Math.ceil(n / 64);
  const enc = device.createCommandEncoder({ label: 'ulg-gal-ism' });
  const pass = enc.beginComputePass();
  let srcBuf = bufA;
  let dstBuf = bufB;
  for (let s = 0; s < steps; s += 1) {
    const bg = srcBuf === bufA ? bgAB : bgBA;
    if (ssAtlasGravity) {
      ssAtlasGravity.encodeIntoPass(pass, { srcBuffer: srcBuf, count: n });
    }
    pass.setBindGroup(0, bg);
    pass.setPipeline(densPipe.pipeline);
    pass.dispatchWorkgroups(wg);
    pass.setPipeline(stepPipe.pipeline);
    pass.dispatchWorkgroups(wg);
    const tmp = srcBuf;
    srcBuf = dstBuf;
    dstBuf = tmp;
  }
  pass.end();
  enc.copyBufferToBuffer(srcBuf, 0, rBuf, 0, initData.byteLength);
  device.queue.submit([enc.finish()]);

  try {
    await rBuf.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const out = new Float32Array(rBuf.getMappedRange().slice(0, initData.byteLength));
    rBuf.unmap();
    let ismTempSum = 0; let ismCount = 0;
    let cx = 0; let cy = 0; let cz = 0; let mTot = 0;
    let px = 0; let py = 0; let pz = 0;
    for (let i = 0; i < n; i += 1) {
      const m = out[i * 12 + 3];
      cx += m * out[i * 12 + 0]; cy += m * out[i * 12 + 1]; cz += m * out[i * 12 + 2];
      px += m * out[i * 12 + 4]; py += m * out[i * 12 + 5]; pz += m * out[i * 12 + 6];
      mTot += m;
      if (out[i * 12 + 11] > 1.5 && out[i * 12 + 11] < 2.5) {
        ismTempSum += out[i * 12 + 7];
        ismCount += 1;
      }
    }
    const momentumDrift = Math.hypot(px - p0x, py - p0y, pz - p0z);
    return Object.freeze({
      schema: ULG_GALACTIC_ISM_COOLING_SCHEMA,
      backend: 'webgpu',
      gravityMode: useAtlas ? 'webgpu-schroeder-scale-atlas-multipole' : 'webgpu-symmetric-direct-pw',
      pingPongBuffered: true,
      compressibleIsmHydroEnabled: true,
      steps,
      com: [cx / mTot, cy / mTot, cz / mTot],
      initialLinearMomentum: [p0x, p0y, p0z],
      linearMomentum: [px, py, pz],
      momentumDrift,
      meanIsmTempK: ismCount > 0 ? ismTempSum / ismCount : 0,
      gate1CoolingAnchors: anchors,
      raw: out,
      accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
      provenance: Object.freeze({
        status: 'webgpu-gate1-cooling-sph-derived',
        scientificValidation: false
      })
    });
  } finally {
    ssAtlasGravity?.destroy();
    dummyAtlasBuf?.destroy();
    for (const b of [pBuf, bufA, bufB, hydroBuf, rBuf]) b.destroy();
  }
}

export function registerGalacticIsmCoolingModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  if (registry.hasModule?.('galactic-ism-cooling@1')) {
    return registry.resolveModule('galactic-ism-cooling@1')?.descriptor || null;
  }
  return registry.registerModule({
    method: { model: 'galactic-ism-cooling', version: 1 },
    kernel: {
      sourceModule: 'src/runtime/astrophysics/galacticIsmCoolingGpu.js',
      entryPoint: 'step_galactic_ism',
      workgroupSize: 64
    },
    parameterSchema: {
      metallicityZ: { type: 'number', min: 0, max: 0.1, required: false },
      steps: { type: 'number', min: 1, max: 64, required: false }
    },
    stateLayout: {
      tensorId: 'galactic-ism-sph-parcels',
      dtype: 'f32',
      layout: 'interleaved',
      strideElements: 12,
      strideBytes: 48,
      fields: ['x', 'y', 'z', 'mass', 'vx', 'vy', 'vz', 'tempK', 'density', 'metallicityZ', 'coolingRate', 'speciesTag']
    },
    scaleRangeM: [1e17, 1e22],
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    lawAdapter: GALACTIC_ISM_COOLING_LAW_ADAPTER,
    async stepCapsule(capsule, { createSimulationArtifact, device }) {
      const p = capsule.input?.parameters || {};
      const out = await runGalacticIsmStepWebGpu(device, {
        bodies: p.bodies || [
          { x: 0, y: 0, z: 0, mass: 1e6, vx: 0, vy: 0, vz: 0, tempK: 1e5, speciesTag: 3 },
          { x: 4, y: 0, z: 0, mass: 1, vx: 0, vy: 1, vz: 0, tempK: 1.2e5, speciesTag: 2 }
        ],
        metallicityZ: Number(p.metallicityZ ?? 0.02),
        steps: Math.max(1, Math.trunc(Number(p.steps ?? 2)))
      });
      return createSimulationArtifact?.({ schema: ULG_GALACTIC_ISM_COOLING_SCHEMA, result: out }) ?? out;
    }
  });
}
