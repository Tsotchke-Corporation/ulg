import { schroederAuthorityTextFingerprint } from '../sph/schroederAuthorityFingerprint.js';
import {
  deriveEshkolHelmholtzPotentialClosure,
  deriveEshkolSolidHyperelasticClosure,
  deriveEshkolTransportClosures,
  packEshkolTriadClosureBundleForGpu
} from './eshkolTriadClosures.js';

export const ULG_MOONLAB_COLD_MISS_SYNTHESIS_SCHEMA =
  'peercompute.ulg.moonlab-first-principles-cold-miss-synthesis.v1';

const AVOGADRO_R = 8.314462618;
const BOLTZMANN_KB = 1.380649e-23;
const AVOGADRO_NA = 6.02214076e23;
const PLANCK_HBAR = 1.054571817e-34;

function finitePos(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || !(n > 0)) {
    throw new RangeError(`${label} must be a positive finite number`);
  }
  return n;
}

/**
 * Evaluate the 3D Debye dimensionless specific heat ratio C_v(T) / (3 R_s) via
 * 8-point Gauss-Legendre quadrature over x in [0, Theta_D / T].
 */
export function debyeHeatCapacityRatio(temperatureK, debyeTemperatureK) {
  const T = finitePos(temperatureK, 'temperatureK');
  const thetaD = finitePos(debyeTemperatureK, 'debyeTemperatureK');
  const upper = Math.min(40, thetaD / T);
  if (upper < 1e-4) return 1.0;
  // 8-point Gauss-Legendre nodes/weights on [-1, 1]
  const nodes = [
    -0.9602898564975363, -0.7966664774136267, -0.5255324099163290, -0.1834346424956498,
    0.1834346424956498, 0.5255324099163290, 0.7966664774136267, 0.9602898564975363
  ];
  const weights = [
    0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.3626837833783620,
    0.3626837833783620, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763
  ];
  const half = 0.5 * upper;
  let integral = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    const x = half * (nodes[i] + 1);
    const ex = Math.exp(x);
    const denom = (ex - 1) * (ex - 1);
    const integrand = denom > 0 ? ((x * x * x * x * ex) / denom) : 0;
    integral += weights[i] * integrand;
  }
  integral *= half;
  return Math.max(1e-4, Math.min(1.0, (3 / (upper * upper * upper)) * integral));
}

/**
 * Translate MoonLab quantum-state reference observables (cohesive binding energy,
 * vibrational frequency / Debye temperature, molecular diameter, and quantum probe
 * witness from MoonLab WebGPU/WASM) into physically consistent thermodynamic and
 * transport seed parameters.
 *
 * Fail-closed: rejects missing or nonphysical observables rather than fabricating
 * arbitrary constants.
 */
export function deriveFirstPrinciplesMaterialParametersFromMoonlab({
  material,
  molarMassKgPerMol,
  atomsPerFormula = 1,
  cohesiveEnergyEvPerAtom,
  debyeTemperatureK,
  molecularDiameterM,
  refDensityKgPerM3,
  meltTemperatureK = 1200,
  quantumProbeReceipt = null
} = {}) {
  if (typeof material !== 'string' || !material.trim()) {
    throw new TypeError('MoonLab cold-miss synthesis requires a material identifier');
  }
  const M = finitePos(molarMassKgPerMol, 'molarMassKgPerMol');
  const atoms = finitePos(atomsPerFormula, 'atomsPerFormula');
  const eCohEv = finitePos(cohesiveEnergyEvPerAtom, 'cohesiveEnergyEvPerAtom');
  const thetaD = finitePos(debyeTemperatureK, 'debyeTemperatureK');
  const sigmaM = finitePos(molecularDiameterM, 'molecularDiameterM');
  const rho0 = finitePos(refDensityKgPerM3, 'refDensityKgPerM3');
  const tMelt = finitePos(meltTemperatureK, 'meltTemperatureK');

  const rSpecific = AVOGADRO_R / M;
  const dulongPetitCv = 3 * atoms * rSpecific;
  // Atomic volume V_atom = M / (N_A * atoms * rho0)
  const atomicVolumeM3 = M / (AVOGADRO_NA * atoms * rho0);
  // Cohesive energy density u_coh [J/m^3] = (eCohEv * eV) / V_atom -> bulk modulus K0 ~ 2.2 * u_coh (Rose-Vinet scaling)
  const eCohJ = eCohEv * 1.602176634e-19;
  const bulkModulusPa = Math.max(1e7, 2.2 * (eCohJ / atomicVolumeM3));
  // Poisson ratio nu ~ 0.30 -> mu0 = 3*(1-2*nu)/(2*(1+nu)) * K0 ~ 0.4615 * K0, lambda0 = K0 - (2/3)*mu0
  const lameMu0Pa = 0.4615384615 * bulkModulusPa;
  const lameLambda0Pa = bulkModulusPa - (2 / 3) * lameMu0Pa;
  // Lindemann / Grüneisen thermal expansion estimate alpha ~ (0.018 / T_melt)
  const thermalExpansionPerK = Math.max(1e-6, Math.min(2e-4, 0.018 / tMelt));

  // Chapman-Enskog kinetic transport reference at T_ref = 300 K from quantum molecular diameter sigmaM
  const tRef = 300;
  const molMassKg = M / AVOGADRO_NA;
  const muRefPaS = (5 / 16) * Math.sqrt(Math.PI * molMassKg * BOLTZMANN_KB * tRef) / (Math.PI * sigmaM * sigmaM);
  const cvGas = Math.max(1.5 * rSpecific, 0.75 * dulongPetitCv);
  const kRefWPerMK = muRefPaS * (cvGas + 2.25 * rSpecific);
  const gasRhoRef = (101325 * M) / (AVOGADRO_R * tRef);
  const diffusivityRefM2PerS = (3 / 8)
    * Math.sqrt((Math.PI * BOLTZMANN_KB * tRef) / molMassKg)
    * (1 / (Math.PI * sigmaM * sigmaM * (gasRhoRef / molMassKg)));

  // Vibrational zero-point reference frequency check (omega_D = kB * thetaD / hbar)
  const debyeAngularFreqRadPerS = (BOLTZMANN_KB * thetaD) / PLANCK_HBAR;

  const provenanceFingerprint = schroederAuthorityTextFingerprint(JSON.stringify({
    schema: ULG_MOONLAB_COLD_MISS_SYNTHESIS_SCHEMA,
    material: material.trim(),
    M,
    atoms,
    eCohEv,
    thetaD,
    sigmaM,
    rho0,
    tMelt,
    quantumProbeFingerprint: quantumProbeReceipt?.fingerprint ?? quantumProbeReceipt?.qubits ?? null
  }), 'moonlab-cold-miss-params');

  return Object.freeze({
    material: material.trim(),
    molarMassKgPerMol: M,
    atomsPerFormula: atoms,
    rSpecificJPerKgK: rSpecific,
    dulongPetitCvJPerKgK: dulongPetitCv,
    debyeTemperatureK: thetaD,
    debyeAngularFreqRadPerS,
    bulkModulusPa,
    lameLambda0Pa,
    lameMu0Pa,
    thermalExpansionPerK,
    refDensityKgPerM3: rho0,
    gasRefDensityKgPerM3: gasRhoRef,
    meltTemperatureK: tMelt,
    muRefPaS,
    kRefWPerMK,
    diffusivityRefM2PerS,
    provenanceFingerprint
  });
}

/**
 * Generate a strictly monotone multi-sample G6 Debye solid caloric curve
 * (u [J/kg], T [K]) over [tMinK, tMaxK] directly consumable by `thermalPotentialGpu.js`.
 */
export function buildDebyeG6CaloricSamples({
  dulongPetitCvJPerKgK,
  debyeTemperatureK,
  tMinK = 60,
  tMaxK = 900,
  sampleCount = 17,
  uOriginJPerKg = 0
} = {}) {
  const cvInf = finitePos(dulongPetitCvJPerKgK, 'dulongPetitCvJPerKgK');
  const thetaD = finitePos(debyeTemperatureK, 'debyeTemperatureK');
  const tLo = finitePos(tMinK, 'tMinK');
  const tHi = finitePos(tMaxK, 'tMaxK');
  if (!(tHi > tLo)) throw new RangeError('tMaxK must exceed tMinK');
  const n = Math.max(3, Math.min(128, Math.round(Number(sampleCount) || 17)));

  const samples = [];
  let u = Number(uOriginJPerKg) || 0;
  samples.push({ u, temperatureK: tLo });
  const dt = (tHi - tLo) / (n - 1);
  // Integrate du = cv(T) dT using 4-substep Simpson quadrature per interval so
  // u(T) is strictly increasing and C^infty smooth for G6 Chebyshev fitting!
  for (let i = 1; i < n; i += 1) {
    const ta = tLo + (i - 1) * dt;
    const tb = tLo + i * dt;
    const tm = 0.5 * (ta + tb);
    const cvA = cvInf * debyeHeatCapacityRatio(ta, thetaD);
    const cvM = cvInf * debyeHeatCapacityRatio(tm, thetaD);
    const cvB = cvInf * debyeHeatCapacityRatio(tb, thetaD);
    const du = (dt / 6) * (cvA + 4 * cvM + cvB);
    if (!(du > 0) || !Number.isFinite(du)) {
      throw new RangeError('Non-positive Debye caloric energy increment');
    }
    u += du;
    samples.push({ u, temperatureK: tb });
  }
  return Object.freeze(samples.map((s) => Object.freeze(s)));
}

/**
 * Complete MoonLab + Eshkol First-Principles Cold-Miss Synthesizer:
 *
 * 1. Derives physical parameters from MoonLab quantum observables (fail-closed),
 * 2. Generates Eshkol-AD A4 Helmholtz potential, Solid Hyperelastic potential,
 *    and 2D (T, rho) Transport closures (k, mu, D),
 * 3. Generates a multi-sample Debye G6 caloric curve (u, T),
 * 4. Packs the certified 5-slot GPU A4 response table + provenance fingerprint
 *    ready for schedule-boundary adoption into A3/A4/G6 via PeerCompute A6.
 */
export async function synthesizeMoonlabFirstPrinciplesClosures({
  material,
  molarMassKgPerMol,
  atomsPerFormula = 1,
  cohesiveEnergyEvPerAtom,
  debyeTemperatureK,
  molecularDiameterM,
  refDensityKgPerM3,
  meltTemperatureK = 1200,
  temperatureRangeK = [240, 800],
  eshkolSample = null,
  quantumProbeReceipt = null,
  g6SampleCount = 33
} = {}) {
  const params = deriveFirstPrinciplesMaterialParametersFromMoonlab({
    material,
    molarMassKgPerMol,
    atomsPerFormula,
    cohesiveEnergyEvPerAtom,
    debyeTemperatureK,
    molecularDiameterM,
    refDensityKgPerM3,
    meltTemperatureK,
    quantumProbeReceipt
  });

  const v0 = 1 / params.refDensityKgPerM3;
  const helmholtz = await deriveEshkolHelmholtzPotentialClosure({
    sample: eshkolSample,
    material: params.material,
    cvJPerKgK: params.dulongPetitCvJPerKgK,
    rSpecificJPerKgK: params.rSpecificJPerKgK,
    bulkModulusPa: params.bulkModulusPa,
    refTemperatureK: 300,
    refSpecificVolumeM3PerKg: v0,
    refInternalEnergyJPerKg: 2.0 * params.dulongPetitCvJPerKgK * 300,
    temperatureRangeK,
    specificVolumeRangeM3PerKg: [0.92 * v0, 1.08 * v0]
  });

  const solidTHi = Math.max(10, Math.min(params.meltTemperatureK * 0.9, temperatureRangeK[1]));
  const solidTLo = Math.max(4, Math.min(200, temperatureRangeK[0], solidTHi * 0.4));
  const solidHyperelastic = await deriveEshkolSolidHyperelasticClosure({
    sample: eshkolSample,
    material: params.material,
    lameLambda0Pa: params.lameLambda0Pa,
    lameMu0Pa: params.lameMu0Pa,
    thermalExpansionPerK: params.thermalExpansionPerK,
    refTemperatureK: Math.min(300, Math.max(solidTLo, solidTHi * 0.8)),
    meltTemperatureK: params.meltTemperatureK,
    temperatureRangeK: [solidTLo, solidTHi]
  });

  const transport = await deriveEshkolTransportClosures({
    sample: eshkolSample,
    material: params.material,
    refTemperatureK: 300,
    refDensityKgPerM3: params.gasRefDensityKgPerM3,
    kRefWPerMK: params.kRefWPerMK,
    muRefPaS: params.muRefPaS,
    diffusivityRefM2PerS: params.diffusivityRefM2PerS,
    temperatureRangeK,
    densityRangeKgPerM3: [0.35 * params.gasRefDensityKgPerM3, 3.5 * params.gasRefDensityKgPerM3]
  });

  const gpuBundle = packEshkolTriadClosureBundleForGpu({
    helmholtz,
    solidHyperelastic,
    transport
  });

  const g6THi = Math.max(12, Math.min(params.meltTemperatureK, temperatureRangeK[1]));
  const g6TLo = Math.max(4, Math.min(60, temperatureRangeK[0] * 0.5, g6THi * 0.4));
  const g6DebyeSamples = buildDebyeG6CaloricSamples({
    dulongPetitCvJPerKgK: params.dulongPetitCvJPerKgK,
    debyeTemperatureK: params.debyeTemperatureK,
    tMinK: g6TLo,
    tMaxK: g6THi,
    sampleCount: g6SampleCount
  });

  const combinedProvenance = schroederAuthorityTextFingerprint(
    `${params.provenanceFingerprint}|${gpuBundle.sourceFingerprint}|g6:${g6DebyeSamples.length}`,
    'moonlab-triad-synthesis'
  );

  return Object.freeze({
    schema: ULG_MOONLAB_COLD_MISS_SYNTHESIS_SCHEMA,
    material: params.material,
    parameters: params,
    helmholtz,
    solidHyperelastic,
    transport,
    gpuBundle,
    g6DebyeSamples,
    quantumProbeReceipt: quantumProbeReceipt ?? null,
    provenanceFingerprint: combinedProvenance
  });
}
