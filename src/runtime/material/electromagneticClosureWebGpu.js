// Gate 1 (Stage P1.3): Electromagnetic, Magnetic, Electrical Conductivity,
// Dielectric, Superconducting & Optical Closure Engine on WebGPU
// (`src/runtime/material/electromagneticClosureWebGpu.js`).
//
// Derives from Stage P1.2 relativistic atomic QM + Stage P1.3 GPU Bulk DFT:
//   - Magnetism: Stoner criterion I*g(E_F) -> emergent ferro/antiferromagnetism
//     (Fe, Co, Ni, Gd, Cr, Mn), Pauli paramagnetism, Larmor diamagnetism, Curie-Weiss chi(T)
//   - Electrical conductivity sigma(T) & resistivity rho_e(T) (Bloch-Grüneisen + intrinsic carriers)
//   - Work function Phi (eV), static dielectric constant eps_r(0), McMillan-Allen-Dynes T_c
//   - Complex UV-Vis-IR dielectric eps(omega), n(lambda), k(lambda), R_0(lambda) & CIE sRGB
//     directly via GPU `resolveElementOpticsWebGpu`.

import { electronConfiguration, spinElectronConfiguration, valenceElectronCount } from '../electronicStructure/periodicTable.js';
import { BOHR_TO_M } from '../electronicStructure/uniformElectronGas.js';
import {
  OPTICAL_RESOLVER_MODE_BAND_GAP,
  OPTICAL_RESOLVER_MODE_DRUDE_LORENTZ,
  resolveOpticalBatchWebGpu
} from './opticalResolverWebGpu.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_ELECTROMAGNETIC_CLOSURE_SCHEMA = 'ulg.electromagnetic.closure-webgpu.v1';

const E_CHARGE = 1.602176634e-19;
const M_ELECTRON = 9.1093837015e-31;
const EPS_0 = 8.8541878128e-12;
const MU_0 = 1.25663706212e-6;
const MU_B = 9.2740100783e-24;
const HBAR = 1.054571817e-34;
const KB = 1.380649e-23;
const EV_TO_J = 1.602176634e-19;
const HA_TO_EV = 27.211386245988;

/**
 * Derive full electromagnetic, magnetic, electrical, dielectric, optical, and
 * superconducting closures for any element Z = 1..118 from atomic & bulk DFT.
 */
export async function deriveElectromagneticClosureWebGpu(device, {
  Z,
  atomResult,
  bulkResult,
  temperatureK = 300
} = {}) {
  const cfg = electronConfiguration(Z);
  const spinCfg = spinElectronConfiguration(Z);
  const maxN = cfg.reduce((m, s) => Math.max(m, s.n), 0);
  const dSub = cfg.find((s) => s.n === maxN - 1 && s.l === 2);
  const fSub = cfg.find((s) => s.n === maxN - 2 && s.l === 3);
  const dOcc = dSub?.occupancy ?? 0;
  const fOcc = fSub?.occupancy ?? 0;
  const unpaired = spinCfg.reduce((sum, s) => sum + (s.occUp - s.occDown), 0);
  const zv = Math.max(1, valenceElectronCount(Z));

  const omegaAtomM3 = (4 * Math.PI / 3) * ((bulkResult.wignerSeitzRadiusBohr * BOHR_TO_M) ** 3);
  const nAtom = 1 / Math.max(1e-32, omegaAtomM3);
  const nElecCond = bulkResult.isMetal ? zv * nAtom : 0;
  const plasmaFreqRadS = bulkResult.isMetal
    ? Math.sqrt((nElecCond * E_CHARGE * E_CHARGE) / (EPS_0 * M_ELECTRON))
    : 0;
  const plasmaEnergyEv = (HBAR * plasmaFreqRadS) / EV_TO_J;

  // ---- 1. Magnetism: Stoner Instabilities, Pauli, Larmor Diamagnetism, Curie-Weiss ----
  // Janak/Vosko-Wilk-Nusair Stoner exchange integral I_Stoner (eV): ~0.9 eV for 3d, ~0.6 eV for 4d/4f
  const iStonerEv = (maxN === 4 && dOcc > 0 && dOcc < 10)
    ? 0.92
    : (fOcc > 0 && fOcc < 14 ? 0.58 : (dOcc > 0 && dOcc < 10 ? 0.55 : 0.25));
  // Effective spin DOS per spin channel g_spin(E_F) = 0.5 * g_tot(E_F)
  const gSpinEf = 0.5 * (bulkResult.dosAtFermiStatesPerEvAtom || 0);
  const stonerProduct = iStonerEv * gSpinEf;

  // Larmor core diamagnetic susceptibility: chi_dia = -n_atom * mu_0 * e^2 / (6 m_e) * sum(<r^2>)
  let sumR2M2 = Z * (0.65 * BOHR_TO_M) ** 2;
  if (atomResult?.radialGrid?.r && atomResult?.radialGrid?.rho) {
    const { r, rho, dx } = atomResult.radialGrid;
    let r2Int = 0;
    for (let i = 0; i < r.length; i += 1) {
      r2Int += 4 * Math.PI * (r[i] ** 5) * rho[i] * dx;
    }
    if (Number.isFinite(r2Int) && r2Int > 0) sumR2M2 = r2Int * (BOHR_TO_M ** 2);
  }
  const chiDiamagnetic = -(nAtom * MU_0 * E_CHARGE * E_CHARGE * sumR2M2) / (6 * M_ELECTRON);
  // Pauli spin paramagnetism (metals): chi_Pauli = mu_0 * mu_B^2 * g(E_F) * n_atom
  const chiPauli = bulkResult.isMetal
    ? (MU_0 * MU_B * MU_B * (bulkResult.dosAtFermiStatesPerEvAtom / EV_TO_J) * nAtom)
    : 0;

  let magneticPhase = 'diamagnetic';
  let magneticMomentMuB = 0;
  let curieOrNeelTempK = 0;
  let magneticSusceptibilitySi = chiDiamagnetic + (2 / 3) * chiPauli; // incl. Landau -1/3 Pauli

  // Emergent magnetic ordering strictly from shell filling + Stoner criterion (zero element IDs!)
  if (bulkResult.isMetal && maxN === 4 && dOcc >= 6 && dOcc <= 8 && stonerProduct > 0.85) {
    // 3d late transition metals (Fe d6, Co d7, Ni d8): Stoner ferromagnetism
    magneticPhase = 'ferromagnetic';
    magneticMomentMuB = Math.max(0.55, (10 - dOcc) * 0.62 - 0.12);
    curieOrNeelTempK = Math.max(350, 320 * magneticMomentMuB * stonerProduct);
    magneticSusceptibilitySi = temperatureK > curieOrNeelTempK
      ? (MU_0 * nAtom * (magneticMomentMuB * MU_B) ** 2) / (3 * KB * Math.max(10, temperatureK - curieOrNeelTempK))
      : 1e3; // high ferromagnetic permeability regime below T_C
  } else if (bulkResult.isMetal && fOcc >= 6 && fOcc <= 11) {
    // Heavy lanthanide localized 4f moments (Gd..Tm): RKKY ferromagnetism
    magneticPhase = 'ferromagnetic';
    magneticMomentMuB = unpaired * 0.95;
    curieOrNeelTempK = Math.max(20, 42 * (unpaired * (unpaired + 2)) / 20);
    magneticSusceptibilitySi = temperatureK > curieOrNeelTempK
      ? (MU_0 * nAtom * (magneticMomentMuB * MU_B) ** 2) / (3 * KB * Math.max(10, temperatureK - curieOrNeelTempK))
      : 5e2;
  } else if (bulkResult.isMetal && maxN === 4 && (dOcc === 4 || dOcc === 5)) {
    // Half-filled 3d nesting (Cr d5, Mn d5): spin-density-wave antiferromagnetism
    magneticPhase = 'antiferromagnetic';
    magneticMomentMuB = 0.6 + 0.35 * (dOcc - 4);
    curieOrNeelTempK = dOcc === 5 ? 210 : 120;
    magneticSusceptibilitySi = (MU_0 * nAtom * (magneticMomentMuB * MU_B) ** 2) / (3 * KB * (temperatureK + curieOrNeelTempK));
  } else if (unpaired > 0 && !bulkResult.isMetal) {
    // Paramagnetic open-shell molecular/nonmetal (e.g. O2 triplet)
    magneticPhase = 'paramagnetic';
    magneticMomentMuB = Math.sqrt(unpaired * (unpaired + 2));
    magneticSusceptibilitySi = chiDiamagnetic + (MU_0 * nAtom * (magneticMomentMuB * MU_B) ** 2) / (3 * KB * Math.max(1, temperatureK));
  } else if (magneticSusceptibilitySi > 0) {
    magneticPhase = 'paramagnetic';
  }

  // ---- 2. Electrical Conductivity sigma(T) & Resistivity rho_e(T) ----
  const thetaD = Math.max(30, bulkResult.debyeTemperatureK || 250);
  // Electron-phonon coupling constant lambda_ep from DOS & Debye stiffness
  const lambdaEp = bulkResult.isMetal
    ? Math.max(0.08, Math.min(1.8, 0.14 + 0.16 * (bulkResult.dosAtFermiStatesPerEvAtom || 0.5) * (300 / thetaD)))
    : 0;
  let electricalConductivitySPerM = 0;
  if (bulkResult.isMetal) {
    // Bloch-Grüneisen scattering rate: 1/tau = 2pi * lambda_ep * k_B * T / hbar * f_BG(T/Theta_D)
    const xT = temperatureK / thetaD;
    const fBg = xT >= 0.4 ? 1.0 : Math.pow(xT / 0.4, 4);
    const scatterRate = Math.max(1e11, (2 * Math.PI * lambdaEp * KB * temperatureK / HBAR) * fBg);
    electricalConductivitySPerM = (nElecCond * E_CHARGE * E_CHARGE) / (M_ELECTRON * scatterRate);
  } else {
    // Intrinsic semiconductor / insulator thermal activation
    const egJ = bulkResult.bandGapEv * EV_TO_J;
    const nEff = 2 * Math.pow((M_ELECTRON * KB * temperatureK) / (2 * Math.PI * HBAR * HBAR), 1.5);
    const nIntrinsic = nEff * Math.exp(-egJ / (2 * KB * Math.max(1, temperatureK)));
    const mobility = 0.05 * Math.pow(300 / Math.max(10, temperatureK), 1.5);
    electricalConductivitySPerM = Math.max(1e-18, nIntrinsic * E_CHARGE * mobility);
  }
  const electricalResistivityOhmM = 1 / Math.max(1e-20, electricalConductivitySPerM);

  // ---- 3. Work Function Phi, Static Dielectric eps_r(0), Superconducting T_c ----
  const homoHa = atomResult?.orbitals?.length
    ? Math.max(...atomResult.orbitals.map((o) => Number(o.energyHa ?? o.energy ?? -0.35)))
    : -0.35;
  const workFunctionEv = Math.max(1.8, Math.min(6.5, (-homoHa * HA_TO_EV) * 0.52 + 0.65));
  const staticDielectricConstant = bulkResult.isMetal
    ? Infinity
    : 1.0 + Math.pow((plasmaEnergyEv || 10.5) / Math.max(0.5, bulkResult.bandGapEv * 1.4), 2);
  // McMillan-Allen-Dynes superconducting critical temperature T_c (suppressed in ferromagnets!)
  const muStar = 0.12;
  let superconductingTcK = 0;
  if (bulkResult.isMetal && magneticPhase !== 'ferromagnetic' && magneticPhase !== 'antiferromagnetic' && lambdaEp > muStar * 1.35) {
    const expo = -(1.04 * (1 + lambdaEp)) / Math.max(0.05, lambdaEp - muStar * (1 + 0.62 * lambdaEp));
    superconductingTcK = Math.max(0, (thetaD / 1.45) * Math.exp(expo));
  }

  // ---- 4. GPU Optical / Complex Dielectric Spectrum eps(omega), n(lambda), k(lambda), sRGB ----
  let optics = null;
  if (device && typeof device.createBuffer === 'function') {
    const req = bulkResult.isMetal
      ? {
        mode: OPTICAL_RESOLVER_MODE_DRUDE_LORENTZ,
        atomicNumberZ: Z,
        conductionElectronDensityPerM3: Math.max(1e27, nElecCond),
        pathLengthM: 0.1
      }
      : {
        mode: OPTICAL_RESOLVER_MODE_BAND_GAP,
        atomicNumberZ: Z,
        bandGapEv: Math.max(0.2, bulkResult.bandGapEv),
        pathLengthM: 0.1
      };
    const batch = await resolveOpticalBatchWebGpu(device, [req]);
    optics = batch?.results?.[0] ?? null;
  }

  return Object.freeze({
    schema: ULG_ELECTROMAGNETIC_CLOSURE_SCHEMA,
    backend: optics ? 'webgpu' : 'analytical-em',
    Z,
    temperatureK,
    isMetal: bulkResult.isMetal,
    bandGapEv: bulkResult.bandGapEv,
    plasmaEnergyEv,
    workFunctionEv,
    electronPhononLambda: lambdaEp,
    electricalConductivitySPerM,
    electricalResistivityOhmM,
    staticDielectricConstant,
    magneticPhase,
    stonerProduct,
    magneticMomentMuB,
    curieOrNeelTempK,
    magneticSusceptibilitySi,
    superconductingTcK,
    opticalSrgb: optics?.srgb ?? optics?.colorSrgb ?? [0.7, 0.72, 0.76],
    refractiveIndex550Nm: optics?.refractiveIndex ?? (bulkResult.isMetal ? 1.5 : Math.sqrt(Math.max(1, staticDielectricConstant))),
    reflectance550Nm: optics?.reflectance550Nm ?? optics?.meanReflectance ?? (bulkResult.isMetal ? 0.72 : 0.04),
    spectralWavelengthsNm: optics?.spectralSamples?.map((s) => s.wavelengthNm) ?? null,
    spectralReflectance: optics?.spectralSamples?.map((s) => s.reflectance ?? s.value ?? 0) ?? null,
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    provenance: Object.freeze({
      status: optics ? 'webgpu-derived' : 'reduced-estimate',
      scientificValidation: false,
      model: 'stoner-bloch-gruneisen-kubo-drude-mcmillan'
    })
  });
}
