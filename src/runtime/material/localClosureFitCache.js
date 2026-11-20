// G6 (seven-goal-campaign.md; eshkol-higher-order-law-closure-plan.md S2):
// one local, provenance-bound online sample -> fit -> cache path.
//
// - A generator is an exact closure, x -> f(x), with declared units and a
//   source fingerprint (for example thermoState u(T) for one material
//   phase). It is the source of truth; a fit never replaces it outside its
//   domain.
// - fitLocalClosure samples it at Chebyshev nodes on a declared domain, builds
//   the interpolant, and measures held-out value and derivative residuals at
//   points it did not train on. The residual bound is the held-out maximum
//   times a declared safety factor: an empirical bound, labelled as such.
// - The cache key binds the regime key, domain, units, generator fingerprint,
//   ABI version and schema. Any change is a miss, never a stale hit.
// - Strict evaluation stays in-domain. Outside it there is no extrapolation:
//   the caller gets an explicit out-of-domain result and the envelope records
//   the exit, which invalidates the live fit for adoption purposes.
// - Adoption is schedule-bound: a fitted candidate waits as pending and
//   becomes live only at the next schedule boundary. Evaluations between an
//   envelope exit and that boundary fall back to the exact generator and are
//   counted as debt (async policy), or are refused (strict policy).
// - Derive jobs are single-flight per cache key through the G5 bounded CAS
//   reservation ledger, so concurrent requesters derive once.
import { schroederAuthorityTextFingerprint } from '../sph/schroederAuthorityFingerprint.js';

export const LOCAL_CLOSURE_FIT_SCHEMA = 'peercompute.ulg.local-closure-fit.v1';
export const LOCAL_CLOSURE_FIT_ABI_VERSION = 1;

function chebyshevNodes(n) {
  return Array.from({ length: n }, (_, k) => Math.cos(Math.PI * (k + 0.5) / n));
}

// Coefficients c_j of sum_j c_j T_j(t) interpolating f at the n Chebyshev nodes.
function chebyshevCoefficients(values) {
  const n = values.length;
  return Array.from({ length: n }, (_, j) => {
    let sum = 0;
    for (let k = 0; k < n; k++) sum += values[k] * Math.cos(Math.PI * j * (k + 0.5) / n);
    return (j === 0 ? 1 : 2) * sum / n;
  });
}

// Clenshaw for value and derivative d/dt.
function chebyshevEvaluate(coefficients, t) {
  let b1 = 0, b2 = 0;
  for (let j = coefficients.length - 1; j >= 1; j--) { const b0 = 2 * t * b1 - b2 + coefficients[j]; b2 = b1; b1 = b0; }
  const value = t * b1 - b2 + coefficients[0];
  // Derivative series: c'_{j-1} = c'_{j+1} + 2 j c_j.
  const n = coefficients.length;
  const d = new Array(n + 1).fill(0);
  for (let j = n - 1; j >= 1; j--) d[j - 1] = d[j + 1] + 2 * j * coefficients[j];
  d[0] /= 2;
  let e1 = 0, e2 = 0;
  for (let j = n - 2; j >= 1; j--) { const e0 = 2 * t * e1 - e2 + d[j]; e2 = e1; e1 = e0; }
  const derivative = n > 1 ? t * e1 - e2 + d[0] : 0;
  return { value, derivative };
}

function requireGenerator(generator) {
  if (typeof generator?.evaluate !== 'function' || typeof generator.id !== 'string' || !generator.id
    || typeof generator.inputUnit !== 'string' || !generator.inputUnit.trim()
    || typeof generator.outputUnit !== 'string' || !generator.outputUnit.trim()
    || typeof generator.sourceFingerprint !== 'string' || !generator.sourceFingerprint) {
    throw new TypeError('A closure generator needs id, inputUnit, outputUnit, sourceFingerprint and evaluate(x)');
  }
  return generator;
}

function fitRegime(regimeKey) {
  if (typeof regimeKey !== 'string' || !regimeKey.trim()) throw new TypeError('regimeKey must be an explicit nonempty string');
  return regimeKey;
}

function fitDomain(domain) {
  const lo = Number(domain?.lo), hi = Number(domain?.hi);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(hi > lo) || !Number.isFinite(hi - lo)) {
    throw new RangeError('domain needs finite lo < hi and finite width');
  }
  return Object.freeze({ lo, hi });
}

function boundedInteger(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer in [${min}, ${max}]`);
  }
}

function fitMatchesGenerator(fit, generator, regimeKey) {
  return fit.regimeKey === String(regimeKey)
    && fit.provenance.generatorId === generator.id
    && fit.provenance.generatorSourceFingerprint === generator.sourceFingerprint
    && fit.domain.unit === generator.inputUnit && fit.outputUnit === generator.outputUnit;
}

/** The cache key: any change of regime, domain, units, source, ABI or schema is a miss. */
export function localClosureFitKey({ generator, regimeKey, domain }) {
  requireGenerator(generator);
  domain = fitDomain(domain);
  regimeKey = fitRegime(regimeKey);
  return schroederAuthorityTextFingerprint(JSON.stringify({
    schema: LOCAL_CLOSURE_FIT_SCHEMA, abi: LOCAL_CLOSURE_FIT_ABI_VERSION, regimeKey: String(regimeKey),
    generator: generator.id, source: generator.sourceFingerprint,
    inputUnit: generator.inputUnit, outputUnit: generator.outputUnit, domain: [domain.lo, domain.hi]
  }), 'local-closure-fit-key');
}

/**
 * Sample the generator, fit, and measure held-out residuals. Throws when the
 * held-out residual exceeds the requested tolerance (the fit is not admitted).
 */
export function fitLocalClosure({ generator, regimeKey, domain, degree = 16, heldOutCount = 257,
  safetyFactor = 2, valueTolerance = Infinity, derivativeRelativeStep = 1e-6, now = () => Date.now() } = {}) {
  requireGenerator(generator);
  const { lo, hi } = fitDomain(domain);
  boundedInteger(degree, 'degree', 0, 128);
  boundedInteger(heldOutCount, 'heldOutCount', 1, 65536);
  if (!Number.isFinite(safetyFactor) || safetyFactor < 1) throw new RangeError('safetyFactor must be finite and at least one');
  if (!Number.isFinite(derivativeRelativeStep) || derivativeRelativeStep <= 0 || derivativeRelativeStep > 1) {
    throw new RangeError('derivativeRelativeStep must be finite and in (0, 1]');
  }
  if (typeof valueTolerance !== 'number' || !(valueTolerance >= 0)) throw new RangeError('valueTolerance must be nonnegative');
  const source = { id: generator.id, inputUnit: generator.inputUnit, outputUnit: generator.outputUnit,
    sourceFingerprint: generator.sourceFingerprint, evaluate: generator.evaluate };
  regimeKey = fitRegime(regimeKey);
  const n = degree + 1;
  const toX = (t) => lo + (t + 1) * (hi - lo) / 2;
  const started = now();
  const nodes = chebyshevNodes(n);
  const samples = nodes.map((t) => { const x = toX(t); return { x, f: generator.evaluate(x) }; });
  if (!samples.every((s) => Number.isFinite(s.f))) throw new RangeError('generator returned a non-finite sample');
  const coefficients = chebyshevCoefficients(samples.map((s) => s.f));
  // A shifted interior lattice avoids the shared centre of odd Chebyshev and
  // midpoint grids. Explicitly refuse any collision after f64 rounding.
  const trainingPoints = new Set(samples.map(sample => sample.x));
  if (trainingPoints.size !== n || !samples.every(sample => sample.x > lo && sample.x < hi)) {
    throw new RangeError('domain cannot represent distinct interior training points');
  }
  const heldOutOffset = 0.3819660112501051;
  let maxValueResidual = 0, maxRelativeValueResidual = 0, maxDerivativeResidual = 0, maxRelativeDerivativeResidual = 0;
  const scale = (hi - lo) / 2;
  for (let i = 0; i < heldOutCount; i++) {
    const x = lo + (hi - lo) * (i + heldOutOffset) / heldOutCount;
    if (!(x > lo && x < hi) || trainingPoints.has(x)) throw new RangeError('held-out point overlaps training or the domain boundary');
    const t = (2 * (x - lo)) / (hi - lo) - 1;
    const fit = chebyshevEvaluate(coefficients, t);
    const exact = generator.evaluate(x);
    const h = Math.max(Math.abs(x), 1) * derivativeRelativeStep;
    const left = Math.max(lo, x - h), right = Math.min(hi, x + h);
    if (!Number.isFinite(h) || !(right > left)) throw new RangeError('derivative interval is not representable');
    const exactDerivative = (generator.evaluate(right) - generator.evaluate(left)) / (right - left);
    const fitDerivative = fit.derivative / scale;
    const valueResidual = Math.abs(fit.value - exact);
    const derivativeResidual = Math.abs(fitDerivative - exactDerivative);
    maxValueResidual = Math.max(maxValueResidual, valueResidual);
    maxRelativeValueResidual = Math.max(maxRelativeValueResidual, valueResidual / Math.max(Math.abs(exact), 1e-300));
    maxDerivativeResidual = Math.max(maxDerivativeResidual, derivativeResidual);
    maxRelativeDerivativeResidual = Math.max(maxRelativeDerivativeResidual,
      derivativeResidual / Math.max(Math.abs(exactDerivative), 1e-300));
  }
  const valueBound = maxValueResidual * safetyFactor;
  const derivativeBound = maxDerivativeResidual * safetyFactor;
  if (![...coefficients, maxValueResidual, maxRelativeValueResidual, maxDerivativeResidual,
    maxRelativeDerivativeResidual, valueBound, derivativeBound].every(Number.isFinite)) {
    throw new RangeError('fit samples, residuals and derivative bounds must be finite');
  }
  if (Object.keys(source).some(key => generator[key] !== source[key])) {
    throw new TypeError('generator identity or evaluator changed during fitting');
  }
  if (!(valueBound <= valueTolerance)) {
    const error = new RangeError(`held-out residual bound ${valueBound} ${generator.outputUnit} exceeds tolerance ${valueTolerance}`);
    error.code = 'LOCAL_CLOSURE_FIT_RESIDUAL';
    throw error;
  }
  return Object.freeze({
    schema: LOCAL_CLOSURE_FIT_SCHEMA,
    abiVersion: LOCAL_CLOSURE_FIT_ABI_VERSION,
    key: localClosureFitKey({ generator, regimeKey, domain: { lo, hi } }),
    regimeKey: String(regimeKey),
    domain: Object.freeze({ lo, hi, unit: generator.inputUnit }),
    outputUnit: generator.outputUnit,
    provenance: Object.freeze({
      generatorId: generator.id,
      generatorSourceFingerprint: generator.sourceFingerprint,
      sampleCount: n,
      sampling: 'chebyshev-first-kind-nodes',
      heldOutCount,
      heldOutSampling: 'uniform-interior-offset',
      heldOutOffset,
      basis: 'chebyshev',
      degree: n - 1,
      derivedAtMs: started,
      deriveMs: now() - started
    }),
    coefficients: Object.freeze(coefficients),
    residuals: Object.freeze({
      kind: 'held-out-empirical',
      maxValue: maxValueResidual,
      maxRelativeValue: maxRelativeValueResidual,
      maxDerivative: maxDerivativeResidual,
      maxRelativeDerivative: maxRelativeDerivativeResidual,
      safetyFactor,
      valueBound,
      derivativeBound,
      valueUnit: generator.outputUnit,
      derivativeUnit: `${generator.outputUnit}/${generator.inputUnit}`
    })
  });
}

/** Strict in-domain evaluation: never extrapolates. */
export function evaluateLocalClosureFit(fit, x) {
  const { lo, hi } = fit.domain;
  if (!(x >= lo && x <= hi)) return { inDomain: false, value: null, derivative: null };
  const t = (2 * (x - lo)) / (hi - lo) - 1;
  const r = chebyshevEvaluate(fit.coefficients, t);
  return { inDomain: true, value: r.value, derivative: r.derivative / ((hi - lo) / 2) };
}

/**
 * The cache, envelope and schedule-bound adoption for one consumer family.
 * `policy`: 'strict' refuses out-of-domain evaluation until adoption;
 * 'async-exact-fallback' evaluates the exact generator meanwhile and records
 * that debt. `reservationLedger` (G5) makes derive jobs single-flight.
 */
export function createLocalClosureFitCache({ generator, regimeKey, policy = 'async-exact-fallback',
  reservationLedger = null, maxEntries = 64, fitOptions = {} } = {}) {
  requireGenerator(generator);
  if (policy !== 'strict' && policy !== 'async-exact-fallback') throw new TypeError(`unknown policy ${policy}`);
  if (reservationLedger && ['reserve', 'commit', 'cancel', 'retire', 'fence'].some(name => typeof reservationLedger[name] !== 'function')) {
    throw new TypeError('reservationLedger must provide reservation, commit, cancellation and epoch fencing');
  }
  boundedInteger(maxEntries, 'maxEntries', 1, 4096);
  const allowed = new Set(['degree', 'heldOutCount', 'safetyFactor', 'valueTolerance', 'derivativeRelativeStep', 'now']);
  if (!fitOptions || typeof fitOptions !== 'object' || Array.isArray(fitOptions)
    || Reflect.ownKeys(fitOptions).some(key => !allowed.has(key))) {
    throw new TypeError('fitOptions may configure sampling and bounds, not generator, regime or domain');
  }
  fitOptions = Object.freeze({ ...fitOptions });
  regimeKey = fitRegime(regimeKey);
  const entries = new Map();
  const reservations = new Map();
  const log = [];
  let destroyed = false;
  let live = null, pending = null, envelopeExit = null, scheduleOrdinal = 0;
  const debt = { exactFallbackEvaluations: 0, refusedEvaluations: 0, maxOutOfDomainDistance: 0 };
  const counters = { hits: 0, misses: 0, derives: 0, singleFlightLosses: 0, invalidations: 0, adoptions: 0, rejections: 0 };
  const record = (event, extra = {}) => { log.push(Object.freeze({ event, scheduleOrdinal, ...extra })); };
  const assertOpen = () => { if (destroyed) throw new Error('local closure cache is destroyed'); };
  const ownsReservation = token => {
    if (!token || reservationLedger.destroyed) return false;
    const fence = reservationLedger.fence(token.key);
    return fence.epoch === token.epoch && fence.state === 'consumed' && fence.owner === token.owner;
  };
  const fitAdmitted = fit => !reservationLedger || ownsReservation(reservations.get(fit));
  // The bounded map plus at most one live and one pending fit retain ownership.
  // Remove our bookkeeping before external retirement can re-enter the cache.
  const releaseUnusedFits = () => {
    for (const [fit, token] of [...reservations]) {
      if (live === fit || pending === fit || entries.get(fit.key) === fit) continue;
      reservations.delete(fit);
      if (ownsReservation(token)) reservationLedger.retire(token.key, { expectedEpoch: token.epoch });
    }
  };
  const invalidateRevokedFit = fit => {
    if (entries.get(fit.key) === fit) entries.delete(fit.key);
    if (pending === fit) pending = null;
    if (live === fit) { live = null; envelopeExit = null; counters.invalidations += 1; }
    record('reservation-invalidated', { key: fit.key });
    releaseUnusedFits();
  };

  const cache = {
    get live() { return live; },
    get pending() { return pending; },
    get envelopeExit() { return envelopeExit; },
    get scheduleOrdinal() { return scheduleOrdinal; },
    get destroyed() { return destroyed; },
    debt, counters, log,
    /** Derive (or hit) the fit for a domain; the result becomes pending. */
    request(domain) {
      assertOpen();
      domain = fitDomain(domain);
      const key = localClosureFitKey({ generator, regimeKey, domain });
      let fit = entries.get(key) ?? null;
      if (fit && !fitAdmitted(fit)) { invalidateRevokedFit(fit); fit = null; }
      if (fit) { counters.hits += 1; record('cache-hit', { key }); }
      else {
        counters.misses += 1;
        const reservation = reservationLedger?.reserve({ key, consumerId: `${regimeKey}:${scheduleOrdinal}` });
        if (reservation && !reservation.ok) {
          // Another requester owns this derive; wait for its pending result.
          counters.singleFlightLosses += 1;
          record('derive-single-flight-loss', { key, reason: reservation.reason });
          return null;
        }
        try {
          fit = fitLocalClosure({ ...fitOptions, generator, regimeKey, domain });
          if (fit.key !== key || !fitMatchesGenerator(fit, generator, regimeKey)) {
            throw new TypeError('derived fit does not match its original request');
          }
        } catch (error) {
          if (reservation?.ok) reservationLedger.cancel(reservation.token);
          counters.rejections += 1;
          record('derive-rejected', { key, reason: error.message });
          return null;
        }
        if (reservation?.ok) {
          const committed = reservationLedger.commit(reservation.token, { admissionId: key });
          if (!committed?.ok || !ownsReservation(reservation.token)) {
            reservationLedger.cancel(reservation.token);
            counters.rejections += 1;
            record('derive-rejected-reservation', { key, reason: committed?.reason ?? 'revoked-during-commit' });
            return null;
          }
          reservations.set(fit, reservation.token);
        }
        // A ledger callback can change the source or close the cache.
        if (destroyed || !fitMatchesGenerator(fit, generator, regimeKey)) {
          releaseUnusedFits();
          counters.rejections += 1;
          record('derive-rejected', { key, reason: destroyed ? 'destroyed' : 'source-changed-during-commit' });
          return null;
        }
        counters.derives += 1;
        if (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
        entries.set(key, fit);
        record('derived', { key, residualBound: fit.residuals.valueBound, deriveMs: fit.provenance.deriveMs });
      }
      pending = fit;
      releaseUnusedFits();
      if (destroyed || !fitAdmitted(fit) || !fitMatchesGenerator(fit, generator, regimeKey)) {
        invalidateRevokedFit(fit);
        return null;
      }
      return fit;
    },
    /** Schedule boundary: a valid pending fit becomes live; ordinals are recorded. */
    scheduleBoundary() {
      assertOpen();
      scheduleOrdinal += 1;
      if (pending) {
        if (!fitAdmitted(pending)) {
          counters.rejections += 1;
          record('adoption-rejected-reservation', { key: pending.key });
          invalidateRevokedFit(pending);
        } else if (!fitMatchesGenerator(pending, generator, regimeKey)) {
          counters.rejections += 1;
          record('adoption-rejected-stale-source', { key: pending.key });
        } else {
          live = pending;
          counters.adoptions += 1;
          record('adopted', { key: live.key, domain: [live.domain.lo, live.domain.hi] });
          if (envelopeExit && envelopeExit.x >= live.domain.lo && envelopeExit.x <= live.domain.hi) envelopeExit = null;
        }
        pending = null;
      }
      releaseUnusedFits();
      return scheduleOrdinal;
    },
    /** Evaluate at x under the live fit, the envelope and the policy. */
    evaluate(x) {
      assertOpen();
      if (!Number.isFinite(x)) throw new RangeError('evaluation requires a finite coordinate');
      if (live && !fitAdmitted(live)) invalidateRevokedFit(live);
      if (live && !fitMatchesGenerator(live, generator, regimeKey)) cache.sourceChanged(generator);
      if (live && !envelopeExit) {
        const r = evaluateLocalClosureFit(live, x);
        if (r.inDomain) return { ...r, source: 'fit', residualBound: live.residuals.valueBound };
      }
      if (live && !envelopeExit) {
        // First exit: the live fit is invalid for this envelope until a refit is adopted.
        envelopeExit = { x, scheduleOrdinal, key: live.key };
        counters.invalidations += 1;
        record('envelope-exit', { key: live.key, x });
      }
      const distance = live ? Math.max(live.domain.lo - x, x - live.domain.hi, 0) : 0;
      debt.maxOutOfDomainDistance = Math.max(debt.maxOutOfDomainDistance, distance);
      if (policy === 'strict') {
        debt.refusedEvaluations += 1;
        return { inDomain: false, value: null, derivative: null, source: 'refused' };
      }
      debt.exactFallbackEvaluations += 1;
      return { inDomain: live ? evaluateLocalClosureFit(live, x).inDomain : false, value: generator.evaluate(x),
        derivative: null, source: 'exact-fallback' };
    },
    /** Source change: every cached entry of an old fingerprint is dropped; a stale live fit is retired. */
    sourceChanged(nextGenerator) {
      assertOpen();
      requireGenerator(nextGenerator);
      generator = nextGenerator;
      let dropped = 0;
      for (const [key, fit] of entries) {
        if (!fitMatchesGenerator(fit, generator, regimeKey)) { entries.delete(key); dropped += 1; }
      }
      if (live && !fitMatchesGenerator(live, generator, regimeKey)) {
        record('live-invalidated-source-change', { key: live.key });
        live = null;
        envelopeExit = null;
        counters.invalidations += 1;
      }
      record('source-changed', { dropped, source: generator.sourceFingerprint });
      releaseUnusedFits();
      return dropped;
    },
    /** Release this cache's retained reservations without closing the shared ledger. */
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      entries.clear();
      live = null;
      pending = null;
      envelopeExit = null;
      releaseUnusedFits();
      record('destroyed');
      return true;
    }
  };
  return cache;
}

// Material source data is finite scalars, dense arrays and plain data objects.
// Reject shared/binary storage, custom prototypes, accessors and cycles rather
// than sharing mutable data or losing it in JSON.stringify (e.g. Map -> {}).
function snapshotClosureProperties(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return { snapshot: value, signature: JSON.stringify(value) };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { snapshot: value, signature: Object.is(value, -0) ? '-0' : String(value) };
  }
  if (!value || typeof value !== 'object' || ancestors.has(value)
    || (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))) {
    throw new TypeError('closure properties require finite canonical data without shared storage or cycles');
  }
  ancestors.add(value);
  const array = Array.isArray(value);
  const keys = Reflect.ownKeys(value).filter(key => !(array && key === 'length'));
  if (keys.some(key => typeof key !== 'string') || (array && keys.length !== value.length)) {
    throw new TypeError('closure properties require dense arrays and string data keys');
  }
  const ordered = array ? Array.from({ length: value.length }, (_, i) => String(i)) : keys.sort();
  const rows = ordered.map(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw new TypeError('closure properties require enumerable data fields, not accessors');
    }
    return [key, snapshotClosureProperties(descriptor.value, ancestors)];
  });
  ancestors.delete(value);
  return {
    snapshot: Object.freeze(array ? rows.map(([, row]) => row.snapshot)
      : Object.fromEntries(rows.map(([key, row]) => [key, row.snapshot]))),
    signature: array ? `[${rows.map(([, row]) => row.signature).join(',')}]`
      : `{${rows.map(([key, row]) => `${JSON.stringify(key)}:${row.signature}`).join(',')}}`
  };
}

/** The exact caloric closure u(T) of one material as a fit generator. */
export function caloricClosureGenerator({ materialKey, properties, specificInternalEnergyJPerKg }) {
  if (typeof specificInternalEnergyJPerKg !== 'function') throw new TypeError('caloric generator requires an evaluator');
  const { snapshot, signature } = snapshotClosureProperties(properties);
  // The evaluator contract is pure in (properties, temperature). Its source is
  // part of the binding; replacing the method must invalidate the same data.
  const source = JSON.stringify({ properties: signature,
    evaluator: Function.prototype.toString.call(specificInternalEnergyJPerKg) });
  return Object.freeze({
    id: `thermoState.specificInternalEnergyJPerKg:${materialKey}`,
    inputUnit: 'K',
    outputUnit: 'J/kg',
    sourceFingerprint: schroederAuthorityTextFingerprint(source, 'caloric-generator-source'),
    evaluate: (temperatureK) => specificInternalEnergyJPerKg(snapshot, temperatureK)
  });
}

// ------------------------------------------------------------------ A4
// Multidimensional response functions (A4, seven-goal-campaign.md): tensor
// Chebyshev fits over explicit axes with units and a validity box.
//
// - The generator declares its axes ({ name, unit }), its output unit, a
//   source fingerprint, evaluate(xs) and regimeOf(xs) (a phase/domain label).
//   A validity box that spans more than one regime is refused: a fit never
//   crosses a phase or domain transition.
// - Residuals are measured separately on held-out interior points and on
//   held-out boundary (face) points.
// - Declared signs of partial derivatives (physical order, e.g. density
//   falls with temperature and rises with pressure) are checked on the
//   held-out points; a fit that violates them is refused.
// - Evaluation is strict: outside the box, or in another regime, it returns
//   no value; a source fingerprint change makes the artifact stale.
export const RESPONSE_FUNCTION_SCHEMA = 'peercompute.ulg.response-function.v1';

function tensorChebyshev(values, degrees) {
  // values: f at the tensor grid of Chebyshev nodes (row-major over axes).
  const dims = degrees.map(d => d + 1);
  let coefficients = Float64Array.from(values);
  for (let axis = 0; axis < dims.length; axis++) {
    const n = dims[axis];
    const stride = dims.slice(axis + 1).reduce((a, b) => a * b, 1);
    const outer = coefficients.length / (n * stride);
    const next = new Float64Array(coefficients.length);
    for (let o = 0; o < outer; o++) for (let s = 0; s < stride; s++) {
      const line = Array.from({ length: n }, (_, k) => coefficients[(o * n + k) * stride + s]);
      const c = chebyshevCoefficients(line);
      for (let j = 0; j < n; j++) next[(o * n + j) * stride + s] = c[j];
    }
    coefficients = next;
  }
  return coefficients;
}

function tensorEvaluate(coefficients, degrees, ts) {
  // Contract one axis at a time with Clenshaw (value) and the derivative series.
  const dims = degrees.map(d => d + 1);
  const valueGrad = (axisValues) => {
    let current = Array.from(coefficients);
    let currentDims = [...dims];
    const partials = [];
    // Value: contract all axes with T_j(t).
    for (let axis = 0; axis < dims.length; axis++) {
      const n = currentDims[0];
      const stride = current.length / n;
      const next = new Array(stride).fill(0);
      for (let s = 0; s < stride; s++) {
        next[s] = chebyshevEvaluate(Array.from({ length: n }, (_, k) => current[k * stride + s]), axisValues[axis]).value;
      }
      current = next; currentDims = currentDims.slice(1);
    }
    return current[0];
  };
  const value = valueGrad(ts);
  const gradient = ts.map((t, axis) => {
    // Derivative along `axis`: contract that axis with the derivative series.
    let current = Array.from(coefficients);
    let currentDims = [...dims];
    for (let a = 0; a < dims.length; a++) {
      const n = currentDims[0];
      const stride = current.length / n;
      const next = new Array(stride).fill(0);
      for (let s = 0; s < stride; s++) {
        const line = Array.from({ length: n }, (_, k) => current[k * stride + s]);
        const r = chebyshevEvaluate(line, ts[a]);
        next[s] = a === axis ? r.derivative : r.value;
      }
      current = next; currentDims = currentDims.slice(1);
    }
    return current[0];
  });
  return { value, gradient };
}

function requireResponseGenerator(generator) {
  if (typeof generator?.evaluate !== 'function' || typeof generator.regimeOf !== 'function'
    || !Array.isArray(generator.axes) || !generator.axes.length
    || generator.axes.some(a => typeof a?.name !== 'string' || typeof a?.unit !== 'string')
    || typeof generator.outputUnit !== 'string' || typeof generator.sourceFingerprint !== 'string'
    || typeof generator.id !== 'string') {
    throw new TypeError('A response generator needs id, axes [{name, unit}], outputUnit, sourceFingerprint, evaluate(xs), regimeOf(xs)');
  }
  return generator;
}

/**
 * Fit a response function over `box` ([[lo, hi], ...] per axis). Throws (code
 * RESPONSE_FUNCTION_REFUSED) when the box spans regimes, the residual bound
 * exceeds `relativeTolerance`, or a declared derivative sign is violated.
 */
export function fitResponseFunction({ generator, box, degrees, signs = null, relativeTolerance = 1e-6,
  heldOutPerAxis = 9, safetyFactor = 2, now = () => Date.now() } = {}) {
  requireResponseGenerator(generator);
  const axes = generator.axes;
  if (!Array.isArray(box) || box.length !== axes.length || box.some(([lo, hi]) => !(hi > lo))) {
    throw new RangeError('box needs [lo, hi] with lo < hi for every axis');
  }
  const refuse = (reason) => { const e = new RangeError(reason); e.code = 'RESPONSE_FUNCTION_REFUSED'; throw e; };
  const started = now();
  const toX = (ts) => ts.map((t, a) => box[a][0] + (t + 1) * (box[a][1] - box[a][0]) / 2);
  const nodes = degrees.map(d => chebyshevNodes(d + 1));
  // Tensor grid, row-major over axes.
  const grid = [];
  const walk = (axis, prefix) => {
    if (axis === axes.length) { grid.push(prefix); return; }
    for (const t of nodes[axis]) walk(axis + 1, [...prefix, t]);
  };
  walk(0, []);
  const regime = generator.regimeOf(toX(grid[0]));
  const values = grid.map((ts) => {
    const xs = toX(ts);
    if (generator.regimeOf(xs) !== regime) refuse(`validity box spans regimes (${regime} / ${generator.regimeOf(xs)})`);
    const f = generator.evaluate(xs);
    if (!Number.isFinite(f)) refuse('generator returned a non-finite sample');
    return f;
  });
  const coefficients = tensorChebyshev(values, degrees);
  // Held-out points: an interior lattice offset from every node, and the box faces.
  const interior = [], boundary = [];
  const lattice = Array.from({ length: heldOutPerAxis }, (_, i) => -1 + 2 * (i + 0.5) / heldOutPerAxis);
  const walkHeld = (axis, prefix) => {
    if (axis === axes.length) { interior.push(prefix); return; }
    for (const t of lattice) walkHeld(axis + 1, [...prefix, t]);
  };
  walkHeld(0, []);
  for (let axis = 0; axis < axes.length; axis++) for (const face of [-1, 1]) {
    for (const p of interior) { const q = [...p]; q[axis] = face; boundary.push(q); }
  }
  const measure = (points) => {
    let maxAbs = 0, maxRel = 0;
    for (const ts of points) {
      const xs = toX(ts);
      if (generator.regimeOf(xs) !== regime) refuse('held-out point in another regime');
      const exact = generator.evaluate(xs);
      const fit = tensorEvaluate(coefficients, degrees, ts);
      const err = Math.abs(fit.value - exact);
      maxAbs = Math.max(maxAbs, err);
      maxRel = Math.max(maxRel, err / Math.max(Math.abs(exact), 1e-300));
      if (signs) fit.gradient.forEach((g, a) => {
        if (signs[a] && Math.sign(g) !== signs[a]) refuse(`declared sign of d/d${axes[a].name} violated`);
      });
    }
    return { maxAbs, maxRel };
  };
  const interiorResidual = measure(interior), boundaryResidual = measure(boundary);
  const relativeBound = Math.max(interiorResidual.maxRel, boundaryResidual.maxRel) * safetyFactor;
  if (!(relativeBound <= relativeTolerance)) refuse(`relative residual bound ${relativeBound} exceeds ${relativeTolerance}`);
  return Object.freeze({
    schema: RESPONSE_FUNCTION_SCHEMA,
    abiVersion: LOCAL_CLOSURE_FIT_ABI_VERSION,
    axes: Object.freeze(axes.map((axis, a) => Object.freeze({ ...axis, lo: box[a][0], hi: box[a][1], degree: degrees[a] }))),
    outputUnit: generator.outputUnit,
    regime,
    signs: signs ? Object.freeze([...signs]) : null,
    provenance: Object.freeze({ generatorId: generator.id, generatorSourceFingerprint: generator.sourceFingerprint,
      sampling: 'tensor-chebyshev-first-kind-nodes', sampleCount: grid.length,
      heldOut: { interior: interior.length, boundary: boundary.length }, derivedAtMs: started, deriveMs: now() - started }),
    coefficients: Object.freeze(Array.from(coefficients)),
    residuals: Object.freeze({ kind: 'held-out-empirical', interior: interiorResidual, boundary: boundaryResidual,
      safetyFactor, relativeBound })
  });
}

/** Strict evaluation: in the box, in the fitted regime, against a live source. */
export function evaluateResponseFunction(fn, xs, { generator = null } = {}) {
  if (generator && generator.sourceFingerprint !== fn.provenance.generatorSourceFingerprint) {
    return { ok: false, reason: 'stale-source', value: null };
  }
  if (xs.some((x, a) => !(x >= fn.axes[a].lo && x <= fn.axes[a].hi))) return { ok: false, reason: 'out-of-domain', value: null };
  if (generator && generator.regimeOf(xs) !== fn.regime) return { ok: false, reason: 'regime-transition', value: null };
  const ts = xs.map((x, a) => (2 * (x - fn.axes[a].lo)) / (fn.axes[a].hi - fn.axes[a].lo) - 1);
  const r = tensorEvaluate(fn.coefficients, fn.axes.map(a => a.degree), ts);
  return { ok: true, value: r.value, gradient: r.gradient.map((g, a) => g * 2 / (fn.axes[a].hi - fn.axes[a].lo)),
    relativeBound: fn.residuals.relativeBound };
}
