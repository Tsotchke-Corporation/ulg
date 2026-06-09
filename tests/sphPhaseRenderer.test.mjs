import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_PHASE_RENDER_MODE,
  createContinuousSurfaceBatches
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
