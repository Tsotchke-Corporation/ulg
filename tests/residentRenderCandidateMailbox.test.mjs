import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createResidentRenderCandidateMailbox,
  ULG_RESIDENT_RENDER_CANDIDATE_SCHEMA,
  ULG_RESIDENT_RENDER_CANDIDATE_EPOCH_IDENTITY_WORD_FIELDS
} from '../src/visualization/residentRenderCandidateMailbox.js';

function identityWords({ generation = 1, step = 1 } = {}) {
  return {
    storageGeneration: generation,
    physicsTick: step,
    physicsSubstep: 0,
    positionEpoch: step + 4,
    topologyEpoch: 2,
    chartEpoch: 3,
    levelEpoch: 1,
    supportEpoch: 1
  };
}

function candidate({
  generation = 1,
  step = 1,
  scheduleId = 'ulg:test:schedule',
  stepOrdinal = 1,
  ...overrides
} = {}) {
  return {
    schema: ULG_RESIDENT_RENDER_CANDIDATE_SCHEMA,
    version: {
      residentExecutionGeneration: generation,
      nextStep: step,
      scheduleId,
      stepOrdinal
    },
    epochIdentity: identityWords({ generation, step }),
    retainedBufferRefs: [`ulg-worker:test:state:${generation}:${step}`],
    summary: {
      schema: 'peercompute.ulg.worker-resident-schedule-step-summary.v0',
      scheduleId,
      stepOrdinal,
      particleCount: 2
    },
    ...overrides
  };
}

// Cloneable-only guard: same deep-walk pattern as
// tests/ulgMechanicsResidentStageWorker.test.mjs (assertNoWorkerGpuBuffers)
// followed by an actual structuredClone.
function assertCloneableOnly(value, path = 'candidate', seen = new Set()) {
  if (value == null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  const bufferLike = typeof value.mapAsync === 'function'
    || typeof value.getMappedRange === 'function'
    || value.constructor?.name === 'GPUBuffer'
    || value.constructor?.name === 'FakeGpuBuffer';
  assert.equal(bufferLike, false, `GPU buffer leaked into candidate at ${path}`);
  assert.equal(typeof value, 'object', `non-cloneable at ${path}`);
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return;
  for (const [key, entry] of Object.entries(value)) {
    assert.notEqual(typeof entry, 'function', `function leaked into candidate at ${path}.${key}`);
    assertCloneableOnly(entry, `${path}.${key}`, seen);
  }
}

test('resident render candidate mailbox keeps only the newest by (generation, then nextStep)', () => {
  const mailbox = createResidentRenderCandidateMailbox();

  const first = mailbox.publish(candidate({ generation: 1, step: 5, stepOrdinal: 1 }));
  assert.equal(first.accepted, true);
  assert.equal(first.reason, 'published');

  const laterStep = mailbox.publish(candidate({ generation: 1, step: 6, stepOrdinal: 2 }));
  assert.equal(laterStep.accepted, true);
  assert.equal(mailbox.peekLatest().version.nextStep, 6);

  // Generation precedence: a newer generation supersedes even with a LOWER
  // nextStep word.
  const newGeneration = mailbox.publish(candidate({ generation: 2, step: 1, stepOrdinal: 1 }));
  assert.equal(newGeneration.accepted, true);
  assert.equal(mailbox.peekLatest().version.residentExecutionGeneration, 2);
  assert.equal(mailbox.peekLatest().version.nextStep, 1);

  // An older generation is stale no matter how large its step is.
  const oldGenerationHighStep = mailbox.publish(
    candidate({ generation: 1, step: 100, stepOrdinal: 9 })
  );
  assert.equal(oldGenerationHighStep.accepted, false);
  assert.equal(oldGenerationHighStep.reason, 'stale-or-duplicate-version-dropped');
  assert.equal(mailbox.peekLatest().version.residentExecutionGeneration, 2);

  const stats = mailbox.stats();
  assert.equal(stats.publishedCount, 3);
  assert.equal(stats.droppedStaleCount, 1);
  assert.equal(stats.takenCount, 0);
  assert.deepEqual(
    { ...stats.latestVersion },
    {
      residentExecutionGeneration: 2,
      nextStep: 1,
      scheduleId: 'ulg:test:schedule',
      stepOrdinal: 1
    }
  );
});

test('resident render candidate mailbox drops equal-version duplicates and counts them', () => {
  const mailbox = createResidentRenderCandidateMailbox();
  const kept = candidate({ generation: 3, step: 7, stepOrdinal: 4 });
  assert.equal(mailbox.publish(kept).accepted, true);

  // Same (generation, nextStep) — a duplicate, e.g. the terminal schedule
  // candidate after its last progress candidate. The FIRST publish at a
  // version wins; the duplicate is dropped, never swapped in.
  const duplicate = candidate({
    generation: 3,
    step: 7,
    stepOrdinal: 4,
    summary: { schema: 'x', different: true }
  });
  const receipt = mailbox.publish(duplicate);
  assert.equal(receipt.accepted, false);
  assert.equal(mailbox.peekLatest().summary.particleCount, 2);
  assert.equal(mailbox.stats().publishedCount, 1);
  assert.equal(mailbox.stats().droppedStaleCount, 1);
});

test('resident render candidate mailbox takeLatest clears, peekLatest keeps, and the version gate survives take', () => {
  const mailbox = createResidentRenderCandidateMailbox();
  assert.equal(mailbox.peekLatest(), null);
  assert.equal(mailbox.takeLatest(), null);
  assert.equal(mailbox.stats().takenCount, 0);

  mailbox.publish(candidate({ generation: 1, step: 1 }));
  mailbox.publish(candidate({ generation: 1, step: 2 }));

  const peeked = mailbox.peekLatest();
  assert.equal(peeked.version.nextStep, 2);
  // Peek does not clear.
  assert.equal(mailbox.peekLatest(), peeked);

  const taken = mailbox.takeLatest();
  assert.equal(taken, peeked);
  assert.equal(mailbox.peekLatest(), null);
  assert.equal(mailbox.takeLatest(), null);
  assert.equal(mailbox.stats().takenCount, 1);

  // The high-water version survives the take: a stale republish after the
  // slot was cleared is still dropped — candidates never reorder forward.
  const staleAfterTake = mailbox.publish(candidate({ generation: 1, step: 2 }));
  assert.equal(staleAfterTake.accepted, false);
  assert.equal(mailbox.peekLatest(), null);
  assert.equal(mailbox.stats().droppedStaleCount, 1);

  const fresh = mailbox.publish(candidate({ generation: 1, step: 3 }));
  assert.equal(fresh.accepted, true);
  assert.equal(mailbox.peekLatest().version.nextStep, 3);
});

test('resident render candidate mailbox fails closed on malformed candidates with TypeError', () => {
  const mailbox = createResidentRenderCandidateMailbox();
  const expectTypeError = (value, pattern) => {
    assert.throws(
      () => mailbox.publish(value),
      (error) => {
        assert.ok(error instanceof TypeError);
        assert.equal(error.code, 'ERR_ULG_RESIDENT_RENDER_CANDIDATE_MALFORMED');
        assert.match(error.message, pattern);
        return true;
      }
    );
  };

  expectTypeError(null, /candidate must be an object/);
  expectTypeError('candidate', /candidate must be an object/);
  expectTypeError([candidate()], /candidate must be an object/);
  expectTypeError({ ...candidate(), schema: undefined }, /candidate\.schema/);
  expectTypeError(
    { ...candidate(), schema: 'peercompute.ulg.resident-render-candidate.v0' },
    /candidate\.schema/
  );
  expectTypeError({ ...candidate(), version: undefined }, /version is missing/);
  expectTypeError(
    {
      ...candidate(),
      version: { nextStep: 1, scheduleId: 's', stepOrdinal: 1 }
    },
    /residentExecutionGeneration must be a finite number/
  );
  expectTypeError(
    {
      ...candidate(),
      version: { residentExecutionGeneration: 1, nextStep: Number.NaN }
    },
    /nextStep must be a finite number/
  );
  expectTypeError(
    { ...candidate(), epochIdentity: undefined },
    /epochIdentity is missing/
  );
  for (const field of ULG_RESIDENT_RENDER_CANDIDATE_EPOCH_IDENTITY_WORD_FIELDS) {
    const identity = identityWords();
    delete identity[field];
    expectTypeError(
      { ...candidate(), epochIdentity: identity },
      new RegExp(`epochIdentity\\.${field} must be a finite number`)
    );
  }
  expectTypeError(
    { ...candidate(), retainedBufferRefs: 'ulg-worker:not-an-array' },
    /retainedBufferRefs must be an array/
  );

  // Nothing malformed was silently accepted.
  assert.equal(mailbox.peekLatest(), null);
  assert.equal(mailbox.stats().publishedCount, 0);
  assert.equal(mailbox.stats().droppedStaleCount, 0);
  assert.equal(mailbox.stats().latestVersion, null);
});

test('resident render candidate mailbox returns frozen objects', () => {
  const mailbox = createResidentRenderCandidateMailbox();
  assert.ok(Object.isFrozen(mailbox));

  const receipt = mailbox.publish(candidate({ generation: 1, step: 1 }));
  assert.ok(Object.isFrozen(receipt));
  assert.ok(Object.isFrozen(receipt.version));
  assert.ok(Object.isFrozen(receipt.latestVersion));

  const peeked = mailbox.peekLatest();
  assert.ok(Object.isFrozen(peeked));
  assert.ok(Object.isFrozen(peeked.version));
  assert.ok(Object.isFrozen(peeked.epochIdentity));
  assert.ok(Object.isFrozen(peeked.retainedBufferRefs));
  assert.ok(Object.isFrozen(peeked.summary));
  assert.throws(() => { peeked.version.nextStep = 99; }, TypeError);
  assert.throws(() => { peeked.retainedBufferRefs.push('x'); }, TypeError);

  const stats = mailbox.stats();
  assert.ok(Object.isFrozen(stats));
  assert.ok(Object.isFrozen(stats.latestVersion));

  const taken = mailbox.takeLatest();
  assert.ok(Object.isFrozen(taken));
});

test('resident render candidate mailbox candidates stay cloneable-only (deep walk + structuredClone)', () => {
  const mailbox = createResidentRenderCandidateMailbox();
  const published = candidate({
    generation: 4,
    step: 9,
    stepOrdinal: 2,
    summary: {
      schema: 'peercompute.ulg.worker-resident-schedule-step-summary.v0',
      stepOrdinal: 2,
      // Typed arrays are legitimate cloneable payloads and must survive the
      // mailbox's freeze pass (views with elements cannot be frozen by spec).
      compactLod: new Float32Array([0.5, 1.5])
    }
  });
  mailbox.publish(published);
  const latest = mailbox.peekLatest();
  assertCloneableOnly(latest);
  const clone = structuredClone(latest);
  assert.equal(clone.version.nextStep, 9);
  assert.equal(clone.summary.compactLod[1], 1.5);
  // The typed array was intentionally left unfrozen but everything else froze.
  assert.equal(Object.isFrozen(latest.summary), true);
  assert.equal(Object.isFrozen(latest.summary.compactLod), false);

  // The mailbox never fabricates fields: the stored candidate is exactly the
  // published object with exactly its own enumerable keys.
  assert.equal(latest, published);
  assert.deepEqual(
    Object.keys(latest).sort(),
    ['epochIdentity', 'retainedBufferRefs', 'schema', 'summary', 'version'].sort()
  );
});

test('resident render candidate mailbox onCandidate fires only for accepted candidates and never poisons publish', () => {
  const seen = [];
  let throwInCallback = false;
  const mailbox = createResidentRenderCandidateMailbox({
    onCandidate: (accepted) => {
      seen.push(accepted.version.nextStep);
      if (throwInCallback) throw new Error('consumer exploded');
    }
  });

  mailbox.publish(candidate({ generation: 1, step: 1 }));
  mailbox.publish(candidate({ generation: 1, step: 1 })); // duplicate: no callback
  throwInCallback = true;
  const receipt = mailbox.publish(candidate({ generation: 1, step: 2 }));
  assert.equal(receipt.accepted, true);
  assert.deepEqual(seen, [1, 2]);
  const stats = mailbox.stats();
  assert.equal(stats.publishedCount, 2);
  assert.equal(stats.droppedStaleCount, 1);
  assert.equal(stats.onCandidateErrorCount, 1);
});
