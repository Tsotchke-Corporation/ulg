import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArtifactCache } from '../src/runtime/ArtifactCache.js';
import { ClosureRegistry } from '../src/runtime/ClosureRegistry.js';
import {
  applyClosureRefreshFromSimulation,
  rederiveToyOscillatorClosure
} from '../src/runtime/demoRuntime.js';
import { createCarrierRuntime, createDefaultCarrierState } from '../src/runtime/carrierRuntime.js';
import { createClosureHandle } from '../src/runtime/closureHandle.js';
import {
  ULG_CLOSURE_INVALIDATION_ARTIFACT_SCHEMA,
  ULG_CLOSURE_REDERIVATION_ARTIFACT_SCHEMA,
  createSimulationArtifact,
  hashPayload
} from '../ulg-gpu-abi/src/index.js';

function createNarrowOscillatorClosure() {
  const input = { closureKind: 'toy-two-particle-oscillator', domain: 'narrow' };
  const method = { mode: 'table-interpolation', potential: 'harmonic', domain: 'narrow' };
  const inputHash = hashPayload(input);
  const methodHash = hashPayload(method);
  const samples = [];
  for (let index = 0; index <= 40; index += 1) {
    const r = 0.9 + index * 0.01;
    const displacement = r - 1;
    samples.push({ r, energy: 0.5 * displacement * displacement, dEdr: displacement });
  }
  return {
    closureId: 'toy-oscillator-narrow-closure',
    sourceService: 'eshkol',
    closureKind: 'toy-two-particle-oscillator',
    inputHash,
    methodHash,
    inputs: [{ name: 'r' }],
    outputs: [{ name: 'energy' }],
    derivatives: [{ output: 'energy', axis: 'r', name: 'dEdr' }],
    execution: {
      mode: 'table-interpolation',
      table: { axisName: 'r', outputName: 'energy', derivativeName: 'dEdr', samples }
    },
    validity: { r: [0.9, 1.3] },
    validation: { status: 'pass', scientificValidation: false, fullPhysicsValidation: false },
    provenance: {
      sourceService: 'eshkol',
      inputHash,
      methodHash,
      createdAt: '2026-06-08T10:00:00.000Z',
      notes: ['narrow toy oscillator fixture']
    }
  };
}

// Builds the simulation artifact the supervised ulg-runtime worker emits, but inline so
// the closure-refresh path can be exercised without a Worker host.
function runCarrierAndBuildArtifact(closure, { separation, velocity, dt, steps, closureRef }) {
  const handle = createClosureHandle(closure);
  const runtime = createCarrierRuntime({ closureHandle: handle, dt });
  const run = runtime.run(createDefaultCarrierState({ separation, velocity, mass: 1 }), steps);
  const refreshRequest = run.closureRefreshRequest || null;
  const refreshRecommended = refreshRequest?.refreshRecommended === true;
  const artifact = createSimulationArtifact({
    artifactId: 'root-task.simulation',
    closureRef,
    representation: 'carrier-toy',
    outputs: {
      deltas: run.deltas,
      invariants: run.invariants,
      finalState: run.finalState,
      completedSteps: run.completedSteps,
      requestedSteps: run.requestedSteps,
      closureRefreshRequest: refreshRequest,
      domainExit: run.domainExit
    },
    execution: { backend: run.backend, dt: run.dt, steps: run.steps, integrator: run.integrator },
    validity: { status: refreshRecommended ? 'closure-domain-exited' : 'toy-reference-valid' },
    validation: { status: refreshRecommended ? 'warn' : run.invariants.status },
    provenance: { sourceService: 'ulg-runtime', parents: [closureRef] }
  });
  return { artifact, run };
}

test('domain-exit simulation drives registry invalidation and emits an invalidation artifact', async () => {
  const cache = new ArtifactCache();
  const registry = new ClosureRegistry({ artifactCache: cache });
  const events = [];
  registry.subscribe((event) => events.push(event.type));
  const closure = createNarrowOscillatorClosure();
  const closureRef = await registry.store(closure);

  const { artifact, run } = runCarrierAndBuildArtifact(closure, {
    separation: 1.25,
    velocity: -5,
    dt: 0.01,
    steps: 64,
    closureRef
  });
  assert.ok(run.domainExit, 'fixture should exit the closure domain');
  assert.equal(artifact.outputs.closureRefreshRequest.status, 'refresh-recommended');

  const closureRefresh = await applyClosureRefreshFromSimulation({
    closureRegistry: registry,
    artifactCache: cache,
    closureRef,
    closureArtifact: closure,
    result: { artifact, artifactRef: closureRef, rootTaskId: 'root-task' }
  });

  assert.equal(closureRefresh.status, 'invalidated');
  assert.equal(closureRefresh.reason, 'observed-field-outside-closure-domain');
  assert.equal(registry.list()[0].status, 'invalidated');
  assert.ok(events.includes('closure-invalidated'), 'registry should emit closure-invalidated');

  // A later resolve must miss the now-invalidated closure.
  const miss = await registry.resolve({
    closureKind: closure.closureKind,
    inputHash: closure.inputHash,
    methodHash: closure.methodHash,
    point: { r: 1.0 }
  });
  assert.equal(miss.validity, 'miss');

  // The emitted evidence artifact is content-addressed and non-overclaiming.
  const stored = await cache.get(closureRefresh.artifactRef);
  assert.equal(stored.schema, ULG_CLOSURE_INVALIDATION_ARTIFACT_SCHEMA);
  assert.equal(stored.registryAction, 'invalidate-and-rerun-closure-derive');
  assert.equal(stored.scientificValidation, false);
  assert.equal(stored.materialValidation, false);
  assert.equal(stored.eosValidation, false);
  assert.equal(stored.sphValidation, false);
  assert.equal(stored.phaseChangeValidation, false);
  assert.equal(stored.simulationArtifactRef, closureRef);
});

test('domain-exit simulation can rederive and re-register a refreshed closure (evidence-only)', async () => {
  const cache = new ArtifactCache();
  const registry = new ClosureRegistry({ artifactCache: cache });
  const closure = createNarrowOscillatorClosure();
  const closureRef = await registry.store(closure);

  const { artifact, run } = runCarrierAndBuildArtifact(closure, {
    separation: 1.25,
    velocity: -5,
    dt: 0.01,
    steps: 64,
    closureRef
  });
  const offendingInput = run.domainExit.inputValue;
  assert.ok(offendingInput > 1.3, 'fixture should exit above the [0.9, 1.3] domain');

  const closureRefresh = await applyClosureRefreshFromSimulation({
    closureRegistry: registry,
    artifactCache: cache,
    closureRef,
    closureArtifact: closure,
    result: { artifact, artifactRef: closureRef, rootTaskId: 'root-task' },
    rederiveClosure: rederiveToyOscillatorClosure
  });

  // Old closure invalidated, new closure re-derived and re-registered.
  assert.equal(closureRefresh.status, 'invalidated');
  assert.ok(closureRefresh.rederivation, 'expected a rederivation result');
  assert.equal(closureRefresh.rederivation.status, 'rederived');
  assert.deepEqual(closureRefresh.rederivation.previousDomain, [0.9, 1.3]);
  // Expanded domain must now cover the previously out-of-range input.
  const [newMin, newMax] = closureRefresh.rederivation.expandedDomain;
  assert.ok(newMin <= offendingInput && offendingInput <= newMax, 'expanded domain should cover the offending input');

  // The re-derived closure resolves in-range at the point that previously left the domain.
  const newClosure = closureRefresh.rederivation.closure;
  const resolved = await registry.resolve({
    closureKind: newClosure.closureKind,
    inputHash: newClosure.inputHash,
    methodHash: newClosure.methodHash,
    point: { r: offendingInput }
  });
  assert.equal(resolved.validity, 'in-range');
  assert.equal(resolved.ref.uri, closureRefresh.rederivation.newClosureRef.uri);

  // Content-addressed rederivation evidence with old->new lineage, non-overclaiming.
  const stored = await cache.get(closureRefresh.rederivation.artifactRef);
  assert.equal(stored.schema, ULG_CLOSURE_REDERIVATION_ARTIFACT_SCHEMA);
  assert.equal(stored.previousClosureRef.uri, closureRef.uri);
  assert.equal(stored.newClosureRef.uri, closureRefresh.rederivation.newClosureRef.uri);
  assert.equal(stored.registryAction, 'rederived-and-reregistered-closure');
  assert.equal(stored.scientificValidation, false);
  assert.equal(stored.materialValidation, false);
  assert.equal(stored.eosValidation, false);
  assert.equal(stored.sphValidation, false);
  assert.equal(stored.phaseChangeValidation, false);
});

test('domain-exit simulation does not rederive unless opted in', async () => {
  const cache = new ArtifactCache();
  const registry = new ClosureRegistry({ artifactCache: cache });
  const closure = createNarrowOscillatorClosure();
  const closureRef = await registry.store(closure);
  const { artifact } = runCarrierAndBuildArtifact(closure, {
    separation: 1.25,
    velocity: -5,
    dt: 0.01,
    steps: 64,
    closureRef
  });
  const closureRefresh = await applyClosureRefreshFromSimulation({
    closureRegistry: registry,
    artifactCache: cache,
    closureRef,
    closureArtifact: closure,
    result: { artifact, artifactRef: closureRef, rootTaskId: 'root-task' }
  });
  assert.equal(closureRefresh.status, 'invalidated');
  assert.equal(closureRefresh.rederivation, undefined);
});

test('in-range simulation leaves the closure valid and emits no invalidation artifact', async () => {
  const cache = new ArtifactCache();
  const registry = new ClosureRegistry({ artifactCache: cache });
  const closure = createNarrowOscillatorClosure();
  const closureRef = await registry.store(closure);

  const { artifact, run } = runCarrierAndBuildArtifact(closure, {
    separation: 1.0,
    velocity: 0,
    dt: 0.002,
    steps: 32,
    closureRef
  });
  assert.equal(run.domainExit, null);

  const closureRefresh = await applyClosureRefreshFromSimulation({
    closureRegistry: registry,
    artifactCache: cache,
    closureRef,
    closureArtifact: closure,
    result: { artifact, artifactRef: closureRef, rootTaskId: 'root-task' }
  });

  assert.notEqual(closureRefresh?.status, 'invalidated');
  assert.equal(registry.list()[0].status, 'valid');
});
