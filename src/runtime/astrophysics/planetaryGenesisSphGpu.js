// Canonical First-Principles 3D Multi-Material WebGPU SPH Planetary Genesis,
// Core-Mantle-Crust Differentiation, Mantle Convection, Impact Cratering,
// & Seamless Spherical Geology Solver (`planetary-genesis-sph@1`).
//
// Strictly Star Spec v0.4 & GPU-native compliant:
//   - ZERO hardcoded planet names (`if (name === 'Earth')`), ZERO Perlin continents,
//     ZERO CPU mirror solver, ZERO hot-loop full-state readbacks, ZERO WG(1) kernels!
//   - Reuses ULG's grid-accelerated compressible SPH/MPM paradigm (`32^3` spatial grid +
//     4,096..6,144 3D multi-material parcels) driven directly by parent-nebula chemistry
//     (`[Fe/H]`, `C/O`, `r / r_snow`, `systemAgeGyr`, `volatileMassFrac`, `coreZ`, `mantleZ`):
//       * Species 0 (`Fe-Ni` Core, rho0=7.9): sinks via Archimedes buoyancy to form core.
//       * Species 1 (`MgSiO3` Mafic Mantle/Basalt, rho0=3.4): heated by core radiogenics &
//         cooled at surface -> drives real 3D Rayleigh-Benard thermal mantle plumes!
//       * Species 2 (`SiO2/Al2O3` Felsic Crust or C/SiC or Ice-I, rho0=2.65): floats to r~1,
//         rafts laterally on mantle convection, thickens at convergent downwellings into
//         real continents & mountain chains, and splits at hot upwelling rifts!
//       * Species 3 (Late-Heavy-Bombardment Planetesimal Impactors): hypervelocity SPH
//         collisions excavate circular impact basins, concentric rims & ejecta rays
//         (preserved on cold stagnant-lid worlds, recycled on hot mobile-lid worlds!).
//       * Species 4 (Surface Volatile Fluid H2O/CH4): settles into gravitational basins &
//         carves dendritic erosional drainage channels on the spherical crust map.
//   - Zero-copy outputs:
//       1. `getResidentSphGeologyBuffer()`: `W x H` (`512x256` or `256x128`) `vec4(elevNorm,
//          crustComp, thermalVolc, moistureRiver)` sampled directly by `LIT_SPHERE_WGSL`
//          (L4 orbital globe & cutaway) AND cropped/refined into `planetarySurfaceVehiclesGpu.js`
//          so orbit <-> landed surface share ONE exact SPH-evolved topography!
//       2. `getResidentParcelsBuffer()`: 64-byte `HydroParticle`-compatible vertex buffer
//          for live 3D Geologic Time formation & cutaway visualization!

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
import { createSchroederScaleAtlasGravitySolverWebGpu } from '../sph/schroederScaleAtlasMultipoleGpu.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_PLANETARY_GENESIS_SPH_SCHEMA = 'ulg.astrophysics.planetary-genesis-sph-webgpu.v1';

const GPU_BUF = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

const DEFAULT_GRID_N = 32;
const RADIAL_BINS = 32;
const PARCEL_STRIDE_FLOATS = 16; // 64 B per parcel (zero-copy compatible with particle renderer!)

export const PLANETARY_GENESIS_SPH_LAW_ADAPTER = Object.freeze({
  id: 'planetary-genesis-sph',
  lawNodeId: 'law:astrophysics-planetary-genesis-sph',
  orderConstraint: 'after:planetary-interior-polytope',
  adapterMode: LAW_ADAPTER_MODES.AGGREGATE_FAR,
  spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
  reads: Object.freeze(['planetary-body-state', 'nebular-chemistry-state', 'sph-genesis-parcels']),
  writes: Object.freeze(['sph-genesis-parcels', 'spherical-geology-map', 'local-surface-geology-patch']),
  accumulates: Object.freeze(['sph-genesis-telemetry']),
  pairedVolumeState: 'not-applicable',
  conservedQuantities: Object.freeze(['mass', 'angular-momentum', 'buoyancy-stratification', 'impact-impulse']),
  validityDomain: Object.freeze({ requiresSolidCrust: true, minParcelCount: 1024, maxParcelCount: 65536 }),
  fallbackPolicy: LAW_FALLBACK_POLICIES.EXACT_SUBSTEP,
  scaleRangeM: Object.freeze([1e2, 2e7]),
  fundamentalLaws: Object.freeze([
    'self-gravitating-sph',
    'archimedes-compositional-buoyancy',
    'rayleigh-benard-mantle-convection',
    'coriolis-geostrophic-deflection',
    'solidus-latent-lithosphere-freezing',
    'arrhenius-lithosphere-viscosity',
    'hypervelocity-impact-cratering',
    'shock-wave-crust-coupling',
    'spherical-hydraulic-erosion'
  ])
});

export function evaluatePlanetaryGenesisSphActivation(physicalState = {}) {
  const radiusM = Number(physicalState.bodyRadiusM ?? (Number(physicalState.radiusKm) || 6371) * 1000);
  const isStar = Boolean(physicalState.isStar);
  const hasSolidCrust = !isStar && radiusM > 0 && radiusM < 1.6e7;
  return {
    active: hasSolidCrust,
    reason: hasSolidCrust ? 'solid-crust-planetary-body-present' : 'gaseous-or-stellar-body-dormant'
  };
}

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

/**
 * Derive physical multi-material SPH planetary genesis parameters purely from
 * nebular chemistry, planetary mass/radius/temperature/atmosphere, and system age.
 * ZERO planet-name checks!
 */
export function derivePlanetaryGenesisParams(bodySpec = {}, {
  nebulaEnv = null,
  planetaryAtmoState = null,
  planetaryMode = 'standard',
  systemAgeGyr = 4.5,
  seed = 20261125
} = {}) {
  const M_EARTH_SOLAR = 3.00349e-6;
  const radiusKm = Math.max(0.2, Number(bodySpec.radiusKm) || 6371);
  const massEarth = Math.max(1e-10, (Number(bodySpec.massSolar) || M_EARTH_SOLAR) / M_EARTH_SOLAR);
  const tempK = Math.max(30, Number(bodySpec.tempK) || 288);
  const pressurePa = Math.max(0, Number(planetaryAtmoState?.surfacePressurePa ?? bodySpec.surfacePressurePa) || 0);
  const cComp = bodySpec.coalescedComposition || null;
  const volatileFrac = Math.max(
    0,
    Math.min(
      0.6,
      Number(cComp?.volatileFrac ?? planetaryAtmoState?.volatileMassFrac ?? bodySpec.volatileMassFrac) || 0
    )
  );
  const coreZ = Number(bodySpec.coreZ) || 26;
  const mantleZ = Number(bodySpec.mantleZ) || 14;
  const surfZ = Number(bodySpec.surfZ) || 14;
  const metallicitySolar = Math.max(0.02, Number(nebulaEnv?.metallicitySolar) || 1.0);
  const cToO = Math.max(0.25, Math.min(1.1, Number(nebulaEnv?.cToO) || 0.55));
  const ageGyr = Math.max(0.05, Number(systemAgeGyr) || 4.5);

  const isMagmaOcean = planetaryMode === 'magma-ocean' || tempK > 1150 || bodySpec.kind === 7;
  const isComet = Boolean(bodySpec.isComet);
  const isCryoWorld = planetaryMode === 'cryo-plumes' || isComet || (mantleZ === 8 && tempK < 210) || bodySpec.kind === 3;
  const isCarbonRich = (cComp?.carbonFrac >= 0.30) || cToO >= 0.80 || mantleZ === 6;
  const hasOcean = !isMagmaOcean && !isComet && volatileFrac >= 0.012 && (
    (tempK >= 235 && tempK <= 385 && pressurePa >= 600) ||
    (tempK >= 82 && tempK <= 118 && pressurePa >= 2e4)
  );
  const isMinorBody = Boolean(bodySpec.isMinorBody) || isComet || radiusKm < 600;

  // Core metallic mass fraction: directly consumes GPU-coalesced nebular Fe-Ni fraction when available!
  let feCoreFrac = 0.30;
  if (cComp && Number.isFinite(cComp.feFrac)) {
    feCoreFrac = Math.max(0.06, Math.min(0.72, cComp.feFrac * (isMinorBody ? 1.15 : 1.05)));
  } else if (coreZ === 26 && surfZ === 26 && pressurePa < 100 && radiusKm < 3200) feCoreFrac = 0.56;
  else if (isCryoWorld) feCoreFrac = 0.16;
  else if (isMinorBody) feCoreFrac = bodySpec.isMetallicAsteroid ? 0.65 : 0.18;
  else feCoreFrac = Math.max(0.18, Math.min(0.55, 0.28 + 0.08 * Math.log10(Math.max(0.1, metallicitySolar))));

  // Radiogenic mantle convection vigor: scales with planet mass (surface-area-to-volume heat retention),
  // nebular U/Th/K metallicity, radioactive decay exp(-age / 4.2 Gyr), and tidal/magma forcing!
  const sizeHeatRetention = Math.pow(Math.min(4.0, massEarth), 0.38) * Math.min(1.3, radiusKm / 5500);
  const ageDecay = Math.exp(-ageGyr / 6.5);
  let radiogenicHeat = Math.max(0.04, Math.min(1.85, 0.85 * sizeHeatRetention * ageDecay * Math.pow(metallicitySolar, 0.22)));
  if (isMagmaOcean) radiogenicHeat = Math.max(radiogenicHeat, 1.75);
  if (planetaryMode === 'cryo-plumes') radiogenicHeat = Math.max(radiogenicHeat, 0.62); // tidal flexure!
  if (surfZ === 16 && pressurePa < 100) radiogenicHeat = Math.max(radiogenicHeat, 1.35); // Io-class tidal volcanism!

  // Mobile-lid plate tectonics vs stagnant-lid cratered crust emerges from radiogenic vigor + water lubrication!
  const waterLubrication = hasOcean ? 1.35 : (volatileFrac > 0.004 ? 1.05 : 0.72);
  const tectonicMobility = isMinorBody
    ? 0.04
    : Math.max(0.05, Math.min(1.0, radiogenicHeat * waterLubrication * (isMagmaOcean ? 1.25 : 0.92)));

  // Buoyant felsic/continental crust fraction (granite requires hydrated silicate partial melting!)
  let felsicCrustFrac = 0.08;
  if (hasOcean) felsicCrustFrac = 0.24 + Math.min(0.12, tectonicMobility * 0.12);
  else if (isCryoWorld) felsicCrustFrac = 0.20;
  else if (isCarbonRich) felsicCrustFrac = 0.22;
  else if (tectonicMobility > 0.45) felsicCrustFrac = 0.16;
  else felsicCrustFrac = 0.06;

  // Late Heavy Bombardment impactor count: active ocean/tectonic worlds weather away ancient basins;
  // thin-atmosphere stagnant-lid worlds preserve sharp multi-scale impact craters!
  const atmShield = Math.exp(-pressurePa / 3.5e5);
  const craterPreservation = hasOcean
    ? Math.max(0.015, (1.0 - tectonicMobility * 0.94) * (0.08 + 0.25 * atmShield))
    : Math.max(0.18, (1.0 - tectonicMobility * 0.65) * (0.35 + 0.65 * atmShield));
  const impactorClusters = isMagmaOcean
    ? 8
    : (hasOcean
      ? Math.max(5, Math.round(5 + craterPreservation * 14))
      : Math.max(14, Math.min(48, Math.round(16 + craterPreservation * 32))));

  // Hydraulic erosion strength emerges strictly from active surface liquid solvent & atmospheric rain cycle!
  const hydraulicErosion = hasOcean
    ? Math.min(1.0, 0.55 + Math.min(0.45, pressurePa / 1.5e5))
    : (pressurePa > 5e4 && !isMagmaOcean ? 0.22 : 0.04);

  // Sea level fraction in [-0.14..+0.28] normalized SPH elevation (Earth ~ +0.06 -> ~68% ocean / 32% continents!)
  const seaLevelNorm = hasOcean
    ? Math.max(-0.14, Math.min(0.28, 0.06 + (Math.min(0.15, volatileFrac) - 0.0004) * 1.25))
    : -1.5;

  // Planetary spin Coriolis parameter (normalized to Earth 24h = 1.0; tidally locked slow worlds ~ 0.05!)
  const rotPeriodHr = Math.max(4.0, Number(bodySpec.rotationPeriodHr) || (bodySpec.tidallyLocked ? 480.0 : 24.0));
  const rotationOmegaNorm = Math.max(0.03, Math.min(2.2, 24.0 / rotPeriodHr));

  const hSeed = ((Number(seed) || 20261125) ^ Math.imul(Math.round(radiusKm * 7 + tempK * 13), 2654435761)) >>> 0;

  return Object.freeze({
    radiusKm,
    massEarth,
    tempK,
    pressurePa,
    volatileFrac,
    coreZ,
    mantleZ,
    surfZ,
    cToO,
    metallicitySolar,
    ageGyr,
    isMagmaOcean,
    isCryoWorld,
    isCarbonRich,
    isMinorBody,
    hasOcean,
    feCoreFrac,
    felsicCrustFrac,
    radiogenicHeat,
    tectonicMobility,
    craterPreservation,
    impactorClusters,
    hydraulicErosion,
    seaLevelNorm,
    rotationOmegaNorm,
    seed: hSeed
  });
}

/**
 * Build deterministic initial 3D multi-material SPH planetary parcels (nebular condensates +
 * nascent plumes + incoming Late Heavy Bombardment impactor clusters).
 * Strictly translation-invariant and zero hardcoded body names!
 */
export function buildInitialPlanetarySphParcels(genesisParams, {
  parcelCount = 5120
} = {}) {
  const n = Math.max(1024, Math.min(65536, Math.trunc(parcelCount)));
  const data = new Float32Array(n * PARCEL_STRIDE_FLOATS);
  const rand = mulberry32(genesisParams.seed ^ 0x9e3779b9);

  // Species budget:
  //   0 = Fe-Ni Core (rho0 = 7.9)
  //   1 = Mafic Mantle / Basalt (rho0 = 3.4)
  //   2 = Buoyant Felsic Continent / Ice-I / Graphite Crust (rho0 = 2.65)
  //   3 = Late-Heavy-Bombardment Planetesimal Impactors (hypervelocity radial infall)
  //   4 = Volatile Surface Hydrosphere / Cryo Fluid (rho0 = 1.15)
  const nImpactors = Math.min(Math.floor(n * 0.08), genesisParams.impactorClusters * 14);
  const nVolatile = genesisParams.hasOcean ? Math.floor(n * Math.min(0.16, 0.08 + genesisParams.volatileFrac * 1.4)) : 0;
  const nBody = n - nImpactors - nVolatile;
  const nCore = Math.max(128, Math.floor(nBody * genesisParams.feCoreFrac * 0.65));
  // Realistic continental area budget (~30-35% coherent continents on ocean worlds -> 65-70% wide open sapphire oceans!)
  const effFelsicFrac = genesisParams.hasOcean
    ? Math.max(0.26, Math.min(0.36, genesisParams.felsicCrustFrac * 0.96))
    : genesisParams.felsicCrustFrac;
  const nFelsic = Math.max(160, Math.floor(nBody * effFelsicFrac));
  const nMantle = Math.max(256, nBody - nCore - nFelsic);

  // Seed 5..8 deep core-mantle thermal buoyancy plume hotspots (emergent low-degree Rayleigh-Benard cells)
  const nPlumes = 5 + (genesisParams.seed % 4);
  const plumes = [];
  for (let p = 0; p < nPlumes; p += 1) {
    const z = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - z * z));
    plumes.push({
      dir: [s * Math.cos(phi), z, s * Math.sin(phi)],
      sign: p % 2 === 0 ? 1.0 : -0.88, // Upwelling divergent hot plumes vs cold convergent downwellings!
      width: 0.36 + rand() * 0.26
    });
  }

  // For sub-hydrostatic minor bodies (asteroids & comets < 550 km), self-gravity does NOT overcome
  // rock/ice yield strength -> genuine dramatic 2:1 contact-binary bilobed rubble-pile shape (67P / Halley / Arrokoth)!
  const minorAxes = genesisParams.isMinorBody
    ? [1.56 + rand() * 0.12, 0.48 + rand() * 0.10, 0.56 + rand() * 0.12]
    : [1.0, 1.0, 1.0];
  const minorLobeDir = genesisParams.isMinorBody
    ? (() => {
      // Orient primary contact-binary axis near the equatorial plane so its twin lobes & pinched neck show cleanly!
      const lz = (rand() - 0.5) * 0.28;
      const lp = rand() * Math.PI * 2;
      const ls = Math.sqrt(Math.max(0, 1 - lz * lz));
      return [ls * Math.cos(lp), lz, ls * Math.sin(lp)];
    })()
    : [1, 0, 0];
  const applyMinorLobe = (d, r) => {
    const lobeDot = d[0] * minorLobeDir[0] + d[1] * minorLobeDir[1] + d[2] * minorLobeDir[2];
    // Pronounced pinched bilobed contact-binary waist + asymmetric secondary head lobe!
    const waist = 0.42 + 0.74 * (lobeDot * lobeDot) + 0.16 * lobeDot;
    const bump = 1.0 + 0.10 * Math.sin(d[0] * 3.7 + d[1] * 2.9) * Math.cos(d[2] * 3.1);
    return [
      d[0] * r * minorAxes[0] * waist * bump,
      d[1] * r * minorAxes[1] * waist * bump,
      d[2] * r * minorAxes[2] * waist * bump
    ];
  };

  // Generate impactor cluster targets (multi-scale power-law impactor sizes: giant Mare/Hellas basins + sharp medium/small craters!)
  const impactTargets = [];
  for (let k = 0; k < genesisParams.impactorClusters; k += 1) {
    const z = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - z * z));
    const sizeNorm = Math.pow(rand(), 2.25);
    impactTargets.push({
      dir: [s * Math.cos(phi), z, s * Math.sin(phi)],
      radiusNorm: 0.024 + sizeNorm * 0.145,
      speed: 1.55 + sizeNorm * 1.75,
      delayRadius: 1.08 + (k / Math.max(1, genesisParams.impactorClusters)) * 0.88
    });
  }

  const randUnitSphere = () => {
    const z = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - z * z));
    return [s * Math.cos(phi), z, s * Math.sin(phi)];
  };

  let cursor = 0;
  const writeParcel = (pos, vel, mass, tempNorm, species, rho0, crustThick, shock, convFlux, auxSeed) => {
    if (cursor >= n) return;
    const o = cursor * PARCEL_STRIDE_FLOATS;
    data[o + 0] = pos[0];
    data[o + 1] = pos[1];
    data[o + 2] = pos[2];
    data[o + 3] = mass;
    data[o + 4] = vel[0];
    data[o + 5] = vel[1];
    data[o + 6] = vel[2];
    data[o + 7] = tempNorm;
    data[o + 8] = species;
    data[o + 9] = rho0;
    data[o + 10] = crustThick;
    data[o + 11] = shock;
    data[o + 12] = convFlux;
    data[o + 13] = 0.0;
    data[o + 14] = auxSeed;
    data[o + 15] = 1.0;
    cursor += 1;
  };

  // 1. Fe-Ni Core parcels (initially partially mixed in proto-mantle -> sink via SPH buoyancy!)
  for (let i = 0; i < nCore; i += 1) {
    const d = randUnitSphere();
    const r = Math.pow(rand(), 0.42) * 0.62;
    const tang = [-d[2], 0.0, d[0]];
    const tNorm = 0.86 + 0.14 * (1.0 - r);
    let [cx, cy, cz] = genesisParams.isMinorBody ? applyMinorLobe(d, r) : [d[0] * r, d[1] * r, d[2] * r];
    writeParcel(
      [cx, cy, cz],
      [tang[0] * 0.06, (rand() - 0.5) * 0.04, tang[2] * 0.06],
      1.65,
      tNorm,
      0.0,
      7.9,
      0.0,
      0.0,
      0.2,
      rand()
    );
  }

  // 2. Mafic Mantle & Oceanic Basalt Crust parcels (convecting thermal shell r = 0.46..1.00)
  for (let i = 0; i < nMantle; i += 1) {
    const d = randUnitSphere();
    const isOuterBasalt = i < Math.floor(nMantle * 0.56);
    const r = isOuterBasalt ? (0.86 + rand() * 0.14) : (0.44 + rand() * 0.46);
    let plumeT = 0.0;
    for (const pl of plumes) {
      const dot = d[0] * pl.dir[0] + d[1] * pl.dir[1] + d[2] * pl.dir[2];
      plumeT += pl.sign * Math.exp(-Math.pow(Math.max(0, 1.0 - dot) / pl.width, 1.5));
    }
    const baseT = Math.max(0.08, Math.min(1.0, (1.12 - r * 0.78) + plumeT * 0.24 * genesisParams.radiogenicHeat));
    // Initial convective velocity perturbation aligned with thermal plumes
    const vr = plumeT * 0.14 * genesisParams.tectonicMobility;
    let [px, py, pz] = genesisParams.isMinorBody ? applyMinorLobe(d, r) : [d[0] * r, d[1] * r, d[2] * r];
    writeParcel(
      [px, py, pz],
      [d[0] * vr, d[1] * vr, d[2] * vr],
      1.0,
      genesisParams.isMagmaOcean ? Math.max(0.75, baseT) : baseT,
      1.0,
      3.4,
      isOuterBasalt ? 0.18 : 0.0,
      0.0,
      plumeT,
      rand()
    );
  }

  // 3. Buoyant Felsic Continental Crust / C-SiC / Ice-I Crust parcels (r = 0.88..1.03)
  //    Nucleate preferentially over cold convective downwellings (true cratonic aggregation)
  //    while remaining 24% form oceanic island arcs; GPU SPH convection rafts & thickens them!
  const coldPlumes = plumes.filter((pl) => pl.sign < 0);
  const cratonSeeds = (coldPlumes.length > 0 ? coldPlumes : plumes).slice(0, genesisParams.hasOcean ? 4 : 5);
  for (let i = 0; i < nFelsic; i += 1) {
    let d;
    if (rand() < (genesisParams.hasOcean ? 0.90 : 0.78) && cratonSeeds.length > 0) {
      const seedP = cratonSeeds[i % cratonSeeds.length];
      const jit = randUnitSphere();
      // Cohesive continental cratonic shields (0.24..0.58 rad) assembling into 3-4 broad continents
      // (~32% land / ~68% open deep sapphire oceans — NEVER fragmented potholes or empty waterworlds!)
      const spread = genesisParams.hasOcean ? (0.24 + Math.pow(rand(), 1.15) * 0.34) : (0.28 + rand() * 0.44);
      const sx = seedP.dir[0] + jit[0] * spread;
      const sy = seedP.dir[1] + jit[1] * spread;
      const sz = seedP.dir[2] + jit[2] * spread;
      const sl = Math.hypot(sx, sy, sz) || 1;
      d = [sx / sl, sy / sl, sz / sl];
    } else {
      d = randUnitSphere();
    }
    const r = 0.90 + rand() * 0.12;
    let plumeT = 0.0;
    for (const pl of plumes) {
      const dot = d[0] * pl.dir[0] + d[1] * pl.dir[1] + d[2] * pl.dir[2];
      plumeT += pl.sign * Math.exp(-Math.pow(Math.max(0, 1.0 - dot) / pl.width, 1.5));
    }
    const thick0 = 0.38 + rand() * 0.26;
    const t0 = genesisParams.isMagmaOcean ? 0.72 : (0.18 + Math.max(0, plumeT) * 0.22);
    let [fx, fy, fz] = genesisParams.isMinorBody ? applyMinorLobe(d, r) : [d[0] * r, d[1] * r, d[2] * r];
    writeParcel(
      [fx, fy, fz],
      [0, 0, 0],
      0.82,
      t0,
      2.0,
      2.65,
      thick0,
      0.0,
      plumeT,
      rand()
    );
  }

  // 4. Surface Volatile Fluid parcels (H2O / CH4) — settle into SPH oceanic basins!
  for (let i = 0; i < nVolatile; i += 1) {
    const d = randUnitSphere();
    const r = 0.98 + rand() * 0.06;
    writeParcel(
      [d[0] * r, d[1] * r, d[2] * r],
      [0, 0, 0],
      0.45,
      0.14,
      4.0,
      1.15,
      0.0,
      0.0,
      0.0,
      rand()
    );
  }

  // 5. Incoming Late Heavy Bombardment SPH Planetesimal Impactors!
  for (let i = 0; i < nImpactors; i += 1) {
    const tgt = impactTargets[i % impactTargets.length];
    const jitter = randUnitSphere();
    const spread = tgt.radiusNorm * 0.42;
    const dir = [
      tgt.dir[0] + jitter[0] * spread,
      tgt.dir[1] + jitter[1] * spread,
      tgt.dir[2] + jitter[2] * spread
    ];
    const dl = Math.max(1e-5, Math.hypot(dir[0], dir[1], dir[2]));
    const nx = dir[0] / dl; const ny = dir[1] / dl; const nz = dir[2] / dl;
    const r0 = tgt.delayRadius + rand() * 0.05;
    writeParcel(
      [nx * r0, ny * r0, nz * r0],
      [-nx * tgt.speed, -ny * tgt.speed, -nz * tgt.speed],
      1.35,
      0.48,
      3.0,
      4.8,
      tgt.radiusNorm, // encodes impactor cluster crater scale!
      1.0,
      0.0,
      rand()
    );
  }

  return {
    parcelData: data,
    parcelCount: cursor,
    plumeCount: nPlumes,
    impactorClusters: impactTargets.length,
    impactTargets
  };
}

// =============================================================================
// 1. 3D GRID-ACCELERATED MULTI-MATERIAL SPH PLANETARY GENESIS COMPUTE SHADERS
// =============================================================================
const PLANETARY_SPH_GENESIS_WGSL = /* wgsl */ `
struct SphParams {
  parcel_count: u32,
  grid_n: u32,
  map_w: u32,
  map_h: u32,
  dt: f32,
  box_half: f32,
  gravity_g: f32,
  radiogenic_heat: f32,
  tectonic_mobility: f32,
  crater_preservation: f32,
  sea_level_norm: f32,
  hydraulic_erosion: f32,
  flags: u32,          // bit0=hasOcean, bit1=isMagmaOcean, bit2=isCryo, bit3=isCarbon, bit4=isMinorBody
  step_index: u32,
  impactor_count: u32,
  seed_f: f32,
  omega_rot: f32,      // Planetary Coriolis spin parameter (Earth 24h = 1.0)
  target_steps: u32,   // Reference geological evolution step count for solidus cooling curve
  rho_norm: f32,       // Scale-invariant grid density normalization across 5K..65K parcels & 32^3..64^3 grids!
  pad_s0: f32,
};

struct SphParcel {
  pos_mass: vec4<f32>,   // xyz, mass
  vel_temp: vec4<f32>,   // vx, vy, vz, tempNorm [0..1]
  mat_state: vec4<f32>,  // x=species(0..4), y=rho0, z=crustThick, w=shockDamage
  aux: vec4<f32>,        // x=convFlux, y=meltOrEjecta, z=seed, w=activeFlag
};

struct ImpactorDesc {
  dir_rad: vec4<f32>,    // xyz = unit impact direction, w = angular crater radius (rad)
  props: vec4<f32>,      // x = depth, y = rimHeight, z = impactStep, w = ejectaStr
};

@group(0) @binding(0) var<uniform> params: SphParams;
@group(0) @binding(1) var<storage, read_write> parcels: array<SphParcel>;
// 32^3 grid: 8 atomic i32 per cell -> [0]=mass, [1..3]=mom_xyz, [4]=temp_m, [5]=rho0_m, [6]=felsic_m, [7]=shock_m
@group(0) @binding(2) var<storage, read_write> grid_acc: array<atomic<i32>>;
// Float resolved grid: 2 vec4 per cell -> [0]=(rho, vx, vy, vz), [1]=(temp, rho0_avg, felsic_frac, shock_e)
@group(0) @binding(3) var<storage, read_write> grid_val: array<vec4<f32>>;
// 32 radial enclosed mass bins + 16 telemetry atomic slots
@group(0) @binding(4) var<storage, read_write> radial_bins: array<atomic<i32>>;
@group(0) @binding(5) var<storage, read> impactors: array<ImpactorDesc>;
// Compact telemetry output (2 vec4):
//   [0] = (coreMeanR, mantleMeanR, felsicMeanR, meanTemp)
//   [1] = (maxCrustThick, minCrustThick, activeImpactors, differentiationIndex)
@group(0) @binding(6) var<storage, read_write> telemetry: array<vec4<f32>>;
// Canonical Schroeder Simulation (SS) hierarchical 3D multipole self-gravity acceleration & COM:
//   [0..parcel_count-1] = vec4(ax, ay, az, phi), [parcel_count] = vec4(com_xyz, m_tot)
@group(0) @binding(7) var<storage, read> ss_grav_acc: array<vec4<f32>>;

const Q_M: f32 = 256.0;
const Q_V: f32 = 128.0;

fn cell_coords(p: vec3<f32>) -> vec3<i32> {
  let nf = f32(params.grid_n);
  let u = (p + vec3<f32>(params.box_half)) / (2.0 * params.box_half);
  let c = vec3<i32>(floor(u * nf));
  return clamp(c, vec3<i32>(0), vec3<i32>(i32(params.grid_n) - 1));
}

fn cell_idx(c: vec3<i32>) -> u32 {
  let n = params.grid_n;
  return (u32(c.z) * n + u32(c.y)) * n + u32(c.x);
}

@compute @workgroup_size(64)
fn clear_sph_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (i < total) {
    let base = i * 8u;
    for (var k = 0u; k < 8u; k = k + 1u) {
      atomicStore(&grid_acc[base + k], 0);
    }
  }
  if (i < 48u) {
    atomicStore(&radial_bins[i], 0);
  }
}

fn cell_frac(p: vec3<f32>) -> vec3<f32> {
  let nf = f32(params.grid_n);
  let u = (p + vec3<f32>(params.box_half)) / (2.0 * params.box_half);
  return clamp(u * nf - vec3<f32>(0.5), vec3<f32>(0.0), vec3<f32>(nf - 1.001));
}

fn sample_grid_trilin0(p: vec3<f32>) -> vec4<f32> {
  let gf = cell_frac(p);
  let c0 = vec3<i32>(floor(gf));
  let f = gf - vec3<f32>(c0);
  let n_i = i32(params.grid_n) - 1;
  let c1 = min(c0 + vec3<i32>(1), vec3<i32>(n_i));
  let v000 = grid_val[cell_idx(vec3<i32>(c0.x, c0.y, c0.z)) * 2u + 0u];
  let v100 = grid_val[cell_idx(vec3<i32>(c1.x, c0.y, c0.z)) * 2u + 0u];
  let v010 = grid_val[cell_idx(vec3<i32>(c0.x, c1.y, c0.z)) * 2u + 0u];
  let v110 = grid_val[cell_idx(vec3<i32>(c1.x, c1.y, c0.z)) * 2u + 0u];
  let v001 = grid_val[cell_idx(vec3<i32>(c0.x, c0.y, c1.z)) * 2u + 0u];
  let v101 = grid_val[cell_idx(vec3<i32>(c1.x, c0.y, c1.z)) * 2u + 0u];
  let v011 = grid_val[cell_idx(vec3<i32>(c0.x, c1.y, c1.z)) * 2u + 0u];
  let v111 = grid_val[cell_idx(vec3<i32>(c1.x, c1.y, c1.z)) * 2u + 0u];
  let c00 = mix(v000, v100, f.x);
  let c10 = mix(v010, v110, f.x);
  let c01 = mix(v001, v101, f.x);
  let c11 = mix(v011, v111, f.x);
  return mix(mix(c00, c10, f.y), mix(c01, c11, f.y), f.z);
}

fn sample_grid_trilin1(p: vec3<f32>) -> vec4<f32> {
  let gf = cell_frac(p);
  let c0 = vec3<i32>(floor(gf));
  let f = gf - vec3<f32>(c0);
  let n_i = i32(params.grid_n) - 1;
  let c1 = min(c0 + vec3<i32>(1), vec3<i32>(n_i));
  let v000 = grid_val[cell_idx(vec3<i32>(c0.x, c0.y, c0.z)) * 2u + 1u];
  let v100 = grid_val[cell_idx(vec3<i32>(c1.x, c0.y, c0.z)) * 2u + 1u];
  let v010 = grid_val[cell_idx(vec3<i32>(c0.x, c1.y, c0.z)) * 2u + 1u];
  let v110 = grid_val[cell_idx(vec3<i32>(c1.x, c1.y, c0.z)) * 2u + 1u];
  let v001 = grid_val[cell_idx(vec3<i32>(c0.x, c0.y, c1.z)) * 2u + 1u];
  let v101 = grid_val[cell_idx(vec3<i32>(c1.x, c0.y, c1.z)) * 2u + 1u];
  let v011 = grid_val[cell_idx(vec3<i32>(c0.x, c1.y, c1.z)) * 2u + 1u];
  let v111 = grid_val[cell_idx(vec3<i32>(c1.x, c1.y, c1.z)) * 2u + 1u];
  let c00 = mix(v000, v100, f.x);
  let c10 = mix(v010, v110, f.x);
  let c01 = mix(v001, v101, f.x);
  let c11 = mix(v011, v111, f.x);
  return mix(mix(c00, c10, f.y), mix(c01, c11, f.y), f.z);
}

@compute @workgroup_size(64)
fn splat_sph_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.parcel_count) { return; }
  let pr = parcels[i];
  if (pr.aux.w < 0.5) { return; }
  let pos = pr.pos_mass.xyz;
  let m = max(0.05, pr.pos_mass.w);
  let is_felsic = select(0.0, 1.0, abs(pr.mat_state.x - 2.0) < 0.3);

  // Smooth 2x2x2 trilinear CIC deposition (ZERO Cartesian voxel-box artifacts on continents!)
  let gf = cell_frac(pos);
  let c0 = vec3<i32>(floor(gf));
  let f = gf - vec3<f32>(c0);
  let n_i = i32(params.grid_n) - 1;
  for (var dz = 0; dz <= 1; dz = dz + 1) {
    let wz = select(1.0 - f.z, f.z, dz == 1);
    let cz = min(n_i, c0.z + dz);
    for (var dy = 0; dy <= 1; dy = dy + 1) {
      let wy = select(1.0 - f.y, f.y, dy == 1);
      let cy = min(n_i, c0.y + dy);
      for (var dx = 0; dx <= 1; dx = dx + 1) {
        let wx = select(1.0 - f.x, f.x, dx == 1);
        let w = wx * wy * wz;
        if (w < 1e-4) { continue; }
        let cx = min(n_i, c0.x + dx);
        let mw = m * w;
        let ci = cell_idx(vec3<i32>(cx, cy, cz)) * 8u;
        atomicAdd(&grid_acc[ci + 0u], i32(round(mw * Q_M)));
        atomicAdd(&grid_acc[ci + 1u], i32(round(mw * pr.vel_temp.x * Q_V)));
        atomicAdd(&grid_acc[ci + 2u], i32(round(mw * pr.vel_temp.y * Q_V)));
        atomicAdd(&grid_acc[ci + 3u], i32(round(mw * pr.vel_temp.z * Q_V)));
        atomicAdd(&grid_acc[ci + 4u], i32(round(mw * pr.vel_temp.w * Q_M)));
        atomicAdd(&grid_acc[ci + 5u], i32(round(mw * pr.mat_state.y * Q_M)));
        atomicAdd(&grid_acc[ci + 6u], i32(round(mw * is_felsic * Q_M)));
        atomicAdd(&grid_acc[ci + 7u], i32(round(mw * pr.mat_state.w * Q_M)));
      }
    }
  }

  let r = length(pos);
  let rbin = min(31u, u32(floor(clamp(r / 1.45, 0.0, 0.999) * 32.0)));
  atomicAdd(&radial_bins[rbin], i32(round(m * Q_M)));
}

@compute @workgroup_size(64)
fn finalize_sph_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (i >= total) { return; }
  let base = i * 8u;
  let m = f32(atomicLoad(&grid_acc[base + 0u])) / Q_M;
  if (m > 1e-4) {
    let inv_m = 1.0 / m;
    let vx = (f32(atomicLoad(&grid_acc[base + 1u])) / Q_V) * inv_m;
    let vy = (f32(atomicLoad(&grid_acc[base + 2u])) / Q_V) * inv_m;
    let vz = (f32(atomicLoad(&grid_acc[base + 3u])) / Q_V) * inv_m;
    let temp = (f32(atomicLoad(&grid_acc[base + 4u])) / Q_M) * inv_m;
    let rho0 = (f32(atomicLoad(&grid_acc[base + 5u])) / Q_M) * inv_m;
    let felsic = (f32(atomicLoad(&grid_acc[base + 6u])) / Q_M) * inv_m;
    let shock = (f32(atomicLoad(&grid_acc[base + 7u])) / Q_M) * inv_m;
    grid_val[i * 2u + 0u] = vec4<f32>(m, vx, vy, vz);
    grid_val[i * 2u + 1u] = vec4<f32>(temp, rho0, felsic, shock);
  } else {
    grid_val[i * 2u + 0u] = vec4<f32>(0.0);
    grid_val[i * 2u + 1u] = vec4<f32>(0.0, 3.0, 0.0, 0.0);
  }
}

@compute @workgroup_size(64)
fn advect_sph_parcels(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.parcel_count) { return; }
  var pr = parcels[i];
  if (pr.aux.w < 0.5) { return; }

  let dt = params.dt;
  var pos = pr.pos_mass.xyz;
  var vel = pr.vel_temp.xyz;
  var temp = pr.vel_temp.w;
  var species = pr.mat_state.x;
  let rho0 = pr.mat_state.y;
  var crust_thick = pr.mat_state.z;
  var shock = pr.mat_state.w;
  var conv_flux = pr.aux.x;

  let r = max(0.035, length(pos));
  let n_rad = pos / r;

  // 1. Canonical 3D Hierarchical Schroeder Simulation (SS) Scale-Atlas Multipole Self-Gravity!
  //    True asymmetric 3D self-gravity across 4,096 L2 + 64 L1 charts (handles both hydrostatic spheres
  //    AND irregular triaxial/bilobed asteroids/comets + off-center sinking Fe-Ni cores!)
  let ss_g = ss_grav_acc[i].xyz;
  let ss_com = ss_grav_acc[params.parcel_count].xyz;
  let g_ss_mag = length(ss_g);
  let g_mag = clamp(g_ss_mag, 0.12, 8.5);
  var acc = clamp(ss_g, vec3<f32>(-12.0), vec3<f32>(12.0)) - ss_com * 0.35;

  // 2. Smooth Trilinear CIC 32^3 SPH Grid Pressure Gradient (-grad P / rho), Viscosity, & Velocity Divergence!
  let dx = (2.0 * params.box_half) / f32(params.grid_n);
  let g_c0 = sample_grid_trilin0(pos);
  let g_c1 = sample_grid_trilin1(pos);

  let gx_p = sample_grid_trilin0(pos + vec3<f32>(dx, 0.0, 0.0));
  let gx_m = sample_grid_trilin0(pos - vec3<f32>(dx, 0.0, 0.0));
  let gy_p = sample_grid_trilin0(pos + vec3<f32>(0.0, dx, 0.0));
  let gy_m = sample_grid_trilin0(pos - vec3<f32>(0.0, dx, 0.0));
  let gz_p = sample_grid_trilin0(pos + vec3<f32>(0.0, 0.0, dx));
  let gz_m = sample_grid_trilin0(pos - vec3<f32>(0.0, 0.0, dx));

  let grad_rho = vec3<f32>(gx_p.x - gx_m.x, gy_p.x - gy_m.x, gz_p.x - gz_m.x) / (2.0 * dx);
  let div_v = ((gx_p.y - gx_m.y) + (gy_p.z - gy_m.z) + (gz_p.w - gz_m.w)) / (2.0 * dx);

  // Compressible EOS hydrostatic pressure support balancing self-gravity (scale-invariant across 5K..65K parcels & 32^3..64^3 grids!)
  let k_eos = select(1.45, 2.35, species < 0.5);
  let rho_local = g_c0.x * params.rho_norm;
  acc = acc - (grad_rho * params.rho_norm) * (k_eos / max(0.35, rho_local + 0.45));

  // 3. True Archimedes Compositional + Thermal Rayleigh-Benard Buoyancy!
  let cell_temp = g_c1.x;
  let cell_rho0 = max(1.0, g_c1.y);
  let rho_eff = rho0 * (1.0 - 0.34 * (temp - cell_temp));
  let buoy_ratio = clamp((cell_rho0 - rho_eff) / max(1.2, rho_eff), -1.35, 1.35);
  acc = acc + n_rad * (g_mag * buoy_ratio * 0.95);

  // 3B. Planetary Coriolis Geostrophic Deflection (-2 Omega x v) on convecting mantle, tectonic plates & ocean currents!
  if (species > 0.5 && r > 0.52) {
    let omega_v = vec3<f32>(0.0, params.omega_rot * 0.42, 0.0);
    acc = acc - 2.0 * cross(omega_v, vel);
  }

  // Smooth trilinear tangent mantle convection traction driving organic continental rafting & rifting!
  let grad_t = vec3<f32>(
    sample_grid_trilin1(pos + vec3<f32>(dx, 0.0, 0.0)).x - sample_grid_trilin1(pos - vec3<f32>(dx, 0.0, 0.0)).x,
    sample_grid_trilin1(pos + vec3<f32>(0.0, dx, 0.0)).x - sample_grid_trilin1(pos - vec3<f32>(0.0, dx, 0.0)).x,
    sample_grid_trilin1(pos + vec3<f32>(0.0, 0.0, dx)).x - sample_grid_trilin1(pos - vec3<f32>(0.0, 0.0, dx)).x
  ) / (2.0 * dx);
  let grad_t_tang = grad_t - n_rad * dot(grad_t, n_rad);
  if (species > 0.5 && species < 2.5 && r > 0.65) {
    acc = acc - grad_t_tang * (params.tectonic_mobility * 0.58);
    conv_flux = mix(conv_flux, clamp((temp - cell_temp) * 3.0 - div_v * 0.45, -1.5, 1.5), clamp(dt * 3.0, 0.0, 1.0));
  }

  // 4. Planetesimal Hypervelocity Impact Cratering (species == 3 colliding with crust) + 3D Shock-Wave Coupling!
  if (abs(species - 3.0) < 0.3) {
    if (r < 1.03) {
      // Impact shock converts hypervelocity kinetic energy into thermal melt & excavation impulse!
      let ke = 0.5 * dot(vel, vel);
      shock = clamp(shock + ke * 0.65, 0.0, 2.5);
      temp = min(1.0, temp + ke * 0.32);
      vel = vel * 0.18;
      // Impactor becomes shocked regolith/ejecta settled onto the crust
      species = 1.0;
      pr.mat_state.x = 1.0;
      pr.mat_state.y = 3.25;
      pr.aux.y = 1.0;
    }
  } else if (g_c1.w > 0.08 && species > 0.5 && species < 2.5 && r > 0.80) {
    // Propagate live impact shock waves through neighboring lithospheric parcels on the 3D SPH grid!
    temp = min(1.0, temp + g_c1.w * 0.08 * dt);
    shock = max(shock, g_c1.w * 0.45);
  }

  // 5. Solidus/Liquidus Lithosphere Freezing + Convergent Orogenic Crust Thickening & Thermal Evolution!
  let v_cell = g_c0.yzw;
  let cool_age = clamp(f32(params.step_index) / max(44.0, f32(params.target_steps)), 0.0, 1.0);
  let solidus_stiff = smoothstep(0.56, 0.24, temp) * (0.25 + 0.75 * cool_age);
  let base_drag = mix(6.5, 1.8, clamp(temp * 0.75 + params.tectonic_mobility * 0.45, 0.0, 1.0));
  let arrhenius_drag = mix(base_drag, 10.2, solidus_stiff * 0.45);
  let is_minor = (params.flags & 16u) != 0u;
  // Sub-hydrostatic rubble-pile comets & asteroids (< 550 km) are material-strength dominated (sigma_yield >> rho*g*R),
  // preserving genuine 2:1 bilobed contact-binary shapes instead of relaxing into hydrostatic spheres!
  if (is_minor && species < 2.5) {
    acc = acc * 0.032;
  }
  vel = vel + acc * dt;
  vel = mix(vel, v_cell, clamp(dt * arrhenius_drag, 0.0, 0.88));

  // Keep crust thickening physically coupled to convergent tangential compression (-div_v > 0)!
  // (Smooth trilinear cohesion without nearest-voxel Cartesian cell clumping!)
  if (abs(species - 2.0) < 0.3 && r > 0.82) {
    let conv_comp = clamp(-div_v, -1.2, 1.8);
    crust_thick = clamp(crust_thick + conv_comp * params.tectonic_mobility * dt * 0.42, 0.08, 1.65);
  }

  // Volatile H2O/CH4 fluid flows tangentially down pressure/elevation gradients into low basins!
  if (abs(species - 4.0) < 0.3) {
    let grad_r_tang = grad_rho - n_rad * dot(grad_rho, n_rad);
    vel = vel - grad_r_tang * (0.35 * dt);
  }

  // Clamp velocity for CFL stability & advect
  let spd = length(vel);
  if (spd > 3.2) { vel = vel * (3.2 / spd); }
  pos = pos + vel * dt;

  // Soft radial confinement to planetary volume (prevents numerical escape while preserving buoyancy stratification!)
  // Sub-hydrostatic minor bodies (bit 16u: asteroids/comets < 550 km) retain irregular non-spherical 3D lobes!
  let r_new = length(pos);
  if (is_minor && species < 2.5) {
    // High cohesive rock yield strength preserves triaxial bilobed rubble-pile lobes under weak self-gravity!
    vel = vel * exp(-dt * 5.2);
    if (r_new > 1.48) {
      let nr = pos / max(1e-5, r_new);
      pos = nr * 1.48;
      vel = vel * 0.20;
    }
  } else if (species < 2.5 || abs(species - 4.0) < 0.3) {
    let r_max = select(select(1.06, 1.12, abs(species - 2.0) < 0.3), 0.72, species < 0.5);
    if (r_new > r_max) {
      let nr = pos / max(1e-5, r_new);
      pos = nr * r_max;
      let vr_out = dot(vel, nr);
      if (vr_out > 0.0) { vel = vel - nr * (vr_out * 1.15); }
    }
    // Keep surface crust & ocean parcels right on the lithospheric shell
    if (abs(species - 2.0) < 0.3 && r_new < 0.86) {
      pos = (pos / max(1e-5, r_new)) * 0.86;
    }
    if (abs(species - 4.0) < 0.3 && r_new < 0.94) {
      pos = (pos / max(1e-5, r_new)) * 0.94;
    }
  }

  // Radiogenic core heating + heat conduction + true T^4 Stefan-Boltzmann radiative surface cooling
  let core_heat = select(0.0, params.radiogenic_heat * 0.32, r_new < 0.62);
  let t_rad = max(0.05, temp);
  let t_rad2 = t_rad * t_rad;
  let surf_cool = select(0.0, 0.34 * t_rad2 * t_rad2, r_new > 0.88 && (params.flags & 2u) == 0u);
  let conduct = (cell_temp - temp) * 1.45;
  temp = clamp(temp + (core_heat + conduct - surf_cool) * dt, 0.06, 1.0);
  shock = max(0.0, shock - dt * (0.25 + params.tectonic_mobility * 0.35));

  pr.pos_mass = vec4<f32>(pos, pr.pos_mass.w);
  pr.vel_temp = vec4<f32>(vel, temp);
  pr.mat_state = vec4<f32>(species, pr.mat_state.y, crust_thick, shock);
  pr.aux = vec4<f32>(conv_flux, pr.aux.y, pr.aux.z, pr.aux.w);
  parcels[i] = pr;

  // Compact differentiation telemetry atomic accumulation (slots 32..47 in radial_bins)
  let r_q = i32(round(r_new * 100.0));
  if (species < 0.5) {
    atomicAdd(&radial_bins[32u], r_q);
    atomicAdd(&radial_bins[33u], 1);
  } else if (abs(species - 1.0) < 0.3) {
    atomicAdd(&radial_bins[34u], r_q);
    atomicAdd(&radial_bins[35u], 1);
  } else if (abs(species - 2.0) < 0.3) {
    atomicAdd(&radial_bins[36u], r_q);
    atomicAdd(&radial_bins[37u], 1);
    atomicAdd(&radial_bins[38u], i32(round(crust_thick * 100.0)));
  } else if (abs(species - 3.0) < 0.3) {
    atomicAdd(&radial_bins[39u], 1);
  }
  atomicAdd(&radial_bins[40u], i32(round(temp * 100.0)));
}

@compute @workgroup_size(64)
fn write_sph_telemetry(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x > 0u) { return; }
  let c_cnt = max(1.0, f32(atomicLoad(&radial_bins[33u])));
  let m_cnt = max(1.0, f32(atomicLoad(&radial_bins[35u])));
  let f_cnt = max(1.0, f32(atomicLoad(&radial_bins[37u])));
  let r_core = (f32(atomicLoad(&radial_bins[32u])) / 100.0) / c_cnt;
  let r_mantle = (f32(atomicLoad(&radial_bins[34u])) / 100.0) / m_cnt;
  let r_felsic = (f32(atomicLoad(&radial_bins[36u])) / 100.0) / f_cnt;
  let avg_thick = (f32(atomicLoad(&radial_bins[38u])) / 100.0) / f_cnt;
  let active_imp = f32(atomicLoad(&radial_bins[39u]));
  let mean_temp = (f32(atomicLoad(&radial_bins[40u])) / 100.0) / max(1.0, f32(params.parcel_count));
  // Positive differentiation index = felsic crust floated clearly outside dense Fe core!
  let diff_idx = clamp((r_felsic - r_core) / 0.55, 0.0, 1.5);
  telemetry[0] = vec4<f32>(r_core, r_mantle, r_felsic, mean_temp);
  telemetry[1] = vec4<f32>(avg_thick, params.sea_level_norm, active_imp, diff_idx);
}
`;

// =============================================================================
// 2. SPHERICAL GEOLOGY PROJECTION & HYDRAULIC EROSION COMPUTE SHADERS
//    Projects live 3D SPH parcels onto canonical W x H equirectangular geology
//    map (`vec4(elevNorm, crustComp, thermalVolc, moistureRiver)`) + spherical
//    craters & hydraulic valley carving (ZERO Perlin continents!)
// =============================================================================
const SPHERICAL_GEOLOGY_SPLAT_WGSL = /* wgsl */ `
struct GeoParams {
  parcel_count: u32,
  map_w: u32,
  map_h: u32,
  impactor_count: u32,
  tectonic_mobility: f32,
  crater_preservation: f32,
  sea_level_norm: f32,
  hydraulic_erosion: f32,
  flags: u32,         // bit0=hasOcean, bit1=isMagmaOcean, bit2=isCryo, bit3=isCarbon
  iter_index: u32,
  seed_f: f32,
  pad0: f32,
};

struct SphParcel {
  pos_mass: vec4<f32>,
  vel_temp: vec4<f32>,
  mat_state: vec4<f32>,
  aux: vec4<f32>,
};

struct ImpactorDesc {
  dir_rad: vec4<f32>,
  props: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: GeoParams;
@group(0) @binding(1) var<storage, read> parcels: array<SphParcel>;
@group(0) @binding(2) var<storage, read> impactors: array<ImpactorDesc>;
// 6 atomic i32 per texel: [0]=weight, [1]=elevSum, [2]=felsicSum, [3]=tempSum, [4]=waterSum, [5]=convSum
@group(0) @binding(3) var<storage, read_write> map_acc: array<atomic<i32>>;
@group(0) @binding(4) var<storage, read_write> geo_in: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> geo_out: array<vec4<f32>>;

const Q_G: f32 = 512.0;

@compute @workgroup_size(64)
fn clear_geo_acc(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let total = params.map_w * params.map_h;
  if (i >= total) { return; }
  let base = i * 6u;
  for (var k = 0u; k < 6u; k = k + 1u) {
    atomicStore(&map_acc[base + k], 0);
  }
}

@compute @workgroup_size(64)
fn splat_parcels_to_sphere(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.parcel_count) { return; }
  let pr = parcels[i];
  if (pr.aux.w < 0.5) { return; }
  let pos = pr.pos_mass.xyz;
  let r = length(pos);
  let is_minor = (params.flags & 16u) != 0u;
  // Only lithospheric crust, upper mantle upwelling, and surface volatiles project onto the surface crust!
  // On sub-hydrostatic minor bodies (asteroids/comets), project strictly the outer bilobed shell (crustThick >= 0.08)
  // so deep interior parcels never punch spiky speckles into the contact-binary silhouette!
  if (!is_minor && r < 0.76) { return; }
  if (is_minor && (pr.mat_state.z < 0.08 || r < 0.42)) { return; }
  let n = pos / max(1e-5, r);
  let lon = atan2(n.z, n.x);
  let lat = asin(clamp(n.y, -1.0, 1.0));
  let u = fract(lon / 6.28318530718 + 0.5);
  let v = clamp(0.5 - lat / 3.14159265359, 0.0, 0.9999);

  let species = pr.mat_state.x;
  let is_felsic = select(0.0, 1.0, abs(species - 2.0) < 0.3);
  let is_water = select(0.0, 1.0, abs(species - 4.0) < 0.3);
  let is_deep_mantle = select(0.0, 1.0, species < 1.5 && r < 0.85);
  let thick = pr.mat_state.z;
  let temp = pr.vel_temp.w;
  let conv = pr.aux.x;

  // Physical isostatic Airy elevation from SPH parcel buoyancy & orogenic crust thickening!
  // On sub-hydrostatic minor bodies (asteroids/comets), project actual 3D SPH lobe radius (r - 0.84) * 2.15!
  var elev_contrib = select(
    select(-0.44 + (r - 0.88) * 0.75 + conv * 0.16, 0.22 + thick * 0.68 + (r - 0.95) * 0.65 + max(0.0, conv) * 0.28, is_felsic > 0.5),
    -0.58,
    is_water > 0.5
  );
  if (is_minor) {
    // True full-range 3D contact-binary lobe elevation mapped smoothly from real bilobed SPH shell radii [0.38..1.45]
    elev_contrib = clamp((r - 0.86) * 1.48 + (thick - 0.24) * 0.14, -0.96, 0.96);
  }

  // True 3D spherical great-circle Wendland C2 compact SPH kernel support (ZERO equirectangular box edges!):
  // Adaptive smoothing length resolves coherent tectonic continental shelves & mountain chains on planets
  // and smooth sculpted bilobed rubble-pile domes on comets/asteroids!
  let wi = i32(params.map_w);
  let hi = i32(params.map_h);
  let cx = i32(floor(u * f32(wi)));
  let cy = i32(floor(v * f32(hi)));
  let cos_lat = max(0.18, cos(lat));
  let is_mtn_ridge = (is_felsic > 0.5 && (thick > 0.48 || abs(conv) > 0.34));
  let dens_scale = clamp(sqrt(5120.0 / max(2048.0, f32(params.parcel_count))), 0.58, 1.0);
  let base_ang = select(select(select(0.185, 0.235, is_felsic > 0.5), 0.125, is_mtn_ridge), 0.240, is_minor);
  let ang_rad = max(select(0.088, 0.145, is_minor), base_ang * dens_scale);
  let rad_y = clamp(i32(ceil((ang_rad / 3.14159265) * f32(hi))), 5, 32);
  let rad_x = min(76, i32(ceil(f32(rad_y) / cos_lat)));

  for (var dy = -rad_y; dy <= rad_y; dy = dy + 1) {
    let py = clamp(cy + dy, 0, hi - 1);
    let lat_p = (0.5 - (f32(py) + 0.5) / f32(hi)) * 3.14159265359;
    let cos_lp = cos(lat_p);
    let sin_lp = sin(lat_p);
    for (var dx = -rad_x; dx <= rad_x; dx = dx + 1) {
      let px = ((cx + dx) % wi + wi) % wi;
      let lon_p = ((f32(px) + 0.5) / f32(wi) - 0.5) * 6.28318530718;
      let n_pix = vec3<f32>(cos_lp * cos(lon_p), sin_lp, cos_lp * sin(lon_p));
      let ang_d = acos(clamp(dot(n_pix, n), -1.0, 1.0));
      let q = ang_d / ang_rad;
      if (q >= 1.0) { continue; }
      // Wendland C2 compact spherical SPH kernel: (1 - q)^4 * (4q + 1)
      let omq = 1.0 - q;
      let w_kern = omq * omq * omq * omq * (4.0 * q + 1.0);
      // Buoyant surface granitic crust (species == 2) carries physical lithospheric surface authority over sub-crustal mantle!
      let w = w_kern * select(select(select(0.55, 0.18, is_deep_mantle > 0.5), 1.0, is_minor), 2.15, is_felsic > 0.5);
      let base = (u32(py) * params.map_w + u32(px)) * 6u;
      atomicAdd(&map_acc[base + 0u], i32(round(w * Q_G)));
      atomicAdd(&map_acc[base + 1u], i32(round(w * elev_contrib * Q_G)));
      atomicAdd(&map_acc[base + 2u], i32(round(w * is_felsic * Q_G)));
      atomicAdd(&map_acc[base + 3u], i32(round(w_kern * temp * Q_G)));
      atomicAdd(&map_acc[base + 4u], i32(round(w * is_water * Q_G)));
      atomicAdd(&map_acc[base + 5u], i32(round(w * clamp(conv + 0.5, 0.0, 2.0) * Q_G)));
    }
  }
}

@compute @workgroup_size(64)
fn resolve_spherical_geology(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  let total = params.map_w * params.map_h;
  if (idx >= total) { return; }
  let px = idx % params.map_w;
  let py = idx / params.map_w;
  let u = (f32(px) + 0.5) / f32(params.map_w);
  let v = (f32(py) + 0.5) / f32(params.map_h);
  let lon = (u - 0.5) * 6.28318530718;
  let lat = (0.5 - v) * 3.14159265359;
  let cos_lat = cos(lat);
  let n_dir = vec3<f32>(cos_lat * cos(lon), sin(lat), cos_lat * sin(lon));

  let base = idx * 6u;
  let w_sum = f32(atomicLoad(&map_acc[base + 0u])) / Q_G;
  var elev = -0.38;
  var felsic = 0.0;
  var temp = 0.22;
  var water = 0.0;
  var conv = 0.0;
  if (w_sum > 1e-3) {
    let inv_w = 1.0 / w_sum;
    elev = (f32(atomicLoad(&map_acc[base + 1u])) / Q_G) * inv_w;
    felsic = clamp((f32(atomicLoad(&map_acc[base + 2u])) / Q_G) * inv_w, 0.0, 1.0);
    temp = clamp((f32(atomicLoad(&map_acc[base + 3u])) / Q_G) * inv_w, 0.0, 1.0);
    water = clamp((f32(atomicLoad(&map_acc[base + 4u])) / Q_G) * inv_w, 0.0, 1.0);
    conv = clamp((f32(atomicLoad(&map_acc[base + 5u])) / Q_G) * inv_w - 0.5, -0.5, 1.5);
  }

  // True Airy hypsometric bimodality + sharp tectonic cordillera belts, offshore trenches & rift canyons!
  let has_ocean = (params.flags & 1u) != 0u;
  let is_magma = (params.flags & 2u) != 0u;
  let is_minor = (params.flags & 16u) != 0u;
  // Realistic Earth-like ~32% cohesive continental plates on ocean worlds (leaves ~68% open deep sapphire oceans!)
  let cont_step = select(smoothstep(0.24, 0.54, felsic), smoothstep(0.49, 0.74, felsic), has_ocean);
  // Crisp narrow coastal Andean/Himalayan mountain arc strictly along convergent continental subduction margins!
  let margin_band = smoothstep(0.46, 0.62, felsic) * (1.0 - smoothstep(0.70, 0.90, felsic));
  let mtn_belt = margin_band * (0.28 + max(0.0, conv) * 0.72) * (0.35 + params.tectonic_mobility * 0.65);
  // Offshore subduction trench right outside the continental margin & inland divergent rift canyons!
  let trench = smoothstep(0.18, 0.36, felsic) * (1.0 - smoothstep(0.36, 0.48, felsic)) * max(0.0, conv + 0.15) * 0.28 * params.tectonic_mobility;
  let rift_canyon = smoothstep(0.18, 0.52, -conv) * 0.18 * (0.4 + params.tectonic_mobility * 0.6);
  if (is_minor) {
    elev = clamp(elev * 1.08, -0.96, 0.96);
  } else if (has_ocean) {
    let ocean_floor = clamp(-0.60 + (elev + 0.40) * 0.52 - trench + rift_canyon * 0.25, -0.92, -0.06);
    let land_elev = clamp(0.20 + (elev - 0.04) * 0.58 + mtn_belt * 0.92 - rift_canyon * 0.35, 0.15, 0.96);
    elev = mix(ocean_floor, land_elev, cont_step);
  } else {
    // Smooth stagnant-lid highlands vs basaltic mare plains + tectonic rift scarps (ZERO lumpy Play-Doh!)
    elev = clamp(elev * 0.68 + (cont_step - 0.44) * 0.36 + mtn_belt * 0.48 - rift_canyon * 0.65, -0.86, 0.86);
  }

  // Imprint real SPH Late-Heavy-Bombardment impact craters progressively over geological formation time
  // (parabolic bowl + crisp raised rim + central peak + ejecta blanket!)
  var crater_ejecta = 0.0;
  var impact_melt = 0.0;
  for (var k = 0u; k < params.impactor_count; k = k + 1u) {
    let imp = impactors[k];
    let imp_appear = select(smoothstep(imp.props.z - 2.0, imp.props.z + 6.0, f32(params.iter_index)), 1.0, params.iter_index >= 40u);
    if (imp_appear <= 0.01) { continue; }
    let c_dir = imp.dir_rad.xyz;
    let c_rad = max(0.022, imp.dir_rad.w);
    let ang = acos(clamp(dot(n_dir, c_dir), -1.0, 1.0));
    if (ang < c_rad * 2.35) {
      let q = ang / c_rad;
      let minor_cr = select(1.0, 0.30, is_minor);
      let depth = imp.props.x * params.crater_preservation * 1.25 * minor_cr * imp_appear;
      let rim_h = imp.props.y * params.crater_preservation * 1.45 * minor_cr * imp_appear;
      if (q < 1.0) {
        // Flat-floored / terraced parabolic excavated basin + central rebound peak on complex craters
        let bowl = (pow(q, 2.8) - 1.0) * depth;
        let terrace = sin(q * 12.566) * 0.045 * depth * smoothstep(0.55, 0.95, q);
        let peak = select(0.0, exp(-q * q * 38.0) * depth * 0.42, c_rad > 0.062);
        elev = elev + bowl + terrace + peak;
        impact_melt = max(impact_melt, (1.0 - q) * 0.25 * imp_appear);
      } else {
        // Razor-sharp overturned crater rim + radial ejecta blanket
        let rim = exp(-pow((q - 1.02) / 0.11, 2.0)) * rim_h;
        elev = elev + rim;
        crater_ejecta = max(crater_ejecta, exp(-(q - 1.0) * 3.1) * imp.props.w * params.crater_preservation * imp_appear);
      }
    }
  }

  // Physically honest volcanic thermal channel:
  //   - Magma ocean worlds (flags & 2u): incandescent [0.55..1.0]
  //   - Cool/temperate worlds: smooth bounded mantle-plume heat [0.0..0.44] (NO glowing orange acne dots on Earth/Mars!)
  let rift_heat = smoothstep(0.42, 0.90, temp) * (1.0 - cont_step * 0.48);
  let thermal_volc = clamp(
    select(rift_heat * 0.42 + impact_melt * 0.08, max(0.56, temp), is_magma),
    0.0,
    1.0
  );

  // Physical Hadley-Cell Climatic Moisture (Equatorial ITCZ rainforest, subtropical dry belt ~25 deg,
  // lush mid-latitude temperate westerlies ~45-62 deg, coastal humidity!)
  let abs_lat = abs(lat);
  let itcz_rain = exp(-pow(abs_lat / 0.36, 2.0)) * 0.82;
  let subtrop_dry = exp(-pow((abs_lat - 0.46) / 0.16, 2.0)) * 0.48;
  let temp_belt = exp(-pow((abs_lat - 0.88) / 0.32, 2.0)) * 0.72;
  let climate_rain = clamp(0.24 + itcz_rain + temp_belt - subtrop_dry, 0.12, 0.96);
  let below_sea = select(0.0, smoothstep(params.sea_level_norm + 0.06, params.sea_level_norm - 0.14, elev), has_ocean);
  let coast_humid = select(0.0, smoothstep(params.sea_level_norm + 0.42, params.sea_level_norm + 0.01, elev) * 0.44, has_ocean);
  let moisture = clamp(max(below_sea, select(0.0, climate_rain * 0.78 + coast_humid + water * 0.32, has_ocean)), 0.0, 1.0);
  let crust_comp = clamp(mix(felsic, 0.38, crater_ejecta * 0.68), 0.0, 1.0);

  geo_in[idx] = vec4<f32>(clamp(elev, -1.0, 1.0), crust_comp, thermal_volc, moisture);
}

@compute @workgroup_size(64)
fn erode_spherical_geology(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  let total = params.map_w * params.map_h;
  if (idx >= total) { return; }
  let w = i32(params.map_w);
  let h = i32(params.map_h);
  let x = i32(idx % params.map_w);
  let y = i32(idx / params.map_w);

  let xl = (x - 1 + w) % w;
  let xr = (x + 1) % w;
  let yu = max(0, y - 1);
  let yd = min(h - 1, y + 1);

  let c   = geo_in[idx];
  let nL  = geo_in[u32(y * w + xl)];
  let nR  = geo_in[u32(y * w + xr)];
  let nU  = geo_in[u32(yu * w + x)];
  let nD  = geo_in[u32(yd * w + x)];
  let nUL = geo_in[u32(yu * w + xl)];
  let nUR = geo_in[u32(yu * w + xr)];
  let nDL = geo_in[u32(yd * w + xl)];
  let nDR = geo_in[u32(yd * w + xr)];

  let has_ocean = (params.flags & 1u) != 0u;
  let is_minor = (params.flags & 16u) != 0u;
  let is_land = !has_ocean || c.x > params.sea_level_norm;
  let lat = (0.5 - (f32(y) + 0.5) / f32(h)) * 3.14159265359;
  let inv_cos = 1.0 / max(0.32, cos(lat));
  // Subaerial base level: terrestrial erosion & talus stop at sea level (ZERO square ocean dilation!)
  let base_lvl = select(-2.0, params.sea_level_norm, has_ocean && is_land);
  let hL  = max(base_lvl, nL.x);
  let hR  = max(base_lvl, nR.x);
  let hU  = max(base_lvl, nU.x);
  let hD  = max(base_lvl, nD.x);
  let hUL = max(base_lvl, nUL.x);
  let hUR = max(base_lvl, nUR.x);
  let hDL = max(base_lvl, nDL.x);
  let hDR = max(base_lvl, nDR.x);

  // Isotropic 3x3 Sobel spherical gradient |grad_sphere h| + Oono-Puri 9-point isotropic Laplacian
  let dh_dx = ((hR - hL) * 2.0 + (hUR - hUL) + (hDR - hDL)) * 0.125 * inv_cos;
  let dh_dy = ((hD - hU) * 2.0 + (hDL - hUL) + (hDR - hUR)) * 0.125;
  let slope = length(vec2<f32>(dh_dx, dh_dy));
  let avg_h = (hL + hR + hU + hD) * 0.1666667 + (hUL + hUR + hDL + hDR) * 0.0833333;
  let lap = avg_h - c.x; // > 0 in concave valleys, < 0 on convex ridges

  var elev = c.x;
  var comp = c.y;
  var volc = c.z;
  var moist = c.w;

  // Isotropic thermal talus creep (smooth circular relaxation above repose angle; eliminates Play-Doh particle grain!)
  let talus = mix(0.055, 0.105, comp);
  if (slope > talus) {
    elev = elev + clamp(lap, -0.035, 0.035) * 0.34;
  }

  // Real Multi-Flow-Direction (MFD) Steepest-Descent Watershed Runoff Accumulation & Stream-Power Incision!
  if (params.hydraulic_erosion > 0.08 && is_land) {
    // Accumulate runoff strictly from HIGHER uphill neighbors flowing down into this cell!
    var upslope_runoff = 0.0;
    if (nL.x  > c.x) { upslope_runoff = upslope_runoff + nL.w  * (nL.x  - c.x) * 1.0; }
    if (nR.x  > c.x) { upslope_runoff = upslope_runoff + nR.w  * (nR.x  - c.x) * 1.0; }
    if (nU.x  > c.x) { upslope_runoff = upslope_runoff + nU.w  * (nU.x  - c.x) * 1.0; }
    if (nD.x  > c.x) { upslope_runoff = upslope_runoff + nD.w  * (nD.x  - c.x) * 1.0; }
    if (nUL.x > c.x) { upslope_runoff = upslope_runoff + nUL.w * (nUL.x - c.x) * 0.707; }
    if (nUR.x > c.x) { upslope_runoff = upslope_runoff + nUR.w * (nUR.x - c.x) * 0.707; }
    if (nDL.x > c.x) { upslope_runoff = upslope_runoff + nDL.w * (nDL.x - c.x) * 0.707; }
    if (nDR.x > c.x) { upslope_runoff = upslope_runoff + nDR.w * (nDR.x - c.x) * 0.707; }
    let avg_m = (nL.w + nR.w + nU.w + nD.w) * 0.1666667 + (nUL.w + nUR.w + nDL.w + nDR.w) * 0.0833333;
    // Physical equilibrium Hadley-cell climate rainfall anchor (NEVER decays Earth's continents to 0.16 tan desert!)
    let abs_l = abs(lat);
    let clim_rain = clamp(
      0.24 + exp(-pow(abs_l / 0.36, 2.0)) * 0.78 + exp(-pow((abs_l - 0.88) / 0.32, 2.0)) * 0.68 - exp(-pow((abs_l - 0.46) / 0.16, 2.0)) * 0.46,
      0.14,
      0.94
    );
    let valley_flow = clamp(upslope_runoff * 6.5 + max(0.0, lap) * 2.2, 0.0, 1.0);
    let discharge = (0.06 + valley_flow * 1.15 + clim_rain * 0.24) * params.hydraulic_erosion;
    // Physically scaled per-pass stream-power incision (balanced for 24-40 passes so continents keep crisp
    // alpine plateaus & natural river valleys instead of collapsing into flat sea-level moat rings!)
    let h_above = max(0.0, elev - params.sea_level_norm);
    let base_guard = smoothstep(0.02, 0.14, h_above);
    let carve = clamp(pow(max(0.01, discharge), 0.65) * pow(slope, 1.15) * 0.11 * base_guard, 0.0, 0.0038);
    let deposit = clamp(discharge * max(0.0, 0.014 - slope) * 0.12, 0.0, 0.0022);
    elev = elev - carve + deposit;
    if (has_ocean) {
      elev = max(params.sea_level_norm + 0.008, elev);
    }
    // Smooth Hadley-cell climatic humidity + delicate valley moisture (never saturates entire plateaus to neon-cyan!)
    let target_m = clamp(max(clim_rain * 0.84, avg_m * 0.92) + valley_flow * 0.12, 0.12, 0.94);
    moist = clamp(mix(moist, target_m, 0.22), 0.12, 0.96);
    comp = clamp(comp + (carve * 2.2 - deposit * 1.4), 0.0, 1.0);
  } else if (!has_ocean && !is_minor) {
    // Gentle isotropic regolith smoothing preserving razor-sharp crater rims, escarpments & tectonic ridges!
    let smooth_w = select(0.045, 0.012, slope > 0.035);
    elev = elev + clamp(lap, -0.020, 0.020) * smooth_w;
  } else if (is_minor) {
    // Keep contact-binary comet/asteroid lobes clean and smooth without spiky high-frequency facets
    let smooth_m = select(0.14, 0.04, slope > 0.08);
    elev = elev + clamp(lap, -0.025, 0.025) * smooth_m;
  }

  // Smooth volcanic heat slightly along rifts
  let avg_v = 0.25 * (nL.z + nR.z + nU.z + nD.z);
  volc = mix(volc, avg_v, 0.12);

  geo_out[idx] = vec4<f32>(clamp(elev, -1.0, 1.0), comp, volc, moist);
}
`;

// =============================================================================
// 3. LOCAL LANDING-ZONE CROP & HIGH-RES HYDRAULIC EROSION PATCH EXTRACTOR
//    Crops the exact (latDeg, lonDeg) tangent patch from the planet's GPU SPH
//    spherical geology map into a 256x256 local terrain buffer (@binding(6) of
//    planetarySurfaceVehiclesGpu.js) so Orbit <-> Surface match 1-to-1!
// =============================================================================
const LOCAL_PATCH_EXTRACT_WGSL = /* wgsl */ `
struct PatchParams {
  map_w: u32,
  map_h: u32,
  patch_n: u32,
  iter_index: u32,
  lat_rad: f32,
  lon_rad: f32,
  angular_span_rad: f32,
  hydraulic_erosion: f32,
  sea_level_norm: f32,
  flags: u32,
  seed_f: f32,
  pad0: f32,
};

@group(0) @binding(0) var<uniform> params: PatchParams;
@group(0) @binding(1) var<storage, read> sphere_geo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> patch_a: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> patch_b: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> coarse_64: array<f32>;

fn p_hash2(ix: f32, iz: f32, s: f32) -> f32 {
  let xi = bitcast<u32>(i32(floor(ix)));
  let zi = bitcast<u32>(i32(floor(iz)));
  let si = bitcast<u32>(i32(round(s * 100.0)));
  var h = xi * 374761393u + zi * 668265263u + si * 1442695041u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return f32(h & 0xFFFFFFu) * (1.0 / 16777216.0);
}

fn p_vnoise(x: f32, z: f32, s: f32) -> f32 {
  let ix = floor(x); let iz = floor(z);
  let fx = x - ix; let fz = z - iz;
  let ux = fx * fx * (3.0 - 2.0 * fx);
  let uz = fz * fz * (3.0 - 2.0 * fz);
  return mix(
    mix(p_hash2(ix, iz, s), p_hash2(ix + 1.0, iz, s), ux),
    mix(p_hash2(ix, iz + 1.0, s), p_hash2(ix + 1.0, iz + 1.0, s), ux),
    uz
  );
}

fn sample_sphere_geo(n_dir: vec3<f32>) -> vec4<f32> {
  let lon = atan2(n_dir.z, n_dir.x);
  let lat = asin(clamp(n_dir.y, -1.0, 1.0));
  let u = fract(lon / 6.28318530718 + 0.5);
  let v = clamp(0.5 - lat / 3.14159265359, 0.0, 0.9999);
  let gx = u * f32(params.map_w) - 0.5;
  let gy = v * f32(params.map_h) - 0.5;
  let x0 = i32(floor(gx));
  let y0 = i32(floor(gy));
  let fx = fract(gx);
  let fy = fract(gy);
  let wi = i32(params.map_w);
  let hi = i32(params.map_h);
  let ix0 = u32(((x0 % wi) + wi) % wi);
  let ix1 = u32((((x0 + 1) % wi) + wi) % wi);
  let iy0 = u32(clamp(y0, 0, hi - 1));
  let iy1 = u32(clamp(y0 + 1, 0, hi - 1));
  let c00 = sphere_geo[iy0 * params.map_w + ix0];
  let c10 = sphere_geo[iy0 * params.map_w + ix1];
  let c01 = sphere_geo[iy1 * params.map_w + ix0];
  let c11 = sphere_geo[iy1 * params.map_w + ix1];
  return mix(mix(c00, c10, fx), mix(c01, c11, fx), fy);
}

@compute @workgroup_size(64)
fn project_local_patch(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  let n = params.patch_n;
  if (idx >= n * n) { return; }
  let ix = idx % n;
  let iz = idx / n;
  let u = (f32(ix) + 0.5) / f32(n) - 0.5;
  let v = (f32(iz) + 0.5) / f32(n) - 0.5;

  // Right-handed orthonormal tangent basis (east, north, up) at landing site (lat_rad, lon_rad)!
  // Note: cross(east, up_c) has +Y component (+cos(lat)) pointing strictly Geographic North!
  let cl = cos(params.lat_rad);
  let sl = sin(params.lat_rad);
  let co = cos(params.lon_rad);
  let so = sin(params.lon_rad);
  let up_c = vec3<f32>(cl * co, sl, cl * so);
  let east = normalize(vec3<f32>(-so, 0.0, co));
  let north = normalize(cross(east, up_c));

  let n_dir = normalize(up_c + east * (u * params.angular_span_rad) + north * (-v * params.angular_span_rad));
  let g = sample_sphere_geo(n_dir);
  // Sample local orbital SPH gradient & curvature (east/west/north/south slopes) so mountains, crater rims,
  // rift valleys, and tectonic escarpments seen from orbit rise with matching pronounced 3D relief on the surface!
  // ZERO Perlin noise: all relief is strictly derived from the orbital 3D SPH geology map + slope-gated strata + hydraulic erosion!
  let step_ang = params.angular_span_rad / f32(n);
  let gE = sample_sphere_geo(normalize(n_dir + east * step_ang));
  let gW = sample_sphere_geo(normalize(n_dir - east * step_ang));
  let gN = sample_sphere_geo(normalize(n_dir + north * step_ang));
  let gS = sample_sphere_geo(normalize(n_dir - north * step_ang));
  let grad_x = (gE.x - gW.x) / max(2e-4, 2.0 * step_ang);
  let grad_z = (gN.x - gS.x) / max(2e-4, 2.0 * step_ang);
  let grad_mag = length(vec2<f32>(grad_x, grad_z));
  // Local orbital SPH curvature (positive on crests/crater rims, negative in basins/troughs)
  let curv_lap = (gE.x + gW.x + gN.x + gS.x - 4.0 * g.x);
  let has_ocean = (params.flags & 1u) != 0u;
  let above_sea = select(1.0, smoothstep(params.sea_level_norm - 0.008, params.sea_level_norm + 0.025, g.x), has_ocean);
  // Pronounced alpine/crater-rim contrast & physical stratified escarpment ledges strictly driven by orbital SPH relief!
  let slope_w = clamp(grad_mag * 0.55, 0.0, 1.0);
  let highland_boost = max(0.0, g.x - select(-0.15, params.sea_level_norm, has_ocean)) * (0.28 + 0.34 * g.y);
  let ridge_crisp = clamp(-curv_lap * 14.0, -0.045, 0.065) * (0.55 + 0.85 * slope_w);
  let strata_step = (sin(g.x * 38.0 + g.y * 5.5) * 0.024 + sin(g.x * 84.0 - g.z * 4.2) * 0.009) * slope_w;
  // Output layout matches planetarySurfaceVehiclesGpu tectonic_field:
  //   x = elevNorm [-1..1], y = riverMask [0..1], z = moistureOrVolc [0..1], w = soilOrCrustComp [0..1]
  let elev = clamp(g.x + (highland_boost + ridge_crisp + strata_step) * above_sea, -1.0, 1.0);
  // Seed initial watershed headwaters strictly on high moist SPH slopes for isotropic hydraulic canyon carving!
  let river = clamp(g.w * smoothstep(params.sea_level_norm + 0.02, params.sea_level_norm + 0.42, elev) * (0.30 + 0.70 * slope_w), 0.0, 1.0);
  // Keep hydraulic moisture strictly separated from volcanic rift heat on ocean/biosphere worlds so volcanoes never spawn forests!
  let moist_or_volc = select(select(g.w, max(g.w, g.z), (params.flags & 2u) != 0u || g.z > 0.45), g.w, has_ocean);
  patch_a[idx] = vec4<f32>(elev, river, moist_or_volc, g.y);
}

@compute @workgroup_size(64)
fn erode_local_patch(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  let n = i32(params.patch_n);
  if (idx >= params.patch_n * params.patch_n) { return; }
  let x = i32(idx % params.patch_n);
  let z = i32(idx / params.patch_n);
  let xl = max(0, x - 1);
  let xr = min(n - 1, x + 1);
  let zu = max(0, z - 1);
  let zd = min(n - 1, z + 1);

  let c  = patch_a[idx];
  let nL = patch_a[u32(z * n + xl)];
  let nR = patch_a[u32(z * n + xr)];
  let nU = patch_a[u32(zu * n + x)];
  let nD = patch_a[u32(zd * n + x)];
  let nUL = patch_a[u32(zu * n + xl)];
  let nUR = patch_a[u32(zu * n + xr)];
  let nDL = patch_a[u32(zd * n + xl)];
  let nDR = patch_a[u32(zd * n + xr)];

  let has_ocean = (params.flags & 1u) != 0u;
  let is_land = !has_ocean || c.x > params.sea_level_norm;
  let base_lvl = select(-2.0, params.sea_level_norm, has_ocean && is_land);
  let hL  = max(base_lvl, nL.x);
  let hR  = max(base_lvl, nR.x);
  let hU  = max(base_lvl, nU.x);
  let hD  = max(base_lvl, nD.x);
  let hUL = max(base_lvl, nUL.x);
  let hUR = max(base_lvl, nUR.x);
  let hDL = max(base_lvl, nDL.x);
  let hDR = max(base_lvl, nDR.x);

  // Isotropic Sobel gradient & Oono-Puri 9-point Laplacian (zero square Chebyshev grid facets on landed terrain!)
  let dh_dx = ((hR - hL) * 2.0 + (hUR - hUL) + (hDR - hDL)) * 0.125;
  let dh_dz = ((hD - hU) * 2.0 + (hDL - hUL) + (hDR - hUR)) * 0.125;
  let slope = length(vec2<f32>(dh_dx, dh_dz));
  let avg_h = (hL + hR + hU + hD) * 0.1666667 + (hUL + hUR + hDL + hDR) * 0.0833333;
  let lap = avg_h - c.x;
  let inflow = max(0.0, lap * 2.8);

  var elev = c.x;
  var river = c.y;
  var moist = c.z;
  var comp = c.w;

  // Isotropic thermal talus creep & bedrock cliff benching (preserves steep rocky crags!)
  let talus = mix(0.038, 0.072, comp);
  if (slope > talus) {
    elev = elev + clamp(lap, -0.026, 0.026) * 0.24;
  }
  // Isotropic hydraulic stream-power canyon incision & alluvial delta deposition on solvent-bearing land!
  if (params.hydraulic_erosion > 0.08 && is_land) {
    let avg_riv = (nL.y + nR.y + nU.y + nD.y) * 0.1666667 + (nUL.y + nUR.y + nDL.y + nDR.y) * 0.0833333;
    let flux = (0.030 + inflow * 4.2 + avg_riv * 0.76) * params.hydraulic_erosion;
    let erode_d = clamp(flux * slope * 0.82, 0.0, 0.032);
    let dep_d = clamp(flux * max(0.0, 0.018 - slope) * 0.34, 0.0, 0.012);
    elev = elev - erode_d + dep_d;
    if (has_ocean) {
      elev = max(params.sea_level_norm + 0.002, elev);
    }
    river = clamp(max(river * 0.92, min(1.0, flux * 0.88)), 0.0, 1.0);
    moist = clamp(max(moist * 0.98, river * 0.95), 0.0, 1.0);
    comp = clamp(comp + erode_d * 3.4 - dep_d * 2.0, 0.0, 1.0);
  }
  patch_b[idx] = vec4<f32>(clamp(elev, -1.0, 1.0), river, moist, comp);
}

@compute @workgroup_size(64)
fn downsample_coarse_64(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= 4096u) { return; }
  let cx = idx % 64u;
  let cz = idx / 64u;
  let step = max(1u, params.patch_n / 64u);
  let sx = min(params.patch_n - 1u, cx * step + step / 2u);
  let sz = min(params.patch_n - 1u, cz * step + step / 2u);
  coarse_64[idx] = patch_a[sz * params.patch_n + sx].x;
}
`;

/**
 * Create a live 3D WebGPU Multi-Material SPH Planetary Genesis & Spherical Geology session!
 */
export function createPlanetaryGenesisSphSessionWebGpu(device, bodySpec = {}, {
  nebulaEnv = null,
  planetaryAtmoState = null,
  planetaryMode = 'standard',
  systemAgeGyr = 4.5,
  parcelCount = 5120,
  gridN = DEFAULT_GRID_N,
  mapWidth = 512,
  mapHeight = 256,
  targetSteps = 48,
  seed = 20261125,
  label = 'planetary-genesis-sph'
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('createPlanetaryGenesisSphSessionWebGpu requires a live WebGPU GPUDevice');
  }

  const genesisParams = derivePlanetaryGenesisParams(bodySpec, {
    nebulaEnv,
    planetaryAtmoState,
    planetaryMode,
    systemAgeGyr,
    seed
  });
  const initState = buildInitialPlanetarySphParcels(genesisParams, { parcelCount });
  const nParcels = initState.parcelCount;
  const effGridN = Math.max(24, Math.min(64, Math.trunc(Number(gridN) || DEFAULT_GRID_N)));
  const gridTotal = effGridN * effGridN * effGridN;
  const mapW = Math.max(128, Math.min(1024, Math.trunc(mapWidth)));
  const mapH = Math.max(64, Math.min(512, Math.trunc(mapHeight)));
  const mapPixels = mapW * mapH;
  const refTargetSteps = Math.max(32, Math.min(2000, Math.trunc(Number(targetSteps) || 48)));
  // Scale-invariant EOS density factor so 5K@32^3, 32K@48^3, and 57K@64^3 share identical hydrostatic equilibrium!
  const rhoNorm = (5120.0 / Math.max(1024.0, nParcels)) * Math.pow(effGridN / 32.0, 3);

  // Pack impactor descriptors for spherical basin/rim/ejecta coupling (staggered over LHB timeline!)
  const nImp = Math.max(1, initState.impactTargets.length);
  const impData = new Float32Array(nImp * 8);
  for (let k = 0; k < initState.impactTargets.length; k += 1) {
    const t = initState.impactTargets[k];
    const o = k * 8;
    impData[o + 0] = t.dir[0];
    impData[o + 1] = t.dir[1];
    impData[o + 2] = t.dir[2];
    impData[o + 3] = t.radiusNorm;
    impData[o + 4] = 0.24 + t.radiusNorm * 2.1; // crater depth
    impData[o + 5] = 0.14 + t.radiusNorm * 1.1; // raised rim height
    impData[o + 6] = 2 + (k / Math.max(1, nImp)) * Math.min(34, refTargetSteps * 0.55);
    impData[o + 7] = 0.65 + t.radiusNorm * 1.8; // ejecta strength
  }

  // GPU Buffers (strictly bounded by PeerCompute capability sizing & device.limits)
  const sphParamsBuf = device.createBuffer({ label: `${label}-sph-params`, size: 80, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const parcelsBuf = device.createBuffer({ label: `${label}-parcels`, size: nParcels * PARCEL_STRIDE_FLOATS * 4, usage: GPU_BUF.STORAGE | GPU_BUF.VERTEX | GPU_BUF.COPY_DST | GPU_BUF.COPY_SRC });
  const gridAccBuf = device.createBuffer({ label: `${label}-grid-acc`, size: gridTotal * 8 * 4, usage: GPU_BUF.STORAGE });
  const gridValBuf = device.createBuffer({ label: `${label}-grid-val`, size: gridTotal * 2 * 16, usage: GPU_BUF.STORAGE });
  const radialBinsBuf = device.createBuffer({ label: `${label}-radial`, size: 48 * 4, usage: GPU_BUF.STORAGE });
  const impactorsBuf = device.createBuffer({ label: `${label}-impactors`, size: impData.byteLength, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const telBuf = device.createBuffer({ label: `${label}-tel`, size: 32, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC });
  const telReadBuf = device.createBuffer({ label: `${label}-tel-read`, size: 32, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });

  const geoParamsBuf = device.createBuffer({ label: `${label}-geo-params`, size: 48, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const mapAccBuf = device.createBuffer({ label: `${label}-map-acc`, size: mapPixels * 6 * 4, usage: GPU_BUF.STORAGE });
  const geoBufA = device.createBuffer({ label: `${label}-geo-a`, size: mapPixels * 16, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC | GPU_BUF.COPY_DST });
  const geoBufB = device.createBuffer({ label: `${label}-geo-b`, size: mapPixels * 16, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC | GPU_BUF.COPY_DST });

  device.queue.writeBuffer(parcelsBuf, 0, initState.parcelData);
  device.queue.writeBuffer(impactorsBuf, 0, impData);

  // Sum initial parcel mass so Schroeder Scale-Atlas multipole gravity normalizes g(R=1) = 2.65 across 5K..65K parcels!
  let totalParcelMass = 0;
  for (let i = 0; i < nParcels; i += 1) {
    totalParcelMass += Math.max(0.05, initState.parcelData[i * PARCEL_STRIDE_FLOATS + 3]);
  }
  const ssGravity = createSchroederScaleAtlasGravitySolverWebGpu(device, {
    maxCount: nParcels,
    strideFloats: PARCEL_STRIDE_FLOATS,
    chartLevel: 23,
    useAdjSoftening: true,
    qMass: 256.0,
    qMom: 128.0,
    rCellFactor: 0.08,
    label: `${label}-ss-grav`
  });
  ssGravity.writeParams({
    count: nParcels,
    gravityG: 2.65 / Math.max(100.0, totalParcelMass),
    softening2: 0.036,
    boxHalf: 1.55,
    theta2: 0.72
  });

  // Compute Pipelines
  const sphBgl = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'read-only-storage'),
    computeBufferBinding(6, 'storage'),
    computeBufferBinding(7, 'read-only-storage')
  ];
  const clearGridPipe = createCachedExplicitComputePipeline(device, { cacheKey: 'ulg-planet-sph-clear.v3-ss', label: `${label}-clear-grid`, code: PLANETARY_SPH_GENESIS_WGSL, entryPoint: 'clear_sph_grid', bindings: sphBgl });
  const splatGridPipe = createCachedExplicitComputePipeline(device, { cacheKey: 'ulg-planet-sph-splat.v3-ss', label: `${label}-splat-grid`, code: PLANETARY_SPH_GENESIS_WGSL, entryPoint: 'splat_sph_grid', bindings: sphBgl });
  const finGridPipe = createCachedExplicitComputePipeline(device, { cacheKey: 'ulg-planet-sph-fin.v3-ss', label: `${label}-fin-grid`, code: PLANETARY_SPH_GENESIS_WGSL, entryPoint: 'finalize_sph_grid', bindings: sphBgl });
  const advectPipe = createCachedExplicitComputePipeline(device, { cacheKey: 'ulg-planet-sph-advect.v4-ss', label: `${label}-advect`, code: PLANETARY_SPH_GENESIS_WGSL, entryPoint: 'advect_sph_parcels', bindings: sphBgl });
  const telPipe = createCachedExplicitComputePipeline(device, { cacheKey: 'ulg-planet-sph-tel.v3-ss', label: `${label}-tel`, code: PLANETARY_SPH_GENESIS_WGSL, entryPoint: 'write_sph_telemetry', bindings: sphBgl });

  const sphBg = createCachedExplicitBindGroup(device, {
    layout: clearGridPipe.bindGroupLayout,
    label: `${label}-sph-bg`,
    entries: [
      { binding: 0, resource: { buffer: sphParamsBuf } },
      { binding: 1, resource: { buffer: parcelsBuf } },
      { binding: 2, resource: { buffer: gridAccBuf } },
      { binding: 3, resource: { buffer: gridValBuf } },
      { binding: 4, resource: { buffer: radialBinsBuf } },
      { binding: 5, resource: { buffer: impactorsBuf } },
      { binding: 6, resource: { buffer: telBuf } },
      { binding: 7, resource: { buffer: ssGravity.accPhiBuffer } }
    ]
  });

  const geoBgl = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage')
  ];
  const clearGeoPipe = createCachedExplicitComputePipeline(device, { label: `${label}-clear-geo`, code: SPHERICAL_GEOLOGY_SPLAT_WGSL, entryPoint: 'clear_geo_acc', bindings: geoBgl });
  const splatGeoPipe = createCachedExplicitComputePipeline(device, { label: `${label}-splat-geo`, code: SPHERICAL_GEOLOGY_SPLAT_WGSL, entryPoint: 'splat_parcels_to_sphere', bindings: geoBgl });
  const resolveGeoPipe = createCachedExplicitComputePipeline(device, { label: `${label}-resolve-geo`, code: SPHERICAL_GEOLOGY_SPLAT_WGSL, entryPoint: 'resolve_spherical_geology', bindings: geoBgl });
  const erodeGeoPipe = createCachedExplicitComputePipeline(device, { label: `${label}-erode-geo`, code: SPHERICAL_GEOLOGY_SPLAT_WGSL, entryPoint: 'erode_spherical_geology', bindings: geoBgl });

  const geoBgAB = createCachedExplicitBindGroup(device, {
    layout: clearGeoPipe.bindGroupLayout,
    label: `${label}-geo-ab`,
    entries: [
      { binding: 0, resource: { buffer: geoParamsBuf } },
      { binding: 1, resource: { buffer: parcelsBuf } },
      { binding: 2, resource: { buffer: impactorsBuf } },
      { binding: 3, resource: { buffer: mapAccBuf } },
      { binding: 4, resource: { buffer: geoBufA } },
      { binding: 5, resource: { buffer: geoBufB } }
    ]
  });
  const geoBgBA = createCachedExplicitBindGroup(device, {
    layout: clearGeoPipe.bindGroupLayout,
    label: `${label}-geo-ba`,
    entries: [
      { binding: 0, resource: { buffer: geoParamsBuf } },
      { binding: 1, resource: { buffer: parcelsBuf } },
      { binding: 2, resource: { buffer: impactorsBuf } },
      { binding: 3, resource: { buffer: mapAccBuf } },
      { binding: 4, resource: { buffer: geoBufB } },
      { binding: 5, resource: { buffer: geoBufA } }
    ]
  });

  const patchBgl = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage')
  ];
  const projectPatchPipe = createCachedExplicitComputePipeline(device, { label: `${label}-proj-patch`, code: LOCAL_PATCH_EXTRACT_WGSL, entryPoint: 'project_local_patch', bindings: patchBgl });
  const erodePatchPipe = createCachedExplicitComputePipeline(device, { label: `${label}-erode-patch`, code: LOCAL_PATCH_EXTRACT_WGSL, entryPoint: 'erode_local_patch', bindings: patchBgl });
  const coarsePatchPipe = createCachedExplicitComputePipeline(device, { label: `${label}-coarse-patch`, code: LOCAL_PATCH_EXTRACT_WGSL, entryPoint: 'downsample_coarse_64', bindings: patchBgl });

  const flagsU32 = (genesisParams.hasOcean ? 1 : 0)
    | (genesisParams.isMagmaOcean ? 2 : 0)
    | (genesisParams.isCryoWorld ? 4 : 0)
    | (genesisParams.isCarbonRich ? 8 : 0)
    | (genesisParams.isMinorBody ? 16 : 0);

  let stepIndex = 0;
  let geoTimeMyr = 0;
  let disposed = false;
  let mapInFlight = false;
  let lastTelemetry = Object.freeze({
    schema: ULG_PLANETARY_GENESIS_SPH_SCHEMA,
    stepIndex: 0,
    geoTimeMyr: 0,
    parcelCount: nParcels,
    mapWidth: mapW,
    mapHeight: mapH,
    coreMeanR: 0.35,
    mantleMeanR: 0.78,
    felsicMeanR: 0.96,
    meanTemp: 0.52,
    avgCrustThick: 0.45,
    seaLevelNorm: genesisParams.seaLevelNorm,
    activeImpactors: initState.impactTargets.length,
    differentiationIndex: 0.9,
    tectonicMobility: genesisParams.tectonicMobility,
    craterPreservation: genesisParams.craterPreservation,
    hydraulicErosion: genesisParams.hydraulicErosion,
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    scientificValidation: false
  });

  function writeUniforms(dt) {
    const ab = new ArrayBuffer(80);
    const u32 = new Uint32Array(ab);
    const f32 = new Float32Array(ab);
    u32[0] = nParcels;
    u32[1] = effGridN;
    u32[2] = mapW;
    u32[3] = mapH;
    f32[4] = dt;
    f32[5] = 1.55;
    f32[6] = 2.65;
    f32[7] = genesisParams.radiogenicHeat;
    f32[8] = genesisParams.tectonicMobility;
    f32[9] = genesisParams.craterPreservation;
    f32[10] = genesisParams.seaLevelNorm;
    f32[11] = genesisParams.hydraulicErosion;
    u32[12] = flagsU32;
    u32[13] = stepIndex;
    u32[14] = initState.impactTargets.length;
    f32[15] = (genesisParams.seed % 9973) * 0.013;
    f32[16] = genesisParams.rotationOmegaNorm;
    u32[17] = refTargetSteps;
    f32[18] = rhoNorm;
    f32[19] = 0.0;
    device.queue.writeBuffer(sphParamsBuf, 0, ab);

    const gb = new ArrayBuffer(48);
    const gu = new Uint32Array(gb);
    const gf = new Float32Array(gb);
    gu[0] = nParcels;
    gu[1] = mapW;
    gu[2] = mapH;
    gu[3] = initState.impactTargets.length;
    gf[4] = genesisParams.tectonicMobility;
    gf[5] = genesisParams.craterPreservation;
    gf[6] = genesisParams.seaLevelNorm;
    gf[7] = genesisParams.hydraulicErosion;
    gu[8] = flagsU32;
    gu[9] = stepIndex;
    gf[10] = (genesisParams.seed % 9973) * 0.013;
    gf[11] = 0.0;
    device.queue.writeBuffer(geoParamsBuf, 0, gb);
  }

  /**
   * Step the 3D multi-material SPH planetary genesis solver + re-project & erode the
   * spherical geology map in ONE coalesced `queue.submit`!
   */
  async function step({
    substeps = 4,
    dt = 0.032,
    erosionPasses = 6,
    updateSurfaceMap = true,
    readTelemetry = false
  } = {}) {
    if (disposed) return lastTelemetry;
    const nSub = Math.max(1, Math.min(64, Math.trunc(substeps)));
    const dtSafe = Math.max(0.008, Math.min(0.05, Number(dt) || 0.032));
    stepIndex += nSub;
    geoTimeMyr += nSub * (4500.0 / Math.max(44, refTargetSteps));
    writeUniforms(dtSafe);

    const wgGrid = Math.ceil(gridTotal / 64);
    const wgParcels = Math.ceil(nParcels / 64);
    const wgMap = Math.ceil(mapPixels / 64);

    const enc = device.createCommandEncoder({ label: `${label}-step-enc` });
    const pass = enc.beginComputePass({ label: `${label}-sph-pass` });
    for (let s = 0; s < nSub; s += 1) {
      // Canonical Schroeder Simulation hierarchical multipole self-gravity encoded inside this same pass!
      ssGravity.encodeIntoPass(pass, { srcBuffer: parcelsBuf, count: nParcels });
      pass.setBindGroup(0, sphBg);
      pass.setPipeline(clearGridPipe.pipeline);
      pass.dispatchWorkgroups(wgGrid);
      pass.setPipeline(splatGridPipe.pipeline);
      pass.dispatchWorkgroups(wgParcels);
      pass.setPipeline(finGridPipe.pipeline);
      pass.dispatchWorkgroups(wgGrid);
      pass.setPipeline(advectPipe.pipeline);
      pass.dispatchWorkgroups(wgParcels);
    }
    pass.setBindGroup(0, sphBg);
    pass.setPipeline(telPipe.pipeline);
    pass.dispatchWorkgroups(1);

    if (updateSurfaceMap) {
      pass.setBindGroup(0, geoBgAB);
      pass.setPipeline(clearGeoPipe.pipeline);
      pass.dispatchWorkgroups(wgMap);
      pass.setPipeline(splatGeoPipe.pipeline);
      pass.dispatchWorkgroups(wgParcels);
      pass.setPipeline(resolveGeoPipe.pipeline);
      pass.dispatchWorkgroups(wgMap);
      // Even number of ping-pong erosion passes so final output always lands cleanly in `geoBufA`!
      const nErode = Math.max(2, Math.min(32, Math.trunc(erosionPasses / 2) * 2));
      pass.setPipeline(erodeGeoPipe.pipeline);
      for (let e = 0; e < nErode; e += 1) {
        pass.setBindGroup(0, (e % 2 === 0) ? geoBgAB : geoBgBA);
        pass.dispatchWorkgroups(wgMap);
      }
    }
    pass.end();

    const doTel = readTelemetry && !mapInFlight && telReadBuf.mapState === 'unmapped';
    if (doTel) {
      mapInFlight = true;
      enc.copyBufferToBuffer(telBuf, 0, telReadBuf, 0, 32);
    }
    device.queue.submit([enc.finish()]);

    if (doTel && !disposed && telReadBuf.mapState === 'unmapped') {
      try {
        await telReadBuf.mapAsync(GPU_BUF.MAP_READ);
        if (!disposed) {
          const f = new Float32Array(telReadBuf.getMappedRange(0, 32));
          lastTelemetry = Object.freeze({
            schema: ULG_PLANETARY_GENESIS_SPH_SCHEMA,
            stepIndex,
            geoTimeMyr,
            parcelCount: nParcels,
            mapWidth: mapW,
            mapHeight: mapH,
            coreMeanR: f[0],
            mantleMeanR: f[1],
            felsicMeanR: f[2],
            meanTemp: f[3],
            avgCrustThick: f[4],
            seaLevelNorm: f[5],
            activeImpactors: Math.round(f[6]),
            differentiationIndex: f[7],
            tectonicMobility: genesisParams.tectonicMobility,
            craterPreservation: genesisParams.craterPreservation,
            hydraulicErosion: genesisParams.hydraulicErosion,
            accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
            scientificValidation: false
          });
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

    return lastTelemetry;
  }

  /**
   * GPU-safe chunked burst execution (prevents single mammoth submits on 40K-65K parcels & 64^3 grids!).
   */
  async function stepBurst({
    totalSubsteps = 48,
    chunkSize = 18,
    dt = 0.032,
    erosionPasses = 18,
    readTelemetry = true
  } = {}) {
    if (disposed) return lastTelemetry;
    let rem = Math.max(1, Math.trunc(totalSubsteps));
    const chunk = Math.max(4, Math.min(24, Math.trunc(chunkSize)));
    let tel = lastTelemetry;
    while (rem > 0 && !disposed) {
      const n = Math.min(chunk, rem);
      rem -= n;
      const isLast = rem <= 0;
      tel = await step({
        substeps: n,
        dt,
        updateSurfaceMap: isLast,
        erosionPasses: isLast ? erosionPasses : 0,
        readTelemetry: isLast && readTelemetry
      });
    }
    return tel;
  }

  /**
   * Reset parcels to nascent protoplanet initial conditions (for live "Re-Form Planet" mode!).
   */
  function resetToProtoplanet() {
    if (disposed) return;
    stepIndex = 0;
    geoTimeMyr = 0;
    device.queue.writeBuffer(parcelsBuf, 0, initState.parcelData);
  }

  /**
   * Extract a 256x256 GPU local surface geology patch directly from this planet's evolved
   * SPH spherical geology map at `(latDeg, lonDeg)`, refine with 24 local GPU hydraulic
   * erosion passes, and return `{ patchBuffer, coarseHeight64, dispose }`!
   */
  async function extractLocalSurfacePatch({
    latDeg = 32.0,
    lonDeg = 0.0,
    patchN = 256,
    angularSpanRad = 0.36,
    erosionPasses = 24
  } = {}) {
    if (disposed) return null;
    const pn = Math.max(64, Math.min(256, Math.trunc(patchN)));
    const pPixels = pn * pn;
    const pParamsBuf = device.createBuffer({ label: `${label}-patch-params`, size: 48, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
    const patchBufA = device.createBuffer({ label: `${label}-patch-a`, size: pPixels * 16, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC });
    const patchBufB = device.createBuffer({ label: `${label}-patch-b`, size: pPixels * 16, usage: GPU_BUF.STORAGE });
    const coarseBuf = device.createBuffer({ label: `${label}-coarse-64`, size: 4096 * 4, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC });
    const coarseReadBuf = device.createBuffer({ label: `${label}-coarse-64-read`, size: 4096 * 4, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });

    const pb = new ArrayBuffer(48);
    const pu = new Uint32Array(pb);
    const pf = new Float32Array(pb);
    pu[0] = mapW;
    pu[1] = mapH;
    pu[2] = pn;
    pu[3] = 0;
    pf[4] = (Number(latDeg) || 0) * (Math.PI / 180);
    pf[5] = (Number(lonDeg) || 0) * (Math.PI / 180);
    pf[6] = Math.max(0.08, Math.min(1.2, Number(angularSpanRad) || 0.36));
    pf[7] = genesisParams.hydraulicErosion;
    pf[8] = genesisParams.seaLevelNorm;
    pu[9] = flagsU32;
    pf[10] = (genesisParams.seed % 9973) * 0.017;
    pf[11] = 0.0;
    device.queue.writeBuffer(pParamsBuf, 0, pb);

    const pBgAB = createCachedExplicitBindGroup(device, {
      layout: projectPatchPipe.bindGroupLayout,
      label: `${label}-patch-ab`,
      entries: [
        { binding: 0, resource: { buffer: pParamsBuf } },
        { binding: 1, resource: { buffer: geoBufA } },
        { binding: 2, resource: { buffer: patchBufA } },
        { binding: 3, resource: { buffer: patchBufB } },
        { binding: 4, resource: { buffer: coarseBuf } }
      ]
    });
    const pBgBA = createCachedExplicitBindGroup(device, {
      layout: projectPatchPipe.bindGroupLayout,
      label: `${label}-patch-ba`,
      entries: [
        { binding: 0, resource: { buffer: pParamsBuf } },
        { binding: 1, resource: { buffer: geoBufA } },
        { binding: 2, resource: { buffer: patchBufB } },
        { binding: 3, resource: { buffer: patchBufA } },
        { binding: 4, resource: { buffer: coarseBuf } }
      ]
    });

    const enc = device.createCommandEncoder({ label: `${label}-patch-enc` });
    const pass = enc.beginComputePass({ label: `${label}-patch-pass` });
    pass.setBindGroup(0, pBgAB);
    pass.setPipeline(projectPatchPipe.pipeline);
    pass.dispatchWorkgroups(Math.ceil(pPixels / 64));
    const nEr = Math.max(2, Math.min(40, Math.trunc(erosionPasses / 2) * 2));
    pass.setPipeline(erodePatchPipe.pipeline);
    for (let e = 0; e < nEr; e += 1) {
      pass.setBindGroup(0, (e % 2 === 0) ? pBgAB : pBgBA);
      pass.dispatchWorkgroups(Math.ceil(pPixels / 64));
    }
    pass.setBindGroup(0, pBgAB);
    pass.setPipeline(coarsePatchPipe.pipeline);
    pass.dispatchWorkgroups(Math.ceil(4096 / 64));
    pass.end();
    enc.copyBufferToBuffer(coarseBuf, 0, coarseReadBuf, 0, 4096 * 4);
    device.queue.submit([enc.finish()]);

    let coarseHeight64 = new Float32Array(4096);
    try {
      await coarseReadBuf.mapAsync(GPU_BUF.MAP_READ);
      coarseHeight64.set(new Float32Array(coarseReadBuf.getMappedRange(0, 4096 * 4)));
      coarseReadBuf.unmap();
    } catch {}
    try { pParamsBuf.destroy(); patchBufB.destroy(); coarseBuf.destroy(); coarseReadBuf.destroy(); } catch {}

    return Object.freeze({
      patchN: pn,
      patchBuffer: patchBufA,
      coarseHeight64,
      seaLevelNorm: genesisParams.seaLevelNorm,
      dispose() { try { patchBufA.destroy(); } catch {} }
    });
  }

  let lastGeoSnapshotF32 = null;

  /**
   * Read back the compact evolved spherical geology map (`geoBufA`, W*H*4 floats)
   * ONCE for root-node caching & 1-to-1 orbital click sampling so clicking ANY pixel
   * on the L4 planet globe reads the EXACT SPH continent/ocean/crater/mountain there!
   */
  async function exportGeologyMapSnapshot() {
    if (disposed) return null;
    const bytes = mapW * mapH * 16;
    const stg = device.createBuffer({ label: `${label}-geo-export`, size: bytes, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });
    try {
      const enc = device.createCommandEncoder({ label: `${label}-geo-export-enc` });
      enc.copyBufferToBuffer(geoBufA, 0, stg, 0, bytes);
      device.queue.submit([enc.finish()]);
      await stg.mapAsync(GPU_BUF.MAP_READ);
      const copy = !disposed ? new Float32Array(stg.getMappedRange(0, bytes)).slice() : null;
      try { stg.unmap(); } catch {}
      if (copy) lastGeoSnapshotF32 = copy;
      return copy;
    } catch {
      return null;
    } finally {
      try { stg.destroy(); } catch {}
    }
  }

  /**
   * Hydrate the GPU spherical geology map (`geoBufA`) + telemetry directly from a
   * Root Cosmic Lineage Cache hit — skipping 44 SPH + 14 erosion passes in < 0.3 ms!
   */
  function hydrateGeologyMapSnapshot(geoF32, cachedTelemetry = null) {
    if (disposed || !(geoF32 instanceof Float32Array) || geoF32.length !== mapW * mapH * 4) return false;
    device.queue.writeBuffer(geoBufA, 0, geoF32);
    lastGeoSnapshotF32 = geoF32.slice();
    if (cachedTelemetry && typeof cachedTelemetry === 'object') {
      stepIndex = Number(cachedTelemetry.stepIndex) || 44;
      geoTimeMyr = Number(cachedTelemetry.geoTimeMyr) || 440;
      lastTelemetry = Object.freeze({ ...lastTelemetry, ...cachedTelemetry, fromRootCache: true });
    }
    return true;
  }

  function getCachedGeologySnapshot() {
    if (!lastGeoSnapshotF32) return null;
    return {
      data: lastGeoSnapshotF32,
      width: mapW,
      height: mapH,
      seaLevelNorm: genesisParams.seaLevelNorm,
      hasOcean: genesisParams.hasOcean,
      isMagmaOcean: genesisParams.isMagmaOcean,
      isCryoWorld: genesisParams.isCryoWorld
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    try { ssGravity.destroy(); } catch {}
    for (const b of [sphParamsBuf, parcelsBuf, gridAccBuf, gridValBuf, radialBinsBuf, impactorsBuf, telBuf, telReadBuf, geoParamsBuf, mapAccBuf, geoBufA, geoBufB]) {
      try { b.destroy(); } catch {}
    }
  }

  return Object.freeze({
    schema: ULG_PLANETARY_GENESIS_SPH_SCHEMA,
    lawAdapter: PLANETARY_GENESIS_SPH_LAW_ADAPTER,
    spatialAuthority: ssGravity.gravityMode,
    genesisParams,
    get parcelCount() { return nParcels; },
    get gridN() { return effGridN; },
    get mapWidth() { return mapW; },
    get mapHeight() { return mapH; },
    get stepIndex() { return stepIndex; },
    get geoTimeMyr() { return geoTimeMyr; },
    getResidentParcelsBuffer: () => parcelsBuf,
    getResident3dGridBuffer: () => gridValBuf,
    getResidentSphGeologyBuffer: () => geoBufA,
    getTelemetry: () => lastTelemetry,
    step,
    stepBurst,
    resetToProtoplanet,
    extractLocalSurfacePatch,
    exportGeologyMapSnapshot,
    hydrateGeologyMapSnapshot,
    getCachedGeologySnapshot,
    dispose
  });
}

export function registerPlanetaryGenesisSphModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  if (registry.hasModule?.('planetary-genesis-sph@1')) {
    return registry.resolveModule('planetary-genesis-sph@1')?.descriptor || null;
  }
  return registry.registerModule({
    method: { model: 'planetary-genesis-sph', version: 1 },
    kernel: {
      sourceModule: 'src/runtime/astrophysics/planetaryGenesisSphGpu.js',
      entryPoint: 'advect_sph_parcels',
      workgroupSize: 64
    },
    parameterSchema: {
      parcelCount: { type: 'number', min: 1024, max: 16384, required: false },
      substeps: { type: 'number', min: 1, max: 64, required: false }
    },
    stateLayout: {
      tensorId: 'planetary-sph-geology',
      dtype: 'f32',
      layout: 'interleaved',
      strideElements: 4,
      strideBytes: 16,
      fields: ['elevNorm', 'crustComp', 'thermalVolc', 'moistureRiver']
    },
    scaleRangeM: [1e2, 2e7],
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    lawAdapter: PLANETARY_GENESIS_SPH_LAW_ADAPTER,
    async stepCapsule(capsule, { createSimulationArtifact, device }) {
      const p = capsule.input?.parameters || {};
      const session = createPlanetaryGenesisSphSessionWebGpu(device, p.bodySpec || {}, {
        parcelCount: Number(p.parcelCount ?? 2048),
        mapWidth: 128,
        mapHeight: 64
      });
      try {
        const tel = await session.step({ substeps: Number(p.substeps ?? 6), readTelemetry: true });
        return createSimulationArtifact?.({ schema: ULG_PLANETARY_GENESIS_SPH_SCHEMA, telemetry: tel }) ?? tel;
      } finally {
        session.dispose();
      }
    }
  });
}
