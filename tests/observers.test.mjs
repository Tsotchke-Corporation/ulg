import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateFieldObservers } from '../src/runtime/observers.js';
import { buildNeighborGraph } from '../src/runtime/spatialHash.js';

test('field observers smooth scalar fields over deterministic neighbor pairs', () => {
  const particles = {
    bodies: [
      { id: 'a', x: -0.5, h: 1 },
      { id: 'b', x: 0, h: 1 },
      { id: 'c', x: 0.5, h: 1 }
    ]
  };
  const graph = buildNeighborGraph({
    bodies: particles.bodies,
    cellSize: 1,
    radius: 1
  });
  const observers = evaluateFieldObservers({
    particles,
    neighborGraph: graph,
    fields: { temperature: [10, 20, 30] },
    smoothingLength: 1
  });

  assert.equal(observers.schema, 'peercompute.ulg.field-observers.v0');
  assert.equal(observers.summary.schema, 'peercompute.ulg.field-observer-summary.v0');
  assert.equal(observers.summary.status, 'pass');
  assert.equal(observers.summary.scientificValidation, false);
  assert.equal(observers.summary.fullPhysicsValidation, false);
  assert.deepEqual(observers.observedFieldNames, ['temperature']);
  assert.equal(observers.pairCount, 3);
  assert.equal(observers.observers[1].neighborCount, 2);
  assert.equal(observers.observers[1].observedFields.temperature, 20);
  assert.ok(Math.abs(observers.observers[0].observedFields.temperature - (20 / 1.5)) < 1e-12);
  assert.ok(Math.abs(observers.observers[2].observedFields.temperature - (40 / 1.5)) < 1e-12);
});

test('field observers warn instead of overclaiming when no contribution reaches a particle', () => {
  const observers = evaluateFieldObservers({
    particles: {
      bodies: [
        { id: 'a', x: 0 },
        { id: 'b', x: 10 }
      ]
    },
    fields: { marker: [1, 2] },
    radius: 1,
    smoothingLength: 1,
    includeSelf: false
  });

  assert.equal(observers.summary.status, 'warn');
  assert.equal(observers.summary.zeroWeightCount, 2);
  assert.equal(observers.observers[0].observedFields.marker, null);
  assert.equal(observers.observers[1].observedFields.marker, null);
  assert.equal(observers.summary.scientificValidation, false);
  assert.equal(observers.summary.fullPhysicsValidation, false);
});

test('field observers canonicalize symmetric graphs and use recipient smoothing length', () => {
  const particles = {
    bodies: [
      { id: 'a', x: 0, h: 2 },
      { id: 'b', x: 1, h: 1 }
    ]
  };
  const symmetricGraph = buildNeighborGraph({
    bodies: particles.bodies,
    cellSize: 1,
    radius: 1.1,
    symmetric: true
  });
  const observers = evaluateFieldObservers({
    particles,
    neighborGraph: symmetricGraph,
    fields: { marker: [0, 10] },
    includeSelf: true
  });

  assert.equal(symmetricGraph.pairCount, 2);
  assert.equal(observers.summary.status, 'pass');
  assert.equal(observers.observers[0].neighborCount, 1);
  assert.equal(observers.observers[1].neighborCount, 0);
  assert.ok(Math.abs(observers.observers[0].observedFields.marker - (10 * 0.5 / 1.5)) < 1e-12);
  assert.equal(observers.observers[1].observedFields.marker, 10);
});

test('field observers validate supplied graphs and scalar fields before smoothing', () => {
  const particles = { bodies: [{ id: 'a', x: 0 }, { id: 'b', x: 1 }] };
  const graph = buildNeighborGraph({ bodies: particles.bodies, cellSize: 1, radius: 2 });

  assert.throws(() => evaluateFieldObservers({
    particles,
    neighborGraph: { ...graph, schema: 'wrong' },
    fields: { marker: [1, 2] },
    smoothingLength: 1
  }), /neighborGraph\.schema/);
  assert.throws(() => evaluateFieldObservers({
    particles,
    neighborGraph: { ...graph, particleCount: 3 },
    fields: { marker: [1, 2] },
    smoothingLength: 1
  }), /particle count/);
  assert.throws(() => evaluateFieldObservers({
    particles,
    neighborGraph: graph,
    fields: {},
    smoothingLength: 1
  }), /at least one scalar field/);
});

test('field observers handle duplicate-position non-self pairs without distance singularity', () => {
  const particles = {
    bodies: [
      { id: 'a', x: 0, h: 1 },
      { id: 'b', x: 0, h: 1 }
    ]
  };
  const observers = evaluateFieldObservers({
    particles,
    fields: { marker: [2, 4] },
    radius: 1,
    smoothingLength: 1
  });

  assert.equal(observers.summary.status, 'pass');
  assert.equal(observers.observers[0].observedFields.marker, 3);
  assert.equal(observers.observers[1].observedFields.marker, 3);
});
