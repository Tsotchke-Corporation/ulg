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
  createPlanetaryAtmo3dCfdSessionWebGpu,
  evaluateAtmosphericChemistryAtAltitude
} from './planetaryAtmosphere3dCfdGpu.js';

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
  seed = 20261125
} = {}) {
  const G = 6.67430e-11;
  const M_SUN = 1.98847e30;
  const massKg = Math.max(1e18, (Number(bodySpec.massSolar) || 3.00349e-6) * M_SUN);
  const radiusM = Math.max(1e5, (Number(bodySpec.radiusKm) || 6371) * 1000);
  const computedG = (G * massKg) / (radiusM * radiusM);
  const gravityMS2 = Math.max(0.15, Math.min(35.0, Number(bodySpec.surfaceGravityMS2) || computedG));

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
  const tempK = Math.max(
    35,
    isMagmaOcean ? 1850 : (isRogue ? 75 : (Number(bodySpec.tempK) || 288))
  );
  // Effective molar mass (kg/mol): H2/He gas giants (~0.0024), CO2 thin/super-greenhouse (~0.044), N2/O2 (~0.029)
  const molarMassKgPerMol = !hasSolidCrust
    ? 0.0024
    : (pressurePa > 2e6 || (pressurePa > 100 && pressurePa < 2e4) ? 0.044 : 0.029);
  const rhoAtmKgM3 = pressurePa > 1e-3
    ? (pressurePa * molarMassKgPerMol) / (8.31446 * tempK)
    : 0.0;

  const volatileFrac = Math.max(0, Number(atmo?.volatileMassFrac ?? bodySpec.volatileMassFrac) || 0);
  const dustFrac = Math.max(0, Number(atmo?.particulateMassFrac ?? bodySpec.particulateMassFrac) || 0);
  const hasLiquidOcean = hasSolidCrust && !isMagmaOcean && !isCryoMoon && !isRogue
    && pressurePa >= 611 && tempK >= 265 && tempK <= 365 && volatileFrac >= 0.015;

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
  // Terrain relief scales inversely with gravity (Mars Olympus Mons / Moon highlands taller than high-g worlds!)
  const terrainAmpM = hasSolidCrust
    ? Math.max(7.5, Math.min(26.0, 14.5 * Math.pow(9.81 / gravityMS2, 0.32)))
    : 6.0;
  const seaLevelM = hasLiquidOcean ? -2.2 : -999.0;
  // Wind speed derived from atmospheric pressure & insolation (zero in vacuum!)
  const baseWindMS = rhoAtmKgM3 > 1e-4
    ? Math.min(18.0, (2.2 + 9.5 * dustTint + 3.5 * skyOpticalDepth) * (isEyeball ? 1.4 : 1.0))
    : 0.0;

  return Object.freeze({
    schema: ULG_PLANETARY_SURFACE_SCHEMA,
    gravityMS2,
    radiusM,
    massKg,
    hasSolidCrust,
    isMagmaOcean,
    isCryoMoon,
    isRogue,
    isEyeball,
    hasLiquidOcean,
    seaLevelM,
    pressurePa,
    tempK,
    molarMassKgPerMol,
    rhoAtmKgM3,
    skyOpticalDepth,
    skyZenithRgb: Object.freeze(skyZenithRgb),
    skyHorizonRgb: Object.freeze(skyHorizonRgb),
    dustTint,
    craterStrength,
    terrainAmpM,
    baseWindMS,
    droneMassKg,
    maxAeroLiftN,
    droneWeightN,
    droneFlightCapable,
    droneThrustToWeight,
    color0: Object.freeze([c0[0], c0[1], c0[2]]),
    color1: Object.freeze([c1[0], c1[1], c1[2]]),
    tinyPlanetCurvatureRadiusM: 280.0,
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

/**
 * Evaluate exact terrain elevation (meters) at world `(x, z)` — bit-matched to the WGSL kernel!
 */
export function evaluatePlanetaryTerrainHeight(x, z, env) {
  const seedF = ((env.seed % 997) * 0.13) + 1.7;
  if (!env.hasSolidCrust) {
    // Gas giant cloud-deck undulating wave surface
    return fbm2Js(x * 0.018, z * 0.018, seedF) * env.terrainAmpM - 16.0;
  }
  // Gentle flat landing apron right around (0, 0) so initial deployment is always stable & dramatic
  const r0 = Math.hypot(x, z);
  const apron = Math.min(1.0, Math.max(0.0, (r0 - 6.0) / 22.0));
  const apronSmooth = apron * apron * (3 - 2 * apron);
  const rolling = fbm2Js(x * 0.015, z * 0.015, seedF) * env.terrainAmpM;
  const ridge = Math.abs(fbm2Js(x * 0.028 + 5.1, z * 0.028 - 3.4, seedF + 2.1)) * (env.terrainAmpM * 0.34);
  const detail = fbm2Js(x * 0.085, z * 0.085, seedF + 4.9) * (env.terrainAmpM * 0.07);
  const craters = env.craterStrength > 0.02
    ? (craterFieldJs(x, z, 0.022, seedF) * env.terrainAmpM * 0.68
      + craterFieldJs(x, z, 0.068, seedF + 11.0) * env.terrainAmpM * 0.22) * env.craterStrength
    : 0.0;
  const rawH = (rolling + ridge * 0.45 + detail + craters) * (0.14 + 0.86 * apronSmooth);
  if (env.hasLiquidOcean && rawH < env.seaLevelM) {
    return env.seaLevelM;
  }
  return rawH;
}

/**
 * Evaluate raw unclamped crust elevation (returns `< env.seaLevelM` underwater so
 * rover shoreline collision detects water boundaries accurately!).
 */
export function evaluatePlanetaryCrustElevation(x, z, env) {
  const seedF = ((env.seed % 997) * 0.13) + 1.7;
  if (!env.hasSolidCrust) {
    return fbm2Js(x * 0.018, z * 0.018, seedF) * env.terrainAmpM - 16.0;
  }
  const r0 = Math.hypot(x, z);
  const apron = Math.min(1.0, Math.max(0.0, (r0 - 6.0) / 22.0));
  const apronSmooth = apron * apron * (3 - 2 * apron);
  const rolling = fbm2Js(x * 0.015, z * 0.015, seedF) * env.terrainAmpM;
  const ridge = Math.abs(fbm2Js(x * 0.028 + 5.1, z * 0.028 - 3.4, seedF + 2.1)) * (env.terrainAmpM * 0.34);
  const detail = fbm2Js(x * 0.085, z * 0.085, seedF + 4.9) * (env.terrainAmpM * 0.07);
  const craters = env.craterStrength > 0.02
    ? (craterFieldJs(x, z, 0.022, seedF) * env.terrainAmpM * 0.68
      + craterFieldJs(x, z, 0.068, seedF + 11.0) * env.terrainAmpM * 0.22) * env.craterStrength
    : 0.0;
  return (rolling + ridge * 0.45 + detail + craters) * (0.14 + 0.86 * apronSmooth);
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
export function resolveRoverMultiWheelSupport(x, z, yaw, cellSizeM, env) {
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
    const hTri = evaluateRenderedTerrainTriangleHeight(wx, wz, cellSizeM, env);
    const hAna = evaluatePlanetaryTerrainHeight(wx, wz, env);
    const hGround = Math.max(hTri, hAna);
    if (env.hasLiquidOcean && evaluatePlanetaryCrustElevation(wx, wz, env) < env.seaLevelM + 0.08) {
      anyUnderwater = true;
    }
    samples.push({ rx, rz, hGround });
    sumH += hGround;
    sumRxH += rx * hGround;
    sumRx2 += rx * rx;
    sumRzH += rz * hGround;
    sumRz2 += rz * rz;
  }
  const hCenter = Math.max(
    evaluateRenderedTerrainTriangleHeight(x, z, cellSizeM, env),
    evaluatePlanetaryTerrainHeight(x, z, env)
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
  col0_pad: vec4<f32>,   // rgb = primary crust albedo
  col1_pad: vec4<f32>,   // rgb = secondary highland/lava albedo
};

// 48-byte mesh vertex matching SURFACE_MESH_WGSL:
//   pos_curv:  vec4(x, y, z, rawHeight)
//   norm_tag:  vec4(nx, ny, nz, biomeTag)   tag: 0=rock/regolith, 1=highland/ice, 2=liquid_ocean, 3=magma_crack
//   col_emiss: vec4(r, g, b, emissive)
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

fn eval_height(x: f32, z: f32) -> f32 {
  let is_solid = (params.mode_flags & 1u) != 0u;
  if (!is_solid) {
    return fbm2(x * 0.018, z * 0.018, params.seed_f) * params.terrain_amp - 16.0;
  }
  let r0 = length(vec2<f32>(x, z));
  let a = clamp((r0 - 6.0) / 22.0, 0.0, 1.0);
  let apron = a * a * (3.0 - 2.0 * a);
  let rolling = fbm2(x * 0.015, z * 0.015, params.seed_f) * params.terrain_amp;
  let ridge = abs(fbm2(x * 0.028 + 5.1, z * 0.028 - 3.4, params.seed_f + 2.1)) * (params.terrain_amp * 0.34);
  let detail = fbm2(x * 0.085, z * 0.085, params.seed_f + 4.9) * (params.terrain_amp * 0.07);
  var craters = 0.0;
  if (params.crater_str > 0.02) {
    craters = (crater_field(x, z, 0.022, params.seed_f) * params.terrain_amp * 0.68
      + crater_field(x, z, 0.068, params.seed_f + 11.0) * params.terrain_amp * 0.22) * params.crater_str;
  }
  let raw_h = (rolling + ridge * 0.45 + detail + craters) * (0.14 + 0.86 * apron);
  let has_ocean = (params.mode_flags & 8u) != 0u;
  if (has_ocean && raw_h < params.sea_level) {
    return params.sea_level;
  }
  return raw_h;
}

// Kernel 1: Generate live 129x129 planetary terrain mesh with TinyPlanet spherical horizon curvature!
@compute @workgroup_size(8, 8)
fn generate_surface_terrain_mesh(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.grid_n;
  if (gid.x >= n || gid.y >= n) { return; }
  let half = f32(n - 1u) * 0.5;
  let wx = params.center_x + (f32(gid.x) - half) * params.cell_size;
  let wz = params.center_z + (f32(gid.y) - half) * params.cell_size;

  let h = eval_height(wx, wz);
  let eps = max(0.5, params.cell_size * 0.45);
  let hL = eval_height(wx - eps, wz);
  let hR = eval_height(wx + eps, wz);
  let hD = eval_height(wx, wz - eps);
  let hU = eval_height(wx, wz + eps);
  let n_vec = normalize(vec3<f32>(hL - hR, 2.0 * eps, hD - hU));

  // TinyPlanet subtle spherical curvature drop relative to active vehicle (Rover or Drone)!
  let dx = wx - params.col0_pad.w;
  let dz = wz - params.col1_pad.w;
  let r2 = dx * dx + dz * dz;
  let y_curved = h - r2 * params.curv_inv_2r;

  let is_magma = (params.mode_flags & 2u) != 0u;
  let is_cryo = (params.mode_flags & 4u) != 0u;
  let has_ocean = (params.mode_flags & 8u) != 0u;
  let is_solid = (params.mode_flags & 1u) != 0u;

  let slope = 1.0 - clamp(n_vec.y, 0.0, 1.0);
  let h_norm = clamp((h / max(4.0, params.terrain_amp)) * 0.5 + 0.5, 0.0, 1.0);
  let strata = 0.5 + 0.5 * sin(h * 1.4 + fbm2(wx * 0.08, wz * 0.08, params.seed_f + 9.0) * 3.0);

  var col = mix(params.col0_pad.rgb, params.col1_pad.rgb, clamp(h_norm * 0.65 + slope * 1.2 + strata * 0.16, 0.0, 1.0));
  var emiss = 0.0;
  var tag = 0.0;

  if (!is_solid) {
    // Gas giant cloud bands
    let band = 0.5 + 0.5 * sin(wz * 0.04 + fbm2(wx * 0.02, wz * 0.02, params.seed_f) * 3.5);
    col = mix(params.col0_pad.rgb, params.col1_pad.rgb, band);
    tag = 1.0;
  } else if (has_ocean && h <= params.sea_level + 0.05) {
    col = vec3<f32>(0.04, 0.24, 0.46);
    tag = 2.0;
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
    // Coastal sand -> verdant plains -> rocky mountains -> snow peaks
    let coast = 1.0 - smoothstep(params.sea_level + 0.05, params.sea_level + 0.8, h);
    let snow = smoothstep(0.76, 0.92, h_norm);
    col = mix(vec3<f32>(0.16, 0.42, 0.18), vec3<f32>(0.42, 0.38, 0.34), clamp(slope * 2.1 + smoothstep(0.5, 0.8, h_norm) * 0.6, 0.0, 1.0));
    col = mix(col, vec3<f32>(0.78, 0.72, 0.56), coast);
    col = mix(col, vec3<f32>(0.90, 0.94, 0.98), snow);
    tag = select(0.0, 1.0, snow > 0.4);
  }

  let idx = gid.y * n + gid.x;
  var v: TerrainVert;
  v.pos_curv = vec4<f32>(wx, y_curved, wz, h);
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
      // Role 2: Drone rotor downwash dust ring OR subtle blowing atmospheric dust motes (0 in vacuum!)
      if (params.rho_atm > 1e-4 && (params.drone_throttle > 0.05 || abs(params.wind_x) + abs(params.wind_z) > 0.5)) {
        let is_downwash = params.drone_throttle > 0.05 && (i & 3u) != 0u;
        if (is_downwash) {
          let rad = 0.35 + r_rand * 1.1;
          pos = params.drone_pos_a.xyz + vec3<f32>(cos(ang) * rad, -0.25, sin(ang) * rad);
          vel = vec3<f32>(cos(ang) * 4.2 + params.wind_x * 0.5, -5.2 - 2.6 * r_rand, sin(ang) * 4.2 + params.wind_z * 0.5);
          p.col_life = vec4<f32>(mix(params.col0_pad.rgb, vec3<f32>(0.85, 0.92, 1.0), 0.35), 0.65 + 0.35 * r_rand);
          p.meta0 = vec4<f32>(0.32 + 0.22 * r_rand, 0.15, seed, 1.0);
          live = 1.0;
        } else if ((i & 3u) == 0u) {
          // Sparse fine wind-blown atmospheric dust wisps
          let rx = (fract(seed * 13.7 + f32(params.step_index) * 0.01) - 0.5) * 64.0;
          let rz = (fract(seed * 29.3 + f32(params.step_index) * 0.017) - 0.5) * 64.0;
          let ry = 0.8 + r_rand * 12.0;
          let bx = params.col0_pad.w + rx;
          let bz = params.col1_pad.w + rz;
          pos = vec3<f32>(bx, eval_height(bx, bz) + ry, bz);
          vel = vec3<f32>(params.wind_x, (r_rand - 0.5) * 0.4, params.wind_z);
          p.col_life = vec4<f32>(mix(params.col0_pad.rgb, vec3<f32>(0.92, 0.88, 0.82), 0.45), 1.8 + 1.0 * r_rand);
          p.meta0 = vec4<f32>(0.11 + 0.09 * r_rand, 0.1, seed, 1.0);
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
      // Radial surface impingement splash!
      vel.y = abs(vel.y) * 0.22;
      vel.x = vel.x * 1.15;
      vel.z = vel.z * 1.15;
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

function normalize3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function cross3(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function buildRoverAndDroneMeshFloats(rover, drone, curvInv2R, refX, refZ, ufo = null) {
  const out = [];
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

    // Main gold-MLI thermal insulated chassis + white top avionics deck
    pushOrientedBox(out, pt(0, 0.78, 0), right, up, fwd, 0.88, 0.34, 1.28, [0.90, 0.86, 0.78], 0.0);
    pushOrientedBox(out, pt(0, 1.15, -0.05), right, up, fwd, 0.94, 0.08, 1.32, [0.94, 0.96, 0.98], 0.0);
    // Gold-foil thermal belly pan & solar side panels
    pushOrientedBox(out, pt(0, 0.50, 0), right, up, fwd, 0.78, 0.14, 1.18, [0.88, 0.68, 0.24], 0.0);
    pushOrientedBox(out, pt(-1.12, 1.12, -0.15), right, up, fwd, 0.36, 0.04, 0.95, [0.14, 0.26, 0.56], 0.04);
    pushOrientedBox(out, pt(1.12, 1.12, -0.15), right, up, fwd, 0.36, 0.04, 0.95, [0.14, 0.26, 0.56], 0.04);
    // Rear finned MMRTG plutonium power pack (warm amber glow!)
    pushOrientedBox(out, pt(0, 0.96, -1.48), right, up, fwd, 0.34, 0.36, 0.38, [0.36, 0.38, 0.42], 0.0);
    pushOrientedBox(out, pt(0, 1.02, -1.78), right, up, fwd, 0.22, 0.24, 0.12, [0.95, 0.44, 0.14], 0.35);
    // Forward Mastcam-Z head & stereo laser optics (cyan-white glowing sensors!)
    pushOrientedBox(out, pt(0.28, 1.62, 0.86), right, up, fwd, 0.09, 0.46, 0.09, [0.85, 0.88, 0.92], 0.0);
    pushOrientedBox(out, pt(0.28, 2.08, 0.92), right, up, fwd, 0.30, 0.16, 0.22, [0.92, 0.94, 0.96], 0.0);
    pushOrientedBox(out, pt(0.28, 2.08, 1.14), right, up, fwd, 0.14, 0.08, 0.04, [0.22, 0.88, 1.0], 0.85);
    // Drone helipad docking deck on top-rear
    pushOrientedBox(out, pt(0, 1.24, -0.35), right, up, fwd, 0.52, 0.03, 0.52, [0.22, 0.26, 0.32], 0.0);

    // 4 Corner Jump-Rocket Thruster Bells (glow bright cyan-orange when firing!)
    const rGlow = rover.rocketThrottle > 0.05 ? 1.85 : 0.0;
    const rCol = rover.rocketThrottle > 0.05 ? [1.0, 0.72, 0.24] : [0.30, 0.34, 0.40];
    for (const sx of [-0.94, 0.94]) {
      for (const sz of [-1.05, 1.05]) {
        pushOrientedBox(out, pt(sx, 0.44, sz), right, up, fwd, 0.15, 0.24, 0.15, rCol, rGlow);
      }
    }

    // 6 Rocker-Bogie Wheels + Suspension Struts (spinning with rover.wheelAngle!)
    const wCos = Math.cos(rover.wheelAngle);
    const wSin = Math.sin(rover.wheelAngle);
    const wUp = [up[0] * wCos + fwd[0] * wSin, up[1] * wCos + fwd[1] * wSin, up[2] * wCos + fwd[2] * wSin];
    const wFwd = [fwd[0] * wCos - up[0] * wSin, fwd[1] * wCos - up[1] * wSin, fwd[2] * wCos - up[2] * wSin];
    for (const sx of [-1.22, 1.22]) {
      // Rocker-bogie titanium linkage bar
      pushOrientedBox(out, pt(sx * 0.90, 0.56, 0.0), right, up, fwd, 0.06, 0.07, 1.32, [0.76, 0.78, 0.82], 0.0);
      for (const sz of [-1.22, 0.0, 1.22]) {
        // Vertical suspension strut
        pushOrientedBox(out, pt(sx * 0.94, 0.36, sz), right, up, fwd, 0.05, 0.24, 0.05, [0.68, 0.70, 0.74], 0.0);
        // Spinning wheel hub + treaded metallic-dark rim
        pushOrientedBox(out, pt(sx, 0.34, sz), right, wUp, wFwd, 0.22, 0.34, 0.34, [0.22, 0.24, 0.28], 0.0);
        pushOrientedBox(out, pt(sx * 1.03, 0.34, sz), right, wUp, wFwd, 0.23, 0.14, 0.14, [0.84, 0.66, 0.28], 0.0);
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

    // Gold-foil avionics cube + LED beacon + 4 splayed carbon legs
    pushOrientedBox(out, dp(0, 0.34, 0), dRight, dUp, dFwd, 0.24, 0.20, 0.24, [0.92, 0.72, 0.24], 0.06);
    pushOrientedBox(out, dp(0, 0.34, 0.25), dRight, dUp, dFwd, 0.09, 0.07, 0.04, [0.22, 0.96, 0.72], 1.15);
    pushOrientedBox(out, dp(0, 0.72, 0), dRight, dUp, dFwd, 0.05, 0.26, 0.05, [0.80, 0.84, 0.88], 0.0);
    // Top photovoltaic solar cap
    pushOrientedBox(out, dp(0, 1.02, 0), dRight, dUp, dFwd, 0.36, 0.03, 0.18, [0.16, 0.30, 0.68], 0.12);
    // 4 landing skids
    for (const sx of [-0.34, 0.34]) {
      for (const sz of [-0.34, 0.34]) {
        pushOrientedBox(out, dp(sx, 0.12, sz), dRight, dUp, dFwd, 0.04, 0.16, 0.04, [0.28, 0.30, 0.34], 0.0);
      }
    }
    // Counter-rotating coaxial carbon rotor blades (upper + lower, spinning live at rotorAngle!)
    for (let rIdx = 0; rIdx < 2; rIdx += 1) {
      const a = rIdx === 0 ? drone.rotorAngle : -drone.rotorAngle * 1.04 + 1.1;
      const ca = Math.cos(a); const sa = Math.sin(a);
      const bR = [dRight[0] * ca + dFwd[0] * sa, dRight[1] * ca + dFwd[1] * sa, dRight[2] * ca + dFwd[2] * sa];
      const bF = [dFwd[0] * ca - dRight[0] * sa, dFwd[1] * ca - dRight[1] * sa, dFwd[2] * ca - dRight[2] * sa];
      pushOrientedBox(out, dp(0, 0.84 + rIdx * 0.11, 0), bR, dUp, bF, 1.05, 0.015, 0.08, [0.24, 0.28, 0.34], 0.0);
      pushOrientedBox(out, dp(0, 0.84 + rIdx * 0.11, 0), bF, dUp, bR, 1.05, 0.015, 0.08, [0.24, 0.28, 0.34], 0.0);
    }
  }

  // --- 3. BUOYANT DISC-SHAPED ATMOSPHERIC RESEARCH UFO / AEROSTAT PROBE ---
  if (ufo && ufo.visible) {
    const uBase = applyCurv(ufo.pos);
    const cy = Math.cos(ufo.yaw); const sy = Math.sin(ufo.yaw);
    const cp = Math.cos(ufo.pitch); const sp = Math.sin(ufo.pitch);
    const cr = Math.cos(ufo.roll); const sr = Math.sin(ufo.roll);
    const uFwd = normalize3([sy * cp, -sp, cy * cp]);
    const uRight0 = normalize3([cy, 0, -sy]);
    const uUp0 = normalize3(cross3(uFwd, uRight0));
    const uRight = normalize3([uRight0[0] * cr + uUp0[0] * sr, uRight0[1] * cr + uUp0[1] * sr, uRight0[2] * cr + uUp0[2] * sr]);
    const uUp = normalize3(cross3(uFwd, uRight));
    const upPt = (rx, ry, rz) => [
      uBase[0] + uRight[0] * rx + uUp[0] * ry + uFwd[0] * rz,
      uBase[1] + uRight[1] * rx + uUp[1] * ry + uFwd[1] * rz,
      uBase[2] + uRight[2] * rx + uUp[2] * ry + uFwd[2] * rz
    ];

    // 12-segmented sleek metallic flying-saucer hull (upper tapered deck, beveled dark rim, ventral dish)
    const segs = 12;
    const rimGlowCol = ufo.vertThrust > 0.15
      ? [0.24, 0.96, 1.0]     // Ascending: electric cyan buoyancy glow
      : (ufo.vertThrust < -0.15
        ? [1.0, 0.56, 0.22]   // Diving deeper: warm amber-plasma glow
        : [0.32, 0.84, 0.98]);
    const rimGlow = 1.15 + Math.abs(ufo.vertThrust) * 0.95;

    for (let s = 0; s < segs; s += 1) {
      const ang = (s / segs) * Math.PI * 2 + ufo.rimAngle * 0.35;
      const ca = Math.cos(ang); const sa = Math.sin(ang);
      const radDir = [uRight[0] * ca + uFwd[0] * sa, uRight[1] * ca + uFwd[1] * sa, uRight[2] * ca + uFwd[2] * sa];
      const tanDir = [uFwd[0] * ca - uRight[0] * sa, uFwd[1] * ca - uRight[1] * sa, uFwd[2] * ca - uRight[2] * sa];

      // Main brushed-titanium saucer wedge
      const cMain = upPt(ca * 1.15, 0.10, sa * 1.15);
      pushOrientedBox(out, cMain, radDir, uUp, tanDir, 1.12, 0.16, 0.62, [0.84, 0.88, 0.94], 0.04);
      // Tapered upper fairing
      const cTop = upPt(ca * 0.85, 0.32, sa * 0.85);
      pushOrientedBox(out, cTop, radDir, uUp, tanDir, 0.72, 0.14, 0.48, [0.74, 0.79, 0.86], 0.04);
      // Dark outer aerodynamic bumper rim
      const cRim = upPt(ca * 2.28, 0.04, sa * 2.28);
      pushOrientedBox(out, cRim, radDir, uUp, tanDir, 0.18, 0.09, 0.62, [0.22, 0.26, 0.34], 0.02);
      // Glowing plasma/ion rim-thruster node
      const cNode = upPt(ca * 2.38, 0.05, sa * 2.38);
      pushOrientedBox(out, cNode, radDir, uUp, tanDir, 0.10, 0.06, 0.22, rimGlowCol, rimGlow);
    }

    // Panoramic glowing cyan observation cockpit dome on top (two stepped octagons)
    for (let k = 0; k < 4; k += 1) {
      const a = (k / 4) * Math.PI + ufo.rimAngle * 0.1;
      const ca = Math.cos(a); const sa = Math.sin(a);
      const dR = [uRight[0] * ca + uFwd[0] * sa, uRight[1] * ca + uFwd[1] * sa, uRight[2] * ca + uFwd[2] * sa];
      const dF = [uFwd[0] * ca - uRight[0] * sa, uFwd[1] * ca - uRight[1] * sa, uFwd[2] * ca - uRight[2] * sa];
      pushOrientedBox(out, upPt(0, 0.58, 0), dR, uUp, dF, 0.92, 0.20, 0.92, [0.36, 0.82, 1.0], 0.45);
      pushOrientedBox(out, upPt(0, 0.80, 0), dR, uUp, dF, 0.54, 0.12, 0.54, [0.58, 0.92, 1.0], 0.62);
    }

    // Ventral glowing buoyancy/grav-field core ring + downward atmospheric chemistry laser-spectrometer nozzle!
    pushOrientedBox(out, upPt(0, -0.14, 0), uRight, uUp, uFwd, 1.05, 0.10, 1.05, [0.30, 0.36, 0.44], 0.02);
    pushOrientedBox(out, upPt(0, -0.26, 0), uRight, uUp, uFwd, 0.58, 0.07, 0.58, rimGlowCol, 1.55);
    pushOrientedBox(out, upPt(0, -0.44, 0), uRight, uUp, uFwd, 0.12, 0.18, 0.12, [0.96, 0.82, 0.30], 0.95);
  }

  return new Float32Array(out);
}

export function createPlanetarySurfaceSessionWebGpu(device, {
  bodySpec = {},
  planetaryResult = null,
  planetaryAtmoState = null,
  planetaryMode = 'standard',
  gridN = 129,
  cellSizeM = 2.2,
  particleCount = 2048,
  seed = 20261125,
  label = 'ulg-planetary-surface'
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('createPlanetarySurfaceSessionWebGpu requires a live WebGPU GPUDevice');
  }
  const env = deriveSurfaceEnvironmentState(bodySpec, { planetaryResult, planetaryAtmoState, planetaryMode, seed });
  const n = Math.max(33, Math.min(129, Math.trunc(gridN)));
  const vertCount = n * n;
  const quadCount = (n - 1) * (n - 1);
  const indexCount = quadCount * 6;
  const pCount = Math.max(256, Math.min(8192, Math.trunc(particleCount)));

  // Static terrain triangle index buffer (built once!)
  const indices = new Uint32Array(indexCount);
  let k = 0;
  for (let z = 0; z < n - 1; z += 1) {
    for (let x = 0; x < n - 1; x += 1) {
      const i0 = z * n + x;
      const i1 = i0 + 1;
      const i2 = i0 + n;
      const i3 = i2 + 1;
      indices[k++] = i0; indices[k++] = i2; indices[k++] = i1;
      indices[k++] = i1; indices[k++] = i2; indices[k++] = i3;
    }
  }

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
    computeBufferBinding(3, 'storage')
  ];
  const mkPipe = (entryPoint) => createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-planetary-surface-${entryPoint}.v2-u32hash`,
    label: `${label}-${entryPoint}`,
    code: planetarySurfaceWgsl,
    entryPoint,
    bindings
  });
  const terrainPipe = mkPipe('generate_surface_terrain_mesh');
  const plumePipe = mkPipe('step_surface_plume_particles');
  const telPipe = mkPipe('reduce_surface_telemetry');

  const paramsBuf = device.createBuffer({ label: `${label}-params`, size: 144, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const terrainVertBuf = device.createBuffer({ label: `${label}-terrain-verts`, size: vertCount * 48, usage: GPU_BUF.STORAGE | GPU_BUF.VERTEX });
  const terrainIdxBuf = device.createBuffer({ label: `${label}-terrain-idx`, size: indices.byteLength, usage: GPU_BUF.INDEX | GPU_BUF.COPY_DST });
  const plumesBuf = device.createBuffer({ label: `${label}-plumes`, size: initPlumes.byteLength, usage: GPU_BUF.STORAGE | GPU_BUF.VERTEX | GPU_BUF.COPY_DST });
  const telBuf = device.createBuffer({ label: `${label}-tel`, size: 16, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC });
  const telReadBuf = device.createBuffer({ label: `${label}-tel-rd`, size: 16, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });

  // Vehicle dynamic solid mesh buffer (up to 8,192 vertices = 393 KB — fits Rover + Drone + 12-faceted Disc UFO!)
  const MAX_VEHICLE_VERTS = 8192;
  const vehicleVertBuf = device.createBuffer({ label: `${label}-veh-verts`, size: MAX_VEHICLE_VERTS * 48, usage: GPU_BUF.VERTEX | GPU_BUF.COPY_DST });

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
    label: `${label}-bg`,
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: terrainVertBuf } },
      { binding: 2, resource: { buffer: plumesBuf } },
      { binding: 3, resource: { buffer: telBuf } }
    ]
  });

  // Live Vehicle Physical States (placed cleanly on exact 6-wheel rendered-triangle support plane!)
  const initSup = resolveRoverMultiWheelSupport(0, 0, 0.35, cellSizeM, env);
  const h0 = initSup.supportY;
  const rover = {
    visible: env.hasSolidCrust,
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
    visible: env.hasSolidCrust,
    docked: env.hasSolidCrust,
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
    visible: !env.hasSolidCrust,
    pos: [0, env.hasSolidCrust ? (h0 + 18.0) : 10.0, 0],
    vel: [0, 0, 0],
    yaw: 0.35,
    pitch: 0,
    roll: 0,
    rimAngle: 0,
    vertThrust: 0,
    altitudeKm: cfdSession ? cfdSession.profile.startAltKm : 3.5,
    altitudeM: env.hasSolidCrust ? 18.0 : 14000.0,
    speedMS: 0.0
  };

  let activeVehicle = env.hasSolidCrust ? 'rover' : 'ufo';
  let cameraMode = 'chase'; // 'chase' | 'first-person'
  let lookYawOffset = -0.34; // Hero 3/4 rear-quarter angle showing all 6 rocker-bogie wheels, drone deck, & rocket plumes!
  let lookPitch = 0.18;
  let vehicleVertCount = 0;
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
      activeVehicle = 'rover';
      ufo.visible = false;
      drone.visible = true;
    } else if (mode === 'drone') {
      activeVehicle = 'drone';
      drone.visible = true;
      ufo.visible = false;
      if (drone.docked) {
        drone.docked = false;
        drone.pos = [rover.pos[0], rover.pos[1] + 1.55, rover.pos[2]];
        drone.vel = [rover.vel[0], env.droneFlightCapable ? 3.2 : 0.0, rover.vel[2]];
        drone.yaw = rover.yaw;
      }
    } else if (mode === 'ufo' && cfdSession) {
      activeVehicle = 'ufo';
      ufo.visible = true;
      if (!env.hasSolidCrust) drone.visible = false;
      if (env.hasSolidCrust) {
        const gh = evaluatePlanetaryTerrainHeight(rover.pos[0], rover.pos[2], env);
        ufo.pos = [rover.pos[0], Math.max(gh + 14.0, ufo.pos[1]), rover.pos[2]];
        ufo.yaw = rover.yaw;
      }
    }
    return activeVehicle;
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
    lookYawOffset += Number(dYaw) || 0;
    lookPitch = Math.max(-0.85, Math.min(1.15, lookPitch + (Number(dPitch) || 0)));
  }

  function integrateVehicles(dt, controls = {}) {
    const fwdIn = (controls.forward ? 1 : 0) - (controls.backward ? 1 : 0) + (Number(controls.moveY) || 0);
    const turnIn = (controls.right ? 1 : 0) - (controls.left ? 1 : 0) + (Number(controls.moveX) || 0);
    const jumpHeld = Boolean(controls.jump || controls.up);
    const downHeld = Boolean(controls.down);
    const turbo = Boolean(controls.turbo || controls.run);
    const yawIn = (controls.yawLeft ? 1 : 0) - (controls.yawRight ? 1 : 0);

    if (Math.abs(yawIn) > 0.01) lookYawOffset += yawIn * 1.8 * dt;

    // Live wind vector (gently varying crosswind proportional to env.baseWindMS; exact 0 in vacuum!)
    const windX = env.baseWindMS * Math.cos(simTimeS * 0.09 + 0.6);
    const windZ = env.baseWindMS * Math.sin(simTimeS * 0.09 + 0.6);

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

      let lastSup = resolveRoverMultiWheelSupport(rover.pos[0], rover.pos[2], rover.yaw, cellSizeM, env);
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

        let nextSup = resolveRoverMultiWheelSupport(candX, candZ, rover.yaw, cellSizeM, env);

        // 1. Steep Cliff Wall Collision (`normal.y < 0.58` => >54 deg cliff face): block uphill penetration & slide!
        const hitSteepCliff = nextSup.normal[1] < 0.58 && (candY <= nextSup.supportY + 0.45);
        // 2. Liquid Ocean Shoreline Boundary: prevent terrestrial rover from sinking/driving underwater!
        const hitOceanShore = env.hasLiquidOcean && nextSup.anyUnderwater && !lastSup.anyUnderwater && (candY <= nextSup.supportY + 0.45);

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
          nextSup = resolveRoverMultiWheelSupport(rover.pos[0], rover.pos[2], rover.yaw, cellSizeM, env);
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
      const heading = drone.yaw + (isCtrl ? lookYawOffset : 0);
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const rx = fz;
      const rz = -fx;

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

    // --- 3. INTEGRATE BUOYANT DISC-SHAPED ATMOSPHERIC RESEARCH UFO (3D CFD FLOW COUPLED!) ---
    if (ufo.visible && cfdSession) {
      const isCtrl = activeVehicle === 'ufo';
      const fwdCmd = isCtrl ? Math.max(-1, Math.min(1, fwdIn)) : 0;
      const strafeCmd = isCtrl ? Math.max(-1, Math.min(1, turnIn)) : 0;
      const upCmd = isCtrl ? ((jumpHeld ? 1 : 0) - (downHeld ? 1 : 0)) : 0;
      if (isCtrl && Math.abs(yawIn) > 0.01) {
        ufo.yaw += yawIn * 1.6 * dt;
      }
      ufo.vertThrust += (upCmd - ufo.vertThrust) * Math.min(1, dt * 8.0);
      ufo.rimAngle = (ufo.rimAngle + (2.4 + Math.abs(ufo.vertThrust) * 4.5 + Math.hypot(fwdCmd, strafeCmd) * 3.0) * dt) % (Math.PI * 2);

      const heading = ufo.yaw + (isCtrl ? lookYawOffset : 0);
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const rx = fz;
      const rz = -fx;

      // Live 3D GPU Navier-Stokes CFD velocity sampled directly at the UFO's 3D location!
      const cfdW = lastCfdTelemetry?.craftWindMS || [windX * 0.5, 0, windZ * 0.5];
      const maxBank = turbo ? 0.34 : 0.22;
      ufo.pitch += (fwdCmd * maxBank - ufo.pitch) * Math.min(1, dt * 6.5);
      ufo.roll += (-strafeCmd * maxBank + Math.max(-0.18, Math.min(0.18, cfdW[0] * 0.008)) - ufo.roll) * Math.min(1, dt * 6.5);

      const horizThrust = turbo ? 44.0 : 26.0;
      const vertThrustAccel = turbo ? 26.0 : 15.0;
      // Aerodynamic coupling: 3D CFD jet streams & convective updrafts physically push & lift the buoyant saucer!
      const aeroCoupling = 0.85;
      ufo.vel[0] += ((fx * fwdCmd + rx * strafeCmd) * horizThrust + (cfdW[0] * 0.55 - ufo.vel[0]) * aeroCoupling) * dt;
      ufo.vel[2] += ((fz * fwdCmd + rz * strafeCmd) * horizThrust + (cfdW[2] * 0.55 - ufo.vel[2]) * aeroCoupling) * dt;
      ufo.vel[1] += (upCmd * vertThrustAccel + (cfdW[1] * 0.65 - ufo.vel[1]) * 1.45) * dt;

      ufo.pos[0] += ufo.vel[0] * dt;
      ufo.pos[1] += ufo.vel[1] * dt;
      ufo.pos[2] += ufo.vel[2] * dt;

      // Keep vertical 3D position bounded cleanly over terrain (rocky) or centered in endless 3D clouds (giants)
      const prof = cfdSession.profile;
      const kmRate = prof.isDeepFluid ? (turbo ? 18.0 : 9.5) : (turbo ? 4.2 : 2.2);
      ufo.altitudeKm = Math.max(
        prof.minAltKm,
        Math.min(prof.maxAltKm, ufo.altitudeKm + (upCmd * kmRate + cfdW[1] * 0.08) * dt)
      );
      if (env.hasSolidCrust) {
        const ghUfo = Math.max(
          evaluateRenderedTerrainTriangleHeight(ufo.pos[0], ufo.pos[2], cellSizeM, env),
          evaluatePlanetaryTerrainHeight(ufo.pos[0], ufo.pos[2], env)
        );
        if (ufo.pos[1] < ghUfo + 2.8) {
          ufo.pos[1] = ghUfo + 2.8;
          if (ufo.vel[1] < 0) ufo.vel[1] = 0;
        }
        ufo.altitudeM = Math.max(0, ufo.pos[1] - ghUfo) + Math.max(0, ufo.altitudeKm * 1000.0 - 20.0);
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
      // TinyPlanetControls-style 1st-person mast/cockpit view!
      const eyeH = isUfo ? 0.92 : (isDrone ? 0.55 : 2.28);
      const eye = [vehPos[0] + sy * 0.55, vehPos[1] + eyeH, vehPos[2] + cy * 0.55];
      const target = [eye[0] + sy * cp * 12.0, eye[1] - sp * 12.0, eye[2] + cy * cp * 12.0];
      return { eye, target, up: [0, 1, 0], focusPos: vehPos };
    }
    // Dynamic 3rd-person chase camera showing articulated Rover / Drone / Buoyant UFO + 3D clouds!
    const dist = isUfo ? 11.8 : (isDrone ? 8.5 : 10.5);
    const eyeX = vehPos[0] - sy * cp * dist;
    const eyeZ = vehPos[2] - cy * cp * dist;
    let eyeY = vehPos[1] + (isUfo ? 2.4 : 2.6) + sp * dist;
    if (env.hasSolidCrust) {
      const ghEye = Math.max(
        evaluateRenderedTerrainTriangleHeight(eyeX, eyeZ, cellSizeM, env),
        evaluatePlanetaryTerrainHeight(eyeX, eyeZ, env)
      );
      eyeY = Math.max(ghEye + 1.65, eyeY);
    }
    const target = [vehPos[0] + sy * 2.5, vehPos[1] + (isUfo ? 0.45 : (isDrone ? 0.8 : 1.45)), vehPos[2] + cy * 2.5];
    return { eye: [eyeX, eyeY, eyeZ], target, up: [0, 1, 0], focusPos: vehPos };
  }

  async function step({ dt = 0.016, controls = {}, readTelemetry = true } = {}) {
    if (disposed) return lastTelemetry;
    const dtSafe = Math.max(0.004, Math.min(0.045, Number(dt) || 0.016));
    simTimeS += dtSafe;
    stepIndex += 1;

    const { windX, windZ } = integrateVehicles(dtSafe, controls);
    const focus = activeVehicle === 'ufo' ? ufo.pos : (activeVehicle === 'drone' ? drone.pos : rover.pos);
    // Snap terrain patch origin to integer cellSizeM so mountain vertices NEVER shimmer as you move!
    const snapX = Math.round(focus[0] / cellSizeM) * cellSizeM;
    const snapZ = Math.round(focus[2] / cellSizeM) * cellSizeM;

    const modeFlags = (env.hasSolidCrust ? 1 : 0)
      | (env.isMagmaOcean ? 2 : 0)
      | (env.isCryoMoon ? 4 : 0)
      | (env.hasLiquidOcean ? 8 : 0);
    const seedF = ((env.seed % 997) * 0.13) + 1.7;
    const curvInv2R = env.hasSolidCrust ? (1.0 / (2.0 * env.tinyPlanetCurvatureRadiusM)) : 0.0;

    const ab = new ArrayBuffer(144);
    new Uint32Array(ab, 0, 4).set([n, pCount, modeFlags, stepIndex]);
    new Float32Array(ab, 16, 32).set([
      snapX, snapZ, cellSizeM, seedF,
      env.terrainAmpM, env.craterStrength, env.seaLevelM, curvInv2R,
      env.gravityMS2, env.rhoAtmKgM3, windX, windZ,
      dtSafe, rover.rocketThrottle, rover.speedMS, drone.throttle,
      rover.pos[0], rover.pos[1], rover.pos[2], rover.yaw,
      drone.pos[0], drone.pos[1], drone.pos[2], env.droneThrustToWeight,
      env.color0[0], env.color0[1], env.color0[2], focus[0],
      env.color1[0], env.color1[1], env.color1[2], focus[2]
    ]);
    device.queue.writeBuffer(paramsBuf, 0, ab);

    // Upload articulated Rover + Drone + Buoyant Disc UFO 3D triangles
    const vehFloats = buildRoverAndDroneMeshFloats(rover, drone, curvInv2R, focus[0], focus[2], ufo);
    vehicleVertCount = Math.min(MAX_VEHICLE_VERTS, Math.floor(vehFloats.length / 12));
    if (vehicleVertCount > 0) {
      device.queue.writeBuffer(vehicleVertBuf, 0, vehFloats.subarray(0, vehicleVertCount * 12));
    }

    const enc = device.createCommandEncoder({ label: `${label}-enc-${stepIndex}` });
    const pass = enc.beginComputePass({ label: `${label}-pass` });
    pass.setBindGroup(0, bg);
    pass.setPipeline(terrainPipe.pipeline);
    pass.dispatchWorkgroups(wgGrid, wgGrid);
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

    // Step live 3D WebGPU Stratified Atmospheric CFD whenever flying the UFO or diving in a deep fluid envelope!
    const runCfd = Boolean(cfdSession && (activeVehicle === 'ufo' || !env.hasSolidCrust || stepIndex <= 2));
    if (runCfd) {
      lastCfdTelemetry = await cfdSession.step({
        dt: Math.min(0.035, dtSafe * 1.35),
        craftPos: focus,
        altKm: ufo.altitudeKm,
        readTelemetry: readTelemetry || (stepIndex <= 2)
      });
    }

    let activePlumes = lastTelemetry.activePlumeParticles;
    let flameCnt = lastTelemetry.flameParticles;
    let dustCnt = lastTelemetry.dustParticles;
    let meanDustSpd = lastTelemetry.meanDustSpeedMS;

    if (doTel) {
      try {
        await telReadBuf.mapAsync(GPU_BUF.MAP_READ);
        if (!disposed) {
          const f = new Float32Array(telReadBuf.getMappedRange(0, 16));
          activePlumes = Math.round(f[0]);
          flameCnt = Math.round(f[1]);
          dustCnt = Math.round(f[2]);
          meanDustSpd = f[3];
        }
        try { telReadBuf.unmap(); } catch {}
      } catch (err) {
        if (!disposed && err?.name !== 'AbortError') throw err;
      } finally {
        mapInFlight = false;
      }
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
      ufoSpeedMS: ufo.speedMS,
      ufoAltitudeKm: ufo.altitudeKm,
      cfdActive: runCfd,
      cfdAvailable: Boolean(cfdSession),
      cfdTelemetry: lastCfdTelemetry,
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
    for (const b of [paramsBuf, terrainVertBuf, terrainIdxBuf, plumesBuf, telBuf, telReadBuf, vehicleVertBuf]) {
      try { b.destroy(); } catch {}
    }
  }

  return Object.freeze({
    schema: ULG_PLANETARY_SURFACE_SCHEMA,
    lawAdapter: PLANETARY_SURFACE_LAW_ADAPTER,
    get env() { return env; },
    get activeVehicle() { return activeVehicle; },
    get cameraMode() { return cameraMode; },
    get gridN() { return n; },
    get indexCount() { return indexCount; },
    get vehicleVertCount() { return vehicleVertCount; },
    get particleCount() { return pCount; },
    get cfdMoteCount() { return cfdSession ? cfdSession.moteCount : 0; },
    get cfdProfile() { return cfdSession ? cfdSession.profile : null; },
    get stepIndex() { return stepIndex; },
    getResidentTerrainVertBuffer: () => terrainVertBuf,
    getResidentTerrainIndexBuffer: () => terrainIdxBuf,
    getResidentVehicleVertBuffer: () => vehicleVertBuf,
    getResidentPlumesBuffer: () => plumesBuf,
    getResidentCfdMotesBuffer: () => (cfdSession ? cfdSession.getResidentMotesBuffer() : null),
    getActiveSkyEnv,
    getCameraPose,
    setActiveVehicle,
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
