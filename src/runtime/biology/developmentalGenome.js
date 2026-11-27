// Stage 3 of ULG Emergent Alien Ecosystems (`src/runtime/biology/developmentalGenome.js`).
//
// Compact, deterministic (~320-byte serialized) Continuous Developmental Genome
// (`ulg.biology.developmental-genome.v1`) encoding HOW an organism grows from an
// embryo/seed via Hox axial segmentation, vascular/appendage L-system grammar,
// biomechanical Euler/Murray/Strouhal/CoM constraints, and 3D Turing integument.
//
// ZERO fixed body-plan or 6-flora template enum switches! Every evolved species
// compiles directly into GPU 3D SDF primitives (smooth capsules, ellipsoids,
// sharp carapace plates, thin warped fins/wings/fronds) + bone weights + organ zones.

export const ULG_DEVELOPMENTAL_GENOME_SCHEMA = 'ulg.biology.developmental-genome.v1';

export const ORGAN_ZONE_IDS = Object.freeze({
  TORSO_CORE: 0,
  HEAD_SENSORY: 1,
  LIMB_LOCOMOTOR: 2,
  RESPIRATORY_SAIL: 3,
  CANOPY_COLLECTOR: 4,
  BIOLUM_TAIL: 5
});

export const SDF_PRIM_TYPES = Object.freeze({
  SMOOTH_CAPSULE: 0,
  ELLIPSOID_BLADDER: 1,
  CARAPACE_PLATE: 2,
  THIN_FIN_FROND: 3
});

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hashU32(seed) {
  let x = (seed >>> 0) || 1;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

function makeRng(seed) {
  let a = hashU32(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Synthesize a continuous Developmental Genome from evolved cladogenesis trait
 * coordinates + planetary Habitat Tensor + niche physics (ZERO fixed templates!).
 */
export function buildDevelopmentalGenome({
  seed = 1337,
  kingdom = 'fauna',
  trophicGuild = 'grazer',
  niche = {},
  tensor = {},
  evolvedTraits = null,
  colors = {}
} = {}) {
  const rng = makeRng((seed ^ 0x4f1bbcdc) >>> 0);
  const g = Math.max(0.2, Number(tensor.gravityMS2 ?? niche.gravityMS2 ?? 9.81));
  const rhoAtm = Math.max(0, Number(tensor.rhoAtmKgM3 ?? 1.22));
  const medium = String(niche.medium || (tensor.hasSolidCrust === false ? 'buoyant' : 'terrestrial'));
  const T = Math.max(50, Number(niche.tempK ?? tensor.tempK ?? 288));
  const light = clamp(Number(niche.lightFluxNorm ?? 0.9), 0.02, 2.0);
  const wind = Math.max(0, Number(niche.windMS ?? tensor.windMeanMS ?? 4.5));
  const buck = clamp(Number(tensor.bucklingHeightScale ?? Math.pow(9.81 / g, 1 / 3)), 0.38, 3.1);

  // Pull continuous co-evolved coordinates from GPU cladogenesis if present
  const evoSym = evolvedTraits?.symmetryBias ?? rng();
  const evoElong = evolvedTraits?.elongation ?? rng();
  const evoArmor = evolvedTraits?.armor ?? rng();
  const evoAppend = evolvedTraits?.appendageDensity ?? rng();
  const evoCanopy = evolvedTraits?.collectorSpread ?? rng();
  const evoSail = evolvedTraits?.thermalSail ?? clamp((T - 285) / 90 + (rng() - 0.5) * 0.6, 0, 1);
  const evoSpeed = evolvedTraits?.agility ?? rng();
  const evoSize = evolvedTraits?.sizeFactor ?? (0.55 + rng() * 0.95);

  const isFlora = kingdom === 'flora';
  const isFungi = kingdom === 'fungi';
  const isPred = String(trophicGuild).includes('predator');
  const isAir = medium === 'aerial' || medium === 'buoyant';
  const isAqua = medium === 'aquatic';

  // 1. Continuous symmetry order radiation (2=bilateral, 3=triradial, 4=tetra, 5=penta, 6=hexa, 7=helical-chiral)
  let symmetryOrder = 2;
  if (isFlora || isFungi) {
    const syms = [3, 4, 5, 6, 7];
    symmetryOrder = syms[Math.min(syms.length - 1, Math.floor(evoSym * syms.length))];
  } else if (isAir || isAqua) {
    // Aquatic & buoyant/aerial worlds radiate bilateral + radial + helical phyla freely!
    const syms = [2, 2, 3, 4, 5, 6, 7];
    symmetryOrder = syms[Math.min(syms.length - 1, Math.floor(evoSym * syms.length))];
  } else {
    // Terrestrial worlds radiate bilateral + triradial + tetraradial + pentaradial + hexaradial phyla!
    const syms = [2, 2, 2, 3, 4, 5, 6];
    symmetryOrder = syms[Math.min(syms.length - 1, Math.floor(evoSym * syms.length))];
  }

  // 2. Axial Hox-segment spline profile (3..11 metameres)
  const segmentCount = isFlora
    ? Math.round(lerp(4, 9, evoElong))
    : (isFungi ? Math.round(lerp(3, 7, evoElong)) : Math.round(lerp(4, 10, evoElong)));
  const axialAspect = isFlora
    ? clamp(lerp(0.85, 2.5, evoElong) * Math.pow(buck, 0.85), 0.55, 4.2)
    : (isFungi
      ? clamp(lerp(0.55, 1.85, evoElong) * Math.pow(buck, 0.55), 0.45, 2.8)
      : clamp(lerp(0.70, 2.15, evoElong) * (isAqua ? 1.3 : 1.0), 0.55, 2.8));

  const spineArch = (rng() - 0.42) * (isFlora ? 0.65 : 0.72);
  const spineTwist = symmetryOrder === 7 ? (1.2 + rng() * 2.1) : ((rng() - 0.5) * 0.45);
  const postureTiltRad = isFlora || isFungi
    ? clamp((wind / 35) * (0.12 + rng() * 0.28), 0, 0.48)
    : (isAir || isAqua ? (rng() - 0.5) * 0.25 : clamp(lerp(-0.12, 0.72, rng() * (g < 8 ? 1.0 : 0.45)), -0.15, 0.85));

  // Taper profile along spine (Gaussian belly / bulb / Murray's Law trunk taper)
  const bellyPeakU = isFlora ? 0.12 : clamp(0.28 + rng() * 0.44, 0.18, 0.78);
  const bellyBulge = isFlora
    ? clamp(0.14 + 0.22 * (g / 9.81) * 0.5 + rng() * 0.14, 0.12, 0.48)
    : clamp(0.22 + (1 - evoSpeed) * 0.24 + (medium === 'buoyant' ? 0.28 : 0) + rng() * 0.16, 0.18, 0.72);
  const eccentricityXZ = clamp(0.62 + rng() * 0.78, 0.55, 1.55);

  // Smooth organic blending (high kBlend) vs sharp armored carapace plates (low kBlend + ridgeCount)
  const carapaceHardness = clamp(evoArmor * 0.75 + (g > 13 ? 0.20 : 0) + (isPred ? 0.12 : 0), 0.05, 0.98);
  const kBlend = Number(lerp(0.24, 0.045, carapaceHardness).toFixed(3));
  const armorPlateCount = carapaceHardness > 0.42 ? Math.round(lerp(2, 7, carapaceHardness)) : 0;

  // 3. Appendage / Branching L-System Grammar (Murray's Law + Euler buckling + CoM stability)
  let appendageGroups = 0;
  let appendagesPerWhorl = symmetryOrder;
  let jointCount = 2;
  let limbLengthRatio = 0.75;
  let limbThicknessRatio = 0.14;
  let phyllotaxisAngleRad = 2.3999632297 * (0.86 + rng() * 0.28); // perturbed golden angle!

  if (isFlora || isFungi) {
    appendageGroups = Math.round(lerp(2, 6, evoAppend));
    appendagesPerWhorl = clamp(symmetryOrder + Math.floor(rng() * 3) - 1, 2, 7);
    jointCount = Math.round(lerp(2, 4, evoCanopy));
    limbLengthRatio = clamp(lerp(0.35, 1.18, evoCanopy) * Math.pow(9.81 / g, 0.25), 0.28, 1.65);
    // Euler buckling dictates thicker branches/trunks at high g!
    limbThicknessRatio = clamp(0.085 * Math.pow(g / 9.81, 0.34) * (0.78 + rng() * 0.48), 0.04, 0.30);
  } else {
    // Fauna locomotor appendages strictly governed by gravity g, medium density rho, & symmetry S!
    if (medium === 'terrestrial') {
      const pairBase = g > 14 ? (rng() < 0.65 ? 3 : 4) : (g < 4.5 ? (rng() < 0.48 ? 1 : 2) : (rng() < 0.42 ? 2 : 3));
      appendageGroups = symmetryOrder === 2 ? pairBase : Math.max(1, Math.round(lerp(1, 3, evoAppend)));
      appendagesPerWhorl = symmetryOrder === 2 ? 2 : symmetryOrder;
      jointCount = Math.round(lerp(2, 4, evoSpeed));
      limbLengthRatio = clamp(lerp(0.42, 1.22, evoSpeed) * Math.pow(9.81 / g, 0.34), 0.26, 1.55);
      // Muscle cross-section scales with g * M^(2/3) => thicker sturdy pillars at high g!
      limbThicknessRatio = clamp(0.09 * Math.pow(g / 9.81, 0.42) * (0.78 + (1 - evoSpeed) * 0.45), 0.045, 0.32);
    } else if (medium === 'aerial') {
      appendageGroups = Math.round(lerp(1, 3, evoAppend));
      appendagesPerWhorl = symmetryOrder === 2 ? 2 : Math.min(4, symmetryOrder);
      jointCount = 3;
      // Wing span scales with sqrt(g / rho_atm) for lift balance!
      const wingScale = clamp(Math.pow(g / Math.max(0.25, rhoAtm * 8.0), 0.28), 0.65, 1.75);
      limbLengthRatio = clamp(lerp(0.85, 1.65, evoCanopy) * wingScale, 0.65, 2.2);
      limbThicknessRatio = clamp(0.055 + rng() * 0.04, 0.04, 0.14);
    } else if (medium === 'buoyant') {
      appendageGroups = Math.round(lerp(1, 3, evoAppend));
      appendagesPerWhorl = clamp(symmetryOrder, 3, 6);
      jointCount = 3;
      limbLengthRatio = clamp(lerp(0.60, 1.45, evoAppend), 0.45, 1.75);
      limbThicknessRatio = clamp(0.045 + rng() * 0.045, 0.035, 0.12);
    } else {
      // Aquatic: hydrofoil fins + undulatory propulsion
      appendageGroups = Math.round(lerp(1, 3, evoAppend));
      appendagesPerWhorl = symmetryOrder === 2 ? 2 : symmetryOrder;
      jointCount = 2;
      limbLengthRatio = clamp(lerp(0.45, 1.05, evoCanopy), 0.35, 1.35);
      limbThicknessRatio = clamp(0.065 + rng() * 0.045, 0.04, 0.15);
    }
  }

  // 4. Center-of-Mass stability & biomechanical gait / Strouhal frequency
  const neckRatio = isFlora || isFungi ? 0.0 : clamp(lerp(0.18, 0.85, rng()) * (1 + evoSail * 0.25), 0.12, 1.15);
  const headRadius = isFlora || isFungi ? 0.0 : clamp(0.14 + (isPred ? 0.08 : 0.02) + rng() * 0.12, 0.11, 0.36);
  // Balance anterior head+neck moment automatically with counterbalancing tail!
  const tailLengthRatio = isFlora || isFungi
    ? 0.0
    : clamp(0.35 + neckRatio * 0.68 + (isAqua ? 0.45 : 0) + (rng() - 0.35) * 0.35, 0.18, 1.55);

  const legLenM = Math.max(0.15, limbLengthRatio * evoSize * 0.9);
  const froudeNum = clamp(0.32 + evoSpeed * 0.85, 0.18, 1.6);
  const gaitFreqHz = medium === 'terrestrial'
    ? Number(clamp((1 / (2 * Math.PI)) * Math.sqrt(g / legLenM) * Math.sqrt(froudeNum), 0.32, 4.8).toFixed(3))
    : Number(clamp(0.28 * (1.8 + evoSpeed * 2.6) / Math.max(0.35, evoSize), 0.35, 4.2).toFixed(3));

  // 5. Collector / Foliage / Fin / Sail / Gas-Bladder Morphology (continuous ratios!)
  const collectorType = rng(); // continuous blend: 0..0.25 spire-needle, 0.25..0.5 broad-frond, 0.5..0.75 dome/coral-fan, 0.75..1.0 lifting-bladder/spiral
  const collectorSpread = clamp(lerp(0.28, 1.15, evoCanopy) * (light < 0.45 ? 1.25 : 0.92), 0.22, 1.55);
  const collectorCurl = (rng() - 0.45) * 1.35;
  const hasGasBladder = (medium === 'buoyant') || ((isFlora || isAir) && tensor.aerialEase > 1.35 && rng() < 0.62);
  const gasBladderRadius = hasGasBladder ? clamp(0.30 + rng() * 0.34, 0.26, 0.72) : 0.0;
  const dorsalSailHeight = !isFlora && !isFungi
    ? clamp(evoSail * (0.28 + rng() * 0.52), 0.0, 0.92)
    : 0.0;
  const wingMembraneSpan = (medium === 'aerial')
    ? clamp(0.75 + evoCanopy * 0.95, 0.65, 1.85)
    : ((isAqua && rng() < 0.75) ? clamp(0.35 + rng() * 0.45, 0.28, 0.85) : 0.0);

  // 6. Cranial Sensory & Feeding Complex
  const receptorCount = isFlora || isFungi
    ? 0
    : (symmetryOrder > 2 ? symmetryOrder : (rng() < 0.55 ? 2 : (rng() < 0.75 ? 4 : 6)));
  const receptorStalkLen = isFlora || isFungi ? 0.0 : clamp((rng() < 0.38 ? 0.14 + rng() * 0.24 : 0.02), 0.0, 0.42);
  const receptorAperture = clamp(0.032 + (1.0 / Math.max(0.35, light)) * 0.012 + rng() * 0.018, 0.028, 0.068);
  const crestOrHornLen = !isFlora && !isFungi && (rng() < 0.58) ? clamp(0.14 + rng() * 0.42, 0.1, 0.62) : 0.0;
  const crestCurvature = (rng() - 0.5) * 1.4;

  // 7. 3D Turing Reaction-Diffusion Integument Seed (Gray-Scott F, k, scale, anisotropy)
  // Valid morphogenetic Turing band: F in [0.022, 0.062], k in [0.052, 0.066]
  const turingF = Number(lerp(0.024, 0.058, rng()).toFixed(4));
  const turingK = Number(clamp(lerp(0.054, 0.0645, rng()), turingF + 0.008, 0.066).toFixed(4));
  const turingScale = Number(lerp(2.2, 7.8, rng()).toFixed(2));
  const turingAniso = Number(lerp(0.45, 2.4, rng()).toFixed(2));
  const iridescenceStrength = Number(clamp((isAqua || isAir || rng() < 0.35) ? (0.18 + rng() * 0.42) : 0.05, 0, 0.7).toFixed(2));

  const primaryRgb = Array.isArray(colors.primaryRgb) ? colors.primaryRgb.map((c) => Number(clamp(c, 0.04, 0.98).toFixed(3))) : [0.32, 0.62, 0.36];
  const secondaryRgb = Array.isArray(colors.secondaryRgb) ? colors.secondaryRgb.map((c) => Number(clamp(c, 0.04, 0.98).toFixed(3))) : [0.58, 0.48, 0.36];
  const accentRgb = Array.isArray(colors.accentRgb) ? colors.accentRgb.map((c) => Number(clamp(c, 0.04, 0.98).toFixed(3))) : [0.94, 0.78, 0.28];
  const biolumRgb = Array.isArray(colors.biolumRgb) ? colors.biolumRgb.map((c) => Number(clamp(c, 0.04, 1.0).toFixed(3))) : [0.22, 0.96, 0.82];
  const biolumIntensity = Number(clamp(Number(colors.biolumIntensity ?? (light < 0.45 ? 0.65 : 0.14)), 0, 1).toFixed(2));

  // Derive descriptive emergent morphology class (purely descriptive from continuous traits — ZERO template switching!)
  const symName = symmetryOrder === 2 ? 'Bilateral' : (symmetryOrder === 3 ? 'Triradial' : (symmetryOrder === 4 ? 'Tetraradial' : (symmetryOrder === 5 ? 'Pentaradial' : (symmetryOrder === 6 ? 'Hexaradial' : 'Helical-Chiral'))));
  const morphDescriptor = isFlora
    ? `${symName} ${hasGasBladder ? 'Buoyant-Bladder' : (collectorType < 0.33 ? 'Whorled-Spire' : (collectorType < 0.66 ? 'Arched-Frond' : 'Branching-Laminar'))} Autotroph`
    : (isFungi
      ? `${symName} ${collectorType < 0.5 ? 'Fenestrated-Dome' : 'Plumed-Rhizomorph'} Chemotroph`
      : `${symName} ${hasGasBladder ? 'Aero-Bladder' : (wingMembraneSpan > 0.6 ? 'Winged-Glider' : (isAqua ? 'Hydrofoil-Swimmer' : (carapaceHardness > 0.65 ? 'Carapaced' : 'Articulated')))} ${appendageGroups * appendagesPerWhorl > 0 ? `${appendageGroups * appendagesPerWhorl}-Limb ` : ''}${trophicGuild}`);

  return Object.freeze({
    schema: ULG_DEVELOPMENTAL_GENOME_SCHEMA,
    seed: (seed >>> 0),
    kingdom,
    trophicGuild,
    medium,
    morphDescriptor,
    symmetryOrder,
    segmentCount,
    axialAspect: Number(axialAspect.toFixed(3)),
    spineArch: Number(spineArch.toFixed(3)),
    spineTwist: Number(spineTwist.toFixed(3)),
    postureTiltRad: Number(postureTiltRad.toFixed(3)),
    bellyPeakU: Number(bellyPeakU.toFixed(3)),
    bellyBulge: Number(bellyBulge.toFixed(3)),
    eccentricityXZ: Number(eccentricityXZ.toFixed(3)),
    carapaceHardness: Number(carapaceHardness.toFixed(3)),
    kBlend,
    armorPlateCount,
    appendageGroups,
    appendagesPerWhorl,
    jointCount,
    limbLengthRatio: Number(limbLengthRatio.toFixed(3)),
    limbThicknessRatio: Number(limbThicknessRatio.toFixed(3)),
    phyllotaxisAngleRad: Number(phyllotaxisAngleRad.toFixed(4)),
    neckRatio: Number(neckRatio.toFixed(3)),
    headRadius: Number(headRadius.toFixed(3)),
    tailLengthRatio: Number(tailLengthRatio.toFixed(3)),
    gaitFreqHz,
    sizeScale: Number(clamp(evoSize * (isFlora ? buck : Math.pow(buck, 0.45)), 0.42, 2.85).toFixed(3)),
    collectorType: Number(collectorType.toFixed(3)),
    collectorSpread: Number(collectorSpread.toFixed(3)),
    collectorCurl: Number(collectorCurl.toFixed(3)),
    hasGasBladder,
    gasBladderRadius: Number(gasBladderRadius.toFixed(3)),
    dorsalSailHeight: Number(dorsalSailHeight.toFixed(3)),
    wingMembraneSpan: Number(wingMembraneSpan.toFixed(3)),
    receptorCount,
    receptorStalkLen: Number(receptorStalkLen.toFixed(3)),
    receptorAperture: Number(receptorAperture.toFixed(3)),
    crestOrHornLen: Number(crestOrHornLen.toFixed(3)),
    crestCurvature: Number(crestCurvature.toFixed(3)),
    turing: Object.freeze({
      F: turingF,
      k: turingK,
      scale: turingScale,
      aniso: turingAniso,
      iridescence: iridescenceStrength
    }),
    colors: Object.freeze({
      primaryRgb: Object.freeze(primaryRgb),
      secondaryRgb: Object.freeze(secondaryRgb),
      accentRgb: Object.freeze(accentRgb),
      biolumRgb: Object.freeze(biolumRgb),
      biolumIntensity
    })
  });
}

const GENOME_PACK_RANGES = [
  [2, 7], [1, 16], [0.2, 5.0], [-1.0, 1.0], [-3.0, 3.0],
  [-0.5, 1.2], [0.0, 1.0], [0.0, 1.0], [0.3, 2.0], [0.0, 1.0],
  [0.01, 0.35], [0, 12], [0, 8], [0, 8], [1, 6],
  [0.1, 2.5], [0.02, 0.40], [0.0, 4.0], [0.0, 1.5],
  [0.0, 0.6], [0.0, 2.0], [0.2, 5.5], [0.3, 3.2], [0.0, 1.0],
  [0.1, 2.0], [-1.5, 1.5], [0.0, 1.0], [0.0, 1.2],
  [0.0, 2.2], [0, 12], [0.0, 0.6], [0.02, 0.20],
  [0.0, 0.8], [-1.5, 1.5],
  [0.015, 0.075], [0.045, 0.070], [1.0, 10.0], [0.2, 3.0], [0.0, 1.0],
  [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1],
  [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1]
];

function bytesToB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return typeof globalThis.btoa === 'function' ? globalThis.btoa(bin) : Buffer.from(bytes).toString('base64');
}

function b64ToBytes(b64) {
  if (typeof globalThis.atob === 'function') {
    const bin = globalThis.atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/**
 * Compact deterministic serialization (~120 bytes JSON via Base64 quantized genome!)
 * for Root-Node Cosmic Lineage Cache, URLs, & PeerCompute P2P sync (< 2.5 KB/planet!).
 */
export function encodeDevelopmentalGenomeCompact(g) {
  if (!g) return null;
  const vals = [
    g.symmetryOrder, g.segmentCount, g.axialAspect, g.spineArch, g.spineTwist,
    g.postureTiltRad, g.bellyPeakU, g.bellyBulge, g.eccentricityXZ, g.carapaceHardness,
    g.kBlend, g.armorPlateCount, g.appendageGroups, g.appendagesPerWhorl, g.jointCount,
    g.limbLengthRatio, g.limbThicknessRatio, g.phyllotaxisAngleRad, g.neckRatio,
    g.headRadius, g.tailLengthRatio, g.gaitFreqHz, g.sizeScale, g.collectorType,
    g.collectorSpread, g.collectorCurl, g.gasBladderRadius, g.dorsalSailHeight,
    g.wingMembraneSpan, g.receptorCount, g.receptorStalkLen, g.receptorAperture,
    g.crestOrHornLen, g.crestCurvature,
    g.turing.F, g.turing.k, g.turing.scale, g.turing.aniso, g.turing.iridescence,
    ...g.colors.primaryRgb, ...g.colors.secondaryRgb, ...g.colors.accentRgb,
    ...g.colors.biolumRgb, g.colors.biolumIntensity
  ];
  const bytes = new Uint8Array(GENOME_PACK_RANGES.length);
  for (let i = 0; i < GENOME_PACK_RANGES.length; i += 1) {
    const [lo, hi] = GENOME_PACK_RANGES[i];
    const u = clamp(((Number(vals[i]) || 0) - lo) / Math.max(1e-6, hi - lo), 0, 1);
    bytes[i] = Math.round(u * 255);
  }
  return {
    v: 2,
    s: g.seed >>> 0,
    k: g.kingdom[0], // 'f'(flora), 'm'(fungi), 'a'(fauna)
    m: g.medium[0],  // 't','a','b','q'
    g: g.trophicGuild.slice(0, 12),
    b: bytesToB64(bytes)
  };
}

export function decodeDevelopmentalGenomeCompact(p) {
  if (!p) return null;
  let vals;
  if (p.v === 2 && typeof p.b === 'string') {
    const bytes = b64ToBytes(p.b);
    if (bytes.length < GENOME_PACK_RANGES.length) return null;
    vals = new Float32Array(GENOME_PACK_RANGES.length);
    for (let i = 0; i < GENOME_PACK_RANGES.length; i += 1) {
      const [lo, hi] = GENOME_PACK_RANGES[i];
      vals[i] = lo + (bytes[i] / 255) * (hi - lo);
    }
  } else if (Array.isArray(p.n) && p.n.length >= 34) {
    const t = p.t || [0.036, 0.060, 4.0, 1.0, 0.1];
    const c = p.c || [0.3, 0.6, 0.3, 0.5, 0.4, 0.3, 0.9, 0.8, 0.3, 0.2, 0.9, 0.8, 0.2];
    vals = Float32Array.from([...p.n.slice(0, 34), ...t.slice(0, 5), ...c.slice(0, 13)]);
  } else {
    return null;
  }
  const n = vals;
  const kingdom = p.k === 'f' ? 'flora' : (p.k === 'm' ? 'fungi' : 'fauna');
  const medium = p.m === 'q' ? 'aquatic' : (p.m === 'a' ? 'aerial' : (p.m === 'b' ? 'buoyant' : 'terrestrial'));
  const symmetryOrder = Math.round(n[0]);
  const symName = symmetryOrder === 2 ? 'Bilateral' : (symmetryOrder === 3 ? 'Triradial' : (symmetryOrder === 4 ? 'Tetraradial' : (symmetryOrder === 5 ? 'Pentaradial' : (symmetryOrder === 6 ? 'Hexaradial' : 'Helical-Chiral'))));
  return Object.freeze({
    schema: ULG_DEVELOPMENTAL_GENOME_SCHEMA,
    seed: (p.s >>> 0),
    kingdom,
    trophicGuild: String(p.g || 'grazer'),
    medium,
    morphDescriptor: `${symName} Emergent ${kingdom}`,
    symmetryOrder,
    segmentCount: Math.round(n[1]),
    axialAspect: n[2],
    spineArch: n[3],
    spineTwist: n[4],
    postureTiltRad: n[5],
    bellyPeakU: n[6],
    bellyBulge: n[7],
    eccentricityXZ: n[8],
    carapaceHardness: n[9],
    kBlend: n[10],
    armorPlateCount: Math.round(n[11]),
    appendageGroups: Math.round(n[12]),
    appendagesPerWhorl: Math.round(n[13]),
    jointCount: Math.round(n[14]),
    limbLengthRatio: n[15],
    limbThicknessRatio: n[16],
    phyllotaxisAngleRad: n[17],
    neckRatio: n[18],
    headRadius: n[19],
    tailLengthRatio: n[20],
    gaitFreqHz: n[21],
    sizeScale: n[22],
    collectorType: n[23],
    collectorSpread: n[24],
    collectorCurl: n[25],
    hasGasBladder: n[26] > 0.05,
    gasBladderRadius: n[26],
    dorsalSailHeight: n[27],
    wingMembraneSpan: n[28],
    receptorCount: Math.round(n[29]),
    receptorStalkLen: n[30],
    receptorAperture: n[31],
    crestOrHornLen: n[32],
    crestCurvature: n[33],
    turing: Object.freeze({ F: n[34], k: n[35], scale: n[36], aniso: n[37], iridescence: n[38] }),
    colors: Object.freeze({
      primaryRgb: Object.freeze([n[39], n[40], n[41]]),
      secondaryRgb: Object.freeze([n[42], n[43], n[44]]),
      accentRgb: Object.freeze([n[45], n[46], n[47]]),
      biolumRgb: Object.freeze([n[48], n[49], n[50]]),
      biolumIntensity: n[51] ?? 0.2
    })
  });
}

/**
 * Compile ANY Developmental Genome into a flat list of organic 3D SDF primitives
 * (`<= 48` primitives, normalized to unit local box `[-1.15..+1.15]^3` with feet/roots
 * resting cleanly at `y = 0` for sessile/terrestrial organisms!).
 *
 * Each primitive:
 *   { type, pA:[x,y,z], pB:[x,y,z], rA, rB, aux, kBlend, boneId, organZone, colorRole }
 *   colorRole: 0 = primary, 1 = secondary, 2 = accent, 3 = biolum
 */
export function compileDevelopmentalGenomeToPrimitives(genome, {
  phase = 0,
  arousal = 0,
  sailFlare = 0,
  frondClose = 0,
  crouch = 0,
  maxPrimitives = 48
} = {}) {
  if (!genome) return { primitives: [], boundsRadius: 1.0, organSockets: [] };
  const rng = makeRng((genome.seed ^ 0x9e3779b9) >>> 0);
  const prims = [];
  const organSockets = [];
  const pushPrim = (p) => {
    if (prims.length < maxPrimitives) prims.push(p);
  };

  const isFlora = genome.kingdom === 'flora';
  const isFungi = genome.kingdom === 'fungi';
  const S = Math.max(2, Math.min(7, Math.round(genome.symmetryOrder || 2)));
  const kB = clamp(Number(genome.kBlend) || 0.12, 0.03, 0.28);
  const breath = 1.0 + Math.sin(phase * (2.4 + arousal * 3.8)) * (0.03 + arousal * 0.03);
  const sway = Math.sin(phase * 1.45) * 0.04;

  if (isFlora || isFungi) {
    // =========================================================================
    // VASCULAR L-SYSTEM / MYCELIAL GROWTH AXIS (root y = 0 -> crown y ~ 1.0)
    // =========================================================================
    const hTotal = clamp(0.75 + genome.axialAspect * 0.42, 0.65, 1.55);
    const trunkBaseR = clamp(genome.bellyBulge * 0.55 + genome.limbThicknessRatio * 0.5, 0.07, 0.34);
    const segs = Math.max(3, Math.min(7, genome.segmentCount || 4));
    let prev = [0, 0, 0];
    let prevR = trunkBaseR;
    const spinePts = [prev];

    // Root buttresses or radiating rhizomorphs for high-g / structural stability
    const nRoots = Math.min(S, 5);
    for (let ri = 0; ri < nRoots; ri += 1) {
      const ang = (ri / nRoots) * Math.PI * 2 + rng() * 0.3;
      const rOut = trunkBaseR * (1.5 + genome.carapaceHardness * 1.4);
      pushPrim({
        type: SDF_PRIM_TYPES.SMOOTH_CAPSULE,
        pA: [Math.cos(ang) * rOut, 0.02, Math.sin(ang) * rOut],
        pB: [Math.cos(ang) * trunkBaseR * 0.4, hTotal * 0.24, Math.sin(ang) * trunkBaseR * 0.4],
        rA: trunkBaseR * 0.32,
        rB: trunkBaseR * 0.52,
        aux: 0,
        kBlend: kB,
        boneId: 0,
        organZone: ORGAN_ZONE_IDS.TORSO_CORE,
        colorRole: 1
      });
    }

    for (let si = 1; si <= segs; si += 1) {
      const u = si / segs;
      const twistAng = u * genome.spineTwist * 2.2;
      const bendMag = genome.spineArch * Math.sin(u * Math.PI) * 0.24 + u * Math.sin(genome.postureTiltRad) * 0.26;
      const pt = [
        Math.cos(twistAng) * bendMag + sway * u * u,
        u * hTotal * 0.84,
        Math.sin(twistAng) * bendMag + sway * 0.6 * u * u
      ];
      // Murray's Law taper: r(u) = r0 * (1 - 0.72*u)^(2/3)
      const rCur = Math.max(0.032, trunkBaseR * Math.pow(Math.max(0.12, 1.0 - 0.74 * u), 0.67));
      pushPrim({
        type: SDF_PRIM_TYPES.SMOOTH_CAPSULE,
        pA: prev,
        pB: pt,
        rA: prevR,
        rB: rCur,
        aux: 0,
        kBlend: kB,
        boneId: Math.min(3, si),
        organZone: ORGAN_ZONE_IDS.TORSO_CORE,
        colorRole: 1
      });
      spinePts.push(pt);
      prev = pt;
      prevR = rCur;
    }
    organSockets.push({ id: 'torso', zone: ORGAN_ZONE_IDS.TORSO_CORE, center: spinePts[Math.floor(segs * 0.45)], radius: trunkBaseR * 2.0 });

    // Whorled / Phyllotactic Branches & Continuous Collector Blades / Domes / Bladders
    const nWhorls = Math.max(2, Math.min(5, genome.appendageGroups || 3));
    const perWhorl = Math.max(2, Math.min(6, genome.appendagesPerWhorl || S));
    const closeMul = 1.0 - frondClose * 0.42;
    for (let w = 0; w < nWhorls; w += 1) {
      const wu = lerp(0.32, 0.96, w / Math.max(1, nWhorls - 1));
      const spIdx = Math.min(spinePts.length - 1, Math.max(1, Math.round(wu * (spinePts.length - 1))));
      const basePt = spinePts[spIdx];
      const tierRad = genome.collectorSpread * (0.34 + 0.42 * Math.sin((1 - wu * 0.65) * Math.PI * 0.85)) * closeMul;

      for (let b = 0; b < perWhorl; b += 1) {
        if (prims.length >= maxPrimitives - 2) break;
        const az = w * genome.phyllotaxisAngleRad + (b / perWhorl) * Math.PI * 2;
        const elev = lerp(0.15, 0.72, wu) + genome.collectorCurl * 0.18;
        const ca = Math.cos(az); const sa = Math.sin(az);
        const midPt = [
          basePt[0] + ca * tierRad * 0.55,
          basePt[1] + tierRad * Math.sin(elev) * 0.55,
          basePt[2] + sa * tierRad * 0.55
        ];
        const tipPt = [
          basePt[0] + ca * tierRad,
          basePt[1] + tierRad * Math.sin(elev - genome.collectorCurl * 0.35),
          basePt[2] + sa * tierRad
        ];
        const bRad = Math.max(0.025, prevR * (0.78 - wu * 0.25));

        // Branch strut
        pushPrim({
          type: SDF_PRIM_TYPES.SMOOTH_CAPSULE,
          pA: basePt,
          pB: midPt,
          rA: bRad,
          rB: bRad * 0.62,
          aux: 0,
          kBlend: kB,
          boneId: 4 + (w % 4),
          organZone: ORGAN_ZONE_IDS.LIMB_LOCOMOTOR,
          colorRole: 1
        });

        // Continuous collector geometry (bladder vs thin frond vs coral dome/lamina)
        if (genome.hasGasBladder && w >= nWhorls - 2) {
          pushPrim({
            type: SDF_PRIM_TYPES.ELLIPSOID_BLADDER,
            pA: tipPt,
            pB: [tipPt[0], tipPt[1] + genome.gasBladderRadius * 0.55, tipPt[2]],
            rA: genome.gasBladderRadius * 0.48 * breath,
            rB: genome.gasBladderRadius * 0.62 * breath,
            aux: 0.25,
            kBlend: kB * 1.1,
            boneId: 4 + (w % 4),
            organZone: ORGAN_ZONE_IDS.CANOPY_COLLECTOR,
            colorRole: genome.colors.biolumIntensity > 0.3 ? 3 : 0
          });
        } else if (genome.collectorType < 0.55) {
          pushPrim({
            type: SDF_PRIM_TYPES.THIN_FIN_FROND,
            pA: midPt,
            pB: tipPt,
            rA: tierRad * (0.28 + genome.collectorType * 0.35),
            rB: 0.032 + genome.carapaceHardness * 0.035,
            aux: az,
            kBlend: kB * 0.85,
            boneId: 4 + (w % 4),
            organZone: ORGAN_ZONE_IDS.CANOPY_COLLECTOR,
            colorRole: (w === nWhorls - 1 && genome.colors.biolumIntensity > 0.35) ? 3 : 0
          });
        } else {
          pushPrim({
            type: isFungi ? SDF_PRIM_TYPES.CARAPACE_PLATE : SDF_PRIM_TYPES.ELLIPSOID_BLADDER,
            pA: tipPt,
            pB: [tipPt[0] + ca * 0.08, tipPt[1] + 0.06, tipPt[2] + sa * 0.08],
            rA: tierRad * 0.36,
            rB: tierRad * (isFungi ? 0.16 : 0.26),
            aux: genome.collectorCurl,
            kBlend: kB,
            boneId: 4 + (w % 4),
            organZone: ORGAN_ZONE_IDS.CANOPY_COLLECTOR,
            colorRole: 0
          });
        }
      }
    }
    const apex = spinePts[spinePts.length - 1];
    organSockets.push({ id: 'canopy', zone: ORGAN_ZONE_IDS.CANOPY_COLLECTOR, center: apex, radius: genome.collectorSpread * 0.65 });
    organSockets.push({ id: 'limbs', zone: ORGAN_ZONE_IDS.LIMB_LOCOMOTOR, center: spinePts[Math.max(1, spinePts.length - 2)], radius: genome.collectorSpread * 0.5 });
  } else {
    // =========================================================================
    // MOTILE FAUNA: CONTINUOUS HOX-SEGMENT AXIAL BODY + RADIATED APPENDAGES
    // =========================================================================
    const isRadialBody = S >= 3 && genome.axialAspect < 1.35;
    const stanceH = genome.medium === 'terrestrial'
      ? clamp(genome.limbLengthRatio * 0.58 * (1.0 - crouch * 0.4), 0.16, 0.88)
      : 0.55;
    const bodyHalfL = clamp(genome.axialAspect * 0.36, 0.22, 0.78);
    const torsoR = clamp(genome.bellyBulge * 0.44 * breath, 0.11, 0.42);
    const segs = Math.max(3, Math.min(7, genome.segmentCount || 5));

    // 1. Axial Spine Metameres (or Radial Central Hub if S >= 3 & compact)
    const spinePts = [];
    if (isRadialBody) {
      // Radial/Star/Bell/Umbrella symmetry center!
      const hub = [0, stanceH, 0];
      spinePts.push(hub);
      pushPrim({
        type: genome.hasGasBladder ? SDF_PRIM_TYPES.ELLIPSOID_BLADDER : SDF_PRIM_TYPES.SMOOTH_CAPSULE,
        pA: [0, stanceH - torsoR * 0.45, 0],
        pB: [0, stanceH + torsoR * (genome.hasGasBladder ? 1.15 : 0.65), 0],
        rA: torsoR * 1.05,
        rB: torsoR * (genome.hasGasBladder ? 1.25 : 0.85),
        aux: 0,
        kBlend: kB,
        boneId: 0,
        organZone: ORGAN_ZONE_IDS.TORSO_CORE,
        colorRole: 0
      });
      // Radial sensory ring / crown around hub
      for (let r = 0; r < Math.min(S, 6); r += 1) {
        const a = (r / S) * Math.PI * 2;
        const lobePt = [Math.cos(a) * torsoR * 1.12, stanceH + torsoR * 0.28, Math.sin(a) * torsoR * 1.12];
        pushPrim({
          type: SDF_PRIM_TYPES.ELLIPSOID_BLADDER,
          pA: lobePt,
          pB: [lobePt[0] * 1.12, lobePt[1] + genome.receptorStalkLen * 0.4, lobePt[2] * 1.12],
          rA: genome.receptorAperture * 1.15,
          rB: genome.receptorAperture * 0.95,
          aux: 0,
          kBlend: kB * 0.5,
          boneId: 1,
          organZone: ORGAN_ZONE_IDS.HEAD_SENSORY,
          colorRole: 2
        });
      }
      organSockets.push({ id: 'head', zone: ORGAN_ZONE_IDS.HEAD_SENSORY, center: [0, stanceH + torsoR * 0.5, 0], radius: torsoR * 0.85 });
      organSockets.push({ id: 'torso', zone: ORGAN_ZONE_IDS.TORSO_CORE, center: hub, radius: torsoR * 1.1 });
    } else {
      const tilt = genome.postureTiltRad;
      for (let si = 0; si < segs; si += 1) {
        const u = si / Math.max(1, segs - 1); // 0 = rear, 1 = anterior
        const z = (u - 0.5) * 2.0 * bodyHalfL * Math.cos(tilt);
        const y = stanceH + (u - 0.5) * 2.0 * bodyHalfL * Math.sin(tilt) + Math.sin(u * Math.PI) * genome.spineArch * 0.22;
        const x = Math.sin(u * Math.PI * 2.0 + phase * genome.gaitFreqHz * 2.2) * (genome.medium === 'aquatic' ? 0.08 : 0.02);
        spinePts.push([x, y, z]);
      }
      for (let si = 0; si < segs - 1; si += 1) {
        const u0 = si / Math.max(1, segs - 1);
        const u1 = (si + 1) / Math.max(1, segs - 1);
        const env0 = Math.exp(-Math.pow((u0 - genome.bellyPeakU) / 0.45, 2));
        const env1 = Math.exp(-Math.pow((u1 - genome.bellyPeakU) / 0.45, 2));
        const r0 = torsoR * (0.48 + 0.56 * env0);
        const r1 = torsoR * (0.48 + 0.56 * env1);
        pushPrim({
          type: SDF_PRIM_TYPES.SMOOTH_CAPSULE,
          pA: spinePts[si],
          pB: spinePts[si + 1],
          rA: r0,
          rB: r1,
          aux: genome.eccentricityXZ,
          kBlend: kB,
          boneId: Math.min(3, si),
          organZone: ORGAN_ZONE_IDS.TORSO_CORE,
          colorRole: 0
        });
        // Armored dorsal carapace plates along torso if high carapaceHardness
        if (genome.armorPlateCount > 0 && si < genome.armorPlateCount) {
          const mid = [
            0.5 * (spinePts[si][0] + spinePts[si + 1][0]),
            0.5 * (spinePts[si][1] + spinePts[si + 1][1]) + 0.5 * (r0 + r1) * 0.72,
            0.5 * (spinePts[si][2] + spinePts[si + 1][2])
          ];
          pushPrim({
            type: SDF_PRIM_TYPES.CARAPACE_PLATE,
            pA: mid,
            pB: [mid[0], mid[1] + 0.05, mid[2] - 0.06],
            rA: Math.max(r0, r1) * 0.88,
            rB: 0.042,
            aux: 0,
            kBlend: 0.03,
            boneId: Math.min(3, si),
            organZone: ORGAN_ZONE_IDS.TORSO_CORE,
            colorRole: 1
          });
        }
      }

      // Buoyant dorsal lifting gas bladder (if buoyant/dense-air clade)
      const midSpine = spinePts[Math.floor(segs * 0.5)];
      if (genome.hasGasBladder) {
        pushPrim({
          type: SDF_PRIM_TYPES.ELLIPSOID_BLADDER,
          pA: [midSpine[0], midSpine[1] + torsoR * 1.15, midSpine[2] - 0.10],
          pB: [midSpine[0], midSpine[1] + torsoR * 1.25, midSpine[2] + 0.14],
          rA: genome.gasBladderRadius * 0.68 * breath,
          rB: genome.gasBladderRadius * 0.55 * breath,
          aux: 0.2,
          kBlend: kB * 1.2,
          boneId: 1,
          organZone: ORGAN_ZONE_IDS.RESPIRATORY_SAIL,
          colorRole: 3
        });
      }

      // Dorsal Vascular Radiator Sail (Allen's rule thermal rejection & threat flare!)
      if (genome.dorsalSailHeight > 0.14) {
        const sailH = genome.dorsalSailHeight * (0.48 + sailFlare * 0.35);
        pushPrim({
          type: SDF_PRIM_TYPES.THIN_FIN_FROND,
          pA: [spinePts[1][0], spinePts[1][1] + torsoR * 0.65, spinePts[1][2]],
          pB: [spinePts[segs - 2][0], spinePts[segs - 2][1] + torsoR * 0.65 + sailH, spinePts[segs - 2][2]],
          rA: sailH * 0.65,
          rB: 0.025,
          aux: Math.PI * 0.5,
          kBlend: kB * 0.65,
          boneId: 2,
          organZone: ORGAN_ZONE_IDS.RESPIRATORY_SAIL,
          colorRole: 2
        });
        organSockets.push({ id: 'sail', zone: ORGAN_ZONE_IDS.RESPIRATORY_SAIL, center: [midSpine[0], midSpine[1] + torsoR + sailH * 0.5, midSpine[2]], radius: sailH * 0.7 });
      }

      // Neck + Cranial Sensory Complex + Crests/Horns
      const frontPt = spinePts[segs - 1];
      const neckLen = genome.neckRatio * 0.36;
      const headPt = [
        frontPt[0],
        frontPt[1] + neckLen * 0.55 + Math.sin(phase * 2.1) * 0.02,
        frontPt[2] + neckLen * 0.85
      ];
      pushPrim({
        type: SDF_PRIM_TYPES.SMOOTH_CAPSULE,
        pA: frontPt,
        pB: headPt,
        rA: torsoR * 0.54,
        rB: genome.headRadius * 0.68,
        aux: 0,
        kBlend: kB,
        boneId: 4,
        organZone: ORGAN_ZONE_IDS.HEAD_SENSORY,
        colorRole: 0
      });
      // Cranium + snout/mandibles
      const snoutPt = [headPt[0], headPt[1] - genome.headRadius * 0.16, headPt[2] + genome.headRadius * 1.18];
      pushPrim({
        type: SDF_PRIM_TYPES.SMOOTH_CAPSULE,
        pA: headPt,
        pB: snoutPt,
        rA: genome.headRadius,
        rB: genome.headRadius * 0.58,
        aux: 0,
        kBlend: kB * 0.75,
        boneId: 4,
        organZone: ORGAN_ZONE_IDS.HEAD_SENSORY,
        colorRole: 0
      });
      // Sensory Eyes / Stalked Ocelli
      const nEyes = Math.min(4, Math.max(2, genome.receptorCount || 2));
      for (let ei = 0; ei < nEyes; ei += 1) {
        const side = (ei % 2 === 0 ? 1 : -1);
        const tier = Math.floor(ei / 2);
        const ePos = [
          headPt[0] + side * (genome.headRadius * 0.72 + genome.receptorStalkLen * 0.6),
          headPt[1] + genome.headRadius * 0.34 + genome.receptorStalkLen * 0.75 - tier * 0.06,
          headPt[2] + genome.headRadius * (0.42 - tier * 0.32)
        ];
        pushPrim({
          type: SDF_PRIM_TYPES.ELLIPSOID_BLADDER,
          pA: ePos,
          pB: [ePos[0] + side * 0.02, ePos[1] + 0.02, ePos[2] + 0.03],
          rA: genome.receptorAperture,
          rB: genome.receptorAperture,
          aux: 0,
          kBlend: 0.02,
          boneId: 4,
          organZone: ORGAN_ZONE_IDS.HEAD_SENSORY,
          colorRole: 2
        });
      }
      // Cranial Horns / Antennae / Acoustic Dish-Crests
      if (genome.crestOrHornLen > 0.10) {
        for (const side of [-1, 1]) {
          pushPrim({
            type: SDF_PRIM_TYPES.SMOOTH_CAPSULE,
            pA: [headPt[0] + side * genome.headRadius * 0.45, headPt[1] + genome.headRadius * 0.55, headPt[2]],
            pB: [
              headPt[0] + side * (genome.headRadius * 0.65 + genome.crestOrHornLen * 0.55),
              headPt[1] + genome.headRadius * 0.7 + genome.crestOrHornLen * 0.75,
              headPt[2] + genome.crestCurvature * genome.crestOrHornLen * 0.5
            ],
            rA: Math.max(0.048, genome.headRadius * 0.30),
            rB: 0.038,
            aux: 0,
            kBlend: 0.04,
            boneId: 4,
            organZone: ORGAN_ZONE_IDS.HEAD_SENSORY,
            colorRole: 1
          });
        }
      }
      // Counterbalancing Tail / Caudal Hydrofoil / Bioluminescent Organ
      const rearPt = spinePts[0];
      const tailLen = genome.tailLengthRatio * 0.55;
      const tailWag = Math.sin(phase * genome.gaitFreqHz * 2.5) * (genome.medium === 'aquatic' ? 0.16 : 0.06);
      const tailMid = [rearPt[0] + tailWag * 0.5, rearPt[1] + 0.02, rearPt[2] - tailLen * 0.52];
      const tailTip = [rearPt[0] + tailWag, rearPt[1] - 0.04, rearPt[2] - tailLen];
      pushPrim({
        type: SDF_PRIM_TYPES.SMOOTH_CAPSULE,
        pA: rearPt,
        pB: tailMid,
        rA: torsoR * 0.46,
        rB: torsoR * 0.24,
        aux: 0,
        kBlend: kB,
        boneId: 5,
        organZone: ORGAN_ZONE_IDS.BIOLUM_TAIL,
        colorRole: 0
      });
      pushPrim({
        type: genome.medium === 'aquatic' ? SDF_PRIM_TYPES.THIN_FIN_FROND : SDF_PRIM_TYPES.SMOOTH_CAPSULE,
        pA: tailMid,
        pB: tailTip,
        rA: genome.medium === 'aquatic' ? torsoR * 0.85 : torsoR * 0.22,
        rB: genome.medium === 'aquatic' ? 0.026 : 0.032,
        aux: 0,
        kBlend: kB * 0.8,
        boneId: 5,
        organZone: ORGAN_ZONE_IDS.BIOLUM_TAIL,
        colorRole: genome.colors.biolumIntensity > 0.22 ? 3 : 2
      });
      organSockets.push({ id: 'head', zone: ORGAN_ZONE_IDS.HEAD_SENSORY, center: headPt, radius: genome.headRadius * 1.45 });
      organSockets.push({ id: 'torso', zone: ORGAN_ZONE_IDS.TORSO_CORE, center: midSpine, radius: torsoR * 1.35 });
      organSockets.push({ id: 'tail', zone: ORGAN_ZONE_IDS.BIOLUM_TAIL, center: tailMid, radius: tailLen * 0.45 });
    }

    // 2. Locomotor Appendages (Legs w/ Terrain-Planting IK, Swept Wings, Hydrofoils, or Radial Tentacles)
    const groups = Math.max(1, Math.min(4, genome.appendageGroups || 2));
    const perG = Math.max(2, Math.min(6, genome.appendagesPerWhorl || 2));
    const lRad = clamp(0.068 + genome.limbThicknessRatio * 0.48, 0.068, 0.16);
    const lLen = clamp(genome.limbLengthRatio * 0.62, 0.24, 0.92);

    if (isRadialBody || genome.medium === 'buoyant') {
      const hub = spinePts[0];
      const nTent = Math.min(6, Math.max(3, S));
      for (let ti = 0; ti < nTent; ti += 1) {
        const a = (ti / nTent) * Math.PI * 2;
        const wave = Math.sin(phase * genome.gaitFreqHz * 2.2 + ti * 1.15) * 0.12;
        const hip = [hub[0] + Math.cos(a) * torsoR * 0.72, hub[1] - torsoR * 0.2, hub[2] + Math.sin(a) * torsoR * 0.72];
        const knee = [
          hip[0] + Math.cos(a) * lLen * 0.52,
          Math.max(0.08, hip[1] - lLen * 0.45 + wave * 0.5),
          hip[2] + Math.sin(a) * lLen * 0.52
        ];
        const foot = [
          hip[0] + Math.cos(a + wave) * lLen * (genome.medium === 'terrestrial' ? 0.85 : 0.48),
          genome.medium === 'terrestrial' ? 0.04 : (knee[1] - lLen * 0.55),
          hip[2] + Math.sin(a + wave) * lLen * (genome.medium === 'terrestrial' ? 0.85 : 0.48)
        ];
        pushPrim({
          type: SDF_PRIM_TYPES.SMOOTH_CAPSULE,
          pA: hip, pB: knee, rA: lRad, rB: lRad * 0.74, aux: 0, kBlend: kB,
          boneId: 6 + (ti % 6), organZone: ORGAN_ZONE_IDS.LIMB_LOCOMOTOR, colorRole: 1
        });
        pushPrim({
          type: SDF_PRIM_TYPES.SMOOTH_CAPSULE,
          pA: knee, pB: foot, rA: lRad * 0.72, rB: lRad * 0.45, aux: 0, kBlend: kB * 0.7,
          boneId: 6 + (ti % 6), organZone: ORGAN_ZONE_IDS.LIMB_LOCOMOTOR, colorRole: genome.colors.biolumIntensity > 0.35 ? 3 : 1
        });
      }
      organSockets.push({ id: 'limbs', zone: ORGAN_ZONE_IDS.LIMB_LOCOMOTOR, center: [torsoR, stanceH * 0.45, 0], radius: lLen * 0.75 });
    } else if (genome.wingMembraneSpan > 0.52 && (genome.medium === 'aerial' || genome.medium === 'aquatic')) {
      const shoulder = spinePts[Math.min(spinePts.length - 1, Math.floor(spinePts.length * 0.65))];
      const flap = Math.sin(phase * genome.gaitFreqHz * 2.8) * (genome.medium === 'aerial' ? 0.36 : 0.20);
      const span = clamp(genome.wingMembraneSpan * 0.62, 0.42, 1.08);
      for (const side of [-1, 1]) {
        const elbow = [shoulder[0] + side * span * 0.52, shoulder[1] + span * 0.16 * flap, shoulder[2] + 0.06];
        const tip = [shoulder[0] + side * span, shoulder[1] + span * 0.45 * flap, shoulder[2] - 0.16];
        pushPrim({
          type: SDF_PRIM_TYPES.SMOOTH_CAPSULE,
          pA: shoulder, pB: elbow, rA: lRad * 0.85, rB: lRad * 0.55, aux: 0, kBlend: kB,
          boneId: side > 0 ? 6 : 7, organZone: ORGAN_ZONE_IDS.LIMB_LOCOMOTOR, colorRole: 1
        });
        pushPrim({
          type: SDF_PRIM_TYPES.THIN_FIN_FROND,
          pA: shoulder, pB: tip, rA: span * 0.38, rB: 0.024, aux: side * 0.2, kBlend: kB * 0.7,
          boneId: side > 0 ? 6 : 7, organZone: ORGAN_ZONE_IDS.LIMB_LOCOMOTOR, colorRole: 2
        });
      }
      organSockets.push({ id: 'limbs', zone: ORGAN_ZONE_IDS.LIMB_LOCOMOTOR, center: [shoulder[0] + span * 0.5, shoulder[1], shoulder[2]], radius: span * 0.55 });
    } else {
      // Articulated 2-segment Terrestrial / Amphibious Limbs (2, 4, 6, or 8 limbs!)
      for (let gi = 0; gi < groups; gi += 1) {
        const u = groups === 1 ? 0.55 : lerp(0.18, 0.82, gi / (groups - 1));
        const spIdx = Math.min(spinePts.length - 1, Math.round(u * (spinePts.length - 1)));
        const anchor = spinePts[spIdx];
        for (let si = 0; si < Math.min(2, perG); si += 1) {
          const side = si === 0 ? 1 : -1;
          const stride = Math.sin(phase * genome.gaitFreqHz * Math.PI * 2 + gi * 1.9 + (side < 0 ? Math.PI : 0));
          const lift = Math.max(0, Math.cos(phase * genome.gaitFreqHz * Math.PI * 2 + gi * 1.9 + (side < 0 ? Math.PI : 0)));
          const hip = [anchor[0] + side * torsoR * 0.68, anchor[1] - torsoR * 0.25, anchor[2]];
          const spreadX = torsoR * 0.85 + lLen * (0.28 + genome.carapaceHardness * 0.25);
          const knee = [
            anchor[0] + side * spreadX,
            Math.max(0.10, hip[1] * 0.56 + lift * 0.06),
            anchor[2] + stride * lLen * 0.22 + (gi === 0 ? -0.06 : 0.06)
          ];
          const foot = [
            anchor[0] + side * (spreadX * 0.92),
            0.03 + lift * 0.08,
            anchor[2] + stride * lLen * 0.34
          ];
          const bone = 6 + ((gi * 2 + si) % 8);
          pushPrim({
            type: SDF_PRIM_TYPES.SMOOTH_CAPSULE,
            pA: hip, pB: knee, rA: lRad, rB: lRad * 0.78, aux: 0, kBlend: kB,
            boneId: bone, organZone: ORGAN_ZONE_IDS.LIMB_LOCOMOTOR, colorRole: 1
          });
          pushPrim({
            type: SDF_PRIM_TYPES.SMOOTH_CAPSULE,
            pA: knee, pB: foot, rA: lRad * 0.76, rB: lRad * 0.62, aux: 0, kBlend: kB * 0.65,
            boneId: bone, organZone: ORGAN_ZONE_IDS.LIMB_LOCOMOTOR, colorRole: 1
          });
        }
      }
      organSockets.push({ id: 'limbs', zone: ORGAN_ZONE_IDS.LIMB_LOCOMOTOR, center: [torsoR + lLen * 0.3, stanceH * 0.4, 0], radius: lLen * 0.75 });
    }
  }

  // Compute exact bounding radius so SDF grid frames 100% of every species cleanly!
  let maxR = 0.45;
  for (const p of prims) {
    const rA = Math.hypot(p.pA[0], p.pA[1] - 0.55, p.pA[2]) + p.rA;
    const rB = Math.hypot(p.pB[0], p.pB[1] - 0.55, p.pB[2]) + p.rB;
    maxR = Math.max(maxR, rA, rB);
  }
  return {
    primitives: prims,
    boundsRadius: clamp(maxR * 1.12, 0.75, 2.2),
    centerY: 0.55,
    organSockets
  };
}

/**
 * Extract a continuous 24-D normalized morphological feature vector directly from
 * a species' Developmental Genome for falsifiable cross-planet Zero-Twin checks!
 */
export function extractMorphologicalFeatureVector(genome) {
  if (!genome) return new Float32Array(24);
  return new Float32Array([
    genome.symmetryOrder / 7.0,
    genome.segmentCount / 12.0,
    genome.axialAspect / 3.5,
    (genome.spineArch + 1.0) * 0.5,
    (genome.spineTwist + 2.5) / 5.0,
    genome.postureTiltRad / 1.0,
    genome.bellyPeakU,
    genome.bellyBulge,
    genome.eccentricityXZ / 1.6,
    genome.carapaceHardness,
    genome.kBlend / 0.3,
    genome.appendageGroups / 6.0,
    genome.appendagesPerWhorl / 7.0,
    genome.limbLengthRatio / 2.0,
    genome.limbThicknessRatio / 0.35,
    genome.phyllotaxisAngleRad / 3.5,
    genome.neckRatio / 1.2,
    genome.tailLengthRatio / 1.6,
    genome.collectorType,
    genome.collectorSpread / 1.6,
    genome.gasBladderRadius / 0.8,
    genome.dorsalSailHeight,
    genome.wingMembraneSpan / 2.0,
    (genome.turing?.F || 0.035) * 12.0 + (genome.turing?.scale || 4.0) * 0.08
  ]);
}

export function computeMorphologicalDistance(genomeA, genomeB) {
  const va = extractMorphologicalFeatureVector(genomeA);
  const vb = extractMorphologicalFeatureVector(genomeB);
  let sumSq = 0;
  for (let i = 0; i < va.length; i += 1) {
    const d = va[i] - vb[i];
    sumSq += d * d;
  }
  // Include pigment CIE-like RGB distance weighted gently so morphology dominates
  const ca = genomeA?.colors?.primaryRgb || [0.5, 0.5, 0.5];
  const cb = genomeB?.colors?.primaryRgb || [0.5, 0.5, 0.5];
  const colorDist = Math.hypot(ca[0] - cb[0], ca[1] - cb[1], ca[2] - cb[2]);
  return Math.sqrt(sumSq) + 0.15 * colorDist;
}
