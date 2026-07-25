export const ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA =
  'peercompute.ulg.schroeder-spatial-mechanics-field-view.v4';

export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC = 0x53464634;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION = 4;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS = 64;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DESCRIPTOR_WORDS = 32;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS = 4;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_ACCUMULATOR_WORDS = 8;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS = 36;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATE_WORDS = 8;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS = 4;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STENCIL_SIZE = 27;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS = 60;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PARAMS_BYTES = 192;

export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_INVALID_SOURCE = 1 << 3;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_CAPACITY_OVERFLOW = 1 << 4;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_UNIQUE_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_UNIQUE_STATUS_UNIFORM_PARENT = 1 << 1;

// Header word 59 is a GPU-authenticated phase tag for the mutable state rows.
// P2G publishes mass/momentum/gradient; grid update (or a conservative
// cross-level publisher) transitions those same rows to mass/velocity/gradient.
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY = 0;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT = 1;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT = 2;

// Once stable-order P2G has materialized the immutable state rows, the still-zero
// field accumulator bank becomes the field-local energy sidecar. The receipt tail is
// deliberately outside the per-field rows so it can gate clear/build/consume
// without duplicating the full keyed field dictionary or adding a binding.
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_MAGIC = 0x53465233;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_VERSION = 3;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_EMPTY = 0;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_P2G_FINALIZED = 1;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_HEAT_CLEARING = 2;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_HEAT_BUILDING = 3;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_ENERGY_READY = 4;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_G2P_CLAIMED = 5;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_CONSUMED = 6;

export const SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_LAW_EXACT_P2G = 1;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_MAGIC = 0x53504631;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_VERSION = 1;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_FAIL_CLOSED =
  1 << 2;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_LOCAL =
  1 << 0;
export const SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_CROSS_LEVEL =
  1 << 1;

export const SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_ROW_LAYOUT =
  Object.freeze([
    'pressureVolumeMomentPaM3:f32-bits',
    'representedCurrentVolumeM3:f32-bits',
    'absolutePressurePa:f32-bits',
    'contributionCount:u32'
  ]);

export const SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_LAYOUT = Object.freeze([
  'magic:u32',
  'abiVersion:u32',
  'statusFlags:u32',
  'phase:u32',
  'macroSubstepOrdinal:u32',
  'fieldMutationOrdinal:u32',
  'fieldCount:u32',
  'heatContributionCount:u32',
  'totalHeatJ:f32-bits',
  'publishedHeatJ:f32-bits',
  'consumedHeatJ:f32-bits',
  'maxSpecificHeatJPerKg:f32-bits',
  'macroLedgerGeneration:u32',
  'maxFineCflRatio:f32-bits',
  'partitionOfUnityResidual:f32-bits',
  'firstMomentResidualM:f32-bits',
  'totalPressureInternalCompensationJ:f32-bits',
  'publishedPressureInternalCompensationJ:f32-bits',
  'consumedPressureInternalCompensationJ:f32-bits',
  'measuredParticleInternalEnergyDeltaJ:f32-bits',
  'totalAmbientImpulseXNs:f32-bits',
  'totalAmbientImpulseYNs:f32-bits',
  'totalAmbientImpulseZNs:f32-bits',
  'totalAmbientExternalWorkJ:f32-bits',
  'pressureMagic:u32',
  'pressureVersion:u32',
  'pressureStatusFlags:u32',
  'pressureLawId:u32',
  'pressureAmbientPa:f32-bits',
  'pressureInternalScale:f32-bits',
  'pressureFieldCount:u32',
  'pressureSourceMutationOrdinal:u32',
  'pressureRequiredConsumerMask:u32',
  'pressureClaimedConsumerMask:u32',
  'pressureConsumedConsumerMask:u32',
  'pressureSeal:u32'
]);

export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_LAYOUT = Object.freeze([
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
  'descriptorOffsetWords:u32',
  'descriptorWords:u32',
  'keyOffsetWords:u32',
  'keyWords:u32',
  'accumulatorOffsetWords:u32',
  'accumulatorWords:u32',
  'stateOffsetWords:u32',
  'stateWords:u32',
  'fieldCapacity:u32',
  'candidateCount:u32',
  'fieldCount:u32',
  'invalidSourceCount:u32',
  'clippedCandidateCount:u32',
  'overflowCount:u32',
  'completionOrdinal:u32',
  'sourceRowLayoutId:u32',
  'identityStrideWords:u32',
  'requiredWords:u32',
  'capacityWords:u32',
  'clearedAccumulatorWords:u32',
  'dispatchX:u32',
  'dispatchY:u32',
  'dispatchZ:u32',
  'parentMechanicsViewMagic:u32',
  'parentMechanicsViewVersion:u32',
  'parentMechanicsNodeCapacity:u32',
  'uniqueEvidenceGeneration:u32',
  'uniqueEvidenceElementCount:u32',
  'uniqueEvidenceCount:u32',
  'uniqueEvidenceStatus:u32',
  'descriptorCount:u32',
  'keyOrdering:u32',
  'continuityPolicy:u32',
  'mechanicalFamilyPolicy:u32',
  'invalidFieldKeyCount:u32',
  'stateEncoding:u32',
  'dispatchIndirectX:u32',
  'dispatchIndirectY:u32',
  'dispatchIndirectZ:u32',
  'stateMutationOrdinal:u32'
]);

export const SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_ABI = Object.freeze({
  schema: ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
  version: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION,
  headerLayout: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_LAYOUT,
  key: Object.freeze([
    'denseGridNodeId:u32',
    'mechanicalFamilyId:u32',
    'materialId:u32',
    'continuityDomainId:u32'
  ]),
  descriptor: Object.freeze([
    'mechanicalFamilyId:u32',
    'materialId:u32',
    'continuityDomainId:u32',
    'status:u32',
    'stencilFieldIndex[27]:u32',
    'reserved:u32'
  ]),
  ordering: 'stable-lexicographic-u32x4',
  mechanicalFamilyPolicy: 'dominant-thermodynamic-phase-id',
  continuityPolicy:
    'solid-initial-body-domain;non-solid-material-continuum-domain-zero',
  construction:
    'gpu-authenticated-particle-stencil-packed-u32x3-stable-radix-scan-unique-to-public-u32x4',
  constructionEvidenceStatusWord: 53,
  constructionEvidenceStatuses: Object.freeze({
    ready: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_UNIQUE_STATUS_READY,
    uniformParent:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_UNIQUE_STATUS_UNIFORM_PARENT
  }),
  lookup:
    'generation-materialized-particle-stencil-to-field-index-o1-with-key-recheck',
  overflowPolicy: 'fail-closed-zero-indirect-dispatch',
  mutationPolicy:
    'identity-layout-descriptors-keys-immutable;mechanics-may-publish-clear-evidence-state-encoding-and-fail-closed-zero-dispatch;accumulators-transition-p2g-to-local-heat-and-phase-volume-transport-ledgers-only-through-one-shot-receipt',
  accumulatorLifecycle:
    'particle-stencil-contribution-record-emission-then-stable-radix-ordered-field-and-pressure-reduction-with-exact-contribution-count;immutable-pressure-rows-survive-field-local-heat-pressure-work-and-ambient-ledgers-until-required-consumers-complete',
  pressureRows: Object.freeze({
    rowWords: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS,
    rowLayout: SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_ROW_LAYOUT,
    offsetDerivation:
      'stateOffsetWords + fieldCapacity * stateWords; canonical field index is the row key',
    law: 'exact-p2g-volume-weighted-absolute-pressure',
    fallbackPolicy:
      'fail-closed-no-density-rest-volume-render-radius-private-grid-or-ambient-substitution'
  }),
  receiptControlWords: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS,
  receiptControlLayout: SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_LAYOUT,
  stateEncodingWord: 59,
  stateMutationOrdinalWord: 63,
  stateEncodings: Object.freeze({
    empty: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    massMomentumGradient:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
    massVelocityGradient:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
  })
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

function checkedProduct(left, right, label) {
  const result = left * right;
  if (!Number.isSafeInteger(result) || result > UINT32_MAX) {
    throw new RangeError(`${label} exceeds the u32 word range`);
  }
  return result;
}

function checkedAdd(left, right, label) {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result > UINT32_MAX) {
    throw new RangeError(`${label} exceeds the u32 word range`);
  }
  return result;
}

export function createSchroederSpatialMechanicsFieldViewLayout({
  sourceCapacity,
  fieldCapacity = null
} = {}) {
  const resolvedSourceCapacity = integer(sourceCapacity, 'sourceCapacity', 1);
  const candidateCapacity = checkedProduct(
    resolvedSourceCapacity,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STENCIL_SIZE,
    'field candidate capacity'
  );
  const resolvedFieldCapacity = fieldCapacity == null
    ? candidateCapacity
    : integer(fieldCapacity, 'fieldCapacity', 1, candidateCapacity);
  const descriptorOffsetWords = SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS;
  const descriptorCapacityWords = checkedProduct(
    resolvedSourceCapacity,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DESCRIPTOR_WORDS,
    'field descriptor capacity words'
  );
  const keyOffsetWords = checkedAdd(
    descriptorOffsetWords,
    descriptorCapacityWords,
    'field key offset'
  );
  const keyCapacityWords = checkedProduct(
    resolvedFieldCapacity,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS,
    'field key capacity words'
  );
  const accumulatorOffsetWords = checkedAdd(
    keyOffsetWords,
    keyCapacityWords,
    'field accumulator offset'
  );
  const accumulatorCapacityWords = checkedProduct(
    resolvedFieldCapacity,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_ACCUMULATOR_WORDS,
    'field accumulator capacity words'
  );
  const receiptControlOffsetWords = checkedAdd(
    accumulatorOffsetWords,
    accumulatorCapacityWords,
    'field receipt control offset'
  );
  const stateOffsetWords = checkedAdd(
    receiptControlOffsetWords,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS,
    'field state offset'
  );
  const stateCapacityWords = checkedProduct(
    resolvedFieldCapacity,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATE_WORDS,
    'field state capacity words'
  );
  const pressureOffsetWords = checkedAdd(
    stateOffsetWords,
    stateCapacityWords,
    'field pressure offset'
  );
  const pressureCapacityWords = checkedProduct(
    resolvedFieldCapacity,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS,
    'field pressure capacity words'
  );
  const wordLength = checkedAdd(
    pressureOffsetWords,
    pressureCapacityWords,
    'field view word length'
  );
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
    sourceCapacity: resolvedSourceCapacity,
    candidateCapacity,
    fieldCapacity: resolvedFieldCapacity,
    headerWords: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS,
    descriptorOffsetWords,
    descriptorWords: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DESCRIPTOR_WORDS,
    descriptorCapacityWords,
    keyOffsetWords,
    keyWords: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS,
    keyCapacityWords,
    accumulatorOffsetWords,
    accumulatorWords: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_ACCUMULATOR_WORDS,
    accumulatorCapacityWords,
    receiptControlOffsetWords,
    receiptControlWords: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS,
    stateOffsetWords,
    stateWords: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATE_WORDS,
    stateCapacityWords,
    pressureOffsetWords,
    pressureWords: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS,
    pressureCapacityWords,
    dispatchOffsetWords:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS,
    wordLength,
    byteLength: wordLength * Uint32Array.BYTES_PER_ELEMENT
  });
}

export function createSchroederSpatialMechanicsFieldViewPlan({
  sourceCount,
  sourceCapacity = sourceCount,
  sourceRowLayoutId = 1,
  identityStrideWords = 1,
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
  const resolvedSourceCapacity = integer(
    sourceCapacity,
    'sourceCapacity',
    resolvedSourceCount
  );
  if ((!Array.isArray(gridDims) && !ArrayBuffer.isView(gridDims)) || gridDims.length !== 3) {
    throw new TypeError('gridDims must be an array-like [x, y, z] value');
  }
  const resolvedGridDims = [...gridDims].map((value, axis) => (
    integer(value, `gridDims[${axis}]`, 1, 0x7fff_ffff)
  ));
  const resolvedGridNodeCount = integer(gridNodeCount, 'gridNodeCount', 1);
  const gridProduct = resolvedGridDims.reduce((product, value) => product * value, 1);
  if (!Number.isSafeInteger(gridProduct) || gridProduct !== resolvedGridNodeCount) {
    throw new RangeError('gridNodeCount must equal gridDims[0] * gridDims[1] * gridDims[2]');
  }
  const layout = createSchroederSpatialMechanicsFieldViewLayout({
    sourceCapacity: resolvedSourceCapacity
  });
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
  const candidateCount = checkedProduct(
    resolvedSourceCount,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STENCIL_SIZE,
    'field candidate count'
  );
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
    status: 'schroeder-spatial-mechanics-field-view-plan-ready',
    ...identity,
    sourceCount: resolvedSourceCount,
    sourceCapacity: resolvedSourceCapacity,
    // Active-node rows are not particle aligned and cannot carry one stable
    // material/body descriptor per source carrier. The field child is derived
    // only from the exact retained level-assignment family.
    sourceRowLayoutId: integer(sourceRowLayoutId, 'sourceRowLayoutId', 1, 1),
    sourceRowStrideFloats: 16,
    identityStrideWords: integer(identityStrideWords, 'identityStrideWords', 1, 16),
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
    candidateCount,
    fieldCapacity: layout.fieldCapacity,
    layout,
    deterministicOrdering: 'stable-lexicographic-u32x4',
    fullParticleReadbackRequired: false
  });
}

export function validateSchroederSpatialMechanicsFieldViewDescriptor(
  view,
  expected = {}
) {
  if (
    !view
    || view.schema !== ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA
  ) {
    return {
      admitted: false,
      status: 'schroeder-spatial-mechanics-field-view-rejected-schema'
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
    'sourceCount',
    'sourceRowLayoutId',
    'identityStrideWords',
    'selectedLevel',
    'gridNodeCount',
    'gridShift',
    'gridSpacingM'
  ]) {
    if (Object.hasOwn(expected, field) && !Object.is(view[field], expected[field])) {
      return {
        admitted: false,
        status: `schroeder-spatial-mechanics-field-view-rejected-${field}`,
        field,
        expected: expected[field],
        actual: view[field]
      };
    }
  }
  if (Object.hasOwn(expected, 'gridDims')) {
    const wanted = Array.from(expected.gridDims || []);
    const actual = Array.from(view.gridDims || []);
    if (
      wanted.length !== 3
      || actual.length !== 3
      || wanted.some((value, axis) => !Object.is(value, actual[axis]))
    ) {
      return {
        admitted: false,
        status: 'schroeder-spatial-mechanics-field-view-rejected-gridDims',
        field: 'gridDims',
        expected: wanted,
        actual
      };
    }
  }
  if (
    view.status !== 'schroeder-spatial-mechanics-field-view-gpu-build-submitted'
    || view.submitPerformed !== true
    || view.released === true
    || !view.sourceBuffer
    || !view.identityBuffer
    || !view.parentMechanicsView
    || !view.fieldViewBuffer
    || !view.indirectDispatchBuffer
    || view.indirectDispatchBuffer !== view.fieldViewBuffer
    || view.indirectDispatchOffsetBytes
      !== SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS
        * Uint32Array.BYTES_PER_ELEMENT
  ) {
    return {
      admitted: false,
      status: 'schroeder-spatial-mechanics-field-view-rejected-not-live'
    };
  }
  let expectedLayout;
  try {
    expectedLayout = createSchroederSpatialMechanicsFieldViewLayout({
      sourceCapacity: view.sourceCapacity
    });
  } catch {
    return {
      admitted: false,
      status: 'schroeder-spatial-mechanics-field-view-rejected-layout'
    };
  }
  const gridDims = Array.from(view.gridDims || []);
  if (
    gridDims.length !== 3
    || gridDims.some((value) => !Number.isInteger(value) || value < 1)
    || gridDims.reduce((product, value) => product * value, 1) !== view.gridNodeCount
    || view.sourceCount < 1
    || view.sourceCount > view.sourceCapacity
    || view.candidateCount !== view.sourceCount
      * SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STENCIL_SIZE
    || view.fieldCapacity !== expectedLayout.fieldCapacity
    || view.layout?.schema !== ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA
    || view.layout?.headerWords !== SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS
    || view.layout?.descriptorWords
      !== SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DESCRIPTOR_WORDS
    || view.layout?.keyWords !== SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS
    || view.layout?.accumulatorWords
      !== SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_ACCUMULATOR_WORDS
    || view.layout?.stateWords !== SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATE_WORDS
    || view.layout?.pressureWords
      !== SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS
    || view.layout?.dispatchOffsetWords
      !== SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS
    || view.layout?.sourceCapacity !== expectedLayout.sourceCapacity
    || view.layout?.candidateCapacity !== expectedLayout.candidateCapacity
    || view.layout?.fieldCapacity !== expectedLayout.fieldCapacity
    || view.layout?.descriptorOffsetWords !== expectedLayout.descriptorOffsetWords
    || view.layout?.descriptorCapacityWords !== expectedLayout.descriptorCapacityWords
    || view.layout?.keyOffsetWords !== expectedLayout.keyOffsetWords
    || view.layout?.keyCapacityWords !== expectedLayout.keyCapacityWords
    || view.layout?.accumulatorOffsetWords !== expectedLayout.accumulatorOffsetWords
    || view.layout?.accumulatorCapacityWords !== expectedLayout.accumulatorCapacityWords
    || view.layout?.receiptControlOffsetWords
      !== expectedLayout.receiptControlOffsetWords
    || view.layout?.receiptControlWords
      !== SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS
    || view.layout?.stateOffsetWords !== expectedLayout.stateOffsetWords
    || view.layout?.stateOffsetWords
      !== view.layout.receiptControlOffsetWords
        + view.layout.receiptControlWords
    || view.layout?.stateCapacityWords !== expectedLayout.stateCapacityWords
    || view.layout?.pressureOffsetWords !== expectedLayout.pressureOffsetWords
    || view.layout?.pressureOffsetWords
      !== view.layout.stateOffsetWords + view.layout.stateCapacityWords
    || view.layout?.pressureCapacityWords
      !== expectedLayout.pressureCapacityWords
    || view.layout?.wordLength !== expectedLayout.wordLength
    || view.layout?.byteLength !== expectedLayout.byteLength
  ) {
    return {
      admitted: false,
      status: 'schroeder-spatial-mechanics-field-view-rejected-layout'
    };
  }
  if (
    (Number.isFinite(Number(view.fieldViewBuffer.size))
      && Number(view.fieldViewBuffer.size) < expectedLayout.byteLength)
    || (Number.isFinite(Number(view.indirectDispatchBuffer.size))
      && Number(view.indirectDispatchBuffer.size)
        < view.indirectDispatchOffsetBytes + 3 * Uint32Array.BYTES_PER_ELEMENT)
    || (Number.isFinite(Number(view.sourceBuffer.size))
      && Number(view.sourceBuffer.size)
        < view.sourceCount * 16 * Float32Array.BYTES_PER_ELEMENT)
    || (Number.isFinite(Number(view.identityBuffer.size))
      && Number(view.identityBuffer.size)
        < view.sourceCount * view.identityStrideWords * Uint32Array.BYTES_PER_ELEMENT)
  ) {
    return {
      admitted: false,
      status: 'schroeder-spatial-mechanics-field-view-rejected-buffer-size'
    };
  }
  let ownerAdmitted = false;
  let parentAdmitted = false;
  try {
    ownerAdmitted = view.ownerRuntime?.ownsExecution?.(view) === true
      && view.ownerRuntime?.isExecutionSubmitted?.(view) === true;
    parentAdmitted = view.parentMechanicsView?.ownerRuntime?.ownsExecution?.(
      view.parentMechanicsView
    ) === true
      && view.parentMechanicsView?.ownerRuntime?.isExecutionSubmitted?.(
        view.parentMechanicsView
      ) === true;
  } catch {
    ownerAdmitted = false;
    parentAdmitted = false;
  }
  if (!ownerAdmitted || !parentAdmitted) {
    return {
      admitted: false,
      status: 'schroeder-spatial-mechanics-field-view-rejected-owner'
    };
  }
  return {
    admitted: true,
    status: 'schroeder-spatial-mechanics-field-view-consumer-admitted'
  };
}
