// Real MoonLab-computed microphysics data (committed, deterministic).
//
// Produced by tools/moonlab-microphysics/h2_h2o_microphysics.c: exact diagonalization (shifted
// power iteration) of the molecular qubit Hamiltonians MoonLab constructs via Jordan-Wigner.
// MoonLab builds the Hamiltonian (the physics); this is its exact ground state. Energies in
// Hartree (Ha), bond lengths in Angstrom (A).

export const MOONLAB_MICROPHYSICS_PRODUCER = Object.freeze({
  service: 'moonlab',
  library: 'libquantumsim.so',
  method: 'exact-diagonalization-of-jordan-wigner-molecular-hamiltonian',
  solver: 'shifted-power-iteration',
  driver: 'tools/moonlab-microphysics/h2_h2o_microphysics.c'
});

// H2 dissociation curve E(bond length). Minimum near the experimental bond length 0.7414 A.
export const H2_DISSOCIATION_CURVE = Object.freeze([
  { bondAngstrom: 0.4, totalEnergyHa: -0.240069635 },
  { bondAngstrom: 0.5, totalEnergyHa: -0.566231085 },
  { bondAngstrom: 0.6, totalEnergyHa: -0.824082483 },
  { bondAngstrom: 0.7, totalEnergyHa: -1.051742907 },
  { bondAngstrom: 0.7414, totalEnergyHa: -1.142170640 },
  { bondAngstrom: 0.8, totalEnergyHa: -1.127417488 },
  { bondAngstrom: 0.9, totalEnergyHa: -1.101722002 },
  { bondAngstrom: 1.0, totalEnergyHa: -1.077807444 },
  { bondAngstrom: 1.1, totalEnergyHa: -1.057012205 },
  { bondAngstrom: 1.4, totalEnergyHa: -1.015582709 },
  { bondAngstrom: 1.8, totalEnergyHa: -0.999030910 },
  { bondAngstrom: 2.2, totalEnergyHa: -1.006900662 },
  { bondAngstrom: 2.5, totalEnergyHa: -1.019782801 }
]);

// Published FCI reference for H2 at equilibrium (used as the accuracy tolerance for the curve).
export const H2_FCI_EQUILIBRIUM_HA = -1.137283834488;

// H2O ground state of MoonLab's 8-qubit model Hamiltonian (NOT a quantitative water energy).
export const H2O_GROUND_STATE = Object.freeze({
  numQubits: 8,
  nuclearRepulsionHa: 9.189534430,
  electronicHa: -77.084392034,
  totalEnergyHa: -67.894857604,
  quantitative: false
});

export const HARTREE_TO_EV = 27.211386245988;
export const HARTREE_TO_KJ_PER_MOL = 2625.4996394799;
