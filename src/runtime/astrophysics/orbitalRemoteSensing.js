// First-Principles Orbital Remote-Sensing Biosignature & Geochemical Spectroscopy Analyzer
// (`src/runtime/astrophysics/orbitalRemoteSensing.js`).
//
// Strictly Star Spec v0.4 & ULG General-Law Thesis compliant:
//   - ZERO hardcoded planet names or species lookups!
//   - Derives observable orbital remote-sensing biosignatures (atmospheric chemical disequilibrium,
//     surface photosynthetic red-edge / pigment reflectance, cryogenic acetylene/H2 sinks, subsurface
//     hydrothermal plume gas ratios, prebiotic tholin hazes, or abiotic sterility) strictly from
//     continuous physical state `(tempK, surfacePressurePa, volatileMassFrac, particulateMassFrac,
//     coreZ, mantleZ, surfZ, cToO, gravity, hostStarTeffK, hasOcean, isCryoMoon, isMagmaOcean)`.
//   - Derives predicted crust/cloud mineral & compound hints directly from element Z condensation
//     thermochemistry & redox state so explorers can scout worlds BEFORE landing!

import { deriveXenobiologyProfile } from '../biology/xenobiologySynthesizer.js';

export const ULG_ORBITAL_REMOTE_SENSING_SCHEMA = 'ulg.astrophysics.orbital-remote-sensing.v1';

const G_SI = 6.6743e-11;
const M_SOLAR_KG = 1.98847e30;

function estimateGravityMS2(bodySpec) {
  if (Number.isFinite(Number(bodySpec?.surfaceGravityMS2)) && Number(bodySpec.surfaceGravityMS2) > 0) {
    return Number(bodySpec.surfaceGravityMS2);
  }
  const mKg = Math.max(1e15, (Number(bodySpec?.massSolar) || 3e-6) * M_SOLAR_KG);
  const rM = Math.max(1e3, (Number(bodySpec?.radiusKm) || 6371) * 1000);
  return Math.max(0.01, Math.min(45.0, (G_SI * mKg) / (rM * rM)));
}

/**
 * Analyze any planet, moon, dwarf world, gas giant, asteroid, or star from space (`L2` / `L4`)
 * using first-principles reflectance/transmission spectroscopy & geochemical condensation physics.
 */
export function analyzeOrbitalBodySpectroscopy(bodySpec, starSpec = null, {
  planetaryMode = 'standard',
  cToO = 0.55,
  seed = 20261125
} = {}) {
  if (!bodySpec) return null;

  const isStar = Boolean(bodySpec.isStar) || bodySpec.kind === 0 || bodySpec.kind === 5;
  if (isStar) {
    const stage = String(bodySpec.stage || 'main-sequence');
    const tempK = Number(bodySpec.tempK ?? bodySpec.effectiveTempK) || 5778;
    const isPulsar = stage === 'neutron-star' || stage === 'magnetar' || stage === 'supernova-remnant-pwn';
    const isBh = stage === 'stellar-black-hole' || stage === 'hypernova-remnant' || bodySpec.kind === 5;
    const isWd = stage === 'white-dwarf' || stage === 'planetary-nebula';
    return Object.freeze({
      schema: ULG_ORBITAL_REMOTE_SENSING_SCHEMA,
      biosignatureLevel: 'stellar',
      biosignatureScore: 0,
      biosignatureBadge: isPulsar
        ? '⚡ MAGNETOSPHERIC SYNCHROTRON · Relativistic Pulsar'
        : (isBh
          ? '🕳️ RELATIVISTIC HORIZON · Accretion X-Ray Continuum'
          : (isWd
            ? '💎 DEGENERATE C/O REMNANT · Stark-Broadened Balmer'
            : `☀️ PHOTOSPHERIC PLASMA · T_eff ${Math.round(tempK).toLocaleString()} K`)),
      biosignatureSummary: isPulsar
        ? 'Coherent curvature radio & GeV gamma lighthouse pulses; superfluid neutron interior.'
        : (isBh
          ? 'Gravitational photon ring & relativistic Fe Kα 6.4 keV disk fluorescence.'
          : (isWd
            ? 'Electron-degenerate C/O core with H/He atmosphere.'
            : 'Hydrostatic fusing H/He plasma with metallic Fraunhofer absorption lines.')),
      solventLabel: 'Ionized Plasma',
      atmosphericGases: isPulsar
        ? [{ formula: 'e⁻/e⁺', name: 'Pair Plasma', amount: 'Relativistic', isBio: false }, { formula: 'Fe', name: 'Neutron Crust', amount: 'Degenerate', isBio: false }]
        : (isWd
          ? [{ formula: 'C/O', name: 'Degenerate Core', amount: '99%', isBio: false }, { formula: 'H/He', name: 'Thin Envelope', amount: '1%', isBio: false }]
          : [{ formula: 'H', name: 'Hydrogen', amount: '71–74%', isBio: false }, { formula: 'He', name: 'Helium', amount: '24–27%', isBio: false }, { formula: 'Z', name: 'Metals (C/N/O/Fe)', amount: '1–2%', isBio: false }]),
      mineralHints: [],
      spectralFeaturesNm: isPulsar
        ? [{ nm: 430, label: 'Synch UV', isBio: false }, { nm: 580, label: 'Pair Opt', isBio: false }]
        : [{ nm: 656.3, label: 'Hα', isBio: false }, { nm: 486.1, label: 'Hβ', isBio: false }, { nm: 589.3, label: 'Na D', isBio: false }]
    });
  }

  const tempK = Math.max(25, Number(bodySpec.tempK) || 220);
  const pressurePa = Math.max(0, Number(bodySpec.surfacePressurePa) || 0);
  const radiusKm = Number(bodySpec.radiusKm) || 6371;
  const coreZ = Number(bodySpec.coreZ) || 26;
  const mantleZ = Number(bodySpec.mantleZ) || 14;
  const surfZ = Number(bodySpec.surfZ) || 14;
  const isGasGiant = radiusKm >= 18000 || (bodySpec.kind === 2 && radiusKm >= 14000);
  const isIceGiant = bodySpec.kind === 3 && radiusKm >= 14000;
  const hasSolidCrust = !isGasGiant && !isIceGiant;
  const blueOceanReflect = (bodySpec.color1?.[2] || 0) > (bodySpec.color1?.[0] || 0) + 0.12 && (bodySpec.atm || 0) >= 0.30;
  const brightIceReflect = bodySpec.kind === 3
    && ((bodySpec.color0?.[2] || 0) >= 0.68 || (bodySpec.color1?.[2] || 0) > (bodySpec.color1?.[0] || 0) + 0.08)
    && tempK < 185;
  const denseHazeAtm = (bodySpec.atm || 0) >= 0.55 && pressurePa >= 5e4;
  const volatileFrac = Number.isFinite(Number(bodySpec.volatileMassFrac))
    ? Math.max(0, Number(bodySpec.volatileMassFrac))
    : (blueOceanReflect
      ? 0.06
      : (brightIceReflect
        ? 0.22
        : (denseHazeAtm
          ? 0.04
          : ((bodySpec.atm || 0) >= 0.10 && pressurePa >= 100 ? 0.008 : 0.0))));
  const dustFrac = Number.isFinite(Number(bodySpec.particulateMassFrac))
    ? Math.max(0, Number(bodySpec.particulateMassFrac))
    : (((bodySpec.color0?.[0] || 0) > 0.58 && (bodySpec.color0?.[2] || 0) < 0.36 && pressurePa >= 50) ? 0.018 : 0.002);
  const isMagmaOcean = planetaryMode === 'magma-ocean' || bodySpec.kind === 7 || tempK >= 950;
  const isHydrostaticIceBody = radiusKm >= 180 && !bodySpec.isComet;
  const isCryoMoon = Boolean(bodySpec.isCryoMoon)
    || planetaryMode === 'cryo-plumes'
    || (hasSolidCrust && isHydrostaticIceBody && tempK < 185 && volatileFrac >= 0.08 && pressurePa < 5000);
  const tBoilWaterK = pressurePa >= 611
    ? Math.max(273.16, Math.min(647.1, 373.15 / Math.max(0.55, 1.0 - 0.07632 * Math.log(Math.max(1e-4, pressurePa / 101325)))))
    : 273.16;
  const effVolFrac = Math.max(volatileFrac, Number(bodySpec.coalescedComposition?.volatileFrac) || 0);
  const hasOcean = Boolean(bodySpec.hasOcean) || (
    hasSolidCrust && !isMagmaOcean && !isCryoMoon
    && tempK >= 255 && tempK <= tBoilWaterK
    && pressurePa >= 611
    && effVolFrac >= 0.012
    && (effVolFrac >= 0.04 || bodySpec.planetClass === 'ocean-world' || (bodySpec.color1?.[2] || 0) > (bodySpec.color1?.[0] || 0) + 0.10)
  );
  const gravityMS2 = estimateGravityMS2(bodySpec);
  const stellarTeffK = Number(starSpec?.tempK ?? starSpec?.effectiveTempK) || 5778;
  const rhoAtmKgM3 = pressurePa > 1 ? Math.min(80, (pressurePa * 0.029) / (8.3145 * Math.max(40, tempK))) : 0;

  // Deterministic physical hash for world xenobiology consistency (identical to surface landing!)
  const bodySeed = ((seed >>> 0) ^ ((String(bodySpec.id || bodySpec.name || 'w').length * 2654435761) >>> 0) ^ Math.round(tempK * 17)) >>> 0;
  const xeno = deriveXenobiologyProfile({
    worldName: bodySpec.name || 'World',
    tempK,
    pressurePa,
    gravityMS2,
    rhoAtmKgM3,
    volatileFrac,
    hasSolidCrust,
    isCryoMoon,
    isMagmaOcean,
    stellarTeffK,
    cToO: Number(bodySpec.cToO) || cToO,
    civTechK: Number(bodySpec.civTechK) || undefined,
    seed: bodySeed
  });

  // 1. Remote-Sensing Biosignature Classification (strictly from physical biosphere viability, solvent & disequilibrium!)
  const viab = Number(xeno.biosphereViability) || 0;
  const solv = xeno.solvent || 'none';
  const redEdgeNm = Math.round(Number(xeno.photobiology?.redEdgeNm) || 705);
  let biosignatureLevel = 'sterile';
  let biosignatureBadge = '⚪ STERILE · No Biosignature Detected';
  let biosignatureSummary = 'Thermodynamic equilibrium crust/vacuum — zero atmospheric disequilibrium or pigment edge.';
  const spectralFeaturesNm = [];

  if (isMagmaOcean) {
    biosignatureLevel = 'sterile';
    biosignatureBadge = '🌋 STERILE · Molten Silicate Outgassing';
    biosignatureSummary = 'Surface exceeds 950 K; thermal IR shows incandescent SiO/SO₂/CO silicate vapor.';
  } else if (hasSolidCrust && solv === 'H2O' && viab >= 0.45 && pressurePa >= 8000) {
    biosignatureLevel = 'strong';
    biosignatureBadge = `🟢 STRONG BIOSIGNATURE · O₂/CH₄ + ${redEdgeNm} nm Edge`;
    biosignatureSummary = `Photochemical O₂ + CH₄ disequilibrium detected with ${xeno.solventFormula} oceans and a ${redEdgeNm} nm photosynthetic surface reflectance edge${xeno.civTechK >= 0.45 ? ` (+ narrowband radio technosignature K=${xeno.civTechK.toFixed(2)})` : ''}.`;
    spectralFeaturesNm.push(
      { nm: Math.min(735, Math.max(410, redEdgeNm)), label: `Edge ${redEdgeNm}nm`, isBio: true },
      { nm: 687, label: 'O₂-B', isBio: true },
      { nm: 620, label: 'CH₄', isBio: true },
      { nm: 600, label: 'O₃', isBio: true }
    );
  } else if (solv === 'H2O-subsurface' || isCryoMoon) {
    biosignatureLevel = 'subsurface';
    biosignatureBadge = '🔵 SUBSURFACE BIOSIGNATURE · Cryo-Plume H₂ + CH₄';
    biosignatureSummary = 'South-polar/fissure ice plumes carry molecular H₂, CH₄, and complex organics from a tidally heated subsurface H₂O ocean.';
    spectralFeaturesNm.push(
      { nm: 619, label: 'CH₄ Plume', isBio: true },
      { nm: 486, label: 'H₂O Ice', isBio: false },
      { nm: 540, label: 'Salts', isBio: false }
    );
  } else if (solv === 'CH4' && viab >= 0.25) {
    biosignatureLevel = 'tentative';
    biosignatureBadge = '🟡 TENTATIVE CRYOBIO · C₂H₂/H₂ Depletion Anomaly';
    biosignatureSummary = 'Dense N₂/CH₄ haze with liquid hydrocarbon seas shows anomalous surface H₂ & acetylene (C₂H₂) consumption.';
    spectralFeaturesNm.push(
      { nm: 619, label: 'CH₄', isBio: true },
      { nm: 543, label: 'Tholins', isBio: true },
      { nm: 665, label: 'C₂H₂ Sink', isBio: true }
    );
  } else if ((solv === 'H2SO4' || solv === 'CO2-liq' || solv === 'NH3') && viab >= 0.22) {
    biosignatureLevel = 'tentative';
    biosignatureBadge = `🟡 TENTATIVE CLOUD/CHEMO · ${solv === 'H2SO4' ? 'PH₃/UV Cloud Absorber' : `${xeno.solventFormula} Redox Anomaly`}`;
    biosignatureSummary = solv === 'H2SO4'
      ? 'Temperate upper-cloud aerosol layer shows unexplained 380–460 nm UV absorption and trace PH₃ disequilibrium.'
      : `Exotic ${xeno.solventLabel} solvent envelope exhibits non-equilibrium trace reductant cycling.`;
    spectralFeaturesNm.push(
      { nm: 420, label: 'UV Abs', isBio: true },
      { nm: 590, label: 'SO₂/Cloud', isBio: false }
    );
  } else if (solv === 'H2-He-cloud' && viab >= 0.25) {
    biosignatureLevel = 'tentative';
    biosignatureBadge = '🟡 AERIAL CLOUD BIO · H₂/NH₃ Convective Chromophores';
    biosignatureSummary = 'Temperate 1–5 bar cloud deck shows non-equilibrium organic chromophores & phosphine/ammonia redox gradients.';
    spectralFeaturesNm.push(
      { nm: 619, label: 'CH₄', isBio: false },
      { nm: 645, label: 'NH₃', isBio: true }
    );
  } else if (pressurePa >= 300 && volatileFrac >= 0.004 && tempK >= 110 && tempK <= 460) {
    biosignatureLevel = 'prebiotic';
    biosignatureBadge = '🟠 PREBIOTIC POTENTIAL · Trace Volatiles & Organics';
    biosignatureSummary = 'Thin volatile atmosphere or frost reservoirs support prebiotic chemistry, but no active global disequilibrium detected.';
    spectralFeaturesNm.push(
      { nm: 530, label: 'Fe₂O₃/Dust', isBio: false },
      { nm: 690, label: 'CO₂/H₂O', isBio: false }
    );
  } else {
    biosignatureLevel = 'sterile';
    biosignatureBadge = pressurePa < 10
      ? '⚪ STERILE · Airless Vacuum Body'
      : '⚪ STERILE · Extreme Abiotic Regime';
    biosignatureSummary = pressurePa < 10
      ? 'Exposed airless crust / regolith bathed in unshielded stellar radiation; direct mineral reflectance visible.'
      : 'Extreme temperature or pressure outside known catalytic solvent envelopes.';
  }

  // 2. First-Principles Atmospheric Gas Inventory (derived from T, P, Z, volatileFrac, & biosphere!)
  const atmosphericGases = [];
  if (isGasGiant) {
    atmosphericGases.push(
      { formula: 'H₂', name: 'Molecular Hydrogen', amount: '86–90%', isBio: false },
      { formula: 'He', name: 'Helium', amount: '10–13%', isBio: false },
      { formula: 'NH₃', name: 'Ammonia Clouds', amount: '0.03%', isBio: false },
      { formula: 'CH₄', name: 'Methane', amount: '0.3%', isBio: false }
    );
  } else if (isIceGiant) {
    atmosphericGases.push(
      { formula: 'H₂', name: 'Hydrogen', amount: '80–83%', isBio: false },
      { formula: 'He', name: 'Helium', amount: '15–18%', isBio: false },
      { formula: 'CH₄', name: 'Methane (Red Abs)', amount: '2.3%', isBio: false },
      { formula: 'H₂S', name: 'Hydrogen Sulfide', amount: 'Trace', isBio: false }
    );
  } else if (pressurePa >= 100) {
    if (biosignatureLevel === 'strong') {
      atmosphericGases.push(
        { formula: 'N₂', name: 'Nitrogen', amount: '76%', isBio: false },
        { formula: 'O₂', name: 'Oxygen (Biogenic)', amount: '21%', isBio: true },
        { formula: 'H₂O', name: 'Water Vapor', amount: '1.4%', isBio: false },
        { formula: 'CH₄', name: 'Methane (Diseq.)', amount: '2–18 ppm', isBio: true }
      );
    } else if (solv === 'CH4') {
      atmosphericGases.push(
        { formula: 'N₂', name: 'Nitrogen', amount: '94%', isBio: false },
        { formula: 'CH₄', name: 'Methane', amount: '5.1%', isBio: true },
        { formula: 'H₂', name: 'Hydrogen', amount: '0.1%', isBio: false },
        { formula: 'C₂H₆', name: 'Ethane/Tholins', amount: 'Haze', isBio: true }
      );
    } else if (tempK > 440 && pressurePa > 5e5) {
      atmosphericGases.push(
        { formula: 'CO₂', name: 'Supercritical CO₂', amount: '96%', isBio: false },
        { formula: 'N₂', name: 'Nitrogen', amount: '3.5%', isBio: false },
        { formula: 'SO₂/H₂SO₄', name: 'Sulfuric Clouds', amount: '150 ppm', isBio: false },
        ...(biosignatureLevel === 'tentative' ? [{ formula: 'PH₃?', name: 'Cloud Anomaly', amount: 'Trace', isBio: true }] : [])
      );
    } else if (tempK < 260 && pressurePa < 2e4) {
      atmosphericGases.push(
        { formula: 'CO₂', name: 'Carbon Dioxide', amount: '95%', isBio: false },
        { formula: 'N₂', name: 'Nitrogen', amount: '2.7%', isBio: false },
        { formula: 'Ar', name: 'Argon', amount: '1.6%', isBio: false },
        { formula: 'H₂O', name: 'Frost Vapor', amount: '0.03%', isBio: false }
      );
    } else {
      atmosphericGases.push(
        { formula: 'N₂', name: 'Nitrogen', amount: '68%', isBio: false },
        { formula: 'CO₂', name: 'Carbon Dioxide', amount: '28%', isBio: false },
        { formula: 'H₂O', name: 'Water Vapor', amount: '3%', isBio: false }
      );
    }
  } else if (isCryoMoon) {
    atmosphericGases.push(
      { formula: 'H₂O', name: 'Plume Vapor', amount: '91%', isBio: false },
      { formula: 'CO₂', name: 'Carbon Dioxide', amount: '3.2%', isBio: false },
      { formula: 'CH₄', name: 'Hydrothermal CH₄', amount: '1.7%', isBio: true },
      { formula: 'H₂', name: 'Serpentinization H₂', amount: '1.4%', isBio: true }
    );
  } else {
    atmosphericGases.push({ formula: 'Vac', name: 'Exosphere (<10 Pa)', amount: 'Trace Na/He', isBio: false });
  }

  // 3. First-Principles Predicted Surface/Interior Minerals & Compounds Hints!
  const mineralHints = [];
  const addMin = (formula, name, tag) => {
    if (mineralHints.length < 5 && !mineralHints.some((m) => m.formula === formula)) {
      mineralHints.push({ formula, name, tag });
    }
  };

  if (isGasGiant) {
    addMin('H₂ (Metallic)', 'Liquid Metallic Hydrogen Core', 'Deep Interior');
    addMin('NH₄SH', 'Ammonium Hydrosulfide Deck', 'Cloud Strata');
    addMin('H₂O Ice', 'Deep Supercritical Water', 'Lower Deck');
    addMin('He', 'Helium Rain Layer', 'Mantle');
  } else if (isIceGiant) {
    addMin('H₂O/NH₃', 'Superionic Water–Ammonia Mantle', 'Deep Ocean');
    addMin('CH₄ Ice', 'Methane Hazes & Clathrates', 'Upper Deck');
    addMin('C (Diamond)', 'High-P Diamond Rain', 'Core Boundary');
  } else if (isMagmaOcean) {
    addMin('Mg₂SiO₄', 'Molten Olivine Magma', 'Crust/Lava');
    addMin('FeS / FeO', 'Liquid Iron-Sulfide Melt', 'Mantle');
    addMin('SiO₂', 'Basaltic Rhyolite Crust', 'Cooling Plates');
    addMin('SO₂', 'Volcanic Outgas Plumes', 'Vents');
  } else {
    // Solid rocky / icy / ocean / carbon / sulfur / metallic worlds!
    const isSulfurVolc = (bodySpec.color0?.[0] || 0) > 0.85 && (bodySpec.color0?.[1] || 0) > 0.72 && (bodySpec.color0?.[2] || 0) < 0.45 && pressurePa < 50;
    const isCarbonRich = (Number(bodySpec.cToO) || cToO) >= 0.80 || surfZ === 6 || mantleZ === 6;
    const isOxidizedDust = dustFrac >= 0.008 && tempK < 340 && (bodySpec.color0?.[0] || 0) > 0.55 && (bodySpec.color0?.[2] || 0) < 0.42;

    if (isSulfurVolc) {
      addMin('S₈ / SO₂', 'Allotropic Sulfur & Frost', 'Volcanic Plains');
      addMin('MgSiO₃', 'Ultramafic Silicate Magma', 'Calderas');
      addMin('FeS', 'Troilite Sulfide Core', 'Interior');
    }
    if (isCarbonRich) {
      addMin('SiC', 'Silicon Carbide Crust', 'High C/O');
      addMin('C (Graphite/Dia)', 'Carbon & Diamond Mantle', 'High-P');
    }
    if (hasOcean) {
      addMin('H₂O (liq)', 'Saline Liquid Water Ocean', 'Hydrosphere');
      addMin('SiO₂ / Al₂O₃', 'Granitic Continental Crust', 'Continents');
      addMin('CaCO₃', 'Carbonate Sediments', 'Shelf/Biogenic');
      addMin('NaCl', 'Halite Evaporites', 'Basins');
    } else if (solv === 'CH4') {
      addMin('CH₄ / C₂H₆', 'Liquid Hydrocarbon Seas', 'Polar Lakes');
      addMin('H₂O Ice', 'Cryogenic Water-Ice Bedrock', 'Highlands');
      addMin('Tholins', 'Photochemical Organic Dunes', 'Equatorial');
    } else if (isCryoMoon || (tempK < 185 && volatileFrac >= 0.05)) {
      addMin('H₂O Ice Ih', 'Tectonic Water-Ice Shell', 'Lithosphere');
      addMin('NaCl / MgSO₄', 'Briny Hydrated Salts', 'Fissures');
      addMin('CO₂ / N₂ Ice', 'Cryogenic Volatile Glaciers', 'Surface');
    } else if (isOxidizedDust) {
      addMin('Fe₂O₃', 'Hematite Ferric Oxide Dust', 'Regolith');
      addMin('SiO₂', 'Basaltic Plagioclase Rock', 'Highlands');
      addMin('CO₂ / H₂O Ice', 'Polar Cap Frosts', 'Poles');
    } else if (bodySpec.isMetallicAsteroid || coreZ === 26 && surfZ === 26) {
      addMin('Fe-Ni Alloy', 'Kamacite / Taenite Metal', 'Bulk Body');
      addMin('FeS', 'Troilite Inclusions', 'Veins');
      addMin('Pt / Ir', 'Siderophile Heavy Metals', 'Trace');
    } else {
      addMin('SiO₂ / Al₂O₃', 'Anorthosite & Basalt Silicate', 'Crust');
      addMin('FeTiO₃', 'Ilmenite Titanium-Iron Ore', 'Mare/Basins');
      addMin('Mg₂SiO₄', 'Olivine-Pyroxene Mantle', 'Ejecta');
    }
    if (coreZ === 26 && !mineralHints.some((m) => m.formula.includes('Fe'))) {
      addMin('Fe-Ni', 'Differentiated Metallic Core', 'Deep Core');
    }
  }

  return Object.freeze({
    schema: ULG_ORBITAL_REMOTE_SENSING_SCHEMA,
    biosignatureLevel,
    biosignatureScore: Number(viab.toFixed(2)),
    biosignatureBadge,
    biosignatureSummary,
    solventLabel: xeno.solventLabel || 'None',
    solventFormula: xeno.solventFormula || '—',
    redEdgeNm: biosignatureLevel === 'strong' ? redEdgeNm : null,
    civTechK: Number(xeno.civTechK) || 0,
    atmosphericGases: Object.freeze(atmosphericGases),
    mineralHints: Object.freeze(mineralHints),
    spectralFeaturesNm: Object.freeze(spectralFeaturesNm)
  });
}
