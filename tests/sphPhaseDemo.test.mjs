import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildSphPhaseDemoState,
  createSphPhaseDemo,
  gasPressureFeedbackSummary,
  deriveLocalGasCellPressureFieldFromSpatialGasLedger,
  gasPressureInterfaceForcePreview,
  gasPressureInterfaceForceSolver,
  gasPressureInterfaceCouplingSummary,
  gasPressureSummary,
  gasPressureSummaryFromResidentReaction,
  particleRenderDescriptors,
  particleThermalState,
  phaseMassSummary,
  normalizeSphPhysicalLawGroups,
  waterVaporOpticalStateFromGasSummary
} from '../src/runtime/sphPhaseDemo.js';
import { createSphPhaseScenario } from '../src/runtime/thermoPreflight.js';
import { createSphPhaseViewState } from '../src/runtime/sphPhaseViewState.js';
import { createDerivedMaterialClosure } from '../src/runtime/material/materialDerivation.js';
import { materialDerivationSummary } from '../src/runtime/material/propertyProvenance.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';

function near(actual, expected, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test('demo default builds with fully derived material closures', () => {
  const demo = buildSphPhaseDemoState();
  assert.ok(demo.counts.total > 0);
  for (const key of ['fe', 'h2o', 'air']) {
    const summary = materialDerivationSummary(demo.materialProperties[key]);
    assert.equal(summary.fullyLowerLevelDerived, true);
    assert.equal(summary.hasReferenceFallbacks, false);
    assert.equal(summary.hasReducedEstimates, false);
  }
});

test('demo consumes partial cached closures and derives only missing runtime materials', () => {
  const cachedH2o = createDerivedMaterialClosure('h2o');
  const demo = buildSphPhaseDemoState({
    closures: { h2o: cachedH2o },
    dropParticleEdge: 1,
    baseParticleEdge: 1
  });
  assert.equal(demo.materialProperties.h2o, cachedH2o.properties);
  for (const key of ['fe', 'air', 'h2', 'o2']) {
    const summary = materialDerivationSummary(demo.materialProperties[key]);
    assert.equal(summary.fullyLowerLevelDerived, true);
    assert.equal(summary.hasReferenceFallbacks, false);
  }
});

test('demo initial state: hot molten-iron block on a cold ice block', () => {
  const demo = buildSphPhaseDemoState();
  assert.ok(demo.counts.drop > 0 && demo.counts.base > 0);
  assert.equal(demo.counts.total, demo.counts.drop + demo.counts.base);
  assert.equal(demo.dropMaterial, 'fe');
  assert.equal(demo.baseMaterial, 'h2o');
  const fe = demo.state.particles.filter((p) => p.material === 'fe');
  const ice = demo.state.particles.filter((p) => p.material === 'h2o');
  const feLiquidus = demo.materialProperties.fe.transitions[0].temperatureK;
  assert.ok(fe.every((p) => p.temperatureK > feLiquidus));
  assert.ok(ice.every((p) => p.temperatureK === 233.15));
  // Iron sits above the ice (higher y).
  const minIronY = Math.min(...fe.map((p) => p.x[1]));
  const maxIceY = Math.max(...ice.map((p) => p.x[1]));
  assert.ok(minIronY >= maxIceY - 1e-9);
});

test('demo initial particle spacing adapts to material density at role temperature', () => {
  const demo = buildSphPhaseDemoState({
    dropParticleEdge: 3,
    baseParticleEdge: 5
  });
  const spacing = demo.initialParticleSpacing;
  const dropMass = demo.state.particles.find((p) => p.role === 'drop').massKg;
  const baseMass = demo.state.particles.find((p) => p.role === 'base').massKg;

  assert.equal(spacing.schema, 'peercompute.ulg.sph-initial-particle-spacing-plan.v0');
  assert.equal(spacing.status, 'material-temperature-equal-mass-capped');
  assert.equal(spacing.drop.requestedParticlesPerEdge, 3);
  assert.equal(spacing.base.requestedParticlesPerEdge, 5);
  assert.ok(spacing.drop.densityKgPerM3 > spacing.base.densityKgPerM3);
  assert.ok(spacing.drop.particlesPerEdge > spacing.drop.requestedParticlesPerEdge);
  assert.ok(spacing.base.particlesPerEdge < spacing.base.requestedParticlesPerEdge);
  assert.ok(spacing.drop.spacingM < spacing.drop.uniformSpacingM);
  assert.ok(spacing.base.spacingM > spacing.base.uniformSpacingM);
  assert.ok(Math.abs(dropMass / baseMass - 1) < 0.15);
  assert.equal(demo.counts.drop, spacing.drop.particlesPerEdge ** 3);
  assert.equal(demo.counts.base, spacing.base.particlesPerEdge ** 3);
  near(
    demo.state.smoothingLengthM,
    1.6 * Math.min(spacing.drop.spacingM, spacing.base.spacingM)
  );
});

test('demo initial particle spacing coarsens low-density hot vapor and can preserve fixed counts', () => {
  const liquidWater = buildSphPhaseDemoState({
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1,
    dropParticleEdge: 3,
    baseParticleEdge: 5
  });
  const hotVapor = buildSphPhaseDemoState({
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 450,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1,
    dropParticleEdge: 3,
    baseParticleEdge: 5
  });
  const fixed = buildSphPhaseDemoState({
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 450,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1,
    dropParticleEdge: 3,
    baseParticleEdge: 5,
    adaptiveParticleSpacing: false
  });

  assert.equal(liquidWater.initialParticleSpacing.drop.particlesPerEdge, 3);
  assert.equal(liquidWater.initialParticleSpacing.base.particlesPerEdge, 5);
  assert.ok(hotVapor.initialParticleSpacing.drop.densityKgPerM3 < liquidWater.initialParticleSpacing.drop.densityKgPerM3);
  assert.ok(hotVapor.initialParticleSpacing.drop.particlesPerEdge < liquidWater.initialParticleSpacing.drop.particlesPerEdge);
  assert.ok(hotVapor.initialParticleSpacing.drop.spacingM > liquidWater.initialParticleSpacing.drop.spacingM);
  assert.equal(fixed.initialParticleSpacing.status, 'fixed-requested-particles-per-edge');
  assert.equal(fixed.initialParticleSpacing.drop.particlesPerEdge, 3);
  assert.equal(fixed.initialParticleSpacing.base.particlesPerEdge, 5);
  assert.equal(fixed.counts.drop, 27);
  assert.equal(fixed.counts.base, 125);
});

test('particle phase + temperature come from the closure energy', () => {
  const demo = buildSphPhaseDemoState();
  const thermal = particleThermalState(demo);
  const ironStates = thermal.filter((t) => t.material === 'fe');
  const iceStates = thermal.filter((t) => t.material === 'h2o');
  // Iron starts molten from its derived liquidus, ice starts solid from its derived H2O closure.
  assert.ok(ironStates.every((t) => t.phase === 'liquid'));
  assert.ok(iceStates.every((t) => t.phase === 'solid'));
  const summary = phaseMassSummary(demo);
  assert.equal(summary.ironSolidFraction, 0);
  assert.ok(summary.byMaterialPhase.h2o.solid > 0);
});

test('demo initializes hydrostatic pressure only for wall-supported condensed blocks', () => {
  const driver = createSphPhaseDemo({
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 0.85,
    dropParticleEdge: 2,
    baseParticleEdge: 3
  });
  const base = driver.demo.state.particles.filter((p) => p.role === 'base');
  const drop = driver.demo.state.particles.filter((p) => p.role === 'drop');
  const minBaseJ = Math.min(...base.map((p) => p.mpmJ ?? 1));

  assert.equal(driver.demo.initialHydrostaticState.status, 'hydrostatic-initialization-applied');
  assert.ok(base.some((p) => p.mpmJ < 1));
  assert.ok(minBaseJ > 0.999, `hydrostatic pre-compression is too large for liquid water: ${minBaseJ}`);
  assert.ok(base.every((p) => p.hydrostaticInitialization?.status === 'initialized-supported-condensed-block'));
  assert.ok(base.every((p) => p.hydrostaticInitialization?.volumeRatioModel === 'raw-closure-bulk-modulus'));
  assert.ok(drop.every((p) => p.mpmJ === undefined));
});

test('demo preflight reports overlapping initial block geometry', () => {
  const driver = createSphPhaseDemo({
    scenario: createSphPhaseScenario({ boxDimensionsM: [5, 5, 5] }),
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 0.85,
    dropParticleEdge: 3,
    baseParticleEdge: 5
  });
  const preflight = driver.preflight();
  assert.equal(preflight.status, 'preflight-blocked-initial-geometry');
  assert.equal(preflight.feasibility.geometryBlocked, true);
  assert.ok(preflight.blockers.includes('initial-block-geometry-overlap'));
  assert.ok(preflight.initialGeometry.pairs.some((pair) => pair.status === 'initial-blocks-overlap'));
});

test('demo preflight treats valid room-temperature H2O/H2O as liquid-feasible', () => {
  const driver = createSphPhaseDemo({
    scenario: createSphPhaseScenario({
      wallFaces: {
        xMin: 293.15,
        xMax: 293.15,
        yMin: 293.15,
        yMax: 293.15,
        zMin: 293.15,
        zMax: 293.15
      },
      boxDimensionsM: [5, 5, 5]
    }),
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1,
    dropParticleEdge: 3,
    baseParticleEdge: 5
  });
  const preflight = driver.preflight();

  assert.equal(preflight.status, 'preflight-feasible-derived-closures');
  assert.equal(preflight.feasibility.feasible, true);
  assert.equal(preflight.feasibility.finalBasePhase, 'liquid');
  assert.equal(preflight.feasibility.finalDropPhase, 'liquid');
  assert.equal(preflight.initialGeometry.status, 'initial-block-geometry-ok');
});

test('MLS-MPM sound-speed scale includes ideal-gas phases in the CFL cap', () => {
  const driver = createSphPhaseDemo({
    scenario: createSphPhaseScenario({ boxDimensionsM: [5, 5, 5] }),
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 450,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1,
    dropParticleEdge: 3,
    baseParticleEdge: 5,
    mechanics: 'mlsmpm'
  });
  const viewState = createSphPhaseViewState(driver);
  const cflCap = driver.demo.gpuMechanics.cflMaxSoundSpeedMPerS;
  const gasRows = viewState.mlsMpmGpuParticleState.metadata.filter((row) => row.phase === 'gas');

  assert.ok(cflCap > 0);
  assert.ok(gasRows.length > 0);
  assert.ok(gasRows.every((row) => row.soundSpeedMPerS <= cflCap * (1 + 1e-6)));
});

test('demo exposes plain SPH as a CPU reference mechanics mode', () => {
  const driver = createSphPhaseDemo({
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 0.85,
    dropParticleEdge: 1,
    baseParticleEdge: 1,
    mechanics: 'sph'
  });
  assert.equal(driver.demo.gpuMechanics.integrator, 'sph');
  driver.step();
  assert.equal(driver.demo.lastStepTiming.backend, 'cpu-reference');
  assert.equal(driver.demo.state.particles.length, 2);
  for (const particle of driver.demo.state.particles) {
    for (const value of particle.x) assert.ok(Number.isFinite(value));
    for (const value of particle.v) assert.ok(Number.isFinite(value));
  }
});

test('demo physical law groups isolate plain SPH mechanics and thermal stages', () => {
  assert.deepEqual(normalizeSphPhysicalLawGroups({
    mechanics: '0',
    gravity: 'false',
    eos: false,
    pressure: 'off',
    thermal: 0,
    reactions: 'no',
    viscosity: '1',
    surfaceTension: true
  }), {
    mechanics: false,
    gravity: false,
    eos: false,
    pressure: false,
    thermal: false,
    reactions: false,
    viscosity: true,
    surfaceTension: true
  });

  const driver = createSphPhaseDemo({
    scenario: createSphPhaseScenario({
      boxDimensionsM: [5, 5, 5],
      wallFaces: { xMin: 450, xMax: 450, yMin: 450, yMax: 450, zMin: 450, zMax: 450 }
    }),
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1,
    dropParticleEdge: 1,
    baseParticleEdge: 1,
    mechanics: 'sph',
    physicalLawGroups: {
      mechanics: false,
      gravity: false,
      eos: false,
      thermal: false,
      reactions: false,
      viscosity: false
    }
  });
  const before = driver.demo.state.particles.map((particle) => ({
    x: [...particle.x],
    v: [...particle.v],
    u: particle.specificInternalEnergyJPerKg
  }));
  const viewState = createSphPhaseViewState(driver);

  assert.equal(driver.demo.gpuMechanics.gravityMPerS2[1], 0);
  assert.equal(driver.demo.initialHydrostaticState.status, 'hydrostatic-initialization-disabled');
  assert.deepEqual(viewState.physicalLawGroups, {
    mechanics: false,
    gravity: false,
    eos: false,
    pressure: true,
    thermal: false,
    reactions: false,
    viscosity: false,
    surfaceTension: false
  });
  assert.deepEqual(viewState.pendingPhysicalLawGroups, []);

  driver.step();

  const after = driver.demo.state.particles.map((particle) => ({
    x: [...particle.x],
    v: [...particle.v],
    u: particle.specificInternalEnergyJPerKg
  }));
  assert.deepEqual(after, before);
  assert.deepEqual(driver.demo.wallHeatLedgerJ, { xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 0 });
  assert.equal(driver.demo.lastStepTiming.physicalLawGroups.mechanics, false);
  assert.equal(driver.demo.lastStepTiming.physicalLawGroups.thermal, false);
});

test('fluid law groups expose implemented viscosity and pending surface tension', () => {
  assert.deepEqual(normalizeSphPhysicalLawGroups({}), {
    mechanics: true,
    gravity: true,
    eos: true,
    pressure: true,
    thermal: true,
    reactions: true,
    viscosity: true,
    surfaceTension: false
  });

  const driver = createSphPhaseDemo({
    scenario: createSphPhaseScenario({
      boxDimensionsM: [5, 5, 5],
      wallFaces: { xMin: 300, xMax: 300, yMin: 300, yMax: 300, zMin: 300, zMax: 300 }
    }),
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1,
    dropParticleEdge: 1,
    baseParticleEdge: 1,
    mechanics: 'mlsmpm',
    physicalLawGroups: {
      thermal: false,
      reactions: false,
      viscosity: true,
      surfaceTension: true
    }
  });
  const viewState = createSphPhaseViewState(driver);
  assert.equal(viewState.physicalLawGroups.viscosity, true);
  assert.equal(viewState.physicalLawGroups.surfaceTension, true);
  assert.deepEqual(viewState.pendingPhysicalLawGroups.map((group) => group.key), ['surfaceTension']);
  driver.step();
  assert.deepEqual(driver.demo.lastStepTiming.pendingPhysicalLawGroups.map((group) => group.key), ['surfaceTension']);
  assert.deepEqual(
    driver.demo.lastStepTiming.unsupportedPhysicalLawGroups,
    driver.demo.lastStepTiming.pendingPhysicalLawGroups
  );
});

test('sealed gas pressure summary derives baseline air pressure from scenario gas closure', () => {
  const demo = buildSphPhaseDemoState({ dropParticleEdge: 1, baseParticleEdge: 1 });
  const pressure = gasPressureSummary(demo);
  assert.equal(pressure.schema, 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0');
  assert.ok(pressure.bySpecies.air.partialPressurePa > 0);
  assert.ok(Math.abs(pressure.totalPressureAtm - 1) < 0.01);
  assert.equal(pressure.pressureFeedback.schema, 'peercompute.ulg.sph-sealed-gas-pressure-feedback.v0');
  assert.equal(pressure.pressureFeedback.status, 'wall-pressure-ledger-ready');
  assert.ok(Math.abs(pressure.pressureFeedback.pressureGaugePa) < 1500);
  assert.equal(pressure.pressureFeedback.gasCellField.schema, 'peercompute.ulg.sph-sealed-gas-pressure-cell-field.v0');
  assert.equal(pressure.pressureFeedback.gasCellField.status, 'gas-cell-pressure-field-ready');
  assert.deepEqual(pressure.pressureFeedback.gasCellField.pressureGradientPaPerM, [0, 0, 0]);
  assert.equal(pressure.pressureFeedback.forceCouplingStatus, 'blocked-material-surface-normals-not-resolved');
  assert.equal(pressure.scientificValidation, false);
});

test('SPH phase view state carries explicit wall temperatures for resident thermal steps', () => {
  const wallFaces = { xMin: 291, xMax: 292, yMin: 293, yMax: 294, zMin: 295, zMax: 296 };
  const demo = buildSphPhaseDemoState({
    scenario: createSphPhaseScenario({ wallFaces }),
    dropParticleEdge: 1,
    baseParticleEdge: 1
  });
  const viewState = createSphPhaseViewState({ demo });

  assert.deepEqual(viewState.wallTemperaturesK, wallFaces);
  assert.deepEqual(viewState.scenario.walls.faces, wallFaces);
});

test('SPH phase view state exposes resolved initial particle spacing', () => {
  const demo = buildSphPhaseDemoState({
    dropParticleEdge: 3,
    baseParticleEdge: 5
  });
  const viewState = createSphPhaseViewState({ demo });

  assert.deepEqual(viewState.counts, demo.counts);
  assert.equal(viewState.initialParticleSpacing.schema, 'peercompute.ulg.sph-initial-particle-spacing-plan.v0');
  assert.equal(viewState.initialParticleSpacing.drop.particlesPerEdge, demo.initialParticleSpacing.drop.particlesPerEdge);
  assert.equal(viewState.initialParticleSpacing.base.particlesPerEdge, demo.initialParticleSpacing.base.particlesPerEdge);
  assert.notEqual(viewState.initialParticleSpacing.drop, demo.initialParticleSpacing.drop);
});

test('resident reaction gas pressure uses GPU ledger moles without particle readback', () => {
  const demo = buildSphPhaseDemoState({ dropParticleEdge: 1, baseParticleEdge: 1 });
  const baseline = gasPressureSummary(demo);
  const reactionSummary = {
    status: 'reaction-compact-summary-ready',
    compactLedgerAvailable: true,
    ledgerGasProductMassKg: 0.002016,
    ledgerUnplacedGasProductMassKg: 0.002016,
    sealedBoxGasProductMoles: 1,
    fullParticleReadbackPerformed: false
  };
  const pressure = gasPressureSummaryFromResidentReaction({
    baselineSummary: baseline,
    reactionSummary,
    reactionTable: {
      gasProductMetadata: [{
        material: 'h2',
        materialId: 1,
        status: 1,
        molarMassKgPerMol: 0.002016
      }]
    },
    materialProperties: demo.materialProperties,
    fallbackTemperatureK: 300
  });

  assert.equal(pressure.schema, 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0');
  assert.equal(pressure.status, 'gpu-resident-reaction-pressure-summary');
  assert.equal(pressure.source, 'gpu-resident-reaction-summary');
  assert.equal(pressure.fullParticleReadbackPerformed, false);
  assert.equal(pressure.bySpecies.h2.moles, 1);
  assert.ok(pressure.bySpecies.h2.partialPressurePa > 0);
  assert.ok(pressure.totalPressurePa > baseline.totalPressurePa);
  assert.equal(pressure.residentGasProductMoles, 1);
  assert.ok(pressure.pressureFeedback.pressureGaugePa > 0);
  assert.ok(pressure.pressureFeedback.totalAbsWallForceN > 0);
  assert.equal(pressure.pressureFeedback.wallLedger[0].role, 'outward-load');
});

test('resident reaction gas pressure uses per-species GPU ledger rows before aggregate fallback', () => {
  const demo = buildSphPhaseDemoState({ dropParticleEdge: 1, baseParticleEdge: 1 });
  const baseline = gasPressureSummary(demo);
  const pressure = gasPressureSummaryFromResidentReaction({
    baselineSummary: baseline,
    reactionSummary: {
      status: 'reaction-compact-summary-ready',
      compactLedgerAvailable: true,
      ledgerGasProductMassKg: 0.005016,
      ledgerUnplacedGasProductMassKg: 0.005016,
      sealedBoxGasProductMoles: 2,
      gasSpeciesLedger: {
        status: 'gas-species-compact-ledger-ready',
        recordCount: 2,
        speciesCount: 2,
        bySpecies: {
          h2: { material: 'h2', materialId: 1, massKg: 0.002016, moles: 1, visibleMassKg: 0, unplacedMassKg: 0.002016 },
          o2: { material: 'o2', materialId: 2, massKg: 0.003, moles: 0.09375, visibleMassKg: 0, unplacedMassKg: 0.003 }
        }
      },
      fullParticleReadbackPerformed: false
    },
    reactionTable: {
      gasProductMetadata: [
        { material: 'h2', materialId: 1, status: 1, molarMassKgPerMol: 0.002016 },
        { material: 'o2', materialId: 2, status: 1, molarMassKgPerMol: 0.032 }
      ]
    },
    materialProperties: demo.materialProperties,
    fallbackTemperatureK: 300
  });

  assert.equal(pressure.status, 'gpu-resident-reaction-pressure-summary');
  assert.equal(pressure.source, 'gpu-resident-reaction-gas-species-summary');
  assert.equal(pressure.fullParticleReadbackPerformed, false);
  assert.equal(pressure.residentGasSpeciesCount, 2);
  assert.equal(pressure.bySpecies.h2.moles, 1);
  assert.equal(pressure.bySpecies.o2.moles, 0.09375);
  assert.ok(pressure.bySpecies.h2.partialPressurePa > pressure.bySpecies.o2.partialPressurePa);
  assert.ok(pressure.totalPressurePa > baseline.totalPressurePa);
  assert.equal(pressure.residentGasProductMoles, undefined);
  assert.ok(pressure.pressureFeedback.totalAbsWallForceN > baseline.pressureFeedback.totalAbsWallForceN);
});

test('resident reaction gas pressure prefers merged resident product-mass gas ledger', () => {
  const demo = buildSphPhaseDemoState({ dropParticleEdge: 1, baseParticleEdge: 1 });
  const baseline = gasPressureSummary(demo);
  const pressure = gasPressureSummaryFromResidentReaction({
    baselineSummary: baseline,
    reactionSummary: {
      status: 'reaction-compact-summary-ready',
      compactLedgerAvailable: true,
      gasSpeciesLedger: {
        status: 'gas-species-compact-ledger-ready',
        bySpecies: {
          h2: { material: 'h2', materialId: 1, massKg: 0.002016, moles: 1, visibleMassKg: 0, unplacedMassKg: 0.002016 }
        }
      },
      fullParticleReadbackPerformed: false
    },
    residentProductMass: {
      status: 'resident-product-mass-merged-gpu-resident',
      gasSpeciesLedgerCount: 2,
      gasSpeciesLedger: {
        schema: 'peercompute.ulg.sph-gpu-reaction-gas-species-summary.v0',
        status: 'gas-species-resident-ledger-ready',
        bySpecies: {
          h2: { material: 'h2', materialId: 1, massKg: 0.006048, moles: 3, visibleMassKg: 0, unplacedMassKg: 0.006048 },
          o2: { material: 'o2', materialId: 2, massKg: 0.032, moles: 1, visibleMassKg: 0, unplacedMassKg: 0.032 }
        }
      }
    },
    materialProperties: demo.materialProperties,
    fallbackTemperatureK: 300
  });

  assert.equal(pressure.status, 'gpu-resident-reaction-pressure-summary');
  assert.equal(pressure.source, 'gpu-resident-product-mass-gas-species-ledger');
  assert.equal(pressure.residentGasSpeciesLedgerSource, 'gpu-resident-product-mass-gas-species-ledger');
  assert.equal(pressure.residentProductMassStatus, 'resident-product-mass-merged-gpu-resident');
  assert.equal(pressure.residentProductMassGasSpeciesLedgerCount, 2);
  assert.equal(pressure.bySpecies.h2.moles, 3);
  assert.equal(pressure.bySpecies.o2.moles, 1);
  assert.ok(pressure.totalPressurePa > baseline.totalPressurePa);
  assert.equal(pressure.pressureFeedback.gasCellField.localPressureGradientReady, false);
  assert.equal(
    pressure.pressureFeedback.gasCellField.residentSpatialGasSpeciesLedgerStatus,
    'blocked-resident-spatial-gas-species-ledger-required'
  );
  assert.ok(
    pressure.pressureFeedback.gasCellField.localPressureGradientBlockers.includes(
      'resident-gas-cell-eos-gradient-not-derived'
    )
  );
});

test('resident product-mass gas ledger carries positioned product events into spatial gas pressure', () => {
  const gasR = 8.314462618;
  const supportVolumeM3 = 4;
  const temperatureK = 300;
  const molesForPressure = (pressurePa) => pressurePa * supportVolumeM3 / (gasR * temperatureK);
  const demo = buildSphPhaseDemoState({ dropParticleEdge: 1, baseParticleEdge: 1 });
  const pressure = gasPressureSummaryFromResidentReaction({
    baselineSummary: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
      status: 'synthetic-baseline',
      totalPressurePa: 0,
      gasVolumeM3: 8,
      condensedVolumeM3: 0,
      boxVolumeM3: 8,
      boxDimsM: [2, 2, 2],
      bySpecies: {}
    },
    reactionSummary: {
      status: 'reaction-compact-summary-ready',
      compactLedgerAvailable: true,
      gasSpeciesLedger: {
        status: 'gas-species-compact-ledger-ready',
        bySpecies: {
          h2: { material: 'h2', materialId: 1, massKg: 0.001, moles: 1, visibleMassKg: 0, unplacedMassKg: 0.001 }
        }
      },
      fullParticleReadbackPerformed: false
    },
    residentProductMass: {
      status: 'resident-product-mass-buffer-retained',
      productEventBufferRetained: true,
      productEventBuffer: { label: 'resident-positioned-product-events' },
      gasSpeciesLedgerCount: 1,
      gasSpeciesLedger: {
        schema: 'peercompute.ulg.sph-gpu-reaction-gas-species-summary.v0',
        status: 'gas-species-resident-ledger-ready',
        bySpecies: {
          h2: {
            material: 'h2',
            materialId: 1,
            massKg: 0.003,
            moles: molesForPressure(300000),
            visibleMassKg: 0,
            unplacedMassKg: 0.003
          }
        }
      },
      productEvents: {
        schema: 'peercompute.ulg.sph-gpu-reaction-product-event-summary.v0',
        status: 'product-event-sparse-storage-ready',
        records: [
          {
            status: 'ready',
            material: 'h2',
            materialId: 1,
            routing: 'gas',
            productTermIndex: 1,
            massKg: 0.001,
            moles: molesForPressure(100000),
            visibleMassKg: 0,
            unplacedMassKg: 0.001,
            temperatureK,
            positionM: [0.5, 1, 1],
            supportVolumeM3
          },
          {
            status: 'ready',
            material: 'h2',
            materialId: 1,
            routing: 'gas',
            productTermIndex: 1,
            massKg: 0.002,
            moles: molesForPressure(200000),
            visibleMassKg: 0,
            unplacedMassKg: 0.002,
            temperatureK,
            positionM: [1.5, 1, 1],
            supportVolumeM3
          }
        ]
      }
    },
    reactionTable: {
      productTermMetadata: [
        { productTermIndex: 1, material: 'h2', routing: 'gas' }
      ]
    },
    materialProperties: demo.materialProperties,
    fallbackTemperatureK: temperatureK
  });

  assert.equal(pressure.status, 'gpu-resident-reaction-pressure-summary');
  assert.equal(pressure.source, 'gpu-resident-product-mass-gas-species-ledger');
  assert.equal(pressure.residentGasSpeciesLedgerSource, 'gpu-resident-product-mass-gas-species-ledger');
  assert.equal(pressure.spatialGasSpeciesLedger.status, 'spatial-gas-species-ledger-ready');
  assert.equal(pressure.spatialGasSpeciesLedger.source, 'gpu-resident-product-mass-product-event-spatial-ledger');
  assert.equal(pressure.spatialGasSpeciesLedger.spatialGasSourceBufferRetained, true);
  assert.deepEqual(pressure.spatialGasSpeciesLedger.retainedSpatialGasSourceBufferRefs, ['resident-product-mass-buffer']);
  assert.equal(pressure.residentSpatialGasSpeciesLedgerStatus, 'spatial-gas-species-ledger-ready');
  assert.equal(pressure.residentProductGasRows.length, 2);
  assert.equal(pressure.pressureFeedback.gasCellField.localPressureGradientReady, true);
  assert.equal(
    pressure.pressureFeedback.gasCellField.residentSpatialGasSpeciesLedgerStatus,
    'resident-spatial-gas-species-ledger-eos-ready'
  );
  near(pressure.pressureFeedback.gasCellField.cells[0].pressurePa, 100000, 1e-6);
  near(pressure.pressureFeedback.gasCellField.cells[1].pressurePa, 200000, 1e-6);
  near(pressure.pressureFeedback.gasCellField.cells[0].pressureGradientPaPerM[0], 100000, 1e-6);
});

test('spatial gas species ledger derives local EOS gas-cell pressure gradients', () => {
  const gasR = 8.314462618;
  const volumeM3 = 4;
  const temperatureK = 300;
  const molesForPressure = (pressurePa) => pressurePa * volumeM3 / (gasR * temperatureK);
  const field = deriveLocalGasCellPressureFieldFromSpatialGasLedger({
    pressureSummary: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
      status: 'synthetic-pressure',
      totalPressurePa: 150000,
      boxVolumeM3: 8,
      boxDimsM: [2, 2, 2],
      spatialGasSpeciesLedger: {
        schema: 'peercompute.ulg.sph-spatial-gas-species-ledger.v0',
        status: 'spatial-gas-species-ledger-ready',
        cellDims: [2, 1, 1],
        cells: [
          {
            gridIndex: [0, 0, 0],
            centerM: [0.5, 1, 1],
            volumeM3,
            species: [
              { material: 'h2', materialId: 1, moles: molesForPressure(100000), temperatureK }
            ]
          },
          {
            gridIndex: [1, 0, 0],
            centerM: [1.5, 1, 1],
            volumeM3,
            species: [
              { material: 'h2', materialId: 1, moles: molesForPressure(200000), temperatureK }
            ]
          }
        ]
      }
    }
  });

  assert.equal(field.status, 'gas-cell-pressure-field-ready');
  assert.equal(field.source, 'resident-spatial-gas-species-ledger-eos');
  assert.equal(field.eosPressureClosure, 'ideal-gas-law-per-cell');
  assert.equal(field.localPressureGradientReady, true);
  assert.equal(field.residentSpatialGasSpeciesLedgerStatus, 'resident-spatial-gas-species-ledger-eos-ready');
  assert.deepEqual(field.retainedSpatialGasSourceBufferRefs, []);
  assert.equal(field.spatialGasSourceBufferRetained, false);
  assert.deepEqual(field.cellDims, [2, 1, 1]);
  assert.equal(field.cellCount, 2);
  near(field.cells[0].pressurePa, 100000, 1e-6);
  near(field.cells[1].pressurePa, 200000, 1e-6);
  near(field.cells[0].pressureGradientPaPerM[0], 100000, 1e-6);
  near(field.cells[1].pressureGradientPaPerM[0], 100000, 1e-6);
  near(field.pressureGradientPaPerM[0], 100000, 1e-6);
});

test('gas pressure feedback consumes spatial gas-cell EOS gradients without aggregate fabrication', () => {
  const gasR = 8.314462618;
  const volumeM3 = 4;
  const temperatureK = 300;
  const molesForPressure = (pressurePa) => pressurePa * volumeM3 / (gasR * temperatureK);
  const pressureSummary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'synthetic-pressure',
    totalPressurePa: 150000,
    boxVolumeM3: 8,
    boxDimsM: [2, 2, 2],
    bySpecies: {
      h2: {
        material: 'h2',
        moles: molesForPressure(300000),
        temperatureK,
        partialPressurePa: 150000
      }
    },
    spatialGasSpeciesLedger: {
      schema: 'peercompute.ulg.sph-spatial-gas-species-ledger.v0',
      status: 'spatial-gas-species-ledger-ready',
      cellDims: [2, 1, 1],
      cells: [
        {
          gridIndex: [0, 0, 0],
          centerM: [0.5, 1, 1],
          volumeM3,
          species: [{ material: 'h2', moles: molesForPressure(100000), temperatureK }]
        },
        {
          gridIndex: [1, 0, 0],
          centerM: [1.5, 1, 1],
          volumeM3,
          species: [{ material: 'h2', moles: molesForPressure(200000), temperatureK }]
        }
      ]
    }
  };
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 1,
    elementCount: 1,
    elements: [
      {
        surfaceIndex: 0,
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        centroidM: [0.6, 1, 1],
        areaM2: 1,
        normal: [1, 0, 0],
        normalAreaVectorM2: [1, 0, 0],
        status: 'interface-element-ready'
      }
    ]
  };
  const feedback = gasPressureFeedbackSummary({ pressureSummary, materialInterfaceField });
  const solver = gasPressureInterfaceForceSolver({
    pressureFeedback: feedback,
    materialInterfaceField,
    pressureInterfaceCoupling: feedback.pressureInterfaceCoupling
  });

  assert.equal(feedback.gasCellField.localPressureGradientReady, true);
  assert.equal(feedback.gasCellField.source, 'resident-spatial-gas-species-ledger-eos');
  assert.equal(feedback.gasCellField.residentSpatialGasSpeciesLedgerStatus, 'resident-spatial-gas-species-ledger-eos-ready');
  assert.equal(solver.forceResolution, 'local-gradient-interface-traction');
  assert.equal(solver.forceRows[0].pressureSource, 'local-gas-cell-nearest-gradient-reconstruction');
  near(solver.forceRows[0].pressurePa, 110000, 1e-6);
});

test('resident reaction gas pressure can derive gas from product-event rows', () => {
  const demo = buildSphPhaseDemoState({ dropParticleEdge: 1, baseParticleEdge: 1 });
  const baseline = gasPressureSummary(demo);
  const pressure = gasPressureSummaryFromResidentReaction({
    baselineSummary: baseline,
    reactionSummary: {
      status: 'reaction-compact-summary-ready',
      compactLedgerAvailable: true,
      productEvents: {
        status: 'product-event-sparse-storage-ready',
        records: [
          {
            status: 'ready',
            material: 'h2',
            materialId: 1,
            routing: 'gas',
            productTermIndex: 1,
            massKg: 0.004032,
            moles: 2,
            visibleMassKg: 0.002016,
            unplacedMassKg: 0.002016,
            temperatureK: 420
          },
          {
            status: 'ready',
            material: 'naoh',
            materialId: 2,
            routing: 'condensed',
            productTermIndex: 2,
            massKg: 0.1,
            moles: 1,
            visibleMassKg: 0.1,
            unplacedMassKg: 0
          }
        ]
      },
      fullParticleReadbackPerformed: false
    },
    reactionTable: {
      productTermMetadata: [
        { productTermIndex: 1, material: 'h2', routing: 'gas' },
        { productTermIndex: 2, material: 'naoh', routing: 'condensed' }
      ]
    },
    materialProperties: demo.materialProperties,
    fallbackTemperatureK: 300
  });

  assert.equal(pressure.status, 'gpu-resident-reaction-pressure-summary');
  assert.equal(pressure.source, 'gpu-resident-reaction-product-events');
  assert.equal(pressure.fullParticleReadbackPerformed, false);
  assert.equal(pressure.residentProductGasRowCount, 1);
  assert.equal(pressure.bySpecies.h2.moles, 2);
  assert.equal(pressure.bySpecies.h2.temperatureK, 420);
  assert.equal(pressure.bySpecies.naoh, undefined);
  assert.ok(pressure.bySpecies.h2.partialPressurePa > 0);
  assert.ok(pressure.totalPressurePa > baseline.totalPressurePa);
  assert.equal(pressure.residentSpatialGasSpeciesLedgerStatus, 'blocked-resident-spatial-gas-species-ledger-required');
  assert.equal(pressure.pressureFeedback.gasCellField.localPressureGradientReady, false);
});

test('resident positioned gas product events produce spatial gas-cell EOS pressure field', () => {
  const gasR = 8.314462618;
  const supportVolumeM3 = 4;
  const temperatureK = 300;
  const molesForPressure = (pressurePa) => pressurePa * supportVolumeM3 / (gasR * temperatureK);
  const pressure = gasPressureSummaryFromResidentReaction({
    baselineSummary: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
      status: 'synthetic-baseline',
      totalPressurePa: 0,
      gasVolumeM3: 8,
      condensedVolumeM3: 0,
      boxVolumeM3: 8,
      boxDimsM: [2, 2, 2],
      bySpecies: {}
    },
    reactionSummary: {
      status: 'reaction-compact-summary-ready',
      compactLedgerAvailable: true,
      productEventBufferRetained: true,
      productEventBuffer: { label: 'resident-positioned-product-events' },
      productEvents: {
        status: 'product-event-sparse-storage-ready',
        records: [
          {
            status: 'ready',
            material: 'h2',
            materialId: 1,
            routing: 'gas',
            productTermIndex: 1,
            massKg: 0.001,
            moles: molesForPressure(100000),
            visibleMassKg: 0,
            unplacedMassKg: 0.001,
            temperatureK,
            positionM: [0.5, 1, 1],
            supportVolumeM3
          },
          {
            status: 'ready',
            material: 'h2',
            materialId: 1,
            routing: 'gas',
            productTermIndex: 1,
            massKg: 0.002,
            moles: molesForPressure(200000),
            visibleMassKg: 0,
            unplacedMassKg: 0.002,
            temperatureK,
            positionM: [1.5, 1, 1],
            supportVolumeM3
          }
        ]
      },
      fullParticleReadbackPerformed: false
    },
    reactionTable: {
      productTermMetadata: [
        { productTermIndex: 1, material: 'h2', routing: 'gas' }
      ]
    },
    materialProperties: {},
    fallbackTemperatureK: temperatureK
  });

  assert.equal(pressure.status, 'gpu-resident-reaction-pressure-summary');
  assert.equal(pressure.source, 'gpu-resident-reaction-product-events');
  assert.equal(pressure.spatialGasSpeciesLedger.status, 'spatial-gas-species-ledger-ready');
  assert.equal(pressure.spatialGasSpeciesLedger.source, 'gpu-resident-reaction-product-event-spatial-ledger');
  assert.equal(pressure.spatialGasSpeciesLedger.spatialGasSourceBufferRetained, true);
  assert.deepEqual(pressure.spatialGasSpeciesLedger.retainedSpatialGasSourceBufferRefs, ['resident-product-mass-buffer']);
  assert.deepEqual(pressure.retainedSpatialGasSourceBufferRefs, ['resident-product-mass-buffer']);
  assert.equal(pressure.residentSpatialGasSpeciesLedgerStatus, 'spatial-gas-species-ledger-ready');
  assert.equal(pressure.pressureFeedback.gasCellField.localPressureGradientReady, true);
  assert.equal(
    pressure.pressureFeedback.gasCellField.residentSpatialGasSpeciesLedgerStatus,
    'resident-spatial-gas-species-ledger-eos-ready'
  );
  assert.equal(pressure.pressureFeedback.gasCellField.spatialGasSourceBufferRetained, true);
  assert.deepEqual(pressure.pressureFeedback.gasCellField.retainedSpatialGasSourceBufferRefs, ['resident-product-mass-buffer']);
  assert.equal(pressure.pressureFeedback.gasCellField.cellCount, 2);
  near(pressure.pressureFeedback.gasCellField.cells[0].pressurePa, 100000, 1e-6);
  near(pressure.pressureFeedback.gasCellField.cells[1].pressurePa, 200000, 1e-6);
  near(pressure.pressureFeedback.gasCellField.cells[0].pressureGradientPaPerM[0], 100000, 1e-6);
});

test('resident reaction gas pressure falls back to compact product inventory when events stay resident', () => {
  const demo = buildSphPhaseDemoState({ dropParticleEdge: 1, baseParticleEdge: 1 });
  const baseline = gasPressureSummary(demo);
  const pressure = gasPressureSummaryFromResidentReaction({
    baselineSummary: baseline,
    reactionSummary: {
      status: 'reaction-compact-summary-ready',
      compactLedgerAvailable: true,
      productEvents: {
        status: 'product-event-sparse-storage-gpu-resident',
        records: []
      },
      productInventory: {
        status: 'product-inventory-compact-ledger-ready',
        records: [
          {
            status: 'ready',
            material: 'h2',
            materialId: 1,
            routing: 'gas',
            productTermIndex: 1,
            massKg: 0.002016,
            moles: 1,
            visibleMassKg: 0,
            unplacedMassKg: 0.002016
          },
          {
            status: 'ready',
            material: 'naoh',
            materialId: 2,
            routing: 'condensed',
            productTermIndex: 2,
            massKg: 0.04,
            moles: 1,
            visibleMassKg: 0.04,
            unplacedMassKg: 0
          }
        ]
      },
      fullParticleReadbackPerformed: false
    },
    reactionTable: {
      productTermMetadata: [
        { productTermIndex: 1, material: 'h2', routing: 'gas' },
        { productTermIndex: 2, material: 'naoh', routing: 'condensed' }
      ]
    },
    materialProperties: demo.materialProperties,
    fallbackTemperatureK: 300
  });

  assert.equal(pressure.status, 'gpu-resident-reaction-pressure-summary');
  assert.equal(pressure.source, 'gpu-resident-reaction-product-inventory');
  assert.equal(pressure.fullParticleReadbackPerformed, false);
  assert.equal(pressure.residentProductGasRowCount, 1);
  assert.equal(pressure.bySpecies.h2.moles, 1);
  assert.equal(pressure.bySpecies.naoh, undefined);
  assert.ok(pressure.bySpecies.h2.partialPressurePa > 0);
  assert.ok(pressure.totalPressurePa > baseline.totalPressurePa);
});

test('sealed gas pressure feedback derives per-wall gauge loads from box dimensions', () => {
  const baseline = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'synthetic-baseline',
    totalPressurePa: 101325,
    gasVolumeM3: 100,
    condensedVolumeM3: 0,
    boxVolumeM3: 100,
    boxDimsM: [10, 5, 2],
    bySpecies: {
      air: { material: 'air', massKg: 0, moles: 4062.3, temperatureK: 300, partialPressurePa: 101325 }
    },
    pressureFeedback: { totalAbsWallForceN: 0 }
  };
  const boosted = gasPressureSummaryFromResidentReaction({
    baselineSummary: baseline,
    reactionSummary: {
      status: 'reaction-compact-summary-ready',
      compactLedgerAvailable: true,
      gasSpeciesLedger: {
        bySpecies: {
          h2: { material: 'h2', massKg: 2.016, moles: 1000, visibleMassKg: 0, unplacedMassKg: 2.016 }
        }
      },
      fullParticleReadbackPerformed: false
    },
    materialProperties: {},
    fallbackTemperatureK: 300
  });

  assert.deepEqual(boosted.pressureFeedback.boxDimsM, [10, 5, 2]);
  assert.equal(boosted.pressureFeedback.wallLedger.find((row) => row.faceId === 'xMin').areaM2, 10);
  assert.equal(boosted.pressureFeedback.wallLedger.find((row) => row.faceId === 'yMin').areaM2, 20);
  assert.equal(boosted.pressureFeedback.wallLedger.find((row) => row.faceId === 'zMin').areaM2, 50);
  assert.ok(boosted.pressureFeedback.pressureGaugePa > 0);
  assert.ok(Math.abs(boosted.pressureFeedback.netForceN[0]) < 1e-6);
  assert.equal(boosted.pressureFeedback.gasCellField.status, 'gas-cell-pressure-field-ready');
  assert.equal(boosted.pressureFeedback.gasCellField.gradientStatus, 'uniform-sealed-gas-pressure-zero-gradient');
  assert.equal(boosted.pressureFeedback.gasCellField.pressureFieldMode, 'uniform-single-cell-sealed-gas');
  assert.equal(boosted.pressureFeedback.gasCellField.pressureFieldResolution, 'lumped-sealed-box');
  assert.equal(boosted.pressureFeedback.gasCellField.localPressureGradientReady, false);
  assert.equal(boosted.pressureFeedback.gasCellField.localPressureGradientStatus, 'blocked-uniform-single-cell-field-has-no-local-gradient');
  assert.equal(boosted.pressureFeedback.gasCellField.localPressureGradientForceCouplingStatus, 'blocked-local-pressure-gradient-field-required');
  assert.ok(boosted.pressureFeedback.gasCellField.localPressureGradientBlockers.includes('resident-gas-cell-eos-gradient-not-derived'));
  assert.deepEqual(boosted.pressureFeedback.gasCellField.cellDims, [1, 1, 1]);
  assert.equal(boosted.pressureFeedback.gasCellField.uniformPressurePa, boosted.totalPressurePa);
  assert.equal(boosted.pressureFeedback.pressureFieldMode, 'uniform-single-cell-sealed-gas');
  assert.equal(boosted.pressureFeedback.localPressureGradientReady, false);
  assert.ok(boosted.pressureFeedback.forceCouplingPrerequisites.includes('material-surface-normals-and-areas'));
  assert.equal(boosted.pressureFeedback.forceCouplingStatus, 'blocked-material-surface-normals-not-resolved');
  assert.equal(boosted.pressureFeedback.forceCouplingValidation, false);

  const blocked = gasPressureSummaryFromResidentReaction({
    baselineSummary: baseline,
    reactionSummary: {
      status: 'reaction-compact-summary-ready',
      compactLedgerAvailable: true,
      gasSpeciesLedger: {
        bySpecies: {
          h2: { material: 'h2', massKg: 2.016, moles: 1000, visibleMassKg: 0, unplacedMassKg: 2.016 }
        }
      },
      strictReactionGate: {
        status: 'strict-reaction-gate-blocked',
        blockers: ['provisional-energetics-not-strict']
      },
      fullParticleReadbackPerformed: false
    },
    materialProperties: {},
    fallbackTemperatureK: 300
  });
  assert.equal(blocked.pressureFeedback.forceCouplingStatus, 'blocked-strict-reaction-gate');
  assert.deepEqual(blocked.pressureFeedback.strictReactionGateBlockers, ['provisional-energetics-not-strict']);
});

test('gas pressure interface coupling requires material surfaces but does not apply forces', () => {
  const pressureSummary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'synthetic-pressure',
    totalPressurePa: 120000,
    boxVolumeM3: 100,
    boxDimsM: [10, 5, 2],
    bySpecies: {},
    strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] }
  };
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 2,
    readySurfaceCount: 2,
    totalSurfaceAreaM2: 4.25
  };
  const feedback = gasPressureFeedbackSummary({
    pressureSummary,
    materialInterfaceField
  });

  assert.equal(feedback.pressureInterfaceCoupling.schema, 'peercompute.ulg.sph-pressure-interface-coupling.v0');
  assert.equal(feedback.pressureInterfaceCoupling.status, 'pressure-interface-coupling-ready-for-solver');
  assert.equal(feedback.pressureInterfaceCoupling.materialInterfaceReadySurfaceCount, 2);
  assert.equal(feedback.pressureInterfaceCoupling.materialInterfaceTotalSurfaceAreaM2, 4.25);
  assert.equal(feedback.pressureInterfaceCoupling.pressureFieldMode, 'uniform-single-cell-sealed-gas');
  assert.equal(feedback.pressureInterfaceCoupling.pressureFieldResolution, 'lumped-sealed-box');
  assert.equal(feedback.pressureInterfaceCoupling.localPressureGradientReady, false);
  assert.equal(feedback.pressureInterfaceCoupling.localPressureGradientStatus, 'blocked-uniform-single-cell-field-has-no-local-gradient');
  assert.equal(feedback.pressureInterfaceCoupling.localPressureGradientForceCouplingStatus, 'blocked-local-pressure-gradient-field-required');
  assert.equal(feedback.pressureInterfaceCoupling.forceCouplingStatus, 'blocked-pressure-force-solver-not-implemented');
  assert.equal(feedback.forceCouplingStatus, 'blocked-pressure-force-solver-not-implemented');
  assert.equal(feedback.forceCouplingValidation, false);
  assert.equal(feedback.pressureInterfaceCoupling.forceCouplingValidation, false);

  const strictBlockedFeedback = gasPressureFeedbackSummary({
    pressureSummary: {
      ...pressureSummary,
      strictReactionGate: {
        status: 'strict-reaction-gate-blocked',
        blockers: ['provisional-energetics-not-strict']
      }
    },
    materialInterfaceField
  });
  assert.equal(strictBlockedFeedback.pressureInterfaceCoupling.status, 'pressure-interface-coupling-blocked');
  assert.equal(strictBlockedFeedback.forceCouplingStatus, 'blocked-strict-reaction-gate');
  assert.deepEqual(strictBlockedFeedback.pressureInterfaceCoupling.strictReactionGateBlockers, ['provisional-energetics-not-strict']);

  const directBlocked = gasPressureInterfaceCouplingSummary({
    pressureFeedback: feedback,
    materialInterfaceField: {
      ...materialInterfaceField,
      readySurfaceCount: 0,
      totalSurfaceAreaM2: 0
    }
  });
  assert.equal(directBlocked.forceCouplingStatus, 'blocked-material-surface-normals-not-resolved');
});

test('gas pressure interface force preview computes tractions without applying them', () => {
  const pressureSummary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'synthetic-pressure',
    totalPressurePa: 100000,
    boxVolumeM3: 8,
    boxDimsM: [2, 2, 2],
    bySpecies: {},
    strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] }
  };
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normal: [1, 0, 0],
        normalAreaVectorM2: [1, 0, 0],
        status: 'interface-element-ready'
      },
      {
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normal: [-1, 0, 0],
        normalAreaVectorM2: [-1, 0, 0],
        status: 'interface-element-ready'
      }
    ]
  };
  const pressureFeedback = gasPressureFeedbackSummary({ pressureSummary, materialInterfaceField });
  const preview = gasPressureInterfaceForcePreview({
    pressureFeedback,
    materialInterfaceField,
    pressureInterfaceCoupling: pressureFeedback.pressureInterfaceCoupling
  });

  assert.equal(preview.schema, 'peercompute.ulg.sph-pressure-interface-force-preview.v0');
  assert.equal(preview.status, 'pressure-interface-force-preview-ready');
  assert.equal(preview.forceApplicationStatus, 'not-applied-diagnostic-preview');
  assert.equal(preview.gasInterfacePressurePa, 100000);
  assert.equal(preview.pressureFieldMode, 'uniform-single-cell-sealed-gas');
  assert.equal(preview.pressureFieldResolution, 'lumped-sealed-box');
  assert.equal(preview.pressureGradientStatus, 'uniform-sealed-gas-pressure-zero-gradient');
  assert.equal(preview.localPressureGradientReady, false);
  assert.equal(preview.localPressureGradientForceCouplingStatus, 'blocked-local-pressure-gradient-field-required');
  assert.equal(preview.forceResolution, 'uniform-interface-traction');
  assert.equal(preview.previewedElementCount, 2);
  assert.equal(preview.surfaceForceCount, 1);
  assert.equal(preview.totalAbsInterfaceForceN, 200000);
  assert.deepEqual(preview.netForceN, [0, 0, 0]);
  assert.deepEqual(preview.surfaceForces[0].netForceN, [0, 0, 0]);
  assert.equal(preview.forceCouplingValidation, false);

  const solver = gasPressureInterfaceForceSolver({
    pressureFeedback,
    materialInterfaceField,
    pressureInterfaceCoupling: pressureFeedback.pressureInterfaceCoupling
  });

  assert.equal(solver.schema, 'peercompute.ulg.sph-pressure-interface-force-solver.v0');
  assert.equal(solver.status, 'pressure-interface-force-solver-ready');
  assert.equal(solver.forceApplicationStatus, 'solver-ready-not-applied');
  assert.equal(solver.forceCouplingStatus, 'pressure-force-solver-ready-not-applied');
  assert.equal(solver.pressureFieldMode, 'uniform-single-cell-sealed-gas');
  assert.equal(solver.pressureFieldResolution, 'lumped-sealed-box');
  assert.equal(solver.pressureGradientStatus, 'uniform-sealed-gas-pressure-zero-gradient');
  assert.equal(solver.localPressureGradientReady, false);
  assert.equal(solver.localPressureGradientStatus, 'blocked-uniform-single-cell-field-has-no-local-gradient');
  assert.deepEqual(solver.localPressureGradientBlockers, [
    'single-cell-uniform-pressure-field',
    'resident-gas-cell-eos-gradient-not-derived'
  ]);
  assert.equal(solver.localPressureGradientForceCouplingStatus, 'blocked-local-pressure-gradient-field-required');
  assert.equal(solver.forceResolution, 'uniform-interface-traction');
  assert.equal(solver.forceRowCount, 2);
  assert.equal(solver.forceRowStrideFloats, 16);
  assert.equal(solver.forceRowValues.length, 32);
  assert.deepEqual(solver.forceRows[0].materialForceN, [-100000, 0, 0]);
  assert.deepEqual(solver.forceRows[0].gasReactionForceN, [100000, 0, 0]);
  assert.deepEqual(solver.forceRows[1].materialForceN, [100000, 0, 0]);
  assert.deepEqual(solver.netMaterialForceN, [0, 0, 0]);
  assert.deepEqual(solver.netGasReactionForceN, [0, 0, 0]);
  assert.deepEqual(solver.conservationResidualN, [0, 0, 0]);
  assert.equal(solver.maxPairResidualN, 0);
  assert.equal(solver.conservationStatus, 'pairwise-equal-opposite-force-conservative');
  assert.equal(solver.forceApplicationTarget, 'pending-mls-mpm-grid-force-consumer');
  assert.equal(solver.forceCouplingValidation, false);

  const blocked = gasPressureInterfaceForcePreview({
    pressureFeedback,
    materialInterfaceField: { ...materialInterfaceField, elements: [], elementCount: 0 }
  });
  assert.equal(blocked.status, 'pressure-interface-force-preview-blocked');
  assert.equal(blocked.previewedElementCount, 0);

  const blockedSolver = gasPressureInterfaceForceSolver({
    pressureFeedback,
    materialInterfaceField: { ...materialInterfaceField, elements: [], elementCount: 0 }
  });
  assert.equal(blockedSolver.status, 'pressure-interface-force-solver-blocked');
  assert.equal(blockedSolver.forceRowCount, 0);
});

test('gas pressure interface solver samples local gas-cell pressure gradients', () => {
  const pressureSummary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'synthetic-pressure',
    totalPressurePa: 100000,
    boxVolumeM3: 8,
    boxDimsM: [2, 2, 2],
    bySpecies: {},
    strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] },
    gasCellField: {
      localPressureGradientReady: true,
      cellDims: [2, 1, 1],
      cells: [
        {
          gridIndex: [0, 0, 0],
          centerM: [0.5, 1, 1],
          pressurePa: 100000,
          pressureGradientPaPerM: [1000, 0, 0],
          volumeM3: 4
        },
        {
          gridIndex: [1, 0, 0],
          centerM: [1.5, 1, 1],
          pressurePa: 200000,
          pressureGradientPaPerM: [0, 0, 0],
          volumeM3: 4
        }
      ]
    }
  };
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.6, 1, 1],
        areaM2: 1,
        normal: [1, 0, 0],
        normalAreaVectorM2: [1, 0, 0],
        status: 'interface-element-ready'
      },
      {
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normal: [-1, 0, 0],
        normalAreaVectorM2: [-1, 0, 0],
        status: 'interface-element-ready'
      }
    ]
  };
  const pressureFeedback = gasPressureFeedbackSummary({ pressureSummary, materialInterfaceField });
  const solver = gasPressureInterfaceForceSolver({
    pressureFeedback,
    materialInterfaceField,
    pressureInterfaceCoupling: pressureFeedback.pressureInterfaceCoupling
  });

  assert.equal(pressureFeedback.gasCellField.pressureFieldMode, 'local-gas-cell-pressure-gradient');
  assert.equal(pressureFeedback.gasCellField.localPressureGradientReady, true);
  assert.equal(pressureFeedback.gasCellField.cellCount, 2);
  assert.equal(solver.status, 'pressure-interface-force-solver-ready');
  assert.equal(solver.forceResolution, 'local-gradient-interface-traction');
  assert.equal(solver.localPressureGradientValidation, true);
  assert.deepEqual(solver.gasInterfacePressureRangePa, [100100, 200000]);
  assert.equal(solver.forceRows[0].pressureSource, 'local-gas-cell-nearest-gradient-reconstruction');
  assert.equal(solver.forceRows[0].pressurePa, 100100);
  assert.equal(solver.forceRows[1].pressurePa, 200000);
  assert.deepEqual(solver.forceRows[0].materialForceN, [-100100, 0, 0]);
  assert.deepEqual(solver.forceRows[1].materialForceN, [200000, 0, 0]);
  assert.equal(solver.conservationStatus, 'pairwise-equal-opposite-force-conservative');
});

test('particle render descriptors preserve simulation material and closure phase', () => {
  const demo = buildSphPhaseDemoState();
  const descriptors = particleRenderDescriptors(demo);
  const ice = descriptors.find((d) => d.material === 'h2o');
  const iron = descriptors.find((d) => d.material === 'fe');
  assert.equal(ice.phase, 'solid');
  assert.equal(ice.renderKey, 'ice');
  assert.equal(iron.phase, 'liquid');
  assert.equal(iron.renderKey, 'fe');
});

test('steam render descriptors carry sealed-box vapor optical state', () => {
  const demo = buildSphPhaseDemoState({ dropParticleEdge: 1, baseParticleEdge: 1 });
  const water = demo.state.particles.find((particle) => particle.material === 'h2o');
  water.specificInternalEnergyJPerKg = specificInternalEnergyJPerKg(demo.materialProperties.h2o, 450);
  const pressure = gasPressureSummary(demo);
  const descriptors = particleRenderDescriptors(demo, { gasPressure: pressure });
  const steam = descriptors.find((descriptor) => descriptor.material === 'h2o' && descriptor.phase === 'gas');

  assert.equal(pressure.bySpecies.h2o.material, 'h2o');
  assert.equal(steam.renderKey, 'steam');
  assert.ok(steam.opticalState.temperatureK > 373);
  assert.equal(steam.opticalState.model, 'h2o-vapor-condensation-optical-state-v0');
  assert.equal(steam.opticalState.formula, 'h2o');
  assert.equal(steam.opticalState.phase, 'gas');
  assert.equal(steam.opticalState.dropletRadiusM, 1e-6);
  assert.equal(steam.opticalState.source, undefined);
  assert.ok(Math.abs(steam.opticalState.h2oPartialPressurePa - pressure.bySpecies.h2o.partialPressurePa) / pressure.bySpecies.h2o.partialPressurePa < 0.001);
  assert.ok(Math.abs(steam.opticalState.pressurePa - pressure.totalPressurePa) / pressure.totalPressurePa < 0.001);
  assert.ok(steam.opticalState.saturationPressurePa > 0);
  assert.match(steam.opticalState.microphysicsStatus, /vapor|droplets/);
  assert.equal(descriptors.some((descriptor) => descriptor.material === 'h2o' && descriptor.phase !== 'gas' && descriptor.opticalState), false);
});

test('water vapor optical state derives condensation microphysics from gas pressure', () => {
  const temperatureK = 293.15;
  const saturated = waterVaporOpticalStateFromGasSummary({
    totalPressurePa: 101325,
    bySpecies: {
      h2o: {
        material: 'h2o',
        massKg: 0,
        moles: 1,
        temperatureK,
        partialPressurePa: 3000
      }
    }
  });
  const dry = waterVaporOpticalStateFromGasSummary({
    totalPressurePa: 101325,
    bySpecies: {
      h2o: {
        material: 'h2o',
        massKg: 0,
        moles: 1,
        temperatureK,
        partialPressurePa: 100
      }
    }
  });

  assert.equal(saturated.model, 'h2o-vapor-condensation-optical-state-v0');
  assert.equal(saturated.generator, 'clausius-clapeyron-droplet-scattering-v0:sealed-box-gas-summary-v0');
  assert.equal(saturated.microphysicsStatus, 'supersaturated-condensed-droplets');
  assert.ok(saturated.condensedMassFraction > 0);
  assert.ok(saturated.scatteringCoefficientPerM > 0);
  assert.equal(dry.microphysicsStatus, 'subsaturated-pure-vapor');
  assert.equal(dry.condensedMassFraction, 0);
  assert.equal(dry.scatteringCoefficientPerM, 0);
});

test('demo driver: preflight feasible, stepping stays bounded and finite', () => {
  const driver = createSphPhaseDemo();
  const pre = driver.preflight();
  assert.equal(pre.feasibility.feasible, true);
  assert.equal(pre.closureBacked, true);
  for (let i = 0; i < 5; i += 1) driver.step();
  assert.equal(driver.demo.lastStepTiming.schema, 'peercompute.ulg.sph-cpu-driver-step-timing.v0');
  assert.ok(Number.isFinite(driver.demo.lastStepTiming.totalMs));
  assert.ok(Number.isFinite(driver.demo.lastStepTiming.mechanicsActiveGridNodes.mean));
  assert.ok(driver.demo.lastStepTiming.mechanicsActiveGridNodes.max >= driver.demo.lastStepTiming.mechanicsActiveGridNodes.mean);
  for (const key of ['mechanics', 'thermal', 'reaction', 'wallClamp']) {
    assert.ok(Number.isFinite(driver.demo.lastStepTiming.stageMs[key]), `${key} timing should be finite`);
  }
  const totals = driver.totals();
  assert.ok(Number.isFinite(totals.totalEnergyJ));
  assert.ok(Number.isFinite(totals.momentumMagnitudeKgMPerS));
  // Display safeguards keep every particle inside the sealed box.
  for (const p of driver.demo.state.particles) {
    for (let d = 0; d < 3; d += 1) {
      assert.ok(p.x[d] >= 0 && p.x[d] <= driver.demo.box.edgeM);
    }
  }
});
