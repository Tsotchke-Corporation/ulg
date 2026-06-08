import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArtifactCache } from '../src/runtime/ArtifactCache.js';
import { createUlgRuntimeHandoff } from '../src/runtime/demoRuntime.js';
import {
  createClosureInvalidationArtifact,
  createClosureTableDescriptor,
  createSimulationArtifact,
  hashPayload
} from '../ulg-gpu-abi/src/index.js';

function createToyClosure() {
  const tableDescriptor = createClosureTableDescriptor({
    closureId: 'toy-oscillator-handoff',
    axes: [{ name: 'r', samples: 3, min: 0.9, max: 1.3, units: 'demo-length' }],
    outputs: [{ name: 'energy', dtype: 'f32', samples: 3, units: 'demo-energy' }],
    derivativeName: 'dEdr',
    interpolation: 'linear',
    validity: { r: [0.9, 1.3] }
  });
  const inputHash = hashPayload({ closureKind: 'toy-two-particle-oscillator' });
  const methodHash = hashPayload({ mode: 'table-interpolation' });
  return {
    closureId: tableDescriptor.closureId,
    sourceService: 'ulg-runtime-fixture',
    closureKind: 'toy-two-particle-oscillator',
    inputHash,
    methodHash,
    tableDescriptor,
    execution: {
      mode: 'table-interpolation',
      tableDescriptor,
      wgslTableDescriptor: tableDescriptor.wgslTableDescriptor,
      table: {
        axisName: 'r',
        outputName: 'energy',
        derivativeName: 'dEdr',
        samples: [
          { r: 0.9, energy: 0.005, dEdr: -0.1 },
          { r: 1.1, energy: 0.005, dEdr: 0.1 },
          { r: 1.3, energy: 0.045, dEdr: 0.3 }
        ]
      }
    },
    validity: { r: [0.9, 1.3] },
    validation: { status: 'pass', scientificValidation: false, fullPhysicsValidation: false },
    provenance: { sourceService: 'ulg-runtime-fixture', inputHash, methodHash, createdAt: '2026-06-08T10:00:00.000Z' }
  };
}

function createSimArtifact(closureRef) {
  return createSimulationArtifact({
    artifactId: 'task.simulation',
    closureRef,
    representation: 'carrier-toy',
    outputs: { deltas: [], invariants: { status: 'pass' } },
    execution: { backend: 'cpu-reference', dt: 0.002, steps: 8, integrator: 'velocity-verlet' },
    validity: { status: 'toy-reference-valid' },
    validation: { status: 'pass' },
    provenance: { sourceService: 'ulg-runtime', parents: [closureRef] }
  });
}

async function seedCache() {
  const cache = new ArtifactCache();
  const closureRef = await cache.put(createToyClosure());
  await cache.put(createSimArtifact(closureRef));
  await cache.put(createClosureInvalidationArtifact({
    artifactId: 'task.closure-invalidation',
    closureRef,
    closureId: 'toy-oscillator-handoff',
    closureKind: 'toy-two-particle-oscillator',
    refreshRequest: { status: 'refresh-recommended', registryAction: 'invalidate-and-rerun-closure-derive', reason: 'observed-field-outside-closure-domain' },
    invalidation: { status: 'invalidated', reason: 'observed-field-outside-closure-domain', ref: closureRef }
  }));
  // Foreign-service artifacts that must be excluded by default.
  await cache.put({ sourceService: 'moonlab', closureKind: null, taskKind: 'moonlab.quantum.response', responseDescriptor: {}, validation: { status: 'pass' } });
  await cache.put({ sourceService: 'eshkol', closureKind: 'magnetar-closure', taskKind: 'eshkol.closure.derive', validation: { status: 'pass' }, provenance: {} });
  return cache;
}

test('opt-in ULG runtime handoff includes only ULG runtime artifacts and surfaces the WGSL descriptor', async () => {
  const cache = await seedCache();
  const handoff = await createUlgRuntimeHandoff(cache, { includeWasmBytes: false });

  assert.equal(handoff.schema, 'peercompute.ulg.demo-handoff.v0');
  assert.equal(handoff.handoffKind, 'ulg-runtime-closure-simulation');
  assert.equal(handoff.artifactCount, 3);
  assert.equal(handoff.ulgRuntimeArtifactCount, 3);

  const sourceServices = new Set(handoff.artifacts.map((entry) => entry.ref.sourceService));
  assert.ok(sourceServices.has('ulg-runtime'));
  assert.ok(sourceServices.has('ulg-runtime-fixture'));
  assert.ok(!sourceServices.has('moonlab'));
  assert.ok(!sourceServices.has('eshkol'));

  const kinds = new Set(handoff.artifacts.map((entry) => entry.artifactKind));
  assert.ok(kinds.has('closure'));
  assert.ok(kinds.has('simulation-delta'));
  assert.ok(kinds.has('closure-invalidation'), 'closure-invalidation artifact should classify distinctly');

  const closureEntry = handoff.artifacts.find((entry) => entry.artifactKind === 'closure');
  assert.ok(closureEntry.wgslTableDescriptor, 'closure entry should surface wgslTableDescriptor');
  assert.equal(handoff.wgslTableDescriptorCount, 1);

  // No overclaim on the envelope.
  assert.equal(handoff.scientificValidation, false);
  assert.equal(handoff.materialValidation, false);
  assert.equal(handoff.eosValidation, false);
  assert.equal(handoff.sphValidation, false);
  assert.equal(handoff.phaseChangeValidation, false);
  assert.equal(handoff.includesAncestors, false);
});

test('opt-in ULG runtime handoff can include MoonLab/Eshkol ancestors when requested', async () => {
  const cache = await seedCache();
  const handoff = await createUlgRuntimeHandoff(cache, { includeWasmBytes: false, includeAncestors: true });
  const sourceServices = new Set(handoff.artifacts.map((entry) => entry.ref.sourceService));
  assert.ok(sourceServices.has('ulg-runtime'));
  assert.ok(sourceServices.has('moonlab'));
  assert.ok(sourceServices.has('eshkol'));
  assert.equal(handoff.includesAncestors, true);
  assert.equal(handoff.artifactCount, 5);
});
