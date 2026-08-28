import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOSURE_VALIDATION_STATUS,
  canonicalizeClosureRegimeKey,
  closureEnvelopeAdmits,
  closureInvalidationKey,
  createClosureRegimeStore,
  ULG_CLOSURE_REGIME_KEY_SCHEMA,
  ULG_CLOSURE_REGIME_RECORD_SCHEMA
} from '../src/runtime/closureRegimeStore.js';

const REGIME = () => canonicalizeClosureRegimeKey({
  lawId: 'thermal-eos',
  composition: { H2O: 1 },
  temperatureRangeK: [270, 380],
  pressureRangePa: [1e4, 1e6],
  densityRangeKgM3: [900, 1100]
});

const INVALIDATION = (over = {}) => ({
  inputHash: 'sha256:input',
  methodHash: 'sha256:debye-v3',
  schemaVersion: 'closure.v0',
  abiVersion: 'gpu-abi-v9',
  validationStatus: CLOSURE_VALIDATION_STATUS.WARN,
  ...over
});

const ENVELOPE = {
  temperatureRangeK: [273, 373],
  pressureRangePa: [5e4, 2e5],
  densityRangeKgM3: [950, 1050]
};

test('regime keys canonicalize composition order, normalization, and lattice bins', () => {
  const a = canonicalizeClosureRegimeKey({
    lawId: 'thermal-eos',
    composition: { h2o: 2, NaOH: 1 },
    temperatureRangeK: [280, 320]
  });
  const b = canonicalizeClosureRegimeKey({
    lawId: 'thermal-eos',
    composition: { naoh: 0.5, H2O: 1.0 },
    temperatureRangeK: [281, 322]
  });
  assert.equal(a.schema, ULG_CLOSURE_REGIME_KEY_SCHEMA);
  // Same normalized composition, same log-lattice temperature bins -> the
  // derivations share one routing bucket across runs.
  assert.equal(a.id, b.id);
  assert.deepEqual(a.composition.map(([key]) => key), ['h2o', 'naoh']);
  const total = a.composition.reduce((sum, [, fraction]) => sum + fraction, 0);
  assert.ok(Math.abs(total - 1) < 1e-12);
  // A regime an order of magnitude away routes elsewhere.
  const far = canonicalizeClosureRegimeKey({
    lawId: 'thermal-eos',
    composition: { h2o: 2, NaOH: 1 },
    temperatureRangeK: [2800, 3200]
  });
  assert.notEqual(a.id, far.id);
});

test('a closure without a validity envelope is invalid by default', () => {
  const store = createClosureRegimeStore();
  assert.throws(() => store.registerClosure({
    regimeKey: REGIME(),
    envelope: null,
    artifact: { kind: 'table' },
    provenance: { kind: 'derived-sampled-law' },
    invalidation: INVALIDATION()
  }), /invalid by default/);
});

test('closures are never labelled emergent and always carry provenance', () => {
  const store = createClosureRegimeStore();
  assert.throws(() => store.registerClosure({
    regimeKey: REGIME(),
    envelope: ENVELOPE,
    artifact: {},
    provenance: {},
    invalidation: INVALIDATION()
  }), /provenance.kind is required/);
  assert.throws(() => store.registerClosure({
    regimeKey: REGIME(),
    envelope: ENVELOPE,
    artifact: {},
    provenance: { kind: 'emergent' },
    invalidation: INVALIDATION()
  }), /never labelled emergent/);
});

test('invalidation key requires every Cache Layering Rule field', () => {
  for (const missing of ['inputHash', 'methodHash', 'schemaVersion', 'abiVersion']) {
    assert.throws(
      () => closureInvalidationKey(INVALIDATION({ [missing]: '' })),
      new RegExp(missing)
    );
  }
  assert.throws(
    () => closureInvalidationKey(INVALIDATION({ validationStatus: 'pass' })),
    /validationStatus/
  );
});

test('hits stay WARN-class: cached service never upgrades validation status', () => {
  const store = createClosureRegimeStore();
  const record = store.registerClosure({
    regimeKey: REGIME(),
    envelope: ENVELOPE,
    artifact: { kind: 'table', rows: 32 },
    provenance: { kind: 'derived-sampled-law', sampleNodeCount: 4 },
    invalidation: INVALIDATION()
  });
  assert.equal(record.schema, ULG_CLOSURE_REGIME_RECORD_SCHEMA);
  assert.equal(record.scientificValidation, false);
  const hit = store.lookupClosure({
    regimeKey: REGIME(),
    state: { temperatureK: 300, pressurePa: 1e5, densityKgM3: 1000 }
  });
  assert.equal(hit.hit, true);
  assert.equal(hit.servedFromCache, true);
  assert.equal(hit.validationStatus, CLOSURE_VALIDATION_STATUS.WARN);
});

test('envelope exit is the demand signal and names the exit field', () => {
  const store = createClosureRegimeStore();
  store.registerClosure({
    regimeKey: REGIME(),
    envelope: ENVELOPE,
    artifact: { kind: 'table' },
    provenance: { kind: 'derived-sampled-law' },
    invalidation: INVALIDATION()
  });
  const miss = store.lookupClosure({
    regimeKey: REGIME(),
    state: { temperatureK: 390, pressurePa: 1e5, densityKgM3: 1000 }
  });
  assert.equal(miss.hit, false);
  assert.equal(miss.derivationRequested, true);
  assert.equal(miss.reason, 'envelope-exit-temperatureK');
  // The nearest record is handed back for clamped extrapolation under a
  // declared debt while the derivation runs.
  assert.ok(miss.nearest?.record);
  assert.equal(miss.nearest.admission.field, 'temperatureK');
});

test('rejected records never serve; a query without regime records says so', () => {
  const store = createClosureRegimeStore();
  store.registerClosure({
    regimeKey: REGIME(),
    envelope: ENVELOPE,
    artifact: { kind: 'table' },
    provenance: { kind: 'derived-sampled-law' },
    invalidation: INVALIDATION({
      validationStatus: CLOSURE_VALIDATION_STATUS.REJECTED
    })
  });
  const miss = store.lookupClosure({
    regimeKey: REGIME(),
    state: { temperatureK: 300, pressurePa: 1e5, densityKgM3: 1000 }
  });
  assert.equal(miss.hit, false);
  const noRegime = store.lookupClosure({
    regimeKey: canonicalizeClosureRegimeKey({
      lawId: 'thermal-eos',
      composition: { fe: 1 },
      temperatureRangeK: [1800, 1900]
    }),
    state: { temperatureK: 1850 }
  });
  assert.equal(noRegime.reason, 'no-regime-record');
});

test('newest admitted record wins; superseded lineage is preserved', () => {
  const store = createClosureRegimeStore();
  const first = store.registerClosure({
    regimeKey: REGIME(),
    envelope: ENVELOPE,
    artifact: { generation: 1 },
    provenance: { kind: 'derived-sampled-law' },
    invalidation: INVALIDATION({ inputHash: 'sha256:a' })
  });
  const second = store.registerClosure({
    regimeKey: REGIME(),
    envelope: { ...ENVELOPE, temperatureRangeK: [273, 385] },
    artifact: { generation: 2 },
    provenance: { kind: 'derived-sampled-law' },
    invalidation: INVALIDATION({ inputHash: 'sha256:b' }),
    supersedes: first.invalidationKey
  });
  const hit = store.lookupClosure({
    regimeKey: REGIME(),
    state: { temperatureK: 380, pressurePa: 1e5, densityKgM3: 1000 }
  });
  assert.equal(hit.record.artifact.generation, 2);
  assert.equal(second.supersedes, first.invalidationKey);
  assert.equal(store.records().length, 2);
});

test('envelope admission validates query completeness', () => {
  const admission = closureEnvelopeAdmits(
    { temperatureRangeK: [273, 373], pressureRangePa: [1e4, 1e6], densityRangeKgM3: null },
    { temperatureK: 300 }
  );
  assert.equal(admission.admitted, false);
  assert.equal(admission.reason, 'query-missing-pressurePa');
});
