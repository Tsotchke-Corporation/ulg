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

function fnv1aHex64(input) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= (c + i) & 0xff;
    h2 = Math.imul(h2, 0x27d4eb2d) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

function canonicalizeHomogeneitySpec(homogeneityTest) {
  if (homogeneityTest == null) return null;
  if (typeof homogeneityTest === 'function') {
    return Object.freeze({
      kind: 'predicate-fn',
      fn: homogeneityTest,
      signature: String(homogeneityTest.name || 'anonymous')
    });
  }
  if (typeof homogeneityTest !== 'object' || Array.isArray(homogeneityTest)) {
    throw new RangeError('envelope.homogeneityTest must be a predicate function or declarative bounds object');
  }
  const normalized = {};
  const numericBounds = [
    'maxTemperatureVarianceK2',
    'maxTemperatureSpanK',
    'maxTemperatureGradientKPerM',
    'maxDensityVarianceKg2M6',
    'maxRelativeDensitySpan',
    'maxPhaseFractionSpread',
    'maxPlasticStrain',
    'maxStrainRatePerS',
    'maxJensenResidual'
  ];
  for (const key of numericBounds) {
    if (homogeneityTest[key] != null) {
      const limit = FINITE(homogeneityTest[key], `homogeneityTest.${key}`);
      if (limit < 0) throw new RangeError(`homogeneityTest.${key} must be non-negative`);
      normalized[key] = limit;
    }
  }
  if (homogeneityTest.requiredPhase != null) {
    const phase = String(homogeneityTest.requiredPhase).trim().toLowerCase();
    if (!phase) throw new RangeError('homogeneityTest.requiredPhase must be non-empty');
    normalized.requiredPhase = phase;
  }
  if (Array.isArray(homogeneityTest.requiredFields)) {
    normalized.requiredFields = Object.freeze(
      homogeneityTest.requiredFields.map((f) => String(f).trim()).filter(Boolean).sort()
    );
  }
  if (typeof homogeneityTest.predicate === 'function') {
    normalized.predicate = homogeneityTest.predicate;
  }
  return Object.freeze(normalized);
}

/**
 * Canonical digest of an exact continuous validity envelope + homogeneity spec.
 * Bound into closureInvalidationKey so quantized routing-bucket hits can never
 * bypass incompatible exact domains or changed homogeneity requirements.
 */
export function canonicalClosureDomainHash(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    throw new RangeError('canonicalClosureDomainHash requires an envelope object');
  }
  const fmtRange = (r) => (r == null ? 'none' : `${Number(r[0]).toPrecision(12)}..${Number(r[1]).toPrecision(12)}`);
  const h = envelope.homogeneityTest;
  const hDesc = h == null
    ? 'none'
    : typeof h === 'function'
      ? `fn:${h.name || 'anon'}:${fnv1aHex64(String(h))}`
      : Object.keys(h)
          .filter((k) => k !== 'predicate' && k !== 'fn')
          .sort()
          .map((k) => `${k}=${Array.isArray(h[k]) ? h[k].join(',') : String(h[k])}`)
          .join(';');
  const canonical = [
    `T:${fmtRange(envelope.temperatureRangeK)}`,
    `P:${fmtRange(envelope.pressureRangePa)}`,
    `rho:${fmtRange(envelope.densityRangeKgM3)}`,
    `phase:${envelope.phase ?? 'any'}`,
    `structure:${envelope.structure ?? 'any'}`,
    `homog:${hDesc}`
  ].join('|');
  return `dom:${fnv1aHex64(canonical)}`;
}

function evaluateHomogeneityAdmission(homogeneitySpec, state, envelope) {
  if (homogeneitySpec == null) return { admitted: true, reason: null };
  if (typeof homogeneitySpec === 'function') {
    try {
      const res = homogeneitySpec(state, envelope);
      if (res === true) return { admitted: true, reason: null };
      if (res && typeof res === 'object' && res.admitted === true) return { admitted: true, reason: null };
      return {
        admitted: false,
        reason: (res && typeof res === 'object' && res.reason) || 'homogeneity-predicate-rejected',
        detail: res && typeof res === 'object' ? res : null
      };
    } catch (error) {
      return {
        admitted: false,
        reason: 'homogeneity-predicate-error',
        detail: error instanceof Error ? error.message : String(error)
      };
    }
  }
  if (homogeneitySpec.kind === 'predicate-fn' && typeof homogeneitySpec.fn === 'function') {
    return evaluateHomogeneityAdmission(homogeneitySpec.fn, state, envelope);
  }
  // Declarative distribution-aware homogeneity bounds: missing or non-finite
  // constituent summaries fail CLOSED (never treated as wildcard!).
  const stats = state?.homogeneity ?? state ?? {};
  if (Array.isArray(homogeneitySpec.requiredFields)) {
    for (const field of homogeneitySpec.requiredFields) {
      const value = Number(stats?.[field] ?? state?.[field]);
      if (!Number.isFinite(value)) {
        return { admitted: false, reason: `homogeneity-missing-${field}`, field };
      }
    }
  }
  if (homogeneitySpec.requiredPhase != null) {
    const actualPhase = String(stats?.phase ?? state?.phase ?? '').trim().toLowerCase();
    if (!actualPhase) {
      return { admitted: false, reason: 'homogeneity-missing-phase', field: 'phase' };
    }
    if (actualPhase !== homogeneitySpec.requiredPhase) {
      return {
        admitted: false,
        reason: 'homogeneity-phase-mismatch',
        field: 'phase',
        value: actualPhase,
        expected: homogeneitySpec.requiredPhase
      };
    }
  }
  const boundChecks = [
    ['maxTemperatureVarianceK2', 'temperatureVarianceK2'],
    ['maxTemperatureSpanK', 'temperatureSpanK'],
    ['maxTemperatureGradientKPerM', 'temperatureGradientKPerM'],
    ['maxDensityVarianceKg2M6', 'densityVarianceKg2M6'],
    ['maxRelativeDensitySpan', 'relativeDensitySpan'],
    ['maxPhaseFractionSpread', 'phaseFractionSpread'],
    ['maxPlasticStrain', 'plasticStrain'],
    ['maxStrainRatePerS', 'strainRatePerS'],
    ['maxJensenResidual', 'jensenResidual']
  ];
  for (const [limitKey, stateField] of boundChecks) {
    if (homogeneitySpec[limitKey] == null) continue;
    const raw = stats?.[stateField] ?? state?.[stateField];
    const value = Number(raw);
    if (raw == null || !Number.isFinite(value) || value < 0) {
      return {
        admitted: false,
        reason: `homogeneity-missing-${stateField}`,
        field: stateField,
        limit: homogeneitySpec[limitKey]
      };
    }
    if (value > homogeneitySpec[limitKey]) {
      return {
        admitted: false,
        reason: `homogeneity-exceeded-${stateField}`,
        field: stateField,
        value,
        limit: homogeneitySpec[limitKey]
      };
    }
  }
  if (typeof homogeneitySpec.predicate === 'function') {
    return evaluateHomogeneityAdmission(homogeneitySpec.predicate, state, envelope);
  }
  return { admitted: true, reason: null };
}

/**
 * The validity envelope: exact continuous bounds and distribution-aware
 * homogeneity predicates a query state must satisfy for the closure to apply.
 * Distinct from the quantized routing key.
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
    const raw = state?.[field];
    const value = Number(raw);
    if (raw == null || !Number.isFinite(value)) {
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
  if (envelope.homogeneityTest != null) {
    const homog = evaluateHomogeneityAdmission(envelope.homogeneityTest, state, envelope);
    if (!homog.admitted) return homog;
  }
  return { admitted: true, reason: null };
}

/**
 * Full invalidation key per the Cache Layering Rule: input hash, method
 * hash, validity domain hash, schema version, ABI, validation status. Records
 * whose invalidation fields or exact validity domains differ are different
 * records even in the same quantized regime bucket.
 */
export function closureInvalidationKey({
  inputHash,
  methodHash,
  domainHash = null,
  envelope = null,
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
  const resolvedDomainHash = domainHash != null && String(domainHash).trim()
    ? String(domainHash).trim()
    : (envelope ? canonicalClosureDomainHash(envelope) : null);
  return resolvedDomainHash
    ? `${inputHash}|${methodHash}|${resolvedDomainHash}|${schemaVersion}|${abiVersion}|${validationStatus}`
    : `${inputHash}|${methodHash}|${schemaVersion}|${abiVersion}|${validationStatus}`;
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
    const normalizedEnvelope = Object.freeze({
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
      phase: envelope.phase ?? null,
      structure: envelope.structure ?? null,
      homogeneityTest: canonicalizeHomogeneitySpec(envelope.homogeneityTest ?? null)
    });
    const domainHash = invalidation?.domainHash
      ? String(invalidation.domainHash).trim()
      : canonicalClosureDomainHash(normalizedEnvelope);
    const invalidationKey = closureInvalidationKey({
      ...invalidation,
      domainHash
    });
    recordOrdinal += 1;
    const record = Object.freeze({
      schema: ULG_CLOSURE_REGIME_RECORD_SCHEMA,
      ordinal: recordOrdinal,
      regimeId: regimeKey.id,
      regimeKey,
      envelope: normalizedEnvelope,
      domainHash,
      artifact,
      provenance: Object.freeze({ ...provenance, kind }),
      invalidation: Object.freeze({ ...invalidation, domainHash }),
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
