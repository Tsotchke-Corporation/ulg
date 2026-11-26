// First-Principles Causal Top-Down Astrophysical Cascade Generator
// (`src/runtime/astrophysics/causalNebularSystemGenerator.js`).
//
// Strictly Star Spec v0.4 & ULG General-Law Thesis compliant:
//   - ZERO hardcoded "Earth" in every star system!
//   - Cosmic Epoch `(z, t_cosmic, rho_env)` -> Galaxy Morphology, Gas Fraction,
//     Star Formation History, & Radial/Vertical Metallicity Gradient `[Fe/H](R, z)` & `C/O`.
//   - Galactic Location `(R_gal, |z_gal|, popTag, galaxyEnv)` -> Kroupa / Pop-III IMF
//     Stellar Mass, Age, Evolutionary Stage (`evaluateStellarEvolutionaryState`), Spectral
//     Class (O/B/A/F/G/K/M, Pop III, RGB, WD, NS), & Mass-Dependent Multiplicity
//     (Single, Close P-Type Binary, Wide S-Type Binary, Hierarchical `(A+B)+C` Trinary).
//   - Protoplanetary Nebular Theory (`[Fe/H]`, `C/O`, `Sigma_solid(r)`, `r_sil`, `r_snow`,
//     `r_CO`, Kopparapu HZ, Holman-Wiegert binary stability bounds) -> Emergent Planetary
//     Systems (Lava Worlds, Iron Cores, Carbon Worlds, Hot Jupiters, Super-Earths,
//     Ocean Worlds, Gas/Ice Giants with rings & moons, and "Earth-like" habitable worlds
//     ONLY when nebular metallicity, stellar flux, orbital stability, & volatiles permit!).
//   - Every generated body carries exact physical & elemental descriptors (`coreZ`, `mantleZ`,
//     `surfZ`, `centralP`, `surfacePressurePa`, `tempK`, `volatileMassFrac`, `particulateMassFrac`)
//     that cascade all the way down through L4 Interior/Weather/Surface -> L5 MD -> L6 Atom -> L7 Nucleus!

import {
  evaluateCosmicEpochState,
  evaluateStellarEvolutionaryState
} from './cosmicEpochState.js';
import { EARTH_MASS_SOLAR } from './solarSystemNBodyGpu.js';

export const ULG_CAUSAL_NEBULAR_CASCADE_SCHEMA = 'ulg.astrophysics.causal-nebular-cascade.v1';

const SYSTEM_PREFIXES = Object.freeze([
  'Vela', 'Kepler', 'Cygnus', 'Lyra', 'Carina', 'Draco', 'Perseus',
  'Norma', 'Scutum', 'Centauri', 'Aurelia', 'Eridani', 'Pavonis', 'Ceti', 'Tauri', 'Hydrae'
]);
const PLANET_LETTERS = 'bcdefghijklm';
const ROMAN = Object.freeze(['I', 'II', 'III', 'IV', 'V', 'VI']);

function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashCoords(a, b, c, seed = 1) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  const mix = (v) => {
    const q = Math.round(Number(v) * 1000) | 0;
    h = Math.imul(h ^ q, 0x85ebca6b) >>> 0;
    h = ((h ^ (h >>> 13)) >>> 0);
  };
  mix(a); mix(b); mix(c);
  return h >>> 0;
}

/**
 * Physical Planck blackbody RGB approximation from effective stellar temperature `T_eff (K)`.
 */
export function blackbodyStarColors(tempK) {
  const t = Math.max(2200, Math.min(55000, Number(tempK) || 5778));
  if (t >= 26000) return { color0: [0.62, 0.78, 1.0], color1: [0.36, 0.56, 1.0], spectral: 'O' };
  if (t >= 10500) return { color0: [0.74, 0.86, 1.0], color1: [0.48, 0.68, 1.0], spectral: 'B' };
  if (t >= 7400)  return { color0: [0.88, 0.93, 1.0], color1: [0.66, 0.78, 0.98], spectral: 'A' };
  if (t >= 6000)  return { color0: [1.0, 0.97, 0.88], color1: [0.95, 0.84, 0.60], spectral: 'F' };
  if (t >= 5200)  return { color0: [1.0, 0.93, 0.74], color1: [1.0, 0.60, 0.20], spectral: 'G' };
  if (t >= 3750)  return { color0: [1.0, 0.76, 0.46], color1: [0.94, 0.42, 0.14], spectral: 'K' };
  return { color0: [1.0, 0.50, 0.28], color1: [0.78, 0.18, 0.08], spectral: 'M' };
}

function classifySpectralCode(evo, isPopIII = false) {
  if (evo.stage === 'white-dwarf' || evo.stage === 'planetary-nebula') return 'DA-WD';
  if (evo.stage === 'neutron-star' || evo.stage === 'supernova-remnant-pwn') return 'NS';
  if (evo.stage === 'stellar-black-hole' || evo.stage === 'hypernova-remnant') return 'BH';
  if (evo.stage === 'brown-dwarf') return evo.effectiveTempK > 1400 ? 'L-BD' : 'T-BD';
  if (evo.stage === 'red-giant' || evo.stage === 'agb-superwind') return evo.effectiveTempK < 3600 ? 'M2III' : 'K2III';
  const bb = blackbodyStarColors(evo.effectiveTempK);
  const sub = Math.max(0, Math.min(9, Math.round(9 - ((evo.effectiveTempK % 1200) / 1200) * 9)));
  return isPopIII ? `PopIII-${bb.spectral}` : `${bb.spectral}${sub}V`;
}

/**
 * Holman & Wiegert (1999) dynamical orbital stability boundaries for binary stars!
 *   - Circumbinary (P-type): stable for `a_p > rCritP`
 *   - Circumstellar (S-type): stable for `a_p < rCritS`
 */
export function evaluateHolmanWiegertLimits(aBinAu, eBin, massRatioMu) {
  const a = Math.max(1e-4, Number(aBinAu) || 0.2);
  const e = Math.max(0, Math.min(0.65, Number(eBin) || 0.05));
  const mu = Math.max(0.05, Math.min(0.5, Number(massRatioMu) || 0.35));
  const e2 = e * e;
  const mu2 = mu * mu;
  const rCritP = a * (1.60 + 5.10 * e - 2.22 * e2 + 4.12 * mu - 4.27 * e * mu - 5.09 * mu2 + 4.61 * e2 * mu2);
  const rCritS = a * (0.464 - 0.380 * mu - 0.631 * e + 0.586 * mu * e + 0.150 * e2 - 0.198 * mu * e2);
  return {
    rCritPAu: Math.max(a * 1.85, rCritP),
    rCritSAu: Math.max(0.02, rCritS)
  };
}

/**
 * STAGE 1 (L0 -> L1): Derive Galactic Morphology, Gas Fraction, Enrichment, & Star Formation
 * strictly from Cosmic Epoch `(z, t_cosmic)` and Comoving Cosmic-Web Environment `(posMpc, overdensity)`!
 */
export function deriveGalaxyEnvironmentFromCosmicContext({
  cosmicEpoch = null,
  regionPosMpc = [0, 0, 0],
  localOverdensity = 1.0,
  seed = 20261125
} = {}) {
  const ep = cosmicEpoch || evaluateCosmicEpochState({ redshiftZ: 0.0 });
  const z = Number(ep.redshiftZ) || 0;
  const ageCosmicGyr = Math.max(0.05, Number(ep.cosmicAgeGyr) || 13.8);
  const delta = Math.max(0.15, Math.min(8.0, Number(localOverdensity) || 1.0));
  const h = hashCoords(regionPosMpc[0] || 0, regionPosMpc[1] || 0, regionPosMpc[2] || 0, seed ^ 0x101);
  const rand = mulberry32(h);

  // Morphology emerges from redshift + cosmic-web density (morphology-density relation!)
  let morphology = 'disk';
  let morphologyLabel = 'Grand-Design Spiral';
  if (z >= 4.5) {
    morphology = 'proto';
    morphologyLabel = 'Primordial High-z Protogalaxy';
  } else if (z >= 1.4) {
    morphology = delta > 2.4 ? 'binary' : 'proto';
    morphologyLabel = morphology === 'binary' ? 'Cosmic-Noon Starburst Merger' : 'High-z Clumpy Starburst Disk';
  } else if (z < -0.15) {
    // Far-future accelerated Λ-era: depleted gas, mostly red ellipticals & aging spirals
    morphology = delta > 1.3 ? 'sphere' : 'barred';
    morphologyLabel = morphology === 'sphere' ? 'Evolved Giant Elliptical' : 'Aging Barred Spiral';
  } else if (delta > 2.8) {
    morphology = rand() < 0.72 ? 'sphere' : 'binary';
    morphologyLabel = morphology === 'sphere' ? 'Cluster-Core Giant Elliptical' : 'Interacting Major Merger Pair';
  } else if (delta < 0.48) {
    morphology = rand() < 0.55 ? 'dwarf-stream' : 'globular';
    morphologyLabel = morphology === 'dwarf-stream' ? 'Void-Edge Dwarf & Tidal Stream' : 'Metal-Poor Globular Cluster';
  } else {
    morphology = rand() < 0.42 ? 'barred' : 'disk';
    morphologyLabel = morphology === 'barred' ? 'Barred Spiral (SBb)' : 'Grand-Design Spiral (Sc/Sb)';
  }

  // Mass-metallicity & redshift chemical enrichment relation (Maiolino+ 2008 / Zahid+ 2014)
  const baseZSolar = Math.max(1e-4, Number(ep.meanMetallicitySolar) || 1.0);
  const densityBoost = Math.pow(delta, 0.28);
  const morphFactor = morphology === 'globular' ? 0.08 : (morphology === 'dwarf-stream' ? 0.35 : (morphology === 'sphere' ? 1.45 : 1.0));
  const meanMetallicitySolar = Math.max(1e-4, Math.min(3.2, baseZSolar * densityBoost * morphFactor));
  const baseFeH = Math.log10(meanMetallicitySolar);

  // Gas fraction f_gas falls with cosmic time and cluster quenching
  const baseGas = Number(ep.galaxyGasFraction ?? ep.haloGasFraction) || 0.16;
  const gasFraction = Math.max(
    0.01,
    Math.min(0.88, baseGas * (morphology === 'sphere' ? 0.22 : (morphology === 'globular' ? 0.05 : 1.0)))
  );
  // Galactic mean C/O ratio rises slowly with AGB carbon enrichment at late epochs
  const baseCO = Math.max(0.32, Math.min(0.88, 0.38 + 0.18 * Math.min(1.4, meanMetallicitySolar) + (rand() - 0.5) * 0.12));

  return Object.freeze({
    schema: ULG_CAUSAL_NEBULAR_CASCADE_SCHEMA,
    cosmicEraId: ep.eraId || 'present-day',
    redshiftZ: z,
    cosmicAgeGyr: ageCosmicGyr,
    localOverdensity: delta,
    regionPosMpc: Object.freeze([regionPosMpc[0] || 0, regionPosMpc[1] || 0, regionPosMpc[2] || 0]),
    morphology,
    morphologyLabel,
    meanMetallicitySolar,
    baseFeH,
    baseCO,
    gasFraction,
    isPrimordialPopIII: z >= 7.5 || meanMetallicitySolar < 0.004,
    seed: h
  });
}

/**
 * Sample a star mass (M_sun) from Kroupa (2001) broken power-law IMF or top-heavy Pop III IMF.
 */
function sampleImfMassSolar(rand, { isPopIII = false, isYoungArm = false, isAncient = false } = {}) {
  const u = rand();
  if (isPopIII) {
    // Primordial H2-cooled Pop III top-heavy IMF: 5..55 M_sun!
    return 5.0 * Math.pow(11.0, Math.pow(u, 0.72));
  }
  if (isYoungArm) {
    // Young H II star-forming spiral-arm knot: boosted OB/A/F stars alongside G/K/M
    if (u < 0.32) return 0.18 + rand() * 0.35;         // M
    if (u < 0.52) return 0.53 + rand() * 0.32;         // K
    if (u < 0.70) return 0.85 + rand() * 0.35;         // G/F
    if (u < 0.86) return 1.20 + rand() * 1.40;         // F/A
    return 2.6 + Math.pow(rand(), 1.8) * 18.0;         // B/O massive stars!
  }
  if (isAncient) {
    // Ancient bulge / elliptical / globular: mostly K/M/G + evolved progenitors (1.1-2.8 M_sun -> RGB/WD!)
    if (u < 0.48) return 0.14 + rand() * 0.36;         // M-dwarf
    if (u < 0.74) return 0.50 + rand() * 0.34;         // K-dwarf
    if (u < 0.88) return 0.84 + rand() * 0.24;         // G-dwarf
    return 1.08 + Math.pow(rand(), 1.4) * 2.2;         // Evolved RGB / White Dwarf progenitor!
  }
  // Standard Milky-Way Disk Kroupa IMF (rich realistic stellar variation across M/K/G/F/A/B!)
  if (u < 0.44) return 0.12 + rand() * 0.38;           // M-dwarf (~44% of luminous systems)
  if (u < 0.68) return 0.50 + rand() * 0.32;           // K-dwarf (~24%)
  if (u < 0.84) return 0.82 + rand() * 0.28;           // G-dwarf (~16%)
  if (u < 0.93) return 1.10 + rand() * 0.45;           // F-star  (~9%)
  if (u < 0.98) return 1.55 + rand() * 1.15;           // A-star  (~5%)
  return 2.7 + Math.pow(rand(), 1.6) * 8.5;            // B-star  (~2%)
}

/**
 * STAGE 2 (L1 -> L2/L3): Derive a Complete Local Star System (Single, Binary, or Trinary!)
 * and Parent Molecular Nebula Composition from Galactic Position `(r, |z|, popTag)`!
 */
export function deriveStarSystemFromGalacticLocation({
  cosmicEpoch = null,
  galaxyEnv = null,
  starPosGal = [4.8, 0.04, 2.1],
  popTag = 0.48,
  starIndex = 0,
  seed = 20261125,
  forceMultiplicity = null
} = {}) {
  const ep = cosmicEpoch || evaluateCosmicEpochState({ redshiftZ: 0.0 });
  const gEnv = galaxyEnv || deriveGalaxyEnvironmentFromCosmicContext({ cosmicEpoch: ep, seed });
  const rSim = Math.hypot(starPosGal[0] || 0, starPosGal[2] || 0);
  const zAbsSim = Math.abs(starPosGal[1] || 0);
  // Galactic coordinate mapping: 1 sim unit ~ 1.65 kpc (Orion Spur at rSim ~ 5.2 -> ~8.5 kpc!)
  const rKpc = Math.max(0.2, rSim * 1.65);
  const zKpc = zAbsSim * 1.65;
  const h = hashCoords(starPosGal[0] || 0, starPosGal[1] || 0, starPosGal[2] || 0, (seed ^ ((starIndex + 1) * 2654435761)) >>> 0);
  const rand = mulberry32(h);

  // Radial & vertical galactic metallicity gradient:
  //   [Fe/H](R, |z|) = [Fe/H]_0 + 0.24 - 0.068 * (R_kpc - 4.5) - 0.35 * min(1.5, z_kpc)
  const isBulge = rKpc < 2.6 || gEnv.morphology === 'sphere';
  const isHalo = zKpc > 1.4 || gEnv.morphology === 'globular' || gEnv.morphology === 'dwarf-stream';
  const isYoungArm = popTag >= 0.76 && !isBulge && !isHalo && gEnv.gasFraction > 0.08;
  const isAncient = isBulge || isHalo || gEnv.redshiftZ < -0.15;

  const radialGrad = -0.068 * (rKpc - 8.2);
  const vertGrad = -0.32 * Math.min(1.8, zKpc);
  const armBoost = isYoungArm ? 0.14 : 0.0;
  const scatterFeH = (rand() - 0.5) * 0.24;
  let feH = gEnv.baseFeH + radialGrad + vertGrad + armBoost + scatterFeH;
  if (gEnv.isPrimordialPopIII) feH = Math.min(-2.4, feH - 1.2);
  feH = Math.max(-4.0, Math.min(0.55, feH));
  const metallicitySolar = Math.pow(10, feH);

  // Local nebular C/O ratio: elevated in metal-rich inner bulge/bars -> enables Carbon Worlds!
  const cToO = Math.max(
    0.25,
    Math.min(1.08, gEnv.baseCO + (isBulge ? 0.22 : 0) + (feH * 0.22) + (rand() - 0.5) * 0.26)
  );
  const alphaOverFe = isHalo || gEnv.redshiftZ > 1.5 ? 0.38 : (isBulge ? 0.22 : 0.04);

  // System age bounded strictly by universe age at this cosmic epoch!
  const maxAgeGyr = Math.max(0.05, gEnv.cosmicAgeGyr - 0.25);
  let systemAgeGyr;
  if (gEnv.isPrimordialPopIII) {
    systemAgeGyr = Math.min(maxAgeGyr, 0.002 + rand() * 0.015);
  } else if (isYoungArm) {
    systemAgeGyr = Math.min(maxAgeGyr, 0.015 + rand() * 0.35);
  } else if (isAncient) {
    systemAgeGyr = Math.min(maxAgeGyr, Math.max(0.4, maxAgeGyr * (0.58 + rand() * 0.34)));
  } else {
    systemAgeGyr = Math.min(maxAgeGyr, Math.max(0.2, (0.6 + rand() * 8.6) * Math.min(1.0, maxAgeGyr / 10.0)));
  }

  // Sample primary stellar mass from physically-grounded IMF
  const mPrimary0 = sampleImfMassSolar(rand, {
    isPopIII: gEnv.isPrimordialPopIII,
    isYoungArm,
    isAncient
  });

  // Mass-dependent multiplicity (Duchêne & Kraus 2013):
  //   M < 0.5: 73% single / 23% binary / 4% trinary
  //   0.5..1.3: 54% single / 34% binary / 12% trinary
  //   M >= 1.3: 28% single / 46% binary / 26% trinary
  let multiplicity = 1;
  if (forceMultiplicity === 1 || forceMultiplicity === 2 || forceMultiplicity === 3) {
    multiplicity = forceMultiplicity;
  } else {
    const pMulti = rand();
    if (mPrimary0 < 0.5) {
      multiplicity = pMulti < 0.73 ? 1 : (pMulti < 0.96 ? 2 : 3);
    } else if (mPrimary0 < 1.3) {
      multiplicity = pMulti < 0.54 ? 1 : (pMulti < 0.88 ? 2 : 3);
    } else {
      multiplicity = pMulti < 0.28 ? 1 : (pMulti < 0.74 ? 2 : 3);
    }
  }

  // Build component star masses (mass ratio q = M2/M1 drawn from flat-to-twin distribution)
  const initMasses = [mPrimary0];
  if (multiplicity >= 2) {
    const q2 = 0.28 + 0.68 * Math.pow(rand(), 0.75);
    initMasses.push(Math.max(0.08, mPrimary0 * q2));
  }
  if (multiplicity === 3) {
    const q3 = 0.22 + 0.58 * Math.pow(rand(), 0.9);
    initMasses.push(Math.max(0.08, mPrimary0 * q3));
  }

  const prefix = SYSTEM_PREFIXES[h % SYSTEM_PREFIXES.length];
  const catNum = 100 + ((h >>> 5) % 899);
  const systemName = `${prefix}-${catNum}`;
  const starLetters = ['A', 'B', 'C'];

  const stars = initMasses.map((m0, idx) => {
    const evo = evaluateStellarEvolutionaryState({
      massSolar: m0,
      ageGyr: systemAgeGyr,
      metallicitySolar
    });
    const bb = blackbodyStarColors(evo.effectiveTempK);
    const specCode = classifySpectralCode(evo, gEnv.isPrimordialPopIII);
    const isRemnant = evo.remnantClass !== 'none';
    // Clamp visual rendering radius for ultra-compact NS/BH so it stays inspectable while retaining true physics metadata
    const radiusKm = Math.max(12, evo.radiusSolar * 695700);
    const zPct = Math.min(8.0, 1.42 * metallicitySolar);
    const hePct = Math.min(34.0, 24.8 + 1.8 * metallicitySolar);
    const hPct = Math.max(60.0, 100.0 - hePct - zPct);
    const compStr = evo.stage === 'white-dwarf'
      ? 'Degenerate C/O Core · Thin H/He Envelope'
      : (evo.stage === 'neutron-star'
        ? 'Superfluid Neutron Interior · Iron Crust'
        : (evo.stage === 'stellar-black-hole'
          ? 'Relativistic Kerr Event Horizon'
          : `H ${hPct.toFixed(1)}% · He ${hePct.toFixed(1)}% · Metals ${zPct.toFixed(2)}% ([Fe/H]=${feH >= 0 ? '+' : ''}${feH.toFixed(2)})`));
    return Object.freeze({
      component: starLetters[idx],
      name: multiplicity > 1 ? `${systemName} ${starLetters[idx]} (${specCode})` : `${systemName} (${specCode})`,
      spectralCode: specCode,
      stage: evo.stage,
      remnantClass: evo.remnantClass,
      initialMassSolar: m0,
      massSolar: evo.massSolar,
      radiusSolar: evo.radiusSolar,
      radiusKm,
      luminositySolar: Math.max(1e-4, evo.luminositySolar),
      effectiveTempK: Math.max(1200, evo.effectiveTempK || 5778),
      color0: evo.stage === 'white-dwarf' ? [0.80, 0.94, 1.0] : (evo.stage === 'neutron-star' ? [0.68, 0.88, 1.0] : bb.color0),
      color1: evo.stage === 'white-dwarf' ? [0.46, 0.72, 1.0] : (evo.stage === 'neutron-star' ? [0.76, 0.36, 1.0] : bb.color1),
      isRemnant,
      composition: compStr
    });
  });

  // Binary / Trinary orbital architecture!
  //   - Multiplicity 2: 55% close P-type circumbinary (`aBin = 0.10..0.34 AU`), 45% wide S-type binary (`aBin = 14..28 AU`)
  //   - Multiplicity 3: hierarchical `(A + B) + C` (`aInner = 0.10..0.28 AU`, `aOuter = 16..30 AU`)
  let architecture = 'single';
  let binaryPair = null;
  let outerCompanion = null;
  if (multiplicity === 2) {
    const isClose = rand() < 0.58;
    architecture = isClose ? 'binary-p-type' : 'binary-s-type';
    const minSep = Math.max(0.08, (stars[0].radiusSolar + stars[1].radiusSolar) * 0.00465 * 4.5);
    const aBinAu = isClose
      ? Math.max(minSep, 0.11 + rand() * 0.24)
      : Math.max(minSep * 4.0, 14.5 + rand() * 14.0);
    const eBin = isClose ? (0.02 + rand() * 0.14) : (0.06 + rand() * 0.22);
    binaryPair = Object.freeze({
      aAu: aBinAu,
      e: eBin,
      incDeg: (rand() - 0.5) * 4.5,
      omDeg: rand() * 360,
      wDeg: rand() * 360,
      m0Deg: rand() * 360
    });
  } else if (multiplicity === 3) {
    architecture = 'hierarchical-trinary';
    const minSep = Math.max(0.08, (stars[0].radiusSolar + stars[1].radiusSolar) * 0.00465 * 4.5);
    binaryPair = Object.freeze({
      aAu: Math.max(minSep, 0.10 + rand() * 0.22),
      e: 0.02 + rand() * 0.12,
      incDeg: (rand() - 0.5) * 3.0,
      omDeg: rand() * 360,
      wDeg: rand() * 360,
      m0Deg: rand() * 360
    });
    outerCompanion = Object.freeze({
      aAu: 16.5 + rand() * 13.5,
      e: 0.05 + rand() * 0.18,
      incDeg: (rand() - 0.5) * 14.0,
      omDeg: rand() * 360,
      wDeg: rand() * 360,
      m0Deg: rand() * 360
    });
  }

  // Nebular chemistry & solid inventory (direct physical inputs for planetary synthesis!)
  const dustToGasRatio = Math.max(1e-6, 0.012 * metallicitySolar);
  const nebulaEnv = Object.freeze({
    feH,
    metallicitySolar,
    cToO,
    alphaOverFe,
    dustToGasRatio,
    carbonRich: cToO >= 0.80,
    solidDiskMassEarth: Math.max(0.0, 48.0 * metallicitySolar * Math.pow(Math.max(0.15, mPrimary0), 0.85)),
    volatileInventory: Math.max(0.0, (1.15 - Math.max(0, cToO - 0.55) * 1.1) * Math.min(2.2, metallicitySolar + 0.12)),
    nebulaSummary: `[Fe/H]=${feH >= 0 ? '+' : ''}${feH.toFixed(2)} · C/O=${cToO.toFixed(2)} · Dust/Gas=${(dustToGasRatio * 100).toFixed(3)}%${cToO >= 0.80 ? ' (Carbon-Rich)' : ''}`
  });

  const galacticRegion = isBulge
    ? 'Galactic Bulge'
    : (isHalo ? 'Stellar Halo' : (isYoungArm ? 'Spiral-Arm H II Nursery' : 'Galactic Disk'));

  return Object.freeze({
    schema: ULG_CAUSAL_NEBULAR_CASCADE_SCHEMA,
    systemId: `${prefix.toLowerCase()}-${catNum}`,
    systemName,
    galacticRegion,
    rKpc: Number(rKpc.toFixed(2)),
    zKpc: Number(zKpc.toFixed(2)),
    systemAgeGyr: Number(systemAgeGyr.toFixed(2)),
    multiplicity,
    architecture,
    stars: Object.freeze(stars),
    binaryPair,
    outerCompanion,
    nebulaEnv,
    galaxyEnv: gEnv,
    seed: h
  });
}

/**
 * STAGE 3 (Nebular Theory -> Planetary & Moon Catalog):
 * Synthesize a physically self-consistent planetary & satellite catalog from a star system
 * and its parent nebula (`[Fe/H]`, `C/O`, `r_sil`, `r_snow`, `r_CO`, Holman-Wiegert limits).
 *
 * Output entries use the exact `REAL_SOLAR_SYSTEM_CATALOG` schema + multi-star metadata
 * (`isStar`, `binaryOrbitParent` / `parent`) so `solarSystemNBodyGpu.js` integrates 1, 2,
 * or 3 stars + all planets, moons, and asteroid belts natively on WebGPU `f32x2`!
 */
export function synthesizeNebularPlanetarySystem(starSystem, { seedOverride = null } = {}) {
  const sys = starSystem || deriveStarSystemFromGalacticLocation();
  const seed = ((seedOverride ?? sys.seed) ^ 0x501a7) >>> 0;
  const rand = mulberry32(seed);
  const { stars, multiplicity, architecture, binaryPair, outerCompanion, nebulaEnv } = sys;

  // 1. Add host Star(s) first (`index 0..multiplicity-1`)
  const catalog = [];
  for (let i = 0; i < stars.length; i += 1) {
    const st = stars[i];
    const spec = {
      id: `star-${i}`,
      name: st.name,
      subtitle: `${st.stage.replace(/-/g, ' ')} · ${st.massSolar.toFixed(2)} M☉ · T=${Math.round(st.effectiveTempK).toLocaleString()} K`,
      isStar: true,
      starIndex: i,
      parent: -1,
      kind: st.stage === 'stellar-black-hole' ? 5 : 0,
      massSolar: st.massSolar,
      radiusKm: st.radiusKm,
      luminositySolar: st.luminositySolar,
      aAu: 0,
      e: 0,
      incDeg: 0,
      omDeg: 0,
      wDeg: 0,
      m0Deg: 0,
      color0: [...st.color0],
      color1: [...st.color1],
      atm: 0.0,
      surfacePressurePa: 0,
      tempK: Math.round(st.effectiveTempK),
      centralP: st.stage === 'neutron-star' ? 1e34 : (st.stage === 'white-dwarf' ? 1e22 : 2.5e16 * Math.pow(st.massSolar, 1.4)),
      coreZ: st.stage === 'white-dwarf' ? 6 : (st.stage === 'neutron-star' ? 26 : 1),
      mantleZ: st.stage === 'white-dwarf' ? 8 : 2,
      surfZ: 1,
      composition: st.composition,
      stage: st.stage,
      spectralCode: st.spectralCode
    };
    if (i === 1 && binaryPair) {
      spec.parent = 0;
      spec.orbitRole = 'binary-companion';
      spec.aAu = binaryPair.aAu;
      spec.e = binaryPair.e;
      spec.incDeg = binaryPair.incDeg;
      spec.omDeg = binaryPair.omDeg;
      spec.wDeg = binaryPair.wDeg;
      spec.m0Deg = binaryPair.m0Deg;
    } else if (i === 2 && outerCompanion) {
      spec.parent = -2; // Orbits barycenter of inner binary `(star 0 + star 1)`!
      spec.orbitRole = 'trinary-outer';
      spec.aAu = outerCompanion.aAu;
      spec.e = outerCompanion.e;
      spec.incDeg = outerCompanion.incDeg;
      spec.omDeg = outerCompanion.omDeg;
      spec.wDeg = outerCompanion.wDeg;
      spec.m0Deg = outerCompanion.m0Deg;
    }
    catalog.push(spec);
  }

  // Effective central host luminosity & mass for planet-forming zone
  const isCircumbinaryHost = architecture === 'binary-p-type' || architecture === 'hierarchical-trinary';
  const hostLumSolar = isCircumbinaryHost
    ? (stars[0].luminositySolar + stars[1].luminositySolar)
    : stars[0].luminositySolar;
  const hostMassSolar = isCircumbinaryHost
    ? (stars[0].massSolar + stars[1].massSolar)
    : stars[0].massSolar;
  const planetParentIdx = isCircumbinaryHost ? -2 : 0; // `-2` = barycenter of stars[0]+stars[1]

  // Physical Nebular Condensation Fronts (radiative equilibrium T(r) ~ 278 K * L^0.25 / sqrt(r_AU))
  const sqrtL = Math.sqrt(Math.max(1e-4, hostLumSolar));
  const rSilicateAu = Math.max(0.05, 0.085 * sqrtL);
  const rSnowLineAu = Math.max(0.18, 2.70 * sqrtL);
  const rCoIceAu = Math.max(0.75, 11.2 * sqrtL);
  const rHzInnerAu = Math.max(0.08, 0.94 * sqrtL);
  const rHzOuterAu = Math.max(0.16, 1.68 * sqrtL);

  // Holman-Wiegert Dynamical Stability Window!
  let rMinStableAu = Math.max(rSilicateAu * 1.15, stars[0].radiusSolar * 0.00465 * 6.0);
  let rMaxStableAu = Math.min(38.0, Math.max(6.0, 26.0 * Math.pow(hostMassSolar, 0.35)));
  if (isCircumbinaryHost && binaryPair) {
    const muIn = Math.min(stars[0].massSolar, stars[1].massSolar) / (stars[0].massSolar + stars[1].massSolar);
    const hwIn = evaluateHolmanWiegertLimits(binaryPair.aAu, binaryPair.e, muIn);
    rMinStableAu = Math.max(rMinStableAu, hwIn.rCritPAu * 1.18);
  }
  if (architecture === 'binary-s-type' && binaryPair) {
    const muOut = stars[1].massSolar / (stars[0].massSolar + stars[1].massSolar);
    const hwOut = evaluateHolmanWiegertLimits(binaryPair.aAu, binaryPair.e, muOut);
    rMaxStableAu = Math.min(rMaxStableAu, hwOut.rCritSAu * 0.92);
  } else if (architecture === 'hierarchical-trinary' && outerCompanion) {
    const mIn = stars[0].massSolar + stars[1].massSolar;
    const muOut = stars[2].massSolar / (mIn + stars[2].massSolar);
    const hwOut = evaluateHolmanWiegertLimits(outerCompanion.aAu, outerCompanion.e, muOut);
    rMaxStableAu = Math.min(rMaxStableAu, hwOut.rCritSAu * 0.90);
  }

  // Primordial metal-free Pop III or stellar BH or destroyed-window systems form 0 rocky/Earth-like planets!
  const canFormPlanets = nebulaEnv.metallicitySolar >= 0.015
    && stars[0].stage !== 'stellar-black-hole'
    && stars[0].stage !== 'neutron-star'
    && rMaxStableAu > rMinStableAu * 1.45;

  // Determine number of planets from solid disk mass Sigma_solid (~ 10^[Fe/H]) and available radial span!
  let planetCount = 0;
  if (canFormPlanets) {
    const logSpan = Math.log(rMaxStableAu / rMinStableAu);
    const maxBySpacing = Math.max(1, Math.min(8, Math.floor(logSpan / 0.48)));
    const metFactor = Math.max(0.25, Math.min(1.25, 0.65 + 0.35 * (nebulaEnv.feH + 1.0)));
    planetCount = Math.max(1, Math.min(maxBySpacing, Math.round((2 + rand() * 5) * metFactor)));
  }

  // Fischer-Valenti (2005) gas-giant core-accretion probability scales strongly with metallicity!
  const pGiantBase = Math.max(0.04, Math.min(0.88, 0.14 * Math.pow(nebulaEnv.metallicitySolar, 1.75)));
  const isRedGiantHost = stars[0].stage === 'red-giant' || stars[0].stage === 'agb-superwind';
  const isWhiteDwarfHost = stars[0].stage === 'white-dwarf';

  let aCursor = rMinStableAu * (1.08 + rand() * 0.45);
  let hasEarthLike = false;
  const planetIndices = [];

  for (let p = 0; p < planetCount; p += 1) {
    if (aCursor >= rMaxStableAu * 0.96) break;
    const aAu = aCursor;
    // Geometric Hill-sphere orbital spacing (1.52..2.15x per planet)
    aCursor *= (1.52 + rand() * 0.62);

    const tEqK = Math.max(28, Math.round(278.0 * Math.pow(Math.max(1e-4, hostLumSolar), 0.25) / Math.sqrt(Math.max(0.02, aAu))));
    const beyondSnow = aAu >= rSnowLineAu;
    const beyondCo = aAu >= rCoIceAu;
    const inHz = aAu >= rHzInnerAu && aAu <= rHzOuterAu;

    // Classify emergent planet type purely from nebular location, metallicity, C/O, temperature, and stochastic core accretion!
    const roll = rand();
    let archetype = 'rocky-arid';
    if (beyondSnow && roll < pGiantBase * 1.15 && !isWhiteDwarfHost) {
      archetype = beyondCo || rand() < 0.38 ? 'ice-giant' : 'gas-giant';
    } else if (!beyondSnow && aAu < rSnowLineAu * 0.25 && roll < pGiantBase * 0.22 && !isRedGiantHost && !isWhiteDwarfHost) {
      // Type-II disk-migrated Hot Jupiter!
      archetype = 'hot-jupiter';
    } else if (tEqK >= 950 || (isRedGiantHost && aAu < 1.8)) {
      archetype = rand() < 0.55 ? 'lava-world' : 'iron-core';
    } else if (nebulaEnv.carbonRich && !beyondSnow) {
      archetype = 'carbon-world';
    } else if (inHz && !hasEarthLike && !isRedGiantHost && !isWhiteDwarfHost && sys.systemAgeGyr >= 0.35 && nebulaEnv.volatileInventory >= 0.35 && roll < 0.42) {
      // Genuine habitable temperate ocean/silicate world — called "Earth-like", NEVER guaranteed in every system!
      archetype = 'earth-like';
      hasEarthLike = true;
    } else if (inHz && nebulaEnv.volatileInventory >= 0.55 && roll < 0.72) {
      archetype = 'ocean-super-earth';
    } else if (tEqK > 390 && tEqK < 950 && nebulaEnv.metallicitySolar > 0.25) {
      archetype = 'greenhouse';
    } else if (beyondSnow) {
      archetype = roll < 0.45 ? 'ice-giant' : 'icy-dwarf';
    } else if (tEqK < 250 && roll < 0.55) {
      archetype = 'arid-oxide';
    } else {
      archetype = rand() < 0.45 ? 'super-earth' : 'iron-core';
    }

    const pLetter = PLANET_LETTERS[p] || `p${p + 1}`;
    const baseLabel = `${sys.systemName} ${pLetter}`;
    let spec = null;

    if (archetype === 'earth-like') {
      const mE = 0.68 + rand() * 0.95;
      const rKm = Math.round(6371 * Math.pow(mE, 0.27));
      const pSurf = Math.round((0.65 + rand() * 1.15) * 101325);
      const tSurf = Math.max(268, Math.min(312, Math.round(tEqK + 28 + (rand() - 0.5) * 14)));
      spec = {
        name: `${baseLabel} (Earth-like)`,
        planetClass: 'earth-like',
        subtitle: `Earth-like Oceanic Silicate-Iron World · ${aAu.toFixed(2)} AU`,
        kind: 1,
        massSolar: mE * EARTH_MASS_SOLAR,
        radiusKm: rKm,
        color0: [0.22 + rand() * 0.12, 0.46 + rand() * 0.12, 0.22 + rand() * 0.08],
        color1: [0.05, 0.24 + rand() * 0.10, 0.58 + rand() * 0.10],
        atm: 0.72,
        surfacePressurePa: pSurf,
        volatileMassFrac: 0.045 + rand() * 0.025,
        particulateMassFrac: 0.006,
        tempK: tSurf,
        centralP: Math.round((260 + mE * 110) * 1e9),
        coreZ: 26, mantleZ: 14, surfZ: 14,
        composition: `Fe-Ni Core · MgSiO₃ Mantle · Liquid H₂O Ocean · N₂/O₂ ${(pSurf / 1e5).toFixed(2)} bar`
      };
    } else if (archetype === 'ocean-super-earth') {
      const mE = 2.2 + rand() * 3.8;
      const rKm = Math.round(6371 * Math.pow(mE, 0.29) * 1.08);
      const pSurf = Math.round((1.5 + rand() * 4.5) * 101325);
      spec = {
        name: `${baseLabel} (Ocean World)`,
        planetClass: 'ocean-world',
        subtitle: `Pelagic Super-Earth · ${aAu.toFixed(2)} AU`,
        kind: 1,
        massSolar: mE * EARTH_MASS_SOLAR,
        radiusKm: rKm,
        color0: [0.16, 0.44, 0.56],
        color1: [0.04, 0.20, 0.56],
        atm: 0.78,
        surfacePressurePa: pSurf,
        volatileMassFrac: 0.085,
        particulateMassFrac: 0.004,
        tempK: Math.max(270, Math.min(345, tEqK + 36)),
        centralP: Math.round((420 + mE * 95) * 1e9),
        coreZ: 26, mantleZ: 8, surfZ: 8,
        composition: `Fe Core · High-P H₂O Ice-VII Mantle · Global Liquid Ocean (${mE.toFixed(1)} M⊕)`
      };
    } else if (archetype === 'carbon-world') {
      const mE = 0.6 + rand() * 3.2;
      const rKm = Math.round(6371 * Math.pow(mE, 0.27) * 0.96);
      const pSurf = tEqK > 550 ? 2.4e5 : 4.2e4;
      spec = {
        name: `${baseLabel} (Carbon World)`,
        planetClass: 'carbon-world',
        subtitle: `High-C/O Graphite–SiC–Diamond World · ${aAu.toFixed(2)} AU`,
        kind: 1,
        massSolar: mE * EARTH_MASS_SOLAR,
        radiusKm: rKm,
        color0: [0.34, 0.32, 0.36],
        color1: [0.16, 0.15, 0.20],
        atm: 0.32,
        surfacePressurePa: pSurf,
        volatileMassFrac: 0.012,
        particulateMassFrac: 0.035,
        tempK: tEqK + 18,
        centralP: Math.round((240 + mE * 115) * 1e9),
        coreZ: 26, mantleZ: 6, surfZ: 6,
        composition: `Fe-C Core · Diamond/SiC Mantle · Graphite & Hydrocarbon Crust (C/O=${nebulaEnv.cToO.toFixed(2)})`
      };
    } else if (archetype === 'lava-world') {
      const mE = 0.4 + rand() * 3.6;
      const rKm = Math.round(6371 * Math.pow(mE, 0.27));
      spec = {
        name: `${baseLabel} (Lava World)`,
        planetClass: 'lava-world',
        subtitle: `Molten Silicate Magma Ocean World · ${aAu.toFixed(2)} AU`,
        kind: 7,
        massSolar: mE * EARTH_MASS_SOLAR,
        radiusKm: rKm,
        color0: [1.0, 0.44, 0.10],
        color1: [0.22, 0.08, 0.05],
        atm: 0.42,
        surfacePressurePa: 1.4e5,
        volatileMassFrac: 0.005,
        particulateMassFrac: 0.06,
        tempK: Math.max(1350, tEqK),
        centralP: Math.round((220 + mE * 110) * 1e9),
        coreZ: 26, mantleZ: 14, surfZ: 14,
        composition: `Molten Fe-Ni Core · Magma MgSiO₃ Ocean · Vaporized SiO/Na Exosphere`
      };
    } else if (archetype === 'iron-core') {
      const mE = 0.05 + rand() * 0.45;
      const rKm = Math.round(2200 + Math.pow(mE, 0.30) * 3200);
      spec = {
        name: `${baseLabel} (Iron World)`,
        planetClass: 'iron-world',
        subtitle: `Refractory Iron-Rich Terrestrial Core · ${aAu.toFixed(2)} AU`,
        kind: 1,
        massSolar: mE * EARTH_MASS_SOLAR,
        radiusKm: rKm,
        color0: [0.56, 0.52, 0.48],
        color1: [0.34, 0.31, 0.29],
        atm: 0.0,
        surfacePressurePa: 0,
        volatileMassFrac: 0.0,
        particulateMassFrac: 0.0,
        tempK: tEqK,
        centralP: Math.round((35 + mE * 120) * 1e9),
        coreZ: 26, mantleZ: 14, surfZ: 26,
        composition: `Fe-Ni Core 68% · Silicate Mantle 32% · Airless Cratered Regolith`
      };
    } else if (archetype === 'greenhouse') {
      const mE = 0.65 + rand() * 1.8;
      const rKm = Math.round(5600 + Math.pow(mE, 0.27) * 1600);
      const pSurf = Math.round((2.5 + rand() * 7.5) * 1e6);
      spec = {
        name: `${baseLabel} (Greenhouse)`,
        planetClass: 'greenhouse',
        subtitle: `Super-Greenhouse CO₂ World · ${aAu.toFixed(2)} AU`,
        kind: 2,
        massSolar: mE * EARTH_MASS_SOLAR,
        radiusKm: rKm,
        color0: [0.90, 0.78, 0.52],
        color1: [0.74, 0.54, 0.30],
        atm: 0.85,
        surfacePressurePa: pSurf,
        volatileMassFrac: 0.025,
        particulateMassFrac: 0.055,
        tempK: Math.min(920, tEqK + 280),
        centralP: Math.round((240 + mE * 105) * 1e9),
        coreZ: 26, mantleZ: 14, surfZ: 6,
        composition: `Fe/Ni Core · SiO₂ Mantle · Supercritical CO₂ ${(pSurf / 1e5).toFixed(0)} bar Atm`
      };
    } else if (archetype === 'arid-oxide' || archetype === 'super-earth') {
      const isSuper = archetype === 'super-earth';
      const mE = isSuper ? (1.8 + rand() * 3.2) : (0.10 + rand() * 0.42);
      const rKm = Math.round(isSuper ? (6371 * Math.pow(mE, 0.27)) : (3000 + Math.pow(mE, 0.30) * 2100));
      const pSurf = isSuper ? Math.round((0.8 + rand() * 2.2) * 1e5) : Math.round(450 + rand() * 2400);
      spec = {
        name: `${baseLabel} (${isSuper ? 'Super-Earth' : 'Arid World'})`,
        planetClass: isSuper ? 'super-earth' : 'arid-world',
        subtitle: `${isSuper ? 'Rocky Silicate Super-Earth' : 'Arid Iron-Oxide Desert World'} · ${aAu.toFixed(2)} AU`,
        kind: 1,
        massSolar: mE * EARTH_MASS_SOLAR,
        radiusKm: rKm,
        color0: isSuper ? [0.64, 0.46, 0.32] : [0.76, 0.36, 0.20],
        color1: isSuper ? [0.38, 0.28, 0.20] : [0.50, 0.22, 0.14],
        atm: isSuper ? 0.46 : 0.18,
        surfacePressurePa: pSurf,
        volatileMassFrac: isSuper ? 0.015 : 0.002,
        particulateMassFrac: 0.048,
        tempK: Math.max(140, tEqK + (isSuper ? 22 : 6)),
        centralP: Math.round((isSuper ? 420 : 45) * 1e9),
        coreZ: 26, mantleZ: 14, surfZ: 26,
        composition: `Fe-S Core · Basalt/Fe₂O₃ Silicate Crust · ${(pSurf / 1e5).toFixed(pSurf < 5000 ? 3 : 2)} bar CO₂/N₂`
      };
    } else if (archetype === 'hot-jupiter' || archetype === 'gas-giant') {
      const isHot = archetype === 'hot-jupiter';
      const mJup = isHot ? (0.35 + rand() * 2.4) : (0.22 + rand() * 3.1);
      const rKm = Math.round((54000 + rand() * 24000) * (isHot ? 1.18 : 1.0));
      const ringed = !isHot && rand() < 0.48;
      spec = {
        name: `${baseLabel} (${isHot ? 'Hot Jupiter' : (ringed ? 'Ringed Giant' : 'Gas Giant')})`,
        planetClass: isHot ? 'hot-jupiter' : 'gas-giant',
        subtitle: `${isHot ? 'Tidally Inflated Hot Jupiter' : 'Metallic-Hydrogen Gas Giant'} · ${aAu.toFixed(2)} AU`,
        kind: 2,
        massSolar: mJup * 9.54588e-4,
        radiusKm: rKm,
        color0: isHot ? [0.96, 0.52, 0.24] : [0.80 + rand() * 0.14, 0.68 + rand() * 0.14, 0.50 + rand() * 0.14],
        color1: isHot ? [0.54, 0.18, 0.12] : [0.52 + rand() * 0.14, 0.36 + rand() * 0.12, 0.24 + rand() * 0.10],
        atm: 0.55,
        surfacePressurePa: 1.0e5,
        volatileMassFrac: 0.08,
        particulateMassFrac: 0.02,
        ringed,
        ringInnerKm: ringed ? Math.round(rKm * 1.28) : 0,
        ringOuterKm: ringed ? Math.round(rKm * 2.38) : 0,
        tempK: Math.max(90, tEqK),
        centralP: Math.round((360 + mJup * 180) * 1e9),
        coreZ: 26, mantleZ: 1, surfZ: 2,
        composition: `H₂ ${(88 + rand() * 7).toFixed(1)}% · He · Metallic H Mantle (${mJup.toFixed(2)} M_J)`
      };
    } else if (archetype === 'ice-giant') {
      const mE = 10.0 + rand() * 14.0;
      const rKm = Math.round(21000 + rand() * 7500);
      const ringed = rand() < 0.28;
      const isDeepBlue = rand() < 0.52;
      spec = {
        name: `${baseLabel} (Ice Giant)`,
        planetClass: 'ice-giant',
        subtitle: `Superionic H₂O/NH₃/CH₄ Ice Giant · ${aAu.toFixed(2)} AU`,
        kind: 3,
        massSolar: mE * EARTH_MASS_SOLAR,
        radiusKm: rKm,
        color0: isDeepBlue ? [0.26, 0.50, 0.94] : [0.54, 0.84, 0.90],
        color1: isDeepBlue ? [0.14, 0.30, 0.76] : [0.36, 0.68, 0.80],
        atm: 0.62,
        surfacePressurePa: 1.0e5,
        volatileMassFrac: 0.06,
        particulateMassFrac: 0.01,
        ringed,
        ringInnerKm: ringed ? Math.round(rKm * 1.45) : 0,
        ringOuterKm: ringed ? Math.round(rKm * 2.15) : 0,
        tempK: Math.max(42, tEqK),
        centralP: Math.round((240 + mE * 4.5) * 1e9),
        coreZ: 14, mantleZ: 8, surfZ: 6,
        composition: `H₂O/CH₄/NH₃ Superionic Mantle · H₂/He Envelope (${mE.toFixed(1)} M⊕)`
      };
    } else {
      // Icy dwarf planet outside snow line
      const mE = 0.015 + rand() * 0.14;
      const rKm = Math.round(1350 + rand() * 1650);
      spec = {
        name: `${baseLabel} (Cryo Dwarf)`,
        planetClass: 'icy-dwarf',
        subtitle: `Outer-Disk Volatile Ice World · ${aAu.toFixed(2)} AU`,
        kind: 3,
        massSolar: mE * EARTH_MASS_SOLAR,
        radiusKm: rKm,
        color0: [0.78, 0.84, 0.90],
        color1: [0.46, 0.56, 0.68],
        atm: 0.04,
        surfacePressurePa: 0,
        volatileMassFrac: 0.0,
        particulateMassFrac: 0.0,
        tempK: Math.max(35, tEqK),
        centralP: 5e9,
        coreZ: 14, mantleZ: 8, surfZ: 8,
        composition: `H₂O/N₂/CH₄ Ice Shell · Silicate Core`
      };
    }

    const bodyIdx = catalog.length;
    // Causal spin obliquity (stochastic giant-impact scatter) & tidal-locking timescale (tau ~ a^6 / M_*^2)!
    const mHost = Math.max(0.08, stars[0]?.massSolar || 1.0);
    const tidalRatio = Math.pow(aAu / 0.22, 6.0) / (mHost * mHost * Math.max(0.1, sys.systemAgeGyr));
    const tidallyLocked = tidalRatio < 1.0 || archetype === 'hot-jupiter' || archetype === 'lava-world';
    const axialObliquityDeg = tidallyLocked
      ? Number((rand() * 3.5).toFixed(2))
      : Number((archetype === 'ice-giant' && rand() < 0.35 ? (65 + rand() * 55) : (4 + rand() * 38)).toFixed(2));
    const spinAxisLonDeg = Number((rand() * 360).toFixed(1));
    const orbitPeriodHr = 8766.0 * Math.sqrt(Math.pow(aAu, 3.0) / mHost);
    const rotationPeriodHr = tidallyLocked
      ? Number(orbitPeriodHr.toFixed(2))
      : Number(((archetype === 'gas-giant' || archetype === 'ice-giant') ? (8.5 + rand() * 11.0) : (12.0 + rand() * 36.0)).toFixed(2));
    // Emergent indigenous civilization sub-Kardashev index (rare, non-zero only on mature habitable/exotic worlds!)
    const civRoll = rand();
    const isMature = sys.systemAgeGyr >= 2.2;
    const isHabLike = archetype === 'earth-like' || archetype === 'ocean-super-earth';
    const civTechK = (isHabLike && isMature && civRoll < 0.55)
      ? Number((0.38 + rand() * 0.52).toFixed(2))
      : 0.0;
    catalog.push({
      id: `planet-${p}`,
      parent: planetParentIdx,
      aAu: Number(aAu.toFixed(4)),
      e: Number((0.008 + rand() * (archetype === 'earth-like' ? 0.045 : 0.095)).toFixed(4)),
      incDeg: Number(((rand() - 0.5) * 4.2).toFixed(2)),
      omDeg: Number((rand() * 360).toFixed(1)),
      wDeg: Number((rand() * 360).toFixed(1)),
      m0Deg: Number((rand() * 360).toFixed(1)),
      axialObliquityDeg,
      spinAxisLonDeg,
      rotationPeriodHr,
      tidallyLocked,
      civTechK,
      hostStarTeffK: stars[0]?.effectiveTempK || 5778,
      ...spec
    });
    planetIndices.push(bodyIdx);

    // Dynamically generate natural satellites for Gas/Ice Giants & large habitable worlds!
    const isGiant = archetype === 'gas-giant' || archetype === 'ice-giant';
    const nMoons = isGiant ? (1 + Math.floor(rand() * 2.4)) : ((archetype === 'earth-like' || archetype === 'ocean-super-earth') && rand() < 0.65 ? 1 : 0);
    for (let m = 0; m < nMoons; m += 1) {
      const mRadKm = isGiant ? Math.round(1450 + rand() * 1350) : Math.round(1150 + rand() * 850);
      const mMassSolar = Math.pow(mRadKm / 1737.4, 3.0) * 3.6943e-8;
      const aMoonAu = ((spec.radiusKm * (5.2 + m * 5.8 + rand() * 2.5)) * 1000) / 1.495978707e11;
      const isHazyMoon = isGiant && beyondSnow && mRadKm > 2350 && tEqK < 125;
      const isVolcanicMoon = isGiant && m === 0 && rand() < 0.45;
      catalog.push({
        id: `moon-${p}-${m}`,
        name: `${baseLabel}-${ROMAN[m] || (m + 1)}`,
        planetClass: isHazyMoon ? 'hazy-moon' : (isVolcanicMoon ? 'volcanic-moon' : (beyondSnow ? 'icy-moon' : 'rocky-moon')),
        subtitle: `${isHazyMoon ? 'Dense-Atmosphere Methane Moon' : (isVolcanicMoon ? 'Tidally Heated Volcanic Moon' : (beyondSnow ? 'Subsurface-Ocean Icy Moon' : 'Natural Rocky Satellite'))}`,
        parent: bodyIdx,
        kind: isHazyMoon ? 2 : (isVolcanicMoon ? 1 : 3),
        massSolar: mMassSolar,
        radiusKm: mRadKm,
        aAu: Number(aMoonAu.toFixed(6)),
        e: Number((0.005 + rand() * 0.035).toFixed(4)),
        incDeg: Number(((rand() - 0.5) * 4.0).toFixed(2)),
        omDeg: Number((rand() * 360).toFixed(1)),
        wDeg: Number((rand() * 360).toFixed(1)),
        m0Deg: Number((rand() * 360).toFixed(1)),
        axialObliquityDeg: Number((axialObliquityDeg * 0.85).toFixed(2)),
        spinAxisLonDeg,
        rotationPeriodHr: Number((8766.0 * Math.sqrt(Math.pow(aMoonAu, 3.0) / Math.max(1e-9, spec.massSolar))).toFixed(2)),
        tidallyLocked: true,
        hostStarTeffK: stars[0]?.effectiveTempK || 5778,
        color0: isHazyMoon ? [0.86, 0.68, 0.34] : (isVolcanicMoon ? [0.92, 0.80, 0.30] : (beyondSnow ? [0.84, 0.86, 0.90] : [0.66, 0.65, 0.63])),
        color1: isHazyMoon ? [0.62, 0.44, 0.20] : (isVolcanicMoon ? [0.68, 0.44, 0.14] : (beyondSnow ? [0.54, 0.66, 0.78] : [0.40, 0.39, 0.38])),
        atm: isHazyMoon ? 0.78 : 0.0,
        surfacePressurePa: isHazyMoon ? 142000 : 0,
        volatileMassFrac: isHazyMoon ? 0.04 : 0.0,
        particulateMassFrac: isHazyMoon ? 0.03 : 0.0,
        tempK: Math.max(45, tEqK),
        centralP: 6e9,
        coreZ: beyondSnow ? 14 : 26,
        mantleZ: beyondSnow ? 8 : 14,
        surfZ: isVolcanicMoon ? 16 : (isHazyMoon ? 6 : (beyondSnow ? 8 : 14)),
        composition: isHazyMoon ? 'N₂/CH₄ Haze Atm · H₂O/Silicate Interior' : (isVolcanicMoon ? 'Silicate Mantle · Sulfur Volcanic Crust' : (beyondSnow ? 'H₂O Ice/Ocean Shell · Silicate Core' : 'Silicate Regolith · Fe Core'))
      });
    }
  }

  // Synthesize visitable, landable, mineable named Minor Bodies (Metallic Asteroid + Active Outgassing Comet) for EVERY star system!
  const astAu = Number(Math.max(rMinStableAu * 1.35, Math.min(rMaxStableAu * 0.9, rSnowLineAu * 0.92)).toFixed(4));
  const lHostSol = Math.max(0.01, stars.reduce((acc, s) => acc + (Number(s.luminositySolar) || 0), 0) || 1.0);
  const astTeq = Math.max(45, Math.round(278 * Math.pow(lHostSol, 0.25) / Math.sqrt(Math.max(0.1, astAu))));
  catalog.push({
    id: 'belt-asteroid-1',
    name: `${sys.systemName} Belt Asteroid α`,
    planetClass: 'metallic-asteroid',
    subtitle: `Mineable Fe-Ni / Silicate Main-Belt Asteroid · ${astAu.toFixed(2)} AU`,
    parent: planetParentIdx,
    kind: 1,
    massSolar: (2e-12 + rand() * 3e-11),
    radiusKm: Math.round(45 + rand() * 145),
    aAu: astAu,
    e: Number((0.06 + rand() * 0.14).toFixed(4)),
    incDeg: Number((3.0 + rand() * 9.0).toFixed(2)),
    omDeg: Number((rand() * 360).toFixed(1)),
    wDeg: Number((rand() * 360).toFixed(1)),
    m0Deg: Number((rand() * 360).toFixed(1)),
    axialObliquityDeg: Number((rand() * 140).toFixed(1)),
    spinAxisLonDeg: Number((rand() * 360).toFixed(1)),
    rotationPeriodHr: Number((3.8 + rand() * 9.5).toFixed(2)),
    tidallyLocked: false,
    isMinorBody: true,
    isMetallicAsteroid: true,
    civTechK: 0,
    hostStarTeffK: stars[0]?.effectiveTempK || 5778,
    color0: [0.64, 0.62, 0.58],
    color1: [0.36, 0.38, 0.42],
    atm: 0.0,
    surfacePressurePa: 0,
    volatileMassFrac: 0.04,
    tempK: astTeq,
    centralP: 1.4e7,
    coreZ: 26, mantleZ: 28, surfZ: 26,
    composition: 'Fe-Ni Metallic Ore · Olivine/Pyroxene Chondrite'
  });
  const comAu = Number(Math.max(rSnowLineAu * 1.4, Math.min(18.0, rSnowLineAu * 2.8)).toFixed(4));
  catalog.push({
    id: 'periodic-comet-1',
    name: `${sys.systemName} Comet 1P`,
    planetClass: 'periodic-comet',
    subtitle: `Active Outgassing Volatile Comet · e = 0.84`,
    parent: planetParentIdx,
    kind: 3,
    massSolar: 8.5e-17,
    radiusKm: Number((4.5 + rand() * 9.0).toFixed(1)),
    aAu: comAu,
    e: Number((0.76 + rand() * 0.16).toFixed(4)),
    incDeg: Number((18.0 + rand() * 115.0).toFixed(2)),
    omDeg: Number((rand() * 360).toFixed(1)),
    wDeg: Number((rand() * 360).toFixed(1)),
    m0Deg: Number((12 + rand() * 26).toFixed(1)),
    axialObliquityDeg: 28.0,
    spinAxisLonDeg: 110.0,
    rotationPeriodHr: Number((14.0 + rand() * 36.0).toFixed(1)),
    tidallyLocked: false,
    isMinorBody: true,
    isComet: true,
    civTechK: 0,
    hostStarTeffK: stars[0]?.effectiveTempK || 5778,
    color0: [0.74, 0.90, 1.0],
    color1: [0.38, 0.62, 0.88],
    atm: 0.18,
    surfacePressurePa: 0,
    volatileMassFrac: 0.76,
    tempK: 175,
    centralP: 1e5,
    coreZ: 8, mantleZ: 6, surfZ: 8,
    composition: 'H₂O Ice 75% · CO/CO₂/CH₄ Volatiles · Silicate Dust'
  });

  // Pick a compelling default focus body (Earth-like if present, else first rocky/ocean planet, else first planet, else primary star!)
  const earthLikeIdx = catalog.findIndex((b) => b.planetClass === 'earth-like');
  const firstPlanetIdx = catalog.findIndex((b) => !b.isStar && !b.isMinorBody);
  const defaultFocusIndex = earthLikeIdx >= 0 ? earthLikeIdx : (firstPlanetIdx >= 0 ? firstPlanetIdx : 0);

  return Object.freeze({
    schema: ULG_CAUSAL_NEBULAR_CASCADE_SCHEMA,
    systemId: sys.systemId,
    systemName: sys.systemName,
    starSystem: sys,
    multiplicity,
    architecture,
    starCount: stars.length,
    planetCount: planetIndices.length,
    hasEarthLike,
    earthLikeIndex: earthLikeIdx,
    defaultFocusIndex,
    condensationFrontsAu: Object.freeze({
      rSilicateAu: Number(rSilicateAu.toFixed(3)),
      rHzInnerAu: Number(rHzInnerAu.toFixed(3)),
      rHzOuterAu: Number(rHzOuterAu.toFixed(3)),
      rSnowLineAu: Number(rSnowLineAu.toFixed(3)),
      rCoIceAu: Number(rCoIceAu.toFixed(3)),
      rMinStableAu: Number(rMinStableAu.toFixed(3)),
      rMaxStableAu: Number(rMaxStableAu.toFixed(3))
    }),
    beltZoneAu: Object.freeze({
      innerAu: Math.max(rMinStableAu * 1.4, rSnowLineAu * 0.78),
      outerAu: Math.min(rMaxStableAu * 0.95, rSnowLineAu * 1.25),
      kuiperInnerAu: Math.min(rMaxStableAu * 0.96, Math.max(rCoIceAu * 1.1, rSnowLineAu * 2.4)),
      kuiperOuterAu: Math.min(44.0, Math.max(rCoIceAu * 1.6, rSnowLineAu * 3.6))
    }),
    catalog: Object.freeze(catalog)
  });
}
