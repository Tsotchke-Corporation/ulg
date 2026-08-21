import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ULG_SPH_IRON_ICE_ENERGY_BUDGET_ORACLE_SCHEMA,
  createSphIronIceEnergyBudgetOracle
} from '../src/runtime/sph/sphIronIceEnergyBudgetOracle.js';
import {
  evaluateSchroederSpatialThermalPairProposal
} from '../src/runtime/sph/schroederSpatialThermalProposalsGpu.js';
import { buildSphPhaseDemoState } from '../src/runtime/sphPhaseDemo.js';
import { sphInitialBodiesFromLegacyPhaseControls } from '../src/runtime/sphInitialBodies.js';
import { sphPhaseScenarioPresetById } from '../src/runtime/sphPhaseScenarioPresets.js';
import { createSphPhaseScenario } from '../src/runtime/thermoPreflight.js';

const report = createSphIronIceEnergyBudgetOracle();

test('iron/ice oracle consumes the exact preset geometry and runtime material closures', () => {
  assert.equal(report.schema, ULG_SPH_IRON_ICE_ENERGY_BUDGET_ORACLE_SCHEMA);
  assert.equal(report.preset.id, 'iron-ice-quench');
  assert.equal(report.preset.minimumRequestedVisualHorizonS, 2);
  assert.equal(report.preset.controls.drop, 'fe');
  assert.equal(report.preset.controls.base, 'h2o');
  assert.equal(report.preset.controls.dropn, '6');
  assert.equal(report.preset.controls.basen, '10');
  assert.equal(report.preset.runtime.sceneLengthScale, '0.014');
  assert.equal(report.preset.runtime.wallModel, 'adiabatic');
  assert.equal(report.geometry.iceEdgeM, 0.028);
  assert.deepEqual(report.geometry.boxDimensionsM, [0.14, 0.14, 0.14]);
  assert.equal(report.geometry.ironEdgeM, 0.0168);
  assert.deepEqual(report.geometry.ironSizeM, [0.0168, 0.0168, 0.0168]);
  assert.deepEqual(report.geometry.iceSizeM, [0.028, 0.028, 0.028]);
  assert.ok(Math.abs(report.geometry.ironMassKg - 0.03309659136) < 1e-15);
  assert.ok(Math.abs(report.geometry.iceMassKg - 0.020129984) < 1e-12);
  assert.deepEqual(report.geometry.ironParticlesPerEdge, [6, 6, 6]);
  assert.deepEqual(report.geometry.iceParticlesPerEdge, [10, 10, 10]);
  assert.ok(Math.abs(report.geometry.ironParticleRadiusM - 0.00173698137451832) < 1e-15);
  assert.ok(Math.abs(report.geometry.iceParticleRadiusM - 0.00173698137451832) < 1e-15);
  assert.equal(
    report.geometry.conductionGeometryAuthority,
    'mechanical-interface-receipt-v2-axis-aligned-finite-volume-face'
  );
  assert.equal(
    report.geometry.radiationRadiusAuthority,
    'production-rest-volume-equivalent-sphere'
  );
  assert.equal(report.geometry.ironFiniteVolumeCellEdgeM, 0.0028);
  assert.equal(report.geometry.iceFiniteVolumeCellEdgeM, 0.0028);
  assert.equal(
    report.materialClosures.authority,
    'runtime-reference-bank-anchored-material-closures'
  );
  assert.equal(report.materialClosures.ironLiquidConductivityWPerMK, 40);
  assert.equal(report.materialClosures.iceConductivityWPerMK, 2.16);
  assert.equal(report.materialClosures.h2oMeltingTemperatureK, 273.15);
  assert.equal(report.materialClosures.h2oBoilingTemperatureK, 373.15);
  assert.equal(report.materialClosures.feReferenceBank.bank, 'elements');
  assert.equal(report.materialClosures.h2oReferenceBank.bank, 'compounds');
});

test('iron/ice oracle geometry matches an independently realized mounted body plan', () => {
  const preset = sphPhaseScenarioPresetById('iron-ice-quench');
  const controls = preset.controls;
  const sceneLengthScale = Number(preset.runtime.sceneLengthScale);
  const wallFaces = Object.fromEntries([
    ['xMin', 'wxmin'],
    ['xMax', 'wxmax'],
    ['yMin', 'wymin'],
    ['yMax', 'wymax'],
    ['zMin', 'wzmin'],
    ['zMax', 'wzmax']
  ].map(([faceId, key]) => [faceId, Number(controls[key])]));
  const scenario = createSphPhaseScenario({
    wallFaces,
    wallModel: preset.runtime.wallModel,
    sceneLengthScale,
    boxDimensionsM:
      ['boxx', 'boxy', 'boxz'].map((key) => Number(controls[key]))
  });
  const initialBodies = sphInitialBodiesFromLegacyPhaseControls({
    baseMaterial: controls.base,
    dropMaterial: controls.drop,
    baseTemperatureK: Number(controls.baset),
    dropTemperatureK: Number(controls.dropt),
    baseParticlesPerEdge: Number(controls.basen),
    dropParticlesPerEdge: Number(controls.dropn),
    referenceBaseEdgeM: scenario.referenceGeometry.iceEdgeM,
    referenceBaseParticlesPerEdge: 5,
    sceneLengthScale,
    referenceBoxDimensionsM: scenario.referenceGeometry.boxDimensionsM,
    referenceBaseBottomM: Number(controls.iceh),
    referenceDropBottomM: Number(controls.ironh)
  });
  const demo = buildSphPhaseDemoState({
    scenario,
    initialBodies,
    mechanics: 'mlsmpm',
    allowReducedProductProperties: true
  });

  assert.deepEqual(
    report.geometry.ironSizeM,
    demo.initialParticleSpacing.drop.sizeM
  );
  assert.deepEqual(
    report.geometry.iceSizeM,
    demo.initialParticleSpacing.base.sizeM
  );
  assert.equal(
    report.geometry.ironMassKg,
    demo.initialParticleSpacing.drop.totalMassKg
  );
  assert.equal(
    report.geometry.iceMassKg,
    demo.initialParticleSpacing.base.totalMassKg
  );
  assert.equal(
    report.geometry.ironParticleRadiusM,
    Math.cbrt(
      3 * demo.initialParticleSpacing.drop.particleMassKg
      / (
        4 * Math.PI
        * demo.initialParticleSpacing.drop.densityKgPerM3
      )
    )
  );
  assert.equal(
    report.geometry.iceParticleRadiusM,
    Math.cbrt(
      3 * demo.initialParticleSpacing.base.particleMassKg
      / (
        4 * Math.PI
        * demo.initialParticleSpacing.base.densityKgPerM3
      )
    )
  );
  assert.notEqual(
    report.geometry.iceParticleRadiusM,
    demo.initialParticleSpacing.base.volumeEquivalentParticleRadiusM
  );
  assert.deepEqual(
    report.geometry.ironCenterM,
    demo.initialBodies.bodies.find((body) => body.id === 'drop').centerM
  );
  assert.deepEqual(
    report.geometry.iceCenterM,
    demo.initialBodies.bodies.find((body) => body.id === 'base').centerM
  );
});

test('two-x refinement preserves the recovered baseline physical experiment', () => {
  const preset = sphPhaseScenarioPresetById('iron-ice-quench');
  const controls = preset.controls;
  const wallFaces = Object.fromEntries([
    ['xMin', 'wxmin'],
    ['xMax', 'wxmax'],
    ['yMin', 'wymin'],
    ['yMax', 'wymax'],
    ['zMin', 'wzmin'],
    ['zMax', 'wzmax']
  ].map(([faceId, key]) => [faceId, Number(controls[key])]));
  const sceneLengthScale = 0.028;
  const scenario = createSphPhaseScenario({
    wallFaces,
    wallModel: 'adiabatic',
    sceneLengthScale,
    boxDimensionsM: [5, 5, 5]
  });
  const initialBodies = sphInitialBodiesFromLegacyPhaseControls({
    baseMaterial: 'h2o',
    dropMaterial: 'fe',
    baseTemperatureK: 233.15,
    dropTemperatureK: 1850,
    baseParticlesPerEdge: 5,
    dropParticlesPerEdge: 3,
    referenceBaseEdgeM: scenario.referenceGeometry.iceEdgeM,
    referenceBaseParticlesPerEdge: 5,
    sceneLengthScale,
    referenceBoxDimensionsM: scenario.referenceGeometry.boxDimensionsM,
    referenceBaseBottomM: 0,
    referenceDropBottomM: 1
  });
  const baseline = buildSphPhaseDemoState({
    scenario,
    initialBodies,
    mechanics: 'mlsmpm',
    allowReducedProductProperties: true
  });

  assert.deepEqual(report.geometry.boxDimensionsM, baseline.scenario.box.dimensionsM);
  assert.deepEqual(report.geometry.ironSizeM, baseline.initialParticleSpacing.drop.sizeM);
  assert.deepEqual(report.geometry.iceSizeM, baseline.initialParticleSpacing.base.sizeM);
  assert.deepEqual(
    report.geometry.ironCenterM,
    baseline.initialBodies.bodies.find((body) => body.id === 'drop').centerM
  );
  assert.deepEqual(
    report.geometry.iceCenterM,
    baseline.initialBodies.bodies.find((body) => body.id === 'base').centerM
  );
  assert.equal(report.geometry.ironMassKg, baseline.initialParticleSpacing.drop.totalMassKg);
  assert.equal(report.geometry.iceMassKg, baseline.initialParticleSpacing.base.totalMassKg);
  assert.equal(baseline.initialParticleSpacing.base.spacingM, 0.0056);
  assert.equal(report.candidates.spatialRefinement.carrierPitchM, 0.0028);
});

test('power ledger attributes contact, radiation, ambient, and all six wall faces', () => {
  const ledger = report.initialPowerLedger;
  assert.ok(ledger.feToH2oContactConduction.aggregatePowerIntoH2oW > 0);
  assert.ok(ledger.feToH2oPairRadiation.aggregatePowerIntoH2oW > 0);
  assert.equal(ledger.ambientRadiation.exchangeEnabled, false);
  assert.equal(
    ledger.ambientRadiation.authority,
    'wall-reservoir-authority.exchangeEnabled'
  );
  assert.equal(ledger.ambientRadiation.powerIntoIronW, 0);
  assert.equal(ledger.ambientRadiation.powerIntoH2oW, 0);
  assert.equal(ledger.ambientRadiation.totalPowerIntoBodiesW, 0);
  assert.ok(ledger.openBoundaryAmbientRadiation.powerIntoIronW < 0);
  assert.equal(ledger.openBoundaryAmbientRadiation.powerIntoH2oW, 0);
  assert.deepEqual(
    ledger.walls.terms.map((term) => term.faceId),
    ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax']
  );
  assert.equal(ledger.walls.terms.filter((term) => term.directContact).length, 1);
  assert.equal(ledger.walls.model, 'adiabatic');
  assert.ok(ledger.walls.terms.every((term) => (
    term.conductanceWPerK === 0 && term.powerIntoH2oW === 0
  )));
  assert.ok(
    ledger.fixedReservoirWalls.terms
      .find((term) => term.faceId === 'yMin').powerIntoH2oW > 0
  );
  assert.equal(ledger.adiabaticWalls.terms.length, 6);
  assert.ok(ledger.adiabaticWalls.terms.every((term) => (
    term.conductanceWPerK === 0 && term.powerIntoH2oW === 0
  )));
});

test('contact ledger matches receipt-v2 face area and TPFA series resistance', () => {
  const conduction = report.initialPowerLedger.feToH2oContactConduction;
  const radiation = report.initialPowerLedger.feToH2oPairRadiation;
  const pair = evaluateSchroederSpatialThermalPairProposal({
    distanceM: conduction.contactCenterDistanceM,
    smoothingLengthM: report.geometry.iceParticleRadiusM * 2,
    radiusM: report.geometry.ironParticleRadiusM,
    otherRadiusM: report.geometry.iceParticleRadiusM,
    massKg: 1,
    otherMassKg: 1,
    temperatureK: report.initialState.ironTemperatureK,
    otherTemperatureK: report.initialState.iceTemperatureK,
    temperatureSlopeKdPerJPerKg: 0,
    otherTemperatureSlopeKdPerJPerKg: 0,
    thermalConductivityWPerMK:
      report.materialClosures.ironLiquidConductivityWPerMK,
    otherThermalConductivityWPerMK:
      report.materialClosures.iceConductivityWPerMK,
    materialId: 1,
    otherMaterialId: 2,
    mechanicalInterfaceReceiptReady: true,
    mechanicalInterfaceAreaM2: conduction.contactAreaPerPairM2,
    emissivity: report.materialClosures.ironEmissivity,
    otherEmissivity: report.materialClosures.h2oEmissivity,
    dtS: 1
  });

  assert.equal(conduction.contactPairCount, 36);
  assert.ok(Math.abs(conduction.contactCenterDistanceM - 0.0028) < 1e-15);
  assert.ok(Math.abs(conduction.contactAreaPerPairM2 - 7.84e-6) < 1e-18);
  assert.ok(
    Math.abs(conduction.totalContactFaceAreaM2 - 2.8224e-4) < 1e-16
  );
  assert.ok(
    Math.abs(conduction.contactAreaPerPairM2 - pair.contactAreaM2) < 1e-18
  );
  assert.ok(
    Math.abs(
      conduction.conductionPathLengthM - pair.conductionPathLengthM
    ) < 1e-15
  );
  assert.ok(
    Math.abs(
      conduction.interfaceResistancePerContactKPerW
        - 87.1362433862434
    ) < 1e-12
  );
  assert.ok(
    Math.abs(
      conduction.perContactPowerIntoH2oW + pair.conductionEnergyJ
    ) < 1e-10
  );
  assert.ok(
    Math.abs(conduction.aggregatePowerIntoH2oW - 667.9952880455406)
      < 1e-10
  );
  assert.equal(radiation.perContactPowerIntoH2oW, -pair.radiationEnergyJ);
  assert.equal(radiation.radiationPairCount, 14340);
  assert.ok(radiation.aggregatePowerIntoH2oW > 40);
  assert.ok(radiation.maxPowerIntoSingleH2oCarrierW > 0.5);
});

test('exact two-x refinement admits first vapor only as an initial-rate screen', () => {
  const verdict = report.targetHorizonVerdict;
  assert.equal(
    verdict.status,
    'initial-rate-admits-target-first-vapor'
  );
  assert.equal(verdict.initialRateBelowMeltDemand, false);
  assert.equal(verdict.initialRateBelowFirstVaporDemand, false);
  assert.equal(verdict.initialRateBelowFullVaporDemand, true);
  assert.ok(
    verdict.initialRateEnergyJ
      > verdict.oneCarrierFirstVaporDemandJ
  );
  assert.equal(
    report.minimumHorizons.wholeIceFullMelt.status,
    'initial-rate-horizon'
  );
  assert.equal(
    report.minimumHorizons.wholeIceFirstVapor.status,
    'initial-rate-horizon'
  );
  assert.ok(
    report.minimumHorizons.wholeIceFullMelt.minimumHorizonS > 2
  );
  assert.ok(
    report.minimumHorizons.wholeIceFirstVapor.minimumHorizonS > 2
  );
  assert.equal(
    report.minimumHorizons.oneSurfaceCarrierFirstVapor.status,
    'initial-rate-horizon'
  );
  assert.ok(
    report.minimumHorizons.oneSurfaceCarrierFirstVapor.minimumHorizonS < 1
  );

  const shorterRun = createSphIronIceEnergyBudgetOracle({
    targetVisualHorizonS: 0.75
  });
  assert.equal(
    shorterRun.targetHorizonVerdict.status,
    'initial-rate-below-target-first-vapor-demand'
  );
  assert.match(shorterRun.targetHorizonVerdict.interpretation, /not a global/);
});

test('realized preset exposes the exact two-x spatial refinement', () => {
  const candidate = report.candidates.spatialRefinement;
  assert.equal(candidate.status, 'exact-two-x-refinement-applied');
  assert.equal(candidate.linearRefinementFactor, 2);
  assert.equal(candidate.physicalGeometryUnchanged, true);
  assert.equal(candidate.referenceBaseParticlesPerEdge, 5);
  assert.equal(candidate.resolvedBaseParticlesPerEdge, 10);
  assert.equal(candidate.resolvedDropParticlesPerEdge, 6);
  assert.equal(candidate.carrierPitchM, 0.0028);
  assert.equal(
    candidate.optimisticMinimumHorizonS,
    report.minimumHorizons.oneSurfaceCarrierFirstVapor.minimumHorizonS
  );
  assert.equal(report.geometry.iceEdgeM, 0.028);
  assert.equal(report.preset.controls.boxx, '10');
  assert.equal(report.scientificValidation, false);
  assert.equal(report.fullPhysicsValidation, false);
});

test('oracle is deterministic and exposes no arbitrary pair coefficient', () => {
  assert.deepEqual(createSphIronIceEnergyBudgetOracle(), report);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes('conductionRate'), false);
});
