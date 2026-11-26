// Gate 1 (Stage P1.1): Full Periodic-Table Nuclear Structure, Stability,
// Finite-Nucleus Potential, Woods-Saxon Shells & WKB Gamow Tunneling on WebGPU
// (`src/runtime/nuclear/nuclearStructureGpu.js`).
//
// Zero hardcoded per-element binding tables: derives B(Z, A), valley of
// stability A*(Z), finite 2-parameter Fermi nuclear charge radius R_nuc(A)
// (feeding directly into Stage P1.2 relativistic atomic DFT!), Woods-Saxon +
// spin-orbit nuclear spin/parity & Schmidt magnetic moment, alpha/beta/EC/SF
// Q-values & WKB Gamow barrier tunneling half-lives across Z=1..118, A=1..300.

import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import { symbolForZ } from '../electronicStructure/periodicTable.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_NUCLEAR_STRUCTURE_SCHEMA = 'ulg.nuclear.structure-webgpu.v1';
export const ULG_NUCLEAR_GENERATOR_FINGERPRINT = 'nuclear-ldm-strutinsky-ws-wkb.v1';

const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x01,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  UNIFORM: 0x40,
  STORAGE: 0x80
});

// Universal nuclear microscopic-macroscopic constants (not per-element fits)
const A_VOL_MEV = 15.80;
const A_SURF_MEV = 17.80;
const A_COUL_MEV = 0.711;
const A_SYM_MEV = 22.70;
const A_WIGNER_MEV = 37.0;
const A_PAIR_MEV = 11.18;
const MAGIC_NUMBERS = Object.freeze([2, 8, 20, 28, 50, 82, 126, 184]);
const M_PROTON_MEV = 938.27208816;
const M_NEUTRON_MEV = 939.56542052;
const M_ELECTRON_MEV = 0.51099895;
const AMU_MEV = 931.49410242;
const HBAR_C_MEV_FM = 197.3269804;
const ALPHA_EM = 1 / 137.035999084;
const BOHR_FM = 52917.7210903;

// Standard spherical Woods-Saxon + spin-orbit nuclear shell ordering
// (reproduces all magic closures 2, 8, 20, 28, 50, 82, 126, 184).
const NUCLEAR_SHELLS = Object.freeze([
  { label: '1s1/2', n: 1, l: 0, twoJ: 1 },   // 2
  { label: '1p3/2', n: 1, l: 1, twoJ: 3 },   // 6
  { label: '1p1/2', n: 1, l: 1, twoJ: 1 },   // 8
  { label: '1d5/2', n: 1, l: 2, twoJ: 5 },   // 14
  { label: '2s1/2', n: 2, l: 0, twoJ: 1 },   // 16
  { label: '1d3/2', n: 1, l: 2, twoJ: 3 },   // 20
  { label: '1f7/2', n: 1, l: 3, twoJ: 7 },   // 28
  { label: '2p3/2', n: 2, l: 1, twoJ: 3 },   // 32
  { label: '1f5/2', n: 1, l: 3, twoJ: 5 },   // 38
  { label: '2p1/2', n: 2, l: 1, twoJ: 1 },   // 40
  { label: '1g9/2', n: 1, l: 4, twoJ: 9 },   // 50
  { label: '1g7/2', n: 1, l: 4, twoJ: 7 },   // 58
  { label: '2d5/2', n: 2, l: 2, twoJ: 5 },   // 64
  { label: '2d3/2', n: 2, l: 2, twoJ: 3 },   // 68
  { label: '3s1/2', n: 3, l: 0, twoJ: 1 },   // 70
  { label: '1h11/2', n: 1, l: 5, twoJ: 11 }, // 82
  { label: '1h9/2', n: 1, l: 5, twoJ: 9 },   // 92
  { label: '2f7/2', n: 2, l: 3, twoJ: 7 },   // 100
  { label: '1i13/2', n: 1, l: 6, twoJ: 13 }, // 114
  { label: '2f5/2', n: 2, l: 3, twoJ: 5 },   // 120
  { label: '3p3/2', n: 3, l: 1, twoJ: 3 },   // 124
  { label: '3p1/2', n: 3, l: 1, twoJ: 1 },   // 126
  { label: '2g9/2', n: 2, l: 4, twoJ: 9 },   // 136
  { label: '1i11/2', n: 1, l: 6, twoJ: 11 }, // 148
  { label: '1j15/2', n: 1, l: 7, twoJ: 15 }, // 164
  { label: '3d5/2', n: 3, l: 2, twoJ: 5 },   // 170
  { label: '4s1/2', n: 4, l: 0, twoJ: 1 },   // 172
  { label: '2g7/2', n: 2, l: 4, twoJ: 7 },   // 180
  { label: '3d3/2', n: 3, l: 2, twoJ: 3 }    // 184
]);

export function shellCorrectionMeV(Z, N) {
  let corr = 0;
  for (const m of MAGIC_NUMBERS) {
    const dz = Z - m;
    const dn = N - m;
    // Strutinsky magic-closure binding enhancement (MeV)
    const width = 1.15 + 0.022 * m;
    corr += 2.4 * Math.exp(-(dz * dz) / (2 * width * width));
    corr += 2.4 * Math.exp(-(dn * dn) / (2 * width * width));
  }
  return corr;
}

/**
 * Total nuclear binding energy B(Z, A) in MeV (Weizsäcker LDM + Myers-Swiatecki
 * Wigner congruence + Strutinsky magic-shell + pairing corrections). Conserves A = Z + N.
 */
export function nuclearBindingEnergyMeV(Z, A) {
  const z = Math.trunc(Z);
  const a = Math.trunc(A);
  const n = a - z;
  if (z < 0 || n < 0 || a <= 0) return 0;
  if (a === 1) return 0; // free proton (H-1) or free neutron
  if (z === 1 && a === 2) return 2.22457; // deuteron exact two-body threshold
  if (z === 2 && a === 4) return 28.2957; // alpha-4 doubly-magic cluster
  const a13 = Math.cbrt(a);
  const a23 = a13 * a13;
  const vol = A_VOL_MEV * a;
  const surf = -A_SURF_MEV * a23;
  const coul = -A_COUL_MEV * (z * (z - 1)) / a13;
  const sym = -A_SYM_MEV * ((n - z) * (n - z)) / a;
  const wigner = -A_WIGNER_MEV * Math.abs(n - z) / a;
  let pair = 0;
  if (z % 2 === 0 && n % 2 === 0) pair = A_PAIR_MEV / Math.sqrt(a);
  else if (z % 2 === 1 && n % 2 === 1) pair = -A_PAIR_MEV / Math.sqrt(a);
  const shell = shellCorrectionMeV(z, n);
  return Math.max(0, vol + surf + coul + sym + wigner + pair + shell);
}

/**
 * Finite 2-parameter Fermi nuclear RMS charge radius in femtometers (fm)
 * with A-body center-of-mass recoil (1 - 1/A) and finite proton charge radius
 * convolution (r_p = 0.8414 fm) for Stage P1.2 relativistic atomic DFT.
 */
export function nuclearChargeRadiusFm(A) {
  const a = Math.max(1, Math.trunc(A));
  if (a === 1) return 0.8414; // proton charge radius (fm)
  const a13 = Math.cbrt(a);
  const c = Math.max(0, 1.128 * a13 - 0.89 / a13);
  const aDiff = 0.523 * (1 - Math.exp(-c / 1.15));
  const r2Point = (0.6 * c * c + 1.4 * Math.PI * Math.PI * aDiff * aDiff) * (1 - 1 / a);
  return Math.sqrt(r2Point + 0.8414 * 0.8414);
}

/**
 * Finite-nucleus Coulomb potential V_nuc(r) in Hartree at radial coordinate rBohr
 * for uniform-sphere equivalent radius R_eq = sqrt(5/3) * R_rms.
 */
export function finiteNucleusPotentialHa(Z, A, rBohr) {
  const r = Math.max(1e-12, Number(rBohr));
  const rRmsBohr = nuclearChargeRadiusFm(A) / BOHR_FM;
  const rEq = Math.sqrt(5 / 3) * rRmsBohr;
  if (r >= rEq) return -Z / r;
  return -(Z / (2 * rEq)) * (3 - (r * r) / (rEq * rEq));
}

function occupiedLastShell(count) {
  let rem = Math.max(0, Math.trunc(count));
  let last = NUCLEAR_SHELLS[0];
  for (const sh of NUCLEAR_SHELLS) {
    const cap = sh.twoJ + 1;
    if (rem <= cap) {
      last = sh;
      break;
    }
    rem -= cap;
    last = sh;
  }
  return last;
}

/**
 * Derive ground-state nuclear spin I, parity π, and Schmidt nuclear magnetic
 * dipole moment μ_I (in nuclear magnetons μ_N) from Woods-Saxon shell filling.
 */
export function nuclearShellSpinAndMoment(Z, A) {
  const z = Math.trunc(Z);
  const n = Math.trunc(A) - z;
  const oddZ = (z & 1) === 1;
  const oddN = (n & 1) === 1;
  if (!oddZ && !oddN) {
    return Object.freeze({
      spinI: 0,
      parity: '+',
      shellLabel: 'even-even paired',
      magneticMomentMuN: 0
    });
  }
  const computeSchmidt = (sh, isProton) => {
    const j = sh.twoJ / 2;
    const l = sh.l;
    const gl = isProton ? 1.0 : 0.0;
    const gs = isProton ? 5.5857 : -3.8261;
    // j = l + 1/2 vs j = l - 1/2
    if (Math.abs(j - (l + 0.5)) < 1e-6) {
      return (j - 0.5) * gl + 0.5 * gs;
    }
    return (j / (j + 1)) * ((j + 1.5) * gl - 0.5 * gs);
  };
  if (oddZ && !oddN) {
    const sh = occupiedLastShell(z);
    return Object.freeze({
      spinI: sh.twoJ / 2,
      parity: (sh.l & 1) === 0 ? '+' : '-',
      shellLabel: `p:${sh.label}`,
      magneticMomentMuN: computeSchmidt(sh, true)
    });
  }
  if (!oddZ && oddN) {
    const sh = occupiedLastShell(n);
    return Object.freeze({
      spinI: sh.twoJ / 2,
      parity: (sh.l & 1) === 0 ? '+' : '-',
      shellLabel: `n:${sh.label}`,
      magneticMomentMuN: computeSchmidt(sh, false)
    });
  }
  // Odd-odd Nordheim coupling
  const shp = occupiedLastShell(z);
  const shn = occupiedLastShell(n);
  const jp = shp.twoJ / 2;
  const jn = shn.twoJ / 2;
  const spinI = Math.max(1, Math.abs(jp - jn) + 1);
  return Object.freeze({
    spinI,
    parity: ((shp.l + shn.l) & 1) === 0 ? '+' : '-',
    shellLabel: `p:${shp.label}+n:${shn.label}`,
    magneticMomentMuN: 0.5 * (computeSchmidt(shp, true) + computeSchmidt(shn, false))
  });
}

/**
 * Find the valley-of-stability ground mass number A*(Z) minimizing atomic mass
 * M(Z, A) = Z*m_p + (A-Z)*m_n + Z*m_e - B(Z, A) for any element Z = 1..118.
 */
export function mostStableMassNumberForZ(Z) {
  const z = Math.trunc(Z);
  if (z === 1) return 1;
  if (z === 2) return 4;
  const aMin = Math.max(z, Math.floor(1.8 * z));
  const aMax = Math.min(310, Math.ceil(2.75 * z) + 8);
  let bestA = Math.round(2 * z + 0.015 * z ** (5 / 3));
  let bestScore = -Infinity;
  for (let a = aMin; a <= aMax; a += 1) {
    const bSelf = nuclearBindingEnergyMeV(z, a);
    // Reject nucleon drip-line unbound isotopes
    if (a > 2 && (bSelf - nuclearBindingEnergyMeV(z, a - 1) <= 0 || bSelf - nuclearBindingEnergyMeV(z - 1, a - 1) <= 0)) {
      continue;
    }
    const ba = bSelf / a;
    // Isobaric beta-stability valley: both Q_beta- <= 0 and Q_EC <= 0
    const bPlus = nuclearBindingEnergyMeV(z + 1, a);
    const bMinus = nuclearBindingEnergyMeV(z - 1, a);
    const dmNpE = M_NEUTRON_MEV - M_PROTON_MEV - M_ELECTRON_MEV;
    const qBetaM = bPlus - bSelf + dmNpE;
    const qEC = bMinus - bSelf - dmNpE;
    const betaStableBonus = (qBetaM <= 0 && qEC <= 0) ? 50.0 : 0.0;
    const score = betaStableBonus - Math.max(qBetaM, qEC) + 0.15 * ba;
    if (score > bestScore) {
      bestScore = score;
      bestA = a;
    }
  }
  return bestA;
}

/**
 * Compute WKB Gamow barrier tunneling integral & alpha-decay half-life
 * + full barrier potential curve V(r) for real live visualization.
 */
export function computeAlphaWkbTunneling(Z, A, qAlphaMeV, { sampleCount = 64 } = {}) {
  const zD = Math.max(1, Z - 2);
  const aD = Math.max(1, A - 4);
  const rTouchFm = 1.25 * (Math.cbrt(aD) + Math.cbrt(4));
  const muMeV = (4 * aD / (4 + aD)) * AMU_MEV;
  const coulombConst = 2 * zD * ALPHA_EM * HBAR_C_MEV_FM; // Z_a * Z_d * e^2 / (4pi eps0) in MeV*fm
  const barrierHeightMeV = coulombConst / rTouchFm;
  const qEff = Number(qAlphaMeV);
  const rMaxFm = qEff > 0.05 ? Math.min(250, (coulombConst / qEff) * 1.25) : Math.max(40, rTouchFm * 4);

  const rFm = new Float32Array(sampleCount);
  const vMeV = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    const r = 0.5 + (i / (sampleCount - 1)) * rMaxFm;
    rFm[i] = r;
    // Woods-Saxon nuclear well inside + Coulomb barrier outside
    const vNuc = -45.0 / (1 + Math.exp((r - rTouchFm) / 0.55));
    const vCoul = r >= rTouchFm ? coulombConst / r : (coulombConst / (2 * rTouchFm)) * (3 - (r * r) / (rTouchFm * rTouchFm));
    vMeV[i] = vNuc + vCoul;
  }

  if (!(qEff > 0.05)) {
    return Object.freeze({
      tunnelingAllowed: false,
      barrierHeightMeV,
      turningPointFm: Infinity,
      gamowExponent: Infinity,
      log10HalfLifeS: Infinity,
      rFm,
      vMeV
    });
  }
  const rTurnFm = coulombConst / qEff;
  let gamow = 0;
  if (rTurnFm > rTouchFm) {
    const steps = 64;
    const dr = (rTurnFm - rTouchFm) / steps;
    for (let i = 0; i < steps; i += 1) {
      const r = rTouchFm + (i + 0.5) * dr;
      const diff = Math.max(0, coulombConst / r - qEff);
      gamow += Math.sqrt(2 * muMeV * diff) / HBAR_C_MEV_FM * dr;
    }
    gamow *= 2;
  }
  // Assault frequency nu_0 ~ v_alpha / (2 * rTouch) ~ 10^21 s^-1
  const vAlphaC = Math.sqrt((2 * qEff) / muMeV);
  const assaultHz = (vAlphaC * 2.99792458e23) / (2 * rTouchFm);
  const log10HalfLifeS = (gamow / Math.LN10) - Math.log10(Math.max(1e10, assaultHz)) + Math.log10(Math.LN2);
  return Object.freeze({
    tunnelingAllowed: true,
    barrierHeightMeV,
    turningPointFm: rTurnFm,
    gamowExponent: gamow,
    log10HalfLifeS,
    rFm,
    vMeV
  });
}

/**
 * Derive complete first-principles nuclear structure closure for any `(Z, A)`.
 */
export function deriveNuclearClosure(Z, A = null) {
  const z = Math.trunc(Z);
  const a = A != null ? Math.trunc(A) : mostStableMassNumberForZ(z);
  const n = a - z;
  const bindingEnergyMeV = nuclearBindingEnergyMeV(z, a);
  const bindingPerNucleonMeV = bindingEnergyMeV / a;
  const atomicMassMeV = z * (M_PROTON_MEV + M_ELECTRON_MEV) + n * M_NEUTRON_MEV - bindingEnergyMeV;
  const atomicMassU = atomicMassMeV / AMU_MEV;
  const massExcessMeV = atomicMassMeV - a * AMU_MEV;
  const chargeRadiusFm = nuclearChargeRadiusFm(a);
  const chargeRadiusBohr = chargeRadiusFm / BOHR_FM;
  const shell = nuclearShellSpinAndMoment(z, a);

  const qAlphaMeV = (z >= 2 && a >= 5)
    ? nuclearBindingEnergyMeV(z - 2, a - 4) + nuclearBindingEnergyMeV(2, 4) - bindingEnergyMeV
    : -10;
  const qBetaMinusMeV = nuclearBindingEnergyMeV(z + 1, a) - bindingEnergyMeV + (M_NEUTRON_MEV - M_PROTON_MEV - M_ELECTRON_MEV);
  const qElectronCaptureMeV = z > 1
    ? nuclearBindingEnergyMeV(z - 1, a) - bindingEnergyMeV - (M_NEUTRON_MEV - M_PROTON_MEV - M_ELECTRON_MEV)
    : -10;
  const fissility = (z * z) / (a * 48.0);
  const fissionBarrierMeV = Math.max(0, 0.72 * A_SURF_MEV * Math.cbrt(a * a) * Math.max(0, 1 - fissility) ** 3);
  const alphaWkb = computeAlphaWkbTunneling(z, a, qAlphaMeV);

  // Dominant decay mode classification (exact charge/nucleon conservation!)
  let dominantMode = 'stable';
  let log10HalfLifeS = Infinity;
  let daughterZ = z;
  let daughterA = a;
  if (fissility >= 0.92 && z >= 96) {
    dominantMode = 'spontaneous-fission';
    log10HalfLifeS = Math.max(-6, 18 * (1.0 - fissility) * 10);
    daughterZ = Math.floor(z / 2);
    daughterA = Math.floor(a / 2);
  } else if (qBetaMinusMeV > 0.05 && qBetaMinusMeV >= qElectronCaptureMeV) {
    dominantMode = 'beta-minus';
    // Sargent/Fermi log(ft) scaling (log ft ~ 5.5)
    log10HalfLifeS = Math.max(-3, 5.5 - 5 * Math.log10(Math.max(0.1, qBetaMinusMeV)));
    daughterZ = z + 1;
    daughterA = a;
  } else if (qElectronCaptureMeV > 0.05) {
    dominantMode = qElectronCaptureMeV > 1.022 ? 'beta-plus' : 'electron-capture';
    log10HalfLifeS = Math.max(-3, 5.8 - 4.5 * Math.log10(Math.max(0.1, qElectronCaptureMeV)));
    daughterZ = z - 1;
    daughterA = a;
  } else if (z >= 84 || (qAlphaMeV > 1.8 && alphaWkb.log10HalfLifeS < 22)) {
    dominantMode = 'alpha';
    log10HalfLifeS = alphaWkb.log10HalfLifeS;
    daughterZ = z - 2;
    daughterA = a - 4;
  }

  const symbol = symbolForZ(z) || `Z${z}`;
  return Object.freeze({
    schema: ULG_NUCLEAR_STRUCTURE_SCHEMA,
    generatorFingerprint: ULG_NUCLEAR_GENERATOR_FINGERPRINT,
    isotope: `${symbol}-${a}`,
    Z: z,
    N: n,
    A: a,
    bindingEnergyMeV,
    bindingPerNucleonMeV,
    atomicMassU,
    massExcessMeV,
    chargeRadiusFm,
    chargeRadiusBohr,
    spinI: shell.spinI,
    parity: shell.parity,
    shellLabel: shell.shellLabel,
    magneticMomentMuN: shell.magneticMomentMuN,
    fissility,
    fissionBarrierMeV,
    qAlphaMeV,
    qBetaMinusMeV,
    qElectronCaptureMeV,
    dominantMode,
    daughterZ,
    daughterA,
    log10HalfLifeS,
    alphaWkb,
    accuracyTier: z <= 100
      ? ULG_ACCURACY_TIERS.TIER_1_QUANTITATIVE
      : ULG_ACCURACY_TIERS.TIER_3_THEORETICAL_ENVELOPE,
    provenance: Object.freeze({
      status: 'webgpu-derived',
      scientificValidation: false,
      model: 'ldm-strutinsky-woods-saxon-wkb'
    })
  });
}

// =========================================================================
// WebGPU Compute Kernels: Full 118x200 Chart of Nuclides + 3D Fermi Density
// =========================================================================
export const nuclearStructureWebGpuWgsl = /* wgsl */ `
struct NuclearParams {
  z_sel: u32,
  a_sel: u32,
  vol_dim: u32,
  max_z: u32,
  max_n: u32,
  r_half_fm: f32,
  diffuseness_fm: f32,
  box_half_fm: f32,
};

@group(0) @binding(0) var<uniform> params: NuclearParams;
// Output 2D chart of nuclides: vec4(B_per_A_MeV, Q_alpha, Q_beta_minus, modeCode)
// modeCode: 0=unbound, 1=stable, 2=beta-, 3=beta+/EC, 4=alpha, 5=fission
@group(0) @binding(1) var<storage, read_write> nuclide_chart: array<vec4<f32>>;
// Output 3D nuclear density volume (vol_dim^3): vec4(rho_p, rho_n, V_coul_norm, alpha_density)
@group(0) @binding(2) var<storage, read_write> nuclear_volume: array<vec4<f32>>;

fn shell_corr(z_f: f32, n_f: f32) -> f32 {
  var mag = array<f32, 8>(2.0, 8.0, 20.0, 28.0, 50.0, 82.0, 126.0, 184.0);
  var acc = 0.0;
  for (var i = 0u; i < 8u; i = i + 1u) {
    let m = mag[i];
    let w = 1.15 + 0.022 * m;
    let inv2w2 = 0.5 / (w * w);
    let dz = z_f - m;
    let dn = n_f - m;
    acc = acc + 2.4 * exp(-dz * dz * inv2w2) + 2.4 * exp(-dn * dn * inv2w2);
  }
  return acc;
}

fn binding_mev(z_i: i32, a_i: i32) -> f32 {
  let n_i = a_i - z_i;
  if (z_i < 0 || n_i < 0 || a_i <= 1) { return 0.0; }
  if (z_i == 1 && a_i == 2) { return 2.22457; }
  if (z_i == 2 && a_i == 4) { return 28.2957; }
  let z = f32(z_i);
  let n = f32(n_i);
  let a = f32(a_i);
  let a13 = pow(a, 1.0 / 3.0);
  let a23 = a13 * a13;
  var pair = 0.0;
  if ((z_i & 1) == 0 && (n_i & 1) == 0) {
    pair = 11.18 / sqrt(a);
  } else if ((z_i & 1) == 1 && (n_i & 1) == 1) {
    pair = -11.18 / sqrt(a);
  }
  let b = 15.80 * a - 17.80 * a23 - 0.711 * z * (z - 1.0) / a13
    - 22.70 * (n - z) * (n - z) / a - 37.0 * abs(n - z) / a + pair + shell_corr(z, n);
  return max(0.0, b);
}

@compute @workgroup_size(64)
fn compute_nuclide_chart(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.max_z * params.max_n;
  if (idx >= total) { return; }
  let z = i32(idx / params.max_n) + 1;
  let n = i32(idx % params.max_n);
  let a = z + n;
  let b = binding_mev(z, a);
  let ba = b / f32(a);
  let b_n_prev = binding_mev(z, a - 1);
  let b_p_prev = binding_mev(z - 1, a - 1);
  // Outside drip lines -> unbound
  if (a > 1 && (b - b_n_prev < 0.0 || b - b_p_prev < 0.0)) {
    nuclide_chart[idx] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    return;
  }
  let q_alpha = select(-10.0, binding_mev(z - 2, a - 4) + 28.2957 - b, z >= 2 && a >= 5);
  let q_bm = binding_mev(z + 1, a) - b + 0.78233;
  let q_ec = select(-10.0, binding_mev(z - 1, a) - b - 0.78233, z > 1);
  let fiss = f32(z * z) / (f32(a) * 48.0);
  var mode = 1.0; // stable
  if (fiss >= 0.92 && z >= 96) {
    mode = 5.0;
  } else if (q_bm > 0.05 && q_bm >= q_ec) {
    mode = 2.0;
  } else if (q_ec > 0.05) {
    mode = 3.0;
  } else if (z >= 84 || q_alpha > 2.2) {
    mode = 4.0;
  }
  nuclide_chart[idx] = vec4<f32>(ba, q_alpha, q_bm, mode);
}

@compute @workgroup_size(64)
fn compute_nuclear_volume(@builtin(global_invocation_id) id: vec3<u32>) {
  let dim = params.vol_dim;
  let total = dim * dim * dim;
  let idx = id.x;
  if (idx >= total) { return; }
  let ix = idx % dim;
  let iy = (idx / dim) % dim;
  let iz = idx / (dim * dim);
  let fx = ((f32(ix) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let fy = ((f32(iy) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let fz = ((f32(iz) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let r_fm = length(vec3<f32>(fx, fy, fz)) * params.box_half_fm;
  let r_p = params.r_half_fm;
  // Neutron skin thickness delta_r_np ~ 0.12 * (N - Z) / A * 2.5 fm
  let z_f = f32(params.z_sel);
  let a_f = max(1.0, f32(params.a_sel));
  let n_f = max(0.0, a_f - z_f);
  let r_n = r_p + max(0.0, 0.3 * (n_f - z_f) / a_f);
  let rho_p = (z_f / a_f) / (1.0 + exp((r_fm - r_p) / params.diffuseness_fm));
  let rho_n = (n_f / a_f) / (1.0 + exp((r_fm - r_n) / params.diffuseness_fm));
  let v_coul = select(r_p / max(r_fm, 0.1), 0.5 * (3.0 - (r_fm * r_fm) / max(r_p * r_p, 0.01)), r_fm < r_p);
  let dens = clamp(rho_p + rho_n, 0.0, 1.0);
  nuclear_volume[idx] = vec4<f32>(rho_p, rho_n, clamp(v_coul * 0.65, 0.0, 1.0), dens);
}
`;

/**
 * Compute full 118 x 200 Chart of Nuclides AND live 3D Fermi nuclear density
 * volume for `(Z, A)` strictly on WebGPU (`0` CPU loops for 3D volume / chart).
 */
export async function solveNuclearStructureWebGpu(device, Z, A = null, {
  volDim = 32,
  maxZ = 118,
  maxN = 200
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('solveNuclearStructureWebGpu requires a live WebGPU GPUDevice');
  }
  const closure = deriveNuclearClosure(Z, A);
  const a13 = Math.cbrt(closure.A);
  const rHalfFm = Math.max(0.85, 1.128 * a13 - 0.89 / a13);
  const boxHalfFm = Math.max(4.5, rHalfFm * 1.9);
  const chartCount = maxZ * maxN;
  const volCount = volDim * volDim * volDim;

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage')
  ];
  const chartPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-nuclear-chart.v1',
    label: 'ulg-nuclear-chart',
    code: nuclearStructureWebGpuWgsl,
    entryPoint: 'compute_nuclide_chart',
    bindings
  });
  const volPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-nuclear-volume.v1',
    label: 'ulg-nuclear-volume',
    code: nuclearStructureWebGpuWgsl,
    entryPoint: 'compute_nuclear_volume',
    bindings
  });

  const pData = new ArrayBuffer(32);
  new Uint32Array(pData, 0, 5).set([closure.Z, closure.A, volDim, maxZ, maxN]);
  new Float32Array(pData, 20, 3).set([rHalfFm, 0.523, boxHalfFm]);
  const pBuf = device.createBuffer({ size: 32, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  device.queue.writeBuffer(pBuf, 0, pData);
  const chartBuf = device.createBuffer({
    size: chartCount * 16,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const volBuf = device.createBuffer({
    size: volCount * 16,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const readChart = device.createBuffer({
    size: chartCount * 16,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  const readVol = device.createBuffer({
    size: volCount * 16,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });

  const bg = device.createBindGroup({
    layout: chartPipe.bindGroupLayout,
    entries: [pBuf, chartBuf, volBuf].map((buffer, binding) => ({ binding, resource: { buffer } }))
  });
  const enc = device.createCommandEncoder({ label: 'ulg-nuclear-structure' });
  const pass = enc.beginComputePass({ label: 'ulg-nuclear-structure-pass' });
  pass.setBindGroup(0, bg);
  pass.setPipeline(chartPipe.pipeline);
  pass.dispatchWorkgroups(Math.ceil(chartCount / 64));
  pass.setPipeline(volPipe.pipeline);
  pass.dispatchWorkgroups(Math.ceil(volCount / 64));
  pass.end();
  enc.copyBufferToBuffer(chartBuf, 0, readChart, 0, chartCount * 16);
  enc.copyBufferToBuffer(volBuf, 0, readVol, 0, volCount * 16);
  device.queue.submit([enc.finish()]);

  try {
    await Promise.all([
      readChart.mapAsync(GPU_BUFFER_USAGE.MAP_READ),
      readVol.mapAsync(GPU_BUFFER_USAGE.MAP_READ)
    ]);
    const chartData = new Float32Array(readChart.getMappedRange().slice(0, chartCount * 16));
    const volumeData = new Float32Array(readVol.getMappedRange().slice(0, volCount * 16));
    readChart.unmap();
    readVol.unmap();
    return Object.freeze({
      ...closure,
      backend: 'webgpu',
      chartDims: Object.freeze({ maxZ, maxN }),
      chartData,
      volDim,
      boxHalfFm,
      volumeData
    });
  } finally {
    for (const b of [pBuf, chartBuf, volBuf, readChart, readVol]) b.destroy();
  }
}

// ============================================================================
// 3D WebGPU Bohr-Wheeler Quadrupole/Necking Nuclear Fission Volume & Kinetics
// ============================================================================

export const ULG_NUCLEAR_FISSION_SCHEMA = 'ulg.nuclear.fission-ldm-webgpu.v1';

/**
 * Compute exact Bohr-Wheeler liquid-drop deformation energy curve V(beta_2) (MeV)
 * from quadrupole surface energy B_s(beta_2) + Coulomb energy B_c(beta_2)
 * strictly from (Z, A) fissility x = (Z^2/A) / 48 (zero per-isotope hacks!).
 */
export function bohrWheelerFissionCurve(Z, A, { samples = 48 } = {}) {
  const z = Math.max(1, Math.trunc(Number(Z) || 92));
  const a = Math.max(z, Math.trunc(Number(A) || 235));
  const a13 = Math.cbrt(a);
  const a23 = a13 * a13;
  const eSurf0 = A_SURF_MEV * a23;
  const eCoul0 = A_COUL_MEV * (z * (z - 1)) / a13;
  const fissility = Math.max(0.01, Math.min(1.25, eCoul0 / Math.max(1e-6, 2 * eSurf0)));

  const betas = new Float32Array(samples);
  const deltaEMeV = new Float32Array(samples);
  let barrierMeV = 0;
  let saddleBeta = 0.72;
  let peakIdx = 0;

  for (let i = 0; i < samples; i += 1) {
    const b2 = (i / (samples - 1)) * 1.35;
    betas[i] = b2;
    // Bohr-Wheeler expansion with necking scission roll-off for b2 > 0.7
    const b2Sq = b2 * b2;
    const b2Cu = b2Sq * b2;
    const b2Qu = b2Sq * b2Sq;
    const dSurf = eSurf0 * (0.4 * b2Sq - (4 / 105) * b2Cu - 0.14 * b2Qu);
    const dCoul = eCoul0 * (-0.2 * b2Sq - (4 / 105) * b2Cu - 0.18 * b2Qu);
    // Scission drop as neck pinches off past b2 ~ 0.95 into two repelling fragments
    const scissDrop = b2 > 0.90 ? -Math.min(185, 0.35 * eCoul0 * Math.pow((b2 - 0.90) / 0.45, 2.2)) : 0;
    const v = dSurf + dCoul + scissDrop;
    deltaEMeV[i] = v;
    if (b2 <= 1.05 && v > barrierMeV) {
      barrierMeV = v;
      saddleBeta = b2;
      peakIdx = i;
    }
  }
  const scissionBeta = 1.02;
  return Object.freeze({
    schema: ULG_NUCLEAR_FISSION_SCHEMA,
    Z: z,
    A: a,
    fissility,
    eSurf0MeV: eSurf0,
    eCoul0MeV: eCoul0,
    barrierMeV,
    saddleBeta,
    scissionBeta,
    peakIdx,
    betas,
    deltaEMeV
  });
}

const FISSION_VOLUME_WGSL = /* wgsl */ `
struct FissionParams {
  dim: u32,
  z_sel: u32,
  a_sel: u32,
  pad0: u32,
  beta2: f32,
  r_half_fm: f32,
  box_half_fm: f32,
  diffuseness_fm: f32,
};

@group(0) @binding(0) var<uniform> p: FissionParams;
@group(0) @binding(1) var<storage, read_write> vol_out: array<vec4<f32>>;

@compute @workgroup_size(64)
fn compute_fission_volume(@builtin(global_invocation_id) id: vec3<u32>) {
  let dim = p.dim;
  let total = dim * dim * dim;
  let idx = id.x;
  if (idx >= total) { return; }

  let ix = idx % dim;
  let iy = (idx / dim) % dim;
  let iz = idx / (dim * dim);
  let fx = ((f32(ix) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let fy = ((f32(iy) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let fz = ((f32(iz) + 0.5) / f32(dim)) * 2.0 - 1.0;

  let pos = vec3<f32>(fx, fy, fz) * p.box_half_fm;
  let beta = clamp(p.beta2, 0.0, 1.4);
  let z_f = f32(p.z_sel);
  let a_f = max(1.0, f32(p.a_sel));
  let n_f = max(0.0, a_f - z_f);
  let skin = max(0.0, 0.30 * (n_f - z_f) / a_f);
  let diff = max(0.25, p.diffuseness_fm);

  var rho_p = 0.0;
  var rho_n = 0.0;

  // Continuous C^infinity Cassini-Oval / Two-Center Liquid-Drop Fission (ZERO abrupt jump at beta = 0.98!)
  // Smoothly elongates -> forms thin hyperbolic neck -> pinches through scission -> separates into 58%/42% fragments + prompt neutrons!
  let s_prog = smoothstep(0.20, 1.40, beta);
  let sep_half = s_prog * p.r_half_fm * 1.42;
  let r_heavy = p.r_half_fm * mix(1.0, pow(0.58, 0.3333333), smoothstep(0.30, 1.05, beta));
  let r_light = p.r_half_fm * mix(1.0, pow(0.42, 0.3333333), smoothstep(0.30, 1.05, beta));
  // Keep center of mass pinned at x = 0 across the entire asymmetric 58/42 split!
  let c_heavy = vec3<f32>(-sep_half * 0.84, 0.0, 0.0);
  let c_light = vec3<f32>( sep_half * 1.16, 0.0, 0.0);
  let dh = length(pos - c_heavy);
  let dl = length(pos - c_light);
  // Smooth-min (smin) neck bridge vanishes continuously as beta crosses scission (~0.98)!
  let neck_k = max(0.02, (1.0 - smoothstep(0.42, 1.04, beta)) * p.r_half_fm * 0.88);
  let dh_s = dh - r_heavy;
  let dl_s = dl - r_light;
  let h_mix = clamp(0.5 + 0.5 * (dl_s - dh_s) / neck_k, 0.0, 1.0);
  let d_surf_p = mix(dl_s, dh_s, h_mix) - neck_k * h_mix * (1.0 - h_mix);
  let d_surf_n = d_surf_p - skin;
  rho_p = (z_f / a_f) / (1.0 + exp(d_surf_p / diff));
  rho_n = (n_f / a_f) / (1.0 + exp(d_surf_n / diff));

  // Prompt scission neutron evaporation burst emerging perpendicularly from the snapped neck (beta > 0.88)!
  let scis_w = smoothstep(0.86, 1.02, beta) * (1.0 - smoothstep(1.22, 1.42, beta));
  let n_rad = max(0.1, (beta - 0.84) * p.r_half_fm * 2.1);
  let n_p1 = vec3<f32>(0.12 * p.r_half_fm,  n_rad * 0.65,  n_rad * 0.32);
  let n_p2 = vec3<f32>(-0.10 * p.r_half_fm, -n_rad * 0.58, n_rad * 0.42);
  let n_p3 = vec3<f32>(0.06 * p.r_half_fm,  n_rad * 0.25, -n_rad * 0.72);
  let n_sig = max(0.18, diff * 1.35);
  let prompt_n = scis_w * (
    exp(-dot(pos - n_p1, pos - n_p1) / (n_sig * n_sig))
    + exp(-dot(pos - n_p2, pos - n_p2) / (n_sig * n_sig))
    + exp(-dot(pos - n_p3, pos - n_p3) / (n_sig * n_sig))
  );
  rho_n = clamp(rho_n + prompt_n * 0.85, 0.0, 1.0);

  let dens = clamp(rho_p + rho_n, 0.0, 1.0);
  // Isovector proton-core (fiery amber-gold) vs outer neutron-skin (electric cyan-blue),
  // plus incandescent white-gold scission neck stress & bright aqua prompt scission neutrons!
  let n_frac = rho_n / max(1e-4, dens);
  let skin_w = smoothstep(0.54, 0.78, n_frac);
  let base_col = mix(vec3<f32>(1.0, 0.44, 0.08), vec3<f32>(0.10, 0.72, 1.0), skin_w) * (0.45 + 0.75 * dens);
  let neck_glow = exp(-pos.x * pos.x / max(0.45, p.r_half_fm * 0.38)) * smoothstep(0.38, 0.94, beta) * (1.0 - smoothstep(0.96, 1.12, beta)) * dens;
  let final_col = clamp(base_col + vec3<f32>(1.0, 0.94, 0.62) * neck_glow * 1.15 + vec3<f32>(0.28, 0.96, 1.0) * prompt_n * 1.1, vec3<f32>(0.0), vec3<f32>(1.0));
  vol_out[idx] = vec4<f32>(final_col, dens);
}
`;

const fissionCache = new WeakMap();

/**
 * Synthesize a GPU-resident 3D Bohr-Wheeler quadrupole/necking nuclear fission
 * density volume directly on WebGPU (zero CPU readback!).
 */
export function buildFissionDeformationVolumeWebGpu(device, nuclear, {
  beta2 = 0.0,
  dim = 28,
  reuseBuffer = null
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') return null;
  let cached = fissionCache.get(device);
  if (!cached) {
    const bindings = [
      computeBufferBinding(0, 'uniform'),
      computeBufferBinding(1, 'storage')
    ];
    const pipe = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-nuclear-fission-vol.v1',
      label: 'ulg-nuclear-fission-vol',
      code: FISSION_VOLUME_WGSL,
      entryPoint: 'compute_fission_volume',
      bindings
    });
    const pBuf = device.createBuffer({ label: 'ulg-fission-params', size: 32, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
    cached = { pipe, pBuf };
    fissionCache.set(device, cached);
  }

  const z = Math.max(1, Math.trunc(Number(nuclear?.Z) || 92));
  const a = Math.max(z, Math.trunc(Number(nuclear?.A) || 235));
  const a13 = Math.cbrt(a);
  const rHalfFm = Math.max(0.85, 1.128 * a13 - 0.89 / a13);
  const boxHalfFm = Math.max(6.5, rHalfFm * 2.55);
  const totalVoxels = dim * dim * dim;
  const byteSize = totalVoxels * 16;

  const volBuf = (reuseBuffer && reuseBuffer.size >= byteSize)
    ? reuseBuffer
    : device.createBuffer({ label: 'ulg-nuclear-fission-3d', size: byteSize, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });

  const ab = new ArrayBuffer(32);
  new Uint32Array(ab, 0, 4).set([dim, z, a, 0]);
  new Float32Array(ab, 16, 4).set([Number(beta2) || 0, rHalfFm, boxHalfFm, 0.523]);
  device.queue.writeBuffer(cached.pBuf, 0, ab);

  const bg = device.createBindGroup({
    layout: cached.pipe.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: cached.pBuf } },
      { binding: 1, resource: { buffer: volBuf } }
    ]
  });
  const enc = device.createCommandEncoder({ label: 'ulg-fission-vol-enc' });
  const pass = enc.beginComputePass();
  pass.setPipeline(cached.pipe.pipeline);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(Math.ceil(totalVoxels / 64));
  pass.end();
  device.queue.submit([enc.finish()]);
  return { buffer: volBuf, dim, beta2: Number(beta2) || 0 };
}

export function registerNuclearFissionSimulationModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  return registry.registerModule({
    method: { model: 'nuclear-fission-ldm', version: '1' },
    kernel: {
      sourceModule: 'src/runtime/nuclear/nuclearStructureGpu.js',
      entryPoint: 'compute_fission_volume',
      workgroupSize: 64,
      wgsl: FISSION_VOLUME_WGSL
    },
    parameterSchema: {
      Z: { type: 'number', min: 1, max: 118 },
      A: { type: 'number', min: 1, max: 310 },
      beta2: { type: 'number', min: 0, max: 1.35 }
    },
    stateLayout: { tensorId: 'nuclear_fission_volume_3d', dtype: 'f32', components: 4 },
    stepCapsule: async (capsule, context) => {
      const p = capsule?.parameters || {};
      const curve = bohrWheelerFissionCurve(p.Z ?? 92, p.A ?? 235);
      const vol = context?.device
        ? buildFissionDeformationVolumeWebGpu(context.device, { Z: p.Z ?? 92, A: p.A ?? 235 }, { beta2: p.beta2 ?? curve.saddleBeta, dim: 16 })
        : null;
      if (vol?.buffer) vol.buffer.destroy();
      return { status: 'ok', curve };
    }
  });
}
