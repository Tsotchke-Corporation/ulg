// Gate 2 Post-Acceptance Deepening: Persistent Content-Addressed OPFS / IndexedDB
// Warm Cache for GPU-Fitted Convex Polytope Atlases
// (`src/runtime/material/polytopeAtlasPersistentCache.js`).
//
// Backend hierarchy:
//   1. Origin Private File System (OPFS: `navigator.storage.getDirectory()`)
//   2. IndexedDB (`ulg-polytope-atlas-cache-v1`)
//   3. In-memory fallback (for headless Node host tests or restricted contexts)
//
// Security & scientific honesty:
//   - Keys are strictly content-addressed over (schema, builderSchema, materialKey,
//     family, closureHash, generatorFingerprint, pressureRangePa, degrees,
//     relativeTolerance, maxBisectDepth, materialIndex).
//   - Every read is strictly FAIL-CLOSED: corrupt JSON, NaN/Inf floats, invalid
//     Chebyshev fits, mismatched closureHash/pressureRangePa, or truncated packed
//     GPU buffers are automatically evicted and force a fresh GPU re-derivation.

import { createMaterialPolytopeRegistry } from './materialPolytopeRegistry.js';
import {
  ULG_POLYTOPE_ATLAS_SCHEMA,
  ULG_POLYTOPE_ATLAS_GPU_BUFFER_SCHEMA,
  packPolytopeAtlasForGpu
} from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_POLYTOPE_ATLAS_CACHE_SCHEMA = 'ulg.polytope-atlas-persistent-cache.v1';
export const ULG_POLYTOPE_ATLAS_CACHE_DIR = 'ulg-polytope-atlas-cache-v1';
export const ULG_POLYTOPE_ATLAS_IDB_NAME = 'ulg-polytope-atlas-cache-v1';
export const ULG_POLYTOPE_ATLAS_IDB_STORE = 'atlases';

function fnv1a64Hex(text) {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + (i & 255)), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

function sanitizeKeySegment(raw) {
  return String(raw || 'mat').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'mat';
}

export function normalizePolytopeAtlasCacheDescriptor(descriptor = {}) {
  const materialKey = String(descriptor.materialKey || '').trim();
  if (!materialKey) {
    throw new TypeError('Polytope atlas cache descriptor requires materialKey');
  }
  const family = String(descriptor.family || 'element');
  const closureHash = String(descriptor.closureHash || '');
  const generatorFingerprint = String(descriptor.generatorFingerprint || 'ulg-foundation-v1');
  const builderSchema = String(descriptor.builderSchema || 'ulg.polytope-atlas-builder.v1');
  const pMin = Math.max(1e-3, Number(descriptor.pressureRangePa?.[0] ?? 1e2));
  const pMax = Math.max(pMin * 10, Number(descriptor.pressureRangePa?.[1] ?? 1e10));
  const degT = Math.max(1, Math.trunc(Number(descriptor.degrees?.[0] ?? 5)));
  const degP = Math.max(1, Math.trunc(Number(descriptor.degrees?.[1] ?? 5)));
  const relativeTolerance = Number(descriptor.relativeTolerance ?? 2e-2);
  const maxBisectDepth = Math.max(0, Math.trunc(Number(descriptor.maxBisectDepth ?? 3)));
  const materialIndex = Math.max(0, Math.trunc(Number(descriptor.materialIndex ?? 0)));

  const canonical = {
    schema: ULG_POLYTOPE_ATLAS_CACHE_SCHEMA,
    builderSchema,
    materialKey,
    family,
    closureHash,
    generatorFingerprint,
    pressureRangePa: [pMin, pMax],
    degrees: [degT, degP],
    relativeTolerance,
    maxBisectDepth,
    materialIndex
  };
  const digest = fnv1a64Hex(JSON.stringify(canonical));
  const cacheKey = `${sanitizeKeySegment(materialKey)}-${digest}`;
  return Object.freeze({
    ...canonical,
    pressureRangePa: Object.freeze(canonical.pressureRangePa),
    degrees: Object.freeze(canonical.degrees),
    cacheKey
  });
}

function serializePolytope(poly) {
  const coeffs = poly?.fit?.coefficients;
  const coeffArray = coeffs instanceof Float32Array
    ? Array.from(coeffs)
    : (Array.isArray(coeffs) ? coeffs.map(Number) : []);
  return {
    polytopeId: String(poly.polytopeId || ''),
    materialKey: String(poly.materialKey || ''),
    family: String(poly.family || 'element'),
    phase: String(poly.phase || 'solid'),
    accuracyTier: poly.accuracyTier,
    closureHash: String(poly.closureHash || ''),
    invalidationKey: String(poly.invalidationKey || poly.closureHash || ''),
    axes: Array.isArray(poly.axes) ? poly.axes.map((ax) => ({ ...ax })) : [],
    inequalities: Array.isArray(poly.inequalities)
      ? poly.inequalities.map((ineq) => ({
          ...ineq,
          a: Array.isArray(ineq.a) ? ineq.a.map(Number) : []
        }))
      : [],
    crystalStructure: poly.crystalStructure ? { ...poly.crystalStructure } : null,
    provenance: poly.provenance ? { ...poly.provenance } : null,
    fit: poly.fit
      ? {
          ...poly.fit,
          degrees: Array.isArray(poly.fit.degrees) ? poly.fit.degrees.map(Number) : [0, 0],
          coefficients: coeffArray
        }
      : null
  };
}

export function serializePolytopeAtlasEnvelope(descriptor, atlas) {
  const norm = descriptor.cacheKey ? descriptor : normalizePolytopeAtlasCacheDescriptor(descriptor);
  if (!atlas || !Array.isArray(atlas.polytopes) || atlas.polytopes.length === 0) {
    throw new TypeError('Cannot cache empty or malformed polytope atlas');
  }
  const packedData = atlas.packedGpuAtlas?.data;
  if (!(packedData instanceof Float32Array) || packedData.length < 16) {
    throw new TypeError('Cannot cache polytope atlas without packed Float32Array GPU data');
  }
  return {
    schema: ULG_POLYTOPE_ATLAS_CACHE_SCHEMA,
    atlasSchema: atlas.schema || ULG_POLYTOPE_ATLAS_SCHEMA,
    builderSchema: norm.builderSchema,
    cacheKey: norm.cacheKey,
    storedAtMs: Date.now(),
    materialKey: norm.materialKey,
    family: norm.family,
    accuracyTier: atlas.accuracyTier,
    closureHash: norm.closureHash,
    generatorFingerprint: norm.generatorFingerprint,
    pressureRangePa: [norm.pressureRangePa[0], norm.pressureRangePa[1]],
    degrees: [norm.degrees[0], norm.degrees[1]],
    relativeTolerance: norm.relativeTolerance,
    maxBisectDepth: norm.maxBisectDepth,
    materialIndex: norm.materialIndex,
    polytopeCount: atlas.polytopes.length,
    polytopes: atlas.polytopes.map(serializePolytope),
    packedGpuAtlas: {
      schema: atlas.packedGpuAtlas.schema || ULG_POLYTOPE_ATLAS_GPU_BUFFER_SCHEMA,
      polytopeCount: atlas.packedGpuAtlas.polytopeCount,
      totalFacets: atlas.packedGpuAtlas.totalFacets,
      totalCoeffs: atlas.packedGpuAtlas.totalCoeffs,
      data: Array.from(packedData)
    }
  };
}

/**
 * Strictly fail-closed validation and rehydration of a cached polytope atlas.
 * Returns `{ ok: true, atlas }` or `{ ok: false, reason }` (never returns partial/corrupt data).
 */
export function validateAndRehydrateCachedAtlas(rawEnvelope, expectedDescriptor, backendName = 'memory') {
  const norm = expectedDescriptor.cacheKey
    ? expectedDescriptor
    : normalizePolytopeAtlasCacheDescriptor(expectedDescriptor);
  if (!rawEnvelope || typeof rawEnvelope !== 'object') {
    return { ok: false, reason: 'envelope-not-object' };
  }
  if (rawEnvelope.schema !== ULG_POLYTOPE_ATLAS_CACHE_SCHEMA) {
    return { ok: false, reason: `schema-mismatch:${rawEnvelope.schema}` };
  }
  if (rawEnvelope.cacheKey !== norm.cacheKey) {
    return { ok: false, reason: 'cache-key-mismatch' };
  }
  if (rawEnvelope.materialKey !== norm.materialKey) {
    return { ok: false, reason: 'material-key-mismatch' };
  }
  if (rawEnvelope.closureHash !== norm.closureHash) {
    return { ok: false, reason: 'closure-hash-stale' };
  }
  if (rawEnvelope.generatorFingerprint !== norm.generatorFingerprint) {
    return { ok: false, reason: 'generator-fingerprint-stale' };
  }
  if (
    !Array.isArray(rawEnvelope.pressureRangePa)
    || rawEnvelope.pressureRangePa.length !== 2
    || Math.abs(Number(rawEnvelope.pressureRangePa[0]) - norm.pressureRangePa[0]) > 1e-6 * Math.max(1, norm.pressureRangePa[0])
    || Math.abs(Number(rawEnvelope.pressureRangePa[1]) - norm.pressureRangePa[1]) > 1e-6 * Math.max(1, norm.pressureRangePa[1])
  ) {
    return { ok: false, reason: 'pressure-range-mismatch' };
  }
  if (!Array.isArray(rawEnvelope.polytopes) || rawEnvelope.polytopes.length === 0) {
    return { ok: false, reason: 'empty-polytopes' };
  }
  if (rawEnvelope.polytopeCount !== rawEnvelope.polytopes.length) {
    return { ok: false, reason: 'polytope-count-mismatch' };
  }

  const rehydratedPolytopes = [];
  for (let i = 0; i < rawEnvelope.polytopes.length; i += 1) {
    const p = rawEnvelope.polytopes[i];
    if (!p || typeof p !== 'object' || !p.fit || p.fit.valid !== true) {
      return { ok: false, reason: `invalid-polytope-fit:${i}` };
    }
    const degs = p.fit.degrees;
    if (!Array.isArray(degs) || degs.length < 2 || !(degs[0] >= 0) || !(degs[1] >= 0)) {
      return { ok: false, reason: `invalid-degrees:${i}` };
    }
    const expectedCoeffLen = (Math.trunc(degs[0]) + 1) * (Math.trunc(degs[1]) + 1);
    if (!Array.isArray(p.fit.coefficients) || p.fit.coefficients.length !== expectedCoeffLen) {
      return { ok: false, reason: `coeff-length-mismatch:${i}` };
    }
    const coeffF32 = new Float32Array(expectedCoeffLen);
    for (let k = 0; k < expectedCoeffLen; k += 1) {
      const v = Number(p.fit.coefficients[k]);
      if (!Number.isFinite(v)) {
        return { ok: false, reason: `non-finite-coeff:${i}:${k}` };
      }
      coeffF32[k] = v;
    }
    if (!Array.isArray(p.axes) || p.axes.length < 2 || !Array.isArray(p.inequalities)) {
      return { ok: false, reason: `invalid-geometry:${i}` };
    }
    for (const ineq of p.inequalities) {
      if (!ineq || !Array.isArray(ineq.a) || ineq.a.length < 2 || !Number.isFinite(Number(ineq.b))) {
        return { ok: false, reason: `invalid-inequality:${i}` };
      }
      if (!Number.isFinite(Number(ineq.a[0])) || !Number.isFinite(Number(ineq.a[1]))) {
        return { ok: false, reason: `non-finite-inequality:${i}` };
      }
    }
    rehydratedPolytopes.push(Object.freeze({
      ...p,
      axes: Object.freeze(p.axes.map((ax) => Object.freeze({ ...ax }))),
      inequalities: Object.freeze(p.inequalities.map((ineq) => Object.freeze({
        ...ineq,
        a: Object.freeze([...ineq.a])
      }))),
      fit: Object.freeze({
        ...p.fit,
        degrees: Object.freeze([Math.trunc(degs[0]), Math.trunc(degs[1])]),
        coefficients: coeffF32,
        valid: true
      })
    }));
  }

  const rawPacked = rawEnvelope.packedGpuAtlas;
  if (!rawPacked || !Array.isArray(rawPacked.data) || rawPacked.data.length < 16) {
    return { ok: false, reason: 'missing-packed-gpu-data' };
  }
  const packedF32 = new Float32Array(rawPacked.data.length);
  for (let i = 0; i < rawPacked.data.length; i += 1) {
    const v = Number(rawPacked.data[i]);
    if (!Number.isFinite(v)) {
      return { ok: false, reason: `non-finite-packed-float:${i}` };
    }
    packedF32[i] = v;
  }
  if (Math.round(packedF32[0]) !== rehydratedPolytopes.length) {
    return { ok: false, reason: 'packed-header-count-mismatch' };
  }

  // Re-verify packed layout against canonical packer length so truncated buffers never slip through
  const canonicalCheck = packPolytopeAtlasForGpu(rehydratedPolytopes, { materialIndex: norm.materialIndex });
  if (canonicalCheck.data.length !== packedF32.length) {
    return { ok: false, reason: 'packed-layout-length-mismatch' };
  }

  const registry = createMaterialPolytopeRegistry();
  registry.registerMaterialPolytopes(norm.materialKey, rehydratedPolytopes);

  const atlas = Object.freeze({
    schema: rawEnvelope.atlasSchema || ULG_POLYTOPE_ATLAS_SCHEMA,
    builderSchema: norm.builderSchema,
    materialKey: norm.materialKey,
    family: norm.family,
    accuracyTier: rawEnvelope.accuracyTier,
    closureHash: norm.closureHash,
    pressureRangePa: norm.pressureRangePa,
    polytopeCount: rehydratedPolytopes.length,
    polytopes: Object.freeze(rehydratedPolytopes),
    packedGpuAtlas: Object.freeze({
      schema: rawPacked.schema || ULG_POLYTOPE_ATLAS_GPU_BUFFER_SCHEMA,
      polytopeCount: rehydratedPolytopes.length,
      totalFacets: Number(rawPacked.totalFacets ?? canonicalCheck.totalFacets),
      totalCoeffs: Number(rawPacked.totalCoeffs ?? canonicalCheck.totalCoeffs),
      data: packedF32
    }),
    registry,
    cacheStatus: 'hit',
    cacheBackend: backendName,
    cacheKey: norm.cacheKey
  });

  return { ok: true, atlas };
}

function createOpfsStorageAdapter(getDirFn) {
  let dirPromise = null;
  const getCacheDir = async () => {
    if (!dirPromise) {
      dirPromise = (async () => {
        const root = await getDirFn();
        return root.getDirectoryHandle(ULG_POLYTOPE_ATLAS_CACHE_DIR, { create: true });
      })();
    }
    return dirPromise;
  };
  const fileName = (key) => `${key}.json`;
  return {
    name: 'opfs',
    async readRaw(key) {
      const dir = await getCacheDir();
      try {
        const fh = await dir.getFileHandle(fileName(key), { create: false });
        const file = await fh.getFile();
        return await file.text();
      } catch (err) {
        if (err?.name === 'NotFoundError') return null;
        throw err;
      }
    },
    async writeRaw(key, text) {
      const dir = await getCacheDir();
      const fh = await dir.getFileHandle(fileName(key), { create: true });
      if (typeof fh.createWritable !== 'function') {
        throw new Error('OPFS FileSystemFileHandle.createWritable unavailable');
      }
      const writable = await fh.createWritable();
      await writable.write(text);
      await writable.close();
    },
    async deleteKey(key) {
      const dir = await getCacheDir();
      try {
        await dir.removeEntry(fileName(key));
      } catch (err) {
        if (err?.name !== 'NotFoundError') throw err;
      }
    },
    async listKeys() {
      const dir = await getCacheDir();
      const keys = [];
      if (typeof dir.keys === 'function') {
        for await (const name of dir.keys()) {
          if (String(name).endsWith('.json')) keys.push(String(name).slice(0, -5));
        }
      } else if (typeof dir.entries === 'function') {
        for await (const [name] of dir.entries()) {
          if (String(name).endsWith('.json')) keys.push(String(name).slice(0, -5));
        }
      }
      return keys;
    },
    async clear() {
      const keys = await this.listKeys();
      for (const k of keys) {
        await this.deleteKey(k);
      }
    }
  };
}

function createIndexedDbStorageAdapter(idbFactory, dbName = ULG_POLYTOPE_ATLAS_IDB_NAME) {
  let dbPromise = null;
  const openDb = () => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = idbFactory.open(dbName, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(ULG_POLYTOPE_ATLAS_IDB_STORE)) {
            db.createObjectStore(ULG_POLYTOPE_ATLAS_IDB_STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
      });
    }
    return dbPromise;
  };
  const runTx = async (mode, fn) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ULG_POLYTOPE_ATLAS_IDB_STORE, mode);
      const store = tx.objectStore(ULG_POLYTOPE_ATLAS_IDB_STORE);
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
    });
  };
  return {
    name: 'indexeddb',
    async readRaw(key) {
      const val = await runTx('readonly', (s) => s.get(key));
      return val == null ? null : String(val);
    },
    async writeRaw(key, text) {
      await runTx('readwrite', (s) => s.put(text, key));
    },
    async deleteKey(key) {
      await runTx('readwrite', (s) => s.delete(key));
    },
    async listKeys() {
      const res = await runTx('readonly', (s) => s.getAllKeys());
      return Array.isArray(res) ? res.map(String) : [];
    },
    async clear() {
      await runTx('readwrite', (s) => s.clear());
    }
  };
}

function createMemoryStorageAdapter() {
  const store = new Map();
  return {
    name: 'memory',
    async readRaw(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async writeRaw(key, text) {
      store.set(key, String(text));
    },
    async deleteKey(key) {
      store.delete(key);
    },
    async listKeys() {
      return [...store.keys()];
    },
    async clear() {
      store.clear();
    }
  };
}

/**
 * Create a content-addressed persistent OPFS -> IndexedDB -> Memory warm cache
 * for GPU-fitted Convex Polytope Atlases.
 */
export function createPolytopeAtlasPersistentCache({
  backend = 'auto',
  opfsGetDirectory = null,
  indexedDBFactory = null,
  dbName = ULG_POLYTOPE_ATLAS_IDB_NAME,
  maxEntries = 192
} = {}) {
  const stats = {
    backend: 'uninitialized',
    hits: 0,
    misses: 0,
    writes: 0,
    evictions: 0,
    staleRejections: 0,
    errors: 0,
    bytesWritten: 0,
    lastRejectionReason: null
  };

  let adapterPromise = null;
  const resolveAdapter = async () => {
    if (adapterPromise) return adapterPromise;
    adapterPromise = (async () => {
      const tryOpfs = backend === 'auto' || backend === 'opfs';
      const tryIdb = backend === 'auto' || backend === 'indexeddb';
      const getOpfsDir = opfsGetDirectory
        || (typeof globalThis.navigator?.storage?.getDirectory === 'function'
          ? () => globalThis.navigator.storage.getDirectory()
          : null);
      if (tryOpfs && getOpfsDir) {
        try {
          const opfs = createOpfsStorageAdapter(getOpfsDir);
          // Probe write/read/delete capability cleanly (some browsers lack createWritable on main thread)
          const probeKey = '__ulg_opfs_probe__';
          await opfs.writeRaw(probeKey, '{"ok":true}');
          await opfs.deleteKey(probeKey);
          stats.backend = 'opfs';
          return opfs;
        } catch {
          if (backend === 'opfs') {
            stats.backend = 'memory';
            return createMemoryStorageAdapter();
          }
        }
      }
      const idb = indexedDBFactory || (typeof globalThis.indexedDB !== 'undefined' ? globalThis.indexedDB : null);
      if (tryIdb && idb && typeof idb.open === 'function') {
        try {
          const idbAdapter = createIndexedDbStorageAdapter(idb, dbName);
          await idbAdapter.listKeys();
          stats.backend = 'indexeddb';
          return idbAdapter;
        } catch {
          // Fall back cleanly to memory
        }
      }
      stats.backend = 'memory';
      return createMemoryStorageAdapter();
    })();
    return adapterPromise;
  };

  return Object.freeze({
    schema: ULG_POLYTOPE_ATLAS_CACHE_SCHEMA,
    async getBackend() {
      const adapter = await resolveAdapter();
      return adapter.name;
    },
    async get(descriptor) {
      const norm = descriptor?.cacheKey
        ? descriptor
        : normalizePolytopeAtlasCacheDescriptor(descriptor);
      const adapter = await resolveAdapter();
      let rawText = null;
      try {
        rawText = await adapter.readRaw(norm.cacheKey);
      } catch {
        stats.errors += 1;
        stats.misses += 1;
        return null;
      }
      if (rawText == null) {
        stats.misses += 1;
        return null;
      }
      let parsed = null;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        // Corrupt JSON: fail closed and evict immediately
        stats.evictions += 1;
        stats.staleRejections += 1;
        stats.lastRejectionReason = 'corrupt-json';
        try { await adapter.deleteKey(norm.cacheKey); } catch {}
        stats.misses += 1;
        return null;
      }
      const checked = validateAndRehydrateCachedAtlas(parsed, norm, adapter.name);
      if (!checked.ok) {
        stats.evictions += 1;
        stats.staleRejections += 1;
        stats.lastRejectionReason = checked.reason;
        try { await adapter.deleteKey(norm.cacheKey); } catch {}
        stats.misses += 1;
        return null;
      }
      stats.hits += 1;
      return checked.atlas;
    },
    async set(descriptor, atlas) {
      const norm = descriptor?.cacheKey
        ? descriptor
        : normalizePolytopeAtlasCacheDescriptor(descriptor);
      const adapter = await resolveAdapter();
      const envelope = serializePolytopeAtlasEnvelope(norm, atlas);
      const jsonText = JSON.stringify(envelope);
      try {
        const existingKeys = await adapter.listKeys();
        if (existingKeys.length >= maxEntries && !existingKeys.includes(norm.cacheKey)) {
          const dropCount = existingKeys.length - maxEntries + 1;
          for (let i = 0; i < dropCount; i += 1) {
            await adapter.deleteKey(existingKeys[i]);
            stats.evictions += 1;
          }
        }
        await adapter.writeRaw(norm.cacheKey, jsonText);
        stats.writes += 1;
        stats.bytesWritten += jsonText.length;
        return Object.freeze({ ok: true, cacheKey: norm.cacheKey, backend: adapter.name, bytes: jsonText.length });
      } catch (err) {
        stats.errors += 1;
        return Object.freeze({ ok: false, cacheKey: norm.cacheKey, backend: adapter.name, error: String(err?.message || err) });
      }
    },
    async writeRawForTest(cacheKey, rawText) {
      const adapter = await resolveAdapter();
      await adapter.writeRaw(String(cacheKey), String(rawText));
    },
    async delete(cacheKey) {
      const adapter = await resolveAdapter();
      await adapter.deleteKey(String(cacheKey));
    },
    async listKeys() {
      const adapter = await resolveAdapter();
      return adapter.listKeys();
    },
    async clear() {
      const adapter = await resolveAdapter();
      await adapter.clear();
    },
    getStats() {
      return Object.freeze({ ...stats });
    }
  });
}

const SHARED_CACHE_SYM = Symbol.for('ulg.polytopeAtlasPersistentCache.v1');

export function getSharedPolytopeAtlasPersistentCache() {
  if (!globalThis[SHARED_CACHE_SYM]) {
    globalThis[SHARED_CACHE_SYM] = createPolytopeAtlasPersistentCache({ backend: 'auto' });
  }
  return globalThis[SHARED_CACHE_SYM];
}
