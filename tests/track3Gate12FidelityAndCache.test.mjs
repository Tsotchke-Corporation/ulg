import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ULG_POLYTOPE_ATLAS_CACHE_SCHEMA,
  createPolytopeAtlasPersistentCache,
  normalizePolytopeAtlasCacheDescriptor
} from '../src/runtime/material/polytopeAtlasPersistentCache.js';
import { fitAbInitioInteratomicPotential } from '../src/runtime/material/elementMdClosureWebGpu.js';
import {
  buildMultiSpeciesCrystalLattice,
  deriveCompoundBundleWebGpu
} from '../src/runtime/material/recursiveCompoundPipeline.js';
import { analyzeMultiStepReactionNetworkProfile } from '../src/runtime/chemistry/reactionPathwayWebGpu.js';
import {
  ULG_ACCURACY_TIERS,
  ULG_POLYTOPE_ATLAS_SCHEMA,
  packPolytopeAtlasForGpu
} from '../ulg-gpu-abi/src/materialFoundationAbi.js';

function makeMockOpfsRoot() {
  const dirs = new Map();
  const makeDir = (name) => {
    const files = new Map();
    return {
      name,
      async getDirectoryHandle(subName, opts = {}) {
        if (!dirs.has(subName)) {
          if (!opts.create) throw Object.assign(new Error('NotFound'), { name: 'NotFoundError' });
          dirs.set(subName, makeDir(subName));
        }
        return dirs.get(subName);
      },
      async getFileHandle(fileName, opts = {}) {
        if (!files.has(fileName)) {
          if (!opts.create) throw Object.assign(new Error('NotFound'), { name: 'NotFoundError' });
          files.set(fileName, '');
        }
        return {
          async getFile() {
            return { async text() { return files.get(fileName) ?? ''; } };
          },
          async createWritable() {
            let buf = '';
            return {
              async write(chunk) { buf += String(chunk); },
              async close() { files.set(fileName, buf); }
            };
          }
        };
      },
      async removeEntry(fileName) {
        if (!files.has(fileName)) throw Object.assign(new Error('NotFound'), { name: 'NotFoundError' });
        files.delete(fileName);
      },
      async *keys() {
        for (const k of files.keys()) yield k;
      }
    };
  };
  return makeDir('root');
}

function makeMockIndexedDbFactory() {
  const stores = new Map();
  return {
    open(dbName) {
      const req = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        if (!stores.has(dbName)) stores.set(dbName, new Map());
        const storeMap = stores.get(dbName);
        const db = {
          objectStoreNames: { contains: (n) => storeMap.has(n) },
          createObjectStore(n) { storeMap.set(n, new Map()); },
          transaction(storeName) {
            if (!storeMap.has(storeName)) storeMap.set(storeName, new Map());
            const kv = storeMap.get(storeName);
            const wrap = (fn) => {
              const r = { result: undefined, error: null, onsuccess: null, onerror: null };
              queueMicrotask(() => {
                try {
                  r.result = fn();
                  r.onsuccess?.();
                } catch (err) {
                  r.error = err;
                  r.onerror?.();
                }
              });
              return r;
            };
            return {
              objectStore() {
                return {
                  get: (k) => wrap(() => (kv.has(k) ? kv.get(k) : undefined)),
                  put: (v, k) => wrap(() => { kv.set(k, v); return k; }),
                  delete: (k) => wrap(() => { kv.delete(k); }),
                  getAllKeys: () => wrap(() => [...kv.keys()]),
                  clear: () => wrap(() => { kv.clear(); })
                };
              }
            };
          }
        };
        req.result = db;
        req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    }
  };
}

function makeSampleAtlas(materialKey = 'Fe', closureHash = 'ulg:deadbeef') {
  const polytopes = [
    {
      polytopeId: `${materialKey}:solid`,
      materialKey,
      family: 'element',
      phase: 'solid',
      accuracyTier: ULG_ACCURACY_TIERS.TIER_1_QUANTITATIVE,
      closureHash,
      invalidationKey: closureHash,
      axes: [
        { name: 'temperatureK', unit: 'K', min: 10, max: 1800 },
        { name: 'pressurePa', unit: 'Pa', min: 1e2, max: 1e10, scale: 'log10' }
      ],
      inequalities: [
        { a: [-1, 0], b: -10, scale: 1800 },
        { a: [1, 0], b: 1800, scale: 1800 },
        { a: [0, -1], b: -2, scale: 8 },
        { a: [0, 1], b: 10, scale: 8 }
      ],
      fit: {
        degrees: [2, 2],
        coefficients: new Float32Array([7874, -20, 2, 120, -1, 0.1, 4, 0, 0]),
        maxRelativeError: 0.002,
        uncertaintyBound: 0.004,
        valueTransform: 'linear',
        valid: true
      }
    }
  ];
  const packedGpuAtlas = packPolytopeAtlasForGpu(polytopes, { materialIndex: 26 });
  return {
    schema: ULG_POLYTOPE_ATLAS_SCHEMA,
    materialKey,
    family: 'element',
    accuracyTier: ULG_ACCURACY_TIERS.TIER_1_QUANTITATIVE,
    closureHash,
    polytopeCount: polytopes.length,
    polytopes,
    packedGpuAtlas
  };
}

test('PolytopeAtlasPersistentCache: OPFS round-trip, IndexedDB fallback, content-addressing & fail-closed corruption eviction', async () => {
  const opfsRoot = makeMockOpfsRoot();
  const opfsCache = createPolytopeAtlasPersistentCache({
    backend: 'opfs',
    opfsGetDirectory: async () => opfsRoot
  });

  const descLab = normalizePolytopeAtlasCacheDescriptor({
    materialKey: 'Fe',
    family: 'element',
    closureHash: 'ulg:11111111',
    generatorFingerprint: 'ulg-periodic-table-engine-webgpu.v1',
    pressureRangePa: [1e2, 1e10],
    degrees: [4, 3],
    relativeTolerance: 0.05,
    maxBisectDepth: 2,
    materialIndex: 26
  });
  const descPlanetary = normalizePolytopeAtlasCacheDescriptor({
    ...descLab,
    pressureRangePa: [1e2, 1e12]
  });
  const descStaleHash = normalizePolytopeAtlasCacheDescriptor({
    ...descLab,
    closureHash: 'ulg:22222222'
  });
  assert.notEqual(descLab.cacheKey, descPlanetary.cacheKey, 'Regime pressureRangePa must produce distinct content-addressed keys');
  assert.notEqual(descLab.cacheKey, descStaleHash.cacheKey, 'Different closureHash must produce distinct cache keys');

  assert.equal(await opfsCache.getBackend(), 'opfs');
  assert.equal(await opfsCache.get(descLab), null, 'Cold lookup misses cleanly');

  const sample = makeSampleAtlas('Fe', descLab.closureHash);
  const putRes = await opfsCache.set(descLab, sample);
  assert.equal(putRes.ok, true);
  assert.equal(putRes.backend, 'opfs');

  const hit = await opfsCache.get(descLab);
  assert.ok(hit, 'Warm OPFS lookup must hit');
  assert.equal(hit.cacheStatus, 'hit');
  assert.equal(hit.cacheBackend, 'opfs');
  assert.equal(hit.polytopeCount, 1);
  assert.ok(hit.packedGpuAtlas.data instanceof Float32Array);
  assert.deepEqual(Array.from(hit.packedGpuAtlas.data), Array.from(sample.packedGpuAtlas.data));
  const resolved = hit.registry.resolveState('Fe', { temperatureK: 300, pressurePa: 101325 });
  assert.equal(resolved.found, true);

  // Fail-closed corruption 1: truncated/malformed JSON
  await opfsCache.writeRawForTest(descLab.cacheKey, '{broken-json');
  assert.equal(await opfsCache.get(descLab), null, 'Corrupt JSON must fail closed');
  assert.equal(opfsCache.getStats().lastRejectionReason, 'corrupt-json');
  assert.equal((await opfsCache.listKeys()).includes(descLab.cacheKey), false, 'Corrupt entry must be evicted');

  // Fail-closed corruption 2: tampered closureHash inside stored JSON
  const tamperedEnvelope = {
    schema: ULG_POLYTOPE_ATLAS_CACHE_SCHEMA,
    cacheKey: descLab.cacheKey,
    materialKey: 'Fe',
    family: 'element',
    closureHash: 'ulg:tampered',
    generatorFingerprint: descLab.generatorFingerprint,
    pressureRangePa: [1e2, 1e10],
    polytopeCount: 1,
    polytopes: sample.polytopes,
    packedGpuAtlas: { data: Array.from(sample.packedGpuAtlas.data) }
  };
  await opfsCache.writeRawForTest(descLab.cacheKey, JSON.stringify(tamperedEnvelope));
  assert.equal(await opfsCache.get(descLab), null, 'Tampered closureHash must fail closed');
  assert.equal(opfsCache.getStats().lastRejectionReason, 'closure-hash-stale');

  // IndexedDB fallback backend when OPFS unavailable
  const idbCache = createPolytopeAtlasPersistentCache({
    backend: 'indexeddb',
    indexedDBFactory: makeMockIndexedDbFactory()
  });
  assert.equal(await idbCache.getBackend(), 'indexeddb');
  const idbPut = await idbCache.set(descLab, sample);
  assert.equal(idbPut.ok, true);
  assert.equal(idbPut.backend, 'indexeddb');
  const idbHit = await idbCache.get(descLab);
  assert.equal(idbHit?.cacheBackend, 'indexeddb');
  assert.equal(idbHit?.polytopeCount, 1);
});

test('5f actinide Morse+EAM alpha refinement enforces universal f-shell softness & exact zero-stress crystal equilibrium', () => {
  const cases = [
    { Z: 26, struct: 'bcc', coord: 8, aA: 2.87, eCoh: 4.28, bulkPa: 170e9, expectSoft: 1.0 },
    { Z: 64, struct: 'hcp', coord: 12, aA: 5.14, eCoh: 4.14, bulkPa: 38e9, expectSoft: 0.88 },
    { Z: 94, struct: 'hcp', coord: 12, aA: 4.95, eCoh: 3.55, bulkPa: 54e9, expectSoft: 0.78 },
    { Z: 95, struct: 'hcp', coord: 12, aA: 5.05, eCoh: 2.85, bulkPa: 45e9, expectSoft: 0.78 },
    { Z: 97, struct: 'hcp', coord: 12, aA: 5.02, eCoh: 3.10, bulkPa: 42e9, expectSoft: 0.78 }
  ];
  for (const c of cases) {
    const pot = fitAbInitioInteratomicPotential({
      Z: c.Z,
      bulkResult: {
        crystalStructure: c.struct,
        latticeConstantA: c.aA,
        cohesiveEnergyEv: c.eCoh,
        coordinationNumber: c.coord,
        bulkModulusPa: c.bulkPa
      }
    });
    assert.equal(pot.fShellSoftness, c.expectSoft, `Z=${c.Z} fShellSoftness`);
    assert.ok(pot.alphaOrLambda >= 0.85 && pot.alphaOrLambda <= 2.25, `Z=${c.Z} alpha=${pot.alphaOrLambda}`);
    // Verify exact multi-shell crystal zero-virial equilibrium sum_s N_s * r_s * f(r_s) ~ 0
    const shells = c.struct === 'bcc'
      ? [[8, 1.0], [6, 2 / Math.sqrt(3)], [12, Math.sqrt(8 / 3)], [24, Math.sqrt(11 / 3)]]
      : [[12, 1.0], [6, Math.SQRT2], [2, Math.sqrt(8 / 3)], [18, Math.sqrt(3)]];
    const active = shells.map(([cnt, rat]) => ({ cnt, r: pot.rNearestNeighborA * rat })).filter((s) => s.r < pot.rcutA - 1e-4);
    let rhoTot = 0;
    for (const sh of active) {
      const sf = 1.0 - sh.r / pot.rcutA;
      rhoTot += sh.cnt * Math.exp(-pot.eamBeta * (sh.r - pot.sigmaOrR0A)) * sf * sf;
    }
    const dF = -pot.eamAEv / (2 * Math.sqrt(Math.max(rhoTot, 1e-8)));
    let virSum = 0;
    for (const sh of active) {
      const sf = 1.0 - sh.r / pot.rcutA;
      const sf2 = sf * sf;
      const ex = Math.exp(-pot.alphaOrLambda * (sh.r - pot.sigmaOrR0A));
      const uM = pot.epsilonEv * (ex * ex - 2 * ex);
      const duM = 2 * pot.epsilonEv * pot.alphaOrLambda * (ex - ex * ex);
      const duDr = duM * sf2 - uM * (2 * sf / pot.rcutA);
      const exRho = Math.exp(-pot.eamBeta * (sh.r - pot.sigmaOrR0A));
      const dRhoDr = exRho * (-pot.eamBeta * sf2 - 2 * sf / pot.rcutA);
      const fMag = -duDr - 2 * dF * dRhoDr;
      virSum += sh.cnt * sh.r * fMag;
    }
    assert.ok(Math.abs(virSum) < 1e-2, `Z=${c.Z} multi-shell virial residual=${virSum}`);
  }
});

test('Extended covalent AX2 cristobalite-C9 classification distinguishes SiO2/GeO2 networks from molecular CO2', async () => {
  const sio2 = await deriveCompoundBundleWebGpu(null, 'SiO2', { runLiveMd: false });
  const geo2 = await deriveCompoundBundleWebGpu(null, 'GeO2', { runLiveMd: false });
  const co2 = await deriveCompoundBundleWebGpu(null, 'CO2', { runLiveMd: false });

  assert.equal(sio2.bundle.mechanical.crystalStructure, 'cristobalite-C9');
  assert.equal(sio2.bundle.mechanical.spaceGroup, 'Fd-3m (227)');
  assert.equal(sio2.bundle.electromagnetic.isMetal, false);
  assert.ok(sio2.bundle.electromagnetic.bandGapEv > 5.0, `SiO2 gap=${sio2.bundle.electromagnetic.bandGapEv}`);
  assert.ok(sio2.bundle.thermodynamic.meltingPointK > 1400, `SiO2 Tm=${sio2.bundle.thermodynamic.meltingPointK}`);
  assert.ok(sio2.bundle.mechanical.densityKgPerM3 > 1600 && sio2.bundle.mechanical.densityKgPerM3 < 3500, `SiO2 rho=${sio2.bundle.mechanical.densityKgPerM3}`);
  assert.equal(sio2.visualData.mdConfig.modelName, 'Stillinger-Weber (Tetrahedral Covalent Network)');

  assert.equal(geo2.bundle.mechanical.crystalStructure, 'cristobalite-C9');
  assert.ok(geo2.bundle.thermodynamic.meltingPointK > 1200, `GeO2 Tm=${geo2.bundle.thermodynamic.meltingPointK}`);

  // CO2 has n=2 C (strong 2p_pi-2p_pi double bonds) -> stays discrete molecular crystal!
  assert.equal(co2.bundle.mechanical.crystalStructure, 'molecular-fcc');
  assert.ok(co2.bundle.thermodynamic.meltingPointK < 400, `CO2 Tm=${co2.bundle.thermodynamic.meltingPointK}`);

  // Verify 24-atom corner-sharing tetrahedral cristobalite-C9 lattice geometry (8 Si + 16 O)
  const cell = buildMultiSpeciesCrystalLattice('SiO2', {
    crystalStructure: 'cristobalite-C9',
    latticeConstantA: 7.16,
    cellsPerSide: 1,
    paulingIonicity: 0.45
  });
  assert.equal(cell.atomCount, 24);
  assert.equal(cell.spaceGroup, 'Fd-3m (227)');
  const siSpec = cell.speciesLegend.find((s) => s.Z === 14);
  const oSpec = cell.speciesLegend.find((s) => s.Z === 8);
  assert.equal(siSpec.count, 8);
  assert.equal(oSpec.count, 16);
  assert.ok(cell.bondCount >= 16, `Cristobalite tetrahedral Si-O bonds=${cell.bondCount}`);
});

test('Multi-step reaction network Kozuch-Shaik energetic-span analyzer selects exact TDI/TDTS and Eyring k_net', () => {
  // Step 1: 0.0 -> TS1 (0.9 eV) -> I1 (-0.6 eV, deep intermediate well)
  // Step 2: I1 (-0.6 eV) -> TS2 (+0.5 eV, local barrier 1.1 eV) -> P (-0.9 eV)
  // True Kozuch-Shaik energetic span = E(TS2) - E(I1) = 0.5 - (-0.6) = 1.1 eV (TDI=1, TDTS=1)
  const analysis = analyzeMultiStepReactionNetworkProfile([
    { label: 'Step 1 (adsorption)', energiesEv: [0.0, 0.4, 0.9, 0.1, -0.6] },
    { label: 'Step 2 (rearrangement)', energiesEv: [0.0, 0.6, 1.1, 0.3, -0.3] }
  ], { temperatureK: 400 });

  assert.equal(analysis.stepCount, 2);
  assert.ok(Math.abs(analysis.energeticSpanEv - 1.1) < 1e-9, `energeticSpanEv=${analysis.energeticSpanEv}`);
  assert.equal(analysis.tdiStateIndex, 1);
  assert.equal(analysis.tdtsStepIndex, 1);
  assert.equal(analysis.rateDeterminingStepIndex, 1);
  assert.ok(Math.abs(analysis.overallReactionEnergyEv - (-0.9)) < 1e-9);
  assert.equal(analysis.stitchedProfile.length, 9, '5 + 5 - 1 shared intermediate = 9 stitched points');
  assert.ok(Math.abs(analysis.stitchedProfile[0].xi - 0) < 1e-9);
  assert.ok(Math.abs(analysis.stitchedProfile[8].xi - 2) < 1e-9);
  assert.ok(Number.isFinite(analysis.eyringNetRateSInv) && analysis.eyringNetRateSInv > 0);
});
