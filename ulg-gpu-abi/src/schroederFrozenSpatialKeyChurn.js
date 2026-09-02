export const ULG_SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_RECORD_SCHEMA =
  'peercompute.ulg.schroeder-frozen-spatial-key-churn-record.v0';

export const SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_MAGIC = 0x554c_474b;
export const SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_VERSION = 1;
export const SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORDS = 32;
export const SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_BYTE_LENGTH =
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORDS * Uint32Array.BYTES_PER_ELEMENT;
export const SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_CHECKSUM_SALT = 0x6b65_7931;
export const SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_CHECKSUM_PRIME = 0x0100_0193;
export const SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_FLAG_ADMITTED = 1;

export const SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_STATUS_READY = 1 << 0;
export const SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_STATUS_FAIL_CLOSED = 1 << 2;

export const SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORD = Object.freeze({
  MAGIC: 0,
  VERSION: 1,
  STATUS: 2,
  FLAGS: 3,
  STEP_ORDINAL: 4,
  FINE_SUBSTEP_ORDINAL: 5,
  PARTICLE_COUNT: 6,
  VISITED_COUNT: 7,
  PRIOR_ACTIVE_COUNT: 8,
  SUCCESSOR_ACTIVE_COUNT: 9,
  COMPARED_ACTIVE_COUNT: 10,
  ACTIVATED_COUNT: 11,
  DEACTIVATED_COUNT: 12,
  MOVED_COUNT: 13,
  SPATIAL_KEY_CHANGED_COUNT: 14,
  SPATIAL_KEY_UNCHANGED_COUNT: 15,
  CELL_X_CHANGED_COUNT: 16,
  CELL_Y_CHANGED_COUNT: 17,
  CELL_Z_CHANGED_COUNT: 18,
  INVALID_PRIOR_COUNT: 19,
  INVALID_SUCCESSOR_COUNT: 20,
  DORMANT_COUNT: 21,
  MAX_ABS_CELL_DELTA_X: 22,
  MAX_ABS_CELL_DELTA_Y: 23,
  MAX_ABS_CELL_DELTA_Z: 24,
  PRIOR_POSITION_EPOCH: 25,
  SUCCESSOR_POSITION_EPOCH: 26,
  TOPOLOGY_EPOCH: 27,
  CHART_EPOCH: 28,
  LEVEL_EPOCH: 29,
  SUPPORT_EPOCH: 30,
  CHECKSUM: 31
});

export function schroederFrozenSpatialKeyChurnChecksum(words) {
  if (!(words instanceof Uint32Array)) {
    throw new TypeError('frozen spatial-key churn checksum requires Uint32Array words');
  }
  if (words.length !== SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORDS) {
    throw new RangeError('frozen spatial-key churn record must be exactly 32 words');
  }
  let checksum = SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_CHECKSUM_SALT >>> 0;
  for (let index = 0; index < SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORD.CHECKSUM; index += 1) {
    checksum = Math.imul(
      (checksum ^ words[index]) >>> 0,
      SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_CHECKSUM_PRIME
    ) >>> 0;
  }
  return checksum;
}

/**
 * Decode one queue-complete frozen-refresh churn record. The receipt is
 * diagnostic evidence only: structuralValid authenticates the compact copy,
 * not a physics-authority transition or an incremental-directory fast path.
 */
export function decodeSchroederFrozenSpatialKeyChurnRecord(words) {
  if (!(words instanceof Uint32Array)) {
    throw new TypeError('frozen spatial-key churn decode requires Uint32Array words');
  }
  if (words.length !== SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORDS) {
    throw new RangeError('frozen spatial-key churn record must be exactly 32 words');
  }
  const w = SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORD;
  const status = words[w.STATUS] >>> 0;
  const ready = (status & SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_STATUS_READY) !== 0;
  const admitted =
    (status & SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_STATUS_ADMITTED) !== 0;
  const failClosed =
    (status & SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_STATUS_FAIL_CLOSED) !== 0;
  const particleCount = words[w.PARTICLE_COUNT] >>> 0;
  const visitedCount = words[w.VISITED_COUNT] >>> 0;
  const priorActiveParticleCount = words[w.PRIOR_ACTIVE_COUNT] >>> 0;
  const successorActiveParticleCount = words[w.SUCCESSOR_ACTIVE_COUNT] >>> 0;
  const comparedActiveParticleCount = words[w.COMPARED_ACTIVE_COUNT] >>> 0;
  const activatedParticleCount = words[w.ACTIVATED_COUNT] >>> 0;
  const deactivatedParticleCount = words[w.DEACTIVATED_COUNT] >>> 0;
  const spatialKeyChangedParticleCount =
    words[w.SPATIAL_KEY_CHANGED_COUNT] >>> 0;
  const spatialKeyUnchangedParticleCount =
    words[w.SPATIAL_KEY_UNCHANGED_COUNT] >>> 0;
  const movedParticleCount = words[w.MOVED_COUNT] >>> 0;
  const invalidPriorParticleCount = words[w.INVALID_PRIOR_COUNT] >>> 0;
  const invalidSuccessorParticleCount = words[w.INVALID_SUCCESSOR_COUNT] >>> 0;
  const dormantParticleCount = words[w.DORMANT_COUNT] >>> 0;
  const cellXChangedParticleCount = words[w.CELL_X_CHANGED_COUNT] >>> 0;
  const cellYChangedParticleCount = words[w.CELL_Y_CHANGED_COUNT] >>> 0;
  const cellZChangedParticleCount = words[w.CELL_Z_CHANGED_COUNT] >>> 0;
  const maxAbsCellDelta = [
    words[w.MAX_ABS_CELL_DELTA_X] >>> 0,
    words[w.MAX_ABS_CELL_DELTA_Y] >>> 0,
    words[w.MAX_ABS_CELL_DELTA_Z] >>> 0
  ];
  const priorPositionEpoch = words[w.PRIOR_POSITION_EPOCH] >>> 0;
  const successorPositionEpoch = words[w.SUCCESSOR_POSITION_EPOCH] >>> 0;
  const checksum = words[w.CHECKSUM] >>> 0;
  const expectedChecksum = schroederFrozenSpatialKeyChurnChecksum(words);
  const countRelationsValid = Boolean(
    visitedCount === particleCount
    && comparedActiveParticleCount + deactivatedParticleCount
      === priorActiveParticleCount
    && comparedActiveParticleCount + activatedParticleCount
      === successorActiveParticleCount
    && spatialKeyChangedParticleCount + spatialKeyUnchangedParticleCount
      === comparedActiveParticleCount
    && priorActiveParticleCount + dormantParticleCount
      + invalidPriorParticleCount === particleCount
    && successorActiveParticleCount + invalidSuccessorParticleCount
      <= particleCount
    && movedParticleCount <= comparedActiveParticleCount
    && spatialKeyChangedParticleCount <= movedParticleCount
    && cellXChangedParticleCount <= spatialKeyChangedParticleCount
    && cellYChangedParticleCount <= spatialKeyChangedParticleCount
    && cellZChangedParticleCount <= spatialKeyChangedParticleCount
    && spatialKeyChangedParticleCount
      <= cellXChangedParticleCount
        + cellYChangedParticleCount
        + cellZChangedParticleCount
    && (cellXChangedParticleCount === 0) === (maxAbsCellDelta[0] === 0)
    && (cellYChangedParticleCount === 0) === (maxAbsCellDelta[1] === 0)
    && (cellZChangedParticleCount === 0) === (maxAbsCellDelta[2] === 0)
  );
  const structuralValid = Boolean(
    words[w.MAGIC] === SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_MAGIC
    && words[w.VERSION] === SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_VERSION
    && status === (
      SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_STATUS_READY
      | SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_STATUS_ADMITTED
    )
    && words[w.FLAGS]
      === SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_FLAG_ADMITTED
    && particleCount > 0
    && words[w.STEP_ORDINAL] > 0
    && words[w.FINE_SUBSTEP_ORDINAL] > 0
    && priorPositionEpoch < successorPositionEpoch
    && checksum === expectedChecksum
    && countRelationsValid
  );
  return Object.freeze({
    schema: ULG_SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_RECORD_SCHEMA,
    structuralValid,
    ready,
    admitted,
    failClosed,
    status,
    flags: words[w.FLAGS] >>> 0,
    stepOrdinal: words[w.STEP_ORDINAL] >>> 0,
    fineSubstepOrdinal: words[w.FINE_SUBSTEP_ORDINAL] >>> 0,
    particleCount,
    visitedParticleCount: visitedCount,
    priorActiveParticleCount,
    successorActiveParticleCount,
    comparedActiveParticleCount,
    activatedParticleCount,
    deactivatedParticleCount,
    movedParticleCount,
    spatialKeyChangedParticleCount,
    spatialKeyUnchangedParticleCount,
    cellXChangedParticleCount,
    cellYChangedParticleCount,
    cellZChangedParticleCount,
    invalidPriorParticleCount,
    invalidSuccessorParticleCount,
    dormantParticleCount,
    maxAbsCellDelta: Object.freeze(maxAbsCellDelta),
    priorPositionEpoch,
    successorPositionEpoch,
    topologyEpoch: words[w.TOPOLOGY_EPOCH] >>> 0,
    chartEpoch: words[w.CHART_EPOCH] >>> 0,
    levelEpoch: words[w.LEVEL_EPOCH] >>> 0,
    supportEpoch: words[w.SUPPORT_EPOCH] >>> 0,
    checksum,
    expectedChecksum,
    countRelationsValid,
    spatialKeyChangeRatio: comparedActiveParticleCount > 0
      ? spatialKeyChangedParticleCount / comparedActiveParticleCount
      : 0
  });
}
