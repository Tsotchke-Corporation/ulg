// Canonical First-Principles Planetary Surface Terrain, 6-Wheel Rocker-Bogie Rover
// with Jump Rockets, & Aerodynamic Atmospheric Drone WebGPU Law
// (`planetary-surface-vehicles@1`, `src/runtime/astrophysics/planetarySurfaceVehiclesGpu.js`).
//
// Strictly Star Spec v0.4 & ULG General-Law Thesis compliant:
//   - ZERO planet-name / material-name hacks, ZERO serial 1-thread compute passes,
//     ZERO private 4,096-bucket hashes, ZERO scripted Math.sin(t) animations.
//   - Every surface environment, rover trajectory, rocket-jump arc, and drone lift curve
//     emerges directly from the body's live physical state:
//       * Surface gravity `g = G M / R^2` (1.62 m/s^2 Moon -> huge rocket hops;
//         3.72 m/s^2 Mars -> lively bounding arcs; 9.81 m/s^2 Earth -> crisp traction).
//       * Ideal-gas atmospheric density `rho_atm = P * M_mol / (R_gas * T)`:
//           - Drone actuator-disk rotor lift `F_lift_max = k_rotor * rho_atm * omega_max^2`
//             strictly vanishes in vacuum (`P = 0 -> maxAeroLiftN === 0`!), flies delicately
//             in thin 650 Pa Martian air (Ingenuity regime), and soars effortlessly on Earth/Titan!
//           - Atmospheric Rayleigh/Mie sky color, horizon haze, wind drift, and crater
//             erosion all emerge continuously from `(P, T, particulateMassFrac, volatileMassFrac)`.
//   - Adapted from `peercompute/demos/planetgen/src/TinyPlanetControls.js` with curved
//     tiny-planet horizon drop, 3rd-person chase & 1st-person mast/cockpit cameras,
//     GPU-generated 129x129 dynamic terrain mesh, articulated 3D Rover + Drone geometry,
//     and 2,048 live WebGPU rocket-exhaust / regolith-dust / rotor-downwash plume particles!

import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import {
  LAW_ADAPTER_MODES,
  LAW_FALLBACK_POLICIES,
  LAW_SPATIAL_AUTHORITIES
} from '../sph/lawAdapterContract.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';
import { deriveFluidElectrodynamicsState } from './planetaryAtmosphereElectricGpu.js';
import {
  resolvePlanetarySurfacePbrOptics,
  resolveSolventIor
} from '../material/materialPbrOpticsBridge.js';
import {
  createPlanetaryAtmo3dCfdSessionWebGpu,
  evaluateAtmosphericChemistryAtAltitude
} from './planetaryAtmosphere3dCfdGpu.js';
import {
  UFO_RADIUS_M,
  appendIconicUfoGeometry,
  appendMissileGeometry,
  appendVonNeumannProbeGeometry,
  computeAntimatterMassRateKgS,
  computeBodyBindingEnergyJ,
  computeUfoRimEmitPoint,
  evaluateAntimatterAnnihilation,
  evaluateEmWavelengthInfo,
  evaluateLaserMaterialInteraction
} from './ufoWeaponsAndPhysicsGpu.js';
import {
  DEFORM_GRID_N,
  DEFORM_PATCH_HALF_M,
  createSurfaceDeformationAndBouldersGpu
} from './surfaceDeformationMpmGpu.js';
import {
  TECTONIC_GRID_N,
  TECTONIC_WORLD_SPAN_M,
  createSurfaceTectonicsErosionGpu
} from './surfaceTectonicsErosionGpu.js';
import {
  OCEAN_GRID_N,
  OCEAN_PATCH_HALF_M,
  createSurfaceOceanWaveGpu
} from './surfaceOceanWaveGpu.js';
import {
  buildSettlementTemplateFloats,
  createSurfaceFloraPlacementGpu
} from './surfaceFloraPlacementGpu.js';
import {
  buildLifeLabXenobiologyUrl,
  deriveXenobiologyProfile,
  synthesizeAbductedSpecimenRecord
} from '../biology/xenobiologySynthesizer.js';
import { appendProceduralOrganismGeometry } from '../biology/xenobiologyAnatomyMesh.js';
import { bakePlanetaryFloraAtlasWebGpu } from '../biology/organismSdfMorphogenesisGpu.js';
import { createSurfaceEcosystemGpu } from '../biology/surfaceEcosystemGpu.js';

export const ULG_PLANETARY_SURFACE_SCHEMA = 'ulg.astrophysics.planetary-surface-vehicles-webgpu.v1';

const GPU_BUF = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  INDEX: 0x0010,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

export const PLANETARY_SURFACE_LAW_ADAPTER = Object.freeze({
  id: 'planetary-surface-vehicles',
  lawNodeId: 'law:astrophysics-planetary-surface-vehicles',
  orderConstraint: 'after:planetary-atmosphere-em',
  adapterMode: LAW_ADAPTER_MODES.SURFACE_INTERFACE,
  spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
  reads: Object.freeze(['planetary-body-state', 'planetary-atmo-em-grid', 'surface-vehicle-inputs']),
  writes: Object.freeze(['surface-terrain-mesh', 'surface-plume-particles', 'surface-vehicle-frames']),
  accumulates: Object.freeze(['surface-vehicle-telemetry']),
  pairedVolumeState: 'not-applicable',
  conservedQuantities: Object.freeze(['vehicle-momentum-plus-impulse', 'rocket-propellant-budget', 'ballistic-dust-mass']),
  validityDomain: Object.freeze({ minBodyRadiusM: 5e4, maxViewSpanM: 5e4 }),
  fallbackPolicy: LAW_FALLBACK_POLICIES.EXACT_SUBSTEP,
  scaleRangeM: Object.freeze([1e-1, 5e4]),
  fundamentalLaws: Object.freeze([
    'local-gravitational-acceleration',
    'rocker-bogie-contact-suspension',
    'tsiolkovsky-rocket-impulse',
    'actuator-disk-aerodynamic-lift',
    'quadratic-aerodynamic-drag'
  ])
});

export function evaluatePlanetarySurfaceActivation(physicalState = {}) {
  const activeFlag = Boolean(physicalState.surfaceViewActive);
  const spanM = Number(physicalState.viewSpanM) || 0;
  const rM = Number(physicalState.bodyRadiusM) || 0;
  const active = activeFlag || (rM >= 1e5 && spanM > 0 && spanM <= 2e4);
  return {
    active,
    aerodynamicFlightPossible: active && (Number(physicalState.surfacePressurePa) || 0) >= 200,
    reason: active ? 'planetary-surface-explorer-active' : 'orbital-or-deep-space-dormant'
  };
}

/**
 * Derive complete physical surface environment purely from general planetary physical parameters
 * (ZERO planet-name checks!).
 */
export function deriveSurfaceEnvironmentState(bodySpec = {}, {
  planetaryResult = null,
  planetaryAtmoState = null,
  planetaryMode = 'standard',
  landingSite = null,
  seed = 20261125
} = {}) {
  const G = 6.67430e-11;
  const M_SUN = 1.98847e30;
  const massKg = Math.max(1e9, (Number(bodySpec.massSolar) || 3.00349e-6) * M_SUN);
  const radiusM = Math.max(100, (Number(bodySpec.radiusKm) || 6371) * 1000);
  const computedG = (G * massKg) / (radiusM * radiusM);
  const gravityMS2 = Math.max(0.002, Math.min(35.0, Number(bodySpec.surfaceGravityMS2) || computedG));

  const atmo = planetaryAtmoState || deriveFluidElectrodynamicsState(bodySpec, planetaryResult);
  // Physical Fulton/Rogers rocky-to-gaseous envelope cliff (R > 16,000 km => deep fluid/gas giant, no solid landing crust!)
  const hasSolidCrust = radiusM < 1.6e7;
  const isMagmaOcean = planetaryMode === 'magma-ocean' || (Number(bodySpec.tempK) || 288) > 1200;
  const isCryoMoon = planetaryMode === 'cryo-plumes';
  const isRogue = planetaryMode === 'rogue';
  const isEyeball = planetaryMode === 'eyeball-locked';

  let pressurePa = Math.max(0, Number(atmo?.surfacePressurePa ?? bodySpec.surfacePressurePa) || 0);
  if (isMagmaOcean && pressurePa < 5e4) pressurePa = 1.8e5; // Outgassed steam/CO2 Hadean atmosphere
  if (isCryoMoon) pressurePa = 0.0; // Vacuum icy exosphere over cryovolcanic crust
  const baseTempK = Math.max(
    35,
    isMagmaOcean ? 1850 : (isRogue ? 75 : (Number(bodySpec.tempK) || 288))
  );
  // Apply chosen orbital landing-site latitude/biome temperature offset (polar ice cap vs arid plateau!)
  const tempK = Math.max(35, baseTempK + (Number(landingSite?.tempOffsetK) || 0));
  // Effective molar mass (kg/mol): H2/He gas giants (~0.0024), CO2 thin/super-greenhouse (~0.044), N2/O2 (~0.029)
  const molarMassKgPerMol = !hasSolidCrust
    ? 0.0024
    : (pressurePa > 2e6 || (pressurePa > 100 && pressurePa < 2e4) ? 0.044 : 0.029);
  const rhoAtmKgM3 = pressurePa > 1e-3
    ? (pressurePa * molarMassKgPerMol) / (8.31446 * tempK)
    : 0.0;

  const volatileFrac = Math.max(
    0,
    Number(atmo?.volatileMassFrac) || 0,
    Number(bodySpec.volatileMassFrac) || 0,
    Number(bodySpec.coalescedComposition?.volatileFrac) || 0
  );
  const dustFrac = Math.max(0, Number(atmo?.particulateMassFrac ?? bodySpec.particulateMassFrac) || 0);
  // First-principles surface solvent & xenobiology classification (7-solvent Bains 2024 + full clade web!)
  const xenobiology = deriveXenobiologyProfile({
    worldName: bodySpec.name || 'World',
    tempK,
    pressurePa,
    gravityMS2,
    rhoAtmKgM3,
    stellarTeffK: Number(bodySpec.hostStarTeffK) || 5778,
    volatileFrac,
    hasSolidCrust,
    isCryoMoon,
    isMagmaOcean,
    seed,
    civTechK: Number.isFinite(Number(bodySpec.civTechK)) ? Number(bodySpec.civTechK) : undefined
  });
  const tBoilWaterK = pressurePa >= 611
    ? Math.max(273.16, Math.min(647.1, 373.15 / Math.max(0.55, 1.0 - 0.07632 * Math.log(Math.max(1e-4, pressurePa / 101325)))))
    : 273.16;
  const hasLiquidWaterOcean = hasSolidCrust && !isMagmaOcean && !isCryoMoon && !isRogue
    && pressurePa >= 611 && tempK >= 255 && tempK <= tBoilWaterK && volatileFrac >= 0.012;
  // Surface exotic oceans ONLY when the solvent is actually liquid at surface (T, P) — NEVER spawn a surface ocean from elevated 50 km cloud-deck aerosols (e.g. 737 K Venus H2SO4)!
  const hasExoticOcean = hasSolidCrust && !isMagmaOcean && !isCryoMoon && !hasLiquidWaterOcean
    && !xenobiology.isCloudDeckHabitat
    && ((xenobiology.solvent === 'CH4' && tempK >= 82 && tempK <= 125)
      || (xenobiology.solvent === 'NH3' && tempK >= 190 && tempK <= 265)
      || (xenobiology.solvent === 'H2SO4' && tempK >= 283 && tempK <= 605));
  const hasLiquidOcean = hasLiquidWaterOcean || hasExoticOcean;
  const oceanRgb = xenobiology.oceanRgb || [0.04, 0.24, 0.46];
  const solventMeltTempK = xenobiology.solvent === 'CH4'
    ? 90.7
    : (xenobiology.solvent === 'NH3' ? 195.4 : (xenobiology.solvent === 'H2SO4' ? 283.5 : 273.15));

  // Coaxial rotorcraft drone (Ingenuity/Dragonfly class: m = 1.8 kg, dual 1.2m rotors, A_disk = 1.13 m^2)
  // Exact actuator-disk lift: T_max = 0.5 * rho_atm * A_disk * (C_T_eff * v_tip^2)
  // At Mars (rho = 0.0154 kg/m^3, v_tip = 240 m/s, C_T_eff = 0.0205): T_max ≈ 10.3 N > m*g (6.7 N)!
  // In vacuum (rho = 0): T_max === 0.0 N!
  const droneMassKg = 1.8;
  const rotorFactor = 0.5 * 1.13 * 0.0205 * (240 * 240); // ~667.2 N / (kg/m^3)
  const maxAeroLiftN = rhoAtmKgM3 * rotorFactor;
  const droneWeightN = droneMassKg * gravityMS2;
  const droneFlightCapable = maxAeroLiftN > droneWeightN * 1.05;
  const droneThrustToWeight = droneWeightN > 0 ? maxAeroLiftN / droneWeightN : 0;

  // Continuous physically-derived sky scattering & terrain palette (ZERO body-name checks!)
  const c0 = isMagmaOcean
    ? [0.24, 0.10, 0.07]
    : (isCryoMoon ? [0.76, 0.85, 0.94] : (bodySpec.color0 || [0.68, 0.44, 0.28]));
  const c1 = isMagmaOcean
    ? [1.0, 0.42, 0.08]
    : (isCryoMoon ? [0.42, 0.62, 0.82] : (bodySpec.color1 || [0.38, 0.28, 0.22]));

  // Optical sky thickness rises logarithmically from 0 (vacuum < 20 Pa) to 1 (thick atmosphere >= 1e5 Pa)
  const skyOpticalDepth = isRogue
    ? 0.08
    : Math.max(0, Math.min(1, Math.log10(Math.max(1, pressurePa) / 15.0) / 3.8));
  // Precipitation washes suspended mineral dust out of ocean-world atmospheres -> Rayleigh blue;
  // dry low-pressure desert worlds keep micron mineral dust aloft -> Mie butterscotch scattering!
  const dustTint = hasLiquidOcean
    ? Math.min(0.14, dustFrac * 0.22)
    : (pressurePa > 50 && pressurePa < 3e4 ? Math.min(1.0, 0.58 + dustFrac * 1.4) : Math.min(0.7, dustFrac * 0.8));
  const isDenseWarmHaze = !hasSolidCrust || pressurePa > 8e5 || (tempK < 130 && pressurePa > 5e4);
  let skyZenithRgb;
  let skyHorizonRgb;
  if (isMagmaOcean) {
    skyZenithRgb = [0.22, 0.07, 0.04];
    skyHorizonRgb = [0.78, 0.30, 0.10];
  } else if (skyOpticalDepth < 0.03) {
    skyZenithRgb = [0.004, 0.007, 0.016];
    skyHorizonRgb = [0.012, 0.018, 0.032];
  } else if (isDenseWarmHaze) {
    skyZenithRgb = [0.56 * c0[0] + 0.16, 0.48 * c0[1] + 0.12, 0.26 * c0[2] + 0.05];
    skyHorizonRgb = [0.92 * c0[0] + 0.10, 0.78 * c0[1] + 0.08, 0.42 * c0[2] + 0.05];
  } else {
    // Blend classic Rayleigh blue vs Mie suspended mineral dust sky!
    const rayZ = [0.07, 0.26, 0.72];
    const rayH = [0.46, 0.72, 0.98];
    const mieZ = [0.42, 0.22, 0.14];
    const mieH = [0.84, 0.56, 0.36];
    skyZenithRgb = [
      (rayZ[0] * (1 - dustTint) + mieZ[0] * dustTint) * skyOpticalDepth,
      (rayZ[1] * (1 - dustTint) + mieZ[1] * dustTint) * skyOpticalDepth,
      (rayZ[2] * (1 - dustTint) + mieZ[2] * dustTint) * skyOpticalDepth
    ];
    skyHorizonRgb = [
      (rayH[0] * (1 - dustTint) + mieH[0] * dustTint) * skyOpticalDepth,
      (rayH[1] * (1 - dustTint) + mieH[1] * dustTint) * skyOpticalDepth,
      (rayH[2] * (1 - dustTint) + mieH[2] * dustTint) * skyOpticalDepth
    ];
  }

  // Crater preservation factor: thin/airless worlds preserve sharp impact craters; dense/wet worlds erode them!
  const craterStrength = hasSolidCrust
    ? Math.max(0.08, Math.min(1.0, 1.0 - skyOpticalDepth * 0.78 - (hasLiquidOcean ? 0.20 : 0)))
    : 0.0;
  // Mountain/canyon-scale relief inversely proportional to gravity, modulated by chosen orbital landing biome!
  const ampScaleSite = Math.max(0.65, Math.min(1.6, Number(landingSite?.ampScale) || 1.0));
  const terrainAmpM = hasSolidCrust
    ? Math.max(24.0, Math.min(96.0, 42.0 * Math.pow(9.81 / gravityMS2, 0.32) * ampScaleSite))
    : 14.0;
  // Orbital-to-surface correspondence: landing on a blue ocean from space raises seaLevelM so you float over
  // rolling waves; landing on a continental mountain drops seaLevelM cleanly below local valleys!
  const seaLevelM = hasLiquidOcean
    ? (-6.0 + (Number(landingSite?.seaLevelOffsetM) || 0))
    : -999.0;
  // Wind speed derived from atmospheric pressure & insolation (zero in vacuum!)
  const baseWindMS = rhoAtmKgM3 > 1e-4
    ? Math.min(18.0, (2.2 + 9.5 * dustTint + 3.5 * skyOpticalDepth) * (isEyeball ? 1.4 : 1.0))
    : 0.0;

  const isMinorBody = Boolean(bodySpec.isMinorBody) || radiusM < 600e3;
  const isComet = Boolean(bodySpec.isComet);
  const isMetallicAsteroid = Boolean(bodySpec.isMetallicAsteroid);
  // Real micro-gravity for minor bodies clamped gently to >= 0.14 m/s^2 so Rover/boulders stay crisp & playable!
  const effectiveGravityMS2 = isMinorBody ? Math.max(0.14, Math.min(2.2, gravityMS2)) : gravityMS2;
  const tinyPlanetCurvatureRadiusM = isMinorBody
    ? Math.max(460.0, Math.min(1450.0, 460.0 + (radiusM / 500e3) * 990.0))
    : 2800.0;

  // Derive continuous surface crust & liquid-ocean PBR optical parameters from ULG's material layer!
  const solventKey = xenobiology?.solvent?.id || xenobiology?.solvent?.formula || (hasExoticOcean ? 'CH4' : 'H2O');
  const oceanIor = resolveSolventIor(solventKey);
  const comp = bodySpec.coalescedComposition || null;
  const surfacePbrOptics = bodySpec.pbrOptics || resolvePlanetarySurfacePbrOptics({
    surfZ: Number(bodySpec.surfZ) || 14,
    feFrac: Number(comp?.feFrac) || (isMetallicAsteroid ? 0.82 : (Number(bodySpec.surfZ) === 26 ? 0.42 : 0.18)),
    silicateFrac: Number(comp?.silicateFrac) || (isMetallicAsteroid ? 0.12 : 0.62),
    carbonFrac: Number(comp?.carbonFrac) || (Number(bodySpec.surfZ) === 6 ? 0.30 : 0.06),
    volatileFrac: Number(comp?.volatileFrac) || (isCryoMoon || isComet ? 0.65 : (hasLiquidOcean ? 0.18 : 0.02)),
    isMetallicAsteroid,
    isOceanic: hasLiquidOcean,
    isIcy: isCryoMoon || isComet || bodySpec.kind === 3,
    solvent: solventKey
  });

  return Object.freeze({
    schema: ULG_PLANETARY_SURFACE_SCHEMA,
    gravityMS2: effectiveGravityMS2,
    rawGravityMS2: gravityMS2,
    radiusM,
    massKg,
    hasSolidCrust,
    isMinorBody,
    isComet,
    isMetallicAsteroid,
    isMagmaOcean,
    isCryoMoon,
    isRogue,
    isEyeball,
    hasLiquidOcean,
    hasExoticOcean,
    oceanRgb: Object.freeze([oceanRgb[0], oceanRgb[1], oceanRgb[2]]),
    oceanIor,
    pbrOptics: surfacePbrOptics,
    solvent: xenobiology.solvent,
    solventMeltTempK,
    xenobiology,
    seaLevelM,
    pressurePa,
    tempK,
    molarMassKgPerMol,
    rhoAtmKgM3,
    skyOpticalDepth,
    skyZenithRgb: Object.freeze(skyZenithRgb),
    skyHorizonRgb: Object.freeze(skyHorizonRgb),
    dustTint,
    craterStrength: isMinorBody ? Math.max(0.75, craterStrength) : craterStrength,
    terrainAmpM: isMinorBody ? Math.max(26.0, Math.min(54.0, terrainAmpM * 0.62)) : terrainAmpM,
    baseWindMS,
    droneMassKg,
    maxAeroLiftN,
    droneWeightN,
    droneFlightCapable,
    droneThrustToWeight,
    color0: Object.freeze([
      landingSite?.isDesert ? Math.min(1, c0[0] * 1.15 + 0.16) : (landingSite?.isPolarIce ? 0.86 : c0[0]),
      landingSite?.isDesert ? Math.min(1, c0[1] * 0.96 + 0.08) : (landingSite?.isPolarIce ? 0.91 : c0[1]),
      landingSite?.isDesert ? Math.max(0.12, c0[2] * 0.65) : (landingSite?.isPolarIce ? 0.96 : c0[2])
    ]),
    color1: Object.freeze([c1[0], c1[1], c1[2]]),
    crustPrimaryRgb: Object.freeze([c0[0], c0[1], c0[2]]),
    crustSecondaryRgb: Object.freeze([c1[0], c1[1], c1[2]]),
    landingSite: landingSite || null,
    tinyPlanetCurvatureRadiusM,
    seed: (seed >>> 0) || 1,
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    scientificValidation: false
  });
}

// =========================================================================
// Exact Deterministic JS + WGSL Shared Planetary Surface Heightfield
// =========================================================================
// Exact Bit-Matched u32 Integer Hash (0.00000 m divergence between JS f64 & WebGPU f32!)
function smoothJs(t) { return t * t * (3 - 2 * t); }
function hash2Js(ix, iz, seedU) {
  const xi = Math.floor(ix) | 0;
  const zi = Math.floor(iz) | 0;
  const si = Math.round(seedU * 100) | 0;
  let h = (Math.imul(xi, 374761393) + Math.imul(zi, 668265263) + Math.imul(si, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h & 0xFFFFFF) / 16777216.0;
}
function vnoise2Js(x, z, seedF) {
  const ix = Math.floor(x); const iz = Math.floor(z);
  const fx = smoothJs(x - ix); const fz = smoothJs(z - iz);
  const a = hash2Js(ix, iz, seedF);
  const b = hash2Js(ix + 1, iz, seedF);
  const c = hash2Js(ix, iz + 1, seedF);
  const d = hash2Js(ix + 1, iz + 1, seedF);
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
}
function fbm2Js(x, z, seedF) {
  let sum = 0; let amp = 0.52; let fx = x; let fz = z;
  for (let i = 0; i < 4; i += 1) {
    sum += amp * (vnoise2Js(fx, fz, seedF) * 2 - 1);
    const nx = fx * 2.03 + 11.7;
    const nz = fz * 2.03 - 7.3;
    fx = nx; fz = nz;
    amp *= 0.48;
  }
  return sum;
}
function craterFieldJs(x, z, scale, seedF) {
  const sx = x * scale; const sz = z * scale;
  const cx = Math.floor(sx); const cz = Math.floor(sz);
  let best = 0;
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const gx = cx + dx; const gz = cz + dz;
      const h = hash2Js(gx, gz, seedF + 7.3);
      if (h < 0.56) continue;
      const ox = gx + 0.18 + 0.64 * hash2Js(gx, gz, seedF + 19.1);
      const oz = gz + 0.18 + 0.64 * hash2Js(gx, gz, seedF + 37.7);
      const rad = 0.22 + 0.28 * hash2Js(gx, gz, seedF + 53.3);
      const d = Math.hypot(sx - ox, sz - oz) / rad;
      if (d < 1.38) {
        if (d < 0.84) {
          // Parabolic crater bowl
          best += -0.42 * (1.0 - (d / 0.84) ** 2);
        } else {
          // Raised ejecta rim
          const rt = (d - 0.84) / 0.54;
          best += 0.19 * Math.sin(rt * Math.PI) * (1.0 - 0.35 * rt);
        }
      }
    }
  }
  return best;
}

function sampleSphCoarseHeight64Js(x, z, env) {
  const arr = env?.sphCoarseHeight64;
  if (!arr || arr.length < 4096) return 0;
  const span = Math.max(1000.0, Number(env.sphPatchSpanM) || 14000.0);
  const u = Math.max(0.0, Math.min(0.9999, (x / span) + 0.5));
  const v = Math.max(0.0, Math.min(0.9999, (z / span) + 0.5));
  const gx = u * 63.0;
  const gz = v * 63.0;
  const i0 = Math.floor(gx);
  const j0 = Math.floor(gz);
  const i1 = Math.min(63, i0 + 1);
  const j1 = Math.min(63, j0 + 1);
  const fx = gx - i0;
  const fz = gz - j0;
  const c00 = arr[j0 * 64 + i0];
  const c10 = arr[j0 * 64 + i1];
  const c01 = arr[j1 * 64 + i0];
  const c11 = arr[j1 * 64 + i1];
  return (c00 * (1 - fx) + c10 * fx) * (1 - fz) + (c01 * (1 - fx) + c11 * fx) * fz;
}

/**
 * Evaluate raw unclamped crust elevation (returns `< env.seaLevelM` underwater so
 * rover shoreline collision detects water boundaries accurately!).
 */
export function evaluatePlanetaryCrustElevation(x, z, env) {
  const seedF = ((env.seed % 997) * 0.13) + 1.7;
  if (!env.hasSolidCrust) {
    return fbm2Js(x * 0.0065, z * 0.0065, seedF) * env.terrainAmpM - 28.0;
  }
  const r0 = Math.hypot(x, z);
  if (env.hasSphGeology && env.sphCoarseHeight64) {
    // 100% Full-Authority GPU SPH Planetary Geology starting at r = 0 m — ZERO Perlin fbm2 hills!
    // Ocean worlds cross exact seaLevelM = 0.0 m right at the orbital SPH shoreline (`sphSeaLevelNorm`).
    const sphElev = sampleSphCoarseHeight64Js(x, z, env);
    const sphOrigin = sampleSphCoarseHeight64Js(0, 0, env);
    const refVal = env.hasLiquidOcean ? (Number(env.sphSeaLevelNorm) || 0.0) : sphOrigin;
    return (sphElev - refVal) * (env.terrainAmpM * 3.1);
  }
  const apron = Math.min(1.0, Math.max(0.0, (r0 - 18.0) / 52.0));
  const apronSmooth = apron * apron * (3 - 2 * apron);
  const rolling = fbm2Js(x * 0.0055, z * 0.0055, seedF) * env.terrainAmpM;
  const ridge = Math.abs(fbm2Js(x * 0.011 + 5.1, z * 0.011 - 3.4, seedF + 2.1)) * (env.terrainAmpM * 0.36);
  const detail = fbm2Js(x * 0.032, z * 0.032, seedF + 4.9) * (env.terrainAmpM * 0.08);
  const craters = env.craterStrength > 0.02
    ? (craterFieldJs(x, z, 0.0075, seedF) * env.terrainAmpM * 0.72
      + craterFieldJs(x, z, 0.024, seedF + 11.0) * env.terrainAmpM * 0.24) * env.craterStrength
    : 0.0;
  return (rolling + ridge * 0.45 + detail + craters) * (0.10 + 0.90 * apronSmooth);
}

/**
 * Evaluate exact terrain elevation (meters) at world `(x, z)` — bit-matched to the WGSL kernel!
 */
export function evaluatePlanetaryTerrainHeight(x, z, env) {
  const rawH = evaluatePlanetaryCrustElevation(x, z, env);
  if (env.hasSolidCrust && env.hasLiquidOcean && rawH < env.seaLevelM) {
    return env.seaLevelM;
  }
  return rawH;
}

/**
 * Exact barycentric height on the GPU-rendered terrain triangle mesh at `(x, z)`!
 * Because terrain grid snapping aligns vertices to exact integer multiples of `cellSizeM`
 * and triangulates each quad as `(0,0)-(0,1)-(1,0)` (u+v<=1) and `(1,0)-(0,1)-(1,1)` (u+v>1),
 * this matches the live rendered WebGPU surface triangles to floating-point precision!
 */
export function evaluateRenderedTerrainTriangleHeight(x, z, cellSizeM, env) {
  const cs = Math.max(0.25, Number(cellSizeM) || 2.2);
  const gx = Math.floor(x / cs);
  const gz = Math.floor(z / cs);
  const u = (x / cs) - gx;
  const v = (z / cs) - gz;
  const x0 = gx * cs; const x1 = (gx + 1) * cs;
  const z0 = gz * cs; const z1 = (gz + 1) * cs;
  const h00 = evaluatePlanetaryTerrainHeight(x0, z0, env);
  const h10 = evaluatePlanetaryTerrainHeight(x1, z0, env);
  const h01 = evaluatePlanetaryTerrainHeight(x0, z1, env);
  const h11 = evaluatePlanetaryTerrainHeight(x1, z1, env);
  if (u + v <= 1.0) {
    return h00 + u * (h10 - h00) + v * (h01 - h00);
  }
  return h11 + (1.0 - u) * (h01 - h11) + (1.0 - v) * (h10 - h11);
}

/**
 * Exact 6-Wheel Rocker-Bogie + Belly Multi-Contact Support Plane Solver!
 * Samples all 6 wheel footprints `(±1.22, -1.22 / 0 / +1.22)` + center `(0, 0)` on the exact
 * rendered GPU terrain triangles, fits the least-squares rocker-bogie normal, and returns
 * the exact minimum chassis root `supportY` guaranteeing ZERO wheel or belly penetration!
 */
export function resolveRoverMultiWheelSupport(x, z, yaw, cellSizeM, env, deformFn = null) {
  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  // Local basis in XZ: fwd = (sy, 0, cy), right = (cy, 0, -sy) (matches buildRoverAndDroneMeshFloats!)
  const wheelOffsets = [
    [-1.22, -1.22], [1.22, -1.22],
    [-1.22, 0.0],   [1.22, 0.0],
    [-1.22, 1.22],  [1.22, 1.22]
  ];
  let sumH = 0;
  let sumRxH = 0; let sumRx2 = 0;
  let sumRzH = 0; let sumRz2 = 0;
  let anyUnderwater = false;
  const samples = [];

  for (let k = 0; k < wheelOffsets.length; k += 1) {
    const [rx, rz] = wheelOffsets[k];
    const wx = x + cy * rx + sy * rz;
    const wz = z - sy * rx + cy * rz;
    const dOff = typeof deformFn === 'function' ? deformFn(wx, wz) : 0;
    const hTri = evaluateRenderedTerrainTriangleHeight(wx, wz, cellSizeM, env) + dOff;
    const hAna = evaluatePlanetaryTerrainHeight(wx, wz, env) + dOff;
    const hGround = Math.max(hTri, hAna);
    if (env.hasLiquidOcean && (evaluatePlanetaryCrustElevation(wx, wz, env) + dOff) < env.seaLevelM + 0.08) {
      anyUnderwater = true;
    }
    samples.push({ rx, rz, hGround });
    sumH += hGround;
    sumRxH += rx * hGround;
    sumRx2 += rx * rx;
    sumRzH += rz * hGround;
    sumRz2 += rz * rz;
  }
  const dCenter = typeof deformFn === 'function' ? deformFn(x, z) : 0;
  const hCenter = Math.max(
    evaluateRenderedTerrainTriangleHeight(x, z, cellSizeM, env) + dCenter,
    evaluatePlanetaryTerrainHeight(x, z, env) + dCenter
  );
  if (env.hasLiquidOcean && evaluatePlanetaryCrustElevation(x, z, env) < env.seaLevelM + 0.08) {
    anyUnderwater = true;
  }

  // Least-squares support plane h(rx, rz) = hMean + sx * rx + sz * rz (zero cross terms by symmetry!)
  const sx = sumRxH / Math.max(1e-6, sumRx2);
  const sz = sumRzH / Math.max(1e-6, sumRz2);
  // Convert local slopes (sx along right, sz along fwd) into world normal `up`
  const nx = -(cy * sx + sy * sz);
  const nz = -(-sy * sx + cy * sz);
  const nLen = Math.hypot(nx, 1.0, nz) || 1.0;
  const fitUp = [nx / nLen, 1.0 / nLen, nz / nLen];

  // Exact rover frame (fwd, right) derived from `fitUp` identically to `buildRoverAndDroneMeshFloats`:
  const dotFU = sy * fitUp[0] + cy * fitUp[2];
  const fwdRaw = [sy - fitUp[0] * dotFU, -fitUp[1] * dotFU, cy - fitUp[2] * dotFU];
  const fLen = Math.hypot(fwdRaw[0], fwdRaw[1], fwdRaw[2]) || 1.0;
  const fwdY = fwdRaw[1] / fLen;
  const rightRaw = [
    fitUp[1] * (fwdRaw[2] / fLen) - fitUp[2] * fwdY,
    fitUp[2] * (fwdRaw[0] / fLen) - fitUp[0] * (fwdRaw[2] / fLen),
    fitUp[0] * fwdY - fitUp[1] * (fwdRaw[0] / fLen)
  ];
  const rLen = Math.hypot(rightRaw[0], rightRaw[1], rightRaw[2]) || 1.0;
  const rightY = rightRaw[1] / rLen;

  // Guarantee EVERY wheel bottom (incl. 45-deg rotated tread corners: 0.34*(sqrt(2)-1)=0.141m)
  // AND center belly clear rendered GPU terrain triangles with zero visual clipping!
  let requiredY = hCenter + 0.16;
  for (let k = 0; k < samples.length; k += 1) {
    const s = samples[k];
    const reqK = s.hGround - (rightY * s.rx + fwdY * s.rz) + 0.16;
    if (reqK > requiredY) requiredY = reqK;
  }

  return {
    supportY: requiredY,
    centerGroundY: hCenter,
    normal: fitUp,
    anyUnderwater,
    maxSlopeSin: Math.sqrt(Math.max(0, 1.0 - fitUp[1] * fitUp[1]))
  };
}

export function evaluatePlanetaryTerrainNormal(x, z, env) {
  const eps = 0.65;
  const hL = evaluatePlanetaryTerrainHeight(x - eps, z, env);
  const hR = evaluatePlanetaryTerrainHeight(x + eps, z, env);
  const hD = evaluatePlanetaryTerrainHeight(x, z - eps, env);
  const hU = evaluatePlanetaryTerrainHeight(x, z + eps, env);
  const nx = hL - hR;
  const ny = 2.0 * eps;
  const nz = hD - hU;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

// =========================================================================
// First-Principles Local Spatial Surface & Atmospheric Material Sampler
// (ZERO planet-name hacks! Evaluates exact crust geology/hydrology/crater/magma
//  directly beneath (x, z) OR live 3D CFD atmospheric stratum at craft altitude!)
// =========================================================================
const ELEMENT_LOOKUP = Object.freeze({
  1: { Z: 1, sym: 'H', name: 'Hydrogen' },
  2: { Z: 2, sym: 'He', name: 'Helium' },
  6: { Z: 6, sym: 'C', name: 'Carbon' },
  7: { Z: 7, sym: 'N', name: 'Nitrogen' },
  8: { Z: 8, sym: 'O', name: 'Oxygen' },
  11: { Z: 11, sym: 'Na', name: 'Sodium' },
  12: { Z: 12, sym: 'Mg', name: 'Magnesium' },
  13: { Z: 13, sym: 'Al', name: 'Aluminum' },
  14: { Z: 14, sym: 'Si', name: 'Silicon' },
  16: { Z: 16, sym: 'S', name: 'Sulfur' },
  17: { Z: 17, sym: 'Cl', name: 'Chlorine' },
  18: { Z: 18, sym: 'Ar', name: 'Argon' },
  20: { Z: 20, sym: 'Ca', name: 'Calcium' },
  22: { Z: 22, sym: 'Ti', name: 'Titanium' },
  26: { Z: 26, sym: 'Fe', name: 'Iron' },
  28: { Z: 28, sym: 'Ni', name: 'Nickel' }
});

const ATMO_SPECIES_CHEMISTRY = Object.freeze({
  H2: { formula: 'H₂', name: 'Molecular Hydrogen', primaryZ: 1, moleculeKey: 'H2', elements: [1] },
  He: { formula: 'He', name: 'Helium', primaryZ: 2, moleculeKey: 'H2', elements: [2] },
  CH4: { formula: 'CH₄', name: 'Methane', primaryZ: 6, moleculeKey: 'CH4', elements: [6, 1] },
  H2O: { formula: 'H₂O', name: 'Water', primaryZ: 8, moleculeKey: 'H2O', elements: [8, 1] },
  NH3: { formula: 'NH₃', name: 'Ammonia', primaryZ: 7, moleculeKey: 'NH3', elements: [7, 1] },
  NH4SH: { formula: 'NH₄SH', name: 'Ammonium Hydrosulfide', primaryZ: 16, moleculeKey: 'NH3', elements: [7, 1, 16] },
  H2SO4: { formula: 'H₂SO₄', name: 'Sulfuric Acid', primaryZ: 16, moleculeKey: 'H2O', elements: [16, 8, 1] },
  CO2: { formula: 'CO₂', name: 'Carbon Dioxide', primaryZ: 6, moleculeKey: 'CO2', elements: [6, 8] },
  CO: { formula: 'CO', name: 'Carbon Monoxide', primaryZ: 6, moleculeKey: 'CO', elements: [6, 8] },
  N2: { formula: 'N₂', name: 'Molecular Nitrogen', primaryZ: 7, moleculeKey: 'N2', elements: [7] },
  O2: { formula: 'O₂', name: 'Molecular Oxygen', primaryZ: 8, moleculeKey: 'O2', elements: [8] },
  Ar: { formula: 'Ar', name: 'Argon', primaryZ: 18, moleculeKey: 'N2', elements: [18] },
  C2H6: { formula: 'C₂H₆', name: 'Ethane / Tholins', primaryZ: 6, moleculeKey: 'CH4', elements: [6, 1, 7] },
  MgSiO3: { formula: 'MgSiO₃', name: 'Enstatite Silicate', primaryZ: 14, moleculeKey: 'SiO2', elements: [12, 14, 8] },
  KCl: { formula: 'KCl', name: 'Potassium Chloride', primaryZ: 17, moleculeKey: 'H2O', elements: [17, 11] }
});

function buildElementList(zList) {
  const seen = new Set();
  const out = [];
  for (const z of zList) {
    if (seen.has(z) || !ELEMENT_LOOKUP[z]) continue;
    seen.add(z);
    out.push({ ...ELEMENT_LOOKUP[z] });
  }
  return out;
}

/**
 * Sample the exact local material directly below/around the Rover, Drone, or UFO
 * purely from local terrain geology, ocean/snow/magma/crater state, and 3D CFD
 * atmospheric chemistry (ZERO planet-name hacks!).
 */
export function sampleLocalPlanetaryMaterial(env, vehiclePos = [0, 0, 0], {
  activeVehicle = 'rover',
  cfdTelemetry = null,
  worldName = 'World'
} = {}) {
  const x = Number(vehiclePos?.[0]) || 0;
  const y = Number(vehiclePos?.[1]) || 0;
  const z = Number(vehiclePos?.[2]) || 0;
  const seedF = ((env.seed % 997) * 0.13) + 1.7;

  const groundH = env.hasSolidCrust ? evaluatePlanetaryTerrainHeight(x, z, env) : -999;
  const altAboveGround = env.hasSolidCrust ? Math.max(0, y - groundH) : Math.max(0, y);

  // Deep fluid giant OR high-altitude UFO sampling live atmospheric chemistry deck!
  const sampleAtmo = (!env.hasSolidCrust || (activeVehicle === 'ufo' && altAboveGround > 10.0))
    && Boolean(cfdTelemetry?.chemistry?.species?.length);
  if (sampleAtmo) {
    const chem = cfdTelemetry.chemistry;
    const activeDeck = (chem.activeCloudId && chem.activeCloudId !== 'none'
      ? chem.condensingDecks?.find((d) => d.id === chem.activeCloudId)
      : null)
      || (chem.condensingDecks?.length
        ? [...chem.condensingDecks].sort((a, b) => (b.density || 0) - (a.density || 0))[0]
        : null);
    const primarySpeciesId = activeDeck?.id || chem.species[0]?.id || 'H2';
    const primaryInfo = ATMO_SPECIES_CHEMISTRY[primarySpeciesId] || ATMO_SPECIES_CHEMISTRY.H2;
    const compounds = chem.species.slice(0, 5).map((sp) => {
      const info = ATMO_SPECIES_CHEMISTRY[sp.id] || {
        formula: sp.id, name: sp.name || sp.id, primaryZ: 8, moleculeKey: 'H2O', elements: [8, 1]
      };
      return {
        id: sp.id,
        formula: info.formula,
        name: info.name,
        moleFrac: sp.moleFrac,
        condensed: sp.condensedFrac > 1e-6,
        primaryZ: info.primaryZ,
        moleculeKey: info.moleculeKey,
        elements: info.elements
      };
    });
    const elZ = [];
    for (const c of compounds) elZ.push(...c.elements);
    const phasePreset = activeDeck
      ? (chem.tempK < 210 ? 'solid' : 'melt')
      : (chem.pressureBar > 12 ? 'melt' : 'vapor');
    return {
      id: `atmo-${primarySpeciesId.toLowerCase()}`,
      worldName,
      category: 'atmosphere-stratum',
      name: activeDeck ? `${activeDeck.name} (${primaryInfo.formula})` : `${chem.activeCloudDeck} (${primaryInfo.formula})`,
      shortLabel: activeDeck ? `${activeDeck.id} Cloud` : `${primaryInfo.formula} Stratum`,
      locationTag: `Alt ${chem.altKm.toFixed(1)} km · ${chem.pressureBar >= 0.1 ? `${chem.pressureBar.toFixed(2)} bar` : `${(chem.pressureBar * 101.3).toFixed(1)} kPa`}`,
      coords: [Number(x.toFixed(1)), Number(y.toFixed(1)), Number(z.toFixed(1))],
      phasePreset,
      tempK: Math.round(chem.tempK),
      pressureBar: chem.pressureBar,
      primaryZ: primaryInfo.primaryZ,
      formula: primaryInfo.formula,
      moleculeKey: primaryInfo.moleculeKey,
      compounds,
      elements: buildElementList(elZ),
      summary: `${chem.activeCloudDeck} sampled at ${chem.altKm.toFixed(1)} km (${Math.round(chem.tempK)} K, ${chem.pressureBar.toFixed(2)} bar)`
    };
  }

  // Solid-crust direct sub-vehicle geological & hydrological sampling (bit-matched to terrain shader!)
  const crustH = evaluatePlanetaryCrustElevation(x, z, env);
  const h = evaluatePlanetaryTerrainHeight(x, z, env);
  const norm = evaluatePlanetaryTerrainNormal(x, z, env);
  const slope = 1.0 - Math.max(0, Math.min(1, norm[1]));
  const hNorm = Math.max(0, Math.min(1, (h / Math.max(4.0, env.terrainAmpM)) * 0.5 + 0.5));
  const craterRaw = env.craterStrength > 0.02
    ? (craterFieldJs(x, z, 0.022, seedF) * 0.72 + craterFieldJs(x, z, 0.068, seedF + 11.0) * 0.28) * env.craterStrength
    : 0.0;
  const coords = [Number(x.toFixed(1)), Number(h.toFixed(1)), Number(z.toFixed(1))];
  const locStr = `(${x.toFixed(0)}m, ${z.toFixed(0)}m) · Elev ${h.toFixed(1)}m`;

  const mkSample = (spec) => ({
    ...spec,
    worldName,
    category: 'surface-sample',
    locationTag: locStr,
    coords,
    pressureBar: env.pressurePa / 101325.0,
    elements: buildElementList(spec.compounds.flatMap((c) => c.elements))
  });

  if (env.hasLiquidOcean && crustH <= env.seaLevelM + 0.08) {
    const solv = env.solvent || 'H2O';
    if (solv === 'CH4') {
      return mkSample({
        id: 'cryogenic-methane-sea',
        name: 'Cryogenic Liquid Methane Sea (CH₄ · C₂H₆)',
        shortLabel: 'Methane CH₄ Sea',
        phasePreset: 'melt',
        tempK: Math.round(env.tempK),
        primaryZ: 6,
        formula: 'CH₄',
        moleculeKey: 'CH4',
        xenoProfile: env.xenobiology,
        xenoUrl: env.xenobiology ? buildLifeLabXenobiologyUrl(env.xenobiology) : null,
        compounds: [
          { id: 'CH4', formula: 'CH₄', name: 'Liquid Methane', moleFrac: 0.78, primaryZ: 6, moleculeKey: 'CH4', elements: [6, 1] },
          { id: 'C2H6', formula: 'C₂H₆', name: 'Liquid Ethane', moleFrac: 0.16, primaryZ: 6, moleculeKey: 'CH4', elements: [6, 1] },
          { id: 'N2', formula: 'N₂ / HCN', name: 'Dissolved Azotosome Precursors', moleFrac: 0.06, primaryZ: 7, moleculeKey: 'N2', elements: [7, 6, 1] }
        ],
        summary: `Exotic cryogenic hydrocarbon sea (potential azotosome habitat) sampled at ${locStr}`
      });
    }
    if (solv === 'NH3') {
      return mkSample({
        id: 'liquid-ammonia-ocean',
        name: 'Liquid Ammonia-Water Ocean (NH₃ · H₂O)',
        shortLabel: 'Ammonia NH₃ Sea',
        phasePreset: 'melt',
        tempK: Math.round(env.tempK),
        primaryZ: 7,
        formula: 'NH₃',
        moleculeKey: 'NH3',
        xenoProfile: env.xenobiology,
        xenoUrl: env.xenobiology ? buildLifeLabXenobiologyUrl(env.xenobiology) : null,
        compounds: [
          { id: 'NH3', formula: 'NH₃', name: 'Liquid Ammonia', moleFrac: 0.72, primaryZ: 7, moleculeKey: 'NH3', elements: [7, 1] },
          { id: 'H2O', formula: 'H₂O', name: 'Eutectic Water-Ammonia', moleFrac: 0.24, primaryZ: 8, moleculeKey: 'H2O', elements: [8, 1] },
          { id: 'CH4', formula: 'CH₄', name: 'Dissolved Organics', moleFrac: 0.04, primaryZ: 6, moleculeKey: 'CH4', elements: [6, 1] }
        ],
        summary: `Cold polar ammonia-eutectic ocean sampled at ${locStr}`
      });
    }
    return mkSample({
      id: 'saline-ocean-water',
      name: 'Saline Liquid Ocean (H₂O · NaCl)',
      shortLabel: 'Ocean H₂O',
      phasePreset: 'melt',
      tempK: Math.round(Math.max(274, Math.min(340, env.tempK))),
      primaryZ: 8,
      formula: 'H₂O',
      moleculeKey: 'H2O',
      xenoProfile: env.xenobiology,
      xenoUrl: env.xenobiology ? buildLifeLabXenobiologyUrl(env.xenobiology) : null,
      compounds: [
        { id: 'H2O', formula: 'H₂O', name: 'Liquid Water', moleFrac: 0.965, primaryZ: 8, moleculeKey: 'H2O', elements: [8, 1] },
        { id: 'NaCl', formula: 'NaCl', name: 'Dissolved Halite Salt', moleFrac: 0.029, primaryZ: 11, moleculeKey: 'H2O', elements: [11, 17] },
        { id: 'CO2', formula: 'CO₂', name: 'Dissolved Carbonate', moleFrac: 0.006, primaryZ: 6, moleculeKey: 'CO2', elements: [6, 8] }
      ],
      summary: `Liquid volatile ocean sampled directly below craft at ${locStr}`
    });
  }

  if (env.isMagmaOcean) {
    const crack = 1.0 - smoothJs(Math.max(0, Math.min(1, (Math.abs(fbm2Js(x * 0.075, z * 0.075, seedF + 3.0)) - 0.12) / 0.30)));
    const lowLava = 1.0 - smoothJs(Math.max(0, Math.min(1, (hNorm - 0.08) / 0.24)));
    const isMolten = Math.max(crack * 0.9, lowLava) > 0.35;
    return mkSample({
      id: isMolten ? 'molten-silicate-magma' : 'quenched-basalt-crust',
      name: isMolten ? 'Molten Silicate Magma (Mg₂SiO₄ · FeO)' : 'Quenched Volcanic Basalt (SiO₂ · FeO)',
      shortLabel: isMolten ? 'Molten Magma' : 'Basalt Crust',
      phasePreset: isMolten ? 'melt' : 'solid',
      tempK: isMolten ? Math.round(Math.max(1750, env.tempK)) : Math.round(Math.max(920, env.tempK * 0.65)),
      primaryZ: isMolten ? 14 : 26,
      formula: isMolten ? 'Mg₂SiO₄' : 'SiO₂',
      moleculeKey: 'SiO2',
      compounds: [
        { id: 'SiO2', formula: 'SiO₂', name: 'Silica Melt', moleFrac: 0.52, primaryZ: 14, moleculeKey: 'SiO2', elements: [14, 8] },
        { id: 'MgSiO3', formula: 'Mg₂SiO₄', name: 'Forsterite Olivine', moleFrac: 0.28, primaryZ: 12, moleculeKey: 'SiO2', elements: [12, 14, 8] },
        { id: 'FeO', formula: 'FeO', name: 'Ferrous Oxide', moleFrac: 0.20, primaryZ: 26, moleculeKey: 'O2', elements: [26, 8] }
      ],
      summary: `${isMolten ? 'Incandescent molten fissure' : 'Solidified dark volcanic plate'} sampled at ${locStr}`
    });
  }

  if (env.isCryoMoon || (env.hasLiquidOcean && hNorm > 0.72) || (env.tempK < 155 && hNorm > 0.56)) {
    return mkSample({
      id: 'crystalline-water-ice',
      name: env.isCryoMoon ? 'Cryovolcanic Water-Ice Lithosphere (H₂O Ih)' : 'Alpine Glacial Ice & Frost (H₂O · CO₂)',
      shortLabel: 'Glacial H₂O Ice',
      phasePreset: 'solid',
      tempK: Math.round(Math.min(255, Math.max(70, env.tempK - (env.hasLiquidOcean ? 22 : 0)))),
      primaryZ: 8,
      formula: 'H₂O',
      moleculeKey: 'H2O',
      compounds: [
        { id: 'H2O', formula: 'H₂O', name: 'Hexagonal Water Ice (Ih)', moleFrac: 0.86, primaryZ: 8, moleculeKey: 'H2O', elements: [8, 1] },
        { id: 'CO2', formula: 'CO₂', name: 'Dry-Ice Clathrate', moleFrac: 0.09, primaryZ: 6, moleculeKey: 'CO2', elements: [6, 8] },
        { id: 'NH3', formula: 'NH₃', name: 'Ammonia Hydrate', moleFrac: 0.05, primaryZ: 7, moleculeKey: 'NH3', elements: [7, 1] }
      ],
      summary: `Crystalline ice terrain sampled at ${locStr}`
    });
  }

  if (env.hasLiquidOcean && h <= env.seaLevelM + 1.0) {
    return mkSample({
      id: 'coastal-quartz-sand',
      name: 'Coastal Quartz & Carbonate Sand (SiO₂ · CaCO₃)',
      shortLabel: 'Quartz Sand',
      phasePreset: 'solid',
      tempK: Math.round(env.tempK),
      primaryZ: 14,
      formula: 'SiO₂',
      moleculeKey: 'SiO2',
      compounds: [
        { id: 'SiO2', formula: 'SiO₂', name: 'Crystalline Quartz', moleFrac: 0.68, primaryZ: 14, moleculeKey: 'SiO2', elements: [14, 8] },
        { id: 'CaCO3', formula: 'CaCO₃', name: 'Biogenic Calcite', moleFrac: 0.24, primaryZ: 20, moleculeKey: 'CO2', elements: [20, 6, 8] },
        { id: 'H2O', formula: 'H₂O', name: 'Interstitial Brine', moleFrac: 0.08, primaryZ: 8, moleculeKey: 'H2O', elements: [8, 1] }
      ],
      summary: `Coastal sand & carbonate shoreline sampled at ${locStr}`
    });
  }

  if (craterRaw < -0.14) {
    return mkSample({
      id: 'impact-crater-breccia',
      name: 'Impact Crater Fe-Ni Breccia (Fe · Ni · SiO₂)',
      shortLabel: 'Crater Fe-Ni',
      phasePreset: 'solid',
      tempK: Math.round(env.tempK),
      primaryZ: 26,
      formula: 'Fe-Ni',
      moleculeKey: 'SiO2',
      compounds: [
        { id: 'FeNi', formula: 'Fe-Ni', name: 'Meteoritic Kamacite Alloy', moleFrac: 0.54, primaryZ: 26, moleculeKey: 'O2', elements: [26, 28] },
        { id: 'SiO2', formula: 'SiO₂', name: 'Shocked Stishovite Silica', moleFrac: 0.34, primaryZ: 14, moleculeKey: 'SiO2', elements: [14, 8] },
        { id: 'FeS', formula: 'FeS', name: 'Troilite Sulfide', moleFrac: 0.12, primaryZ: 16, moleculeKey: 'CO', elements: [26, 16] }
      ],
      summary: `Shocked impact-crater basin & metallic ejecta sampled at ${locStr}`
    });
  }

  if (slope > 0.22 || hNorm > 0.64) {
    return mkSample({
      id: 'exposed-basalt-ridge',
      name: 'Exposed Basalt & Olivine Ridge (SiO₂ · Mg₂SiO₄)',
      shortLabel: 'Basalt Ridge',
      phasePreset: 'solid',
      tempK: Math.round(env.tempK),
      primaryZ: 14,
      formula: 'SiO₂',
      moleculeKey: 'SiO2',
      compounds: [
        { id: 'SiO2', formula: 'SiO₂', name: 'Silicate Framework', moleFrac: 0.50, primaryZ: 14, moleculeKey: 'SiO2', elements: [14, 8] },
        { id: 'Mg2SiO4', formula: 'Mg₂SiO₄', name: 'Olivine Silicate', moleFrac: 0.26, primaryZ: 12, moleculeKey: 'SiO2', elements: [12, 14, 8] },
        { id: 'Al2O3', formula: 'Al₂O₃', name: 'Corundum / Plagioclase', moleFrac: 0.14, primaryZ: 13, moleculeKey: 'O2', elements: [13, 8] },
        { id: 'FeO', formula: 'FeO', name: 'Iron Oxide', moleFrac: 0.10, primaryZ: 26, moleculeKey: 'O2', elements: [26, 8] }
      ],
      summary: `Steep bedrock outcrop & silicate ridge sampled at ${locStr}`
    });
  }

  if (env.hasLiquidOcean) {
    const xeno = env.xenobiology;
    const isAlien = Boolean(xeno && (xeno.solvent !== 'H2O' || xeno.biosphereViability >= 0.25));
    const domFlora = xeno?.species?.find((s) => s.kingdom === 'flora')?.speciesName || xeno?.floraMorphology || `${xeno?.solvent || 'H₂O'} Photosynthetic Flora`;
    const memLabel = xeno?.membraneType || xeno?.membraneClass || 'Organic Biopolymer / Amphiphile';
    const metabLabel = xeno?.redoxSummary || xeno?.metabolism || xeno?.biosignatureGas || 'Chemo-Phototrophic Metabolism';
    return mkSample({
      id: isAlien ? 'alien-biosphere-flora' : 'verdant-organic-loam',
      name: xeno?.biosphereViability >= 0.25
        ? `${domFlora} (${xeno.solventLabel || xeno.solvent} Biosphere)`
        : 'Organic Humus & Silicate Loam (CH₄ · SiO₂ · H₂O)',
      shortLabel: xeno?.biosphereViability >= 0.25 ? `${xeno.solvent} Flora` : 'Organic Loam',
      phasePreset: 'solid',
      tempK: Math.round(env.tempK),
      primaryZ: 6,
      formula: xeno?.solvent === 'CH4' ? 'C-H-N' : 'C-H-O',
      moleculeKey: 'CH4',
      xenoProfile: xeno,
      xenoUrl: xeno ? buildLifeLabXenobiologyUrl(xeno) : null,
      compounds: [
        { id: 'CH4', formula: xeno?.solvent === 'CH4' ? 'C₂H₃N (Azotosome)' : 'C₆H₁₀O₅', name: memLabel, moleFrac: 0.42, primaryZ: 6, moleculeKey: 'CH4', elements: [6, 1, 8] },
        { id: 'SiO2', formula: 'SiO₂', name: 'Clay & Quartz Soil', moleFrac: 0.36, primaryZ: 14, moleculeKey: 'SiO2', elements: [14, 8] },
        { id: 'H2O', formula: xeno?.solventLabel || xeno?.solvent || 'H₂O', name: 'Solvent Pore Fluid', moleFrac: 0.14, primaryZ: 8, moleculeKey: 'H2O', elements: [8, 1] },
        { id: 'NH3', formula: 'NO₃⁻/NH₃', name: 'Fixed Nitrogen', moleFrac: 0.08, primaryZ: 7, moleculeKey: 'NH3', elements: [7, 1, 8] }
      ],
      summary: xeno
        ? `${domFlora} · ${metabLabel} · ${xeno.civStage || 'Pre-Technological'} sampled at ${locStr}`
        : `Temperate organic-bearing lowland soil sampled at ${locStr}`
    });
  }

  if (env.tempK < 135 && env.pressurePa > 3e4) {
    return mkSample({
      id: 'cryogenic-tholin-regolith',
      name: 'Cryogenic Tholin & Methane Ice (C₂H₆ · CH₄ · H₂O)',
      shortLabel: 'Tholin / CH₄',
      phasePreset: 'solid',
      tempK: Math.round(env.tempK),
      primaryZ: 6,
      formula: 'CH₄/C₂H₆',
      moleculeKey: 'CH4',
      compounds: [
        { id: 'CH4', formula: 'CH₄', name: 'Hydrocarbon Clathrate', moleFrac: 0.48, primaryZ: 6, moleculeKey: 'CH4', elements: [6, 1] },
        { id: 'H2O', formula: 'H₂O', name: 'Bedrock Water-Ice Cobbles', moleFrac: 0.34, primaryZ: 8, moleculeKey: 'H2O', elements: [8, 1] },
        { id: 'N2', formula: 'N₂ / HCN', name: 'Photochemical Tholins', moleFrac: 0.18, primaryZ: 7, moleculeKey: 'N2', elements: [7, 6, 1] }
      ],
      summary: `Dense cryogenic haze-deposited hydrocarbon dunes sampled at ${locStr}`
    });
  }

  if (env.dustTint > 0.45 && env.pressurePa > 20) {
    return mkSample({
      id: 'ferric-oxide-regolith',
      name: 'Ferric Oxide & Basalt Dust (Fe₂O₃ · SiO₂ · CO₂)',
      shortLabel: 'Ferric Fe₂O₃',
      phasePreset: 'solid',
      tempK: Math.round(env.tempK),
      primaryZ: 26,
      formula: 'Fe₂O₃',
      moleculeKey: 'CO2',
      compounds: [
        { id: 'Fe2O3', formula: 'Fe₂O₃', name: 'Hematite Iron Oxide Dust', moleFrac: 0.46, primaryZ: 26, moleculeKey: 'O2', elements: [26, 8] },
        { id: 'SiO2', formula: 'SiO₂', name: 'Basaltic Plagioclase', moleFrac: 0.40, primaryZ: 14, moleculeKey: 'SiO2', elements: [14, 8] },
        { id: 'CO2', formula: 'CO₂', name: 'Adsorbed Carbon Dioxide', moleFrac: 0.14, primaryZ: 6, moleculeKey: 'CO2', elements: [6, 8] }
      ],
      summary: `Oxidized iron-rich desert regolith sampled at ${locStr}`
    });
  }

  return mkSample({
    id: 'anorthosite-silicate-regolith',
    name: 'Anorthosite & Ilmenite Regolith (SiO₂ · Al₂O₃ · FeTiO₃)',
    shortLabel: 'Silicate Regolith',
    phasePreset: 'solid',
    tempK: Math.round(env.tempK),
    primaryZ: 14,
    formula: 'SiO₂',
    moleculeKey: 'SiO2',
    compounds: [
      { id: 'SiO2', formula: 'SiO₂', name: 'Silicate Feldspar', moleFrac: 0.48, primaryZ: 14, moleculeKey: 'SiO2', elements: [14, 8] },
      { id: 'Al2O3', formula: 'Al₂O₃', name: 'Anorthosite Alumina', moleFrac: 0.28, primaryZ: 13, moleculeKey: 'O2', elements: [13, 8] },
      { id: 'FeTiO3', formula: 'FeTiO₃', name: 'Ilmenite Ore', moleFrac: 0.24, primaryZ: 22, moleculeKey: 'O2', elements: [26, 22, 8] }
    ],
    summary: `Unweathered silicate regolith sampled at ${locStr}`
  });
}

// =========================================================================
// WebGPU Compute Kernels: 129x129 Dynamic Terrain Mesh + 2,048 Plume Particles
// =========================================================================
export const planetarySurfaceWgsl = /* wgsl */ `
struct SurfaceParams {
  grid_n: u32,           // 129
  particle_count: u32,   // 2048
  mode_flags: u32,       // bit0=solidCrust, bit1=magmaOcean, bit2=cryoMoon, bit3=liquidOcean
  step_index: u32,
  center_x: f32,
  center_z: f32,
  cell_size: f32,
  seed_f: f32,
  terrain_amp: f32,
  crater_str: f32,
  sea_level: f32,
  curv_inv_2r: f32,      // 1 / (2 * R_tiny_planet)
  gravity_g: f32,
  rho_atm: f32,
  wind_x: f32,
  wind_z: f32,
  dt: f32,
  rocket_on: f32,        // 0..1 rover jump-rocket throttle
  rover_speed: f32,
  drone_throttle: f32,   // 0..1 drone rotor downwash
  rover_pos_y: vec4<f32>,// xyz = rover pos, w = rover yaw
  drone_pos_a: vec4<f32>,// xyz = drone pos, w = drone aero_lift_norm
  col0_pad: vec4<f32>,   // rgb = primary crust albedo, w = focus_x
  col1_pad: vec4<f32>,   // rgb = secondary highland/lava albedo, w = focus_z
  ocean_rgb_ice: vec4<f32>, // rgb = active solvent ocean albedo, w = seaIceCoverFrac [0..1]
  climate_aux: vec4<f32>,   // x = snowlineM, y = outerCellSizeM, z = tectWorldSpanM, w = outerCenterX
  clip_aux: vec4<f32>,      // x = outerCenterZ, y = tectAmpScale, z = oceanPatchHalfM, w = autumnShift
};

// 48-byte mesh vertex matching SURFACE_MESH_WGSL:
//   pos_curv:  vec4(x, y, z, rawHeight)
//   norm_tag:  vec4(nx, ny, nz, biomeTag)   tag: 0=rock/regolith, 1=highland/ice, 2=liquid_ocean, 3=magma_crack
//   col_emiss: vec4(r, g, b, emissiveOrFoam)
struct TerrainVert {
  pos_curv: vec4<f32>,
  norm_tag: vec4<f32>,
  col_emiss: vec4<f32>,
};

// 64-byte plume particle matching PARTICLE_CLOUD_WGSL Mode 11:
//   pos_role: vec4(x, y, z, role)   0=rocket_flame, 1=regolith_dust, 2=drone_downwash_or_wind_mote
//   vel_age:  vec4(vx, vy, vz, age)
//   col_life: vec4(r, g, b, maxLife)
//   meta0:    vec4(size, temp, seed, live)
struct PlumeParticle {
  pos_role: vec4<f32>,
  vel_age: vec4<f32>,
  col_life: vec4<f32>,
  meta0: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: SurfaceParams;
@group(0) @binding(1) var<storage, read_write> terrain_verts: array<TerrainVert>;
@group(0) @binding(2) var<storage, read_write> plumes: array<PlumeParticle>;
@group(0) @binding(3) var<storage, read_write> telemetry: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> deform_field: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> ocean_field: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> tectonic_field: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

fn hash2(ix: f32, iz: f32, s: f32) -> f32 {
  let xi = bitcast<u32>(i32(floor(ix)));
  let zi = bitcast<u32>(i32(floor(iz)));
  let si = bitcast<u32>(i32(round(s * 100.0)));
  var h = xi * 374761393u + zi * 668265263u + si * 1442695041u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return f32(h & 0xFFFFFFu) * (1.0 / 16777216.0);
}

fn vnoise2(x: f32, z: f32, s: f32) -> f32 {
  let ix = floor(x);
  let iz = floor(z);
  let fx = x - ix;
  let fz = z - iz;
  let ux = fx * fx * (3.0 - 2.0 * fx);
  let uz = fz * fz * (3.0 - 2.0 * fz);
  let a = hash2(ix, iz, s);
  let b = hash2(ix + 1.0, iz, s);
  let c = hash2(ix, iz + 1.0, s);
  let d = hash2(ix + 1.0, iz + 1.0, s);
  return mix(mix(a, b, ux), mix(c, d, ux), uz);
}

fn fbm2(x_in: f32, z_in: f32, s: f32) -> f32 {
  var sum = 0.0;
  var amp = 0.52;
  var fx = x_in;
  var fz = z_in;
  for (var i = 0u; i < 4u; i = i + 1u) {
    sum = sum + amp * (vnoise2(fx, fz, s) * 2.0 - 1.0);
    fx = fx * 2.03 + 11.7;
    fz = fz * 2.03 - 7.3;
    amp = amp * 0.48;
  }
  return sum;
}

fn crater_field(x: f32, z: f32, scale: f32, s: f32) -> f32 {
  let sx = x * scale;
  let sz = z * scale;
  let cx = floor(sx);
  let cz = floor(sz);
  var best = 0.0;
  for (var dz = -1; dz <= 1; dz = dz + 1) {
    for (var dx = -1; dx <= 1; dx = dx + 1) {
      let gx = cx + f32(dx);
      let gz = cz + f32(dz);
      let h = hash2(gx, gz, s + 7.3);
      if (h < 0.56) { continue; }
      let ox = gx + 0.18 + 0.64 * hash2(gx, gz, s + 19.1);
      let oz = gz + 0.18 + 0.64 * hash2(gx, gz, s + 37.7);
      let rad = 0.22 + 0.28 * hash2(gx, gz, s + 53.3);
      let d = length(vec2<f32>(sx - ox, sz - oz)) / rad;
      if (d < 1.38) {
        if (d < 0.84) {
          let q = d / 0.84;
          best = best - 0.42 * (1.0 - q * q);
        } else {
          let rt = (d - 0.84) / 0.54;
          best = best + 0.19 * sin(rt * 3.14159265) * (1.0 - 0.35 * rt);
        }
      }
    }
  }
  return best;
}

fn sample_deform_field(x: f32, z: f32) -> vec4<f32> {
  let half_m = 384.0;
  if (abs(x) >= half_m || abs(z) >= half_m) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  let edge_fade = (1.0 - smoothstep(half_m - 16.0, half_m, abs(x))) * (1.0 - smoothstep(half_m - 16.0, half_m, abs(z)));
  let u = clamp((x / half_m) * 0.5 + 0.5, 0.0, 0.9999);
  let v = clamp((z / half_m) * 0.5 + 0.5, 0.0, 0.9999);
  let gf = vec2<f32>(u * 127.0, v * 127.0);
  let i0 = vec2<u32>(u32(floor(gf.x)), u32(floor(gf.y)));
  let i1 = vec2<u32>(min(127u, i0.x + 1u), min(127u, i0.y + 1u));
  let f = fract(gf);
  let c00 = deform_field[i0.y * 128u + i0.x];
  let c10 = deform_field[i0.y * 128u + i1.x];
  let c01 = deform_field[i1.y * 128u + i0.x];
  let c11 = deform_field[i1.y * 128u + i1.x];
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y) * edge_fade;
}

fn sample_tectonic_field(x: f32, z: f32) -> vec4<f32> {
  let span = max(1000.0, params.climate_aux.z);
  let u_raw = (x / span) + 0.5;
  let v_raw = (z / span) + 0.5;
  // Seamless C^0 mirror-reflected continuation beyond the +-1.4 km core SPH patch so 94.7% of the
  // +-6 km horizon renders natural rolling coastlines & mountains instead of hard-clamped cardinal ramp walls!
  let u = clamp(1.0 - abs(fract(u_raw * 0.5) * 2.0 - 1.0), 0.0, 0.9999);
  let v = clamp(1.0 - abs(fract(v_raw * 0.5) * 2.0 - 1.0), 0.0, 0.9999);
  let gf = vec2<f32>(u * 255.0, v * 255.0);
  let i0 = vec2<u32>(u32(floor(gf.x)), u32(floor(gf.y)));
  let i1 = vec2<u32>(min(255u, i0.x + 1u), min(255u, i0.y + 1u));
  let f = fract(gf);
  let c00 = tectonic_field[i0.y * 256u + i0.x];
  let c10 = tectonic_field[i0.y * 256u + i1.x];
  let c01 = tectonic_field[i1.y * 256u + i0.x];
  let c11 = tectonic_field[i1.y * 256u + i1.x];
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}

fn sample_ocean_field(x: f32, z: f32) -> vec4<f32> {
  let span = max(64.0, params.clip_aux.z * 2.0);
  let u = fract(x / span);
  let v = fract(z / span);
  let gf = vec2<f32>(u * 128.0, v * 128.0);
  let i0 = vec2<u32>(u32(floor(gf.x)) & 127u, u32(floor(gf.y)) & 127u);
  let i1 = vec2<u32>((i0.x + 1u) & 127u, (i0.y + 1u) & 127u);
  let f = fract(gf);
  let c00 = ocean_field[i0.y * 128u + i0.x];
  let c10 = ocean_field[i0.y * 128u + i1.x];
  let c01 = ocean_field[i1.y * 128u + i0.x];
  let c11 = ocean_field[i1.y * 128u + i1.x];
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}

fn eval_crust_height(x: f32, z: f32) -> f32 {
  let is_solid = (params.mode_flags & 1u) != 0u;
  if (!is_solid) {
    // Opaque deep swirling gas-giant ammonia/water cloud deck anchored cleanly beneath the saucer!
    return fbm2(x * 0.0065, z * 0.0065, params.seed_f) * params.terrain_amp + params.sea_level;
  }
  let r0 = length(vec2<f32>(x, z));
  let has_sph = (params.mode_flags & 32u) != 0u;
  let def = sample_deform_field(x, z);
  if (has_sph) {
    // 100% FULL-AUTHORITY GPU SPH PLANETARY GEOLOGY STARTING AT r = 0 m (ZERO Perlin fbm2 hills!)
    // Direct cropped & D8-hydraulically-eroded patch from the planet's live 3D SPH Genesis buffer:
    // Ocean worlds cross exact sea_level (0.0 m) at the EXACT orbital SPH shoreline (clip_aux.y).
    let tect = sample_tectonic_field(x, z);
    let tect0 = sample_tectonic_field(0.0, 0.0);
    let has_ocean = (params.mode_flags & 8u) != 0u;
    let ref_val = select(tect0.x, params.clip_aux.y, has_ocean);
    let sph_h = (tect.x - ref_val) * (params.terrain_amp * 3.1);
    return sph_h + def.x;
  }
  let a = clamp((r0 - 18.0) / 52.0, 0.0, 1.0);
  let apron = a * a * (3.0 - 2.0 * a);
  let rolling = fbm2(x * 0.0055, z * 0.0055, params.seed_f) * params.terrain_amp;
  let ridge = abs(fbm2(x * 0.011 + 5.1, z * 0.011 - 3.4, params.seed_f + 2.1)) * (params.terrain_amp * 0.36);
  let detail = fbm2(x * 0.032, z * 0.032, params.seed_f + 4.9) * (params.terrain_amp * 0.08);
  var craters = 0.0;
  if (params.crater_str > 0.02) {
    craters = (crater_field(x, z, 0.0075, params.seed_f) * params.terrain_amp * 0.72
      + crater_field(x, z, 0.024, params.seed_f + 11.0) * params.terrain_amp * 0.24) * params.crater_str;
  }
  let tect_blend = smoothstep(240.0, 560.0, r0);
  let tect = sample_tectonic_field(x, z);
  let tect_h = tect.x * (params.terrain_amp * params.clip_aux.y) * tect_blend;
  return (rolling + ridge * 0.45 + detail + craters + tect_h) * (0.10 + 0.90 * apron) + def.x;
}

fn eval_height(x: f32, z: f32) -> f32 {
  let raw_h = eval_crust_height(x, z);
  let has_ocean = (params.mode_flags & 8u) != 0u;
  if (has_ocean && raw_h < params.sea_level) {
    return params.sea_level;
  }
  return raw_h;
}

// Kernel 1: Generate 2-Ring +-6 km Planetary GPU Clipmap Mesh (gid.z=0 inner +-608m, gid.z=1 outer +-6km!)
@compute @workgroup_size(8, 8, 1)
fn generate_surface_terrain_mesh(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.grid_n;
  if (gid.x >= n || gid.y >= n || gid.z >= 2u) { return; }
  let is_outer = gid.z == 1u;
  let half = f32(n - 1u) * 0.5;
  let cs = select(params.cell_size, params.climate_aux.y, is_outer);
  let cx = select(params.center_x, params.climate_aux.w, is_outer);
  let cz = select(params.center_z, params.clip_aux.x, is_outer);
  let wx = cx + (f32(gid.x) - half) * cs;
  let wz = cz + (f32(gid.y) - half) * cs;

  let crust_h = eval_crust_height(wx, wz);
  let is_solid = (params.mode_flags & 1u) != 0u;
  let is_magma = (params.mode_flags & 2u) != 0u;
  let is_cryo = (params.mode_flags & 4u) != 0u;
  let has_ocean = (params.mode_flags & 8u) != 0u;
  let ice_cover = clamp(params.ocean_rgb_ice.w, 0.0, 1.0);
  let is_ocean = is_solid && has_ocean && crust_h <= params.sea_level + 0.04;

  var h = select(crust_h, params.sea_level, is_ocean);
  let eps = max(0.5, cs * 0.45);
  let hL = eval_height(wx - eps, wz);
  let hR = eval_height(wx + eps, wz);
  let hD = eval_height(wx, wz - eps);
  let hU = eval_height(wx, wz + eps);
  var n_vec = normalize(vec3<f32>(hL - hR, 2.0 * eps, hD - hU));

  var wave_foam = 0.0;
  let inner_half_m = f32(n - 1u) * 0.5 * params.cell_size;
  if (is_ocean && ice_cover < 0.96) {
    let ow = sample_ocean_field(wx, wz);
    // Fade vertex ocean wave displacement cleanly before inner clipmap border (eliminates 95 m outer-ring Nyquist aliasing!)
    let wave_fade = 1.0 - smoothstep(inner_half_m * 0.52, inner_half_m * 0.92, length(vec2<f32>(wx - params.col0_pad.w, wz - params.col1_pad.w)));
    let wave_amp = (1.0 - ice_cover) * wave_fade;
    h = h + ow.x * wave_amp * 0.85;
    n_vec = normalize(vec3<f32>(-ow.y * wave_amp * 2.2, 1.0, -ow.z * wave_amp * 2.2));
    wave_foam = ow.w * wave_amp;
  }

  // Parametric clipmap overlap collar derived directly from actual inner_half_m (eliminates +-380 m mobile sky trench crack!)
  let dx = wx - params.col0_pad.w;
  let dz = wz - params.col1_pad.w;
  let r2 = dx * dx + dz * dz;
  let max_inner_d = max(abs(wx - params.center_x), abs(wz - params.center_z));
  let collar_lim = max(80.0, inner_half_m - params.cell_size * 2.5);
  let collar_drop = select(0.0, 1.4 * (1.0 - smoothstep(collar_lim - params.cell_size * 3.0, collar_lim, max_inner_d)), is_outer);
  let y_curved = h - r2 * params.curv_inv_2r - collar_drop;

  let tect = sample_tectonic_field(wx, wz);
  let has_sph = (params.mode_flags & 32u) != 0u;
  let slope = 1.0 - clamp(n_vec.y, 0.0, 1.0);
  let h_norm = clamp((h / max(4.0, params.terrain_amp)) * 0.5 + 0.5, 0.0, 1.0);
  let strata = 0.5 + 0.5 * sin(h * 1.4 + fbm2(wx * 0.08, wz * 0.08, params.seed_f + 9.0) * 3.0);

  // When live SPH geology is active, color directly from the 4 real SPH channels:
  //   elevation (beach -> lush lowland -> alpine granite rock), narrow carved rivers (tect.y),
  //   hydraulic moisture (tect.z), and felsic granite/ejecta crust composition (tect.w)!
  // Note: on ocean worlds, params.col1_pad is deep ocean blue — blend land slopes toward real granite/sandstone instead!
  let land_rock_col = select(params.col1_pad.rgb, vec3<f32>(0.42, 0.38, 0.32), has_ocean);
  let sph_rock_bias = select(0.0, select(tect.w * 0.30, (1.0 - tect.z) * 0.20 - tect.z * 0.28, has_ocean), has_sph);
  var col = mix(params.col0_pad.rgb, land_rock_col, clamp(h_norm * 0.34 + slope * 1.45 + strata * 0.08 + sph_rock_bias, 0.0, 1.0));
  if (has_sph && is_solid && !is_ocean && has_ocean && !is_magma && !is_cryo) {
    // Crisp golden shoreline beach strip right at water's edge (0..1.4 m) so green SPH hills rise cleanly behind!
    let beach_w = (1.0 - smoothstep(0.0, 1.40, h - params.sea_level)) * (1.0 - smoothstep(0.22, 0.55, slope));
    col = mix(col, vec3<f32>(0.76, 0.68, 0.48), beach_w * 0.72);
    // Narrow hydraulically carved SPH river channels ONLY in concentrated valleys (never flooding whole hillsides!)
    let riv_w = smoothstep(0.68, 0.92, tect.y) * (1.0 - smoothstep(0.10, 0.28, slope)) * (1.0 - smoothstep(4.0, 26.0, h - params.sea_level));
    col = mix(col, params.ocean_rgb_ice.rgb * 1.18, riv_w * 0.82);
  }
  var emiss = 0.0;
  var tag = 0.0;
  if (has_sph && is_solid && !is_ocean && !has_ocean && !is_magma && !is_cryo) {
    // Dry/cratered/tectonic worlds: highlight SPH crater ejecta rims (tect.w) & volcanic rift warmth (tect.z)
    let ejecta_bright = smoothstep(0.55, 0.95, tect.w) * 0.22;
    col = clamp(col + vec3<f32>(ejecta_bright * 0.95, ejecta_bright * 0.90, ejecta_bright * 0.82), vec3<f32>(0.02), vec3<f32>(0.98));
    if (tect.z > 0.72) {
      let rift = smoothstep(0.72, 0.96, tect.z);
      col = mix(col, vec3<f32>(0.96, 0.36, 0.10), rift * 0.48);
      emiss = max(emiss, rift * 0.55);
    }
    // Seasonal CO2 / water-ice frost deposition on cold ridges & winter craters of atmosphere-bearing dry worlds (e.g. Mars!)
    if (params.rho_atm > 0.002) {
      let dry_frost = smoothstep(params.climate_aux.x - 4.0, params.climate_aux.x + 12.0, h) * (1.0 - smoothstep(0.35, 0.75, slope));
      col = mix(col, vec3<f32>(0.90, 0.93, 0.97), dry_frost * 0.78);
      if (dry_frost > 0.45) { tag = 1.0; }
    }
  }

  if (!is_solid) {
    // Gas giant cloud bands
    let band = 0.5 + 0.5 * sin(wz * 0.04 + fbm2(wx * 0.02, wz * 0.02, params.seed_f) * 3.5);
    col = mix(params.col0_pad.rgb, params.col1_pad.rgb, band);
    tag = 1.0;
  } else if (is_ocean) {
    if (ice_cover >= 0.72) {
      // Frozen winter sea ice: bright pale-cyan pressure ridges, Rover-drivable!
      let ridge_n = fbm2(wx * 0.05, wz * 0.05, params.seed_f + 13.0);
      col = mix(vec3<f32>(0.76, 0.88, 0.96), vec3<f32>(0.92, 0.96, 1.0), clamp(0.5 + 0.5 * ridge_n, 0.0, 1.0));
      tag = 1.0;
    } else {
      // Active solvent liquid ocean (H2O sapphire, CH4 hydrocarbon amber-teal, NH3 deep indigo, etc.)
      let shallow = 1.0 - smoothstep(0.0, 4.5, params.sea_level - crust_h);
      col = mix(params.ocean_rgb_ice.rgb, params.ocean_rgb_ice.rgb * 1.65 + vec3<f32>(0.04, 0.16, 0.14), shallow * 0.55);
      col = mix(col, vec3<f32>(0.84, 0.93, 0.98), ice_cover * 0.65);
      emiss = wave_foam;
      tag = 2.0;
    }
  } else if (is_magma) {
    let crack = 1.0 - smoothstep(0.12, 0.42, abs(fbm2(wx * 0.075, wz * 0.075, params.seed_f + 3.0)));
    let low_lava = 1.0 - smoothstep(0.08, 0.32, h_norm);
    let lava_w = clamp(max(crack * 0.9, low_lava), 0.0, 1.0);
    col = mix(vec3<f32>(0.10, 0.07, 0.06), vec3<f32>(1.0, 0.36, 0.06), lava_w);
    emiss = lava_w * 1.45;
    tag = select(0.0, 3.0, lava_w > 0.35);
  } else if (is_cryo) {
    let fissure = 1.0 - smoothstep(0.04, 0.16, abs(fbm2(wx * 0.055, wz * 0.055, params.seed_f + 6.0)));
    col = mix(vec3<f32>(0.78, 0.87, 0.95), vec3<f32>(0.30, 0.62, 0.88), clamp(fissure + slope * 0.8, 0.0, 1.0));
    emiss = fissure * 0.25;
    tag = 1.0;
  } else if (has_ocean) {
    // Multi-biome tectonic/hydraulic terrain: beaches, arid plateaus, lush valleys, rivers, rocky cliffs, emergent seasonal snowline!
    let coast = 1.0 - smoothstep(params.sea_level + 0.05, params.sea_level + 1.4, h);
    let snow = smoothstep(params.climate_aux.x - 4.0, params.climate_aux.x + 12.0, h);
    let moisture = tect.z;
    // Rivers appear ONLY in concentrated valley drainage channels (SPH channels live in [0..1], Voronoi in [1.48..2.18]!)
    let riv_raw = select(smoothstep(1.48, 2.18, tect.y), smoothstep(0.66, 0.90, tect.y), has_sph);
    let river = riv_raw * (1.0 - smoothstep(0.05, 0.22, slope)) * (1.0 - snow * 0.85);
    let autumn = clamp(params.clip_aux.w, 0.0, 1.0);
    let dry_col = vec3<f32>(0.62, 0.52, 0.34);
    let lush_col = mix(vec3<f32>(0.14, 0.44, 0.18), vec3<f32>(0.50, 0.36, 0.15), autumn * 0.55);
    let biome_base = mix(dry_col, lush_col, smoothstep(0.20, 0.68, moisture));
    let rock_col = mix(vec3<f32>(0.42, 0.38, 0.34), vec3<f32>(0.30, 0.28, 0.26), tect.w);
    col = mix(biome_base, rock_col, clamp(slope * 2.1 + smoothstep(0.54, 0.86, h_norm) * 0.55, 0.0, 1.0));
    col = mix(col, vec3<f32>(0.78, 0.72, 0.56), coast);
    col = mix(col, params.ocean_rgb_ice.rgb * 1.35, river * 0.82);
    col = mix(col, vec3<f32>(0.90, 0.94, 0.98), snow);
    tag = select(select(0.0, 2.0, river > 0.72 && ice_cover < 0.72), 1.0, snow > 0.42);
  }

  // Persistent GPU Laser/Missile/Antimatter Thermal Glow, Vitrified Melt & Scorched Crater Rim!
  if (is_solid && !is_outer) {
    let def_v = sample_deform_field(wx, wz);
    let char_f = clamp(def_v.w, 0.0, 1.0);
    let melt_f = clamp(def_v.z, 0.0, 1.0);
    let glow_f = clamp((def_v.y - 820.0) / 1800.0, 0.0, 1.0);
    col = mix(col, vec3<f32>(0.11, 0.10, 0.12), char_f * 0.72);
    if (is_cryo && melt_f > 0.08) {
      // Melted ice turns into shimmering liquid water pool!
      col = mix(col, vec3<f32>(0.08, 0.36, 0.66), melt_f * 0.85);
      tag = select(tag, 2.0, melt_f > 0.32);
    } else if (glow_f > 0.02) {
      let lava_col = mix(vec3<f32>(1.0, 0.28, 0.04), vec3<f32>(1.0, 0.92, 0.56), glow_f);
      col = mix(col, lava_col, clamp(glow_f * 0.92 + melt_f * 0.25, 0.0, 1.0));
      emiss = max(emiss, glow_f * 2.25);
      tag = select(tag, 3.0, glow_f > 0.28);
    }
  }

  let ring_off = gid.z * n * n;
  let idx = ring_off + gid.y * n + gid.x;
  var v: TerrainVert;
  // Pass height above active sea level (on dry/airless worlds sea_level = -999 -> h - sea_level >> 100, gating wet_shore cleanly to 0!)
  v.pos_curv = vec4<f32>(wx, y_curved, wz, h - params.sea_level);
  v.norm_tag = vec4<f32>(n_vec, tag);
  v.col_emiss = vec4<f32>(col, emiss);
  terrain_verts[idx] = v;
}

// Kernel 2: Live GPU Jump-Rocket Exhaust, Ballistic Regolith Dust, & Drone Rotor Downwash!
@compute @workgroup_size(64)
fn step_surface_plume_particles(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  var p = plumes[i];
  let role = p.pos_role.w;
  let dt = params.dt;
  let seed = p.meta0.z;
  let ang = seed * 6.2831853 + f32(params.step_index) * 0.37;
  let r_rand = fract(sin(seed * 91.7 + f32(params.step_index) * 1.13) * 43758.5);

  var pos = p.pos_role.xyz;
  var vel = p.vel_age.xyz;
  var age = p.vel_age.w + dt;
  let max_life = max(0.25, p.col_life.w);
  var live = p.meta0.w;

  if (age >= max_life || live < 0.5) {
    // Respawn according to physical emission role!
    if (role < 0.5) {
      // Role 0: Rover Jump-Rocket exhaust flames (4 corner nozzles!)
      if (params.rocket_on > 0.05) {
        let nozzle = i & 3u;
        let sx = select(-0.95, 0.95, (nozzle & 1u) != 0u);
        let sz = select(-1.15, 1.15, (nozzle & 2u) != 0u);
        let cy = cos(params.rover_pos_y.w);
        let sy = sin(params.rover_pos_y.w);
        let ox = sx * cy + sz * sy;
        let oz = -sx * sy + sz * cy;
        let stagger = fract(seed * 7.31 + f32(params.step_index) * 0.17);
        let vy_jet = -11.5 - 9.5 * r_rand;
        pos = params.rover_pos_y.xyz + vec3<f32>(ox + cos(ang) * 0.08, 0.24 + stagger * vy_jet * 0.09, oz + sin(ang) * 0.08);
        vel = vec3<f32>(cos(ang) * 1.2, vy_jet, sin(ang) * 1.2);
        age = stagger * 0.14;
        live = 1.0;
        p.col_life = vec4<f32>(1.0, 0.72, 0.28, 0.26 + 0.18 * r_rand);
        p.meta0 = vec4<f32>(0.42, 1.8, seed, 1.0);
      } else {
        live = 0.0;
      }
    } else if (role < 1.5) {
      // Role 1: Ballistic regolith dust kicked up by rover wheels OR rocket impingement!
      let emit_dust = params.rocket_on > 0.05 || params.rover_speed > 1.2;
      if (emit_dust) {
        let cy = cos(params.rover_pos_y.w);
        let sy = sin(params.rover_pos_y.w);
        if (params.rocket_on > 0.05) {
          let rad = 0.8 + r_rand * 1.8;
          pos = params.rover_pos_y.xyz + vec3<f32>(cos(ang) * rad, 0.08, sin(ang) * rad);
          vel = vec3<f32>(cos(ang) * 8.5 + params.wind_x * 0.3, 1.8 + r_rand * 3.5, sin(ang) * 8.5 + params.wind_z * 0.3);
        } else {
          // Crisp twin wheel-track rooster tails behind left/right rear wheels!
          let side = select(-1.22, 1.22, (i & 1u) != 0u);
          let back = -1.25 - r_rand * 0.6;
          pos = params.rover_pos_y.xyz + vec3<f32>(side * cy + back * sy, 0.12, -side * sy + back * cy);
          vel = vec3<f32>(-sy * 2.2 + cos(ang) * 1.2 + params.wind_x * 0.3, 0.8 + r_rand * 1.6, -cy * 2.2 + sin(ang) * 1.2 + params.wind_z * 0.3);
        }
        age = r_rand * 0.08;
        live = 1.0;
        p.col_life = vec4<f32>(params.col0_pad.rgb * 1.15, 0.75 + 0.55 * r_rand);
        p.meta0 = vec4<f32>(0.40 + 0.28 * r_rand, 0.25, seed, 1.0);
      } else {
        live = 0.0;
      }
    } else {
      // Role 2: Active Comet Sublimation Outgassing Jets (mode_flags bit4 = 16u!) OR Drone downwash / atmospheric dust!
      let is_comet_vent = (params.mode_flags & 16u) != 0u;
      if (is_comet_vent) {
        // Active solar-driven H2O/CO sublimation geysers erupting vertically from fissured comet vents into vacuum coma!
        let vent_id = i % 6u;
        let v_ang = f32(vent_id) * 1.0471975 + params.seed_f;
        let v_rad = 26.0 + f32(vent_id) * 18.0;
        let vx_base = params.col0_pad.w + cos(v_ang) * v_rad + (r_rand - 0.5) * 6.0;
        let vz_base = params.col1_pad.w + sin(v_ang) * v_rad + (cos(ang) - 0.5) * 6.0;
        let vy_base = eval_height(vx_base, vz_base);
        pos = vec3<f32>(vx_base, vy_base + 0.4, vz_base);
        let jet_spd = 18.0 + r_rand * 26.0;
        vel = vec3<f32>(cos(ang) * (2.5 + r_rand * 4.5), jet_spd, sin(ang) * (2.5 + r_rand * 4.5));
        p.col_life = vec4<f32>(0.68, 0.90, 1.0, 2.2 + 1.8 * r_rand);
        p.meta0 = vec4<f32>(0.55 + 0.65 * r_rand, 0.85, seed, 1.0);
        age = r_rand * 0.35;
        live = 1.0;
      } else if (params.rho_atm > 1e-4 && (params.drone_throttle > 0.05 || abs(params.wind_x) + abs(params.wind_z) > 0.5)) {
        let is_downwash = params.drone_throttle > 0.05 && (i & 3u) != 0u;
        if (is_downwash) {
          let rad = 0.35 + r_rand * 1.1;
          pos = params.drone_pos_a.xyz + vec3<f32>(cos(ang) * rad, -0.25, sin(ang) * rad);
          vel = vec3<f32>(cos(ang) * 4.2 + params.wind_x * 0.5, -5.2 - 2.6 * r_rand, sin(ang) * 4.2 + params.wind_z * 0.5);
          p.col_life = vec4<f32>(mix(params.col0_pad.rgb, vec3<f32>(0.85, 0.92, 1.0), 0.35), 0.65 + 0.35 * r_rand);
          p.meta0 = vec4<f32>(0.32 + 0.22 * r_rand, 0.15, seed, 1.0);
          live = 1.0;
        } else if ((i & 3u) == 0u || params.climate_aux.x < 12.0) {
          // Winter snowfall flurries when snowline drops below local terrain (< 12 m), otherwise sparse wind-blown dust wisps!
          let is_snowfall = params.climate_aux.x < 12.0 && params.rho_atm > 0.05;
          let rx = (fract(seed * 13.7 + f32(params.step_index) * 0.01) - 0.5) * select(64.0, 96.0, is_snowfall);
          let rz = (fract(seed * 29.3 + f32(params.step_index) * 0.017) - 0.5) * select(64.0, 96.0, is_snowfall);
          let ry = select(0.8 + r_rand * 12.0, 4.0 + r_rand * 28.0, is_snowfall);
          let bx = params.col0_pad.w + rx;
          let bz = params.col1_pad.w + rz;
          pos = vec3<f32>(bx, eval_height(bx, bz) + ry, bz);
          vel = select(
            vec3<f32>(params.wind_x, (r_rand - 0.5) * 0.4, params.wind_z),
            vec3<f32>(params.wind_x * 0.45 + (r_rand - 0.5) * 1.4, -1.6 - r_rand * 1.6, params.wind_z * 0.45 + (cos(ang) - 0.5) * 1.4),
            is_snowfall
          );
          p.col_life = select(
            vec4<f32>(mix(params.col0_pad.rgb, vec3<f32>(0.92, 0.88, 0.82), 0.45), 1.8 + 1.0 * r_rand),
            vec4<f32>(0.94, 0.97, 1.00, 2.8 + 1.8 * r_rand),
            is_snowfall
          );
          p.meta0 = vec4<f32>(select(0.11 + 0.09 * r_rand, 0.16 + 0.14 * r_rand, is_snowfall), 0.1, seed, 1.0);
          live = 1.0;
        } else {
          live = 0.0;
        }
        age = r_rand * 0.15;
      } else {
        live = 0.0;
      }
    }
  } else {
    // Real ballistic gravity + atmospheric drag + wind coupling + terrain rebound!
    let drag = clamp(params.rho_atm * 0.85, 0.0, 2.5);
    let wind_v = vec3<f32>(params.wind_x, 0.0, params.wind_z);
    if (role > 0.5) {
      vel.y = vel.y - params.gravity_g * select(0.55, 0.12, role > 1.5) * dt;
      vel = vel + (wind_v - vel) * drag * dt;
    }
    pos = pos + vel * dt;
    let gh = eval_height(pos.x, pos.z);
    if (pos.y < gh + 0.08) {
      pos.y = gh + 0.08;
      // Physical dissipative inelastic surface rebound (never amplifies horizontal kinetic energy!)
      vel.y = abs(vel.y) * 0.22;
      vel.x = vel.x * 0.78;
      vel.z = vel.z * 0.78;
    }
  }

  p.pos_role = vec4<f32>(pos, role);
  p.vel_age = vec4<f32>(vel, age);
  p.meta0.w = live;
  plumes[i] = p;
}

// Kernel 3: Parallel 64-thread Telemetry Reduction
@compute @workgroup_size(64)
fn reduce_surface_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var live_cnt = 0.0;
  var flame_cnt = 0.0;
  var dust_cnt = 0.0;
  var spd_sum = 0.0;
  var i = tid;
  loop {
    if (i >= params.particle_count) { break; }
    let p = plumes[i];
    if (p.meta0.w > 0.5) {
      live_cnt = live_cnt + 1.0;
      spd_sum = spd_sum + length(p.vel_age.xyz);
      if (p.pos_role.w < 0.5) { flame_cnt = flame_cnt + 1.0; }
      else { dust_cnt = dust_cnt + 1.0; }
    }
    i = i + 64u;
  }
  wg0[tid] = live_cnt; wg1[tid] = flame_cnt; wg2[tid] = dust_cnt; wg3[tid] = spd_sum;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    telemetry[0] = vec4<f32>(wg0[0], wg1[0], wg2[0], wg3[0] / max(1.0, wg0[0]));
  }
}
`;

// =========================================================================
// Articulated 3D Solid Mesh Builders for Mars Rover & Atmospheric Drone
// (Outputs 12-float / 48-byte vertices directly consumable by SURFACE_MESH_WGSL!)
// =========================================================================
function pushOrientedBox(out, center, basisX, basisY, basisZ, halfX, halfY, halfZ, rgb, emissive = 0.0) {
  const c = (sx, sy, sz) => [
    center[0] + basisX[0] * (sx * halfX) + basisY[0] * (sy * halfY) + basisZ[0] * (sz * halfZ),
    center[1] + basisX[1] * (sx * halfX) + basisY[1] * (sy * halfY) + basisZ[1] * (sz * halfZ),
    center[2] + basisX[2] * (sx * halfX) + basisY[2] * (sy * halfY) + basisZ[2] * (sz * halfZ)
  ];
  const faces = [
    { n: basisX, pts: [c(1, -1, -1), c(1, 1, -1), c(1, 1, 1), c(1, -1, 1)] },
    { n: [-basisX[0], -basisX[1], -basisX[2]], pts: [c(-1, -1, 1), c(-1, 1, 1), c(-1, 1, -1), c(-1, -1, -1)] },
    { n: basisY, pts: [c(-1, 1, -1), c(-1, 1, 1), c(1, 1, 1), c(1, 1, -1)] },
    { n: [-basisY[0], -basisY[1], -basisY[2]], pts: [c(-1, -1, 1), c(-1, -1, -1), c(1, -1, -1), c(1, -1, 1)] },
    { n: basisZ, pts: [c(-1, -1, 1), c(1, -1, 1), c(1, 1, 1), c(-1, 1, 1)] },
    { n: [-basisZ[0], -basisZ[1], -basisZ[2]], pts: [c(1, -1, -1), c(-1, -1, -1), c(-1, 1, -1), c(1, 1, -1)] }
  ];
  const emitVert = (p, n) => {
    out.push(p[0], p[1], p[2], p[1], n[0], n[1], n[2], 4.0, rgb[0], rgb[1], rgb[2], emissive);
  };
  for (const f of faces) {
    emitVert(f.pts[0], f.n); emitVert(f.pts[1], f.n); emitVert(f.pts[2], f.n);
    emitVert(f.pts[0], f.n); emitVert(f.pts[2], f.n); emitVert(f.pts[3], f.n);
  }
}

function pushFrustumCylinder(out, center, axisDir, radA, radB, radiusBot, radiusTop, halfLen, sides, rgb, emissive = 0.0, phaseRad = 0.0, capEnds = true) {
  const emitVert = (p, n) => {
    out.push(p[0], p[1], p[2], p[1], n[0], n[1], n[2], 4.0, rgb[0], rgb[1], rgb[2], emissive);
  };
  const ptAt = (axOff, r, ang) => {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    return [
      center[0] + axisDir[0] * axOff + (radA[0] * ca + radB[0] * sa) * r,
      center[1] + axisDir[1] * axOff + (radA[1] * ca + radB[1] * sa) * r,
      center[2] + axisDir[2] * axOff + (radA[2] * ca + radB[2] * sa) * r
    ];
  };
  const cBot = [center[0] - axisDir[0] * halfLen, center[1] - axisDir[1] * halfLen, center[2] - axisDir[2] * halfLen];
  const cTop = [center[0] + axisDir[0] * halfLen, center[1] + axisDir[1] * halfLen, center[2] + axisDir[2] * halfLen];
  const nBot = [-axisDir[0], -axisDir[1], -axisDir[2]];
  const slope = (radiusBot - radiusTop) / Math.max(1e-4, 2.0 * halfLen);
  for (let s = 0; s < sides; s += 1) {
    const a0 = phaseRad + (s / sides) * Math.PI * 2;
    const a1 = phaseRad + ((s + 1) / sides) * Math.PI * 2;
    const am = 0.5 * (a0 + a1);
    const cm = Math.cos(am);
    const sm = Math.sin(am);
    const nSide = normalize3([
      radA[0] * cm + radB[0] * sm + axisDir[0] * slope,
      radA[1] * cm + radB[1] * sm + axisDir[1] * slope,
      radA[2] * cm + radB[2] * sm + axisDir[2] * slope
    ]);
    const b0 = ptAt(-halfLen, radiusBot, a0);
    const b1 = ptAt(-halfLen, radiusBot, a1);
    const t0 = ptAt(halfLen, radiusTop, a0);
    const t1 = ptAt(halfLen, radiusTop, a1);
    emitVert(b0, nSide); emitVert(b1, nSide); emitVert(t1, nSide);
    emitVert(b0, nSide); emitVert(t1, nSide); emitVert(t0, nSide);
    if (capEnds) {
      if (radiusTop > 1e-4) {
        emitVert(cTop, axisDir); emitVert(t0, axisDir); emitVert(t1, axisDir);
      }
      if (radiusBot > 1e-4) {
        emitVert(cBot, nBot); emitVert(b1, nBot); emitVert(b0, nBot);
      }
    }
  }
}

function normalize3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function cross3(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function buildRoverAndDroneMeshFloats(rover, drone, curvInv2R, refX, refZ, ufo = null, extras = {}) {
  const out = [];
  const fxOut = [];
  const applyCurv = (p) => {
    const dx = p[0] - refX;
    const dz = p[2] - refZ;
    return [p[0], p[1] - (dx * dx + dz * dz) * curvInv2R, p[2]];
  };

  // --- 1. 6-WHEEL ROCKER-BOGIE MARS ROVER WITH JUMP ROCKETS ---
  if (rover.visible) {
    const up = normalize3(rover.up || [0, 1, 0]);
    const fwdRaw = [Math.sin(rover.yaw), 0, Math.cos(rover.yaw)];
    const dotFU = fwdRaw[0] * up[0] + fwdRaw[1] * up[1] + fwdRaw[2] * up[2];
    const fwd = normalize3([fwdRaw[0] - up[0] * dotFU, fwdRaw[1] - up[1] * dotFU, fwdRaw[2] - up[2] * dotFU]);
    const right = normalize3(cross3(up, fwd));
    const base = applyCurv(rover.pos);
    const pt = (rx, ry, rz) => [
      base[0] + right[0] * rx + up[0] * ry + fwd[0] * rz,
      base[1] + right[1] * rx + up[1] * ry + fwd[1] * rz,
      base[2] + right[2] * rx + up[2] * ry + fwd[2] * rz
    ];

    // Main gold-MLI thermal insulated chassis + white top avionics deck + warm-white LED headlights!
    pushOrientedBox(out, pt(0, 0.78, 0), right, up, fwd, 0.88, 0.34, 1.28, [0.90, 0.86, 0.78], 0.0);
    pushOrientedBox(out, pt(0, 1.15, -0.05), right, up, fwd, 0.94, 0.08, 1.32, [0.94, 0.96, 0.98], 0.0);
    // Forward dual LED navigation headlights & gold bumper bar
    pushOrientedBox(out, pt(0, 0.72, 1.30), right, up, fwd, 0.82, 0.07, 0.05, [0.34, 0.38, 0.44], 0.0);
    pushOrientedBox(out, pt(-0.56, 0.84, 1.31), right, up, fwd, 0.14, 0.07, 0.03, [1.0, 0.95, 0.82], 1.15);
    pushOrientedBox(out, pt(0.56, 0.84, 1.31), right, up, fwd, 0.14, 0.07, 0.03, [1.0, 0.95, 0.82], 1.15);
    // Gold-foil thermal belly pan & trimmed solar side wing arrays
    pushOrientedBox(out, pt(0, 0.50, 0), right, up, fwd, 0.78, 0.14, 1.18, [0.88, 0.68, 0.24], 0.0);
    pushOrientedBox(out, pt(-1.14, 1.12, -0.15), right, up, fwd, 0.39, 0.035, 0.98, [0.78, 0.70, 0.38], 0.0);
    pushOrientedBox(out, pt(1.14, 1.12, -0.15), right, up, fwd, 0.39, 0.035, 0.98, [0.78, 0.70, 0.38], 0.0);
    pushOrientedBox(out, pt(-1.14, 1.145, -0.15), right, up, fwd, 0.34, 0.025, 0.92, [0.12, 0.28, 0.62], 0.08);
    pushOrientedBox(out, pt(1.14, 1.145, -0.15), right, up, fwd, 0.34, 0.025, 0.92, [0.12, 0.28, 0.62], 0.08);
    // Rear cylindrical finned MMRTG plutonium power pack (warm amber glow!)
    pushFrustumCylinder(out, pt(0, 0.96, -1.52), fwd, right, up, 0.34, 0.30, 0.34, 8, [0.36, 0.38, 0.42], 0.0, 0.0, true);
    pushFrustumCylinder(out, pt(0, 1.00, -1.86), fwd, right, up, 0.22, 0.18, 0.08, 8, [0.95, 0.44, 0.14], 0.42, 0.0, true);
    // Forward Mastcam-Z cylindrical neck + stereo head + twin glowing optical lenses + laser-spectrometer eye!
    pushFrustumCylinder(out, pt(0.28, 1.62, 0.86), up, right, fwd, 0.08, 0.07, 0.46, 8, [0.85, 0.88, 0.92], 0.0, 0.0, true);
    pushOrientedBox(out, pt(0.28, 2.08, 0.92), right, up, fwd, 0.32, 0.16, 0.22, [0.92, 0.94, 0.96], 0.0);
    pushFrustumCylinder(out, pt(0.16, 2.08, 1.14), fwd, right, up, 0.07, 0.06, 0.04, 8, [0.22, 0.88, 1.0], 0.95, 0.0, true);
    pushFrustumCylinder(out, pt(0.40, 2.08, 1.14), fwd, right, up, 0.07, 0.06, 0.04, 8, [0.22, 0.88, 1.0], 0.95, 0.0, true);
    // Drone helipad docking deck on top-rear + high-gain dish antenna
    pushOrientedBox(out, pt(0, 1.24, -0.35), right, up, fwd, 0.52, 0.03, 0.52, [0.22, 0.26, 0.32], 0.0);
    pushFrustumCylinder(out, pt(-0.56, 1.56, -0.82), up, right, fwd, 0.04, 0.30, 0.10, 10, [0.92, 0.94, 0.96], 0.0, 0.0, true);

    // 4 Corner Tapered Conical Jump-Rocket Thruster Bells (glow bright cyan-orange when firing!)
    const rGlow = rover.rocketThrottle > 0.05 ? 1.85 : 0.0;
    const rCol = rover.rocketThrottle > 0.05 ? [1.0, 0.72, 0.24] : [0.30, 0.34, 0.40];
    for (const sx of [-0.94, 0.94]) {
      for (const sz of [-1.05, 1.05]) {
        pushFrustumCylinder(out, pt(sx, 0.42, sz), up, right, fwd, 0.18, 0.09, 0.22, 8, rCol, rGlow, 0.0, true);
      }
    }

    // 6 High-LOD 10-Sided Cylindrical Titanium Rocker-Bogie Wheels + Hubs + Tread Cleats (rolling live with rover.wheelAngle!)
    const wCos = Math.cos(rover.wheelAngle);
    const wSin = Math.sin(rover.wheelAngle);
    const wUp = [up[0] * wCos + fwd[0] * wSin, up[1] * wCos + fwd[1] * wSin, up[2] * wCos + fwd[2] * wSin];
    const wFwd = [fwd[0] * wCos - up[0] * wSin, fwd[1] * wCos - up[1] * wSin, fwd[2] * wCos - up[2] * wSin];
    for (const sx of [-1.22, 1.22]) {
      // Rocker-bogie titanium linkage bar
      pushOrientedBox(out, pt(sx * 0.90, 0.58, 0.0), right, up, fwd, 0.06, 0.07, 1.32, [0.76, 0.78, 0.82], 0.0);
      for (const sz of [-1.22, 0.0, 1.22]) {
        // Vertical suspension strut + axle knuckle
        pushFrustumCylinder(out, pt(sx * 0.94, 0.40, sz), up, right, fwd, 0.055, 0.055, 0.22, 6, [0.70, 0.73, 0.78], 0.0, 0.0, false);
        // 10-sided cylindrical titanium tire rotating around `right` axis!
        pushFrustumCylinder(out, pt(sx, 0.34, sz), right, wUp, wFwd, 0.34, 0.34, 0.21, 10, [0.22, 0.24, 0.28], 0.0, 0.0, true);
        // Gold-anodized wheel hubcap + rotating spoke cross-cleat so rolling spin is unmistakably visible!
        pushFrustumCylinder(out, pt(sx * 1.03, 0.34, sz), right, wUp, wFwd, 0.16, 0.16, 0.22, 8, [0.86, 0.68, 0.28], 0.04, 0.0, true);
        pushOrientedBox(out, pt(sx * 1.04, 0.34, sz), right, wUp, wFwd, 0.225, 0.35, 0.045, [0.42, 0.45, 0.50], 0.0);
      }
    }
  }

  // --- 2. INGENUITY / DRAGONFLY COAXIAL ATMOSPHERIC DRONE ---
  if (drone.visible !== false) {
    const dBase = applyCurv(drone.pos);
    const cy = Math.cos(drone.yaw); const sy = Math.sin(drone.yaw);
    const cp = Math.cos(drone.pitch); const sp = Math.sin(drone.pitch);
    const cr = Math.cos(drone.roll); const sr = Math.sin(drone.roll);
    const dFwd = normalize3([sy * cp, -sp, cy * cp]);
    const dRight0 = normalize3([cy, 0, -sy]);
    const dUp0 = normalize3(cross3(dFwd, dRight0));
    const dRight = normalize3([dRight0[0] * cr + dUp0[0] * sr, dRight0[1] * cr + dUp0[1] * sr, dRight0[2] * cr + dUp0[2] * sr]);
    const dUp = normalize3(cross3(dFwd, dRight));
    const dp = (rx, ry, rz) => [
      dBase[0] + dRight[0] * rx + dUp[0] * ry + dFwd[0] * rz,
      dBase[1] + dRight[1] * rx + dUp[1] * ry + dFwd[1] * rz,
      dBase[2] + dRight[2] * rx + dUp[2] * ry + dFwd[2] * rz
    ];

    // Gold-foil octagonal avionics fuselage + glowing optical telemetry eye + carbon rotor mast
    pushFrustumCylinder(out, dp(0, 0.34, 0), dUp, dRight, dFwd, 0.27, 0.24, 0.19, 8, [0.92, 0.72, 0.24], 0.06, 0.0, true);
    pushFrustumCylinder(out, dp(0, 0.34, 0.25), dFwd, dRight, dUp, 0.07, 0.06, 0.04, 8, [0.22, 0.96, 0.72], 1.15, 0.0, true);
    pushFrustumCylinder(out, dp(0, 0.72, 0), dUp, dRight, dFwd, 0.045, 0.045, 0.26, 6, [0.82, 0.86, 0.90], 0.0, 0.0, false);
    // Top photovoltaic solar cap
    pushOrientedBox(out, dp(0, 1.02, 0), dRight, dUp, dFwd, 0.38, 0.03, 0.20, [0.16, 0.30, 0.68], 0.12);
    // 4 landing struts & foot pads
    for (const sx of [-0.34, 0.34]) {
      for (const sz of [-0.34, 0.34]) {
        pushOrientedBox(out, dp(sx, 0.12, sz), dRight, dUp, dFwd, 0.035, 0.16, 0.035, [0.28, 0.30, 0.34], 0.0);
        pushOrientedBox(out, dp(sx, 0.02, sz), dRight, dUp, dFwd, 0.07, 0.02, 0.07, [0.56, 0.60, 0.66], 0.0);
      }
    }
    // Counter-rotating coaxial carbon rotor blades (upper + lower, spinning live at rotorAngle!)
    for (let rIdx = 0; rIdx < 2; rIdx += 1) {
      const a = rIdx === 0 ? drone.rotorAngle : -drone.rotorAngle * 1.04 + 1.1;
      const ca = Math.cos(a); const sa = Math.sin(a);
      const bR = [dRight[0] * ca + dFwd[0] * sa, dRight[1] * ca + dFwd[1] * sa, dRight[2] * ca + dFwd[2] * sa];
      const bF = [dFwd[0] * ca - dRight[0] * sa, dFwd[1] * ca - dRight[1] * sa, dFwd[2] * ca - dRight[2] * sa];
      pushOrientedBox(out, dp(0, 0.84 + rIdx * 0.11, 0), bR, dUp, bF, 1.08, 0.015, 0.085, [0.24, 0.28, 0.34], 0.0);
      pushOrientedBox(out, dp(0, 0.84 + rIdx * 0.11, 0), bF, dUp, bR, 1.08, 0.015, 0.085, [0.24, 0.28, 0.34], 0.0);
    }
  }

  // --- 3. ICONIC 60-FOOT (18.3 m) SMOOTH FLYING SAUCER + EMERALD GREEN GLASS BUBBLE + YELLOW TRACTOR BEAM + RIM WEAPONS ---
  if (ufo && ufo.visible) {
    appendIconicUfoGeometry(out, fxOut, {
      pos: ufo.pos,
      yaw: ufo.yaw,
      pitch: ufo.pitch,
      roll: ufo.roll,
      radius: UFO_RADIUS_M,
      rimAngle: ufo.rimAngle,
      vertThrust: ufo.vertThrust,
      tractorActive: Boolean(extras.tractorActive),
      tractorHeight: extras.tractorHeight ?? 26.0,
      tractorGroundPos: extras.tractorGroundPos || null,
      beam: extras.activeBeam || null,
      isCockpit: Boolean(extras.isUfoCockpit),
      isRemote: false,
      shieldFlash: extras.shieldFlash || 0,
      curvFn: applyCurv
    });
  }

  // --- 4. LIVE RIM-LAUNCHED MISSILES, REMOTE PEERCOMPUTE MULTIPLAYER UFOS & VON NEUMANN PROBES ---
  if (Array.isArray(extras.missiles)) {
    for (const m of extras.missiles) {
      if (m.alive) appendMissileGeometry(out, fxOut, m, applyCurv);
    }
  }
  if (Array.isArray(extras.remoteUfos)) {
    for (const ru of extras.remoteUfos) {
      if (!Array.isArray(ru.pos)) continue;
      appendIconicUfoGeometry(out, fxOut, {
        pos: ru.pos,
        yaw: ru.yaw || 0,
        pitch: ru.pitch || 0,
        roll: ru.roll || 0,
        radius: UFO_RADIUS_M,
        rimAngle: ufo?.rimAngle || 0,
        vertThrust: ru.vertThrust || 0,
        tractorActive: Boolean(ru.tractorActive),
        tractorHeight: 24.0,
        beam: ru.beam || null,
        isCockpit: false,
        isRemote: true,
        shieldFlash: ru.shieldFlash || 0,
        curvFn: applyCurv
      });
    }
  }
  if (Array.isArray(extras.probes)) {
    for (const pr of extras.probes) {
      const ang = pr.angle || 0;
      const rad = 55.0 + (pr.orbitRadius || 2.0) * 18.0;
      const px = refX + Math.cos(ang) * rad;
      const pz = refZ + Math.sin(ang) * rad;
      const py = (ufo?.pos?.[1] ?? 28.0) + 26.0 + Math.sin(ang * 2.0) * 8.0;
      appendVonNeumannProbeGeometry(out, fxOut, applyCurv([px, py, pz]), ang * 2.0, 2.2);
    }
  }

  // --- 5. LIVE PROCEDURAL XENOBIOLOGY ECOSYSTEM (17 ARTICULATED FAUNA, FLORA, FUNGI, SKY-LEVIATHAN & SWIMMER MORPHS!) ---
  if (Array.isArray(extras.organisms)) {
    for (const org of extras.organisms) {
      if (!org || org.abducted) continue;
      const [ox, , oz] = org.pos;
      const dist2 = (ox - refX) * (ox - refX) + (oz - refZ) * (oz - refZ);
      if (dist2 > 310 * 310) continue;
      appendProceduralOrganismGeometry(out, fxOut, org, applyCurv);
    }
  }

  return {
    opaque: new Float32Array(out),
    fx: new Float32Array(fxOut)
  };
}

export function createPlanetarySurfaceSessionWebGpu(device, {
  bodySpec = {},
  planetaryResult = null,
  planetaryAtmoState = null,
  planetaryMode = 'standard',
  landingSite = null,
  sphSurfacePatch = null,
  gridN = 129,
  cellSizeM = 9.5,
  particleCount = 2048,
  seed = 20261125,
  initialVehicle = 'ufo',
  initialCheckpoint = null,
  initialCraterStamps = [],
  onCraterStamp = null,
  label = 'ulg-planetary-surface'
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('createPlanetarySurfaceSessionWebGpu requires a live WebGPU GPUDevice');
  }
  const baseEnv = deriveSurfaceEnvironmentState(bodySpec, { planetaryResult, planetaryAtmoState, planetaryMode, landingSite, seed });
  const hasSphPatch = Boolean(sphSurfacePatch && sphSurfacePatch.patchBuffer && sphSurfacePatch.coarseHeight64 && baseEnv.hasSolidCrust);
  const SPH_SURFACE_PATCH_SPAN_M = 2800.0;
  const env = hasSphPatch
    ? Object.freeze({
      ...baseEnv,
      hasSphGeology: true,
      sphCoarseHeight64: sphSurfacePatch.coarseHeight64,
      sphSeaLevelNorm: baseEnv.hasLiquidOcean ? (Number(sphSurfacePatch.seaLevelNorm) || 0.0) : 0.0,
      sphPatchSpanM: SPH_SURFACE_PATCH_SPAN_M,
      // Exact 1-to-1 SPH shoreline at y = 0.0 m (zero fake Perlin seaLevelOffsetM shift!)
      seaLevelM: baseEnv.hasLiquidOcean ? 0.0 : -999.0
    })
    : baseEnv;
  const activeGeoWorldSpanM = hasSphPatch ? SPH_SURFACE_PATCH_SPAN_M : TECTONIC_WORLD_SPAN_M;
  const n = Math.max(33, Math.min(129, Math.trunc(gridN)));
  const ringVertCount = n * n;
  const totalVertCount = ringVertCount * 2; // 2-ring +-6 km GPU clipmap packed in ONE terrain_verts buffer!
  const outerCellSizeM = cellSizeM * 10.0;
  const pCount = Math.max(256, Math.min(8192, Math.trunc(particleCount)));

  // Static 2-ring GPU clipmap index buffer (built once: inner +-608m high-detail + outer +-6km mountain horizon with center cutout!)
  const idxList = [];
  for (let z = 0; z < n - 1; z += 1) {
    for (let x = 0; x < n - 1; x += 1) {
      const i0 = z * n + x;
      const i1 = i0 + 1;
      const i2 = i0 + n;
      const i3 = i2 + 1;
      idxList.push(i0, i2, i1, i1, i2, i3);
    }
  }
  const halfQ = (n - 1) * 0.5;
  const holeHalfQuads = Math.max(2, Math.floor((halfQ * cellSizeM) / outerCellSizeM) - 1);
  for (let z = 0; z < n - 1; z += 1) {
    for (let x = 0; x < n - 1; x += 1) {
      if (Math.abs(x + 0.5 - halfQ) < holeHalfQuads && Math.abs(z + 0.5 - halfQ) < holeHalfQuads) continue;
      const i0 = ringVertCount + z * n + x;
      const i1 = i0 + 1;
      const i2 = i0 + n;
      const i3 = i2 + 1;
      idxList.push(i0, i2, i1, i1, i2, i3);
    }
  }
  const indices = new Uint32Array(idxList);
  const indexCount = indices.length;

  // Initial plume particles buffer (64 B / particle)
  const initPlumes = new Float32Array(pCount * 16);
  for (let i = 0; i < pCount; i += 1) {
    const o = i * 16;
    const role = i < pCount * 0.28 ? 0.0 : (i < pCount * 0.68 ? 1.0 : 2.0);
    initPlumes[o + 3] = role;
    initPlumes[o + 7] = 9.0; // start expired so respawn activates strictly on demand
    initPlumes[o + 11] = 1.0;
    initPlumes[o + 14] = ((i * 2654435761) >>> 0) / 4294967296;
    initPlumes[o + 15] = 0.0; // live = 0 until rocket/dust/wind activates!
  }

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(5, 'read-only-storage'),
    computeBufferBinding(6, 'read-only-storage')
  ];
  const mkPipe = (entryPoint) => createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-planetary-surface-${entryPoint}.v6-sph-geology`,
    label: `${label}-${entryPoint}`,
    code: planetarySurfaceWgsl,
    entryPoint,
    bindings
  });
  const terrainPipe = mkPipe('generate_surface_terrain_mesh');
  const plumePipe = mkPipe('step_surface_plume_particles');
  const telPipe = mkPipe('reduce_surface_telemetry');

  const paramsBuf = device.createBuffer({ label: `${label}-params`, size: 192, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const terrainVertBuf = device.createBuffer({ label: `${label}-terrain-verts`, size: totalVertCount * 48, usage: GPU_BUF.STORAGE | GPU_BUF.VERTEX });
  const terrainIdxBuf = device.createBuffer({ label: `${label}-terrain-idx`, size: indices.byteLength, usage: GPU_BUF.INDEX | GPU_BUF.COPY_DST });
  const plumesBuf = device.createBuffer({ label: `${label}-plumes`, size: initPlumes.byteLength, usage: GPU_BUF.STORAGE | GPU_BUF.VERTEX | GPU_BUF.COPY_DST });
  const telBuf = device.createBuffer({ label: `${label}-tel`, size: 16, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC });
  const telReadBuf = device.createBuffer({ label: `${label}-tel-rd`, size: 16, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });

  // Vehicle + Procedural Xenobiology solid mesh buffer + Translucent FX buffer
  const MAX_VEHICLE_VERTS = 65536;
  const MAX_FX_VERTS = 24576;
  const vehicleVertBuf = device.createBuffer({ label: `${label}-veh-verts`, size: MAX_VEHICLE_VERTS * 48, usage: GPU_BUF.VERTEX | GPU_BUF.COPY_DST });
  const fxVertBuf = device.createBuffer({ label: `${label}-fx-verts`, size: MAX_FX_VERTS * 48, usage: GPU_BUF.VERTEX | GPU_BUF.COPY_DST });

  // Active-Zone Hybrid GPU MLS-MPM Deformable Terrain + 64 GPU SE(3) DLM Rigid-Body Boulders + Persistent Crater Replay!
  const deformMpm = createSurfaceDeformationAndBouldersGpu(device, {
    env,
    baseHeightFn: (x, z) => evaluatePlanetaryCrustElevation(x, z, env),
    initialCraterStamps,
    onCraterStamp,
    seed,
    label: `${label}-mpm`
  });

  // Zero-Copy GPU SPH Planetary Geology Patch OR Fallback Voronoi Tectonics (< 2.5 ms once on landing!)
  const tectonicsGpu = hasSphPatch
    ? null
    : createSurfaceTectonicsErosionGpu(device, {
      env,
      seed,
      erosionPasses: env.hasSolidCrust ? 48 : 0,
      label: `${label}-tect`
    });
  const activeGeologyBuf = hasSphPatch ? sphSurfacePatch.patchBuffer : tectonicsGpu.getResidentTectonicBuffer();
  // Live 128x128 GPU 2D Shallow-Water Ocean Wave PDE + Ekman Currents (dormant-zero on dry/frozen worlds!)
  const oceanWaveGpu = createSurfaceOceanWaveGpu(device, {
    gravityMS2: env.gravityMS2,
    latitudeRad: 0.55,
    enabled: Boolean(env.hasLiquidOcean),
    label: `${label}-ocean`
  });
  // Hardware-Instanced GPU Flora, Xenobiota & Indigenous Settlement Placement!
  const floraGpu = createSurfaceFloraPlacementGpu(device, {
    tectonicFieldBuf: activeGeologyBuf,
    deformFieldBuf: deformMpm.getResidentDeformBuffer(),
    label: `${label}-flora`
  });

  device.queue.writeBuffer(terrainIdxBuf, 0, indices);
  device.queue.writeBuffer(plumesBuf, 0, initPlumes);

  // Live 3D WebGPU Stratified Atmospheric CFD & Multi-Species Chemistry (active on ANY atmosphere-bearing world, strictly null/dormant in vacuum!)
  const hasAtmosphereForCfd = !env.hasSolidCrust || env.pressurePa >= 20.0;
  const cfdSession = hasAtmosphereForCfd
    ? createPlanetaryAtmo3dCfdSessionWebGpu(device, {
      bodySpec,
      env,
      nx: 32,
      ny: 24,
      nz: 32,
      moteCount: Math.min(3072, pCount + 1024),
      label: `${label}-cfd3d`
    })
    : null;

  const bg = createCachedExplicitBindGroup(device, {
    layout: terrainPipe.bindGroupLayout,
    label: `${label}-bg-v6`,
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: terrainVertBuf } },
      { binding: 2, resource: { buffer: plumesBuf } },
      { binding: 3, resource: { buffer: telBuf } },
      { binding: 4, resource: { buffer: deformMpm.getResidentDeformBuffer() } },
      { binding: 5, resource: { buffer: oceanWaveGpu.getResidentOceanBuffer() } },
      { binding: 6, resource: { buffer: activeGeologyBuf } }
    ]
  });

  // Live Vehicle Physical States — UFO is the universal exploration saucer on ALL worlds until you beam down a Rover or Drone!
  const initSup = resolveRoverMultiWheelSupport(0, 0, 0.35, cellSizeM, env);
  const h0 = initSup.supportY;
  const startAsRover = initialVehicle === 'rover' && env.hasSolidCrust;
  const rover = {
    visible: startAsRover,
    deployed: startAsRover,
    pos: [0, h0, 0],
    vel: [0, 0, 0],
    yaw: 0.35,
    up: initSup.normal,
    wheelAngle: 0,
    onGround: env.hasSolidCrust,
    rocketFuel: 1.0,
    rocketThrottle: 0.0,
    altitudeM: 0.0,
    speedMS: 0.0
  };
  const drone = {
    visible: startAsRover,
    docked: true,
    pos: [0, env.hasSolidCrust ? (h0 + 1.25) : 6.0, -0.35],
    vel: [0, 0, 0],
    yaw: 0.35,
    pitch: 0,
    roll: 0,
    rotorAngle: 0,
    throttle: 0.0,
    rcsFuel: 1.0,
    altitudeM: env.hasSolidCrust ? 1.25 : 22.0,
    aeroLiftN: 0.0,
    speedMS: 0.0
  };
  const ufo = {
    visible: true,
    pos: [0, env.hasSolidCrust ? (h0 + 16.0) : 14.0, 0],
    vel: [0, 0, 0],
    yaw: 0.35,
    pitch: 0,
    roll: 0,
    rimAngle: 0,
    vertThrust: 0,
    altitudeKm: cfdSession ? cfdSession.profile.startAltKm : 0.03,
    altitudeM: env.hasSolidCrust ? 16.0 : 14000.0,
    speedMS: 0.0
  };

  let activeVehicle = startAsRover ? 'rover' : 'ufo';
  let cameraMode = 'chase'; // 'chase' | 'first-person' (3D Emerald Glass Cockpit!)
  let lookYawOffset = startAsRover ? -0.32 : 0.0;
  let lookPitch = 0.22;
  let chaseDistScale = 1.0;

  // Tractor Beam, 360° Rim Weapons (Tunable EM Laser, Missiles, Antimatter Beam), & External Multiplayer/Probe State
  let tractorManualOn = false;
  let tractorAutoTimerS = 0.0;
  let weaponMode = 'laser';        // 'laser' | 'missile' | 'antimatter'
  let laserLog10WavelengthM = -6.27; // Default 532 nm emerald visible laser (tunable 10^-13 Gamma -> 10^+1 Radio!)
  let laserPowerW = 2.5e8;         // 250 MW default (dynamically lifts to 10^26 W with Kardashev tier!)
  let maxWeaponPowerW = 1e12;
  let weaponFiring = false;
  let weaponAimWorldPos = null;
  let laserSpotTempK = env.tempK;
  let lastWeaponReaction = null;
  let antimatterFlash = 0;
  const bodyBindingEnergyJ = computeBodyBindingEnergyJ(bodySpec);
  let deliveredWeaponEnergyJ = 0;
  let shatterTriggered = false;
  let externalRemoteUfos = [];
  let externalProbes = [];
  let externalShieldFlash = 0;
  const activeMissiles = [];       // { pos, vel, age, alive, isRemote, ownerId }
  const pendingHarvest = { silicates: 0, volatiles: 0, metals: 0, exotics: 0 };
  const pendingPeerHits = [];      // { targetPeerId, weapon, damage, wavelengthNm }
  const pendingAbductions = [];
  const abductedSpecimens = [];

  // Populate live multi-species ecosystem clade web (Flora + Fungi/Chemotrophs + Terrestrial/Aerial/Aquatic Fauna —
  // INCLUDING buoyant Gas-Giant Cloud-Deck Sky-Leviathans riding live 3D CFD updrafts!)
  const surfaceOrganisms = [];
  const xeno = env.xenobiology;
  const isGasCloudBio = !env.hasSolidCrust && xeno?.solvent === 'H2-He-cloud' && (xeno?.species?.length || 0) > 0;
  const isSolidSurfaceBio = env.hasSolidCrust && !env.isMagmaOcean && (xeno?.biosphereViability ?? 0) >= 0.22 && (xeno?.species?.length || 0) > 0;
  if (isGasCloudBio) {
    // Gas-giant cloud deck: spawn floating aero-gasbag leviathans, wing-gliders & radial aerial drifters!
    const airSpecies = xeno.species.filter((s) => s.kingdom === 'fauna');
    const nAir = 10;
    for (let oi = 0; oi < nAir; oi += 1) {
      const sp = airSpecies[oi % Math.max(1, airSpecies.length)] || xeno.species[0];
      const ang = ((oi * 2.399963) + (seed % 97) * 0.1) % (Math.PI * 2);
      const rad = 24.0 + (oi % 5) * 20.0;
      surfaceOrganisms.push({
        id: `org-air-${oi}`,
        kind: 'fauna',
        kingdom: 'fauna',
        bodyPlan: sp.bodyPlan,
        morph: sp.bodyPlan === 'aero-gasbag' || sp.bodyPlan === 'wing-glider' ? 'glider' : sp.bodyPlan,
        trophicGuild: sp.trophicGuild,
        speciesRecord: sp,
        developmentalGenome: sp.developmentalGenome || null,
        pos: [Math.cos(ang) * rad, 8.0 + ((oi % 4) - 1.5) * 7.5, Math.sin(ang) * rad],
        yaw: ang + 1.1,
        speed: sp.bodyPlan === 'wing-glider' ? 6.2 : 3.2,
        phase: oi * 1.47,
        scale: (sp.traits?.scaleBase || 1.6) * (0.85 + (oi % 3) * 0.22),
        primaryRgb: sp.primaryRgb,
        secondaryRgb: sp.secondaryRgb,
        accentRgb: sp.accentRgb,
        biolumRgb: sp.biolumRgb,
        biolumIntensity: sp.biolumIntensity,
        traits: sp.traits,
        abducting: false,
        abducted: false,
        seed: (sp.seed ^ Math.imul(oi + 17, 2654435761)) >>> 0
      });
    }
  } else if (isSolidSurfaceBio) {
    const floraPool = xeno.species.filter((s) => s.kingdom === 'flora');
    const fungiPool = xeno.species.filter((s) => s.kingdom === 'fungi');
    const faunaPool = xeno.species.filter((s) => s.kingdom === 'fauna');
    const buck = Math.max(0.65, Math.min(1.85, xeno.bucklingHeightScale || 1.0));
    const nFauna = landingSite?.isPolarIce ? 7 : 14;
    const nFungi = landingSite?.isPolarIce ? 3 : 7;
    const nFlora = landingSite?.isPolarIce || landingSite?.isOcean ? 5 : 12;
    const total = nFauna + nFungi + nFlora;
    for (let oi = 0; oi < total; oi += 1) {
      const isFauna = oi < nFauna;
      const isFungi = !isFauna && oi < nFauna + nFungi;
      const pool = isFauna ? faunaPool : (isFungi ? fungiPool : floraPool);
      const sp = pool[oi % Math.max(1, pool.length)] || xeno.species[0];
      if (!sp) continue;
      const ang = ((oi * 2.399963) + (seed % 97) * 0.1) % (Math.PI * 2);
      const rad = isFauna ? (10.0 + (oi % 6) * 14.0 + (oi >= 6 ? 14 : 0)) : (12.0 + ((oi - nFauna) % 8) * 14.5);
      const ox = Math.cos(ang) * rad;
      const oz = Math.sin(ang) * rad;
      const gh = evaluatePlanetaryCrustElevation(ox, oz, env);
      const isAerial = sp.bodyPlan === 'aero-gasbag' || sp.bodyPlan === 'wing-glider';
      const isAquatic = sp.bodyPlan === 'aquatic-swimmer';
      const inWater = env.hasLiquidOcean && gh < env.seaLevelM + 0.5;
      if (isAquatic && !inWater) continue;
      if (!isAerial && !isAquatic && inWater) continue;
      const baseH = evaluatePlanetaryTerrainHeight(ox, oz, env);
      const ySpawn = isAerial ? (baseH + 8.5 + (oi % 4) * 3.0) : (isAquatic ? (env.seaLevelM - 0.85) : baseH);
      surfaceOrganisms.push({
        id: `org-${sp.kingdom}-${oi}`,
        kind: sp.kingdom,
        kingdom: sp.kingdom,
        bodyPlan: sp.bodyPlan,
        morph: isAerial ? 'glider' : sp.bodyPlan,
        trophicGuild: sp.trophicGuild,
        speciesRecord: sp,
        developmentalGenome: sp.developmentalGenome || null,
        pos: [ox, ySpawn, oz],
        yaw: ang + 1.1,
        speed: isFauna ? (isAerial ? 5.2 : (sp.trophicGuild.includes('predator') ? 4.4 : 2.8 + (oi % 3) * 0.6)) : 0,
        phase: oi * 1.37,
        scale: isFauna
          ? (sp.traits?.scaleBase || 1.0) * (0.82 + (oi % 4) * 0.14)
          : (0.82 + (oi % 5) * 0.16) * (isFungi ? Math.sqrt(buck) : buck),
        primaryRgb: sp.primaryRgb,
        secondaryRgb: sp.secondaryRgb,
        accentRgb: sp.accentRgb,
        biolumRgb: sp.biolumRgb,
        biolumIntensity: sp.biolumIntensity,
        traits: sp.traits,
        abducting: false,
        abducted: false,
        seed: (sp.seed ^ Math.imul(oi + 17, 2654435761)) >>> 0
      });
    }
  }

  // Live WebGPU Multi-Trophic Surface Ecosystem AI (`surfaceEcosystemGpu.js`) &
  // Per-Planet WebGPU 3D SDF Flora Atlas Baker (`organismSdfMorphogenesisGpu.js`)!
  const surfaceEcoGpu = surfaceOrganisms.length > 0
    ? createSurfaceEcosystemGpu(device, { maxAgents: Math.max(32, surfaceOrganisms.length), label: `${label}-eco-ai` })
    : null;
  if (surfaceEcoGpu) {
    surfaceEcoGpu.seedAgents(surfaceOrganisms.map((o, idx) => ({
      pos: o.pos,
      yaw: o.yaw,
      speed: o.speed || 2.8,
      phase: o.phase || 0,
      gaitFreqHz: o.developmentalGenome?.gaitFreqHz || o.traits?.strouhalHz || 1.1,
      trophicGuild: o.trophicGuild,
      medium: o.developmentalGenome?.medium || (o.bodyPlan === 'aquatic-swimmer' ? 'aquatic' : ((o.bodyPlan === 'aero-gasbag' || o.bodyPlan === 'wing-glider') ? 'aerial' : 'terrestrial')),
      speciesIndex: idx,
      senseRangeM: 34.0,
      abducted: false
    })));
  }
  if (isSolidSurfaceBio && Array.isArray(xeno?.species) && xeno.species.some((s) => s.developmentalGenome)) {
    // Non-blocking GPU bake of THIS planet's unique developmental-genome flora/fungi into the hardware-instanced atlas!
    bakePlanetaryFloraAtlasWebGpu(device, xeno.species, {
      gridDim: 20,
      maxVertsPerSpecies: 1200,
      settlementFloats: buildSettlementTemplateFloats()
    }).then((atlas) => {
      if (!disposed && atlas?.floats?.length >= 24) {
        floraGpu.replaceTemplateMesh(atlas.floats);
      }
    }).catch(() => {});
  }

  // Restore saved surface exploration pose cleanly when returning from sampled L5/L6/L7 views!
  if (initialCheckpoint && typeof initialCheckpoint === 'object') {
    if (Array.isArray(initialCheckpoint.roverPos) && initialCheckpoint.roverPos.length === 3 && env.hasSolidCrust) {
      const rx = Number(initialCheckpoint.roverPos[0]) || 0;
      const rz = Number(initialCheckpoint.roverPos[2]) || 0;
      const ryaw = Number(initialCheckpoint.roverYaw) || rover.yaw;
      const sup = resolveRoverMultiWheelSupport(rx, rz, ryaw, cellSizeM, env);
      rover.pos = [rx, Math.max(sup.supportY, Number(initialCheckpoint.roverPos[1]) || sup.supportY), rz];
      rover.yaw = ryaw;
      rover.up = sup.normal;
      rover.onGround = initialCheckpoint.roverOnGround !== false;
      rover.deployed = Boolean(initialCheckpoint.roverDeployed ?? (initialCheckpoint.activeVehicle === 'rover'));
      rover.visible = rover.deployed;
    }
    if (Array.isArray(initialCheckpoint.dronePos) && initialCheckpoint.dronePos.length === 3) {
      drone.pos = [...initialCheckpoint.dronePos];
      drone.docked = Boolean(initialCheckpoint.droneDocked);
      if (Number.isFinite(Number(initialCheckpoint.droneYaw))) drone.yaw = Number(initialCheckpoint.droneYaw);
    }
    if (Array.isArray(initialCheckpoint.ufoPos) && initialCheckpoint.ufoPos.length === 3) {
      ufo.pos = [...initialCheckpoint.ufoPos];
      if (Number.isFinite(Number(initialCheckpoint.ufoYaw))) ufo.yaw = Number(initialCheckpoint.ufoYaw);
      if (Number.isFinite(Number(initialCheckpoint.ufoAltitudeKm)) && cfdSession) {
        const prof = cfdSession.profile;
        ufo.altitudeKm = Math.max(prof.minAltKm, Math.min(prof.maxAltKm, Number(initialCheckpoint.ufoAltitudeKm)));
      }
    }
    if (initialCheckpoint.activeVehicle === 'ufo') {
      activeVehicle = 'ufo';
      ufo.visible = true;
    } else if (initialCheckpoint.activeVehicle === 'drone') {
      activeVehicle = 'drone';
      drone.visible = true;
      drone.docked = false;
      ufo.visible = true;
    } else if (initialCheckpoint.activeVehicle === 'rover' && env.hasSolidCrust) {
      activeVehicle = 'rover';
      rover.visible = true;
      rover.deployed = true;
      drone.visible = true;
      ufo.visible = true; // Keep mothership hovering overhead!
    }
    if (initialCheckpoint.cameraMode === 'first-person' || initialCheckpoint.cameraMode === 'chase') {
      cameraMode = initialCheckpoint.cameraMode;
    }
    if (Number.isFinite(Number(initialCheckpoint.lookYawOffset))) lookYawOffset = Number(initialCheckpoint.lookYawOffset);
    if (Number.isFinite(Number(initialCheckpoint.lookPitch))) lookPitch = Math.max(-0.85, Math.min(1.15, Number(initialCheckpoint.lookPitch)));
    if (Number.isFinite(Number(initialCheckpoint.chaseDistScale))) chaseDistScale = Math.max(0.55, Math.min(2.4, Number(initialCheckpoint.chaseDistScale)));
  }
  let vehicleVertCount = 0;
  let fxVertCount = 0;
  let stepIndex = 0;
  let simTimeS = 0;
  let mapInFlight = false;
  let disposed = false;
  let lastCfdTelemetry = cfdSession ? cfdSession.getTelemetry() : null;

  let lastTelemetry = Object.freeze({
    schema: ULG_PLANETARY_SURFACE_SCHEMA,
    stepIndex: 0,
    activeVehicle,
    cameraMode,
    gravityMS2: env.gravityMS2,
    rhoAtmKgM3: env.rhoAtmKgM3,
    pressurePa: env.pressurePa,
    tempK: env.tempK,
    droneFlightCapable: env.droneFlightCapable,
    droneMaxAeroLiftN: env.maxAeroLiftN,
    droneAeroLiftN: 0,
    roverPos: [...rover.pos],
    roverSpeedMS: 0,
    roverAltitudeM: 0,
    roverRocketFuel: 1.0,
    roverOnGround: rover.onGround,
    dronePos: [...drone.pos],
    droneSpeedMS: 0,
    droneAltitudeM: drone.altitudeM,
    ufoPos: [...ufo.pos],
    ufoSpeedMS: 0,
    ufoAltitudeKm: ufo.altitudeKm,
    cfdActive: Boolean(cfdSession && (activeVehicle === 'ufo' || !env.hasSolidCrust)),
    cfdAvailable: Boolean(cfdSession),
    cfdTelemetry: lastCfdTelemetry,
    activePlumeParticles: 0,
    flameParticles: 0,
    dustParticles: 0,
    meanDustSpeedMS: 0,
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    scientificValidation: false
  });

  const wgGrid = Math.ceil(n / 8);
  const wgPlume = Math.ceil(pCount / 64);

  function setActiveVehicle(mode) {
    if (mode === 'rover' && env.hasSolidCrust) {
      if (!rover.deployed) {
        // Beam down the Rover straight underneath the hovering 60-ft UFO via the yellow conical tractor beam!
        const sup = resolveRoverMultiWheelSupport(ufo.pos[0], ufo.pos[2], ufo.yaw, cellSizeM, env);
        const defOff = deformMpm.evaluateDeformationOffset(ufo.pos[0], ufo.pos[2]);
        rover.pos = [ufo.pos[0], sup.supportY + defOff, ufo.pos[2]];
        rover.vel = [0, 0, 0];
        rover.yaw = ufo.yaw;
        rover.up = sup.normal;
        rover.onGround = true;
        rover.deployed = true;
        tractorAutoTimerS = 2.4;
      }
      activeVehicle = 'rover';
      rover.visible = true;
      drone.visible = true;
      ufo.visible = true; // Keep the 60-ft UFO hovering visibly overhead!
    } else if (mode === 'drone') {
      activeVehicle = 'drone';
      drone.visible = true;
      ufo.visible = true;
      if (drone.docked) {
        drone.docked = false;
        const srcPos = rover.deployed ? rover.pos : ufo.pos;
        const gh = env.hasSolidCrust ? deformMpm.evaluateGroundHeight(srcPos[0], srcPos[2]) : 0;
        const deployY = env.hasSolidCrust
          ? (rover.deployed ? (rover.pos[1] + 1.55) : (gh + 0.25))
          : (ufo.pos[1] - 4.0);
        drone.pos = [srcPos[0], deployY, srcPos[2]];
        drone.vel = [0, env.droneFlightCapable ? 3.2 : 0.0, 0];
        drone.yaw = rover.deployed ? rover.yaw : ufo.yaw;
        tractorAutoTimerS = 2.0;
      }
    } else if (mode === 'ufo') {
      activeVehicle = 'ufo';
      ufo.visible = true;
      tractorAutoTimerS = 0;
      ufo.yaw += lookYawOffset;
      lookYawOffset = 0;
      if (env.hasSolidCrust) {
        const refP = rover.deployed ? rover.pos : ufo.pos;
        const gh = deformMpm.evaluateGroundHeight(refP[0], refP[2]);
        ufo.pos = [ufo.pos[0], Math.max(gh + 20.0, ufo.pos[1]), ufo.pos[2]];
      }
    }
    return activeVehicle;
  }

  function triggerTractorPulse(durationS = 2.2) {
    tractorAutoTimerS = Math.max(tractorAutoTimerS, durationS);
  }

  function setTractorBeam(on) {
    tractorManualOn = Boolean(on);
    return tractorManualOn;
  }

  function setWeaponConfig({ mode, log10WavelengthM, powerW, maxPowerW } = {}) {
    if (mode === 'laser' || mode === 'missile' || mode === 'antimatter') weaponMode = mode;
    if (Number.isFinite(Number(maxPowerW))) maxWeaponPowerW = Math.max(1e12, Math.min(1e26, Number(maxPowerW)));
    if (Number.isFinite(Number(log10WavelengthM))) laserLog10WavelengthM = Math.max(-13.0, Math.min(1.0, Number(log10WavelengthM)));
    if (Number.isFinite(Number(powerW))) laserPowerW = Math.max(1e3, Math.min(maxWeaponPowerW, Number(powerW)));
    return { mode: weaponMode, log10WavelengthM: laserLog10WavelengthM, powerW: laserPowerW, maxPowerW: maxWeaponPowerW };
  }

  function computeDefaultForwardAimPoint() {
    const pose = getCameraPose();
    const dir = normalize3([pose.target[0] - pose.eye[0], pose.target[1] - pose.eye[1], pose.target[2] - pose.eye[2]]);
    const heading = ufo.yaw + lookYawOffset;
    const sy = Math.sin(heading);
    const cy = Math.cos(heading);
    if (cameraMode === 'chase' && env.hasSolidCrust) {
      // Aim visibly onto the sunlit canyon ridge ~125 m ahead of the hovering 60-ft saucer so 360° rim beams,
      // missiles, persistent molten lava craters & GPU MLS-MPM blast ejecta unfold cleanly in full perspective!
      const tx = ufo.pos[0] + sy * 125.0 + cy * 12.0;
      const tz = ufo.pos[2] + cy * 125.0 - sy * 12.0;
      const ty = deformMpm.evaluateGroundHeight(tx, tz);
      return [tx, ty, tz];
    }
    // Cockpit / first-person raymarch along exact pilot gaze ray against deformed surface heightfield!
    if (env.hasSolidCrust) {
      for (let t = 14.0; t <= 420.0; t += 4.0) {
        const px = pose.eye[0] + dir[0] * t;
        const py = pose.eye[1] + dir[1] * t;
        const pz = pose.eye[2] + dir[2] * t;
        const gy = deformMpm.evaluateGroundHeight(px, pz);
        if (py <= gy) return [px, gy, pz];
      }
    }
    const tx = ufo.pos[0] + sy * 72.0;
    const tz = ufo.pos[2] + cy * 72.0;
    const ty = env.hasSolidCrust ? deformMpm.evaluateGroundHeight(tx, tz) : (ufo.pos[1] - 18.0);
    return [tx, ty, tz];
  }

  function setWeaponFire({ firing, aimWorldPos = null } = {}) {
    weaponFiring = Boolean(firing);
    if (weaponFiring) tractorAutoTimerS = 0;
    if (Array.isArray(aimWorldPos) && aimWorldPos.length === 3) {
      weaponAimWorldPos = [...aimWorldPos];
    } else if (!weaponFiring) {
      weaponAimWorldPos = null;
    }
  }

  function launchMissile({ aimWorldPos = null, fromPos = null, vel = null, isRemote = false } = {}) {
    const target = Array.isArray(aimWorldPos) && aimWorldPos.length === 3
      ? [...aimWorldPos]
      : computeDefaultForwardAimPoint();
    let startPos = fromPos;
    if (!Array.isArray(startPos)) {
      const cy = Math.cos(ufo.yaw); const sy = Math.sin(ufo.yaw);
      const uFwd = [sy, 0, cy];
      const uRight = [cy, 0, -sy];
      startPos = computeUfoRimEmitPoint(ufo.pos, uRight, uFwd, UFO_RADIUS_M + 0.35, target);
    }
    const dir = normalize3([target[0] - startPos[0], target[1] - startPos[1], target[2] - startPos[2]]);
    const spd = 115.0;
    const m = {
      pos: [...startPos],
      vel: Array.isArray(vel) ? [...vel] : [dir[0] * spd + ufo.vel[0] * 0.35, dir[1] * spd, dir[2] * spd + ufo.vel[2] * 0.35],
      target,
      age: 0,
      alive: true,
      isRemote: Boolean(isRemote)
    };
    activeMissiles.push(m);
    if (activeMissiles.length > 16) activeMissiles.shift();
    return { pos: [...m.pos], vel: [...m.vel], target: [...target] };
  }

  function setExternalEntities({ remoteUfos = [], probes = [], shieldFlash = 0 } = {}) {
    externalRemoteUfos = Array.isArray(remoteUfos) ? remoteUfos : [];
    externalProbes = Array.isArray(probes) ? probes : [];
    externalShieldFlash = Math.max(0, Number(shieldFlash) || 0);
  }

  function drainPendingEvents() {
    const h = { ...pendingHarvest };
    pendingHarvest.silicates = 0; pendingHarvest.volatiles = 0; pendingHarvest.metals = 0; pendingHarvest.exotics = 0;
    const hits = pendingPeerHits.splice(0, pendingPeerHits.length);
    const abductions = pendingAbductions.splice(0, pendingAbductions.length);
    return { harvested: h, peerHits: hits, abductions };
  }

  function setUfoAltitudeKm(altKm) {
    if (!cfdSession) return ufo.altitudeKm;
    const prof = cfdSession.profile;
    ufo.altitudeKm = Math.max(prof.minAltKm, Math.min(prof.maxAltKm, Number(altKm) || prof.startAltKm));
    ufo.altitudeM = ufo.altitudeKm * 1000.0;
    return ufo.altitudeKm;
  }

  function getActiveSkyEnv() {
    if (cfdSession && (activeVehicle === 'ufo' || !env.hasSolidCrust)) {
      const chem = lastCfdTelemetry?.chemistry || evaluateAtmosphericChemistryAtAltitude(cfdSession.profile, ufo.altitudeKm);
      return {
        ...env,
        skyZenithRgb: chem.skyZenithRgb,
        skyHorizonRgb: chem.skyHorizonRgb,
        skyOpticalDepth: chem.opticalDepth
      };
    }
    return env;
  }

  function setCameraMode(mode) {
    cameraMode = mode === 'first-person' ? 'first-person' : 'chase';
    return cameraMode;
  }

  function addLookDelta(dYaw, dPitch) {
    const dy = Number(dYaw) || 0;
    if (activeVehicle === 'ufo') {
      // Keep the 60-ft Explorer UFO continuously rotated with the pilot's view direction!
      ufo.yaw += dy;
      lookYawOffset = 0;
    } else {
      lookYawOffset += dy;
    }
    lookPitch = Math.max(-0.85, Math.min(1.15, lookPitch + (Number(dPitch) || 0)));
  }

  function adjustChaseDistance(factor = 1.0) {
    const f = Number(factor);
    if (Number.isFinite(f) && f > 0.1) {
      // Allow zooming waaaay out from close-up (0.45x) to panoramic orbital overlook (18.0x)!
      chaseDistScale = Math.max(0.45, Math.min(18.0, chaseDistScale * f));
    }
    return chaseDistScale;
  }

  function getCheckpoint() {
    return Object.freeze({
      activeVehicle,
      cameraMode,
      roverPos: [...rover.pos],
      roverYaw: rover.yaw,
      roverOnGround: rover.onGround,
      roverDeployed: rover.deployed,
      dronePos: [...drone.pos],
      droneDocked: drone.docked,
      droneYaw: drone.yaw,
      ufoPos: [...ufo.pos],
      ufoYaw: ufo.yaw,
      ufoAltitudeKm: ufo.altitudeKm,
      lookYawOffset,
      lookPitch,
      chaseDistScale
    });
  }

  function integrateVehicles(dt, controls = {}) {
    const fwdIn = (controls.forward ? 1 : 0) - (controls.backward ? 1 : 0) + (Number(controls.moveY) || 0);
    const turnIn = (controls.right ? 1 : 0) - (controls.left ? 1 : 0) + (Number(controls.moveX) || 0);
    const jumpHeld = Boolean(controls.jump || controls.up);
    const downHeld = Boolean(controls.down);
    const turbo = Boolean(controls.turbo || controls.run);
    const yawIn = (controls.yawLeft ? 1 : 0) - (controls.yawRight ? 1 : 0);

    if (Math.abs(yawIn) > 0.01 && activeVehicle !== 'ufo') lookYawOffset += yawIn * 1.8 * dt;

    // Live wind vector: couple directly to live 3D WebGPU Navier-Stokes CFD velocity at craft when atmosphere is active!
    const cfdWind = lastCfdTelemetry?.craftWindMS;
    const windX = (cfdSession && cfdWind)
      ? cfdWind[0]
      : env.baseWindMS * Math.cos(simTimeS * 0.09 + 0.6);
    const windZ = (cfdSession && cfdWind)
      ? cfdWind[2]
      : env.baseWindMS * Math.sin(simTimeS * 0.09 + 0.6);

    // --- 1. INTEGRATE 6-WHEEL ROVER WITH JUMP ROCKETS (4x Swept Micro-Substeps + 6-Wheel Triangle Collision!) ---
    if (rover.visible) {
      const isCtrl = activeVehicle === 'rover';
      const driveCmd = isCtrl ? Math.max(-1, Math.min(1, fwdIn)) : 0;
      const steerCmd = isCtrl ? Math.max(-1, Math.min(1, turnIn)) : 0;
      const brakeCmd = isCtrl && downHeld;
      const subN = 4;
      const subDt = dt / subN;

      // Jump Rocket Thrusters (works in BOTH vacuum and atmosphere — Newton's 3rd Law!)
      const rocketAccel = Math.max(15.5, env.gravityMS2 * 2.55);
      const firingRocket = isCtrl && jumpHeld && rover.rocketFuel > 0.02;
      if (firingRocket) {
        if (rover.onGround) {
          rover.vel[1] = Math.max(rover.vel[1], 3.4);
          rover.pos[1] += 0.08;
        }
        rover.rocketThrottle = 1.0;
        rover.rocketFuel = Math.max(0, rover.rocketFuel - 0.32 * dt);
        rover.onGround = false;
      } else {
        rover.rocketThrottle = 0.0;
        if (rover.onGround) {
          rover.rocketFuel = Math.min(1.0, rover.rocketFuel + 0.26 * dt);
        }
      }

      const defFn = (qx, qz) => deformMpm.evaluateDeformationOffset(qx, qz);
      let lastSup = resolveRoverMultiWheelSupport(rover.pos[0], rover.pos[2], rover.yaw, cellSizeM, env, defFn);
      for (let s = 0; s < subN; s += 1) {
        const steerRate = rover.onGround ? 1.85 : 1.15;
        rover.yaw -= steerCmd * steerRate * subDt;
        const fx = Math.sin(rover.yaw);
        const fz = Math.cos(rover.yaw);
        const rx = fz;
        const rz = -fx;

        if (firingRocket) {
          rover.vel[1] += rocketAccel * subDt;
          rover.vel[0] += fx * driveCmd * 5.2 * subDt;
          rover.vel[2] += fz * driveCmd * 5.2 * subDt;
        }

        if (rover.onGround) {
          const maxSpd = turbo ? 28.0 : 17.5;
          const driveAccel = (turbo ? 42.0 : 28.0) * driveCmd;
          const n = lastSup.normal;
          // Project downhill gravity slope acceleration cleanly from 6-wheel contact plane normal
          rover.vel[0] += fx * driveAccel * subDt + n[0] * env.gravityMS2 * 0.55 * subDt;
          rover.vel[2] += fz * driveAccel * subDt + n[2] * env.gravityMS2 * 0.55 * subDt;

          const vFwd = rover.vel[0] * fx + rover.vel[2] * fz;
          const vLat = rover.vel[0] * rx + rover.vel[2] * rz;
          const latDamp = Math.exp(-9.0 * subDt);
          const fwdDamp = brakeCmd ? Math.exp(-9.5 * subDt) : (Math.abs(driveCmd) < 0.05 ? Math.exp(-4.4 * subDt) : Math.exp(-1.1 * subDt));
          const newVFwd = Math.max(-maxSpd * 0.6, Math.min(maxSpd, vFwd * fwdDamp));
          const newVLat = vLat * latDamp;
          rover.vel[0] = fx * newVFwd + rx * newVLat;
          rover.vel[2] = fz * newVFwd + rz * newVLat;
          rover.wheelAngle += (newVFwd / 0.34) * subDt;
        } else {
          // Real ballistic gravity + atmospheric quadratic drag
          rover.vel[1] -= env.gravityMS2 * subDt;
          const vMag = Math.hypot(rover.vel[0], rover.vel[1], rover.vel[2]);
          const dragA = 0.5 * env.rhoAtmKgM3 * 0.014 * vMag;
          rover.vel[0] += (windX - rover.vel[0]) * Math.min(0.4, dragA * subDt);
          rover.vel[2] += (windZ - rover.vel[2]) * Math.min(0.4, dragA * subDt);
        }

        const prevX = rover.pos[0];
        const prevZ = rover.pos[2];
        const candX = prevX + rover.vel[0] * subDt;
        const candZ = prevZ + rover.vel[2] * subDt;
        const candY = rover.pos[1] + rover.vel[1] * subDt;

        let nextSup = resolveRoverMultiWheelSupport(candX, candZ, rover.yaw, cellSizeM, env, defFn);

        // 1. Steep Cliff Wall Collision (`normal.y < 0.58` => >54 deg cliff face): block uphill penetration & slide!
        const hitSteepCliff = nextSup.normal[1] < 0.58 && (candY <= nextSup.supportY + 0.45);
        // 2. Liquid Ocean Shoreline Boundary: prevent terrestrial rover from sinking into OPEN liquid sea,
        //    while allowing driving straight across frozen winter sea ice (`liveSeaIceFrac >= 0.72`)!
        const hitOceanShore = env.hasLiquidOcean && liveSeaIceFrac < 0.72 && nextSup.anyUnderwater && !lastSup.anyUnderwater && (candY <= nextSup.supportY + 0.45);

        if (hitSteepCliff || hitOceanShore) {
          // Compute horizontal wall normal pointing away from cliff/ocean
          const wallNx = hitSteepCliff ? nextSup.normal[0] : (prevX - candX);
          const wallNz = hitSteepCliff ? nextSup.normal[2] : (prevZ - candZ);
          const wLen = Math.hypot(wallNx, wallNz) || 1.0;
          const wnx = wallNx / wLen;
          const wnz = wallNz / wLen;
          const vn = rover.vel[0] * wnx + rover.vel[2] * wnz;
          if (vn < 0) {
            rover.vel[0] -= vn * wnx * 1.25;
            rover.vel[2] -= vn * wnz * 1.25;
          }
          rover.pos[0] = prevX + wnx * 0.04;
          rover.pos[2] = prevZ + wnz * 0.04;
          nextSup = resolveRoverMultiWheelSupport(rover.pos[0], rover.pos[2], rover.yaw, cellSizeM, env, defFn);
        } else {
          rover.pos[0] = candX;
          rover.pos[2] = candZ;
        }
        rover.pos[1] = candY;

        // Exact 6-Wheel + Belly Zero-Penetration Contact Resolution!
        const gh = nextSup.supportY;
        const sn = nextSup.normal;
        if (rover.pos[1] <= gh + 0.03 && rover.vel[1] <= 0.15 && rover.rocketThrottle < 0.05) {
          rover.pos[1] = gh;
          // Follow downward terrain slope smoothly when grounded instead of flying off tiny bumps
          const slopeVy = -(rover.vel[0] * sn[0] + rover.vel[2] * sn[2]) / Math.max(0.35, sn[1]);
          rover.vel[1] = Math.min(0.0, slopeVy);
          rover.onGround = true;
        } else if (rover.pos[1] < gh) {
          rover.pos[1] = gh;
          // Project out into-ground normal velocity on hard landing (damped rocker-bogie suspension!)
          const vDotN = rover.vel[0] * sn[0] + rover.vel[1] * sn[1] + rover.vel[2] * sn[2];
          if (vDotN < 0) {
            rover.vel[0] -= vDotN * sn[0] * 0.35;
            rover.vel[1] -= vDotN * sn[1];
            rover.vel[2] -= vDotN * sn[2] * 0.35;
          }
          if (rover.vel[1] < 0) rover.vel[1] = 0;
          rover.onGround = rover.rocketThrottle < 0.05;
        } else if (rover.pos[1] > gh + 0.18) {
          rover.onGround = false;
        }

        // Smoothly align rocker-bogie chassis normal directly to exact 6-wheel contact plane normal!
        const targetUp = rover.onGround ? sn : [0, 1, 0];
        const blend = Math.min(1, subDt * 12.0);
        rover.up = normalize3([
          rover.up[0] + (targetUp[0] - rover.up[0]) * blend,
          rover.up[1] + (targetUp[1] - rover.up[1]) * blend,
          rover.up[2] + (targetUp[2] - rover.up[2]) * blend
        ]);
        lastSup = nextSup;
      }

      rover.altitudeM = Math.max(0, rover.pos[1] - lastSup.supportY);
      rover.speedMS = Math.hypot(rover.vel[0], rover.vel[1], rover.vel[2]);
    }

    // --- 2. INTEGRATE COAXIAL ATMOSPHERIC DRONE ---
    if (drone.docked && rover.visible) {
      // Perched cleanly on Rover helipad deck!
      const cy = Math.cos(rover.yaw); const sy = Math.sin(rover.yaw);
      drone.pos = [
        rover.pos[0] + rover.up[0] * 1.30 - sy * 0.35,
        rover.pos[1] + rover.up[1] * 1.30,
        rover.pos[2] + rover.up[2] * 1.30 - cy * 0.35
      ];
      drone.vel = [...rover.vel];
      drone.yaw = rover.yaw;
      drone.pitch = 0;
      drone.roll = 0;
      drone.throttle = 0;
      drone.aeroLiftN = 0;
      drone.altitudeM = rover.altitudeM + 1.24;
      drone.speedMS = rover.speedMS;
    } else {
      const isCtrl = activeVehicle === 'drone';
      const fwdCmd = isCtrl ? Math.max(-1, Math.min(1, fwdIn)) : 0;
      const strafeCmd = isCtrl ? Math.max(-1, Math.min(1, turnIn)) : 0;
      const upCmd = isCtrl ? ((jumpHeld ? 1 : 0) - (downHeld ? 1 : 0)) : 0;
      if (isCtrl && Math.abs(yawIn) > 0.01) {
        drone.yaw += yawIn * 1.8 * dt;
      }

      // Compute exact actuator-disk aerodynamic lift strictly proportional to `env.rhoAtmKgM3`!
      // Hover throttle = W / T_max (strictly impossible in vacuum where maxAeroLiftN == 0!)
      let targetThrottle = 0.0;
      if (env.droneFlightCapable) {
        const hoverFrac = Math.min(0.88, env.droneWeightN / Math.max(1e-6, env.maxAeroLiftN));
        targetThrottle = Math.max(0.05, Math.min(1.0, hoverFrac + upCmd * (turbo ? 0.45 : 0.32)));
      } else {
        // Vacuum: rotors spin if user tries to ascend, yet produce EXACTLY 0 N aerodynamic lift!
        targetThrottle = jumpHeld ? 0.65 : 0.0;
      }
      drone.throttle += (targetThrottle - drone.throttle) * Math.min(1, dt * 7.5);
      drone.aeroLiftN = env.maxAeroLiftN * drone.throttle; // EXACT 0.0 N when rho_atm === 0!

      const rpmSpeed = 24.0 * Math.max(0.15, drone.throttle);
      drone.rotorAngle = (drone.rotorAngle + rpmSpeed * dt) % (Math.PI * 2);

      // Desired forward/right flight axes aligned with camera/drone heading
      // Right-handed Y-up screen right = cross(fwd, up) = (-cos(h), 0, +sin(h)) = (-fz, 0, +fx)!
      const heading = drone.yaw + (isCtrl ? lookYawOffset : 0);
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const rx = -fz;
      const rz = fx;

      // Tilt drone nose/bank proportionally to horizontal aerodynamic thrust command
      const maxTilt = turbo ? 0.36 : 0.24;
      const targetPitch = env.droneFlightCapable ? fwdCmd * maxTilt : 0;
      const targetRoll = env.droneFlightCapable ? -strafeCmd * maxTilt : 0;
      drone.pitch += (targetPitch - drone.pitch) * Math.min(1, dt * 8.0);
      drone.roll += (targetRoll - drone.roll) * Math.min(1, dt * 8.0);

      // Vertical acceleration: exact (F_aero_lift * cos(tilt) - m*g) / m + ground-effect cushion + aerodynamic vertical damping!
      const ghD = evaluatePlanetaryTerrainHeight(drone.pos[0], drone.pos[2], env);
      const altNow = Math.max(0, drone.pos[1] - ghD);
      const groundEffect = (env.droneFlightCapable && altNow < 3.0) ? (1.0 + 0.16 * (1.0 - altNow / 3.0)) : 1.0;
      const vertLiftAccel = (drone.aeroLiftN * groundEffect * Math.cos(drone.pitch) * Math.cos(drone.roll)) / env.droneMassKg;
      // Gentle vertical aerodynamic damping + flight-controller climb governor (prevents runaway stratospheric climb on dense Titan!)
      const pidHold = (env.droneFlightCapable && upCmd === 0) ? (-drone.vel[1] * 2.8) : 0.0;
      const aeroVertDrag = env.droneFlightCapable ? (-drone.vel[1] * (1.45 + Math.min(2.5, env.rhoAtmKgM3 * 0.35))) : 0.0;
      const clampedNetLift = env.droneFlightCapable ? Math.min(18.0, vertLiftAccel - env.gravityMS2) : (vertLiftAccel - env.gravityMS2);
      drone.vel[1] += (clampedNetLift + pidHold + aeroVertDrag) * dt;
      drone.vel[1] = Math.max(-14.0, Math.min(10.5, drone.vel[1]));

      // Horizontal aerodynamic thrust from tilted rotor disk + live atmospheric wind coupling!
      if (env.droneFlightCapable) {
        const horizThrust = (turbo ? 32.0 : 20.0);
        drone.vel[0] += (fx * fwdCmd + rx * strafeCmd) * horizThrust * dt;
        drone.vel[2] += (fz * fwdCmd + rz * strafeCmd) * horizThrust * dt;
      }
      // Atmospheric aerodynamic drag toward live wind vector `v_wind`!
      const airDrag = Math.max(0.25, Math.min(3.5, 0.85 + env.rhoAtmKgM3 * 0.45));
      if (env.rhoAtmKgM3 > 1e-4) {
        drone.vel[0] += (windX * 0.45 - drone.vel[0]) * Math.min(0.85, airDrag * dt);
        drone.vel[2] += (windZ * 0.45 - drone.vel[2]) * Math.min(0.85, airDrag * dt);
      }

      drone.pos[0] += drone.vel[0] * dt;
      drone.pos[1] += drone.vel[1] * dt;
      drone.pos[2] += drone.vel[2] * dt;

      const ghNext = Math.max(
        evaluateRenderedTerrainTriangleHeight(drone.pos[0], drone.pos[2], cellSizeM, env),
        evaluatePlanetaryTerrainHeight(drone.pos[0], drone.pos[2], env)
      );
      const minFloor = env.hasSolidCrust ? (ghNext + 0.06) : (ghNext + 6.0);
      if (drone.pos[1] < minFloor) {
        drone.pos[1] = minFloor;
        if (drone.vel[1] < 0) drone.vel[1] = 0;
        drone.vel[0] *= Math.exp(-5.0 * dt);
        drone.vel[2] *= Math.exp(-5.0 * dt);
      }
      drone.altitudeM = Math.max(0, drone.pos[1] - ghNext);
      drone.speedMS = Math.hypot(drone.vel[0], drone.vel[1], drone.vel[2]);
    }

    // --- 3. INTEGRATE 60-FOOT UNIVERSAL FLYING SAUCER UFO (ALL WORLDS: 3D CFD COUPLED IN AIR + INERTIAL ANTI-GRAV IN VACUUM!) ---
    if (ufo.visible) {
      const isCtrl = activeVehicle === 'ufo';
      const fwdCmd = isCtrl ? Math.max(-1, Math.min(1, fwdIn)) : 0;
      const strafeCmd = isCtrl ? Math.max(-1, Math.min(1, turnIn)) : 0;
      const upCmd = isCtrl ? ((jumpHeld ? 1 : 0) - (downHeld ? 1 : 0)) : 0;
      if (isCtrl) {
        if (Math.abs(yawIn) > 0.01) {
          ufo.yaw += yawIn * 1.8 * dt;
        }
        // Keep UFO smoothly aligned with the active view heading (no decoupled orbit drift!)
        if (Math.abs(lookYawOffset) > 1e-4) {
          ufo.yaw += lookYawOffset;
          lookYawOffset = 0;
        }
      }
      ufo.vertThrust += (upCmd - ufo.vertThrust) * Math.min(1, dt * 8.0);
      ufo.rimAngle = (ufo.rimAngle + (2.4 + Math.abs(ufo.vertThrust) * 4.5 + Math.hypot(fwdCmd, strafeCmd) * 3.0) * dt) % (Math.PI * 2);

      // Right-handed Y-up screen right = cross(fwd, up) = (-cos(h), 0, +sin(h)) = (-fz, 0, +fx)!
      const heading = ufo.yaw;
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const rx = -fz;
      const rz = fx;

      // Live 3D GPU Navier-Stokes CFD velocity sampled directly at the UFO's 3D location (0 in vacuum!)
      const cfdW = (cfdSession && lastCfdTelemetry?.craftWindMS) ? lastCfdTelemetry.craftWindMS : [0, 0, 0];
      const maxBank = turbo ? 0.30 : 0.19;
      ufo.pitch += (fwdCmd * maxBank - ufo.pitch) * Math.min(1, dt * 6.5);
      ufo.roll += (strafeCmd * maxBank + Math.max(-0.14, Math.min(0.14, -cfdW[0] * 0.006)) - ufo.roll) * Math.min(1, dt * 6.5);

      const horizThrust = turbo ? 72.0 : 42.0;
      const vertThrustAccel = turbo ? 42.0 : 24.0;
      const aeroCoupling = cfdSession ? 1.15 : 1.45;
      ufo.vel[0] += ((fx * fwdCmd + rx * strafeCmd) * horizThrust + (cfdW[0] * 0.45 - ufo.vel[0]) * aeroCoupling) * dt;
      ufo.vel[2] += ((fz * fwdCmd + rz * strafeCmd) * horizThrust + (cfdW[2] * 0.45 - ufo.vel[2]) * aeroCoupling) * dt;
      ufo.vel[1] += (upCmd * vertThrustAccel + (cfdW[1] * 0.55 - ufo.vel[1]) * 1.65) * dt;

      ufo.pos[0] += ufo.vel[0] * dt;
      ufo.pos[1] += ufo.vel[1] * dt;
      ufo.pos[2] += ufo.vel[2] * dt;

      if (cfdSession) {
        const prof = cfdSession.profile;
        const kmRate = prof.isDeepFluid ? (turbo ? 18.0 : 9.5) : (turbo ? 4.2 : 2.2);
        ufo.altitudeKm = Math.max(
          prof.minAltKm,
          Math.min(prof.maxAltKm, ufo.altitudeKm + (upCmd * kmRate + cfdW[1] * 0.08) * dt)
        );
      }
      if (env.hasSolidCrust) {
        const ghUfo = deformMpm.evaluateGroundHeight(ufo.pos[0], ufo.pos[2]);
        if (ufo.pos[1] < ghUfo + 6.5) {
          ufo.pos[1] = ghUfo + 6.5;
          if (ufo.vel[1] < 0) ufo.vel[1] = 0;
        }
        ufo.altitudeM = Math.max(0, ufo.pos[1] - ghUfo);
      } else {
        ufo.altitudeM = ufo.altitudeKm * 1000.0;
      }
      ufo.speedMS = Math.hypot(ufo.vel[0], ufo.vel[1], ufo.vel[2]);
    }

    return { windX, windZ };
  }

  function getCameraPose() {
    const isUfo = activeVehicle === 'ufo';
    const isDrone = activeVehicle === 'drone';
    const vehPos = isUfo ? ufo.pos : (isDrone ? drone.pos : rover.pos);
    const baseYaw = (isUfo ? ufo.yaw : (isDrone ? drone.yaw : rover.yaw)) + lookYawOffset;
    const cp = Math.cos(lookPitch);
    const sp = Math.sin(lookPitch);
    const sy = Math.sin(baseYaw);
    const cy = Math.cos(baseYaw);

    if (cameraMode === 'first-person') {
      // True inside-the-emerald-glass-dome 3D Cockpit View (or Rover Mastcam-Z / Drone nose cam)!
      const eyeH = isUfo ? 3.15 : (isDrone ? 0.55 : 2.28);
      const fwdOff = isUfo ? 2.65 : 0.55;
      const eye = [vehPos[0] + sy * fwdOff, vehPos[1] + eyeH, vehPos[2] + cy * fwdOff];
      const target = [eye[0] + sy * cp * 32.0, eye[1] - sp * 32.0 - (isUfo ? 2.8 : 0), eye[2] + cy * cp * 32.0];
      return { eye, target, up: [0, 1, 0], focusPos: vehPos };
    }
    // Dynamic 3rd-person chase camera properly framed for our 60-foot (18.3 m) UFO or 2.8 m Rover!
    // Elevating cleanly above the emerald glass dome gives a wide, unobstructed view of canyons,
    // boulders, 360° rim lasers, missiles, & molten blast craters right ahead of the saucer!
    const baseDist = isUfo ? 36.0 : (isDrone ? 9.5 : 11.5);
    const dist = baseDist * chaseDistScale;
    const eyeX = vehPos[0] - sy * cp * dist;
    const eyeZ = vehPos[2] - cy * cp * dist;
    let eyeY = vehPos[1] + (isUfo ? 16.5 : 2.8) + sp * dist;
    if (env.hasSolidCrust) {
      const ghEye = deformMpm.evaluateGroundHeight(eyeX, eyeZ);
      eyeY = Math.max(ghEye + 2.4, eyeY);
    }
    const target = isUfo
      ? [vehPos[0] + sy * 54.0, vehPos[1] - 5.5, vehPos[2] + cy * 54.0]
      : [vehPos[0] + sy * 2.5, vehPos[1] + (isDrone ? 0.8 : 1.45), vehPos[2] + cy * 2.5];
    return { eye: [eyeX, eyeY, eyeZ], target, up: [0, 1, 0], focusPos: vehPos };
  }

  let liveSeaIceFrac = landingSite?.isPolarIce ? 0.95 : 0.0;
  let liveSnowlineM = landingSite?.isPolarIce ? -45.0 : env.terrainAmpM * 0.56;
  let liveAutumnShift = 0.0;
  let lastClimate = null;

  async function step({ dt = 0.016, controls = {}, climate = null, readTelemetry = true } = {}) {
    if (disposed) return lastTelemetry;
    if (climate && typeof climate === 'object') lastClimate = climate;
    const dtSafe = Math.max(0.004, Math.min(0.045, Number(dt) || 0.016));
    simTimeS += dtSafe;
    stepIndex += 1;

    if (climate && typeof climate === 'object') {
      if (Number.isFinite(Number(climate.iceCoverFrac))) {
        liveSeaIceFrac = Math.max(landingSite?.isPolarIce ? 0.90 : 0, Math.min(1, Number(climate.iceCoverFrac)));
      }
      if (Number.isFinite(Number(climate.snowlineM))) {
        liveSnowlineM = landingSite?.isPolarIce ? Math.min(-35.0, Number(climate.snowlineM)) : Number(climate.snowlineM);
      }
      if (Number.isFinite(Number(climate.autumnShift))) liveAutumnShift = Math.max(0, Math.min(1, Number(climate.autumnShift)));
    }

    const { windX, windZ } = integrateVehicles(dtSafe, controls);
    const focus = activeVehicle === 'ufo' ? ufo.pos : (activeVehicle === 'drone' ? drone.pos : rover.pos);
    // Snap inner (+-608 m) & outer (+-6 km) clipmap origins to integer cell multiples so mountains NEVER shimmer!
    const snapX = Math.round(focus[0] / cellSizeM) * cellSizeM;
    const snapZ = Math.round(focus[2] / cellSizeM) * cellSizeM;
    const outerSnapX = Math.round(focus[0] / outerCellSizeM) * outerCellSizeM;
    const outerSnapZ = Math.round(focus[2] / outerCellSizeM) * outerCellSizeM;

    const modeFlags = (env.hasSolidCrust ? 1 : 0)
      | (env.isMagmaOcean ? 2 : 0)
      | (env.isCryoMoon ? 4 : 0)
      | (env.hasLiquidOcean ? 8 : 0)
      | (env.isComet ? 16 : 0)
      | (hasSphPatch ? 32 : 0);
    const seedF = ((env.seed % 997) * 0.13) + 1.7;
    const curvInv2R = env.hasSolidCrust ? (1.0 / (2.0 * env.tinyPlanetCurvatureRadiusM)) : 0.0;

    const effectiveSeaLevelM = env.hasSolidCrust ? env.seaLevelM : (ufo.pos[1] - 42.0);
    const effectiveCurvInv2R = env.hasSolidCrust
      ? (1.0 / (2.0 * env.tinyPlanetCurvatureRadiusM))
      : (1.0 / (2.0 * 9500.0));

    const ab = new ArrayBuffer(192);
    new Uint32Array(ab, 0, 4).set([n, pCount, modeFlags, stepIndex]);
    new Float32Array(ab, 16, 44).set([
      snapX, snapZ, cellSizeM, seedF,
      env.terrainAmpM, env.craterStrength, effectiveSeaLevelM, effectiveCurvInv2R,
      env.gravityMS2, env.rhoAtmKgM3, windX, windZ,
      dtSafe, rover.rocketThrottle, rover.speedMS, drone.throttle,
      rover.pos[0], rover.pos[1], rover.pos[2], rover.yaw,
      drone.pos[0], drone.pos[1], drone.pos[2], env.droneThrustToWeight,
      env.color0[0], env.color0[1], env.color0[2], focus[0],
      env.color1[0], env.color1[1], env.color1[2], focus[2],
      env.oceanRgb[0], env.oceanRgb[1], env.oceanRgb[2], liveSeaIceFrac,
      liveSnowlineM, outerCellSizeM, activeGeoWorldSpanM, outerSnapX,
      outerSnapZ, hasSphPatch ? (env.sphSeaLevelNorm || 0.0) : 0.42, OCEAN_PATCH_HALF_M, liveAutumnShift
    ]);
    device.queue.writeBuffer(paramsBuf, 0, ab);

    // 1. Step Tractor Beam, 64 Rigid-Body Boulders, Rim-Launched Missiles, & Active EM Laser / Antimatter Beam!
    tractorAutoTimerS = Math.max(0, tractorAutoTimerS - dtSafe);
    antimatterFlash = Math.max(0, antimatterFlash - dtSafe * 2.8);
    const tractorActive = Boolean(tractorManualOn || tractorAutoTimerS > 0.01);
    const groundBelowUfo = env.hasSolidCrust ? deformMpm.evaluateGroundHeight(ufo.pos[0], ufo.pos[2]) : (ufo.pos[1] - 28.0);
    const tractorGroundPos = [ufo.pos[0], groundBelowUfo, ufo.pos[2]];
    const tractorHeight = Math.max(4.0, ufo.pos[1] - groundBelowUfo);

    const boulderRes = deformMpm.stepRigidBouldersAndUpload(dtSafe, {
      tractorActive: tractorActive && ufo.visible,
      tractorOrigin: ufo.pos,
      curvInv2R,
      refX: focus[0],
      refZ: focus[2]
    });
    pendingHarvest.silicates += boulderRes.harvested.silicates;
    pendingHarvest.volatiles += boulderRes.harvested.volatiles;
    pendingHarvest.metals += boulderRes.harvested.metals;
    pendingHarvest.exotics += boulderRes.harvested.exotics;

    // 1B. Step Live Ecological Food Web (Flora, Fungi, Grazers, Predators, Aerial Sky-Leviathans & Swimmers) + Tractor Abduction!
    let activeAbductionTarget = null;
    if (surfaceOrganisms.length > 0) {
      let bestOrg = null;
      let bestScore = 1e9;
      if (tractorActive && ufo.visible) {
        for (const org of surfaceOrganisms) {
          if (org.abducted) continue;
          const dx = org.pos[0] - ufo.pos[0];
          const dz = org.pos[2] - ufo.pos[2];
          const hd = Math.hypot(dx, dz);
          if (hd < 44.0) {
            const sc = hd * (org.kingdom === 'fauna' ? 0.84 : (org.kingdom === 'fungi' ? 0.92 : 1.0));
            if (sc < bestScore) { bestScore = sc; bestOrg = org; }
          }
        }
      }
      const cfdW = (cfdSession && lastCfdTelemetry?.craftWindMS) ? lastCfdTelemetry.craftWindMS : [0, 0, 0];
      for (const org of surfaceOrganisms) {
        if (org.abducted) continue;
        org.phase += dtSafe;
        if (org === bestOrg) {
          org.abducting = true;
          org.arousal = 1.1;
          activeAbductionTarget = org;
          const toUfoX = ufo.pos[0] - org.pos[0];
          const toUfoY = (ufo.pos[1] - 1.2) - org.pos[1];
          const toUfoZ = ufo.pos[2] - org.pos[2];
          const d3 = Math.hypot(toUfoX, toUfoY, toUfoZ);
          if (d3 <= 4.8) {
            org.abducted = true;
            org.abducting = false;
            const rec = synthesizeAbductedSpecimenRecord({
              kind: org.kingdom || org.kind,
              speciesRecord: org.speciesRecord || null,
              worldName: bodySpec?.name || 'Exoplanet',
              env,
              xeno: env.xenobiology,
              latDeg: climate?.observerLatDeg ?? landingSite?.latDeg ?? 32.0,
              lonDeg: (landingSite?.lonDeg ?? 0.0) + (climate?.observerLonOffsetDeg ?? 0.0),
              seed: org.seed
            });
            abductedSpecimens.push(rec);
            pendingAbductions.push(rec);
            continue;
          }
          const pullSpd = 26.0;
          const invD3 = 1.0 / Math.max(0.1, d3);
          const vyPull = toUfoY > 1.5
            ? Math.max(4.5, toUfoY * invD3 * pullSpd)
            : toUfoY * invD3 * pullSpd;
          org.pos[0] += toUfoX * invD3 * pullSpd * dtSafe;
          org.pos[1] += vyPull * dtSafe;
          org.pos[2] += toUfoZ * invD3 * pullSpd * dtSafe;
          org.yaw += 2.6 * dtSafe;
        } else {
          org.abducting = false;
          org.arousal = Math.max(0, (org.arousal || 0) - dtSafe * 0.6);
          if (org.kingdom === 'fauna' || org.kind === 'fauna') {
            const isAir = org.bodyPlan === 'aero-gasbag' || org.bodyPlan === 'wing-glider' || !env.hasSolidCrust;
            const isSwim = org.bodyPlan === 'aquatic-swimmer';
            const isPred = String(org.trophicGuild || '').includes('predator');
            let steerYaw = org.yaw + Math.sin(org.phase * 0.45 + org.seed * 0.001) * 0.42 * dtSafe;
            let spdMul = 1.0;

            // Trophic ecological AI: flee overhead tractor beam; predators stalk grazers; grazers flee predators & forage near flora!
            const dUfo = Math.hypot(org.pos[0] - ufo.pos[0], org.pos[2] - ufo.pos[2]);
            if (tractorActive && dUfo < 44.0) {
              steerYaw = Math.atan2(org.pos[0] - ufo.pos[0], org.pos[2] - ufo.pos[2]);
              spdMul = 1.55;
              org.arousal = 0.85;
            } else if (!isAir && !isSwim) {
              let bestTarget = null;
              let bestD = 38.0;
              for (const other of surfaceOrganisms) {
                if (other === org || other.abducted) continue;
                const d = Math.hypot(other.pos[0] - org.pos[0], other.pos[2] - org.pos[2]);
                if (d >= bestD) continue;
                if (isPred && other.kingdom === 'fauna' && !String(other.trophicGuild || '').includes('predator')) {
                  bestD = d; bestTarget = { x: other.pos[0], z: other.pos[2], flee: false };
                } else if (!isPred && other.kingdom === 'fauna' && String(other.trophicGuild || '').includes('predator') && d < 24.0) {
                  bestD = d; bestTarget = { x: other.pos[0], z: other.pos[2], flee: true };
                } else if (!isPred && !bestTarget && (other.kingdom === 'flora' || other.kingdom === 'fungi') && d > 5.0 && d < 26.0) {
                  bestTarget = { x: other.pos[0], z: other.pos[2], flee: false };
                }
              }
              if (bestTarget) {
                const angT = bestTarget.flee
                  ? Math.atan2(org.pos[0] - bestTarget.x, org.pos[2] - bestTarget.z)
                  : Math.atan2(bestTarget.x - org.pos[0], bestTarget.z - org.pos[2]);
                steerYaw = org.yaw + Math.sin(angT - org.yaw) * Math.min(1, dtSafe * 2.6);
                if (bestTarget.flee || isPred) { spdMul = 1.38; org.arousal = 0.65; }
              }
            }
            org.yaw = steerYaw;
            const vx = Math.sin(org.yaw) * org.speed * spdMul + (isAir ? cfdW[0] * 0.35 : 0);
            const vz = Math.cos(org.yaw) * org.speed * spdMul + (isAir ? cfdW[2] * 0.35 : 0);
            const nx = org.pos[0] + vx * dtSafe;
            const nz = org.pos[2] + vz * dtSafe;
            if (!env.hasSolidCrust) {
              // Gas-giant cloud-deck sky-leviathans drift smoothly in 3D CFD updrafts around UFO!
              if (Math.hypot(nx - focus[0], nz - focus[2]) > 240.0) org.yaw = Math.atan2(focus[0] - org.pos[0], focus[2] - org.pos[2]);
              org.pos[0] = nx;
              org.pos[2] = nz;
              const targetY = focus[1] - 4.0 + Math.sin(org.phase * 0.9 + org.seed * 0.01) * 14.0 + cfdW[1] * 0.5;
              org.pos[1] += (targetY - org.pos[1]) * Math.min(1, dtSafe * 1.4);
            } else {
              const gh = deformMpm.evaluateGroundHeight(nx, nz);
              const inWater = env.hasLiquidOcean && gh <= env.seaLevelM + 0.35;
              const badTerrain = (isSwim && !inWater) || (!isAir && !isSwim && inWater) || Math.hypot(nx - focus[0], nz - focus[2]) > 280.0;
              if (badTerrain) {
                org.yaw += 1.55;
              } else {
                org.pos[0] = nx;
                org.pos[2] = nz;
                const targetY = isAir
                  ? (gh + 9.0 + Math.sin(org.phase * 1.3) * 2.4)
                  : (isSwim ? (env.seaLevelM - 0.85) : gh);
                org.pos[1] += (targetY - org.pos[1]) * Math.min(1, dtSafe * 7.0);
              }
            }
          } else if (env.hasSolidCrust) {
            const gh = deformMpm.evaluateGroundHeight(org.pos[0], org.pos[2]);
            if (org.pos[1] > gh + 0.05) {
              org.pos[1] = Math.max(gh, org.pos[1] - 12.0 * dtSafe);
            }
          }
        }
      }
    }

    // 2. Integrate Active Rim-Launched Guided Missiles -> Terrain / Boulder / Remote-UFO Detonation + GPU MLS-MPM Blast!
    for (let mi = activeMissiles.length - 1; mi >= 0; mi -= 1) {
      const m = activeMissiles[mi];
      if (!m.alive) { activeMissiles.splice(mi, 1); continue; }
      m.age += dtSafe;
      // Guided proportional homing toward target point with gentle gravity arc!
      if (Array.isArray(m.target) && m.target.length === 3) {
        const tx = m.target[0] - m.pos[0];
        const ty = m.target[1] - m.pos[1];
        const tz = m.target[2] - m.pos[2];
        const dT = Math.hypot(tx, ty, tz);
        if (dT > 1.5) {
          const desiredSpd = 128.0;
          const steer = Math.min(1.0, dtSafe * 7.5);
          m.vel[0] += ((tx / dT) * desiredSpd - m.vel[0]) * steer;
          m.vel[1] += ((ty / dT) * desiredSpd - m.vel[1]) * steer;
          m.vel[2] += ((tz / dT) * desiredSpd - m.vel[2]) * steer;
        }
      }
      m.vel[1] -= env.gravityMS2 * 0.18 * dtSafe;
      m.pos[0] += m.vel[0] * dtSafe;
      m.pos[1] += m.vel[1] * dtSafe;
      m.pos[2] += m.vel[2] * dtSafe;

      let hitPos = null;
      if (Array.isArray(m.target) && m.target.length === 3) {
        const dTgt = Math.hypot(m.pos[0] - m.target[0], m.pos[1] - m.target[1], m.pos[2] - m.target[2]);
        if (dTgt < 4.0) hitPos = [...m.target];
      }
      // Check remote multiplayer UFO hit!
      if (!m.isRemote) {
        for (const ru of externalRemoteUfos) {
          if (!Array.isArray(ru.pos)) continue;
          const dRu = Math.hypot(m.pos[0] - ru.pos[0], m.pos[1] - ru.pos[1], m.pos[2] - ru.pos[2]);
          if (dRu < UFO_RADIUS_M + 3.0) {
            hitPos = [...m.pos];
            pendingPeerHits.push({ targetPeerId: ru.peerId, weapon: 'missile', damage: 28, wavelengthNm: 620 });
            break;
          }
        }
      }
      // Check rigid boulder impact!
      if (!hitPos) {
        for (const b of deformMpm.boulders) {
          if (!b.alive) continue;
          const dB = Math.hypot(m.pos[0] - b.pos[0], m.pos[1] - b.pos[1], m.pos[2] - b.pos[2]);
          if (dB < b.radius + 1.8) { hitPos = [...m.pos]; break; }
        }
      }
      // Check terrain impact or fuse expiry!
      const gyM = env.hasSolidCrust ? deformMpm.evaluateGroundHeight(m.pos[0], m.pos[2]) : (ufo.pos[1] - 42.0);
      if (!hitPos && (m.pos[1] <= gyM + 0.6 || m.age > 5.5)) {
        hitPos = [m.pos[0], Math.max(gyM, m.pos[1]), m.pos[2]];
      }
      if (hitPos) {
        m.alive = false;
        deliveredWeaponEnergyJ += 4.0e12;
        if (deliveredWeaponEnergyJ >= 0.85 * bodyBindingEnergyJ) {
          shatterTriggered = true;
        }
        if (env.hasLiquidOcean && evaluatePlanetaryCrustElevation(hitPos[0], hitPos[2], env) <= env.seaLevelM + 1.0) {
          oceanWaveGpu.queueSplashImpulse(hitPos[0], hitPos[2], -1.8, 22.0);
        }
        const harv = deformMpm.applyBlastOrHeatStamp({
          kind: 1,
          pos: hitPos,
          radiusM: 14.5,
          depthM: 5.2,
          tempK: 2850,
          melt: 0.78,
          char: 0.92,
          blastImpulse: 185000,
          ejectaCount: 220,
          ejectaRgb: [1.0, 0.56, 0.16],
          ejectaRole: 0.0
        });
        const oreMul = env.isMetallicAsteroid ? 4.0 : (env.isComet ? 2.5 : 1.0);
        pendingHarvest.silicates += (harv.silicates + 10) * oreMul;
        pendingHarvest.metals += (harv.metals + 6) * oreMul;
        pendingHarvest.volatiles += (harv.volatiles + (env.isComet ? 16 : 4)) * oreMul;
        pendingHarvest.exotics += harv.exotics;
        lastWeaponReaction = {
          weapon: 'missile',
          phaseState: shatterTriggered ? 'BINDING ENERGY EXCEEDED' : 'Shock Detonation',
          reactionOutcome: `Thermobaric impact crater (R=14.5 m · GPU MLS-MPM ejecta + boulder shockwave)`
        };
      }
    }

    // 3. Evaluate Active 360° Rim EM Laser OR Antimatter Annihilation Beam!
    let activeBeam = null;
    if (weaponFiring && ufo.visible && (weaponMode === 'laser' || weaponMode === 'antimatter')) {
      const targetPos = Array.isArray(weaponAimWorldPos) ? weaponAimWorldPos : computeDefaultForwardAimPoint();
      // Check if firing directly at a remote multiplayer UFO!
      let hitRemote = null;
      for (const ru of externalRemoteUfos) {
        if (!Array.isArray(ru.pos)) continue;
        const dRu = Math.hypot(targetPos[0] - ru.pos[0], targetPos[1] - ru.pos[1], targetPos[2] - ru.pos[2]);
        if (dRu < UFO_RADIUS_M * 2.2) { hitRemote = ru; break; }
      }

      const tgtSample = sampleLocalPlanetaryMaterial(env, targetPos, {
        activeVehicle: 'ufo',
        cfdTelemetry: lastCfdTelemetry,
        worldName: bodySpec?.name || 'World'
      });

      if (weaponMode === 'antimatter') {
        const amRate = computeAntimatterMassRateKgS(Math.max(1e10, laserPowerW));
        const am = evaluateAntimatterAnnihilation({ massRateKgS: amRate, dt: dtSafe });
        deliveredWeaponEnergyJ += am.coupledEnergyJ;
        if (deliveredWeaponEnergyJ >= 0.85 * bodyBindingEnergyJ) {
          shatterTriggered = true;
        }
        antimatterFlash = 0.16;
        activeBeam = { targetPos, rgb: [0.84, 0.36, 1.0], isAntimatter: true, thicknessMul: 1.4 };
        lastWeaponReaction = {
          weapon: 'antimatter',
          phaseState: shatterTriggered ? 'BINDING ENERGY EXCEEDED' : 'Annihilation Plasma',
          tempK: am.plasmaTempK,
          reactionOutcome: am.reactionOutcome
        };
        if (hitRemote) {
          pendingPeerHits.push({ targetPeerId: hitRemote.peerId, weapon: 'antimatter', damage: 22 * dtSafe * 8, wavelengthNm: 0.0024 });
        }
        if (stepIndex % 2 === 0) {
          const harv = deformMpm.applyBlastOrHeatStamp({
            kind: 3,
            pos: targetPos,
            radiusM: am.craterRadiusM * 0.62,
            depthM: Math.min(8.5, am.craterDepthM * 0.32),
            tempK: 6500,
            melt: 0.95,
            char: 1.0,
            blastImpulse: 340000,
            ejectaCount: 160,
            ejectaRgb: [0.88, 0.44, 1.0],
            ejectaRole: 0.0
          });
          const oreMul = env.isMetallicAsteroid ? 4.0 : (env.isComet ? 2.5 : 1.0);
          pendingHarvest.silicates += (harv.silicates + 5) * oreMul;
          pendingHarvest.metals += (harv.metals + 4) * oreMul;
          pendingHarvest.volatiles += (env.isComet ? 12 : 2) * oreMul;
          pendingHarvest.exotics += harv.exotics + 2.5;
        }
      } else {
        const res = evaluateLaserMaterialInteraction({
          log10WavelengthM: laserLog10WavelengthM,
          powerW: laserPowerW,
          maxPowerW: maxWeaponPowerW,
          spotRadiusM: 1.6,
          sample: tgtSample,
          currentTempK: laserSpotTempK,
          dt: dtSafe
        });
        deliveredWeaponEnergyJ += Math.max(0, laserPowerW * res.absorptance * dtSafe);
        if (deliveredWeaponEnergyJ >= 0.85 * bodyBindingEnergyJ) {
          shatterTriggered = true;
        }
        laserSpotTempK = res.nextTempK;
        activeBeam = {
          targetPos,
          rgb: res.em.rgb,
          isAntimatter: false,
          thicknessMul: 0.72 + Math.max(0, Math.log10(laserPowerW / 1e4)) * 0.14
        };
        lastWeaponReaction = {
          weapon: 'laser',
          band: res.em.band,
          wavelengthLabel: res.em.displayLabel,
          absorptance: res.absorptance,
          tempK: res.nextTempK,
          phaseState: res.phaseState,
          reactionOutcome: res.reactionOutcome
        };
        if (hitRemote) {
          pendingPeerHits.push({ targetPeerId: hitRemote.peerId, weapon: 'laser', damage: 14 * dtSafe * 6, wavelengthNm: res.em.wavelengthNm });
        }
        const isVaporOrPlasma = res.phaseState === 'Vaporizing' || res.phaseState === 'Ionized Plasma' || res.phaseState === 'Coulomb Plasma';
        const harv = deformMpm.applyBlastOrHeatStamp({
          kind: 2,
          pos: targetPos,
          radiusM: 6.8,
          depthM: res.ablationRateMPerS * dtSafe * 2.2,
          tempK: res.nextTempK,
          melt: res.meltDelta,
          char: res.nextTempK > 700 ? 0.22 : 0.02,
          blastImpulse: isVaporOrPlasma ? 16000 : 0,
          ejectaCount: isVaporOrPlasma && (stepIndex % 2 === 0) ? 48 : 0,
          ejectaRgb: res.materialFormula === 'H₂O' ? [0.82, 0.94, 1.0] : res.em.rgb,
          ejectaRole: res.materialFormula === 'H₂O' ? 2.0 : 0.0
        });
        pendingHarvest.silicates += harv.silicates + (isVaporOrPlasma ? 0.6 : 0);
        pendingHarvest.volatiles += harv.volatiles + (res.materialFormula === 'H₂O' ? 1.2 : 0);
        pendingHarvest.metals += harv.metals + (isVaporOrPlasma ? 0.4 : 0);
        pendingHarvest.exotics += harv.exotics;
      }
    } else {
      laserSpotTempK = Math.max(env.tempK, laserSpotTempK - (laserSpotTempK - env.tempK) * dtSafe * 1.4);
    }

    // Upload articulated Rover + Drone + Iconic 60-ft Emerald-Dome UFO + Yellow Tractor Beam + 360° Rim Weapons!
    const meshBundle = buildRoverAndDroneMeshFloats(rover, drone, curvInv2R, focus[0], focus[2], ufo, {
      tractorActive,
      tractorHeight,
      tractorGroundPos,
      activeBeam,
      isUfoCockpit: activeVehicle === 'ufo' && cameraMode === 'first-person',
      shieldFlash: externalShieldFlash,
      missiles: activeMissiles,
      remoteUfos: externalRemoteUfos,
      probes: externalProbes,
      organisms: surfaceOrganisms
    });
    vehicleVertCount = Math.min(MAX_VEHICLE_VERTS, Math.floor(meshBundle.opaque.length / 12));
    if (vehicleVertCount > 0) {
      device.queue.writeBuffer(vehicleVertBuf, 0, meshBundle.opaque.subarray(0, vehicleVertCount * 12));
    }
    fxVertCount = Math.min(MAX_FX_VERTS, Math.floor(meshBundle.fx.length / 12));
    if (fxVertCount > 0) {
      device.queue.writeBuffer(fxVertBuf, 0, meshBundle.fx.subarray(0, fxVertCount * 12));
    }

    const enc = device.createCommandEncoder({ label: `${label}-enc-${stepIndex}` });
    // Step Persistent 128x128 Deformation Field + Dormant-Zero GPU MLS-MPM + GPU Ocean Wave PDE + Flora Placement BEFORE terrain mesh!
    deformMpm.encodeGpuStep(enc, dtSafe);
    oceanWaveGpu.encodeGpuStep(enc, {
      dt: dtSafe,
      windX,
      windZ,
      iceCoverFrac: liveSeaIceFrac,
      latRad: Number.isFinite(Number(climate?.latitudeRad)) ? Number(climate.latitudeRad) : 0.55
    });
    floraGpu.encodePlacementIfNeeded(enc, {
      centerX: snapX,
      centerZ: snapZ,
      focusX: focus[0],
      focusZ: focus[2],
      env,
      xeno: env.xenobiology,
      snowlineM: liveSnowlineM,
      autumnShift: liveAutumnShift,
      seaIceFrac: liveSeaIceFrac,
      tectWorldSpanM: activeGeoWorldSpanM,
      tectN: TECTONIC_GRID_N,
      force: stepIndex === 1
    });
    if (surfaceEcoGpu) {
      surfaceEcoGpu.encodeStep(enc, {
        dt: dtSafe,
        gravity: env.gravityMS2,
        seaLevel: env.seaLevelM,
        sunElevDeg: Number(climate?.sunElevDeg ?? 35.0),
        hasSolidCrust: Boolean(env.hasSolidCrust),
        hasOcean: Boolean(env.hasLiquidOcean),
        tractorActive,
        focusPos: focus,
        maxRadiusM: 240.0,
        windVec: lastCfdTelemetry?.craftWindMS || [0, 0, 0],
        rhoAtm: env.rhoAtmKgM3 || 1.22,
        ufoPos: ufo.pos,
        tractorRadiusM: 44.0
      });
    }
    const pass = enc.beginComputePass({ label: `${label}-pass` });
    pass.setBindGroup(0, bg);
    pass.setPipeline(terrainPipe.pipeline);
    pass.dispatchWorkgroups(wgGrid, wgGrid, 2); // 2-ring +-6 km GPU clipmap!
    pass.setPipeline(plumePipe.pipeline);
    pass.dispatchWorkgroups(wgPlume);
    pass.setPipeline(telPipe.pipeline);
    pass.dispatchWorkgroups(1);
    pass.end();

    const doTel = readTelemetry && !mapInFlight && telReadBuf.mapState === 'unmapped';
    if (doTel) {
      mapInFlight = true;
      enc.copyBufferToBuffer(telBuf, 0, telReadBuf, 0, 16);
    }
    device.queue.submit([enc.finish()]);

    // Step live 3D WebGPU Stratified Atmospheric CFD on EVERY atmosphere-bearing world (Rover, Drone, AND UFO;
    // strictly dormant / null on airless vacuum worlds where P < 20 Pa!)
    const runCfd = Boolean(cfdSession);
    const groundYAtFocus = env.hasSolidCrust
      ? evaluatePlanetaryTerrainHeight(focus[0], focus[2], env)
      : -9999.0;
    const liveAltKm = (activeVehicle === 'ufo' || !env.hasSolidCrust)
      ? ufo.altitudeKm
      : Math.max(0.01, (focus[1] - groundYAtFocus) * 0.001 + 0.02);
    if (runCfd) {
      lastCfdTelemetry = await cfdSession.step({
        dt: Math.min(0.035, dtSafe * 1.35),
        craftPos: focus,
        altKm: liveAltKm,
        groundY: groundYAtFocus,
        sunElev: Number.isFinite(Number(climate?.sunElevDeg))
          ? Math.sin((Number(climate.sunElevDeg) * Math.PI) / 180.0)
          : 0.45,
        readTelemetry: readTelemetry || (stepIndex <= 2)
      });
    }

    const localSample = sampleLocalPlanetaryMaterial(env, focus, {
      activeVehicle,
      cfdTelemetry: lastCfdTelemetry,
      worldName: bodySpec?.name || 'World'
    });

    let activePlumes = lastTelemetry.activePlumeParticles;
    let flameCnt = lastTelemetry.flameParticles;
    let dustCnt = lastTelemetry.dustParticles;
    let meanDustSpd = lastTelemetry.meanDustSpeedMS;

    if (doTel && !disposed && telReadBuf.mapState === 'unmapped') {
      try {
        await telReadBuf.mapAsync(GPU_BUF.MAP_READ);
        if (!disposed) {
          const f = new Float32Array(telReadBuf.getMappedRange(0, 16));
          activePlumes = Math.round(f[0]);
          flameCnt = Math.round(f[1]);
          dustCnt = Math.round(f[2]);
          meanDustSpd = f[3];
        }
        if (!disposed) { try { telReadBuf.unmap(); } catch {} }
      } catch (err) {
        if (!disposed && err?.name !== 'AbortError') throw err;
      } finally {
        mapInFlight = false;
      }
    } else if (doTel) {
      mapInFlight = false;
    }

    lastTelemetry = Object.freeze({
      schema: ULG_PLANETARY_SURFACE_SCHEMA,
      stepIndex,
      activeVehicle,
      cameraMode,
      gravityMS2: env.gravityMS2,
      rhoAtmKgM3: lastCfdTelemetry?.chemistry && (activeVehicle === 'ufo' || !env.hasSolidCrust)
        ? lastCfdTelemetry.chemistry.rhoKgM3
        : env.rhoAtmKgM3,
      pressurePa: lastCfdTelemetry?.chemistry && (activeVehicle === 'ufo' || !env.hasSolidCrust)
        ? lastCfdTelemetry.chemistry.pressurePa
        : env.pressurePa,
      tempK: lastCfdTelemetry?.chemistry && (activeVehicle === 'ufo' || !env.hasSolidCrust)
        ? lastCfdTelemetry.chemistry.tempK
        : env.tempK,
      droneFlightCapable: env.droneFlightCapable,
      droneMaxAeroLiftN: env.maxAeroLiftN,
      droneAeroLiftN: drone.aeroLiftN,
      roverPos: [...rover.pos],
      roverSpeedMS: rover.speedMS,
      roverAltitudeM: rover.altitudeM,
      roverRocketFuel: rover.rocketFuel,
      roverOnGround: rover.onGround,
      dronePos: [...drone.pos],
      droneSpeedMS: drone.speedMS,
      droneAltitudeM: drone.altitudeM,
      ufoPos: [...ufo.pos],
      ufoVel: [...ufo.vel],
      ufoYaw: ufo.yaw,
      ufoPitch: ufo.pitch,
      ufoRoll: ufo.roll,
      ufoVertThrust: ufo.vertThrust,
      ufoSpeedMS: ufo.speedMS,
      ufoAltitudeM: ufo.altitudeM,
      ufoAltitudeKm: ufo.altitudeKm,
      ufoDiameterFt: 60.0,
      tractorActive,
      weaponMode,
      laserLog10WavelengthM,
      laserPowerW,
      weaponFiring,
      activeBeam,
      weaponReaction: lastWeaponReaction,
      antimatterFlash,
      activeMissileCount: activeMissiles.length,
      aliveBoulderCount: deformMpm.aliveBoulderCount,
      bouldersCaptured: boulderRes.capturedCount,
      abductedCount: abductedSpecimens.length,
      latestAbductedSpecimen: abductedSpecimens.length ? abductedSpecimens[abductedSpecimens.length - 1] : null,
      abductingOrganismName: activeAbductionTarget ? (activeAbductionTarget.kind === 'fauna' ? 'Fauna Organism' : 'Flora Tree') : null,
      livingOrganismCount: surfaceOrganisms.reduce((acc, o) => acc + (o.abducted ? 0 : 1), 0),
      landingSite: env.landingSite || null,
      totalCratersCarved: deformMpm.totalCratersCarved,
      craterReplayCount: deformMpm.craterReplayCount,
      boulderSkinGpuActive: Boolean(deformMpm.boulderSkinGpuActive),
      totalBouldersShattered: deformMpm.totalBouldersShattered,
      deliveredWeaponEnergyJ,
      bodyBindingEnergyJ,
      shatterFraction: Math.min(1.0, deliveredWeaponEnergyJ / Math.max(1.0, 0.85 * bodyBindingEnergyJ)),
      shatterTriggered,
      isMinorBody: Boolean(env.isMinorBody),
      isComet: Boolean(env.isComet),
      isMetallicAsteroid: Boolean(env.isMetallicAsteroid),
      sphGeologyActive: Boolean(hasSphPatch),
      mpmActive: deformMpm.mpmActive,
      mpmDispatches: deformMpm.totalMpmDispatches,
      cfdActive: runCfd,
      cfdAvailable: Boolean(cfdSession),
      cfdTelemetry: lastCfdTelemetry,
      localSample,
      activePlumeParticles: activePlumes,
      flameParticles: flameCnt,
      dustParticles: dustCnt,
      meanDustSpeedMS: meanDustSpd,
      accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
      scientificValidation: false
    });
    return lastTelemetry;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    try { cfdSession?.dispose(); } catch {}
    try { deformMpm?.dispose(); } catch {}
    try { tectonicsGpu?.dispose(); } catch {}
    try { sphSurfacePatch?.dispose?.(); } catch {}
    try { oceanWaveGpu?.dispose(); } catch {}
    try { floraGpu?.dispose(); } catch {}
    try { surfaceEcoGpu?.dispose(); } catch {}
    for (const b of [paramsBuf, terrainVertBuf, terrainIdxBuf, plumesBuf, telBuf, telReadBuf, vehicleVertBuf, fxVertBuf]) {
      try { b.destroy(); } catch {}
    }
  }

  function getLocalSample() {
    const focus = activeVehicle === 'ufo' ? ufo.pos : (activeVehicle === 'drone' ? drone.pos : rover.pos);
    return sampleLocalPlanetaryMaterial(env, focus, {
      activeVehicle,
      cfdTelemetry: lastCfdTelemetry,
      worldName: bodySpec?.name || 'World'
    });
  }

  function abductOrganismById(orgId, { queueEvent = false } = {}) {
    let org = null;
    if (typeof orgId === 'number' && Number.isInteger(orgId)) {
      const alive = surfaceOrganisms.filter((o) => !o.abducted);
      org = alive[orgId] || surfaceOrganisms[orgId] || null;
    } else if (orgId != null) {
      org = surfaceOrganisms.find((o) => o.id === String(orgId) && !o.abducted) || null;
    }
    if (!org || org.abducted) return null;
    org.abducted = true;
    org.abducting = false;
    triggerTractorPulse(1.4);
    const rec = synthesizeAbductedSpecimenRecord({
      kind: org.kingdom || org.kind,
      speciesRecord: org.speciesRecord || null,
      worldName: bodySpec?.name || 'Exoplanet',
      env,
      xeno: env.xenobiology,
      latDeg: lastClimate?.observerLatDeg ?? landingSite?.latDeg ?? 32.0,
      lonDeg: (landingSite?.lonDeg ?? 0.0) + (lastClimate?.observerLonOffsetDeg ?? 0.0),
      seed: org.seed
    });
    abductedSpecimens.push(rec);
    if (queueEvent) pendingAbductions.push(rec);
    return rec;
  }

  return Object.freeze({
    schema: ULG_PLANETARY_SURFACE_SCHEMA,
    lawAdapter: PLANETARY_SURFACE_LAW_ADAPTER,
    get bodySpec() { return bodySpec; },
    get env() { return env; },
    get isMinorBody() { return Boolean(env.isMinorBody); },
    get xenobiology() { return env.xenobiology; },
    get activeVehicle() { return activeVehicle; },
    get cameraMode() { return cameraMode; },
    get gridN() { return n; },
    get indexCount() { return indexCount; },
    get vehicleVertCount() { return vehicleVertCount; },
    get fxVertCount() { return fxVertCount; },
    get boulderVertCount() { return deformMpm.boulderVertCount; },
    get mpmPointCount() { return deformMpm.mpmActive ? deformMpm.mpmPointCount : 0; },
    get floraInstanceCount() { return floraGpu.activeInstanceCount; },
    get floraTemplateVertCount() { return floraGpu.templateVertCount; },
    get particleCount() { return pCount; },
    get cfdMoteCount() { return cfdSession ? cfdSession.moteCount : 0; },
    get cfdProfile() { return cfdSession ? cfdSession.profile : null; },
    get stepIndex() { return stepIndex; },
    getCraterStamps: () => deformMpm.getCraterStamps(),
    applyRemoteCraterStamp: (st) => deformMpm.applyRemoteCraterStamp(st),
    getAbductedSpecimens: () => [...abductedSpecimens],
    getOrganisms: () => surfaceOrganisms,
    abductOrganismById,
    getResidentTerrainVertBuffer: () => terrainVertBuf,
    getResidentTerrainIndexBuffer: () => terrainIdxBuf,
    getResidentVehicleVertBuffer: () => vehicleVertBuf,
    getResidentFxVertBuffer: () => fxVertBuf,
    getResidentBoulderVertBuffer: () => deformMpm.getResidentBoulderVertBuffer(),
    getResidentMpmPointsBuffer: () => deformMpm.getResidentMpmPointsBuffer(),
    getResidentFloraInstancesBuffer: () => floraGpu.getResidentInstancesBuffer(),
    getResidentFloraTemplateVertBuffer: () => floraGpu.getResidentTemplateVertBuffer(),
    getResidentOceanBuffer: () => oceanWaveGpu.getResidentOceanBuffer(),
    getResidentTectonicBuffer: () => activeGeologyBuf,
    get sphGeologyActive() { return Boolean(hasSphPatch); },
    getResidentPlumesBuffer: () => plumesBuf,
    getResidentCfdMotesBuffer: () => (cfdSession ? cfdSession.getResidentMotesBuffer() : null),
    getActiveSkyEnv,
    getLocalSample,
    getCameraPose,
    getCheckpoint,
    adjustChaseDistance,
    setActiveVehicle,
    triggerTractorPulse,
    setTractorBeam,
    setWeaponConfig,
    setWeaponFire,
    launchMissile,
    setExternalEntities,
    drainPendingEvents,
    setUfoAltitudeKm,
    setCameraMode,
    addLookDelta,
    getTelemetry: () => lastTelemetry,
    step,
    dispose
  });
}

export function registerPlanetarySurfaceVehiclesModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  if (registry.hasModule?.('planetary-surface-vehicles@1')) {
    return registry.resolveModule('planetary-surface-vehicles@1')?.descriptor || null;
  }
  return registry.registerModule({
    method: { model: 'planetary-surface-vehicles', version: 1 },
    kernel: {
      sourceModule: 'src/runtime/astrophysics/planetarySurfaceVehiclesGpu.js',
      entryPoint: 'step_surface_plume_particles',
      workgroupSize: 64
    },
    parameterSchema: {
      surfaceGravityMS2: { type: 'number', min: 0.1, max: 40, required: false },
      surfacePressurePa: { type: 'number', min: 0, max: 1e8, required: false }
    },
    stateLayout: {
      tensorId: 'surface-plume-particles',
      dtype: 'f32',
      layout: 'interleaved',
      strideElements: 16,
      strideBytes: 64,
      fields: ['x', 'y', 'z', 'role', 'vx', 'vy', 'vz', 'age', 'r', 'g', 'b', 'maxLife', 'size', 'temp', 'seed', 'live']
    },
    scaleRangeM: [0.1, 5e4],
    async stepCapsule(capsule, { createSimulationArtifact, device }) {
      const p = capsule.input?.parameters || {};
      const session = createPlanetarySurfaceSessionWebGpu(device, {
        bodySpec: { surfaceGravityMS2: p.surfaceGravityMS2 ?? 3.72, surfacePressurePa: p.surfacePressurePa ?? 650, tempK: 215 },
        gridN: 33,
        particleCount: 256
      });
      const tel = await session.step({ dt: 0.02, controls: { forward: true, jump: true }, readTelemetry: true });
      session.dispose();
      return createSimulationArtifact({
        artifactId: `${capsule.taskId}:planetary-surface:${tel.stepIndex}`,
        taskKind: capsule.taskKind,
        closureRef: {
          module: 'src/runtime/astrophysics/planetarySurfaceVehiclesGpu.js',
          entryPoint: 'createPlanetarySurfaceSessionWebGpu',
          kernelEntryPoint: 'step_surface_plume_particles'
        },
        representation: 'planetary-surface-vehicles-f32',
        outputs: { telemetry: tel },
        execution: { backend: 'webgpu-planetary-surface', placement: 'local' },
        validity: { finite: Number.isFinite(tel.roverAltitudeM) && Number.isFinite(tel.droneMaxAeroLiftN) },
        validation: { status: 'pass', validationMode: 'gpu-surface-vehicle-invariants', scientificValidation: false, fullPhysicsValidation: false },
        provenance: { ...capsule.provenance, methodHash: capsule.methodHash, inputHash: capsule.inputHash }
      });
    }
  });
}
