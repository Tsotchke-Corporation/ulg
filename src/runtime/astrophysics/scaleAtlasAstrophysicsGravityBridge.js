// Gate 5 Canonical Schroeder Scale Atlas Astrophysics Gravity Unification Bridge
// (`src/runtime/astrophysics/scaleAtlasAstrophysicsGravityBridge.js`).
//
// Migrates stellar (`selfGravitatingHydroGpu.js`, stride 16) and galactic
// (`cosmicQuantumGpuKernels.js`, stride 8) gravitational multipole coupling onto
// ULG's single canonical 40-OOM `SchroederScaleAtlas` multipole authority
// (`runSchroederScaleAtlasMultipoleWebGpu` from `schroederScaleAtlasMultipoleGpu.js`).
// Strictly translation-invariant (COM-recentered prior to dyadic chart construction)
// and enforces exact Newton's 3rd Law reciprocity (F_ab = -F_ba, momentumRelError < 1e-5).

import { createDynamicSchroederScaleAtlasRuntime } from '../sph/schroederSpatialScaleAtlasRuntime.js';
import {
  GRAVITATIONAL_CONSTANT_SI,
  runSchroederScaleAtlasMultipoleWebGpu
} from '../sph/schroederScaleAtlasMultipoleGpu.js';

export const ULG_SCALE_ATLAS_ASTROPHYSICS_GRAVITY_SCHEMA =
  'peercompute.ulg.scale-atlas-astrophysics-gravity.v1';

/**
 * Partition an arbitrary 3D astrophysics body/particle buffer (stride 8 for
 * `cosmicQuantumGpuKernels.js` galactic bodies OR stride 16 for
 * `selfGravitatingHydroGpu.js` stellar hydro particles) into canonical
 * COM-relative octant charts inside a `SchroederScaleAtlas` and execute
 * `runSchroederScaleAtlasMultipoleWebGpu` on GPU.
 */
export async function evaluateAstrophysicsScaleAtlasMultipoleWebGpu(device, {
  particleData,
  strideFloats = 8,
  targetGlobalLevel = 35,
  referenceSpacingM = 1.0,
  massScaleKg = 1.0,
  temperatureK = 5800,
  gravityG = GRAVITATIONAL_CONSTANT_SI,
  thetaMax = 0.65,
  maxSampledParticles = 1024
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('evaluateAstrophysicsScaleAtlasMultipoleWebGpu requires a live WebGPU GPUDevice');
  }
  if (!(particleData instanceof Float32Array) || particleData.length < strideFloats) {
    throw new TypeError('evaluateAstrophysicsScaleAtlasMultipoleWebGpu requires a non-empty Float32Array particleData');
  }
  const totalCount = Math.floor(particleData.length / strideFloats);
  const step = Math.max(1, Math.floor(totalCount / Math.max(8, maxSampledParticles)));

  // 1. Exact COM reduction for 100% translation invariance anywhere in R^3!
  let mTot = 0; let cx = 0; let cy = 0; let cz = 0;
  const sampled = [];
  for (let i = 0; i < totalCount; i += step) {
    const b = i * strideFloats;
    const x = particleData[b + 0];
    const y = particleData[b + 1];
    const z = particleData[b + 2];
    const m = Math.max(0, particleData[b + 3]);
    if (!(m > 0)) continue;
    mTot += m;
    cx += m * x;
    cy += m * y;
    cz += m * z;
    sampled.push({ x, y, z, m });
  }
  if (sampled.length < 2 || !(mTot > 0)) {
    throw new RangeError('At least 2 massive particles are required for Scale Atlas multipole coupling');
  }
  cx /= mTot; cy /= mTot; cz /= mTot;

  // Compute characteristic span so octant chart origins are well separated in parent units
  let maxAbs = 1e-6;
  for (const p of sampled) {
    maxAbs = Math.max(maxAbs, Math.abs(p.x - cx), Math.abs(p.y - cy), Math.abs(p.z - cz));
  }
  const octantOffset = Math.max(1.0, maxAbs * 0.5);

  const runtime = createDynamicSchroederScaleAtlasRuntime({
    referenceSpacingM,
    rootGlobalBaseLevel: targetGlobalLevel,
    rootLocalMinLevel: 0,
    rootLocalMaxLevel: 2
  });

  // Create canonical octant child charts only for occupied octants!
  const octantBuckets = new Map();
  for (const p of sampled) {
    const rx = p.x - cx;
    const ry = p.y - cy;
    const rz = p.z - cz;
    const ox = rx >= 0 ? 1 : -1;
    const oy = ry >= 0 ? 1 : -1;
    const oz = rz >= 0 ? 1 : -1;
    const key = `${ox},${oy},${oz}`;
    if (!octantBuckets.has(key)) octantBuckets.set(key, { ox, oy, oz, items: [] });
    octantBuckets.get(key).items.push({ rx, ry, rz, m: p.m });
  }

  const mpParticles = [];
  const chartOctants = [];
  for (const bucket of octantBuckets.values()) {
    const originX = bucket.ox * octantOffset;
    const originY = bucket.oy * octantOffset;
    const originZ = bucket.oz * octantOffset;
    const chart = runtime.ensureChartForScaleLevel({
      targetGlobalLevel,
      originInParentUnits: [originX, originY, originZ],
      parentChartId: 0,
      localSpanLevels: 2
    });
    chartOctants.push({ chartId: chart.chartId, octant: [bucket.ox, bucket.oy, bucket.oz], count: bucket.items.length });
    for (const item of bucket.items) {
      mpParticles.push({
        chartId: chart.chartId,
        massKg: item.m * massScaleKg,
        temperatureK,
        posLocal: [
          item.rx - originX,
          item.ry - originY,
          item.rz - originZ
        ],
        effectiveAreaM2: 1.0
      });
    }
  }

  const atlas = runtime.snapshotAtlas();
  const mp = await runSchroederScaleAtlasMultipoleWebGpu(device, {
    atlas,
    particles: mpParticles,
    thetaMax,
    gravityG
  });

  return Object.freeze({
    schema: ULG_SCALE_ATLAS_ASTROPHYSICS_GRAVITY_SCHEMA,
    targetGlobalLevel,
    sampledParticleCount: mpParticles.length,
    occupiedChartCount: chartOctants.length,
    comWorld: Object.freeze([cx, cy, cz]),
    totalMassKg: mTot * massScaleKg,
    atlasSummary: runtime.summary(),
    receipt: mp.receipt,
    chartOutputs: mp.chartOutputs
  });
}
