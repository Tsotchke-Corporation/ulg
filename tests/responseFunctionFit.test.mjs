import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { evaluateResponseFunction, fitResponseFunction } from '../src/runtime/material/localClosureFitCache.js';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';
import { schroederAuthorityTextFingerprint } from '../src/runtime/sph/schroederAuthorityFingerprint.js';

// A4: multidimensional, first-principles, sample-derived response functions
// with explicit axes, units, validity regions, declared derivative signs and
// invalidation (localClosureFitCache.js, fitResponseFunction).
const elements = JSON.parse(readFileSync(new URL('../data/material-properties/elements.json', import.meta.url), 'utf8'));
const nitrogen = elements.records.find(r => r.symbol === 'N');
const R = 8.314462618; // J/(mol K), exact SI
// Ideal gas of N2 (kinetic theory): rho = P M / (R T), M from the bank's atomic mass.
const idealGasN2 = (fingerprintExtra = '') => ({
  id: 'ideal-gas-density:N2',
  axes: [{ name: 'temperature', unit: 'K' }, { name: 'pressure', unit: 'Pa' }],
  outputUnit: 'kg/m^3',
  sourceFingerprint: schroederAuthorityTextFingerprint(JSON.stringify({ M: nitrogen.atomicMassU, R }) + fingerprintExtra, 'source'),
  evaluate: ([T, P]) => P * (2 * nitrogen.atomicMassU * 1e-3) / (R * T),
  regimeOf: ([T]) => (T > nitrogen.transitions.find(t => t.name === 'boiling').temperatureK ? 'gas' : 'condensed')
});

test('2-D ideal-gas density fit: axes, units, validity box, held-out interior and boundary residuals', () => {
  const generator = idealGasN2();
  const fn = fitResponseFunction({ generator, box: [[300, 1000], [5e4, 2e5]], degrees: [14, 1], signs: [-1, 1],
    relativeTolerance: 1e-6 });
  assert.deepEqual(fn.axes.map(a => [a.name, a.unit, a.lo, a.hi]), [['temperature', 'K', 300, 1000], ['pressure', 'Pa', 5e4, 2e5]]);
  assert.equal(fn.outputUnit, 'kg/m^3');
  assert.equal(fn.regime, 'gas');
  assert.ok(fn.residuals.interior.maxRel < 5e-7 && fn.residuals.boundary.maxRel < 5e-7, JSON.stringify(fn.residuals));
  assert.equal(fn.provenance.heldOut.interior, 81);
  assert.equal(fn.provenance.heldOut.boundary, 324);
  // Fresh points: within the bound, and the physical order holds.
  for (let i = 0; i < 500; i++) {
    const T = 300 + 700 * ((i * 0.618034) % 1), P = 5e4 + 1.5e5 * ((i * 0.414214) % 1);
    const r = evaluateResponseFunction(fn, [T, P], { generator });
    assert.ok(r.ok);
    const exact = generator.evaluate([T, P]);
    assert.ok(Math.abs(r.value - exact) <= fn.residuals.relativeBound * exact);
    assert.ok(r.gradient[0] < 0 && r.gradient[1] > 0, 'density falls with T and rises with P');
  }
  console.log(JSON.stringify({ residuals: fn.residuals, samples: fn.provenance.sampleCount }));
});

test('refusals: a phase transition inside the box, a violated declared sign, an over-tolerance fit', () => {
  const closures = createReferenceMaterialClosures();
  const water = {
    id: 'thermoState.u:h2o', axes: [{ name: 'temperature', unit: 'K' }, { name: 'pressure', unit: 'Pa' }],
    outputUnit: 'J/kg', sourceFingerprint: 'sha256:h2o',
    evaluate: ([T]) => specificInternalEnergyJPerKg(closures.h2o.properties, T),
    regimeOf: ([T]) => (T < 273.15 ? 'solid' : T < 373.15 ? 'liquid' : 'gas')
  };
  assert.throws(() => fitResponseFunction({ generator: water, box: [[260, 290], [9e4, 1.1e5]], degrees: [6, 1] }),
    (e) => e.code === 'RESPONSE_FUNCTION_REFUSED' && /spans regimes/.test(e.message));
  assert.throws(() => fitResponseFunction({ generator: idealGasN2(), box: [[300, 1000], [5e4, 2e5]], degrees: [14, 1],
    signs: [1, 1] }), (e) => e.code === 'RESPONSE_FUNCTION_REFUSED' && /sign/.test(e.message));
  assert.throws(() => fitResponseFunction({ generator: idealGasN2(), box: [[300, 1000], [5e4, 2e5]], degrees: [2, 1],
    relativeTolerance: 1e-6 }), (e) => e.code === 'RESPONSE_FUNCTION_REFUSED' && /residual/.test(e.message));
});

test('strict evaluation: out of domain and stale source are refused', () => {
  const generator = idealGasN2();
  const fn = fitResponseFunction({ generator, box: [[300, 1000], [5e4, 2e5]], degrees: [14, 1] });
  assert.equal(evaluateResponseFunction(fn, [1001, 1e5], { generator }).reason, 'out-of-domain');
  assert.equal(evaluateResponseFunction(fn, [500, 4e4], { generator }).reason, 'out-of-domain');
  assert.equal(evaluateResponseFunction(fn, [500, 1e5], { generator: idealGasN2('edited') }).reason, 'stale-source');
});
