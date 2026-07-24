export const ULG_SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_SCHEMA =
  'peercompute.ulg.schroeder-spatial-active-rank-view.v1';

export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAGIC = 0x5352_5631;
export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_VERSION = 1;
export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_WORDS = 64;
export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_WORKGROUP_SIZE = 256;
export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_CONSUMER_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT = 8192;
export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_RANKS_PER_LANE = 32;
export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_DISPATCH_OFFSET_WORDS = 44;
export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_DISPATCH_WORDS = 3;

export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_INVALID_SOURCE = 1 << 3;
export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_CAPACITY_OVERFLOW = 1 << 4;
export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_UNSUPPORTED_SOURCE = 1 << 5;
export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_IDENTITY_MISMATCH = 1 << 6;
export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_NONFINITE = 1 << 7;

export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_LAYOUT = Object.freeze([
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
  'headerWords:u32',
  'rankPrefixOffsetWords:u32',
  'rankPrefixCapacity:u32',
  'activeRanksOffsetWords:u32',
  'activeRankCapacity:u32',
  'physicalCapacityWords:u32',
  'activeRankCount:u32',
  'dormantRankCount:u32',
  'invalidSourceCount:u32',
  'sourceRowLayoutId:u32',
  'sourceAdapterId:u32',
  'directoryCellMembersOffsetWords:u32',
  'directoryCompletionOrdinal:u32',
  'completionOrdinal:u32',
  'buildOrdinal:u32',
  'consumerWorkgroupSize:u32',
  'dispatchOffsetWords:u32',
  'dispatchWords:u32',
  'directoryCapacityWords:u32',
  'directoryPhysicalHighWaterWords:u32',
  'replayGuardToken:u32',
  'headerFingerprint:u32',
  'maxSupportedSourceCount:u32',
  'ranksPerLane:u32',
  'dispatchX:u32',
  'dispatchY:u32',
  'dispatchZ:u32',
  'clearedWords:u32',
  'physicalHighWaterWords:u32',
  'activeSourceIndicesOffsetWords:u32',
  'activeSourceIndexCapacity:u32',
  ...Array.from({ length: 13 }, (_, index) => `reserved${index}:u32`)
]);

const UINT32_MAX = 0xffff_ffff;

function positiveInteger(value, label, max = UINT32_MAX) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new RangeError(`${label} must be an integer in [1, ${max}]`);
  }
  return number;
}

function checkedAdd(left, right, label) {
  const value = left + right;
  if (!Number.isSafeInteger(value) || value > UINT32_MAX) {
    throw new RangeError(`${label} exceeds the u32-addressable range`);
  }
  return value;
}

export function createSchroederSpatialActiveRankViewLayout({
  sourceCapacity
} = {}) {
  const resolvedSourceCapacity = positiveInteger(
    sourceCapacity,
    'sourceCapacity',
    SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT
  );
  const rankPrefixOffsetWords = SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_WORDS;
  const rankPrefixCapacity = checkedAdd(
    resolvedSourceCapacity,
    1,
    'active-rank prefix capacity'
  );
  const activeRanksOffsetWords = checkedAdd(
    rankPrefixOffsetWords,
    rankPrefixCapacity,
    'active-rank list offset'
  );
  const activeSourceIndicesOffsetWords = checkedAdd(
    activeRanksOffsetWords,
    resolvedSourceCapacity,
    'active-source-index list offset'
  );
  const wordLength = checkedAdd(
    activeSourceIndicesOffsetWords,
    resolvedSourceCapacity,
    'active-rank view word length'
  );
  const byteLength = wordLength * Uint32Array.BYTES_PER_ELEMENT;
  if (!Number.isSafeInteger(byteLength)) {
    throw new RangeError('active-rank view byte length exceeds the safe integer range');
  }
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_SCHEMA,
    version: SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_VERSION,
    headerWords: SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_WORDS,
    sourceCapacity: resolvedSourceCapacity,
    rankPrefixOffsetWords,
    rankPrefixCapacity,
    activeRanksOffsetWords,
    activeRankCapacity: resolvedSourceCapacity,
    activeSourceIndicesOffsetWords,
    activeSourceIndexCapacity: resolvedSourceCapacity,
    dispatchOffsetWords: SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_DISPATCH_OFFSET_WORDS,
    dispatchOffsetBytes:
      SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_DISPATCH_OFFSET_WORDS
      * Uint32Array.BYTES_PER_ELEMENT,
    dispatchWords: SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_DISPATCH_WORDS,
    wordLength,
    byteLength
  });
}

export const SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_ABI = Object.freeze({
  schema: ULG_SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_SCHEMA,
  version: SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_VERSION,
  magic: SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAGIC,
  headerWords: SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_WORDS,
  headerLayout: SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_LAYOUT,
  producerWorkgroupSize: SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_WORKGROUP_SIZE,
  consumerWorkgroupSize: SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_CONSUMER_WORKGROUP_SIZE,
  maxSourceCount: SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT,
  construction:
    'one-workgroup-stable-canonical-rank-scan-owned-by-the-base-spatial-epoch-arena',
  rankPrefix:
    'exclusive-active-count-before-canonical-directory-rank-with-terminal-total',
  activeRanks:
    'strictly-increasing-canonical-directory-ranks-for-currently-active-source-rows',
  activeSourceIndices:
    'source-index partner captured once with each active canonical rank by the epoch producer',
  cellTraversal:
    'activeRanks[rankPrefix[cellBegin]..rankPrefix[cellEnd])',
  overflowPolicy: 'unavailable-above-bounded-source-capacity; consumers-retain-classic-path',
  corruptionPolicy: 'gpu-authenticated-fail-closed-before-indirect-consumer-dispatch',
  residency: 'same-arena-same-lease-same-retirement-as-owning-spatial-epoch'
});

function rejectedDescriptor(status, reason, field = null) {
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_SCHEMA,
    status,
    reason,
    ready: false,
    admitted: false,
    ...(field == null ? {} : { field })
  });
}

export function validateSchroederSpatialActiveRankViewDescriptor(
  view,
  expected = {}
) {
  if (
    view?.schema !== ULG_SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_SCHEMA
    || view.status !== 'schroeder-spatial-active-rank-view-gpu-encoded'
    || view.ready !== true
    || view.selected !== true
  ) {
    return rejectedDescriptor(
      'schroeder-spatial-active-rank-view-rejected-descriptor',
      'active-rank view is not an encoded retained v1 descriptor'
    );
  }
  let canonicalLayout;
  try {
    canonicalLayout = createSchroederSpatialActiveRankViewLayout({
      sourceCapacity: view.sourceCapacity
    });
  } catch (error) {
    return rejectedDescriptor(
      'schroeder-spatial-active-rank-view-rejected-layout',
      error instanceof Error ? error.message : String(error),
      'sourceCapacity'
    );
  }
  for (const field of [
    'headerWords',
    'sourceCapacity',
    'rankPrefixOffsetWords',
    'rankPrefixCapacity',
    'activeRanksOffsetWords',
    'activeRankCapacity',
    'activeSourceIndicesOffsetWords',
    'activeSourceIndexCapacity',
    'dispatchOffsetWords',
    'dispatchOffsetBytes',
    'dispatchWords',
    'wordLength',
    'byteLength'
  ]) {
    if (view.layout?.[field] !== canonicalLayout[field]) {
      return rejectedDescriptor(
        'schroeder-spatial-active-rank-view-rejected-layout',
        `active-rank view layout field ${field} is not canonical`,
        field
      );
    }
  }
  if (
    !view.activeRankViewBuffer
    || !view.directoryBuffer
    || !view.sourceBuffer
    || !view.spatialExecution
    || view.spatialExecution.activeRankView !== view
    || view.spatialExecution.activeRankViewBuffer !== view.activeRankViewBuffer
    || view.spatialExecution.directoryBuffer !== view.directoryBuffer
    || view.spatialExecution.sourceBuffer !== view.sourceBuffer
    || view.spatialExecution.sourceCapacity !== view.sourceCapacity
    || view.spatialExecution.sourceRowLayoutId !== view.sourceRowLayoutId
    || view.dispatchOffsetBytes !== canonicalLayout.dispatchOffsetBytes
  ) {
    return rejectedDescriptor(
      'schroeder-spatial-active-rank-view-rejected-ownership',
      'active-rank view does not share exact spatial execution ownership'
    );
  }
  const expectedFields = [
    'sourceCount',
    'sourceCapacity',
    'sourceRowLayoutId',
    'generationId',
    'storageGeneration',
    'physicsTick',
    'physicsSubstep',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch',
    'levelEpoch',
    'supportEpoch',
    'buildOrdinal'
  ];
  for (const field of expectedFields) {
    if (
      Object.hasOwn(expected, field)
      && expected[field] !== view[field]
    ) {
      return rejectedDescriptor(
        'schroeder-spatial-active-rank-view-rejected-identity',
        `active-rank view ${field} does not match the expected epoch`,
        field
      );
    }
  }
  for (const field of [
    'spatialExecution',
    'sourceBuffer',
    'directoryBuffer'
  ]) {
    if (Object.hasOwn(expected, field) && expected[field] !== view[field]) {
      return rejectedDescriptor(
        'schroeder-spatial-active-rank-view-rejected-ownership',
        `active-rank view ${field} does not match exact object identity`,
        field
      );
    }
  }
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_SCHEMA,
    status: 'schroeder-spatial-active-rank-view-admitted-host-descriptor',
    reason: null,
    ready: true,
    admitted: true,
    layout: canonicalLayout
  });
}
