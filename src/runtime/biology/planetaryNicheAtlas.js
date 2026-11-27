// Stage 1 of ULG Emergent Alien Ecosystems (`src/runtime/biology/planetaryNicheAtlas.js`).
//
// Extracts a continuous Planetary Habitat Tensor E_planet strictly from live GPU
// planet/CFD/star/geodynamo simulation state and partitions every habitable world
// into 4..8 physical micro-niches. Sterile vacuum/magma worlds produce exact 0 niches.
//
// Strictly Star Spec v0.4 compliant: ZERO hardcoded planet-name or species-name hacks.

import {
  classifySolventBains2024,
  solvePhotobiologySpectrum,
  deriveRedoxAndBiosignatures
} from './xenobiologyEcologyEngine.js';

export const ULG_PLANETARY_NICHE_ATLAS_SCHEMA = 'ulg.biology.planetary-niche-atlas.v1';

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function hashU32(seed) {
  let x = (seed >>> 0) || 1;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

/**
 * Derive a deterministic 128-bit planetary phylogenetic root seed from cosmic lineage
 * coordinates + physical invariants so even two twin-mass Earth-like planets around
 * identical stars radiate completely independent Trees of Life.
 */
export function computePlanetaryPhylogenyRootSeed(planetState = {}) {
  const s0 = hashU32(Number(planetState.universeSeed ?? planetState.seed ?? 20261127) >>> 0);
  const s1 = hashU32((Number(planetState.starSeed ?? 0x9e3779b9) ^ Number(planetState.bodyIndex ?? 0) * 2654435761) >>> 0);
  const s2 = hashU32(Math.round((Number(planetState.gravityMS2) || 9.81) * 1000) ^ Math.round((Number(planetState.tempK) || 288) * 100));
  const s3 = hashU32(Math.round((Number(planetState.pressurePa) || 101325) * 0.1) ^ Math.round((Number(planetState.stellarTeffK) || 5778) * 17));
  const nameStr = String(planetState.worldId || planetState.worldName || '');
  let hName = 2166136261 >>> 0;
  for (let i = 0; i < nameStr.length; i += 1) {
    hName = Math.imul(hName ^ nameStr.charCodeAt(i), 16777619) >>> 0;
  }
  return Object.freeze([
    hashU32(s0 ^ hName),
    hashU32(s1 ^ (s0 << 5) ^ (s0 >>> 3)),
    hashU32(s2 ^ s1 ^ 0x51f15e3),
    hashU32(s3 ^ hName ^ 0x85ebca6b)
  ]);
}

/**
 * Extract the continuous Planetary Habitat Tensor E_planet strictly from live
 * GPU physical parameters (gravity, fluid/atmosphere, radiation, geodynamo, mineralogy).
 */
export function extractPlanetaryHabitatTensor(planetState = {}) {
  const tempK = Math.max(20, Number(planetState.tempK ?? planetState.surfaceTempK) || 288);
  const pressurePa = Math.max(0, Number(planetState.pressurePa ?? planetState.surfacePressurePa) || 0);
  const gravityMS2 = clamp(Number(planetState.gravityMS2 ?? planetState.gravity) || 9.81, 0.15, 45.0);
  const hasSolidCrust = planetState.hasSolidCrust !== false;
  const isCryoMoon = Boolean(planetState.isCryoMoon);
  const isMagmaOcean = Boolean(planetState.isMagmaOcean) || tempK > 950;
  const volatileFrac = clamp(Number(planetState.volatileFrac ?? 0.04), 0.0, 0.85);
  const stellarTeffK = clamp(Number(planetState.stellarTeffK ?? 5778), 2300, 16000);
  const uvFluxNorm = clamp(
    Number(planetState.uvFluxNorm ?? Math.pow(stellarTeffK / 5778, 3.2)),
    0.01,
    12.0
  );
  const cToO = clamp(Number(planetState.cToO ?? 0.55), 0.12, 1.85);
  const feFrac = clamp(Number(planetState.feFrac ?? 0.26), 0.02, 0.85);
  const siFrac = clamp(Number(planetState.siFrac ?? 0.44), 0.02, 0.85);
  const obliquityDeg = clamp(Number(planetState.axialObliquityDeg ?? planetState.obliquityDeg ?? 23.4), 0, 90);
  const rotationPeriodHr = Math.max(2.0, Number(planetState.rotationPeriodHr ?? 24.0));
  const tidallyLocked = Boolean(planetState.tidallyLocked);
  const omegaRadS = (2 * Math.PI) / (rotationPeriodHr * 3600);
  const coriolisParam = 2 * omegaRadS * Math.sin(Math.PI / 4);

  const rhoAtmKgM3 = Number.isFinite(Number(planetState.rhoAtmKgM3))
    ? Math.max(0, Number(planetState.rhoAtmKgM3))
    : (pressurePa > 0 ? clamp((pressurePa * 0.029) / (8.31446 * Math.max(50, tempK)), 0, 120) : 0);

  const windMeanMS = Number.isFinite(Number(planetState.windMeanMS))
    ? Math.max(0, Number(planetState.windMeanMS))
    : (rhoAtmKgM3 > 0.01 ? clamp(4.5 * Math.pow(Math.max(100, tempK) / 288, 0.5) * Math.pow(1.22 / Math.max(0.08, rhoAtmKgM3), 0.22), 0.5, 95) : 0);
  const windGustMS = Number.isFinite(Number(planetState.windGustMS))
    ? Math.max(windMeanMS, Number(planetState.windGustMS))
    : windMeanMS * (1.55 + 0.45 * clamp(obliquityDeg / 60, 0, 1));

  const geodynamoDipoleUT = clamp(Number(planetState.geodynamoDipoleUT ?? (feFrac > 0.15 ? 38 : 6)), 0, 5000);
  const hydrothermalFrac = clamp(
    Number(planetState.hydrothermalFrac ?? (isCryoMoon ? 0.65 : clamp(0.18 + feFrac * 0.4, 0.05, 0.85))),
    0,
    1
  );

  const solventInfo = classifySolventBains2024({
    tempK,
    pressurePa,
    volatileFrac,
    hasSolidCrust,
    isCryoMoon,
    isMagmaOcean,
    cToO
  });
  const photobiology = solvePhotobiologySpectrum({
    stellarTeffK,
    solvent: solventInfo.solvent,
    pressurePa,
    uvFluxNorm
  });
  const redox = deriveRedoxAndBiosignatures({
    solvent: solventInfo.solvent,
    tempK,
    pressurePa,
    uvFluxNorm,
    stellarTeffK
  });

  // Strict sterility null limit:
  //   - Magma worlds (T > 950 K) or solvent === 'none'
  //   - Vacuum solid worlds (P < 500 Pa) unless subsurface icy-moon brine ocean
  const isSterileVacuum = hasSolidCrust && !isCryoMoon && pressurePa < 500;
  const isSterile = isMagmaOcean || isSterileVacuum || solventInfo.solvent === 'none';

  let biosphereViability = 0.0;
  if (!isSterile) {
    const baseBySolvent = {
      H2O: 0.90,
      'CO2-liq': 0.64,
      NH3: 0.60,
      CH4: 0.52,
      H2SO4: 0.40,
      'H2O-subsurface': 0.58,
      'H2-He-cloud': 0.54
    };
    biosphereViability = baseBySolvent[solventInfo.solvent] ?? 0.45;
    if (solventInfo.solvent !== 'H2O-subsurface' && solventInfo.solvent !== 'H2-He-cloud' && pressurePa < 2000) {
      biosphereViability *= clamp(pressurePa / 2000, 0.12, 1.0);
    }
    const magneticShield = clamp(0.78 + 0.22 * Math.min(1, geodynamoDipoleUT / 25), 0.72, 1.0);
    const uvPenalty = uvFluxNorm > 4.5 ? clamp(1.0 - (uvFluxNorm - 4.5) * 0.055, 0.55, 1.0) : 1.0;
    biosphereViability = clamp(biosphereViability * magneticShield * uvPenalty, 0.0, 1.0);
  }

  const oceanCoverageFrac = Number.isFinite(Number(planetState.oceanCoverageFrac))
    ? clamp(Number(planetState.oceanCoverageFrac), 0, 1)
    : (isSterile
      ? 0
      : (!hasSolidCrust
        ? 0
        : (solventInfo.isCloudDeckHabitat
          ? 0
          : (solventInfo.solvent === 'H2O-subsurface' ? 1.0 : clamp(0.18 + volatileFrac * 9.5, 0.12, 0.94)))));

  // Euler column buckling height scale H_max ~ (E / (rho * g))^(1/3), plus aerodynamic buoyancy lift
  const mineralStiffnessMul = clamp(0.75 + siFrac * 0.45 + feFrac * 0.30, 0.65, 1.45);
  const bucklingHeightScale = clamp(
    Math.pow((9.81 * mineralStiffnessMul) / gravityMS2, 1.0 / 3.0) * (1.0 + 0.12 * Math.log1p(rhoAtmKgM3)),
    0.38,
    3.1
  );

  // Dynamic wind pressure q_wind = 0.5 * rho * v^2 normalized to Earth 10 m/s breeze (61 Pa)
  const windDynamicPressureNorm = clamp((0.5 * rhoAtmKgM3 * windMeanMS * windMeanMS) / 61.0, 0.0, 18.0);
  // Wing loading ratio W/S ~ g / rho_atm (lower => effortless aerial/buoyant radiation!)
  const aerialEase = rhoAtmKgM3 > 0.02
    ? clamp((rhoAtmKgM3 / 1.22) * Math.pow(9.81 / gravityMS2, 0.85), 0.0, 12.0)
    : 0.0;

  // Fluid density & viscosity for Reynolds / Strouhal mechanics
  const solventDensityKgM3 = solventInfo.solvent === 'CH4'
    ? 450
    : (solventInfo.solvent === 'NH3' ? 730 : (solventInfo.solvent === 'CO2-liq' ? 880 : (solventInfo.solvent === 'H2SO4' ? 1830 : 1015)));
  const solventViscosityPaS = solventInfo.solvent === 'CH4'
    ? 1.8e-4
    : (solventInfo.solvent === 'H2SO4' ? 2.4e-2 : 1.05e-3);

  const deltaTDiurnalK = tidallyLocked
    ? clamp(45 + 110 / (1 + rhoAtmKgM3 * 1.4), 15, 180)
    : clamp((22 + obliquityDeg * 0.6) / Math.pow(1 + rhoAtmKgM3 * 0.85, 0.65), 2, 110);

  const rootSeed = computePlanetaryPhylogenyRootSeed(planetState);

  return Object.freeze({
    schema: ULG_PLANETARY_NICHE_ATLAS_SCHEMA,
    worldName: String(planetState.worldName || 'Exoplanet'),
    rootSeed,
    seed: rootSeed[0],
    isSterile,
    biosphereViability: Number(biosphereViability.toFixed(3)),
    gravityMS2: Number(gravityMS2.toFixed(3)),
    coriolisParam,
    rotationPeriodHr,
    obliquityDeg,
    tidallyLocked,
    tempK: Number(tempK.toFixed(2)),
    deltaTDiurnalK: Number(deltaTDiurnalK.toFixed(2)),
    pressurePa: Math.round(pressurePa),
    rhoAtmKgM3: Number(rhoAtmKgM3.toFixed(4)),
    windMeanMS: Number(windMeanMS.toFixed(2)),
    windGustMS: Number(windGustMS.toFixed(2)),
    windDynamicPressureNorm: Number(windDynamicPressureNorm.toFixed(3)),
    aerialEase: Number(aerialEase.toFixed(3)),
    hasSolidCrust,
    isCryoMoon,
    isMagmaOcean,
    oceanCoverageFrac: Number(oceanCoverageFrac.toFixed(3)),
    hydrothermalFrac: Number(hydrothermalFrac.toFixed(3)),
    geodynamoDipoleUT: Number(geodynamoDipoleUT.toFixed(2)),
    stellarTeffK: Math.round(stellarTeffK),
    uvFluxNorm: Number(uvFluxNorm.toFixed(3)),
    mineralogy: Object.freeze({ feFrac, siFrac, cToO, volatileFrac }),
    solventInfo,
    solventDensityKgM3,
    solventViscosityPaS,
    photobiology,
    redox,
    bucklingHeightScale: Number(bucklingHeightScale.toFixed(3))
  });
}

/**
 * Partition any habitable world dynamically into 4..8 physical micro-niches
 * strictly from its Planetary Habitat Tensor E_planet (exact 0 niches if sterile).
 */
export function buildPlanetaryNicheAtlas(planetState = {}) {
  const tensor = extractPlanetaryHabitatTensor(planetState);
  if (tensor.isSterile || tensor.biosphereViability < 0.15) {
    return Object.freeze({
      schema: ULG_PLANETARY_NICHE_ATLAS_SCHEMA,
      tensor,
      niches: Object.freeze([]),
      totalCarryingCapacity: 0
    });
  }

  const niches = [];
  const T = tensor.tempK;
  const g = tensor.gravityMS2;
  const rho = tensor.rhoAtmKgM3;
  const solv = tensor.solventInfo.solvent;
  const hasOcean = tensor.oceanCoverageFrac > 0.08 && !tensor.solventInfo.isCloudDeckHabitat && tensor.hasSolidCrust;
  const hasLand = tensor.hasSolidCrust && tensor.oceanCoverageFrac < 0.96 && !tensor.solventInfo.isCloudDeckHabitat && solv !== 'H2O-subsurface';

  const addNiche = (id, label, medium, opts = {}) => {
    const localT = clamp(T + (opts.dT || 0), 65, 680);
    const light = clamp(opts.lightFluxNorm ?? 1.0, 0.0, 2.0);
    const fluidRho = medium === 'aquatic' ? tensor.solventDensityKgM3 : rho;
    const wind = medium === 'aquatic' ? 0.6 : tensor.windMeanMS * (opts.windMul ?? 1.0);
    const moisture = clamp(opts.moisture ?? (medium === 'aquatic' ? 1.0 : 0.65), 0.05, 1.0);
    const nutrient = clamp(opts.nutrient ?? 0.65, 0.1, 1.6);
    const areaFrac = clamp(opts.areaFrac ?? 0.18, 0.04, 0.55);
    const energyInput = (light * 0.72 + (opts.chemoFlux || 0) * 0.85) * moisture * tensor.biosphereViability;
    const carryingCapacity = Number(Math.max(12, 850 * areaFrac * energyInput * nutrient).toFixed(1));
    niches.push(Object.freeze({
      index: niches.length,
      id,
      label,
      medium, // 'terrestrial' | 'aquatic' | 'aerial' | 'buoyant'
      tempK: Number(localT.toFixed(1)),
      lightFluxNorm: Number(light.toFixed(3)),
      chemoFluxNorm: Number((opts.chemoFlux || 0).toFixed(3)),
      fluidDensityKgM3: Number(fluidRho.toFixed(3)),
      windMS: Number(wind.toFixed(2)),
      moistureFrac: Number(moisture.toFixed(2)),
      nutrientFlux: Number(nutrient.toFixed(2)),
      elevationPrefNorm: Number((opts.elevPref ?? 0.35).toFixed(2)),
      slopeTolerance: Number((opts.slopeTol ?? 0.35).toFixed(2)),
      gravityMS2: g,
      areaFrac: Number(areaFrac.toFixed(3)),
      carryingCapacity
    }));
  };

  if (tensor.solventInfo.isCloudDeckHabitat || !tensor.hasSolidCrust) {
    // Baroclinic Gas-Giant or Venusian Elevated Cloud-Deck Aerial Biosphere (4-5 altitude strata!)
    addNiche('upper-photic-cloud', 'Upper Photic Aerosol Stratum', 'aerial', {
      dT: -24, lightFluxNorm: 1.25, windMul: 1.45, moisture: 0.72, nutrient: 0.70, areaFrac: 0.28
    });
    addNiche('buoyant-updraft-band', 'Baroclinic Updraft Buoyancy Deck', 'buoyant', {
      dT: 0, lightFluxNorm: 0.82, windMul: 1.10, moisture: 0.92, nutrient: 0.95, areaFrac: 0.34
    });
    addNiche('twilight-condensate-layer', 'Deep Condensate Mist Stratum', 'buoyant', {
      dT: 32, lightFluxNorm: 0.24, chemoFlux: 0.55, windMul: 0.85, moisture: 0.96, nutrient: 1.10, areaFrac: 0.24
    });
    addNiche('storm-shear-vortex', 'Cyclonic Jet-Shear Belt', 'aerial', {
      dT: 8, lightFluxNorm: 0.65, chemoFlux: 0.35, windMul: 1.85, moisture: 0.80, nutrient: 0.88, areaFrac: 0.14
    });
  } else if (solv === 'H2O-subsurface') {
    // Subsurface Hydrothermal Brine Ocean (4 depth/vent niches!)
    addNiche('sub-ice-ceiling', 'Sub-Ice Brine Interface', 'aquatic', {
      dT: 165, lightFluxNorm: 0.04, chemoFlux: 0.52, moisture: 1.0, nutrient: 0.72, elevPref: 0.1, areaFrac: 0.28
    });
    addNiche('hydrothermal-chimney', 'Alkaline Hydrothermal Vent Field', 'aquatic', {
      dT: 235, lightFluxNorm: 0.0, chemoFlux: 1.35, moisture: 1.0, nutrient: 1.45, elevPref: 0.0, areaFrac: 0.22
    });
    addNiche('pelagic-brine-column', 'Open Abyssal Brine Column', 'aquatic', {
      dT: 178, lightFluxNorm: 0.0, chemoFlux: 0.45, moisture: 1.0, nutrient: 0.64, elevPref: 0.05, areaFrac: 0.32
    });
    addNiche('benthic-mineral-plain', 'Benthic Silicate-Sulfide Floor', 'aquatic', {
      dT: 184, lightFluxNorm: 0.0, chemoFlux: 0.68, moisture: 1.0, nutrient: 0.88, elevPref: 0.0, areaFrac: 0.18
    });
  } else {
    // Solid-Crust Worlds with Surface Atmosphere and/or Solvent Seas (4..8 micro-niches!)
    if (hasLand) {
      addNiche('euphotic-shoreline', 'Euphotic Coastal & Riverine Margin', 'terrestrial', {
        dT: 2, lightFluxNorm: 1.05, windMul: 0.95, moisture: 0.92, nutrient: 1.15, elevPref: 0.14, slopeTol: 0.25, areaFrac: 0.22
      });
      addNiche('shaded-lowland-basin', 'Humid Lowland Canopy Basin', 'terrestrial', {
        dT: 6, lightFluxNorm: 0.78, windMul: 0.65, moisture: 0.84, nutrient: 1.02, elevPref: 0.26, slopeTol: 0.30, areaFrac: 0.24
      });
      addNiche('wind-scoured-highland', 'Wind-Scoured Ridge & Upland', 'terrestrial', {
        dT: -14, lightFluxNorm: 1.18, windMul: 1.65, moisture: 0.44, nutrient: 0.62, elevPref: 0.76, slopeTol: 0.48, areaFrac: 0.16
      });
      if (tensor.hydrothermalFrac >= 0.20) {
        addNiche('geothermal-rift', 'Geothermal Volcanic & Fumarole Rift', 'terrestrial', {
          dT: 24, lightFluxNorm: 0.60, chemoFlux: 0.95, windMul: 0.85, moisture: 0.68, nutrient: 1.25, elevPref: 0.55, slopeTol: 0.45, areaFrac: 0.10
        });
      }
      if (tensor.tidallyLocked) {
        addNiche('twilight-terminator', 'Eternal Twilight Terminator Ring', 'terrestrial', {
          dT: -8, lightFluxNorm: 0.42, windMul: 1.40, moisture: 0.78, nutrient: 0.86, elevPref: 0.30, areaFrac: 0.16
        });
      }
    }
    if (hasOcean) {
      addNiche('pelagic-photic', 'Sunlit Pelagic Solvent Sea', 'aquatic', {
        dT: -2, lightFluxNorm: 0.88, windMul: 0.40, moisture: 1.0, nutrient: 0.92, elevPref: -0.25, areaFrac: 0.24
      });
      addNiche('benthic-shelf', 'Benthic Reef & Chemosynthetic Shelf', 'aquatic', {
        dT: -8, lightFluxNorm: 0.32, chemoFlux: 0.58, windMul: 0.20, moisture: 1.0, nutrient: 1.08, elevPref: -0.48, areaFrac: 0.14
      });
    }
    if (tensor.aerialEase >= 0.28 || rho >= 0.35) {
      const airMedium = tensor.aerialEase >= 2.2 ? 'buoyant' : 'aerial';
      addNiche('tropospheric-airspace', airMedium === 'buoyant' ? 'Dense-Air Buoyant Canopy Stratum' : 'Tropospheric Thermal Airspace', airMedium, {
        dT: -6, lightFluxNorm: 1.15, windMul: 1.35, moisture: 0.60, nutrient: 0.72, elevPref: 0.60, areaFrac: 0.14
      });
    }
  }

  // Guarantee [4..8] physical niches on every viable world
  while (niches.length < 4) {
    addNiche(`micro-stratum-${niches.length}`, `Sub-Canopy Micro-Stratum ${niches.length + 1}`, hasLand ? 'terrestrial' : 'aquatic', {
      dT: (niches.length - 2) * 5, lightFluxNorm: 0.55, chemoFlux: 0.35, moisture: 0.75, nutrient: 0.80, areaFrac: 0.12
    });
  }
  const trimmed = niches.slice(0, 8);
  const totalCarryingCapacity = Number(trimmed.reduce((s, n) => s + n.carryingCapacity, 0).toFixed(1));

  return Object.freeze({
    schema: ULG_PLANETARY_NICHE_ATLAS_SCHEMA,
    tensor,
    niches: Object.freeze(trimmed),
    totalCarryingCapacity
  });
}
