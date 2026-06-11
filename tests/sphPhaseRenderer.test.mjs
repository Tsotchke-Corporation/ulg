import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_PHASE_RENDER_MODE,
  createContinuousSurfaceBatches,
  createOpticalGpuTableForSurfaceBatches
} from '../src/visualization/sphPhaseScene.js';

test('SPH phase renderer batches particles into continuous material surfaces', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 10,
    positionsM: new Float32Array([
      4.5, 1.1, 5.0,
      4.7, 1.1, 5.1,
      5.0, 0.3, 5.0
    ]),
    colorsRgb: new Float32Array([
      0.7, 0.9, 1.0,
      0.6, 0.8, 1.0,
      1.0, 0.32, 0.14
    ]),
    materials: ['h2o', 'h2o', 'fe']
  });

  assert.equal(SPH_PHASE_RENDER_MODE, 'continuous-marching-cubes');
  assert.equal(batches.length, 2);

  const h2o = batches.find((batch) => batch.material === 'h2o');
  const fe = batches.find((batch) => batch.material === 'fe');
  assert.equal(h2o.count, 2);
  assert.equal(fe.count, 1);
  assert.deepEqual(h2o.colorsRgb.slice(0, 3), [0.699999988079071, 0.8999999761581421, 1]);
  assert.ok(h2o.surfaceRadiusM > 0);
  assert.ok(fe.surfaceRadiusM > 0);
  assert.ok(h2o.normalizedPositions.every((value) => value > 0 && value < 1));
  assert.ok(fe.normalizedPositions.every((value) => value > 0 && value < 1));
});

test('SPH phase renderer preserves material and phase descriptors for optical closures', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 10,
    positionsM: new Float32Array([
      4.5, 1.1, 5.0,
      4.7, 1.1, 5.1,
      5.0, 0.3, 5.0
    ]),
    colorsRgb: new Float32Array([
      0.7, 0.9, 1.0,
      0.6, 0.8, 1.0,
      1.0, 0.32, 0.14
    ]),
    materials: [
      { material: 'h2o', phase: 'solid', renderKey: 'ice' },
      { material: 'h2o', phase: 'gas', renderKey: 'steam' },
      { material: 'fe', phase: 'liquid', renderKey: 'fe' }
    ]
  });

  assert.equal(batches.length, 3);
  const ice = batches.find((batch) => batch.renderKey === 'ice');
  const steam = batches.find((batch) => batch.renderKey === 'steam');
  const iron = batches.find((batch) => batch.material === 'fe');
  assert.equal(ice.material, 'h2o');
  assert.equal(ice.phase, 'solid');
  assert.equal(steam.material, 'h2o');
  assert.equal(steam.phase, 'gas');
  assert.equal(iron.renderKey, 'fe');
  assert.equal(iron.phase, 'liquid');
  assert.ok(new Set(batches.map((batch) => batch.surfaceKey)).size === 3);
});

test('SPH phase renderer does not collapse arbitrary selected elements to the last material', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 0.4, 2.6,
      2.4, 2.8, 2.4,
      2.6, 2.8, 2.6
    ]),
    colorsRgb: new Float32Array([
      0.9, 0.9, 0.9,
      0.9, 0.9, 0.9,
      1.0, 0.8, 0.4,
      1.0, 0.8, 0.4
    ]),
    materials: [
      { material: 'Na', phase: 'solid', renderKey: 'Na' },
      { material: 'Na', phase: 'solid', renderKey: 'Na' },
      { material: 'Au', phase: 'liquid', renderKey: 'Au' },
      { material: 'Au', phase: 'liquid', renderKey: 'Au' }
    ]
  });

  const summary = Object.fromEntries(batches.map((batch) => [batch.material, batch.count]));
  assert.deepEqual(summary, { Na: 2, Au: 2 });
  assert.deepEqual(batches.map((batch) => batch.surfaceKey).sort(), ['Au|Au|liquid', 'Na|Na|solid']);
});

test('SPH phase renderer derives a packed optical GPU table from surface batches', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 0.4, 2.6,
      2.4, 2.8, 2.4,
      2.6, 2.8, 2.6
    ]),
    colorsRgb: new Float32Array([
      0.9, 0.9, 0.9,
      0.9, 0.9, 0.9,
      1.0, 0.8, 0.4,
      1.0, 0.8, 0.4
    ]),
    materials: [
      { material: 'h2o', phase: 'solid', renderKey: 'ice' },
      { material: 'h2o', phase: 'gas', renderKey: 'steam' },
      { material: 'Au', phase: 'solid', renderKey: 'Au' },
      { material: 'Au', phase: 'solid', renderKey: 'Au' }
    ]
  });
  const table = createOpticalGpuTableForSurfaceBatches(batches, {
    materialProperties: {
      Au: {
        conductionElectronDensityPerM3: 5.9e28,
        opticalInterbandOscillators: []
      }
    }
  });

  assert.equal(table.schema, 'peercompute.ulg.optical-gpu-table.v0');
  assert.equal(table.recordCount, 3);
  assert.ok(table.spectralSampleCount > 0);
  assert.deepEqual(
    table.recordMetadata.map((record) => `${record.material}|${record.phase}`).sort(),
    ['Au|solid', 'h2o|gas', 'h2o|solid']
  );
  assert.match(table.wgslStructs, /OpticalMaterialRecord/);
});
