import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  REACTION_DISCOVERY_CACHE_RECORD_SCHEMA,
  clearReactionDiscoveryCache,
  createReactionDiscoveryCacheKey,
  discoverReactions,
  reactionDiscoveryCacheInfo
} from '../src/runtime/sph/reactionDiscovery.js';
import { deriveMaterialProperties } from '../src/runtime/material/materialDerivation.js';
import { materialDerivationSummary } from '../src/runtime/material/propertyProvenance.js';

test('active metal + water is discovered as exothermic, with a derived hydroxide product', () => {
  const r = discoverReactions('Na', 'h2o');
  assert.equal(r.reactions.length, 1);
  const rx = r.reactions[0];
  assert.equal(rx.product, 'naoh');
  assert.equal(rx.stoichiometry.equation, '2 Na + 2 H2O -> 2 NaOH + H2');
  assert.deepEqual(rx.stoichiometry.products.map((term) => term.formula), ['NaOH', 'H2']);
  assert.equal(rx.stoichiometry.atomBalance.balanced, true);
  assert.equal(rx.stoichiometry.provisionalEnergeticsStatus, 'provisional-heuristic-not-scientifically-validated');
  assert.ok(rx.specificEnthalpyJPerKg < 0, 'must be exothermic');
  assert.equal(rx.activationTemperatureK, 0);
  assert.equal(rx.activationModel, 'barrier-not-yet-derived-alkali-metal-water-reactive-reacts-on-exothermic-contact-with-liquid-water');
  assert.deepEqual(rx.phaseRequirements, { h2o: ['liquid', 'gas'] });
  // Order of magnitude (light-element RHF/STO-3G; sign + scale, not a validated value).
  assert.ok(rx.specificEnthalpyJPerKg < -1e6 && rx.specificEnthalpyJPerKg > -40e6);
  // The product compound closure is supplied for registration, with a derived colour.
  const closure = r.productClosures['naoh'];
  assert.ok(closure, 'product closure provided');
  assert.equal(closure.properties.intrinsicColorSrgb.length, 3);
  assert.ok(closure.properties.phases[0].densityKgPerM3 > 0);
  assert.equal(materialDerivationSummary(closure.properties).fullyLowerLevelDerived, true);
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

test('element/nonmetal formulas discover balanced binary products generally', () => {
  const atomicChlorine = discoverReactions('Na', 'Cl', { allowReducedProductProperties: true });
  assert.equal(atomicChlorine.reactions.length, 1);
  assert.equal(atomicChlorine.reactions[0].product, 'nacl');
  assert.equal(atomicChlorine.reactions[0].stoichiometry.equation, 'Na + Cl -> NaCl');
  assert.equal(atomicChlorine.reactions[0].stoichiometry.atomBalance.balanced, true);

  const molecularChlorine = discoverReactions('Na', 'Cl2', { allowReducedProductProperties: true });
  assert.equal(molecularChlorine.reactions.length, 1);
  assert.equal(molecularChlorine.reactions[0].product, 'nacl');
  assert.equal(molecularChlorine.reactions[0].stoichiometry.equation, '2 Na + Cl2 -> 2 NaCl');
  assert.equal(molecularChlorine.reactions[0].stoichiometry.atomBalance.balanced, true);

});

test('strict energetics rejects provisional candidate signs but keeps derived family replacements', () => {
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
  assert.equal(
    water.reactions[0].stoichiometry.replacedProvisionalEnergeticsStatus,
    'provisional-heuristic-not-scientifically-validated'
  );
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
