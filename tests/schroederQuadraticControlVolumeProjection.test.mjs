import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSchroederQuadraticControlVolumeDescriptor as descriptor,
  validateSchroederQuadraticControlVolumeDescriptor as validate,
  schroederQuadraticControlVolumeAxisProjection as project,
  schroederQuadraticControlVolumePrimalAxisExtent as extent,
  schroederQuadraticControlVolumePrimalAxisCenterFraction as center,
  schroederQuadraticControlVolumeDescriptorSeal as seal
} from '../ulg-gpu-abi/src/schroederQuadraticControlVolumeProjection.js';
import { schroederQuadraticControlVolumeProjectionWgsl as wgsl } from '../ulg-gpu-abi/src/schroederQuadraticControlVolumeProjectionWgsl.js';

const defaultGrid = { gridSpacingM: 1, gridDims: [8, 8, 8], gridNodeCount: 512,
  gridShift: 2, chartId: 7, selectedLevel: -1 };
function create(overrides = {}) {
  return descriptor({ ...defaultGrid, boxMinM: [0, 0, 0], boxMaxM: [4, 4, 4], ...overrides });
}
const close = (a, b, tolerance = 1e-12) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const dataFloat = (w) => new Float32Array(new Uint32Array([w]).buffer)[0];

test('canonical descriptor seals immutable grid-local bounds, including translations above f32 integer precision', () => {
  const d = create({ boxMinM: [33554432.125, 0, 0], boxMaxM: [33554432.25, 4, 4] });
  assert.equal(validate(d), d);
  assert.equal(d.boundsWords[0], 33554432);
  assert.equal(dataFloat(d.boundsWords[1]), 0.125);
  assert.equal(dataFloat(d.boundsWords[3]), 0.25);
  assert.ok([d, d.boundsWords, d.gridDims, d.gridCellOrigin].every(Object.isFrozen));
  assert.equal(d.seal, seal(d));
  assert.equal(validate(d, { ...defaultGrid, boxMinM: [33554432.125, 0, 0] }), d);
  assert.throws(() => validate(d, { boxMinM: [33554432.25, 0, 0] }), /boxMinM mismatch/);
  assert.throws(() => validate(d, { gridSpacingM: 0.5 }), /gridSpacingM mismatch/);
  const changedBounds = Object.freeze([d.boundsWords[0] + 1, ...d.boundsWords.slice(1)]);
  assert.throws(() => validate(Object.freeze({ ...d, boundsWords: changedBounds })), /bounds are invalid|seal mismatch/);
  assert.throws(() => validate({ ...d }), /immutable/);
  assert.throws(() => validate(Object.freeze({ ...d, boundsWords: [...d.boundsWords] })), /immutable/);
  const getter = { ...d };
  Object.defineProperty(getter, 'gridSpacingM', { get: () => 1 });
  assert.throws(() => validate(Object.freeze(getter)), /immutable/);
  const inherited = Object.assign(Object.create({ schema: d.schema }), d);
  delete inherited.schema;
  assert.throws(() => validate(Object.freeze(inherited)), /immutable own data/);
});

test('descriptor rejects malformed, collapsed and mismatched geometry and accepts explicit nonuniform origins', () => {
  for (const overrides of [
    { gridSpacingM: NaN }, { gridSpacingM: 0 }, { gridNodeCount: 1 },
    { boxMaxM: [0, 4, 4] }, { boxMaxM: [Infinity, 4, 4] },
    { boxMinM: [0.75, 0, 0], boxMaxM: [0.750000001, 4, 4] },
    { gridCellOrigin: [0, 1, 2] }
  ]) assert.throws(() => create(overrides));
  const d = descriptor({ grid: { ...defaultGrid, gridShift: undefined,
    gridCellOrigin: [-2, 3, 5] }, boxMinM: [0, 0, 0], boxMaxM: [4, 4, 4] });
  assert.equal(validate(d, { gridCellOrigin: [-2, 3, 5] }), d);
  assert.throws(() => validate(d, { gridCellOrigin: [-2, 3, 6] }), /gridCellOrigin mismatch/);
});

test('wall halo has real quadratic capacity and nearest-wall folding overfills by 97/96', () => {
  const halo = project(-1, 0, 0, 4, 0);
  assert.equal(halo.valid, 1);
  close(halo.capacity, 1 / 48);
  assert.equal(halo.cell0, 0);
  assert.equal(halo.weight0, 1);
  // Uniform nodal field: the naive clipped dual/fold combines halo + node0 +
  // half of node1. Their actual capacities are 1/48, 1/2 and 47/48.
  const folded = halo.capacity + project(0, 0, 0, 4, 0).capacity
    + 0.5 * project(1, 0, 0, 4, 0).capacity;
  close(folded, 97 / 96);
  assert.ok(folded > 1);
});

test('ordered capacity intervals conserve volume, tile primal cells, and have at most two targets', () => {
  let seed = 0xabcdef01;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < 500; k++) {
    const translation = k % 3 === 0 ? 33554432 : k % 3 === 1 ? -33554432 : 0;
    const lc = translation + Math.floor(random() * 10);
    const lf = Math.fround(random());
    const width = 0.03 + random() * 8;
    const end = lf + width;
    const uc = lc + Math.floor(end), uf = Math.fround(end - Math.floor(end));
    const sums = new Map();
    let capacitySum = 0;
    for (let node = lc - 2; node <= uc + 2; node++) {
      const p = project(node, lc, lf, uc, uf);
      assert.equal(p.valid, 1, JSON.stringify({ node, lc, lf, uc, uf, p }));
      if (p.capacity === 0) continue;
      assert.ok(p.capacity > 0 && p.capacity <= 1);
      close(p.weight0 + p.weight1, 1, 0);
      assert.ok(p.weight0 > 0 && p.weight1 >= 0);
      capacitySum += p.capacity;
      for (const [cell, weight] of [[p.cell0, p.weight0], [p.cell1, p.weight1]]) {
        if (weight > 0) sums.set(cell, (sums.get(cell) ?? 0) + p.capacity * weight);
      }
    }
    close(capacitySum, (uc - lc) + uf - lf, 5e-14);
    for (let cell = lc; cell <= uc; cell++) close(sums.get(cell) ?? 0, extent(cell, lc, lf, uc, uf), 5e-14);
  }
});

test('thin and near-support boxes retain positive capacity and translated clipped centers', () => {
  for (const [lc, lf, uc, uf] of [[0, 0, 0, 2 ** -28], [0, 0.49999997, 0, 0.50000003],
    [33554432, 0.125, 33554432, 0.1250001], [-33554432, 0.999, -33554431, 0.001]]) {
    let sum = 0;
    for (let node = lc - 2; node <= uc + 2; node++) {
      const p = project(node, lc, lf, uc, uf);
      assert.equal(p.valid, 1);
      sum += p.capacity;
    }
    close(sum, (uc - lc) + uf - lf, 1e-15);
    close(center(lc, lc, lf, uc, uf), lf + extent(lc, lc, lf, uc, uf) * 0.5);
  }
  assert.equal(extent(0, 0, NaN, 1, 0), -1);
  assert.equal(project(0, 1, 0, 0, 0).valid, 0);
  assert.equal(center(-1, 0, 0, 4, 0), -1);
});

test('mathematical forward and transpose are adjoints with sparse ambient cells, including parent composition', () => {
  const bounds = [0, 0, 4, 0];
  const pressure = new Map([[0, 3], [2, -2], [3, 0.5]]); // cell1 intentionally absent
  const fineVolume = [2, 5, 7];
  const A = [[0.75, 0.25, 0], [0, 0.5, 0.5], [0.25, 0, 0.75]];
  const coarseNodes = [0, 1, 2];
  const coarseVolume = coarseNodes.map((_, j) => fineVolume.reduce((s, v, i) => s + v * A[i][j], 0));
  const cellVolume = new Map();
  const wt = coarseNodes.map((node, j) => {
    const p = project(node, ...bounds);
    let sampled = 0;
    for (const [cell, weight] of [[p.cell0, p.weight0], [p.cell1, p.weight1]]) {
      cellVolume.set(cell, (cellVolume.get(cell) ?? 0) + coarseVolume[j] * weight);
      sampled += (pressure.get(cell) ?? 0) * weight;
    }
    return sampled;
  });
  const forward = [...cellVolume].reduce((s, [c, v]) => s + v * (pressure.get(c) ?? 0), 0);
  const transpose = fineVolume.reduce((s, v, i) => s + v * A[i].reduce((a, w, j) => a + w * wt[j], 0), 0);
  close(forward, transpose);
  const p = project(1, ...bounds);
  close(wt[1], 3 * p.weight0);
  assert.notEqual(wt[1], 3, 'missing sparse gas cell is ambient; present cells are never renormalized');
});

test('shared GPU geometry uses canonical widths and a bitwise finite guard', () => {
  assert.match(wgsl, /qcv_pair_width/);
  assert.match(wgsl, /qcv_descriptor_seal/);
  assert.match(wgsl, /bitcast<u32>\(x\) & 0x7f800000u/);
  assert.match(wgsl, /weight1 = 1\.0 - weight0/);
  assert.match(wgsl, /qcv_primal_axis_center_fraction/);
  assert.doesNotMatch(wgsl, /atomic|@group|@binding/);
});
