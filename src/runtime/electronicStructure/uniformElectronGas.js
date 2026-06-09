// Uniform electron gas — the cornerstone of density-functional theory (LDA).
//
// Every LDA-DFT energy is built from the energy per electron of the homogeneous electron gas as a
// function of density, written via the Wigner–Seitz radius r_s (in Bohr). These are the exact /
// QMC-calibrated pieces, parameter-free:
//   kinetic (Thomas–Fermi):  t(r_s) = 1.10495 / r_s^2          [Ha/electron]
//   exchange (Dirac):        ε_x(r_s) = −0.458165 / r_s         [Ha/electron]
//   correlation (Chachiyo):  ε_c(r_s) = a ln(1 + b/r_s + b/r_s^2)  (fits Ceperley–Alder QMC)
// All energies in Hartree, lengths in Bohr (atomic units), unless converted.

export const HARTREE_TO_J = 4.3597447222071e-18;
export const BOHR_TO_M = 5.29177210903e-11;

// k_F r_s = (9π/4)^(1/3); used in the exact UEG kinetic and exchange terms.
const KF_RS = (9 * Math.PI / 4) ** (1 / 3); // ≈ 1.91916

// Chachiyo (2016) correlation: simple, parameter-free, matches QMC across all r_s.
const CHACHIYO_A = (Math.log(2) - 1) / (2 * Math.PI * Math.PI); // ≈ -0.0155383
const CHACHIYO_B = 20.4562557;

/**
 * Wigner–Seitz radius r_s (Bohr) from electron number density n (electrons / Bohr^3):
 * (4/3)π r_s^3 = 1/n.
 */
export function wignerSeitzRadius(numberDensityPerBohr3) {
  return (3 / (4 * Math.PI * numberDensityPerBohr3)) ** (1 / 3);
}

export function numberDensityFromRs(rs) {
  return 3 / (4 * Math.PI * rs ** 3);
}

/** Thomas–Fermi non-interacting kinetic energy per electron (Ha): (3/10) k_F^2. */
export function kineticPerElectronHa(rs) {
  const kF = KF_RS / rs;
  return 0.3 * kF * kF;
}

/** Dirac exchange energy per electron (Ha): −(3/4π) k_F. */
export function exchangePerElectronHa(rs) {
  return -(3 / (4 * Math.PI)) * (KF_RS / rs);
}

/** Chachiyo correlation energy per electron (Ha). */
export function correlationPerElectronHa(rs) {
  return CHACHIYO_A * Math.log(1 + CHACHIYO_B / rs + CHACHIYO_B / (rs * rs));
}

/**
 * Total uniform-electron-gas energy per electron (Ha) = kinetic + exchange + correlation. This is
 * the LDA energy density that every density-functional calculation integrates.
 */
export function uegEnergyPerElectronHa(rs) {
  return kineticPerElectronHa(rs) + exchangePerElectronHa(rs) + correlationPerElectronHa(rs);
}

/**
 * Pressure of the electron gas (Ha/Bohr^3) from P = -dE/dV at fixed N, with V = (4/3)π r_s^3 per
 * electron, so P = -(1/(4π r_s^2)) dε/dr_s.
 */
export function uegPressureHaPerBohr3(rs, h = 1e-5) {
  const dEdRs = (uegEnergyPerElectronHa(rs + h) - uegEnergyPerElectronHa(rs - h)) / (2 * h);
  return -dEdRs / (4 * Math.PI * rs * rs);
}
