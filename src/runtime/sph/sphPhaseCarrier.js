// Conservative SPH phase carrier (demo plan P4).
//
// A kick-drift-kick (leapfrog) integrator over the symmetric SPH operators. Each particle's
// phase is read from its specific internal energy through the P3 lever-rule solver, so phase
// state emerges from the thermodynamics rather than being scripted. CPU reference, evidence-only:
// the produced simulation artifact carries sphValidation/phaseChangeValidation = false.

import { equilibriumFromSpecificEnergy } from '../material/phaseEquilibrium.js';
import { cloneSphState } from './sphState.js';
import { computeAccelerationsAndEnergyRates } from './sphOperators.js';
import { sphConservationReport, sphTotals } from './sphConservation.js';

/**
 * Summarize phase state: particle counts and mass per (material, phase), using each material's
 * closure properties to map specific internal energy to a phase.
 */
export function summarizePhases(state, materialProperties = {}) {
  const byMaterialPhase = {};
  for (const p of state.particles) {
    const properties = materialProperties[p.material];
    let phase = 'unknown';
    if (properties) {
      phase = equilibriumFromSpecificEnergy(properties, p.specificInternalEnergyJPerKg).stablePhase || 'unknown';
    }
    byMaterialPhase[p.material] = byMaterialPhase[p.material] || {};
    const bucket = byMaterialPhase[p.material][phase] || { count: 0, massKg: 0 };
    bucket.count += 1;
    bucket.massKg += p.massKg;
    byMaterialPhase[p.material][phase] = bucket;
  }
  return byMaterialPhase;
}

export function createSphPhaseCarrier(options = {}) {
  const {
    dimension = 3,
    gamma = 1.4,
    gravity = null,
    alpha = 0,
    beta = 0,
    dt = 1e-4
  } = options;
  const fieldOptions = { dimension, gamma, gravity, alpha, beta };

  function step(state) {
    const next = cloneSphState(state);
    const first = computeAccelerationsAndEnergyRates(next.particles, { ...fieldOptions, h: next.smoothingLengthM });
    // Half kick (velocity + internal energy).
    for (let i = 0; i < next.particles.length; i += 1) {
      const p = next.particles[i];
      for (let d = 0; d < dimension; d += 1) p.v[d] += 0.5 * dt * first.accelerations[i][d];
      p.specificInternalEnergyJPerKg += 0.5 * dt * first.energyRates[i];
    }
    // Drift positions.
    for (const p of next.particles) {
      for (let d = 0; d < dimension; d += 1) p.x[d] += dt * p.v[d];
    }
    // Second half kick at the drifted state.
    const second = computeAccelerationsAndEnergyRates(next.particles, { ...fieldOptions, h: next.smoothingLengthM });
    for (let i = 0; i < next.particles.length; i += 1) {
      const p = next.particles[i];
      for (let d = 0; d < dimension; d += 1) p.v[d] += 0.5 * dt * second.accelerations[i][d];
      p.specificInternalEnergyJPerKg += 0.5 * dt * second.energyRates[i];
    }
    next.step = (state.step ?? 0) + 1;
    next.time = (state.time ?? 0) + dt;
    return { state: next, fields: second };
  }

  function run(initialState, steps = 1) {
    const stepCount = Number(steps);
    if (!Number.isInteger(stepCount) || stepCount < 1) {
      throw new Error('SPH carrier steps must be a positive integer');
    }
    let state = cloneSphState(initialState);
    const totalsSeries = [sphTotals(state)];
    for (let i = 0; i < stepCount; i += 1) {
      state = step(state).state;
      totalsSeries.push(sphTotals(state));
    }
    return {
      backend: 'cpu-reference',
      integrator: 'leapfrog-kdk',
      dt,
      steps: stepCount,
      finalState: state,
      totalsSeries
    };
  }

  return { backend: 'cpu-reference', integrator: 'leapfrog-kdk', dt, step, run };
}

/**
 * Run the carrier and assemble an evidence-only SPH phase simulation result (totals series,
 * conservation report, phase summary). The ABI artifact wrapper lives in sphPhaseContracts.
 */
export function runSphPhaseCarrier(initialState, { materialProperties = {}, toleranceProfile = {}, steps = 1, ...carrierOptions } = {}) {
  const carrier = createSphPhaseCarrier(carrierOptions);
  const run = carrier.run(initialState, steps);
  return {
    ...run,
    conservationReport: sphConservationReport(initialState, run.finalState, toleranceProfile),
    phaseSummary: summarizePhases(run.finalState, materialProperties),
    initialTotals: run.totalsSeries[0],
    finalTotals: run.totalsSeries[run.totalsSeries.length - 1]
  };
}
