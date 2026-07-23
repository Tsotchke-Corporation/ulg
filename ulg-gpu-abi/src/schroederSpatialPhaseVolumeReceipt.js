import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STENCIL_SIZE,
  ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA
} from './schroederSpatialPhaseVolumeMoment.js';

/**
 * S9-B is deliberately a read-only eligibility receipt.  It authenticates
 * the exact raw V0*J sidecar emitted by S9-A; it is not a phase-transfer,
 * pressure, drag, P2G, G2P, or rendering authority.
 */
export const ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA =
  'peercompute.ulg.schroeder-spatial-phase-volume-receipt.v1';

export const SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_MAGIC = 0x53505652;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_VERSION = 1;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_WORDS = 64;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_PARAMS_BYTES = 128;

export const SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_INVALID_SOURCE = 1 << 3;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_MOMENT_REJECTED = 1 << 4;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_IDENTITY_MISMATCH = 1 << 5;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_CLIPPED_STENCIL = 1 << 6;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_CAPACITY_OVERFLOW = 1 << 7;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_INVALID_FIELD = 1 << 8;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_RESIDUAL_EXCEEDED = 1 << 9;

export const SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_LAYOUT = Object.freeze([
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
  'fieldCount:u32',
  'fieldCapacity:u32',
  'candidateCount:u32',
  'selectedLevel:i32-bits',
  'gridNodeCount:u32',
  'gridSpacingM:f32-bits',
  'momentHeaderWords:u32',
  'momentRowWords:u32',
  'momentCompletionOrdinal:u32',
  'sourceGroupCount:u32',
  'fieldGroupCount:u32',
  'partialVec4Capacity:u32',
  'selectedSourceVolumeM3:f32-bits',
  'fieldVolumeM3:f32-bits',
  'volumeResidualM3:f32-bits',
  'volumeGradientXM2:f32-bits',
  'volumeGradientYM2:f32-bits',
  'volumeGradientZM2:f32-bits',
  'gradientResidualNormM2:f32-bits',
  'volumeToleranceM3:f32-bits',
  'gradientToleranceM2:f32-bits',
  'volumeConditioningSumAbsM3:f32-bits',
  'gradientConditioningSumAbsM2:f32-bits',
  'invalidSourceCount:u32',
  'invalidFieldCount:u32',
  'momentRejectCount:u32',
  'identityMismatchCount:u32',
  'clippedStencilCount:u32',
  'overflowCount:u32',
  'sourceContributionCount:u32',
  'fieldContributionCount:u32',
  'sourceMechanicsStrideFloats:u32',
  'rawVolumeRatioJMechanicsWord:u32',
  'rawRestVolumeMechanicsWord:u32',
  'readbackPerformed:u32',
  'fullParticleReadbackPerformed:u32',
  'diagnosticOnly:u32',
  'stateMutationAllowed:u32',
  'sourceDispatchX:u32',
  'fieldDispatchX:u32',
  'controlWords:u32',
  'terminalSeal:u32',
  'reserved0:u32',
  'reserved1:u32',
  'reserved2:u32',
  'reserved3:u32'
]);

export const SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_ABI = Object.freeze({
  schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA,
  version: SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_VERSION,
  magic: SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_MAGIC,
  headerWords: SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_WORDS,
  headerLayout: SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_LAYOUT,
  sourceAuthority:
    'same-device-same-generation-s9a-finite-positive-restVolumeM3-word-19-times-volumeRatioJ-word-18-only',
  fieldAuthority: 'same-s9a-v1-moment-rows-and-exact-mechanics-field-u32x4-key-only',
  conservation: 'selected-source-volume-equals-unclipped-phase-field-volume;stencil-gradient-sum-zero',
  fallbackPolicy: 'fail-closed-no-density-render-radius-or-represented-volume-fallback',
  mutationPolicy:
    'diagnostic-only;no-p2g-grid-g2p-reflux-particle-thermo-reaction-phase-or-render-mutation',
  residency: 'same-command-encoder-retained-gpu-receipt-no-hot-path-readback',
  futureLawPolicy: 'eligible-read-only-evidence-not-a-pressure-or-drag-operator'
});

const UINT32_MAX = 0xffff_ffff;
const F32_EPSILON = 2 ** -23;

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

function finiteNonnegative(value, label) {
  const number = Math.fround(Number(value));
  if (!Number.isFinite(number) || number < 0) {
    throw new RangeError(`${label} must be a nonnegative finite f32`);
  }
  return number;
}

function checkedProduct(left, right, label) {
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

function byteLength(words, label) {
  const value = words * Uint32Array.BYTES_PER_ELEMENT;
  if (!Number.isSafeInteger(value) || value < Uint32Array.BYTES_PER_ELEMENT) {
    throw new RangeError(`${label} byte length is not safely addressable`);
  }
  return value;
}

function groupCount(count) {
  return Math.ceil(count / SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_WORKGROUP_SIZE);
}

function sameIdentity(left, right) {
  return [
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
    'completionOrdinal'
  ].every((field) => Object.is(left?.[field], right?.[field]));
}

export function createSchroederSpatialPhaseVolumeReceiptLayout({
  sourceCapacity,
  fieldCapacity
} = {}) {
  const resolvedSourceCapacity = integer(
    sourceCapacity,
    'sourceCapacity',
    1,
    Math.floor(UINT32_MAX / 32)
  );
  const candidateCapacity = checkedProduct(
    resolvedSourceCapacity,
    SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STENCIL_SIZE,
    'phase-volume receipt candidate capacity'
  );
  const resolvedFieldCapacity = integer(
    fieldCapacity ?? candidateCapacity,
    'fieldCapacity',
    1,
    candidateCapacity
  );
  const sourceGroupCapacity = groupCount(resolvedSourceCapacity);
  const fieldGroupCapacity = groupCount(resolvedFieldCapacity);
  const partialVec4Capacity = checkedAdd(
    sourceGroupCapacity,
    checkedProduct(
      fieldGroupCapacity,
      2,
      'phase-volume receipt field reduction banks'
    ),
    'phase-volume receipt partial vec4 capacity'
  );
  const partialFloats = checkedProduct(
    partialVec4Capacity,
    4,
    'phase-volume receipt partial float capacity'
  );
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA,
    version: SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_VERSION,
    sourceCapacity: resolvedSourceCapacity,
    fieldCapacity: resolvedFieldCapacity,
    candidateCapacity,
    sourceGroupCapacity,
    fieldGroupCapacity,
    sourcePartialOffsetVec4: 0,
    fieldPartialOffsetVec4: sourceGroupCapacity,
    fieldConditioningOffsetVec4: sourceGroupCapacity + fieldGroupCapacity,
    partialVec4Capacity,
    partialFloats,
    controlWords: SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_WORDS,
    controlByteLength: byteLength(
      SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_WORDS,
      'phase-volume receipt control'
    ),
    partialByteLength: checkedProduct(
      partialFloats,
      Float32Array.BYTES_PER_ELEMENT,
      'phase-volume receipt partial bytes'
    ),
    paramsByteLength: SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_PARAMS_BYTES
  });
}

export function createSchroederSpatialPhaseVolumeReceiptPlan({
  sourceCount,
  sourceCapacity,
  fieldCapacity,
  selectedLevel,
  gridNodeCount,
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
  completionOrdinal
} = {}) {
  const layout = createSchroederSpatialPhaseVolumeReceiptLayout({
    sourceCapacity,
    fieldCapacity
  });
  const resolvedSourceCount = integer(
    sourceCount,
    'sourceCount',
    1,
    layout.sourceCapacity
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
    ['completionOrdinal', completionOrdinal ?? generationId, true]
  ].map(([label, value, positive]) => [
    label,
    integer(value, label, positive ? 1 : 0)
  ]));
  const candidateCount = checkedProduct(
    resolvedSourceCount,
    SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STENCIL_SIZE,
    'phase-volume receipt candidate count'
  );
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA,
    status: 'schroeder-spatial-phase-volume-receipt-plan-ready',
    ...identity,
    sourceCount: resolvedSourceCount,
    sourceCapacity: layout.sourceCapacity,
    fieldCapacity: layout.fieldCapacity,
    candidateCount,
    sourceGroupCount: groupCount(resolvedSourceCount),
    selectedLevel: integer(selectedLevel, 'selectedLevel', -0x8000_0000, 0x7fff_ffff),
    gridNodeCount: integer(gridNodeCount, 'gridNodeCount', 1),
    gridSpacingM: finitePositive(gridSpacingM, 'gridSpacingM'),
    sourceMechanicsStrideFloats: 32,
    rawVolumeRatioJMechanicsWord: 18,
    rawRestVolumeMechanicsWord: 19,
    layout,
    diagnosticOnly: true,
    fullParticleReadbackRequired: false,
    fullParticleReadbackPerformed: false,
    stateMutationAllowed: false
  });
}

function rejectedDescriptor(status, reason, field = null) {
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA,
    status,
    reason,
    admitted: false,
    ...(field == null ? {} : { field })
  });
}

/**
 * Descriptor-level authentication deliberately stays structural and GPU-only.
 * The receipt control header is the runtime conservation result; callers must
 * not substitute a CPU/readback summary for this resident artifact.
 */
export function validateSchroederSpatialPhaseVolumeReceiptDescriptor(
  descriptor,
  expected = {}
) {
  const encoded = descriptor?.status
    === 'schroeder-spatial-phase-volume-receipt-gpu-encoded'
    && descriptor?.submitPerformed === false;
  const submitted = descriptor?.status
    === 'schroeder-spatial-phase-volume-receipt-gpu-build-submitted'
    && descriptor?.submitPerformed === true;
  if (
    descriptor?.schema !== ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA
    || (!encoded && !submitted)
    || descriptor.ready !== true
    || descriptor.selected !== true
    || descriptor.diagnosticOnly !== true
    || descriptor.stateMutationAllowed !== false
    || descriptor.fullParticleReadbackRequired !== false
    || descriptor.fullParticleReadbackPerformed !== false
    || descriptor.readbackPerformed !== false
    || descriptor.submissionOwnership !== 'caller'
  ) {
    return rejectedDescriptor(
      'schroeder-spatial-phase-volume-receipt-rejected-descriptor',
      'phase-volume receipt descriptor is not a resident immutable diagnostic artifact'
    );
  }
  let layout;
  try {
    layout = createSchroederSpatialPhaseVolumeReceiptLayout({
      sourceCapacity: descriptor.sourceCapacity,
      fieldCapacity: descriptor.fieldCapacity
    });
  } catch (error) {
    return rejectedDescriptor(
      'schroeder-spatial-phase-volume-receipt-rejected-layout',
      error instanceof Error ? error.message : String(error)
    );
  }
  for (const field of [
    'sourceCapacity',
    'fieldCapacity',
    'candidateCapacity',
    'sourceGroupCapacity',
    'fieldGroupCapacity',
    'sourcePartialOffsetVec4',
    'fieldPartialOffsetVec4',
    'fieldConditioningOffsetVec4',
    'partialVec4Capacity',
    'partialFloats',
    'controlWords',
    'controlByteLength',
    'partialByteLength',
    'paramsByteLength'
  ]) {
    if (descriptor.layout?.[field] !== layout[field]) {
      return rejectedDescriptor(
        'schroeder-spatial-phase-volume-receipt-rejected-layout',
        `phase-volume receipt layout field ${field} is not canonical`,
        field
      );
    }
  }
  for (const field of [
    'sourceCount',
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
    'selectedLevel',
    'completionOrdinal'
  ]) {
    if (Object.hasOwn(expected, field) && descriptor[field] !== expected[field]) {
      return rejectedDescriptor(
        'schroeder-spatial-phase-volume-receipt-rejected-identity',
        `phase-volume receipt ${field} does not match the expected generation`,
        field
      );
    }
  }
  const moment = descriptor.phaseVolumeMoment;
  if (
    moment?.schema !== ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA
    || moment?.diagnosticOnly !== true
    || moment?.stateMutationAllowed !== false
    || moment?.sourceMechanicsBufferBorrowed !== true
    || !descriptor.controlBuffer
    || !descriptor.partialBuffer
    || !descriptor.paramsBuffer
    || !descriptor.sourceMechanicsBuffer
    || descriptor.sourceMechanicsBuffer !== moment?.sourceMechanicsBuffer
    || descriptor.mechanicsFieldView !== moment?.mechanicsFieldView
    || descriptor.parentPhaseVolumeMoment !== moment
    || !descriptor.mechanicsFieldView
  ) {
    return rejectedDescriptor(
      'schroeder-spatial-phase-volume-receipt-rejected-lineage',
      'phase-volume receipt lost its exact S9-A moment or mechanics-field parent'
    );
  }
  if (
    descriptor.candidateCount !== descriptor.sourceCount * SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STENCIL_SIZE
    || descriptor.sourceGroupCount !== groupCount(descriptor.sourceCount)
    || descriptor.sourceMechanicsStrideFloats !== 32
    || descriptor.rawVolumeRatioJMechanicsWord !== 18
    || descriptor.rawRestVolumeMechanicsWord !== 19
    || !sameIdentity(descriptor, moment)
    || descriptor.sourceCount !== moment.sourceCount
    || descriptor.sourceCapacity !== moment.sourceCapacity
    || descriptor.fieldCapacity !== moment.fieldCapacity
    || descriptor.selectedLevel !== moment.selectedLevel
    || descriptor.gridNodeCount !== moment.gridNodeCount
    || Math.fround(descriptor.gridSpacingM) !== Math.fround(moment.gridSpacingM)
  ) {
    return rejectedDescriptor(
      'schroeder-spatial-phase-volume-receipt-rejected-lineage',
      'phase-volume receipt descriptor lost strict S9-A raw-volume lineage'
    );
  }
  let owned = false;
  try {
    owned = descriptor.ownerRuntime?.ownsExecution?.(descriptor) === true;
  } catch {
    owned = false;
  }
  if (!owned || descriptor.released === true) {
    return rejectedDescriptor(
      'schroeder-spatial-phase-volume-receipt-rejected-ownership',
      'phase-volume receipt descriptor is no longer runtime-owned'
    );
  }
  const bufferRequirements = [
    [descriptor.controlBuffer, layout.controlByteLength],
    [descriptor.partialBuffer, layout.partialByteLength],
    [descriptor.paramsBuffer, layout.paramsByteLength],
    [
      descriptor.sourceMechanicsBuffer,
      descriptor.sourceCount * descriptor.sourceMechanicsStrideFloats * Float32Array.BYTES_PER_ELEMENT
    ],
    [moment.controlBuffer, SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT],
    [moment.momentBuffer, descriptor.fieldCapacity * SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS * Uint32Array.BYTES_PER_ELEMENT]
  ];
  if (bufferRequirements.some(([buffer, required]) => (
    Number.isFinite(Number(buffer?.size)) && Number(buffer.size) < required
  ))) {
    return rejectedDescriptor(
      'schroeder-spatial-phase-volume-receipt-rejected-buffer-size',
      'phase-volume receipt buffer is smaller than its immutable ABI requirement'
    );
  }
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA,
    status: 'schroeder-spatial-phase-volume-receipt-admitted',
    admitted: true,
    descriptor
  });
}

/**
 * This intentionally conservative f32 tolerance is shared by the host test
 * oracle and GPU finalizer. It scales with the summed represented volume and
 * the only valid length scale: the selected mechanics-field grid spacing.
 */
export function deriveSchroederPhaseVolumeReceiptTolerance({
  selectedSourceVolumeM3,
  fieldVolumeM3,
  gridSpacingM,
  gradientConditioningSumAbsM2 = null
} = {}) {
  const source = finitePositive(selectedSourceVolumeM3, 'selectedSourceVolumeM3');
  const field = finitePositive(fieldVolumeM3, 'fieldVolumeM3');
  const spacing = finitePositive(gridSpacingM, 'gridSpacingM');
  const conditioning = Math.fround(Math.abs(source) + Math.abs(field));
  const gradientConditioning = gradientConditioningSumAbsM2 == null
    ? Math.fround(conditioning / spacing)
    : finiteNonnegative(
      gradientConditioningSumAbsM2,
      'gradientConditioningSumAbsM2'
    );
  return Object.freeze({
    volumeToleranceM3: Math.fround(Math.max(
      8 * 1.17549435e-38,
      1024 * F32_EPSILON * conditioning
    )),
    gradientToleranceM2: Math.fround(Math.max(
      8 * 1.17549435e-38,
      2048 * F32_EPSILON * Math.max(gradientConditioning, conditioning / spacing)
    ))
  });
}
