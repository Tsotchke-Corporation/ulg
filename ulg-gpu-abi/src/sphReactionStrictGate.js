export const ULG_SPH_REACTION_STRICT_GATE_CONTROL_SCHEMA =
  'peercompute.ulg.sph-reaction-strict-gate-control.v2';
export const ULG_SPH_REACTION_STRICT_GATE_PRODUCER_SHADOW_SCHEMA =
  'peercompute.ulg.sph-reaction-strict-gate-producer-shadow.v1';

// "SRG2". The control remains GPU resident; a consumer may use it only after
// validating the complete envelope and observing an explicit PASS bit.
export const SPH_REACTION_STRICT_GATE_MAGIC = 0x5352_4732;
export const SPH_REACTION_STRICT_GATE_VERSION = 2;
export const SPH_REACTION_STRICT_GATE_WORDS = 16;
export const SPH_REACTION_STRICT_GATE_BYTES =
  SPH_REACTION_STRICT_GATE_WORDS * Uint32Array.BYTES_PER_ELEMENT;
export const SPH_REACTION_STRICT_GATE_MAX_ATOMIC_NUMBER = 118;
// Every integer in [0, 2^24] is exactly representable as f32. Row-carried
// indices are therefore restricted to [0, 2^24), while diagnostic counts may
// use the inclusive 2^24 endpoint.
export const SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE = 0x0100_0000;

// "SRP2". This receipt is written by the atom-residual producer and consumed
// independently by the strict-gate finalizer. Its seal identifies the exact
// atom-term table/evidence generation; consumer expectations never author
// these actual values.
export const SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_MAGIC = 0x5352_5032;
export const SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION = 2;
export const SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_WORDS = 16;
export const SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_BYTES =
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_WORDS * Uint32Array.BYTES_PER_ELEMENT;
export const SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_STATUS = Object.freeze({
  READY: 1 << 0,
  BLOCKED: 1 << 1,
  FAIL_CLOSED: 1 << 2
});
export const SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_LAYOUT = Object.freeze([
  'magic:u32',
  'version:u32',
  'statusFlags:u32',
  'blockerFlags:u32',
  'sourceGeneration:u32',
  'completionGeneration:u32',
  'seal:u32',
  'reactionCount:u32',
  'atomTermCount:u32',
  'atomResidualCapacity:u32',
  'atomTermCapacity:u32',
  'atomResidualStrideVec4:u32',
  'atomTermStrideVec4:u32',
  'producerSequence:u32',
  'shadowPlaneWordCount:u32',
  'shadowLogicalWordCount:u32'
]);
export const SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX = Object.freeze(
  Object.fromEntries(
    SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_LAYOUT.map((field, index) => [
      field.slice(0, field.indexOf(':')),
      index
    ])
  )
);
export const SPH_REACTION_STRICT_GATE_SHADOW_ROW_WORDS = 8;
export const SPH_REACTION_STRICT_GATE_SHADOW_PLANE_COUNT = 2;

// Residual authority is reaction-local: word 11 is the maximum absolute sum
// over (reaction, Z), and word 12 is the maximum absolute charge sum over
// reactions. Neither field permits cancellation between independent reactions.
export const SPH_REACTION_STRICT_GATE_LAYOUT = Object.freeze([
  'magic:u32',
  'version:u32',
  'statusFlags:u32',
  'blockerFlags:u32',
  'sourceGeneration:u32',
  'completionGeneration:u32',
  'seal:u32',
  'reactionCount:u32',
  'atomTermCount:u32',
  'readyRowCount:u32',
  'problemRowCount:u32',
  'maxAbsAtomResidualMol:f32-bits',
  'maxAbsChargeResidualMol:f32-bits',
  'atomResidualToleranceMol:f32-bits',
  'chargeResidualToleranceMol:f32-bits',
  'staticBlockerFlags:u32'
]);

export const SPH_REACTION_STRICT_GATE_INDEX = Object.freeze(
  Object.fromEntries(
    SPH_REACTION_STRICT_GATE_LAYOUT.map((field, index) => [
      field.slice(0, field.indexOf(':')),
      index
    ])
  )
);

export const SPH_REACTION_STRICT_GATE_PARAMS_LAYOUT = Object.freeze([
  'reactionCount:u32',
  'atomTermCount:u32',
  'atomResidualCapacity:u32',
  'atomTermCapacity:u32',
  'expectedSourceGeneration:u32',
  'expectedCompletionGeneration:u32',
  'expectedSeal:u32',
  'staticBlockerFlags:u32',
  'atomResidualToleranceMol:f32-bits',
  'chargeResidualToleranceMol:f32-bits',
  'atomResidualStrideVec4:u32',
  'atomTermStrideVec4:u32',
  'gateWordCount:u32',
  'expectedGateVersion:u32',
  'producerReceiptWordCount:u32',
  'expectedProducerReceiptVersion:u32'
]);
export const SPH_REACTION_STRICT_GATE_PARAMS_INDEX = Object.freeze(
  Object.fromEntries(
    SPH_REACTION_STRICT_GATE_PARAMS_LAYOUT.map((field, index) => [
      field.slice(0, field.indexOf(':')),
      index
    ])
  )
);
export const SPH_REACTION_STRICT_GATE_PARAMS_WORDS = 16;
export const SPH_REACTION_STRICT_GATE_PARAMS_BYTES =
  SPH_REACTION_STRICT_GATE_PARAMS_WORDS * Uint32Array.BYTES_PER_ELEMENT;

export const SPH_REACTION_STRICT_GATE_STATUS = Object.freeze({
  INITIALIZED: 1 << 0,
  EVIDENCE_COMPLETE: 1 << 1,
  FINALIZED: 1 << 2,
  PASS: 1 << 3,
  BLOCKED: 1 << 4,
  FAIL_CLOSED: 1 << 5
});

export const SPH_REACTION_STRICT_GATE_BLOCKER = Object.freeze({
  MISSING_EVIDENCE: 1 << 0,
  PROBLEM_ROW: 1 << 1,
  NONFINITE_EVIDENCE: 1 << 2,
  ATOM_RESIDUAL_OUT_OF_TOLERANCE: 1 << 3,
  CHARGE_RESIDUAL_OUT_OF_TOLERANCE: 1 << 4,
  GENERATION_MISMATCH: 1 << 5,
  SEAL_MISMATCH: 1 << 6,
  PROVISIONAL_ENERGETICS: 1 << 7,
  ATOM_BALANCE_UNPROVEN: 1 << 8,
  CHARGE_BALANCE_UNPROVEN: 1 << 9,
  STATIC_INPUT_INVALID: 1 << 10,
  LAYOUT_MISMATCH: 1 << 11,
  BITWISE_SHADOW_MISMATCH: 1 << 12
});

export const SPH_REACTION_STRICT_GATE_STATIC_BLOCKER_MASK = (
  SPH_REACTION_STRICT_GATE_BLOCKER.PROVISIONAL_ENERGETICS
  | SPH_REACTION_STRICT_GATE_BLOCKER.ATOM_BALANCE_UNPROVEN
  | SPH_REACTION_STRICT_GATE_BLOCKER.CHARGE_BALANCE_UNPROVEN
  | SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID
) >>> 0;

const STATUS_MASK = Object.values(SPH_REACTION_STRICT_GATE_STATUS)
  .reduce((mask, value) => mask | value, 0) >>> 0;
const BLOCKER_MASK = Object.values(SPH_REACTION_STRICT_GATE_BLOCKER)
  .reduce((mask, value) => mask | value, 0) >>> 0;
const ATOM_RESIDUAL_ROW_FLOATS = 8;
const ATOM_TERM_ROW_FLOATS = 8;

export function sphReactionStrictGateF32ToBits(value) {
  const bytes = new ArrayBuffer(4);
  const view = new DataView(bytes);
  view.setFloat32(0, Number(value), true);
  return view.getUint32(0, true);
}

export function sphReactionStrictGateBitsToF32(value) {
  const bytes = new ArrayBuffer(4);
  const view = new DataView(bytes);
  view.setUint32(0, Number(value) >>> 0, true);
  return view.getFloat32(0, true);
}

function shiftRightJamU32(value, distance) {
  const word = value >>> 0;
  if (distance === 0) return word;
  if (distance < 32) {
    return (
      (word >>> distance)
      | (((word << (32 - distance)) >>> 0) !== 0 ? 1 : 0)
    ) >>> 0;
  }
  return word !== 0 ? 1 : 0;
}

// Integer-domain binary32 addition mirrored by the WGSL finalizer. This is
// round-to-nearest, ties-to-even with gradual underflow and explicit overflow;
// no host/shader floating-point mode can change the authority result.
function addRteF32Bits(aValue, bValue) {
  const aBits = aValue >>> 0;
  const bBits = bValue >>> 0;
  let aExponentField = (aBits >>> 23) & 0xff;
  let bExponentField = (bBits >>> 23) & 0xff;
  if (aExponentField === 0xff || bExponentField === 0xff) {
    return { bits: 0x7f80_0000, finite: false };
  }
  const aFraction = aBits & 0x007f_ffff;
  const bFraction = bBits & 0x007f_ffff;
  let aSignificand = aExponentField === 0
    ? aFraction
    : (0x0080_0000 | aFraction);
  let bSignificand = bExponentField === 0
    ? bFraction
    : (0x0080_0000 | bFraction);
  if (aSignificand === 0 && bSignificand === 0) {
    return { bits: 0, finite: true };
  }
  if (aSignificand === 0) return { bits: bBits, finite: true };
  if (bSignificand === 0) return { bits: aBits, finite: true };

  let aExponent = aExponentField === 0 ? 1 : aExponentField;
  let bExponent = bExponentField === 0 ? 1 : bExponentField;
  const aSign = aBits >>> 31;
  const bSign = bBits >>> 31;
  let resultSign = 0;
  let resultExponent = 1;
  let extended = 0;
  if (aSign === bSign) {
    resultSign = aSign;
    if (aExponent < bExponent) {
      [aExponent, bExponent] = [bExponent, aExponent];
      [aSignificand, bSignificand] = [bSignificand, aSignificand];
    }
    resultExponent = aExponent;
    extended = (
      ((aSignificand << 3) >>> 0)
      + shiftRightJamU32(
        (bSignificand << 3) >>> 0,
        aExponent - bExponent
      )
    ) >>> 0;
    if ((extended & 0x0800_0000) !== 0) {
      extended = shiftRightJamU32(extended, 1);
      resultExponent += 1;
    }
  } else {
    const aIsLarger = aExponent > bExponent
      || (aExponent === bExponent && aSignificand >= bSignificand);
    if (aExponent === bExponent && aSignificand === bSignificand) {
      return { bits: 0, finite: true };
    }
    const largerExponent = aIsLarger ? aExponent : bExponent;
    const smallerExponent = aIsLarger ? bExponent : aExponent;
    const largerSignificand = aIsLarger ? aSignificand : bSignificand;
    const smallerSignificand = aIsLarger ? bSignificand : aSignificand;
    resultSign = aIsLarger ? aSign : bSign;
    resultExponent = largerExponent;
    extended = (
      ((largerSignificand << 3) >>> 0)
      - shiftRightJamU32(
        (smallerSignificand << 3) >>> 0,
        largerExponent - smallerExponent
      )
    ) >>> 0;
    while (
      resultExponent > 1
      && (extended & 0x0400_0000) === 0
    ) {
      extended = (extended << 1) >>> 0;
      resultExponent -= 1;
    }
  }

  let roundedSignificand = extended >>> 3;
  const roundBits = extended & 0x7;
  if (
    roundBits > 0x4
    || (roundBits === 0x4 && (roundedSignificand & 0x1) !== 0)
  ) {
    roundedSignificand = (roundedSignificand + 1) >>> 0;
    if (roundedSignificand === 0x0100_0000) {
      roundedSignificand = 0x0080_0000;
      resultExponent += 1;
    }
  }
  if (resultExponent >= 0xff) {
    return {
      bits: ((resultSign << 31) | 0x7f80_0000) >>> 0,
      finite: false
    };
  }
  const outputExponent = resultExponent === 1
    && roundedSignificand < 0x0080_0000
      ? 0
      : resultExponent;
  return {
    bits: (
      (resultSign << 31)
      | (outputExponent << 23)
      | (roundedSignificand & 0x007f_ffff)
    ) >>> 0,
    finite: true
  };
}

function u32OrZero(value) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= 0xffff_ffff
    ? value >>> 0
    : 0;
}

function isU32(value) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= 0xffff_ffff;
}

function finiteNonnegativeF32OrZero(value) {
  const number = typeof value === 'number' ? Math.fround(value) : Number.NaN;
  return Number.isFinite(number) && number >= 0 && !Object.is(number, -0)
    ? number
    : 0;
}

function sanitizeStaticBlockers(value) {
  if (!isU32(value)) {
    return SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID;
  }
  const raw = u32OrZero(value);
  const unknown = raw & ~SPH_REACTION_STRICT_GATE_STATIC_BLOCKER_MASK;
  return (
    (raw & SPH_REACTION_STRICT_GATE_STATIC_BLOCKER_MASK)
    | (unknown ? SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID : 0)
  ) >>> 0;
}

function exactU32Words(value, wordLength, byteLength) {
  if (value instanceof Uint32Array) {
    return value.length === wordLength ? value : null;
  }
  if (value instanceof ArrayBuffer && value.byteLength === byteLength) {
    return new Uint32Array(value);
  }
  if (ArrayBuffer.isView(value) && value.byteLength === byteLength) {
    if (value.byteOffset % Uint32Array.BYTES_PER_ELEMENT !== 0) return null;
    return new Uint32Array(value.buffer, value.byteOffset, wordLength);
  }
  return null;
}

// Legacy diagnostic checksum retained only for collision regression and
// offline comparison. It is deliberately absent from the v2 receipt,
// finalizer, build-plan proof, and every admission predicate.
export function hashSphReactionStrictGateF32Rows(
  values,
  rowCount,
  rowStrideFloats = ATOM_RESIDUAL_ROW_FLOATS
) {
  if (
    !(values instanceof Float32Array)
    || !isU32(rowCount)
    || !isU32(rowStrideFloats)
    || rowStrideFloats === 0
    || values.length < rowCount * rowStrideFloats
  ) return null;
  const words = new Uint32Array(
    values.buffer,
    values.byteOffset,
    rowCount * rowStrideFloats
  );
  let hash = 0x811c_9dc5;
  for (const word of words) {
    hash = Math.imul((hash ^ word) >>> 0, 0x0100_0193) >>> 0;
  }
  return hash >>> 0;
}

function sphReactionStrictGateF32WordsMatchShadow(
  values,
  shadowWords,
  shadowWordOffset,
  wordCount
) {
  if (
    !(values instanceof Float32Array)
    || !(shadowWords instanceof Uint32Array)
    || !isU32(shadowWordOffset)
    || !isU32(wordCount)
    || values.length < wordCount
    || shadowWords.length < shadowWordOffset + wordCount
  ) return null;
  const valueWords = new Uint32Array(
    values.buffer,
    values.byteOffset,
    wordCount
  );
  for (let wordIndex = 0; wordIndex < wordCount; wordIndex += 1) {
    if (
      valueWords[wordIndex]
        !== shadowWords[shadowWordOffset + wordIndex]
    ) return false;
  }
  return true;
}

export function createSphReactionStrictGateProducerShadow({
  atomResidualValues = null,
  atomTermValues = null,
  atomTermCount = 0
} = {}) {
  if (
    !(atomResidualValues instanceof Float32Array)
    || !(atomTermValues instanceof Float32Array)
    || !isU32(atomTermCount)
    || atomTermCount >= SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
  ) return null;
  const planeWordCount = atomTermCount
    * SPH_REACTION_STRICT_GATE_SHADOW_ROW_WORDS;
  if (
    atomResidualValues.length < planeWordCount
    || atomTermValues.length < planeWordCount
  ) return null;
  const shadowWords = new Uint32Array(
    Math.max(
      1,
      planeWordCount * SPH_REACTION_STRICT_GATE_SHADOW_PLANE_COUNT
    )
  );
  shadowWords.set(new Uint32Array(
    atomResidualValues.buffer,
    atomResidualValues.byteOffset,
    planeWordCount
  ));
  shadowWords.set(new Uint32Array(
    atomTermValues.buffer,
    atomTermValues.byteOffset,
    planeWordCount
  ), planeWordCount);
  return shadowWords;
}

// CPU/oracle packer for ABI tests and offline diagnostics only. Production
// authority must come from the GPU producer's separately bound receipt; the
// finalizer deliberately has read-only access and never calls this helper.
export function createSphReactionStrictGateProducerReceipt({
  atomResidualValues = null,
  atomTermValues = null,
  producerShadowWords = null,
  sourceGeneration = 0,
  completionGeneration = 0,
  seal = 0,
  reactionCount = 0,
  atomTermCount = 0,
  atomResidualCapacity = atomTermCount,
  atomTermCapacity = atomTermCount,
  atomResidualStrideVec4 = 2,
  atomTermStrideVec4 = 2,
  producerSequence = 1,
  blockerFlags = 0
} = {}) {
  const words = new Uint32Array(
    SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_WORDS
  );
  const integerValues = [
    sourceGeneration,
    completionGeneration,
    seal,
    reactionCount,
    atomTermCount,
    atomResidualCapacity,
    atomTermCapacity,
    atomResidualStrideVec4,
    atomTermStrideVec4,
    producerSequence,
    blockerFlags
  ];
  const countsExact = reactionCount < SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
    && atomTermCount < SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
    && atomResidualCapacity < SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
    && atomTermCapacity < SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE;
  const suppliedBlockers = isU32(blockerFlags)
    ? (blockerFlags >>> 0) & BLOCKER_MASK
    : SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID;
  const unknownBlockers = isU32(blockerFlags)
    ? (blockerFlags >>> 0) & ~BLOCKER_MASK
    : 0;
  const shadowPlaneWordCount = u32OrZero(atomTermCount)
    * SPH_REACTION_STRICT_GATE_SHADOW_ROW_WORDS;
  const shadowLogicalWordCount = shadowPlaneWordCount
    * SPH_REACTION_STRICT_GATE_SHADOW_PLANE_COUNT;
  const shadowPhysicalWordCount = Math.max(1, shadowLogicalWordCount);
  const shadowValid = producerShadowWords instanceof Uint32Array
    && producerShadowWords.length === shadowPhysicalWordCount
    && (shadowLogicalWordCount !== 0 || producerShadowWords[0] === 0)
    && sphReactionStrictGateF32WordsMatchShadow(
      atomResidualValues,
      producerShadowWords,
      0,
      shadowPlaneWordCount
    ) === true
    && sphReactionStrictGateF32WordsMatchShadow(
      atomTermValues,
      producerShadowWords,
      shadowPlaneWordCount,
      shadowPlaneWordCount
    ) === true;
  const inputValid = integerValues.every(isU32)
    && sourceGeneration !== 0
    && completionGeneration !== 0
    && seal !== 0
    && producerSequence !== 0
    && countsExact
    && atomResidualCapacity >= atomTermCount
    && atomTermCapacity >= atomTermCount
    && atomResidualStrideVec4 === 2
    && atomTermStrideVec4 === 2
    && shadowValid
    && ((reactionCount === 0) === (atomTermCount === 0));
  const receiptBlockers = (
    suppliedBlockers
    | (inputValid && unknownBlockers === 0
      ? 0
      : SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID)
  ) >>> 0;
  const ready = receiptBlockers === 0;
  const index = SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX;
  words[index.magic] = SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_MAGIC;
  words[index.version] = SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION;
  words[index.statusFlags] = ready
    ? SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_STATUS.READY
    : (
        SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_STATUS.BLOCKED
        | SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_STATUS.FAIL_CLOSED
      ) >>> 0;
  words[index.blockerFlags] = receiptBlockers;
  words[index.sourceGeneration] = u32OrZero(sourceGeneration);
  words[index.completionGeneration] = u32OrZero(completionGeneration);
  words[index.seal] = u32OrZero(seal);
  words[index.reactionCount] = u32OrZero(reactionCount);
  words[index.atomTermCount] = u32OrZero(atomTermCount);
  words[index.atomResidualCapacity] = u32OrZero(atomResidualCapacity);
  words[index.atomTermCapacity] = u32OrZero(atomTermCapacity);
  words[index.atomResidualStrideVec4] = u32OrZero(atomResidualStrideVec4);
  words[index.atomTermStrideVec4] = u32OrZero(atomTermStrideVec4);
  words[index.producerSequence] = u32OrZero(producerSequence);
  words[index.shadowPlaneWordCount] = shadowPlaneWordCount >>> 0;
  words[index.shadowLogicalWordCount] = shadowLogicalWordCount >>> 0;
  return words;
}

export function decodeSphReactionStrictGateProducerReceipt(value) {
  const words = exactU32Words(
    value,
    SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_WORDS,
    SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_BYTES
  );
  if (!words) return null;
  const index = SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX;
  return Object.freeze(Object.fromEntries(
    Object.keys(index).map((name) => [name, words[index[name]] >>> 0])
  ));
}

export function validateSphReactionStrictGateProducerReceipt(value, {
  sourceGeneration = null,
  completionGeneration = null,
  seal = null,
  reactionCount = null,
  atomTermCount = null,
  atomResidualCapacity = null,
  atomTermCapacity = null,
  atomResidualStrideVec4 = null,
  atomTermStrideVec4 = null,
  version = null,
  requireExpectedAuthority = true
} = {}) {
  const receipt = decodeSphReactionStrictGateProducerReceipt(value);
  const reasons = [];
  const expectations = {
    sourceGeneration,
    completionGeneration,
    seal,
    reactionCount,
    atomTermCount,
    atomResidualCapacity,
    atomTermCapacity,
    atomResidualStrideVec4,
    atomTermStrideVec4,
    version
  };
  if (!receipt) {
    reasons.push('producer-receipt-byte-length-mismatch');
  } else {
    if (receipt.magic !== SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_MAGIC) {
      reasons.push('producer-receipt-magic-mismatch');
    }
    if (receipt.version !== SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION) {
      reasons.push('producer-receipt-version-mismatch');
    }
    if (
      receipt.statusFlags
        !== SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_STATUS.READY
      || receipt.blockerFlags !== 0
    ) reasons.push('producer-receipt-not-ready');
    if (
      receipt.sourceGeneration === 0
      || receipt.completionGeneration === 0
      || receipt.seal === 0
      || receipt.producerSequence === 0
    ) reasons.push('producer-receipt-lineage-invalid');
    if (
      receipt.reactionCount >= SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
      || receipt.atomTermCount >= SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
      || receipt.atomResidualCapacity >= SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
      || receipt.atomTermCapacity >= SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
      || receipt.atomResidualCapacity < receipt.atomTermCount
      || receipt.atomTermCapacity < receipt.atomTermCount
      || ((receipt.reactionCount === 0) !== (receipt.atomTermCount === 0))
    ) reasons.push('producer-receipt-counts-invalid');
    if (
      receipt.atomResidualStrideVec4 !== 2
      || receipt.atomTermStrideVec4 !== 2
    ) reasons.push('producer-receipt-stride-invalid');
    const expectedShadowPlaneWordCount = receipt.atomTermCount
      * SPH_REACTION_STRICT_GATE_SHADOW_ROW_WORDS;
    const expectedShadowLogicalWordCount = expectedShadowPlaneWordCount
      * SPH_REACTION_STRICT_GATE_SHADOW_PLANE_COUNT;
    if (
      receipt.shadowPlaneWordCount !== expectedShadowPlaneWordCount
      || receipt.shadowLogicalWordCount !== expectedShadowLogicalWordCount
    ) reasons.push('producer-receipt-shadow-layout-invalid');
    for (const [name, expected] of Object.entries(expectations)) {
      if (expected === null) {
        if (requireExpectedAuthority) reasons.push(`expected-${name}-required`);
        continue;
      }
      const actualName = name === 'version' ? 'version' : name;
      if (!isU32(expected) || receipt[actualName] !== expected) {
        reasons.push(`${name}-mismatch`);
      }
    }
  }
  const valid = reasons.length === 0;
  const authorityBound = Object.values(expectations).every(
    (expected) => expected !== null
  );
  return Object.freeze({
    valid,
    // `requireExpectedAuthority: false` is a structural diagnostic mode. It
    // may establish that the receipt envelope is well formed, but it must not
    // mint admission authority when the caller omitted the independent
    // expectations that bind that envelope to this execution.
    authorityBound,
    pass: valid && authorityBound,
    blocked: !(valid && authorityBound),
    reasons: Object.freeze(reasons),
    receipt
  });
}

export function createSphReactionStrictGateFinalizeParams({
  reactionCount = 0,
  atomTermCount = 0,
  atomResidualCapacity = atomTermCount,
  atomTermCapacity = atomTermCount,
  expectedSourceGeneration = 0,
  expectedCompletionGeneration = 0,
  expectedSeal = 0,
  staticBlockerFlags = 0,
  atomResidualToleranceMol = 1e-6,
  chargeResidualToleranceMol = 1e-6
} = {}) {
  const words = new Uint32Array(SPH_REACTION_STRICT_GATE_PARAMS_WORDS);
  const integers = [
    reactionCount,
    atomTermCount,
    atomResidualCapacity,
    atomTermCapacity,
    expectedSourceGeneration,
    expectedCompletionGeneration,
    expectedSeal
  ];
  const atomTolerance = typeof atomResidualToleranceMol === 'number'
    ? Math.fround(atomResidualToleranceMol)
    : Number.NaN;
  const chargeTolerance = typeof chargeResidualToleranceMol === 'number'
    ? Math.fround(chargeResidualToleranceMol)
    : Number.NaN;
  let staticFlags = sanitizeStaticBlockers(staticBlockerFlags);
  if (
    !integers.every(isU32)
    || !Number.isFinite(atomTolerance) || atomTolerance < 0
    || Object.is(atomTolerance, -0)
    || !Number.isFinite(chargeTolerance) || chargeTolerance < 0
    || Object.is(chargeTolerance, -0)
  ) staticFlags |= SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID;
  const index = SPH_REACTION_STRICT_GATE_PARAMS_INDEX;
  words[index.reactionCount] = u32OrZero(reactionCount);
  words[index.atomTermCount] = u32OrZero(atomTermCount);
  words[index.atomResidualCapacity] = u32OrZero(atomResidualCapacity);
  words[index.atomTermCapacity] = u32OrZero(atomTermCapacity);
  words[index.expectedSourceGeneration] = u32OrZero(expectedSourceGeneration);
  words[index.expectedCompletionGeneration] = u32OrZero(expectedCompletionGeneration);
  words[index.expectedSeal] = u32OrZero(expectedSeal);
  words[index.staticBlockerFlags] = staticFlags >>> 0;
  words[index.atomResidualToleranceMol] = sphReactionStrictGateF32ToBits(
    Number.isFinite(atomTolerance)
      && atomTolerance >= 0
      && !Object.is(atomTolerance, -0)
      ? atomTolerance
      : 0
  );
  words[index.chargeResidualToleranceMol] = sphReactionStrictGateF32ToBits(
    Number.isFinite(chargeTolerance)
      && chargeTolerance >= 0
      && !Object.is(chargeTolerance, -0)
      ? chargeTolerance
      : 0
  );
  words[index.atomResidualStrideVec4] = 2;
  words[index.atomTermStrideVec4] = 2;
  words[index.gateWordCount] = SPH_REACTION_STRICT_GATE_WORDS;
  words[index.expectedGateVersion] = SPH_REACTION_STRICT_GATE_VERSION;
  words[index.producerReceiptWordCount] =
    SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_WORDS;
  words[index.expectedProducerReceiptVersion] =
    SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION;
  return words;
}

export function createSphReactionStrictGateBlockedSentinel({
  sourceGeneration = 0,
  completionGeneration = 0,
  seal = 0,
  reactionCount = 0,
  atomTermCount = 0,
  atomResidualToleranceMol = 1e-6,
  chargeResidualToleranceMol = 1e-6,
  staticBlockerFlags = 0,
  blockerFlags = SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
} = {}) {
  const words = new Uint32Array(SPH_REACTION_STRICT_GATE_WORDS);
  const toleranceInputValid = typeof atomResidualToleranceMol === 'number'
    && Number.isFinite(Math.fround(atomResidualToleranceMol))
    && Math.fround(atomResidualToleranceMol) >= 0
    && !Object.is(Math.fround(atomResidualToleranceMol), -0)
    && typeof chargeResidualToleranceMol === 'number'
    && Number.isFinite(Math.fround(chargeResidualToleranceMol))
    && Math.fround(chargeResidualToleranceMol) >= 0
    && !Object.is(Math.fround(chargeResidualToleranceMol), -0);
  const staticFlags = (
    sanitizeStaticBlockers(staticBlockerFlags)
    | (toleranceInputValid
      ? 0
      : SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID)
  ) >>> 0;
  const suppliedBlockers = u32OrZero(blockerFlags) & BLOCKER_MASK;
  const blockers = (
    suppliedBlockers
    | staticFlags
    | (suppliedBlockers === 0 && staticFlags === 0
      ? SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
      : 0)
  ) >>> 0;
  words[SPH_REACTION_STRICT_GATE_INDEX.magic] = SPH_REACTION_STRICT_GATE_MAGIC;
  words[SPH_REACTION_STRICT_GATE_INDEX.version] = SPH_REACTION_STRICT_GATE_VERSION;
  words[SPH_REACTION_STRICT_GATE_INDEX.statusFlags] = (
    SPH_REACTION_STRICT_GATE_STATUS.INITIALIZED
    | SPH_REACTION_STRICT_GATE_STATUS.BLOCKED
    | SPH_REACTION_STRICT_GATE_STATUS.FAIL_CLOSED
  ) >>> 0;
  words[SPH_REACTION_STRICT_GATE_INDEX.blockerFlags] = blockers;
  words[SPH_REACTION_STRICT_GATE_INDEX.sourceGeneration] = u32OrZero(sourceGeneration);
  words[SPH_REACTION_STRICT_GATE_INDEX.completionGeneration] =
    u32OrZero(completionGeneration);
  words[SPH_REACTION_STRICT_GATE_INDEX.seal] = u32OrZero(seal);
  words[SPH_REACTION_STRICT_GATE_INDEX.reactionCount] = u32OrZero(reactionCount);
  words[SPH_REACTION_STRICT_GATE_INDEX.atomTermCount] = u32OrZero(atomTermCount);
  words[SPH_REACTION_STRICT_GATE_INDEX.maxAbsAtomResidualMol] =
    sphReactionStrictGateF32ToBits(0);
  words[SPH_REACTION_STRICT_GATE_INDEX.maxAbsChargeResidualMol] =
    sphReactionStrictGateF32ToBits(0);
  words[SPH_REACTION_STRICT_GATE_INDEX.atomResidualToleranceMol] =
    sphReactionStrictGateF32ToBits(
      finiteNonnegativeF32OrZero(atomResidualToleranceMol)
    );
  words[SPH_REACTION_STRICT_GATE_INDEX.chargeResidualToleranceMol] =
    sphReactionStrictGateF32ToBits(
      finiteNonnegativeF32OrZero(chargeResidualToleranceMol)
    );
  words[SPH_REACTION_STRICT_GATE_INDEX.staticBlockerFlags] = staticFlags;
  return words;
}

function exactGateWords(value) {
  return exactU32Words(
    value,
    SPH_REACTION_STRICT_GATE_WORDS,
    SPH_REACTION_STRICT_GATE_BYTES
  );
}

export function decodeSphReactionStrictGateControl(value) {
  const words = exactGateWords(value);
  if (!words) return null;
  const index = SPH_REACTION_STRICT_GATE_INDEX;
  return Object.freeze({
    schema: ULG_SPH_REACTION_STRICT_GATE_CONTROL_SCHEMA,
    magic: words[index.magic] >>> 0,
    version: words[index.version] >>> 0,
    statusFlags: words[index.statusFlags] >>> 0,
    blockerFlags: words[index.blockerFlags] >>> 0,
    sourceGeneration: words[index.sourceGeneration] >>> 0,
    completionGeneration: words[index.completionGeneration] >>> 0,
    seal: words[index.seal] >>> 0,
    reactionCount: words[index.reactionCount] >>> 0,
    atomTermCount: words[index.atomTermCount] >>> 0,
    readyRowCount: words[index.readyRowCount] >>> 0,
    problemRowCount: words[index.problemRowCount] >>> 0,
    maxAbsAtomResidualMol: sphReactionStrictGateBitsToF32(
      words[index.maxAbsAtomResidualMol]
    ),
    maxAbsChargeResidualMol: sphReactionStrictGateBitsToF32(
      words[index.maxAbsChargeResidualMol]
    ),
    atomResidualToleranceMol: sphReactionStrictGateBitsToF32(
      words[index.atomResidualToleranceMol]
    ),
    chargeResidualToleranceMol: sphReactionStrictGateBitsToF32(
      words[index.chargeResidualToleranceMol]
    ),
    staticBlockerFlags: words[index.staticBlockerFlags] >>> 0
  });
}

export function validateSphReactionStrictGateControl(value, {
  sourceGeneration = null,
  completionGeneration = null,
  seal = null,
  reactionCount = null,
  atomTermCount = null,
  atomResidualCapacity = null,
  atomTermCapacity = null,
  atomResidualStrideVec4 = null,
  atomTermStrideVec4 = null,
  atomResidualToleranceMol = null,
  chargeResidualToleranceMol = null,
  gateVersion = null,
  producerReceiptVersion = null,
  producerReceipt = null,
  requireExpectedAuthority = true
} = {}) {
  const decoded = decodeSphReactionStrictGateControl(value);
  const reasons = [];
  if (!decoded) {
    reasons.push('control-byte-length-mismatch');
  } else {
    const status = decoded.statusFlags;
    const blockers = decoded.blockerFlags;
    const isPass = (status & SPH_REACTION_STRICT_GATE_STATUS.PASS) !== 0;
    const isBlocked = (status & SPH_REACTION_STRICT_GATE_STATUS.BLOCKED) !== 0;
    const finalized = (status & SPH_REACTION_STRICT_GATE_STATUS.FINALIZED) !== 0;
    const evidenceComplete =
      (status & SPH_REACTION_STRICT_GATE_STATUS.EVIDENCE_COMPLETE) !== 0;
    if (decoded.magic !== SPH_REACTION_STRICT_GATE_MAGIC) reasons.push('magic-mismatch');
    if (decoded.version !== SPH_REACTION_STRICT_GATE_VERSION) reasons.push('version-mismatch');
    if ((status & ~STATUS_MASK) !== 0) reasons.push('unknown-status-flags');
    if ((blockers & ~BLOCKER_MASK) !== 0) reasons.push('unknown-blocker-flags');
    if (
      (decoded.staticBlockerFlags & ~SPH_REACTION_STRICT_GATE_STATIC_BLOCKER_MASK) !== 0
      || (decoded.staticBlockerFlags & blockers) !== decoded.staticBlockerFlags
    ) reasons.push('invalid-static-blocker-flags');
    if (isPass === isBlocked) reasons.push('terminal-status-not-exclusive');
    if ((status & SPH_REACTION_STRICT_GATE_STATUS.INITIALIZED) === 0) {
      reasons.push('control-not-initialized');
    }
    if (isPass && (
      !finalized
      || !evidenceComplete
      || blockers !== 0
      || (status & SPH_REACTION_STRICT_GATE_STATUS.FAIL_CLOSED) !== 0
    )) {
      reasons.push('pass-without-complete-unblocked-evidence');
    }
    if (isBlocked && blockers === 0) reasons.push('blocked-without-blocker');
    if (
      isBlocked
      && (status & SPH_REACTION_STRICT_GATE_STATUS.FAIL_CLOSED) === 0
    ) reasons.push('blocked-without-fail-closed-status');
    if (
      !Number.isFinite(decoded.atomResidualToleranceMol)
      || decoded.atomResidualToleranceMol < 0
      || Object.is(decoded.atomResidualToleranceMol, -0)
      || !Number.isFinite(decoded.chargeResidualToleranceMol)
      || decoded.chargeResidualToleranceMol < 0
      || Object.is(decoded.chargeResidualToleranceMol, -0)
    ) reasons.push('invalid-tolerance');
    if (isPass && (
      !Number.isFinite(decoded.maxAbsAtomResidualMol)
      || decoded.maxAbsAtomResidualMol < 0
      || !Number.isFinite(decoded.maxAbsChargeResidualMol)
      || decoded.maxAbsChargeResidualMol < 0
      || Math.abs(decoded.maxAbsAtomResidualMol) > decoded.atomResidualToleranceMol
      || decoded.maxAbsChargeResidualMol > decoded.chargeResidualToleranceMol
      || decoded.readyRowCount !== decoded.atomTermCount
      || decoded.problemRowCount !== 0
      || decoded.sourceGeneration === 0
      || decoded.completionGeneration === 0
      || decoded.seal === 0
      || decoded.reactionCount >= SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
      || decoded.atomTermCount >= SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
      || ((decoded.reactionCount === 0) !== (decoded.atomTermCount === 0))
    )) reasons.push('pass-evidence-invalid');
    for (const [name, expected] of Object.entries({
      sourceGeneration,
      completionGeneration,
      seal,
      reactionCount,
      atomTermCount
    })) {
      if (expected === null) {
        if (requireExpectedAuthority) reasons.push(`expected-${name}-required`);
      } else if (!isU32(expected) || decoded[name] !== expected) {
        reasons.push(`${name}-mismatch`);
      }
    }
    for (const [name, expected] of Object.entries({
      atomResidualToleranceMol,
      chargeResidualToleranceMol
    })) {
      if (expected === null) {
        if (requireExpectedAuthority) reasons.push(`expected-${name}-required`);
        continue;
      }
      const expectedF32 = typeof expected === 'number'
        ? Math.fround(expected)
        : Number.NaN;
      if (
        !Number.isFinite(expectedF32)
        || expectedF32 < 0
        || Object.is(expectedF32, -0)
        || !Object.is(decoded[name], expectedF32)
      ) reasons.push(`${name}-mismatch`);
    }
    if (gateVersion === null) {
      if (requireExpectedAuthority) reasons.push('expected-gateVersion-required');
    } else if (!isU32(gateVersion) || decoded.version !== gateVersion) {
      reasons.push('gateVersion-mismatch');
    }
    // A caller may explicitly provide a falsy non-null value. Treat every
    // provided value as an attempted receipt and validate it; truthiness must
    // never decide whether producer authority is checked.
    if (producerReceipt !== null || requireExpectedAuthority) {
      const producerValidation = validateSphReactionStrictGateProducerReceipt(
        producerReceipt,
        {
          sourceGeneration: decoded.sourceGeneration,
          completionGeneration: decoded.completionGeneration,
          seal: decoded.seal,
          reactionCount: decoded.reactionCount,
          atomTermCount: decoded.atomTermCount,
          atomResidualCapacity,
          atomTermCapacity,
          atomResidualStrideVec4,
          atomTermStrideVec4,
          version: producerReceiptVersion,
          requireExpectedAuthority
        }
      );
      for (const reason of producerValidation.reasons) {
        reasons.push(`producer-${reason}`);
      }
    }
  }
  const valid = reasons.length === 0;
  const authorityBound = producerReceipt !== null
    && sourceGeneration !== null
    && completionGeneration !== null
    && seal !== null
    && reactionCount !== null
    && atomTermCount !== null
    && atomResidualCapacity !== null
    && atomTermCapacity !== null
    && atomResidualStrideVec4 !== null
    && atomTermStrideVec4 !== null
    && atomResidualToleranceMol !== null
    && chargeResidualToleranceMol !== null
    && gateVersion !== null
    && producerReceiptVersion !== null;
  const pass = valid
    && authorityBound
    && (decoded.statusFlags & SPH_REACTION_STRICT_GATE_STATUS.PASS) !== 0
    && decoded.blockerFlags === 0;
  return Object.freeze({
    schema: ULG_SPH_REACTION_STRICT_GATE_CONTROL_SCHEMA,
    valid,
    authorityBound,
    pass,
    blocked: !pass,
    reasons: Object.freeze(reasons),
    control: decoded
  });
}

export function finalizeSphReactionStrictGateCpu({
  atomResidualValues = null,
  atomTermValues = null,
  producerShadowWords = null,
  producerReceipt = null,
  atomResidualCapacity = null,
  atomTermCapacity = null,
  reactionCount = 0,
  atomTermCount = 0,
  expectedSourceGeneration = 0,
  expectedCompletionGeneration = 0,
  expectedSeal = 0,
  staticBlockerFlags = 0,
  atomResidualToleranceMol = 1e-6,
  chargeResidualToleranceMol = 1e-6
} = {}) {
  let blockers = sanitizeStaticBlockers(staticBlockerFlags);
  let structuralFailure = false;
  let layoutValid = true;
  const countValid = isU32(reactionCount)
    && isU32(atomTermCount)
    && reactionCount < SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
    && atomTermCount < SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE;
  const reactionTotal = countValid ? u32OrZero(reactionCount) : 0;
  const termTotal = countValid ? u32OrZero(atomTermCount) : 0;
  if (!countValid) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH;
    structuralFailure = true;
    layoutValid = false;
  }
  const atomTolerance = typeof atomResidualToleranceMol === 'number'
    ? Math.fround(atomResidualToleranceMol)
    : Number.NaN;
  const chargeTolerance = typeof chargeResidualToleranceMol === 'number'
    ? Math.fround(chargeResidualToleranceMol)
    : Number.NaN;
  if (
    !Number.isFinite(atomTolerance) || atomTolerance < 0
    || Object.is(atomTolerance, -0)
    || !Number.isFinite(chargeTolerance) || chargeTolerance < 0
    || Object.is(chargeTolerance, -0)
  ) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID;
    structuralFailure = true;
  }
  const expectedLineageValid = isU32(expectedSourceGeneration)
    && expectedSourceGeneration !== 0
    && isU32(expectedCompletionGeneration)
    && expectedCompletionGeneration !== 0;
  if (!expectedLineageValid) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
      | SPH_REACTION_STRICT_GATE_BLOCKER.GENERATION_MISMATCH;
    structuralFailure = true;
  }
  if (!isU32(expectedSeal) || expectedSeal === 0) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
      | SPH_REACTION_STRICT_GATE_BLOCKER.SEAL_MISMATCH;
    structuralFailure = true;
  }

  const alignedResidualValues = atomResidualValues instanceof Float32Array
    && atomResidualValues.length % ATOM_RESIDUAL_ROW_FLOATS === 0;
  const availableResidualRows = alignedResidualValues
    ? atomResidualValues.length / ATOM_RESIDUAL_ROW_FLOATS
    : 0;
  const alignedAtomTermValues = atomTermValues instanceof Float32Array
    && atomTermValues.length % ATOM_TERM_ROW_FLOATS === 0;
  const availableAtomTermRows = alignedAtomTermValues
    ? atomTermValues.length / ATOM_TERM_ROW_FLOATS
    : 0;
  const declaredResidualCapacity = atomResidualCapacity === null
    ? availableResidualRows
    : u32OrZero(atomResidualCapacity);
  const declaredAtomTermCapacity = atomTermCapacity === null
    ? availableAtomTermRows
    : u32OrZero(atomTermCapacity);
  const capacitiesValid = isU32(declaredResidualCapacity)
    && isU32(declaredAtomTermCapacity)
    && declaredResidualCapacity < SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
    && declaredAtomTermCapacity < SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE;
  if (
    !alignedResidualValues
    || !alignedAtomTermValues
    || !capacitiesValid
    || (atomResidualCapacity !== null && !isU32(atomResidualCapacity))
    || (atomTermCapacity !== null && !isU32(atomTermCapacity))
    || declaredResidualCapacity !== availableResidualRows
    || declaredAtomTermCapacity !== availableAtomTermRows
  ) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
      | SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH;
    structuralFailure = true;
    layoutValid = false;
  }
  const shadowPlaneWordCount = termTotal
    * SPH_REACTION_STRICT_GATE_SHADOW_ROW_WORDS;
  const shadowLogicalWordCount = shadowPlaneWordCount
    * SPH_REACTION_STRICT_GATE_SHADOW_PLANE_COUNT;
  const shadowLayoutValid = producerShadowWords instanceof Uint32Array
    && producerShadowWords.length === Math.max(1, shadowLogicalWordCount)
    && (shadowLogicalWordCount !== 0 || producerShadowWords[0] === 0);
  if (!shadowLayoutValid) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
      | SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH;
    structuralFailure = true;
    layoutValid = false;
  }
  if (
    availableResidualRows < termTotal
    || availableAtomTermRows < termTotal
    || declaredResidualCapacity < termTotal
    || declaredAtomTermCapacity < termTotal
  ) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
      | SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH;
    structuralFailure = true;
    layoutValid = false;
  }
  // An empty reaction table is vacuously balanced and may publish PASS when
  // provenance is otherwise valid. A non-empty table must provide at least
  // one atom-ledger row for every reaction; static metadata alone is not
  // runtime residual evidence.
  if (reactionTotal > 0 && termTotal === 0) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
      | SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH;
    structuralFailure = true;
    layoutValid = false;
  }
  if (reactionTotal === 0 && termTotal > 0) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH;
    structuralFailure = true;
    layoutValid = false;
  }

  const receipt = decodeSphReactionStrictGateProducerReceipt(producerReceipt);
  const receiptValidation = validateSphReactionStrictGateProducerReceipt(
    producerReceipt,
    {
      sourceGeneration: u32OrZero(expectedSourceGeneration),
      completionGeneration: u32OrZero(expectedCompletionGeneration),
      seal: u32OrZero(expectedSeal),
      reactionCount: reactionTotal,
      atomTermCount: termTotal,
      atomResidualCapacity: declaredResidualCapacity,
      atomTermCapacity: declaredAtomTermCapacity,
      atomResidualStrideVec4: 2,
      atomTermStrideVec4: 2,
      version: SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION
    }
  );
  const receiptLayoutValid = Boolean(
    receipt
    && receipt.magic === SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_MAGIC
    && receipt.version === SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION
    && receipt.statusFlags
      === SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_STATUS.READY
    && receipt.blockerFlags === 0
    && receipt.reactionCount === reactionTotal
    && receipt.atomTermCount === termTotal
    && receipt.atomResidualCapacity === declaredResidualCapacity
    && receipt.atomTermCapacity === declaredAtomTermCapacity
    && receipt.atomResidualStrideVec4 === 2
    && receipt.atomTermStrideVec4 === 2
    && receipt.producerSequence !== 0
    && receipt.shadowPlaneWordCount === shadowPlaneWordCount
    && receipt.shadowLogicalWordCount === shadowLogicalWordCount
  );
  if (
    !receipt
    || receipt.sourceGeneration !== u32OrZero(expectedSourceGeneration)
    || receipt.completionGeneration !== u32OrZero(expectedCompletionGeneration)
  ) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
      | SPH_REACTION_STRICT_GATE_BLOCKER.GENERATION_MISMATCH;
    structuralFailure = true;
  }
  if (!receipt || receipt.seal !== u32OrZero(expectedSeal)) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
      | SPH_REACTION_STRICT_GATE_BLOCKER.SEAL_MISMATCH;
    structuralFailure = true;
  }
  // Keep this predicate structurally identical to the shader's receipt
  // envelope branch. Lineage generation/seal drift is classified above and
  // deliberately does not suppress row inspection, while a malformed receipt
  // envelope always carries MISSING|LAYOUT and suppresses inspection.
  if (!receiptLayoutValid) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
      | SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH;
    structuralFailure = true;
    layoutValid = false;
  }
  if (!receiptValidation.pass) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE;
    structuralFailure = true;
  }

  const rowsToInspect = Math.min(
    layoutValid ? termTotal : 0,
    termTotal
  );
  const residualBitsByReactionAndZ = new Map();
  const chargeResidualBitsByReaction = new Map();
  const seenReactions = new Set();
  let previousReactionIndex = -1;
  let readyRowCount = 0;
  let problemRowCount = 0;
  for (let rowIndex = 0; rowIndex < rowsToInspect; rowIndex += 1) {
    const offset = rowIndex * ATOM_RESIDUAL_ROW_FLOATS;
    const residualShadowMatches = shadowLayoutValid
      && sphReactionStrictGateF32WordsMatchShadow(
        atomResidualValues.subarray(
          offset,
          offset + SPH_REACTION_STRICT_GATE_SHADOW_ROW_WORDS
        ),
        producerShadowWords,
        offset,
        SPH_REACTION_STRICT_GATE_SHADOW_ROW_WORDS
      ) === true;
    const atomTermShadowMatches = shadowLayoutValid
      && sphReactionStrictGateF32WordsMatchShadow(
        atomTermValues.subarray(
          offset,
          offset + SPH_REACTION_STRICT_GATE_SHADOW_ROW_WORDS
        ),
        producerShadowWords,
        shadowPlaneWordCount + offset,
        SPH_REACTION_STRICT_GATE_SHADOW_ROW_WORDS
      ) === true;
    if (!residualShadowMatches || !atomTermShadowMatches) {
      problemRowCount += 1;
      blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
        | SPH_REACTION_STRICT_GATE_BLOCKER.BITWISE_SHADOW_MISMATCH;
      structuralFailure = true;
      continue;
    }
    const row = atomResidualValues.subarray(offset, offset + ATOM_RESIDUAL_ROW_FLOATS);
    const authority = atomTermValues.subarray(offset, offset + ATOM_TERM_ROW_FLOATS);
    const rowWords = new Uint32Array(
      row.buffer,
      row.byteOffset,
      ATOM_RESIDUAL_ROW_FLOATS
    );
    const authorityWords = new Uint32Array(
      authority.buffer,
      authority.byteOffset,
      ATOM_TERM_ROW_FLOATS
    );
    const identityBitsMatch = rowWords[0] === authorityWords[0]
      && rowWords[1] === authorityWords[3]
      && rowWords[5] === authorityWords[1]
      && rowWords[6] === authorityWords[2]
      && rowWords[7] === authorityWords[7];
    const finite = Array.from(row).every(Number.isFinite);
    const authorityFinite = Array.from(authority).every(Number.isFinite);
    if (!finite || !authorityFinite) {
      blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.NONFINITE_EVIDENCE;
    }
    const reactionIndex = row[0];
    const atomicNumber = row[1];
    const eventCount = row[4];
    const termKind = row[5];
    const termIndex = row[6];
    const status = row[7];
    const authorityReactionIndex = authority[0];
    const authorityTermKind = authority[1];
    const authorityTermIndex = authority[2];
    const authorityAtomicNumber = authority[3];
    const authorityAtomsPerFormula = authority[4];
    const authorityCoefficient = authority[5];
    const authorityStatus = authority[7];
    const rowValid = finite
      && Number.isInteger(reactionIndex)
      && !Object.is(reactionIndex, -0)
      && reactionIndex >= 0
      && reactionIndex < SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
      && reactionIndex < reactionTotal
      && Number.isInteger(atomicNumber)
      && atomicNumber >= 1
      && atomicNumber <= SPH_REACTION_STRICT_GATE_MAX_ATOMIC_NUMBER
      && Number.isInteger(eventCount)
      && !Object.is(eventCount, -0)
      && eventCount >= 0
      && eventCount <= SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
      && (termKind === 1 || termKind === 2)
      && Number.isInteger(termIndex)
      && !Object.is(termIndex, -0)
      && termIndex >= 0
      && termIndex < SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
      && status === 1
      && authorityFinite
      && Number.isInteger(authorityReactionIndex)
      && !Object.is(authorityReactionIndex, -0)
      && authorityReactionIndex >= 0
      && authorityReactionIndex < SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
      && authorityReactionIndex < reactionTotal
      && (authorityTermKind === 1 || authorityTermKind === 2)
      && Number.isInteger(authorityTermIndex)
      && !Object.is(authorityTermIndex, -0)
      && authorityTermIndex >= 0
      && authorityTermIndex < SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
      && Number.isInteger(authorityAtomicNumber)
      && authorityAtomicNumber >= 1
      && authorityAtomicNumber <= SPH_REACTION_STRICT_GATE_MAX_ATOMIC_NUMBER
      && authorityAtomsPerFormula > 0
      && authorityCoefficient > 0
      && authorityStatus === 1
      && identityBitsMatch
      && reactionIndex === authorityReactionIndex
      && atomicNumber === authorityAtomicNumber
      && termKind === authorityTermKind
      && termIndex === authorityTermIndex
      && status === authorityStatus;
    if (!rowValid) {
      problemRowCount += 1;
      blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.PROBLEM_ROW;
      continue;
    }
    // The existing atom-term ABI is emitted in reaction-major order. The GPU
    // finalizer uses that property to aggregate with fixed private storage in
    // O(atom terms + reactions * atomic-number domain), so reject drift rather
    // than silently reopening cross-reaction cancellation.
    if (reactionIndex < previousReactionIndex) {
      problemRowCount += 1;
      blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.PROBLEM_ROW
        | SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH;
      structuralFailure = true;
      continue;
    }
    previousReactionIndex = reactionIndex;
    readyRowCount += 1;
    seenReactions.add(reactionIndex);
    let residualBitsByZ = residualBitsByReactionAndZ.get(reactionIndex);
    if (!residualBitsByZ) {
      residualBitsByZ = new Map();
      residualBitsByReactionAndZ.set(reactionIndex, residualBitsByZ);
    }
    const atomSum = addRteF32Bits(
      residualBitsByZ.get(atomicNumber) ?? 0,
      rowWords[2]
    );
    residualBitsByZ.set(atomicNumber, atomSum.bits);
    const chargeSum = addRteF32Bits(
      chargeResidualBitsByReaction.get(reactionIndex) ?? 0,
      rowWords[3]
    );
    chargeResidualBitsByReaction.set(reactionIndex, chargeSum.bits);
    if (!atomSum.finite || !chargeSum.finite) {
      blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.NONFINITE_EVIDENCE;
    }
  }
  if (rowsToInspect < termTotal) {
    problemRowCount += termTotal - rowsToInspect;
  }
  if (seenReactions.size !== reactionTotal) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE;
  }
  let maxAbsAtomResidualMol = Math.fround(0);
  let maxAbsChargeResidualMol = Math.fround(0);
  const atomResidualMolByReactionAndZ = {};
  const chargeResidualMolByReaction = {};
  for (const reactionIndex of seenReactions) {
    const residualBitsByZ = residualBitsByReactionAndZ.get(reactionIndex);
    if (residualBitsByZ) {
      const diagnosticByZ = {};
      for (
        let atomicNumber = 1;
        atomicNumber <= SPH_REACTION_STRICT_GATE_MAX_ATOMIC_NUMBER;
        atomicNumber += 1
      ) {
        if (!residualBitsByZ.has(atomicNumber)) continue;
        const residual = sphReactionStrictGateBitsToF32(
          residualBitsByZ.get(atomicNumber)
        );
        diagnosticByZ[atomicNumber] = residual;
        if (!Number.isFinite(residual)) {
          blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.NONFINITE_EVIDENCE;
        } else {
          maxAbsAtomResidualMol = Math.fround(
            Math.max(maxAbsAtomResidualMol, Math.abs(residual))
          );
        }
      }
      atomResidualMolByReactionAndZ[reactionIndex] = Object.freeze(diagnosticByZ);
    }
    if (chargeResidualBitsByReaction.has(reactionIndex)) {
      const chargeResidual = sphReactionStrictGateBitsToF32(
        chargeResidualBitsByReaction.get(reactionIndex)
      );
      chargeResidualMolByReaction[reactionIndex] = chargeResidual;
      if (!Number.isFinite(chargeResidual)) {
        blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.NONFINITE_EVIDENCE;
      } else {
        maxAbsChargeResidualMol = Math.fround(
          Math.max(maxAbsChargeResidualMol, Math.abs(chargeResidual))
        );
      }
    }
  }
  const usableAtomTolerance = Number.isFinite(atomTolerance)
    && atomTolerance >= 0
    && !Object.is(atomTolerance, -0)
    ? atomTolerance
    : 0;
  const usableChargeTolerance = Number.isFinite(chargeTolerance)
    && chargeTolerance >= 0
    && !Object.is(chargeTolerance, -0)
    ? chargeTolerance
    : 0;
  if (maxAbsAtomResidualMol > usableAtomTolerance) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.ATOM_RESIDUAL_OUT_OF_TOLERANCE;
  }
  if (maxAbsChargeResidualMol > usableChargeTolerance) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.CHARGE_RESIDUAL_OUT_OF_TOLERANCE;
  }

  const controlWords = createSphReactionStrictGateBlockedSentinel({
    sourceGeneration: receipt?.sourceGeneration ?? 0,
    completionGeneration: receipt?.completionGeneration ?? 0,
    seal: receipt?.seal ?? 0,
    reactionCount: reactionTotal,
    atomTermCount: termTotal,
    atomResidualToleranceMol: usableAtomTolerance,
    chargeResidualToleranceMol: usableChargeTolerance,
    staticBlockerFlags: blockers & SPH_REACTION_STRICT_GATE_STATIC_BLOCKER_MASK,
    blockerFlags: blockers
  });
  const index = SPH_REACTION_STRICT_GATE_INDEX;
  controlWords[index.readyRowCount] = readyRowCount >>> 0;
  controlWords[index.problemRowCount] = problemRowCount >>> 0;
  controlWords[index.maxAbsAtomResidualMol] =
    sphReactionStrictGateF32ToBits(maxAbsAtomResidualMol);
  controlWords[index.maxAbsChargeResidualMol] =
    sphReactionStrictGateF32ToBits(maxAbsChargeResidualMol);
  controlWords[index.blockerFlags] = blockers >>> 0;
  let status = (
    SPH_REACTION_STRICT_GATE_STATUS.INITIALIZED
    | SPH_REACTION_STRICT_GATE_STATUS.FINALIZED
  ) >>> 0;
  if ((blockers & SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE) === 0) {
    status |= SPH_REACTION_STRICT_GATE_STATUS.EVIDENCE_COMPLETE;
  }
  if (blockers === 0) {
    status |= SPH_REACTION_STRICT_GATE_STATUS.PASS;
  } else {
    status |= SPH_REACTION_STRICT_GATE_STATUS.BLOCKED
      | SPH_REACTION_STRICT_GATE_STATUS.FAIL_CLOSED;
  }
  controlWords[index.statusFlags] = status >>> 0;
  const validation = validateSphReactionStrictGateControl(controlWords, {
    sourceGeneration: u32OrZero(expectedSourceGeneration),
    completionGeneration: u32OrZero(expectedCompletionGeneration),
    seal: u32OrZero(expectedSeal),
    reactionCount: reactionTotal,
    atomTermCount: termTotal,
    atomResidualCapacity: declaredResidualCapacity,
    atomTermCapacity: declaredAtomTermCapacity,
    atomResidualStrideVec4: 2,
    atomTermStrideVec4: 2,
    atomResidualToleranceMol: usableAtomTolerance,
    chargeResidualToleranceMol: usableChargeTolerance,
    gateVersion: SPH_REACTION_STRICT_GATE_VERSION,
    producerReceiptVersion: SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION,
    producerReceipt
  });
  return Object.freeze({
    schema: ULG_SPH_REACTION_STRICT_GATE_CONTROL_SCHEMA,
    status: validation.pass
      ? 'sph-reaction-strict-gate-pass'
      : 'sph-reaction-strict-gate-blocked',
    pass: validation.pass,
    blockerFlags: blockers >>> 0,
    statusFlags: status >>> 0,
    readyRowCount,
    problemRowCount,
    maxAbsAtomResidualMol,
    maxAbsChargeResidualMol,
    atomResidualMolByReactionAndZ: Object.freeze(atomResidualMolByReactionAndZ),
    chargeResidualMolByReaction: Object.freeze(chargeResidualMolByReaction),
    producerShadowWords,
    producerReceipt,
    producerReceiptValidation: receiptValidation,
    structuralFailure,
    controlWords,
    validation
  });
}
