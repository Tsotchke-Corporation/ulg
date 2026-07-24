export const ULG_SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_SCHEMA =
  'peercompute.ulg.schroeder-spatial-exact-near-cell-tree.v1';

export const SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_MAGIC = 0x53435431;
export const SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_VERSION = 1;
export const SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_HEADER_WORDS = 40;
export const SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_NODE_WORDS = 8;
export const SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_STATUS_INVALID_SOURCE = 1 << 3;
export const SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_STATUS_CAPACITY_OVERFLOW = 1 << 4;
export const SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_NODE_VALID = 1 << 0;
export const SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_NODE_LEAF = 1 << 1;
export const SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_NODE_INTERNAL = 1 << 2;

export const SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_HEADER_LAYOUT = Object.freeze([
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
  'leafCapacity:u32',
  'nodeCapacity:u32',
  'nodeOffsetWords:u32',
  'treeDepth:u32',
  'directoryCapacityWords:u32',
  'directoryCellKeysOffsetWords:u32',
  'directoryCellOffsetsOffsetWords:u32',
  'directoryCellMembersOffsetWords:u32',
  'directoryParticleToCellOffsetWords:u32',
  'directoryCompletionOrdinal:u32',
  'leafBuildCount:u32',
  'invalidNodeCount:u32',
  'rootNodeIndex:u32',
  'nodeWords:u32',
  'reserved34:u32',
  'reserved35:u32',
  'reserved36:u32',
  'reserved37:u32',
  'reserved38:u32',
  'reserved39:u32'
]);

export const SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_NODE_LAYOUT = Object.freeze([
  'aabbMinXM:f32',
  'aabbMinYM:f32',
  'aabbMinZM:f32',
  'aabbMaxXM:f32',
  'aabbMaxYM:f32',
  'aabbMaxZM:f32',
  'nodeStatus:u32',
  'cellIndexOrInvalid:u32'
]);

const UINT32_MAX = 0xffff_ffff;
const MAX_TREE_DEPTH = 30;

function positiveInteger(value, label, max = UINT32_MAX) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new RangeError(`${label} must be an integer in [1, ${max}]`);
  }
  return number;
}

function nonNegativeInteger(value, label, max = UINT32_MAX) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > max) {
    throw new RangeError(`${label} must be an integer in [0, ${max}]`);
  }
  return number;
}

function checkedMultiply(left, right, label) {
  const value = left * right;
  if (!Number.isSafeInteger(value) || value > UINT32_MAX) {
    throw new RangeError(`${label} exceeds the u32-addressable range`);
  }
  return value;
}

function checkedAdd(left, right, label) {
  const value = left + right;
  if (!Number.isSafeInteger(value) || value > UINT32_MAX) {
    throw new RangeError(`${label} exceeds the u32-addressable range`);
  }
  return value;
}

export function schroederSpatialExactNearCellTreeLeafCapacity(cellCapacity) {
  const cells = positiveInteger(cellCapacity, 'cellCapacity');
  let capacity = 1;
  let depth = 0;
  while (capacity < cells) {
    if (depth >= MAX_TREE_DEPTH) {
      throw new RangeError(
        `cellCapacity requires a tree deeper than ${MAX_TREE_DEPTH} levels`
      );
    }
    capacity *= 2;
    depth += 1;
  }
  return capacity;
}

export function createSchroederSpatialExactNearCellTreeLayout({
  cellCapacity
} = {}) {
  const resolvedCellCapacity = positiveInteger(cellCapacity, 'cellCapacity');
  const leafCapacity = schroederSpatialExactNearCellTreeLeafCapacity(
    resolvedCellCapacity
  );
  const treeDepth = Math.log2(leafCapacity);
  const nodeCapacity = checkedAdd(
    checkedMultiply(leafCapacity, 2, 'cell-tree leaf capacity'),
    -1,
    'cell-tree node capacity'
  );
  const nodeWords = checkedMultiply(
    nodeCapacity,
    SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_NODE_WORDS,
    'cell-tree node words'
  );
  const wordLength = checkedAdd(
    SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_HEADER_WORDS,
    nodeWords,
    'cell-tree word length'
  );
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_SCHEMA,
    headerWords: SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_HEADER_WORDS,
    nodeWords: SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_NODE_WORDS,
    nodeOffsetWords: SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_HEADER_WORDS,
    cellCapacity: resolvedCellCapacity,
    leafCapacity,
    leafOffset: leafCapacity - 1,
    nodeCapacity,
    treeDepth,
    wordLength,
    byteLength: wordLength * Uint32Array.BYTES_PER_ELEMENT
  });
}

export function createSchroederSpatialExactNearCellTreePlan({
  sourceCount,
  sourceCapacity,
  cellCapacity = sourceCapacity,
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
  directoryCapacityWords,
  cellKeysOffsetWords,
  cellOffsetsOffsetWords,
  cellMembersOffsetWords,
  particleToCellOffsetWords,
  completionOrdinal = generationId
} = {}) {
  const resolvedSourceCapacity = positiveInteger(sourceCapacity, 'sourceCapacity');
  const resolvedSourceCount = positiveInteger(sourceCount, 'sourceCount');
  if (resolvedSourceCount > resolvedSourceCapacity) {
    throw new RangeError('sourceCount must not exceed sourceCapacity');
  }
  const layout = createSchroederSpatialExactNearCellTreeLayout({ cellCapacity });
  if (layout.cellCapacity > resolvedSourceCapacity) {
    throw new RangeError('cellCapacity must not exceed sourceCapacity');
  }
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_SCHEMA,
    magic: SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_MAGIC,
    abiVersion: SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_VERSION,
    sourceCount: resolvedSourceCount,
    sourceCapacity: resolvedSourceCapacity,
    cellCapacity: layout.cellCapacity,
    generationId: positiveInteger(generationId, 'generationId'),
    deviceOrdinal: nonNegativeInteger(deviceOrdinal, 'deviceOrdinal'),
    laneOrdinal: nonNegativeInteger(laneOrdinal, 'laneOrdinal'),
    leaseToken: nonNegativeInteger(leaseToken, 'leaseToken'),
    sourceFamilyId: nonNegativeInteger(sourceFamilyId, 'sourceFamilyId'),
    storageGeneration: positiveInteger(storageGeneration, 'storageGeneration'),
    physicsTick: nonNegativeInteger(physicsTick, 'physicsTick'),
    physicsSubstep: nonNegativeInteger(physicsSubstep, 'physicsSubstep'),
    positionEpoch: nonNegativeInteger(positionEpoch, 'positionEpoch'),
    topologyEpoch: nonNegativeInteger(topologyEpoch, 'topologyEpoch'),
    chartEpoch: nonNegativeInteger(chartEpoch, 'chartEpoch'),
    levelEpoch: nonNegativeInteger(levelEpoch, 'levelEpoch'),
    supportEpoch: nonNegativeInteger(supportEpoch, 'supportEpoch'),
    directoryCapacityWords: positiveInteger(
      directoryCapacityWords,
      'directoryCapacityWords'
    ),
    cellKeysOffsetWords: nonNegativeInteger(cellKeysOffsetWords, 'cellKeysOffsetWords'),
    cellOffsetsOffsetWords: nonNegativeInteger(
      cellOffsetsOffsetWords,
      'cellOffsetsOffsetWords'
    ),
    cellMembersOffsetWords: nonNegativeInteger(
      cellMembersOffsetWords,
      'cellMembersOffsetWords'
    ),
    particleToCellOffsetWords: nonNegativeInteger(
      particleToCellOffsetWords,
      'particleToCellOffsetWords'
    ),
    completionOrdinal: positiveInteger(completionOrdinal, 'completionOrdinal'),
    layout,
    construction:
      'canonical-directory-cell-aabb-complete-binary-union-hierarchy',
    materializedCandidateRows: false,
    perSourceCandidateBudget: null,
    readbackPolicy: 'explicit-probe-only',
    overflowPolicy: 'fail-closed-zero-consumer-dispatch'
  });
}

export const SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_ABI = Object.freeze({
  schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_SCHEMA,
  version: SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_VERSION,
  magic: SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_MAGIC,
  headerWords: SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_HEADER_WORDS,
  nodeWords: SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_NODE_WORDS,
  headerLayout: SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_HEADER_LAYOUT,
  nodeLayout: SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_NODE_LAYOUT,
  topology: 'complete-power-of-two-binary-cell-aabb-tree',
  sourceAuthority: 'immutable-ss-spatial-epoch-v1-cell-csr',
  construction: 'fixed-bottom-up-union-levels-no-private-sort',
  traversal: 'consumer-exact-leaf-streaming-with-current-law-predicate',
  materializedCandidateRows: false,
  perSourceCandidateBudget: null,
  fallbackPolicy: 'none-after-admitted-canonical-generation-selection'
});
