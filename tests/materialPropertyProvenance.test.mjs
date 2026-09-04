import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArtifactCache } from '../src/runtime/ArtifactCache.js';
import { ClosureRegistry } from '../src/runtime/ClosureRegistry.js';
import { MaterialRegistry } from '../src/runtime/material/MaterialRegistry.js';
import { createFirstPrinciplesMaterialClosures, createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { deriveCompoundClosure } from '../src/runtime/material/compoundClosure.js';
import {
  CONDENSED_DISPERSED_OPTICAL_REFERENCE_SOURCE
} from '../src/runtime/material/condensedDispersedOpticalReferences.js';
import {
  createReferenceAnchoredMaterialClosure
} from '../src/runtime/material/materialDerivation.js';
import {
  PROPERTY_DERIVATION_STATUS as DS,
  MaterialFirstPrinciplesResolutionError,
  assertFullyLowerLevelDerived,
  assertNoUnprovenancedMaterialProperties,
  materialDerivationSummary,
  provenanceEntriesForPath,
  trackedMaterialPropertyPaths
} from '../src/runtime/material/propertyProvenance.js';
import { materialComposition, discoverReactions } from '../src/runtime/sph/reactionDiscovery.js';

const STD_ATM = 101325;

async function freshRegistry() {
  const registry = new MaterialRegistry({
    closureRegistry: new ClosureRegistry({ artifactCache: new ArtifactCache() })
  });
  await registry.registerAll(createFirstPrinciplesMaterialClosures());
  return registry;
}

test('every material closure carries per-property provenance', () => {
  const closures = createReferenceMaterialClosures();
  for (const closure of Object.values(closures)) {
    assertNoUnprovenancedMaterialProperties(closure.properties);
    assert.equal(closure.materialDerivation.trackedPropertyCount, materialDerivationSummary(closure.properties).trackedPropertyCount);
  }
});

test('live and fixture H2O share a tracked physical sphere optical closure', () => {
  const fixture = createReferenceMaterialClosures().h2o.properties;
  const live = createReferenceAnchoredMaterialClosure('h2o').properties;
  assert.deepEqual(
    live.dispersedMediumOpticalClosure,
    fixture.dispersedMediumOpticalClosure
  );
  assert.equal(
    live.dispersedMediumOpticalClosure.condensedDensityKgPerM3,
    live.phases.find((phase) => phase.name === 'liquid').densityKgPerM3
  );
  assert.equal(live.dispersedMediumOpticalClosure.scientificValidation, false);
  assert.match(
    live.dispersedMediumOpticalClosure.provenance.method,
    /conserved condensed mass.*sphere|compact-sphere radius.*conserved condensed mass/i
  );
  assert.doesNotMatch(
    live.dispersedMediumOpticalClosure.provenance.method,
    /qualitative|presentation|lower.bound/i
  );

  const expectedPaths = [
    'dispersedMediumOpticalClosure.schema',
    'dispersedMediumOpticalClosure.morphologyModel',
    'dispersedMediumOpticalClosure.condensedDensityKgPerM3',
    'dispersedMediumOpticalClosure.relativeRefractiveIndexN',
    'dispersedMediumOpticalClosure.relativeExtinctionCoefficientK',
    'dispersedMediumOpticalClosure.largeSizeRayAsymmetryFactorG',
    'dispersedMediumOpticalClosure.referenceWavelengthM',
    'dispersedMediumOpticalClosure.provenance',
    'dispersedMediumOpticalClosure.scientificValidation'
  ];
  const tracked = trackedMaterialPropertyPaths(live);
  for (const path of expectedPaths) assert.ok(tracked.includes(path), path);

  const densityEntries = provenanceEntriesForPath(
    live,
    'dispersedMediumOpticalClosure.condensedDensityKgPerM3'
  );
  const morphologyEntries = provenanceEntriesForPath(
    live,
    'dispersedMediumOpticalClosure.morphologyModel'
  );
  assert.equal(densityEntries.at(-1).source, 'material-property-reference-bank');
  assert.equal(
    morphologyEntries.at(-1).source,
    'reference-index-runtime-radius-sphere-optics'
  );
  assert.notEqual(densityEntries.at(-1).source, morphologyEntries.at(-1).source);

  for (const removedPath of expectedPaths) {
    const mutated = {
      ...live,
      propertyProvenance: {
        ...live.propertyProvenance,
        entries: live.propertyProvenance.entries.map((entry) => ({
          ...entry,
          paths: entry.paths.filter((path) => path !== removedPath)
        }))
      }
    };
    assert.throws(
      () => assertNoUnprovenancedMaterialProperties(mutated),
      /missing provenance/,
      removedPath
    );
  }

  const untrackedRadius = {
    ...live,
    dispersedMediumOpticalClosure: {
      ...live.dispersedMediumOpticalClosure,
      effectiveRadiusM: 1e-6
    }
  };
  assert.throws(
    () => assertNoUnprovenancedMaterialProperties(untrackedRadius),
    /effectiveRadiusM/
  );
});

test('reference-backed reduced NaOH optics are completely tracked but remain unvalidated', () => {
  const properties = deriveCompoundClosure({
    key: 'naoh',
    label: 'NaOH',
    atomCounts: { 1: 1, 8: 1, 11: 1 },
    reactants: [
      {
        material: 'Na',
        molarMassKgPerMol: 0.022989769,
        densityKgPerM3: 968,
        bulkModulusPa: 6.3e9,
        thermalConductivityWPerMK: 142
      },
      {
        material: 'H2O',
        molarMassKgPerMol: 0.01801528,
        densityKgPerM3: 997,
        bulkModulusPa: 2.2e9,
        thermalConductivityWPerMK: 0.6
      }
    ],
    allowReducedEstimates: true
  }).properties;

  assert.doesNotThrow(() => assertNoUnprovenancedMaterialProperties(properties));
  const summary = materialDerivationSummary(properties);
  assert.equal(summary.fullyLowerLevelDerived, false);
  assert.equal(summary.hasReferenceFallbacks, true);
  assert.equal(properties.dispersedMediumOpticalClosure.scientificValidation, false);
  assert.equal(
    properties.dispersedMediumOpticalClosure.provenance.source,
    CONDENSED_DISPERSED_OPTICAL_REFERENCE_SOURCE
  );
  for (const path of [
    'dispersedMediumOpticalClosure.condensedDensityKgPerM3',
    'dispersedMediumOpticalClosure.relativeRefractiveIndexN',
    'dispersedMediumOpticalClosure.relativeExtinctionCoefficientK',
    'dispersedMediumOpticalClosure.largeSizeRayAsymmetryFactorG',
    'dispersedMediumOpticalClosure.referenceWavelengthM'
  ]) {
    const entries = provenanceEntriesForPath(properties, path);
    assert.ok(entries.length > 0, path);
    assert.equal(entries.at(-1).status, DS.REFERENCE_FALLBACK, path);
    assert.equal(entries.at(-1).source, CONDENSED_DISPERSED_OPTICAL_REFERENCE_SOURCE, path);
  }
});

test('reference-backed H2O/Fe remain blocked while production closures are fully derived', () => {
  const referenceClosures = createReferenceMaterialClosures();
  for (const key of ['h2o', 'fe']) {
    const summary = materialDerivationSummary(referenceClosures[key].properties);
    assert.equal(summary.fullyLowerLevelDerived, false);
    assert.equal(summary.hasReferenceFallbacks, true);
    assert.ok(summary.blockers.length > 0, `${key} must name lower-level blockers`);
    assert.throws(() => assertFullyLowerLevelDerived(referenceClosures[key].properties), /not fully lower-level-derived/);
  }

  const productionClosures = createFirstPrinciplesMaterialClosures();
  for (const key of ['h2o', 'fe', 'air', 'h2', 'o2']) {
    const summary = materialDerivationSummary(productionClosures[key].properties);
    assert.equal(summary.fullyLowerLevelDerived, true);
    assert.equal(summary.hasReferenceFallbacks, false);
    assert.equal(summary.hasReducedEstimates, false);
    assert.deepEqual(summary.blockers, []);
    assert.doesNotThrow(() => assertFullyLowerLevelDerived(productionClosures[key].properties));
  }
});

test('strict MaterialRegistry rejects non-first-principles closures by default', async () => {
  const registry = new MaterialRegistry({ closureRegistry: new ClosureRegistry({ artifactCache: new ArtifactCache() }) });
  await assert.rejects(
    () => registry.register(createReferenceMaterialClosures().fe),
    (error) => error instanceof MaterialFirstPrinciplesResolutionError
      && error.code === 'material-properties-not-first-principles'
      && error.material === 'fe'
  );

  const refs = await registry.registerAll(createFirstPrinciplesMaterialClosures());
  assert.ok(refs.h2o.uri.startsWith('artifact://'));
  const feDensity = await registry.sampleProperty({ material: 'fe', property: 'density', temperatureK: 300, pressurePa: STD_ATM });
  assert.equal(feDensity.status, 'sampled');
  const h2Density = await registry.sampleProperty({ material: 'h2', property: 'density', temperatureK: 300, pressurePa: STD_ATM });
  assert.equal(h2Density.status, 'sampled');
});

test('MaterialRegistry samples return provenance for the sampled property', async () => {
  const registry = await freshRegistry();
  const ironDensity = await registry.sampleProperty({ material: 'fe', property: 'density', temperatureK: 300, pressurePa: STD_ATM });
  assert.equal(ironDensity.status, 'sampled');
  assert.equal(ironDensity.provenance.path, 'phases.solid.densityKgPerM3');
  assert.ok(ironDensity.provenance.entries.some((entry) => entry.status === DS.LOWER_LEVEL_SIMULATION));
  assert.equal(ironDensity.provenance.derivationSummary.fullyLowerLevelDerived, true);
  assert.equal(ironDensity.provenance.derivationSummary.hasReferenceFallbacks, false);

  const h2Density = await registry.sampleProperty({ material: 'h2', property: 'density', temperatureK: 300, pressurePa: STD_ATM });
  assert.equal(h2Density.status, 'sampled');
  assert.equal(h2Density.provenance.path, 'idealGas');
  assert.ok(h2Density.provenance.entries.some((entry) => entry.status === DS.PHYSICAL_LAW));
  assert.equal(h2Density.provenance.derivationSummary.fullyLowerLevelDerived, true);
});

test('reaction discovery uses material closure metadata for phase boundaries and product properties', () => {
  const closures = createFirstPrinciplesMaterialClosures();
  const materialProperties = Object.fromEntries(Object.entries(closures).map(([key, closure]) => [key, closure.properties]));
  const waterComp = materialComposition('h2o', { materialProperties });
  assert.equal(waterComp.meltingPointK, materialProperties.h2o.transitions[0].temperatureK);
  assert.deepEqual(waterComp.reactivePhases, ['liquid', 'gas']);
  assert.equal(waterComp.materialDerivation.fullyLowerLevelDerived, true);

  const discovered = discoverReactions('Na', 'h2o', { materialProperties });
  const product = discovered.productClosures.naoh;
  assert.ok(product);
  assertNoUnprovenancedMaterialProperties(product.properties);
  const productSummary = materialDerivationSummary(product.properties);
  assert.equal(productSummary.fullyLowerLevelDerived, true);
  assert.equal(productSummary.hasReducedEstimates, false);
  assert.deepEqual(productSummary.blockers, []);

  const ironOxide = discoverReactions('fe', 'o2', { materialProperties });
  assert.equal(ironOxide.reactions.length, 1);
  assert.equal(ironOxide.reactions[0].energyModel, 'atomic-kohn-sham-tight-binding-v0');
  assert.ok(ironOxide.productClosures.feo);
  assertNoUnprovenancedMaterialProperties(ironOxide.productClosures.feo.properties);
  const ironProductSummary = materialDerivationSummary(ironOxide.productClosures.feo.properties);
  assert.equal(ironProductSummary.fullyLowerLevelDerived, true);
  assert.equal(ironProductSummary.hasReducedEstimates, false);
  assert.deepEqual(ironProductSummary.blockers, []);
});

test('reaction discovery resolves strict reactants and products by default', () => {
  const sodiumWater = discoverReactions('Na', 'h2o');
  assert.equal(sodiumWater.reactions.length, 1);
  assert.ok(sodiumWater.productClosures.naoh);
  assert.equal(materialDerivationSummary(sodiumWater.productClosures.naoh.properties).fullyLowerLevelDerived, true);

  const hydrogenOxygen = discoverReactions('h2', 'o2');
  assert.equal(hydrogenOxygen.reactions.length, 1);
  assert.equal(hydrogenOxygen.reactions[0].product, 'h2o');

  const ironOxygen = discoverReactions('fe', 'o2');
  assert.equal(ironOxygen.reactions.length, 1);
  assert.equal(ironOxygen.reactions[0].product, 'feo');
  assert.equal(materialDerivationSummary(ironOxygen.productClosures.feo.properties).fullyLowerLevelDerived, true);
});
