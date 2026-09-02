import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_MAGIC,
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_STATUS_ADMITTED,
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_STATUS_READY,
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_VERSION,
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORD,
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORDS,
  decodeSchroederFrozenSpatialKeyChurnRecord,
  schroederFrozenSpatialKeyChurnChecksum
} from '../ulg-gpu-abi/src/schroederFrozenSpatialKeyChurn.js';

function validRecordWords() {
  const words = new Uint32Array(
    SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORDS
  );
  const w = SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORD;
  words[w.MAGIC] = SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_MAGIC;
  words[w.VERSION] = SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_VERSION;
  words[w.STATUS] =
    SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_STATUS_READY
    | SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_STATUS_ADMITTED;
  words[w.FLAGS] = 1;
  words[w.STEP_ORDINAL] = 3;
  words[w.FINE_SUBSTEP_ORDINAL] = 2;
  words[w.PARTICLE_COUNT] = 10;
  words[w.VISITED_COUNT] = 10;
  words[w.PRIOR_ACTIVE_COUNT] = 8;
  words[w.SUCCESSOR_ACTIVE_COUNT] = 8;
  words[w.COMPARED_ACTIVE_COUNT] = 7;
  words[w.ACTIVATED_COUNT] = 1;
  words[w.DEACTIVATED_COUNT] = 1;
  words[w.MOVED_COUNT] = 6;
  words[w.SPATIAL_KEY_CHANGED_COUNT] = 3;
  words[w.SPATIAL_KEY_UNCHANGED_COUNT] = 4;
  words[w.CELL_X_CHANGED_COUNT] = 2;
  words[w.CELL_Y_CHANGED_COUNT] = 1;
  words[w.CELL_Z_CHANGED_COUNT] = 2;
  words[w.INVALID_PRIOR_COUNT] = 1;
  words[w.INVALID_SUCCESSOR_COUNT] = 1;
  words[w.DORMANT_COUNT] = 1;
  words[w.MAX_ABS_CELL_DELTA_X] = 2;
  words[w.MAX_ABS_CELL_DELTA_Y] = 1;
  words[w.MAX_ABS_CELL_DELTA_Z] = 4;
  words[w.PRIOR_POSITION_EPOCH] = 90;
  words[w.SUCCESSOR_POSITION_EPOCH] = 91;
  words[w.TOPOLOGY_EPOCH] = 13;
  words[w.CHART_EPOCH] = 14;
  words[w.LEVEL_EPOCH] = 15;
  words[w.SUPPORT_EPOCH] = 16;
  words[w.CHECKSUM] = schroederFrozenSpatialKeyChurnChecksum(words);
  return words;
}

test('frozen spatial-key churn decoder admits a sealed count partition', () => {
  const decoded = decodeSchroederFrozenSpatialKeyChurnRecord(
    validRecordWords()
  );
  assert.equal(decoded.structuralValid, true);
  assert.equal(decoded.stepOrdinal, 3);
  assert.equal(decoded.fineSubstepOrdinal, 2);
  assert.equal(decoded.spatialKeyChangedParticleCount, 3);
  assert.equal(decoded.spatialKeyUnchangedParticleCount, 4);
  assert.deepEqual(decoded.maxAbsCellDelta, [2, 1, 4]);
  assert.equal(decoded.spatialKeyChangeRatio, 3 / 7);
});

test('frozen spatial-key churn decoder rejects torn seals and invalid partitions', () => {
  const w = SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORD;
  const torn = validRecordWords();
  torn[w.MOVED_COUNT] += 1;
  assert.equal(
    decodeSchroederFrozenSpatialKeyChurnRecord(torn).structuralValid,
    false
  );

  const invalidPartition = validRecordWords();
  invalidPartition[w.SPATIAL_KEY_UNCHANGED_COUNT] += 1;
  invalidPartition[w.CHECKSUM] =
    schroederFrozenSpatialKeyChurnChecksum(invalidPartition);
  const decoded = decodeSchroederFrozenSpatialKeyChurnRecord(invalidPartition);
  assert.equal(decoded.countRelationsValid, false);
  assert.equal(decoded.structuralValid, false);

  const impossibleMotion = validRecordWords();
  impossibleMotion[w.MOVED_COUNT] = 2;
  impossibleMotion[w.CHECKSUM] =
    schroederFrozenSpatialKeyChurnChecksum(impossibleMotion);
  assert.equal(
    decodeSchroederFrozenSpatialKeyChurnRecord(impossibleMotion)
      .countRelationsValid,
    false
  );
});

test('frozen spatial-key churn checksum rejects order-preserving XOR collisions', () => {
  const w = SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORD;
  const words = validRecordWords();
  const sealedChecksum = words[w.CHECKSUM];
  const first = words[w.MAX_ABS_CELL_DELTA_X];
  words[w.MAX_ABS_CELL_DELTA_X] = words[w.MAX_ABS_CELL_DELTA_Y];
  words[w.MAX_ABS_CELL_DELTA_Y] = first;
  assert.notEqual(
    schroederFrozenSpatialKeyChurnChecksum(words),
    sealedChecksum
  );
  assert.equal(
    decodeSchroederFrozenSpatialKeyChurnRecord(words).structuralValid,
    false
  );
});
