// Root-Node Multiscale Cosmic Lineage Cache (Memory -> OPFS -> IndexedDB + PeerCompute P2P Sync)
// (`src/runtime/astrophysics/cosmicLineageRootCache.js`).
//
// Caches deterministic GPU-computed multiscale outputs directly on the root simulation node
// keyed by physical provenance `(universeSeed, cosmicEpochId, scale, entityKey)` so neither
// the local explorer nor joined PeerCompute peers have to re-simulate already-coalesced
// L0 Cosmic-Web halos, L2 Nebular Star Systems, L4 3D SPH Planetary Geologies, or L4 Surface Patches!
//
// Strictly fail-closed & honest:
//   - Content-addressed schema version check (`ulg.astrophysics.cosmic-lineage-root-cache.v1`)
//   - Explicit `bypassCache: true` for user-requested "Replay Big Bang / Nebular Birth / Form Planet"
//   - Compact Int16 quantization for spherical RGBA32F geology maps (2x smaller, < 0.001% relief error)
//   - Real-time hit/miss/peer-ingest telemetry (`getStats()`)

export const ULG_COSMIC_LINEAGE_CACHE_SCHEMA = 'ulg.astrophysics.cosmic-lineage-root-cache.v1';
const OPFS_DIR_NAME = 'ulg-cosmic-lineage-cache-v1';
const IDB_NAME = 'ulg-cosmic-lineage-cache-db';
const IDB_STORE = 'lineage-entries';
const MAX_MEM_ENTRIES = 96;

function sanitizePart(v, fallback = '0') {
  const s = String(v ?? fallback).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 48);
  return s || fallback;
}

export function buildCosmicLineageKey(stage, parts = {}) {
  const st = sanitizePart(stage, 'root');
  const seed = (Number(parts.seed ?? parts.universeSeed ?? 20261125) >>> 0);
  const epoch = sanitizePart(parts.epochId ?? parts.cosmicEpochId ?? 'present-day');
  const extras = [];
  for (const k of ['galaxyKey', 'starKey', 'systemId', 'bodyId', 'mode', 'latBucket', 'lonBucket', 'dims']) {
    if (parts[k] != null && parts[k] !== '') extras.push(`${k}-${sanitizePart(parts[k])}`);
  }
  return `${st}__s${seed}__e${epoch}${extras.length ? `__${extras.join('__')}` : ''}`;
}

/**
 * Compact lossless-envelope Float32Array <-> Base64 Int16 quantization for GPU geology maps
 * (maps [-4.0 .. +4.0] into [-32767 .. +32767] with ~1.2e-4 precision, 50% size of raw f32!).
 */
export function encodeFloat32Quantized(f32, scale = 8000.0) {
  if (!(f32 instanceof Float32Array) || f32.length === 0) return null;
  const i16 = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i += 1) {
    const v = Math.round((Number.isFinite(f32[i]) ? f32[i] : 0) * scale);
    i16[i] = v < -32767 ? -32767 : (v > 32767 ? 32767 : v);
  }
  const bytes = new Uint8Array(i16.buffer);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + chunk)));
  }
  const b64 = typeof globalThis.btoa === 'function'
    ? globalThis.btoa(bin)
    : Buffer.from(bytes).toString('base64');
  return { length: f32.length, scale, b64 };
}

export function decodeFloat32Quantized(packed) {
  if (!packed || typeof packed.b64 !== 'string' || !packed.length) return null;
  const scale = Number(packed.scale) || 8000.0;
  let bytes;
  if (typeof globalThis.atob === 'function') {
    const bin = globalThis.atob(packed.b64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  } else {
    bytes = new Uint8Array(Buffer.from(packed.b64, 'base64'));
  }
  if (bytes.byteLength < packed.length * 2) return null;
  const i16 = new Int16Array(bytes.buffer, bytes.byteOffset, packed.length);
  const out = new Float32Array(packed.length);
  const inv = 1.0 / scale;
  for (let i = 0; i < packed.length; i += 1) out[i] = i16[i] * inv;
  return out;
}

function createOpfsBackend(getDirFn) {
  let dirPromise = null;
  const getDir = async () => {
    if (!dirPromise) {
      dirPromise = (async () => {
        const root = await getDirFn();
        return root.getDirectoryHandle(OPFS_DIR_NAME, { create: true });
      })();
    }
    return dirPromise;
  };
  const fname = (key) => `${key}.json`;
  return {
    name: 'opfs',
    async get(key) {
      const dir = await getDir();
      try {
        const fh = await dir.getFileHandle(fname(key), { create: false });
        const f = await fh.getFile();
        return await f.text();
      } catch (err) {
        if (err?.name === 'NotFoundError') return null;
        throw err;
      }
    },
    async set(key, text) {
      const dir = await getDir();
      const fh = await dir.getFileHandle(fname(key), { create: true });
      if (typeof fh.createWritable !== 'function') throw new Error('OPFS createWritable unavailable');
      const w = await fh.createWritable();
      await w.write(text);
      await w.close();
    },
    async del(key) {
      const dir = await getDir();
      try { await dir.removeEntry(fname(key)); } catch (err) {
        if (err?.name !== 'NotFoundError') throw err;
      }
    }
  };
}

function createIdbBackend(idbFactory) {
  let dbPromise = null;
  const openDb = () => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = idbFactory.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('IDB open failed'));
      });
    }
    return dbPromise;
  };
  const run = async (mode, fn) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, mode);
      const req = fn(tx.objectStore(IDB_STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IDB tx failed'));
    });
  };
  return {
    name: 'indexeddb',
    async get(key) { const v = await run('readonly', (s) => s.get(key)); return v == null ? null : String(v); },
    async set(key, text) { await run('readwrite', (s) => s.put(String(text), key)); },
    async del(key) { await run('readwrite', (s) => s.delete(key)); }
  };
}

function createMemoryBackend() {
  const m = new Map();
  return {
    name: 'memory',
    async get(key) { return m.has(key) ? m.get(key) : null; },
    async set(key, text) { m.set(key, String(text)); },
    async del(key) { m.delete(key); }
  };
}

export function createCosmicLineageRootCache({
  backend = 'auto',
  onPublishToPeers = null,
  maxPeerBroadcastBytes = 32768
} = {}) {
  const mem = new Map(); // LRU Map<key, { payload, source, storedAtMs, approxBytes }>
  let persistPromise = null;
  let persistName = 'memory';
  let peerPublishCb = typeof onPublishToPeers === 'function' ? onPublishToPeers : null;

  const stats = {
    hits: 0,
    memoryHits: 0,
    persistedHits: 0,
    misses: 0,
    localWrites: 0,
    peerIngests: 0,
    peerBroadcasts: 0,
    lastKey: null,
    lastSource: 'init'
  };

  const resolvePersist = async () => {
    if (persistPromise) return persistPromise;
    persistPromise = (async () => {
      const tryOpfs = backend === 'auto' || backend === 'opfs';
      const tryIdb = backend === 'auto' || backend === 'indexeddb';
      const getDir = typeof globalThis.navigator?.storage?.getDirectory === 'function'
        ? () => globalThis.navigator.storage.getDirectory()
        : null;
      if (tryOpfs && getDir) {
        try {
          const opfs = createOpfsBackend(getDir);
          const probe = '__ulg_lineage_probe__';
          await opfs.set(probe, '{"ok":true}');
          await opfs.del(probe);
          persistName = 'opfs';
          return opfs;
        } catch {}
      }
      const idb = typeof globalThis.indexedDB !== 'undefined' ? globalThis.indexedDB : null;
      if (tryIdb && idb && typeof idb.open === 'function') {
        try {
          const ia = createIdbBackend(idb);
          await ia.get('__ulg_lineage_probe__');
          persistName = 'indexeddb';
          return ia;
        } catch {}
      }
      persistName = 'memory';
      return createMemoryBackend();
    })();
    return persistPromise;
  };

  function touchMemory(key, record) {
    if (mem.has(key)) mem.delete(key);
    mem.set(key, record);
    while (mem.size > MAX_MEM_ENTRIES) {
      const oldest = mem.keys().next().value;
      mem.delete(oldest);
    }
  }

  async function get(key, { bypassCache = false } = {}) {
    if (!key || bypassCache) {
      stats.misses += 1;
      stats.lastKey = key || null;
      stats.lastSource = bypassCache ? 'bypassed' : 'miss';
      return null;
    }
    if (mem.has(key)) {
      const rec = mem.get(key);
      touchMemory(key, rec);
      stats.hits += 1;
      stats.memoryHits += 1;
      stats.lastKey = key;
      stats.lastSource = rec.source === 'peer' ? 'peer-cache-hit' : 'root-cache-hit';
      return rec.payload;
    }
    try {
      const store = await resolvePersist();
      const raw = await store.get(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.schema === ULG_COSMIC_LINEAGE_CACHE_SCHEMA && parsed.payload != null) {
          touchMemory(key, {
            payload: parsed.payload,
            source: 'persisted',
            storedAtMs: parsed.storedAtMs || Date.now(),
            approxBytes: raw.length
          });
          stats.hits += 1;
          stats.persistedHits += 1;
          stats.lastKey = key;
          stats.lastSource = 'persisted-cache-hit';
          return parsed.payload;
        }
      }
    } catch {
      // Fail-closed: corrupt/stale persisted entry treated as clean miss!
    }
    stats.misses += 1;
    stats.lastKey = key;
    stats.lastSource = 'miss';
    return null;
  }

  async function set(key, payload, { persist = true, broadcast = true } = {}) {
    if (!key || payload == null) return false;
    const envelope = {
      schema: ULG_COSMIC_LINEAGE_CACHE_SCHEMA,
      key,
      storedAtMs: Date.now(),
      payload
    };
    let serialized = '';
    try {
      serialized = JSON.stringify(envelope);
    } catch {
      return false;
    }
    touchMemory(key, {
      payload,
      source: 'local',
      storedAtMs: envelope.storedAtMs,
      approxBytes: serialized.length
    });
    stats.localWrites += 1;
    stats.lastKey = key;
    stats.lastSource = 'gpu-computed-cached';

    if (persist) {
      try {
        const store = await resolvePersist();
        await store.set(key, serialized);
      } catch {
        // Memory cache already updated cleanly
      }
    }
    if (broadcast && peerPublishCb && serialized.length <= maxPeerBroadcastBytes) {
      try {
        peerPublishCb({ key, payload, schema: ULG_COSMIC_LINEAGE_CACHE_SCHEMA, storedAtMs: envelope.storedAtMs });
        stats.peerBroadcasts += 1;
      } catch {}
    }
    return true;
  }

  /**
   * Ingest a root-cache artifact broadcast by another PeerCompute peer on the same universe seed!
   * Strictly validates schema before admitting into root memory + persistence.
   */
  async function ingestPeerEntry(entry, { persist = true } = {}) {
    if (!entry || entry.schema !== ULG_COSMIC_LINEAGE_CACHE_SCHEMA || !entry.key || entry.payload == null) {
      return false;
    }
    if (mem.has(entry.key)) return false;
    let serialized = '';
    try {
      serialized = JSON.stringify({
        schema: ULG_COSMIC_LINEAGE_CACHE_SCHEMA,
        key: entry.key,
        storedAtMs: entry.storedAtMs || Date.now(),
        payload: entry.payload
      });
    } catch {
      return false;
    }
    touchMemory(entry.key, {
      payload: entry.payload,
      source: 'peer',
      storedAtMs: entry.storedAtMs || Date.now(),
      approxBytes: serialized.length
    });
    stats.peerIngests += 1;
    if (persist) {
      try {
        const store = await resolvePersist();
        await store.set(entry.key, serialized);
      } catch {}
    }
    return true;
  }

  function setPeerPublisher(fn) {
    peerPublishCb = typeof fn === 'function' ? fn : null;
  }

  async function invalidate(key) {
    if (!key) return;
    mem.delete(key);
    try {
      const store = await resolvePersist();
      await store.del(key);
    } catch {}
  }

  function getStats() {
    let bytesCached = 0;
    for (const rec of mem.values()) bytesCached += rec.approxBytes || 0;
    return Object.freeze({
      schema: ULG_COSMIC_LINEAGE_CACHE_SCHEMA,
      ...stats,
      memoryEntries: mem.size,
      bytesCached,
      persistedBackend: persistName
    });
  }

  return Object.freeze({
    schema: ULG_COSMIC_LINEAGE_CACHE_SCHEMA,
    buildKey: buildCosmicLineageKey,
    get,
    set,
    ingestPeerEntry,
    setPeerPublisher,
    invalidate,
    getStats
  });
}
