import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_PHASE_SCENARIO_ID,
  computeThermodynamicPreflight,
  createSphPhaseScenario
} from '../src/runtime/thermoPreflight.js';
import {
  ULG_THERMODYNAMIC_PREFLIGHT_ARTIFACT_SCHEMA,
  createThermodynamicPreflightArtifact
} from '../ulg-gpu-abi/src/index.js';

const MJ = 1e6;

test('scenario geometry: iron cube is 1/8 the ice volume with the right masses', () => {
  const preflight = computeThermodynamicPreflight(createSphPhaseScenario());
  assert.equal(preflight.scenarioId, SPH_PHASE_SCENARIO_ID);
  assert.ok(Math.abs(preflight.geometry.iceVolumeM3 - 1) < 1e-9);
  assert.ok(Math.abs(preflight.geometry.ironVolumeM3 - 0.125) < 1e-9);
  assert.ok(Math.abs(preflight.geometry.ironVolumeFractionOfIce - 0.125) < 1e-9);
  assert.ok(Math.abs(preflight.geometry.ironEdgeM - 0.5) < 1e-9);
  // Iron mass from molten density (7000 kg/m^3), ice from ice density (917 kg/m^3).
  assert.ok(Math.abs(preflight.masses.ironMassKg - 875) < 1e-6);
  assert.ok(Math.abs(preflight.masses.iceMassKg - 917) < 1e-6);
  // -40C air at 1 atm is ~1.51 kg/m^3 over ~998.875 m^3.
  assert.ok(preflight.masses.airDensityKgPerM3 > 1.5 && preflight.masses.airDensityKgPerM3 < 1.53);
  assert.ok(preflight.masses.airMassKg > 1500 && preflight.masses.airMassKg < 1525);
});

test('honest finite walls (default) close the box: interior and walls share one temperature', () => {
  const scenario = createSphPhaseScenario();
  const preflight = computeThermodynamicPreflight(scenario);
  assert.equal(preflight.boundary.model, 'finite-heat-capacity-lumped-face');
  assert.equal(scenario.wallReservoirAuthority.finiteCapacity, true);
  assert.equal(scenario.wallReservoirAuthority.exchangeEnabled, true);
  assert.equal(preflight.boundary.wallMaterial, 'fe');
  assert.equal(preflight.boundary.wallThicknessM, 0.002);
  // Each face's capacity derives from the wall material: rho c A t.
  const edge = scenario.box.dimensionsM[0];
  const expectedCapacity = 7874 * 449 * edge * edge * 0.002;
  for (const capacity of Object.values(preflight.boundary.wallHeatCapacitiesJPerK)) {
    assert.ok(Math.abs(capacity - expectedCapacity) <= 1e-9 * expectedCapacity);
  }
  // Energy closes exactly: what the interior gives up, the faces hold.
  const ledgerSum = preflight.energyBudget.wallLedger.reduce((s, w) => s + w.heatJ, 0);
  assert.ok(Math.abs(ledgerSum - preflight.energyBudget.heatExportedToWallsJ)
    <= 1e-6 * Math.abs(preflight.energyBudget.heatExportedToWallsJ));
  // The faces start cold (-40 F) and end at the mixed temperature, so all are sinks.
  assert.ok(preflight.boundary.asymptoticInteriorTempK > 233.15);
  assert.equal(preflight.boundary.asymptoticInteriorTempK, preflight.boundary.finiteWallEquilibriumK);
  assert.ok(preflight.energyBudget.wallLedger.every((w) => w.role === 'sink'));
  // A sealed finite box cannot cool molten iron + ice below freezing.
  assert.equal(preflight.feasibility.feasible, false);
});

test('cold infinite reservoirs make cold solid iron + ice energetically feasible', () => {
  const preflight = computeThermodynamicPreflight(createSphPhaseScenario({
    wallModel: 'infinite-fixed-temperature-reservoir'
  }));
  assert.equal(preflight.boundary.model, 'infinite-fixed-temperature-reservoir');
  assert.ok(Math.abs(preflight.boundary.asymptoticInteriorTempK - 233.15) < 1e-9);
  assert.equal(preflight.feasibility.feasible, true);
  assert.equal(preflight.feasibility.feasibleH2oFrozen, true);
  assert.equal(preflight.feasibility.finalH2oPhase, 'solid');
  assert.equal(preflight.feasibility.finalFePhase, 'solid');
  assert.equal(preflight.status, 'preflight-feasible');
  // Heat exported to the walls is the iron cooling/solidifying enthalpy: ~864 MJ.
  assert.ok(preflight.energyBudget.heatExportedToWallsJ > 860 * MJ);
  assert.ok(preflight.energyBudget.heatExportedToWallsJ < 868 * MJ);
  // All six cold faces are sinks and split the exported energy by equal area.
  const sinks = preflight.energyBudget.wallLedger.filter((w) => w.role === 'sink');
  assert.equal(sinks.length, 6);
  const ledgerSum = preflight.energyBudget.wallLedger.reduce((s, w) => s + w.heatJ, 0);
  assert.ok(Math.abs(ledgerSum - preflight.energyBudget.heatExportedToWallsJ) < 1);
});

test('transient energetics: iron can melt all the ice but cannot boil it all', () => {
  const preflight = computeThermodynamicPreflight(createSphPhaseScenario());
  assert.ok(preflight.transient.ironReleasableHeatJ > 860 * MJ);
  // Melting all the ice needs ~382 MJ; boiling it all needs ~2835 MJ.
  assert.ok(Math.abs(preflight.transient.iceFullMeltEnergyJ - 382.5 * MJ) < 2 * MJ);
  assert.ok(Math.abs(preflight.transient.iceFullBoilEnergyJ - 2835 * MJ) < 5 * MJ);
  assert.equal(preflight.transient.canFullyMeltIce, true);
  assert.equal(preflight.transient.canFullyBoilIce, false);
});

test('adiabatic sealed box is infeasible: mixed equilibrium is above freezing', () => {
  const preflight = computeThermodynamicPreflight(createSphPhaseScenario({ wallModel: 'adiabatic' }));
  // Energy-conserving lumped equilibrium lands ~350 K (well above 273.15 K).
  assert.ok(preflight.boundary.adiabaticEquilibriumK > 273.15);
  assert.ok(preflight.boundary.adiabaticEquilibriumK > 330 && preflight.boundary.adiabaticEquilibriumK < 375);
  assert.equal(preflight.feasibility.feasible, false);
  assert.equal(preflight.energyBudget.heatExportedToWallsJ, 0);
  assert.equal(preflight.status, 'preflight-infeasible');
  assert.ok(preflight.blockers.includes('requested-final-state-energetically-infeasible'));
});

test('walls set above freezing are infeasible even as infinite reservoirs', () => {
  const preflight = computeThermodynamicPreflight(createSphPhaseScenario({ wallTemperatureK: 300 }));
  assert.equal(preflight.feasibility.feasible, false);
  assert.equal(preflight.feasibility.feasibleH2oFrozen, false);
  assert.equal(preflight.feasibility.finalH2oPhase, 'liquid');
  assert.ok(preflight.blockers.includes('requested-final-state-energetically-infeasible'));
});

test('preflight is evidence-only and never overclaims, including the ABI artifact', () => {
  const preflight = computeThermodynamicPreflight(createSphPhaseScenario());
  for (const flag of ['closureBacked', 'scientificValidation', 'fullPhysicsValidation', 'materialValidation', 'eosValidation', 'sphValidation', 'phaseChangeValidation']) {
    assert.equal(preflight[flag], false, `${flag} must be false`);
  }
  assert.ok(preflight.blockers.includes('thermodynamic-preflight-reference-fixtures-not-closure-backed'));
  // Represented entities per macro particle are computed (resolution does not change the law).
  assert.ok(preflight.particleResolution.h2o.entitiesPerMacroParticle > 0);
  assert.ok(preflight.particleResolution.fe.entitiesPerMacroParticle > 0);

  const artifact = createThermodynamicPreflightArtifact({
    artifactId: 'ulg:sph-phase-preflight.v0',
    preflight
  });
  assert.equal(artifact.schema, ULG_THERMODYNAMIC_PREFLIGHT_ARTIFACT_SCHEMA);
  assert.equal(artifact.scenarioId, SPH_PHASE_SCENARIO_ID);
  // The artifact carries the preflight's own verdict (finite walls by default).
  assert.equal(artifact.status, preflight.status);
  for (const flag of ['closureBacked', 'scientificValidation', 'fullPhysicsValidation', 'materialValidation', 'eosValidation', 'sphValidation', 'phaseChangeValidation']) {
    assert.equal(artifact[flag], false, `artifact ${flag} must be false`);
  }
});
