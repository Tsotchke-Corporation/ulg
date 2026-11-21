import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  clampSphInitialBodyToContainer,
  containerBoundsForFrame,
  floorCenteredToInternalCenterM,
  internalToFloorCenteredCenterM,
  preflightSphInitialBodiesForSimulation,
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

test('all deduplicated presets normalize to GPU marching-cubes isosurfaces, stay inside floor-centered bounds, and compile valid launch params', () => {
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

    // Every preset body must have X and Z centered around floor origin (0, *, 0)
    // and sit strictly within [-Lx/2, Lx/2] x [0, Ly] x [-Lz/2, Lz/2].
    for (const body of staged.bodies) {
      assert.ok(body.centerM[1] - body.sizeM[1] / 2 >= -1e-9, `${preset.id}:${body.id} bottom >= 0`);
      assert.ok(body.centerM[1] + body.sizeM[1] / 2 <= staged.boxDimensionsM[1] + 1e-9, `${preset.id}:${body.id} top <= Ly`);
    }

    const params = buildLaunchParamsFromStagedConfig(staged);
    assert.equal(params.workerLivePreview, '0');
    assert.equal(params.surfaceDraw, 'native-webgpu-surface-consumer');
    assert.equal(params.residentAuto, '1');
    assert.ok(typeof params.bodies === 'string' && params.bodies.length > 0);
  }
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

test('coherent rigid-solid isosurface WGSL shader and presenter wiring are intact', async () => {
  assert.match(schroederSolidIsosurfaceFieldWgsl, /fn splat_rigid_solid_isosurface/);
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
