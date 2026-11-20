// Host contract of the A4 resident GPU response-function table.
import assert from 'node:assert/strict';
import test from 'node:test';
import { fitResponseFunction } from '../src/runtime/material/localClosureFitCache.js';
import { packResponseFunctionsForGpu, responseFunctionGpuWgsl } from '../src/runtime/material/responseFunctionGpu.js';

const generator3d = {
  id: 'synthetic-3d', axes: [{ name: 'x', unit: '1' }, { name: 'y', unit: '1' }, { name: 'z', unit: '1' }],
  outputUnit: '1', sourceFingerprint: 'synthetic', regimeOf: () => 'one',
  evaluate: ([x, y, z]) => Math.exp(0.3 * x) * (1 + 0.2 * y) * (2 + Math.cos(0.5 * z))
};

test('packing keeps the host tensor layout, boxes and bounds', () => {
  const fn = fitResponseFunction({ generator: generator3d, box: [[0, 2], [-1, 1], [0, 3]], degrees: [10, 2, 9],
    relativeTolerance: 1e-6 });
  const packed = packResponseFunctionsForGpu([fn]);
  const d = packed.data;
  assert.equal(d[0], 1);
  assert.equal(d[1], 4 + 16);
  assert.deepEqual(Array.from(d.slice(4, 16)), [3, 0, 11, 3, 10, 0, 2, -1, 1, 0, 3, Math.fround(fn.residuals.relativeBound)]);
  assert.equal(d.length, 4 + 16 + 11 * 3 * 10);
  assert.equal(d[20], Math.fround(fn.coefficients[0]));
  assert.match(responseFunctionGpuWgsl('table'), /fn rf_eval\(index: u32, x_in: vec3<f32>\) -> vec2<f32>/);
});

test('packing refuses shapes the GPU evaluator cannot hold', () => {
  assert.throws(() => packResponseFunctionsForGpu([]), TypeError);
  assert.throws(() => packResponseFunctionsForGpu([{ axes: [], coefficients: [] }]), RangeError);
  assert.throws(() => packResponseFunctionsForGpu([{ axes: [{ lo: 0, hi: 1, degree: 40 }], coefficients: new Array(41) }]),
    RangeError);
  assert.throws(() => packResponseFunctionsForGpu([{ axes: [{ lo: 0, hi: 1, degree: 2 }], coefficients: [1, 2] }]),
    RangeError);
});

test('packing refuses missing or nonfinite evidence and f32-invalid domains or coefficients', () => {
  const valid = { axes: [{ lo: 0, hi: 1, degree: 1 }], coefficients: [1, 2], residuals: { relativeBound: 1e-6 } };
  for (const bound of [undefined, NaN, Infinity, -1, Number.MAX_VALUE]) {
    assert.throws(() => packResponseFunctionsForGpu([{ ...valid, residuals: { relativeBound: bound } }]), RangeError);
  }
  for (const [lo, hi] of [[0, 0], [1, 0], [0, Infinity], [NaN, 1], [1, 1 + 1e-10], [-3e38, 3e38], [0, 1e-40]]) {
    assert.throws(() => packResponseFunctionsForGpu([{ ...valid, axes: [{ lo, hi, degree: 1 }] }]), RangeError);
  }
  for (const value of [NaN, Infinity, Number.MAX_VALUE]) {
    assert.throws(() => packResponseFunctionsForGpu([{ ...valid, coefficients: [1, value] }]), RangeError);
  }
});
