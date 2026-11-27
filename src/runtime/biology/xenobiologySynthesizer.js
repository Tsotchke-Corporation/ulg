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
import {
  runPlanetaryCladogenesisWebGpu,
  synthesizeEmergentPlanetaryBiosphere
} from './evolutionaryCladogenesisGpu.js';
import { synthesizeOrganismBiochemistry } from './organismBiochemistryGenerator.js';
import {
  encodeDevelopmentalGenomeCompact,
  decodeDevelopmentalGenomeCompact
} from './developmentalGenome.js';

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
  seed = 20261125,
  cladogenesisOverride = null
} = {}) {
  const planetInputs = {
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
  };
  const ecoBase = synthesizeWorldEcosystem(planetInputs);
  // Stage 1–2 U12 Dogfooding: evolve per-planet Tree of Life via Planetary Niche Atlas +
  // Lotka-Volterra / Lindeman cladogenesis (ZERO legacy 17-menu template species!).
  const clado = cladogenesisOverride || synthesizeEmergentPlanetaryBiosphere(planetInputs, { targetSpeciesCount: 14 });
  const evolvedSpecies = (clado && Array.isArray(clado.species) && clado.species.length > 0)
    ? clado.species
    : ecoBase.species;
  const eco = Object.freeze({
    ...ecoBase,
    backend: clado?.backend || 'deterministic-cladogenesis',
    atlas: clado?.atlas || null,
    trophicBiomass: clado?.trophicBiomass || null,
    species: evolvedSpecies,
    trophicSummary: Object.freeze({
      producers: evolvedSpecies.filter((s) => s.kingdom === 'flora').length,
      decomposers: evolvedSpecies.filter((s) => s.kingdom === 'fungi').length,
      grazers: evolvedSpecies.filter((s) => s.kingdom === 'fauna' && !String(s.trophicGuild || '').includes('predator')).length,
      predators: evolvedSpecies.filter((s) => String(s.trophicGuild || '').includes('predator')).length,
      aerialOrAquatic: evolvedSpecies.filter((s) => s.medium === 'aerial' || s.medium === 'buoyant' || s.medium === 'aquatic').length
    })
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
    atlas: eco.atlas,
    cladogenesisBackend: eco.backend,
    trophicBiomass: eco.trophicBiomass,
    species: eco.species,
    tempK: Math.round(Number(tempK) || 288),
    volatileFrac: Number(volatileFrac) || 0.04,
    isCryoMoon: Boolean(isCryoMoon),
    isMagmaOcean: Boolean(isMagmaOcean),
    cToO: Number(cToO) || 0.55,
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

/**
 * Full WebGPU-Native Per-Planet Xenobiology Profile (runs Stage 2 200-epoch Lotka-Volterra
 * Lindeman cladogenesis directly on WebGPU in < 10 ms!).
 */
export async function evolveXenobiologyProfileWebGpu(device, opts = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    return deriveXenobiologyProfile(opts);
  }
  const clado = await runPlanetaryCladogenesisWebGpu(device, opts, { epochs: 200, targetSpeciesCount: 14 });
  return deriveXenobiologyProfile({ ...opts, cladogenesisOverride: clado });
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
    developmentalGenome: pickedClade?.developmentalGenome || null,
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

/**
 * Derive 100% organism- and organ-specific biophysical GPU parameters for ALL 5 Bio Lab
 * cellular/molecular layers (Membranes, Proteome Folding, XNA Replication, Bioenergetics/HH,
 * and Turing Morphogenesis/Motility) directly from the active living organism (`specimen`)
 * and clicked anatomical part (`partId`)!
 * Strictly Star Spec v0.4 compliant — ZERO hardcoded species or planet-name checks!
 */
export function deriveOrganismTissueLabParameters(specimen = null, worldProfile = null, {
  partId = null,
  partLabel = null,
  localTempK = null
} = {}) {
  const prof = worldProfile || specimen?.profile || deriveXenobiologyProfile(XENOBIOLOGY_PLANET_PRESETS[0]);
  const sp = specimen || prof.abductedSpecimen || (prof.species || []).find((s) => s.kingdom === 'fauna') || (prof.species || [])[0] || {};
  const lp = prof.labParams || {};
  const kingdom = sp.kingdom || sp.kind || 'fauna';
  const bodyPlan = sp.bodyPlan || 'quadruped-cursorial';
  const guild = String(sp.trophicGuild || (kingdom === 'flora' ? 'producer' : (kingdom === 'fungi' ? 'decomposer' : 'grazer'))).toLowerCase();
  const solvent = sp.solvent || prof.solvent || 'H2O';
  const solventFormula = sp.solventFormula || prof.solventFormula || solvent;
  const g = Math.max(0.25, Number(sp.gravityMS2 ?? prof.gravityMS2) || 9.81);
  const rho = Math.max(0, Number(sp.rhoAtmKgM3 ?? prof.rhoAtmKgM3) || 1.22);
  const uv = clamp(Number(sp.uvFluxNorm ?? prof.uvFluxNorm) || 1.0, 0.05, 8.0);
  const deltaG = Math.abs(Number(sp.deltaGKjMol ?? prof.redox?.deltaGKjMol ?? -478));
  const xnaAlpha = Math.max(4, Math.min(12, Math.trunc(Number(sp.xnaAlphabetSize ?? prof.xnaAlphabetSize) || 4)));
  const xnaBackbone = sp.xnaBackbone || prof.xnaBackbone || 'DNA/RNA';
  const speciesName = sp.speciesName || 'Native Specimen';
  const morphClass = sp.morphClass || bodyPlan;

  const rawBaseT = localTempK ?? ((solvent === 'H2O-subsurface' || solvent === 'H2-He-cloud') ? (lp.memTempK ?? 295) : (sp.tempK ?? sp.traits?.tOptK ?? lp.memTempK ?? 288));
  const baseT = Math.round(clamp(Number(rawBaseT), 75, 720));
  const pId = String(partId || '').toLowerCase();
  const organInfo = (sp.anatomicalParts || []).find((p) => p.id === pId) || null;
  const organLabel = partLabel || organInfo?.label || (kingdom === 'flora' ? 'Vascular Phototrophic Tissue' : (kingdom === 'fungi' ? 'Mycelial Metabolic Core' : 'Whole-Organism Somatic Tissue'));
  const organTissue = organInfo?.tissue || sp.skeleton || prof.membraneType || 'Biological Matrix';

  // --- LAYER 0B: BOTTOM-UP FIRST-PRINCIPLES ENVIRONMENTAL MOLECULAR BIOCHEMISTRY ---
  // Synthesizes actual 3D all-atom molecules, inverted vs polar solvophobic polarity,
  // Bjerrum screening length, thermal denaturation T_denature, solvent-matched XNA enthalpy,
  // Nernst reversal potentials, and Gray-Scott Turing kinetics strictly from planetary physics!
  const dielectricEr = Number(prof.dielectricEr ?? lp.foldDielectricEr ?? (solvent === 'CH4' ? 1.7 : (solvent === 'H2SO4' ? 101.0 : 78.4)));
  const cToO = Number(sp.cToO ?? prof.cToO ?? (solvent === 'CH4' ? 0.92 : 0.55));
  const feFrac = Number(sp.feFrac ?? prof.feFrac ?? (solvent === 'H2O-subsurface' ? 0.38 : 0.26));
  const silicateFrac = Number(sp.silicateFrac ?? prof.silicateFrac ?? 0.44);
  const biochem = synthesizeOrganismBiochemistry({
    solvent,
    tempK: baseT,
    pressurePa: Number(sp.pressurePa ?? prof.pressurePa ?? 101325),
    gravityMS2: g,
    dielectricEr,
    cToO,
    feFrac,
    silicateFrac,
    stellarTeffK: Number(sp.stellarTeffK ?? prof.stellarTeffK ?? 5778),
    redEdgeNm: Number(prof.photobiology?.redEdgeNm ?? 705),
    zSchemePhotons: Number(prof.photobiology?.zSchemePhotons ?? 2),
    uvFluxNorm: uv,
    xnaAlphabetSize: xnaAlpha,
    xnaBackbone,
    deltaGKjMol: -deltaG,
    kingdom,
    bodyPlan,
    organId: pId || 'whole',
    seed: ((sp.seed ?? prof.seed ?? 20261125) ^ (pId.length * 7919)) >>> 0
  });

  // --- LAYER 1: CELL MEMBRANE THERMODYNAMICS (Node #20) ---
  const baseEps = Number(lp.memEpsHp) || (solvent === 'CH4' ? 1.18 : (solvent === 'H2SO4' ? 2.15 : 1.85));
  const organStiffMod = (pId === 'sail' || pId === 'canopy' || pId === 'limbs') ? 0.16 : (pId === 'torso' ? -0.08 : 0.0);
  const memEpsHp = Number(clamp(baseEps + organStiffMod + (kingdom === 'flora' ? 0.14 : (kingdom === 'fungi' ? 0.10 : 0.0)), 0.45, 2.85).toFixed(2));
  const memOsmotic = Number(clamp(
    bodyPlan === 'aero-gasbag'
      ? -0.22
      : (bodyPlan === 'aquatic-swimmer' || solvent === 'H2O-subsurface'
        ? 0.44
        : (kingdom === 'flora' ? 0.34 : (kingdom === 'fungi' ? 0.24 : 0.12))),
    -1.0, 1.0
  ).toFixed(2));
  const recommendedMemMode = (pId === 'sail' || pId === 'canopy' || kingdom === 'flora')
    ? 'lipid-bilayer'
    : 'protocell-vesicle';
  const membraneLabel = `${prof.membraneType || 'Amphiphile Bilayer'} (${solventFormula} · ${biochem.isNonpolar ? 'Inverted' : (biochem.isMonolayer ? 'Monolayer' : 'Polar')})`;

  // --- LAYER 2: TISSUE PROTEOME & BIOPOLYMER FOLDING (Node #21) ---
  // Bottom-up environmentally synthesized 22..44-mer H/P/+/- sequence driven by solvent polarity & ε_r!
  const baseFasta = biochem.foldSeq || String(sp.fasta || lp.foldSeq || 'HPPHH+PHHPPHH-PPHHPPH+PPH-PHHPPH').replace(/[^HP+\-]/g, '');
  let proteinName = 'Somatic Structural Catalyst';
  let recommendedFoldMode = 'amphipathic-helix-bundle';
  let foldSeq = baseFasta;
  const isAcidOrHot = solvent === 'H2SO4' || baseT > 340;
  const isCryo = solvent === 'CH4' || baseT < 150;
  if (pId === 'head') {
    proteinName = `${isCryo ? 'Cryo-Inverted ' : (isAcidOrHot ? 'Acid-Stable ' : '')}Photoreceptor / Sensory Opsin`;
    recommendedFoldMode = 'amphipathic-helix-bundle';
  } else if (pId === 'torso') {
    proteinName = kingdom === 'flora'
      ? 'Vascular Lignin-Proton ATPase'
      : (kingdom === 'fungi' ? 'Redox Metabolic Dehydrogenase' : `${isAcidOrHot ? 'Acid-Stable ' : (isCryo ? 'Cryo-Core ' : '')}Contractile & Metabolic Core`);
    recommendedFoldMode = 'globular-hydrophobic-core';
  } else if (pId === 'limbs') {
    proteinName = `${isCryo ? 'Cryo-Flexible ' : ''}Locomotor Actomyosin Fiber`;
    recommendedFoldMode = 'amphipathic-helix-bundle';
  } else if (pId === 'canopy') {
    proteinName = `Multi-Photon Reaction Center (${Math.round(prof.stellarTeffK || 5778)} K Star)`;
    recommendedFoldMode = 'globular-hydrophobic-core';
  } else if (pId === 'sail' || pId === 'spores') {
    proteinName = pId === 'spores' ? `${xnaAlpha}-Base XNA Polymerase Core` : 'Thermal Radiator β-Sheet Keratin';
    recommendedFoldMode = 'beta-hairpin-fold';
  } else {
    proteinName = kingdom === 'flora'
      ? `Photopigment Reaction-Center Fold (${speciesName})`
      : (kingdom === 'fungi'
        ? `Chemotrophic Redox Enzyme (${speciesName})`
        : `${isCryo ? 'Inverted Polar-Core ' : (isAcidOrHot ? 'Acidophile ' : '')}Proteome (${morphClass})`);
  }
  const foldEpsHp = Number(clamp((Number(lp.foldEpsHp) || baseEps) + (pId === 'torso' ? 0.14 : 0.0), 0.45, 2.85).toFixed(2));
  const foldEpsHb = Number(clamp((Number(lp.foldEpsHb) || 1.45) + (isAcidOrHot ? 0.28 : (isCryo ? -0.25 : 0.0)), 0.55, 2.75).toFixed(2));

  // --- LAYER 3: GENOME REPLICATION & EIGEN THRESHOLD (Node #22) ---
  const atmShield = Math.exp(-Math.min(10, Number(sp.pressurePa ?? prof.pressurePa ?? 101325) / 1.8e5));
  const evoMu = Number(clamp(0.011 + 0.018 * Math.sqrt(uv) * (0.55 + 0.45 * atmShield) + (baseT > 340 ? 0.015 : 0.0), 0.008, 0.18).toFixed(3));
  const evoBeta = Number(clamp(
    guild.includes('predator') ? 3.35 : (kingdom === 'fauna' ? 2.65 : (kingdom === 'fungi' ? 2.10 : 1.90)),
    1.2, 4.4
  ).toFixed(2));
  const evoStrongFrac = Number(clamp(
    0.34 + ((xnaAlpha - 4) / 8) * 0.24 + clamp((baseT - 150) / 300, 0, 1) * 0.28,
    0.20, 0.88
  ).toFixed(2));
  const genomeLabel = `${xnaAlpha}-Base ${xnaBackbone}`;

  // --- LAYER 4: BIOENERGETICS & EXCITABLE SIGNALING (Node #23) ---
  const isNeuralPart = pId === 'head' || pId === 'limbs';
  const hhGNa = Math.round(clamp(
    kingdom === 'fauna'
      ? ((guild.includes('predator') || isNeuralPart ? 142 : 112) * (bodyPlan === 'aero-gasbag' ? 0.86 : 1.0))
      : (kingdom === 'fungi' ? 52 : 38),
    20, 175
  ));
  const hhGK = Math.round(clamp(hhGNa * 0.31, 12, 68));
  const hhDeltaPsi = Math.round(clamp(75 + (deltaG / 520) * 95 + (kingdom === 'fauna' ? 15 : 0), 70, 210));
  const hhDeltaPh = Number(clamp(
    Number(lp.hhDeltaPh) || (solvent === 'H2SO4' ? 1.85 : (solvent === 'CH4' ? 0.45 : 1.05)),
    0.25, 2.35
  ).toFixed(2));
  const recommendedHhMode = (kingdom === 'fauna' && (isNeuralPart || guild.includes('predator')))
    ? 'excitable-spiral'
    : 'excitable-pulse';
  const bioenergeticLabel = `${String(sp.metabolicPathway || prof.redox?.metabolicPathway || 'Redox Chemiosmosis').split('(')[0].trim()} · ΔG=${-Math.round(deltaG)} kJ/mol`;

  // --- LAYER 5: EMBRYONIC MORPHOGENESIS & CELLULAR MOTILITY (Node #24) ---
  const planSpeedFactor = bodyPlan === 'wing-glider' ? 1.38
    : (bodyPlan === 'aquatic-swimmer' ? 1.30
      : (bodyPlan === 'quadruped-cursorial' || bodyPlan === 'biped-strider' ? 1.18
        : (bodyPlan === 'aero-gasbag' ? 0.88
          : (kingdom === 'fauna' ? 1.0 : (kingdom === 'fungi' ? 0.48 : 0.36)))));
  const morphV0 = Number(clamp(1.28 * planSpeedFactor * Math.pow(9.81 / g, 0.18) / (1.0 + 0.08 * rho), 0.25, 2.45).toFixed(2));
  const morphChemo = Number(clamp(
    kingdom === 'fauna'
      ? (guild.includes('predator') ? 3.35 : 2.45)
      : (kingdom === 'fungi' ? 2.15 : 1.35),
    0.8, 4.2
  ).toFixed(2));
  const c1 = sp.primaryRgb || [0.3, 0.6, 0.4];
  const c2 = sp.secondaryRgb || [0.4, 0.4, 0.3];
  const pigmentContrast = Math.hypot(c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2]);
  // Super-critical Turing diffusion ratio D_u / D_v (>= 1.95 required for Gray-Scott Turing bifurcation!)
  const morphDiffRatio = Number(clamp(1.96 + pigmentContrast * 0.44, 1.95, 2.45).toFixed(2));
  const recommendedMorphMode = sp.traits?.symmetry === 'radial'
    ? 'turing-spots'
    : (kingdom === 'flora' || kingdom === 'fungi' ? 'mitosis-division' : 'turing-labyrinth');
  const morphLabel = `Embryonic ${morphClass} Patterning (${sp.traits?.symmetry || 'bilateral'})`;

  // Solvent-specific biochemical membrane head/tail visual colors + 3 distinct organ-specific protein FASTA sequences
  const memHeadRgb = solvent === 'CH4' ? [0.18, 0.86, 0.98]
    : (solvent === 'H2SO4' ? [0.96, 0.62, 0.14]
      : (solvent === 'NH3' ? [0.68, 0.44, 0.98]
        : (solvent === 'H2-He-cloud' ? [0.92, 0.42, 0.78] : [0.20, 0.76, 0.96])));
  const memTailRgb = solvent === 'CH4' ? [0.46, 0.34, 0.88]
    : (solvent === 'H2SO4' ? [0.22, 0.82, 0.56]
      : (solvent === 'NH3' ? [0.24, 0.84, 0.72] : [0.96, 0.78, 0.24]));
  const organProteins = Object.freeze({
    'amphipathic-helix-bundle': foldSeq,
    'globular-hydrophobic-core': `${foldSeq.slice(0, 12)}HHHHHP+-HHHH${foldSeq.slice(-10)}`,
    'beta-hairpin-fold': `HPHPHPHPP${solvent === 'H2SO4' ? '++HPHPHPH--' : '+-HPHPHPH+-'}HPHPHPH`
  });
  const shortSp = speciesName.split(' ')[0] || 'Organism';
  const mols = biochem.molecules;
  const modeLabels = Object.freeze({
    'bio-mol-membrane': { title: mols['bio-mol-membrane'].name.slice(0, 31), tag: mols['bio-mol-membrane'].formula },
    'bio-mol-genetic': { title: mols['bio-mol-genetic'].name.slice(0, 31), tag: mols['bio-mol-genetic'].formula },
    'bio-mol-energy': { title: mols['bio-mol-energy'].name.slice(0, 31), tag: mols['bio-mol-energy'].formula },
    'bio-mol-pigment': { title: mols['bio-mol-pigment'].name.slice(0, 31), tag: mols['bio-mol-pigment'].formula },
    'protocell-vesicle': { title: `${shortSp} ${biochem.isNonpolar ? 'Inverted' : (biochem.isMonolayer ? 'Monolayer' : solventFormula)} Vesicle`, tag: `${baseT} K` },
    'lipid-bilayer': { title: `${organLabel.split(' ')[0]} ${biochem.isNonpolar ? 'Azoto-' : ''}Membrane`, tag: `ε_r=${dielectricEr.toFixed(0)}` },
    'lipid-soup': { title: `${solventFormula} ${biochem.isNonpolar ? 'Reverse' : 'Amphiphile'} MD`, tag: `ε=${memEpsHp}` },
    'amphipathic-helix-bundle': { title: proteinName.slice(0, 32), tag: `${foldSeq.length}-mer` },
    'globular-hydrophobic-core': { title: `${shortSp} ${biochem.isNonpolar ? 'Polar-Core' : 'Core'} Enzyme`, tag: `${organProteins['globular-hydrophobic-core'].length}-mer` },
    'beta-hairpin-fold': { title: `${shortSp} Structural Sheet`, tag: `T_den=${biochem.tDenatureK}K` },
    'quasispecies-evolution': { title: `${xnaAlpha}-Base ${shortSp} XNA Pool`, tag: `T_m=${Math.round(biochem.xnaTargetTmK)}K` },
    'excitable-spiral': {
      title: `${shortSp} ${biochem.channelIons.depolIon}/${biochem.channelIons.repolIon} Wave`,
      tag: `${biochem.channelIons.eDepolMv > 0 ? '+' : ''}${Math.round(biochem.channelIons.eDepolMv)}mV`
    },
    'excitable-pulse': {
      title: `${shortSp} ${biochem.energyCurrencyName.split(' ')[0]} Pump`,
      tag: `${biochem.energyCurrencyKjMol} kJ`
    },
    'turing-spots': { title: `${shortSp} Dermal Spot Pattern`, tag: `F=${biochem.turingKinetics.feedF}` },
    'turing-labyrinth': { title: `${shortSp} Body-Plan Stripes`, tag: `k=${biochem.turingKinetics.killK}` },
    'mitosis-division': { title: `${shortSp} Tissue Mitosis`, tag: `v₀=${morphV0}` }
  });

  return Object.freeze({
    speciesName,
    worldName: sp.worldName || prof.worldName || 'World',
    kingdom,
    bodyPlan,
    morphClass,
    solvent,
    solventFormula,
    dielectricEr: biochem.dielectricEr,
    solventPolarity: biochem.solventPolarity,
    isNonpolar: biochem.isNonpolar,
    isMonolayer: biochem.isMonolayer,
    bjerrumLengthA: biochem.bjerrumLengthA,
    tDenatureK: biochem.tDenatureK,
    xnaAlphabetSize: xnaAlpha,
    xnaBackbone,
    xnaDhPerPairKj: biochem.xnaDhPerPairKj,
    xnaDsPerPairJ: biochem.xnaDsPerPairJ,
    xnaTargetTmK: biochem.xnaTargetTmK,
    energyCurrencyName: biochem.energyCurrencyName,
    energyCurrencyKjMol: biochem.energyCurrencyKjMol,
    channelIons: biochem.channelIons,
    turingFeedF: biochem.turingKinetics.feedF,
    turingKillK: biochem.turingKinetics.killK,
    molecules: biochem.molecules,
    biochem,
    primaryRgb: Object.freeze([c1[0], c1[1], c1[2]]),
    secondaryRgb: Object.freeze([c2[0], c2[1], c2[2]]),
    memHeadRgb: Object.freeze(memHeadRgb),
    memTailRgb: Object.freeze(memTailRgb),
    organProteins,
    modeLabels,
    organId: pId || 'whole',
    organLabel,
    organTissue,
    baseTempK: baseT,
    memTempK: baseT,
    memEpsHp,
    memOsmotic,
    membraneLabel,
    recommendedMemMode,
    foldSeq,
    foldTempK: baseT,
    foldEpsHp,
    foldEpsHb,
    proteinName,
    recommendedFoldMode,
    evoMu,
    evoBeta,
    evoStrongFrac,
    genomeLabel,
    hhGNa,
    hhGK,
    hhDeltaPsi,
    hhDeltaPh,
    bioenergeticLabel,
    recommendedHhMode,
    morphV0,
    morphChemo,
    morphDiffRatio,
    morphLabel,
    recommendedMorphMode
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
    cToO: String(Number(specimen?.cToO ?? profile?.cToO ?? 0.55).toFixed(2)),
    feFrac: String(Number(specimen?.feFrac ?? profile?.feFrac ?? 0.26).toFixed(2)),
    siFrac: String(Number(specimen?.silicateFrac ?? profile?.silicateFrac ?? 0.44).toFixed(2)),
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
    if (specimen.developmentalGenome) {
      try {
        const compact = encodeDevelopmentalGenomeCompact(specimen.developmentalGenome);
        if (compact) q.set('dg', JSON.stringify(compact));
      } catch {}
    }
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
  const cToO = Number.isFinite(Number(sp.get('cToO'))) && sp.get('cToO') !== null ? Number(sp.get('cToO')) : 0.55;
  const feFrac = Number.isFinite(Number(sp.get('feFrac'))) && sp.get('feFrac') !== null ? Number(sp.get('feFrac')) : 0.26;
  const silicateFrac = Number.isFinite(Number(sp.get('siFrac'))) && sp.get('siFrac') !== null ? Number(sp.get('siFrac')) : 0.44;
  const seed = Number(sp.get('seed')) || 20261125;
  const worldName = sp.get('world') || 'Alien World';
  const hasSolidCrust = solventHint !== 'H2-He-cloud';
  const baseProfileRaw = deriveXenobiologyProfile({
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
    cToO,
    seed
  });
  const baseProfile = Object.freeze({ ...baseProfileRaw, cToO, feFrac, silicateFrac });
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
  let parsedGenome = matchedClade?.developmentalGenome || null;
  if (sp.get('dg')) {
    try {
      const dec = decodeDevelopmentalGenomeCompact(JSON.parse(sp.get('dg')));
      if (dec) parsedGenome = dec;
    } catch {}
  }

  const abductedSpecimen = species
    ? Object.freeze({
      ...(matchedClade || {}),
      id: `abducted-${seed}`,
      seed,
      kind: specimenKind || matchedClade?.kingdom || 'fauna',
      kingdom: specimenKind || matchedClade?.kingdom || 'fauna',
      bodyPlan: bodyPlan || matchedClade?.bodyPlan || 'quadruped-cursorial',
      speciesName: species,
      morphClass: morph || parsedGenome?.morphDescriptor || matchedClade?.morphClass || (specimenKind === 'flora' ? 'Vascular Flora' : (specimenKind === 'fungi' ? 'Mycelial Fungi' : 'Motile Fauna')),
      developmentalGenome: parsedGenome,
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
