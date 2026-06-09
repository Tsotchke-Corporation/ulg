// SPH conservation diagnostics (demo plan P4).
//
// Total mass, momentum, and energy (kinetic + thermal) of an SPH state, and a residual report
// against a tolerance profile. These are the conserved quantities the symmetric SPH operators
// preserve; the report is the evidence that an integration step did not silently leak them.

import { createConservationReport } from '../../../ulg-gpu-abi/src/index.js';

export function totalMomentumKgMPerS(state) {
  const momentum = new Array(state.dimension).fill(0);
  for (const p of state.particles) {
    for (let d = 0; d < state.dimension; d += 1) momentum[d] += p.massKg * p.v[d];
  }
  return momentum;
}

export function totalKineticEnergyJ(state) {
  let energy = 0;
  for (const p of state.particles) {
    const speed2 = p.v.reduce((sum, v) => sum + v * v, 0);
    energy += 0.5 * p.massKg * speed2;
  }
  return energy;
}

export function totalThermalEnergyJ(state) {
  return state.particles.reduce((sum, p) => sum + p.massKg * p.specificInternalEnergyJPerKg, 0);
}

export function sphTotals(state) {
  const momentum = totalMomentumKgMPerS(state);
  const kinetic = totalKineticEnergyJ(state);
  const thermal = totalThermalEnergyJ(state);
  return {
    massKg: state.particles.reduce((sum, p) => sum + p.massKg, 0),
    momentumKgMPerS: momentum,
    momentumMagnitudeKgMPerS: Math.sqrt(momentum.reduce((s, m) => s + m * m, 0)),
    kineticEnergyJ: kinetic,
    thermalEnergyJ: thermal,
    totalEnergyJ: kinetic + thermal
  };
}

/**
 * Conservation report comparing a final state to an initial one, against a tolerance profile.
 */
export function sphConservationReport(initialState, finalState, toleranceProfile = {}) {
  const a = sphTotals(initialState);
  const b = sphTotals(finalState);
  const momentumResidual = Math.sqrt(
    a.momentumKgMPerS.reduce((sum, m, d) => sum + (b.momentumKgMPerS[d] - m) ** 2, 0)
  );
  return createConservationReport({
    energyResidualJ: b.totalEnergyJ - a.totalEnergyJ,
    massResidualKg: b.massKg - a.massKg,
    momentumResidualKgMPerS: momentumResidual,
    toleranceProfile,
    provenance: { notes: ['Conservative SPH carrier reference diagnostics; not validated physics.'] }
  });
}
