import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClosureHandle } from '../src/runtime/closureHandle.js';
import { evaluateFieldClosureSamples } from '../src/runtime/fieldClosureSamples.js';
import { evaluateFieldObservers } from '../src/runtime/observers.js';
import { buildNeighborGraph } from '../src/runtime/spatialHash.js';
import { hashPayload } from '../ulg-gpu-abi/src/index.js';

function createTemperatureClosure() {
  const inputHash = hashPayload({ closureKind: 'toy-temperature-response' });
  const methodHash = hashPayload({ mode: 'table-interpolation', axis: 'temperature' });
  return {
    closureId: 'toy-temperature-response-closure',
    closureKind: 'toy-temperature-response',
    inputHash,
    methodHash,
    execution: {
      mode: 'table-interpolation',
      table: {
        axisName: 'temperature',
        outputName: 'response',
        derivativeName: 'dResponseDTemperature',
        samples: [
          { temperature: 0, response: 0, dResponseDTemperature: 1 },
          { temperature: 1, response: 1, dResponseDTemperature: 1 },
          { temperature: 2, response: 2, dResponseDTemperature: 1 }
        ]
      }
    },
    validity: { temperature: [0, 2] },
    validation: { status: 'pass', scientificValidation: false, fullPhysicsValidation: false },
    provenance: { inputHash, methodHash }
  };
}

test('field closure samples interpolate closures over observed scalar fields', () => {
  const closureHandle = createClosureHandle(createTemperatureClosure());
  const particles = {
    bodies: [
      { id: 'a', x: -0.5, h: 1 },
      { id: 'b', x: 0, h: 1 },
      { id: 'c', x: 0.5, h: 1 }
    ]
  };
  const graph = buildNeighborGraph({ bodies: particles.bodies, cellSize: 1, radius: 1 });
  const fieldObservers = evaluateFieldObservers({
    particles,
    neighborGraph: graph,
    fields: { temperature: [0.5, 1, 1.5] },
    smoothingLength: 1
  });
  const fieldSamples = evaluateFieldClosureSamples({ fieldObservers, closureHandle });

  assert.equal(fieldSamples.schema, 'peercompute.ulg.field-closure-samples.v0');
  assert.equal(fieldSamples.summary.schema, 'peercompute.ulg.field-closure-sample-summary.v0');
  assert.equal(fieldSamples.summary.status, 'pass');
  assert.equal(fieldSamples.summary.fieldName, 'temperature');
  assert.equal(fieldSamples.summary.axisName, 'temperature');
  assert.equal(fieldSamples.summary.sampleCount, 3);
  assert.equal(fieldSamples.summary.outOfRangeCount, 0);
  assert.equal(fieldSamples.summary.nullFieldCount, 0);
  assert.equal(fieldSamples.summary.minSampledValue, 2 / 3);
  assert.equal(fieldSamples.summary.maxSampledValue, 4 / 3);
  assert.equal(fieldSamples.summary.maxAbsDerivative, 1);
  assert.equal(fieldSamples.summary.scientificValidation, false);
  assert.equal(fieldSamples.summary.fullPhysicsValidation, false);
  assert.equal(fieldSamples.summary.materialValidation, false);
  assert.equal(fieldSamples.summary.eosValidation, false);
  assert.equal(fieldSamples.summary.sphValidation, false);
  assert.equal(fieldSamples.summary.phaseChangeValidation, false);
});

test('field closure samples warn on out-of-range or null observed fields', () => {
  const closureHandle = createClosureHandle(createTemperatureClosure());
  const fieldObservers = evaluateFieldObservers({
    particles: { bodies: [{ id: 'a', x: 0 }, { id: 'b', x: 10 }] },
    fields: { temperature: [1, 3] },
    radius: 1,
    smoothingLength: 1,
    includeSelf: true
  });
  const fieldSamples = evaluateFieldClosureSamples({ fieldObservers, closureHandle });

  assert.equal(fieldSamples.summary.status, 'warn');
  assert.equal(fieldSamples.summary.sampleCount, 1);
  assert.equal(fieldSamples.summary.outOfRangeCount, 1);
  assert.match(fieldSamples.outOfRangeSamples[0].reason, /outside table domain/);
  assert.equal(fieldSamples.summary.scientificValidation, false);
  assert.equal(fieldSamples.summary.fullPhysicsValidation, false);
});

test('field closure samples warn on null observed fields without sampling them', () => {
  const closureHandle = createClosureHandle(createTemperatureClosure());
  const fieldObservers = {
    schema: 'peercompute.ulg.field-observers.v0',
    observedFieldNames: ['temperature'],
    observers: [
      { id: 'a', index: 0, observedFields: { temperature: null } },
      { id: 'b', index: 1, observedFields: { temperature: null } }
    ]
  };
  const fieldSamples = evaluateFieldClosureSamples({ fieldObservers, closureHandle });

  assert.equal(fieldSamples.summary.status, 'warn');
  assert.equal(fieldSamples.summary.sampleCount, 0);
  assert.equal(fieldSamples.summary.outOfRangeCount, 0);
  assert.equal(fieldSamples.summary.nullFieldCount, 2);
  assert.equal(fieldSamples.summary.minSampledValue, null);
  assert.equal(fieldSamples.summary.maxSampledValue, null);
  assert.equal(fieldSamples.summary.scientificValidation, false);
  assert.equal(fieldSamples.summary.fullPhysicsValidation, false);
});

test('field closure samples require declared observer fields and closure handles', () => {
  const closureHandle = createClosureHandle(createTemperatureClosure());
  const fieldObservers = evaluateFieldObservers({
    particles: { bodies: [{ id: 'a', x: 0 }] },
    fields: { marker: [1] },
    radius: 1,
    smoothingLength: 1
  });

  assert.throws(() => evaluateFieldClosureSamples({ fieldObservers }), /closure handle/);
  assert.throws(() => evaluateFieldClosureSamples({
    fieldObservers,
    closureHandle,
    fieldName: 'temperature'
  }), /missing observed scalar field/);
});
