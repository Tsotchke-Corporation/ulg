export const GPU_READBACK_TELEMETRY_SCHEMA =
  'peercompute.ulg.gpu-readback-telemetry.v1';

const OBSERVED_COUNT_FIELDS = Object.freeze([
  'observedMapAsyncCount',
  'observedReadbackBytes',
  'observedHostQueueFenceCount'
]);

const CLASSIFIED_COUNT_FIELDS = Object.freeze([
  'finalDiagnosticMapAsyncCount',
  'finalDiagnosticReadbackBytes',
  'deferredCleanupHostQueueFenceCount',
  'awaitedBackpressureHostQueueFenceCount'
]);

const UNCLASSIFIED_COUNT_FIELDS = Object.freeze([
  'unclassifiedMapAsyncCount',
  'unclassifiedReadbackBytes',
  'unclassifiedHostQueueFenceCount'
]);

const PUBLIC_COUNT_ALIAS_FIELDS = Object.freeze([
  'mapAsyncCount',
  'readbackBytes',
  'hostQueueFenceCount'
]);

const SOURCE_BREAKDOWN_COUNT_FIELDS = Object.freeze([
  ...OBSERVED_COUNT_FIELDS,
  ...CLASSIFIED_COUNT_FIELDS
]);

const PAGE_VISIBLE_SOURCE_BREAKDOWN_COUNT_FIELDS = Object.freeze([
  ...SOURCE_BREAKDOWN_COUNT_FIELDS,
  ...UNCLASSIFIED_COUNT_FIELDS
]);

const PAGE_VISIBLE_GPU_READBACK_COUNT_FIELDS = Object.freeze([
  ...PAGE_VISIBLE_SOURCE_BREAKDOWN_COUNT_FIELDS,
  ...PUBLIC_COUNT_ALIAS_FIELDS
]);

const SOURCE_BREAKDOWN_OMITTED = Symbol('source-breakdown-omitted');

function ownDataPropertySnapshot(source, field) {
  if (!source || (typeof source !== 'object' && typeof source !== 'function')) {
    return { present: false, data: false, value: undefined };
  }
  try {
    const descriptor = Object.getOwnPropertyDescriptor(source, field);
    if (!descriptor) {
      return Reflect.get(source, field) === undefined
        ? { present: false, data: false, value: undefined }
        : { present: true, data: false, value: undefined };
    }
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      return { present: true, data: false, value: undefined };
    }
    // A Proxy can report a data descriptor while changing or throwing from
    // ordinary property access. Require both views to identify the same value
    // before the snapshot can certify it. Accessors remain unexecuted.
    const value = Reflect.get(source, field);
    if (!Object.is(value, descriptor.value)) {
      return { present: true, data: false, value: undefined };
    }
    return { present: true, data: true, value };
  } catch (_) {
    // Treat descriptor/get traps as an explicit malformed property rather
    // than as absence; optional legacy fields must fail closed too.
    return { present: true, data: false, value: undefined };
  }
}

// Array iteration protocols and helpers can skip holes or be replaced by
// untrusted input. Snapshot every numeric element exactly once through its own
// data descriptor, and reject inherited/accessor/missing rows.
function denseOwnDataArraySnapshot(value) {
  try {
    if (!Array.isArray(value)) return null;
    const lengthProperty = ownDataPropertySnapshot(value, 'length');
    const length = lengthProperty.value;
    if (
      !lengthProperty.present
      || !lengthProperty.data
      || !Number.isSafeInteger(length)
      || length < 0
    ) return null;
    const snapshot = new Array(length);
    for (let index = 0; index < length; index += 1) {
      const element = ownDataPropertySnapshot(value, String(index));
      if (!element.present || !element.data) return null;
      snapshot[index] = element.value;
    }
    return snapshot;
  } catch (_) {
    return null;
  }
}

function isNonArrayObject(value) {
  if (!value || typeof value !== 'object') return false;
  try {
    return !Array.isArray(value);
  } catch (_) {
    return false;
  }
}

function uniqueStrings(values = []) {
  return [...new Set(
    values
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim())
  )];
}

function normalizedStringList(values, scope) {
  const snapshot = denseOwnDataArraySnapshot(values);
  if (!snapshot) {
    return {
      values: [],
      invalidSources: [`${scope}:invalid-readback-telemetry-unknown-sources`]
    };
  }
  const invalidSources = [];
  for (let index = 0; index < snapshot.length; index += 1) {
    const value = snapshot[index];
    if (typeof value !== 'string' || !value.trim()) {
      invalidSources.push(
        `${scope}:invalid-readback-telemetry-unknown-source-${index}`
      );
    }
  }
  return {
    values: uniqueStrings(snapshot),
    invalidSources
  };
}

function sourceName(value, fallback = 'unspecified') {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : fallback;
}

function exactNonnegativeInteger(value) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    ? value
    : null;
}

function normalizedTelemetryCounts({
  observedMapAsyncCount = 0,
  observedReadbackBytes = 0,
  observedHostQueueFenceCount = 0,
  finalDiagnosticMapAsyncCount = 0,
  finalDiagnosticReadbackBytes = 0,
  deferredCleanupHostQueueFenceCount = 0,
  awaitedBackpressureHostQueueFenceCount = 0
} = {}, scope = 'unspecified') {
  const rawCounts = {
    observedMapAsyncCount,
    observedReadbackBytes,
    observedHostQueueFenceCount,
    finalDiagnosticMapAsyncCount,
    finalDiagnosticReadbackBytes,
    deferredCleanupHostQueueFenceCount,
    awaitedBackpressureHostQueueFenceCount
  };
  const invalidCounts = [];
  const counts = {};
  for (const [field, value] of Object.entries(rawCounts)) {
    const normalized = exactNonnegativeInteger(value);
    if (normalized == null) {
      invalidCounts.push(`${scope}:invalid-${field}`);
      counts[field] = 0;
    } else {
      counts[field] = normalized;
    }
  }
  if (
    counts.finalDiagnosticMapAsyncCount
      > counts.observedMapAsyncCount
  ) {
    invalidCounts.push(
      `${scope}:final-diagnostic-map-count-exceeds-observed`
    );
  }
  if (
    counts.finalDiagnosticReadbackBytes
      > counts.observedReadbackBytes
  ) {
    invalidCounts.push(
      `${scope}:final-diagnostic-readback-bytes-exceed-observed`
    );
  }
  if (
    counts.deferredCleanupHostQueueFenceCount
      + counts.awaitedBackpressureHostQueueFenceCount
      > counts.observedHostQueueFenceCount
  ) {
    invalidCounts.push(
      `${scope}:classified-host-queue-fence-count-exceeds-observed`
    );
  }
  return { counts, invalidCounts };
}

function sourceBreakdownRecord(source, counts = {}) {
  const normalized = normalizedTelemetryCounts(
    Object.fromEntries(
      SOURCE_BREAKDOWN_COUNT_FIELDS.map((field) => [field, counts[field] ?? 0])
    ),
    source
  ).counts;
  return Object.freeze({
    source: sourceName(source),
    ...normalized,
    unclassifiedMapAsyncCount: Math.max(
      0,
      normalized.observedMapAsyncCount
        - normalized.finalDiagnosticMapAsyncCount
    ),
    unclassifiedReadbackBytes: Math.max(
      0,
      normalized.observedReadbackBytes
        - normalized.finalDiagnosticReadbackBytes
    ),
    unclassifiedHostQueueFenceCount: Math.max(
      0,
      normalized.observedHostQueueFenceCount
        - normalized.deferredCleanupHostQueueFenceCount
        - normalized.awaitedBackpressureHostQueueFenceCount
    )
  });
}

function hasNonzeroTelemetryCount(counts = {}) {
  return SOURCE_BREAKDOWN_COUNT_FIELDS.some((field) => counts[field] > 0);
}

function sumCountRows(rows, field) {
  let total = 0;
  for (const row of rows) {
    const next = total + row[field];
    if (!Number.isSafeInteger(next)) return null;
    total = next;
  }
  return total;
}

function normalizeSourceBreakdown(
  rawBreakdown,
  counts,
  scope,
  {
    requireUnclassifiedCounts = false
  } = {}
) {
  if (rawBreakdown === SOURCE_BREAKDOWN_OMITTED) {
    return {
      rows: hasNonzeroTelemetryCount(counts)
        ? [sourceBreakdownRecord(scope, counts)]
        : [],
      invalidSources: []
    };
  }
  const rawRows = denseOwnDataArraySnapshot(rawBreakdown);
  if (!rawRows) {
    return {
      rows: [],
      invalidSources: [`${scope}:invalid-source-breakdown`]
    };
  }
  const rows = [];
  const invalidSources = [];
  const canonicalSources = new Set();
  for (let index = 0; index < rawRows.length; index += 1) {
    const rawRow = rawRows[index];
    const rowScope = `${scope}:source-${index}`;
    const sourceProperty = ownDataPropertySnapshot(rawRow, 'source');
    if (
      !isNonArrayObject(rawRow)
      || !sourceProperty.present
      || !sourceProperty.data
    ) {
      invalidSources.push(`${rowScope}:invalid-source-breakdown-row`);
      continue;
    }
    const rawSource = sourceProperty.value;
    const resolvedSource = typeof rawSource === 'string'
      ? rawSource.trim()
      : '';
    if (!resolvedSource) {
      invalidSources.push(`${rowScope}:invalid-source-breakdown-source`);
      continue;
    }
    if (canonicalSources.has(resolvedSource)) {
      invalidSources.push(
        `${scope}:${resolvedSource}:duplicate-source-breakdown-source`
      );
      continue;
    }
    canonicalSources.add(resolvedSource);
    const exactCounts = requiredExactTelemetryCounts(
      rawRow,
      SOURCE_BREAKDOWN_COUNT_FIELDS
    );
    if (!exactCounts) {
      invalidSources.push(
        `${scope}:${resolvedSource}:invalid-source-breakdown-counts`
      );
      continue;
    }
    const normalized = normalizedTelemetryCounts(
      exactCounts,
      `${scope}:${resolvedSource}`
    );
    invalidSources.push(...normalized.invalidCounts);
    if (normalized.invalidCounts.length > 0) continue;
    const canonicalRow = sourceBreakdownRecord(
      resolvedSource,
      normalized.counts
    );
    const anyUnclassifiedCountPresent = UNCLASSIFIED_COUNT_FIELDS.some(
      (field) => ownDataPropertySnapshot(rawRow, field).present
    );
    if (requireUnclassifiedCounts || anyUnclassifiedCountPresent) {
      const unclassifiedCounts = requiredExactTelemetryCounts(
        rawRow,
        UNCLASSIFIED_COUNT_FIELDS
      );
      if (
        !unclassifiedCounts
        || UNCLASSIFIED_COUNT_FIELDS.some(
          (field) => unclassifiedCounts[field] !== canonicalRow[field]
        )
      ) {
        invalidSources.push(
          `${scope}:${resolvedSource}:invalid-unclassified-source-breakdown-counts`
        );
        continue;
      }
    }
    rows.push(canonicalRow);
  }
  for (const field of SOURCE_BREAKDOWN_COUNT_FIELDS) {
    const total = sumCountRows(rows, field);
    if (total == null || total !== counts[field]) {
      invalidSources.push(`${scope}:source-breakdown-${field}-mismatch`);
    }
  }
  return { rows, invalidSources };
}

function telemetrySnapshot({
  scope,
  observedMapAsyncCount = 0,
  observedReadbackBytes = 0,
  observedHostQueueFenceCount = 0,
  finalDiagnosticMapAsyncCount = 0,
  finalDiagnosticReadbackBytes = 0,
  deferredCleanupHostQueueFenceCount = 0,
  awaitedBackpressureHostQueueFenceCount = 0,
  sourceBreakdown,
  complete = true,
  unknownSources = []
} = {}) {
  const resolvedScope = sourceName(scope);
  const normalized = normalizedTelemetryCounts({
    observedMapAsyncCount,
    observedReadbackBytes,
    observedHostQueueFenceCount,
    finalDiagnosticMapAsyncCount,
    finalDiagnosticReadbackBytes,
    deferredCleanupHostQueueFenceCount,
    awaitedBackpressureHostQueueFenceCount
  }, resolvedScope);
  const counts = normalized.counts;
  const normalizedBreakdown = normalizeSourceBreakdown(
    sourceBreakdown,
    counts,
    resolvedScope
  );
  const normalizedUnknownSources = normalizedStringList(
    unknownSources,
    resolvedScope
  );
  const resolvedUnknownSources = uniqueStrings([
    ...normalizedUnknownSources.values,
    ...normalizedUnknownSources.invalidSources,
    ...normalized.invalidCounts,
    ...normalizedBreakdown.invalidSources
  ]);
  const resolvedComplete = Boolean(
    complete === true
    && normalized.invalidCounts.length === 0
    && normalizedBreakdown.invalidSources.length === 0
    && resolvedUnknownSources.length === 0
  );
  const unclassifiedMapAsyncCount = Math.max(
    0,
    counts.observedMapAsyncCount - counts.finalDiagnosticMapAsyncCount
  );
  const unclassifiedReadbackBytes = Math.max(
    0,
    counts.observedReadbackBytes - counts.finalDiagnosticReadbackBytes
  );
  const unclassifiedHostQueueFenceCount = Math.max(
    0,
    counts.observedHostQueueFenceCount
      - counts.deferredCleanupHostQueueFenceCount
      - counts.awaitedBackpressureHostQueueFenceCount
  );
  return Object.freeze({
    readbackTelemetrySchema: GPU_READBACK_TELEMETRY_SCHEMA,
    readbackTelemetryScope: resolvedScope,
    readbackTelemetryComplete: resolvedComplete,
    readbackTelemetryUnknownSources: Object.freeze(resolvedUnknownSources),
    ...counts,
    unclassifiedMapAsyncCount,
    unclassifiedReadbackBytes,
    unclassifiedHostQueueFenceCount,
    readbackTelemetrySourceBreakdown: Object.freeze(
      normalizedBreakdown.rows
    ),
    mapAsyncCount: resolvedComplete ? counts.observedMapAsyncCount : null,
    readbackBytes: resolvedComplete ? counts.observedReadbackBytes : null,
    hostQueueFenceCount: resolvedComplete
      ? counts.observedHostQueueFenceCount
      : null,
    normalHotLoopReadbackFree: Boolean(
      resolvedComplete
      && counts.observedMapAsyncCount === 0
      && counts.observedReadbackBytes === 0
      && counts.observedHostQueueFenceCount === 0
    ),
    productionHotLoopHostDependencyFree: Boolean(
      resolvedComplete
      && unclassifiedMapAsyncCount === 0
      && unclassifiedReadbackBytes === 0
      && unclassifiedHostQueueFenceCount === 0
      && counts.awaitedBackpressureHostQueueFenceCount === 0
    )
  });
}

export function createGpuReadbackTelemetry(options = {}) {
  try {
    if (
      !options
      || typeof options !== 'object'
      || Array.isArray(options)
    ) {
      return telemetrySnapshot({
        scope: 'unspecified',
        sourceBreakdown: [],
        complete: false,
        unknownSources: ['unspecified:invalid-telemetry-options']
      });
    }
    const fields = [
      'scope',
      'mapAsyncCount',
      'readbackBytes',
      'hostQueueFenceCount',
      'finalDiagnosticMapAsyncCount',
      'finalDiagnosticReadbackBytes',
      'deferredCleanupHostQueueFenceCount',
      'awaitedBackpressureHostQueueFenceCount',
      'sourceBreakdown',
      'complete',
      'unknownSources'
    ];
    const properties = Object.fromEntries(fields.map((field) => [
      field,
      ownDataPropertySnapshot(options, field)
    ]));
    const option = (field, fallback) => {
      const property = properties[field];
      if (!property.present) return fallback;
      return property.data ? property.value : undefined;
    };
    const scope = option('scope', undefined);
    const resolvedScope = sourceName(scope);
    const invalidProperties = fields
      .filter((field) => (
        properties[field].present && !properties[field].data
      ))
      .map((field) => `${resolvedScope}:invalid-${field}-property`);
    const rawUnknownSources = option('unknownSources', []);
    const unknownSourceRows = denseOwnDataArraySnapshot(rawUnknownSources);
    const unknownSources = unknownSourceRows
      ? [...unknownSourceRows, ...invalidProperties]
      : [
          ...invalidProperties,
          `${resolvedScope}:invalid-readback-telemetry-unknown-sources`
        ];
    return telemetrySnapshot({
      scope,
      observedMapAsyncCount: option('mapAsyncCount', 0),
      observedReadbackBytes: option('readbackBytes', 0),
      observedHostQueueFenceCount: option('hostQueueFenceCount', 0),
      finalDiagnosticMapAsyncCount:
        option('finalDiagnosticMapAsyncCount', 0),
      finalDiagnosticReadbackBytes:
        option('finalDiagnosticReadbackBytes', 0),
      deferredCleanupHostQueueFenceCount:
        option('deferredCleanupHostQueueFenceCount', 0),
      awaitedBackpressureHostQueueFenceCount:
        option('awaitedBackpressureHostQueueFenceCount', 0),
      sourceBreakdown: properties.sourceBreakdown.present
        ? option('sourceBreakdown', null)
        : SOURCE_BREAKDOWN_OMITTED,
      complete: option('complete', true) === true
        && invalidProperties.length === 0,
      unknownSources
    });
  } catch (_) {
    return telemetrySnapshot({
      scope: 'unspecified',
      sourceBreakdown: [],
      complete: false,
      unknownSources: ['unspecified:invalid-telemetry-options']
    });
  }
}

function telemetryEntry(entry, index) {
  const telemetryProperty = ownDataPropertySnapshot(entry, 'telemetry');
  if (
    entry
    && typeof entry === 'object'
    && telemetryProperty.present
  ) {
    const sourceProperty = ownDataPropertySnapshot(entry, 'source');
    const rawSource = sourceProperty.data ? sourceProperty.value : undefined;
    const source = typeof rawSource === 'string' ? rawSource.trim() : '';
    return {
      source: source || `entry-${index}`,
      telemetry: telemetryProperty.data ? telemetryProperty.value : null,
      invalidSource: source && telemetryProperty.data
        ? null
        : `entry-${index}:invalid-outer-entry`
    };
  }
  return {
    source: `entry-${index}`,
    telemetry: entry,
    invalidSource: null
  };
}

function telemetryCount(telemetry, field, { legacyDefault = null } = {}) {
  const property = ownDataPropertySnapshot(telemetry, field);
  if (!property.present) return legacyDefault;
  if (!property.data) return null;
  return exactNonnegativeInteger(property.value);
}

function validateCompleteTelemetryClaims(
  telemetry,
  counts,
  source,
  completeProperty
) {
  if (!completeProperty.data || completeProperty.value !== true) return [];
  const invalidSources = [];
  const countClaims = [
    ['mapAsyncCount', 'observedMapAsyncCount'],
    ['readbackBytes', 'observedReadbackBytes'],
    ['hostQueueFenceCount', 'observedHostQueueFenceCount']
  ];
  for (const [claimField, countField] of countClaims) {
    const property = ownDataPropertySnapshot(telemetry, claimField);
    if (!property.present) continue;
    const claim = property.data
      ? exactNonnegativeInteger(property.value)
      : null;
    if (claim == null || claim !== counts[countField]) {
      invalidSources.push(`${source}:invalid-${claimField}-claim`);
    }
  }
  const expectedUnclassifiedCounts = {
    unclassifiedMapAsyncCount: Math.max(
      0,
      counts.observedMapAsyncCount - counts.finalDiagnosticMapAsyncCount
    ),
    unclassifiedReadbackBytes: Math.max(
      0,
      counts.observedReadbackBytes - counts.finalDiagnosticReadbackBytes
    ),
    unclassifiedHostQueueFenceCount: Math.max(
      0,
      counts.observedHostQueueFenceCount
        - counts.deferredCleanupHostQueueFenceCount
        - counts.awaitedBackpressureHostQueueFenceCount
    )
  };
  for (const [field, expected] of Object.entries(
    expectedUnclassifiedCounts
  )) {
    const property = ownDataPropertySnapshot(telemetry, field);
    if (!property.present) continue;
    const claim = property.data
      ? exactNonnegativeInteger(property.value)
      : null;
    if (claim == null || claim !== expected) {
      invalidSources.push(`${source}:invalid-${field}-claim`);
    }
  }
  const expectedClaims = {
    normalHotLoopReadbackFree: Boolean(
      counts.observedMapAsyncCount === 0
      && counts.observedReadbackBytes === 0
      && counts.observedHostQueueFenceCount === 0
    ),
    productionHotLoopHostDependencyFree: Boolean(
      expectedUnclassifiedCounts.unclassifiedMapAsyncCount === 0
      && expectedUnclassifiedCounts.unclassifiedReadbackBytes === 0
      && expectedUnclassifiedCounts.unclassifiedHostQueueFenceCount === 0
      && counts.awaitedBackpressureHostQueueFenceCount === 0
    )
  };
  for (const [field, expected] of Object.entries(expectedClaims)) {
    const property = ownDataPropertySnapshot(telemetry, field);
    if (!property.present) continue;
    if (
      !property.data
      || typeof property.value !== 'boolean'
      || property.value !== expected
    ) {
      invalidSources.push(`${source}:invalid-${field}-claim`);
    }
  }
  return invalidSources;
}

function hasOwnTelemetryField(telemetry, field) {
  return ownDataPropertySnapshot(telemetry, field).present;
}

function requiredExactTelemetryCounts(telemetry, fields) {
  const counts = {};
  for (const field of fields) {
    const property = ownDataPropertySnapshot(telemetry, field);
    if (!property.present || !property.data) return null;
    const count = exactNonnegativeInteger(property.value);
    if (count == null) return null;
    counts[field] = count;
  }
  return counts;
}

function pageVisibleCountsConserveClassifications(counts) {
  const classifiedMapAsyncCount =
    counts.finalDiagnosticMapAsyncCount
    + counts.unclassifiedMapAsyncCount;
  const classifiedReadbackBytes =
    counts.finalDiagnosticReadbackBytes
    + counts.unclassifiedReadbackBytes;
  const classifiedHostQueueFenceCount =
    counts.deferredCleanupHostQueueFenceCount
    + counts.awaitedBackpressureHostQueueFenceCount
    + counts.unclassifiedHostQueueFenceCount;
  return Boolean(
    Number.isSafeInteger(classifiedMapAsyncCount)
    && Number.isSafeInteger(classifiedReadbackBytes)
    && Number.isSafeInteger(classifiedHostQueueFenceCount)
    && classifiedMapAsyncCount === counts.observedMapAsyncCount
    && classifiedReadbackBytes === counts.observedReadbackBytes
    && classifiedHostQueueFenceCount
      === counts.observedHostQueueFenceCount
  );
}

function pageVisiblePublicAliasesMatchObservedCounts(counts) {
  return Boolean(
    counts.mapAsyncCount === counts.observedMapAsyncCount
    && counts.readbackBytes === counts.observedReadbackBytes
    && counts.hostQueueFenceCount === counts.observedHostQueueFenceCount
  );
}

function pageVisibleExpectedClaims(counts) {
  return {
    normalHotLoopReadbackFree: Boolean(
      counts.observedMapAsyncCount === 0
      && counts.observedReadbackBytes === 0
      && counts.observedHostQueueFenceCount === 0
    ),
    productionHotLoopHostDependencyFree: Boolean(
      counts.unclassifiedMapAsyncCount === 0
      && counts.unclassifiedReadbackBytes === 0
      && counts.unclassifiedHostQueueFenceCount === 0
      && counts.awaitedBackpressureHostQueueFenceCount === 0
    )
  };
}

function normalizedPageVisibleSourceBreakdown(telemetry, counts) {
  const breakdownProperty = ownDataPropertySnapshot(
    telemetry,
    'readbackTelemetrySourceBreakdown'
  );
  const rawRows = breakdownProperty.data
    ? denseOwnDataArraySnapshot(breakdownProperty.value)
    : null;
  if (
    !breakdownProperty.present
    || !breakdownProperty.data
    || !rawRows
  ) {
    return null;
  }
  const totals = Object.fromEntries(
    PAGE_VISIBLE_SOURCE_BREAKDOWN_COUNT_FIELDS.map((field) => [field, 0])
  );
  const canonicalSources = new Set();
  const rows = [];
  for (const row of rawRows) {
    const sourceProperty = ownDataPropertySnapshot(row, 'source');
    if (
      !isNonArrayObject(row)
      || !sourceProperty.present
      || !sourceProperty.data
    ) {
      return null;
    }
    const rawSource = sourceProperty.value;
    const canonicalSource = typeof rawSource === 'string'
      ? rawSource.trim()
      : '';
    if (!canonicalSource || canonicalSources.has(canonicalSource)) {
      return null;
    }
    canonicalSources.add(canonicalSource);
    const rowCounts = requiredExactTelemetryCounts(
      row,
      PAGE_VISIBLE_SOURCE_BREAKDOWN_COUNT_FIELDS
    );
    if (
      !rowCounts
      || !pageVisibleCountsConserveClassifications(rowCounts)
    ) {
      return null;
    }
    for (const field of PAGE_VISIBLE_SOURCE_BREAKDOWN_COUNT_FIELDS) {
      const next = totals[field] + rowCounts[field];
      if (!Number.isSafeInteger(next)) return null;
      totals[field] = next;
    }
    rows.push({
      source: canonicalSource,
      ...rowCounts
    });
  }
  return PAGE_VISIBLE_SOURCE_BREAKDOWN_COUNT_FIELDS.every(
    (field) => totals[field] === counts[field]
  )
    ? rows
    : null;
}

function completePageVisibleTelemetryValidation(
  telemetry,
  {
    completeProperty,
    unknownSourcesProperty,
    unknownSources
  }
) {
  const schemaProperty = ownDataPropertySnapshot(
    telemetry,
    'readbackTelemetrySchema'
  );
  if (
    Array.isArray(telemetry)
    || !schemaProperty.present
    || !schemaProperty.data
    || schemaProperty.value !== GPU_READBACK_TELEMETRY_SCHEMA
    || !completeProperty.present
    || !completeProperty.data
    || completeProperty.value !== true
    || !unknownSourcesProperty.present
    || !unknownSourcesProperty.data
    || !unknownSources
    || unknownSources.length !== 0
  ) {
    return null;
  }
  const counts = requiredExactTelemetryCounts(
    telemetry,
    PAGE_VISIBLE_GPU_READBACK_COUNT_FIELDS
  );
  const sourceBreakdown = counts
    ? normalizedPageVisibleSourceBreakdown(telemetry, counts)
    : null;
  if (
    !counts
    || !pageVisibleCountsConserveClassifications(counts)
    || !pageVisiblePublicAliasesMatchObservedCounts(counts)
    || !sourceBreakdown
  ) {
    return null;
  }
  const expectedClaims = pageVisibleExpectedClaims(counts);
  for (const [field, expected] of Object.entries(expectedClaims)) {
    const claim = ownDataPropertySnapshot(telemetry, field);
    if (!claim.present) continue;
    if (!claim.data || typeof claim.value !== 'boolean' || claim.value !== expected) {
      return null;
    }
  }
  return { counts, expectedClaims, sourceBreakdown, unknownSources };
}

function pageVisibleUnknownSourcesOrNull(property) {
  const values = property.data
    ? denseOwnDataArraySnapshot(property.value)
    : null;
  if (
    !property.present
    || !property.data
    || !values
    || values.some((value) => typeof value !== 'string' || !value.trim())
  ) return null;
  return values;
}

const PAGE_VISIBLE_TELEMETRY_SNAPSHOT_FIELDS = Object.freeze([
  'readbackTelemetrySchema',
  'readbackTelemetryComplete',
  'readbackTelemetryUnknownSources',
  'readbackTelemetrySourceBreakdown',
  ...PAGE_VISIBLE_GPU_READBACK_COUNT_FIELDS,
  'normalHotLoopReadbackFree',
  'productionHotLoopHostDependencyFree'
]);

function defineSnapshottedProperty(target, field, property) {
  if (!property.present) return;
  if (property.data) {
    Object.defineProperty(target, field, {
      configurable: true,
      enumerable: true,
      writable: false,
      value: property.value
    });
    return;
  }
  // Preserve "present but not an own data property" without executing an
  // accessor. Downstream validators will reject this descriptor.
  Object.defineProperty(target, field, {
    configurable: true,
    enumerable: true,
    get: undefined
  });
}

function pageVisibleTelemetryAuthoritySnapshot(telemetry) {
  if (!telemetry || typeof telemetry !== 'object') return {};
  if (Array.isArray(telemetry)) return [];
  const properties = Object.fromEntries(
    PAGE_VISIBLE_TELEMETRY_SNAPSHOT_FIELDS.map((field) => [
      field,
      ownDataPropertySnapshot(telemetry, field)
    ])
  );
  const snapshot = {};
  for (const field of PAGE_VISIBLE_TELEMETRY_SNAPSHOT_FIELDS) {
    if (
      field === 'readbackTelemetryUnknownSources'
      || field === 'readbackTelemetrySourceBreakdown'
    ) continue;
    defineSnapshottedProperty(snapshot, field, properties[field]);
  }

  const unknownProperty = properties.readbackTelemetryUnknownSources;
  if (unknownProperty.data) {
    const unknownRows = denseOwnDataArraySnapshot(unknownProperty.value);
    defineSnapshottedProperty(snapshot, 'readbackTelemetryUnknownSources',
      unknownRows
        ? { present: true, data: true, value: unknownRows }
        : { present: true, data: false, value: undefined });
  } else {
    defineSnapshottedProperty(
      snapshot,
      'readbackTelemetryUnknownSources',
      unknownProperty
    );
  }

  const breakdownProperty = properties.readbackTelemetrySourceBreakdown;
  if (breakdownProperty.data) {
    const rawRows = denseOwnDataArraySnapshot(breakdownProperty.value);
    if (!rawRows) {
      defineSnapshottedProperty(
        snapshot,
        'readbackTelemetrySourceBreakdown',
        { present: true, data: false, value: undefined }
      );
    } else {
      const rows = rawRows.map((row) => {
        if (!isNonArrayObject(row)) return null;
        const rowSnapshot = {};
        for (const field of [
          'source',
          ...PAGE_VISIBLE_SOURCE_BREAKDOWN_COUNT_FIELDS
        ]) {
          defineSnapshottedProperty(
            rowSnapshot,
            field,
            ownDataPropertySnapshot(row, field)
          );
        }
        return rowSnapshot;
      });
      defineSnapshottedProperty(
        snapshot,
        'readbackTelemetrySourceBreakdown',
        { present: true, data: true, value: rows }
      );
    }
  } else {
    defineSnapshottedProperty(
      snapshot,
      'readbackTelemetrySourceBreakdown',
      breakdownProperty
    );
  }
  return snapshot;
}

/**
 * Normalize untrusted telemetry before it reaches page/UI or probe artifacts.
 * A claimed-complete v1 record is revalidated from its exact counters and
 * source breakdown; the completeness bit is never trusted on its own.
 */
function normalizePageVisibleGpuReadbackTelemetryUnchecked(telemetry = null) {
  const source = telemetry && typeof telemetry === 'object'
    ? telemetry
    : {};
  const completeProperty = ownDataPropertySnapshot(
    source,
    'readbackTelemetryComplete'
  );
  const unknownSourcesProperty = ownDataPropertySnapshot(
    source,
    'readbackTelemetryUnknownSources'
  );
  const unknownSources = pageVisibleUnknownSourcesOrNull(
    unknownSourcesProperty
  );
  const declaredComplete = completeProperty.data
    && typeof completeProperty.value === 'boolean'
      ? completeProperty.value
      : null;
  const validation = declaredComplete === true
    ? completePageVisibleTelemetryValidation(source, {
        completeProperty,
        unknownSourcesProperty,
        unknownSources
      })
    : null;
  const complete = validation !== null;
  const legacyExactZeroProductionEvidence = complete
    ? null
    : legacyExactZeroGpuReadbackProductionEvidenceUnchecked(source);
  const counts = Object.fromEntries(
    PAGE_VISIBLE_GPU_READBACK_COUNT_FIELDS.map((field) => [
      field,
      complete ? validation.counts[field] : null
    ])
  );
  const failClosedClaim = (field) => {
    const claim = ownDataPropertySnapshot(source, field);
    return claim.data && claim.value === false ? false : null;
  };
  return {
    readbackTelemetryComplete: complete
      ? true
      : (declaredComplete == null ? null : false),
    readbackTelemetryUnknownSources: complete
      ? [...validation.unknownSources]
      : unknownSources,
    ...counts,
    readbackTelemetrySourceBreakdown: complete
      ? validation.sourceBreakdown.map((row) => ({ ...row }))
      : null,
    normalHotLoopReadbackFree: complete
      ? validation.expectedClaims.normalHotLoopReadbackFree
      : failClosedClaim('normalHotLoopReadbackFree'),
    productionHotLoopHostDependencyFree: complete
      ? validation.expectedClaims.productionHotLoopHostDependencyFree
      : failClosedClaim('productionHotLoopHostDependencyFree'),
    legacyExactZeroProductionEvidence
  };
}

export function normalizePageVisibleGpuReadbackTelemetry(telemetry = null) {
  try {
    return normalizePageVisibleGpuReadbackTelemetryUnchecked(
      pageVisibleTelemetryAuthoritySnapshot(telemetry)
    );
  } catch (_) {
    return {
      readbackTelemetryComplete: false,
      readbackTelemetryUnknownSources: null,
      ...Object.fromEntries(
        PAGE_VISIBLE_GPU_READBACK_COUNT_FIELDS.map((field) => [field, null])
      ),
      readbackTelemetrySourceBreakdown: null,
      normalHotLoopReadbackFree: null,
      productionHotLoopHostDependencyFree: null,
      legacyExactZeroProductionEvidence: null
    };
  }
}

function optionalLegacyZeroCountsAreValid(telemetry) {
  for (const field of PAGE_VISIBLE_GPU_READBACK_COUNT_FIELDS) {
    const property = ownDataPropertySnapshot(telemetry, field);
    if (!property.present) continue;
    if (!property.data || exactNonnegativeInteger(property.value) !== 0) {
      return false;
    }
  }
  return true;
}

function optionalLegacyZeroBreakdownIsValid(telemetry) {
  const breakdownProperty = ownDataPropertySnapshot(
    telemetry,
    'readbackTelemetrySourceBreakdown'
  );
  if (!breakdownProperty.present) return true;
  if (!breakdownProperty.data) return false;
  const rows = denseOwnDataArraySnapshot(breakdownProperty.value);
  if (!rows) return false;
  const canonicalSources = new Set();
  for (const row of rows) {
    const sourceProperty = ownDataPropertySnapshot(row, 'source');
    if (
      !isNonArrayObject(row)
      || !sourceProperty.present
      || !sourceProperty.data
    ) {
      return false;
    }
    const rawSource = sourceProperty.value;
    const canonicalSource = typeof rawSource === 'string'
      ? rawSource.trim()
      : '';
    if (!canonicalSource || canonicalSources.has(canonicalSource)) {
      return false;
    }
    canonicalSources.add(canonicalSource);
    const counts = requiredExactTelemetryCounts(
      row,
      PAGE_VISIBLE_SOURCE_BREAKDOWN_COUNT_FIELDS
    );
    if (!(
      counts
      && pageVisibleCountsConserveClassifications(counts)
      && PAGE_VISIBLE_SOURCE_BREAKDOWN_COUNT_FIELDS.every(
        (field) => counts[field] === 0
      )
    )) return false;
  }
  return true;
}

/**
 * Compatibility proof for old v1 records that predate the classified
 * production claim. Strict zero observed counts imply the narrower production
 * claim, but only when the legacy record itself has exact complete evidence.
 */
function legacyExactZeroGpuReadbackProductionEvidenceUnchecked(source) {
    if (!source || Array.isArray(source)) return null;
    const schemaProperty = ownDataPropertySnapshot(
      source,
      'readbackTelemetrySchema'
    );
    const completeProperty = ownDataPropertySnapshot(
      source,
      'readbackTelemetryComplete'
    );
    const unknownSourcesProperty = ownDataPropertySnapshot(
      source,
      'readbackTelemetryUnknownSources'
    );
    const strictClaimProperty = ownDataPropertySnapshot(
      source,
      'normalHotLoopReadbackFree'
    );
    const productionClaimProperty = ownDataPropertySnapshot(
      source,
      'productionHotLoopHostDependencyFree'
    );
    const unknownSources = unknownSourcesProperty.data
      ? denseOwnDataArraySnapshot(unknownSourcesProperty.value)
      : null;
    if (
      !schemaProperty.data
      || schemaProperty.value !== GPU_READBACK_TELEMETRY_SCHEMA
      || !completeProperty.data
      || completeProperty.value !== true
      || !unknownSourcesProperty.data
      || !unknownSources
      || unknownSources.length !== 0
      || !strictClaimProperty.data
      || strictClaimProperty.value !== true
      || productionClaimProperty.present
    ) return null;
    const observedCounts = requiredExactTelemetryCounts(
      source,
      OBSERVED_COUNT_FIELDS
    );
    return observedCounts
      && OBSERVED_COUNT_FIELDS.every((field) => observedCounts[field] === 0)
      && optionalLegacyZeroCountsAreValid(source)
      && optionalLegacyZeroBreakdownIsValid(source)
      ? true
      : null;
}

export function legacyExactZeroGpuReadbackProductionEvidence(
  telemetry = null
) {
  try {
    return legacyExactZeroGpuReadbackProductionEvidenceUnchecked(
      pageVisibleTelemetryAuthoritySnapshot(telemetry)
    );
  } catch (_) {
    return null;
  }
}

function prefixSourceBreakdown(source, telemetry, counts) {
  const breakdownProperty = ownDataPropertySnapshot(
    telemetry,
    'readbackTelemetrySourceBreakdown'
  );
  if (!breakdownProperty.present) {
    return {
      rows: hasNonzeroTelemetryCount(counts)
        ? [sourceBreakdownRecord(source, counts)]
        : [],
      invalidSources: []
    };
  }
  if (!breakdownProperty.data) {
    return {
      rows: [],
      invalidSources: [`${source}:invalid-source-breakdown`]
    };
  }
  const rawBreakdown = breakdownProperty.value;
  const normalized = normalizeSourceBreakdown(
    rawBreakdown,
    counts,
    source,
    { requireUnclassifiedCounts: true }
  );
  return {
    rows: normalized.rows.map((row) => sourceBreakdownRecord(
      `${source}:${sourceName(row?.source, 'unspecified')}`,
      row
    )),
    invalidSources: normalized.invalidSources
  };
}

export function mergeGpuReadbackTelemetry(entries = [], {
  scope = 'merged-gpu-readback-telemetry'
} = {}) {
  const totals = Object.fromEntries(
    SOURCE_BREAKDOWN_COUNT_FIELDS.map((field) => [field, 0])
  );
  let complete = true;
  const unknownSources = [];
  const sourceBreakdown = [];
  const outerSources = new Set();
  let entryRows = null;
  try {
    entryRows = denseOwnDataArraySnapshot(entries);
  } catch (_) {
    entryRows = null;
  }
  if (!entryRows) {
    complete = false;
    unknownSources.push(`${scope}:invalid-telemetry-entry-array`);
    entryRows = [];
  }
  const addCounts = (counts, source) => {
    for (const field of SOURCE_BREAKDOWN_COUNT_FIELDS) {
      const next = totals[field] + counts[field];
      if (!Number.isSafeInteger(next)) {
        complete = false;
        unknownSources.push(`${source}:unsafe-${field}-sum`);
        continue;
      }
      totals[field] = next;
    }
  };
  for (let index = 0; index < entryRows.length; index += 1) {
    const rawEntry = entryRows[index];
    const {
      source,
      telemetry,
      invalidSource
    } = telemetryEntry(rawEntry, index);
    if (invalidSource) {
      complete = false;
      unknownSources.push(invalidSource);
    }
    if (outerSources.has(source)) {
      complete = false;
      unknownSources.push(`${source}:duplicate-outer-source`);
    } else {
      outerSources.add(source);
    }
    const schemaProperty = ownDataPropertySnapshot(
      telemetry,
      'readbackTelemetrySchema'
    );
    const completeProperty = ownDataPropertySnapshot(
      telemetry,
      'readbackTelemetryComplete'
    );
    if (
      !telemetry
      || typeof telemetry !== 'object'
      || !schemaProperty.present
      || !schemaProperty.data
      || schemaProperty.value !== GPU_READBACK_TELEMETRY_SCHEMA
    ) {
      complete = false;
      unknownSources.push(source);
      continue;
    }
    const rawCounts = {
      observedMapAsyncCount: telemetryCount(
        telemetry,
        'observedMapAsyncCount'
      ),
      observedReadbackBytes: telemetryCount(
        telemetry,
        'observedReadbackBytes'
      ),
      observedHostQueueFenceCount: telemetryCount(
        telemetry,
        'observedHostQueueFenceCount'
      ),
      finalDiagnosticMapAsyncCount: telemetryCount(
        telemetry,
        'finalDiagnosticMapAsyncCount',
        { legacyDefault: 0 }
      ),
      finalDiagnosticReadbackBytes: telemetryCount(
        telemetry,
        'finalDiagnosticReadbackBytes',
        { legacyDefault: 0 }
      ),
      deferredCleanupHostQueueFenceCount: telemetryCount(
        telemetry,
        'deferredCleanupHostQueueFenceCount',
        { legacyDefault: 0 }
      ),
      awaitedBackpressureHostQueueFenceCount: telemetryCount(
        telemetry,
        'awaitedBackpressureHostQueueFenceCount',
        { legacyDefault: 0 }
      )
    };
    const invalidObserved = OBSERVED_COUNT_FIELDS.some(
      (field) => rawCounts[field] == null
    );
    const invalidClassified = CLASSIFIED_COUNT_FIELDS.some(
      (field) => rawCounts[field] == null
    );
    if (invalidObserved || invalidClassified) {
      complete = false;
      unknownSources.push(
        `${source}:${invalidObserved
          ? 'invalid-observed-count'
          : 'invalid-classified-count'}`
      );
    }
    const normalized = normalizedTelemetryCounts(
      Object.fromEntries(
        SOURCE_BREAKDOWN_COUNT_FIELDS.map(
          (field) => [field, rawCounts[field] ?? 0]
        )
      ),
      source
    );
    if (normalized.invalidCounts.length > 0) {
      complete = false;
      unknownSources.push(...normalized.invalidCounts);
    }
    const invalidClaims = validateCompleteTelemetryClaims(
      telemetry,
      normalized.counts,
      source,
      completeProperty
    );
    if (invalidClaims.length > 0) {
      complete = false;
      unknownSources.push(...invalidClaims);
    }
    addCounts(normalized.counts, source);
    const prefixedBreakdown = prefixSourceBreakdown(
      source,
      telemetry,
      normalized.counts
    );
    sourceBreakdown.push(...prefixedBreakdown.rows);
    if (prefixedBreakdown.invalidSources.length > 0) {
      complete = false;
      unknownSources.push(...prefixedBreakdown.invalidSources);
    }
    const nestedUnknownSourcesProperty = ownDataPropertySnapshot(
      telemetry,
      'readbackTelemetryUnknownSources'
    );
    const normalizedNestedUnknownSources = normalizedStringList(
      nestedUnknownSourcesProperty.data
        ? nestedUnknownSourcesProperty.value
        : null,
      source
    );
    const nestedUnknownSources = normalizedNestedUnknownSources.values;
    if (normalizedNestedUnknownSources.invalidSources.length > 0) {
      complete = false;
      unknownSources.push(
        ...normalizedNestedUnknownSources.invalidSources
      );
    }
    if (nestedUnknownSources.length > 0) {
      complete = false;
      unknownSources.push(
        ...nestedUnknownSources.map((nested) => `${source}:${nested}`)
      );
    }
    if (!completeProperty.data || completeProperty.value !== true) {
      complete = false;
      if (
        normalizedNestedUnknownSources.invalidSources.length === 0
        && nestedUnknownSources.length === 0
      ) {
        unknownSources.push(source);
      }
    }
  }
  return telemetrySnapshot({
    scope,
    ...totals,
    sourceBreakdown,
    complete,
    unknownSources
  });
}

export function appendGpuReadbackTelemetryObservation(
  target,
  observation = {},
  {
    source = 'appended-observation',
    scope = target?.readbackTelemetryScope
      || 'appended-gpu-readback-telemetry'
  } = {}
) {
  if (!target || typeof target !== 'object' || !Object.isExtensible(target)) {
    throw new TypeError(
      'appendGpuReadbackTelemetryObservation requires an extensible object target'
    );
  }
  const resolvedSource = sourceName(source, 'appended-observation');
  const delta = createGpuReadbackTelemetry({
    ...observation,
    scope: observation?.scope
      || `${sourceName(scope, 'appended-gpu-readback-telemetry')}:${resolvedSource}`
  });
  const merged = mergeGpuReadbackTelemetry([
    { source: 'existing', telemetry: target },
    { source: resolvedSource, telemetry: delta }
  ], {
    scope: sourceName(scope, 'appended-gpu-readback-telemetry')
  });
  Object.assign(target, merged);
  return target;
}

export function createGpuReadbackTelemetryAccumulator({
  scope = 'accumulated-gpu-readback-telemetry'
} = {}) {
  const resolvedScope = sourceName(scope, 'accumulated-gpu-readback-telemetry');
  const totals = Object.fromEntries(
    SOURCE_BREAKDOWN_COUNT_FIELDS.map((field) => [field, 0])
  );
  let complete = true;
  const unknownSources = [];
  const sourceRows = new Map();

  const markInvalid = (source) => {
    complete = false;
    unknownSources.push(source);
  };

  const recordCounts = (counts, source = resolvedScope) => {
    const resolvedSource = sourceName(source, resolvedScope);
    const normalized = normalizedTelemetryCounts(counts, resolvedSource);
    if (normalized.invalidCounts.length > 0) {
      normalized.invalidCounts.forEach(markInvalid);
      return false;
    }
    for (const field of SOURCE_BREAKDOWN_COUNT_FIELDS) {
      const next = totals[field] + normalized.counts[field];
      if (!Number.isSafeInteger(next)) {
        markInvalid(`${resolvedSource}:unsafe-${field}-sum`);
        return false;
      }
    }
    const prior = sourceRows.get(resolvedSource)
      || Object.fromEntries(
        SOURCE_BREAKDOWN_COUNT_FIELDS.map((field) => [field, 0])
      );
    for (const field of SOURCE_BREAKDOWN_COUNT_FIELDS) {
      const next = prior[field] + normalized.counts[field];
      if (!Number.isSafeInteger(next)) {
        markInvalid(`${resolvedSource}:unsafe-source-${field}-sum`);
        return false;
      }
    }
    for (const field of SOURCE_BREAKDOWN_COUNT_FIELDS) {
      totals[field] += normalized.counts[field];
      prior[field] += normalized.counts[field];
    }
    if (hasNonzeroTelemetryCount(prior)) {
      sourceRows.set(resolvedSource, prior);
    }
    return true;
  };

  return Object.freeze({
    recordMapAsync(byteLength = 0, source = resolvedScope) {
      const bytes = exactNonnegativeInteger(byteLength);
      if (bytes == null) {
        markInvalid(`${resolvedScope}:invalid-map-byte-length`);
        return false;
      }
      return recordCounts({
        observedMapAsyncCount: 1,
        observedReadbackBytes: bytes
      }, source);
    },
    recordFinalDiagnosticMapAsync(
      byteLength = 0,
      source = resolvedScope
    ) {
      const bytes = exactNonnegativeInteger(byteLength);
      if (bytes == null) {
        markInvalid(`${resolvedScope}:invalid-final-diagnostic-map-byte-length`);
        return false;
      }
      return recordCounts({
        observedMapAsyncCount: 1,
        observedReadbackBytes: bytes,
        finalDiagnosticMapAsyncCount: 1,
        finalDiagnosticReadbackBytes: bytes
      }, source);
    },
    recordHostQueueFence(count = 1, source = resolvedScope) {
      const fences = exactNonnegativeInteger(count);
      if (fences == null) {
        markInvalid(`${resolvedScope}:invalid-host-queue-fence-count`);
        return false;
      }
      return recordCounts({
        observedHostQueueFenceCount: fences
      }, source);
    },
    recordDeferredCleanupHostQueueFence(
      count = 1,
      source = resolvedScope
    ) {
      const fences = exactNonnegativeInteger(count);
      if (fences == null) {
        markInvalid(`${resolvedScope}:invalid-deferred-cleanup-fence-count`);
        return false;
      }
      return recordCounts({
        observedHostQueueFenceCount: fences,
        deferredCleanupHostQueueFenceCount: fences
      }, source);
    },
    recordAwaitedBackpressureHostQueueFence(
      count = 1,
      source = resolvedScope
    ) {
      const fences = exactNonnegativeInteger(count);
      if (fences == null) {
        markInvalid(`${resolvedScope}:invalid-awaited-backpressure-fence-count`);
        return false;
      }
      return recordCounts({
        observedHostQueueFenceCount: fences,
        awaitedBackpressureHostQueueFenceCount: fences
      }, source);
    },
    merge(telemetry, source = 'nested-source') {
      const merged = mergeGpuReadbackTelemetry(
        [{ source, telemetry }],
        { scope: `${resolvedScope}:${source}` }
      );
      const recorded = recordCounts(
        Object.fromEntries(
          SOURCE_BREAKDOWN_COUNT_FIELDS.map(
            (field) => [field, merged[field]]
          )
        ),
        source
      );
      if (merged.readbackTelemetryComplete !== true) {
        complete = false;
        unknownSources.push(...merged.readbackTelemetryUnknownSources);
      }
      return recorded && merged.readbackTelemetryComplete === true;
    },
    markUnknown(source = 'unknown-source') {
      markInvalid(sourceName(source, 'unknown-source'));
    },
    snapshot() {
      return telemetrySnapshot({
        scope: resolvedScope,
        ...totals,
        sourceBreakdown: [...sourceRows.entries()].map(
          ([source, counts]) => ({ source, ...counts })
        ),
        complete,
        unknownSources
      });
    }
  });
}
