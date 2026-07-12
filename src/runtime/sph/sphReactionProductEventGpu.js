import {
  SPH_GPU_REACTION_PRODUCT_EVENT_PREFIX_METADATA_MAGIC,
  SPH_GPU_REACTION_PRODUCT_EVENT_PREFIX_METADATA_U32_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_EVENT_PREFIX_OVERFLOW_CAPACITY,
  SPH_GPU_REACTION_PRODUCT_EVENT_PREFIX_OVERFLOW_EXACT_COUNT,
  SPH_GPU_REACTION_PRODUCT_EVENT_PLACEMENT_SPARE_PROBE_LIMIT,
  SPH_GPU_REACTION_PRODUCT_EVENT_PLACEMENT_WORKSPACE_WORDS_PER_EVENT,
  SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT,
  SPH_GPU_REACTION_ADMITTED_OUTCOME_STRIDE_WORDS,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_EVENT_PLACEMENT_WORKSPACE_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { sphReactionProductEventPrefixWgsl } from
  '../../../ulg-gpu-abi/src/reactionProductEventPrefixWgsl.js';
import {
  sphReactionProductEventPlacementWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import { createWebGpuU32ExclusiveScan } from '../webgpuRadixScanUnique.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import {
  tagResidentProductMassDevice,
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice
} from './sphGpuDeviceIdentity.js';

export const ULG_SPH_REACTION_PRODUCT_EVENT_ENCODER_STAGE_SCHEMA =
  'peercompute.ulg.sph-reaction-product-event-encoder-stage.v0';
export const ULG_SPH_REACTION_PRODUCT_EVENT_PLACEMENT_WORKSPACE_SCHEMA =
  ULG_SPH_GPU_REACTION_PRODUCT_EVENT_PLACEMENT_WORKSPACE_SCHEMA;
export const SPH_REACTION_PRODUCT_EVENT_FLOATS =
  SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.length;
export const SPH_REACTION_PRODUCT_EVENT_PLACEMENT_WORKSPACE_WORDS_PER_EVENT =
  SPH_GPU_REACTION_PRODUCT_EVENT_PLACEMENT_WORKSPACE_WORDS_PER_EVENT;
// Compatibility name retained for callers that only size the opaque workspace.
export const SPH_REACTION_PRODUCT_EVENT_PLACEMENT_CANDIDATE_WORDS =
  SPH_REACTION_PRODUCT_EVENT_PLACEMENT_WORKSPACE_WORDS_PER_EVENT;
export const SPH_REACTION_PRODUCT_EVENT_PREFIX_METADATA_WORDS =
  SPH_GPU_REACTION_PRODUCT_EVENT_PREFIX_METADATA_U32_LAYOUT.length;
export const SPH_REACTION_PRODUCT_EVENT_PREFIX_METADATA_BYTES =
  SPH_REACTION_PRODUCT_EVENT_PREFIX_METADATA_WORDS * Uint32Array.BYTES_PER_ELEMENT;
export const SPH_REACTION_PRODUCT_EVENT_PREFIX_INDIRECT_BYTES =
  3 * Uint32Array.BYTES_PER_ELEMENT;
export const SPH_REACTION_ADMITTED_OUTCOME_WORDS =
  SPH_GPU_REACTION_ADMITTED_OUTCOME_STRIDE_WORDS;
export const SPH_REACTION_ADMITTED_OUTCOME_BYTES_PER_PARTICLE =
  SPH_REACTION_ADMITTED_OUTCOME_WORDS * Uint32Array.BYTES_PER_ELEMENT;

const WORKGROUP_SIZE = 64;
const UINT32_MAX = 0xffff_ffff;
const PARAMS_SLOT_STRIDE_BYTES = 256;
const SUMMARY_PARAMS_BYTE_LENGTH = 80;
const PLACEMENT_PARAMS_BYTE_LENGTH = 64;
const RESIDENT_PRODUCT_MASS_SCHEMA = 'peercompute.ulg.sph-resident-product-mass.v0';
const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256
};

function computeDispatchShape(elementCount, maxDimension = 65535) {
  const groups = Math.max(0, Math.ceil(elementCount / WORKGROUP_SIZE));
  if (groups === 0) return [0, 1, 1];
  const maximum = nonNegativeInteger(maxDimension, 'maxComputeWorkgroupsPerDimension');
  if (maximum < 1) throw new RangeError('maxComputeWorkgroupsPerDimension must be positive');
  const x = Math.min(groups, maximum);
  const y = Math.ceil(groups / x);
  if (y > maximum) {
    throw new RangeError(
      `reaction product-event dispatch ${groups} exceeds ${maximum}x${maximum}`
    );
  }
  return [x, y, 1];
}

function nonNegativeInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 0xffffffff) {
    throw new RangeError(`${label} must be a uint32`);
  }
  return number;
}

function assertBuffer(device, buffer, label, requiredByteLength) {
  if (!buffer) throw new TypeError(`${label} is required`);
  if (!webGpuBufferMatchesDevice(buffer, device)) {
    throw new Error(`${label} device mismatch`);
  }
  const available = Number(buffer.size ?? requiredByteLength);
  if (!Number.isFinite(available) || available < requiredByteLength) {
    throw new RangeError(`${label} is smaller than ${requiredByteLength} bytes`);
  }
}

function summaryParamsArray({
  particleCount,
  reactionTable,
  dtSeconds,
  eventCapacityRows,
  generationId,
  minLiveMassKg,
  particleDispatchX,
  maxComputeWorkgroupsPerDimension
}) {
  const data = new ArrayBuffer(80);
  const view = new DataView(data);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, nonNegativeInteger(reactionTable.reactionCount ?? 0, 'reactionCount'), true);
  view.setUint32(8, nonNegativeInteger(reactionTable.productPhaseCount ?? 0, 'productPhaseCount'), true);
  view.setUint32(12, nonNegativeInteger(reactionTable.reactantTermCount ?? 0, 'reactantTermCount'), true);
  view.setUint32(16, nonNegativeInteger(reactionTable.productTermCount ?? 0, 'productTermCount'), true);
  view.setUint32(20, nonNegativeInteger(reactionTable.gasProductCount ?? 0, 'gasProductCount'), true);
  view.setUint32(24, Math.max(1, Math.ceil(particleCount / WORKGROUP_SIZE)), true);
  view.setUint32(28, 1, true);
  view.setUint32(32, nonNegativeInteger(reactionTable.atomTermCount ?? 0, 'atomTermCount'), true);
  view.setFloat32(36, Number.isFinite(Number(dtSeconds)) && Number(dtSeconds) > 0
    ? Number(dtSeconds)
    : 0, true);
  view.setUint32(48, nonNegativeInteger(eventCapacityRows, 'eventCapacityRows'), true);
  view.setUint32(52, nonNegativeInteger(generationId, 'generationId'), true);
  view.setFloat32(56, Math.max(0, Number(minLiveMassKg) || 0), true);
  view.setUint32(60, nonNegativeInteger(particleDispatchX, 'particleDispatchX'), true);
  view.setUint32(
    64,
    nonNegativeInteger(maxComputeWorkgroupsPerDimension, 'maxComputeWorkgroupsPerDimension'),
    true
  );
  return data;
}

function placementParamsArray({
  particleCount,
  eventRowCount,
  minPlacedMassKg,
  residentNeighborhoodAdmission = null
}) {
  const data = new ArrayBuffer(64);
  const view = new DataView(data);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, eventRowCount, true);
  view.setUint32(8, SPH_REACTION_PRODUCT_EVENT_FLOATS / 4, true);
  view.setUint32(12, SPH_GPU_PARTICLE_STATE_FLOATS / 4, true);
  view.setUint32(16, SPH_GPU_PARTICLE_THERMO_FLOATS / 4, true);
  view.setUint32(20, MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS / 4, true);
  view.setFloat32(24, Math.max(0, Number(minPlacedMassKg) || 0), true);
  const residentEnabled = residentNeighborhoodAdmission?.admitted === true;
  const identity = residentNeighborhoodAdmission?.expectedIdentity;
  view.setUint32(32, residentEnabled ? 1 : 0, true);
  view.setUint32(36, identity?.generation ?? 0, true);
  view.setUint32(40, identity?.leaseTokenLow ?? 0, true);
  view.setUint32(44, identity?.leaseTokenHigh ?? 0, true);
  view.setUint32(48, identity?.positionEpoch ?? 0, true);
  view.setUint32(52, identity?.sourceCount ?? 0, true);
  view.setUint32(56, identity?.consumerBit ?? 0, true);
  view.setUint32(60, residentEnabled ? 1 : 0, true);
  return data;
}

function bindingTupleSignature(layout, entries) {
  return [
    layout,
    ...entries.flatMap((entry) => [
      entry.binding,
      entry.resource?.buffer ?? entry.resource,
      entry.resource?.offset ?? 0,
      entry.resource?.size ?? 0
    ])
  ];
}

function exactSignatureEquals(left, right) {
  return left.length === right.length
    && left.every((value, index) => Object.is(value, right[index]));
}

export function maxProductTermsPerReaction(reactionTable) {
  const reactionCount = nonNegativeInteger(reactionTable?.reactionCount ?? 0, 'reactionCount');
  const totalProductTerms = nonNegativeInteger(
    reactionTable?.productTermCount ?? 0,
    'productTermCount'
  );
  if (reactionCount === 0 || totalProductTerms === 0) return 0;
  const headers = reactionTable?.reactionHeaders;
  const stride = nonNegativeInteger(
    reactionTable?.reactionHeaderStrideFloats ?? 0,
    'reactionHeaderStrideFloats'
  );
  if (!headers || stride < 5 || headers.length < reactionCount * stride) {
    return totalProductTerms;
  }
  let maximum = 0;
  for (let reaction = 0; reaction < reactionCount; reaction += 1) {
    maximum = Math.max(
      maximum,
      nonNegativeInteger(Math.round(Number(headers[reaction * stride + 4]) || 0),
        `reactionHeaders[${reaction}].productTermCount`)
    );
  }
  return Math.min(maximum, totalProductTerms);
}

export function sphReactionProductEventCapacityRows({ particleCount, reactionTable } = {}) {
  const particles = nonNegativeInteger(particleCount, 'particleCount');
  const termsPerPair = maxProductTermsPerReaction(reactionTable);
  const capacityRows = Math.floor(particles / 2) * termsPerPair;
  if (!Number.isSafeInteger(capacityRows) || capacityRows > UINT32_MAX) {
    throw new RangeError('reaction product-event live capacity exceeds uint32');
  }
  return capacityRows;
}

export function createSphReactionProductEventPlacementWorkspaceGpu(device, {
  eventCapacityRows,
  particleCapacity = eventCapacityRows,
  sequenceStepCapacity = 1,
  label = 'ulg-sph-reaction-product-event-placement-workspace'
} = {}) {
  if (!device?.createBuffer) {
    throw new TypeError('reaction product-event placement workspace requires a WebGPU-like device');
  }
  const capacityRows = nonNegativeInteger(eventCapacityRows, 'eventCapacityRows');
  if (capacityRows < 1) {
    throw new RangeError('eventCapacityRows must be at least one');
  }
  const particleCapacityRows = nonNegativeInteger(particleCapacity, 'particleCapacity');
  if (particleCapacityRows < 1) {
    throw new RangeError('particleCapacity must be at least one');
  }
  const paramsSlotCount = nonNegativeInteger(sequenceStepCapacity, 'sequenceStepCapacity');
  if (paramsSlotCount < 1) {
    throw new RangeError('sequenceStepCapacity must be at least one');
  }
  const maxComputeWorkgroupsPerDimension = nonNegativeInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'device.limits.maxComputeWorkgroupsPerDimension'
  );
  computeDispatchShape(capacityRows, maxComputeWorkgroupsPerDimension);
  computeDispatchShape(particleCapacityRows, maxComputeWorkgroupsPerDimension);
  const workspaceWordCount = capacityRows + particleCapacityRows;
  if (!Number.isSafeInteger(workspaceWordCount) || workspaceWordCount > UINT32_MAX) {
    throw new RangeError('eventCapacityRows exceeds uint32 workspace indexing capacity');
  }
  const candidateBufferByteLength = workspaceWordCount * Uint32Array.BYTES_PER_ELEMENT;
  const productEventBufferByteLength = capacityRows
    * SPH_REACTION_PRODUCT_EVENT_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const countBufferByteLength = particleCapacityRows * Uint32Array.BYTES_PER_ELEMENT;
  const reactionOutcomeBufferByteLength = particleCapacityRows
    * SPH_REACTION_ADMITTED_OUTCOME_BYTES_PER_PARTICLE;
  const paramsArenaByteLength = paramsSlotCount * PARAMS_SLOT_STRIDE_BYTES;
  if (!Number.isSafeInteger(paramsArenaByteLength)) {
    throw new RangeError('sequenceStepCapacity exceeds safe parameter-arena sizing');
  }
  const maxBufferSize = Number(device.limits?.maxBufferSize ?? Number.MAX_SAFE_INTEGER);
  const maxStorageBindingSize = Number(
    device.limits?.maxStorageBufferBindingSize ?? maxBufferSize
  );
  const largestRequiredBinding = Math.max(
    candidateBufferByteLength,
    productEventBufferByteLength,
    countBufferByteLength,
    reactionOutcomeBufferByteLength,
    SPH_REACTION_PRODUCT_EVENT_PREFIX_METADATA_BYTES,
    SPH_REACTION_PRODUCT_EVENT_PREFIX_INDIRECT_BYTES
  );
  if (largestRequiredBinding > maxBufferSize
    || largestRequiredBinding > maxStorageBindingSize) {
    throw new RangeError(
      `reaction product placement workspace requires ${largestRequiredBinding} bytes beyond device capacity`
    );
  }
  if (paramsArenaByteLength > maxBufferSize) {
    throw new RangeError(
      `reaction product placement params arena requires ${paramsArenaByteLength} bytes beyond device capacity`
    );
  }
  const candidateBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-candidates`,
    size: candidateBufferByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  const productEventBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-exact-live-rows`,
    size: productEventBufferByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  }), device);
  const eventCountBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-per-source-counts`,
    size: countBufferByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE
  }), device);
  const eventOffsetBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-per-source-offsets`,
    size: countBufferByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE
  }), device);
  const reactionOutcomeBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-admitted-reaction-outcomes`,
    size: reactionOutcomeBufferByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  }), device);
  const prefixMetadataBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-prefix-metadata`,
    size: SPH_REACTION_PRODUCT_EVENT_PREFIX_METADATA_BYTES,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  }), device);
  const prefixDispatchIndirectBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-prefix-dispatch-indirect`,
    size: SPH_REACTION_PRODUCT_EVENT_PREFIX_INDIRECT_BYTES,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.COPY_SRC
  }), device);
  const summaryParamsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-summary-params-arena`,
    size: paramsArenaByteLength,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  const placementParamsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-placement-params-arena`,
    size: paramsArenaByteLength,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  const fallbackNeighborhoodBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${label}-placement-neighborhood-disabled`,
    size: 40 * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPU_BUFFER_USAGE.STORAGE
  }), device);
  const prefixScan = createWebGpuU32ExclusiveScan(device, {
    maxElementCount: particleCapacityRows,
    fixedElementCount: particleCapacityRows,
    retainParamsBuffer: true,
    label: `${label}-source-count-scan`
  });
  const allocationEntries = [
    { role: 'product-event-target-claims', buffer: candidateBuffer },
    { role: 'product-event-exact-prefix', buffer: productEventBuffer },
    { role: 'product-event-source-counts', buffer: eventCountBuffer },
    { role: 'product-event-source-offsets', buffer: eventOffsetBuffer },
    { role: 'reaction-admitted-outcomes', buffer: reactionOutcomeBuffer },
    { role: 'product-event-prefix-metadata', buffer: prefixMetadataBuffer },
    { role: 'product-event-prefix-dispatch', buffer: prefixDispatchIndirectBuffer },
    { role: 'product-event-summary-params-arena', buffer: summaryParamsBuffer },
    { role: 'product-event-placement-params-arena', buffer: placementParamsBuffer },
    { role: 'product-event-disabled-neighborhood', buffer: fallbackNeighborhoodBuffer },
    ...prefixScan.allocationEntries()
  ];
  let generationId = 0;
  let destroyed = false;
  let bindGroupCreationCount = 0;
  let bindGroupReuseCount = 0;
  const bindGroupCaches = new Map();
  const workspace = {
    schema: ULG_SPH_REACTION_PRODUCT_EVENT_PLACEMENT_WORKSPACE_SCHEMA,
    status: 'reaction-product-event-placement-workspace-ready',
    device,
    label,
    eventCapacityRows: capacityRows,
    particleCapacity: particleCapacityRows,
    sequenceStepCapacity: paramsSlotCount,
    paramsSlotCount,
    paramsSlotStrideBytes: PARAMS_SLOT_STRIDE_BYTES,
    maxComputeWorkgroupsPerDimension,
    candidateBuffer,
    candidateBufferByteLength,
    productEventBuffer,
    productEventBufferByteLength,
    eventCountBuffer,
    eventOffsetBuffer,
    countBufferByteLength,
    reactionOutcomeBuffer,
    reactionOutcomeBufferByteLength,
    reactionOutcomeStrideWords: SPH_REACTION_ADMITTED_OUTCOME_WORDS,
    prefixMetadataBuffer,
    prefixMetadataBufferByteLength: SPH_REACTION_PRODUCT_EVENT_PREFIX_METADATA_BYTES,
    prefixDispatchIndirectBuffer,
    prefixDispatchIndirectBufferByteLength: SPH_REACTION_PRODUCT_EVENT_PREFIX_INDIRECT_BYTES,
    summaryParamsBuffer,
    placementParamsBuffer,
    fallbackNeighborhoodBuffer,
    prefixScan,
    allocationEntries,
    totalByteLength: allocationEntries.reduce(
      (sum, entry) => sum + Math.max(0, Number(entry.buffer?.size) || 0),
      0
    ),
    destroyed: false,
    allocationPolicy:
      'caller-owned-reusable-resolve-outcome-exact-prefix-count-scan-event-and-claim-workspace',
    nextGenerationId() {
      generationId = (generationId + 1) >>> 0;
      if (generationId === 0) generationId = 1;
      return generationId;
    },
    paramsSlot(slotIndex = 0) {
      const index = nonNegativeInteger(slotIndex, 'paramsSlotIndex');
      if (index >= paramsSlotCount) {
        throw new RangeError(
          `paramsSlotIndex ${index} exceeds sequenceStepCapacity ${paramsSlotCount}`
        );
      }
      const byteOffset = index * PARAMS_SLOT_STRIDE_BYTES;
      return Object.freeze({
        slotIndex: index,
        byteOffset,
        summary: Object.freeze({
          buffer: summaryParamsBuffer,
          offset: byteOffset,
          size: SUMMARY_PARAMS_BYTE_LENGTH
        }),
        placement: Object.freeze({
          buffer: placementParamsBuffer,
          offset: byteOffset,
          size: PLACEMENT_PARAMS_BYTE_LENGTH
        })
      });
    },
    writeSummaryParams(slotIndex, data) {
      const slot = workspace.paramsSlot(slotIndex);
      if (data?.byteLength !== SUMMARY_PARAMS_BYTE_LENGTH) {
        throw new RangeError(`summary params must contain ${SUMMARY_PARAMS_BYTE_LENGTH} bytes`);
      }
      device.queue.writeBuffer(summaryParamsBuffer, slot.byteOffset, data);
      return slot;
    },
    writePlacementParams(slotIndex, data) {
      const slot = workspace.paramsSlot(slotIndex);
      if (data?.byteLength !== PLACEMENT_PARAMS_BYTE_LENGTH) {
        throw new RangeError(
          `placement params must contain ${PLACEMENT_PARAMS_BYTE_LENGTH} bytes`
        );
      }
      device.queue.writeBuffer(placementParamsBuffer, slot.byteOffset, data);
      return slot;
    },
    bindGroupForSlot(kind, slotIndex, signature, create) {
      const slot = workspace.paramsSlot(slotIndex);
      if (!Array.isArray(signature) || typeof create !== 'function') {
        throw new TypeError('workspace bind-group cache requires a signature and factory');
      }
      const key = `${String(kind)}:${slot.slotIndex}`;
      const candidates = bindGroupCaches.get(key) || [];
      const cached = candidates.find((entry) => exactSignatureEquals(entry.signature, signature));
      if (cached) {
        bindGroupReuseCount += 1;
        return { bindGroup: cached.bindGroup, cacheHit: true };
      }
      const bindGroup = create();
      candidates.push({ signature: [...signature], bindGroup });
      bindGroupCaches.set(key, candidates);
      bindGroupCreationCount += 1;
      return { bindGroup, cacheHit: false };
    },
    bindGroupCacheEvidence() {
      return Object.freeze({
        creationCount: bindGroupCreationCount,
        reuseCount: bindGroupReuseCount,
        entryCount: [...bindGroupCaches.values()].reduce(
          (sum, entries) => sum + entries.length,
          0
        )
      });
    },
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      workspace.destroyed = true;
      workspace.status = 'reaction-product-event-placement-workspace-destroyed';
      for (const buffer of [
        candidateBuffer,
        productEventBuffer,
        eventCountBuffer,
        eventOffsetBuffer,
        reactionOutcomeBuffer,
        prefixMetadataBuffer,
        prefixDispatchIndirectBuffer,
        summaryParamsBuffer,
        placementParamsBuffer,
        fallbackNeighborhoodBuffer
      ]) buffer.destroy?.();
      bindGroupCaches.clear();
      prefixScan.destroy();
      return true;
    }
  };
  return workspace;
}

function resolvePlacementWorkspace(
  device,
  workspace,
  eventCapacityRows,
  particleCount,
  paramsSlotIndex,
  label
) {
  const requiredSlotCount = nonNegativeInteger(paramsSlotIndex, 'paramsSlotIndex') + 1;
  const resolved = workspace || createSphReactionProductEventPlacementWorkspaceGpu(device, {
    eventCapacityRows,
    particleCapacity: particleCount,
    sequenceStepCapacity: requiredSlotCount,
    label: `${label}-workspace`
  });
  if (resolved.schema !== ULG_SPH_REACTION_PRODUCT_EVENT_PLACEMENT_WORKSPACE_SCHEMA) {
    throw new TypeError('productEventPlacementWorkspace schema mismatch');
  }
  if (resolved.destroyed === true) {
    throw new Error('productEventPlacementWorkspace is destroyed');
  }
  if (resolved.device !== device || !webGpuBufferMatchesDevice(resolved.candidateBuffer, device)) {
    throw new Error('productEventPlacementWorkspace device mismatch');
  }
  if (resolved.eventCapacityRows < eventCapacityRows) {
    throw new RangeError(
      `productEventPlacementWorkspace capacity ${resolved.eventCapacityRows} is smaller than ${eventCapacityRows}`
    );
  }
  if (resolved.particleCapacity !== particleCount) {
    throw new RangeError(
      `productEventPlacementWorkspace particle capacity ${resolved.particleCapacity} does not match ${particleCount}`
    );
  }
  if (resolved.sequenceStepCapacity < requiredSlotCount) {
    throw new RangeError(
      `productEventPlacementWorkspace sequence capacity ${resolved.sequenceStepCapacity} is smaller than required slot ${paramsSlotIndex}`
    );
  }
  assertBuffer(
    device,
    resolved.candidateBuffer,
    'productEventPlacementWorkspace.candidateBuffer',
    (resolved.eventCapacityRows + resolved.particleCapacity) * 4
  );
  assertBuffer(
    device,
    resolved.productEventBuffer,
    'productEventPlacementWorkspace.productEventBuffer',
    resolved.eventCapacityRows * SPH_REACTION_PRODUCT_EVENT_FLOATS * 4
  );
  assertBuffer(device, resolved.eventCountBuffer,
    'productEventPlacementWorkspace.eventCountBuffer', particleCount * 4);
  assertBuffer(device, resolved.eventOffsetBuffer,
    'productEventPlacementWorkspace.eventOffsetBuffer', particleCount * 4);
  assertBuffer(device, resolved.reactionOutcomeBuffer,
    'productEventPlacementWorkspace.reactionOutcomeBuffer',
    particleCount * SPH_REACTION_ADMITTED_OUTCOME_BYTES_PER_PARTICLE);
  assertBuffer(device, resolved.prefixMetadataBuffer,
    'productEventPlacementWorkspace.prefixMetadataBuffer',
    SPH_REACTION_PRODUCT_EVENT_PREFIX_METADATA_BYTES);
  assertBuffer(device, resolved.prefixDispatchIndirectBuffer,
    'productEventPlacementWorkspace.prefixDispatchIndirectBuffer',
    SPH_REACTION_PRODUCT_EVENT_PREFIX_INDIRECT_BYTES);
  return {
    workspace: resolved,
    owned: workspace == null
  };
}

export function createSphReactionProductEventAdmissionWebGpuEncoderStage({
  device,
  commandEncoder,
  sphParticleState,
  reactionTable,
  reactionRecordBuffer,
  proposalBuffer,
  productEventPlacementWorkspace = null,
  productEventCapacityRows = null,
  paramsSlotIndex = 0,
  dtSeconds = 0,
  minPlacedMassKg = 1e-9,
  timestampProfiler = null,
  timestampMetadata = null,
  label = 'ulg-sph-reaction-product-event-prefix'
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer || !device?.createBindGroup) {
    throw new TypeError('reaction product-event admission requires a WebGPU-like device');
  }
  if (!commandEncoder?.beginComputePass) {
    throw new TypeError('reaction product-event admission requires a caller-owned commandEncoder');
  }
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('reaction product-event admission requires a packed SPH particle state');
  }
  if (reactionTable?.schema !== ULG_SPH_GPU_REACTION_TABLE_SCHEMA) {
    throw new TypeError('reaction product-event admission requires a packed reaction table');
  }
  const particleCount = nonNegativeInteger(sphParticleState.particleCount, 'particleCount');
  const immutableCapacityRows = sphReactionProductEventCapacityRows({
    particleCount,
    reactionTable
  });
  const requestedCapacity = productEventCapacityRows == null
    ? immutableCapacityRows
    : nonNegativeInteger(productEventCapacityRows, 'productEventCapacityRows');
  if (requestedCapacity < immutableCapacityRows) {
    throw new RangeError(
      `productEventCapacityRows ${requestedCapacity} is below immutable mutual-pair bound ${immutableCapacityRows}`
    );
  }
  if (particleCount === 0 || immutableCapacityRows === 0) {
    return {
      schema: 'peercompute.ulg.sph-reaction-product-event-admission-stage.v0',
      status: 'reaction-product-event-admission-empty',
      encoded: false,
      eventCapacityRows: 0,
      immutableCapacityRows,
      productEventPlacementWorkspace: null,
      cleanupSubmittedWork() {}
    };
  }
  assertBuffer(device, reactionRecordBuffer, 'reactionRecordBuffer', 4);
  assertBuffer(device, proposalBuffer, 'proposalBuffer', Math.max(4, particleCount * 16));
  const workspaceResolution = resolvePlacementWorkspace(
    device,
    productEventPlacementWorkspace,
    requestedCapacity,
    particleCount,
    paramsSlotIndex,
    label
  );
  const workspace = workspaceResolution.workspace;
  const generationId = workspace.nextGenerationId();
  const particleDispatch = computeDispatchShape(
    particleCount,
    workspace.maxComputeWorkgroupsPerDimension
  );
  const paramsSlot = workspace.writeSummaryParams(
    paramsSlotIndex,
    summaryParamsArray({
      particleCount,
      reactionTable,
      dtSeconds,
      eventCapacityRows: workspace.eventCapacityRows,
      generationId,
      minLiveMassKg: minPlacedMassKg,
      particleDispatchX: particleDispatch[0],
      maxComputeWorkgroupsPerDimension: workspace.maxComputeWorkgroupsPerDimension
    })
  );
  const paramsBuffer = paramsSlot.summary.buffer;
  const finalizeBindings = [
    computeBufferBinding(7, 'uniform'),
    computeBufferBinding(10, 'storage'),
    computeBufferBinding(11, 'storage')
  ];
  const finalizeInfo = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-reaction-product-event-prefix-finalize-admission.v0',
    label: `${label}-finalize-admission`,
    code: sphReactionProductEventPrefixWgsl,
    entryPoint: 'finalize_product_event_admission',
    bindings: finalizeBindings
  });
  const finalizeBindGroupDescriptor = {
    label: `${label}-finalize-admission-bind-${generationId}`,
    layout: finalizeInfo.bindGroupLayout,
    entries: [
      { binding: 7, resource: paramsSlot.summary },
      { binding: 10, resource: { buffer: workspace.prefixMetadataBuffer } },
      { binding: 11, resource: { buffer: workspace.prefixDispatchIndirectBuffer } }
    ]
  };
  const finalizeBindGroupCache = workspace.bindGroupForSlot(
    'admission-finalize',
    paramsSlot.slotIndex,
    bindingTupleSignature(
      finalizeBindGroupDescriptor.layout,
      finalizeBindGroupDescriptor.entries
    ),
    () => device.createBindGroup(finalizeBindGroupDescriptor)
  );
  const finalizeBindGroup = finalizeBindGroupCache.bindGroup;
  const descriptor = (name, fallback) => timestampProfiler?.beginComputePassDescriptor
    ? timestampProfiler.beginComputePassDescriptor(name, {
        ...(timestampMetadata || {}),
        generationId,
        particleCount,
        eventCapacityRows: workspace.eventCapacityRows
      })
    : { label: fallback };
  const pass = commandEncoder.beginComputePass(descriptor(
    'reactionProductEventAdmissionFinalize',
    `${label}-finalize-admission-${generationId}`
  ));
  pass.setPipeline(finalizeInfo.pipeline);
  pass.setBindGroup(0, finalizeBindGroup);
  pass.dispatchWorkgroups(1);
  pass.end();
  let ownedWorkspaceDestroyed = false;
  return {
    schema: 'peercompute.ulg.sph-reaction-product-event-admission-stage.v0',
    status: 'reaction-product-event-capacity-admission-encoded',
    encoded: true,
    generationId,
    particleCount,
    particleDispatch,
    immutableCapacityRows,
    eventCapacityRows: workspace.eventCapacityRows,
    productEventPlacementWorkspace: workspace,
    productEventPlacementWorkspaceOwned: workspaceResolution.owned,
    paramsBuffer,
    paramsSlotIndex: paramsSlot.slotIndex,
    paramsByteOffset: paramsSlot.byteOffset,
    paramsByteStride: workspace.paramsSlotStrideBytes,
    admissionBindGroupCacheHit: finalizeBindGroupCache.cacheHit,
    prefixMetadataBuffer: workspace.prefixMetadataBuffer,
    prefixDispatchIndirectBuffer: workspace.prefixDispatchIndirectBuffer,
    reactionOutcomeBuffer: workspace.reactionOutcomeBuffer,
    reactionOutcomeBufferByteLength: workspace.reactionOutcomeBufferByteLength,
    reactionOutcomeStrideWords: workspace.reactionOutcomeStrideWords,
    reactionOutcomeReadyAuthority:
      'gpu-prefix-metadata-words-18-generation-and-19-ready-magic-after-resolve',
    reactionMutationAdmissionAuthority: 'gpu-prefix-metadata-word-8',
    admissionBoundPolicy:
      'floor-particle-count-over-two-times-max-product-terms-per-reaction',
    overflowFlagsAuthority: 'gpu-prefix-metadata-word-7',
    queueSubmitPerformed: false,
    mapPerformed: false,
    readbackPerformed: false,
    normalHotLoopReadbackFree: true,
    cleanupSubmittedWork({ destroyWorkspace = workspaceResolution.owned } = {}) {
      let changed = false;
      if (destroyWorkspace && workspaceResolution.owned && !ownedWorkspaceDestroyed) {
        ownedWorkspaceDestroyed = workspace.destroy();
        changed = ownedWorkspaceDestroyed || changed;
      }
      return changed;
    }
  };
}

export function createSphReactionProductEventWebGpuEncoderStage({
  device,
  commandEncoder,
  sphParticleState,
  reactionTable,
  sourceStateBuffer,
  sourceThermoBuffer,
  nextStateBuffer,
  nextThermoBuffer,
  nextMechanicsBuffer,
  reactionRecordBuffer,
  proposalBuffer,
  productEventPlacementWorkspace = null,
  productEventAdmissionStage = null,
  productEventCapacityRows = null,
  paramsSlotIndex = 0,
  residentNeighborhoodAdmission = null,
  dtSeconds = 0,
  placeProductEvents = true,
  minPlacedMassKg = 1e-9,
  timestampProfiler = null,
  timestampMetadata = null,
  label = 'ulg-sph-reaction-product-event-resident'
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer || !device?.createBindGroup) {
    throw new TypeError('reaction product-event encoder stage requires a WebGPU-like device');
  }
  if (!commandEncoder?.beginComputePass) {
    throw new TypeError('reaction product-event encoder stage requires a caller-owned commandEncoder');
  }
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('reaction product-event encoder stage requires a packed SPH particle state');
  }
  if (reactionTable?.schema !== ULG_SPH_GPU_REACTION_TABLE_SCHEMA) {
    throw new TypeError('reaction product-event encoder stage requires a packed reaction table');
  }
  const particleCount = nonNegativeInteger(sphParticleState.particleCount, 'particleCount');
  const immutableCapacityRows = sphReactionProductEventCapacityRows({
    particleCount,
    reactionTable
  });
  if (immutableCapacityRows === 0) {
    return {
      schema: ULG_SPH_REACTION_PRODUCT_EVENT_ENCODER_STAGE_SCHEMA,
      status: 'reaction-product-event-encoder-stage-empty',
      commandEncoderOwnership: 'caller',
      submissionOwnership: 'caller',
      queueSubmitPerformed: false,
      mapPerformed: false,
      readbackPerformed: false,
      normalHotLoopReadbackFree: true,
      productEventBuffer: null,
      productEventRowCount: 0,
      productEventBufferCapacityRows: 0,
      productEventStrideFloats: SPH_REACTION_PRODUCT_EVENT_FLOATS,
      carrierPlacementEncoded: false,
      residentProductMass: null,
      cleanupSubmittedWork() {}
    };
  }
  const stateBytes = particleCount * SPH_GPU_PARTICLE_STATE_FLOATS * 4;
  const thermoBytes = particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS * 4;
  const mechanicsBytes = particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * 4;
  assertBuffer(device, sourceStateBuffer, 'sourceStateBuffer', stateBytes);
  assertBuffer(device, sourceThermoBuffer, 'sourceThermoBuffer', thermoBytes);
  assertBuffer(device, nextStateBuffer, 'nextStateBuffer', stateBytes);
  assertBuffer(device, nextThermoBuffer, 'nextThermoBuffer', thermoBytes);
  assertBuffer(device, reactionRecordBuffer, 'reactionRecordBuffer', 4);
  assertBuffer(device, proposalBuffer, 'proposalBuffer', Math.max(4, particleCount * 16));
  if (placeProductEvents) {
    assertBuffer(device, nextMechanicsBuffer, 'nextMechanicsBuffer', mechanicsBytes);
    if (residentNeighborhoodAdmission && residentNeighborhoodAdmission.admitted !== true) {
      throw new Error('reaction product placement resident neighborhood was not admitted');
    }
    if (residentNeighborhoodAdmission?.admitted === true) {
      assertBuffer(
        device,
        residentNeighborhoodAdmission.packedCandidateCsrBuffer,
        'residentNeighborhoodAdmission.packedCandidateCsrBuffer',
        40 * Uint32Array.BYTES_PER_ELEMENT
      );
    }
  }
  const admissionStage = productEventAdmissionStage
    || createSphReactionProductEventAdmissionWebGpuEncoderStage({
      device,
      commandEncoder,
      sphParticleState,
      reactionTable,
      reactionRecordBuffer,
      proposalBuffer,
      productEventPlacementWorkspace,
      productEventCapacityRows,
      paramsSlotIndex,
      dtSeconds,
      minPlacedMassKg,
      timestampProfiler,
      timestampMetadata,
      label: `${label}-admission`
    });
  if (admissionStage?.encoded !== true) {
    throw new Error('reaction product-event exact prefix requires encoded capacity admission');
  }
  if (productEventAdmissionStage
    && productEventPlacementWorkspace
    && admissionStage.productEventPlacementWorkspace !== productEventPlacementWorkspace) {
    throw new Error('productEventAdmissionStage workspace mismatch');
  }
  if (admissionStage.paramsSlotIndex !== nonNegativeInteger(paramsSlotIndex, 'paramsSlotIndex')) {
    throw new Error('productEventAdmissionStage params slot mismatch');
  }
  const placementWorkspace = admissionStage.productEventPlacementWorkspace;
  const placementWorkspaceOwned = admissionStage.productEventPlacementWorkspaceOwned === true;
  const eventCapacityRows = placementWorkspace.eventCapacityRows;
  const eventByteLength = placementWorkspace.productEventBufferByteLength;
  const productEventBuffer = placementWorkspace.productEventBuffer;
  const paramsBuffer = admissionStage.paramsBuffer;
  const paramsSlot = placementWorkspace.paramsSlot(admissionStage.paramsSlotIndex);
  const residentPlacementNeighborhoodBuffer = residentNeighborhoodAdmission?.admitted === true
    ? residentNeighborhoodAdmission.packedCandidateCsrBuffer
    : null;
  const fallbackNeighborhoodBuffer = placeProductEvents && !residentPlacementNeighborhoodBuffer
    ? placementWorkspace.fallbackNeighborhoodBuffer
    : null;

  const commonReadEntries = [
    { binding: 0, resource: { buffer: sourceStateBuffer } },
    { binding: 1, resource: { buffer: sourceThermoBuffer } },
    { binding: 2, resource: { buffer: nextStateBuffer } },
    { binding: 3, resource: { buffer: nextThermoBuffer } },
    { binding: 4, resource: { buffer: reactionRecordBuffer } },
    { binding: 5, resource: { buffer: proposalBuffer } },
    { binding: 7, resource: paramsSlot.summary },
    { binding: 8, resource: { buffer: placementWorkspace.eventCountBuffer } },
    { binding: 9, resource: { buffer: placementWorkspace.eventOffsetBuffer } },
    { binding: 10, resource: { buffer: placementWorkspace.prefixMetadataBuffer } },
    { binding: 11, resource: { buffer: placementWorkspace.prefixDispatchIndirectBuffer } },
    { binding: 12, resource: { buffer: placementWorkspace.reactionOutcomeBuffer } }
  ];
  const countLiveBindings = [
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(7, 'uniform'),
    computeBufferBinding(8, 'storage'),
    computeBufferBinding(10, 'storage'),
    computeBufferBinding(12, 'read-only-storage')
  ];
  const finalizePrefixBindings = [
    computeBufferBinding(7, 'uniform'),
    computeBufferBinding(8, 'storage'),
    computeBufferBinding(9, 'read-only-storage'),
    computeBufferBinding(10, 'storage'),
    computeBufferBinding(11, 'storage')
  ];
  const emitBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(6, 'storage'),
    computeBufferBinding(7, 'uniform'),
    computeBufferBinding(8, 'storage'),
    computeBufferBinding(9, 'read-only-storage'),
    computeBufferBinding(10, 'storage'),
    computeBufferBinding(12, 'read-only-storage')
  ];
  const finalizeEmissionBindings = [
    computeBufferBinding(7, 'uniform'),
    computeBufferBinding(10, 'storage'),
    computeBufferBinding(11, 'storage')
  ];
  const countLiveInfo = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-reaction-product-event-prefix-count-live.v2',
    label: `${label}-count-live`,
    code: sphReactionProductEventPrefixWgsl,
    entryPoint: 'count_live_product_events',
    bindings: countLiveBindings
  });
  const finalizePrefixInfo = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-reaction-product-event-prefix-finalize-live.v0',
    label: `${label}-finalize-live-prefix`,
    code: sphReactionProductEventPrefixWgsl,
    entryPoint: 'finalize_live_product_event_prefix',
    bindings: finalizePrefixBindings
  });
  const emitInfo = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-reaction-product-event-prefix-emit-live.v2',
    label: `${label}-emit-live-prefix`,
    code: sphReactionProductEventPrefixWgsl,
    entryPoint: 'emit_live_product_events',
    bindings: emitBindings
  });
  const finalizeEmissionInfo = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-reaction-product-event-prefix-finalize-emission.v0',
    label: `${label}-finalize-emission`,
    code: sphReactionProductEventPrefixWgsl,
    entryPoint: 'finalize_product_event_emission',
    bindings: finalizeEmissionBindings
  });
  const entriesFor = (...bindings) => commonReadEntries.filter(
    (entry) => bindings.includes(entry.binding)
  );
  const cachedStageBindGroup = (kind, descriptor) => placementWorkspace.bindGroupForSlot(
    kind,
    paramsSlot.slotIndex,
    bindingTupleSignature(descriptor.layout, descriptor.entries),
    () => device.createBindGroup(descriptor)
  );
  const countLiveBindGroupDescriptor = {
    label: `${label}-count-live-bind`,
    layout: countLiveInfo.bindGroupLayout,
    entries: entriesFor(2, 3, 4, 7, 8, 10, 12)
  };
  const countLiveBindGroupCache = cachedStageBindGroup(
    'count-live',
    countLiveBindGroupDescriptor
  );
  const countLiveBindGroup = countLiveBindGroupCache.bindGroup;
  const finalizePrefixBindGroupDescriptor = {
    label: `${label}-finalize-live-prefix-bind`,
    layout: finalizePrefixInfo.bindGroupLayout,
    entries: entriesFor(7, 8, 9, 10, 11)
  };
  const finalizePrefixBindGroupCache = cachedStageBindGroup(
    'finalize-live-prefix',
    finalizePrefixBindGroupDescriptor
  );
  const finalizePrefixBindGroup = finalizePrefixBindGroupCache.bindGroup;
  const emitBindGroupDescriptor = {
    label: `${label}-emit-live-prefix-bind`,
    layout: emitInfo.bindGroupLayout,
    entries: [
      ...entriesFor(0, 1, 2, 3, 4),
      { binding: 6, resource: { buffer: productEventBuffer } },
      ...entriesFor(7, 8, 9, 10, 12)
    ]
  };
  const emitBindGroupCache = cachedStageBindGroup(
    'emit-live-prefix',
    emitBindGroupDescriptor
  );
  const emitBindGroup = emitBindGroupCache.bindGroup;
  const finalizeEmissionBindGroupDescriptor = {
    label: `${label}-finalize-emission-bind`,
    layout: finalizeEmissionInfo.bindGroupLayout,
    entries: entriesFor(7, 10, 11)
  };
  const finalizeEmissionBindGroupCache = cachedStageBindGroup(
    'finalize-emission',
    finalizeEmissionBindGroupDescriptor
  );
  const finalizeEmissionBindGroup = finalizeEmissionBindGroupCache.bindGroup;
  const descriptor = (name, fallback) => timestampProfiler?.beginComputePassDescriptor
    ? timestampProfiler.beginComputePassDescriptor(name, {
        ...(timestampMetadata || {}),
        productEventCapacityRows: eventCapacityRows,
        productEventExactCountAuthority: 'gpu-prefix-metadata-word-6'
      })
    : { label: fallback };
  let pass = commandEncoder.beginComputePass(descriptor(
    'reactionProductEventExactCount',
    `${label}-count-live`
  ));
  pass.setPipeline(countLiveInfo.pipeline);
  pass.setBindGroup(0, countLiveBindGroup);
  pass.dispatchWorkgroups(...admissionStage.particleDispatch);
  pass.end();
  const exactScanEncoding = placementWorkspace.prefixScan.encode(commandEncoder, {
    inputBuffer: placementWorkspace.eventCountBuffer,
    outputBuffer: placementWorkspace.eventOffsetBuffer,
    elementCount: particleCount
  }, {
    timestampProfiler,
    timestampMetadata: {
      ...(timestampMetadata || {}),
      productEventPrefixGenerationId: admissionStage.generationId
    },
    labelPrefix: `${label}-exact-live`
  });
  if (exactScanEncoding.transientBuffers.length !== 0) {
    throw new Error('reaction product-event exact prefix requires retained scan params');
  }
  pass = commandEncoder.beginComputePass(descriptor(
    'reactionProductEventExactPrefixFinalize',
    `${label}-finalize-live-prefix`
  ));
  pass.setPipeline(finalizePrefixInfo.pipeline);
  pass.setBindGroup(0, finalizePrefixBindGroup);
  pass.dispatchWorkgroups(1);
  pass.end();
  pass = commandEncoder.beginComputePass(descriptor(
    'reactionProductEventEmitExactPrefix',
    `${label}-emit-live-prefix`
  ));
  if (typeof pass.dispatchWorkgroupsIndirect !== 'function') {
    throw new TypeError('reaction product-event exact prefix requires dispatchWorkgroupsIndirect');
  }
  pass.setPipeline(emitInfo.pipeline);
  pass.setBindGroup(0, emitBindGroup);
  pass.dispatchWorkgroupsIndirect(placementWorkspace.prefixDispatchIndirectBuffer, 0);
  pass.end();
  pass = commandEncoder.beginComputePass(descriptor(
    'reactionProductEventEmissionFinalize',
    `${label}-finalize-emission`
  ));
  pass.setPipeline(finalizeEmissionInfo.pipeline);
  pass.setBindGroup(0, finalizeEmissionBindGroup);
  pass.dispatchWorkgroups(1);
  pass.end();

  let carrierSearchBindGroupCache = null;
  let placementClaimBindGroupCache = null;
  let placementBindGroupCache = null;
  if (placeProductEvents) {
    if (typeof commandEncoder.clearBuffer !== 'function') {
      throw new TypeError('reaction product-event placement requires commandEncoder.clearBuffer');
    }
    const placementParamsSlot = placementWorkspace.writePlacementParams(
      paramsSlot.slotIndex,
      placementParamsArray({
        particleCount,
        eventRowCount: eventCapacityRows,
        minPlacedMassKg,
        residentNeighborhoodAdmission
      })
    );
    const placementBindings = [
      computeBufferBinding(0, 'storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'uniform'),
      computeBufferBinding(5, 'storage'),
      computeBufferBinding(6, 'read-only-storage'),
      computeBufferBinding(7, 'read-only-storage')
    ];
    const carrierSearchInfo = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-sph-reaction-product-event-carrier-search.encoder-stage.v1',
      label: `${label}-carrier-search`,
      code: sphReactionProductEventPlacementWgsl,
      entryPoint: 'find_product_event_carriers',
      bindings: placementBindings
    });
    const placementClaimInfo = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-sph-reaction-product-event-placement-claim.encoder-stage.v0',
      label: `${label}-claim`,
      code: sphReactionProductEventPlacementWgsl,
      entryPoint: 'claim_product_event_carriers',
      bindings: placementBindings
    });
    const placementInfo = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-sph-reaction-product-event-placement.encoder-stage.v2',
      label: `${label}-place`,
      code: sphReactionProductEventPlacementWgsl,
      entryPoint: 'place_product_events',
      bindings: placementBindings
    });
    const placementEntries = [
      { binding: 0, resource: { buffer: productEventBuffer } },
      { binding: 1, resource: { buffer: nextStateBuffer } },
      { binding: 2, resource: { buffer: nextThermoBuffer } },
      { binding: 3, resource: { buffer: nextMechanicsBuffer } },
      { binding: 4, resource: placementParamsSlot.placement },
      { binding: 5, resource: { buffer: placementWorkspace.candidateBuffer } },
      {
        binding: 6,
        resource: {
          buffer: residentPlacementNeighborhoodBuffer || fallbackNeighborhoodBuffer
        }
      },
      { binding: 7, resource: { buffer: placementWorkspace.prefixMetadataBuffer } }
    ];
    const carrierSearchBindGroupDescriptor = {
      label: `${label}-carrier-search-bind`,
      layout: carrierSearchInfo.bindGroupLayout,
      entries: placementEntries
    };
    carrierSearchBindGroupCache = cachedStageBindGroup(
      'carrier-search',
      carrierSearchBindGroupDescriptor
    );
    const carrierSearchBindGroup = carrierSearchBindGroupCache.bindGroup;
    const placementBindGroupDescriptor = {
      label: `${label}-place-bind`,
      layout: placementInfo.bindGroupLayout,
      entries: placementEntries
    };
    placementBindGroupCache = cachedStageBindGroup(
      'carrier-place',
      placementBindGroupDescriptor
    );
    const placementBindGroup = placementBindGroupCache.bindGroup;
    const placementClaimBindGroupDescriptor = {
      label: `${label}-claim-bind`,
      layout: placementClaimInfo.bindGroupLayout,
      entries: placementEntries
    };
    placementClaimBindGroupCache = cachedStageBindGroup(
      'carrier-claim',
      placementClaimBindGroupDescriptor
    );
    const placementClaimBindGroup = placementClaimBindGroupCache.bindGroup;
    commandEncoder.clearBuffer(
      placementWorkspace.candidateBuffer,
      0,
      placementWorkspace.candidateBufferByteLength
    );
    const searchDescriptor = timestampProfiler?.beginComputePassDescriptor
      ? timestampProfiler.beginComputePassDescriptor('reactionProductCarrierSearch', {
          ...(timestampMetadata || {}),
          productEventCapacityRows: eventCapacityRows,
          productEventExactCountAuthority: 'gpu-prefix-metadata-word-6',
          particleCount
        })
      : { label: `${label}-carrier-search` };
    pass = commandEncoder.beginComputePass(searchDescriptor);
    pass.setPipeline(carrierSearchInfo.pipeline);
    pass.setBindGroup(0, carrierSearchBindGroup);
    pass.dispatchWorkgroupsIndirect(placementWorkspace.prefixDispatchIndirectBuffer, 0);
    pass.end();
    const claimDescriptor = timestampProfiler?.beginComputePassDescriptor
      ? timestampProfiler.beginComputePassDescriptor('reactionProductCarrierClaim', {
          ...(timestampMetadata || {}),
          productEventCapacityRows: eventCapacityRows,
          productEventExactCountAuthority: 'gpu-prefix-metadata-word-6',
          particleCount
        })
      : { label: `${label}-claim` };
    pass = commandEncoder.beginComputePass(claimDescriptor);
    pass.setPipeline(placementClaimInfo.pipeline);
    pass.setBindGroup(0, placementClaimBindGroup);
    pass.dispatchWorkgroupsIndirect(placementWorkspace.prefixDispatchIndirectBuffer, 0);
    pass.end();
    const placementDescriptor = timestampProfiler?.beginComputePassDescriptor
      ? timestampProfiler.beginComputePassDescriptor('reactionProductCarrierPlacement', {
          ...(timestampMetadata || {}),
          productEventCapacityRows: eventCapacityRows,
          productEventExactCountAuthority: 'gpu-prefix-metadata-word-6'
        })
      : { label: `${label}-place` };
    pass = commandEncoder.beginComputePass(placementDescriptor);
    pass.setPipeline(placementInfo.pipeline);
    pass.setBindGroup(0, placementBindGroup);
    pass.dispatchWorkgroupsIndirect(placementWorkspace.prefixDispatchIndirectBuffer, 0);
    pass.end();
  }

  let scratchDestroyed = false;
  let eventBufferDestroyed = false;
  const destroyProductEventBuffer = () => {
    if (eventBufferDestroyed || !placementWorkspaceOwned) return false;
    eventBufferDestroyed = true;
    admissionStage.cleanupSubmittedWork({ destroyWorkspace: true });
    return placementWorkspace.destroyed === true;
  };
  const productTermCount = nonNegativeInteger(
    reactionTable.productTermCount ?? 0,
    'productTermCount'
  );
  const denseCandidateRowsBigInt = BigInt(particleCount) * BigInt(productTermCount);
  const denseCandidateRows = denseCandidateRowsBigInt <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(denseCandidateRowsBigInt)
    : null;
  const denseCandidateByteLengthBigInt = denseCandidateRowsBigInt
    * BigInt(SPH_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT);
  const productEventBufferOwnership = placementWorkspaceOwned
    ? 'stage-owned-workspace'
    : 'caller-owned-borrowed-workspace';
  const residentProductMass = tagResidentProductMassDevice({
    schema: RESIDENT_PRODUCT_MASS_SCHEMA,
    status: 'resident-product-mass-buffer-retained',
    source: 'caller-encoder-reaction-product-event-emission',
    productEventSchema: ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
    productEventBuffer,
    productEventBufferRetained: true,
    productEventBufferOwnership,
    productEventBufferByteLength: eventByteLength,
    productEventBufferCapacityRows: eventCapacityRows,
    productEventRowCount: eventCapacityRows,
    productEventRowCountExact: null,
    productEventRowCountAuthority: 'gpu-prefix-metadata-word-6-before-carrier-placement',
    productEventExactLiveByteLength: null,
    productEventExactLiveByteLengthAuthority:
      'gpu-prefix-metadata-word-6-times-128-bytes-per-event',
    productEventPrefixMetadataBuffer: placementWorkspace.prefixMetadataBuffer,
    productEventPrefixMetadataExactCountWord: 6,
    productEventDispatchIndirectBuffer: placementWorkspace.prefixDispatchIndirectBuffer,
    productEventActiveEventCount: null,
    productEventStrideFloats: SPH_REACTION_PRODUCT_EVENT_FLOATS,
    productEventStrideBytes: SPH_REACTION_PRODUCT_EVENT_FLOATS * 4,
    productEventGenerationCount: 1,
    consumeMassPolicy: 'unplaced-product-mass-only',
    visibleMassAlreadyInParticleBuffers: true,
    eosCouplingStatus: 'resident-product-mass-awaiting-gpu-arena-append',
    carrierPlacementStatus: placeProductEvents
      ? 'reaction-product-carrier-placement-encoded'
      : 'reaction-product-carrier-placement-disabled',
    normalHotLoopReadbackFree: true,
    mapPerformed: false,
    readbackPerformed: false,
    destroyResidentProductMassBuffers: destroyProductEventBuffer,
    destroyProductEventBuffer,
    scientificValidation: false,
    chemistryValidation: false,
    fullPhysicsValidation: false
  }, device);

  return {
    schema: ULG_SPH_REACTION_PRODUCT_EVENT_ENCODER_STAGE_SCHEMA,
    status: placeProductEvents
      ? 'reaction-product-events-and-carriers-encoded'
      : 'reaction-product-events-encoded',
    commandEncoderOwnership: 'caller',
    submissionOwnership: 'caller',
    queueSubmitPerformed: false,
    mapPerformed: false,
    readbackPerformed: false,
    normalHotLoopReadbackFree: true,
    fullReadbackPerformed: false,
    productEventBuffer,
    productEventBufferOwnership,
    productEventBufferByteLength: eventByteLength,
    productEventBufferCapacityRows: eventCapacityRows,
    productEventImmutableCapacityRows: immutableCapacityRows,
    productEventRowCount: eventCapacityRows,
    productEventRowCountExact: null,
    productEventExactCountAuthority: 'gpu-prefix-metadata-word-6',
    productEventExactLiveByteLength: null,
    productEventExactLiveByteLengthAuthority:
      'gpu-prefix-metadata-word-6-times-128-bytes-per-event',
    productEventPrefixMetadataBuffer: placementWorkspace.prefixMetadataBuffer,
    productEventPrefixMetadataByteLength: SPH_REACTION_PRODUCT_EVENT_PREFIX_METADATA_BYTES,
    productEventPrefixMetadataExactCountWord: 6,
    productEventDispatchIndirectBuffer: placementWorkspace.prefixDispatchIndirectBuffer,
    productEventDispatchIndirectByteLength: SPH_REACTION_PRODUCT_EVENT_PREFIX_INDIRECT_BYTES,
    reactionOutcomeBuffer: placementWorkspace.reactionOutcomeBuffer,
    reactionOutcomeBufferByteLength: placementWorkspace.reactionOutcomeBufferByteLength,
    reactionOutcomeStrideWords: placementWorkspace.reactionOutcomeStrideWords,
    reactionOutcomeAuthority:
      'reaction-resolve-canonical-pair-owner-with-generation-ready-stamp',
    reactionChemistryEvaluationPolicy:
      'resolve-publishes-admitted-outcome-count-and-emit-consume-without-extent-recompute',
    productEventPotentialCountAuthority: 'gpu-prefix-metadata-word-5',
    productEventOverflowFlagsAuthority: 'gpu-prefix-metadata-word-7',
    denseCandidateRowCountAvoided: denseCandidateRows,
    denseCandidateRowCountAvoidedExact: denseCandidateRowsBigInt.toString(),
    denseCandidateByteLengthAvoidedExact: denseCandidateByteLengthBigInt.toString(),
    productEventStrideFloats: SPH_REACTION_PRODUCT_EVENT_FLOATS,
    productEventStrideBytes: SPH_REACTION_PRODUCT_EVENT_FLOATS * 4,
    productEventActiveCountAuthority:
      'gpu-exact-emitted-prefix-then-arena-status-compaction-after-carrier-placement',
    downstreamWorkPolicy: 'gpu-authored-exact-prefix-dispatch-indirect',
    carrierPlacementEncoded: placeProductEvents,
    carrierPlacementCandidateSearchEncoded: placeProductEvents,
    carrierPlacementCandidateSelection:
      'resident-csr-or-bounded-probe-target-with-stable-lowest-event-atomic-ownership',
    carrierPlacementSearchMode: residentPlacementNeighborhoodBuffer
      ? 'resident-neighborhood-packed-csr-plus-bounded-spare-probe'
      : 'bounded-deterministic-compatibility-probe',
    carrierPlacementApplyOrdering: 'parallel-disjoint-target-single-writer',
    carrierPlacementConflictPolicy:
      'lowest-event-index-wins-target-conflicts-losers-remain-live-in-event-ledger',
    carrierPlacementProbeLimit:
      SPH_GPU_REACTION_PRODUCT_EVENT_PLACEMENT_SPARE_PROBE_LIMIT,
    productEventPlacementWorkspace: placementWorkspace,
    productEventParamsSlotIndex: paramsSlot.slotIndex,
    productEventParamsByteOffset: paramsSlot.byteOffset,
    productEventParamsByteStride: placementWorkspace.paramsSlotStrideBytes,
    productEventBindGroupCacheHits: Object.freeze({
      admission: admissionStage.admissionBindGroupCacheHit === true,
      countLive: countLiveBindGroupCache.cacheHit,
      finalizePrefix: finalizePrefixBindGroupCache.cacheHit,
      emit: emitBindGroupCache.cacheHit,
      finalizeEmission: finalizeEmissionBindGroupCache.cacheHit,
      carrierSearch: carrierSearchBindGroupCache?.cacheHit ?? null,
      carrierClaim: placementClaimBindGroupCache?.cacheHit ?? null,
      carrierPlacement: placementBindGroupCache?.cacheHit ?? null
    }),
    productEventBindGroupCacheEvidence: placementWorkspace.bindGroupCacheEvidence(),
    productEventPlacementWorkspaceBorrowed: Boolean(
      placeProductEvents && !placementWorkspaceOwned
    ),
    productEventPlacementWorkspaceOwned: placementWorkspaceOwned,
    productEventPlacementCandidateBufferByteLength:
      placementWorkspace?.candidateBufferByteLength ?? 0,
    productEventWorkspaceTotalByteLength: placementWorkspace?.totalByteLength ?? 0,
    productEventWorkspaceReusePolicy:
      'caller-reusable-in-command-order-after-arena-append-copy-before-next-emission',
    carrierPlacementPolicy: placeProductEvents
      ? 'same-encoder-conserving-merge-or-spare-carrier-placement-before-arena-compaction'
      : 'unplaced-event-carrier-only',
    residentProductMass,
    cleanupSubmittedWork({ destroyProductEvents = false } = {}) {
      if (!scratchDestroyed) {
        scratchDestroyed = true;
      }
      admissionStage.cleanupSubmittedWork({ destroyWorkspace: false });
      if (destroyProductEvents) destroyProductEventBuffer();
    }
  };
}
