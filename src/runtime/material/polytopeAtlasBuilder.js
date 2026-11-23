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
  defineLawObject,
  differentiateLaw,
  approximateLaw,
  compileLawToWgsl,
  LAW_FALLBACK_POLICY
} from './eshkolHigherOrderLawCompiler.js';
import { synthesizeMoonlabFirstPrinciplesClosures } from './moonlabColdMissSynthesis.js';
import { registerTriadClosureBundleOnDevice } from './triadClosureGpuRegistry.js';
import {
  ULG_POLYTOPE_ATLAS_SCHEMA,
  packPolytopeAtlasForGpu
} from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_POLYTOPE_ATLAS_BUILDER_SCHEMA = 'ulg.polytope-atlas-builder.v1';
const R_GAS = 8.314462618;

/**
 * Compile Eshkol Higher-Order Law objects, AD partial derivatives, Chebyshev
 * tensor approximations, and fail-closed WGSL envelope-watch evaluators directly
 * from ANY validated Gate 1-2 `ulg.material-property-bundle.v1`.
 */
export function compilePolytopeEshkolHigherOrderLaws(bundle, {
  phase = 'solid',
  temperatureRangeK = null,
  log10PressureRange = [2, 8],
  degrees = [6, 8],
  relativeTolerance = 2e-2
} = {}) {
  const tMelt = Math.max(15, Number(bundle.thermodynamic.meltingPointK ?? 300));
  const tBoil = Math.max(tMelt + 20, Number(bundle.thermodynamic.boilingPointK ?? 1000));
  const tRange = temperatureRangeK || (
    phase === 'solid'
      ? [Math.max(10, tMelt * 0.15), Math.max(20, tMelt * 0.95)]
      : (phase === 'liquid'
        ? [tMelt * 1.02, Math.max(tMelt * 1.15, tBoil * 0.96)]
        : [tBoil * 1.05, Math.max(tBoil * 2.0, 4000)])
  );
  const safeId = String(bundle.materialKey || 'mat').replace(/[^a-zA-Z0-9_-]/g, '_');
  const buildForLogPRange = (lo, hi, suffix = '') => {
    const law = defineLawObject({
      id: `ulg:polytope-eos:${safeId}:${phase}${suffix}`,
      inputs: [
        { name: 'temperatureK', unit: 'K', referenceValue: 0.5 * (tRange[0] + tRange[1]) },
        { name: 'log10PressurePa', unit: 'log10(Pa)', referenceValue: 0.5 * (lo + hi) }
      ],
      output: { name: 'densityKgPerM3', unit: 'kg/m^3' },
      parameters: {
        materialKey: bundle.materialKey,
        phase,
        closureHash: bundle.closureHash
      },
      stateContract: {
        reads: ['temperatureK', 'pressurePa'],
        writes: ['densityKgPerM3'],
        accumulates: []
      },
      conservationInvariants: ['positivity:density>0', 'thermodynamic-stability:dRho/dP>=0'],
      envelope: {
        temperatureRangeK: tRange,
        pressureRangePa: [10 ** lo, 10 ** hi],
        phase,
        ranges: {
          temperatureK: tRange,
          log10PressurePa: [lo, hi]
        }
      },
      fallbackPolicy: LAW_FALLBACK_POLICY.ASYNC,
      sourceMethod: `eshkol-higher-order-polytope-eos(${bundle.accuracyTier})`,
      eshkolBody: `(lambda (T log10P) (polytope-eos "${bundle.materialKey}" '${phase} T (expt 10 log10P)))`,
      evaluate: ({ temperatureK, log10PressurePa }) =>
        evaluateBundleDensityEos(bundle, phase, temperatureK, 10 ** log10PressurePa)
    });
    const approx = approximateLaw(law, {
      representation: 'chebyshev',
      degrees,
      relativeTolerance,
      composition: { [bundle.materialKey]: 1.0 }
    });
    return { law, approx, lo, hi };
  };

  // Adaptive convex-polytope bisection along log10(P): soft van-der-Waals
  // solids (e.g. solid He, K_0 ~ 50 MPa) curve sharply near P ~ K_0; bisecting
  // the pressure polytope preserves the exact declared relativeTolerance with
  // zero tolerance relaxation.
  const subFits = [];
  const fitRangeRecursive = (lo, hi, depth = 0, tag = '') => {
    try {
      subFits.push(buildForLogPRange(lo, hi, tag));
    } catch (err) {
      if (depth >= 4 || (hi - lo) < 0.25) throw err;
      const mid = 0.5 * (lo + hi);
      fitRangeRecursive(lo, mid, depth + 1, `${tag}L`);
      fitRangeRecursive(mid, hi, depth + 1, `${tag}H`);
    }
  };
  fitRangeRecursive(log10PressureRange[0], log10PressureRange[1], 0, '');
  // Pick the sub-polytope containing ambient 1 atm (log10P = 5.0057) as primary
  const primaryFit = subFits.find((f) => f.lo <= 5.01 && f.hi >= 5.0) || subFits[0];
  const densityLaw = primaryFit.law;
  const approxDensity = primaryFit.approx;

  const thermalExpTangent = differentiateLaw(densityLaw, {
    id: `ulg:polytope-eos:${safeId}:${phase}:dRho_dT`,
    axis: 'temperatureK'
  });
  const compressibilityTangent = differentiateLaw(densityLaw, {
    id: `ulg:polytope-eos:${safeId}:${phase}:dRho_dLogP`,
    axis: 'log10PressurePa'
  });
  const compiledWgsl = compileLawToWgsl(approxDensity, {
    fnPrefix: `eshkol_${safeId}_${phase}`.slice(0, 36)
  });

  return Object.freeze({
    schema: 'ulg.eshkol.polytope-higher-order-laws.v1',
    materialKey: bundle.materialKey,
    phase,
    densityLaw,
    thermalExpTangent,
    compressibilityTangent,
    approximatedDensity: approxDensity,
    subPolytopeCount: subFits.length,
    subPolytopes: Object.freeze(subFits.map((f) => Object.freeze({
      log10PressureRange: [f.lo, f.hi],
      surrogateRelativeBound: f.approx.errorBudget.surrogateRelativeBound
    }))),
    compiledWgsl,
    surrogateRelativeBound: Math.max(...subFits.map((f) => f.approx.errorBudget.surrogateRelativeBound))
  });
}

/**
 * Feed Gate 1-2 first-principles quantum/crystal observables into MoonLab +
 * Eshkol Triad synthesis (`synthesizeMoonlabFirstPrinciplesClosures`) to produce
 * certified 5-slot GPU A4 Helmholtz/Hyperelastic/Transport closures + Debye G6
 * caloric curves directly consumable by Gate 3 ULG Studio!
 */
export async function synthesizePolytopeMoonlabTriadClosures(bundle, {
  eshkolSample = null,
  quantumProbeReceipt = null,
  temperatureRangeK = null
} = {}) {
  const molarMassU = Math.max(1.0, Number(bundle.nuclear.atomicMassU ?? bundle.nuclear.molarMassU ?? 28));
  const atomsPerFormula = Math.max(1, Number(bundle.nuclear.atomsPerFormula ?? 1));
  const cohesiveEnergyEvPerAtom = Math.max(0.05, Number(bundle.mechanical.cohesiveEnergyEv ?? 1.0) / atomsPerFormula);
  const debyeTemperatureK = Math.max(30, Number(bundle.mechanical.debyeTempK ?? 250));
  const latticeA = Math.max(1.5, Number(bundle.mechanical.latticeConstantA ?? 3.8));
  const molecularDiameterM = Math.max(1.5e-10, latticeA * 0.72 * 1e-10);
  const refDensityKgPerM3 = Math.max(50, Number(bundle.mechanical.densityKgPerM3 ?? 1000));
  const meltTemperatureK = Math.max(20, Number(bundle.thermodynamic.meltingPointK ?? 300));
  const tLo = Math.max(15, Math.min(240, meltTemperatureK * 0.4));
  const tHi = Math.max(tLo + 80, Math.min(2400, meltTemperatureK * 1.4));

  return synthesizeMoonlabFirstPrinciplesClosures({
    material: bundle.materialKey,
    molarMassKgPerMol: molarMassU * 1e-3,
    atomsPerFormula,
    cohesiveEnergyEvPerAtom,
    debyeTemperatureK,
    molecularDiameterM,
    refDensityKgPerM3,
    meltTemperatureK,
    temperatureRangeK: temperatureRangeK || [tLo, tHi],
    eshkolSample,
    quantumProbeReceipt: quantumProbeReceipt || {
      fingerprint: bundle.closureHash,
      accuracyTier: bundle.accuracyTier
    }
  });
}

/**
 * Bridge Gate 1-2 directly into Gate 3 Studio Continuum: synthesize MoonLab +
 * Eshkol 5-slot GPU A4 closures from a validated material bundle and register
 * them into `triadClosureGpuRegistry` on the live WebGPU device!
 */
export async function publishPolytopeBundleToTriadGpuRegistry(device, bundle, options = {}) {
  const triad = await synthesizePolytopeMoonlabTriadClosures(bundle, options);
  const status = registerTriadClosureBundleOnDevice(device, {
    materialKey: bundle.materialKey,
    materialId: options.materialId ?? null,
    packedData: triad.gpuBundle.packed.data,
    sourceFingerprint: triad.provenanceFingerprint,
    g6DebyeSamples: triad.g6DebyeSamples
  });
  return Object.freeze({
    materialKey: bundle.materialKey,
    triad,
    gpuRegistryStatus: status
  });
}

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
    // Exact thermodynamic integral of volumetric thermal expansion alpha_V = -(1/rho)(d rho / dT)_P:
    // rho(T, P) = rho0 * exp(-alpha_V * (T - T_ref_solid)) * (1 + K' * P / K0)^(1/K')
    // Strictly positive, C^infinity smooth (no artificial clamp kink), and strictly monotone (d rho / dT < 0).
    const tMelt = Math.max(10, Number(bundle.thermodynamic.meltingPointK ?? 300));
    const tRefSolid = Math.min(tRef, 0.5 * tMelt);
    const alphaEff = Math.min(alphaV, 0.45 / Math.max(10, tMelt));
    const thermalFactor = Math.exp(-alphaEff * (T - tRefSolid));
    // Murnaghan isothermal compression: rho = rho0 * (1 + K' * P / K0)^(1/K') with K'=4
    const compFactor = Math.pow(1 + (4 * P) / K0, 0.25);
    return rho0 * thermalFactor * compFactor;
  }
  if (phase === 'liquid') {
    const rhoLiq0 = Math.max(1, Number(bundle.thermodynamic.liquidDensityKgPerM3 ?? rho0 * 0.92));
    const tMelt = Math.max(10, Number(bundle.thermodynamic.meltingPointK ?? 300));
    const tBoil = Math.max(tMelt + 20, Number(bundle.thermodynamic.boilingPointK ?? tMelt * 1.5));
    const alphaLiq = Math.min(2.2 * alphaV, 0.5 / Math.max(20, tBoil - tMelt));
    const thermalFactor = Math.exp(-alphaLiq * (T - tMelt));
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
