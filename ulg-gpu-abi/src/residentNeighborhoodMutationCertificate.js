export const ULG_RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_SCHEMA =
  'peercompute.ulg.resident-neighborhood-mutation-certificate.v0';

export const RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_MAGIC = 0x554c474d;
export const RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_VERSION = 1;
export const RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_SLOT_COUNT_DEFAULT = 128;

export const RESIDENT_NEIGHBORHOOD_MUTATION_STAGE = Object.freeze({
  REFERENCE_CHECKPOINT: 0,
  G2P: 1,
  SEPARATION: 2,
  REACTION_PRODUCT_PLACEMENT: 3
});

export const RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG = Object.freeze({
  FORCE_REBUILD: 1 << 0,
  AUTHORITY_REBASE: 1 << 1,
  CONTINUITY_REJECTED: 1 << 2
});

export const RESIDENT_NEIGHBORHOOD_MUTATION_FLAG = Object.freeze({
  INVALID_OLD_POSITION: 1 << 0,
  INVALID_NEW_POSITION: 1 << 1,
  INVALID_DISPLACEMENT_BOUND: 1 << 2,
  NEWLY_ACTIVATED_SOURCE: 1 << 3,
  SLOT_HEADER_INVALID: 1 << 4
});

export const RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_STATE = Object.freeze({
  FREE: 0,
  ARMED: 1,
  REUSED: 2,
  REBUILT: 3,
  REBUILD_FAILED: 4
});

export const RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_U32_LAYOUT = Object.freeze([
  'magic:u32',
  'version:u32',
  'nonce:u32',
  'stageKind:u32',
  'targetGeneration:u32',
  'leaseTokenLow:u32',
  'leaseTokenHigh:u32',
  'targetPositionEpoch:u32',
  'sourceCount:u32',
  'authorityEpoch:u32',
  'controlFlags:u32',
  'slotState:atomic<u32>',
  'maxIncrementUpperBits:atomic<u32>',
  'mutationFlags:atomic<u32>',
  'writerSeen:atomic<u32>',
  'reserved0:u32'
]);

export const RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX = Object.freeze({
  MAGIC: 0,
  VERSION: 1,
  NONCE: 2,
  STAGE_KIND: 3,
  TARGET_GENERATION: 4,
  LEASE_TOKEN_LOW: 5,
  LEASE_TOKEN_HIGH: 6,
  TARGET_POSITION_EPOCH: 7,
  SOURCE_COUNT: 8,
  AUTHORITY_EPOCH: 9,
  CONTROL_FLAGS: 10,
  SLOT_STATE: 11,
  MAX_INCREMENT_UPPER_BITS: 12,
  MUTATION_FLAGS: 13,
  WRITER_SEEN: 14,
  RESERVED_0: 15
});

export const RESIDENT_NEIGHBORHOOD_MUTATION_ACCUMULATOR_U32_LAYOUT = Object.freeze([
  'magic:atomic<u32>',
  'version:atomic<u32>',
  'ready:atomic<u32>',
  'referencePositionEpoch:atomic<u32>',
  'coveredPositionEpoch:atomic<u32>',
  'cumulativeUpperBits:atomic<u32>',
  'invalidFlags:atomic<u32>',
  'sourceCount:atomic<u32>',
  'lastNonce:atomic<u32>',
  'topologyGeneration:atomic<u32>',
  'decisionCount:atomic<u32>',
  'reuseCount:atomic<u32>',
  'rebuildCount:atomic<u32>',
  'lastStageKind:atomic<u32>',
  'lastStageUpperBits:atomic<u32>',
  'authorityEpoch:atomic<u32>'
]);

export const RESIDENT_NEIGHBORHOOD_MUTATION_ACCUMULATOR_INDEX = Object.freeze({
  MAGIC: 0,
  VERSION: 1,
  READY: 2,
  REFERENCE_POSITION_EPOCH: 3,
  COVERED_POSITION_EPOCH: 4,
  CUMULATIVE_UPPER_BITS: 5,
  INVALID_FLAGS: 6,
  SOURCE_COUNT: 7,
  LAST_NONCE: 8,
  TOPOLOGY_GENERATION: 9,
  DECISION_COUNT: 10,
  REUSE_COUNT: 11,
  REBUILD_COUNT: 12,
  LAST_STAGE_KIND: 13,
  LAST_STAGE_UPPER_BITS: 14,
  AUTHORITY_EPOCH: 15
});

export const RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_U32 =
  RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_U32_LAYOUT.length;
export const RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_BYTES =
  RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_U32 * Uint32Array.BYTES_PER_ELEMENT;
export const RESIDENT_NEIGHBORHOOD_MUTATION_ACCUMULATOR_U32 =
  RESIDENT_NEIGHBORHOOD_MUTATION_ACCUMULATOR_U32_LAYOUT.length;
export const RESIDENT_NEIGHBORHOOD_MUTATION_ACCUMULATOR_BYTES =
  RESIDENT_NEIGHBORHOOD_MUTATION_ACCUMULATOR_U32 * Uint32Array.BYTES_PER_ELEMENT;

export const RESIDENT_NEIGHBORHOOD_MUTATION_POSITIVE_INFINITY_BITS = 0x7f80_0000;
export const RESIDENT_NEIGHBORHOOD_MUTATION_UPPER_BOUND_ENCODING = Object.freeze({
  scalar: 'positive-f32-bitcast-u32',
  metric: 'l1',
  componentPolicy: 'next-representable-f32-after-nonzero-absolute-difference',
  additionPolicy: 'next-representable-f32-after-each-nonzero-partial-sum',
  zeroEncoding: 0,
  invalidEncoding: RESIDENT_NEIGHBORHOOD_MUTATION_POSITIVE_INFINITY_BITS,
  reduction: 'atomic-max-positive-f32-bits'
});

const KNOWN_MUTATION_STAGE_IDS = new Set(Object.values(RESIDENT_NEIGHBORHOOD_MUTATION_STAGE));
const KNOWN_MUTATION_CONTROL_FLAG_MASK = Object.values(
  RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG
).reduce((mask, flag) => (mask | flag) >>> 0, 0);
const KNOWN_MUTATION_FLAG_MASK = Object.values(RESIDENT_NEIGHBORHOOD_MUTATION_FLAG)
  .reduce((mask, flag) => (mask | flag) >>> 0, 0);
const KNOWN_MUTATION_SLOT_STATES = new Set(Object.values(
  RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_STATE
));
const F32_WORD_BUFFER = new ArrayBuffer(Uint32Array.BYTES_PER_ELEMENT);
const F32_WORD_VIEW = new DataView(F32_WORD_BUFFER);

function uint32(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 0xffff_ffff) {
    throw new RangeError(`${label} must be a uint32`);
  }
  return number >>> 0;
}

function knownFlagWord(value, mask, label) {
  const word = uint32(value, label);
  if ((word & ~mask) !== 0) throw new RangeError(`${label} contains unknown flags`);
  return word;
}

function f32Bits(value) {
  F32_WORD_VIEW.setFloat32(0, Math.fround(value), true);
  return F32_WORD_VIEW.getUint32(0, true);
}

function f32FromBits(bits) {
  F32_WORD_VIEW.setUint32(0, bits >>> 0, true);
  return F32_WORD_VIEW.getFloat32(0, true);
}

function finitePosition(position, label) {
  if ((!Array.isArray(position) && !ArrayBuffer.isView(position)) || position.length < 3) {
    throw new TypeError(`${label} must contain x, y, and z`);
  }
  return [0, 1, 2].map((axis) => Math.fround(Number(position[axis])));
}

export function residentNeighborhoodMutationStageId(value) {
  if (Number.isInteger(value)) {
    const stage = uint32(value, 'resident neighborhood mutation stage');
    if (KNOWN_MUTATION_STAGE_IDS.has(stage)) return stage;
    throw new RangeError(`unknown resident neighborhood mutation stage ${value}`);
  }
  const key = String(value || '').replaceAll('-', '_').toUpperCase();
  const stage = RESIDENT_NEIGHBORHOOD_MUTATION_STAGE[key];
  if (stage === undefined) {
    throw new RangeError(`unknown resident neighborhood mutation stage ${value}`);
  }
  return stage;
}

export function residentNeighborhoodMutationNextUpNonNegativeBits(value) {
  const scalar = Math.fround(Number(value));
  if (!Number.isFinite(scalar) || scalar < 0) {
    return RESIDENT_NEIGHBORHOOD_MUTATION_POSITIVE_INFINITY_BITS;
  }
  if (scalar === 0) return 0;
  const bits = f32Bits(scalar);
  return bits >= 0x7f7f_ffff
    ? RESIDENT_NEIGHBORHOOD_MUTATION_POSITIVE_INFINITY_BITS
    : (bits + 1) >>> 0;
}

export function residentNeighborhoodMutationDisplacementUpperBits(
  previousPosition,
  nextPosition
) {
  const previous = finitePosition(previousPosition, 'previousPosition');
  const next = finitePosition(nextPosition, 'nextPosition');
  if (!previous.every(Number.isFinite) || !next.every(Number.isFinite)) {
    return RESIDENT_NEIGHBORHOOD_MUTATION_POSITIVE_INFINITY_BITS;
  }
  const componentUpper = (nextValue, previousValue) => {
    if (nextValue === previousValue) return 0;
    return residentNeighborhoodMutationNextUpNonNegativeBits(
      Math.abs(Math.fround(nextValue - previousValue))
    );
  };
  const dx = f32FromBits(componentUpper(next[0], previous[0]));
  const dy = f32FromBits(componentUpper(next[1], previous[1]));
  const dz = f32FromBits(componentUpper(next[2], previous[2]));
  const xyBits = residentNeighborhoodMutationNextUpNonNegativeBits(Math.fround(dx + dy));
  return residentNeighborhoodMutationNextUpNonNegativeBits(
    Math.fround(f32FromBits(xyBits) + dz)
  );
}

export function residentNeighborhoodMutationPositionEvidence({
  sourceIndex,
  previousPosition,
  nextPosition,
  previousMass,
  nextMass
} = {}) {
  const index = uint32(sourceIndex, 'sourceIndex');
  const previous = finitePosition(previousPosition, 'previousPosition');
  const next = finitePosition(nextPosition, 'nextPosition');
  if (!previous.every(Number.isFinite)) {
    return Object.freeze({
      maxIncrementUpperBits: 0,
      mutationFlags: RESIDENT_NEIGHBORHOOD_MUTATION_FLAG.INVALID_OLD_POSITION,
      writerSeen: index === 0
    });
  }
  if (!next.every(Number.isFinite)) {
    return Object.freeze({
      maxIncrementUpperBits: 0,
      mutationFlags: RESIDENT_NEIGHBORHOOD_MUTATION_FLAG.INVALID_NEW_POSITION,
      writerSeen: index === 0
    });
  }
  let maxIncrementUpperBits = residentNeighborhoodMutationDisplacementUpperBits(previous, next);
  if (maxIncrementUpperBits === RESIDENT_NEIGHBORHOOD_MUTATION_POSITIVE_INFINITY_BITS) {
    return Object.freeze({
      maxIncrementUpperBits: 0,
      mutationFlags: RESIDENT_NEIGHBORHOOD_MUTATION_FLAG.INVALID_DISPLACEMENT_BOUND,
      writerSeen: index === 0
    });
  }
  const mutationFlags = !(Math.fround(Number(previousMass)) > 0)
      && Math.fround(Number(nextMass)) > 0
    ? RESIDENT_NEIGHBORHOOD_MUTATION_FLAG.NEWLY_ACTIVATED_SOURCE
    : 0;
  return Object.freeze({
    maxIncrementUpperBits,
    mutationFlags: mutationFlags >>> 0,
    writerSeen: index === 0
  });
}

export function createResidentNeighborhoodMutationCertificateSlotWords({
  nonce,
  stageKind,
  targetGeneration,
  leaseTokenLow,
  leaseTokenHigh,
  targetPositionEpoch,
  sourceCount,
  authorityEpoch = 0,
  controlFlags = 0,
  slotState = RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_STATE.ARMED,
  maxIncrementUpperBits = 0,
  mutationFlags = 0,
  writerSeen = false
} = {}) {
  const resolvedSlotState = uint32(slotState, 'slotState');
  if (!KNOWN_MUTATION_SLOT_STATES.has(resolvedSlotState)) {
    throw new RangeError(`unknown resident neighborhood mutation slot state ${slotState}`);
  }
  const words = new Uint32Array(RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_U32);
  words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.MAGIC] =
    RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_MAGIC;
  words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.VERSION] =
    RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_VERSION;
  words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.NONCE] = uint32(nonce, 'nonce');
  words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.STAGE_KIND] =
    residentNeighborhoodMutationStageId(stageKind);
  words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.TARGET_GENERATION] =
    uint32(targetGeneration, 'targetGeneration');
  words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.LEASE_TOKEN_LOW] =
    uint32(leaseTokenLow, 'leaseTokenLow');
  words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.LEASE_TOKEN_HIGH] =
    uint32(leaseTokenHigh, 'leaseTokenHigh');
  words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.TARGET_POSITION_EPOCH] =
    uint32(targetPositionEpoch, 'targetPositionEpoch');
  words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.SOURCE_COUNT] =
    uint32(sourceCount, 'sourceCount');
  words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.AUTHORITY_EPOCH] =
    uint32(authorityEpoch, 'authorityEpoch');
  words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.CONTROL_FLAGS] = knownFlagWord(
    controlFlags,
    KNOWN_MUTATION_CONTROL_FLAG_MASK,
    'controlFlags'
  );
  words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.SLOT_STATE] = resolvedSlotState;
  words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.MAX_INCREMENT_UPPER_BITS] =
    uint32(maxIncrementUpperBits, 'maxIncrementUpperBits');
  words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.MUTATION_FLAGS] = knownFlagWord(
    mutationFlags,
    KNOWN_MUTATION_FLAG_MASK,
    'mutationFlags'
  );
  words[RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.WRITER_SEEN] = writerSeen ? 1 : 0;
  return words;
}

export const RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_ABI = Object.freeze({
  schema: ULG_RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_SCHEMA,
  magic: RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_MAGIC,
  version: RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_VERSION,
  slotU32: RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_U32,
  slotBytes: RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_BYTES,
  slotLayout: RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_U32_LAYOUT,
  slotIndex: RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX,
  accumulatorU32: RESIDENT_NEIGHBORHOOD_MUTATION_ACCUMULATOR_U32,
  accumulatorBytes: RESIDENT_NEIGHBORHOOD_MUTATION_ACCUMULATOR_BYTES,
  accumulatorLayout: RESIDENT_NEIGHBORHOOD_MUTATION_ACCUMULATOR_U32_LAYOUT,
  accumulatorIndex: RESIDENT_NEIGHBORHOOD_MUTATION_ACCUMULATOR_INDEX,
  stage: RESIDENT_NEIGHBORHOOD_MUTATION_STAGE,
  controlFlag: RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG,
  mutationFlag: RESIDENT_NEIGHBORHOOD_MUTATION_FLAG,
  slotState: RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_STATE,
  upperBoundEncoding: RESIDENT_NEIGHBORHOOD_MUTATION_UPPER_BOUND_ENCODING
});
