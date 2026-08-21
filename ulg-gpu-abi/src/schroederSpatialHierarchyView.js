export const ULG_SCHROEDER_SPATIAL_HIERARCHY_VIEW_SCHEMA =
  'peercompute.ulg.schroeder-spatial-hierarchy-view.v1';

export const SCHROEDER_SPATIAL_HIERARCHY_VIEW_MAGIC = 0x53485631;
export const SCHROEDER_SPATIAL_HIERARCHY_VIEW_VERSION = 1;
export const SCHROEDER_SPATIAL_HIERARCHY_VIEW_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPATIAL_HIERARCHY_VIEW_HEADER_WORDS = 64;
export const SCHROEDER_SPATIAL_HIERARCHY_VIEW_DISPATCH_OFFSET_WORDS = 60;
export const SCHROEDER_SPATIAL_HIERARCHY_VIEW_FINE_DISPATCH_OFFSET_WORDS = 64;
export const SCHROEDER_SPATIAL_HIERARCHY_VIEW_DATA_OFFSET_WORDS = 68;
export const SCHROEDER_SPATIAL_HIERARCHY_VIEW_PARAMS_BYTES = 256;
export const SCHROEDER_SPATIAL_HIERARCHY_MAX_INTERPOLATION_EDGES_PER_FINE_NODE = 8;

export const SCHROEDER_SPATIAL_HIERARCHY_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_HIERARCHY_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_HIERARCHY_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_SPATIAL_HIERARCHY_STATUS_INVALID_SOURCE = 1 << 3;
export const SCHROEDER_SPATIAL_HIERARCHY_STATUS_CAPACITY_OVERFLOW = 1 << 4;
export const SCHROEDER_SPATIAL_HIERARCHY_STATUS_LEVEL_CONTRACT = 1 << 5;
export const SCHROEDER_SPATIAL_HIERARCHY_STATUS_CLIPPED_SUPPORT = 1 << 6;

export const SCHROEDER_SPATIAL_HIERARCHY_VIEW_HEADER_LAYOUT = Object.freeze([
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
  'fineLevel:i32-bits',
  'coarseLevel:i32-bits',
  'fineGridNodeCount:u32',
  'coarseGridNodeCount:u32',
  'fineGridDimX:u32',
  'fineGridDimY:u32',
  'fineGridDimZ:u32',
  'coarseGridDimX:u32',
  'coarseGridDimY:u32',
  'coarseGridDimZ:u32',
  'fineGridShift:u32',
  'coarseGridShift:u32',
  'fineGridSpacingM:f32-bits',
  'coarseGridSpacingM:f32-bits',
  'fineNodeCapacity:u32',
  'coarseNodeCapacity:u32',
  'edgeCapacity:u32',
  'childEdgeCapacity:u32',
  'fineNodeCount:u32',
  'coarseNodeCount:u32',
  'edgeCount:u32',
  'childEdgeCount:u32',
  'invalidFineNodeCount:u32',
  'invalidCoarseNodeCount:u32',
  'overflowCount:u32',
  'clippedEdgeCount:u32',
  'maxWeightResidual:f32-bits',
  'maxFirstMomentResidualM:f32-bits',
  'completionOrdinal:u32',
  'directoryGenerationId:u32',
  'fineMechanicsCompletionOrdinal:u32',
  'coarseMechanicsCompletionOrdinal:u32',
  'fineNodeOffsetWords:u32',
  'coarseNodeOffsetWords:u32',
  'edgeCountOffsetWords:u32',
  'edgeOffsetOffsetWords:u32',
  'edgeParentOffsetWords:u32',
  'edgeWeightOffsetWords:u32',
  'parentOfFineOffsetWords:u32',
  'childCountOffsetWords:u32',
  'childOffsetOffsetWords:u32',
  'childIndexOffsetWords:u32',
  'requiredWords:u32',
  'capacityWords:u32',
  'dispatchX:u32',
  'dispatchY:u32',
  'dispatchZ:u32',
  'clearedWords:u32'
]);

export const SCHROEDER_SPATIAL_HIERARCHY_VIEW_ABI = Object.freeze({
  schema: ULG_SCHROEDER_SPATIAL_HIERARCHY_VIEW_SCHEMA,
  version: SCHROEDER_SPATIAL_HIERARCHY_VIEW_VERSION,
  headerWords: SCHROEDER_SPATIAL_HIERARCHY_VIEW_HEADER_WORDS,
  dispatchOffsetWords: SCHROEDER_SPATIAL_HIERARCHY_VIEW_DISPATCH_OFFSET_WORDS,
  fineDispatchOffsetWords: SCHROEDER_SPATIAL_HIERARCHY_VIEW_FINE_DISPATCH_OFFSET_WORDS,
  levelCount: 2,
  thirdMechanicsLevel: 'forbidden-fail-closed',
  fineNodeIdentity: 'ascending-unique-dense-fine-grid-index-u32',
  coarseNodeIdentity: 'ascending-unique-dense-coarse-grid-index-u32',
  interpolation: 'normalized-trilinear-2-to-1-partition-of-unity-first-moment',
  parentTopology: 'exact-integral-floor-div2-one-parent-per-fine-node',
  childTopology: 'compact-csr-no-fixed-candidate-budget',
  overflowPolicy: 'fail-closed-zero-indirect-dispatch',
  readbackPolicy: 'explicit-fixed-evidence-probe-only'
});

const UINT32_MAX = 0xffff_ffff;

function integer(value, label, min = 0, max = UINT32_MAX) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer in [${min}, ${max}]`);
  }
  return number;
}

function finitePositiveF32(value, label) {
  const number = Math.fround(Number(value));
  if (!Number.isFinite(number) || !(number > 0)) {
    throw new RangeError(`${label} must be a positive finite f32`);
  }
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

function gridDescriptor(value, label) {
  if (!value || (!Array.isArray(value.gridDims) && !ArrayBuffer.isView(value.gridDims))) {
    throw new TypeError(`${label}.gridDims must be an array-like [x, y, z] value`);
  }
  const gridDims = Array.from(value.gridDims);
  if (gridDims.length !== 3) throw new RangeError(`${label}.gridDims must contain three values`);
  const dims = gridDims.map((entry, axis) => integer(
    entry,
    `${label}.gridDims[${axis}]`,
    1,
    0x7fff_ffff
  ));
  const nodeCount = integer(value.gridNodeCount, `${label}.gridNodeCount`, 1);
  const product = dims.reduce((total, entry) => total * entry, 1);
  if (!Number.isSafeInteger(product) || product !== nodeCount) {
    throw new RangeError(`${label}.gridNodeCount must equal the gridDims product`);
  }
  return Object.freeze({
    gridDims: Object.freeze(dims),
    gridNodeCount: nodeCount,
    gridShift: integer(value.gridShift, `${label}.gridShift`, 0, 0x7fff_ffff),
    gridSpacingM: finitePositiveF32(value.gridSpacingM, `${label}.gridSpacingM`)
  });
}

export const SCHROEDER_SPATIAL_FIRST_MOMENT_F32_OPERATION_BOUND = 16;

export function resolveSchroederSpatialFirstMomentToleranceM({
  fineGrid,
  coarseGrid
} = {}) {
  const fine = gridDescriptor(fineGrid, 'fineGrid');
  const coarse = gridDescriptor(coarseGrid, 'coarseGrid');
  const coordinateMagnitudeM = Math.max(...[fine, coarse].map((grid) => (
    Math.hypot(...grid.gridDims.map((dimension, axis) => (
      Math.max(
        Math.abs(grid.gridShift),
        Math.abs(dimension - 1 - grid.gridShift)
      ) * grid.gridSpacingM
    )))
  )));
  // The affine reproduction path performs a position multiply, up to eight
  // weighted accumulations, and a vector subtraction in f32.  Bound that
  // roundoff against the largest represented coordinate, not only one cell;
  // the old cell-only bound became spuriously tighter as N increased.
  return Math.fround(Math.max(
    1e-8,
    fine.gridSpacingM * 2 ** -18,
    coordinateMagnitudeM
      * SCHROEDER_SPATIAL_FIRST_MOMENT_F32_OPERATION_BOUND
      * 2 ** -23
  ));
}

export function createSchroederSpatialHierarchyViewLayout({
  fineNodeCapacity,
  coarseNodeCapacity
} = {}) {
  const fineCapacity = integer(fineNodeCapacity, 'fineNodeCapacity', 1);
  const coarseCapacity = integer(coarseNodeCapacity, 'coarseNodeCapacity', 1);
  const edgeCapacity = checkedMultiply(
    fineCapacity,
    SCHROEDER_SPATIAL_HIERARCHY_MAX_INTERPOLATION_EDGES_PER_FINE_NODE,
    'hierarchy interpolation edge capacity'
  );
  let cursor = SCHROEDER_SPATIAL_HIERARCHY_VIEW_DATA_OFFSET_WORDS;
  const reserve = (words, label) => {
    const offset = cursor;
    cursor = checkedAdd(cursor, words, label);
    return offset;
  };
  const fineNodeOffsetWords = reserve(fineCapacity, 'fine node range');
  const coarseNodeOffsetWords = reserve(coarseCapacity, 'coarse node range');
  const edgeCountOffsetWords = reserve(fineCapacity, 'edge count range');
  const edgeOffsetOffsetWords = reserve(fineCapacity + 1, 'edge offset range');
  const edgeParentOffsetWords = reserve(edgeCapacity, 'edge parent range');
  const edgeWeightOffsetWords = reserve(edgeCapacity, 'edge weight range');
  const parentOfFineOffsetWords = reserve(fineCapacity, 'fine parent range');
  const childCountOffsetWords = reserve(coarseCapacity, 'child count range');
  const childOffsetOffsetWords = reserve(coarseCapacity + 1, 'child offset range');
  const childIndexOffsetWords = reserve(fineCapacity, 'child index range');
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_HIERARCHY_VIEW_SCHEMA,
    headerWords: SCHROEDER_SPATIAL_HIERARCHY_VIEW_HEADER_WORDS,
    dispatchOffsetWords: SCHROEDER_SPATIAL_HIERARCHY_VIEW_DISPATCH_OFFSET_WORDS,
    fineDispatchOffsetWords:
      SCHROEDER_SPATIAL_HIERARCHY_VIEW_FINE_DISPATCH_OFFSET_WORDS,
    fineNodeCapacity: fineCapacity,
    coarseNodeCapacity: coarseCapacity,
    edgeCapacity,
    childEdgeCapacity: fineCapacity,
    fineNodeOffsetWords,
    coarseNodeOffsetWords,
    edgeCountOffsetWords,
    edgeOffsetOffsetWords,
    edgeParentOffsetWords,
    edgeWeightOffsetWords,
    parentOfFineOffsetWords,
    childCountOffsetWords,
    childOffsetOffsetWords,
    childIndexOffsetWords,
    wordLength: cursor,
    byteLength: cursor * Uint32Array.BYTES_PER_ELEMENT,
    fineCountByteLength: fineCapacity * Uint32Array.BYTES_PER_ELEMENT,
    coarseCountByteLength: coarseCapacity * Uint32Array.BYTES_PER_ELEMENT,
    coarseOccupancyWordCount: Math.ceil(coarseCapacity / 32),
    coarseOccupancyByteLength: Math.ceil(coarseCapacity / 32) * Uint32Array.BYTES_PER_ELEMENT
  });
}

export function createSchroederSpatialHierarchyViewPlan({
  fineLevel,
  coarseLevel,
  fineGrid,
  coarseGrid,
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
  completionOrdinal = generationId
} = {}) {
  const fine = integer(fineLevel, 'fineLevel', -0x8000_0000, 0x7fff_ffff);
  const coarse = integer(coarseLevel, 'coarseLevel', -0x8000_0000, 0x7fff_ffff);
  if (coarse !== fine + 1) {
    throw new RangeError('coarseLevel must equal fineLevel + 1');
  }
  const resolvedFineGrid = gridDescriptor(fineGrid, 'fineGrid');
  const resolvedCoarseGrid = gridDescriptor(coarseGrid, 'coarseGrid');
  if (
    resolvedCoarseGrid.gridSpacingM
      !== Math.fround(resolvedFineGrid.gridSpacingM * 2)
  ) {
    throw new RangeError('coarse grid spacing must be an exact 2:1 f32 ratio');
  }
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
  const layout = createSchroederSpatialHierarchyViewLayout({
    fineNodeCapacity: resolvedFineGrid.gridNodeCount,
    coarseNodeCapacity: resolvedCoarseGrid.gridNodeCount
  });
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_HIERARCHY_VIEW_SCHEMA,
    status: 'schroeder-spatial-hierarchy-view-plan-ready',
    ...identity,
    fineLevel: fine,
    coarseLevel: coarse,
    fineGrid: resolvedFineGrid,
    coarseGrid: resolvedCoarseGrid,
    layout,
    fineNodeCapacity: layout.fineNodeCapacity,
    coarseNodeCapacity: layout.coarseNodeCapacity,
    edgeCapacity: layout.edgeCapacity,
    childEdgeCapacity: layout.childEdgeCapacity,
    requiredWords: layout.wordLength,
    capacityWords: layout.wordLength,
    firstMomentToleranceM: resolveSchroederSpatialFirstMomentToleranceM({
      fineGrid: resolvedFineGrid,
      coarseGrid: resolvedCoarseGrid
    }),
    maxMechanicsLevelCount: 2,
    gpuFirst: true,
    fullParticleReadbackRequired: false
  });
}

export function validateSchroederSpatialHierarchyViewDescriptor(view, expected = {}) {
  if (!view || view.schema !== ULG_SCHROEDER_SPATIAL_HIERARCHY_VIEW_SCHEMA) {
    return { admitted: false, status: 'schroeder-spatial-hierarchy-view-rejected-schema' };
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
    'fineLevel',
    'coarseLevel'
  ]) {
    if (Object.hasOwn(expected, field) && !Object.is(view[field], expected[field])) {
      return {
        admitted: false,
        status: `schroeder-spatial-hierarchy-view-rejected-${field}`,
        field,
        expected: expected[field],
        actual: view[field]
      };
    }
  }
  if (
    view.status !== 'schroeder-spatial-hierarchy-view-gpu-build-submitted'
    || view.submitPerformed !== true
    || view.released === true
    || !view.hierarchyViewBuffer
    || view.indirectDispatchBuffer !== view.hierarchyViewBuffer
    || view.indirectDispatchOffsetBytes
      !== SCHROEDER_SPATIAL_HIERARCHY_VIEW_DISPATCH_OFFSET_WORDS
        * Uint32Array.BYTES_PER_ELEMENT
    || view.coarseLevel !== view.fineLevel + 1
    || view.coarseGrid?.gridSpacingM
      !== Math.fround(Number(view.fineGrid?.gridSpacingM) * 2)
    || view.layout?.schema !== ULG_SCHROEDER_SPATIAL_HIERARCHY_VIEW_SCHEMA
    || view.layout?.wordLength !== view.requiredWords
    || view.requiredWords !== view.capacityWords
    || view.layout?.byteLength !== view.requiredWords * Uint32Array.BYTES_PER_ELEMENT
  ) {
    return { admitted: false, status: 'schroeder-spatial-hierarchy-view-rejected-not-live' };
  }
  let ownerAdmitted = false;
  try {
    ownerAdmitted = view.ownerRuntime?.ownsExecution?.(view) === true
      && view.ownerRuntime?.isExecutionSubmitted?.(view) === true;
  } catch {
    ownerAdmitted = false;
  }
  if (!ownerAdmitted) {
    return { admitted: false, status: 'schroeder-spatial-hierarchy-view-rejected-owner' };
  }
  return { admitted: true, status: 'schroeder-spatial-hierarchy-view-consumer-admitted' };
}
