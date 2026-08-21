import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  REACTION_DISCOVERY_CACHE_RECORD_SCHEMA,
  REACTION_NETWORK_DISCOVERY_SCHEMA,
  clearReactionDiscoveryCache,
  createReactionDiscoveryCacheKey,
  discoverReactionNetwork,
  discoverReactions,
  reactionDiscoveryCacheInfo
} from '../src/runtime/sph/reactionDiscovery.js';
import {
  createReferenceAnchoredMaterialClosure,
  deriveMaterialProperties
} from '../src/runtime/material/materialDerivation.js';
import {
  materialDerivationSummary,
  PROPERTY_DERIVATION_STATUS,
  provenanceEntriesForPath
} from '../src/runtime/material/propertyProvenance.js';

test('active metal + water is discovered as exothermic, with a derived hydroxide product', () => {
  const r = discoverReactions('Na', 'h2o');
  assert.equal(r.reactions.length, 1);
  const rx = r.reactions[0];
  assert.equal(rx.product, 'naoh');
  assert.equal(rx.stoichiometry.equation, '2 Na + 2 H2O -> 2 NaOH + H2');
  assert.deepEqual(rx.stoichiometry.products.map((term) => term.formula), ['NaOH', 'H2']);
  assert.equal(rx.stoichiometry.atomBalance.balanced, true);
  assert.equal(rx.stoichiometry.provisionalEnergeticsStatus, null);
  assert.equal(rx.stoichiometry.energeticsStatus, 'standard-reaction-enthalpy-reference-ready');
  assert.equal(rx.energyModel, 'nist-janaf-standard-formation-enthalpy-298.15k-v0');
  assert.equal(
    rx.stoichiometry.thermochemicalReference.reactionEnthalpyJPerBalancedEquation,
    -280_200
  );
  assert.equal(rx.stoichiometry.specificEnthalpyBasis, 'consumed-reactant-mass');
  assert.ok(Math.abs(
    rx.specificEnthalpyJPerKg * rx.stoichiometry.balancedReactantMassKgPerEquation
      - rx.stoichiometry.thermochemicalReference.reactionEnthalpyJPerBalancedEquation
  ) < 1e-6);
  assert.ok(rx.specificEnthalpyJPerKg < 0, 'must be exothermic');
  assert.equal(rx.activationTemperatureK, 0);
  assert.equal(rx.activationModel, 'barrier-not-yet-derived-alkali-metal-water-reactive-reacts-on-exothermic-contact-with-liquid-water');
  assert.deepEqual(rx.phaseRequirements, { h2o: ['liquid', 'gas'] });
  assert.ok(rx.specificEnthalpyJPerKg < -3.4e6 && rx.specificEnthalpyJPerKg > -3.5e6);
  // The product compound closure is supplied for registration, with a derived colour.
  const closure = r.productClosures['naoh'];
  assert.ok(closure, 'product closure provided');
  assert.equal(closure.properties.intrinsicColorSrgb.length, 3);
  assert.ok(closure.properties.phases[0].densityKgPerM3 > 0);
  assert.equal(materialDerivationSummary(closure.properties).fullyLowerLevelDerived, true);
});

test('anchored sodium-water discovery gives reduced NaOH a provenance-marked harmonic conductivity', () => {
  clearReactionDiscoveryCache();
  const sodium = createReferenceAnchoredMaterialClosure('Na').properties;
  const water = createReferenceAnchoredMaterialClosure('h2o').properties;
  const materialProperties = { Na: sodium, h2o: water };
  const result = discoverReactions('Na', 'h2o', {
    materialProperties,
    allowReducedProductProperties: true
  });
  const phase = result.productClosures.naoh.properties.phases
    .find((candidate) => candidate.name === 'liquid');
  const sodiumConductivity = sodium.phases
    .find((candidate) => candidate.name === 'solid').thermalConductivityWPerMK;
  const waterConductivity = water.phases
    .find((candidate) => candidate.name === 'liquid').thermalConductivityWPerMK;
  const expected = 2 / (1 / sodiumConductivity + 1 / waterConductivity);

  assert.ok(Number.isFinite(phase.thermalConductivityWPerMK));
  assert.ok(phase.thermalConductivityWPerMK > 0);
  assert.ok(Math.abs(phase.thermalConductivityWPerMK - expected) < 1e-12);
  const provenance = provenanceEntriesForPath(
    result.productClosures.naoh.properties,
    'phases.liquid.thermalConductivityWPerMK'
  );
  assert.equal(provenance.length, 1);
  assert.equal(provenance[0].status, PROPERTY_DERIVATION_STATUS.REDUCED_ESTIMATE);
  assert.match(provenance[0].method, /harmonic-mean representative conductivity/);
});

test('reduced product conductivity fails closed when a reactant phase lacks conductivity', () => {
  clearReactionDiscoveryCache();
  const sodium = createReferenceAnchoredMaterialClosure('Na').properties;
  const water = createReferenceAnchoredMaterialClosure('h2o').properties;
  const waterWithoutConductivity = {
    ...water,
    phases: water.phases.map((phase) => (
      phase.name === 'liquid'
        ? { ...phase, thermalConductivityWPerMK: 0 }
        : phase
    ))
  };
  const result = discoverReactions('Na', 'h2o', {
    materialProperties: { Na: sodium, h2o: waterWithoutConductivity },
    allowReducedProductProperties: true
  });

  assert.equal(
    result.productClosures.naoh.properties.phases[0].thermalConductivityWPerMK,
    0
  );
});

test('reaction discovery cache identity includes representative phase conductivity', () => {
  const sodium = createReferenceAnchoredMaterialClosure('Na').properties;
  const water = createReferenceAnchoredMaterialClosure('h2o').properties;
  const changedWater = {
    ...water,
    phases: water.phases.map((phase) => (
      phase.name === 'liquid'
        ? { ...phase, thermalConductivityWPerMK: phase.thermalConductivityWPerMK * 2 }
        : phase
    ))
  };
  const options = { allowReducedProductProperties: true };
  const first = createReactionDiscoveryCacheKey('Na', 'h2o', {
    ...options,
    materialProperties: { Na: sodium, h2o: water }
  });
  const second = createReactionDiscoveryCacheKey('Na', 'h2o', {
    ...options,
    materialProperties: { Na: sodium, h2o: changedWater }
  });

  assert.notEqual(first, second);
});

test('active metal + water discovery uses the general family in the SPH adapter', () => {
  for (const [metal, product, equation] of [
    ['Li', 'lioh', '2 Li + 2 H2O -> 2 LiOH + H2'],
    ['Na', 'naoh', '2 Na + 2 H2O -> 2 NaOH + H2'],
    ['Cs', 'csoh', '2 Cs + 2 H2O -> 2 CsOH + H2'],
    ['Ca', 'caoh2', 'Ca + 2 H2O -> Ca(OH)2 + H2']
  ]) {
    const r = discoverReactions(metal, 'h2o', { allowReducedProductProperties: true });
    assert.equal(r.reactions.length, 1);
    assert.equal(r.reactions[0].product, product);
    assert.equal(r.reactions[0].stoichiometry.equation, equation);
    assert.equal(r.reactions[0].stoichiometry.familyId, 'active-metal-water-hydroxide');
    assert.equal(r.reactions[0].stoichiometry.atomBalance.balanced, true);
    assert.ok(r.productClosures[product]);
  }
});

test('hydrogen + oxygen combustion is discovered and yields water', () => {
  const r = discoverReactions('h2', 'o2');
  assert.equal(r.reactions.length, 1);
  assert.equal(r.reactions[0].product, 'h2o');
  assert.ok(r.reactions[0].specificEnthalpyJPerKg < 0);
});

test('metal + oxygen is discovered as oxide formation', () => {
  const r = discoverReactions('Mg', 'o2');
  assert.equal(r.reactions.length, 1);
  assert.equal(r.reactions[0].product, 'mgo');
  assert.equal(r.reactions[0].stoichiometry.equation, '2 Mg + O2 -> 2 MgO');
  assert.equal(r.reactions[0].stoichiometry.atomBalance.balanced, true);
  assert.ok(r.reactions[0].specificEnthalpyJPerKg < 0);
  assert.equal(materialDerivationSummary(r.productClosures.mgo.properties).fullyLowerLevelDerived, true);
});

test('elemental nonmetal material selections discover balanced binary products generally', () => {
  const elementalChlorine = discoverReactions('Na', 'Cl', { allowReducedProductProperties: true });
  assert.equal(elementalChlorine.reactions.length, 1);
  assert.equal(elementalChlorine.reactions[0].product, 'nacl');
  assert.equal(elementalChlorine.reactions[0].stoichiometry.equation, '2 Na + Cl2 -> 2 NaCl');
  assert.equal(elementalChlorine.reactions[0].stoichiometry.atomBalance.balanced, true);

  const molecularChlorine = discoverReactions('Na', 'Cl2', { allowReducedProductProperties: true });
  assert.equal(molecularChlorine.reactions.length, 1);
  assert.equal(molecularChlorine.reactions[0].product, 'nacl');
  assert.equal(molecularChlorine.reactions[0].stoichiometry.equation, '2 Na + Cl2 -> 2 NaCl');
  assert.equal(molecularChlorine.reactions[0].stoichiometry.atomBalance.balanced, true);

});

test('cesium + fluorine uses elemental F2 and carries sedenion zero-divisor scope', () => {
  const result = discoverReactions('Cs', 'F', { allowReducedProductProperties: true });
  assert.equal(result.reactions.length, 1);
  const rx = result.reactions[0];
  assert.equal(rx.product, 'csf');
  assert.equal(rx.stoichiometry.equation, '2 Cs + F2 -> 2 CsF');
  assert.equal(rx.stoichiometry.atomBalance.balanced, true);

  const scope = rx.sedenionScope;
  assert.equal(scope.schema, 'peercompute.ulg.sedenion-reaction-scope.v0');
  assert.equal(scope.status, 'sedenion-zero-divisor-prior');
  assert.equal(scope.reactiveClass, 'reactive');
  assert.equal(scope.bondTypePrior, 'ionic');
  assert.equal(scope.normDefectPrior, -4);
  assert.equal(scope.zeroDivisorPrior, true);
  assert.equal(scope.fanoGroup.id, 'fano-line-2-4-6');
  assert.equal(scope.input.left.elementSymbol, 'Cs');
  assert.equal(scope.input.right.formula, 'F2');
  assert.equal(scope.scientificValidation, false);
  assert.equal(scope.validation.chemistryValidation, false);
  assert.deepEqual(scope.blockers, []);
});

test('strict energetics accepts phase-explicit reference rows and rejects uncovered provisional candidates', () => {
  clearReactionDiscoveryCache();
  const water = discoverReactions('Na', 'h2o', {
    strictEnergetics: true,
    deriveCandidateEnergies: false,
    allowReducedProductProperties: true
  });
  assert.equal(water.reactions.length, 1);
  assert.equal(water.reactions[0].product, 'naoh');
  assert.equal(water.reactions[0].stoichiometry.equation, '2 Na + 2 H2O -> 2 NaOH + H2');
  assert.equal(water.reactions[0].stoichiometry.provisionalEnergeticsStatus, null);
  assert.equal(water.reactions[0].stoichiometry.energeticsStatus, 'standard-reaction-enthalpy-reference-ready');
  assert.equal(water.reactions[0].stoichiometry.thermochemicalReference.thermochemicalReferenceValidation, true);
  assert.equal(water.reactions[0].stoichiometry.thermochemicalReference.simulationPhaseApplicabilityValidation, false);
  assert.ok(water.reactions[0].specificEnthalpyJPerKg < 0);

  clearReactionDiscoveryCache();
  const salt = discoverReactions('Na', 'Cl2', {
    strictEnergetics: true,
    deriveCandidateEnergies: false,
    allowReducedProductProperties: true
  });
  assert.equal(salt.reactions.length, 0);
  assert.deepEqual(salt.blockers, ['needs-refined-thermochemistry']);
  assert.equal(salt.blockedReactionCandidate.product, 'nacl');
  assert.equal(salt.blockedReactionCandidate.stoichiometry.equation, '2 Na + Cl2 -> 2 NaCl');
  assert.equal(salt.blockedReactionCandidate.sedenionScope.schema, 'peercompute.ulg.sedenion-reaction-scope.v0');
  assert.equal(salt.blockedReactionCandidate.sedenionScope.status, 'sedenion-period-proxy-no-zero-divisor-path');
  assert.deepEqual(salt.blockedReactionCandidate.sedenionScope.blockers, ['element-to-sedenion-state-bijection-not-derived']);
  assert.match(salt.note, /strict energetics rejects provisional/);
});

test('heavy-element oxygen reactions switch to the all-element molecular solver while Fe water is blocked', () => {
  const oxide = discoverReactions('fe', 'o2');
  assert.equal(oxide.reactions.length, 1);
  assert.equal(oxide.reactions[0].product, 'feo');
  assert.equal(oxide.reactions[0].energyModel, 'atomic-kohn-sham-tight-binding-v0');
  assert.ok(oxide.reactions[0].specificEnthalpyJPerKg < 0);
  assert.doesNotMatch(oxide.note, /basis|Z/);
  assert.equal(materialDerivationSummary(oxide.productClosures.feo.properties).fullyLowerLevelDerived, true);

  const water = discoverReactions('fe', 'h2o');
  assert.equal(water.reactions.length, 0);
  assert.match(water.note, /no reaction family or candidate/);
  assert.doesNotMatch(water.note, /basis|Z/);
});

test('identical materials on both blocks do not react', () => {
  assert.equal(discoverReactions('h2o', 'h2o').reactions.length, 0);
  assert.equal(discoverReactions('Na', 'Na').reactions.length, 0);
});

test('multi-material reaction discovery canonicalizes materials and evaluates every distinct pair', () => {
  const result = discoverReactionNetwork(['O2', ' Na ', 'h2o', 'na', 'o2', ''], {
    allowReducedProductProperties: true
  });

  assert.equal(result.schema, REACTION_NETWORK_DISCOVERY_SCHEMA);
  assert.deepEqual(result.materials, ['h2o', 'na', 'o2']);
  assert.equal(result.pairCount, 3);
  assert.deepEqual(result.pairDiagnostics.map((diagnostic) => diagnostic.pair), [
    ['h2o', 'na'],
    ['h2o', 'o2'],
    ['na', 'o2']
  ]);
  assert.ok(result.reactions.some((reaction) => reaction.product === 'naoh'));
  assert.ok(result.reactions.some((reaction) => reaction.product === 'na2o'));
  assert.ok(result.productClosures.naoh);
  assert.ok(result.productClosures.na2o);
});

test('multi-material reaction discovery merges equivalent stoichiometries and is input-order independent', () => {
  const options = { allowReducedProductProperties: true };
  const forward = discoverReactionNetwork(['Cs', 'F', 'F2'], options);
  const reverse = discoverReactionNetwork(['f2', 'cs', 'f'], options);

  assert.deepEqual(reverse, forward);
  assert.deepEqual(forward.materials, ['cs', 'f', 'f2']);
  assert.equal(forward.pairCount, 3);
  const cesiumFluoride = forward.reactions.filter((reaction) => reaction.product === 'csf');
  assert.equal(cesiumFluoride.length, 1);
  assert.match(
    cesiumFluoride[0].reactionDiscovery.canonicalStoichiometryIdentity,
    /^stoichiometry:/
  );
  assert.deepEqual(cesiumFluoride[0].reactionDiscovery.sourcePairs, [
    ['cs', 'f'],
    ['cs', 'f2']
  ]);
});

test('multi-material reaction discovery accepts canonical aliases for supplied material properties', () => {
  const materialProperties = {
    Na: deriveMaterialProperties('Na'),
    H2O: deriveMaterialProperties('h2o')
  };
  const result = discoverReactionNetwork(['NA', 'h2o'], {
    materialProperties,
    allowReducedProductProperties: true
  });

  assert.deepEqual(result.materials, ['h2o', 'na']);
  assert.equal(result.pairCount, 1);
  assert.equal(result.reactions[0].product, 'naoh');
  assert.equal(result.pairDiagnostics[0].cacheKey, createReactionDiscoveryCacheKey('h2o', 'na', {
    materialProperties: {
      ...materialProperties,
      h2o: materialProperties.H2O,
      na: materialProperties.Na
    },
    allowReducedProductProperties: true
  }));
});

test('multi-material reaction discovery rejects a non-list material input', () => {
  assert.throws(
    () => discoverReactionNetwork('na,h2o'),
    /materialKeys must be an array/
  );
});

test('material-property-backed reaction discovery caches memory and persisted records', () => {
  clearReactionDiscoveryCache();
  const materialProperties = {
    Na: deriveMaterialProperties('Na'),
    h2o: deriveMaterialProperties('h2o')
  };
  const options = { materialProperties, allowReducedProductProperties: true };
  const expectedCacheKey = createReactionDiscoveryCacheKey('Na', 'h2o', options);

  const first = discoverReactions('Na', 'h2o', options);
  assert.equal(first.cache.cacheStatus, 'derived-cache-miss');
  assert.equal(first.cache.cacheKey, expectedCacheKey);
  assert.equal(reactionDiscoveryCacheInfo().size, 1);

  const second = discoverReactions('h2o', 'Na', options);
  assert.equal(second.cache.cacheStatus, 'memory-cache-hit');
  assert.equal(second.cache.cacheKey, expectedCacheKey);
  assert.equal(second.reactions[0].product, first.reactions[0].product);

  const record = {
    schema: REACTION_DISCOVERY_CACHE_RECORD_SCHEMA,
    cacheKey: first.cache.cacheKey,
    generatorFingerprint: 'test-generator',
    updatedAt: '2026-06-11T00:00:00.000Z',
    result: first
  };
  clearReactionDiscoveryCache();
  const restored = discoverReactions('Na', 'h2o', {
    ...options,
    reactionDiscoveryCacheRecord: record
  });
  assert.equal(restored.cache.cacheStatus, 'persistent-cache-hit');
  assert.equal(restored.cache.cacheKey, expectedCacheKey);
  assert.equal(restored.reactions[0].product, first.reactions[0].product);
  assert.equal(reactionDiscoveryCacheInfo().size, 1);

  const staleRecord = {
    schema: REACTION_DISCOVERY_CACHE_RECORD_SCHEMA,
    cacheKey: first.cache.cacheKey,
    result: {
      ...first,
      reactions: first.reactions.map((reaction) => ({
        ...reaction,
        stoichiometry: {
          familyId: reaction.stoichiometry.familyId,
          equation: reaction.stoichiometry.equation,
          atomBalance: reaction.stoichiometry.atomBalance
        }
      }))
    }
  };
  clearReactionDiscoveryCache();
  const refreshed = discoverReactions('Na', 'h2o', {
    ...options,
    reactionDiscoveryCacheRecord: staleRecord
  });
  assert.equal(refreshed.cache.cacheStatus, 'derived-cache-miss');
  assert.deepEqual(refreshed.reactions[0].stoichiometry.products.map((term) => term.formula), ['NaOH', 'H2']);
});
