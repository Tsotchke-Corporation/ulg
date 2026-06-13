// P5 thermal + phase transport: this is what wires the material closures into the SPH dynamics
// so the demo actually behaves — heat flows from the hot iron into the ice, the six fixed-
// temperature walls heat/cool the boundary, and water crosses latent-heat plateaus (ice → liquid
// → steam) via the closures' energy↔phase map. Without this the demo only had closure-backed
// colour; with it, energy evolves and phases change.
//
// Energy-conserving pairwise SPH conduction (interior) + Dirichlet wall flux (exchanged with the
// reservoirs, tracked per face for the energy ledger). Phase comes from the same
// equilibriumFromSpecificEnergy the colour uses. Rates are accelerated for interactive
// visualization (labelled), but the structure — conduction, wall flux, latent-heat plateaus — is
// physical.

import {
  cachedParticleEquilibriumFromSpecificEnergy,
  stablePhaseFromSpecificEnergy
} from '../material/phaseEquilibrium.js';

const FACE_AXES = [
  { id: 'xMin', axis: 0, atMax: false },
  { id: 'xMax', axis: 0, atMax: true },
  { id: 'yMin', axis: 1, atMax: false },
  { id: 'yMax', axis: 1, atMax: true },
  { id: 'zMin', axis: 2, atMax: false },
  { id: 'zMax', axis: 2, atMax: true }
];

/** Per-particle temperature + phase from current specific internal energy via the closures. */
export function thermalState(state, materialProperties) {
  return state.particles.map((p) => {
    const eq = cachedParticleEquilibriumFromSpecificEnergy(
      materialProperties[p.material],
      p,
      p.specificInternalEnergyJPerKg
    );
    return { material: p.material, temperatureK: eq.temperatureK, phase: eq.stablePhase, phaseFractions: eq.phaseFractions };
  });
}

/**
 * Advance specific internal energy by one thermal step: energy-conserving pairwise conduction
 * between neighbours plus Dirichlet heat flux from any wall the particle sits against. Mutates
 * `state.particles[i].specificInternalEnergyJPerKg`. Returns the per-face heat exchanged (J,
 * positive = into the system from that wall) for the energy ledger.
 */
export function thermalStep(state, {
  materialProperties,
  wallTemperaturesK,
  boxEdgeM,
  boxDimsM, // [Lx, Ly, Lz]; falls back to a cube of boxEdgeM
  dtS,
  conductionRate = 1.5e4,
  wallRate = 6e4,
  wallLayerM = null
} = {}) {
  const particles = state.particles;
  const n = particles.length;
  const dims = boxDimsM ?? [boxEdgeM, boxEdgeM, boxEdgeM];
  const h = state.smoothingLengthM;
  const layer = wallLayerM ?? h;
  // Current temperatures + phases (energy → state via the closures), computed once and returned
  // so callers don't have to invert the energy again this step.
  const thermal = thermalState(state, materialProperties);
  const temps = thermal.map((t) => t.temperatureK);
  const dU = new Float64Array(n); // J/kg increments
  const wallHeatJ = {};
  for (const f of FACE_AXES) wallHeatJ[f.id] = 0;

  // Interior conduction: energy-conserving pairwise exchange dE = C (T_j - T_i) w(r) dt.
  for (let i = 0; i < n; i += 1) {
    const pi = particles[i];
    for (let j = i + 1; j < n; j += 1) {
      const pj = particles[j];
      const dx = pi.x[0] - pj.x[0];
      const dy = pi.x[1] - pj.x[1];
      const dz = pi.x[2] - pj.x[2];
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (r >= 2 * h) continue;
      const w = 1 - r / (2 * h); // simple compact weight in [0,1]
      const dE = conductionRate * (temps[j] - temps[i]) * w * dtS; // J, from j into i
      dU[i] += dE / pi.massKg;
      dU[j] -= dE / pj.massKg;
    }
  }

  // Wall flux: a particle within `layer` of a face exchanges with that face's reservoir.
  for (let i = 0; i < n; i += 1) {
    const pi = particles[i];
    for (const f of FACE_AXES) {
      const coord = pi.x[f.axis];
      const distance = f.atMax ? dims[f.axis] - coord : coord;
      if (distance >= layer) continue;
      const tWall = wallTemperaturesK[f.id];
      const dE = wallRate * (tWall - temps[i]) * (1 - distance / layer) * dtS; // J into particle
      dU[i] += dE / pi.massKg;
      wallHeatJ[f.id] += dE;
    }
  }

  for (let i = 0; i < n; i += 1) particles[i].specificInternalEnergyJPerKg += dU[i];
  // `thermal` reflects the pre-step energy; the phases used for buoyancy this step are taken from
  // it (one step's lag is harmless for the visualization).
  return { wallHeatJ, thermal };
}

/**
 * Phase-driven buoyancy acceleration (m/s^2) for a particle, from the density contrast between
 * its current phase and the surrounding fluid: a = (ρ_ref/ρ_phase − 1) (−g). Gas-phase water
 * (steam) is far less dense than the liquid/solid around it, so it rises — that is the visible
 * steam behaviour. Solid/dense phases get ~0 extra buoyancy.
 */
export function buoyancyAccelerationMPerS2(phaseDensityKgPerM3, referenceDensityKgPerM3, gravityMPerS2 = 9.80665) {
  if (!(phaseDensityKgPerM3 > 0)) return 0;
  return (referenceDensityKgPerM3 / phaseDensityKgPerM3 - 1) * gravityMPerS2;
}

/**
 * Mass by (material, phase) including a `steam` bucket for vaporized water — what the status rows
 * and renderer need to show steam appearing.
 */
export function phaseMassWithSteam(state, materialProperties) {
  const byMaterialPhase = {};
  let waterSteamMassKg = 0;
  let waterLiquidMassKg = 0;
  let waterIceMassKg = 0;
  for (const p of state.particles) {
    const phase = stablePhaseFromSpecificEnergy(materialProperties[p.material], p.specificInternalEnergyJPerKg);
    byMaterialPhase[p.material] = byMaterialPhase[p.material] || {};
    byMaterialPhase[p.material][phase] = (byMaterialPhase[p.material][phase] || 0) + p.massKg;
    if (p.material === 'h2o') {
      if (phase === 'gas') waterSteamMassKg += p.massKg;
      else if (phase === 'liquid') waterLiquidMassKg += p.massKg;
      else waterIceMassKg += p.massKg;
    }
  }
  return { byMaterialPhase, waterIceMassKg, waterLiquidMassKg, waterSteamMassKg };
}
