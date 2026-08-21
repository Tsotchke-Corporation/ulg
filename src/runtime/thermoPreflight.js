// Thermodynamic energy-feasibility preflight for the SPH phase demo.
//
// This is the demo plan's "Immediate Next Slice": a deterministic, headless energy budget
// that decides whether a requested initial state can reach a requested final state under the
// given boundary, and reports the per-wall energy ledger. No particles, no renderer, no GPU.
//
// It is closure/provenance + energy-budget evidence only. The material numbers come from
// tagged reference fixtures (`referenceMaterials.js`), so every result carries
// scientific/material/EOS/SPH/phase-change validation = false and closureBacked = false until
// demo plan P2 swaps in MoonLab/Eshkol material closures.

import {
  PHYSICAL_CONSTANTS,
  REFERENCE_MATERIALS,
  idealGasDensityKgPerM3,
  phaseOf,
  specificEnergyJPerKg
} from './materials/referenceMaterials.js';
import {
  resolveSphThermalEnvironmentAuthority,
  resolveSphWallReservoirAuthority
} from './thermalEnvironmentAuthority.js';

export const ULG_THERMODYNAMIC_PREFLIGHT_SCHEMA = 'peercompute.ulg.thermodynamic-preflight.v0';
export const SPH_PHASE_SCENARIO_ID = 'sph-phase-ice-on-molten-iron';

const WALL_FACE_IDS = ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax'];
const FAHRENHEIT_MINUS_40_K = 233.15; // -40 F == -40 C == 233.15 K

function cubeVolumeFromEdge(edgeM) {
  return edgeM * edgeM * edgeM;
}

function edgeFromVolume(volumeM3) {
  return Math.cbrt(volumeM3);
}

/**
 * Build the `sph-phase-ice-on-molten-iron` scenario. Defaults: a 10 m sealed box of -40 F
 * air at 1 atm, a 1 m ice cube, an iron cube at 1/8 the ice volume (0.5 m edge) initially
 * molten above the Fe liquidus, and six infinite fixed-temperature reservoir walls at -40 F.
 * Geometry, temperatures, wall temps, and macro-particle counts are all overridable; the
 * material laws are not.
 */
export function createSphPhaseScenario(overrides = {}) {
  const sceneLengthScale = Number(overrides.sceneLengthScale ?? 1);
  if (!Number.isFinite(sceneLengthScale) || !(sceneLengthScale > 0)) {
    throw new RangeError('sceneLengthScale must be a positive finite number');
  }
  const referenceIceEdgeM = Number(overrides.iceEdgeM ?? 1);
  if (!Number.isFinite(referenceIceEdgeM) || !(referenceIceEdgeM > 0)) {
    throw new RangeError('iceEdgeM must be a positive finite number');
  }
  const iceEdgeM = referenceIceEdgeM * sceneLengthScale;
  const iceVolumeM3 = cubeVolumeFromEdge(iceEdgeM);
  const ironVolumeFractionOfIce = overrides.ironVolumeFractionOfIce ?? 1 / 8;
  const referenceIronVolumeM3 = overrides.ironVolumeM3
    ?? cubeVolumeFromEdge(referenceIceEdgeM) * ironVolumeFractionOfIce;
  const ironVolumeM3 = referenceIronVolumeM3 * sceneLengthScale ** 3;
  const referenceBoxEdgeM = Number(overrides.boxEdgeM ?? 10);
  // Box can be a rectangular cuboid [Lx, Ly, Lz]; a scalar edge keeps it cubic.
  const referenceBoxDimensionsM = overrides.boxDimensionsM
    ?? [referenceBoxEdgeM, referenceBoxEdgeM, referenceBoxEdgeM];
  if (
    !Array.isArray(referenceBoxDimensionsM)
    || referenceBoxDimensionsM.length !== 3
    || referenceBoxDimensionsM.some((value) => (
      !Number.isFinite(Number(value)) || !(Number(value) > 0)
    ))
  ) {
    throw new RangeError('boxDimensionsM must contain three positive finite numbers');
  }
  const boxDimensionsM = referenceBoxDimensionsM.map(
    (value) => Number(value) * sceneLengthScale
  );
  const resolvedReferenceBoxEdgeM =
    Math.max(...referenceBoxDimensionsM.map(Number));
  const boxEdgeM = Math.max(...boxDimensionsM);
  const wallModel = overrides.wallModel ?? 'infinite-fixed-temperature-reservoir';
  const defaultWallTempK = overrides.wallTemperatureK ?? FAHRENHEIT_MINUS_40_K;
  const wallFaces = {};
  for (const faceId of WALL_FACE_IDS) {
    wallFaces[faceId] = overrides.wallFaces?.[faceId] ?? defaultWallTempK;
  }
  const gasInitialTemperatureK =
    overrides.gasInitialTemperatureK ?? FAHRENHEIT_MINUS_40_K;
  const ambientTemperatureOverrideProvided =
    overrides.ambientTemperatureK !== undefined
    && overrides.ambientTemperatureK !== null;
  const thermalEnvironment = resolveSphThermalEnvironmentAuthority({
    ambientTemperatureK: ambientTemperatureOverrideProvided
      ? overrides.ambientTemperatureK
      : gasInitialTemperatureK,
    source: ambientTemperatureOverrideProvided
      ? 'scenario-ambient-temperature-override'
      : 'scenario-gas-initial-temperature',
    sourceScenarioId: SPH_PHASE_SCENARIO_ID
  });
  const wallReservoir = resolveSphWallReservoirAuthority({
    wallTemperaturesK: wallFaces,
    wallModel,
    source: 'scenario-wall-boundary',
    sourceScenarioId: SPH_PHASE_SCENARIO_ID
  });
  return {
    scenarioId: SPH_PHASE_SCENARIO_ID,
    sceneLengthScale,
    referenceGeometry: {
      iceEdgeM: referenceIceEdgeM,
      ironVolumeM3: referenceIronVolumeM3,
      boxEdgeM: resolvedReferenceBoxEdgeM,
      boxDimensionsM: referenceBoxDimensionsM.map(Number)
    },
    box: { edgeM: boxEdgeM, dimensionsM: boxDimensionsM, volumeM3: boxDimensionsM[0] * boxDimensionsM[1] * boxDimensionsM[2] },
    gravityMPerS2: overrides.gravityMPerS2 ?? 9.80665,
    ice: {
      material: 'h2o',
      edgeM: iceEdgeM,
      volumeM3: iceVolumeM3,
      initialTemperatureK: overrides.iceInitialTemperatureK ?? FAHRENHEIT_MINUS_40_K,
      targetPhase: 'solid'
    },
    iron: {
      material: 'fe',
      volumeM3: ironVolumeM3,
      edgeM: edgeFromVolume(ironVolumeM3),
      volumeFractionOfIce: ironVolumeM3 / iceVolumeM3,
      // Molten: above the Fe liquidus (1811 K) by a configurable superheat.
      initialTemperatureK: overrides.ironInitialTemperatureK ?? (REFERENCE_MATERIALS.fe.meltingPointK + 39),
      targetPhase: 'solid'
    },
    gas: {
      material: 'air',
      pressurePa: overrides.gasPressurePa ?? PHYSICAL_CONSTANTS.standardAtmospherePa,
      initialTemperatureK: gasInitialTemperatureK
    },
    ambientTemperatureK: thermalEnvironment.ambientTemperatureK,
    thermalEnvironment,
    wallReservoirAuthority: wallReservoir,
    walls: {
      model: wallReservoir.model,
      faces: wallReservoir.faces,
      authority: wallReservoir
    },
    particleResolution: {
      h2o: overrides.particleResolution?.h2o ?? 4096,
      fe: overrides.particleResolution?.fe ?? 2048,
      gas: overrides.particleResolution?.gas ?? 8192
    }
  };
}

function representedEntities(material, massKg, macroParticleCount) {
  const molarMass = REFERENCE_MATERIALS[material].molarMassKgPerMol;
  const totalEntities = (massKg / molarMass) * PHYSICAL_CONSTANTS.avogadroPerMol;
  return {
    material,
    macroParticleCount,
    totalEntities,
    entitiesPerMacroParticle: macroParticleCount > 0 ? totalEntities / macroParticleCount : null
  };
}

function solveAdiabaticEquilibriumK({ mFe, tFe0, mIce, tIce0, mAir, tAir0 }) {
  const totalEnergy = (t) =>
    mFe * specificEnergyJPerKg('fe', t)
    + mIce * specificEnergyJPerKg('h2o', t)
    + mAir * specificEnergyJPerKg('air', t);
  const targetEnergy = mFe * specificEnergyJPerKg('fe', tFe0)
    + mIce * specificEnergyJPerKg('h2o', tIce0)
    + mAir * specificEnergyJPerKg('air', tAir0);
  let lo = Math.min(tFe0, tIce0, tAir0);
  let hi = Math.max(tFe0, tIce0, tAir0);
  // Total internal energy is monotonic increasing in a uniform temperature, so bisection on
  // energy conservation has a unique root.
  for (let i = 0; i < 200; i += 1) {
    const mid = 0.5 * (lo + hi);
    if (totalEnergy(mid) < targetEnergy) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * Run the energy-feasibility preflight for a scenario built by `createSphPhaseScenario`.
 */
export function computeThermodynamicPreflight(scenario = createSphPhaseScenario()) {
  const h2o = REFERENCE_MATERIALS.h2o;
  const fe = REFERENCE_MATERIALS.fe;
  const air = REFERENCE_MATERIALS.air;
  const waterFreezingK = h2o.meltingPointK;

  // --- Masses (mass is conserved; iron mass is set by its initial molten density) ---
  const ironMassKg = scenario.iron.volumeM3 * fe.densityKgPerM3.liquid;
  const iceMassKg = scenario.ice.volumeM3 * h2o.densityKgPerM3.solid;
  const airVolumeM3 = scenario.box.volumeM3 - scenario.iron.volumeM3 - scenario.ice.volumeM3;
  const airDensityKgPerM3 = idealGasDensityKgPerM3({
    pressurePa: scenario.gas.pressurePa,
    temperatureK: scenario.gas.initialTemperatureK,
    molarMassKgPerMol: air.molarMassKgPerMol
  });
  const airMassKg = airVolumeM3 * airDensityKgPerM3;

  const tFe0 = scenario.iron.initialTemperatureK;
  const tIce0 = scenario.ice.initialTemperatureK;
  const tAir0 = scenario.gas.initialTemperatureK;

  // --- Boundary: asymptotic interior temperature and exported heat ---
  const wallTemps = WALL_FACE_IDS.map((faceId) => scenario.walls.faces[faceId]);
  const minWallTempK = Math.min(...wallTemps);
  const maxWallTempK = Math.max(...wallTemps);
  const meanWallTempK = wallTemps.reduce((sum, t) => sum + t, 0) / wallTemps.length;
  const adiabatic = scenario.walls.model === 'adiabatic';

  const adiabaticEquilibriumK = solveAdiabaticEquilibriumK({
    mFe: ironMassKg, tFe0, mIce: iceMassKg, tIce0, mAir: airMassKg, tAir0
  });
  // Infinite fixed-temperature reservoirs drive the lumped interior to the (mean) wall
  // temperature over unbounded time; an adiabatic box conserves energy to a mixed equilibrium.
  const asymptoticInteriorTempK = adiabatic ? adiabaticEquilibriumK : meanWallTempK;

  const initialEnergyJ = ironMassKg * specificEnergyJPerKg('fe', tFe0)
    + iceMassKg * specificEnergyJPerKg('h2o', tIce0)
    + airMassKg * specificEnergyJPerKg('air', tAir0);
  const finalEnergyJ = ironMassKg * specificEnergyJPerKg('fe', asymptoticInteriorTempK)
    + iceMassKg * specificEnergyJPerKg('h2o', asymptoticInteriorTempK)
    + airMassKg * specificEnergyJPerKg('air', asymptoticInteriorTempK);
  // Positive = the system must export this much energy to the walls to reach the final state.
  const heatExportedToWallsJ = adiabatic ? 0 : initialEnergyJ - finalEnergyJ;

  // --- Feasibility of the requested final state (cold solid iron + ice) ---
  // The binding constraint is the warmest sustained interior temperature: any reservoir at or
  // above the water freezing point sustains an unfrozen region (adiabatic uses its mixed temp).
  const bindingInteriorTempK = adiabatic ? adiabaticEquilibriumK : maxWallTempK;
  const feasibleH2oFrozen = bindingInteriorTempK < waterFreezingK;
  const feasibleFeSolid = bindingInteriorTempK < fe.meltingPointK;
  const feasible = feasibleH2oFrozen && feasibleFeSolid;
  const finalH2oPhase = phaseOf('h2o', bindingInteriorTempK);
  const finalFePhase = phaseOf('fe', bindingInteriorTempK);

  // --- Per-wall energy ledger (lumped, equal-area; not a resolved flux solve) ---
  const faceAreaM2 = scenario.box.edgeM * scenario.box.edgeM;
  const netExportPositive = !adiabatic && heatExportedToWallsJ > 0;
  // A face warmer than the final interior adds heat (source); a face at or below it removes the
  // net exported heat (sink). Uniform reservoirs at the asymptotic temperature are all sinks.
  const roleFor = (temperatureK) => {
    if (temperatureK > asymptoticInteriorTempK) return 'source';
    return netExportPositive ? 'sink' : 'balanced';
  };
  const sinkFaceCount = WALL_FACE_IDS.filter((faceId) => roleFor(scenario.walls.faces[faceId]) === 'sink').length;
  const wallLedger = WALL_FACE_IDS.map((faceId) => {
    const temperatureK = scenario.walls.faces[faceId];
    const role = roleFor(temperatureK);
    const heatJ = (role === 'sink' && sinkFaceCount > 0)
      ? heatExportedToWallsJ / sinkFaceCount
      : 0;
    return { faceId, temperatureK, role, areaM2: faceAreaM2, areaFraction: 1 / WALL_FACE_IDS.length, heatJ };
  });

  // --- Transient phase-excursion energetics (upper-bound energy availability) ---
  const ironReleasableHeatJ = ironMassKg
    * (specificEnergyJPerKg('fe', tFe0) - specificEnergyJPerKg('fe', tIce0));
  const iceFullMeltEnergyJ = iceMassKg
    * (h2o.cpJPerKgK.solid * (waterFreezingK - tIce0) + h2o.latentHeatFusionJPerKg);
  const iceFullBoilEnergyJ = iceFullMeltEnergyJ + iceMassKg
    * (h2o.cpJPerKgK.liquid * (h2o.boilingPointK - waterFreezingK) + h2o.latentHeatVaporizationJPerKg);

  const phasePathBudget = [
    { name: 'iron-liquid-cool-to-liquidus', material: 'fe', energyJ: ironMassKg * fe.cpJPerKgK.liquid * Math.max(0, tFe0 - fe.meltingPointK) },
    { name: 'iron-fusion-release', material: 'fe', energyJ: ironMassKg * fe.latentHeatFusionJPerKg },
    { name: 'iron-solid-cool-to-final', material: 'fe', energyJ: ironMassKg * fe.cpJPerKgK.solid * Math.max(0, fe.meltingPointK - asymptoticInteriorTempK) },
    { name: 'ice-warm-to-melt', material: 'h2o', energyJ: iceMassKg * h2o.cpJPerKgK.solid * (waterFreezingK - tIce0) },
    { name: 'ice-fusion', material: 'h2o', energyJ: iceMassKg * h2o.latentHeatFusionJPerKg },
    { name: 'water-warm-to-boil', material: 'h2o', energyJ: iceMassKg * h2o.cpJPerKgK.liquid * (h2o.boilingPointK - waterFreezingK) },
    { name: 'water-vaporization', material: 'h2o', energyJ: iceMassKg * h2o.latentHeatVaporizationJPerKg }
  ];

  const blockers = [
    'thermodynamic-preflight-reference-fixtures-not-closure-backed',
    'thermodynamic-preflight-not-full-physics-validated'
  ];
  if (!feasible) {
    blockers.push('requested-final-state-energetically-infeasible');
  }

  return {
    scenarioId: scenario.scenarioId,
    geometry: {
      boxEdgeM: scenario.box.edgeM,
      boxVolumeM3: scenario.box.volumeM3,
      iceEdgeM: scenario.ice.edgeM,
      iceVolumeM3: scenario.ice.volumeM3,
      ironEdgeM: scenario.iron.edgeM,
      ironVolumeM3: scenario.iron.volumeM3,
      ironVolumeFractionOfIce: scenario.iron.volumeFractionOfIce,
      airVolumeM3
    },
    masses: {
      ironMassKg,
      iceMassKg,
      airMassKg,
      airDensityKgPerM3
    },
    initialState: { ironTemperatureK: tFe0, iceTemperatureK: tIce0, gasTemperatureK: tAir0 },
    boundary: {
      model: scenario.walls.model,
      wallTemperaturesK: { ...scenario.walls.faces },
      minWallTempK,
      maxWallTempK,
      meanWallTempK,
      asymptoticInteriorTempK,
      adiabaticEquilibriumK
    },
    energyBudget: {
      initialInternalEnergyJ: initialEnergyJ,
      finalInternalEnergyJ: finalEnergyJ,
      heatExportedToWallsJ,
      ledgerModel: 'lumped-equal-area-internal-energy',
      approximations: [
        'condensed-phase cp used as cv (incompressible)',
        'latent heats from 1 atm enthalpy used as internal-energy proxies',
        '0-D lumped temperature (no spatial gradients)'
      ],
      phasePathBudget,
      wallLedger
    },
    transient: {
      ironReleasableHeatJ,
      iceFullMeltEnergyJ,
      iceFullBoilEnergyJ,
      canFullyMeltIce: ironReleasableHeatJ >= iceFullMeltEnergyJ,
      canFullyBoilIce: ironReleasableHeatJ >= iceFullBoilEnergyJ,
      note: 'Energy-availability upper bounds; the conservative SPH carrier (demo plan P4) resolves the actual transient.'
    },
    feasibility: {
      feasible,
      feasibleH2oFrozen,
      feasibleFeSolid,
      bindingInteriorTempK,
      finalH2oPhase,
      finalFePhase,
      reason: feasible
        ? 'boundary drives the interior below the water freezing point; cold solid iron + ice is energetically reachable'
        : 'boundary cannot drive the interior below the water freezing point; requested cold iron + ice final state is energetically infeasible'
    },
    particleResolution: {
      h2o: representedEntities('h2o', iceMassKg, scenario.particleResolution.h2o),
      fe: representedEntities('fe', ironMassKg, scenario.particleResolution.fe),
      gas: representedEntities('air', airMassKg, scenario.particleResolution.gas)
    },
    status: feasible ? 'preflight-feasible' : 'preflight-infeasible',
    closureBacked: false,
    scientificValidation: false,
    fullPhysicsValidation: false,
    materialValidation: false,
    eosValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    blockers
  };
}
