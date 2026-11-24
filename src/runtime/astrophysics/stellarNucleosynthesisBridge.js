// Gate 5B (10^+8 -> 10^+17 m): Stellar Nucleosynthesis Bridge & G7 Advisory
// Lane-Emden Polytrope Verifier (`src/runtime/astrophysics/stellarNucleosynthesisBridge.js`).
//
// Connects Gate 1 Stage P1.1 `nuclearBindingEnergyMeV(Z, A)` directly to
// stellar fusion & core-collapse channels (`pp`, `triple-alpha`, `alpha-chain`
// C -> O -> Ne -> Mg -> Si -> Fe-56, and endothermic Fe-56 photodisintegration)
// with exact nucleon/charge/lepton mass-difference Q-values, plus WebGPU compute
// kernels for batched nuclear burning rates and batched RK4 Lane-Emden polytrope
// hydrostatic equilibrium (`n = 1.5` convective, `n = 3.0` Eddington radiative).

import { nuclearBindingEnergyMeV } from '../nuclear/nuclearStructureGpu.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_STELLAR_NUCLEAR_BRIDGE_SCHEMA = 'ulg.astrophysics.stellar-nuclear-network.v1';
export const ULG_STELLAR_NUCLEAR_GPU_SCHEMA = 'ulg.astrophysics.stellar-nuclear-webgpu.v1';
export const ULG_LANE_EMDEN_GPU_SCHEMA = 'ulg.astrophysics.lane-emden-webgpu.v1';

const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x01,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  UNIFORM: 0x40,
  STORAGE: 0x80
});

// CODATA fundamental nuclear rest masses (MeV/c^2) & SI conversions
export const M_PROTON_MEV = 938.27208816;
export const M_NEUTRON_MEV = 939.56542052;
export const M_ELECTRON_MEV = 0.51099895;
// Atomic mass difference per p -> n beta+/EC conversion (including e+e- annihilation):
//   M(H-1) - m_n = m_p + m_e - m_n = -0.78233341 MeV
export const BETA_PLUS_ATOMIC_DELTA_MEV = M_PROTON_MEV + M_ELECTRON_MEV - M_NEUTRON_MEV;
const MEV_TO_J = 1.602176634e-13;
const PROTON_MASS_KG = 1.67262192369e-27;

const STELLAR_REACTION_TEMPLATES = Object.freeze([
  {
    id: 'pp-chain',
    label: '4 ¹H → ⁴He + 2e⁺ + 2ν_e',
    reactants: [[1, 1, 4]],
    products: [[2, 4, 1]],
    ignitionTempK: 1.0e7,
    chargeConservedWithLeptons: true,
    neutrinoLossMeV: 0.53
  },
  {
    id: 'triple-alpha',
    label: '3 ⁴He → ¹²C',
    reactants: [[2, 4, 3]],
    products: [[6, 12, 1]],
    ignitionTempK: 1.0e8,
    neutrinoLossMeV: 0.0
  },
  {
    id: 'c12-alpha',
    label: '¹²C + ⁴He → ¹⁶O',
    reactants: [[6, 12, 1], [2, 4, 1]],
    products: [[8, 16, 1]],
    ignitionTempK: 1.5e8,
    neutrinoLossMeV: 0.0
  },
  {
    id: 'o16-alpha',
    label: '¹⁶O + ⁴He → ²⁰Ne',
    reactants: [[8, 16, 1], [2, 4, 1]],
    products: [[10, 20, 1]],
    ignitionTempK: 5.0e8,
    neutrinoLossMeV: 0.0
  },
  {
    id: 'ne20-alpha',
    label: '²⁰Ne + ⁴He → ²⁴Mg',
    reactants: [[10, 20, 1], [2, 4, 1]],
    products: [[12, 24, 1]],
    ignitionTempK: 1.2e9,
    neutrinoLossMeV: 0.0
  },
  {
    id: 'mg24-alpha',
    label: '²⁴Mg + ⁴He → ²⁸Si',
    reactants: [[12, 24, 1], [2, 4, 1]],
    products: [[14, 28, 1]],
    ignitionTempK: 1.8e9,
    neutrinoLossMeV: 0.0
  },
  {
    id: 'si28-to-fe56',
    label: '2 ²⁸Si → ⁵⁶Ni → ⁵⁶Fe + 2e⁺ + 2ν_e',
    reactants: [[14, 28, 2]],
    products: [[26, 56, 1]],
    ignitionTempK: 3.0e9,
    chargeConservedWithLeptons: true,
    neutrinoLossMeV: 1.80
  },
  {
    id: 'fe56-photodisintegration',
    label: '⁵⁶Fe + γ → 13 ⁴He + 4n',
    reactants: [[26, 56, 1]],
    products: [[2, 4, 13], [0, 1, 4]],
    ignitionTempK: 5.5e9,
    neutrinoLossMeV: 0.0
  }
]);

let cachedNetwork = null;

/**
 * Derive exact stellar nucleosynthesis Q-values directly from Gate 1
 * `nuclearBindingEnergyMeV(Z, A)` including exact beta+/EC nucleon+electron
 * rest-mass shifts (`deltaZ * (m_p + m_e - m_n)c^2`) and thermal neutrino losses.
 */
export function buildGate1StellarNuclearNetwork() {
  if (cachedNetwork) return cachedNetwork;
  const channels = STELLAR_REACTION_TEMPLATES.map((tpl) => {
    const aIn = tpl.reactants.reduce((s, [, a, c]) => s + a * c, 0);
    const aOut = tpl.products.reduce((s, [, a, c]) => s + a * c, 0);
    if (aIn !== aOut) {
      throw new RangeError(`Nucleon conservation violation in ${tpl.id}: ${aIn} !== ${aOut}`);
    }
    const zIn = tpl.reactants.reduce((s, [z, , c]) => s + z * c, 0);
    const zOut = tpl.products.reduce((s, [z, , c]) => s + z * c, 0);
    if (!tpl.chargeConservedWithLeptons && zIn !== zOut) {
      throw new RangeError(`Charge conservation violation in ${tpl.id}: ${zIn} !== ${zOut}`);
    }
    const bIn = tpl.reactants.reduce((s, [z, a, c]) => s + nuclearBindingEnergyMeV(z, a) * c, 0);
    const bOut = tpl.products.reduce((s, [z, a, c]) => s + nuclearBindingEnergyMeV(z, a) * c, 0);
    // Exact atomic-mass Q-value:
    //   Q_total = (B_out - B_in) + (Z_in - Z_out) * (m_p + m_e - m_n)
    // For pp-chain (4 H-1 -> He-4 + 2e+ + 2nu_e, deltaZ = +2):
    //   28.2957 + 2 * (-0.78233341) = 26.7310 MeV total, - 0.53 MeV nu = 26.2010 MeV thermal.
    const deltaZ = zIn - zOut;
    const qValueTotalMeV = (bOut - bIn) + deltaZ * BETA_PLUS_ATOMIC_DELTA_MEV;
    const neutrinoLossMeV = Number(tpl.neutrinoLossMeV || 0);
    const qValueThermalMeV = qValueTotalMeV > 0
      ? Math.max(0, qValueTotalMeV - neutrinoLossMeV)
      : qValueTotalMeV;
    const qValueJPerKg = (Math.abs(qValueThermalMeV) * MEV_TO_J) / (aIn * PROTON_MASS_KG);

    return Object.freeze({
      id: tpl.id,
      label: tpl.label,
      nucleonsConserved: aIn,
      deltaZ,
      ignitionTempK: tpl.ignitionTempK,
      qValueMeV: qValueTotalMeV,
      qValueTotalMeV,
      qValueThermalMeV,
      neutrinoLossMeV,
      qValueJPerKg,
      exothermic: qValueTotalMeV > 0
    });
  });

  const byId = Object.freeze(Object.fromEntries(channels.map((c) => [c.id, c])));
  cachedNetwork = Object.freeze({
    schema: ULG_STELLAR_NUCLEAR_BRIDGE_SCHEMA,
    channels: Object.freeze(channels),
    byId,
    accuracyTier: ULG_ACCURACY_TIERS.TIER_1_QUANTITATIVE,
    provenance: Object.freeze({
      status: 'gate1-nuclear-derived',
      scientificValidation: false
    })
  });
  return cachedNetwork;
}

/**
 * Convenience extractor returning the exact Gate 1 nuclear specific energies
 * (`J/kg` thermal deposition per burned fuel mass) consumed directly by
 * `selfGravitatingHydroGpu.js` and `hydrogenStellarClosure.js`.
 */
export function getGate1StellarBurnConstants() {
  const { byId } = buildGate1StellarNuclearNetwork();
  return Object.freeze({
    ppTotalMeV: byId['pp-chain'].qValueTotalMeV,
    ppThermalMeV: byId['pp-chain'].qValueThermalMeV,
    ppJPerKgH: byId['pp-chain'].qValueJPerKg,
    tripleAlphaMeV: byId['triple-alpha'].qValueThermalMeV,
    tripleAlphaJPerKgHe: byId['triple-alpha'].qValueJPerKg,
    fePhotodisMeV: Math.abs(byId['fe56-photodisintegration'].qValueTotalMeV),
    fePhotodisJPerKgFe: byId['fe56-photodisintegration'].qValueJPerKg
  });
}

// =========================================================================
// WebGPU Compute Kernel 1: Batched Gate 1 Stellar Nuclear Network Evaluator
// =========================================================================
export const stellarNuclearNetworkWebGpuWgsl = /* wgsl */ `
struct NuclearNetParams {
  sample_count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  q_pp_j_per_kg: f32,
  q_3a_j_per_kg: f32,
  q_photodis_j_per_kg: f32,
  pad3: f32,
};

struct NuclearSampleIn {
  // [rhoKgM3, temperatureK, xH, xHe]
  state0: vec4<f32>,
  // [xZ, dtS, pad, pad]
  state1: vec4<f32>,
};

struct NuclearSampleOut {
  // [epsPpWPerKg, epsCnoWPerKg, eps3aWPerKg, epsPhotodisWPerKg]
  rates: vec4<f32>,
  // [nextXH, nextXHe, nextXZ, energyDepositedJPerKg]
  burn: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: NuclearNetParams;
@group(0) @binding(1) var<storage, read> samples_in: array<NuclearSampleIn>;
@group(0) @binding(2) var<storage, read_write> samples_out: array<NuclearSampleOut>;

@compute @workgroup_size(64)
fn eval_stellar_nuclear_network(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.sample_count) { return; }
  let s0 = samples_in[i].state0;
  let s1 = samples_in[i].state1;
  let rho = max(0.0, s0.x);
  let temp_k = max(1.0, s0.y);
  let sum_x = max(1e-12, s0.z + s0.w + s1.x);
  var xH = max(0.0, s0.z / sum_x);
  var xHe = max(0.0, s0.w / sum_x);
  var xZ = max(0.0, s1.x / sum_x);
  let dt_s = max(0.0, s1.y);

  let rho_cgs = rho * 1e-3;
  let t6 = temp_k * 1e-6;
  let t8 = temp_k * 1e-8;
  let t9 = temp_k * 1e-9;

  var eps_pp = 0.0;
  if (t6 > 0.5 && xH > 1e-6) {
    let t6_cbrt = pow(t6, 0.33333334);
    let tau_pp = 33.80 / t6_cbrt;
    if (tau_pp < 85.0) {
      let screen = (1.0 + 0.0123 * t6_cbrt + 0.0109 * t6_cbrt * t6_cbrt) * 1.18;
      eps_pp = 238.0 * rho_cgs * xH * xH * pow(t6, -0.6666667) * exp(-tau_pp) * screen;
    }
  }
  var eps_cno = 0.0;
  if (t6 > 5.0 && xH > 1e-6 && xZ > 1e-6) {
    let t6_cbrt = pow(t6, 0.33333334);
    let tau_cno = 152.28 / t6_cbrt;
    if (tau_cno < 85.0) {
      eps_cno = 4.4e21 * rho_cgs * xH * (0.5 * xZ) * pow(t6, -0.6666667) * exp(-tau_cno);
    }
  }
  var eps_3a = 0.0;
  if (t8 > 0.35 && xHe > 1e-6) {
    let tau_3a = 44.027 / t8;
    if (tau_3a < 85.0) {
      eps_3a = 5.09e7 * (rho_cgs * rho_cgs) * (xHe * xHe * xHe) * pow(t8, -3.0) * exp(-tau_3a);
    }
  }
  var eps_photodis = 0.0;
  if (t9 > 1.2 && xZ > 0.30) {
    let ramp = clamp((t9 - 1.2) / 1.5, 0.0, 1.0);
    eps_photodis = 1.5e8 * xZ * ramp * ramp * exp(-max(0.0, 12.0 / t9 - 5.0));
  }

  var e_dep_j_per_kg = 0.0;
  if (dt_s > 0.0) {
    let dX = min(xH, ((eps_pp + eps_cno) * dt_s) / max(1.0, params.q_pp_j_per_kg));
    let dY = min(xHe + dX, (eps_3a * dt_s) / max(1.0, params.q_3a_j_per_kg));
    let dZ_photo = min(xZ + dY, (eps_photodis * dt_s) / max(1.0, params.q_photodis_j_per_kg));
    e_dep_j_per_kg = dX * params.q_pp_j_per_kg + dY * params.q_3a_j_per_kg - dZ_photo * params.q_photodis_j_per_kg;
    xH = max(0.0, xH - dX);
    xHe = max(0.0, xHe + dX - dY + dZ_photo);
    xZ = max(0.0, xZ + dY - dZ_photo);
    let norm = max(1e-12, xH + xHe + xZ);
    xH = xH / norm;
    xHe = xHe / norm;
    xZ = xZ / norm;
  }

  samples_out[i] = NuclearSampleOut(
    vec4<f32>(eps_pp, eps_cno, eps_3a, eps_photodis),
    vec4<f32>(xH, xHe, xZ, e_dep_j_per_kg)
  );
}
`;

/**
 * Evaluate Gate 1 stellar nuclear reaction rates & conservative `Q * dX` burning
 * for an array of `(rhoKgM3, temperatureK, xH, xHe, xZ, dtS)` states strictly on WebGPU.
 */
export async function evaluateStellarNuclearNetworkWebGpu(device, samples) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('evaluateStellarNuclearNetworkWebGpu requires a live WebGPU GPUDevice');
  }
  const list = Array.isArray(samples) ? samples : [];
  if (list.length === 0) {
    throw new TypeError('evaluateStellarNuclearNetworkWebGpu requires at least one state sample');
  }
  const burn = getGate1StellarBurnConstants();
  const inData = new Float32Array(list.length * 8);
  for (let i = 0; i < list.length; i += 1) {
    const s = list[i];
    inData.set([
      Number(s.rhoKgM3 ?? 1.5e5),
      Number(s.temperatureK ?? 1.5e7),
      Number(s.xH ?? 0.74),
      Number(s.xHe ?? 0.25),
      Number(s.xZ ?? s.xMetals ?? 0.01),
      Number(s.dtS ?? 0),
      0,
      0
    ], i * 8);
  }
  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage')
  ];
  const pipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-stellar-nuclear-network.v1',
    label: 'ulg-stellar-nuclear-network',
    code: stellarNuclearNetworkWebGpuWgsl,
    entryPoint: 'eval_stellar_nuclear_network',
    bindings
  });
  const pAb = new ArrayBuffer(32);
  new Uint32Array(pAb, 0, 4).set([list.length, 0, 0, 0]);
  new Float32Array(pAb, 16, 4).set([burn.ppJPerKgH, burn.tripleAlphaJPerKgHe, burn.fePhotodisJPerKgFe, 0]);

  const pBuf = device.createBuffer({ size: 32, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const inBuf = device.createBuffer({ size: inData.byteLength, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  const outBuf = device.createBuffer({ size: inData.byteLength, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const readBuf = device.createBuffer({ size: inData.byteLength, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });

  try {
    device.queue.writeBuffer(pBuf, 0, pAb);
    device.queue.writeBuffer(inBuf, 0, inData);
    const bg = device.createBindGroup({
      layout: pipe.bindGroupLayout,
      entries: [pBuf, inBuf, outBuf].map((buffer, binding) => ({ binding, resource: { buffer } }))
    });
    const enc = device.createCommandEncoder({ label: 'ulg-stellar-nuclear-network' });
    const pass = enc.beginComputePass();
    pass.setPipeline(pipe.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(list.length / 64));
    pass.end();
    enc.copyBufferToBuffer(outBuf, 0, readBuf, 0, inData.byteLength);
    device.queue.submit([enc.finish()]);

    await readBuf.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const raw = new Float32Array(readBuf.getMappedRange().slice(0, inData.byteLength));
    readBuf.unmap();

    const results = [];
    for (let i = 0; i < list.length; i += 1) {
      const o = i * 8;
      results.push(Object.freeze({
        epsPpWPerKg: raw[o + 0],
        epsCnoWPerKg: raw[o + 1],
        eps3aWPerKg: raw[o + 2],
        epsPhotodisWPerKg: raw[o + 3],
        epsTotalWPerKg: raw[o + 0] + raw[o + 1] + raw[o + 2],
        nextMassFractions: Object.freeze({ xH: raw[o + 4], xHe: raw[o + 5], xZ: raw[o + 6] }),
        energyDepositedJPerKg: raw[o + 7]
      }));
    }
    return Object.freeze({
      schema: ULG_STELLAR_NUCLEAR_GPU_SCHEMA,
      backend: 'webgpu',
      burnConstants: burn,
      results: Object.freeze(results),
      provenance: Object.freeze({
        status: 'gate1-nuclear-webgpu-derived',
        scientificValidation: false
      })
    });
  } finally {
    for (const b of [pBuf, inBuf, outBuf, readBuf]) b.destroy();
  }
}

// =========================================================================
// WebGPU Compute Kernel 2: Batched RK4 Lane-Emden Polytrope Integrator
// =========================================================================
export const laneEmdenWebGpuWgsl = /* wgsl */ `
struct LaneEmdenParams {
  count: u32,
  max_steps: u32,
  pad0: u32,
  pad1: u32,
  d_xi: f32,
  max_xi: f32,
  pad2: f32,
  pad3: f32,
};

@group(0) @binding(0) var<uniform> params: LaneEmdenParams;
@group(0) @binding(1) var<storage, read> indices_n: array<f32>;
// Output vec4(polytropeIndexN, xi1, massIntegral, centralToMeanDensityRatio)
@group(0) @binding(2) var<storage, read_write> results: array<vec4<f32>>;

fn le_deriv(x: f32, th: f32, dth: f32, poly_n: f32) -> vec2<f32> {
  let th_safe = max(0.0, th);
  let th_n = select(0.0, pow(th_safe, poly_n), th_safe > 0.0 || poly_n == 0.0);
  return vec2<f32>(dth, -(2.0 / x) * dth - th_n);
}

@compute @workgroup_size(64)
fn solve_lane_emden_rk4(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.count) { return; }
  let poly_n = indices_n[i];
  let dxi = params.d_xi;
  var xi = dxi;
  let xi2 = xi * xi;
  var theta = 1.0 - xi2 / 6.0 + (poly_n * xi2 * xi2) / 120.0;
  var dtheta = -xi / 3.0 + (poly_n * xi2 * xi) / 30.0;

  for (var step = 0u; step < params.max_steps; step = step + 1u) {
    if (theta <= 0.0 || xi >= params.max_xi) { break; }
    let k1 = le_deriv(xi, theta, dtheta, poly_n);
    let k2 = le_deriv(xi + 0.5 * dxi, theta + 0.5 * dxi * k1.x, dtheta + 0.5 * dxi * k1.y, poly_n);
    let k3 = le_deriv(xi + 0.5 * dxi, theta + 0.5 * dxi * k2.x, dtheta + 0.5 * dxi * k2.y, poly_n);
    let k4 = le_deriv(xi + dxi, theta + dxi * k3.x, dtheta + dxi * k3.y, poly_n);
    let next_theta = theta + (dxi / 6.0) * (k1.x + 2.0 * k2.x + 2.0 * k3.x + k4.x);
    let next_dtheta = dtheta + (dxi / 6.0) * (k1.y + 2.0 * k2.y + 2.0 * k3.y + k4.y);
    if (next_theta <= 0.0) {
      let frac = theta / max(1e-12, theta - next_theta);
      xi = xi + frac * dxi;
      dtheta = dtheta + frac * (next_dtheta - dtheta);
      theta = 0.0;
      break;
    }
    xi = xi + dxi;
    theta = next_theta;
    dtheta = next_dtheta;
  }

  let mass_int = -(xi * xi * dtheta);
  let rho_ratio = -(xi / min(-1e-12, 3.0 * dtheta));
  results[i] = vec4<f32>(poly_n, xi, mass_int, rho_ratio);
}
`;

/**
 * Solve an array of dimensionless Lane-Emden polytrope indices strictly on WebGPU via RK4.
 */
export async function solveLaneEmdenPolytropeWebGpu(device, indices = [1.5, 3.0], {
  dXi = 0.002,
  maxXi = 25.0
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('solveLaneEmdenPolytropeWebGpu requires a live WebGPU GPUDevice');
  }
  const arr = Float32Array.from(Array.isArray(indices) ? indices : [indices]);
  if (arr.length === 0) {
    throw new TypeError('solveLaneEmdenPolytropeWebGpu requires at least one polytrope index');
  }
  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage')
  ];
  const pipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-lane-emden-rk4.v1',
    label: 'ulg-lane-emden-rk4',
    code: laneEmdenWebGpuWgsl,
    entryPoint: 'solve_lane_emden_rk4',
    bindings
  });
  const maxSteps = Math.ceil(maxXi / Math.max(1e-5, dXi)) + 4;
  const pAb = new ArrayBuffer(32);
  new Uint32Array(pAb, 0, 4).set([arr.length, maxSteps, 0, 0]);
  new Float32Array(pAb, 16, 4).set([dXi, maxXi, 0, 0]);

  const pBuf = device.createBuffer({ size: 32, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const inBuf = device.createBuffer({ size: Math.max(16, arr.byteLength), usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  const outBuf = device.createBuffer({ size: arr.length * 16, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const readBuf = device.createBuffer({ size: arr.length * 16, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });

  try {
    device.queue.writeBuffer(pBuf, 0, pAb);
    device.queue.writeBuffer(inBuf, 0, arr);
    const bg = device.createBindGroup({
      layout: pipe.bindGroupLayout,
      entries: [pBuf, inBuf, outBuf].map((buffer, binding) => ({ binding, resource: { buffer } }))
    });
    const enc = device.createCommandEncoder({ label: 'ulg-lane-emden-rk4' });
    const pass = enc.beginComputePass();
    pass.setPipeline(pipe.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(arr.length / 64));
    pass.end();
    enc.copyBufferToBuffer(outBuf, 0, readBuf, 0, arr.length * 16);
    device.queue.submit([enc.finish()]);

    await readBuf.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const raw = new Float32Array(readBuf.getMappedRange().slice(0, arr.length * 16));
    readBuf.unmap();

    const solutions = [];
    for (let i = 0; i < arr.length; i += 1) {
      const o = i * 4;
      solutions.push(Object.freeze({
        polytropeIndexN: raw[o + 0],
        xi1: raw[o + 1],
        massIntegral: raw[o + 2],
        centralToMeanDensityRatio: raw[o + 3],
        g7Advisory: true
      }));
    }
    return Object.freeze({
      schema: ULG_LANE_EMDEN_GPU_SCHEMA,
      backend: 'webgpu',
      solutions: Object.freeze(solutions)
    });
  } finally {
    for (const b of [pBuf, inBuf, outBuf, readBuf]) b.destroy();
  }
}

/**
 * Host offline G7 advisory RK4 Lane-Emden polytrope reference solver
 * (for unit tests without WebGPU; production runtime uses `solveLaneEmdenPolytropeWebGpu`).
 */
export function solveLaneEmdenPolytrope(n = 3.0, { dXi = 0.002, maxXi = 25.0 } = {}) {
  const polyN = Number(n);
  let xi = dXi;
  let theta = 1 - (xi * xi) / 6 + (polyN * (xi ** 4)) / 120;
  let dTheta = -xi / 3 + (polyN * (xi ** 3)) / 30;

  const deriv = (x, th, dth) => {
    const thSafe = Math.max(0, th);
    return [dth, -(2 / x) * dth - Math.pow(thSafe, polyN)];
  };

  while (theta > 0 && xi < maxXi) {
    const [k1t, k1d] = deriv(xi, theta, dTheta);
    const [k2t, k2d] = deriv(xi + 0.5 * dXi, theta + 0.5 * dXi * k1t, dTheta + 0.5 * dXi * k1d);
    const [k3t, k3d] = deriv(xi + 0.5 * dXi, theta + 0.5 * dXi * k2t, dTheta + 0.5 * dXi * k2d);
    const [k4t, k4d] = deriv(xi + dXi, theta + dXi * k3t, dTheta + dXi * k3d);
    const nextTheta = theta + (dXi / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
    const nextDTheta = dTheta + (dXi / 6) * (k1d + 2 * k2d + 2 * k3d + k4d);
    if (nextTheta <= 0) {
      const frac = theta / Math.max(1e-12, theta - nextTheta);
      xi += frac * dXi;
      dTheta += frac * (nextDTheta - dTheta);
      theta = 0;
      break;
    }
    xi += dXi;
    theta = nextTheta;
    dTheta = nextDTheta;
  }

  const massIntegral = -(xi * xi * dTheta);
  const centralToMeanDensityRatio = -(xi / (3 * dTheta));
  return Object.freeze({
    polytropeIndexN: polyN,
    xi1: xi,
    massIntegral,
    centralToMeanDensityRatio,
    g7Advisory: true
  });
}
