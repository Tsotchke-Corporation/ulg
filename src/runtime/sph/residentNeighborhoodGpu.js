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
  RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_SOURCE_SPAN_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_STATUS_FLAG,
  RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG,
  RESIDENT_NEIGHBORHOOD_UNASSIGNED_SUPPORT_CLASS,
  RESIDENT_NEIGHBORHOOD_VALIDITY_FLAG,
  ULG_RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_SCHEMA,
  ULG_RESIDENT_NEIGHBORHOOD_DESCRIPTOR_SCHEMA,
  ULG_RESIDENT_NEIGHBORHOOD_PACKED_CSR_SCHEMA,
  ULG_RESIDENT_NEIGHBORHOOD_POSITION_VALIDITY_SCHEMA
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
  RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_SOURCE_SPAN_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_STATUS_FLAG,
  RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG,
  RESIDENT_NEIGHBORHOOD_UNASSIGNED_SUPPORT_CLASS,
  RESIDENT_NEIGHBORHOOD_VALIDITY_FLAG,
  ULG_RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_SCHEMA,
  ULG_RESIDENT_NEIGHBORHOOD_DESCRIPTOR_SCHEMA,
  ULG_RESIDENT_NEIGHBORHOOD_PACKED_CSR_SCHEMA,
  ULG_RESIDENT_NEIGHBORHOOD_POSITION_VALIDITY_SCHEMA
};

const UINT32_MAX = 0xffff_ffff;
const UINT64_MASK = 0xffff_ffff_ffff_ffffn;
const FNV1A64_OFFSET_BASIS = 0xcbf2_9ce4_8422_2325n;
const FNV1A64_PRIME = 0x0000_0100_0000_01b3n;
const INT32_MIN = -0x8000_0000;
const INT32_MAX = 0x7fff_ffff;
const SIGN_ORDER_BIAS = 0x8000_0000;
const U32_BYTES = Uint32Array.BYTES_PER_ELEMENT;

export const PEERCOMPUTE_GPU_RESIDENT_LANE_LEASE_IDENTITY_SCHEMA =
  'peercompute.compute.gpu-resident-lane-lease-identity.v0';
export const RESIDENT_NEIGHBORHOOD_AUTHORITY_TOKEN_BINDING =
  'fnv1a64:leaseId:laneId:stateKey:sourceFamily:v0';

export const RESIDENT_NEIGHBORHOOD_CELL_KEY_STRIDE_U32 =
  RESIDENT_NEIGHBORHOOD_CELL_KEY_U32_LAYOUT.length;
export const RESIDENT_NEIGHBORHOOD_CELL_KEY_STRIDE_BYTES =
  RESIDENT_NEIGHBORHOOD_CELL_KEY_STRIDE_U32 * U32_BYTES;
export const RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_STRIDE_U32 =
  RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_U32_LAYOUT.length;
export const RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_STRIDE_BYTES =
  RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_STRIDE_U32 * U32_BYTES;
export const RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_STRIDE_U32 =
  RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_U32_LAYOUT.length;
export const RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_STRIDE_BYTES =
  RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_STRIDE_U32 * U32_BYTES;
export const RESIDENT_NEIGHBORHOOD_CANDIDATE_STRIDE_U32 =
  RESIDENT_NEIGHBORHOOD_CANDIDATE_U32_LAYOUT.length;
export const RESIDENT_NEIGHBORHOOD_CANDIDATE_STRIDE_BYTES =
  RESIDENT_NEIGHBORHOOD_CANDIDATE_STRIDE_U32 * U32_BYTES;
export const RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_STRIDE_U32 =
  RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_U32_LAYOUT.length;
export const RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_STRIDE_BYTES =
  RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_STRIDE_U32 * U32_BYTES;
export const RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_STRIDE_U32 =
  RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_U32_LAYOUT.length;
export const RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_STRIDE_BYTES =
  RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_STRIDE_U32 * U32_BYTES;

const CONSUMER_SLOTS = Object.freeze([
  ['mechanics', RESIDENT_NEIGHBORHOOD_CONSUMER.MECHANICS],
  ['contact', RESIDENT_NEIGHBORHOOD_CONSUMER.CONTACT],
  ['thermal', RESIDENT_NEIGHBORHOOD_CONSUMER.THERMAL],
  ['radiation', RESIDENT_NEIGHBORHOOD_CONSUMER.RADIATION],
  ['reaction', RESIDENT_NEIGHBORHOOD_CONSUMER.REACTION],
  ['pressureInterface', RESIDENT_NEIGHBORHOOD_CONSUMER.PRESSURE_INTERFACE],
  ['solidKinematics', RESIDENT_NEIGHBORHOOD_CONSUMER.SOLID_KINEMATICS],
  ['ssUniqueNodeCompaction', RESIDENT_NEIGHBORHOOD_CONSUMER.SS_UNIQUE_NODE_COMPACTION]
]);

const DEFAULT_SELF_INCLUSION = Object.freeze({
  mechanics: 'exclude',
  contact: 'exclude',
  thermal: 'exclude',
  radiation: 'exclude',
  reaction: 'exclude',
  pressureInterface: 'include',
  solidKinematics: 'exclude',
  ssUniqueNodeCompaction: 'include'
});

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

function requireNonNegativeFinite(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
  return number;
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

export function createResidentNeighborhoodAuthorityToken({
  leaseId,
  laneId,
  stateKey,
  sourceFamily
} = {}) {
  const parts = [
    requireNonEmptyString(leaseId, 'leaseId'),
    requireNonEmptyString(laneId, 'laneId'),
    requireNonEmptyString(stateKey, 'stateKey'),
    requireNonEmptyString(sourceFamily, 'sourceFamily')
  ];
  const bytes = new TextEncoder().encode([
    RESIDENT_NEIGHBORHOOD_AUTHORITY_TOKEN_BINDING,
    ...parts.map((value) => `${value.length}:${value}`)
  ].join('\0'));
  let hash = FNV1A64_OFFSET_BASIS;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * FNV1A64_PRIME) & UINT64_MASK;
  }
  return Object.freeze({
    low: Number(hash & 0xffff_ffffn) >>> 0,
    high: Number((hash >> 32n) & 0xffff_ffffn) >>> 0,
    binding: RESIDENT_NEIGHBORHOOD_AUTHORITY_TOKEN_BINDING
  });
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

function alignU32(value, alignment = 4) {
  const count = requireSafeUint(value, 'u32 offset');
  const resolvedAlignment = requireUint32(alignment, 'u32 alignment');
  if (resolvedAlignment === 0) throw new RangeError('u32 alignment must be positive');
  return checkedMultiply(
    Math.ceil(count / resolvedAlignment),
    resolvedAlignment,
    'aligned u32 offset'
  );
}

function float32Bits(value, name) {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, requireNonNegativeFinite(value, name), true);
  return view.getUint32(0, true);
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

function assignmentSupportClassId(assignment, consumerName) {
  return assignment?.[consumerName]
    ?? assignment?.[`${consumerName}SupportClassId`]
    ?? assignment?.supportClassIds?.[consumerName]
    ?? RESIDENT_NEIGHBORHOOD_UNASSIGNED_SUPPORT_CLASS;
}

export function normalizeResidentNeighborhoodSourceSupportAssignments(
  sourceSupportAssignments,
  { sourceCount = 0, supportClasses = [] } = {}
) {
  const normalizedSourceCount = requireUint32(sourceCount, 'sourceCount');
  const uniformAssignment = !Array.isArray(sourceSupportAssignments)
    ? sourceSupportAssignments?.uniform
    : null;
  if (!Array.isArray(sourceSupportAssignments) && !uniformAssignment) {
    throw new TypeError(
      'sourceSupportAssignments must be an array or { uniform: assignment }'
    );
  }
  if (Array.isArray(sourceSupportAssignments)
    && sourceSupportAssignments.length !== normalizedSourceCount) {
    throw new RangeError(
      `sourceSupportAssignments must contain exactly ${normalizedSourceCount} source rows`
    );
  }
  const normalizedSupportClasses = normalizeResidentNeighborhoodSupportClasses(supportClasses);
  const classesById = new Map(
    normalizedSupportClasses.map((supportClass) => [supportClass.supportClassId, supportClass])
  );
  const inputAssignments = uniformAssignment ? [uniformAssignment] : sourceSupportAssignments;
  const normalized = inputAssignments.map((assignment, packedSourceIndex) => {
    const sourceIndex = uniformAssignment ? null : packedSourceIndex;
    const sourceLabel = uniformAssignment ? 'uniform' : sourceIndex;
    if (!assignment || typeof assignment !== 'object') {
      throw new TypeError(`sourceSupportAssignments[${sourceLabel}] must be an object`);
    }
    const supportClassIds = {};
    let consumerMask = 0;
    for (const [consumerName, consumerBit] of CONSUMER_SLOTS) {
      const supportClassId = requireUint32(
        assignmentSupportClassId(assignment, consumerName),
        `sourceSupportAssignments[${sourceLabel}].${consumerName}`
      );
      supportClassIds[consumerName] = supportClassId;
      if (supportClassId === RESIDENT_NEIGHBORHOOD_UNASSIGNED_SUPPORT_CLASS) continue;
      const supportClass = classesById.get(supportClassId);
      if (!supportClass) {
        throw new RangeError(
          `sourceSupportAssignments[${sourceIndex}].${consumerName} references unknown supportClassId ${supportClassId}`
        );
      }
      if ((supportClass.consumerMask & consumerBit) === 0) {
        throw new RangeError(
          `supportClassId ${supportClassId} does not admit the ${consumerName} consumer`
        );
      }
      consumerMask = (consumerMask | consumerBit) >>> 0;
    }
    return Object.freeze({
      sourceIndex,
      consumerMask,
      supportClassIds: Object.freeze(supportClassIds)
    });
  });
  const consumerMask = normalized.reduce(
    (mask, assignment) => (mask | assignment.consumerMask) >>> 0,
    0
  );
  return Object.freeze({
    rowCount: normalizedSourceCount,
    packedRowCount: normalized.length,
    rowStrideU32: RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_STRIDE_U32,
    rowStrideBytes: RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_STRIDE_BYTES,
    rowLayout: [...RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_U32_LAYOUT],
    sourceIndexing: 'row-index-is-source-index',
    unassignedSupportClassId: RESIDENT_NEIGHBORHOOD_UNASSIGNED_SUPPORT_CLASS,
    consumerSlotOrder: Object.freeze(CONSUMER_SLOTS.map(([consumerName]) => consumerName)),
    consumerMask,
    storageMode: uniformAssignment ? 'uniform-gpu-expanded' : 'per-source-rows',
    uniform: Boolean(uniformAssignment),
    assignments: Object.freeze(normalized)
  });
}

export function packResidentNeighborhoodSourceSupportAssignmentsU32(
  sourceSupportAssignments,
  options = {}
) {
  const normalized = normalizeResidentNeighborhoodSourceSupportAssignments(
    sourceSupportAssignments,
    options
  );
  const rows = new Uint32Array(
    normalized.packedRowCount * RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_STRIDE_U32
  );
  normalized.assignments.forEach((assignment, packedSourceIndex) => {
    const offset = packedSourceIndex
      * RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_STRIDE_U32;
    CONSUMER_SLOTS.forEach(([consumerName], slot) => {
      rows[offset + slot] = assignment.supportClassIds[consumerName];
    });
  });
  return rows;
}

function normalizeSelfRule(value, label) {
  if (value === true || value === 'include') return 'include';
  if (value === false || value === 'exclude') return 'exclude';
  throw new TypeError(`${label} must be "include", "exclude", or a boolean`);
}

export function normalizeResidentNeighborhoodSelfInclusionPolicy(
  selfInclusionPolicy = {},
  { consumerMask = 0 } = {}
) {
  if (!selfInclusionPolicy || typeof selfInclusionPolicy !== 'object') {
    throw new TypeError('selfInclusionPolicy must be an object');
  }
  const normalizedConsumerMask = requireUint32(consumerMask, 'consumerMask');
  let includeConsumerMask = 0;
  let excludeConsumerMask = 0;
  const byConsumer = {};
  const directMasks = selfInclusionPolicy.includeConsumerMask !== undefined
    || selfInclusionPolicy.excludeConsumerMask !== undefined;
  if (directMasks) {
    includeConsumerMask = requireUint32(
      selfInclusionPolicy.includeConsumerMask ?? 0,
      'selfInclusionPolicy.includeConsumerMask'
    ) & normalizedConsumerMask;
    excludeConsumerMask = requireUint32(
      selfInclusionPolicy.excludeConsumerMask ?? 0,
      'selfInclusionPolicy.excludeConsumerMask'
    ) & normalizedConsumerMask;
    for (const [consumerName, consumerBit] of CONSUMER_SLOTS) {
      if ((normalizedConsumerMask & consumerBit) === 0) continue;
      if ((includeConsumerMask & consumerBit) !== 0) byConsumer[consumerName] = 'include';
      if ((excludeConsumerMask & consumerBit) !== 0) byConsumer[consumerName] = 'exclude';
    }
  } else {
    for (const [consumerName, consumerBit] of CONSUMER_SLOTS) {
      if ((normalizedConsumerMask & consumerBit) === 0) continue;
      const rule = normalizeSelfRule(
        selfInclusionPolicy[consumerName] ?? DEFAULT_SELF_INCLUSION[consumerName],
        `selfInclusionPolicy.${consumerName}`
      );
      byConsumer[consumerName] = rule;
      if (rule === 'include') includeConsumerMask = (includeConsumerMask | consumerBit) >>> 0;
      else excludeConsumerMask = (excludeConsumerMask | consumerBit) >>> 0;
    }
  }
  if ((includeConsumerMask & excludeConsumerMask) !== 0) {
    throw new RangeError('self inclusion and exclusion consumer masks must not overlap');
  }
  const coveredConsumerMask = (includeConsumerMask | excludeConsumerMask) >>> 0;
  if (coveredConsumerMask !== normalizedConsumerMask) {
    throw new RangeError('self inclusion policy must cover every enabled consumer exactly once');
  }
  return Object.freeze({
    status: 'resident-neighborhood-self-inclusion-policy-ready',
    consumerMask: normalizedConsumerMask,
    includeConsumerMask: includeConsumerMask >>> 0,
    excludeConsumerMask: excludeConsumerMask >>> 0,
    coveredConsumerMask,
    complete: true,
    byConsumer: Object.freeze(byConsumer)
  });
}

export function createResidentNeighborhoodPositionValidity({
  positionEpoch = 0,
  skinDistanceM = 0,
  maxDisplacementM = 0
} = {}) {
  const normalizedPositionEpoch = requireUint32(positionEpoch, 'positionEpoch');
  const normalizedSkinDistanceM = requireNonNegativeFinite(skinDistanceM, 'skinDistanceM');
  const normalizedMaxDisplacementM = requireNonNegativeFinite(
    maxDisplacementM,
    'maxDisplacementM'
  );
  const displacementBudgetM = normalizedSkinDistanceM * 0.5;
  const valid = normalizedMaxDisplacementM <= displacementBudgetM;
  let validityFlags = RESIDENT_NEIGHBORHOOD_VALIDITY_FLAG.POSITION_EPOCH_BOUND
    | RESIDENT_NEIGHBORHOOD_VALIDITY_FLAG.MAX_DISPLACEMENT_RECORDED;
  if (valid) validityFlags |= RESIDENT_NEIGHBORHOOD_VALIDITY_FLAG.SKIN_ENVELOPE_VALID;
  else validityFlags |= RESIDENT_NEIGHBORHOOD_VALIDITY_FLAG.REBUILD_REQUIRED;
  return Object.freeze({
    schema: ULG_RESIDENT_NEIGHBORHOOD_POSITION_VALIDITY_SCHEMA,
    status: valid
      ? 'resident-neighborhood-position-envelope-valid'
      : 'resident-neighborhood-position-envelope-exhausted-rebuild-required',
    positionEpoch: normalizedPositionEpoch,
    skinDistanceM: normalizedSkinDistanceM,
    maxDisplacementM: normalizedMaxDisplacementM,
    displacementBudgetM,
    pairClosureBoundM: normalizedMaxDisplacementM * 2,
    validityRule: 'two-times-max-displacement-not-greater-than-skin-distance',
    validityFlags: validityFlags >>> 0,
    valid,
    rebuildRequired: !valid,
    consumerDispatchAllowed: valid,
    reasonCodes: valid ? [] : ['position-skin-envelope-exhausted']
  });
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
  sourceSupportAssignmentCount = 0,
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
    checkedMultiply(
      packedCsrU32Length({
        sourceOffsetCount: requireUint32(sourceOffsetCount, 'sourceOffsetCount'),
        sourceSupportAssignmentCount: requireUint32(
          sourceSupportAssignmentCount,
          'sourceSupportAssignmentCount'
        ),
        candidateCount: requireUint32(candidateCount, 'candidateCount')
      }),
      U32_BYTES,
      'packed source-candidate CSR bytes'
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
  admissionReasonCodes = [],
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
    sourceSupportAssignmentCount: normalizedSourceCount,
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
    sourceSupportAssignmentCount: resolveCapacity(
      capacities.sourceSupportAssignmentCount,
      required.sourceSupportAssignmentCount,
      'capacities.sourceSupportAssignmentCount'
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
    sourceSupportAssignmentCount: countOverflow(
      required.sourceSupportAssignmentCount,
      capacity.sourceSupportAssignmentCount
    ),
    candidateCount: countOverflow(required.candidateCount, capacity.candidateCount),
    bytes: countOverflow(requiredBytes, capacity.bytes)
  };
  const capacityReasonCodes = Object.entries(overflow)
    .filter(([, value]) => value > 0)
    .map(([name]) => `${name}-capacity-overflow`);
  if (!Array.isArray(admissionReasonCodes)) {
    throw new TypeError('admissionReasonCodes must be an array');
  }
  const reasonCodes = [
    ...capacityReasonCodes,
    ...admissionReasonCodes.map((reason) => String(reason)).filter(Boolean)
  ];
  const failClosed = reasonCodes.length > 0;
  const consumerDispatchAllowed = !failClosed;
  const admitted = failClosed
    ? {
        uniqueCellCount: 0,
        cellOffsetCount: 0,
        cellMemberCount: 0,
        sourceOffsetCount: 0,
        sourceSupportAssignmentCount: 0,
        candidateCount: 0,
        bytes: 0
      }
    : { ...required, bytes: requiredBytes };
  let statusFlags = RESIDENT_NEIGHBORHOOD_STATUS_FLAG.LEASE_BOUND
    | RESIDENT_NEIGHBORHOOD_STATUS_FLAG.GENERATION_BOUND
    | RESIDENT_NEIGHBORHOOD_STATUS_FLAG.POSITION_EPOCH_BOUND
    | RESIDENT_NEIGHBORHOOD_STATUS_FLAG.SELF_POLICY_BOUND
    | RESIDENT_NEIGHBORHOOD_STATUS_FLAG.SOURCE_SUPPORT_ASSIGNMENTS_BOUND;
  if (failClosed) {
    statusFlags |= RESIDENT_NEIGHBORHOOD_STATUS_FLAG.FAIL_CLOSED
      | RESIDENT_NEIGHBORHOOD_STATUS_FLAG.REBUILD_REQUIRED;
    if (capacityReasonCodes.length > 0) {
      statusFlags |= RESIDENT_NEIGHBORHOOD_STATUS_FLAG.OVERFLOW;
    }
  } else {
    statusFlags |= RESIDENT_NEIGHBORHOOD_STATUS_FLAG.READY
      | RESIDENT_NEIGHBORHOOD_STATUS_FLAG.POSITION_SKIN_VALID
      | RESIDENT_NEIGHBORHOOD_STATUS_FLAG.CONSUMER_DISPATCH_ADMITTED;
  }

  return {
    schema: ULG_RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_SCHEMA,
    status: failClosed
      ? (capacityReasonCodes.length > 0
          ? 'resident-neighborhood-capacity-overflow-fail-closed'
          : 'resident-neighborhood-validity-fail-closed')
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
    capacityReasonCodes,
    validityReasonCodes: reasonCodes.slice(capacityReasonCodes.length),
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
    evidence.required.sourceSupportAssignmentCount,
    evidence.admitted.sourceSupportAssignmentCount,
    evidence.capacity.sourceSupportAssignmentCount,
    evidence.overflow.sourceSupportAssignmentCount,
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

function packedCsrU32Length({
  sourceOffsetCount,
  sourceSupportAssignmentCount,
  candidateCount
}) {
  let cursor = RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_STRIDE_U32;
  cursor = checkedAdd(cursor, sourceOffsetCount, 'packed CSR source-offset end');
  cursor = alignU32(cursor);
  cursor = checkedAdd(
    cursor,
    checkedMultiply(
      sourceSupportAssignmentCount,
      RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_STRIDE_U32,
      'packed CSR source-support-assignment words'
    ),
    'packed CSR source-support-assignment end'
  );
  cursor = alignU32(cursor);
  cursor = checkedAdd(
    cursor,
    checkedMultiply(
      candidateCount,
      RESIDENT_NEIGHBORHOOD_CANDIDATE_STRIDE_U32,
      'packed CSR candidate words'
    ),
    'packed CSR candidate end'
  );
  return alignU32(cursor);
}

export function createResidentNeighborhoodPackedCsrPlan({
  capacityEvidence,
  positionValidity,
  selfInclusionPolicy
} = {}) {
  if (capacityEvidence?.schema !== ULG_RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_SCHEMA) {
    throw new TypeError('capacityEvidence must be a resident-neighborhood capacity plan');
  }
  if (positionValidity?.schema !== ULG_RESIDENT_NEIGHBORHOOD_POSITION_VALIDITY_SCHEMA) {
    throw new TypeError('positionValidity must be resident-neighborhood position evidence');
  }
  if (selfInclusionPolicy?.complete !== true) {
    throw new TypeError('selfInclusionPolicy must completely cover enabled consumers');
  }
  const sourceOffsetBaseU32 = RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_STRIDE_U32;
  const sourceSupportAssignmentBaseU32 = alignU32(
    checkedAdd(
      sourceOffsetBaseU32,
      capacityEvidence.capacity.sourceOffsetCount,
      'packed CSR source-offset capacity end'
    )
  );
  const candidateBaseU32 = alignU32(checkedAdd(
    sourceSupportAssignmentBaseU32,
    checkedMultiply(
      capacityEvidence.capacity.sourceSupportAssignmentCount,
      RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_STRIDE_U32,
      'packed CSR assignment capacity words'
    ),
    'packed CSR assignment capacity end'
  ));
  const backingCapacityU32 = alignU32(checkedAdd(
    candidateBaseU32,
    checkedMultiply(
      capacityEvidence.capacity.candidateCount,
      RESIDENT_NEIGHBORHOOD_CANDIDATE_STRIDE_U32,
      'packed CSR candidate capacity words'
    ),
    'packed CSR candidate capacity end'
  ));
  if (backingCapacityU32 > UINT32_MAX) {
    throw new RangeError('packed CSR backing buffer exceeds u32 shader addressability');
  }
  const backingBufferByteLength = checkedMultiply(
    backingCapacityU32,
    U32_BYTES,
    'packed CSR backing-buffer bytes'
  );
  const requiredPayloadU32 = packedCsrU32Length({
    sourceOffsetCount: capacityEvidence.required.sourceOffsetCount,
    sourceSupportAssignmentCount: capacityEvidence.required.sourceSupportAssignmentCount,
    candidateCount: capacityEvidence.required.candidateCount
  });
  const requiredPayloadWords = splitResidentNeighborhoodUint64(requiredPayloadU32);
  const backingBytes = splitResidentNeighborhoodUint64(backingBufferByteLength);
  const headerU32 = new Uint32Array([
    RESIDENT_NEIGHBORHOOD_EVIDENCE_VERSION,
    capacityEvidence.generation,
    capacityEvidence.leaseTokenLow,
    capacityEvidence.leaseTokenHigh,
    positionValidity.positionEpoch,
    capacityEvidence.sourceCount,
    RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_STRIDE_U32,
    backingCapacityU32,
    sourceOffsetBaseU32,
    capacityEvidence.required.sourceOffsetCount,
    capacityEvidence.admitted.sourceOffsetCount,
    capacityEvidence.capacity.sourceOffsetCount,
    sourceSupportAssignmentBaseU32,
    capacityEvidence.required.sourceSupportAssignmentCount,
    capacityEvidence.admitted.sourceSupportAssignmentCount,
    capacityEvidence.capacity.sourceSupportAssignmentCount,
    RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_STRIDE_U32,
    candidateBaseU32,
    capacityEvidence.required.candidateCount,
    capacityEvidence.admitted.candidateCount,
    capacityEvidence.capacity.candidateCount,
    RESIDENT_NEIGHBORHOOD_CANDIDATE_STRIDE_U32,
    capacityEvidence.consumerMask,
    selfInclusionPolicy.includeConsumerMask,
    selfInclusionPolicy.excludeConsumerMask,
    capacityEvidence.supportClassCount,
    float32Bits(positionValidity.skinDistanceM, 'skinDistanceM'),
    float32Bits(positionValidity.maxDisplacementM, 'maxDisplacementM'),
    float32Bits(positionValidity.displacementBudgetM, 'displacementBudgetM'),
    positionValidity.validityFlags,
    capacityEvidence.statusFlags,
    capacityEvidence.consumerDispatchAllowed ? 1 : 0,
    0,
    capacityEvidence.failClosed ? 1 : 0,
    requiredPayloadWords.low,
    requiredPayloadWords.high,
    backingBytes.low,
    backingBytes.high,
    0,
    0
  ]);
  return {
    schema: ULG_RESIDENT_NEIGHBORHOOD_PACKED_CSR_SCHEMA,
    status: capacityEvidence.consumerDispatchAllowed
      ? 'resident-neighborhood-packed-csr-ready'
      : 'resident-neighborhood-packed-csr-fail-closed',
    singleStorageBinding: true,
    storageBindingCount: 1,
    shaderStorageType: 'array<u32>',
    thermalStorageBindingCompatible: true,
    headerLayout: [...RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_U32_LAYOUT],
    headerStrideU32: RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_STRIDE_U32,
    headerByteLength: RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_STRIDE_BYTES,
    headerU32,
    regions: {
      header: {
        baseU32: 0,
        count: RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_STRIDE_U32,
        strideU32: 1
      },
      sourceOffsets: {
        baseU32: sourceOffsetBaseU32,
        requiredCount: capacityEvidence.required.sourceOffsetCount,
        admittedCount: capacityEvidence.admitted.sourceOffsetCount,
        capacity: capacityEvidence.capacity.sourceOffsetCount,
        strideU32: 1
      },
      sourceSupportAssignments: {
        baseU32: sourceSupportAssignmentBaseU32,
        requiredCount: capacityEvidence.required.sourceSupportAssignmentCount,
        admittedCount: capacityEvidence.admitted.sourceSupportAssignmentCount,
        capacity: capacityEvidence.capacity.sourceSupportAssignmentCount,
        strideU32: RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_STRIDE_U32
      },
      candidates: {
        baseU32: candidateBaseU32,
        requiredCount: capacityEvidence.required.candidateCount,
        admittedCount: capacityEvidence.admitted.candidateCount,
        capacity: capacityEvidence.capacity.candidateCount,
        strideU32: RESIDENT_NEIGHBORHOOD_CANDIDATE_STRIDE_U32
      }
    },
    requiredPayloadU32,
    backingCapacityU32,
    backingBufferByteLength,
    generation: capacityEvidence.generation,
    positionEpoch: positionValidity.positionEpoch,
    consumerDispatchAllowed: capacityEvidence.consumerDispatchAllowed,
    stateMutationAllowed: false,
    failClosed: capacityEvidence.failClosed
  };
}

export function createResidentNeighborhoodDescriptor({
  generation = 0,
  leaseId,
  laneId,
  stateKey,
  sourceFamily = 'sph-particle-state',
  deviceId = '',
  leaseTokenLow = 0,
  leaseTokenHigh = 0,
  leaseAuthorityIdentity = null,
  supportClasses = [],
  sourceSupportAssignments = [],
  selfInclusionPolicy = {},
  positionEpoch = 0,
  skinDistanceM = 0,
  maxDisplacementM = 0,
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
  const normalizedSourceSupportAssignments = normalizeResidentNeighborhoodSourceSupportAssignments(
    sourceSupportAssignments,
    { sourceCount, supportClasses: normalizedSupportClasses }
  );
  const sourceSupportAssignmentRows = packResidentNeighborhoodSourceSupportAssignmentsU32(
    sourceSupportAssignments,
    { sourceCount, supportClasses: normalizedSupportClasses }
  );
  const consumerMask = normalizedSourceSupportAssignments.consumerMask;
  const normalizedSelfInclusionPolicy = normalizeResidentNeighborhoodSelfInclusionPolicy(
    selfInclusionPolicy,
    { consumerMask }
  );
  const positionValidity = createResidentNeighborhoodPositionValidity({
    positionEpoch,
    skinDistanceM,
    maxDisplacementM
  });
  const resolvedLeaseId = requireNonEmptyString(leaseId, 'leaseId');
  const resolvedLaneId = requireNonEmptyString(laneId, 'laneId');
  const resolvedStateKey = requireNonEmptyString(stateKey, 'stateKey');
  const resolvedSourceFamily = requireNonEmptyString(sourceFamily, 'sourceFamily');
  let authorityToken = {
    low: requireUint32(leaseTokenLow, 'leaseTokenLow'),
    high: requireUint32(leaseTokenHigh, 'leaseTokenHigh'),
    binding: 'diagnostic-caller-supplied-v0'
  };
  if (leaseAuthorityIdentity !== null) {
    if (leaseAuthorityIdentity?.schema !== PEERCOMPUTE_GPU_RESIDENT_LANE_LEASE_IDENTITY_SCHEMA
      || leaseAuthorityIdentity.authoritative !== true) {
      throw new TypeError(
        'leaseAuthorityIdentity must be an authoritative ComputeManager lane lease identity'
      );
    }
    for (const [field, expected] of [
      ['leaseId', resolvedLeaseId],
      ['laneId', resolvedLaneId],
      ['stateKey', resolvedStateKey],
      ['sourceFamily', resolvedSourceFamily]
    ]) {
      if (leaseAuthorityIdentity[field] !== expected) {
        throw new RangeError(`leaseAuthorityIdentity.${field} does not match descriptor ${field}`);
      }
    }
    authorityToken = createResidentNeighborhoodAuthorityToken(leaseAuthorityIdentity);
  }
  const lease = {
    leaseId: resolvedLeaseId,
    laneId: resolvedLaneId,
    stateKey: resolvedStateKey,
    sourceFamily: resolvedSourceFamily,
    deviceId: typeof deviceId === 'string' ? deviceId : '',
    tokenLow: authorityToken.low,
    tokenHigh: authorityToken.high,
    tokenBinding: authorityToken.binding,
    identitySchema: leaseAuthorityIdentity?.schema ?? null,
    authoritative: leaseAuthorityIdentity?.authoritative === true
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
    admissionReasonCodes: positionValidity.reasonCodes,
    capacities
  });
  const admitted = capacityEvidence.consumerDispatchAllowed;
  const packedCsr = createResidentNeighborhoodPackedCsrPlan({
    capacityEvidence,
    positionValidity,
    selfInclusionPolicy: normalizedSelfInclusionPolicy
  });
  const status = admitted
    ? 'resident-neighborhood-descriptor-ready'
    : (capacityEvidence.capacityReasonCodes.length > 0
        ? 'resident-neighborhood-capacity-overflow-fail-closed'
        : 'resident-neighborhood-position-validity-fail-closed');
  return {
    schema: ULG_RESIDENT_NEIGHBORHOOD_DESCRIPTOR_SCHEMA,
    status,
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
    sourceSupportAssignments: {
      ...normalizedSourceSupportAssignments,
      rows: sourceSupportAssignmentRows
    },
    selfInclusionPolicy: normalizedSelfInclusionPolicy,
    positionValidity,
    consumerMask,
    layouts: {
      cellKey: layoutDescriptor(RESIDENT_NEIGHBORHOOD_CELL_KEY_U32_LAYOUT),
      supportClass: layoutDescriptor(RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_U32_LAYOUT),
      sourceSupportAssignment: layoutDescriptor(
        RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_U32_LAYOUT
      ),
      csrOffset: layoutDescriptor(RESIDENT_NEIGHBORHOOD_CSR_OFFSET_U32_LAYOUT),
      sourceSpan: layoutDescriptor(RESIDENT_NEIGHBORHOOD_SOURCE_SPAN_U32_LAYOUT),
      candidate: layoutDescriptor(RESIDENT_NEIGHBORHOOD_CANDIDATE_U32_LAYOUT),
      packedCsrHeader: layoutDescriptor(RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_U32_LAYOUT),
      capacityEvidence: layoutDescriptor(RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_U32_LAYOUT)
    },
    csr: {
      cellMembership: 'unique-cell-keys-plus-cell-offsets-plus-member-indices',
      sourceCandidates:
        'single-packed-u32-buffer-with-source-offsets-support-assignments-and-target-mask-rows',
      sentinelOffsetsRequired: true,
      truncationAdmissible: false,
      positionValidityRule: positionValidity.validityRule
    },
    packedCsr,
    capacityEvidence,
    capacityEvidenceU32: packResidentNeighborhoodCapacityEvidenceU32(capacityEvidence),
    admission: {
      failClosed: capacityEvidence.failClosed,
      consumerDispatchAllowed: admitted,
      stateMutationAllowed: false,
      stateMutationAdmissionRequired: true,
      positionEpoch: positionValidity.positionEpoch,
      positionValid: positionValidity.valid,
      rebuildRequired: positionValidity.rebuildRequired,
      reasonCodes: [...capacityEvidence.reasonCodes]
    },
    reuse: {
      mechanics: Boolean(consumerMask & RESIDENT_NEIGHBORHOOD_CONSUMER.MECHANICS),
      contact: Boolean(consumerMask & RESIDENT_NEIGHBORHOOD_CONSUMER.CONTACT),
      thermal: Boolean(consumerMask & RESIDENT_NEIGHBORHOOD_CONSUMER.THERMAL),
      radiation: Boolean(consumerMask & RESIDENT_NEIGHBORHOOD_CONSUMER.RADIATION),
      reaction: Boolean(consumerMask & RESIDENT_NEIGHBORHOOD_CONSUMER.REACTION),
      pressureInterface: Boolean(
        consumerMask & RESIDENT_NEIGHBORHOOD_CONSUMER.PRESSURE_INTERFACE
      ),
      solidKinematics: Boolean(
        consumerMask & RESIDENT_NEIGHBORHOOD_CONSUMER.SOLID_KINEMATICS
      ),
      ssUniqueNodeCompaction: Boolean(
        consumerMask & RESIDENT_NEIGHBORHOOD_CONSUMER.SS_UNIQUE_NODE_COMPACTION
      ),
      structuralKeySortUniquePrimitiveReusable: true
    },
    gpuFirst: true,
    cpuSolverOracleRequired: false,
    fullParticleReadbackRequired: false,
    portableState: false
  };
}

export function residentNeighborhoodSelfPolicyForConsumer(descriptor, consumer) {
  if (descriptor?.schema !== ULG_RESIDENT_NEIGHBORHOOD_DESCRIPTOR_SCHEMA) {
    throw new TypeError('descriptor must be a resident-neighborhood descriptor');
  }
  const named = CONSUMER_SLOTS.find(([consumerName]) => consumerName === consumer);
  const consumerBit = named
    ? named[1]
    : requireUint32(consumer, 'consumer');
  if (consumerBit === 0 || (consumerBit & (consumerBit - 1)) !== 0) {
    throw new RangeError('consumer must identify exactly one consumer family');
  }
  if ((descriptor.consumerMask & consumerBit) === 0) return 'disabled';
  if ((descriptor.selfInclusionPolicy.includeConsumerMask & consumerBit) !== 0) return 'include';
  if ((descriptor.selfInclusionPolicy.excludeConsumerMask & consumerBit) !== 0) return 'exclude';
  return 'unresolved';
}

export function validateResidentNeighborhoodLease(descriptor, {
  generation,
  positionEpoch,
  maxDisplacementM,
  leaseId,
  laneId,
  stateKey,
  sourceFamily,
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
  if (positionEpoch !== undefined
    && descriptor.positionValidity.positionEpoch !== requireUint32(positionEpoch, 'positionEpoch')) {
    mismatches.push('positionEpoch');
  }
  if (leaseId !== undefined && descriptor.lease.leaseId !== leaseId) mismatches.push('leaseId');
  if (laneId !== undefined && descriptor.lease.laneId !== laneId) mismatches.push('laneId');
  if (stateKey !== undefined && descriptor.lease.stateKey !== stateKey) mismatches.push('stateKey');
  if (sourceFamily !== undefined && descriptor.lease.sourceFamily !== sourceFamily) {
    mismatches.push('sourceFamily');
  }
  if (leaseTokenLow !== undefined
    && descriptor.lease.tokenLow !== requireUint32(leaseTokenLow, 'leaseTokenLow')) {
    mismatches.push('leaseTokenLow');
  }
  if (leaseTokenHigh !== undefined
    && descriptor.lease.tokenHigh !== requireUint32(leaseTokenHigh, 'leaseTokenHigh')) {
    mismatches.push('leaseTokenHigh');
  }
  const identityValid = mismatches.length === 0;
  const observedPositionValidity = maxDisplacementM === undefined
    ? descriptor.positionValidity
    : createResidentNeighborhoodPositionValidity({
        positionEpoch: descriptor.positionValidity.positionEpoch,
        skinDistanceM: descriptor.positionValidity.skinDistanceM,
        maxDisplacementM
      });
  const positionValid = observedPositionValidity.valid;
  const capacityAdmitted = descriptor.capacityEvidence.capacityReasonCodes.length === 0;
  const descriptorAdmitted = descriptor.admission.consumerDispatchAllowed === true;
  const consumerDispatchAllowed = identityValid && descriptorAdmitted && positionValid;
  return {
    status: consumerDispatchAllowed
      ? 'resident-neighborhood-lease-valid'
      : 'resident-neighborhood-lease-invalid-fail-closed',
    identityValid,
    capacityAdmitted,
    descriptorAdmitted,
    positionValid,
    positionValidity: observedPositionValidity,
    rebuildRequired: !positionValid || descriptor.positionValidity.rebuildRequired,
    consumerDispatchAllowed,
    stateMutationAllowed: false,
    mismatches
  };
}
