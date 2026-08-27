import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  buildSphPhaseDemoState,
  createSphPhaseDemo,
  deriveSphPhaseInitialBaseBlockEdgeM,
  gasPressureFeedbackSummary,
  deriveLocalGasCellPressureFieldFromSpatialGasLedger,
  gasPressureInterfaceForcePreview,
  gasPressureInterfaceForceSolver,
  gasPressureInterfaceCouplingSummary,
  gasPressureSummary,
  gasPressureSummaryFromResidentReaction,
  gasPressureSummaryFromResidentThermalPhase,
  particleRenderDescriptors,
  particleThermalState,
  phaseMassSummary,
  normalizeSphPhysicalLawGroups,
  pendingSphPhysicalLawGroups,
  resolveSphSurfaceTensionLawAdmission,
  waterVaporOpticalStateFromGasSummary
} from '../src/runtime/sphPhaseDemo.js';
import { createSphPhaseScenario } from '../src/runtime/thermoPreflight.js';
import { createSphPhaseViewState } from '../src/runtime/sphPhaseViewState.js';
import { createDerivedMaterialClosure, deriveMaterialProperties } from '../src/runtime/material/materialDerivation.js';
import { materialDerivationSummary } from '../src/runtime/material/propertyProvenance.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';
import {
  buildSphGpuParticleBuffers,
  buildMlsMpmGpuParticleBuffers,
  decodeMlsMpmGpuParticleRows
} from '../src/runtime/sph/sphGpuBuffers.js';

function near(actual, expected, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
}

test('demo default builds with reference-anchored derived material closures', () => {
  const demo = buildSphPhaseDemoState();
  assert.ok(demo.counts.total > 0);
  for (const key of ['fe', 'h2o', 'air']) {
    const properties = demo.materialProperties[key];
    const summary = materialDerivationSummary(properties);
    // Anchored materials may carry reference fallbacks, but only from the
    // material reference bank; everything else stays first-principles.
    const fallbackSources = new Set(
      (properties.propertyProvenance?.entries || [])
        .filter((entry) => ['reference-fallback', 'reduced-estimate', 'blocked'].includes(entry.status))
        .map((entry) => entry.source)
    );
    for (const source of fallbackSources) {
      assert.equal(source, 'material-property-reference-bank');
    }
    assert.equal(summary.hasReducedEstimates, false);
  }
  // The anchoring must land the known reference boundaries.
  const h2o = demo.materialProperties.h2o;
  const boiling = h2o.transitions.find((t) => t.to === 'gas');
  const melting = h2o.transitions.find((t) => t.to === 'liquid');
  assert.ok(Math.abs(melting.temperatureK - 273.15) < 0.01);
  assert.ok(Math.abs(boiling.temperatureK - 373.15) < 0.01);
  assert.ok(Math.abs(boiling.latentHeatJPerKg - 2256000) < 1);
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
    const properties = demo.materialProperties[key];
    const summary = materialDerivationSummary(properties);
    const fallbackSources = new Set(
      (properties.propertyProvenance?.entries || [])
        .filter((entry) => ['reference-fallback', 'reduced-estimate', 'blocked'].includes(entry.status))
        .map((entry) => entry.source)
    );
    for (const source of fallbackSources) {
      assert.equal(source, 'material-property-reference-bank');
    }
    assert.equal(summary.hasReducedEstimates, false);
  }
});

test('elemental fluorine selection resolves to ambient F2 gas for phase and reactions', () => {
  const fluorine = deriveMaterialProperties('F');
  assert.equal(fluorine.formula, 'F2');
  assert.equal(fluorine.idealGas, true);
  assert.deepEqual(fluorine.phases.map((phase) => phase.name), ['gas']);

  const demo = buildSphPhaseDemoState({
    dropMaterial: 'F',
    baseMaterial: 'Cs',
    dropTemperatureK: 293.15,
    baseTemperatureK: 293.15,
    dropParticleEdge: 1,
    baseParticleEdge: 1,
    adaptiveParticleSpacing: false
  });
  assert.equal(demo.materialProperties.F.formula, 'F2');
  assert.equal(demo.materialProperties.F.idealGas, true);
  assert.ok(demo.initialParticleSpacing.drop.densityKgPerM3 < 20);
  assert.ok(demo.initialParticleSpacing.base.densityKgPerM3 > demo.initialParticleSpacing.drop.densityKgPerM3 * 100);

  const summary = phaseMassSummary(demo);
  assert.ok(summary.byMaterialPhase.F.gas > 0);
  assert.equal(summary.byMaterialPhase.F.solid ?? 0, 0);
  assert.equal(summary.solidFractionByMaterial.F, 0);

  const driver = createSphPhaseDemo({
    allowFixtureMaterialProperties: true,
    dropMaterial: 'F',
    baseMaterial: 'Cs',
    dropTemperatureK: 293.15,
    baseTemperatureK: 293.15,
    dropParticleEdge: 1,
    baseParticleEdge: 1,
    adaptiveParticleSpacing: false
  });
  assert.equal(driver.demo.reactions.length, 1);
  assert.equal(driver.demo.reactions[0].product, 'csf');
  assert.equal(driver.demo.reactions[0].stoichiometry.equation, '2 Cs + F2 -> 2 CsF');
  assert.equal(driver.demo.reactions[0].sedenionScope.reactiveClass, 'reactive');
});

test('demo initial state: hot molten-iron block on a cold ice block', () => {
  const demo = buildSphPhaseDemoState();
  assert.ok(demo.counts.drop > 0 && demo.counts.base > 0);
  // Total includes the reserved zero-mass spare slots that GPU product-event
  // placement claims when reactions emit gas products (task #6 item 3).
  assert.ok(demo.counts.spareProductSlots >= 8);
  const lineageCapacity = demo.counts.drop
    + demo.counts.base
    + demo.counts.spareProductSlots;
  assert.equal(demo.counts.phaseCompanionSlots, lineageCapacity * 3);
  assert.equal(demo.state.phaseCarrierPlan.schema, 'peercompute.ulg.sph-phase-carrier-plan.v2');
  assert.equal(demo.state.phaseCarrierPlan.status, 'phase-lane-capacity-ready');
  assert.equal(demo.state.phaseCarrierPlan.lineageCapacity, lineageCapacity);
  assert.equal(demo.state.phaseCarrierPlan.primaryCapacity, lineageCapacity);
  assert.equal(demo.state.phaseCarrierPlan.phaseLaneCount, 4);
  assert.equal(demo.state.phaseCarrierPlan.phaseLaneStride, lineageCapacity);
  assert.equal(demo.state.phaseCarrierPlan.companionStart, lineageCapacity);
  assert.equal(demo.state.phaseCarrierPlan.companionCapacity, lineageCapacity * 3);
  assert.equal(demo.state.phaseCarrierPlan.particleCapacity, lineageCapacity * 4);
  assert.equal(
    demo.counts.total,
    demo.counts.drop
      + demo.counts.base
      + demo.counts.spareProductSlots
      + demo.counts.phaseCompanionSlots
  );
  const primarySpareIndices = demo.state.particles
    .map((particle, index) => (
      particle.spareProductSlot === true ? index : -1
    ))
    .filter((index) => index >= 0);
  const spareContinuityDomainIds = primarySpareIndices.map(
    (index) => demo.state.particles[index].initialBodyDomainId
  );
  assert.equal(primarySpareIndices.length, demo.counts.spareProductSlots);
  assert.ok(spareContinuityDomainIds.every((domainId) => domainId > 0));
  assert.equal(
    new Set(spareContinuityDomainIds).size,
    spareContinuityDomainIds.length,
    'each dormant product lineage must have a distinct solid continuity domain'
  );
  const packedParticles = buildSphGpuParticleBuffers(demo.state, {
    materialProperties: demo.materialProperties,
    initialParticleSpacing: demo.initialParticleSpacing
  });
  const liveContinuityDomainIds = new Set(
    demo.state.particles
      .map((particle, index) => (
        particle.massKg > 0
        && particle.phaseCompanionSlot !== true
          ? packedParticles.identity[index]
          : 0
      ))
      .filter((domainId) => domainId > 0)
  );
  assert.ok(
    spareContinuityDomainIds.every(
      (domainId) => !liveContinuityDomainIds.has(domainId)
    ),
    'reserved product domains must not collide with initial bodies'
  );
  for (let spare = 0; spare < primarySpareIndices.length; spare += 1) {
    const primaryIndex = primarySpareIndices[spare];
    const domainId = spareContinuityDomainIds[spare];
    assert.equal(packedParticles.identity[primaryIndex], domainId);
    const phaseCompanionIndices = demo.state.particles
      .map((particle, index) => (
        particle.phaseCompanionSlot === true
        && particle.phaseCarrierLineageIndex === primaryIndex
          ? index
          : -1
      ))
      .filter((index) => index >= 0);
    assert.equal(phaseCompanionIndices.length, 3);
    assert.ok(
      phaseCompanionIndices.every(
        (index) => packedParticles.identity[index] === domainId
      ),
      'every reserved phase lane must preserve its product lineage identity'
    );
  }
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

test('demo product reserve can provision one full live cohort without changing the default', () => {
  const common = {
    allowFixtureMaterialProperties: true,
    adaptiveParticleSpacing: false,
    dropParticleEdge: 3,
    baseParticleEdge: 5,
    mechanics: 'mlsmpm'
  };
  const ordinary = buildSphPhaseDemoState(common);
  const expanded = buildSphPhaseDemoState({
    ...common,
    reactionProductReserveMinimumLiveFraction: 1
  });
  const live = ordinary.counts.drop + ordinary.counts.base;

  assert.equal(live, 152);
  assert.equal(ordinary.counts.spareProductSlots, 38);
  assert.equal(expanded.counts.spareProductSlots, live);
  assert.equal(expanded.counts.phaseCompanionSlots, (live + live) * 3);
  assert.equal(expanded.counts.total, (live + live) * 4);
  assert.equal(expanded.reactionProductReservePlan.defaultSlotCount, 38);
  assert.equal(expanded.reactionProductReservePlan.minimumSlotCount, live);
  assert.equal(expanded.reactionProductReservePlan.slotCount, live);
  assert.equal(
    expanded.reactionProductReservePlan.requestedMinimumLiveFraction,
    1
  );
  assert.throws(
    () => buildSphPhaseDemoState({
      ...common,
      reactionProductReserveMinimumLiveFraction: 1.01
    }),
    /must be finite in \[0, 1\]/
  );
});

test('demo initial particle spacing preserves requested edges and derives material-state diagnostics', () => {
  const demo = buildSphPhaseDemoState({
    dropParticleEdge: 3,
    baseParticleEdge: 5
  });
  const spacing = demo.initialParticleSpacing;
  const dropMass = demo.state.particles.find((p) => p.role === 'drop').massKg;
  const baseMass = demo.state.particles.find((p) => p.role === 'base').massKg;
  const dropParticle = demo.state.particles.find((p) => p.role === 'drop');
  const baseParticle = demo.state.particles.find((p) => p.role === 'base');

  assert.equal(spacing.schema, 'peercompute.ulg.sph-initial-particle-spacing-plan.v0');
  assert.equal(spacing.status, 'requested-particle-edges-preserved-material-quantum-mass');
  assert.equal(spacing.particleSizePolicy.schema, 'peercompute.ulg.sph-initial-particle-size-policy.v0');
  assert.equal(spacing.particleSizePolicy.status, 'material-quantum-mass-density-derived-spacing');
  assert.equal(
    spacing.particleSizePolicy.massModel,
    'phase-density-at-temperature-pressure * mechanicsRestVolumeM3'
  );
  assert.match(spacing.particleSizePolicy.hierarchyPhaseVolumeReferenceMassModel, /condensed-phase-reference-density/);
  assert.equal(spacing.particleSizePolicy.phaseChangeVolumeModel, 'fixed-particle-count-no-automatic-gas-expansion');
  assert.match(spacing.particleSizePolicy.gasExpansionHandling, /species ledgers\/fields/);
  assert.equal(spacing.particleSizePolicy.dynamicPressureSupported, true);
  assert.equal(spacing.drop.pressurePa, 101325);
  assert.equal(spacing.base.pressurePa, 101325);
  assert.equal(spacing.drop.volumeRatioJ, 1);
  assert.equal(spacing.base.volumeRatioJ, 1);
  assert.equal(spacing.drop.requestedParticlesPerEdge, 3);
  assert.equal(spacing.base.requestedParticlesPerEdge, 5);
  assert.equal(spacing.drop.particlesPerEdge, 3);
  assert.equal(spacing.base.particlesPerEdge, 5);
  assert.equal(spacing.drop.effectiveParticleEdgeStatus, 'requested-particle-edge-preserved');
  assert.equal(spacing.base.effectiveParticleEdgeStatus, 'requested-particle-edge-preserved');
  assert.equal(spacing.targetNeighborCount, 64);
  assert.ok(spacing.smoothingLengthM > 0);
  assert.ok(spacing.smoothingLengthRatio > 0);
  assert.ok(spacing.drop.targetSmoothingLengthM > 0);
  assert.ok(spacing.base.targetSmoothingLengthM > 0);
  assert.ok(spacing.drop.densityKgPerM3 > spacing.base.densityKgPerM3);
  assert.equal(spacing.drop.phase, 'liquid');
  assert.equal(spacing.base.phase, 'solid');
  assert.match(spacing.drop.densitySource, /material-phase-density/);
  assert.match(spacing.base.densitySource, /material-phase-density/);
  assert.equal(spacing.drop.spacingM, spacing.drop.uniformSpacingM);
  assert.equal(spacing.base.spacingM, spacing.base.uniformSpacingM);
  near(spacing.drop.materialParticleDiameterM, spacing.drop.spacingM);
  near(spacing.base.materialParticleDiameterM, spacing.base.spacingM);
  near(spacing.drop.blockEdgeM, spacing.drop.materialParticleDiameterM * spacing.drop.particlesPerEdge);
  near(spacing.base.blockEdgeM, spacing.base.materialParticleDiameterM * spacing.base.particlesPerEdge);
  assert.equal(spacing.drop.blockSizeSource, 'material-particle-spacing-times-particles-per-edge');
  assert.equal(spacing.base.blockSizeSource, 'material-particle-spacing-times-particles-per-edge');
  assert.equal(spacing.drop.adaptiveWouldAdjustParticlesPerEdge, false);
  assert.equal(spacing.base.adaptiveWouldAdjustParticlesPerEdge, false);
  assert.equal(spacing.drop.adaptiveParticleSizingDeferred, true);
  assert.equal(spacing.base.adaptiveParticleSizingDeferred, true);
  assert.ok(spacing.drop.estimatedNeighborCount > 0);
  assert.ok(spacing.base.estimatedNeighborCount > 0);
  assert.equal(spacing.relativeParticleSize.schema, 'peercompute.ulg.sph-relative-particle-size-diagnostics.v0');
  assert.equal(
    spacing.relativeParticleSize.source,
    'fixed-material-quantum-mass-density-derived-spacing'
  );
  // Spacing follows each material's density so a particle is a fixed quantum
  // of MASS, and the axis-aligned block edge is that spacing times the
  // requested particles-per-edge. Iron is far denser than water, so its
  // quantum occupies less volume and its block edge is correspondingly
  // shorter at the same particles-per-edge. This previously pinned one global
  // spacing for every material, which made an iron particle carry roughly the
  // density ratio more mass than a water particle.
  assert.ok(
    spacing.drop.spacingM < spacing.base.spacingM,
    `denser drop must pack tighter: ${spacing.drop.spacingM} vs ${spacing.base.spacingM}`
  );
  const spacingRatio = spacing.base.spacingM / spacing.drop.spacingM;
  const densityRatio = spacing.drop.densityKgPerM3 / spacing.base.densityKgPerM3;
  near(spacingRatio, Math.cbrt(densityRatio), 1e-6);
  assert.ok(
    spacing.drop.volumeEquivalentParticleRadiusM
      < spacing.base.volumeEquivalentParticleRadiusM
  );
  // Radii now differ by the cube root of the density ratio, because the fixed
  // quantum is mass rather than volume. The denser drop is the smaller
  // particle, so it is the one relative-to-smallest is measured against.
  const radiusRatio = spacing.relativeParticleSize.dropToBaseRadiusRatio;
  assert.ok(radiusRatio < 1, `denser drop must be the smaller particle: ${radiusRatio}`);
  near(
    radiusRatio,
    Math.cbrt(spacing.base.densityKgPerM3 / spacing.drop.densityKgPerM3),
    1e-6
  );
  near(spacing.relativeParticleSize.dropRadiusRelativeToSmallest, 1);
  // The masses are now the quantum, so they agree far better than the density
  // ratio the uniform-volume policy produced.
  const massRatio = spacing.relativeParticleSize.dropToBaseMassRatio;
  assert.ok(
    massRatio > 0.5 && massRatio < 2,
    `a fixed mass quantum must keep particle masses close: ${massRatio}`
  );
  assert.ok(spacing.drop.materialReferenceParticleRadiusM > 0);
  assert.ok(spacing.base.materialReferenceParticleRadiusM > 0);
  near(spacing.drop.particleMassKg, spacing.drop.densityKgPerM3 * spacing.drop.mechanicsRestVolumeM3);
  near(spacing.base.particleMassKg, spacing.base.densityKgPerM3 * spacing.base.mechanicsRestVolumeM3);
  near(dropMass, spacing.drop.particleMassKg);
  near(baseMass, spacing.base.particleMassKg);
  near(dropParticle.initialParticleSpacingM, spacing.drop.spacingM);
  near(baseParticle.initialParticleSpacingM, spacing.base.spacingM);
  near(dropParticle.initialCellVolumeM3, spacing.drop.spacingM ** 3);
  near(dropParticle.particleSizeState.mechanicsRestVolumeM3, spacing.drop.mechanicsRestVolumeM3);
  near(dropParticle.particleSizeState.mechanicsRestVolumeM3, spacing.drop.spacingM ** 3);
  near(dropParticle.continuumCellVolumeM3, spacing.drop.continuumCellVolumeM3);
  near(dropParticle.visualRestVolumeM3, spacing.drop.restVolumeM3);
  assert.equal(dropParticle.particleSizeState.schema, 'peercompute.ulg.sph-particle-size-state.v0');
  assert.equal(dropParticle.particleSizeState.status, 'rest-volume');
  near(dropParticle.particleSizeState.restVolumeM3, spacing.drop.restVolumeM3);
  near(dropParticle.particleSizeState.currentVolumeM3, spacing.drop.restVolumeM3);
  near(dropParticle.restParticleRadiusM, spacing.drop.volumeEquivalentParticleRadiusM);
  near(dropParticle.currentParticleRadiusM, dropParticle.restParticleRadiusM);
  near(dropParticle.particleRadiusM * 2, dropParticle.initialParticleSpacingM);
  near(baseParticle.particleRadiusM * 2, baseParticle.initialParticleSpacingM);
  near(demo.scenario.iron.edgeM, spacing.drop.blockEdgeM);
  near(demo.scenario.ice.edgeM, spacing.base.blockEdgeM);
  assert.equal(demo.counts.drop, spacing.drop.particlesPerEdge ** 3);
  assert.equal(demo.counts.base, spacing.base.particlesPerEdge ** 3);
  assert.equal(demo.counts.drop, 3 ** 3);
  assert.equal(demo.counts.base, 5 ** 3);
  near(demo.state.smoothingLengthM, spacing.smoothingLengthM);
});

test('base block edge derivation shares the fixed matter-quantum geometry policy', () => {
  assert.equal(
    deriveSphPhaseInitialBaseBlockEdgeM({ baseParticleEdge: 8 }),
    1.6
  );
  near(
    deriveSphPhaseInitialBaseBlockEdgeM({
      scenario: createSphPhaseScenario({ iceEdgeM: 2.5 }),
      baseParticleEdge: 7
    }),
    3.5
  );
  assert.throws(
    () => deriveSphPhaseInitialBaseBlockEdgeM({
      scenario: { ice: { edgeM: 0 } },
      baseParticleEdge: 8
    }),
    /scenario\.ice\.edgeM must be a positive finite number/
  );
});

test('scene length scale preserves density, contact, counts, and cubic mass similarity', () => {
  const scale = 0.028;
  const referenceDriver = createSphPhaseDemo({
    scenario: createSphPhaseScenario(),
    dropParticleEdge: 3,
    baseParticleEdge: 5,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1
  });
  const reference = referenceDriver.demo;
  const scaledScenario = createSphPhaseScenario({
    sceneLengthScale: scale,
    boxDimensionsM: [5, 5, 5],
    wallModel: 'adiabatic'
  });
  const scaledDriver = createSphPhaseDemo({
    scenario: scaledScenario,
    dropParticleEdge: 3,
    baseParticleEdge: 5,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1
  });
  const scaled = scaledDriver.demo;
  const totalMass = (demo, material) => demo.state.particles
    .filter((particle) => particle.material === material && particle.massKg > 0)
    .reduce((sum, particle) => sum + particle.massKg, 0);
  const base = scaled.state.particles.filter(
    (particle) => particle.material === 'h2o' && particle.massKg > 0
  );
  const drop = scaled.state.particles.filter(
    (particle) => particle.material === 'fe' && particle.massKg > 0
  );
  const baseContactY = Math.max(
    ...base.map((particle) => particle.x[1] + particle.restParticleRadiusM)
  );
  const dropContactY = Math.min(
    ...drop.map((particle) => particle.x[1] - particle.restParticleRadiusM)
  );

  assert.equal(scaled.scenario.sceneLengthScale, scale);
  assert.deepEqual(scaled.scenario.box.dimensionsM, [0.14, 0.14, 0.14]);
  assert.equal(scaled.counts.drop, reference.counts.drop);
  assert.equal(scaled.counts.base, reference.counts.base);
  near(
    scaled.initialParticleSpacing.drop.densityKgPerM3,
    reference.initialParticleSpacing.drop.densityKgPerM3
  );
  near(
    scaled.initialParticleSpacing.base.densityKgPerM3,
    reference.initialParticleSpacing.base.densityKgPerM3
  );
  near(
    scaled.initialParticleSpacing.drop.spacingM,
    reference.initialParticleSpacing.drop.spacingM * scale,
    1e-12
  );
  near(
    scaled.initialParticleSpacing.base.spacingM,
    reference.initialParticleSpacing.base.spacingM * scale,
    1e-12
  );
  near(totalMass(scaled, 'fe'), totalMass(reference, 'fe') * scale ** 3, 1e-12);
  near(totalMass(scaled, 'h2o'), totalMass(reference, 'h2o') * scale ** 3, 1e-12);
  near(baseContactY, dropContactY, 1e-10);
  assert.equal(scaled.scenario.walls.model, 'adiabatic');
  assert.equal(scaled.scenario.wallReservoirAuthority.exchangeEnabled, false);
  near(
    scaledDriver.demo.gpuMechanics.gridSpacingM,
    referenceDriver.demo.gpuMechanics.gridSpacingM * scale,
    1e-12
  );
});

test('demo initial particle spacing carries default material bank warm inputs', async () => {
  const materialPropertyBank = await readJson('../data/material-properties/elements.json');
  const demo = buildSphPhaseDemoState({
    dropParticleEdge: 1,
    baseParticleEdge: 1
  });
  const warmInputs = demo.initialParticleSpacing.materialPropertyBankWarmInputs;

  assert.equal(warmInputs.schema, 'peercompute.ulg.sph-initial-particle-spacing-material-bank-warm-inputs.v0');
  assert.equal(warmInputs.status, 'material-bank-warm-inputs-attached');
  assert.equal(warmInputs.strictSourceOfTruth, false);
  assert.equal(warmInputs.coveredRoleCount, 1);
  assert.equal(warmInputs.roles.drop.material, 'Fe');
  assert.equal(warmInputs.roles.drop.requestedMaterial, 'fe');
  assert.equal(warmInputs.roles.drop.strictSourceOfTruth, false);
  assert.equal(warmInputs.roles.drop.spacingPolicy, 'derive-from-rest-density-and-phase');
  assert.equal(warmInputs.roles.drop.provenance.generatorFingerprint, materialPropertyBank.generatorFingerprint);
  assert.equal(warmInputs.roles.base, null);
  assert.deepEqual(warmInputs.missingRoles, [
    { role: 'base', material: 'h2o', reason: 'material-bank-row-not-found' }
  ]);
  const crystalWarmInputs = demo.initialParticleSpacing.materialPropertyCrystalStructureWarmInputs;
  assert.equal(
    crystalWarmInputs.schema,
    'peercompute.ulg.sph-initial-particle-spacing-material-crystal-structure-warm-inputs.v0'
  );
  assert.equal(crystalWarmInputs.status, 'material-crystal-structure-warm-inputs-no-valid-rows');
  assert.equal(crystalWarmInputs.coveredRoleCount, 0);
  assert.equal(crystalWarmInputs.roles.drop, null);
  assert.equal(crystalWarmInputs.roles.base, null);
  assert.equal(crystalWarmInputs.missingRoles[0].role, 'drop');
  assert.equal(crystalWarmInputs.missingRoles[0].material, 'fe');
  assert.equal(crystalWarmInputs.missingRoles[0].reason, 'material-crystal-structure-row-not-valid-for-state');
  assert.deepEqual(crystalWarmInputs.missingRoles[0].structureKeys, ['fe-bcc-alpha']);
  assert.equal(crystalWarmInputs.missingRoles[1].role, 'base');
  assert.equal(crystalWarmInputs.missingRoles[1].reason, 'material-crystal-structure-row-not-found');
  assert.equal(
    demo.initialParticleSpacing.particleSizePolicy.materialPropertyBankWarmInputStatus,
    'material-bank-warm-inputs-attached'
  );
  assert.equal(demo.initialParticleSpacing.particleSizePolicy.materialPropertyBankCoveredRoleCount, 1);
  assert.equal(
    demo.initialParticleSpacing.particleSizePolicy.materialPropertyBankGpuWarmInputRowCount,
    1
  );
  assert.equal(
    demo.initialParticleSpacing.particleSizePolicy.materialPropertyBankParticleSizePackingRowCount,
    1
  );
  assert.equal(
    demo.initialParticleSpacing.materialPropertyBankGpuWarmInputTable.schema,
    'peercompute.ulg.material-property-bank.gpu-warm-input-table.v0'
  );
  assert.equal(demo.initialParticleSpacing.materialPropertyBankGpuWarmInputTable.rowCount, 1);
  assert.equal(
    demo.initialParticleSpacing.materialPropertyBankParticleSizePackingTable.schema,
    'peercompute.ulg.material-property-bank.particle-size-packing-table.v0'
  );
  assert.equal(demo.initialParticleSpacing.materialPropertyBankParticleSizePackingTable.rowCount, 1);

  const viewState = createSphPhaseViewState({ demo });
  assert.equal(viewState.initialParticleSpacing.materialPropertyBankWarmInputs.roles.drop.material, 'Fe');
  assert.equal(viewState.initialParticleSpacing.materialPropertyBankWarmInputs.roles.base, null);
  assert.equal(viewState.sphGpuParticleState.materialPropertyBankWarmInputTable.rowCount, 1);
  assert.equal(viewState.sphGpuParticleState.materialPropertyBankParticleSizeTable.rowCount, 1);
  assert.equal(viewState.mlsMpmGpuParticleState.materialPropertyBankWarmInputTable.rowCount, 1);
  assert.equal(viewState.mlsMpmGpuParticleState.materialPropertyBankParticleSizeTable.rowCount, 1);
  assert.equal(
    viewState.initialParticleSpacing.algorithmMaterialParticleInitializationRows.schema,
    'peercompute.ulg.algorithm-material-particle-initialization-rows.v0'
  );
  assert.equal(viewState.initialParticleSpacing.algorithmMaterialParticleInitializationRows.rowCount, 2);
  assert.equal(
    viewState.initialParticleSpacing.particleSizePolicy.algorithmMaterialParticleInitializationStatus,
    'algorithm-derived-particle-initialization-rows-ready'
  );
});

test('demo initial particle spacing carries crystal packing rows for valid solid elements', () => {
  const demo = buildSphPhaseDemoState({
    dropMaterial: 'Na',
    baseMaterial: 'h2o',
    dropTemperatureK: 290,
    baseTemperatureK: 290,
    dropParticleEdge: 1,
    baseParticleEdge: 1
  });
  const crystalWarmInputs = demo.initialParticleSpacing.materialPropertyCrystalStructureWarmInputs;
  assert.equal(crystalWarmInputs.status, 'material-crystal-structure-warm-inputs-attached');
  assert.equal(crystalWarmInputs.coveredRoleCount, 1);
  assert.equal(crystalWarmInputs.roles.drop.structureKey, 'na-bcc-alpha');
  assert.equal(crystalWarmInputs.roles.drop.unitCell.packingFraction, 0.68);
  assert.equal(crystalWarmInputs.roles.drop.unitCell.coordinationNumber, 8);
  assert.equal(crystalWarmInputs.roles.drop.unitCell.atomsPerConventionalCell, 2);
  assert.equal(crystalWarmInputs.roles.drop.strictSourceOfTruth, false);
  assert.equal(crystalWarmInputs.roles.base, null);
  assert.equal(
    demo.initialParticleSpacing.particleSizePolicy.materialCrystalStructureWarmInputStatus,
    'material-crystal-structure-warm-inputs-attached'
  );
  assert.equal(demo.initialParticleSpacing.particleSizePolicy.materialCrystalStructureCoveredRoleCount, 1);

  const particleSizeTable = demo.initialParticleSpacing.materialPropertyBankParticleSizePackingTable;
  assert.equal(particleSizeTable.rowCount, 1);
  assert.equal(particleSizeTable.metadata[0].material, 'Na');
  assert.equal(particleSizeTable.metadata[0].crystalStructureKey, 'na-bcc-alpha');
  assert.equal(particleSizeTable.metadata[0].crystalStructureStatus, 'material-crystal-structure-warm-input-ready');
  assert.equal(particleSizeTable.metadata[0].crystalPackingFraction, 0.68);
  assert.equal(particleSizeTable.metadata[0].crystalCoordinationNumber, 8);
  assert.equal(particleSizeTable.metadata[0].crystalAtomsPerConventionalCell, 2);
  assert.equal(particleSizeTable.rows[12], 1);
  near(particleSizeTable.rows[13], 0.68);
  assert.equal(particleSizeTable.rows[14], 8);
  assert.equal(particleSizeTable.rows[15], 2);

  const algorithmRows = demo.initialParticleSpacing.algorithmMaterialParticleInitializationRows;
  assert.equal(algorithmRows.status, 'algorithm-derived-particle-initialization-rows-ready');
  assert.equal(algorithmRows.rowCount, 2);
  const dropRow = algorithmRows.rows.find((row) => row.role === 'drop');
  assert.equal(dropRow.schema, 'peercompute.ulg.algorithm-material-particle-initialization-row.v0');
  assert.equal(dropRow.material, 'Na');
  assert.equal(dropRow.crystalStructureKey, 'na-bcc-alpha');
  assert.equal(dropRow.crystalPackingFraction, 0.68);
  assert.equal(dropRow.particleRadiusPolicy, 'global-particle-volume-authoritative-crystal-packing-diagnostic');
  assert.ok(dropRow.crystalPackingParticleRadiusM > 0);
  near(dropRow.appliedParticleRadiusM, dropRow.volumeEquivalentParticleRadiusM);
  near(dropRow.mechanicsRestVolumeM3, demo.initialParticleSpacing.drop.mechanicsRestVolumeM3);
  assert.equal(
    demo.initialParticleSpacing.particleSizePolicy.algorithmMaterialParticleInitializationRowCount,
    2
  );
});

test('demo initial particle spacing keeps counts fixed while material state changes mass and density', () => {
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

  const liquidDropParticle = liquidWater.state.particles.find((p) => p.role === 'drop');
  const liquidBaseParticle = liquidWater.state.particles.find((p) => p.role === 'base');
  const hotVaporDropParticle = hotVapor.state.particles.find((p) => p.role === 'drop');
  assert.equal(liquidWater.initialParticleSpacing.matchingMaterialState, true);
  assert.equal(liquidWater.initialParticleSpacing.matchingMaterialStateSpacingUnified, true);
  assert.equal(liquidWater.initialParticleSpacing.drop.particlesPerEdge, 3);
  assert.equal(liquidWater.initialParticleSpacing.base.particlesPerEdge, 5);
  assert.equal(liquidWater.counts.drop, 27);
  assert.equal(liquidWater.counts.base, 125);
  near(liquidWater.initialParticleSpacing.drop.spacingM, liquidWater.initialParticleSpacing.base.spacingM);
  near(liquidDropParticle.initialParticleSpacingM, liquidBaseParticle.initialParticleSpacingM);
  near(
    liquidWater.initialParticleSpacing.drop.blockEdgeM,
    liquidWater.initialParticleSpacing.drop.spacingM * liquidWater.initialParticleSpacing.drop.particlesPerEdge
  );
  near(
    liquidWater.initialParticleSpacing.base.blockEdgeM,
    liquidWater.initialParticleSpacing.base.spacingM * liquidWater.initialParticleSpacing.base.particlesPerEdge
  );
  near(liquidDropParticle.particleRadiusM, liquidBaseParticle.particleRadiusM);
  assert.ok(hotVapor.initialParticleSpacing.drop.densityKgPerM3 < liquidWater.initialParticleSpacing.drop.densityKgPerM3);
  assert.equal(hotVapor.initialParticleSpacing.drop.particlesPerEdge, liquidWater.initialParticleSpacing.drop.particlesPerEdge);
  assert.equal(hotVapor.initialParticleSpacing.drop.spacingM, liquidWater.initialParticleSpacing.drop.spacingM);
  assert.ok(hotVapor.initialParticleSpacing.drop.particleMassKg < liquidWater.initialParticleSpacing.drop.particleMassKg);
  assert.equal(hotVapor.initialParticleSpacing.drop.phase, 'gas');
  assert.ok(
    hotVapor.initialParticleSpacing.drop.phaseVolumeReferenceDensityKgPerM3
    > hotVapor.initialParticleSpacing.drop.densityKgPerM3
  );
  assert.ok(
    hotVapor.initialParticleSpacing.drop.phaseVolumeReferenceMassKg
    > hotVapor.initialParticleSpacing.drop.particleMassKg
  );
  assert.ok(hotVapor.initialParticleSpacing.drop.phaseVolumeReferenceMassRatio > 100);
  assert.match(
    hotVapor.initialParticleSpacing.drop.phaseVolumeReferenceDensitySource,
    /condensed-phase-density/
  );
  near(
    hotVaporDropParticle.phaseVolumeReferenceMassKg,
    hotVapor.initialParticleSpacing.drop.phaseVolumeReferenceMassKg,
    hotVapor.initialParticleSpacing.drop.phaseVolumeReferenceMassKg * 1e-6
  );
  assert.ok(hotVaporDropParticle.phaseVolumeReferenceMassKg > hotVaporDropParticle.massKg);
  near(liquidDropParticle.phaseVolumeReferenceMassKg, liquidDropParticle.massKg);
  assert.equal(fixed.initialParticleSpacing.status, 'fixed-requested-particles-per-edge-global-particle-volume');
  assert.equal(fixed.initialParticleSpacing.matchingMaterialState, false);
  assert.equal(fixed.initialParticleSpacing.matchingMaterialStateSpacingUnified, false);
  assert.equal(fixed.initialParticleSpacing.drop.particlesPerEdge, 3);
  assert.equal(fixed.initialParticleSpacing.base.particlesPerEdge, 5);
  assert.equal(fixed.counts.drop, 27);
  assert.equal(fixed.counts.base, 125);
});

test('same material and temperature keep requested edges with shared material-derived size', () => {
  const demo = buildSphPhaseDemoState({
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 290,
    baseTemperatureK: 290,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1.5,
    dropParticleEdge: 3,
    baseParticleEdge: 5
  });
  const spacing = demo.initialParticleSpacing;
  const dropParticle = demo.state.particles.find((p) => p.role === 'drop');
  const baseParticle = demo.state.particles.find((p) => p.role === 'base');
  const dropIndex = demo.state.particles.findIndex((p) => p.role === 'drop');
  const baseIndex = demo.state.particles.findIndex((p) => p.role === 'base');
  const viewState = createSphPhaseViewState({ demo });

  assert.equal(spacing.matchingMaterialState, true);
  assert.equal(spacing.matchingMaterialStateSpacingUnified, true);
  assert.equal(spacing.drop.particlesPerEdge, spacing.drop.requestedParticlesPerEdge);
  assert.equal(spacing.base.particlesPerEdge, spacing.base.requestedParticlesPerEdge);
  assert.equal(spacing.drop.densityKgPerM3, spacing.base.densityKgPerM3);
  near(spacing.drop.spacingM, spacing.base.spacingM);
  near(spacing.drop.blockEdgeM, spacing.drop.spacingM * 3);
  near(spacing.base.blockEdgeM, spacing.base.spacingM * 5);
  near(spacing.drop.volumeEquivalentParticleRadiusM, spacing.base.volumeEquivalentParticleRadiusM);
  near(spacing.drop.materialReferenceParticleRadiusM, spacing.base.materialReferenceParticleRadiusM);
  near(dropParticle.initialParticleSpacingM, baseParticle.initialParticleSpacingM);
  near(dropParticle.initialCellVolumeM3, baseParticle.initialCellVolumeM3);
  near(dropParticle.particleRadiusM, baseParticle.particleRadiusM);
  assert.equal(dropParticle.material, baseParticle.material);
  assert.equal(dropParticle.temperatureK, baseParticle.temperatureK);
  near(viewState.particleRadiiM[dropIndex], viewState.materials[dropIndex].particleRadiusM);
  near(viewState.particleRadiiM[baseIndex], viewState.materials[baseIndex].particleRadiusM);
  near(viewState.materials[dropIndex].initialParticleSpacingM, viewState.materials[baseIndex].initialParticleSpacingM);
});

test('low requested drop edge uses cell-centered coarse macro-particles without grid snapping', () => {
  const demo = buildSphPhaseDemoState({
    scenario: createSphPhaseScenario({
      boxDimensionsM: [5, 5, 5],
      ironVolumeFractionOfIce: 1
    }),
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 293.15,
    baseTemperatureK: 293.15,
    iceBaseHeightM: 0,
    ironBaseHeightM: 2.5,
    dropParticleEdge: 2,
    baseParticleEdge: 4
  });
  const dropParticles = demo.state.particles.filter((p) => p.role === 'drop');
  const baseParticles = demo.state.particles.filter((p) => p.role === 'base');
  const spacing = demo.initialParticleSpacing;
  const uniqueAxis = (particles, axis) => [...new Set(particles.map((p) => Number(p.x[axis].toFixed(6))))].sort((a, b) => a - b);
  const centersFromMin = (min, spacingM, count) => Array.from(
    { length: count },
    (_, i) => Number((min + (i + 0.5) * spacingM).toFixed(6))
  );
  const centeredCenters = (blockEdgeM, spacingM, count) => centersFromMin(
    2.5 - blockEdgeM / 2,
    spacingM,
    count
  );

  assert.equal(spacing.drop.particlesPerEdge, 2);
  assert.equal(spacing.base.particlesPerEdge, 4);
  assert.equal(dropParticles.length, 8);
  assert.equal(baseParticles.length, 64);
  near(spacing.drop.spacingM, spacing.base.spacingM);
  near(spacing.drop.materialParticleDiameterM, spacing.drop.spacingM);
  near(spacing.base.materialParticleDiameterM, spacing.base.spacingM);
  near(spacing.drop.blockEdgeM, spacing.drop.spacingM * 2);
  near(spacing.base.blockEdgeM, spacing.base.spacingM * 4);
  near(spacing.drop.spacingM, 2 * spacing.drop.volumeEquivalentParticleRadiusM);
  near(spacing.base.spacingM, 2 * spacing.base.volumeEquivalentParticleRadiusM);
  assert.deepEqual(uniqueAxis(dropParticles, 0), centeredCenters(spacing.drop.blockEdgeM, spacing.drop.spacingM, 2));
  assert.deepEqual(uniqueAxis(dropParticles, 1), centersFromMin(2.5, spacing.drop.spacingM, 2));
  assert.deepEqual(uniqueAxis(dropParticles, 2), centeredCenters(spacing.drop.blockEdgeM, spacing.drop.spacingM, 2));
  assert.deepEqual(uniqueAxis(baseParticles, 0), centeredCenters(spacing.base.blockEdgeM, spacing.base.spacingM, 4));
  assert.deepEqual(uniqueAxis(baseParticles, 1), centersFromMin(0, spacing.base.spacingM, 4));
  assert.equal(demo.initialParticleEdgeDiagnostics.requestedEdgePreservationStatus, 'preserved');
  near(demo.initialParticleEdgeDiagnostics.drop.blockEdgeM, spacing.drop.blockEdgeM);
  near(demo.initialParticleEdgeDiagnostics.base.blockEdgeM, spacing.base.blockEdgeM);
});

test('same material high drop edge preserves both requested edges', () => {
  const demo = buildSphPhaseDemoState({
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 290,
    baseTemperatureK: 290,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1.5,
    dropParticleEdge: 7,
    baseParticleEdge: 5
  });
  const spacing = demo.initialParticleSpacing;
  const diagnostics = demo.initialParticleEdgeDiagnostics;
  const viewState = createSphPhaseViewState({ demo });

  assert.equal(spacing.matchingMaterialState, true);
  assert.equal(spacing.matchingMaterialStateSpacingUnified, true);
  assert.equal(spacing.matchingMaterialStateSpacingPlan, null);
  assert.equal(spacing.drop.particlesPerEdge, 7);
  assert.equal(spacing.base.particlesPerEdge, 5);
  assert.equal(demo.counts.drop, 7 ** 3);
  assert.equal(demo.counts.base, 5 ** 3);
  near(spacing.drop.spacingM, spacing.base.spacingM);
  near(spacing.drop.blockEdgeM, spacing.drop.spacingM * 7);
  near(spacing.base.blockEdgeM, spacing.base.spacingM * 5);
  near(spacing.drop.volumeEquivalentParticleRadiusM, spacing.base.volumeEquivalentParticleRadiusM);
  assert.equal(diagnostics.schema, 'peercompute.ulg.sph-initial-particle-edge-diagnostics.v0');
  assert.equal(diagnostics.status, 'initial-particle-edges-effective');
  assert.equal(diagnostics.requestedDropParticlesPerEdge, 7);
  assert.equal(diagnostics.effectiveDropParticlesPerEdge, 7);
  assert.equal(diagnostics.effectiveBaseParticlesPerEdge, 5);
  assert.equal(diagnostics.preservedRequestedRole, null);
  assert.equal(diagnostics.requestedEdgePreservationStatus, 'preserved');
  assert.equal(viewState.initialParticleEdgeDiagnostics.effectiveDropParticlesPerEdge, 7);
  assert.equal(viewState.initialParticleEdgeDiagnostics.effectiveBaseParticlesPerEdge, 5);
});

test('large requested drop edge is preserved without changing lattice resolution', () => {
  const demo = buildSphPhaseDemoState({
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 450,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1.5,
    dropParticleEdge: 7,
    baseParticleEdge: 5
  });
  const spacing = demo.initialParticleSpacing;
  const diagnostics = demo.initialParticleEdgeDiagnostics;

  assert.equal(spacing.matchingMaterialState, false);
  assert.equal(spacing.drop.requestedParticlesPerEdge, 7);
  assert.equal(spacing.drop.particlesPerEdge, 7);
  assert.equal(spacing.drop.effectiveParticleEdgeStatus, 'requested-particle-edge-preserved');
  assert.equal(spacing.drop.requestedParticleEdgeLowerBoundApplied, false);
  assert.equal(demo.counts.drop, 7 ** 3);
  assert.equal(diagnostics.effectiveDropParticlesPerEdge, 7);
  assert.equal(diagnostics.drop.requestedParticleEdgeLowerBoundApplied, false);
  assert.equal(diagnostics.requestedEdgePreservationStatus, 'preserved');
});

test('large requested drop edge remains preserved beyond seven', () => {
  const demo = buildSphPhaseDemoState({
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 290,
    baseTemperatureK: 290,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1.5,
    dropParticleEdge: 8,
    baseParticleEdge: 8
  });
  const spacing = demo.initialParticleSpacing;
  const diagnostics = demo.initialParticleEdgeDiagnostics;

  assert.equal(spacing.matchingMaterialState, true);
  assert.equal(spacing.matchingMaterialStateSpacingPlan, null);
  assert.equal(spacing.drop.particlesPerEdge, 8);
  assert.equal(spacing.base.particlesPerEdge, 8);
  assert.equal(demo.counts.drop, 8 ** 3);
  assert.equal(demo.counts.base, 8 ** 3);
  assert.equal(diagnostics.requestedDropParticlesPerEdge, 8);
  assert.equal(diagnostics.requestedBaseParticlesPerEdge, 8);
  assert.equal(diagnostics.effectiveDropParticlesPerEdge, 8);
  assert.equal(diagnostics.effectiveBaseParticlesPerEdge, 8);
  assert.equal(diagnostics.requestedEdgePreservationStatus, 'preserved');
});

test('large non-H2O drop edge preserves both requested edges', () => {
  const demo = buildSphPhaseDemoState({
    dropMaterial: 'fe',
    baseMaterial: 'h2o',
    dropTemperatureK: 290,
    baseTemperatureK: 290,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1.5,
    dropParticleEdge: 8,
    baseParticleEdge: 5
  });
  const spacing = demo.initialParticleSpacing;
  const diagnostics = demo.initialParticleEdgeDiagnostics;
  const viewState = createSphPhaseViewState({ demo });

  assert.equal(spacing.matchingMaterialState, false);
  assert.equal(spacing.drop.requestedParticlesPerEdge, 8);
  assert.equal(spacing.drop.particlesPerEdge, 8);
  assert.equal(spacing.drop.effectiveParticleEdgeStatus, 'requested-particle-edge-preserved');
  assert.equal(spacing.drop.requestedParticleEdgeLowerBoundApplied, false);
  assert.equal(spacing.base.requestedParticlesPerEdge, 5);
  assert.equal(spacing.base.particlesPerEdge, 5);
  assert.equal(spacing.base.effectiveParticleEdgeStatus, 'requested-particle-edge-preserved');
  assert.equal(demo.counts.drop, 8 ** 3);
  assert.equal(demo.counts.base, 5 ** 3);
  assert.equal(diagnostics.requestedDropParticlesPerEdge, 8);
  assert.equal(diagnostics.requestedBaseParticlesPerEdge, 5);
  assert.equal(diagnostics.effectiveDropParticlesPerEdge, 8);
  assert.equal(diagnostics.effectiveBaseParticlesPerEdge, 5);
  assert.equal(diagnostics.requestedEdgePreservationStatus, 'preserved');
  assert.equal(viewState.counts.drop, 8 ** 3);
  assert.equal(viewState.counts.base, 5 ** 3);
});

test('matching material preserves equal high explicit role edges without inflating benchmark counts', () => {
  const demo = buildSphPhaseDemoState({
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 290,
    baseTemperatureK: 290,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1.5,
    dropParticleEdge: 7,
    baseParticleEdge: 7
  });
  const spacing = demo.initialParticleSpacing;
  const diagnostics = demo.initialParticleEdgeDiagnostics;

  assert.equal(spacing.matchingMaterialState, true);
  assert.equal(spacing.matchingMaterialStateSpacingUnified, true);
  assert.equal(spacing.matchingMaterialStateSpacingPlan, null);
  assert.equal(spacing.drop.particlesPerEdge, 7);
  assert.equal(spacing.base.particlesPerEdge, 7);
  near(spacing.drop.spacingM, spacing.base.spacingM);
  near(spacing.drop.blockEdgeM, spacing.drop.spacingM * 7);
  near(spacing.base.blockEdgeM, spacing.base.spacingM * 7);
  assert.equal(demo.counts.drop, 7 ** 3);
  assert.equal(demo.counts.base, 7 ** 3);
  assert.equal(diagnostics.effectiveDropParticlesPerEdge, 7);
  assert.equal(diagnostics.effectiveBaseParticlesPerEdge, 7);
  assert.equal(diagnostics.preservedRequestedRole, null);
  assert.equal(diagnostics.totalGeneratedParticleCount, 2 * 7 ** 3);
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

test('demo hydrostatic initialization inverts the packed per-phase constitutive law', () => {
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
  assert.ok(minBaseJ > 0 && minBaseJ <= 1);
  assert.ok(base.every((p) => p.hydrostaticInitialization?.status === 'initialized-supported-condensed-block'));
  assert.ok(base.every((p) => p.hydrostaticInitialization?.volumeRatioModel === 'per-phase-cfl-tait-eos'));
  for (const particle of base) {
    const receipt = particle.hydrostaticInitialization;
    assert.equal(receipt.phaseSoundSpeedScale > 0, true);
    assert.equal(receipt.effectiveBulkModulusPa > 0, true);
    assert.equal(receipt.effectiveShearModulusPa, 0);
    const recoveredPressurePa = receipt.effectiveBulkModulusPa / 7
      * (particle.mpmJ ** -7 - 1);
    near(
      recoveredPressurePa,
      receipt.pressurePa,
      Math.max(1e-8, receipt.pressurePa * 1e-10)
    );
    near(
      particle.mpmF[0] * particle.mpmF[4] * particle.mpmF[8],
      particle.mpmJ,
      1e-12
    );
  }
  assert.ok(base.some((p) => p.particleSizeState?.status === 'pressure-adjusted-current-volume'));
  assert.ok(base.every((p) => p.particleSizeState?.source === 'hydrostatic-material-temperature-pressure-rest-density'));
  assert.ok(base.every((p) => p.restParticleRadiusM === p.particleRadiusM));
  assert.ok(base.some((p) => p.currentParticleRadiusM < p.restParticleRadiusM));
  assert.ok(base.every((p) => p.hydrostaticInitialization?.currentVolumeM3 <= p.hydrostaticInitialization?.restVolumeM3));
  assert.ok(drop.every((p) => p.particleSizeState?.status === 'rest-volume'));
  assert.ok(drop.every((p) => p.currentParticleRadiusM === p.restParticleRadiusM));
  assert.ok(drop.every((p) => p.mpmJ === undefined));
});

test('demo corrects overlapping initial block geometry instead of refusing it', () => {
  const driver = createSphPhaseDemo({
    scenario: createSphPhaseScenario({ boxDimensionsM: [5, 5, 5] }),
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 0.5,
    dropParticleEdge: 3,
    baseParticleEdge: 5
  });
  const preflight = driver.preflight();
  // A drop height that would bury the drop inside the base is corrected by
  // raising it clear, not refused. The correction is reported so the layout
  // change is visible, and the resulting geometry must actually be separated.
  assert.notEqual(preflight.status, 'preflight-blocked-initial-geometry');
  assert.equal(preflight.feasibility.geometryBlocked, false);
  assert.ok(!preflight.blockers.includes('initial-block-geometry-overlap'));
  assert.ok(preflight.initialGeometry.pairs.every((pair) => pair.status !== 'initial-blocks-overlap'));
  const corrections = driver.demo.initialGeometryCorrections;
  assert.equal(corrections.status, 'initial-block-geometry-corrected');
  assert.ok(
    corrections.corrections.some(
      (entry) => entry.kind === 'drop-block-raised-out-of-base-overlap'
    ),
    JSON.stringify(corrections)
  );
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
    adaptiveParticleSpacing: false,
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
  assert.equal(driver.demo.gpuMechanics.mlsMpmLiquidVelocityDiffusionAlpha, 0.1);
  assert.equal(driver.demo.gpuMechanics.mlsMpmLiquidVelocityDiffusionStartS, 0.16);
  // Wall damping default retired to 0 (2026-07-09): the 0.2-era value was
  // tuned while settling physics was broken and read as excessive surface
  // tension once excluded-volume separation and the free-slip floor landed.
  assert.equal(driver.demo.gpuMechanics.mlsMpmLiquidWallDampingAlpha, 0);
  assert.deepEqual(viewState.pendingPhysicalLawGroups.map((group) => group.key), ['surfaceTension']);
  driver.step();
  assert.deepEqual(driver.demo.lastStepTiming.pendingPhysicalLawGroups.map((group) => group.key), ['surfaceTension']);
  assert.deepEqual(
    driver.demo.lastStepTiming.unsupportedPhysicalLawGroups,
    driver.demo.lastStepTiming.pendingPhysicalLawGroups
  );
  assert.equal(
    viewState.surfaceTensionLawAdmission.status,
    'blocked'
  );
  assert.equal(
    viewState.pendingPhysicalLawGroups[0].status,
    'pending-unsupported-physical-law-route'
  );
});

test('surface tension is admitted only on the exact single-level Schroeder route', () => {
  const exactConfig = {
    enabled: true,
    selectedLevel: 0,
    minLevel: 0,
    maxLevel: 0,
    enableTwoLevelMechanics: false
  };
  const admitted = resolveSphSurfaceTensionLawAdmission({
    mechanics: 'mlsmpm',
    mechanicsLawEnabled: true,
    schroederSimulationConfig: exactConfig
  });
  assert.equal(admitted.status, 'admitted');
  assert.equal(admitted.levelRole, 'single');
  assert.deepEqual(
    pendingSphPhysicalLawGroups(
      { surfaceTension: true },
      { surfaceTensionAdmission: admitted }
    ),
    []
  );

  const blockedCases = [
    {
      mechanics: 'sph',
      mechanicsLawEnabled: true,
      schroederSimulationConfig: exactConfig,
      blocker: 'surface-tension-requires-mlsmpm'
    },
    {
      mechanics: 'mlsmpm',
      mechanicsLawEnabled: false,
      schroederSimulationConfig: exactConfig,
      blocker: 'surface-tension-requires-mechanics-law'
    },
    {
      mechanics: 'mlsmpm',
      mechanicsLawEnabled: true,
      schroederSimulationConfig: { ...exactConfig, enabled: false },
      blocker: 'surface-tension-requires-schroeder-simulation'
    },
    {
      mechanics: 'mlsmpm',
      mechanicsLawEnabled: true,
      schroederSimulationConfig: {
        ...exactConfig,
        enableTwoLevelMechanics: true
      },
      blocker: 'surface-tension-two-level-route-not-admitted'
    },
    {
      mechanics: 'mlsmpm',
      mechanicsLawEnabled: true,
      schroederSimulationConfig: { ...exactConfig, maxLevel: 1 },
      blocker: 'surface-tension-requires-exact-single-level-range'
    }
  ];
  for (const entry of blockedCases) {
    const admission = resolveSphSurfaceTensionLawAdmission(entry);
    assert.equal(admission.status, 'blocked');
    assert.ok(admission.blockers.includes(entry.blocker));
    assert.deepEqual(
      pendingSphPhysicalLawGroups(
        { surfaceTension: true },
        { surfaceTensionAdmission: admission }
      ).map((group) => [group.key, group.status, group.reason]),
      [[
        'surfaceTension',
        'pending-unsupported-physical-law-route',
        admission.reason
      ]]
    );
  }
});

test('ambient water demo particles pack and step as liquid MLS-MPM material', () => {
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
    ironBaseHeightM: 1.2,
    dropParticleEdge: 2,
    baseParticleEdge: 2,
    mechanics: 'mlsmpm',
    physicalLawGroups: {
      thermal: false,
      reactions: false,
      viscosity: true
    }
  });
  assert.ok(particleThermalState(driver.demo).every((particle) => particle.phase === 'liquid'));

  const packed = buildMlsMpmGpuParticleBuffers(driver.demo.state, {
    materialProperties: driver.demo.materialProperties,
    viscosityEnabled: true,
    mlsMpmArtificialViscosityAlpha: driver.demo.gpuMechanics.mlsMpmArtificialViscosityAlpha,
    viscosityLengthM: driver.demo.gpuMechanics.gridSpacingM
  });
  const rows = decodeMlsMpmGpuParticleRows(packed);
  assert.ok(rows.every((row) => row.solidFlag === 0));
  assert.ok(rows.every((row) => row.shearModulusPa === 0));
  assert.ok(rows.every((row) => row.lameLambdaPa === 0));
  assert.ok(rows.every((row) => row.eosModelId === 1));
  // Physical shear viscosity only; water's closure supplies none, so this is 0.
  // The artificial stabilizer is a compression-gated bulk term in P2G now, not
  // a shear viscosity, because a shear coefficient this large made liquids
  // creep like a gel instead of flowing.
  assert.ok(rows.every((row) => row.dynamicViscosityPaS === 0));

  driver.step();
  for (const particle of driver.demo.state.particles) {
    assert.equal(particle.mpmSolid, false);
    assert.ok(particle.mpmJ >= 0.995 - 1e-9 && particle.mpmJ <= 1.005 + 1e-9);
    assert.ok(Math.abs(particle.mpmF[1]) < 1e-12);
    assert.ok(Math.abs(particle.mpmF[2]) < 1e-12);
    assert.ok(Math.abs(particle.mpmF[3]) < 1e-12);
    assert.ok(Math.abs(particle.mpmF[5]) < 1e-12);
    assert.ok(Math.abs(particle.mpmF[6]) < 1e-12);
    assert.ok(Math.abs(particle.mpmF[7]) < 1e-12);
    near(particle.mpmF[0], particle.mpmF[4], 1e-12);
    near(particle.mpmF[4], particle.mpmF[8], 1e-12);
  }
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

test('SPH phase view state carries authoritative ambient and wall temperatures for resident thermal steps', () => {
  const wallFaces = { xMin: 291, xMax: 292, yMin: 293, yMax: 294, zMin: 295, zMax: 296 };
  const demo = buildSphPhaseDemoState({
    scenario: createSphPhaseScenario({
      wallFaces,
      ambientTemperatureK: 247.5
    }),
    dropParticleEdge: 1,
    baseParticleEdge: 1
  });
  const viewState = createSphPhaseViewState({ demo });

  assert.deepEqual(viewState.wallTemperaturesK, wallFaces);
  assert.deepEqual(viewState.scenario.walls.faces, wallFaces);
  assert.equal(
    viewState.wallReservoirAuthority.schema,
    'peercompute.ulg.sph-wall-reservoir-authority.v0'
  );
  assert.equal(
    viewState.wallReservoirAuthority.model,
    'infinite-fixed-temperature-reservoir'
  );
  assert.equal(viewState.wallReservoirAuthority.exchangeEnabled, true);
  assert.equal(viewState.ambientTemperatureK, 247.5);
  assert.equal(viewState.scenario.ambientTemperatureK, 247.5);
  assert.equal(
    viewState.thermalEnvironmentAuthority.schema,
    'peercompute.ulg.sph-thermal-environment-authority.v0'
  );
  assert.equal(
    viewState.thermalEnvironmentAuthority.source,
    'scenario-ambient-temperature-override'
  );
  assert.equal(
    viewState.thermalEnvironmentAuthority.sourceScenarioId,
    'sph-phase-ice-on-molten-iron'
  );
});

test('SPH phase scenario carries six finite wall faces while adiabatic disables exchange', () => {
  const scenario = createSphPhaseScenario({
    wallModel: 'adiabatic',
    wallTemperatureK: 238.5
  });
  assert.equal(scenario.walls.model, 'adiabatic');
  assert.equal(scenario.wallReservoirAuthority.model, 'adiabatic');
  assert.equal(scenario.wallReservoirAuthority.exchangeEnabled, false);
  assert.equal(scenario.wallReservoirAuthority.finiteCapacity, false);
  assert.deepEqual(scenario.wallReservoirAuthority.faces, {
    xMin: 238.5,
    xMax: 238.5,
    yMin: 238.5,
    yMax: 238.5,
    zMin: 238.5,
    zMax: 238.5
  });
  assert.throws(
    () => createSphPhaseScenario({
      wallFaces: { zMax: Number.POSITIVE_INFINITY }
    }),
    /wallTemperaturesK.zMax must be finite/
  );
  assert.throws(
    () => createSphPhaseScenario({ wallModel: 'finite-capacity' }),
    /wallModel must be/
  );
});

test('SPH phase scenario derives ambient from gas temperature and fails closed on nonfinite ambient', () => {
  const scenario = createSphPhaseScenario({ gasInitialTemperatureK: 241.25 });
  assert.equal(scenario.ambientTemperatureK, 241.25);
  assert.equal(
    scenario.thermalEnvironment.source,
    'scenario-gas-initial-temperature'
  );
  assert.throws(
    () => createSphPhaseScenario({ ambientTemperatureK: Number.NaN }),
    /ambientTemperatureK must be finite/
  );
});

test('SPH phase view state exposes resolved initial particle spacing', () => {
  const demo = buildSphPhaseDemoState({
    dropParticleEdge: 3,
    baseParticleEdge: 5
  });
  const viewState = createSphPhaseViewState({ demo });

  assert.deepEqual(viewState.counts, demo.counts);
  assert.equal(viewState.initialParticleSpacing.schema, 'peercompute.ulg.sph-initial-particle-spacing-plan.v0');
  assert.equal(viewState.initialParticleSpacing.targetNeighborCount, 64);
  assert.equal(viewState.initialParticleSpacing.smoothingLengthM, demo.initialParticleSpacing.smoothingLengthM);
  assert.equal(viewState.initialParticleSpacing.drop.particlesPerEdge, demo.initialParticleSpacing.drop.particlesPerEdge);
  assert.equal(viewState.initialParticleSpacing.base.particlesPerEdge, demo.initialParticleSpacing.base.particlesPerEdge);
  assert.equal(viewState.particleRadiiM.length, demo.counts.total);
  assert.ok(viewState.particleRadiiM.every((value, index) => (
    viewState.materials[index]?.phaseCompanionSlot === true ? value === 0 : value > 0
  )));
  const spareIndex = demo.state.particles.findIndex((particle) => particle.spareProductSlot === true);
  assert.ok(spareIndex >= 0);
  assert.equal(viewState.materials[spareIndex].particleMassKg, 0);
  assert.equal(viewState.materials[spareIndex].spareProductSlot, true);
  const liveIndex = demo.state.particles.findIndex((particle) => particle.massKg > 0);
  assert.ok(liveIndex >= 0);
  assert.ok(viewState.materials[liveIndex].particleMassKg > 0);
  assert.equal(
    viewState.initialParticleSpacing.drop.volumeEquivalentParticleRadiusM,
    demo.initialParticleSpacing.drop.volumeEquivalentParticleRadiusM
  );
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

test('fresh resident gas ledger outranks a prior pressure-interface spatial generation', () => {
  const demo = buildSphPhaseDemoState({ dropParticleEdge: 1, baseParticleEdge: 1 });
  const baseline = gasPressureSummary(demo);
  const priorSpatialLedger = {
    schema: 'peercompute.ulg.sph-spatial-gas-species-ledger.v0',
    status: 'spatial-gas-species-ledger-ready',
    source: 'prior-generation',
    cells: [{
      gridIndex: [0, 0, 0],
      centerM: [0.5, 0.5, 0.5],
      volumeM3: 1,
      species: [{ material: 'h2', massKg: 0.002016, moles: 1, temperatureK: 300 }]
    }]
  };
  const pressure = gasPressureSummaryFromResidentReaction({
    baselineSummary: baseline,
    reactionSummary: {
      status: 'reaction-compact-summary-ready',
      compactLedgerAvailable: true,
      strictReactionGate: {
        schema: 'peercompute.ulg.sph-reaction-strict-gate.v0',
        status: 'strict-reaction-gate-pass',
        strictForceCouplingAllowed: true,
        blockers: [],
        provisionalEnergetics: []
      }
    },
    residentProductMass: {
      status: 'resident-product-mass-merged-gpu-resident',
      productEventGenerationCount: 2,
      gasSpeciesLedger: {
        schema: 'peercompute.ulg.sph-gpu-reaction-gas-species-summary.v0',
        status: 'gas-species-resident-ledger-ready',
        bySpecies: {
          h2: {
            material: 'h2',
            massKg: 0.006048,
            moles: 3,
            visibleMassKg: 0,
            unplacedMassKg: 0.006048
          }
        }
      }
    },
    pressureInterfaceState: {
      schema: 'peercompute.ulg.sph-resident-pressure-interface-state.v0',
      status: 'resident-pressure-interface-force-rows-ready',
      spatialGasLedgerProducerStageRequest: {
        spatialGasLedgerProducerStageResultReady: true,
        spatialGasSpeciesLedger: priorSpatialLedger
      }
    },
    materialProperties: demo.materialProperties,
    fallbackTemperatureK: 300
  });

  assert.equal(pressure.source, 'gpu-resident-product-mass-gas-species-ledger');
  assert.equal(pressure.bySpecies.h2.moles, 3);
  assert.notEqual(pressure.spatialGasSpeciesLedger, priorSpatialLedger);
  assert.equal(pressure.strictReactionGateRequired, true);
  assert.equal(pressure.pressureFeedback.strictReactionGateStatus, 'strict-reaction-gate-pass');
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
  const feedback = gasPressureFeedbackSummary({
    pressureSummary,
    materialInterfaceField,
    externalPressurePa: 0
  });
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

test('resident reaction gas pressure promotes pressure-interface spatial ledger without compact readback', () => {
  const gasR = 8.314462618;
  const volumeM3 = 4;
  const temperatureK = 300;
  const molesForPressure = (pressurePa) => pressurePa * volumeM3 / (gasR * temperatureK);
  const demo = buildSphPhaseDemoState({ dropParticleEdge: 1, baseParticleEdge: 1 });
  const baseline = {
    ...gasPressureSummary(demo),
    gasVolumeM3: 8,
    boxVolumeM3: 8,
    boxDimsM: [2, 2, 2],
    bySpecies: {}
  };
  const spatialGasSpeciesLedger = {
    schema: 'peercompute.ulg.sph-spatial-gas-species-ledger.v0',
    status: 'spatial-gas-species-ledger-ready',
    source: 'scene-mounted-pressure-interface-spatial-gas-ledger-producer',
    retainedSpatialGasSourceBufferRefs: ['resident-product-mass-buffer'],
    spatialGasSourceBufferRetained: true,
    cellDims: [2, 1, 1],
    cells: [
      {
        gridIndex: [0, 0, 0],
        centerM: [0.5, 1, 1],
        volumeM3,
        species: [
          { material: 'h2', materialId: 1, massKg: 0.001, moles: molesForPressure(100000), temperatureK }
        ]
      },
      {
        gridIndex: [1, 0, 0],
        centerM: [1.5, 1, 1],
        volumeM3,
        species: [
          { material: 'h2', materialId: 1, massKg: 0.002, moles: molesForPressure(200000), temperatureK }
        ]
      }
    ]
  };
  const pressure = gasPressureSummaryFromResidentReaction({
    baselineSummary: baseline,
    reactionSummary: {
      status: 'reaction-compact-summary-gpu-resident',
      compactLedgerAvailable: false,
      fullParticleReadbackPerformed: false
    },
    residentProductMass: {
      status: 'resident-product-mass-buffer-retained',
      productEventBufferRetained: true,
      productEventRowCount: 2
    },
    pressureInterfaceState: {
      schema: 'peercompute.ulg.sph-resident-pressure-interface-state.v0',
      status: 'resident-pressure-interface-blocked',
      spatialGasLedgerProducerStageRequest: {
        status: 'spatial-gas-ledger-producer-stage-result-ready',
        spatialGasLedgerProducerStageResultReady: true,
        spatialGasSpeciesLedger
      }
    },
    materialProperties: {},
    fallbackTemperatureK: temperatureK
  });

  assert.equal(pressure.status, 'gpu-resident-pressure-interface-spatial-gas-summary');
  assert.equal(pressure.source, 'gpu-resident-pressure-interface-spatial-gas-ledger');
  assert.equal(pressure.fullParticleReadbackPerformed, false);
  assert.equal(pressure.pressureInterfaceSpatialGasLedgerPromoted, true);
  assert.equal(pressure.spatialGasSpeciesLedger, spatialGasSpeciesLedger);
  assert.equal(pressure.residentSpatialGasSpeciesLedgerStatus, 'spatial-gas-species-ledger-ready');
  assert.deepEqual(pressure.retainedSpatialGasSourceBufferRefs, ['resident-product-mass-buffer']);
  assert.equal(pressure.pressureFeedback.gasCellField.localPressureGradientReady, true);
  assert.equal(pressure.pressureFeedback.gasCellField.spatialGasSourceBufferRetained, true);
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
  assert.equal(boosted.pressureFeedback.strictReactionGateRequired, true);
  assert.equal(boosted.pressureFeedback.forceCouplingStatus, 'blocked-strict-reaction-gate');
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
        gapM: 0.2,
        normalVelocityMPerS: 0,
        representativeMassKg: 0,
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
        gapM: 0.2,
        normalVelocityMPerS: 0,
        representativeMassKg: 0,
        status: 'interface-element-ready'
      }
    ]
  };
  const pressureFeedback = gasPressureFeedbackSummary({
    pressureSummary,
    materialInterfaceField,
    externalPressurePa: 0
  });
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

  const atmosphericFeedback = gasPressureFeedbackSummary({
    pressureSummary: {
      ...pressureSummary,
      totalPressurePa: 102000
    },
    materialInterfaceField,
    externalPressurePa: 101325
  });
  const atmosphericSolver = gasPressureInterfaceForceSolver({
    pressureFeedback: atmosphericFeedback,
    materialInterfaceField,
    pressureInterfaceCoupling: atmosphericFeedback.pressureInterfaceCoupling
  });
  assert.equal(atmosphericSolver.gasInterfacePressurePa, 102000);
  assert.equal(atmosphericSolver.gasInterfacePressureReferencePa, 101325);
  assert.equal(atmosphericSolver.gasInterfaceGaugePressurePa, 675);
  assert.equal(atmosphericSolver.forceRows[0].absoluteGasPressurePa, 102000);
  assert.equal(atmosphericSolver.forceRows[0].gasGaugePressurePa, 675);
  assert.equal(atmosphericSolver.forceRows[0].pressurePa, 675);
  assert.deepEqual(atmosphericSolver.forceRows[0].materialForceN, [-675, 0, 0]);
  assert.equal(atmosphericSolver.totalAbsMaterialForceN, 1350);

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

test('gas pressure interface solver adds bounded algorithm contact pair response', () => {
  const pressureSummary = {
    schema: 'peercompute.ulg.sph-pressure-summary.v0',
    status: 'resident-pressure-ready',
    totalPressurePa: 100000,
    boxDimsM: [2, 2, 2],
    boxVolumeM3: 8
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
        gapM: 0.2,
        normalVelocityMPerS: 0,
        representativeMassKg: 0,
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
        gapM: 0.2,
        normalVelocityMPerS: 0,
        representativeMassKg: 0,
        status: 'interface-element-ready'
      }
    ]
  };
  const algorithmMaterialContactRows = {
    schema: 'peercompute.ulg.algorithm-material-contact-rows.v0',
    status: 'algorithm-derived-contact-rows-ready',
    rowCount: 1,
    rows: [
      {
        status: 'algorithm-derived-contact-row-ready',
        pairKey: 'drop:Na|base:h2o',
        roles: ['drop', 'base'],
        materials: ['Na', 'h2o'],
        materialIds: [2, 1],
        phases: ['solid', 'liquid'],
        phaseIds: [1, 2],
        normalStiffnessPa: 4e9,
        dampingViscosityPaS: 0.001,
        supportRadiusM: 0.25,
        forceMutationAuthority: 'not-authoritative-contact-policy-row'
      }
    ]
  };
  const pressureFeedback = gasPressureFeedbackSummary({
    pressureSummary,
    materialInterfaceField,
    externalPressurePa: 0
  });
  const solver = gasPressureInterfaceForceSolver({
    pressureFeedback,
    materialInterfaceField,
    pressureInterfaceCoupling: pressureFeedback.pressureInterfaceCoupling,
    algorithmMaterialContactRows,
    algorithmContactPairResponseScale: 1e-4,
    algorithmContactMaxPressurePa: 500000
  });

  assert.equal(solver.status, 'pressure-interface-force-solver-ready');
  assert.equal(solver.algorithmContactPairResponseStatus, 'algorithm-contact-pair-response-applied');
  assert.equal(solver.algorithmContactPolicyRowCount, 1);
  assert.equal(solver.algorithmContactForceRowCount, 2);
  assert.equal(solver.interfaceContactKinematicsReadyCount, 2);
  assert.deepEqual(solver.algorithmContactPairKeys, ['drop:Na|base:h2o']);
  assert.equal(solver.forceResolution, 'uniform-interface-traction+algorithm-contact-pair-response');
  near(solver.gasInterfacePressureRangePa[0], 225000);
  near(solver.gasInterfacePressureRangePa[1], 225000);
  near(solver.forceRows[0].algorithmContactPressurePa, 125000);
  near(solver.forceRows[1].algorithmContactPressurePa, 125000);
  near(solver.forceRows[0].materialForceN[0], -225000);
  near(solver.forceRows[1].materialForceN[0], 225000);
  const packed = [...solver.forceRowValues.slice(8, 16)];
  near(packed[0], -225000);
  assert.deepEqual(packed.slice(1, 6), [0, 0, 225000, 0, 0]);
  near(packed[6], 225000);
  assert.equal(packed[7], 1);
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
  const pressureFeedback = gasPressureFeedbackSummary({
    pressureSummary,
    materialInterfaceField,
    externalPressurePa: 0
  });
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

test('resident thermal H2O gas mass reconstructs a species-resolved pressure summary without particle readback', () => {
  const demo = buildSphPhaseDemoState({ dropParticleEdge: 1, baseParticleEdge: 1 });
  const baseline = gasPressureSummary(demo);
  const pressure = gasPressureSummaryFromResidentThermalPhase({
    baselineSummary: baseline,
    gasMassKg: 0.75,
    material: 'h2o',
    materialProperties: demo.materialProperties,
    temperatureK: 390
  });

  assert.equal(pressure.status, 'gpu-resident-thermal-phase-pressure-summary');
  assert.equal(pressure.source, 'gpu-resident-compact-thermal-phase-single-species');
  assert.equal(pressure.fullParticleReadbackPerformed, false);
  assert.equal(pressure.residentThermalGasMaterial, 'h2o');
  assert.equal(pressure.residentThermalGasMassKg, 0.75);
  assert.ok(pressure.bySpecies.h2o.moles > 0);
  assert.ok(pressure.bySpecies.h2o.partialPressurePa > 0);
  assert.ok(pressure.bySpecies.h2o.temperatureK >= 390);
  assert.ok(pressure.bySpecies.air.partialPressurePa > 0);
  assert.ok(pressure.gasVolumeM3 >= baseline.gasVolumeM3);
  assert.equal(pressure.strictReactionGateRequired, false);
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
