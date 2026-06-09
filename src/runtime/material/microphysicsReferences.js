// Build microphysics reference artifacts from the real MoonLab-computed data (demo plan P2/
// microphysics). Derives physically meaningful quantities from the raw ground-state energies:
// the H2 equilibrium bond length and bond energy, and a comparison to the published FCI value.

import { createMicrophysicsReferenceArtifact, hashPayload } from '../../../ulg-gpu-abi/src/index.js';
import {
  H2O_GROUND_STATE,
  H2_DISSOCIATION_CURVE,
  H2_FCI_EQUILIBRIUM_HA,
  HARTREE_TO_EV,
  HARTREE_TO_KJ_PER_MOL,
  MOONLAB_MICROPHYSICS_PRODUCER
} from './microphysicsData.js';

// Two free hydrogen atoms (exact, minimal reference for the dissociation limit): 2 x (-0.5 Ha).
const H2_DISSOCIATION_LIMIT_HA = -1.0;

/**
 * Derive the H2 equilibrium bond length and energy from the dissociation curve minimum, the bond
 * energy relative to two free H atoms, and the FCI comparison. The curve's grid minimum already
 * sits at the experimental bond length; a parabola fit over this wide, asymmetric grid would
 * overshoot, so the grid minimum is reported directly (finer sampling would refine it).
 */
export function deriveH2Equilibrium(curve = H2_DISSOCIATION_CURVE) {
  let minIndex = 0;
  for (let i = 1; i < curve.length; i += 1) {
    if (curve[i].totalEnergyHa < curve[minIndex].totalEnergyHa) minIndex = i;
  }
  const min = curve[minIndex];
  const equilibriumBondAngstrom = min.bondAngstrom;
  const equilibriumEnergyHa = min.totalEnergyHa;
  const bondEnergyHa = H2_DISSOCIATION_LIMIT_HA - equilibriumEnergyHa;
  return {
    equilibriumBondAngstrom,
    equilibriumEnergyHa,
    bondEnergyHa,
    bondEnergyEv: bondEnergyHa * HARTREE_TO_EV,
    bondEnergyKjPerMol: bondEnergyHa * HARTREE_TO_KJ_PER_MOL,
    fciEquilibriumHa: H2_FCI_EQUILIBRIUM_HA,
    fciDeltaHa: equilibriumEnergyHa - H2_FCI_EQUILIBRIUM_HA,
    fciDeltaMilliHa: (equilibriumEnergyHa - H2_FCI_EQUILIBRIUM_HA) * 1000
  };
}

/**
 * Produced H2 microphysics reference (quantitatively meaningful: equilibrium geometry + near-FCI
 * energy).
 */
export function createH2MicrophysicsReference() {
  const derived = deriveH2Equilibrium();
  // Quantitative if it reproduces the experimental bond length (~0.741 A) within 0.02 A and the
  // FCI energy within 10 mHa.
  const quantitative = Math.abs(derived.equilibriumBondAngstrom - 0.741) < 0.02
    && Math.abs(derived.fciDeltaHa) < 0.01;
  return createMicrophysicsReferenceArtifact({
    artifactId: 'moonlab:h2-microphysics.v0',
    species: 'h2',
    producer: MOONLAB_MICROPHYSICS_PRODUCER,
    data: { dissociationCurveHa: H2_DISSOCIATION_CURVE },
    derived,
    comparison: { reference: 'FCI', fciEquilibriumHa: H2_FCI_EQUILIBRIUM_HA, deltaMilliHa: derived.fciDeltaMilliHa },
    quantitative,
    provenance: { notes: ['H2 dissociation curve; equilibrium bond length matches experiment (~0.741 A).'] }
  });
}

/**
 * Produced H2O microphysics reference (exact ground state of MoonLab's 8-qubit model
 * Hamiltonian; NOT a quantitative water energy).
 */
export function createH2OMicrophysicsReference() {
  return createMicrophysicsReferenceArtifact({
    artifactId: 'moonlab:h2o-microphysics.v0',
    species: 'h2o',
    producer: MOONLAB_MICROPHYSICS_PRODUCER,
    data: { groundState: H2O_GROUND_STATE },
    derived: { totalEnergyHa: H2O_GROUND_STATE.totalEnergyHa, totalEnergyEv: H2O_GROUND_STATE.totalEnergyHa * HARTREE_TO_EV },
    comparison: { note: 'Minimal 8-qubit model Hamiltonian; full ab-initio H2O is ~-76.4 Ha.' },
    quantitative: false,
    provenance: { notes: ['Exact ground state of MoonLab model H2O Hamiltonian; model-quality only.'] }
  });
}

/**
 * Content-addressed input reference (for a closure's inputRefs) pointing at a produced
 * microphysics reference artifact.
 */
export function microphysicsInputRef(referenceArtifact) {
  return {
    schema: referenceArtifact.schema,
    species: referenceArtifact.species,
    status: referenceArtifact.status,
    quantitative: referenceArtifact.quantitative,
    artifactHash: hashPayload(referenceArtifact)
  };
}
