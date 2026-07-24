import {
  SCHROEDER_SPATIAL_TOPOLOGY_STATE_STRIDE_WORDS,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_BYTES,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_FINAL_SEAL,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_MAGIC,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_VERSION,
  ULG_SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_RECEIPT_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialTopologyTransition.js';
import {
  schroederSpatialTopologyTransitionWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialTopologyTransitionWgsl.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

export const ULG_SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_EXECUTION_SCHEMA =
  'peercompute.ulg.schroeder-spatial-topology-transition-execution.v1';

const WORKGROUP_SIZE = 64;
const PARAM_WORDS = 8;
const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};
const GPU_MAP_MODE = { READ: globalThis.GPUMapMode?.READ ?? 1 };

const receiptRecords = new WeakMap();
const finalizedReceipts = new WeakSet();
let nextSubmissionNonce = 0;

function transitionError(message, suffix = 'CONTRACT') {
  const error = new Error(message);
  error.code = `ERR_SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_${suffix}`;
  return error;
}

function exactU32(value, label, { positive = false } = {}) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < (positive ? 1 : 0)
    || value > 0xffff_ffff
  ) {
    throw transitionError(`${label} must be an exact ${positive ? 'positive ' : ''}u32`, 'IDENTITY');
  }
  return value;
}

function requireBuffer(device, buffer, label) {
  if (
    !buffer
    || webGpuBufferDevice(buffer) !== device
    || !webGpuBufferMatchesDevice(buffer, device)
  ) {
    throw transitionError(
      `${label} must be a tagged live buffer on the canonical generation device`,
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
    throw transitionError(
      `${label} has ${buffer.size} bytes; ${byteLength} required`,
      'CAPACITY'
    );
  }
  return buffer;
}

function createBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(device.createBuffer({ label, size, usage }), device);
}

function allocateSubmissionNonce() {
  nextSubmissionNonce = (nextSubmissionNonce % 0xffff_fffe) + 1;
  return nextSubmissionNonce;
}

function pipelinePair(device) {
  const bindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'uniform'),
    computeBufferBinding(3, 'storage')
  ];
  const compare = createCachedExplicitComputePipeline(device, {
    cacheKey: 'schroeder-spatial-topology-transition-v1-layout-v1',
    label: 'ulg-schroeder-spatial-topology-transition-compare',
    code: schroederSpatialTopologyTransitionWgsl,
    entryPoint: 'compare_topology',
    bindings
  });
  const seal = createCachedExplicitComputePipeline(device, {
    cacheKey: 'schroeder-spatial-topology-transition-v1-layout-v1',
    label: 'ulg-schroeder-spatial-topology-transition-seal',
    code: schroederSpatialTopologyTransitionWgsl,
    entryPoint: 'seal_topology',
    bindings
  });
  return { compare, seal };
}

async function mapReceiptOrDeviceLoss(device, readbackBuffer) {
  const mapPromise = readbackBuffer.mapAsync(GPU_MAP_MODE.READ);
  if (!device?.lost?.then) {
    await mapPromise;
    return;
  }
  await Promise.race([
    mapPromise,
    Promise.resolve(device.lost).then((info) => {
      throw transitionError(
        `device lost before topology receipt observation${info?.message ? `: ${info.message}` : ''}`,
        'DEVICE_LOST'
      );
    })
  ]);
}

/**
 * Compare the canonical E* active mask with the final selected successor
 * family. The only active predicate is a finite mass greater than zero.
 */
export async function runSchroederSpatialTopologyTransitionWebGpu({
  device,
  generation,
  sourceStateBuffer = generation?.source?.sourceStateBuffer,
  sourceParticleCount = generation?.source?.sourceCount,
  successorStateBuffer,
  successorParticleCount,
  sourceTopologyEpoch = generation?.execution?.topologyEpoch,
  forceTopologyAdvance = false
} = {}) {
  if (
    !device?.createBuffer
    || !device?.createCommandEncoder
    || !device?.createBindGroup
    || !device?.queue?.writeBuffer
    || !device?.queue?.submit
  ) {
    throw new TypeError('topology transition requires a WebGPU-like device and queue');
  }
  if (
    generation?.selected !== true
    || generation?.ready !== true
    || generation?.execution?.released === true
    || generation?.releaseScheduled === true
  ) {
    throw transitionError(
      'topology transition requires one live selected canonical generation',
      'GENERATION'
    );
  }
  const generationId = exactU32(
    generation?.execution?.generationId,
    'generation.execution.generationId',
    { positive: true }
  );
  const resolvedSourceCount = exactU32(
    sourceParticleCount,
    'sourceParticleCount',
    { positive: true }
  );
  const resolvedSuccessorCount = exactU32(
    successorParticleCount,
    'successorParticleCount',
    { positive: true }
  );
  const resolvedSourceEpoch = exactU32(
    sourceTopologyEpoch,
    'sourceTopologyEpoch'
  );
  if (
    generation.source.sourceCount !== resolvedSourceCount
    || generation.execution.sourceCount !== resolvedSourceCount
    || generation.execution.topologyEpoch !== resolvedSourceEpoch
  ) {
    throw transitionError(
      'topology transition count or epoch does not match the canonical generation',
      'IDENTITY'
    );
  }
  const canonicalSourceStateBuffer = requireBuffer(
    device,
    generation.source.sourceStateBuffer,
    'canonical E* source state'
  );
  if (sourceStateBuffer !== canonicalSourceStateBuffer) {
    throw transitionError(
      'topology transition source state is not the exact canonical E* state',
      'IDENTITY'
    );
  }
  const resolvedSuccessorStateBuffer = requireBuffer(
    device,
    successorStateBuffer,
    'final successor state'
  );
  const stateStrideBytes =
    SCHROEDER_SPATIAL_TOPOLOGY_STATE_STRIDE_WORDS
    * Float32Array.BYTES_PER_ELEMENT;
  requireMinimumBytes(
    canonicalSourceStateBuffer,
    resolvedSourceCount * stateStrideBytes,
    'canonical E* source state'
  );
  requireMinimumBytes(
    resolvedSuccessorStateBuffer,
    resolvedSuccessorCount * stateStrideBytes,
    'final successor state'
  );
  const comparisonParticleCount = Math.max(
    resolvedSourceCount,
    resolvedSuccessorCount
  );
  const workgroupCount = Math.ceil(comparisonParticleCount / WORKGROUP_SIZE);
  const maxWorkgroups = Number(device?.limits?.maxComputeWorkgroupsPerDimension);
  if (
    Number.isFinite(maxWorkgroups)
    && maxWorkgroups > 0
    && workgroupCount > maxWorkgroups
  ) {
    throw transitionError(
      `topology comparison needs ${workgroupCount} workgroups; device limit is ${maxWorkgroups}`,
      'DISPATCH_LIMIT'
    );
  }

  const submissionNonce = allocateSubmissionNonce();
  const paramsBuffer = createBuffer(
    device,
    'ulg-schroeder-spatial-topology-transition-params',
    PARAM_WORDS * Uint32Array.BYTES_PER_ELEMENT,
    GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  );
  const receiptBuffer = createBuffer(
    device,
    'ulg-schroeder-spatial-topology-transition-receipt',
    SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_BYTES,
    GPU_BUFFER_USAGE.STORAGE
      | GPU_BUFFER_USAGE.COPY_SRC
      | GPU_BUFFER_USAGE.COPY_DST
  );
  const readbackBuffer = createBuffer(
    device,
    'ulg-schroeder-spatial-topology-transition-compact-readback',
    SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_BYTES,
    GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  );
  let mapped = false;
  try {
    device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([
      resolvedSourceCount,
      resolvedSuccessorCount,
      generationId,
      submissionNonce,
      resolvedSourceEpoch,
      forceTopologyAdvance ? 1 : 0,
      SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_VERSION,
      SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_MAGIC
    ]));
    device.queue.writeBuffer(
      receiptBuffer,
      0,
      new Uint32Array(SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_BYTES / 4)
    );
    const pipelines = pipelinePair(device);
    const bindGroup = device.createBindGroup({
      label: 'ulg-schroeder-spatial-topology-transition-bind-group',
      layout: pipelines.compare.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: canonicalSourceStateBuffer } },
        { binding: 1, resource: { buffer: resolvedSuccessorStateBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } },
        { binding: 3, resource: { buffer: receiptBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder({
      label: 'ulg-schroeder-spatial-topology-transition-encoder'
    });
    const comparePass = encoder.beginComputePass({
      label: 'ulg-schroeder-spatial-topology-transition-compare-pass'
    });
    comparePass.setPipeline(pipelines.compare.pipeline);
    comparePass.setBindGroup(0, bindGroup);
    comparePass.dispatchWorkgroups(workgroupCount);
    comparePass.end();
    const sealPass = encoder.beginComputePass({
      label: 'ulg-schroeder-spatial-topology-transition-seal-pass'
    });
    sealPass.setPipeline(pipelines.seal.pipeline);
    sealPass.setBindGroup(0, bindGroup);
    sealPass.dispatchWorkgroups(1);
    sealPass.end();
    encoder.copyBufferToBuffer(
      receiptBuffer,
      0,
      readbackBuffer,
      0,
      SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_BYTES
    );
    device.queue.submit([encoder.finish()]);
    await mapReceiptOrDeviceLoss(device, readbackBuffer);
    mapped = true;
    const words = new Uint32Array(
      readbackBuffer.getMappedRange(),
      0,
      SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_BYTES / 4
    ).slice();
    const [
      magic,
      version,
      observedGenerationId,
      observedNonce,
      observedSourceEpoch,
      observedSourceCount,
      observedSuccessorCount,
      observedComparisonCount,
      comparePassCount,
      visitedCount,
      sourceActiveCount,
      successorActiveCount,
      activatedCount,
      deactivatedCount,
      activeMaskXorCount,
      invalidSourceMassCount,
      invalidSuccessorMassCount,
      observedForceAdvance,
      sealPassCount,
      topologyChangedWord,
      nextTopologyEpoch,
      status,
      ,
      finalSeal
    ] = words;
    const arithmeticValid =
      sourceActiveCount + activatedCount
      === successorActiveCount + deactivatedCount;
    const expectedChanged = activeMaskXorCount > 0 || forceTopologyAdvance;
    const expectedNextEpoch = expectedChanged
      ? resolvedSourceEpoch + 1
      : resolvedSourceEpoch;
    if (status === SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS.EPOCH_EXHAUSTED) {
      throw transitionError(
        'topology changed at UINT_MAX; topologyEpoch cannot advance without wraparound',
        'EPOCH_EXHAUSTED'
      );
    }
    if (
      magic !== SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_MAGIC
      || version !== SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_VERSION
      || observedGenerationId !== generationId
      || observedNonce !== submissionNonce
      || observedSourceEpoch !== resolvedSourceEpoch
      || observedSourceCount !== resolvedSourceCount
      || observedSuccessorCount !== resolvedSuccessorCount
      || observedComparisonCount !== comparisonParticleCount
      || comparePassCount !== 1
      || visitedCount !== comparisonParticleCount
      || activeMaskXorCount !== activatedCount + deactivatedCount
      || !arithmeticValid
      || invalidSourceMassCount !== 0
      || invalidSuccessorMassCount !== 0
      || observedForceAdvance !== (forceTopologyAdvance ? 1 : 0)
      || sealPassCount !== 1
      || topologyChangedWord !== (expectedChanged ? 1 : 0)
      || status !== SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS.COMPLETE
      || finalSeal !== SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_FINAL_SEAL
      || nextTopologyEpoch !== expectedNextEpoch
    ) {
      throw transitionError(
        'GPU topology transition receipt is missing, rejected, or internally inconsistent',
        'OBSERVATION'
      );
    }
    const receipt = Object.freeze({
      schema: ULG_SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_RECEIPT_SCHEMA,
      executionSchema:
        ULG_SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_EXECUTION_SCHEMA,
      status: 'schroeder-spatial-topology-transition-observed',
      ready: true,
      admitted: true,
      gpuAuthenticated: true,
      deviceId: webGpuDeviceId(device),
      generationId,
      submissionNonce,
      sourceTopologyEpoch: resolvedSourceEpoch,
      nextTopologyEpoch,
      sourceParticleCount: resolvedSourceCount,
      successorParticleCount: resolvedSuccessorCount,
      comparisonParticleCount,
      sourceActiveCount,
      successorActiveCount,
      activatedCount,
      deactivatedCount,
      activeMaskXorCount,
      invalidSourceMassCount,
      invalidSuccessorMassCount,
      forceTopologyAdvance: Boolean(forceTopologyAdvance),
      topologyChanged: expectedChanged,
      comparePassCount,
      sealPassCount,
      visitedCount,
      compactReadbackByteLength:
        SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_BYTES,
      fullParticleReadbackPerformed: false
    });
    receiptRecords.set(receipt, Object.freeze({
      device,
      generation,
      sourceStateBuffer: canonicalSourceStateBuffer,
      successorStateBuffer: resolvedSuccessorStateBuffer,
      sourceParticleCount: resolvedSourceCount,
      successorParticleCount: resolvedSuccessorCount,
      sourceTopologyEpoch: resolvedSourceEpoch,
      nextTopologyEpoch,
      forceTopologyAdvance: Boolean(forceTopologyAdvance)
    }));
    finalizedReceipts.add(receipt);
    return receipt;
  } finally {
    if (mapped) readbackBuffer.unmap?.();
    readbackBuffer.destroy?.();
    receiptBuffer.destroy?.();
    paramsBuffer.destroy?.();
  }
}

export function isFinalizedSchroederSpatialTopologyTransitionReceipt(receipt) {
  return finalizedReceipts.has(receipt) && receiptRecords.has(receipt);
}

/** Stamp the observed epoch onto both members of one exact successor family. */
export function applySchroederSpatialTopologyTransitionReceipt(
  nextParticleUploads,
  receipt,
  { generation = null } = {}
) {
  const record = receiptRecords.get(receipt);
  const sphUpload = nextParticleUploads?.sphParticleUpload ?? null;
  const mlsUpload = nextParticleUploads?.mlsMpmParticleUpload ?? null;
  if (
    !record
    || !finalizedReceipts.has(receipt)
    || (generation != null && record.generation !== generation)
    || !sphUpload
    || !mlsUpload
    || sphUpload.stateBuffer !== record.successorStateBuffer
    || sphUpload.particleCount !== record.successorParticleCount
    || mlsUpload.particleCount !== record.successorParticleCount
  ) {
    throw transitionError(
      'topology receipt does not identify the exact successor upload family',
      'SUCCESSOR_IDENTITY'
    );
  }
  sphUpload.topologyEpoch = record.nextTopologyEpoch;
  mlsUpload.topologyEpoch = record.nextTopologyEpoch;
  sphUpload.topologyTransitionStatus = receipt.status;
  mlsUpload.topologyTransitionStatus = receipt.status;
  nextParticleUploads.schroederSpatialTopologyTransitionReceipt = receipt;
  return nextParticleUploads;
}

/**
 * Validate the exact module-issued and already-applied transition receipt.
 * Structural copies deliberately fail: publication authority is object-owned.
 */
export function validateSchroederSpatialTopologyTransitionReceipt(
  receipt,
  { generation, nextParticleUploads } = {}
) {
  const record = receiptRecords.get(receipt);
  const sphUpload = nextParticleUploads?.sphParticleUpload ?? null;
  const mlsUpload = nextParticleUploads?.mlsMpmParticleUpload ?? null;
  return Boolean(
    record
    && finalizedReceipts.has(receipt)
    && record.generation === generation
    && nextParticleUploads?.schroederSpatialTopologyTransitionReceipt === receipt
    && sphUpload
    && mlsUpload
    && sphUpload.stateBuffer === record.successorStateBuffer
    && sphUpload.particleCount === record.successorParticleCount
    && mlsUpload.particleCount === record.successorParticleCount
    && sphUpload.topologyEpoch === record.nextTopologyEpoch
    && mlsUpload.topologyEpoch === record.nextTopologyEpoch
  );
}
