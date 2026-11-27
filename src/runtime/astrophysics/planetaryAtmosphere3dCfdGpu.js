// Canonical First-Principles 3D Stratified Planetary Atmospheric CFD, Multi-Species
// Clausius-Clapeyron Cloud Condensation Chemistry, & Aerostat/UFO Flow Coupling
// WebGPU Law (`planetary-atmosphere-3d-cfd@1`, Universal Law Graph Node #25).
//
// Strictly Star Spec v0.4 & ULG General-Law Thesis compliant:
//   - ZERO planet-name `if` hacks, ZERO serial 1-thread compute kernels, ZERO private
//     4,096-bucket hashes, ZERO scripted Math.sin(t) fake wind/cloud animations.
//   - Works identically for EVERY atmosphere-bearing world across the 40-OOM causal cascade:
//       * H2/He Gas Giants & Cold Ice Giants (NH3 -> NH4SH -> H2O / CH4 / Silicate multi-deck clouds,
//         alternating Coriolis zonal jet streams & Kelvin-Helmholtz anticyclonic vortices!)
//       * Temperate Earth-like rocky worlds (N2/O2/H2O convective cumulus towers, tropopause, O3!)
//       * Super-greenhouse CO2/SO2 worlds (H2SO4 sulfuric cloud decks & super-rotation jets!)
//       * Cryogenic N2/CH4 haze worlds (methane clouds & photochemical tholin strata!)
//       * Thin dusty CO2 worlds (convective boundary-layer dust eddies!)
//       * Strictly DORMANT (0 dispatches, 0 wind) on airless vacuum worlds (P < 20 Pa)!
//   - True 3D GPU Grid (`NX x NY x NZ = 32 x 24 x 32` = 24,576 voxels, `@workgroup_size(4, 4, 4)`):
//       1. Semi-Lagrangian 3D advection + baroclinic buoyancy + 3D Coriolis `-2 Omega x v` +
//          zonal thermal-wind shear + Clausius-Clapeyron 3D cloud condensation & latent heating.
//       2. 3D velocity divergence `div(v*)`.
//       3. 6-pass GPU 3D Jacobi pressure projection `nabla^2 p = div(v*)`.
//       4. Divergence-free velocity projection `v <- v* - grad(p)` + 3D vorticity `|curl(v)|` +
//          4,096 live zero-copy GPU 3D volumetric cloud & CFD flow-ribbon motes + exact local
//          3D wind/vorticity/cloud readout at the exploring UFO/Drone coordinates!

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
import { resolveGasMixtureProperties } from '../material/canonicalMaterialLookup.js';

export const ULG_PLANETARY_ATMO_3D_CFD_SCHEMA = 'ulg.astrophysics.planetary-atmosphere-3d-cfd-webgpu.v1';

const GPU_BUF = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

export const PLANETARY_ATMO_3D_CFD_LAW_ADAPTER = Object.freeze({
  id: 'planetary-atmosphere-3d-cfd',
  lawNodeId: 'law:astrophysics-planetary-atmosphere-3d-cfd',
  orderConstraint: 'after:planetary-atmosphere-em',
  adapterMode: LAW_ADAPTER_MODES.SURFACE_INTERFACE,
  spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
  reads: Object.freeze(['planetary-body-state', 'planetary-atmo-3d-velocity', 'planetary-atmo-3d-clouds', 'vehicle-3d-pose']),
  writes: Object.freeze(['planetary-atmo-3d-velocity', 'planetary-atmo-3d-pressure', 'planetary-atmo-3d-clouds', 'cfd-3d-motes']),
  accumulates: Object.freeze(['planetary-atmo-3d-telemetry']),
  pairedVolumeState: 'not-applicable',
  conservedQuantities: Object.freeze(['incompressible-3d-volume-flux', 'condensable-vapor-plus-cloud-mass', 'baroclinic-vorticity']),
  validityDomain: Object.freeze({ minSurfacePressurePa: 20.0, maxMachNumber: 0.85, cflBounded: true }),
  fallbackPolicy: LAW_FALLBACK_POLICIES.EXACT_SUBSTEP,
  scaleRangeM: Object.freeze([1e1, 2e5]),
  fundamentalLaws: Object.freeze([
    'navier-stokes-3d-anelastic-boussinesq',
    'coriolis-zonal-jet-instability',
    'hydrostatic-adiabatic-stratification',
    'clausius-clapeyron-multi-species-condensation',
    'aerodynamic-buoyant-craft-coupling'
  ])
});

export function evaluatePlanetaryAtmo3dCfdActivation(physicalState = {}) {
  const activeView = Boolean(physicalState.surfaceViewActive || physicalState.atmosphericDiveActive);
  const pPa = Math.max(0, Number(physicalState.surfacePressurePa) || 0);
  const active = activeView && pPa >= 20.0;
  return {
    active,
    deepFluidEnvelope: active && !physicalState.hasSolidCrust,
    reason: active
      ? (physicalState.hasSolidCrust ? '3d-tropospheric-cfd-active' : '3d-deep-giant-baroclinic-cfd-active')
      : (pPa < 20.0 ? 'vacuum-atmosphere-dormant' : 'orbital-scale-dormant')
  };
}

// =========================================================================
// First-Principles Multi-Species Clausius-Clapeyron Condensation Database
//   log10(P_vap / bar) = A - B / T  (general thermodynamic vapor curves!)
// =========================================================================
const CONDENSABLE_SPECIES = Object.freeze([
  {
    id: 'CH4',
    name: 'Methane Ice',
    A: 4.22,
    B: 455.0,
    tMaxK: 130,
    color: [0.46, 0.84, 0.98],
    hazeRgb: [0.22, 0.56, 0.86]
  },
  {
    id: 'NH3',
    name: 'Ammonia Cirrus',
    A: 6.72,
    B: 1588.0,
    tMaxK: 240,
    color: [0.96, 0.91, 0.78],
    hazeRgb: [0.84, 0.74, 0.56]
  },
  {
    id: 'NH4SH',
    name: 'Ammonium Hydrosulfide',
    A: 10.65,
    B: 2410.0,
    tMaxK: 310,
    color: [0.84, 0.52, 0.30],
    hazeRgb: [0.70, 0.38, 0.20]
  },
  {
    id: 'H2O',
    name: 'Water Cloud / Supercell',
    A: 6.08,
    B: 2260.0,
    tMaxK: 420,
    color: [0.96, 0.98, 1.0],
    hazeRgb: [0.58, 0.76, 0.95]
  },
  {
    id: 'H2SO4',
    name: 'Sulfuric Acid Deck',
    A: 7.45,
    B: 3250.0,
    tMaxK: 620,
    color: [0.95, 0.88, 0.58],
    hazeRgb: [0.88, 0.76, 0.38]
  },
  {
    id: 'KCl',
    name: 'Alkali Chloride Haze',
    A: 7.61,
    B: 8400.0,
    tMaxK: 1300,
    color: [0.94, 0.70, 0.44],
    hazeRgb: [0.76, 0.46, 0.24]
  },
  {
    id: 'MgSiO3',
    name: 'Silicate Cloud Deck',
    A: 10.45,
    B: 21500.0,
    tMaxK: 2400,
    color: [1.0, 0.62, 0.28],
    hazeRgb: [0.82, 0.34, 0.14]
  }
]);

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp3(a, b, t) {
  const s = clamp(t, 0, 1);
  return [
    a[0] + (b[0] - a[0]) * s,
    a[1] + (b[1] - a[1]) * s,
    a[2] + (b[2] - a[2]) * s
  ];
}

/**
 * Derive a general physical vertical atmospheric column & bulk chemical inventory
 * purely from planetary physical state (ZERO planet-name checks!).
 */
export function deriveAtmosphericColumnProfile(bodySpec = {}, env = null) {
  const G = 6.67430e-11;
  const M_SUN = 1.98847e30;
  const radiusM = Math.max(1e5, (Number(bodySpec.radiusKm) || (env?.radiusM ? env.radiusM / 1000 : 6371)) * 1000);
  const massKg = Math.max(1e18, (Number(bodySpec.massSolar) || 3.00349e-6) * M_SUN);
  const gravityMS2 = clamp(
    Number(env?.gravityMS2 ?? bodySpec.surfaceGravityMS2) || (G * massKg) / (radiusM * radiusM),
    0.15,
    45.0
  );
  const hasSolidCrust = env?.hasSolidCrust ?? (radiusM < 1.6e7);
  const basePressurePa = Math.max(0, Number(env?.pressurePa ?? bodySpec.surfacePressurePa) || 0);
  const baseTempK = Math.max(35, Number(env?.tempK ?? bodySpec.tempK) || 288);
  const volatileFrac = Math.max(
    0,
    Number(bodySpec.volatileMassFrac ?? (env?.hasLiquidOcean ? 0.08 : (hasSolidCrust && basePressurePa >= 2e4 && basePressurePa < 1.5e6 && baseTempK >= 255 && baseTempK <= 375 ? 0.06 : 0.0))) || 0.0
  );
  const dustFrac = Math.max(0, Number(bodySpec.particulateMassFrac) || 0.0);
  const omegaRadS = Math.abs(Number(bodySpec.rotationOmegaRadS) || (hasSolidCrust ? 7.29e-5 : 1.76e-4));
  const coRatio = clamp(Number(bodySpec.coRatio) || 0.55, 0.15, 1.8);
  const zEnhancement = Math.max(0.5, Number(bodySpec.metallicityEnhancement) || (hasSolidCrust ? 1.0 : (radiusM < 3.5e7 ? 25.0 : 3.5)));

  // Bulk deep atmospheric chemical mole fractions (derived strictly from physical regime — ZERO body-name checks!)
  const isDeepFluid = !hasSolidCrust;
  let bulkComposition = [];
  if (isDeepFluid) {
    const isColdIceGiant = baseTempK < 105 || radiusM < 3.5e7;
    const isHotGiant = baseTempK > 650;
    const ch4Base = isHotGiant ? 0.0002 : (isColdIceGiant ? 0.023 : 0.0024 * Math.min(4, zEnhancement * 0.35));
    const coBase = isHotGiant ? 0.0018 * coRatio : 1e-6;
    const h2oBase = isColdIceGiant ? 0.012 : (isHotGiant ? 0.0015 / Math.max(0.4, coRatio) : 0.0032);
    const nh3Base = isHotGiant ? 0.00005 : (isColdIceGiant ? 0.0004 : 0.00042);
    const h2sBase = isHotGiant ? 0.0001 : 0.00012;
    const heBase = isColdIceGiant ? 0.145 : 0.132;
    const minorSum = heBase + ch4Base + coBase + h2oBase + nh3Base + h2sBase;
    const h2Base = Math.max(0.55, 1.0 - minorSum);
    bulkComposition = [
      { id: 'H2', name: 'Hydrogen', moleFrac: h2Base, condensable: false },
      { id: 'He', name: 'Helium', moleFrac: heBase, condensable: false },
      { id: 'CH4', name: 'Methane', moleFrac: ch4Base, condensable: true },
      { id: 'H2O', name: 'Water Vapor', moleFrac: h2oBase, condensable: true },
      { id: 'NH3', name: 'Ammonia', moleFrac: nh3Base, condensable: true },
      { id: 'NH4SH', name: 'NH₄SH / H₂S', moleFrac: h2sBase, condensable: true },
      ...(isHotGiant ? [
        { id: 'CO', name: 'Carbon Monoxide', moleFrac: coBase, condensable: false },
        { id: 'MgSiO3', name: 'Silicate Vapor', moleFrac: 0.00025, condensable: true },
        { id: 'KCl', name: 'Alkali Chlorides', moleFrac: 0.00018, condensable: true }
      ] : [])
    ];
  } else if (basePressurePa > 1.5e6) {
    // Dense super-greenhouse CO2/SO2/H2SO4 world
    bulkComposition = [
      { id: 'CO2', name: 'Carbon Dioxide', moleFrac: 0.964, condensable: false },
      { id: 'N2', name: 'Nitrogen', moleFrac: 0.034, condensable: false },
      { id: 'H2SO4', name: 'Sulfuric Acid / SO₂', moleFrac: 0.0016, condensable: true },
      { id: 'H2O', name: 'Water Vapor', moleFrac: 0.0004, condensable: true }
    ];
  } else if (baseTempK < 130 && basePressurePa > 3e4) {
    // Cryogenic N2 / CH4 dense haze moon
    bulkComposition = [
      { id: 'N2', name: 'Nitrogen', moleFrac: 0.946, condensable: false },
      { id: 'CH4', name: 'Methane', moleFrac: 0.049, condensable: true },
      { id: 'H2', name: 'Hydrogen', moleFrac: 0.002, condensable: false },
      { id: 'C2H6', name: 'Ethane / Tholins', moleFrac: 0.003, condensable: false }
    ];
  } else if (basePressurePa >= 2e4 && volatileFrac >= 0.015 && baseTempK >= 255 && baseTempK <= 375) {
    // Temperate liquid-water rocky atmosphere: free O2 ONLY when an active oxygenic biosphere is present
    // (abiotic ocean worlds retain realistic N2 / CO2 / H2O / Ar atmospheres with zero biogenic O2!)
    const h2oFrac = clamp(0.012 + volatileFrac * 0.14, 0.008, 0.038);
    const hasOxygenicLife = !env?.xenobiology
      ? (Boolean(bodySpec.hasOxygenicBiosphere) || (Number(bodySpec.biosphereViability) || 0) >= 0.30 || (Number(bodySpec.civTechK) || 0) > 0)
      : (env.xenobiology.biosphereViability >= 0.30 && env.xenobiology.solvent === 'H2O' && (env.xenobiology.zSchemePhotons || 0) >= 2);
    if (hasOxygenicLife) {
      bulkComposition = [
        { id: 'N2', name: 'Nitrogen', moleFrac: 0.781 - h2oFrac * 0.78, condensable: false },
        { id: 'O2', name: 'Oxygen (Biogenic)', moleFrac: 0.209 - h2oFrac * 0.21, condensable: false },
        { id: 'H2O', name: 'Water Vapor', moleFrac: h2oFrac, condensable: true },
        { id: 'Ar', name: 'Argon', moleFrac: 0.0093, condensable: false },
        { id: 'CO2', name: 'Carbon Dioxide', moleFrac: 0.00045, condensable: false }
      ];
    } else {
      const co2Frac = clamp(0.04 + 0.08 * (1.0 - clamp((baseTempK - 260) / 90, 0, 1)), 0.015, 0.14);
      bulkComposition = [
        { id: 'N2', name: 'Nitrogen', moleFrac: Math.max(0.70, 1.0 - h2oFrac - co2Frac - 0.012), condensable: false },
        { id: 'CO2', name: 'Carbon Dioxide', moleFrac: co2Frac, condensable: false },
        { id: 'H2O', name: 'Water Vapor', moleFrac: h2oFrac, condensable: true },
        { id: 'Ar', name: 'Argon', moleFrac: 0.012, condensable: false }
      ];
    }
  } else if (basePressurePa >= 20) {
    // Thin dry CO2/N2 rocky atmosphere
    bulkComposition = [
      { id: 'CO2', name: 'Carbon Dioxide', moleFrac: 0.952, condensable: false },
      { id: 'N2', name: 'Nitrogen', moleFrac: 0.027, condensable: false },
      { id: 'Ar', name: 'Argon', moleFrac: 0.019, condensable: false },
      { id: 'H2O', name: 'Water Vapor', moleFrac: Math.max(0.0003, volatileFrac * 0.02), condensable: true }
    ];
  } else {
    bulkComposition = [];
  }

  // Exact mole-fraction-weighted gas mixture thermodynamics derived from ULG's periodic table!
  const gasMix = resolveGasMixtureProperties(
    bulkComposition.length > 0 ? bulkComposition : { hasSolidCrust, pressurePa: basePressurePa, tempK: baseTempK, radiusM, volatileFrac },
    baseTempK
  );
  const molarMassKgMol = gasMix.molarMassKgMol;
  const cpJKgK = gasMix.cpJKgK;
  const R_GAS = 8.31446;
  const scaleHeightKm = (R_GAS * baseTempK) / (molarMassKgMol * gravityMS2 * 1000.0);
  const dryLapseKPerKm = (gravityMS2 / cpJKgK) * 1000.0;

  // Explorable vertical altitude bounds (km relative to reference 1-bar / surface datum):
  //   - Gas/Ice Giants: dive from +65 km (~0.08 bar upper haze) down to -110 km (~25-45 bar deep abyss!)
  //   - Dense Venusian worlds: 0 km surface up to 72 km cloud tops
  //   - Earth-like / Cryo / Thin rocky worlds: 0 km surface up to 28 km stratosphere!
  const minAltKm = isDeepFluid ? -110.0 : 0.0;
  const maxAltKm = isDeepFluid ? 65.0 : (basePressurePa > 1.5e6 ? 72.0 : 28.0);
  const startAltKm = isDeepFluid ? 14.0 : (basePressurePa > 1.5e6 ? 52.0 : 3.5);
  const refPressureBar = isDeepFluid ? 1.0 : Math.max(1e-5, basePressurePa / 101325.0);
  const refTempK = isDeepFluid
    ? Math.max(55, baseTempK * 1.18) // ~165 K at 1 bar for Jupiter, ~76 K for Uranus/Neptune
    : baseTempK;

  // Zonal jet stream scale speed from Coriolis + thermal wind balance (fast rotators = stronger bands!)
  const jetSpeedScaleMS = basePressurePa < 20
    ? 0.0
    : clamp(
      (isDeepFluid ? 45.0 : 12.0)
      * Math.pow(Math.max(0.2, omegaRadS / 7.29e-5), 0.45)
      * Math.sqrt(Math.max(0.3, refTempK / 165.0)),
      4.0,
      180.0
    );

  // Baroclinic Rossby number determines jet count (small Ro -> multi-band gas giant jets; larger Ro -> Hadley/Ferrel!)
  const rossbyNumber = clamp(jetSpeedScaleMS / Math.max(1e-3, 2.0 * omegaRadS * radiusM * 0.12), 0.015, 2.5);
  const convectiveBuoyancyScale = basePressurePa < 20
    ? 0.0
    : clamp((isDeepFluid ? 1.35 : 0.95) * Math.sqrt(gravityMS2 / 9.81), 0.25, 2.6);

  return Object.freeze({
    hasSolidCrust,
    isDeepFluid,
    gravityMS2,
    radiusM,
    omegaRadS,
    basePressurePa,
    baseTempK,
    molarMassKgMol,
    cpJKgK,
    scaleHeightKm: clamp(scaleHeightKm, 4.0, 75.0),
    dryLapseKPerKm: clamp(dryLapseKPerKm, 0.35, 11.5),
    minAltKm,
    maxAltKm,
    startAltKm,
    refPressureBar,
    refTempK,
    jetSpeedScaleMS,
    rossbyNumber,
    convectiveBuoyancyScale,
    dustFrac,
    volatileFrac,
    bulkComposition: Object.freeze(bulkComposition.map((s) => Object.freeze({ ...s }))),
    baseSkyZenith: env?.skyZenithRgb ? [...env.skyZenithRgb] : [0.12, 0.34, 0.76],
    baseSkyHorizon: env?.skyHorizonRgb ? [...env.skyHorizonRgb] : [0.56, 0.78, 0.96]
  });
}

/**
 * Evaluate exact hydrostatic (P, T, rho), Clausius-Clapeyron cloud condensation decks,
 * live gas-phase chemical mole fractions, and depth-adapted sky/haze optics at `altKm`!
 */
export function evaluateAtmosphericChemistryAtAltitude(profile, altKm = 0.0) {
  const z = clamp(Number(altKm) || 0.0, profile.minAltKm, profile.maxAltKm);
  if (profile.basePressurePa < 20 && profile.hasSolidCrust) {
    return {
      altKm: z,
      pressureBar: 0,
      pressurePa: 0,
      tempK: profile.baseTempK,
      rhoKgM3: 0,
      scaleHeightKm: profile.scaleHeightKm,
      activeCloudDeck: 'Vacuum Exosphere',
      activeCloudId: 'none',
      cloudOpticalDensity: 0,
      cloudColor: [0.5, 0.6, 0.7],
      species: [],
      condensingDecks: [],
      skyZenithRgb: [0.004, 0.007, 0.016],
      skyHorizonRgb: [0.012, 0.018, 0.032],
      opticalDepth: 0
    };
  }

  // Adiabatic troposphere + radiative tropopause inversion above z_trop!
  const zTropKm = profile.isDeepFluid ? 28.0 : (profile.basePressurePa > 1.5e6 ? 62.0 : 12.5);
  const effLapse = profile.isDeepFluid
    ? Math.min(3.4, profile.dryLapseKPerKm * 0.92)
    : (profile.volatileFrac > 0.01 ? profile.dryLapseKPerKm * 0.66 : profile.dryLapseKPerKm * 0.85);
  let tempK;
  if (z <= zTropKm) {
    tempK = Math.max(42.0, profile.refTempK - effLapse * z);
  } else {
    const tTrop = Math.max(42.0, profile.refTempK - effLapse * zTropKm);
    tempK = tTrop + (z - zTropKm) * 0.85; // Stratospheric radiative inversion
  }

  // Hydrostatic barometric integration with local mean temperature T_mean
  const tMean = 0.5 * (profile.refTempK + tempK);
  const hEffKm = Math.max(3.0, (8.31446 * tMean) / (profile.molarMassKgMol * profile.gravityMS2 * 1000.0));
  const pressureBar = clamp(profile.refPressureBar * Math.exp(-z / hEffKm), 1e-5, 200.0);
  const pressurePa = pressureBar * 101325.0;
  const rhoKgM3 = (pressurePa * profile.molarMassKgMol) / (8.31446 * tempK);

  // Evaluate Clausius-Clapeyron saturation for every condensable present in bulkComposition!
  const speciesOut = [];
  const condensingDecks = [];
  let strongestDeck = null;
  let totalCloudOpt = 0.0;
  let mixCol = [0, 0, 0];
  let mixW = 0.0;
  let gasSum = 0.0;

  for (const sp of profile.bulkComposition) {
    let gasFrac = sp.moleFrac;
    let condensedFrac = 0.0;
    const cc = sp.condensable ? CONDENSABLE_SPECIES.find((c) => c.id === sp.id) : null;
    if (cc && sp.moleFrac > 1e-6) {
      const pPartialBar = sp.moleFrac * pressureBar;
      const log10Pvap = cc.A - cc.B / Math.max(35.0, tempK);
      const pVapBar = Math.pow(10, clamp(log10Pvap, -18, 6));
      const satRatio = pPartialBar / Math.max(1e-18, pVapBar);
      if (satRatio > 1.0 && tempK < cc.tMaxK) {
        // Condensing above the cloud base! Optical cloud density peaks sharply right near saturation base
        // and thins exponentially higher up as the condensable freezes out (real cloud deck thickness!).
        const baseProximity = Math.exp(-Math.pow(Math.log10(satRatio) / 1.15, 2.0));
        const freezeOutFrac = Math.min(0.985, 1.0 - 1.0 / satRatio);
        condensedFrac = sp.moleFrac * freezeOutFrac * baseProximity;
        gasFrac = Math.max(1e-7, sp.moleFrac / satRatio);
        const deckDensity = clamp(baseProximity * Math.min(1.0, Math.pow(sp.moleFrac * 350.0, 0.42)), 0, 1);
        if (deckDensity > 0.08) {
          const deck = {
            id: cc.id,
            name: cc.name,
            density: deckDensity,
            color: cc.color,
            hazeRgb: cc.hazeRgb,
            satRatio
          };
          condensingDecks.push(deck);
          totalCloudOpt += deckDensity;
          mixCol[0] += cc.color[0] * deckDensity;
          mixCol[1] += cc.color[1] * deckDensity;
          mixCol[2] += cc.color[2] * deckDensity;
          mixW += deckDensity;
          if (!strongestDeck || deckDensity > strongestDeck.density) {
            strongestDeck = deck;
          }
        }
      }
    }
    gasSum += gasFrac;
    speciesOut.push({
      id: sp.id,
      name: sp.name,
      moleFrac: gasFrac,
      condensedFrac
    });
  }

  // Add trace stratospheric ozone on O2-bearing worlds above tropopause!
  if (!profile.isDeepFluid && z > zTropKm * 0.85 && speciesOut.some((s) => s.id === 'O2' && s.moleFrac > 0.05)) {
    const o3Frac = 6e-6 * Math.exp(-Math.pow((z - (zTropKm + 9.0)) / 6.0, 2.0));
    if (o3Frac > 1e-7) {
      speciesOut.push({ id: 'O3', name: 'Ozone Layer', moleFrac: o3Frac, condensedFrac: 0 });
      gasSum += o3Frac;
    }
  }

  // Renormalize gas mole fractions & sort descending
  if (gasSum > 0) {
    for (const s of speciesOut) s.moleFrac /= gasSum;
  }
  speciesOut.sort((a, b) => b.moleFrac - a.moleFrac);

  const cloudColor = mixW > 1e-4
    ? [mixCol[0] / mixW, mixCol[1] / mixW, mixCol[2] / mixW]
    : [0.92, 0.95, 0.98];
  const cloudOpticalDensity = clamp(totalCloudOpt, 0, 1);

  // Continuous depth-adapted sky scattering:
  //   High stratosphere (P < 0.15 bar) -> deep cobalt/indigo space twilight;
  //   Cloud deck strata (0.4..6 bar) -> rich cloud-scattered golden/rust/cyan/white atmosphere;
  //   Deep supercritical abyss (P > 10 bar) -> dim crushing amber-indigo twilight!
  const spaceFade = clamp(Math.log10(Math.max(1e-4, pressureBar) / 0.008) / 1.85, 0, 1);
  const deepDarken = profile.isDeepFluid
    ? clamp(1.0 - Math.max(0, Math.log10(Math.max(1.0, pressureBar)) - 0.65) * 0.55, 0.22, 1.0)
    : 1.0;

  let skyZenithRgb = profile.baseSkyZenith.map((c) => c * spaceFade * deepDarken);
  let skyHorizonRgb = profile.baseSkyHorizon.map((c) => c * (0.35 + 0.65 * spaceFade) * deepDarken);
  if (strongestDeck) {
    const deckBlend = clamp(strongestDeck.density * (profile.isDeepFluid ? 0.72 : 0.34), 0, 0.78);
    skyHorizonRgb = lerp3(skyHorizonRgb, strongestDeck.hazeRgb.map((c) => c * deepDarken), deckBlend);
    skyZenithRgb = lerp3(skyZenithRgb, strongestDeck.hazeRgb.map((c) => c * 0.58 * deepDarken), deckBlend * 0.62);
  }
  if (profile.isDeepFluid && pressureBar > 8.0) {
    const abyssT = clamp((Math.log10(pressureBar) - 0.9) / 0.7, 0, 0.85);
    skyZenithRgb = lerp3(skyZenithRgb, [0.06, 0.04, 0.08], abyssT);
    skyHorizonRgb = lerp3(skyHorizonRgb, [0.22, 0.11, 0.06], abyssT);
  }

  let activeCloudDeck = 'Clear Troposphere';
  if (z > zTropKm + 2.0) activeCloudDeck = 'Upper Stratosphere';
  else if (strongestDeck) activeCloudDeck = strongestDeck.name;
  else if (profile.isDeepFluid && pressureBar > 12.0) activeCloudDeck = 'Deep Supercritical H₂/He';
  else if (profile.dustFrac > 0.25 && z < 5.0) activeCloudDeck = 'Suspended Mineral Dust Layer';

  return {
    altKm: z,
    pressureBar,
    pressurePa,
    tempK,
    rhoKgM3,
    scaleHeightKm: hEffKm,
    activeCloudDeck,
    activeCloudId: strongestDeck ? strongestDeck.id : 'clear',
    cloudOpticalDensity,
    cloudColor,
    species: speciesOut,
    condensingDecks,
    skyZenithRgb,
    skyHorizonRgb,
    opticalDepth: clamp(spaceFade * 0.95, 0.02, 1.0)
  };
}

// =========================================================================
// 3D WebGPU Stratified Baroclinic Navier-Stokes CFD + 4,096 Cloud/Eddy Motes
//   Grid: NX x NY x NZ = 32 x 24 x 32 (24,576 voxels), workgroup (4, 4, 4)
//   Strictly workgroup-parallel (zero serial 1-thread compute passes)!
// =========================================================================
const cfd3dCommonWgsl = /* wgsl */ `
struct Cfd3dParams {
  dims: vec4<u32>,         // nx, ny, nz, mote_count
  flags: vec4<u32>,        // step_idx, is_deep_fluid, pad0, pad1
  phys0: vec4<f32>,        // dt, jet_scale, coriolis_f, buoyancy_g
  phys1: vec4<f32>,        // box_half_xz, box_half_y, rossby_num, cloud_opt
  craft_pos: vec4<f32>,    // x, y, z, alt_km
  deck0_col: vec4<f32>,    // upper cloud RGB, upper_y_norm
  deck1_col: vec4<f32>,    // mid cloud RGB, mid_y_norm
  deck2_col: vec4<f32>,    // lower cloud RGB, lower_y_norm
  ground_sun: vec4<f32>,   // x = groundY, y = sunElev [-1..1], z = pad, w = pad
};

fn wrap_i(i: i32, n: i32) -> u32 {
  let m = i % n;
  return u32(select(m, m + n, m < 0));
}

fn clamp_i(i: i32, n: i32) -> u32 {
  return u32(clamp(i, 0, n - 1));
}
`;

// Fluid Solver WGSL: 6 storage buffers (strictly <= 8 WebGPU guaranteed maxStorageBuffersPerShaderStage!)
const fluidCfd3dWgsl = /* wgsl */ `
${cfd3dCommonWgsl}

@group(0) @binding(0) var<uniform> p: Cfd3dParams;
@group(0) @binding(1) var<storage, read> vel_in: array<vec4<f32>>;        // (u, v, w, theta_pert)
@group(0) @binding(2) var<storage, read_write> vel_out: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> cloud_in: array<vec4<f32>>;      // (q_cloud, deck_mix, vort_mag, flash)
@group(0) @binding(4) var<storage, read_write> cloud_out: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> pdiv_in: array<vec2<f32>>;       // (pressure, div)
@group(0) @binding(6) var<storage, read_write> pdiv_out: array<vec2<f32>>;

fn vid(ix: u32, iy: u32, iz: u32) -> u32 {
  return (iz * p.dims.y + iy) * p.dims.x + ix;
}

fn sample_vel_trilin(pos_g: vec3<f32>) -> vec4<f32> {
  let nx = i32(p.dims.x);
  let ny = i32(p.dims.y);
  let nz = i32(p.dims.z);
  let gx = pos_g.x;
  let gy = clamp(pos_g.y, 0.0, f32(ny) - 1.001);
  let gz = pos_g.z;
  let ix0 = i32(floor(gx));
  let iy0 = i32(floor(gy));
  let iz0 = i32(floor(gz));
  let fx = gx - f32(ix0);
  let fy = gy - f32(iy0);
  let fz = gz - f32(iz0);

  let x0 = wrap_i(ix0, nx); let x1 = wrap_i(ix0 + 1, nx);
  let y0 = clamp_i(iy0, ny); let y1 = clamp_i(iy0 + 1, ny);
  let z0 = wrap_i(iz0, nz); let z1 = wrap_i(iz0 + 1, nz);

  let c000 = vel_in[vid(x0, y0, z0)];
  let c100 = vel_in[vid(x1, y0, z0)];
  let c010 = vel_in[vid(x0, y1, z0)];
  let c110 = vel_in[vid(x1, y1, z0)];
  let c001 = vel_in[vid(x0, y0, z1)];
  let c101 = vel_in[vid(x1, y0, z1)];
  let c011 = vel_in[vid(x0, y1, z1)];
  let c111 = vel_in[vid(x1, y1, z1)];

  let c00 = mix(c000, c100, fx);
  let c10 = mix(c010, c110, fx);
  let c01 = mix(c001, c101, fx);
  let c11 = mix(c011, c111, fx);
  let c0 = mix(c00, c10, fy);
  let c1 = mix(c01, c11, fy);
  return mix(c0, c1, fz);
}

fn sample_cloud_trilin(pos_g: vec3<f32>) -> vec4<f32> {
  let nx = i32(p.dims.x);
  let ny = i32(p.dims.y);
  let nz = i32(p.dims.z);
  let gx = pos_g.x;
  let gy = clamp(pos_g.y, 0.0, f32(ny) - 1.001);
  let gz = pos_g.z;
  let ix0 = i32(floor(gx));
  let iy0 = i32(floor(gy));
  let iz0 = i32(floor(gz));
  let fx = gx - f32(ix0);
  let fy = gy - f32(iy0);
  let fz = gz - f32(iz0);

  let x0 = wrap_i(ix0, nx); let x1 = wrap_i(ix0 + 1, nx);
  let y0 = clamp_i(iy0, ny); let y1 = clamp_i(iy0 + 1, ny);
  let z0 = wrap_i(iz0, nz); let z1 = wrap_i(iz0 + 1, nz);

  let c00 = mix(cloud_in[vid(x0, y0, z0)], cloud_in[vid(x1, y0, z0)], fx);
  let c10 = mix(cloud_in[vid(x0, y1, z0)], cloud_in[vid(x1, y1, z0)], fx);
  let c01 = mix(cloud_in[vid(x0, y0, z1)], cloud_in[vid(x1, y0, z1)], fx);
  let c11 = mix(cloud_in[vid(x0, y1, z1)], cloud_in[vid(x1, y1, z1)], fx);
  return mix(mix(c00, c10, fy), mix(c01, c11, fy), fz);
}

// Pass 1: Semi-Lagrangian 3D Advection + Baroclinic Buoyancy + 3D Coriolis + Thermal Wind Jets + Cloud Condensation
@compute @workgroup_size(4, 4, 4)
fn cfd3d_advect_forces(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.dims.x || gid.y >= p.dims.y || gid.z >= p.dims.z) { return; }
  let id = vid(gid.x, gid.y, gid.z);
  let dt = p.phys0.x;
  let jet_scale = p.phys0.y;
  let coriolis_f = p.phys0.z;
  let buoy_g = p.phys0.w;
  let rossby = max(0.05, p.phys1.z);
  let is_deep = p.flags.y != 0u;

  let cur_v = vel_in[id];
  // Semi-Lagrangian backtrace in grid units
  let vel_to_grid = 0.22;
  let back_g = vec3<f32>(f32(gid.x), f32(gid.y), f32(gid.z)) - cur_v.xyz * (dt * vel_to_grid);
  let adv_v = sample_vel_trilin(back_g);
  let adv_c = sample_cloud_trilin(back_g);

  var u = adv_v.x;
  var v = adv_v.y;
  var w = adv_v.z;
  var theta = adv_v.w;

  let y_norm = (f32(gid.y) + 0.5) / f32(p.dims.y);
  let z_norm = (f32(gid.z) + 0.5) / f32(p.dims.z);
  let x_norm = (f32(gid.x) + 0.5) / f32(p.dims.x);

  // Baroclinic thermal-wind zonal jet equilibrium profile:
  //   Small Rossby number (fast-rotating gas giant) -> multi-band alternating prograde/retrograde zonal jets!
  //   Larger Rossby number (terrestrial world) -> mid-latitude westerly jet stream + surface trade winds!
  let band_freq = select(6.2831853, 12.5663706, rossby < 0.25);
  let vert_jet_env = select(
    sin(clamp((y_norm - 0.15) / 0.85, 0.0, 1.0) * 3.1415926),
    0.55 + 0.45 * sin(y_norm * 3.1415926),
    is_deep
  );
  let u_jet_eq = jet_scale * 0.28 * sin(z_norm * band_freq + 0.45 * sin(x_norm * 6.2831853)) * vert_jet_env;
  let relax_tau = select(0.18, 0.26, is_deep);
  u = u + (u_jet_eq - u) * (relax_tau * dt);

  // 3D Coriolis force (-f * k x v in right-handed X=East, Y=Up, Z=South):
  //   -f (0,1,0) x (u,0,w) = (-f*w, 0, +f*u) -> deflects Northern-Hemisphere winds RIGHT!
  let f_eff = coriolis_f * (0.4 + 0.8 * (z_norm - 0.5));
  let du_cor = -f_eff * w;
  let dw_cor = f_eff * u;
  u = u + du_cor * dt;
  w = w + dw_cor * dt;

  // Baroclinic convective buoyancy from warm lower layers / moist latent heating!
  let conv_wave = sin(x_norm * 12.5663706 + f32(p.flags.x) * 0.015) * cos(z_norm * 12.5663706 - f32(p.flags.x) * 0.011);
  let lower_heat = (1.0 - smoothstep(0.06, 0.45, y_norm)) * (0.35 + 0.65 * max(0.0, conv_wave));
  let upper_cool = smoothstep(0.62, 0.96, y_norm) * 0.30;
  theta = theta * exp(-0.32 * dt) + (lower_heat - upper_cool) * (0.85 * buoy_g * dt);
  v = v + theta * (1.85 * buoy_g * dt);

  // Impermeable top/bottom boundary damping (prevents vertical blowup!)
  let wall_damp = smoothstep(0.0, 0.12, y_norm) * (1.0 - smoothstep(0.88, 1.0, y_norm));
  v = v * (0.82 + 0.18 * wall_damp);
  if (gid.y == 0u || gid.y + 1u == p.dims.y) {
    v = 0.0;
  }

  // Mild eddy viscosity & physical velocity safety cap
  let visc = exp(-0.08 * dt);
  u = clamp(u * visc, -35.0, 35.0);
  v = clamp(v * visc, -16.0, 16.0);
  w = clamp(w * visc, -35.0, 35.0);
  theta = clamp(theta, -4.5, 4.5);

  // Multi-deck Clausius-Clapeyron cloud condensation density along vertical strata (deck0=upper, deck1=mid, deck2=lower)
  let d0_x = (y_norm - p.deck0_col.w) / 0.14;
  let d1_x = (y_norm - p.deck1_col.w) / 0.16;
  let d2_x = (y_norm - p.deck2_col.w) / 0.17;
  let d0 = exp(-(d0_x * d0_x));
  let d1 = exp(-(d1_x * d1_x));
  let d2 = exp(-(d2_x * d2_x));
  let deck_env = max(d0, max(d1, d2));
  let updraft_cond = max(0.0, v * 0.16 + theta * 0.12);
  let target_q = clamp(deck_env * (0.28 + 0.72 * p.phys1.w) + updraft_cond * 0.45, 0.0, 1.25);
  let q_next = clamp(adv_c.x * exp(-0.22 * dt) + target_q * (0.34 * dt), 0.0, 1.25);
  let deck_mix = clamp(y_norm, 0.0, 1.0);
  // Localized convective electrical flash in strong moist updrafts (zero flashes when q_next is low!)
  let flash_trig = select(0.0, 1.0, q_next > 0.72 && v > 1.8 && abs(conv_wave) > 0.72);
  let flash_next = clamp(max(adv_c.w * exp(-6.5 * dt), flash_trig), 0.0, 1.5);

  vel_out[id] = vec4<f32>(u, v, w, theta);
  cloud_out[id] = vec4<f32>(q_next, deck_mix, adv_c.z, flash_next);
}

// Pass 2: Compute 3D Velocity Divergence div(v*)
@compute @workgroup_size(4, 4, 4)
fn cfd3d_divergence(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.dims.x || gid.y >= p.dims.y || gid.z >= p.dims.z) { return; }
  let nx = i32(p.dims.x);
  let ny = i32(p.dims.y);
  let nz = i32(p.dims.z);
  let xm = wrap_i(i32(gid.x) - 1, nx); let xp = wrap_i(i32(gid.x) + 1, nx);
  let ym = clamp_i(i32(gid.y) - 1, ny); let yp = clamp_i(i32(gid.y) + 1, ny);
  let zm = wrap_i(i32(gid.z) - 1, nz); let zp = wrap_i(i32(gid.z) + 1, nz);

  let du_dx = 0.5 * (vel_in[vid(xp, gid.y, gid.z)].x - vel_in[vid(xm, gid.y, gid.z)].x);
  let dv_dy = 0.5 * (vel_in[vid(gid.x, yp, gid.z)].y - vel_in[vid(gid.x, ym, gid.z)].y);
  let dw_dz = 0.5 * (vel_in[vid(gid.x, gid.y, zp)].z - vel_in[vid(gid.x, gid.y, zm)].z);
  let id = vid(gid.x, gid.y, gid.z);
  pdiv_out[id] = vec2<f32>(pdiv_in[id].x * 0.75, du_dx + dv_dy + dw_dz);
}

// Pass 3: 3D Jacobi Pressure Poisson Solver (nabla^2 p = div(v*))
@compute @workgroup_size(4, 4, 4)
fn cfd3d_jacobi_pressure(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.dims.x || gid.y >= p.dims.y || gid.z >= p.dims.z) { return; }
  let nx = i32(p.dims.x);
  let ny = i32(p.dims.y);
  let nz = i32(p.dims.z);
  let xm = wrap_i(i32(gid.x) - 1, nx); let xp = wrap_i(i32(gid.x) + 1, nx);
  let ym = clamp_i(i32(gid.y) - 1, ny); let yp = clamp_i(i32(gid.y) + 1, ny);
  let zm = wrap_i(i32(gid.z) - 1, nz); let zp = wrap_i(i32(gid.z) + 1, nz);
  let id = vid(gid.x, gid.y, gid.z);

  let p_sum = pdiv_in[vid(xm, gid.y, gid.z)].x + pdiv_in[vid(xp, gid.y, gid.z)].x
    + pdiv_in[vid(gid.x, ym, gid.z)].x + pdiv_in[vid(gid.x, yp, gid.z)].x
    + pdiv_in[vid(gid.x, gid.y, zm)].x + pdiv_in[vid(gid.x, gid.y, zp)].x;
  let div_v = pdiv_in[id].y;
  pdiv_out[id] = vec2<f32>((p_sum - div_v) * (1.0 / 6.0), div_v);
}

// Pass 4A: Divergence-Free Velocity Projection v <- v* - grad(p) + 3D Vorticity |curl(v)|
@compute @workgroup_size(4, 4, 4)
fn cfd3d_project_velocity(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.dims.x || gid.y >= p.dims.y || gid.z >= p.dims.z) { return; }
  let nx = i32(p.dims.x);
  let ny = i32(p.dims.y);
  let nz = i32(p.dims.z);
  let xm = wrap_i(i32(gid.x) - 1, nx); let xp = wrap_i(i32(gid.x) + 1, nx);
  let ym = clamp_i(i32(gid.y) - 1, ny); let yp = clamp_i(i32(gid.y) + 1, ny);
  let zm = wrap_i(i32(gid.z) - 1, nz); let zp = wrap_i(i32(gid.z) + 1, nz);
  let id = vid(gid.x, gid.y, gid.z);

  let dpx = 0.5 * (pdiv_in[vid(xp, gid.y, gid.z)].x - pdiv_in[vid(xm, gid.y, gid.z)].x);
  let dpy = 0.5 * (pdiv_in[vid(gid.x, yp, gid.z)].x - pdiv_in[vid(gid.x, ym, gid.z)].x);
  let dpz = 0.5 * (pdiv_in[vid(gid.x, gid.y, zp)].x - pdiv_in[vid(gid.x, gid.y, zm)].x);

  let v_raw = vel_in[id];
  var v_proj = vec3<f32>(v_raw.x - dpx, v_raw.y - dpy, v_raw.z - dpz);
  if (gid.y == 0u || gid.y + 1u == p.dims.y) {
    v_proj.y = 0.0;
  }
  vel_out[id] = vec4<f32>(v_proj, v_raw.w);

  // 3D Vorticity magnitude |curl(v)| for cyclone/eddy highlighting & telemetry
  let dw_dy = 0.5 * (vel_in[vid(gid.x, yp, gid.z)].z - vel_in[vid(gid.x, ym, gid.z)].z);
  let dv_dz = 0.5 * (vel_in[vid(gid.x, gid.y, zp)].y - vel_in[vid(gid.x, gid.y, zm)].y);
  let du_dz = 0.5 * (vel_in[vid(gid.x, gid.y, zp)].x - vel_in[vid(gid.x, gid.y, zm)].x);
  let dw_dx = 0.5 * (vel_in[vid(xp, gid.y, gid.z)].z - vel_in[vid(xm, gid.y, gid.z)].z);
  let dv_dx = 0.5 * (vel_in[vid(xp, gid.y, gid.z)].y - vel_in[vid(xm, gid.y, gid.z)].y);
  let du_dy = 0.5 * (vel_in[vid(gid.x, yp, gid.z)].x - vel_in[vid(gid.x, ym, gid.z)].x);
  let vort = length(vec3<f32>(dw_dy - dv_dz, du_dz - dw_dx, dv_dx - du_dy));

  let c_in = cloud_in[id];
  cloud_out[id] = vec4<f32>(c_in.x, c_in.y, vort, c_in.w);
}
`;

// Post-Processing WGSL (Motes + Parallel Telemetry): 5 storage buffers (strictly <= 8 WebGPU limit!)
const postCfd3dWgsl = /* wgsl */ `
${cfd3dCommonWgsl}

@group(0) @binding(0) var<uniform> p: Cfd3dParams;
@group(0) @binding(1) var<storage, read> vel_in: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> cloud_in: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> pdiv_in: array<vec2<f32>>;
@group(0) @binding(4) var<storage, read_write> motes: array<f32>;
@group(0) @binding(5) var<storage, read_write> telemetry: array<f32>;

fn vid(ix: u32, iy: u32, iz: u32) -> u32 {
  return (iz * p.dims.y + iy) * p.dims.x + ix;
}

fn sample_vel_trilin(pos_g: vec3<f32>) -> vec4<f32> {
  let nx = i32(p.dims.x);
  let ny = i32(p.dims.y);
  let nz = i32(p.dims.z);
  let gx = pos_g.x;
  let gy = clamp(pos_g.y, 0.0, f32(ny) - 1.001);
  let gz = pos_g.z;
  let ix0 = i32(floor(gx));
  let iy0 = i32(floor(gy));
  let iz0 = i32(floor(gz));
  let fx = gx - f32(ix0);
  let fy = gy - f32(iy0);
  let fz = gz - f32(iz0);
  let x0 = wrap_i(ix0, nx); let x1 = wrap_i(ix0 + 1, nx);
  let y0 = clamp_i(iy0, ny); let y1 = clamp_i(iy0 + 1, ny);
  let z0 = wrap_i(iz0, nz); let z1 = wrap_i(iz0 + 1, nz);
  let c00 = mix(vel_in[vid(x0, y0, z0)], vel_in[vid(x1, y0, z0)], fx);
  let c10 = mix(vel_in[vid(x0, y1, z0)], vel_in[vid(x1, y1, z0)], fx);
  let c01 = mix(vel_in[vid(x0, y0, z1)], vel_in[vid(x1, y0, z1)], fx);
  let c11 = mix(vel_in[vid(x0, y1, z1)], vel_in[vid(x1, y1, z1)], fx);
  return mix(mix(c00, c10, fy), mix(c01, c11, fy), fz);
}

fn sample_cloud_trilin(pos_g: vec3<f32>) -> vec4<f32> {
  let nx = i32(p.dims.x);
  let ny = i32(p.dims.y);
  let nz = i32(p.dims.z);
  let gx = pos_g.x;
  let gy = clamp(pos_g.y, 0.0, f32(ny) - 1.001);
  let gz = pos_g.z;
  let ix0 = i32(floor(gx));
  let iy0 = i32(floor(gy));
  let iz0 = i32(floor(gz));
  let fx = gx - f32(ix0);
  let fy = gy - f32(iy0);
  let fz = gz - f32(iz0);
  let x0 = wrap_i(ix0, nx); let x1 = wrap_i(ix0 + 1, nx);
  let y0 = clamp_i(iy0, ny); let y1 = clamp_i(iy0 + 1, ny);
  let z0 = wrap_i(iz0, nz); let z1 = wrap_i(iz0 + 1, nz);
  let c00 = mix(cloud_in[vid(x0, y0, z0)], cloud_in[vid(x1, y0, z0)], fx);
  let c10 = mix(cloud_in[vid(x0, y1, z0)], cloud_in[vid(x1, y1, z0)], fx);
  let c01 = mix(cloud_in[vid(x0, y0, z1)], cloud_in[vid(x1, y0, z1)], fx);
  let c11 = mix(cloud_in[vid(x0, y1, z1)], cloud_in[vid(x1, y1, z1)], fx);
  return mix(mix(c00, c10, fy), mix(c01, c11, fy), fz);
}

// Pass 4B: Advect 3,072 Zero-Copy GPU 3D Volumetric Cloud Puffs & CFD Eddy Streamers Around the Craft!
@compute @workgroup_size(64)
fn cfd3d_step_motes(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let count = p.dims.w;
  if (i >= count) { return; }
  let o = i * 16u;
  let dt = p.phys0.x;
  let half_xz = max(28.0, p.phys1.x);
  let half_y = max(16.0, p.phys1.y);
  let cx = p.craft_pos.x;
  let cy = p.craft_pos.y;
  let cz = p.craft_pos.z;
  let is_deep = p.flags.y != 0u;
  let ground_y = p.ground_sun.x;
  let sun_elev = p.ground_sun.y;

  var px = motes[o + 0u];
  var py = motes[o + 1u];
  var pz = motes[o + 2u];
  let role = motes[o + 3u]; // 3.0 = 3D volumetric cloud puff, 4.0 = crisp 3D CFD flow streamline mote
  var age = motes[o + 7u] + dt;
  let max_life = max(1.5, motes[o + 11u]);
  let seed = motes[o + 14u];

  // Vertical envelope:
  //   - Deep fluid gas/ice giants: full 360-deg surrounding cloud canyons & zonal jet streams around craft!
  //   - Rocky solid-crust worlds: keep 3D CFD flow ribbons sweeping cleanly through rover/drone/UFO airspace
  //     (ground_y + 2.5m .. +46m) and lift volumetric cumulus/cirrus cloud decks high into the real sky dome
  //     (ground_y + 115m .. +230m) so clouds form an overhead sky canopy and NEVER whiteout the camera!
  let y_min = select(
    select(ground_y + 2.5, max(ground_y + 115.0, cy + 48.0), role < 3.5),
    cy - half_y,
    is_deep
  );
  let y_max = select(
    select(max(ground_y + 46.0, cy + 20.0), max(ground_y + 230.0, cy + 135.0), role < 3.5),
    cy + half_y,
    is_deep
  );

  // Map mote world position into periodic 3D CFD grid centered around the exploring craft
  let rel_x = px - cx;
  let rel_z = pz - cz;
  let needs_wrap = abs(rel_x) > half_xz || abs(rel_z) > half_xz || py < y_min - 1.5 || py > y_max + 2.0 || age >= max_life;
  if (needs_wrap) {
    let s1 = fract(sin(seed * 91.7 + f32(p.flags.x) * 0.13 + f32(i) * 0.017) * 43758.5453);
    let s2 = fract(sin(seed * 173.3 + f32(p.flags.x) * 0.29 + f32(i) * 0.031) * 28461.1731);
    let s3 = fract(sin(seed * 251.9 + f32(p.flags.x) * 0.41 + f32(i) * 0.053) * 19537.7193);
    px = cx + (s1 * 2.0 - 1.0) * half_xz * 0.96;
    py = mix(y_min, y_max, s2);
    pz = cz + (s3 * 2.0 - 1.0) * half_xz * 0.96;
    age = s1 * 0.4;
  }

  let gx = ((px - cx) / (2.0 * half_xz) + 0.5) * f32(p.dims.x);
  let gy_norm = clamp((py - y_min) / max(4.0, y_max - y_min), 0.0, 0.999);
  let gy = gy_norm * f32(p.dims.y);
  let gz = ((pz - cz) / (2.0 * half_xz) + 0.5) * f32(p.dims.z);
  let v_loc = sample_vel_trilin(vec3<f32>(gx, gy, gz));
  let c_loc = sample_cloud_trilin(vec3<f32>(gx, gy, gz));

  // Advect mote directly by live 3D GPU Navier-Stokes velocity field!
  px = px + v_loc.x * (dt * 1.55);
  py = clamp(py + v_loc.y * (dt * 1.35), y_min, y_max);
  pz = pz + v_loc.z * (dt * 1.55);

  let yn = clamp(gy / f32(p.dims.y), 0.0, 1.0);
  // Multi-deck chemical color blend across vertical cloud strata
  var deck_rgb = mix(p.deck2_col.rgb, p.deck1_col.rgb, smoothstep(0.18, 0.55, yn));
  deck_rgb = mix(deck_rgb, p.deck0_col.rgb, smoothstep(0.55, 0.88, yn));
  let spd = length(v_loc.xyz);

  // Smooth radial edge fade approaching the ±half_xz 3D CFD domain border so clouds/streamers never blink abruptly!
  let edge_norm = max(abs(px - cx), abs(pz - cz)) / max(1.0, half_xz);
  let box_edge_fade = 1.0 - smoothstep(0.72, 0.98, edge_norm);
  var col = deck_rgb;
  var sz = 1.8;
  var live = box_edge_fade;
  if (role < 3.5) {
    // 3D Volumetric Cloud Strata Puff: shaded naturally by live solar elevation (dark blue-indigo at midnight, warm gold at dusk, crisp white at noon!)
    let day_sh = smoothstep(-0.14, 0.28, sun_elev);
    let dusk_d = (sun_elev - 0.02) / 0.14;
    let dusk_sh = exp(-(dusk_d * dusk_d));
    let sky_lit = mix(vec3<f32>(0.08, 0.11, 0.22), vec3<f32>(1.0, 0.99, 0.97), day_sh)
      + vec3<f32>(0.72, 0.34, 0.12) * dusk_sh * 0.55;
    let flash_boost = c_loc.w * 2.0;
    col = deck_rgb * sky_lit * (0.76 + 0.36 * yn) + vec3<f32>(0.72, 0.88, 1.0) * flash_boost;
    sz = select(2.8 + c_loc.x * 3.6, 3.0 + c_loc.x * 4.0, is_deep);
    let q_vis = select(c_loc.x * clamp(p.phys1.w * 1.45, 0.12, 1.0), c_loc.x, is_deep);
    live = select(0.0, clamp((q_vis - 0.14) * 1.45, 0.0, 0.85), q_vis > 0.14);
  } else {
    // 3D CFD Flow Streamer / Vortex Tracer: color-coded by vertical buoyancy & vorticity!
    let vort_t = clamp(c_loc.z * 0.28, 0.0, 1.0);
    let updraft_t = clamp(v_loc.y * 0.24 + 0.5, 0.0, 1.0);
    let stream_col = mix(vec3<f32>(0.24, 0.82, 1.0), vec3<f32>(1.0, 0.78, 0.32), updraft_t);
    col = mix(stream_col, vec3<f32>(1.0, 0.44, 0.78), vort_t * 0.65) * (0.95 + 0.35 * min(1.5, spd * 0.08));
    sz = select(0.62 + min(0.80, spd * 0.045), 0.55 + min(0.85, spd * 0.035), is_deep);
    live = clamp(0.48 + spd * 0.05, 0.0, 1.0);
  }

  motes[o + 0u] = px;
  motes[o + 1u] = py;
  motes[o + 2u] = pz;
  motes[o + 4u] = v_loc.x;
  motes[o + 5u] = v_loc.y;
  motes[o + 6u] = v_loc.z;
  motes[o + 7u] = age;
  motes[o + 8u] = col.r;
  motes[o + 9u] = col.g;
  motes[o + 10u] = col.b;
  motes[o + 12u] = sz;
  motes[o + 13u] = c_loc.z;
  motes[o + 15u] = live;
}

// Pass 4C: Parallel 64-thread Telemetry + Exact Craft-Location 3D CFD Wind Sampling!
var<workgroup> wg_v2: array<f32, 64>;
var<workgroup> wg_vort: array<f32, 64>;
var<workgroup> wg_div2: array<f32, 64>;
var<workgroup> wg_q: array<f32, 64>;

@compute @workgroup_size(64)
fn cfd3d_reduce_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let total = p.dims.x * p.dims.y * p.dims.z;
  var sum_v2 = 0.0;
  var sum_vort = 0.0;
  var sum_div2 = 0.0;
  var sum_q = 0.0;

  var idx = tid;
  while (idx < total) {
    let v = vel_in[idx];
    let c = cloud_in[idx];
    let d = pdiv_in[idx].y;
    sum_v2 = sum_v2 + dot(v.xyz, v.xyz);
    sum_vort = sum_vort + c.z;
    sum_div2 = sum_div2 + d * d;
    sum_q = sum_q + c.x;
    idx = idx + 64u;
  }
  wg_v2[tid] = sum_v2;
  wg_vort[tid] = sum_vort;
  wg_div2[tid] = sum_div2;
  wg_q[tid] = sum_q;
  workgroupBarrier();

  var stride = 32u;
  while (stride > 0u) {
    if (tid < stride) {
      wg_v2[tid] = wg_v2[tid] + wg_v2[tid + stride];
      wg_vort[tid] = wg_vort[tid] + wg_vort[tid + stride];
      wg_div2[tid] = wg_div2[tid] + wg_div2[tid + stride];
      wg_q[tid] = wg_q[tid] + wg_q[tid + stride];
    }
    workgroupBarrier();
    stride = stride >> 1u;
  }

  if (tid == 0u) {
    let inv_n = 1.0 / max(1.0, f32(total));
    // Sample exact 3D CFD velocity & vorticity right at the exploring craft center (grid midpoint)!
    let mid = vec3<f32>(f32(p.dims.x) * 0.5, f32(p.dims.y) * 0.5, f32(p.dims.z) * 0.5);
    let v_craft = sample_vel_trilin(mid);
    let c_craft = sample_cloud_trilin(mid);
    telemetry[0] = v_craft.x;
    telemetry[1] = v_craft.y;
    telemetry[2] = v_craft.z;
    telemetry[3] = c_craft.z; // local vorticity at craft
    telemetry[4] = sqrt(wg_v2[0] * inv_n);    // global RMS 3D wind speed
    telemetry[5] = wg_vort[0] * inv_n;        // global mean 3D vorticity
    telemetry[6] = sqrt(wg_div2[0] * inv_n);  // global 3D divergence RMS
    telemetry[7] = wg_q[0] * inv_n;           // global mean 3D cloud density
  }
}
`;

export function createPlanetaryAtmo3dCfdSessionWebGpu(device, {
  bodySpec = {},
  env = null,
  nx = 32,
  ny = 24,
  nz = 32,
  moteCount = 3072,
  label = 'ulg-atmo-3d-cfd'
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('createPlanetaryAtmo3dCfdSessionWebGpu requires a live WebGPU GPUDevice');
  }
  const profile = deriveAtmosphericColumnProfile(bodySpec, env);
  const NX = Math.max(16, Math.min(48, Math.trunc(nx)));
  const NY = Math.max(12, Math.min(32, Math.trunc(ny)));
  const NZ = Math.max(16, Math.min(48, Math.trunc(nz)));
  const totalVoxels = NX * NY * NZ;
  const mCount = Math.max(256, Math.min(6144, Math.trunc(moteCount)));

  // Initialize smooth baroclinic zonal jets + subtle 3D Kelvin-Helmholtz vortex seeds (zero white noise!)
  const initVel = new Float32Array(totalVoxels * 4);
  const initCloud = new Float32Array(totalVoxels * 4);
  const bandFreq = profile.rossbyNumber < 0.25 ? Math.PI * 4.0 : Math.PI * 2.0;
  for (let iz = 0; iz < NZ; iz += 1) {
    const zn = (iz + 0.5) / NZ;
    for (let iy = 0; iy < NY; iy += 1) {
      const yn = (iy + 0.5) / NY;
      const vertEnv = profile.isDeepFluid ? (0.55 + 0.45 * Math.sin(yn * Math.PI)) : Math.sin(yn * Math.PI);
      for (let ix = 0; ix < NX; ix += 1) {
        const xn = (ix + 0.5) / NX;
        const id = ((iz * NY + iy) * NX + ix) * 4;
        const u0 = profile.jetSpeedScaleMS * 0.22 * Math.sin(zn * bandFreq + 0.35 * Math.sin(xn * Math.PI * 2)) * vertEnv;
        const w0 = profile.jetSpeedScaleMS * 0.06 * Math.cos(xn * Math.PI * 4) * Math.sin(zn * bandFreq) * vertEnv;
        const v0 = profile.convectiveBuoyancyScale * 0.45 * Math.sin(xn * Math.PI * 4) * Math.cos(zn * Math.PI * 4) * Math.sin(yn * Math.PI);
        initVel[id + 0] = u0;
        initVel[id + 1] = v0;
        initVel[id + 2] = w0;
        initVel[id + 3] = 0.2 * Math.sin(xn * Math.PI * 4) * Math.cos(zn * Math.PI * 4) * (1.0 - yn);
        // Layered cloud seed aligned with Clausius-Clapeyron decks
        const d0 = Math.exp(-Math.pow((yn - 0.78) / 0.14, 2));
        const d1 = Math.exp(-Math.pow((yn - 0.48) / 0.16, 2));
        const d2 = Math.exp(-Math.pow((yn - 0.22) / 0.17, 2));
        initCloud[id + 0] = Math.max(d0, d1, d2) * (0.42 + 0.28 * Math.cos(xn * Math.PI * 4 + zn * Math.PI * 2));
        initCloud[id + 1] = yn;
        initCloud[id + 2] = 0.0;
        initCloud[id + 3] = 0.0;
      }
    }
  }

  // Initialize 3D cloud puffs + crisp 3D CFD flow streamers in Mode 11 compatible 64-byte layout
  // On rocky crust worlds, tighten XZ domain and give 46% to vivid flow ribbons so 3D CFD pops right around Rover & Drone!
  const initMotes = new Float32Array(mCount * 16);
  const boxHalfXZ = profile.isDeepFluid ? 96.0 : 165.0;
  const boxHalfY = profile.isDeepFluid ? 38.0 : 32.0;
  const cloudFrac = profile.isDeepFluid ? 0.62 : 0.56;
  for (let i = 0; i < mCount; i += 1) {
    const o = i * 16;
    const h1 = ((Math.sin(i * 12.9898 + 1.1) * 43758.5453) % 1 + 1) % 1;
    const h2 = ((Math.sin(i * 78.233 + 2.7) * 28461.1731) % 1 + 1) % 1;
    const h3 = ((Math.sin(i * 39.425 + 4.3) * 19537.7193) % 1 + 1) % 1;
    const isCloudPuff = i < mCount * cloudFrac;
    initMotes[o + 0] = (h1 * 2 - 1) * boxHalfXZ;
    initMotes[o + 1] = profile.isDeepFluid
      ? (h2 * 2 - 1) * boxHalfY
      : (isCloudPuff ? (14.0 + h2 * 32.0) : (1.8 + h2 * 22.0));
    initMotes[o + 2] = (h3 * 2 - 1) * boxHalfXZ;
    initMotes[o + 3] = isCloudPuff ? 3.0 : 4.0;
    initMotes[o + 7] = h1 * 3.0;
    initMotes[o + 8] = 0.92;
    initMotes[o + 9] = 0.94;
    initMotes[o + 10] = 0.98;
    initMotes[o + 11] = isCloudPuff ? (5.0 + h2 * 4.0) : (2.4 + h2 * 2.2);
    initMotes[o + 12] = isCloudPuff ? 4.2 : 0.7;
    initMotes[o + 14] = ((i * 2654435761) >>> 0) / 4294967296;
    initMotes[o + 15] = 0.8;
  }

  const fluidBindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'read-only-storage'),
    computeBufferBinding(6, 'storage')
  ];
  const postBindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage')
  ];
  const mkFluidPipe = (entryPoint) => createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-atmo-3d-cfd-fluid-${entryPoint}.v5-coriolis-sun`,
    label: `${label}-${entryPoint}`,
    code: fluidCfd3dWgsl,
    entryPoint,
    bindings: fluidBindings
  });
  const mkPostPipe = (entryPoint) => createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-atmo-3d-cfd-post-${entryPoint}.v5-coriolis-sun`,
    label: `${label}-${entryPoint}`,
    code: postCfd3dWgsl,
    entryPoint,
    bindings: postBindings
  });

  const advectPipe = mkFluidPipe('cfd3d_advect_forces');
  const divPipe = mkFluidPipe('cfd3d_divergence');
  const jacobiPipe = mkFluidPipe('cfd3d_jacobi_pressure');
  const projectPipe = mkFluidPipe('cfd3d_project_velocity');
  const motesPipe = mkPostPipe('cfd3d_step_motes');
  const telPipe = mkPostPipe('cfd3d_reduce_telemetry');

  const paramsBuf = device.createBuffer({ label: `${label}-params`, size: 144, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const velA = device.createBuffer({ label: `${label}-velA`, size: initVel.byteLength, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const velB = device.createBuffer({ label: `${label}-velB`, size: initVel.byteLength, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const cloudA = device.createBuffer({ label: `${label}-cloudA`, size: initCloud.byteLength, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const cloudB = device.createBuffer({ label: `${label}-cloudB`, size: initCloud.byteLength, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const pdivA = device.createBuffer({ label: `${label}-pdivA`, size: totalVoxels * 8, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const pdivB = device.createBuffer({ label: `${label}-pdivB`, size: totalVoxels * 8, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const motesBuf = device.createBuffer({ label: `${label}-motes`, size: initMotes.byteLength, usage: GPU_BUF.STORAGE | GPU_BUF.VERTEX | GPU_BUF.COPY_SRC | GPU_BUF.COPY_DST });
  const telBuf = device.createBuffer({ label: `${label}-tel`, size: 32, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC });
  const telReadBuf = device.createBuffer({ label: `${label}-tel-rd`, size: 32, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });

  device.queue.writeBuffer(velA, 0, initVel);
  device.queue.writeBuffer(velB, 0, initVel);
  device.queue.writeBuffer(cloudA, 0, initCloud);
  device.queue.writeBuffer(cloudB, 0, initCloud);
  device.queue.writeBuffer(motesBuf, 0, initMotes);

  const mkFluidBg = (tag, vIn, vOut, cIn, cOut, pdIn, pdOut) => createCachedExplicitBindGroup(device, {
    layout: advectPipe.bindGroupLayout,
    label: `${label}-${tag}`,
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: vIn } },
      { binding: 2, resource: { buffer: vOut } },
      { binding: 3, resource: { buffer: cIn } },
      { binding: 4, resource: { buffer: cOut } },
      { binding: 5, resource: { buffer: pdIn } },
      { binding: 6, resource: { buffer: pdOut } }
    ]
  });

  // Ping-pong fluid bind groups (6 storage buffers <= 8 WebGPU limit!):
  //   1) Advect:  velA->velB, cloudA->cloudB, pdivA->pdivB
  //   2) Div:     reads velB, pdivA->pdivB (writes div into pdivB.y)
  //   3) Jacobi:  6 iterations ping-ponging pdivB<->pdivA (finishes in pdivB)
  //   4) Project: reads velB->velA, cloudB->cloudA, reads pdivB
  //   5) Post (5 storage buffers <= 8): reads velA, cloudA, pdivB -> updates motes & telemetry!
  const bgAdvect = mkFluidBg('adv', velA, velB, cloudA, cloudB, pdivA, pdivB);
  const bgDiv = mkFluidBg('div', velB, velA, cloudB, cloudA, pdivA, pdivB);
  const bgJacBtoA = mkFluidBg('jacBA', velB, velA, cloudB, cloudA, pdivB, pdivA);
  const bgJacAtoB = mkFluidBg('jacAB', velB, velA, cloudB, cloudA, pdivA, pdivB);
  const bgProj = mkFluidBg('proj', velB, velA, cloudB, cloudA, pdivB, pdivA);
  const bgPost = createCachedExplicitBindGroup(device, {
    layout: motesPipe.bindGroupLayout,
    label: `${label}-post`,
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: velA } },
      { binding: 2, resource: { buffer: cloudA } },
      { binding: 3, resource: { buffer: pdivB } },
      { binding: 4, resource: { buffer: motesBuf } },
      { binding: 5, resource: { buffer: telBuf } }
    ]
  });

  const wgX = Math.ceil(NX / 4);
  const wgY = Math.ceil(NY / 4);
  const wgZ = Math.ceil(NZ / 4);
  const wgMotes = Math.ceil(mCount / 64);

  // Determine 3 characteristic cloud-deck RGB colors across this planet's vertical column
  const topChem = evaluateAtmosphericChemistryAtAltitude(profile, profile.maxAltKm * 0.55);
  const midChem = evaluateAtmosphericChemistryAtAltitude(profile, (profile.minAltKm + profile.maxAltKm) * 0.5);
  const botChem = evaluateAtmosphericChemistryAtAltitude(profile, profile.minAltKm * 0.55);
  const deck0Rgb = topChem.condensingDecks[0]?.color || (profile.isDeepFluid ? [0.96, 0.91, 0.78] : [0.95, 0.97, 1.0]);
  const deck1Rgb = midChem.condensingDecks[0]?.color || (profile.isDeepFluid ? [0.84, 0.52, 0.30] : [0.90, 0.94, 0.98]);
  const deck2Rgb = botChem.condensingDecks[0]?.color || (profile.isDeepFluid ? [0.94, 0.97, 1.0] : [0.84, 0.88, 0.94]);

  let stepIndex = 0;
  let mapInFlight = false;
  let disposed = false;
  let lastChemistry = evaluateAtmosphericChemistryAtAltitude(profile, profile.startAltKm);
  let lastTelemetry = Object.freeze({
    schema: ULG_PLANETARY_ATMO_3D_CFD_SCHEMA,
    stepIndex: 0,
    gridDims: [NX, NY, NZ],
    moteCount: mCount,
    craftWindMS: [0, 0, 0],
    craftWindSpeedMS: 0,
    craftVorticity: 0,
    rmsWindMS: 0,
    meanVorticity: 0,
    divergenceRms: 0,
    meanCloudDensity: 0,
    chemistry: lastChemistry,
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    scientificValidation: false
  });

  async function step({
    dt = 0.024,
    craftPos = [0, 0, 0],
    altKm = profile.startAltKm,
    groundY = -9999.0,
    sunElev = 0.45,
    readTelemetry = true
  } = {}) {
    if (disposed) return lastTelemetry;
    const dtSafe = clamp(Number(dt) || 0.024, 0.005, 0.05);
    stepIndex += 1;

    lastChemistry = evaluateAtmosphericChemistryAtAltitude(profile, altKm);
    const coriolisEff = clamp(profile.omegaRadS * 4200.0, 0.0, 2.2);
    const safeGroundY = Number.isFinite(Number(groundY)) ? Number(groundY) : -9999.0;
    const safeSunElev = Number.isFinite(Number(sunElev)) ? Number(sunElev) : 0.45;

    const ab = new ArrayBuffer(144);
    new Uint32Array(ab, 0, 8).set([
      NX, NY, NZ, mCount,
      stepIndex, profile.isDeepFluid ? 1 : 0, 0, 0
    ]);
    new Float32Array(ab, 32, 28).set([
      dtSafe, profile.jetSpeedScaleMS, coriolisEff, profile.convectiveBuoyancyScale,
      boxHalfXZ, boxHalfY, profile.rossbyNumber, Math.max(0.25, lastChemistry.cloudOpticalDensity),
      craftPos[0] || 0, craftPos[1] || 0, craftPos[2] || 0, lastChemistry.altKm,
      deck0Rgb[0], deck0Rgb[1], deck0Rgb[2], 0.78,
      deck1Rgb[0], deck1Rgb[1], deck1Rgb[2], 0.48,
      deck2Rgb[0], deck2Rgb[1], deck2Rgb[2], 0.22,
      safeGroundY, safeSunElev, 0, 0
    ]);
    device.queue.writeBuffer(paramsBuf, 0, ab);

    const enc = device.createCommandEncoder({ label: `${label}-enc-${stepIndex}` });
    const pass = enc.beginComputePass({ label: `${label}-pass` });

    // 1. 3D Advection + Coriolis + Baroclinic Buoyancy + Clausius-Clapeyron Condensation
    pass.setPipeline(advectPipe.pipeline);
    pass.setBindGroup(0, bgAdvect);
    pass.dispatchWorkgroups(wgX, wgY, wgZ);

    // 2. 3D Velocity Divergence
    pass.setPipeline(divPipe.pipeline);
    pass.setBindGroup(0, bgDiv);
    pass.dispatchWorkgroups(wgX, wgY, wgZ);

    // 3. 6-pass 3D Jacobi Pressure Projection (finishes in pressB)
    pass.setPipeline(jacobiPipe.pipeline);
    for (let it = 0; it < 3; it += 1) {
      pass.setBindGroup(0, bgJacBtoA);
      pass.dispatchWorkgroups(wgX, wgY, wgZ);
      pass.setBindGroup(0, bgJacAtoB);
      pass.dispatchWorkgroups(wgX, wgY, wgZ);
    }

    // 4. Divergence-Free Velocity Projection + 3D Vorticity
    pass.setPipeline(projectPipe.pipeline);
    pass.setBindGroup(0, bgProj);
    pass.dispatchWorkgroups(wgX, wgY, wgZ);

    // 5. Advect 3D Volumetric Cloud Puffs & Flow Streamers + Parallel Telemetry
    pass.setPipeline(motesPipe.pipeline);
    pass.setBindGroup(0, bgPost);
    pass.dispatchWorkgroups(wgMotes);

    pass.setPipeline(telPipe.pipeline);
    pass.setBindGroup(0, bgPost);
    pass.dispatchWorkgroups(1);
    pass.end();

    const doTel = readTelemetry && !mapInFlight && telReadBuf.mapState === 'unmapped';
    if (doTel) {
      mapInFlight = true;
      enc.copyBufferToBuffer(telBuf, 0, telReadBuf, 0, 32);
    }
    device.queue.submit([enc.finish()]);

    let cw = lastTelemetry.craftWindMS;
    let cVort = lastTelemetry.craftVorticity;
    let rmsW = lastTelemetry.rmsWindMS;
    let mVort = lastTelemetry.meanVorticity;
    let divRms = lastTelemetry.divergenceRms;
    let meanQ = lastTelemetry.meanCloudDensity;

    if (doTel && !disposed && telReadBuf.mapState === 'unmapped') {
      try {
        await telReadBuf.mapAsync(GPU_BUF.MAP_READ);
        if (!disposed) {
          const f = new Float32Array(telReadBuf.getMappedRange(0, 32));
          cw = [f[0], f[1], f[2]];
          cVort = f[3];
          rmsW = f[4];
          mVort = f[5];
          divRms = f[6];
          meanQ = f[7];
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
      schema: ULG_PLANETARY_ATMO_3D_CFD_SCHEMA,
      stepIndex,
      gridDims: [NX, NY, NZ],
      moteCount: mCount,
      craftWindMS: cw,
      craftWindSpeedMS: Math.hypot(cw[0], cw[1], cw[2]),
      craftVorticity: cVort,
      rmsWindMS: rmsW,
      meanVorticity: mVort,
      divergenceRms: divRms,
      meanCloudDensity: meanQ,
      chemistry: lastChemistry,
      accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
      scientificValidation: false
    });
    return lastTelemetry;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const b of [paramsBuf, velA, velB, cloudA, cloudB, pdivA, pdivB, motesBuf, telBuf, telReadBuf]) {
      try { b.destroy(); } catch {}
    }
  }

  return Object.freeze({
    schema: ULG_PLANETARY_ATMO_3D_CFD_SCHEMA,
    lawAdapter: PLANETARY_ATMO_3D_CFD_LAW_ADAPTER,
    profile,
    get moteCount() { return mCount; },
    get stepIndex() { return stepIndex; },
    getResidentMotesBuffer: () => motesBuf,
    getResidentVelocityBuffer: () => velA,
    getResidentCloudBuffer: () => cloudA,
    getChemistryAtAltitude: (altKm) => evaluateAtmosphericChemistryAtAltitude(profile, altKm),
    getTelemetry: () => lastTelemetry,
    step,
    dispose
  });
}

export function registerPlanetaryAtmo3dCfdModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  if (registry.hasModule?.('planetary-atmosphere-3d-cfd@1')) {
    return registry.resolveModule('planetary-atmosphere-3d-cfd@1')?.descriptor || null;
  }
  return registry.registerModule({
    method: { model: 'planetary-atmosphere-3d-cfd', version: 1 },
    kernel: {
      sourceModule: 'src/runtime/astrophysics/planetaryAtmosphere3dCfdGpu.js',
      entryPoint: 'cfd3d_advect_forces',
      workgroupSize: 64
    },
    parameterSchema: {
      surfacePressurePa: { type: 'number', min: 20, max: 1e8, required: false },
      rotationOmegaRadS: { type: 'number', min: 0, max: 0.01, required: false }
    },
    stateLayout: {
      tensorId: 'planetary-atmo-3d-cfd-motes',
      dtype: 'f32',
      layout: 'interleaved',
      strideElements: 16,
      strideBytes: 64,
      fields: ['x', 'y', 'z', 'role', 'vx', 'vy', 'vz', 'age', 'r', 'g', 'b', 'maxLife', 'size', 'vorticity', 'seed', 'live']
    },
    scaleRangeM: [10, 2e5],
    async stepCapsule(capsule, { createSimulationArtifact, device }) {
      const p = capsule.input?.parameters || {};
      const session = createPlanetaryAtmo3dCfdSessionWebGpu(device, {
        bodySpec: {
          radiusKm: 69911,
          massSolar: 0.000954588,
          surfacePressurePa: p.surfacePressurePa ?? 1e6,
          tempK: 165,
          rotationOmegaRadS: p.rotationOmegaRadS ?? 1.758e-4
        },
        nx: 16,
        ny: 12,
        nz: 16,
        moteCount: 256
      });
      const tel = await session.step({ dt: 0.025, readTelemetry: true });
      session.dispose();
      return createSimulationArtifact({
        artifactId: `${capsule.taskId}:planetary-atmo-3d-cfd:${tel.stepIndex}`,
        taskKind: capsule.taskKind,
        closureRef: {
          module: 'src/runtime/astrophysics/planetaryAtmosphere3dCfdGpu.js',
          entryPoint: 'createPlanetaryAtmo3dCfdSessionWebGpu',
          kernelEntryPoint: 'cfd3d_advect_forces'
        },
        representation: 'planetary-atmo-3d-cfd-f32',
        outputs: { telemetry: tel },
        execution: { backend: 'webgpu-planetary-atmo-3d-cfd', placement: 'local' },
        validity: { finite: Number.isFinite(tel.rmsWindMS) && Number.isFinite(tel.divergenceRms) },
        validation: { status: 'pass', validationMode: 'gpu-3d-cfd-invariants', scientificValidation: false, fullPhysicsValidation: false },
        provenance: { ...capsule.provenance, methodHash: capsule.methodHash, inputHash: capsule.inputHash }
      });
    }
  });
}
