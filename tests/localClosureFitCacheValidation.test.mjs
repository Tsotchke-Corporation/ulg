import assert from 'node:assert/strict';
import test from 'node:test';
import {
  caloricClosureGenerator,
  createLocalClosureFitCache,
  evaluateLocalClosureFit,
  fitLocalClosure,
  localClosureFitKey
} from '../src/runtime/material/localClosureFitCache.js';
import { ReservationLedger } from '../../peercompute/peercompute/src/peercompute/stateManager/ReservationLedger.js';

// Admission/provenance tests use a nonphysical polynomial, not a physics oracle.
const domain = { lo: -1, hi: 1 };
const generator = () => ({
  id: 'nonphysical-polynomial', inputUnit: '1', outputUnit: '1',
  sourceFingerprint: 'polynomial-v1', evaluate: x => x ** 4
});
const fit = options => fitLocalClosure({ generator: generator(), regimeKey: 'polynomial', domain, ...options });

test('invalid sampling and bound controls cannot produce an admitted zero bound', () => {
  for (const options of [
    { heldOutCount: 0 }, { heldOutCount: NaN }, { heldOutCount: Infinity }, { heldOutCount: 65537 },
    { degree: NaN }, { degree: Infinity }, { degree: 1.5 }, { degree: 129 },
    { safetyFactor: 0 }, { safetyFactor: 0.5 }, { safetyFactor: Infinity },
    { derivativeRelativeStep: 0 }, { derivativeRelativeStep: NaN },
    { derivativeRelativeStep: Infinity }, { derivativeRelativeStep: 2 },
    { valueTolerance: -1 }, { valueTolerance: NaN }
  ]) {
    let calls = 0;
    assert.throws(() => fit({ ...options, generator: {
      ...generator(), evaluate: x => { calls++; return x ** 4; }
    } }), RangeError);
    assert.equal(calls, 0, JSON.stringify(options));
  }
  assert.throws(() => fit({ degree: 1, valueTolerance: 0 }),
    error => error.code === 'LOCAL_CLOSURE_FIT_RESIDUAL');
});

test('held-out values are distinct from every training value', () => {
  const points = [];
  const result = fit({ generator: {
    ...generator(), evaluate: x => { points.push(x); return x ** 4; }
  } });
  const training = new Set(points.slice(0, 17));
  for (let i = 0; i < 257; i++) assert.equal(training.has(points[17 + i * 3]), false);
  assert.ok(Number.isFinite(result.residuals.derivativeBound));
});

test('nonfinite held-out or derivative samples are refused', () => {
  for (const badCall of [3, 4, 5]) {
    let calls = 0;
    assert.throws(() => fit({ degree: 1, generator: {
      ...generator(), evaluate: x => ++calls === badCall ? NaN : x ** 4
    } }), RangeError);
  }
});

test('fit options cannot override the request identity', () => {
  for (const fitOptions of [{ domain: { lo: 10, hi: 11 } }, { generator: generator() }, { regimeKey: 'wrong' }]) {
    assert.throws(() => createLocalClosureFitCache({ generator: generator(), regimeKey: 'polynomial', fitOptions }), TypeError);
  }
  const requested = { ...domain };
  const gen = { ...generator(), evaluate: x => { requested.lo = 10; requested.hi = 11; return x ** 4; } };
  const cache = createLocalClosureFitCache({ generator: gen, regimeKey: 'polynomial' });
  const result = cache.request(requested);
  assert.deepEqual(result.domain, { ...domain, unit: '1' });
  assert.equal(result.key, localClosureFitKey({ generator: gen, regimeKey: 'polynomial', domain }));
});

test('pending and live fits reject changed identity or units with an unchanged fingerprint', () => {
  for (const field of ['id', 'inputUnit', 'outputUnit', 'sourceFingerprint']) {
    const original = generator();
    const cache = createLocalClosureFitCache({ generator: original, regimeKey: 'polynomial' });
    assert.ok(cache.request(domain));
    cache.scheduleBoundary();
    assert.equal(cache.evaluate(0.1).source, 'fit');
    cache.request(domain);
    assert.equal(cache.sourceChanged({ ...original, [field]: 'changed' }), 1);
    assert.equal(cache.live, null);
    cache.scheduleBoundary();
    assert.equal(cache.live, null);
    assert.ok(cache.log.some(entry => entry.event === 'adoption-rejected-stale-source'));
  }
});

test('mutation during fitting cannot change the claimed generator', () => {
  const gen = generator();
  gen.evaluate = x => { gen.id = 'changed-during-fit'; return x ** 4; };
  assert.throws(() => fit({ generator: gen }), /changed during fitting/);
});

test('cache bounds are finite positive integers and domains are canonical', () => {
  for (const maxEntries of [0, -1, Infinity, NaN, 1.5, 4097]) {
    assert.throws(() => createLocalClosureFitCache({ generator: generator(), regimeKey: 'polynomial', maxEntries }), RangeError);
  }
  assert.equal(localClosureFitKey({ generator: generator(), regimeKey: 'polynomial', domain }),
    localClosureFitKey({ generator: generator(), regimeKey: 'polynomial', domain: { lo: '-1', hi: '1' } }));
  for (const invalid of [{ lo: Infinity, hi: 2 }, { lo: -Number.MAX_VALUE, hi: Number.MAX_VALUE }, { lo: 1, hi: 1 }]) {
    assert.throws(() => fit({ domain: invalid }), RangeError);
  }
  const constant = fit({ degree: 0, generator: { ...generator(), evaluate: () => 2 } });
  assert.equal(constant.provenance.degree, 0);
  assert.equal(evaluateLocalClosureFit(constant, 0).value, 2);
});

test('units and regime are explicit; later in-place identity changes invalidate live use', () => {
  for (const field of ['inputUnit', 'outputUnit']) {
    assert.throws(() => fit({ generator: { ...generator(), [field]: '' } }), TypeError);
  }
  for (const regimeKey of [undefined, null, '', {}, 0]) assert.throws(() => fit({ regimeKey }), TypeError);
  const gen = generator();
  const cache = createLocalClosureFitCache({ generator: gen, regimeKey: 'polynomial' });
  cache.request(domain);
  cache.scheduleBoundary();
  gen.id = 'new-generator';
  assert.equal(cache.evaluate(0.2).source, 'exact-fallback');
  assert.equal(cache.live, null);
});

test('caloric generator owns the nested source snapshot bound by its fingerprint', () => {
  const properties = { terms: { factor: 1 }, offsets: [0] };
  const make = () => caloricClosureGenerator({ materialKey: 'nonphysical', properties,
    specificInternalEnergyJPerKg: (p, x) => p.terms.factor * x + p.offsets[0] });
  const original = make();
  const cache = createLocalClosureFitCache({ generator: original, regimeKey: 'polynomial', fitOptions: { degree: 1 } });
  cache.request(domain);
  cache.scheduleBoundary();
  properties.terms.factor = 2;
  properties.offsets[0] = 1;
  assert.equal(original.evaluate(0.5), 0.5);
  assert.ok(Math.abs(cache.evaluate(0.5).value - 0.5) <= cache.live.residuals.valueBound);
  const changed = make();
  assert.notEqual(changed.sourceFingerprint, original.sourceFingerprint);
  cache.sourceChanged(changed);
  assert.equal(cache.live, null);
  assert.equal(cache.evaluate(0.5).value, 2);
});

test('source snapshots reject lossy or shared representations and preserve signed zero', () => {
  const make = properties => caloricClosureGenerator({ materialKey: 'nonphysical', properties,
    specificInternalEnergyJPerKg: (p, x) => p.factor * x });
  const cyclic = {}; cyclic.self = cyclic;
  for (const factor of [new Map([['factor', 1]]), new Set([1]), new Date(), new Float64Array([1]),
    new Float64Array(new SharedArrayBuffer(8)), Infinity, NaN, undefined, () => 1, cyclic]) {
    assert.throws(() => make({ factor }), TypeError);
  }
  assert.throws(() => make({ get factor() { return 1; } }), /data fields/);
  assert.throws(() => make({ factor: [, 1] }), /dense arrays/);
  assert.notEqual(make({ factor: -0 }).sourceFingerprint, make({ factor: 0 }).sourceFingerprint);
  assert.equal(make({ factor: 1, offset: 2 }).sourceFingerprint, make({ offset: 2, factor: 1 }).sourceFingerprint);
  const changedMethod = caloricClosureGenerator({ materialKey: 'nonphysical', properties: { factor: 1 },
    specificInternalEnergyJPerKg: (p, x) => 2 * p.factor * x });
  assert.notEqual(make({ factor: 1 }).sourceFingerprint, changedMethod.sourceFingerprint);
});

test('retirement or destruction during derivation or commit cannot admit a fit', () => {
  for (const stage of ['sample', 'commit']) for (const action of ['retire', 'destroy']) {
    let ledger, key, changed = false;
    const revoke = () => {
      if (!changed) { changed = true; action === 'retire' ? ledger.retire(key) : ledger.destroy(); }
    };
    ledger = new ReservationLedger({ audit: row => { if (stage === 'commit' && row.event === 'commit') revoke(); } });
    const gen = { ...generator(), evaluate: x => { if (stage === 'sample') revoke(); return x ** 4; } };
    key = localClosureFitKey({ generator: gen, regimeKey: 'polynomial', domain });
    const cache = createLocalClosureFitCache({ generator: gen, regimeKey: 'polynomial', reservationLedger: ledger });
    assert.equal(cache.request(domain), null, `${stage}/${action}`);
    assert.equal(cache.pending, null);
    cache.scheduleBoundary();
    assert.equal(cache.live, null);
    assert.equal(cache.counters.derives, 0);
    assert.equal(cache.counters.rejections, 1);
  }
});

test('reservation fences are checked at adoption and before later fit use', () => {
  for (const boundary of [false, true]) {
    const ledger = new ReservationLedger();
    const cache = createLocalClosureFitCache({ generator: generator(), regimeKey: 'polynomial', reservationLedger: ledger });
    const result = cache.request(domain);
    if (boundary) cache.scheduleBoundary();
    ledger.retire(result.key);
    // Another consumer now owns the newer epoch. Invalidating the old cache
    // must not cancel or retire that consumer's reservation.
    const other = ledger.reserve({ key: result.key, consumerId: 'other' });
    assert.equal(other.ok, true);
    cache.scheduleBoundary();
    assert.equal(cache.evaluate(0.2).source, 'exact-fallback');
    assert.equal(cache.live, null);
    cache.destroy();
    assert.equal(ledger.fence(result.key).state, 'reserved');
    assert.equal(ledger.commit(other.token).ok, true);
  }
});

test('bounded cache eviction releases derive keys while keeping the live fit owned', () => {
  const ledger = new ReservationLedger();
  const cache = createLocalClosureFitCache({ generator: generator(), regimeKey: 'polynomial', maxEntries: 1, reservationLedger: ledger });
  const a = cache.request(domain);
  cache.scheduleBoundary();
  const b = cache.request({ lo: -2, hi: 2 });
  assert.equal(ledger.fence(a.key).state, 'consumed', 'eviction alone cannot retire the live fit');
  cache.scheduleBoundary();
  assert.equal(ledger.fence(a.key).state, 'free');
  assert.equal(ledger.fence(b.key).state, 'consumed');
  assert.ok(cache.request(domain), 'an evicted key can be derived again');
  cache.destroy();
  assert.equal(ledger.fence(a.key).state, 'free');
  assert.equal(ledger.fence(b.key).state, 'free');
  assert.equal(ledger.snapshot().destroyed, false, 'the shared ledger remains open');
  assert.equal(cache.destroy(), false);
  assert.throws(() => cache.request(domain), /destroyed/);
});

test('source invalidation and derivation failure release only their own reservations', () => {
  const ledger = new ReservationLedger();
  const original = generator();
  const cache = createLocalClosureFitCache({ generator: original, regimeKey: 'polynomial', reservationLedger: ledger });
  const result = cache.request(domain);
  cache.scheduleBoundary();
  cache.sourceChanged({ ...original, sourceFingerprint: 'polynomial-v2' });
  assert.equal(ledger.fence(result.key).state, 'free');
  const invalid = createLocalClosureFitCache({ generator: original, regimeKey: 'polynomial', reservationLedger: ledger,
    fitOptions: { degree: 1, valueTolerance: 0 } });
  assert.equal(invalid.request(domain), null);
  assert.equal(ledger.fence(result.key).state, 'free');
  assert.equal(ledger.counters.cancelled, 1);
});
