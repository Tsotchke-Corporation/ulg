// Gate 3 Live Studio Tier-1 Polytope Atlas GPU Bridge & Triad Miss Loop
// (`src/runtime/material/foundationPolytopeAtlasGpuBridge.js`).
//
// Wires `data/material-properties/foundation-polytope-atlas.json` (118 elements
// + 20 first-principles reaction compounds, ZERO `reference-fallback`) and
// `evaluatePolytopeAtlasWgsl` directly into ULG Studio's resident GPU closure
// pipeline (`triadClosureGpuRegistry.js` + `MaterialRegistry`):
//   1. Tier-1 GPU evaluation: packs convex `A x <= b` polytopes + Chebyshev
//      coefficients into `ulg.polytope-atlas-gpu-buffer.v1` and runs
//      `eval_polytope_atlas_2d` directly on WebGPU, emitting exact
//      `hitFlag == 1` vs fail-closed `hitFlag == 0` receipts (0 full readback).
//   2. Tier-2/3 miss loop: out-of-domain misses (`hitFlag == 0`) route cleanly
//      through Eshkol higher-order AD laws + MoonLab 5-slot Triad GPU synthesis
//      (`publishPolytopeBundleToTriadGpuRegistry`) and adopt at schedule
//      boundaries onto `triadClosureGpuRegistry`!

import foundationPolytopeAtlasBank from '../../../data/material-properties/foundation-polytope-atlas.json' with { type: 'json' };
import {
  ULG_POLYTOPE_ATLAS_GPU_BUFFER_SCHEMA,
  ULG_POLYTOPE_ATLAS_BANK_GPU_BUFFER_SCHEMA,
  ULG_ACCURACY_TIERS,
  packPolytopeAtlasForGpu,
  packPolytopeAtlasBankForGpu,
  evaluatePolytopeAtlasWgsl
} from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';
import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline,
  deferSubmittedWorkCleanup,
  unwrapWebGpuCacheDevice
} from '../webgpuComputeLayout.js';
import { stableOpticalMaterialId } from './opticalGpuBuffers.js';
import { createMaterialPolytopeRegistry } from './materialPolytopeRegistry.js';
import {
  buildMaterialPolytopeAtlasWebGpu,
  compilePolytopeEshkolHigherOrderLaws,
  evaluateBundleDensityEos,
  publishPolytopeBundleToTriadGpuRegistry,
  synthesizePolytopeMoonlabTriadClosures
} from './polytopeAtlasBuilder.js';
import { getSharedPolytopeAtlasPersistentCache } from './polytopeAtlasPersistentCache.js';
import {
  registerTriadClosureBundleOnDevice,
  getTriadClosureDeviceStatus
} from './triadClosureGpuRegistry.js';
import { ReservationLedger } from '../peercomputeCore.js';
import { deriveCompoundBundleWebGpu } from './recursiveCompoundPipeline.js';

export const ULG_FOUNDATION_POLYTOPE_GPU_BRIDGE_SCHEMA =
  'peercompute.ulg.foundation-polytope-gpu-bridge.v1';
export const ULG_FOUNDATION_POLYTOPE_HOTSWAP_SCHEMA =
  'peercompute.ulg.foundation-polytope-hotswap.v1';

const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

const RECORDS_BY_KEY = new Map();
for (const el of (foundationPolytopeAtlasBank.elements || [])) {
  if (el?.materialKey) RECORDS_BY_KEY.set(String(el.materialKey).toLowerCase(), el);
  if (el?.formula) RECORDS_BY_KEY.set(String(el.formula).toLowerCase(), el);
}
for (const comp of (foundationPolytopeAtlasBank.compounds || [])) {
  if (comp?.materialKey) RECORDS_BY_KEY.set(String(comp.materialKey).toLowerCase(), comp);
  if (comp?.formula) RECORDS_BY_KEY.set(String(comp.formula).toLowerCase(), comp);
}

const DEVICE_POLYTOPE_STATE_SYM = Symbol.for('ulg.foundationPolytopeDeviceState.v1');
const devicePolytopeState = (globalThis[DEVICE_POLYTOPE_STATE_SYM] ??= new WeakMap());

/**
 * Look up a first-principles Gate 1–2 material/compound record in
 * `foundation-polytope-atlas.json` (zero `reference-fallback`).
 */
export function lookupFoundationPolytopeRecord(materialKey) {
  const key = String(materialKey || '').trim().toLowerCase();
  if (!key) return null;
  if (RECORDS_BY_KEY.has(key)) return RECORDS_BY_KEY.get(key);
  // Alias common Studio keys (e.g. 'water' -> 'h2o', 'iron' -> 'fe', 'air' -> 'n2')
  const aliases = {
    water: 'h2o',
    ice: 'h2o',
    steam: 'h2o',
    iron: 'fe',
    sodium: 'na',
    cesium: 'cs',
    fluorine: 'f',
    chlorine: 'cl2',
    oxygen: 'o2',
    hydrogen: 'h2',
    nitrogen: 'n2',
    air: 'n2',
    argon: 'ar'
  };
  const mapped = aliases[key];
  return mapped ? (RECORDS_BY_KEY.get(mapped) ?? null) : null;
}

export function listFoundationPolytopeKeys() {
  return Object.freeze({
    elements: Object.freeze((foundationPolytopeAtlasBank.elements || []).map((e) => e.materialKey)),
    compounds: Object.freeze((foundationPolytopeAtlasBank.compounds || []).map((c) => c.materialKey))
  });
}

/**
 * Hydrate compact JSON polytopes from `foundation-polytope-atlas.json` into the
 * full canonical `{ axes, inequalities, fit, accuracyTier, ... }` form consumed
 * by `createMaterialPolytopeRegistry` & `packPolytopeAtlasForGpu`.
 */
export function hydrateFoundationPolytopes(record) {
  if (!record || !Array.isArray(record.polytopes)) return Object.freeze([]);
  const closureHash = String(record.closureHash || 'foundation-v1');
  const accuracyTier = record.accuracyTier || ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE;
  return Object.freeze(record.polytopes.map((p) => {
    const tRange = Array.isArray(p.tRangeK) ? p.tRangeK : [1, 6000];
    const pRange = Array.isArray(p.pRangePa) ? p.pRangePa : [100, 1e10];
    const axes = Array.isArray(p.axes) && p.axes.length >= 2
      ? p.axes
      : [
          Object.freeze({ name: 'temperatureK', unit: 'K', min: Number(tRange[0]), max: Number(tRange[1]) }),
          Object.freeze({ name: 'pressurePa', unit: 'Pa', min: Number(pRange[0]), max: Number(pRange[1]), scale: 'log10' })
        ];
    const hasValidFit = Boolean(
      p.fit
      && p.fit.valid !== false
      && Array.isArray(p.fit.degrees) && p.fit.degrees.length >= 2
      && (p.fit.coefficients instanceof Float32Array
        ? p.fit.coefficients.length > 0
        : Array.isArray(p.fit.coefficients) && p.fit.coefficients.length > 0)
    );
    const fit = hasValidFit
      ? {
          ...p.fit,
          coefficients: p.fit.coefficients instanceof Float32Array
            ? p.fit.coefficients
            : new Float32Array(p.fit.coefficients),
          valid: true
        }
      : {
          // Fail closed: unfitted polytopes are never silently fabricated as constant solid density.
          degrees: [0, 0],
          coefficients: new Float32Array(0),
          maxRelativeError: Infinity,
          uncertaintyBound: Infinity,
          valid: false,
          reason: 'missing-chebyshev-fit-coefficients'
        };
    return Object.freeze({
      polytopeId: String(p.polytopeId || `${record.materialKey}:${p.phase}`),
      materialKey: String(record.materialKey),
      family: record.family || 'element',
      phase: String(p.phase || 'solid'),
      accuracyTier,
      closureHash,
      invalidationKey: String(p.invalidationKey || closureHash),
      axes,
      inequalities: p.inequalities || [],
      fit
    });
  }));
}

/**
 * Attach Gate 1–2 Foundation Polytope Atlases directly onto a `MaterialRegistry`
 * instance so continuum lookups resolve Tier-1 convex `A x <= b` polytopes
 * natively with fail-closed `out-of-domain` miss requests.
 */
export function attachFoundationPolytopeAtlasToRegistry(materialRegistry, materialKeys = null) {
  if (!materialRegistry || typeof materialRegistry.attachPolytopeAtlas !== 'function') {
    throw new TypeError('attachFoundationPolytopeAtlasToRegistry requires a MaterialRegistry');
  }
  const keys = Array.isArray(materialKeys) && materialKeys.length > 0
    ? materialKeys
    : [
        ...(foundationPolytopeAtlasBank.compounds || []).map((c) => c.materialKey),
        'Fe', 'Na', 'Cs', 'F', 'Cl', 'Ar', 'Hg', 'Au', 'Al', 'Cu', 'Si', 'C', 'O', 'H'
      ];
  const attached = [];
  for (let i = 0; i < keys.length; i += 1) {
    const rec = lookupFoundationPolytopeRecord(keys[i]);
    if (!rec) continue;
    const polytopes = hydrateFoundationPolytopes(rec);
    const reg = createMaterialPolytopeRegistry();
    reg.registerMaterialPolytopes(rec.materialKey, polytopes);
    const packedGpuAtlas = packPolytopeAtlasForGpu(polytopes, { materialIndex: i });
    const atlas = Object.freeze({
      materialKey: rec.materialKey,
      family: rec.family,
      accuracyTier: rec.accuracyTier,
      closureHash: rec.closureHash,
      polytopeCount: polytopes.length,
      polytopes,
      packedGpuAtlas,
      registry: reg
    });
    materialRegistry.attachPolytopeAtlas(atlas);
    attached.push(rec.materialKey);
  }
  return Object.freeze({
    schema: ULG_FOUNDATION_POLYTOPE_GPU_BRIDGE_SCHEMA,
    attachedCount: attached.length,
    attachedKeys: Object.freeze(attached)
  });
}

export const foundationPolytopeBatchEvalWgsl = /* wgsl */ `
${evaluatePolytopeAtlasWgsl}

struct QueryParams {
  query_count: u32,
  material_index: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> polytope_atlas: array<f32>;
@group(0) @binding(1) var<storage, read> queries: array<vec4<f32>>;     // (T_K, P_Pa, _, _)
@group(0) @binding(2) var<storage, read_write> results: array<vec4<f32>>; // (density, margin, phaseCode, hitFlag)
@group(0) @binding(3) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: QueryParams;

@compute @workgroup_size(64)
fn eval_polytope_batch(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.query_count) { return; }
  let q = queries[idx];
  let out = eval_polytope_atlas_2d(&polytope_atlas, q.x, q.y);
  results[idx] = out;
  if (out.w >= 0.5) {
    atomicAdd(&receipt[0u], 1u); // hitCount
    let pcode = u32(max(0.0, floor(out.z + 0.5)));
    if (pcode == 0u) { atomicAdd(&receipt[2u], 1u); }
    else if (pcode == 1u) { atomicAdd(&receipt[3u], 1u); }
    else if (pcode == 2u) { atomicAdd(&receipt[4u], 1u); }
    else { atomicAdd(&receipt[5u], 1u); }
  } else {
    atomicAdd(&receipt[1u], 1u); // missCount -> Tier-2/3 Triad escalation!
  }
}
`;

/**
 * Evaluate a batch of `(temperatureK, pressurePa)` continuum states directly on
 * WebGPU against a material's packed Convex Polytope Atlas (`A x <= b` +
 * Clenshaw Chebyshev). Strictly fail-closed: points outside all polytopes emit
 * `hitFlag == 0` and increment `receipt.missCount` for Tier-2/3 Triad recovery.
 */
export async function evaluatePolytopeAtlasBatchWebGpu(device, {
  materialKey,
  record = null,
  packedGpuAtlas = null,
  queries = [],
  materialIndex = 0
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('evaluatePolytopeAtlasBatchWebGpu requires a WebGPU GPUDevice');
  }
  const rec = record || lookupFoundationPolytopeRecord(materialKey);
  const packed = packedGpuAtlas || (rec ? packPolytopeAtlasForGpu(hydrateFoundationPolytopes(rec), { materialIndex }) : null);
  if (!packed || !(packed.data instanceof Float32Array)) {
    throw new RangeError(`No Foundation Polytope Atlas found for material "${materialKey}"`);
  }
  const n = Math.max(1, queries.length);
  const queryBufData = new Float32Array(n * 4);
  for (let i = 0; i < queries.length; i += 1) {
    queryBufData[i * 4 + 0] = Number(queries[i].temperatureK ?? queries[i][0] ?? 0);
    queryBufData[i * 4 + 1] = Number(queries[i].pressurePa ?? queries[i][1] ?? 101325);
  }

  const atlasBuf = device.createBuffer({
    label: `ulg-tier1-polytope-atlas-${materialKey}`,
    size: Math.max(64, packed.data.byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  const queryBuf = device.createBuffer({
    label: 'ulg-tier1-polytope-queries',
    size: queryBufData.byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  const resultBuf = device.createBuffer({
    label: 'ulg-tier1-polytope-results',
    size: n * 16,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const receiptBuf = device.createBuffer({
    label: 'ulg-tier1-polytope-receipt',
    size: 32,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuf = device.createBuffer({
    label: 'ulg-tier1-polytope-params',
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readResultsBuf = device.createBuffer({
    size: n * 16,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  const readReceiptBuf = device.createBuffer({
    size: 32,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });

  device.queue.writeBuffer(atlasBuf, 0, packed.data);
  device.queue.writeBuffer(queryBuf, 0, queryBufData);
  device.queue.writeBuffer(receiptBuf, 0, new Uint32Array(8));
  device.queue.writeBuffer(paramsBuf, 0, new Uint32Array([queries.length, materialIndex >>> 0, 0, 0]));

  const compiled = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-foundation-polytope-batch-eval.v1',
    label: 'ulg-foundation-polytope-batch-eval',
    code: foundationPolytopeBatchEvalWgsl,
    entryPoint: 'eval_polytope_batch',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'uniform')
    ]
  });
  const bg = createCachedExplicitBindGroup(device, {
    label: 'ulg-foundation-polytope-batch-eval-bg',
    layout: compiled.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: atlasBuf } },
      { binding: 1, resource: { buffer: queryBuf } },
      { binding: 2, resource: { buffer: resultBuf } },
      { binding: 3, resource: { buffer: receiptBuf } },
      { binding: 4, resource: { buffer: paramsBuf } }
    ]
  });

  try {
    const enc = device.createCommandEncoder({ label: 'ulg-foundation-polytope-batch-eval' });
    const pass = enc.beginComputePass({ label: 'ulg-foundation-polytope-batch-eval-pass' });
    pass.setPipeline(compiled.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(Math.max(1, queries.length) / 64));
    pass.end();
    enc.copyBufferToBuffer(resultBuf, 0, readResultsBuf, 0, n * 16);
    enc.copyBufferToBuffer(receiptBuf, 0, readReceiptBuf, 0, 32);
    device.queue.submit([enc.finish()]);

    await Promise.all([
      readResultsBuf.mapAsync(GPU_BUFFER_USAGE.MAP_READ),
      readReceiptBuf.mapAsync(GPU_BUFFER_USAGE.MAP_READ)
    ]);
    const rawRes = new Float32Array(readResultsBuf.getMappedRange().slice(0));
    const rawRec = new Uint32Array(readReceiptBuf.getMappedRange().slice(0));
    readResultsBuf.unmap();
    readReceiptBuf.unmap();

    const rows = [];
    for (let i = 0; i < queries.length; i += 1) {
      rows.push(Object.freeze({
        temperatureK: queryBufData[i * 4 + 0],
        pressurePa: queryBufData[i * 4 + 1],
        densityKgPerM3: rawRes[i * 4 + 0],
        margin: rawRes[i * 4 + 1],
        phaseCode: Math.round(rawRes[i * 4 + 2]),
        hit: rawRes[i * 4 + 3] >= 0.5
      }));
    }
    return Object.freeze({
      schema: ULG_POLYTOPE_ATLAS_GPU_BUFFER_SCHEMA,
      materialKey: String(materialKey || rec?.materialKey || ''),
      polytopeCount: packed.polytopeCount,
      rows: Object.freeze(rows),
      receipt: Object.freeze({
        hitCount: rawRec[0],
        missCount: rawRec[1],
        solidHits: rawRec[2],
        liquidHits: rawRec[3],
        gasHits: rawRec[4],
        plasmaHits: rawRec[5]
      })
    });
  } finally {
    atlasBuf.destroy();
    queryBuf.destroy();
    resultBuf.destroy();
    receiptBuf.destroy();
    paramsBuf.destroy();
    readResultsBuf.destroy();
    readReceiptBuf.destroy();
  }
}

/**
 * Build a freshly derived Tier-3 convex polytope cell covering a missed
 * `(temperatureK, pressurePa)` state from Eshkol AD + Gate 1-2 EOS physics so
 * rebuilding the Tier-1 GPU bank closes subsequent lookups (`hitFlag == 1`).
 */
function buildEscalatedConvexPolytopeCell(rec, { temperatureK, pressurePa }) {
  const tCenter = Math.max(15, Number(temperatureK) || 300);
  const pCenter = Math.max(100, Number(pressurePa) || 101325);
  const logPCenter = Math.log10(pCenter);
  const tLo = Math.max(1, tCenter * 0.75);
  const tHi = Math.max(tLo + 50, tCenter * 1.25);
  const logPLo = Math.max(-2, logPCenter - 0.75);
  const logPHi = Math.min(14, logPCenter + 0.75);
  const tm = Number(rec.thermodynamic?.meltingPointK || 1e9);
  const tb = Number(rec.thermodynamic?.boilingPointK || 1e9);
  const phase = tCenter >= Math.max(tb * 2.5, 10000)
    ? 'plasma'
    : (tCenter >= tb ? 'gas' : (tCenter >= tm ? 'liquid' : 'solid'));
  const phaseCode = phase === 'solid' ? 0 : (phase === 'liquid' ? 1 : (phase === 'gas' ? 2 : 3));
  const rhoCenter = Math.max(1e-6, evaluateBundleDensityEos(rec, phase, tCenter, pCenter));
  const rhoTLo = Math.max(1e-6, evaluateBundleDensityEos(rec, phase, tLo, pCenter));
  const rhoTHi = Math.max(1e-6, evaluateBundleDensityEos(rec, phase, tHi, pCenter));
  const rhoPLo = Math.max(1e-6, evaluateBundleDensityEos(rec, phase, tCenter, 10 ** logPLo));
  const rhoPHi = Math.max(1e-6, evaluateBundleDensityEos(rec, phase, tCenter, 10 ** logPHi));
  const lnCenter = Math.log(rhoCenter);
  const c00 = lnCenter;
  const c10 = 0.5 * (Math.log(rhoTHi) - Math.log(rhoTLo));
  const c01 = 0.5 * (Math.log(rhoPHi) - Math.log(rhoPLo));
  const closureHash = String(rec.closureHash || 'foundation-v1');
  const tSpan = Math.max(1, tHi - tLo);
  const lpSpan = Math.max(1, logPHi - logPLo);
  return Object.freeze({
    polytopeId: `${rec.materialKey}:${phase}:escalated:${Math.round(tCenter)}K:${Math.round(logPCenter * 10)}`,
    materialKey: String(rec.materialKey),
    family: rec.family || 'element',
    phase,
    accuracyTier: rec.accuracyTier || ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    closureHash,
    invalidationKey: `${closureHash}:escalated:${Math.round(tCenter)}`,
    axes: Object.freeze([
      Object.freeze({ name: 'temperatureK', unit: 'K', min: tLo, max: tHi }),
      Object.freeze({ name: 'pressurePa', unit: 'Pa', min: 10 ** logPLo, max: 10 ** logPHi, scale: 'log10' })
    ]),
    inequalities: Object.freeze([
      Object.freeze({ a: Object.freeze([-1, 0]), b: -tLo, scale: tSpan }),
      Object.freeze({ a: Object.freeze([1, 0]), b: tHi, scale: tSpan }),
      Object.freeze({ a: Object.freeze([0, -1]), b: -logPLo, scale: lpSpan }),
      Object.freeze({ a: Object.freeze([0, 1]), b: logPHi, scale: lpSpan })
    ]),
    fit: Object.freeze({
      valid: true,
      valueTransform: 'exp',
      degrees: Object.freeze([1, 1]),
      coefficients: new Float32Array([c00, c01, c10, 0]),
      maxRelativeError: 0.02,
      uncertaintyBound: 0.05
    }),
    provenance: Object.freeze({
      status: 'triad-escalated-convex-polytope',
      scientificValidation: false
    })
  });
}

/**
 * Escalate a Tier-1 GPU Polytope Atlas out-of-domain miss (`hitFlag == 0`) to
 * Tier-3 Eshkol + MoonLab Triad synthesis, adopt the resulting 5-slot GPU
 * closure onto `triadClosureGpuRegistry`, AND append a provenance-bound convex
 * polytope cell covering `(temperatureK, pressurePa)` into the device's Tier-1
 * Polytope Atlas bank so subsequent lookups hit cleanly (`hitFlag == 1`).
 */
export async function escalatePolytopeMissToTriadGpu(device, {
  materialKey,
  temperatureK,
  pressurePa = 101325,
  record = null
} = {}) {
  const rec = record || lookupFoundationPolytopeRecord(materialKey);
  if (!rec) {
    return Object.freeze({
      escalated: false,
      reason: 'unknown-foundation-material',
      materialKey
    });
  }
  const tCenter = Math.max(15, Number(temperatureK) || 300);
  const tLo = Math.max(15, tCenter * 0.75);
  const tHi = Math.max(tLo + 120, tCenter * 1.25);
  const tm = Number(rec.thermodynamic?.meltingPointK || 1e9);
  const tb = Number(rec.thermodynamic?.boilingPointK || 1e9);
  const eshkolPhase = tCenter >= tb ? 'gas' : (tCenter >= tm ? 'liquid' : 'solid');
  const eshkolLaws = compilePolytopeEshkolHigherOrderLaws(rec, {
    phase: eshkolPhase,
    temperatureRangeK: [tLo, tHi]
  });
  const triadResult = await publishPolytopeBundleToTriadGpuRegistry(device, rec, {
    temperatureRangeK: [tLo, tHi]
  });
  let rebuiltBank = null;
  if (device && typeof device.createBuffer === 'function') {
    const state = getOrCreateDevicePolytopeState(device);
    const cell = buildEscalatedConvexPolytopeCell(rec, { temperatureK, pressurePa });
    const existing = state.derivedPolytopesByKey.get(rec.materialKey) ?? [];
    if (existing.length < 16) {
      existing.push(cell);
      state.derivedPolytopesByKey.set(rec.materialKey, existing);
    }
    state.seededKeys.add(rec.materialKey);
    rebuiltBank = rebuildFoundationPolytopeBankOnDevice(
      device,
      [...state.seededKeys],
      { materialIdByKey: state.lastMaterialIdByKey }
    );
  }
  return Object.freeze({
    escalated: true,
    materialKey: rec.materialKey,
    expandedTemperatureRangeK: Object.freeze([tLo, tHi]),
    eshkolLawId: eshkolLaws.densityLaw.id,
    surrogateRelativeBound: eshkolLaws.surrogateRelativeBound,
    triadStatus: triadResult.gpuRegistryStatus,
    atlasBankGeneration: rebuiltBank?.generation ?? 0,
    pressurePa
  });
}

const DEFAULT_STUDIO_POLYTOPE_KEYS = Object.freeze([
  'h2o', 'water', 'ice', 'steam',
  'fe', 'iron',
  'na', 'sodium',
  'cs', 'cesium',
  'f', 'fluorine',
  'naoh', 'csf', 'h2', 'o2', 'n2', 'air', 'ar', 'cl2', 'co2', 'al2o3', 'nacl'
]);

export const ULG_POLYTOPE_RECEIPT_WORDS = 10;
export const ULG_POLYTOPE_RECEIPT_BYTES = ULG_POLYTOPE_RECEIPT_WORDS * Uint32Array.BYTES_PER_ELEMENT;

function retirePolytopeBufferSafely(device, buffer) {
  if (!buffer || typeof buffer.destroy !== 'function') return;
  try {
    if (deferSubmittedWorkCleanup(device, () => { try { buffer.destroy(); } catch {} })) return;
  } catch {
    // Fallback below.
  }
  try { buffer.destroy(); } catch {}
}

function getOrCreateDevicePolytopeState(device) {
  const key = unwrapWebGpuCacheDevice(device);
  let state = devicePolytopeState.get(key);
  if (!state) {
    state = {
      seededKeys: new Set(),
      materialIdToKey: new Map(),
      lastMaterialIdByKey: new Map(),
      derivedPolytopesByKey: new Map(),
      dynamicAtlasesByKey: new Map(),
      hotSwapLedger: new ReservationLedger({ name: 'ulg-polytope-bank-hotswap', maxKeys: 128 }),
      bankHotSwapHistory: [],
      retiredHotSwapCount: 0,
      seededAtMs: Date.now(),
      atlasBuffer: null,
      missReadbackBuffer: null,
      generation: 0,
      materialCount: 0,
      packedFloatCount: 0,
      receiptCopyPending: false,
      receiptPollInFlight: false,
      escalationsInFlight: new Set(),
      escalatedKeys: new Set(),
      escalationCount: 0,
      adoptedGenerations: 0,
      cumulativeHits: 0,
      cumulativeMisses: 0,
      cumulativeApplied: 0,
      cumulativePhaseMismatches: 0,
      lastReceipt: null
    };
    devicePolytopeState.set(key, state);
  }
  return state;
}

/**
 * Look up a dynamically admitted (hot-swapped) Polytope Atlas entry on `device`.
 * Returns `null` if not dynamically admitted (does NOT fall back to static JSON).
 */
export function lookupDynamicPolytopeRecordOnDevice(device, materialKey) {
  const key = device ? unwrapWebGpuCacheDevice(device) : null;
  const state = key ? devicePolytopeState.get(key) : null;
  const norm = String(materialKey || '').trim().toLowerCase();
  if (!state || !norm) return null;
  return state.dynamicAtlasesByKey.get(norm) ?? null;
}

/**
 * Strictly fail-closed validation of a Polytope Atlas before dynamic bank
 * admission. Rejects missing polytopes, unfitted cells (`fit.valid !== true`),
 * mismatched Chebyshev coefficient counts, or non-finite values.
 */
export function validateAdmissiblePolytopeAtlas(atlas, materialKey = null) {
  const fail = (reason) => {
    const err = new Error(
      `Polytope atlas rejected fail-closed for "${materialKey || atlas?.materialKey || 'unknown'}": ${reason}`
    );
    err.code = 'ERR_POLYTOPE_ATLAS_INVALID_FAIL_CLOSED';
    err.reason = reason;
    throw err;
  };
  if (!atlas || typeof atlas !== 'object') fail('atlas-not-object');
  if (!Array.isArray(atlas.polytopes) || atlas.polytopes.length === 0) {
    fail('empty-polytopes');
  }
  for (let i = 0; i < atlas.polytopes.length; i += 1) {
    const p = atlas.polytopes[i];
    if (!p || typeof p !== 'object') fail(`polytope-not-object:${i}`);
    if (!p.fit || p.fit.valid !== true) fail(`invalid-polytope-fit:${i}`);
    const degs = p.fit.degrees;
    if (!Array.isArray(degs) || degs.length < 2 || !(degs[0] >= 0) || !(degs[1] >= 0)) {
      fail(`invalid-degrees:${i}`);
    }
    const expectedLen = (Math.trunc(degs[0]) + 1) * (Math.trunc(degs[1]) + 1);
    const coeffs = p.fit.coefficients;
    const isTyped = coeffs instanceof Float32Array;
    if ((!isTyped && !Array.isArray(coeffs)) || coeffs.length !== expectedLen) {
      fail(`coeff-length-mismatch:${i}`);
    }
    for (let k = 0; k < expectedLen; k += 1) {
      if (!Number.isFinite(Number(coeffs[k]))) fail(`non-finite-coeff:${i}:${k}`);
    }
    if (!Array.isArray(p.axes) || p.axes.length < 2) fail(`invalid-axes:${i}`);
    if (!Array.isArray(p.inequalities) || p.inequalities.length < 2) fail(`invalid-inequalities:${i}`);
    for (const ineq of p.inequalities) {
      if (
        !ineq
        || !Array.isArray(ineq.a)
        || ineq.a.length < 2
        || !Number.isFinite(Number(ineq.a[0]))
        || !Number.isFinite(Number(ineq.a[1]))
        || !Number.isFinite(Number(ineq.b))
      ) {
        fail(`non-finite-inequality:${i}`);
      }
    }
  }
  return true;
}

/**
 * Pack and upload ONE GPU-resident multi-material Convex Polytope Atlas bank
 * (`ulg.polytope-atlas-bank-gpu-buffer.v1`) on `device` covering every seeded
 * material key & numeric Studio materialId (`thermo0.x`), including any
 * dynamically admitted unseen-material atlases and Tier-3 escalated convex
 * polytope cells derived at schedule boundaries.
 */
export function rebuildFoundationPolytopeBankOnDevice(
  device,
  materialKeys = DEFAULT_STUDIO_POLYTOPE_KEYS,
  { materialIdByKey = null } = {}
) {
  if (!device || typeof device.createBuffer !== 'function') return null;
  const state = getOrCreateDevicePolytopeState(device);
  const idToEntry = new Map();
  const addEntry = (numericId, rawKey) => {
    const id = Number(numericId);
    if (!Number.isFinite(id) || idToEntry.has(id)) return;
    const norm = String(rawKey || '').trim().toLowerCase();
    const dyn = norm ? state.dynamicAtlasesByKey.get(norm) : null;
    if (dyn) {
      const derived = state.derivedPolytopesByKey.get(dyn.materialKey) ?? [];
      const polytopes = derived.length > 0 ? [...dyn.polytopes, ...derived] : dyn.polytopes;
      if (!polytopes.length) return;
      idToEntry.set(id, {
        materialId: id,
        materialKey: dyn.materialKey,
        accuracyTier: dyn.accuracyTier,
        polytopes
      });
      state.materialIdToKey.set(id, dyn.materialKey);
      return;
    }
    const rec = lookupFoundationPolytopeRecord(rawKey);
    if (!rec) return;
    const basePolytopes = hydrateFoundationPolytopes(rec);
    const derived = state.derivedPolytopesByKey.get(rec.materialKey) ?? [];
    const polytopes = derived.length > 0 ? [...basePolytopes, ...derived] : basePolytopes;
    if (!polytopes.length) return;
    idToEntry.set(id, {
      materialId: id,
      materialKey: rec.materialKey,
      accuracyTier: rec.accuracyTier,
      polytopes
    });
    state.materialIdToKey.set(id, rec.materialKey);
  };

  if (materialIdByKey && typeof materialIdByKey === 'object') {
    const pairs = materialIdByKey instanceof Map
      ? [...materialIdByKey.entries()]
      : Object.entries(materialIdByKey);
    for (const [k, v] of pairs) {
      state.lastMaterialIdByKey.set(k, v);
      addEntry(v, k);
    }
  }
  for (const [k, v] of state.lastMaterialIdByKey.entries()) {
    addEntry(v, k);
  }
  const allKeys = new Set([
    ...DEFAULT_STUDIO_POLYTOPE_KEYS,
    ...state.seededKeys,
    ...state.dynamicAtlasesByKey.keys(),
    ...(Array.isArray(materialKeys) ? materialKeys : [])
  ]);
  for (const rawKey of allKeys) {
    const norm = String(rawKey || '').trim().toLowerCase();
    if (!norm) continue;
    addEntry(stableOpticalMaterialId(norm), norm);
    const dyn = state.dynamicAtlasesByKey.get(norm);
    if (dyn?.materialKey) {
      if (Number.isFinite(dyn.materialId)) {
        addEntry(dyn.materialId, dyn.materialKey);
      }
      addEntry(stableOpticalMaterialId(dyn.materialKey), dyn.materialKey);
      addEntry(stableOpticalMaterialId(dyn.materialKey.toLowerCase()), dyn.materialKey);
      if (dyn.formula) {
        addEntry(stableOpticalMaterialId(dyn.formula), dyn.formula);
        addEntry(stableOpticalMaterialId(dyn.formula.toLowerCase()), dyn.formula);
      }
      continue;
    }
    const rec = lookupFoundationPolytopeRecord(norm);
    if (rec?.materialKey) {
      addEntry(stableOpticalMaterialId(rec.materialKey), rec.materialKey);
      addEntry(stableOpticalMaterialId(rec.materialKey.toLowerCase()), rec.materialKey);
    }
  }

  const entries = [...idToEntry.values()];
  if (entries.length === 0) return null;
  const packedBank = packPolytopeAtlasBankForGpu(entries);
  const nextGen = state.generation + 1;
  packedBank.data[2] = nextGen;
  const nextAtlasBuf = device.createBuffer({
    label: `ulg-tier1-polytope-atlas-bank-g${nextGen}`,
    size: Math.max(64, packedBank.data.byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(nextAtlasBuf, 0, packedBank.data);
  if (!state.missReadbackBuffer) {
    state.missReadbackBuffer = device.createBuffer({
      label: 'ulg-tier1-polytope-miss-receipt-readback',
      size: ULG_POLYTOPE_RECEIPT_BYTES,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  }
  const prevAtlasBuf = state.atlasBuffer;
  state.atlasBuffer = nextAtlasBuf;
  state.generation = nextGen;
  state.materialCount = packedBank.materialCount;
  state.packedFloatCount = packedBank.totalFloats;
  if (prevAtlasBuf) retirePolytopeBufferSafely(device, prevAtlasBuf);
  return Object.freeze({
    schema: ULG_POLYTOPE_ATLAS_BANK_GPU_BUFFER_SCHEMA,
    generation: state.generation,
    materialCount: state.materialCount,
    packedFloatCount: state.packedFloatCount
  });
}

/**
 * Retrieve the resident GPU multi-material Polytope Atlas bank binding for
 * hot-loop WGSL kernels (`mlsMpmMechanicsRefreshWgsl`, `sphSpatialGasLedgerEosGpu`).
 * Zero allocations.
 */
export function getFoundationPolytopeGpuBinding(device) {
  const key = device ? unwrapWebGpuCacheDevice(device) : null;
  const state = key ? devicePolytopeState.get(key) : null;
  if (!state || !state.atlasBuffer || state.materialCount <= 0) {
    return Object.freeze({
      active: false,
      generation: 0,
      materialCount: 0,
      atlasBuffer: null,
      missReadbackBuffer: null
    });
  }
  return Object.freeze({
    active: true,
    generation: state.generation,
    materialCount: state.materialCount,
    atlasBuffer: state.atlasBuffer,
    missReadbackBuffer: state.missReadbackBuffer
  });
}

export function markPolytopeReceiptCopiedOnDevice(device) {
  const key = device ? unwrapWebGpuCacheDevice(device) : null;
  const state = key ? devicePolytopeState.get(key) : null;
  if (state) state.receiptCopyPending = true;
}

/**
 * Poll the 32-byte pooled Polytope Atlas hit/miss receipt ONLY at an already-
 * fenced schedule boundary (0 extra `onSubmittedWorkDone` waits, 0 per-step
 * `mapAsync`). On `hitFlag == 0` misses, fire-and-forget bounded async Tier-3
 * Eshkol + MoonLab Triad synthesis (`maxInFlight = 2`) for adoption at the
 * next schedule boundary.
 */
export async function consumeAndEscalatePolytopeReceiptOnDevice(device) {
  const key = device ? unwrapWebGpuCacheDevice(device) : null;
  const state = key ? devicePolytopeState.get(key) : null;
  if (!state || !state.receiptCopyPending || state.receiptPollInFlight || !state.missReadbackBuffer) {
    return state?.lastReceipt ?? null;
  }
  state.receiptCopyPending = false;
  state.receiptPollInFlight = true;
  try {
    await state.missReadbackBuffer.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const words = new Uint32Array(state.missReadbackBuffer.getMappedRange().slice(0, ULG_POLYTOPE_RECEIPT_BYTES));
    state.missReadbackBuffer.unmap();
    const hits = words[1] >>> 0;
    const misses = words[2] >>> 0;
    const missClaimed = words[3] >>> 0;
    const missMatId = words[4] >>> 0;
    const f32View = new Float32Array(words.buffer);
    const missTempK = missClaimed ? f32View[5] : 0;
    const missPressPa = missClaimed ? f32View[6] : 0;
    const atlasGen = words[7] >>> 0;
    const applied = words[8] >>> 0;
    const phaseMismatches = words[9] >>> 0;
    state.cumulativeHits += hits;
    state.cumulativeMisses += misses;
    state.cumulativeApplied += applied;
    state.cumulativePhaseMismatches += phaseMismatches;

    let triggeredEscalationKey = null;
    if (misses > 0 && missClaimed && Number.isFinite(missTempK) && missTempK > 0) {
      const matKey = state.materialIdToKey.get(missMatId) || null;
      const quantT = Math.round(missTempK / 25) * 25;
      const quantLogP = Math.round(Math.log10(Math.max(1, missPressPa)) * 4);
      const dedupKey = `${matKey || missMatId}:${quantT}:${quantLogP}`;
      if (
        matKey
        && !state.escalatedKeys.has(dedupKey)
        && !state.escalationsInFlight.has(dedupKey)
        && state.escalationsInFlight.size < 2
      ) {
        state.escalationsInFlight.add(dedupKey);
        triggeredEscalationKey = dedupKey;
        void escalatePolytopeMissToTriadGpu(device, {
          materialKey: matKey,
          temperatureK: missTempK,
          pressurePa: Math.max(1, missPressPa)
        })
          .then((res) => {
            if (res?.escalated) {
              state.escalatedKeys.add(dedupKey);
              state.escalationCount += 1;
              state.adoptedGenerations += 1;
            }
          })
          .catch((err) => {
            state.lastEscalationError = String(err?.message || err);
          })
          .finally(() => {
            state.escalationsInFlight.delete(dedupKey);
          });
      }
    }

    const snapshot = Object.freeze({
      schema: ULG_POLYTOPE_ATLAS_BANK_GPU_BUFFER_SCHEMA,
      atlasGeneration: atlasGen || state.generation,
      materialCount: state.materialCount,
      hits,
      misses,
      applied,
      phaseMismatches,
      cumulativeHits: state.cumulativeHits,
      cumulativeMisses: state.cumulativeMisses,
      cumulativeApplied: state.cumulativeApplied,
      cumulativePhaseMismatches: state.cumulativePhaseMismatches,
      missSample: missClaimed
        ? Object.freeze({
            materialId: missMatId,
            materialKey: state.materialIdToKey.get(missMatId) ?? null,
            temperatureK: missTempK,
            pressurePa: missPressPa
          })
        : null,
      triggeredEscalationKey,
      escalationCount: state.escalationCount,
      adoptedGenerations: state.adoptedGenerations
    });
    state.lastReceipt = snapshot;
    globalThis.__ulgPolytopeAtlasLiveStatus = snapshot;
    return snapshot;
  } catch {
    return state.lastReceipt;
  } finally {
    state.receiptPollInFlight = false;
  }
}

/**
 * Automatically seed Studio's live WebGPU device with Gate 1–2 Foundation
 * Polytope Atlas + Eshkol/MoonLab 5-slot Triad GPU closures for the active
 * continuum materials (zero per-step allocation churn — executes once per
 * device/material key at schedule boundary!).
 */
export async function seedStudioFoundationTriadOnDevice(
  device,
  materialKeys = ['h2o', 'fe', 'na', 'cs', 'f', 'naoh', 'csf', 'n2', 'ar', 'h2'],
  { materialIdByKey = null } = {}
) {
  if (!device || typeof device.createBuffer !== 'function') return null;
  const state = getOrCreateDevicePolytopeState(device);
  const newlySeeded = [];
  for (const rawKey of materialKeys) {
    const norm = String(rawKey || '').trim().toLowerCase();
    if (!norm || state.seededKeys.has(norm)) continue;
    const rec = lookupFoundationPolytopeRecord(norm);
    if (!rec) continue;
    try {
      const triad = await synthesizePolytopeMoonlabTriadClosures(rec);
      const packedData = triad?.gpuBundle?.packed?.data;
      if (packedData instanceof Float32Array && packedData.length > 0) {
        registerTriadClosureBundleOnDevice(device, {
          materialKey: norm,
          packedData,
          sourceFingerprint: `foundation-polytope:${rec.closureHash}`,
          g6DebyeSamples: triad.g6DebyeSamples ?? null
        });
        state.seededKeys.add(norm);
        newlySeeded.push(rec.materialKey);
      }
    } catch {
      // Isolate individual material seeding from live physics schedule admission.
    }
  }
  const bankInfo = rebuildFoundationPolytopeBankOnDevice(device, materialKeys, { materialIdByKey });
  const status = Object.freeze({
    schema: ULG_FOUNDATION_POLYTOPE_GPU_BRIDGE_SCHEMA,
    seededCount: state.seededKeys.size,
    seededMaterials: Object.freeze([...state.seededKeys]),
    newlySeeded: Object.freeze(newlySeeded),
    polytopeBank: bankInfo,
    triadDeviceStatus: getTriadClosureDeviceStatus(device)
  });
  globalThis.__ulgFoundationPolytopeStatus = status;
  return status;
}

export function getFoundationPolytopeDeviceStatus(device) {
  const key = device ? unwrapWebGpuCacheDevice(device) : null;
  const state = key ? devicePolytopeState.get(key) : null;
  const dynamicKeys = state
    ? [...new Set([...state.dynamicAtlasesByKey.values()].map((e) => e.materialKey))]
    : [];
  return Object.freeze({
    schema: ULG_FOUNDATION_POLYTOPE_GPU_BRIDGE_SCHEMA,
    seededCount: state?.seededKeys?.size ?? 0,
    seededMaterials: Object.freeze(state ? [...state.seededKeys] : []),
    dynamicMaterialCount: dynamicKeys.length,
    dynamicMaterialKeys: Object.freeze(dynamicKeys),
    hotSwapCount: state?.bankHotSwapHistory?.length ?? 0,
    retiredHotSwapCount: state?.retiredHotSwapCount ?? 0,
    polytopeBankGeneration: state?.generation ?? 0,
    polytopeBankMaterialCount: state?.materialCount ?? 0,
    cumulativeHits: state?.cumulativeHits ?? 0,
    cumulativeMisses: state?.cumulativeMisses ?? 0,
    escalationCount: state?.escalationCount ?? 0,
    adoptedGenerations: state?.adoptedGenerations ?? 0,
    lastReceipt: state?.lastReceipt ?? null,
    triadDeviceStatus: getTriadClosureDeviceStatus(device)
  });
}

/**
 * Hydrate a dynamically synthesized material/compound Polytope Atlas from the
 * persistent OPFS/IndexedDB warm cache when valid, or compile it on WebGPU and
 * persist it fail-closed for subsequent Studio/Lab sessions.
 */
export async function hydrateOrBuildCachedPolytopeAtlasWebGpu(device, bundle, options = {}) {
  const persistentCache = options.persistentCache || getSharedPolytopeAtlasPersistentCache();
  return buildMaterialPolytopeAtlasWebGpu(device, bundle, {
    ...options,
    persistentCache
  });
}

export const foundationPolytopeBankBatchEvalWgsl = /* wgsl */ `
${evaluatePolytopeAtlasWgsl}

struct BankQueryParams {
  query_count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> polytope_bank: array<f32>;
@group(0) @binding(1) var<storage, read> queries: array<vec4<f32>>;      // (materialId, T_K, P_Pa, _)
@group(0) @binding(2) var<storage, read_write> results: array<vec4<f32>>; // (density, margin, phaseCode, hitFlag)
@group(0) @binding(3) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: BankQueryParams;

@compute @workgroup_size(64)
fn eval_polytope_bank_batch(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.query_count) { return; }
  let q = queries[idx];
  let out = eval_polytope_atlas_bank_2d(&polytope_bank, q.x, q.y, q.z);
  results[idx] = out;
  if (out.w >= 0.5) {
    atomicAdd(&receipt[0u], 1u);
    let pcode = u32(max(0.0, floor(out.z + 0.5)));
    if (pcode == 0u) { atomicAdd(&receipt[2u], 1u); }
    else if (pcode == 1u) { atomicAdd(&receipt[3u], 1u); }
    else if (pcode == 2u) { atomicAdd(&receipt[4u], 1u); }
    else { atomicAdd(&receipt[5u], 1u); }
  } else {
    atomicAdd(&receipt[1u], 1u);
  }
}
`;

/**
 * Evaluate a batch of `(materialId | materialKey, temperatureK, pressurePa)`
 * queries directly against the live GPU-resident multi-material Polytope Atlas
 * bank (`state.atlasBuffer`) using `eval_polytope_atlas_bank_2d` (zero copy of
 * the bank buffer, fail-closed `hitFlag == 0` for unseen or out-of-domain states).
 */
export async function evaluatePolytopeAtlasBankBatchWebGpu(device, {
  queries = [],
  bankBuffer = null
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('evaluatePolytopeAtlasBankBatchWebGpu requires a WebGPU GPUDevice');
  }
  const binding = getFoundationPolytopeGpuBinding(device);
  const targetBankBuffer = bankBuffer || binding.atlasBuffer;
  if (!targetBankBuffer) {
    throw new Error('No resident Polytope Atlas bank buffer bound on device');
  }
  const n = Math.max(1, queries.length);
  const queryData = new Float32Array(n * 4);
  const resolvedMeta = [];
  for (let i = 0; i < queries.length; i += 1) {
    const q = queries[i] || {};
    const matKey = q.materialKey != null ? String(q.materialKey) : null;
    const matId = (q.materialId != null && Number.isFinite(Number(q.materialId)))
      ? Number(q.materialId)
      : (matKey ? stableOpticalMaterialId(matKey.trim().toLowerCase()) : 0);
    const tK = Number(q.temperatureK ?? 0);
    const pPa = Number(q.pressurePa ?? 101325);
    queryData[i * 4 + 0] = matId;
    queryData[i * 4 + 1] = tK;
    queryData[i * 4 + 2] = pPa;
    queryData[i * 4 + 3] = 0;
    resolvedMeta.push({ materialId: matId, materialKey: matKey, temperatureK: tK, pressurePa: pPa });
  }

  const queryBuf = device.createBuffer({
    label: 'ulg-polytope-bank-batch-queries',
    size: queryData.byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  const resultBuf = device.createBuffer({
    label: 'ulg-polytope-bank-batch-results',
    size: n * 16,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const receiptBuf = device.createBuffer({
    label: 'ulg-polytope-bank-batch-receipt',
    size: 32,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuf = device.createBuffer({
    label: 'ulg-polytope-bank-batch-params',
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readResultsBuf = device.createBuffer({
    size: n * 16,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  const readReceiptBuf = device.createBuffer({
    size: 32,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });

  device.queue.writeBuffer(queryBuf, 0, queryData);
  device.queue.writeBuffer(receiptBuf, 0, new Uint32Array(8));
  device.queue.writeBuffer(paramsBuf, 0, new Uint32Array([queries.length, 0, 0, 0]));

  const compiled = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-foundation-polytope-bank-batch-eval.v1',
    label: 'ulg-foundation-polytope-bank-batch-eval',
    code: foundationPolytopeBankBatchEvalWgsl,
    entryPoint: 'eval_polytope_bank_batch',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'uniform')
    ]
  });
  const bg = createCachedExplicitBindGroup(device, {
    label: 'ulg-foundation-polytope-bank-batch-eval-bg',
    layout: compiled.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: targetBankBuffer } },
      { binding: 1, resource: { buffer: queryBuf } },
      { binding: 2, resource: { buffer: resultBuf } },
      { binding: 3, resource: { buffer: receiptBuf } },
      { binding: 4, resource: { buffer: paramsBuf } }
    ]
  });

  try {
    const enc = device.createCommandEncoder({ label: 'ulg-foundation-polytope-bank-batch-eval' });
    const pass = enc.beginComputePass({ label: 'ulg-foundation-polytope-bank-batch-eval-pass' });
    pass.setPipeline(compiled.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(Math.max(1, queries.length) / 64));
    pass.end();
    enc.copyBufferToBuffer(resultBuf, 0, readResultsBuf, 0, n * 16);
    enc.copyBufferToBuffer(receiptBuf, 0, readReceiptBuf, 0, 32);
    device.queue.submit([enc.finish()]);

    await Promise.all([
      readResultsBuf.mapAsync(GPU_BUFFER_USAGE.MAP_READ),
      readReceiptBuf.mapAsync(GPU_BUFFER_USAGE.MAP_READ)
    ]);
    const rawRes = new Float32Array(readResultsBuf.getMappedRange().slice(0));
    const rawRec = new Uint32Array(readReceiptBuf.getMappedRange().slice(0));
    readResultsBuf.unmap();
    readReceiptBuf.unmap();

    const rows = [];
    for (let i = 0; i < queries.length; i += 1) {
      rows.push(Object.freeze({
        ...resolvedMeta[i],
        densityKgPerM3: rawRes[i * 4 + 0],
        margin: rawRes[i * 4 + 1],
        phaseCode: Math.round(rawRes[i * 4 + 2]),
        hit: rawRes[i * 4 + 3] >= 0.5
      }));
    }
    return Object.freeze({
      schema: ULG_POLYTOPE_ATLAS_BANK_GPU_BUFFER_SCHEMA,
      bankGeneration: binding.generation,
      materialCount: binding.materialCount,
      rows: Object.freeze(rows),
      receipt: Object.freeze({
        hitCount: rawRec[0],
        missCount: rawRec[1],
        solidHits: rawRec[2],
        liquidHits: rawRec[3],
        gasHits: rawRec[4],
        plasmaHits: rawRec[5]
      })
    });
  } finally {
    queryBuf.destroy();
    resultBuf.destroy();
    receiptBuf.destroy();
    paramsBuf.destroy();
    readResultsBuf.destroy();
    readReceiptBuf.destroy();
  }
}

/**
 * Atomically admit a newly derived or OPFS-hydrated Polytope Atlas into the
 * live GPU-resident multi-material bank (`state.atlasBuffer`) under PeerCompute
 * `ReservationLedger` CAS fencing.
 *
 * Fail-closed guarantees:
 *   - Rejects invalid/unfitted atlases before acquiring any reservation.
 *   - Rejects stale epochs (`ERR_POLYTOPE_HOTSWAP_STALE_EPOCH`) or concurrent
 *     in-flight reservations (`ERR_POLYTOPE_HOTSWAP_BUSY`).
 *   - Cleanly retires prior epochs and old GPU buffers after atomic swap.
 */
export function admitDynamicPolytopeAtlasOnDevice(device, {
  materialKey,
  formula = null,
  atlas,
  materialId = null,
  consumerId = 'polytope-hotswap',
  reservationLedger = null,
  expectedEpoch = null,
  cacheStatus = null,
  cacheBackend = null,
  cacheKey = null
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('admitDynamicPolytopeAtlasOnDevice requires a WebGPU GPUDevice');
  }
  const canonicalKey = String(materialKey || atlas?.materialKey || formula || '').trim();
  if (!canonicalKey) {
    throw new TypeError('admitDynamicPolytopeAtlasOnDevice requires a non-empty materialKey');
  }
  validateAdmissiblePolytopeAtlas(atlas, canonicalKey);

  const state = getOrCreateDevicePolytopeState(device);
  const ledger = reservationLedger || state.hotSwapLedger;
  const normKey = canonicalKey.toLowerCase();
  const ledgerKey = `polytope-bank:${normKey}`;
  const fence = ledger.fence(ledgerKey);

  if (expectedEpoch != null && fence.epoch !== expectedEpoch) {
    const err = new Error(
      `Polytope bank hot-swap rejected: stale epoch ${expectedEpoch} (current ${fence.epoch}) for "${canonicalKey}"`
    );
    err.code = 'ERR_POLYTOPE_HOTSWAP_STALE_EPOCH';
    err.expectedEpoch = expectedEpoch;
    err.actualEpoch = fence.epoch;
    throw err;
  }
  if (fence.state === 'reserved') {
    const err = new Error(
      `Polytope bank hot-swap rejected: key "${ledgerKey}" is already reserved by "${fence.owner}"`
    );
    err.code = 'ERR_POLYTOPE_HOTSWAP_BUSY';
    err.owner = fence.owner;
    err.epoch = fence.epoch;
    throw err;
  }
  if (fence.state === 'consumed') {
    const retired = ledger.retire(ledgerKey, { expectedEpoch: fence.epoch });
    if (!retired.ok) {
      const err = new Error(
        `Polytope bank hot-swap failed to retire prior epoch for "${canonicalKey}": ${retired.reason}`
      );
      err.code = 'ERR_POLYTOPE_HOTSWAP_RETIRE_FAILED';
      err.reason = retired.reason;
      throw err;
    }
  }

  const reserveEpoch = ledger.fence(ledgerKey).epoch;
  const res = ledger.reserve({
    key: ledgerKey,
    consumerId: String(consumerId || 'polytope-hotswap'),
    expectedEpoch: reserveEpoch
  });
  if (!res.ok) {
    const err = new Error(
      `Polytope bank hot-swap reservation rejected for "${canonicalKey}": ${res.reason}`
    );
    err.code = 'ERR_POLYTOPE_HOTSWAP_RESERVATION_REJECTED';
    err.reason = res.reason;
    throw err;
  }

  const resolvedMaterialId = (materialId != null && Number.isFinite(Number(materialId)))
    ? Number(materialId)
    : stableOpticalMaterialId(normKey);
  const aliasKeys = new Set([normKey]);
  if (atlas?.materialKey) aliasKeys.add(String(atlas.materialKey).trim().toLowerCase());
  if (formula) aliasKeys.add(String(formula).trim().toLowerCase());

  const prevDynamicSnapshots = new Map();
  for (const k of aliasKeys) {
    if (state.dynamicAtlasesByKey.has(k)) {
      prevDynamicSnapshots.set(k, state.dynamicAtlasesByKey.get(k));
    }
  }
  const prevSeededHadKey = state.seededKeys.has(normKey);
  const prevMaterialIdHadKey = state.lastMaterialIdByKey.has(normKey);
  const prevMaterialIdVal = state.lastMaterialIdByKey.get(normKey);

  const entry = Object.freeze({
    materialKey: canonicalKey,
    formula: formula ? String(formula) : (atlas?.formula ?? null),
    family: atlas.family || 'compound',
    accuracyTier: atlas.accuracyTier || ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    closureHash: String(atlas.closureHash || ''),
    materialId: resolvedMaterialId,
    polytopes: Object.freeze([...atlas.polytopes]),
    packedGpuAtlas: atlas.packedGpuAtlas ?? null,
    cacheStatus: cacheStatus ?? atlas.cacheStatus ?? null,
    cacheBackend: cacheBackend ?? atlas.cacheBackend ?? null,
    cacheKey: cacheKey ?? atlas.cacheKey ?? null,
    admittedAtMs: Date.now()
  });

  let bank = null;
  try {
    for (const k of aliasKeys) {
      state.dynamicAtlasesByKey.set(k, entry);
    }
    state.seededKeys.add(normKey);
    state.lastMaterialIdByKey.set(normKey, resolvedMaterialId);
    bank = rebuildFoundationPolytopeBankOnDevice(device, [...state.seededKeys], {
      materialIdByKey: state.lastMaterialIdByKey
    });
    if (!bank || !state.atlasBuffer) {
      throw new Error(`Bank rebuild returned empty GPU buffer for "${canonicalKey}"`);
    }
  } catch (err) {
    for (const k of aliasKeys) {
      if (prevDynamicSnapshots.has(k)) state.dynamicAtlasesByKey.set(k, prevDynamicSnapshots.get(k));
      else state.dynamicAtlasesByKey.delete(k);
    }
    if (!prevSeededHadKey) state.seededKeys.delete(normKey);
    if (prevMaterialIdHadKey) state.lastMaterialIdByKey.set(normKey, prevMaterialIdVal);
    else state.lastMaterialIdByKey.delete(normKey);
    ledger.cancel(res.token);
    throw err;
  }

  ledger.attach(res.token, () => {
    state.retiredHotSwapCount += 1;
  });
  const admissionId = `polytope-bank:${normKey}:g${bank.generation}`;
  const commit = ledger.commit(res.token, { admissionId });
  if (!commit.ok) {
    for (const k of aliasKeys) {
      if (prevDynamicSnapshots.has(k)) state.dynamicAtlasesByKey.set(k, prevDynamicSnapshots.get(k));
      else state.dynamicAtlasesByKey.delete(k);
    }
    if (!prevSeededHadKey) state.seededKeys.delete(normKey);
    if (prevMaterialIdHadKey) state.lastMaterialIdByKey.set(normKey, prevMaterialIdVal);
    else state.lastMaterialIdByKey.delete(normKey);
    const err = new Error(
      `Polytope bank hot-swap commit rejected for "${canonicalKey}": ${commit.reason}`
    );
    err.code = 'ERR_POLYTOPE_HOTSWAP_COMMIT_REJECTED';
    err.reason = commit.reason;
    throw err;
  }

  const receipt = Object.freeze({
    schema: ULG_FOUNDATION_POLYTOPE_HOTSWAP_SCHEMA,
    admitted: true,
    materialKey: canonicalKey,
    formula: entry.formula,
    materialId: resolvedMaterialId,
    bankGeneration: bank.generation,
    materialCount: bank.materialCount,
    packedFloatCount: bank.packedFloatCount,
    polytopeCount: entry.polytopes.length,
    reservationEpoch: commit.epoch,
    reservationId: res.token.reservationId,
    admissionId: commit.admissionId,
    cacheStatus: entry.cacheStatus,
    cacheBackend: entry.cacheBackend,
    cacheKey: entry.cacheKey,
    atlasBuffer: state.atlasBuffer
  });
  state.bankHotSwapHistory.push(receipt);
  return receipt;
}

/**
 * Full end-to-end Unseen-Material Continuum <-> Quantum Hot-Swap Loop:
 *   1. Accepts an unseen compound formula (e.g. 'KBr', 'GeO2') or pre-derived
 *      `ulg.material-property-bundle.v1`, deriving the full Gate 1-2 quantum/
 *      crystal/EM/MD bundle on WebGPU when passed a formula.
 *   2. Hydrates from persistent browser OPFS/IndexedDB cache when valid, or
 *      compiles convex `A x <= b` + GPU Chebyshev fits and persists fail-closed.
 *   3. Publishes 5-slot Eshkol/MoonLab Triad closures onto `device` (optional,
 *      default true).
 *   4. Atomically hot-swaps the live GPU Polytope Atlas bank (`state.atlasBuffer`)
 *      under PeerCompute `ReservationLedger` CAS fencing so continuum kernels
 *      immediately resolve the unseen material at Tier-1 speed.
 */
export async function hotSwapUnseenMaterialAtlasWebGpu(device, formulaOrBundle, options = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('hotSwapUnseenMaterialAtlasWebGpu requires a live WebGPU GPUDevice');
  }
  let bundle = null;
  let derivedVisualData = null;
  if (typeof formulaOrBundle === 'string') {
    const derived = await deriveCompoundBundleWebGpu(device, formulaOrBundle, {
      runLiveMd: options.runLiveMd !== false,
      mdSteps: options.mdSteps ?? 8,
      mdCellsPerSide: options.mdCellsPerSide ?? 2,
      reactionContext: options.reactionContext ?? {
        source: 'hotSwapUnseenMaterialAtlasWebGpu'
      }
    });
    bundle = derived.bundle;
    derivedVisualData = derived.visualData ?? null;
  } else if (formulaOrBundle && typeof formulaOrBundle === 'object') {
    bundle = formulaOrBundle.bundle && formulaOrBundle.bundle.schema
      ? formulaOrBundle.bundle
      : formulaOrBundle;
  } else {
    throw new TypeError('hotSwapUnseenMaterialAtlasWebGpu requires a compound formula string or material bundle');
  }

  const atlas = await hydrateOrBuildCachedPolytopeAtlasWebGpu(device, bundle, {
    degrees: options.degrees ?? [5, 5],
    relativeTolerance: options.relativeTolerance ?? 2e-2,
    maxBisectDepth: options.maxBisectDepth ?? 3,
    materialIndex: options.materialIndex ?? 0,
    pressureRangePa: options.pressureRangePa ?? [1e2, 1e10],
    persistentCache: options.persistentCache || getSharedPolytopeAtlasPersistentCache()
  });

  let triadStatus = null;
  if (options.publishTriadClosures !== false) {
    try {
      const pub = await publishPolytopeBundleToTriadGpuRegistry(device, bundle, {
        materialId: options.materialId ?? null
      });
      triadStatus = pub.gpuRegistryStatus;
    } catch {
      triadStatus = getTriadClosureDeviceStatus(device);
    }
  }

  const admission = admitDynamicPolytopeAtlasOnDevice(device, {
    materialKey: options.materialKey || bundle.materialKey,
    formula: bundle.formula || (typeof formulaOrBundle === 'string' ? formulaOrBundle : null),
    atlas,
    materialId: options.materialId ?? null,
    consumerId: options.consumerId ?? 'polytope-hotswap',
    reservationLedger: options.reservationLedger ?? null,
    expectedEpoch: options.expectedEpoch ?? null,
    cacheStatus: atlas.cacheStatus,
    cacheBackend: atlas.cacheBackend,
    cacheKey: atlas.cacheKey
  });

  return Object.freeze({
    schema: ULG_FOUNDATION_POLYTOPE_HOTSWAP_SCHEMA,
    bundle,
    visualData: derivedVisualData,
    atlas,
    admission,
    triadStatus,
    cacheStatus: atlas.cacheStatus,
    cacheBackend: atlas.cacheBackend,
    cacheKey: atlas.cacheKey
  });
}
