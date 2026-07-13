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

const reducedNaohProperties = {
  ...materialProperties.naoh,
  compound: true,
  derivation: 'reduced-reaction-product-closure: test reactant-packed estimate',
  propertyProvenance: {
    schema: 'ulg.material-property-provenance.v0',
    entries: [{ source: 'reactant-packed-product-closure' }]
  },
  phases: [{
    name: 'liquid',
    densityKgPerM3: 1500,
    bulkModulusPa: 1e9,
    shearModulusPa: 0,
    cpJPerKgK: 1500,
    temperatureRange: [0, 1e6]
  }],
  transitions: []
};

function fakeReactionDiscovery(cacheKey, {
  allowFixtureMaterialProperties = false,
  allowReducedProductProperties = false
} = {}) {
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
      naoh: {
        properties: allowReducedProductProperties
          ? reducedNaohProperties
          : { ...materialProperties.naoh, compound: true }
      },
      h2: { properties: materialProperties.h2 }
    },
    cache: {
      cacheKey,
      cacheStatus: 'derived-cache-miss',
      allowFixtureMaterialProperties,
      allowReducedProductProperties
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

test('SPH product closure reuse preserves same-tier misses and rejects strict/reduced cross-tier records', () => {
  const materialWrite = createPeerClosureCacheWrite({
    materialProperties,
    generatorFingerprint
  });
  const lookupForTier = (coldStartCacheSnapshot, allowReducedProductProperties) => createSphLocalCacheLookup({
    materialCacheSnapshot: materialWrite.cacheSnapshot,
    coldStartCacheSnapshot,
    // Omitting h2 deliberately changes the material-properties digest so the
    // reaction record misses and exercises product-level reuse across keys.
    materials: ['Na', 'h2o'],
    options: {
      dropMaterial: 'Na',
      baseMaterial: 'h2o',
      allowReducedProductProperties
    },
    generatorFingerprint
  });
  const snapshotForTier = (allowReducedProductProperties) => {
    const cacheKey = createReactionDiscoveryCacheKey('Na', 'h2o', {
      materialProperties: lookupMaterialProperties,
      allowReducedProductProperties
    });
    return createSphColdStartReactionCacheWrite({
      reactionDiscovery: fakeReactionDiscovery(cacheKey, { allowReducedProductProperties }),
      materialProperties,
      generatorFingerprint
    }).cacheSnapshot;
  };

  const strictSnapshot = snapshotForTier(false);
  const strictReuse = lookupForTier(strictSnapshot, false);
  const strictIntoReduced = lookupForTier(strictSnapshot, true);
  assert.equal(strictReuse.sphColdStartCacheLookup.status, 'reaction-cache-miss');
  assert.equal(strictReuse.sphColdStartCacheLookup.productClosures.naoh.properties.formula, 'NaOH');
  assert.equal(strictReuse.sphColdStartCacheLookup.productClosures.naoh.properties.phases[0].name, 'solid');
  assert.deepEqual(strictIntoReduced.sphColdStartCacheLookup.productClosures, {});

  const reducedSnapshot = snapshotForTier(true);
  const reducedReuse = lookupForTier(reducedSnapshot, true);
  const reducedIntoStrict = lookupForTier(reducedSnapshot, false);
  assert.equal(reducedReuse.sphColdStartCacheLookup.status, 'reaction-cache-miss');
  assert.equal(reducedReuse.sphColdStartCacheLookup.productClosures.naoh.properties.formula, 'NaOH');
  assert.equal(reducedReuse.sphColdStartCacheLookup.productClosures.naoh.properties.phases[0].name, 'liquid');
  assert.deepEqual(reducedIntoStrict.sphColdStartCacheLookup.productClosures, {});

  const reducedCacheKey = createReactionDiscoveryCacheKey('Na', 'h2o', {
    materialProperties: lookupMaterialProperties,
    allowReducedProductProperties: true
  });
  const poisonedReducedDiscovery = fakeReactionDiscovery(reducedCacheKey, {
    allowReducedProductProperties: true
  });
  poisonedReducedDiscovery.productClosures.naoh = {
    properties: { ...materialProperties.naoh, compound: true }
  };
  const poisonedSnapshot = createSphColdStartReactionCacheWrite({
    reactionDiscovery: poisonedReducedDiscovery,
    materialProperties,
    generatorFingerprint
  }).cacheSnapshot;
  const exactReducedLookup = createSphLocalCacheLookup({
    materialCacheSnapshot: materialWrite.cacheSnapshot,
    coldStartCacheSnapshot: poisonedSnapshot,
    materials: ['Na', 'h2o', 'h2'],
    options: {
      dropMaterial: 'Na',
      baseMaterial: 'h2o',
      allowReducedProductProperties: true
    },
    generatorFingerprint
  });
  assert.equal(exactReducedLookup.sphColdStartCacheLookup.status, 'reaction-cache-miss');
  assert.equal(exactReducedLookup.sphColdStartCacheLookup.record, null);
  assert.equal(exactReducedLookup.sphColdStartCacheLookup.productClosures.naoh, undefined);
  assert.equal(exactReducedLookup.sphColdStartCacheLookup.productClosures.h2.properties.formula, 'H2');
});
