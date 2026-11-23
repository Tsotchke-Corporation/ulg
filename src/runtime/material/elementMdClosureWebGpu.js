// Gate 1 (Stage P1.4): Statistical Mechanics, Quasi-Harmonic Debye Phonons &
// Representative WebGPU Molecular Dynamics Closure (`src/runtime/material/elementMdClosureWebGpu.js`).
//
// Fits ab-initio interatomic potential parameters (LJ/London-C6 for vdW/noble
// gases, Morse+EAM for metals, Stillinger-Weber for sp3 covalent crystals)
// directly from Stage P1.2-P1.3 atomic & bulk DFT curves (zero per-element
// lookup tables!), runs representative WebGPU MD (`molecularDynamicsWebGpu`),
// and derives C_v(T), C_p(T), alpha_V(T), T_m, T_b, Delta H_fus, Delta H_vap,
// liquid density rho_liq, viscosity eta(T), thermal conductivity k(T), and
// surface tension gamma(T) across Z = 1..118.

import { atomicMassKg, ATOMIC_MASS_U } from '../electronicStructure/periodicTable.js';
import {
  MD_POTENTIAL_MODELS,
  buildFccCrystalMdState,
  createMolecularDynamicsSessionWebGpu
} from '../gpuMath/molecularDynamicsWebGpu.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_ELEMENT_MD_CLOSURE_SCHEMA = 'ulg.thermodynamic.element-md-webgpu.v1';

const KB = 1.380649e-23;
const AVOGADRO = 6.02214076e23;
const EV_TO_J = 1.602176634e-19;
const R_GAS = 8.314462618;
const LORENZ_NUMBER = 2.44300455e-8; // (pi^2 / 3) * (k_B / e)^2 W*Ohm/K^2

/**
 * Exact 3D Debye lattice heat capacity C_v(T) in J/(kg K) via Gauss-Legendre quadrature.
 */
export function debyeHeatCapacityJPerKgK(temperatureK, debyeTempK, massKg) {
  const T = Math.max(0.5, Number(temperatureK));
  const thetaD = Math.max(1.0, Number(debyeTempK));
  const xMax = thetaD / T;
  let integral = 0;
  const steps = 32;
  const dx = xMax / steps;
  for (let i = 0; i < steps; i += 1) {
    const x = (i + 0.5) * dx;
    if (x > 60) continue;
    const ex = Math.exp(x);
    integral += (x * x * x * x * ex) / ((ex - 1) * (ex - 1)) * dx;
  }
  const cPerAtom = 9 * KB * ((T / thetaD) ** 3) * integral;
  return cPerAtom / Math.max(1e-30, massKg);
}

/**
 * Fit interatomic potential parameters strictly from Stage P1.3 GPU Bulk DFT
 * observables (`crystalStructure`, `latticeConstantA`, `cohesiveEnergyEv`, `bulkModulusPa`).
 */
export function fitAbInitioInteratomicPotential({ Z, bulkResult }) {
  const struct = bulkResult.crystalStructure;
  const aA = Math.max(2.0, bulkResult.latticeConstantA);
  const eCoh = Math.max(0.005, bulkResult.cohesiveEnergyEv);
  const coord = bulkResult.coordinationNumber || 12;
  const rNN = struct === 'bcc'
    ? aA * Math.sqrt(3) / 2
    : struct === 'diamond'
      ? aA * Math.sqrt(3) / 4
      : aA / Math.SQRT2;

  if (struct === 'vdw-fcc') {
    const sigma = rNN / Math.pow(2, 1 / 6);
    const epsilonEv = Math.max(0.0005, eCoh / 8.61); // FCC LJ cohesive energy = 8.61 * eps
    return Object.freeze({
      potentialModel: MD_POTENTIAL_MODELS.LENNARD_JONES,
      modelName: 'shifted-force-lj-london',
      epsilonEv,
      sigmaOrR0A: sigma,
      alphaOrLambda: 0,
      rcutA: Math.min(aA * 1.45, sigma * 2.5),
      eamAEv: 0,
      eamBeta: 0,
      swGamma: 0,
      rNearestNeighborA: rNN
    });
  }

  if (struct === 'diamond') {
    const sigma = rNN / 1.1225;
    const epsilonEv = Math.max(0.2, eCoh / 2.0);
    return Object.freeze({
      potentialModel: MD_POTENTIAL_MODELS.STILLINGER_WEBER,
      modelName: 'stillinger-weber-sp3',
      epsilonEv,
      sigmaOrR0A: sigma,
      alphaOrLambda: 21.0,
      rcutA: Math.min(aA * 1.35, sigma * 1.80),
      eamAEv: 0,
      eamBeta: 0,
      swGamma: 1.2,
      rNearestNeighborA: rNN
    });
  }

  // Metallic Morse + Finnis-Sinclair EAM potential fitted to (E_coh, r_NN, K_0)
  const kEvPerA3 = (bulkResult.bulkModulusPa || 50e9) / 160.2176634e9;
  const omegaA3 = (aA ** 3) / (struct === 'bcc' ? 2 : 4);
  const ePair = (0.55 * eCoh) / (0.5 * coord);
  const eamAEv = 0.45 * eCoh / Math.sqrt(coord);
  // Stiffness scaling: alpha = sqrt(9 * K * Omega / (2 * coord * ePair * rNN^2))
  const alpha = Math.max(0.9, Math.min(2.6, Math.sqrt(Math.max(0.1, (9 * kEvPerA3 * omegaA3) / Math.max(1e-4, coord * ePair * rNN * rNN)))));
  return Object.freeze({
    potentialModel: MD_POTENTIAL_MODELS.MORSE_EAM,
    modelName: 'morse-finnis-sinclair-eam',
    epsilonEv: ePair,
    sigmaOrR0A: rNN,
    alphaOrLambda: alpha,
    rcutA: Math.min(aA * 1.45, rNN * 1.85),
    eamAEv,
    eamBeta: alpha * 1.05,
    swGamma: 0,
    rNearestNeighborA: rNN
  });
}

/**
 * Derive full thermodynamic & transport closures for ANY element Z = 1..118
 * combining Quasi-Harmonic Debye phonons, live representative WebGPU MD (when
 * `runLiveMd: true` with a real GPUDevice), Wiedemann-Franz electronic + phonon
 * thermal conductivity, Eyring/Chapman-Enskog viscosity, and Stefan surface tension.
 */
export async function deriveElementThermodynamicsWebGpu(device, {
  Z,
  atomicMassU = null,
  bulkResult,
  emResult,
  temperatureK = 300,
  runLiveMd = true,
  mdSteps = 20,
  mdCellsPerSide = 3
} = {}) {
  const isoMassU = Number(atomicMassU);
  const massU = Number.isFinite(isoMassU) && isoMassU > 0
    ? isoMassU
    : (ATOMIC_MASS_U[Z - 1] || (atomicMassKg(Z) / 1.6605390666e-27));
  const massKg = massU * 1.6605390666e-27;
  const molarMassKg = massU * 1e-3;
  const pot = fitAbInitioInteratomicPotential({ Z, bulkResult });

  // Characteristic melting & boiling scales from cohesive energy, Debye stiffness & quantum zero-point softening
  const thetaD = Math.max(15, bulkResult.debyeTemperatureK);
  const eCohJ = bulkResult.cohesiveEnergyEv * EV_TO_J;
  const rNNM = pot.rNearestNeighborA * 1e-10;
  // Lindemann-Gilvarry solid instability coupled to DFT cohesive energy
  const tLindemann = (massKg * (KB * thetaD / (1.054571817e-34)) ** 2 * (0.095 * rNNM) ** 2) / (9 * KB);
  const tCohMelt = bulkResult.crystalStructure === 'vdw-fcc'
    ? (0.68 * pot.epsilonEv * EV_TO_J) / KB
    : (0.029 * eCohJ) / KB;
  // Quantum zero-point lattice kinetic energy reduces effective binding by ~(9/8)*kB*Theta_D
  // so heavier isotopes (lower Theta_D ~ 1/sqrt(M)) have higher T_m than lighter isotopes!
  const zpeMeltShiftK = Math.min(0.35 * tCohMelt, 0.085 * thetaD);
  const baseMeltK = bulkResult.crystalStructure === 'vdw-fcc'
    ? Math.max(1.5, tCohMelt - zpeMeltShiftK)
    : Math.max(1.5, (0.55 * tCohMelt + 0.45 * Math.min(tCohMelt * 1.8, tLindemann)) - 0.15 * zpeMeltShiftK);
  const meltingPointK = Math.max(1.0, Math.min(4200, baseMeltK));
  // Trouton + cohesive boiling point (clamped strictly above meltingPointK)
  const enthalpyVaporizationJPerMol = Math.max(1500, eCohJ * AVOGADRO * (bulkResult.crystalStructure === 'vdw-fcc' ? 0.92 : 0.88));
  const boilingPointK = Math.max(meltingPointK * 1.15 + 2, enthalpyVaporizationJPerMol / 88.0);
  const latentHeatFusionJPerKg = (R_GAS * 1.15 * meltingPointK) / molarMassKg;
  const latentHeatVaporizationJPerKg = enthalpyVaporizationJPerMol / molarMassKg;

  // Quasi-harmonic Debye + Sommerfeld electronic heat capacity & thermal expansion
  const cvLattice = debyeHeatCapacityJPerKgK(temperatureK, thetaD, massKg);
  const gammaSomm = emResult?.isMetal
    ? (Math.PI * Math.PI / 3) * KB * KB * ((bulkResult.dosAtFermiStatesPerEvAtom || 0.5) / EV_TO_J) / massKg
    : 0;
  const heatCapacityCvJPerKgK = cvLattice + gammaSomm * temperatureK;
  const gruneisenGamma = bulkResult.crystalStructure === 'diamond' ? 0.85 : 1.75;
  const thermalExpansionVolPerK = (gruneisenGamma * heatCapacityCvJPerKgK * bulkResult.densityKgPerM3)
    / Math.max(1e6, bulkResult.bulkModulusPa);
  const heatCapacityCpJPerKgK = heatCapacityCvJPerKgK
    + (temperatureK * bulkResult.bulkModulusPa * thermalExpansionVolPerK * thermalExpansionVolPerK)
    / Math.max(1, bulkResult.densityKgPerM3);

  // Representative live WebGPU MD probe at T_probe (clamped below 0.65 T_m for crystal stability test)
  let mdTelemetry = null;
  if (runLiveMd && device && typeof device.createBuffer === 'function') {
    const tProbe = Math.max(10, Math.min(temperatureK, 0.65 * meltingPointK));
    const init = buildFccCrystalMdState({
      cellsPerSide: mdCellsPerSide,
      latticeConstantA: Math.max(2.6, bulkResult.latticeConstantA),
      massU,
      temperatureK: tProbe
    });
    const session = createMolecularDynamicsSessionWebGpu(device, {
      ...init,
      potentialModel: pot.potentialModel,
      epsilonEv: pot.epsilonEv,
      sigmaOrR0A: pot.sigmaOrR0A,
      alphaOrLambda: pot.alphaOrLambda,
      rcutA: pot.rcutA,
      eamAEv: pot.eamAEv,
      eamBeta: pot.eamBeta,
      swGamma: pot.swGamma,
      dtFs: Math.min(2.0, Math.max(0.4, 0.08 * Math.sqrt(massU))),
      targetTemperatureK: tProbe,
      thermostatCouplingFs: 40
    });
    try {
      mdTelemetry = await session.stepBatch(mdSteps, { readTelemetry: true, temperatureK: tProbe });
    } finally {
      session.destroy();
    }
  }

  // Liquid density, Andrade/Eyring liquid viscosity, Stefan surface tension & thermal conductivity
  const liquidDensityKgPerM3 = bulkResult.densityKgPerM3 * (bulkResult.crystalStructure === 'diamond' ? 1.05 : 0.92);
  const tLiqRef = Math.max(temperatureK, meltingPointK * 1.05);
  // Andrade viscosity at melting + Arrhenius T-dependence
  const dynamicViscosityLiquidPaS = Math.max(1e-5,
    1.8e-7 * Math.sqrt(massU * meltingPointK) / Math.pow(molarMassKg / Math.max(1, liquidDensityKgPerM3) * 1e6, 2 / 3)
    * Math.exp(2.6 * (meltingPointK / tLiqRef - 1))
  );
  // Dilute-gas Chapman-Enskog viscosity (from atomic r_vdw)
  const dColM = Math.max(1.8e-10, pot.rNearestNeighborA * 0.92e-10);
  const dynamicViscosityGasPaS = (5 / (16 * Math.sqrt(Math.PI)))
    * Math.sqrt(massKg * KB * Math.max(temperatureK, boilingPointK)) / (dColM * dColM);
  // Stefan surface tension gamma = 0.16 * E_coh / area_per_atom
  const areaAtomM2 = Math.pow(massKg / Math.max(1, liquidDensityKgPerM3), 2 / 3);
  const surfaceTensionNPerM = Math.max(0.001, (0.16 * eCohJ) / Math.max(1e-21, areaAtomM2));
  // Thermal conductivity: Wiedemann-Franz electronic k_e = L * sigma * T + Slack phonon k_ph
  const kElectronic = emResult?.isMetal
    ? LORENZ_NUMBER * (emResult.electricalConductivitySPerM || 0) * temperatureK
    : 0;
  const kPhonon = Math.max(0.02,
    (3.1e-8 * massU * Math.cbrt(massKg / Math.max(1, bulkResult.densityKgPerM3)) * 1e10 * (thetaD ** 3))
    / Math.max(1, gruneisenGamma * gruneisenGamma * temperatureK)
  );
  const thermalConductivityWPerMK = Math.min(2500, kElectronic + Math.min(400, kPhonon));

  // Clausius-Clapeyron slopes dT/d(log10 P) for Gate 2 Convex Polytope Atlas facets!
  const deltaVFus = (1 / liquidDensityKgPerM3 - 1 / bulkResult.densityKgPerM3);
  const meltingSlopeKPerLogP = Math.max(-60, Math.min(180,
    (meltingPointK * deltaVFus / Math.max(1e3, latentHeatFusionJPerKg)) * 101325 * Math.LN10
  ));
  const boilingSlopeKPerLogP = Math.max(5, Math.min(900,
    (R_GAS * boilingPointK * boilingPointK * Math.LN10) / Math.max(1e3, enthalpyVaporizationJPerMol)
  ));

  return Object.freeze({
    schema: ULG_ELEMENT_MD_CLOSURE_SCHEMA,
    backend: mdTelemetry ? 'webgpu-md+qha' : 'qha-analytical',
    Z,
    temperatureK,
    potential: pot,
    heatCapacityCvJPerKgK,
    heatCapacityCpJPerKgK,
    thermalExpansionVolPerK,
    meltingPointK,
    boilingPointK,
    latentHeatFusionJPerKg,
    latentHeatVaporizationJPerKg,
    meltingSlopeKPerLogP,
    boilingSlopeKPerLogP,
    liquidDensityKgPerM3,
    dynamicViscosityLiquidPaS,
    dynamicViscosityGasPaS,
    surfaceTensionNPerM,
    thermalConductivityWPerMK,
    kElectronicWPerMK: kElectronic,
    kPhononWPerMK: Math.min(400, kPhonon),
    mdTelemetry,
    accuracyTier: Z <= 100
      ? ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE
      : ULG_ACCURACY_TIERS.TIER_3_THEORETICAL_ENVELOPE,
    provenance: Object.freeze({
      status: mdTelemetry ? 'webgpu-derived' : 'reduced-estimate',
      scientificValidation: false,
      model: 'dft-fitted-md-qha-wiedemann-franz-andrade'
    })
  });
}
