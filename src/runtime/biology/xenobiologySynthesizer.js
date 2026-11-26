// First-Principles Planetary Xenobiology, Ecosystem Clade & Emergent Civilization Synthesizer
// (`src/runtime/biology/xenobiologySynthesizer.js`).
//
// Strictly Star Spec v0.4 compliant — ZERO hardcoded species or planet-name branches!
// Delegates to `xenobiologyEcologyEngine.js` (`planetary-xenobiology-ecology@1`, 2024-2025
// Bains-Petkowski-Seager solvent framework, Kiang/Lehmer/Schwieterman photobiology,
// NutMEG redox bioenergetics, 4-12 letter XNA genetics, Kleiber/Euler/Bergmann/Allen allometry,
// and full multi-species Flora + Fungi + Fauna clade webs!).

import {
  classifySolventBains2024,
  solvePhotobiologySpectrum,
  synthesizeWorldEcosystem
} from './xenobiologyEcologyEngine.js';

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function hash01(seed) {
  let h = (seed >>> 0) || 1;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function classifyPlanetarySolvent(opts = {}) {
  return classifySolventBains2024(opts);
}

export function deriveStellarPigmentRgb(stellarTeffK = 5778, solvent = 'H2O') {
  const photo = solvePhotobiologySpectrum({ stellarTeffK, solvent });
  return [...photo.primaryRgb];
}

/**
 * Full first-principles planetary xenobiology, ecosystem clade tree, and emergent civilization profile.
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
  cToO = 0.55,
  civTechK: civOverride = undefined,
  seed = 20261125
} = {}) {
  const eco = synthesizeWorldEcosystem({
    worldName,
    tempK,
    pressurePa,
    gravityMS2,
    rhoAtmKgM3,
    volatileFrac,
    hasSolidCrust,
    isCryoMoon,
    isMagmaOcean,
    stellarTeffK,
    uvFluxNorm,
    cToO,
    seed
  });
  const solv = eco.solventInfo;
  const photo = eco.photobiology;
  const redox = eco.redox;
  const g = Math.max(0.25, Number(gravityMS2) || 9.81);
  const rho = Math.max(0, Number(rhoAtmKgM3) || 0);
  const uv = clamp(Number(uvFluxNorm) || Math.pow(Math.max(2500, stellarTeffK) / 5778, 3.2), 0.05, 8.0);

  let biosphereViability = 0.0;
  if (solv.solvent === 'H2O') biosphereViability = 0.88;
  else if (solv.solvent === 'CO2-liq') biosphereViability = 0.62;
  else if (solv.solvent === 'NH3') biosphereViability = 0.58;
  else if (solv.solvent === 'CH4') biosphereViability = 0.50;
  else if (solv.solvent === 'H2SO4') biosphereViability = 0.38;
  else if (solv.solvent === 'H2O-subsurface') biosphereViability = 0.56;
  else if (solv.solvent === 'H2-He-cloud') biosphereViability = 0.52;

  if (solv.solvent !== 'H2O-subsurface' && solv.solvent !== 'H2-He-cloud' && pressurePa < 1500) {
    biosphereViability *= clamp(pressurePa / 1500, 0.05, 1.0);
  }
  const rBio = hash01((seed ^ 0x2b7e1516) >>> 0);
  const rCiv = hash01((seed ^ 0x7f4a7c15) >>> 0);
  if (biosphereViability > 0.15) {
    biosphereViability = clamp(biosphereViability * (0.70 + 0.45 * rBio), 0.0, 1.0);
  }

  let civTechK = 0.0;
  let civStage = 'Uninhabited';
  if (Number.isFinite(Number(civOverride)) && Number(civOverride) > 0) {
    civTechK = Number(Number(civOverride).toFixed(2));
  } else if (biosphereViability >= 0.42 && hasSolidCrust && !isMagmaOcean && rCiv > 0.34) {
    const f = clamp((rCiv - 0.34) / 0.66, 0, 1);
    civTechK = Number((0.36 + f * 0.68).toFixed(2));
  }
  if (civTechK >= 0.85) civStage = 'Type I Planetary Grid';
  else if (civTechK >= 0.68) civStage = 'Industrial Radio Era';
  else if (civTechK >= 0.50) civStage = 'Agrarian / Metallurgy';
  else if (civTechK >= 0.35) civStage = 'Settlement Megalithic';

  const labTempK = solv.solvent === 'H2SO4'
    ? 330
    : (solv.solvent === 'H2O-subsurface' || solv.solvent === 'H2-He-cloud'
      ? 295
      : clamp(Number(tempK) || 288, Math.max(82, solv.tMeltK - 4), Math.min(440, solv.tBoilK + 20)));

  // Higher UV flux raises Eigen template replication mutation rate `mu`!
  const mutationRateMu = Number(clamp(0.014 + 0.022 * Math.sqrt(uv), 0.010, 0.18).toFixed(3));
  const v0Propel = Number(clamp(1.35 * Math.pow(9.81 / g, 0.22) * (1.0 / (1.0 + 0.12 * rho)), 0.55, 2.35).toFixed(2));

  return Object.freeze({
    worldName,
    seed: (seed >>> 0),
    solvent: solv.solvent,
    solventFormula: solv.formula,
    solventLabel: solv.label,
    bainsScore: solv.bainsScore,
    oceanRgb: solv.oceanRgb,
    tMeltK: solv.tMeltK,
    tBoilK: solv.tBoilK,
    tDenatureK: solv.tDenatureK,
    dielectricEr: solv.dielectricEr,
    membraneType: solv.membraneType,
    compartmentModel: solv.compartmentModel,
    xnaBackbone: solv.xnaBackbone,
    xnaAlphabetSize: solv.xnaAlphabetSize,
    biosphereViability: Number(biosphereViability.toFixed(2)),
    civTechK,
    civStage,
    hasRadioBeacons: civTechK >= 0.65,
    hasNightCityLights: civTechK >= 0.55,
    bucklingHeightScale: eco.bucklingHeightScale,
    pigmentRgb: photo.primaryRgb,
    secondaryPigmentRgb: photo.secondaryRgb,
    floraArchWeights: eco.floraArchWeights,
    photobiology: photo,
    redox,
    ecosystem: eco,
    species: eco.species,
    stellarTeffK: Math.round(stellarTeffK),
    uvFluxNorm: Number(uv.toFixed(2)),
    gravityMS2: Number(g.toFixed(2)),
    pressurePa: Math.round(pressurePa),
    rhoAtmKgM3: Number(rho.toFixed(3)),
    hasSolidCrust: Boolean(hasSolidCrust),
    labParams: Object.freeze({
      memTempK: Math.round(labTempK),
      memEpsHp: solv.hydrophobicCoupling,
      memOsmotic: solv.solvent === 'H2O-subsurface' ? 0.42 : 0.25,
      foldTempK: Math.round(labTempK),
      foldEpsHp: solv.solvent === 'CH4' ? 0.68 : solv.hydrophobicCoupling,
      foldEpsHb: solv.hBondStrength,
      foldDielectricEr: solv.dielectricEr,
      foldSeq: eco.species[0]?.fasta || solv.sequence,
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
    recommendedMode: 'organism-overview'
  }),
  Object.freeze({
    id: 'titan-ch4',
    label: '🟠 Titan CH₄ Cryo-Sea',
    worldName: 'Titan (CH₄ Cryo-Sea)',
    tempK: 94, pressurePa: 146700, gravityMS2: 1.35, rhoAtmKgM3: 5.3,
    volatileFrac: 0.06, hasSolidCrust: true, isCryoMoon: false, stellarTeffK: 5778, uvFluxNorm: 0.12,
    recommendedMode: 'organism-overview'
  }),
  Object.freeze({
    id: 'mdwarf-crimson',
    label: '🔴 M-Dwarf Super-Earth',
    worldName: 'Proxima-like M-Dwarf World',
    tempK: 296, pressurePa: 185000, gravityMS2: 14.8, rhoAtmKgM3: 2.1,
    volatileFrac: 0.06, hasSolidCrust: true, isCryoMoon: false, stellarTeffK: 3150, uvFluxNorm: 3.4,
    recommendedMode: 'organism-overview'
  }),
  Object.freeze({
    id: 'venus-h2so4',
    label: '🟡 Venus H₂SO₄ Cloud Deck',
    worldName: 'Venus 52 km Acid Cloud Deck',
    tempK: 332, pressurePa: 9200000, gravityMS2: 8.87, rhoAtmKgM3: 1.15,
    volatileFrac: 0.02, hasSolidCrust: true, isCryoMoon: false, stellarTeffK: 5778, uvFluxNorm: 1.9,
    recommendedMode: 'organism-overview'
  }),
  Object.freeze({
    id: 'europa-vent',
    label: '🔵 Europa Hydrothermal',
    worldName: 'Europa Subsurface Vent',
    tempK: 102, pressurePa: 0, gravityMS2: 1.31, rhoAtmKgM3: 0.0,
    volatileFrac: 0.08, hasSolidCrust: true, isCryoMoon: true, stellarTeffK: 5778, uvFluxNorm: 0.05,
    recommendedMode: 'organism-overview'
  }),
  Object.freeze({
    id: 'jupiter-cloud',
    label: '🌀 Gas Giant Cloud Deck',
    worldName: 'Jovian Baroclinic Cloud Deck',
    tempK: 268, pressurePa: 420000, gravityMS2: 24.8, rhoAtmKgM3: 0.82,
    volatileFrac: 0.08, hasSolidCrust: false, isCryoMoon: false, stellarTeffK: 5778, uvFluxNorm: 0.18,
    recommendedMode: 'organism-overview'
  })
]);

/**
 * Synthesize a complete first-principles abducted biological specimen record
 * (Flora, Fungi/Chemotroph, or Fauna) directly from live planetary physics & world clade tree!
 */
export function synthesizeAbductedSpecimenRecord({
  kind = 'fauna',
  speciesRecord = null,
  worldName = 'Exoplanet',
  env = {},
  xeno = null,
  latDeg = 32.0,
  lonDeg = 0.0,
  seed = 1337
} = {}) {
  const prof = xeno || deriveXenobiologyProfile({
    worldName,
    tempK: env.tempK ?? 288,
    pressurePa: env.pressurePa ?? 101325,
    gravityMS2: env.gravityMS2 ?? 9.81,
    rhoAtmKgM3: env.rhoAtmKgM3 ?? 1.22,
    hasSolidCrust: env.hasSolidCrust !== false,
    seed
  });
  const g = Math.max(0.25, Number(env.gravityMS2 ?? prof.gravityMS2) || 9.81);
  const matchingPool = (prof.species || []).filter((s) => s.kingdom === kind);
  const pickedClade = speciesRecord
    || matchingPool[Math.floor(hash01(seed) * Math.max(1, matchingPool.length))]
    || (prof.species || [])[0]
    || null;

  const resolvedKind = pickedClade?.kingdom || (kind === 'flora' ? 'flora' : (kind === 'fungi' ? 'fungi' : 'fauna'));
  const bodyPlan = pickedClade?.bodyPlan || (resolvedKind === 'flora' ? 'branching-arbor' : (resolvedKind === 'fungi' ? 'mycelial-fruiting-tree' : 'quadruped-cursorial'));
  const speciesName = pickedClade?.speciesName || `${prof.solvent || 'Bio'} Specimen`;
  const morphClass = pickedClade?.morphClass || bodyPlan;
  const fasta = pickedClade?.fasta || String(prof.labParams?.foldSeq || 'HPPHH+PHHPPHH-PPHHPPH+PPH-PHHPPH');

  return Object.freeze({
    id: `spec-${resolvedKind}-${(seed >>> 0).toString(36)}`,
    seed: (pickedClade?.seed ?? seed) >>> 0,
    kind: resolvedKind,
    kingdom: resolvedKind,
    bodyPlan,
    trophicGuild: pickedClade?.trophicGuild || (resolvedKind === 'flora' ? 'producer' : (resolvedKind === 'fungi' ? 'decomposer' : 'grazer')),
    speciesName,
    morphClass,
    worldName,
    solvent: prof.solvent || 'H2O',
    solventFormula: prof.solventFormula || prof.solvent || 'H₂O',
    solventLabel: prof.solventLabel || prof.solvent || 'H₂O',
    membraneType: prof.membraneType || 'Phospholipid Bilayer',
    xnaBackbone: pickedClade?.xnaBackbone || prof.xnaBackbone || 'DNA/RNA',
    xnaAlphabetSize: pickedClade?.xnaAlphabetSize || prof.xnaAlphabetSize || 4,
    metabolicPathway: pickedClade?.metabolicPathway || prof.redox?.metabolicPathway || 'Oxygenic Photosynthesis',
    deltaGKjMol: pickedClade?.deltaGKjMol ?? prof.redox?.deltaGKjMol ?? -478,
    skeleton: pickedClade?.skeleton || 'Calcified Endoskeleton',
    sensoryOrgans: pickedClade?.sensoryOrgans || ['Photoreceptors'],
    primaryRgb: pickedClade?.primaryRgb || prof.pigmentRgb || [0.24, 0.56, 0.28],
    secondaryRgb: pickedClade?.secondaryRgb || [0.52, 0.42, 0.30],
    accentRgb: pickedClade?.accentRgb || [0.98, 0.88, 0.32],
    biolumRgb: pickedClade?.biolumRgb || [0.24, 0.96, 0.76],
    biolumIntensity: pickedClade?.biolumIntensity ?? 0.22,
    traits: pickedClade?.traits || { limbCount: 4, symmetry: 'bilateral', bodyMassKg: 70, kleiberWatts: 82, tOptK: Math.round(env.tempK ?? 288), tDenatureK: Math.round(prof.tDenatureK || 360) },
    anatomicalParts: pickedClade?.anatomicalParts || [],
    tempK: Math.round(prof.labParams?.memTempK ?? env.tempK ?? 288),
    gravityMS2: Number(g.toFixed(2)),
    pressurePa: Math.round(env.pressurePa ?? prof.pressurePa ?? 101325),
    rhoAtmKgM3: Number((env.rhoAtmKgM3 ?? prof.rhoAtmKgM3 ?? 1.22).toFixed(3)),
    stellarTeffK: Math.round(prof.stellarTeffK || 5778),
    uvFluxNorm: prof.uvFluxNorm ?? 1.0,
    fasta,
    // Default menu item for specimens picked up in ULG Universes is the interactive 3D Aquarium Viewer!
    recommendedBioMode: 'organism-overview',
    latDeg: Number(Number(latDeg || 0).toFixed(1)),
    lonDeg: Number(Number(lonDeg || 0).toFixed(1)),
    profile: prof
  });
}

export function buildLifeLabXenobiologyUrl(profile, mode = 'organism-overview', specimen = null) {
  const targetMode = specimen ? 'organism-overview' : (mode || 'organism-overview');
  const q = new URLSearchParams({
    xeno: '1',
    world: String(specimen?.worldName || profile?.worldName || 'Exoplanet'),
    T: String(Math.round(specimen?.tempK || profile?.labParams?.memTempK || 288)),
    P: String(Math.round(specimen?.pressurePa || profile?.pressurePa || 101325)),
    g: String(specimen?.gravityMS2 || profile?.gravityMS2 || 9.81),
    rho: String(specimen?.rhoAtmKgM3 ?? profile?.rhoAtmKgM3 ?? 1.22),
    solvent: String(specimen?.solvent || profile?.solvent || 'H2O'),
    teff: String(Math.round(specimen?.stellarTeffK || profile?.stellarTeffK || 5778)),
    uv: String(specimen?.uvFluxNorm || profile?.uvFluxNorm || 1.0),
    seed: String((specimen?.seed ?? profile?.seed ?? 20261125) >>> 0),
    mode: targetMode
  });
  if (specimen) {
    q.set('specimenKind', String(specimen.kingdom || specimen.kind || 'fauna'));
    q.set('bodyPlan', String(specimen.bodyPlan || 'quadruped-cursorial'));
    q.set('species', String(specimen.speciesName || 'Abducted Organism'));
    if (specimen.morphClass) q.set('morph', String(specimen.morphClass));
    if (specimen.fasta) q.set('fasta', String(specimen.fasta));
    if (Array.isArray(specimen.primaryRgb)) q.set('rgb1', specimen.primaryRgb.map((c) => c.toFixed(2)).join(','));
    if (Array.isArray(specimen.secondaryRgb)) q.set('rgb2', specimen.secondaryRgb.map((c) => c.toFixed(2)).join(','));
    if (Array.isArray(specimen.biolumRgb)) q.set('biolum', specimen.biolumRgb.map((c) => c.toFixed(2)).join(','));
    if (Number.isFinite(specimen.biolumIntensity)) q.set('bioStr', String(specimen.biolumIntensity));
    if (Number.isFinite(specimen.latDeg)) q.set('lat', String(specimen.latDeg));
    if (Number.isFinite(specimen.lonDeg)) q.set('lon', String(specimen.lonDeg));
  }
  return `./life-lab.html?${q.toString()}`;
}

function parseRgbCsv(str) {
  if (!str) return null;
  const parts = String(str).split(',').map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return Object.freeze(parts.map((c) => clamp(c, 0, 1)));
}

export function parseXenobiologyFromSearch(search = '') {
  const sp = new URLSearchParams(search || '');
  if (sp.get('xeno') !== '1') return null;
  const solventHint = sp.get('solvent') || '';
  const T = Number(sp.get('T')) || 288;
  const P = Number(sp.get('P')) || 101325;
  const g = Number(sp.get('g')) || 9.81;
  const rho = Number(sp.get('rho')) || 1.22;
  const teff = Number(sp.get('teff')) || 5778;
  const uv = Number(sp.get('uv')) || 1.0;
  const seed = Number(sp.get('seed')) || 20261125;
  const worldName = sp.get('world') || 'Alien World';
  const hasSolidCrust = solventHint !== 'H2-He-cloud';
  const baseProfile = deriveXenobiologyProfile({
    worldName,
    tempK: T,
    pressurePa: solventHint === 'H2SO4' ? Math.max(P, 1e6) : (solventHint === 'CH4' ? Math.max(P, 1e5) : P),
    gravityMS2: g,
    rhoAtmKgM3: rho,
    hasSolidCrust,
    isCryoMoon: solventHint === 'H2O-subsurface',
    volatileFrac: solventHint === 'CO2-liq' ? 0.004 : 0.05,
    stellarTeffK: teff,
    uvFluxNorm: uv,
    seed
  });
  const species = sp.get('species') || '';
  const specimenKind = sp.get('specimenKind') || '';
  const bodyPlan = sp.get('bodyPlan') || '';
  const fasta = sp.get('fasta') || '';
  const morph = sp.get('morph') || '';
  const modeParam = sp.get('mode') || (species ? 'organism-overview' : 'organism-overview');

  // Reconstruct full rich specimen record matching the world's clade tree so anatomicalParts & physiology are 100% populated!
  const matchedClade = (baseProfile.species || []).find((s) => (bodyPlan && s.bodyPlan === bodyPlan) || (specimenKind && s.kingdom === specimenKind))
    || (baseProfile.species || [])[0]
    || null;

  const abductedSpecimen = species
    ? Object.freeze({
      ...(matchedClade || {}),
      id: `abducted-${seed}`,
      seed,
      kind: specimenKind || matchedClade?.kingdom || 'fauna',
      kingdom: specimenKind || matchedClade?.kingdom || 'fauna',
      bodyPlan: bodyPlan || matchedClade?.bodyPlan || 'quadruped-cursorial',
      speciesName: species,
      morphClass: morph || matchedClade?.morphClass || (specimenKind === 'flora' ? 'Vascular Flora' : (specimenKind === 'fungi' ? 'Mycelial Fungi' : 'Motile Fauna')),
      worldName,
      solvent: baseProfile.solvent,
      solventFormula: baseProfile.solventFormula,
      primaryRgb: parseRgbCsv(sp.get('rgb1')) || matchedClade?.primaryRgb || baseProfile.pigmentRgb,
      secondaryRgb: parseRgbCsv(sp.get('rgb2')) || matchedClade?.secondaryRgb || [0.55, 0.45, 0.34],
      biolumRgb: parseRgbCsv(sp.get('biolum')) || matchedClade?.biolumRgb || [0.24, 0.96, 0.76],
      biolumIntensity: Number.isFinite(Number(sp.get('bioStr'))) ? Number(sp.get('bioStr')) : (matchedClade?.biolumIntensity ?? 0.25),
      fasta: fasta || matchedClade?.fasta || baseProfile.labParams.foldSeq,
      tempK: Math.round(T),
      gravityMS2: g,
      pressurePa: Math.round(P),
      latDeg: Number(sp.get('lat')) || 0,
      lonDeg: Number(sp.get('lon')) || 0
    })
    : null;

  const profile = abductedSpecimen
    ? Object.freeze({
      ...baseProfile,
      abductedSpecimen,
      labParams: Object.freeze({
        ...baseProfile.labParams,
        foldSeq: abductedSpecimen.fasta
      })
    })
    : baseProfile;
  return { profile, mode: modeParam, abductedSpecimen };
}
