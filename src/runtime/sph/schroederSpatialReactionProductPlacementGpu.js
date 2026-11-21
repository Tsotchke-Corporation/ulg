import { isSphExactReactionLedgerReconcileStage } from './sphExactReactionLedgerReconcileGpu.js';
import {sphExactPlacementEventDispositionLayout,sphExactPlacementEventPipelineDescriptors,createSphExactPlacementPrivateCompanionRecoveryWgsl} from './sphExactPlacementEventDispositionWgsl.js';
import { sphExactPlacementPhysicalEvidenceLayout, planSphExactPlacementPhysicalEvidenceDispatch,
  createSphExactPlacementPhysicalEvidenceWgsl } from './sphExactPlacementPhysicalEvidenceWgsl.js';
import { encodeSphExactPlacementCaloricMetadata } from './sphExactPlacementCaloricMetadata.js';
import { sphExactPlacementReceiverCaloricLayout, encodeSphExactPlacementReceiverCaloricParams,
  createSphExactPlacementReceiverCaloricWgsl, SPH_EXACT_RECEIVER_PREPARATION_STAGES } from './sphExactPlacementReceiverCaloricWgsl.js';
import { sphExactPlacementPhysicalApplyLayout, assertSphExactPlacementPhysicalApplyDeviceLimits,
  encodeSphExactPlacementPhysicalApplyParams, planSphExactPlacementPhysicalApplyDispatches,
  createSphExactPlacementPhysicalApplyWgsl, SPH_EXACT_PHYSICAL_PREPARATION_STAGES } from './sphExactPlacementPhysicalApplyWgsl.js';
import { assertSphMechanicsGasLayout } from '../../../ulg-gpu-abi/src/sphGasConstitutive.js';
import { encodeSphExactReactionChemistryMetadata } from './sphExactReactionChemistryBudgetMetadata.js';
import { sphExactReactionChemistryBudgetLayout, planSphExactReactionChemistryBudgetDispatch,
  sphExactReactionChemistryBudgetPipelineDescriptors } from './sphExactReactionChemistryBudgetWgsl.js';
import { createSphExactPlacementChemistryConsumeWgsl } from './sphExactPlacementChemistryConsumeWgsl.js';
import { createSphExactPlacementPhysicalTerminalWgsl, createSphExactPlacementQuantityTerminalWgsl,
  createSphExactPlacementMassTerminalWgsl, createSphExactPlacementResidualPhysicalTerminalWgsl,
  createSphExactPlacementLedgerTerminalWgsl, planSphExactPlacementTerminalWorkgroups }
  from './sphExactPlacementTerminalWgsl.js';
import { sphExactPlacementCaptureLayout, sphExactPlacementCapturePipelineDescriptors,
  planSphExactPlacementCaptureWorkgroups } from './sphExactPlacementCaptureWgsl.js';
import { sphExactPlacementCaptureMergeLayout, createSphExactPlacementCaptureMergeWgsl }
  from './sphExactPlacementCaptureMergeWgsl.js';
import { createSphReactionProductEventCompactWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { cachedWebGpuBindGroup } from '../webgpuBindGroupCache.js';
import { assertSphLegacyMassPathAllowed } from './sphGpuBuffers.js';
import {
  SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_BYTES,
  SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V2_UNIFORM_BYTES,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_PRODUCT_PLACEMENT_V1,
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  SCHROEDER_SPATIAL_EPOCH_VERSION,
  SCHROEDER_SPATIAL_EPOCH_V2_VERSION
} from '../../../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_LAYOUT,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_MAGIC,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS,
  SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION,
  ULG_SPH_REACTION_PRODUCT_PLACEMENT_COMPLETION_RECEIPT_SCHEMA
} from '../../../ulg-gpu-abi/src/sphReactionProductPlacementReceipt.js';
import {
  finalizeSchroederSpatialExactNearConsumerReceipt,
  isFinalizedSchroederSpatialExactNearConsumerReceipt,
  resolveSchroederSpatialExactNearConsumerGeneration
} from './schroederSpatialEpochGpu.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';
import {
  isSchroederSpatialReactionPlacementSourceFamily,
  resolveSchroederSpatialReactionPlacementSourceFamily,
  resolveSchroederSpatialReactionPlacementExactSource,
  schroederSpatialReactionPlacementSourceFamilyLiveness
} from './schroederSpatialReactionPlacementEpochGpu.js';
import {
  SPH_REACTION_PRODUCT_PLACEMENT_CAPTURE_VALUE_ROWS,
  SPH_REACTION_PRODUCT_PLACEMENT_DIRECT_VALUE_ROWS,
  SPH_REACTION_PRODUCT_PLACEMENT_EVENT_PLAN_ROWS,
  SPH_REACTION_PRODUCT_PLACEMENT_LAW,
  SPH_REACTION_PRODUCT_PLACEMENT_SUMMARY_VALUE_ROWS,
  sphReactionProductPlacementCaptureApplyWgsl,
  sphReactionProductPlacementCaptureReduceWgsl,
  sphReactionProductPlacementDirectApplyWgsl,
  sphReactionProductPlacementDirectPlanWgsl,
  sphReactionProductPlacementDirectReduceWgsl,
  sphReactionProductPlacementEventApplyWgsl,
  sphReactionProductPlacementFinalizeWgsl,
  sphReactionProductPlacementPlanWgsl,
  sphReactionProductPlacementPreflightWgsl,
  sphReactionProductPlacementSummaryApplyWgsl,
  sphReactionProductPlacementSummaryReduceWgsl,
  sphReactionProductPlacementTransactionalAuxiliaryMaterializeWgsl,
  sphReactionProductPlacementTransactionalAuxiliaryPublishWgsl,
  sphReactionProductPlacementTransactionalDestinationRecoveryWgsl,
  sphReactionProductPlacementTransactionalPublishWgsl,
  sphReactionProductPlacementTransactionalTerminalWgsl
} from '../../../ulg-gpu-abi/src/sphReactionProductPlacementSegmentedWgsl.js';
import {
  computeBufferBinding,
  cancelQueueOrderedCleanupClaim,
  createQueueOrderedCleanupClaimIssuer,
  createCachedExplicitComputePipeline,
  prewarmCachedExplicitComputePipeline,
  registerQueueOrderedCleanupClaim,
  submitQueueOrderedFinalConsumerWork,
  releaseSubmittedWorkCleanupQueueOrdered
} from '../webgpuComputeLayout.js';
import {
  createWebGpuStableRadixScanUnique,
  WEBGPU_RADIX_PASSES_PER_WORD
} from '../webgpuRadixScanUnique.js';

function boundedSentinelRadixDigitRows(maxExclusiveValue, wordCount = 1) {
  const maxValid = Math.max(1, Math.floor(Number(maxExclusiveValue) || 1) - 1);
  const lowNibbles = Math.max(1, Math.ceil((32 - Math.clz32(maxValid)) / 4));
  if (lowNibbles >= 7) return null;
  const wordDigits = [];
  for (let n = 0; n < lowNibbles; n += 1) wordDigits.push(n);
  // Nibble 7 (bits 28..31) is 0 for every valid key < 2^28 and 15 for INVALID_KEY (0xffffffff).
  wordDigits.push(7);
  if (wordCount === 1) return wordDigits;
  const all = [];
  for (let w = 0; w < wordCount; w += 1) {
    const base = w * 8;
    for (const d of wordDigits) all.push(base + d);
  }
  return all;
}

export const ULG_SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_AUTHORITY_SCHEMA =
  'peercompute.ulg.schroeder-spatial-reaction-product-placement-authority.v2';
export const ULG_SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_ARTIFACT_SCHEMA =
  'peercompute.ulg.schroeder-spatial-reaction-product-placement-artifact.v2';
export const SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_CONSUMER_ID =
  'reaction-product-placement';
export const SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_PHASE =
  'reaction-product-placement-proposal';
export const SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_ARTIFACT_FAMILY =
  'spatial-exact-near-reaction-product-placement';

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};
const GPU_MAP_MODE = { READ: globalThis.GPUMapMode?.READ ?? 1 };

const expectationCacheByDevice = new WeakMap();
const authorityRecords = new WeakMap();
const completionObservationRecords = new WeakMap();
const finalizedPlacementArtifacts = new WeakSet();
const encodedPlacementRecords = new WeakMap();
const submittedPlacementArtifactRecords = new WeakMap();
const submittedPlacementArtifacts = new WeakSet();
const segmentedPlacementArenaCache = new WeakMap();
const segmentedPlacementArenaRecords = new WeakMap();
const segmentedPlacementQueueOrderedCleanupRecords = new WeakMap();
const segmentedPlacementCleanupClaimIssuer =
  createQueueOrderedCleanupClaimIssuer({
    producerFamily:
      'schroeder-reaction-placement-segmented-arena'
  });
const segmentedPlacementDiagnosticArenaBySubmissionArtifact = new WeakMap();
const segmentedPlacementDiagnosticObservationOutcomes = new WeakMap();

function placementError(message, suffix = 'CONTRACT') {
  const error = new Error(message);
  error.code = `ERR_SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_${suffix}`;
  return error;
}

function quarantinePlacementAuthorityAfterDeviceLoss(record, info) {
  if (!record || record.deviceLost) return;
  record.deviceLost = true;
  record.deviceLossStatus = 'device-loss-quarantined';
  record.deviceLossReason = info instanceof Error
    ? info.message
    : (info?.message ?? String(info || 'device lost'));
}

function armPlacementAuthorityDeviceLoss(record) {
  const lost = record?.device?.lost;
  if (!lost || typeof lost.then !== 'function') {
    record.deviceLossStatus = 'device-loss-promise-unavailable';
    return;
  }
  record.deviceLossStatus = 'device-loss-quarantine-armed';
  Promise.resolve(lost).then(
    (info) => quarantinePlacementAuthorityAfterDeviceLoss(record, info),
    (error) => quarantinePlacementAuthorityAfterDeviceLoss(record, error)
  );
}

function requireLivePlacementAuthority(
  authority,
  { device = null, operation = 'placement operation', validateContents = true } = {}
) {
  const record = authorityRecords.get(authority);
  if (!record || authority?.schema
    !== ULG_SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_AUTHORITY_SCHEMA) {
    throw placementError(
      `${operation} requires an exact runtime-issued placement authority`,
      'AUTHORITY'
    );
  }
  if (device && record.device !== device) {
    throw placementError(
      `${operation} belongs to another WebGPU device`,
      'DEVICE_MISMATCH'
    );
  }
  if (record.deviceLost) {
    throw placementError(
      `${operation} rejected after device loss${
        record.deviceLossReason ? `: ${record.deviceLossReason}` : ''
      }`,
      'DEVICE_LOSS'
    );
  }
  const generation = record.generation;
  if (
    generation?.execution?.released === true
    || generation?.releaseScheduled === true
  ) {
    throw placementError(
      `${operation} rejected because its source generation is retired or retiring`,
      'RETIRED'
    );
  }
  let sourceLiveness;
  try {
    if (validateContents) {
      resolveSchroederSpatialReactionPlacementSourceFamily(
        record.placementSourceFamily,
        { device: record.device }
      );
    }
    sourceLiveness = schroederSpatialReactionPlacementSourceFamilyLiveness(
      record.placementSourceFamily,
      { device: record.device }
    );
  } catch (error) {
    const suffix = /DEVICE_(?:LOST|LOSS|MISMATCH)$/.test(String(error?.code))
      ? 'DEVICE_LOSS'
      : 'RETIRED';
    throw placementError(
      `${operation} rejected because its placement source family is not live: ${
        error instanceof Error ? error.message : String(error)
      }`,
      suffix
    );
  }
  if (sourceLiveness?.active !== true) {
    throw placementError(
      `${operation} rejected because its placement source family is terminal`,
      sourceLiveness?.deviceLost ? 'DEVICE_LOSS' : 'RETIRED'
    );
  }
  if (validateContents && record.exactQuantityContext) {
    const exactBindings = record.exactQuantityContext.validate();
    if (Object.entries(exactBindings).some(([key, value]) => authority[key] !== value || record.bindings[key] !== value)) {
      throw placementError(`${operation} lost its original exact quantity bindings`, 'EXACT_QUANTITY_IDENTITY');
    }
  }
  const expectation = record.expectationEntry;
  if (
    expectation?.inFlightAuthority !== authority
    || expectation.generation !== generation
    || expectation.generationId !== authority.generationId
    || expectation.arenaIndex !== authority.spatialArenaIndex
    || expectation.directoryAbiVersion !== authority.directoryAbiVersion
    || expectation.expectationBufferByteLength
      !== authority.expectationBufferByteLength
    || expectation.acquisitionCount !== authority.arenaAcquisitionOrdinal
    || expectation.expectationBuffer !== record.bindings.expectationBuffer
    || expectation.completionReceiptBuffer
      !== record.bindings.completionReceiptBuffer
  ) {
    throw placementError(
      `${operation} rejected because its expectation-arena lease is stale`,
      'ARENA_LEASE'
    );
  }
  return record;
}

function isLivePlacementAuthorityRecord(authority, record) {
  try {
    return requireLivePlacementAuthority(authority) === record;
  } catch {
    return false;
  }
}

function exactPositiveU32(value, label) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < 1
    || value > 0xffff_ffff
  ) {
    throw placementError(`${label} must be an exact positive u32`, 'IDENTITY');
  }
  return value;
}

function requireBuffer(device, buffer, label) {
  if (
    !buffer
    || webGpuBufferDevice(buffer) !== device
    || !webGpuBufferMatchesDevice(buffer, device)
  ) {
    throw placementError(
      `${label} must be a live buffer on the canonical generation device`,
      'DEVICE_MISMATCH'
    );
  }
  return buffer;
}

function requireMinimumBytes(buffer, byteLength, label) {
  if (
    Number.isFinite(Number(buffer?.size))
    && Number(buffer.size) < byteLength
  ) {
    throw placementError(
      `${label} has ${buffer.size} bytes; ${byteLength} required`,
      'CAPACITY'
    );
  }
  return buffer;
}

// Private additions to the ORIGINAL placement authority module. No registry,
// public admission switch, independent owner or terminal selector is added.
const EXACT_PLACEMENT_QUANTITY_BINDING_FIELDS = Object.freeze([
  'frozenSourceQuantityBuffer', 'frozenSourceQuantityLayout', 'frozenSourceResidualCountBuffer',
  'placedDestinationQuantityBuffer', 'placedDestinationQuantityLayout',
  'placedDestinationMassBuffer', 'placedDestinationMassByteLength', 'placedDestinationMassSourceGeneration',
  'placedDestinationQuantityFormat', 'placedDestinationQuantityByteLength',
  'placedDestinationResidualCountBuffer', 'placedDestinationResidualEventBuffer',
  'placedDestinationResidualCompanionBuffer', 'placedDestinationResidualPhysicalBuffer', 'placedDestinationResidualLayout'
]);

function capturePlacementExactQuantityContext(family, device, particleCount, eventCapacity) {
  const read = resolveSchroederSpatialReactionPlacementExactSource(family, { device });
  if (!read) return null;
  const original = read.validate();
  const physical = original.result.physicalOutput;
  const quantities = physical.quantities;
  const layout = quantities.layout;
  const destinationLayout = family.placedDestinationQuantityLayout;
  const format = original.source.result.format;
  const bindings = Object.freeze(Object.fromEntries(EXACT_PLACEMENT_QUANTITY_BINDING_FIELDS
    .map(key => [key, family[key]])));
  const bytes = (particleCount + eventCapacity) * layout.recordWords * 4;
  const residualLayout = bindings.placedDestinationResidualLayout;
  if (physical.denseEventCount !== eventCapacity
      || original.result.particleCount !== particleCount
      || original.source.result.particleCount !== particleCount
      || eventCapacity !== particleCount * original.source.result.caloricProductCapacity
      || layout.particleCount !== particleCount || layout.eventCapacity !== eventCapacity
      || layout.originalRowOffset !== 0 || layout.currentRowOffset !== particleCount
      || layout.eventRowOffset !== 2 * particleCount
      || bindings.frozenSourceQuantityBuffer !== quantities.outputBuffer
      || bindings.frozenSourceQuantityLayout !== layout
      || bindings.frozenSourceResidualCountBuffer !== physical.compactCountBuffer
      || bindings.placedDestinationQuantityFormat !== format
      || bindings.placedDestinationMassByteLength !== (particleCount + eventCapacity) * format.wordCount * 4
      || bindings.placedDestinationMassSourceGeneration !== original.source.source.inventory.generation
      || !Object.isFrozen(residualLayout)
      || residualLayout.schema !== 'peercompute.ulg.exact-placement-residual-storage.v2'
      || residualLayout.particleCount !== particleCount || residualLayout.eventCapacity !== eventCapacity
      || residualLayout.eventStrideWords !== 32 || residualLayout.companionStrideWords !== 8 + 3 * format.wordCount
      || residualLayout.eventByteLength !== eventCapacity * 128
      || residualLayout.companionByteLength !== eventCapacity * (8 + 3 * format.wordCount) * 4
      || residualLayout.physicalStrideWords !== 52 || residualLayout.physicalByteLength !== eventCapacity * 208
      || residualLayout.countByteLength !== 8 || residualLayout.quantityLayout !== destinationLayout
      || residualLayout.format !== format || residualLayout.historyTransferAdmitted !== false
      || residualLayout.physicalPublicationAdmitted !== false
      || !Object.isFrozen(destinationLayout)
      || destinationLayout.currentRowOffset !== 0 || destinationLayout.eventRowOffset !== particleCount
      || destinationLayout.rowCount !== particleCount + eventCapacity
      || destinationLayout.recordWords !== layout.recordWords
      || destinationLayout.scalar !== layout.scalar
      || destinationLayout.wordLength * 4 !== bytes
      || bindings.placedDestinationQuantityByteLength !== bytes
      || !Number.isSafeInteger(bytes) || bytes < 4 || bytes > 0xffff_fffc) {
    throw placementError('exact placement authority does not match its original quantity owner and capacity', 'EXACT_QUANTITY_IDENTITY');
  }
  const extents = [
    ['frozenSourceQuantityBuffer', layout.wordLength * 4],
    ['frozenSourceResidualCountBuffer', 8],
    ['placedDestinationQuantityBuffer', bytes],
    ['placedDestinationMassBuffer', (particleCount + eventCapacity) * format.wordCount * 4],
    ['placedDestinationResidualCountBuffer', 8],
    ['placedDestinationResidualEventBuffer', residualLayout.eventByteLength],
    ['placedDestinationResidualCompanionBuffer', residualLayout.companionByteLength],
    ['placedDestinationResidualPhysicalBuffer', residualLayout.physicalByteLength]
  ];
  const validate = () => {
    const current = read.validate();
    if (current.result !== original.result || current.source !== original.source
        || current.source.result !== original.source.result || current.result.physicalOutput !== physical
        || physical.quantities !== quantities
        || Object.entries(bindings).some(([key, value]) => family[key] !== value)) {
      throw placementError('exact placement authority lost its original quantity tuple', 'EXACT_QUANTITY_IDENTITY');
    }
    for (const [key, extent] of extents) {
      const buffer = requireBuffer(device, bindings[key], key);
      if (!Number.isSafeInteger(buffer.size) || buffer.size < extent
          || (buffer.usage & GPU_BUFFER_USAGE.STORAGE) === 0) {
        throw placementError(`exact placement ${key} has insufficient storage`, 'EXACT_QUANTITY_CAPACITY');
      }
    }
    return bindings;
  };
  validate();
  return Object.freeze({ read, original, physical, quantities, bindings, validate });
}

function placementArenaError(message, suffix = 'ARENA') {
  const error = placementError(message, suffix);
  error.arena = true;
  return error;
}

function reductionLevelCount(elementCount) {
  return Math.max(0, Math.ceil(Math.log2(Math.max(1, elementCount))));
}

function createPlacementDiagnosticObservationGate(submissionArtifact) {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  // Device loss may reject the gate before the queue-fence continuation gets
  // a chance to await it. Keep that terminal rejection observed while the
  // arena's release promise remains the authoritative result for callers.
  promise.catch(() => {});
  return {
    submissionArtifact,
    promise,
    resolve,
    reject,
    settled: false
  };
}

function settlePlacementDiagnosticObservation(
  submissionArtifact,
  { error = null } = {}
) {
  let outcome = segmentedPlacementDiagnosticObservationOutcomes.get(
    submissionArtifact
  );
  if (!outcome) {
    outcome = Object.freeze({
      succeeded: error == null,
      error
    });
    segmentedPlacementDiagnosticObservationOutcomes.set(
      submissionArtifact,
      outcome
    );
  }
  const record = segmentedPlacementDiagnosticArenaBySubmissionArtifact.get(
    submissionArtifact
  );
  const gate = record?.diagnosticObservationGate;
  if (!gate || gate.submissionArtifact !== submissionArtifact || gate.settled) {
    return false;
  }
  gate.settled = true;
  if (outcome.succeeded) {
    gate.resolve(true);
  } else {
    gate.reject(outcome.error);
  }
  return true;
}

function createSegmentedPlacementArena(device, {
  spatialArenaIndex,
  particleCapacity,
  eventCapacity,
  productTermCapacity,
  eventStrideVec4,
  exactCompactionMassWordCount = 0,
  exactCaptureConfiguration = null,
  exactPhysicalConfiguration = null,
  exactEventConfiguration = null,
  exactChemistryConfiguration = null
}) {
  const maxStorageBindings = Number(
    device.limits?.maxStorageBuffersPerShaderStage ?? 8
  );
  const exactCompanionStrideWords = exactCompactionMassWordCount ? 8 + 3 * exactCompactionMassWordCount : 0;
  const requiredStorageBindings = exactPhysicalConfiguration ? 12 : exactCompactionMassWordCount ? 9 : 8;
  if (!Number.isInteger(maxStorageBindings) || maxStorageBindings < requiredStorageBindings) {
    throw placementArenaError(
      `segmented placement requires ${requiredStorageBindings} storage buffers per shader stage for its actual compactor`,
      'CAPABILITY'
    );
  }
  if (
    typeof device.queue?.onSubmittedWorkDone !== 'function'
    || !device.lost?.then
  ) {
    throw placementArenaError(
      'segmented placement requires an exact queue fence and device-loss thenable for safe arena reuse',
      'CAPABILITY'
    );
  }
  const createdBuffers = [];
  const createdRadixRuntimes = [];
  let completionReadback = null;
  let record = null;
  const makeBuffer = (label, size, usage = GPU_BUFFER_USAGE.STORAGE) => {
    const byteLength = Math.max(4, Math.ceil(Number(size) / 4) * 4);
    const maxBufferSize = Number(device.limits?.maxBufferSize ?? Number.MAX_SAFE_INTEGER);
    const maxStorageSize = Number(
      device.limits?.maxStorageBufferBindingSize ?? Number.MAX_SAFE_INTEGER
    );
    if (
      !Number.isSafeInteger(byteLength)
      || byteLength > maxBufferSize
      || ((usage & GPU_BUFFER_USAGE.STORAGE) !== 0 && byteLength > maxStorageSize)
    ) {
      throw placementArenaError(
        `${label} requires ${byteLength} bytes beyond device capacity`,
        'CAPACITY'
      );
    }
    const buffer = tagWebGpuBufferDevice(device.createBuffer({
      label,
      size: byteLength,
      usage
    }), device);
    if ((exactCaptureConfiguration && exactCaptureConfiguration.protectedBuffers.includes(buffer))
        || (exactChemistryConfiguration && exactChemistryConfiguration.protectedBuffers.includes(buffer))
        || (exactEventConfiguration && exactEventConfiguration.protectedBuffers.includes(buffer))
        || (exactCaptureConfiguration && createdBuffers.includes(buffer))) {
      throw placementError('exact arena allocation aliases a held source or sibling', 'SOURCE_DESTINATION_ALIAS');
    }
    createdBuffers.push(buffer);
    return buffer;
  };
  const ensureDiagnosticCompletionReadback = () => {
    if (completionReadback) return completionReadback;
    completionReadback = makeBuffer(
      `ulg-sph-reaction-placement-segmented-arena-${spatialArenaIndex}-completion-readback`,
      SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES,
      GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    );
    if (record) {
      record.ownedBuffers.add(completionReadback);
      record.bufferCreationCount += 1;
      record.diagnosticReadbackBufferCreationCount += 1;
    }
    return completionReadback;
  };
  const prefix = `ulg-sph-reaction-placement-segmented-arena-${spatialArenaIndex}`;
  const eventGroups = Math.max(1, Math.ceil(eventCapacity / 64));
  const particleGroups = Math.max(1, Math.ceil(particleCapacity / 64));
  const captureLevels = reductionLevelCount(eventCapacity);
  const directLevels = reductionLevelCount(eventCapacity);
  const summaryLevels = reductionLevelCount(eventCapacity);
  const reductionParamRowCount = 3 + captureLevels + directLevels + summaryLevels;
  try {
    const buffers = {
      denseEmission: makeBuffer(
        `${prefix}-dense-emission`,
        eventCapacity * eventStrideVec4 * 4 * Float32Array.BYTES_PER_ELEMENT,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      ),
      compactCount: makeBuffer(
        `${prefix}-compact-count`,
        (exactCompactionMassWordCount ? 2 : 1) * Uint32Array.BYTES_PER_ELEMENT,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      ),
      ...(exactCompactionMassWordCount ? { exactCompactCompanion: makeBuffer(
        `${prefix}-exact-compact-companion`,
        eventCapacity * exactCompanionStrideWords * Uint32Array.BYTES_PER_ELEMENT,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      ) } : {}),
      compactParams: makeBuffer(
        `${prefix}-compact-params`,
        16,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      compactLocalPrefix: makeBuffer(
        `${prefix}-compact-local-prefix`,
        eventCapacity * Uint32Array.BYTES_PER_ELEMENT,
        GPU_BUFFER_USAGE.STORAGE | (exactCompactionMassWordCount ? GPU_BUFFER_USAGE.COPY_DST : 0)
      ),
      compactGroupCount: makeBuffer(
        `${prefix}-compact-group-count`,
        eventGroups * Uint32Array.BYTES_PER_ELEMENT,
        GPU_BUFFER_USAGE.STORAGE | (exactCompactionMassWordCount ? GPU_BUFFER_USAGE.COPY_DST : 0)
      ),
      compactGroupOffset: makeBuffer(
        `${prefix}-compact-group-offset`,
        eventGroups * Uint32Array.BYTES_PER_ELEMENT,
        GPU_BUFFER_USAGE.STORAGE | (exactCompactionMassWordCount ? GPU_BUFFER_USAGE.COPY_DST : 0)
      ),
      decisions: makeBuffer(
        `${prefix}-decisions`,
        eventCapacity * 4 * Float32Array.BYTES_PER_ELEMENT
      ),
      control: makeBuffer(`${prefix}-control`, 32),
      envelopePartials: makeBuffer(
        `${prefix}-envelope-partials`,
        particleGroups * 4 * Float32Array.BYTES_PER_ELEMENT
      ),
      spareParticlePrefix: makeBuffer(
        `${prefix}-spare-particle-prefix`,
        particleCapacity * Uint32Array.BYTES_PER_ELEMENT
      ),
      spareParticleGroupCount: makeBuffer(
        `${prefix}-spare-particle-group-count`,
        particleGroups * Uint32Array.BYTES_PER_ELEMENT
      ),
      spareParticleGroupOffset: makeBuffer(
        `${prefix}-spare-particle-group-offset`,
        particleGroups * Uint32Array.BYTES_PER_ELEMENT
      ),
      spareEventPrefix: makeBuffer(
        `${prefix}-spare-event-prefix`,
        eventCapacity * Uint32Array.BYTES_PER_ELEMENT
      ),
      spareEventGroupCount: makeBuffer(
        `${prefix}-spare-event-group-count`,
        eventGroups * Uint32Array.BYTES_PER_ELEMENT
      ),
      spareEventGroupOffset: makeBuffer(
        `${prefix}-spare-event-group-offset`,
        eventGroups * Uint32Array.BYTES_PER_ELEMENT
      ),
      spareSlots: makeBuffer(
        `${prefix}-spare-slots`,
        particleCapacity * Uint32Array.BYTES_PER_ELEMENT
      ),
      spareControl: makeBuffer(
        `${prefix}-spare-control`,
        16,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      ),
      spareParticleScanParams: makeBuffer(
        `${prefix}-spare-particle-scan-params`,
        16,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      spareEventScanParams: makeBuffer(
        `${prefix}-spare-event-scan-params`,
        16,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      placementParams: makeBuffer(
        `${prefix}-params`,
        64,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      ...(exactChemistryConfiguration ? {
        exactChemistryA: makeBuffer(`${prefix}-exact-chemistry-a`, exactChemistryConfiguration.layout.scratchWordLength*4),
        exactChemistryB: makeBuffer(`${prefix}-exact-chemistry-b`, exactChemistryConfiguration.layout.scratchWordLength*4),
        exactChemistryControl: makeBuffer(`${prefix}-exact-chemistry-control`, exactChemistryConfiguration.layout.controlWordLength*4),
        exactChemistryEvidence: makeBuffer(`${prefix}-exact-chemistry-evidence`, exactChemistryConfiguration.layout.outputWordLength*4),
        exactChemistryMetadata: makeBuffer(`${prefix}-exact-chemistry-metadata`, exactChemistryConfiguration.layout.metadataWordLength*4,
          GPU_BUFFER_USAGE.STORAGE|GPU_BUFFER_USAGE.COPY_DST),
        exactChemistryParams: makeBuffer(`${prefix}-exact-chemistry-params`, exactChemistryConfiguration.uniformBytes,
          GPU_BUFFER_USAGE.UNIFORM|GPU_BUFFER_USAGE.COPY_DST)
      } : {}),
      ...(exactCaptureConfiguration ? {
        exactCaptureA: makeBuffer(`${prefix}-exact-capture-a`, exactCaptureConfiguration.capture.byteLength),
        exactCaptureB: makeBuffer(`${prefix}-exact-capture-b`, exactCaptureConfiguration.capture.byteLength),
        exactCaptureMerged: makeBuffer(`${prefix}-exact-capture-merged`, exactCaptureConfiguration.merge.mergedByteLength),
        exactCaptureMap: makeBuffer(`${prefix}-exact-capture-map`, exactCaptureConfiguration.merge.mapByteLength)
      } : {}),
      ...(exactPhysicalConfiguration ? Object.fromEntries(Object.entries(exactPhysicalConfiguration.sizes)
        .map(([key, bytes]) => [key, makeBuffer(`${prefix}-${key}`, bytes,
          (key.endsWith('Params') ? GPU_BUFFER_USAGE.UNIFORM : GPU_BUFFER_USAGE.STORAGE)
            | GPU_BUFFER_USAGE.COPY_DST)])) : {}),
      ...(exactEventConfiguration ? Object.fromEntries(Object.entries(exactEventConfiguration.sizes)
        .map(([key,bytes])=>[key,makeBuffer(`${prefix}-${key}`,bytes,
          (key.endsWith('Params')?GPU_BUFFER_USAGE.UNIFORM:GPU_BUFFER_USAGE.STORAGE)|GPU_BUFFER_USAGE.COPY_DST
            |(key==='exactEventHistoryCompanions'?GPU_BUFFER_USAGE.COPY_SRC:0))])) : {}),
      captureKeys: makeBuffer(
        `${prefix}-capture-keys`,
        eventCapacity * Uint32Array.BYTES_PER_ELEMENT
      ),
      captureValues: makeBuffer(
        `${prefix}-capture-values`,
        eventCapacity * SPH_REACTION_PRODUCT_PLACEMENT_CAPTURE_VALUE_ROWS
          * 4 * Float32Array.BYTES_PER_ELEMENT
      ),
      captureReduceA: makeBuffer(
        `${prefix}-capture-reduce-a`,
        eventCapacity * SPH_REACTION_PRODUCT_PLACEMENT_CAPTURE_VALUE_ROWS
          * 4 * Float32Array.BYTES_PER_ELEMENT
      ),
      captureReduceB: makeBuffer(
        `${prefix}-capture-reduce-b`,
        eventCapacity * SPH_REACTION_PRODUCT_PLACEMENT_CAPTURE_VALUE_ROWS
          * 4 * Float32Array.BYTES_PER_ELEMENT
      ),
      directKeys: makeBuffer(
        `${prefix}-direct-keys`,
        eventCapacity * 2 * Uint32Array.BYTES_PER_ELEMENT
      ),
      directValues: makeBuffer(
        `${prefix}-direct-values`,
        eventCapacity * SPH_REACTION_PRODUCT_PLACEMENT_DIRECT_VALUE_ROWS
          * 4 * Float32Array.BYTES_PER_ELEMENT
      ),
      directReduceA: makeBuffer(
        `${prefix}-direct-reduce-a`,
        eventCapacity * SPH_REACTION_PRODUCT_PLACEMENT_DIRECT_VALUE_ROWS
          * 4 * Float32Array.BYTES_PER_ELEMENT
      ),
      directReduceB: makeBuffer(
        `${prefix}-direct-reduce-b`,
        eventCapacity * SPH_REACTION_PRODUCT_PLACEMENT_DIRECT_VALUE_ROWS
          * 4 * Float32Array.BYTES_PER_ELEMENT
      ),
      directEndpointClaims: makeBuffer(
        `${prefix}-direct-endpoint-claims`,
        particleCapacity * Uint32Array.BYTES_PER_ELEMENT
      ),
      eventPlan: makeBuffer(
        `${prefix}-event-plan`,
        eventCapacity * SPH_REACTION_PRODUCT_PLACEMENT_EVENT_PLAN_ROWS
          * 4 * Float32Array.BYTES_PER_ELEMENT
      ),
      summaryKeys: makeBuffer(
        `${prefix}-summary-keys`,
        eventCapacity * Uint32Array.BYTES_PER_ELEMENT
      ),
      summaryValues: makeBuffer(
        `${prefix}-summary-values`,
        eventCapacity * SPH_REACTION_PRODUCT_PLACEMENT_SUMMARY_VALUE_ROWS
          * 4 * Float32Array.BYTES_PER_ELEMENT
      ),
      summaryReduceA: makeBuffer(
        `${prefix}-summary-reduce-a`,
        eventCapacity * SPH_REACTION_PRODUCT_PLACEMENT_SUMMARY_VALUE_ROWS
          * 4 * Float32Array.BYTES_PER_ELEMENT
      ),
      summaryReduceB: makeBuffer(
        `${prefix}-summary-reduce-b`,
        eventCapacity * SPH_REACTION_PRODUCT_PLACEMENT_SUMMARY_VALUE_ROWS
          * 4 * Float32Array.BYTES_PER_ELEMENT
      ),
      candidateSummary: makeBuffer(
        `${prefix}-candidate-summary`,
        productTermCapacity * 8 * 4 * Float32Array.BYTES_PER_ELEMENT,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      ),
      reductionParams: makeBuffer(
        `${prefix}-reduction-params`,
        reductionParamRowCount * 256,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      // Normal resident execution allocates no MAP_READ resource. The getter
      // exposes the private diagnostic allocation only after an acquisition
      // explicitly requests observation.
      get completionReadback() {
        return completionReadback;
      }
    };
    const radixOptions = {
      maxElementCount: eventCapacity,
      retainConstantScanParamsBuffers: true,
      retainVariableScanParamsBuffers: false,
      retainedParamsSlotCount: 1,
      serialHistogramScanMaxElementCount: 4096
    };
    const captureRadix = createWebGpuStableRadixScanUnique(device, {
      ...radixOptions,
      maxKeyWordCount: 1,
      label: `${prefix}-capture-radix`
    });
    createdRadixRuntimes.push(captureRadix);
    const directRadix = createWebGpuStableRadixScanUnique(device, {
      ...radixOptions,
      maxKeyWordCount: 2,
      label: `${prefix}-direct-radix`
    });
    createdRadixRuntimes.push(directRadix);
    const summaryRadix = createWebGpuStableRadixScanUnique(device, {
      ...radixOptions,
      maxKeyWordCount: 1,
      label: `${prefix}-summary-radix`
    });
    createdRadixRuntimes.push(summaryRadix);
    for (const runtime of createdRadixRuntimes) {
      for (const { buffer } of runtime.allocationEntries()) {
        tagWebGpuBufferDevice(buffer, device);
      }
    }

    const paramRows = [];
    const appendReductionParams = (valueStride, levelCount, keyStrideWords) => {
      const initOffset = paramRows.length * 256;
      paramRows.push([eventCapacity, 0, valueStride, keyStrideWords]);
      const levelOffsets = [];
      for (let level = 0; level < levelCount; level += 1) {
        levelOffsets.push(paramRows.length * 256);
        paramRows.push([eventCapacity, 2 ** level, valueStride, keyStrideWords]);
      }
      return { initOffset, levelOffsets };
    };
    const reductionOffsets = Object.freeze({
      capture: appendReductionParams(
        SPH_REACTION_PRODUCT_PLACEMENT_CAPTURE_VALUE_ROWS,
        captureLevels,
        1
      ),
      direct: appendReductionParams(
        SPH_REACTION_PRODUCT_PLACEMENT_DIRECT_VALUE_ROWS,
        directLevels,
        2
      ),
      summary: appendReductionParams(
        SPH_REACTION_PRODUCT_PLACEMENT_SUMMARY_VALUE_ROWS,
        summaryLevels,
        1
      )
    });
    const paramsData = new Uint32Array((paramRows.length * 256) / 4);
    paramRows.forEach((row, index) => paramsData.set(row, index * 64));
    device.queue.writeBuffer(buffers.reductionParams, 0, paramsData);
    device.queue.writeBuffer(
      buffers.compactParams,
      0,
      new Uint32Array([eventCapacity, eventStrideVec4, eventGroups, 0])
    );
    device.queue.writeBuffer(
      buffers.spareParticleScanParams,
      0,
      new Uint32Array([particleGroups, 0, particleCapacity, 0])
    );
    device.queue.writeBuffer(
      buffers.spareEventScanParams,
      0,
      new Uint32Array([eventGroups, 1, eventCapacity, 0])
    );
    const arena = Object.freeze({
      schema: 'peercompute.ulg.sph-reaction-product-placement-segmented-arena.v2',
      status: 'sph-reaction-product-placement-segmented-arena-ready',
      spatialArenaIndex,
      particleCapacity,
      eventCapacity,
      productTermCapacity,
      eventStrideVec4,
      exactCompactionMassWordCount,
      exactCompanionStrideWords,
      exactChemistrySignature: exactChemistryConfiguration?.signature ?? null,
      exactChemistryLayout: exactChemistryConfiguration?.layout ?? null,
      exactCaptureSignature: exactCaptureConfiguration?.signature ?? null,
      exactPhysicalSignature: exactPhysicalConfiguration?.signature ?? null,
      exactEventSignature: exactEventConfiguration?.signature ?? null,
      exactCaptureLayout: exactCaptureConfiguration?.capture ?? null,
      exactCaptureMergeLayout: exactCaptureConfiguration?.merge ?? null,
      captureReductionLevelCount: captureLevels,
      directReductionLevelCount: directLevels,
      summaryReductionLevelCount: summaryLevels,
      get diagnosticReadbackReady() {
        return completionReadback != null;
      },
      law: SPH_REACTION_PRODUCT_PLACEMENT_LAW,
      buffers: Object.freeze(buffers)
    });
    record = {
      device,
      arena,
      buffers,
      captureRadix,
      directRadix,
      summaryRadix,
      reductionOffsets,
      ensureDiagnosticCompletionReadback,
      ownedBuffers: new Set(createdBuffers),
      bufferCreationCount:
        createdBuffers.length
        + captureRadix.allocationEntries().length
        + directRadix.allocationEntries().length
        + summaryRadix.allocationEntries().length,
      acquisitionCount: 0,
      warmReuseCount: 0,
      diagnosticReadbackBufferCreationCount: 0,
      inFlight: false,
      leaseOrdinal: 0,
      activeEncoding: null,
      terminal: false,
      deviceLost: false,
      destroyed: false,
      diagnosticObservationGate: null
    };
    if(exactChemistryConfiguration){
      exactChemistryConfiguration.context.validate();
      exactChemistryConfiguration.context.read.markDerivedBuffers(Object.entries(buffers)
        .filter(([key])=>key.startsWith('exactChemistry')).map(([,buffer])=>buffer));
      exactChemistryConfiguration.context.validate();
    }
    if(exactEventConfiguration){
      exactEventConfiguration.context.validate();
      exactEventConfiguration.context.read.markDerivedBuffers(Object.entries(buffers)
        .filter(([key])=>key.startsWith('exactEvent')).map(([,buffer])=>buffer));
      exactEventConfiguration.context.validate();
    }
    segmentedPlacementArenaRecords.set(arena, record);
    const quarantineAfterDeviceLoss = (info) => {
      record.deviceLost = true;
      record.terminal = true;
      const gate = record.diagnosticObservationGate;
      if (gate && !gate.settled) {
        gate.settled = true;
        gate.reject(placementArenaError(
          `device lost before diagnostic placement observation completed${
            info?.message ? `: ${info.message}` : ''
          }`,
          'DEVICE_LOSS'
        ));
      }
      // GPUBuffer contents are no longer consumable after device loss. Destroy
      // immediately even for an in-flight lease so release/discard cannot get
      // trapped behind the normal terminal-record validator.
      destroySegmentedPlacementArenaRecord(record);
    };
    Promise.resolve(device.lost).then(
      quarantineAfterDeviceLoss,
      quarantineAfterDeviceLoss
    );
    return arena;
  } catch (error) {
    for (const runtime of createdRadixRuntimes.reverse()) {
      try { runtime.destroy(); } catch {}
    }
    for (const buffer of createdBuffers.reverse()) {
      try { buffer.destroy?.(); } catch {}
    }
    throw error;
  }
}

function destroySegmentedPlacementArenaRecord(record) {
  if (!record || record.destroyed) return false;
  if (record.inFlight && !record.deviceLost) {
    throw placementArenaError('cannot destroy an in-flight placement arena', 'ARENA_LEASE');
  }
  record.destroyed = true;
  for (const runtime of [
    record.captureRadix,
    record.directRadix,
    record.summaryRadix
  ]) {
    try { runtime.destroy(); } catch {}
  }
  for (const buffer of record.ownedBuffers) {
    try { buffer.destroy?.(); } catch {}
  }
  record.ownedBuffers.clear();
  return true;
}

export function acquireSphReactionProductPlacementSegmentedArenaWebGpu({
  device,
  authority,
  particleCapacity = authority?.particleCount,
  eventCapacity = authority?.productEventCapacity,
  productTermCapacity,
  eventStrideVec4 = 8,
  diagnosticReadbackRequested = false
} = {}) {
  requireLivePlacementAuthority(authority, {
    device,
    operation: 'segmented placement arena acquisition'
  });
  // Representation derives only from the original authority's held producer.
  const exactCompaction = resolveSphReactionProductPlacementExactCompactionSource(authority, { device });
  const exactCompactionMassWordCount = exactCompaction?.massWordCount ?? 0;
  const exactCaptureConfiguration = exactCaptureConfigurationForAuthority(authority, device);
  const exactPhysicalConfiguration = exactPhysicalConfigurationForAuthority(authority, device);
  const exactEventConfiguration = exactEventConfigurationForAuthority(authority, device);
  const exactChemistryConfiguration = exactChemistryConfigurationForAuthority(authority, device);
  if (Boolean(exactCaptureConfiguration) !== Boolean(exactCompaction)) {
    throw placementError('exact arena lost its held quantity source', 'EXACT_CAPTURE_IDENTITY');
  }
  const particles = exactPositiveU32(particleCapacity, 'particleCapacity');
  const events = exactPositiveU32(eventCapacity, 'eventCapacity');
  const terms = exactPositiveU32(productTermCapacity, 'productTermCapacity');
  const stride = exactPositiveU32(eventStrideVec4, 'eventStrideVec4');
  if (exactCaptureConfiguration) planSphReactionProductPlacementDispatchWorkgroups({
    device, eventCount: events, particleCount: particles, productTermCount: terms
  });
  if (particles !== authority.particleCount || events !== authority.productEventCapacity) {
    throw placementArenaError('placement arena capacity does not match its authority', 'IDENTITY');
  }
  const spatialArenaIndex = authority.spatialArenaIndex;
  let cache = segmentedPlacementArenaCache.get(device);
  if (!cache) {
    cache = new Map();
    segmentedPlacementArenaCache.set(device, cache);
  }
  let arena = cache.get(spatialArenaIndex) ?? null;
  let record = arena ? segmentedPlacementArenaRecords.get(arena) : null;
  const signatureMatches = Boolean(
    arena
    && arena.particleCapacity === particles
    && arena.eventCapacity === events
    && arena.productTermCapacity === terms
    && arena.eventStrideVec4 === stride
    && arena.exactCompactionMassWordCount === exactCompactionMassWordCount
    && arena.exactChemistrySignature === (exactChemistryConfiguration?.signature ?? null)
    && arena.exactCaptureSignature === (exactCaptureConfiguration?.signature ?? null)
    && arena.exactPhysicalSignature === (exactPhysicalConfiguration?.signature ?? null)
    && arena.exactEventSignature === (exactEventConfiguration?.signature ?? null)
  );
  if (record?.inFlight) {
    const error = placementArenaError(
      `placement arena ${spatialArenaIndex} is still in flight`,
      'ARENA_BACKPRESSURE'
    );
    error.retryAfterFence = record.releaseFence ?? null;
    throw error;
  }
  if (record?.terminal || record?.destroyed || !signatureMatches) {
    if (record && !record.destroyed) destroySegmentedPlacementArenaRecord(record);
    cache.delete(spatialArenaIndex);
    arena = null;
    record = null;
  }
  let bufferCreationCount = 0;
  if (!arena) {
    arena = createSegmentedPlacementArena(device, {
      spatialArenaIndex,
      particleCapacity: particles,
      eventCapacity: events,
      productTermCapacity: terms,
      eventStrideVec4: stride,
      exactCompactionMassWordCount,
      exactCaptureConfiguration,
      exactPhysicalConfiguration,
      exactEventConfiguration,
      exactChemistryConfiguration
    });
    cache.set(spatialArenaIndex, arena);
    record = segmentedPlacementArenaRecords.get(arena);
    bufferCreationCount = record.bufferCreationCount;
  } else {
    record.warmReuseCount += 1;
  }
  let diagnosticReadbackBufferCreationCount = 0;
  if (diagnosticReadbackRequested === true && !arena.diagnosticReadbackReady) {
    record.ensureDiagnosticCompletionReadback();
    diagnosticReadbackBufferCreationCount = 1;
    bufferCreationCount += 1;
  }
  record.inFlight = true;
  record.exactCompactionEncoding = null;
  record.exactCapturePreparation = null;
  record.exactEventRecord = null;
  record.exactEventPreparation = null;
  record.exactPhysicalPreparation = null;
  record.exactPhysicalConsumptionRecord = null;
  record.exactPhysicalConsumption = null;
  record.exactChemistryRecord = null;
  record.exactChemistryPreparation = null;
  record.exactTerminalRecord = null;
  record.exactTerminalEncoding = null;
  record.acquisitionCount += 1;
  record.leaseOrdinal += 1;
  record.authority = authority;
  record.releaseFence = null;
  record.diagnosticObservationGate = null;
  return Object.freeze({
    arena,
    authority,
    leaseOrdinal: record.leaseOrdinal,
    bufferCreationCount,
    diagnosticReadbackBufferCreationCount,
    completionReadbackBuffer: arena.buffers.completionReadback,
    warmReuse: bufferCreationCount === 0
  });
}

function requireSegmentedPlacementArenaLease(lease, { device, authority } = {}) {
  const arena = lease?.arena;
  const record = segmentedPlacementArenaRecords.get(arena);
  if (
    !record
    || record.destroyed
    || record.terminal
    || !record.inFlight
    || record.device !== device
    || lease.authority !== authority
    || record.authority !== authority
    || lease.leaseOrdinal !== record.leaseOrdinal
  ) {
    throw placementArenaError('segmented placement arena lease is stale or foreign', 'ARENA_LEASE');
  }
  return record;
}

function requireSegmentedPlacementArenaCleanupLease(
  lease,
  { device, authority } = {}
) {
  const arena = lease?.arena;
  const record = segmentedPlacementArenaRecords.get(arena);
  if (
    !record
    || record.device !== device
    || lease?.authority !== authority
    || lease?.leaseOrdinal !== record.leaseOrdinal
    || (record.authority != null && record.authority !== authority)
  ) {
    throw placementArenaError(
      'segmented placement arena cleanup lease is stale or foreign',
      'ARENA_LEASE'
    );
  }
  return record;
}

function createSegmentedPlacementQueueOrderedCleanup(record, encoding) {
  return () => {
    if (encoding) {
      for (const [runtime, execution] of [
        [record.captureRadix, encoding.captureRadixExecution],
        [record.directRadix, encoding.directRadixExecution],
        [record.summaryRadix, encoding.summaryRadixExecution]
      ]) {
        if (!runtime.canReleaseExecutionQueueOrdered(execution)) {
          throw placementArenaError(
            'placement radix execution lost exact queue-ordered ownership',
            'ARENA_LEASE'
          );
        }
        runtime.releaseExecutionQueueOrdered(execution);
      }
    }
    record.activeEncoding = null;
    record.exactCapturePreparation = null;
  record.exactEventRecord = null;
  record.exactEventPreparation = null;
  record.exactPhysicalPreparation = null;
  record.exactPhysicalConsumptionRecord = null;
  record.exactPhysicalConsumption = null;
  record.exactChemistryRecord = null;
  record.exactChemistryPreparation = null;
  record.exactTerminalRecord = null;
  record.exactTerminalEncoding = null;
    record.inFlight = false;
    record.authority = null;
    record.diagnosticObservationGate = null;
    if (record.terminal || record.deviceLost) {
      destroySegmentedPlacementArenaRecord(record);
    }
  };
}

export function releaseSphReactionProductPlacementSegmentedArenaAfterQueue(
  lease,
  { device, authority, submissionArtifact } = {}
) {
  const record = requireSegmentedPlacementArenaCleanupLease(lease, {
    device,
    authority
  });
  if (record.destroyed || record.deviceLost) {
    return Promise.resolve(false);
  }
  if (!record.inFlight || record.terminal) {
    throw placementArenaError(
      'segmented placement arena release lease is no longer active',
      'ARENA_LEASE'
    );
  }
  const submitted = submittedPlacementArtifactRecords.get(submissionArtifact);
  const queueOrderedRelease = Boolean(
    submissionArtifact?.queueOrderedReleaseAuthorized === true
    && submissionArtifact?.queueFenceStatus
      === 'same-queue-submission-order'
    && submissionArtifact?.hostQueueFenceCount === 0
  );
  if (
    !submitted
    || submitted.authority !== authority
    || submitted.record.device !== device
    || (
      !queueOrderedRelease
      && !submissionArtifact.queueFence?.then
    )
  ) {
    throw placementArenaError(
      'placement arena release requires an exact submitted artifact cleanup authority',
      'ARENA_LEASE'
    );
  }
  const encoding = record.activeEncoding;
  const diagnosticObservationRequired = Boolean(
    submissionArtifact.diagnosticReadbackRequested === true
      && submissionArtifact.completionReadbackBuffer
  );
  if (diagnosticObservationRequired) {
    segmentedPlacementDiagnosticArenaBySubmissionArtifact.set(
      submissionArtifact,
      record
    );
    record.diagnosticObservationGate =
      createPlacementDiagnosticObservationGate(submissionArtifact);
    if (segmentedPlacementDiagnosticObservationOutcomes.has(submissionArtifact)) {
      settlePlacementDiagnosticObservation(submissionArtifact);
    }
  }
  if (queueOrderedRelease) {
    if (
      diagnosticObservationRequired
      && !segmentedPlacementDiagnosticObservationOutcomes.has(
        submissionArtifact
      )
    ) {
      throw placementArenaError(
        'diagnostic placement arena release requires its completed observation',
        'ARENA_LEASE'
      );
    }
    const diagnosticObservationOutcome = diagnosticObservationRequired
      ? segmentedPlacementDiagnosticObservationOutcomes.get(
          submissionArtifact
        )
      : null;
    const diagnosticObservationFailed =
      diagnosticObservationOutcome?.succeeded === false;
    if (diagnosticObservationFailed) {
      // A failed map/copy/unmap leaves the diagnostic buffer's state
      // untrustworthy. Preserve the established quarantine contract even on
      // the host-fence-free cleanup route: queue order makes destruction safe,
      // but it must never make this arena reusable.
      record.terminal = true;
    }
    const queueOrderedCleanupRecord =
      segmentedPlacementQueueOrderedCleanupRecords.get(encoding);
    if (!queueOrderedCleanupRecord) {
      throw placementArenaError(
        'placement arena release requires its producer-issued cleanup claim',
        'ARENA_LEASE'
      );
    }
    const releaseReceipt = releaseSubmittedWorkCleanupQueueOrdered(
      device,
      queueOrderedCleanupRecord.cleanup,
      {
        queueOrderedFinalConsumer:
          submissionArtifact.queueOrderedFinalConsumerCapability,
        producerClaim: queueOrderedCleanupRecord.claim,
        producerOutput: encoding,
        producerFamily:
          'schroeder-reaction-placement-segmented-arena'
      }
    );
    record.releaseFence = Promise.resolve(releaseReceipt).then(
      () => !diagnosticObservationFailed
    );
    return record.releaseFence;
  }
  record.releaseFence = submissionArtifact.queueFence.then(
    async () => {
      try {
        if (record.diagnosticObservationGate) {
          await record.diagnosticObservationGate.promise;
        }
        if (encoding) {
          await Promise.all([
            record.captureRadix.releaseExecutionAfter(
              encoding.captureRadixExecution,
              submissionArtifact.queueFence
            ),
            record.directRadix.releaseExecutionAfter(
              encoding.directRadixExecution,
              submissionArtifact.queueFence
            ),
            record.summaryRadix.releaseExecutionAfter(
              encoding.summaryRadixExecution,
              submissionArtifact.queueFence
            )
          ]);
        }
        record.activeEncoding = null;
        record.inFlight = false;
        record.authority = null;
        record.diagnosticObservationGate = null;
        if (record.terminal || record.deviceLost) {
          destroySegmentedPlacementArenaRecord(record);
        }
        return true;
      } catch {
        record.terminal = true;
        record.activeEncoding = null;
        record.inFlight = false;
        record.authority = null;
        record.diagnosticObservationGate = null;
        destroySegmentedPlacementArenaRecord(record);
        return false;
      }
    },
    () => {
      record.terminal = true;
      record.deviceLost = true;
      record.activeEncoding = null;
      record.inFlight = false;
      record.authority = null;
      record.diagnosticObservationGate = null;
      destroySegmentedPlacementArenaRecord(record);
      return false;
    }
  );
  return record.releaseFence;
}

export function discardSphReactionProductPlacementSegmentedArenaLease(
  lease,
  { device, authority } = {}
) {
  const record = requireSegmentedPlacementArenaCleanupLease(lease, {
    device,
    authority
  });
  if (record.destroyed || record.deviceLost) {
    return false;
  }
  if (!record.inFlight) return false;
  const encoding = record.activeEncoding;
  const preparedCapture = record.exactCapturePreparation?.captureRadixExecution;
  if (preparedCapture && preparedCapture !== encoding?.captureRadixExecution) {
    record.captureRadix.releaseExecution(preparedCapture, { discardedEncoder: true });
  }
  record.exactCapturePreparation = null;
  record.exactEventRecord = null;
  record.exactEventPreparation = null;
  record.exactPhysicalPreparation = null;
  record.exactPhysicalConsumptionRecord = null;
  record.exactPhysicalConsumption = null;
  record.exactChemistryRecord = null;
  record.exactChemistryPreparation = null;
  record.exactTerminalRecord = null;
  record.exactTerminalEncoding = null;
  if (encoding) {
    for (const [runtime, execution] of [
      [record.captureRadix, encoding.captureRadixExecution],
      [record.directRadix, encoding.directRadixExecution],
      [record.summaryRadix, encoding.summaryRadixExecution]
    ]) {
      try { runtime.releaseExecution(execution, { discardedEncoder: true }); } catch {}
    }
  }
  record.activeEncoding = null;
  record.inFlight = false;
  record.authority = null;
  record.diagnosticObservationGate = null;
  if (record.terminal && !record.destroyed) {
    destroySegmentedPlacementArenaRecord(record);
  }
  return true;
}

export function sphReactionProductPlacementSegmentedArenaStats(arena) {
  const record = segmentedPlacementArenaRecords.get(arena);
  if (!record) return null;
  return Object.freeze({
    status: record.destroyed
      ? 'destroyed'
      : record.deviceLost
        ? 'device-lost-terminal'
        : record.inFlight
          ? 'in-flight'
          : 'idle',
    spatialArenaIndex: arena.spatialArenaIndex,
    particleCapacity: arena.particleCapacity,
    eventCapacity: arena.eventCapacity,
    productTermCapacity: arena.productTermCapacity,
    bufferCreationCount: record.bufferCreationCount,
    acquisitionCount: record.acquisitionCount,
    warmReuseCount: record.warmReuseCount,
    diagnosticReadbackReady: record.arena.diagnosticReadbackReady,
    diagnosticReadbackBufferCreationCount:
      record.diagnosticReadbackBufferCreationCount,
    diagnosticObservationPending: Boolean(
      record.diagnosticObservationGate
        && !record.diagnosticObservationGate.settled
    ),
    inFlight: record.inFlight,
    terminal: record.terminal,
    deviceLost: record.deviceLost
  });
}

export function destroySphReactionProductPlacementSegmentedArenaWebGpu(arena) {
  const record = segmentedPlacementArenaRecords.get(arena);
  if (!record) return false;
  return destroySegmentedPlacementArenaRecord(record);
}

function placementParamsData({
  particleCount,
  eventCount,
  eventStrideVec4,
  productTermCount,
  boxDimsM,
  generationId,
  supportProfileId,
  diagnosticReadbackRequested = false
}) {
  const data = new ArrayBuffer(64);
  const view = new DataView(data);
  const u32 = (offset, value) => view.setUint32(offset, Number(value) >>> 0, true);
  const f32 = (offset, value) => view.setFloat32(offset, Number(value), true);
  u32(0, particleCount);
  u32(4, eventCount);
  u32(8, eventStrideVec4);
  u32(12, 2);
  u32(16, 3);
  u32(20, 8);
  f32(24, 1.0e-9);
  u32(28, productTermCount);
  f32(32, boxDimsM[0]);
  f32(36, boxDimsM[1]);
  f32(40, boxDimsM[2]);
  u32(44, boxDimsM.every((value) => value > 0) ? 1 : 0);
  u32(48, 1);
  u32(52, generationId);
  u32(56, supportProfileId);
  u32(60, SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION);
  // diagnosticReadbackRequested is recorded by the exact submission wrapper;
  // it deliberately does not alter the shader contract or completion status.
  void diagnosticReadbackRequested;
  return data;
}

export function planSphReactionProductPlacementDispatchWorkgroups({
  device,
  eventCount,
  particleCount,
  productTermCount
} = {}) {
  const counts = {
    event: exactPositiveU32(eventCount, 'eventCount'),
    particle: exactPositiveU32(particleCount, 'particleCount'),
    term: exactPositiveU32(productTermCount, 'productTermCount')
  };
  const advertisedLimit = Number(
    device?.limits?.maxComputeWorkgroupsPerDimension ?? 65_535
  );
  const limit = Number.isInteger(advertisedLimit) && advertisedLimit > 0
    ? advertisedLimit
    : 65_535;
  const workgroups = Object.fromEntries(
    Object.entries(counts).map(([name, count]) => [
      name,
      Math.max(1, Math.ceil(count / 64))
    ])
  );
  const exceeded = Object.entries(workgroups).find(([, count]) => count > limit);
  if (exceeded) {
    const [axis, required] = exceeded;
    const error = new RangeError(
      `reaction product placement ${axis} dispatch requires ${required} x-workgroups; device limit is ${limit}`
    );
    error.code = 'ERR_SPH_REACTION_PRODUCT_PLACEMENT_DISPATCH_LIMIT';
    error.dispatchClass = axis;
    error.requiredWorkgroups = required;
    error.maxComputeWorkgroupsPerDimension = limit;
    throw error;
  }
  return Object.freeze({
    eventWorkgroups: workgroups.event,
    particleWorkgroups: workgroups.particle,
    termWorkgroups: workgroups.term,
    maxComputeWorkgroupsPerDimension: limit
  });
}

function explicitPlacementPipeline(device, {
  cacheKey,
  label,
  code,
  entryPoint,
  bindings
}) {
  return createCachedExplicitComputePipeline(device, {
    cacheKey,
    label,
    code,
    entryPoint,
    bindings
  });
}

// Product placement is a fixed segmented dataflow. Material identity,
// reaction identity, event capacity, and topology counts are buffer data, not
// shader specializations. The live encoder and lane prewarm share these exact
// descriptors so the first authenticated placement never compiles programs.
export function sphReactionProductPlacementSegmentedPipelineDescriptors() {
  const ro = (binding) => computeBufferBinding(binding, 'read-only-storage');
  const rw = (binding) => computeBufferBinding(binding, 'storage');
  const uniform = (binding) => computeBufferBinding(binding, 'uniform');
  const descriptor = (name, code, entryPoint, bindings) => Object.freeze({
    cacheKey: `ulg-sph-reaction-placement-segmented-v4-${name}`,
    label: `ulg-sph-reaction-placement-segmented-${name}`,
    code,
    entryPoint,
    bindings
  });
  return Object.freeze({
    schema:
      'peercompute.ulg.sph-reaction-product-placement-segmented-pipeline-descriptors.v0',
    preflight: descriptor(
      'preflight',
      sphReactionProductPlacementPreflightWgsl,
      'preflight_segmented_placement',
      [ro(0), rw(1), uniform(2), rw(3)]
    ),
    plan: descriptor(
      'plan',
      sphReactionProductPlacementPlanWgsl,
      'plan_product_events',
      [ro(0), ro(1), ro(2), ro(4), rw(5), rw(6), rw(7), ro(8), uniform(9)]
    ),
    eventApply: descriptor(
      'event-apply',
      sphReactionProductPlacementEventApplyWgsl,
      'apply_unique_events_and_emit_summaries',
      [rw(0), rw(1), rw(2), rw(3), ro(5), rw(6), rw(7), rw(8), uniform(9)]
    ),
    captureInitialize: descriptor(
      'capture-initialize',
      sphReactionProductPlacementCaptureReduceWgsl,
      'initialize_capture_segments',
      [ro(0), ro(1), ro(2), ro(3), rw(4), uniform(5)]
    ),
    captureReduce: descriptor(
      'capture-reduce',
      sphReactionProductPlacementCaptureReduceWgsl,
      'reduce_capture_segments',
      [ro(0), ro(1), ro(2), ro(3), rw(4), uniform(5)]
    ),
    captureApply: descriptor(
      'capture-apply',
      sphReactionProductPlacementCaptureApplyWgsl,
      'apply_capture_segment_tails',
      [ro(0), ro(1), ro(2), rw(3), rw(4), rw(5), rw(6), rw(7), uniform(8)]
    ),
    directPlan: descriptor(
      'direct-plan',
      sphReactionProductPlacementDirectPlanWgsl,
      'emit_direct_pair_hyperedges',
      [ro(0), ro(1), ro(2), ro(3), ro(4), rw(5), rw(6), rw(7), uniform(8)]
    ),
    directInitialize: descriptor(
      'direct-initialize',
      sphReactionProductPlacementDirectReduceWgsl,
      'initialize_direct_segments',
      [ro(0), ro(1), ro(2), ro(3), rw(4), uniform(5)]
    ),
    directReduce: descriptor(
      'direct-reduce',
      sphReactionProductPlacementDirectReduceWgsl,
      'reduce_direct_segments',
      [ro(0), ro(1), ro(2), ro(3), rw(4), uniform(5)]
    ),
    directClaimInitialize: descriptor(
      'direct-claim-init',
      sphReactionProductPlacementDirectApplyWgsl,
      'initialize_direct_endpoint_claims',
      [ro(0), ro(1), ro(2), rw(3), ro(4), ro(5), rw(6), rw(7), uniform(8)]
    ),
    directClaim: descriptor(
      'direct-claim',
      sphReactionProductPlacementDirectApplyWgsl,
      'claim_direct_pair_hyperedge_endpoints',
      [ro(0), ro(1), ro(2), rw(3), ro(4), ro(5), rw(6), rw(7), uniform(8)]
    ),
    directApply: descriptor(
      'direct-apply',
      sphReactionProductPlacementDirectApplyWgsl,
      'apply_direct_pair_hyperedge_tails',
      [ro(0), ro(1), ro(2), rw(3), ro(4), ro(5), rw(6), rw(7), uniform(8)]
    ),
    summaryInitialize: descriptor(
      'summary-initialize',
      sphReactionProductPlacementSummaryReduceWgsl,
      'initialize_summary_segments',
      [ro(0), ro(1), ro(2), ro(3), rw(4), uniform(5)]
    ),
    summaryReduce: descriptor(
      'summary-reduce',
      sphReactionProductPlacementSummaryReduceWgsl,
      'reduce_summary_segments',
      [ro(0), ro(1), ro(2), ro(3), rw(4), uniform(5)]
    ),
    termInitialize: descriptor(
      'term-initialize',
      sphReactionProductPlacementSummaryApplyWgsl,
      'initialize_product_term_summaries',
      [ro(0), ro(1), ro(2), rw(3), rw(4), uniform(5)]
    ),
    summaryApply: descriptor(
      'summary-apply',
      sphReactionProductPlacementSummaryApplyWgsl,
      'apply_product_term_segment_tails',
      [ro(0), ro(1), ro(2), rw(3), rw(4), uniform(5)]
    ),
    finalize: descriptor(
      'finalize',
      sphReactionProductPlacementFinalizeWgsl,
      'finalize_segmented_placement_receipt',
      [ro(0), ro(1), rw(2), uniform(3)]
    ),
    transactionalPublish: descriptor(
      'transactional-publish',
      sphReactionProductPlacementTransactionalPublishWgsl,
      'publish_or_restore_placement_destination',
      [ro(0), ro(1), ro(2), rw(3), rw(4), rw(5), rw(6), uniform(7)]
    ),
    transactionalAuxiliaryPublish: descriptor(
      'transactional-auxiliary-publish',
      sphReactionProductPlacementTransactionalAuxiliaryPublishWgsl,
      'publish_or_retain_placement_ledgers',
      [ro(0), rw(1), ro(2), rw(3), rw(4), uniform(5)]
    ),
    transactionalTerminal: descriptor(
      'transactional-terminal',
      sphReactionProductPlacementTransactionalTerminalWgsl,
      'seal_transactional_placement_publication',
      [rw(0), uniform(1)]
    ),
    transactionalDestinationRecovery: descriptor(
      'transactional-destination-recovery',
      sphReactionProductPlacementTransactionalDestinationRecoveryWgsl,
      'recover_unsafe_placement_destination',
      [ro(0), ro(1), ro(2), rw(3), rw(4), rw(5), rw(6), uniform(7)]
    ),
    transactionalAuxiliaryMaterialize: descriptor(
      'transactional-auxiliary-materialize',
      sphReactionProductPlacementTransactionalAuxiliaryMaterializeWgsl,
      'materialize_safe_placement_ledgers',
      [ro(0), rw(1), ro(2), rw(3), rw(4), uniform(5)]
    )
  });
}

export function enumerateSphReactionProductPlacementSegmentedPrewarmPipelineDescriptors() {
  const { schema: _schema, ...descriptors } =
    sphReactionProductPlacementSegmentedPipelineDescriptors();
  return Object.values(descriptors);
}

function placementTimestampBegin(recorder, encoder, descriptor) {
  return recorder?.active === true
    && typeof recorder.beginEncoderSpan === 'function'
    && typeof recorder.endEncoderSpan === 'function'
    ? recorder.beginEncoderSpan(encoder, descriptor)
    : null;
}

function placementTimestampEnd(recorder, encoder, token) {
  if (token) recorder.endEncoderSpan(encoder, token);
}

function encodePlacementPass({
  encoder,
  pipeline,
  bindGroup,
  workgroupCount,
  label,
  producerId,
  gpuTimestampRecorder,
  metadata
}) {
  const timestamp = placementTimestampBegin(
    gpuTimestampRecorder,
    encoder,
    {
      producerId,
      stage: label,
      spanClass: 'same-production-command-encoder-profiled-pass',
      ...metadata
    }
  );
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(workgroupCount);
  pass.end();
  placementTimestampEnd(gpuTimestampRecorder, encoder, timestamp);
}

function placementBindGroup(device, pipelineInfo, label, entries) {
  return cachedWebGpuBindGroup(device, {
    label,
    layout: pipelineInfo.bindGroupLayout,
    entries
  });
}

// Numeric descriptors are public; preparation stays inside the original
// placement authority and cannot independently admit physical publication.
function exactCaptureConfigurationForAuthority(authority, device) {
  const owner = requireLivePlacementAuthority(authority, { device, operation: 'exact capture configuration' });
  const context = owner.exactQuantityContext;
  if (!context) return null;
  const bindings = context.validate();
  const format = bindings.placedDestinationQuantityFormat;
  const quantityLayout = bindings.placedDestinationQuantityLayout;
  const capture = sphExactPlacementCaptureLayout(format, quantityLayout);
  const merge = sphExactPlacementCaptureMergeLayout(format, quantityLayout);
  if (quantityLayout.currentRowOffset !== 0 || quantityLayout.eventRowOffset !== authority.particleCount
      || capture.particleCount !== authority.particleCount || capture.eventCapacity !== authority.productEventCapacity) {
    throw placementError('exact capture must read the authenticated persistent current quantity layout', 'EXACT_CAPTURE_IDENTITY');
  }
  const signature = JSON.stringify([capture.schema, merge.schema, format.wordCount, format.quantumExponent,
    capture.scalar.wordCount, capture.scalar.recordWords, capture.particleCount, capture.eventCapacity,
    capture.quantityRecordWords, capture.quantityWordLength, capture.quantityCurrentRowOffset,
    capture.quantityEventRowOffset, capture.recordWords, merge.mergedWordLength, merge.mapWordLength]);
  const limit = device.limits?.maxComputeWorkgroupsPerDimension ?? 65535;
  const dispatch = planSphExactPlacementCaptureWorkgroups(capture.eventCapacity, limit);
  const initializeMergeDispatch = planSphExactPlacementCaptureWorkgroups(Math.max(capture.particleCount, capture.eventCapacity), limit);
  const sizes = [capture.byteLength, merge.mergedByteLength, merge.mapByteLength,
    capture.quantityWordLength * 4, SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES];
  for (const size of sizes) {
    if (!Number.isSafeInteger(size) || size < 4 || size > 0xffff_fffc
        || size > (device.limits?.maxBufferSize ?? Number.MAX_SAFE_INTEGER)
        || size > (device.limits?.maxStorageBufferBindingSize ?? Number.MAX_SAFE_INTEGER)) {
      throw placementError('exact capture scratch/current quantity exceeds device capacity', 'EXACT_CAPTURE_CAPACITY');
    }
  }
  context.validate();
  const protectedBuffers = Object.freeze([
    ...Object.values(owner.bindings), ...Object.values(context.physical), context.quantities.outputBuffer
  ].filter(value => value && Number.isSafeInteger(value.size)));
  return Object.freeze({ format, quantityLayout, capture, merge, signature, dispatch, initializeMergeDispatch, protectedBuffers });
}

// Same generators/layouts for prewarm and actual encoding. These code-generation
// descriptors confer no authority; the private encoder derives their arguments.
export function sphReactionProductPlacementExactCapturePipelineDescriptors(format, quantityLayout) {
  const capture = sphExactPlacementCapturePipelineDescriptors(format, quantityLayout);
  const merge = sphExactPlacementCaptureMergeLayout(format, quantityLayout);
  const code = createSphExactPlacementCaptureMergeWgsl(format, quantityLayout);
  const suffix = [format.wordCount, format.quantumExponent, merge.capture.scalar.wordCount,
    merge.particleCount, merge.eventCapacity, merge.recordWords, merge.capture.quantityCurrentRowOffset,
    merge.capture.quantityEventRowOffset, merge.capture.quantityWordLength, merge.mergedWordLength, merge.mapWordLength].join('-');
  const bindings = Array.from({ length: 8 }, (_, binding) =>
    computeBufferBinding(binding, binding < 5 ? 'read-only-storage' : 'storage'));
  const descriptor = (label, entryPoint) => Object.freeze({
    cacheKey: `ulg-exact-capture-merge-v1-${label}-${suffix}`, label: `ulg-exact-capture-merge-${label}`,
    code, entryPoint, bindings, workgroupSize: 1
  });
  return Object.freeze({ layout: capture.layout, mergeLayout: merge,
    initialize: capture.initialize, reduce: capture.reduce,
    mergeInitialize: descriptor('initialize', 'initialize_exact_capture_merge'),
    merge: descriptor('tails', 'merge_exact_capture_segment_tails') });
}

/** PRIVATE scratch preparation in the original owner. No arbitrary keys, sort,
 * source quantities, receipt or destination arguments are accepted. It records
 * the original preflight/key producer and original radix sequence, then exact
 * gather/reduce/merge. No S/T/M/current/history writes or publication occur. */
function encodeExactPlacementCapturePreparation({ device, encoder, authority, arenaLease,
  boxDimsM = [0, 0, 0], gpuTimestampRecorder = null } = {}) {
  const owner = requireLivePlacementAuthority(authority, { device, operation: 'exact capture preparation' });
  const arenaRecord = requireSegmentedPlacementArenaLease(arenaLease, { device, authority });
  const compact = owner.exactCompactionEncoding;
  if (!owner.exactQuantityContext || !compact || compact !== arenaRecord.exactCompactionEncoding
      || compact.encoder !== encoder || compact.arenaLease !== arenaLease
      || compact.authority !== authority || compact.completionReceiptBuffer !== owner.bindings.completionReceiptBuffer
      || compact.sourcePhysicalOutput !== owner.exactQuantityContext.physical) {
    throw placementError('exact capture requires its original compaction, encoder and lease', 'EXACT_CAPTURE_IDENTITY');
  }
  if (!encoder?.copyBufferToBuffer || !encoder?.beginComputePass || !encoder?.finish
      || owner.exactCapturePreparation || arenaRecord.exactCapturePreparation
      || owner.segmentedEncoding || owner.encodedPlacement || arenaRecord.activeEncoding) {
    throw placementError('exact capture preparation is one-shot in a live original encoder', 'SUBMISSION');
  }
  const config = exactCaptureConfigurationForAuthority(authority, device);
  const arena = arenaLease.arena, buffers = arena.buffers;
  if (!config || arena.exactCaptureSignature !== config.signature
      || arena.exactCaptureLayout?.recordWords !== config.capture.recordWords
      || arena.exactCaptureMergeLayout?.mergedWordLength !== config.merge.mergedWordLength) {
    throw placementError('exact capture arena layout differs from its private source', 'EXACT_CAPTURE_IDENTITY');
  }
  const bindings = owner.exactQuantityContext.validate();
  const quantities = bindings.placedDestinationQuantityBuffer;
  const state = bindings.placedDestinationStateBuffer ?? owner.bindings.placedDestinationStateBuffer;
  const frozenState = owner.bindings.frozenSourceStateBuffer;
  const frozenMechanics = owner.bindings.frozenSourceMechanicsBuffer;
  const receipt = owner.bindings.completionReceiptBuffer;
  const p = arena.particleCapacity, e = arena.eventCapacity;
  const four = [buffers.exactCaptureA, buffers.exactCaptureB, buffers.exactCaptureMerged, buffers.exactCaptureMap];
  const immutable = [quantities, state, frozenState, frozenMechanics, compact.productEventBuffer,
    ...Object.values(owner.bindings).filter(value => value && Number.isSafeInteger(value.size)),
    ...Object.values(owner.exactQuantityContext.physical).filter(value => value && Number.isSafeInteger(value.size)),
    owner.exactQuantityContext.quantities.outputBuffer,
    ...Object.values(buffers).filter(buffer => !four.includes(buffer)),
    ...arenaRecord.captureRadix.allocationEntries().map(entry => entry.buffer)];
  if (new Set(four).size !== 4 || four.some(buffer => immutable.includes(buffer))
      || new Set([buffers.captureKeys, buffers.captureValues, buffers.eventPlan, buffers.control,
        buffers.denseEmission, buffers.placementParams, receipt]).size !== 7) {
    throw placementError('exact capture scratch aliases current/source/original arena roles', 'SOURCE_DESTINATION_ALIAS');
  }
  const bounded = (buffer, size, label, usage = GPU_BUFFER_USAGE.STORAGE, offset = 0) => {
    requireBuffer(device, buffer, label);
    if (!Number.isSafeInteger(size) || size < 4 || size > 0xffff_fffc
        || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(offset + size)
        || !Number.isSafeInteger(buffer.size) || offset + size > buffer.size
        || (buffer.usage & usage) !== usage
        || size > (usage === GPU_BUFFER_USAGE.UNIFORM
          ? (device.limits?.maxUniformBufferBindingSize ?? 65536)
          : (device.limits?.maxStorageBufferBindingSize ?? 128 * 1024 * 1024))) {
      throw placementError(`exact capture ${label} does not fit its owned range`, 'EXACT_CAPTURE_CAPACITY');
    }
    return { buffer, offset, size };
  };
  const radixIndices = arenaRecord.captureRadix.allocationEntries()
    .filter(entry => /^radix-sorted-indices-[ab]$/.test(entry.role));
  if (radixIndices.length !== 2 || radixIndices[0].buffer === radixIndices[1].buffer) {
    throw placementError('exact capture lost its original radix index pair', 'EXACT_CAPTURE_IDENTITY');
  }
  for (const entry of radixIndices) bounded(entry.buffer, e * 4, entry.role);
  const q = bounded(quantities, config.capture.quantityWordLength * 4, 'persistent current quantities');
  const stateRange = bounded(state, p * 32, 'original current physical positions');
  const keys = bounded(buffers.captureKeys, e * 4, 'original capture keys');
  const geometry = bounded(buffers.captureValues, e * 24 * 4, 'original routed geometry');
  const count = bounded(buffers.compactCount, 8, 'original compact count and error');
  const receiptRange = bounded(receipt, SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES, 'original receipt');
  const captureRanges = four.slice(0, 2).map((buffer, i) => bounded(buffer, config.capture.byteLength, `capture ping-pong ${i}`));
  const merged = bounded(four[2], config.merge.mergedByteLength, 'merged quantity scratch');
  const map = bounded(four[3], config.merge.mapByteLength, 'receiver tail and projected position map');
  const params = bounded(buffers.placementParams, 64, 'original placement params', GPU_BUFFER_USAGE.UNIFORM);
  const eventRange = bounded(buffers.denseEmission, e * 128, 'original candidate event plane');
  const publishedEvents = bounded(compact.productEventBuffer, e * 128, 'original compact events');
  const control = bounded(buffers.control, 32, 'original control');
  const decisions = bounded(buffers.decisions, e * 16, 'original classifier decisions');
  const eventPlan = bounded(buffers.eventPlan, e * SPH_REACTION_PRODUCT_PLACEMENT_EVENT_PLAN_ROWS * 16, 'original event plan');
  const frozenS = bounded(frozenState, p * 32, 'frozen placement state');
  const frozenM = bounded(frozenMechanics, p * 128, 'frozen placement mechanics');
  const reduction = arenaRecord.reductionOffsets.capture;
  const offsets = [reduction.initOffset, ...reduction.levelOffsets];
  if (reduction.levelOffsets.length !== arena.captureReductionLevelCount
      || arena.captureReductionLevelCount !== reductionLevelCount(e)) {
    throw placementError('exact capture requires every original Hillis-Steele level', 'EXACT_CAPTURE_IDENTITY');
  }
  const uniformAlignment = device.limits?.minUniformBufferOffsetAlignment ?? 256;
  const reductions = offsets.map(offset => {
    if (offset % uniformAlignment !== 0) throw placementError('exact capture reduction offset is not aligned', 'EXACT_CAPTURE_CAPACITY');
    return bounded(buffers.reductionParams, 16, 'original reduction params', GPU_BUFFER_USAGE.UNIFORM, offset);
  });
  if ((buffers.placementParams.usage & GPU_BUFFER_USAGE.COPY_DST) === 0
      || (buffers.denseEmission.usage & GPU_BUFFER_USAGE.COPY_DST) === 0
      || (compact.productEventBuffer.usage & GPU_BUFFER_USAGE.COPY_SRC) === 0) {
    throw placementError('exact capture original copy/parameter usage is incomplete', 'EXACT_CAPTURE_CAPACITY');
  }
  const { eventWorkgroups } = planSphReactionProductPlacementDispatchWorkgroups({ device,
    eventCount: e, particleCount: p, productTermCount: arena.productTermCapacity });
  const descriptors = sphReactionProductPlacementExactCapturePipelineDescriptors(config.format, config.quantityLayout);
  const original = sphReactionProductPlacementSegmentedPipelineDescriptors();
  const pipelines = Object.fromEntries(['initialize', 'reduce', 'mergeInitialize', 'merge']
    .map(key => [key, explicitPlacementPipeline(device, descriptors[key])]));
  const preflight = explicitPlacementPipeline(device, original.preflight);
  const plan = explicitPlacementPipeline(device, original.plan);
  const group = (pipeline, label, resources) => placementBindGroup(device, pipeline, label,
    resources.map(([binding, resource]) => ({ binding, resource })));
  const preflightGroup = group(preflight, 'exact-capture-original-preflight', [[0, count], [1, control], [2, params], [3, receiptRange]]);
  const planGroup = group(plan, 'exact-capture-original-plan', [[0, eventRange], [1, frozenS], [2, frozenM], [4, decisions],
    [5, keys], [6, geometry], [7, eventPlan], [8, control], [9, params]]);
  const validate = () => {
    if (requireLivePlacementAuthority(authority, { device, operation: 'exact capture recording' }) !== owner
        || requireSegmentedPlacementArenaLease(arenaLease, { device, authority }) !== arenaRecord
        || owner.exactCompactionEncoding !== compact || arenaRecord.exactCompactionEncoding !== compact
        || exactCaptureConfigurationForAuthority(authority, device).signature !== config.signature) {
      throw placementError('exact capture lost its original transaction identities', 'EXACT_CAPTURE_IDENTITY');
    }
    owner.exactQuantityContext.validate();
  };
  validate();
  owner.exactQuantityContext.read.markDerivedBuffers(four); validate();
  const preparation = { encoder, authority, arenaLease, sourceQuantityBuffer: quantities,
    sourceQuantityLayout: config.quantityLayout, sourceStateBuffer: state, receiptBuffer: receipt,
    captureKeysBuffer: buffers.captureKeys, captureGeometryBuffer: buffers.captureValues,
    captureRadixExecution: null, status: 'recording', physicalPublicationAdmitted: false };
  owner.exactCapturePreparation = preparation; arenaRecord.exactCapturePreparation = preparation;
  const dimensions = [0, 1, 2].map(axis => {
    const value = Number(boxDimsM?.[axis]); return Number.isFinite(value) && value > 0 ? value : 0;
  });
  const capturedPlacementParams = placementParamsData({ particleCount: p, eventCount: e,
    eventStrideVec4: 8, productTermCount: arena.productTermCapacity, boxDimsM: dimensions,
    generationId: authority.generationId, supportProfileId: authority.supportProfileId });
  preparation.placementParamsWords = Object.freeze(Array.from(new Uint32Array(capturedPlacementParams)));
  device.queue.writeBuffer(buffers.placementParams, 0, capturedPlacementParams);
  validate();
  encoder.copyBufferToBuffer(compact.productEventBuffer, 0, buffers.denseEmission, 0, e * 128);
  const metadata = { generationId: authority.generationId, particleCount: p, eventCapacity: e,
    productTermCount: arena.productTermCapacity };
  let explicitDispatchCount = 0;
  const encodeOriginal = (pipeline, bindGroup, workgroupCount, label) => {
    validate(); encodePlacementPass({ encoder, pipeline: pipeline.pipeline, bindGroup, workgroupCount,
      label, producerId: `sph-reaction-summary:product-event-placement:${label}`, gpuTimestampRecorder, metadata });
    explicitDispatchCount++;
  };
  encodeOriginal(preflight, preflightGroup, 1, 'preflight');
  encodeOriginal(plan, planGroup, eventWorkgroups, 'plan');
  // Actual original classifier/envelope/spare evidence is consumed by the
  // original preflight above. No host success counter or fake decision is set.
  validate();
  const radixSpan = placementTimestampBegin(gpuTimestampRecorder, encoder,
    { producerId: 'sph-reaction-summary:product-event-placement:capture-radix', stage: 'capture-radix',
      spanClass: 'same-grouped-production-compute-pass', ...metadata });
  const captureRadixExecution = arenaRecord.captureRadix.encodeSort(encoder, {
    keyBuffer: buffers.captureKeys, elementCount: e, keyWordCount: 1, keyStrideWords: 1,
    significantDigitRows: boundedSentinelRadixDigitRows(p, 1),
    generationId: authority.generationId });
  preparation.captureRadixExecution = captureRadixExecution;
  placementTimestampEnd(gpuTimestampRecorder, encoder, radixSpan);
  const sorted = bounded(captureRadixExecution.sortedIndicesBuffer, e * 4, 'original capture sorted indices');
  if (four.includes(sorted.buffer) || !radixIndices.some(entry => entry.buffer === sorted.buffer)) {
    throw placementError('exact capture sort is outside its original radix arena', 'EXACT_CAPTURE_IDENTITY');
  }
  const encodeExact = (pipeline, bindGroup, workgroups, label) => {
    validate();
    const span = placementTimestampBegin(gpuTimestampRecorder, encoder,
      { producerId: `sph-reaction-summary:product-event-placement:${label}`, stage: label,
        spanClass: 'same-production-command-encoder-profiled-pass', ...metadata });
    const pass = encoder.beginComputePass({ label }); pass.setPipeline(pipeline.pipeline); pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(workgroups.x, workgroups.y, workgroups.z); pass.end();
    placementTimestampEnd(gpuTimestampRecorder, encoder, span); explicitDispatchCount++;
  };
  const reduceGroup = (pipeline, input, output, paramsRange, label) => group(pipeline, label,
    [[0, keys], [1, sorted], [2, q], [3, geometry], [4, count], [5, input], [6, output], [7, receiptRange], [8, paramsRange]]);
  encodeExact(pipelines.initialize, reduceGroup(pipelines.initialize, captureRanges[1], captureRanges[0], reductions[0],
    'exact-capture-initialize'), config.dispatch, 'exact-capture-initialize');
  let input = captureRanges[0], output = captureRanges[1];
  reduction.levelOffsets.forEach((offset, level) => {
    encodeExact(pipelines.reduce, reduceGroup(pipelines.reduce, input, output, reductions[level + 1],
      `exact-capture-reduce-${level}`), config.dispatch, `exact-capture-reduce-${level}`);
    [input, output] = [output, input];
  });
  const mergeResources = [[0, keys], [1, sorted], [2, input], [3, q], [4, stateRange], [5, merged], [6, map], [7, receiptRange]];
  encodeExact(pipelines.mergeInitialize, group(pipelines.mergeInitialize, 'exact-capture-merge-initialize', mergeResources),
    config.initializeMergeDispatch, 'exact-capture-merge-initialize');
  encodeExact(pipelines.merge, group(pipelines.merge, 'exact-capture-merge-tails', mergeResources),
    config.dispatch, 'exact-capture-merge-tails');
  validate();
  Object.assign(preparation, { status: 'scratch-prepared', captureSortedBuffer: sorted.buffer,
    captureReducedValuesBuffer: input.buffer, mergedQuantityBuffer: merged.buffer, receiverMapBuffer: map.buffer,
    captureLayout: config.capture, mergeLayout: config.merge, explicitDispatchCount,
    encodedDispatchCount: explicitDispatchCount + captureRadixExecution.encodedDispatchCount,
    reductionOffsets: Object.freeze([...offsets]), dispatch: config.dispatch, initializeMergeDispatch: config.initializeMergeDispatch });
  return Object.freeze(preparation);
}

// PRIVATE: layout/data derived from the same held reaction source. No caller
// table, count, scratch, success status, or source registrar is accepted.
function exactPhysicalConfigurationForAuthority(authority, device) {
  const owner = requireLivePlacementAuthority(authority, { device, operation: 'exact receiver configuration' });
  const context = owner.exactQuantityContext;
  if (!context) return null;
  const bindings = context.validate(), original = context.original.source;
  const mechanicsTable = original.source.mechanicsMaterialTable;
  // Older/fused captures with no table provenance remain usable by the old
  // numerical prefix, but cannot enter this physical preparation helper.
  if (!mechanicsTable) return null;
  const reactionTable = original.reactionTable, thermalMaterialTable = original.thermalMaterialTable;
  const caloricMetadata = encodeSphExactPlacementCaloricMetadata(original.compiled, { reactionTable, thermalMaterialTable });
  const format = bindings.placedDestinationQuantityFormat, quantityLayout = bindings.placedDestinationQuantityLayout;
  const capture = sphExactPlacementCaptureLayout(format, quantityLayout);
  let maxIntervals = 0;
  for (let i = 0; i < caloricMetadata.materialCount; i++) maxIntervals = Math.max(maxIntervals, caloricMetadata.words[8 + i * 8 + 5]);
  const caloric = sphExactPlacementReceiverCaloricLayout(format, quantityLayout,
    { receiverCapacity: authority.productEventCapacity, maxIntervals });
  const physical = sphExactPlacementPhysicalApplyLayout(format, quantityLayout, caloric, capture);
  const graph = reactionTable.combinedRecords, mechanics = mechanicsTable.records;
  if (!(graph instanceof Float32Array) || !(mechanics instanceof Float32Array)
      || graph.length % 4 || mechanics.length % 4 || graph.byteLength === 0 || mechanics.byteLength === 0) {
    throw placementError('original caloric/mechanics tables are incomplete', 'EXACT_PHYSICAL_IDENTITY');
  }
  const gasConstitutiveOffset = assertSphMechanicsGasLayout(mechanicsTable);
  const graphRecordCount = graph.length / 4, mechanicsRecordCount = mechanics.length / 4;
  assertSphExactPlacementPhysicalApplyDeviceLimits(physical, device.limits, { graphRecordCount, mechanicsRecordCount });
  if (!Number.isSafeInteger(device.limits?.maxUniformBuffersPerShaderStage) || device.limits.maxUniformBuffersPerShaderStage < 1) {
    throw placementError('exact receiver requires the actual uniform-binding capacity', 'EXACT_PHYSICAL_CAPACITY');
  }
  const intervalDispatchCount = caloric.receiverCapacity * caloric.maxIntervals;
  const limit = device.limits.maxComputeWorkgroupsPerDimension;
  // The reviewed caloric kernel uses id.x; never silently truncate or send a
  // second dimension that it would ignore.
  if (!Number.isSafeInteger(limit) || limit < 1 || intervalDispatchCount > limit) {
    throw placementError('complete original caloric interval dispatch exceeds device capacity', 'EXACT_PHYSICAL_CAPACITY');
  }
  const sizes = Object.freeze({
    exactPhysicalPacked: physical.packedPhysicalWordLength * 4,
    exactCaloricMetadata: caloricMetadata.words.byteLength,
    exactCaloricGraph: graph.byteLength,
    exactMechanicsRecords: mechanics.byteLength,
    exactCaloricReceiver: caloric.receiverWordLength * 4,
    exactCaloricIntervals: caloric.intervalWordLength * 4,
    exactCaloricParams: caloric.uniformBytes,
    exactPhysicalCandidate: physical.candidateWordLength * 4,
    exactPhysicalEvidence: physical.evidenceWordLength * 4,
    exactPhysicalParams: physical.uniformBytes
  });
  for (const [key, bytes] of Object.entries(sizes)) {
    const uniform = key.endsWith('Params');
    if (!Number.isSafeInteger(bytes) || bytes < 4 || bytes > 0xffff_fffc || bytes > device.limits.maxBufferSize
        || bytes > (uniform ? device.limits.maxUniformBufferBindingSize : device.limits.maxStorageBufferBindingSize)) {
      throw placementError(`${key} exceeds original device capacity`, 'EXACT_PHYSICAL_CAPACITY');
    }
  }
  const signature = JSON.stringify([format.wordCount, format.quantumExponent, quantityLayout.recordWords,
    quantityLayout.scalar.wordCount, quantityLayout.currentRowOffset, authority.particleCount,
    authority.productEventCapacity, maxIntervals, graphRecordCount, mechanicsRecordCount,
    mechanicsTable.phaseRecordCount, gasConstitutiveOffset, sizes]);
  context.validate();
  return Object.freeze({ format, quantityLayout, capture, caloric, physical, caloricMetadata,
    graph, mechanics, reactionTable, thermalMaterialTable, mechanicsTable,
    graphRecordCount, mechanicsRecordCount, gasConstitutiveOffset,
    phaseRecordCount: mechanicsTable.phaseRecordCount, intervalDispatchCount, sizes, signature,
    physicalDispatches: planSphExactPlacementPhysicalApplyDispatches(physical, device.limits) });
}

// Pure numeric descriptor factory for cold prewarming. It cannot admit a
// source, allocate an owner, record commands, or mint a publication capability.
export function sphReactionProductPlacementExactPhysicalPipelineDescriptors(format, quantityLayout, { maxIntervals } = {}) {
  const capture = sphExactPlacementCaptureLayout(format, quantityLayout);
  const caloric = sphExactPlacementReceiverCaloricLayout(format, quantityLayout,
    { receiverCapacity: quantityLayout.eventCapacity, maxIntervals });
  const physical = sphExactPlacementPhysicalApplyLayout(format, quantityLayout, caloric, capture);
  return exactPhysicalPipelineDescriptors({ format, quantityLayout, caloric, capture, physical });
}

function exactPhysicalPipelineDescriptors(config) {
  const { format, quantityLayout: q, caloric, capture, physical: p } = config;
  const key = [format.wordCount, format.quantumExponent, q.scalar.wordCount, q.recordWords,
    q.currentRowOffset, p.particleCount, p.eventCapacity, caloric.maxIntervals,
    caloric.receiverRecordWords, caloric.intervalRecordWords, p.evidenceRecordWords].join('-');
  const descriptor = (stage, code, entryPoint, types) => Object.freeze({
    label: `ulg-exact-placement-${stage}`, cacheKey: `ulg-exact-placement-private-v8-${stage}-${key}`,
    code, entryPoint, bindings: types.map((type, binding) => computeBufferBinding(binding, type))
  });
  const packedCode = `
@group(0) @binding(0) var<storage,read> state:array<u32>;
@group(0) @binding(1) var<storage,read> thermo:array<u32>;
@group(0) @binding(2) var<storage,read> mechanics:array<u32>;
@group(0) @binding(3) var<storage,read_write> packed:array<u32>;
@compute @workgroup_size(1)
fn pack_original_receiver_physical(@builtin(global_invocation_id) id:vec3<u32>, @builtin(num_workgroups) groups:vec3<u32>) {
  let row=id.x+id.y*groups.x; if(row>=${p.particleCount}u){return;}
  for(var i=0u;i<8u;i++){packed[row*52u+i]=state[row*8u+i];}
  for(var i=0u;i<12u;i++){packed[row*52u+8u+i]=thermo[row*12u+i];}
  for(var i=0u;i<32u;i++){packed[row*52u+20u+i]=mechanics[row*32u+i];}
}`;
  const ro='read-only-storage',rw='storage',u='uniform';
  const caloricCode = createSphExactPlacementReceiverCaloricWgsl(format,q,caloric);
  const prepareCode = createSphExactPlacementPhysicalApplyWgsl(format,q,caloric,capture,{stage:'prepare',currentRowOffset:q.currentRowOffset});
  const applyCode = createSphExactPlacementPhysicalApplyWgsl(format,q,caloric,capture,{stage:'apply',currentRowOffset:q.currentRowOffset});
  return Object.freeze({
    pack:descriptor('pack-current',packedCode,'pack_original_receiver_physical',[ro,ro,ro,rw]),
    caloricPrepare:descriptor('caloric-prepare',caloricCode,'prepare_exact_receiver_caloric',[ro,ro,ro,ro,ro,rw,rw,u]),
    ...Object.fromEntries(SPH_EXACT_RECEIVER_PREPARATION_STAGES.map(({key,label,entryPoint}) =>
      [key,descriptor(label,caloricCode,entryPoint,[ro,ro,ro,ro,ro,rw,rw,u])])),
    caloricInitialize:descriptor('caloric-initialize',caloricCode,'initialize_exact_receiver_caloric_intervals',[ro,ro,ro,ro,ro,rw,rw,u]),
    caloricRefine:descriptor('caloric-refine',caloricCode,'refine_exact_receiver_caloric_intervals',[ro,ro,ro,ro,ro,rw,rw,u]),
    caloricSelect:descriptor('caloric-select',caloricCode,'select_exact_receiver_caloric',[ro,ro,ro,ro,ro,rw,rw,u]),
    caloricViewEnergy:descriptor('caloric-view-energy',caloricCode,'prepare_exact_receiver_caloric_view_energy',[ro,ro,ro,ro,ro,rw,rw,u]),
    caloricFinalize:descriptor('caloric-finalize',caloricCode,'finalize_exact_receiver_caloric',[ro,ro,ro,ro,ro,rw,rw,u]),
    physicalInitialize:descriptor('physical-initialize',prepareCode,'initialize_exact_receiver_physical_apply',[ro,ro,ro,ro,ro,ro,ro,ro,ro,rw,rw,rw,u]),
    ...Object.fromEntries(SPH_EXACT_PHYSICAL_PREPARATION_STAGES.map(({key,label,entryPoint}) =>
      [key,descriptor(label,prepareCode,entryPoint,[ro,ro,ro,ro,ro,ro,ro,ro,ro,rw,rw,rw,u])])),
    physicalApply:descriptor('physical-raw-apply',applyCode,'apply_exact_receiver_physical_segment_tails',[ro,ro,rw,rw,rw,rw,rw,rw,rw])
  });
}

/** Compile the exact family's arithmetic before recording its transaction.
 * Keep large integer compilation off the synchronous recording path.
 * Every descriptor here is also consumed by the encoder; this
 * allocates no destination, records no command, and grants no publication.
 */
export async function prewarmSphReactionProductPlacementExactWebGpu({ device, authority } = {}) {
  const owner = requireLivePlacementAuthority(authority, { device, operation: 'exact placement prewarm' });
  if (!owner.exactQuantityContext) return Object.freeze({ pipelineCount: 0, prewarmedCount: 0 });
  const capture = exactCaptureConfigurationForAuthority(authority, device);
  const physical = exactPhysicalConfigurationForAuthority(authority, device);
  const chemistry = exactChemistryConfigurationForAuthority(authority, device);
  const events = exactEventConfigurationForAuthority(authority, device);
  if (!capture || !physical || !chemistry || !events) {
    throw placementError('exact placement prewarm requires complete original material and quantity inputs', 'EXACT_PHYSICAL_IDENTITY');
  }
  const descriptors = [
    ...Object.values(sphReactionProductPlacementExactCapturePipelineDescriptors(capture.format, capture.quantityLayout)),
    ...Object.values(exactPhysicalPipelineDescriptors(physical)),
    ...Object.values(sphExactPlacementEventPipelineDescriptors(events.format, events.layout)),
    ...sphExactReactionChemistryBudgetPipelineDescriptors(chemistry.format, chemistry.layout)
  ].filter(value => value?.entryPoint);
  let prewarmedCount = 0;
  for (const descriptor of descriptors) {
    requireLivePlacementAuthority(authority, { device, operation: 'exact placement prewarm' });
    const result = await prewarmCachedExplicitComputePipeline(device, descriptor);
    if (!result.pipeline) throw result.error ?? placementError(`exact placement pipeline failed: ${descriptor.entryPoint}`, 'EXACT_PIPELINE');
    requireLivePlacementAuthority(authority, { device, operation: 'exact placement prewarm' });
    prewarmedCount += Number(result.prewarmed);
  }
  return Object.freeze({ pipelineCount: descriptors.length, prewarmedCount });
}

/** PRIVATE original-owner continuation. It records into the SAME encoder and
 * receipt. GPU failures stay in original receipt flags; this returns command
 * metadata only, never a success/readiness claim or publication authority. */
function encodeExactPlacementCaloricPhysicalPreparation({device,encoder,authority,arenaLease,
  boxDimsM=[0,0,0],gpuTimestampRecorder=null}={}) {
  const owner=requireLivePlacementAuthority(authority,{device,operation:'exact caloric/physical preparation'});
  const arenaRecord=requireSegmentedPlacementArenaLease(arenaLease,{device,authority});
  const capture=owner.exactCapturePreparation,arena=arenaLease.arena,b=arena.buffers;
  if(!capture || capture!==arenaRecord.exactCapturePreparation || capture.encoder!==encoder
      || capture.authority!==authority || capture.arenaLease!==arenaLease || capture.status!=='scratch-prepared') {
    throw placementError('exact physical preparation requires the original completed capture prefix','EXACT_PHYSICAL_IDENTITY');
  }
  if(owner.exactPhysicalPreparation || arenaRecord.exactPhysicalPreparation || arenaRecord.segmentedEncoding
      || arenaRecord.encodedPlacement || arenaRecord.activeEncoding) throw placementError('exact physical preparation is one-shot','EXACT_PHYSICAL_REPLAY');
  const config=exactPhysicalConfigurationForAuthority(authority,device);
  if(!config || arena.exactPhysicalSignature!==config.signature) throw placementError('original mechanics provenance or matching physical arena unavailable','EXACT_PHYSICAL_IDENTITY');
  const p=authority.particleCount,e=authority.productEventCapacity,l=config.physical;
  const current=owner.bindings.placedDestinationQuantityBuffer;
  const state=owner.bindings.placedDestinationStateBuffer,thermo=owner.bindings.placedDestinationThermoBuffer;
  const mechanics=owner.bindings.placedDestinationMechanicsBuffer,receipt=owner.bindings.completionReceiptBuffer;
  if(capture.sourceQuantityBuffer!==current || capture.sourceStateBuffer!==state
      || capture.receiptBuffer!==receipt || capture.mergedQuantityBuffer!==b.exactCaptureMerged
      || capture.receiverMapBuffer!==b.exactCaptureMap) throw placementError('exact physical capture tuple changed','EXACT_PHYSICAL_IDENTITY');
  const scratch=Object.keys(config.sizes).map(key=>b[key]);
  const protectedBuffers=[...Object.values(owner.bindings),...Object.values(owner.exactQuantityContext.physical),
    owner.exactQuantityContext.quantities.outputBuffer,...Object.values(b).filter(buffer=>!scratch.includes(buffer)),
    ...arenaRecord.captureRadix.allocationEntries().map(entry=>entry.buffer),
    ...arenaRecord.directRadix.allocationEntries().map(entry=>entry.buffer),
    ...arenaRecord.summaryRadix.allocationEntries().map(entry=>entry.buffer)];
  if(new Set(scratch).size!==scratch.length || scratch.some(buffer=>protectedBuffers.includes(buffer))
      || new Set([state,thermo,mechanics,current,receipt,b.summaryValues]).size!==6) {
    throw placementError('exact physical scratch/output aliases an original role','SOURCE_DESTINATION_ALIAS');
  }
  const range=(buffer,size,label,usage=GPU_BUFFER_USAGE.STORAGE,offset=0)=>{
    requireBuffer(device,buffer,label);
    if(!Number.isSafeInteger(size)||size<4||size%4||!Number.isSafeInteger(offset)||offset<0||offset%4
        ||!Number.isSafeInteger(buffer.size)||!Number.isSafeInteger(offset+size)||offset+size>buffer.size
        ||(buffer.usage&usage)!==usage||size>device.limits.maxBufferSize
        ||size>(usage===GPU_BUFFER_USAGE.UNIFORM?device.limits.maxUniformBufferBindingSize:device.limits.maxStorageBufferBindingSize)) {
      throw placementError(`${label} does not fit original owned range`,'EXACT_PHYSICAL_CAPACITY');
    }
    return {buffer,offset,size};
  };
  const r=Object.fromEntries(Object.entries(config.sizes).map(([key,size])=>[key,range(b[key],size,key,
    key.endsWith('Params')?GPU_BUFFER_USAGE.UNIFORM:GPU_BUFFER_USAGE.STORAGE)]));
  const s=range(state,p*32,'original current state'),t=range(thermo,p*48,'original current thermo'),m=range(mechanics,p*128,'original current mechanics');
  const q=range(current,l.currentWordLength*4,'original persistent current quantities');
  const merged=range(capture.mergedQuantityBuffer,l.outputQuantityWordLength*4,'original merged exact quantities');
  const map=range(capture.receiverMapBuffer,l.mapWordLength*4,'original receiver map');
  const exactReduced=range(capture.captureReducedValuesBuffer,l.captureWordLength*4,'original exact reduced capture');
  const receiptRange=range(receipt,SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES,'original receipt');
  const summary=range(b.summaryValues,e*9*16,'original summary rows');
  const keys=range(b.captureKeys,e*4,'original capture keys'),sorted=range(capture.captureSortedBuffer,e*4,'original capture sorted indices');
  const geometry=range(b.captureValues,e*6*16,'original capture geometry');
  const projected=[range(b.captureReduceA,e*6*16,'original projected capture A'),range(b.captureReduceB,e*6*16,'original projected capture B')];
  const offsets=capture.reductionOffsets;
  if(offsets.length!==1+arena.captureReductionLevelCount || offsets.length!==1+reductionLevelCount(e)) throw placementError('exact physical requires full original projected reduction','EXACT_PHYSICAL_IDENTITY');
  const alignment=device.limits.minUniformBufferOffsetAlignment;
  if(!Number.isSafeInteger(alignment)||alignment<1) throw placementError('original uniform alignment unavailable','EXACT_PHYSICAL_CAPACITY');
  const reductions=offsets.map(offset=>{
    if(offset%alignment)throw placementError('original reduction uniform misalignment','EXACT_PHYSICAL_CAPACITY');
    return range(b.reductionParams,16,'original reduction parameter',GPU_BUFFER_USAGE.UNIFORM,offset);
  });
  const writeKeys=['exactCaloricMetadata','exactCaloricGraph','exactMechanicsRecords','exactCaloricParams','exactPhysicalParams'];
  for(const key of [...writeKeys,'exactPhysicalCandidate','exactPhysicalEvidence']) {
    if((b[key].usage&GPU_BUFFER_USAGE.COPY_DST)===0)throw placementError('original receiver upload/clear usage unavailable','EXACT_PHYSICAL_CAPACITY');
  }
  if(!Object.isFrozen(capture.placementParamsWords)||capture.placementParamsWords.length!==16) {
    throw placementError('exact physical preparation lost original immutable placement parameters','EXACT_PHYSICAL_IDENTITY');
  }
  const placementWords=Uint32Array.from(capture.placementParamsWords);
  const caloricWords=encodeSphExactPlacementReceiverCaloricParams(config.caloric,{receiverCount:e,quantityCount:p,
    physicalCount:p,graphRecordCount:config.graphRecordCount,caloricMetadata:config.caloricMetadata});
  const physicalWords=encodeSphExactPlacementPhysicalApplyParams(l,placementWords,{phaseRecordCount:config.phaseRecordCount,
    gasConstitutiveOffset:config.gasConstitutiveOffset,graphRecordCount:config.graphRecordCount});
  const graphWords=new Uint32Array(config.graph.buffer,config.graph.byteOffset,config.graph.length).slice();
  const mechanicsWords=new Uint32Array(config.mechanics.buffer,config.mechanics.byteOffset,config.mechanics.length).slice();
  const descriptors=exactPhysicalPipelineDescriptors(config);
  const pipelines=Object.fromEntries(Object.entries(descriptors).map(([key,value])=>[key,explicitPlacementPipeline(device,value)]));
  const legacy=sphReactionProductPlacementSegmentedPipelineDescriptors();
  const projectedInitialize=explicitPlacementPipeline(device,legacy.captureInitialize),projectedReduce=explicitPlacementPipeline(device,legacy.captureReduce);
  const group=(pipeline,label,resources)=>placementBindGroup(device,pipeline,label,resources.map((resource,binding)=>({binding,resource})));
  const groups={pack:group(pipelines.pack,'exact-original-physical-pack',[s,t,m,r.exactPhysicalPacked])};
  const caloricResources=[merged,map,r.exactPhysicalPacked,r.exactCaloricMetadata,r.exactCaloricGraph,r.exactCaloricReceiver,r.exactCaloricIntervals,r.exactCaloricParams];
  for(const key of ['caloricPrepare',...SPH_EXACT_RECEIVER_PREPARATION_STAGES.map(stage=>stage.key),'caloricInitialize','caloricRefine','caloricSelect','caloricViewEnergy','caloricFinalize'])groups[key]=group(pipelines[key],key,caloricResources);
  const projectedGroups=[];let input=projected[0],output=projected[1];
  projectedGroups.push([projectedInitialize,group(projectedInitialize,'original-projected-capture-init',[keys,sorted,geometry,output,input,reductions[0]])]);
  for(let level=1;level<reductions.length;level++){
    projectedGroups.push([projectedReduce,group(projectedReduce,`original-projected-capture-${level}`,[keys,sorted,geometry,input,output,reductions[level]])]);
    [input,output]=[output,input];
  }
  const prepResources=[r.exactPhysicalPacked,q,merged,map,r.exactCaloricReceiver,r.exactMechanicsRecords,r.exactCaloricGraph,
    exactReduced,input,r.exactPhysicalCandidate,receiptRange,r.exactPhysicalEvidence,r.exactPhysicalParams];
  for(const key of ['physicalInitialize',...SPH_EXACT_PHYSICAL_PREPARATION_STAGES.map(stage=>stage.key)])groups[key]=group(pipelines[key],key,prepResources);
  groups.physicalApply=group(pipelines.physicalApply,'physicalApply',[r.exactPhysicalCandidate,merged,r.exactPhysicalEvidence,s,t,m,q,summary,receiptRange]);
  const validate=()=>{
    if(requireLivePlacementAuthority(authority,{device,operation:'exact caloric/physical recording'})!==owner
        || requireSegmentedPlacementArenaLease(arenaLease,{device,authority})!==arenaRecord
        || owner.exactCapturePreparation!==capture || arenaRecord.exactCapturePreparation!==capture
        || exactPhysicalConfigurationForAuthority(authority,device)?.signature!==config.signature) {
      throw placementError('exact receiver lost original owner/source/layout','EXACT_PHYSICAL_IDENTITY');
    }
    owner.exactQuantityContext.validate();
  };
  validate();owner.exactQuantityContext.read.markDerivedBuffers(scratch);validate();
  const preparation={encoder,authority,arenaLease,capturePreparation:capture,sourceQuantityBuffer:current,
    sourceStateBuffer:state,sourceThermoBuffer:thermo,sourceMechanicsBuffer:mechanics,receiptBuffer:receipt,
    caloricLayout:config.caloric,physicalLayout:l,caloricBuffer:b.exactCaloricReceiver,
    intervalBuffer:b.exactCaloricIntervals,physicalCandidateBuffer:b.exactPhysicalCandidate,
    physicalEvidenceBuffer:b.exactPhysicalEvidence,packedPhysicalBuffer:b.exactPhysicalPacked,
    projectedCaptureReducedValuesBuffer:input.buffer,status:'recording',physicalPublicationAdmitted:false,quantityAdmission:false,
    validate() {
      validate();
      if(owner.exactPhysicalPreparation!==preparation || arenaRecord.exactPhysicalPreparation!==preparation
          || preparation.status!=='commands-recorded') throw placementError('exact physical preparation lost original completed recording','EXACT_PHYSICAL_IDENTITY');
      return preparation;
    }};
  owner.exactPhysicalPreparation=preparation;arenaRecord.exactPhysicalPreparation=preparation;
  // No later write mutates these owned parameter/table slots in this one-shot
  // encoder. Warm reuse requires the original arena's confirmed release fence.
  for(const [key,words] of [['exactCaloricMetadata',config.caloricMetadata.words],['exactCaloricGraph',graphWords],
    ['exactMechanicsRecords',mechanicsWords],['exactCaloricParams',caloricWords],['exactPhysicalParams',physicalWords]]) {
    validate();device.queue.writeBuffer(b[key],0,words);
  }
  validate();encoder.clearBuffer(b.exactPhysicalCandidate,0,config.sizes.exactPhysicalCandidate);
  validate();encoder.clearBuffer(b.exactPhysicalEvidence,0,config.sizes.exactPhysicalEvidence);
  let explicitDispatchCount=0;
  const dispatch=(pipeline,bindGroup,groupsCount,label)=>{
    validate();const span=placementTimestampBegin(gpuTimestampRecorder,encoder,{producerId:`sph-reaction-summary:product-event-placement:${label}`,
      stage:label,spanClass:'same-production-command-encoder-profiled-pass',generationId:authority.generationId,particleCount:p,eventCapacity:e});
    const pass=encoder.beginComputePass({label});pass.setPipeline(pipeline.pipeline);pass.setBindGroup(0,bindGroup);
    pass.dispatchWorkgroups(...groupsCount);pass.end();placementTimestampEnd(gpuTimestampRecorder,encoder,span);explicitDispatchCount++;
  };
  const particleGroups=config.physicalDispatches[0].groups,eventGroups=config.physicalDispatches[1].groups;
  const oldEventGroups=planSphReactionProductPlacementDispatchWorkgroups({device,eventCount:e,particleCount:p,productTermCount:arena.productTermCapacity}).eventWorkgroups;
  projectedGroups.forEach(([pipeline,bindGroup],i)=>dispatch(pipeline,bindGroup,[oldEventGroups,1,1],`exact-original-projected-reduce-${i}`));
  dispatch(pipelines.pack,groups.pack,particleGroups,'exact-pack-original-current');
  dispatch(pipelines.caloricPrepare,groups.caloricPrepare,[e,1,1],'exact-caloric-prepare');
  for(const {key,label} of SPH_EXACT_RECEIVER_PREPARATION_STAGES)dispatch(pipelines[key],groups[key],[e,1,1],`exact-${label}`);
  dispatch(pipelines.caloricInitialize,groups.caloricInitialize,[config.intervalDispatchCount,1,1],'exact-caloric-interval-init');
  for(let i=0;i<config.caloric.refinementDispatchCount;i++)dispatch(pipelines.caloricRefine,groups.caloricRefine,[config.intervalDispatchCount,1,1],`exact-caloric-refine-${i}`);
  dispatch(pipelines.caloricSelect,groups.caloricSelect,[e,1,1],'exact-caloric-select');
  dispatch(pipelines.caloricViewEnergy,groups.caloricViewEnergy,[e,1,1],'exact-caloric-view-energy');
  dispatch(pipelines.caloricFinalize,groups.caloricFinalize,[e,1,1],'exact-caloric-finalize');
  dispatch(pipelines.physicalInitialize,groups.physicalInitialize,particleGroups,'exact-physical-initialize');
  for(const {key,label} of SPH_EXACT_PHYSICAL_PREPARATION_STAGES)dispatch(pipelines[key],groups[key],eventGroups,`exact-${label}`);
  dispatch(pipelines.physicalApply,groups.physicalApply,particleGroups,'exact-physical-raw-apply');
  validate();Object.assign(preparation,{status:'commands-recorded',explicitDispatchCount,encodedDispatchCount:explicitDispatchCount});
  return Object.freeze(preparation);
}

/** Resolve the one exact source already held by the ORIGINAL placement family.
 * A descriptor returned here is a view, not an admission capability or registrar.
 * The family owns the read and is the only party that may release it. */
export function resolveSphReactionProductPlacementExactCompactionSource(authority, { device } = {}) {
  const record = requireLivePlacementAuthority(authority, {
    device, operation: 'exact placement compaction source resolution'
  });
  const family = record.placementSourceFamily;
  const read = resolveSchroederSpatialReactionPlacementExactSource(family, { device });
  if (!read) return null;
  const original = read.validate();
  const physical = original.result.physicalOutput;
  const selected = original.source.result;
  const n = selected.format.wordCount;
  const count = physical.denseEventCount;
  const stride = 8 + 3 * n;
  const quantities = physical.quantities;
  const layout = quantities?.layout;
  const safePositive = x => Number.isSafeInteger(x) && x > 0;
  if (!Number.isSafeInteger(n) || n < 1 || n > 66
      || !safePositive(count) || count > 0x7fffffff
      || count !== authority.productEventCapacity
      || count !== authority.particleCount * selected.caloricProductCapacity
      || physical.layout.particleCount !== authority.particleCount
      || physical.layout.denseEventCount !== count
      || physical.eventCompanionStrideWords !== stride
      || physical.layout.eventCompanionStrideWords !== stride
      || physical.eventCompanionByteOffset !== physical.layout.eventCompanionOffsetWords * 4
      || !layout || layout.particleCount !== authority.particleCount
      || layout.massWordCount !== n || layout.eventCapacity !== count
      || layout.eventRowOffset !== 2 * authority.particleCount
      || family.frozenSourceQuantityBuffer !== quantities.outputBuffer
      || family.frozenSourceQuantityLayout !== layout
      || family.frozenSourceResidualCountBuffer !== physical.compactCountBuffer) {
    throw placementError('exact compaction source/capacity differs from its held producer and quantity rows', 'EXACT_COMPACTION_IDENTITY');
  }
  const validate = () => {
    const live = requireLivePlacementAuthority(authority, {
      device, operation: 'exact placement compaction encoding'
    });
    const current = read.validate();
    if (live !== record || current.result !== original.result
        || current.source !== original.source || current.result.physicalOutput !== physical
        || current.source.result !== selected
        || family.frozenSourceQuantityBuffer !== quantities.outputBuffer
        || family.frozenSourceQuantityLayout !== layout
        || family.frozenSourceResidualCountBuffer !== physical.compactCountBuffer) {
      throw placementError('exact compaction lost its original retained source', 'EXACT_COMPACTION_IDENTITY');
    }
    return current;
  };
  validate();
  return Object.freeze({ massWordCount: n, eventCapacity: count,
    companionStrideWords: stride, companionByteOffset: physical.eventCompanionByteOffset,
    physical, quantities, sourceRead: read, validate });
}

/** Code-generation descriptors only: actual bindings are resolved privately at
 * encode time. Prewarm the SAME descriptors for a held exact source's N. */
export function sphReactionProductPlacementExactCompactionPipelineDescriptors({ massWordCount } = {}) {
  const code = createSphReactionProductEventCompactWgsl({ exactCompanion: { massWordCount } });
  const bindings = ['read-only-storage', 'storage', 'storage', 'uniform',
    'storage', 'storage', 'storage', 'storage', 'read-only-storage', 'storage']
    .map((type, binding) => computeBufferBinding(binding, type));
  return Object.freeze(['count_placement_rows', 'scan_placement_row_groups', 'scatter_placement_rows']
    .map(entryPoint => Object.freeze({
      cacheKey: `ulg-sph-reaction-placement-exact-compaction-v1-n${massWordCount}-${entryPoint}`,
      label: `ulg-sph-reaction-placement-exact-${entryPoint}`, code, entryPoint, bindings
    })));
}

/** Encode the genuine stable compactor INTO the original placement transaction.
 * No queue submit/fence/readback; no physical continuation or publication seal.
 * The three passes write the original receipt and arena [count,error]. The
 * exact source family retains the immutable dense inputs and quantity rows. */
export function encodeSphReactionProductPlacementExactCompactionWebGpu({
  device, encoder, authority, arenaLease, productEventBuffer, gpuTimestampRecorder = null
} = {}) {
  if (!encoder?.beginComputePass || !encoder?.clearBuffer || !encoder?.finish) {
    throw new TypeError('exact compaction requires the original live placement encoder');
  }
  const owner = requireLivePlacementAuthority(authority, { device, operation: 'exact compaction' });
  const arenaRecord = requireSegmentedPlacementArenaLease(arenaLease, { device, authority });
  const source = resolveSphReactionProductPlacementExactCompactionSource(authority, { device });
  if (!source) throw placementError('exact compaction requires the original held exact producer', 'EXACT_COMPACTION_IDENTITY');
  if (owner.exactCompactionEncoding || arenaRecord.exactCompactionEncoding
      || owner.segmentedEncoding || owner.encodedPlacement || arenaRecord.activeEncoding) {
    throw placementError('exact compaction already encoded or placement has started', 'SUBMISSION');
  }
  const arena = arenaLease.arena;
  const buffers = arena.buffers;
  const { physical, quantities, eventCapacity: count, massWordCount: n } = source;
  const groups = Math.ceil(count / 64);
  const alignment = device.limits?.minStorageBufferOffsetAlignment ?? 256;
  if (arena.eventCapacity !== count || arena.particleCapacity !== authority.particleCount
      || arena.eventStrideVec4 !== 8 || arena.exactCompactionMassWordCount !== n
      || arena.exactCompanionStrideWords !== source.companionStrideWords
      || !Number.isSafeInteger(alignment) || alignment < 1
      || !Number.isSafeInteger(source.companionByteOffset) || source.companionByteOffset < 0
      || source.companionByteOffset % alignment !== 0
      || groups > (device.limits?.maxComputeWorkgroupsPerDimension ?? 65535)
      || (device.limits?.maxStorageBuffersPerShaderStage ?? 8) < 9) {
    throw placementError('exact compaction arena/capacity/offset does not match its source', 'EXACT_COMPACTION_CAPACITY');
  }
  const eventsBytes = count * 128;
  const companionBytes = count * source.companionStrideWords * 4;
  const bounded = (buffer, size, label, offset = 0, usage = GPU_BUFFER_USAGE.STORAGE) => {
    requireBuffer(device, buffer, label);
    if (!Number.isSafeInteger(size) || size < 4 || size > 0xffff_fffc
        || !Number.isSafeInteger(offset + size) || offset + size > buffer.size
        || !Number.isSafeInteger(buffer.size) || (buffer.usage & usage) !== usage
        || size > (device.limits?.maxStorageBufferBindingSize ?? 128 * 1024 * 1024)) {
      throw placementError(`${label} does not fit its exact bound range`, 'EXACT_COMPACTION_CAPACITY');
    }
    return { buffer, offset, size };
  };
  const receipt = owner.bindings.completionReceiptBuffer;
  if (receipt !== authority.completionReceiptBuffer) {
    throw placementError('exact compaction receipt differs from the original authority', 'EXACT_COMPACTION_IDENTITY');
  }
  const family = owner.placementSourceFamily;
  const familyParticleRoles = ['sourceStateBuffer', 'sourceThermoBuffer', 'sourceMechanicsBuffer',
    'frozenSourceStateBuffer', 'frozenSourceThermoBuffer', 'frozenSourceMechanicsBuffer',
    'placedDestinationStateBuffer', 'placedDestinationThermoBuffer', 'placedDestinationMechanicsBuffer',
    'placedDestinationQuantityBuffer', 'placedDestinationResidualCountBuffer',
    'placedDestinationResidualEventBuffer', 'placedDestinationResidualCompanionBuffer', 'placedDestinationResidualPhysicalBuffer'];
  const sources = [
    // The completion receipt is the one authenticated writable authority role.
    // Every other original authority binding, including spatial lookup and
    // expectation storage, must remain disjoint from all compact destinations.
    ...Object.entries(owner.bindings).filter(([key]) => key !== 'completionReceiptBuffer').map(([, value]) => value),
    family.directorySourceBuffer,
    ...familyParticleRoles.flatMap(key => [family[key], owner.bindings[key]]).filter(Boolean),
    physical.eventBuffer, physical.auxiliaryBuffer,
    physical.compactEventBuffer, physical.compactCompanionBuffer, physical.compactCountBuffer,
    physical.compactReceiptBuffer, quantities.outputBuffer,
    ...['sourcePackedBuffer', 'packedBuffer', 'stateBuffer', 'thermoBuffer', 'mechanicsBuffer'].map(key => physical[key]),
    source.validate().result.outputBuffer, source.validate().source.result.outputBuffer,
    source.validate().source.source.inventory.buffer];
  const targets = [productEventBuffer, buffers.compactCount, receipt, buffers.compactLocalPrefix,
    buffers.compactGroupCount, buffers.compactGroupOffset, buffers.exactCompactCompanion];
  if (new Set(targets).size !== targets.length || targets.some(buffer => sources.includes(buffer))
      || targets.includes(buffers.compactParams) || sources.includes(buffers.compactParams)
      || Object.values(buffers).includes(productEventBuffer)) {
    throw placementError('exact compaction writable ranges alias a held source or one another', 'SOURCE_DESTINATION_ALIAS');
  }
  const resources = [
    bounded(physical.eventBuffer, eventsBytes, 'held exact dense events'),
    bounded(productEventBuffer, eventsBytes, 'original placement compact events'),
    bounded(buffers.compactCount, 8, 'original placement count and error'),
    bounded(buffers.compactParams, 16, 'original placement compact params', 0, GPU_BUFFER_USAGE.UNIFORM),
    bounded(receipt, SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES, 'original placement receipt'),
    bounded(buffers.compactLocalPrefix, count * 4, 'original stable local prefixes'),
    bounded(buffers.compactGroupCount, groups * 4, 'original stable group counts'),
    bounded(buffers.compactGroupOffset, groups * 4, 'original stable group offsets'),
    bounded(physical.auxiliaryBuffer, companionBytes, 'held exact dense companions', source.companionByteOffset),
    bounded(buffers.exactCompactCompanion, companionBytes, 'original placement compact companions')
  ];
  const descriptors = sphReactionProductPlacementExactCompactionPipelineDescriptors({ massWordCount: n });
  const pipelines = descriptors.map(descriptor => createCachedExplicitComputePipeline(device, descriptor));
  const entries = resources.map((resource, binding) => ({ binding, resource }));
  const bindGroups = pipelines.map((pipeline, index) => placementBindGroup(device, pipeline,
    descriptors[index].label, entries));
  source.validate();
  requireSegmentedPlacementArenaLease(arenaLease, { device, authority });
  source.sourceRead.markDerivedBuffers([productEventBuffer, buffers.exactCompactCompanion, buffers.compactCount]);
  source.validate();
  // Do not reset the original receipt; its generation/identity and other stages
  // belong to the original transaction. No held source/count/quantity is cleared.
  const clearRanges = [resources[1], resources[9], resources[2], resources[5], resources[6], resources[7]];
  for (const { buffer } of [...clearRanges, resources[3]]) {
    if ((buffer.usage & GPU_BUFFER_USAGE.COPY_DST) === 0) {
      throw placementError('exact compaction reset requires COPY_DST on original arena scratch', 'EXACT_COMPACTION_CAPACITY');
    }
  }
  const encoding = Object.freeze({ encoder, authority, arenaLease,
    productEventBuffer, compactCountBuffer: buffers.compactCount,
    compactCompanionBuffer: buffers.exactCompactCompanion,
    completionReceiptBuffer: receipt, sourcePhysicalOutput: physical,
    sourceQuantityBuffer: quantities.outputBuffer, sourceQuantityLayout: quantities.layout,
    eventCapacity: count, companionStrideWords: source.companionStrideWords,
    physicalPublicationAdmitted: false });
  // Set before recording the first command: a throwing encoder cannot retry the
  // same authority and later combine two partial command streams.
  owner.exactCompactionEncoding = encoding;
  arenaRecord.exactCompactionEncoding = encoding;
  device.queue.writeBuffer(buffers.compactParams, 0, new Uint32Array([count, 8, groups, 0]));
  source.validate();
  for (const { buffer, offset, size } of clearRanges) encoder.clearBuffer(buffer, offset, size);
  const dispatches = [groups, 1, groups];
  for (let i = 0; i < pipelines.length; i++) {
    encodePlacementPass({ encoder, pipeline: pipelines[i].pipeline, bindGroup: bindGroups[i],
      workgroupCount: dispatches[i], label: descriptors[i].label,
      producerId: `sph-reaction-summary:exact-${descriptors[i].entryPoint}`,
      gpuTimestampRecorder, metadata: { particleCount: authority.particleCount, productEventCount: count } });
  }
  source.validate();
  return encoding;
}

// Private original-owner chemistry preparation. No supplied tolerance, packet,
// route, auxiliary buffer, numeric result or publication boolean is accepted.
function exactChemistryConfigurationForAuthority(authority,device) {
  const owner=requireLivePlacementAuthority(authority,{device,operation:'exact chemistry configuration'});
  const context=owner.exactQuantityContext;
  if(!context)return null;
  context.validate();
  const original=context.original,source=original.source,selected=source.result,routing=original.result;
  const policy=original.strictGatePolicy;
  if(!policy || policy.schema!=='peercompute.ulg.exact-reaction-original-default-policy.v1'
      || policy.reactionTable!==source.reactionTable || policy.gateCompleted!==false) {
    throw placementError('exact chemistry requires the original retained reaction default-policy snapshot','EXACT_CHEMISTRY_POLICY');
  }
  const metadata=encodeSphExactReactionChemistryMetadata(source.compiled,
    {reactionTable:source.reactionTable,thermalMaterialTable:source.thermalMaterialTable});
  if(metadata.atomToleranceBits!==policy.atomToleranceBits || metadata.chargeToleranceBits!==policy.chargeToleranceBits
      || metadata.staticBlockerFlags!==policy.staticBlockerFlags) {
    throw placementError('exact chemistry original default policy changed','EXACT_CHEMISTRY_POLICY');
  }
  const layout=sphExactReactionChemistryBudgetLayout(selected.format,{pairCapacity:authority.particleCount,
    reactionCount:source.reactionTable.reactionCount,sourceRecordWords:selected.recordWords,
    speciesOffsetWords:selected.speciesOffsetWords,speciesLayout:selected.speciesLayout,
    routingLayout:routing.layout,metadataWordLength:metadata.totalWords,deviceLimits:device.limits});
  if(context.physical.auxiliaryBuffer!==routing.physicalOutput.auxiliaryBuffer
      || selected.particleCount!==authority.particleCount || routing.particleCount!==authority.particleCount
      || context.physical.layout.pairHeaderWords!==16 || context.physical.layout.pairHeaderOffsetWords!==0
      || context.physical.layout.particleCount!==authority.particleCount) {
    throw placementError('exact chemistry lost original staged pair header layout','EXACT_CHEMISTRY_IDENTITY');
  }
  const alignment=device.limits?.minUniformBufferOffsetAlignment;
  const limits=device.limits;
  if(!Number.isSafeInteger(alignment)||alignment<16||(alignment&(alignment-1))!==0
      ||!Number.isSafeInteger(limits.maxUniformBufferBindingSize)||limits.maxUniformBufferBindingSize<64
      ||!Number.isSafeInteger(limits.maxUniformBuffersPerShaderStage)||limits.maxUniformBuffersPerShaderStage<1
      ||!Number.isSafeInteger(limits.maxBindingsPerBindGroup)||limits.maxBindingsPerBindGroup<9) {
    throw placementError('exact chemistry uniform/binding limits unavailable','EXACT_CHEMISTRY_CAPACITY');
  }
  const uniformStride=Math.ceil(layout.uniformBytes/alignment)*alignment;
  // This immutable plan can contain tens of thousands of batches. Rebuilding
  // it inside each before/after-dispatch validation made recording quadratic.
  // Cache only the pure plan; source, policy, metadata and buffer validation
  // above and below still run on every call. Every planner input participates
  // in the key, including limits that may change on a diagnostic device.
  const dispatchLimits={maxComputeWorkgroupsPerDimension:limits.maxComputeWorkgroupsPerDimension,
    maxStorageBufferBindingSize:limits.maxStorageBufferBindingSize,maxBufferSize:limits.maxBufferSize,
    maxStorageBuffersPerShaderStage:limits.maxStorageBuffersPerShaderStage};
  const dispatchSignature=JSON.stringify([layout,dispatchLimits]);
  const cachedDispatch=owner.exactChemistryDispatchCache;
  const dispatch=cachedDispatch?.signature===dispatchSignature ? cachedDispatch.dispatch
    : planSphExactReactionChemistryBudgetDispatch(layout,dispatchLimits);
  const uniformRecordCount=dispatch.uniformRecordCount;
  const uniformBytes=uniformRecordCount*uniformStride;
  if(!Number.isSafeInteger(uniformBytes)||uniformBytes>limits.maxBufferSize||uniformBytes>0xffff_fffc) {
    throw placementError('exact chemistry immutable reduction params exceed capacity','EXACT_CHEMISTRY_CAPACITY');
  }
  if(cachedDispatch?.signature!==dispatchSignature) {
    owner.exactChemistryDispatchCache=Object.freeze({signature:dispatchSignature,dispatch});
  }
  const metadataWords=Object.freeze(Array.from(metadata.words));
  const signature=JSON.stringify([selected.format.wordCount,selected.format.quantumExponent,layout,
    alignment,uniformStride,metadataWords]);
  const protectedBuffers=Object.freeze([...Object.values(owner.bindings),...Object.values(context.physical),
    context.quantities.outputBuffer,selected.outputBuffer,routing.outputBuffer,
    owner.placementSourceFamily.directorySourceBuffer].filter(v=>v&&Number.isSafeInteger(v.size)));
  context.validate();
  return Object.freeze({context,policy,format:selected.format,layout,metadata,metadataWords,signature,
    dispatch,alignment,uniformStride,uniformBytes,protectedBuffers,packetBuffer:selected.outputBuffer,
    routeBuffer:routing.outputBuffer,auxiliaryBuffer:context.physical.auxiliaryBuffer});
}
function encodeExactPlacementChemistryPreparation({device,encoder,authority,arenaLease,gpuTimestampRecorder=null}={}) {
  const owner=requireLivePlacementAuthority(authority,{device,operation:'exact chemistry preparation'});
  const arenaRecord=requireSegmentedPlacementArenaLease(arenaLease,{device,authority});
  const compact=owner.exactCompactionEncoding;
  if(!compact || compact!==arenaRecord.exactCompactionEncoding || compact.authority!==authority
      ||compact.encoder!==encoder||compact.arenaLease!==arenaLease
      ||!encoder?.beginComputePass||!encoder?.finish||owner.exactChemistryRecord||arenaRecord.exactChemistryRecord
      ||owner.segmentedEncoding||owner.encodedPlacement||arenaRecord.activeEncoding) {
    throw placementError('exact chemistry requires unused original compaction, encoder and arena','EXACT_CHEMISTRY_IDENTITY');
  }
  const config=exactChemistryConfigurationForAuthority(authority,device),arena=arenaLease.arena,b=arena.buffers;
  if(!config||arena.exactChemistrySignature!==config.signature)throw placementError('exact chemistry arena changed','EXACT_CHEMISTRY_IDENTITY');
  const l=config.layout;
  const specs={packet:[config.packetBuffer,l.sourceWordLength*4],routes:[config.routeBuffer,l.routeWordLength*4],
    auxiliary:[config.auxiliaryBuffer,l.auxiliaryHeaderWordLength*4],metadata:[b.exactChemistryMetadata,l.metadataWordLength*4],
    control:[b.exactChemistryControl,l.controlWordLength*4],a:[b.exactChemistryA,l.scratchWordLength*4],
    c:[b.exactChemistryB,l.scratchWordLength*4],evidence:[b.exactChemistryEvidence,l.outputWordLength*4],
    params:[b.exactChemistryParams,config.uniformBytes],placementParams:[b.placementParams,64],
    receipt:[owner.bindings.completionReceiptBuffer,SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES]};
  const uniformNames=new Set(['params','placementParams']);
  const ranges=Object.freeze(Object.fromEntries(Object.entries(specs).map(([name,[buffer,size]])=>{
    requireBuffer(device,buffer,`exact chemistry ${name}`);
    const usage=uniformNames.has(name)?GPU_BUFFER_USAGE.UNIFORM:GPU_BUFFER_USAGE.STORAGE;
    if(!Number.isSafeInteger(buffer.size)||buffer.size<size||buffer.size>device.limits.maxBufferSize
        ||(buffer.usage&usage)!==usage||(!uniformNames.has(name)&&size>device.limits.maxStorageBufferBindingSize)) {
      throw placementError(`exact chemistry ${name} range is invalid`,'EXACT_CHEMISTRY_CAPACITY');
    }
    return[name,Object.freeze({buffer,offset:0,size})];
  })));
  const ownNames=['metadata','control','a','c','evidence','params'];
  const radixBuffers=[arenaRecord.captureRadix,arenaRecord.directRadix,arenaRecord.summaryRadix]
    .flatMap(runtime=>runtime.allocationEntries().map(entry=>entry.buffer));
  if(new Set(Object.values(ranges).map(r=>r.buffer)).size!==Object.keys(ranges).length
      ||ownNames.some(name=>config.protectedBuffers.includes(ranges[name].buffer)||radixBuffers.includes(ranges[name].buffer))
      ||Object.entries(b).some(([name,buffer])=>!name.startsWith('exactChemistry')&&ownNames.some(key=>ranges[key].buffer===buffer))) {
    throw placementError('exact chemistry scratch aliases an original source or sibling','SOURCE_DESTINATION_ALIAS');
  }
  const metadataUpload=Uint32Array.from(config.metadataWords);
  const parameterUpload=new Uint32Array(config.uniformBytes/4);
  // Every encoded stage owns an immutable aligned 32-byte parameter slice.
  // Upload the complete array once; no inter-dispatch queue writes alias it.
  const descriptors=sphExactReactionChemistryBudgetPipelineDescriptors(config.format,l);
  const immutablePipeline=descriptor=>{const value=explicitPlacementPipeline(device,descriptor);
    if(!value.pipeline)throw value.error??placementError('exact chemistry pipeline unavailable','EXACT_CHEMISTRY_PIPELINE');
    return Object.freeze({...value});};
  const pipelines=descriptors.map(immutablePipeline);
  const stages=[];
  const add=(index,input,output,dispatch,params=config.dispatch.initialParams)=>{
    const slot=stages.length;
    if(params.length!==8 || slot>=config.dispatch.uniformRecordCount)throw placementError('exact chemistry immutable parameter plan changed','EXACT_CHEMISTRY_CAPACITY');
    parameterUpload.set(params,slot*config.uniformStride/4);
    const resources=[ranges.packet,ranges.routes,ranges.auxiliary,ranges.metadata,ranges.control,input,output,ranges.evidence,
      Object.freeze({buffer:ranges.params.buffer,offset:slot*config.uniformStride,size:l.uniformBytes})];
    const entries=Object.freeze(resources.map((resource,binding)=>Object.freeze({binding,resource})));
    const descriptor=descriptors[index],pipeline=pipelines[index];
    stages.push(Object.freeze({descriptor,pipeline,entries,bindGroup:placementBindGroup(device,pipeline,descriptor.entryPoint,entries),dispatch}));
  };
  add(0,ranges.c,ranges.a,config.dispatch.reset);add(1,ranges.c,ranges.a,config.dispatch.validate);
  let input=ranges.a,output=ranges.c;
  for(const tile of config.dispatch.tiles){
    add(2,ranges.c,ranges.a,tile.initialize,tile.initialParams);
    tile.normalizations.forEach(batch=>add(3,ranges.a,ranges.c,batch.dispatch,batch.params));
    input=ranges.c;output=ranges.a;
    tile.reductions.forEach(level=>{
      level.batches.forEach(batch=>add(4,input,output,batch.dispatch,batch.params));
      [input,output]=[output,input];
    });
    tile.comparisons.forEach(batch=>add(5,input,output,batch.dispatch,batch.params));
    add(6,input,output,tile.commit,tile.initialParams);
  }
  add(7,input,output,config.dispatch.finish);
  if(stages.length!==config.dispatch.uniformRecordCount)throw placementError('exact chemistry immutable parameter coverage changed','EXACT_CHEMISTRY_IDENTITY');
  const consumptionDescriptor=Object.freeze({label:'ulg-exact-placement-chemistry-consume',
    cacheKey:`ulg-exact-placement-chemistry-consume-v2:${[l.pairCapacity,l.reactionCount,l.channelCount,l.channelTileCapacity,l.tileCount,l.outputWordLength,l.metadataWordLength,l.controlWordLength].join(':')}`,entryPoint:'consume_exact_chemistry_placement_evidence',
    code:createSphExactPlacementChemistryConsumeWgsl(l),bindings:Object.freeze([
      computeBufferBinding(0,'read-only-storage'),computeBufferBinding(1,'read-only-storage'),
      computeBufferBinding(2,'storage'),computeBufferBinding(3,'storage'),computeBufferBinding(4,'uniform')])});
  const consumptionPipeline=immutablePipeline(consumptionDescriptor);
  const consumptionEntries=Object.freeze([ranges.evidence,ranges.metadata,ranges.control,ranges.receipt,ranges.placementParams]
    .map((resource,binding)=>Object.freeze({binding,resource})));
  const consumption=Object.freeze({descriptor:consumptionDescriptor,pipeline:consumptionPipeline,entries:consumptionEntries,
    bindGroup:placementBindGroup(device,consumptionPipeline,consumptionDescriptor.label,consumptionEntries),dispatch:Object.freeze({x:1,y:1,z:1})});
  const recordingLimitNames=['maxComputeWorkgroupsPerDimension','maxStorageBufferBindingSize',
    'maxBufferSize','maxStorageBuffersPerShaderStage','minUniformBufferOffsetAlignment',
    'maxUniformBufferBindingSize','maxUniformBuffersPerShaderStage','maxBindingsPerBindGroup'];
  const recordingLimits=recordingLimitNames.map(name=>device.limits[name]);
  const validate=(contents=true)=>{
    if(requireLivePlacementAuthority(authority,{device,operation:'exact chemistry binding validation',validateContents:contents})!==owner
        ||requireSegmentedPlacementArenaLease(arenaLease,{device,authority})!==arenaRecord
        ||owner.exactCompactionEncoding!==compact||arenaRecord.exactCompactionEncoding!==compact
        ||(contents&&exactChemistryConfigurationForAuthority(authority,device).signature!==config.signature)
        ||owner.exactQuantityContext.original.strictGatePolicy!==config.policy) {
      throw placementError('exact chemistry lost its original source, policy or lease','EXACT_CHEMISTRY_IDENTITY');
    }
    for(const[name,range]of Object.entries(ranges)){
      requireBuffer(device,range.buffer,`exact chemistry ${name}`);
      if(range.buffer.size<range.size)throw placementError('exact chemistry range shrank','EXACT_CHEMISTRY_CAPACITY');
    }
    if(!contents&&recordingLimitNames.some((name,index)=>device.limits[name]!==recordingLimits[index]))validate();
  };
  validate();config.context.read.markDerivedBuffers(ownNames.map(name=>ranges[name].buffer));validate();
  const record={owner,arenaRecord,encoder,authority,arenaLease,config,ranges,stages:Object.freeze(stages),consumption,
    attempted:true,completedSteps:[],completed:false,consumed:false,consumptionAttempted:false,preparation:null,validate};
  owner.exactChemistryRecord=record;arenaRecord.exactChemistryRecord=record;
  device.queue.writeBuffer(ranges.metadata.buffer,0,metadataUpload);
  device.queue.writeBuffer(ranges.params.buffer,0,parameterUpload);
  // All descriptors and parameter slices are fixed before this synchronous
  // loop. Validate their source contents at both boundaries, before any
  // physical application or publication. Keep lifetime, identity, buffer and
  // device-limit checks between passes without repeatedly hashing source tables.
  validate();
  for(const stage of stages){
    validate(false);encodeExactPlacementChemistryStage(encoder,stage,gpuTimestampRecorder);validate(false);record.completedSteps.push(stage);
  }
  validate();record.completed=true;
  const preparation=Object.freeze({encoder,authority,arenaLease,sourceSelection:config.context.original.source.result,
    routingCandidate:config.context.original.result,policy:config.policy,layout:l,evidenceBuffer:ranges.evidence.buffer,
    metadataBuffer:ranges.metadata.buffer,controlBuffer:ranges.control.buffer,receiptBuffer:ranges.receipt.buffer,
    status:'commands-recorded',physicalPublicationAdmitted:false,quantityAdmission:false,steps:record.stages,
    explicitDispatchCount:stages.length,validate(){validate();
      if(owner.exactChemistryRecord!==record||arenaRecord.exactChemistryRecord!==record
          ||owner.exactChemistryPreparation!==preparation||arenaRecord.exactChemistryPreparation!==preparation
          ||!record.completed)throw placementError('exact chemistry record changed','EXACT_CHEMISTRY_IDENTITY');
      return preparation;}});
  record.preparation=preparation;owner.exactChemistryPreparation=preparation;arenaRecord.exactChemistryPreparation=preparation;
  return preparation;
}
function encodeExactPlacementChemistryStage(encoder,stage,gpuTimestampRecorder){
  // The candidate's checked dispatch is two-dimensional. The original helper
  // accepts only an x count, so preserve the actual x/y grid explicitly here.
  const stamp=placementTimestampBegin(gpuTimestampRecorder,encoder,{
    producerId:`sph-reaction-summary:product-event-placement:${stage.descriptor.entryPoint}`,
    stage:stage.descriptor.entryPoint,spanClass:'same-production-command-encoder-profiled-pass'});
  const pass=encoder.beginComputePass({label:stage.descriptor.entryPoint});
  pass.setPipeline(stage.pipeline.pipeline);pass.setBindGroup(0,stage.bindGroup);
  pass.dispatchWorkgroups(stage.dispatch.x,stage.dispatch.y,stage.dispatch.z);pass.end();
  placementTimestampEnd(gpuTimestampRecorder,encoder,stamp);
}
function encodeExactPlacementChemistryConsumption({device,encoder,authority,arenaLease,gpuTimestampRecorder=null}={}){
  const owner=requireLivePlacementAuthority(authority,{device,operation:'exact chemistry consumption'});
  const arenaRecord=requireSegmentedPlacementArenaLease(arenaLease,{device,authority});
  const record=owner.exactChemistryRecord,preparation=owner.exactChemistryPreparation;
  if(!record||record!==arenaRecord.exactChemistryRecord||preparation!==arenaRecord.exactChemistryPreparation
      ||record.encoder!==encoder||record.authority!==authority||record.arenaLease!==arenaLease
      ||!record.completed||record.consumptionAttempted||owner.segmentedEncoding||owner.encodedPlacement) {
    throw placementError('exact chemistry consumption requires its unused original preparation','EXACT_CHEMISTRY_IDENTITY');
  }
  preparation.validate();record.consumptionAttempted=true;
  encodeExactPlacementChemistryStage(encoder,record.consumption,gpuTimestampRecorder);preparation.validate();record.consumed=true;
  return Object.freeze({preparation,encoder,authority,arenaLease,step:record.consumption,explicitDispatchCount:1});
}

function validateExactPlacementChemistryWitness(owner,arenaRecord,encoder,arenaLease,{requireLiveLease=true}={}){
  const record=owner.exactChemistryRecord,preparation=owner.exactChemistryPreparation;
  if(!record||!preparation||record.preparation!==preparation||!record.completed||!record.consumed
      ||!record.consumptionAttempted||record.encoder!==encoder||record.authority!==arenaLease.authority
      ||record.arenaLease!==arenaLease||record.completedSteps.length!==record.stages.length
      ||record.completedSteps.some((step,i)=>step!==record.stages[i])
      ||(requireLiveLease&&(arenaRecord.exactChemistryRecord!==record||arenaRecord.exactChemistryPreparation!==preparation))){
    throw placementError('exact terminal requires complete original chemistry preparation and consumption','EXACT_CHEMISTRY_IDENTITY');
  }
  if(requireLiveLease)preparation.validate();else owner.exactQuantityContext.validate();
  return preparation;
}

// Private original-owner evidence consumer. It only records denial checks;
// the original core finalizer and sole terminal selector remain authoritative.
function encodeExactPlacementPhysicalEvidenceConsumption({device,encoder,authority,arenaLease,gpuTimestampRecorder=null}={}) {
  const owner=requireLivePlacementAuthority(authority,{device,operation:'exact physical evidence consumption'});
  const arenaRecord=requireSegmentedPlacementArenaLease(arenaLease,{device,authority});
  const preparation=owner.exactPhysicalPreparation,capture=owner.exactCapturePreparation;
  if(!preparation||preparation!==arenaRecord.exactPhysicalPreparation||preparation.encoder!==encoder
      ||preparation.authority!==authority||preparation.arenaLease!==arenaLease||preparation.capturePreparation!==capture
      ||capture!==arenaRecord.exactCapturePreparation||preparation.status!=='commands-recorded'
      ||preparation.receiptBuffer!==owner.bindings.completionReceiptBuffer
      ||owner.exactPhysicalConsumptionRecord||arenaRecord.exactPhysicalConsumptionRecord) {
    throw placementError('exact physical evidence requires its unused original preparation','EXACT_PHYSICAL_EVIDENCE_IDENTITY');
  }
  preparation.validate();
  const layout=sphExactPlacementPhysicalEvidenceLayout(preparation.physicalLayout,preparation.caloricLayout);
  const groups=planSphExactPlacementPhysicalEvidenceDispatch(layout,device.limits?.maxComputeWorkgroupsPerDimension);
  const limits=device.limits;
  if(!Number.isSafeInteger(limits?.maxStorageBuffersPerShaderStage)||limits.maxStorageBuffersPerShaderStage<4
      ||!Number.isSafeInteger(limits?.maxBindingsPerBindGroup)||limits.maxBindingsPerBindGroup<4) {
    throw placementError('exact physical evidence binding capacity unavailable','EXACT_PHYSICAL_EVIDENCE_CAPACITY');
  }
  const bound=(buffer,size,label)=>{
    requireBuffer(device,buffer,label);
    if(!Number.isSafeInteger(buffer.size)||!Number.isSafeInteger(size)||size<4||size%4||buffer.size<size
        ||!Number.isSafeInteger(limits.maxBufferSize)||size>limits.maxBufferSize
        ||!Number.isSafeInteger(limits.maxStorageBufferBindingSize)||size>limits.maxStorageBufferBindingSize
        ||(buffer.usage&GPU_BUFFER_USAGE.STORAGE)===0) {
      throw placementError(`${label} does not fit its original physical evidence range`,'EXACT_PHYSICAL_EVIDENCE_CAPACITY');
    }
    return Object.freeze({buffer,offset:0,size});
  };
  const b=arenaLease.arena.buffers;
  if(preparation.physicalEvidenceBuffer!==b.exactPhysicalEvidence||preparation.caloricBuffer!==b.exactCaloricReceiver
      ||capture.receiverMapBuffer!==b.exactCaptureMap)throw placementError('exact physical evidence changed original scratch','EXACT_PHYSICAL_EVIDENCE_IDENTITY');
  const ranges=Object.freeze([
    bound(preparation.physicalEvidenceBuffer,layout.evidenceBytes,'physical evidence'),
    bound(capture.receiverMapBuffer,layout.mapBytes,'original receiver map'),
    bound(preparation.caloricBuffer,layout.caloricBytes,'preserved original caloric row'),
    bound(preparation.receiptBuffer,layout.receiptBytes,'original receipt')]);
  if(new Set(ranges.map(r=>r.buffer)).size!==4)throw placementError('physical evidence aliases original receipt or input','SOURCE_DESTINATION_ALIAS');
  const descriptor=Object.freeze({label:'ulg-exact-placement-physical-evidence',
    cacheKey:`ulg-exact-placement-physical-evidence-v1-${layout.particleCount}-${layout.eventCapacity}-${layout.caloricRecordWords}`,
    code:createSphExactPlacementPhysicalEvidenceWgsl(preparation.physicalLayout,preparation.caloricLayout),
    entryPoint:'consume_exact_receiver_physical_evidence',
    bindings:Object.freeze(ranges.map((_,binding)=>{const value=computeBufferBinding(binding,binding===3?'storage':'read-only-storage');
      return Object.freeze({...value,buffer:Object.freeze({...value.buffer})});}))});
  const pipeline=Object.freeze({...explicitPlacementPipeline(device,descriptor)});
  const entries=Object.freeze(ranges.map((resource,binding)=>Object.freeze({binding,resource})));
  const bindGroup=placementBindGroup(device,pipeline,descriptor.label,entries);
  const step=Object.freeze({descriptor,pipeline,entries,bindGroup,groups});
  const validate=()=>{
    if(requireLivePlacementAuthority(authority,{device,operation:'exact physical evidence validation'})!==owner
        ||requireSegmentedPlacementArenaLease(arenaLease,{device,authority})!==arenaRecord
        ||owner.exactPhysicalPreparation!==preparation||arenaRecord.exactPhysicalPreparation!==preparation
        ||owner.exactCapturePreparation!==capture||arenaRecord.exactCapturePreparation!==capture
        ||preparation.validate()!==preparation)throw placementError('exact physical evidence lost original source/owner','EXACT_PHYSICAL_EVIDENCE_IDENTITY');
    for(const r of ranges)bound(r.buffer,r.size,'physical evidence');
  };
  validate();
  const record={owner,arenaRecord,preparation,capture,encoder,authority,arenaLease,layout,step,validate,attempted:true,completed:false,witness:null};
  owner.exactPhysicalConsumptionRecord=record;arenaRecord.exactPhysicalConsumptionRecord=record;
  const span=placementTimestampBegin(gpuTimestampRecorder,encoder,{producerId:'sph-reaction-summary:product-event-placement:exact-physical-evidence',
    stage:'exact-physical-evidence',spanClass:'same-production-command-encoder-profiled-pass',generationId:authority.generationId});
  validate();const pass=encoder.beginComputePass({label:descriptor.label});pass.setPipeline(pipeline.pipeline);pass.setBindGroup(0,bindGroup);
  pass.dispatchWorkgroups(...groups);pass.end();placementTimestampEnd(gpuTimestampRecorder,encoder,span);validate();
  const witness=Object.freeze({preparation,capturePreparation:capture,encoder,authority,arenaLease,step,explicitDispatchCount:1,physicalPublicationAdmitted:false});
  record.completed=true;record.witness=witness;
  owner.exactPhysicalConsumption=witness;arenaRecord.exactPhysicalConsumption=witness;
  return witness;
}
function validateExactPlacementPhysicalWitness(owner,arenaRecord,encoder,arenaLease,{requireLiveLease=true}={}) {
  const preparation=owner.exactPhysicalPreparation,record=owner.exactPhysicalConsumptionRecord,witness=owner.exactPhysicalConsumption;
  if(!preparation||!record||!witness||record.owner!==owner||record.arenaRecord!==arenaRecord
      ||!record.attempted||!record.completed||record.witness!==witness
      ||record.preparation!==preparation||witness.preparation!==preparation||record.encoder!==encoder||witness.encoder!==encoder
      ||record.authority!==arenaLease.authority||witness.authority!==arenaLease.authority
      ||record.arenaLease!==arenaLease||witness.arenaLease!==arenaLease||witness.step!==record.step
      ||preparation.encoder!==encoder||preparation.authority!==arenaLease.authority||preparation.arenaLease!==arenaLease
      ||preparation.status!=='commands-recorded'||preparation.receiptBuffer!==owner.bindings.completionReceiptBuffer
      ||preparation.capturePreparation!==record.capture||witness.capturePreparation!==record.capture
      ||(requireLiveLease&&(arenaRecord.exactPhysicalPreparation!==preparation
        ||arenaRecord.exactPhysicalConsumptionRecord!==record||arenaRecord.exactPhysicalConsumption!==witness))) {
    throw placementError('exact terminal requires original physical preparation and completed evidence consumption','EXACT_PHYSICAL_EVIDENCE_IDENTITY');
  }
  if(requireLiveLease){record.validate();preparation.validate();}else owner.exactQuantityContext.validate();
  return preparation;
}

function exactEventConfigurationForAuthority(authority,device){
 const owner=requireLivePlacementAuthority(authority,{device,operation:'exact event configuration'}),context=owner.exactQuantityContext;
 if(!context)return null;const physical=exactPhysicalConfigurationForAuthority(authority,device);if(!physical)return null;
 const bound=context.validate(),output=context.physical;
 if(output.layout.eventParticleStrideWords!==64||output.residualParticleByteOffset!==output.layout.eventParticleOffsetWords*4
  ||output.residualParticleStrideWords!==64)throw placementError('exact events require the real source residual-particle template producer','EXACT_EVENT_SOURCE');
 const layout=sphExactPlacementEventDispositionLayout(bound.placedDestinationQuantityFormat,bound.placedDestinationQuantityLayout,
  {physicalLayout:physical.physical,captureLayout:physical.capture,outputLayout:output.layout});
 const limits=device.limits,alignment=limits?.minUniformBufferOffsetAlignment;
 if(!Number.isSafeInteger(alignment)||alignment<16||(alignment&(alignment-1))!==0||limits.maxStorageBuffersPerShaderStage<layout.requiredStorageBindings
  ||limits.maxBindingsPerBindGroup<10||limits.maxUniformBuffersPerShaderStage<1||limits.maxUniformBufferBindingSize<64)
  throw placementError('exact event device bindings or alignment unavailable','EXACT_EVENT_CAPACITY');
 const sizes={exactEventControl:layout.scratchWords*4,exactEventPrefixA:layout.prefixWords*4,exactEventPrefixB:layout.prefixWords*4,
  exactEventHistory:layout.historyWords*4,exactEventHistoryCompanions:layout.eventCapacity*layout.companionWords*4,
  exactEventScanParams:Math.max(1,layout.levels)*alignment};
 for(const[key,size]of Object.entries(sizes))if(!Number.isSafeInteger(size)||size<4||size>0xffff_fffc||size>limits.maxBufferSize
  ||(key!=='exactEventScanParams'&&size>limits.maxStorageBufferBindingSize))throw placementError('exact event scratch exceeds actual capacity','EXACT_EVENT_CAPACITY');
 const dispatch=planSphExactPlacementCaptureWorkgroups(layout.eventCapacity,limits.maxComputeWorkgroupsPerDimension);
 const initializeDispatch=planSphExactPlacementCaptureWorkgroups(Math.max(layout.eventCapacity,layout.particleCount),limits.maxComputeWorkgroupsPerDimension);
 const summaryGroups=Math.ceil(layout.eventCapacity/64);if(summaryGroups>limits.maxComputeWorkgroupsPerDimension)throw placementError('exact original summary dispatch exceeds capacity','EXACT_EVENT_CAPACITY');
 const signature=JSON.stringify([bound.placedDestinationQuantityFormat.wordCount,bound.placedDestinationQuantityFormat.quantumExponent,layout,alignment]);
 context.validate();return Object.freeze({context,format:bound.placedDestinationQuantityFormat,layout,sizes,alignment,signature,dispatch,initializeDispatch,summaryGroups,
  protectedBuffers:Object.freeze([owner.placementSourceFamily.directorySourceBuffer,context.read.validate().result.outputBuffer,context.original.source.result.outputBuffer,context.original.source.source.inventory.buffer,...Object.values(owner.bindings),...Object.values(output),context.quantities.outputBuffer]
   .filter(v=>v&&Number.isSafeInteger(v.size)))});
}
function prepareExactPlacementEventDispositions({device,encoder,authority,arenaLease,gpuTimestampRecorder=null}={}){
 const owner=requireLivePlacementAuthority(authority,{device,operation:'exact event preparation'}),arenaRecord=requireSegmentedPlacementArenaLease(arenaLease,{device,authority});
 const capture=owner.exactCapturePreparation,compact=owner.exactCompactionEncoding,b=arenaLease.arena.buffers;
 if(!capture||capture!==arenaRecord.exactCapturePreparation||capture.status!=='scratch-prepared'||capture.encoder!==encoder||capture.arenaLease!==arenaLease
  ||capture.authority!==authority||compact!==arenaRecord.exactCompactionEncoding||compact?.encoder!==encoder||owner.exactEventRecord||arenaRecord.exactEventRecord
  ||owner.segmentedEncoding||owner.encodedPlacement||!encoder?.clearBuffer)throw placementError('exact event preparation requires unused original capture/compaction','EXACT_EVENT_IDENTITY');
 const config=exactEventConfigurationForAuthority(authority,device);if(!config||config.signature!==arenaLease.arena.exactEventSignature)throw placementError('exact event original arena signature changed','EXACT_EVENT_IDENTITY');
 const l=config.layout,p=l.particleCount,e=l.eventCapacity,bindings=owner.bindings;
 const specs={events:[b.denseEmission,e*128],plan:[b.eventPlan,e*32],quantities:[bindings.placedDestinationQuantityBuffer,(p+e)*l.quantity.recordWords*4],
  companions:[b.exactCompactCompanion,e*l.companionWords*4],aux:[config.context.physical.auxiliaryBuffer,l.output.auxWords*4],count:[b.compactCount,8],
  scratch:[b.exactEventControl,l.scratchWords*4],keys:[b.captureKeys,e*4],sorted:[capture.captureSortedBuffer,e*4],map:[capture.receiverMapBuffer,l.physical.mapWordLength*4],
  reduced:[capture.captureReducedValuesBuffer,l.capture.wordLength*4],physical:[b.exactPhysicalEvidence,l.physical.evidenceWordLength*4],
  state:[bindings.placedDestinationStateBuffer,p*32],thermo:[bindings.placedDestinationThermoBuffer,p*48],mechanics:[bindings.placedDestinationMechanicsBuffer,p*128],
  receipt:[bindings.completionReceiptBuffer,SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES],summaryKeys:[b.summaryKeys,e*4],summaryValues:[b.summaryValues,e*9*16],
  placementParams:[b.placementParams,64],prefixA:[b.exactEventPrefixA,l.prefixWords*4],prefixB:[b.exactEventPrefixB,l.prefixWords*4],
  history:[b.exactEventHistory,l.historyWords*4],historyCompanions:[b.exactEventHistoryCompanions,e*l.companionWords*4],
  destinationCount:[bindings.placedDestinationResidualCountBuffer,8],scanParams:[b.exactEventScanParams,config.sizes.exactEventScanParams]};
 const uniformNames=new Set(['placementParams','scanParams']);
 const ranges=Object.freeze(Object.fromEntries(Object.entries(specs).map(([name,[buffer,size]])=>{
  requireBuffer(device,buffer,'exact event '+name);const usage=uniformNames.has(name)?GPU_BUFFER_USAGE.UNIFORM:GPU_BUFFER_USAGE.STORAGE;
  if(!Number.isSafeInteger(buffer.size)||buffer.size<size||buffer.size>device.limits.maxBufferSize||(buffer.usage&usage)!==usage
   ||(!uniformNames.has(name)&&size>device.limits.maxStorageBufferBindingSize))throw placementError('exact event bound range is invalid: '+name,'EXACT_EVENT_CAPACITY');
  return[name,Object.freeze({buffer,offset:0,size})];})));
 if(new Set(Object.values(ranges).map(v=>v.buffer)).size!==Object.keys(ranges).length)throw placementError('exact event bound roles alias','SOURCE_DESTINATION_ALIAS');
 const owned=['scratch','prefixA','prefixB','history','historyCompanions','scanParams'];
 const radix=[arenaRecord.captureRadix,arenaRecord.directRadix,arenaRecord.summaryRadix].flatMap(r=>r.allocationEntries().map(v=>v.buffer));
 if(owned.some(name=>config.protectedBuffers.includes(ranges[name].buffer)||radix.includes(ranges[name].buffer)
  ||Object.entries(b).some(([key,value])=>!key.startsWith('exactEvent')&&value===ranges[name].buffer)))throw placementError('exact event scratch aliases held source or original arena','SOURCE_DESTINATION_ALIAS');
 for(const name of owned)if((ranges[name].buffer.usage&GPU_BUFFER_USAGE.COPY_DST)===0)throw placementError('exact event scratch cannot be reset','EXACT_EVENT_CAPACITY');
 const descriptors=sphExactPlacementEventPipelineDescriptors(config.format,l),pipelines={};
 for(const[name,descriptor]of Object.entries(descriptors)){const pipeline=explicitPlacementPipeline(device,descriptor);if(!pipeline.pipeline)throw pipeline.error??new Error('exact event pipeline missing');pipelines[name]=Object.freeze({...pipeline});}
 const roles={ed_events:ranges.events,product_events:ranges.events,ed_plan:ranges.plan,event_plan:ranges.plan,ed_quantities:ranges.quantities,
  ed_companions:ranges.companions,ed_aux:ranges.aux,ed_count:ranges.count,ed_scratch:ranges.scratch,ed_outcomes:ranges.scratch,
  ed_keys:ranges.keys,ed_sorted:ranges.sorted,ed_map:ranges.map,ed_reduced:ranges.reduced,ed_physical:ranges.physical,
  ed_state:ranges.state,ed_thermo:ranges.thermo,ed_mechanics:ranges.mechanics,ed_receipt:ranges.receipt,receipt:ranges.receipt,
  summary_keys:ranges.summaryKeys,summary_values:ranges.summaryValues,params:ranges.placementParams,ed_history:ranges.history,
  ed_companions_out:ranges.historyCompanions,ed_destination_count:ranges.destinationCount};
 const stage=(name,extra={},dispatch=config.dispatch)=>{
  const descriptor=descriptors[name],resources={...roles,...extra};
  const entries=Object.freeze(descriptor.roles.map(({binding,role})=>{
   const resource=resources[role];if(!resource)throw new Error('Missing original event role '+role);return Object.freeze({binding,resource});}));
  const writable=descriptor.roles.filter(v=>v.type==='storage').map(v=>resources[v.role].buffer);
  const reads=descriptor.roles.filter(v=>v.type!=='storage').map(v=>resources[v.role].buffer);
  if(writable.some(buffer=>reads.includes(buffer))||new Set(writable).size!==writable.length)throw placementError('exact event shader binds aliased write/read roles','SOURCE_DESTINATION_ALIAS');
  return Object.freeze({name,descriptor,pipeline:pipelines[name],entries,dispatch,bindGroup:placementBindGroup(device,pipelines[name],descriptor.label,entries)});
 };
 const prefix=Object.freeze([stage('initialize',{},config.initializeDispatch),stage('index'),stage('prepare'),stage('summary',{},Object.freeze({x:config.summaryGroups,y:1,z:1}))]);
 const commit=Object.freeze([stage('spare'),stage('capture'),stage('finish')]);
 const history=[stage('history_initialize',{ed_prefix_out:ranges.prefixA})];
 const paramsWords=new Uint32Array(config.sizes.exactEventScanParams/4);let input=ranges.prefixA,output=ranges.prefixB;
 for(let level=1;level<=l.levels;level++){
  paramsWords.set([2**(level-1),level,0,0],(level-1)*config.alignment/4);
  history.push(stage('history_reduce',{ed_prefix_in:input,ed_prefix_out:output,
   ed_params:Object.freeze({buffer:ranges.scanParams.buffer,offset:(level-1)*config.alignment,size:16})}));[input,output]=[output,input];
 }
 history.push(stage('history_scatter',{ed_prefix_in:input}),stage('history_publish',{ed_prefix_in:input}),stage('history_consume',{},Object.freeze({x:1,y:1,z:1})));
 const validate=()=>{
  if(requireLivePlacementAuthority(authority,{device,operation:'exact event validation'})!==owner||requireSegmentedPlacementArenaLease(arenaLease,{device,authority})!==arenaRecord
   ||owner.exactCapturePreparation!==capture||arenaRecord.exactCapturePreparation!==capture||owner.exactCompactionEncoding!==compact
   ||exactEventConfigurationForAuthority(authority,device)?.signature!==config.signature)throw placementError('exact event original source/lease changed','EXACT_EVENT_IDENTITY');
  config.context.validate();for(const[name,r]of Object.entries(ranges)){requireBuffer(device,r.buffer,'exact event '+name);if(r.buffer.size<r.size)throw placementError('exact event range shortened','EXACT_EVENT_CAPACITY');}
 };
 validate();config.context.read.markDerivedBuffers(owned.map(name=>ranges[name].buffer).concat([ranges.events.buffer,ranges.summaryKeys.buffer,ranges.summaryValues.buffer]));validate();
 const record={encoder,authority,arenaLease,owner,arenaRecord,config,ranges,prefix,commit,history:Object.freeze(history),capture,validate,
  prefixSteps:[],commitSteps:[],historySteps:[],prepared:false,commitAttempted:false,committed:false,historyAttempted:false,historyFinalized:false,preparation:null};
 owner.exactEventRecord=record;arenaRecord.exactEventRecord=record;
 device.queue.writeBuffer(ranges.scanParams.buffer,0,paramsWords);
 for(const name of owned)if(name!=='scanParams'){validate();encoder.clearBuffer(ranges[name].buffer,0,ranges[name].size);}
 for(const value of prefix){encodeExactEventOwnerStage(record,value,gpuTimestampRecorder);record.prefixSteps.push(value);}record.prepared=true;
 const preparation=Object.freeze({encoder,authority,arenaLease,capturePreparation:capture,layout:l,sourcePhysicalOutput:config.context.physical,
  controlBuffer:ranges.scratch.buffer,privateHistoryCompanionBuffer:ranges.historyCompanions.buffer,historyScratchBuffer:ranges.history.buffer,
  status:'event-summary-commands-recorded',physicalPublicationAdmitted:false,historyTransferAdmitted:false,explicitDispatchCount:prefix.length,
  validate(){validate();if(owner.exactEventPreparation!==preparation||arenaRecord.exactEventPreparation!==preparation||!record.prepared)throw placementError('exact event preparation changed','EXACT_EVENT_IDENTITY');return preparation;}});
 record.preparation=preparation;owner.exactEventPreparation=preparation;arenaRecord.exactEventPreparation=preparation;return preparation;
}
function encodeExactEventOwnerStage(record,stage,gpuTimestampRecorder){
 record.validate();const stamp=placementTimestampBegin(gpuTimestampRecorder,record.encoder,{producerId:'sph-reaction-summary:product-event-placement:'+stage.descriptor.entryPoint,
  stage:stage.descriptor.entryPoint,spanClass:'same-production-command-encoder-profiled-pass'});
 const pass=record.encoder.beginComputePass({label:stage.descriptor.label});pass.setPipeline(stage.pipeline.pipeline);pass.setBindGroup(0,stage.bindGroup);
 pass.dispatchWorkgroups(stage.dispatch.x,stage.dispatch.y,stage.dispatch.z);pass.end();placementTimestampEnd(gpuTimestampRecorder,record.encoder,stamp);record.validate();
}
function commitExactPlacementEventDispositions({device,encoder,authority,arenaLease,gpuTimestampRecorder=null}={}){
 const owner=requireLivePlacementAuthority(authority,{device,operation:'exact event commit'}),arenaRecord=requireSegmentedPlacementArenaLease(arenaLease,{device,authority});
 const record=owner.exactEventRecord,physical=owner.exactPhysicalPreparation;
 if(!record||record!==arenaRecord.exactEventRecord||!record.prepared||record.commitAttempted||record.encoder!==encoder||record.arenaLease!==arenaLease
  ||!physical||physical!==arenaRecord.exactPhysicalPreparation||physical.encoder!==encoder||physical.arenaLease!==arenaLease||physical.authority!==authority
  ||physical.capturePreparation!==record.capture||physical.status!=='commands-recorded'||physical.physicalEvidenceBuffer!==record.ranges.physical.buffer)
  throw placementError('exact event commit requires original prepared events and actual physical recording','EXACT_EVENT_IDENTITY');
 record.preparation.validate();physical.validate();record.commitAttempted=true;record.physical=physical;
 for(const value of record.commit){encodeExactEventOwnerStage(record,value,gpuTimestampRecorder);record.commitSteps.push(value);}record.committed=true;
 return Object.freeze({preparation:record.preparation,physicalPreparation:physical,explicitDispatchCount:record.commit.length,physicalPublicationAdmitted:false});
}
function finalizeExactPlacementResidualHistory({device,encoder,authority,arenaLease,gpuTimestampRecorder=null}={}){
 const owner=requireLivePlacementAuthority(authority,{device,operation:'exact residual history finalization'}),arenaRecord=requireSegmentedPlacementArenaLease(arenaLease,{device,authority});
 const record=owner.exactEventRecord;
 if(!record||record!==arenaRecord.exactEventRecord||!record.committed||record.historyAttempted||record.encoder!==encoder||record.arenaLease!==arenaLease
  ||owner.exactPhysicalPreparation!==record.physical||arenaRecord.exactPhysicalPreparation!==record.physical)
  throw placementError('exact history requires original committed event stream','EXACT_EVENT_IDENTITY');
 record.preparation.validate();record.physical.validate();record.historyAttempted=true;
 for(const value of record.history){encodeExactEventOwnerStage(record,value,gpuTimestampRecorder);record.historySteps.push(value);}record.historyFinalized=true;
 return Object.freeze({preparation:record.preparation,privateHistoryCompanionBuffer:record.ranges.historyCompanions.buffer,
  residualCountBuffer:record.ranges.destinationCount.buffer,explicitDispatchCount:record.history.length,historyTransferAdmitted:false});
}
function validateExactPlacementEventWitness(owner,arenaRecord,encoder,arenaLease,{requireLiveLease=true}={}){
 const record=owner.exactEventRecord,preparation=owner.exactEventPreparation;
 if(!record||record.preparation!==preparation||record.encoder!==encoder||record.arenaLease!==arenaLease||!record.prepared||!record.committed||!record.historyFinalized
  ||record.prefixSteps.length!==record.prefix.length||record.commitSteps.length!==record.commit.length||record.historySteps.length!==record.history.length
  ||record.prefixSteps.some((v,i)=>v!==record.prefix[i])||record.commitSteps.some((v,i)=>v!==record.commit[i])||record.historySteps.some((v,i)=>v!==record.history[i])
  ||(requireLiveLease&&(record!==arenaRecord.exactEventRecord||preparation!==arenaRecord.exactEventPreparation)))
  throw placementError('exact terminal requires the complete original event disposition and history sequence','EXACT_EVENT_IDENTITY');
 if(requireLiveLease){preparation.validate();record.physical.validate();}else owner.exactQuantityContext.validate();return preparation;
}

// All authority and command witnesses remain in the ORIGINAL owner records.
// These private helpers never select terminal status or grant physical admission.
function prepareExactPlacementTerminalEncoding({ device, encoder, authority, arenaLease,
  productEventBuffer, placementSummaryBuffer, boxDimsM = [0, 0, 0], diagnosticReadbackRequested = false } = {}) {
  const owner = requireLivePlacementAuthority(authority, { device, operation: 'exact terminal preparation' });
  if (!owner.exactQuantityContext) return null;
  const arenaRecord = requireSegmentedPlacementArenaLease(arenaLease, { device, authority });
  const compact = owner.exactCompactionEncoding;
  if (!encoder?.beginComputePass || !encoder?.finish || !compact
      || compact !== arenaRecord.exactCompactionEncoding || compact.encoder !== encoder
      || compact.authority !== authority || compact.arenaLease !== arenaLease
      || compact.productEventBuffer !== productEventBuffer
      || compact.completionReceiptBuffer !== owner.bindings.completionReceiptBuffer
      || compact.sourcePhysicalOutput !== owner.exactQuantityContext.physical) {
    throw placementError('exact terminal requires its original compaction, encoder and lease', 'EXACT_TERMINAL_IDENTITY');
  }
  if (typeof encoder.copyBufferToBuffer !== 'function') {
    throw placementError('exact residual family storage requires original terminal raw copies', 'EXACT_TERMINAL_IDENTITY');
  }
  if (owner.exactTerminalRecord || arenaRecord.exactTerminalRecord || owner.segmentedEncoding
      || owner.encodedPlacement || arenaRecord.activeEncoding) {
    throw placementError('exact terminal preparation is one-shot', 'SUBMISSION');
  }
  const context = owner.exactQuantityContext, exact = context.validate();
  const arena = arenaLease.arena, buffers = arena.buffers;
  const p = arena.particleCapacity, e = arena.eventCapacity, terms = arena.productTermCapacity;
  const format = exact.placedDestinationQuantityFormat, sourceLayout = exact.frozenSourceQuantityLayout;
  const destinationLayout = exact.placedDestinationQuantityLayout;
  const quantityCode = createSphExactPlacementQuantityTerminalWgsl(format, sourceLayout);
  const eventConfig=exactEventConfigurationForAuthority(authority,device);
  if(!eventConfig||eventConfig.signature!==arena.exactEventSignature)throw placementError('exact terminal requires original event arena','EXACT_EVENT_IDENTITY');
  if (p !== authority.particleCount || e !== authority.productEventCapacity || arena.eventStrideVec4 !== 8
      || sourceLayout !== context.quantities.layout || exact.frozenSourceQuantityBuffer !== context.quantities.outputBuffer
      || sourceLayout.particleCount !== p || sourceLayout.eventCapacity !== e
      || destinationLayout.currentRowOffset !== 0 || destinationLayout.eventRowOffset !== p
      || destinationLayout.rowCount !== p + e || destinationLayout.wordLength !== (p + e) * sourceLayout.recordWords
      || destinationLayout.recordWords !== sourceLayout.recordWords || destinationLayout.scalar !== sourceLayout.scalar
      || destinationLayout.massWordCount !== format.wordCount
      || compact.sourceQuantityBuffer !== exact.frozenSourceQuantityBuffer
      || compact.sourceQuantityLayout !== sourceLayout || compact.compactCountBuffer !== buffers.compactCount) {
    throw placementError('exact terminal lost its original/current/residual quantity planes', 'EXACT_TERMINAL_IDENTITY');
  }
  const dispatch = planSphExactPlacementTerminalWorkgroups({ particleCount:p,eventCapacity:e,productTermCount:terms,
    eventStrideVec4:8,maxComputeWorkgroupsPerDimension:device.limits?.maxComputeWorkgroupsPerDimension });
  const limits = device.limits;
  if (!limits || !['maxStorageBuffersPerShaderStage','maxUniformBuffersPerShaderStage','maxBindingsPerBindGroup',
    'maxStorageBufferBindingSize','maxUniformBufferBindingSize','maxBufferSize'].every(key=>Number.isSafeInteger(limits[key])&&limits[key]>0)
      || limits.maxStorageBuffersPerShaderStage < 7 || limits.maxUniformBuffersPerShaderStage < 1
      || limits.maxBindingsPerBindGroup < 8 || limits.maxUniformBufferBindingSize < 64) {
    throw placementError('exact terminal exceeds original device binding limits', 'EXACT_TERMINAL_CAPACITY');
  }
  const bound = (buffer,size,label,usage=GPU_BUFFER_USAGE.STORAGE) => {
    requireBuffer(device,buffer,label);
    const limit=usage===GPU_BUFFER_USAGE.UNIFORM?limits.maxUniformBufferBindingSize:limits.maxStorageBufferBindingSize;
    if (!Number.isSafeInteger(size)||size<4||size>0xffff_fffc||size%4
        || !Number.isSafeInteger(buffer.size)||buffer.size<size||buffer.size>limits.maxBufferSize
        || size>limit||(buffer.usage&usage)!==usage) {
      throw placementError(`exact terminal ${label} does not fit its original range`, 'EXACT_TERMINAL_CAPACITY');
    }
    return Object.freeze({buffer,offset:0,size});
  };
  const b=owner.bindings;
  const ranges=Object.freeze({
    rollbackState:bound(b.sourceStateBuffer,p*32,'rollback state'),
    rollbackThermo:bound(b.sourceThermoBuffer,p*48,'rollback thermo'),
    rollbackMechanics:bound(b.sourceMechanicsBuffer,p*128,'rollback mechanics'),
    state:bound(b.placedDestinationStateBuffer,p*32,'destination state'),
    thermo:bound(b.placedDestinationThermoBuffer,p*48,'destination thermo'),
    mechanics:bound(b.placedDestinationMechanicsBuffer,p*128,'destination mechanics'),
    originalQuantities:bound(exact.frozenSourceQuantityBuffer,p*sourceLayout.recordWords*4,'byte-zero original quantity plane'),
    quantities:bound(exact.placedDestinationQuantityBuffer,(p+e)*sourceLayout.recordWords*4,'persistent current/residual quantities'),
    mass:bound(exact.placedDestinationMassBuffer,(p+e)*format.wordCount*4,'terminal current/residual mass',
      GPU_BUFFER_USAGE.STORAGE|GPU_BUFFER_USAGE.COPY_SRC|GPU_BUFFER_USAGE.COPY_DST),
    count:bound(exact.placedDestinationResidualCountBuffer,8,'destination residual count and error'),
    candidateEvents:bound(buffers.denseEmission,e*128,'candidate events'),
    events:bound(productEventBuffer,e*128,'published events',GPU_BUFFER_USAGE.STORAGE|GPU_BUFFER_USAGE.COPY_SRC),
    residualEvents:bound(exact.placedDestinationResidualEventBuffer,e*128,'durable residual events',
      GPU_BUFFER_USAGE.STORAGE|GPU_BUFFER_USAGE.COPY_SRC|GPU_BUFFER_USAGE.COPY_DST),
    residualCompanions:bound(exact.placedDestinationResidualCompanionBuffer,e*eventConfig.layout.companionWords*4,'durable residual companions',
      GPU_BUFFER_USAGE.STORAGE|GPU_BUFFER_USAGE.COPY_SRC|GPU_BUFFER_USAGE.COPY_DST),
    residualPhysical:bound(exact.placedDestinationResidualPhysicalBuffer,e*208,'durable residual physical state',
      GPU_BUFFER_USAGE.STORAGE|GPU_BUFFER_USAGE.COPY_SRC|GPU_BUFFER_USAGE.COPY_DST),
    productTemplates:bound(context.physical.auxiliaryBuffer,eventConfig.layout.output.auxWords*4,'original product physical templates'),
    candidateSummary:bound(buffers.candidateSummary,terms*128,'candidate summary'),
    summary:bound(placementSummaryBuffer,terms*128,'published summary'),
    receipt:bound(b.completionReceiptBuffer,SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES,'original receipt'),
    historyCompanions:bound(buffers.exactEventHistoryCompanions,e*eventConfig.layout.companionWords*4,'private pending history companions',GPU_BUFFER_USAGE.STORAGE|GPU_BUFFER_USAGE.COPY_SRC),
    params:bound(buffers.placementParams,64,'original placement params',GPU_BUFFER_USAGE.UNIFORM)
  });
  const writableNames=['state','thermo','mechanics','quantities','mass','count','events','summary','receipt','historyCompanions','residualEvents','residualCompanions','residualPhysical'];
  const writes=writableNames.map(name=>ranges[name].buffer);
  const sourceRead=context.read.validate();
  const protectedInputs=[...Object.values(b).filter(value=>value&&Number.isSafeInteger(value.size)&&!writes.includes(value)),
    owner.placementSourceFamily.directorySourceBuffer,
    ...Object.values(context.physical).filter(value=>value&&Number.isSafeInteger(value.size)),
    context.quantities.outputBuffer,sourceRead.result.outputBuffer,sourceRead.source.result.outputBuffer,
    sourceRead.source.source.inventory.buffer,
    ...Object.values(buffers).filter(buffer=>buffer!==ranges.historyCompanions.buffer),...arenaRecord.captureRadix.allocationEntries().map(v=>v.buffer),
    ...arenaRecord.directRadix.allocationEntries().map(v=>v.buffer),...arenaRecord.summaryRadix.allocationEntries().map(v=>v.buffer)];
  if (new Set(Object.values(ranges).map(r=>r.buffer)).size!==Object.keys(ranges).length
      || new Set(writes).size!==writes.length||writes.some(buffer=>protectedInputs.includes(buffer))) {
    throw placementError('exact terminal outputs alias source, history, arena or sibling ranges', 'SOURCE_DESTINATION_ALIAS');
  }
  const dimensions=[0,1,2].map(axis=>{const n=Number(boxDimsM?.[axis]);return Number.isFinite(n)&&n>0?n:0;});
  const paramWords=Object.freeze(Array.from(new Uint32Array(placementParamsData({particleCount:p,eventCount:e,eventStrideVec4:8,
    productTermCount:terms,boxDimsM:dimensions,generationId:authority.generationId,supportProfileId:authority.supportProfileId,
    diagnosticReadbackRequested}))));
  const original=sphReactionProductPlacementSegmentedPipelineDescriptors();
  const make=(name,code,entryPoint,types)=>Object.freeze({label:`ulg-exact-placement-terminal-${name}`,
    cacheKey:`ulg-exact-placement-terminal-v1-${name}-${format.wordCount}-${format.quantumExponent}-${sourceLayout.scalar.wordCount}-${p}-${e}`,
    code,entryPoint,bindings:types.map((type,i)=>computeBufferBinding(i,type))});
  const physicalTypes=['read-only-storage','read-only-storage','read-only-storage','storage','storage','storage','storage','uniform'];
  const physicalCode=createSphExactPlacementPhysicalTerminalWgsl();
  const descriptors=[
    make('physical-disposition',physicalCode,'publish_or_restore_placement_destination',physicalTypes),
    original.transactionalAuxiliaryPublish, original.transactionalTerminal,
    make('physical-recovery',physicalCode,'recover_unsafe_placement_destination',physicalTypes),
    make('quantities',quantityCode,'materialize_terminal_exact_placement_quantities',['read-only-storage','storage','storage','read-only-storage','uniform']),
    make('mass',createSphExactPlacementMassTerminalWgsl(format,sourceLayout),'materialize_terminal_exact_placement_mass',
      ['read-only-storage','storage']),
    make('ledgers',createSphExactPlacementLedgerTerminalWgsl(),'materialize_safe_placement_ledgers',
      ['read-only-storage','storage','read-only-storage','storage','read-only-storage','uniform']),
    make('private-companion-recovery',createSphExactPlacementPrivateCompanionRecoveryWgsl(eventConfig.layout),'recover_exact_private_residual_companions',['storage','read-only-storage']),
    make('residual-physical',createSphExactPlacementResidualPhysicalTerminalWgsl(eventConfig.layout),'materialize_terminal_residual_physical',
      ['read-only-storage','read-only-storage','read-only-storage','read-only-storage','read-only-storage','storage'])
  ];
  const physicalNames=['rollbackState','rollbackThermo','rollbackMechanics','state','thermo','mechanics','receipt','params'];
  const ledgerNames=['candidateEvents','events','candidateSummary','summary','receipt','params'];
  const names=[physicalNames,ledgerNames,['receipt','params'],physicalNames,['originalQuantities','quantities','count','receipt','params'],['quantities','mass'],ledgerNames,['historyCompanions','receipt'],['productTemplates','historyCompanions','events','count','receipt','residualPhysical']];
  const workgroups=[dispatch.physical,dispatch.ledgers,1,dispatch.physical,dispatch.quantities,dispatch.quantities,dispatch.ledgers,Math.ceil(e/64),Math.ceil(e/64)];
  const steps=Object.freeze(descriptors.map((originalDescriptor,i)=>{
    // Snapshot witness metadata without freezing a shared descriptor/cache object.
    // GPU handles remain opaque; only this private wrapper is immutable.
    const descriptor=Object.freeze({...originalDescriptor,bindings:Object.freeze(originalDescriptor.bindings.map(binding=>
      Object.freeze({...binding,buffer:Object.freeze({...binding.buffer})})))});
    const pipeline=Object.freeze({...explicitPlacementPipeline(device,descriptor)});
    const entries=Object.freeze(names[i].map((name,binding)=>Object.freeze({binding,resource:ranges[name]})));
    const bindGroup=placementBindGroup(device,pipeline,descriptor.label,entries);
    return Object.freeze({descriptor,pipeline,bindGroup,entries,workgroups:workgroups[i]});
  }));
  // All terminal dispatches recover/select the pending planes first. These
  // immutable raw-copy steps make only storage durable; no history admission.
  const residualCopies=Object.freeze([
    Object.freeze({source:ranges.events,destination:ranges.residualEvents,size:ranges.events.size}),
    Object.freeze({source:ranges.historyCompanions,destination:ranges.residualCompanions,size:ranges.historyCompanions.size})
  ]);
  const validate=()=>{
    if (requireLivePlacementAuthority(authority,{device,operation:'exact terminal binding validation'})!==owner
        ||requireSegmentedPlacementArenaLease(arenaLease,{device,authority})!==arenaRecord
        ||owner.exactCompactionEncoding!==compact||arenaRecord.exactCompactionEncoding!==compact
        ||context.validate()!==exact||context.quantities.layout!==sourceLayout
        ||context.physical!==compact.sourcePhysicalOutput
        ||Object.entries(exact).some(([key,value])=>b[key]!==value)
        ||ranges.params.buffer!==buffers.placementParams||ranges.candidateEvents.buffer!==buffers.denseEmission
        ||ranges.candidateSummary.buffer!==buffers.candidateSummary) {
      throw placementError('exact terminal source/arena bindings changed', 'EXACT_TERMINAL_IDENTITY');
    }
    for(const[name,r]of Object.entries(ranges)) {
      const usage=name==='params'?GPU_BUFFER_USAGE.UNIFORM
        : ['mass','residualEvents','residualCompanions','residualPhysical'].includes(name)?GPU_BUFFER_USAGE.STORAGE|GPU_BUFFER_USAGE.COPY_SRC|GPU_BUFFER_USAGE.COPY_DST
        : ['events','historyCompanions'].includes(name)?GPU_BUFFER_USAGE.STORAGE|GPU_BUFFER_USAGE.COPY_SRC
        : GPU_BUFFER_USAGE.STORAGE;
      bound(r.buffer,r.size,name,usage);
    }
  };
  validate();
  context.read.markDerivedBuffers([ranges.state.buffer,ranges.thermo.buffer,ranges.quantities.buffer,ranges.mass.buffer,ranges.count.buffer,
    ranges.events.buffer,ranges.summary.buffer,ranges.historyCompanions.buffer,
    ranges.residualEvents.buffer,ranges.residualCompanions.buffer,ranges.residualPhysical.buffer],{mechanicsBuffers:[ranges.mechanics.buffer]});
  validate();
  const plan=Object.freeze({authority,encoder,arenaLease,ranges,exactBindings:exact,format,sourceLayout,destinationLayout,
    paramWords,dispatch,steps,residualCopies,residualStorageLayout:exact.placedDestinationResidualLayout,
    physicalPublicationAdmitted:false,historyTransferAdmitted:false});
  const record={plan,owner,arenaRecord,validate,attempted:false,completed:false,completedSteps:[],completedResidualCopies:[],encoding:null};
  owner.exactTerminalRecord=record;arenaRecord.exactTerminalRecord=record;
  return plan;
}
function encodeExactPlacementTerminal({device,encoder,authority,arenaLease,plan,gpuTimestampRecorder=null}={}) {
  const owner=requireLivePlacementAuthority(authority,{device,operation:'exact terminal encoding'});
  const record=owner.exactTerminalRecord;
  if(!record||record.plan!==plan||plan.encoder!==encoder||plan.authority!==authority||plan.arenaLease!==arenaLease
      ||record.arenaRecord.exactTerminalRecord!==record||record.attempted||owner.segmentedEncoding||owner.encodedPlacement) {
    throw placementError('exact terminal requires its unused original private preparation','EXACT_TERMINAL_IDENTITY');
  }
  record.validate();
  const capture=owner.exactCapturePreparation;
  if(!capture||capture!==record.arenaRecord.exactCapturePreparation||capture.encoder!==encoder
      ||capture.authority!==authority||capture.arenaLease!==arenaLease||capture.status!=='scratch-prepared') {
    throw placementError('exact terminal requires the original capture sequence','EXACT_TERMINAL_IDENTITY');
  }
  const chemistry=validateExactPlacementChemistryWitness(owner,record.arenaRecord,encoder,arenaLease);
  const physical=validateExactPlacementPhysicalWitness(owner,record.arenaRecord,encoder,arenaLease);
  record.physicalPreparation=physical;record.physicalEvidenceConsumption=owner.exactPhysicalConsumption;
  record.chemistryPreparation=chemistry;
  record.eventPreparation=validateExactPlacementEventWitness(owner,record.arenaRecord,encoder,arenaLease);
  if(record.eventPreparation.privateHistoryCompanionBuffer!==plan.ranges.historyCompanions.buffer)throw placementError('exact event companion witness changed','EXACT_EVENT_IDENTITY');
  record.attempted=true;
  for(const step of plan.steps){
    record.validate();
    encodePlacementPass({encoder,pipeline:step.pipeline.pipeline,bindGroup:step.bindGroup,workgroupCount:step.workgroups,
      label:step.descriptor.label,producerId:`sph-reaction-summary:product-event-placement:${step.descriptor.entryPoint}`,
      gpuTimestampRecorder,metadata:{generationId:authority.generationId,particleCount:authority.particleCount,eventCapacity:authority.productEventCapacity}});
    record.validate();record.completedSteps.push(step);
  }
  for(const copy of plan.residualCopies){
    record.validate();
    encoder.copyBufferToBuffer(copy.source.buffer,copy.source.offset,copy.destination.buffer,copy.destination.offset,copy.size);
    record.validate();record.completedResidualCopies.push(copy);
  }
  record.completed=true;
  const encoding=Object.freeze({plan,authority,encoder,arenaLease,steps:Object.freeze([...record.completedSteps]),
    residualCopies:Object.freeze([...record.completedResidualCopies]),encodedCopyCount:plan.residualCopies.length,
    residualStorageLayout:plan.residualStorageLayout,historyTransferAdmitted:false,
    encodedDispatchCount:plan.steps.length,quantitySelectionStage:plan.steps[4],massSelectionStage:plan.steps[5],chemistryPreparation:chemistry,
    physicalPreparation:physical,physicalEvidenceConsumption:record.physicalEvidenceConsumption,eventPreparation:record.eventPreparation,physicalPublicationAdmitted:false});
  record.encoding=encoding;owner.exactTerminalEncoding=encoding;record.arenaRecord.exactTerminalEncoding=encoding;
  return encoding;
}
function validateExactPlacementTerminalEncoding(owner,genuine,{requireLiveLease=true}={}) {
  if(!owner.exactQuantityContext){
    if(genuine?.exactTerminalEncoding)throw placementError('legacy placement cannot substitute exact terminal evidence','EXACT_TERMINAL_IDENTITY');
    return null;
  }
  const record=owner.exactTerminalRecord,encoding=record?.encoding,plan=record?.plan;
  if(!record||!record.completed||!record.attempted||!encoding||genuine?.exactTerminalEncoding!==encoding
      ||owner.exactTerminalEncoding!==encoding||genuine.encoder!==plan.encoder||genuine.arenaLease!==plan.arenaLease
      ||encoding.plan!==plan||encoding.steps.length!==9||encoding.quantitySelectionStage!==plan.steps[4]
      ||encoding.massSelectionStage!==plan.steps[5]
      ||encoding.encodedCopyCount!==2||encoding.residualCopies?.length!==2||record.completedResidualCopies.length!==2
      ||encoding.residualStorageLayout!==plan.residualStorageLayout||encoding.historyTransferAdmitted!==false
      ||encoding.residualCopies.some((copy,i)=>copy!==plan.residualCopies[i]||record.completedResidualCopies[i]!==copy)
      ||encoding.steps.some((step,i)=>step!==plan.steps[i]||record.completedSteps[i]!==step)
      ||genuine.transactionRollbackStateBuffer!==plan.ranges.rollbackState.buffer
      ||genuine.transactionRollbackThermoBuffer!==plan.ranges.rollbackThermo.buffer
      ||genuine.transactionRollbackMechanicsBuffer!==plan.ranges.rollbackMechanics.buffer
      ||genuine.productEventBuffer!==plan.ranges.events.buffer||genuine.candidateProductEventBuffer!==plan.ranges.candidateEvents.buffer
      ||genuine.placementSummaryBuffer!==plan.ranges.summary.buffer||genuine.candidatePlacementSummaryBuffer!==plan.ranges.candidateSummary.buffer
      ||genuine.completionReceiptBuffer!==plan.ranges.receipt.buffer) {
    throw placementError('exact placement requires every original terminal stage and binding','EXACT_TERMINAL_IDENTITY');
  }
  const chemistry=validateExactPlacementChemistryWitness(owner,record.arenaRecord,plan.encoder,plan.arenaLease,{requireLiveLease});
  if(record.chemistryPreparation!==chemistry||encoding.chemistryPreparation!==chemistry)
    throw placementError('exact terminal chemistry witness was substituted','EXACT_CHEMISTRY_IDENTITY');
  const physical=validateExactPlacementPhysicalWitness(owner,record.arenaRecord,plan.encoder,plan.arenaLease,{requireLiveLease});
  if(record.physicalPreparation!==physical||encoding.physicalPreparation!==physical
      ||genuine.exactPhysicalPreparation!==physical
      ||record.physicalEvidenceConsumption!==owner.exactPhysicalConsumption
      ||encoding.physicalEvidenceConsumption!==record.physicalEvidenceConsumption
      ||genuine.exactPhysicalConsumption!==record.physicalEvidenceConsumption) {
    throw placementError('exact terminal physical witness was substituted','EXACT_PHYSICAL_EVIDENCE_IDENTITY');
  }
  const event=validateExactPlacementEventWitness(owner,record.arenaRecord,plan.encoder,plan.arenaLease,{requireLiveLease});
  if(record.eventPreparation!==event||encoding.eventPreparation!==event||event.privateHistoryCompanionBuffer!==plan.ranges.historyCompanions.buffer)
    throw placementError('exact terminal event witness was substituted','EXACT_EVENT_IDENTITY');
  if(requireLiveLease)record.validate();
  else owner.exactQuantityContext.validate();
  return encoding;
}
function exactPlacementTerminalArtifactMatches(artifact,submission) {
  if(!submission.record.exactQuantityContext)return artifact.exactTerminalEncoding===undefined;
  try{
    const exact=validateExactPlacementTerminalEncoding(submission.record,submission.encoding.segmentedEncoding,{requireLiveLease:false});
    return exact===submission.encoding.exactTerminalEncoding&&exact===artifact.exactTerminalEncoding
      &&Object.entries(exact.plan.exactBindings).every(([key,value])=>artifact[key]===value&&submission.encoding[key]===value);
  }catch{return false;}
}

/**
 * Encode the production segmented placement chain into an existing encoder.
 * The returned encoding is still unsubmitted and owns the arena lease until
 * the caller seals/submits it through the one-shot authority API.
 */
export function encodeSphReactionProductPlacementSegmentedWebGpu({
  device,
  encoder,
  authority,
  arenaLease,
  productEventBuffer,
  candidateProductEventBuffer = arenaLease?.arena?.buffers?.denseEmission,
  nextStateBuffer,
  nextThermoBuffer,
  nextMechanicsBuffer,
  placementSummaryBuffer,
  candidatePlacementSummaryBuffer =
    arenaLease?.arena?.buffers?.candidateSummary,
  frozenSourceStateBuffer = authority?.frozenSourceStateBuffer,
  frozenSourceThermoBuffer = authority?.frozenSourceThermoBuffer,
  frozenSourceMechanicsBuffer = authority?.frozenSourceMechanicsBuffer,
  transactionRollbackStateBuffer = authority?.sourceStateBuffer,
  transactionRollbackThermoBuffer = authority?.sourceThermoBuffer,
  transactionRollbackMechanicsBuffer = authority?.sourceMechanicsBuffer,
  compactCountBuffer = arenaLease?.arena?.buffers?.compactCount,
  placementDecisionBuffer = arenaLease?.arena?.buffers?.decisions,
  placementControlBuffer = arenaLease?.arena?.buffers?.control,
  completionReceiptBuffer = authority?.completionReceiptBuffer,
  productTermCount = arenaLease?.arena?.productTermCapacity,
  boxDimsM = [0, 0, 0],
  gpuTimestampRecorder = null,
  diagnosticReadbackRequested = false,
  // G2 integer energy ledger: encoded after the transactional terminal seal,
  // so it reads the final published rows, the event plan and the receipt.
  ledgerReconcile = null
} = {}) {
  if (!encoder?.beginComputePass || !encoder?.finish) {
    throw new TypeError('segmented product placement requires a live command encoder');
  }
  const authorityRecord = requireLivePlacementAuthority(authority, {
    device,
    operation: 'segmented placement encoding'
  });
  // A genuine retained exact family supplies the complete current/residual
  // quantities. Its buffers are checked against the original authority below,
  // before uploads or encoding. Legacy callers still cannot use exact aliases.
  if (!authorityRecord.exactQuantityContext && !isSphExactReactionLedgerReconcileStage(ledgerReconcile)) {
    for (const [stateBuffer, thermoBuffer] of [[nextStateBuffer, nextThermoBuffer],
      [frozenSourceStateBuffer, frozenSourceThermoBuffer],
      [transactionRollbackStateBuffer, transactionRollbackThermoBuffer]]) {
      assertSphLegacyMassPathAllowed({ stateBuffer, thermoBuffer }, 'Product placement');
    }
  }
  if (authorityRecord.segmentedEncoding || authorityRecord.encodedPlacement) {
    throw placementError(
      'segmented placement authority already encoded its one-shot production chain',
      'SUBMISSION'
    );
  }
  const arenaRecord = requireSegmentedPlacementArenaLease(arenaLease, {
    device,
    authority
  });
  if (arenaRecord.activeEncoding) {
    throw placementArenaError('placement arena already encoded this lease', 'ARENA_LEASE');
  }
  const exactCompaction = resolveSphReactionProductPlacementExactCompactionSource(authority, { device });
  if (exactCompaction) {
    const compact = authorityRecord.exactCompactionEncoding;
    if (!compact || compact !== arenaRecord.exactCompactionEncoding
        || compact.encoder !== encoder || compact.arenaLease !== arenaLease
        || compact.productEventBuffer !== productEventBuffer
        || compact.compactCountBuffer !== compactCountBuffer
        || compact.completionReceiptBuffer !== completionReceiptBuffer
        || compact.sourcePhysicalOutput !== exactCompaction.physical) {
      throw placementError('segmented exact placement requires its original encoded stable compaction', 'EXACT_COMPACTION_IDENTITY');
    }
  }
  const arena = arenaLease.arena;
  const buffers = arena.buffers;
  const publishedEvents = requireBuffer(
    device,
    productEventBuffer,
    'published placement product events'
  );
  const events = requireBuffer(
    device,
    candidateProductEventBuffer,
    'candidate placement product events'
  );
  const state = requireBuffer(device, nextStateBuffer, 'placed destination state');
  const thermo = requireBuffer(device, nextThermoBuffer, 'placed destination thermo');
  const mechanics = requireBuffer(device, nextMechanicsBuffer, 'placed destination mechanics');
  const publishedSummary = requireBuffer(
    device,
    placementSummaryBuffer,
    'published placement summary'
  );
  const summary = requireBuffer(
    device,
    candidatePlacementSummaryBuffer,
    'candidate placement summary'
  );
  const frozenState = requireBuffer(device, frozenSourceStateBuffer, 'frozen placement state');
  const frozenThermo = requireBuffer(device, frozenSourceThermoBuffer, 'frozen placement thermo');
  const frozenMechanics = requireBuffer(
    device,
    frozenSourceMechanicsBuffer,
    'frozen placement mechanics'
  );
  const rollbackState = requireBuffer(
    device,
    transactionRollbackStateBuffer,
    'pre-reaction transaction rollback state'
  );
  const rollbackThermo = requireBuffer(
    device,
    transactionRollbackThermoBuffer,
    'pre-reaction transaction rollback thermo'
  );
  const rollbackMechanics = requireBuffer(
    device,
    transactionRollbackMechanicsBuffer,
    'pre-reaction transaction rollback mechanics'
  );
  const compactCount = requireBuffer(device, compactCountBuffer, 'placement compact count');
  const decisions = requireBuffer(device, placementDecisionBuffer, 'placement decisions');
  const control = requireBuffer(device, placementControlBuffer, 'placement control');
  const receipt = requireBuffer(device, completionReceiptBuffer, 'placement completion receipt');
  if (
    state !== authority.placedDestinationStateBuffer
    || thermo !== authority.placedDestinationThermoBuffer
    || mechanics !== authority.placedDestinationMechanicsBuffer
    || frozenState !== authority.frozenSourceStateBuffer
    || frozenThermo !== authority.frozenSourceThermoBuffer
    || frozenMechanics !== authority.frozenSourceMechanicsBuffer
    || rollbackState !== authority.sourceStateBuffer
    || rollbackThermo !== authority.sourceThermoBuffer
    || rollbackMechanics !== authority.sourceMechanicsBuffer
    || decisions !== buffers.decisions
    || control !== buffers.control
    || compactCount !== buffers.compactCount
    || receipt !== authority.completionReceiptBuffer
  ) {
    throw placementError(
      'segmented placement buffers do not match the exact authority and arena family',
      'IDENTITY'
    );
  }
  const authorityAndArenaBuffers = new Set([
    authority.directoryBuffer,
    authority.directoryPositionAuthorityStateBuffer,
    authority.expectationBuffer,
    authority.completionReceiptBuffer,
    authority.frozenSourceStateBuffer,
    authority.frozenSourceThermoBuffer,
    authority.frozenSourceMechanicsBuffer,
    authority.sourceStateBuffer,
    authority.sourceThermoBuffer,
    authority.sourceMechanicsBuffer,
    authority.placedDestinationStateBuffer,
    authority.placedDestinationThermoBuffer,
    authority.placedDestinationMechanicsBuffer,
    ...Object.values(buffers)
  ]);
  if (
    events !== buffers.denseEmission
    || summary !== buffers.candidateSummary
    || new Set([publishedEvents, events, publishedSummary, summary]).size !== 4
    || authorityAndArenaBuffers.has(publishedEvents)
    || authorityAndArenaBuffers.has(publishedSummary)
  ) {
    throw placementError(
      'published ledgers must be distinct from the exact arena-owned candidate ledgers and every authority buffer',
      'SOURCE_DESTINATION_ALIAS'
    );
  }
  const termCount = exactPositiveU32(productTermCount, 'productTermCount');
  if (termCount !== arena.productTermCapacity) {
    throw placementError('productTermCount does not match the warm arena', 'IDENTITY');
  }
  const eventCount = arena.eventCapacity;
  const particleCount = arena.particleCapacity;
  const eventStride = arena.eventStrideVec4;
  const {
    eventWorkgroups,
    particleWorkgroups,
    termWorkgroups
  } = planSphReactionProductPlacementDispatchWorkgroups({
    device,
    eventCount,
    particleCount,
    productTermCount: termCount
  });
  const eventByteLength = eventCount * eventStride * 16;
  const summaryByteLength = termCount * 8 * 16;
  requireMinimumBytes(
    publishedEvents,
    eventByteLength,
    'published placement product events'
  );
  requireMinimumBytes(events, eventByteLength, 'candidate placement product events');
  requireMinimumBytes(
    publishedSummary,
    summaryByteLength,
    'published placement summary'
  );
  requireMinimumBytes(summary, summaryByteLength, 'candidate placement summary');
  requireMinimumBytes(control, 32, 'placement control');
  requireMinimumBytes(receipt, SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES, 'placement completion receipt');
  const exactTerminalPreparation = exactCompaction ? prepareExactPlacementTerminalEncoding({
    device, encoder, authority, arenaLease, productEventBuffer: publishedEvents,
    placementSummaryBuffer: publishedSummary, boxDimsM, diagnosticReadbackRequested
  }) : null;
  const dimensions = [0, 1, 2].map((axis) => {
    const value = Number(boxDimsM?.[axis]);
    return Number.isFinite(value) && value > 0 ? value : 0;
  });
  device.queue.writeBuffer(
    buffers.placementParams,
    0,
    exactTerminalPreparation ? Uint32Array.from(exactTerminalPreparation.paramWords) : placementParamsData({
      particleCount,
      eventCount,
      eventStrideVec4: eventStride,
      productTermCount: termCount,
      boxDimsM: dimensions,
      generationId: authority.generationId,
      supportProfileId: authority.supportProfileId,
      diagnosticReadbackRequested
    })
  );
  // The compact event ledger and incoming accumulator remain the published
  // values. All placement mutation happens against these arena-owned copies;
  // the terminal passes below either publish them together or retain/restore
  // the exact pre-placement family.
  if (!exactCompaction) {
    encoder.copyBufferToBuffer(
      publishedEvents,
      0,
      events,
      0,
      eventByteLength
    );
  }
  encoder.copyBufferToBuffer(
    publishedSummary,
    0,
    summary,
    0,
    summaryByteLength
  );
  const destinationRadixPassCount = WEBGPU_RADIX_PASSES_PER_WORD * 3;
  const destinationReducePassCount =
    arena.captureReductionLevelCount + arena.directReductionLevelCount;
  device.queue.writeBuffer(
    receipt,
    SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.destinationRadixPassCount * 4,
    new Uint32Array([
      destinationRadixPassCount,
      destinationReducePassCount,
      0,
      eventCount * 2,
      0,
      0,
      WEBGPU_RADIX_PASSES_PER_WORD,
      arena.summaryReductionLevelCount,
      0,
      0,
      0,
      0
    ])
  );

  const pipelineDescriptors =
    sphReactionProductPlacementSegmentedPipelineDescriptors();
  const pipeline = (descriptor) =>
    explicitPlacementPipeline(device, descriptor);
  const preflight = pipeline(pipelineDescriptors.preflight);
  const plan = pipeline(pipelineDescriptors.plan);
  const eventApply = pipeline(pipelineDescriptors.eventApply);
  const captureInitialize = pipeline(pipelineDescriptors.captureInitialize);
  const captureReduce = pipeline(pipelineDescriptors.captureReduce);
  const captureApply = pipeline(pipelineDescriptors.captureApply);
  const directPlan = pipeline(pipelineDescriptors.directPlan);
  const directInitialize = pipeline(pipelineDescriptors.directInitialize);
  const directReduce = pipeline(pipelineDescriptors.directReduce);
  const directClaimInit = pipeline(
    pipelineDescriptors.directClaimInitialize
  );
  const directClaim = pipeline(pipelineDescriptors.directClaim);
  const directApply = pipeline(pipelineDescriptors.directApply);
  const summaryInitialize = pipeline(pipelineDescriptors.summaryInitialize);
  const summaryReduce = pipeline(pipelineDescriptors.summaryReduce);
  const termInitialize = pipeline(pipelineDescriptors.termInitialize);
  const summaryApply = pipeline(pipelineDescriptors.summaryApply);
  const finalize = pipeline(pipelineDescriptors.finalize);
  const transactionalPublish = exactTerminalPreparation ? null : pipeline(
    pipelineDescriptors.transactionalPublish
  );
  const transactionalAuxiliaryPublish = exactTerminalPreparation ? null : pipeline(
    pipelineDescriptors.transactionalAuxiliaryPublish
  );
  const transactionalTerminal = exactTerminalPreparation ? null : pipeline(
    pipelineDescriptors.transactionalTerminal
  );
  const transactionalDestinationRecovery = exactTerminalPreparation ? null : pipeline(
    pipelineDescriptors.transactionalDestinationRecovery
  );
  const transactionalAuxiliaryMaterialize = exactTerminalPreparation ? null : pipeline(
    pipelineDescriptors.transactionalAuxiliaryMaterialize
  );

  const metadata = {
    generationId: authority.generationId,
    eventCapacity: eventCount,
    particleCount,
    productTermCount: termCount
  };
  let explicitDispatchCount = 0;
  const encode = (pipelineInfo, bindGroup, workgroups, label) => {
    encodePlacementPass({
      encoder,
      pipeline: pipelineInfo.pipeline,
      bindGroup,
      workgroupCount: workgroups,
      label: `ulg-sph-reaction-placement-${label}`,
      producerId: `sph-reaction-summary:product-event-placement:${label}`,
      gpuTimestampRecorder,
      metadata
    });
    explicitDispatchCount += 1;
  };
  const paramsEntry = (binding = 0) => ({
    binding,
    resource: { buffer: buffers.placementParams }
  });
  const reductionEntry = (binding, offset) => ({
    binding,
    resource: { buffer: buffers.reductionParams, offset, size: 16 }
  });
  let captureRadixExecution, captureInput;
  let exactCapturePreparation = null;
  let exactPhysicalPreparation = null;
  let exactEventPreparation = null;
  let exactChemistryPreparation = null;
  if (exactCompaction) {
    // Chemistry reads only the immutable selected packet, routing and staged
    // pair headers. Prepare its private evidence before destination mutation;
    // consumption remains after physical denial coverage below.
    exactChemistryPreparation = encodeExactPlacementChemistryPreparation({device,encoder,authority,arenaLease,gpuTimestampRecorder});
    explicitDispatchCount += exactChemistryPreparation.explicitDispatchCount;
    // All exact writes stay in this family's private destination tuple. The
    // original seal still denies publication until durable history admission.
    exactCapturePreparation = encodeExactPlacementCapturePreparation({
      device, encoder, authority, arenaLease, boxDimsM: dimensions, gpuTimestampRecorder
    });
    captureRadixExecution = exactCapturePreparation.captureRadixExecution;
    captureInput = exactCapturePreparation.captureReducedValuesBuffer;
    explicitDispatchCount += exactCapturePreparation.explicitDispatchCount;
    exactEventPreparation = prepareExactPlacementEventDispositions({device,encoder,authority,arenaLease,gpuTimestampRecorder});
    explicitDispatchCount += exactEventPreparation.explicitDispatchCount;
    exactPhysicalPreparation = encodeExactPlacementCaloricPhysicalPreparation({
      device, encoder, authority, arenaLease, gpuTimestampRecorder
    });
    captureInput = exactPhysicalPreparation.projectedCaptureReducedValuesBuffer;
    explicitDispatchCount += exactPhysicalPreparation.explicitDispatchCount;
    explicitDispatchCount += commitExactPlacementEventDispositions({device,encoder,authority,arenaLease,gpuTimestampRecorder}).explicitDispatchCount;
  } else {
  encode(preflight, placementBindGroup(device, preflight, 'placement-preflight-bind-group', [
    { binding: 0, resource: { buffer: compactCount } },
    { binding: 1, resource: { buffer: control } },
    paramsEntry(2),
    { binding: 3, resource: { buffer: receipt } }
  ]), 1, 'preflight');
  encode(plan, placementBindGroup(device, plan, 'placement-plan-bind-group', [
    { binding: 0, resource: { buffer: events } },
    { binding: 1, resource: { buffer: frozenState } },
    { binding: 2, resource: { buffer: frozenMechanics } },
    { binding: 4, resource: { buffer: decisions } },
    { binding: 5, resource: { buffer: buffers.captureKeys } },
    { binding: 6, resource: { buffer: buffers.captureValues } },
    { binding: 7, resource: { buffer: buffers.eventPlan } },
    { binding: 8, resource: { buffer: control } },
    paramsEntry(9)
  ]), eventWorkgroups, 'plan');
  encode(eventApply, placementBindGroup(device, eventApply, 'placement-event-apply-bind-group', [
    { binding: 0, resource: { buffer: events } },
    { binding: 1, resource: { buffer: state } },
    { binding: 2, resource: { buffer: thermo } },
    { binding: 3, resource: { buffer: mechanics } },
    { binding: 5, resource: { buffer: buffers.eventPlan } },
    { binding: 6, resource: { buffer: buffers.summaryKeys } },
    { binding: 7, resource: { buffer: buffers.summaryValues } },
    { binding: 8, resource: { buffer: receipt } },
    paramsEntry(9)
  ]), eventWorkgroups, 'event-apply');

  const captureRadixSpan = placementTimestampBegin(gpuTimestampRecorder, encoder, {
    producerId: 'sph-reaction-summary:product-event-placement:capture-radix',
    stage: 'capture-radix',
    spanClass: 'same-grouped-production-compute-pass',
    ...metadata
  });
  captureRadixExecution = arenaRecord.captureRadix.encodeSort(encoder, {
    keyBuffer: buffers.captureKeys,
    elementCount: eventCount,
    keyWordCount: 1,
    keyStrideWords: 1,
    significantDigitRows: boundedSentinelRadixDigitRows(particleCount, 1),
    generationId: authority.generationId
  });
  placementTimestampEnd(gpuTimestampRecorder, encoder, captureRadixSpan);
  const captureSorted = captureRadixExecution.sortedIndicesBuffer;
  encode(captureInitialize, placementBindGroup(device, captureInitialize, 'capture-initialize-bind-group', [
    { binding: 0, resource: { buffer: buffers.captureKeys } },
    { binding: 1, resource: { buffer: captureSorted } },
    { binding: 2, resource: { buffer: buffers.captureValues } },
    { binding: 3, resource: { buffer: buffers.captureReduceB } },
    { binding: 4, resource: { buffer: buffers.captureReduceA } },
    reductionEntry(5, arenaRecord.reductionOffsets.capture.initOffset)
  ]), eventWorkgroups, 'capture-initialize');
  captureInput = buffers.captureReduceA;
  let captureOutput = buffers.captureReduceB;
  arenaRecord.reductionOffsets.capture.levelOffsets.forEach((offset, level) => {
    encode(captureReduce, placementBindGroup(device, captureReduce, `capture-reduce-${level}-bind-group`, [
      { binding: 0, resource: { buffer: buffers.captureKeys } },
      { binding: 1, resource: { buffer: captureSorted } },
      { binding: 2, resource: { buffer: buffers.captureValues } },
      { binding: 3, resource: { buffer: captureInput } },
      { binding: 4, resource: { buffer: captureOutput } },
      reductionEntry(5, offset)
    ]), eventWorkgroups, `capture-reduce-${level}`);
    [captureInput, captureOutput] = [captureOutput, captureInput];
  });
  encode(captureApply, placementBindGroup(device, captureApply, 'capture-apply-bind-group', [
    { binding: 0, resource: { buffer: buffers.captureKeys } },
    { binding: 1, resource: { buffer: captureSorted } },
    { binding: 2, resource: { buffer: captureInput } },
    { binding: 3, resource: { buffer: state } },
    { binding: 4, resource: { buffer: thermo } },
    { binding: 5, resource: { buffer: mechanics } },
    { binding: 6, resource: { buffer: buffers.summaryValues } },
    { binding: 7, resource: { buffer: receipt } },
    paramsEntry(8)
  ]), eventWorkgroups, 'capture-apply');

  }

  encode(directPlan, placementBindGroup(device, directPlan, 'direct-plan-bind-group', [
    { binding: 0, resource: { buffer: events } },
    { binding: 1, resource: { buffer: state } },
    { binding: 2, resource: { buffer: thermo } },
    { binding: 3, resource: { buffer: compactCount } },
    { binding: 4, resource: { buffer: buffers.eventPlan } },
    { binding: 5, resource: { buffer: buffers.directKeys } },
    { binding: 6, resource: { buffer: buffers.directValues } },
    { binding: 7, resource: { buffer: receipt } },
    paramsEntry(8)
  ]), eventWorkgroups, 'direct-plan');
  const directRadixSpan = placementTimestampBegin(gpuTimestampRecorder, encoder, {
    producerId: 'sph-reaction-summary:product-event-placement:direct-radix',
    stage: 'direct-radix',
    spanClass: 'same-grouped-production-compute-pass',
    ...metadata
  });
  const directRadixExecution = arenaRecord.directRadix.encodeSort(encoder, {
    keyBuffer: buffers.directKeys,
    elementCount: eventCount,
    keyWordCount: 2,
    keyStrideWords: 2,
    significantDigitRows: boundedSentinelRadixDigitRows(particleCount, 2),
    generationId: authority.generationId
  });
  placementTimestampEnd(gpuTimestampRecorder, encoder, directRadixSpan);
  const directSorted = directRadixExecution.sortedIndicesBuffer;
  encode(directInitialize, placementBindGroup(device, directInitialize, 'direct-initialize-bind-group', [
    { binding: 0, resource: { buffer: buffers.directKeys } },
    { binding: 1, resource: { buffer: directSorted } },
    { binding: 2, resource: { buffer: buffers.directValues } },
    { binding: 3, resource: { buffer: buffers.directReduceB } },
    { binding: 4, resource: { buffer: buffers.directReduceA } },
    reductionEntry(5, arenaRecord.reductionOffsets.direct.initOffset)
  ]), eventWorkgroups, 'direct-initialize');
  let directInput = buffers.directReduceA;
  let directOutput = buffers.directReduceB;
  arenaRecord.reductionOffsets.direct.levelOffsets.forEach((offset, level) => {
    encode(directReduce, placementBindGroup(device, directReduce, `direct-reduce-${level}-bind-group`, [
      { binding: 0, resource: { buffer: buffers.directKeys } },
      { binding: 1, resource: { buffer: directSorted } },
      { binding: 2, resource: { buffer: buffers.directValues } },
      { binding: 3, resource: { buffer: directInput } },
      { binding: 4, resource: { buffer: directOutput } },
      reductionEntry(5, offset)
    ]), eventWorkgroups, `direct-reduce-${level}`);
    [directInput, directOutput] = [directOutput, directInput];
  });
  const directEntries = (pipelineInfo) => placementBindGroup(device, pipelineInfo, `${pipelineInfo.pipeline.label}-bind-group`, [
    { binding: 0, resource: { buffer: buffers.directKeys } },
    { binding: 1, resource: { buffer: directSorted } },
    { binding: 2, resource: { buffer: directInput } },
    { binding: 3, resource: { buffer: state } },
    { binding: 4, resource: { buffer: thermo } },
    { binding: 5, resource: { buffer: mechanics } },
    { binding: 6, resource: { buffer: receipt } },
    { binding: 7, resource: { buffer: buffers.directEndpointClaims } },
    paramsEntry(8)
  ]);
  encode(directClaimInit, directEntries(directClaimInit), particleWorkgroups, 'direct-claim-initialize');
  encode(directClaim, directEntries(directClaim), eventWorkgroups, 'direct-claim');
  encode(directApply, directEntries(directApply), eventWorkgroups, 'direct-apply');

  const summaryRadixSpan = placementTimestampBegin(gpuTimestampRecorder, encoder, {
    producerId: 'sph-reaction-summary:product-event-placement:summary-radix',
    stage: 'summary-radix',
    spanClass: 'same-grouped-production-compute-pass',
    ...metadata
  });
  const summaryRadixExecution = arenaRecord.summaryRadix.encodeSort(encoder, {
    keyBuffer: buffers.summaryKeys,
    elementCount: eventCount,
    keyWordCount: 1,
    keyStrideWords: 1,
    significantDigitRows: boundedSentinelRadixDigitRows(termCount, 1),
    generationId: authority.generationId
  });
  placementTimestampEnd(gpuTimestampRecorder, encoder, summaryRadixSpan);
  const summarySorted = summaryRadixExecution.sortedIndicesBuffer;
  encode(summaryInitialize, placementBindGroup(device, summaryInitialize, 'summary-initialize-bind-group', [
    { binding: 0, resource: { buffer: buffers.summaryKeys } },
    { binding: 1, resource: { buffer: summarySorted } },
    { binding: 2, resource: { buffer: buffers.summaryValues } },
    { binding: 3, resource: { buffer: buffers.summaryReduceB } },
    { binding: 4, resource: { buffer: buffers.summaryReduceA } },
    reductionEntry(5, arenaRecord.reductionOffsets.summary.initOffset)
  ]), eventWorkgroups, 'summary-initialize');
  let summaryInput = buffers.summaryReduceA;
  let summaryOutput = buffers.summaryReduceB;
  arenaRecord.reductionOffsets.summary.levelOffsets.forEach((offset, level) => {
    encode(summaryReduce, placementBindGroup(device, summaryReduce, `summary-reduce-${level}-bind-group`, [
      { binding: 0, resource: { buffer: buffers.summaryKeys } },
      { binding: 1, resource: { buffer: summarySorted } },
      { binding: 2, resource: { buffer: buffers.summaryValues } },
      { binding: 3, resource: { buffer: summaryInput } },
      { binding: 4, resource: { buffer: summaryOutput } },
      reductionEntry(5, offset)
    ]), eventWorkgroups, `summary-reduce-${level}`);
    [summaryInput, summaryOutput] = [summaryOutput, summaryInput];
  });
  const summaryApplyEntries = (pipelineInfo) => placementBindGroup(device, pipelineInfo, `${pipelineInfo.pipeline.label}-bind-group`, [
    { binding: 0, resource: { buffer: buffers.summaryKeys } },
    { binding: 1, resource: { buffer: summarySorted } },
    { binding: 2, resource: { buffer: summaryInput } },
    { binding: 3, resource: { buffer: summary } },
    { binding: 4, resource: { buffer: receipt } },
    paramsEntry(5)
  ]);
  encode(termInitialize, summaryApplyEntries(termInitialize), termWorkgroups, 'term-initialize');
  encode(summaryApply, summaryApplyEntries(summaryApply), eventWorkgroups, 'summary-apply');
  let exactChemistryConsumption=null,exactPhysicalConsumption=null;
  if(exactCompaction){
    explicitDispatchCount += finalizeExactPlacementResidualHistory({device,encoder,authority,arenaLease,gpuTimestampRecorder}).explicitDispatchCount;
    // Parallel P/E denial-only coverage must run before the original core
    // finalizer. Later direct work may legitimately differ from capture S/T/M.
    exactPhysicalConsumption=encodeExactPlacementPhysicalEvidenceConsumption({device,encoder,authority,arenaLease,gpuTimestampRecorder});
    explicitDispatchCount+=exactPhysicalConsumption.explicitDispatchCount;
    exactChemistryConsumption=encodeExactPlacementChemistryConsumption({device,encoder,authority,arenaLease,gpuTimestampRecorder});
    explicitDispatchCount+=exactChemistryConsumption.explicitDispatchCount;
  }
  encode(finalize, placementBindGroup(device, finalize, 'placement-finalize-bind-group', [
    { binding: 0, resource: { buffer: compactCount } },
    { binding: 1, resource: { buffer: control } },
    { binding: 2, resource: { buffer: receipt } },
    paramsEntry(3)
  ]), 1, 'finalize');
  let exactTerminalEncoding = null;
  if (exactTerminalPreparation) {
    // The same terminal selector covers physical rows, exact quantities and
    // residual ledgers. Encoding this tail does not grant publication admission.
    exactTerminalEncoding = encodeExactPlacementTerminal({ device, encoder, authority, arenaLease,
      plan: exactTerminalPreparation, gpuTimestampRecorder });
    explicitDispatchCount += exactTerminalEncoding.encodedDispatchCount;
  } else {
  encode(
    transactionalPublish,
    placementBindGroup(
      device,
      transactionalPublish,
      'placement-transactional-publish-bind-group',
      [
        { binding: 0, resource: { buffer: rollbackState } },
        { binding: 1, resource: { buffer: rollbackThermo } },
        { binding: 2, resource: { buffer: rollbackMechanics } },
        { binding: 3, resource: { buffer: state } },
        { binding: 4, resource: { buffer: thermo } },
        { binding: 5, resource: { buffer: mechanics } },
        { binding: 6, resource: { buffer: receipt } },
        paramsEntry(7)
      ]
    ),
    particleWorkgroups,
    'transactional-publish'
  );
  const transactionalLedgerRowCount = Math.max(
    eventCount * eventStride,
    termCount * 8
  );
  encode(
    transactionalAuxiliaryPublish,
    placementBindGroup(
      device,
      transactionalAuxiliaryPublish,
      'placement-transactional-auxiliary-publish-bind-group',
      [
        { binding: 0, resource: { buffer: events } },
        { binding: 1, resource: { buffer: publishedEvents } },
        { binding: 2, resource: { buffer: summary } },
        { binding: 3, resource: { buffer: publishedSummary } },
        { binding: 4, resource: { buffer: receipt } },
        paramsEntry(5)
      ]
    ),
    Math.max(1, Math.ceil(transactionalLedgerRowCount / 64)),
    'transactional-auxiliary-publish'
  );
  encode(
    transactionalTerminal,
    placementBindGroup(
      device,
      transactionalTerminal,
      'placement-transactional-terminal-bind-group',
      [
        { binding: 0, resource: { buffer: receipt } },
        paramsEntry(1)
      ]
    ),
    1,
    'transactional-terminal'
  );
  encode(
    transactionalDestinationRecovery,
    placementBindGroup(
      device,
      transactionalDestinationRecovery,
      'placement-transactional-destination-recovery-bind-group',
      [
        { binding: 0, resource: { buffer: rollbackState } },
        { binding: 1, resource: { buffer: rollbackThermo } },
        { binding: 2, resource: { buffer: rollbackMechanics } },
        { binding: 3, resource: { buffer: state } },
        { binding: 4, resource: { buffer: thermo } },
        { binding: 5, resource: { buffer: mechanics } },
        { binding: 6, resource: { buffer: receipt } },
        paramsEntry(7)
      ]
    ),
    particleWorkgroups,
    'transactional-destination-recovery'
  );
  encode(
    transactionalAuxiliaryMaterialize,
    placementBindGroup(
      device,
      transactionalAuxiliaryMaterialize,
      'placement-transactional-auxiliary-materialize-bind-group',
      [
        { binding: 0, resource: { buffer: events } },
        { binding: 1, resource: { buffer: publishedEvents } },
        { binding: 2, resource: { buffer: summary } },
        { binding: 3, resource: { buffer: publishedSummary } },
        { binding: 4, resource: { buffer: receipt } },
        paramsEntry(5)
      ]
    ),
    Math.max(1, Math.ceil(transactionalLedgerRowCount / 64)),
    'transactional-auxiliary-materialize'
  );

  }
  if (ledgerReconcile) {
    ledgerReconcile.encode(encoder, {
      events, eventPlan: buffers.eventPlan, compactCount: compactCountBuffer, receipt,
      eventCapacity: Math.floor(events.size / 128),
      rollbackState, rollbackThermo, state, thermo, mechanics
    });
  }

  const scratchBuffers = [...new Set([
    ...Object.values(buffers).filter((buffer) => (
      buffer !== decisions
      && buffer !== control
      && buffer !== receipt
      && buffer !== events
      && buffer !== summary
      && buffer !== buffers.completionReadback
    )),
    ...arenaRecord.captureRadix.allocationEntries().map(({ buffer }) => buffer),
    ...arenaRecord.directRadix.allocationEntries().map(({ buffer }) => buffer),
    ...arenaRecord.summaryRadix.allocationEntries().map(({ buffer }) => buffer)
  ].filter(Boolean))];
  const encodedDispatchCount = explicitDispatchCount
    + captureRadixExecution.encodedDispatchCount
    + directRadixExecution.encodedDispatchCount
    + summaryRadixExecution.encodedDispatchCount;
  const result = {
    schema: 'peercompute.ulg.sph-reaction-product-placement-segmented-encoding.v3',
    status: 'sph-reaction-product-placement-segmented-encoded',
    authority,
    encoder,
    arena,
    arenaLease,
    placementDecisionBuffer: decisions,
    placementControlBuffer: control,
    compactCountBuffer: compactCount,
    productEventBuffer: publishedEvents,
    candidateProductEventBuffer: events,
    placementSummaryBuffer: publishedSummary,
    candidatePlacementSummaryBuffer: summary,
    completionReceiptBuffer: receipt,
    transactionRollbackStateBuffer: rollbackState,
    transactionRollbackThermoBuffer: rollbackThermo,
    transactionRollbackMechanicsBuffer: rollbackMechanics,
    captureRadixExecution,
    directRadixExecution,
    summaryRadixExecution,
    captureReducedValuesBuffer: captureInput,
    ...(exactCapturePreparation ? { exactCapturePreparation } : {}),
    ...(exactPhysicalPreparation ? { exactPhysicalPreparation, exactPhysicalConsumption } : {}),
    ...(exactTerminalEncoding ? { exactTerminalEncoding } : {}),
    ...(exactChemistryPreparation ? {exactChemistryPreparation,exactChemistryConsumption}:{}),
    directReducedValuesBuffer: directInput,
    summaryReducedValuesBuffer: summaryInput,
    scratchBuffers: Object.freeze(scratchBuffers),
    encodedDispatchCount,
    explicitDispatchCount,
    radixDispatchCount: encodedDispatchCount - explicitDispatchCount,
    transactionalPublicationGateEncoded: true,
    transactionalTerminalSealEncoded: true,
    transactionalFailClosedRecoveryEncoded: true,
    transactionalAuxiliaryMaterializationEncoded: true,
    globalSerialEventFoldCount: 0,
    reductionDepth: Object.freeze({
      capture: arena.captureReductionLevelCount,
      direct: arena.directReductionLevelCount,
      summary: arena.summaryReductionLevelCount
    }),
    deterministicApplyMode: SPH_REACTION_PRODUCT_PLACEMENT_LAW.mutationOrder,
    law: SPH_REACTION_PRODUCT_PLACEMENT_LAW
  };
  const segmentedArenaCleanup =
    createSegmentedPlacementQueueOrderedCleanup(
      arenaRecord,
      result
    );
  const segmentedArenaCleanupClaim =
    registerQueueOrderedCleanupClaim(
      segmentedPlacementCleanupClaimIssuer,
      device,
      {
        producerOutput: result,
        cleanup: segmentedArenaCleanup
      }
    );
  segmentedPlacementQueueOrderedCleanupRecords.set(result, {
    claim: segmentedArenaCleanupClaim,
    cleanup: segmentedArenaCleanup
  });
  Object.defineProperty(
    result,
    'segmentedArenaCleanupClaim',
    {
      value: segmentedArenaCleanupClaim,
      enumerable: false
    }
  );
  Object.freeze(result);
  arenaRecord.activeEncoding = result;
  authorityRecord.segmentedEncoding = result;
  return result;
}

function resolvePlacementExpectationAbi(authentication, generation) {
  const directoryAbiVersion = authentication?.directoryAbiVersion;
  const generationAbiVersion = generation?.execution?.abiVersion;
  const directoryV2 =
    directoryAbiVersion === SCHROEDER_SPATIAL_EPOCH_V2_VERSION;
  if (
    directoryAbiVersion !== SCHROEDER_SPATIAL_EPOCH_VERSION
    && !directoryV2
  ) {
    throw placementError(
      `placement does not support directory ABI version ${
        directoryAbiVersion
      }`,
      'UNSUPPORTED_DIRECTORY_ABI'
    );
  }
  if (generationAbiVersion !== directoryAbiVersion) {
    throw placementError(
      'placement authentication/generation directory ABI mismatch',
      'DIRECTORY_ABI_MISMATCH'
    );
  }
  const expectationBufferByteLength = directoryV2
    ? SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V2_UNIFORM_BYTES
    : SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_BYTES;
  if (
    authentication.expectationUniformBytes
      !== expectationBufferByteLength
    || authentication.expectationData?.byteLength
      !== expectationBufferByteLength
  ) {
    throw placementError(
      'placement expectation ABI does not match the directory ABI',
      'EXPECTATION_ABI_MISMATCH'
    );
  }
  return Object.freeze({
    directoryAbiVersion,
    expectationBufferByteLength
  });
}

function expectationBufferForGeneration(
  device,
  generation,
  {
    directoryAbiVersion,
    expectationBufferByteLength
  }
) {
  const arenaIndex = generation?.execution?.arenaIndex;
  if (!Number.isInteger(arenaIndex) || arenaIndex < 0) {
    throw placementError(
      'placement authority requires the canonical generation arena index',
      'IDENTITY'
    );
  }
  let deviceCache = expectationCacheByDevice.get(device);
  if (!deviceCache) {
    deviceCache = new Map();
    expectationCacheByDevice.set(device, deviceCache);
  }
  const arenaKey = `${directoryAbiVersion}:${arenaIndex}`;
  let entry = deviceCache.get(arenaKey) ?? null;
  if (
    entry?.generation
    && entry.generation !== generation
    && entry.generation.execution?.released !== true
  ) {
    throw placementError(
      `placement expectation arena ${arenaIndex} is retained by a live generation`,
      'ARENA_LEASE'
    );
  }
  if (
    entry?.generation
    && entry.generation !== generation
    && entry.generation.execution?.released === true
  ) {
    entry.inFlightAuthority = null;
  }
  let bufferCreationCount = 0;
  if (!entry) {
    const expectationBuffer = tagWebGpuBufferDevice(device.createBuffer({
      label:
        `ulg-schroeder-spatial-reaction-product-placement-expectation-v${
          directoryAbiVersion
        }-arena-${arenaIndex}`,
      size: expectationBufferByteLength,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    }), device);
    entry = {
      arenaKey,
      arenaIndex,
      directoryAbiVersion,
      expectationBufferByteLength,
      expectationBuffer,
      completionReceiptBuffer: null,
      generation: null,
      generationId: null,
      acquisitionCount: 0,
      totalBufferCreationCount: 1,
      inFlightAuthority: null
    };
    deviceCache.set(arenaKey, entry);
    bufferCreationCount = 1;
  }
  if (
    entry.directoryAbiVersion !== directoryAbiVersion
    || entry.expectationBufferByteLength !== expectationBufferByteLength
  ) {
    throw placementError(
      `placement expectation arena ${arenaIndex} ABI identity mismatch`,
      'EXPECTATION_ABI_MISMATCH'
    );
  }
  if (entry.inFlightAuthority) {
    throw placementError(
      `placement expectation arena ${arenaIndex} already has a one-shot authority`,
      'ARENA_LEASE'
    );
  }
  if (!entry.completionReceiptBuffer) {
    entry.completionReceiptBuffer = tagWebGpuBufferDevice(device.createBuffer({
      label:
        `ulg-schroeder-spatial-reaction-product-placement-completion-receipt-v${
          directoryAbiVersion
        }-arena-${arenaIndex}`,
      size: SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES,
      usage:
        GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST
    }), device);
    entry.totalBufferCreationCount += 1;
    bufferCreationCount += 1;
  }
  entry.generation = generation;
  entry.generationId = generation.execution.generationId;
  entry.acquisitionCount += 1;
  return { entry, bufferCreationCount };
}

/**
 * Authenticate the shared canonical directory together with its exact
 * position-authority state, the displacement-certified frozen placement
 * source, and a distinct mutable destination family.
 */
export function createSchroederSpatialReactionProductPlacementAuthorityWebGpu({
  device,
  placementSourceFamily,
  particleCount = placementSourceFamily?.particleCount,
  productEventCapacity,
  sourceStateBuffer,
  sourceThermoBuffer,
  sourceMechanicsBuffer,
  // G2 integer energy ledger: its reconcile stage is the exact-inventory
  // authority; the placement itself stays the f32 law.
  ledgerReconcile = null
} = {}) {
  const ledgerAdmitted = isSphExactReactionLedgerReconcileStage(ledgerReconcile);
  // Raw exact buffers cannot enter this factory through the legacy path.
  // Only an original family can proceed to the private exact-owner checks.
  if (!ledgerAdmitted && !isSchroederSpatialReactionPlacementSourceFamily(placementSourceFamily)) {
    assertSphLegacyMassPathAllowed({ sourceStateBuffer, sourceThermoBuffer }, 'Product placement source');
  }
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('reaction product placement authority requires a WebGPU-like device');
  }
  const resolvedParticleCount = exactPositiveU32(particleCount, 'particleCount');
  const resolvedEventCapacity = exactPositiveU32(
    productEventCapacity,
    'productEventCapacity'
  );
  const resolvedPlacementSourceFamily =
    resolveSchroederSpatialReactionPlacementSourceFamily(
      placementSourceFamily,
      { device }
    );
  const exactQuantityContext = capturePlacementExactQuantityContext(
    resolvedPlacementSourceFamily, device, resolvedParticleCount, resolvedEventCapacity
  );
  if (!exactQuantityContext && !ledgerAdmitted) {
    assertSphLegacyMassPathAllowed({ sourceStateBuffer, sourceThermoBuffer }, 'Product placement source');
  }
  const exactQuantityBindings = exactQuantityContext?.bindings ?? {};
  const generation = resolvedPlacementSourceFamily.generation;
  if (generation?.source?.sourceCount !== resolvedParticleCount) {
    throw placementError(
      'placement particle count does not match the canonical generation',
      'IDENTITY'
    );
  }
  // The retained level-assignment producer predates universal eager buffer
  // tagging. The placement-family brand and its WeakMap record have already
  // authenticated this exact canonical directory source on this device.
  const canonicalSourceBuffer = requireBuffer(
    device,
    tagWebGpuBufferDevice(
      resolvedPlacementSourceFamily.directorySourceBuffer,
      device
    ),
    'shared placement directory source buffer'
  );
  const directoryPositionAuthorityStateBuffer = requireBuffer(
    device,
    resolvedPlacementSourceFamily.directoryPositionAuthorityStateBuffer,
    'shared placement directory position-authority state'
  );
  const frozenSourceStateBuffer = requireBuffer(
    device,
    resolvedPlacementSourceFamily.frozenSourceStateBuffer,
    'frozen post-reaction placement source state'
  );
  if (
    generation?.source?.sourceBuffer !== canonicalSourceBuffer
    || generation?.source?.sourceStateBuffer
      !== directoryPositionAuthorityStateBuffer
    || generation?.execution?.directoryBuffer
      !== resolvedPlacementSourceFamily.directoryBuffer
    || resolvedPlacementSourceFamily.stageIdentity
      !== 'post-reaction-pre-placement'
  ) {
    throw placementError(
      'placement authority requires the exact shared directory and displacement-certified placement family',
      'IDENTITY'
    );
  }
  const resolvedSourceStateBuffer = requireBuffer(
    device,
    sourceStateBuffer,
    'placement sourceStateBuffer'
  );
  const resolvedSourceThermoBuffer = requireBuffer(
    device,
    sourceThermoBuffer,
    'placement sourceThermoBuffer'
  );
  const resolvedSourceMechanicsBuffer = requireBuffer(
    device,
    sourceMechanicsBuffer,
    'placement sourceMechanicsBuffer'
  );
  if (
    resolvedSourceStateBuffer
      !== resolvedPlacementSourceFamily.transactionRollbackStateBuffer
    || resolvedSourceThermoBuffer
      !== resolvedPlacementSourceFamily.transactionRollbackThermoBuffer
    || resolvedSourceMechanicsBuffer
      !== resolvedPlacementSourceFamily.transactionRollbackMechanicsBuffer
  ) {
    throw placementError(
      'placement rollback inputs must be the exact pre-reaction family authenticated by the placement epoch',
      'IDENTITY'
    );
  }
  const frozenSourceThermoBuffer = requireBuffer(
    device,
    resolvedPlacementSourceFamily.frozenSourceThermoBuffer,
    'frozen post-reaction placement source thermo'
  );
  const frozenSourceMechanicsBuffer = requireBuffer(
    device,
    resolvedPlacementSourceFamily.frozenSourceMechanicsBuffer,
    'frozen post-reaction placement source mechanics'
  );
  const placedDestinationStateBuffer = requireBuffer(
    device,
    resolvedPlacementSourceFamily.placedDestinationStateBuffer,
    'placed destination state'
  );
  const placedDestinationThermoBuffer = requireBuffer(
    device,
    resolvedPlacementSourceFamily.placedDestinationThermoBuffer,
    'placed destination thermo'
  );
  const placedDestinationMechanicsBuffer = requireBuffer(
    device,
    resolvedPlacementSourceFamily.placedDestinationMechanicsBuffer,
    'placed destination mechanics'
  );
  const stateBytes = resolvedParticleCount * 8 * Float32Array.BYTES_PER_ELEMENT;
  const thermoBytes = resolvedParticleCount * 12 * Float32Array.BYTES_PER_ELEMENT;
  const mechanicsBytes = resolvedParticleCount * 32 * Float32Array.BYTES_PER_ELEMENT;
  requireMinimumBytes(frozenSourceStateBuffer, stateBytes, 'frozen placement source state');
  requireMinimumBytes(resolvedSourceStateBuffer, stateBytes, 'placement source state');
  requireMinimumBytes(resolvedSourceThermoBuffer, thermoBytes, 'placement source thermo');
  requireMinimumBytes(
    resolvedSourceMechanicsBuffer,
    mechanicsBytes,
    'placement source mechanics'
  );
  requireMinimumBytes(frozenSourceThermoBuffer, thermoBytes, 'frozen placement source thermo');
  requireMinimumBytes(frozenSourceMechanicsBuffer, mechanicsBytes, 'frozen placement source mechanics');
  requireMinimumBytes(placedDestinationStateBuffer, stateBytes, 'placed destination state');
  requireMinimumBytes(placedDestinationThermoBuffer, thermoBytes, 'placed destination thermo');
  requireMinimumBytes(
    placedDestinationMechanicsBuffer,
    mechanicsBytes,
    'placed destination mechanics'
  );
  const frozenSources = new Set([
    frozenSourceStateBuffer,
    frozenSourceThermoBuffer,
    frozenSourceMechanicsBuffer
  ]);
  const transactionRollbackSources = [
    resolvedSourceStateBuffer,
    resolvedSourceThermoBuffer,
    resolvedSourceMechanicsBuffer
  ];
  const placedDestinations = [
    placedDestinationStateBuffer,
    placedDestinationThermoBuffer,
    placedDestinationMechanicsBuffer
  ];
  if (
    placedDestinations.some((buffer) => frozenSources.has(buffer))
    || placedDestinations.some((buffer) => (
      transactionRollbackSources.includes(buffer)
    ))
    || transactionRollbackSources.some((buffer) => frozenSources.has(buffer))
    || new Set(transactionRollbackSources).size
      !== transactionRollbackSources.length
    || new Set(placedDestinations).size !== placedDestinations.length
  ) {
    throw placementError(
      'frozen placement, pre-reaction rollback, and mutable destination families must be exact and non-aliasing',
      'SOURCE_DESTINATION_ALIAS'
    );
  }

  const authentication = resolveSchroederSpatialExactNearConsumerGeneration(
    generation,
    {
      device,
      runtime: generation.runtime,
      consumerId: SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_CONSUMER_ID,
      supportProfileId:
        SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_PRODUCT_PLACEMENT_V1,
      sourceBuffer: canonicalSourceBuffer,
      expected: {
        generationId: generation.execution?.generationId,
        sourceCount: resolvedParticleCount,
        storageGeneration: generation.execution?.storageGeneration,
        physicsTick: generation.execution?.physicsTick,
        physicsSubstep: generation.execution?.physicsSubstep,
        positionEpoch: generation.execution?.positionEpoch,
        topologyEpoch: generation.execution?.topologyEpoch,
        supportEpoch: generation.execution?.supportEpoch
      }
    }
  );
  if (authentication?.admitted !== true || authentication.authenticated !== true) {
    throw placementError(
      authentication?.reason
        || 'placement could not authenticate the canonical generation',
      'AUTHENTICATION'
    );
  }
  if (
    authentication.generation !== generation
    || authentication.directoryBuffer !== generation.execution.directoryBuffer
    || authentication.sourceBuffer !== canonicalSourceBuffer
  ) {
    throw placementError(
      'placement authentication does not identify the exact selected generation',
      'IDENTITY'
    );
  }

  const expectationAbi = resolvePlacementExpectationAbi(
    authentication,
    generation
  );
  const expectation = expectationBufferForGeneration(device, generation, {
    directoryAbiVersion: expectationAbi.directoryAbiVersion,
    expectationBufferByteLength:
      expectationAbi.expectationBufferByteLength
  });
  exactQuantityContext?.validate();
  device.queue.writeBuffer(
    expectation.entry.expectationBuffer,
    0,
    authentication.expectationData
  );
  device.queue.writeBuffer(
    expectation.entry.completionReceiptBuffer,
    0,
    new Uint32Array(SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES / 4)
  );
  exactQuantityContext?.validate();
  const authority = Object.freeze({
    schema:
      ULG_SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_AUTHORITY_SCHEMA,
    status: 'schroeder-spatial-reaction-product-placement-authority-authenticated',
    ready: true,
    admitted: true,
    authenticated: true,
    consumerId: SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_CONSUMER_ID,
    phase: SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_PHASE,
    artifactFamily:
      SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_ARTIFACT_FAMILY,
    supportProfileId:
      SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_PRODUCT_PLACEMENT_V1,
    deviceId: webGpuDeviceId(device),
    generation,
    generationId: authentication.generationId,
    directoryAbiVersion: expectationAbi.directoryAbiVersion,
    expectationBufferByteLength:
      expectationAbi.expectationBufferByteLength,
    epochIdentity: authentication.epochIdentity,
    directoryEpochIdentity:
      resolvedPlacementSourceFamily.directoryEpochIdentity,
    queryStateEpochIdentity:
      resolvedPlacementSourceFamily.queryStateEpochIdentity,
    particleCount: resolvedParticleCount,
    productEventCapacity: resolvedEventCapacity,
    placementSourceFamily: resolvedPlacementSourceFamily,
    stageIdentity: resolvedPlacementSourceFamily.stageIdentity,
    directoryBuffer: authentication.directoryBuffer,
    directoryPositionAuthorityStateBuffer,
    expectationBuffer: expectation.entry.expectationBuffer,
    completionReceiptBuffer: expectation.entry.completionReceiptBuffer,
    frozenSourceStateBuffer,
    frozenSourceThermoBuffer,
    frozenSourceMechanicsBuffer,
    sourceStateBuffer: resolvedSourceStateBuffer,
    sourceThermoBuffer: resolvedSourceThermoBuffer,
    sourceMechanicsBuffer: resolvedSourceMechanicsBuffer,
    placedDestinationStateBuffer,
    placedDestinationThermoBuffer,
    placedDestinationMechanicsBuffer,
    ...exactQuantityBindings,
    spatialArenaIndex: expectation.entry.arenaIndex,
    arenaAcquisitionOrdinal: expectation.entry.acquisitionCount,
    bufferCreationCount: expectation.bufferCreationCount,
    authentication
  });
  const authorityRecord = {
    device,
    generation,
    placementSourceFamily: resolvedPlacementSourceFamily,
    exactQuantityContext,
    authentication,
    directoryAbiVersion: expectationAbi.directoryAbiVersion,
    expectationBufferByteLength:
      expectationAbi.expectationBufferByteLength,
    expectationEntry: expectation.entry,
    bindings: Object.freeze({
      directoryBuffer: authentication.directoryBuffer,
      directoryPositionAuthorityStateBuffer,
      expectationBuffer: expectation.entry.expectationBuffer,
      completionReceiptBuffer: expectation.entry.completionReceiptBuffer,
      frozenSourceStateBuffer,
      frozenSourceThermoBuffer,
      frozenSourceMechanicsBuffer,
      sourceStateBuffer: resolvedSourceStateBuffer,
      sourceThermoBuffer: resolvedSourceThermoBuffer,
      sourceMechanicsBuffer: resolvedSourceMechanicsBuffer,
      placedDestinationStateBuffer,
      placedDestinationThermoBuffer,
      placedDestinationMechanicsBuffer,
      ...exactQuantityBindings
    }),
    finalizedArtifact: null,
    segmentedEncoding: null,
    encodedPlacement: null,
    submittedArtifact: null,
    deviceLost: false,
    deviceLossStatus: 'device-loss-quarantine-unarmed',
    deviceLossReason: null
  };
  authorityRecords.set(authority, authorityRecord);
  expectation.entry.inFlightAuthority = authority;
  armPlacementAuthorityDeviceLoss(authorityRecord);
  return authority;
}

export function resolveSchroederSpatialReactionProductPlacementAuthority(
  authority,
  {
    device,
    generation,
    particleCount,
    productEventCapacity,
    sourceStateBuffer,
    sourceThermoBuffer,
    sourceMechanicsBuffer,
    placedDestinationStateBuffer,
    placedDestinationThermoBuffer,
    placedDestinationMechanicsBuffer
  } = {}
) {
  const record = requireLivePlacementAuthority(authority, {
    device,
    operation: 'placement authority resolution'
  });
  const bindings = record?.bindings;
  if (
    authority?.schema
      !== ULG_SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_AUTHORITY_SCHEMA
    || !Object.isFrozen(authority)
    || authority.generation !== generation
    || record.generation !== generation
    || authority.directoryAbiVersion !== record.directoryAbiVersion
    || authority.directoryAbiVersion !== record.authentication.directoryAbiVersion
    || authority.directoryAbiVersion !== generation?.execution?.abiVersion
    || authority.expectationBufferByteLength
      !== record.expectationBufferByteLength
    || authority.expectationBufferByteLength
      !== record.authentication.expectationUniformBytes
    || record.authentication.expectationData?.byteLength
      !== record.expectationBufferByteLength
    || generation?.execution?.released === true
    || generation?.releaseScheduled === true
    || record.device !== device
    || authority.deviceId !== webGpuDeviceId(device)
    || authority.particleCount !== particleCount
    || authority.productEventCapacity !== productEventCapacity
    || authority.placementSourceFamily !== record.placementSourceFamily
    || authority.directoryEpochIdentity
      !== record.placementSourceFamily.directoryEpochIdentity
    || authority.queryStateEpochIdentity
      !== record.placementSourceFamily.queryStateEpochIdentity
    || resolveSchroederSpatialReactionPlacementSourceFamily(
      record.placementSourceFamily,
      { device }
    ) !== record.placementSourceFamily
    || bindings.directoryBuffer !== generation?.execution?.directoryBuffer
    || authority.completionReceiptBuffer !== bindings.completionReceiptBuffer
    || webGpuBufferDevice(bindings.completionReceiptBuffer) !== device
    || bindings.directoryPositionAuthorityStateBuffer
      !== generation?.source?.sourceStateBuffer
    || bindings.directoryPositionAuthorityStateBuffer
      !== record.placementSourceFamily.directoryPositionAuthorityStateBuffer
    || bindings.frozenSourceStateBuffer
      !== record.placementSourceFamily.frozenSourceStateBuffer
    || bindings.frozenSourceThermoBuffer
      !== record.placementSourceFamily.frozenSourceThermoBuffer
    || bindings.frozenSourceMechanicsBuffer
      !== record.placementSourceFamily.frozenSourceMechanicsBuffer
    || bindings.sourceStateBuffer !== sourceStateBuffer
    || bindings.sourceThermoBuffer !== sourceThermoBuffer
    || bindings.sourceMechanicsBuffer !== sourceMechanicsBuffer
    || bindings.placedDestinationStateBuffer !== placedDestinationStateBuffer
    || bindings.placedDestinationThermoBuffer !== placedDestinationThermoBuffer
    || bindings.placedDestinationMechanicsBuffer !== placedDestinationMechanicsBuffer
  ) {
    throw placementError(
      'placement authority does not identify the exact generation and buffer family',
      'IDENTITY'
    );
  }
  return Object.freeze({
    admitted: true,
    authority,
    generation,
    authentication: record.authentication,
    directoryAbiVersion: record.directoryAbiVersion,
    expectationBufferByteLength: record.expectationBufferByteLength,
    ...bindings
  });
}

/**
 * Seal the exact encoder and buffer family after the production placement
 * chain has been encoded.  The seal is deliberately one-shot and runtime
 * branded; the submission function below is the only path that consumes it.
 */
export function sealSchroederSpatialReactionProductPlacementEncoding(
  authority,
  {
    segmentedEncoding,
    completionReadbackBuffer = null
  } = {}
) {
  const record = requireLivePlacementAuthority(authority, {
    operation: 'placement encoding seal'
  });
  // Exact placement uses the same one-shot submission and destination owner.
  // Its complete selected quantity/mass/residual tuple is checked below by
  // validateExactPlacementTerminalEncoding before that owner can transfer.
  // A placement seal alone does not authorize enclosing mechanics publication.
  if (
    record.encodingSealAttempted
    || record.encodedPlacement
    || record.submittedArtifact
  ) {
    throw placementError('placement authority already has a one-shot encoding seal', 'SUBMISSION');
  }
  const genuine = record.segmentedEncoding;
  const arenaRecord = segmentedPlacementArenaRecords.get(genuine?.arena);
  if (
    !genuine
    || segmentedEncoding !== genuine
    || genuine.schema
      !== 'peercompute.ulg.sph-reaction-product-placement-segmented-encoding.v3'
    || genuine.authority !== authority
    || genuine.arenaLease?.authority !== authority
    || !arenaRecord
    || arenaRecord.activeEncoding !== genuine
    || genuine.transactionalPublicationGateEncoded !== true
    || genuine.transactionalTerminalSealEncoded !== true
    || genuine.transactionalFailClosedRecoveryEncoded !== true
    || genuine.transactionalAuxiliaryMaterializationEncoded !== true
  ) {
    throw placementError(
      'placement seal requires the exact runtime-recorded segmented chain with its terminal transaction protocol',
      'SUBMISSION'
    );
  }
  const exactTerminalEncoding = validateExactPlacementTerminalEncoding(record, genuine);
  const encoder = genuine.encoder;
  if (!encoder?.finish || !encoder?.copyBufferToBuffer) {
    throw placementError('placement encoding requires a live command encoder', 'SUBMISSION');
  }
  const placementDecisionBuffer = genuine.placementDecisionBuffer;
  const placementControlBuffer = genuine.placementControlBuffer;
  const productEventBuffer = genuine.productEventBuffer;
  const candidateProductEventBuffer = genuine.candidateProductEventBuffer;
  const placementSummaryBuffer = genuine.placementSummaryBuffer;
  const candidatePlacementSummaryBuffer = genuine.candidatePlacementSummaryBuffer;
  const scratchBuffers = genuine.scratchBuffers;
  const encodedDispatchCount = genuine.encodedDispatchCount;
  const deterministicApplyMode = genuine.deterministicApplyMode;
  const decision = requireBuffer(
    record.device,
    placementDecisionBuffer,
    'placement decision evidence'
  );
  const control = requireBuffer(
    record.device,
    placementControlBuffer,
    'placement control evidence'
  );
  const publishedEvents = requireBuffer(
    record.device,
    productEventBuffer,
    'published placement product-event evidence'
  );
  const candidateEvents = requireBuffer(
    record.device,
    candidateProductEventBuffer,
    'candidate placement product-event evidence'
  );
  const publishedSummary = requireBuffer(
    record.device,
    placementSummaryBuffer,
    'published placement summary evidence'
  );
  const candidateSummary = requireBuffer(
    record.device,
    candidatePlacementSummaryBuffer,
    'candidate placement summary evidence'
  );
  const completionReceipt = requireBuffer(
    record.device,
    genuine.completionReceiptBuffer,
    'placement completion receipt'
  );
  const exactEvidenceBuffers = [
    decision,
    control,
    publishedEvents,
    candidateEvents,
    publishedSummary,
    candidateSummary,
    completionReceipt
  ];
  if (
    new Set(exactEvidenceBuffers).size !== exactEvidenceBuffers.length
    || candidateEvents !== genuine.arena.buffers.denseEmission
    || candidateSummary !== genuine.arena.buffers.candidateSummary
    || completionReceipt !== record.bindings.completionReceiptBuffer
  ) {
    throw placementError(
      'placement decisions, published ledgers, candidate ledgers, and completion evidence must be exact distinct buffers',
      'SOURCE_DESTINATION_ALIAS'
    );
  }
  requireMinimumBytes(
    decision,
    authority.productEventCapacity * 4 * Float32Array.BYTES_PER_ELEMENT,
    'placement decision evidence'
  );
  requireMinimumBytes(control, 32, 'placement control evidence');
  requireMinimumBytes(
    publishedEvents,
    genuine.arena.eventCapacity * genuine.arena.eventStrideVec4 * 16,
    'published placement product-event evidence'
  );
  requireMinimumBytes(
    candidateEvents,
    genuine.arena.eventCapacity * genuine.arena.eventStrideVec4 * 16,
    'candidate placement product-event evidence'
  );
  requireMinimumBytes(
    publishedSummary,
    genuine.arena.productTermCapacity * 8 * 16,
    'published placement summary evidence'
  );
  requireMinimumBytes(
    candidateSummary,
    genuine.arena.productTermCapacity * 8 * 16,
    'candidate placement summary evidence'
  );
  const resolvedDispatchCount = exactPositiveU32(
    encodedDispatchCount,
    'encodedDispatchCount'
  );
  const forbiddenAliases = new Set([
    record.bindings.directoryBuffer,
    record.bindings.directoryPositionAuthorityStateBuffer,
    record.bindings.expectationBuffer,
    record.bindings.frozenSourceStateBuffer,
    record.bindings.frozenSourceThermoBuffer,
    record.bindings.frozenSourceMechanicsBuffer,
    record.bindings.sourceStateBuffer,
    record.bindings.sourceThermoBuffer,
    record.bindings.sourceMechanicsBuffer,
    record.bindings.placedDestinationStateBuffer,
    record.bindings.placedDestinationThermoBuffer,
    record.bindings.placedDestinationMechanicsBuffer,
    ...exactEvidenceBuffers,
    ...Object.values(record.exactQuantityContext?.bindings ?? {}).filter(value => value && Number.isSafeInteger(value.size))
  ]);
  const exactScratchBuffers = [];
  for (const [index, buffer] of [...scratchBuffers].entries()) {
    const resolved = requireBuffer(
      record.device,
      buffer,
      `placement scratch buffer ${index}`
    );
    if (forbiddenAliases.has(resolved) || exactScratchBuffers.includes(resolved)) {
      throw placementError(
        'placement scratch buffers must be distinct from sources, destinations, evidence, and each other',
        'SOURCE_DESTINATION_ALIAS'
      );
    }
    exactScratchBuffers.push(resolved);
  }
  const readback = completionReadbackBuffer == null
    ? null
    : requireBuffer(
        record.device,
        completionReadbackBuffer,
        'placement completion diagnostic readback'
      );
  if (readback) {
    requireMinimumBytes(
      readback,
      SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES,
      'placement completion diagnostic readback'
    );
    if (
      typeof readback.mapAsync !== 'function'
      || typeof readback.getMappedRange !== 'function'
    || typeof readback.unmap !== 'function'
      || forbiddenAliases.has(readback)
      || exactScratchBuffers.includes(readback)
    ) {
      throw placementError(
        'placement completion diagnostic readback must be an exact distinct map-readable buffer',
        'OBSERVATION'
      );
    }
  }
  validateExactPlacementTerminalEncoding(record, genuine);
  record.encodingSealAttempted = true;
  // The seal owns both the host-observation decision and the exact receipt
  // copy. No command can be appended after the command buffer is minted.
  record.device.queue.writeBuffer(
    completionReceipt,
    SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.hostCompletionReadbackCount * 4,
    new Uint32Array([readback ? 1 : 0])
  );
  if (readback) {
    encoder.copyBufferToBuffer(
      completionReceipt,
      0,
      readback,
      0,
      SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES
    );
  }
  let commandBuffer;
  try {
    commandBuffer = encoder.finish();
  } catch (error) {
    record.encodingSealFailed = true;
    throw error;
  }
  const encoding = Object.freeze({
    schema: 'peercompute.ulg.schroeder-spatial-reaction-product-placement-encoding.v3',
    status: 'schroeder-spatial-reaction-product-placement-encoding-sealed',
    authority,
    commandBuffer,
    placementDecisionBuffer: decision,
    placementControlBuffer: control,
    productEventBuffer: publishedEvents,
    candidateProductEventBuffer: candidateEvents,
    placementSummaryBuffer: publishedSummary,
    candidatePlacementSummaryBuffer: candidateSummary,
    completionReceiptBuffer: completionReceipt,
    transactionRollbackStateBuffer:
      genuine.transactionRollbackStateBuffer,
    transactionRollbackThermoBuffer:
      genuine.transactionRollbackThermoBuffer,
    transactionRollbackMechanicsBuffer:
      genuine.transactionRollbackMechanicsBuffer,
    completionReadbackBuffer: readback,
    diagnosticReadbackRequested: Boolean(readback),
    scratchBuffers: Object.freeze(exactScratchBuffers),
    encodedDispatchCount: resolvedDispatchCount,
    transactionalPublicationGateEncoded: true,
    transactionalTerminalSealEncoded: true,
    transactionalFailClosedRecoveryEncoded: true,
    transactionalAuxiliaryMaterializationEncoded: true,
    ...(exactTerminalEncoding ? { exactTerminalEncoding, ...exactTerminalEncoding.plan.exactBindings } : {}),
    segmentedEncoding: genuine,
    deterministicApplyMode
  });
  encodedPlacementRecords.set(encoding, {
    authority,
    record,
    encoder,
    commandBuffer,
    readback,
    exactTerminalEncoding,
    submitted: false,
    submissionAttempted: false
  });
  record.encodedPlacement = encoding;
  return encoding;
}

/**
 * Submit the exact command buffer already minted by the one-shot seal. Normal
 * simulation uses the returned GPU-resident artifact without mapping a
 * receipt. Diagnostic readback identity and copy encoding are owned by seal.
 */
export function submitSchroederSpatialReactionProductPlacementWebGpu({
  authority,
  encoding,
  completionReadbackBuffer,
  queueOrderedProducerClaims = []
} = {}) {
  if (completionReadbackBuffer !== undefined) {
    throw placementError(
      'placement diagnostic readback must be selected while sealing, before command-buffer finalization',
      'SUBMISSION'
    );
  }
  const record = requireLivePlacementAuthority(authority, {
    operation: 'placement submission'
  });
  const encodingRecord = encodedPlacementRecords.get(encoding);
  if (
    !encodingRecord
    || encodingRecord.authority !== authority
    || encodingRecord.record !== record
    || record.encodedPlacement !== encoding
    || record.submittedArtifact
    || encodingRecord.submitted
    || encodingRecord.submissionAttempted
    || encodingRecord.commandBuffer !== encoding.commandBuffer
  ) {
    throw placementError(
      'placement submission requires the exact unused runtime encoding seal',
      'SUBMISSION'
    );
  }
  const exactTerminalEncoding = validateExactPlacementTerminalEncoding(record, encoding.segmentedEncoding);
  if (encodingRecord.exactTerminalEncoding !== exactTerminalEncoding
      || encoding.exactTerminalEncoding !== (exactTerminalEncoding ?? undefined)
      || (exactTerminalEncoding && Object.entries(exactTerminalEncoding.plan.exactBindings)
        .some(([key,value]) => encoding[key] !== value))) {
    throw placementError('placement submission changed its exact terminal witness', 'EXACT_TERMINAL_IDENTITY');
  }
  const readback = encodingRecord.readback;
  const commandBuffer = encodingRecord.commandBuffer;
  const segmentedEncoding = encoding.segmentedEncoding;
  const segmentedCleanupRecord =
    segmentedPlacementQueueOrderedCleanupRecords.get(
      segmentedEncoding
    );
  const exactProducerClaims = [
    record.placementSourceFamily?.queueOrderedCleanupClaim,
    segmentedEncoding?.segmentedArenaCleanupClaim,
    ...(Array.isArray(queueOrderedProducerClaims)
      ? queueOrderedProducerClaims
      : [])
  ].filter(Boolean);
  encodingRecord.submissionAttempted = true;
  let queueOrderedFinalConsumerCapability = null;
  try {
    if (
      exactProducerClaims.length > 0
    ) {
      queueOrderedFinalConsumerCapability =
        submitQueueOrderedFinalConsumerWork(
          record.device,
          [commandBuffer],
          {
            finalConsumerOwner: authority,
            producerClaims: exactProducerClaims
          }
        );
    } else {
      record.device.queue.submit([commandBuffer]);
    }
    encodingRecord.submitted = true;
  } catch (error) {
    record.submissionFailed = true;
    if (segmentedCleanupRecord) {
      try {
        cancelQueueOrderedCleanupClaim(
          segmentedCleanupRecord.claim,
          record.device,
          {
            producerOutput: segmentedEncoding,
            cleanup: segmentedCleanupRecord.cleanup
          }
        );
      } catch {
        // External claims remain with their exact producers for fenced
        // submission-failure cleanup.
      }
    }
    throw error;
  }
  const artifact = {
    schema:
      'peercompute.ulg.schroeder-spatial-reaction-product-placement-submission-artifact.v3',
    status: 'schroeder-spatial-reaction-product-placement-gpu-resident-submitted',
    ready: true,
    admitted: true,
    authenticated: false,
    gpuAuthenticated: false,
    submissionAuthenticated: true,
    destinationSafetyAuthenticated: true,
    placementOutcomeObserved: false,
    gpuResident: true,
    submitPerformed: true,
    positionMayChange: true,
    topologyMayChange: true,
    authority,
    generation: record.generation,
    generationId: authority.generationId,
    directoryAbiVersion: record.directoryAbiVersion,
    expectationBufferByteLength: record.expectationBufferByteLength,
    epochIdentity: authority.epochIdentity,
    directoryEpochIdentity: authority.directoryEpochIdentity,
    queryStateEpochIdentity: authority.queryStateEpochIdentity,
    placementSourceFamily: record.placementSourceFamily,
    stageIdentity: authority.stageIdentity,
    frozenSourceStateBuffer: record.bindings.frozenSourceStateBuffer,
    frozenSourceThermoBuffer: record.bindings.frozenSourceThermoBuffer,
    frozenSourceMechanicsBuffer: record.bindings.frozenSourceMechanicsBuffer,
    transactionRollbackStateBuffer: record.bindings.sourceStateBuffer,
    transactionRollbackThermoBuffer: record.bindings.sourceThermoBuffer,
    transactionRollbackMechanicsBuffer:
      record.bindings.sourceMechanicsBuffer,
    placedDestinationStateBuffer: record.bindings.placedDestinationStateBuffer,
    placedDestinationThermoBuffer: record.bindings.placedDestinationThermoBuffer,
    placedDestinationMechanicsBuffer: record.bindings.placedDestinationMechanicsBuffer,
    placementDecisionBuffer: encoding.placementDecisionBuffer,
    placementControlBuffer: encoding.placementControlBuffer,
    productEventBuffer: encoding.productEventBuffer,
    candidateProductEventBuffer: encoding.candidateProductEventBuffer,
    placementSummaryBuffer: encoding.placementSummaryBuffer,
    candidatePlacementSummaryBuffer: encoding.candidatePlacementSummaryBuffer,
    ...(exactTerminalEncoding ? { exactTerminalEncoding, ...exactTerminalEncoding.plan.exactBindings } : {}),
    completionReceiptBuffer: record.bindings.completionReceiptBuffer,
    completionReadbackBuffer: readback,
    diagnosticReadbackRequested: Boolean(readback),
    encodedDispatchCount: encoding.encodedDispatchCount,
    transactionalPublicationGateEncoded:
      encoding.transactionalPublicationGateEncoded,
    transactionalTerminalSealEncoded:
      encoding.transactionalTerminalSealEncoded,
    transactionalFailClosedRecoveryEncoded:
      encoding.transactionalFailClosedRecoveryEncoded,
    transactionalAuxiliaryMaterializationEncoded:
      encoding.transactionalAuxiliaryMaterializationEncoded,
    destinationPublicationMode:
      'gpu-terminal-safe-placed-or-exact-pre-reaction-fallback',
    deterministicApplyMode: encoding.deterministicApplyMode,
    queueFenceStatus: 'same-queue-submission-order',
    queueOrderedReleaseAuthorized: true,
    arenaReuseAllowed: true,
    hostQueueFenceCount: 0,
    queueCompletionMethod: 'same-gpu-queue-submission-order',
    queueFence: null
  };
  if (queueOrderedFinalConsumerCapability) {
    Object.defineProperty(
      artifact,
      'queueOrderedFinalConsumerCapability',
      {
        value: queueOrderedFinalConsumerCapability,
        enumerable: false
      }
    );
  }
  Object.freeze(artifact);
  submittedPlacementArtifactRecords.set(artifact, {
    authority,
    record,
    encoding,
    readback,
    commandBuffer
  });
  submittedPlacementArtifacts.add(artifact);
  record.submittedArtifact = artifact;
  return artifact;
}

export function isSubmittedSchroederSpatialReactionProductPlacementArtifact(
  artifact
) {
  const record = submittedPlacementArtifactRecords.get(artifact);
  return Boolean(
    record
    && isLivePlacementAuthorityRecord(artifact?.authority, record.record)
    && submittedPlacementArtifacts.has(artifact)
    && exactPlacementTerminalArtifactMatches(artifact, record)
    && Object.isFrozen(artifact)
    && artifact.schema
      === 'peercompute.ulg.schroeder-spatial-reaction-product-placement-submission-artifact.v3'
    && artifact.submitPerformed === true
    && artifact.gpuResident === true
    && artifact.authenticated === false
    && artifact.gpuAuthenticated === false
    && artifact.submissionAuthenticated === true
    && artifact.destinationSafetyAuthenticated === true
    && artifact.placementOutcomeObserved === false
    && artifact.transactionalPublicationGateEncoded === true
    && artifact.transactionalTerminalSealEncoded === true
    && artifact.transactionalFailClosedRecoveryEncoded === true
    && artifact.transactionalAuxiliaryMaterializationEncoded === true
    && artifact.destinationPublicationMode
      === 'gpu-terminal-safe-placed-or-exact-pre-reaction-fallback'
    && artifact.queueFenceStatus === 'same-queue-submission-order'
    && artifact.queueOrderedReleaseAuthorized === true
    && artifact.arenaReuseAllowed === true
    && artifact.hostQueueFenceCount === 0
    && artifact.queueCompletionMethod
      === 'same-gpu-queue-submission-order'
    && artifact.queueFence == null
    && artifact.positionMayChange === true
    && artifact.topologyMayChange === true
    && artifact.authority === record.authority
    && artifact.generation === record.record.generation
    && artifact.placementSourceFamily === record.record.placementSourceFamily
    && artifact.frozenSourceStateBuffer
      === record.record.bindings.frozenSourceStateBuffer
    && artifact.frozenSourceThermoBuffer
      === record.record.bindings.frozenSourceThermoBuffer
    && artifact.frozenSourceMechanicsBuffer
      === record.record.bindings.frozenSourceMechanicsBuffer
    && artifact.transactionRollbackStateBuffer
      === record.record.bindings.sourceStateBuffer
    && artifact.transactionRollbackThermoBuffer
      === record.record.bindings.sourceThermoBuffer
    && artifact.transactionRollbackMechanicsBuffer
      === record.record.bindings.sourceMechanicsBuffer
    && artifact.placedDestinationStateBuffer
      === record.record.bindings.placedDestinationStateBuffer
    && artifact.placedDestinationThermoBuffer
      === record.record.bindings.placedDestinationThermoBuffer
    && artifact.placedDestinationMechanicsBuffer
      === record.record.bindings.placedDestinationMechanicsBuffer
    && artifact.placementDecisionBuffer
      === record.encoding.placementDecisionBuffer
    && artifact.placementControlBuffer
      === record.encoding.placementControlBuffer
    && artifact.productEventBuffer
      === record.encoding.productEventBuffer
    && artifact.candidateProductEventBuffer
      === record.encoding.candidateProductEventBuffer
    && artifact.placementSummaryBuffer
      === record.encoding.placementSummaryBuffer
    && artifact.candidatePlacementSummaryBuffer
      === record.encoding.candidatePlacementSummaryBuffer
    && artifact.completionReceiptBuffer
      === record.encoding.completionReceiptBuffer
    && artifact.completionReadbackBuffer === record.readback
  );
}

/**
 * Observe the compact GPU completion seal copied from the authority-owned
 * receipt buffer. The returned object is runtime branded and cannot be
 * substituted with a host-authored counter object during finalization.
 */
export async function observeSchroederSpatialReactionProductPlacementCompletion(
  authority,
  {
    submissionArtifact,
    readbackBuffer = submissionArtifact?.completionReadbackBuffer
  } = {}
) {
  const record = requireLivePlacementAuthority(authority, {
    operation: 'placement completion observation'
  });
  const submissionRecord = submittedPlacementArtifactRecords.get(
    submissionArtifact
  );
  if (
    !submissionRecord
    || submissionRecord.authority !== authority
    || submissionRecord.record !== record
    || submissionRecord.readback !== readbackBuffer
    || !isSubmittedSchroederSpatialReactionProductPlacementArtifact(
      submissionArtifact
    )
  ) {
    throw placementError(
      'placement observation requires the exact submitted artifact and its runtime-encoded receipt copy',
      'OBSERVATION'
    );
  }
  const receiptBuffer = record.bindings.completionReceiptBuffer;
  let words;
  let readbackError = null;
  try {
    requireBuffer(record.device, receiptBuffer, 'placement completion receipt');
    requireBuffer(record.device, readbackBuffer, 'placement completion readback');
    requireMinimumBytes(
      readbackBuffer,
      SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES,
      'placement completion readback'
    );
    if (
      typeof readbackBuffer.mapAsync !== 'function'
      || typeof readbackBuffer.getMappedRange !== 'function'
      || typeof readbackBuffer.unmap !== 'function'
    ) {
      throw placementError(
        'placement completion readback is not map-readable',
        'OBSERVATION'
      );
    }
    await readbackBuffer.mapAsync(GPU_MAP_MODE.READ);
    try {
      requireLivePlacementAuthority(authority, {
        operation: 'placement completion observation after readback wait'
      });
      words = new Uint32Array(
        readbackBuffer.getMappedRange(),
        0,
        SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES / 4
      ).slice();
    } finally {
      readbackBuffer.unmap();
    }
  } catch (error) {
    readbackError = error;
    throw error;
  } finally {
    // A failed map/copy/unmap makes this arena unsafe to reuse, but it must not
    // leave the bounded warm cache pinned. Rejecting the gate drives the exact
    // queue-fenced release through its existing terminal quarantine path.
    settlePlacementDiagnosticObservation(submissionArtifact, {
      error: readbackError
    });
  }
  // The compact bytes are now detached into CPU-owned storage. Arena reuse is
  // safe even if validation below rejects the diagnostic contents.
  const decoded = Object.fromEntries(
    SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_LAYOUT.map((field, index) => [
      field.slice(0, field.indexOf(':')),
      words[index]
    ])
  );
  const {
    magic,
    version,
    generationId,
    supportProfileId,
    eventCapacity,
    compactCountPassCount,
    compactScanPassCount,
    compactScatterPassCount,
    activeEventCount,
    compactionInputVisitCount,
    compactionLiveFlagCount,
    compactionOverflowCount,
    envelopePartialPassCount,
    envelopeFinalizePassCount,
    envelopeInputVisitCount,
    envelopeAdmitted,
    classifierPassCount,
    classifierReadyCount,
    classifierRejectedCount,
    classifierUnknownCount,
    ssCellVisitCount,
    ssMemberVisitCount,
    ssMaterialPhaseFilterCount,
    ssCaptureHitCount,
    spareFlagPassCount,
    spareScanPassCount,
    spareAssignPassCount,
    spareCandidateVisitCount,
    spareAvailableCount,
    spareAssignedCount,
    applyPassCount,
    applyVisitedCount,
    directOnlyEventCount,
    sparePlacementEventCount,
    captureMergeEventCount,
    fallbackEventCount,
    subthresholdEventCount,
    noCarrierEventCount,
    rejectedEventCount,
    unknownDispositionCount,
    serialConflictFoldPassCount,
    serialConflictFoldEventCount,
    maxSerialConflictFoldSize,
    mutationConflictRetryCount,
    privateLookupBuildCount,
    exhaustiveTraversalCount,
    overflowFlags,
    status,
    applyPreflightPassCount,
    intentEmitPassCount,
    mutationIntentCapacity,
    mutationIntentCount,
    destinationRadixPassCount,
    destinationSegmentReducePassCount,
    destinationApplyPassCount,
    destinationIntentVisitedCount,
    destinationMutationCount,
    maxDestinationSegmentSize,
    summaryRadixPassCount,
    summarySegmentReducePassCount,
    summaryApplyPassCount,
    summaryContributionCount,
    globalSerialEventFoldCount,
    hostCompletionReadbackCount,
    transactionalPublishPassCount,
    transactionalVisitedParticleCount,
    transactionalCommittedParticleCount,
    transactionalFallbackParticleCount,
    transactionalEventPublishPassCount,
    transactionalVisitedEventRowCount,
    transactionalCommittedEventRowCount,
    transactionalFallbackEventRowCount,
    transactionalSummaryPublishPassCount,
    transactionalVisitedSummaryRowCount,
    transactionalCommittedSummaryRowCount,
    transactionalFallbackSummaryRowCount,
    transactionalTerminalSealPassCount,
    transactionalTerminalStatus
  } = decoded;
  const segmentedEncoding = submissionRecord.encoding.segmentedEncoding;
  const eventLedgerRowCount = eventCapacity
    * segmentedEncoding.arena.eventStrideVec4;
  const summaryLedgerRowCount = segmentedEncoding.arena.productTermCapacity * 8;
  const transactionalSafeFallback = Boolean(
    magic === SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_MAGIC
    && version === SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION
    && generationId === authority.generationId
    && supportProfileId === authority.supportProfileId
    && eventCapacity === authority.productEventCapacity
    && [
      SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.CANONICAL_DECISION_REJECTED,
      SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.CONTRACT_REJECTED
    ].includes(status)
    && transactionalPublishPassCount === 1
    && transactionalVisitedParticleCount === authority.particleCount
    && transactionalCommittedParticleCount === 0
    && transactionalFallbackParticleCount === authority.particleCount
    && transactionalEventPublishPassCount === 1
    && transactionalVisitedEventRowCount === eventLedgerRowCount
    && transactionalCommittedEventRowCount === 0
    && transactionalFallbackEventRowCount === eventLedgerRowCount
    && transactionalSummaryPublishPassCount === 1
    && transactionalVisitedSummaryRowCount === summaryLedgerRowCount
    && transactionalCommittedSummaryRowCount === 0
    && transactionalFallbackSummaryRowCount === summaryLedgerRowCount
    && transactionalTerminalSealPassCount === 1
    && transactionalTerminalStatus
      === SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS.SAFE_FROZEN_FALLBACK
    && hostCompletionReadbackCount === 1
  );
  const dispositionCount =
    directOnlyEventCount
    + sparePlacementEventCount
    + captureMergeEventCount
    + fallbackEventCount
    + subthresholdEventCount
    + noCarrierEventCount
    + rejectedEventCount
    + unknownDispositionCount;
  if (!transactionalSafeFallback && (
    magic !== SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_MAGIC
    || version !== SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION
    || generationId !== authority.generationId
    || supportProfileId !== authority.supportProfileId
    || eventCapacity !== authority.productEventCapacity
    || status !== SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.COMPLETE
    || compactCountPassCount !== 1
    || compactScanPassCount !== 1
    || compactScatterPassCount !== 1
    || activeEventCount > eventCapacity
    || compactionInputVisitCount !== eventCapacity
    || compactionLiveFlagCount !== activeEventCount
    || compactionOverflowCount !== 0
    || envelopePartialPassCount !== 1
    || envelopeFinalizePassCount !== 1
    || envelopeInputVisitCount !== authority.particleCount
    || envelopeAdmitted !== 1
    || classifierPassCount !== 1
    || classifierReadyCount + classifierRejectedCount
      + classifierUnknownCount !== activeEventCount
    || classifierUnknownCount !== 0
    // A no-carrier event is a product that had real mass and found no slot.
    // Leaving it live keeps feeding the grid splat ledger, so mass is not lost
    // on paper, but the product never becomes a moving mechanics participant —
    // H2 and steam stay frozen sidecar mass at the interface. Slice 9 requires
    // every valid event to materialize or the transaction to fail closed.
    || noCarrierEventCount !== 0
    // Every admitted SS cell owns at least one member. Filter and capture
    // evidence are both subsets of the member rows actually visited.
    || ssCellVisitCount > ssMemberVisitCount
    || ssMaterialPhaseFilterCount > ssMemberVisitCount
    || ssCaptureHitCount > ssMemberVisitCount
    || ssCaptureHitCount > classifierReadyCount
    || spareFlagPassCount !== 2
    || spareScanPassCount !== 2
    || spareAssignPassCount !== 2
    || spareCandidateVisitCount !== authority.particleCount
    || spareAssignedCount > spareAvailableCount
    || applyPassCount !== 1
    || applyVisitedCount !== activeEventCount
    || fallbackEventCount !== 0
    || sparePlacementEventCount !== spareAssignedCount
    || captureMergeEventCount !== ssCaptureHitCount
    || unknownDispositionCount !== 0
    || dispositionCount !== activeEventCount
    || serialConflictFoldPassCount !== 0
    || serialConflictFoldEventCount !== 0
    || maxSerialConflictFoldSize !== 0
    || privateLookupBuildCount !== 0
    || exhaustiveTraversalCount !== 0
    || overflowFlags !== 0
    || applyPreflightPassCount !== 1
    || intentEmitPassCount !== 1
    || mutationIntentCapacity !== eventCapacity * 2
    || mutationIntentCount > mutationIntentCapacity
    || destinationRadixPassCount !== WEBGPU_RADIX_PASSES_PER_WORD * 3
    || destinationSegmentReducePassCount
      !== reductionLevelCount(eventCapacity) * 2
    || destinationApplyPassCount !== 2
    || destinationIntentVisitedCount !== eventCapacity * 2
    || destinationMutationCount > mutationIntentCount * 2
    || maxDestinationSegmentSize > activeEventCount
    || summaryRadixPassCount !== WEBGPU_RADIX_PASSES_PER_WORD
    || summarySegmentReducePassCount !== reductionLevelCount(eventCapacity)
    || summaryApplyPassCount !== 1
    || summaryContributionCount !== activeEventCount
    || globalSerialEventFoldCount !== 0
    || hostCompletionReadbackCount !== 1
    || transactionalPublishPassCount !== 1
    || transactionalVisitedParticleCount !== authority.particleCount
    || transactionalCommittedParticleCount !== authority.particleCount
    || transactionalFallbackParticleCount !== 0
    || transactionalEventPublishPassCount !== 1
    || transactionalVisitedEventRowCount !== eventLedgerRowCount
    || transactionalCommittedEventRowCount !== eventLedgerRowCount
    || transactionalFallbackEventRowCount !== 0
    || transactionalSummaryPublishPassCount !== 1
    || transactionalVisitedSummaryRowCount !== summaryLedgerRowCount
    || transactionalCommittedSummaryRowCount !== summaryLedgerRowCount
    || transactionalFallbackSummaryRowCount !== 0
    || transactionalTerminalSealPassCount !== 1
    || transactionalTerminalStatus
      !== SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS.SAFE_PLACED
  )) {
    const error = placementError(
      'placement GPU completion receipt is missing, rejected, or internally inconsistent',
      'OBSERVATION'
    );
    error.receiptDiagnostic = Object.freeze({
      ...decoded,
      dispositionCount,
      expected: Object.freeze({
        generationId: authority.generationId,
        supportProfileId: authority.supportProfileId,
        eventCapacity: authority.productEventCapacity,
        particleCount: authority.particleCount,
        mutationIntentCapacity: eventCapacity * 2,
        destinationRadixPassCount: WEBGPU_RADIX_PASSES_PER_WORD * 3,
        destinationSegmentReducePassCount:
          reductionLevelCount(eventCapacity) * 2,
        destinationIntentVisitedCount: eventCapacity * 2,
        summaryRadixPassCount: WEBGPU_RADIX_PASSES_PER_WORD,
        summarySegmentReducePassCount: reductionLevelCount(eventCapacity),
        eventLedgerRowCount,
        summaryLedgerRowCount
      })
    });
    error.message += `: ${JSON.stringify(error.receiptDiagnostic)}`;
    throw error;
  }
  const observation = Object.freeze({
    schema: ULG_SPH_REACTION_PRODUCT_PLACEMENT_COMPLETION_RECEIPT_SCHEMA,
    ...decoded,
    status: 'reaction-product-placement-gpu-completion-observed',
    receiptStatus: status,
    placementAccepted: !transactionalSafeFallback,
    fallbackObserved: transactionalSafeFallback,
    transactionOutcome: transactionalSafeFallback
      ? 'atomic-reaction-placement-pre-reaction-fallback'
      : 'atomic-reaction-placement-committed',
    ready: true,
    gpuCompleted: true,
    generationId,
    supportProfileId,
    eventCapacity,
    completionReceiptBuffer: receiptBuffer,
    compactReadbackByteLength:
      SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES,
    fullParticleReadbackPerformed: false
  });
  completionObservationRecords.set(observation, {
    authority,
    record,
    submissionArtifact,
    receiptBuffer,
    readbackBuffer
  });
  return observation;
}

/** Finalize the dedicated placement receipt after its GPU submission. */
export function finalizeSchroederSpatialReactionProductPlacementAuthority(
  authority,
  {
    submissionArtifact,
    placementDecisionBuffer,
    placementControlBuffer,
    productEventBuffer,
    completionObservation,
    dispatchCount = 1
  } = {}
) {
  const record = requireLivePlacementAuthority(authority, {
    operation: 'placement authority finalization'
  });
  if (record.finalizedArtifact) return record.finalizedArtifact;
  if (dispatchCount !== 1) {
    throw placementError('placement must submit exactly one classifier traversal', 'SUBMISSION');
  }
  requireBuffer(record.device, placementDecisionBuffer, 'placement decision evidence');
  requireBuffer(record.device, placementControlBuffer, 'placement control evidence');
  requireBuffer(record.device, productEventBuffer, 'placement product-event evidence');
  const observationRecord = completionObservationRecords.get(completionObservation);
  const submissionRecord = submittedPlacementArtifactRecords.get(submissionArtifact);
  if (
    !observationRecord
    || !submissionRecord
    || observationRecord.authority !== authority
    || observationRecord.record !== record
    || observationRecord.submissionArtifact !== submissionArtifact
    || submissionRecord.authority !== authority
    || submissionRecord.record !== record
    || submissionRecord.encoding.placementDecisionBuffer
      !== placementDecisionBuffer
    || submissionRecord.encoding.placementControlBuffer
      !== placementControlBuffer
    || submissionRecord.encoding.productEventBuffer !== productEventBuffer
    || observationRecord.receiptBuffer
      !== record.bindings.completionReceiptBuffer
    || completionObservation?.gpuCompleted !== true
  ) {
    throw placementError(
      'placement finalization requires the exact observed GPU completion receipt',
      'OBSERVATION'
    );
  }
  const decisionBytes = authority.productEventCapacity
    * 4
    * Float32Array.BYTES_PER_ELEMENT;
  requireMinimumBytes(
    placementDecisionBuffer,
    decisionBytes,
    'placement decision evidence'
  );
  requireMinimumBytes(
    placementControlBuffer,
    4 * Float32Array.BYTES_PER_ELEMENT,
    'placement control evidence'
  );
  const evidence = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA,
    status: 'schroeder-spatial-exact-near-gpu-authenticated',
    gpuAuthenticated: true,
    consumerId: authority.consumerId,
    supportProfileId: authority.supportProfileId,
    generationId: authority.generationId,
    epochIdentity: authority.epochIdentity,
    traversalCount: completionObservation.classifierPassCount,
    candidateVisitCount: completionObservation.ssMemberVisitCount,
    consumerMaskHitCount: completionObservation.ssCaptureHitCount,
    migratedProposalCount: completionObservation.applyVisitedCount,
    candidateBytesRequired:
      completionObservation.activeEventCount * 4 * Float32Array.BYTES_PER_ELEMENT,
    candidateBytesAdmitted:
      completionObservation.activeEventCount * 4 * Float32Array.BYTES_PER_ELEMENT,
    candidateBytesCapacity: Math.max(
      decisionBytes,
      Number(placementDecisionBuffer.size) || decisionBytes
    ),
    candidateOverflowBytes: 0,
    privateLookupBuildCount: completionObservation.privateLookupBuildCount,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: completionObservation.exhaustiveTraversalCount,
    overflowed: completionObservation.overflowFlags !== 0,
    partialPublication: false,
    fallbackObserved: false,
    fullReadbackPerformed: false,
    residentCompletionReceiptBuffer:
      record.bindings.completionReceiptBuffer,
    residentCountersObserved: true,
    compactReadbackByteLength:
      completionObservation.compactReadbackByteLength,
    failClosedCommitPreflightCount: 1,
    compactCountPassCount: completionObservation.compactCountPassCount,
    compactScanPassCount: completionObservation.compactScanPassCount,
    compactScatterPassCount: completionObservation.compactScatterPassCount,
    compactionInputVisitCount:
      completionObservation.compactionInputVisitCount,
    compactionLiveFlagCount:
      completionObservation.compactionLiveFlagCount,
    envelopePartialPassCount:
      completionObservation.envelopePartialPassCount,
    envelopeFinalizePassCount:
      completionObservation.envelopeFinalizePassCount,
    envelopeInputVisitCount:
      completionObservation.envelopeInputVisitCount,
    ssCellVisitCount: completionObservation.ssCellVisitCount,
    ssMemberVisitCount: completionObservation.ssMemberVisitCount,
    ssMaterialPhaseFilterCount:
      completionObservation.ssMaterialPhaseFilterCount,
    ssCaptureHitCount: completionObservation.ssCaptureHitCount,
    spareFlagPassCount: completionObservation.spareFlagPassCount,
    spareScanPassCount: completionObservation.spareScanPassCount,
    spareAssignPassCount: completionObservation.spareAssignPassCount,
    spareCandidateVisitCount:
      completionObservation.spareCandidateVisitCount,
    spareAvailableCount: completionObservation.spareAvailableCount,
    spareAssignedCount: completionObservation.spareAssignedCount,
    serialConflictFoldPassCount:
      completionObservation.serialConflictFoldPassCount,
    serialConflictFoldEventCount:
      completionObservation.serialConflictFoldEventCount,
    maxSerialConflictFoldSize:
      completionObservation.maxSerialConflictFoldSize,
    mutationConflictRetryCount:
      completionObservation.mutationConflictRetryCount,
    destinationRadixPassCount:
      completionObservation.destinationRadixPassCount,
    destinationSegmentReducePassCount:
      completionObservation.destinationSegmentReducePassCount,
    destinationApplyPassCount:
      completionObservation.destinationApplyPassCount,
    maxDestinationSegmentSize:
      completionObservation.maxDestinationSegmentSize,
    summaryRadixPassCount:
      completionObservation.summaryRadixPassCount,
    summarySegmentReducePassCount:
      completionObservation.summarySegmentReducePassCount,
    summaryApplyPassCount:
      completionObservation.summaryApplyPassCount,
    globalSerialEventFoldCount:
      completionObservation.globalSerialEventFoldCount,
    transactionalPublishPassCount:
      completionObservation.transactionalPublishPassCount,
    transactionalVisitedParticleCount:
      completionObservation.transactionalVisitedParticleCount,
    transactionalCommittedParticleCount:
      completionObservation.transactionalCommittedParticleCount,
    transactionalFallbackParticleCount:
      completionObservation.transactionalFallbackParticleCount,
    transactionalEventPublishPassCount:
      completionObservation.transactionalEventPublishPassCount,
    transactionalVisitedEventRowCount:
      completionObservation.transactionalVisitedEventRowCount,
    transactionalCommittedEventRowCount:
      completionObservation.transactionalCommittedEventRowCount,
    transactionalFallbackEventRowCount:
      completionObservation.transactionalFallbackEventRowCount,
    transactionalSummaryPublishPassCount:
      completionObservation.transactionalSummaryPublishPassCount,
    transactionalVisitedSummaryRowCount:
      completionObservation.transactionalVisitedSummaryRowCount,
    transactionalCommittedSummaryRowCount:
      completionObservation.transactionalCommittedSummaryRowCount,
    transactionalFallbackSummaryRowCount:
      completionObservation.transactionalFallbackSummaryRowCount,
    transactionalTerminalSealPassCount:
      completionObservation.transactionalTerminalSealPassCount,
    transactionalTerminalStatus:
      completionObservation.transactionalTerminalStatus,
    transactionalFallbackObserved:
      completionObservation.fallbackObserved === true,
    destinationPublicationMode:
      'gpu-terminal-safe-placed-or-exact-pre-reaction-fallback',
    canonicalDensePlacementScanCount: 0,
    deterministicApplyMode:
      SPH_REACTION_PRODUCT_PLACEMENT_LAW.mutationOrder
  });
  const receipt = finalizeSchroederSpatialExactNearConsumerReceipt(
    record.authentication,
    evidence
  );
  const artifact = Object.freeze({
    schema:
      ULG_SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_ARTIFACT_SCHEMA,
    status: completionObservation.fallbackObserved === true
      ? 'schroeder-spatial-reaction-product-placement-observed-pre-reaction-fallback'
      : 'schroeder-spatial-reaction-product-placement-observed-complete',
    ready: true,
    admitted: true,
    authenticated: true,
    gpuAuthenticated: true,
    authority,
    generation: record.generation,
    generationId: authority.generationId,
    directoryAbiVersion: record.directoryAbiVersion,
    expectationBufferByteLength: record.expectationBufferByteLength,
    epochIdentity: authority.epochIdentity,
    consumerId: authority.consumerId,
    phase: authority.phase,
    artifactFamily: authority.artifactFamily,
    supportProfileId: authority.supportProfileId,
    placementSourceFamily: record.placementSourceFamily,
    stageIdentity: authority.stageIdentity,
    directoryBuffer: record.bindings.directoryBuffer,
    directoryPositionAuthorityStateBuffer:
      record.bindings.directoryPositionAuthorityStateBuffer,
    expectationBuffer: record.bindings.expectationBuffer,
    frozenSourceStateBuffer: record.bindings.frozenSourceStateBuffer,
    frozenSourceThermoBuffer: record.bindings.frozenSourceThermoBuffer,
    frozenSourceMechanicsBuffer: record.bindings.frozenSourceMechanicsBuffer,
    sourceStateBuffer: record.bindings.sourceStateBuffer,
    sourceThermoBuffer: record.bindings.sourceThermoBuffer,
    sourceMechanicsBuffer: record.bindings.sourceMechanicsBuffer,
    placedDestinationStateBuffer:
      record.bindings.placedDestinationStateBuffer,
    placedDestinationThermoBuffer:
      record.bindings.placedDestinationThermoBuffer,
    placedDestinationMechanicsBuffer:
      record.bindings.placedDestinationMechanicsBuffer,
    productEventBuffer,
    completionReceiptBuffer: record.bindings.completionReceiptBuffer,
    completionObservation,
    evidence,
    receipt,
    traversalCount: completionObservation.classifierPassCount,
    privateLookupBuildCount: completionObservation.privateLookupBuildCount,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: completionObservation.exhaustiveTraversalCount,
    canonicalDensePlacementScanCount: 0,
    serialConflictFoldEventCount:
      completionObservation.serialConflictFoldEventCount,
    transactionalPublishPassCount:
      completionObservation.transactionalPublishPassCount,
    transactionalVisitedParticleCount:
      completionObservation.transactionalVisitedParticleCount,
    transactionalCommittedParticleCount:
      completionObservation.transactionalCommittedParticleCount,
    transactionalFallbackParticleCount:
      completionObservation.transactionalFallbackParticleCount,
    transactionalTerminalStatus:
      completionObservation.transactionalTerminalStatus,
    placementAccepted: completionObservation.placementAccepted === true,
    transactionOutcome: completionObservation.transactionOutcome,
    destinationPublicationMode:
      'gpu-terminal-safe-placed-or-exact-pre-reaction-fallback',
    fallbackObserved: completionObservation.fallbackObserved === true,
    fullReadbackPerformed: false
  });
  record.finalizedArtifact = artifact;
  finalizedPlacementArtifacts.add(artifact);
  return artifact;
}

export function isFinalizedSchroederSpatialReactionProductPlacementArtifact(
  artifact
) {
  return Boolean(
    artifact
    && finalizedPlacementArtifacts.has(artifact)
    && Object.isFrozen(artifact)
    && artifact.schema
      === ULG_SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_ARTIFACT_SCHEMA
    && artifact.gpuAuthenticated === true
    && isFinalizedSchroederSpatialExactNearConsumerReceipt(artifact.receipt)
    && artifact.receipt.consumerId
      === SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_CONSUMER_ID
    && artifact.receipt.supportProfileId
      === SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_PRODUCT_PLACEMENT_V1
  );
}
