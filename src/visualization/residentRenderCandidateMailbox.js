// Versioned single-slot mailbox for SS resident render candidates (worker-lane
// refactor increment W3).
//
// A "candidate" is the cloneable-only description of the newest renderable
// resident state a lane has produced: the eight-word sealed epoch identity, a
// strictly ordered (residentExecutionGeneration, nextStep) version, and
// optional retained-buffer refs plus a step summary. The mailbox is the
// consumer-side arbitration point: a renderer that samples it always sees the
// newest candidate and never a reordered or duplicated older one.
//
// Ordering contract (mirrors the de-facto version token of the scene's
// resident-render-source metadata, peercompute.ulg.sph-resident-render-source
// .v0 in src/visualization/sphPhaseScene.js): candidates are ordered by
// version.residentExecutionGeneration first, then version.nextStep. A publish
// whose version is older than OR EQUAL to the newest version ever accepted is
// dropped and counted (droppedStaleCount) — equal versions are duplicates, and
// duplicates are never re-accepted, so candidates can never reorder forward.
// The high-water version survives takeLatest(): clearing the slot never
// reopens the door for a stale republish.
//
// Fail-closed: malformed candidates (wrong/missing schema, missing or
// non-finite version words, missing/incomplete eight-word epoch identity)
// throw TypeError — they are never silently accepted and never coerced. The
// mailbox never fabricates fields: it stores exactly the object it was given
// (deep-frozen) and returns exactly that object.
//
// Purity: no timers, no DOM, no GPU, no globals — safe on the main thread and
// inside any worker. Cloneable-only content is the caller's contract; tests
// enforce it with the deep-walk + structuredClone pattern (see
// tests/ulgMechanicsResidentStageWorker.test.mjs).

export const ULG_RESIDENT_RENDER_CANDIDATE_SCHEMA =
  'peercompute.ulg.resident-render-candidate.v1';

// Same eight identity words, in the same order, as the mechanics resident
// stage worker's SCHROEDER_EPOCH_IDENTITY_WORD_FIELDS
// (src/services/ulgMechanicsResidentStage.worker.js).
export const ULG_RESIDENT_RENDER_CANDIDATE_EPOCH_IDENTITY_WORD_FIELDS =
  Object.freeze([
    'storageGeneration',
    'physicsTick',
    'physicsSubstep',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch',
    'levelEpoch',
    'supportEpoch'
  ]);

function candidateTypeError(reason) {
  const error = new TypeError(
    `Resident render candidate rejected fail-closed: ${reason}`
  );
  error.code = 'ERR_ULG_RESIDENT_RENDER_CANDIDATE_MALFORMED';
  error.reason = reason;
  return error;
}

function finiteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

// Recursively freeze plain objects and arrays. ArrayBuffers and their views
// stay unfrozen (freezing views with elements throws by spec, and both are
// legitimately cloneable payloads); exotic cloneables (Map/Set/Date/...) are
// left as-is because Object.freeze would not seal their contents anyway.
function deepFreezeCloneable(value, seen = new Set()) {
  if (value == null || typeof value !== 'object') return value;
  if (seen.has(value)) return value;
  seen.add(value);
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
  const isArray = Array.isArray(value);
  const isPlainObject = !isArray && (
    Object.getPrototypeOf(value) === Object.prototype
    || Object.getPrototypeOf(value) === null
  );
  if (!isArray && !isPlainObject) return value;
  for (const entry of Object.values(value)) {
    deepFreezeCloneable(entry, seen);
  }
  return Object.freeze(value);
}

function validatedCandidateVersion(candidate) {
  const version = candidate.version;
  if (!version || typeof version !== 'object') {
    throw candidateTypeError('candidate.version is missing');
  }
  const residentExecutionGeneration =
    finiteNumber(version.residentExecutionGeneration);
  if (residentExecutionGeneration == null) {
    throw candidateTypeError(
      'candidate.version.residentExecutionGeneration must be a finite number'
    );
  }
  const nextStep = finiteNumber(version.nextStep);
  if (nextStep == null) {
    throw candidateTypeError(
      'candidate.version.nextStep must be a finite number'
    );
  }
  return {
    residentExecutionGeneration,
    nextStep,
    scheduleId: typeof version.scheduleId === 'string'
      ? version.scheduleId
      : null,
    stepOrdinal: finiteNumber(version.stepOrdinal)
  };
}

function validateCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw candidateTypeError('candidate must be an object');
  }
  if (candidate.schema !== ULG_RESIDENT_RENDER_CANDIDATE_SCHEMA) {
    throw candidateTypeError(
      `candidate.schema must be ${ULG_RESIDENT_RENDER_CANDIDATE_SCHEMA}, got ${
        String(candidate.schema)
      }`
    );
  }
  const version = validatedCandidateVersion(candidate);
  const epochIdentity = candidate.epochIdentity;
  if (!epochIdentity || typeof epochIdentity !== 'object') {
    throw candidateTypeError('candidate.epochIdentity is missing');
  }
  for (const field of ULG_RESIDENT_RENDER_CANDIDATE_EPOCH_IDENTITY_WORD_FIELDS) {
    if (finiteNumber(epochIdentity[field]) == null) {
      throw candidateTypeError(
        `candidate.epochIdentity.${field} must be a finite number`
      );
    }
  }
  if (
    candidate.retainedBufferRefs !== undefined
    && !Array.isArray(candidate.retainedBufferRefs)
  ) {
    throw candidateTypeError(
      'candidate.retainedBufferRefs must be an array when present'
    );
  }
  return version;
}

export function createResidentRenderCandidateMailbox({
  onCandidate = null
} = {}) {
  // Slot state. `latestVersion` is a monotonic high-water mark, NOT the slot:
  // it survives takeLatest() so a stale candidate republished after a take is
  // still dropped (never reordered forward).
  let latest = null;
  let latestVersion = null;
  let publishedCount = 0;
  let droppedStaleCount = 0;
  let takenCount = 0;
  let onCandidateErrorCount = 0;

  const isNewer = (version) => {
    if (!latestVersion) return true;
    if (version.residentExecutionGeneration
        !== latestVersion.residentExecutionGeneration) {
      return version.residentExecutionGeneration
        > latestVersion.residentExecutionGeneration;
    }
    return version.nextStep > latestVersion.nextStep;
  };

  const mailbox = {
    publish(candidate) {
      const version = validateCandidate(candidate);
      if (!isNewer(version)) {
        droppedStaleCount += 1;
        return Object.freeze({
          accepted: false,
          reason: 'stale-or-duplicate-version-dropped',
          version: Object.freeze(version),
          latestVersion
        });
      }
      latestVersion = Object.freeze(version);
      latest = deepFreezeCloneable(candidate);
      publishedCount += 1;
      if (typeof onCandidate === 'function') {
        try {
          onCandidate(latest);
        } catch {
          // The mailbox never lets a consumer callback poison the publish
          // path; failures are counted, not hidden.
          onCandidateErrorCount += 1;
        }
      }
      return Object.freeze({
        accepted: true,
        reason: 'published',
        version: latestVersion,
        latestVersion
      });
    },
    peekLatest() {
      return latest;
    },
    takeLatest() {
      if (latest == null) return null;
      const taken = latest;
      latest = null;
      takenCount += 1;
      return taken;
    },
    stats() {
      return Object.freeze({
        publishedCount,
        droppedStaleCount,
        takenCount,
        onCandidateErrorCount,
        latestVersion
      });
    }
  };
  return Object.freeze(mailbox);
}
