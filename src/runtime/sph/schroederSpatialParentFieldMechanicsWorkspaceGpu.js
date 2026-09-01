import {
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ATOMIC_SCALE,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PARAMS_BYTES,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_WORKGROUP_SIZE,
  ULG_SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_SCHEMA,
  createSchroederSpatialParentFieldMechanicsWorkspaceLayout,
  createSchroederSpatialParentFieldMechanicsWorkspacePlan
} from '../../../ulg-gpu-abi/src/schroederSpatialParentFieldMechanicsWorkspace.js';
import {
  schroederSpatialParentFieldMechanicsWorkspaceWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialParentFieldMechanicsWorkspaceWgsl.js';
import {
  SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS,
  ULG_SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_SCHEMA,
  createSchroederCrossLevelRefluxLedgerHeader,
  createSchroederCrossLevelRefluxLedgerLayout
} from '../../../ulg-gpu-abi/src/schroederCrossLevelRefluxLedger.js';
import {
  ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_COARSE_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_FINE_DISPATCH_OFFSET_WORDS,
  validateSchroederSpatialParentFieldViewDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialParentFieldView.js';
import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
  ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';
import {
  validateLocallySubmittedMlsMpmMechanicsFieldGridUpdate,
  validateSubmittedMlsMpmMechanicsFieldGridUpdate
} from './sphGridUpdateGpuKernel.js';
import {
  validateLocallySubmittedMlsMpmMechanicsFieldP2g
} from './sphGridGpuKernel.js';
import {
  resolveSchroederSpatialPhaseVolumeTransportAuthority
} from './schroederSpatialEpochTransaction.js';
import {
  uploadedMechanicsMaterialPhaseRecordsMatch
} from './sphMechanicsRefreshGpuKernel.js';
import {
  claimSchroederFusedCoarseTerminalStageProducer,
  markSchroederFusedCoarseTerminalStageSubmissionObserved,
  markSchroederFusedCoarseTerminalStageSubmitted,
  markSchroederFusedFineSubstepStageSubmissionObserved,
  markSchroederFusedFineSubstepStageSubmitted,
  quarantineSchroederFusedCoarseTerminalTransaction,
  quarantineSchroederFusedFineSubstepTransaction,
  releaseSchroederFusedCoarseTerminalStageProducer,
  validateSchroederFusedCoarseTerminalTransaction,
  validateSchroederFusedFineSubstepTransaction
} from './schroederFusedFineSubstepGpu.js';

const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const MECHANICS_FIELD_MODE_REQUIRED = 'required';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const GRID_STATE_AUTHORITY = 'schroeder-spatial-mechanics-field-view-v1';
const refluxLedgerOwnership = new WeakMap();
const fineCorrectionOrigins = new WeakMap();
const fineCorrectionClaims = new WeakMap();
const coarseTerminalOrigins = new WeakMap();
const coarseTerminalClaims = new WeakMap();
const REFLUX_LEDGER_ORIGIN_VALIDATOR = Symbol.for(
  'peercompute.ulg.schroeder-cross-level-reflux-ledger-origin-validator.v0'
);
let refluxLedgerGeneration = 0;

const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

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

const PIPELINE_BINDINGS = Object.freeze({
  initialize: Object.freeze([0, 1, 2, 3, 4, 5]),
  registerReflux: Object.freeze([0, 2, 3, 4, 5, 11]),
  restrictFine: Object.freeze([0, 1, 3, 4, 5, 11]),
  finalizeBaseline: Object.freeze([3, 4, 5, 11]),
  injectCoarse: Object.freeze([0, 2, 3, 4, 5, 11]),
  validateRegistry: Object.freeze([0, 3, 4, 5, 11]),
  updatePredictors: Object.freeze([0, 3, 4, 5, 11]),
  contactPredictors: Object.freeze([0, 3, 4, 5, 11]),
  sealPredictors: Object.freeze([3, 4, 5, 11]),
  beginFine: Object.freeze([0, 1, 3, 4, 5, 11]),
  validateFine: Object.freeze([0, 1, 3, 4, 5, 11]),
  validateRoutedCoarse: Object.freeze([0, 3, 4, 5, 11]),
  sealFineAlpha: Object.freeze([3, 4, 5, 11]),
  prepareFine: Object.freeze([0, 1, 3, 4, 5, 11]),
  applyFine: Object.freeze([0, 1, 3, 4, 5, 11]),
  applyFineHeat: Object.freeze([0, 1, 3, 4, 5, 11]),
  commitRefluxRows: Object.freeze([0, 1, 3, 4, 5, 11]),
  commitReflux: Object.freeze([0, 1, 3, 4, 5, 11]),
  // Fine finalization now settles cross-level phase-volume routes, which
  // reads the coarse mechanics field view (2).
  finalizeFine: Object.freeze([0, 1, 2, 3, 4, 5, 11]),
  // Admission authenticates the coarse pressure receipt and coarse phase
  // moments, so it binds the coarse mechanics field view (2) as well.
  admitCrossLevelPhaseVolume:
    Object.freeze([0, 1, 2, 3, 5, 6, 7, 8, 9, 11]),
  // Proposal reads coarse phase state and pressure rows through the coarse
  // mechanics field view (2) while routing impulses through the workspace.
  proposeCrossLevelPhaseVolume:
    Object.freeze([0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11]),
  initializeTerminal: Object.freeze([0, 2, 3, 4, 5]),
  registerTerminal: Object.freeze([0, 2, 3, 4, 5, 11]),
  sealTerminal: Object.freeze([0, 2, 3, 4, 5, 11]),
  prevalidateCoarse: Object.freeze([0, 2, 3, 4, 5, 11]),
  beginCoarse: Object.freeze([0, 2, 3, 4, 5, 11]),
  validateCoarse: Object.freeze([0, 2, 3, 4, 5, 11]),
  sealCoarse: Object.freeze([0, 2, 3, 4, 5, 11]),
  prepareCoarse: Object.freeze([2, 3, 4, 5, 11]),
  applyCoarseRows: Object.freeze([3, 4, 5, 11]),
  applyCoarse: Object.freeze([2, 3, 4, 5, 11]),
  commitCoarse: Object.freeze([3, 4, 5, 11]),
  finalizeCoarse: Object.freeze([2, 3, 4, 5, 11])
});
const PREDICTOR_PIPELINE_BINDINGS = Object.freeze([0, 1, 2, 3, 4, 5, 11]);
const TERMINAL_PIPELINE_BINDINGS = Object.freeze([0, 2, 3, 4, 5, 11]);
const PREDICTOR_PIPELINE_NAMES = new Set([
  'initialize',
  'registerReflux',
  'restrictFine',
  'finalizeBaseline',
  'injectCoarse',
  'validateRegistry',
  'updatePredictors',
  'contactPredictors',
  'sealPredictors'
]);
const TERMINAL_PIPELINE_NAMES = new Set([
  'initializeTerminal',
  'registerTerminal',
  'sealTerminal',
  'prevalidateCoarse',
  'validateCoarse',
  'sealCoarse',
  'prepareCoarse',
  'beginCoarse',
  'applyCoarseRows',
  'applyCoarse',
  'commitCoarse',
  'finalizeCoarse'
]);

function positiveInteger(value, label, max = 0xffff_ffff) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new RangeError(`${label} must be an integer in [1, ${max}]`);
  }
  return number;
}

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new RangeError(`${label} must be finite`);
  return number;
}

function finiteVector3(value, label) {
  const values = Array.from(value || []);
  if (values.length !== 3) throw new RangeError(`${label} must contain three values`);
  return values.map((entry, axis) => finiteNumber(entry, `${label}[${axis}]`));
}

function assertDevice(device) {
  if (
    !device?.createBuffer
    || !device?.createShaderModule
    || !device?.createComputePipeline
    || !device?.createBindGroup
    || !device?.queue?.writeBuffer
  ) {
    throw new TypeError('parent-field mechanics workspace requires a WebGPU-like device');
  }
}

function validateLocalSchroederCrossLevelRefluxLedgerGpuOwnership(
  device,
  ledger,
  {
    minimumCoarseFieldCapacity = 1,
    fineSubstepCount = null,
    fineLevel = null,
    coarseLevel = null,
    coarseGridSpacingM = null
  } = {}
) {
  const ownership = ledger && refluxLedgerOwnership.get(ledger);
  const spacingMatches = coarseGridSpacingM == null
    || Object.is(
      ownership?.coarseGridSpacingM,
      Math.fround(Number(coarseGridSpacingM))
    );
  return Boolean(
    ownership
    && ownership.destroyed !== true
    && ledger.status === 'schroeder-cross-level-reflux-ledger-gpu-ready'
    && ledger.ownerToken === ownership.ownerToken
    && ledger.ownerGeneration === ownership.generation
    && ledger.macroOwnerId === ownership.macroOwnerId
    && ledger.completionOrdinal === ownership.completionOrdinal
    && ownership.deviceId === webGpuDeviceId(device)
    && ownership.buffer === ledger.buffer
    && webGpuBufferMatchesDevice(ledger.buffer, device)
    && Number(ledger.buffer?.size ?? 0) >= ownership.layoutByteLength
    && ledger.byteLength === ownership.layoutByteLength
    && ledger.evidenceOffsetBytes === 0
    && ledger.evidenceByteLength
      === SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS * UINT32_BYTES
    && ledger.rowCapacity >= minimumCoarseFieldCapacity
    && ledger.rowCapacity === ownership.rowCapacity
    && (fineSubstepCount == null
      || ownership.fineSubstepCount === Number(fineSubstepCount))
    && (fineLevel == null || ownership.fineLevel === Number(fineLevel))
    && (coarseLevel == null || ownership.coarseLevel === Number(coarseLevel))
    && spacingMatches
  );
}

export function validateSchroederCrossLevelRefluxLedgerGpuOwnership(
  device,
  ledger,
  options = {}
) {
  if (ledger && refluxLedgerOwnership.has(ledger)) {
    return validateLocalSchroederCrossLevelRefluxLedgerGpuOwnership(
      device,
      ledger,
      options
    );
  }
  const originValidator = ledger == null
    ? null
    : Object.getOwnPropertyDescriptor(
      ledger,
      REFLUX_LEDGER_ORIGIN_VALIDATOR
    );
  if (
    originValidator?.enumerable !== false
    || originValidator?.configurable !== false
    || originValidator?.writable !== false
    || typeof originValidator?.value !== 'function'
  ) {
    return false;
  }
  try {
    return originValidator.value(device, ledger, options) === true;
  } catch {
    return false;
  }
}

export function validateLocallyOwnedSchroederCrossLevelRefluxLedgerGpu(
  device,
  ledger,
  options = {}
) {
  return validateLocalSchroederCrossLevelRefluxLedgerGpuOwnership(
    device,
    ledger,
    options
  );
}

function assertEncoder(encoder) {
  if (
    !encoder?.beginComputePass
    || !encoder?.clearBuffer
    || !encoder?.copyBufferToBuffer
  ) {
    throw new TypeError(
      'parent-field mechanics workspace requires a GPUCommandEncoder-like object'
    );
  }
}

function createOwnedBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(device.createBuffer({ label, size, usage }), device);
}

function destroyOwnedBuffersRetrying(buffers, context) {
  const pending = new Set(buffers.filter(Boolean));
  const errors = [];
  for (let pass = 0; pass < 2 && pending.size > 0; pass += 1) {
    for (const buffer of [...pending]) {
      try {
        buffer.destroy?.();
        pending.delete(buffer);
      } catch (error) {
        errors.push(error);
        if (buffer.destroyed === true) pending.delete(buffer);
      }
    }
  }
  if (pending.size > 0) {
    throw new AggregateError(
      errors,
      `${context} could not destroy every owned GPU buffer`
    );
  }
  return true;
}

function exactIdentityMatches(left, right) {
  return IDENTITY_FIELDS.every((field) => Object.is(left?.[field], right?.[field]));
}

function liveSubmittedExecution(execution) {
  try {
    return execution?.released !== true
      && execution?.ownerRuntime?.ownsExecution?.(execution) === true
      && execution?.ownerRuntime?.isExecutionSubmitted?.(execution) === true;
  } catch {
    return false;
  }
}

function projectionMatchesField(
  device,
  projection,
  fieldView,
  selectedLevel,
  { requireCurrent = true } = {}
) {
  const dims = Array.from(fieldView?.gridDims || []);
  const projectionDims = Array.from(projection?.gridDims || []);
  const fieldByteLength = Number(fieldView?.fieldViewBuffer?.size ?? 0);
  return projection?.backend === 'webgpu'
    && projection?.mechanicsFieldMode === MECHANICS_FIELD_MODE_REQUIRED
    && projection?.mechanicsFieldViewEnabled === true
    && projection?.mechanicsFieldViewExecution === fieldView
    && projection?.mechanicsFieldViewBuffer === fieldView?.fieldViewBuffer
    && projection?.gridStateAuthority === GRID_STATE_AUTHORITY
    && projection?.denseGridAuthoritative === false
    && projection?.gridBuffer == null
    && projection?.readbackMode === NO_FULL_READBACK_MODE
    && projection?.fullReadbackPerformed === false
    && projection?.normalHotLoopReadbackFree === true
    && projection?.mechanicsFieldMutationOutputStateEncoding
      === SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT
    && (
      requireCurrent === false
      || fieldView?.ownerRuntime?.isCurrentStateArtifact?.(fieldView, {
        mutationOrdinal: projection?.mechanicsFieldMutationOutputOrdinal,
        stateEncoding:
          SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT
      }) === true
    )
    && projection?.gridNodeCount === fieldView?.gridNodeCount
    && projection?.gridShift === fieldView?.gridShift
    && Number.isFinite(Number(projection?.gridSpacingM))
    && Number.isFinite(Number(fieldView?.gridSpacingM))
    && Math.fround(Number(projection.gridSpacingM))
      === Math.fround(Number(fieldView.gridSpacingM))
    && projectionDims.length === 3
    && dims.length === 3
    && projectionDims.every((value, axis) => value === dims[axis])
    && fieldView?.selectedLevel === selectedLevel
    && (
      projection?.schroederLevelFilter?.selectedLevel == null
      || projection.schroederLevelFilter.selectedLevel === selectedLevel
    )
    && Number(projection?.mechanicsFieldViewByteLength ?? 0) === fieldByteLength
    && webGpuBufferMatchesDevice(projection?.mechanicsFieldViewBuffer, device);
}

function gridUpdateMatchesField(
  device,
  gridUpdate,
  projection,
  fieldView,
  { pendingMutationToken = null } = {}
) {
  const dims = Array.from(fieldView?.gridDims || []);
  const updateDims = Array.from(gridUpdate?.gridDims || []);
  return gridUpdate?.backend === 'webgpu'
    && validateSubmittedMlsMpmMechanicsFieldGridUpdate(device, gridUpdate, {
      sourceProjection: projection,
      fieldExecution: fieldView,
      requireDeferred: true
    })
    && gridUpdate?.mechanicsFieldMode === MECHANICS_FIELD_MODE_REQUIRED
    && gridUpdate?.mechanicsFieldViewEnabled === true
    && gridUpdate?.mechanicsFieldViewExecution === fieldView
    && gridUpdate?.mechanicsFieldViewBuffer === fieldView?.fieldViewBuffer
    && gridUpdate?.gridStateAuthority === GRID_STATE_AUTHORITY
    && gridUpdate?.denseGridAuthoritative === false
    && (
      gridUpdate?.fieldStateUpdateSubmittedInPlace === true
      || gridUpdate?.fieldStateUpdatedInPlace === true
    )
    && gridUpdate?.updatedGridBuffer == null
    && gridUpdate?.readbackMode === NO_FULL_READBACK_MODE
    && gridUpdate?.fullReadbackPerformed === false
    && gridUpdate?.normalHotLoopReadbackFree === true
    && gridUpdate?.gridNodeCount === fieldView?.gridNodeCount
    && gridUpdate?.gridShift === fieldView?.gridShift
    && Number.isFinite(Number(gridUpdate?.gridSpacingM))
    && Number.isFinite(Number(fieldView?.gridSpacingM))
    && Math.fround(Number(gridUpdate.gridSpacingM))
      === Math.fround(Number(fieldView.gridSpacingM))
    && updateDims.length === 3
    && dims.length === 3
    && updateDims.every((value, axis) => value === dims[axis])
    && Number(gridUpdate?.mechanicsFieldViewByteLength ?? 0)
      === Number(fieldView?.fieldViewBuffer?.size ?? 0)
    && gridUpdate?.sourceProjection === projection
    && gridUpdate?.mechanicsFieldMutationInputOrdinal
      === projection?.mechanicsFieldMutationOutputOrdinal
    && gridUpdate?.mechanicsFieldMutationOutputStateEncoding
      === SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
    && (pendingMutationToken == null
      ? fieldView?.ownerRuntime?.isCurrentStateArtifact?.(fieldView, {
          mutationOrdinal: gridUpdate?.mechanicsFieldMutationOutputOrdinal,
          stateEncoding:
            SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
        }) === true
      : (
        pendingMutationToken.expectedOrdinal
          === gridUpdate?.mechanicsFieldMutationOutputOrdinal
        && pendingMutationToken.expectedEncoding
          === SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
        && fieldView?.ownerRuntime?.isStateMutationReservationActive?.(
          fieldView,
          pendingMutationToken
        ) === true
      ))
    && projectionMatchesField(
      device,
      projection,
      fieldView,
      fieldView.selectedLevel,
      { requireCurrent: false }
    );
}

function exactArrayMatches(value, snapshot) {
  return Array.isArray(value)
    && value.length === snapshot.length
    && snapshot.every((entry, index) => Object.is(value[index], entry));
}

function fineCorrectionMatchesEncodedSnapshot(correction, snapshot) {
  return Boolean(
    correction
    && snapshot
    && correction.schema === snapshot.schema
    && correction.backend === snapshot.backend
    && correction.sourceProjection === snapshot.sourceProjection
    && correction.previousGridUpdate === snapshot.priorGridUpdate
    && correction.mechanicsFieldViewExecution === snapshot.fieldExecution
    && correction.mechanicsFieldViewBuffer === snapshot.fieldBuffer
    && correction.mechanicsFieldViewByteLength === snapshot.fieldByteLength
    && correction.mechanicsFieldMutationInputOrdinal === snapshot.inputOrdinal
    && correction.mechanicsFieldMutationOutputOrdinal === snapshot.outputOrdinal
    && correction.mechanicsFieldMutationInputStateEncoding === snapshot.inputEncoding
    && correction.mechanicsFieldMutationOutputStateEncoding === snapshot.outputEncoding
    && Object.is(correction.dt, snapshot.dt)
    && exactArrayMatches(correction.gravityMPerS2, snapshot.gravity)
    && exactArrayMatches(correction.boxDimsM, snapshot.box)
    && Object.is(correction.cflFactor, snapshot.cflFactor)
    && Object.is(correction.gridSpacingM, snapshot.gridSpacingM)
    && exactArrayMatches(correction.gridDims, snapshot.gridDims)
    && correction.gridNodeCount === snapshot.gridNodeCount
    && correction.gridShift === snapshot.gridShift
    && correction.fusedFineSubstepTransaction === snapshot.transaction
    && correction.fineMicroepochAuthority === snapshot.microepochAuthority
    && correction.proposalMode === snapshot.proposalMode
  );
}

function fineCorrectionMatchesOrigin(correction, origin, {
  transaction = null,
  macroAuthority = null,
  microepochAuthority = null,
  particleContinuation = null,
  fieldExecution = null,
  mutationSegment = null,
  priorArtifact = null,
  requireDeferred = null,
  proposalMode = null
} = {}) {
  const receipt = correction?.mechanicsFieldEnergyReceipt ?? null;
  return Boolean(
    origin
    && correction === origin.correction
    && correction?.schema === ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA
    && correction?.backend === 'webgpu'
    && correction?.status === 'submitted-unverified'
    && correction?.sourceProjection === origin.sourceProjection
    && correction?.previousGridUpdate === origin.priorGridUpdate
    && correction?.mechanicsFieldViewExecution === origin.fieldExecution
    && correction?.mechanicsFieldViewBuffer === origin.fieldBuffer
    && correction?.mechanicsFieldViewByteLength === origin.fieldByteLength
    && correction?.mechanicsFieldMode === MECHANICS_FIELD_MODE_REQUIRED
    && correction?.mechanicsFieldViewEnabled === true
    && correction?.gridStateAuthority === GRID_STATE_AUTHORITY
    && correction?.denseGridAuthoritative === false
    && correction?.fieldStateUpdateSubmittedInPlace === true
    && correction?.fieldStateUpdatedInPlace === false
    && correction?.mechanicsFieldMutationInputOrdinal === origin.inputOrdinal
    && correction?.mechanicsFieldMutationOutputOrdinal === origin.outputOrdinal
    && correction?.mechanicsFieldMutationInputStateEncoding === origin.inputEncoding
    && correction?.mechanicsFieldMutationOutputStateEncoding === origin.outputEncoding
    && correction?.parentFieldMechanicsTerminalSubmitted === true
    && correction?.parentFieldMechanicsWorkspaceExecution === origin.execution
    && correction?.parentFieldMechanicsWorkspaceStatus
      === 'parent-predictor-delta-corrected-native-fine-fields'
    && correction?.fusedFineSubstepTransaction === origin.transaction
    && correction?.fineMicroepochAuthority === origin.microepochAuthority
    && correction?.proposalMode === origin.proposalMode
    && receipt === origin.receipt
    && receipt?.schema
      === 'peercompute.ulg.schroeder-mechanics-field-energy-receipt.v3'
    && receipt?.status === 'energy-ready-submitted-unverified'
    && receipt?.deferSeal === false
    && receipt?.fieldMutationOrdinal === origin.outputOrdinal
    && receipt?.parentFieldMechanicsWorkspaceExecution === origin.execution
    && receipt?.refluxLedger === origin.refluxLedger
    && receipt?.fineSubstepOrdinal === origin.transaction.substepOrdinal
    && receipt?.workspaceCompletionOrdinal === origin.workspaceCompletionOrdinal
    && receipt?.refluxCompletionOrdinal === origin.refluxLedger.completionOrdinal
    && Object.is(correction?.dt, origin.dt)
    && Object.is(origin.dt, origin.macroAuthority.fineDt)
    && Object.is(origin.priorGridUpdate?.dt, origin.macroAuthority.fineDt)
    && Object.is(origin.sourceProjection?.dt, origin.macroAuthority.fineDt)
    && Object.is(
      Math.fround(origin.coarseProjection?.dt),
      origin.expectedThetaDt
    )
    && Object.is(origin.execution?.fineDt, origin.macroAuthority.fineDt)
    && Object.is(origin.execution?.macroDt, origin.macroAuthority.macroDt)
    && Object.is(origin.execution?.predictorDt, origin.predictorDt)
    && Object.is(Math.fround(origin.predictorDt), origin.expectedThetaDt)
    && Object.is(origin.fineDt, origin.macroAuthority.fineDt)
    && Object.is(origin.macroDt, origin.macroAuthority.macroDt)
    && exactArrayMatches(correction?.gravityMPerS2, origin.gravity)
    && exactArrayMatches(correction?.boxDimsM, origin.box)
    && Object.is(correction?.cflFactor, origin.cflFactor)
    && Object.is(correction?.gridSpacingM, origin.gridSpacingM)
    && exactArrayMatches(correction?.gridDims, origin.gridDims)
    && correction?.gridNodeCount === origin.gridNodeCount
    && correction?.gridShift === origin.gridShift
    && correction?.readbackMode === NO_FULL_READBACK_MODE
    && correction?.fullReadbackPerformed === false
    && correction?.normalHotLoopReadbackFree === true
    && origin.execution?.fusedFineSubstepTransaction === origin.transaction
    && origin.execution?.refluxLedger === origin.refluxLedger
    && origin.execution?.fineP2gProjection === origin.sourceProjection
    && origin.execution?.coarseP2gProjection === origin.coarseProjection
    && origin.execution?.parentFieldView === origin.parentFieldView
    && origin.execution?.plan === origin.workspacePlan
    && origin.execution?.completionOrdinal === origin.workspaceCompletionOrdinal
    && origin.execution?.fineGridUpdate === origin.priorGridUpdate
    && origin.execution?.fineCorrectedGridUpdate === correction
    && origin.execution?.fineCorrectionMutationToken === origin.mutationSegment
    && origin.execution?.fineFieldView === origin.fieldExecution
    && origin.execution?.terminalKind === 'fine-correction'
    && origin.execution?.ownerRuntime === origin.workspaceRuntime
    && origin.workspaceLivenessValidator?.() === true
    && origin.transaction?.macroAuthority === origin.macroAuthority
    && origin.transaction?.microepochAuthority === origin.microepochAuthority
    && origin.transaction?.particleContinuation === origin.particleContinuation
    && origin.transaction?.fineCorrectionMutation === origin.mutationSegment
    && origin.transaction?.refluxLedger === origin.refluxLedger
    && origin.fieldExecution === origin.transaction.fineFieldView
    && origin.fieldBuffer === origin.transaction.fineFieldView.fieldViewBuffer
    && origin.fieldByteLength
      === Number(origin.transaction.fineFieldView.fieldViewBuffer?.size ?? 0)
    && origin.inputOrdinal === origin.mutationSegment.expectedOrdinal
    && origin.outputOrdinal === origin.mutationSegment.outputOrdinal
    && origin.inputEncoding === origin.mutationSegment.expectedEncoding
    && origin.outputEncoding === origin.mutationSegment.outputEncoding
    && origin.sourceProjection === origin.priorGridUpdate.sourceProjection
    && Object.is(origin.dt, origin.priorGridUpdate.dt)
    && exactArrayMatches(origin.priorGridUpdate.gravityMPerS2, origin.gravity)
    && exactArrayMatches(origin.priorGridUpdate.boxDimsM, origin.box)
    && Object.is(origin.priorGridUpdate.cflFactor, origin.cflFactor)
    && Object.is(origin.priorGridUpdate.gridSpacingM, origin.gridSpacingM)
    && exactArrayMatches(origin.priorGridUpdate.gridDims, origin.gridDims)
    && origin.priorGridUpdate.gridNodeCount === origin.gridNodeCount
    && origin.priorGridUpdate.gridShift === origin.gridShift
    && validateSchroederFusedFineSubstepTransaction(
      origin.device,
      origin.transaction,
      {
        macroAuthority: origin.macroAuthority,
        microepochAuthority: origin.microepochAuthority,
        particleContinuation: origin.particleContinuation
      }
    )
    && validateLocallySubmittedMlsMpmMechanicsFieldGridUpdate(
      origin.device,
      origin.priorGridUpdate,
      {
        sourceProjection: origin.sourceProjection,
        fieldExecution: origin.fieldExecution,
        transaction: origin.transaction,
        macroAuthority: origin.macroAuthority,
        microepochAuthority: origin.microepochAuthority,
        particleContinuation: origin.particleContinuation,
        mutationSegment: origin.transaction.gridUpdateMutation,
        priorArtifact: origin.sourceProjection,
        requireDeferred: true,
        proposalMode: origin.proposalMode
      }
    )
    && validateLocallyOwnedSchroederCrossLevelRefluxLedgerGpu(
      origin.device,
      origin.refluxLedger,
      {
        minimumCoarseFieldCapacity:
          origin.execution.parentFieldView.coarseFieldCapacity,
        fineSubstepCount: origin.execution.fineSubstepCount,
        fineLevel: origin.execution.parentFieldView.fineLevel,
        coarseLevel: origin.execution.parentFieldView.coarseLevel,
        coarseGridSpacingM: origin.execution.coarseFieldView.gridSpacingM
      }
    )
    && (transaction == null || transaction === origin.transaction)
    && (macroAuthority == null || macroAuthority === origin.macroAuthority)
    && (microepochAuthority == null
      || microepochAuthority === origin.microepochAuthority)
    && (particleContinuation == null
      || particleContinuation === origin.particleContinuation)
    && (fieldExecution == null || fieldExecution === origin.fieldExecution)
    && (mutationSegment == null || mutationSegment === origin.mutationSegment)
    && (priorArtifact == null || priorArtifact === origin.priorGridUpdate)
    && (requireDeferred !== true
      || origin.priorGridUpdate.mechanicsFieldEnergyReceipt?.deferSeal === true)
    && (proposalMode == null || proposalMode === origin.proposalMode)
  );
}

export function validateLocallySubmittedSchroederSpatialParentFieldFineCorrectionGpu(
  device,
  correction,
  options = {}
) {
  const origin = correction && fineCorrectionOrigins.get(correction);
  return origin?.deviceId === webGpuDeviceId(device)
    && fineCorrectionMatchesOrigin(correction, origin, options);
}

function coarseTerminalMatchesEncodedSnapshot(artifact, snapshot) {
  return Boolean(
    artifact
    && snapshot
    && artifact.schema === snapshot.schema
    && artifact.backend === snapshot.backend
    && artifact.sourceProjection === snapshot.sourceProjection
    && artifact.previousGridUpdate === snapshot.priorGridUpdate
    && artifact.mechanicsFieldViewExecution === snapshot.fieldExecution
    && artifact.mechanicsFieldViewBuffer === snapshot.fieldBuffer
    && artifact.mechanicsFieldViewByteLength === snapshot.fieldByteLength
    && artifact.mechanicsFieldMutationInputOrdinal === snapshot.inputOrdinal
    && artifact.mechanicsFieldMutationOutputOrdinal === snapshot.outputOrdinal
    && artifact.mechanicsFieldMutationInputStateEncoding === snapshot.inputEncoding
    && artifact.mechanicsFieldMutationOutputStateEncoding === snapshot.outputEncoding
    && Object.is(artifact.dt, snapshot.dt)
    && exactArrayMatches(artifact.gravityMPerS2, snapshot.gravity)
    && exactArrayMatches(artifact.boxDimsM, snapshot.box)
    && Object.is(artifact.cflFactor, snapshot.cflFactor)
    && Object.is(artifact.gridSpacingM, snapshot.gridSpacingM)
    && exactArrayMatches(artifact.gridDims, snapshot.gridDims)
    && artifact.gridNodeCount === snapshot.gridNodeCount
    && artifact.gridShift === snapshot.gridShift
    && artifact.fusedCoarseTerminalTransaction === snapshot.transaction
    && artifact.terminalMicroepochAuthority === snapshot.microepochAuthority
    && artifact.sourceParticleContinuation === snapshot.particleContinuation
    && artifact.proposalMode === snapshot.proposalMode
    && artifact.crossLevelRefluxLedger === snapshot.refluxLedger
  );
}

function coarseTerminalPublicMirrorsMatch(execution, ownership) {
  const transaction = ownership?.fusedCoarseTerminalTransaction;
  const snapshot = ownership?.terminalSnapshot;
  return Boolean(
    transaction
    && snapshot
    && ownership.terminalKind === 'coarse-terminal'
    && execution?.terminalKind === 'coarse-terminal'
    && execution.fusedCoarseTerminalTransaction === transaction
    && execution.terminalMicroepochAuthority === transaction.microepochAuthority
    && execution.sourceParticleContinuation === transaction.particleContinuation
    && execution.proposalMode === 'proposal-deferred-to-post-mechanics'
    && execution.coarseGridUpdate === ownership.terminalArtifact
    && execution.inputCoarseGridUpdate === ownership.terminalPriorArtifact
    && execution.coarseP2gProjection === snapshot.sourceProjection
    && execution.coarsePublishMutationToken === transaction.coarseTerminalMutation
    && ownership.terminalMutationToken === transaction.coarseTerminalMutation
    && execution.refluxLedger === transaction.refluxLedger
    && ownership.terminalRefluxLedger === transaction.refluxLedger
    && execution.parentFieldView === transaction.microepochAuthority.parentFieldView
    && execution.coarseFieldView === transaction.coarseFieldView
    && execution.plan === snapshot.workspacePlan
    && execution.completionOrdinal === snapshot.workspaceCompletionOrdinal
    && execution.fineSubstepOrdinal === transaction.substepOrdinal
    && execution.fineSubstepCount === transaction.macroAuthority.fineSubstepCount
    && Object.is(execution.fineDt, transaction.macroAuthority.fineDt)
    && Object.is(execution.macroDt, transaction.macroAuthority.macroDt)
    && Object.is(execution.predictorDt, transaction.macroAuthority.macroDt)
    && coarseTerminalMatchesEncodedSnapshot(
      ownership.terminalArtifact,
      snapshot
    )
  );
}

function coarseTerminalMatchesOrigin(artifact, origin, {
  terminalTransaction = null,
  macroAuthority = null,
  microepochAuthority = null,
  particleContinuation = null,
  fieldExecution = null,
  mutationSegment = null,
  priorArtifact = null,
  requireDeferred = null,
  proposalMode = null
} = {}) {
  const receipt = artifact?.mechanicsFieldEnergyReceipt ?? null;
  return Boolean(
    origin
    && artifact === origin.artifact
    && coarseTerminalMatchesEncodedSnapshot(artifact, origin.snapshot)
    && artifact.status === 'submitted-unverified'
    && artifact.mechanicsFieldMode === MECHANICS_FIELD_MODE_REQUIRED
    && artifact.mechanicsFieldViewEnabled === true
    && artifact.gridStateAuthority === GRID_STATE_AUTHORITY
    && artifact.denseGridAuthoritative === false
    && artifact.fieldStateUpdateSubmittedInPlace === true
    && artifact.fieldStateUpdatedInPlace === false
    && artifact.parentFieldMechanicsTerminalSubmitted === true
    && artifact.parentFieldMechanicsWorkspaceExecution === origin.execution
    && artifact.parentFieldMechanicsWorkspaceStatus
      === 'actual-deferred-coarse-update-refluxed-by-prepared-terminal'
    && artifact.readbackMode === NO_FULL_READBACK_MODE
    && artifact.fullReadbackPerformed === false
    && artifact.normalHotLoopReadbackFree === true
    && receipt === origin.receipt
    && receipt?.schema
      === 'peercompute.ulg.schroeder-mechanics-field-energy-receipt.v3'
    && receipt?.status === 'energy-ready-submitted-unverified'
    && receipt?.deferSeal === false
    && receipt?.fieldMutationOrdinal === origin.mutationSegment.outputOrdinal
    && receipt?.parentFieldMechanicsWorkspaceExecution === origin.execution
    && receipt?.refluxLedger === origin.refluxLedger
    && receipt?.fineSubstepOrdinal === origin.transaction.substepOrdinal
    && receipt?.workspaceCompletionOrdinal === origin.workspaceCompletionOrdinal
    && receipt?.refluxCompletionOrdinal === origin.refluxLedger.completionOrdinal
    && origin.execution?.ownerRuntime === origin.workspaceRuntime
    && origin.execution?.terminalKind === 'coarse-terminal'
    && origin.execution?.terminalSubmitted === true
    && origin.execution?.fusedCoarseTerminalTransaction === origin.transaction
    && origin.execution?.terminalMicroepochAuthority
      === origin.microepochAuthority
    && origin.execution?.sourceParticleContinuation
      === origin.particleContinuation
    && origin.execution?.proposalMode === origin.proposalMode
    && origin.execution?.parentFieldView === origin.parentFieldView
    && origin.execution?.coarseFieldView === origin.fieldExecution
    && origin.execution?.coarseP2gProjection === origin.sourceProjection
    && origin.execution?.inputCoarseGridUpdate === origin.priorGridUpdate
    && origin.execution?.coarseGridUpdate === artifact
    && origin.execution?.coarsePublishMutationToken === origin.mutationSegment
    && origin.execution?.refluxLedger === origin.refluxLedger
    && origin.execution?.plan === origin.workspacePlan
    && origin.execution?.completionOrdinal === origin.workspaceCompletionOrdinal
    && origin.execution?.fineSubstepOrdinal === origin.transaction.substepOrdinal
    && origin.execution?.fineSubstepCount
      === origin.macroAuthority.fineSubstepCount
    && Object.is(origin.execution?.fineDt, origin.macroAuthority.fineDt)
    && Object.is(origin.execution?.macroDt, origin.macroAuthority.macroDt)
    && Object.is(origin.execution?.predictorDt, origin.macroAuthority.macroDt)
    && origin.workspaceLivenessValidator?.() === true
    && origin.transaction?.macroAuthority === origin.macroAuthority
    && origin.transaction?.microepochAuthority === origin.microepochAuthority
    && origin.transaction?.particleContinuation === origin.particleContinuation
    && origin.transaction?.coarseTerminalMutation === origin.mutationSegment
    && origin.transaction?.refluxLedger === origin.refluxLedger
    && origin.transaction?.coarseFieldView === origin.fieldExecution
    && origin.fieldBuffer === origin.fieldExecution.fieldViewBuffer
    && origin.fieldByteLength
      === Number(origin.fieldExecution.fieldViewBuffer?.size ?? 0)
    && origin.sourceProjection === origin.priorGridUpdate.sourceProjection
    && Object.is(origin.priorGridUpdate.dt, origin.macroAuthority.macroDt)
    && Object.is(origin.sourceProjection.dt, origin.macroAuthority.macroDt)
    && validateSchroederFusedCoarseTerminalTransaction(
      origin.device,
      origin.transaction,
      {
        macroAuthority: origin.macroAuthority,
        microepochAuthority: origin.microepochAuthority,
        particleContinuation: origin.particleContinuation
      }
    )
    && validateLocallySubmittedMlsMpmMechanicsFieldGridUpdate(
      origin.device,
      origin.priorGridUpdate,
      {
        sourceProjection: origin.sourceProjection,
        fieldExecution: origin.fieldExecution,
        terminalTransaction: origin.transaction,
        macroAuthority: origin.macroAuthority,
        microepochAuthority: origin.microepochAuthority,
        particleContinuation: origin.particleContinuation,
        mutationSegment: origin.transaction.gridUpdateMutation,
        priorArtifact: origin.sourceProjection,
        requireDeferred: true,
        proposalMode: origin.proposalMode
      }
    )
    && validateLocallyOwnedSchroederCrossLevelRefluxLedgerGpu(
      origin.device,
      origin.refluxLedger,
      {
        minimumCoarseFieldCapacity: origin.parentFieldView.coarseFieldCapacity,
        fineSubstepCount: origin.macroAuthority.fineSubstepCount,
        fineLevel: origin.parentFieldView.fineLevel,
        coarseLevel: origin.parentFieldView.coarseLevel,
        coarseGridSpacingM: origin.fieldExecution.gridSpacingM
      }
    )
    && (terminalTransaction == null || terminalTransaction === origin.transaction)
    && (macroAuthority == null || macroAuthority === origin.macroAuthority)
    && (microepochAuthority == null
      || microepochAuthority === origin.microepochAuthority)
    && (particleContinuation == null
      || particleContinuation === origin.particleContinuation)
    && (fieldExecution == null || fieldExecution === origin.fieldExecution)
    && (mutationSegment == null || mutationSegment === origin.mutationSegment)
    && (priorArtifact == null || priorArtifact === origin.priorGridUpdate)
    && (requireDeferred !== true
      || origin.priorGridUpdate.mechanicsFieldEnergyReceipt?.deferSeal === true)
    && (proposalMode == null || proposalMode === origin.proposalMode)
  );
}

export function validateLocallySubmittedSchroederSpatialParentFieldCoarseTerminalGpu(
  device,
  artifact,
  options = {}
) {
  const origin = artifact && coarseTerminalOrigins.get(artifact);
  return origin?.deviceId === webGpuDeviceId(device)
    && coarseTerminalMatchesOrigin(artifact, origin, options);
}

function fusedP2gMatchesTransaction(device, projection, fieldView, transaction) {
  return Boolean(
    transaction
    && transaction.fineFieldView === fieldView
    && transaction.microepochAuthority?.fineFieldView === fieldView
    && transaction.particleContinuation
    && transaction.p2gMutation
    && transaction.refluxLedger
    && Object.is(projection?.dt, transaction.macroAuthority?.fineDt)
    && validateSchroederFusedFineSubstepTransaction(device, transaction, {
      stage: 'grid-update',
      macroAuthority: transaction.macroAuthority,
      microepochAuthority: transaction.microepochAuthority,
      particleContinuation: transaction.particleContinuation,
      artifact: projection
    })
    && validateLocallySubmittedMlsMpmMechanicsFieldP2g(
      device,
      projection,
      {
        transaction,
        macroAuthority: transaction.macroAuthority,
        microepochAuthority: transaction.microepochAuthority,
        particleContinuation: transaction.particleContinuation,
        fieldExecution: fieldView,
        mutationSegment: transaction.p2gMutation,
        priorArtifact: null,
        requireDeferred: true,
        proposalMode: 'proposal-deferred-to-post-mechanics'
      }
    )
    && projectionMatchesField(
      device,
      projection,
      fieldView,
      fieldView.selectedLevel,
      { requireCurrent: false }
    )
  );
}

function fusedGridUpdateMatchesTransaction(
  device,
  update,
  projection,
  fieldView,
  transaction
) {
  return Boolean(
    transaction
    && update?.sourceProjection === projection
    && transaction.fineFieldView === fieldView
    && transaction.microepochAuthority?.fineFieldView === fieldView
    && Object.is(update?.dt, transaction.macroAuthority?.fineDt)
    && Object.is(projection?.dt, transaction.macroAuthority?.fineDt)
    && validateSchroederFusedFineSubstepTransaction(device, transaction, {
      stage: 'fine-correction',
      macroAuthority: transaction.macroAuthority,
      microepochAuthority: transaction.microepochAuthority,
      particleContinuation: transaction.particleContinuation,
      artifact: update
    })
    && validateLocallySubmittedMlsMpmMechanicsFieldGridUpdate(
      device,
      update,
      {
        sourceProjection: projection,
        fieldExecution: fieldView,
        transaction,
        macroAuthority: transaction.macroAuthority,
        microepochAuthority: transaction.microepochAuthority,
        particleContinuation: transaction.particleContinuation,
        mutationSegment: transaction.gridUpdateMutation,
        priorArtifact: projection,
        requireDeferred: true,
        proposalMode: 'proposal-deferred-to-post-mechanics'
      }
    )
    && update?.mechanicsFieldMode === MECHANICS_FIELD_MODE_REQUIRED
    && update?.mechanicsFieldViewEnabled === true
    && update?.mechanicsFieldViewExecution === fieldView
    && update?.mechanicsFieldViewBuffer === fieldView?.fieldViewBuffer
    && update?.gridStateAuthority === GRID_STATE_AUTHORITY
    && update?.denseGridAuthoritative === false
    && update?.fieldStateUpdateSubmittedInPlace === true
    && update?.fieldStateUpdatedInPlace === false
    && update?.mechanicsFieldMutationInputOrdinal
      === transaction.gridUpdateMutation.expectedOrdinal
    && update?.mechanicsFieldMutationOutputOrdinal
      === transaction.gridUpdateMutation.outputOrdinal
    && update?.mechanicsFieldMutationInputStateEncoding
      === transaction.gridUpdateMutation.expectedEncoding
    && update?.mechanicsFieldMutationOutputStateEncoding
      === transaction.gridUpdateMutation.outputEncoding
    && projectionMatchesField(
      device,
      projection,
      fieldView,
      fieldView.selectedLevel,
      { requireCurrent: false }
    )
  );
}

function fusedCoarseGridUpdateMatchesTransaction(
  device,
  update,
  projection,
  fieldView,
  transaction
) {
  return Boolean(
    transaction
    && update?.sourceProjection === projection
    && transaction.coarseFieldView === fieldView
    && transaction.microepochAuthority?.parentFieldView?.coarseFieldView
      === fieldView
    && Object.is(update?.dt, transaction.macroAuthority?.macroDt)
    && Object.is(projection?.dt, transaction.macroAuthority?.macroDt)
    && validateSchroederFusedCoarseTerminalTransaction(device, transaction, {
      stage: 'coarse-terminal',
      macroAuthority: transaction.macroAuthority,
      microepochAuthority: transaction.microepochAuthority,
      particleContinuation: transaction.particleContinuation,
      artifact: update
    })
    && validateLocallySubmittedMlsMpmMechanicsFieldGridUpdate(
      device,
      update,
      {
        sourceProjection: projection,
        fieldExecution: fieldView,
        terminalTransaction: transaction,
        macroAuthority: transaction.macroAuthority,
        microepochAuthority: transaction.microepochAuthority,
        particleContinuation: transaction.particleContinuation,
        mutationSegment: transaction.gridUpdateMutation,
        priorArtifact: projection,
        requireDeferred: true,
        proposalMode: 'proposal-deferred-to-post-mechanics'
      }
    )
    && update?.mechanicsFieldMode === MECHANICS_FIELD_MODE_REQUIRED
    && update?.mechanicsFieldViewEnabled === true
    && update?.mechanicsFieldViewExecution === fieldView
    && update?.mechanicsFieldViewBuffer === fieldView?.fieldViewBuffer
    && update?.gridStateAuthority === GRID_STATE_AUTHORITY
    && update?.denseGridAuthoritative === false
    && update?.fieldStateUpdateSubmittedInPlace === true
    && update?.fieldStateUpdatedInPlace === false
    && update?.mechanicsFieldMutationInputOrdinal
      === transaction.gridUpdateMutation.expectedOrdinal
    && update?.mechanicsFieldMutationOutputOrdinal
      === transaction.gridUpdateMutation.outputOrdinal
    && update?.mechanicsFieldMutationInputStateEncoding
      === transaction.gridUpdateMutation.expectedEncoding
    && update?.mechanicsFieldMutationOutputStateEncoding
      === transaction.gridUpdateMutation.outputEncoding
    && projectionMatchesField(
      device,
      projection,
      fieldView,
      fieldView.selectedLevel,
      { requireCurrent: false }
    )
  );
}

function paramsData(execution, {
  dt,
  fineDt = dt,
  macroDt = dt,
  fineSubstepOrdinal = 0,
  fineSubstepCount = execution.refluxLedger?.fineSubstepCount ?? 1,
  terminalOperation = false,
  gravityMPerS2,
  boxDimsM,
  cflFactor,
  deltaScale,
  maxCorrectionMPerS,
  wallBarrierElasticStiffnessNPerM = 0,
  wallBarrierContactScale = 1,
  wallBarrierMinGapM = 1e-6,
  phaseVolumeTransportAuthority = null,
  mechanicsMaterialPhaseUpload = null,
  ambientPressurePa = 0,
  phaseVolumePressureScale = 1,
  phaseVolumeDragScale = 1,
  phaseVolumeMaxImpulseFraction = 0.5,
  temporalCoarseEnabled = execution.temporalCoarsePredictorEnabled === true,
  temporalCoarseSuccessorDt =
    execution.temporalCoarsePredictorSuccessorDt ?? 0
}) {
  const data = new ArrayBuffer(
    SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PARAMS_BYTES
  );
  const view = new DataView(data);
  const u32 = (word, value) => view.setUint32(word * 4, Number(value) >>> 0, true);
  const i32 = (word, value) => view.setInt32(word * 4, Number(value) | 0, true);
  const f32 = (word, value) => view.setFloat32(
    word * 4,
    Math.fround(Number(value)),
    true
  );
  const { plan, parentFieldView } = execution;
  const coarse = parentFieldView.coarseFieldView;
  const coarseDims = Array.from(coarse.gridDims);
  const gravity = finiteVector3(gravityMPerS2, 'gravityMPerS2');
  const box = finiteVector3(boxDimsM, 'boxDimsM');
  const dtSeconds = finiteNumber(dt, 'dt');
  const fineDtSeconds = finiteNumber(fineDt, 'fineDt');
  const macroDtSeconds = finiteNumber(macroDt, 'macroDt');
  const substepOrdinal = Number(fineSubstepOrdinal);
  const substepCount = Number(fineSubstepCount);
  const temporalRequired = terminalOperation !== true
    && substepOrdinal + 1 < substepCount;
  const temporalSuccessorDt = temporalCoarseEnabled
    ? finiteNumber(
        temporalCoarseSuccessorDt,
        'temporalCoarseSuccessorDt'
      )
    : 0;
  const cfl = finiteNumber(cflFactor, 'cflFactor');
  const delta = finiteNumber(deltaScale, 'deltaScale');
  const correction = finiteNumber(maxCorrectionMPerS, 'maxCorrectionMPerS');
  const wallElastic = finiteNumber(
    wallBarrierElasticStiffnessNPerM,
    'wallBarrierElasticStiffnessNPerM'
  );
  const wallScale = finiteNumber(wallBarrierContactScale, 'wallBarrierContactScale');
  const wallGap = finiteNumber(wallBarrierMinGapM, 'wallBarrierMinGapM');
  if (!(dtSeconds > 0)) throw new RangeError('dt must be positive');
  if (!(fineDtSeconds > 0)) throw new RangeError('fineDt must be positive');
  if (!(macroDtSeconds > 0)) throw new RangeError('macroDt must be positive');
  const ordinalAdmitted = terminalOperation === true
    ? substepOrdinal === substepCount
    : substepOrdinal < substepCount;
  if (!Number.isInteger(substepCount) || substepCount < 1
      || substepCount > 4
      || !Number.isInteger(substepOrdinal) || substepOrdinal < 0
      || !ordinalAdmitted) {
    throw new RangeError('fine substep ordinal/count are outside the admitted range');
  }
  const expectedTemporalSuccessorDt = temporalRequired
    ? Math.fround(((substepOrdinal + 2) / substepCount) * macroDtSeconds)
    : 0;
  if (
    temporalCoarseEnabled !== temporalRequired
    || !Object.is(
      Math.fround(temporalSuccessorDt),
      expectedTemporalSuccessorDt
    )
  ) {
    throw new RangeError(
      'temporal coarse predictor must match the exact immediate successor theta and be disabled on the final substep'
    );
  }
  if (!(cfl > 0)) throw new RangeError('cflFactor must be positive');
  if (!(delta >= 0)) throw new RangeError('deltaScale must be nonnegative');
  if (!(correction >= 0)) {
    throw new RangeError('maxCorrectionMPerS must be nonnegative');
  }
  if (!(wallElastic >= 0) || wallScale < 0 || wallScale > 1 || !(wallGap > 0)) {
    throw new RangeError('wall barrier parameters are outside their admitted ranges');
  }
  if (box.some((value) => !(value > 0))) {
    throw new RangeError('boxDimsM entries must be positive');
  }

  u32(0, plan.parentFieldCapacity);
  u32(1, plan.fineFieldCapacity);
  u32(2, plan.coarseFieldCapacity);
  u32(3, plan.layout.accumulatorOffsetWords);
  u32(4, plan.layout.baselineStateOffsetWords);
  u32(5, plan.layout.combinedStateOffsetWords);
  u32(6, plan.layout.workspaceBindingWordLength);
  for (let index = 0; index < IDENTITY_FIELDS.length; index += 1) {
    u32(7 + index, plan[IDENTITY_FIELDS[index]]);
  }
  i32(20, plan.fineLevel);
  i32(21, plan.coarseLevel);
  u32(22, plan.completionOrdinal);
  u32(23, plan.parentCompletionOrdinal);
  u32(24, plan.fineCompletionOrdinal);
  u32(25, plan.coarseCompletionOrdinal);
  u32(26, coarse.gridNodeCount);
  u32(27, coarseDims[0]);
  u32(28, coarseDims[1]);
  u32(29, coarseDims[2]);
  i32(30, coarse.gridShift);
  f32(31, coarse.gridSpacingM);
  f32(32, dtSeconds);
  f32(33, gravity[0]);
  f32(34, gravity[1]);
  f32(35, gravity[2]);
  f32(36, box[0]);
  f32(37, box[1]);
  f32(38, box[2]);
  f32(39, cfl);
  f32(40, fineDtSeconds);
  f32(41, correction);
  u32(42, SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_WORKGROUP_SIZE);
  f32(43, SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ATOMIC_SCALE);
  f32(44, wallElastic);
  f32(45, wallScale);
  f32(46, wallGap);
  u32(47, execution.finePredictorMutationOrdinal ?? 0);
  u32(48, execution.coarsePredictorMutationOrdinal ?? 0);
  u32(49, execution.fineCorrectionMutationToken?.expectedOrdinal ?? 0);
  u32(50, execution.fineCorrectionMutationToken?.outputOrdinal ?? 0);
  u32(51, execution.coarsePublishMutationToken?.expectedOrdinal ?? 0);
  u32(52, execution.coarsePublishMutationToken?.outputOrdinal ?? 0);
  u32(53, plan.layout.coarsePredictorStateOffsetWords);
  u32(54, execution.refluxLedger.rowCapacity);
  u32(55, execution.resetRefluxLedger ? 1 : 0);
  u32(56, plan.layout.routeProposalOffsetWords);
  u32(57, plan.layout.parentToCoarseOrdinalOffsetWords);
  u32(58, plan.layout.fineImpulseOffsetWords);
  u32(59, substepOrdinal);
  u32(60, substepCount);
  f32(61, macroDtSeconds);
  u32(62, execution.refluxLedger.macroOwnerId ?? execution.arenaGeneration);
  u32(63, execution.refluxLedger.ownerGeneration ?? execution.arenaGeneration);
  u32(64, phaseVolumeTransportAuthority ? 1 : 0);
  u32(
    65,
    phaseVolumeTransportAuthority
      ? mechanicsMaterialPhaseUpload?.phaseRecordCount ?? 0
      : 0
  );
  u32(
    66,
    phaseVolumeTransportAuthority
      ?.phaseVolumeInterfaceRefluxRouteCapacity
      ?? 0
  );
  u32(
    67,
    phaseVolumeTransportAuthority
      ?.phaseVolumeInterfaceRefluxRouteRowWords
      ?? 0
  );
  f32(68, Math.max(0, finiteNumber(ambientPressurePa, 'ambientPressurePa')));
  f32(
    69,
    Math.max(
      0,
      finiteNumber(phaseVolumePressureScale, 'phaseVolumePressureScale')
    )
  );
  f32(
    70,
    Math.max(0, finiteNumber(phaseVolumeDragScale, 'phaseVolumeDragScale'))
  );
  f32(
    71,
    Math.max(
      0,
      finiteNumber(
        phaseVolumeMaxImpulseFraction,
        'phaseVolumeMaxImpulseFraction'
      )
    )
  );
  u32(72, temporalCoarseEnabled ? 1 : 0);
  f32(73, temporalSuccessorDt);
  u32(74, 0);
  u32(75, 0);
  return data;
}

function encodeDirect(encoder, pipeline, bindGroup, label) {
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(1, 1, 1);
  pass.end();
}

function encodeIndirect(encoder, pipeline, bindGroup, indirectBuffer, label) {
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroupsIndirect(indirectBuffer, 0);
  pass.end();
}

function encodeGroupedStages(encoder, stages, label) {
  const pass = encoder.beginComputePass({ label });
  for (const stage of stages) {
    pass.setPipeline(stage.pipeline);
    pass.setBindGroup(0, stage.bindGroup);
    if (stage.indirectBuffer) {
      pass.dispatchWorkgroupsIndirect(stage.indirectBuffer, 0);
    } else {
      pass.dispatchWorkgroups(1, 1, 1);
    }
  }
  pass.end();
}

function gpuTimestampEncoderSpansSupported(gpuTimestampRecorder) {
  return gpuTimestampRecorder?.encoderSpansSupported !== false
    && typeof gpuTimestampRecorder?.beginEncoderSpan === 'function'
    && typeof gpuTimestampRecorder?.endEncoderSpan === 'function';
}

function gpuTimestampEncoderSpansActive(gpuTimestampRecorder) {
  return gpuTimestampRecorder?.active === true
    && gpuTimestampEncoderSpansSupported(gpuTimestampRecorder);
}

export function createSchroederCrossLevelRefluxLedgerGpu(device, {
  parentFieldCapacity,
  coarseFieldCapacity = parentFieldCapacity,
  completionOrdinal = 1,
  fineSubstepCount = 1,
  fineLevel = 0,
  coarseLevel = fineLevel + 1,
  coarseGridSpacingM = 1,
  label = 'ulg-schroeder-cross-level-reflux-ledger'
} = {}) {
  if (!device?.createBuffer || !device?.queue?.writeBuffer) {
    throw new TypeError(
      'cross-level reflux ledger requires a WebGPU-like device and queue'
    );
  }
  const layout = createSchroederCrossLevelRefluxLedgerLayout({
    parentFieldCapacity,
    coarseFieldCapacity
  });
  const maxBufferSize = positiveInteger(
    device.limits?.maxBufferSize ?? 256 * 1024 * 1024,
    'device.limits.maxBufferSize',
    Number.MAX_SAFE_INTEGER
  );
  const maxStorageBufferBindingSize = positiveInteger(
    device.limits?.maxStorageBufferBindingSize ?? 128 * 1024 * 1024,
    'device.limits.maxStorageBufferBindingSize',
    Number.MAX_SAFE_INTEGER
  );
  if (
    layout.byteLength > maxBufferSize
    || layout.byteLength > maxStorageBufferBindingSize
  ) {
    throw new RangeError(
      'cross-level reflux ledger exceeds WebGPU storage-buffer limits'
    );
  }
  const buffer = createOwnedBuffer(
    device,
    label,
    layout.byteLength,
    GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  );
  const generation = ++refluxLedgerGeneration;
  const header = createSchroederCrossLevelRefluxLedgerHeader({
    rowCapacity: layout.rowCapacity,
    completionOrdinal,
    fineSubstepCount,
    fineLevel,
    coarseLevel,
    coarseGridSpacingM,
    macroOwnerId: completionOrdinal,
    macroOwnerGeneration: generation
  });
  device.queue.writeBuffer(
    buffer,
    0,
    header
  );
  let destroyed = false;
  const ledger = {
    schema: ULG_SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_SCHEMA,
    status: 'schroeder-cross-level-reflux-ledger-gpu-ready',
    ...layout,
    deviceId: webGpuDeviceId(device),
    macroOwnerId: header[82],
    ownerGeneration: generation,
    completionOrdinal: header[7],
    fineSubstepCount: header[54],
    fineLevel: new Int32Array(header.buffer)[77],
    coarseLevel: new Int32Array(header.buffer)[78],
    coarseGridSpacingM: new Float32Array(header.buffer)[79],
    buffer,
    evidenceBuffer: buffer,
    evidenceOffsetBytes: 0,
    evidenceByteLength:
      SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS * UINT32_BYTES,
    fullParticleReadbackPerformed: false,
    normalHotLoopReadbackFree: true,
    destroy() {
      if (destroyed) return false;
      buffer.destroy?.();
      destroyed = true;
      const ownership = refluxLedgerOwnership.get(this);
      if (ownership) ownership.destroyed = true;
      this.status = 'schroeder-cross-level-reflux-ledger-gpu-destroyed';
      return true;
    }
  };
  const ownerToken = Object.freeze({ generation, deviceId: ledger.deviceId });
  Object.defineProperty(ledger, 'ownerToken', {
    value: ownerToken,
    enumerable: false
  });
  refluxLedgerOwnership.set(ledger, {
    ownerToken,
    generation,
    macroOwnerId: ledger.macroOwnerId,
    completionOrdinal: ledger.completionOrdinal,
    deviceId: ledger.deviceId,
    buffer,
    layoutByteLength: layout.byteLength,
    rowCapacity: layout.rowCapacity,
    fineSubstepCount: ledger.fineSubstepCount,
    fineLevel: ledger.fineLevel,
    coarseLevel: ledger.coarseLevel,
    coarseGridSpacingM: ledger.coarseGridSpacingM,
    destroyed: false
  });
  Object.defineProperty(ledger, REFLUX_LEDGER_ORIGIN_VALIDATOR, {
    value: (candidateDevice, candidateLedger, options = {}) => (
      candidateLedger === ledger
      && validateLocalSchroederCrossLevelRefluxLedgerGpuOwnership(
        candidateDevice,
        candidateLedger,
        options
      )
    ),
    enumerable: false,
    configurable: false,
    writable: false
  });
  return ledger;
}

export function createSchroederSpatialParentFieldMechanicsWorkspaceGpu(device, {
  parentFieldCapacity,
  fineFieldCapacity = parentFieldCapacity,
  arenaCount = 3,
  externalRefluxLedgerRequired = false,
  gpuTimestampRecorder = null,
  label = 'ulg-schroeder-spatial-parent-field-mechanics-workspace'
} = {}) {
  assertDevice(device);
  if (typeof externalRefluxLedgerRequired !== 'boolean') {
    throw new TypeError('externalRefluxLedgerRequired must be a boolean');
  }
  const workspaceTimestampSpansActive = () =>
    gpuTimestampEncoderSpansActive(gpuTimestampRecorder);
  const layout = createSchroederSpatialParentFieldMechanicsWorkspaceLayout({
    parentFieldCapacity,
    fineFieldCapacity
  });
  const localRefluxLayout = externalRefluxLedgerRequired
    ? null
    : createSchroederCrossLevelRefluxLedgerLayout({
        parentFieldCapacity
      });
  const resolvedArenaCount = positiveInteger(arenaCount, 'arenaCount', 8);
  const maxBufferSize = positiveInteger(
    device.limits?.maxBufferSize ?? 256 * 1024 * 1024,
    'device.limits.maxBufferSize',
    Number.MAX_SAFE_INTEGER
  );
  const maxStorageBufferBindingSize = positiveInteger(
    device.limits?.maxStorageBufferBindingSize ?? maxBufferSize,
    'device.limits.maxStorageBufferBindingSize',
    Number.MAX_SAFE_INTEGER
  );
  const minStorageBufferOffsetAlignment = positiveInteger(
    device.limits?.minStorageBufferOffsetAlignment ?? 256,
    'device.limits.minStorageBufferOffsetAlignment',
    Number.MAX_SAFE_INTEGER
  );
  const maxUniformBufferBindingSize = positiveInteger(
    device.limits?.maxUniformBufferBindingSize ?? 64 * 1024,
    'device.limits.maxUniformBufferBindingSize',
    Number.MAX_SAFE_INTEGER
  );
  if (
    layout.byteLength > maxBufferSize
    || layout.workspaceBindingByteLength > maxStorageBufferBindingSize
    || layout.parentToCoarseOrdinalByteLength > maxStorageBufferBindingSize
    || layout.parentToCoarseOrdinalByteOffset
      % minStorageBufferOffsetAlignment !== 0
    || (localRefluxLayout != null && (
      localRefluxLayout.byteLength > maxBufferSize
      || localRefluxLayout.byteLength > maxStorageBufferBindingSize
    ))
  ) {
    throw new RangeError('parent-field mechanics workspace exceeds WebGPU buffer limits');
  }
  const maxStorageBuffersPerShaderStage = positiveInteger(
    device.limits?.maxStorageBuffersPerShaderStage ?? 8,
    'device.limits.maxStorageBuffersPerShaderStage',
    0xffff
  );
  if (maxStorageBuffersPerShaderStage < 10) {
    throw new RangeError('parent-field mechanics requires ten storage bindings');
  }
  if (
    SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PARAMS_BYTES
      > maxUniformBufferBindingSize
  ) {
    throw new RangeError('parent-field mechanics params exceed the uniform-buffer limit');
  }

  const module = device.createShaderModule({
    label: `${label}-shader`,
    code: schroederSpatialParentFieldMechanicsWorkspaceWgsl
  });
  const explicitLayoutsAvailable =
    typeof device.createBindGroupLayout === 'function'
    && typeof device.createPipelineLayout === 'function';
  const createSharedLayout = (suffix, bindings) => {
    if (!explicitLayoutsAvailable) return null;
    const bindGroupLayout = device.createBindGroupLayout({
      label: `${label}-${suffix}-bind-group-layout`,
      entries: bindings.map((binding) => ({
        binding,
        visibility: globalThis.GPUShaderStage?.COMPUTE ?? 4,
        buffer: {
          type: binding === 5
            ? 'uniform'
            : ([0, 6, 7, 8, 9, 10].includes(binding)
                ? 'read-only-storage'
                : 'storage')
        }
      }))
    });
    return Object.freeze({
      bindGroupLayout,
      pipelineLayout: device.createPipelineLayout({
        label: `${label}-${suffix}-pipeline-layout`,
        bindGroupLayouts: [bindGroupLayout]
      })
    });
  };
  const predictorSharedLayout = createSharedLayout(
    'predictor-shared',
    PREDICTOR_PIPELINE_BINDINGS
  );
  const terminalSharedLayout = createSharedLayout(
    'terminal-shared',
    TERMINAL_PIPELINE_BINDINGS
  );
  const pipeline = (name, entryPoint) => device.createComputePipeline({
    label: `${label}-${entryPoint.replaceAll('_', '-')}-pipeline`,
    layout: PREDICTOR_PIPELINE_NAMES.has(name)
      ? (predictorSharedLayout?.pipelineLayout ?? 'auto')
      : TERMINAL_PIPELINE_NAMES.has(name)
        ? (terminalSharedLayout?.pipelineLayout ?? 'auto')
        : 'auto',
    compute: { module, entryPoint }
  });
  const pipelines = Object.freeze({
    initialize: pipeline('initialize', 'initialize_parent_field_workspace'),
    registerReflux: pipeline('registerReflux', 'register_reflux_coarse_registry'),
    restrictFine: pipeline('restrictFine', 'restrict_fine_field_state'),
    finalizeBaseline: pipeline('finalizeBaseline', 'finalize_fine_parent_baseline'),
    injectCoarse: pipeline('injectCoarse', 'inject_coarse_native_state'),
    validateRegistry: pipeline('validateRegistry', 'validate_reflux_coarse_registry_mass'),
    updatePredictors: pipeline('updatePredictors', 'update_parent_field_predictors'),
    contactPredictors: pipeline('contactPredictors', 'contact_parent_field_predictors'),
    sealPredictors: pipeline('sealPredictors', 'seal_parent_field_predictors'),
    beginFine: pipeline('beginFine', 'begin_fine_velocity_correction'),
    validateFine: pipeline('validateFine', 'validate_fine_velocity_correction'),
    validateRoutedCoarse: pipeline('validateRoutedCoarse', 'validate_routed_coarse_cfl'),
    sealFineAlpha: pipeline('sealFineAlpha', 'seal_fine_correction_alpha'),
    prepareFine: pipeline('prepareFine', 'prepare_fine_transaction'),
    applyFine: pipeline('applyFine', 'apply_fine_velocity_correction'),
    applyFineHeat: pipeline('applyFineHeat', 'apply_fine_route_heat'),
    commitRefluxRows:
      pipeline('commitRefluxRows', 'commit_routed_reflux_rows'),
    commitReflux: pipeline('commitReflux', 'commit_routed_reflux'),
    finalizeFine: pipeline('finalizeFine', 'finalize_fine_velocity_correction'),
    admitCrossLevelPhaseVolume:
      pipeline('admitCrossLevelPhaseVolume', 'admit_cross_level_phase_volume'),
    proposeCrossLevelPhaseVolume:
      pipeline('proposeCrossLevelPhaseVolume', 'propose_cross_level_phase_volume'),
    initializeTerminal: pipeline('initializeTerminal', 'initialize_coarse_terminal_workspace'),
    registerTerminal: pipeline('registerTerminal', 'register_coarse_terminal_registry'),
    sealTerminal: pipeline('sealTerminal', 'seal_coarse_terminal_workspace'),
    prevalidateCoarse: pipeline('prevalidateCoarse', 'begin_coarse_terminal_validation'),
    beginCoarse: pipeline('beginCoarse', 'begin_coarse_velocity_publish'),
    validateCoarse: pipeline('validateCoarse', 'validate_coarse_velocity_publish'),
    sealCoarse: pipeline('sealCoarse', 'seal_coarse_velocity_publish'),
    prepareCoarse: pipeline('prepareCoarse', 'prepare_coarse_transaction'),
    applyCoarseRows: pipeline('applyCoarseRows', 'apply_coarse_reflux_rows'),
    applyCoarse: pipeline('applyCoarse', 'apply_coarse_velocity_publish'),
    commitCoarse: pipeline('commitCoarse', 'commit_coarse_reflux'),
    finalizeCoarse: pipeline('finalizeCoarse', 'finalize_coarse_velocity_publish')
  });
  const deviceId = webGpuDeviceId(device);
  const storageUsage = GPU_BUFFER_USAGE.STORAGE
    | GPU_BUFFER_USAGE.COPY_SRC
    | GPU_BUFFER_USAGE.COPY_DST;
  const indirectUsage = GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.COPY_DST;
  const arenas = [];
  const allocatedArenaBuffers = [];
  const allocateArenaBuffer = (...args) => {
    const buffer = createOwnedBuffer(device, ...args);
    allocatedArenaBuffers.push(buffer);
    return buffer;
  };
  try {
    for (let arenaIndex = 0; arenaIndex < resolvedArenaCount; arenaIndex += 1) {
      const arenaLabel = `${label}-arena-${arenaIndex}`;
      arenas.push({
        arenaIndex,
        inUse: false,
        retired: false,
        token: null,
        destroyedOwnedBuffers: new Set(),
        workspaceBuffer: allocateArenaBuffer(
          `${arenaLabel}-workspace`,
          layout.byteLength,
          storageUsage
        ),
        refluxLedgerBuffer: localRefluxLayout == null
          ? null
          : allocateArenaBuffer(
              `${arenaLabel}-reflux-ledger`,
              localRefluxLayout.byteLength,
              storageUsage
            ),
        paramsBuffer: allocateArenaBuffer(
          `${arenaLabel}-params`,
          SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PARAMS_BYTES,
          GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
        ),
        parentIndirectBuffer: allocateArenaBuffer(
          `${arenaLabel}-parent-indirect`,
          3 * UINT32_BYTES,
          indirectUsage
        ),
        fineIndirectBuffer: allocateArenaBuffer(
          `${arenaLabel}-fine-indirect`,
          3 * UINT32_BYTES,
          indirectUsage
        ),
        coarseIndirectBuffer: allocateArenaBuffer(
          `${arenaLabel}-coarse-indirect`,
          3 * UINT32_BYTES,
          indirectUsage
        )
      });
    }
  } catch (error) {
    try {
      destroyOwnedBuffersRetrying(
        allocatedArenaBuffers,
        'parent-field mechanics partial arena allocation'
      );
    } catch {
      // Preserve the originating allocation error after exhausting cleanup.
    }
    throw error;
  }
  const arenaBuffers = (arena) => [
    arena.workspaceBuffer,
    arena.refluxLedgerBuffer,
    arena.paramsBuffer,
    arena.parentIndirectBuffer,
    arena.fineIndirectBuffer,
    arena.coarseIndirectBuffer
  ];
  const retainedGpuBufferBytes = arenas.reduce(
    (sum, arena) => sum + arenaBuffers(arena).reduce(
      (arenaSum, buffer) => arenaSum + Number(buffer?.size ?? 0),
      0
    ),
    0
  );
  const executionOwnership = new WeakMap();
  const executionRetirements = new WeakMap();
  const releasedExecutions = new WeakSet();
  const releaseInFlight = new WeakSet();
  const failedTerminalEncodingOrigins = new WeakMap();
  const pendingFailedTerminalEncodings = new Set();
  let serial = 0;
  let destroyed = false;
  let deviceLossObserved = false;
  let runtime = null;

  function destroyArenaOwnedBuffers(arena) {
    const failures = [];
    for (const buffer of arenaBuffers(arena)) {
      if (!buffer || arena.destroyedOwnedBuffers.has(buffer)) continue;
      try {
        buffer.destroy?.();
        arena.destroyedOwnedBuffers.add(buffer);
      } catch (error) {
        if (buffer.destroyed === true) {
          arena.destroyedOwnedBuffers.add(buffer);
        } else {
          failures.push(error);
        }
      }
    }
    if (failures.length > 0) {
      throw failures.length === 1
        ? failures[0]
        : new AggregateError(
          failures,
          'parent-field mechanics device-loss arena retirement was incomplete'
        );
    }
    return true;
  }

  function createExecutionRetirementRecord(execution, ownership) {
    let resolveCompletion;
    const completionPromise = new Promise((resolve) => {
      resolveCompletion = resolve;
    });
    const record = {
      execution,
      ownership,
      completed: false,
      completionPromise,
      resolveCompletion,
      activeAttempt: null,
      nextAttemptOrdinal: 0,
      deviceLossEvidence: null
    };
    executionRetirements.set(execution, record);
    return record;
  }

  function retirementRecordFor(execution) {
    const record = executionRetirements.get(execution);
    if (
      !record
      || execution?.ownerRuntime !== runtime
      || record.ownership?.token == null
      || execution.arenaIndex !== record.ownership.arena.arenaIndex
      || execution.arenaGeneration !== record.ownership.token.serial
    ) {
      const error = new Error(
        'parent-field mechanics workspace execution is not owned by this runtime'
      );
      error.code = 'ERR_SCHROEDER_PARENT_FIELD_MECHANICS_FOREIGN_EXECUTION';
      throw error;
    }
    return record;
  }

  function acquireArena() {
    if (destroyed) throw new Error('parent-field mechanics workspace runtime is destroyed');
    if (deviceLossObserved) {
      const error = new Error(
        'parent-field mechanics workspace runtime observed device loss'
      );
      error.code = 'ERR_SCHROEDER_PARENT_FIELD_MECHANICS_DEVICE_LOST';
      throw error;
    }
    const arena = arenas.find(
      (candidate) => candidate.inUse === false && candidate.retired !== true
    );
    if (!arena) {
      const error = new Error('parent-field mechanics workspaces are under backpressure');
      error.code = 'ERR_SCHROEDER_PARENT_FIELD_MECHANICS_ARENA_EXHAUSTED';
      throw error;
    }
    const token = Object.freeze({ serial: ++serial, arenaIndex: arena.arenaIndex });
    arena.inUse = true;
    arena.token = token;
    return { arena, token };
  }

  function releaseArena(arena, token) {
    if (!arena.inUse || arena.token !== token) return false;
    arena.inUse = false;
    arena.token = null;
    return true;
  }

  function retainFailedTerminalEncoding(error, origin) {
    const handle = Object.freeze({
      schema:
        'peercompute.ulg.schroeder-parent-field-failed-terminal-encoding.v1',
      terminalKind: 'coarse-terminal'
    });
    failedTerminalEncodingOrigins.set(handle, origin);
    pendingFailedTerminalEncodings.add(handle);
    const decorateFailure = (failure) => {
      Object.defineProperties(failure, {
        failedEncoding: {
          value: handle,
          enumerable: false,
          configurable: false,
          writable: false
        },
        code: {
          value:
            'ERR_SCHROEDER_PARENT_FIELD_MECHANICS_FAILED_ENCODING_PENDING_DISCARD',
          enumerable: true,
          configurable: false,
          writable: false
        }
      });
      return failure;
    };
    try {
      return decorateFailure(error);
    } catch {
      const failure = new Error(
        `coarse-terminal encoding failed after touching its caller encoder: ${
          error?.message ?? String(error)
        }`,
        { cause: error }
      );
      return decorateFailure(failure);
    }
  }

  function discardFailedTerminalEncoding(
    handle,
    { discardedEncoder = false } = {}
  ) {
    if (discardedEncoder !== true) {
      throw new TypeError(
        'discardFailedTerminalEncoding requires { discardedEncoder: true }'
      );
    }
    const origin = handle && failedTerminalEncodingOrigins.get(handle);
    if (
      !origin
      || !pendingFailedTerminalEncodings.has(handle)
      || origin.arena.inUse !== true
      || origin.arena.token !== origin.token
    ) {
      throw new Error('failed terminal encoding handle is stale or foreign');
    }
    if (origin.fusedTransaction != null) {
      releaseSchroederFusedCoarseTerminalStageProducer(
        device,
        origin.fusedTransaction,
        origin.producerCapability
      );
    } else if (origin.mutationToken != null) {
      origin.parentFieldView.coarseFieldView.ownerRuntime.discardStateMutation(
        origin.mutationToken,
        { discardedEncoder: true }
      );
    }
    if (!releaseArena(origin.arena, origin.token)) {
      throw new Error('failed terminal encoding arena ownership changed');
    }
    pendingFailedTerminalEncodings.delete(handle);
    failedTerminalEncodingOrigins.delete(handle);
    return true;
  }

  function assertPredictorInputs(
    parentFieldView,
    fineProjection,
    coarseProjection,
    fusedFineSubstepTransaction = null
  ) {
    const descriptor = validateSchroederSpatialParentFieldViewDescriptor(
      parentFieldView,
      {
        generationId: parentFieldView?.generationId,
        fineLevel: parentFieldView?.fineLevel,
        coarseLevel: parentFieldView?.coarseLevel,
        exactLevelCount: 2
      }
    );
    if (
      descriptor.admitted !== true
      || parentFieldView?.schema !== ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA
      || parentFieldView?.fineFieldView?.schema
        !== ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA
      || parentFieldView?.coarseFieldView?.schema
        !== ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA
      || parentFieldView?.exactLevelCount !== 2
      || parentFieldView.coarseLevel !== parentFieldView.fineLevel + 1
      || parentFieldView.parentFieldCapacity !== layout.parentFieldCapacity
      || parentFieldView.fineFieldCapacity !== layout.fineFieldCapacity
      || !liveSubmittedExecution(parentFieldView)
      || !liveSubmittedExecution(parentFieldView.fineFieldView)
      || !liveSubmittedExecution(parentFieldView.coarseFieldView)
      || parentFieldView.fineFieldView !== parentFieldView.mechanicsFieldViews?.[0]
      || parentFieldView.coarseFieldView !== parentFieldView.mechanicsFieldViews?.[1]
      || !exactIdentityMatches(parentFieldView.fineFieldView, parentFieldView)
      || !exactIdentityMatches(parentFieldView.coarseFieldView, parentFieldView)
      || !(fusedFineSubstepTransaction == null
        ? projectionMatchesField(
            device,
            fineProjection,
            parentFieldView.fineFieldView,
            parentFieldView.fineLevel
          )
        : fusedP2gMatchesTransaction(
            device,
            fineProjection,
            parentFieldView.fineFieldView,
            fusedFineSubstepTransaction
          ))
      || !projectionMatchesField(
        device,
        coarseProjection,
        parentFieldView.coarseFieldView,
        parentFieldView.coarseLevel
      )
      || !webGpuBufferMatchesDevice(parentFieldView.parentFieldViewBuffer, device)
      || parentFieldView.indirectDispatchBuffer
        !== parentFieldView.parentFieldViewBuffer
      || parentFieldView.fineIndirectDispatchBuffer
        !== parentFieldView.parentFieldViewBuffer
      || parentFieldView.coarseIndirectDispatchBuffer
        !== parentFieldView.parentFieldViewBuffer
      || parentFieldView.indirectDispatchOffsetBytes
        !== SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_DISPATCH_OFFSET_WORDS * UINT32_BYTES
      || parentFieldView.fineIndirectDispatchOffsetBytes
        !== SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_FINE_DISPATCH_OFFSET_WORDS * UINT32_BYTES
      || parentFieldView.coarseIndirectDispatchOffsetBytes
        !== SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_COARSE_DISPATCH_OFFSET_WORDS * UINT32_BYTES
      || Number(parentFieldView.parentFieldViewBuffer?.size ?? 0)
        < Number(parentFieldView.layout?.byteLength ?? 0)
    ) {
      throw new TypeError(
        'parent-field mechanics predictors require exact submitted two-level sparse fields and topology from one generation'
      );
    }
  }

  function assertCoarseTerminalInputs(
    parentFieldView,
    coarseGridUpdate,
    refluxLedger,
    fineSubstepCount,
    fusedCoarseTerminalTransaction = null,
    pendingMutationToken = null
  ) {
    const descriptor = validateSchroederSpatialParentFieldViewDescriptor(
      parentFieldView,
      {
        generationId: parentFieldView?.generationId,
        fineLevel: parentFieldView?.fineLevel,
        coarseLevel: parentFieldView?.coarseLevel,
        exactLevelCount: 2
      }
    );
    const coarseFieldView = parentFieldView?.coarseFieldView ?? null;
    const sourceProjection = coarseGridUpdate?.sourceProjection ?? null;
    if (
      descriptor.admitted !== true
      || parentFieldView?.schema !== ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA
      || parentFieldView?.fineFieldView?.schema
        !== ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA
      || coarseFieldView?.schema
        !== ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA
      || parentFieldView?.exactLevelCount !== 2
      || parentFieldView.coarseLevel !== parentFieldView.fineLevel + 1
      || parentFieldView.parentFieldCapacity !== layout.parentFieldCapacity
      || parentFieldView.fineFieldCapacity !== layout.fineFieldCapacity
      || !liveSubmittedExecution(parentFieldView)
      || !liveSubmittedExecution(parentFieldView.fineFieldView)
      || !liveSubmittedExecution(coarseFieldView)
      || parentFieldView.fineFieldView !== parentFieldView.mechanicsFieldViews?.[0]
      || coarseFieldView !== parentFieldView.mechanicsFieldViews?.[1]
      || !exactIdentityMatches(parentFieldView.fineFieldView, parentFieldView)
      || !exactIdentityMatches(coarseFieldView, parentFieldView)
      || (fusedCoarseTerminalTransaction == null && (
        coarseGridUpdate?.fusedCoarseTerminalTransaction != null
        || sourceProjection?.fusedCoarseTerminalTransaction != null
      ))
      || !(fusedCoarseTerminalTransaction == null
        ? gridUpdateMatchesField(
            device,
            coarseGridUpdate,
            sourceProjection,
            coarseFieldView,
            { pendingMutationToken }
          )
        : fusedCoarseGridUpdateMatchesTransaction(
            device,
            coarseGridUpdate,
            sourceProjection,
            coarseFieldView,
            fusedCoarseTerminalTransaction
          ))
      || !projectionMatchesField(
        device,
        sourceProjection,
        coarseFieldView,
        parentFieldView.coarseLevel,
        { requireCurrent: false }
      )
      || coarseGridUpdate?.mechanicsFieldEnergyReceipt?.deferSeal !== true
      || coarseGridUpdate?.mechanicsFieldEnergyReceipt?.schema
        !== 'peercompute.ulg.schroeder-mechanics-field-energy-receipt.v3'
      || coarseGridUpdate?.mechanicsFieldEnergyReceipt?.status
        !== 'heat-building-deferred-to-reflux-owner'
      || coarseGridUpdate?.mechanicsFieldEnergyReceipt?.fieldMutationOrdinal
        !== coarseGridUpdate?.mechanicsFieldMutationOutputOrdinal
      || coarseGridUpdate?.fieldStateUpdateSubmittedInPlace !== true
      || coarseGridUpdate?.mechanicsFieldMutationInputStateEncoding
        !== SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT
      || coarseGridUpdate?.mechanicsFieldMutationOutputOrdinal
        !== coarseGridUpdate?.mechanicsFieldMutationInputOrdinal + 1
      || !Number.isInteger(fineSubstepCount)
      || fineSubstepCount < 1
      || fineSubstepCount > 4
      || (fusedCoarseTerminalTransaction != null && (
        fusedCoarseTerminalTransaction.coarseFieldView !== coarseFieldView
        || fusedCoarseTerminalTransaction.microepochAuthority?.parentFieldView
          !== parentFieldView
        || fusedCoarseTerminalTransaction.refluxLedger !== refluxLedger
        || fusedCoarseTerminalTransaction.macroAuthority?.fineSubstepCount
          !== fineSubstepCount
        || fusedCoarseTerminalTransaction.substepOrdinal !== fineSubstepCount
        || fusedCoarseTerminalTransaction.particleContinuation == null
        || fusedCoarseTerminalTransaction.coarseTerminalMutation == null
      ))
      || refluxLedger == null
      || !validateSchroederCrossLevelRefluxLedgerGpuOwnership(
        device,
        refluxLedger,
        {
          minimumCoarseFieldCapacity: parentFieldView.coarseFieldCapacity,
          fineSubstepCount,
          fineLevel: parentFieldView.fineLevel,
          coarseLevel: parentFieldView.coarseLevel,
          coarseGridSpacingM: coarseFieldView.gridSpacingM
        }
      )
      || !webGpuBufferMatchesDevice(parentFieldView.parentFieldViewBuffer, device)
      || parentFieldView.coarseIndirectDispatchBuffer
        !== parentFieldView.parentFieldViewBuffer
      || parentFieldView.coarseIndirectDispatchOffsetBytes
        !== SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_COARSE_DISPATCH_OFFSET_WORDS
          * UINT32_BYTES
      || Number(parentFieldView.parentFieldViewBuffer?.size ?? 0)
        < Number(parentFieldView.layout?.byteLength ?? 0)
    ) {
      throw new TypeError(
        'coarse terminal requires exact submitted topology, one actual deferred coarse grid update, and its live macro ledger'
      );
    }
  }

  function resourcesFor(execution) {
    const resources = new Map([
      [0, execution.parentFieldView.parentFieldViewBuffer],
      [1, execution.parentFieldView.fineFieldView.fieldViewBuffer],
      [2, execution.parentFieldView.coarseFieldView.fieldViewBuffer],
      [3, execution.workspaceBuffer],
      [4, execution.refluxLedger.buffer],
      [5, execution.paramsBuffer],
      [11, execution.workspaceBuffer]
    ]);
    const transport = execution.phaseVolumeTransportAuthority;
    if (transport) {
      resources.set(
        6,
        transport.phaseVolumeInterfaceProposalControlBuffer
      );
      resources.set(
        7,
        transport.phaseVolumeInterfaceRefluxRouteBuffer
      );
      resources.set(8, transport.finePhaseVolumeMomentBuffer);
      resources.set(9, transport.coarsePhaseVolumeMomentBuffer);
      resources.set(10, execution.mechanicsMaterialPhaseBuffer);
    }
    return resources;
  }

  function resolveRefluxLedger(
    arena,
    refluxLedger,
    parentFieldView,
    token,
    fineSubstepCount
  ) {
    const requiredCoarseCapacity = parentFieldView.coarseFieldCapacity;
    if (refluxLedger == null) {
      if (externalRefluxLedgerRequired) {
        throw new TypeError(
          'parent-field mechanics external-ledger runtime requires one live reflux ledger'
        );
      }
      return {
        schema: ULG_SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_SCHEMA,
        status: 'schroeder-cross-level-reflux-ledger-arena-local',
        ...localRefluxLayout,
        buffer: arena.refluxLedgerBuffer,
        evidenceBuffer: arena.refluxLedgerBuffer,
        evidenceOffsetBytes: 0,
        evidenceByteLength:
          SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS * UINT32_BYTES,
        macroOwnerId: token.serial,
        ownerGeneration: token.serial,
        completionOrdinal: token.serial,
        fineSubstepCount,
        fineLevel: parentFieldView.fineLevel,
        coarseLevel: parentFieldView.coarseLevel,
        coarseGridSpacingM:
          Math.fround(parentFieldView.coarseFieldView.gridSpacingM),
        borrowed: false
      };
    }
    if (
      refluxLedger.schema !== ULG_SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_SCHEMA
      || refluxLedger.status !== 'schroeder-cross-level-reflux-ledger-gpu-ready'
      || !Number.isInteger(refluxLedger.rowCapacity)
      || refluxLedger.rowCapacity < requiredCoarseCapacity
      || Number(refluxLedger.byteLength ?? 0) > maxBufferSize
      || Number(refluxLedger.byteLength ?? 0) > maxStorageBufferBindingSize
      || Number(refluxLedger.buffer?.size ?? 0) < Number(refluxLedger.byteLength ?? 0)
      || !validateSchroederCrossLevelRefluxLedgerGpuOwnership(
        device,
        refluxLedger,
        {
          minimumCoarseFieldCapacity: requiredCoarseCapacity,
          fineSubstepCount,
          fineLevel: parentFieldView.fineLevel,
          coarseLevel: parentFieldView.coarseLevel,
          coarseGridSpacingM: parentFieldView.coarseFieldView.gridSpacingM
        }
      )
    ) {
      throw new TypeError(
        'parent-field mechanics requires one live same-device reflux ledger with sufficient keyed capacity'
      );
    }
    return refluxLedger;
  }

  function bindGroup(execution, pipelineName) {
    const pipelineObject = pipelines[pipelineName];
    const resources = resourcesFor(execution);
    return device.createBindGroup({
      label: `${label}-${pipelineName}-group-${execution.arenaGeneration}`,
      layout: pipelineObject.getBindGroupLayout(0),
      entries: PIPELINE_BINDINGS[pipelineName].map((binding) => ({
        binding,
        resource: binding === 3
          ? {
              buffer: resources.get(binding),
              offset: 0,
              size: layout.workspaceBindingByteLength
            }
          : binding === 11
            ? {
                buffer: resources.get(binding),
                offset: layout.parentToCoarseOrdinalByteOffset,
                size: layout.parentToCoarseOrdinalByteLength
              }
            : { buffer: resources.get(binding) }
      }))
    });
  }

  function sharedBindGroup(execution, sharedLayout, bindings, suffix) {
    if (!sharedLayout) return null;
    const resources = resourcesFor(execution);
    return device.createBindGroup({
      label: `${label}-${suffix}-group-${execution.arenaGeneration}`,
      layout: sharedLayout.bindGroupLayout,
      entries: bindings.map((binding) => ({
        binding,
        resource: binding === 3
          ? {
              buffer: resources.get(binding),
              offset: 0,
              size: layout.workspaceBindingByteLength
            }
          : binding === 11
            ? {
                buffer: resources.get(binding),
                offset: layout.parentToCoarseOrdinalByteOffset,
                size: layout.parentToCoarseOrdinalByteLength
              }
            : { buffer: resources.get(binding) }
      }))
    });
  }

  function encodeWorkspaceStages(encoder, stages, sequenceLabel) {
    if (!workspaceTimestampSpansActive()) {
      encodeGroupedStages(encoder, stages, sequenceLabel);
      return;
    }
    for (const stage of stages) {
      const span = gpuTimestampRecorder.beginEncoderSpan(encoder, {
        producerId: `schroeder-parent-workspace:${stage.name}`,
        stage: stage.name,
        spanClass: 'same-production-command-encoder'
      });
      if (stage.indirectBuffer) {
        encodeIndirect(
          encoder,
          stage.pipeline,
          stage.bindGroup,
          stage.indirectBuffer,
          `${sequenceLabel}:${stage.name}`
        );
      } else {
        encodeDirect(
          encoder,
          stage.pipeline,
          stage.bindGroup,
          `${sequenceLabel}:${stage.name}`
        );
      }
      gpuTimestampRecorder.endEncoderSpan(encoder, span);
    }
  }

  function encodePredictors(encoder, {
    parentFieldView,
    fineP2gProjection,
    coarseP2gProjection,
    dt,
    gravityMPerS2 = [0, -9.80665, 0],
    boxDimsM,
    cflFactor = 0.4,
    maxCorrectionMPerS = 0,
    wallBarrierElasticStiffnessNPerM = 0,
    wallBarrierContactScale = 1,
    wallBarrierMinGapM = 1e-6,
    fineDt = dt,
    macroDt = dt,
    fineSubstepOrdinal = 0,
    terminalOperation = false,
    refluxLedger = null,
    fineSubstepCount = refluxLedger?.fineSubstepCount ?? 1,
    fusedFineSubstepTransaction = null
  } = {}) {
    assertEncoder(encoder);
    assertPredictorInputs(
      parentFieldView,
      fineP2gProjection,
      coarseP2gProjection,
      fusedFineSubstepTransaction
    );
    const { arena, token } = acquireArena();
    try {
      const resolvedRefluxLedger = resolveRefluxLedger(
        arena,
        refluxLedger,
        parentFieldView,
        token,
        fineSubstepCount
      );
      const resolvedSubstepOrdinal = Number(fineSubstepOrdinal);
      const resolvedSubstepCount = Number(fineSubstepCount);
      const resolvedMacroDt = Number(macroDt);
      const expectedThetaDt = Math.fround(
        ((resolvedSubstepOrdinal + 1) / resolvedSubstepCount)
          * resolvedMacroDt
      );
      const temporalCoarsePredictorRequired =
        resolvedSubstepOrdinal + 1 < resolvedSubstepCount;
      const expectedTemporalCoarseSuccessorDt =
        temporalCoarsePredictorRequired
          ? Math.fround(
              ((resolvedSubstepOrdinal + 2) / resolvedSubstepCount)
                * resolvedMacroDt
            )
          : null;
      if (
        fusedFineSubstepTransaction != null
        && (
          resolvedRefluxLedger !== fusedFineSubstepTransaction.refluxLedger
          || fusedFineSubstepTransaction.fineFieldView
            !== parentFieldView.fineFieldView
          || fusedFineSubstepTransaction.substepOrdinal
            !== Number(fineSubstepOrdinal)
          || fusedFineSubstepTransaction.macroAuthority?.fineSubstepCount
            !== Number(fineSubstepCount)
          || !Object.is(
            fineP2gProjection.dt,
            fusedFineSubstepTransaction.macroAuthority?.fineDt
          )
          || !Object.is(
            Math.fround(coarseP2gProjection.dt),
            expectedThetaDt
          )
          || !Object.is(
            Number(fineDt),
            fusedFineSubstepTransaction.macroAuthority?.fineDt
          )
          || !Object.is(
            Number(macroDt),
            fusedFineSubstepTransaction.macroAuthority?.macroDt
          )
          || !Object.is(
            Math.fround(Number(dt)),
            expectedThetaDt
          )
          || fineP2gProjection.mechanicsFieldTemporalCoarsePredictorEnabled
            !== false
          || fineP2gProjection.mechanicsFieldTemporalCoarsePredictorRole
            !== 'disabled'
          || fineP2gProjection.mechanicsFieldTemporalCoarsePredictorSuccessorDt
            != null
          || !Object.is(
            fineP2gProjection.mechanicsFieldTemporalCoarsePredictorCurrentDt,
            Math.fround(Number(fineDt))
          )
          || coarseP2gProjection.mechanicsFieldTemporalCoarsePredictorEnabled
            !== temporalCoarsePredictorRequired
          || coarseP2gProjection.mechanicsFieldTemporalCoarsePredictorRole
            !== (temporalCoarsePredictorRequired
              ? 'immediate-successor-coarse-predictor'
              : 'disabled')
          || !Object.is(
            coarseP2gProjection.mechanicsFieldTemporalCoarsePredictorCurrentDt,
            expectedThetaDt
          )
          || !Object.is(
            coarseP2gProjection.mechanicsFieldTemporalCoarsePredictorSuccessorDt,
            expectedTemporalCoarseSuccessorDt
          )
          || (temporalCoarsePredictorRequired && (
            coarseP2gProjection.activeSourceP2gEnabled !== true
            || coarseP2gProjection.mechanicsFieldTemporalCoarsePredictorStorage
              !== 'field-accumulator-xyz-p2g-finalized-only'
            || !exactArrayMatches(
              coarseP2gProjection
                .mechanicsFieldTemporalCoarsePredictorReceiptWords,
              [13, 14, 15]
            )
          ))
          || !validateLocallyOwnedSchroederCrossLevelRefluxLedgerGpu(
            device,
            resolvedRefluxLedger,
            {
              minimumCoarseFieldCapacity: parentFieldView.coarseFieldCapacity,
              fineSubstepCount,
              fineLevel: parentFieldView.fineLevel,
              coarseLevel: parentFieldView.coarseLevel,
              coarseGridSpacingM: parentFieldView.coarseFieldView.gridSpacingM
            }
          )
        )
      ) {
        throw new TypeError(
          'fused predictors require the transaction exact local macro reflux ledger and substep'
        );
      }
      const plan = createSchroederSpatialParentFieldMechanicsWorkspacePlan({
        parentFieldView,
        completionOrdinal: token.serial
      });
      const execution = {
        ...plan,
        plan,
        schema: ULG_SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_SCHEMA,
        status: 'schroeder-spatial-parent-field-mechanics-predictors-encoded',
        deviceId,
        arenaIndex: arena.arenaIndex,
        arenaGeneration: token.serial,
        parentFieldView,
        fineP2gProjection,
        coarseP2gProjection,
        predictorDt: Number(dt),
        fineDt: Number(fineDt),
        macroDt: Number(macroDt),
        fineSubstepOrdinal: Number(fineSubstepOrdinal),
        terminalOperation: terminalOperation === true,
        fineSubstepCount: Number(fineSubstepCount),
        temporalCoarsePredictorEnabled: temporalCoarsePredictorRequired,
        temporalCoarsePredictorSuccessorDt:
          expectedTemporalCoarseSuccessorDt,
        finePredictorMutationOrdinal:
          fineP2gProjection.mechanicsFieldMutationOutputOrdinal,
        coarsePredictorMutationOrdinal:
          coarseP2gProjection.mechanicsFieldMutationOutputOrdinal,
        fineFieldView: parentFieldView.fineFieldView,
        coarseFieldView: parentFieldView.coarseFieldView,
        workspaceBuffer: arena.workspaceBuffer,
        refluxLedger: resolvedRefluxLedger,
        refluxLedgerBuffer: resolvedRefluxLedger.buffer,
        resetRefluxLedger:
          resolvedRefluxLedger.status
            === 'schroeder-cross-level-reflux-ledger-arena-local',
        paramsBuffer: arena.paramsBuffer,
        parentIndirectBuffer: arena.parentIndirectBuffer,
        fineIndirectBuffer: arena.fineIndirectBuffer,
        coarseIndirectBuffer: arena.coarseIndirectBuffer,
        encodedDispatchCount: 9,
        encodedComputePassCount: workspaceTimestampSpansActive() ? 9 : 1,
        retainedGpuBufferBytes,
        gpuBufferCreationCountDuringEncode: 0,
        bufferAllocationCountDuringEncode: 0,
        fullParticleReadbackPerformed: false,
        normalHotLoopReadbackFree: true,
        submissionOwnership: 'caller',
        predictorSubmitted: false,
        terminalSubmitted: false,
        terminalKind: null,
        fineCorrectionMutationToken: null,
        coarsePublishMutationToken: null,
        stateAuthority: 'gpu-resident-parent-field-mechanics-workspace-v1',
        topologyAuthority: 'immutable-schroeder-spatial-parent-field-view-v1'
      };
      Object.defineProperty(execution, 'fusedFineSubstepTransaction', {
        value: fusedFineSubstepTransaction,
        enumerable: false,
        configurable: false,
        writable: false
      });
      Object.defineProperty(execution, 'ownerRuntime', {
        value: runtime,
        enumerable: false
      });
      Object.defineProperty(execution, 'released', {
        get() { return releasedExecutions.has(execution); },
        enumerable: true
      });
      device.queue.writeBuffer(arena.paramsBuffer, 0, paramsData(execution, {
        dt,
        fineDt,
        macroDt,
        fineSubstepOrdinal,
        fineSubstepCount,
        terminalOperation,
        gravityMPerS2,
        boxDimsM,
        cflFactor,
        deltaScale: 0,
        maxCorrectionMPerS,
        wallBarrierElasticStiffnessNPerM,
        wallBarrierContactScale,
        wallBarrierMinGapM
      }));
      encoder.clearBuffer(arena.workspaceBuffer);
      if (execution.resetRefluxLedger) {
        encoder.clearBuffer(arena.refluxLedgerBuffer);
      }
      encoder.copyBufferToBuffer(
        parentFieldView.parentFieldViewBuffer,
        SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_DISPATCH_OFFSET_WORDS * UINT32_BYTES,
        arena.parentIndirectBuffer,
        0,
        3 * UINT32_BYTES
      );
      encoder.copyBufferToBuffer(
        parentFieldView.parentFieldViewBuffer,
        SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_FINE_DISPATCH_OFFSET_WORDS * UINT32_BYTES,
        arena.fineIndirectBuffer,
        0,
        3 * UINT32_BYTES
      );
      encoder.copyBufferToBuffer(
        parentFieldView.parentFieldViewBuffer,
        SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_COARSE_DISPATCH_OFFSET_WORDS * UINT32_BYTES,
        arena.coarseIndirectBuffer,
        0,
        3 * UINT32_BYTES
      );
      const predictorGroup = sharedBindGroup(
        execution,
        predictorSharedLayout,
        PREDICTOR_PIPELINE_BINDINGS,
        'predictor-shared'
      );
      const predictorBindGroup = (pipelineName) =>
        predictorGroup ?? bindGroup(execution, pipelineName);
      encodeWorkspaceStages(encoder, [
        {
          name: 'initialize-predictors',
          pipeline: pipelines.initialize,
          bindGroup: predictorBindGroup('initialize')
        },
        {
          name: 'register-reflux-keys',
          pipeline: pipelines.registerReflux,
          bindGroup: predictorBindGroup('registerReflux')
        },
        {
          name: 'restrict-fine',
          pipeline: pipelines.restrictFine,
          bindGroup: predictorBindGroup('restrictFine'),
          indirectBuffer: arena.fineIndirectBuffer
        },
        {
          name: 'finalize-baseline',
          pipeline: pipelines.finalizeBaseline,
          bindGroup: predictorBindGroup('finalizeBaseline'),
          indirectBuffer: arena.parentIndirectBuffer
        },
        {
          name: 'inject-coarse',
          pipeline: pipelines.injectCoarse,
          bindGroup: predictorBindGroup('injectCoarse'),
          indirectBuffer: arena.coarseIndirectBuffer
        },
        {
          name: 'validate-registry',
          pipeline: pipelines.validateRegistry,
          bindGroup: predictorBindGroup('validateRegistry')
        },
        {
          name: 'update-predictors',
          pipeline: pipelines.updatePredictors,
          bindGroup: predictorBindGroup('updatePredictors'),
          indirectBuffer: arena.parentIndirectBuffer
        },
        {
          name: 'contact-predictors',
          pipeline: pipelines.contactPredictors,
          bindGroup: predictorBindGroup('contactPredictors'),
          indirectBuffer: arena.parentIndirectBuffer
        },
        {
          name: 'seal-predictors',
          pipeline: pipelines.sealPredictors,
          bindGroup: predictorBindGroup('sealPredictors')
        }
      ], `${label}PredictorSequence`);
      const executionOwner = {
        arena,
        token,
        fusedFineSubstepTransaction,
        parentFieldView,
        fineProjection: fineP2gProjection,
        coarseProjection: coarseP2gProjection,
        workspacePlan: plan,
        workspaceCompletionOrdinal: plan.completionOrdinal,
        predictorTemporalAuthority: Object.freeze({
          predictorDt: Number(dt),
          expectedThetaDt: Math.fround(
            ((Number(fineSubstepOrdinal) + 1) / Number(fineSubstepCount))
              * Number(macroDt)
          ),
          fineDt: Number(fineDt),
          macroDt: Number(macroDt),
          successorRequired: temporalCoarsePredictorRequired,
          successorThetaDt: expectedTemporalCoarseSuccessorDt
        }),
        phase: 'predictors-encoded',
        anySubmitted: false,
        terminalEncoded: false,
        terminalSubmitted: false
      };
      executionOwnership.set(execution, executionOwner);
      createExecutionRetirementRecord(execution, executionOwner);
      return execution;
    } catch (error) {
      releaseArena(arena, token);
      throw error;
    }
  }

  function rawOwnershipFor(execution) {
    const ownership = executionOwnership.get(execution);
    if (
      !ownership
      || releasedExecutions.has(execution)
      || ownership.arena.inUse !== true
      || ownership.arena.token !== ownership.token
      || execution?.ownerRuntime !== runtime
      || execution?.workspaceBuffer !== ownership.arena.workspaceBuffer
    ) {
      const error = new Error(
        'parent-field mechanics workspace execution is not owned by this runtime'
      );
      error.code = 'ERR_SCHROEDER_PARENT_FIELD_MECHANICS_FOREIGN_EXECUTION';
      throw error;
    }
    return ownership;
  }

  function ownershipFor(execution) {
    const ownership = rawOwnershipFor(execution);
    if (releaseInFlight.has(execution)) {
      const error = new Error(
        'parent-field mechanics workspace execution is not owned by this runtime'
      );
      error.code = 'ERR_SCHROEDER_PARENT_FIELD_MECHANICS_FOREIGN_EXECUTION';
      throw error;
    }
    return ownership;
  }

  function ownsExecution(execution) {
    try {
      ownershipFor(execution);
      return true;
    } catch {
      return false;
    }
  }

  function markPredictorsSubmitted(execution) {
    const ownership = ownershipFor(execution);
    if (ownership.phase !== 'predictors-encoded') {
      throw new Error('parent-field mechanics predictors are not awaiting submission');
    }
    ownership.phase = 'predictors-submitted';
    ownership.anySubmitted = true;
    execution.predictorSubmitted = true;
    execution.status = 'schroeder-spatial-parent-field-mechanics-predictors-submitted';
    return true;
  }

  function encodeFineCorrection(encoder, execution, {
    fineGridUpdate,
    deltaScale = 1,
    maxCorrectionMPerS = 0,
    fusedFineSubstepTransaction = execution?.fusedFineSubstepTransaction ?? null,
    schroederSpatialEpochTransaction = null,
    mechanicsMaterialTable = null,
    mechanicsMaterialPhaseUpload = null,
    ambientPressurePa = 0,
    phaseVolumePressureScale = 1,
    phaseVolumeDragScale = 1,
    phaseVolumeMaxImpulseFraction = 0.5,
    phaseVolumeInterfaceTransportRequired = false
  } = {}) {
    assertEncoder(encoder);
    const ownership = ownershipFor(execution);
    const sourceProjection = fineGridUpdate?.sourceProjection ?? null;
    const fusedTransaction = ownership.fusedFineSubstepTransaction ?? null;
    const predictorTemporalAuthority = ownership.predictorTemporalAuthority;
    const existingFineCorrectionClaim = fusedTransaction == null
      ? null
      : fineCorrectionClaims.get(fusedTransaction);
    if (
      ownership.phase !== 'predictors-submitted'
      || fusedFineSubstepTransaction !== fusedTransaction
      || (existingFineCorrectionClaim != null
        && existingFineCorrectionClaim !== execution)
      || !(fusedTransaction == null
        ? gridUpdateMatchesField(
            device,
            fineGridUpdate,
            sourceProjection,
            execution.fineFieldView
          )
        : fusedGridUpdateMatchesTransaction(
            device,
            fineGridUpdate,
            sourceProjection,
            execution.fineFieldView,
            fusedTransaction
          ))
      || fineGridUpdate?.mechanicsFieldEnergyReceipt?.deferSeal !== true
      || fineGridUpdate?.mechanicsFieldEnergyReceipt?.status
        !== 'heat-building-deferred-to-reflux-owner'
      || (fusedTransaction != null && (
        execution.fineP2gProjection !== sourceProjection
        || execution.refluxLedger !== fusedTransaction.refluxLedger
        || execution.fineSubstepOrdinal !== fusedTransaction.substepOrdinal
        || !Object.is(fineGridUpdate.dt, fusedTransaction.macroAuthority.fineDt)
        || !Object.is(execution.fineDt, fusedTransaction.macroAuthority.fineDt)
        || !Object.is(execution.macroDt, fusedTransaction.macroAuthority.macroDt)
        || !Object.is(
          execution.predictorDt,
          predictorTemporalAuthority.predictorDt
        )
        || !Object.is(
          Math.fround(predictorTemporalAuthority.predictorDt),
          predictorTemporalAuthority.expectedThetaDt
        )
        || !Object.is(
          predictorTemporalAuthority.fineDt,
          fusedTransaction.macroAuthority.fineDt
        )
        || !Object.is(
          predictorTemporalAuthority.macroDt,
          fusedTransaction.macroAuthority.macroDt
        )
        || !Object.is(
          Math.fround(execution.coarseP2gProjection?.dt),
          predictorTemporalAuthority.expectedThetaDt
        )
        || execution.temporalCoarsePredictorEnabled
          !== predictorTemporalAuthority.successorRequired
        || !Object.is(
          execution.temporalCoarsePredictorSuccessorDt,
          predictorTemporalAuthority.successorThetaDt
        )
        || execution.coarseP2gProjection
          ?.mechanicsFieldTemporalCoarsePredictorEnabled
          !== predictorTemporalAuthority.successorRequired
        || !Object.is(
          execution.coarseP2gProjection
            ?.mechanicsFieldTemporalCoarsePredictorSuccessorDt,
          predictorTemporalAuthority.successorThetaDt
        )
        || !validateLocallyOwnedSchroederCrossLevelRefluxLedgerGpu(
          device,
          execution.refluxLedger,
          {
            minimumCoarseFieldCapacity:
              execution.parentFieldView.coarseFieldCapacity,
            fineSubstepCount: execution.fineSubstepCount,
            fineLevel: execution.parentFieldView.fineLevel,
            coarseLevel: execution.parentFieldView.coarseLevel,
            coarseGridSpacingM: execution.coarseFieldView.gridSpacingM
          }
        )
      ))
    ) {
      throw new TypeError(
        'fine correction requires submitted predictors and the exact deferred-receipt fine field update'
      );
    }
    if (deltaScale !== 1) {
      throw new RangeError(
        'Slice-7 fine correction requires the full causal impulse (deltaScale must equal 1)'
      );
    }
    let phaseVolumeTransportAuthority = null;
    if (schroederSpatialEpochTransaction != null) {
      phaseVolumeTransportAuthority =
        resolveSchroederSpatialPhaseVolumeTransportAuthority(
          schroederSpatialEpochTransaction,
          {
            generation:
              fusedTransaction?.microepochAuthority?.generation
              ?? schroederSpatialEpochTransaction.generation,
            selectedLevel: execution.parentFieldView.fineLevel,
            mechanicsFieldView: execution.fineFieldView
          }
        );
      if (
        phaseVolumeTransportAuthority.fineMechanicsFieldView
          !== execution.fineFieldView
        || phaseVolumeTransportAuthority.coarseMechanicsFieldView
          !== execution.coarseFieldView
        || phaseVolumeTransportAuthority.parentFieldView
          !== execution.parentFieldView
        || phaseVolumeTransportAuthority.parentFieldViewBuffer
          !== execution.parentFieldView.parentFieldViewBuffer
        || phaseVolumeTransportAuthority.levelIndex !== 0
        || phaseVolumeTransportAuthority.selectedLevel
          !== execution.parentFieldView.fineLevel
        || uploadedMechanicsMaterialPhaseRecordsMatch(
          mechanicsMaterialPhaseUpload,
          mechanicsMaterialTable,
          device
        ) !== true
      ) {
        throw new TypeError(
          'Cross-level phase-volume transport requires exact fine/coarse S9 authority and mechanics material records'
        );
      }
    }
    if (
      phaseVolumeInterfaceTransportRequired === true
      && phaseVolumeTransportAuthority == null
    ) {
      throw new TypeError(
        'Required cross-level phase-volume transport authority is unavailable'
      );
    }
    if (
      phaseVolumeInterfaceTransportRequired !== true
      && phaseVolumeTransportAuthority != null
    ) {
      throw new TypeError(
        'Cross-level phase-volume transport authority cannot be supplied when transport is disabled'
      );
    }
    execution.phaseVolumeTransportAuthority =
      phaseVolumeTransportAuthority;
    execution.mechanicsMaterialPhaseBuffer =
      phaseVolumeTransportAuthority
        ? mechanicsMaterialPhaseUpload.recordsBuffer
          ?? mechanicsMaterialPhaseUpload.materialPhaseBuffer
        : null;
    const fieldRuntime = execution.fineFieldView.ownerRuntime;
    if (fusedTransaction == null && (
      typeof fieldRuntime?.reserveStateMutation !== 'function'
      || typeof fieldRuntime?.markStateMutationSubmitted !== 'function'
      || typeof fieldRuntime?.discardStateMutation !== 'function'
      || typeof fieldRuntime?.quarantineStateMutation !== 'function'
    )) {
      throw new TypeError(
        'Parent-field fine correction needs exact mutable-field operation provenance'
      );
    }
    const mutationToken = fusedTransaction == null
      ? fieldRuntime.reserveStateMutation(
          execution.fineFieldView,
          {
            expectedOrdinal: fineGridUpdate.mechanicsFieldMutationOutputOrdinal,
            expectedEncoding:
              SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
            outputEncoding:
              SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
            operation: 'parent-field-fine-velocity-correction-submitted'
          }
        )
      : fusedTransaction.fineCorrectionMutation;
    execution.fineCorrectionMutationToken = mutationToken;
    device.queue.writeBuffer(execution.paramsBuffer, 0, paramsData(execution, {
      dt: predictorTemporalAuthority.predictorDt,
      fineDt: predictorTemporalAuthority.fineDt,
      macroDt: predictorTemporalAuthority.macroDt,
      fineSubstepOrdinal: execution.fineSubstepOrdinal,
      fineSubstepCount: execution.fineSubstepCount,
      terminalOperation: false,
      gravityMPerS2: fineGridUpdate.gravityMPerS2,
      boxDimsM: fineGridUpdate.boxDimsM,
      cflFactor: fineGridUpdate.cflFactor,
      deltaScale,
      maxCorrectionMPerS
      ,
      phaseVolumeTransportAuthority,
      mechanicsMaterialPhaseUpload,
      ambientPressurePa,
      phaseVolumePressureScale,
      phaseVolumeDragScale,
      phaseVolumeMaxImpulseFraction
    }));
    const correctionStages = [
      ...(phaseVolumeTransportAuthority ? [
        {
          name: 'admit-cross-level-phase-volume',
          pipeline: pipelines.admitCrossLevelPhaseVolume,
          bindGroup: bindGroup(execution, 'admitCrossLevelPhaseVolume')
        },
        {
          name: 'propose-cross-level-phase-volume',
          pipeline: pipelines.proposeCrossLevelPhaseVolume,
          bindGroup: bindGroup(execution, 'proposeCrossLevelPhaseVolume'),
          indirectBuffer: ownership.arena.fineIndirectBuffer
        }
      ] : []),
      {
        name: 'validate-fine-correction',
        pipeline: pipelines.validateFine,
        bindGroup: bindGroup(execution, 'validateFine'),
        indirectBuffer: ownership.arena.fineIndirectBuffer
      },
      {
        name: 'validate-routed-coarse-cfl',
        pipeline: pipelines.validateRoutedCoarse,
        bindGroup: bindGroup(execution, 'validateRoutedCoarse'),
        indirectBuffer: ownership.arena.coarseIndirectBuffer
      },
      {
        name: 'seal-fine-correction-alpha',
        pipeline: pipelines.sealFineAlpha,
        bindGroup: bindGroup(execution, 'sealFineAlpha')
      },
      {
        name: 'prepare-fine-transaction',
        pipeline: pipelines.prepareFine,
        bindGroup: bindGroup(execution, 'prepareFine')
      },
      {
        name: 'begin-fine-correction',
        pipeline: pipelines.beginFine,
        bindGroup: bindGroup(execution, 'beginFine')
      },
      {
        name: 'commit-routed-reflux-rows',
        pipeline: pipelines.commitRefluxRows,
        bindGroup: bindGroup(execution, 'commitRefluxRows'),
        indirectBuffer: ownership.arena.coarseIndirectBuffer
      },
      {
        name: 'commit-routed-reflux',
        pipeline: pipelines.commitReflux,
        bindGroup: bindGroup(execution, 'commitReflux')
      },
      {
        name: 'apply-fine-route-heat',
        pipeline: pipelines.applyFineHeat,
        bindGroup: bindGroup(execution, 'applyFineHeat'),
        indirectBuffer: ownership.arena.fineIndirectBuffer
      },
      {
        name: 'apply-fine-correction',
        pipeline: pipelines.applyFine,
        bindGroup: bindGroup(execution, 'applyFine'),
        indirectBuffer: ownership.arena.fineIndirectBuffer
      },
      {
        name: 'finalize-fine-correction',
        pipeline: pipelines.finalizeFine,
        bindGroup: bindGroup(execution, 'finalizeFine')
      }
    ];
    encodeWorkspaceStages(
      encoder,
      correctionStages,
      `${label}FineCorrectionSequence`
    );
    ownership.phase = 'fine-correction-encoded';
    ownership.terminalEncoded = true;
    ownership.terminalSubmissionObserved = false;
    execution.status = 'schroeder-spatial-parent-field-mechanics-fine-correction-encoded';
    execution.terminalKind = 'fine-correction';
    execution.fineGridUpdate = fineGridUpdate;
    const correctedGridUpdate = {
      ...fineGridUpdate,
      status: 'parent-field-fine-correction-encoded-unsubmitted',
      fieldStateUpdateSubmittedInPlace: false,
      fieldStateUpdatedInPlace: false,
      mechanicsFieldMutationInputOrdinal: mutationToken.expectedOrdinal,
      mechanicsFieldMutationOutputOrdinal: mutationToken.outputOrdinal,
      mechanicsFieldMutationInputStateEncoding: mutationToken.expectedEncoding,
      mechanicsFieldMutationOutputStateEncoding: mutationToken.outputEncoding,
      mechanicsFieldEnergyReceipt: null,
      parentFieldMechanicsTerminalSubmitted: false,
      parentFieldMechanicsWorkspaceExecution: execution,
      parentFieldMechanicsWorkspaceStatus:
        'parent-predictor-delta-corrected-native-fine-fields'
    };
    Object.defineProperty(correctedGridUpdate, 'sourceProjection', {
      value: sourceProjection,
      enumerable: true
    });
    Object.defineProperty(correctedGridUpdate, 'previousGridUpdate', {
      value: fineGridUpdate,
      enumerable: true
    });
    if (fusedTransaction != null) {
      Object.defineProperties(correctedGridUpdate, {
        fusedFineSubstepTransaction: {
          value: fusedTransaction,
          enumerable: false,
          configurable: false,
          writable: false
        },
        fineMicroepochAuthority: {
          value: fusedTransaction.microepochAuthority,
          enumerable: false,
          configurable: false,
          writable: false
        },
        proposalMode: {
          value: 'proposal-deferred-to-post-mechanics',
          enumerable: true,
          configurable: false,
          writable: false
        }
      });
    }
    execution.fineCorrectedGridUpdate = correctedGridUpdate;
    const terminalSnapshot = fusedTransaction == null
      ? null
      : Object.freeze({
          schema: correctedGridUpdate.schema,
          backend: correctedGridUpdate.backend,
          transaction: fusedTransaction,
          microepochAuthority: fusedTransaction.microepochAuthority,
          proposalMode: 'proposal-deferred-to-post-mechanics',
          parentFieldView: ownership.parentFieldView,
          coarseProjection: ownership.coarseProjection,
          workspacePlan: ownership.workspacePlan,
          workspaceCompletionOrdinal: ownership.workspaceCompletionOrdinal,
          sourceProjection,
          priorGridUpdate: fineGridUpdate,
          fieldExecution: fusedTransaction.fineFieldView,
          fieldBuffer: fusedTransaction.fineFieldView.fieldViewBuffer,
          fieldByteLength:
            Number(fusedTransaction.fineFieldView.fieldViewBuffer?.size ?? 0),
          inputOrdinal: mutationToken.expectedOrdinal,
          outputOrdinal: mutationToken.outputOrdinal,
          inputEncoding: mutationToken.expectedEncoding,
          outputEncoding: mutationToken.outputEncoding,
          predictorDt: predictorTemporalAuthority.predictorDt,
          expectedThetaDt: predictorTemporalAuthority.expectedThetaDt,
          temporalCoarseSuccessorRequired:
            predictorTemporalAuthority.successorRequired,
          temporalCoarseSuccessorThetaDt:
            predictorTemporalAuthority.successorThetaDt,
          fineDt: predictorTemporalAuthority.fineDt,
          macroDt: predictorTemporalAuthority.macroDt,
          dt: fineGridUpdate.dt,
          gravity: Object.freeze([...fineGridUpdate.gravityMPerS2]),
          box: Object.freeze([...fineGridUpdate.boxDimsM]),
          cflFactor: fineGridUpdate.cflFactor,
          gridSpacingM: fineGridUpdate.gridSpacingM,
          gridDims: Object.freeze([...fineGridUpdate.gridDims]),
          gridNodeCount: fineGridUpdate.gridNodeCount,
          gridShift: fineGridUpdate.gridShift
        });
    ownership.terminalKind = 'fine-correction';
    ownership.terminalArtifact = correctedGridUpdate;
    ownership.terminalPriorArtifact = fineGridUpdate;
    ownership.terminalMutationToken = mutationToken;
    ownership.terminalRefluxLedger = execution.refluxLedger;
    ownership.terminalSnapshot = terminalSnapshot;
    if (fusedTransaction != null) {
      fineCorrectionClaims.set(fusedTransaction, execution);
    }
    execution.deltaScale = Number(deltaScale);
    execution.maxCorrectionMPerS = Number(maxCorrectionMPerS);
    const correctionDispatchCount = correctionStages.length;
    execution.encodedDispatchCount += correctionDispatchCount;
    execution.encodedComputePassCount += workspaceTimestampSpansActive()
      ? correctionDispatchCount
      : 1;
    return correctedGridUpdate;
  }

  function coarseTerminalGridUpdateArtifact(execution, coarseGridUpdate) {
    const mutationToken = execution.coarsePublishMutationToken;
    const artifact = {
      ...coarseGridUpdate,
      schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
      status: 'parent-field-coarse-terminal-encoded-unsubmitted',
      fieldStateUpdatedInPlace: false,
      fieldStateUpdateSubmittedInPlace: false,
      mechanicsFieldMutationInputOrdinal: mutationToken.expectedOrdinal,
      mechanicsFieldMutationOutputOrdinal: mutationToken.outputOrdinal,
      mechanicsFieldMutationInputStateEncoding: mutationToken.expectedEncoding,
      mechanicsFieldMutationOutputStateEncoding: mutationToken.outputEncoding,
      mechanicsFieldEnergyReceipt: Object.freeze({
        schema: 'peercompute.ulg.schroeder-mechanics-field-energy-receipt.v3',
        status: 'energy-ready-by-parent-field-terminal-encoded-unsubmitted',
        deferSeal: false,
        fieldMutationOrdinal: mutationToken.outputOrdinal
      }),
      parentFieldMechanicsTerminalSubmitted: false,
      parentFieldMechanicsWorkspaceExecution: execution,
      parentFieldMechanicsWorkspaceStatus:
        'actual-deferred-coarse-update-refluxed-by-prepared-terminal',
      internalEnergyTransferStatus:
        'coarse-local-field-heat-plus-ledger-only-causal-route-heat',
      refluxEvidenceStatus:
        'gpu-measured-actual-coarse-delta-and-causal-energy-ledger',
      crossLevelRefluxLedger: execution.refluxLedger,
      crossLevelRefluxEvidenceBuffer: execution.refluxLedger.evidenceBuffer,
      scientificValidation: false,
      fullPhysicsValidation: false
    };
    Object.defineProperty(artifact, 'sourceProjection', {
      value: coarseGridUpdate.sourceProjection,
      enumerable: true
    });
    Object.defineProperty(artifact, 'previousGridUpdate', {
      value: coarseGridUpdate,
      enumerable: true
    });
    if (execution.fusedCoarseTerminalTransaction != null) {
      Object.defineProperties(artifact, {
        fusedCoarseTerminalTransaction: {
          value: execution.fusedCoarseTerminalTransaction,
          enumerable: false,
          configurable: false,
          writable: false
        },
        terminalMicroepochAuthority: {
          value: execution.terminalMicroepochAuthority,
          enumerable: false,
          configurable: false,
          writable: false
        },
        sourceParticleContinuation: {
          value: execution.sourceParticleContinuation,
          enumerable: false,
          configurable: false,
          writable: false
        },
        proposalMode: {
          value: execution.proposalMode,
          enumerable: true,
          configurable: false,
          writable: false
        }
      });
    }
    return artifact;
  }

  function encodeCoarseTerminal(encoder, options = {}) {
    const fusedTransaction = options?.fusedCoarseTerminalTransaction ?? null;
    const producerCapability = fusedTransaction == null
      ? null
      : claimSchroederFusedCoarseTerminalStageProducer(
          device,
          fusedTransaction,
          {
            stage: 'coarse-terminal',
            priorArtifact: options?.coarseGridUpdate ?? null
          }
        );
    try {
      return encodeCoarseTerminalWithClaim(
        encoder,
        options,
        producerCapability
      );
    } catch (error) {
      const retainedFailedEncoding = error?.failedEncoding ?? null;
      if (
        producerCapability != null
        && !failedTerminalEncodingOrigins.has(retainedFailedEncoding)
      ) {
        try {
          releaseSchroederFusedCoarseTerminalStageProducer(
            device,
            fusedTransaction,
            producerCapability
          );
        } catch {
          // Preserve the originating encode/admission failure. A capability
          // which became observed cannot be safely released here.
        }
      }
      throw error;
    }
  }

  function encodeCoarseTerminalWithClaim(encoder, {
    parentFieldView,
    coarseGridUpdate,
    refluxLedger,
    fineSubstepCount = refluxLedger?.fineSubstepCount,
    fineDt = Number(coarseGridUpdate?.dt) / Number(fineSubstepCount),
    fusedCoarseTerminalTransaction = null
  } = {}, producerCapability = null) {
    assertEncoder(encoder);
    const fusedTransaction = fusedCoarseTerminalTransaction ?? null;
    if ((fusedTransaction == null) !== (producerCapability == null)) {
      throw new Error(
        'fused coarse terminal requires its exact stage-producer capability'
      );
    }
    const existingClaim = fusedTransaction == null
      ? null
      : coarseTerminalClaims.get(fusedTransaction);
    if (existingClaim != null) {
      throw new Error(
        'fused coarse-terminal transaction is already claimed by a workspace'
      );
    }
    assertCoarseTerminalInputs(
      parentFieldView,
      coarseGridUpdate,
      refluxLedger,
      fineSubstepCount,
      fusedTransaction
    );
    const macroDt = finiteNumber(coarseGridUpdate.dt, 'coarseGridUpdate.dt');
    const resolvedFineDt = finiteNumber(fineDt, 'fineDt');
    const gravity = finiteVector3(
      coarseGridUpdate.gravityMPerS2,
      'coarseGridUpdate.gravityMPerS2'
    );
    const box = finiteVector3(
      coarseGridUpdate.boxDimsM,
      'coarseGridUpdate.boxDimsM'
    );
    const cflFactor = finiteNumber(
      coarseGridUpdate.cflFactor,
      'coarseGridUpdate.cflFactor'
    );
    if (!(macroDt > 0) || !(resolvedFineDt > 0) || !(cflFactor > 0)) {
      throw new RangeError('coarse terminal dt/fineDt/cflFactor must be positive');
    }
    if (fusedTransaction != null && (
      fusedTransaction.microepochAuthority?.parentFieldView !== parentFieldView
      || fusedTransaction.coarseFieldView !== parentFieldView.coarseFieldView
      || fusedTransaction.refluxLedger !== refluxLedger
      || fusedTransaction.substepOrdinal !== Number(fineSubstepCount)
      || fusedTransaction.macroAuthority?.fineSubstepCount
        !== Number(fineSubstepCount)
      || !Object.is(macroDt, fusedTransaction.macroAuthority?.macroDt)
      || !Object.is(resolvedFineDt, fusedTransaction.macroAuthority?.fineDt)
      || coarseGridUpdate.sourceProjection?.fusedCoarseTerminalTransaction
        !== fusedTransaction
      || coarseGridUpdate.fusedCoarseTerminalTransaction !== fusedTransaction
      || coarseGridUpdate.terminalMicroepochAuthority
        !== fusedTransaction.microepochAuthority
      || coarseGridUpdate.sourceParticleContinuation
        !== fusedTransaction.particleContinuation
      || coarseGridUpdate.proposalMode
        !== 'proposal-deferred-to-post-mechanics'
    )) {
      throw new TypeError(
        'fused coarse terminal requires exact E_r/C_r, macro timing, and deferred producers'
      );
    }
    const { arena, token } = acquireArena();
    let mutationToken = null;
    let execution = null;
    let encoderTouched = false;
    try {
      const plan = createSchroederSpatialParentFieldMechanicsWorkspacePlan({
        parentFieldView,
        completionOrdinal: token.serial
      });
      const coarseFieldView = parentFieldView.coarseFieldView;
      if (fusedTransaction == null && (
        typeof coarseFieldView.ownerRuntime?.reserveStateMutation !== 'function'
        || typeof coarseFieldView.ownerRuntime?.markStateMutationSubmitted !== 'function'
        || typeof coarseFieldView.ownerRuntime?.discardStateMutation !== 'function'
        || typeof coarseFieldView.ownerRuntime?.quarantineStateMutation !== 'function'
      )) {
        throw new TypeError(
          'Parent-field coarse terminal needs exact mutable-field operation provenance'
        );
      }
      mutationToken = fusedTransaction == null
        ? coarseFieldView.ownerRuntime.reserveStateMutation(
            coarseFieldView,
            {
              expectedOrdinal:
                coarseGridUpdate.mechanicsFieldMutationOutputOrdinal,
              expectedEncoding:
                SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
              outputEncoding:
                SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
              operation: 'parent-field-coarse-terminal-reflux-submitted'
            }
          )
        : fusedTransaction.coarseTerminalMutation;
      execution = {
        ...plan,
        plan,
        schema: ULG_SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_SCHEMA,
        status: 'schroeder-spatial-parent-field-mechanics-coarse-terminal-encoded',
        deviceId,
        arenaIndex: arena.arenaIndex,
        arenaGeneration: token.serial,
        parentFieldView,
        fineP2gProjection: null,
        coarseP2gProjection: coarseGridUpdate.sourceProjection,
        inputCoarseGridUpdate: coarseGridUpdate,
        predictorDt: macroDt,
        fineDt: resolvedFineDt,
        macroDt,
        fineSubstepOrdinal: Number(fineSubstepCount),
        terminalOperation: true,
        fineSubstepCount: Number(fineSubstepCount),
        finePredictorMutationOrdinal: 0,
        coarsePredictorMutationOrdinal:
          coarseGridUpdate.mechanicsFieldMutationOutputOrdinal,
        fineFieldView: parentFieldView.fineFieldView,
        coarseFieldView,
        workspaceBuffer: arena.workspaceBuffer,
        refluxLedger,
        refluxLedgerBuffer: refluxLedger.buffer,
        resetRefluxLedger: false,
        paramsBuffer: arena.paramsBuffer,
        parentIndirectBuffer: arena.parentIndirectBuffer,
        fineIndirectBuffer: arena.fineIndirectBuffer,
        coarseIndirectBuffer: arena.coarseIndirectBuffer,
        encodedDispatchCount: 12,
        encodedComputePassCount: workspaceTimestampSpansActive() ? 12 : 1,
        retainedGpuBufferBytes,
        gpuBufferCreationCountDuringEncode: 0,
        bufferAllocationCountDuringEncode: 0,
        fullParticleReadbackPerformed: false,
        normalHotLoopReadbackFree: true,
        submissionOwnership: 'caller',
        predictorSubmitted: false,
        terminalSubmitted: false,
        terminalKind: 'coarse-terminal',
        fineCorrectionMutationToken: null,
        coarsePublishMutationToken: mutationToken,
        stateAuthority: 'gpu-resident-parent-field-mechanics-workspace-v1',
        topologyAuthority: 'immutable-schroeder-spatial-parent-field-view-v1'
      };
      Object.defineProperty(execution, 'ownerRuntime', {
        value: runtime,
        enumerable: false
      });
      Object.defineProperty(execution, 'released', {
        get() { return releasedExecutions.has(execution); },
        enumerable: true
      });
      if (fusedTransaction != null) {
        Object.defineProperties(execution, {
          fusedCoarseTerminalTransaction: {
            value: fusedTransaction,
            enumerable: false,
            configurable: false,
            writable: false
          },
          terminalMicroepochAuthority: {
            value: fusedTransaction.microepochAuthority,
            enumerable: false,
            configurable: false,
            writable: false
          },
          sourceParticleContinuation: {
            value: fusedTransaction.particleContinuation,
            enumerable: false,
            configurable: false,
            writable: false
          },
          proposalMode: {
            value: 'proposal-deferred-to-post-mechanics',
            enumerable: true,
            configurable: false,
            writable: false
          }
        });
      }
      const terminalSnapshot = fusedTransaction == null
        ? null
        : Object.freeze({
            schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
            backend: coarseGridUpdate.backend,
            transaction: fusedTransaction,
            microepochAuthority: fusedTransaction.microepochAuthority,
            particleContinuation: fusedTransaction.particleContinuation,
            proposalMode: 'proposal-deferred-to-post-mechanics',
            refluxLedger,
            parentFieldView,
            workspacePlan: plan,
            workspaceCompletionOrdinal: plan.completionOrdinal,
            sourceProjection: coarseGridUpdate.sourceProjection,
            priorGridUpdate: coarseGridUpdate,
            fieldExecution: coarseFieldView,
            fieldBuffer: coarseFieldView.fieldViewBuffer,
            fieldByteLength: Number(coarseFieldView.fieldViewBuffer?.size ?? 0),
            inputOrdinal: mutationToken.expectedOrdinal,
            outputOrdinal: mutationToken.outputOrdinal,
            inputEncoding: mutationToken.expectedEncoding,
            outputEncoding: mutationToken.outputEncoding,
            fineDt: resolvedFineDt,
            macroDt,
            dt: coarseGridUpdate.dt,
            gravity: Object.freeze([...coarseGridUpdate.gravityMPerS2]),
            box: Object.freeze([...coarseGridUpdate.boxDimsM]),
            cflFactor: coarseGridUpdate.cflFactor,
            gridSpacingM: coarseGridUpdate.gridSpacingM,
            gridDims: Object.freeze([...coarseGridUpdate.gridDims]),
            gridNodeCount: coarseGridUpdate.gridNodeCount,
            gridShift: coarseGridUpdate.gridShift
          });
      const revalidateInputs = () => {
        assertCoarseTerminalInputs(
          parentFieldView,
          coarseGridUpdate,
          refluxLedger,
          fineSubstepCount,
          fusedTransaction,
          mutationToken
        );
        if (fusedTransaction != null && (
          !Object.is(coarseGridUpdate.dt, terminalSnapshot.dt)
          || !Object.is(resolvedFineDt, terminalSnapshot.fineDt)
          || !exactArrayMatches(
            coarseGridUpdate.gravityMPerS2,
            terminalSnapshot.gravity
          )
          || !exactArrayMatches(coarseGridUpdate.boxDimsM, terminalSnapshot.box)
          || !Object.is(coarseGridUpdate.cflFactor, terminalSnapshot.cflFactor)
          || !Object.is(coarseGridUpdate.gridSpacingM, terminalSnapshot.gridSpacingM)
          || !exactArrayMatches(coarseGridUpdate.gridDims, terminalSnapshot.gridDims)
          || coarseGridUpdate.gridNodeCount !== terminalSnapshot.gridNodeCount
          || coarseGridUpdate.gridShift !== terminalSnapshot.gridShift
        )) {
          throw new TypeError(
            'fused coarse terminal inputs changed during workspace encoding'
          );
        }
      };
      device.queue.writeBuffer(arena.paramsBuffer, 0, paramsData(execution, {
        dt: macroDt,
        fineDt: resolvedFineDt,
        macroDt,
        fineSubstepOrdinal: Number(fineSubstepCount),
        fineSubstepCount: Number(fineSubstepCount),
        terminalOperation: true,
        gravityMPerS2: gravity,
        boxDimsM: box,
        cflFactor,
        deltaScale: 0,
        maxCorrectionMPerS: 0
      }));
      revalidateInputs();
      encoderTouched = true;
      encoder.clearBuffer(arena.workspaceBuffer);
      encoder.copyBufferToBuffer(
        parentFieldView.parentFieldViewBuffer,
        SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_COARSE_DISPATCH_OFFSET_WORDS
          * UINT32_BYTES,
        arena.coarseIndirectBuffer,
        0,
        3 * UINT32_BYTES
      );
      const terminalGroup = sharedBindGroup(
        execution,
        terminalSharedLayout,
        TERMINAL_PIPELINE_BINDINGS,
        'terminal-shared'
      );
      const terminalBindGroup = (pipelineName) =>
        terminalGroup ?? bindGroup(execution, pipelineName);
      encodeWorkspaceStages(encoder, [
        {
          name: 'initialize-terminal',
          pipeline: pipelines.initializeTerminal,
          bindGroup: terminalBindGroup('initializeTerminal')
        },
        {
          name: 'register-terminal',
          pipeline: pipelines.registerTerminal,
          bindGroup: terminalBindGroup('registerTerminal')
        },
        {
          name: 'seal-terminal-workspace',
          pipeline: pipelines.sealTerminal,
          bindGroup: terminalBindGroup('sealTerminal')
        },
        {
          name: 'prevalidate-coarse',
          pipeline: pipelines.prevalidateCoarse,
          bindGroup: terminalBindGroup('prevalidateCoarse')
        },
        {
          name: 'validate-coarse-rows',
          pipeline: pipelines.validateCoarse,
          bindGroup: terminalBindGroup('validateCoarse'),
          indirectBuffer: arena.coarseIndirectBuffer
        },
        {
          name: 'seal-coarse-transaction',
          pipeline: pipelines.sealCoarse,
          bindGroup: terminalBindGroup('sealCoarse')
        },
        {
          name: 'prepare-coarse-transaction',
          pipeline: pipelines.prepareCoarse,
          bindGroup: terminalBindGroup('prepareCoarse')
        },
        {
          name: 'begin-coarse-publish',
          pipeline: pipelines.beginCoarse,
          bindGroup: terminalBindGroup('beginCoarse')
        },
        {
          name: 'apply-coarse-reflux-rows',
          pipeline: pipelines.applyCoarseRows,
          bindGroup: terminalBindGroup('applyCoarseRows'),
          indirectBuffer: arena.coarseIndirectBuffer
        },
        {
          name: 'apply-coarse-velocities',
          pipeline: pipelines.applyCoarse,
          bindGroup: terminalBindGroup('applyCoarse'),
          indirectBuffer: arena.coarseIndirectBuffer
        },
        {
          name: 'commit-coarse-reflux',
          pipeline: pipelines.commitCoarse,
          bindGroup: terminalBindGroup('commitCoarse')
        },
        {
          name: 'finalize-coarse-publish',
          pipeline: pipelines.finalizeCoarse,
          bindGroup: terminalBindGroup('finalizeCoarse')
        }
      ], `${label}CoarseTerminalSequence`);
      revalidateInputs();
      const update = coarseTerminalGridUpdateArtifact(
        execution,
        coarseGridUpdate
      );
      execution.coarseGridUpdate = update;
      if (
        terminalSnapshot != null
        && !coarseTerminalMatchesEncodedSnapshot(update, terminalSnapshot)
      ) {
        throw new TypeError(
          'fused coarse terminal artifact changed from its admitted encoding snapshot'
        );
      }
      const executionOwner = {
        arena,
        token,
        fusedFineSubstepTransaction: null,
        fusedCoarseTerminalTransaction: fusedTransaction,
        terminalProducerCapability: producerCapability,
        terminalKind: 'coarse-terminal',
        terminalArtifact: update,
        terminalPriorArtifact: coarseGridUpdate,
        terminalMutationToken: mutationToken,
        terminalRefluxLedger: refluxLedger,
        terminalSnapshot,
        originRegistrationPending: false,
        terminalSubmissionObserved: false,
        phase: 'coarse-terminal-encoded',
        anySubmitted: false,
        terminalEncoded: true,
        terminalSubmitted: false
      };
      executionOwnership.set(execution, executionOwner);
      createExecutionRetirementRecord(execution, executionOwner);
      if (fusedTransaction != null) {
        coarseTerminalClaims.set(fusedTransaction, execution);
      }
      return update;
    } catch (error) {
      if (fusedTransaction != null
          && coarseTerminalClaims.get(fusedTransaction) === execution) {
        coarseTerminalClaims.delete(fusedTransaction);
      }
      if (encoderTouched) {
        throw retainFailedTerminalEncoding(error, {
          arena,
          token,
          parentFieldView,
          mutationToken,
          fusedTransaction,
          producerCapability
        });
      }
      if (mutationToken && fusedTransaction == null) {
        parentFieldView.coarseFieldView.ownerRuntime.discardStateMutation(
          mutationToken,
          { discardedEncoder: true }
        );
      }
      releaseArena(arena, token);
      throw error;
    }
  }

  function registerSubmittedFineCorrection(execution, ownership) {
    const correction = ownership.terminalArtifact;
    const transaction = ownership.fusedFineSubstepTransaction;
    const priorGridUpdate = ownership.terminalPriorArtifact;
    const snapshot = ownership.terminalSnapshot;
    const receipt = correction.mechanicsFieldEnergyReceipt;
    if (!fineCorrectionMatchesEncodedSnapshot(correction, snapshot)) {
      throw new TypeError(
        'submitted fine correction changed after its exact GPU encoding'
      );
    }
    const origin = Object.freeze({
      device,
      deviceId,
      correction,
      transaction,
      macroAuthority: transaction.macroAuthority,
      microepochAuthority: transaction.microepochAuthority,
      particleContinuation: transaction.particleContinuation,
      mutationSegment: transaction.fineCorrectionMutation,
      proposalMode: 'proposal-deferred-to-post-mechanics',
      sourceProjection: snapshot.sourceProjection,
      priorGridUpdate,
      fieldExecution: snapshot.fieldExecution,
      fieldBuffer: snapshot.fieldBuffer,
      fieldByteLength: snapshot.fieldByteLength,
      execution,
      workspaceRuntime: runtime,
      workspaceLivenessValidator: () => (
        executionOwnership.get(execution) === ownership
        && releasedExecutions.has(execution) === false
        && releaseInFlight.has(execution) === false
        && ownership.arena.inUse === true
        && ownership.arena.token === ownership.token
        && ownership.terminalArtifact === correction
        && ownership.terminalPriorArtifact === priorGridUpdate
        && ownership.terminalMutationToken === transaction.fineCorrectionMutation
        && ownership.terminalRefluxLedger === execution.refluxLedger
        && ownership.terminalSnapshot === snapshot
        && (ownership.originRegistrationPending === true
          || ownership.terminalSubmitted === true)
      ),
      refluxLedger: ownership.terminalRefluxLedger,
      parentFieldView: snapshot.parentFieldView,
      coarseProjection: snapshot.coarseProjection,
      workspacePlan: snapshot.workspacePlan,
      workspaceCompletionOrdinal: snapshot.workspaceCompletionOrdinal,
      inputOrdinal: snapshot.inputOrdinal,
      outputOrdinal: snapshot.outputOrdinal,
      inputEncoding: snapshot.inputEncoding,
      outputEncoding: snapshot.outputEncoding,
      receipt,
      predictorDt: snapshot.predictorDt,
      expectedThetaDt: snapshot.expectedThetaDt,
      fineDt: snapshot.fineDt,
      macroDt: snapshot.macroDt,
      dt: snapshot.dt,
      gravity: snapshot.gravity,
      box: snapshot.box,
      cflFactor: snapshot.cflFactor,
      gridSpacingM: snapshot.gridSpacingM,
      gridDims: snapshot.gridDims,
      gridNodeCount: snapshot.gridNodeCount,
      gridShift: snapshot.gridShift
    });
    if (!fineCorrectionMatchesOrigin(correction, origin, {
      transaction,
      macroAuthority: transaction.macroAuthority,
      microepochAuthority: transaction.microepochAuthority,
      particleContinuation: transaction.particleContinuation,
      fieldExecution: transaction.fineFieldView,
      mutationSegment: transaction.fineCorrectionMutation,
      priorArtifact: priorGridUpdate,
      requireDeferred: true,
      proposalMode: 'proposal-deferred-to-post-mechanics'
    })) {
      throw new TypeError(
        'submitted fine correction does not match its exact fused producer inputs'
      );
    }
    fineCorrectionOrigins.set(correction, origin);
    return correction;
  }

  function registerSubmittedCoarseTerminal(execution, ownership) {
    const artifact = ownership.terminalArtifact;
    const transaction = ownership.fusedCoarseTerminalTransaction;
    const priorGridUpdate = ownership.terminalPriorArtifact;
    const snapshot = ownership.terminalSnapshot;
    const receipt = artifact.mechanicsFieldEnergyReceipt;
    if (!coarseTerminalMatchesEncodedSnapshot(artifact, snapshot)) {
      throw new TypeError(
        'submitted coarse terminal changed after its exact GPU encoding'
      );
    }
    const origin = Object.freeze({
      device,
      deviceId,
      artifact,
      snapshot,
      transaction,
      macroAuthority: transaction.macroAuthority,
      microepochAuthority: transaction.microepochAuthority,
      particleContinuation: transaction.particleContinuation,
      mutationSegment: transaction.coarseTerminalMutation,
      proposalMode: 'proposal-deferred-to-post-mechanics',
      sourceProjection: snapshot.sourceProjection,
      priorGridUpdate,
      fieldExecution: snapshot.fieldExecution,
      fieldBuffer: snapshot.fieldBuffer,
      fieldByteLength: snapshot.fieldByteLength,
      execution,
      workspaceRuntime: runtime,
      workspaceLivenessValidator: () => (
        executionOwnership.get(execution) === ownership
        && releasedExecutions.has(execution) === false
        && releaseInFlight.has(execution) === false
        && ownership.arena.inUse === true
        && ownership.arena.token === ownership.token
        && ownership.terminalArtifact === artifact
        && ownership.terminalPriorArtifact === priorGridUpdate
        && ownership.terminalMutationToken === transaction.coarseTerminalMutation
        && ownership.terminalRefluxLedger === transaction.refluxLedger
        && ownership.terminalSnapshot === snapshot
        && (ownership.originRegistrationPending === true
          || ownership.terminalSubmitted === true)
      ),
      refluxLedger: ownership.terminalRefluxLedger,
      parentFieldView: snapshot.parentFieldView,
      workspacePlan: snapshot.workspacePlan,
      workspaceCompletionOrdinal: snapshot.workspaceCompletionOrdinal,
      receipt
    });
    if (!coarseTerminalMatchesOrigin(artifact, origin, {
      terminalTransaction: transaction,
      macroAuthority: transaction.macroAuthority,
      microepochAuthority: transaction.microepochAuthority,
      particleContinuation: transaction.particleContinuation,
      fieldExecution: transaction.coarseFieldView,
      mutationSegment: transaction.coarseTerminalMutation,
      priorArtifact: priorGridUpdate,
      requireDeferred: true,
      proposalMode: 'proposal-deferred-to-post-mechanics'
    })) {
      throw new TypeError(
        'submitted coarse terminal does not match its exact fused producer inputs'
      );
    }
    coarseTerminalOrigins.set(artifact, origin);
    return artifact;
  }

  function resetUnsubmittedFineCorrection(
    execution,
    { discardedEncoder = false } = {}
  ) {
    if (discardedEncoder !== true) {
      throw new TypeError(
        'resetUnsubmittedFineCorrection requires { discardedEncoder: true }'
      );
    }
    const ownership = ownershipFor(execution);
    const transaction = ownership.fusedFineSubstepTransaction;
    if (
      transaction == null
      || ownership.terminalKind !== 'fine-correction'
      || ownership.phase !== 'fine-correction-encoded'
      || ownership.terminalEncoded !== true
      || ownership.terminalSubmitted === true
      || ownership.terminalSubmissionObserved === true
      || fineCorrectionClaims.get(transaction) !== execution
      || !fusedGridUpdateMatchesTransaction(
        device,
        ownership.terminalPriorArtifact,
        ownership.terminalPriorArtifact?.sourceProjection,
        transaction.fineFieldView,
        transaction
      )
    ) {
      throw new Error(
        'only an exact unsubmitted fused fine correction can be reset'
      );
    }
    fineCorrectionClaims.delete(transaction);
    fineCorrectionOrigins.delete(ownership.terminalArtifact);
    try {
      ownership.terminalArtifact.status =
        'parent-field-fine-correction-discarded-unsubmitted';
    } catch {
      // Private ownership invalidation is authoritative.
    }
    ownership.phase = 'predictors-submitted';
    ownership.terminalEncoded = false;
    ownership.terminalSubmitted = false;
    ownership.terminalSubmissionObserved = false;
    ownership.terminalKind = null;
    ownership.terminalArtifact = null;
    ownership.terminalPriorArtifact = null;
    ownership.terminalMutationToken = null;
    ownership.terminalRefluxLedger = null;
    ownership.terminalSnapshot = null;
    execution.status =
      'schroeder-spatial-parent-field-mechanics-predictors-submitted';
    execution.terminalKind = null;
    execution.terminalSubmitted = false;
    execution.fineGridUpdate = null;
    execution.fineCorrectedGridUpdate = null;
    execution.fineCorrectionMutationToken = null;
    return true;
  }

  function markTerminalSubmissionObserved(execution) {
    const ownership = ownershipFor(execution);
    if (
      !ownership.terminalEncoded
      || ownership.terminalSubmitted
      || ownership.terminalSubmissionObserved === true
    ) {
      throw new Error(
        'parent-field mechanics terminal operation is not awaiting submission observation'
      );
    }
    const terminalKind = ownership.terminalKind;
    const fusedTransaction = ownership.fusedFineSubstepTransaction ?? null;
    const fusedCoarseTransaction =
      ownership.fusedCoarseTerminalTransaction ?? null;
    ownership.anySubmitted = true;
    if (fusedCoarseTransaction != null) {
      try {
        markSchroederFusedCoarseTerminalStageSubmissionObserved(
          device,
          fusedCoarseTransaction,
          {
            stage: 'coarse-terminal',
            producerCapability: ownership.terminalProducerCapability
          }
        );
        ownership.terminalSubmissionObserved = true;
        if (!coarseTerminalPublicMirrorsMatch(execution, ownership)) {
          throw new TypeError(
            'fused coarse-terminal public mirrors changed after encoding'
          );
        }
        ownership.phase =
          'coarse-terminal-submitted-artifact-pending';
        execution.status =
          'schroeder-spatial-parent-field-mechanics-coarse-terminal-submitted-artifact-pending';
      } catch (error) {
        coarseTerminalOrigins.delete(ownership.terminalArtifact);
        try {
          quarantineSchroederFusedCoarseTerminalTransaction(
            device,
            fusedCoarseTransaction,
            error
          );
        } catch {
          // The originating post-submit failure remains authoritative.
        }
        ownership.terminalProducerCapability = null;
        ownership.phase = 'coarse-terminal-quarantined';
        execution.status =
          'schroeder-spatial-parent-field-mechanics-coarse-terminal-quarantined';
        throw error;
      }
      return true;
    }
    if (fusedTransaction != null) {
      try {
        markSchroederFusedFineSubstepStageSubmissionObserved(
          device,
          fusedTransaction,
          { stage: 'fine-correction' }
        );
        ownership.terminalSubmissionObserved = true;
        if (
          terminalKind !== 'fine-correction'
          || execution.terminalKind !== terminalKind
          || execution.fusedFineSubstepTransaction !== fusedTransaction
          || execution.fineCorrectedGridUpdate !== ownership.terminalArtifact
          || execution.fineGridUpdate !== ownership.terminalPriorArtifact
          || execution.fineCorrectionMutationToken
            !== ownership.terminalMutationToken
          || execution.refluxLedger !== ownership.terminalRefluxLedger
          || ownership.terminalMutationToken
            !== fusedTransaction.fineCorrectionMutation
          || !fineCorrectionMatchesEncodedSnapshot(
            ownership.terminalArtifact,
            ownership.terminalSnapshot
          )
          || !Object.is(
            execution.predictorDt,
            ownership.terminalSnapshot.predictorDt
          )
          || !Object.is(execution.fineDt, ownership.terminalSnapshot.fineDt)
          || !Object.is(execution.macroDt, ownership.terminalSnapshot.macroDt)
          || execution.parentFieldView
            !== ownership.terminalSnapshot.parentFieldView
          || execution.coarseP2gProjection
            !== ownership.terminalSnapshot.coarseProjection
          || execution.plan !== ownership.terminalSnapshot.workspacePlan
          || execution.completionOrdinal
            !== ownership.terminalSnapshot.workspaceCompletionOrdinal
        ) {
          throw new TypeError(
            'fused fine-correction public mirrors changed after encoding'
          );
        }
        ownership.phase = `${terminalKind}-submitted-artifact-pending`;
        execution.status =
          `schroeder-spatial-parent-field-mechanics-${terminalKind}-submitted-artifact-pending`;
      } catch (error) {
        fineCorrectionOrigins.delete(ownership.terminalArtifact);
        try {
          quarantineSchroederFusedFineSubstepTransaction(
            device,
            fusedTransaction,
            error
          );
        } catch {
          // The originating post-submit failure remains authoritative.
        }
        ownership.phase = 'fine-correction-quarantined';
        execution.status =
          'schroeder-spatial-parent-field-mechanics-fine-correction-quarantined';
        throw error;
      }
      return true;
    }
    ownership.terminalSubmissionObserved = true;
    ownership.phase = `${terminalKind}-submitted-artifact-pending`;
    execution.status =
      `schroeder-spatial-parent-field-mechanics-${terminalKind}-submitted-artifact-pending`;
    return true;
  }

  function markTerminalSubmitted(execution) {
    const ownership = ownershipFor(execution);
    if (!ownership.terminalEncoded || ownership.terminalSubmitted) {
      throw new Error('parent-field mechanics terminal operation is not awaiting submission');
    }
    const terminalKind = ownership.terminalKind;
    const terminalArtifact = ownership.terminalArtifact;
    const terminalPriorArtifact = ownership.terminalPriorArtifact;
    const terminalMutationToken = ownership.terminalMutationToken;
    const terminalRefluxLedger = ownership.terminalRefluxLedger;
    const fusedTransaction = ownership.fusedFineSubstepTransaction ?? null;
    const fusedCoarseTransaction =
      ownership.fusedCoarseTerminalTransaction ?? null;
    if ((fusedTransaction != null || fusedCoarseTransaction != null)
        && ownership.terminalSubmissionObserved !== true) {
      throw new Error(
        'fused terminal operation requires exact post-submit observation before artifact commit'
      );
    }
    ownership.anySubmitted = true;
    if (terminalKind === 'coarse-terminal'
        && fusedCoarseTransaction != null) {
      try {
        if (!coarseTerminalPublicMirrorsMatch(execution, ownership)) {
          throw new TypeError(
            'fused coarse-terminal public mirrors changed after encoding'
          );
        }
        terminalArtifact.status = 'submitted-unverified';
        terminalArtifact.fieldStateUpdateSubmittedInPlace = true;
        terminalArtifact.parentFieldMechanicsTerminalSubmitted = true;
        terminalArtifact.mechanicsFieldEnergyReceipt = Object.freeze({
          schema: 'peercompute.ulg.schroeder-mechanics-field-energy-receipt.v3',
          status: 'energy-ready-submitted-unverified',
          deferSeal: false,
          fieldMutationOrdinal: terminalMutationToken.outputOrdinal,
          parentFieldMechanicsWorkspaceExecution: execution,
          refluxLedger: terminalRefluxLedger,
          fineSubstepOrdinal: fusedCoarseTransaction.substepOrdinal,
          workspaceCompletionOrdinal:
            ownership.terminalSnapshot.workspaceCompletionOrdinal,
          refluxCompletionOrdinal: terminalRefluxLedger.completionOrdinal
        });
        execution.terminalSubmitted = true;
        execution.status =
          'schroeder-spatial-parent-field-mechanics-coarse-terminal-submitted';
        ownership.originRegistrationPending = true;
        registerSubmittedCoarseTerminal(execution, ownership);
        markSchroederFusedCoarseTerminalStageSubmitted(
          device,
          fusedCoarseTransaction,
          {
            stage: 'coarse-terminal',
            artifact: terminalArtifact,
            priorArtifact: terminalPriorArtifact,
            producerCapability: ownership.terminalProducerCapability
          }
        );
        ownership.terminalProducerCapability = null;
        ownership.originRegistrationPending = false;
        ownership.terminalSubmitted = true;
        ownership.phase = 'coarse-terminal-submitted';
        return true;
      } catch (error) {
        ownership.originRegistrationPending = false;
        coarseTerminalOrigins.delete(terminalArtifact);
        try {
          quarantineSchroederFusedCoarseTerminalTransaction(
            device,
            fusedCoarseTransaction,
            error
          );
        } catch {
          // The originating post-submit producer failure remains authoritative.
        }
        ownership.terminalProducerCapability = null;
        ownership.phase = 'coarse-terminal-quarantined';
        try {
          execution.terminalSubmitted = false;
          execution.status =
            'schroeder-spatial-parent-field-mechanics-coarse-terminal-quarantined';
        } catch {
          // Private ownership and quarantine remain authoritative.
        }
        throw error;
      }
    }
    if (terminalKind === 'fine-correction') {
      if (fusedTransaction != null) {
        try {
          if (
            execution.terminalKind !== terminalKind
            || execution.fusedFineSubstepTransaction !== fusedTransaction
            || execution.fineCorrectedGridUpdate !== terminalArtifact
            || execution.fineGridUpdate !== terminalPriorArtifact
            || execution.fineCorrectionMutationToken !== terminalMutationToken
            || execution.refluxLedger !== terminalRefluxLedger
            || terminalMutationToken !== fusedTransaction.fineCorrectionMutation
            || terminalPriorArtifact?.sourceProjection
              !== execution.fineP2gProjection
            || !fineCorrectionMatchesEncodedSnapshot(
              terminalArtifact,
              ownership.terminalSnapshot
            )
            || !Object.is(
              execution.predictorDt,
              ownership.terminalSnapshot.predictorDt
            )
            || !Object.is(
              execution.fineDt,
              ownership.terminalSnapshot.fineDt
            )
            || !Object.is(
              execution.macroDt,
              ownership.terminalSnapshot.macroDt
            )
            || execution.parentFieldView
              !== ownership.terminalSnapshot.parentFieldView
            || execution.coarseP2gProjection
              !== ownership.terminalSnapshot.coarseProjection
            || execution.plan !== ownership.terminalSnapshot.workspacePlan
            || execution.completionOrdinal
              !== ownership.terminalSnapshot.workspaceCompletionOrdinal
          ) {
            throw new TypeError(
              'fused fine-correction public mirrors changed after encoding'
            );
          }
          terminalArtifact.status = 'submitted-unverified';
          terminalArtifact.fieldStateUpdateSubmittedInPlace = true;
          terminalArtifact.parentFieldMechanicsTerminalSubmitted = true;
          terminalArtifact.mechanicsFieldEnergyReceipt = Object.freeze({
            schema: 'peercompute.ulg.schroeder-mechanics-field-energy-receipt.v3',
            status: 'energy-ready-submitted-unverified',
            deferSeal: false,
            fieldMutationOrdinal: terminalMutationToken.outputOrdinal,
            parentFieldMechanicsWorkspaceExecution: execution,
            refluxLedger: terminalRefluxLedger,
            fineSubstepOrdinal: fusedTransaction.substepOrdinal,
            workspaceCompletionOrdinal:
              ownership.terminalSnapshot.workspaceCompletionOrdinal,
            refluxCompletionOrdinal: terminalRefluxLedger.completionOrdinal
          });
          execution.terminalSubmitted = true;
          execution.status =
            'schroeder-spatial-parent-field-mechanics-fine-correction-submitted';
          ownership.originRegistrationPending = true;
          registerSubmittedFineCorrection(execution, ownership);
          markSchroederFusedFineSubstepStageSubmitted(
            device,
            fusedTransaction,
            {
              stage: 'fine-correction',
              artifact: terminalArtifact,
              priorArtifact: terminalPriorArtifact
            }
          );
          ownership.originRegistrationPending = false;
          ownership.terminalSubmitted = true;
          ownership.phase = 'fine-correction-submitted';
          return true;
        } catch (error) {
          ownership.originRegistrationPending = false;
          fineCorrectionOrigins.delete(terminalArtifact);
          try {
            quarantineSchroederFusedFineSubstepTransaction(
              device,
              fusedTransaction,
              error
            );
          } catch {
            // The originating post-submit producer failure remains authoritative.
          }
          ownership.phase = 'fine-correction-quarantined';
          try {
            execution.terminalSubmitted = false;
            execution.status =
              'schroeder-spatial-parent-field-mechanics-fine-correction-quarantined';
          } catch {
            // Private ownership and quarantine remain authoritative.
          }
          throw error;
        }
      }
    }
    const terminalFieldView = terminalKind === 'fine-correction'
      ? execution.fineFieldView
      : terminalKind === 'coarse-terminal'
        ? execution.coarseFieldView
        : null;
    try {
      if (terminalKind === 'fine-correction') {
        terminalArtifact.status = 'submitted-unverified';
        terminalArtifact.fieldStateUpdateSubmittedInPlace = true;
        terminalArtifact.parentFieldMechanicsTerminalSubmitted = true;
        terminalArtifact.mechanicsFieldEnergyReceipt = Object.freeze({
          schema: 'peercompute.ulg.schroeder-mechanics-field-energy-receipt.v3',
          status: 'energy-ready-submitted-unverified',
          deferSeal: false,
          fieldMutationOrdinal: terminalMutationToken.outputOrdinal,
          parentFieldMechanicsWorkspaceExecution: execution,
          refluxLedger: terminalRefluxLedger,
          fineSubstepOrdinal: execution.fineSubstepOrdinal,
          workspaceCompletionOrdinal: execution.completionOrdinal,
          refluxCompletionOrdinal: terminalRefluxLedger.completionOrdinal
        });
      } else if (terminalKind === 'coarse-terminal') {
        terminalArtifact.status = 'submitted-unverified';
        terminalArtifact.fieldStateUpdateSubmittedInPlace = true;
        terminalArtifact.parentFieldMechanicsTerminalSubmitted = true;
        terminalArtifact.mechanicsFieldEnergyReceipt = Object.freeze({
          ...terminalArtifact.mechanicsFieldEnergyReceipt,
          status: 'energy-ready-submitted-unverified'
        });
      } else {
        throw new Error('parent-field mechanics terminal kind is not publishable');
      }
      ownership.terminalSubmitted = true;
      ownership.phase = `${terminalKind}-submitted`;
      execution.terminalSubmitted = true;
      execution.status =
        `schroeder-spatial-parent-field-mechanics-${terminalKind}-submitted`;
      terminalFieldView.ownerRuntime.markStateMutationSubmitted(
        terminalMutationToken
      );
      return true;
    } catch (error) {
      fineCorrectionOrigins.delete(terminalArtifact);
      coarseTerminalOrigins.delete(terminalArtifact);
      try {
        terminalFieldView?.ownerRuntime?.quarantineStateMutation?.(
          terminalMutationToken,
          {
            submissionObserved: true,
            reason: error
          }
        );
      } catch {
        // Preserve the originating post-submit publication error. The exact
        // field remains pending or quarantined and cannot be republished.
      }
      ownership.terminalSubmitted = false;
      ownership.phase = `${terminalKind}-quarantined`;
      try {
        execution.terminalSubmitted = false;
        execution.status =
          `schroeder-spatial-parent-field-mechanics-${terminalKind}-quarantined`;
      } catch {
        // Private workspace ownership and field quarantine remain authoritative.
      }
      throw error;
    }
  }

  function isExecutionSubmitted(execution) {
    try {
      const ownership = ownershipFor(execution);
      return ownership.anySubmitted === true;
    } catch {
      return false;
    }
  }

  function isTerminalSubmitted(execution) {
    try {
      return ownershipFor(execution).terminalSubmitted === true
        && execution?.terminalSubmitted === true;
    } catch {
      return false;
    }
  }

  function finalizeRelease(execution, ownership, {
    deviceLost = false,
    retirementRecord = retirementRecordFor(execution)
  } = {}) {
    if (retirementRecord.completed) return true;
    if (deviceLost) destroyArenaOwnedBuffers(ownership.arena);
    const released = releaseArena(ownership.arena, ownership.token);
    if (released) {
      ownership.arena.retired = deviceLost === true;
      if (
        ownership.fusedFineSubstepTransaction != null
        && fineCorrectionClaims.get(ownership.fusedFineSubstepTransaction)
          === execution
      ) {
        fineCorrectionClaims.delete(ownership.fusedFineSubstepTransaction);
      }
      if (
        ownership.fusedCoarseTerminalTransaction != null
        && coarseTerminalClaims.get(
          ownership.fusedCoarseTerminalTransaction
        ) === execution
      ) {
        coarseTerminalClaims.delete(
          ownership.fusedCoarseTerminalTransaction
        );
      }
      if (ownership.terminalArtifact) {
        fineCorrectionOrigins.delete(ownership.terminalArtifact);
        coarseTerminalOrigins.delete(ownership.terminalArtifact);
      }
      releasedExecutions.add(execution);
      executionOwnership.delete(execution);
      releaseInFlight.delete(execution);
      retirementRecord.activeAttempt = null;
      retirementRecord.completed = true;
      retirementRecord.resolveCompletion(true);
      if (deviceLost) {
        execution.status =
          'schroeder-spatial-parent-field-mechanics-device-loss-retired';
      }
    }
    return released;
  }

  function releaseExecution(execution, { discardedEncoder = false } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError('releaseExecution requires { discardedEncoder: true }');
    }
    const retirementRecord = retirementRecordFor(execution);
    if (retirementRecord.completed) return true;
    const ownership = ownershipFor(execution);
    if (ownership.anySubmitted) {
      throw new Error('submitted parent-field mechanics workspace requires a queue fence');
    }
    if (ownership.terminalEncoded) {
      if (ownership.terminalKind === 'fine-correction'
          && ownership.terminalMutationToken
          && ownership.fusedFineSubstepTransaction == null) {
        execution.fineFieldView.ownerRuntime.discardStateMutation(
          ownership.terminalMutationToken,
          { discardedEncoder: true }
        );
      }
      if (ownership.terminalKind === 'coarse-terminal'
          && ownership.terminalMutationToken
          && ownership.fusedCoarseTerminalTransaction == null) {
        execution.coarseFieldView.ownerRuntime.discardStateMutation(
          ownership.terminalMutationToken,
          { discardedEncoder: true }
        );
      }
    }
    if (
      ownership.fusedCoarseTerminalTransaction != null
      && ownership.terminalProducerCapability != null
    ) {
      releaseSchroederFusedCoarseTerminalStageProducer(
        device,
        ownership.fusedCoarseTerminalTransaction,
        ownership.terminalProducerCapability
      );
      ownership.terminalProducerCapability = null;
    }
    return finalizeRelease(execution, ownership, { retirementRecord });
  }

  function releaseExecutionQueueOrdered(execution) {
    const retirementRecord = retirementRecordFor(execution);
    if (retirementRecord.completed) return true;
    if (deviceLossObserved) {
      const error = new Error(
        'device-lost parent-field mechanics workspace requires quarantine retirement'
      );
      error.code =
        'ERR_SCHROEDER_PARENT_FIELD_MECHANICS_DEVICE_LOSS_RETIREMENT_REQUIRED';
      throw error;
    }
    const ownership = ownershipFor(execution);
    if (!ownership.anySubmitted) {
      throw new Error(
        'unsubmitted parent-field mechanics workspace requires discarded release'
      );
    }
    if (
      ownership.terminalSubmitted !== true
      || execution?.terminalSubmitted !== true
    ) {
      const error = new Error(
        'queue-ordered parent-field mechanics workspace release requires its terminal submission'
      );
      error.code =
        'ERR_SCHROEDER_PARENT_FIELD_MECHANICS_TERMINAL_SUBMISSION_REQUIRED';
      throw error;
    }
    // Every producer and consumer of this arena is submitted to the same
    // device queue. Re-publishing the arena synchronously is safe because a
    // later writeBuffer/clear/dispatch that reuses it is ordered after those
    // already-submitted commands. GPUBuffer destruction is still owned by the
    // runtime and remains deferred until runtime teardown or device loss.
    return finalizeRelease(execution, ownership, { retirementRecord });
  }

  function releaseExecutionAfter(execution, submissionFence) {
    if (!submissionFence?.then) {
      throw new TypeError('releaseExecutionAfter requires a submission-fence thenable');
    }
    const retirementRecord = retirementRecordFor(execution);
    if (retirementRecord.completed) {
      return retirementRecord.completionPromise;
    }
    if (deviceLossObserved) {
      return quarantineExecutionAfterDeviceLoss(execution);
    }
    if (retirementRecord.activeAttempt) {
      return retirementRecord.activeAttempt.promise;
    }
    const ownership = rawOwnershipFor(execution);
    if (!ownership.anySubmitted) {
      throw new Error('unsubmitted parent-field mechanics workspace requires discarded release');
    }
    const attempt = {
      mode: 'queue-fence',
      ordinal: ++retirementRecord.nextAttemptOrdinal,
      promise: null
    };
    retirementRecord.activeAttempt = attempt;
    releaseInFlight.add(execution);
    const releaseAttempt = Promise.resolve(submissionFence).then(
      () => {
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        return finalizeRelease(execution, ownership, { retirementRecord });
      },
      (error) => {
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        retirementRecord.activeAttempt = null;
        releaseInFlight.delete(execution);
        execution.status =
          'schroeder-spatial-parent-field-mechanics-release-blocked';
        throw error;
      }
    );
    attempt.promise = releaseAttempt;
    releaseAttempt.catch(() => {});
    return releaseAttempt;
  }

  function quarantineExecutionAfterDeviceLoss(execution) {
    const retirementRecord = retirementRecordFor(execution);
    if (retirementRecord.completed) {
      return retirementRecord.completionPromise;
    }
    const ownership = rawOwnershipFor(execution);
    if (retirementRecord.activeAttempt?.mode === 'device-loss') {
      return retirementRecord.activeAttempt.promise;
    }
    const exactLossEvidence = retirementRecord.deviceLossEvidence ?? device?.lost;
    if (!exactLossEvidence || typeof exactLossEvidence.then !== 'function') {
      const error = new TypeError(
        'parent-field mechanics device-loss quarantine requires the exact GPUDevice.lost promise'
      );
      error.code =
        'ERR_SCHROEDER_PARENT_FIELD_MECHANICS_DEVICE_LOSS_EVIDENCE';
      throw error;
    }
    if (
      retirementRecord.deviceLossEvidence != null
      && retirementRecord.deviceLossEvidence !== exactLossEvidence
    ) {
      const error = new Error(
        'parent-field mechanics device-loss evidence changed for one execution'
      );
      error.code =
        'ERR_SCHROEDER_PARENT_FIELD_MECHANICS_DEVICE_LOSS_EVIDENCE';
      throw error;
    }
    retirementRecord.deviceLossEvidence = exactLossEvidence;
    deviceLossObserved = true;
    if (retirementRecord.activeAttempt) {
      retirementRecord.activeAttempt.promise.catch(() => {});
    }
    const attempt = {
      mode: 'device-loss',
      ordinal: ++retirementRecord.nextAttemptOrdinal,
      promise: null
    };
    retirementRecord.activeAttempt = attempt;
    releaseInFlight.add(execution);
    execution.status =
      'schroeder-spatial-parent-field-mechanics-device-loss-quarantined';
    runtime.status =
      'schroeder-spatial-parent-field-mechanics-workspace-gpu-runtime-device-loss-quarantined';
    const lossAttempt = Promise.resolve(exactLossEvidence).then(
      () => {
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        return finalizeRelease(execution, ownership, {
          deviceLost: true,
          retirementRecord
        });
      },
      (error) => {
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        retirementRecord.activeAttempt = null;
        releaseInFlight.delete(execution);
        execution.status =
          'schroeder-spatial-parent-field-mechanics-device-loss-retirement-blocked';
        throw error;
      }
    ).catch((error) => {
      if (retirementRecord.activeAttempt === attempt) {
        retirementRecord.activeAttempt = null;
        releaseInFlight.delete(execution);
        execution.status =
          'schroeder-spatial-parent-field-mechanics-device-loss-retirement-blocked';
      }
      throw error;
    });
    attempt.promise = lossAttempt;
    lossAttempt.catch(() => {});
    return lossAttempt;
  }

  function executionRetirementCompletionPromise(execution) {
    return retirementRecordFor(execution).completionPromise;
  }

  function activeExecutionCount() {
    return arenas.reduce((count, arena) => count + (arena.inUse ? 1 : 0), 0);
  }

  function allocationEntries() {
    return arenas.flatMap((arena) => arenaBuffers(arena)
      .filter(Boolean)
      .map((buffer) => ({
        role: 'parent-field-mechanics-workspace-arena-buffer',
        arenaIndex: arena.arenaIndex,
        buffer
      })));
  }

  function destroy() {
    if (destroyed) return false;
    if (arenas.some((arena) => arena.inUse)) {
      throw new Error('parent-field mechanics workspace runtime has active executions');
    }
    for (const arena of arenas) {
      const pending = arenaBuffers(arena).filter((buffer) => (
        buffer && !arena.destroyedOwnedBuffers.has(buffer)
      ));
      destroyOwnedBuffersRetrying(
        pending,
        'parent-field mechanics runtime destroy'
      );
      for (const buffer of pending) arena.destroyedOwnedBuffers.add(buffer);
    }
    destroyed = true;
    runtime.status =
      'schroeder-spatial-parent-field-mechanics-workspace-gpu-runtime-destroyed';
    return true;
  }

  runtime = {
    schema: ULG_SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_SCHEMA,
    status: 'schroeder-spatial-parent-field-mechanics-workspace-gpu-runtime-ready',
    deviceId,
    arenaCount: resolvedArenaCount,
    externalRefluxLedgerRequired,
    layout,
    pipelineCount: Object.keys(pipelines).length,
    retainedGpuBufferBytes,
    encodePredictors,
    markPredictorsSubmitted,
    encodeFineCorrection,
    encodeCoarseTerminal,
    discardFailedTerminalEncoding,
    // Compatibility name retained while the fused caller migrates; the API
    // now requires the dedicated terminal options object above.
    encodeCoarsePublish: encodeCoarseTerminal,
    resetUnsubmittedFineCorrection,
    markTerminalSubmissionObserved,
    markTerminalSubmitted,
    ownsExecution,
    isExecutionSubmitted,
    isTerminalSubmitted,
    releaseExecution,
    releaseExecutionQueueOrdered,
    releaseExecutionAfter,
    quarantineExecutionAfterDeviceLoss,
    executionRetirementCompletionPromise,
    activeExecutionCount,
    allocationEntries,
    destroy
  };
  return runtime;
}

const directRuntimeCache = new WeakMap();
const DIRECT_RUNTIME_CACHE_LIMIT = 4;

export function directSchroederSpatialParentFieldMechanicsWorkspaceGpu(device, {
  parentFieldCapacity,
  fineFieldCapacity = parentFieldCapacity,
  arenaCount = 3,
  externalRefluxLedgerRequired = false,
  gpuTimestampRecorder = null
} = {}) {
  assertDevice(device);
  if (typeof externalRefluxLedgerRequired !== 'boolean') {
    throw new TypeError('externalRefluxLedgerRequired must be a boolean');
  }
  const capacity = positiveInteger(parentFieldCapacity, 'parentFieldCapacity');
  const fineCapacity = positiveInteger(
    fineFieldCapacity,
    'fineFieldCapacity'
  );
  const resolvedArenaCount = positiveInteger(arenaCount, 'arenaCount', 8);
  const expectedLayout =
    createSchroederSpatialParentFieldMechanicsWorkspaceLayout({
      parentFieldCapacity: capacity,
      fineFieldCapacity: fineCapacity
    });
  const expectedLocalRefluxBytes = externalRefluxLedgerRequired
    ? 0
    : createSchroederCrossLevelRefluxLedgerLayout({
        parentFieldCapacity: capacity
      }).byteLength;
  const expectedRetainedGpuBufferBytes = resolvedArenaCount * (
    expectedLayout.byteLength
    + expectedLocalRefluxBytes
    + SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PARAMS_BYTES
    + 9 * UINT32_BYTES
  );
  const rawRetainedBudget = Number(device.limits?.maxBufferSize);
  const retainedBudget = Number.isFinite(rawRetainedBudget)
    && rawRetainedBudget > 0
    ? Math.max(rawRetainedBudget, expectedRetainedGpuBufferBytes)
    : Number.POSITIVE_INFINITY;
  let byCapacity = directRuntimeCache.get(device);
  if (!byCapacity) {
    byCapacity = new Map();
    directRuntimeCache.set(device, byCapacity);
  }
  const key = [
    capacity,
    fineCapacity,
    resolvedArenaCount,
    externalRefluxLedgerRequired ? 'external' : 'local',
    gpuTimestampEncoderSpansSupported(gpuTimestampRecorder)
      ? 'timestamp-capable'
      : 'production'
  ].join(':');
  let runtime = byCapacity.get(key);
  if (runtime?.status !== 'schroeder-spatial-parent-field-mechanics-workspace-gpu-runtime-ready') {
    byCapacity.delete(key);
    runtime = null;
  } else {
    byCapacity.delete(key);
    byCapacity.set(key, runtime);
  }
  const cachedRetainedBytes = () => [...byCapacity.values()].reduce(
    (sum, candidate) => sum + Number(candidate.retainedGpuBufferBytes ?? 0),
    0
  );
  const cacheNeedsEviction = () => (
    (!runtime && byCapacity.size >= DIRECT_RUNTIME_CACHE_LIMIT)
    || cachedRetainedBytes() + (runtime ? 0 : expectedRetainedGpuBufferBytes)
      > retainedBudget
  );
  while (cacheNeedsEviction()) {
    const retired = [...byCapacity.entries()].find(
      ([, candidate]) => (
        candidate !== runtime
        && candidate.activeExecutionCount?.() === 0
      )
    );
    if (!retired) {
      if (runtime) break;
      const error = new Error(
        'parent-field mechanics runtime cache is under active-workspace backpressure'
      );
      error.code = 'ERR_SCHROEDER_PARENT_FIELD_MECHANICS_CACHE_BACKPRESSURE';
      throw error;
    }
    const [retiredKey, retiredRuntime] = retired;
    byCapacity.delete(retiredKey);
    retiredRuntime.destroy();
  }
  if (!runtime) {
    runtime = createSchroederSpatialParentFieldMechanicsWorkspaceGpu(device, {
      parentFieldCapacity: capacity,
      fineFieldCapacity: fineCapacity,
      arenaCount: resolvedArenaCount,
      externalRefluxLedgerRequired,
      gpuTimestampRecorder,
      label: `ulg-schroeder-direct-parent-field-mechanics-${capacity}`
    });
    byCapacity.set(key, runtime);
  }
  return runtime;
}

export {
  ULG_SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_SCHEMA,
  schroederSpatialParentFieldMechanicsWorkspaceWgsl
};
