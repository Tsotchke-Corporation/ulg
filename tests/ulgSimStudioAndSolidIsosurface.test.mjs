import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  clampSphInitialBodyToContainer,
  containerBoundsForFrame,
  findNonOverlappingPlacementForBody,
  findOverlappingSphInitialBodies,
  floorCenteredToInternalCenterM,
  internalToFloorCenteredCenterM,
  preflightSphInitialBodiesForSimulation,
  separateOverlappingSphInitialBodies,
  validateSphInitialBodiesInContainer
} from '../src/runtime/sphInitialBodies.js';
import {
  SPH_PHASE_SCENARIO_PRESETS,
  sphPhaseScenarioPresetById
} from '../src/runtime/sphPhaseScenarioPresets.js';
import {
  buildBlankCustomConfig,
  buildLaunchParamsFromStagedConfig,
  buildStagedConfigFromPreset,
  deriveSimulationLoadingStatus,
  hasSimulationUrlParams,
  parseStagedConfigFromUrlSearchParams,
  serializeStagedConfigToUrlSearchParams,
  validateStagedSimulationConfig
} from '../src/visualization/ulgSimStudioModel.js';
import {
  schroederSolidIsosurfaceFieldWgsl
} from '../src/runtime/sph/schroederSolidIsosurfaceFieldGpu.js';

test('floor-centered container coordinates place floor center at (0, 0, 0) and round-trip with internal solver bounds', () => {
  const box = [2.4, 1.8, 3.0];
  const bounds = containerBoundsForFrame(box, 'floor-centered');
  assert.deepEqual(bounds.minM, [-1.2, 0, -1.5]);
  assert.deepEqual(bounds.maxM, [1.2, 1.8, 1.5]);

  const floorOrigin = [0, 0, 0];
  const internalFloorOrigin = floorCenteredToInternalCenterM(floorOrigin, box);
  assert.deepEqual(internalFloorOrigin, [1.2, 0, 1.5]);
  assert.deepEqual(internalToFloorCenteredCenterM(internalFloorOrigin, box), [0, 0, 0]);

  const internalBounds = containerBoundsForFrame(box, 'internal');
  assert.deepEqual(internalBounds.minM, [0, 0, 0]);
  assert.deepEqual(internalBounds.maxM, [2.4, 1.8, 3.0]);
});

test('bodies starting or extending outside container bounds are rejected and clamped cleanly', () => {
  const box = [2, 2, 2];
  const outsideBody = {
    id: 'body-1',
    domainId: 1,
    material: 'h2o',
    sizeM: [0.6, 0.6, 0.6],
    centerM: [0.95, 0.3, 0], // X max = 1.25 > 1.0
    temperatureK: 293.15,
    particlesPerEdge: [3, 3, 3],
    velocityMPerS: [0, 0, 0]
  };
  assert.throws(
    () => validateSphInitialBodiesInContainer([outsideBody], box, { coordinateFrame: 'floor-centered' }),
    /exceed container/i
  );

  const preflight = preflightSphInitialBodiesForSimulation([outsideBody], {
    boxDimensionsM: box,
    coordinateFrame: 'floor-centered'
  });
  assert.equal(preflight.feasible, false);
  assert.ok(preflight.blockers.includes('body-outside-container:body-1'));

  const clamped = clampSphInitialBodyToContainer(outsideBody, box, { coordinateFrame: 'floor-centered' });
  assert.ok(clamped);
  assert.ok(Math.abs(clamped.centerM[0] - 0.7) < 1e-9);
  assert.ok(Math.abs(clamped.centerM[1] - 0.3) < 1e-9);
  assert.doesNotThrow(
    () => validateSphInitialBodiesInContainer([clamped], box, { coordinateFrame: 'floor-centered' })
  );

  // Body starting below the floor (Y min < 0) is also blocked
  const belowFloor = { ...outsideBody, centerM: [0, 0.1, 0] };
  assert.throws(
    () => validateSphInitialBodiesInContainer([belowFloor], box, { coordinateFrame: 'floor-centered' }),
    /exceed container/i
  );
  const clampedFloor = clampSphInitialBodyToContainer(belowFloor, box, { coordinateFrame: 'floor-centered' });
  assert.ok(Math.abs(clampedFloor.centerM[1] - 0.3) < 1e-9);
});

test('overlapping bodies are rejected while flush-touching bodies are allowed and separated cleanly', () => {
  const box = [2, 2, 2];
  const base = {
    id: 'base',
    domainId: 1,
    material: 'h2o',
    sizeM: [0.6, 0.6, 0.6],
    centerM: [0, 0.3, 0],
    temperatureK: 293.15,
    particlesPerEdge: [3, 3, 3],
    velocityMPerS: [0, 0, 0]
  };
  // Touching flush at Y = 0.6 m -> allowed (zero interior overlap)
  const touching = {
    ...base,
    id: 'top',
    domainId: 2,
    centerM: [0, 0.9, 0]
  };
  assert.equal(findOverlappingSphInitialBodies([base, touching]).length, 0);

  // Overlapping interior volume -> rejected
  const overlapping = {
    ...base,
    id: 'overlap',
    domainId: 2,
    centerM: [0.2, 0.5, 0]
  };
  const overlaps = findOverlappingSphInitialBodies([base, overlapping]);
  assert.equal(overlaps.length, 1);
  assert.equal(overlaps[0].bodyA.id, 'base');
  assert.equal(overlaps[0].bodyB.id, 'overlap');

  const cfg = buildBlankCustomConfig();
  cfg.bodies = [base, overlapping];
  const validation = validateStagedSimulationConfig(cfg);
  assert.equal(validation.valid, false);
  assert.equal(validation.overlaps.length, 1);
  assert.ok(validation.bodyErrors.has('base'));
  assert.ok(validation.bodyErrors.has('overlap'));
  assert.throws(() => buildLaunchParamsFromStagedConfig(cfg), /overlap/i);

  // Automatic non-overlapping placement & separation resolve overlap inside container
  const placed = findNonOverlappingPlacementForBody(overlapping, [base], box, {
    coordinateFrame: 'floor-centered'
  });
  assert.ok(placed);
  assert.equal(findOverlappingSphInitialBodies([base, placed]).length, 0);

  const separated = separateOverlappingSphInitialBodies([base, overlapping], box, {
    coordinateFrame: 'floor-centered'
  });
  assert.equal(findOverlappingSphInitialBodies(separated).length, 0);
  assert.doesNotThrow(() => validateSphInitialBodiesInContainer(separated, box, { coordinateFrame: 'floor-centered' }));
});

test('all deduplicated presets normalize to GPU marching-cubes isosurfaces, stay non-overlapping and inside floor-centered bounds, and compile valid launch params', () => {
  assert.equal(sphPhaseScenarioPresetById('bulk-water'), null);
  assert.deepEqual(
    SPH_PHASE_SCENARIO_PRESETS.map((p) => p.id),
    ['water-cycle', 'iron-ice-quench', 'sodium-water', 'cesium-fluorine', 'water-realtime']
  );

  for (const preset of SPH_PHASE_SCENARIO_PRESETS) {
    assert.equal(preset.runtime.renderer, 'native-webgpu', `${preset.id} renderer`);
    assert.equal(preset.runtime.surfaceDraw, 'native-webgpu-surface-consumer', `${preset.id} surfaceDraw`);
    assert.equal(preset.runtime.workerLivePreview, '0', `${preset.id} workerLivePreview must be 0 for isosurfaces`);

    const staged = buildStagedConfigFromPreset(preset.id);
    const validation = validateStagedSimulationConfig(staged);
    assert.equal(
      validation.valid,
      true,
      `${preset.id} staged validation failed: ${validation.errors.join('; ')}`
    );
    assert.equal(validation.overlaps.length, 0, `${preset.id} must have zero overlapping bodies`);

    for (const body of staged.bodies) {
      assert.ok(body.centerM[1] - body.sizeM[1] / 2 >= -1e-9, `${preset.id}:${body.id} bottom >= 0`);
      assert.ok(body.centerM[1] + body.sizeM[1] / 2 <= staged.boxDimensionsM[1] + 1e-9, `${preset.id}:${body.id} top <= Ly`);
    }

    const params = buildLaunchParamsFromStagedConfig(staged);
    assert.equal(params.workerLivePreview, '0');
    // Must NOT emit explicit surfaceDraw so custom/edited scenarios keep worker canvas ownership
    assert.equal(params.surfaceDraw, undefined);
    assert.equal(params.residentAuto, '1');
    assert.ok(typeof params.bodies === 'string' && params.bodies.length > 0);
  }
});

test('editing a preset preserves its solver/camera profile and never emits surfaceDraw diagnostic override', () => {
  const edited = buildStagedConfigFromPreset('iron-ice-quench');
  edited.presetId = 'custom';
  edited.bodies[1].temperatureK = 1000;
  const validation = validateStagedSimulationConfig(edited);
  assert.equal(validation.valid, true);

  const params = buildLaunchParamsFromStagedConfig(edited);
  assert.equal(params.scenario, 'custom');
  assert.equal(params.dropt, '1000');
  assert.equal(params.surfaceDraw, undefined);
  assert.equal(params.workerOffscreenPresentation, '1');
  assert.equal(params.workerLivePreview, '0');
  assert.equal(params.cameraPositionNormalized, '0.78,0.46,1.55');
  assert.equal(params.reactionProductReserveExactDiscovery, '1');
});

test('URL variable serialization and parsing round-trip cleanly and leave blank URLs unallocated', () => {
  assert.equal(hasSimulationUrlParams(''), false);
  assert.equal(parseStagedConfigFromUrlSearchParams(''), null);

  const edited = buildStagedConfigFromPreset('iron-ice-quench');
  edited.presetId = 'custom';
  edited.bodies[1].temperatureK = 1000;
  edited.laws.surfaceTension = false;

  const params = serializeStagedConfigToUrlSearchParams(edited, { autoPlayWhenReady: false });
  assert.equal(hasSimulationUrlParams(params), true);
  assert.equal(params.get('preset'), 'custom');
  assert.equal(params.get('basePreset'), 'iron-ice-quench');

  const parsed = parseStagedConfigFromUrlSearchParams(params);
  assert.ok(parsed);
  // Direct URL with simulation variables auto-starts unless autoplay=0 is explicitly passed
  assert.equal(parsed.autoPlay, true);
  assert.equal(parsed.config.presetId, 'custom');
  assert.equal(parsed.config.basePresetId, 'iron-ice-quench');
  assert.equal(parsed.config.bodies[1].temperatureK, 1000);
  assert.equal(parsed.config.laws.surfaceTension, false);
  assert.equal(validateStagedSimulationConfig(parsed.config).valid, true);

  // Direct preset URL works without selecting preset or custom
  const directPreset = parseStagedConfigFromUrlSearchParams('?preset=sodium-water');
  assert.ok(directPreset);
  assert.equal(directPreset.autoPlay, true);
  assert.equal(directPreset.config.presetId, 'sodium-water');
  assert.equal(directPreset.config.bodies[1].material, 'Na');
});

test('loading status progresses monotonically through broad phases until visualUpdatesReady', () => {
  const s1 = deriveSimulationLoadingStatus(null, { launchInFlight: true, elapsedMs: 200, autoPlay: true, previousPercent: 0 });
  assert.equal(s1.ready, false);
  assert.match(s1.phase, /initializing/i);

  const s2 = deriveSimulationLoadingStatus({ rebuildStatus: 'running', ready: false }, { elapsedMs: 600, autoPlay: true, previousPercent: s1.percent });
  assert.ok(s2.percent >= s1.percent);
  assert.match(s2.phase, /deriving material properties/i);

  const s3 = deriveSimulationLoadingStatus({ rebuildStatus: 'complete', ready: false, workerReady: false }, { elapsedMs: 1200, autoPlay: true, previousPercent: s2.percent });
  assert.ok(s3.percent >= s2.percent);
  assert.match(s3.phase, /spatial hierarchy|gpu buffers/i);

  const s4 = deriveSimulationLoadingStatus({ rebuildStatus: 'complete', ready: true, workerReady: true, workerVisualReady: false, visualUpdatesReady: false }, { elapsedMs: 4000, autoPlay: true, previousPercent: s3.percent });
  assert.ok(s4.percent >= s3.percent);
  assert.match(s4.phase, /shaders|first visual frame/i);

  const s5 = deriveSimulationLoadingStatus({ rebuildStatus: 'complete', ready: true, workerReady: true, workerVisualReady: true, visualUpdatesReady: true }, { elapsedMs: 5000, autoPlay: true, previousPercent: s4.percent });
  assert.equal(s5.ready, true);
  assert.equal(s5.percent, 100);
});

test('staged studio validation rejects out-of-bounds custom bodies and compiles custom floor-centered setups cleanly', () => {
  const custom = buildBlankCustomConfig();
  assert.equal(validateStagedSimulationConfig(custom).valid, true);

  const outOfBounds = structuredClone(custom);
  outOfBounds.bodies[0].centerM = [1.5, 0.3, 0];
  const check = validateStagedSimulationConfig(outOfBounds);
  assert.equal(check.valid, false);
  assert.ok(check.bodyErrors.has('body-1'));
  assert.throws(() => buildLaunchParamsFromStagedConfig(outOfBounds), /outside/i);
});

test('coherent rigid-solid isosurface WGSL shader supports multi-material body masks and presenter wiring', async () => {
  assert.match(schroederSolidIsosurfaceFieldWgsl, /fn splat_rigid_solid_isosurface/);
  assert.match(schroederSolidIsosurfaceFieldWgsl, /fn body_in_mask/);
  assert.match(schroederSolidIsosurfaceFieldWgsl, /field_rows\[row\] = total_density;/);
  assert.match(schroederSolidIsosurfaceFieldWgsl, /member_thermo\[m\]\.y/);

  const presenterSource = await fs.readFile(
    path.resolve(process.cwd(), 'src/services/workerOwnedIsosurfacePresenter.js'),
    'utf8'
  );
  assert.match(presenterSource, /encodeSchroederSolidIsosurfaceFieldSplatWebGpu/);
  assert.match(presenterSource, /solidRigidIsosurfaceSplatted/);
  assert.match(presenterSource, /if \(frame\?\.solidRigidIsosurfaceSplatted === true\) return false;/);
});

test('entry points drop straight into empty zero-allocation Simulation Studio without legacy Triad launch page', async () => {
  const indexHtml = await fs.readFile(path.resolve(process.cwd(), 'index.html'), 'utf8');
  const mainJs = await fs.readFile(path.resolve(process.cwd(), 'src/main.js'), 'utf8');
  const standaloneJs = await fs.readFile(path.resolve(process.cwd(), 'src/sphStandalone.js'), 'utf8');

  assert.doesNotMatch(indexHtml, /ULG Triad/i);
  assert.match(mainJs, /mountUlgSimStudioApp/);
  assert.doesNotMatch(mainJs, /createTriadRuntime\(\)/);
  assert.match(standaloneJs, /mountUlgSimStudioApp/);
  assert.match(standaloneJs, /sphMlsMpmGpuStep/);
});
