import { schroederAuthorityTextFingerprint } from '../sph/schroederAuthorityFingerprint.js';
export const THERMAL_POTENTIAL_WORKER_CANDIDATE = 'ulg.thermal-potential-worker-candidate.v1';
export const THERMAL_POTENTIAL_WORKER_ACK = 'ulg.thermal-potential-worker-commit.v1';
const textFields = ['candidateId', 'scheduleId', 'laneId', 'stateKey', 'lineageKey', 'sourceFingerprint'];
const keys = ['schema', ...textFields, 'parentOrdinal'];
export function thermalPotentialWorkerSourceKey(inputs) {
  // Cold law artifacts only. No particle state or GPU buffer is serialized.
  return schroederAuthorityTextFingerprint(JSON.stringify(inputs, (_key, value) =>
    ArrayBuffer.isView(value) ? { type: value.constructor.name, values: Array.from(value) } : value), 'g6-worker-source');
}
export const thermalPotentialLineageFields = Object.freeze(['storageGeneration', 'physicsTick', 'physicsSubstep',
  'positionEpoch', 'topologyEpoch', 'chartEpoch', 'levelEpoch', 'supportEpoch', 'particleCount']);

export function thermalPotentialLineageKey(source) {
  const values = thermalPotentialLineageFields.map(key => source?.[key]);
  if (values.some(value => !Number.isSafeInteger(value) || value < 0 || Object.is(value, -0))) {
    throw new TypeError('G6 worker requires exact terminal physical lineage');
  }
  return JSON.stringify(values);
}
export function isThermalPotentialWorkerCandidate(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
    && value.schema === THERMAL_POTENTIAL_WORKER_CANDIDATE
    && textFields.every(key => typeof value[key] === 'string' && value[key].length > 0 && value[key].length <= 1024)
    && validLineageKey(value.lineageKey)
    && Number.isSafeInteger(value.parentOrdinal) && value.parentOrdinal >= 0 && !Object.is(value.parentOrdinal, -0);
}
function validLineageKey(key) {
  try {
    const values = JSON.parse(key);
    return Array.isArray(values) && values.length === thermalPotentialLineageFields.length
      && values.every(value => Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0))
      && JSON.stringify(values) === key;
  } catch { return false; }
}

// Validate the compact terminal result against the already admitted physical
// route. The private GPU candidate stays in its producing worker throughout.
export function validateThermalPotentialWorkerResult(value, { enabled, scheduleId, laneId, stateKey, route, cancelled = false, acknowledgement }) {
  if (!enabled && value == null) return null;
  const fail = () => { throw new Error('G6 worker thermal potential result does not match the admitted schedule'); };
  if (!enabled || !value || typeof value.adopted !== 'boolean'
    || !Number.isSafeInteger(value.ordinal) || value.ordinal < 0) fail();
  if (acknowledgement !== undefined && value.adopted
    && (!isThermalPotentialWorkerCandidate(acknowledgement?.candidate)
      || value.ordinal !== acknowledgement.candidate.parentOrdinal + 1
      || (value.candidate != null && value.candidate.sourceFingerprint !== acknowledgement.candidate.sourceFingerprint))) fail();
  const deferred = (value.status === 'deferred-capacity' || value.status === 'cadence-deferred')
    && value.candidate == null;
  const observed = !cancelled && !deferred;
  const status = cancelled ? 'cancelled' : deferred ? value.status : value.candidate == null ? 'no-valid-fit' : 'pending-state-manager';
  if (value.status !== status || value.readbackBytes !== (observed ? 32 : 0)
    || value.mapAsyncCount !== (observed ? 1 : 0)
    || (observed ? !Number.isSafeInteger(value.cumulativeConsumerHits) || value.cumulativeConsumerHits < 0 : value.cumulativeConsumerHits != null)) fail();
  if (value.candidate != null) {
    const c = value.candidate;
    if (cancelled || !isThermalPotentialWorkerCandidate(c) || c.scheduleId !== scheduleId
      || c.laneId !== laneId || c.stateKey !== stateKey || c.parentOrdinal !== value.ordinal
      || c.lineageKey !== thermalPotentialLineageKey({ ...route?.lineage?.target,
        particleCount: route?.particleCardinality?.targetParticleCount })) fail();
  }
  return Object.freeze({ adopted: value.adopted, ordinal: value.ordinal, status,
    readbackBytes: value.readbackBytes, mapAsyncCount: value.mapAsyncCount,
    cumulativeConsumerHits: value.cumulativeConsumerHits,
    candidate: value.candidate == null ? null : Object.freeze({ ...value.candidate }) });
}
export function thermalPotentialWorkerCandidateEquals(a, b) {
  return isThermalPotentialWorkerCandidate(a) && isThermalPotentialWorkerCandidate(b)
    && keys.every(key => a[key] === b[key]);
}
