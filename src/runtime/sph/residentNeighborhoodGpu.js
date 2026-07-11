import {
  RESIDENT_NEIGHBORHOOD_ALL_CONSUMER_MASK,
  RESIDENT_NEIGHBORHOOD_CANDIDATE_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_CELL_KEY_IDENTITY_WORDS,
  RESIDENT_NEIGHBORHOOD_CELL_KEY_STRUCTURAL_WORDS,
  RESIDENT_NEIGHBORHOOD_CELL_KEY_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_CONSUMER,
  RESIDENT_NEIGHBORHOOD_CSR_OFFSET_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_EVIDENCE_VERSION,
  RESIDENT_NEIGHBORHOOD_SOURCE_SPAN_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_STATUS_FLAG,
  RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG,
  ULG_RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_SCHEMA,
  ULG_RESIDENT_NEIGHBORHOOD_DESCRIPTOR_SCHEMA
} from '../../../ulg-gpu-abi/src/residentNeighborhood.js';

export {
  RESIDENT_NEIGHBORHOOD_ALL_CONSUMER_MASK,
  RESIDENT_NEIGHBORHOOD_CANDIDATE_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_CELL_KEY_IDENTITY_WORDS,
  RESIDENT_NEIGHBORHOOD_CELL_KEY_STRUCTURAL_WORDS,
  RESIDENT_NEIGHBORHOOD_CELL_KEY_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_CONSUMER,
  RESIDENT_NEIGHBORHOOD_CSR_OFFSET_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_EVIDENCE_VERSION,
  RESIDENT_NEIGHBORHOOD_SOURCE_SPAN_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_STATUS_FLAG,
  RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG,
  ULG_RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_SCHEMA,
  ULG_RESIDENT_NEIGHBORHOOD_DESCRIPTOR_SCHEMA
};

const UINT32_MAX = 0xffff_ffff;
const INT32_MIN = -0x8000_0000;
const INT32_MAX = 0x7fff_ffff;
const SIGN_ORDER_BIAS = 0x8000_0000;
const U32_BYTES = Uint32Array.BYTES_PER_ELEMENT;

export const RESIDENT_NEIGHBORHOOD_CELL_KEY_STRIDE_U32 =
  RESIDENT_NEIGHBORHOOD_CELL_KEY_U32_LAYOUT.length;
export const RESIDENT_NEIGHBORHOOD_CELL_KEY_STRIDE_BYTES =
  RESIDENT_NEIGHBORHOOD_CELL_KEY_STRIDE_U32 * U32_BYTES;
export const RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_STRIDE_U32 =
  RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_U32_LAYOUT.length;
export const RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_STRIDE_BYTES =
  RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_STRIDE_U32 * U32_BYTES;
export const RESIDENT_NEIGHBORHOOD_CANDIDATE_STRIDE_U32 =
  RESIDENT_NEIGHBORHOOD_CANDIDATE_U32_LAYOUT.length;
export const RESIDENT_NEIGHBORHOOD_CANDIDATE_STRIDE_BYTES =
  RESIDENT_NEIGHBORHOOD_CANDIDATE_STRIDE_U32 * U32_BYTES;
export const RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_STRIDE_U32 =
  RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_U32_LAYOUT.length;
export const RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_STRIDE_BYTES =
  RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_STRIDE_U32 * U32_BYTES;

function requireUint32(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > UINT32_MAX) {
    throw new RangeError(`${name} must be a uint32`);
  }
  return number >>> 0;
}

function requireInt32(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < INT32_MIN || number > INT32_MAX) {
    throw new RangeError(`${name} must be an int32`);
  }
  return number | 0;
}

function requireSafeUint(value, name) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
  return number;
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function checkedAdd(left, right, name) {
  const sum = left + right;
  if (!Number.isSafeInteger(sum)) {
    throw new RangeError(`${name} exceeds Number.MAX_SAFE_INTEGER`);
  }
  return sum;
}

function checkedMultiply(left, right, name) {
  const product = left * right;
  if (!Number.isSafeInteger(product)) {
    throw new RangeError(`${name} exceeds Number.MAX_SAFE_INTEGER`);
  }
  return product;
}

function resolveCapacity(value, fallback, name) {
  return value === undefined ? fallback : requireUint32(value, name);
}

function countOverflow(required, capacity) {
  return required > capacity ? required - capacity : 0;
}

function layoutDescriptor(rowLayout) {
  return {
    rowLayout: [...rowLayout],
    strideU32: rowLayout.length,
    strideBytes: rowLayout.length * U32_BYTES
  };
}

/**
 * Encode signed level/cell coordinates as order-preserving u32 words. The
 * sign-bit bias permits direct unsigned radix sorting on GPU.
 */
export function encodeResidentNeighborhoodSignedOrderKey(value) {
  return (requireInt32(value, 'signed coordinate') ^ SIGN_ORDER_BIAS) >>> 0;
}

export function decodeResidentNeighborhoodSignedOrderKey(value) {
  return (requireUint32(value, 'signed order key') ^ SIGN_ORDER_BIAS) | 0;
}

export function createResidentNeighborhoodCellKey({
  chartId = 0,
  level = 0,
  cell = null,
  cellX = 0,
  cellY = 0,
  cellZ = 0,
  generation = 0,
  keyFlags = 0
} = {}) {
  if (cell !== null) {
    if (!Array.isArray(cell) && !ArrayBuffer.isView(cell)) {
      throw new TypeError('cell must be an array-like [x, y, z] value');
    }
    if (cell.length < 3) {
      throw new RangeError('cell must contain x, y, and z coordinates');
    }
    [cellX, cellY, cellZ] = cell;
  }
  return new Uint32Array([
    requireUint32(chartId, 'chartId'),
    encodeResidentNeighborhoodSignedOrderKey(level),
    encodeResidentNeighborhoodSignedOrderKey(cellX),
    encodeResidentNeighborhoodSignedOrderKey(cellY),
    encodeResidentNeighborhoodSignedOrderKey(cellZ),
    requireUint32(generation, 'generation'),
    requireUint32(keyFlags, 'keyFlags'),
    0
  ]);
}

export function decodeResidentNeighborhoodCellKey(key) {
  requireCellKey(key, 'key');
  return {
    chartId: key[0] >>> 0,
    level: decodeResidentNeighborhoodSignedOrderKey(key[1]),
    cell: [
      decodeResidentNeighborhoodSignedOrderKey(key[2]),
      decodeResidentNeighborhoodSignedOrderKey(key[3]),
      decodeResidentNeighborhoodSignedOrderKey(key[4])
    ],
    generation: key[5] >>> 0,
    keyFlags: key[6] >>> 0
  };
}

function requireCellKey(key, name) {
  if ((!Array.isArray(key) && !ArrayBuffer.isView(key))
    || key.length < RESIDENT_NEIGHBORHOOD_CELL_KEY_STRIDE_U32) {
    throw new TypeError(`${name} must contain a resident-neighborhood cell-key row`);
  }
  return key;
}

function compareCellKeyWords(left, right, wordCount) {
  requireCellKey(left, 'left key');
  requireCellKey(right, 'right key');
  for (let index = 0; index < wordCount; index += 1) {
    const leftWord = requireUint32(left[index], `left key word ${index}`);
    const rightWord = requireUint32(right[index], `right key word ${index}`);
    if (leftWord < rightWord) return -1;
    if (leftWord > rightWord) return 1;
  }
  return 0;
}

export function compareResidentNeighborhoodStructuralCellKeys(left, right) {
  return compareCellKeyWords(left, right, RESIDENT_NEIGHBORHOOD_CELL_KEY_STRUCTURAL_WORDS);
}

export function compareResidentNeighborhoodCellKeys(left, right) {
  return compareCellKeyWords(left, right, RESIDENT_NEIGHBORHOOD_CELL_KEY_IDENTITY_WORDS);
}

export function residentNeighborhoodCellKeyEquals(left, right) {
  return compareResidentNeighborhoodCellKeys(left, right) === 0;
}

export function normalizeResidentNeighborhoodSupportClasses(
  supportClasses,
  { generation = 0 } = {}
) {
  if (!Array.isArray(supportClasses)) {
    throw new TypeError('supportClasses must be an array');
  }
  const normalizedGeneration = requireUint32(generation, 'generation');
  const normalized = supportClasses.map((supportClass, index) => {
    if (!supportClass || typeof supportClass !== 'object') {
      throw new TypeError(`supportClasses[${index}] must be an object`);
    }
    const supportClassId = requireUint32(
      supportClass.supportClassId ?? supportClass.classId,
      `supportClasses[${index}].supportClassId`
    );
    const consumerMask = requireUint32(
      supportClass.consumerMask,
      `supportClasses[${index}].consumerMask`
    );
    if (consumerMask === 0) {
      throw new RangeError(`supportClasses[${index}].consumerMask must be non-zero`);
    }
    const minLevelDelta = requireInt32(
      supportClass.minLevelDelta ?? 0,
      `supportClasses[${index}].minLevelDelta`
    );
    const maxLevelDelta = requireInt32(
      supportClass.maxLevelDelta ?? 0,
      `supportClasses[${index}].maxLevelDelta`
    );
    if (minLevelDelta > maxLevelDelta) {
      throw new RangeError(`supportClasses[${index}] has minLevelDelta above maxLevelDelta`);
    }
    const entry = {
      supportClassId,
      consumerMask,
      minLevelDelta,
      maxLevelDelta,
      cellRadius: requireUint32(
        supportClass.cellRadius ?? 0,
        `supportClasses[${index}].cellRadius`
      ),
      maxCandidatesPerSource: requireUint32(
        supportClass.maxCandidatesPerSource ?? 0,
        `supportClasses[${index}].maxCandidatesPerSource`
      ),
      generation: normalizedGeneration,
      flags: requireUint32(supportClass.flags ?? 0, `supportClasses[${index}].flags`)
    };
    if (typeof supportClass.name === 'string' && supportClass.name.length > 0) {
      entry.name = supportClass.name;
    }
    return Object.freeze(entry);
  });
  normalized.sort((left, right) => left.supportClassId - right.supportClassId);
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index - 1].supportClassId === normalized[index].supportClassId) {
      throw new RangeError(`duplicate supportClassId ${normalized[index].supportClassId}`);
    }
  }
  return Object.freeze(normalized);
}

export function packResidentNeighborhoodSupportClassesU32(supportClasses, options = {}) {
  const normalized = normalizeResidentNeighborhoodSupportClasses(supportClasses, options);
  const rows = new Uint32Array(normalized.length * RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_STRIDE_U32);
  normalized.forEach((supportClass, index) => {
    const offset = index * RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_STRIDE_U32;
    rows[offset] = supportClass.supportClassId;
    rows[offset + 1] = supportClass.consumerMask;
    rows[offset + 2] = encodeResidentNeighborhoodSignedOrderKey(supportClass.minLevelDelta);
    rows[offset + 3] = encodeResidentNeighborhoodSignedOrderKey(supportClass.maxLevelDelta);
    rows[offset + 4] = supportClass.cellRadius;
    rows[offset + 5] = supportClass.maxCandidatesPerSource;
    rows[offset + 6] = supportClass.generation;
    rows[offset + 7] = supportClass.flags;
  });
  return rows;
}

export function splitResidentNeighborhoodUint64(value) {
  const normalized = BigInt(requireSafeUint(value, 'uint64 evidence value'));
  return {
    low: Number(normalized & 0xffff_ffffn) >>> 0,
    high: Number((normalized >> 32n) & 0xffff_ffffn) >>> 0
  };
}

export function computeResidentNeighborhoodStorageBytes({
  uniqueCellCount = 0,
  cellOffsetCount = 0,
  cellMemberCount = 0,
  sourceOffsetCount = 0,
  candidateCount = 0,
  supportClassCount = 0
} = {}) {
  const rows = [
    checkedMultiply(
      requireUint32(uniqueCellCount, 'uniqueCellCount'),
      RESIDENT_NEIGHBORHOOD_CELL_KEY_STRIDE_BYTES,
      'cell-key bytes'
    ),
    checkedMultiply(requireUint32(cellOffsetCount, 'cellOffsetCount'), U32_BYTES, 'cell-offset bytes'),
    checkedMultiply(requireUint32(cellMemberCount, 'cellMemberCount'), U32_BYTES, 'cell-member bytes'),
    checkedMultiply(requireUint32(sourceOffsetCount, 'sourceOffsetCount'), U32_BYTES, 'source-offset bytes'),
    checkedMultiply(
      requireUint32(candidateCount, 'candidateCount'),
      RESIDENT_NEIGHBORHOOD_CANDIDATE_STRIDE_BYTES,
      'candidate bytes'
    ),
    checkedMultiply(
      requireUint32(supportClassCount, 'supportClassCount'),
      RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_STRIDE_BYTES,
      'support-class bytes'
    ),
    RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_STRIDE_BYTES
  ];
  return rows.reduce((total, value) => checkedAdd(total, value, 'resident-neighborhood bytes'), 0);
}

export function createResidentNeighborhoodCapacityPlan({
  generation = 0,
  leaseTokenLow = 0,
  leaseTokenHigh = 0,
  sourceCount = 0,
  requiredUniqueCellCount = 0,
  requiredCellMemberCount = sourceCount,
  requiredCandidateCount = 0,
  supportClassCount = 0,
  consumerMask = 0,
  capacities = {}
} = {}) {
  const normalizedGeneration = requireUint32(generation, 'generation');
  const normalizedSourceCount = requireUint32(sourceCount, 'sourceCount');
  const required = {
    uniqueCellCount: requireUint32(requiredUniqueCellCount, 'requiredUniqueCellCount'),
    cellOffsetCount: checkedAdd(
      requireUint32(requiredUniqueCellCount, 'requiredUniqueCellCount'),
      1,
      'requiredCellOffsetCount'
    ),
    cellMemberCount: requireUint32(requiredCellMemberCount, 'requiredCellMemberCount'),
    sourceOffsetCount: checkedAdd(normalizedSourceCount, 1, 'requiredSourceOffsetCount'),
    candidateCount: requireUint32(requiredCandidateCount, 'requiredCandidateCount')
  };
  if (required.cellOffsetCount > UINT32_MAX || required.sourceOffsetCount > UINT32_MAX) {
    throw new RangeError('CSR sentinel offset counts must fit in uint32');
  }
  const capacity = {
    uniqueCellCount: resolveCapacity(
      capacities.uniqueCellCount,
      required.uniqueCellCount,
      'capacities.uniqueCellCount'
    ),
    cellOffsetCount: resolveCapacity(
      capacities.cellOffsetCount,
      required.cellOffsetCount,
      'capacities.cellOffsetCount'
    ),
    cellMemberCount: resolveCapacity(
      capacities.cellMemberCount,
      required.cellMemberCount,
      'capacities.cellMemberCount'
    ),
    sourceOffsetCount: resolveCapacity(
      capacities.sourceOffsetCount,
      required.sourceOffsetCount,
      'capacities.sourceOffsetCount'
    ),
    candidateCount: resolveCapacity(
      capacities.candidateCount,
      required.candidateCount,
      'capacities.candidateCount'
    )
  };
  const normalizedSupportClassCount = requireUint32(supportClassCount, 'supportClassCount');
  const requiredBytes = computeResidentNeighborhoodStorageBytes({
    ...required,
    supportClassCount: normalizedSupportClassCount
  });
  const allocatedCountBytes = computeResidentNeighborhoodStorageBytes({
    ...capacity,
    supportClassCount: normalizedSupportClassCount
  });
  capacity.bytes = capacities.bytes === undefined
    ? allocatedCountBytes
    : requireSafeUint(capacities.bytes, 'capacities.bytes');

  const overflow = {
    uniqueCellCount: countOverflow(required.uniqueCellCount, capacity.uniqueCellCount),
    cellOffsetCount: countOverflow(required.cellOffsetCount, capacity.cellOffsetCount),
    cellMemberCount: countOverflow(required.cellMemberCount, capacity.cellMemberCount),
    sourceOffsetCount: countOverflow(required.sourceOffsetCount, capacity.sourceOffsetCount),
    candidateCount: countOverflow(required.candidateCount, capacity.candidateCount),
    bytes: countOverflow(requiredBytes, capacity.bytes)
  };
  const reasonCodes = Object.entries(overflow)
    .filter(([, value]) => value > 0)
    .map(([name]) => `${name}-capacity-overflow`);
  const failClosed = reasonCodes.length > 0;
  const consumerDispatchAllowed = !failClosed;
  const admitted = failClosed
    ? {
        uniqueCellCount: 0,
        cellOffsetCount: 0,
        cellMemberCount: 0,
        sourceOffsetCount: 0,
        candidateCount: 0,
        bytes: 0
      }
    : { ...required, bytes: requiredBytes };
  let statusFlags = RESIDENT_NEIGHBORHOOD_STATUS_FLAG.LEASE_BOUND
    | RESIDENT_NEIGHBORHOOD_STATUS_FLAG.GENERATION_BOUND;
  if (failClosed) {
    statusFlags |= RESIDENT_NEIGHBORHOOD_STATUS_FLAG.OVERFLOW
      | RESIDENT_NEIGHBORHOOD_STATUS_FLAG.FAIL_CLOSED
      | RESIDENT_NEIGHBORHOOD_STATUS_FLAG.REBUILD_REQUIRED;
  } else {
    statusFlags |= RESIDENT_NEIGHBORHOOD_STATUS_FLAG.READY
      | RESIDENT_NEIGHBORHOOD_STATUS_FLAG.CONSUMER_DISPATCH_ADMITTED;
  }

  return {
    schema: ULG_RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_SCHEMA,
    status: failClosed
      ? 'resident-neighborhood-capacity-overflow-fail-closed'
      : 'resident-neighborhood-capacity-ready',
    generation: normalizedGeneration,
    leaseTokenLow: requireUint32(leaseTokenLow, 'leaseTokenLow'),
    leaseTokenHigh: requireUint32(leaseTokenHigh, 'leaseTokenHigh'),
    sourceCount: normalizedSourceCount,
    supportClassCount: normalizedSupportClassCount,
    consumerMask: requireUint32(consumerMask, 'consumerMask'),
    required: { ...required, bytes: requiredBytes },
    admitted,
    capacity,
    overflow,
    statusFlags: statusFlags >>> 0,
    failClosed,
    consumerDispatchAllowed,
    reasonCodes,
    gpuFirst: true,
    cpuSolverOracleRequired: false,
    fullParticleReadbackRequired: false,
    readbackPolicy: 'fixed-size-capacity-evidence-only'
  };
}

export function packResidentNeighborhoodCapacityEvidenceU32(evidence) {
  if (!evidence || evidence.schema !== ULG_RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_SCHEMA) {
    throw new TypeError('evidence must be a resident-neighborhood capacity plan');
  }
  const requiredBytes = splitResidentNeighborhoodUint64(evidence.required.bytes);
  const admittedBytes = splitResidentNeighborhoodUint64(evidence.admitted.bytes);
  const capacityBytes = splitResidentNeighborhoodUint64(evidence.capacity.bytes);
  const overflowBytes = splitResidentNeighborhoodUint64(evidence.overflow.bytes);
  return new Uint32Array([
    RESIDENT_NEIGHBORHOOD_EVIDENCE_VERSION,
    evidence.generation,
    evidence.leaseTokenLow,
    evidence.leaseTokenHigh,
    evidence.sourceCount,
    evidence.required.uniqueCellCount,
    evidence.admitted.uniqueCellCount,
    evidence.capacity.uniqueCellCount,
    evidence.overflow.uniqueCellCount,
    evidence.required.cellOffsetCount,
    evidence.admitted.cellOffsetCount,
    evidence.capacity.cellOffsetCount,
    evidence.overflow.cellOffsetCount,
    evidence.required.cellMemberCount,
    evidence.admitted.cellMemberCount,
    evidence.capacity.cellMemberCount,
    evidence.overflow.cellMemberCount,
    evidence.required.sourceOffsetCount,
    evidence.admitted.sourceOffsetCount,
    evidence.capacity.sourceOffsetCount,
    evidence.overflow.sourceOffsetCount,
    evidence.required.candidateCount,
    evidence.admitted.candidateCount,
    evidence.capacity.candidateCount,
    evidence.overflow.candidateCount,
    requiredBytes.low,
    requiredBytes.high,
    admittedBytes.low,
    admittedBytes.high,
    capacityBytes.low,
    capacityBytes.high,
    overflowBytes.low,
    overflowBytes.high,
    evidence.consumerMask,
    evidence.supportClassCount,
    evidence.statusFlags,
    evidence.failClosed ? 1 : 0,
    evidence.consumerDispatchAllowed ? 1 : 0,
    0,
    0
  ]);
}

export function createResidentNeighborhoodDescriptor({
  generation = 0,
  leaseId,
  laneId,
  stateKey,
  deviceId = '',
  leaseTokenLow = 0,
  leaseTokenHigh = 0,
  supportClasses = [],
  sourceCount = 0,
  requiredUniqueCellCount = 0,
  requiredCellMemberCount = sourceCount,
  requiredCandidateCount = 0,
  capacities = {}
} = {}) {
  const normalizedGeneration = requireUint32(generation, 'generation');
  const normalizedSupportClasses = normalizeResidentNeighborhoodSupportClasses(
    supportClasses,
    { generation: normalizedGeneration }
  );
  const consumerMask = normalizedSupportClasses.reduce(
    (mask, supportClass) => (mask | supportClass.consumerMask) >>> 0,
    0
  );
  const lease = {
    leaseId: requireNonEmptyString(leaseId, 'leaseId'),
    laneId: requireNonEmptyString(laneId, 'laneId'),
    stateKey: requireNonEmptyString(stateKey, 'stateKey'),
    deviceId: typeof deviceId === 'string' ? deviceId : '',
    tokenLow: requireUint32(leaseTokenLow, 'leaseTokenLow'),
    tokenHigh: requireUint32(leaseTokenHigh, 'leaseTokenHigh')
  };
  const capacityEvidence = createResidentNeighborhoodCapacityPlan({
    generation: normalizedGeneration,
    leaseTokenLow: lease.tokenLow,
    leaseTokenHigh: lease.tokenHigh,
    sourceCount,
    requiredUniqueCellCount,
    requiredCellMemberCount,
    requiredCandidateCount,
    supportClassCount: normalizedSupportClasses.length,
    consumerMask,
    capacities
  });
  const admitted = capacityEvidence.consumerDispatchAllowed;
  return {
    schema: ULG_RESIDENT_NEIGHBORHOOD_DESCRIPTOR_SCHEMA,
    status: admitted
      ? 'resident-neighborhood-descriptor-ready'
      : 'resident-neighborhood-capacity-overflow-fail-closed',
    generation: normalizedGeneration,
    authority: {
      laneOwner: 'peercompute-compute-manager',
      resourceOwner: 'peercompute-gpu-hub',
      mutationAdmission: 'peercompute-state-manager',
      sceneLocalScheduler: false
    },
    lease,
    keyEncoding: {
      kind: 'structural-chart-level-cell-u32',
      signedCoordinateEncoding: 'sign-bit-biased-order-preserving-u32',
      structuralWordCount: RESIDENT_NEIGHBORHOOD_CELL_KEY_STRUCTURAL_WORDS,
      identityWordCount: RESIDENT_NEIGHBORHOOD_CELL_KEY_IDENTITY_WORDS,
      hashAuthority: false
    },
    supportClasses: normalizedSupportClasses,
    consumerMask,
    layouts: {
      cellKey: layoutDescriptor(RESIDENT_NEIGHBORHOOD_CELL_KEY_U32_LAYOUT),
      supportClass: layoutDescriptor(RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_U32_LAYOUT),
      csrOffset: layoutDescriptor(RESIDENT_NEIGHBORHOOD_CSR_OFFSET_U32_LAYOUT),
      sourceSpan: layoutDescriptor(RESIDENT_NEIGHBORHOOD_SOURCE_SPAN_U32_LAYOUT),
      candidate: layoutDescriptor(RESIDENT_NEIGHBORHOOD_CANDIDATE_U32_LAYOUT),
      capacityEvidence: layoutDescriptor(RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_U32_LAYOUT)
    },
    csr: {
      cellMembership: 'unique-cell-keys-plus-cell-offsets-plus-member-indices',
      sourceCandidates: 'source-offsets-plus-target-index-consumer-mask-rows',
      sentinelOffsetsRequired: true,
      truncationAdmissible: false
    },
    capacityEvidence,
    capacityEvidenceU32: packResidentNeighborhoodCapacityEvidenceU32(capacityEvidence),
    admission: {
      failClosed: capacityEvidence.failClosed,
      consumerDispatchAllowed: admitted,
      stateMutationAllowed: false,
      stateMutationAdmissionRequired: true,
      reasonCodes: [...capacityEvidence.reasonCodes]
    },
    reuse: {
      mechanics: Boolean(consumerMask & RESIDENT_NEIGHBORHOOD_CONSUMER.MECHANICS),
      contact: Boolean(consumerMask & RESIDENT_NEIGHBORHOOD_CONSUMER.CONTACT),
      thermal: Boolean(consumerMask & RESIDENT_NEIGHBORHOOD_CONSUMER.THERMAL),
      radiation: Boolean(consumerMask & RESIDENT_NEIGHBORHOOD_CONSUMER.RADIATION),
      reaction: Boolean(consumerMask & RESIDENT_NEIGHBORHOOD_CONSUMER.REACTION),
      ssUniqueNodeCompaction: true
    },
    gpuFirst: true,
    cpuSolverOracleRequired: false,
    fullParticleReadbackRequired: false,
    portableState: false
  };
}

export function validateResidentNeighborhoodLease(descriptor, {
  generation,
  leaseId,
  laneId,
  stateKey,
  leaseTokenLow,
  leaseTokenHigh
} = {}) {
  if (!descriptor || descriptor.schema !== ULG_RESIDENT_NEIGHBORHOOD_DESCRIPTOR_SCHEMA) {
    throw new TypeError('descriptor must be a resident-neighborhood descriptor');
  }
  const mismatches = [];
  if (generation !== undefined
    && descriptor.generation !== requireUint32(generation, 'generation')) {
    mismatches.push('generation');
  }
  if (leaseId !== undefined && descriptor.lease.leaseId !== leaseId) mismatches.push('leaseId');
  if (laneId !== undefined && descriptor.lease.laneId !== laneId) mismatches.push('laneId');
  if (stateKey !== undefined && descriptor.lease.stateKey !== stateKey) mismatches.push('stateKey');
  if (leaseTokenLow !== undefined
    && descriptor.lease.tokenLow !== requireUint32(leaseTokenLow, 'leaseTokenLow')) {
    mismatches.push('leaseTokenLow');
  }
  if (leaseTokenHigh !== undefined
    && descriptor.lease.tokenHigh !== requireUint32(leaseTokenHigh, 'leaseTokenHigh')) {
    mismatches.push('leaseTokenHigh');
  }
  const identityValid = mismatches.length === 0;
  const capacityAdmitted = descriptor.admission.consumerDispatchAllowed === true;
  return {
    status: identityValid && capacityAdmitted
      ? 'resident-neighborhood-lease-valid'
      : 'resident-neighborhood-lease-invalid-fail-closed',
    identityValid,
    capacityAdmitted,
    consumerDispatchAllowed: identityValid && capacityAdmitted,
    stateMutationAllowed: false,
    mismatches
  };
}
