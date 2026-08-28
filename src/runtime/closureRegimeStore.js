// Regime-keyed closure store — the spine of the adaptive-laws closure
// economy (plan/todo/scale-adaptive-law-activation-plan.md, Phase E).
//
// A closure here is a derived response artifact (table, fit, sampled law
// result) valid inside a declared regime envelope. Closures are keyed by
// REGIME — a canonicalized statistical state — never by scenario or run, so
// a derivation from one run serves every future region, in any run, that
// lands inside the envelope. The store follows the Cache Layering Rule
// (plan/todo/README.md:3019-3030): this module is the warm in-memory tier
// plus the invalidation-key discipline; cold content-addressed persistence
// hangs off the same record shape.
//
// Epistemic rules (load-bearing, from the spec and ss-regression.md):
// - a closure without a validity envelope is invalid by default;
// - every record carries provenance and a validation status, and lookups
//   NEVER promote a cached result beyond WARN — consumers see
//   servedFromCache: true with validationStatus preserved, and it is the
//   consumer's receipt that must surface the WARN;
// - imported/derived closures are never labelled emergent (provenance.kind
//   states exactly what produced them);
// - envelope exit is the demand signal (the cache miss IS the trigger):
//   lookupClosure reports { hit: false, reason } with the nearest record so
//   the caller can extrapolate under a declared debt while a derivation
//   runs (strict/async/frozen policy is the caller's law contract, not the
//   store's concern).

export const ULG_CLOSURE_REGIME_STORE_SCHEMA =
  'peercompute.ulg.closure-regime-store.v0';
export const ULG_CLOSURE_REGIME_RECORD_SCHEMA =
  'peercompute.ulg.closure-regime-record.v0';
export const ULG_CLOSURE_REGIME_KEY_SCHEMA =
  'peercompute.ulg.closure-regime-key.v0';

// Validation statuses order by trust; cached service can only ever move
// DOWN this ladder, never up.
export const CLOSURE_VALIDATION_STATUS = Object.freeze({
  VALIDATED: 'validated',
  WARN: 'warn-unvalidated',
  REJECTED: 'rejected'
});

const FINITE = (value, label) => {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new RangeError(`${label} must be finite, got ${value}`);
  }
  return n;
};

function canonicalComposition(composition) {
  if (!composition || typeof composition !== 'object') {
    throw new RangeError('regime composition is required (materialKey -> fraction)');
  }
  const entries = Object.entries(composition)
    .map(([key, fraction]) => [
      String(key).trim().toLowerCase(),
      FINITE(fraction, `composition[${key}]`)
    ])
    .filter(([, fraction]) => fraction > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (entries.length === 0) {
    throw new RangeError('regime composition must name at least one material');
  }
  const total = entries.reduce((sum, [, fraction]) => sum + fraction, 0);
  return entries.map(([key, fraction]) => [key, fraction / total]);
}

function canonicalRange([lo, hi], label) {
  const a = FINITE(lo, `${label}[0]`);
  const b = FINITE(hi, `${label}[1]`);
  if (!(a <= b)) throw new RangeError(`${label} must be an ordered range`);
  return [a, b];
}

/**
 * Canonicalize a regime description into a stable key object + string id.
 * The KEY quantizes each range endpoint onto a logarithmic lattice
 * (decades split into `latticePerDecade` bins) so nearby derivations share
 * a bucket; the RECORD keeps the exact envelope for admission tests, so
 * quantization affects lookup routing only, never validity.
 */
export function canonicalizeClosureRegimeKey({
  lawId,
  composition,
  temperatureRangeK,
  pressureRangePa = null,
  densityRangeKgM3 = null,
  ensemble = 'classical-equilibrium',
  chartClass = 'uniform-cartesian',
  latticePerDecade = 8
} = {}) {
  const law = String(lawId ?? '').trim();
  if (!law) throw new RangeError('lawId is required for a regime key');
  const comp = canonicalComposition(composition);
  const tK = canonicalRange(temperatureRangeK, 'temperatureRangeK');
  const pPa = pressureRangePa == null
    ? null
    : canonicalRange(pressureRangePa, 'pressureRangePa');
  const rho = densityRangeKgM3 == null
    ? null
    : canonicalRange(densityRangeKgM3, 'densityRangeKgM3');
  const lattice = Math.max(1, Math.round(Number(latticePerDecade) || 8));
  const bin = (value) => {
    if (value === 0) return 'z';
    const sign = value < 0 ? 'n' : 'p';
    const magnitude = Math.log10(Math.abs(value));
    return `${sign}${Math.round(magnitude * lattice)}`;
  };
  const binRange = (range) => (range == null
    ? 'none'
    : `${bin(range[0])}..${bin(range[1])}`);
  const id = [
    'regime',
    law,
    comp.map(([key, fraction]) => `${key}:${fraction.toFixed(4)}`).join(','),
    `T:${binRange(tK)}`,
    `P:${binRange(pPa)}`,
    `rho:${binRange(rho)}`,
    `ens:${String(ensemble).trim().toLowerCase()}`,
    `chart:${String(chartClass).trim().toLowerCase()}`
  ].join('|');
  return Object.freeze({
    schema: ULG_CLOSURE_REGIME_KEY_SCHEMA,
    id,
    lawId: law,
    composition: Object.freeze(comp.map((entry) => Object.freeze([...entry]))),
    temperatureRangeK: Object.freeze(tK),
    pressureRangePa: pPa ? Object.freeze(pPa) : null,
    densityRangeKgM3: rho ? Object.freeze(rho) : null,
    ensemble: String(ensemble).trim().toLowerCase(),
    chartClass: String(chartClass).trim().toLowerCase(),
    latticePerDecade: lattice
  });
}

function inRange(value, range) {
  return range == null || (value >= range[0] && value <= range[1]);
}

/**
 * The validity envelope: exact continuous bounds a query state must satisfy
 * for the closure to apply. Distinct from the quantized routing key.
 */
export function closureEnvelopeAdmits(envelope, state) {
  if (!envelope) return { admitted: false, reason: 'missing-envelope' };
  const checks = [
    ['temperatureK', envelope.temperatureRangeK],
    ['pressurePa', envelope.pressureRangePa],
    ['densityKgM3', envelope.densityRangeKgM3]
  ];
  for (const [field, range] of checks) {
    if (range == null) continue;
    const value = Number(state?.[field]);
    if (!Number.isFinite(value)) {
      return { admitted: false, reason: `query-missing-${field}` };
    }
    if (!inRange(value, range)) {
      return {
        admitted: false,
        reason: `envelope-exit-${field}`,
        field,
        value,
        range: [...range]
      };
    }
  }
  return { admitted: true, reason: null };
}

/**
 * Full invalidation key per the Cache Layering Rule: input hash, method
 * hash, validity domain, schema version, ABI, validation status. Records
 * whose invalidation fields differ are different records even in the same
 * regime bucket.
 */
export function closureInvalidationKey({
  inputHash,
  methodHash,
  schemaVersion,
  abiVersion,
  validationStatus
}) {
  for (const [label, value] of [
    ['inputHash', inputHash],
    ['methodHash', methodHash],
    ['schemaVersion', schemaVersion],
    ['abiVersion', abiVersion]
  ]) {
    if (!String(value ?? '').trim()) {
      throw new RangeError(`closure invalidation key requires ${label}`);
    }
  }
  if (!Object.values(CLOSURE_VALIDATION_STATUS).includes(validationStatus)) {
    throw new RangeError(
      `validationStatus must be one of ${Object.values(CLOSURE_VALIDATION_STATUS).join(', ')}`
    );
  }
  return `${inputHash}|${methodHash}|${schemaVersion}|${abiVersion}|${validationStatus}`;
}

export function createClosureRegimeStore({ label = 'ulg-closure-regime-store' } = {}) {
  const byRegimeId = new Map();
  let recordOrdinal = 0;

  function registerClosure({
    regimeKey,
    envelope,
    artifact,
    provenance,
    invalidation,
    supersedes = null
  }) {
    if (regimeKey?.schema !== ULG_CLOSURE_REGIME_KEY_SCHEMA) {
      throw new RangeError('regimeKey must come from canonicalizeClosureRegimeKey');
    }
    if (!envelope || envelope.temperatureRangeK == null) {
      throw new RangeError('a closure without a validity envelope is invalid by default');
    }
    const kind = String(provenance?.kind ?? '').trim();
    if (!kind) {
      throw new RangeError(
        'provenance.kind is required (e.g. derived-sampled-law, derived-substrate-descent, imported-reference); derived closures are never labelled emergent'
      );
    }
    if (kind === 'emergent') {
      throw new RangeError('closures are never labelled emergent (spec hard rule 1)');
    }
    const invalidationKey = closureInvalidationKey(invalidation);
    recordOrdinal += 1;
    const record = Object.freeze({
      schema: ULG_CLOSURE_REGIME_RECORD_SCHEMA,
      ordinal: recordOrdinal,
      regimeId: regimeKey.id,
      regimeKey,
      envelope: Object.freeze({
        temperatureRangeK: Object.freeze(canonicalRange(
          envelope.temperatureRangeK, 'envelope.temperatureRangeK'
        )),
        pressureRangePa: envelope.pressureRangePa == null
          ? null
          : Object.freeze(canonicalRange(
            envelope.pressureRangePa, 'envelope.pressureRangePa'
          )),
        densityRangeKgM3: envelope.densityRangeKgM3 == null
          ? null
          : Object.freeze(canonicalRange(
            envelope.densityRangeKgM3, 'envelope.densityRangeKgM3'
          )),
        homogeneityTest: envelope.homogeneityTest ?? null
      }),
      artifact,
      provenance: Object.freeze({ ...provenance, kind }),
      invalidation: Object.freeze({ ...invalidation }),
      invalidationKey,
      supersedes,
      registeredOrdinal: recordOrdinal,
      scientificValidation: false,
      fullPhysicsValidation: false
    });
    const bucket = byRegimeId.get(regimeKey.id) ?? [];
    bucket.push(record);
    byRegimeId.set(regimeKey.id, bucket);
    return record;
  }

  /**
   * Look up a closure for a query state. A hit still reports
   * servedFromCache: true and the record's validationStatus untouched —
   * consumers must surface cached physics as WARN-class evidence, never
   * silently as PASS. A miss reports the reason (no-regime-record vs a
   * specific envelope exit) plus the nearest record so the caller can
   * clamp/extrapolate under declared debt while deriving.
   */
  function lookupClosure({ regimeKey, state }) {
    const bucket = byRegimeId.get(regimeKey?.id) ?? [];
    let nearest = null;
    for (let index = bucket.length - 1; index >= 0; index -= 1) {
      const record = bucket[index];
      if (record.invalidation.validationStatus === CLOSURE_VALIDATION_STATUS.REJECTED) {
        continue;
      }
      const admission = closureEnvelopeAdmits(record.envelope, state);
      if (admission.admitted) {
        return {
          hit: true,
          record,
          servedFromCache: true,
          validationStatus: record.invalidation.validationStatus,
          admission
        };
      }
      nearest = nearest ?? { record, admission };
    }
    return {
      hit: false,
      record: null,
      servedFromCache: false,
      reason: nearest ? nearest.admission.reason : 'no-regime-record',
      nearest,
      // The miss IS the demand signal: callers route this to their law's
      // fallback policy (strict stall / async derive with debt / frozen
      // clamp) and, in async mode, adopt the derived record only at a
      // schedule boundary with the adoption ordinal receipted.
      derivationRequested: true
    };
  }

  function records() {
    return [...byRegimeId.values()].flat();
  }

  return Object.freeze({
    schema: ULG_CLOSURE_REGIME_STORE_SCHEMA,
    label,
    registerClosure,
    lookupClosure,
    records,
    regimeCount: () => byRegimeId.size
  });
}
