import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  createDynamicHierarchyLodController,
  createDynamicSchroederScaleAtlasRuntime
} from '../src/runtime/sph/schroederSpatialScaleAtlasRuntime.js';

test('Dynamic Hierarchy LOD controller coarsens 3->2 under hardware overload and refines 2->3->4 with physical demand + headroom', () => {
  const lod = createDynamicHierarchyLodController({
    initialActiveLevelCount: 3,
    minActiveLevelCount: 2,
    maxActiveLevelCount: 4,
    targetSyncHz: 8, // 125 ms budget
    stepsPerSchedule: 4,
    refineHoldSchedules: 3,
    coarsenHoldSchedules: 4
  });

  // 3 overloaded schedules stay in hysteresis band without thrashing
  for (let i = 0; i < 3; i++) {
    const r = lod.evaluateScheduleBoundary({ scheduleWallMs: 220, maxVolumeRatio: 8, activeInterfaceCount: 1 });
    assert.equal(r.action, 'hold');
    assert.equal(r.activeLevelCount, 3);
  }
  // 4th overloaded schedule coarsens 3 -> 2
  const coarsened = lod.evaluateScheduleBoundary({ scheduleWallMs: 220, maxVolumeRatio: 8, activeInterfaceCount: 1 });
  assert.equal(coarsened.action, 'coarsen');
  assert.equal(coarsened.activeLevelCount, 2);
  assert.equal(coarsened.maxLevel, 1);

  // Fast schedules with high physical demand refine 2 -> 3 after 3 consecutive schedules
  for (let i = 0; i < 2; i++) {
    const r = lod.evaluateScheduleBoundary({ scheduleWallMs: 40, maxVolumeRatio: 8, activeInterfaceCount: 1 });
    assert.equal(r.action, 'hold');
    assert.equal(r.activeLevelCount, 2);
  }
  const refined3 = lod.evaluateScheduleBoundary({ scheduleWallMs: 40, maxVolumeRatio: 8, activeInterfaceCount: 1 });
  assert.equal(refined3.action, 'refine');
  assert.equal(refined3.activeLevelCount, 3);
  assert.equal(refined3.maxLevel, 2);

  // Continued headroom + demand refines 3 -> 4
  lod.evaluateScheduleBoundary({ scheduleWallMs: 40, maxVolumeRatio: 8, activeInterfaceCount: 1 });
  lod.evaluateScheduleBoundary({ scheduleWallMs: 40, maxVolumeRatio: 8, activeInterfaceCount: 1 });
  const refined4 = lod.evaluateScheduleBoundary({ scheduleWallMs: 40, maxVolumeRatio: 8, activeInterfaceCount: 1 });
  assert.equal(refined4.action, 'refine');
  assert.equal(refined4.activeLevelCount, 4);
  assert.equal(refined4.maxLevel, 3);

  // Device memory cap immediately clamps active levels safely
  const clamped = lod.evaluateScheduleBoundary({
    scheduleWallMs: 40,
    maxVolumeRatio: 8,
    activeInterfaceCount: 1,
    deviceLimits: { maxBufferSize: 32 * 1024 * 1024, maxStorageBuffersPerShaderStage: 12 }
  });
  assert.equal(clamped.action, 'coarsen');
  assert.equal(clamped.reason, 'hardware-memory-cap');
  assert.equal(clamped.activeLevelCount, 2);
});

test('40-OOM Dynamic Scale Atlas runtime spawns multi-chart hierarchies spanning >40 OOM', () => {
  const atlas = createDynamicSchroederScaleAtlasRuntime({
    referenceSpacingM: 1e-2,
    rootGlobalBaseLevel: 0,
    rootLocalMinLevel: 0,
    rootLocalMaxLevel: 2,
    rootLabel: 'lab-root'
  });
  const molecular = atlas.ensureChartForScaleLevel({ targetGlobalLevel: -42, localSpanLevels: 3, label: 'molecular' });
  const planetary = atlas.ensureChartForScaleLevel({ targetGlobalLevel: 92, localSpanLevels: 3, label: 'planetary' });
  assert.equal(molecular.created, true);
  assert.equal(planetary.created, true);
  const snap = atlas.snapshotAtlas();
  assert.equal(snap.charts.length, 3);
  assert.ok(snap.ordersOfMagnitude > 40, `expected >40 OOM span, got ${snap.ordersOfMagnitude}`);
});

test('worker and hierarchy wire dynamicHierarchyLod and scaleAtlas at schedule boundaries and support 2..6 chain levels', async () => {
  const [workerSrc, hierSrc, sceneSrc] = await Promise.all([
    fs.readFile(path.resolve(process.cwd(), 'src/services/ulgMechanicsResidentStage.worker.js'), 'utf8'),
    fs.readFile(path.resolve(process.cwd(), 'src/runtime/sph/schroederHierarchyGpu.js'), 'utf8'),
    fs.readFile(path.resolve(process.cwd(), 'src/visualization/sphPhaseScene.js'), 'utf8')
  ]);
  assert.match(workerSrc, /createDynamicHierarchyLodController\(/);
  assert.match(workerSrc, /createDynamicSchroederScaleAtlasRuntime\(/);
  assert.match(workerSrc, /runSchroederScaleAtlasMultipoleWebGpu\(/);
  assert.match(workerSrc, /dynamicHierarchyLod:\s*dynamicHierarchyLodStatus/);
  assert.match(workerSrc, /scaleAtlas:\s*scaleAtlasStatus/);
  assert.match(hierSrc, /enableLevelChainMechanics requires 2\.\./);
  assert.match(sceneSrc, /__ulgDynamicHierarchyLodStatus/);
  assert.match(sceneSrc, /__ulgScaleAtlasStatus/);
});
