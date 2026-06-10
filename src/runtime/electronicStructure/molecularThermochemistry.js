// Molecular ideal-gas statistical thermodynamics: turn the electronic-structure outputs (optimized
// geometry + harmonic vibrational frequencies) into thermodynamic functions — heat capacity Cp(T),
// zero-point energy. This is the bridge from molecular bonding to the bulk thermal closures: the
// heat capacity of a molecular gas (air's N2/O2/CO2, water vapour) follows from its rotations and
// vibrations, derived rather than assumed (equipartition).
//
// Rigid-rotor / harmonic-oscillator / ideal-gas model. Translational + rotational DOF are in the
// classical (high-T) limit valid for these gases near room temperature; each vibration contributes
// through its Einstein heat-capacity function. Atomic geometry in Bohr, frequencies in cm^-1.

import { jacobiEigh } from './molecularHartreeFock.js';
import { ATOMIC_MASS_U } from './periodicTable.js';

const R_GAS = 8.314462618; // J/(mol K)
const CM1_TO_K = 1.4387768766; // hc/k_B (cm K): theta_vib = CM1_TO_K * nu[cm^-1]
const CM1_TO_HARTREE = 1 / 219474.6313705;

/** Principal moments of inertia (sorted ascending, amu·Bohr^2) of a molecule. */
export function principalMomentsOfInertia(atoms) {
  const m = atoms.map((a) => ATOMIC_MASS_U[a.Z - 1]);
  const M = m.reduce((s, mi) => s + mi, 0);
  const com = [0, 0, 0];
  atoms.forEach((a, i) => { for (let d = 0; d < 3; d += 1) com[d] += m[i] * a.position[d]; });
  for (let d = 0; d < 3; d += 1) com[d] /= M;
  const I = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  atoms.forEach((a, i) => {
    const r = a.position.map((x, d) => x - com[d]);
    const r2 = r[0] * r[0] + r[1] * r[1] + r[2] * r[2];
    for (let p = 0; p < 3; p += 1) for (let q = 0; q < 3; q += 1) I[p][q] += m[i] * ((p === q ? r2 : 0) - r[p] * r[q]);
  });
  return jacobiEigh(I, 3).values.slice().sort((a, b) => a - b);
}

/** Whether the molecule is linear (one principal moment ≈ 0). */
export function isLinearMolecule(atoms) {
  if (atoms.length <= 2) return true;
  const moments = principalMomentsOfInertia(atoms);
  const maxI = moments[2];
  return moments[0] < 1e-3 * maxI; // smallest moment vanishes for a linear arrangement
}

/** Einstein vibrational heat-capacity contribution (units of R) for one mode at temperature T. */
function vibrationalCvOverR(nuCm1, T) {
  if (nuCm1 <= 0) return 0;
  const u = (CM1_TO_K * nuCm1) / T;
  if (u > 60) return 0; // mode frozen out
  const ex = Math.exp(u);
  return (u * u * ex) / ((ex - 1) * (ex - 1));
}

/**
 * Ideal-gas molar heat capacity (J/mol/K) at temperature T from the molecule's geometry (sets the
 * rotational degrees of freedom) and its harmonic vibrational frequencies (cm^-1). Cv = translation
 * (3/2 R) + rotation (R linear, 3/2 R nonlinear) + Σ vibrational Einstein terms; Cp = Cv + R.
 */
export function idealGasHeatCapacity(atoms, vibrationsCm1, temperatureK) {
  const linear = isLinearMolecule(atoms);
  const rotCvOverR = linear ? 1 : 1.5;
  let vibCvOverR = 0;
  for (const nu of vibrationsCm1) vibCvOverR += vibrationalCvOverR(nu, temperatureK);
  const cvOverR = 1.5 + rotCvOverR + vibCvOverR;
  return {
    cvJPerMolK: cvOverR * R_GAS,
    cpJPerMolK: (cvOverR + 1) * R_GAS,
    linear,
    rotationalDof: linear ? 2 : 3,
    vibrationalCvOverR: vibCvOverR
  };
}

/** Zero-point vibrational energy (Hartree): ½ Σ hν over the harmonic modes. */
export function zeroPointEnergyHa(vibrationsCm1) {
  return vibrationsCm1.reduce((s, nu) => s + 0.5 * nu * CM1_TO_HARTREE, 0);
}
