import test from 'node:test';
import assert from 'node:assert/strict';
import { planSphExactMechanicsRestoreDispatch } from '../src/runtime/sph/sphExactMechanicsRefreshGpu.js';
import { createSphExactMassFormat } from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { sphExactPlacementQuantityLayout } from '../src/runtime/sph/sphExactPlacementQuantityWgsl.js';

test('full Iron Ice quantity rollback fits the real two-dimensional dispatch limit', () => {
  const format = createSphExactMassFormat({ wordCount: 9, quantumExponent: -149 });
  const layout = sphExactPlacementQuantityLayout(format, { particleCount: 6784, eventCapacity: 6784 });
  assert.equal(Math.ceil(6784 * layout.recordWords / 64), 99110);
  const dispatch = planSphExactMechanicsRestoreDispatch(6784, layout.recordWords, 65535);
  assert.deepEqual(dispatch, { x: 65535, y: 2, z: 1 });
});

test('restore grids cover boundary and partial rows without exceeding either dimension', () => {
  for (const words of [1, 64, 65, 448, 449, 715, 3136]) {
    const { x, y } = planSphExactMechanicsRestoreDispatch(1, words, 7);
    assert.ok(x <= 7 && y <= 7);
    assert.ok(x * y * 64 >= words);
    assert.ok((y - 1) * x * 64 < words);
  }
  assert.throws(() => planSphExactMechanicsRestoreDispatch(1, 3137, 7), /dispatch capacity/);
});

test('invalid restore dimensions and unaddressable quantities reject before encoding', () => {
  for (const args of [[0, 1, 1], [1, 0, 1], [1, 1, 0], [-1, 1, 1],
    [1.5, 1, 1], [1, 1, NaN], [0x40000000, 1, 65535], [Number.MAX_SAFE_INTEGER, 2, 65535]]) {
    assert.throws(() => planSphExactMechanicsRestoreDispatch(...args), /checked addressing/);
  }
});
