export const ULG_SCHROEDER_SPATIAL_AGGREGATE_VIEW_SCHEMA =
  'peercompute.ulg.schroeder-spatial-aggregate-view.v2';
export const ULG_SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_SCHEMA =
  'peercompute.ulg.schroeder-spatial-active-member-projection.v1';
export const ULG_SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SCHEMA =
  'peercompute.ulg.schroeder-spatial-aggregate-traversal.v1';
export const ULG_SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUBMISSION_RECEIPT_SCHEMA =
  'peercompute.ulg.schroeder-spatial-aggregate-traversal-submission-receipt.v1';
export const SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_ID = 'far-aggregate';
export const SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_PHASE =
  'post-mechanics-far-aggregate';
export const SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_ARTIFACT_FAMILY =
  'spatial-aggregate-far-field-traversal';

export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_MAGIC = 0x53414731;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_VERSION = 2;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_TREE_ARITY = 2;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_MORTON_KEY_WORDS = 5;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_PREFIX_BIT_COUNT = 160;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_TOPOLOGY_FINGERPRINT_DOMAIN =
  0x544f_504f;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_TOPOLOGY_MODE_MORTON_PREFIX_BINARY = 2;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_HEADER_WORDS = 112;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_RECORD_WORDS = 44;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_CELL_DISPATCH_SLOT = 0;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_INTERNAL_DISPATCH_SLOT = 1;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_RECORD_DISPATCH_SLOT = 2;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_LEAF_DISPATCH_OFFSET_WORDS =
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_CELL_DISPATCH_SLOT * 3;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_INTERNAL_DISPATCH_OFFSET_WORDS =
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_INTERNAL_DISPATCH_SLOT * 3;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_AUTH_DISPATCH_SLOT =
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_RECORD_DISPATCH_SLOT;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_DISPATCH_WORDS = 9;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_PARAMS_BYTES = 256;
export const SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_MAGIC = 0x5341_4d31;
export const SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_VERSION = 1;
export const SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_HEADER_OFFSET_WORDS = 91;
export const SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_HEADER_WORDS = 21;
export const SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUMMARY_WORDS = 32;
export const SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_PARAMS_BYTES = 128;
export const SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_FLOATS = 8;
export const SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT =
  Object.freeze({
    PACKED_QUERY_V0: 0,
    LEVEL_ASSIGNMENT_V0: 1
  });
export const SCHROEDER_SPATIAL_AGGREGATE_LEVEL_ASSIGNMENT_QUERY_FLOATS = 16;

export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_STATUS_INVALID_SOURCE = 1 << 3;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_STATUS_CAPACITY_OVERFLOW = 1 << 4;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_STATUS_NONFINITE = 1 << 5;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_STATUS_IDENTITY_MISMATCH = 1 << 6;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_STATUS_MALFORMED_TOPOLOGY = 1 << 7;
export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_STATUS_TRAVERSAL_READY = 1 << 8;

export const SCHROEDER_SPATIAL_AGGREGATE_RECORD_STATUS_VALID = 1 << 0;
export const SCHROEDER_SPATIAL_AGGREGATE_RECORD_STATUS_LEAF = 1 << 1;
export const SCHROEDER_SPATIAL_AGGREGATE_RECORD_STATUS_INTERNAL = 1 << 2;
export const SCHROEDER_SPATIAL_AGGREGATE_RECORD_STATUS_CHUNK =
  SCHROEDER_SPATIAL_AGGREGATE_RECORD_STATUS_INTERNAL;
export const SCHROEDER_SPATIAL_AGGREGATE_RECORD_STATUS_ROOT = 1 << 3;
export const SCHROEDER_SPATIAL_AGGREGATE_RECORD_STATUS_MIXED_MATERIAL = 1 << 4;
export const SCHROEDER_SPATIAL_AGGREGATE_RECORD_STATUS_MIXED_PHASE = 1 << 5;
export const SCHROEDER_SPATIAL_AGGREGATE_RECORD_STATUS_TOPOLOGY_AUTHENTICATED =
  1 << 6;
export const SCHROEDER_SPATIAL_AGGREGATE_RECORD_STATUS_HOMOGENEOUS_DOMAIN_SUMMARY_EXACT =
  1 << 7;

export const SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_STATUS_IDENTITY_MISMATCH =
  1 << 3;
export const SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_STATUS_TOPOLOGY_MISMATCH =
  1 << 4;
export const SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_STATUS_INCOMPLETE_PARTITION =
  1 << 5;

export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_RECORD_LAYOUT = Object.freeze([
  'massKg:f32',
  'firstMassMomentXKgM:f32',
  'firstMassMomentYKgM:f32',
  'firstMassMomentZKgM:f32',
  'linearMomentumXKgMPerS:f32',
  'linearMomentumYKgMPerS:f32',
  'linearMomentumZKgMPerS:f32',
  'orbitalAngularMomentumXKgM2PerS:f32',
  'orbitalAngularMomentumYKgM2PerS:f32',
  'orbitalAngularMomentumZKgM2PerS:f32',
  'internalEnergyJ:f32',
  'kineticEnergyJ:f32',
  'aabbMinXM:f32',
  'aabbMinYM:f32',
  'aabbMinZM:f32',
  'aabbMaxXM:f32',
  'aabbMaxYM:f32',
  'aabbMaxZM:f32',
  'boundingRadiusM:f32',
  'particleCount:u32',
  'materialBloomMask0:u32',
  'materialBloomMask1:u32',
  'materialBloomMask2:u32',
  'materialBloomMask3:u32',
  'phaseMask:u32',
  'homogeneousMaterialId:u32-or-ffffffff',
  'homogeneousPhaseId:u32-or-ffffffff',
  'recordStatus:u32',
  'prefixKeyChart:u32',
  'prefixKeyLevelOrder:u32',
  'prefixKeyMortonHigh:u32',
  'prefixKeyMortonMiddle:u32',
  'prefixKeyMortonLow:u32',
  'sourceBeginOrLeftChildRecordIndex:u32',
  'sourceEndOrRightChildRecordIndex:u32',
  'sourceCellOrNodeIndex:u32',
  'parentRecordIndex:u32-or-ffffffff',
  'escapeRecordIndex:u32-or-ffffffff',
  'subtreeMortonRankBegin:u32',
  'subtreeMortonRankEnd:u32',
  'prefixBitCount:u32',
  'topologyFingerprint:u32',
  'homogeneousContinuityDomainId:u32-or-ffffffff',
  'sourceMemberCount:u32'
]);

export const SCHROEDER_SPATIAL_AGGREGATE_RECORD_LAYOUT =
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_RECORD_LAYOUT;

export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_HEADER_LAYOUT = Object.freeze([
  'magic:u32',
  'abiVersion:u32',
  'statusFlags:u32',
  'generationId:u32',
  'deviceOrdinal:u32',
  'laneOrdinal:u32',
  'leaseToken:u32',
  'sourceFamilyId:u32',
  'storageGeneration:u32',
  'physicsTick:u32',
  'physicsSubstep:u32',
  'positionEpoch:u32',
  'topologyEpoch:u32',
  'chartEpoch:u32',
  'levelEpoch:u32',
  'supportEpoch:u32',
  'sourceCount:u32',
  'sourceCapacity:u32',
  'cellCount:u32',
  'cellCapacity:u32',
  'recordWords:u32',
  'recordOffsetWords:u32',
  'recordCapacity:u32',
  'leafCount:u32',
  'treeArity:u32',
  'internalOffsetWords:u32',
  'internalCapacity:u32',
  'internalCount:u32',
  'rootOffsetWords:u32',
  'nodeCount:u32',
  'logicalRequiredWords:u32',
  'capacityWords:u32',
  'invalidSourceCount:u32',
  'nonfiniteSourceCount:u32',
  'identityMismatchCount:u32',
  'overflowCount:u32',
  'attemptedSourceCount:u32',
  'reducedSourceCount:u32',
  'reducedLeafCount:u32',
  'reducedInternalCount:u32',
  'completionOrdinal:u32',
  'directoryGenerationId:u32',
  'directoryCompletionOrdinal:u32',
  'sourceRowLayoutId:u32',
  'stateStrideFloats:u32',
  'thermoStrideFloats:u32',
  'identityStrideWords:u32',
  'materialMaskMode:u32',
  'phaseMaskMode:u32',
  'reductionMode:u32',
  'clearedWords:u32',
  'topologyMode:u32',
  'prefixBitCapacity:u32',
  'rootRecordIndex:u32',
  'totalRecordCount:u32',
  'internalRecordCount:u32',
  'topologyFingerprint:u32',
  'traversalStatus:u32',
  'traversalLeafCoverage:u32',
  'malformedTopologyCount:u32',
  'dispatchWords:u32',
  'liveHighWaterWords:u32',
  'replayGuardToken:u32',
  'headerFingerprint:u32',
  ...Array.from({ length: 8 }, (_, index) => `topologyReserved${index}:u32`),
  ...Array.from({ length: 8 }, (_, index) => `topologyCounter${index}:u32`),
  'traversalFirstRecordIndex:u32',
  'traversalEndSentinel:u32',
  'exactNearPartitionMode:u32',
  'openingMode:u32',
  'topologyArity:u32',
  'maxTraversalSteps:u32',
  'sourceAdapterId:u32',
  'directoryCellKeyOffsetWords:u32',
  'directoryCellOffsetOffsetWords:u32',
  'directoryCellMemberOffsetWords:u32',
  'directoryParticleToCellOffsetWords:u32',
  ...Array.from({ length: 21 }, (_, index) => `reserved${91 + index}:u32`)
]);

export const SCHROEDER_SPATIAL_AGGREGATE_VIEW_ABI = Object.freeze({
  schema: ULG_SCHROEDER_SPATIAL_AGGREGATE_VIEW_SCHEMA,
  version: SCHROEDER_SPATIAL_AGGREGATE_VIEW_VERSION,
  headerWords: SCHROEDER_SPATIAL_AGGREGATE_VIEW_HEADER_WORDS,
  recordWords: SCHROEDER_SPATIAL_AGGREGATE_VIEW_RECORD_WORDS,
  keyWords: SCHROEDER_SPATIAL_AGGREGATE_VIEW_MORTON_KEY_WORDS,
  prefixBitCount: SCHROEDER_SPATIAL_AGGREGATE_VIEW_PREFIX_BIT_COUNT,
  treeArity: SCHROEDER_SPATIAL_AGGREGATE_VIEW_TREE_ARITY,
  topologyMode:
    SCHROEDER_SPATIAL_AGGREGATE_VIEW_TOPOLOGY_MODE_MORTON_PREFIX_BINARY,
  headerLayout: SCHROEDER_SPATIAL_AGGREGATE_VIEW_HEADER_LAYOUT,
  recordLayout: SCHROEDER_SPATIAL_AGGREGATE_VIEW_RECORD_LAYOUT,
  sourceAuthority:
    'immutable-ss-spatial-epoch-v1-or-v2-cell-csr-with-exact-active-source-lineage',
  construction:
    'canonical-cell-derived-morton-permutation-compressed-prefix-tree-with-authenticated-ropes',
  complexity:
    'v1:O(sourceCount*keyWords+cellCount*prefixDepth);v2:O(activeCellCount*keyWords+activeSourceCount+activeCellCount*prefixDepth)-no-candidate-rows',
  traversal:
    'stackless-parent-child-escape-rope-opening-with-exact-near-aabb-exclusion',
  partition: 'each-leaf-covered-exactly-once-by-near-or-one-accepted-far-ancestor',
  materialMask:
    '128-bit-one-hash-bloom-no-false-negatives-plus-exact-homogeneous-id',
  phaseMask: 'exact-u32-phase-id-mask',
  overflowPolicy: 'fail-closed-zero-indirect-dispatch',
  readbackPolicy: 'explicit-probe-only',
  submissionOwnership: 'caller',
  materializedCandidateRows: false,
  perSourceCandidateBudget: null
});

export const SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_HEADER_LAYOUT =
  Object.freeze([
    'magic:u32',
    'abiVersion:u32',
    'statusFlags:u32',
    'memberOffsetWords:u32',
    'memberCapacity:u32',
    'activeMemberCount:u32',
    'sourceCount:u32',
    'cellCount:u32',
    'generationId:u32',
    'completionOrdinal:u32',
    'replayGuardToken:u32',
    'sourceAdapterId:u32',
    'directoryCellMemberOffsetWords:u32',
    'reducedCellCount:u32',
    'invalidMemberCount:u32',
    'constructionMode:u32',
    'physicalCapacityWords:u32',
    'sourceRowLayoutId:u32',
    'storageGeneration:u32',
    'projectionFingerprint:u32',
    'reserved:u32'
  ]);

export const SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_ABI = Object.freeze({
  schema: ULG_SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_SCHEMA,
  version: SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_VERSION,
  magic: SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_MAGIC,
  headerOffsetWords:
    SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_HEADER_OFFSET_WORDS,
  headerWords: SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_HEADER_WORDS,
  headerLayout: SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_HEADER_LAYOUT,
  construction:
    'canonical-cell-original-range-prefix-compaction-by-mechanically-active-source',
  memberOrdering: 'canonical-directory-order-within-each-cell',
  cellRangeAuthority: 'aggregate-leaf-particle-count-and-directory-member-begin',
  overflowPolicy: 'fail-closed-with-parent-aggregate-view',
  readbackPolicy: 'explicit-probe-only'
});

const UINT32_MAX = 0xffff_ffff;

function integer(value, label, min = 0, max = UINT32_MAX) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer in [${min}, ${max}]`);
  }
  return number;
}

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite`);
  return number;
}

function nonnegativeFinite(value, label) {
  const number = finite(value, label);
  if (number < 0) throw new RangeError(`${label} must be nonnegative`);
  return number;
}

function checkedAdd(left, right, label) {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result > UINT32_MAX) {
    throw new RangeError(`${label} exceeds the u32 word range`);
  }
  return result;
}

function checkedMultiply(left, right, label) {
  const result = left * right;
  if (!Number.isSafeInteger(result) || result > UINT32_MAX) {
    throw new RangeError(`${label} exceeds the u32 word range`);
  }
  return result;
}

function mixU32(value) {
  let result = value >>> 0;
  result = Math.imul(result ^ (result >>> 16), 0x7feb352d) >>> 0;
  result = Math.imul(result ^ (result >>> 15), 0x846ca68b) >>> 0;
  return (result ^ (result >>> 16)) >>> 0;
}

function foldFingerprint(seed, value) {
  return mixU32((seed ^ mixU32(value >>> 0)) >>> 0);
}

export function createSchroederSpatialAggregatePrefixShape(leafCount) {
  const leaves = integer(leafCount, 'leafCount', 1);
  const internalRecordCount = leaves - 1;
  const recordCount = checkedAdd(
    leaves,
    internalRecordCount,
    'aggregate prefix-tree record count'
  );
  return Object.freeze({
    treeArity: SCHROEDER_SPATIAL_AGGREGATE_VIEW_TREE_ARITY,
    mortonKeyWords: SCHROEDER_SPATIAL_AGGREGATE_VIEW_MORTON_KEY_WORDS,
    prefixBitCount: SCHROEDER_SPATIAL_AGGREGATE_VIEW_PREFIX_BIT_COUNT,
    topologyMode:
      SCHROEDER_SPATIAL_AGGREGATE_VIEW_TOPOLOGY_MODE_MORTON_PREFIX_BINARY,
    leafCount: leaves,
    internalRecordCount,
    recordCount,
    rootRecordIndex: leaves === 1 ? 0 : leaves,
    maxTraversalSteps: recordCount
  });
}

export function createSchroederSpatialAggregateViewLayout({ cellCapacity } = {}) {
  const leafCapacity = integer(cellCapacity, 'cellCapacity', 1);
  const capacityShape = createSchroederSpatialAggregatePrefixShape(leafCapacity);
  const recordCapacityWords = checkedMultiply(
    capacityShape.recordCount,
    SCHROEDER_SPATIAL_AGGREGATE_VIEW_RECORD_WORDS,
    'aggregate record words'
  );
  const wordLength = checkedAdd(
    SCHROEDER_SPATIAL_AGGREGATE_VIEW_HEADER_WORDS,
    recordCapacityWords,
    'aggregate view words'
  );
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_AGGREGATE_VIEW_SCHEMA,
    headerWords: SCHROEDER_SPATIAL_AGGREGATE_VIEW_HEADER_WORDS,
    recordWords: SCHROEDER_SPATIAL_AGGREGATE_VIEW_RECORD_WORDS,
    recordOffsetWords: SCHROEDER_SPATIAL_AGGREGATE_VIEW_HEADER_WORDS,
    leafOffsetWords: SCHROEDER_SPATIAL_AGGREGATE_VIEW_HEADER_WORDS,
    leafCapacity,
    treeArity: SCHROEDER_SPATIAL_AGGREGATE_VIEW_TREE_ARITY,
    mortonKeyWords: SCHROEDER_SPATIAL_AGGREGATE_VIEW_MORTON_KEY_WORDS,
    prefixBitCount: SCHROEDER_SPATIAL_AGGREGATE_VIEW_PREFIX_BIT_COUNT,
    topologyMode:
      SCHROEDER_SPATIAL_AGGREGATE_VIEW_TOPOLOGY_MODE_MORTON_PREFIX_BINARY,
    internalCapacity: capacityShape.internalRecordCount,
    maxRecordCount: capacityShape.recordCount,
    wordLength,
    byteLength: wordLength * Uint32Array.BYTES_PER_ELEMENT,
    dispatchWordLength: SCHROEDER_SPATIAL_AGGREGATE_VIEW_DISPATCH_WORDS,
    dispatchByteLength:
      SCHROEDER_SPATIAL_AGGREGATE_VIEW_DISPATCH_WORDS * Uint32Array.BYTES_PER_ELEMENT,
    leafDispatchOffsetWords:
      SCHROEDER_SPATIAL_AGGREGATE_VIEW_LEAF_DISPATCH_OFFSET_WORDS,
    internalDispatchOffsetWords:
      SCHROEDER_SPATIAL_AGGREGATE_VIEW_INTERNAL_DISPATCH_OFFSET_WORDS,
    authDispatchOffsetWords:
      SCHROEDER_SPATIAL_AGGREGATE_VIEW_AUTH_DISPATCH_SLOT * 3
  });
}

export function schroederSpatialAggregateDispatchOffsetBytes(slotIndex) {
  const slot = integer(slotIndex, 'slotIndex', 0, 2);
  return slot * 3 * Uint32Array.BYTES_PER_ELEMENT;
}

export function createSchroederSpatialAggregateViewPlan({
  sourceCount,
  sourceCapacity,
  cellCapacity = sourceCapacity,
  sourceRowLayoutId,
  generationId,
  deviceOrdinal,
  laneOrdinal,
  leaseToken,
  sourceFamilyId,
  storageGeneration,
  physicsTick,
  physicsSubstep,
  positionEpoch,
  topologyEpoch,
  chartEpoch,
  levelEpoch,
  supportEpoch,
  completionOrdinal = generationId,
  stateStrideFloats = 8,
  thermoStrideFloats = 12,
  identityStrideWords = 1
} = {}) {
  const resolvedSourceCapacity = integer(sourceCapacity, 'sourceCapacity', 1);
  const resolvedSourceCount = integer(
    sourceCount,
    'sourceCount',
    1,
    resolvedSourceCapacity
  );
  const layout = createSchroederSpatialAggregateViewLayout({ cellCapacity });
  if (layout.leafCapacity > resolvedSourceCapacity) {
    throw new RangeError('cellCapacity must not exceed sourceCapacity');
  }
  const activeMemberOffsetWords = layout.wordLength;
  const physicalWordLength = checkedAdd(
    activeMemberOffsetWords,
    resolvedSourceCapacity,
    'aggregate view physical words'
  );
  const identity = Object.fromEntries([
    ['generationId', generationId, true],
    ['deviceOrdinal', deviceOrdinal, false],
    ['laneOrdinal', laneOrdinal, false],
    ['leaseToken', leaseToken, false],
    ['sourceFamilyId', sourceFamilyId, false],
    ['storageGeneration', storageGeneration, true],
    ['physicsTick', physicsTick, false],
    ['physicsSubstep', physicsSubstep, false],
    ['positionEpoch', positionEpoch, false],
    ['topologyEpoch', topologyEpoch, false],
    ['chartEpoch', chartEpoch, false],
    ['levelEpoch', levelEpoch, false],
    ['supportEpoch', supportEpoch, false],
    ['completionOrdinal', completionOrdinal, true]
  ].map(([label, value, positive]) => [
    label,
    integer(value, label, positive ? 1 : 0)
  ]));
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_AGGREGATE_VIEW_SCHEMA,
    status: 'schroeder-spatial-aggregate-view-plan-ready',
    ...identity,
    sourceCount: resolvedSourceCount,
    sourceCapacity: resolvedSourceCapacity,
    cellCapacity: layout.leafCapacity,
    sourceRowLayoutId: integer(sourceRowLayoutId, 'sourceRowLayoutId', 1, 2),
    sourceRowStrideFloats: 16,
    topologyMode:
      SCHROEDER_SPATIAL_AGGREGATE_VIEW_TOPOLOGY_MODE_MORTON_PREFIX_BINARY,
    stateStrideFloats: integer(stateStrideFloats, 'stateStrideFloats', 8, 64),
    thermoStrideFloats: integer(thermoStrideFloats, 'thermoStrideFloats', 12, 64),
    identityStrideWords: integer(identityStrideWords, 'identityStrideWords', 1, 16),
    layout,
    requiredCapacityWords: layout.wordLength,
    requiredCapacityBytes: layout.byteLength,
    physicalWordLength,
    physicalByteLength: physicalWordLength * Uint32Array.BYTES_PER_ELEMENT,
    activeMemberProjection: Object.freeze({
      schema: ULG_SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_SCHEMA,
      headerOffsetWords:
        SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_HEADER_OFFSET_WORDS,
      headerWords: SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_HEADER_WORDS,
      memberOffsetWords: activeMemberOffsetWords,
      memberCapacity: resolvedSourceCapacity,
      physicalWordLength,
      constructionMode: 1
    }),
    fullParticleReadbackRequired: false,
    constructionComplexity: 'O(sourceCount*keyWords+cellCount*prefixDepth)',
    traversalComplexity: 'O(visitedPrefixNodes)',
    contributionRowCapacity: 0,
    materializedCandidateRows: false,
    perSourceCandidateBudget: null
  });
}

export function validateSchroederSpatialAggregateViewDescriptor(view, expected = {}) {
  if (!view || view.schema !== ULG_SCHROEDER_SPATIAL_AGGREGATE_VIEW_SCHEMA) {
    return { admitted: false, status: 'schroeder-spatial-aggregate-view-rejected-schema' };
  }
  for (const field of [
    'generationId',
    'deviceOrdinal',
    'laneOrdinal',
    'leaseToken',
    'sourceFamilyId',
    'storageGeneration',
    'physicsTick',
    'physicsSubstep',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch',
    'levelEpoch',
    'supportEpoch',
    'completionOrdinal',
    'sourceCount',
    'sourceCapacity',
    'cellCapacity',
    'sourceRowLayoutId',
    'directoryAbiVersion'
  ]) {
    if (Object.hasOwn(expected, field) && !Object.is(view[field], expected[field])) {
      return {
        admitted: false,
        status: `schroeder-spatial-aggregate-view-rejected-${field}`,
        field,
        expected: expected[field],
        actual: view[field]
      };
    }
  }
  if (
    view.status !== 'schroeder-spatial-aggregate-view-gpu-build-submitted'
    || view.submitPerformed !== true
    || view.released === true
    || !view.aggregateViewBuffer
    || view.activeMemberProjectionBuffer !== view.aggregateViewBuffer
    || !view.indirectDispatchBuffer
    || !view.mortonKeyBuffer
    || !view.mortonSortedIndicesBuffer
    || view.indirectDispatchBuffer === view.aggregateViewBuffer
    || view.mortonKeyBuffer === view.aggregateViewBuffer
    || view.mortonSortedIndicesBuffer === view.aggregateViewBuffer
    || view.leafIndirectDispatchOffsetBytes
      !== schroederSpatialAggregateDispatchOffsetBytes(
        SCHROEDER_SPATIAL_AGGREGATE_VIEW_CELL_DISPATCH_SLOT
      )
    || view.internalIndirectDispatchOffsetBytes
      !== schroederSpatialAggregateDispatchOffsetBytes(
        SCHROEDER_SPATIAL_AGGREGATE_VIEW_INTERNAL_DISPATCH_SLOT
      )
    || view.authIndirectDispatchOffsetBytes
      !== SCHROEDER_SPATIAL_AGGREGATE_VIEW_AUTH_DISPATCH_SLOT * 3 * 4
    || view.topologyMode
      !== SCHROEDER_SPATIAL_AGGREGATE_VIEW_TOPOLOGY_MODE_MORTON_PREFIX_BINARY
    || view.mortonKeyWordCount
      !== SCHROEDER_SPATIAL_AGGREGATE_VIEW_MORTON_KEY_WORDS
    || view.mortonPrefixBitCount
      !== SCHROEDER_SPATIAL_AGGREGATE_VIEW_PREFIX_BIT_COUNT
    || view.layout?.recordWords !== SCHROEDER_SPATIAL_AGGREGATE_VIEW_RECORD_WORDS
    || view.layout?.headerWords !== SCHROEDER_SPATIAL_AGGREGATE_VIEW_HEADER_WORDS
    || view.layout?.topologyMode
      !== SCHROEDER_SPATIAL_AGGREGATE_VIEW_TOPOLOGY_MODE_MORTON_PREFIX_BINARY
    || view.activeMemberProjection?.schema
      !== ULG_SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_SCHEMA
    || view.activeMemberProjection?.headerOffsetWords
      !== SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_HEADER_OFFSET_WORDS
    || view.activeMemberProjection?.headerWords
      !== SCHROEDER_SPATIAL_ACTIVE_MEMBER_PROJECTION_HEADER_WORDS
    || view.activeMemberProjection?.memberOffsetWords !== view.layout.wordLength
    || view.activeMemberProjection?.memberCapacity !== view.sourceCapacity
    || view.activeMemberProjection?.physicalWordLength
      !== view.layout.wordLength + view.sourceCapacity
    || view.activeMemberOffsetWords
      !== view.activeMemberProjection.memberOffsetWords
    || view.activeMemberCapacity !== view.activeMemberProjection.memberCapacity
    || view.aggregatePhysicalWordLength
      !== view.activeMemberProjection.physicalWordLength
    || view.aggregatePhysicalByteLength
      !== view.aggregatePhysicalWordLength * Uint32Array.BYTES_PER_ELEMENT
    || (
      Number.isFinite(Number(view.aggregateViewBuffer?.size))
      && Number(view.aggregateViewBuffer.size) < view.aggregatePhysicalByteLength
    )
    || ![1, 2].includes(view.directoryAbiVersion)
    || (
      view.directoryAbiVersion === 2
      && (
        view.sourceWorkIdentity !== 'gpu-active-ordinal'
        || view.aggregateMemberCountSource
          !== 'gpu-directory-active-source-count-word-37'
        || !view.activeSourceView
        || view.activeSourceViewBuffer
          !== view.activeSourceView.activeSourceViewBuffer
        || view.activeSourceCountAuthority
          !== view.spatialExecution?.activeSourceCountAuthority
        || view.activeSourceCountAuthority
          !== view.spatialExecution?.logicalSourceCountAuthority
      )
    )
  ) {
    return {
      admitted: false,
      status: 'schroeder-spatial-aggregate-view-rejected-not-live'
    };
  }
  let ownerAdmitted = false;
  try {
    ownerAdmitted = view.ownerRuntime?.ownsExecution?.(view) === true
      && view.ownerRuntime?.isExecutionSubmitted?.(view) === true;
  } catch {
    ownerAdmitted = false;
  }
  if (!ownerAdmitted) {
    return {
      admitted: false,
      status: 'schroeder-spatial-aggregate-view-rejected-owner'
    };
  }
  return {
    admitted: true,
    status: 'schroeder-spatial-aggregate-view-admitted'
  };
}

export function createSchroederSpatialAggregateTraversalPlan({
  aggregateView,
  queryCount,
  queryCapacity = queryCount,
  queryStrideFloats = SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_FLOATS,
  querySourceLayoutId =
    SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT.PACKED_QUERY_V0,
  nearFieldSupportScale = 1,
  openingTheta = 0.5,
  gravitationalConstant = 6.6743e-11,
  softeningLengthM = 1e-6,
  forceScale = 1
} = {}) {
  const aggregateAdmission = validateSchroederSpatialAggregateViewDescriptor(
    aggregateView
  );
  if (!aggregateAdmission.admitted) {
    throw new TypeError(
      `aggregate traversal requires a live submitted aggregate view: ${aggregateAdmission.status}`
    );
  }
  const capacity = integer(queryCapacity, 'queryCapacity', 1);
  const count = integer(queryCount, 'queryCount', 1, capacity);
  const sourceLayoutId = integer(
    querySourceLayoutId,
    'querySourceLayoutId',
    SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT.PACKED_QUERY_V0,
    SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT.LEVEL_ASSIGNMENT_V0
  );
  const minimumStride = sourceLayoutId
    === SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT
      .LEVEL_ASSIGNMENT_V0
    ? SCHROEDER_SPATIAL_AGGREGATE_LEVEL_ASSIGNMENT_QUERY_FLOATS
    : SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_FLOATS;
  const stride = integer(
    queryStrideFloats,
    'queryStrideFloats',
    minimumStride,
    64
  );
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SCHEMA,
    status: 'schroeder-spatial-aggregate-traversal-plan-ready',
    aggregateView,
    queryCount: count,
    queryCapacity: capacity,
    queryStrideFloats: stride,
    queryStrideBytes: stride * Float32Array.BYTES_PER_ELEMENT,
    querySourceLayoutId: sourceLayoutId,
    querySourceLayout: sourceLayoutId
      === SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT
        .LEVEL_ASSIGNMENT_V0
      ? 'schroeder-level-assignment-v0'
      : 'schroeder-packed-aggregate-query-v0',
    nearFieldSupportScale: nonnegativeFinite(
      nearFieldSupportScale,
      'nearFieldSupportScale'
    ),
    openingTheta: nonnegativeFinite(openingTheta, 'openingTheta'),
    summaryStrideWords: SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUMMARY_WORDS,
    summaryStrideBytes:
      SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUMMARY_WORDS
        * Uint32Array.BYTES_PER_ELEMENT,
    summaryByteLength:
      capacity
        * SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUMMARY_WORDS
        * Uint32Array.BYTES_PER_ELEMENT,
    gravitationalConstant: nonnegativeFinite(
      gravitationalConstant,
      'gravitationalConstant'
    ),
    softeningLengthM: nonnegativeFinite(softeningLengthM, 'softeningLengthM'),
    forceScale: finite(forceScale, 'forceScale'),
    generationId: aggregateView.generationId,
    deviceOrdinal: aggregateView.deviceOrdinal,
    laneOrdinal: aggregateView.laneOrdinal,
    leaseToken: aggregateView.leaseToken,
    sourceFamilyId: aggregateView.sourceFamilyId,
    storageGeneration: aggregateView.storageGeneration,
    physicsTick: aggregateView.physicsTick,
    physicsSubstep: aggregateView.physicsSubstep,
    positionEpoch: aggregateView.positionEpoch,
    topologyEpoch: aggregateView.topologyEpoch,
    chartEpoch: aggregateView.chartEpoch,
    levelEpoch: aggregateView.levelEpoch,
    supportEpoch: aggregateView.supportEpoch,
    completionOrdinal: aggregateView.completionOrdinal,
    materializedCandidateRowCount: 0,
    perSourceCandidateBudget: null,
    fullReadbackPerformed: false
  });
}

export function validateSchroederSpatialAggregateTraversalDescriptor(
  traversal,
  expected = {}
) {
  if (
    !traversal
    || traversal.schema !== ULG_SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SCHEMA
  ) {
    return {
      admitted: false,
      status: 'schroeder-spatial-aggregate-traversal-rejected-schema'
    };
  }
  for (const field of [
    'generationId',
    'storageGeneration',
    'physicsTick',
    'physicsSubstep',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch',
    'levelEpoch',
    'supportEpoch',
    'completionOrdinal',
    'queryCount'
  ]) {
    if (Object.hasOwn(expected, field) && traversal[field] !== expected[field]) {
      return {
        admitted: false,
        status: `schroeder-spatial-aggregate-traversal-rejected-${field}`,
        field,
        expected: expected[field],
        actual: traversal[field]
      };
    }
  }
  let ownerAdmitted = false;
  try {
    ownerAdmitted = traversal.status
        === 'schroeder-spatial-aggregate-traversal-gpu-submitted'
      && traversal.submitPerformed === true
      && traversal.released !== true
      && traversal.ownerRuntime?.ownsExecution?.(traversal) === true
      && traversal.ownerRuntime?.isExecutionSubmitted?.(traversal) === true
      && traversal.aggregateView?.ownerRuntime?.ownsExecution?.(
        traversal.aggregateView
      ) === true;
  } catch {
    ownerAdmitted = false;
  }
  return ownerAdmitted
    ? {
        admitted: true,
        status: 'schroeder-spatial-aggregate-traversal-admitted'
      }
    : {
        admitted: false,
        status: 'schroeder-spatial-aggregate-traversal-rejected-not-live'
      };
}

function materialBloomMask(materialId) {
  const hash = mixU32(materialId);
  const masks = [0, 0, 0, 0];
  masks[(hash >>> 5) & 3] = (1 << (hash & 31)) >>> 0;
  return masks;
}

function emptyAggregate(kind, index, prefixBitCount = 0) {
  return {
    kind,
    index,
    recordIndex: UINT32_MAX,
    prefixBitCount,
    massKg: 0,
    firstMassMomentKgM: [0, 0, 0],
    linearMomentumKgMPerS: [0, 0, 0],
    orbitalAngularMomentumKgM2PerS: [0, 0, 0],
    internalEnergyJ: 0,
    kineticEnergyJ: 0,
    aabbMinM: [Infinity, Infinity, Infinity],
    aabbMaxM: [-Infinity, -Infinity, -Infinity],
    boundingRadiusM: 0,
    particleCount: 0,
    sourceMemberCount: 0,
    materialBloomMask: [0, 0, 0, 0],
    phaseMask: 0,
    homogeneousMaterialId: UINT32_MAX,
    homogeneousPhaseId: UINT32_MAX,
    homogeneousContinuityDomainId: UINT32_MAX,
    cellKey: null,
    sourceBegin: 0,
    sourceEnd: 0,
    childBeginRecordIndex: UINT32_MAX,
    childEndRecordIndex: UINT32_MAX,
    parentRecordIndex: UINT32_MAX,
    escapeRecordIndex: UINT32_MAX,
    subtreeLeafBegin: 0,
    subtreeLeafEnd: 0,
    topologyFingerprint: 0
  };
}

function combineAggregate(target, source) {
  target.sourceMemberCount += source.sourceMemberCount;
  if (source.particleCount === 0) {
    return;
  }
  const wasEmpty = target.particleCount === 0;
  target.massKg += source.massKg;
  for (let axis = 0; axis < 3; axis += 1) {
    target.firstMassMomentKgM[axis] += source.firstMassMomentKgM[axis];
    target.linearMomentumKgMPerS[axis] += source.linearMomentumKgMPerS[axis];
    target.orbitalAngularMomentumKgM2PerS[axis]
      += source.orbitalAngularMomentumKgM2PerS[axis];
    target.aabbMinM[axis] = Math.min(target.aabbMinM[axis], source.aabbMinM[axis]);
    target.aabbMaxM[axis] = Math.max(target.aabbMaxM[axis], source.aabbMaxM[axis]);
  }
  target.internalEnergyJ += source.internalEnergyJ;
  target.kineticEnergyJ += source.kineticEnergyJ;
  target.particleCount += source.particleCount;
  for (let lane = 0; lane < 4; lane += 1) {
    target.materialBloomMask[lane]
      = (target.materialBloomMask[lane] | source.materialBloomMask[lane]) >>> 0;
  }
  target.phaseMask = (target.phaseMask | source.phaseMask) >>> 0;
  if (wasEmpty) {
    target.homogeneousMaterialId = source.homogeneousMaterialId;
    target.homogeneousPhaseId = source.homogeneousPhaseId;
    target.homogeneousContinuityDomainId =
      source.homogeneousContinuityDomainId;
  } else {
    if (target.homogeneousMaterialId !== source.homogeneousMaterialId) {
      target.homogeneousMaterialId = UINT32_MAX;
    }
    if (target.homogeneousPhaseId !== source.homogeneousPhaseId) {
      target.homogeneousPhaseId = UINT32_MAX;
    }
    if (
      target.homogeneousContinuityDomainId
        !== source.homogeneousContinuityDomainId
    ) {
      target.homogeneousContinuityDomainId = UINT32_MAX;
    }
  }
}

function canonicalizeEmptyAggregate(target) {
  target.massKg = 0;
  target.firstMassMomentKgM = [0, 0, 0];
  target.linearMomentumKgMPerS = [0, 0, 0];
  target.orbitalAngularMomentumKgM2PerS = [0, 0, 0];
  target.internalEnergyJ = 0;
  target.kineticEnergyJ = 0;
  target.aabbMinM = [0, 0, 0];
  target.aabbMaxM = [0, 0, 0];
  target.boundingRadiusM = 0;
  target.particleCount = 0;
  target.materialBloomMask = [0, 0, 0, 0];
  target.phaseMask = 0;
  target.homogeneousMaterialId = UINT32_MAX;
  target.homogeneousPhaseId = UINT32_MAX;
  target.homogeneousContinuityDomainId = UINT32_MAX;
  target.centerOfMassM = [0, 0, 0];
  return target;
}

function finalizeRadius(target, children) {
  if (target.particleCount === 0) {
    return canonicalizeEmptyAggregate(target);
  }
  const center = target.firstMassMomentKgM.map(
    (value) => value / target.massKg
  );
  target.centerOfMassM = center;
  let radius = 0;
  for (const child of children) {
    if (child.particleCount === 0) continue;
    const childCenter = child.centerOfMassM
      || child.firstMassMomentKgM.map((value) => value / child.massKg);
    radius = Math.max(
      radius,
      Math.hypot(
        childCenter[0] - center[0],
        childCenter[1] - center[1],
        childCenter[2] - center[2]
      ) + child.boundingRadiusM
    );
  }
  target.boundingRadiusM = radius;
  return target;
}

function topologyFingerprint(record, replayGuardToken) {
  let value = foldFingerprint(replayGuardToken, record.recordIndex);
  value = foldFingerprint(
    value,
    (
      record.kind === 'leaf'
        ? SCHROEDER_SPATIAL_AGGREGATE_RECORD_STATUS_LEAF
        : SCHROEDER_SPATIAL_AGGREGATE_RECORD_STATUS_INTERNAL
    ) | (record.isRoot ? SCHROEDER_SPATIAL_AGGREGATE_RECORD_STATUS_ROOT : 0)
  );
  for (const keyWord of record.mortonKey) {
    value = foldFingerprint(value, keyWord);
  }
  value = foldFingerprint(value, record.parentRecordIndex);
  value = foldFingerprint(value, record.escapeRecordIndex);
  value = foldFingerprint(value, record.subtreeLeafBegin);
  value = foldFingerprint(value, record.subtreeLeafEnd);
  value = foldFingerprint(value, record.prefixBitCount);
  value = foldFingerprint(
    value,
    record.kind === 'leaf' ? record.sourceBegin : record.childBeginRecordIndex
  );
  return foldFingerprint(
    value,
    record.kind === 'leaf' ? record.sourceEnd : record.childEndRecordIndex
  );
}

function globalTopologyFingerprint(records, replayGuardToken) {
  let value = foldFingerprint(
    foldFingerprint(
      replayGuardToken,
      SCHROEDER_SPATIAL_AGGREGATE_VIEW_TOPOLOGY_FINGERPRINT_DOMAIN
    ),
    records.length
  );
  if (value === 0) {
    value = SCHROEDER_SPATIAL_AGGREGATE_VIEW_TOPOLOGY_FINGERPRINT_DOMAIN;
  }
  for (const record of records) {
    value = (value ^ record.topologyFingerprint) >>> 0;
  }
  value = foldFingerprint(
    value,
    SCHROEDER_SPATIAL_AGGREGATE_VIEW_TOPOLOGY_FINGERPRINT_DOMAIN
  );
  if (value === 0) {
    value = SCHROEDER_SPATIAL_AGGREGATE_VIEW_TOPOLOGY_FINGERPRINT_DOMAIN;
  }
  return value;
}

function compareU32Words(left, right) {
  for (let word = 0; word < left.length; word += 1) {
    const difference = (left[word] >>> 0) - (right[word] >>> 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function createSchroederSpatialAggregateMortonKey(cellKey) {
  if ((!Array.isArray(cellKey) && !ArrayBuffer.isView(cellKey)) || cellKey.length !== 5) {
    throw new TypeError('cellKey must contain exact [chart, level, x, y, z] u32 words');
  }
  const key = Array.from(cellKey, (value, word) => integer(value, `cellKey[${word}]`));
  const morton = [0, 0, 0];
  let outputBit = 0;
  for (let sourceBit = 31; sourceBit >= 0; sourceBit -= 1) {
    for (let axis = 2; axis < 5; axis += 1) {
      const word = Math.floor(outputBit / 32);
      const bit = 31 - (outputBit % 32);
      morton[word] = (
        morton[word] | (((key[axis] >>> sourceBit) & 1) << bit)
      ) >>> 0;
      outputBit += 1;
    }
  }
  return Object.freeze([key[0], key[1], ...morton]);
}

function commonPrefixBitCount(sortedEntries, left, right) {
  if (left < 0 || right < 0 || left >= sortedEntries.length || right >= sortedEntries.length) {
    return -1;
  }
  const leftKey = sortedEntries[left].mortonKey;
  const rightKey = sortedEntries[right].mortonKey;
  let count = 0;
  for (let word = 0; word < leftKey.length; word += 1) {
    const difference = (leftKey[word] ^ rightKey[word]) >>> 0;
    if (difference !== 0) return count + Math.clz32(difference);
    count += 32;
  }
  return SCHROEDER_SPATIAL_AGGREGATE_VIEW_PREFIX_BIT_COUNT;
}

function buildPrefixTopology(leaves) {
  const shape = createSchroederSpatialAggregatePrefixShape(leaves.length);
  const sortedEntries = leaves.map((leaf) => ({
    canonicalCellIndex: leaf.recordIndex,
    mortonKey: createSchroederSpatialAggregateMortonKey(leaf.cellKey)
  })).sort((left, right) => (
    compareU32Words(left.mortonKey, right.mortonKey)
      || left.canonicalCellIndex - right.canonicalCellIndex
  ));
  for (let rank = 1; rank < sortedEntries.length; rank += 1) {
    if (compareU32Words(sortedEntries[rank - 1].mortonKey, sortedEntries[rank].mortonKey) >= 0) {
      throw new RangeError('canonical cells must map to unique Morton-prefix keys');
    }
  }
  const records = Array(shape.recordCount);
  for (let rank = 0; rank < sortedEntries.length; rank += 1) {
    const entry = sortedEntries[rank];
    const leaf = leaves[entry.canonicalCellIndex];
    leaf.mortonKey = entry.mortonKey;
    leaf.subtreeLeafBegin = rank;
    leaf.subtreeLeafEnd = rank + 1;
    leaf.prefixBitCount = SCHROEDER_SPATIAL_AGGREGATE_VIEW_PREFIX_BIT_COUNT;
    records[leaf.recordIndex] = leaf;
  }
  if (leaves.length === 1) {
    const root = leaves[0];
    root.parentRecordIndex = UINT32_MAX;
    root.escapeRecordIndex = UINT32_MAX;
    root.isRoot = true;
    return { shape, records, sortedEntries, internals: [], root };
  }
  const prefix = (left, right) => commonPrefixBitCount(sortedEntries, left, right);
  const internals = [];
  for (let internalIndex = 0; internalIndex < leaves.length - 1; internalIndex += 1) {
    const direction = prefix(internalIndex, internalIndex + 1)
        - prefix(internalIndex, internalIndex - 1) >= 0
      ? 1
      : -1;
    const minimumPrefix = prefix(internalIndex, internalIndex - direction);
    let maximumLength = 2;
    while (prefix(internalIndex, internalIndex + maximumLength * direction) > minimumPrefix) {
      maximumLength *= 2;
    }
    let length = 0;
    for (let step = Math.floor(maximumLength / 2); step >= 1; step = Math.floor(step / 2)) {
      if (prefix(internalIndex, internalIndex + (length + step) * direction) > minimumPrefix) {
        length += step;
      }
    }
    const otherEnd = internalIndex + length * direction;
    const nodePrefix = prefix(internalIndex, otherEnd);
    let splitOffset = 0;
    let step = length;
    do {
      step = Math.ceil(step / 2);
      if (prefix(internalIndex, internalIndex + (splitOffset + step) * direction) > nodePrefix) {
        splitOffset += step;
      }
    } while (step > 1);
    const split = internalIndex + splitOffset * direction + Math.min(direction, 0);
    const first = Math.min(internalIndex, otherEnd);
    const last = Math.max(internalIndex, otherEnd);
    const leftRecordIndex = split === first
      ? sortedEntries[split].canonicalCellIndex
      : leaves.length + split;
    const rightRecordIndex = split + 1 === last
      ? sortedEntries[split + 1].canonicalCellIndex
      : leaves.length + split + 1;
    const internal = emptyAggregate('internal', internalIndex, nodePrefix);
    internal.recordIndex = leaves.length + internalIndex;
    internal.mortonKey = sortedEntries[first].mortonKey;
    internal.childBeginRecordIndex = leftRecordIndex;
    internal.childEndRecordIndex = rightRecordIndex;
    internal.subtreeLeafBegin = first;
    internal.subtreeLeafEnd = last + 1;
    records[internal.recordIndex] = internal;
    internals.push(internal);
  }
  for (const internal of internals) {
    for (const childIndex of [
      internal.childBeginRecordIndex,
      internal.childEndRecordIndex
    ]) {
      const child = records[childIndex];
      if (!child || child.parentRecordIndex !== UINT32_MAX) {
        throw new Error('Morton-prefix topology assigned a child more than once');
      }
      child.parentRecordIndex = internal.recordIndex;
    }
  }
  const root = records[shape.rootRecordIndex];
  if (
    !root
    || root.parentRecordIndex !== UINT32_MAX
    || root.subtreeLeafBegin !== 0
    || root.subtreeLeafEnd !== leaves.length
  ) {
    throw new Error('Morton-prefix topology did not produce the canonical root');
  }
  root.isRoot = true;
  const stack = [{ record: root, escapeRecordIndex: UINT32_MAX }];
  while (stack.length > 0) {
    const { record, escapeRecordIndex } = stack.pop();
    record.escapeRecordIndex = escapeRecordIndex;
    if (record.kind === 'leaf') continue;
    const left = records[record.childBeginRecordIndex];
    const right = records[record.childEndRecordIndex];
    stack.push({ record: right, escapeRecordIndex });
    stack.push({ record: left, escapeRecordIndex: right.recordIndex });
  }
  return { shape, records, sortedEntries, internals, root };
}

function replayGuardTokenFor({ sourceCount, cellCount, replayIdentity = {} }) {
  let token = foldFingerprint(0x53414731, sourceCount);
  token = foldFingerprint(token, cellCount);
  for (const field of [
    'generationId',
    'storageGeneration',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch',
    'levelEpoch',
    'supportEpoch',
    'completionOrdinal'
  ]) {
    token = foldFingerprint(token, Number(replayIdentity[field] ?? 0) >>> 0);
  }
  return token;
}

/**
 * Deterministic CPU reference for the GPU Morton-prefix hierarchy. Canonical
 * leaf records keep directory indices; a derived Morton permutation supplies
 * spatially coherent subtree ranges without changing exact-near lookup order.
 */
export function reduceSchroederSpatialAggregateCpuOracle({
  cellKeys,
  cellOffsets,
  cellMembers,
  sourceRows = null,
  sourceRowLayoutId = 1,
  sourceStrideFloats = 16,
  sourceCount = null,
  state,
  thermo,
  identity,
  stateStrideFloats = 8,
  thermoStrideFloats = 12,
  identityStrideWords = 1,
  replayIdentity = {}
} = {}) {
  if (!ArrayBuffer.isView(cellKeys) || !ArrayBuffer.isView(cellOffsets)) {
    throw new TypeError('cellKeys and cellOffsets must be typed arrays');
  }
  if (!ArrayBuffer.isView(cellMembers) || !ArrayBuffer.isView(state)) {
    throw new TypeError('cellMembers and state must be typed arrays');
  }
  if (!ArrayBuffer.isView(thermo) || !ArrayBuffer.isView(identity)) {
    throw new TypeError('thermo and identity must be typed arrays');
  }
  const inferredSourceCount = state.length / stateStrideFloats;
  const resolvedSourceCount = sourceCount == null
    ? inferredSourceCount
    : Number(sourceCount);
  if (
    !Number.isInteger(resolvedSourceCount)
    || resolvedSourceCount < 1
    || !Number.isInteger(inferredSourceCount)
    || inferredSourceCount < resolvedSourceCount
    || cellMembers.length !== resolvedSourceCount
    || thermo.length < resolvedSourceCount * thermoStrideFloats
    || identity.length < resolvedSourceCount * identityStrideWords
  ) {
    throw new RangeError('aggregate source authority must exactly cover the declared source count');
  }
  const hasSourceAuthority = sourceRows != null;
  if (hasSourceAuthority && !ArrayBuffer.isView(sourceRows)) {
    throw new TypeError('sourceRows must be a typed array when supplied');
  }
  if (
    hasSourceAuthority
    && (
      !Number.isInteger(sourceRowLayoutId)
      || (sourceRowLayoutId !== 1 && sourceRowLayoutId !== 2)
      || !Number.isInteger(sourceStrideFloats)
      || sourceStrideFloats < 16
      || sourceRows.length < resolvedSourceCount * sourceStrideFloats
    )
  ) {
    throw new RangeError('sourceRows must provide a complete supported 16-float source authority');
  }
  const cellCount = cellOffsets.length - 1;
  if (cellCount < 1 || cellKeys.length < cellCount * 5) {
    throw new RangeError('directory CSR must contain at least one complete cell');
  }
  if (Number(cellOffsets[0]) !== 0 || Number(cellOffsets[cellCount]) !== resolvedSourceCount) {
    throw new RangeError('directory CSR must exactly cover the source-member array');
  }
  for (let cellIndex = 1; cellIndex < cellCount; cellIndex += 1) {
    const previous = Array.from(cellKeys.slice((cellIndex - 1) * 5, cellIndex * 5));
    const current = Array.from(cellKeys.slice(cellIndex * 5, (cellIndex + 1) * 5));
    if (compareU32Words(previous, current) >= 0) {
      throw new RangeError('directory cell keys must be strictly canonical lexicographic u32x5');
    }
  }
  const seenParticles = new Uint8Array(resolvedSourceCount);
  const leaves = [];
  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    const begin = Number(cellOffsets[cellIndex]);
    const end = Number(cellOffsets[cellIndex + 1]);
    if (!Number.isInteger(begin) || !Number.isInteger(end) || begin < 0 || end <= begin) {
      throw new RangeError(`cell ${cellIndex} has an invalid CSR range`);
    }
    const leaf = emptyAggregate('leaf', cellIndex, 0);
    leaf.recordIndex = cellIndex;
    leaf.cellKey = Array.from(cellKeys.slice(cellIndex * 5, cellIndex * 5 + 5));
    leaf.sourceBegin = begin;
    leaf.sourceEnd = end;
    leaf.subtreeLeafBegin = cellIndex;
    leaf.subtreeLeafEnd = cellIndex + 1;
    const points = [];
    for (let cursor = begin; cursor < end; cursor += 1) {
      const particle = Number(cellMembers[cursor]);
      const so = particle * stateStrideFloats;
      const to = particle * thermoStrideFloats;
      const io = particle * identityStrideWords;
      if (
        !Number.isInteger(particle)
        || particle < 0
        || particle >= resolvedSourceCount
        || seenParticles[particle] !== 0
        || so + 7 >= state.length
        || to + 11 >= thermo.length
        || io >= identity.length
      ) {
        throw new RangeError(`cell ${cellIndex} references a replayed or out-of-range source`);
      }
      seenParticles[particle] = 1;
      const position = [state[so], state[so + 1], state[so + 2]].map((value) => (
        finite(value, 'particle position')
      ));
      const mass = finite(state[so + 3], 'particle mass');
      if (mass < 0) {
        throw new RangeError(`particle ${particle} has malformed aggregate mass`);
      }
      let mechanicallyActive = mass > 0;
      let mechanicallyDormant = false;
      if (hasSourceAuthority) {
        const sourceOffset = particle * sourceStrideFloats;
        const sourcePosition = [
          sourceRows[sourceOffset + 12],
          sourceRows[sourceOffset + 13],
          sourceRows[sourceOffset + 14]
        ].map((value) => finite(value, 'source position'));
        if (!sourcePosition.every((value, axis) => Object.is(value, position[axis]))) {
          throw new RangeError(`particle ${particle} source position authority mismatched state`);
        }
        if (sourceRowLayoutId === 1) {
          const mechanicsAuthority = Array.from(
            sourceRows.slice(sourceOffset + 2, sourceOffset + 7),
            (value) => finite(value, 'level-assignment mechanical authority')
          );
          const canonicalDormant = Object.is(mass, 0)
            && mechanicsAuthority.every((value) => Object.is(value, 0));
          const authenticatedActive = mass > 0
            && mechanicsAuthority.every((value) => value >= 0)
            && mechanicsAuthority[2] > 0
            && Object.is(mechanicsAuthority[4], mass);
          mechanicallyActive = authenticatedActive;
          mechanicallyDormant = canonicalDormant;
        } else {
          const sourceParticleIndex = finite(
            sourceRows[sourceOffset + 10],
            'active-node source particle index'
          );
          const supportRadius = finite(
            sourceRows[sourceOffset + 9],
            'active-node support radius'
          );
          mechanicallyActive = mass > 0
            && Number.isInteger(sourceParticleIndex)
            && sourceParticleIndex === particle
            && supportRadius >= 0;
          mechanicallyDormant = false;
        }
        if (!mechanicallyActive && !mechanicallyDormant) {
          throw new RangeError(`particle ${particle} source mechanical authority mismatched state`);
        }
      } else if (mass === 0) {
        throw new RangeError(`particle ${particle} dormant state lacks source mechanical authority`);
      }
      const particleAggregate = emptyAggregate('particle', particle, 0);
      particleAggregate.sourceMemberCount = 1;
      if (mechanicallyDormant) {
        combineAggregate(leaf, particleAggregate);
        continue;
      }
      const velocity = [state[so + 4], state[so + 5], state[so + 6]].map((value) => (
        finite(value, 'particle velocity')
      ));
      const specificInternalEnergy = finite(
        state[so + 7],
        'particle specific internal energy'
      );
      const material = finite(thermo[to], 'particle material id');
      const phase = finite(thermo[to + 1], 'particle phase id');
      const visualRadius = finite(thermo[to + 11], 'particle visual radius');
      const phaseFractions = Array.from(
        thermo.slice(to + 4, to + 8),
        (value) => finite(value, 'particle phase fraction')
      );
      if (
        !mechanicallyActive
        || !Number.isInteger(material)
        || material < 0
        || material > 0x00ff_ffff
        || !Number.isInteger(phase)
        || phase < 0
        || phase > 31
        || visualRadius < 0
        || phaseFractions.some((value) => value < 0 || value > 1)
      ) {
        throw new RangeError(`particle ${particle} has malformed aggregate input`);
      }
      const continuityDomainId = Number(identity[io]) >>> 0;
      const momentum = velocity.map((value) => mass * value);
      const firstMoment = position.map((value) => mass * value);
      const angular = [
        position[1] * momentum[2] - position[2] * momentum[1],
        position[2] * momentum[0] - position[0] * momentum[2],
        position[0] * momentum[1] - position[1] * momentum[0]
      ];
      const internal = mass * specificInternalEnergy;
      const kinetic = 0.5 * mass * velocity.reduce((sum, value) => sum + value * value, 0);
      if (![...momentum, ...firstMoment, ...angular, internal, kinetic].every(Number.isFinite)) {
        throw new RangeError(`particle ${particle} aggregate products overflowed`);
      }
      particleAggregate.aabbMinM = position.map((value) => value - visualRadius);
      particleAggregate.aabbMaxM = position.map((value) => value + visualRadius);
      particleAggregate.boundingRadiusM = visualRadius;
      particleAggregate.centerOfMassM = position;
      particleAggregate.massKg = mass;
      particleAggregate.firstMassMomentKgM = firstMoment;
      particleAggregate.linearMomentumKgMPerS = momentum;
      particleAggregate.orbitalAngularMomentumKgM2PerS = angular;
      particleAggregate.internalEnergyJ = internal;
      particleAggregate.kineticEnergyJ = kinetic;
      particleAggregate.particleCount = 1;
      particleAggregate.materialBloomMask = materialBloomMask(material);
      particleAggregate.phaseMask = (1 << phase) >>> 0;
      particleAggregate.homogeneousMaterialId = material >>> 0;
      particleAggregate.homogeneousPhaseId = phase >>> 0;
      particleAggregate.homogeneousContinuityDomainId = continuityDomainId;
      combineAggregate(leaf, particleAggregate);
      points.push(particleAggregate);
    }
    if (leaf.sourceMemberCount !== end - begin) {
      throw new RangeError(`cell ${cellIndex} did not authenticate every source member`);
    }
    leaves.push(finalizeRadius(leaf, points));
  }
  if (seenParticles.some((value) => value !== 1)) {
    throw new RangeError('directory CSR did not cover every source exactly once');
  }
  const topology = buildPrefixTopology(leaves);
  for (const internal of topology.internals) {
    const children = topology.sortedEntries
      .slice(internal.subtreeLeafBegin, internal.subtreeLeafEnd)
      .map((entry) => leaves[entry.canonicalCellIndex]);
    for (const child of children) combineAggregate(internal, child);
    finalizeRadius(internal, children);
  }
  const replayGuardToken = replayGuardTokenFor({
    sourceCount: resolvedSourceCount,
    cellCount,
    replayIdentity
  });
  if (replayGuardToken === 0) {
    throw new Error('Morton-prefix topology produced an invalid replay guard token');
  }
  for (const record of topology.records) {
    record.topologyFingerprint = topologyFingerprint(record, replayGuardToken);
  }
  const root = topology.root;
  if (
    root.sourceMemberCount !== resolvedSourceCount
    || root.particleCount > root.sourceMemberCount
  ) {
    throw new Error('Morton-prefix topology did not authenticate the declared source count');
  }
  const aggregateTopologyFingerprint = globalTopologyFingerprint(
    topology.records,
    replayGuardToken
  );
  if (aggregateTopologyFingerprint === 0) {
    throw new Error('Morton-prefix topology produced an invalid global fingerprint');
  }
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_AGGREGATE_VIEW_SCHEMA,
    status: 'schroeder-spatial-aggregate-cpu-oracle-ready',
    cellCount,
    sourceCount: resolvedSourceCount,
    activeParticleCount: root.particleCount,
    dormantSourceCount: resolvedSourceCount - root.particleCount,
    shape: topology.shape,
    records: Object.freeze(topology.records),
    leaves: Object.freeze(leaves),
    internals: Object.freeze(topology.internals),
    mortonLeafIndices: Object.freeze(
      topology.sortedEntries.map((entry) => entry.canonicalCellIndex)
    ),
    mortonKeys: Object.freeze(
      topology.sortedEntries.map((entry) => entry.mortonKey)
    ),
    root: Object.freeze(root),
    replayIdentity: Object.freeze({ ...replayIdentity }),
    replayGuardToken,
    topologyFingerprint: aggregateTopologyFingerprint,
    constructionComplexity: 'O(sourceCount*keyWords+cellCount*prefixDepth)',
    contributionRowCount: 0,
    materializedCandidateRowCount: 0
  });
}

function squaredDistanceToAabb(point, min, max) {
  let squared = 0;
  for (let axis = 0; axis < 3; axis += 1) {
    const delta = point[axis] < min[axis]
      ? min[axis] - point[axis]
      : point[axis] > max[axis]
        ? point[axis] - max[axis]
        : 0;
    squared += delta * delta;
  }
  return squared;
}

function aggregateNodeSize(record) {
  return Math.max(
    record.aabbMaxM[0] - record.aabbMinM[0],
    record.aabbMaxM[1] - record.aabbMinM[1],
    record.aabbMaxM[2] - record.aabbMinM[2],
    record.boundingRadiusM * 2
  );
}

function aggregateRecordPayloadIsCanonical(record) {
  const finiteVectors = [
    record.firstMassMomentKgM,
    record.linearMomentumKgMPerS,
    record.orbitalAngularMomentumKgM2PerS,
    record.aabbMinM,
    record.aabbMaxM,
    record.centerOfMassM
  ];
  if (
    !Number.isInteger(record.sourceMemberCount)
    || record.sourceMemberCount <= 0
    || !Number.isInteger(record.particleCount)
    || record.particleCount < 0
    || record.particleCount > record.sourceMemberCount
    || !Number.isFinite(record.massKg)
    || !Number.isFinite(record.internalEnergyJ)
    || !Number.isFinite(record.kineticEnergyJ)
    || !Number.isFinite(record.boundingRadiusM)
    || record.boundingRadiusM < 0
    || finiteVectors.some((vector) => (
      !Array.isArray(vector)
      || vector.length !== 3
      || vector.some((value) => !Number.isFinite(value))
    ))
    || record.aabbMinM.some((value, axis) => value > record.aabbMaxM[axis])
  ) {
    return false;
  }
  const physicalScalars = [
    record.massKg,
    record.internalEnergyJ,
    record.kineticEnergyJ,
    record.boundingRadiusM
  ];
  const physicalVectors = [
    record.firstMassMomentKgM,
    record.linearMomentumKgMPerS,
    record.orbitalAngularMomentumKgM2PerS
  ];
  if (record.particleCount === 0) {
    return physicalScalars.every((value) => Object.is(value, 0))
      && physicalVectors.every((vector) => vector.every((value) => Object.is(value, 0)))
      && record.aabbMinM.every((value) => Object.is(value, 0))
      && record.aabbMaxM.every((value) => Object.is(value, 0))
      && record.centerOfMassM.every((value) => Object.is(value, 0))
      && record.materialBloomMask.every((value) => value === 0)
      && record.phaseMask === 0
      && record.homogeneousMaterialId === UINT32_MAX
      && record.homogeneousPhaseId === UINT32_MAX
      && record.homogeneousContinuityDomainId === UINT32_MAX;
  }
  return record.massKg > 0
    && record.internalEnergyJ >= 0
    && record.kineticEnergyJ >= 0
    && record.materialBloomMask.some((value) => value !== 0)
    && record.phaseMask !== 0;
}

function assertTraversalTopology(aggregate, expected = {}) {
  if (
    aggregate?.schema !== ULG_SCHROEDER_SPATIAL_AGGREGATE_VIEW_SCHEMA
    || aggregate?.status !== 'schroeder-spatial-aggregate-cpu-oracle-ready'
    || !Array.isArray(aggregate.records)
    || aggregate.records.length !== aggregate.shape?.recordCount
  ) {
    throw new TypeError('aggregate traversal requires an exact CPU aggregate oracle');
  }
  for (const field of ['replayGuardToken', 'topologyFingerprint']) {
    if (Object.hasOwn(expected, field) && expected[field] !== aggregate[field]) {
      throw new Error(`aggregate traversal rejected replayed ${field}`);
    }
  }
  const root = aggregate.records[aggregate.shape.rootRecordIndex];
  if (
    !root
    || root.parentRecordIndex !== UINT32_MAX
    || root.escapeRecordIndex !== UINT32_MAX
    || root.subtreeLeafBegin !== 0
    || root.subtreeLeafEnd !== aggregate.leaves.length
  ) {
    throw new Error('aggregate traversal rejected malformed topology authority');
  }
  const sortedEntries = aggregate.mortonKeys.map((mortonKey, mortonRank) => ({
    mortonKey,
    canonicalCellIndex: aggregate.mortonLeafIndices[mortonRank]
  }));
  if (
    aggregate.topologyFingerprint === 0
    || aggregate.topologyFingerprint !== globalTopologyFingerprint(
      aggregate.records,
      aggregate.replayGuardToken
    )
  ) {
    throw new Error('aggregate traversal rejected malformed topology authority');
  }
  for (const record of aggregate.records) {
    const expectedMortonKey = sortedEntries[record.subtreeLeafBegin]?.mortonKey;
    let valid = !(
      record.topologyFingerprint
        !== topologyFingerprint(record, aggregate.replayGuardToken)
      || record.recordIndex < 0
      || record.recordIndex >= aggregate.records.length
      || record.subtreeLeafBegin >= record.subtreeLeafEnd
      || record.subtreeLeafEnd > aggregate.leaves.length
      || record.prefixBitCount < 0
      || record.prefixBitCount > SCHROEDER_SPATIAL_AGGREGATE_VIEW_PREFIX_BIT_COUNT
      || !aggregateRecordPayloadIsCanonical(record)
      || !expectedMortonKey
      || compareU32Words(record.mortonKey, expectedMortonKey) !== 0
    );
    if (valid && record !== root) {
      const parent = aggregate.records[record.parentRecordIndex];
      valid = Boolean(parent && (
        parent.childBeginRecordIndex === record.recordIndex
        || parent.childEndRecordIndex === record.recordIndex
      ));
      if (valid) {
        const expectedEscape = parent.childBeginRecordIndex === record.recordIndex
          ? parent.childEndRecordIndex
          : parent.escapeRecordIndex;
        valid = record.escapeRecordIndex === expectedEscape;
      }
    }
    if (valid && record.kind === 'leaf') {
      valid = record.subtreeLeafEnd === record.subtreeLeafBegin + 1
        && record.prefixBitCount === SCHROEDER_SPATIAL_AGGREGATE_VIEW_PREFIX_BIT_COUNT
        && record.sourceMemberCount === record.sourceEnd - record.sourceBegin
        && aggregate.mortonLeafIndices[record.subtreeLeafBegin] === record.recordIndex;
    } else if (valid) {
      const left = aggregate.records[record.childBeginRecordIndex];
      const right = aggregate.records[record.childEndRecordIndex];
      valid = Boolean(
        left
        && right
        && left.parentRecordIndex === record.recordIndex
        && right.parentRecordIndex === record.recordIndex
        && left.subtreeLeafBegin === record.subtreeLeafBegin
        && left.subtreeLeafEnd === right.subtreeLeafBegin
        && right.subtreeLeafEnd === record.subtreeLeafEnd
        && record.sourceMemberCount
          === left.sourceMemberCount + right.sourceMemberCount
        && record.particleCount === left.particleCount + right.particleCount
        && record.prefixBitCount === commonPrefixBitCount(
          sortedEntries,
          record.subtreeLeafBegin,
          record.subtreeLeafEnd - 1
        )
      );
    }
    if (!valid) {
      throw new Error('aggregate traversal rejected malformed topology authority');
    }
  }
  if (
    root.sourceMemberCount !== aggregate.sourceCount
    || root.particleCount !== aggregate.activeParticleCount
    || aggregate.dormantSourceCount
      !== aggregate.sourceCount - aggregate.activeParticleCount
  ) {
    throw new Error('aggregate traversal rejected malformed source-member authority');
  }
}

/**
 * Stackless reference traversal. An AABB intersecting exact-near support is
 * never accepted as far. Accepted far subtrees and near leaves therefore form
 * one exact, non-overlapping partition of the leaf set.
 */
export function traverseSchroederSpatialAggregateCpuOracle({
  aggregate,
  queryPositionM,
  nearFieldRadiusM,
  openingTheta,
  expected = {}
} = {}) {
  assertTraversalTopology(aggregate, expected);
  if (!Array.isArray(queryPositionM) && !ArrayBuffer.isView(queryPositionM)) {
    throw new TypeError('queryPositionM must be an array-like vec3');
  }
  const query = Array.from(queryPositionM, (value) => finite(value, 'query position'));
  if (query.length !== 3) throw new RangeError('queryPositionM must have three values');
  const nearRadius = nonnegativeFinite(nearFieldRadiusM, 'nearFieldRadiusM');
  const theta = nonnegativeFinite(openingTheta, 'openingTheta');
  const farNodes = [];
  const nearLeaves = [];
  const emptyNodes = [];
  const decisions = [];
  let recordIndex = aggregate.shape.rootRecordIndex;
  let stepCount = 0;
  while (recordIndex !== UINT32_MAX) {
    if (stepCount >= aggregate.shape.maxTraversalSteps) {
      throw new Error('aggregate traversal exceeded authenticated node count');
    }
    stepCount += 1;
    const record = aggregate.records[recordIndex];
    if (!record || record.recordIndex !== recordIndex) {
      throw new Error('aggregate traversal followed a malformed record link');
    }
    if (record.particleCount === 0) {
      emptyNodes.push(record);
      decisions.push({
        recordIndex,
        decision: 'empty-subtree',
        nearIntersects: false,
        openingRatio: 0
      });
      recordIndex = record.escapeRecordIndex;
      continue;
    }
    const nearIntersects = squaredDistanceToAabb(
      query,
      record.aabbMinM,
      record.aabbMaxM
    ) <= nearRadius * nearRadius;
    const distance = Math.max(
      Math.hypot(
        record.centerOfMassM[0] - query[0],
        record.centerOfMassM[1] - query[1],
        record.centerOfMassM[2] - query[2]
      ),
      Number.EPSILON
    );
    const nodeSizeM = aggregateNodeSize(record);
    const openingRatio = nodeSizeM / distance;
    if (record.kind === 'leaf') {
      if (nearIntersects) nearLeaves.push(record);
      else farNodes.push(record);
      decisions.push({
        recordIndex,
        decision: nearIntersects ? 'near-leaf' : 'far-leaf',
        nearIntersects,
        openingRatio
      });
      recordIndex = record.escapeRecordIndex;
      continue;
    }
    const acceptFar = !nearIntersects && openingRatio <= theta;
    decisions.push({
      recordIndex,
      decision: acceptFar ? 'far-aggregate' : 'open',
      nearIntersects,
      openingRatio
    });
    if (acceptFar) farNodes.push(record);
    recordIndex = acceptFar
      ? record.escapeRecordIndex
      : record.childBeginRecordIndex;
    if (!acceptFar && (
      recordIndex === UINT32_MAX
      || recordIndex >= aggregate.records.length
    )) {
      throw new Error('aggregate traversal opened a malformed child range');
    }
  }
  const coverage = [
    ...nearLeaves.map((leaf) => ({
      begin: leaf.subtreeLeafBegin,
      end: leaf.subtreeLeafEnd,
      kind: 'near'
    })),
    ...farNodes.map((node) => ({
      begin: node.subtreeLeafBegin,
      end: node.subtreeLeafEnd,
      kind: 'far'
    })),
    ...emptyNodes.map((node) => ({
      begin: node.subtreeLeafBegin,
      end: node.subtreeLeafEnd,
      kind: 'empty'
    }))
  ].sort((left, right) => left.begin - right.begin);
  let cursor = 0;
  for (const span of coverage) {
    if (span.begin !== cursor || span.end <= span.begin) {
      throw new Error('aggregate traversal produced overlapping or incomplete near/far coverage');
    }
    cursor = span.end;
  }
  if (cursor !== aggregate.leaves.length) {
    throw new Error(
      `aggregate traversal covered ${cursor} of ${aggregate.leaves.length} leaves`
    );
  }
  const sum = (records) => {
    const result = emptyAggregate('partition', 0, 0);
    for (const record of records) combineAggregate(result, record);
    return finalizeRadius(result, records);
  };
  const farAggregate = sum(farNodes);
  const nearAggregate = sum(nearLeaves);
  const emptyPartition = sum(emptyNodes);
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SCHEMA,
    status: 'schroeder-spatial-aggregate-traversal-cpu-oracle-ready',
    admitted: true,
    queryPositionM: Object.freeze(query),
    nearFieldRadiusM: nearRadius,
    openingTheta: theta,
    visitedNodeCount: stepCount,
    farNodes: Object.freeze(farNodes),
    nearLeaves: Object.freeze(nearLeaves),
    emptyNodes: Object.freeze(emptyNodes),
    decisions: Object.freeze(decisions),
    coverage: Object.freeze(coverage),
    coveredLeafCount: cursor,
    farAggregate: Object.freeze(farAggregate),
    nearAggregate: Object.freeze(nearAggregate),
    emptyAggregate: Object.freeze(emptyPartition),
    materializedCandidateRowCount: 0,
    perSourceCandidateBudget: null,
    partitionStatus: 'exact-no-overlap-no-gap'
  });
}
