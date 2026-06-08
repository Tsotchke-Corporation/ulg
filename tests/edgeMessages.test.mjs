import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateEdgeMessages } from '../src/runtime/edgeMessages.js';
import { createClosureHandle } from '../src/runtime/closureHandle.js';
import { buildNeighborGraph } from '../src/runtime/spatialHash.js';
import { hashPayload } from '../ulg-gpu-abi/src/index.js';

function createOscillatorClosure() {
  const inputHash = hashPayload({ closureKind: 'toy-edge-message-oscillator' });
  const methodHash = hashPayload({ mode: 'table-interpolation', potential: 'harmonic' });
  const samples = [];
  for (let index = 0; index <= 160; index += 1) {
    const r = 0.2 + index * 0.01;
    const displacement = r - 1;
    samples.push({
      r,
      energy: 0.5 * displacement * displacement,
      dEdr: displacement
    });
  }
  return {
    closureId: 'toy-edge-message-closure',
    sourceService: 'ulg-runtime-fixture',
    closureKind: 'toy-edge-message-oscillator',
    inputHash,
    methodHash,
    inputs: [{ name: 'r' }],
    outputs: [{ name: 'energy' }],
    derivatives: [{ output: 'energy', axis: 'r', name: 'dEdr' }],
    execution: {
      mode: 'table-interpolation',
      table: {
        axisName: 'r',
        outputName: 'energy',
        derivativeName: 'dEdr',
        samples
      }
    },
    validity: { r: [0.2, 1.8] },
    validation: { status: 'pass', scientificValidation: false, fullPhysicsValidation: false },
    provenance: { sourceService: 'ulg-runtime-fixture', inputHash, methodHash }
  };
}

test('edge messages sample closures and conserve antisymmetric pair force', () => {
  const closureHandle = createClosureHandle(createOscillatorClosure());
  const graph = buildNeighborGraph({
    cellSize: 1,
    radius: 1.5,
    bodies: [
      { id: 'a', x: -0.6 },
      { id: 'b', x: 0.6 }
    ]
  });
  const edgeMessages = evaluateEdgeMessages({ neighborGraph: graph, closureHandle });

  assert.equal(edgeMessages.schema, 'peercompute.ulg.edge-messages.v0');
  assert.equal(edgeMessages.messageCount, 1);
  assert.equal(edgeMessages.summary.schema, 'peercompute.ulg.edge-message-summary.v0');
  assert.equal(edgeMessages.summary.status, 'pass');
  const [message] = edgeMessages.messages;
  assert.equal(message.closureId, 'toy-edge-message-closure');
  assert.ok(Math.abs(message.distance - 1.2) < 1e-12);
  assert.ok(Math.abs(message.sampledPotentialEnergy - 0.02) < 1e-12);
  assert.ok(Math.abs(message.sampledDerivative - 0.2) < 1e-12);
  assert.deepEqual(message.forceOnSource.map((value) => Number(value.toFixed(12))), [0.2]);
  assert.deepEqual(message.forceOnTarget.map((value) => Number(value.toFixed(12))), [-0.2]);
  assert.equal(edgeMessages.summary.maxNetForceAbs, 0);
  assert.equal(edgeMessages.summary.scientificValidation, false);
  assert.equal(edgeMessages.summary.fullPhysicsValidation, false);
});

test('edge message summary accumulates multiple pair samples without net force leakage', () => {
  const closureHandle = createClosureHandle(createOscillatorClosure());
  const graph = buildNeighborGraph({
    cellSize: 1,
    radius: 1.3,
    bodies: [
      { id: 'a', x: -0.6 },
      { id: 'b', x: 0 },
      { id: 'c', x: 0.6 }
    ]
  });
  const edgeMessages = evaluateEdgeMessages({ neighborGraph: graph, closureHandle });

  assert.equal(edgeMessages.messageCount, 3);
  assert.equal(edgeMessages.summary.status, 'pass');
  assert.equal(edgeMessages.summary.maxNetForceAbs, 0);
  assert.ok(Math.abs(edgeMessages.summary.totalSampledPotentialEnergy - 0.18) < 1e-12);
});

test('edge messages report out-of-range closure samples without overclaiming validity', () => {
  const closureHandle = createClosureHandle(createOscillatorClosure());
  const graph = buildNeighborGraph({
    cellSize: 2,
    radius: 2,
    bodies: [
      { id: 'a', x: 0 },
      { id: 'b', x: 1.9 }
    ]
  });
  const edgeMessages = evaluateEdgeMessages({ neighborGraph: graph, closureHandle });

  assert.equal(edgeMessages.pairCount, 1);
  assert.equal(edgeMessages.messageCount, 0);
  assert.equal(edgeMessages.outOfRangeCount, 1);
  assert.equal(edgeMessages.summary.status, 'warn');
  assert.equal(edgeMessages.summary.outOfRangeCount, 1);
  assert.match(edgeMessages.outOfRangeEdges[0].reason, /outside table domain/);
  assert.equal(edgeMessages.summary.scientificValidation, false);
  assert.equal(edgeMessages.summary.fullPhysicsValidation, false);
});
