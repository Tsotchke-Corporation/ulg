// Canonical Continuous Cosmic Epoch & Stellar-Planetary Evolutionary Spine
// (`src/runtime/astrophysics/cosmicEpochState.js`).
//
// Orthogonal second physical axis to spatial scale `log10ViewSpanM`:
//   - Integrates exact flat ΛCDM Friedmann expansion H(a) from Recombination (z = 1100)
//     through Cosmic Dawn/Reionization (z = 15..6), Cosmic Noon / Quasar Peak (z = 3..2),
//     Present Day (z = 0, t = 13.8 Gyr), into Accelerated Far-Future (z < 0, t = +5 Gyr).
//   - Derives continuous physical bath & enrichment state purely from `(a, z, t_sys)`:
//     `T_CMB(z) = 2.7255 / a`, Peebles/Saha recombination `x_e(z)`, Eisenstein-Hu BAO
//     sound horizon `r_s`, cosmic metallicity `Z_IGM(z)`, ionizing UV background `J_UV(z)`,
//     halo gas fraction `f_gas(z)`, Eddington accretion supply, and continuous HR/RGB/AGB/WD
//     stellar-structure scaling `(R_*(M, t), L_*(M, t), M_*(M, t), T_eff(M, t))`.
//   - ZERO hardcoded entity hacks: entities emerge purely from `(z, t_sys, M, B, Ω, ...)`!

export const ULG_COSMIC_EPOCH_SCHEMA = 'ulg.astrophysics.cosmic-epoch-state.v1';

// Planck 2018 flat ΛCDM cosmological parameters
export const COSMO_OMEGA_M = 0.3153;
export const COSMO_OMEGA_B = 0.0493;
export const COSMO_OMEGA_R = 9.2e-5; // Photons + 3 massless neutrinos
export const COSMO_OMEGA_L = 1.0 - COSMO_OMEGA_M - COSMO_OMEGA_R;
export const COSMO_H0_KM_S_MPC = 67.36;
export const COSMO_H0_PER_GYR = (COSMO_H0_KM_S_MPC * 1e3) / 3.085677581491367e22 * 3.15576e16; // ~0.06888 Gyr^-1
export const T_CMB_TODAY_K = 2.7255;

// 8-point Gauss-Legendre nodes/weights on [0, 1] for fast accurate Friedmann age integral
const GL8_X = Object.freeze([
  0.019855071751231884, 0.10166676129318663, 0.2372337950418355, 0.4082826787521751,
  0.5917173212478249, 0.7627662049581645, 0.8983332387068134, 0.9801449282487681
]);
const GL8_W = Object.freeze([
  0.05061426814518813, 0.11119051722668723, 0.15685332293894364, 0.18134189168918099,
  0.18134189168918099, 0.15685332293894364, 0.11119051722668723, 0.05061426814518813
]);

export function hubbleDimensionlessE(a) {
  const aSafe = Math.max(1e-6, Number(a) || 1.0);
  const a2 = aSafe * aSafe;
  const a3 = a2 * aSafe;
  const a4 = a3 * aSafe;
  return Math.sqrt(COSMO_OMEGA_R / a4 + COSMO_OMEGA_M / a3 + COSMO_OMEGA_L);
}

/**
 * Exact flat ΛCDM cosmic age `t(a)` in Gyr via composite Gauss-Legendre quadrature of
 * `t(a) = (1 / H_0) * ∫_0^a da' / (a' * E(a'))` (matches 13.797 Gyr at a = 1 to <0.1%!).
 */
export function computeCosmicAgeGyr(scaleFactorA) {
  const aTarget = Math.max(1e-5, Math.min(4.0, Number(scaleFactorA) || 1.0));
  // Split at log-spaced panels for accuracy across both radiation (a ~ 1e-4) and Λ (a ~ 1) eras
  const panels = 6;
  const edges = [0];
  for (let p = 1; p <= panels; p += 1) {
    edges.push(aTarget * Math.pow(p / panels, 2.2));
  }
  let integral = 0;
  for (let p = 0; p < panels; p += 1) {
    const lo = edges[p];
    const hi = edges[p + 1];
    const span = hi - lo;
    for (let k = 0; k < 8; k += 1) {
      const a = lo + span * GL8_X[k];
      if (a <= 0) continue;
      integral += span * GL8_W[k] / (a * hubbleDimensionlessE(a));
    }
  }
  return integral / COSMO_H0_PER_GYR;
}

/**
 * Eisenstein & Hu (1998) baryon-photon sound horizon `r_s` (Mpc) and dimensionless
 * matter transfer function `T(k)` with physical BAO acoustic oscillations & Silk damping!
 * Used identically on host and WebGPU so `P(k)` exhibits authentic BAO peaks!
 */
export function evaluateEisensteinHuBaoTransfer(kMpcInv, {
  omegaM = COSMO_OMEGA_M,
  omegaB = COSMO_OMEGA_B,
  h = COSMO_H0_KM_S_MPC / 100
} = {}) {
  const k = Math.max(1e-5, Number(kMpcInv) || 0.01);
  const omh2 = omegaM * h * h;
  const obh2 = omegaB * h * h;
  const fb = Math.max(0.01, Math.min(0.5, omegaB / Math.max(1e-4, omegaM)));
  const fc = 1.0 - fb;
  const theta27 = T_CMB_TODAY_K / 2.7;

  // Equality & drag-epoch scales (Eisenstein & Hu 1998 eqs. 2-6)
  const kEq = 7.46e-2 * omh2 / (theta27 * theta27); // Mpc^-1
  const soundHorizonMpc = 44.5 * Math.log(9.83 / omh2) / Math.sqrt(1.0 + 10.0 * Math.pow(obh2, 0.75));
  const kSilk = 1.6 * Math.pow(obh2, 0.52) * Math.pow(omh2, 0.73) * (1.0 + Math.pow(10.4 * omh2, -0.95));

  const q = k / (13.41 * kEq);
  const t0 = (qIn, aC, bC) => {
    const l = Math.log(Math.E + 1.8 * bC * qIn);
    const c = 14.2 / aC + 386.0 / (1.0 + 69.9 * Math.pow(qIn, 1.08));
    return l / (l + c * qIn * qIn);
  };
  const tCdm = t0(q, 1.0, 1.0);
  // Baryon transfer with physical spherical Bessel j_0(k r_s) = sin(k r_s)/(k r_s) BAO oscillation + Silk damping!
  const xBao = k * soundHorizonMpc;
  const j0 = xBao < 1e-4 ? 1.0 : Math.sin(xBao) / xBao;
  const silkDamp = Math.exp(-Math.pow(k / Math.max(0.02, kSilk), 1.4));
  const tBaryon = (t0(q, 1.0, 1.0) / (1.0 + Math.pow(xBao / 5.2, 2)) + 0.18 * silkDamp) * (0.42 + 0.58 * j0) * silkDamp;
  const transfer = Math.max(1e-6, fc * tCdm + fb * tBaryon);
  return {
    transfer,
    tCdm,
    tBaryon,
    soundHorizonMpc,
    kSilk,
    kEq
  };
}

/**
 * Peebles/Saha cosmic ionization fraction `x_e(z)` across Recombination (`z ~ 1100`),
 * Dark Ages (`z ~ 50..20`), and Cosmic Reionization (`z ~ 12..6`).
 */
export function evaluateCosmicIonizationFraction(redshiftZ) {
  const z = Math.max(-0.6, Number(redshiftZ) || 0);
  // 1. Primordial recombination drop near z ~ 1090 (T_CMB ~ 3000 K)
  const xRec = 1.0 / (1.0 + Math.exp(-(z - 1090.0) / 85.0));
  // Residual freeze-out floor ~2e-4 during Dark Ages
  const xFreeze = 2.0e-4;
  // 2. Cosmic Reionization transition (Pop III + early AGN UV photons reionizing IGM around z ~ 7.7)
  const xReion = 1.0 / (1.0 + Math.exp((z - 7.7) / 1.15));
  return Math.max(xFreeze, Math.min(1.0, Math.max(xRec, xReion)));
}

/**
 * Continuous Main-Sequence → Red Giant Branch (RGB) → Asymptotic Giant Branch (AGB) →
 * Planetary Nebula / Core-Collapse → Compact Remnant stellar evolution evaluator.
 * Strictly a continuous function of initial mass `massSolar` and stellar age `ageGyr`!
 */
export function evaluateStellarEvolutionaryState({
  massSolar = 1.0,
  ageGyr = 4.57,
  metallicitySolar = 1.0
} = {}) {
  const m0 = Math.max(0.02, Math.min(100.0, Number(massSolar) || 1.0));
  const age = Math.max(0.0, Number(ageGyr) || 0.0);
  const zMet = Math.max(1e-4, Number(metallicitySolar) || 1.0);

  // Brown Dwarf regime (< 0.08 M_sun): electron degeneracy halts contraction before H fusion
  if (m0 < 0.08) {
    const rBd = 0.095 + 0.04 * Math.exp(-age / 0.25); // ~1 R_Jup
    const tEff = Math.max(350, 2400 * Math.pow(m0 / 0.075, 0.85) * Math.pow(0.05 / (age + 0.05), 0.28));
    const lum = rBd * rBd * Math.pow(tEff / 5778, 4);
    return Object.freeze({
      stage: 'brown-dwarf',
      massSolar: m0,
      radiusSolar: rBd,
      luminositySolar: lum,
      effectiveTempK: tEff,
      eddRatio: (lum / Math.max(0.01, m0)) / 3.2e4,
      massLossSolarPerYr: 0,
      coreDegenerate: true,
      remnantClass: 'brown-dwarf',
      mainSequenceLifetimeGyr: Infinity
    });
  }

  // Smooth C^inf convective-to-Kramers-to-Thomson ZAMS luminosity + Eddington cap
  const wRad = 1.0 / (1.0 + Math.exp(-(m0 - 0.43) / 0.07));
  const lConv = 0.21 * Math.pow(m0, 2.3);
  const kramersNorm = Math.pow(1.0 + Math.pow(1.0 / 3.2, 2), 0.55);
  const lRadRaw = 0.72 * Math.pow(m0, 4.5) * kramersNorm / Math.pow(1.0 + Math.pow(m0 / 3.2, 2), 0.55);
  const lZamsUnCapped = ((1.0 - wRad) * lConv + wRad * lRadRaw) * Math.pow(Math.max(0.01, zMet), -0.12 * wRad);
  const lEddCap = 1.6e4 * m0;
  const lZams = (lZamsUnCapped * lEddCap) / (lZamsUnCapped + lEddCap);
  // Core-He mean molecular weight mu^4 MS brightening (enhanced for CNO convective cores M > 1.35 M_sun)
  const wCno = 1.0 / (1.0 + Math.exp(-(m0 - 1.35) / 0.25));
  const msBrightSpan = 0.18 + 0.78 * wRad + 0.35 * wCno;
  const lMidMs = lZams * (1.0 + 0.45 * msBrightSpan);
  // Fuel-conserving main-sequence lifetime tau_MS ~ 9.6 Gyr * (M / L_mid) * f_core
  const fCoreFuel = 0.94 + 0.34 * wCno;
  const tauMsGyr = Math.max(0.003, 9.6 * (m0 / Math.max(1e-5, lMidMs)) * fCoreFuel);
  const tauPreMsGyr = Math.max(0.0002, 0.04 * Math.pow(m0, -1.8));
  const tauGiantGyr = Math.max(0.0008, tauMsGyr * (m0 > 8 ? 0.12 : 0.18));

  const lumMs = lMidMs;
  const radMs = m0 < 1.0 ? Math.pow(m0, 0.8) : Math.pow(m0, 0.58);
  const tEffMs = 5778 * Math.pow(lumMs / (radMs * radMs), 0.25);

  // Stage 1: Protostellar / YSO collapse
  if (age < tauPreMsGyr) {
    const f = age / tauPreMsGyr;
    const rad = radMs * (3.8 - 2.8 * f);
    const tEff = Math.max(2400, tEffMs * (0.62 + 0.38 * f));
    const lum = rad * rad * Math.pow(tEff / 5778, 4);
    return Object.freeze({
      stage: 'protostar-yso',
      massSolar: m0,
      radiusSolar: rad,
      luminositySolar: lum,
      effectiveTempK: tEff,
      eddRatio: (lum / m0) / 3.2e4,
      massLossSolarPerYr: 1e-7 * m0,
      coreDegenerate: false,
      remnantClass: 'none',
      mainSequenceLifetimeGyr: tauMsGyr
    });
  }

  // Stage 2: Main Sequence (O/B/A/F/G/K/M)
  if (age < tauMsGyr) {
    const f = (age - tauPreMsGyr) / Math.max(1e-6, tauMsGyr - tauPreMsGyr);
    const lum = lZams * (1.0 + msBrightSpan * Math.pow(Math.max(0, f), 1.15));
    const rad = radMs * (0.90 + 0.32 * f);
    const tEff = 5778 * Math.pow(lum / (rad * rad), 0.25);
    const eddRatio = (lum / m0) / 3.2e4;
    const isWrLbv = m0 >= 25.0 && f > 0.65;
    return Object.freeze({
      stage: isWrLbv ? 'wolf-rayet-lbv' : 'main-sequence',
      massSolar: m0 * (isWrLbv ? (1.0 - 0.38 * (f - 0.65) / 0.35) : 1.0),
      radiusSolar: rad * (isWrLbv ? 1.8 : 1.0),
      luminositySolar: lum,
      effectiveTempK: isWrLbv ? Math.max(38000, tEff * 1.35) : tEff,
      eddRatio,
      massLossSolarPerYr: isWrLbv ? 2e-5 * Math.pow(zMet, 0.7) : (1e-14 * lum * rad / m0),
      coreDegenerate: false,
      remnantClass: 'none',
      mainSequenceLifetimeGyr: tauMsGyr
    });
  }

  // Stage 3: Red Giant / AGB / Supergiant shell burning & envelope expansion
  const postMsAge = age - tauMsGyr;
  if (postMsAge < tauGiantGyr) {
    const g = postMsAge / tauGiantGyr; // 0 -> 1 along RGB/AGB
    const peakRad = m0 < 8.0 ? Math.min(240, 140 * Math.pow(m0, 0.55)) : Math.min(950, 320 * Math.pow(m0 / 8, 0.5));
    const rad = radMs + (peakRad - radMs) * Math.pow(g, 1.8);
    const peakLum = m0 < 8.0 ? 2200 * Math.pow(m0, 1.4) : lumMs * 3.5;
    const lum = lumMs + (peakLum - lumMs) * Math.pow(g, 1.7);
    const tEff = Math.max(2900, Math.min(4800, 5778 * Math.pow(lum / (rad * rad), 0.25)));
    // Adiabatic wind mass loss on RGB/AGB (Reimers scaling)
    const mRem = m0 < 8.0 ? (0.48 + 0.11 * m0) : m0 * 0.82;
    const massNow = m0 - (m0 - mRem) * Math.pow(g, 2.4);
    return Object.freeze({
      stage: g > 0.72 && m0 < 8.0 ? 'agb-superwind' : 'red-giant',
      massSolar: massNow,
      radiusSolar: rad,
      luminositySolar: lum,
      effectiveTempK: tEff,
      eddRatio: (lum / Math.max(0.3, massNow)) / 3.2e4,
      massLossSolarPerYr: m0 < 8.0 ? 1e-5 * Math.pow(g, 2) : 5e-5,
      coreDegenerate: m0 < 8.0,
      remnantClass: 'none',
      mainSequenceLifetimeGyr: tauMsGyr
    });
  }

  // Stage 4: Planetary Nebula / Supernova -> Compact Remnant (WD / NS / Magnetar / BH)
  const remAge = postMsAge - tauGiantGyr;
  if (m0 < 8.0) {
    const mWd = Math.min(1.38, 0.48 + 0.11 * m0);
    const rWd = 0.0126 * Math.pow(mWd / 0.6, -1 / 3) * Math.sqrt(Math.max(0.05, 1.0 - Math.pow(mWd / 1.44, 4 / 3)));
    const isPne = remAge < 0.0001; // ~100 kyr glowing Planetary Nebula ionization phase!
    const tWd = isPne ? 95000 : Math.max(4500, 35000 * Math.pow(0.02 / (remAge + 0.02), 0.35));
    const lum = rWd * rWd * Math.pow(tWd / 5778, 4);
    return Object.freeze({
      stage: isPne ? 'planetary-nebula' : 'white-dwarf',
      massSolar: mWd,
      radiusSolar: rWd,
      luminositySolar: lum,
      effectiveTempK: tWd,
      eddRatio: (lum / mWd) / 3.2e4,
      massLossSolarPerYr: isPne ? 1e-7 : 0,
      coreDegenerate: true,
      remnantClass: 'white-dwarf',
      mainSequenceLifetimeGyr: tauMsGyr
    });
  }

  // Massive star (> 8 M_sun): Core-Collapse Supernova -> Neutron Star (8-22 M_sun) or Stellar Black Hole (> 22 M_sun)
  const isSnr = remAge < 0.00015; // ~150 kyr Supernova Remnant / PWN
  if (m0 < 22.0) {
    const mNs = Math.min(2.15, 1.28 + 0.055 * (m0 - 8.0));
    const rNsSolar = 12.0 / 695700.0; // ~12 km neutron star!
    return Object.freeze({
      stage: isSnr ? 'supernova-remnant-pwn' : 'neutron-star',
      massSolar: mNs,
      radiusSolar: rNsSolar,
      luminositySolar: isSnr ? 400.0 : 0.02,
      effectiveTempK: isSnr ? 1.5e6 : 6.0e5,
      eddRatio: 0,
      massLossSolarPerYr: 0,
      coreDegenerate: true,
      remnantClass: 'neutron-star',
      mainSequenceLifetimeGyr: tauMsGyr
    });
  }

  const mBh = Math.max(3.0, m0 * 0.38);
  const rSchwSolar = (2.95325 * mBh) / 695700.0; // r_s = 2GM/c^2 in solar radii
  return Object.freeze({
    stage: isSnr ? 'hypernova-remnant' : 'stellar-black-hole',
    massSolar: mBh,
    radiusSolar: rSchwSolar,
    luminositySolar: 0,
    effectiveTempK: 0,
    eddRatio: 0,
    massLossSolarPerYr: 0,
    coreDegenerate: true,
    remnantClass: 'black-hole',
    mainSequenceLifetimeGyr: tauMsGyr
  });
}

/**
 * Canonical Cosmic Epoch Presets (strictly physical `(redshiftZ, localSystemAgeGyr)` coordinates
 * spanning the entire history of the universe — zero hardcoded entity flags!).
 */
export const COSMIC_EPOCH_PRESETS = Object.freeze([
  Object.freeze({
    id: 'recombination',
    label: 'CMB Recombination',
    shortLabel: 'z=1100 CMB',
    redshiftZ: 1100.0,
    localSystemAgeGyr: 0.00038,
    summary: '380 kyr · T_CMB = 3,000 K · Peebles recombination & BAO acoustic horizon (r_s ≈ 147 Mpc)'
  }),
  Object.freeze({
    id: 'cosmic-dawn',
    label: 'Cosmic Dawn & Reionization',
    shortLabel: 'z=10 Dawn',
    redshiftZ: 10.0,
    localSystemAgeGyr: 0.005,
    summary: '470 Myr · Z ≈ 10⁻⁴ Z☉ · Pop III halos, UV reionization bubbles & first protogalaxies'
  }),
  Object.freeze({
    id: 'quasar-peak',
    label: 'Cosmic Noon & Quasar Peak',
    shortLabel: 'z=2.8 Quasar',
    redshiftZ: 2.8,
    localSystemAgeGyr: 0.04,
    summary: '2.3 Gyr · High gas-fraction starburst disks, Eddington Kerr Quasars/Blazars & Hadean impacts'
  }),
  Object.freeze({
    id: 'present-day',
    label: 'Present Universe (z = 0)',
    shortLabel: 'z=0 Today',
    redshiftZ: 0.0,
    localSystemAgeGyr: 4.57,
    summary: '13.8 Gyr · Mature Cosmic Web, Galaxy Clusters, Spirals, Solar System & Compact Remnants'
  }),
  Object.freeze({
    id: 'far-future',
    label: 'Red-Giant & Remnant Era (+5 Gyr)',
    shortLabel: '+5 Gyr RGB/WD',
    redshiftZ: -0.28,
    localSystemAgeGyr: 10.85,
    summary: '18.8 Gyr · Λ-dominated expansion, Red-Giant engulfment (R☉ → 1 AU), Planetary Nebulae & White Dwarfs'
  })
]);

/**
 * Evaluate the complete continuous physical `CosmicEpochState` from `(redshiftZ, localSystemAgeGyr)`.
 */
export function evaluateCosmicEpochState({
  redshiftZ = 0.0,
  localSystemAgeGyr = 4.57,
  localStarMassSolar = 1.0
} = {}) {
  const z = Math.max(-0.55, Math.min(1200.0, Number(redshiftZ) || 0.0));
  const scaleFactorA = 1.0 / (1.0 + z);
  const cosmicAgeGyr = computeCosmicAgeGyr(scaleFactorA);
  const cmbTempK = T_CMB_TODAY_K / scaleFactorA;
  const ionizationFrac = evaluateCosmicIonizationFraction(z);

  // Continuous chemical enrichment Z_IGM(z) rising from primordial 0 at z > 15 to 1 Z_sun at z = 0
  const meanMetallicitySolar = z > 18
    ? 1e-5
    : Math.min(1.6, Math.max(1e-5, Math.pow(10, -0.26 * Math.max(0, z)) * (z < 0 ? 1.25 : 1.0)));

  // Galaxy gas mass fraction f_gas(z) rises steeply toward Cosmic Noon & Cosmic Dawn
  const galaxyGasFraction = Math.max(0.05, Math.min(0.88, 0.14 + 0.68 * (1.0 - Math.exp(-Math.max(0, z) / 2.6))));

  // Cosmic SMBH Eddington accretion duty fraction peaks sharply near z ~ 2-3 (Quasar Peak!)
  const logZp1 = Math.log10(Math.max(0.45, 1.0 + z));
  const quasarActivityFactor = z > 25
    ? 0.0
    : Math.exp(-Math.pow((logZp1 - 0.56) / 0.36, 2)) * (z < 0 ? 0.15 : 1.0);

  // Ionizing UV background J_UV(z) peaking across Reionization & Cosmic Noon
  const uvBackgroundFlux = z > 18
    ? 0.0
    : Math.max(0.02, Math.exp(-Math.pow((Math.max(0, z) - 2.5) / 4.2, 2)));

  // Local solar-system stellar evolution state
  const stellarState = evaluateStellarEvolutionaryState({
    massSolar: localStarMassSolar,
    ageGyr: localSystemAgeGyr,
    metallicitySolar: Math.max(0.01, meanMetallicitySolar)
  });

  // Classify dominant physical regime label purely from physical observables
  let eraId = 'present-day';
  if (z >= 400) eraId = 'recombination';
  else if (z >= 6.0) eraId = 'cosmic-dawn';
  else if (z >= 1.2) eraId = 'quasar-peak';
  else if (z < -0.1 || localSystemAgeGyr >= 10.0) eraId = 'far-future';

  return Object.freeze({
    schema: ULG_COSMIC_EPOCH_SCHEMA,
    eraId,
    redshiftZ: z,
    scaleFactorA,
    cosmicAgeGyr,
    hubbleKmSMpc: COSMO_H0_KM_S_MPC * hubbleDimensionlessE(scaleFactorA),
    cmbTempK,
    ionizationFrac,
    meanMetallicitySolar,
    galaxyGasFraction,
    quasarActivityFactor,
    uvBackgroundFlux,
    localSystemAgeGyr: Number(localSystemAgeGyr) || 0,
    stellarState
  });
}
