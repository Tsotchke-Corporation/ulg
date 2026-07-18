export const ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA =
  'peercompute.ulg.schroeder-spatial-parent-field-view.v1';

export const SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_MAGIC = 0x53504631;
export const SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_VERSION = 1;
export const SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_WORDS = 80;
export const SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_KEY_WORDS = 4;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MAX_EDGES_PER_FINE_FIELD = 8;
export const SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_DISPATCH_OFFSET_WORDS = 60;
export const SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_FINE_DISPATCH_OFFSET_WORDS = 64;
export const SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_COARSE_DISPATCH_OFFSET_WORDS = 68;
export const SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_PARAMS_BYTES = 320;

export const SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_INVALID_SOURCE = 1 << 3;
export const SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_CAPACITY_OVERFLOW = 1 << 4;
export const SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_LEVEL_CONTRACT = 1 << 5;
export const SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_CLIPPED_SUPPORT = 1 << 6;
export const SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_TRANSFER_RESIDUAL = 1 << 7;

export const SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_LAYOUT = Object.freeze([
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
  'fineFieldCapacity:u32',
  'coarseFieldCapacity:u32',
  'candidateCapacity:u32',
  'parentFieldCapacity:u32',
  'edgeCapacity:u32',
  'fineFieldCount:u32',
  'coarseNativeFieldCount:u32',
  'parentFieldCount:u32',
  'edgeCount:u32',
  'invalidSourceCount:u32',
  'overflowCount:u32',
  'clippedSupportCount:u32',
  'maxWeightResidual:f32-bits',
  'maxFirstMomentResidualM:f32-bits',
  'completionOrdinal:u32',
  'hierarchyCompletionOrdinal:u32',
  'fineFieldCompletionOrdinal:u32',
  'coarseFieldCompletionOrdinal:u32',
  'parentKeyOffsetWords:u32',
  'parentKeyWords:u32',
  'fineEdgeCountOffsetWords:u32',
  'fineEdgeOffsetOffsetWords:u32',
  'fineEdgeParentOffsetWords:u32',
  'fineEdgeWeightOffsetWords:u32',
  'coarseNativeMapOffsetWords:u32',
  'requiredWords:u32',
  'capacityWords:u32',
  'uniqueEvidenceGeneration:u32',
  'uniqueEvidenceElementCount:u32',
  'uniqueEvidenceCount:u32',
  'dispatchX:u32',
  'dispatchY:u32',
  'dispatchZ:u32',
  'finalizationOrdinal:u32',
  'fineDispatchX:u32',
  'fineDispatchY:u32',
  'fineDispatchZ:u32',
  'exactLevelCount:u32',
  'coarseDispatchX:u32',
  'coarseDispatchY:u32',
  'coarseDispatchZ:u32',
  'invalidKeyCount:u32',
  'emittedCandidateCount:u32',
  'nativeCandidateCount:u32',
  'fineCandidateCount:u32',
  'keyOrdering:u32',
  'maxEdgesPerFineField:u32',
  'clearedWords:u32',
  'fineMechanicsFieldAdmissionMask:u32',
  'coarseMechanicsFieldAdmissionMask:u32'
]);

export const SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_ABI = Object.freeze({
  schema: ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA,
  version: SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_VERSION,
  headerLayout: SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_LAYOUT,
  key: Object.freeze([
    'parentDenseNodeId:u32',
    'mechanicalFamilyId:u32',
    'materialId:u32',
    'continuityDomainId:u32'
  ]),
  ordering: 'stable-lexicographic-u32x4',
  levelCount: 2,
  thirdMechanicsLevel: 'forbidden-fail-closed',
  construction:
    'native-coarse-fields-plus-hierarchy-trilinear-fine-parents-stable-radix-unique',
  fineToParentTopology: 'compact-weighted-csr-exact-up-to-eight-topology-edges',
  coarseToParentTopology: 'exact-native-field-to-union-index',
  transferEvidence: 'partition-of-unity-and-first-spatial-moment',
  mutationPolicy: 'immutable-after-finalization',
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
  if (gridDims.length !== 3) {
    throw new RangeError(`${label}.gridDims must contain three values`);
  }
  const dims = gridDims.map((entry, axis) => integer(
    entry,
    `${label}.gridDims[${axis}]`,
    1,
    0x7fff_ffff
  ));
  const gridNodeCount = integer(value.gridNodeCount, `${label}.gridNodeCount`, 1);
  const product = dims.reduce((total, entry) => total * entry, 1);
  if (!Number.isSafeInteger(product) || product !== gridNodeCount) {
    throw new RangeError(`${label}.gridNodeCount must equal the gridDims product`);
  }
  return Object.freeze({
    gridNodeCount,
    gridDims: Object.freeze(dims),
    gridShift: integer(value.gridShift, `${label}.gridShift`, 0, 0x7fff_ffff),
    gridSpacingM: finitePositiveF32(value.gridSpacingM, `${label}.gridSpacingM`)
  });
}

export function createSchroederSpatialParentFieldViewLayout({
  fineFieldCapacity,
  coarseFieldCapacity
} = {}) {
  const fineCapacity = integer(fineFieldCapacity, 'fineFieldCapacity', 1);
  const coarseCapacity = integer(coarseFieldCapacity, 'coarseFieldCapacity', 1);
  const fineCandidateCapacity = checkedMultiply(
    fineCapacity,
    SCHROEDER_SPATIAL_PARENT_FIELD_MAX_EDGES_PER_FINE_FIELD,
    'fine parent-field candidate capacity'
  );
  const candidateCapacity = checkedAdd(
    fineCandidateCapacity,
    coarseCapacity,
    'parent-field candidate capacity'
  );
  const parentFieldCapacity = candidateCapacity;
  const edgeCapacity = fineCandidateCapacity;
  let cursor = SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_WORDS;
  const reserve = (words, label) => {
    const offset = cursor;
    cursor = checkedAdd(cursor, words, label);
    return offset;
  };
  const parentKeyOffsetWords = reserve(
    checkedMultiply(
      parentFieldCapacity,
      SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_KEY_WORDS,
      'parent-field key range'
    ),
    'parent-field key end'
  );
  const fineEdgeCountOffsetWords = reserve(fineCapacity, 'fine edge-count end');
  const fineEdgeOffsetOffsetWords = reserve(fineCapacity + 1, 'fine edge-offset end');
  const fineEdgeParentOffsetWords = reserve(edgeCapacity, 'fine edge-parent end');
  const fineEdgeWeightOffsetWords = reserve(edgeCapacity, 'fine edge-weight end');
  const coarseNativeMapOffsetWords = reserve(coarseCapacity, 'coarse-native map end');
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA,
    headerWords: SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_WORDS,
    dispatchOffsetWords: SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_DISPATCH_OFFSET_WORDS,
    fineDispatchOffsetWords:
      SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_FINE_DISPATCH_OFFSET_WORDS,
    coarseDispatchOffsetWords:
      SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_COARSE_DISPATCH_OFFSET_WORDS,
    keyWords: SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_KEY_WORDS,
    fineFieldCapacity: fineCapacity,
    coarseFieldCapacity: coarseCapacity,
    fineCandidateCapacity,
    candidateCapacity,
    parentFieldCapacity,
    edgeCapacity,
    parentKeyOffsetWords,
    fineEdgeCountOffsetWords,
    fineEdgeOffsetOffsetWords,
    fineEdgeParentOffsetWords,
    fineEdgeWeightOffsetWords,
    coarseNativeMapOffsetWords,
    wordLength: cursor,
    byteLength: cursor * Uint32Array.BYTES_PER_ELEMENT,
    candidateKeyByteLength:
      candidateCapacity
      * SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_KEY_WORDS
      * Uint32Array.BYTES_PER_ELEMENT,
    candidateMapByteLength: candidateCapacity * Uint32Array.BYTES_PER_ELEMENT,
    fineCountByteLength: fineCapacity * Uint32Array.BYTES_PER_ELEMENT
  });
}

export function createSchroederSpatialParentFieldViewPlan({
  fineLevel,
  coarseLevel,
  levelCount = 2,
  fineGrid,
  coarseGrid,
  fineFieldCapacity,
  coarseFieldCapacity,
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
  const exactLevelCount = integer(levelCount, 'levelCount', 0, 3);
  if (exactLevelCount !== 2) {
    throw new RangeError('parent-field topology requires exactly two mechanics levels');
  }
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
  const layout = createSchroederSpatialParentFieldViewLayout({
    fineFieldCapacity,
    coarseFieldCapacity
  });
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA,
    status: 'schroeder-spatial-parent-field-view-plan-ready',
    ...identity,
    fineLevel: fine,
    coarseLevel: coarse,
    exactLevelCount,
    fineGrid: resolvedFineGrid,
    coarseGrid: resolvedCoarseGrid,
    fineFieldCapacity: layout.fineFieldCapacity,
    coarseFieldCapacity: layout.coarseFieldCapacity,
    candidateCapacity: layout.candidateCapacity,
    parentFieldCapacity: layout.parentFieldCapacity,
    edgeCapacity: layout.edgeCapacity,
    requiredWords: layout.wordLength,
    capacityWords: layout.wordLength,
    layout,
    deterministicOrdering: 'stable-lexicographic-u32x4',
    maxEdgesPerFineField:
      SCHROEDER_SPATIAL_PARENT_FIELD_MAX_EDGES_PER_FINE_FIELD,
    gpuFirst: true,
    fullParticleReadbackRequired: false
  });
}

function normalizeKeyRows(value, label) {
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) {
    throw new TypeError(`${label} must be an array-like key collection`);
  }
  const flat = ArrayBuffer.isView(value) || (value.length > 0 && !Array.isArray(value[0]));
  const rows = flat
    ? Array.from({ length: value.length / 4 }, (_, index) => (
        Array.from(value).slice(index * 4, index * 4 + 4)
      ))
    : Array.from(value, (entry) => Array.from(entry || []));
  if ((flat && value.length % 4 !== 0) || rows.some((entry) => entry.length !== 4)) {
    throw new RangeError(`${label} must contain exact u32x4 keys`);
  }
  return rows.map((entry, row) => entry.map((word, column) => (
    integer(word, `${label}[${row}][${column}]`)
  )));
}

function denseCoords(index, dims) {
  const plane = dims[1] * dims[2];
  const x = Math.floor(index / plane);
  const remainder = index - x * plane;
  return [x, Math.floor(remainder / dims[2]), remainder % dims[2]];
}

function keyCompare(left, right) {
  for (let word = 0; word < 4; word += 1) {
    if (left[word] !== right[word]) return left[word] - right[word];
  }
  return 0;
}

function keyString(key) {
  return key.join(':');
}

export function buildSchroederSpatialParentFieldTopologyCpuOracle({
  fineFieldKeys,
  coarseFieldKeys,
  hierarchy,
  fineGrid,
  coarseGrid
} = {}) {
  const fineKeys = normalizeKeyRows(fineFieldKeys, 'fineFieldKeys');
  const coarseKeys = normalizeKeyRows(coarseFieldKeys, 'coarseFieldKeys');
  const fine = gridDescriptor(fineGrid, 'fineGrid');
  const coarse = gridDescriptor(coarseGrid, 'coarseGrid');
  if (coarse.gridSpacingM !== Math.fround(fine.gridSpacingM * 2)) {
    throw new RangeError('CPU oracle requires exact 2:1 grid spacing');
  }
  const fineNodes = Array.from(hierarchy?.fineNodes || [], (value, index) => (
    integer(value, `hierarchy.fineNodes[${index}]`, 0, fine.gridNodeCount - 1)
  ));
  const coarseNodes = Array.from(hierarchy?.coarseNodes || [], (value, index) => (
    integer(value, `hierarchy.coarseNodes[${index}]`, 0, coarse.gridNodeCount - 1)
  ));
  const hierarchyOffsets = Array.from(hierarchy?.edgeOffsets || [], (value, index) => (
    integer(value, `hierarchy.edgeOffsets[${index}]`)
  ));
  const hierarchyParents = Array.from(hierarchy?.edgeParents || [], (value, index) => (
    integer(value, `hierarchy.edgeParents[${index}]`, 0, Math.max(0, coarseNodes.length - 1))
  ));
  const hierarchyWeights = Array.from(hierarchy?.edgeWeights || [], (value, index) => {
    const number = Math.fround(Number(value));
    if (!Number.isFinite(number) || !(number > 0)) {
      throw new RangeError(`hierarchy.edgeWeights[${index}] must be positive finite f32`);
    }
    return number;
  });
  if (
    hierarchyOffsets.length !== fineNodes.length + 1
    || hierarchyOffsets[0] !== 0
    || hierarchyOffsets.at(-1) !== hierarchyParents.length
    || hierarchyParents.length !== hierarchyWeights.length
    || hierarchyOffsets.some((value, index) => index > 0 && value < hierarchyOffsets[index - 1])
  ) {
    throw new RangeError('hierarchy must provide one exact monotonic fine-node edge CSR');
  }
  const fineNodeIndex = new Map(fineNodes.map((dense, compact) => [dense, compact]));
  const candidates = [];
  const fineCandidateRows = [];
  let maxWeightResidual = 0;
  let maxFirstMomentResidualM = 0;
  for (const [fineFieldIndex, key] of fineKeys.entries()) {
    const compact = fineNodeIndex.get(key[0]);
    if (compact == null) {
      throw new RangeError(`fine field ${fineFieldIndex} is absent from the admitted hierarchy`);
    }
    const begin = hierarchyOffsets[compact];
    const end = hierarchyOffsets[compact + 1];
    if (end - begin < 1 || end - begin > 8) {
      throw new RangeError(`fine field ${fineFieldIndex} does not have 1..8 hierarchy edges`);
    }
    const rows = [];
    let sum = 0;
    const reproduced = [0, 0, 0];
    for (let edge = begin; edge < end; edge += 1) {
      const parentDense = coarseNodes[hierarchyParents[edge]];
      const weight = hierarchyWeights[edge];
      const parentKey = [parentDense, key[1], key[2], key[3]];
      const candidate = { key: parentKey, weight, ordinal: candidates.length };
      candidates.push(candidate);
      rows.push(candidate);
      sum += weight;
      const coords = denseCoords(parentDense, coarse.gridDims);
      for (let axis = 0; axis < 3; axis += 1) {
        reproduced[axis] += weight
          * (coords[axis] - coarse.gridShift)
          * coarse.gridSpacingM;
      }
    }
    const fineCoords = denseCoords(key[0], fine.gridDims);
    const target = fineCoords.map(
      (coordinate) => (coordinate - fine.gridShift) * fine.gridSpacingM
    );
    maxWeightResidual = Math.max(maxWeightResidual, Math.abs(sum - 1));
    maxFirstMomentResidualM = Math.max(
      maxFirstMomentResidualM,
      Math.hypot(...reproduced.map((value, axis) => value - target[axis]))
    );
    fineCandidateRows.push(rows);
  }
  const coarseCandidates = coarseKeys.map((key) => {
    const candidate = { key, weight: 1, ordinal: candidates.length };
    candidates.push(candidate);
    return candidate;
  });
  const sorted = candidates.slice().sort((left, right) => (
    keyCompare(left.key, right.key) || left.ordinal - right.ordinal
  ));
  const parentFieldKeys = [];
  const parentIndexByKey = new Map();
  for (const candidate of sorted) {
    const encoded = keyString(candidate.key);
    if (!parentIndexByKey.has(encoded)) {
      parentIndexByKey.set(encoded, parentFieldKeys.length);
      parentFieldKeys.push(candidate.key.slice());
    }
  }
  const fineEdgeOffsets = [0];
  const fineEdgeParentIndices = [];
  const fineEdgeWeights = [];
  for (const rows of fineCandidateRows) {
    for (const candidate of rows) {
      fineEdgeParentIndices.push(parentIndexByKey.get(keyString(candidate.key)));
      fineEdgeWeights.push(candidate.weight);
    }
    fineEdgeOffsets.push(fineEdgeParentIndices.length);
  }
  const coarseNativeToParentField = coarseCandidates.map((candidate) => (
    parentIndexByKey.get(keyString(candidate.key))
  ));
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA,
    status: 'schroeder-spatial-parent-field-topology-cpu-oracle-complete',
    parentFieldKeys: Object.freeze(parentFieldKeys.map((key) => Object.freeze(key))),
    fineEdgeOffsets: Object.freeze(fineEdgeOffsets),
    fineEdgeParentIndices: Object.freeze(fineEdgeParentIndices),
    fineEdgeWeights: Object.freeze(fineEdgeWeights),
    coarseNativeToParentField: Object.freeze(coarseNativeToParentField),
    maxWeightResidual,
    maxFirstMomentResidualM
  });
}

export function validateSchroederSpatialParentFieldViewDescriptor(view, expected = {}) {
  if (!view || view.schema !== ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA) {
    return {
      admitted: false,
      status: 'schroeder-spatial-parent-field-view-rejected-schema'
    };
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
    'coarseLevel',
    'exactLevelCount'
  ]) {
    if (Object.hasOwn(expected, field) && !Object.is(view[field], expected[field])) {
      return {
        admitted: false,
        status: `schroeder-spatial-parent-field-view-rejected-${field}`,
        field,
        expected: expected[field],
        actual: view[field]
      };
    }
  }
  let expectedLayout;
  try {
    expectedLayout = createSchroederSpatialParentFieldViewLayout({
      fineFieldCapacity: view.fineFieldCapacity,
      coarseFieldCapacity: view.coarseFieldCapacity
    });
  } catch {
    return {
      admitted: false,
      status: 'schroeder-spatial-parent-field-view-rejected-layout'
    };
  }
  if (
    view.status !== 'schroeder-spatial-parent-field-view-gpu-build-submitted'
    || view.submitPerformed !== true
    || view.released === true
    || view.exactLevelCount !== 2
    || view.coarseLevel !== view.fineLevel + 1
    || view.coarseGrid?.gridSpacingM
      !== Math.fround(Number(view.fineGrid?.gridSpacingM) * 2)
    || !Array.isArray(view.mechanicsFieldViews)
    || view.mechanicsFieldViews.length !== 2
    || view.mechanicsFieldViews[0] !== view.fineFieldView
    || view.mechanicsFieldViews[1] !== view.coarseFieldView
    || !view.hierarchyView
    || !view.parentFieldViewBuffer
    || view.indirectDispatchBuffer !== view.parentFieldViewBuffer
    || view.indirectDispatchOffsetBytes
      !== SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_DISPATCH_OFFSET_WORDS
        * Uint32Array.BYTES_PER_ELEMENT
    || view.fineIndirectDispatchBuffer !== view.parentFieldViewBuffer
    || view.fineIndirectDispatchOffsetBytes
      !== SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_FINE_DISPATCH_OFFSET_WORDS
        * Uint32Array.BYTES_PER_ELEMENT
    || view.coarseIndirectDispatchBuffer !== view.parentFieldViewBuffer
    || view.coarseIndirectDispatchOffsetBytes
      !== SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_COARSE_DISPATCH_OFFSET_WORDS
        * Uint32Array.BYTES_PER_ELEMENT
    || view.layout?.schema !== ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA
    || view.layout?.wordLength !== expectedLayout.wordLength
    || view.layout?.byteLength !== expectedLayout.byteLength
    || view.layout?.candidateCapacity !== expectedLayout.candidateCapacity
    || view.layout?.edgeCapacity !== expectedLayout.edgeCapacity
    || view.requiredWords !== expectedLayout.wordLength
    || view.capacityWords !== expectedLayout.wordLength
    || (Number.isFinite(Number(view.parentFieldViewBuffer.size))
      && Number(view.parentFieldViewBuffer.size) < expectedLayout.byteLength)
  ) {
    return {
      admitted: false,
      status: 'schroeder-spatial-parent-field-view-rejected-not-live'
    };
  }
  let ownerAdmitted = false;
  let hierarchyAdmitted = false;
  let fieldsAdmitted = false;
  try {
    ownerAdmitted = view.ownerRuntime?.ownsExecution?.(view) === true
      && view.ownerRuntime?.isExecutionSubmitted?.(view) === true;
    hierarchyAdmitted = view.hierarchyView.ownerRuntime?.ownsExecution?.(
      view.hierarchyView
    ) === true
      && view.hierarchyView.ownerRuntime?.isExecutionSubmitted?.(
        view.hierarchyView
      ) === true;
    fieldsAdmitted = view.mechanicsFieldViews.every((fieldView) => (
      fieldView?.ownerRuntime?.ownsExecution?.(fieldView) === true
      && fieldView?.ownerRuntime?.isExecutionSubmitted?.(fieldView) === true
    ));
  } catch {
    ownerAdmitted = false;
    hierarchyAdmitted = false;
    fieldsAdmitted = false;
  }
  if (!ownerAdmitted || !hierarchyAdmitted || !fieldsAdmitted) {
    return {
      admitted: false,
      status: 'schroeder-spatial-parent-field-view-rejected-owner'
    };
  }
  return {
    admitted: true,
    status: 'schroeder-spatial-parent-field-view-consumer-admitted'
  };
}
