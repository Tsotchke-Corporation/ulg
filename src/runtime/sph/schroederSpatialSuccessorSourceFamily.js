import {
  validateSchroederSpatialTopologyTransitionReceipt
} from './schroederSpatialTopologyTransitionGpu.js';
import {
  validateSchroederSpatialEpochTransactionCommit
} from './schroederSpatialEpochTransaction.js';
import {
  admitSchroederPostClosureLevelAssignment,
  validateSchroederPostClosureLevelAssignment
} from './schroederFrozenLevelAssignmentRefreshGpu.js';
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

export const ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_SCHEMA =
  'peercompute.ulg.schroeder-committed-successor-source-family.v1';
export const ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_SCHEMA =
  'peercompute.ulg.schroeder-committed-successor-source-family-lease.v1';
export const ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LIVENESS_SCHEMA =
  'peercompute.ulg.schroeder-committed-successor-source-family-liveness.v1';
export const ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_RELEASE_SCHEMA =
  'peercompute.ulg.schroeder-committed-successor-source-family-lease-release.v1';
export const ULG_SCHROEDER_SPATIAL_SUCCESSOR_BUFFER_FAMILY_ALLOCATION_SCHEMA =
  'peercompute.ulg.schroeder-successor-buffer-family-allocation.v1';
export const ULG_SCHROEDER_SPATIAL_SUCCESSOR_PUBLICATION_PLAN_SCHEMA =
  'peercompute.ulg.schroeder-successor-source-family-publication-plan.v1';
export const ULG_SCHROEDER_SPATIAL_SUCCESSOR_PUBLICATION_RECEIPT_SCHEMA =
  'peercompute.ulg.schroeder-successor-source-family-publication-receipt.v1';
export const ULG_SCHROEDER_SPATIAL_SUCCESSOR_RETIREMENT_RECEIPT_SCHEMA =
  'peercompute.ulg.schroeder-successor-source-family-retirement-receipt.v1';
export const ULG_SCHROEDER_SPATIAL_SUCCESSOR_LEVEL_ASSIGNMENT_SEAL_SCHEMA =
  'peercompute.ulg.schroeder-successor-level-assignment-seal.v1';
export const ULG_SCHROEDER_SPATIAL_POSITION_TRANSITION_RECEIPT_SCHEMA =
  'peercompute.ulg.schroeder-spatial-position-transition-receipt.v1';

export const SCHROEDER_SPATIAL_POSITION_TRANSITION_MAGIC = 0x53535058;
export const SCHROEDER_SPATIAL_POSITION_TRANSITION_VERSION = 1;
export const SCHROEDER_SPATIAL_POSITION_TRANSITION_FINAL_SEAL = 0x504f5349;
export const SCHROEDER_SPATIAL_POSITION_TRANSITION_STATUS = Object.freeze({
  INCOMPLETE: 0,
  COMPLETE: 1,
  EPOCH_EXHAUSTED: 2
});

const EPOCH_FIELDS = Object.freeze([
  'storageGeneration',
  'physicsTick',
  'physicsSubstep',
  'positionEpoch',
  'topologyEpoch',
  'chartEpoch',
  'levelEpoch',
  'supportEpoch'
]);

const sourceFamilyRecords = new WeakMap();
const finalizedSourceFamilies = new WeakSet();
const sourceFamilyByCommitReceipt = new WeakMap();
const sourceFamilyLeaseRecords = new WeakMap();
const bufferFamilyAllocationStateByDevice = new WeakMap();
const bufferFamilyAllocationRecords = new WeakMap();
const successorPublicationPlanRecords = new WeakMap();
const preparedSuccessorPublicationPlans = new WeakSet();
const successorPublicationReceiptRecords = new WeakMap();
const successorLevelAssignmentSealRecords = new WeakMap();
const positionTransitionReceiptRecords = new WeakMap();
const finalizedPositionTransitionReceipts = new WeakSet();
let nextPositionTransitionSubmissionNonce = 0;

const POSITION_TRANSITION_WORKGROUP_SIZE = 64;
const POSITION_TRANSITION_PARAM_WORDS = 8;
const POSITION_TRANSITION_RECEIPT_WORDS = 20;
const POSITION_TRANSITION_RECEIPT_BYTES =
  POSITION_TRANSITION_RECEIPT_WORDS * Uint32Array.BYTES_PER_ELEMENT;
const POSITION_TRANSITION_STATE_STRIDE_WORDS = 8;
const POSITION_TRANSITION_GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
});
const POSITION_TRANSITION_GPU_MAP_MODE = Object.freeze({
  READ: globalThis.GPUMapMode?.READ ?? 1
});

const schroederSpatialPositionTransitionWgsl = /* wgsl */ `
struct PositionTransitionParams {
  source_count: u32,
  successor_count: u32,
  generation_id: u32,
  submission_nonce: u32,
  source_position_epoch: u32,
  version: u32,
  magic: u32,
  reserved: u32,
};

@group(0) @binding(0)
var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1)
var<storage, read> successor_state: array<vec4<f32>>;
@group(0) @binding(2)
var<uniform> params: PositionTransitionParams;
@group(0) @binding(3)
var<storage, read_write> receipt: array<atomic<u32>>;

const F32_MAX: f32 = 3.4028234663852886e38;

fn finite_vec3(value: vec3<f32>) -> bool {
  return all(abs(value) <= vec3<f32>(F32_MAX));
}

@compute @workgroup_size(${POSITION_TRANSITION_WORKGROUP_SIZE})
fn compare_position(@builtin(global_invocation_id) gid: vec3<u32>) {
  let particle_index = gid.x;
  let comparison_count = max(params.source_count, params.successor_count);
  if (particle_index >= comparison_count) {
    return;
  }
  atomicAdd(&receipt[8], 1u);
  if (
    particle_index >= params.source_count
    || particle_index >= params.successor_count
  ) {
    return;
  }
  let source_row0 = source_state[particle_index * 2u];
  let successor_row0 = successor_state[particle_index * 2u];
  let source_active =
    source_row0.w > 0.0 && source_row0.w <= F32_MAX;
  let successor_active =
    successor_row0.w > 0.0 && successor_row0.w <= F32_MAX;
  if (!source_active || !successor_active) {
    return;
  }
  atomicAdd(&receipt[9], 1u);
  let source_position = source_row0.xyz;
  let successor_position = successor_row0.xyz;
  if (!finite_vec3(source_position)) {
    atomicAdd(&receipt[11], 1u);
    return;
  }
  if (!finite_vec3(successor_position)) {
    atomicAdd(&receipt[12], 1u);
    return;
  }
  if (any(source_position != successor_position)) {
    atomicAdd(&receipt[10], 1u);
  }
}

@compute @workgroup_size(1)
fn seal_position() {
  let prior_seal_count = atomicAdd(&receipt[13], 1u);
  let comparison_count = max(params.source_count, params.successor_count);
  atomicStore(&receipt[0], params.magic);
  atomicStore(&receipt[1], params.version);
  atomicStore(&receipt[2], params.generation_id);
  atomicStore(&receipt[3], params.submission_nonce);
  atomicStore(&receipt[4], params.source_position_epoch);
  atomicStore(&receipt[5], params.source_count);
  atomicStore(&receipt[6], params.successor_count);
  atomicStore(&receipt[7], comparison_count);
  let visited_count = atomicLoad(&receipt[8]);
  let moved_count = atomicLoad(&receipt[10]);
  let invalid_source_count = atomicLoad(&receipt[11]);
  let invalid_successor_count = atomicLoad(&receipt[12]);
  let position_changed = moved_count > 0u;
  atomicStore(&receipt[14], select(0u, 1u, position_changed));
  atomicStore(&receipt[15], params.source_position_epoch);
  atomicStore(
    &receipt[16],
    ${SCHROEDER_SPATIAL_POSITION_TRANSITION_STATUS.INCOMPLETE}u
  );
  atomicStore(&receipt[19], 0u);
  if (
    prior_seal_count != 0u
    || visited_count != comparison_count
    || invalid_source_count != 0u
    || invalid_successor_count != 0u
  ) {
    return;
  }
  if (position_changed && params.source_position_epoch == 0xffffffffu) {
    atomicStore(
      &receipt[16],
      ${SCHROEDER_SPATIAL_POSITION_TRANSITION_STATUS.EPOCH_EXHAUSTED}u
    );
    return;
  }
  atomicStore(
    &receipt[15],
    params.source_position_epoch + select(0u, 1u, position_changed)
  );
  atomicStore(
    &receipt[16],
    ${SCHROEDER_SPATIAL_POSITION_TRANSITION_STATUS.COMPLETE}u
  );
  atomicStore(
    &receipt[19],
    ${SCHROEDER_SPATIAL_POSITION_TRANSITION_FINAL_SEAL}u
  );
}
`;

function sourceFamilyError(message, suffix = 'IDENTITY') {
  const error = new Error(message);
  error.code = `ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_${suffix}`;
  return error;
}

function exactU32(value, label, { positive = false } = {}) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < (positive ? 1 : 0)
    || value > 0xffff_ffff
  ) {
    throw sourceFamilyError(
      `${label} must be an exact ${positive ? 'positive ' : ''}u32`
    );
  }
  return value;
}

function incrementExactU32(value, label, { positive = false } = {}) {
  const current = exactU32(value, label, { positive });
  if (current === 0xffff_ffff) {
    throw sourceFamilyError(
      `${label} exhausted the u32 identity space; wrapping would alias a live epoch`,
      'IDENTITY_EXHAUSTED'
    );
  }
  return current + 1;
}

function nextPositionTransitionNonce() {
  nextPositionTransitionSubmissionNonce =
    (nextPositionTransitionSubmissionNonce % 0xffff_fffe) + 1;
  return nextPositionTransitionSubmissionNonce;
}

function createPositionTransitionBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage }),
    device
  );
}

function positionTransitionPipelinePair(device) {
  const bindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'uniform'),
    computeBufferBinding(3, 'storage')
  ];
  const compare = createCachedExplicitComputePipeline(device, {
    cacheKey: 'schroeder-spatial-position-transition-v1-layout-v1',
    label: 'ulg-schroeder-spatial-position-transition-compare',
    code: schroederSpatialPositionTransitionWgsl,
    entryPoint: 'compare_position',
    bindings
  });
  const seal = createCachedExplicitComputePipeline(device, {
    cacheKey: 'schroeder-spatial-position-transition-v1-layout-v1',
    label: 'ulg-schroeder-spatial-position-transition-seal',
    code: schroederSpatialPositionTransitionWgsl,
    entryPoint: 'seal_position',
    bindings
  });
  return { compare, seal };
}

async function mapPositionReceiptOrDeviceLoss(device, readbackBuffer) {
  const mapPromise = readbackBuffer.mapAsync(
    POSITION_TRANSITION_GPU_MAP_MODE.READ
  );
  if (!device?.lost?.then) {
    await mapPromise;
    return;
  }
  await Promise.race([
    mapPromise,
    Promise.resolve(device.lost).then((info) => {
      throw sourceFamilyError(
        `device lost before position receipt observation${
          info?.message ? `: ${info.message}` : ''
        }`,
        'POSITION_TRANSITION_DEVICE_LOST'
      );
    })
  ]);
}

/**
 * Observe actual resident position mutation with a fixed-size GPU receipt.
 * Mapping this receipt is also the terminal outcome for every same-queue
 * mechanics/closure submission that produced the exact successor state.
 */
export async function runSchroederSpatialPositionTransitionWebGpu({
  device,
  generation,
  sourceStateBuffer = generation?.source?.sourceStateBuffer,
  sourceParticleCount = generation?.source?.sourceCount,
  sourceStateStrideBytes =
    POSITION_TRANSITION_STATE_STRIDE_WORDS * Float32Array.BYTES_PER_ELEMENT,
  successorStateBuffer,
  successorParticleCount,
  successorStateStrideBytes =
    POSITION_TRANSITION_STATE_STRIDE_WORDS * Float32Array.BYTES_PER_ELEMENT,
  sourcePositionEpoch = generation?.execution?.positionEpoch
} = {}) {
  if (
    !device?.createBuffer
    || !device?.createCommandEncoder
    || !device?.createBindGroup
    || !device?.queue?.writeBuffer
    || !device?.queue?.submit
  ) {
    throw new TypeError(
      'position transition requires a WebGPU-like device and queue'
    );
  }
  if (
    generation?.selected !== true
    || generation?.ready !== true
    || generation?.execution?.released === true
    || generation?.releaseScheduled === true
  ) {
    throw sourceFamilyError(
      'position transition requires one live selected canonical generation',
      'POSITION_TRANSITION_GENERATION'
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
    sourcePositionEpoch,
    'sourcePositionEpoch'
  );
  const requiredStateStrideBytes =
    POSITION_TRANSITION_STATE_STRIDE_WORDS * Float32Array.BYTES_PER_ELEMENT;
  if (
    exactU32(sourceStateStrideBytes, 'sourceStateStrideBytes', {
      positive: true
    }) !== requiredStateStrideBytes
    || exactU32(successorStateStrideBytes, 'successorStateStrideBytes', {
      positive: true
    }) !== requiredStateStrideBytes
  ) {
    throw sourceFamilyError(
      `position transition requires the exact ${requiredStateStrideBytes}-byte state ABI`,
      'POSITION_TRANSITION_LAYOUT'
    );
  }
  if (
    generation.source?.sourceCount !== resolvedSourceCount
    || generation.execution?.sourceCount !== resolvedSourceCount
    || generation.execution?.positionEpoch !== resolvedSourceEpoch
  ) {
    throw sourceFamilyError(
      'position transition count or epoch does not match the canonical generation',
      'POSITION_TRANSITION_IDENTITY'
    );
  }
  const canonicalSourceStateBuffer = exactBuffer(
    device,
    generation.source?.sourceStateBuffer,
    'canonical E* position source state'
  );
  if (sourceStateBuffer !== canonicalSourceStateBuffer) {
    throw sourceFamilyError(
      'position transition source state is not the exact canonical E* state',
      'POSITION_TRANSITION_IDENTITY'
    );
  }
  const resolvedSuccessorStateBuffer = exactBuffer(
    device,
    successorStateBuffer,
    'final successor position state'
  );
  requireCapacity(
    canonicalSourceStateBuffer,
    resolvedSourceCount,
    requiredStateStrideBytes,
    'canonical position source state'
  );
  requireCapacity(
    resolvedSuccessorStateBuffer,
    resolvedSuccessorCount,
    requiredStateStrideBytes,
    'successor position state'
  );
  const comparisonParticleCount = Math.max(
    resolvedSourceCount,
    resolvedSuccessorCount
  );
  const workgroupCount = Math.ceil(
    comparisonParticleCount / POSITION_TRANSITION_WORKGROUP_SIZE
  );
  const maxWorkgroups = Number(device?.limits?.maxComputeWorkgroupsPerDimension);
  if (
    Number.isFinite(maxWorkgroups)
    && maxWorkgroups > 0
    && workgroupCount > maxWorkgroups
  ) {
    throw sourceFamilyError(
      `position comparison needs ${workgroupCount} workgroups; device limit is ${maxWorkgroups}`,
      'POSITION_TRANSITION_DISPATCH_LIMIT'
    );
  }
  const submissionNonce = nextPositionTransitionNonce();
  const paramsBuffer = createPositionTransitionBuffer(
    device,
    'ulg-schroeder-spatial-position-transition-params',
    POSITION_TRANSITION_PARAM_WORDS * Uint32Array.BYTES_PER_ELEMENT,
    POSITION_TRANSITION_GPU_BUFFER_USAGE.UNIFORM
      | POSITION_TRANSITION_GPU_BUFFER_USAGE.COPY_DST
  );
  const receiptBuffer = createPositionTransitionBuffer(
    device,
    'ulg-schroeder-spatial-position-transition-receipt',
    POSITION_TRANSITION_RECEIPT_BYTES,
    POSITION_TRANSITION_GPU_BUFFER_USAGE.STORAGE
      | POSITION_TRANSITION_GPU_BUFFER_USAGE.COPY_SRC
      | POSITION_TRANSITION_GPU_BUFFER_USAGE.COPY_DST
  );
  const readbackBuffer = createPositionTransitionBuffer(
    device,
    'ulg-schroeder-spatial-position-transition-compact-readback',
    POSITION_TRANSITION_RECEIPT_BYTES,
    POSITION_TRANSITION_GPU_BUFFER_USAGE.MAP_READ
      | POSITION_TRANSITION_GPU_BUFFER_USAGE.COPY_DST
  );
  let mapped = false;
  try {
    device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([
      resolvedSourceCount,
      resolvedSuccessorCount,
      generationId,
      submissionNonce,
      resolvedSourceEpoch,
      SCHROEDER_SPATIAL_POSITION_TRANSITION_VERSION,
      SCHROEDER_SPATIAL_POSITION_TRANSITION_MAGIC,
      0
    ]));
    device.queue.writeBuffer(
      receiptBuffer,
      0,
      new Uint32Array(POSITION_TRANSITION_RECEIPT_WORDS)
    );
    const pipelines = positionTransitionPipelinePair(device);
    const bindGroup = device.createBindGroup({
      label: 'ulg-schroeder-spatial-position-transition-bind-group',
      layout: pipelines.compare.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: canonicalSourceStateBuffer } },
        { binding: 1, resource: { buffer: resolvedSuccessorStateBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } },
        { binding: 3, resource: { buffer: receiptBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder({
      label: 'ulg-schroeder-spatial-position-transition-encoder'
    });
    const comparePass = encoder.beginComputePass({
      label: 'ulg-schroeder-spatial-position-transition-compare-pass'
    });
    comparePass.setPipeline(pipelines.compare.pipeline);
    comparePass.setBindGroup(0, bindGroup);
    comparePass.dispatchWorkgroups(workgroupCount);
    comparePass.end();
    const sealPass = encoder.beginComputePass({
      label: 'ulg-schroeder-spatial-position-transition-seal-pass'
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
      POSITION_TRANSITION_RECEIPT_BYTES
    );
    device.queue.submit([encoder.finish()]);
    await mapPositionReceiptOrDeviceLoss(device, readbackBuffer);
    mapped = true;
    const words = new Uint32Array(
      readbackBuffer.getMappedRange(),
      0,
      POSITION_TRANSITION_RECEIPT_WORDS
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
      visitedCount,
      comparedActiveCount,
      movedParticleCount,
      invalidSourcePositionCount,
      invalidSuccessorPositionCount,
      sealPassCount,
      positionChangedWord,
      nextPositionEpoch,
      status,
      ,
      ,
      finalSeal
    ] = words;
    const expectedChanged = movedParticleCount > 0;
    const expectedNextPositionEpoch = expectedChanged
      ? resolvedSourceEpoch + 1
      : resolvedSourceEpoch;
    if (
      status
        === SCHROEDER_SPATIAL_POSITION_TRANSITION_STATUS.EPOCH_EXHAUSTED
    ) {
      throw sourceFamilyError(
        'position changed at UINT_MAX; positionEpoch cannot advance without wraparound',
        'POSITION_TRANSITION_EPOCH_EXHAUSTED'
      );
    }
    if (
      magic !== SCHROEDER_SPATIAL_POSITION_TRANSITION_MAGIC
      || version !== SCHROEDER_SPATIAL_POSITION_TRANSITION_VERSION
      || observedGenerationId !== generationId
      || observedNonce !== submissionNonce
      || observedSourceEpoch !== resolvedSourceEpoch
      || observedSourceCount !== resolvedSourceCount
      || observedSuccessorCount !== resolvedSuccessorCount
      || observedComparisonCount !== comparisonParticleCount
      || visitedCount !== comparisonParticleCount
      || comparedActiveCount > Math.min(
        resolvedSourceCount,
        resolvedSuccessorCount
      )
      || movedParticleCount > comparedActiveCount
      || invalidSourcePositionCount !== 0
      || invalidSuccessorPositionCount !== 0
      || sealPassCount !== 1
      || positionChangedWord !== (expectedChanged ? 1 : 0)
      || nextPositionEpoch !== expectedNextPositionEpoch
      || status !== SCHROEDER_SPATIAL_POSITION_TRANSITION_STATUS.COMPLETE
      || finalSeal !== SCHROEDER_SPATIAL_POSITION_TRANSITION_FINAL_SEAL
    ) {
      throw sourceFamilyError(
        'GPU position transition receipt is missing, rejected, or internally inconsistent',
        'POSITION_TRANSITION_OBSERVATION'
      );
    }
    const receipt = Object.freeze({
      schema: ULG_SCHROEDER_SPATIAL_POSITION_TRANSITION_RECEIPT_SCHEMA,
      status: 'schroeder-spatial-position-transition-observed',
      ready: true,
      admitted: true,
      gpuAuthenticated: true,
      deviceId: webGpuDeviceId(device),
      generationId,
      submissionNonce,
      sourcePositionEpoch: resolvedSourceEpoch,
      nextPositionEpoch,
      sourceParticleCount: resolvedSourceCount,
      successorParticleCount: resolvedSuccessorCount,
      comparisonParticleCount,
      comparedActiveCount,
      movedParticleCount,
      invalidSourcePositionCount,
      invalidSuccessorPositionCount,
      positionChanged: expectedChanged,
      comparePassCount: 1,
      sealPassCount,
      visitedCount,
      compactReadbackByteLength: POSITION_TRANSITION_RECEIPT_BYTES,
      fullParticleReadbackPerformed: false,
      terminalQueueOutcomeObserved: true
    });
    positionTransitionReceiptRecords.set(receipt, Object.freeze({
      device,
      generation,
      sourceStateBuffer: canonicalSourceStateBuffer,
      successorStateBuffer: resolvedSuccessorStateBuffer,
      sourceParticleCount: resolvedSourceCount,
      successorParticleCount: resolvedSuccessorCount,
      sourcePositionEpoch: resolvedSourceEpoch,
      nextPositionEpoch
    }));
    finalizedPositionTransitionReceipts.add(receipt);
    return receipt;
  } finally {
    if (mapped) readbackBuffer.unmap?.();
    readbackBuffer.destroy?.();
    receiptBuffer.destroy?.();
    paramsBuffer.destroy?.();
  }
}

export function applySchroederSpatialPositionTransitionReceipt(
  nextParticleUploads,
  receipt,
  { generation = null } = {}
) {
  const record = positionTransitionReceiptRecords.get(receipt);
  const sphUpload = nextParticleUploads?.sphParticleUpload ?? null;
  const mlsUpload = nextParticleUploads?.mlsMpmParticleUpload ?? null;
  if (
    !record
    || !finalizedPositionTransitionReceipts.has(receipt)
    || (generation != null && record.generation !== generation)
    || !sphUpload
    || !mlsUpload
    || sphUpload.stateBuffer !== record.successorStateBuffer
    || sphUpload.particleCount !== record.successorParticleCount
    || mlsUpload.particleCount !== record.successorParticleCount
  ) {
    throw sourceFamilyError(
      'position receipt does not identify the exact successor upload family',
      'POSITION_TRANSITION_SUCCESSOR_IDENTITY'
    );
  }
  sphUpload.positionEpoch = record.nextPositionEpoch;
  mlsUpload.positionEpoch = record.nextPositionEpoch;
  sphUpload.positionTransitionStatus = receipt.status;
  mlsUpload.positionTransitionStatus = receipt.status;
  nextParticleUploads.schroederSpatialPositionTransitionReceipt = receipt;
  return nextParticleUploads;
}

export function validateSchroederSpatialPositionTransitionReceipt(
  receipt,
  { generation, nextParticleUploads } = {}
) {
  const record = positionTransitionReceiptRecords.get(receipt);
  const sphUpload = nextParticleUploads?.sphParticleUpload ?? null;
  const mlsUpload = nextParticleUploads?.mlsMpmParticleUpload ?? null;
  return Boolean(
    record
    && finalizedPositionTransitionReceipts.has(receipt)
    && record.generation === generation
    && nextParticleUploads?.schroederSpatialPositionTransitionReceipt
      === receipt
    && sphUpload
    && mlsUpload
    && sphUpload.stateBuffer === record.successorStateBuffer
    && sphUpload.particleCount === record.successorParticleCount
    && mlsUpload.particleCount === record.successorParticleCount
    && sphUpload.positionEpoch === record.nextPositionEpoch
    && mlsUpload.positionEpoch === record.nextPositionEpoch
  );
}

function requireDevice(device) {
  if (!device || (typeof device !== 'object' && typeof device !== 'function')) {
    throw sourceFamilyError('successor identity allocation requires one device', 'DEVICE');
  }
  return device;
}

/**
 * Allocate a collision-free storage-family identity on one device. Identities
 * are monotonic for the lifetime of the device and deliberately never wrap.
 */
export function allocateSchroederSpatialSuccessorBufferFamilyIdentity({
  device,
  afterStorageGeneration = 0,
  purpose = 'schroeder-successor-buffer-family'
} = {}) {
  requireDevice(device);
  const after = exactU32(
    afterStorageGeneration,
    'afterStorageGeneration'
  );
  const normalizedPurpose = typeof purpose === 'string' ? purpose.trim() : '';
  if (!normalizedPurpose) {
    throw sourceFamilyError('buffer-family allocation purpose must be non-empty', 'CONTRACT');
  }
  let state = bufferFamilyAllocationStateByDevice.get(device);
  if (!state) {
    state = { lastStorageGeneration: 0, allocationOrdinal: 0 };
    bufferFamilyAllocationStateByDevice.set(device, state);
  }
  const base = Math.max(state.lastStorageGeneration, after);
  const storageGeneration = incrementExactU32(
    base,
    'successor storage generation'
  );
  state.lastStorageGeneration = storageGeneration;
  state.allocationOrdinal += 1;
  const allocation = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_BUFFER_FAMILY_ALLOCATION_SCHEMA,
    status: 'schroeder-successor-buffer-family-identity-allocated',
    allocated: true,
    storageGeneration,
    allocationOrdinal: state.allocationOrdinal,
    purpose: normalizedPurpose,
    deviceId: webGpuDeviceId(device)
  });
  bufferFamilyAllocationRecords.set(allocation, {
    device,
    storageGeneration,
    purpose: normalizedPurpose
  });
  return allocation;
}

function exactBufferFamilyAllocation(allocation, device) {
  const record = bufferFamilyAllocationRecords.get(allocation);
  if (
    !record
    || record.device !== device
    || allocation?.schema
      !== ULG_SCHROEDER_SPATIAL_SUCCESSOR_BUFFER_FAMILY_ALLOCATION_SCHEMA
    || !Object.isFrozen(allocation)
    || allocation.allocated !== true
    || allocation.storageGeneration !== record.storageGeneration
    || allocation.deviceId !== webGpuDeviceId(device)
  ) {
    throw sourceFamilyError(
      'storage generation was not allocated by the exact same-device successor allocator',
      'STORAGE_ALLOCATION'
    );
  }
  return record;
}

function exactBuffer(device, buffer, label) {
  if (
    !buffer
    || webGpuBufferDevice(buffer) !== device
    || !webGpuBufferMatchesDevice(buffer, device)
  ) {
    throw sourceFamilyError(`${label} is not an exact live same-device buffer`);
  }
  return buffer;
}

function requireCapacity(buffer, particleCount, strideBytes, label) {
  if (
    Number.isFinite(Number(buffer?.size))
    && Number(buffer.size) < particleCount * strideBytes
  ) {
    throw sourceFamilyError(`${label} capacity is smaller than its declared family`);
  }
}

function requirePairwiseDistinctBuffers(buffers) {
  const entries = Object.entries(buffers);
  if (new Set(entries.map(([, buffer]) => buffer)).size !== entries.length) {
    const aliases = entries
      .filter(([, buffer], index) => (
        entries.findIndex(([, candidate]) => candidate === buffer) !== index
      ))
      .map(([name]) => name);
    throw sourceFamilyError(
      `successor state, thermo, identity, and mechanics buffers must be pairwise distinct${
        aliases.length ? ` (aliases: ${aliases.join(', ')})` : ''
      }`,
      'BUFFER_ALIAS'
    );
  }
}

function exactEpochPair(sphUpload, mlsUpload) {
  const epochIdentity = {};
  for (const field of EPOCH_FIELDS) {
    const sphValue = exactU32(
      sphUpload[field],
      `sphParticleUpload.${field}`,
      { positive: field === 'storageGeneration' }
    );
    const mlsValue = exactU32(
      mlsUpload[field],
      `mlsMpmParticleUpload.${field}`,
      { positive: field === 'storageGeneration' }
    );
    if (sphValue !== mlsValue) {
      throw sourceFamilyError(`successor ${field} values differ`);
    }
    epochIdentity[field] = sphValue;
  }
  return epochIdentity;
}

function validateSuccessorUploadFamily(nextParticleUploads) {
  const sphUpload = nextParticleUploads?.sphParticleUpload ?? null;
  const mlsUpload = nextParticleUploads?.mlsMpmParticleUpload ?? null;
  if (!sphUpload || !mlsUpload) {
    throw sourceFamilyError('successor publication requires SPH and MLS-MPM uploads');
  }
  const device = webGpuBufferDevice(sphUpload.stateBuffer);
  requireDevice(device);
  const particleCount = exactU32(
    sphUpload.particleCount,
    'sphParticleUpload.particleCount',
    { positive: true }
  );
  if (exactU32(mlsUpload.particleCount, 'mlsMpmParticleUpload.particleCount', {
    positive: true
  }) !== particleCount) {
    throw sourceFamilyError('successor upload counts differ');
  }
  const buffers = Object.freeze({
    stateBuffer: exactBuffer(device, sphUpload.stateBuffer, 'successor state'),
    thermoBuffer: exactBuffer(device, sphUpload.thermoBuffer, 'successor thermo'),
    identityBuffer: exactBuffer(device, sphUpload.identityBuffer, 'successor identity'),
    mechanicsBuffer: exactBuffer(device, mlsUpload.mechanicsBuffer, 'successor mechanics')
  });
  requirePairwiseDistinctBuffers(buffers);
  const strides = Object.freeze({
    stateStrideBytes: exactU32(
      sphUpload.stateStrideBytes,
      'sphParticleUpload.stateStrideBytes',
      { positive: true }
    ),
    thermoStrideBytes: exactU32(
      sphUpload.thermoStrideBytes,
      'sphParticleUpload.thermoStrideBytes',
      { positive: true }
    ),
    identityStrideBytes: exactU32(
      sphUpload.identityStrideBytes,
      'sphParticleUpload.identityStrideBytes',
      { positive: true }
    ),
    mechanicsStrideBytes: exactU32(
      mlsUpload.mechanicsStrideBytes,
      'mlsMpmParticleUpload.mechanicsStrideBytes',
      { positive: true }
    )
  });
  requireCapacity(buffers.stateBuffer, particleCount, strides.stateStrideBytes, 'state');
  requireCapacity(buffers.thermoBuffer, particleCount, strides.thermoStrideBytes, 'thermo');
  requireCapacity(buffers.identityBuffer, particleCount, strides.identityStrideBytes, 'identity');
  requireCapacity(
    buffers.mechanicsBuffer,
    particleCount,
    strides.mechanicsStrideBytes,
    'mechanics'
  );
  return { device, particleCount, sphUpload, mlsUpload, buffers, strides };
}

function exactSourceEpochIdentity(generation) {
  const execution = generation?.execution;
  return Object.freeze(Object.fromEntries(EPOCH_FIELDS.map((field) => [
    field,
    exactU32(execution?.[field], `generation.execution.${field}`, {
      positive: field === 'storageGeneration'
    })
  ])));
}

function exactQueryGeometry(generation) {
  const execution = generation?.execution ?? null;
  const profile = execution?.exactNearQueryProfile ?? null;
  if (
    profile?.ready !== true
    || execution?.queryChartId !== profile.chartId
    || execution?.queryMinLevel !== profile.minLevel
    || execution?.queryMaxLevel !== profile.maxLevel
    || !Object.is(execution?.queryBaseGridSpacingM, profile.baseGridSpacingM)
  ) {
    return Object.freeze({
      authenticated: false,
      status: 'schroeder-successor-query-geometry-unavailable'
    });
  }
  return Object.freeze({
    authenticated: true,
    status: 'schroeder-successor-query-geometry-authenticated',
    mode: execution.queryGeometryMode,
    chartId: execution.queryChartId,
    minLevel: execution.queryMinLevel,
    maxLevel: execution.queryMaxLevel,
    levelCount: execution.queryLevelCount,
    baseGridSpacingM: execution.queryBaseGridSpacingM
  });
}

function normalizeComponentOwnerStages(componentOwnerStages) {
  if (componentOwnerStages == null) return Object.freeze({});
  if (typeof componentOwnerStages !== 'object' || Array.isArray(componentOwnerStages)) {
    throw sourceFamilyError('componentOwnerStages must be an object', 'CONTRACT');
  }
  return Object.freeze(Object.fromEntries(
    Object.entries(componentOwnerStages).map(([component, owner]) => {
      const ownerStage = typeof owner === 'string' ? owner : owner?.ownerStage;
      if (typeof ownerStage !== 'string' || ownerStage.length === 0) {
        throw sourceFamilyError(
          `componentOwnerStages.${component} must be a non-empty string`,
          'CONTRACT'
        );
      }
      return [component, ownerStage];
    })
  ));
}

function normalizedReason(value, fallback) {
  const candidates = [
    typeof value === 'string' ? value : null,
    typeof value?.message === 'string' ? value.message : null,
    typeof value?.reason === 'string' ? value.reason : null
  ];
  for (const candidate of candidates) {
    const reason = candidate?.trim();
    if (reason) return reason;
  }
  return fallback;
}

function exactSourceFamilyRecord(
  sourceFamily,
  { device = null, requireDevice = false } = {}
) {
  const record = sourceFamilyRecords.get(sourceFamily);
  if (
    !record
    || !finalizedSourceFamilies.has(sourceFamily)
    || sourceFamily?.schema !== ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_SCHEMA
    || !Object.isFrozen(sourceFamily)
    || sourceFamily.ready !== true
    || sourceFamily.authenticated !== true
    || sourceFamily.spatialQueryAuthority !== false
    || (requireDevice && record.device !== device)
    || (device != null && record.device !== device)
    || (device != null && sourceFamily.deviceId !== webGpuDeviceId(device))
  ) {
    throw sourceFamilyError(
      'source family does not identify the exact committed same-device continuation'
    );
  }
  return record;
}

function sourceFamilyLivenessSummary(sourceFamily, record) {
  const status = record.deviceLost
    ? 'schroeder-successor-source-family-device-lost-quarantined'
    : (record.active
      ? (record.leaseCount > 0
        ? 'schroeder-successor-source-family-active-leased'
        : 'schroeder-successor-source-family-active')
      : (record.retired
        ? 'schroeder-successor-source-family-retired'
        : 'schroeder-successor-source-family-retirement-requested'));
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LIVENESS_SCHEMA,
    status,
    active: record.active,
    retired: record.retired,
    quarantined: record.deviceLost,
    deviceLost: record.deviceLost,
    reason: record.reason,
    leaseCount: record.leaseCount,
    retirementRequested: record.retirementRequested === true,
    retirementFenceSettled: record.retirementFenceSettled === true,
    retirementBlocked: (
      record.leaseCount > 0
      || (record.retirementRequested === true
        && record.retirementFenceSettled !== true)
    ),
    ownsBuffers: false,
    ownsSuccessorLevelAssignment: record.ownsSuccessorLevelAssignment === true,
    successorLevelAssignmentDestroyed:
      record.successorLevelAssignmentDestroyed === true,
    sourceGenerationId: sourceFamily.sourceGenerationId,
    deviceId: sourceFamily.deviceId
  });
}

function destroyOwnedSuccessorLevelAssignment(record) {
  if (
    record.ownsSuccessorLevelAssignment !== true
    || record.successorLevelAssignmentDestroyed === true
  ) return false;
  record.successorLevelAssignment.destroyAssignmentBuffer?.();
  record.successorLevelAssignmentDestroyed = true;
  return true;
}

function requireActiveSourceFamily(record) {
  if (record.deviceLost) {
    destroyOwnedSuccessorLevelAssignment(record);
    throw sourceFamilyError(
      `successor source family is quarantined after device loss: ${record.reason}`,
      'DEVICE_LOST'
    );
  }
  if (record.retired) {
    throw sourceFamilyError(
      `successor source family is retired: ${record.reason}`,
      'RETIRED'
    );
  }
  if (record.retirementRequested) {
    throw sourceFamilyError(
      `successor source family retirement was requested: ${record.reason}`,
      'RETIREMENT_REQUESTED'
    );
  }
  if (!record.active) {
    throw sourceFamilyError(
      `successor source family is retired: ${record.reason}`,
      'RETIRED'
    );
  }
}

function retirementReceipt(sourceFamily, record, status) {
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_RETIREMENT_RECEIPT_SCHEMA,
    status,
    settled: record.retired === true || record.deviceLost === true,
    retired: record.retired,
    quarantined: record.deviceLost,
    deviceLost: record.deviceLost,
    reason: record.reason,
    remainingLeaseCount: record.leaseCount,
    sourceGenerationId: sourceFamily.sourceGenerationId,
    deviceId: sourceFamily.deviceId
  });
}

function settleRequestedRetirement(sourceFamily, record) {
  if (!record.retirementRequested || record.retirementSettled) return false;
  if (record.deviceLost) {
    record.retirementSettled = true;
    record.resolveRetirement?.(retirementReceipt(
      sourceFamily,
      record,
      'schroeder-successor-source-family-device-lost-quarantined'
    ));
    return true;
  }
  if (!record.retirementFenceSettled || record.leaseCount > 0) return false;
  record.active = false;
  record.retired = true;
  destroyOwnedSuccessorLevelAssignment(record);
  record.retirementSettled = true;
  record.resolveRetirement?.(retirementReceipt(
    sourceFamily,
    record,
    'schroeder-successor-source-family-retired-after-leases'
  ));
  return true;
}

function quarantineSourceFamilyAfterDeviceLoss(sourceFamily, record, info) {
  record.active = false;
  record.deviceLost = true;
  record.reason = normalizedReason(info, 'WebGPU device lost');
  destroyOwnedSuccessorLevelAssignment(record);
  settleRequestedRetirement(sourceFamily, record);
}

function watchSourceFamilyDeviceLoss(sourceFamily, device) {
  let deviceLoss;
  try {
    deviceLoss = device?.lost;
  } catch {
    return;
  }
  if (!deviceLoss || typeof deviceLoss.then !== 'function') return;
  let quarantineAfterLoss;
  if (typeof WeakRef === 'function') {
    const sourceFamilyRef = new WeakRef(sourceFamily);
    quarantineAfterLoss = (info) => {
      const liveSourceFamily = sourceFamilyRef.deref();
      const liveRecord = liveSourceFamily
        ? sourceFamilyRecords.get(liveSourceFamily)
        : null;
      if (liveRecord) {
        quarantineSourceFamilyAfterDeviceLoss(liveSourceFamily, liveRecord, info);
      }
    };
  } else {
    quarantineAfterLoss = (info) => {
      const liveRecord = sourceFamilyRecords.get(sourceFamily);
      if (liveRecord) quarantineSourceFamilyAfterDeviceLoss(sourceFamily, liveRecord, info);
    };
  }
  Promise.resolve(deviceLoss).then(
    quarantineAfterLoss,
    quarantineAfterLoss
  );
}

function reserveSuccessorPublicationSlot(nextParticleUploads) {
  if (!nextParticleUploads || typeof nextParticleUploads !== 'object') {
    throw sourceFamilyError('successor publication requires a mutable upload envelope');
  }
  for (const key of [
    'schroederSpatialSuccessorSourceFamily',
    'schroederSpatialSuccessorLevelAssignment'
  ]) {
    const existing = Object.getOwnPropertyDescriptor(nextParticleUploads, key);
    if (existing) {
      if (
        !('value' in existing)
        || existing.value != null
        || existing.writable !== true
      ) {
        throw sourceFamilyError(
          `successor publication slot ${key} is already occupied or not writable`,
          'PUBLICATION_SLOT'
        );
      }
      continue;
    }
    Object.defineProperty(nextParticleUploads, key, {
      value: null,
      writable: true,
      configurable: true,
      enumerable: true
    });
  }
}

function stampSuccessorEpochIdentity(sphUpload, mlsUpload, identity) {
  for (const [field, value] of Object.entries(identity)) {
    sphUpload[field] = value;
    mlsUpload[field] = value;
  }
  sphUpload.bufferFamilyGeneration = identity.storageGeneration;
  mlsUpload.bufferFamilyGeneration = identity.storageGeneration;
  sphUpload.bufferFamilyGenerationStatus = 'schroeder-buffer-family-generation-ready';
  mlsUpload.bufferFamilyGenerationStatus = 'schroeder-buffer-family-generation-ready';
}

function preparedUploadFamilyPreserved(
  nextParticleUploads,
  sourceFamily,
  buffers,
  successorLevelAssignment
) {
  const sphUpload = nextParticleUploads?.sphParticleUpload;
  const mlsUpload = nextParticleUploads?.mlsMpmParticleUpload;
  return Boolean(
    sphUpload
    && mlsUpload
    && sphUpload.stateBuffer === buffers.stateBuffer
    && sphUpload.thermoBuffer === buffers.thermoBuffer
    && sphUpload.identityBuffer === buffers.identityBuffer
    && mlsUpload.mechanicsBuffer === buffers.mechanicsBuffer
    && sphUpload.particleCount === sourceFamily.particleCount
    && mlsUpload.particleCount === sourceFamily.particleCount
    && EPOCH_FIELDS.every((field) => (
      sphUpload[field] === sourceFamily.successorEpochIdentity[field]
      && mlsUpload[field] === sourceFamily.successorEpochIdentity[field]
    ))
    && sphUpload.bufferFamilyGeneration === sourceFamily.storageGeneration
    && mlsUpload.bufferFamilyGeneration === sourceFamily.storageGeneration
    && validateSchroederPostClosureLevelAssignment(
      successorLevelAssignment,
      { nextParticleUploads }
    )
  );
}

function newSourceFamilyRecord({
  device,
  transaction,
  commitReceipt = null,
  generation,
  nextParticleUploads,
  topologyTransitionReceipt,
  positionTransitionReceipt = null,
  positionEpochFloorReceipt = null,
  sphUpload,
  mlsUpload,
  buffers,
  successorLevelAssignment = null,
  successorLevelAssignmentSeal = null,
  storageAllocation = null
}) {
  return {
    device,
    transaction,
    commitReceipt,
    generation,
    nextParticleUploads,
    topologyTransitionReceipt,
    positionTransitionReceipt,
    positionEpochFloorReceipt,
    storageAllocation,
    sphUpload,
    mlsUpload,
    buffers,
    successorLevelAssignment,
    successorLevelAssignmentSeal,
    ownsSuccessorLevelAssignment:
      typeof successorLevelAssignment?.destroyAssignmentBuffer === 'function',
    successorLevelAssignmentRetirementScheduled: false,
    successorLevelAssignmentDestroyed: false,
    active: true,
    retired: false,
    deviceLost: false,
    reason: null,
    leaseCount: 0,
    nextLeaseOrdinal: 0,
    retirementRequested: false,
    retirementFenceSettled: false,
    retirementSettled: false,
    retirementPromise: null,
    resolveRetirement: null
  };
}

function publicationReceipt({
  status,
  published,
  sourceFamily = null,
  reason = null,
  publicationRecord = null
}) {
  const receipt = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_PUBLICATION_RECEIPT_SCHEMA,
    status,
    published,
    sourceFamily,
    reason
  });
  if (publicationRecord) {
    successorPublicationReceiptRecords.set(receipt, publicationRecord);
  }
  return receipt;
}

function retireUnpublishedSuccessorLevelAssignment(record) {
  if (
    !record
    || record.successorLevelAssignmentDestroyed === true
    || record.successorLevelAssignmentRetirementScheduled === true
  ) return;
  record.successorLevelAssignmentRetirementScheduled = true;
  let fence = null;
  try {
    fence = record.device?.queue?.onSubmittedWorkDone?.();
  } catch {
    fence = null;
  }
  const retire = () => {
    try {
      destroyOwnedSuccessorLevelAssignment(record);
    } catch {
      // Publication failure remains authoritative. A failed destroy keeps the
      // exact record quarantined rather than manufacturing a successful receipt.
    }
  };
  if (fence?.then) Promise.resolve(fence).then(retire, retire);
  else retire();
}

/**
 * Complete all fallible successor identity checks and reserve the upload
 * attachment before the physics transaction commits. No public family is
 * branded by this step.
 */
export async function prepareSchroederSpatialSuccessorSourceFamilyPublication({
  transaction,
  generation,
  lookupLevelAssignment,
  nextParticleUploads,
  successorLevelAssignmentRunner,
  topologyTransitionReceipt = null,
  positionTransitionReceipt =
    nextParticleUploads?.schroederSpatialPositionTransitionReceipt ?? null,
  conservativeTopologyAdvance = false,
  placementPositionEpochFloorReceipt =
    nextParticleUploads?.schroederSpatialReactionPlacementPositionEpochFloorReceipt
      ?? null,
  forcePositionAdvance = false,
  componentOwnerStages = null
} = {}) {
  const uploadFamily = validateSuccessorUploadFamily(nextParticleUploads);
  const {
    device,
    particleCount,
    sphUpload,
    mlsUpload,
    buffers,
    strides
  } = uploadFamily;
  if (!transaction || !generation) {
    throw sourceFamilyError(
      'successor preflight requires exact transaction and source generation'
    );
  }
  if (
    !lookupLevelAssignment
    || typeof successorLevelAssignmentRunner !== 'function'
  ) {
    throw sourceFamilyError(
      'successor preflight requires the exact lookup assignment and one post-closure full classifier',
      'LEVEL_ASSIGNMENT'
    );
  }
  const sourceEpochIdentity = exactSourceEpochIdentity(generation);
  const observedTopologyTransition = topologyTransitionReceipt != null;
  if (
    observedTopologyTransition
    && !validateSchroederSpatialTopologyTransitionReceipt(
      topologyTransitionReceipt,
      { generation, nextParticleUploads }
    )
  ) {
    throw sourceFamilyError(
      'successor preflight rejected the supplied topology authority',
      'TOPOLOGY_TRANSITION'
    );
  }
  if (!observedTopologyTransition && conservativeTopologyAdvance !== true) {
    throw sourceFamilyError(
      'successor preflight requires observed topology authority or conservative advance',
      'TOPOLOGY_TRANSITION'
    );
  }
  const observedPositionTransition = positionTransitionReceipt != null;
  if (
    observedPositionTransition
    && !validateSchroederSpatialPositionTransitionReceipt(
        positionTransitionReceipt,
        { generation, nextParticleUploads }
      )
  ) {
    throw sourceFamilyError(
      'successor preflight rejected a non-terminal or foreign GPU position transition receipt',
      'POSITION_TRANSITION'
    );
  }
  const topologyAuthority = observedTopologyTransition
    ? Object.freeze({
        mode: 'observed-compact-topology-receipt',
        sourceTopologyEpoch: topologyTransitionReceipt.sourceTopologyEpoch,
        nextTopologyEpoch: topologyTransitionReceipt.nextTopologyEpoch,
        topologyChanged: topologyTransitionReceipt.topologyChanged === true,
        status: topologyTransitionReceipt.status,
        generationId: topologyTransitionReceipt.generationId,
        activatedCount: topologyTransitionReceipt.activatedCount,
        deactivatedCount: topologyTransitionReceipt.deactivatedCount
      })
    : Object.freeze({
        mode: 'gpu-resident-conservative-topology-advance',
        sourceTopologyEpoch: sourceEpochIdentity.topologyEpoch,
        nextTopologyEpoch: incrementExactU32(
          sourceEpochIdentity.topologyEpoch,
          'successor topology epoch'
        ),
        topologyChanged: true,
        status: 'schroeder-successor-topology-conservatively-advanced',
        generationId: exactU32(
          generation.execution?.generationId,
          'generation.execution.generationId',
          { positive: true }
        ),
        activatedCount: null,
        deactivatedCount: null
      });
  const observedUploadIdentity = exactEpochPair(sphUpload, mlsUpload);
  if (
    observedUploadIdentity.positionEpoch
      < sourceEpochIdentity.positionEpoch
  ) {
    throw sourceFamilyError(
      'successor upload position epoch regressed behind its lookup generation',
      'POSITION_TRANSITION'
    );
  }
  const positionTransitionAuthenticated = Boolean(
    observedPositionTransition
    && positionTransitionReceipt.positionChanged === true
    && positionTransitionReceipt.terminalQueueOutcomeObserved === true
  );
  let positionEpochFloorAuthenticated = false;
  let positionEpochFloor = sourceEpochIdentity.positionEpoch;
  if (placementPositionEpochFloorReceipt) {
    const {
      validateSchroederSpatialReactionPlacementPositionEpochFloor
    } = await import('./schroederSpatialReactionPlacementEpochGpu.js');
    if (!validateSchroederSpatialReactionPlacementPositionEpochFloor(
      placementPositionEpochFloorReceipt,
      {
        device,
        ancestorPublicGeneration: generation
      }
    )) {
      throw sourceFamilyError(
        'placement position epoch floor is not branded and bound to this ancestor',
        'POSITION_TRANSITION_FLOOR'
      );
    }
    positionEpochFloor = exactU32(
      placementPositionEpochFloorReceipt.positionEpochFloor,
      'placement position epoch floor'
    );
    if (positionEpochFloor <= sourceEpochIdentity.positionEpoch) {
      throw sourceFamilyError(
        'placement position epoch floor did not advance the public ancestor',
        'POSITION_TRANSITION_FLOOR'
      );
    }
    positionEpochFloorAuthenticated = true;
  }
  const positionChanged = Boolean(
    positionTransitionAuthenticated
    || forcePositionAdvance
    || topologyAuthority.topologyChanged === true
    || positionEpochFloorAuthenticated
  );
  const conservativelyAdvancedPositionEpoch = positionChanged
    ? incrementExactU32(
        sourceEpochIdentity.positionEpoch,
        'successor position epoch'
      )
    : sourceEpochIdentity.positionEpoch;
  const nextPositionEpoch = positionEpochFloorAuthenticated
    ? Math.max(
        conservativelyAdvancedPositionEpoch,
        positionEpochFloor
      )
    : conservativelyAdvancedPositionEpoch;
  const allocation = allocateSchroederSpatialSuccessorBufferFamilyIdentity({
    device,
    afterStorageGeneration: Math.max(
      sourceEpochIdentity.storageGeneration,
      observedUploadIdentity.storageGeneration
    ),
    purpose: 'committed-successor-final-buffer-family'
  });
  exactBufferFamilyAllocation(allocation, device);
  const successorEpochIdentity = Object.freeze({
    storageGeneration: allocation.storageGeneration,
    physicsTick: observedUploadIdentity.physicsTick,
    physicsSubstep: observedUploadIdentity.physicsSubstep,
    positionEpoch: nextPositionEpoch,
    topologyEpoch: exactU32(
      topologyAuthority.nextTopologyEpoch,
      'successor topology epoch'
    ),
    chartEpoch: observedUploadIdentity.chartEpoch,
    levelEpoch: incrementExactU32(
      Math.max(
        sourceEpochIdentity.levelEpoch,
        observedUploadIdentity.levelEpoch
      ),
      'successor level epoch'
    ),
    supportEpoch: incrementExactU32(
      Math.max(
        sourceEpochIdentity.supportEpoch,
        observedUploadIdentity.supportEpoch
      ),
      'successor support epoch'
    )
  });
  const ownerStages = normalizeComponentOwnerStages(componentOwnerStages);
  const queryGeometry = exactQueryGeometry(generation);
  reserveSuccessorPublicationSlot(nextParticleUploads);
  stampSuccessorEpochIdentity(sphUpload, mlsUpload, successorEpochIdentity);
  if (
    observedTopologyTransition
    && !validateSchroederSpatialTopologyTransitionReceipt(
      topologyTransitionReceipt,
      { generation, nextParticleUploads }
    )
  ) {
    throw sourceFamilyError(
      'topology authority was invalidated while stamping final successor identity',
      'TOPOLOGY_TRANSITION'
    );
  }
  let rawSuccessorLevelAssignment = null;
  let successorLevelAssignment = null;
  try {
    rawSuccessorLevelAssignment = await successorLevelAssignmentRunner({
      device,
      transaction,
      lookupGeneration: generation,
      lookupLevelAssignment,
      nextParticleUploads,
      sphParticleUpload: sphUpload,
      mlsMpmParticleUpload: mlsUpload,
      successorEpochIdentity
    });
    successorLevelAssignment = admitSchroederPostClosureLevelAssignment({
      device,
      lookupLevelAssignment,
      nextParticleUploads,
      postClosureLevelAssignment: rawSuccessorLevelAssignment,
      maxParticleCount: particleCount
    });
  } catch (error) {
    rawSuccessorLevelAssignment?.destroyAssignmentBuffer?.();
    throw error;
  }
  const successorLevelAssignmentSeal = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_LEVEL_ASSIGNMENT_SEAL_SCHEMA,
    status: 'schroeder-successor-level-assignment-exact-lineage-sealed',
    ready: true,
    authenticated: true,
    lookupGenerationId: exactU32(
      generation.execution?.generationId,
      'generation.execution.generationId',
      { positive: true }
    ),
    successorLevelAssignmentGenerationId:
      successorEpochIdentity.storageGeneration,
    particleCount,
    levelClassificationMode:
      successorLevelAssignment.levelClassificationMode,
    assignmentBufferByteLength:
      successorLevelAssignment.assignmentBufferByteLength,
    successorEpochIdentity
  });
  successorLevelAssignmentSealRecords.set(successorLevelAssignmentSeal, {
    device,
    generation,
    lookupLevelAssignment,
    nextParticleUploads,
    successorLevelAssignment
  });
  const sourceFamily = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_SCHEMA,
    status: 'schroeder-committed-successor-source-family-authenticated',
    ready: true,
    admitted: true,
    authenticated: true,
    ownsBuffers: false,
    sourceFamily: 'hot-particle-successor',
    sourceFamilyRole: 'committed-successor-x-n-plus-1',
    coordinateAuthority: 'final-successor-particle-state',
    positionAuthority: positionEpochFloorAuthenticated
        ? 'authenticated-transactional-placement-epoch-floor-with-conservative-final-family'
        : (positionTransitionAuthenticated
          ? 'authenticated-terminal-gpu-position-transition'
          : (forcePositionAdvance
            ? 'conservative-mechanics-integration-transition'
            : 'authenticated-topology-or-invariant-transition')),
    publicationAuthority: 'spatial-epoch-transaction-preflight-and-commit',
    exactBufferFamilyAuthenticated: true,
    storageAllocationAuthenticated: true,
    topologyTransitionAuthenticated: true,
    positionTransitionAuthenticated,
    positionTransitionTerminalOutcomeObserved:
      observedPositionTransition
      && positionTransitionReceipt.terminalQueueOutcomeObserved === true,
    positionTransitionStatus:
      positionTransitionReceipt?.status ?? null,
    movedParticleCount:
      positionTransitionReceipt?.movedParticleCount ?? null,
    positionEpochFloorAuthenticated,
    positionEpochFloor: positionEpochFloorAuthenticated
      ? positionEpochFloor
      : null,
    positionChanged,
    spatialQueryAuthority: false,
    spatialDirectoryReady: false,
    canonicalSpatialGenerationAvailable: false,
    canonicalSpatialGenerationStatus:
      'exact-successor-level-assignment-ready-directory-not-built',
    spatialDirectoryGenerationId: null,
    canonicalSpatialLevelAssignmentAvailable: true,
    canonicalSpatialLevelAssignmentStatus:
      'schroeder-successor-level-assignment-exact-lineage-sealed',
    successorLevelAssignmentGenerationId:
      successorEpochIdentity.storageGeneration,
    successorLevelAssignmentSeal,
    sourceGenerationId: topologyAuthority.generationId,
    ancestorSpatialGenerationId: topologyAuthority.generationId,
    deviceId: webGpuDeviceId(device),
    particleCount,
    sourceEpochIdentity,
    successorEpochIdentity,
    ...successorEpochIdentity,
    ...strides,
    sourceTopologyEpoch: topologyAuthority.sourceTopologyEpoch,
    nextTopologyEpoch: topologyAuthority.nextTopologyEpoch,
    topologyChanged: topologyAuthority.topologyChanged,
    topologyTransitionStatus: topologyAuthority.status,
    topologyTransitionMode: topologyAuthority.mode,
    activatedCount: topologyAuthority.activatedCount,
    deactivatedCount: topologyAuthority.deactivatedCount,
    componentOwnerStages: ownerStages,
    queryGeometry,
    fullParticleReadbackRequired: false,
    fullParticleReadbackPerformed: false
  });
  const plan = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_PUBLICATION_PLAN_SCHEMA,
    status: 'schroeder-successor-source-family-publication-prepared',
    prepared: true,
    deviceId: webGpuDeviceId(device),
    particleCount,
    sourceGenerationId: sourceFamily.sourceGenerationId,
    successorLevelAssignmentGenerationId:
      sourceFamily.successorLevelAssignmentGenerationId,
    storageGeneration: successorEpochIdentity.storageGeneration,
    positionEpoch: successorEpochIdentity.positionEpoch,
    topologyEpoch: successorEpochIdentity.topologyEpoch
  });
  const sourceFamilyRecord = newSourceFamilyRecord({
    device,
    transaction,
    generation,
    nextParticleUploads,
    topologyTransitionReceipt,
    positionTransitionReceipt,
    topologyAuthority,
    positionEpochFloorReceipt: placementPositionEpochFloorReceipt,
    sphUpload,
    mlsUpload,
    buffers,
    successorLevelAssignment,
    successorLevelAssignmentSeal,
    storageAllocation: allocation
  });
  successorPublicationPlanRecords.set(plan, {
    transaction,
    generation,
    nextParticleUploads,
    topologyTransitionReceipt,
    positionTransitionReceipt,
    topologyAuthority,
    sourceFamily,
    successorLevelAssignment,
    successorLevelAssignmentSeal,
    sourceFamilyRecord,
    attempted: false
  });
  preparedSuccessorPublicationPlans.add(plan);
  return plan;
}

/**
 * Retire the classifier output held by a prepared plan that cannot reach
 * publication. This is the failure-side ownership handoff for callers that
 * prepare before committing their spatial transaction.
 */
export function abandonPreparedSchroederSpatialSuccessorSourceFamilyPublication(
  plan,
  { reason = 'prepared successor publication abandoned' } = {}
) {
  const prepared = successorPublicationPlanRecords.get(plan);
  if (
    !prepared
    || !preparedSuccessorPublicationPlans.has(plan)
    || sourceFamilyRecords.has(prepared.sourceFamily)
    || prepared.attempted === true
  ) {
    return false;
  }
  prepared.attempted = true;
  prepared.sourceFamilyRecord.reason = normalizedReason(
    reason,
    'prepared successor publication abandoned'
  );
  retireUnpublishedSuccessorLevelAssignment(prepared.sourceFamilyRecord);
  return true;
}

export function validateSchroederSpatialSuccessorLevelAssignmentSeal(
  seal,
  {
    device = null,
    generation = null,
    lookupLevelAssignment = null,
    nextParticleUploads = null,
    successorLevelAssignment = null
  } = {}
) {
  const record = successorLevelAssignmentSealRecords.get(seal);
  return Boolean(
    record
    && seal?.schema
      === ULG_SCHROEDER_SPATIAL_SUCCESSOR_LEVEL_ASSIGNMENT_SEAL_SCHEMA
    && seal.status
      === 'schroeder-successor-level-assignment-exact-lineage-sealed'
    && seal.ready === true
    && seal.authenticated === true
    && Object.isFrozen(seal)
    && (device == null || record.device === device)
    && (generation == null || record.generation === generation)
    && (
      lookupLevelAssignment == null
      || record.lookupLevelAssignment === lookupLevelAssignment
    )
    && (
      nextParticleUploads == null
      || record.nextParticleUploads === nextParticleUploads
    )
    && (
      successorLevelAssignment == null
      || record.successorLevelAssignment === successorLevelAssignment
    )
    && validateSchroederPostClosureLevelAssignment(
      record.successorLevelAssignment,
      {
        device: record.device,
        lookupLevelAssignment: record.lookupLevelAssignment,
        nextParticleUploads: record.nextParticleUploads
      }
    )
    && EPOCH_FIELDS.every((field) => (
      seal.successorEpochIdentity[field]
        === record.nextParticleUploads.sphParticleUpload[field]
      && seal.successorEpochIdentity[field]
        === record.nextParticleUploads.mlsMpmParticleUpload[field]
    ))
  );
}

/**
 * Publish a prepared family after commit. This function is deliberately
 * total: a rejected/tampered plan returns a failure receipt and never throws
 * into already-committed physics.
 */
export function publishPreparedSchroederSpatialSuccessorSourceFamily(
  plan,
  { commitReceipt } = {}
) {
  let preparedForFailure = null;
  try {
    const prepared = successorPublicationPlanRecords.get(plan);
    if (
      !prepared
      || !preparedSuccessorPublicationPlans.has(plan)
      || plan?.schema !== ULG_SCHROEDER_SPATIAL_SUCCESSOR_PUBLICATION_PLAN_SCHEMA
      || !Object.isFrozen(plan)
      || prepared.attempted
    ) {
      return publicationReceipt({
        status: 'schroeder-successor-source-family-publication-rejected',
        published: false,
        reason: 'publication plan is foreign, invalid, or already consumed'
      });
    }
    preparedForFailure = prepared;
    prepared.attempted = true;
    const {
      transaction,
      generation,
      nextParticleUploads,
      topologyTransitionReceipt,
      topologyAuthority,
      sourceFamily,
      successorLevelAssignment,
      successorLevelAssignmentSeal,
      sourceFamilyRecord
    } = prepared;
    if (
      sourceFamilyByCommitReceipt.has(commitReceipt)
      || !validateSchroederSpatialEpochTransactionCommit(
        transaction,
        commitReceipt,
        { nextParticleUploads, expectedGeneration: generation }
      )
      || (
        topologyTransitionReceipt != null
        && !validateSchroederSpatialTopologyTransitionReceipt(
          topologyTransitionReceipt,
          { generation, nextParticleUploads }
        )
      )
      || topologyAuthority?.generationId !== sourceFamily.sourceGenerationId
      || !preparedUploadFamilyPreserved(
        nextParticleUploads,
        sourceFamily,
        sourceFamilyRecord.buffers,
        successorLevelAssignment
      )
      || !validateSchroederSpatialSuccessorLevelAssignmentSeal(
        successorLevelAssignmentSeal,
        {
          device: sourceFamilyRecord.device,
          generation,
          nextParticleUploads,
          successorLevelAssignment
        }
      )
      || nextParticleUploads.schroederSpatialSuccessorSourceFamily !== null
      || nextParticleUploads.schroederSpatialSuccessorLevelAssignment !== null
      || !Reflect.set(
        nextParticleUploads,
        'schroederSpatialSuccessorLevelAssignment',
        successorLevelAssignment
      )
      || nextParticleUploads.schroederSpatialSuccessorLevelAssignment
        !== successorLevelAssignment
      || !Reflect.set(
        nextParticleUploads,
        'schroederSpatialSuccessorSourceFamily',
        sourceFamily
      )
      || nextParticleUploads.schroederSpatialSuccessorSourceFamily !== sourceFamily
    ) {
      if (
        nextParticleUploads.schroederSpatialSuccessorSourceFamily
          === sourceFamily
      ) {
        Reflect.set(
          nextParticleUploads,
          'schroederSpatialSuccessorSourceFamily',
          null
        );
      }
      if (
        nextParticleUploads.schroederSpatialSuccessorLevelAssignment
          === successorLevelAssignment
      ) {
        Reflect.set(
          nextParticleUploads,
          'schroederSpatialSuccessorLevelAssignment',
          null
        );
      }
      retireUnpublishedSuccessorLevelAssignment(sourceFamilyRecord);
      return publicationReceipt({
        status: 'schroeder-successor-source-family-publication-rejected',
        published: false,
        reason: 'commit or reserved publication slot did not preserve exact identity'
      });
    }
    sourceFamilyRecord.commitReceipt = commitReceipt;
    sourceFamilyRecords.set(sourceFamily, sourceFamilyRecord);
    finalizedSourceFamilies.add(sourceFamily);
    sourceFamilyByCommitReceipt.set(commitReceipt, sourceFamily);
    watchSourceFamilyDeviceLoss(sourceFamily, sourceFamilyRecord.device);
    return publicationReceipt({
      status: 'schroeder-successor-source-family-published',
      published: true,
      sourceFamily,
      publicationRecord: {
        plan,
        commitReceipt,
        transaction,
        generation,
        nextParticleUploads,
        sourceFamily,
        successorLevelAssignment,
        successorLevelAssignmentSeal
      }
    });
  } catch (error) {
    return publicationReceipt({
      status: 'schroeder-successor-source-family-publication-rejected',
      published: false,
      reason: error instanceof Error ? error.message : String(error)
    });
  } finally {
    if (
      preparedForFailure?.attempted === true
      && !sourceFamilyRecords.has(preparedForFailure.sourceFamily)
    ) {
      retireUnpublishedSuccessorLevelAssignment(
        preparedForFailure.sourceFamilyRecord
      );
    }
  }
}

/**
 * Validate a successful publication receipt against the exact prepared plan,
 * transaction commit, and reserved continuation envelope.  Public fields are
 * intentionally insufficient: only a module-issued receipt is accepted.
 */
export function validateSchroederSpatialSuccessorPublicationReceipt(
  receipt,
  {
    plan = null,
    commitReceipt = null,
    nextParticleUploads = null,
    sourceFamily = null
  } = {}
) {
  const record = successorPublicationReceiptRecords.get(receipt);
  const family = receipt?.sourceFamily ?? null;
  const familyRecord = sourceFamilyRecords.get(family);
  return Boolean(
    record
    && receipt?.schema
      === ULG_SCHROEDER_SPATIAL_SUCCESSOR_PUBLICATION_RECEIPT_SCHEMA
    && Object.isFrozen(receipt)
    && receipt.status === 'schroeder-successor-source-family-published'
    && receipt.published === true
    && receipt.reason == null
    && family
    && family === record.sourceFamily
    && finalizedSourceFamilies.has(family)
    && familyRecord
    && familyRecord.commitReceipt === record.commitReceipt
    && familyRecord.transaction === record.transaction
    && familyRecord.generation === record.generation
    && familyRecord.nextParticleUploads === record.nextParticleUploads
    && record.nextParticleUploads?.schroederSpatialSuccessorSourceFamily
      === family
    && record.nextParticleUploads?.schroederSpatialSuccessorLevelAssignment
      === record.successorLevelAssignment
    && family.successorLevelAssignmentSeal
      === record.successorLevelAssignmentSeal
    && validateSchroederSpatialSuccessorLevelAssignmentSeal(
      record.successorLevelAssignmentSeal,
      {
        generation: record.generation,
        nextParticleUploads: record.nextParticleUploads,
        successorLevelAssignment: record.successorLevelAssignment
      }
    )
    && (plan == null || record.plan === plan)
    && (commitReceipt == null || record.commitReceipt === commitReceipt)
    && (
      nextParticleUploads == null
      || record.nextParticleUploads === nextParticleUploads
    )
    && (sourceFamily == null || family === sourceFamily)
  );
}

/**
 * Attest the exact committed x_(n+1) family without claiming that it already
 * has a canonical spatial directory. Exact receipts and buffers remain in the
 * module-owned record; the public frozen descriptor contains summaries only.
 */
export function createSchroederSpatialSuccessorSourceFamily({
  transaction,
  commitReceipt,
  generation,
  nextParticleUploads,
  topologyTransitionReceipt,
  componentOwnerStages = null
} = {}) {
  const sphUpload = nextParticleUploads?.sphParticleUpload ?? null;
  const mlsUpload = nextParticleUploads?.mlsMpmParticleUpload ?? null;
  if (
    !validateSchroederSpatialEpochTransactionCommit(
      transaction,
      commitReceipt,
      { nextParticleUploads, expectedGeneration: generation }
    )
    || !validateSchroederSpatialTopologyTransitionReceipt(
      topologyTransitionReceipt,
      { generation, nextParticleUploads }
    )
    || !sphUpload
    || !mlsUpload
  ) {
    throw sourceFamilyError(
      'committed successor requires exact transaction and applied topology authority'
    );
  }
  if (sourceFamilyByCommitReceipt.has(commitReceipt)) {
    throw sourceFamilyError(
      'one transaction commit can publish exactly one successor source family',
      'DUPLICATE_PUBLICATION'
    );
  }

  const device = webGpuBufferDevice(sphUpload.stateBuffer);
  const particleCount = exactU32(
    sphUpload.particleCount,
    'sphParticleUpload.particleCount',
    { positive: true }
  );
  if (exactU32(mlsUpload.particleCount, 'mlsMpmParticleUpload.particleCount', {
    positive: true
  }) !== particleCount) {
    throw sourceFamilyError('successor upload counts differ');
  }
  const buffers = Object.freeze({
    stateBuffer: exactBuffer(device, sphUpload.stateBuffer, 'successor state'),
    thermoBuffer: exactBuffer(device, sphUpload.thermoBuffer, 'successor thermo'),
    identityBuffer: exactBuffer(device, sphUpload.identityBuffer, 'successor identity'),
    mechanicsBuffer: exactBuffer(device, mlsUpload.mechanicsBuffer, 'successor mechanics')
  });
  requirePairwiseDistinctBuffers(buffers);
  const epochIdentity = {};
  for (const field of EPOCH_FIELDS) {
    const sphValue = exactU32(
      sphUpload[field],
      `sphParticleUpload.${field}`,
      { positive: field === 'storageGeneration' }
    );
    const mlsValue = exactU32(
      mlsUpload[field],
      `mlsMpmParticleUpload.${field}`,
      { positive: field === 'storageGeneration' }
    );
    if (sphValue !== mlsValue) {
      throw sourceFamilyError(`successor ${field} values differ`);
    }
    epochIdentity[field] = sphValue;
  }
  const strides = Object.freeze({
    stateStrideBytes: exactU32(
      sphUpload.stateStrideBytes,
      'sphParticleUpload.stateStrideBytes',
      { positive: true }
    ),
    thermoStrideBytes: exactU32(
      sphUpload.thermoStrideBytes,
      'sphParticleUpload.thermoStrideBytes',
      { positive: true }
    ),
    identityStrideBytes: exactU32(
      sphUpload.identityStrideBytes,
      'sphParticleUpload.identityStrideBytes',
      { positive: true }
    ),
    mechanicsStrideBytes: exactU32(
      mlsUpload.mechanicsStrideBytes,
      'mlsMpmParticleUpload.mechanicsStrideBytes',
      { positive: true }
    )
  });
  requireCapacity(buffers.stateBuffer, particleCount, strides.stateStrideBytes, 'state');
  requireCapacity(buffers.thermoBuffer, particleCount, strides.thermoStrideBytes, 'thermo');
  requireCapacity(buffers.identityBuffer, particleCount, strides.identityStrideBytes, 'identity');
  requireCapacity(
    buffers.mechanicsBuffer,
    particleCount,
    strides.mechanicsStrideBytes,
    'mechanics'
  );

  const sourceEpochIdentity = Object.freeze(Object.fromEntries(
    EPOCH_FIELDS.map((field) => [field, generation.execution[field]])
  ));
  const successorEpochIdentity = Object.freeze({ ...epochIdentity });
  const queryGeometry = exactQueryGeometry(generation);
  const ownerStages = normalizeComponentOwnerStages(componentOwnerStages);
  const sourceFamily = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_SCHEMA,
    status: 'schroeder-committed-successor-source-family-authenticated',
    ready: true,
    admitted: true,
    authenticated: true,
    ownsBuffers: false,
    sourceFamily: 'hot-particle-successor',
    sourceFamilyRole: 'committed-successor-x-n-plus-1',
    coordinateAuthority: 'final-successor-particle-state',
    positionAuthority: 'same-epoch-final-continuation-particle-state',
    publicationAuthority: 'spatial-epoch-transaction-commit',
    exactBufferFamilyAuthenticated: true,
    topologyTransitionAuthenticated: true,
    positionTransitionAuthenticated: false,
    spatialQueryAuthority: false,
    spatialDirectoryReady: false,
    canonicalSpatialGenerationAvailable: false,
    canonicalSpatialGenerationStatus: 'not-built',
    spatialDirectoryGenerationId: null,
    sourceGenerationId: topologyTransitionReceipt.generationId,
    ancestorSpatialGenerationId: topologyTransitionReceipt.generationId,
    deviceId: webGpuDeviceId(device),
    particleCount,
    sourceEpochIdentity,
    successorEpochIdentity,
    ...successorEpochIdentity,
    ...strides,
    sourceTopologyEpoch: topologyTransitionReceipt.sourceTopologyEpoch,
    nextTopologyEpoch: topologyTransitionReceipt.nextTopologyEpoch,
    topologyChanged: topologyTransitionReceipt.topologyChanged,
    topologyTransitionStatus: topologyTransitionReceipt.status,
    activatedCount: topologyTransitionReceipt.activatedCount,
    deactivatedCount: topologyTransitionReceipt.deactivatedCount,
    componentOwnerStages: ownerStages,
    queryGeometry,
    fullParticleReadbackRequired: false,
    fullParticleReadbackPerformed: false
  });
  const sourceFamilyRecord = {
    device,
    transaction,
    commitReceipt,
    generation,
    nextParticleUploads,
    topologyTransitionReceipt,
    sphUpload,
    mlsUpload,
    buffers,
    active: true,
    retired: false,
    deviceLost: false,
    reason: null,
    leaseCount: 0,
    nextLeaseOrdinal: 0,
    retirementRequested: false,
    retirementFenceSettled: false,
    retirementSettled: false,
    retirementPromise: null,
    resolveRetirement: null
  };
  sourceFamilyRecords.set(sourceFamily, sourceFamilyRecord);
  finalizedSourceFamilies.add(sourceFamily);
  sourceFamilyByCommitReceipt.set(commitReceipt, sourceFamily);
  nextParticleUploads.schroederSpatialSuccessorSourceFamily = sourceFamily;
  watchSourceFamilyDeviceLoss(sourceFamily, device);
  return sourceFamily;
}

export function isFinalizedSchroederSpatialSuccessorSourceFamily(sourceFamily) {
  return finalizedSourceFamilies.has(sourceFamily)
    && sourceFamilyRecords.has(sourceFamily);
}

/** Read the current private liveness state without exposing devices or buffers. */
export function schroederSpatialSuccessorSourceFamilyLiveness(
  sourceFamily,
  { device = null } = {}
) {
  const record = exactSourceFamilyRecord(sourceFamily, { device });
  return sourceFamilyLivenessSummary(sourceFamily, record);
}

/**
 * Acquire an exact read-only consumer lease. The frozen lease is only an
 * identity token; mutable release state remains module-private.
 */
export function acquireSchroederSpatialSuccessorSourceFamilyLease(
  sourceFamily,
  {
    device,
    consumerStage = 'unspecified-successor-source-family-consumer'
  } = {}
) {
  const record = exactSourceFamilyRecord(sourceFamily, {
    device,
    requireDevice: true
  });
  requireActiveSourceFamily(record);
  const normalizedConsumerStage = typeof consumerStage === 'string'
    ? consumerStage.trim()
    : null;
  if (!normalizedConsumerStage) {
    throw sourceFamilyError(
      'successor source family lease requires a non-empty consumerStage',
      'CONTRACT'
    );
  }
  const leaseOrdinal = incrementExactU32(
    record.nextLeaseOrdinal,
    'successor source-family lease ordinal'
  );
  record.nextLeaseOrdinal = leaseOrdinal;
  const lease = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_SCHEMA,
    sourceGenerationId: sourceFamily.sourceGenerationId,
    deviceId: sourceFamily.deviceId,
    leaseOrdinal,
    consumerStage: normalizedConsumerStage,
    readOnly: true
  });
  sourceFamilyLeaseRecords.set(lease, {
    sourceFamily,
    sourceFamilyRecord: record,
    released: false,
    releasePending: false,
    releasePromise: null
  });
  record.leaseCount += 1;
  return lease;
}

/** Release one exact lease exactly once, including after device loss. */
export function releaseSchroederSpatialSuccessorSourceFamilyLease(
  sourceFamily,
  lease,
  { device } = {}
) {
  const record = exactSourceFamilyRecord(sourceFamily, {
    device,
    requireDevice: true
  });
  const leaseRecord = sourceFamilyLeaseRecords.get(lease);
  if (
    !leaseRecord
    || lease?.schema !== ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_SCHEMA
    || !Object.isFrozen(lease)
    || leaseRecord.sourceFamily !== sourceFamily
    || leaseRecord.sourceFamilyRecord !== record
  ) {
    throw sourceFamilyError(
      'lease does not identify this exact successor source family',
      'LEASE_IDENTITY'
    );
  }
  if (leaseRecord.released) {
    throw sourceFamilyError(
      'successor source family lease was already released',
      'LEASE_RELEASED'
    );
  }
  if (leaseRecord.releasePending) {
    throw sourceFamilyError(
      'successor source family lease already has a queue-fenced release pending',
      'LEASE_RELEASE_PENDING'
    );
  }
  if (record.leaseCount < 1) {
    throw sourceFamilyError(
      'successor source family lease accounting underflow',
      'LEASE_ACCOUNTING'
    );
  }
  leaseRecord.released = true;
  record.leaseCount -= 1;
  settleRequestedRetirement(sourceFamily, record);
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_RELEASE_SCHEMA,
    status: 'schroeder-successor-source-family-lease-released',
    released: true,
    leaseOrdinal: lease.leaseOrdinal,
    consumerStage: lease.consumerStage,
    sourceGenerationId: sourceFamily.sourceGenerationId,
    remainingLeaseCount: record.leaseCount,
    sourceFamilyStatus: sourceFamilyLivenessSummary(sourceFamily, record).status
  });
}

/**
 * Release one lease only after its exact consumer queue fence settles. A
 * rejected fence leaves the lease active and permits an explicit retry.
 */
export function releaseSchroederSpatialSuccessorSourceFamilyLeaseAfter(
  sourceFamily,
  lease,
  { device, after = null } = {}
) {
  const record = exactSourceFamilyRecord(sourceFamily, {
    device,
    requireDevice: true
  });
  const leaseRecord = sourceFamilyLeaseRecords.get(lease);
  if (
    !leaseRecord
    || leaseRecord.sourceFamily !== sourceFamily
    || leaseRecord.sourceFamilyRecord !== record
    || lease?.schema !== ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_SCHEMA
    || !Object.isFrozen(lease)
  ) {
    throw sourceFamilyError(
      'lease does not identify this exact successor source family',
      'LEASE_IDENTITY'
    );
  }
  if (leaseRecord.released) {
    throw sourceFamilyError(
      'successor source family lease was already released',
      'LEASE_RELEASED'
    );
  }
  if (leaseRecord.releasePending) return leaseRecord.releasePromise;
  let fence = after;
  if (fence == null) {
    fence = device?.queue?.onSubmittedWorkDone?.();
  }
  if (!fence || typeof fence.then !== 'function') {
    throw sourceFamilyError(
      'queue-fenced lease release requires an exact completion promise',
      'LEASE_FENCE'
    );
  }
  leaseRecord.releasePending = true;
  const releasePromise = Promise.resolve(fence).then(
    () => {
      if (leaseRecord.released) {
        throw sourceFamilyError(
          'successor source family lease was already released',
          'LEASE_RELEASED'
        );
      }
      if (record.leaseCount < 1) {
        throw sourceFamilyError(
          'successor source family lease accounting underflow',
          'LEASE_ACCOUNTING'
        );
      }
      leaseRecord.releasePending = false;
      leaseRecord.released = true;
      record.leaseCount -= 1;
      settleRequestedRetirement(sourceFamily, record);
      return Object.freeze({
        schema: ULG_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_RELEASE_SCHEMA,
        status: 'schroeder-successor-source-family-lease-released-after-fence',
        released: true,
        queueFenceSettled: true,
        leaseOrdinal: lease.leaseOrdinal,
        consumerStage: lease.consumerStage,
        sourceGenerationId: sourceFamily.sourceGenerationId,
        remainingLeaseCount: record.leaseCount,
        sourceFamilyStatus: sourceFamilyLivenessSummary(sourceFamily, record).status
      });
    },
    (error) => {
      leaseRecord.releasePending = false;
      leaseRecord.releasePromise = null;
      throw error;
    }
  );
  leaseRecord.releasePromise = releasePromise;
  releasePromise.catch(() => {});
  return releasePromise;
}

/**
 * Retire publication authority without destroying the borrowed successor
 * buffers. Active consumer leases make normal retirement fail closed.
 */
export function retireSchroederSpatialSuccessorSourceFamily(
  sourceFamily,
  {
    device,
    reason = 'successor source family retired'
  } = {}
) {
  const record = exactSourceFamilyRecord(sourceFamily, {
    device,
    requireDevice: true
  });
  if (record.deviceLost || !record.active) {
    return sourceFamilyLivenessSummary(sourceFamily, record);
  }
  if (record.leaseCount > 0) {
    throw sourceFamilyError(
      `successor source family retirement is blocked by ${record.leaseCount} active lease(s)`,
      'ACTIVE_LEASES'
    );
  }
  record.active = false;
  record.retired = true;
  record.retirementRequested = true;
  record.retirementFenceSettled = true;
  record.retirementSettled = true;
  record.reason = normalizedReason(reason, 'successor source family retired');
  destroyOwnedSuccessorLevelAssignment(record);
  return sourceFamilyLivenessSummary(sourceFamily, record);
}

/**
 * Immediately revoke new consumers, then settle retirement only after the
 * owner fence and every already-issued lease fence have completed. Device
 * loss is a terminal quarantine and settles the request without pretending
 * that normal queue completion occurred.
 */
export function retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
  sourceFamily,
  {
    device,
    reason = 'successor source family superseded',
    after = null
  } = {}
) {
  const record = exactSourceFamilyRecord(sourceFamily, {
    device,
    requireDevice: true
  });
  if (record.retirementPromise) return record.retirementPromise;
  if (record.deviceLost) {
    return Promise.resolve(retirementReceipt(
      sourceFamily,
      record,
      'schroeder-successor-source-family-device-lost-quarantined'
    ));
  }
  if (record.retired) {
    return Promise.resolve(retirementReceipt(
      sourceFamily,
      record,
      'schroeder-successor-source-family-retired'
    ));
  }
  let fence = after;
  if (fence == null) {
    fence = device?.queue?.onSubmittedWorkDone?.();
  }
  if (!fence || typeof fence.then !== 'function') {
    throw sourceFamilyError(
      'successor retirement requires an exact owner completion promise',
      'RETIREMENT_FENCE'
    );
  }
  record.active = false;
  record.retirementRequested = true;
  record.reason = normalizedReason(reason, 'successor source family superseded');
  record.retirementFenceSettled = false;
  record.retirementSettled = false;
  record.retirementPromise = new Promise((resolve) => {
    record.resolveRetirement = resolve;
  });
  Promise.resolve(fence).then(
    () => {
      record.retirementFenceSettled = true;
      settleRequestedRetirement(sourceFamily, record);
    },
    (error) => {
      if (record.deviceLost) {
        settleRequestedRetirement(sourceFamily, record);
        return;
      }
      record.reason = normalizedReason(
        error,
        'successor retirement owner fence rejected'
      );
      const resolveRetirement = record.resolveRetirement;
      const rejectedReceipt = retirementReceipt(
        sourceFamily,
        record,
        'schroeder-successor-source-family-retirement-fence-rejected'
      );
      // Keep the family revoked/quarantined, but clear only the failed owner
      // attempt so the caller can install a replacement fence explicitly.
      record.retirementSettled = false;
      record.retirementFenceSettled = false;
      record.retirementPromise = null;
      record.resolveRetirement = null;
      resolveRetirement?.(rejectedReceipt);
    }
  );
  settleRequestedRetirement(sourceFamily, record);
  record.retirementPromise.catch(() => {});
  return record.retirementPromise;
}

/** Validate optional exact consumer inputs against the private attestation. */
export function resolveSchroederSpatialSuccessorSourceFamily(
  sourceFamily,
  {
    device,
    particleCount = sourceFamily?.particleCount,
    stateBuffer = null,
    thermoBuffer = null,
    identityBuffer = null,
    mechanicsBuffer = null
  } = {}
) {
  const record = exactSourceFamilyRecord(sourceFamily, {
    device,
    requireDevice: true
  });
  requireActiveSourceFamily(record);
  const suppliedBuffers = { stateBuffer, thermoBuffer, identityBuffer, mechanicsBuffer };
  const suppliedMismatch = Object.entries(suppliedBuffers).some(
    ([name, buffer]) => buffer != null && buffer !== record?.buffers?.[name]
  );
  if (
    sourceFamily.particleCount !== particleCount
    || suppliedMismatch
    || (
      sourceFamily.canonicalSpatialLevelAssignmentAvailable === true
      && (
        record.successorLevelAssignment?.assignmentBuffer?.destroyed === true
        || !validateSchroederSpatialSuccessorLevelAssignmentSeal(
          record.successorLevelAssignmentSeal,
          {
            device,
            generation: record.generation,
            nextParticleUploads: record.nextParticleUploads,
            successorLevelAssignment: record.successorLevelAssignment
          }
        )
      )
    )
    || Object.values(record.buffers).some((buffer) => (
      webGpuBufferDevice(buffer) !== device
      || !webGpuBufferMatchesDevice(buffer, device)
    ))
  ) {
    throw sourceFamilyError(
      'source family does not identify the exact committed same-device continuation'
    );
  }
  return Object.freeze({
    admitted: true,
    sourceFamily,
    sourceFamilyRole: sourceFamily.sourceFamilyRole,
    sourceGenerationId: sourceFamily.sourceGenerationId,
    epochIdentity: sourceFamily.successorEpochIdentity,
    levelAssignment: record.successorLevelAssignment ?? null,
    levelAssignmentSeal: record.successorLevelAssignmentSeal ?? null
  });
}
