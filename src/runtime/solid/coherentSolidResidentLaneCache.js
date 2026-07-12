import { createCoherentSolidFrameGpu } from './coherentSolidFrameGpu.js';
import { createCoherentSolidResidentGpu } from './coherentSolidResidentGpu.js';
import { createWebGpuStableRadixScanUnique } from '../webgpuRadixScanUnique.js';

const CACHE_BY_DEVICE = new WeakMap();
let cacheEntrySequence = 0;
let presentationConsumerSequence = 0;

function bufferBytes(buffer) {
  const bytes = Number(buffer?.size ?? buffer?.byteLength);
  return Number.isFinite(bytes) && bytes >= 0 ? bytes : 0;
}

function cacheMap(device) {
  let entries = CACHE_BY_DEVICE.get(device);
  if (!entries) {
    entries = new Map();
    CACHE_BY_DEVICE.set(device, entries);
  }
  return entries;
}

function stableCacheKey({
  laneId,
  stateKey,
  sourceFamily,
  frameLeaseId,
  geometryKey,
  topologyGeneration,
  bodyCapacity,
  memberCapacity,
  membershipIndexCapacity,
  contactProxyCapacity,
  workgroupSize,
  maxComputeWorkgroupsPerDimension
}) {
  return JSON.stringify([
    laneId,
    stateKey,
    sourceFamily,
    frameLeaseId,
    geometryKey,
    topologyGeneration,
    bodyCapacity,
    memberCapacity,
    membershipIndexCapacity,
    contactProxyCapacity,
    workgroupSize,
    maxComputeWorkgroupsPerDimension
  ]);
}

function createCacheEntry(device, key, {
  plan,
  bodyCapacity,
  memberCapacity,
  contactProxyCapacity,
  workgroupSize,
  maxComputeWorkgroupsPerDimension,
  label
}) {
  const entryId = ++cacheEntrySequence;
  const slots = [];
  let framePipelineBundle = null;
  let residentPipelineBundle = null;
  const proxyOrderRuntime = contactProxyCapacity > 0
    ? createWebGpuStableRadixScanUnique(device, {
      maxElementCount: contactProxyCapacity,
      maxKeyWordCount: 2,
      maxComputeWorkgroupsPerDimension,
      label: `${label}-cache-${entryId}-proxy-order`
    })
    : null;
  for (let slotIndex = 0; slotIndex < 2; slotIndex += 1) {
    const slotLabel = `${label}-cache-${entryId}-slot-${slotIndex}`;
    const frameRuntime = createCoherentSolidFrameGpu(device, {
      plan,
      label: `${slotLabel}-frame`,
      pipelineBundle: framePipelineBundle
    });
    framePipelineBundle ||= frameRuntime.pipelineBundle;
    const residentRuntime = createCoherentSolidResidentGpu(device, {
      bodyCapacity,
      memberCapacity,
      contactProxyCapacity,
      workgroupSize,
      maxComputeWorkgroupsPerDimension,
      label: `${slotLabel}-resident`,
      pipelineBundle: residentPipelineBundle,
      proxyOrderRuntime
    });
    residentPipelineBundle ||= residentRuntime.pipelineBundle;
    slots.push({
      slotIndex,
      frameRuntime,
      residentRuntime,
      heldByGeneration: null,
      heldByTaskId: null,
      producerReleaseRequested: false,
      presentationConsumers: new Map()
    });
  }
  const allocationEntries = slots.flatMap((slot) => [
    ...slot.frameRuntime.allocationEntries().map((entry) => ({
      ...entry,
      role: `slot-${slot.slotIndex}:frame:${entry.role}`
    })),
    ...slot.residentRuntime.allocationEntries().map((entry) => ({
      ...entry,
      role: `slot-${slot.slotIndex}:resident:${entry.role}`
    }))
  ]).concat(proxyOrderRuntime
    ? proxyOrderRuntime.allocationEntries().map((allocation) => ({
      ...allocation,
      role: `shared:proxy-order:${allocation.role}`
    }))
    : []);
  const entry = {
    device,
    entryId,
    key,
    slots,
    allocationEntries,
    retainedBufferAllocationCount: allocationEntries.length,
    retainedBufferBytes: allocationEntries.reduce(
      (sum, { buffer }) => sum + bufferBytes(buffer),
      0
    ),
    pipelineCreationCount:
      Object.keys(framePipelineBundle).length
      + Object.keys(residentPipelineBundle).length
      + (proxyOrderRuntime?.pipelineCount ?? 0),
    proxyOrderRuntime,
    executionCount: 0,
    queueSubmissionCount: 0,
    destroyPending: false,
    destroyed: false
  };
  return entry;
}

function entrySnapshot(entry) {
  return Object.freeze({
    schema: 'peercompute.ulg.schroeder-solid-resident-lane-cache-evidence.v0',
    status: entry.destroyed
      ? 'destroyed'
      : (entry.destroyPending
        ? 'resident-lane-cache-destroy-pending'
        : 'resident-lane-cache-ready'),
    cacheEntryId: entry.entryId,
    slotCount: entry.slots.length,
    maxLiveGenerationCount: entry.slots.length,
    liveGenerationCount: entry.slots.filter(({ heldByGeneration }) => heldByGeneration !== null).length,
    heldGenerations: entry.slots.map(({ heldByGeneration }) => heldByGeneration),
    presentationConsumerCount: entry.slots.reduce(
      (count, slot) => count + slot.presentationConsumers.size,
      0
    ),
    presentationConsumerCounts: entry.slots.map((slot) => slot.presentationConsumers.size),
    producerReleasePending: entry.slots.map((slot) => slot.producerReleaseRequested),
    pipelineCreationCount: entry.pipelineCreationCount,
    retainedBufferAllocationCount: entry.retainedBufferAllocationCount,
    retainedBufferBytes: entry.retainedBufferBytes,
    executionCount: entry.executionCount,
    queueSubmissionCount: entry.queueSubmissionCount,
    perGenerationPipelineCreationCount: 0,
    perGenerationRetainedBufferAllocationCount: 0,
    frameArenaPolicy: 'two-slot-gpu-resident-ping-pong',
    pipelinePolicy: 'shared-per-device-lane-topology-cache'
  });
}

function destroyCacheEntryIfIdle(entry) {
  if (
    !entry?.destroyPending
    || entry.destroyed
    || entry.slots.some(({ heldByGeneration }) => heldByGeneration !== null)
  ) {
    return false;
  }
  for (const slot of entry.slots) {
    slot.residentRuntime.destroy();
    slot.frameRuntime.destroy();
  }
  entry.proxyOrderRuntime?.destroy?.();
  entry.destroyed = true;
  const entries = CACHE_BY_DEVICE.get(entry.device);
  entries?.delete(entry.key);
  if (entries?.size === 0) CACHE_BY_DEVICE.delete(entry.device);
  return true;
}

export function acquireCoherentSolidResidentLaneRuntime({
  device,
  laneId,
  stateKey,
  sourceFamily,
  taskId,
  frameLeaseId,
  geometryKey,
  topologyGeneration,
  bodyCapacity,
  memberCapacity,
  membershipIndexCapacity,
  contactProxyCapacity,
  plan,
  workgroupSize = null,
  maxComputeWorkgroupsPerDimension = null,
  sourceFrameBuffer,
  targetGenerationId,
  label = 'ulg-coherent-solid-lane'
} = {}) {
  if (!device || !sourceFrameBuffer) {
    throw new TypeError('coherent-solid resident lane cache requires a device and source frame buffer');
  }
  const resolvedWorkgroupSize = workgroupSize ?? plan?.workgroupSize ?? 64;
  const resolvedMaxComputeWorkgroupsPerDimension =
    maxComputeWorkgroupsPerDimension
    ?? plan?.maxComputeWorkgroupsPerDimension
    ?? 65535;
  const key = stableCacheKey({
    laneId,
    stateKey,
    sourceFamily,
    frameLeaseId,
    geometryKey,
    topologyGeneration,
    bodyCapacity,
    memberCapacity,
    membershipIndexCapacity,
    contactProxyCapacity,
    workgroupSize: resolvedWorkgroupSize,
    maxComputeWorkgroupsPerDimension: resolvedMaxComputeWorkgroupsPerDimension
  });
  const entries = cacheMap(device);
  let entry = entries.get(key);
  const cacheHit = Boolean(entry);
  if (!entry) {
    entry = createCacheEntry(device, key, {
      plan,
      bodyCapacity,
      memberCapacity,
      contactProxyCapacity,
      workgroupSize: resolvedWorkgroupSize,
      maxComputeWorkgroupsPerDimension: resolvedMaxComputeWorkgroupsPerDimension,
      label
    });
    entries.set(key, entry);
  }
  if (entry.destroyed || entry.destroyPending) {
    throw new Error('coherent-solid resident lane cache entry is destroyed or pending teardown');
  }
  const slot = entry.slots.find((candidate) => (
    candidate.heldByGeneration === null
    && candidate.frameRuntime.candidateFrameBuffer !== sourceFrameBuffer
  ));
  if (!slot) {
    throw new Error(
      'coherent-solid ping-pong arenas are occupied; retire the prior admitted generation before reuse'
    );
  }
  slot.heldByGeneration = targetGenerationId;
  slot.heldByTaskId = taskId;
  slot.producerReleaseRequested = false;
  slot.presentationConsumers.clear();
  entry.executionCount += 1;
  const releaseSlotIfUnreferenced = () => {
    if (
      !slot.producerReleaseRequested
      || slot.presentationConsumers.size > 0
      || slot.heldByGeneration !== targetGenerationId
      || slot.heldByTaskId !== taskId
    ) {
      return false;
    }
    slot.heldByGeneration = null;
    slot.heldByTaskId = null;
    slot.producerReleaseRequested = false;
    destroyCacheEntryIfIdle(entry);
    return true;
  };
  let producerReleased = false;
  const release = () => {
    if (producerReleased) return false;
    producerReleased = true;
    if (
      slot.heldByGeneration !== targetGenerationId
      || slot.heldByTaskId !== taskId
    ) {
      return false;
    }
    slot.producerReleaseRequested = true;
    return releaseSlotIfUnreferenced();
  };
  const acquirePresentationConsumer = ({
    publicationGeneration,
    admissionId,
    consumerId = 'coherent-solid-native-presentation'
  } = {}) => {
    if (
      producerReleased
      || slot.producerReleaseRequested
      || slot.heldByGeneration !== targetGenerationId
      || slot.heldByTaskId !== taskId
    ) {
      throw new Error('coherent-solid resident generation is not live for presentation acquisition');
    }
    if (Number(publicationGeneration) !== Number(targetGenerationId)) {
      throw new Error('coherent-solid presentation generation does not match the resident slot');
    }
    const resolvedAdmissionId = Number(admissionId);
    if (
      !Number.isInteger(resolvedAdmissionId)
      || resolvedAdmissionId <= 0
      || resolvedAdmissionId > 0xffffffff
    ) {
      throw new TypeError('coherent-solid presentation admissionId must be a positive u32');
    }
    const resolvedConsumerId = String(consumerId ?? '').trim();
    if (!resolvedConsumerId) {
      throw new TypeError('coherent-solid presentation consumerId must be non-empty');
    }
    const consumerSerial = ++presentationConsumerSequence;
    const consumerKey = `${resolvedConsumerId}:${consumerSerial}`;
    let consumerReleased = false;
    const tokenRecord = {
      consumerKey,
      consumerId: resolvedConsumerId,
      consumerSerial,
      publicationGeneration: targetGenerationId,
      admissionId: resolvedAdmissionId
    };
    slot.presentationConsumers.set(consumerKey, tokenRecord);
    const validate = () => (
      !consumerReleased
      && slot.presentationConsumers.get(consumerKey) === tokenRecord
      && slot.heldByGeneration === targetGenerationId
      && slot.heldByTaskId === taskId
    );
    return Object.freeze({
      schema: 'peercompute.ulg.coherent-solid-resident-presentation-consumer-token.v0',
      status: 'coherent-solid-resident-presentation-consumer-acquired',
      ready: true,
      consumerId: resolvedConsumerId,
      consumerSerial,
      publicationGeneration: targetGenerationId,
      admissionId: resolvedAdmissionId,
      cacheEntryId: entry.entryId,
      slotIndex: slot.slotIndex,
      validate,
      release() {
        if (consumerReleased) return false;
        consumerReleased = true;
        if (slot.presentationConsumers.get(consumerKey) === tokenRecord) {
          slot.presentationConsumers.delete(consumerKey);
        }
        releaseSlotIfUnreferenced();
        return true;
      }
    });
  };
  return {
    frameRuntime: slot.frameRuntime,
    residentRuntime: slot.residentRuntime,
    slotIndex: slot.slotIndex,
    cacheHit,
    cacheEntryId: entry.entryId,
    release,
    acquirePresentationConsumer,
    markSubmitted() {
      entry.queueSubmissionCount += 1;
    },
    snapshot() {
      return entrySnapshot(entry);
    }
  };
}

export function destroyCoherentSolidResidentLaneCaches(device) {
  const entries = CACHE_BY_DEVICE.get(device);
  if (!entries) return 0;
  let destroyed = 0;
  for (const entry of [...entries.values()]) {
    entry.destroyPending = true;
    if (destroyCacheEntryIfIdle(entry)) destroyed += 1;
  }
  return destroyed;
}
