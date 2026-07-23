import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS,
  ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA
} from './schroederSpatialPhaseVolumeMoment.js';
import {
  ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA,
  validateSchroederSpatialPhaseVolumeReceiptDescriptor
} from './schroederSpatialPhaseVolumeReceipt.js';
import {
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_WORDS,
  ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA,
  createSchroederSpatialParentFieldViewLayout
} from './schroederSpatialParentFieldView.js';

/**
 * S9-C deliberately publishes compressed, immutable interface topology rather
 * than materializing an O(fields^2) pair graph.  A later pressure/drag law can
 * traverse each same-node field span virtually and use the immutable parent
 * CSR routes; this artifact neither evaluates nor applies that law.
 */
export const ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_SCHEMA =
  'peercompute.ulg.schroeder-spatial-phase-volume-interface-proposal.v1';

export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_MAGIC = 0x5350_4946;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_VERSION = 1;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_WORDS = 64;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_HEAD_WORDS = 8;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_ROUTE_WORDS = 8;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_PARAMS_BYTES = 192;

export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_RECEIPT_REJECTED = 1 << 3;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_IDENTITY_MISMATCH = 1 << 4;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_INVALID_FIELD = 1 << 5;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_INVALID_ROUTE = 1 << 6;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_CAPACITY_OVERFLOW = 1 << 7;

export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_POLICY =
  1;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_POLICY =
  1;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_ROW_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_ROW_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_INVALID_INDEX = 0xffff_ffff;

export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_LAYOUT =
  Object.freeze([
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
    'fineFieldCount:u32',
    'fineFieldCapacity:u32',
    'coarseFieldCount:u32',
    'coarseFieldCapacity:u32',
    'fineLocalHeadCount:u32',
    'coarseLocalHeadCount:u32',
    'refluxRouteCount:u32',
    'fineLevel:i32-bits',
    'coarseLevel:i32-bits',
    'twoLevel:u32',
    'parentRoutesEnabled:u32',
    'fineReceiptCompletionOrdinal:u32',
    'coarseReceiptCompletionOrdinal:u32',
    'parentFieldCompletionOrdinal:u32',
    'fineLocalHeadOffsetWords:u32',
    'coarseLocalHeadOffsetWords:u32',
    'localHeadCapacity:u32',
    'refluxRouteCapacity:u32',
    'localHeadWords:u32',
    'refluxRouteWords:u32',
    'momentHeaderWords:u32',
    'momentRowWords:u32',
    'parentFieldHeaderWords:u32',
    'inputFieldRowsChecked:u32',
    'receiptRejectedCount:u32',
    'identityMismatchCount:u32',
    'invalidFieldCount:u32',
    'invalidRouteCount:u32',
    'overflowCount:u32',
    'readbackPerformed:u32',
    'fullParticleReadbackPerformed:u32',
    'diagnosticOnly:u32',
    'stateMutationAllowed:u32',
    'terminalSeal:u32',
    'localPolicyId:u32',
    'refluxPolicyId:u32',
    'fineLocalDispatchX:u32',
    'coarseLocalDispatchX:u32',
    'refluxRouteDispatchX:u32',
    'controlWords:u32',
    'reserved0:u32',
    'reserved1:u32',
    'reserved2:u32',
    'reserved3:u32',
    'reserved4:u32',
    'reserved5:u32',
    'reserved6:u32',
    'reserved7:u32'
  ]);

export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_HEAD_LAYOUT =
  Object.freeze([
    'fieldBegin:u32',
    'denseGridNodeId:u32',
    'fieldEndExclusive:u32',
    'level:i32-bits',
    'policyId:u32',
    'statusFlags:u32',
    'reserved0:u32',
    'reserved1:u32'
  ]);

export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_ROUTE_LAYOUT =
  Object.freeze([
    'fineFieldIndex:u32',
    'parentEdgeBegin:u32',
    'parentEdgeEndExclusive:u32',
    'fineLevel:i32-bits',
    'coarseLevel:i32-bits',
    'parentFieldCompletionOrdinal:u32',
    'statusFlags:u32',
    'policyId:u32'
  ]);

export const SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_ABI =
  Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_SCHEMA,
    version: SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_VERSION,
    magic: SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_MAGIC,
    headerWords: SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_WORDS,
    headerLayout: SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_LAYOUT,
    localHeadWords: SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_HEAD_WORDS,
    localHeadLayout: SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_HEAD_LAYOUT,
    refluxRouteWords: SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_ROUTE_WORDS,
    refluxRouteLayout: SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_ROUTE_LAYOUT,
    localTopology:
      'stable-sparse-same-dense-grid-node-head-ranges-over-exact-admitted-mechanics-field-key-rows',
    refluxTopology:
      'stable-sparse-fine-field-heads-over-exact-immutable-parent-field-csr',
    pairPolicy:
      'no-materialized-field-pairs;future-law-must-traverse-virtual-pairs-inside-admitted-local-ranges',
    authority:
      'same-device-same-epoch-s9b-receipt-with-exact-s9a-moment-lineage-and-mechanics-field-view-only',
    fallbackPolicy:
      'fail-closed-no-density-render-radius-represented-volume-state-or-thermo-fallback',
    mutationPolicy:
      'diagnostic-only;no-p2g-grid-g2p-reflux-particle-thermo-reaction-phase-eos-or-render-mutation',
    residency: 'same-command-encoder-retained-gpu-artifact-no-hot-path-readback'
  });

const UINT32_MAX = 0xffff_ffff;
const IDENTITY_FIELDS = Object.freeze([
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
  'supportEpoch'
]);

function integer(value, label, min = 0, max = UINT32_MAX) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer in [${min}, ${max}]`);
  }
  return number;
}

function checkedAdd(left, right, label) {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result > UINT32_MAX) {
    throw new RangeError(`${label} exceeds the u32-addressable range`);
  }
  return result;
}

function checkedMultiply(left, right, label) {
  const result = left * right;
  if (!Number.isSafeInteger(result) || result > UINT32_MAX) {
    throw new RangeError(`${label} exceeds the u32-addressable range`);
  }
  return result;
}

function byteLength(words, label) {
  const result = checkedMultiply(words, Uint32Array.BYTES_PER_ELEMENT, label);
  if (result < Uint32Array.BYTES_PER_ELEMENT) {
    throw new RangeError(`${label} must be non-empty`);
  }
  return result;
}

function groupCount(count) {
  return Math.ceil(count / SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_WORKGROUP_SIZE);
}

function sameIdentity(left, right) {
  return IDENTITY_FIELDS.every((field) => Object.is(left?.[field], right?.[field]));
}

function executionSubmissionState(execution, encodedStatus, submittedStatus) {
  let owned = false;
  let submittedByOwner = false;
  try {
    owned = execution?.ownerRuntime?.ownsExecution?.(execution) === true;
    submittedByOwner = execution?.ownerRuntime?.isExecutionSubmitted?.(execution) === true;
  } catch {
    owned = false;
    submittedByOwner = false;
  }
  if (!owned || execution?.released === true) return null;
  if (
    execution?.status === encodedStatus
    && execution?.submitPerformed === false
    && submittedByOwner === false
  ) return 'encoded';
  if (
    execution?.status === submittedStatus
    && execution?.submitPerformed === true
    && submittedByOwner === true
  ) return 'submitted';
  return null;
}

function rejectedDescriptor(status, reason, field = null) {
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_SCHEMA,
    status,
    reason,
    admitted: false,
    ...(field == null ? {} : { field })
  });
}

export function createSchroederSpatialPhaseVolumeInterfaceProposalLayout({
  fineFieldCapacity,
  coarseFieldCapacity = 0
} = {}) {
  const resolvedFineCapacity = integer(fineFieldCapacity, 'fineFieldCapacity', 1);
  const resolvedCoarseCapacity = integer(
    coarseFieldCapacity,
    'coarseFieldCapacity',
    0
  );
  const fineLocalHeadOffsetWords = 0;
  const coarseLocalHeadOffsetWords = checkedMultiply(
    resolvedFineCapacity,
    SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_HEAD_WORDS,
    'fine local-head words'
  );
  const localHeadCapacity = checkedAdd(
    resolvedFineCapacity,
    resolvedCoarseCapacity,
    'interface local-head capacity'
  );
  const localHeadWords = checkedMultiply(
    localHeadCapacity,
    SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_HEAD_WORDS,
    'interface local-head words'
  );
  const refluxRouteCapacity = resolvedCoarseCapacity > 0 ? resolvedFineCapacity : 0;
  const refluxRouteWords = checkedMultiply(
    refluxRouteCapacity,
    SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_ROUTE_WORDS,
    'interface reflux-route words'
  );
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_SCHEMA,
    version: SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_VERSION,
    fineFieldCapacity: resolvedFineCapacity,
    coarseFieldCapacity: resolvedCoarseCapacity,
    fineLocalHeadOffsetWords,
    coarseLocalHeadOffsetWords,
    localHeadCapacity,
    localHeadWords,
    localHeadByteLength: byteLength(localHeadWords, 'interface local-head bytes'),
    refluxRouteCapacity,
    refluxRouteWords,
    refluxRouteByteLength: refluxRouteWords === 0
      ? Uint32Array.BYTES_PER_ELEMENT
      : byteLength(refluxRouteWords, 'interface reflux-route bytes'),
    controlWords: SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_WORDS,
    controlByteLength: byteLength(
      SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_WORDS,
      'interface proposal control bytes'
    ),
    paramsByteLength: SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_PARAMS_BYTES
  });
}

export function createSchroederSpatialPhaseVolumeInterfaceProposalPlan({
  fineFieldCapacity,
  fineLevel,
  coarseFieldCapacity = 0,
  coarseLevel = null,
  hasParentFieldView = false,
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
  fineReceiptCompletionOrdinal,
  coarseReceiptCompletionOrdinal = 0,
  parentFieldCompletionOrdinal = 0
} = {}) {
  const layout = createSchroederSpatialPhaseVolumeInterfaceProposalLayout({
    fineFieldCapacity,
    coarseFieldCapacity
  });
  const twoLevel = layout.coarseFieldCapacity > 0;
  if (hasParentFieldView !== twoLevel) {
    throw new RangeError(
      'a two-level interface plan requires exactly one immutable parent-field route authority'
    );
  }
  const identity = Object.fromEntries(IDENTITY_FIELDS.map((field) => [
    field,
    integer(
      ({
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
        supportEpoch
      })[field],
      field,
      ['generationId', 'storageGeneration'].includes(field) ? 1 : 0
    )
  ]));
  const resolvedFineLevel = integer(fineLevel, 'fineLevel', -0x8000_0000, 0x7fff_ffff);
  if (twoLevel && coarseLevel == null) {
    throw new TypeError('coarseLevel must be explicit for a two-level interface plan');
  }
  const resolvedCoarseLevel = twoLevel
    ? integer(coarseLevel, 'coarseLevel', -0x8000_0000, 0x7fff_ffff)
    : -0x8000_0000;
  if (twoLevel && resolvedCoarseLevel !== resolvedFineLevel + 1) {
    throw new RangeError('coarseLevel must be exactly fineLevel + 1');
  }
  const resolvedFineReceiptCompletionOrdinal = integer(
    fineReceiptCompletionOrdinal,
    'fineReceiptCompletionOrdinal',
    1
  );
  const resolvedCoarseReceiptCompletionOrdinal = integer(
    coarseReceiptCompletionOrdinal,
    'coarseReceiptCompletionOrdinal'
  );
  const resolvedParentFieldCompletionOrdinal = integer(
    parentFieldCompletionOrdinal,
    'parentFieldCompletionOrdinal'
  );
  if (
    (twoLevel && (
      resolvedCoarseReceiptCompletionOrdinal < 1
      || resolvedParentFieldCompletionOrdinal < 1
    ))
    || (!twoLevel && (
      resolvedCoarseReceiptCompletionOrdinal !== 0
      || resolvedParentFieldCompletionOrdinal !== 0
    ))
  ) {
    throw new RangeError(
      'completion ordinals must name exactly the artifacts present in the interface plan'
    );
  }
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_SCHEMA,
    status: 'schroeder-spatial-phase-volume-interface-proposal-plan-ready',
    ...identity,
    fineFieldCapacity: layout.fineFieldCapacity,
    coarseFieldCapacity: layout.coarseFieldCapacity,
    fineLevel: resolvedFineLevel,
    coarseLevel: resolvedCoarseLevel,
    twoLevel,
    hasParentFieldView: twoLevel,
    fineReceiptCompletionOrdinal: resolvedFineReceiptCompletionOrdinal,
    coarseReceiptCompletionOrdinal: resolvedCoarseReceiptCompletionOrdinal,
    parentFieldCompletionOrdinal: resolvedParentFieldCompletionOrdinal,
    // Field count is intentionally GPU-header-only.  A host-side count would
    // require a forbidden readback of S9-A/S9-B evidence.  Dispatch the known
    // capacities and let the authenticated field header provide the bound.
    fineLocalDispatchX: groupCount(layout.fineFieldCapacity),
    coarseLocalDispatchX: twoLevel ? groupCount(layout.coarseFieldCapacity) : 0,
    refluxRouteDispatchX: twoLevel ? groupCount(layout.fineFieldCapacity) : 0,
    localPolicyId: SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_POLICY,
    refluxPolicyId: SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_POLICY,
    layout,
    diagnosticOnly: true,
    stateMutationAllowed: false,
    fullParticleReadbackRequired: false,
    fullParticleReadbackPerformed: false
  });
}

/**
 * Structural validation intentionally does not replace the GPU terminal seal.
 * It only establishes that a descriptor still names the exact borrowed S9-B
 * and parent-field artifacts that its WGSL pass authenticated.
 */
export function validateSchroederSpatialPhaseVolumeInterfaceProposalDescriptor(
  descriptor,
  expected = {}
) {
  const proposalState = executionSubmissionState(
    descriptor,
    'schroeder-spatial-phase-volume-interface-proposal-gpu-encoded',
    'schroeder-spatial-phase-volume-interface-proposal-gpu-build-submitted'
  );
  if (
    descriptor?.schema !== ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_SCHEMA
    || !proposalState
    || descriptor?.ready !== true
    || descriptor?.selected !== true
    || descriptor?.diagnosticOnly !== true
    || descriptor?.stateMutationAllowed !== false
    || descriptor?.readbackPerformed !== false
    || descriptor?.fullParticleReadbackRequired !== false
    || descriptor?.fullParticleReadbackPerformed !== false
    || descriptor?.submissionOwnership !== 'caller'
  ) {
    return rejectedDescriptor(
      'schroeder-spatial-phase-volume-interface-proposal-rejected-descriptor',
      'interface proposal is not an encoded immutable GPU-only diagnostic artifact'
    );
  }
  const twoLevel = descriptor.twoLevel === true;
  if (
    twoLevel !== (descriptor.coarseFieldCapacity > 0)
    || descriptor.hasParentFieldView !== twoLevel
    || (!twoLevel && (
      descriptor.coarseLevel !== -0x8000_0000
      || descriptor.coarseReceiptCompletionOrdinal !== 0
      || descriptor.parentFieldCompletionOrdinal !== 0
      || descriptor.coarseReceipt != null
      || descriptor.parentFieldView != null
      || descriptor.coarsePhaseVolumeMoment != null
      || descriptor.coarseMechanicsFieldView != null
      || descriptor.coarseMechanicsFieldViewBuffer != null
      || descriptor.parentFieldViewBuffer != null
    ))
    || (twoLevel && (
      descriptor.coarseLevel !== descriptor.fineLevel + 1
      || descriptor.coarseReceiptCompletionOrdinal < 1
      || descriptor.parentFieldCompletionOrdinal < 1
    ))
  ) {
    return rejectedDescriptor(
      'schroeder-spatial-phase-volume-interface-proposal-rejected-levels',
      'interface proposal does not have one canonical local/reflux topology shape'
    );
  }
  let layout;
  try {
    layout = createSchroederSpatialPhaseVolumeInterfaceProposalLayout({
      fineFieldCapacity: descriptor.fineFieldCapacity,
      coarseFieldCapacity: descriptor.coarseFieldCapacity
    });
  } catch (error) {
    return rejectedDescriptor(
      'schroeder-spatial-phase-volume-interface-proposal-rejected-layout',
      error instanceof Error ? error.message : String(error)
    );
  }
  for (const field of Object.keys(layout)) {
    if (field === 'schema' || field === 'version') continue;
    if (descriptor.layout?.[field] !== layout[field]) {
      return rejectedDescriptor(
        'schroeder-spatial-phase-volume-interface-proposal-rejected-layout',
        `interface proposal layout field ${field} is not canonical`,
        field
      );
    }
  }
  for (const field of [
    ...IDENTITY_FIELDS,
    'fineFieldCapacity',
    'coarseFieldCapacity',
    'fineLevel',
    'coarseLevel',
    'fineReceiptCompletionOrdinal',
    'coarseReceiptCompletionOrdinal',
    'parentFieldCompletionOrdinal'
  ]) {
    if (Object.hasOwn(expected, field) && descriptor[field] !== expected[field]) {
      return rejectedDescriptor(
        'schroeder-spatial-phase-volume-interface-proposal-rejected-identity',
        `interface proposal ${field} does not match the expected generation`,
        field
      );
    }
  }
  const fineReceipt = descriptor.fineReceipt;
  const fineState = executionSubmissionState(
    fineReceipt,
    'schroeder-spatial-phase-volume-receipt-gpu-encoded',
    'schroeder-spatial-phase-volume-receipt-gpu-build-submitted'
  );
  const fineMomentState = executionSubmissionState(
    fineReceipt?.phaseVolumeMoment,
    'schroeder-spatial-phase-volume-moment-gpu-encoded',
    'schroeder-spatial-phase-volume-moment-gpu-build-submitted'
  );
  const fineFieldState = executionSubmissionState(
    fineReceipt?.mechanicsFieldView,
    'schroeder-spatial-mechanics-field-view-gpu-encoded',
    'schroeder-spatial-mechanics-field-view-gpu-build-submitted'
  );
  const fineAdmission = validateSchroederSpatialPhaseVolumeReceiptDescriptor(
    fineReceipt,
    {
      generationId: descriptor.generationId,
      deviceOrdinal: descriptor.deviceOrdinal,
      laneOrdinal: descriptor.laneOrdinal,
      leaseToken: descriptor.leaseToken,
      sourceFamilyId: descriptor.sourceFamilyId,
      storageGeneration: descriptor.storageGeneration,
      physicsTick: descriptor.physicsTick,
      physicsSubstep: descriptor.physicsSubstep,
      positionEpoch: descriptor.positionEpoch,
      topologyEpoch: descriptor.topologyEpoch,
      chartEpoch: descriptor.chartEpoch,
      levelEpoch: descriptor.levelEpoch,
      supportEpoch: descriptor.supportEpoch,
      selectedLevel: descriptor.fineLevel,
      completionOrdinal: descriptor.fineReceiptCompletionOrdinal,
      fieldCapacity: descriptor.fineFieldCapacity
    }
  );
  if (
    fineAdmission.admitted !== true
    || fineState !== proposalState
    || fineMomentState !== proposalState
    || fineFieldState !== proposalState
    || fineReceipt?.schema !== ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA
    || fineReceipt?.phaseVolumeMoment?.schema !== ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA
    || fineReceipt?.phaseVolumeMoment?.mechanicsFieldView !== fineReceipt?.mechanicsFieldView
    || descriptor.finePhaseVolumeMoment !== fineReceipt.phaseVolumeMoment
    || descriptor.fineMechanicsFieldView !== fineReceipt.mechanicsFieldView
    || descriptor.fineMechanicsFieldViewBuffer !== fineReceipt.mechanicsFieldView?.fieldViewBuffer
    || descriptor.fineFieldCapacity !== fineReceipt.fieldCapacity
    || descriptor.fineLevel !== fineReceipt.selectedLevel
    || descriptor.fineReceiptCompletionOrdinal !== fineReceipt.completionOrdinal
  ) {
    return rejectedDescriptor(
      'schroeder-spatial-phase-volume-interface-proposal-rejected-fine-receipt',
      'interface proposal lost its exact admitted fine S9-B receipt lineage'
    );
  }
  if (twoLevel) {
    const coarseReceipt = descriptor.coarseReceipt;
    const coarseState = executionSubmissionState(
      coarseReceipt,
      'schroeder-spatial-phase-volume-receipt-gpu-encoded',
      'schroeder-spatial-phase-volume-receipt-gpu-build-submitted'
    );
    const coarseMomentState = executionSubmissionState(
      coarseReceipt?.phaseVolumeMoment,
      'schroeder-spatial-phase-volume-moment-gpu-encoded',
      'schroeder-spatial-phase-volume-moment-gpu-build-submitted'
    );
    const coarseFieldState = executionSubmissionState(
      coarseReceipt?.mechanicsFieldView,
      'schroeder-spatial-mechanics-field-view-gpu-encoded',
      'schroeder-spatial-mechanics-field-view-gpu-build-submitted'
    );
    const coarseAdmission = validateSchroederSpatialPhaseVolumeReceiptDescriptor(
      coarseReceipt,
      {
        fieldCapacity: descriptor.coarseFieldCapacity,
        selectedLevel: descriptor.coarseLevel,
        completionOrdinal: descriptor.coarseReceiptCompletionOrdinal
      }
    );
    if (
      coarseAdmission.admitted !== true
      || coarseState !== proposalState
      || coarseMomentState !== proposalState
      || coarseFieldState !== proposalState
      || !sameIdentity(fineReceipt, coarseReceipt)
      || descriptor.coarseLevel !== descriptor.fineLevel + 1
      || descriptor.coarsePhaseVolumeMoment !== coarseReceipt?.phaseVolumeMoment
      || descriptor.coarseMechanicsFieldView !== coarseReceipt?.mechanicsFieldView
      || descriptor.coarseMechanicsFieldViewBuffer !== coarseReceipt?.mechanicsFieldView?.fieldViewBuffer
      || descriptor.coarseFieldCapacity !== coarseReceipt?.fieldCapacity
      || descriptor.coarseReceiptCompletionOrdinal !== coarseReceipt?.completionOrdinal
    ) {
      return rejectedDescriptor(
        'schroeder-spatial-phase-volume-interface-proposal-rejected-coarse-receipt',
        'interface proposal lost its exact same-epoch coarse S9-B receipt lineage'
      );
    }
    const parent = descriptor.parentFieldView;
    const parentState = executionSubmissionState(
      parent,
      'schroeder-spatial-parent-field-view-gpu-encoded',
      'schroeder-spatial-parent-field-view-gpu-build-submitted'
    );
    let parentLayout = null;
    try {
      parentLayout = createSchroederSpatialParentFieldViewLayout({
        fineFieldCapacity: descriptor.fineFieldCapacity,
        coarseFieldCapacity: descriptor.coarseFieldCapacity
      });
    } catch {
      parentLayout = null;
    }
    if (
      !parentLayout
      || parentState !== proposalState
      || parent?.schema !== ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA
      || parent?.fineFieldView !== fineReceipt.mechanicsFieldView
      || parent?.coarseFieldView !== coarseReceipt.mechanicsFieldView
      || parent?.fineLevel !== descriptor.fineLevel
      || parent?.coarseLevel !== descriptor.coarseLevel
      || !sameIdentity(parent, fineReceipt)
      || parent?.completionOrdinal !== descriptor.parentFieldCompletionOrdinal
      || parent?.released === true
      || !descriptor.parentFieldViewBuffer
      || descriptor.parentFieldViewBuffer !== parent.parentFieldViewBuffer
      || parent?.layout?.byteLength !== parentLayout.byteLength
      || parent?.layout?.wordLength !== parentLayout.wordLength
      || parent?.layout?.fineEdgeOffsetOffsetWords !== parentLayout.fineEdgeOffsetOffsetWords
      || parent?.layout?.fineEdgeParentOffsetWords !== parentLayout.fineEdgeParentOffsetWords
      || parent?.layout?.fineEdgeWeightOffsetWords !== parentLayout.fineEdgeWeightOffsetWords
    ) {
      return rejectedDescriptor(
        'schroeder-spatial-phase-volume-interface-proposal-rejected-parent-field',
        'interface proposal lost its exact immutable parent-field route authority'
      );
    }
  }
  if (
    descriptor.released === true
    || !descriptor.controlBuffer
    || !descriptor.localHeadBuffer
    || !descriptor.refluxRouteBuffer
    || !descriptor.paramsBuffer
  ) {
    return rejectedDescriptor(
      'schroeder-spatial-phase-volume-interface-proposal-rejected-ownership',
      'interface proposal descriptor is not owned by its GPU runtime'
    );
  }
  const requirements = [
    [descriptor.controlBuffer, layout.controlByteLength],
    [descriptor.localHeadBuffer, layout.localHeadByteLength],
    [descriptor.refluxRouteBuffer, layout.refluxRouteByteLength],
    [descriptor.paramsBuffer, layout.paramsByteLength],
    [fineReceipt.controlBuffer, fineReceipt.layout.controlByteLength],
    [descriptor.fineMechanicsFieldViewBuffer,
      descriptor.fineMechanicsFieldView?.layout?.byteLength
        ?? SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT],
    [fineReceipt.phaseVolumeMoment?.controlBuffer,
      SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT],
    [fineReceipt.phaseVolumeMoment?.momentBuffer,
      descriptor.fineFieldCapacity
        * SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS
        * Uint32Array.BYTES_PER_ELEMENT]
  ];
  if (twoLevel) {
    requirements.push(
      [descriptor.coarseReceipt.controlBuffer, descriptor.coarseReceipt.layout.controlByteLength],
      [descriptor.coarseMechanicsFieldViewBuffer,
        descriptor.coarseMechanicsFieldView?.layout?.byteLength
          ?? SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT],
      [descriptor.coarseReceipt.phaseVolumeMoment?.controlBuffer,
        SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT],
      [descriptor.coarseReceipt.phaseVolumeMoment?.momentBuffer,
        descriptor.coarseFieldCapacity
          * SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS
          * Uint32Array.BYTES_PER_ELEMENT],
      [descriptor.parentFieldViewBuffer,
        descriptor.parentFieldView?.layout?.byteLength
          ?? SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT]
    );
  }
  if (requirements.some(([buffer, required]) => (
    !buffer || (Number.isFinite(Number(buffer.size)) && Number(buffer.size) < required)
  ))) {
    return rejectedDescriptor(
      'schroeder-spatial-phase-volume-interface-proposal-rejected-buffer-size',
      'interface proposal buffer is smaller than its immutable ABI requirement'
    );
  }
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_SCHEMA,
    status: 'schroeder-spatial-phase-volume-interface-proposal-admitted',
    admitted: true,
    descriptor
  });
}
