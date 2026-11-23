import {
  SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS
} from '../../ulg-gpu-abi/src/index.js';
import {
  SPH_PHASE_SCENARIO_PRESETS,
  sphPhaseScenarioPresetById
} from '../runtime/sphPhaseScenarioPresets.js';
import {
  SPH_ENVIRONMENT_CONTROL_DEFAULTS
} from '../runtime/sphEnvironmentControls.js';
import {
  containerBoundsForFrame,
  findOverlappingSphInitialBodies,
  floorCenteredToInternalCenterM,
  internalToFloorCenteredCenterM,
  normalizeSphInitialBodies,
  parseSphInitialBodies,
  preflightSphInitialBodiesForSimulation,
  serializeSphInitialBodies,
  sphInitialBodiesFromLegacyPhaseControls,
  validateSphInitialBodiesInContainer
} from '../runtime/sphInitialBodies.js';
import {
  SPH_SCENE_BACKGROUND_COLOR_DEFAULT,
  SPH_SCENE_LIGHTING_MODE_DEFAULT,
  normalizeSphSceneBackgroundColorHex,
  normalizeSphSceneLightingMode
} from './sphPhaseScene.js';
import {
  SPH_BUNDLED_BACKGROUND_IMAGES,
  SPH_DEFAULT_BACKGROUND_IMAGE_URL,
  normalizeSphBackgroundImageUrl
} from './sphPhaseDemoMount.js';

export {
  SPH_BUNDLED_BACKGROUND_IMAGES,
  SPH_DEFAULT_BACKGROUND_IMAGE_URL,
  normalizeSphBackgroundImageUrl
};

const DEFAULT_CUSTOM_CAMERA = Object.freeze({
  cameraPositionNormalized: '0.78,0.46,1.55',
  cameraTargetNormalized: '0.50,0.34,0.50'
});

const SIMULATION_URL_PARAM_KEYS = Object.freeze([
  'preset',
  'scenario',
  'basePreset',
  'box',
  'bodies',
  'wallModel',
  'walls',
  'env',
  'laws'
]);

const VALID_WALL_MODELS = new Set([
  'adiabatic',
  'finite-heat-capacity-lumped-face',
  'infinite-fixed-temperature-reservoir'
]);

export function roundNice(value, sig = 6) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const cleaned = Number(num.toPrecision(sig));
  return Object.is(cleaned, -0) ? 0 : cleaned;
}

export function fmtMeters(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) < 1e-12) return '0';
  return String(roundNice(n, 4));
}

export function fmtTempC(kelvin) {
  const c = Number(kelvin) - 273.15;
  if (!Number.isFinite(c)) return '';
  return `${c >= 0 ? '+' : ''}${c.toFixed(1)} °C`;
}

export function normalizeAirHierarchyLevels(levels, twoLevelFallback = false) {
  const num = Number(levels);
  if (Number.isFinite(num)) {
    const rounded = Math.round(num);
    if (rounded >= 2 && rounded <= SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS) {
      return rounded;
    }
    if (rounded > SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS) {
      return SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS;
    }
    if (rounded === 1 && !twoLevelFallback) {
      return 1;
    }
  }
  return twoLevelFallback ? 2 : 1;
}

export function totalParticlesOf(bodies) {
  return (bodies || []).reduce(
    (sum, body) => sum + body.particlesPerEdge.reduce((p, n) => p * n, 1),
    0
  );
}

/**
 * Derive a clean, floor-centered staged configuration directly from a preset
 * record without spawning any runtime state.
 */
export function buildStagedConfigFromPreset(presetId) {
  const preset = sphPhaseScenarioPresetById(presetId) || SPH_PHASE_SCENARIO_PRESETS[0];
  const controls = preset.controls;
  const runtime = preset.runtime || {};
  const scale = Number(runtime.sceneLengthScale) > 0 ? Number(runtime.sceneLengthScale) : 1;
  const refBox = [
    Number(controls.boxx) || 2.5,
    Number(controls.boxy) || 2.5,
    Number(controls.boxz) || 2.5
  ];
  const boxDimensionsM = refBox.map((d) => roundNice(d * scale, 6));

  let internalBodies;
  if (runtime.bodies) {
    internalBodies = parseSphInitialBodies(runtime.bodies).bodies;
  } else {
    internalBodies = sphInitialBodiesFromLegacyPhaseControls({
      baseMaterial: controls.base,
      dropMaterial: controls.drop,
      baseTemperatureK: Number(controls.baset),
      dropTemperatureK: Number(controls.dropt),
      baseParticlesPerEdge: Number(controls.basen),
      dropParticlesPerEdge: Number(controls.dropn),
      referenceBaseEdgeM: 1,
      referenceBaseParticlesPerEdge: 5,
      sceneLengthScale: scale,
      referenceBoxDimensionsM: refBox,
      referenceBaseBottomM: Number(controls.iceh ?? 0),
      referenceDropBottomM: Number(controls.ironh ?? 0.62)
    }).bodies;
  }

  const floorCenteredBodies = internalBodies.map((body) => ({
    ...body,
    centerM: Array.from(internalToFloorCenteredCenterM(body.centerM, boxDimensionsM)).map((v) => roundNice(v, 6)),
    sizeM: Array.from(body.sizeM).map((v) => roundNice(v, 6)),
    particlesPerEdge: [...body.particlesPerEdge],
    velocityMPerS: [...body.velocityMPerS]
  }));

  const isTier0Water = preset.id === 'water-realtime';
  const runtimeOverlay = { ...runtime };
  delete runtimeOverlay.surfaceDraw;
  delete runtimeOverlay.bodies;
  return {
    presetId: preset.id,
    basePresetId: preset.id,
    customTemplateId: null,
    sceneLengthScale: scale,
    boxDimensionsM,
    wallModel: runtime.wallModel || 'finite-heat-capacity-lumped-face',
    walls: {
      xMin: Number(controls.wxmin ?? 293.15),
      xMax: Number(controls.wxmax ?? 293.15),
      yMin: Number(controls.wymin ?? 293.15),
      yMax: Number(controls.wymax ?? 293.15),
      zMin: Number(controls.wzmin ?? 293.15),
      zMax: Number(controls.wzmax ?? 293.15)
    },
    environment: {
      mode: controls.environmentMode || SPH_ENVIRONMENT_CONTROL_DEFAULTS.environmentMode,
      temperatureK: Number(controls.environmentTemperatureK ?? 293.15),
      pressurePa: Number(controls.environmentPressurePa ?? 101325),
      humidityPercent: Number(controls.environmentHumidityPercent ?? 50),
      nucleiPerCm3: Number(controls.environmentNucleiPerCm3 ?? 0),
      twoLevelAir: runtime.schroederTwoLevel === '1'
        && (controls.environmentMode || SPH_ENVIRONMENT_CONTROL_DEFAULTS.environmentMode) === 'air',
      airHierarchyLevels: (controls.environmentMode || SPH_ENVIRONMENT_CONTROL_DEFAULTS.environmentMode) === 'air'
        ? (runtime.schroederLevelChain === '1'
            ? normalizeAirHierarchyLevels(
                Number(runtime.schroederMaxLevel ?? 2) - Number(runtime.schroederMinLevel ?? 0) + 1,
                false
              )
            : (runtime.schroederTwoLevel === '1' ? 2 : 1))
        : 1
    },
    laws: {
      gravity: controls.lawg !== '0',
      thermal: controls.lawt !== '0',
      reactions: controls.lawr !== '0',
      viscosity: controls.lawv !== '0',
      surfaceTension: controls.lawst === '1',
      rigidSolids: runtime.rigidSolids !== '0',
      cohesiveFracture: runtime.solidFracture !== '0',
      multilevelSolids: runtime.solidMultilevel !== '0'
    },
    bodies: floorCenteredBodies,
    display: {
      lightingMode: SPH_SCENE_LIGHTING_MODE_DEFAULT,
      backgroundColor: SPH_SCENE_BACKGROUND_COLOR_DEFAULT,
      backgroundImageUrl: SPH_DEFAULT_BACKGROUND_IMAGE_URL,
      blobScale: Number(controls.blob ?? 1)
    },
    network: {
      peerRelayUrl: '',
      peerRoomId: ''
    },
    solverProfile: isTier0Water
      ? 'tier0-realtime'
      : preset.id === 'cesium-fluorine'
        ? 'two-level-energetic'
        : 'canonical-ss',
    presetRuntimeOverlay: runtimeOverlay
  };
}

export function buildBlankCustomConfig() {
  const boxDimensionsM = [2, 2, 2];
  return {
    presetId: 'custom',
    basePresetId: null,
    customTemplateId: null,
    sceneLengthScale: 1,
    boxDimensionsM,
    wallModel: 'finite-heat-capacity-lumped-face',
    walls: {
      xMin: 293.15, xMax: 293.15,
      yMin: 293.15, yMax: 293.15,
      zMin: 293.15, zMax: 293.15
    },
    environment: {
      mode: 'vacuum',
      temperatureK: 293.15,
      pressurePa: 101325,
      humidityPercent: 50,
      nucleiPerCm3: 0,
      twoLevelAir: false,
      airHierarchyLevels: 1
    },
    laws: {
      gravity: true,
      thermal: true,
      reactions: true,
      viscosity: true,
      surfaceTension: false,
      rigidSolids: true,
      cohesiveFracture: true,
      multilevelSolids: true
    },
    bodies: [
      {
        id: 'body-1',
        domainId: 1,
        material: 'h2o',
        sizeM: [0.6, 0.6, 0.6],
        centerM: [0, 0.3, 0],
        temperatureK: 293.15,
        particlesPerEdge: [3, 3, 3],
        velocityMPerS: [0, 0, 0]
      }
    ],
    display: {
      lightingMode: SPH_SCENE_LIGHTING_MODE_DEFAULT,
      backgroundColor: SPH_SCENE_BACKGROUND_COLOR_DEFAULT,
      backgroundImageUrl: SPH_DEFAULT_BACKGROUND_IMAGE_URL,
      blobScale: 1
    },
    network: {
      peerRelayUrl: '',
      peerRoomId: ''
    },
    solverProfile: 'canonical-ss',
    presetRuntimeOverlay: { ...DEFAULT_CUSTOM_CAMERA }
  };
}

export const STUDIO_CUSTOM_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'mercury-water-drop',
    label: 'Liquid Mercury in Water',
    summary: 'Relativistic 6s² contraction makes Hg (Z=80) a dense room-temperature liquid metal with derived spin-orbit metallic reflectance splashing into liquid water.',
    chips: Object.freeze(['Hg + H2O', 'Relativistic PBE+SO', 'Liquid Metal @ 293 K'])
  }),
  Object.freeze({
    id: 'cherenkov-pool',
    label: 'Cherenkov Pool (Co-60 in Water)',
    summary: 'Phase 8 nucleon-conserving Co-60 → Ni-60 isotope decay thermal deposition with Frank–Tamm Cherenkov blue emission gated strictly on β > 1/n (scientificValidation=false).',
    chips: Object.freeze(['Co-60 + H2O', 'Frank–Tamm β>1/n', 'Phase 8 ABI'])
  })
]);

export function buildStagedConfigFromCustomTemplate(templateId) {
  const base = buildBlankCustomConfig();
  if (templateId === 'mercury-water-drop') {
    base.customTemplateId = templateId;
    base.laws.reactions = false;
    base.bodies = [
      {
        id: 'water-pool',
        domainId: 1,
        material: 'h2o',
        sizeM: [0.8, 0.8, 0.8],
        centerM: [0, 0.4, 0],
        temperatureK: 293.15,
        particlesPerEdge: [4, 4, 4],
        velocityMPerS: [0, 0, 0]
      },
      {
        id: 'mercury-drop',
        domainId: 2,
        material: 'Hg',
        sizeM: [0.4, 0.4, 0.4],
        centerM: [0, 1.12, 0],
        temperatureK: 293.15,
        particlesPerEdge: [3, 3, 3],
        velocityMPerS: [0, 0, 0]
      }
    ];
    return base;
  }
  if (templateId === 'cherenkov-pool') {
    base.customTemplateId = templateId;
    base.laws.reactions = false;
    base.bodies = [
      {
        id: 'moderator-water',
        domainId: 1,
        material: 'h2o',
        sizeM: [0.8, 0.8, 0.8],
        centerM: [0, 0.4, 0],
        temperatureK: 293.15,
        particlesPerEdge: [4, 4, 4],
        velocityMPerS: [0, 0, 0]
      },
      {
        id: 'cobalt-60-source',
        domainId: 2,
        material: 'Co',
        isotope: 'Co-60',
        sizeM: [0.4, 0.4, 0.4],
        centerM: [0, 1.12, 0],
        temperatureK: 293.15,
        particlesPerEdge: [3, 3, 3],
        velocityMPerS: [0, 0, 0]
      }
    ];
    return base;
  }
  return base;
}

/**
 * Validate a staged configuration in floor-centered coordinates.
 * Guarantees every body's bounding box lies completely inside the container
 * and no two bodies overlap.
 */
export function validateStagedSimulationConfig(config) {
  const errors = [];
  const bodyErrors = new Map();
  const appendBodyError = (id, msg) => {
    bodyErrors.set(id, bodyErrors.has(id) ? `${bodyErrors.get(id)} ${msg}` : msg);
  };
  const box = config?.boxDimensionsM;
  if (!Array.isArray(box) || box.length !== 3 || box.some((v) => !(Number(v) > 0) || !Number.isFinite(Number(v)))) {
    errors.push('Container dimensions X, Y, and Z must be positive numbers.');
    return { valid: false, errors, bodyErrors, overlaps: [], normalizedBodies: null, preflight: null };
  }
  const bodies = Array.isArray(config?.bodies) ? config.bodies : [];
  if (bodies.length === 0) {
    errors.push('Add at least one material body before launching.');
    return { valid: false, errors, bodyErrors, overlaps: [], normalizedBodies: null, preflight: null };
  }

  let normalizedBodies;
  try {
    normalizedBodies = normalizeSphInitialBodies(bodies);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { valid: false, errors, bodyErrors, overlaps: [], normalizedBodies: null, preflight: null };
  }

  const bounds = containerBoundsForFrame(box, 'floor-centered');
  const tol = Math.max(1e-9, Math.max(...box) * 1e-9);
  const axisNames = ['X', 'Y', 'Z'];
  let hasOutOfBounds = false;
  for (const body of normalizedBodies.bodies) {
    for (let axis = 0; axis < 3; axis += 1) {
      const minM = body.centerM[axis] - body.sizeM[axis] / 2;
      const maxM = body.centerM[axis] + body.sizeM[axis] / 2;
      if (minM < bounds.minM[axis] - tol || maxM > bounds.maxM[axis] + tol) {
        hasOutOfBounds = true;
        appendBodyError(
          body.id,
          `${axisNames[axis]} bounds [${fmtMeters(minM)}, ${fmtMeters(maxM)}] m fall outside container [${fmtMeters(bounds.minM[axis])}, ${fmtMeters(bounds.maxM[axis])}] m.`
        );
      }
    }
  }
  if (hasOutOfBounds) {
    errors.push('One or more bodies start or extend outside the container bounds.');
  } else {
    try {
      validateSphInitialBodiesInContainer(normalizedBodies, box, { coordinateFrame: 'floor-centered' });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const overlaps = findOverlappingSphInitialBodies(normalizedBodies);
  if (overlaps.length > 0) {
    const pairLabels = overlaps.map(({ bodyA, bodyB }) => `${bodyA.id} & ${bodyB.id}`);
    errors.push(`Bodies cannot overlap (${pairLabels.join(', ')}).`);
    for (const { bodyA, bodyB } of overlaps) {
      appendBodyError(bodyA.id, `Overlaps with body '${bodyB.id}'.`);
      appendBodyError(bodyB.id, `Overlaps with body '${bodyA.id}'.`);
    }
  }

  const preflight = preflightSphInitialBodiesForSimulation(normalizedBodies, {
    boxDimensionsM: box,
    coordinateFrame: 'floor-centered'
  });
  if (!preflight.feasible) {
    for (const blocker of preflight.blockers) {
      if (blocker.startsWith('body-outside-container:')) continue;
      if (blocker.startsWith('body-cell-pitch-anisotropy:')) {
        const id = blocker.split(':')[1];
        const msg = 'Particle spacing must remain nearly isotropic across X, Y, and Z.';
        appendBodyError(id, msg);
        errors.push(`${id}: ${msg}`);
      } else if (blocker === 'cross-body-cell-pitch-ratio-exceeded') {
        errors.push('Particle pitch across bodies differs by more than 2×. Align particle counts or sizes.');
      } else {
        errors.push(`Preflight blocked: ${blocker}`);
      }
    }
  }

  return {
    valid: errors.length === 0 && bodyErrors.size === 0,
    errors,
    bodyErrors,
    overlaps,
    normalizedBodies,
    preflight
  };
}

/**
 * Compile a validated staged configuration into the exact in-memory parameter
 * map consumed by the GPU simulation session.
 * Never sets `surfaceDraw` so custom/edited scenarios never misclassify as a
 * main-thread diagnostic override that hides the worker OffscreenCanvas.
 */
export function buildLaunchParamsFromStagedConfig(config) {
  const validation = validateStagedSimulationConfig(config);
  if (!validation.valid) {
    throw new RangeError(validation.errors[0] || 'Staged configuration is invalid.');
  }
  const scale = Number(config.sceneLengthScale) > 0 ? Number(config.sceneLengthScale) : 1;
  const boxM = config.boxDimensionsM.map(Number);
  const internalBodies = validation.normalizedBodies.bodies.map((body) => ({
    ...body,
    centerM: Array.from(floorCenteredToInternalCenterM(body.centerM, boxM))
  }));
  const exactPreset = sphPhaseScenarioPresetById(config.presetId);
  const inheritedPreset = exactPreset || sphPhaseScenarioPresetById(config.basePresetId);
  const defaultCanonicalRuntime = {
    renderer: 'native-webgpu',
    surfaceOverlay: '0',
    renderOwnership: 'worker-owned-resident-render-producer',
    workerOffscreenPresentation: '1',
    workerParticleOverlay: '0',
    workerLivePreview: '0',
    residentWorkers: '1',
    residentComputeManagerMode: 'worker-owned-resident-lane',
    residentStepsPerSchedule: '16',
    submitBurstSteps: '4',
    thermalPotential: '1',
    contactSolver: '1',
    contactCleanupPasses: '16',
    contactInnerRounds: '1',
    ss: '1',
    schroederLevel: '0',
    schroederMinLevel: '0',
    schroederMaxLevel: '0',
    schroederPortableSummary: '1',
    schroederActiveNodeIndex: '1',
    schroederActiveNodeSortedIndex: '1',
    schroederLawQueue: '1',
    schroederLawNeighborCandidates: '1',
    schroederCrossLevelCoupling: '0',
    schroederPhaseVolumeMigration: '1',
    schroederTwoLevel: '0',
    schroederMechanicsFieldPairV2: '0',
    ...DEFAULT_CUSTOM_CAMERA
  };
  const baseRuntime = inheritedPreset
    ? { ...defaultCanonicalRuntime, ...inheritedPreset.runtime }
    : defaultCanonicalRuntime;
  const overlayRuntime = { ...(config.presetRuntimeOverlay || {}) };
  delete baseRuntime.surfaceDraw;
  delete baseRuntime.bodies;
  delete overlayRuntime.surfaceDraw;
  delete overlayRuntime.bodies;

  // If thermal or reaction laws are turned on (e.g., on an edited Tier-0
  // preset), make sure canonical law queues and phase-volume migration are active.
  const activeThermalOrReactions = Boolean(config.laws?.thermal || config.laws?.reactions);
  const dynamicLawGuard = activeThermalOrReactions
    ? {
        schroederLawQueue: '1',
        schroederLawNeighborCandidates: '1',
        schroederPhaseVolumeMigration: '1',
        schroederActiveNodeSortedIndex: '1',
        contactSolver: '1'
      }
    : {};

  const firstBody = internalBodies[0];
  const secondBody = internalBodies[1] || firstBody;
  const isAirEnvironment = config.environment.mode === 'air';
  const airHierarchyLevels = isAirEnvironment
    ? normalizeAirHierarchyLevels(
        config.environment.airHierarchyLevels,
        config.environment.twoLevelAir === true
      )
    : 1;
  const twoLevelAirEnabled = isAirEnvironment && airHierarchyLevels === 2;
  const multiLevelChainAirEnabled = isAirEnvironment && airHierarchyLevels >= 3;
  const cubicBox = Math.abs(boxM[1] - boxM[0]) <= 1e-6 * boxM[0]
    && Math.abs(boxM[2] - boxM[0]) <= 1e-6 * boxM[0];
  const effectiveWallModel = config.wallModel || 'finite-heat-capacity-lumped-face';
  // Single-level air on finite-capacity walls and 2-level coupled air do not
  // carry multilevel finite-wall rollback state or G2 energy-ledger history on
  // the exact integer energy ledger; only enable the exact ledger (and its
  // default dry-nuclei seeding) automatically on 3+ level chains or single-level
  // air with non-finite-capacity walls.
  const useExactEnergyLedger = Boolean(
    multiLevelChainAirEnabled
    || (
      isAirEnvironment
      && !twoLevelAirEnabled
      && cubicBox
      && effectiveWallModel !== 'finite-heat-capacity-lumped-face'
    )
  );
  const configuredNuclei = Number(config.environment.nucleiPerCm3 ?? 0);
  const effectiveNucleiPerCm3 = configuredNuclei > 0
    ? configuredNuclei
    : (useExactEnergyLedger && isAirEnvironment && cubicBox ? 5000 : 0);
  let twoLevelAirRuntime = {};
  if (twoLevelAirEnabled || multiLevelChainAirEnabled) {
    // First-Class Air multi-level SS enrollment (2-level coupled OR 3..16-level
    // 2:1 Schroeder chain). Coarse levels host ambient air parcels while L0
    // resolves condensed bodies and interfaces; sphPhaseDemoMount retires the
    // single-level implicit atmosphere stand-in whenever maxLevel > minLevel.
    const bodyPitches = internalBodies.map((body) => (
      Math.cbrt(
        (body.sizeM[0] / body.particlesPerEdge[0])
        * (body.sizeM[1] / body.particlesPerEdge[1])
        * (body.sizeM[2] / body.particlesPerEdge[2])
      )
    )).filter((p) => Number.isFinite(p) && p > 0);
    const finePitchM = bodyPitches.length > 0 ? Math.min(...bodyPitches) : Math.min(...boxM) / 10;
    const fineSupportRadiusM = Math.cbrt((3 * (finePitchM ** 3)) / (4 * Math.PI));
    const twoLevelBaseDxM = Math.max(fineSupportRadiusM / 1.5, Math.max(...boxM) / 36);
    const maxSceneTempK = Math.max(
      Number(config.environment.temperatureK) || 293.15,
      ...internalBodies.map((body) => Number(body.temperatureK) || 293.15)
    );
    const airAcousticSpeedMPerS = Math.max(350, Math.sqrt(1.4 * 287.05 * maxSceneTempK));
    const twoLevelAcousticDtS = roundNice(
      Math.min(0.0002, Math.max(1e-6, (0.4 * twoLevelBaseDxM) / airAcousticSpeedMPerS)),
      4
    );
    if (multiLevelChainAirEnabled) {
      twoLevelAirRuntime = {
        schroederMinLevel: '0',
        schroederMaxLevel: String(airHierarchyLevels - 1),
        schroederLevelChain: '1',
        schroederTwoLevel: '0',
        schroederCrossLevelCoupling: '0',
        schroederMechanicsFieldPairV2: '0',
        schroederBaseGridSpacingM: String(twoLevelBaseDxM),
        sdt: String(twoLevelAcousticDtS),
        cfl: '0.8',
        cflSafety: '0.2',
        residentStepsPerSchedule: '4',
        submitBurstSteps: '4',
        environmentAirParcels: 'mixture',
        exactEnergyLedger: '1',
        splitSpareLineages: String(Math.min(256, Math.max(64, totalParticlesOf(internalBodies)))),
        ...(config.laws?.reactions === true
          && baseRuntime.reactionProductReserveExactDiscovery !== '1'
          && baseRuntime.reactionProductReserveMinimumLiveFraction == null
          ? { reactionProductReserveMinimumLiveFraction: '1' }
          : {})
      };
    } else {
      twoLevelAirRuntime = {
        schroederMinLevel: '0',
        schroederMaxLevel: '1',
        schroederTwoLevel: '1',
        schroederTwoLevelAuthority: 'authoritative',
        schroederTwoLevelSubsteps: '2',
        schroederCrossLevelCoupling: '0',
        schroederMechanicsFieldPairV2: '1',
        schroederBaseGridSpacingM: String(twoLevelBaseDxM),
        sdt: String(twoLevelAcousticDtS),
        cfl: '0.8',
        cflSafety: '0.2',
        residentStepsPerSchedule: '4',
        environmentAirParcels: 'mixture',
        splitSpareLineages: String(Math.min(256, Math.max(64, totalParticlesOf(internalBodies))))
      };
    }
  }
  const compiled = {
    ...SPH_ENVIRONMENT_CONTROL_DEFAULTS,
    ...baseRuntime,
    ...overlayRuntime,
    ...dynamicLawGuard,
    ...twoLevelAirRuntime,
    // Always enforce unified worker-owned GPU marching-cubes isosurface rendering
    renderer: 'native-webgpu',
    surfaceOverlay: '0',
    workerOffscreenPresentation: '1',
    workerParticleOverlay: '0',
    workerLivePreview: '0',
    mech: 'mlsmpm',
    residentAuto: '1',
    ...(useExactEnergyLedger ? { exactEnergyLedger: '1' } : {}),
    scenario: exactPreset ? exactPreset.id : 'custom',
    sceneLengthScale: String(scale),
    wallModel: effectiveWallModel,
    boxx: String(boxM[0] / scale),
    boxy: String(boxM[1] / scale),
    boxz: String(boxM[2] / scale),
    wxmin: String(config.walls.xMin),
    wxmax: String(config.walls.xMax),
    wymin: String(config.walls.yMin),
    wymax: String(config.walls.yMax),
    wzmin: String(config.walls.zMin),
    wzmax: String(config.walls.zMax),
    environmentMode: config.environment.mode,
    environmentTemperatureK: String(config.environment.temperatureK),
    environmentPressurePa: String(config.environment.pressurePa),
    environmentHumidityPercent: String(config.environment.humidityPercent),
    environmentNucleiPerCm3: String(effectiveNucleiPerCm3),
    lawmech: '1',
    lawg: config.laws.gravity ? '1' : '0',
    laweos: '1',
    lawp: config.laws.thermal ? '1' : '0',
    lawt: config.laws.thermal ? '1' : '0',
    lawr: config.laws.reactions ? '1' : '0',
    lawv: config.laws.viscosity ? '1' : '0',
    lawst: config.laws.surfaceTension ? '1' : '0',
    rigidSolids: config.laws.rigidSolids ? '1' : '0',
    solidFracture: config.laws.cohesiveFracture !== false ? '1' : '0',
    solidMultilevel: config.laws.multilevelSolids !== false ? '1' : '0',
    base: firstBody.material,
    drop: secondBody.material,
    baset: String(firstBody.temperatureK),
    dropt: String(secondBody.temperatureK),
    basen: String(firstBody.particlesPerEdge[0]),
    dropn: String(secondBody.particlesPerEdge[0]),
    bodies: serializeSphInitialBodies(internalBodies),
    lighting: normalizeSphSceneLightingMode(config.display.lightingMode),
    bg: normalizeSphSceneBackgroundColorHex(config.display.backgroundColor),
    bgimg: normalizeSphBackgroundImageUrl(
      config.display.backgroundImageUrl,
      SPH_DEFAULT_BACKGROUND_IMAGE_URL
    ) || 'none',
    blob: String(config.display.blobScale || 1),
    ...(String(config.network?.peerRelayUrl || '').trim()
      ? { peerRelay: String(config.network.peerRelayUrl).trim() }
      : {}),
    ...(String(config.network?.peerRoomId || '').trim()
      ? { peerRoom: String(config.network.peerRoomId).trim() }
      : {})
  };
  delete compiled.surfaceDraw;
  return compiled;
}

function toSearchParams(input) {
  if (input instanceof URLSearchParams) return input;
  if (typeof input === 'string') {
    return new URLSearchParams(input.startsWith('?') ? input.slice(1) : input);
  }
  return new URLSearchParams();
}

export function hasSimulationUrlParams(searchOrParams) {
  const params = toSearchParams(searchOrParams);
  return SIMULATION_URL_PARAM_KEYS.some((key) => {
    const val = params.get(key);
    return val != null && val.trim() !== '';
  });
}

/**
 * Serialize a staged studio configuration into clean, forward-looking URL
 * query parameters so editing simulation variables keeps the URL in sync
 * and direct navigation restores and auto-launches the exact simulation.
 */
export function serializeStagedConfigToUrlSearchParams(config, {
  autoPlayWhenReady = false
} = {}) {
  const params = new URLSearchParams();
  if (!config) return params;

  const exactPreset = sphPhaseScenarioPresetById(config.presetId);
  if (exactPreset) {
    params.set('preset', exactPreset.id);
  } else {
    params.set('preset', 'custom');
    const basePreset = sphPhaseScenarioPresetById(config.basePresetId);
    if (basePreset) params.set('basePreset', basePreset.id);
  }

  if (Array.isArray(config.boxDimensionsM) && config.boxDimensionsM.length === 3) {
    params.set('box', config.boxDimensionsM.map((v) => String(roundNice(v, 6))).join(','));
  }

  if (Array.isArray(config.bodies) && config.bodies.length > 0) {
    try {
      const normalized = normalizeSphInitialBodies(config.bodies);
      params.set('frame', 'floor');
      params.set('bodies', serializeSphInitialBodies(normalized));
    } catch {
      // Keep raw JSON if draft is mid-edit so user edits still reflect in URL.
      params.set('frame', 'floor');
      params.set('bodies', JSON.stringify(config.bodies));
    }
  }

  params.set('wallModel', config.wallModel || 'finite-heat-capacity-lumped-face');
  if (config.wallModel !== 'adiabatic' && config.walls) {
    const w = config.walls;
    params.set('walls', [w.xMin, w.xMax, w.yMin, w.yMax, w.zMin, w.zMax].map((v) => String(roundNice(v, 5))).join(','));
  }

  const env = config.environment || {};
  params.set('env', env.mode || 'vacuum');
  if (env.mode === 'air') {
    params.set('airT', String(roundNice(env.temperatureK ?? 293.15, 5)));
    params.set('airP', String(roundNice(env.pressurePa ?? 101325, 6)));
    params.set('airRh', String(roundNice(env.humidityPercent ?? 50, 4)));
    if (Number(env.nucleiPerCm3) > 0) {
      params.set('airNuclei', String(roundNice(env.nucleiPerCm3, 5)));
    }
    const airLevels = normalizeAirHierarchyLevels(
      env.airHierarchyLevels,
      env.twoLevelAir === true
    );
    if (airLevels >= 3) {
      params.set('airLevels', String(airLevels));
    } else if (airLevels === 2) {
      params.set('airTwoLevel', '1');
    }
  }

  const laws = config.laws || {};
  const lawTokens = [
    `g:${laws.gravity !== false ? 1 : 0}`,
    `t:${laws.thermal !== false ? 1 : 0}`,
    `r:${laws.reactions !== false ? 1 : 0}`,
    `v:${laws.viscosity !== false ? 1 : 0}`,
    `st:${laws.surfaceTension === true ? 1 : 0}`,
    `rs:${laws.rigidSolids !== false ? 1 : 0}`
  ];
  if (laws.cohesiveFracture === false) lawTokens.push('cf:0');
  if (laws.multilevelSolids === false) lawTokens.push('ml:0');
  params.set('laws', lawTokens.join(','));

  const display = config.display || {};
  if (display.lightingMode && display.lightingMode !== SPH_SCENE_LIGHTING_MODE_DEFAULT) {
    params.set('lighting', normalizeSphSceneLightingMode(display.lightingMode));
  }
  if (display.backgroundColor && display.backgroundColor.toLowerCase() !== SPH_SCENE_BACKGROUND_COLOR_DEFAULT.toLowerCase()) {
    params.set('bg', normalizeSphSceneBackgroundColorHex(display.backgroundColor));
  }
  const normalizedBgImg = normalizeSphBackgroundImageUrl(
    display.backgroundImageUrl,
    SPH_DEFAULT_BACKGROUND_IMAGE_URL
  );
  if (normalizedBgImg !== SPH_DEFAULT_BACKGROUND_IMAGE_URL) {
    params.set('bgimg', normalizedBgImg || 'none');
  }
  if (Number.isFinite(Number(display.blobScale)) && Math.abs(Number(display.blobScale) - 1) > 1e-4) {
    params.set('blob', String(roundNice(display.blobScale, 4)));
  }
  const network = config.network || {};
  const peerRelayUrl = String(network.peerRelayUrl || '').trim();
  const peerRoomId = String(network.peerRoomId || '').trim();
  if (peerRelayUrl) params.set('peerRelay', peerRelayUrl);
  if (peerRoomId) params.set('peerRoom', peerRoomId);
  if (autoPlayWhenReady === true) {
    params.set('autoplay', '1');
  }
  return params;
}

/**
 * Parse simulation URL query parameters into a floor-centered staged config.
 * Returns null when the URL carries no simulation variables (preserving empty
 * zero-allocation boot on a clean URL).
 */
export function parseStagedConfigFromUrlSearchParams(searchOrParams) {
  const params = toSearchParams(searchOrParams);
  if (!hasSimulationUrlParams(params)) return null;

  const rawPreset = params.get('preset') ?? params.get('scenario');
  const exactPreset = sphPhaseScenarioPresetById(rawPreset);
  const basePreset = exactPreset || sphPhaseScenarioPresetById(params.get('basePreset'));
  const config = basePreset
    ? buildStagedConfigFromPreset(basePreset.id)
    : buildBlankCustomConfig();
  if (!exactPreset) {
    config.presetId = 'custom';
    config.basePresetId = basePreset ? basePreset.id : null;
  }

  const rawBox = params.get('box');
  if (rawBox) {
    const dims = rawBox.split(',').map(Number);
    if (dims.length === 3 && dims.every((v) => Number.isFinite(v) && v > 0)) {
      config.boxDimensionsM = dims.map((v) => roundNice(v, 6));
    }
  }

  const rawBodies = params.get('bodies');
  if (rawBodies) {
    try {
      const parsedBodies = parseSphInitialBodies(rawBodies).bodies;
      const frame = (params.get('frame') || 'floor').trim().toLowerCase();
      config.bodies = parsedBodies.map((body) => {
        const centerM = frame === 'internal'
          ? Array.from(internalToFloorCenteredCenterM(body.centerM, config.boxDimensionsM))
          : Array.from(body.centerM);
        return {
          ...body,
          centerM: centerM.map((v) => roundNice(v, 6)),
          sizeM: Array.from(body.sizeM).map((v) => roundNice(v, 6)),
          particlesPerEdge: [...body.particlesPerEdge],
          velocityMPerS: [...body.velocityMPerS]
        };
      });
    } catch {
      // Fall back to base preset bodies if URL bodies payload is malformed.
    }
  }

  const rawWallModel = params.get('wallModel');
  if (rawWallModel && VALID_WALL_MODELS.has(rawWallModel)) {
    config.wallModel = rawWallModel;
  }
  const rawWalls = params.get('walls');
  if (rawWalls) {
    const vals = rawWalls.split(',').map(Number);
    if (vals.length === 6 && vals.every((v) => Number.isFinite(v) && v > 0)) {
      config.walls = {
        xMin: vals[0],
        xMax: vals[1],
        yMin: vals[2],
        yMax: vals[3],
        zMin: vals[4],
        zMax: vals[5]
      };
    }
  }

  const rawEnv = params.get('env');
  if (rawEnv === 'air' || rawEnv === 'vacuum') {
    config.environment.mode = rawEnv;
  }
  const airT = Number(params.get('airT'));
  if (params.has('airT') && Number.isFinite(airT) && airT > 0) config.environment.temperatureK = airT;
  const airP = Number(params.get('airP'));
  if (params.has('airP') && Number.isFinite(airP) && airP >= 0) config.environment.pressurePa = airP;
  const airRh = Number(params.get('airRh'));
  if (params.has('airRh') && Number.isFinite(airRh) && airRh >= 0) config.environment.humidityPercent = airRh;
  const airNuclei = Number(params.get('airNuclei'));
  if (params.has('airNuclei') && Number.isFinite(airNuclei) && airNuclei >= 0) config.environment.nucleiPerCm3 = airNuclei;
  if (params.has('airLevels')) {
    const parsedAirLevels = normalizeAirHierarchyLevels(params.get('airLevels'), false);
    config.environment.airHierarchyLevels = parsedAirLevels;
    config.environment.twoLevelAir = parsedAirLevels === 2;
  } else if (params.has('airTwoLevel')) {
    const rawTwoLevel = String(params.get('airTwoLevel') || '').trim().toLowerCase();
    const enabled = ['1', 'true', 'yes', 'on'].includes(rawTwoLevel);
    config.environment.twoLevelAir = enabled;
    config.environment.airHierarchyLevels = enabled ? 2 : 1;
  }

  const rawLaws = params.get('laws');
  if (rawLaws) {
    const map = Object.fromEntries(
      rawLaws.split(',').map((entry) => entry.split(':').map((s) => s.trim()))
    );
    if (map.g != null) config.laws.gravity = map.g !== '0';
    if (map.t != null) config.laws.thermal = map.t !== '0';
    if (map.r != null) config.laws.reactions = map.r !== '0';
    if (map.v != null) config.laws.viscosity = map.v !== '0';
    if (map.st != null) config.laws.surfaceTension = map.st === '1';
    if (map.rs != null) config.laws.rigidSolids = map.rs !== '0';
    if (map.cf != null) config.laws.cohesiveFracture = map.cf !== '0';
    if (map.ml != null) config.laws.multilevelSolids = map.ml !== '0';
  }

  if (params.has('lighting')) {
    config.display.lightingMode = normalizeSphSceneLightingMode(params.get('lighting'));
  }
  if (params.has('bg')) {
    config.display.backgroundColor = normalizeSphSceneBackgroundColorHex(params.get('bg'));
  }
  if (params.has('bgimg')) {
    config.display.backgroundImageUrl = normalizeSphBackgroundImageUrl(
      params.get('bgimg'),
      SPH_DEFAULT_BACKGROUND_IMAGE_URL
    );
  }
  if (params.has('blob')) {
    const blob = Number(params.get('blob'));
    if (Number.isFinite(blob) && blob > 0) config.display.blobScale = blob;
  }
  config.network = config.network || { peerRelayUrl: '', peerRoomId: '' };
  if (params.has('peerRelay')) {
    config.network.peerRelayUrl = String(params.get('peerRelay') || '').trim();
  }
  if (params.has('peerRoom')) {
    config.network.peerRoomId = String(params.get('peerRoom') || '').trim();
  }

  const rawAutoplay = params.get('autoplay');
  const autoPlay = rawAutoplay == null
    ? true
    : !['0', 'false', 'off', 'no'].includes(rawAutoplay.trim().toLowerCase());

  return { config, autoPlay };
}

/**
 * Derive a truthful broad loading phase message and progress percentage
 * (0..100) from live simulation telemetry until visual updates are ready.
 */
export function deriveSimulationLoadingStatus(telemetry = null, {
  launchInFlight = false,
  elapsedMs = 0,
  autoPlay = false,
  previousPercent = 0
} = {}) {
  const clampPct = (v) => Math.min(100, Math.max(previousPercent, Math.round(v)));

  if (telemetry?.blocked) {
    return {
      ready: false,
      blocked: true,
      percent: clampPct(Math.max(previousPercent, 10)),
      phase: 'Initialization blocked',
      detail: telemetry.blockedReason || 'WebGPU simulation runtime could not start.'
    };
  }

  if (telemetry?.visualUpdatesReady && telemetry?.pendingPreviewActive !== true) {
    return {
      ready: true,
      blocked: false,
      percent: 100,
      phase: 'Visual updates ready',
      detail: autoPlay ? 'Streaming live GPU isosurface frames.' : 'Initial frame ready. Press Play or Step to advance.'
    };
  }

  if (launchInFlight || !telemetry) {
    const sub = Math.min(14, 5 + (elapsedMs / 350));
    return {
      ready: false,
      blocked: false,
      percent: clampPct(sub),
      phase: 'Initializing WebGPU runtime & workers…',
      detail: 'Allocating PeerCompute compute workers and presentation surface.'
    };
  }

  if (telemetry.rebuildStatus !== 'complete') {
    const sub = Math.min(44, 18 + (elapsedMs / 180));
    return {
      ready: false,
      blocked: false,
      percent: clampPct(sub),
      phase: 'Deriving material properties & chemical closures…',
      detail: 'Solving first-principles atomic, thermodynamic, and optical tables.'
    };
  }

  if (!telemetry.ready || telemetry.authorityHostStatus === 'initializing' || !telemetry.workerReady) {
    const sub = Math.min(68, 48 + (elapsedMs / 260));
    return {
      ready: false,
      blocked: false,
      percent: clampPct(sub),
      phase: 'Building spatial hierarchy & uploading GPU buffers…',
      detail: 'Packing Schroeder Spatial cells and material closure tables onto WebGPU.'
    };
  }

  if (!telemetry.workerVisualReady) {
    const sub = Math.min(95, 72 + Math.min(23, (elapsedMs / 650)));
    return {
      ready: false,
      blocked: false,
      percent: clampPct(sub),
      phase: 'Compiling WebGPU shaders & rendering first visual frame…',
      detail: 'Preparing marching-cubes isosurface pipelines and presenting first visual frame.'
    };
  }

  const sub = Math.min(96, 80 + (elapsedMs / 350));
  return {
    ready: false,
    blocked: false,
    percent: clampPct(sub),
    phase: 'Rendering initial isosurface frame…',
    detail: 'Waiting for first confirmed visual frame on WebGPU.'
  };
}
