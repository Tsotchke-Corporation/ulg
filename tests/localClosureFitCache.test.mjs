import assert from 'node:assert/strict';
import test from 'node:test';
import {
  caloricClosureGenerator,
  createLocalClosureFitCache,
  evaluateLocalClosureFit,
  fitLocalClosure,
  localClosureFitKey
} from '../src/runtime/material/localClosureFitCache.js';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';

// G6: one local provenance-bound sample -> fit -> cache path over exact
// caloric closures u(T). Solid Fe over 300..1000 K is curved (a degree-2 fit
// misses by ~1%); liquid water over 280..360 K is one smooth segment; the
// 273.15 K melting plateau is a discontinuity no smooth fit may cross.
const closures = createReferenceMaterialClosures();
const water = caloricClosureGenerator({ materialKey: 'h2o', properties: closures.h2o.properties,
  specificInternalEnergyJPerKg });
const iron = caloricClosureGenerator({ materialKey: 'fe', properties: closures.fe.properties,
  specificInternalEnergyJPerKg });
const liquid = { lo: 280, hi: 360 };
const solidIron = { lo: 300, hi: 1000 };

test('fit carries units, regime/domain keys, provenance and held-out residual bounds', () => {
  const fit = fitLocalClosure({ generator: iron, regimeKey: 'fe:solid', domain: solidIron, degree: 12,
    valueTolerance: 1 /* J/kg */ });
  assert.equal(fit.domain.unit, 'K');
  assert.equal(fit.outputUnit, 'J/kg');
  assert.equal(fit.regimeKey, 'fe:solid');
  assert.equal(fit.provenance.generatorId, 'thermoState.specificInternalEnergyJPerKg:fe');
  assert.match(fit.provenance.generatorSourceFingerprint, /^sha256:/);
  assert.equal(fit.schema, 'peercompute.ulg.local-closure-fit.v1');
  assert.equal(fit.abiVersion, 1);
  assert.equal(fit.residuals.kind, 'held-out-empirical');
  assert.ok(fit.residuals.valueBound <= 1, `value bound ${fit.residuals.valueBound} J/kg`);
  assert.ok(fit.residuals.maxRelativeDerivative < 1e-3, `derivative residual ${fit.residuals.maxRelativeDerivative}`);
  // Fresh points (not training, not held-out) stay within the declared bound.
  for (let i = 0; i < 1000; i++) {
    const t = solidIron.lo + (solidIron.hi - solidIron.lo) * ((i * 0.61803398875) % 1);
    const r = evaluateLocalClosureFit(fit, t);
    assert.ok(r.inDomain);
    assert.ok(Math.abs(r.value - iron.evaluate(t)) <= fit.residuals.valueBound, `T ${t}`);
  }
  // Strict use: no extrapolation.
  assert.deepEqual(evaluateLocalClosureFit(fit, 1000.001), { inDomain: false, value: null, derivative: null });
  console.log(JSON.stringify({ residuals: fit.residuals, provenance: fit.provenance }));
});

test('a residual over tolerance is not admitted', () => {
  assert.throws(() => fitLocalClosure({ generator: iron, regimeKey: 'fe:solid', domain: solidIron, degree: 2,
    valueTolerance: 1 }), (error) => error.code === 'LOCAL_CLOSURE_FIT_RESIDUAL');
  // Across the 273.15 K melting plateau the closure is not smooth; a low
  // degree fit must be refused rather than admitted.
  assert.throws(() => fitLocalClosure({ generator: water, regimeKey: 'h2o:melt', domain: { lo: 260, hi: 290 },
    degree: 8, valueTolerance: 1 }), (error) => error.code === 'LOCAL_CLOSURE_FIT_RESIDUAL');
});

test('cache keys bind regime, domain, source, ABI and schema', () => {
  const key = localClosureFitKey({ generator: water, regimeKey: 'h2o:liquid', domain: liquid });
  assert.notEqual(key, localClosureFitKey({ generator: water, regimeKey: 'h2o:other', domain: liquid }));
  assert.notEqual(key, localClosureFitKey({ generator: water, regimeKey: 'h2o:liquid', domain: { lo: 280, hi: 361 } }));
  const altered = { ...water, sourceFingerprint: 'sha256:other' };
  assert.notEqual(key, localClosureFitKey({ generator: altered, regimeKey: 'h2o:liquid', domain: liquid }));
});

test('adoption is schedule-bound; envelope exit invalidates; async debt is explicit', () => {
  const cache = createLocalClosureFitCache({ generator: water, regimeKey: 'h2o:liquid',
    fitOptions: { degree: 12, valueTolerance: 1 } });
  // Nothing live yet: exact fallback, counted as debt.
  assert.equal(cache.evaluate(300).source, 'exact-fallback');
  cache.request(liquid);
  assert.equal(cache.live, null, 'a derived fit is pending until a schedule boundary');
  assert.equal(cache.evaluate(300).source, 'exact-fallback');
  cache.scheduleBoundary();
  assert.equal(cache.live?.regimeKey, 'h2o:liquid');
  const inDomain = cache.evaluate(300);
  assert.equal(inDomain.source, 'fit');
  assert.ok(Math.abs(inDomain.value - water.evaluate(300)) <= inDomain.residualBound);
  // Domain exit: the fit is invalidated for this envelope; even in-domain
  // evaluations fall back until a refit is adopted at a boundary.
  assert.equal(cache.evaluate(365).source, 'exact-fallback');
  assert.ok(cache.envelopeExit);
  assert.equal(cache.evaluate(300).source, 'exact-fallback');
  cache.request({ lo: 280, hi: 370 });
  assert.equal(cache.evaluate(300).source, 'exact-fallback', 'still not adopted mid-schedule');
  cache.scheduleBoundary();
  assert.equal(cache.envelopeExit, null);
  assert.equal(cache.evaluate(365).source, 'fit');
  assert.equal(cache.debt.exactFallbackEvaluations, 5);
  assert.equal(cache.debt.maxOutOfDomainDistance, 5);
  assert.deepEqual(cache.log.map((entry) => entry.event),
    ['derived', 'adopted', 'envelope-exit', 'derived', 'adopted']);
  assert.deepEqual(cache.log.map((entry) => entry.scheduleOrdinal), [0, 1, 1, 1, 2]);
});

test('strict policy refuses out-of-domain evaluation instead of extrapolating', () => {
  const cache = createLocalClosureFitCache({ generator: water, regimeKey: 'h2o:liquid', policy: 'strict',
    fitOptions: { degree: 12, valueTolerance: 1 } });
  cache.request(liquid);
  cache.scheduleBoundary();
  assert.deepEqual({ ...cache.evaluate(370), source: cache.evaluate(370).source },
    { inDomain: false, value: null, derivative: null, source: 'refused' });
  assert.equal(cache.debt.refusedEvaluations, 2);
});

test('cache hit in a second compatible region; source change invalidates', () => {
  const cache = createLocalClosureFitCache({ generator: water, regimeKey: 'h2o:liquid',
    fitOptions: { degree: 12, valueTolerance: 1 } });
  cache.request(liquid);
  cache.scheduleBoundary();
  cache.request(liquid);
  assert.equal(cache.counters.hits, 1);
  assert.equal(cache.counters.derives, 1);
  // A changed source (different material properties) drops entries and the live fit.
  const changed = caloricClosureGenerator({ materialKey: 'h2o', specificInternalEnergyJPerKg,
    properties: { ...closures.h2o.properties, revision: 'edited' } });
  assert.equal(cache.sourceChanged(changed), 1);
  assert.equal(cache.live, null);
  assert.equal(cache.evaluate(300).source, 'exact-fallback');
  // A pending fit derived from the old source is rejected at the boundary.
  const stale = createLocalClosureFitCache({ generator: water, regimeKey: 'h2o:liquid',
    fitOptions: { degree: 12, valueTolerance: 1 } });
  stale.request(liquid);
  stale.sourceChanged(changed);
  stale.scheduleBoundary();
  assert.equal(stale.live, null);
  assert.ok(stale.log.some((entry) => entry.event === 'adoption-rejected-stale-source'));
});

test('derive jobs are single-flight through the G5 reservation ledger', async () => {
  const { ReservationLedger } = await import(new URL(
    '../../peercompute/peercompute/src/peercompute/stateManager/ReservationLedger.js', import.meta.url).href);
  const ledger = new ReservationLedger({ name: 'closure-fits' });
  let evaluations = 0;
  const counted = { ...water, evaluate: (t) => { evaluations += 1; return water.evaluate(t); } };
  const a = createLocalClosureFitCache({ generator: counted, regimeKey: 'h2o:liquid', reservationLedger: ledger,
    fitOptions: { degree: 12, valueTolerance: 1 } });
  const b = createLocalClosureFitCache({ generator: counted, regimeKey: 'h2o:liquid', reservationLedger: ledger,
    fitOptions: { degree: 12, valueTolerance: 1 } });
  assert.ok(a.request(liquid));
  const evaluationsAfterFirst = evaluations;
  assert.equal(b.request(liquid), null, 'the second requester does not derive again');
  assert.equal(evaluations, evaluationsAfterFirst);
  assert.equal(b.counters.singleFlightLosses, 1);
  assert.equal(ledger.fence(a.pending.key).state, 'consumed');
});
