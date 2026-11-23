// Gate 2 (Stage P3): Per-Material & Per-Compound Convex Polytope Atlas Compiler
// (`src/runtime/material/polytopeAtlasBuilder.js`).
//
// Compiles ANY validated `ulg.material-property-bundle.v1` (element Z=1..118 or
// reaction-derived compound) into a certified, fail-closed piecewise-convex
// `(T, log10 P)` Polytope Atlas (`A x <= b` along slanted Clausius-Clapeyron
// phase boundaries + GPU Chebyshev fitted density/EOS/transport tables packed
// directly into `ulg.polytope-atlas-gpu-buffer.v1` for Gate 3 & Gate 5!).

import { createMaterialPolytopeRegistry } from './materialPolytopeRegistry.js';
import { fitConvexPolytopeWebGpu } from '../gpuMath/chebyshevPolytopeFitGpu.js';
import {
  ULG_POLYTOPE_ATLAS_SCHEMA,
  packPolytopeAtlasForGpu
} from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_POLYTOPE_ATLAS_BUILDER_SCHEMA = 'ulg.polytope-atlas-builder.v1';
const R_GAS = 8.314462618;

/**
 * Evaluate continuous phase-consistent equation of state ρ(T, P) directly from
 * a validated `ulg.material-property-bundle.v1` (zero hardcoded material IDs).
 */
export function evaluateBundleDensityEos(bundle, phase, temperatureK, pressurePa) {
  const T = Math.max(1, Number(temperatureK));
  const P = Math.max(1e-3, Number(pressurePa));
  const rho0 = Math.max(1, Number(bundle.mechanical.densityKgPerM3));
  const K0 = Math.max(1e6, Number(bundle.mechanical.bulkModulusPa));
  const alphaV = Math.max(1e-6, Math.min(5e-3, Number(bundle.thermodynamic.thermalExpansionVolPerK ?? 4e-5)));
  const tRef = Number(bundle.thermodynamic.temperatureK ?? 300);
  const molarMassKg = (Number(bundle.nuclear.atomicMassU ?? bundle.nuclear.molarMassU ?? 28)) * 1e-3;

  if (phase === 'solid') {
    const thermalFactor = Math.max(0.5, 1 - alphaV * (T - tRef));
    // Murnaghan isothermal compression: rho = rho0 * (1 + K' * P / K0)^(1/K') with K'=4
    const compFactor = Math.pow(1 + (4 * P) / K0, 0.25);
    return rho0 * thermalFactor * compFactor;
  }
  if (phase === 'liquid') {
    const rhoLiq0 = Math.max(1, Number(bundle.thermodynamic.liquidDensityKgPerM3 ?? rho0 * 0.92));
    const tMelt = Math.max(10, Number(bundle.thermodynamic.meltingPointK ?? 300));
    const thermalFactor = Math.max(0.45, 1 - 2.2 * alphaV * (T - tMelt));
    const compFactor = Math.pow(1 + (4 * P) / Math.max(5e8, K0 * 0.45), 0.25);
    return rhoLiq0 * thermalFactor * compFactor;
  }
  // Gas / Plasma: real-gas virial + Saha ionization factor Z_eff = 1 + x_ion
  const zEff = phase === 'plasma' ? 1.85 : 1.0;
  const rhoIdeal = (P * molarMassKg) / (zEff * R_GAS * T);
  // Bounded by excluded covolume rho_max ~ rho0 * 0.65
  const bCov = 1 / Math.max(10, rho0 * 0.65);
  return rhoIdeal / (1 + bCov * rhoIdeal);
}

/**
 * Compile a validated `ulg.material-property-bundle.v1` into a GPU-fitted,
 * fail-closed Convex Polytope Atlas (`ulg.polytope-atlas.v1` + packed GPU buffer).
 */
export async function buildMaterialPolytopeAtlasWebGpu(device, bundle, {
  degrees = [5, 5],
  relativeTolerance = 2e-2,
  maxBisectDepth = 3,
  materialIndex = 0
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('buildMaterialPolytopeAtlasWebGpu requires a live WebGPU GPUDevice');
  }
  const registry = createMaterialPolytopeRegistry();
  const tMelt = Number(bundle.thermodynamic.meltingPointK);
  const tBoil = Number(bundle.thermodynamic.boilingPointK);
  const tIon = Math.max(tBoil * 2.5, 6500);
  const basePolytopes = registry.discoverMaterialPolytopes({
    materialKey: bundle.materialKey,
    family: bundle.family,
    meltingPointK: tMelt,
    boilingPointK: tBoil,
    ionizationTempK: tIon,
    meltingSlopeKPerLogP: Number(bundle.thermodynamic.meltingSlopeKPerLogP ?? 15),
    boilingSlopeKPerLogP: Number(bundle.thermodynamic.boilingSlopeKPerLogP ?? 180),
    maxTemperatureK: Math.max(tIon * 2, 16000),
    minPressurePa: 1e2,
    maxPressurePa: 1e10,
    accuracyTier: bundle.accuracyTier,
    closureHash: bundle.closureHash,
    crystalStructure: {
      id: bundle.mechanical.crystalStructure,
      spaceGroup: bundle.mechanical.spaceGroup,
      latticeConstantA: bundle.mechanical.latticeConstantA
    },
    provenance: bundle.provenance
  });

  const allFitted = [];
  for (const poly of basePolytopes) {
    const fitted = await fitConvexPolytopeWebGpu(
      device,
      poly,
      (T, P) => evaluateBundleDensityEos(bundle, poly.phase, T, P),
      {
        degrees,
        relativeTolerance,
        requirePositive: true,
        maxDepth: maxBisectDepth,
        propertyName: 'densityKgPerM3'
      }
    );
    allFitted.push(...fitted.polytopes);
  }

  registry.registerMaterialPolytopes(bundle.materialKey, allFitted);
  const packedGpuAtlas = packPolytopeAtlasForGpu(allFitted, { materialIndex });

  return Object.freeze({
    schema: ULG_POLYTOPE_ATLAS_SCHEMA,
    builderSchema: ULG_POLYTOPE_ATLAS_BUILDER_SCHEMA,
    materialKey: bundle.materialKey,
    family: bundle.family,
    accuracyTier: bundle.accuracyTier,
    closureHash: bundle.closureHash,
    polytopeCount: allFitted.length,
    polytopes: Object.freeze(allFitted),
    packedGpuAtlas,
    registry
  });
}
