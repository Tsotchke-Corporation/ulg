import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createResidentNeighborhoodMutationCertificateSlotWords,
  RESIDENT_NEIGHBORHOOD_MUTATION_ACCUMULATOR_BYTES,
  RESIDENT_NEIGHBORHOOD_MUTATION_ACCUMULATOR_INDEX,
  RESIDENT_NEIGHBORHOOD_MUTATION_ACCUMULATOR_U32,
  RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_ABI,
  RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_MAGIC,
  RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_VERSION,
  RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG,
  RESIDENT_NEIGHBORHOOD_MUTATION_FLAG,
  RESIDENT_NEIGHBORHOOD_MUTATION_POSITIVE_INFINITY_BITS,
  RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_BYTES,
  RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX,
  RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_STATE,
  RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_U32,
  RESIDENT_NEIGHBORHOOD_MUTATION_STAGE,
  residentNeighborhoodMutationDisplacementUpperBits,
  residentNeighborhoodMutationNextUpNonNegativeBits,
  residentNeighborhoodMutationPositionEvidence,
  residentNeighborhoodMutationStageId
} from '../ulg-gpu-abi/src/residentNeighborhoodMutationCertificate.js';
import {
  residentNeighborhoodMutationCertificateWriterWgsl
} from '../ulg-gpu-abi/src/residentNeighborhoodMutationCertificateWgsl.js';

test('mutation certificate ABI fixes both records at sixteen uint32 words', () => {
  assert.equal(RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_U32, 16);
  assert.equal(RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_BYTES, 64);
  assert.equal(RESIDENT_NEIGHBORHOOD_MUTATION_ACCUMULATOR_U32, 16);
  assert.equal(RESIDENT_NEIGHBORHOOD_MUTATION_ACCUMULATOR_BYTES, 64);
  assert.deepEqual(Object.values(RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX),
    Array.from({ length: 16 }, (_, index) => index));
  assert.deepEqual(Object.values(RESIDENT_NEIGHBORHOOD_MUTATION_ACCUMULATOR_INDEX),
    Array.from({ length: 16 }, (_, index) => index));
  assert.equal(RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_ABI.slotBytes, 64);
  assert.equal(RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_ABI.accumulatorBytes, 64);
  assert.equal(
    RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_ABI.upperBoundEncoding.reduction,
    'atomic-max-positive-f32-bits'
  );
});

test('mutation stages and flags are closed canonical sets', () => {
  assert.deepEqual(RESIDENT_NEIGHBORHOOD_MUTATION_STAGE, {
    REFERENCE_CHECKPOINT: 0,
    G2P: 1,
    SEPARATION: 2,
    REACTION_PRODUCT_PLACEMENT: 3
  });
  assert.equal(residentNeighborhoodMutationStageId('reference-checkpoint'), 0);
  assert.equal(residentNeighborhoodMutationStageId('g2p'), 1);
  assert.equal(residentNeighborhoodMutationStageId('SEPARATION'), 2);
  assert.equal(residentNeighborhoodMutationStageId('reaction-product-placement'), 3);
  for (const stage of Object.values(RESIDENT_NEIGHBORHOOD_MUTATION_STAGE)) {
    assert.equal(residentNeighborhoodMutationStageId(stage), stage);
  }
  assert.throws(() => residentNeighborhoodMutationStageId(4), /unknown.*stage/);
  assert.throws(() => residentNeighborhoodMutationStageId('future-stage'), /unknown.*stage/);

  const allFlags = [
    ...Object.values(RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG),
    ...Object.values(RESIDENT_NEIGHBORHOOD_MUTATION_FLAG)
  ];
  for (const flag of allFlags) assert.equal(flag > 0 && (flag & (flag - 1)) === 0, true);
  assert.equal(new Set(Object.values(RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG)).size, 3);
  assert.equal(new Set(Object.values(RESIDENT_NEIGHBORHOOD_MUTATION_FLAG)).size, 5);
});

test('armed certificate construction writes the canonical fixed slot', () => {
  const words = createResidentNeighborhoodMutationCertificateSlotWords({
    nonce: 7,
    stageKind: 'g2p',
    targetGeneration: 19,
    leaseTokenLow: 23,
    leaseTokenHigh: 29,
    targetPositionEpoch: 31,
    sourceCount: 37,
    authorityEpoch: 41,
    controlFlags: RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG.FORCE_REBUILD
      | RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG.AUTHORITY_REBASE
  });

  assert.equal(words.length, 16);
  assert.deepEqual([...words], [
    RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_MAGIC,
    RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_VERSION,
    7,
    RESIDENT_NEIGHBORHOOD_MUTATION_STAGE.G2P,
    19,
    23,
    29,
    31,
    37,
    41,
    RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG.FORCE_REBUILD
      | RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG.AUTHORITY_REBASE,
    RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_STATE.ARMED,
    0,
    0,
    0,
    0
  ]);
  assert.throws(
    () => createResidentNeighborhoodMutationCertificateSlotWords({
      nonce: 1,
      stageKind: 99,
      targetGeneration: 1,
      leaseTokenLow: 1,
      leaseTokenHigh: 1,
      targetPositionEpoch: 1,
      sourceCount: 1
    }),
    /unknown.*stage/
  );
  assert.throws(
    () => createResidentNeighborhoodMutationCertificateSlotWords({
      nonce: 1,
      stageKind: 'g2p',
      targetGeneration: 1,
      leaseTokenLow: 1,
      leaseTokenHigh: 1,
      targetPositionEpoch: 1,
      sourceCount: 1,
      controlFlags: 1 << 12
    }),
    /unknown flags/
  );
});

test('upward-rounded L1 bounds have exact positive-f32 bit representations', () => {
  assert.equal(residentNeighborhoodMutationNextUpNonNegativeBits(0), 0);
  assert.equal(residentNeighborhoodMutationNextUpNonNegativeBits(-0), 0);
  assert.equal(residentNeighborhoodMutationNextUpNonNegativeBits(1), 0x3f80_0001);
  assert.equal(
    residentNeighborhoodMutationNextUpNonNegativeBits(Number.POSITIVE_INFINITY),
    RESIDENT_NEIGHBORHOOD_MUTATION_POSITIVE_INFINITY_BITS
  );
  assert.equal(
    residentNeighborhoodMutationNextUpNonNegativeBits(-1),
    RESIDENT_NEIGHBORHOOD_MUTATION_POSITIVE_INFINITY_BITS
  );
  assert.equal(
    residentNeighborhoodMutationDisplacementUpperBits([0, 0, 0], [0, 0, 0]),
    0
  );
  assert.equal(
    residentNeighborhoodMutationDisplacementUpperBits([0, 0, 0], [1, 0, 0]),
    0x3f80_0003
  );
  assert.equal(
    residentNeighborhoodMutationDisplacementUpperBits([0, 0, 0], [1, 2, 3]),
    0x40c0_0003
  );
});

test('position evidence fails closed for nonfinite coordinates and new sources', () => {
  const invalidOld = residentNeighborhoodMutationPositionEvidence({
    sourceIndex: 0,
    previousPosition: [Number.NaN, 0, 0],
    nextPosition: [0, 0, 0],
    previousMass: 1,
    nextMass: 1
  });
  assert.deepEqual(invalidOld, {
    maxIncrementUpperBits: 0,
    mutationFlags: RESIDENT_NEIGHBORHOOD_MUTATION_FLAG.INVALID_OLD_POSITION,
    writerSeen: true
  });
  assert.equal(residentNeighborhoodMutationPositionEvidence({
    sourceIndex: 0,
    previousPosition: [Number.NaN, 0, 0],
    nextPosition: [Number.POSITIVE_INFINITY, 0, 0],
    previousMass: 1,
    nextMass: 1
  }).mutationFlags, RESIDENT_NEIGHBORHOOD_MUTATION_FLAG.INVALID_OLD_POSITION);

  const invalidNew = residentNeighborhoodMutationPositionEvidence({
    sourceIndex: 1,
    previousPosition: [0, 0, 0],
    nextPosition: [0, Number.POSITIVE_INFINITY, 0],
    previousMass: 1,
    nextMass: 1
  });
  assert.equal(
    invalidNew.mutationFlags,
    RESIDENT_NEIGHBORHOOD_MUTATION_FLAG.INVALID_NEW_POSITION
  );
  assert.equal(invalidNew.writerSeen, false);

  const invalidBound = residentNeighborhoodMutationPositionEvidence({
    sourceIndex: 0,
    previousPosition: [3.402823466e+38, 0, 0],
    nextPosition: [-3.402823466e+38, 0, 0],
    previousMass: 1,
    nextMass: 1
  });
  assert.equal(
    invalidBound.mutationFlags,
    RESIDENT_NEIGHBORHOOD_MUTATION_FLAG.INVALID_DISPLACEMENT_BOUND
  );
  assert.equal(invalidBound.maxIncrementUpperBits, 0);

  const activated = residentNeighborhoodMutationPositionEvidence({
    sourceIndex: 0,
    previousPosition: [1, 2, 3],
    nextPosition: [1, 2, 3],
    previousMass: 0,
    nextMass: 1
  });
  assert.equal(
    activated.mutationFlags,
    RESIDENT_NEIGHBORHOOD_MUTATION_FLAG.NEWLY_ACTIVATED_SOURCE
  );
  assert.equal(activated.maxIncrementUpperBits, 0);
  assert.equal(activated.writerSeen, true);
});

test('writer WGSL embeds the canonical slot indices and fail-close arithmetic', () => {
  const wgsl = residentNeighborhoodMutationCertificateWriterWgsl({ binding: 9 });
  assert.match(wgsl, /@binding\(9\)/);
  assert.match(wgsl, /const RESIDENT_MUTATION_SLOT_U32: u32 = 16u/);
  assert.match(wgsl, /const RESIDENT_MUTATION_MAX_INCREMENT_INDEX: u32 = 12u/);
  assert.match(wgsl, /const RESIDENT_MUTATION_FLAGS_INDEX: u32 = 13u/);
  assert.match(wgsl, /const RESIDENT_MUTATION_WRITER_SEEN_INDEX: u32 = 14u/);
  assert.match(wgsl, /if \(value == 0\.0\) \{\s*return 0\.0;/);
  assert.match(wgsl, /resident_mutation_next_up_nonnegative\(abs\(next_value - previous_value\)\)/);
  assert.match(wgsl, /atomicMax\([\s\S]*RESIDENT_MUTATION_MAX_INCREMENT_INDEX/);
  assert.match(wgsl, /RESIDENT_MUTATION_INVALID_OLD/);
  assert.match(wgsl, /RESIDENT_MUTATION_INVALID_NEW/);
  assert.match(wgsl, /RESIDENT_MUTATION_INVALID_BOUND/);
  assert.match(wgsl, /RESIDENT_MUTATION_NEW_SOURCE/);
  assert.throws(
    () => residentNeighborhoodMutationCertificateWriterWgsl({ binding: -1 }),
    /non-negative integer/
  );
});
