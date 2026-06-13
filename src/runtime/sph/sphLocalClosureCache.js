import { hashPayload } from '../../../ulg-gpu-abi/src/index.js';
import {
  REACTION_DISCOVERY_CACHE_RECORD_SCHEMA,
  createReactionDiscoveryCacheKey
} from './reactionDiscovery.js';
import {
  SPH_COLD_START_CACHE_SCHEMA,
  SPH_COLD_START_CACHE_STORAGE_KEY,
  SPH_GPU_WARMUP_CACHE_SCHEMA,
  SPH_PRODUCT_REUSE_RECORD_SCHEMA,
  SPH_TABLE_CACHE_RECORD_SCHEMA,
  emptySphColdStartCache,
  parseSphColdStartCacheSnapshot
} from './sphColdStartCache.js';
import { materialDerivationSummary } from '../material/propertyProvenance.js';

export const PEER_CLOSURE_CACHE_STORAGE_KEY = 'peercompute.ulg.sph-derived-closure-cache.v1';
export const PEER_CLOSURE_CACHE_SCHEMA = 'peercompute.ulg.local-derived-closure-cache.v2';
export const PEER_CLOSURE_CACHE_RECORD_SCHEMA = 'peercompute.ulg.local-derived-material-closure-cache-record.v2';
export const PEER_CLOSURE_CACHE_GENERATOR_SCHEMA = 'peercompute.ulg.material-closure-generator-fingerprint.v1';
export const PEER_CLOSURE_CACHE_APP_VERSION = '0.1.0';
export const PEER_CLOSURE_CACHE_METHOD_VERSION = 'ulg.generic-first-principles-material-derivation.v0';
export const PEER_CLOSURE_CACHE_MAX_RECORDS_PER_MATERIAL = 32;
export const SPH_LOCAL_CACHE_LOOKUP_SCHEMA = 'peercompute.ulg.sph-local-cache-lookup.v0';
export const SPH_LOCAL_CACHE_PERSISTENCE_SCHEMA = 'peercompute.ulg.sph-local-cache-persistence.v0';

function nowIso() {
  return new Date().toISOString();
}

function materialCacheKey(material) {
  return String(material || '').toLowerCase();
}

function buildMaterialIndex(entries = {}) {
  const index = {};
  for (const [cacheKey, record] of Object.entries(entries || {})) {
    const materialKey = record?.materialKey || record?.key;
    if (!materialKey) continue;
    if (!index[materialKey]) index[materialKey] = [];
    index[materialKey].push(cacheKey);
  }
  return index;
}

export function parsePeerClosureCacheSnapshot(snapshot, {
  cacheSchema = PEER_CLOSURE_CACHE_SCHEMA
} = {}) {
  try {
    const parsed = typeof snapshot === 'string' && snapshot.length
      ? JSON.parse(snapshot)
      : null;
    if (!parsed || parsed.schema !== cacheSchema || typeof parsed.entries !== 'object') {
      return {
        schema: cacheSchema,
        status: parsed?.schema ? 'schema-mismatch' : 'empty',
        previousSchema: parsed?.schema || null,
        staleEntryCount: Object.keys(parsed?.entries || {}).length,
        entries: {},
        materialIndex: {}
      };
    }
    return {
      ...parsed,
      status: 'loaded',
      materialIndex: parsed.materialIndex || buildMaterialIndex(parsed.entries || {})
    };
  } catch {
    return { schema: cacheSchema, status: 'parse-error', entries: {}, materialIndex: {} };
  }
}

function materialValidityDomain(material, properties) {
  return {
    temperatureK: [0, 6000],
    pressurePa: [1, 1e9],
    composition: properties?.formula || properties?.label || material,
    phaseNames: (properties?.phases || []).map((phase) => phase.name),
    transitionCount: properties?.transitions?.length || 0
  };
}

function materialClosureInputHash(material, properties) {
  return hashPayload({
    materialKey: materialCacheKey(material),
    material,
    formula: properties?.formula || null,
    label: properties?.label || null,
    atomsPerFormula: properties?.atomsPerFormula || null,
    provenance: properties?.propertyProvenance || null
  });
}

function materialClosureMethodHash(properties, {
  methodVersion = PEER_CLOSURE_CACHE_METHOD_VERSION,
  generatorFingerprint = null
} = {}) {
  return hashPayload({
    methodVersion,
    generatorFingerprint,
    derivation: properties?.derivation || null,
    materialDerivation: materialDerivationSummary(properties)
  });
}

function materialRecordKey({
  material,
  inputHash,
  methodHash,
  validityDomainHash,
  recordSchema = PEER_CLOSURE_CACHE_RECORD_SCHEMA,
  generatorFingerprint = null
}) {
  return hashPayload({
    cacheFamily: 'peercompute-local-material-closure',
    schema: recordSchema,
    materialKey: materialCacheKey(material),
    inputHash,
    methodHash,
    validityDomainHash,
    generatorFingerprint
  });
}

function closureRecordFromProperties(material, properties, {
  recordSchema = PEER_CLOSURE_CACHE_RECORD_SCHEMA,
  generatorSchema = PEER_CLOSURE_CACHE_GENERATOR_SCHEMA,
  appVersion = PEER_CLOSURE_CACHE_APP_VERSION,
  methodVersion = PEER_CLOSURE_CACHE_METHOD_VERSION,
  generatorFingerprint = null,
  updatedAt = nowIso()
} = {}) {
  const derivation = materialDerivationSummary(properties);
  const validityDomain = materialValidityDomain(material, properties);
  const inputHash = materialClosureInputHash(material, properties);
  const methodHash = materialClosureMethodHash(properties, { methodVersion, generatorFingerprint });
  const validityDomainHash = hashPayload(validityDomain);
  const propertiesHash = hashPayload(properties);
  const cacheKey = materialRecordKey({
    material,
    inputHash,
    methodHash,
    validityDomainHash,
    recordSchema,
    generatorFingerprint
  });
  return {
    schema: recordSchema,
    material,
    key: materialCacheKey(material),
    materialKey: materialCacheKey(material),
    cacheKey,
    closureFamily: 'material',
    methodVersion,
    inputHash,
    methodHash,
    validityDomain,
    validityDomainHash,
    propertiesHash,
    generatorSchema,
    generatorFingerprint,
    properties,
    materialDerivation: derivation,
    cacheStatus: 'peercompute-local-cache-write',
    invalidationPolicy: 'reuse only when schema, methodVersion, inputHash, validityDomainHash, and generatorFingerprint match current runtime',
    updatedAt,
    generator: {
      schema: generatorSchema,
      appVersion,
      methodVersion,
      fingerprint: generatorFingerprint
    }
  };
}

function recordReuseStatus(record, materialKey, {
  recordSchema = PEER_CLOSURE_CACHE_RECORD_SCHEMA,
  methodVersion = PEER_CLOSURE_CACHE_METHOD_VERSION,
  generatorFingerprint = null
} = {}) {
  if (!record) return { reusable: false, reason: 'missing-record' };
  if (record.schema !== recordSchema) {
    return { reusable: false, reason: 'record-schema-mismatch', cachedSchema: record.schema || null };
  }
  if (!record.properties) return { reusable: false, reason: 'missing-properties' };
  if ((record.materialKey || record.key) !== materialKey) {
    return { reusable: false, reason: 'material-key-mismatch', cachedMaterialKey: record.materialKey || record.key || null };
  }
  if (record.methodVersion !== methodVersion) {
    return { reusable: false, reason: 'method-version-mismatch', cachedMethodVersion: record.methodVersion || null };
  }
  if (generatorFingerprint && record.generatorFingerprint !== generatorFingerprint) {
    return {
      reusable: false,
      reason: 'generator-fingerprint-mismatch',
      cachedGeneratorFingerprint: record.generatorFingerprint || null,
      currentGeneratorFingerprint: generatorFingerprint
    };
  }
  if (!record.inputHash || !record.methodHash || !record.validityDomainHash) {
    return { reusable: false, reason: 'missing-cache-guard-hash' };
  }
  if (record.propertiesHash && record.propertiesHash !== hashPayload(record.properties)) {
    return { reusable: false, reason: 'properties-hash-mismatch' };
  }
  return { reusable: true, reason: 'current-generator-match' };
}

function reusableRecordForMaterial(cache, material, options) {
  const key = materialCacheKey(material);
  const indexedKeys = cache.materialIndex?.[key] || [];
  const fallbackKeys = Object.entries(cache.entries || {})
    .filter(([, record]) => (record?.materialKey || record?.key) === key)
    .map(([cacheKey]) => cacheKey);
  const candidateKeys = [...new Set([...indexedKeys, ...fallbackKeys])];
  const stale = [];
  for (const cacheKey of candidateKeys) {
    const record = cache.entries?.[cacheKey];
    const reuse = recordReuseStatus(record, key, options);
    if (reuse.reusable) return { record, stale };
    stale.push({ material, cacheKey, ...reuse });
  }
  return { record: null, stale };
}

export function cachedClosuresForMaterialsFromSnapshot(snapshot, materials = [], options = {}) {
  const cache = parsePeerClosureCacheSnapshot(snapshot, options);
  const closures = {};
  const hits = [];
  const misses = [];
  const stale = [];
  for (const material of materials || []) {
    const key = materialCacheKey(material);
    const { record, stale: staleForMaterial } = reusableRecordForMaterial(cache, material, options);
    stale.push(...staleForMaterial);
    if (record) {
      closures[material] = {
        closureFamily: 'material',
        closureId: `peercompute-local-cache-${key}`,
        material,
        properties: record.properties,
        materialDerivation: record.materialDerivation,
        provenance: {
          source: 'peercompute-localstorage-cache',
          cacheKey: record.cacheKey,
          inputHash: record.inputHash,
          methodHash: record.methodHash,
          validityDomainHash: record.validityDomainHash,
          generatorFingerprint: record.generatorFingerprint,
          updatedAt: record.updatedAt || null
        }
      };
      hits.push(material);
    } else {
      misses.push(material);
    }
  }
  return {
    schema: 'peercompute.ulg.local-derived-closure-cache-lookup.v1',
    status: hits.length > 0 ? 'peercompute-local-cache-hit' : cache.status,
    storageStatus: cache.status,
    previousSchema: cache.previousSchema || null,
    generatorFingerprint: options.generatorFingerprint || null,
    closures,
    hits,
    misses,
    stale,
    hitCount: hits.length,
    missCount: misses.length,
    staleCount: stale.length + (cache.staleEntryCount || 0),
    entryCount: Object.keys(cache.entries || {}).length
  };
}

export function materialPropertiesFromClosureLookup(lookup) {
  return Object.fromEntries(
    Object.entries(lookup?.closures || {})
      .filter(([, closure]) => closure?.properties)
      .map(([material, closure]) => [material, closure.properties])
  );
}

function reactionCacheKeyForOptions(options, materialProperties) {
  if (!options?.dropMaterial || !options?.baseMaterial || !materialProperties) return null;
  return createReactionDiscoveryCacheKey(options.dropMaterial, options.baseMaterial, {
    materialProperties,
    allowFixtureMaterialProperties: options.allowFixtureMaterialProperties === true,
    allowReducedProductProperties: options.allowReducedProductProperties === true,
    deriveCandidateEnergies: options.deriveCandidateEnergies !== false,
    strictEnergetics: options.strictEnergetics === true
  });
}

function cachedProductClosuresFromColdCache(cache, { generatorFingerprint = null } = {}) {
  const closures = {};
  for (const record of Object.values(cache?.productReuse || {})) {
    if (
      record?.schema === SPH_PRODUCT_REUSE_RECORD_SCHEMA
      && (!generatorFingerprint || record.generatorFingerprint === generatorFingerprint)
      && record.productKey
      && record.closure?.properties
    ) {
      closures[record.productKey] = record.closure;
    }
  }
  return closures;
}

export function cachedReactionRecordForOptionsFromSnapshot(options, closureLookup, snapshot, {
  generatorFingerprint = null
} = {}) {
  const cache = parseSphColdStartCacheSnapshot(snapshot, { generatorFingerprint });
  const materialProperties = materialPropertiesFromClosureLookup(closureLookup);
  const cacheKey = reactionCacheKeyForOptions(options, materialProperties);
  const record = cacheKey ? cache.reactions?.[cacheKey] : null;
  const reuse = record?.schema === REACTION_DISCOVERY_CACHE_RECORD_SCHEMA
    && record.cacheKey === cacheKey
    && (!generatorFingerprint || record.generatorFingerprint === generatorFingerprint)
    && record.result
    ? {
      status: 'reaction-cache-hit',
      cacheKey,
      record,
      productClosures: {
        ...cachedProductClosuresFromColdCache(cache, { generatorFingerprint }),
        ...(record.productClosures || {})
      }
    }
    : {
      status: cacheKey ? 'reaction-cache-miss' : 'reaction-cache-unkeyed',
      cacheKey,
      record: null,
      productClosures: cachedProductClosuresFromColdCache(cache, { generatorFingerprint })
    };
  return {
    schema: 'peercompute.ulg.sph-cold-start-cache-lookup.v0',
    storageStatus: cache.status,
    generatorFingerprint,
    reactionCount: Object.keys(cache.reactions || {}).length,
    productReuseCount: Object.keys(cache.productReuse || {}).length,
    tableCount: Object.keys(cache.tables || {}).length,
    gpuWarmupCount: Object.keys(cache.gpuWarmup || {}).length,
    staleCount: cache.staleEntryCount || 0,
    ...reuse
  };
}

export function createSphLocalCacheLookup({
  materialCacheSnapshot = null,
  coldStartCacheSnapshot = null,
  materials = [],
  options = {},
  generatorFingerprint = null,
  recordSchema = PEER_CLOSURE_CACHE_RECORD_SCHEMA,
  methodVersion = PEER_CLOSURE_CACHE_METHOD_VERSION,
  cacheSchema = PEER_CLOSURE_CACHE_SCHEMA
} = {}) {
  const startedAtMs = typeof performance?.now === 'function' ? performance.now() : Date.now();
  const peerClosureCacheLookup = cachedClosuresForMaterialsFromSnapshot(materialCacheSnapshot, materials, {
    cacheSchema,
    recordSchema,
    methodVersion,
    generatorFingerprint
  });
  const sphColdStartCacheLookup = cachedReactionRecordForOptionsFromSnapshot(options, peerClosureCacheLookup, coldStartCacheSnapshot, {
    generatorFingerprint
  });
  const endedAtMs = typeof performance?.now === 'function' ? performance.now() : Date.now();
  return {
    schema: SPH_LOCAL_CACHE_LOOKUP_SCHEMA,
    status: peerClosureCacheLookup.hitCount > 0 || sphColdStartCacheLookup.status === 'reaction-cache-hit'
      ? 'cache-lookup-hit'
      : 'cache-lookup-miss',
    peerClosureCacheLookup,
    sphColdStartCacheLookup,
    generatorFingerprint,
    timing: {
      schema: 'peercompute.ulg.sph-local-cache-lookup-timing.v0',
      totalMs: Math.max(0, endedAtMs - startedAtMs),
      materialSnapshotBytes: typeof materialCacheSnapshot === 'string' ? materialCacheSnapshot.length : 0,
      coldStartSnapshotBytes: typeof coldStartCacheSnapshot === 'string' ? coldStartCacheSnapshot.length : 0,
      materialHitCount: peerClosureCacheLookup.hitCount,
      materialMissCount: peerClosureCacheLookup.missCount,
      reactionStatus: sphColdStartCacheLookup.status,
      reactionCount: sphColdStartCacheLookup.reactionCount,
      productReuseCount: sphColdStartCacheLookup.productReuseCount
    }
  };
}

export function applySphLocalCacheLookupToOptions(options = {}, lookup = null) {
  const peerLookup = lookup?.peerClosureCacheLookup || {};
  const coldLookup = lookup?.sphColdStartCacheLookup || {};
  const cachedClosureCount = Object.keys(peerLookup.closures || {}).length;
  return {
    ...options,
    closures: cachedClosureCount > 0 ? peerLookup.closures : undefined,
    reactionDiscoveryCacheRecord: coldLookup.record || undefined,
    cachedProductClosures: Object.keys(coldLookup.productClosures || {}).length
      ? coldLookup.productClosures
      : undefined
  };
}

function productReuseRecord(productKey, closure, reactionDiscovery, {
  generatorFingerprint = null
} = {}) {
  return {
    schema: SPH_PRODUCT_REUSE_RECORD_SCHEMA,
    productKey,
    closure,
    sourceReactionCacheKey: reactionDiscovery?.cache?.cacheKey || null,
    generatorFingerprint,
    closureHash: hashPayload(closure?.properties || closure || null),
    updatedAt: nowIso(),
    provenance: {
      source: 'sph-phase-demo-reaction-product',
      reusePolicy: 'schema-product-key-generator-closure-hash'
    }
  };
}

function reactionRecordFromDiscovery(reactionDiscovery, materialProperties = {}, {
  generatorFingerprint = null
} = {}) {
  const cacheKey = reactionDiscovery?.cache?.cacheKey;
  if (!cacheKey) return null;
  const productClosures = {};
  for (const [productKey, closure] of Object.entries(reactionDiscovery.productClosures || {})) {
    if (closure?.properties) productClosures[productKey] = closure;
  }
  return {
    schema: REACTION_DISCOVERY_CACHE_RECORD_SCHEMA,
    cacheKey,
    result: {
      reactions: reactionDiscovery.reactions || [],
      productClosures,
      note: reactionDiscovery.note || null,
      cache: {
        ...(reactionDiscovery.cache || {}),
        cacheStatus: 'persistent-record-source'
      }
    },
    productClosures,
    materialPropertiesHash: hashPayload(Object.fromEntries(
      Object.entries(materialProperties || {})
        .map(([material, properties]) => [materialCacheKey(material), hashPayload(properties)])
        .sort(([a], [b]) => a.localeCompare(b))
    )),
    generatorFingerprint,
    updatedAt: nowIso(),
    provenance: {
      source: 'sph-phase-demo-reaction-discovery',
      reusePolicy: 'schema-cache-key-generator-product-closure-hash'
    }
  };
}

export function createPeerClosureCacheWrite({
  previousSnapshot = null,
  materialProperties = {},
  generatorFingerprint = null,
  cacheSchema = PEER_CLOSURE_CACHE_SCHEMA,
  recordSchema = PEER_CLOSURE_CACHE_RECORD_SCHEMA,
  generatorSchema = PEER_CLOSURE_CACHE_GENERATOR_SCHEMA,
  appVersion = PEER_CLOSURE_CACHE_APP_VERSION,
  methodVersion = PEER_CLOSURE_CACHE_METHOD_VERSION,
  maxRecordsPerMaterial = PEER_CLOSURE_CACHE_MAX_RECORDS_PER_MATERIAL
} = {}) {
  const startedAtMs = typeof performance?.now === 'function' ? performance.now() : Date.now();
  const previous = parsePeerClosureCacheSnapshot(previousSnapshot, { cacheSchema });
  const entries = { ...(previous.entries || {}) };
  const materialIndex = { ...(previous.materialIndex || buildMaterialIndex(entries)) };
  let writeCount = 0;
  for (const [material, properties] of Object.entries(materialProperties || {})) {
    if (!properties) continue;
    const record = closureRecordFromProperties(material, properties, {
      recordSchema,
      generatorSchema,
      appVersion,
      methodVersion,
      generatorFingerprint
    });
    entries[record.cacheKey] = record;
    const prior = materialIndex[record.materialKey] || [];
    materialIndex[record.materialKey] = [
      record.cacheKey,
      ...prior.filter((key) => key !== record.cacheKey)
    ].slice(0, maxRecordsPerMaterial);
    writeCount += 1;
  }
  const snapshot = {
    schema: cacheSchema,
    status: 'stored',
    storageKey: PEER_CLOSURE_CACHE_STORAGE_KEY,
    entries,
    materialIndex,
    entryCount: Object.keys(entries).length,
    generatorFingerprint,
    generator: {
      schema: generatorSchema,
      appVersion,
      methodVersion,
      fingerprint: generatorFingerprint
    },
    updatedAt: nowIso(),
    provenance: {
      source: 'sph-phase-demo-materialProperties',
      reusePolicy: 'schema-input-method-validity-domain-generator-fingerprint-guarded-peercompute-local-cache'
    }
  };
  const cacheSnapshot = JSON.stringify(snapshot);
  const endedAtMs = typeof performance?.now === 'function' ? performance.now() : Date.now();
  const summary = {
    schema: cacheSchema,
    status: 'stored',
    storageKey: PEER_CLOSURE_CACHE_STORAGE_KEY,
    entryCount: snapshot.entryCount,
    writeCount,
    previousStatus: previous.status,
    cacheSnapshotBytes: cacheSnapshot.length,
    generatorFingerprint,
    timing: {
      schema: 'peercompute.ulg.sph-material-cache-worker-write-timing.v0',
      totalMs: Math.max(0, endedAtMs - startedAtMs)
    }
  };
  return { cacheSnapshot, summary };
}

export function createSphColdStartReactionCacheWrite({
  previousSnapshot = null,
  reactionDiscovery = null,
  materialProperties = {},
  generatorFingerprint = null
} = {}) {
  const startedAtMs = typeof performance?.now === 'function' ? performance.now() : Date.now();
  const previous = parseSphColdStartCacheSnapshot(previousSnapshot, { generatorFingerprint });
  const reactionRecord = reactionRecordFromDiscovery(reactionDiscovery, materialProperties, { generatorFingerprint });
  const reactions = { ...(previous.reactions || {}) };
  const productReuse = { ...(previous.productReuse || {}) };
  let reactionWriteCount = 0;
  let productReuseWriteCount = 0;
  if (reactionRecord) {
    reactions[reactionRecord.cacheKey] = reactionRecord;
    reactionWriteCount = 1;
    for (const [productKey, closure] of Object.entries(reactionRecord.productClosures || {})) {
      productReuse[materialCacheKey(productKey)] = productReuseRecord(materialCacheKey(productKey), closure, reactionDiscovery, {
        generatorFingerprint
      });
      productReuseWriteCount += 1;
    }
  }
  const snapshot = {
    schema: SPH_COLD_START_CACHE_SCHEMA,
    status: 'stored',
    storageKey: SPH_COLD_START_CACHE_STORAGE_KEY,
    generatorFingerprint,
    reactions,
    productReuse,
    tables: {},
    gpuWarmup: {},
    tableSchema: SPH_TABLE_CACHE_RECORD_SCHEMA,
    gpuWarmupSchema: SPH_GPU_WARMUP_CACHE_SCHEMA,
    updatedAt: nowIso(),
    counts: {
      reactions: Object.keys(reactions).length,
      productReuse: Object.keys(productReuse).length,
      tables: 0,
      gpuWarmup: 0
    },
    provenance: {
      source: 'sph-phase-demo-cold-start-cache-coordinator',
      reusePolicy: 'derived-artifact-cache-only'
    }
  };
  const cacheSnapshot = JSON.stringify(snapshot);
  const endedAtMs = typeof performance?.now === 'function' ? performance.now() : Date.now();
  const summary = {
    ...emptySphColdStartCache('stored', { generatorFingerprint }),
    storageKey: SPH_COLD_START_CACHE_STORAGE_KEY,
    reactionCount: Object.keys(reactions).length,
    productReuseCount: Object.keys(productReuse).length,
    reactionWriteCount,
    productReuseWriteCount,
    cacheSnapshotBytes: cacheSnapshot.length,
    timing: {
      schema: 'peercompute.ulg.sph-cold-start-cache-worker-write-timing.v0',
      totalMs: Math.max(0, endedAtMs - startedAtMs)
    }
  };
  return { cacheSnapshot, summary };
}

export function createSphLocalCachePersistence({
  materialCacheSnapshot = null,
  coldStartCacheSnapshot = null,
  materialProperties = {},
  reactionDiscovery = null,
  generatorFingerprint = null,
  cacheSchema = PEER_CLOSURE_CACHE_SCHEMA,
  recordSchema = PEER_CLOSURE_CACHE_RECORD_SCHEMA,
  generatorSchema = PEER_CLOSURE_CACHE_GENERATOR_SCHEMA,
  appVersion = PEER_CLOSURE_CACHE_APP_VERSION,
  methodVersion = PEER_CLOSURE_CACHE_METHOD_VERSION
} = {}) {
  const startedAtMs = typeof performance?.now === 'function' ? performance.now() : Date.now();
  const material = createPeerClosureCacheWrite({
    previousSnapshot: materialCacheSnapshot,
    materialProperties,
    generatorFingerprint,
    cacheSchema,
    recordSchema,
    generatorSchema,
    appVersion,
    methodVersion
  });
  const coldStart = createSphColdStartReactionCacheWrite({
    previousSnapshot: coldStartCacheSnapshot,
    reactionDiscovery,
    materialProperties,
    generatorFingerprint
  });
  const endedAtMs = typeof performance?.now === 'function' ? performance.now() : Date.now();
  return {
    schema: SPH_LOCAL_CACHE_PERSISTENCE_SCHEMA,
    status: 'snapshots-ready',
    material,
    coldStart,
    generatorFingerprint,
    timing: {
      schema: 'peercompute.ulg.sph-local-cache-persistence-timing.v0',
      totalMs: Math.max(0, endedAtMs - startedAtMs),
      materialMs: material.summary?.timing?.totalMs ?? null,
      coldStartMs: coldStart.summary?.timing?.totalMs ?? null
    }
  };
}

export function compactSphLocalCacheLookup(lookup) {
  if (!lookup) return null;
  return {
    schema: lookup.schema,
    status: lookup.status,
    generatorFingerprint: lookup.generatorFingerprint || null,
    timing: lookup.timing || null,
    material: {
      status: lookup.peerClosureCacheLookup?.status || null,
      hitCount: lookup.peerClosureCacheLookup?.hitCount ?? 0,
      missCount: lookup.peerClosureCacheLookup?.missCount ?? 0,
      staleCount: lookup.peerClosureCacheLookup?.staleCount ?? 0,
      entryCount: lookup.peerClosureCacheLookup?.entryCount ?? 0,
      hits: lookup.peerClosureCacheLookup?.hits || [],
      misses: lookup.peerClosureCacheLookup?.misses || []
    },
    reaction: {
      status: lookup.sphColdStartCacheLookup?.status || null,
      reactionCount: lookup.sphColdStartCacheLookup?.reactionCount ?? 0,
      productReuseCount: lookup.sphColdStartCacheLookup?.productReuseCount ?? 0,
      staleCount: lookup.sphColdStartCacheLookup?.staleCount ?? 0
    }
  };
}

export function compactSphLocalCachePersistence(persistence) {
  if (!persistence) return null;
  return {
    schema: persistence.schema,
    status: persistence.status,
    generatorFingerprint: persistence.generatorFingerprint || null,
    timing: persistence.timing || null,
    material: persistence.material?.summary || null,
    coldStart: persistence.coldStart?.summary || null
  };
}
