import {
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0
} from './schroederSpatialMechanicsView.js';

export const ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA =
  'peercompute.ulg.schroeder-spatial-active-source-view.v1';

export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MAGIC = 0x5353_5631;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_VERSION = 1;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_WORDS = 64;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CONSUMER_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CANDIDATES_PER_SOURCE = 27;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SOURCE_STRIDE_FLOATS = 16;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MISSING_ORDINAL = 0xffff_ffff;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MAX_PHYSICAL_SOURCE_COUNT =
  0x0100_0000;

export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_ACTIVE_DISPATCH_OFFSET_WORDS = 48;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CANDIDATE_DISPATCH_OFFSET_WORDS = 51;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PHYSICAL_DISPATCH_OFFSET_WORDS = 54;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_DISPATCH_WORDS = 3;

export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_INVALID_SOURCE = 1 << 3;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_CAPACITY_OVERFLOW = 1 << 4;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_UNSUPPORTED_SOURCE = 1 << 5;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_IDENTITY_MISMATCH = 1 << 6;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_NONFINITE = 1 << 7;

export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_LAYOUT = Object.freeze([
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
  'physicalSourceCount:u32',
  'physicalSourceCapacity:u32',
  'activeSourceCount:u32',
  'activeSourceCapacity:u32',
  'dormantSourceCount:u32',
  'invalidSourceCount:u32',
  'overflowCount:u32',
  'sourceRowLayoutId:u32',
  'sourceRowStrideFloats:u32',
  'activeToPhysicalOffsetWords:u32',
  'physicalToActiveOffsetWords:u32',
  'capacityWords:u32',
  'logicalRequiredWords:u32',
  'buildOrdinal:u32',
  'completionOrdinal:u32',
  'sourceFingerprint:u32',
  'classifyCount:u32',
  'scatterCount:u32',
  'reverseCount:u32',
  'scanTerminal:u32',
  'activePhysicalHighWaterExclusive:u32',
  'producerWorkgroupSize:u32',
  'dispatchXLimit:u32',
  'clearedWords:u32',
  'activeDispatchOffsetWords:u32',
  'candidateDispatchOffsetWords:u32',
  'physicalDispatchOffsetWords:u32',
  'activeCandidateCount:u32',
  'activeCandidateCapacity:u32',
  'capacityTierOrdinal:u32',
  'overflowRequiredActiveCount:u32',
  'seal:u32',
  'activeDispatchX:u32',
  'activeDispatchY:u32',
  'activeDispatchZ:u32',
  'candidateDispatchX:u32',
  'candidateDispatchY:u32',
  'candidateDispatchZ:u32',
  'physicalDispatchX:u32',
  'physicalDispatchY:u32',
  'physicalDispatchZ:u32',
  ...Array.from({ length: 7 }, (_, index) => `reserved${index}:u32`)
]);

const UINT32_MAX = 0xffff_ffff;
const FINGERPRINT_BASIS = 0x811c_9dc5;
const FINGERPRINT_PRIME = 0x0100_0193;

function positiveInteger(value, label, max = UINT32_MAX) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new RangeError(`${label} must be an integer in [1, ${max}]`);
  }
  return number;
}

function exactU32(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > UINT32_MAX) {
    throw new RangeError(`${label} must be a u32`);
  }
  return number >>> 0;
}

function exactI32(value, label) {
  const number = Number(value);
  if (
    !Number.isInteger(number)
    || number < -0x8000_0000
    || number > 0x7fff_ffff
  ) {
    throw new RangeError(`${label} must be an i32`);
  }
  return number | 0;
}

function checkedAdd(left, right, label) {
  const value = left + right;
  if (!Number.isSafeInteger(value) || value > UINT32_MAX) {
    throw new RangeError(`${label} exceeds the u32-addressable range`);
  }
  return value;
}

function checkedMultiply(left, right, label) {
  const value = left * right;
  if (!Number.isSafeInteger(value) || value > UINT32_MAX) {
    throw new RangeError(`${label} exceeds the u32-addressable range`);
  }
  return value;
}

function f32Bits(value, label) {
  const number = Math.fround(Number(value));
  if (!Number.isFinite(number)) {
    throw new RangeError(`${label} must be finite as f32`);
  }
  const words = new Uint32Array(1);
  new Float32Array(words.buffer)[0] = number;
  return words[0] >>> 0;
}

function foldFingerprint(value, word) {
  return Math.imul((value ^ (word >>> 0)) >>> 0, FINGERPRINT_PRIME) >>> 0;
}

export function createSchroederSpatialActiveSourceViewLayout({
  physicalSourceCapacity,
  activeSourceCapacity = physicalSourceCapacity
} = {}) {
  const resolvedPhysicalCapacity = positiveInteger(
    physicalSourceCapacity,
    'physicalSourceCapacity',
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MAX_PHYSICAL_SOURCE_COUNT
  );
  const resolvedActiveCapacity = positiveInteger(
    activeSourceCapacity,
    'activeSourceCapacity',
    resolvedPhysicalCapacity
  );
  const activeToPhysicalOffsetWords =
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_WORDS;
  const physicalToActiveOffsetWords = checkedAdd(
    activeToPhysicalOffsetWords,
    resolvedActiveCapacity,
    'active-source physical-to-active offset'
  );
  const wordLength = checkedAdd(
    physicalToActiveOffsetWords,
    resolvedPhysicalCapacity,
    'active-source view word length'
  );
  const byteLength = checkedMultiply(
    wordLength,
    Uint32Array.BYTES_PER_ELEMENT,
    'active-source view byte length'
  );
  const activeCandidateCapacity = checkedMultiply(
    resolvedActiveCapacity,
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CANDIDATES_PER_SOURCE,
    'active-source candidate capacity'
  );
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
    version: SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_VERSION,
    headerWords: SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_WORDS,
    physicalSourceCapacity: resolvedPhysicalCapacity,
    activeSourceCapacity: resolvedActiveCapacity,
    activeCandidateCapacity,
    activeToPhysicalOffsetWords,
    activeToPhysicalCapacity: resolvedActiveCapacity,
    physicalToActiveOffsetWords,
    physicalToActiveCapacity: resolvedPhysicalCapacity,
    activeDispatchOffsetWords:
      SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_ACTIVE_DISPATCH_OFFSET_WORDS,
    activeDispatchOffsetBytes:
      SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_ACTIVE_DISPATCH_OFFSET_WORDS
      * Uint32Array.BYTES_PER_ELEMENT,
    candidateDispatchOffsetWords:
      SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CANDIDATE_DISPATCH_OFFSET_WORDS,
    candidateDispatchOffsetBytes:
      SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CANDIDATE_DISPATCH_OFFSET_WORDS
      * Uint32Array.BYTES_PER_ELEMENT,
    physicalDispatchOffsetWords:
      SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PHYSICAL_DISPATCH_OFFSET_WORDS,
    physicalDispatchOffsetBytes:
      SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PHYSICAL_DISPATCH_OFFSET_WORDS
      * Uint32Array.BYTES_PER_ELEMENT,
    dispatchWords: SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_DISPATCH_WORDS,
    wordLength,
    byteLength
  });
}

export function createSchroederSpatialActiveSourceFingerprint({
  generationId = 0,
  deviceOrdinal = 0,
  laneOrdinal = 0,
  leaseToken = 0,
  sourceFamilyId = 0,
  storageGeneration = 0,
  physicsTick = 0,
  physicsSubstep = 0,
  positionEpoch = 0,
  topologyEpoch = 0,
  chartEpoch = 0,
  levelEpoch = 0,
  supportEpoch = 0,
  physicalSourceCount,
  physicalSourceCapacity,
  activeSourceCapacity,
  sourceRowLayoutId =
    SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
  sourceRowStrideFloats =
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SOURCE_STRIDE_FLOATS,
  buildOrdinal = 0,
  queryGeometryMode = 0,
  queryChartId = 0,
  queryMinLevel = 0,
  queryMaxLevel = 0,
  queryBaseGridSpacingM = 0
} = {}) {
  const words = [
    exactU32(generationId, 'generationId'),
    exactU32(deviceOrdinal, 'deviceOrdinal'),
    exactU32(laneOrdinal, 'laneOrdinal'),
    exactU32(leaseToken, 'leaseToken'),
    exactU32(sourceFamilyId, 'sourceFamilyId'),
    exactU32(storageGeneration, 'storageGeneration'),
    exactU32(physicsTick, 'physicsTick'),
    exactU32(physicsSubstep, 'physicsSubstep'),
    exactU32(positionEpoch, 'positionEpoch'),
    exactU32(topologyEpoch, 'topologyEpoch'),
    exactU32(chartEpoch, 'chartEpoch'),
    exactU32(levelEpoch, 'levelEpoch'),
    exactU32(supportEpoch, 'supportEpoch'),
    exactU32(physicalSourceCount, 'physicalSourceCount'),
    exactU32(physicalSourceCapacity, 'physicalSourceCapacity'),
    exactU32(activeSourceCapacity, 'activeSourceCapacity'),
    exactU32(sourceRowLayoutId, 'sourceRowLayoutId'),
    exactU32(sourceRowStrideFloats, 'sourceRowStrideFloats'),
    exactU32(buildOrdinal, 'buildOrdinal'),
    exactU32(queryGeometryMode, 'queryGeometryMode'),
    exactU32(queryChartId, 'queryChartId'),
    exactI32(queryMinLevel, 'queryMinLevel') >>> 0,
    exactI32(queryMaxLevel, 'queryMaxLevel') >>> 0,
    f32Bits(queryBaseGridSpacingM, 'queryBaseGridSpacingM')
  ];
  return words.reduce(foldFingerprint, FINGERPRINT_BASIS) >>> 0;
}

export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_ABI = Object.freeze({
  schema: ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
  version: SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_VERSION,
  magic: SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MAGIC,
  headerWords: SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_WORDS,
  headerLayout: SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_LAYOUT,
  producerWorkgroupSize: SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_WORKGROUP_SIZE,
  consumerWorkgroupSize:
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CONSUMER_WORKGROUP_SIZE,
  sourceRowLayoutId:
    SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
  sourceRowStrideFloats:
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SOURCE_STRIDE_FLOATS,
  ordering: 'stable-ascending-physical-source-index',
  forwardMap: 'active-ordinal-to-physical-source-index',
  reverseMap:
    'physical-source-index-to-active-ordinal-or-0xffffffff-for-dormant',
  construction:
    'parallel-row-classification-exclusive-u32-scan-stable-scatter-gpu-finalize',
  overflowPolicy:
    'fail-closed-zero-indirect-dispatch-and-publish-required-active-count',
  residency: 'same-generation-lease-as-the-owning-direct-spatial-epoch'
});

function rejectedDescriptor(status, reason, field = null) {
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
    status,
    reason,
    ready: false,
    admitted: false,
    ...(field == null ? {} : { field })
  });
}

export function validateSchroederSpatialActiveSourceViewDescriptor(
  view,
  expected = {}
) {
  if (
    view?.schema !== ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA
    || view.status !== 'schroeder-spatial-active-source-view-gpu-encoded'
    || view.ready !== true
    || view.selected !== true
  ) {
    return rejectedDescriptor(
      'schroeder-spatial-active-source-view-rejected-descriptor',
      'active-source view is not an encoded retained v1 descriptor'
    );
  }
  let canonicalLayout;
  try {
    canonicalLayout = createSchroederSpatialActiveSourceViewLayout({
      physicalSourceCapacity: view.physicalSourceCapacity,
      activeSourceCapacity: view.activeSourceCapacity
    });
  } catch (error) {
    return rejectedDescriptor(
      'schroeder-spatial-active-source-view-rejected-layout',
      error instanceof Error ? error.message : String(error),
      'physicalSourceCapacity'
    );
  }
  for (const field of [
    'headerWords',
    'physicalSourceCapacity',
    'activeSourceCapacity',
    'activeCandidateCapacity',
    'activeToPhysicalOffsetWords',
    'activeToPhysicalCapacity',
    'physicalToActiveOffsetWords',
    'physicalToActiveCapacity',
    'activeDispatchOffsetWords',
    'activeDispatchOffsetBytes',
    'candidateDispatchOffsetWords',
    'candidateDispatchOffsetBytes',
    'physicalDispatchOffsetWords',
    'physicalDispatchOffsetBytes',
    'dispatchWords',
    'wordLength',
    'byteLength'
  ]) {
    if (view.layout?.[field] !== canonicalLayout[field]) {
      return rejectedDescriptor(
        'schroeder-spatial-active-source-view-rejected-layout',
        `active-source view layout field ${field} is not canonical`,
        field
      );
    }
  }
  if (
    !view.activeSourceViewBuffer
    || !view.sourceBuffer
    || view.sourceRowLayoutId
      !== SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0
    || view.sourceRowStrideFloats
      !== SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SOURCE_STRIDE_FLOATS
    || view.physicalSourceCount > view.physicalSourceCapacity
    || view.activeDispatchOffsetBytes !== canonicalLayout.activeDispatchOffsetBytes
    || view.candidateDispatchOffsetBytes !== canonicalLayout.candidateDispatchOffsetBytes
    || view.physicalDispatchOffsetBytes !== canonicalLayout.physicalDispatchOffsetBytes
    || view.ownerRuntime?.ownsExecution?.(view) !== true
  ) {
    return rejectedDescriptor(
      'schroeder-spatial-active-source-view-rejected-ownership',
      'active-source view does not retain its exact source, buffer, layout, and runtime owner'
    );
  }
  const expectedFields = [
    'physicalSourceCount',
    'physicalSourceCapacity',
    'activeSourceCapacity',
    'sourceRowLayoutId',
    'sourceRowStrideFloats',
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
    'buildOrdinal',
    'sourceFingerprint'
  ];
  for (const field of expectedFields) {
    if (Object.hasOwn(expected, field) && expected[field] !== view[field]) {
      return rejectedDescriptor(
        'schroeder-spatial-active-source-view-rejected-identity',
        `active-source view ${field} does not match the expected epoch`,
        field
      );
    }
  }
  for (const field of ['sourceBuffer', 'activeSourceViewBuffer', 'ownerRuntime']) {
    if (Object.hasOwn(expected, field) && expected[field] !== view[field]) {
      return rejectedDescriptor(
        'schroeder-spatial-active-source-view-rejected-ownership',
        `active-source view ${field} does not match exact object identity`,
        field
      );
    }
  }
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
    status: 'schroeder-spatial-active-source-view-admitted-host-descriptor',
    reason: null,
    ready: true,
    admitted: true,
    layout: canonicalLayout
  });
}
