import { cachedWebGpuBindGroup } from '../webgpuBindGroupCache.js';
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
  resolveSchroederSpatialReactionPlacementSourceFamily,
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
  registerQueueOrderedCleanupClaim,
  submitQueueOrderedFinalConsumerWork,
  releaseSubmittedWorkCleanupQueueOrdered
} from '../webgpuComputeLayout.js';
import {
  createWebGpuStableRadixScanUnique,
  WEBGPU_RADIX_PASSES_PER_WORD
} from '../webgpuRadixScanUnique.js';

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
  { device = null, operation = 'placement operation' } = {}
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
    resolveSchroederSpatialReactionPlacementSourceFamily(
      record.placementSourceFamily,
      { device: record.device }
    );
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
  eventStrideVec4
}) {
  const maxStorageBindings = Number(
    device.limits?.maxStorageBuffersPerShaderStage ?? 8
  );
  if (!Number.isInteger(maxStorageBindings) || maxStorageBindings < 8) {
    throw placementArenaError(
      'segmented placement requires the WebGPU baseline of 8 storage buffers per shader stage',
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
        Uint32Array.BYTES_PER_ELEMENT,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      ),
      compactParams: makeBuffer(
        `${prefix}-compact-params`,
        16,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      compactLocalPrefix: makeBuffer(
        `${prefix}-compact-local-prefix`,
        eventCapacity * Uint32Array.BYTES_PER_ELEMENT
      ),
      compactGroupCount: makeBuffer(
        `${prefix}-compact-group-count`,
        eventGroups * Uint32Array.BYTES_PER_ELEMENT
      ),
      compactGroupOffset: makeBuffer(
        `${prefix}-compact-group-offset`,
        eventGroups * Uint32Array.BYTES_PER_ELEMENT
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
      serialHistogramScanMaxElementCount: 0
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
  const particles = exactPositiveU32(particleCapacity, 'particleCapacity');
  const events = exactPositiveU32(eventCapacity, 'eventCapacity');
  const terms = exactPositiveU32(productTermCapacity, 'productTermCapacity');
  const stride = exactPositiveU32(eventStrideVec4, 'eventStrideVec4');
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
      eventStrideVec4: stride
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
  diagnosticReadbackRequested = false
} = {}) {
  if (!encoder?.beginComputePass || !encoder?.finish) {
    throw new TypeError('segmented product placement requires a live command encoder');
  }
  const authorityRecord = requireLivePlacementAuthority(authority, {
    device,
    operation: 'segmented placement encoding'
  });
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
  const dimensions = [0, 1, 2].map((axis) => {
    const value = Number(boxDimsM?.[axis]);
    return Number.isFinite(value) && value > 0 ? value : 0;
  });
  device.queue.writeBuffer(
    buffers.placementParams,
    0,
    placementParamsData({
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
  encoder.copyBufferToBuffer(
    publishedEvents,
    0,
    events,
    0,
    eventByteLength
  );
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
  const transactionalPublish = pipeline(
    pipelineDescriptors.transactionalPublish
  );
  const transactionalAuxiliaryPublish = pipeline(
    pipelineDescriptors.transactionalAuxiliaryPublish
  );
  const transactionalTerminal = pipeline(
    pipelineDescriptors.transactionalTerminal
  );
  const transactionalDestinationRecovery = pipeline(
    pipelineDescriptors.transactionalDestinationRecovery
  );
  const transactionalAuxiliaryMaterialize = pipeline(
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
  const captureRadixExecution = arenaRecord.captureRadix.encodeSort(encoder, {
    keyBuffer: buffers.captureKeys,
    elementCount: eventCount,
    keyWordCount: 1,
    keyStrideWords: 1,
    generationId: authority.generationId
  });
  placementTimestampEnd(gpuTimestampRecorder, encoder, captureRadixSpan);
  const reductionEntry = (binding, offset) => ({
    binding,
    resource: { buffer: buffers.reductionParams, offset, size: 16 }
  });
  const captureSorted = captureRadixExecution.sortedIndicesBuffer;
  encode(captureInitialize, placementBindGroup(device, captureInitialize, 'capture-initialize-bind-group', [
    { binding: 0, resource: { buffer: buffers.captureKeys } },
    { binding: 1, resource: { buffer: captureSorted } },
    { binding: 2, resource: { buffer: buffers.captureValues } },
    { binding: 3, resource: { buffer: buffers.captureReduceB } },
    { binding: 4, resource: { buffer: buffers.captureReduceA } },
    reductionEntry(5, arenaRecord.reductionOffsets.capture.initOffset)
  ]), eventWorkgroups, 'capture-initialize');
  let captureInput = buffers.captureReduceA;
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
  encode(finalize, placementBindGroup(device, finalize, 'placement-finalize-bind-group', [
    { binding: 0, resource: { buffer: compactCount } },
    { binding: 1, resource: { buffer: control } },
    { binding: 2, resource: { buffer: receipt } },
    paramsEntry(3)
  ]), 1, 'finalize');
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
  sourceMechanicsBuffer
} = {}) {
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
    spatialArenaIndex: expectation.entry.arenaIndex,
    arenaAcquisitionOrdinal: expectation.entry.acquisitionCount,
    bufferCreationCount: expectation.bufferCreationCount,
    authentication
  });
  const authorityRecord = {
    device,
    generation,
    placementSourceFamily: resolvedPlacementSourceFamily,
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
      placedDestinationMechanicsBuffer
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
    ...exactEvidenceBuffers
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
    segmentedEncoding: genuine,
    deterministicApplyMode
  });
  encodedPlacementRecords.set(encoding, {
    authority,
    record,
    encoder,
    commandBuffer,
    readback,
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
