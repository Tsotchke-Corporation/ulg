import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GPU_READBACK_TELEMETRY_SCHEMA,
  appendGpuReadbackTelemetryObservation,
  createGpuReadbackTelemetry,
  createGpuReadbackTelemetryAccumulator,
  legacyExactZeroGpuReadbackProductionEvidence,
  normalizePageVisibleGpuReadbackTelemetry,
  mergeGpuReadbackTelemetry
} from '../src/runtime/sph/sphGpuReadbackTelemetry.js';

const PAGE_VISIBLE_BREAKDOWN_COUNT_FIELDS = Object.freeze([
  'observedMapAsyncCount',
  'observedReadbackBytes',
  'observedHostQueueFenceCount',
  'finalDiagnosticMapAsyncCount',
  'finalDiagnosticReadbackBytes',
  'deferredCleanupHostQueueFenceCount',
  'awaitedBackpressureHostQueueFenceCount',
  'unclassifiedMapAsyncCount',
  'unclassifiedReadbackBytes',
  'unclassifiedHostQueueFenceCount'
]);

function zeroPageVisibleBreakdownRow(source) {
  return {
    source,
    ...Object.fromEntries(
      PAGE_VISIBLE_BREAKDOWN_COUNT_FIELDS.map((field) => [field, 0])
    )
  };
}

function withoutField(value, field) {
  const copy = { ...value };
  delete copy[field];
  return copy;
}

test('exact zero GPU readback telemetry proves a strictly resident scope', () => {
  const telemetry = createGpuReadbackTelemetry({
    scope: 'zero-scope'
  });

  assert.equal(
    telemetry.readbackTelemetrySchema,
    GPU_READBACK_TELEMETRY_SCHEMA
  );
  assert.equal(telemetry.readbackTelemetryComplete, true);
  assert.deepEqual(telemetry.readbackTelemetryUnknownSources, []);
  assert.equal(telemetry.mapAsyncCount, 0);
  assert.equal(telemetry.readbackBytes, 0);
  assert.equal(telemetry.hostQueueFenceCount, 0);
  assert.equal(telemetry.normalHotLoopReadbackFree, true);
  assert.equal(telemetry.productionHotLoopHostDependencyFree, true);
  assert.deepEqual(telemetry.readbackTelemetrySourceBreakdown, []);
  assert.equal(Object.isFrozen(telemetry.readbackTelemetrySourceBreakdown), true);
  assert.equal(Object.isFrozen(telemetry), true);
});

test('page-visible normalization certifies only exact conserving v1 telemetry', () => {
  const source = createGpuReadbackTelemetry({
    scope: 'page-visible-classified-diagnostics',
    mapAsyncCount: 1,
    readbackBytes: 64,
    hostQueueFenceCount: 1,
    finalDiagnosticMapAsyncCount: 1,
    finalDiagnosticReadbackBytes: 64,
    deferredCleanupHostQueueFenceCount: 1
  });
  const normalized = normalizePageVisibleGpuReadbackTelemetry(source);

  assert.equal(normalized.readbackTelemetryComplete, true);
  assert.equal(normalized.observedMapAsyncCount, 1);
  assert.equal(normalized.observedReadbackBytes, 64);
  assert.equal(normalized.observedHostQueueFenceCount, 1);
  assert.equal(normalized.mapAsyncCount, 1);
  assert.equal(normalized.readbackBytes, 64);
  assert.equal(normalized.hostQueueFenceCount, 1);
  assert.equal(normalized.normalHotLoopReadbackFree, false);
  assert.equal(normalized.productionHotLoopHostDependencyFree, true);
  assert.deepEqual(
    normalized.readbackTelemetrySourceBreakdown,
    source.readbackTelemetrySourceBreakdown
  );
  assert.notStrictEqual(
    normalized.readbackTelemetrySourceBreakdown,
    source.readbackTelemetrySourceBreakdown
  );

  const {
    normalHotLoopReadbackFree,
    productionHotLoopHostDependencyFree,
    ...withoutDerivedClaims
  } = source;
  void normalHotLoopReadbackFree;
  void productionHotLoopHostDependencyFree;
  const derived = normalizePageVisibleGpuReadbackTelemetry(
    withoutDerivedClaims
  );
  assert.equal(derived.readbackTelemetryComplete, true);
  assert.equal(derived.normalHotLoopReadbackFree, false);
  assert.equal(derived.productionHotLoopHostDependencyFree, true);
});

test('page-visible normalization nulls malformed counts and positive claims', () => {
  const valid = createGpuReadbackTelemetry({
    scope: 'page-visible-zero'
  });
  const missingAlias = { ...valid };
  delete missingAlias.hostQueueFenceCount;
  const missingBreakdown = { ...valid };
  delete missingBreakdown.readbackTelemetrySourceBreakdown;
  const nonconservingRow = createGpuReadbackTelemetry({
    scope: 'forged-nonzero-row',
    mapAsyncCount: 1
  }).readbackTelemetrySourceBreakdown[0];
  const cases = [
    ['coercible count', { ...valid, observedMapAsyncCount: '0' }],
    ['negative count', { ...valid, observedReadbackBytes: -1 }],
    ['missing count', missingAlias],
    ['missing breakdown', missingBreakdown],
    ['unknown source', {
      ...valid,
      readbackTelemetryUnknownSources: ['unverified-stage']
    }],
    ['missing unknown-source list', {
      ...valid,
      readbackTelemetryUnknownSources: undefined
    }],
    ['nonconserving breakdown', {
      ...valid,
      readbackTelemetrySourceBreakdown: [nonconservingRow]
    }],
    ['malformed breakdown row', {
      ...valid,
      readbackTelemetrySourceBreakdown: [{ source: 'missing-counts' }]
    }],
    ['contradictory public alias', { ...valid, mapAsyncCount: 1 }],
    ['contradictory strict claim', {
      ...valid,
      normalHotLoopReadbackFree: false
    }],
    ['contradictory production claim', {
      ...valid,
      productionHotLoopHostDependencyFree: false
    }],
    ['wrong schema', {
      ...valid,
      readbackTelemetrySchema: 'peercompute.ulg.gpu-readback-telemetry.v0'
    }]
  ];
  const countFields = [
    'observedMapAsyncCount',
    'observedReadbackBytes',
    'observedHostQueueFenceCount',
    'finalDiagnosticMapAsyncCount',
    'finalDiagnosticReadbackBytes',
    'deferredCleanupHostQueueFenceCount',
    'awaitedBackpressureHostQueueFenceCount',
    'unclassifiedMapAsyncCount',
    'unclassifiedReadbackBytes',
    'unclassifiedHostQueueFenceCount',
    'mapAsyncCount',
    'readbackBytes',
    'hostQueueFenceCount'
  ];

  for (const [name, malformed] of cases) {
    const normalized = normalizePageVisibleGpuReadbackTelemetry(malformed);
    assert.equal(normalized.readbackTelemetryComplete, false, name);
    for (const field of countFields) {
      assert.equal(normalized[field], null, `${name}: ${field}`);
    }
    assert.equal(
      normalized.normalHotLoopReadbackFree,
      malformed.normalHotLoopReadbackFree === false ? false : null,
      `${name}: strict claim`
    );
    assert.equal(
      normalized.productionHotLoopHostDependencyFree,
      malformed.productionHotLoopHostDependencyFree === false ? false : null,
      `${name}: production claim`
    );
  }

  for (const field of countFields) {
    const missing = { ...valid };
    delete missing[field];
    assert.equal(
      normalizePageVisibleGpuReadbackTelemetry(missing)
        .readbackTelemetryComplete,
      false,
      `missing required ${field}`
    );
    for (const invalid of [
      undefined,
      null,
      false,
      true,
      '0',
      -1,
      0.5,
      Number.MAX_SAFE_INTEGER + 1,
      Number.NaN,
      Number.POSITIVE_INFINITY
    ]) {
      const normalized = normalizePageVisibleGpuReadbackTelemetry({
        ...valid,
        [field]: invalid
      });
      assert.equal(
        normalized.readbackTelemetryComplete,
        false,
        `${field}: ${String(invalid)}`
      );
      assert.equal(normalized[field], null, `${field}: ${String(invalid)}`);
      assert.equal(
        normalized.normalHotLoopReadbackFree,
        null,
        `${field}: strict claim`
      );
      assert.equal(
        normalized.productionHotLoopHostDependencyFree,
        null,
        `${field}: production claim`
      );
    }
  }

  const explicitIncomplete = normalizePageVisibleGpuReadbackTelemetry({
    ...valid,
    readbackTelemetryComplete: false,
    normalHotLoopReadbackFree: false,
    productionHotLoopHostDependencyFree: false
  });
  assert.equal(explicitIncomplete.readbackTelemetryComplete, false);
  assert.equal(explicitIncomplete.observedMapAsyncCount, null);
  assert.equal(explicitIncomplete.normalHotLoopReadbackFree, false);
  assert.equal(explicitIncomplete.productionHotLoopHostDependencyFree, false);
});

test('page-visible normalization rebuilds canonical source rows and rejects trimmed duplicates', () => {
  const source = createGpuReadbackTelemetry({
    scope: 'page-visible-source-row-allowlist',
    mapAsyncCount: 1,
    readbackBytes: 64,
    hostQueueFenceCount: 1,
    finalDiagnosticMapAsyncCount: 1,
    finalDiagnosticReadbackBytes: 64,
    deferredCleanupHostQueueFenceCount: 1
  });
  const rawRow = source.readbackTelemetrySourceBreakdown[0];
  const normalized = normalizePageVisibleGpuReadbackTelemetry({
    ...source,
    readbackTelemetrySourceBreakdown: [{
      ...rawRow,
      source: `  ${rawRow.source}  `,
      mapAsyncCount: 999,
      readbackTelemetryComplete: false,
      normalHotLoopReadbackFree: true,
      productionHotLoopHostDependencyFree: false,
      untrustedArtifactField: 'must-not-escape'
    }]
  });

  assert.equal(normalized.readbackTelemetryComplete, true);
  assert.equal(
    normalized.readbackTelemetrySourceBreakdown[0].source,
    rawRow.source
  );
  assert.deepEqual(
    Object.keys(normalized.readbackTelemetrySourceBreakdown[0]),
    ['source', ...PAGE_VISIBLE_BREAKDOWN_COUNT_FIELDS]
  );
  assert.equal(
    normalized.readbackTelemetrySourceBreakdown[0].mapAsyncCount,
    undefined
  );
  assert.equal(
    normalized.readbackTelemetrySourceBreakdown[0]
      .normalHotLoopReadbackFree,
    undefined
  );
  assert.equal(
    normalized.readbackTelemetrySourceBreakdown[0]
      .productionHotLoopHostDependencyFree,
    undefined
  );
  assert.equal(
    normalized.readbackTelemetrySourceBreakdown[0].untrustedArtifactField,
    undefined
  );

  const zero = createGpuReadbackTelemetry({
    scope: 'page-visible-duplicate-source-row'
  });
  const duplicateSource = normalizePageVisibleGpuReadbackTelemetry({
    ...zero,
    readbackTelemetrySourceBreakdown: [
      zeroPageVisibleBreakdownRow('duplicate-source'),
      zeroPageVisibleBreakdownRow('  duplicate-source  ')
    ]
  });
  assert.equal(duplicateSource.readbackTelemetryComplete, false);
  assert.equal(duplicateSource.readbackTelemetrySourceBreakdown, null);
  assert.equal(duplicateSource.normalHotLoopReadbackFree, null);
  assert.equal(duplicateSource.productionHotLoopHostDependencyFree, null);
});

test('telemetry breakdowns use dense own rows and ignore custom iteration protocols', () => {
  const valid = createGpuReadbackTelemetry({
    scope: 'page-visible-dense-own-breakdown'
  });
  const inheritedHole = new Array(1);
  Object.setPrototypeOf(inheritedHole, {
    0: zeroPageVisibleBreakdownRow('inherited-hole')
  });
  const proxiedHole = new Proxy(new Array(1), {
    get(target, field, receiver) {
      if (field === '0') return zeroPageVisibleBreakdownRow('proxied-hole');
      return Reflect.get(target, field, receiver);
    }
  });
  const accessorRow = new Array(1);
  Object.defineProperty(accessorRow, '0', {
    configurable: true,
    enumerable: true,
    get() {
      return zeroPageVisibleBreakdownRow('accessor-row');
    }
  });
  const iteratorHiddenDuplicates = [
    zeroPageVisibleBreakdownRow('duplicate'),
    zeroPageVisibleBreakdownRow(' duplicate ')
  ];
  Object.defineProperty(iteratorHiddenDuplicates, Symbol.iterator, {
    configurable: true,
    value: function* hiddenRows() {}
  });
  const iteratorReorderedDuplicates = [
    zeroPageVisibleBreakdownRow('duplicate'),
    zeroPageVisibleBreakdownRow(' duplicate ')
  ];
  Object.defineProperty(iteratorReorderedDuplicates, Symbol.iterator, {
    configurable: true,
    value: function* reorderedRows() {
      yield this[1];
      yield this[0];
    }
  });

  for (const [name, breakdown] of [
    ['inherited hole', inheritedHole],
    ['proxied get hole', proxiedHole],
    ['accessor row', accessorRow],
    ['iterator-hidden duplicates', iteratorHiddenDuplicates],
    ['iterator-reordered duplicates', iteratorReorderedDuplicates]
  ]) {
    const normalized = normalizePageVisibleGpuReadbackTelemetry({
      ...valid,
      readbackTelemetrySourceBreakdown: breakdown
    });
    assert.equal(normalized.readbackTelemetryComplete, false, name);
    assert.equal(normalized.normalHotLoopReadbackFree, null, name);
    assert.equal(normalized.productionHotLoopHostDependencyFree, null, name);
    assert.equal(normalized.readbackTelemetrySourceBreakdown, null, name);

    const produced = createGpuReadbackTelemetry({
      scope: `dense-own-${name}`,
      sourceBreakdown: breakdown
    });
    assert.equal(produced.readbackTelemetryComplete, false, `${name}: producer`);
    assert.equal(
      produced.productionHotLoopHostDependencyFree,
      false,
      `${name}: producer claim`
    );
  }

  const throwingBreakdown = new Proxy([], {
    getOwnPropertyDescriptor() {
      throw new Error('breakdown descriptor trap');
    }
  });
  const revoked = Proxy.revocable([], {});
  revoked.revoke();
  for (const [name, breakdown] of [
    ['throwing proxy', throwingBreakdown],
    ['revoked proxy', revoked.proxy]
  ]) {
    assert.doesNotThrow(() => normalizePageVisibleGpuReadbackTelemetry({
      ...valid,
      readbackTelemetrySourceBreakdown: breakdown
    }), name);
    const normalized = normalizePageVisibleGpuReadbackTelemetry({
      ...valid,
      readbackTelemetrySourceBreakdown: breakdown
    });
    assert.equal(normalized.readbackTelemetryComplete, false, name);
    assert.equal(normalized.normalHotLoopReadbackFree, null, name);
    assert.equal(normalized.productionHotLoopHostDependencyFree, null, name);
  }
});

test('page telemetry snapshots unknown sources once before certification', () => {
  const target = { ...createGpuReadbackTelemetry({
    scope: 'page-visible-single-unknown-snapshot'
  }) };
  let descriptorReads = 0;
  let currentValue = target.readbackTelemetryUnknownSources;
  const telemetry = new Proxy(target, {
    getOwnPropertyDescriptor(object, field) {
      const descriptor = Reflect.getOwnPropertyDescriptor(object, field);
      if (field !== 'readbackTelemetryUnknownSources') return descriptor;
      descriptorReads += 1;
      currentValue = descriptorReads === 1 ? [] : ['hidden-source'];
      return { ...descriptor, value: currentValue };
    },
    get(object, field, receiver) {
      if (field === 'readbackTelemetryUnknownSources') return currentValue;
      return Reflect.get(object, field, receiver);
    }
  });
  const normalized = normalizePageVisibleGpuReadbackTelemetry(telemetry);
  assert.equal(normalized.readbackTelemetryComplete, true);
  assert.equal(normalized.normalHotLoopReadbackFree, true);
  assert.equal(normalized.productionHotLoopHostDependencyFree, true);
  assert.deepEqual(normalized.readbackTelemetryUnknownSources, []);
  assert.equal(descriptorReads, 1);
});

test('telemetry producers reject hostile top-level options without throwing', () => {
  const target = {
    scope: 'hostile-producer-options',
    mapAsyncCount: 1,
    sourceBreakdown: [
      zeroPageVisibleBreakdownRow('duplicate'),
      zeroPageVisibleBreakdownRow(' duplicate ')
    ]
  };
  const hostile = new Proxy(target, {
    get(object, field, receiver) {
      if (field === 'mapAsyncCount') return 0;
      if (field === 'sourceBreakdown') return [];
      return Reflect.get(object, field, receiver);
    }
  });
  const produced = createGpuReadbackTelemetry(hostile);
  assert.equal(produced.readbackTelemetryComplete, false);
  assert.equal(produced.mapAsyncCount, null);
  assert.equal(produced.normalHotLoopReadbackFree, false);
  assert.equal(produced.productionHotLoopHostDependencyFree, false);
  assert.ok(produced.readbackTelemetryUnknownSources.length > 0);

  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  assert.doesNotThrow(() => createGpuReadbackTelemetry(revoked.proxy));
  const revokedResult = createGpuReadbackTelemetry(revoked.proxy);
  assert.equal(revokedResult.readbackTelemetryComplete, false);
  assert.equal(revokedResult.normalHotLoopReadbackFree, false);
  assert.equal(revokedResult.productionHotLoopHostDependencyFree, false);
});

test('producer routes retain zero-row malformations as durable incomplete evidence', () => {
  const validZeroRow = zeroPageVisibleBreakdownRow('valid-zero-source');
  const valid = createGpuReadbackTelemetry({
    scope: 'producer-valid-zero-rows',
    sourceBreakdown: [
      {
        ...validZeroRow,
        mapAsyncCount: 999,
        normalHotLoopReadbackFree: true,
        untrustedProducerField: 'must-not-escape'
      },
      zeroPageVisibleBreakdownRow('second-zero-source')
    ]
  });
  assert.equal(valid.readbackTelemetryComplete, true);
  assert.deepEqual(
    valid.readbackTelemetrySourceBreakdown.map((row) => row.source),
    ['valid-zero-source', 'second-zero-source']
  );
  assert.deepEqual(
    Object.keys(valid.readbackTelemetrySourceBreakdown[0]),
    ['source', ...PAGE_VISIBLE_BREAKDOWN_COUNT_FIELDS]
  );
  assert.equal(
    valid.readbackTelemetrySourceBreakdown[0].mapAsyncCount,
    undefined
  );
  assert.equal(
    valid.readbackTelemetrySourceBreakdown[0].normalHotLoopReadbackFree,
    undefined
  );
  assert.equal(
    valid.readbackTelemetrySourceBreakdown[0].untrustedProducerField,
    undefined
  );

  const malformedBreakdowns = [
    ['duplicate trimmed IDs', [
      zeroPageVisibleBreakdownRow('duplicate-zero-source'),
      zeroPageVisibleBreakdownRow(' duplicate-zero-source ')
    ]],
    ['null row', [null]],
    ['empty object row', [{}]],
    ['null source ID', [{ ...validZeroRow, source: null }]],
    ['empty source ID', [zeroPageVisibleBreakdownRow('   ')]],
    ['missing source ID', [withoutField(validZeroRow, 'source')]],
    ['sparse observed count', [
      withoutField(validZeroRow, 'observedMapAsyncCount')
    ]],
    ['sparse classified count', [
      withoutField(validZeroRow, 'finalDiagnosticMapAsyncCount')
    ]],
    ['sparse unclassified count', [
      withoutField(validZeroRow, 'unclassifiedMapAsyncCount')
    ]],
    ['contradictory unclassified count', [{
      ...validZeroRow,
      unclassifiedMapAsyncCount: 1
    }]],
    ['present null breakdown', null],
    ['present undefined breakdown', undefined]
  ];
  const assertIncomplete = (telemetry, route, name) => {
    assert.equal(
      telemetry.readbackTelemetryComplete,
      false,
      `${route}: ${name}: completeness`
    );
    assert.equal(
      telemetry.normalHotLoopReadbackFree,
      false,
      `${route}: ${name}: strict claim`
    );
    assert.equal(
      telemetry.productionHotLoopHostDependencyFree,
      false,
      `${route}: ${name}: production claim`
    );
    assert.ok(
      telemetry.readbackTelemetryUnknownSources.length > 0,
      `${route}: ${name}: durable invalid-source evidence`
    );
    const pageVisible = normalizePageVisibleGpuReadbackTelemetry(telemetry);
    assert.equal(
      pageVisible.readbackTelemetryComplete,
      false,
      `${route}: ${name}: page recertification`
    );
    assert.equal(
      pageVisible.normalHotLoopReadbackFree,
      false,
      `${route}: ${name}: page strict claim`
    );
    assert.equal(
      pageVisible.productionHotLoopHostDependencyFree,
      false,
      `${route}: ${name}: page production claim`
    );
  };

  for (const [name, sourceBreakdown] of malformedBreakdowns) {
    assertIncomplete(
      createGpuReadbackTelemetry({
        scope: `producer-create-${name}`,
        sourceBreakdown
      }),
      'create',
      name
    );

    const rawTelemetry = {
      ...createGpuReadbackTelemetry({ scope: `producer-raw-${name}` }),
      readbackTelemetrySourceBreakdown: sourceBreakdown
    };
    assertIncomplete(
      mergeGpuReadbackTelemetry([{
        source: 'raw-source',
        telemetry: rawTelemetry
      }]),
      'merge',
      name
    );

    const appendExisting = { ...rawTelemetry };
    appendGpuReadbackTelemetryObservation(appendExisting, {}, {
      source: 'zero-delta'
    });
    assertIncomplete(appendExisting, 'append-existing', name);

    const appendDelta = {
      ...createGpuReadbackTelemetry({ scope: `producer-target-${name}` })
    };
    appendGpuReadbackTelemetryObservation(appendDelta, {
      sourceBreakdown
    }, {
      source: 'malformed-zero-delta'
    });
    assertIncomplete(appendDelta, 'append-delta', name);

    const accumulator = createGpuReadbackTelemetryAccumulator({
      scope: `producer-accumulator-${name}`
    });
    assert.equal(
      accumulator.merge(rawTelemetry, 'malformed-zero-source'),
      false,
      `accumulator.merge: ${name}: return value`
    );
    assertIncomplete(accumulator.snapshot(), 'accumulator.merge', name);
  }
});

test('merge rejects canonically duplicate or malformed outer entry sources', () => {
  const zero = createGpuReadbackTelemetry({ scope: 'outer-source-zero' });
  for (const [name, entries] of [
    ['trimmed duplicate', [
      { source: 'outer-source', telemetry: zero },
      { source: ' outer-source ', telemetry: zero }
    ]],
    ['empty explicit source', [
      { source: '   ', telemetry: zero }
    ]],
    ['non-string explicit source', [
      { source: 7, telemetry: zero }
    ]]
  ]) {
    const merged = mergeGpuReadbackTelemetry(entries);
    assert.equal(merged.readbackTelemetryComplete, false, name);
    assert.equal(merged.normalHotLoopReadbackFree, false, name);
    assert.equal(merged.productionHotLoopHostDependencyFree, false, name);
    assert.ok(merged.readbackTelemetryUnknownSources.length > 0, name);
  }
});

test('merge authenticates dense own entries and exact telemetry properties', () => {
  const zero = createGpuReadbackTelemetry({ scope: 'hostile-merge-zero' });
  const assertIncomplete = (name, entries) => {
    const merged = mergeGpuReadbackTelemetry(entries);
    assert.equal(merged.readbackTelemetryComplete, false, name);
    assert.equal(merged.normalHotLoopReadbackFree, false, name);
    assert.equal(merged.productionHotLoopHostDependencyFree, false, name);
    assert.ok(merged.readbackTelemetryUnknownSources.length > 0, name);
  };

  const iteratorHiddenDuplicateEntries = [
    { source: 'duplicate', telemetry: zero },
    { source: ' duplicate ', telemetry: zero }
  ];
  Object.defineProperty(iteratorHiddenDuplicateEntries, Symbol.iterator, {
    configurable: true,
    value: function* hideDuplicate() {
      yield this[0];
    }
  });
  assertIncomplete(
    'custom iterator cannot hide a duplicate outer source',
    iteratorHiddenDuplicateEntries
  );

  const inheritedEntry = new Array(1);
  Object.setPrototypeOf(inheritedEntry, {
    0: { source: 'inherited-entry', telemetry: zero }
  });
  assertIncomplete('inherited array entries are rejected', inheritedEntry);

  const inheritedSchema = { ...zero };
  delete inheritedSchema.readbackTelemetrySchema;
  Object.setPrototypeOf(inheritedSchema, {
    readbackTelemetrySchema: GPU_READBACK_TELEMETRY_SCHEMA
  });
  assertIncomplete('inherited schema is rejected', [inheritedSchema]);

  for (const [name, field, descriptorValue, getValue] of [
    [
      'schema descriptor/get mismatch',
      'readbackTelemetrySchema',
      'peercompute.ulg.gpu-readback-telemetry.v0',
      GPU_READBACK_TELEMETRY_SCHEMA
    ],
    [
      'unknown-source descriptor/get mismatch',
      'readbackTelemetryUnknownSources',
      ['descriptor-hidden-source'],
      []
    ],
    [
      'complete descriptor/get mismatch',
      'readbackTelemetryComplete',
      false,
      true
    ]
  ]) {
    const target = { ...zero, [field]: descriptorValue };
    const telemetry = new Proxy(target, {
      get(object, property, receiver) {
        if (property === field) return getValue;
        return Reflect.get(object, property, receiver);
      }
    });
    assertIncomplete(name, [telemetry]);
  }

  const alternatingCompleteTarget = {
    ...zero,
    mapAsyncCount: 777,
    normalHotLoopReadbackFree: false,
    productionHotLoopHostDependencyFree: false
  };
  let completeDescriptorReads = 0;
  let currentComplete = false;
  const alternatingComplete = new Proxy(alternatingCompleteTarget, {
    getOwnPropertyDescriptor(object, field) {
      const descriptor = Reflect.getOwnPropertyDescriptor(object, field);
      if (field !== 'readbackTelemetryComplete') return descriptor;
      completeDescriptorReads += 1;
      currentComplete = completeDescriptorReads > 1;
      return { ...descriptor, value: currentComplete };
    },
    get(object, field, receiver) {
      if (field === 'readbackTelemetryComplete') return currentComplete;
      return Reflect.get(object, field, receiver);
    }
  });
  assertIncomplete(
    'one false completeness snapshot cannot become true during merge',
    [alternatingComplete]
  );
  assert.equal(completeDescriptorReads, 1);

  for (const field of [
    'readbackTelemetrySourceBreakdown',
    'readbackTelemetryUnknownSources'
  ]) {
    const revoked = Proxy.revocable([], {});
    revoked.revoke();
    const telemetry = { ...zero, [field]: revoked.proxy };
    assert.doesNotThrow(
      () => mergeGpuReadbackTelemetry([telemetry]),
      `${field}: revoked nested array is contained`
    );
    assertIncomplete(
      `${field}: revoked nested array fails closed`,
      [telemetry]
    );
  }

  const revokedRow = Proxy.revocable({}, {});
  revokedRow.revoke();
  const revokedRowTelemetry = {
    ...zero,
    readbackTelemetrySourceBreakdown: [revokedRow.proxy]
  };
  assert.doesNotThrow(
    () => mergeGpuReadbackTelemetry([revokedRowTelemetry]),
    'revoked breakdown row is contained'
  );
  assertIncomplete(
    'revoked breakdown row fails closed',
    [revokedRowTelemetry]
  );
});

test('legacy production inference requires exact complete zero observations', () => {
  const legacy = {
    readbackTelemetrySchema: GPU_READBACK_TELEMETRY_SCHEMA,
    readbackTelemetryComplete: true,
    readbackTelemetryUnknownSources: [],
    observedMapAsyncCount: 0,
    observedReadbackBytes: 0,
    observedHostQueueFenceCount: 0,
    normalHotLoopReadbackFree: true
  };
  assert.equal(
    legacyExactZeroGpuReadbackProductionEvidence(legacy),
    true
  );
  assert.equal(
    legacyExactZeroGpuReadbackProductionEvidence({
      ...legacy,
      mapAsyncCount: 0,
      readbackBytes: 0,
      hostQueueFenceCount: 0,
      readbackTelemetrySourceBreakdown: []
    }),
    true
  );

  const missingObservedCount = { ...legacy };
  delete missingObservedCount.observedHostQueueFenceCount;
  for (const [name, malformed] of [
    ['coercible zero', { ...legacy, observedMapAsyncCount: '0' }],
    ['negative count', { ...legacy, observedReadbackBytes: -1 }],
    ['missing observed count', missingObservedCount],
    ['incomplete', { ...legacy, readbackTelemetryComplete: false }],
    ['unknown source', {
      ...legacy,
      readbackTelemetryUnknownSources: ['missing-stage']
    }],
    ['missing schema', { ...legacy, readbackTelemetrySchema: undefined }],
    ['malformed optional alias', { ...legacy, mapAsyncCount: '0' }],
    ['malformed optional breakdown', {
      ...legacy,
      readbackTelemetrySourceBreakdown: [{ source: 'missing-counts' }]
    }],
    ['canonically duplicate optional breakdown sources', {
      ...legacy,
      readbackTelemetrySourceBreakdown: [
        zeroPageVisibleBreakdownRow('legacy-source'),
        zeroPageVisibleBreakdownRow(' legacy-source ')
      ]
    }],
    ['explicit production claim', {
      ...legacy,
      productionHotLoopHostDependencyFree: true
    }]
  ]) {
    assert.equal(
      legacyExactZeroGpuReadbackProductionEvidence(malformed),
      null,
      name
    );
  }
});

test('any observed host map, readback byte, or awaited queue fence fails strict residency', () => {
  for (const counts of [
    { mapAsyncCount: 1, readbackBytes: 4 },
    { readbackBytes: 4 },
    { hostQueueFenceCount: 1 }
  ]) {
    const telemetry = createGpuReadbackTelemetry({
      scope: 'nonzero-scope',
      ...counts
    });
    assert.equal(telemetry.readbackTelemetryComplete, true);
    assert.equal(telemetry.normalHotLoopReadbackFree, false);
    assert.equal(telemetry.productionHotLoopHostDependencyFree, false);
  }
});

test('final diagnostics and deferred cleanup preserve the strict claim while allowing the production claim', () => {
  const accumulator = createGpuReadbackTelemetryAccumulator({
    scope: 'final-presentation'
  });
  accumulator.recordFinalDiagnosticMapAsync(64, 'final-motion-summary');
  accumulator.recordDeferredCleanupHostQueueFence(1, 'temporary-cleanup');

  const telemetry = accumulator.snapshot();
  assert.equal(telemetry.normalHotLoopReadbackFree, false);
  assert.equal(telemetry.productionHotLoopHostDependencyFree, true);
  assert.equal(telemetry.finalDiagnosticMapAsyncCount, 1);
  assert.equal(telemetry.finalDiagnosticReadbackBytes, 64);
  assert.equal(telemetry.deferredCleanupHostQueueFenceCount, 1);
  assert.equal(telemetry.awaitedBackpressureHostQueueFenceCount, 0);
  assert.equal(telemetry.unclassifiedMapAsyncCount, 0);
  assert.equal(telemetry.unclassifiedReadbackBytes, 0);
  assert.equal(telemetry.unclassifiedHostQueueFenceCount, 0);
  assert.deepEqual(
    telemetry.readbackTelemetrySourceBreakdown.map((row) => row.source),
    ['final-motion-summary', 'temporary-cleanup']
  );
  assert.equal(
    telemetry.readbackTelemetrySourceBreakdown.every(Object.isFrozen),
    true
  );
});

test('awaited backpressure and generic observations fail the production claim', () => {
  const awaited = createGpuReadbackTelemetryAccumulator({
    scope: 'arena-backpressure'
  });
  awaited.recordAwaitedBackpressureHostQueueFence();
  const awaitedTelemetry = awaited.snapshot();
  assert.equal(awaitedTelemetry.awaitedBackpressureHostQueueFenceCount, 1);
  assert.equal(awaitedTelemetry.unclassifiedHostQueueFenceCount, 0);
  assert.equal(awaitedTelemetry.productionHotLoopHostDependencyFree, false);

  const generic = createGpuReadbackTelemetryAccumulator({
    scope: 'unclassified-control-readback'
  });
  generic.recordMapAsync(32);
  generic.recordHostQueueFence();
  const genericTelemetry = generic.snapshot();
  assert.equal(genericTelemetry.unclassifiedMapAsyncCount, 1);
  assert.equal(genericTelemetry.unclassifiedReadbackBytes, 32);
  assert.equal(genericTelemetry.unclassifiedHostQueueFenceCount, 1);
  assert.equal(genericTelemetry.productionHotLoopHostDependencyFree, false);
});

test('a missing merged source fails closed while retaining observed lower bounds', () => {
  const telemetry = mergeGpuReadbackTelemetry([
    {
      source: 'compact-summary',
      telemetry: createGpuReadbackTelemetry({
        scope: 'compact-summary',
        mapAsyncCount: 1,
        readbackBytes: 64
      })
    },
    {
      source: 'custom-stage',
      telemetry: null
    }
  ], {
    scope: 'resident-step'
  });

  assert.equal(telemetry.readbackTelemetryComplete, false);
  assert.deepEqual(
    telemetry.readbackTelemetryUnknownSources,
    ['custom-stage']
  );
  assert.equal(telemetry.observedMapAsyncCount, 1);
  assert.equal(telemetry.observedReadbackBytes, 64);
  assert.equal(telemetry.observedHostQueueFenceCount, 0);
  assert.equal(telemetry.mapAsyncCount, null);
  assert.equal(telemetry.readbackBytes, null);
  assert.equal(telemetry.hostQueueFenceCount, null);
  assert.equal(telemetry.normalHotLoopReadbackFree, false);
  assert.equal(telemetry.productionHotLoopHostDependencyFree, false);
});

test('the accumulator records maps and awaited host fences before snapshot', () => {
  const accumulator = createGpuReadbackTelemetryAccumulator({
    scope: 'reaction-summary'
  });
  accumulator.recordMapAsync(32);
  accumulator.recordMapAsync(16);
  accumulator.recordHostQueueFence();

  const telemetry = accumulator.snapshot();
  assert.equal(telemetry.mapAsyncCount, 2);
  assert.equal(telemetry.readbackBytes, 48);
  assert.equal(telemetry.hostQueueFenceCount, 1);
  assert.equal(telemetry.normalHotLoopReadbackFree, false);
  assert.equal(telemetry.productionHotLoopHostDependencyFree, false);
});

test('legacy v1 nonzero telemetry remains compatible and fail-closed as unclassified', () => {
  const legacy = {
    readbackTelemetrySchema: GPU_READBACK_TELEMETRY_SCHEMA,
    readbackTelemetryScope: 'legacy-v1',
    readbackTelemetryComplete: true,
    readbackTelemetryUnknownSources: [],
    observedMapAsyncCount: 1,
    observedReadbackBytes: 16,
    observedHostQueueFenceCount: 0,
    mapAsyncCount: 1,
    readbackBytes: 16,
    hostQueueFenceCount: 0,
    normalHotLoopReadbackFree: false
  };
  const telemetry = mergeGpuReadbackTelemetry([
    { source: 'legacy', telemetry: legacy }
  ]);

  assert.equal(telemetry.readbackTelemetryComplete, true);
  assert.equal(telemetry.finalDiagnosticMapAsyncCount, 0);
  assert.equal(telemetry.unclassifiedMapAsyncCount, 1);
  assert.equal(telemetry.unclassifiedReadbackBytes, 16);
  assert.equal(telemetry.productionHotLoopHostDependencyFree, false);
});

test('telemetry counts reject JavaScript coercion values instead of certifying zero', () => {
  for (const value of [null, false, true, '0', '1', '']) {
    const telemetry = createGpuReadbackTelemetry({
      scope: 'strict-count-types',
      mapAsyncCount: value
    });

    assert.equal(telemetry.readbackTelemetryComplete, false);
    assert.equal(telemetry.mapAsyncCount, null);
    assert.equal(telemetry.normalHotLoopReadbackFree, false);
    assert.equal(telemetry.productionHotLoopHostDependencyFree, false);
    assert.ok(
      telemetry.readbackTelemetryUnknownSources.includes(
        'strict-count-types:invalid-observedMapAsyncCount'
      )
    );
  }
});

test('merge fails closed for malformed or non-conserving source breakdowns', () => {
  const zero = createGpuReadbackTelemetry({ scope: 'zero-source' });
  const nonzero = createGpuReadbackTelemetry({
    scope: 'mapped-source',
    mapAsyncCount: 1,
    readbackBytes: 16
  });
  const cases = [
    {
      name: 'negative row',
      telemetry: {
        ...zero,
        readbackTelemetrySourceBreakdown: [{
          source: 'malformed',
          observedMapAsyncCount: -1
        }]
      }
    },
    {
      name: 'explicit null row count',
      telemetry: {
        ...zero,
        readbackTelemetrySourceBreakdown: [{
          source: 'malformed',
          observedMapAsyncCount: null
        }]
      }
    },
    {
      name: 'non-array breakdown',
      telemetry: {
        ...zero,
        readbackTelemetrySourceBreakdown: {}
      }
    },
    {
      name: 'present null breakdown',
      telemetry: {
        ...zero,
        readbackTelemetrySourceBreakdown: null
      }
    },
    {
      name: 'empty breakdown with nonzero aggregate',
      telemetry: {
        ...nonzero,
        readbackTelemetrySourceBreakdown: []
      }
    }
  ];

  for (const { name, telemetry: malformed } of cases) {
    const telemetry = mergeGpuReadbackTelemetry([
      { source: name, telemetry: malformed }
    ]);
    assert.equal(telemetry.readbackTelemetryComplete, false, name);
    assert.equal(telemetry.normalHotLoopReadbackFree, false, name);
    assert.equal(
      telemetry.productionHotLoopHostDependencyFree,
      false,
      name
    );
    assert.ok(telemetry.readbackTelemetryUnknownSources.length > 0, name);
  }
});

test('claimed-complete telemetry requires a valid empty unknown-source list', () => {
  const valid = createGpuReadbackTelemetry({ scope: 'claimed-complete' });
  const { readbackTelemetryUnknownSources: omitted, ...missing } = valid;
  void omitted;
  const cases = [
    { name: 'missing', telemetry: missing },
    {
      name: 'non-array',
      telemetry: { ...valid, readbackTelemetryUnknownSources: null }
    },
    {
      name: 'invalid entry',
      telemetry: { ...valid, readbackTelemetryUnknownSources: [null] }
    },
    {
      name: 'declared unknown',
      telemetry: {
        ...valid,
        readbackTelemetryUnknownSources: ['nested-unverified']
      }
    }
  ];

  for (const { name, telemetry: malformed } of cases) {
    const telemetry = mergeGpuReadbackTelemetry([
      { source: name, telemetry: malformed }
    ]);
    assert.equal(telemetry.readbackTelemetryComplete, false, name);
    assert.equal(
      telemetry.productionHotLoopHostDependencyFree,
      false,
      name
    );
    assert.ok(telemetry.readbackTelemetryUnknownSources.length > 0, name);
  }

  const direct = createGpuReadbackTelemetry({
    scope: 'invalid-direct-unknown-source',
    unknownSources: [null]
  });
  assert.equal(direct.readbackTelemetryComplete, false);
  assert.equal(direct.productionHotLoopHostDependencyFree, false);
});

test('merge rejects contradictory complete aliases and derived residency claims', () => {
  const valid = createGpuReadbackTelemetry({ scope: 'complete-zero' });
  const cases = [
    ['map alias', { mapAsyncCount: 1 }],
    ['byte alias', { readbackBytes: 64 }],
    ['fence alias', { hostQueueFenceCount: 1 }],
    ['unclassified map', { unclassifiedMapAsyncCount: 1 }],
    ['unclassified bytes', { unclassifiedReadbackBytes: 64 }],
    ['unclassified fence', { unclassifiedHostQueueFenceCount: 1 }],
    ['strict claim', { normalHotLoopReadbackFree: false }],
    ['production claim', { productionHotLoopHostDependencyFree: false }]
  ];

  for (const [name, override] of cases) {
    const telemetry = mergeGpuReadbackTelemetry([{
      source: name,
      telemetry: { ...valid, ...override }
    }]);
    assert.equal(telemetry.readbackTelemetryComplete, false, name);
    assert.equal(telemetry.normalHotLoopReadbackFree, false, name);
    assert.equal(
      telemetry.productionHotLoopHostDependencyFree,
      false,
      name
    );
    assert.ok(telemetry.readbackTelemetryUnknownSources.length > 0, name);
  }

  const {
    mapAsyncCount,
    readbackBytes,
    hostQueueFenceCount,
    unclassifiedMapAsyncCount,
    unclassifiedReadbackBytes,
    unclassifiedHostQueueFenceCount,
    normalHotLoopReadbackFree,
    productionHotLoopHostDependencyFree,
    ...withoutPublicClaims
  } = valid;
  void mapAsyncCount;
  void readbackBytes;
  void hostQueueFenceCount;
  void unclassifiedMapAsyncCount;
  void unclassifiedReadbackBytes;
  void unclassifiedHostQueueFenceCount;
  void normalHotLoopReadbackFree;
  void productionHotLoopHostDependencyFree;
  const compatible = mergeGpuReadbackTelemetry([{
    source: 'legacy-without-public-claims',
    telemetry: withoutPublicClaims
  }]);
  assert.equal(compatible.readbackTelemetryComplete, true);
  assert.equal(compatible.normalHotLoopReadbackFree, true);
  assert.equal(compatible.productionHotLoopHostDependencyFree, true);
});

test('invalid or overclassified telemetry fails closed', () => {
  const telemetry = createGpuReadbackTelemetry({
    scope: 'overclassified',
    mapAsyncCount: 1,
    readbackBytes: 4,
    hostQueueFenceCount: 1,
    finalDiagnosticMapAsyncCount: 2,
    finalDiagnosticReadbackBytes: 8,
    deferredCleanupHostQueueFenceCount: 1,
    awaitedBackpressureHostQueueFenceCount: 1
  });

  assert.equal(telemetry.readbackTelemetryComplete, false);
  assert.equal(telemetry.mapAsyncCount, null);
  assert.equal(telemetry.normalHotLoopReadbackFree, false);
  assert.equal(telemetry.productionHotLoopHostDependencyFree, false);
  assert.ok(telemetry.readbackTelemetryUnknownSources.length >= 3);
});

test('merge conserves classifications and prefixes frozen source evidence', () => {
  const telemetry = mergeGpuReadbackTelemetry([
    {
      source: 'summary',
      telemetry: createGpuReadbackTelemetry({
        scope: 'motion',
        mapAsyncCount: 1,
        readbackBytes: 24,
        finalDiagnosticMapAsyncCount: 1,
        finalDiagnosticReadbackBytes: 24
      })
    },
    {
      source: 'cleanup',
      telemetry: createGpuReadbackTelemetry({
        scope: 'buffers',
        hostQueueFenceCount: 1,
        deferredCleanupHostQueueFenceCount: 1
      })
    }
  ], { scope: 'resident-step' });

  assert.equal(telemetry.observedMapAsyncCount, 1);
  assert.equal(telemetry.observedReadbackBytes, 24);
  assert.equal(telemetry.observedHostQueueFenceCount, 1);
  assert.equal(telemetry.finalDiagnosticMapAsyncCount, 1);
  assert.equal(telemetry.finalDiagnosticReadbackBytes, 24);
  assert.equal(telemetry.deferredCleanupHostQueueFenceCount, 1);
  assert.equal(telemetry.productionHotLoopHostDependencyFree, true);
  assert.deepEqual(
    telemetry.readbackTelemetrySourceBreakdown.map((row) => row.source),
    ['summary:motion', 'cleanup:buffers']
  );
  assert.equal(Object.isFrozen(telemetry.readbackTelemetrySourceBreakdown), true);
});

test('append helper atomically recomputes classified and derived fields on a result', () => {
  const result = {
    status: 'submitted',
    ...createGpuReadbackTelemetry({ scope: 'grid-update' })
  };
  const returned = appendGpuReadbackTelemetryObservation(result, {
    hostQueueFenceCount: 1,
    deferredCleanupHostQueueFenceCount: 1
  }, {
    source: 'temporary-buffer-cleanup'
  });

  assert.equal(returned, result);
  assert.equal(result.observedHostQueueFenceCount, 1);
  assert.equal(result.deferredCleanupHostQueueFenceCount, 1);
  assert.equal(result.unclassifiedHostQueueFenceCount, 0);
  assert.equal(result.normalHotLoopReadbackFree, false);
  assert.equal(result.productionHotLoopHostDependencyFree, true);
});
