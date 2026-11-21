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
import { createSphPhaseDemo } from '../src/runtime/sphPhaseDemo.js';

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

test('sodium-water preset starts Sodium separated above the full 5x5x5 water basin', () => {
  const staged = buildStagedConfigFromPreset('sodium-water');
  const water = staged.bodies.find((body) => body.material === 'h2o');
  const sodium = staged.bodies.find((body) => body.material === 'Na');
  assert.ok(water && sodium);
  assert.deepEqual(water.particlesPerEdge, [5, 5, 5]);
  assert.deepEqual(sodium.particlesPerEdge, [3, 3, 3]);
  assert.equal(sodium.centerM[1], 1.5);
  const waterTop = water.centerM[1] + water.sizeM[1] / 2;
  const sodiumBottom = sodium.centerM[1] - sodium.sizeM[1] / 2;
  assert.ok(sodiumBottom - waterTop >= 0.19, `expected clear separation gap, got ${sodiumBottom - waterTop}`);
  assert.equal(validateStagedSimulationConfig(staged).valid, true);
});

test('loading status stays non-ready while PHYSICS PENDING preview is active and Studio air setups enable G2 exact ledger + CCN', () => {
  const pendingStatus = deriveSimulationLoadingStatus(
    {
      rebuildStatus: 'complete',
      ready: true,
      workerReady: true,
      workerVisualReady: true,
      visualUpdatesReady: true,
      pendingPreviewActive: true
    },
    { elapsedMs: 5000, autoPlay: false, previousPercent: 72 }
  );
  assert.equal(pendingStatus.ready, false);
  assert.ok(pendingStatus.percent < 100);

  const airConfig = buildStagedConfigFromPreset('iron-ice-quench');
  airConfig.presetId = 'custom';
  airConfig.environment.mode = 'air';
  airConfig.environment.nucleiPerCm3 = 0;
  const airParams = buildLaunchParamsFromStagedConfig(airConfig);
  assert.equal(airParams.exactEnergyLedger, '1');
  assert.equal(airParams.environmentNucleiPerCm3, '5000');
});

test('rigid-solid caloric branches avoid solid superheat and include discovered reaction products in fluidThermal', async () => {
  const { sphEnvironmentOptionsFromControls } = await import('../src/runtime/sphEnvironmentControls.js');
  const { stableOpticalMaterialId } = await import('../src/runtime/material/opticalGpuBuffers.js');

  const envOpts = sphEnvironmentOptionsFromControls({
    environmentMode: 'air',
    environmentTemperatureK: '293.15',
    environmentPressurePa: '101325',
    environmentHumidityPercent: '50',
    environmentCellsPerAxis: '2',
    environmentNucleiPerCm3: '5000',
    environmentAirParcels: 'mixture'
  });
  const { demo } = createSphPhaseDemo({
    boxDimensionsM: [0.07, 0.07, 0.07],
    initialBodies: [
      {
        id: 'base',
        domainId: 1,
        material: 'h2o',
        sizeM: [0.0168, 0.0168, 0.0168],
        centerM: [0.035, 0.03, 0.035],
        temperatureK: 233.15,
        particlesPerEdge: [4, 4, 4],
        velocityMPerS: [0, 0, 0],
        legacyRole: 'base'
      },
      {
        id: 'drop',
        domainId: 2,
        material: 'fe',
        sizeM: [0.0084, 0.0084, 0.0084],
        centerM: [0.035, 0.007, 0.035],
        temperatureK: 1850,
        particlesPerEdge: [2, 2, 2],
        velocityMPerS: [0, 0, 0],
        legacyRole: 'drop'
      }
    ],
    ...envOpts,
    exactEnergyLedger: true,
    coherentRigidSolids: true,
    allowReducedProductProperties: true
  });
  const iceBody = demo.state.rigidBodies?.bodies?.[0];
  assert.ok(iceBody?.thermal);
  const { solidBranch, liquidBranch, meltTemperatureK, memberSpecificInternalEnergyJPerKg } = iceBody.thermal;
  const tInit = solidBranch.referenceTemperatureK
    + (memberSpecificInternalEnergyJPerKg - solidBranch.referenceInternalEnergyJPerKg) / solidBranch.cvJPerKgK;
  assert.ok(Math.abs(tInit - 233.15) < 1e-6, `expected exact 233.15 K solid init, got ${tInit}`);
  const tEdge = solidBranch.referenceTemperatureK
    + (solidBranch.energyMaxJPerKg - solidBranch.referenceInternalEnergyJPerKg) / solidBranch.cvJPerKgK;
  assert.ok(Math.abs(tEdge - meltTemperatureK) < 1e-6, `solid branch must meet meltK=${meltTemperatureK}, got ${tEdge}`);
  assert.ok(Math.abs(demo.state.ledgerParcels.waterReferenceU0 - liquidBranch.energyMinJPerKg) < 1e-3);
  const feoMatId = stableOpticalMaterialId('feo');
  assert.ok(
    demo.state.rigidBodies.fluidThermal.some((row) => row.materialId === feoMatId && row.conductivityWPerMK > 0),
    'discovered reaction product feo must be included in rigid-solid fluidThermal table'
  );
});

test('custom simulations with Hydrogen and Oxygen (h2/o2 and periodic-table H/O) discover H2O and initialize cleanly', () => {
  for (const [matA, matB] of [['h2', 'o2'], ['H', 'O'], ['H', 'o2'], ['h2', 'O']]) {
    const driver = createSphPhaseDemo({
      boxDimensionsM: [1.5, 1.5, 1.5],
      initialBodies: [
        {
          id: 'body-1',
          domainId: 1,
          material: matA,
          sizeM: [0.4, 0.4, 0.4],
          centerM: [0.75, 0.2, 0.75],
          temperatureK: 293.15,
          particlesPerEdge: [2, 2, 2],
          velocityMPerS: [0, 0, 0]
        },
        {
          id: 'body-2',
          domainId: 2,
          material: matB,
          sizeM: [0.4, 0.4, 0.4],
          centerM: [0.75, 0.9, 0.75],
          temperatureK: 293.15,
          particlesPerEdge: [2, 2, 2],
          velocityMPerS: [0, 0, 0]
        }
      ]
    });
    assert.equal(driver.demo.reactions.length, 1, `${matA}+${matB} should discover combustion reaction`);
    assert.equal(driver.demo.reactions[0].product, 'h2o', `${matA}+${matB} product should be h2o`);
    assert.ok(driver.demo.reactions[0].specificEnthalpyJPerKg < 0, `${matA}+${matB} should be exothermic`);
    assert.ok(driver.demo.materialProperties.h2o, `${matA}+${matB} should register h2o properties`);
  }
});

test('returning to the Presets tab clears browser URL query parameters', async () => {
  const studioAppSource = await fs.readFile(
    path.resolve(process.cwd(), 'src/visualization/ulgSimStudioApp.js'),
    'utf8'
  );
  assert.match(studioAppSource, /function clearBrowserUrlParams\(\)/);
  assert.match(studioAppSource, /if \(nextTab === 'presets'\) \{\s*clearBrowserUrlParams\(\);\s*\}/);
});

test('worker-lane retirement protects device-pooled dormancy buffers and keeps lane identity batch-size invariant', async () => {
  const [workerSrc, thermalSrc, phaseSrc, reactionSrc, sceneSrc] = await Promise.all([
    fs.readFile(path.resolve(process.cwd(), 'src/services/ulgMechanicsResidentStage.worker.js'), 'utf8'),
    fs.readFile(path.resolve(process.cwd(), 'src/runtime/sph/schroederSpatialThermalProposalsGpu.js'), 'utf8'),
    fs.readFile(path.resolve(process.cwd(), 'src/runtime/sph/sphPhaseCarrierTransferGpu.js'), 'utf8'),
    fs.readFile(path.resolve(process.cwd(), 'src/runtime/sph/schroederSpatialReactionDiscoveryProposalGpu.js'), 'utf8'),
    fs.readFile(path.resolve(process.cwd(), 'src/visualization/sphPhaseScene.js'), 'utf8')
  ]);
  assert.match(workerSrc, /schroederSpatialReactionDiscoveryDeviceRuntimeAllocationOwnership\(record\.workerDevice\)/);
  assert.match(workerSrc, /sphPhaseCarrierTransferDeviceRuntimeAllocationOwnership\(record\.workerDevice\)/);
  assert.match(thermalSrc, /entry\.thermalDormancyStages\.set\(key, stage\);[\s\S]*entry\.ownedBuffers\.add\(buffer\)/);
  assert.match(thermalSrc, /entry\.radiationDormancyStages\.set\(key, stage\);[\s\S]*entry\.ownedBuffers\.add\(buffer\)/);
  assert.match(phaseSrc, /export function sphPhaseCarrierTransferDeviceRuntimeAllocationOwnership\(device\)/);
  assert.match(reactionSrc, /export function schroederSpatialReactionDiscoveryDeviceRuntimeAllocationOwnership\(device\)/);
  assert.match(sceneSrc, /const workerLaneConfigurationSignature = mlsMpmResidentStepsSignatureFor\(\{\s*\.\.\.signatureArgs,\s*stepCount: 1\s*\}\)/);
});

test('Studio exposes per-body SOL-4/5/6 solid mechanics options and 2-level First-Class Air enrollment with URL round-tripping', () => {
  const cfg = buildBlankCustomConfig();
  cfg.boxDimensionsM = [0.2, 0.2, 0.2];
  cfg.bodies = [
    {
      id: 'ice-block',
      domainId: 1,
      material: 'h2o',
      sizeM: [0.06, 0.06, 0.06],
      centerM: [0, 0.03, 0],
      temperatureK: 240,
      particlesPerEdge: [3, 3, 3],
      velocityMPerS: [0, 0, 0],
      mechanicsMode: 'deformable'
    }
  ];
  cfg.environment.mode = 'air';
  cfg.environment.twoLevelAir = true;
  cfg.laws.cohesiveFracture = false;
  cfg.laws.multilevelSolids = false;

  const params = serializeStagedConfigToUrlSearchParams(cfg, { autoPlayWhenReady: true });
  assert.equal(params.get('airTwoLevel'), '1');
  assert.match(params.get('laws'), /cf:0/);
  assert.match(params.get('laws'), /ml:0/);

  const parsed = parseStagedConfigFromUrlSearchParams(params);
  assert.ok(parsed);
  assert.equal(parsed.config.bodies[0].mechanicsMode, 'deformable');
  assert.equal(parsed.config.environment.twoLevelAir, true);
  assert.equal(parsed.config.laws.cohesiveFracture, false);
  assert.equal(parsed.config.laws.multilevelSolids, false);

  const launch = buildLaunchParamsFromStagedConfig(parsed.config);
  // Strictly 2-level First-Class Air (maxLevel - minLevel === 1; 3rd SS level stays on hold).
  assert.equal(launch.schroederTwoLevel, '1');
  assert.equal(launch.schroederMinLevel, '0');
  assert.equal(launch.schroederMaxLevel, '1');
  assert.equal(launch.schroederTwoLevelAuthority, 'authoritative');
  assert.equal(launch.environmentAirParcels, 'mixture');
  assert.ok(Number(launch.splitSpareLineages) >= 64);
  assert.ok(Number(launch.schroederBaseGridSpacingM) > 0);
  assert.equal(launch.solidFracture, '0');
  assert.equal(launch.solidMultilevel, '0');

  // Verify createSphPhaseDemo materializes SOL-4 deformable solid surfaces and SOL-5/6 rigid options.
  const deformableDemo = createSphPhaseDemo({
    boxDimensionsM: [0.2, 0.2, 0.2],
    initialBodies: [{
      id: 'soft-block',
      domainId: 1,
      material: 'h2o',
      sizeM: [0.06, 0.06, 0.06],
      centerM: [0.1, 0.03, 0.1],
      temperatureK: 240,
      particlesPerEdge: [3, 3, 3],
      velocityMPerS: [0, 0, 0],
      mechanicsMode: 'deformable'
    }],
    coherentRigidSolids: true
  });
  assert.equal(deformableDemo.demo.state.deformableSolidSurfaces?.surfaces?.length, 1);
  assert.equal(deformableDemo.demo.state.deformableSolidSurfaces.surfaces[0].bodyId, 'soft-block');
  assert.equal(deformableDemo.demo.state.deformableSolidSurfaces.surfaces[0].domainId, 1);

  const rigidDemo = createSphPhaseDemo({
    boxDimensionsM: [0.2, 0.2, 0.2],
    initialBodies: [{
      id: 'rigid-ice',
      domainId: 1,
      material: 'h2o',
      sizeM: [0.06, 0.06, 0.06],
      centerM: [0.1, 0.03, 0.1],
      temperatureK: 240,
      particlesPerEdge: [3, 3, 3],
      velocityMPerS: [0, 0, 0],
      mechanicsMode: 'rigid'
    }],
    coherentRigidSolids: true,
    solidFractureEnabled: true,
    solidMultilevelEnabled: false
  });
  assert.equal(rigidDemo.demo.state.rigidBodies?.fractureEnabled, true);
  assert.equal(rigidDemo.demo.state.rigidBodies?.multilevelEnabled, false);
  assert.ok(rigidDemo.demo.state.rigidBodies?.maxBodyCapacity >= 5);
});
