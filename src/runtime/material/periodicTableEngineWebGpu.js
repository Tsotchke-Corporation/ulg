// Gate 1 (Stage P1.5): Unified Z = 1..118 First-Principles Periodic Table
// Material Engine (`src/runtime/material/periodicTableEngineWebGpu.js`).
//
// Executes the complete bottom-up GPU derivation chain for ANY element Z=1..118:
//   P1.1 Nuclear (`solveNuclearStructureWebGpu` -> finite R_nuc, B(Z,A), spin/decay)
//   P1.2 Relativistic Finite-Nucleus Atomic QM (`solveAtomFullWebGpu` -> 0 readbacks/SCF)
//   P1.3 GPU Periodic Bulk Solid DFT + EM/Magnetism/Optics (`solveBulkCrystalWebGpu` + `deriveElectromagneticClosureWebGpu`)
//   P1.4 Statistical Mechanics, Phonons & Live WebGPU MD (`deriveElementThermodynamicsWebGpu`)
// Emits a validated `ulg.material-property-bundle.v1` + offline G7 advisory
// comparison scorecard (never a runtime blocker).

import {
  ELEMENT_SYMBOLS,
  configurationString,
  electronConfiguration,
  spinElectronConfiguration,
  symbolForZ,
  unpairedElectronCount
} from '../electronicStructure/periodicTable.js';
import { deriveNuclearClosure, solveNuclearStructureWebGpu } from '../nuclear/nuclearStructureGpu.js';
import { solveAtomFullWebGpu } from '../electronicStructure/radialKohnShamWebGpu.js';
import { solveBulkCrystalWebGpu } from '../electronicStructure/periodicBulkDftWebGpu.js';
import { deriveElectromagneticClosureWebGpu } from './electromagneticClosureWebGpu.js';
import { deriveElementThermodynamicsWebGpu } from './elementMdClosureWebGpu.js';
import {
  ULG_ACCURACY_TIERS,
  createMaterialPropertyBundle
} from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_PERIODIC_TABLE_ENGINE_FINGERPRINT = 'ulg-periodic-table-engine-webgpu.v1';

// Offline advisory G7 reference benchmarks (NIST / CODATA / AME2020 / CRC).
// NEVER used inside any solver! Used solely for honest post-derivation reporting.
export const G7_ADVISORY_ELEMENT_BENCHMARKS = Object.freeze({
  1:  { symbol: 'H',  bPerAMeV: 0.0,    rhoKgM3: 88,    meltingK: 14.01,  boilingK: 20.28,  mag: 'diamagnetic' },
  2:  { symbol: 'He', bPerAMeV: 7.074,  rhoKgM3: 145,   meltingK: 0.95,   boilingK: 4.22,   mag: 'diamagnetic' },
  6:  { symbol: 'C',  bPerAMeV: 7.680,  rhoKgM3: 3515,  meltingK: 3823,   boilingK: 4300,   mag: 'diamagnetic' },
  10: { symbol: 'Ne', bPerAMeV: 8.032,  rhoKgM3: 1444,  meltingK: 24.56,  boilingK: 27.07,  mag: 'diamagnetic' },
  11: { symbol: 'Na', bPerAMeV: 8.111,  rhoKgM3: 968,   meltingK: 370.9,  boilingK: 1156,   mag: 'paramagnetic' },
  13: { symbol: 'Al', bPerAMeV: 8.332,  rhoKgM3: 2700,  meltingK: 933.5,  boilingK: 2792,   mag: 'paramagnetic' },
  14: { symbol: 'Si', bPerAMeV: 8.448,  rhoKgM3: 2329,  meltingK: 1687,   boilingK: 3538,   mag: 'diamagnetic' },
  18: { symbol: 'Ar', bPerAMeV: 8.595,  rhoKgM3: 1623,  meltingK: 83.8,   boilingK: 87.3,   mag: 'diamagnetic' },
  26: { symbol: 'Fe', bPerAMeV: 8.790,  rhoKgM3: 7874,  meltingK: 1811,   boilingK: 3134,   mag: 'ferromagnetic' },
  29: { symbol: 'Cu', bPerAMeV: 8.752,  rhoKgM3: 8960,  meltingK: 1358,   boilingK: 2835,   mag: 'diamagnetic' },
  47: { symbol: 'Ag', bPerAMeV: 8.554,  rhoKgM3: 10490, meltingK: 1235,   boilingK: 2435,   mag: 'diamagnetic' },
  79: { symbol: 'Au', bPerAMeV: 8.000,  rhoKgM3: 19300, meltingK: 1337,   boilingK: 3129,   mag: 'diamagnetic' },
  80: { symbol: 'Hg', bPerAMeV: 7.921,  rhoKgM3: 13534, meltingK: 234.3,  boilingK: 629.9,  mag: 'diamagnetic' },
  82: { symbol: 'Pb', bPerAMeV: 7.867,  rhoKgM3: 11340, meltingK: 600.6,  boilingK: 2022,   mag: 'diamagnetic' },
  92: { symbol: 'U',  bPerAMeV: 7.570,  rhoKgM3: 19050, meltingK: 1405,   boilingK: 4404,   mag: 'paramagnetic' }
});

export function evaluateG7ElementAdvisory(Z, bundle) {
  const ref = G7_ADVISORY_ELEMENT_BENCHMARKS[Z] || null;
  if (!ref) {
    return Object.freeze({
      g7Advisory: true,
      hasReference: false,
      note: Z > 100
        ? 'Superheavy element: no experimental bulk properties exist (tier-3 theoretical prediction).'
        : 'No checked-in G7 snapshot benchmark row for this Z.'
    });
  }
  const relErr = (got, exp) => (exp > 0 ? Math.abs(got - exp) / exp : Math.abs(got - exp));
  return Object.freeze({
    g7Advisory: true,
    hasReference: true,
    bindingPerNucleonRelErr: relErr(bundle.nuclear.bindingPerNucleonMeV, ref.bPerAMeV),
    densityRelErr: relErr(bundle.mechanical.densityKgPerM3, ref.rhoKgM3),
    meltingRelErr: relErr(bundle.thermodynamic.meltingPointK, ref.meltingK),
    boilingRelErr: relErr(bundle.thermodynamic.boilingPointK, ref.boilingK),
    magneticPhaseMatch: bundle.electromagnetic.magneticPhase === ref.mag,
    reference: ref
  });
}

/**
 * Derive a complete, validated `ulg.material-property-bundle.v1` for ANY
 * element Z = 1..118 strictly on WebGPU (`0` hardcoded element tables).
 */
export async function deriveElementBundleWebGpu(device, atomicNumberZ, {
  massNumberA = null,
  temperatureK = 300,
  runNuclearGpuVolume = true,
  runLiveMd = true,
  mdSteps = 16,
  mdCellsPerSide = 3,
  atomicMaxScf = 55,
  atomicGridPointsN = 256,
  nuclearVolDim = 24,
  blochGridN = 16,
  functional = 'pbe',
  scalarRelativistic = true,
  spinOrbit = true,
  returnOrbitalWavefunctions = false
} = {}) {
  const Z = Math.trunc(Number(atomicNumberZ));
  if (!(Z >= 1 && Z <= 118)) {
    throw new RangeError(`Element atomicNumberZ out of range 1..118: ${atomicNumberZ}`);
  }
  const symbol = symbolForZ(Z);

  // Stage P1.1: Nuclear Structure, Finite R_nuc(A), Woods-Saxon & WKB Decay
  const nuclear = runNuclearGpuVolume
    ? await solveNuclearStructureWebGpu(device, Z, massNumberA, { volDim: nuclearVolDim })
    : deriveNuclearClosure(Z, massNumberA);

  // Augment configuration with dipole-allowed (Delta l = +-1) virtual (occupancy=0) target subshells
  // for d/f elements so the GPU radial Kohn-Sham eigensolver derives exact relativistic d->p / f->d
  // interband transition energies strictly on WebGPU (zero effect on rho(r), zero CPU solveAtom()!).
  const baseCfg = electronConfiguration(Z);
  const augmentedCfg = baseCfg.map((s) => ({ ...s }));
  const addVirtual = (n, l) => {
    let targetN = Math.max(n, l + 1);
    while (augmentedCfg.some((sub) => sub.n === targetN && sub.l === l)) targetN += 1;
    augmentedCfg.push({ n: targetN, l, occupancy: 0 });
  };
  for (const sub of baseCfg) {
    if (sub.occupancy > 0 && sub.l >= 2) {
      if (sub.l - 1 >= 0) addVirtual(sub.n + 1, sub.l - 1);
      if (sub.l + 1 <= 4) addVirtual(sub.n + 1, sub.l + 1);
    }
  }
  augmentedCfg.sort((a, b) => (a.n + a.l) - (b.n + b.l) || a.n - b.n || a.l - b.l);

  // Stage P1.2: 100% GPU-Resident Finite-Nucleus Relativistic Atomic DFT (+ reduced-mass & hyperfine)
  const atom = await solveAtomFullWebGpu(device, Z, {
    functional,
    spinOrbit,
    scalarRelativistic,
    configuration: augmentedCfg,
    nuclearChargeRadiusBohr: nuclear.chargeRadiusBohr,
    nuclearMassU: nuclear.atomicMassU,
    nuclearSpinI: nuclear.spinI,
    nuclearMagneticMomentMuN: nuclear.magneticMomentMuN,
    gridPointsN: atomicGridPointsN,
    rMinBohr: Math.min(1e-4, Math.max(1e-5, nuclear.chargeRadiusBohr * 0.5)),
    maxScf: atomicMaxScf,
    returnRadialDensity: true,
    returnOrbitalWavefunctions
  });

  // Stage P1.3a: GPU Periodic Plane-Wave Bulk Solid DFT + 3D Bloch Density (isotope mass propagated!)
  const bulk = await solveBulkCrystalWebGpu(device, Z, atom, {
    densityGridN: blochGridN,
    atomicMassU: nuclear.atomicMassU
  });

  // Stage P1.3b: Electromagnetic, Magnetic, Electrical, Dielectric & Optical Closures
  const em = await deriveElectromagneticClosureWebGpu(device, {
    Z,
    atomResult: atom,
    bulkResult: bulk,
    temperatureK
  });

  // Stage P1.4: Quasi-Harmonic Phonons + Representative WebGPU MD Thermodynamics (isotope mass propagated!)
  const thermo = await deriveElementThermodynamicsWebGpu(device, {
    Z,
    atomicMassU: nuclear.atomicMassU,
    bulkResult: bulk,
    emResult: em,
    temperatureK,
    runLiveMd,
    mdSteps,
    mdCellsPerSide
  });

  const accuracyTier = Z > 100
    ? ULG_ACCURACY_TIERS.TIER_3_THEORETICAL_ENVELOPE
    : (bulk.accuracyTier === ULG_ACCURACY_TIERS.TIER_1_QUANTITATIVE
      ? ULG_ACCURACY_TIERS.TIER_1_QUANTITATIVE
      : ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE);

  const resolvedMaterialKey = massNumberA != null ? nuclear.isotope : symbol;
  const bundle = createMaterialPropertyBundle({
    materialKey: resolvedMaterialKey,
    symbol,
    atomicNumber: Z,
    massNumberA: nuclear.A,
    isotope: nuclear.isotope,
    family: 'element',
    accuracyTier,
    generatorFingerprint: ULG_PERIODIC_TABLE_ENGINE_FINGERPRINT,
    nuclear: {
      isotope: nuclear.isotope,
      Z: nuclear.Z,
      N: nuclear.N,
      A: nuclear.A,
      bindingEnergyMeV: nuclear.bindingEnergyMeV,
      bindingPerNucleonMeV: nuclear.bindingPerNucleonMeV,
      atomicMassU: nuclear.atomicMassU,
      massExcessMeV: nuclear.massExcessMeV,
      chargeRadiusFm: nuclear.chargeRadiusFm,
      chargeRadiusBohr: nuclear.chargeRadiusBohr,
      spinI: nuclear.spinI,
      parity: nuclear.parity,
      shellLabel: nuclear.shellLabel,
      magneticMomentMuN: nuclear.magneticMomentMuN,
      fissility: nuclear.fissility,
      fissionBarrierMeV: nuclear.fissionBarrierMeV,
      qAlphaMeV: nuclear.qAlphaMeV,
      qBetaMinusMeV: nuclear.qBetaMinusMeV,
      qElectronCaptureMeV: nuclear.qElectronCaptureMeV,
      dominantMode: nuclear.dominantMode,
      daughterZ: nuclear.daughterZ,
      daughterA: nuclear.daughterA,
      log10HalfLifeS: nuclear.log10HalfLifeS
    },
    atomic: {
      configurationString: configurationString(Z),
      configuration: electronConfiguration(Z),
      spinConfiguration: spinElectronConfiguration(Z),
      unpairedElectrons: unpairedElectronCount(Z),
      totalEnergyHa: atom.totalEnergyHa,
      qedRadiativeShiftHa: atom.qedRadiativeShiftHa ?? 0,
      reducedMassFactor: atom.reducedMassFactor ?? 1,
      isotopeMassShiftHa: atom.isotopeMassShiftHa ?? 0,
      hyperfineSplittingHz: atom.hyperfineSplittingHz ?? 0,
      finiteNucleusUsed: Boolean(atom.finiteNucleusUsed),
      dirac4Component: Boolean(atom.dirac4Component),
      totalSmallComponentNormSq: atom.totalSmallComponentNormSq ?? 0,
      relativisticMethod: atom.relativisticMethod,
      resolverStatus: atom.resolverStatus,
      perScfCpuReadbacks: atom.perScfCpuReadbacks,
      integratedElectrons: atom.integratedElectrons,
      orbitals: atom.orbitals
    },
    electromagnetic: {
      isMetal: em.isMetal,
      bandGapEv: em.bandGapEv,
      mbjCParameter: bulk.mbjCParameter ?? em.mbjCParameter ?? null,
      dftUHubbardEv: bulk.dftUHubbardEv ?? em.dftUHubbardEv ?? 0,
      dftUExchangeSplittingEv: bulk.dftUExchangeSplittingEv ?? 0,
      fermiEnergyEv: bulk.fermiEnergyEv,
      dosAtFermiStatesPerEvAtom: bulk.dosAtFermiStatesPerEvAtom,
      plasmaEnergyEv: em.plasmaEnergyEv,
      drudeDampingEv: em.drudeDampingEv,
      interbandOscillators: em.interbandOscillators,
      workFunctionEv: em.workFunctionEv,
      electricalConductivitySPerM: em.electricalConductivitySPerM,
      electricalResistivityOhmM: em.electricalResistivityOhmM,
      staticDielectricConstant: em.staticDielectricConstant,
      magneticPhase: em.magneticPhase,
      stonerProduct: em.stonerProduct,
      magneticMomentMuB: em.magneticMomentMuB,
      curieOrNeelTempK: em.curieOrNeelTempK,
      magneticSusceptibilitySi: em.magneticSusceptibilitySi,
      superconductingTcK: em.superconductingTcK,
      opticalSrgb: em.opticalSrgb,
      refractiveIndex550Nm: em.refractiveIndex550Nm,
      reflectance550Nm: em.reflectance550Nm,
      spectralWavelengthsNm: em.spectralWavelengthsNm,
      spectralReflectance: em.spectralReflectance,
      spectralNRe: em.spectralNRe,
      oscillatorSource: em.provenance?.oscillatorSource ?? 'none'
    },
    mechanical: {
      crystalStructure: bulk.crystalStructure,
      spaceGroup: bulk.spaceGroup,
      coordinationNumber: bulk.coordinationNumber,
      latticeConstantA: bulk.latticeConstantA,
      densityKgPerM3: bulk.densityKgPerM3,
      cohesiveEnergyEv: bulk.cohesiveEnergyEv,
      bulkModulusPa: bulk.bulkModulusPa,
      shearModulusPa: bulk.shearModulusPa,
      poissonRatio: bulk.poissonRatio,
      elasticConstantsGPa: bulk.elasticConstantsGPa,
      soundSpeedLongMPerS: bulk.soundSpeedLongMPerS,
      soundSpeedTransMPerS: bulk.soundSpeedTransMPerS,
      debyeTemperatureK: bulk.debyeTemperatureK
    },
    thermodynamic: {
      temperatureK,
      heatCapacityCvJPerKgK: thermo.heatCapacityCvJPerKgK,
      heatCapacityCpJPerKgK: thermo.heatCapacityCpJPerKgK,
      thermalExpansionVolPerK: thermo.thermalExpansionVolPerK,
      meltingPointK: thermo.meltingPointK,
      boilingPointK: thermo.boilingPointK,
      latentHeatFusionJPerKg: thermo.latentHeatFusionJPerKg,
      latentHeatVaporizationJPerKg: thermo.latentHeatVaporizationJPerKg,
      meltingSlopeKPerLogP: thermo.meltingSlopeKPerLogP,
      boilingSlopeKPerLogP: thermo.boilingSlopeKPerLogP,
      liquidDensityKgPerM3: thermo.liquidDensityKgPerM3,
      dynamicViscosityLiquidPaS: thermo.dynamicViscosityLiquidPaS,
      dynamicViscosityGasPaS: thermo.dynamicViscosityGasPaS,
      surfaceTensionNPerM: thermo.surfaceTensionNPerM,
      thermalConductivityWPerMK: thermo.thermalConductivityWPerMK,
      potentialModel: thermo.potential.modelName,
      mdEnergyEv: thermo.mdTelemetry?.totalEnergyEv ?? null,
      mdTempK: thermo.mdTelemetry?.temperatureK ?? null,
      mdPressureGPa: thermo.mdTelemetry?.pressureGPa ?? null,
      mdMsdA2: thermo.mdTelemetry?.msdA2 ?? null
    },
    provenance: {
      status: em.provenance?.status === 'hybrid-webgpu-spectral-cpu-oscillators'
        ? 'hybrid-webgpu-spectral-cpu-oscillators'
        : 'webgpu-derived',
      scientificValidation: false,
      extrapolationPolicy: 'fail-closed'
    }
  });

  const g7Advisory = evaluateG7ElementAdvisory(Z, bundle);
  return Object.freeze({
    bundle,
    g7Advisory,
    visualData: Object.freeze({
      nuclear,
      atom,
      bulk,
      em,
      thermo
    })
  });
}

export { ELEMENT_SYMBOLS };
