// Jellium cohesion: equilibrium density and bulk modulus of a simple (sp) metal derived from
// electronic structure — the cold-curve cohesive properties the Grüneisen EOS / MD pipeline needs
// as input, now derived rather than tabulated.
//
// Model (energy per valence electron, Ha): the uniform-electron-gas energy + the electrostatic
// (Madelung) energy of the ion lattice in the compensating gas + an Ashcroft empty-core
// pseudopotential correction (the one element-specific input — the ion is not a bare point
// charge). Minimizing over the Wigner–Seitz radius gives the equilibrium density; the curvature
// gives the bulk modulus.
//
// Honest scope: this is quantitative for nearly-free-electron sp-metals (Na, K, Al). Transition
// metals like iron (localized d-electrons) need full Kohn–Sham DFT with orbitals — the next
// frontier, not this model.

import {
  BOHR_TO_M,
  HARTREE_TO_J,
  numberDensityFromRs,
  uegEnergyPerElectronHa
} from './uniformElectronGas.js';

const HA_PER_BOHR3_TO_PA = HARTREE_TO_J / BOHR_TO_M ** 3; // ≈ 2.9421e13 Pa
const HARTREE_TO_EV = 27.211386245988;
// bcc jellium Madelung energy per electron: −0.895929 / r_s (Ha).
const BCC_MADELUNG = -0.895929;

/**
 * Energy per valence electron (Ha) of a simple metal at Wigner–Seitz radius r_s.
 * Empty-core correction (Z=1) = (3 r_c^2)/(2 r_s^3): the first-order energy from removing the
 * electron–ion attraction inside the core radius r_c.
 */
export function simpleMetalEnergyPerElectronHa(rs, { emptyCoreRadiusBohr = 0, madelungCoefficient = BCC_MADELUNG } = {}) {
  const uegPlusMadelung = uegEnergyPerElectronHa(rs) + madelungCoefficient / rs;
  const emptyCore = (1.5 * emptyCoreRadiusBohr * emptyCoreRadiusBohr) / (rs * rs * rs);
  return uegPlusMadelung + emptyCore;
}

/**
 * Equilibrium Wigner–Seitz radius (Bohr) that minimizes the energy per electron (golden-section).
 */
export function equilibriumRsBohr(params = {}, { lo = 1.0, hi = 8.0, iterations = 200 } = {}) {
  const phi = (Math.sqrt(5) - 1) / 2;
  let a = lo;
  let b = hi;
  let c = b - phi * (b - a);
  let d = a + phi * (b - a);
  const E = (rs) => simpleMetalEnergyPerElectronHa(rs, params);
  for (let i = 0; i < iterations; i += 1) {
    if (E(c) < E(d)) b = d; else a = c;
    c = b - phi * (b - a);
    d = a + phi * (b - a);
  }
  return 0.5 * (a + b);
}

/**
 * Bulk modulus (Pa) from the curvature of E(V) at the equilibrium: B = V d^2E/dV^2.
 */
export function bulkModulusPa(rsEq, params = {}) {
  const volumeOf = (rs) => (4 * Math.PI / 3) * rs ** 3; // Bohr^3 per electron
  const rsOf = (v) => (3 * v / (4 * Math.PI)) ** (1 / 3);
  const v0 = volumeOf(rsEq);
  const dv = v0 * 1e-3;
  const eP = simpleMetalEnergyPerElectronHa(rsOf(v0 + dv), params);
  const e0 = simpleMetalEnergyPerElectronHa(rsEq, params);
  const eM = simpleMetalEnergyPerElectronHa(rsOf(v0 - dv), params);
  const d2EdV2 = (eP - 2 * e0 + eM) / (dv * dv); // Ha/Bohr^6
  return v0 * d2EdV2 * HA_PER_BOHR3_TO_PA;
}

/**
 * Derive a simple metal's cold-curve cohesive properties from electronic structure: equilibrium
 * Wigner–Seitz radius, mass density, bulk modulus, and binding energy per electron.
 * `valenceElectronsPerAtom` (Z) and `atomicMassKg` set the density; `emptyCoreRadiusBohr` is the
 * pseudopotential core (the one element-specific input).
 */
export function simpleMetalColdCurve({ atomicMassKg, valenceElectronsPerAtom = 1, emptyCoreRadiusBohr = 0, madelungCoefficient = BCC_MADELUNG }) {
  const params = { emptyCoreRadiusBohr, madelungCoefficient };
  const rsEq = equilibriumRsBohr(params);
  // Volume per atom = Z electrons × volume per electron.
  const volumePerElectronM3 = (4 * Math.PI / 3) * (rsEq * BOHR_TO_M) ** 3;
  const volumePerAtomM3 = valenceElectronsPerAtom * volumePerElectronM3;
  return {
    equilibriumRsBohr: rsEq,
    equilibriumDensityKgPerM3: atomicMassKg / volumePerAtomM3,
    bulkModulusPa: bulkModulusPa(rsEq, params),
    bindingEnergyEvPerElectron: simpleMetalEnergyPerElectronHa(rsEq, params) * HARTREE_TO_EV,
    numberDensityPerBohr3: numberDensityFromRs(rsEq)
  };
}
