export const ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA =
  'peercompute.ulg.schroeder-spatial-phase-volume-moment.v1';

export const SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_MAGIC = 0x53505631;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_VERSION = 1;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS = 64;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS = 12;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STENCIL_SIZE = 27;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_PARAMS_BYTES = 128;

export const SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_INVALID_SOURCE = 1 << 3;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_IDENTITY_MISMATCH = 1 << 4;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_CLIPPED_STENCIL = 1 << 5;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_CAPACITY_OVERFLOW = 1 << 6;

export const SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_LAYOUT = Object.freeze([
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
  'selectedLevel:i32-bits',
  'gridNodeCount:u32',
  'gridSpacingM:f32-bits',
  'fieldCompletionOrdinal:u32',
  'fieldKeyOffsetWords:u32',
  'fieldKeyWords:u32',
  'fieldDescriptorOffsetWords:u32',
  'fieldDescriptorWords:u32',
  'momentRowOffsetWords:u32',
  'momentRowWords:u32',
  'requiredMomentWords:u32',
  'momentCapacityWords:u32',
  'candidateCount:u32',
  'rawVolumeRatioJMechanicsWord:u32',
  'rawRestVolumeMechanicsWord:u32',
  'mechanicsStrideFloats:u32',
  'assignmentStrideFloats:u32',
  'invalidRawVolumeCount:u32',
  'invalidLineageCount:u32',
  'clippedCandidateCount:u32',
  'candidateContributionCount:u32',
  'zeroedFieldCount:u32',
  'readbackPerformed:u32',
  'fullParticleReadbackPerformed:u32',
  'diagnosticOnly:u32',
  'stateMutationAllowed:u32',
  'dispatchX:u32',
  'dispatchY:u32',
  'dispatchZ:u32',
  'controlWords:u32',
  'candidateContributionStrideFloats:u32',
  'fieldRangeWords:u32',
  'fieldViewSchemaMagic:u32',
  'fieldViewSchemaVersion:u32',
  'sourceRowLayoutId:u32',
  'reserved0:u32',
  'reserved1:u32',
  'reserved2:u32',
  'reserved3:u32',
  'reserved4:u32',
  'reserved5:u32',
  'reserved6:u32',
  'reserved7:u32'
]);

export const SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_LAYOUT = Object.freeze([
  'denseGridNodeId:u32',
  'mechanicalFamilyId:u32',
  'materialId:u32',
  'continuityDomainId:u32',
  'rawCurrentVolumeM3:f32-bits',
  'volumeGradientXM2:f32-bits',
  'volumeGradientYM2:f32-bits',
  'volumeGradientZM2:f32-bits',
  'contributionCount:u32',
  'statusFlags:u32',
  'reserved0:u32',
  'reserved1:u32'
]);

export const SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ABI = Object.freeze({
  schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA,
  version: SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_VERSION,
  magic: SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_MAGIC,
  headerWords: SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS,
  headerLayout: SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_LAYOUT,
  rowWords: SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS,
  rowLayout: SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_LAYOUT,
  sourceVolumeAuthority:
    'finite-positive-mls-mpm-restVolumeM3-word-19-times-volumeRatioJ-word-18-only',
  sourceVolumeFallbackPolicy: 'fail-closed-no-density-or-phase-reference-fallback',
  fieldIdentity: 'exact-existing-schroeder-mechanics-field-key-u32x4',
  reduction: 'stable-radix-sorted-candidate-groups-serial-per-field',
  residency: 'same-generation-same-device-retained-diagnostic-sidecar',
  mutationPolicy: 'diagnostic-only;no-p2g-grid-reaction-phase-render-or-particle-state-mutation',
  partialPublicationPolicy: 'whole-sidecar-fail-closed-on-invalid-source-or-lineage'
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

export function createSchroederSpatialPhaseVolumeMomentLayout({
  sourceCapacity,
  fieldCapacity
} = {}) {
  const resolvedSourceCapacity = integer(sourceCapacity, 'sourceCapacity', 1);
  const candidateCapacity = checkedProduct(
    resolvedSourceCapacity,
    SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STENCIL_SIZE,
    'phase-volume moment candidate capacity'
  );
  const resolvedFieldCapacity = integer(
    fieldCapacity ?? candidateCapacity,
    'fieldCapacity',
    1,
    candidateCapacity
  );
  const momentRowOffsetWords = 0;
  const momentWords = checkedProduct(
    resolvedFieldCapacity,
    SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS,
    'phase-volume moment row words'
  );
  const candidateContributionFloats = checkedProduct(
    candidateCapacity,
    4,
    'phase-volume moment candidate contribution floats'
  );
  const fieldRangeWords = checkedProduct(
    resolvedFieldCapacity,
    2,
    'phase-volume moment field range words'
  );
  const candidateFieldOffsetWords = 0;
  const fieldRangeOffsetWords = candidateCapacity;
  const scratchWords = checkedAdd(
    candidateFieldOffsetWords,
    checkedAdd(
      candidateCapacity,
      fieldRangeWords,
      'phase-volume moment scratch words'
    ),
    'phase-volume moment scratch words'
  );
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA,
    version: SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_VERSION,
    sourceCapacity: resolvedSourceCapacity,
    fieldCapacity: resolvedFieldCapacity,
    candidateCapacity,
    controlWords: SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS,
    controlByteLength: byteLength(
      SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS,
      'phase-volume moment control'
    ),
    momentRowOffsetWords,
    momentRowWords: SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS,
    momentWords,
    momentByteLength: byteLength(momentWords, 'phase-volume moment rows'),
    candidateContributionStrideFloats: 4,
    candidateContributionFloats,
    candidateContributionByteLength: candidateContributionFloats * Float32Array.BYTES_PER_ELEMENT,
    // Candidate-to-field rows and per-field ranges deliberately share one
    // storage binding.  That keeps this diagnostic sidecar within WebGPU's
    // portable eight-storage-binding floor without borrowing mutable field
    // state or any mechanics accumulator memory.
    candidateFieldOffsetWords,
    candidateFieldByteLength: byteLength(candidateCapacity, 'phase-volume moment candidate field'),
    fieldRangeOffsetWords,
    fieldRangeWords,
    fieldRangeByteLength: byteLength(fieldRangeWords, 'phase-volume moment field ranges'),
    scratchWords,
    scratchByteLength: byteLength(scratchWords, 'phase-volume moment scratch'),
    paramsByteLength: SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_PARAMS_BYTES
  });
}

export function createSchroederSpatialPhaseVolumeMomentPlan({
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
  const layout = createSchroederSpatialPhaseVolumeMomentLayout({
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
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA,
    status: 'schroeder-spatial-phase-volume-moment-plan-ready',
    ...identity,
    sourceCount: resolvedSourceCount,
    sourceCapacity: layout.sourceCapacity,
    candidateCapacity: layout.candidateCapacity,
    fieldCapacity: layout.fieldCapacity,
    candidateCount: checkedProduct(
      resolvedSourceCount,
      SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STENCIL_SIZE,
      'phase-volume moment candidate count'
    ),
    selectedLevel: integer(selectedLevel, 'selectedLevel', -0x8000_0000, 0x7fff_ffff),
    gridNodeCount: integer(gridNodeCount, 'gridNodeCount', 1),
    gridSpacingM: finitePositive(gridSpacingM, 'gridSpacingM'),
    layout,
    sourceRowLayoutId: 1,
    assignmentStrideFloats: 16,
    mechanicsStrideFloats: 32,
    rawVolumeRatioJMechanicsWord: 18,
    rawRestVolumeMechanicsWord: 19,
    diagnosticOnly: true,
    fullParticleReadbackRequired: false,
    fullParticleReadbackPerformed: false
  });
}

function rejectedDescriptor(status, reason, field = null) {
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA,
    status,
    reason,
    admitted: false,
    ...(field == null ? {} : { field })
  });
}

export function validateSchroederSpatialPhaseVolumeMomentDescriptor(
  descriptor,
  expected = {}
) {
  const encoded = descriptor?.status
    === 'schroeder-spatial-phase-volume-moment-gpu-encoded'
    && descriptor?.submitPerformed === false;
  const submitted = descriptor?.status
    === 'schroeder-spatial-phase-volume-moment-gpu-build-submitted'
    && descriptor?.submitPerformed === true;
  if (
    descriptor?.schema !== ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA
    || (!encoded && !submitted)
    || descriptor.ready !== true
    || descriptor.selected !== true
    || descriptor.diagnosticOnly !== true
    || descriptor.fullParticleReadbackRequired !== false
    || descriptor.fullParticleReadbackPerformed !== false
    || descriptor.readbackPerformed !== false
    || descriptor.stateMutationAllowed !== false
    || descriptor.submissionOwnership !== 'caller'
  ) {
    return rejectedDescriptor(
      'schroeder-spatial-phase-volume-moment-rejected-descriptor',
      'phase-volume moment descriptor is not an encoded resident diagnostic v1 artifact'
    );
  }
  let layout;
  try {
    layout = createSchroederSpatialPhaseVolumeMomentLayout({
      sourceCapacity: descriptor.sourceCapacity,
      fieldCapacity: descriptor.fieldCapacity
    });
  } catch (error) {
    return rejectedDescriptor(
      'schroeder-spatial-phase-volume-moment-rejected-layout',
      error instanceof Error ? error.message : String(error)
    );
  }
  for (const field of [
    'sourceCapacity',
    'candidateCapacity',
    'fieldCapacity',
    'candidateCapacity',
    'controlWords',
    'controlByteLength',
    'momentRowOffsetWords',
    'momentRowWords',
    'momentWords',
    'momentByteLength',
    'candidateContributionStrideFloats',
    'candidateContributionFloats',
    'candidateContributionByteLength',
    'candidateFieldOffsetWords',
    'candidateFieldByteLength',
    'fieldRangeOffsetWords',
    'fieldRangeWords',
    'fieldRangeByteLength',
    'scratchWords',
    'scratchByteLength',
    'paramsByteLength'
  ]) {
    if (descriptor.layout?.[field] !== layout[field]) {
      return rejectedDescriptor(
        'schroeder-spatial-phase-volume-moment-rejected-layout',
        `phase-volume moment layout field ${field} is not canonical`,
        field
      );
    }
  }
  const expectedFields = [
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
  ];
  for (const field of expectedFields) {
    if (Object.hasOwn(expected, field) && descriptor[field] !== expected[field]) {
      return rejectedDescriptor(
        'schroeder-spatial-phase-volume-moment-rejected-identity',
        `phase-volume moment ${field} does not match the expected generation`,
        field
      );
    }
  }
  if (
    !descriptor.controlBuffer
    || !descriptor.momentBuffer
    || !descriptor.candidateContributionBuffer
    || !descriptor.scratchBuffer
    || !descriptor.paramsBuffer
    || !descriptor.sourceBuffer
    || !descriptor.sourceMechanicsBuffer
    || descriptor.sourceMechanicsBufferBorrowed !== true
    || !descriptor.mechanicsFieldView
    || descriptor.mechanicsFieldView.sourceBuffer !== descriptor.sourceBuffer
    || descriptor.mechanicsFieldView !== descriptor.parentMechanicsFieldView
    || descriptor.mechanicsFieldView.ownerRuntime
      ?.ownsExecution?.(descriptor.mechanicsFieldView) !== true
  ) {
    return rejectedDescriptor(
      'schroeder-spatial-phase-volume-moment-rejected-ownership',
      'phase-volume moment descriptor lost exact source or mechanics-field ownership'
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
      'schroeder-spatial-phase-volume-moment-rejected-ownership',
      'phase-volume moment descriptor is no longer runtime-owned'
    );
  }
  if (
    descriptor.candidateCount !== descriptor.sourceCount * SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STENCIL_SIZE
    || descriptor.sourceRowLayoutId !== 1
    || descriptor.assignmentStrideFloats !== 16
    || descriptor.mechanicsStrideFloats !== 32
    || descriptor.rawVolumeRatioJMechanicsWord !== 18
    || descriptor.rawRestVolumeMechanicsWord !== 19
    || descriptor.mechanicsFieldView.sourceCount !== descriptor.sourceCount
    || descriptor.mechanicsFieldView.sourceCapacity !== descriptor.sourceCapacity
    || descriptor.mechanicsFieldView.candidateCount !== descriptor.candidateCount
    || descriptor.mechanicsFieldView.fieldCapacity !== descriptor.fieldCapacity
    || descriptor.mechanicsFieldView.selectedLevel !== descriptor.selectedLevel
  ) {
    return rejectedDescriptor(
      'schroeder-spatial-phase-volume-moment-rejected-lineage',
      'phase-volume moment descriptor lost strict source, field, or raw-volume lineage'
    );
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
    'completionOrdinal'
  ]) {
    if (descriptor.mechanicsFieldView[field] !== descriptor[field]) {
      return rejectedDescriptor(
        'schroeder-spatial-phase-volume-moment-rejected-lineage',
        `phase-volume moment ${field} differs from its field-view parent`,
        field
      );
    }
  }
  const bufferRequirements = [
    [descriptor.controlBuffer, layout.controlByteLength],
    [descriptor.momentBuffer, layout.momentByteLength],
    [descriptor.candidateContributionBuffer, layout.candidateContributionByteLength],
    [descriptor.scratchBuffer, layout.scratchByteLength],
    [descriptor.paramsBuffer, layout.paramsByteLength],
    [
      descriptor.sourceBuffer,
      descriptor.sourceCount * descriptor.assignmentStrideFloats * Float32Array.BYTES_PER_ELEMENT
    ],
    [
      descriptor.sourceMechanicsBuffer,
      descriptor.sourceCount * descriptor.mechanicsStrideFloats * Float32Array.BYTES_PER_ELEMENT
    ]
  ];
  if (bufferRequirements.some(([buffer, required]) => (
    Number.isFinite(Number(buffer?.size)) && Number(buffer.size) < required
  ))) {
    return rejectedDescriptor(
      'schroeder-spatial-phase-volume-moment-rejected-buffer-size',
      'phase-volume moment descriptor buffer is smaller than its immutable ABI requirement'
    );
  }
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA,
    status: 'schroeder-spatial-phase-volume-moment-admitted',
    admitted: true,
    descriptor
  });
}

/**
 * Return strict represented current volume for a mechanics row.  This oracle
 * intentionally has no mass/density, phase-volume-reference, or render-radius
 * fallback: an invalid input must fail closed at the sidecar boundary.
 */
export function resolveSchroederRawCurrentVolumeM3({
  restVolumeM3,
  volumeRatioJ
} = {}) {
  const rest = Math.fround(Number(restVolumeM3));
  const ratio = Math.fround(Number(volumeRatioJ));
  if (!Number.isFinite(rest) || !Number.isFinite(ratio) || !(rest > 0) || !(ratio > 0)) {
    return null;
  }
  const current = Math.fround(rest * ratio);
  return Number.isFinite(current) && current > 0 ? current : null;
}

/**
 * Exact quadratic MLS-MPM B-spline weights and gradients for the three local
 * nodes on one axis.  Gradients are with respect to world-space metres.
 */
export function schroederQuadraticSplineAxis(fraction, gridSpacingM) {
  const x = Math.fround(Number(fraction));
  const spacing = Math.fround(Number(gridSpacingM));
  if (!Number.isFinite(x) || !Number.isFinite(spacing) || !(spacing > 0)) {
    throw new RangeError('quadratic spline requires finite fraction and positive gridSpacingM');
  }
  const a = 1.5 - x;
  const b = x - 1;
  const c = x - 0.5;
  return Object.freeze({
    weights: Object.freeze([
      Math.fround(0.5 * a * a),
      Math.fround(0.75 - b * b),
      Math.fround(0.5 * c * c)
    ]),
    gradientsPerM: Object.freeze([
      Math.fround((x - 1.5) / spacing),
      Math.fround((-2 * b) / spacing),
      Math.fround((x - 0.5) / spacing)
    ])
  });
}
