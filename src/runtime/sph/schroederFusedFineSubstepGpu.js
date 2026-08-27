import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS
} from '../../../ulg-gpu-abi/src/schroederCrossLevelRefluxLedger.js';
import {
  webGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';
import {
  validateLocallySubmittedMlsMpmMechanicsFieldP2g
} from './sphGridGpuKernel.js';
import {
  validateLocallySubmittedMlsMpmMechanicsFieldGridUpdate
} from './sphGridUpdateGpuKernel.js';
import {
  validateLocallyOwnedSchroederCrossLevelRefluxLedgerGpu,
  validateLocallySubmittedSchroederSpatialParentFieldCoarseTerminalGpu,
  validateLocallySubmittedSchroederSpatialParentFieldFineCorrectionGpu
} from './schroederSpatialParentFieldMechanicsWorkspaceGpu.js';
import {
  claimLocallySubmittedMlsMpmFusedCoarseTerminalG2pOutput,
  claimLocallySubmittedMlsMpmFusedG2pOutputForContinuation,
  retireLocallySubmittedMlsMpmFusedCoarseTerminalG2pOutputAfter,
  validateClaimedLocallySubmittedMlsMpmFusedCoarseTerminalG2pOutput,
  validateLocallySubmittedMlsMpmFusedG2p
} from './sphG2pGpuKernel.js';
import {
  validateSchroederSpatialEpochTransactionCommit,
  validateSchroederSpatialEpochTransactionPrivateAdvance
} from './schroederSpatialEpochTransaction.js';

export const ULG_SCHROEDER_TWO_LEVEL_MACRO_AUTHORITY_SCHEMA =
  'peercompute.ulg.schroeder-two-level-macro-authority.v0';
export const ULG_SCHROEDER_CANONICAL_PARTICLE_CONTINUATION_SCHEMA =
  'peercompute.ulg.schroeder-canonical-particle-continuation.v0';
export const ULG_SCHROEDER_FINE_MICROEPOCH_AUTHORITY_SCHEMA =
  'peercompute.ulg.schroeder-fine-microepoch-authority.v0';
export const ULG_SCHROEDER_FUSED_FINE_SUBSTEP_TRANSACTION_SCHEMA =
  'peercompute.ulg.schroeder-fused-fine-substep-transaction.v0';
export const ULG_SCHROEDER_FUSED_COARSE_TERMINAL_TRANSACTION_SCHEMA =
  'peercompute.ulg.schroeder-fused-coarse-terminal-transaction.v0';
export const ULG_SCHROEDER_FUSED_MECHANICS_PENDING_CLOSURE_SCHEMA =
  'peercompute.ulg.schroeder-fused-mechanics-pending-closure.v0';
export const ULG_SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_TARGET_SCHEMA =
  'peercompute.ulg.schroeder-fused-terminal-reflux-receipt-target.v0';
export const ULG_SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_COPY_SCHEMA =
  'peercompute.ulg.schroeder-fused-terminal-reflux-receipt-copy.v0';
export const SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_TARGET_OPTION =
  'schroederFusedTerminalRefluxReceiptTarget';

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8
};
const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
export const SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_BYTE_LENGTH =
  SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS * UINT32_BYTES;

const macroAuthorityOrigins = new WeakMap();
const particleContinuationOrigins = new WeakMap();
const fineMicroepochOrigins = new WeakMap();
const fineTransactionOrigins = new WeakMap();
const coarseTerminalTransactionOrigins = new WeakMap();
const pendingClosureOrigins = new WeakMap();
const mechanicsFieldPublicationReceiptOrigins = new WeakMap();
const terminalRefluxReceiptTargetOrigins = new WeakMap();
const terminalRefluxReceiptTargetBuffers = new WeakMap();

const FINE_STAGE_ORDER = Object.freeze([
  'p2g',
  'grid-update',
  'fine-correction',
  'g2p'
]);
const COARSE_TERMINAL_STAGE_ORDER = Object.freeze([
  'p2g',
  'grid-update',
  'coarse-terminal',
  'g2p'
]);

function validateExactStageProducer(stage, device, artifact, options) {
  switch (stage) {
    case 'p2g':
      return validateLocallySubmittedMlsMpmMechanicsFieldP2g(
        device,
        artifact,
        options
      );
    case 'grid-update':
      return validateLocallySubmittedMlsMpmMechanicsFieldGridUpdate(
        device,
        artifact,
        options
      );
    case 'fine-correction':
      return validateLocallySubmittedSchroederSpatialParentFieldFineCorrectionGpu(
        device,
        artifact,
        options
      );
    case 'coarse-terminal':
      return validateLocallySubmittedSchroederSpatialParentFieldCoarseTerminalGpu(
        device,
        artifact,
        options
      );
    case 'g2p':
      return validateLocallySubmittedMlsMpmFusedG2p(
        device,
        artifact,
        options
      );
    default:
      return false;
  }
}

/*
 * Architecture-A private lifecycle (live admission is intentionally narrower
 * than historical authenticity):
 *
 * Macro
 *   open-private -> aborting -> aborted-retired
 *                         \-> abort-quarantined -> aborting (exact retry)
 *   Only open-private admits continuations, microepochs, or transactions.
 *   Aborting collects every registered E_j retirement; aborted is reached only
 *   after all of them (including E0) have retired. Historical identity remains
 *   queryable for cleanup/audit, but never reopens admission.
 *
 * Microepoch
 *   private-ready -> transaction-reserved -> p2g-submitted
 *     -> grid-update-submitted -> fine-correction-submitted
 *     -> g2p-submitted-unverified -> retiring -> retired
 *   transaction-reserved -> discarded -> retiring -> retired
 *   any submitted/retiring state -> quarantined -> retired
 *                                      ^ exact queue/device-loss retry
 *
 * Productive states require exact runtime ownership and the exact active field
 * publication lock. Discarded/retiring/quarantined/retired states are never
 * live, but remain historically authentic through the module-private origin
 * maps so fence/device-loss cleanup can finish without trusting public clones.
 */
const LIVE_MACRO_STATUS = 'mechanics-macro-open-private';
const LIVE_MICROEPOCH_STATUSES = new Set([
  'private-ready',
  'transaction-reserved',
  'p2g-submitted',
  'grid-update-submitted',
  'fine-correction-submitted',
  'g2p-submitted-unverified',
  'coarse-terminal-transaction-reserved',
  'terminal-p2g-submitted',
  'terminal-grid-update-submitted',
  'terminal-reflux-submitted',
  'terminal-g2p-submitted-unverified'
]);

function createAbortRetirementSide({ required = true } = {}) {
  return {
    required,
    quarantined: false,
    retired: false,
    promise: null,
    attempt: null
  };
}

function createAbortRetirementLedger({ coarseRequired = false } = {}) {
  return {
    fine: createAbortRetirementSide(),
    coarse: createAbortRetirementSide({ required: coarseRequired })
  };
}

function exactArraySnapshot(value) {
  return Object.freeze(Array.from(value ?? []));
}

function exactArrayMatches(value, snapshot) {
  return Array.isArray(value)
    && value.length === snapshot.length
    && snapshot.every((entry, index) => Object.is(value[index], entry));
}

function positiveInteger(value, label, max = 0xffff_ffff) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new RangeError(`${label} must be an integer in [1, ${max}]`);
  }
  return number;
}

function exactU32(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 0xffff_ffff) {
    throw new RangeError(`${label} must be an exact u32`);
  }
  return number;
}

function positiveFinite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || !(number > 0)) {
    throw new RangeError(`${label} must be positive and finite`);
  }
  return number;
}

function refluxLedgerAdmitted(device, ledger, {
  parentFieldView,
  fineSubstepCount,
  fineLevel,
  coarseLevel
}) {
  try {
    return validateLocallyOwnedSchroederCrossLevelRefluxLedgerGpu(
      device,
      ledger,
      {
      minimumCoarseFieldCapacity: parentFieldView.coarseFieldCapacity,
      fineSubstepCount,
      fineLevel,
      coarseLevel,
      coarseGridSpacingM: parentFieldView.coarseFieldView.gridSpacingM
      }
    ) === true;
  } catch {
    return false;
  }
}

function refluxLedgerAdmissionFailure(device, ledger, {
  parentFieldView,
  fineSubstepCount,
  fineLevel,
  coarseLevel
}) {
  const probes = [
    ['ledger-core', {}],
    ['coarse-capacity', {
      minimumCoarseFieldCapacity: parentFieldView?.coarseFieldCapacity
    }],
    ['fine-substep-count', { fineSubstepCount }],
    ['fine-level', { fineLevel }],
    ['coarse-level', { coarseLevel }],
    ['coarse-grid-spacing', {
      coarseGridSpacingM: parentFieldView?.coarseFieldView?.gridSpacingM
    }]
  ];
  for (const [label, options] of probes) {
    try {
      if (
        validateLocallyOwnedSchroederCrossLevelRefluxLedgerGpu(
          device,
          ledger,
          options
        ) !== true
      ) return label;
    } catch {
      return label;
    }
  }
  return 'combined-contract';
}

function macroMatchesOrigin(device, macroAuthority, origin) {
  const execution = origin?.execution;
  const source = origin?.source;
  const parent = origin?.parentFieldView;
  const fineField = origin?.fineFieldView;
  const coarseField = origin?.coarseFieldView;
  const sph = origin?.sourceSphParticleUpload;
  const mls = origin?.sourceMlsMpmParticleUpload;
  const rootPublicationLockActive = origin?.rootRetired === true
    || origin?.rootRetirementStatus === 'retiring'
    ? true
    : origin?.fineFieldRuntime?.isStatePublicationLockActive?.(
        fineField,
        origin?.rootPublicationLock
      ) === true;
  return Boolean(
    origin
    && origin.deviceId === webGpuDeviceId(device)
    && macroAuthority === origin.macroAuthority
    && macroAuthority.schema === ULG_SCHROEDER_TWO_LEVEL_MACRO_AUTHORITY_SCHEMA
    && macroAuthority.status === 'macro-frozen-authority-ready'
    && origin.terminalStatus === LIVE_MACRO_STATUS
    && macroAuthority.generation === origin.generation
    && macroAuthority.parentFieldView === parent
    && macroAuthority.refluxLedger === origin.refluxLedger
    && macroAuthority.canonicalEpoch === origin.canonicalEpoch
    && macroAuthority.sourceSphParticleUpload === sph
    && macroAuthority.sourceMlsMpmParticleUpload === mls
    && macroAuthority.generationId === origin.generationId
    && macroAuthority.rootGenerationId === origin.generationId
    && macroAuthority.completionOrdinal === origin.completionOrdinal
    && macroAuthority.rootPublicationLock === origin.rootPublicationLock
    && macroAuthority.fineSubstepCount === origin.fineSubstepCount
    && macroAuthority.fineLevel === origin.fineLevel
    && macroAuthority.coarseLevel === origin.coarseLevel
    && Object.is(macroAuthority.fineDt, origin.fineDt)
    && Object.is(macroAuthority.macroDt, origin.macroDt)
    && origin.canonicalEpoch?.generation === origin.generation
    && origin.canonicalEpoch?.sphParticleUpload === sph
    && origin.canonicalEpoch?.mlsMpmParticleUpload === mls
    && origin.generation?.selected === true
    && origin.generation?.ready === true
    && origin.generation?.execution === execution
    && origin.generation?.source === source
    && origin.generation?.parentFieldView === parent
    && (origin.rootRetired === true
      || (execution?.submitPerformed === true && execution?.released !== true))
    && execution?.generationId === origin.generationId
    && source?.sourceStateBuffer === origin.sourceStateBuffer
    && source?.assignmentBuffer === origin.rootAssignmentBuffer
    && source?.topologyEpoch === origin.rootTopologyEpoch
    && source?.chartEpoch === origin.rootChartEpoch
    && source?.levelEpoch === origin.rootLevelEpoch
    && source?.supportEpoch === origin.rootSupportEpoch
    && source?.minLevel === origin.rootMinLevel
    && source?.maxLevel === origin.rootMaxLevel
    && source?.chartId === origin.rootChartId
    && Object.is(source?.baseGridSpacingM, origin.rootBaseGridSpacingM)
    && source?.sourceStateBuffer === sph?.stateBuffer
    && parent?.fineLevel === origin.fineLevel
    && parent?.coarseLevel === origin.coarseLevel
    && parent?.exactLevelCount === 2
    && parent?.parentFieldCapacity === origin.parentFieldCapacity
    && parent?.fineFieldCapacity === origin.fineFieldCapacity
    && parent?.coarseFieldCapacity === origin.coarseFieldCapacity
    && parent?.fineFieldView === fineField
    && parent?.coarseFieldView === coarseField
    && fineField?.identityBuffer === origin.identityBuffer
    && coarseField?.identityBuffer === origin.identityBuffer
    && fineField?.fieldViewBuffer === origin.fineFieldBuffer
    && coarseField?.fieldViewBuffer === origin.coarseFieldBuffer
    && fineField?.ownerRuntime === origin.fineFieldRuntime
    && coarseField?.ownerRuntime === origin.coarseFieldRuntime
    && fineField?.selectedLevel === origin.fineFieldSelectedLevel
    && coarseField?.selectedLevel === origin.coarseFieldSelectedLevel
    && Object.is(fineField?.gridSpacingM, origin.fineGridSpacingM)
    && Object.is(coarseField?.gridSpacingM, origin.coarseGridSpacingM)
    && exactArrayMatches(fineField?.gridDims, origin.fineGridDims)
    && exactArrayMatches(coarseField?.gridDims, origin.coarseGridDims)
    && sph?.status === origin.sphStatus
    && sph?.particleCount === origin.particleCount
    && sph?.stateBuffer === origin.sourceStateBuffer
    && sph?.thermoBuffer === origin.thermoBuffer
    && sph?.identityBuffer === origin.identityBuffer
    && mls?.status === origin.mlsStatus
    && mls?.particleCount === origin.particleCount
    && mls?.mechanicsBuffer === origin.mechanicsBuffer
    && rootPublicationLockActive
    && refluxLedgerAdmitted(device, origin.refluxLedger, {
      parentFieldView: parent,
      fineSubstepCount: origin.fineSubstepCount,
      fineLevel: origin.fineLevel,
      coarseLevel: origin.coarseLevel
    })
  );
}

function macroOriginFor(device, macroAuthority) {
  const origin = macroAuthorityOrigins.get(macroAuthority);
  return macroMatchesOrigin(device, macroAuthority, origin) ? origin : null;
}

function validateMechanicsFieldPublicationReceipt(
  device,
  receipt,
  {
    execution,
    publicationLock,
    mutationOrdinal,
    stateEncoding,
    closureOrdinal
  } = {}
) {
  const receiptOrigin = mechanicsFieldPublicationReceiptOrigins.get(receipt);
  const closureOrigin = receiptOrigin?.closureOrigin;
  if (
    !receiptOrigin
    || receiptOrigin.deviceId !== webGpuDeviceId(device)
    || receiptOrigin.receipt !== receipt
    || receipt?.schema
      !== 'peercompute.ulg.schroeder-mechanics-field-publication-receipt.v0'
    || receipt?.status !== 'macro-closure-gpu-verified-private'
    || receipt?.particlePublicationAllowed !== true
    || receipt?.closure !== closureOrigin?.closure
    || receipt?.publicSpatialEpochTransaction
      !== receiptOrigin.publicSpatialEpochTransaction
    || receipt?.publicCommitReceipt !== receiptOrigin.publicCommitReceipt
    || receipt?.closureOrdinal !== receiptOrigin.closureOrdinal
    || closureOrdinal !== receiptOrigin.closureOrdinal
    || closureOrigin?.lifecycle?.state !== 'publication-preparing'
    || pendingClosureOrigins.get(closureOrigin.closure) !== closureOrigin
  ) return false;
  return receiptOrigin.targets.some((target) => (
    target.execution === execution
    && target.publicationLock === publicationLock
    && target.mutationOrdinal === mutationOrdinal
    && target.stateEncoding === stateEncoding
  ));
}

export function createSchroederTwoLevelMacroAuthority({
  device,
  canonicalEpoch,
  refluxLedger,
  refluxLedgerValidator: callerSelectedRefluxLedgerValidator = null,
  fineSubstepCount,
  fineLevel,
  coarseLevel = Number(fineLevel) + 1,
  fineDt,
  macroDt
} = {}) {
  if (callerSelectedRefluxLedgerValidator != null) {
    throw new TypeError(
      'macro reflux-ledger provenance is module-owned and cannot be caller-selected'
    );
  }
  const generation = canonicalEpoch?.generation ?? null;
  const execution = generation?.execution ?? null;
  const parentFieldView = generation?.parentFieldView ?? null;
  const sourceSphParticleUpload = canonicalEpoch?.sphParticleUpload ?? null;
  const sourceMlsMpmParticleUpload = canonicalEpoch?.mlsMpmParticleUpload ?? null;
  const substepCount = positiveInteger(fineSubstepCount, 'fineSubstepCount', 4);
  const resolvedFineLevel = Number(fineLevel);
  const resolvedCoarseLevel = Number(coarseLevel);
  const resolvedFineDt = positiveFinite(fineDt, 'fineDt');
  const resolvedMacroDt = positiveFinite(macroDt, 'macroDt');
  const macroAuthorityRequirements = Object.freeze({
    'device-present': Boolean(device),
    'generation-live': generation?.selected === true
      && generation?.ready === true,
    'generation-submitted': execution?.submitPerformed === true
      && execution?.released !== true,
    'parent-levels-exact': parentFieldView?.fineLevel === resolvedFineLevel
      && parentFieldView?.coarseLevel === resolvedCoarseLevel
      && parentFieldView?.exactLevelCount === 2,
    'parent-fields-present': Boolean(
      parentFieldView?.fineFieldView
      && parentFieldView?.coarseFieldView
    ),
    'source-state-current': generation?.source?.sourceStateBuffer
      === sourceSphParticleUpload?.stateBuffer,
    'fine-identity-current': parentFieldView?.fineFieldView?.identityBuffer
      === sourceSphParticleUpload?.identityBuffer,
    'coarse-identity-current': parentFieldView?.coarseFieldView?.identityBuffer
      === sourceSphParticleUpload?.identityBuffer,
    'sph-upload-ready': sourceSphParticleUpload?.status === 'webgpu-uploaded',
    'mls-upload-ready': sourceMlsMpmParticleUpload?.status === 'webgpu-uploaded',
    'particle-count-paired': sourceSphParticleUpload?.particleCount
      === sourceMlsMpmParticleUpload?.particleCount,
    'macro-time-exact': Math.fround(resolvedFineDt * substepCount)
      === Math.fround(resolvedMacroDt),
    'reflux-ledger-admitted': refluxLedgerAdmitted(device, refluxLedger, {
      parentFieldView,
      fineSubstepCount: substepCount,
      fineLevel: resolvedFineLevel,
      coarseLevel: resolvedCoarseLevel
    })
  });
  const failedMacroAuthorityRequirements = Object.entries(
    macroAuthorityRequirements
  ).filter(([, ready]) => ready !== true).map(([requirement]) => requirement);
  if (failedMacroAuthorityRequirements.length > 0) {
    const reportedFailedRequirements = failedMacroAuthorityRequirements.map(
      (requirement) => requirement !== 'reflux-ledger-admitted'
        ? requirement
        : `${requirement}:${refluxLedgerAdmissionFailure(
            device,
            refluxLedger,
            {
              parentFieldView,
              fineSubstepCount: substepCount,
              fineLevel: resolvedFineLevel,
              coarseLevel: resolvedCoarseLevel
            }
          )}`
    );
    const error = new TypeError(
      'fused fine-substep macro authority requires one exact live frozen generation, particle family, parent-field dictionary, and reflux ledger'
        + ` (${reportedFailedRequirements.join(', ')})`
    );
    error.code = 'ERR_SCHROEDER_FUSED_MACRO_AUTHORITY';
    error.failedRequirements = Object.freeze([
      ...reportedFailedRequirements
    ]);
    throw error;
  }
  const completionOrdinal = exactU32(
    refluxLedger.completionOrdinal,
    'refluxLedger.completionOrdinal'
  );
  if (completionOrdinal !== execution.generationId) {
    throw new TypeError(
      'macro-frozen reflux H7 owner must equal the exact spatial generation id'
    );
  }
  const fineFieldRuntime = parentFieldView.fineFieldView.ownerRuntime;
  if (
    typeof fineFieldRuntime?.acquireStatePublicationLock !== 'function'
    || typeof fineFieldRuntime?.isStatePublicationLockActive !== 'function'
  ) {
    throw new TypeError(
      'macro authority requires a publication-lock-capable fine field runtime'
    );
  }
  const rootPublicationOwner = Object.freeze({
    schema: 'peercompute.ulg.schroeder-macro-root-publication-owner.v0',
    completionOrdinal
  });
  const rootPublicationLock = fineFieldRuntime.acquireStatePublicationLock(
    parentFieldView.fineFieldView,
    {
      owner: rootPublicationOwner,
      publicationReceiptValidator:
        validateMechanicsFieldPublicationReceipt
    }
  );
  const macroAuthority = {
    schema: ULG_SCHROEDER_TWO_LEVEL_MACRO_AUTHORITY_SCHEMA,
    status: 'macro-frozen-authority-ready',
    deviceId: webGpuDeviceId(device),
    canonicalEpoch,
    generation,
    parentFieldView,
    refluxLedger,
    sourceSphParticleUpload,
    sourceMlsMpmParticleUpload,
    generationId: execution.generationId,
    rootGenerationId: execution.generationId,
    completionOrdinal,
    rootPublicationLock,
    fineSubstepCount: substepCount,
    fineLevel: resolvedFineLevel,
    coarseLevel: resolvedCoarseLevel,
    fineDt: resolvedFineDt,
    macroDt: resolvedMacroDt
  };
  const origin = {
    deviceId: macroAuthority.deviceId,
    macroAuthority,
    canonicalEpoch,
    generation,
    execution,
    source: generation.source,
    parentFieldView,
    fineFieldView: parentFieldView.fineFieldView,
    coarseFieldView: parentFieldView.coarseFieldView,
    refluxLedger,
    sourceSphParticleUpload,
    sourceMlsMpmParticleUpload,
    generationId: execution.generationId,
    completionOrdinal,
    fineSubstepCount: substepCount,
    fineLevel: resolvedFineLevel,
    coarseLevel: resolvedCoarseLevel,
    fineDt: resolvedFineDt,
    macroDt: resolvedMacroDt,
    sourceStateBuffer: sourceSphParticleUpload.stateBuffer,
    thermoBuffer: sourceSphParticleUpload.thermoBuffer,
    identityBuffer: sourceSphParticleUpload.identityBuffer,
    mechanicsBuffer: sourceMlsMpmParticleUpload.mechanicsBuffer,
    particleCount: sourceSphParticleUpload.particleCount,
    sphStatus: sourceSphParticleUpload.status,
    mlsStatus: sourceMlsMpmParticleUpload.status,
    parentFieldCapacity: parentFieldView.parentFieldCapacity,
    fineFieldCapacity: parentFieldView.fineFieldCapacity,
    coarseFieldCapacity: parentFieldView.coarseFieldCapacity,
    fineFieldBuffer: parentFieldView.fineFieldView.fieldViewBuffer,
    coarseFieldBuffer: parentFieldView.coarseFieldView.fieldViewBuffer,
    fineFieldRuntime: parentFieldView.fineFieldView.ownerRuntime,
    coarseFieldRuntime: parentFieldView.coarseFieldView.ownerRuntime,
    rootPublicationOwner,
    rootPublicationLock,
    rootRetired: false,
    rootRetirementStatus: 'active',
    rootRetirementPromise: null,
    nextContinuationOrdinal: 0,
    nextMicroepochOrdinal: 0,
    continuationByOrdinal: new Map(),
    microepochByOrdinal: new Map(),
    fineTransactionByOrdinal: new Map(),
    lastTransaction: null,
    terminalTransaction: null,
    pendingClosure: null,
    abortPromise: null,
    abortAttempt: null,
    refluxLedgerRetirement: {
      retired: false,
      promise: null,
      failureReason: null
    },
    rootAbortRetirement: createAbortRetirementSide(),
    terminalStatus: LIVE_MACRO_STATUS,
    rootAssignmentBuffer: generation.source.assignmentBuffer,
    rootTopologyEpoch: generation.source.topologyEpoch,
    rootChartEpoch: generation.source.chartEpoch,
    rootLevelEpoch: generation.source.levelEpoch,
    rootSupportEpoch: generation.source.supportEpoch,
    rootMinLevel: generation.source.minLevel,
    rootMaxLevel: generation.source.maxLevel,
    rootChartId: generation.source.chartId,
    rootBaseGridSpacingM: generation.source.baseGridSpacingM,
    fineFieldSelectedLevel: parentFieldView.fineFieldView.selectedLevel,
    coarseFieldSelectedLevel: parentFieldView.coarseFieldView.selectedLevel,
    fineGridSpacingM: parentFieldView.fineFieldView.gridSpacingM,
    coarseGridSpacingM: parentFieldView.coarseFieldView.gridSpacingM,
    fineGridDims: exactArraySnapshot(parentFieldView.fineFieldView.gridDims),
    coarseGridDims: exactArraySnapshot(parentFieldView.coarseFieldView.gridDims)
  };
  Object.freeze(macroAuthority);
  macroAuthorityOrigins.set(macroAuthority, origin);
  return macroAuthority;
}

export function validateSchroederTwoLevelMacroAuthority(
  device,
  macroAuthority,
  {
    canonicalEpoch = null,
    generation = null,
    parentFieldView = null,
    refluxLedger = null
  } = {}
) {
  const origin = macroOriginFor(device, macroAuthority);
  if (origin) {
    return (canonicalEpoch == null || canonicalEpoch === origin.canonicalEpoch)
      && (generation == null || generation === origin.generation)
      && (parentFieldView == null || parentFieldView === origin.parentFieldView)
      && (refluxLedger == null || refluxLedger === origin.refluxLedger);
  }
  return false;
}

function particleUploadSnapshot(sphParticleUpload, mlsMpmParticleUpload) {
  return Object.freeze({
    sphStatus: sphParticleUpload?.status,
    sphSchema: sphParticleUpload?.schema,
    mlsStatus: mlsMpmParticleUpload?.status,
    mlsSchema: mlsMpmParticleUpload?.schema,
    particleCount: sphParticleUpload?.particleCount,
    mlsParticleCount: mlsMpmParticleUpload?.particleCount,
    stateBuffer: sphParticleUpload?.stateBuffer ?? null,
    thermoBuffer: sphParticleUpload?.thermoBuffer ?? null,
    identityBuffer: sphParticleUpload?.identityBuffer ?? null,
    mechanicsBuffer: mlsMpmParticleUpload?.mechanicsBuffer ?? null,
    storageGeneration: sphParticleUpload?.storageGeneration,
    mlsStorageGeneration: mlsMpmParticleUpload?.storageGeneration,
    bufferFamilyGeneration: sphParticleUpload?.bufferFamilyGeneration,
    mlsBufferFamilyGeneration: mlsMpmParticleUpload?.bufferFamilyGeneration,
    physicsTick: sphParticleUpload?.physicsTick,
    physicsSubstep: sphParticleUpload?.physicsSubstep,
    positionEpoch: sphParticleUpload?.positionEpoch,
    topologyEpoch: sphParticleUpload?.topologyEpoch,
    chartEpoch: sphParticleUpload?.chartEpoch,
    levelEpoch: sphParticleUpload?.levelEpoch,
    supportEpoch: sphParticleUpload?.supportEpoch,
    stateStrideBytes: sphParticleUpload?.stateStrideBytes,
    thermoStrideBytes: sphParticleUpload?.thermoStrideBytes,
    identityStrideBytes: sphParticleUpload?.identityStrideBytes,
    mechanicsStrideBytes: mlsMpmParticleUpload?.mechanicsStrideBytes,
    stateBufferByteLength: sphParticleUpload?.stateBufferByteLength,
    thermoBufferByteLength: sphParticleUpload?.thermoBufferByteLength,
    identityBufferByteLength: sphParticleUpload?.identityBufferByteLength,
    mechanicsBufferByteLength: mlsMpmParticleUpload?.mechanicsBufferByteLength,
    stateBufferSize: Number(sphParticleUpload?.stateBuffer?.size ?? 0),
    thermoBufferSize: Number(sphParticleUpload?.thermoBuffer?.size ?? 0),
    identityBufferSize: Number(sphParticleUpload?.identityBuffer?.size ?? 0),
    mechanicsBufferSize: Number(mlsMpmParticleUpload?.mechanicsBuffer?.size ?? 0)
  });
}

function particleUploadsMatchSnapshot(sph, mls, snapshot, device = null) {
  return Boolean(
    sph?.status === snapshot.sphStatus
    && sph?.schema === snapshot.sphSchema
    && mls?.status === snapshot.mlsStatus
    && mls?.schema === snapshot.mlsSchema
    && sph?.particleCount === snapshot.particleCount
    && mls?.particleCount === snapshot.mlsParticleCount
    && sph?.stateBuffer === snapshot.stateBuffer
    && sph?.thermoBuffer === snapshot.thermoBuffer
    && sph?.identityBuffer === snapshot.identityBuffer
    && mls?.mechanicsBuffer === snapshot.mechanicsBuffer
    && sph?.storageGeneration === snapshot.storageGeneration
    && mls?.storageGeneration === snapshot.mlsStorageGeneration
    && sph?.bufferFamilyGeneration === snapshot.bufferFamilyGeneration
    && mls?.bufferFamilyGeneration === snapshot.mlsBufferFamilyGeneration
    && sph?.physicsTick === snapshot.physicsTick
    && sph?.physicsSubstep === snapshot.physicsSubstep
    && sph?.positionEpoch === snapshot.positionEpoch
    && sph?.topologyEpoch === snapshot.topologyEpoch
    && sph?.chartEpoch === snapshot.chartEpoch
    && sph?.levelEpoch === snapshot.levelEpoch
    && sph?.supportEpoch === snapshot.supportEpoch
    && sph?.stateStrideBytes === snapshot.stateStrideBytes
    && sph?.thermoStrideBytes === snapshot.thermoStrideBytes
    && sph?.identityStrideBytes === snapshot.identityStrideBytes
    && mls?.mechanicsStrideBytes === snapshot.mechanicsStrideBytes
    && sph?.stateBufferByteLength === snapshot.stateBufferByteLength
    && sph?.thermoBufferByteLength === snapshot.thermoBufferByteLength
    && sph?.identityBufferByteLength === snapshot.identityBufferByteLength
    && mls?.mechanicsBufferByteLength === snapshot.mechanicsBufferByteLength
    && sph?.stateBuffer?.destroyed !== true
    && sph?.thermoBuffer?.destroyed !== true
    && mls?.mechanicsBuffer?.destroyed !== true
    && (sph?.identityBuffer == null || sph.identityBuffer.destroyed !== true)
    && Number(sph?.stateBuffer?.size ?? 0) === snapshot.stateBufferSize
    && Number(sph?.thermoBuffer?.size ?? 0) === snapshot.thermoBufferSize
    && Number(sph?.identityBuffer?.size ?? 0) === snapshot.identityBufferSize
    && Number(mls?.mechanicsBuffer?.size ?? 0) === snapshot.mechanicsBufferSize
    && (device == null || (
      webGpuBufferMatchesDevice(snapshot.stateBuffer, device)
      && webGpuBufferMatchesDevice(snapshot.thermoBuffer, device)
      && webGpuBufferMatchesDevice(snapshot.mechanicsBuffer, device)
      && (snapshot.identityBuffer == null
        || webGpuBufferMatchesDevice(snapshot.identityBuffer, device))
    ))
  );
}

function continuationMatchesOrigin(device, continuation, origin) {
  return Boolean(
    origin
    && origin.deviceId === webGpuDeviceId(device)
    && continuation === origin.continuation
    && continuation.schema
      === ULG_SCHROEDER_CANONICAL_PARTICLE_CONTINUATION_SCHEMA
    && continuation.status === origin.status
    && continuation.macroAuthority === origin.macroAuthority
    && continuation.sphParticleUpload === origin.sphParticleUpload
    && continuation.mlsMpmParticleUpload === origin.mlsMpmParticleUpload
    && continuation.stateBuffer === origin.snapshot.stateBuffer
    && continuation.thermoBuffer === origin.snapshot.thermoBuffer
    && continuation.identityBuffer === origin.snapshot.identityBuffer
    && continuation.mechanicsBuffer === origin.snapshot.mechanicsBuffer
    && continuation.ordinal === origin.ordinal
    && continuation.priorContinuation === origin.priorContinuation
    && continuation.sourceTransaction === origin.sourceTransaction
    && particleUploadsMatchSnapshot(
      origin.sphParticleUpload,
      origin.mlsMpmParticleUpload,
      origin.snapshot,
      device
    )
    && validateSchroederTwoLevelMacroAuthority(device, origin.macroAuthority)
  );
}

function continuationOriginFor(device, continuation) {
  const origin = particleContinuationOrigins.get(continuation);
  return continuationMatchesOrigin(device, continuation, origin) ? origin : null;
}

export function createSchroederCanonicalParticleContinuation({
  device,
  macroAuthority,
  sphParticleUpload,
  mlsMpmParticleUpload,
  ordinal = 0,
  priorContinuation = null,
  sourceTransaction = null,
  g2pReconstruction = null
} = {}) {
  const macroOrigin = macroOriginFor(device, macroAuthority);
  if (!macroOrigin) {
    throw new TypeError('canonical particle continuation requires the exact macro authority');
  }
  const resolvedOrdinal = exactU32(ordinal, 'ordinal');
  if (
    resolvedOrdinal > macroAuthority.fineSubstepCount
    || resolvedOrdinal !== macroOrigin.nextContinuationOrdinal
    || macroOrigin.continuationByOrdinal.has(resolvedOrdinal)
  ) {
    throw new TypeError(
      'canonical particle continuation ordinal is replayed or out of order'
    );
  }
  const initial = resolvedOrdinal === 0;
  const priorOrigin = initial
    ? null
    : continuationOriginFor(device, priorContinuation);
  const transactionOrigin = initial
    ? null
    : transactionOriginFor(device, sourceTransaction);
  const stateBuffer = sphParticleUpload?.stateBuffer ?? null;
  const thermoBuffer = sphParticleUpload?.thermoBuffer ?? null;
  const identityBuffer = sphParticleUpload?.identityBuffer ?? null;
  const mechanicsBuffer = mlsMpmParticleUpload?.mechanicsBuffer ?? null;
  const exactInitialFamily = initial
    && sphParticleUpload === macroAuthority.sourceSphParticleUpload
    && mlsMpmParticleUpload === macroAuthority.sourceMlsMpmParticleUpload;
  const exactChainedFamily = !initial
    && priorOrigin
    && priorOrigin.macroAuthority === macroAuthority
    && priorOrigin.ordinal + 1 === resolvedOrdinal
    && transactionOrigin?.macroAuthority === macroAuthority
    && transactionOrigin?.particleContinuation === priorContinuation
    && transactionOrigin?.substepOrdinal === priorOrigin.ordinal
    && transactionOrigin?.stageIndex === FINE_STAGE_ORDER.length
    && transactionOrigin?.status === 'g2p-submitted-unverified'
    && transactionOrigin?.artifacts?.g2p === g2pReconstruction
    && stateBuffer === g2pReconstruction?.stateBuffer
    && mechanicsBuffer === g2pReconstruction?.mechanicsBuffer
    && thermoBuffer === priorOrigin.snapshot.thermoBuffer
    && identityBuffer === priorOrigin.snapshot.identityBuffer;
  if (
    sphParticleUpload?.status !== 'webgpu-uploaded'
    || mlsMpmParticleUpload?.status !== 'webgpu-uploaded'
    || !stateBuffer
    || !thermoBuffer
    || !mechanicsBuffer
    || !(exactInitialFamily || exactChainedFamily)
  ) {
    throw new TypeError(
      'canonical particle continuation requires the exact initial family or exact prior G2P outputs'
    );
  }
  const status = initial
    ? 'canonical-particle-continuation-authoritative-root'
    : 'canonical-particle-continuation-submitted-unverified';
  const continuation = Object.freeze({
    schema: ULG_SCHROEDER_CANONICAL_PARTICLE_CONTINUATION_SCHEMA,
    status,
    deviceId: webGpuDeviceId(device),
    macroAuthority,
    ordinal: resolvedOrdinal,
    sphParticleUpload,
    mlsMpmParticleUpload,
    stateBuffer,
    thermoBuffer,
    identityBuffer,
    mechanicsBuffer,
    priorContinuation,
    sourceTransaction
  });
  const origin = {
    deviceId: continuation.deviceId,
    continuation,
    status,
    macroAuthority,
    ordinal: resolvedOrdinal,
    sphParticleUpload,
    mlsMpmParticleUpload,
    snapshot: particleUploadSnapshot(sphParticleUpload, mlsMpmParticleUpload),
    priorContinuation,
    sourceTransaction,
    consumedByTransaction: null,
    outputRetirement: {
      required: !initial,
      stateRetired: initial,
      mechanicsRetired: initial,
      promise: null,
      failureReason: null
    }
  };
  if (!initial && !claimLocallySubmittedMlsMpmFusedG2pOutputForContinuation(
    device,
    g2pReconstruction,
    {
      transaction: sourceTransaction,
      macroAuthority,
      microepochAuthority: transactionOrigin.microepochAuthority,
      particleContinuation: priorContinuation,
      fieldExecution: transactionOrigin.fieldView,
      priorArtifact: transactionOrigin.artifacts['fine-correction'],
      proposalMode: 'proposal-deferred-to-post-mechanics',
      nextOrdinal: resolvedOrdinal,
      nextSphParticleUpload: sphParticleUpload,
      nextMlsMpmParticleUpload: mlsMpmParticleUpload
    }
  )) {
    throw new TypeError(
      'canonical particle continuation could not claim the exact live G2P output family'
    );
  }
  particleContinuationOrigins.set(continuation, origin);
  macroOrigin.continuationByOrdinal.set(resolvedOrdinal, continuation);
  macroOrigin.nextContinuationOrdinal += 1;
  return continuation;
}

export function validateSchroederCanonicalParticleContinuation(
  device,
  continuation,
  {
    macroAuthority = null,
    ordinal = null,
    sphParticleUpload = null,
    mlsMpmParticleUpload = null,
    stateBuffer = null,
    thermoBuffer = null,
    identityBuffer = null,
    mechanicsBuffer = null
  } = {}
) {
  const origin = continuationOriginFor(device, continuation);
  if (origin) {
    return (macroAuthority == null || macroAuthority === origin.macroAuthority)
      && (ordinal == null || Number(ordinal) === origin.ordinal)
      && (sphParticleUpload == null
        || sphParticleUpload === origin.sphParticleUpload)
      && (mlsMpmParticleUpload == null
        || mlsMpmParticleUpload === origin.mlsMpmParticleUpload)
      && (stateBuffer == null || stateBuffer === origin.snapshot.stateBuffer)
      && (thermoBuffer == null || thermoBuffer === origin.snapshot.thermoBuffer)
      && (identityBuffer == null
        || identityBuffer === origin.snapshot.identityBuffer)
      && (mechanicsBuffer == null
        || mechanicsBuffer === origin.snapshot.mechanicsBuffer);
  }
  return false;
}

function retireContinuationOutputAfterFence(origin, after) {
  const retirement = origin?.outputRetirement;
  if (!retirement?.required) return Promise.resolve(true);
  if (retirement.stateRetired && retirement.mechanicsRetired) {
    return Promise.resolve(true);
  }
  if (retirement.promise) return retirement.promise;
  if (!after || typeof after.then !== 'function') {
    return Promise.reject(new TypeError(
      'canonical continuation output retirement requires an owner fence'
    ));
  }
  retirement.failureReason = null;
  retirement.promise = Promise.resolve(after).then((confirmed) => {
    if (confirmed !== true) {
      throw new Error(
        'canonical continuation output owner fence was not confirmed'
      );
    }
    if (!retirement.stateRetired) {
      origin.snapshot.stateBuffer?.destroy?.();
      retirement.stateRetired = true;
    }
    if (!retirement.mechanicsRetired) {
      origin.snapshot.mechanicsBuffer?.destroy?.();
      retirement.mechanicsRetired = true;
    }
    return true;
  }).then(
    (retired) => {
      retirement.promise = null;
      return retired;
    },
    (error) => {
      retirement.failureReason = error instanceof Error
        ? error.message
        : String(error);
      retirement.promise = null;
      throw error;
    }
  );
  return retirement.promise;
}

export function retireSchroederCanonicalParticleContinuationOutputAfter(
  device,
  continuation,
  {
    successorContinuation = null,
    after = null
  } = {}
) {
  const origin = continuationOriginFor(device, continuation);
  const successorOrigin = continuationOriginFor(device, successorContinuation);
  if (
    !origin
    || origin.ordinal === 0
    || !origin.outputRetirement.required
    || !successorOrigin
    || successorOrigin.macroAuthority !== origin.macroAuthority
    || successorOrigin.ordinal !== origin.ordinal + 1
    || successorOrigin.priorContinuation !== continuation
  ) {
    throw new Error(
      'canonical continuation output retirement requires its exact successor'
    );
  }
  return retireContinuationOutputAfterFence(origin, after);
}

function microepochMatchesOrigin(
  device,
  microepochAuthority,
  origin,
  { requireLive = true } = {}
) {
  const generation = origin?.generation;
  const execution = origin?.execution;
  const source = origin?.source;
  const parent = origin?.parentFieldView;
  const fineField = origin?.fineFieldView;
  const coarseField = origin?.coarseFieldView;
  let live = true;
  if (requireLive) {
    if (!LIVE_MICROEPOCH_STATUSES.has(origin?.status)) {
      live = false;
    } else {
      try {
        live = execution?.submitPerformed === true
          && execution?.released !== true
          && origin.fineFieldRuntime?.ownsExecution?.(fineField) === true
          && origin.fineFieldRuntime?.isExecutionSubmitted?.(fineField) === true
          && origin.fineFieldRuntime?.isStatePublicationLockActive?.(
            fineField,
            origin.publicationLock
          ) === true;
      } catch {
        live = false;
      }
    }
  }
  return Boolean(
    origin
    && origin.deviceId === webGpuDeviceId(device)
    && microepochAuthority === origin.microepochAuthority
    && microepochAuthority.schema
      === ULG_SCHROEDER_FINE_MICROEPOCH_AUTHORITY_SCHEMA
    && microepochAuthority.status === 'fine-microepoch-private-authority'
    && microepochAuthority.macroAuthority === origin.macroAuthority
    && microepochAuthority.canonicalEpoch === origin.canonicalEpoch
    && microepochAuthority.generation === generation
    && microepochAuthority.parentFieldView === parent
    && microepochAuthority.particleContinuation === origin.particleContinuation
    && microepochAuthority.substepOrdinal === origin.substepOrdinal
    && microepochAuthority.rootGenerationId === origin.rootGenerationId
    && microepochAuthority.currentGenerationId === origin.currentGenerationId
    && microepochAuthority.publicationLock === origin.publicationLock
    && microepochAuthority.fineFieldView === fineField
    && (!requireLive || (
      validateSchroederTwoLevelMacroAuthority(device, origin.macroAuthority)
      && validateSchroederCanonicalParticleContinuation(
        device,
        origin.particleContinuation,
        {
          macroAuthority: origin.macroAuthority,
          ordinal: origin.substepOrdinal,
          sphParticleUpload: origin.sphParticleUpload,
          mlsMpmParticleUpload: origin.mlsMpmParticleUpload,
          stateBuffer: origin.sourceStateBuffer,
          thermoBuffer: origin.thermoBuffer,
          identityBuffer: origin.identityBuffer,
          mechanicsBuffer: origin.mechanicsBuffer
        }
      )
    ))
    && origin.canonicalEpoch?.generation === generation
    && origin.canonicalEpoch?.sphParticleUpload === origin.sphParticleUpload
    && origin.canonicalEpoch?.mlsMpmParticleUpload === origin.mlsMpmParticleUpload
    && generation?.selected === true
    && generation?.ready === true
    && generation?.execution === execution
    && generation?.source === source
    && generation?.parentFieldView === parent
    && execution?.generationId === origin.currentGenerationId
    && source?.sourceStateBuffer === origin.sourceStateBuffer
    && source?.sourceStateBuffer === origin.sphParticleUpload?.stateBuffer
    && source?.topologyEpoch === origin.rootTopologyEpoch
    && source?.chartEpoch === origin.rootChartEpoch
    && source?.levelEpoch === origin.rootLevelEpoch
    && source?.supportEpoch === origin.rootSupportEpoch
    && source?.minLevel === origin.rootMinLevel
    && source?.maxLevel === origin.rootMaxLevel
    && source?.chartId === origin.rootChartId
    && Object.is(source?.baseGridSpacingM, origin.rootBaseGridSpacingM)
    && (origin.substepOrdinal === 0 || (
      source?.levelClassificationMode
        === 'frozen-macro-step-no-reclassification'
      && source?.levelReclassificationPerformed === false
    ))
    && parent?.fineLevel === origin.macroAuthority.fineLevel
    && parent?.coarseLevel === origin.macroAuthority.coarseLevel
    && parent?.exactLevelCount === 2
    && parent?.parentFieldCapacity === origin.parentFieldCapacity
    && parent?.fineFieldCapacity === origin.fineFieldCapacity
    && parent?.coarseFieldCapacity === origin.coarseFieldCapacity
    && parent?.fineFieldView === fineField
    && parent?.coarseFieldView === coarseField
    && fineField?.identityBuffer === origin.identityBuffer
    && coarseField?.identityBuffer === origin.identityBuffer
    && fineField?.fieldViewBuffer === origin.fineFieldBuffer
    && coarseField?.fieldViewBuffer === origin.coarseFieldBuffer
    && fineField?.ownerRuntime === origin.fineFieldRuntime
    && coarseField?.ownerRuntime === origin.coarseFieldRuntime
    && fineField?.selectedLevel === origin.macroAuthority.fineLevel
    && coarseField?.selectedLevel === origin.macroAuthority.coarseLevel
    && Object.is(fineField?.gridSpacingM, origin.fineGridSpacingM)
    && Object.is(coarseField?.gridSpacingM, origin.coarseGridSpacingM)
    && exactArrayMatches(fineField?.gridDims, origin.fineGridDims)
    && exactArrayMatches(coarseField?.gridDims, origin.coarseGridDims)
    && (!requireLive || live)
  );
}

function microepochOriginFor(
  device,
  microepochAuthority,
  options = {}
) {
  const origin = fineMicroepochOrigins.get(microepochAuthority);
  return microepochMatchesOrigin(device, microepochAuthority, origin, options)
    ? origin
    : null;
}

export function createSchroederFineMicroepochAuthority({
  device,
  macroAuthority,
  canonicalEpoch,
  particleContinuation,
  substepOrdinal,
  priorMicroepochAuthority = null
} = {}) {
  const macroOrigin = macroOriginFor(device, macroAuthority);
  const ordinal = exactU32(substepOrdinal, 'substepOrdinal');
  const priorOrigin = ordinal === 0
    ? null
    : microepochOriginFor(device, priorMicroepochAuthority);
  const continuationOrigin = continuationOriginFor(device, particleContinuation);
  if (
    !macroOrigin
    || ordinal > macroAuthority.fineSubstepCount
    || ordinal !== macroOrigin.nextMicroepochOrdinal
    || macroOrigin.microepochByOrdinal.has(ordinal)
    || !continuationOrigin
    || continuationOrigin.macroAuthority !== macroAuthority
    || continuationOrigin.ordinal !== ordinal
    || (ordinal === 0 && (
      canonicalEpoch !== macroAuthority.canonicalEpoch
      || priorMicroepochAuthority !== null
    ))
    || (ordinal > 0 && (
      priorOrigin?.macroAuthority !== macroAuthority
      || priorOrigin?.substepOrdinal + 1 !== ordinal
      || priorOrigin?.status !== 'g2p-submitted-unverified'
      || continuationOrigin.priorContinuation
        !== priorOrigin.particleContinuation
      || continuationOrigin.sourceTransaction !== priorOrigin.transaction
    ))
  ) {
    throw new TypeError(
      'fine microepoch authority requires the exact next private epoch and continuation'
    );
  }
  const generation = canonicalEpoch?.generation ?? null;
  const execution = generation?.execution ?? null;
  const source = generation?.source ?? null;
  const parentFieldView = generation?.parentFieldView ?? null;
  const fineFieldView = parentFieldView?.fineFieldView ?? null;
  const coarseFieldView = parentFieldView?.coarseFieldView ?? null;
  const sphParticleUpload = canonicalEpoch?.sphParticleUpload ?? null;
  const mlsMpmParticleUpload = canonicalEpoch?.mlsMpmParticleUpload ?? null;
  const fineFieldRuntime = fineFieldView?.ownerRuntime ?? null;
  if (
    sphParticleUpload !== particleContinuation.sphParticleUpload
    || mlsMpmParticleUpload !== particleContinuation.mlsMpmParticleUpload
    || generation?.selected !== true
    || generation?.ready !== true
    || execution?.submitPerformed !== true
    || execution?.released === true
    || source?.sourceStateBuffer !== particleContinuation.stateBuffer
    || source?.topologyEpoch !== macroOrigin.rootTopologyEpoch
    || source?.chartEpoch !== macroOrigin.rootChartEpoch
    || source?.levelEpoch !== macroOrigin.rootLevelEpoch
    || source?.supportEpoch !== macroOrigin.rootSupportEpoch
    || source?.minLevel !== macroOrigin.rootMinLevel
    || source?.maxLevel !== macroOrigin.rootMaxLevel
    || source?.chartId !== macroOrigin.rootChartId
    || !Object.is(source?.baseGridSpacingM, macroOrigin.rootBaseGridSpacingM)
    || (ordinal > 0 && (
      source?.levelClassificationMode
        !== 'frozen-macro-step-no-reclassification'
      || source?.levelReclassificationPerformed !== false
      || source?.sourceAssignmentBuffer
        !== priorOrigin?.source?.assignmentBuffer
    ))
    || parentFieldView?.fineLevel !== macroAuthority.fineLevel
    || parentFieldView?.coarseLevel !== macroAuthority.coarseLevel
    || parentFieldView?.exactLevelCount !== 2
    || fineFieldView?.identityBuffer !== particleContinuation.identityBuffer
    || coarseFieldView?.identityBuffer !== particleContinuation.identityBuffer
    || fineFieldView?.selectedLevel !== macroAuthority.fineLevel
    || coarseFieldView?.selectedLevel !== macroAuthority.coarseLevel
    || !Object.is(fineFieldView?.gridSpacingM, macroOrigin.fineGridSpacingM)
    || !Object.is(coarseFieldView?.gridSpacingM, macroOrigin.coarseGridSpacingM)
    || !exactArrayMatches(fineFieldView?.gridDims, macroOrigin.fineGridDims)
    || !exactArrayMatches(coarseFieldView?.gridDims, macroOrigin.coarseGridDims)
    || typeof fineFieldRuntime?.isStatePublicationLockActive !== 'function'
  ) {
    throw new TypeError(
      'fine microepoch authority requires an exact refreshed frozen-assignment generation'
    );
  }
  let publicationLock;
  if (ordinal === 0) {
    publicationLock = macroOrigin.rootPublicationLock;
    if (!fineFieldRuntime.isStatePublicationLockActive(
      fineFieldView,
      publicationLock
    )) {
      throw new TypeError('root microepoch publication lock is stale');
    }
  } else {
    if (
      fineFieldView === priorOrigin.fineFieldView
      || typeof fineFieldRuntime.acquireStatePublicationLock !== 'function'
    ) {
      throw new TypeError('successor microepoch must own a fresh fine field');
    }
    publicationLock = fineFieldRuntime.acquireStatePublicationLock(
      fineFieldView,
      {
        owner: macroAuthority,
        publicationReceiptValidator:
          validateMechanicsFieldPublicationReceipt
      }
    );
  }
  const microepochAuthority = {
    schema: ULG_SCHROEDER_FINE_MICROEPOCH_AUTHORITY_SCHEMA,
    status: 'fine-microepoch-private-authority',
    deviceId: webGpuDeviceId(device),
    macroAuthority,
    canonicalEpoch,
    generation,
    parentFieldView,
    particleContinuation,
    priorMicroepochAuthority,
    substepOrdinal: ordinal,
    rootGenerationId: macroAuthority.rootGenerationId,
    currentGenerationId: execution.generationId,
    fineFieldView,
    publicationLock,
    proposalMode: 'proposal-deferred-to-post-mechanics'
  };
  const origin = {
    deviceId: microepochAuthority.deviceId,
    microepochAuthority,
    macroAuthority,
    canonicalEpoch,
    generation,
    execution,
    source,
    parentFieldView,
    fineFieldView,
    coarseFieldView,
    fineFieldRuntime,
    coarseFieldRuntime: coarseFieldView.ownerRuntime,
    particleContinuation,
    priorMicroepochAuthority,
    substepOrdinal: ordinal,
    rootGenerationId: macroAuthority.rootGenerationId,
    currentGenerationId: execution.generationId,
    sphParticleUpload,
    mlsMpmParticleUpload,
    sourceStateBuffer: particleContinuation.stateBuffer,
    thermoBuffer: particleContinuation.thermoBuffer,
    identityBuffer: particleContinuation.identityBuffer,
    mechanicsBuffer: particleContinuation.mechanicsBuffer,
    publicationLock,
    parentFieldCapacity: parentFieldView.parentFieldCapacity,
    fineFieldCapacity: parentFieldView.fineFieldCapacity,
    coarseFieldCapacity: parentFieldView.coarseFieldCapacity,
    fineFieldBuffer: fineFieldView.fieldViewBuffer,
    coarseFieldBuffer: coarseFieldView.fieldViewBuffer,
    fineGridSpacingM: fineFieldView.gridSpacingM,
    coarseGridSpacingM: coarseFieldView.gridSpacingM,
    fineGridDims: exactArraySnapshot(fineFieldView.gridDims),
    coarseGridDims: exactArraySnapshot(coarseFieldView.gridDims),
    rootTopologyEpoch: macroOrigin.rootTopologyEpoch,
    rootChartEpoch: macroOrigin.rootChartEpoch,
    rootLevelEpoch: macroOrigin.rootLevelEpoch,
    rootSupportEpoch: macroOrigin.rootSupportEpoch,
    rootMinLevel: macroOrigin.rootMinLevel,
    rootMaxLevel: macroOrigin.rootMaxLevel,
    rootChartId: macroOrigin.rootChartId,
    rootBaseGridSpacingM: macroOrigin.rootBaseGridSpacingM,
    status: 'private-ready',
    transaction: null,
    successor: null,
    retirementPromise: null,
    abortPromise: null,
    abortAttempt: null,
    abortRetirement: createAbortRetirementLedger(),
    quarantineReason: null
  };
  Object.freeze(microepochAuthority);
  fineMicroepochOrigins.set(microepochAuthority, origin);
  macroOrigin.microepochByOrdinal.set(ordinal, microepochAuthority);
  macroOrigin.nextMicroepochOrdinal += 1;
  if (priorOrigin) priorOrigin.successor = microepochAuthority;
  return microepochAuthority;
}

export function validateSchroederFineMicroepochAuthority(
  device,
  microepochAuthority,
  {
    macroAuthority = null,
    canonicalEpoch = null,
    particleContinuation = null,
    substepOrdinal = null,
    requireLive = true
  } = {}
) {
  const origin = microepochOriginFor(device, microepochAuthority, { requireLive });
  if (origin) {
    return (macroAuthority == null || macroAuthority === origin.macroAuthority)
      && (canonicalEpoch == null || canonicalEpoch === origin.canonicalEpoch)
      && (particleContinuation == null
        || particleContinuation === origin.particleContinuation)
      && (substepOrdinal == null
        || Number(substepOrdinal) === origin.substepOrdinal);
  }
  return false;
}

export async function retireSchroederFineMicroepochAfter(
  device,
  microepochAuthority,
  { successorMicroepochAuthority = null } = {}
) {
  const origin = microepochOriginFor(device, microepochAuthority);
  const successorOrigin = microepochOriginFor(device, successorMicroepochAuthority);
  if (
    !origin
    || origin.status !== 'g2p-submitted-unverified'
    || origin.successor !== successorMicroepochAuthority
    || successorOrigin?.substepOrdinal !== origin.substepOrdinal + 1
    || successorOrigin?.priorMicroepochAuthority !== microepochAuthority
  ) {
    throw new Error('fine microepoch retirement requires its exact live successor');
  }
  origin.status = 'retiring';
  const macroOrigin = macroAuthorityOrigins.get(origin.macroAuthority);
  const retirePublicationLock =
    origin.fineFieldRuntime.retireStatePublicationLockQueueOrdered
    ?? origin.fineFieldRuntime.retireStatePublicationLockAfter;
  const retirementPromise = retirePublicationLock.call(
    origin.fineFieldRuntime,
    origin.fineFieldView,
    origin.publicationLock
  );
  origin.retirementPromise = retirementPromise;
  if (origin.substepOrdinal === 0 && macroOrigin) {
    // The exact queue-fenced retirement of E0's publication lock is a valid
    // in-flight macro-lineage state.  Treating the synchronous lock transition
    // as stale until its fence settled made a terminal producer spuriously
    // fail whenever diagnostic retirement was genuinely asynchronous.
    macroOrigin.rootRetirementStatus = 'retiring';
    macroOrigin.rootRetirementPromise = retirementPromise;
  }
  try {
    const retired = await retirementPromise;
    origin.status = 'retired';
    if (origin.substepOrdinal === 0 && macroOrigin) {
      macroOrigin.rootRetired = true;
      macroOrigin.rootRetirementStatus = 'retired';
    }
    return retired;
  } catch (error) {
    origin.status = 'quarantined';
    origin.quarantineReason = error;
    origin.retirementPromise = null;
    if (origin.substepOrdinal === 0 && macroOrigin) {
      macroOrigin.rootRetirementStatus = 'quarantined';
      macroOrigin.rootRetirementPromise = null;
    }
    throw error;
  }
}

function aggregateAbortErrors(errors, message) {
  if (errors.length === 1) return errors[0];
  return new AggregateError(errors, message);
}

function ensureAbortFieldQuarantined({
  side,
  runtime,
  field,
  reason
}) {
  if (!side?.required || side.retired || side.quarantined) return true;
  if (runtime?.isStateArtifactQuarantined?.(field) === true) {
    side.quarantined = true;
    return true;
  }
  const state = runtime?.stateMutationState?.(field);
  if (
    state?.pending === true
    || !Number.isSafeInteger(state?.ordinal)
    || !Number.isSafeInteger(state?.encoding)
    || typeof runtime?.quarantineCurrentStateArtifact !== 'function'
  ) {
    throw new Error(
      'abort quarantine requires one exact non-pending mechanics field state'
    );
  }
  runtime.quarantineCurrentStateArtifact(field, {
    mutationOrdinal: state.ordinal,
    stateEncoding: state.encoding,
    reason
  });
  if (runtime.isStateArtifactQuarantined?.(field) !== true) {
    throw new Error('mechanics field abort quarantine was not confirmed');
  }
  side.quarantined = true;
  return true;
}

function beginAbortFieldRetirement({
  side,
  runtime,
  field,
  publicationLock,
  deviceLost,
  reason = null
}) {
  if (!side?.required || side.retired) return Promise.resolve(true);
  if (side.promise !== null) {
    if (deviceLost !== true || side.attempt?.mode === 'device-loss') {
      return side.promise;
    }
    side.promise.catch(() => {});
  }
  const runtimeQuarantined = runtime?.isStateArtifactQuarantined?.(field) === true;
  if (runtimeQuarantined) side.quarantined = true;
  let retirement;
  try {
    if (deviceLost === true) {
      if (typeof runtime?.quarantineExecutionAfterDeviceLoss !== 'function') {
        throw new Error(
          'device-loss retirement requires exact mechanics field loss quarantine'
        );
      }
      retirement = runtime.quarantineExecutionAfterDeviceLoss(field, { reason });
      side.quarantined = true;
    } else {
      retirement = side.quarantined
        ? runtime.retireQuarantinedExecutionAfter(field)
        : runtime.retireStatePublicationLockAfter(field, publicationLock);
    }
  } catch (error) {
    if (runtime?.isStateArtifactQuarantined?.(field) === true) {
      side.quarantined = true;
    }
    return Promise.reject(error);
  }
  const attempt = {
    mode: deviceLost === true ? 'device-loss' : 'queue-fence',
    promise: null
  };
  side.attempt = attempt;
  const retirementCompletion = Promise.resolve(retirement).then(
    (retired) => {
      if (retired !== true) {
        throw new Error('mechanics field abort retirement was not confirmed');
      }
      if (side.attempt === attempt) side.retired = true;
      return true;
    }
  );
  attempt.promise = retirementCompletion.then(
    (retired) => {
      if (side.attempt === attempt) {
        side.promise = null;
        side.attempt = null;
      }
      return retired;
    },
    (error) => {
      if (side.attempt === attempt) {
        if (runtime?.isStateArtifactQuarantined?.(field) === true) {
          side.quarantined = true;
        }
        side.promise = null;
        side.attempt = null;
      }
      throw error;
    }
  );
  side.promise = attempt.promise;
  return side.promise;
}

function abortFineMicroepochAfterDeviceLoss(origin, {
  reason = null,
  transactionOrigin = null,
  terminalOrigin = null
} = {}) {
  if (origin.abortAttempt?.mode === 'device-loss') {
    return origin.abortAttempt.promise;
  }
  origin.abortPromise?.catch(() => {});
  origin.retirementPromise?.catch(() => {});
  const ledger = origin.abortRetirement;
  const fields = [{
    side: ledger.fine,
    runtime: origin.fineFieldRuntime,
    field: origin.fineFieldView,
    publicationLock: origin.publicationLock,
    deviceLost: true,
    reason
  }];
  if (ledger.coarse.required) {
    if (!terminalOrigin) {
      return Promise.reject(new Error(
        'terminal device-loss abort lost its exact coarse retirement origin'
      ));
    }
    fields.push({
      side: ledger.coarse,
      runtime: terminalOrigin.fieldRuntime,
      field: terminalOrigin.fieldView,
      publicationLock: terminalOrigin.publicationLock,
      deviceLost: true,
      reason
    });
  }
  const attempt = {
    mode: 'device-loss',
    promise: null
  };
  origin.abortAttempt = attempt;
  origin.status = 'quarantined';
  origin.quarantineReason ??= reason;
  const retirementAttempts = fields.map((field) => (
    beginAbortFieldRetirement(field)
  ));
  const lossCompletion = Promise.allSettled(retirementAttempts).then(
    (results) => {
      const rejected = results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason);
      if (rejected.length > 0 || fields.some(({ side }) => !side.retired)) {
        if (rejected.length === 0) {
          rejected.push(new Error(
            'device-loss abort did not retire every required mechanics field'
          ));
        }
        throw aggregateAbortErrors(
          rejected,
          'device-loss mechanics field retirement was incomplete'
        );
      }
      if (origin.abortAttempt === attempt) {
        origin.status = 'retired';
        if (transactionOrigin) transactionOrigin.status = 'retired';
        if (terminalOrigin) terminalOrigin.status = 'retired';
        const macroOrigin = macroAuthorityOrigins.get(origin.macroAuthority);
        if (origin.substepOrdinal === 0 && macroOrigin) {
          macroOrigin.rootRetired = true;
          macroOrigin.rootRetirementStatus = 'retired';
        }
      }
      return true;
    }
  ).catch((error) => {
    if (origin.abortAttempt !== attempt) {
      return origin.abortPromise ?? false;
    }
    origin.status = 'quarantined';
    origin.quarantineReason ??= reason ?? error;
    origin.abortPromise = null;
    origin.abortAttempt = null;
    throw error;
  });
  attempt.promise = lossCompletion;
  origin.abortPromise = lossCompletion;
  lossCompletion.catch(() => {});
  return lossCompletion;
}

export function abortSchroederFineMicroepochAfter(
  device,
  microepochAuthority,
  {
    reason = null,
    deviceLost = false
  } = {}
) {
  const origin = microepochOriginFor(
    device,
    microepochAuthority,
    { requireLive: false }
  );
  if (
    !origin
    || origin.status === 'retired'
  ) {
    throw new Error('fine microepoch abort is stale or replayed');
  }
  const transactionOrigin = fineTransactionOrigins.get(origin.transaction);
  const terminalOrigin = coarseTerminalTransactionOrigins.get(origin.transaction);
  if (deviceLost === true) {
    return abortFineMicroepochAfterDeviceLoss(origin, {
      reason,
      transactionOrigin,
      terminalOrigin
    });
  }
  if (origin.abortPromise !== null) {
    throw new Error('fine microepoch abort is stale or replayed');
  }
  if (origin.retirementPromise !== null) return origin.retirementPromise;
  const ledger = origin.abortRetirement;
  const quarantineErrors = [];
  let requiresAllFieldQuarantine = deviceLost === true;
  if (!ledger.fine.retired
      && transactionOrigin?.stageIndex === 0
      && transactionOrigin.submissionObservedStage === null
      && transactionOrigin.status !== 'discarded') {
    try {
      transactionOrigin.fieldRuntime.discardStateMutationSequence(
        transactionOrigin.mutationSequence,
        { discardedEncoder: true }
      );
      transactionOrigin.status = 'discarded';
    } catch (error) {
      quarantineErrors.push(error);
    }
  } else if (
    !ledger.fine.retired
    && transactionOrigin
    && (
      transactionOrigin.stageIndex > 0
      || transactionOrigin.submissionObservedStage !== null
      || transactionOrigin.status === 'quarantined'
    )
  ) {
    requiresAllFieldQuarantine = true;
    if (transactionOrigin.fieldRuntime.isStateArtifactQuarantined?.(
      transactionOrigin.fieldView
    ) !== true) {
      try {
        if (transactionOrigin.stageIndex < FINE_STAGE_ORDER.length) {
          transactionOrigin.fieldRuntime.quarantineStateMutationSequence(
            transactionOrigin.mutationSequence,
            reason
          );
        } else {
          transactionOrigin.fieldRuntime.quarantineCurrentStateArtifact(
            transactionOrigin.fieldView,
            {
              mutationOrdinal: transactionOrigin.sequenceOutputOrdinal,
              stateEncoding: transactionOrigin.sequenceOutputEncoding,
              reason
            }
          );
        }
      } catch (error) {
        quarantineErrors.push(error);
      }
    }
    transactionOrigin.status = 'quarantined';
    transactionOrigin.quarantineReason = reason ?? quarantineErrors.at(-1) ?? null;
  }
  if (
    !ledger.coarse.retired
    && terminalOrigin?.stageIndex === 0
    && terminalOrigin.submissionObservedStage === null
    && terminalOrigin.status !== 'discarded'
  ) {
    try {
      terminalOrigin.stageProducerCapability = null;
      if (!terminalOrigin.discardCleanup.sequence) {
        const discarded = terminalOrigin.fieldRuntime.discardStateMutationSequence(
          terminalOrigin.mutationSequence,
          { discardedEncoder: true }
        );
        if (discarded !== true) {
          throw new Error(
            'terminal abort mutation-sequence discard was not confirmed'
          );
        }
        terminalOrigin.discardCleanup.sequence = true;
      }
      terminalOrigin.status = 'discarded';
    } catch (error) {
      try {
        if (terminalOrigin.fieldRuntime.stateMutationState(
          terminalOrigin.fieldView
        )?.pending === false) {
          terminalOrigin.discardCleanup.sequence = true;
          terminalOrigin.status = 'discarded';
        } else {
          quarantineErrors.push(error);
        }
      } catch {
        quarantineErrors.push(error);
      }
    }
  } else if (
    !ledger.coarse.retired
    && terminalOrigin
    && (
      terminalOrigin.status !== 'discarded'
      || terminalOrigin.fieldRuntime.isStateArtifactQuarantined?.(
        terminalOrigin.fieldView
      ) === true
    )
  ) {
    requiresAllFieldQuarantine = true;
    if (terminalOrigin.fieldRuntime.isStateArtifactQuarantined?.(
      terminalOrigin.fieldView
    ) !== true) {
      try {
        if (terminalOrigin.stageIndex < COARSE_TERMINAL_STAGE_ORDER.length) {
          terminalOrigin.fieldRuntime.quarantineStateMutationSequence(
            terminalOrigin.mutationSequence,
            reason
          );
        } else {
          terminalOrigin.fieldRuntime.quarantineCurrentStateArtifact(
            terminalOrigin.fieldView,
            {
              mutationOrdinal: terminalOrigin.sequenceOutputOrdinal,
              stateEncoding: terminalOrigin.sequenceOutputEncoding,
              reason
            }
          );
        }
      } catch (error) {
        quarantineErrors.push(error);
      }
    }
    terminalOrigin.status = 'quarantined';
    terminalOrigin.quarantineReason = reason ?? quarantineErrors.at(-1) ?? null;
  }
  if (requiresAllFieldQuarantine) {
    const fields = [{
      side: ledger.fine,
      runtime: origin.fineFieldRuntime,
      field: origin.fineFieldView,
      reason
    }];
    if (ledger.coarse.required) {
      if (!terminalOrigin) {
        quarantineErrors.push(new Error(
          'terminal abort lost its exact coarse transaction origin'
        ));
      } else {
        fields.push({
          side: ledger.coarse,
          runtime: terminalOrigin.fieldRuntime,
          field: terminalOrigin.fieldView,
          reason
        });
      }
    }
    for (const field of fields) {
      try {
        ensureAbortFieldQuarantined(field);
      } catch (error) {
        quarantineErrors.push(error);
      }
    }
  }
  if (quarantineErrors.length > 0) {
    const error = aggregateAbortErrors(
      quarantineErrors,
      'mechanics field abort quarantine was incomplete'
    );
    origin.status = 'quarantined';
    origin.quarantineReason = reason ?? error;
    throw error;
  }
  const fields = [{
    side: ledger.fine,
    runtime: origin.fineFieldRuntime,
    field: origin.fineFieldView,
    publicationLock: origin.publicationLock,
    deviceLost,
    reason
  }];
  if (ledger.coarse.required) {
    if (!terminalOrigin) {
      throw new Error('terminal abort lost its exact coarse retirement origin');
    }
    fields.push({
      side: ledger.coarse,
      runtime: terminalOrigin.fieldRuntime,
      field: terminalOrigin.fieldView,
      publicationLock: terminalOrigin.publicationLock,
      deviceLost,
      reason
    });
  }
  origin.status = fields.some(({ side, runtime, field }) => (
    side.quarantined || runtime.isStateArtifactQuarantined?.(field) === true
  )) ? 'quarantined' : 'retiring';
  const retirementAttempts = fields.map((field) => (
    beginAbortFieldRetirement(field)
  ));
  const abortAttempt = {
    mode: 'queue-fence',
    promise: null
  };
  origin.abortAttempt = abortAttempt;
  const abortCompletion = Promise.allSettled(retirementAttempts).then(
    (results) => {
      const rejected = results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason);
      if (rejected.length > 0 || fields.some(({ side }) => !side.retired)) {
        if (rejected.length === 0) {
          rejected.push(new Error(
            'mechanics field abort did not retire every required field'
          ));
        }
        throw aggregateAbortErrors(
          rejected,
          'mechanics field abort retirement was incomplete'
        );
      }
      if (origin.abortAttempt === abortAttempt) {
        origin.status = 'retired';
        if (terminalOrigin) terminalOrigin.status = 'retired';
        const macroOrigin = macroAuthorityOrigins.get(origin.macroAuthority);
        if (origin.substepOrdinal === 0 && macroOrigin) macroOrigin.rootRetired = true;
      }
      return true;
    }
  );
  abortAttempt.promise = abortCompletion.catch(
    (error) => {
      if (origin.abortAttempt !== abortAttempt) {
        return origin.abortPromise ?? false;
      }
      origin.status = 'quarantined';
      origin.quarantineReason = reason ?? error;
      origin.abortPromise = null;
      origin.abortAttempt = null;
      throw error;
    }
  );
  origin.abortPromise = abortAttempt.promise;
  return origin.abortPromise;
}

function retireTerminalParticleOutputAfterFence(device, origin, after) {
  const output = origin?.artifacts?.g2p ?? null;
  if (!output) return Promise.resolve(true);
  const retirement = origin.outputRetirement;
  if (retirement.stateRetired && retirement.mechanicsRetired) {
    return Promise.resolve(true);
  }
  if (retirement.promise) return retirement.promise;
  if (!after || typeof after.then !== 'function') {
    return Promise.reject(new TypeError(
      'terminal particle output retirement requires an owner fence'
    ));
  }
  retirement.failureReason = null;
  retirement.promise =
    retireLocallySubmittedMlsMpmFusedCoarseTerminalG2pOutputAfter(
      device,
      output,
      {
        terminalTransaction: origin.transaction,
        after
      }
    ).then(
    (retired) => {
      retirement.stateRetired = retired === true;
      retirement.mechanicsRetired = retired === true;
      retirement.promise = null;
      return retired;
    },
    (error) => {
      retirement.failureReason = error instanceof Error
        ? error.message
        : String(error);
      retirement.promise = null;
      throw error;
    }
  );
  return retirement.promise;
}

function retireTerminalOwnedThermoAfterFence(origin, after) {
  const retirement = origin?.ownedThermoRetirement;
  const thermoBuffer = origin?.ownedThermoBuffer ?? null;
  if (!retirement || !thermoBuffer) return Promise.resolve(true);
  if (retirement.retired) return Promise.resolve(true);
  if (retirement.promise) return retirement.promise;
  if (!after || typeof after.then !== 'function') {
    return Promise.reject(new TypeError(
      'terminal owned thermo retirement requires an owner fence'
    ));
  }
  retirement.failureReason = null;
  retirement.promise = Promise.resolve(after).then((confirmed) => {
    if (confirmed !== true) {
      throw new Error('terminal owned thermo owner fence was not confirmed');
    }
    thermoBuffer.destroy?.();
    retirement.retired = true;
    return true;
  }).then(
    (retired) => {
      retirement.promise = null;
      return retired;
    },
    (error) => {
      retirement.failureReason = error instanceof Error
        ? error.message
        : String(error);
      retirement.promise = null;
      throw error;
    }
  );
  return retirement.promise;
}

function retireMacroRefluxLedgerAfterFence(origin, after) {
  const retirement = origin?.refluxLedgerRetirement;
  if (!retirement || !origin?.refluxLedger) return Promise.resolve(true);
  if (retirement.retired) return Promise.resolve(true);
  if (retirement.promise) return retirement.promise;
  if (!after || typeof after.then !== 'function') {
    return Promise.reject(new TypeError(
      'macro reflux ledger retirement requires an owner fence'
    ));
  }
  retirement.failureReason = null;
  retirement.promise = Promise.resolve(after).then((confirmed) => {
    if (confirmed !== true) {
      throw new Error('macro reflux ledger owner fence was not confirmed');
    }
    const destroyed = origin.refluxLedger.destroy?.();
    if (destroyed !== true) {
      throw new Error('macro reflux ledger owner did not confirm retirement');
    }
    retirement.retired = true;
    return true;
  }).then(
    (retired) => {
      retirement.promise = null;
      return retired;
    },
    (error) => {
      retirement.failureReason = error instanceof Error
        ? error.message
        : String(error);
      retirement.promise = null;
      throw error;
    }
  );
  return retirement.promise;
}

export function abortSchroederTwoLevelMacroAuthorityAfter(
  device,
  macroAuthority,
  {
    microepochAuthority = null,
    reason = null,
    deviceLost = false
  } = {}
) {
  const origin = macroAuthorityOrigins.get(macroAuthority);
  if (
    !origin
    || origin.macroAuthority !== macroAuthority
    || origin.deviceId !== webGpuDeviceId(device)
    || origin.terminalStatus === 'mechanics-macro-aborted-retired'
  ) {
    throw new Error('two-level macro abort is stale or replayed');
  }
  if (origin.abortPromise) {
    if (deviceLost !== true || origin.abortAttempt?.mode === 'device-loss') {
      return origin.abortPromise;
    }
    origin.abortPromise.catch(() => {});
  }
  if (origin.pendingClosure) {
    const closureOrigin = pendingClosureOrigins.get(origin.pendingClosure);
    if (closureOrigin?.lifecycle?.state !== 'abandoning') {
      throw new Error(
        'two-level macro with a pending closure must be retired through closure abandonment'
      );
    }
  }
  const latestMicroepoch = origin.nextMicroepochOrdinal > 0
    ? origin.microepochByOrdinal.get(origin.nextMicroepochOrdinal - 1)
    : null;
  if (microepochAuthority != null && microepochAuthority !== latestMicroepoch) {
    throw new Error('two-level macro abort requires the exact latest microepoch');
  }
  origin.terminalStatus = 'mechanics-macro-aborting';
  const microepochOrigins = [...origin.microepochByOrdinal.values()].map(
    (authority) => fineMicroepochOrigins.get(authority)
  ).filter(Boolean);
  let retirements;
  try {
    if (microepochOrigins.length > 0) {
      retirements = microepochOrigins
        .filter((microOrigin) => microOrigin.status !== 'retired')
        .map((microOrigin) => (
          deviceLost === true
            ? abortSchroederFineMicroepochAfter(
              device,
              microOrigin.microepochAuthority,
              { reason, deviceLost: true }
            )
            : (microOrigin.abortPromise
              ?? microOrigin.retirementPromise
              ?? abortSchroederFineMicroepochAfter(
                device,
                microOrigin.microepochAuthority,
                { reason, deviceLost: false }
              ))
        ));
    } else {
      const side = origin.rootAbortRetirement;
      retirements = [beginAbortFieldRetirement({
        side,
        runtime: origin.fineFieldRuntime,
        field: origin.fineFieldView,
        publicationLock: origin.rootPublicationLock,
        deviceLost,
        reason
      })];
    }
  } catch (error) {
    origin.terminalStatus = 'mechanics-macro-abort-quarantined';
    return Promise.reject(error);
  }
  const abortAttempt = {
    mode: deviceLost === true ? 'device-loss' : 'queue-fence',
    promise: null
  };
  origin.abortAttempt = abortAttempt;
  const abortPromise = Promise.all(retirements).then(
    async () => {
      if (origin.abortAttempt !== abortAttempt) {
        return origin.abortPromise;
      }
      if (microepochOrigins.some((microOrigin) => microOrigin.status !== 'retired')) {
        throw new Error('macro abort did not retire every registered microepoch');
      }
      let outputFence;
      if (deviceLost === true) {
        outputFence = Promise.resolve(true);
      } else {
        const queueFence = device?.queue?.onSubmittedWorkDone?.();
        outputFence = queueFence && typeof queueFence.then === 'function'
          ? Promise.resolve(queueFence).then(() => true)
          : null;
        if (!outputFence || typeof outputFence.then !== 'function') {
          throw new Error(
            'macro abort particle-output retirement requires a queue fence'
          );
        }
      }
      const continuationOutputRetirements = [...origin.continuationByOrdinal]
        .filter(([ordinal]) => ordinal > 0)
        .map(([, continuation]) => (
          retireContinuationOutputAfterFence(
            particleContinuationOrigins.get(continuation),
            outputFence
          )
        ));
      const terminalOrigin = coarseTerminalTransactionOrigins.get(
        origin.terminalTransaction
      );
      if (terminalOrigin?.artifacts?.g2p) {
        continuationOutputRetirements.push(
          retireTerminalParticleOutputAfterFence(device, terminalOrigin, outputFence)
        );
        continuationOutputRetirements.push(
          retireTerminalOwnedThermoAfterFence(terminalOrigin, outputFence)
        );
      }
      continuationOutputRetirements.push(
        retireMacroRefluxLedgerAfterFence(origin, outputFence)
      );
      const particleOutputsRetired = await Promise.all(
        continuationOutputRetirements
      );
      if (particleOutputsRetired.some((retired) => retired !== true)) {
        throw new Error('macro abort did not retire every owned particle output');
      }
      origin.rootRetired = true;
      origin.terminalStatus = 'mechanics-macro-aborted-retired';
      return true;
    }
  ).then(
    (retired) => {
      if (origin.abortAttempt === abortAttempt) {
        origin.abortPromise = null;
        origin.abortAttempt = null;
      }
      return retired;
    },
    (error) => {
      if (origin.abortAttempt !== abortAttempt) {
        return origin.abortPromise ?? false;
      }
      origin.terminalStatus = 'mechanics-macro-abort-quarantined';
      origin.abortPromise = null;
      origin.abortAttempt = null;
      throw error;
    }
  );
  abortAttempt.promise = abortPromise;
  origin.abortPromise = abortPromise;
  abortPromise.catch(() => {});
  return abortPromise;
}

export function createSchroederFusedFineSubstepMutationPlan({
  fineSubstepCount,
  initialFineFieldOrdinal = 0
} = {}) {
  const count = positiveInteger(fineSubstepCount, 'fineSubstepCount', 4);
  const initial = exactU32(initialFineFieldOrdinal, 'initialFineFieldOrdinal');
  if (initial !== 0) {
    throw new RangeError(
      'refreshed fine microepochs require local field ordinal zero'
    );
  }
  return Object.freeze(Array.from({ length: count }, (_, substepOrdinal) => {
    return Object.freeze({
      substepOrdinal,
      inputOrdinal: 0,
      p2gOutputOrdinal: 1,
      gridUpdateOutputOrdinal: 2,
      fineCorrectionOutputOrdinal: 3
    });
  }));
}

export function createSchroederFusedFineSubstepTransaction({
  device,
  macroAuthority,
  microepochAuthority,
  particleContinuation,
  substepOrdinal,
  stageProducerValidators: callerSelectedStageProducerValidators = null
} = {}) {
  if (callerSelectedStageProducerValidators != null) {
    throw new TypeError(
      'fused fine substep stage producers are module-owned and cannot be caller-selected'
    );
  }
  const ordinal = exactU32(substepOrdinal, 'substepOrdinal');
  const macroOrigin = macroOriginFor(device, macroAuthority);
  const microepochOrigin = microepochOriginFor(device, microepochAuthority);
  const continuationOrigin = continuationOriginFor(device, particleContinuation);
  if (
    !macroOrigin
    || !microepochOrigin
    || microepochOrigin.macroAuthority !== macroAuthority
    || microepochOrigin.particleContinuation !== particleContinuation
    || microepochOrigin.substepOrdinal !== ordinal
    || microepochOrigin.status !== 'private-ready'
    || microepochOrigin.transaction !== null
    || !continuationOrigin
    || continuationOrigin.consumedByTransaction !== null
    || ordinal >= macroAuthority.fineSubstepCount
    || !validateSchroederCanonicalParticleContinuation(device, particleContinuation, {
      macroAuthority,
      ordinal
    })
  ) {
    throw new TypeError(
      'fused fine substep requires the exact ordered particle continuation'
    );
  }
  const fieldView = microepochAuthority.fineFieldView;
  const fieldRuntime = fieldView?.ownerRuntime ?? null;
  const publicationLock = microepochAuthority.publicationLock;
  const mutationState = fieldRuntime?.stateMutationState?.(fieldView);
  if (
    mutationState?.ordinal !== 0
    || mutationState.encoding
      !== SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY
    || mutationState.pending === true
    || mutationState.publicationLocked !== true
    || mutationState.quarantined === true
    || typeof fieldRuntime?.reserveStateMutationSequence !== 'function'
    || fieldRuntime.isStatePublicationLockActive?.(
      fieldView,
      publicationLock
    ) !== true
  ) {
    throw new TypeError('fused fine substep requires one locked fresh E_j fine field');
  }
  const mutationSequence = fieldRuntime.reserveStateMutationSequence(fieldView, {
    expectedOrdinal: mutationState.ordinal,
    expectedEncoding: mutationState.encoding,
    operation: `fused-fine-substep-${ordinal}`,
    publicationLock,
    stages: [
      {
        outputEncoding:
          SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
        operation: 'fused-fine-p2g-submitted'
      },
      {
        outputEncoding:
          SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
        operation: 'fused-fine-grid-update-submitted'
      },
      {
        outputEncoding:
          SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
        operation: 'fused-fine-correction-submitted'
      }
    ]
  });
  const transaction = {
    schema: ULG_SCHROEDER_FUSED_FINE_SUBSTEP_TRANSACTION_SCHEMA,
    status: 'fused-fine-substep-reserved',
    deviceId: webGpuDeviceId(device),
    macroAuthority,
    microepochAuthority,
    particleContinuation,
    substepOrdinal: ordinal,
    fineFieldView: fieldView,
    publicationLock,
    refluxLedger: macroAuthority.refluxLedger,
    completionOrdinal: macroAuthority.completionOrdinal,
    proposalMode: 'proposal-deferred-to-post-mechanics',
    mutationSequence,
    p2gMutation: mutationSequence.stages[0],
    gridUpdateMutation: mutationSequence.stages[1],
    fineCorrectionMutation: mutationSequence.stages[2]
  };
  const origin = {
    deviceId: transaction.deviceId,
    transaction,
    macroAuthority,
    microepochAuthority,
    particleContinuation,
    substepOrdinal: ordinal,
    fieldView,
    fieldRuntime,
    publicationLock,
    mutationSequence,
    sequenceInputOrdinal: mutationSequence.expectedOrdinal,
    sequenceOutputOrdinal: mutationSequence.outputOrdinal,
    sequenceInputEncoding: mutationSequence.expectedEncoding,
    sequenceOutputEncoding: mutationSequence.outputEncoding,
    sequenceStages: Object.freeze([...mutationSequence.stages]),
    fieldBuffer: fieldView.fieldViewBuffer,
    fieldIdentityBuffer: fieldView.identityBuffer,
    fieldSelectedLevel: fieldView.selectedLevel,
    fieldGridSpacingM: fieldView.gridSpacingM,
    fieldGridDims: exactArraySnapshot(fieldView.gridDims),
    stageIndex: 0,
    artifacts: Object.seal({
      p2g: null,
      'grid-update': null,
      'fine-correction': null,
      g2p: null
    }),
    status: 'reserved',
    submissionObservedStage: null,
    quarantineReason: null,
    stageProducerCapability: null
  };
  Object.freeze(transaction);
  fineTransactionOrigins.set(transaction, origin);
  microepochOrigin.transaction = transaction;
  microepochOrigin.status = 'transaction-reserved';
  continuationOrigin.consumedByTransaction = transaction;
  macroOrigin.lastTransaction = transaction;
  macroOrigin.fineTransactionByOrdinal.set(ordinal, transaction);
  return transaction;
}

function transactionSequenceMatches(origin) {
  const { fieldRuntime, fieldView, mutationSequence, stageIndex } = origin;
  if (origin.status === 'discarded' || origin.status === 'quarantined') {
    return true;
  }
  try {
    const observedStageIndex = origin.submissionObservedStage == null
      ? -1
      : FINE_STAGE_ORDER.indexOf(origin.submissionObservedStage);
    if (observedStageIndex >= 0) {
      if (observedStageIndex !== stageIndex) return false;
      if (stageIndex < mutationSequence.stages.length) {
        return mutationSequence.stages.every((segment, index) => (
          index < stageIndex
            ? fieldRuntime.isStateMutationSequenceSegmentSubmitted(
                fieldView,
                mutationSequence,
                segment
              ) === true
            : index === stageIndex
              ? fieldRuntime.isStateMutationSequenceStageSubmissionObserved?.(
                  fieldView,
                  mutationSequence,
                  segment
                ) === true
              : true
        ));
      }
      return stageIndex === FINE_STAGE_ORDER.length - 1
        && mutationSequence.stages.every((segment) => (
          fieldRuntime.isStateMutationSequenceSegmentSubmitted(
            fieldView,
            mutationSequence,
            segment
          ) === true
        ));
    }
    if (stageIndex < 3) {
      for (let index = 0; index < mutationSequence.stages.length; index += 1) {
        const segment = mutationSequence.stages[index];
        const admitted = index < stageIndex
          ? fieldRuntime.isStateMutationSequenceSegmentSubmitted(
              fieldView,
              mutationSequence,
              segment
            )
          : index === stageIndex
            ? fieldRuntime.isStateMutationSequenceSegmentReady(
                fieldView,
                mutationSequence,
                segment
              )
            : true;
        if (admitted !== true) return false;
      }
      return true;
    }
    if (stageIndex === 3) {
      return mutationSequence.stages.every((segment) => (
        fieldRuntime.isStateMutationSequenceSegmentSubmitted(
          fieldView,
          mutationSequence,
          segment
        ) === true
      ));
    }
    return stageIndex === 4
      && fieldRuntime.isCurrentStateArtifact?.(fieldView, {
        mutationOrdinal: origin.sequenceOutputOrdinal,
        stateEncoding: origin.sequenceOutputEncoding,
        publicationLock: origin.publicationLock
      }) === true;
  } catch {
    return false;
  }
}

function transactionMatchesOrigin(
  device,
  transaction,
  origin,
  { requireLive = true } = {}
) {
  const field = origin?.fieldView;
  const runtime = origin?.fieldRuntime;
  let fieldOwned = true;
  if (requireLive && origin?.status !== 'discarded') {
    try {
      fieldOwned = runtime?.ownsExecution?.(field) === true
        && runtime?.isExecutionSubmitted?.(field) === true;
    } catch {
      fieldOwned = false;
    }
  }
  return Boolean(
    origin
    && origin.deviceId === webGpuDeviceId(device)
    && transaction === origin.transaction
    && transaction.schema
      === ULG_SCHROEDER_FUSED_FINE_SUBSTEP_TRANSACTION_SCHEMA
    && transaction.status === 'fused-fine-substep-reserved'
    && transaction.macroAuthority === origin.macroAuthority
    && transaction.microepochAuthority === origin.microepochAuthority
    && transaction.particleContinuation === origin.particleContinuation
    && transaction.substepOrdinal === origin.substepOrdinal
    && transaction.fineFieldView === field
    && transaction.publicationLock === origin.publicationLock
    && transaction.refluxLedger === origin.macroAuthority.refluxLedger
    && transaction.completionOrdinal === origin.macroAuthority.completionOrdinal
    && transaction.proposalMode === 'proposal-deferred-to-post-mechanics'
    && transaction.mutationSequence === origin.mutationSequence
    && transaction.p2gMutation === origin.sequenceStages[0]
    && transaction.gridUpdateMutation === origin.sequenceStages[1]
    && transaction.fineCorrectionMutation === origin.sequenceStages[2]
    && origin.mutationSequence.stages === transaction.mutationSequence.stages
    && origin.sequenceStages.every(
      (segment, index) => origin.mutationSequence.stages[index] === segment
    )
    && origin.mutationSequence.expectedOrdinal === origin.sequenceInputOrdinal
    && origin.mutationSequence.outputOrdinal === origin.sequenceOutputOrdinal
    && origin.mutationSequence.expectedEncoding === origin.sequenceInputEncoding
    && origin.mutationSequence.outputEncoding === origin.sequenceOutputEncoding
    && (!requireLive || (
      validateSchroederTwoLevelMacroAuthority(device, origin.macroAuthority)
      && validateSchroederFineMicroepochAuthority(
        device,
        origin.microepochAuthority,
        {
          macroAuthority: origin.macroAuthority,
          particleContinuation: origin.particleContinuation,
          substepOrdinal: origin.substepOrdinal
        }
      )
      && validateSchroederCanonicalParticleContinuation(
        device,
        origin.particleContinuation,
        {
          macroAuthority: origin.macroAuthority,
          ordinal: origin.substepOrdinal,
          sphParticleUpload: origin.particleContinuation.sphParticleUpload,
          mlsMpmParticleUpload: origin.particleContinuation.mlsMpmParticleUpload
        }
      )
    ))
    && origin.microepochAuthority.fineFieldView === field
    && origin.microepochAuthority.publicationLock === origin.publicationLock
    && field?.ownerRuntime === runtime
    && field?.fieldViewBuffer === origin.fieldBuffer
    && field?.identityBuffer === origin.fieldIdentityBuffer
    && field?.selectedLevel === origin.fieldSelectedLevel
    && Object.is(field?.gridSpacingM, origin.fieldGridSpacingM)
    && exactArrayMatches(field?.gridDims, origin.fieldGridDims)
    && (!requireLive || runtime?.isStatePublicationLockActive?.(
      field,
      origin.publicationLock
    ) === true)
    && (!requireLive || (fieldOwned && transactionSequenceMatches(origin)))
  );
}

function transactionOriginFor(device, transaction, options = {}) {
  const origin = fineTransactionOrigins.get(transaction);
  return transactionMatchesOrigin(device, transaction, origin, options)
    ? origin
    : null;
}

function rawFineTransactionOriginFor(device, transaction) {
  const origin = fineTransactionOrigins.get(transaction);
  return origin
    && origin.deviceId === webGpuDeviceId(device)
    && origin.transaction === transaction
    ? origin
    : null;
}

function validateTransactionStage(origin, stage, artifact = null) {
  const stageIndex = FINE_STAGE_ORDER.indexOf(stage);
  if (stageIndex < 0 || origin.stageIndex !== stageIndex) return false;
  if (stageIndex > 0 && artifact != null
      && artifact !== origin.artifacts[FINE_STAGE_ORDER[stageIndex - 1]]) {
    return false;
  }
  return transactionSequenceMatches(origin);
}

function stageArtifactAdmitted(device, origin, stage, artifact, priorArtifact) {
  const stageIndex = FINE_STAGE_ORDER.indexOf(stage);
  if (stageIndex < 0 || !artifact || origin.stageIndex !== stageIndex) return false;
  if (stageIndex > 0
      && priorArtifact !== origin.artifacts[FINE_STAGE_ORDER[stageIndex - 1]]) {
    return false;
  }
  const segment = stageIndex < 3
    ? origin.sequenceStages[stageIndex]
    : null;
  const transaction = origin.transaction;
  const shared = artifact?.fusedFineSubstepTransaction === transaction
    && artifact?.mechanicsFieldViewExecution === origin.fieldView
    && artifact?.fineMicroepochAuthority === origin.microepochAuthority
    && artifact?.proposalMode === 'proposal-deferred-to-post-mechanics';
  const structural = stage === 'p2g'
    ? shared
      && artifact?.mechanicsFieldMutationInputOrdinal === segment.expectedOrdinal
      && artifact?.mechanicsFieldMutationOutputOrdinal === segment.outputOrdinal
      && artifact?.mechanicsFieldMutationInputStateEncoding
        === segment.expectedEncoding
      && artifact?.mechanicsFieldMutationOutputStateEncoding
        === segment.outputEncoding
    : stage === 'grid-update'
      ? shared
        && artifact?.sourceProjection === priorArtifact
        && artifact?.mechanicsFieldMutationInputOrdinal === segment.expectedOrdinal
        && artifact?.mechanicsFieldMutationOutputOrdinal === segment.outputOrdinal
        && artifact?.mechanicsFieldMutationInputStateEncoding
          === segment.expectedEncoding
        && artifact?.mechanicsFieldMutationOutputStateEncoding
          === segment.outputEncoding
      : stage === 'fine-correction'
        ? shared
          && artifact?.previousGridUpdate === priorArtifact
          && artifact?.mechanicsFieldMutationInputOrdinal === segment.expectedOrdinal
          && artifact?.mechanicsFieldMutationOutputOrdinal === segment.outputOrdinal
          && artifact?.mechanicsFieldMutationInputStateEncoding
            === segment.expectedEncoding
          && artifact?.mechanicsFieldMutationOutputStateEncoding
            === segment.outputEncoding
          && artifact?.parentFieldMechanicsTerminalSubmitted === true
        : stage === 'g2p'
          ? artifact?.fusedFineSubstepTransaction === transaction
            && artifact?.sourceGridUpdate === priorArtifact
            && artifact?.sourceParticleContinuation === origin.particleContinuation
            && artifact?.fineMicroepochAuthority === origin.microepochAuthority
            && artifact?.proposalMode === 'proposal-deferred-to-post-mechanics'
            && artifact?.mechanicalProposalApplied === false
            && artifact?.stateBuffer
            && artifact?.mechanicsBuffer
          : false;
  if (!structural) return false;
  try {
    return validateExactStageProducer(stage, device, artifact, {
      transaction,
      macroAuthority: origin.macroAuthority,
      microepochAuthority: origin.microepochAuthority,
      particleContinuation: origin.particleContinuation,
      fieldExecution: origin.fieldView,
      mutationSegment: segment,
      priorArtifact,
      requireDeferred: true,
      proposalMode: 'proposal-deferred-to-post-mechanics'
    }) === true;
  } catch {
    return false;
  }
}

export function validateSchroederFusedFineSubstepTransaction(
  device,
  transaction,
  {
    stage = null,
    macroAuthority = null,
    microepochAuthority = null,
    particleContinuation = null,
    artifact = null
  } = {}
) {
  const origin = transactionOriginFor(device, transaction);
  if (origin) {
    return origin.status !== 'discarded'
      && origin.status !== 'quarantined'
      && (macroAuthority == null || macroAuthority === origin.macroAuthority)
      && (microepochAuthority == null
        || microepochAuthority === origin.microepochAuthority)
      && (particleContinuation == null
        || particleContinuation === origin.particleContinuation)
      && (
        stage == null
        || (
          origin.submissionObservedStage === null
          && validateTransactionStage(origin, stage, artifact)
        )
      );
  }
  return false;
}

export function claimSchroederFusedFineSubstepStageProducer(
  device,
  transaction,
  { stage, priorArtifact = null } = {}
) {
  const origin = transactionOriginFor(device, transaction);
  if (
    !origin
    || origin.submissionObservedStage !== null
    || origin.stageProducerCapability !== null
    || !validateTransactionStage(origin, stage, priorArtifact)
  ) {
    throw new Error(
      'fused fine-substep stage already has a producer or is not ready'
    );
  }
  const capability = Object.freeze({
    schema: 'peercompute.ulg.schroeder-fused-stage-producer-capability.v1',
    stage
  });
  origin.stageProducerCapability = capability;
  return capability;
}

export function releaseSchroederFusedFineSubstepStageProducer(
  device,
  transaction,
  capability
) {
  const origin = rawFineTransactionOriginFor(device, transaction);
  if (!origin || origin.stageProducerCapability == null) return false;
  if (origin.stageProducerCapability !== capability) {
    throw new Error('fused fine-substep producer capability is stale or foreign');
  }
  if (origin.submissionObservedStage !== null) {
    throw new Error('an observed fused fine-substep producer cannot be released');
  }
  origin.stageProducerCapability = null;
  return true;
}

export function markSchroederFusedFineSubstepStageSubmitted(
  device,
  transaction,
  {
    stage,
    artifact,
    priorArtifact = null,
    producerCapability = null
  } = {}
) {
  const origin = transactionOriginFor(device, transaction);
  if (
    !origin
    || !artifact
    || ((origin.stageProducerCapability !== null || producerCapability !== null)
      && origin.stageProducerCapability !== producerCapability)
    || origin.submissionObservedStage !== stage
    || !validateTransactionStage(origin, stage, priorArtifact)
    || !stageArtifactAdmitted(
      device,
      origin,
      stage,
      artifact,
      priorArtifact
    )
  ) {
    throw new Error('fused fine-substep stage is stale, foreign, or out of order');
  }
  const stageIndex = FINE_STAGE_ORDER.indexOf(stage);
  if (stageIndex < 3) {
    origin.fieldRuntime.markStateMutationSequenceStageSubmitted(
      origin.mutationSequence,
      origin.mutationSequence.stages[stageIndex]
    );
  } else {
    origin.fieldRuntime.completeStateMutationSequence(origin.mutationSequence);
  }
  origin.submissionObservedStage = null;
  origin.stageProducerCapability = null;
  origin.artifacts[stage] = artifact;
  origin.stageIndex += 1;
  origin.status = stage === 'g2p'
    ? 'g2p-submitted-unverified'
    : `${stage}-submitted`;
  const microepochOrigin = fineMicroepochOrigins.get(origin.microepochAuthority);
  if (microepochOrigin) {
    microepochOrigin.status = stage === 'g2p'
      ? 'g2p-submitted-unverified'
      : `${stage}-submitted`;
  }
  return true;
}

export function markSchroederFusedFineSubstepStageSubmissionObserved(
  device,
  transaction,
  { stage, producerCapability = null } = {}
) {
  const origin = rawFineTransactionOriginFor(device, transaction);
  const stageIndex = FINE_STAGE_ORDER.indexOf(stage);
  if (
    !origin
    || stageIndex < 0
    || origin.stageIndex !== stageIndex
    || origin.submissionObservedStage !== null
    || ((origin.stageProducerCapability !== null || producerCapability !== null)
      && origin.stageProducerCapability !== producerCapability)
  ) {
    throw new Error(
      'fused fine-substep stage submission observation is stale, foreign, or out of order'
    );
  }
  const priorArtifact = stageIndex > 0
    ? origin.artifacts[FINE_STAGE_ORDER[stageIndex - 1]]
    : null;
  const strictOrigin = transactionOriginFor(device, transaction);
  const strictProvenance = strictOrigin === origin
    && validateTransactionStage(origin, stage, priorArtifact);
  origin.submissionObservedStage = stage;
  origin.status = `${stage}-submitted-artifact-pending`;
  let observationError = null;
  try {
    if (stageIndex < origin.sequenceStages.length) {
      origin.fieldRuntime.markStateMutationSequenceStageSubmissionObserved(
        origin.mutationSequence,
        origin.sequenceStages[stageIndex]
      );
    }
  } catch (error) {
    observationError = error;
  }
  if (!strictProvenance || observationError) {
    const error = observationError ?? new Error(
      'fused fine-substep stage submission observation is stale, foreign, or out of order'
    );
    try {
      quarantineSchroederFusedFineSubstepTransaction(
        device,
        transaction,
        error
      );
    } catch {
      // The exact transaction remains irreversibly observed/quarantined even
      // when a device/runtime quarantine hook also fails.
    }
    throw error;
  }
  return true;
}

export function discardSchroederFusedFineSubstepTransaction(
  device,
  transaction,
  { discardedEncoder = false } = {}
) {
  const origin = rawFineTransactionOriginFor(device, transaction);
  if (
    !origin
    || origin.stageIndex !== 0
    || origin.submissionObservedStage !== null
    || origin.stageProducerCapability !== null
    || origin.status !== 'reserved'
  ) {
    throw new Error('only an unsubmitted fused fine-substep transaction can be discarded');
  }
  origin.fieldRuntime.discardStateMutationSequence(origin.mutationSequence, {
    discardedEncoder
  });
  origin.status = 'discarded';
  const microepochOrigin = fineMicroepochOrigins.get(origin.microepochAuthority);
  if (microepochOrigin) microepochOrigin.status = 'discarded';
  return true;
}

export function quarantineSchroederFusedFineSubstepTransaction(
  device,
  transaction,
  reason = null
) {
  const origin = rawFineTransactionOriginFor(device, transaction);
  if (
    !origin
    || (origin.stageIndex === 0 && origin.submissionObservedStage === null)
    || origin.status === 'quarantined'
  ) {
    throw new Error('only a submitted fused fine-substep can be quarantined');
  }
  origin.status = 'quarantined';
  origin.quarantineReason = reason ?? null;
  origin.stageProducerCapability = null;
  const microepochOrigin = fineMicroepochOrigins.get(origin.microepochAuthority);
  if (microepochOrigin) {
    microepochOrigin.status = 'quarantined';
    microepochOrigin.quarantineReason = reason ?? null;
  }
  let quarantineError = null;
  try {
    if (origin.stageIndex < FINE_STAGE_ORDER.length) {
      origin.fieldRuntime.quarantineStateMutationSequence(
        origin.mutationSequence,
        reason
      );
    } else {
      origin.fieldRuntime.quarantineCurrentStateArtifact?.(origin.fieldView, {
        mutationOrdinal: origin.sequenceOutputOrdinal,
        stateEncoding: origin.sequenceOutputEncoding,
        reason
      });
    }
  } catch (error) {
    quarantineError = error;
  }
  origin.quarantineReason = reason ?? quarantineError;
  if (microepochOrigin) {
    microepochOrigin.quarantineReason = reason ?? quarantineError;
  }
  if (quarantineError) throw quarantineError;
  return true;
}

export function schroederFusedFineSubstepTransactionState(device, transaction) {
  const origin = transactionOriginFor(device, transaction, { requireLive: false });
  if (!origin) return null;
  return Object.freeze({
    status: origin.status,
    stageIndex: origin.stageIndex,
    submissionObservedStage: origin.submissionObservedStage,
    nextStage: FINE_STAGE_ORDER[origin.stageIndex] ?? null,
    submittedStageCount: Math.min(origin.stageIndex, 3),
    g2pSubmitted: origin.stageIndex === FINE_STAGE_ORDER.length,
    gpuReceiptStatus: origin.submissionObservedStage !== null
      ? 'submission-observed-artifact-pending'
      : origin.stageIndex === FINE_STAGE_ORDER.length
        ? 'submitted-unverified'
        : 'not-submitted',
    gpuReceiptVerified: false,
    quarantineReason: origin.quarantineReason
  });
}

export const SCHROEDER_FUSED_FINE_SUBSTEP_STAGE_ORDER = FINE_STAGE_ORDER;

function coarseTerminalSequenceMatches(origin) {
  const { fieldRuntime, fieldView, mutationSequence, stageIndex } = origin;
  if (origin.status === 'discarded' || origin.status === 'quarantined') {
    return true;
  }
  try {
    const observedStageIndex = origin.submissionObservedStage == null
      ? -1
      : COARSE_TERMINAL_STAGE_ORDER.indexOf(origin.submissionObservedStage);
    if (observedStageIndex >= 0) {
      if (observedStageIndex !== stageIndex) return false;
      if (stageIndex < mutationSequence.stages.length) {
        return mutationSequence.stages.every((segment, index) => (
          index < stageIndex
            ? fieldRuntime.isStateMutationSequenceSegmentSubmitted(
                fieldView,
                mutationSequence,
                segment
              ) === true
            : index === stageIndex
              ? fieldRuntime.isStateMutationSequenceStageSubmissionObserved?.(
                  fieldView,
                  mutationSequence,
                  segment
                ) === true
              : true
        ));
      }
      return stageIndex === COARSE_TERMINAL_STAGE_ORDER.length - 1
        && mutationSequence.stages.every((segment) => (
          fieldRuntime.isStateMutationSequenceSegmentSubmitted(
            fieldView,
            mutationSequence,
            segment
          ) === true
        ));
    }
    if (stageIndex < mutationSequence.stages.length) {
      return mutationSequence.stages.every((segment, index) => {
        if (index < stageIndex) {
          return fieldRuntime.isStateMutationSequenceSegmentSubmitted(
            fieldView,
            mutationSequence,
            segment
          ) === true;
        }
        if (index === stageIndex) {
          return fieldRuntime.isStateMutationSequenceSegmentReady(
            fieldView,
            mutationSequence,
            segment
          ) === true;
        }
        return true;
      });
    }
    if (stageIndex === mutationSequence.stages.length) {
      return mutationSequence.stages.every((segment) => (
        fieldRuntime.isStateMutationSequenceSegmentSubmitted(
          fieldView,
          mutationSequence,
          segment
        ) === true
      ));
    }
    return stageIndex === COARSE_TERMINAL_STAGE_ORDER.length
      && fieldRuntime.isCurrentStateArtifact?.(fieldView, {
        mutationOrdinal: origin.sequenceOutputOrdinal,
        stateEncoding: origin.sequenceOutputEncoding,
        publicationLock: origin.publicationLock
      }) === true;
  } catch {
    return false;
  }
}

function coarseTerminalTransactionMatchesOrigin(
  device,
  transaction,
  origin,
  { requireLive = true } = {}
) {
  const field = origin?.fieldView;
  const runtime = origin?.fieldRuntime;
  let fieldOwned = true;
  if (requireLive && origin?.status !== 'discarded') {
    try {
      fieldOwned = runtime?.ownsExecution?.(field) === true
        && runtime?.isExecutionSubmitted?.(field) === true;
    } catch {
      fieldOwned = false;
    }
  }
  return Boolean(
    origin
    && origin.status !== 'discard-pending'
    && origin.deviceId === webGpuDeviceId(device)
    && transaction === origin.transaction
    && transaction.schema
      === ULG_SCHROEDER_FUSED_COARSE_TERMINAL_TRANSACTION_SCHEMA
    && transaction.status === 'fused-coarse-terminal-reserved'
    && transaction.macroAuthority === origin.macroAuthority
    && transaction.microepochAuthority === origin.microepochAuthority
    && transaction.particleContinuation === origin.particleContinuation
    && transaction.substepOrdinal === origin.substepOrdinal
    && transaction.coarseFieldView === field
    && transaction.coarsePublicationLock === origin.publicationLock
    && transaction.refluxLedger === origin.macroAuthority.refluxLedger
    && transaction.completionOrdinal === origin.macroAuthority.completionOrdinal
    && transaction.proposalMode === 'proposal-deferred-to-post-mechanics'
    && transaction.mutationSequence === origin.mutationSequence
    && transaction.p2gMutation === origin.sequenceStages[0]
    && transaction.gridUpdateMutation === origin.sequenceStages[1]
    && transaction.coarseTerminalMutation === origin.sequenceStages[2]
    && origin.macroAuthority.fineSubstepCount === origin.substepOrdinal
    && origin.macroAuthority.coarseLevel === origin.selectedLevel
    && Object.is(origin.macroAuthority.macroDt, origin.dt)
    && (!requireLive || (
      origin.macroOrigin?.terminalTransaction === transaction
      && origin.microepochOrigin?.transaction === transaction
      && origin.continuationOrigin?.consumedByTransaction === transaction
      && origin.status !== 'discarded'
      && origin.status !== 'quarantined'
      &&
      validateSchroederTwoLevelMacroAuthority(device, origin.macroAuthority)
      && validateSchroederFineMicroepochAuthority(
        device,
        origin.microepochAuthority,
        {
          macroAuthority: origin.macroAuthority,
          particleContinuation: origin.particleContinuation,
          substepOrdinal: origin.substepOrdinal
        }
      )
      && validateSchroederCanonicalParticleContinuation(
        device,
        origin.particleContinuation,
        {
          macroAuthority: origin.macroAuthority,
          ordinal: origin.substepOrdinal,
          sphParticleUpload: origin.sphParticleUpload,
          mlsMpmParticleUpload: origin.mlsMpmParticleUpload,
          stateBuffer: origin.stateBuffer,
          thermoBuffer: origin.thermoBuffer,
          identityBuffer: origin.identityBuffer,
          mechanicsBuffer: origin.mechanicsBuffer
        }
      )
    ))
    && origin.microepochAuthority.parentFieldView?.coarseFieldView === field
    && field?.ownerRuntime === runtime
    && field?.fieldViewBuffer === origin.fieldBuffer
    && field?.identityBuffer === origin.identityBuffer
    && field?.selectedLevel === origin.selectedLevel
    && Object.is(field?.gridSpacingM, origin.gridSpacingM)
    && exactArrayMatches(field?.gridDims, origin.gridDims)
    && (!requireLive || runtime?.isStatePublicationLockActive?.(
      field,
      origin.publicationLock
    ) === true)
    && (!requireLive || (fieldOwned && coarseTerminalSequenceMatches(origin)))
  );
}

function coarseTerminalTransactionOriginFor(
  device,
  transaction,
  options = {}
) {
  const origin = coarseTerminalTransactionOrigins.get(transaction);
  return coarseTerminalTransactionMatchesOrigin(
    device,
    transaction,
    origin,
    options
  ) ? origin : null;
}

function rawCoarseTerminalTransactionOriginFor(device, transaction) {
  const origin = coarseTerminalTransactionOrigins.get(transaction);
  return origin
    && origin.deviceId === webGpuDeviceId(device)
    && origin.transaction === transaction
    ? origin
    : null;
}

export function createSchroederFusedCoarseTerminalTransaction({
  device,
  macroAuthority,
  microepochAuthority,
  particleContinuation,
  stageProducerValidators: callerSelectedStageProducerValidators = null
} = {}) {
  if (callerSelectedStageProducerValidators != null) {
    throw new TypeError(
      'fused coarse-terminal stage producers are module-owned and cannot be caller-selected'
    );
  }
  const macroOrigin = macroOriginFor(device, macroAuthority);
  const microepochOrigin = microepochOriginFor(device, microepochAuthority);
  const continuationOrigin = continuationOriginFor(device, particleContinuation);
  const ordinal = macroAuthority?.fineSubstepCount;
  const priorFineTransaction = Number.isInteger(ordinal) && ordinal > 0
    ? macroOrigin?.fineTransactionByOrdinal.get(ordinal - 1)
    : null;
  const priorFineOrigin = priorFineTransaction == null
    ? null
    : transactionOriginFor(device, priorFineTransaction, { requireLive: false });
  const everyFineSubstepComplete = Number.isInteger(ordinal)
    && ordinal > 0
    && Array.from({ length: ordinal }, (_, index) => {
      const candidate = macroOrigin?.fineTransactionByOrdinal.get(index);
      const candidateOrigin = candidate == null
        ? null
        : transactionOriginFor(device, candidate, { requireLive: false });
      return candidateOrigin?.substepOrdinal === index
        && candidateOrigin.stageIndex === FINE_STAGE_ORDER.length
        && candidateOrigin.status === 'g2p-submitted-unverified';
    }).every(Boolean);
  if (
    !macroOrigin
    || macroOrigin.terminalTransaction !== null
    || !microepochOrigin
    || microepochOrigin.macroAuthority !== macroAuthority
    || microepochOrigin.particleContinuation !== particleContinuation
    || microepochOrigin.substepOrdinal !== ordinal
    || microepochOrigin.status !== 'private-ready'
    || microepochOrigin.transaction !== null
    || !continuationOrigin
    || continuationOrigin.macroAuthority !== macroAuthority
    || continuationOrigin.ordinal !== ordinal
    || continuationOrigin.consumedByTransaction !== null
    || priorFineOrigin?.stageIndex !== FINE_STAGE_ORDER.length
    || priorFineOrigin?.status !== 'g2p-submitted-unverified'
    || everyFineSubstepComplete !== true
  ) {
    throw new TypeError(
      'fused coarse terminal requires exact completed fine substeps and live E_r/C_r'
    );
  }
  const fieldView = microepochOrigin.coarseFieldView;
  const fieldRuntime = microepochOrigin.coarseFieldRuntime;
  const mutationState = fieldRuntime?.stateMutationState?.(fieldView);
  if (
    fieldView !== microepochAuthority.parentFieldView?.coarseFieldView
    || fieldView?.selectedLevel !== macroAuthority.coarseLevel
    || fieldView?.identityBuffer !== particleContinuation.identityBuffer
    || mutationState?.ordinal !== 0
    || mutationState.encoding
      !== SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY
    || mutationState.pending === true
    || mutationState.publicationLocked === true
    || mutationState.quarantined === true
    || typeof fieldRuntime?.acquireStatePublicationLock !== 'function'
    || typeof fieldRuntime?.discardStatePublicationLock !== 'function'
    || typeof fieldRuntime?.reserveStateMutationSequence !== 'function'
  ) {
    throw new TypeError(
      'fused coarse terminal requires one fresh submitted E_r coarse field'
    );
  }
  const publicationOwner = Object.freeze({
    schema: 'peercompute.ulg.schroeder-coarse-terminal-publication-owner.v0',
    macroAuthority,
    ordinal
  });
  const publicationLock = fieldRuntime.acquireStatePublicationLock(
    fieldView,
    {
      owner: publicationOwner,
      publicationReceiptValidator:
        validateMechanicsFieldPublicationReceipt
    }
  );
  let mutationSequence;
  try {
    mutationSequence = fieldRuntime.reserveStateMutationSequence(fieldView, {
      expectedOrdinal: 0,
      expectedEncoding:
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
      operation: 'fused-coarse-terminal',
      publicationLock,
      stages: [
        {
          outputEncoding:
            SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
          operation: 'fused-coarse-terminal-actual-p2g-submitted'
        },
        {
          outputEncoding:
            SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
          operation: 'fused-coarse-terminal-grid-update-submitted'
        },
        {
          outputEncoding:
            SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
          operation: 'fused-coarse-terminal-reflux-submitted'
        }
      ]
    });
  } catch (error) {
    try {
      fieldRuntime.discardStatePublicationLock(fieldView, publicationLock);
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        'fused coarse-terminal reservation and lock rollback both failed'
      );
    }
    throw error;
  }
  const transaction = {
    schema: ULG_SCHROEDER_FUSED_COARSE_TERMINAL_TRANSACTION_SCHEMA,
    status: 'fused-coarse-terminal-reserved',
    deviceId: webGpuDeviceId(device),
    macroAuthority,
    microepochAuthority,
    particleContinuation,
    substepOrdinal: ordinal,
    coarseFieldView: fieldView,
    coarsePublicationLock: publicationLock,
    refluxLedger: macroAuthority.refluxLedger,
    completionOrdinal: macroAuthority.completionOrdinal,
    proposalMode: 'proposal-deferred-to-post-mechanics',
    mutationSequence,
    p2gMutation: mutationSequence.stages[0],
    gridUpdateMutation: mutationSequence.stages[1],
    coarseTerminalMutation: mutationSequence.stages[2]
  };
  const origin = {
    deviceId: transaction.deviceId,
    transaction,
    macroAuthority,
    macroOrigin,
    microepochAuthority,
    microepochOrigin,
    particleContinuation,
    continuationOrigin,
    substepOrdinal: ordinal,
    dt: macroAuthority.macroDt,
    selectedLevel: macroAuthority.coarseLevel,
    fieldView,
    fieldRuntime,
    fieldBuffer: fieldView.fieldViewBuffer,
    publicationOwner,
    publicationLock,
    mutationSequence,
    sequenceInputOrdinal: mutationSequence.expectedOrdinal,
    sequenceOutputOrdinal: mutationSequence.outputOrdinal,
    sequenceInputEncoding: mutationSequence.expectedEncoding,
    sequenceOutputEncoding: mutationSequence.outputEncoding,
    sequenceStages: Object.freeze([...mutationSequence.stages]),
    gridSpacingM: fieldView.gridSpacingM,
    gridDims: exactArraySnapshot(fieldView.gridDims),
    sphParticleUpload: particleContinuation.sphParticleUpload,
    mlsMpmParticleUpload: particleContinuation.mlsMpmParticleUpload,
    stateBuffer: particleContinuation.stateBuffer,
    thermoBuffer: particleContinuation.thermoBuffer,
    identityBuffer: particleContinuation.identityBuffer,
    mechanicsBuffer: particleContinuation.mechanicsBuffer,
    particleCount: particleContinuation.sphParticleUpload.particleCount,
    stageIndex: 0,
    artifacts: Object.seal({
      p2g: null,
      'grid-update': null,
      'coarse-terminal': null,
      g2p: null
    }),
    status: 'reserved',
    submissionObservedStage: null,
    quarantineReason: null,
    stageProducerCapability: null,
    discardCleanup: {
      sequence: false,
      publicationLock: false
    },
    outputClaimed: false,
    finalSphParticleUpload: null,
    finalMlsMpmParticleUpload: null,
    ownedThermoBuffer: null,
    pendingClosure: null,
    outputRetirement: {
      stateRetired: false,
      mechanicsRetired: false,
      promise: null,
      failureReason: null
    },
    ownedThermoRetirement: {
      retired: false,
      promise: null,
      failureReason: null
    }
  };
  Object.freeze(transaction);
  coarseTerminalTransactionOrigins.set(transaction, origin);
  macroOrigin.terminalTransaction = transaction;
  microepochOrigin.transaction = transaction;
  microepochOrigin.status = 'coarse-terminal-transaction-reserved';
  microepochOrigin.abortRetirement.coarse.required = true;
  continuationOrigin.consumedByTransaction = transaction;
  return transaction;
}

function validateCoarseTerminalStage(origin, stage, artifact = null) {
  const stageIndex = COARSE_TERMINAL_STAGE_ORDER.indexOf(stage);
  if (stageIndex < 0 || origin.stageIndex !== stageIndex) return false;
  if (stageIndex > 0 && artifact != null
      && artifact !== origin.artifacts[COARSE_TERMINAL_STAGE_ORDER[stageIndex - 1]]) {
    return false;
  }
  return coarseTerminalSequenceMatches(origin);
}

function coarseTerminalStageArtifactAdmitted(
  device,
  origin,
  stage,
  artifact,
  priorArtifact
) {
  const stageIndex = COARSE_TERMINAL_STAGE_ORDER.indexOf(stage);
  if (stageIndex < 0 || !artifact || origin.stageIndex !== stageIndex) return false;
  if (stageIndex > 0
      && priorArtifact
        !== origin.artifacts[COARSE_TERMINAL_STAGE_ORDER[stageIndex - 1]]) {
    return false;
  }
  const segment = stageIndex < 3 ? origin.sequenceStages[stageIndex] : null;
  const transaction = origin.transaction;
  const shared = artifact?.fusedCoarseTerminalTransaction === transaction
    && artifact?.mechanicsFieldViewExecution === origin.fieldView
    && artifact?.terminalMicroepochAuthority === origin.microepochAuthority
    && artifact?.proposalMode === 'proposal-deferred-to-post-mechanics';
  const structural = stage === 'p2g'
    ? shared
      && artifact?.mechanicsFieldMutationInputOrdinal === segment.expectedOrdinal
      && artifact?.mechanicsFieldMutationOutputOrdinal === segment.outputOrdinal
      && artifact?.mechanicsFieldMutationInputStateEncoding === segment.expectedEncoding
      && artifact?.mechanicsFieldMutationOutputStateEncoding === segment.outputEncoding
    : stage === 'grid-update'
      ? shared
        && artifact?.sourceProjection === priorArtifact
        && artifact?.mechanicsFieldMutationInputOrdinal === segment.expectedOrdinal
        && artifact?.mechanicsFieldMutationOutputOrdinal === segment.outputOrdinal
        && artifact?.mechanicsFieldMutationInputStateEncoding === segment.expectedEncoding
        && artifact?.mechanicsFieldMutationOutputStateEncoding === segment.outputEncoding
      : stage === 'coarse-terminal'
        ? shared
          && artifact?.previousGridUpdate === priorArtifact
          && artifact?.mechanicsFieldMutationInputOrdinal === segment.expectedOrdinal
          && artifact?.mechanicsFieldMutationOutputOrdinal === segment.outputOrdinal
          && artifact?.mechanicsFieldMutationInputStateEncoding === segment.expectedEncoding
          && artifact?.mechanicsFieldMutationOutputStateEncoding === segment.outputEncoding
          && artifact?.parentFieldMechanicsTerminalSubmitted === true
        : stage === 'g2p'
          ? artifact?.fusedCoarseTerminalTransaction === transaction
            && artifact?.sourceGridUpdate === priorArtifact
            && artifact?.sourceParticleContinuation === origin.particleContinuation
            && artifact?.terminalMicroepochAuthority === origin.microepochAuthority
            && artifact?.proposalMode === 'proposal-deferred-to-post-mechanics'
            && artifact?.mechanicalProposalApplied === false
            && artifact?.stateBuffer
            && artifact?.mechanicsBuffer
          : false;
  if (!structural) return false;
  try {
    return validateExactStageProducer(stage, device, artifact, {
      terminalTransaction: transaction,
      macroAuthority: origin.macroAuthority,
      microepochAuthority: origin.microepochAuthority,
      particleContinuation: origin.particleContinuation,
      fieldExecution: origin.fieldView,
      mutationSegment: segment,
      priorArtifact,
      requireDeferred: true,
      proposalMode: 'proposal-deferred-to-post-mechanics'
    }) === true;
  } catch {
    return false;
  }
}

export function validateSchroederFusedCoarseTerminalTransaction(
  device,
  transaction,
  {
    stage = null,
    macroAuthority = null,
    microepochAuthority = null,
    particleContinuation = null,
    artifact = null
  } = {}
) {
  const origin = coarseTerminalTransactionOriginFor(device, transaction);
  if (!origin) return false;
  return origin.status !== 'discarded'
    && origin.status !== 'quarantined'
    && (macroAuthority == null || macroAuthority === origin.macroAuthority)
    && (microepochAuthority == null
      || microepochAuthority === origin.microepochAuthority)
    && (particleContinuation == null
      || particleContinuation === origin.particleContinuation)
    && (stage == null || (
      origin.submissionObservedStage === null
      && validateCoarseTerminalStage(origin, stage, artifact)
    ));
}

export function claimSchroederFusedCoarseTerminalStageProducer(
  device,
  transaction,
  { stage, priorArtifact = null } = {}
) {
  const origin = coarseTerminalTransactionOriginFor(device, transaction);
  if (
    !origin
    || origin.submissionObservedStage !== null
    || origin.stageProducerCapability !== null
    || !validateCoarseTerminalStage(origin, stage, priorArtifact)
  ) {
    throw new Error(
      'fused coarse-terminal stage already has a producer or is not ready'
    );
  }
  const capability = Object.freeze({
    schema: 'peercompute.ulg.schroeder-fused-stage-producer-capability.v1',
    stage
  });
  origin.stageProducerCapability = capability;
  return capability;
}

export function releaseSchroederFusedCoarseTerminalStageProducer(
  device,
  transaction,
  capability
) {
  const origin = rawCoarseTerminalTransactionOriginFor(device, transaction);
  if (!origin || origin.stageProducerCapability == null) return false;
  if (origin.stageProducerCapability !== capability) {
    throw new Error('fused coarse-terminal producer capability is stale or foreign');
  }
  if (origin.submissionObservedStage !== null) {
    throw new Error('an observed fused coarse-terminal producer cannot be released');
  }
  origin.stageProducerCapability = null;
  return true;
}

export function markSchroederFusedCoarseTerminalStageSubmissionObserved(
  device,
  transaction,
  { stage, producerCapability = null } = {}
) {
  const origin = rawCoarseTerminalTransactionOriginFor(device, transaction);
  const stageIndex = COARSE_TERMINAL_STAGE_ORDER.indexOf(stage);
  if (
    !origin
    || stageIndex < 0
    || origin.stageIndex !== stageIndex
    || origin.submissionObservedStage !== null
    || ((origin.stageProducerCapability !== null || producerCapability !== null)
      && origin.stageProducerCapability !== producerCapability)
  ) {
    throw new Error(
      'fused coarse-terminal submission observation is stale, foreign, or out of order'
    );
  }
  const priorArtifact = stageIndex > 0
    ? origin.artifacts[COARSE_TERMINAL_STAGE_ORDER[stageIndex - 1]]
    : null;
  const strictOrigin = coarseTerminalTransactionOriginFor(device, transaction);
  const strictProvenance = strictOrigin === origin
    && validateCoarseTerminalStage(origin, stage, priorArtifact);
  origin.submissionObservedStage = stage;
  origin.status = `${stage}-submitted-artifact-pending`;
  let observationError = null;
  try {
    if (stageIndex < origin.sequenceStages.length) {
      origin.fieldRuntime.markStateMutationSequenceStageSubmissionObserved(
        origin.mutationSequence,
        origin.sequenceStages[stageIndex]
      );
    }
  } catch (error) {
    observationError = error;
  }
  if (!strictProvenance || observationError) {
    const error = observationError ?? new Error(
      'fused coarse-terminal submission observation is stale, foreign, or out of order'
    );
    try {
      quarantineSchroederFusedCoarseTerminalTransaction(
        device,
        transaction,
        error
      );
    } catch {
      // Preserve the submission-observation error while the exact transaction
      // remains irreversibly poisoned for abort-ledger retirement.
    }
    throw error;
  }
  return true;
}

export function markSchroederFusedCoarseTerminalStageSubmitted(
  device,
  transaction,
  { stage, artifact, priorArtifact = null, producerCapability = null } = {}
) {
  const origin = coarseTerminalTransactionOriginFor(device, transaction);
  if (
    !origin
    || !artifact
    || ((origin.stageProducerCapability !== null || producerCapability !== null)
      && origin.stageProducerCapability !== producerCapability)
    || origin.submissionObservedStage !== stage
    || !validateCoarseTerminalStage(origin, stage, priorArtifact)
    || !coarseTerminalStageArtifactAdmitted(
      device,
      origin,
      stage,
      artifact,
      priorArtifact
    )
  ) {
    throw new Error(
      'fused coarse-terminal stage is stale, foreign, or out of order'
    );
  }
  const stageIndex = COARSE_TERMINAL_STAGE_ORDER.indexOf(stage);
  if (stageIndex < origin.sequenceStages.length) {
    origin.fieldRuntime.markStateMutationSequenceStageSubmitted(
      origin.mutationSequence,
      origin.sequenceStages[stageIndex]
    );
  } else {
    origin.fieldRuntime.completeStateMutationSequence(origin.mutationSequence);
  }
  origin.submissionObservedStage = null;
  origin.stageProducerCapability = null;
  origin.artifacts[stage] = artifact;
  origin.stageIndex += 1;
  origin.status = stage === 'g2p'
    ? 'g2p-submitted-unverified'
    : `${stage}-submitted`;
  origin.microepochOrigin.status = stage === 'g2p'
    ? 'terminal-g2p-submitted-unverified'
    : stage === 'coarse-terminal'
      ? 'terminal-reflux-submitted'
      : `terminal-${stage}-submitted`;
  return true;
}

export function claimSchroederFusedCoarseTerminalOutput(
  device,
  transaction,
  {
    g2pReconstruction = null,
    finalSphParticleUpload = null,
    finalMlsMpmParticleUpload = null
  } = {}
) {
  const origin = coarseTerminalTransactionOriginFor(device, transaction);
  if (
    !origin
    || origin.stageIndex !== COARSE_TERMINAL_STAGE_ORDER.length
    || origin.status !== 'g2p-submitted-unverified'
    || origin.outputClaimed === true
    || origin.artifacts.g2p !== g2pReconstruction
  ) {
    return false;
  }
  const claimed = claimLocallySubmittedMlsMpmFusedCoarseTerminalG2pOutput(
    device,
    g2pReconstruction,
    {
      terminalTransaction: transaction,
      finalSphParticleUpload,
      finalMlsMpmParticleUpload
    }
  );
  if (claimed !== true) return false;
  // These assignments are deliberately the only operations after the private
  // G2P ownership transfer. They cannot throw, and outputClaimed is published
  // last so the two registries commit as one visible step.
  origin.finalSphParticleUpload = finalSphParticleUpload;
  origin.finalMlsMpmParticleUpload = finalMlsMpmParticleUpload;
  origin.outputClaimed = true;
  return true;
}

export function claimSchroederFusedMechanicsPendingClosure({
  device,
  terminalTransaction,
  g2pReconstruction,
  finalSphParticleUpload,
  finalMlsMpmParticleUpload,
  terminalControllerEpoch,
  terminalSpatialEpochTransaction,
  terminalPrivateAdvanceReceipt,
  ownedThermoBuffer = null,
  retirementPrerequisites = []
} = {}) {
  const origin = coarseTerminalTransactionOriginFor(
    device,
    terminalTransaction
  );
  if (
    !origin
    || origin.stageIndex !== COARSE_TERMINAL_STAGE_ORDER.length
    || origin.status !== 'g2p-submitted-unverified'
    || origin.outputClaimed === true
    || origin.pendingClosure !== null
    || origin.artifacts.g2p !== g2pReconstruction
  ) {
    throw new Error(
      'Pending fused mechanics closure requires one exact unclaimed terminal G2P output'
    );
  }
  if (
    !terminalControllerEpoch
    || terminalControllerEpoch.generation
      !== origin.microepochOrigin.canonicalEpoch.generation
    || terminalControllerEpoch.transaction
      !== terminalSpatialEpochTransaction
    || terminalControllerEpoch.sphParticleUpload
      !== origin.particleContinuation.sphParticleUpload
    || terminalControllerEpoch.mlsMpmParticleUpload
      !== origin.particleContinuation.mlsMpmParticleUpload
  ) {
    throw new TypeError(
      'Pending fused mechanics closure requires the exact terminal controller epoch'
    );
  }
  if (!Array.isArray(retirementPrerequisites)) {
    throw new TypeError(
      'Pending fused mechanics closure retirement prerequisites must be an array'
    );
  }
  const normalizedRetirementPrerequisites = retirementPrerequisites.map(
    (prerequisite) => {
      if (prerequisite && typeof prerequisite.then === 'function') {
        return Object.freeze({
          completionPromise: prerequisite,
          retry: () => prerequisite,
          requiredOnAbandon: true,
          afterMacroAbandon: false,
          beforeDeviceLossMacroAbandon: false
        });
      }
      if (
        !prerequisite?.completionPromise
        || typeof prerequisite.completionPromise.then !== 'function'
        || typeof prerequisite.retry !== 'function'
      ) {
        throw new TypeError(
          'Pending fused mechanics closure retirement prerequisites require stable completion and retry capabilities'
        );
      }
      return Object.freeze({
        completionPromise: prerequisite.completionPromise,
        retry: prerequisite.retry,
        requiredOnAbandon: prerequisite.requiredOnAbandon !== false,
        afterMacroAbandon: prerequisite.afterMacroAbandon === true,
        beforeDeviceLossMacroAbandon:
          prerequisite.beforeDeviceLossMacroAbandon === true
      });
    }
  );
  if (ownedThermoBuffer != null && (
    finalSphParticleUpload?.ownsThermoBuffer !== true
    || finalSphParticleUpload?.thermoBuffer !== ownedThermoBuffer
    || ownedThermoBuffer === origin.macroOrigin?.thermoBuffer
  )) {
    throw new TypeError(
      'Pending fused mechanics closure received a foreign owned thermo buffer'
    );
  }
  const finalParticleUploads = Object.freeze({
    sphParticleUpload: finalSphParticleUpload,
    mlsMpmParticleUpload: finalMlsMpmParticleUpload
  });
  if (!validateSchroederSpatialEpochTransactionPrivateAdvance(
    terminalSpatialEpochTransaction,
    terminalPrivateAdvanceReceipt,
    {
      nextParticleUploads: finalParticleUploads,
      expectedGeneration: origin.microepochOrigin.canonicalEpoch.generation,
      sourceParticleUploads: {
        sphParticleUpload: origin.particleContinuation.sphParticleUpload,
        mlsMpmParticleUpload: origin.particleContinuation.mlsMpmParticleUpload
      }
    }
  )) {
    throw new TypeError(
      'Pending fused mechanics closure requires the exact terminal spatial private-advance receipt'
    );
  }
  let resolveCompletion;
  const completionPromise = new Promise((resolve) => {
    resolveCompletion = resolve;
  });
  const retirementPrerequisitePromise = Promise.all(
    normalizedRetirementPrerequisites.map(
      (prerequisite) => Promise.resolve(prerequisite.completionPromise)
    )
  ).then((confirmed) => {
    if (confirmed.some((value) => value !== true)) {
      throw new Error(
        'pending fused mechanics closure retirement prerequisite was not confirmed'
      );
    }
    return true;
  });
  retirementPrerequisitePromise.catch(() => {});
  const closure = Object.freeze({
    schema: ULG_SCHROEDER_FUSED_MECHANICS_PENDING_CLOSURE_SCHEMA,
    status: 'fused-mechanics-pending-post-mechanics-closure',
    deviceId: webGpuDeviceId(device),
    macroAuthority: origin.macroAuthority,
    terminalMicroepochAuthority: origin.microepochAuthority,
    terminalParticleContinuation: origin.particleContinuation,
    terminalTransaction,
    terminalSpatialEpochTransaction,
    terminalPrivateAdvanceReceipt,
    canonicalEpoch: terminalControllerEpoch,
    finalG2pReconstruction: g2pReconstruction,
    finalSphParticleUpload,
    finalMlsMpmParticleUpload,
    substepOrdinal: origin.substepOrdinal,
    rootGenerationId: origin.macroAuthority.rootGenerationId,
    currentGenerationId: origin.microepochAuthority.currentGenerationId,
    completionOrdinal: origin.macroAuthority.completionOrdinal,
    proposalMode: 'proposal-deferred-to-post-mechanics',
    retirementPrerequisitePromise,
    completionPromise
  });
  const lifecycle = {
    state: 'preparing-claim',
    completionPromise,
    resolveCompletion,
    publicationRetirementPromise: null,
    abortPromise: null,
    abortAttempt: null,
    failureReason: null
  };
  const closureOrigin = {
    deviceId: closure.deviceId,
    closure,
    terminalOrigin: origin,
    macroOrigin: origin.macroOrigin,
    microepochOrigin: origin.microepochOrigin,
    continuationOrigin: origin.continuationOrigin,
    macroAuthority: origin.macroAuthority,
    terminalMicroepochAuthority: origin.microepochAuthority,
    terminalParticleContinuation: origin.particleContinuation,
    terminalTransaction,
    terminalSpatialEpochTransaction,
    terminalPrivateAdvanceReceipt,
    canonicalEpoch: terminalControllerEpoch,
    finalG2pReconstruction: g2pReconstruction,
    finalSphParticleUpload,
    finalMlsMpmParticleUpload,
    ownedStateBuffer: finalSphParticleUpload.ownsStateBuffer === true
      ? finalSphParticleUpload.stateBuffer
      : null,
    ownedMechanicsBuffer:
      finalMlsMpmParticleUpload.ownsMechanicsBuffer === true
        ? finalMlsMpmParticleUpload.mechanicsBuffer
        : null,
    ownedThermoBuffer,
    destroyedOwnedParticleBuffers: new Set(),
    publicationReceipt: null,
    publicSpatialEpochTransaction: null,
    publicCommitReceipt: null,
    retirementPrerequisites: Object.freeze(normalizedRetirementPrerequisites),
    retirementPrerequisitePromise,
    finalUploadSnapshot: particleUploadSnapshot(
      finalSphParticleUpload,
      finalMlsMpmParticleUpload
    ),
    lifecycle
  };
  pendingClosureOrigins.set(closure, closureOrigin);
  const claimed = claimLocallySubmittedMlsMpmFusedCoarseTerminalG2pOutput(
    device,
    g2pReconstruction,
    {
      terminalTransaction,
      finalSphParticleUpload,
      finalMlsMpmParticleUpload
    }
  );
  if (claimed !== true) {
    pendingClosureOrigins.delete(closure);
    lifecycle.state = 'claim-rejected';
    resolveCompletion(false);
    throw new Error(
      'Pending fused mechanics closure could not claim the exact S* output'
    );
  }
  // Everything after the lower G2P ownership transfer is a non-throwing
  // registry/back-reference assignment. The public token and private origin
  // were completely prepared before the irreversible claim.
  origin.finalSphParticleUpload = finalSphParticleUpload;
  origin.finalMlsMpmParticleUpload = finalMlsMpmParticleUpload;
  origin.ownedThermoBuffer = ownedThermoBuffer;
  origin.pendingClosure = closure;
  origin.macroOrigin.pendingClosure = closure;
  lifecycle.state = 'pending-publication';
  origin.outputClaimed = true;
  return closure;
}

export const createSchroederFusedMechanicsPendingClosure =
  claimSchroederFusedMechanicsPendingClosure;

export function validateSchroederFusedMechanicsPendingClosure(
  device,
  closure,
  {
    terminalTransaction = null,
    finalSphParticleUpload = null,
    finalMlsMpmParticleUpload = null
  } = {}
) {
  const closureOrigin = pendingClosureOrigins.get(closure);
  const terminalOrigin = closureOrigin?.terminalOrigin;
  return Boolean(
    closureOrigin
    && closureOrigin.deviceId === webGpuDeviceId(device)
    && closure === closureOrigin.closure
    && closure.schema === ULG_SCHROEDER_FUSED_MECHANICS_PENDING_CLOSURE_SCHEMA
    && closure.status === 'fused-mechanics-pending-post-mechanics-closure'
    && closure.macroAuthority === closureOrigin.macroAuthority
    && closure.terminalMicroepochAuthority
      === closureOrigin.terminalMicroepochAuthority
    && closure.terminalParticleContinuation
      === closureOrigin.terminalParticleContinuation
    && closure.terminalTransaction === closureOrigin.terminalTransaction
    && closure.terminalSpatialEpochTransaction
      === closureOrigin.terminalSpatialEpochTransaction
    && closure.terminalPrivateAdvanceReceipt
      === closureOrigin.terminalPrivateAdvanceReceipt
    && closure.canonicalEpoch === closureOrigin.canonicalEpoch
    && closure.finalG2pReconstruction
      === closureOrigin.finalG2pReconstruction
    && closure.finalSphParticleUpload
      === closureOrigin.finalSphParticleUpload
    && closure.finalMlsMpmParticleUpload
      === closureOrigin.finalMlsMpmParticleUpload
    && closure.substepOrdinal === terminalOrigin?.substepOrdinal
    && closure.rootGenerationId === closureOrigin.macroAuthority.rootGenerationId
    && closure.currentGenerationId
      === closureOrigin.terminalMicroepochAuthority.currentGenerationId
    && closure.completionOrdinal
      === closureOrigin.macroAuthority.completionOrdinal
    && closure.proposalMode === 'proposal-deferred-to-post-mechanics'
    && closure.retirementPrerequisitePromise
      === closureOrigin.retirementPrerequisitePromise
    && closure.completionPromise === closureOrigin.lifecycle.completionPromise
    && closureOrigin.lifecycle.state === 'pending-publication'
    && terminalOrigin?.pendingClosure === closure
    && closureOrigin.macroOrigin?.pendingClosure === closure
    && terminalOrigin.stageIndex === COARSE_TERMINAL_STAGE_ORDER.length
    && terminalOrigin.status === 'g2p-submitted-unverified'
    && terminalOrigin.submissionObservedStage === null
    && terminalOrigin.stageProducerCapability === null
    && terminalOrigin.outputClaimed === true
    && terminalOrigin.finalSphParticleUpload
      === closureOrigin.finalSphParticleUpload
    && terminalOrigin.finalMlsMpmParticleUpload
      === closureOrigin.finalMlsMpmParticleUpload
    && terminalOrigin.artifacts.g2p === closureOrigin.finalG2pReconstruction
    && terminalOrigin.microepochOrigin?.status
      === 'terminal-g2p-submitted-unverified'
    && terminalOrigin.microepochOrigin?.transaction
      === closureOrigin.terminalTransaction
    && terminalOrigin.continuationOrigin?.ordinal === terminalOrigin.substepOrdinal
    && terminalOrigin.continuationOrigin?.consumedByTransaction
      === closureOrigin.terminalTransaction
    && terminalOrigin.substepOrdinal
      === closureOrigin.macroAuthority.fineSubstepCount
    && terminalOrigin.microepochOrigin?.fineFieldRuntime
      ?.isStatePublicationLockActive?.(
        terminalOrigin.microepochOrigin.fineFieldView,
        terminalOrigin.microepochOrigin.publicationLock
      ) === true
    && terminalOrigin.fieldRuntime?.isStatePublicationLockActive?.(
      terminalOrigin.fieldView,
      terminalOrigin.publicationLock
    ) === true
    && terminalOrigin.fieldRuntime?.stateMutationState?.(
      terminalOrigin.fieldView
    )?.ordinal === terminalOrigin.sequenceOutputOrdinal
    && terminalOrigin.fieldRuntime?.stateMutationState?.(
      terminalOrigin.fieldView
    )?.encoding === terminalOrigin.sequenceOutputEncoding
    && terminalOrigin.fieldRuntime?.stateMutationState?.(
      terminalOrigin.fieldView
    )?.pending === false
    && particleUploadsMatchSnapshot(
      closureOrigin.finalSphParticleUpload,
      closureOrigin.finalMlsMpmParticleUpload,
      closureOrigin.finalUploadSnapshot,
      device
    )
    && validateSchroederSpatialEpochTransactionPrivateAdvance(
      closureOrigin.terminalSpatialEpochTransaction,
      closureOrigin.terminalPrivateAdvanceReceipt,
      {
        nextParticleUploads: {
          sphParticleUpload: closureOrigin.finalSphParticleUpload,
          mlsMpmParticleUpload: closureOrigin.finalMlsMpmParticleUpload
        },
        expectedGeneration:
          closureOrigin.microepochOrigin.canonicalEpoch.generation,
        sourceParticleUploads: {
          sphParticleUpload:
            closureOrigin.terminalParticleContinuation.sphParticleUpload,
          mlsMpmParticleUpload:
            closureOrigin.terminalParticleContinuation.mlsMpmParticleUpload
        }
      }
    )
    && closureOrigin.finalSphParticleUpload.stateBuffer
      !== closureOrigin.terminalParticleContinuation.stateBuffer
    && closureOrigin.finalMlsMpmParticleUpload.mechanicsBuffer
      !== closureOrigin.terminalParticleContinuation.mechanicsBuffer
    && validateClaimedLocallySubmittedMlsMpmFusedCoarseTerminalG2pOutput(
      device,
      closureOrigin.finalG2pReconstruction,
      {
        terminalTransaction: closureOrigin.terminalTransaction,
        finalSphParticleUpload: closureOrigin.finalSphParticleUpload,
        finalMlsMpmParticleUpload: closureOrigin.finalMlsMpmParticleUpload
      }
    )
    && coarseTerminalTransactionOriginFor(
      device,
      closureOrigin.terminalTransaction
    ) === terminalOrigin
    && (terminalTransaction == null
      || terminalTransaction === closureOrigin.terminalTransaction)
    && (finalSphParticleUpload == null
      || finalSphParticleUpload === closureOrigin.finalSphParticleUpload)
    && (finalMlsMpmParticleUpload == null
      || finalMlsMpmParticleUpload === closureOrigin.finalMlsMpmParticleUpload)
  );
}

export function createSchroederFusedTerminalRefluxReceiptTarget({
  device,
  scheduleId,
  laneId,
  stateKey,
  stepOrdinal,
  targetBuffer,
  targetOffsetBytes,
  expectedCompletionOrdinal,
  expectedFineSubstepCount,
  expectedFineLevel,
  expectedCoarseLevel
} = {}) {
  const byteLength = SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_BYTE_LENGTH;
  const resolvedStepOrdinal = Number(stepOrdinal);
  const resolvedOffset = Number(targetOffsetBytes);
  const usage = Number(targetBuffer?.usage);
  if (
    !device
    || typeof scheduleId !== 'string'
    || scheduleId.length === 0
    || typeof laneId !== 'string'
    || laneId.length === 0
    || typeof stateKey !== 'string'
    || stateKey.length === 0
    || !Number.isSafeInteger(resolvedStepOrdinal)
    || resolvedStepOrdinal < 1
    || !Number.isSafeInteger(resolvedOffset)
    || resolvedOffset !== (resolvedStepOrdinal - 1) * byteLength
    || !targetBuffer
    || webGpuBufferDevice(targetBuffer) !== device
    || targetBuffer.mapState !== 'unmapped'
    || !Number.isSafeInteger(usage)
    || (usage & (GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST))
      !== (GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST)
    || Number(targetBuffer.size) < resolvedOffset + byteLength
    || !Number.isSafeInteger(Number(expectedCompletionOrdinal))
    || !Number.isSafeInteger(Number(expectedFineSubstepCount))
    || Number(expectedFineSubstepCount) < 1
    || !Number.isInteger(Number(expectedFineLevel))
    || !Number.isInteger(Number(expectedCoarseLevel))
  ) {
    throw new TypeError(
      'terminal reflux receipt target requires one exact unmapped schedule ring slot'
    );
  }
  let bufferOrigin = terminalRefluxReceiptTargetBuffers.get(targetBuffer);
  if (!bufferOrigin) {
    bufferOrigin = {
      deviceId: webGpuDeviceId(device),
      scheduleId,
      laneId,
      stateKey,
      reservedOffsets: new Set()
    };
    terminalRefluxReceiptTargetBuffers.set(targetBuffer, bufferOrigin);
  }
  if (
    bufferOrigin.deviceId !== webGpuDeviceId(device)
    || bufferOrigin.scheduleId !== scheduleId
    || bufferOrigin.laneId !== laneId
    || bufferOrigin.stateKey !== stateKey
    || bufferOrigin.reservedOffsets.has(resolvedOffset)
  ) {
    throw new Error(
      'terminal reflux receipt target ring identity or slot reservation is stale'
    );
  }
  const target = Object.freeze({
    schema: ULG_SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_TARGET_SCHEMA,
    scheduleId,
    laneId,
    stateKey,
    stepOrdinal: resolvedStepOrdinal,
    targetBuffer,
    targetOffsetBytes: resolvedOffset,
    targetByteLength: byteLength,
    expectedCompletionOrdinal: Number(expectedCompletionOrdinal),
    expectedFineSubstepCount: Number(expectedFineSubstepCount),
    expectedFineLevel: Number(expectedFineLevel),
    expectedCoarseLevel: Number(expectedCoarseLevel)
  });
  const origin = {
    target,
    deviceId: webGpuDeviceId(device),
    scheduleId,
    laneId,
    stateKey,
    stepOrdinal: resolvedStepOrdinal,
    targetBuffer,
    targetOffsetBytes: resolvedOffset,
    targetByteLength: byteLength,
    expectedCompletionOrdinal: Number(expectedCompletionOrdinal),
    expectedFineSubstepCount: Number(expectedFineSubstepCount),
    expectedFineLevel: Number(expectedFineLevel),
    expectedCoarseLevel: Number(expectedCoarseLevel),
    consumed: false
  };
  terminalRefluxReceiptTargetOrigins.set(target, origin);
  bufferOrigin.reservedOffsets.add(resolvedOffset);
  return target;
}

/**
 * Queue one compact, schedule-owned copy of the exact terminal reflux header.
 *
 * The caller is deliberately unable to select a reflux source: the source is
 * recovered from the module-private pending-closure origin. The returned
 * receipt contains only cloneable scalar provenance; it is not authority by
 * itself. Authority is established after the schedule terminal fence maps and
 * decodes the copied header.
 */
export function encodeSchroederFusedTerminalRefluxReceiptCopy(
  device,
  closure,
  target
) {
  const closureOrigin = pendingClosureOrigins.get(closure);
  const macroAuthority = closureOrigin?.macroAuthority ?? null;
  const refluxLedger = macroAuthority?.refluxLedger ?? null;
  const targetOrigin = terminalRefluxReceiptTargetOrigins.get(target);
  const byteLength = SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_BYTE_LENGTH;
  const targetBuffer = targetOrigin?.targetBuffer ?? null;
  const targetOffsetBytes = Number(targetOrigin?.targetOffsetBytes);
  const stepOrdinal = Number(targetOrigin?.stepOrdinal);
  const expectedCompletionOrdinal = Number(
    targetOrigin?.expectedCompletionOrdinal
  );
  const expectedFineSubstepCount = Number(
    targetOrigin?.expectedFineSubstepCount
  );
  const expectedFineLevel = Number(targetOrigin?.expectedFineLevel);
  const expectedCoarseLevel = Number(targetOrigin?.expectedCoarseLevel);
  const targetUsage = Number(targetBuffer?.usage);
  if (
    !validateSchroederFusedMechanicsPendingClosure(device, closure)
    || closureOrigin?.terminalRefluxReceiptCopy != null
    || !targetOrigin
    || targetOrigin.target !== target
    || targetOrigin.deviceId !== webGpuDeviceId(device)
    || targetOrigin.consumed === true
    || !Object.isFrozen(target)
    || target?.schema
      !== ULG_SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_TARGET_SCHEMA
    || typeof target.scheduleId !== 'string'
    || target.scheduleId.length === 0
    || typeof target.laneId !== 'string'
    || target.laneId.length === 0
    || typeof target.stateKey !== 'string'
    || target.stateKey.length === 0
    || !Number.isSafeInteger(stepOrdinal)
    || stepOrdinal < 1
    || !Number.isSafeInteger(targetOffsetBytes)
    || targetOffsetBytes < 0
    || targetOffsetBytes % UINT32_BYTES !== 0
    || targetOffsetBytes !== (stepOrdinal - 1) * byteLength
    || Number(target.targetByteLength) !== byteLength
    || !targetBuffer
    || targetBuffer.destroyed === true
    || webGpuBufferDevice(targetBuffer) !== device
    || targetBuffer.mapState !== 'unmapped'
    || targetBuffer === refluxLedger?.buffer
    || Number(targetBuffer.size) < targetOffsetBytes + byteLength
    || !Number.isSafeInteger(targetUsage)
    || (targetUsage & (GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST))
      !== (GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST)
    || !Number.isSafeInteger(expectedCompletionOrdinal)
    || expectedCompletionOrdinal !== macroAuthority?.completionOrdinal
    || !Number.isSafeInteger(expectedFineSubstepCount)
    || expectedFineSubstepCount !== macroAuthority?.fineSubstepCount
    || !Number.isSafeInteger(expectedFineLevel)
    || expectedFineLevel !== macroAuthority?.fineLevel
    || !Number.isSafeInteger(expectedCoarseLevel)
    || expectedCoarseLevel !== macroAuthority?.coarseLevel
    || refluxLedger?.evidenceBuffer !== refluxLedger?.buffer
    || refluxLedger?.evidenceOffsetBytes !== 0
    || refluxLedger?.evidenceByteLength !== byteLength
    || validateLocallyOwnedSchroederCrossLevelRefluxLedgerGpu(
      device,
      refluxLedger,
      {
        minimumCoarseFieldCapacity:
          macroAuthority.parentFieldView.coarseFieldCapacity,
        fineSubstepCount: expectedFineSubstepCount,
        fineLevel: expectedFineLevel,
        coarseLevel: expectedCoarseLevel,
        coarseGridSpacingM:
          macroAuthority.parentFieldView.coarseFieldView.gridSpacingM
      }
    ) !== true
    || typeof device?.createCommandEncoder !== 'function'
    || typeof device?.queue?.submit !== 'function'
  ) {
    const error = new Error(
      'terminal reflux receipt copy requires one exact live fused closure and schedule-owned target'
    );
    error.code = 'ERR_SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_TARGET';
    throw error;
  }
  const encoder = device.createCommandEncoder({
    label: `ulg-schroeder-terminal-reflux-receipt-${target.scheduleId}-${stepOrdinal}`
  });
  encoder.copyBufferToBuffer(
    refluxLedger.evidenceBuffer,
    refluxLedger.evidenceOffsetBytes,
    targetBuffer,
    targetOffsetBytes,
    byteLength
  );
  device.queue.submit([encoder.finish()]);
  const receipt = Object.freeze({
    schema: ULG_SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_COPY_SCHEMA,
    status: 'terminal-reflux-header-copy-submitted-unverified',
    scheduleId: target.scheduleId,
    laneId: target.laneId,
    stateKey: target.stateKey,
    stepOrdinal,
    targetOffsetBytes,
    targetByteLength: byteLength,
    completionOrdinal: macroAuthority.completionOrdinal,
    macroOwnerId: refluxLedger.macroOwnerId,
    ownerGeneration: refluxLedger.ownerGeneration,
    fineSubstepCount: macroAuthority.fineSubstepCount,
    fineLevel: macroAuthority.fineLevel,
    coarseLevel: macroAuthority.coarseLevel,
    queueSubmissionStatus: 'copy-submitted-unverified'
  });
  targetOrigin.consumed = true;
  closureOrigin.terminalRefluxReceiptCopy = receipt;
  return receipt;
}

export function publishSchroederFusedMechanicsPendingClosure(
  device,
  closure,
  {
    publicSpatialEpochTransaction,
    publicCommitReceipt,
    publicSphParticleUpload,
    publicMlsMpmParticleUpload,
    publishedSphParticleUpload,
    publishedMlsMpmParticleUpload
  } = {}
) {
  const closureOrigin = pendingClosureOrigins.get(closure);
  const terminalOrigin = closureOrigin?.terminalOrigin;
  const fineOrigin = closureOrigin?.microepochOrigin;
  const publicGeneration = publicSpatialEpochTransaction?.generation ?? null;
  const finalSph = closureOrigin?.finalSphParticleUpload;
  const finalMls = closureOrigin?.finalMlsMpmParticleUpload;
  const nextTick = Number(finalSph?.physicsTick) + 1;
  if (
    !validateSchroederFusedMechanicsPendingClosure(device, closure)
    || closureOrigin.lifecycle.state !== 'pending-publication'
    || !Number.isSafeInteger(nextTick)
    || nextTick > 0xffff_ffff
    || publicSphParticleUpload?.physicsTick !== nextTick
    || publicSphParticleUpload?.physicsSubstep !== 0
    || publicMlsMpmParticleUpload?.physicsTick !== nextTick
    || publicMlsMpmParticleUpload?.physicsSubstep !== 0
    || publicSphParticleUpload?.positionEpoch !== finalSph.positionEpoch
    || publicMlsMpmParticleUpload?.positionEpoch !== finalMls.positionEpoch
    || publicSphParticleUpload?.stateBuffer !== finalSph.stateBuffer
    || publicSphParticleUpload?.thermoBuffer !== finalSph.thermoBuffer
    || publicSphParticleUpload?.identityBuffer !== finalSph.identityBuffer
    || publicMlsMpmParticleUpload?.mechanicsBuffer !== finalMls.mechanicsBuffer
    || publicGeneration?.selected !== true
    || publicGeneration?.ready !== true
    || publicGeneration?.execution?.physicsTick !== nextTick
    || publicGeneration?.execution?.physicsSubstep !== 0
    || publicGeneration?.source?.sourceStateBuffer !== finalSph.stateBuffer
    || !validateSchroederSpatialEpochTransactionCommit(
      publicSpatialEpochTransaction,
      publicCommitReceipt,
      {
        nextParticleUploads: {
          sphParticleUpload: publishedSphParticleUpload,
          mlsMpmParticleUpload: publishedMlsMpmParticleUpload
        },
        expectedGeneration: publicGeneration,
        sourceParticleUploads: {
          sphParticleUpload: publicSphParticleUpload,
          mlsMpmParticleUpload: publicMlsMpmParticleUpload
        }
      }
    )
  ) {
    const error = new Error(
      'fused mechanics publication requires one exact committed public E* family'
    );
    error.code = 'ERR_SCHROEDER_FUSED_PUBLICATION_EPOCH_STALE';
    throw error;
  }
  const targetSpecs = [
    {
      role: 'terminal-fine-field',
      runtime: fineOrigin?.fineFieldRuntime,
      execution: fineOrigin?.fineFieldView,
      publicationLock: fineOrigin?.publicationLock
    },
    {
      role: 'terminal-coarse-field',
      runtime: terminalOrigin?.fieldRuntime,
      execution: terminalOrigin?.fieldView,
      publicationLock: terminalOrigin?.publicationLock
    }
  ];
  const targets = targetSpecs.map((target) => {
    const mutation = target.runtime?.stateMutationState?.(target.execution);
    if (
      typeof target.runtime?.mintStatePublicationCapability !== 'function'
      || typeof target.runtime?.promoteStatePublicationLock !== 'function'
      || target.runtime.isStatePublicationLockActive?.(
        target.execution,
        target.publicationLock
      ) !== true
      || !Number.isSafeInteger(mutation?.ordinal)
      || !Number.isSafeInteger(mutation?.encoding)
      || mutation?.pending === true
      || mutation?.quarantined === true
    ) {
      const error = new Error(
        `${target.role} cannot be promoted into the public E* lineage`
      );
      error.code = 'ERR_SCHROEDER_FUSED_PUBLICATION_FIELD_STALE';
      throw error;
    }
    return {
      ...target,
      mutationOrdinal: mutation.ordinal,
      stateEncoding: mutation.encoding,
      capability: null
    };
  });
  const closureOrdinal = exactU32(
    closureOrigin.macroAuthority.completionOrdinal,
    'closure.completionOrdinal'
  );
  const receipt = Object.freeze({
    schema: 'peercompute.ulg.schroeder-mechanics-field-publication-receipt.v0',
    status: 'macro-closure-gpu-verified-private',
    particlePublicationAllowed: true,
    closure,
    publicSpatialEpochTransaction,
    publicCommitReceipt,
    publicGenerationId: publicGeneration.execution.generationId,
    closureOrdinal
  });
  const receiptOrigin = {
    deviceId: webGpuDeviceId(device),
    receipt,
    closureOrigin,
    publicSpatialEpochTransaction,
    publicCommitReceipt,
    publicGeneration,
    publicSphParticleUpload,
    publicMlsMpmParticleUpload,
    publishedSphParticleUpload,
    publishedMlsMpmParticleUpload,
    closureOrdinal,
    targets
  };
  closureOrigin.lifecycle.state = 'publication-preparing';
  mechanicsFieldPublicationReceiptOrigins.set(receipt, receiptOrigin);
  try {
    for (const target of targets) {
      target.capability = target.runtime.mintStatePublicationCapability(
        target.execution,
        target.publicationLock,
        {
          terminalClosureReceipt: receipt,
          closureOrdinal
        }
      );
    }
    for (const target of targets) {
      target.runtime.promoteStatePublicationLock(
        target.execution,
        target.publicationLock,
        target.capability
      );
    }
  } catch (error) {
    closureOrigin.lifecycle.state = 'publication-blocked';
    closureOrigin.lifecycle.failureReason = error instanceof Error
      ? error.message
      : String(error);
    throw error;
  }
  closureOrigin.publicationReceipt = receipt;
  closureOrigin.publicSpatialEpochTransaction = publicSpatialEpochTransaction;
  closureOrigin.publicCommitReceipt = publicCommitReceipt;
  closureOrigin.lifecycle.failureReason = null;
  closureOrigin.lifecycle.state = 'published-pending-retirement';
  fineOrigin.status = 'terminal-field-promoted-to-public-epoch';
  terminalOrigin.status = 'terminal-field-promoted-to-public-epoch';
  closureOrigin.macroOrigin.terminalStatus =
    'mechanics-macro-published-pending-retirement';
  return receipt;
}

export function validateSchroederFusedMechanicsPublicationReceipt(
  device,
  receipt,
  {
    closure = null,
    publicSpatialEpochTransaction = null,
    publicCommitReceipt = null
  } = {}
) {
  const origin = mechanicsFieldPublicationReceiptOrigins.get(receipt);
  const lifecycleState = origin?.closureOrigin?.lifecycle?.state;
  return Boolean(
    origin
    && origin.deviceId === webGpuDeviceId(device)
    && origin.receipt === receipt
    && origin.closureOrigin?.publicationReceipt === receipt
    && [
      'published-pending-retirement',
      'publication-retiring',
      'publication-retirement-blocked',
      'published-retired'
    ].includes(lifecycleState)
    && (closure == null || closure === origin.closureOrigin.closure)
    && (publicSpatialEpochTransaction == null
      || publicSpatialEpochTransaction === origin.publicSpatialEpochTransaction)
    && (publicCommitReceipt == null
      || publicCommitReceipt === origin.publicCommitReceipt)
  );
}

export function completeSchroederFusedMechanicsPendingClosureAfter(
  device,
  closure,
  {
    publicationReceipt,
    after
  } = {}
) {
  const closureOrigin = pendingClosureOrigins.get(closure);
  const lifecycle = closureOrigin?.lifecycle;
  if (
    !closureOrigin
    || closureOrigin.deviceId !== webGpuDeviceId(device)
    || !validateSchroederFusedMechanicsPublicationReceipt(
      device,
      publicationReceipt,
      { closure }
    )
  ) {
    throw new Error('positive fused mechanics closure completion is stale');
  }
  if (lifecycle.state === 'published-retired') {
    return lifecycle.completionPromise;
  }
  if (lifecycle.publicationRetirementPromise) {
    return lifecycle.publicationRetirementPromise;
  }
  if (!after || typeof after.then !== 'function') {
    throw new TypeError(
      'positive fused mechanics closure requires the controller owner fence'
    );
  }
  lifecycle.state = 'publication-retiring';
  lifecycle.failureReason = null;
  const controllerFence = Promise.resolve(after).then((confirmed) => {
    if (confirmed !== true) {
      throw new Error('public E* controller retirement was not confirmed');
    }
    return true;
  });
  const refluxLedgerRetirement = retireMacroRefluxLedgerAfterFence(
    closureOrigin.macroOrigin,
    controllerFence
  );
  const terminalContinuationRetirement = retireContinuationOutputAfterFence(
    closureOrigin.continuationOrigin,
    controllerFence
  );
  const publicationRetirementPromise = Promise.all([
    controllerFence,
    closureOrigin.retirementPrerequisitePromise,
    refluxLedgerRetirement,
    terminalContinuationRetirement
  ]).then((confirmed) => {
    if (confirmed.some((value) => value !== true)) {
      throw new Error(
        'positive fused mechanics closure retirement was not fully confirmed'
      );
    }
    const publicationOrigin = mechanicsFieldPublicationReceiptOrigins.get(
      publicationReceipt
    );
    const preserved = new Set([
      publicationOrigin?.publishedSphParticleUpload?.stateBuffer,
      publicationOrigin?.publishedSphParticleUpload?.thermoBuffer,
      publicationOrigin?.publishedSphParticleUpload?.identityBuffer,
      publicationOrigin?.publishedMlsMpmParticleUpload?.mechanicsBuffer
    ].filter(Boolean));
    const supersededOwnedBuffers = new Set([
      closureOrigin.ownedStateBuffer,
      closureOrigin.ownedThermoBuffer,
      closureOrigin.ownedMechanicsBuffer
    ].filter((buffer) => (
      buffer
      && !preserved.has(buffer)
      && !closureOrigin.destroyedOwnedParticleBuffers.has(buffer)
    )));
    for (const buffer of supersededOwnedBuffers) {
      try {
        buffer.destroy?.();
        closureOrigin.destroyedOwnedParticleBuffers.add(buffer);
      } catch (error) {
        if (buffer.destroyed === true) {
          closureOrigin.destroyedOwnedParticleBuffers.add(buffer);
        } else {
          throw error;
        }
      }
    }
    closureOrigin.terminalOrigin.pendingClosure = null;
    closureOrigin.macroOrigin.pendingClosure = null;
    closureOrigin.terminalOrigin.status = 'terminal-publication-retired';
    closureOrigin.microepochOrigin.status = 'terminal-publication-retired';
    closureOrigin.macroOrigin.rootRetired = true;
    closureOrigin.macroOrigin.terminalStatus =
      'mechanics-macro-published-retired';
    lifecycle.state = 'published-retired';
    lifecycle.failureReason = null;
    lifecycle.publicationRetirementPromise = null;
    lifecycle.resolveCompletion(true);
    return true;
  }).catch((error) => {
    lifecycle.state = 'publication-retirement-blocked';
    lifecycle.failureReason = error instanceof Error
      ? error.message
      : String(error);
    lifecycle.publicationRetirementPromise = null;
    throw error;
  });
  lifecycle.publicationRetirementPromise = publicationRetirementPromise;
  publicationRetirementPromise.catch(() => {});
  return publicationRetirementPromise;
}

export function abandonSchroederFusedMechanicsPendingClosureAfter(
  device,
  closure,
  {
    reason = null,
    deviceLost = false
  } = {}
) {
  const closureOrigin = pendingClosureOrigins.get(closure);
  if (
    !closureOrigin
    || closureOrigin.deviceId !== webGpuDeviceId(device)
  ) {
    throw new Error('pending fused mechanics closure abandonment is stale');
  }
  if (closureOrigin.lifecycle.abortPromise) {
    if (
      deviceLost !== true
      || closureOrigin.lifecycle.abortAttempt?.mode === 'device-loss'
    ) {
      return closureOrigin.lifecycle.abortPromise;
    }
    closureOrigin.lifecycle.abortPromise.catch(() => {});
  }
  if (![
    'pending-publication',
    'abandonment-blocked',
    ...(deviceLost === true ? ['abandoning'] : [])
  ].includes(closureOrigin.lifecycle.state)) {
    throw new Error('pending fused mechanics closure abandonment is stale');
  }
  closureOrigin.lifecycle.state = 'abandoning';
  closureOrigin.lifecycle.failureReason = null;
  const abortAttempt = {
    mode: deviceLost === true ? 'device-loss' : 'queue-fence',
    promise: null
  };
  closureOrigin.lifecycle.abortAttempt = abortAttempt;
  const retryPrerequisites = (
    afterMacroAbandon,
    { deviceLossPreflight = false } = {}
  ) => Promise.all(
    closureOrigin.retirementPrerequisites
      .filter((prerequisite) => (
        prerequisite.requiredOnAbandon
        && (deviceLossPreflight
          ? prerequisite.beforeDeviceLossMacroAbandon === true
          : prerequisite.beforeDeviceLossMacroAbandon !== true
            && prerequisite.afterMacroAbandon === afterMacroAbandon)
      ))
      .map((prerequisite) => (
        Promise.resolve().then(() => prerequisite.retry({
          deviceLost,
          reason
        }))
      ))
  );
  const deviceLossPreflight = deviceLost === true
    ? retryPrerequisites(false, { deviceLossPreflight: true })
    : Promise.resolve([]);
  const prerequisiteRetirement = deviceLossPreflight.then(
    () => retryPrerequisites(false)
  );
  const abortPromise = prerequisiteRetirement.then((confirmed) => {
    if (confirmed.some((retired) => retired !== true)) {
      throw new Error(
        'pending closure abandonment prerequisites were not confirmed'
      );
    }
    return true;
  }).then(() => (
    abortSchroederTwoLevelMacroAuthorityAfter(
      device,
      closureOrigin.macroAuthority,
      {
        microepochAuthority: closureOrigin.terminalMicroepochAuthority,
        reason,
        deviceLost
      }
    )
  )).then((retired) => {
    if (retired !== true) {
      throw new Error('pending closure macro abandonment was not confirmed');
    }
    return retryPrerequisites(true);
  }).then((confirmed) => {
    if (confirmed.some((retired) => retired !== true)) {
      throw new Error(
        'pending closure post-macro abandonment prerequisites were not confirmed'
      );
    }
    return true;
  }).then(
    (retired) => {
      if (retired !== true) {
        throw new Error('pending closure abandonment was not confirmed');
      }
      if (closureOrigin.lifecycle.abortAttempt === abortAttempt) {
        closureOrigin.lifecycle.state = 'abandoned-retired';
        closureOrigin.lifecycle.abortPromise = null;
        closureOrigin.lifecycle.abortAttempt = null;
        closureOrigin.lifecycle.resolveCompletion(false);
      }
      return true;
    },
    (error) => {
      if (closureOrigin.lifecycle.abortAttempt !== abortAttempt) {
        return closureOrigin.lifecycle.abortPromise ?? false;
      }
      closureOrigin.lifecycle.state = 'abandonment-blocked';
      closureOrigin.lifecycle.failureReason = error instanceof Error
        ? error.message
        : String(error);
      closureOrigin.lifecycle.abortPromise = null;
      closureOrigin.lifecycle.abortAttempt = null;
      throw error;
    }
  );
  abortAttempt.promise = abortPromise;
  closureOrigin.lifecycle.abortPromise = abortPromise;
  abortPromise.catch(() => {});
  return abortPromise;
}

export function discardSchroederFusedCoarseTerminalTransaction(
  device,
  transaction,
  { discardedEncoder = false } = {}
) {
  const origin = rawCoarseTerminalTransactionOriginFor(device, transaction);
  if (
    !origin
    || origin.stageIndex !== 0
    || origin.submissionObservedStage !== null
    || origin.stageProducerCapability !== null
    || !['reserved', 'discard-pending'].includes(origin.status)
  ) {
    throw new Error(
      'only an unsubmitted fused coarse-terminal transaction can be discarded'
    );
  }
  origin.status = 'discard-pending';
  const errors = [];
  if (!origin.discardCleanup.sequence) {
    try {
      const discarded = origin.fieldRuntime.discardStateMutationSequence(
        origin.mutationSequence,
        { discardedEncoder }
      );
      if (discarded !== true) {
        throw new Error('coarse-terminal mutation sequence discard was not confirmed');
      }
      origin.discardCleanup.sequence = true;
    } catch (error) {
      try {
        if (origin.fieldRuntime.stateMutationState(origin.fieldView)?.pending === false) {
          origin.discardCleanup.sequence = true;
        } else {
          errors.push(error);
        }
      } catch {
        errors.push(error);
      }
    }
  }
  if (origin.discardCleanup.sequence
      && !origin.discardCleanup.publicationLock) {
    try {
      const discarded = origin.fieldRuntime.discardStatePublicationLock(
        origin.fieldView,
        origin.publicationLock
      );
      if (discarded !== true) {
        throw new Error('coarse-terminal publication-lock discard was not confirmed');
      }
      origin.discardCleanup.publicationLock = true;
    } catch (error) {
      try {
        if (origin.fieldRuntime.isStatePublicationLockActive(
          origin.fieldView,
          origin.publicationLock
        ) !== true) {
          origin.discardCleanup.publicationLock = true;
        } else {
          errors.push(error);
        }
      } catch {
        errors.push(error);
      }
    }
  }
  if (errors.length > 0) {
    throw aggregateAbortErrors(
      errors,
      'fused coarse-terminal discard was incomplete'
    );
  }
  origin.status = 'discarded';
  origin.macroOrigin.terminalTransaction = null;
  origin.microepochOrigin.transaction = null;
  origin.microepochOrigin.status = 'private-ready';
  origin.microepochOrigin.abortRetirement.coarse.required = false;
  origin.continuationOrigin.consumedByTransaction = null;
  return true;
}

export function quarantineSchroederFusedCoarseTerminalTransaction(
  device,
  transaction,
  reason = null
) {
  const origin = rawCoarseTerminalTransactionOriginFor(device, transaction);
  if (
    !origin
    || (origin.stageIndex === 0 && origin.submissionObservedStage === null)
    || origin.status === 'quarantined'
  ) {
    throw new Error(
      'only a submitted fused coarse-terminal transaction can be quarantined'
    );
  }
  origin.status = 'quarantined';
  origin.quarantineReason = reason ?? null;
  origin.stageProducerCapability = null;
  origin.microepochOrigin.status = 'quarantined';
  origin.microepochOrigin.quarantineReason = reason ?? null;
  origin.macroOrigin.terminalStatus = 'mechanics-macro-terminal-quarantined';
  const errors = [];
  try {
    if (origin.stageIndex < COARSE_TERMINAL_STAGE_ORDER.length) {
      origin.fieldRuntime.quarantineStateMutationSequence(
        origin.mutationSequence,
        reason
      );
    } else {
      origin.fieldRuntime.quarantineCurrentStateArtifact(origin.fieldView, {
        mutationOrdinal: origin.sequenceOutputOrdinal,
        stateEncoding: origin.sequenceOutputEncoding,
        reason
      });
    }
  } catch (error) {
    errors.push(error);
  }
  const ledger = origin.microepochOrigin.abortRetirement;
  for (const field of [{
    side: ledger.coarse,
    runtime: origin.fieldRuntime,
    field: origin.fieldView,
    reason
  }, {
    side: ledger.fine,
    runtime: origin.microepochOrigin.fineFieldRuntime,
    field: origin.microepochOrigin.fineFieldView,
    reason
  }]) {
    try {
      ensureAbortFieldQuarantined(field);
    } catch (error) {
      errors.push(error);
    }
  }
  const quarantineError = errors.length > 0
    ? aggregateAbortErrors(
        errors,
        'fused coarse-terminal quarantine was incomplete'
      )
    : null;
  origin.quarantineReason = reason ?? quarantineError;
  origin.microepochOrigin.quarantineReason = reason ?? quarantineError;
  if (quarantineError) throw quarantineError;
  return true;
}

export function schroederFusedCoarseTerminalTransactionState(
  device,
  transaction
) {
  const origin = coarseTerminalTransactionOriginFor(
    device,
    transaction,
    { requireLive: false }
  );
  if (!origin) return null;
  return Object.freeze({
    status: origin.status,
    stageIndex: origin.stageIndex,
    submissionObservedStage: origin.submissionObservedStage,
    nextStage: COARSE_TERMINAL_STAGE_ORDER[origin.stageIndex] ?? null,
    submittedStageCount: Math.min(origin.stageIndex, 3),
    g2pSubmitted: origin.stageIndex === COARSE_TERMINAL_STAGE_ORDER.length,
    outputClaimed: origin.outputClaimed,
    gpuReceiptStatus: origin.submissionObservedStage !== null
      ? 'submission-observed-artifact-pending'
      : origin.stageIndex === COARSE_TERMINAL_STAGE_ORDER.length
        ? 'submitted-unverified'
        : 'not-submitted',
    quarantineReason: origin.quarantineReason
  });
}

export const SCHROEDER_FUSED_COARSE_TERMINAL_STAGE_ORDER =
  COARSE_TERMINAL_STAGE_ORDER;
