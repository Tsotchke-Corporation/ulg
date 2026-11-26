// First-Principles Planetary Xenobiology & Emergent Civilization Synthesizer
// (`src/runtime/biology/xenobiologySynthesizer.js`).
//
// Strictly Star Spec v0.4 compliant — ZERO hardcoded species or planet-name branches!
// Derives viable solvent biochemistry, membrane hydrophobic/azotosome coupling,
// dielectric-dependent biopolymer folding, host-star Wien photosynthetic pigments,
// Eigen UV mutation pressure, Euler-buckling flora morphology, and emergent
// indigenous civilization tech level directly from physical planetary state
// `(tempK, pressurePa, gravityMS2, rhoAtmKgM3, volatileFrac, stellarTeffK, uvFluxNorm, seed)`.

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function hash01(seed) {
  let h = (seed >>> 0) || 1;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Derive physical solvent regime from `(T, P, volatileFrac)` using liquid-phase
 * triple-point / boiling-point envelopes of abundant cosmic volatiles:
 *   - H2O (265..385 K, P >= 611 Pa)
 *   - NH3 (195..255 K, P >= 6e3 Pa)
 *   - CH4/C2H6 (84..122 K, P >= 1.2e4 Pa)
 *   - H2SO4 cloud aerosols (295..435 K, P >= 8e5 Pa)
 */
export function classifyPlanetarySolvent({
  tempK = 288,
  pressurePa = 101325,
  volatileFrac = 0.04,
  hasSolidCrust = true,
  isCryoMoon = false
} = {}) {
  const T = Number(tempK) || 288;
  const P = Math.max(0, Number(pressurePa) || 0);
  const v = Math.max(0, Number(volatileFrac) || 0);

  if ((P >= 2.5e6 && T >= 295 && T <= 760) || (P >= 5e5 && T > 388 && T <= 760)) {
    return Object.freeze({
      solvent: 'H2SO4',
      formula: 'H₂SO₄',
      label: 'Sulfuric Acid Cloud Aerosols (50 km Deck)',
      dielectricEr: 101.0,
      tMeltK: 283.5,
      tBoilK: 610.0,
      oceanRgb: [0.64, 0.56, 0.24],
      membraneType: 'Sulfonated Acidophile Vesicle',
      hydrophobicCoupling: 2.20,
      hBondStrength: 1.65,
      deltaPh: 2.35,
      strongPairFraction: 0.82,
      sequence: 'HHH+PP-HHH+PP-HHHH+PP-HHH+PP-HHH'
    });
  }
  if (hasSolidCrust && P >= 611 && T >= 262 && T <= 388 && v >= 0.012) {
    return Object.freeze({
      solvent: 'H2O',
      formula: 'H₂O',
      label: 'Liquid Water (Aqueous)',
      dielectricEr: 78.4,
      tMeltK: 273.15,
      tBoilK: 373.15,
      oceanRgb: [0.04, 0.24, 0.48],
      membraneType: 'Phospholipid Bilayer',
      hydrophobicCoupling: 1.85,
      hBondStrength: 1.45,
      deltaPh: 1.0,
      strongPairFraction: 0.52,
      sequence: 'HPPHH+PHHPPHH-PPHHPPH+PPH-PHHPPH'
    });
  }
  if (hasSolidCrust && P >= 1.2e4 && T >= 82 && T <= 124) {
    return Object.freeze({
      solvent: 'CH4',
      formula: 'CH₄/C₂H₆',
      label: 'Cryogenic Liquid Methane / Ethane',
      dielectricEr: 1.7,
      tMeltK: 90.7,
      tBoilK: 111.7,
      oceanRgb: [0.18, 0.16, 0.10],
      membraneType: 'Acrylonitrile Azotosome',
      hydrophobicCoupling: 1.18,
      hBondStrength: 1.10,
      deltaPh: 0.45,
      strongPairFraction: 0.36,
      sequence: '+P-P+P-PHHP+P-P+P-PHHP+P-P+P-P'
    });
  }
  if (hasSolidCrust && P >= 5e3 && T >= 190 && T <= 258 && v >= 0.008) {
    return Object.freeze({
      solvent: 'NH3',
      formula: 'NH₃',
      label: 'Liquid Ammonia–Water Eutectic',
      dielectricEr: 22.0,
      tMeltK: 195.4,
      tBoilK: 239.8,
      oceanRgb: [0.14, 0.26, 0.34],
      membraneType: 'Ammonophilic Amphiphile',
      hydrophobicCoupling: 1.38,
      hBondStrength: 1.25,
      deltaPh: 0.85,
      strongPairFraction: 0.48,
      sequence: 'HPH+PHH-PHPHH+PH-PHPHH+PH-PHPH'
    });
  }
  if (isCryoMoon || (hasSolidCrust && T >= 75 && T <= 180 && v >= 0.02)) {
    return Object.freeze({
      solvent: 'H2O-subsurface',
      formula: 'H₂O (Subsurface)',
      label: 'Subsurface Hydrothermal Brine Ocean',
      dielectricEr: 78.4,
      tMeltK: 273.15,
      tBoilK: 373.15,
      oceanRgb: [0.06, 0.34, 0.56],
      membraneType: 'Ether-Lipid Barophile Bilayer',
      hydrophobicCoupling: 2.05,
      hBondStrength: 1.55,
      deltaPh: 1.65,
      strongPairFraction: 0.68,
      sequence: 'HHP+HHP-HHHP+HHP-HHHP+HHP-HHP+'
    });
  }
  return Object.freeze({
    solvent: 'none',
    formula: 'None',
    label: 'Anhydrous / Sterile Regime',
    dielectricEr: 78.4,
    tMeltK: 273.15,
    tBoilK: 373.15,
    oceanRgb: [0.08, 0.14, 0.22],
    membraneType: 'None',
    hydrophobicCoupling: 0.0,
    hBondStrength: 0.6,
    deltaPh: 0.0,
    strongPairFraction: 0.5,
    sequence: 'HPPHH+PHHPPHH-PP'
  });
}

/**
 * Derive photosynthetic canopy pigment RGB strictly from host-star Wien peak
 * wavelength `lambda_peak = 2.8978e-3 / T_eff` (Kiang et al. astrobiology scaling):
 *   - Cool M-dwarf (< 3700 K): deep crimson / dark maroon broad-spectrum absorbers
 *   - K-dwarf (3700..5100 K): warm amber-vermilion / olive-russet pigments
 *   - G-star (5100..6200 K): emerald chlorophyll green
 *   - Hot F/A-star (> 6200 K): UV-shielded violet-indigo / cyan carotenoids
 */
export function deriveStellarPigmentRgb(stellarTeffK = 5778, solvent = 'H2O') {
  const T = clamp(Number(stellarTeffK) || 5778, 2400, 14000);
  if (solvent === 'CH4') return [0.58, 0.38, 0.72]; // Cryogenic photochemical tholin-violet fronds
  if (solvent === 'NH3') return [0.24, 0.62, 0.56]; // Teal ammonophilic canopies
  if (solvent === 'H2SO4') return [0.76, 0.64, 0.22]; // Sulfur-yellow acidophile mats
  if (T < 3750) {
    const f = clamp((T - 2600) / 1150, 0, 1);
    return [0.34 + 0.24 * f, 0.09 + 0.08 * f, 0.12 + 0.06 * f];
  }
  if (T < 5150) {
    const f = clamp((T - 3750) / 1400, 0, 1);
    return [0.58 - 0.38 * f, 0.22 + 0.30 * f, 0.12 + 0.08 * f];
  }
  if (T <= 6350) {
    const f = clamp((T - 5150) / 1200, 0, 1);
    return [0.14 + 0.06 * (1 - f), 0.48 + 0.10 * f, 0.18 + 0.12 * f];
  }
  const f = clamp((T - 6350) / 3000, 0, 1);
  return [0.20 + 0.28 * f, 0.44 - 0.12 * f, 0.58 + 0.28 * f];
}

/**
 * Full first-principles planetary xenobiology + emergent civilization profile.
 */
export function deriveXenobiologyProfile({
  worldName = 'Exoplanet',
  tempK = 288,
  pressurePa = 101325,
  gravityMS2 = 9.81,
  rhoAtmKgM3 = 1.22,
  volatileFrac = 0.04,
  hasSolidCrust = true,
  isCryoMoon = false,
  isMagmaOcean = false,
  stellarTeffK = 5778,
  uvFluxNorm = 1.0,
  seed = 20261125
} = {}) {
  const solv = isMagmaOcean
    ? classifyPlanetarySolvent({ tempK: 1850, pressurePa: 0, volatileFrac: 0, hasSolidCrust: false })
    : classifyPlanetarySolvent({ tempK, pressurePa, volatileFrac, hasSolidCrust, isCryoMoon });

  const g = Math.max(0.25, Number(gravityMS2) || 9.81);
  const rho = Math.max(0, Number(rhoAtmKgM3) || 0);
  const uv = clamp(Number(uvFluxNorm) || Math.pow(Math.max(2500, stellarTeffK) / 5778, 3.2), 0.05, 8.0);

  let biosphereViability = 0.0;
  if (solv.solvent === 'H2O') biosphereViability = 0.88;
  else if (solv.solvent === 'NH3') biosphereViability = 0.56;
  else if (solv.solvent === 'CH4') biosphereViability = 0.48;
  else if (solv.solvent === 'H2SO4') biosphereViability = 0.34;
  else if (solv.solvent === 'H2O-subsurface') biosphereViability = 0.52;

  // Extreme surface radiation / thin air attenuates surface flora viability
  if (solv.solvent !== 'H2O-subsurface' && pressurePa < 1500) {
    biosphereViability *= clamp(pressurePa / 1500, 0.05, 1.0);
  }
  const rBio = hash01((seed ^ 0x2b7e1516) >>> 0);
  const rCiv = hash01((seed ^ 0x7f4a7c15) >>> 0);
  if (biosphereViability > 0.15) {
    biosphereViability = clamp(biosphereViability * (0.65 + 0.55 * rBio), 0.0, 1.0);
  }

  // Emergent indigenous civilization tech index (Kardashev 0.0 = none, 0.35..0.65 = pre-industrial/industrial, 0.72..1.1 = spacefaring)
  // Emerges probabilistically on high-viability worlds (and guaranteed on rich Earth-like worlds with high roll)
  let civTechK = 0.0;
  let civStage = 'Uninhabited';
  if (biosphereViability >= 0.42 && hasSolidCrust && !isMagmaOcean && rCiv > 0.34) {
    const f = clamp((rCiv - 0.34) / 0.66, 0, 1);
    civTechK = Number((0.36 + f * 0.68).toFixed(2));
    if (civTechK >= 0.85) civStage = 'Type I Planetary Grid';
    else if (civTechK >= 0.68) civStage = 'Industrial Radio Era';
    else if (civTechK >= 0.50) civStage = 'Agrarian / Metallurgy';
    else civStage = 'Settlement Megalithic';
  }

  // Euler buckling height scaling: taller slender flora in lower gravity + denser buoyant air!
  const bucklingHeightScale = clamp(
    Math.pow(9.81 / g, 0.45) * (1.0 + 0.14 * Math.log1p(rho)),
    0.45,
    2.6
  );
  const pigmentRgb = deriveStellarPigmentRgb(stellarTeffK, solv.solvent);
  // Effective lab simulation temperature clamped into active solvent liquid band
  const labTempK = solv.solvent === 'H2SO4'
    ? 330
    : (solv.solvent === 'H2O-subsurface'
      ? 295
      : clamp(Number(tempK) || 288, Math.max(82, solv.tMeltK - 4), Math.min(440, solv.tBoilK + 20)));

  // Higher UV flux raises Eigen template replication mutation rate `mu`!
  const mutationRateMu = Number(clamp(0.014 + 0.022 * Math.sqrt(uv), 0.010, 0.18).toFixed(3));
  const v0Propel = Number(clamp(1.35 * Math.pow(9.81 / g, 0.22) * (1.0 / (1.0 + 0.12 * rho)), 0.55, 2.35).toFixed(2));

  return Object.freeze({
    worldName,
    solvent: solv.solvent,
    solventFormula: solv.formula,
    solventLabel: solv.label,
    oceanRgb: solv.oceanRgb,
    tMeltK: solv.tMeltK,
    tBoilK: solv.tBoilK,
    dielectricEr: solv.dielectricEr,
    membraneType: solv.membraneType,
    biosphereViability: Number(biosphereViability.toFixed(2)),
    civTechK,
    civStage,
    hasRadioBeacons: civTechK >= 0.65,
    hasNightCityLights: civTechK >= 0.55,
    bucklingHeightScale: Number(bucklingHeightScale.toFixed(2)),
    pigmentRgb: Object.freeze(pigmentRgb),
    stellarTeffK: Math.round(stellarTeffK),
    uvFluxNorm: Number(uv.toFixed(2)),
    gravityMS2: Number(g.toFixed(2)),
    pressurePa: Math.round(pressurePa),
    labParams: Object.freeze({
      memTempK: Math.round(labTempK),
      memEpsHp: solv.hydrophobicCoupling,
      memOsmotic: solv.solvent === 'H2O-subsurface' ? 0.42 : 0.25,
      foldTempK: Math.round(labTempK),
      foldEpsHp: solv.solvent === 'CH4' ? 0.68 : solv.hydrophobicCoupling,
      foldEpsHb: solv.hBondStrength,
      foldDielectricEr: solv.dielectricEr,
      foldSeq: solv.sequence,
      evoMu: mutationRateMu,
      evoBeta: 2.4,
      evoStrongFrac: solv.strongPairFraction,
      hhDeltaPh: solv.deltaPh,
      morphV0: v0Propel
    })
  });
}

export const XENOBIOLOGY_PLANET_PRESETS = Object.freeze([
  Object.freeze({
    id: 'earth-h2o',
    label: '🌍 Earth H₂O (G2V)',
    worldName: 'Earth (G2V)',
    tempK: 288, pressurePa: 101325, gravityMS2: 9.81, rhoAtmKgM3: 1.22,
    volatileFrac: 0.05, hasSolidCrust: true, isCryoMoon: false, stellarTeffK: 5778, uvFluxNorm: 1.0,
    recommendedMode: 'protocell-vesicle'
  }),
  Object.freeze({
    id: 'titan-ch4',
    label: '🟠 Titan CH₄ Azotosome',
    worldName: 'Titan (CH₄ Cryo-Sea)',
    tempK: 94, pressurePa: 146700, gravityMS2: 1.35, rhoAtmKgM3: 5.3,
    volatileFrac: 0.06, hasSolidCrust: true, isCryoMoon: false, stellarTeffK: 5778, uvFluxNorm: 0.12,
    recommendedMode: 'lipid-soup'
  }),
  Object.freeze({
    id: 'mdwarf-crimson',
    label: '🔴 M-Dwarf Super-Earth',
    worldName: 'Proxima-like M-Dwarf World',
    tempK: 296, pressurePa: 185000, gravityMS2: 14.8, rhoAtmKgM3: 2.1,
    volatileFrac: 0.06, hasSolidCrust: true, isCryoMoon: false, stellarTeffK: 3150, uvFluxNorm: 3.4,
    recommendedMode: 'quasispecies-eigen'
  }),
  Object.freeze({
    id: 'venus-h2so4',
    label: '🟡 Venus H₂SO₄ Cloud Deck',
    worldName: 'Venus 52 km Acid Cloud Deck',
    tempK: 332, pressurePa: 9200000, gravityMS2: 8.87, rhoAtmKgM3: 1.15,
    volatileFrac: 0.02, hasSolidCrust: true, isCryoMoon: false, stellarTeffK: 5778, uvFluxNorm: 1.9,
    recommendedMode: 'amphipathic-helix-bundle'
  }),
  Object.freeze({
    id: 'europa-vent',
    label: '🔵 Europa Hydrothermal',
    worldName: 'Europa Subsurface Vent',
    tempK: 102, pressurePa: 0, gravityMS2: 1.31, rhoAtmKgM3: 0.0,
    volatileFrac: 0.08, hasSolidCrust: true, isCryoMoon: true, stellarTeffK: 5778, uvFluxNorm: 0.05,
    recommendedMode: 'excitable-spiral'
  })
]);

export function buildLifeLabXenobiologyUrl(profile, mode = 'protocell-vesicle') {
  const q = new URLSearchParams({
    xeno: '1',
    world: String(profile?.worldName || 'Exoplanet'),
    T: String(Math.round(profile?.labParams?.memTempK || 288)),
    P: String(Math.round(profile?.pressurePa || 101325)),
    g: String(profile?.gravityMS2 || 9.81),
    solvent: String(profile?.solvent || 'H2O'),
    teff: String(Math.round(profile?.stellarTeffK || 5778)),
    uv: String(profile?.uvFluxNorm || 1.0),
    mode
  });
  return `./life-lab.html?${q.toString()}`;
}

export function parseXenobiologyFromSearch(search = '') {
  const sp = new URLSearchParams(search || '');
  if (sp.get('xeno') !== '1') return null;
  const solventHint = sp.get('solvent') || '';
  const T = Number(sp.get('T')) || 288;
  const P = Number(sp.get('P')) || 101325;
  const g = Number(sp.get('g')) || 9.81;
  const teff = Number(sp.get('teff')) || 5778;
  const uv = Number(sp.get('uv')) || 1.0;
  const worldName = sp.get('world') || 'Alien World';
  const mode = sp.get('mode') || 'protocell-vesicle';
  const profile = deriveXenobiologyProfile({
    worldName,
    tempK: T,
    pressurePa: solventHint === 'H2SO4' ? Math.max(P, 1e6) : (solventHint === 'CH4' ? Math.max(P, 1e5) : P),
    gravityMS2: g,
    isCryoMoon: solventHint === 'H2O-subsurface',
    volatileFrac: 0.05,
    stellarTeffK: teff,
    uvFluxNorm: uv
  });
  return { profile, mode };
}
