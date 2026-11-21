import {
  SPH_PHASE_SCENARIO_PRESETS,
  sphPhaseScenarioPresetById
} from '../runtime/sphPhaseScenarioPresets.js';
import {
  SPH_ENVIRONMENT_CONTROL_DEFAULTS
} from '../runtime/sphEnvironmentControls.js';
import {
  containerBoundsForFrame,
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

export function totalParticlesOf(bodies) {
  return (bodies || []).reduce(
    (sum, body) => sum + body.particlesPerEdge.reduce((p, n) => p * n, 1),
    0
  );
}

/**
 * Derive a clean, floor-centered staged configuration directly from a preset
 * record without touching browser URLs or spawning any runtime state.
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
  return {
    presetId: preset.id,
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
      nucleiPerCm3: Number(controls.environmentNucleiPerCm3 ?? 0)
    },
    laws: {
      gravity: controls.lawg !== '0',
      thermal: controls.lawt !== '0',
      reactions: controls.lawr !== '0',
      viscosity: controls.lawv !== '0',
      surfaceTension: controls.lawst === '1',
      rigidSolids: runtime.rigidSolids !== '0'
    },
    bodies: floorCenteredBodies,
    display: {
      lightingMode: SPH_SCENE_LIGHTING_MODE_DEFAULT,
      backgroundColor: SPH_SCENE_BACKGROUND_COLOR_DEFAULT,
      blobScale: Number(controls.blob ?? 1)
    },
    solverProfile: isTier0Water
      ? 'tier0-realtime'
      : preset.id === 'cesium-fluorine'
        ? 'two-level-energetic'
        : 'canonical-ss',
    presetRuntimeOverlay: { ...runtime }
  };
}

export function buildBlankCustomConfig() {
  const boxDimensionsM = [2, 2, 2];
  return {
    presetId: 'custom',
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
      nucleiPerCm3: 0
    },
    laws: {
      gravity: true,
      thermal: true,
      reactions: true,
      viscosity: true,
      surfaceTension: false,
      rigidSolids: true
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
      blobScale: 1
    },
    solverProfile: 'canonical-ss',
    presetRuntimeOverlay: {}
  };
}

/**
 * Validate a staged configuration in floor-centered coordinates.
 * Guarantees every body's bounding box lies completely inside the container.
 */
export function validateStagedSimulationConfig(config) {
  const errors = [];
  const bodyErrors = new Map();
  const box = config?.boxDimensionsM;
  if (!Array.isArray(box) || box.length !== 3 || box.some((v) => !(Number(v) > 0) || !Number.isFinite(Number(v)))) {
    errors.push('Container dimensions X, Y, and Z must be positive numbers.');
    return { valid: false, errors, bodyErrors, normalizedBodies: null, preflight: null };
  }
  const bodies = Array.isArray(config?.bodies) ? config.bodies : [];
  if (bodies.length === 0) {
    errors.push('Add at least one material body before launching.');
    return { valid: false, errors, bodyErrors, normalizedBodies: null, preflight: null };
  }

  let normalizedBodies;
  try {
    normalizedBodies = normalizeSphInitialBodies(bodies);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { valid: false, errors, bodyErrors, normalizedBodies: null, preflight: null };
  }

  const bounds = containerBoundsForFrame(box, 'floor-centered');
  const tol = Math.max(1e-9, Math.max(...box) * 1e-9);
  const axisNames = ['X', 'Y', 'Z'];
  for (const body of normalizedBodies.bodies) {
    for (let axis = 0; axis < 3; axis += 1) {
      const minM = body.centerM[axis] - body.sizeM[axis] / 2;
      const maxM = body.centerM[axis] + body.sizeM[axis] / 2;
      if (minM < bounds.minM[axis] - tol || maxM > bounds.maxM[axis] + tol) {
        const msg = `${axisNames[axis]} bounds [${fmtMeters(minM)}, ${fmtMeters(maxM)}] m fall outside container [${fmtMeters(bounds.minM[axis])}, ${fmtMeters(bounds.maxM[axis])}] m.`;
        bodyErrors.set(body.id, bodyErrors.has(body.id) ? `${bodyErrors.get(body.id)} ${msg}` : msg);
      }
    }
  }
  if (bodyErrors.size > 0) {
    errors.push('One or more bodies start or extend outside the container bounds.');
  } else {
    try {
      validateSphInitialBodiesInContainer(normalizedBodies, box, { coordinateFrame: 'floor-centered' });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
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
        bodyErrors.set(id, bodyErrors.has(id) ? `${bodyErrors.get(id)} ${msg}` : msg);
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
    normalizedBodies,
    preflight
  };
}

/**
 * Compile a validated staged configuration into the exact in-memory parameter
 * map consumed by the GPU simulation session (never touching window.location).
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
  const preset = sphPhaseScenarioPresetById(config.presetId);
  const baseRuntime = preset ? preset.runtime : {
    renderer: 'native-webgpu',
    surfaceDraw: 'native-webgpu-surface-consumer',
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
    schroederMechanicsFieldPairV2: '0'
  };

  const firstBody = internalBodies[0];
  const secondBody = internalBodies[1] || firstBody;
  return {
    ...SPH_ENVIRONMENT_CONTROL_DEFAULTS,
    ...baseRuntime,
    ...(config.presetRuntimeOverlay || {}),
    // Always enforce unified GPU marching-cubes isosurface rendering
    renderer: 'native-webgpu',
    surfaceDraw: 'native-webgpu-surface-consumer',
    surfaceOverlay: '0',
    workerOffscreenPresentation: '1',
    workerParticleOverlay: '0',
    workerLivePreview: '0',
    mech: 'mlsmpm',
    residentAuto: '1',
    scenario: preset ? preset.id : 'custom',
    sceneLengthScale: String(scale),
    wallModel: config.wallModel || 'finite-heat-capacity-lumped-face',
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
    environmentNucleiPerCm3: String(config.environment.nucleiPerCm3),
    lawmech: '1',
    lawg: config.laws.gravity ? '1' : '0',
    laweos: '1',
    lawp: config.laws.thermal ? '1' : '0',
    lawt: config.laws.thermal ? '1' : '0',
    lawr: config.laws.reactions ? '1' : '0',
    lawv: config.laws.viscosity ? '1' : '0',
    lawst: config.laws.surfaceTension ? '1' : '0',
    rigidSolids: config.laws.rigidSolids ? '1' : '0',
    base: firstBody.material,
    drop: secondBody.material,
    baset: String(firstBody.temperatureK),
    dropt: String(secondBody.temperatureK),
    basen: String(firstBody.particlesPerEdge[0]),
    dropn: String(secondBody.particlesPerEdge[0]),
    bodies: serializeSphInitialBodies(internalBodies),
    lighting: normalizeSphSceneLightingMode(config.display.lightingMode),
    bg: normalizeSphSceneBackgroundColorHex(config.display.backgroundColor),
    blob: String(config.display.blobScale || 1)
  };
}
