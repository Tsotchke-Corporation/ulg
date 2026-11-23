// Gate 5B (10^+8 -> 10^+17 m): Stellar Nucleosynthesis Bridge & G7 Advisory
// Lane-Emden Polytrope Verifier (`src/runtime/astrophysics/stellarNucleosynthesisBridge.js`).
//
// Connects Gate 1 Stage P1.1 `nuclearBindingEnergyMeV(Z, A)` directly to
// stellar fusion & core-collapse channels (`pp`, `triple-alpha`, `alpha-chain`
// C -> O -> Ne -> Mg -> Si -> Fe-56, and endothermic Fe-56 photodisintegration)
// with exact nucleon/charge conservation, plus an RK4 Lane-Emden polytrope
// benchmark solver (n = 1.5 convective, n = 3.0 Eddington radiative) for
// honest offline G7 advisory verification!

import { nuclearBindingEnergyMeV } from '../nuclear/nuclearStructureGpu.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_STELLAR_NUCLEAR_BRIDGE_SCHEMA = 'ulg.astrophysics.stellar-nuclear-network.v1';

const STELLAR_REACTION_TEMPLATES = Object.freeze([
  { id: 'pp-chain', label: '4 ¹H → ⁴He + 2e⁺ + 2ν_e', reactants: [[1, 1, 4]], products: [[2, 4, 1]], ignitionTempK: 1.0e7, chargeConservedWithLeptons: true },
  { id: 'triple-alpha', label: '3 ⁴He → ¹²C', reactants: [[2, 4, 3]], products: [[6, 12, 1]], ignitionTempK: 1.0e8 },
  { id: 'c12-alpha', label: '¹²C + ⁴He → ¹⁶O', reactants: [[6, 12, 1], [2, 4, 1]], products: [[8, 16, 1]], ignitionTempK: 1.5e8 },
  { id: 'o16-alpha', label: '¹⁶O + ⁴He → ²⁰Ne', reactants: [[8, 16, 1], [2, 4, 1]], products: [[10, 20, 1]], ignitionTempK: 5.0e8 },
  { id: 'ne20-alpha', label: '²⁰Ne + ⁴He → ²⁴Mg', reactants: [[10, 20, 1], [2, 4, 1]], products: [[12, 24, 1]], ignitionTempK: 1.2e9 },
  { id: 'mg24-alpha', label: '²⁴Mg + ⁴He → ²⁸Si', reactants: [[12, 24, 1], [2, 4, 1]], products: [[14, 28, 1]], ignitionTempK: 1.8e9 },
  { id: 'si28-to-fe56', label: '2 ²⁸Si → ⁵⁶Ni → ⁵⁶Fe', reactants: [[14, 28, 2]], products: [[26, 56, 1]], ignitionTempK: 3.0e9, chargeConservedWithLeptons: true },
  { id: 'fe56-photodisintegration', label: '⁵⁶Fe + γ → 13 ⁴He + 4n', reactants: [[26, 56, 1]], products: [[2, 4, 13], [0, 1, 4]], ignitionTempK: 5.5e9 }
]);

/**
 * Derive exact stellar nucleosynthesis Q-values directly from Gate 1
 * `nuclearBindingEnergyMeV(Z, A)`, verifying exact nucleon conservation.
 */
export function buildGate1StellarNuclearNetwork() {
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
    const qValueMeV = bOut - bIn;
    return Object.freeze({
      id: tpl.id,
      label: tpl.label,
      nucleonsConserved: aIn,
      ignitionTempK: tpl.ignitionTempK,
      qValueMeV,
      exothermic: qValueMeV > 0
    });
  });

  return Object.freeze({
    schema: ULG_STELLAR_NUCLEAR_BRIDGE_SCHEMA,
    channels: Object.freeze(channels),
    accuracyTier: ULG_ACCURACY_TIERS.TIER_1_QUANTITATIVE,
    provenance: Object.freeze({
      status: 'gate1-nuclear-derived',
      scientificValidation: false
    })
  });
}

/**
 * Solve the dimensionless Lane-Emden stellar hydrostatic equation via 4th-order RK4:
 *   (1 / xi^2) d/dxi (xi^2 dtheta/dxi) = -theta^n,   theta(0) = 1, theta'(0) = 0.
 * Exact G7 advisory invariants:
 *   - n = 1.5 (convective / non-rel white dwarf): xi_1 = 3.65375, -xi_1^2 theta'(xi_1) = 2.71406, rho_c/rho_bar = 5.9907
 *   - n = 3.0 (Eddington solar / rel white dwarf): xi_1 = 6.89685, -xi_1^2 theta'(xi_1) = 2.01824, rho_c/rho_bar = 54.1825
 */
export function solveLaneEmdenPolytrope(n = 3.0, { dXi = 0.002, maxXi = 25.0 } = {}) {
  const polyN = Number(n);
  // Start at tiny xi_0 = dXi using exact Taylor series: theta = 1 - xi^2/6 + n*xi^4/120
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
      // Linear root interpolation at surface theta(xi_1) = 0
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
