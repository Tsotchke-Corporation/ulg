/**
 * Phase 8: Nuclear Decay, Isotope Inventory Ledger, Energy Deposition, and
 * Frank-Tamm Cherenkov Radiation Closure ABI.
 *
 * Strict honesty & conservation rules:
 *  - Every decay channel conserves exact nucleon number A and charge Z.
 *  - Cherenkov emission is strictly gated by β = v / c > 1 / n(λ); below
 *    threshold it outputs zero photons and [0, 0, 0] sRGB (never faked glow).
 *  - All outputs carry `validation.scientificValidation = false` and explicit
 *    benchmark blockers until validated against ENDF/B & Geant4 reference suites.
 */

import { spectralResponseToSrgb } from './opticalClosure.js';

export const ULG_ISOTOPE_INVENTORY_SCHEMA = 'peercompute.ulg.isotope-inventory-ledger.v1';
export const ULG_NUCLEAR_CHANNEL_ABI_SCHEMA = 'peercompute.ulg.nuclear-channel-rows.v1';
export const ULG_CHERENKOV_CLOSURE_SCHEMA = 'peercompute.ulg.cherenkov-source-closure.v1';

const FINE_STRUCTURE_ALPHA = 1 / 137.035999084;
const ELECTRON_REST_MEV = 0.51099895;
const MEV_TO_JOULE = 1.602176634e-13;
const LN2 = Math.LN2;
export const NUCLEAR_CHANNEL_ROW_FLOATS = 8;

/**
 * Standard decay channel descriptors (fundamental nuclear constants: half-life,
 * Q-value, daughter (Z, A), and particle energy partitions). All runtime outputs
 * remain marked `scientificValidation: false` until full transport validation.
 */
export const NUCLEAR_DECAY_CHANNELS = Object.freeze({
  'U-238': Object.freeze({
    isotope: 'U-238', Z: 92, A: 238, mode: 'alpha', naturallyAbundant: true,
    daughterIsotope: 'Th-234', daughterZ: 90, daughterA: 234, emittedZ: 2, emittedA: 4,
    halfLifeS: 1.40999e17, qValueMeV: 4.270,
    alphaFraction: 0.99, betaFraction: 0.0, gammaFraction: 0.01, localDepositionFraction: 0.99
  }),
  'Co-60': Object.freeze({
    isotope: 'Co-60', Z: 27, A: 60, mode: 'beta-minus', naturallyAbundant: false,
    daughterIsotope: 'Ni-60', daughterZ: 28, daughterA: 60, emittedZ: -1, emittedA: 0,
    halfLifeS: 1.66344e8, qValueMeV: 2.823,
    alphaFraction: 0.0, betaFraction: 0.11, gammaFraction: 0.89, localDepositionFraction: 0.45
  }),
  'Cs-137': Object.freeze({
    isotope: 'Cs-137', Z: 55, A: 137, mode: 'beta-minus', naturallyAbundant: false,
    daughterIsotope: 'Ba-137', daughterZ: 56, daughterA: 137, emittedZ: -1, emittedA: 0,
    halfLifeS: 9.489e8, qValueMeV: 1.175,
    alphaFraction: 0.0, betaFraction: 0.44, gammaFraction: 0.56, localDepositionFraction: 0.55
  }),
  'H-3': Object.freeze({
    isotope: 'H-3', Z: 1, A: 3, mode: 'beta-minus', naturallyAbundant: false,
    daughterIsotope: 'He-3', daughterZ: 2, daughterA: 3, emittedZ: -1, emittedA: 0,
    halfLifeS: 3.8879e8, qValueMeV: 0.01859,
    alphaFraction: 0.0, betaFraction: 1.0, gammaFraction: 0.0, localDepositionFraction: 0.31
  })
});

function validateChannelConservation(ch) {
  if (ch.Z !== ch.daughterZ + ch.emittedZ) {
    throw new RangeError(`Nuclear channel ${ch.isotope} violates charge conservation: ${ch.Z} !== ${ch.daughterZ} + ${ch.emittedZ}`);
  }
  if (ch.A !== ch.daughterA + ch.emittedA) {
    throw new RangeError(`Nuclear channel ${ch.isotope} violates nucleon conservation: ${ch.A} !== ${ch.daughterA} + ${ch.emittedA}`);
  }
}

/**
 * Pack nuclear decay channel rows into a flat Float32Array GPU ABI buffer:
 * `[Z, A, halfLifeS, lambdaPerS, qValueMeV, alphaFrac, betaFrac, gammaFrac]`.
 */
export function packNuclearChannelRows(channels = Object.values(NUCLEAR_DECAY_CHANNELS)) {
  const list = Array.isArray(channels) ? channels : [];
  const data = new Float32Array(list.length * NUCLEAR_CHANNEL_ROW_FLOATS);
  for (let i = 0; i < list.length; i += 1) {
    const ch = list[i];
    validateChannelConservation(ch);
    const lambda = ch.halfLifeS > 0 ? LN2 / ch.halfLifeS : 0;
    const base = i * NUCLEAR_CHANNEL_ROW_FLOATS;
    data[base + 0] = ch.Z;
    data[base + 1] = ch.A;
    data[base + 2] = ch.halfLifeS;
    data[base + 3] = lambda;
    data[base + 4] = ch.qValueMeV;
    data[base + 5] = ch.alphaFraction;
    data[base + 6] = ch.betaFraction;
    data[base + 7] = ch.gammaFraction;
  }
  return Object.freeze({
    schema: ULG_NUCLEAR_CHANNEL_ABI_SCHEMA,
    rowCount: list.length,
    strideFloats: NUCLEAR_CHANNEL_ROW_FLOATS,
    strideBytes: NUCLEAR_CHANNEL_ROW_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    data,
    validation: Object.freeze({
      scientificValidation: false,
      nuclearBenchmarkValidated: false,
      blockers: Object.freeze(['pending-endf-geant4-transport-benchmark'])
    })
  });
}

/**
 * Advance an isotope population inventory by `dtS` seconds using exact
 * analytical exponential decay `ΔN = N * (1 - exp(-λ dt))`, conserving exact
 * nucleon counts (`Σ A_i N_i`) and computing deposited thermal energy & daughter
 * nuclide production.
 */
export function stepIsotopeInventoryLedger(inventory, dtS, { channels = NUCLEAR_DECAY_CHANNELS } = {}) {
  const dt = Math.max(0, Number(dtS) || 0);
  const nextCounts = new Map();
  const nuclideMassNumbers = new Map();
  let initialNucleons = 0;
  let totalDecays = 0;
  let totalReleasedEnergyJ = 0;
  let depositedThermalEnergyJ = 0;
  const events = [];

  for (const entry of inventory || []) {
    const count = Math.max(0, Number(entry.atomCount) || 0);
    const ch = channels[entry.isotope] || null;
    const A = entry.A ?? ch?.A ?? 0;
    initialNucleons += count * A;
    nuclideMassNumbers.set(entry.isotope, A);

    if (!ch || !(ch.halfLifeS > 0) || dt === 0 || count === 0) {
      nextCounts.set(entry.isotope, (nextCounts.get(entry.isotope) || 0) + count);
      continue;
    }
    validateChannelConservation(ch);
    const lambda = LN2 / ch.halfLifeS;
    const decayed = count * (-Math.expm1(-lambda * dt));
    const remaining = count - decayed;
    nextCounts.set(entry.isotope, (nextCounts.get(entry.isotope) || 0) + remaining);
    nextCounts.set(ch.daughterIsotope, (nextCounts.get(ch.daughterIsotope) || 0) + decayed);
    nuclideMassNumbers.set(ch.daughterIsotope, ch.daughterA);
    if (ch.emittedA > 0) {
      const emittedKey = ch.emittedA === 4 && ch.emittedZ === 2 ? 'He-4' : `emitted-A${ch.emittedA}`;
      nextCounts.set(emittedKey, (nextCounts.get(emittedKey) || 0) + decayed);
      nuclideMassNumbers.set(emittedKey, ch.emittedA);
    }

    const energyReleasedJ = decayed * ch.qValueMeV * MEV_TO_JOULE;
    const depositedJ = energyReleasedJ * (ch.localDepositionFraction ?? 0.5);
    totalDecays += decayed;
    totalReleasedEnergyJ += energyReleasedJ;
    depositedThermalEnergyJ += depositedJ;
    events.push(Object.freeze({
      isotope: ch.isotope,
      daughterIsotope: ch.daughterIsotope,
      mode: ch.mode,
      decayedAtoms: decayed,
      activityBq: count * lambda,
      energyReleasedJ,
      depositedThermalEnergyJ: depositedJ
    }));
  }

  const nextInventory = [];
  let finalNucleons = 0;
  for (const [isotope, atomCount] of nextCounts.entries()) {
    const A = nuclideMassNumbers.get(isotope) ?? 0;
    finalNucleons += atomCount * A;
    nextInventory.push(Object.freeze({ isotope, A, atomCount }));
  }

  return Object.freeze({
    schema: ULG_ISOTOPE_INVENTORY_SCHEMA,
    dtS: dt,
    nextInventory: Object.freeze(nextInventory),
    events: Object.freeze(events),
    totalDecays,
    totalReleasedEnergyJ,
    depositedThermalEnergyJ,
    thermalPowerW: dt > 0 ? depositedThermalEnergyJ / dt : 0,
    nucleonConservationRelError: initialNucleons > 0
      ? Math.abs(finalNucleons - initialNucleons) / initialNucleons
      : 0,
    closureBacked: true,
    validation: Object.freeze({
      scientificValidation: false,
      nuclearBenchmarkValidated: false,
      blockers: Object.freeze(['pending-endf-geant4-transport-benchmark'])
    })
  });
}

/**
 * Relativistic speed ratio β = v / c from kinetic energy (MeV) and rest mass (MeV).
 */
export function relativisticBetaFromKineticEnergyMeV(kineticEnergyMeV, restMassMeV = ELECTRON_REST_MEV) {
  const T = Math.max(0, Number(kineticEnergyMeV) || 0);
  const m0 = Math.max(1e-6, Number(restMassMeV) || ELECTRON_REST_MEV);
  const gamma = 1 + T / m0;
  return Math.sqrt(Math.max(0, 1 - 1 / (gamma * gamma)));
}

/**
 * First-principles Frank-Tamm Cherenkov radiation closure for a charged particle
 * moving at relativistic speed β = v / c through a dielectric medium with
 * refractive index `refractiveIndex` (or wavelength-dependent `refractiveIndexFn(nm)`).
 *
 * Strictly fail-closed below threshold (`β <= 1 / n`): returns `active: false`,
 * `photonsPerMeter: 0`, and `srgb: [0, 0, 0]`.
 */
export function evaluateCherenkovClosure({
  beta = null,
  kineticEnergyMeV = null,
  restMassMeV = ELECTRON_REST_MEV,
  chargeZ = 1,
  refractiveIndex = 1.333,
  refractiveIndexFn = null,
  lambdaMinNm = 380,
  lambdaMaxNm = 780
} = {}) {
  const resolvedBeta = Number.isFinite(Number(beta)) && beta !== null
    ? Math.max(0, Math.min(0.999999999, Number(beta)))
    : relativisticBetaFromKineticEnergyMeV(kineticEnergyMeV, restMassMeV);
  const nAtNm = typeof refractiveIndexFn === 'function'
    ? (nm) => Math.max(1.0, Number(refractiveIndexFn(nm)) || refractiveIndex)
    : () => Math.max(1.0, Number(refractiveIndex) || 1.0);

  const nMid = nAtNm(550);
  const thresholdBeta = 1 / nMid;

  // Integrate Frank-Tamm photon yield d^2N / (dx dλ) = (2π α z^2 / λ^2) * (1 - 1 / (β^2 n^2))
  const z2 = chargeZ * chargeZ;
  let photonsPerMeter = 0;
  let peakSpectrum = 0;
  const dLambdaNm = 5;
  const dLambdaM = dLambdaNm * 1e-9;
  const samples = [];
  for (let nm = lambdaMinNm; nm <= lambdaMaxNm; nm += dLambdaNm) {
    const n = nAtNm(nm);
    const sin2Theta = resolvedBeta > 0 ? 1 - 1 / (resolvedBeta * resolvedBeta * n * n) : -1;
    const lambdaM = nm * 1e-9;
    const dNdxdLambda = sin2Theta > 0
      ? ((2 * Math.PI * FINE_STRUCTURE_ALPHA * z2) / (lambdaM * lambdaM)) * sin2Theta
      : 0;
    if (dNdxdLambda > peakSpectrum) peakSpectrum = dNdxdLambda;
    photonsPerMeter += dNdxdLambda * dLambdaM;
    samples.push({ nm, dNdxdLambda });
  }

  const active = photonsPerMeter > 0 && peakSpectrum > 0;
  if (!active) {
    return Object.freeze({
      schema: ULG_CHERENKOV_CLOSURE_SCHEMA,
      active: false,
      beta: resolvedBeta,
      thresholdBeta,
      refractiveIndex550Nm: nMid,
      cherenkovAngleRad: 0,
      cherenkovAngleDeg: 0,
      photonsPerMeter: 0,
      srgb: Object.freeze([0, 0, 0]),
      closureBacked: true,
      validation: Object.freeze({
        scientificValidation: false,
        opticalValidation: false,
        blockers: Object.freeze(['below-cherenkov-threshold'])
      })
    });
  }

  const cosTheta = Math.min(1, Math.max(-1, 1 / (resolvedBeta * nMid)));
  const cherenkovAngleRad = Math.acos(cosTheta);
  const rgb = spectralResponseToSrgb((nm) => {
    const n = nAtNm(nm);
    const sin2 = 1 - 1 / (resolvedBeta * resolvedBeta * n * n);
    if (!(sin2 > 0)) return 0;
    const lambdaM = nm * 1e-9;
    const val = ((2 * Math.PI * FINE_STRUCTURE_ALPHA * z2) / (lambdaM * lambdaM)) * sin2;
    return Math.min(1, val / peakSpectrum);
  });

  return Object.freeze({
    schema: ULG_CHERENKOV_CLOSURE_SCHEMA,
    active: true,
    beta: resolvedBeta,
    thresholdBeta,
    refractiveIndex550Nm: nMid,
    cherenkovAngleRad,
    cherenkovAngleDeg: (cherenkovAngleRad * 180) / Math.PI,
    photonsPerMeter,
    srgb: Object.freeze([rgb.r, rgb.g, rgb.b]),
    closureBacked: true,
    derivation: 'frank-tamm-spectral-yield -> CIE-1931 -> sRGB',
    validation: Object.freeze({
      scientificValidation: false,
      opticalValidation: false,
      blockers: Object.freeze(['pending-optical-transport-benchmark'])
    })
  });
}
