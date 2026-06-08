import { ULG_FIELD_OBSERVERS_SCHEMA } from './observers.js';

export const ULG_FIELD_CLOSURE_SAMPLES_SCHEMA = 'peercompute.ulg.field-closure-samples.v0';
export const ULG_FIELD_CLOSURE_SAMPLE_SUMMARY_SCHEMA = 'peercompute.ulg.field-closure-sample-summary.v0';

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
  return {
    schema: ULG_FIELD_CLOSURE_SAMPLE_SUMMARY_SCHEMA,
    status,
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
