import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SCHROEDER_DYADIC_SCALE_GLOBAL_MAX_LEVEL,
  SCHROEDER_DYADIC_SCALE_GLOBAL_MIN_LEVEL,
  SCHROEDER_DYADIC_SCALE_TARGET_OOM
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_SCHROEDER_DYNAMIC_HIERARCHY_LOD_CONTROLLER_SCHEMA,
  ULG_SCHROEDER_DYNAMIC_SCALE_ATLAS_RUNTIME_SCHEMA,
  createDynamicHierarchyLodController,
  createDynamicSchroederScaleAtlasRuntime,
  packScaleAtlasMigrationParticles,
  schroederScaleAtlasMigrationWgsl
} from '../src/runtime/sph/schroederSpatialScaleAtlasRuntime.js';
import {
  ULG_SCHROEDER_SCALE_ATLAS_MULTIPOLE_SCHEMA,
  packMultipoleParticles,
  schroederScaleAtlasMultipoleWgsl
} from '../src/runtime/sph/schroederScaleAtlasMultipoleGpu.js';

test('dynamic scale atlas spawns sparse charts spanning > 40 OOM and retires empty leaf charts with hysteresis', () => {
  const runtime = createDynamicSchroederScaleAtlasRuntime({
    referenceSpacingM: 1.0,
    rootGlobalBaseLevel: 0,
    rootLocalMinLevel: 0,
    rootLocalMaxLevel: 2,
    minIdleEpochsBeforeRetire: 3
  });
  assert.equal(runtime.schema, ULG_SCHROEDER_DYNAMIC_SCALE_ATLAS_RUNTIME_SCHEMA);

  // Dynamically spawn charts across nuclear (-64), molecular (-30), planetary (+24), cosmic (+90)
  const nuclear = runtime.ensureChartForScaleLevel({
    targetGlobalLevel: SCHROEDER_DYADIC_SCALE_GLOBAL_MIN_LEVEL,
    originInParentUnits: [1.25, -0.5, 0.75],
    localSpanLevels: 3
  });
  const molecular = runtime.ensureChartForScaleLevel({
    targetGlobalLevel: -30,
    originInParentUnits: [3.0, 2.0, -1.0],
    localSpanLevels: 3
  });
  const planetary = runtime.ensureChartForScaleLevel({
    targetGlobalLevel: 24,
    originInParentUnits: [10.0, 0.0, 0.0],
    localSpanLevels: 4
  });
  const cosmic = runtime.ensureChartForScaleLevel({
    targetGlobalLevel: SCHROEDER_DYADIC_SCALE_GLOBAL_MAX_LEVEL - 2,
    originInParentUnits: [4.5, -2.5, 1.5],
    localSpanLevels: 3
  });

  assert.equal(nuclear.created, true);
  assert.equal(molecular.created, true);
  assert.equal(planetary.created, true);
  assert.equal(cosmic.created, true);

  // Repeated request inside covered span reuses existing chart without allocating a duplicate.
  const reused = runtime.ensureChartForScaleLevel({ targetGlobalLevel: -29 });
  assert.equal(reused.created, false);
  assert.equal(reused.chartId, molecular.chartId);

  const summary = runtime.summary();
  assert.equal(summary.activeChartCount, 5);
  assert.ok(
    summary.ordersOfMagnitude > SCHROEDER_DYADIC_SCALE_TARGET_OOM + 7,
    `expected > 47 OOM span, got ${summary.ordersOfMagnitude}`
  );

  // Mark planetary & cosmic occupied; leave nuclear & molecular empty.
  runtime.setChartOccupancy(planetary.chartId, 12);
  runtime.setChartOccupancy(cosmic.chartId, 4);

  // Epochs 1 & 2: hysteresis prevents premature retirement.
  assert.deepEqual(runtime.advanceEpochAndRetireEmptyCharts().retiredChartIds, []);
  assert.deepEqual(runtime.advanceEpochAndRetireEmptyCharts().retiredChartIds, []);
  // Epoch 3: leaf empty charts retire; occupied charts and root stay alive.
  const e3 = runtime.advanceEpochAndRetireEmptyCharts();
  assert.ok(e3.retiredChartIds.includes(nuclear.chartId));
  assert.ok(!e3.retiredChartIds.includes(0));
  assert.ok(!e3.retiredChartIds.includes(planetary.chartId));
  assert.ok(!e3.retiredChartIds.includes(cosmic.chartId));
});

test('multi-hop particle migration across 40+ OOM preserves double-float position and exact parallel-axis angular momentum', () => {
  const runtime = createDynamicSchroederScaleAtlasRuntime({
    referenceSpacingM: 1.0,
    rootGlobalBaseLevel: 0,
    rootLocalMinLevel: 0,
    rootLocalMaxLevel: 2
  });
  const fine = runtime.ensureChartForScaleLevel({
    targetGlobalLevel: -44,
    originInParentUnits: [2.5, -1.25, 0.5],
    parentChartId: 0,
    localSpanLevels: 3
  });
  const coarse = runtime.ensureChartForScaleLevel({
    targetGlobalLevel: 92,
    originInParentUnits: [-3.0, 4.0, 1.0],
    parentChartId: 0,
    localSpanLevels: 3
  });
  const spanOom = runtime.summary().ordersOfMagnitude;
  assert.ok(spanOom > 40, `expected > 40 OOM, got ${spanOom}`);

  const initialPos = [1.375, -2.625, 0.875];
  const massKg = 3.5;
  const linMom = [1.2, -0.8, 0.4];
  const angMom = [0.25, -0.5, 1.125];
  const energyJ = 42.5;

  // Forward migration: L=-44 -> root(L=0) -> L=+92
  const forward = runtime.migrateParticleBetweenCharts({
    sourceChartId: fine.chartId,
    targetChartId: coarse.chartId,
    posLocal: initialPos,
    massKg,
    linearMomentumKgMPerS: linMom,
    angularMomentumKgM2PerS: angMom,
    energyJ
  });
  assert.equal(forward.hops, 2);
  assert.equal(forward.massKg, massKg);
  assert.equal(forward.energyJ, energyJ);
  assert.deepEqual(forward.linearMomentumKgMPerS, linMom);

  // Roundtrip migration back: L=+92 -> root(L=0) -> L=-44
  const back = runtime.migrateParticleBetweenCharts({
    sourceChartId: coarse.chartId,
    targetChartId: fine.chartId,
    posLocal: forward.posLocalHi,
    posLocalLo: forward.posLocalLo,
    massKg: forward.massKg,
    linearMomentumKgMPerS: forward.linearMomentumKgMPerS,
    angularMomentumKgM2PerS: forward.angularMomentumKgM2PerS,
    energyJ: forward.energyJ
  });
  assert.equal(back.hops, 2);
  assert.equal(back.massKg, massKg);
  assert.equal(back.energyJ, energyJ);
  // Angular momentum parallel-axis roundtrip is exact to f64 precision!
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(
      Math.abs(back.angularMomentumKgM2PerS[axis] - angMom[axis]) < 1e-12,
      `angMom axis ${axis} drifted: ${back.angularMomentumKgM2PerS[axis]} vs ${angMom[axis]}`
    );
  }
});

test('dynamic hierarchy LOD controller applies hysteresis, refines on physical demand with headroom, and coarsens on hardware overload', () => {
  const lod = createDynamicHierarchyLodController({
    initialActiveLevelCount: 3,
    minActiveLevelCount: 1,
    maxActiveLevelCount: 8,
    targetSyncHz: 10, // budget = 100ms
    refineHeadroomRatio: 0.65,
    coarsenOverloadRatio: 1.25,
    refineHoldSchedules: 3,
    coarsenHoldSchedules: 2
  });
  assert.equal(lod.schema, ULG_SCHROEDER_DYNAMIC_HIERARCHY_LOD_CONTROLLER_SCHEMA);

  // Inside hysteresis band (90ms vs 100ms budget): hold steady, zero thrash.
  const hold = lod.evaluateScheduleBoundary({
    scheduleWallMs: 90,
    maxVolumeRatio: 10,
    activeInterfaceCount: 12
  });
  assert.equal(hold.action, 'hold');
  assert.equal(hold.activeLevelCount, 3);

  // Sustained physical demand + hardware headroom (50ms <= 65ms): refines only on 3rd schedule.
  assert.equal(lod.evaluateScheduleBoundary({ scheduleWallMs: 50, maxVolumeRatio: 12 }).action, 'hold');
  assert.equal(lod.evaluateScheduleBoundary({ scheduleWallMs: 50, maxVolumeRatio: 12 }).action, 'hold');
  const refined = lod.evaluateScheduleBoundary({ scheduleWallMs: 50, maxVolumeRatio: 12 });
  assert.equal(refined.action, 'refine');
  assert.equal(refined.activeLevelCount, 4);

  // Hardware overload (140ms >= 125ms): coarsens on 2nd consecutive overloaded schedule.
  assert.equal(lod.evaluateScheduleBoundary({ scheduleWallMs: 140 }).action, 'hold');
  const coarsened = lod.evaluateScheduleBoundary({ scheduleWallMs: 140 });
  assert.equal(coarsened.action, 'coarsen');
  assert.equal(coarsened.activeLevelCount, 3);

  // Tight device memory limit immediately clamps active level count safely.
  const clamped = lod.evaluateScheduleBoundary({
    scheduleWallMs: 40,
    maxVolumeRatio: 20,
    deviceLimits: { maxBufferSize: 32 * 1024 * 1024, maxStorageBuffersPerShaderStage: 16 }
  });
  assert.equal(clamped.action, 'coarsen');
  assert.equal(clamped.reason, 'hardware-memory-cap');
  assert.equal(clamped.activeLevelCount, 2);
});

test('scale atlas migration and multipole WGSL + binary packers validate structure cleanly', () => {
  assert.ok(schroederScaleAtlasMigrationWgsl.includes('fn migrate_particles_across_charts'));
  assert.ok(schroederScaleAtlasMigrationWgsl.includes('ss_atlas_rebase_child_to_parent'));
  assert.ok(schroederScaleAtlasMultipoleWgsl.includes('fn reduce_chart_multipoles'));
  assert.ok(schroederScaleAtlasMultipoleWgsl.includes('fn evaluate_cross_chart_coupling'));
  assert.equal(ULG_SCHROEDER_SCALE_ATLAS_MULTIPOLE_SCHEMA, 'peercompute.ulg.schroeder-scale-atlas-multipole-gpu.v1');

  const packedMig = packScaleAtlasMigrationParticles([
    { chartId: 1, targetChartId: 2, massKg: 2, energyJ: 10, posLocal: [1, 2, 3], linearMomentumKgMPerS: [0.1, 0.2, 0.3], angularMomentumKgM2PerS: [0, 0, 1] }
  ]);
  assert.equal(packedMig.length, 20);

  const packedMp = packMultipoleParticles([
    { chartId: 0, massKg: 100, temperatureK: 1500, posLocal: [1, 0, 0], effectiveAreaM2: 0.5 }
  ]);
  assert.equal(packedMp.length, 8);
});
