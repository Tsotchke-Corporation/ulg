import { ULG_FIELD_OBSERVERS_SCHEMA } from './observers.js';

export const ULG_FIELD_CLOSURE_SAMPLES_SCHEMA = 'peercompute.ulg.field-closure-samples.v0';
export const ULG_FIELD_CLOSURE_SAMPLE_SUMMARY_SCHEMA = 'peercompute.ulg.field-closure-sample-summary.v0';
export const ULG_CLOSURE_REFRESH_REQUEST_SCHEMA = 'peercompute.ulg.closure-refresh-request.v0';

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TypeError(`${label} must be finite`);
  }
  return number;
}

function finiteNumberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function requireFieldObservers(fieldObservers) {
  if (!fieldObservers || fieldObservers.schema !== ULG_FIELD_OBSERVERS_SCHEMA) {
    throw new TypeError(`fieldObservers.schema must be ${ULG_FIELD_OBSERVERS_SCHEMA}`);
  }
  if (!Array.isArray(fieldObservers.observers)) {
    throw new TypeError('fieldObservers.observers must be an array');
  }
}

function readDerivative(sample, closureHandle) {
  return finiteNumberOrNull(
    sample?.derivatives?.[closureHandle.derivativeName]
      ?? sample?.derivatives?.dEdr
  );
}

function inputBounds(samples) {
  const values = samples
    .map((sample) => finiteNumberOrNull(sample.inputValue))
    .filter((value) => value != null);
  return {
    min: values.length > 0 ? Math.min(...values) : null,
    max: values.length > 0 ? Math.max(...values) : null
  };
}

function validityStatus({ samples, outOfRangeSamples, nullFieldCount }) {
  if (outOfRangeSamples.length > 0) return 'out-of-range';
  if (samples.length > 0 && nullFieldCount === 0) return 'in-range';
  if (samples.length > 0) return 'partial-in-range';
  return 'unresolved';
}

function refreshRequestValidationFlags() {
  return {
    scientificValidation: false,
    fullPhysicsValidation: false,
    materialValidation: false,
    eosValidation: false,
    sphValidation: false,
    phaseChangeValidation: false
  };
}

function createClosureRefreshRequest({
  closureHandle,
  fieldName,
  axisName,
  samples,
  outOfRangeSamples,
  nullFieldCount
}) {
  const outOfRangeBounds = inputBounds(outOfRangeSamples);
  const refreshRecommended = outOfRangeSamples.length > 0;
  return {
    schema: ULG_CLOSURE_REFRESH_REQUEST_SCHEMA,
    status: refreshRecommended ? 'refresh-recommended' : 'not-needed',
    reason: refreshRecommended ? 'observed-field-outside-closure-domain' : null,
    sourceSchema: ULG_FIELD_CLOSURE_SAMPLE_SUMMARY_SCHEMA,
    sourceKind: 'observed-scalar-field-table-sample-reference',
    closureId: closureHandle.closureId || null,
    closureKind: closureHandle.closureKind || null,
    fieldName,
    axisName,
    outputName: closureHandle.outputName || null,
    observedSampleCount: samples.length + outOfRangeSamples.length + nullFieldCount,
    inRangeSampleCount: samples.length,
    outOfRangeCount: outOfRangeSamples.length,
    nullFieldCount,
    minOutOfRangeInput: outOfRangeBounds.min,
    maxOutOfRangeInput: outOfRangeBounds.max,
    registryAction: refreshRecommended ? 'invalidate-and-rerun-closure-derive' : 'none',
    invalidationRecommended: refreshRecommended,
    refreshRecommended,
    ...refreshRequestValidationFlags()
  };
}

/**
 * Build a refresh request from a single closure-domain-exit event (e.g. a carrier
 * integration step that left the closure's sampled validity domain). Produces the same
 * `ULG_CLOSURE_REFRESH_REQUEST_SCHEMA` shape as the field-sampling path so downstream
 * consumers (registry invalidation, PeerCompute projection) read one contract. Closure
 * and provenance evidence only — never asserts material/EOS/SPH/phase validation.
 */
export function createClosureDomainExitRefreshRequest({
  closureId = null,
  closureKind = null,
  outputName = null,
  axisName = 'r',
  fieldName = null,
  inputValue,
  domain = null,
  reason = 'observed-field-outside-closure-domain',
  detail = null
} = {}) {
  const offendingInput = finiteNumberOrNull(inputValue);
  return {
    schema: ULG_CLOSURE_REFRESH_REQUEST_SCHEMA,
    status: 'refresh-recommended',
    reason: reason || 'observed-field-outside-closure-domain',
    detail,
    sourceSchema: ULG_CLOSURE_REFRESH_REQUEST_SCHEMA,
    sourceKind: 'carrier-runtime-closure-domain-exit',
    closureId,
    closureKind,
    fieldName: fieldName || axisName,
    axisName,
    outputName,
    domainMin: Array.isArray(domain) ? finiteNumberOrNull(domain[0]) : null,
    domainMax: Array.isArray(domain) ? finiteNumberOrNull(domain[1]) : null,
    observedSampleCount: 1,
    inRangeSampleCount: 0,
    outOfRangeCount: 1,
    nullFieldCount: 0,
    minOutOfRangeInput: offendingInput,
    maxOutOfRangeInput: offendingInput,
    registryAction: 'invalidate-and-rerun-closure-derive',
    invalidationRecommended: true,
    refreshRecommended: true,
    ...refreshRequestValidationFlags()
  };
}

function summarizeSamples({
  closureHandle,
  fieldName,
  axisName,
  samples,
  outOfRangeSamples,
  nullFieldCount
}) {
  const inputValues = samples.map((sample) => sample.inputValue);
  const sampledValues = samples.map((sample) => sample.sampledValue);
  const derivatives = samples
    .map((sample) => sample.sampledDerivative)
    .filter((value) => value != null);
  const status = samples.length > 0 && outOfRangeSamples.length === 0 && nullFieldCount === 0
    ? 'pass'
    : 'warn';
  const refreshRequest = createClosureRefreshRequest({
    closureHandle,
    fieldName,
    axisName,
    samples,
    outOfRangeSamples,
    nullFieldCount
  });
  return {
    schema: ULG_FIELD_CLOSURE_SAMPLE_SUMMARY_SCHEMA,
    status,
    validityStatus: validityStatus({ samples, outOfRangeSamples, nullFieldCount }),
    sampleKind: 'observed-scalar-field-table-sample-reference',
    closureId: closureHandle.closureId || null,
    closureKind: closureHandle.closureKind || null,
    fieldName,
    axisName,
    outputName: closureHandle.outputName || null,
    sampleCount: samples.length,
    outOfRangeCount: outOfRangeSamples.length,
    nullFieldCount,
    minInput: inputValues.length > 0 ? Math.min(...inputValues) : null,
    maxInput: inputValues.length > 0 ? Math.max(...inputValues) : null,
    minSampledValue: sampledValues.length > 0 ? Math.min(...sampledValues) : null,
    maxSampledValue: sampledValues.length > 0 ? Math.max(...sampledValues) : null,
    maxAbsDerivative: derivatives.length > 0
      ? derivatives.reduce((max, value) => Math.max(max, Math.abs(value)), 0)
      : null,
    closureRefreshRequest: refreshRequest,
    closureRefreshRecommended: refreshRequest.refreshRecommended,
    closureInvalidationRecommended: refreshRequest.invalidationRecommended,
    closureRefreshReason: refreshRequest.reason,
    closureRefreshRegistryAction: refreshRequest.registryAction,
    scientificValidation: false,
    fullPhysicsValidation: false,
    materialValidation: false,
    eosValidation: false,
    sphValidation: false,
    phaseChangeValidation: false
  };
}

export function evaluateFieldClosureSamples({
  fieldObservers,
  closureHandle,
  fieldName = null,
  axisName = null
} = {}) {
  requireFieldObservers(fieldObservers);
  if (!closureHandle?.sample) {
    throw new TypeError('evaluateFieldClosureSamples requires a closure handle');
  }
  const resolvedAxisName = axisName || closureHandle.axisName || 'r';
  const resolvedFieldName = fieldName || resolvedAxisName;
  if (!fieldObservers.observedFieldNames?.includes(resolvedFieldName)) {
    throw new Error(`fieldObservers missing observed scalar field: ${resolvedFieldName}`);
  }
  const samples = [];
  const outOfRangeSamples = [];
  let nullFieldCount = 0;
  for (const observer of fieldObservers.observers) {
    const rawValue = observer?.observedFields?.[resolvedFieldName];
    const inputValue = finiteNumberOrNull(rawValue);
    if (inputValue == null) {
      nullFieldCount += 1;
      continue;
    }
    try {
      const sample = closureHandle.sample({ [resolvedAxisName]: inputValue });
      samples.push({
        observerId: observer.id || null,
        observerIndex: Number.isInteger(observer.index) ? observer.index : null,
        fieldName: resolvedFieldName,
        axisName: resolvedAxisName,
        inputValue: finiteNumber(inputValue, 'inputValue'),
        closureId: closureHandle.closureId || null,
        outputName: closureHandle.outputName || null,
        sampledValue: finiteNumber(sample.value, 'sample.value'),
        sampledDerivative: readDerivative(sample, closureHandle),
        status: sample.status || 'sampled'
      });
    } catch (error) {
      if (error instanceof RangeError) {
        outOfRangeSamples.push({
          observerId: observer.id || null,
          observerIndex: Number.isInteger(observer.index) ? observer.index : null,
          fieldName: resolvedFieldName,
          axisName: resolvedAxisName,
          inputValue,
          reason: error.message
        });
        continue;
      }
      throw error;
    }
  }
  return {
    schema: ULG_FIELD_CLOSURE_SAMPLES_SCHEMA,
    sampleKind: 'observed-scalar-field-table-sample-reference',
    closureId: closureHandle.closureId || null,
    closureKind: closureHandle.closureKind || null,
    fieldName: resolvedFieldName,
    axisName: resolvedAxisName,
    outputName: closureHandle.outputName || null,
    observerCount: fieldObservers.observers.length,
    sampleCount: samples.length,
    outOfRangeCount: outOfRangeSamples.length,
    nullFieldCount,
    samples,
    outOfRangeSamples,
    summary: summarizeSamples({
      closureHandle,
      fieldName: resolvedFieldName,
      axisName: resolvedAxisName,
      samples,
      outOfRangeSamples,
      nullFieldCount
    })
  };
}
