export const ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA =
  'peercompute.ulg.schroeder-spatial-epoch.v1';

export const SCHROEDER_SPATIAL_EPOCH_MAGIC = 0x53534531;
export const SCHROEDER_SPATIAL_EPOCH_VERSION = 1;
export const SCHROEDER_SPATIAL_EPOCH_KEY_WORDS = 5;
export const SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS = 48;

export const SCHROEDER_SPATIAL_SORT_BOUNDED_ATLAS_U32 = 1;
export const SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5 = 2;

export const SCHROEDER_SPATIAL_EPOCH_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_EPOCH_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_EPOCH_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_SPATIAL_EPOCH_STATUS_INVALID_SOURCE = 1 << 3;
export const SCHROEDER_SPATIAL_EPOCH_STATUS_CAPACITY_OVERFLOW = 1 << 4;

export const SCHROEDER_SPATIAL_EPOCH_HEADER_LAYOUT = Object.freeze([
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
  'logicalRequiredWords:u32',
  'logicalAdmittedWords:u32',
  'directoryCapacityWords:u32',
  'invalidSourceCount:u32',
  'overflowCount:u32',
  'exactKeyWordCount:u32',
  'sortKeyWordCount:u32',
  'sortMode:u32',
  'headerWords:u32',
  'cellKeysOffsetWords:u32',
  'cellOffsetsOffsetWords:u32',
  'cellMembersOffsetWords:u32',
  'particleToCellOffsetWords:u32',
  'buildOrdinal:u32',
  'sortUniqueOrdinal:u32',
  'completionOrdinal:u32',
  'uniqueGenerationId:u32',
  'uniqueInputCount:u32',
  'primitiveUniqueCount:u32',
  'primitiveAdmitted:u32',
  'primitiveOverflowFlags:u32',
  'primitiveStatus:u32',
  'consumerDispatchX:u32',
  'consumerDispatchY:u32',
  'consumerDispatchZ:u32',
  'clearedWords:u32',
  'sourceAdapterId:u32',
  'physicalAddressUpperBoundWords:u32'
]);

export const SCHROEDER_SPATIAL_EPOCH_KEY_LAYOUT = Object.freeze([
  'chartId:u32',
  'levelOrderKey:u32',
  'cellXOrderKey:u32',
  'cellYOrderKey:u32',
  'cellZOrderKey:u32'
]);

export const SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI = Object.freeze({
  schema: ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
  version: SCHROEDER_SPATIAL_EPOCH_VERSION,
  headerLayout: SCHROEDER_SPATIAL_EPOCH_HEADER_LAYOUT,
  keyLayout: SCHROEDER_SPATIAL_EPOCH_KEY_LAYOUT,
  structuralIdentity: 'exact-chart-level-signed-cell-u32x5',
  sortStrategies: Object.freeze([
    'collision-free-bounded-atlas-u32',
    'exact-lexicographic-u32x5'
  ]),
  membership: 'stable-cell-csr-with-particle-reverse-map',
  wordTelemetry: Object.freeze({
    logicalRequiredWords: 'compact-live-payload-count-not-a-bind-or-slice-boundary',
    logicalAdmittedWords: 'compact-live-payload-count-only-when-gpu-admitted',
    physicalAddressUpperBoundWords:
      'exclusive-live-high-water-when-admitted-full-capacity-bound-when-fail-closed',
    directoryCapacityWords: 'retained-allocation-and-consumer-binding-capacity'
  }),
  consumerDispatchLinearization: 'linearGroup=workgroup.x+workgroup.y*consumerDispatchX',
  arenaResidency: 'configurable-complete-fence-leased-generation-arenas',
  submissionOwnership: 'caller',
  readbackPolicy: 'fixed-evidence-or-explicit-probe-only',
  overflowPolicy: 'fail-closed-zero-consumer-dispatch',
  productionConsumerStatus: 'standalone-foundation-not-yet-integrated'
});

const UINT32_MAX = 0xffff_ffff;
const UINT32_RANGE = 0x1_0000_0000;

function integerInRange(value, label, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer in [${min}, ${max}]`);
  }
  return number;
}

function positiveInteger(value, label, max = UINT32_MAX) {
  return integerInRange(value, label, 1, max);
}

function nonNegativeInteger(value, label, max = UINT32_MAX) {
  return integerInRange(value, label, 0, max);
}

function checkedAdd(left, right, label) {
  const value = left + right;
  if (!Number.isSafeInteger(value) || value > UINT32_MAX) {
    throw new RangeError(`${label} exceeds the u32-addressable directory range`);
  }
  return value;
}

function checkedMultiply(left, right, label, max = UINT32_MAX) {
  const value = left * right;
  if (!Number.isSafeInteger(value) || value > max) {
    throw new RangeError(`${label} exceeds ${max}`);
  }
  return value;
}

export function encodeSchroederSignedOrderKey(value) {
  const signed = integerInRange(value, 'signed structural coordinate', -0x8000_0000, 0x7fff_ffff);
  return ((signed >>> 0) ^ 0x8000_0000) >>> 0;
}

export function decodeSchroederSignedOrderKey(value) {
  const ordered = nonNegativeInteger(value, 'signed order key');
  return ((ordered ^ 0x8000_0000) | 0);
}

export function createSchroederBoundedAtlasPlan({
  chartMin = 0,
  chartCount = 1,
  levelMin = 0,
  levelCount = 1,
  cellMin = [-1, -1, -1],
  cellCount = [3, 3, 3]
} = {}) {
  const resolvedChartMin = nonNegativeInteger(chartMin, 'chartMin');
  const resolvedChartCount = positiveInteger(chartCount, 'chartCount');
  const resolvedLevelMin = integerInRange(levelMin, 'levelMin', -0x8000_0000, 0x7fff_ffff);
  const resolvedLevelCount = positiveInteger(levelCount, 'levelCount');
  if (!Array.isArray(cellMin) && !ArrayBuffer.isView(cellMin)) {
    throw new TypeError('cellMin must be an array-like [x, y, z] value');
  }
  if (!Array.isArray(cellCount) && !ArrayBuffer.isView(cellCount)) {
    throw new TypeError('cellCount must be an array-like [x, y, z] value');
  }
  if (cellMin.length !== 3 || cellCount.length !== 3) {
    throw new RangeError('cellMin and cellCount must each contain three values');
  }
  const resolvedCellMin = [...cellMin].map((value, axis) => integerInRange(
    value,
    `cellMin[${axis}]`,
    -0x8000_0000,
    0x7fff_ffff
  ));
  const resolvedCellCount = [...cellCount].map((value, axis) => positiveInteger(
    value,
    `cellCount[${axis}]`
  ));
  const chartEnd = resolvedChartMin + resolvedChartCount;
  const levelEnd = resolvedLevelMin + resolvedLevelCount;
  const cellEnd = resolvedCellMin.map((value, axis) => value + resolvedCellCount[axis]);
  if (chartEnd > UINT32_RANGE || levelEnd > 0x8000_0000) {
    throw new RangeError('bounded atlas chart/level interval exceeds structural range');
  }
  for (let axis = 0; axis < 3; axis += 1) {
    if (cellEnd[axis] > 0x8000_0000) {
      throw new RangeError(`bounded atlas cell interval ${axis} exceeds i32 range`);
    }
  }
  let ordinalCount = resolvedChartCount;
  ordinalCount = checkedMultiply(ordinalCount, resolvedLevelCount, 'bounded atlas ordinal count', UINT32_RANGE);
  for (const count of resolvedCellCount) {
    ordinalCount = checkedMultiply(ordinalCount, count, 'bounded atlas ordinal count', UINT32_RANGE);
  }
  return Object.freeze({
    mode: 'bounded-atlas-u32',
    sortMode: SCHROEDER_SPATIAL_SORT_BOUNDED_ATLAS_U32,
    sortKeyWordCount: 1,
    chartMin: resolvedChartMin,
    chartCount: resolvedChartCount,
    levelMin: resolvedLevelMin,
    levelCount: resolvedLevelCount,
    cellMin: Object.freeze(resolvedCellMin),
    cellCount: Object.freeze(resolvedCellCount),
    ordinalCount,
    collisionFree: true
  });
}

export function createSchroederSpatialEpochLayout({
  sourceCapacity,
  cellCapacity = sourceCapacity
} = {}) {
  const resolvedSourceCapacity = positiveInteger(sourceCapacity, 'sourceCapacity');
  const resolvedCellCapacity = positiveInteger(cellCapacity, 'cellCapacity');
  const headerOffsetWords = 0;
  const cellKeysOffsetWords = SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS;
  const cellKeyWords = checkedMultiply(
    resolvedCellCapacity,
    SCHROEDER_SPATIAL_EPOCH_KEY_WORDS,
    'cell key words'
  );
  const cellOffsetsOffsetWords = checkedAdd(cellKeysOffsetWords, cellKeyWords, 'cell offsets offset');
  const cellOffsetWords = checkedAdd(resolvedCellCapacity, 1, 'cell offset words');
  const cellMembersOffsetWords = checkedAdd(
    cellOffsetsOffsetWords,
    cellOffsetWords,
    'cell members offset'
  );
  const particleToCellOffsetWords = checkedAdd(
    cellMembersOffsetWords,
    resolvedSourceCapacity,
    'particle reverse offset'
  );
  const wordLength = checkedAdd(
    particleToCellOffsetWords,
    resolvedSourceCapacity,
    'directory word length'
  );
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
    headerOffsetWords,
    headerWords: SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS,
    cellKeysOffsetWords,
    cellKeyWords,
    cellOffsetsOffsetWords,
    cellOffsetWords,
    cellMembersOffsetWords,
    cellMemberWords: resolvedSourceCapacity,
    particleToCellOffsetWords,
    particleToCellWords: resolvedSourceCapacity,
    sourceCapacity: resolvedSourceCapacity,
    cellCapacity: resolvedCellCapacity,
    wordLength,
    byteLength: wordLength * Uint32Array.BYTES_PER_ELEMENT
  });
}

export function createSchroederSpatialEpochBuildPlan({
  sourceCount,
  sourceCapacity,
  cellCapacity = sourceCapacity,
  sortMode = 'bounded-atlas-u32',
  atlas = null,
  generationId = 1,
  positionEpoch = 0,
  topologyEpoch = 0,
  chartEpoch = 0,
  levelEpoch = 0,
  supportEpoch = 0,
  leaseToken = 0,
  deviceOrdinal = 0,
  laneOrdinal = 0,
  sourceFamilyId = 0,
  storageGeneration = 0,
  physicsTick = 0,
  physicsSubstep = 0,
  buildOrdinal = 1,
  sortUniqueOrdinal = 1
} = {}) {
  const layout = createSchroederSpatialEpochLayout({ sourceCapacity, cellCapacity });
  const resolvedSourceCount = nonNegativeInteger(sourceCount, 'sourceCount', layout.sourceCapacity);
  let resolvedSortMode;
  let resolvedAtlas = null;
  let sortKeyWordCount;
  if (sortMode === 'bounded-atlas-u32' || sortMode === SCHROEDER_SPATIAL_SORT_BOUNDED_ATLAS_U32) {
    resolvedSortMode = SCHROEDER_SPATIAL_SORT_BOUNDED_ATLAS_U32;
    resolvedAtlas = createSchroederBoundedAtlasPlan(atlas || {});
    sortKeyWordCount = 1;
  } else if (
    sortMode === 'lexicographic-u32x5'
    || sortMode === SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5
  ) {
    resolvedSortMode = SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5;
    sortKeyWordCount = SCHROEDER_SPATIAL_EPOCH_KEY_WORDS;
  } else {
    throw new RangeError(`unsupported Schroeder spatial sort mode: ${sortMode}`);
  }
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
    status: 'schroeder-spatial-epoch-build-plan-ready',
    sourceCount: resolvedSourceCount,
    sourceCapacity: layout.sourceCapacity,
    cellCapacity: layout.cellCapacity,
    exactKeyWordCount: SCHROEDER_SPATIAL_EPOCH_KEY_WORDS,
    sortKeyWordCount,
    sortMode: resolvedSortMode,
    sortModeName: resolvedSortMode === SCHROEDER_SPATIAL_SORT_BOUNDED_ATLAS_U32
      ? 'bounded-atlas-u32'
      : 'lexicographic-u32x5',
    atlas: resolvedAtlas,
    generationId: nonNegativeInteger(generationId, 'generationId'),
    positionEpoch: nonNegativeInteger(positionEpoch, 'positionEpoch'),
    topologyEpoch: nonNegativeInteger(topologyEpoch, 'topologyEpoch'),
    chartEpoch: nonNegativeInteger(chartEpoch, 'chartEpoch'),
    levelEpoch: nonNegativeInteger(levelEpoch, 'levelEpoch'),
    supportEpoch: nonNegativeInteger(supportEpoch, 'supportEpoch'),
    leaseToken: nonNegativeInteger(leaseToken, 'leaseToken'),
    deviceOrdinal: nonNegativeInteger(deviceOrdinal, 'deviceOrdinal'),
    laneOrdinal: nonNegativeInteger(laneOrdinal, 'laneOrdinal'),
    sourceFamilyId: nonNegativeInteger(sourceFamilyId, 'sourceFamilyId'),
    storageGeneration: nonNegativeInteger(storageGeneration, 'storageGeneration'),
    physicsTick: nonNegativeInteger(physicsTick, 'physicsTick'),
    physicsSubstep: nonNegativeInteger(physicsSubstep, 'physicsSubstep'),
    buildOrdinal: positiveInteger(buildOrdinal, 'buildOrdinal'),
    sortUniqueOrdinal: positiveInteger(sortUniqueOrdinal, 'sortUniqueOrdinal'),
    layout,
    requiredDirectoryCapacityWords: layout.wordLength,
    requiredDirectoryCapacityBytes: layout.byteLength,
    submissionOwnership: 'caller',
    readbackRequired: false
  });
}

export function validateSchroederSpatialEpochConsumerDescriptor(epoch, expected = {}) {
  if (!epoch || epoch.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA) {
    return { admitted: false, status: 'schroeder-spatial-epoch-rejected-schema' };
  }
  if (
    epoch.magic !== SCHROEDER_SPATIAL_EPOCH_MAGIC
    || epoch.abiVersion !== SCHROEDER_SPATIAL_EPOCH_VERSION
  ) {
    return { admitted: false, status: 'schroeder-spatial-epoch-rejected-abi' };
  }
  const checks = [
    ['deviceId', expected.deviceId],
    ['laneId', expected.laneId],
    ['leaseToken', expected.leaseToken],
    ['generationId', expected.generationId],
    ['positionEpoch', expected.positionEpoch],
    ['topologyEpoch', expected.topologyEpoch],
    ['chartEpoch', expected.chartEpoch],
    ['levelEpoch', expected.levelEpoch],
    ['supportEpoch', expected.supportEpoch],
    ['sourceFamily', expected.sourceFamily],
    ['deviceOrdinal', expected.deviceOrdinal],
    ['laneOrdinal', expected.laneOrdinal],
    ['sourceFamilyId', expected.sourceFamilyId],
    ['storageGeneration', expected.storageGeneration],
    ['physicsTick', expected.physicsTick],
    ['physicsSubstep', expected.physicsSubstep]
  ];
  for (const [field, value] of checks) {
    if (value !== undefined && !Object.is(epoch[field], value)) {
      return {
        admitted: false,
        status: `schroeder-spatial-epoch-rejected-${field}`,
        field,
        expected: value,
        actual: epoch[field]
      };
    }
  }
  if (!Number.isInteger(epoch.statusFlags) || epoch.gpuCompletionProven !== true) {
    return {
      admitted: false,
      compatible: true,
      status: 'schroeder-spatial-epoch-gpu-admission-unproven'
    };
  }
  if (
    epoch.failClosed === true
    || (
      Number.isInteger(epoch.statusFlags)
      && (epoch.statusFlags & SCHROEDER_SPATIAL_EPOCH_STATUS_FAIL_CLOSED) !== 0
    )
  ) {
    return {
      admitted: false,
      compatible: false,
      status: 'schroeder-spatial-epoch-rejected-fail-closed'
    };
  }
  const requiredStatus = SCHROEDER_SPATIAL_EPOCH_STATUS_READY
    | SCHROEDER_SPATIAL_EPOCH_STATUS_ADMITTED;
  if ((epoch.statusFlags & requiredStatus) !== requiredStatus) {
    return {
      admitted: false,
      compatible: false,
      status: 'schroeder-spatial-epoch-rejected-not-admitted'
    };
  }
  return {
    admitted: true,
    compatible: true,
    status: 'schroeder-spatial-epoch-consumer-admitted'
  };
}
