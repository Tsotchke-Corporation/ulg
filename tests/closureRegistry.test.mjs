import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArtifactCache } from '../src/runtime/ArtifactCache.js';
import { ClosureRegistry } from '../src/runtime/ClosureRegistry.js';
import { hashPayload } from '../ulg-gpu-abi/src/index.js';

function createClosureArtifact(overrides = {}) {
  const input = { fixture: 'closure-registry', domain: [0, 2] };
  const method = { mode: 'table-interpolation', version: 1 };
  const inputHash = hashPayload(input);
  const methodHash = hashPayload(method);
  return {
    closureId: 'closure-registry-test',
    sourceService: 'eshkol',
    closureKind: 'toy-two-particle-oscillator',
    inputHash,
    methodHash,
    inputs: [{ name: 'r' }],
    outputs: [{ name: 'energy' }],
    execution: {
      mode: 'table-interpolation',
      table: {
        axisName: 'r',
        outputName: 'energy',
        derivativeName: 'dEdr',
        samples: [
          { r: 0, energy: 0.5, dEdr: -1 },
          { r: 1, energy: 0, dEdr: 0 },
          { r: 2, energy: 0.5, dEdr: 1 }
        ]
      }
    },
    validity: { r: [0, 2] },
    validation: { status: 'pass', scientificValidation: false },
    provenance: {
      sourceService: 'eshkol',
      inputHash,
      methodHash,
      createdAt: '2026-06-08T10:00:00.000Z',
      notes: ['test fixture']
    },
    ...overrides
  };
}

test('ClosureRegistry stores, resolves, and reports validity range state', async () => {
  const cache = new ArtifactCache();
  const registry = new ClosureRegistry({ artifactCache: cache });
  const events = [];
  registry.subscribe((event) => events.push(event.type));
  const closure = createClosureArtifact();
  const ref = await registry.store(closure);
  assert.match(ref.uri, /^artifact:\/\/sha256:[0-9a-f]{64}$/);
  const hit = await registry.resolve({
    closureKind: closure.closureKind,
    inputHash: closure.inputHash,
    methodHash: closure.methodHash,
    point: { r: 1.5 }
  });
  assert.equal(hit.validity, 'in-range');
  assert.equal(hit.ref.uri, ref.uri);
  assert.equal(hit.closure.closureId, closure.closureId);
  const outOfRange = await registry.resolve({
    closureKind: closure.closureKind,
    inputHash: closure.inputHash,
    methodHash: closure.methodHash,
    point: { r: 3 }
  });
  assert.equal(outOfRange.validity, 'out-of-range');
  const miss = await registry.resolve({
    closureKind: closure.closureKind,
    inputHash: 'missing-input',
    methodHash: closure.methodHash,
    point: { r: 1 }
  });
  assert.equal(miss.validity, 'miss');
  assert.deepEqual(events, ['closure-stored', 'closure-hit', 'closure-out-of-range', 'closure-miss']);
});

test('ClosureRegistry invalidates stored closures before later resolves', async () => {
  const cache = new ArtifactCache();
  const registry = new ClosureRegistry({ artifactCache: cache });
  const closure = createClosureArtifact();
  const ref = await registry.store(closure);
  const invalidated = await registry.invalidate({ ref, reason: 'validity-domain-exited' });
  assert.equal(invalidated.status, 'invalidated');
  assert.equal(invalidated.reason, 'validity-domain-exited');
  const miss = await registry.resolve({
    closureKind: closure.closureKind,
    inputHash: closure.inputHash,
    methodHash: closure.methodHash,
    point: { r: 1 }
  });
  assert.equal(miss.validity, 'miss');
  assert.deepEqual(registry.list()[0], {
    ref,
    closureKind: closure.closureKind,
    inputHash: closure.inputHash,
    methodHash: closure.methodHash,
    status: 'invalidated',
    invalidatedReason: 'validity-domain-exited'
  });
});
