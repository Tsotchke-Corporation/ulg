import { specificInternalEnergyJPerKg } from '../material/thermoState.js';
import { buildSphPhaseDemoState } from '../sphPhaseDemo.js';
import { sphInitialBodiesFromLegacyPhaseControls } from '../sphInitialBodies.js';
import { sphPhaseScenarioPresetById } from '../sphPhaseScenarioPresets.js';
import { createSphPhaseScenario } from '../thermoPreflight.js';
import {
  SPH_THERMAL_RADIATION_PAIR_RANGE_RADII,
  SPH_THERMAL_STEFAN_BOLTZMANN_W_PER_M2_K4,
  deriveGrayEmissivityForMaterial
} from './sphThermalGpuKernel.js';
import {
  evaluateSchroederSpatialMechanicalInterfaceFaceContact
} from './schroederSpatialMechanicalProposalsGpu.js';

export const ULG_SPH_IRON_ICE_ENERGY_BUDGET_ORACLE_SCHEMA =
  'peercompute.ulg.sph-iron-ice-energy-budget-oracle.v1';

const PRESET_ID = 'iron-ice-quench';
const FACE_IDS = Object.freeze([
  'xMin',
  'xMax',
  'yMin',
  'yMax',
  'zMin',
  'zMax'
]);

let cachedPresetInputs = null;

function harmonicMeanPositive(left, right) {
  if (!(left > 0) || !(right > 0)) return 0;
  return (2 * left * right) / (left + right);
}

function phase(properties, name) {
  const value = properties?.phases?.find((candidate) => candidate.name === name);
  if (!value) throw new Error(`missing ${name} phase`);
  return value;
}

function transition(properties, from, to) {
  const value = properties?.transitions?.find((candidate) => (
    candidate.from === from && candidate.to === to
  ));
  if (!value) throw new Error(`missing ${from}->${to} transition`);
  return value;
}

function presetWallFaces(controls) {
  return Object.fromEntries(FACE_IDS.map((faceId) => {
    const key = `w${faceId.toLowerCase()}`;
    const temperatureK = Number(controls[key]);
    if (!Number.isFinite(temperatureK) || !(temperatureK > 0)) {
      throw new TypeError(`preset ${key} must be a positive finite temperature`);
    }
    return [faceId, temperatureK];
  }));
}

function presetInputs() {
  if (cachedPresetInputs) return cachedPresetInputs;
  const preset = sphPhaseScenarioPresetById(PRESET_ID);
  if (!preset) throw new Error(`missing ${PRESET_ID} preset`);
  const controls = preset.controls;
  const sceneLengthScale = Number(preset.runtime.sceneLengthScale ?? 1);
  const boxDimensionsM = ['boxx', 'boxy', 'boxz'].map((key) => Number(controls[key]));
  const scenario = createSphPhaseScenario({
    wallFaces: presetWallFaces(controls),
    wallModel:
      preset.runtime.wallModel ?? 'infinite-fixed-temperature-reservoir',
    sceneLengthScale,
    boxDimensionsM
  });
  const initialBodies = sphInitialBodiesFromLegacyPhaseControls({
    baseMaterial: controls.base,
    dropMaterial: controls.drop,
    baseTemperatureK: Number(controls.baset),
    dropTemperatureK: Number(controls.dropt),
    baseParticlesPerEdge: Number(controls.basen),
    dropParticlesPerEdge: Number(controls.dropn),
    referenceBaseEdgeM: scenario.referenceGeometry.iceEdgeM,
    referenceBaseParticlesPerEdge: 5,
    sceneLengthScale,
    referenceBoxDimensionsM:
      scenario.referenceGeometry.boxDimensionsM,
    referenceBaseBottomM: Number(controls.iceh),
    referenceDropBottomM: Number(controls.ironh)
  });
  const demo = buildSphPhaseDemoState({
    scenario,
    initialBodies,
    mechanics: 'mlsmpm',
    allowReducedProductProperties: true
  });
  cachedPresetInputs = Object.freeze({
    preset,
    scenario: demo.scenario,
    fe: demo.materialProperties.fe,
    h2o: demo.materialProperties.h2o,
    spacing: demo.initialParticleSpacing,
    initialBodies: demo.initialBodies,
    temperaturesK: Object.freeze({
      iron: demo.initialTemperaturesK.drop,
      ice: demo.initialTemperaturesK.base,
      ambient: demo.scenario.thermalEnvironment.ambientTemperatureK
    })
  });
  return cachedPresetInputs;
}

function enthalpyPath(properties, initialTemperatureK) {
  const fusion = transition(properties, 'solid', 'liquid');
  const vaporization = transition(properties, 'liquid', 'gas');
  const initialSpecificEnergyJPerKg =
    specificInternalEnergyJPerKg(properties, initialTemperatureK);
  const meltStartSpecificEnergyJPerKg =
    specificInternalEnergyJPerKg(properties, fusion.temperatureK);
  const boilStartSpecificEnergyJPerKg =
    specificInternalEnergyJPerKg(properties, vaporization.temperatureK);
  const fullMeltSpecificEnergyJPerKg =
    meltStartSpecificEnergyJPerKg + fusion.latentHeatJPerKg;
  const firstVaporSpecificEnergyJPerKg = boilStartSpecificEnergyJPerKg;
  const fullVaporSpecificEnergyJPerKg =
    boilStartSpecificEnergyJPerKg + vaporization.latentHeatJPerKg;
  return {
    initialSpecificEnergyJPerKg,
    warmSolidToMeltingJPerKg:
      meltStartSpecificEnergyJPerKg - initialSpecificEnergyJPerKg,
    fusionJPerKg: fusion.latentHeatJPerKg,
    fullMeltDemandJPerKg:
      fullMeltSpecificEnergyJPerKg - initialSpecificEnergyJPerKg,
    warmLiquidToBoilingJPerKg:
      boilStartSpecificEnergyJPerKg - fullMeltSpecificEnergyJPerKg,
    firstVaporDemandJPerKg:
      firstVaporSpecificEnergyJPerKg - initialSpecificEnergyJPerKg,
    vaporizationJPerKg: vaporization.latentHeatJPerKg,
    fullVaporDemandJPerKg:
      fullVaporSpecificEnergyJPerKg - initialSpecificEnergyJPerKg,
    meltingTemperatureK: fusion.temperatureK,
    boilingTemperatureK: vaporization.temperatureK
  };
}

function radiativePowerW({
  emissivityLeft,
  emissivityRight = 1,
  areaM2,
  leftTemperatureK,
  rightTemperatureK
}) {
  return emissivityLeft
    * emissivityRight
    * SPH_THERMAL_STEFAN_BOLTZMANN_W_PER_M2_K4
    * areaM2
    * (leftTemperatureK ** 4 - rightTemperatureK ** 4);
}

function initialRateHorizon({ demandJ, initialPowerW, availableEnergyJ }) {
  if (!(availableEnergyJ >= demandJ)) {
    return {
      status: 'energy-infeasible',
      minimumHorizonS: null,
      energyMarginJ: availableEnergyJ - demandJ
    };
  }
  if (!(initialPowerW > 0)) {
    return {
      status: 'transfer-rate-unavailable',
      minimumHorizonS: null,
      energyMarginJ: availableEnergyJ - demandJ
    };
  }
  return {
    status: 'initial-rate-horizon',
    minimumHorizonS: demandJ / initialPowerW,
    energyMarginJ: availableEnergyJ - demandJ
  };
}

function sphereRadiusFromVolumeM3(volumeM3) {
  const volume = Number(volumeM3);
  if (!Number.isFinite(volume) || !(volume > 0)) {
    throw new RangeError('particle volume must be positive and finite');
  }
  return Math.cbrt((3 * volume) / (4 * Math.PI));
}

function radiativeViewAreaM2(radiusM, otherRadiusM, distanceM) {
  if (!(radiusM > 0) || !(otherRadiusM > 0)) return 0;
  const distanceSquared = Math.max(distanceM * distanceM, 1e-12);
  const geometric = Math.PI * radiusM * radiusM
    * (otherRadiusM * otherRadiusM) / (4 * distanceSquared);
  const contactLimit = Math.PI * Math.min(radiusM, otherRadiusM) ** 2;
  return Math.min(geometric, contactLimit);
}

function latticeCenters(plan) {
  const [nx, ny, nz] = plan.particlesPerEdge;
  const [dx, dy, dz] = plan.spacingByAxisM;
  const [x0, y0, z0] = plan.boundsM.minM;
  const centers = [];
  for (let i = 0; i < nx; i += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (let k = 0; k < nz; k += 1) {
        centers.push([
          x0 + (i + 0.5) * dx,
          y0 + (j + 0.5) * dy,
          z0 + (k + 0.5) * dz
        ]);
      }
    }
  }
  return centers;
}

export function createSphIronIceEnergyBudgetOracle({
  targetVisualHorizonS = 2
} = {}) {
  const inputs = presetInputs();
  const ironTemperatureK = inputs.temperaturesK.iron;
  const iceTemperatureK = inputs.temperaturesK.ice;
  const ambientTemperatureK = inputs.temperaturesK.ambient;
  const ironPlan = inputs.spacing.drop;
  const icePlan = inputs.spacing.base;
  const ironSizeM = [...ironPlan.sizeM];
  const iceSizeM = [...icePlan.sizeM];
  const ironBody = inputs.initialBodies.bodies.find(
    (body) => body.id === ironPlan.bodyId
  );
  const iceBody = inputs.initialBodies.bodies.find(
    (body) => body.id === icePlan.bodyId
  );
  if (!ironBody || !iceBody) {
    throw new Error('iron/ice preset body geometry is incomplete');
  }
  const ironEdgeM = ironSizeM[0];
  const iceEdgeM = iceSizeM[0];
  const ironMassKg = ironPlan.totalMassKg;
  const iceMassKg = icePlan.totalMassKg;
  const h2oCarrierMassKg = inputs.spacing.base.particleMassKg;
  const waterPath = enthalpyPath(inputs.h2o, iceTemperatureK);
  const feLiquid = phase(inputs.fe, 'liquid');
  const iceSolid = phase(inputs.h2o, 'solid');
  const pairConductivityWPerMK = harmonicMeanPositive(
    feLiquid.thermalConductivityWPerMK,
    iceSolid.thermalConductivityWPerMK
  );
  // Pair radiation retains the production rest-volume-equivalent sphere.
  // Cross-material conduction instead consumes receipt-v2 axis-aligned
  // finite-volume face area and two half-cell TPFA resistances.
  const ironCarrierVolumeM3 =
    ironPlan.particleMassKg / feLiquid.densityKgPerM3;
  const iceCarrierVolumeM3 =
    icePlan.particleMassKg / iceSolid.densityKgPerM3;
  const ironRadiusM = sphereRadiusFromVolumeM3(ironCarrierVolumeM3);
  const iceRadiusM = sphereRadiusFromVolumeM3(iceCarrierVolumeM3);
  const ironEmissivity = deriveGrayEmissivityForMaterial('fe', inputs.fe);
  const h2oEmissivity = deriveGrayEmissivityForMaterial('h2o', inputs.h2o);
  const ironCenters = latticeCenters(ironPlan);
  const iceCenters = latticeCenters(icePlan);
  const conductionPowerByIceCarrierW = new Float64Array(iceCenters.length);
  const radiationPowerByIceCarrierW = new Float64Array(iceCenters.length);
  const ironCellEdgeM = Math.cbrt(ironCarrierVolumeM3);
  const iceCellEdgeM = Math.cbrt(iceCarrierVolumeM3);
  const ironHalfCellPathM = 0.5 * ironCellEdgeM;
  const iceHalfCellPathM = 0.5 * iceCellEdgeM;
  const pairRadiusSumM = ironRadiusM + iceRadiusM;
  const radiationSupportM =
    SPH_THERMAL_RADIATION_PAIR_RANGE_RADII * pairRadiusSumM;
  let contactPairCount = 0;
  let radiationPairCount = 0;
  let totalContactFaceAreaM2 = 0;
  let totalRadiativeViewAreaM2 = 0;
  let representativeContact = null;
  let aggregateContactConductanceWPerK = 0;
  let aggregateContactConductionPowerW = 0;
  let aggregatePairRadiationPowerW = 0;
  for (const ironCenter of ironCenters) {
    for (let iceIndex = 0; iceIndex < iceCenters.length; iceIndex += 1) {
      const iceCenter = iceCenters[iceIndex];
      const distanceM = Math.hypot(
        ironCenter[0] - iceCenter[0],
        ironCenter[1] - iceCenter[1],
        ironCenter[2] - iceCenter[2]
      );
      const contact =
        evaluateSchroederSpatialMechanicalInterfaceFaceContact({
          position: ironCenter,
          otherPosition: iceCenter,
          epochPosition: ironCenter,
          otherEpochPosition: iceCenter,
          restVolumeM3: ironCarrierVolumeM3,
          otherRestVolumeM3: iceCarrierVolumeM3
        });
      if (contact.contact && contact.areaM2 > 0) {
        const leftResistanceKPerW =
          ironHalfCellPathM
          / (feLiquid.thermalConductivityWPerMK * contact.areaM2);
        const rightResistanceKPerW =
          iceHalfCellPathM
          / (iceSolid.thermalConductivityWPerMK * contact.areaM2);
        const interfaceResistanceKPerW =
          leftResistanceKPerW + rightResistanceKPerW;
        const conductanceWPerK = 1 / interfaceResistanceKPerW;
        const powerW =
          conductanceWPerK * (ironTemperatureK - iceTemperatureK);
        contactPairCount += 1;
        totalContactFaceAreaM2 += contact.areaM2;
        aggregateContactConductanceWPerK += conductanceWPerK;
        aggregateContactConductionPowerW += powerW;
        conductionPowerByIceCarrierW[iceIndex] += powerW;
        representativeContact ??= {
          distanceM,
          areaM2: contact.areaM2,
          pathLengthM: ironHalfCellPathM + iceHalfCellPathM,
          leftPathLengthM: ironHalfCellPathM,
          rightPathLengthM: iceHalfCellPathM,
          leftResistanceKPerW,
          rightResistanceKPerW,
          interfaceResistanceKPerW,
          conductanceWPerK,
          powerW
        };
      }
      if (distanceM < radiationSupportM) {
        const viewAreaM2 = radiativeViewAreaM2(
          ironRadiusM,
          iceRadiusM,
          distanceM
        );
        const powerW = radiativePowerW({
          emissivityLeft: ironEmissivity,
          emissivityRight: h2oEmissivity,
          areaM2: viewAreaM2,
          leftTemperatureK: ironTemperatureK,
          rightTemperatureK: iceTemperatureK
        });
        radiationPairCount += 1;
        totalRadiativeViewAreaM2 += viewAreaM2;
        aggregatePairRadiationPowerW += powerW;
        radiationPowerByIceCarrierW[iceIndex] += powerW;
      }
    }
  }
  if (!representativeContact) {
    throw new Error('iron/ice preset has no initial production-law contact');
  }
  const contactCenterDistanceM = representativeContact.distanceM;
  const contactAreaPerPairM2 = representativeContact.areaM2;
  const conductionPathLengthM = representativeContact.pathLengthM;
  const ironConductionPathLengthM = representativeContact.leftPathLengthM;
  const iceConductionPathLengthM = representativeContact.rightPathLengthM;
  const ironResistancePerContactKPerW =
    representativeContact.leftResistanceKPerW;
  const iceResistancePerContactKPerW =
    representativeContact.rightResistanceKPerW;
  const interfaceResistancePerContactKPerW =
    representativeContact.interfaceResistanceKPerW;
  const perContactConductanceWPerK = representativeContact.conductanceWPerK;
  const perContactConductionPowerW = representativeContact.powerW;
  const maxRadiationPowerIntoSingleH2oCarrierW = Math.max(
    ...radiationPowerByIceCarrierW
  );
  const maxConductionPowerIntoSingleH2oCarrierW = Math.max(
    ...conductionPowerByIceCarrierW
  );
  const maxInitialPowerIntoSingleH2oCarrierW = Math.max(
    ...iceCenters.map((_, index) => (
      conductionPowerByIceCarrierW[index]
      + radiationPowerByIceCarrierW[index]
    ))
  );
  const ironFacingAreaM2 = ironSizeM[0] * ironSizeM[2];
  const iceFacingAreaM2 = iceSizeM[0] * iceSizeM[2];
  const facingAreaM2 = Math.min(
    ironFacingAreaM2,
    iceFacingAreaM2,
    totalContactFaceAreaM2
  );
  const radiativeViewAreaPerPairM2 = radiativeViewAreaM2(
    ironRadiusM,
    iceRadiusM,
    contactCenterDistanceM
  );
  const perContactRadiationPowerW = radiativePowerW({
    emissivityLeft: ironEmissivity,
    emissivityRight: h2oEmissivity,
    areaM2: radiativeViewAreaPerPairM2,
    leftTemperatureK: ironTemperatureK,
    rightTemperatureK: iceTemperatureK
  });
  const rectangularSurfaceAreaM2 = ([x, y, z]) => (
    2 * (x * y + x * z + y * z)
  );
  const ironAmbientAreaM2 =
    rectangularSurfaceAreaM2(ironSizeM) - facingAreaM2;
  const iceAmbientAreaM2 =
    rectangularSurfaceAreaM2(iceSizeM)
    - iceFacingAreaM2
    - facingAreaM2;
  const openIronAmbientPowerW = radiativePowerW({
    emissivityLeft: ironEmissivity,
    areaM2: ironAmbientAreaM2,
    leftTemperatureK: ambientTemperatureK,
    rightTemperatureK: ironTemperatureK
  });
  const openIceAmbientPowerW = radiativePowerW({
    emissivityLeft: h2oEmissivity,
    areaM2: iceAmbientAreaM2,
    leftTemperatureK: ambientTemperatureK,
    rightTemperatureK: iceTemperatureK
  });
  const ambientRadiationExchangeEnabled =
    inputs.scenario.wallReservoirAuthority?.exchangeEnabled === true;
  const ironAmbientPowerW = ambientRadiationExchangeEnabled
    ? openIronAmbientPowerW
    : 0;
  const iceAmbientPowerW = ambientRadiationExchangeEnabled
    ? openIceAmbientPowerW
    : 0;
  const fixedWallTerms = FACE_IDS.map((faceId) => {
    const temperatureK = inputs.scenario.walls.faces[faceId];
    const directContact = faceId === 'yMin';
    const conductanceWPerK = directContact
      ? iceSolid.thermalConductivityWPerMK
        * iceFacingAreaM2
        / (0.5 * iceSizeM[1])
      : 0;
    return {
      faceId,
      temperatureK,
      directContact,
      conductanceWPerK,
      powerIntoH2oW:
        conductanceWPerK * (temperatureK - iceTemperatureK)
    };
  });
  const fixedWallPowerIntoH2oW =
    fixedWallTerms.reduce((sum, term) => sum + term.powerIntoH2oW, 0);
  const adiabaticWallTerms = fixedWallTerms.map((term) => ({
    ...term,
    conductanceWPerK: 0,
    powerIntoH2oW: 0
  }));
  const wallTerms = inputs.scenario.walls.model === 'adiabatic'
    ? adiabaticWallTerms
    : fixedWallTerms;
  const wallPowerIntoH2oW =
    wallTerms.reduce((sum, term) => sum + term.powerIntoH2oW, 0);
  const aggregateContactInitialPowerW =
    aggregateContactConductionPowerW + aggregatePairRadiationPowerW;
  const fixedBoundaryInitialPowerW =
    aggregateContactInitialPowerW
    + openIceAmbientPowerW
    + fixedWallPowerIntoH2oW;
  const ironSpecificEnergyInitialJPerKg =
    specificInternalEnergyJPerKg(inputs.fe, ironTemperatureK);
  const ironEnergyAvailableAtMeltTemperatureJ =
    ironMassKg * (
      ironSpecificEnergyInitialJPerKg
      - specificInternalEnergyJPerKg(inputs.fe, waterPath.meltingTemperatureK)
    );
  const ironEnergyAvailableAtBoilingTemperatureJ =
    ironMassKg * (
      ironSpecificEnergyInitialJPerKg
      - specificInternalEnergyJPerKg(inputs.fe, waterPath.boilingTemperatureK)
    );
  const demand = {
    perKg: waterPath,
    wholeIce: {
      massKg: iceMassKg,
      fullMeltDemandJ: iceMassKg * waterPath.fullMeltDemandJPerKg,
      firstVaporDemandJ: iceMassKg * waterPath.firstVaporDemandJPerKg,
      fullVaporDemandJ: iceMassKg * waterPath.fullVaporDemandJPerKg
    },
    oneSurfaceCarrier: {
      massKg: h2oCarrierMassKg,
      fullMeltDemandJ: h2oCarrierMassKg * waterPath.fullMeltDemandJPerKg,
      firstVaporDemandJ: h2oCarrierMassKg * waterPath.firstVaporDemandJPerKg,
      fullVaporDemandJ: h2oCarrierMassKg * waterPath.fullVaporDemandJPerKg
    }
  };
  const horizons = {
    wholeIceFullMelt: initialRateHorizon({
      demandJ: demand.wholeIce.fullMeltDemandJ,
      initialPowerW: aggregateContactInitialPowerW,
      availableEnergyJ: ironEnergyAvailableAtMeltTemperatureJ
    }),
    wholeIceFirstVapor: initialRateHorizon({
      demandJ: demand.wholeIce.firstVaporDemandJ,
      initialPowerW: aggregateContactInitialPowerW,
      availableEnergyJ: ironEnergyAvailableAtBoilingTemperatureJ
    }),
    oneSurfaceCarrierFullMelt: initialRateHorizon({
      demandJ: demand.oneSurfaceCarrier.fullMeltDemandJ,
      initialPowerW: maxInitialPowerIntoSingleH2oCarrierW,
      availableEnergyJ: ironEnergyAvailableAtMeltTemperatureJ
    }),
    oneSurfaceCarrierFirstVapor: initialRateHorizon({
      demandJ: demand.oneSurfaceCarrier.firstVaporDemandJ,
      initialPowerW: maxInitialPowerIntoSingleH2oCarrierW,
      availableEnergyJ: ironEnergyAvailableAtBoilingTemperatureJ
    }),
    oneSurfaceCarrierFullVapor: initialRateHorizon({
      demandJ: demand.oneSurfaceCarrier.fullVaporDemandJ,
      initialPowerW: maxInitialPowerIntoSingleH2oCarrierW,
      availableEnergyJ: ironEnergyAvailableAtBoilingTemperatureJ
    })
  };
  const targetHorizonInitialRateEnergyJ =
    maxInitialPowerIntoSingleH2oCarrierW * targetVisualHorizonS;
  const linearRefinementFactor =
    icePlan.particlesPerEdge[0] / 5;

  return {
    schema: ULG_SPH_IRON_ICE_ENERGY_BUDGET_ORACLE_SCHEMA,
    status: 'iron-ice-energy-budget-attributed',
    preset: {
      id: inputs.preset.id,
      minimumRequestedVisualHorizonS:
        inputs.preset.validation.minVisualFrameTimeSpanS,
      controls: { ...inputs.preset.controls },
      runtime: { ...inputs.preset.runtime }
    },
    geometry: {
      boxDimensionsM: [...inputs.scenario.box.dimensionsM],
      ironSizeM,
      iceSizeM,
      ironCenterM: [...ironBody.centerM],
      iceCenterM: [...iceBody.centerM],
      ironEdgeM,
      iceEdgeM,
      ironMassKg,
      iceMassKg,
      ironParticlesPerEdge: [...ironPlan.particlesPerEdge],
      iceParticlesPerEdge: [...icePlan.particlesPerEdge],
      ironParticleRadiusM: ironRadiusM,
      iceParticleRadiusM: iceRadiusM,
      ironFiniteVolumeCellEdgeM: ironCellEdgeM,
      iceFiniteVolumeCellEdgeM: iceCellEdgeM,
      h2oCarrierMassKg,
      conductionGeometryAuthority:
        'mechanical-interface-receipt-v2-axis-aligned-finite-volume-face',
      radiationRadiusAuthority:
        'production-rest-volume-equivalent-sphere'
    },
    materialClosures: {
      authority: 'runtime-reference-bank-anchored-material-closures',
      feReferenceBank: inputs.fe.referenceBankAnchoring,
      h2oReferenceBank: inputs.h2o.referenceBankAnchoring,
      ironLiquidConductivityWPerMK: feLiquid.thermalConductivityWPerMK,
      iceConductivityWPerMK: iceSolid.thermalConductivityWPerMK,
      h2oMeltingTemperatureK: waterPath.meltingTemperatureK,
      h2oBoilingTemperatureK: waterPath.boilingTemperatureK,
      pairConductivityWPerMK,
      ironEmissivity,
      h2oEmissivity,
      scientificValidation: false,
      note:
        'Phase transport and enthalpy values are runtime closure values with explicit reference-fallback provenance.'
    },
    initialState: {
      ironTemperatureK,
      iceTemperatureK,
      ambientTemperatureK,
      wallModel: inputs.scenario.walls.model,
      wallTemperaturesK: { ...inputs.scenario.walls.faces }
    },
    energyAvailability: {
      ironEnergyAvailableAtMeltTemperatureJ,
      ironEnergyAvailableAtBoilingTemperatureJ
    },
    enthalpyDemand: demand,
    initialPowerLedger: {
      model:
        'exact-discrete-initial-pair-rate-at-initial-temperatures',
      feToH2oContactConduction: {
        contactPairCount,
        contactCenterDistanceM,
        contactAreaPerPairM2,
        totalContactFaceAreaM2,
        conductionPathLengthM,
        ironConductionPathLengthM,
        iceConductionPathLengthM,
        ironResistancePerContactKPerW,
        iceResistancePerContactKPerW,
        interfaceResistancePerContactKPerW,
        perContactConductanceWPerK,
        perContactPowerIntoH2oW: perContactConductionPowerW,
        aggregateContactConductanceWPerK,
        aggregatePowerIntoH2oW: aggregateContactConductionPowerW
      },
      feToH2oPairRadiation: {
        radiationPairCount,
        radiationSupportM,
        perContactViewAreaM2: radiativeViewAreaPerPairM2,
        perContactPowerIntoH2oW: perContactRadiationPowerW,
        totalRadiativeViewAreaM2,
        maxPowerIntoSingleH2oCarrierW:
          maxRadiationPowerIntoSingleH2oCarrierW,
        aggregatePowerIntoH2oW: aggregatePairRadiationPowerW
      },
      ambientRadiation: {
        exchangeEnabled: ambientRadiationExchangeEnabled,
        authority: 'wall-reservoir-authority.exchangeEnabled',
        ironExposedAreaM2: ironAmbientAreaM2,
        h2oExposedAreaM2: iceAmbientAreaM2,
        powerIntoIronW: ironAmbientPowerW,
        powerIntoH2oW: iceAmbientPowerW,
        totalPowerIntoBodiesW: ironAmbientPowerW + iceAmbientPowerW
      },
      openBoundaryAmbientRadiation: {
        model: 'infinite-ambient-gray-body-reservoir',
        ironExposedAreaM2: ironAmbientAreaM2,
        h2oExposedAreaM2: iceAmbientAreaM2,
        powerIntoIronW: openIronAmbientPowerW,
        powerIntoH2oW: openIceAmbientPowerW,
        totalPowerIntoBodiesW:
          openIronAmbientPowerW + openIceAmbientPowerW
      },
      walls: {
        model: inputs.scenario.walls.model,
        terms: wallTerms,
        totalPowerIntoH2oW: wallPowerIntoH2oW
      },
      fixedReservoirWalls: {
        model: 'infinite-fixed-temperature-reservoir',
        terms: fixedWallTerms,
        totalPowerIntoH2oW: fixedWallPowerIntoH2oW
      },
      adiabaticWalls: {
        model: 'adiabatic',
        terms: adiabaticWallTerms,
        totalPowerIntoH2oW: 0
      },
      maxConductionPowerIntoSingleH2oCarrierW,
      maxInitialPowerIntoSingleH2oCarrierW,
      aggregateContactInitialPowerW,
      fixedBoundaryInitialPowerW
    },
    minimumHorizons: horizons,
    targetHorizonVerdict: {
      horizonS: targetVisualHorizonS,
      initialRateEnergyJ:
        targetHorizonInitialRateEnergyJ,
      oneCarrierMeltDemandJ: demand.oneSurfaceCarrier.fullMeltDemandJ,
      oneCarrierFirstVaporDemandJ: demand.oneSurfaceCarrier.firstVaporDemandJ,
      oneCarrierFullVaporDemandJ: demand.oneSurfaceCarrier.fullVaporDemandJ,
      initialRateBelowMeltDemand:
        targetHorizonInitialRateEnergyJ
          < demand.oneSurfaceCarrier.fullMeltDemandJ,
      initialRateBelowFirstVaporDemand:
        targetHorizonInitialRateEnergyJ
          < demand.oneSurfaceCarrier.firstVaporDemandJ,
      initialRateBelowFullVaporDemand:
        targetHorizonInitialRateEnergyJ
          < demand.oneSurfaceCarrier.fullVaporDemandJ,
      status:
        targetHorizonInitialRateEnergyJ
          >= demand.oneSurfaceCarrier.firstVaporDemandJ
          ? 'initial-rate-admits-target-first-vapor'
          : 'initial-rate-below-target-first-vapor-demand',
      interpretation:
        'This exact initial-state rate is a screening estimate, not a global transfer bound: deformation can add or remove contacts. Meeting demand admits a resolved run but does not prove phase change; missing it does not prove infeasibility.'
    },
    candidates: {
      spatialRefinement: {
        status: Math.abs(linearRefinementFactor - 2) <= 1e-12
          ? 'exact-two-x-refinement-applied'
          : 'noncanonical-refinement',
        linearRefinementFactor,
        physicalGeometryUnchanged: true,
        referenceBaseParticlesPerEdge: 5,
        resolvedBaseParticlesPerEdge: icePlan.particlesPerEdge[0],
        resolvedDropParticlesPerEdge: ironPlan.particlesPerEdge[0],
        carrierPitchM: icePlan.spacingM,
        designTarget: 'one-h2o-surface-carrier-first-vapor-admission',
        optimisticMinimumHorizonS:
          horizons.oneSurfaceCarrierFirstVapor.minimumHorizonS,
        note:
          'This is an infeasibility screen and spatial-resolution choice, not a prediction of resolved contact duration.'
      }
    },
    assumptions: [
      'Initial conduction enumerates every Fe/H2O finite-volume face contact in the undeformed lattice and uses receipt-v2 face area with two half-cell TPFA resistances.',
      'Initial radiation enumerates every Fe/H2O pair inside the production four-pair-radii support and sums power by H2O carrier.',
      'The yMin fixed wall conducts through half the ice thickness; the other five bodies do not touch a wall.',
      'Initial powers are exact for the undeformed initial lattice, not upper bounds over a moving run.',
      'Adiabatic-wall proof sets every wall term to zero and retains only Fe-to-H2O pair transfer.',
      'No resolved deformation, convection, boiling-film resistance, or vapor shielding is modeled.'
    ],
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}
