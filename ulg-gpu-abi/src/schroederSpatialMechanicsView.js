export const ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA =
  'peercompute.ulg.schroeder-spatial-mechanics-view.v1';

export const SCHROEDER_SPATIAL_MECHANICS_VIEW_MAGIC = 0x534d5631;
export const SCHROEDER_SPATIAL_MECHANICS_VIEW_VERSION = 1;
export const SCHROEDER_SPATIAL_MECHANICS_VIEW_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPATIAL_MECHANICS_VIEW_EVIDENCE_WORDS = 20;
export const SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_OFFSET_WORDS =
  SCHROEDER_SPATIAL_MECHANICS_VIEW_EVIDENCE_WORDS;
export const SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_WORDS = 40;
export const SCHROEDER_SPATIAL_MECHANICS_VIEW_NODE_OFFSET_WORDS = 64;
export const SCHROEDER_SPATIAL_MECHANICS_VIEW_DISPATCH_OFFSET_WORDS = 60;
export const SCHROEDER_SPATIAL_MECHANICS_VIEW_PARAMS_BYTES = 192;

export const SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0 = 1;
export const SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_ACTIVE_NODE_V0 = 2;
export const SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V1 = 1;
export const SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2 = 2;
export const SCHROEDER_SPATIAL_MECHANICS_VIEW_PHYSICAL_WORK_IDENTITY =
  'stable-physical-source-index';
export const SCHROEDER_SPATIAL_MECHANICS_VIEW_ACTIVE_WORK_IDENTITY =
  'gpu-active-ordinal';

export const SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_INVALID_SOURCE = 1 << 3;
export const SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_CAPACITY_OVERFLOW = 1 << 4;

export const SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_LAYOUT = Object.freeze([
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
  'selectedLevel:i32-bits',
  'gridNodeCount:u32',
  'gridDimX:u32',
  'gridDimY:u32',
  'gridDimZ:u32',
  'gridShift:u32',
  'gridSpacingM:f32-bits',
  'occupancyWordCount:u32',
  'nodeCapacity:u32',
  'nodeCount:u32',
  'invalidSourceCount:u32',
  'overflowCount:u32',
  'attemptedSourceCount:u32',
  'selectedSourceCount:u32',
  'stencilVisitCount:u32',
  'completionOrdinal:u32',
  'nodeOffsetWords:u32',
  'requiredWords:u32',
  'capacityWords:u32',
  'sourceRowLayoutId:u32',
  'dispatchX:u32',
  'clearedWords:u32',
  'directoryGenerationId:u32'
]);

export const SCHROEDER_SPATIAL_MECHANICS_VIEW_ABI = Object.freeze({
  schema: ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA,
  version: SCHROEDER_SPATIAL_MECHANICS_VIEW_VERSION,
  headerOffsetWords: SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_OFFSET_WORDS,
  headerLayout: SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_LAYOUT,
  nodeOffsetWords: SCHROEDER_SPATIAL_MECHANICS_VIEW_NODE_OFFSET_WORDS,
  dispatchOffsetWords: SCHROEDER_SPATIAL_MECHANICS_VIEW_DISPATCH_OFFSET_WORDS,
  nodeIdentity: 'ascending-unique-dense-grid-storage-index-u32',
  construction:
    'directory-authenticated-particle-stencil-bitset-popcount-exclusive-scan',
  sourceAuthority:
    'ss-spatial-epoch-v1-physical-or-v2-active-source-projection-and-physical-reverse',
  dispatchAuthority: 'gpu-finalized-node-count-indirect-dispatch',
  directoryVersions: Object.freeze({
    1: Object.freeze({
      sourceWorkIdentity:
        SCHROEDER_SPATIAL_MECHANICS_VIEW_PHYSICAL_WORK_IDENTITY,
      sourceDispatchAuthority: 'host-physical-count'
    }),
    2: Object.freeze({
      sourceWorkIdentity:
        SCHROEDER_SPATIAL_MECHANICS_VIEW_ACTIVE_WORK_IDENTITY,
      sourceDispatchAuthority:
        'retained-active-source-view-v1-gpu-indirect-dispatch',
      publicSourceIdentity: 'stable-physical-source-slot-u32',
      activeCountReadback: false,
      emptyActiveSet: 'admitted-zero-node-zero-consumer-dispatch'
    })
  }),
  particleAlignment: false,
  overflowPolicy: 'fail-closed-zero-indirect-dispatch',
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

function finitePositive(value, label) {
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

export function createSchroederSpatialMechanicsViewLayout({
  gridNodeCapacity
} = {}) {
  const nodeCapacity = integer(gridNodeCapacity, 'gridNodeCapacity', 1);
  const occupancyWordCount = Math.ceil(nodeCapacity / 32);
  const wordLength = checkedAdd(
    SCHROEDER_SPATIAL_MECHANICS_VIEW_NODE_OFFSET_WORDS,
    nodeCapacity,
    'mechanics view word length'
  );
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA,
    evidenceWords: SCHROEDER_SPATIAL_MECHANICS_VIEW_EVIDENCE_WORDS,
    headerOffsetWords: SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_OFFSET_WORDS,
    headerWords: SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_WORDS,
    nodeOffsetWords: SCHROEDER_SPATIAL_MECHANICS_VIEW_NODE_OFFSET_WORDS,
    dispatchOffsetWords: SCHROEDER_SPATIAL_MECHANICS_VIEW_DISPATCH_OFFSET_WORDS,
    nodeCapacity,
    occupancyWordCount,
    wordLength,
    byteLength: wordLength * Uint32Array.BYTES_PER_ELEMENT,
    occupancyByteLength: occupancyWordCount * Uint32Array.BYTES_PER_ELEMENT,
    wordCountByteLength: occupancyWordCount * Uint32Array.BYTES_PER_ELEMENT
  });
}

export function createSchroederSpatialMechanicsViewPlan({
  sourceCount,
  sourceRowLayoutId = SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
  directoryAbiVersion =
    SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V1,
  selectedLevel = 0,
  gridNodeCount,
  gridDims,
  gridShift,
  gridSpacingM,
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
  const resolvedSourceCount = integer(sourceCount, 'sourceCount', 1);
  const resolvedDirectoryAbiVersion = integer(
    directoryAbiVersion,
    'directoryAbiVersion',
    SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V1,
    SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2
  );
  if (!Array.isArray(gridDims) && !ArrayBuffer.isView(gridDims)) {
    throw new TypeError('gridDims must be an array-like [x, y, z] value');
  }
  if (gridDims.length !== 3) {
    throw new RangeError('gridDims must contain exactly three values');
  }
  const resolvedGridDims = [...gridDims].map((value, axis) => (
    integer(value, `gridDims[${axis}]`, 1, 0x7fff_ffff)
  ));
  const resolvedGridNodeCount = integer(gridNodeCount, 'gridNodeCount', 1);
  const gridProduct = resolvedGridDims.reduce((product, value) => product * value, 1);
  if (!Number.isSafeInteger(gridProduct) || gridProduct !== resolvedGridNodeCount) {
    throw new RangeError('gridNodeCount must equal gridDims[0] * gridDims[1] * gridDims[2]');
  }
  const layout = createSchroederSpatialMechanicsViewLayout({
    gridNodeCapacity: resolvedGridNodeCount
  });
  const rowLayout = integer(sourceRowLayoutId, 'sourceRowLayoutId', 1, 2);
  if (
    resolvedDirectoryAbiVersion
      === SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2
    && rowLayout !== SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0
  ) {
    throw new RangeError(
      'directory v2 mechanics work is level-assignment-only'
    );
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
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA,
    status: 'schroeder-spatial-mechanics-view-plan-ready',
    ...identity,
    sourceCount: resolvedSourceCount,
    physicalSourceCount: resolvedSourceCount,
    sourceRowLayoutId: rowLayout,
    sourceRowStrideFloats: 16,
    directoryAbiVersion: resolvedDirectoryAbiVersion,
    sourceAuthorityVersion: resolvedDirectoryAbiVersion,
    sourceWorkIdentity: resolvedDirectoryAbiVersion
      === SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2
      ? SCHROEDER_SPATIAL_MECHANICS_VIEW_ACTIVE_WORK_IDENTITY
      : SCHROEDER_SPATIAL_MECHANICS_VIEW_PHYSICAL_WORK_IDENTITY,
    gpuAuthoredActiveSourceCount: resolvedDirectoryAbiVersion
      === SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2,
    selectedLevel: integer(
      selectedLevel,
      'selectedLevel',
      -0x8000_0000,
      0x7fff_ffff
    ),
    gridNodeCount: resolvedGridNodeCount,
    gridDims: Object.freeze(resolvedGridDims),
    gridShift: integer(gridShift, 'gridShift', 0, 0x7fff_ffff),
    gridSpacingM: finitePositive(gridSpacingM, 'gridSpacingM'),
    layout,
    nodeCapacity: layout.nodeCapacity,
    occupancyWordCount: layout.occupancyWordCount,
    requiredWords: layout.wordLength,
    capacityWords: layout.wordLength,
    indirectDispatchByteLength: 3 * Uint32Array.BYTES_PER_ELEMENT,
    deterministicOrdering: 'ascending-dense-grid-storage-index',
    fullParticleReadbackRequired: false
  });
}

export function validateSchroederSpatialMechanicsViewDescriptor(view, expected = {}) {
  if (!view || view.schema !== ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA) {
    return { admitted: false, status: 'schroeder-spatial-mechanics-view-rejected-schema' };
  }
  const checks = [
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
    'physicalSourceCount',
    'sourceRowLayoutId',
    'directorySchema',
    'directoryAbiVersion',
    'sourceAuthorityVersion',
    'sourceWorkIdentity',
    'selectedLevel',
    'gridNodeCount',
    'gridShift',
    'gridSpacingM'
  ];
  for (const field of checks) {
    if (Object.hasOwn(expected, field) && !Object.is(view[field], expected[field])) {
      return {
        admitted: false,
        status: `schroeder-spatial-mechanics-view-rejected-${field}`,
        field,
        expected: expected[field],
        actual: view[field]
      };
    }
  }
  if (Object.hasOwn(expected, 'gridDims')) {
    const expectedGridDims = Array.from(expected.gridDims || []);
    const actualGridDims = Array.from(view.gridDims || []);
    if (
      expectedGridDims.length !== 3
      || actualGridDims.length !== 3
      || expectedGridDims.some((value, axis) => !Object.is(value, actualGridDims[axis]))
    ) {
      return {
        admitted: false,
        status: 'schroeder-spatial-mechanics-view-rejected-gridDims',
        field: 'gridDims',
        expected: expectedGridDims,
        actual: actualGridDims
      };
    }
  }
  if (
    view.status !== 'schroeder-spatial-mechanics-view-gpu-build-submitted'
    || view.submitPerformed !== true
    || view.released === true
    || !view.mechanicsViewBuffer
    || !view.indirectDispatchBuffer
    || view.indirectDispatchBuffer !== view.mechanicsViewBuffer
    || view.indirectDispatchOffsetBytes
      !== SCHROEDER_SPATIAL_MECHANICS_VIEW_DISPATCH_OFFSET_WORDS
        * Uint32Array.BYTES_PER_ELEMENT
  ) {
    return {
      admitted: false,
      status: 'schroeder-spatial-mechanics-view-rejected-not-live'
    };
  }
  const directoryAbiVersion = Number(
    view.directoryAbiVersion
      ?? SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V1
  );
  if (
    directoryAbiVersion
      !== SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V1
    && directoryAbiVersion
      !== SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2
  ) {
    return {
      admitted: false,
      status:
        'schroeder-spatial-mechanics-view-rejected-directory-abi-version'
    };
  }
  if (
    directoryAbiVersion
      === SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2
    && (
      view.sourceRowLayoutId
        !== SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0
      || view.directorySchema
        !== 'peercompute.ulg.schroeder-spatial-epoch.v2'
      || view.sourceAuthorityVersion
        !== SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2
      || view.physicalSourceCount !== view.sourceCount
      || view.sourceWorkIdentity
        !== SCHROEDER_SPATIAL_MECHANICS_VIEW_ACTIVE_WORK_IDENTITY
      || !view.spatialExecution
      || view.spatialExecution.schema !== view.directorySchema
      || view.spatialExecution.directoryBuffer !== view.directoryBuffer
      || view.spatialExecution.sourceBuffer !== view.sourceBuffer
      || !view.activeSourceView
      || !view.activeSourceViewBuffer
      || view.activeSourceViewBuffer
        !== view.activeSourceView.activeSourceViewBuffer
      || view.spatialExecution.activeSourceView !== view.activeSourceView
      || view.spatialExecution.activeSourceViewBuffer
        !== view.activeSourceViewBuffer
      || view.activeSourceCountAuthority?.activeSourceView
        !== view.activeSourceView
      || view.activeSourceCountAuthority?.buffer
        !== view.activeSourceViewBuffer
      || view.activeSourceDispatchOffsetBytes
        !== view.activeSourceView.activeDispatchOffsetBytes
    )
  ) {
    return {
      admitted: false,
      status:
        'schroeder-spatial-mechanics-view-rejected-v2-source-authority'
    };
  }
  const gridDims = Array.from(view.gridDims || []);
  const gridNodeCount = Number(view.gridNodeCount);
  const occupancyWordCount = Math.ceil(gridNodeCount / 32);
  const expectedWordLength = SCHROEDER_SPATIAL_MECHANICS_VIEW_NODE_OFFSET_WORDS
    + gridNodeCount;
  if (
    gridDims.length !== 3
    || gridDims.some((value) => !Number.isInteger(value) || value < 1)
    || gridDims.reduce((product, value) => product * value, 1) !== gridNodeCount
    || view.nodeCapacity !== gridNodeCount
    || view.occupancyWordCount !== occupancyWordCount
    || view.requiredWords !== expectedWordLength
    || view.capacityWords !== expectedWordLength
    || view.layout?.schema !== ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA
    || view.layout?.headerOffsetWords
      !== SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_OFFSET_WORDS
    || view.layout?.headerWords !== SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_WORDS
    || view.layout?.dispatchOffsetWords
      !== SCHROEDER_SPATIAL_MECHANICS_VIEW_DISPATCH_OFFSET_WORDS
    || view.layout?.nodeOffsetWords
      !== SCHROEDER_SPATIAL_MECHANICS_VIEW_NODE_OFFSET_WORDS
    || view.layout?.nodeCapacity !== gridNodeCount
    || view.layout?.occupancyWordCount !== occupancyWordCount
    || view.layout?.wordLength !== expectedWordLength
    || view.layout?.byteLength !== expectedWordLength * Uint32Array.BYTES_PER_ELEMENT
  ) {
    return {
      admitted: false,
      status: 'schroeder-spatial-mechanics-view-rejected-layout'
    };
  }
  if (
    (Number.isFinite(Number(view.mechanicsViewBuffer.size))
      && Number(view.mechanicsViewBuffer.size)
        < expectedWordLength * Uint32Array.BYTES_PER_ELEMENT)
    || (Number.isFinite(Number(view.indirectDispatchBuffer.size))
      && Number(view.indirectDispatchBuffer.size)
        < (view.indirectDispatchOffsetBytes
          + 3 * Uint32Array.BYTES_PER_ELEMENT))
  ) {
    return {
      admitted: false,
      status: 'schroeder-spatial-mechanics-view-rejected-buffer-size'
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
      status: 'schroeder-spatial-mechanics-view-rejected-owner'
    };
  }
  return {
    admitted: true,
    status: 'schroeder-spatial-mechanics-view-consumer-admitted'
  };
}
