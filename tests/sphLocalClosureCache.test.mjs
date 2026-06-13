import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReactionDiscoveryCacheKey } from '../src/runtime/sph/reactionDiscovery.js';
import {
  SPH_LOCAL_CACHE_LOOKUP_SCHEMA,
  createPeerClosureCacheWrite,
  createSphColdStartReactionCacheWrite,
  createSphLocalCacheLookup,
  createSphLocalCachePersistence,
  applySphLocalCacheLookupToOptions
} from '../src/runtime/sph/sphLocalClosureCache.js';

const generatorFingerprint = 'test-worker-cache-generator';

const materialProperties = {
  Na: {
    formula: 'Na',
    molarMassKgPerMol: 0.02298976928,
    derivation: { method: 'test-first-principles' },
    phases: [{ name: 'solid', densityKgPerM3: 970, bulkModulusPa: 6.3e9, shearModulusPa: 3.3e9, cpJPerKgK: 1230, temperatureRange: [0, 371] }],
    transitions: []
  },
  h2o: {
    formula: 'H2O',
    molarMassKgPerMol: 0.01801528,
    derivation: { method: 'test-first-principles' },
    phases: [{ name: 'liquid', densityKgPerM3: 1000, bulkModulusPa: 2.2e9, shearModulusPa: 0, cpJPerKgK: 4184, temperatureRange: [273, 373] }],
    transitions: []
  },
  naoh: {
    formula: 'NaOH',
    molarMassKgPerMol: 0.039997,
    derivation: { method: 'test-first-principles' },
    phases: [{ name: 'solid', densityKgPerM3: 2130, bulkModulusPa: 1e10, shearModulusPa: 4e9, cpJPerKgK: 1500, temperatureRange: [0, 591] }],
    transitions: []
  },
  h2: {
    formula: 'H2',
    molarMassKgPerMol: 0.00201588,
    derivation: { method: 'test-first-principles' },
    phases: [{ name: 'gas', densityKgPerM3: 0.08, bulkModulusPa: 1e5, shearModulusPa: 0, cpJPerKgK: 14300, temperatureRange: [0, 2000] }],
    transitions: []
  }
};

const reactantMaterialProperties = {
  Na: materialProperties.Na,
  h2o: materialProperties.h2o
};

const lookupMaterialProperties = {
  Na: materialProperties.Na,
  h2o: materialProperties.h2o,
  h2: materialProperties.h2
};

function fakeReactionDiscovery(cacheKey) {
  return {
    reactions: [{
      a: 'Na',
      b: 'h2o',
      product: 'naoh',
      stoichiometry: {
        equation: '2 Na + 2 H2O -> 2 NaOH + H2',
        atomBalance: { balanced: true },
        reactants: [
          { coefficient: 2, formula: 'Na', material: 'Na' },
          { coefficient: 2, formula: 'H2O', material: 'h2o' }
        ],
        products: [
          { coefficient: 2, formula: 'NaOH', material: 'naoh' },
          { coefficient: 1, formula: 'H2', material: 'h2' }
        ]
      }
    }],
    productClosures: {
      naoh: { properties: materialProperties.naoh },
      h2: { properties: materialProperties.h2 }
    },
    cache: {
      cacheKey,
      cacheStatus: 'derived-cache-miss'
    }
  };
}

test('SPH local closure cache lookup runs from snapshots and returns reusable material/product records', () => {
  const materialWrite = createPeerClosureCacheWrite({
    materialProperties,
    generatorFingerprint
  });
  const cacheKey = createReactionDiscoveryCacheKey('Na', 'h2o', { materialProperties: lookupMaterialProperties });
  const coldWrite = createSphColdStartReactionCacheWrite({
    reactionDiscovery: fakeReactionDiscovery(cacheKey),
    materialProperties,
    generatorFingerprint
  });

  const lookup = createSphLocalCacheLookup({
    materialCacheSnapshot: materialWrite.cacheSnapshot,
    coldStartCacheSnapshot: coldWrite.cacheSnapshot,
    materials: ['Na', 'h2o', 'h2'],
    options: { dropMaterial: 'Na', baseMaterial: 'h2o' },
    generatorFingerprint
  });

  assert.equal(lookup.schema, SPH_LOCAL_CACHE_LOOKUP_SCHEMA);
  assert.equal(lookup.peerClosureCacheLookup.hitCount, 3);
  assert.equal(lookup.sphColdStartCacheLookup.status, 'reaction-cache-hit');
  assert.equal(lookup.sphColdStartCacheLookup.productClosures.naoh.properties.formula, 'NaOH');

  const options = applySphLocalCacheLookupToOptions({ dropMaterial: 'Na', baseMaterial: 'h2o' }, lookup);
  assert.equal(options.closures.Na.properties.formula, 'Na');
  assert.equal(options.reactionDiscoveryCacheRecord.cacheKey, cacheKey);
  assert.equal(options.cachedProductClosures.h2.properties.formula, 'H2');
});

test('SPH local closure cache persistence prepares material and reaction snapshots off the UI path', () => {
  const cacheKey = createReactionDiscoveryCacheKey('Na', 'h2o', { materialProperties: reactantMaterialProperties });
  const persistence = createSphLocalCachePersistence({
    materialProperties,
    reactionDiscovery: fakeReactionDiscovery(cacheKey),
    generatorFingerprint
  });

  assert.equal(persistence.status, 'snapshots-ready');
  assert.ok(persistence.material.cacheSnapshot.length > 1000);
  assert.ok(persistence.coldStart.cacheSnapshot.length > 1000);
  assert.equal(persistence.material.summary.writeCount, 4);
  assert.equal(persistence.coldStart.summary.reactionWriteCount, 1);

  const lookup = createSphLocalCacheLookup({
    materialCacheSnapshot: persistence.material.cacheSnapshot,
    coldStartCacheSnapshot: persistence.coldStart.cacheSnapshot,
    materials: ['Na', 'h2o'],
    options: { dropMaterial: 'Na', baseMaterial: 'h2o' },
    generatorFingerprint
  });
  assert.equal(lookup.sphColdStartCacheLookup.status, 'reaction-cache-hit');
});
