// Persistent OPFS -> IndexedDB -> Memory Sparse Crater Tile Store
// (`src/runtime/astrophysics/surfaceCraterTileStore.js`).
//
// Stores compact deterministic 36-byte crater/ablation stamps (up to 512/tile, < 18 KB)
// keyed by `(universeSeed, systemId, bodyId, tileX, tileZ)` matching the 768 m
// `surfaceDeformationMpmGpu.js` deformable patch so weapon craters persist seamlessly
// across orbital exits, re-landings, and page reloads with ZERO hot-loop GPU readbacks!

export const ULG_CRATER_STORE_SCHEMA = 'ulg.astrophysics.surface-crater-tile-store.v1';
export const ULG_CRATER_OPFS_DIR = 'ulg-surface-craters-v1';
export const ULG_CRATER_IDB_NAME = 'ulg-surface-craters-db';
export const ULG_CRATER_IDB_STORE = 'crater-tiles';
export const MAX_PERSISTED_CRATER_STAMPS = 512;

function sanitizeKeyPart(val, fallback = 'default') {
  const s = String(val ?? fallback).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
  return s || fallback;
}

export function buildCraterTileKey({
  universeSeed = 20261125,
  systemId = 'sol',
  bodyId = 'mars',
  tileX = 0,
  tileZ = 0
} = {}) {
  const seedU32 = (Number(universeSeed) >>> 0);
  const sys = sanitizeKeyPart(systemId, 'sol');
  const body = sanitizeKeyPart(bodyId, 'body');
  const tx = Math.trunc(Number(tileX) || 0);
  const tz = Math.trunc(Number(tileZ) || 0);
  return `${seedU32}_${sys}_${body}_${tx}_${tz}`;
}

export function normalizeCraterStamp(raw = {}) {
  return {
    kind: Math.max(1, Math.min(3, Math.trunc(Number(raw.kind) || 1))),
    x: Number.isFinite(Number(raw.x)) ? Number(raw.x) : 0,
    z: Number.isFinite(Number(raw.z)) ? Number(raw.z) : 0,
    radiusM: Math.max(0.5, Math.min(260, Number(raw.radiusM) || 10)),
    depthM: Math.max(0.02, Math.min(64, Number(raw.depthM) || 3)),
    rimM: Number.isFinite(Number(raw.rimM)) ? Number(raw.rimM) : 0.24,
    tempK: Math.max(40, Math.min(25000, Number(raw.tempK) || 1600)),
    melt: Math.max(0, Math.min(1, Number(raw.melt) || 0.6)),
    char: Math.max(0, Math.min(1, Number(raw.char) || 0.7))
  };
}

function createOpfsAdapter(getDirFn) {
  let dirPromise = null;
  const getDir = async () => {
    if (!dirPromise) {
      dirPromise = (async () => {
        const root = await getDirFn();
        return root.getDirectoryHandle(ULG_CRATER_OPFS_DIR, { create: true });
      })();
    }
    return dirPromise;
  };
  const fname = (key) => `${key}.json`;
  return {
    name: 'opfs',
    async readRaw(key) {
      const dir = await getDir();
      try {
        const fh = await dir.getFileHandle(fname(key), { create: false });
        const file = await fh.getFile();
        return await file.text();
      } catch (err) {
        if (err?.name === 'NotFoundError') return null;
        throw err;
      }
    },
    async writeRaw(key, text) {
      const dir = await getDir();
      const fh = await dir.getFileHandle(fname(key), { create: true });
      if (typeof fh.createWritable !== 'function') throw new Error('OPFS createWritable unavailable');
      const w = await fh.createWritable();
      await w.write(text);
      await w.close();
    },
    async deleteKey(key) {
      const dir = await getDir();
      try { await dir.removeEntry(fname(key)); } catch (err) {
        if (err?.name !== 'NotFoundError') throw err;
      }
    }
  };
}

function createIdbAdapter(idbFactory, dbName = ULG_CRATER_IDB_NAME) {
  let dbPromise = null;
  const openDb = () => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = idbFactory.open(dbName, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(ULG_CRATER_IDB_STORE)) {
            db.createObjectStore(ULG_CRATER_IDB_STORE);
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
      const tx = db.transaction(ULG_CRATER_IDB_STORE, mode);
      const store = tx.objectStore(ULG_CRATER_IDB_STORE);
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB tx failed'));
    });
  };
  return {
    name: 'indexeddb',
    async readRaw(key) {
      const val = await runTx('readonly', (s) => s.get(key));
      return val == null ? null : String(val);
    },
    async writeRaw(key, text) {
      await runTx('readwrite', (s) => s.put(String(text), key));
    },
    async deleteKey(key) {
      await runTx('readwrite', (s) => s.delete(key));
    }
  };
}

function createMemoryAdapter() {
  const map = new Map();
  return {
    name: 'memory',
    async readRaw(key) { return map.has(key) ? map.get(key) : null; },
    async writeRaw(key, text) { map.set(key, String(text)); },
    async deleteKey(key) { map.delete(key); }
  };
}

export function createSurfaceCraterTileStore({
  backend = 'auto',
  opfsGetDirectory = null,
  indexedDBFactory = null,
  dbName = ULG_CRATER_IDB_NAME
} = {}) {
  let adapterPromise = null;
  let resolvedBackend = 'uninitialized';
  const memoryMirror = new Map(); // Instant same-session fallback if async write is racing pagehide!

  const resolveAdapter = async () => {
    if (adapterPromise) return adapterPromise;
    adapterPromise = (async () => {
      const tryOpfs = backend === 'auto' || backend === 'opfs';
      const tryIdb = backend === 'auto' || backend === 'indexeddb';
      const getDir = opfsGetDirectory
        || (typeof globalThis.navigator?.storage?.getDirectory === 'function'
          ? () => globalThis.navigator.storage.getDirectory()
          : null);
      if (tryOpfs && getDir) {
        try {
          const opfs = createOpfsAdapter(getDir);
          const probe = '__ulg_crater_probe__';
          await opfs.writeRaw(probe, '{"ok":true}');
          await opfs.deleteKey(probe);
          resolvedBackend = 'opfs';
          return opfs;
        } catch {
          if (backend === 'opfs') {
            resolvedBackend = 'memory';
            return createMemoryAdapter();
          }
        }
      }
      const idb = indexedDBFactory || (typeof globalThis.indexedDB !== 'undefined' ? globalThis.indexedDB : null);
      if (tryIdb && idb && typeof idb.open === 'function') {
        try {
          const idbA = createIdbAdapter(idb, dbName);
          await idbA.readRaw('__ulg_probe__');
          resolvedBackend = 'indexeddb';
          return idbA;
        } catch {
          // Fall through cleanly to memory
        }
      }
      resolvedBackend = 'memory';
      return createMemoryAdapter();
    })();
    return adapterPromise;
  };

  async function saveTile(tileKey, stamps = []) {
    const clean = (Array.isArray(stamps) ? stamps : [])
      .slice(-MAX_PERSISTED_CRATER_STAMPS)
      .map(normalizeCraterStamp);
    memoryMirror.set(tileKey, clean);
    const payload = JSON.stringify({
      schema: ULG_CRATER_STORE_SCHEMA,
      updatedAtMs: Date.now(),
      stamps: clean
    });
    try {
      const adapter = await resolveAdapter();
      await adapter.writeRaw(tileKey, payload);
      return { ok: true, backend: adapter.name, count: clean.length };
    } catch {
      return { ok: false, backend: resolvedBackend, count: clean.length };
    }
  }

  async function loadTile(tileKey) {
    try {
      const adapter = await resolveAdapter();
      const raw = await adapter.readRaw(tileKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.schema === ULG_CRATER_STORE_SCHEMA && Array.isArray(parsed.stamps)) {
          const clean = parsed.stamps.slice(-MAX_PERSISTED_CRATER_STAMPS).map(normalizeCraterStamp);
          memoryMirror.set(tileKey, clean);
          return clean;
        }
      }
    } catch {
      // Fall back to memory mirror cleanly
    }
    return memoryMirror.get(tileKey) ? [...memoryMirror.get(tileKey)] : [];
  }

  async function deleteTile(tileKey) {
    memoryMirror.delete(tileKey);
    try {
      const adapter = await resolveAdapter();
      await adapter.deleteKey(tileKey);
    } catch {}
  }

  return Object.freeze({
    schema: ULG_CRATER_STORE_SCHEMA,
    get backend() { return resolvedBackend; },
    buildTileKey: buildCraterTileKey,
    saveTile,
    loadTile,
    deleteTile
  });
}
