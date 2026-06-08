import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCarrierRuntime, createDefaultCarrierState } from '../src/runtime/carrierRuntime.js';
import { createClosureHandle } from '../src/runtime/closureHandle.js';
import { evaluateEdgeMessages } from '../src/runtime/edgeMessages.js';
import { computeInvariants } from '../src/runtime/invariants.js';
import { buildNeighborGraph } from '../src/runtime/spatialHash.js';
import { hashPayload } from '../ulg-gpu-abi/src/index.js';

function createOscillatorClosure() {
  const inputHash = hashPayload({ closureKind: 'toy-two-particle-oscillator' });
  const methodHash = hashPayload({ mode: 'table-interpolation', potential: 'harmonic' });
  const samples = [];
  for (let index = 0; index <= 240; index += 1) {
    const r = 0.4 + index * 0.01;
    const displacement = r - 1;
    samples.push({
      r,
      energy: 0.5 * displacement * displacement,
      dEdr: displacement
    });
  }
  return {
    closureId: 'toy-oscillator-test-closure',
    sourceService: 'eshkol',
    closureKind: 'toy-two-particle-oscillator',
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
    validity: { r: [0.4, 2.8] },
    validation: { status: 'pass', scientificValidation: false, fullPhysicsValidation: false },
    provenance: {
      sourceService: 'eshkol',
      inputHash,
      methodHash,
      createdAt: '2026-06-08T10:00:00.000Z',
      notes: ['toy oscillator fixture']
    }
  };
}

test('closure handle samples table-interpolation energy and derivative', () => {
  const handle = createClosureHandle(createOscillatorClosure());
  const sample = handle.sample({ r: 1.2 });
  assert.equal(sample.status, 'sampled');
  assert.ok(Math.abs(sample.value - 0.02) < 1e-12);
  assert.ok(Math.abs(sample.derivatives.dEdr - 0.2) < 1e-12);
  assert.throws(() => handle.sample({ r: 3 }), /outside table domain/);
});

test('carrier runtime advances a two-body oscillator and conserves invariants within tolerance', () => {
  const handle = createClosureHandle(createOscillatorClosure());
  const runtime = createCarrierRuntime({
    closureHandle: handle,
    dt: 0.002,
    toleranceProfile: {
      name: 'toy-carrier-reference',
      energyAbs: 2e-5,
      momentumAbs: 1e-12
    }
  });
  const initialState = createDefaultCarrierState({ separation: 1.2, velocity: 0, mass: 1 });
  const initialInvariants = computeInvariants(initialState, handle);
  const result = runtime.run(initialState, 160);
  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.deltas.length, 160);
  assert.equal(result.deltas[0].schema, 'peercompute.ulg.carrier-delta.v0');
  assert.equal(result.deltas[0].edgeMessageSummary.schema, 'peercompute.ulg.edge-message-summary.v0');
  assert.equal(result.deltas[0].edgeMessageSummary.status, 'pass');
  assert.equal(result.deltas[0].fieldObserverSummary.schema, 'peercompute.ulg.field-observer-summary.v0');
  assert.equal(result.deltas[0].fieldObserverSummary.status, 'pass');
  assert.deepEqual(result.deltas[0].fieldObserverSummary.observedFieldNames, [
    'positionX',
    'velocityX',
    'mass',
    'kineticEnergy'
  ]);
  assert.equal(result.deltas[0].fieldObserverSummary.scientificValidation, false);
  assert.equal(result.deltas[0].fieldObserverSummary.fullPhysicsValidation, false);
  assert.equal(result.invariants.schema, 'peercompute.ulg.carrier-invariant-drift.v0');
  assert.equal(result.invariants.status, 'pass');
  assert.ok(result.invariants.metrics.maxEnergyDriftAbs < 2e-5);
  assert.ok(result.invariants.metrics.maxMomentumDriftAbs < 1e-12);
  assert.ok(Math.abs(result.invariantSeries[0].totalEnergy - initialInvariants.totalEnergy) < 1e-12);
  assert.notEqual(result.finalState.bodies[0].x, initialState.bodies[0].x);
  assert.notEqual(result.finalState.bodies[1].x, initialState.bodies[1].x);
});

test('edge-message primitive matches the existing two-body carrier force convention', () => {
  const handle = createClosureHandle(createOscillatorClosure());
  const runtime = createCarrierRuntime({ closureHandle: handle, dt: 0.002 });
  const initialState = createDefaultCarrierState({ separation: 1.2, velocity: 0, mass: 1 });
  const graph = buildNeighborGraph({
    cellSize: 1,
    radius: 1.3,
    bodies: initialState.bodies
  });
  const edgeMessages = evaluateEdgeMessages({ neighborGraph: graph, closureHandle: handle });
  const [message] = edgeMessages.messages;
  const step = runtime.step(initialState);
  const expectedDx = 0.5 * message.forceOnSource[0] * runtime.dt * runtime.dt;

  assert.equal(edgeMessages.summary.status, 'pass');
  assert.equal(step.delta.edgeMessageSummary.status, 'pass');
  assert.equal(step.delta.fieldObserverSummary.status, 'pass');
  assert.equal(step.delta.fieldObserverSummary.particleCount, 2);
  assert.ok(Math.abs(message.forceOnSource[0] - 0.2) < 1e-12);
  assert.ok(Math.abs(step.delta.bodies[0].dx - expectedDx) < 1e-12);
  assert.ok(Math.abs(step.delta.bodies[1].dx + expectedDx) < 1e-12);
});
