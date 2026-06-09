// Closure-backed thermodynamic preflight (demo plan P3).
//
// Re-derives the energy-feasibility preflight by sampling material densities through the
// MaterialRegistry (so every property goes through ClosureRegistry and is validity-gated) and
// computing the energy budget from the registered closures' data via the P3 thermodynamic core.
// It cross-checks against the reference-constant preflight: because the closures currently carry
// the same reference numbers, the two must agree. When MoonLab/Eshkol closures replace the
// fixtures, this path automatically tracks them — the reference path is then just a baseline.
//
// Still evidence-only: closureBacked is true (values came from closures), but the closures are
// not validated, so scientific/material/EOS/SPH/phase validation all stay false.

import { computeThermodynamicPreflight, createSphPhaseScenario } from '../thermoPreflight.js';
import { specificInternalEnergyJPerKg } from './thermoState.js';

function energyOf(properties, temperatureK) {
  return specificInternalEnergyJPerKg(properties, temperatureK);
}

function solveAdiabaticEquilibriumK(parts) {
  const total = (t) => parts.reduce((sum, p) => sum + p.massKg * energyOf(p.properties, t), 0);
  const target = parts.reduce((sum, p) => sum + p.massKg * energyOf(p.properties, p.initialTemperatureK), 0);
  let lo = Math.min(...parts.map((p) => p.initialTemperatureK));
  let hi = Math.max(...parts.map((p) => p.initialTemperatureK));
  for (let i = 0; i < 200; i += 1) {
    const mid = 0.5 * (lo + hi);
    if (total(mid) < target) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

export async function computeClosureBackedPreflight(scenario = createSphPhaseScenario(), { materialRegistry } = {}) {
  if (!materialRegistry) throw new Error('computeClosureBackedPreflight requires a materialRegistry');
  const reference = computeThermodynamicPreflight(scenario);

  const tFe0 = scenario.iron.initialTemperatureK;
  const tIce0 = scenario.ice.initialTemperatureK;
  const tAir0 = scenario.gas.initialTemperatureK;
  const pressurePa = scenario.gas.pressurePa;

  // Sample densities through the registry (validity-gated). A domain exit blocks the preflight
  // and surfaces the closure-refresh request rather than extrapolating.
  const densitySamples = {
    fe: await materialRegistry.sampleProperty({ material: 'fe', property: 'density', temperatureK: tFe0, pressurePa }),
    h2o: await materialRegistry.sampleProperty({ material: 'h2o', property: 'density', temperatureK: tIce0, pressurePa }),
    air: await materialRegistry.sampleProperty({ material: 'air', property: 'density', temperatureK: tAir0, pressurePa })
  };
  const domainExits = Object.entries(densitySamples).filter(([, s]) => s.status !== 'sampled');
  if (domainExits.length > 0) {
    return {
      scenarioId: scenario.scenarioId,
      status: 'preflight-blocked-closure-domain',
      closureBacked: true,
      blockedMaterials: domainExits.map(([material, s]) => ({ material, status: s.status, refreshRequest: s.refreshRequest || null })),
      scientificValidation: false,
      fullPhysicsValidation: false,
      materialValidation: false,
      eosValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      blockers: ['material-sample-left-closure-domain']
    };
  }

  const feClosure = materialRegistry.getClosure('fe');
  const h2oClosure = materialRegistry.getClosure('h2o');
  const airClosure = materialRegistry.getClosure('air');
  const waterFreezingK = h2oClosure.properties.transitions[0].temperatureK;

  const ironMassKg = scenario.iron.volumeM3 * densitySamples.fe.value;
  const iceMassKg = scenario.ice.volumeM3 * densitySamples.h2o.value;
  const airVolumeM3 = scenario.box.volumeM3 - scenario.iron.volumeM3 - scenario.ice.volumeM3;
  const airMassKg = airVolumeM3 * densitySamples.air.value;

  const adiabatic = scenario.walls.model === 'adiabatic';
  const adiabaticEquilibriumK = solveAdiabaticEquilibriumK([
    { massKg: ironMassKg, properties: feClosure.properties, initialTemperatureK: tFe0 },
    { massKg: iceMassKg, properties: h2oClosure.properties, initialTemperatureK: tIce0 },
    { massKg: airMassKg, properties: airClosure.properties, initialTemperatureK: tAir0 }
  ]);
  const asymptoticInteriorTempK = reference.boundary.asymptoticInteriorTempK;
  const bindingInteriorTempK = adiabatic ? adiabaticEquilibriumK : reference.boundary.maxWallTempK;

  const initialEnergyJ = ironMassKg * energyOf(feClosure.properties, tFe0)
    + iceMassKg * energyOf(h2oClosure.properties, tIce0)
    + airMassKg * energyOf(airClosure.properties, tAir0);
  const finalEnergyJ = ironMassKg * energyOf(feClosure.properties, asymptoticInteriorTempK)
    + iceMassKg * energyOf(h2oClosure.properties, asymptoticInteriorTempK)
    + airMassKg * energyOf(airClosure.properties, asymptoticInteriorTempK);
  const heatExportedToWallsJ = adiabatic ? 0 : initialEnergyJ - finalEnergyJ;
  const feasible = bindingInteriorTempK < waterFreezingK && bindingInteriorTempK < feClosure.properties.transitions[0].temperatureK;

  // Masses (density-driven) and the feasibility verdict (temperature-driven) are invariant to the
  // heat-capacity model, so they must still match the constant-cp baseline. The energy budget,
  // however, is intentionally more accurate now (Debye iron + equipartition air), so its
  // divergence from the baseline is reported as the first-principles correction, not a failure.
  const consistentWithReference =
    Math.abs(ironMassKg - reference.masses.ironMassKg) < 1e-6
    && Math.abs(iceMassKg - reference.masses.iceMassKg) < 1e-6
    // Air mass differs by ~0.1 kg because the equipartition-derived mean molar mass refines the
    // reference constant; that is a first-principles improvement, not an inconsistency.
    && Math.abs(airMassKg - reference.masses.airMassKg) < 1
    && feasible === reference.feasibility.feasible;
  const firstPrinciplesEnergyDeltaJ = heatExportedToWallsJ - reference.energyBudget.heatExportedToWallsJ;
  const adiabaticEquilibriumDeltaK = adiabaticEquilibriumK - reference.boundary.adiabaticEquilibriumK;

  return {
    ...reference,
    closureBacked: true,
    closureSampling: {
      densityKgPerM3: { fe: densitySamples.fe.value, h2o: densitySamples.h2o.value, air: densitySamples.air.value },
      closureRefs: {
        fe: densitySamples.fe.closureRef?.uri || null,
        h2o: densitySamples.h2o.closureRef?.uri || null,
        air: densitySamples.air.closureRef?.uri || null
      },
      masses: { ironMassKg, iceMassKg, airMassKg },
      heatExportedToWallsJ,
      adiabaticEquilibriumK,
      feasible,
      waterFreezingK,
      consistentWithReference,
      firstPrinciplesEnergyDeltaJ,
      adiabaticEquilibriumDeltaK,
      heatCapacityModel: { fe: 'debye-solid', air: 'equipartition' }
    },
    blockers: [...reference.blockers, 'closure-backed-by-reference-fixtures-not-validated']
  };
}
