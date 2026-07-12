import {
  createWebGpuStableRadixScanUnique
} from '../webgpuRadixScanUnique.js';
import { deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import {
  createWebGpuTimestampProfiler,
  summarizeWebGpuBufferAllocations
} from '../webgpuTimestampProfiler.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';
import {
  SPH_RESIDENT_PRODUCT_EVENT_ARENA_INDIRECT_BYTES,
  SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA,
  SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA_BYTES,
  ULG_SPH_RESIDENT_PRODUCT_EVENT_ARENA_SCHEMA
} from './residentProductEventArenaGpu.js';

export const ULG_SPH_SPATIAL_GAS_CELL_EOS_GPU_LANE_SCHEMA =
  'peercompute.ulg.sph-spatial-gas-cell-eos-gpu-lane.v0';
export const ULG_SPH_SPATIAL_GAS_CELL_EOS_GPU_RESULT_SCHEMA =
  'peercompute.ulg.sph-spatial-gas-cell-eos-gpu-result.v0';
export const ULG_SPH_SPATIAL_GAS_CELL_EOS_GPU_SOURCE_SCHEMA =
  'peercompute.ulg.sph-spatial-gas-cell-eos-gpu-source.v0';
export const ULG_SPH_SPATIAL_GAS_CELL_EOS_GPU_EVIDENCE_SCHEMA =
  'peercompute.ulg.sph-spatial-gas-cell-eos-gpu-evidence.v0';
export const ULG_SPH_SPATIAL_GAS_CELL_EOS_EXACT_PREFIX_AUTHORITY_SCHEMA =
  'peercompute.ulg.sph-spatial-gas-cell-eos-exact-prefix-authority.v0';
export const ULG_SPH_SPATIAL_GAS_CELL_EOS_GPU_LANE_CAPACITY_PLAN_SCHEMA =
  'peercompute.ulg.sph-spatial-gas-cell-eos-gpu-lane-capacity-plan.v0';
export const ULG_PRESSURE_INTERFACE_GPU_GAS_CELL_FIELD_SOURCE_SCHEMA =
  'peercompute.ulg.pressure-interface-gpu-gas-cell-field-source.v0';

export const SPH_SPATIAL_GAS_COMPACT_ROW_FLOATS = 12;
export const SPH_REACTION_PRODUCT_EVENT_ROW_FLOATS = 32;
export const SPH_GAS_PRESSURE_CELL_ROW_FLOATS = 12;
export const SPH_GAS_CELL_EOS_METADATA_WORDS = 24;
export const SPH_GAS_CELL_EOS_METADATA_BYTES =
  SPH_GAS_CELL_EOS_METADATA_WORDS * Uint32Array.BYTES_PER_ELEMENT;
export const SPH_GAS_CELL_EOS_DIRECT_SOURCE_LIMIT = 256;
export const SPH_GAS_CELL_EOS_EXACT_LINEAR_RADIX_MAX_SOURCE_CAPACITY = 65_536;
export const SPH_GAS_CELL_EOS_CAPACITY_CLASS_FLOOR = 256;
export const SPH_GAS_CELL_EOS_SOURCE_CAPACITY_CLASS_FLOOR = 65_536;

export const SPH_GAS_CELL_EOS_METADATA = Object.freeze({
  magic: 0,
  version: 1,
  generation: 2,
  sourceKind: 3,
  sourceRowCount: 4,
  sourceStrideFloats: 5,
  outputCapacity: 6,
  uniqueCellCount: 7,
  rawActiveCellCount: 8,
  admittedActiveCellCount: 9,
  invalidSourceRowCount: 10,
  overflowCount: 11,
  status: 12,
  gridX: 13,
  gridY: 14,
  gridZ: 15,
  gridCellCount: 16,
  laneHashLow: 17,
  laneHashHigh: 18,
  sourceEpoch: 19,
  sourceGeneration: 20,
  reductionDispatchX: 21,
  evidenceFlags: 22,
  reserved: 23
});

export const SPH_GAS_CELL_EOS_GPU_STATUS = Object.freeze({
  pending: 0,
  ready: 1,
  empty: 2,
  blocked: 3
});
export const SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE = Object.freeze({
  keyBuild: 'sphGasCellEosKeyBuild',
  directGroup: 'sphGasCellEosDirectGroup',
  exactPrepare: 'sphGasCellEosExactPrepare',
  exactGroup: 'sphGasCellEosExactGroup',
  dispatchPrepare: 'sphGasCellEosDispatchPrepare',
  cellReduce: 'sphGasCellEosCellReduce',
  finalize: 'sphGasCellEosFinalize',
  gradient: 'sphGasCellEosGradient'
});

const SOURCE_KIND = Object.freeze({
  productEvent: 1,
  compactSpatialGas: 2
});
const SOURCE_KIND_NAME = Object.freeze({
  [SOURCE_KIND.productEvent]: 'resident-product-event-rows',
  [SOURCE_KIND.compactSpatialGas]: 'retained-compact-spatial-gas-rows'
});
const LANE_LEASE_IDENTITY_SCHEMA = 'peercompute.compute.gpu-resident-lane-lease-identity.v0';
const LANE_IDENTITY_HASH_DOMAIN = 'peercompute.ulg.sph-gas-cell-eos-lane-identity-hash.v1';
export const SPH_GAS_CELL_EOS_MAGIC = 0x554c4747;
export const SPH_GAS_CELL_EOS_VERSION = 1;
const GAS_CONSTANT_J_PER_MOL_K = 8.314462618;
const DEFAULT_FALLBACK_TEMPERATURE_K = 293.15;
const DEFAULT_MIN_VOLUME_M3 = 1e-12;
const WORKGROUP_SIZE = 64;
const OUTPUT_SLOT_COUNT = 2;
const DEFAULT_PARAMS_SLOT_COUNT = 2;
const MAX_PARAMS_SLOT_COUNT = 64;
const PARAMS_BYTE_LENGTH = 128;
const MIN_UNIFORM_BUFFER_OFFSET_ALIGNMENT = 256;
const MAX_CACHED_LANES_PER_DEVICE = 4;
const INDIRECT_DISPATCH_BYTES = 3 * Uint32Array.BYTES_PER_ELEMENT;
const RESIDENT_PRODUCT_EVENT_ARENA_MAGIC = 0x554c4750;
const RESIDENT_PRODUCT_EVENT_ARENA_VERSION = 1;
const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const FLOAT32_BYTES = Float32Array.BYTES_PER_ELEMENT;

const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const CACHED_LANES_BY_DEVICE = new WeakMap();

function positiveInteger(value, label, { max = 0xffffffff } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new RangeError(`${label} must be an integer in [1, ${max}]`);
  }
  return number;
}

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

export function sphGasCellEosGeometricCapacityClass(
  requiredCapacity,
  { floor = SPH_GAS_CELL_EOS_CAPACITY_CLASS_FLOOR } = {}
) {
  const required = positiveInteger(requiredCapacity, 'requiredCapacity');
  let capacity = positiveInteger(floor, 'floor');
  while (capacity < required) {
    if (capacity > 0x7fff_ffff) return required;
    capacity *= 2;
  }
  return capacity;
}

export function sphGasCellEosExactOutputCapacityBound(sourceCapacity, gridCellCount) {
  const source = positiveInteger(sourceCapacity, 'sourceCapacity');
  const grid = positiveInteger(gridCellCount, 'gridCellCount', { max: 0xffff_fffe });
  return Math.min(source, grid + 1);
}

export function createSphSpatialGasCellEosGpuLaneCapacityPlan({
  sourceCapacity,
  maxGridCellCount,
  minimumGasCellCapacity = 0
} = {}) {
  const requestedSourceCapacity = positiveInteger(sourceCapacity, 'sourceCapacity');
  const rawMaxGridCellCount = positiveInteger(
    maxGridCellCount,
    'maxGridCellCount',
    { max: 0xffff_fffe }
  );
  const configuredMinimum = Number(minimumGasCellCapacity ?? 0);
  if (!Number.isInteger(configuredMinimum) || configuredMinimum < 0 || configuredMinimum > 0xffff_ffff) {
    throw new RangeError('minimumGasCellCapacity must be an integer in [0, 4294967295]');
  }
  const sourceCapacityClass = sphGasCellEosGeometricCapacityClass(requestedSourceCapacity, {
    floor: SPH_GAS_CELL_EOS_SOURCE_CAPACITY_CLASS_FLOOR
  });
  if (sourceCapacityClass > 0xffff_ffff) {
    throw new RangeError('sourceCapacityClass exceeds the u32 physical lane bound');
  }
  const requiredGasCellCapacity = sphGasCellEosExactOutputCapacityBound(
    sourceCapacityClass,
    rawMaxGridCellCount
  );
  const gasCellCapacity = Math.max(requiredGasCellCapacity, configuredMinimum);
  const gasCellCapacityClass = sphGasCellEosGeometricCapacityClass(gasCellCapacity);
  const maxGridCellCountClass = sphGasCellEosGeometricCapacityClass(rawMaxGridCellCount);
  if (gasCellCapacityClass > 0xffff_ffff || maxGridCellCountClass > 0xffff_ffff) {
    throw new RangeError('gas-cell output or grid capacity class exceeds the u32 physical lane bound');
  }
  return Object.freeze({
    schema: ULG_SPH_SPATIAL_GAS_CELL_EOS_GPU_LANE_CAPACITY_PLAN_SCHEMA,
    status: 'sph-spatial-gas-cell-eos-gpu-lane-capacity-plan-ready',
    policy: 'stable-source-class-and-raw-grid-exact-output-bound',
    requestedSourceCapacity,
    sourceCapacityClass,
    rawMaxGridCellCount,
    maxGridCellCountClass,
    requiredGasCellCapacity,
    configuredMinimumGasCellCapacity: configuredMinimum,
    gasCellCapacity,
    gasCellCapacityClass
  });
}

function finitePositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeVector3(value, fallback, label) {
  const source = Array.isArray(value) || ArrayBuffer.isView(value) ? value : fallback;
  const result = [0, 1, 2].map((axis) => Number(source?.[axis]));
  if (result.some((entry) => !Number.isFinite(entry) || entry <= 0)) {
    throw new RangeError(`${label} must contain three finite positive values`);
  }
  return result;
}

function normalizeGridDims(value, fallback = [1, 1, 1]) {
  const source = Array.isArray(value) || ArrayBuffer.isView(value) ? value : fallback;
  const result = [0, 1, 2].map((axis) => positiveInteger(source?.[axis] ?? fallback[axis], `gridDims[${axis}]`));
  const cellCount = result.reduce((product, entry) => product * entry, 1);
  if (!Number.isSafeInteger(cellCount) || cellCount > 0xfffffffe) {
    throw new RangeError('gridDims product must fit the valid u32 gas-cell key range');
  }
  return { gridDims: result, gridCellCount: cellCount };
}

function dispatchShapeForInvocationCount(invocationCount, maxWorkgroupsPerDimension) {
  const groupCount = Math.max(1, Math.ceil(invocationCount / WORKGROUP_SIZE));
  const x = Math.min(groupCount, maxWorkgroupsPerDimension);
  const y = Math.ceil(groupCount / x);
  if (y > maxWorkgroupsPerDimension) {
    throw new RangeError(
      `gas-cell source dispatch ${groupCount} exceeds ${maxWorkgroupsPerDimension}x${maxWorkgroupsPerDimension}`
    );
  }
  return [x, y, 1];
}

function dispatchShapeForWorkgroupCount(workgroupCount, maxWorkgroupsPerDimension) {
  const count = Math.max(1, positiveInteger(workgroupCount, 'workgroupCount'));
  const x = Math.min(count, maxWorkgroupsPerDimension);
  const y = Math.ceil(count / x);
  if (y > maxWorkgroupsPerDimension) {
    throw new RangeError(
      `gas-cell workgroup dispatch ${count} exceeds ${maxWorkgroupsPerDimension}x${maxWorkgroupsPerDimension}`
    );
  }
  return [x, y, 1];
}

function alignedBytes(byteLength, alignment = 4) {
  return Math.max(4, Math.ceil(byteLength / alignment) * alignment);
}

function assertDevice(device) {
  if (!device?.createBuffer || !device?.createShaderModule || !device?.createComputePipeline
    || !device?.createBindGroup || !device?.createCommandEncoder
    || !device?.queue?.writeBuffer || !device?.queue?.submit) {
    throw new TypeError('SPH spatial gas-cell EOS requires a WebGPU-like device');
  }
  const invocations = Number(device.limits?.maxComputeInvocationsPerWorkgroup ?? WORKGROUP_SIZE);
  if (invocations < WORKGROUP_SIZE) {
    throw new RangeError(`SPH gas-cell EOS requires ${WORKGROUP_SIZE} compute invocations per workgroup`);
  }
  const storageBindings = Number(device.limits?.maxStorageBuffersPerShaderStage ?? 8);
  if (storageBindings < 8) {
    throw new RangeError('SPH gas-cell EOS requires eight storage-buffer bindings');
  }
}

function assertBufferSize(device, byteLength, label) {
  const maxBufferSize = Number(device.limits?.maxBufferSize ?? Number.POSITIVE_INFINITY);
  const maxStorageSize = Number(device.limits?.maxStorageBufferBindingSize ?? Number.POSITIVE_INFINITY);
  if (byteLength > maxBufferSize) {
    throw new RangeError(`${label} byte length ${byteLength} exceeds maxBufferSize ${maxBufferSize}`);
  }
  if (byteLength > maxStorageSize) {
    throw new RangeError(`${label} byte length ${byteLength} exceeds maxStorageBufferBindingSize ${maxStorageSize}`);
  }
}

function createStorageBuffer(device, label, byteLength, extraUsage = 0) {
  const size = alignedBytes(byteLength);
  assertBufferSize(device, size, label);
  return tagWebGpuBufferDevice(device.createBuffer({
    label,
    size,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
      | GPU_BUFFER_USAGE.COPY_DST | extraUsage
  }), device);
}

function timestampPassDescriptor(timestampProfiler, label, metadata = {}) {
  return timestampProfiler?.beginComputePassDescriptor
    ? timestampProfiler.beginComputePassDescriptor(label, metadata)
    : { label };
}

function hashString32(value, seed) {
  let hash = seed >>> 0;
  const text = String(value ?? '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function laneIdentityHash(identity) {
  const fields = [
    ['leaseId', identity?.leaseId],
    ['laneId', identity?.laneId],
    ['stateKey', identity?.stateKey],
    ['sourceFamily', identity?.sourceFamily]
  ];
  const frame = (value) => {
    const text = String(value ?? '');
    return `${text.length}:${text}`;
  };
  const value = frame(LANE_IDENTITY_HASH_DOMAIN)
    + fields.map(([name, fieldValue]) => frame(name) + frame(fieldValue)).join('');
  return [hashString32(value, 0x811c9dc5), hashString32(value, 0x9e3779b9)];
}

function validateLaneIdentity(identity, {
  required = true,
  laneId = null,
  stateKey = null,
  sourceFamily = null
} = {}) {
  if (!identity) {
    return required
      ? { ready: false, reason: 'authoritative-gpu-resident-lane-lease-identity-required' }
      : { ready: true, identity: null, laneHash: [0, 0] };
  }
  if (identity.schema !== LANE_LEASE_IDENTITY_SCHEMA || identity.authoritative !== true) {
    return { ready: false, reason: 'authoritative-gpu-resident-lane-lease-identity-invalid' };
  }
  for (const field of ['leaseId', 'laneId', 'stateKey', 'sourceFamily']) {
    if (typeof identity[field] !== 'string' || identity[field].trim() === '') {
      return { ready: false, reason: `gpu-resident-lane-lease-${field}-required` };
    }
  }
  if (laneId && identity.laneId !== laneId) return { ready: false, reason: 'gpu-resident-lane-id-mismatch' };
  if (stateKey && identity.stateKey !== stateKey) return { ready: false, reason: 'gpu-resident-state-key-mismatch' };
  if (sourceFamily && identity.sourceFamily !== sourceFamily) {
    return { ready: false, reason: 'gpu-resident-source-family-mismatch' };
  }
  return { ready: true, identity, laneHash: laneIdentityHash(identity) };
}

function sourceKindFrom(value) {
  const name = String(value || '').trim().toLowerCase();
  if (['product-event', 'product-events', 'resident-product-event-rows'].includes(name)) {
    return SOURCE_KIND.productEvent;
  }
  if (['compact', 'compact-spatial-gas', 'retained-compact-spatial-gas-rows'].includes(name)) {
    return SOURCE_KIND.compactSpatialGas;
  }
  return 0;
}

function sourceStrideForKind(kind) {
  return kind === SOURCE_KIND.productEvent
    ? SPH_REACTION_PRODUCT_EVENT_ROW_FLOATS
    : (kind === SOURCE_KIND.compactSpatialGas ? SPH_SPATIAL_GAS_COMPACT_ROW_FLOATS : 0);
}

function resolveProductEventExactPrefixAuthority({ supplied, residentProductMass, expectedStride }) {
  const arena = supplied.productEventArena
    || residentProductMass?.productEventArena
    || null;
  const metadataBuffer = supplied.productEventMetadataBuffer
    || supplied.exactPrefixMetadataBuffer
    || residentProductMass?.productEventMetadataBuffer
    || arena?.metadataBuffer
    || null;
  const dispatchIndirectBuffer = supplied.productEventDispatchIndirectBuffer
    || supplied.exactPrefixDispatchIndirectBuffer
    || residentProductMass?.productEventDispatchIndirectBuffer
    || arena?.dispatchIndirectBuffer
    || null;
  const requested = Boolean(arena || metadataBuffer || dispatchIndirectBuffer);
  if (!requested) return { requested: false, ready: false, blocker: null, authority: null };
  if (arena && arena.schema !== ULG_SPH_RESIDENT_PRODUCT_EVENT_ARENA_SCHEMA) {
    return {
      requested: true,
      ready: false,
      blocker: 'resident-product-event-arena-schema-mismatch',
      authority: null
    };
  }
  if (!metadataBuffer || !dispatchIndirectBuffer) {
    return {
      requested: true,
      ready: false,
      blocker: 'resident-product-event-exact-prefix-authority-incomplete',
      authority: null
    };
  }
  const capacityRows = nonNegativeInteger(
    supplied.productEventArenaCapacityRows
      ?? supplied.exactPrefixCapacityRows
      ?? arena?.capacityRows
      ?? residentProductMass?.productEventArenaCapacityDescriptor?.reservedRowCapacity
      ?? residentProductMass?.productEventRowCapacity,
    0
  );
  const generationId = nonNegativeInteger(
    supplied.productEventArenaGeneration
      ?? supplied.exactPrefixGeneration
      ?? arena?.generationId
      ?? residentProductMass?.productEventArenaGeneration,
    0
  );
  const strideFloats = nonNegativeInteger(
    supplied.productEventArenaStrideFloats
      ?? supplied.exactPrefixStrideFloats
      ?? arena?.strideFloats
      ?? residentProductMass?.productEventStrideFloats,
    expectedStride
  );
  const blocker = capacityRows < 1
    ? 'resident-product-event-exact-prefix-capacity-required'
    : (generationId < 1
        ? 'resident-product-event-exact-prefix-generation-required'
        : (strideFloats !== expectedStride
            ? 'resident-product-event-exact-prefix-stride-mismatch'
            : (Number(metadataBuffer.size ?? 0) < SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA_BYTES
                ? 'resident-product-event-exact-prefix-metadata-buffer-too-small'
                : (Number(dispatchIndirectBuffer.size ?? 0)
                    < SPH_RESIDENT_PRODUCT_EVENT_ARENA_INDIRECT_BYTES
                    ? 'resident-product-event-exact-prefix-dispatch-buffer-too-small'
                    : null))));
  return {
    requested: true,
    ready: blocker == null,
    blocker,
    authority: blocker ? null : {
      schema: ULG_SPH_SPATIAL_GAS_CELL_EOS_EXACT_PREFIX_AUTHORITY_SCHEMA,
      status: 'resident-product-event-exact-prefix-authority-ready',
      metadataBuffer,
      dispatchIndirectBuffer,
      capacityRows,
      generationId,
      strideFloats,
      metadataLayout: { ...SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA },
      activeRowCountMetadataWord: SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.activeRowCount,
      occupiedRowCountMetadataWord: SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.occupiedRowCount,
      overflowFlagsMetadataWord: SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.overflowFlags,
      exactCount: null,
      exactCountAuthority: 'gpu-authored-resident-product-event-arena-metadata-word-3',
      dispatchAuthority: 'gpu-authored-resident-product-event-arena-indirect-dispatch',
      sameDeviceRequired: true,
      mapAsyncCalled: false,
      readbackByteLength: 0
    }
  };
}

export function resolveSphSpatialGasCellEosGpuSource({
  source = null,
  residentProductMass = null,
  productEventBuffer = null,
  productEventRowCount = null,
  productEventStrideFloats = null,
  productEventBufferRetained = null,
  compactSpatialGasRowsBuffer = null,
  compactSpatialGasRowCount = null,
  compactSpatialGasRowStrideFloats = null,
  compactSpatialGasRowsBufferRetained = null,
  sourceEpoch = null,
  sourceGeneration = null,
  sourceTaskId = null
} = {}) {
  const supplied = source && typeof source === 'object' ? source : {};
  const compactBuffer = supplied.compactSpatialGasRowsBuffer
    || supplied.spatialGasLedgerRowsBuffer
    || compactSpatialGasRowsBuffer;
  const productBuffer = supplied.productEventBuffer
    || residentProductMass?.productEventBuffer
    || productEventBuffer;
  const explicitKind = sourceKindFrom(supplied.sourceKind || supplied.kind);
  const kind = explicitKind || (compactBuffer ? SOURCE_KIND.compactSpatialGas : (productBuffer ? SOURCE_KIND.productEvent : 0));
  const buffer = kind === SOURCE_KIND.compactSpatialGas ? compactBuffer : productBuffer;
  const rowCount = kind === SOURCE_KIND.compactSpatialGas
    ? nonNegativeInteger(
        supplied.compactSpatialGasRowCount
          ?? supplied.spatialGasLedgerRowCount
          ?? compactSpatialGasRowCount,
        0
      )
    : nonNegativeInteger(
        supplied.productEventRowCount
          ?? residentProductMass?.productEventRowCount
          ?? productEventRowCount,
        0
      );
  const expectedStride = sourceStrideForKind(kind);
  const rowStrideFloats = kind === SOURCE_KIND.compactSpatialGas
    ? nonNegativeInteger(
        supplied.compactSpatialGasRowStrideFloats
          ?? supplied.spatialGasLedgerRowStrideFloats
          ?? compactSpatialGasRowStrideFloats,
        expectedStride
      )
    : nonNegativeInteger(
        supplied.productEventStrideFloats
          ?? residentProductMass?.productEventStrideFloats
          ?? productEventStrideFloats,
        expectedStride
      );
  const retained = kind === SOURCE_KIND.compactSpatialGas
    ? Boolean(
        supplied.compactSpatialGasRowsBufferRetained
          ?? supplied.spatialGasLedgerRowsBufferRetained
          ?? compactSpatialGasRowsBufferRetained
      )
    : Boolean(
        supplied.productEventBufferRetained
          ?? residentProductMass?.productEventBufferRetained
          ?? productEventBufferRetained
      );
  const exactPrefix = kind === SOURCE_KIND.productEvent
    ? resolveProductEventExactPrefixAuthority({ supplied, residentProductMass, expectedStride })
    : { requested: false, ready: false, blocker: null, authority: null };
  const byteLength = rowCount * rowStrideFloats * FLOAT32_BYTES;
  const blocker = !kind
    ? 'retained-product-event-or-compact-spatial-gas-source-required'
    : (!buffer
        ? 'retained-spatial-gas-source-buffer-required'
        : (!retained
            ? 'retained-spatial-gas-source-buffer-evidence-required'
            : (rowCount < 1
                ? 'spatial-gas-source-row-count-required'
                : (rowStrideFloats !== expectedStride
                    ? 'spatial-gas-source-row-stride-mismatch'
                    : (Number(buffer.size ?? byteLength) < byteLength
                        ? 'spatial-gas-source-buffer-capacity-insufficient'
                        : exactPrefix.blocker)))));
  return {
    schema: ULG_SPH_SPATIAL_GAS_CELL_EOS_GPU_SOURCE_SCHEMA,
    status: blocker ? 'sph-spatial-gas-cell-eos-gpu-source-blocked' : 'sph-spatial-gas-cell-eos-gpu-source-ready',
    ready: blocker == null,
    blocker,
    sourceKindId: kind,
    sourceKind: SOURCE_KIND_NAME[kind] || null,
    sourceBuffer: buffer || null,
    sourceRowCount: rowCount,
    sourceRowStrideFloats: rowStrideFloats,
    sourceRowByteLength: byteLength,
    sourceRetained: retained,
    sourceEpoch: nonNegativeInteger(supplied.sourceEpoch ?? sourceEpoch, 0),
    sourceGeneration: nonNegativeInteger(supplied.sourceGeneration ?? sourceGeneration, 0),
    sourceTaskId: supplied.sourceTaskId || sourceTaskId || null,
    sourceHandle: kind === SOURCE_KIND.productEvent ? residentProductMass : (supplied.sourceHandle || source || null),
    exactPrefixAuthorityRequested: exactPrefix.requested,
    exactPrefixAuthorityReady: exactPrefix.ready,
    exactPrefixAuthority: exactPrefix.authority,
    exactSourceRowCount: null,
    exactSourceRowCountAuthority: exactPrefix.authority?.exactCountAuthority ?? null,
    retainedBufferRefs: kind === SOURCE_KIND.productEvent
      ? [...new Set([
          ...(supplied.retainedBufferRefs || []),
          ...(residentProductMass?.retainedProductBufferRefs || []),
          'resident-product-mass-buffer'
        ])]
      : [...new Set([
          ...(supplied.retainedBufferRefs || []),
          ...(supplied.retainedSpatialGasLedgerBufferRefs || []),
          'resident-spatial-gas-species-ledger-buffer'
        ])],
    normalHotLoopReadbackFree: true,
    cpuRowsPresent: false
  };
}

export function createSphSpatialGasCellEosGpuPlan({
  sourceRowCount,
  sourceRowStrideFloats,
  sourceKind,
  sourceCapacity,
  gasCellCapacity,
  maxGridCellCount,
  gridDims,
  boxDimsM,
  maxComputeWorkgroupsPerDimension = 65535
} = {}) {
  const kind = sourceKindFrom(sourceKind) || Number(sourceKind);
  if (![SOURCE_KIND.productEvent, SOURCE_KIND.compactSpatialGas].includes(kind)) {
    throw new RangeError('sourceKind must identify retained product-event or compact spatial-gas rows');
  }
  const rowCount = positiveInteger(sourceRowCount, 'sourceRowCount');
  const capacity = positiveInteger(sourceCapacity ?? rowCount, 'sourceCapacity');
  if (rowCount > capacity) throw new RangeError('sourceRowCount exceeds sourceCapacity');
  const expectedStride = sourceStrideForKind(kind);
  const stride = positiveInteger(sourceRowStrideFloats ?? expectedStride, 'sourceRowStrideFloats');
  if (stride !== expectedStride) throw new RangeError(`source row stride must be ${expectedStride} floats`);
  const normalizedGrid = normalizeGridDims(gridDims);
  const gridCapacity = positiveInteger(maxGridCellCount ?? normalizedGrid.gridCellCount, 'maxGridCellCount');
  if (normalizedGrid.gridCellCount > gridCapacity) throw new RangeError('gridDims exceed maxGridCellCount');
  const requiredGasCellCapacity = sphGasCellEosExactOutputCapacityBound(
    rowCount,
    normalizedGrid.gridCellCount
  );
  const outputCapacity = positiveInteger(gasCellCapacity ?? requiredGasCellCapacity, 'gasCellCapacity');
  if (outputCapacity < requiredGasCellCapacity) {
    throw new RangeError(
      `gasCellCapacity ${outputCapacity} cannot fail-close all ${requiredGasCellCapacity} possible valid-plus-sentinel cells`
    );
  }
  const maxDispatch = positiveInteger(maxComputeWorkgroupsPerDimension, 'maxComputeWorkgroupsPerDimension');
  const sourceDispatch = dispatchShapeForInvocationCount(rowCount, maxDispatch);
  const gridGroupDispatch = dispatchShapeForWorkgroupCount(
    normalizedGrid.gridCellCount,
    maxDispatch
  );
  const compactDispatch = dispatchShapeForInvocationCount(
    normalizedGrid.gridCellCount,
    maxDispatch
  );
  const dims = normalizeVector3(boxDimsM, [1, 1, 1], 'boxDimsM');
  return Object.freeze({
    schema: ULG_SPH_SPATIAL_GAS_CELL_EOS_GPU_LANE_SCHEMA,
    status: 'sph-spatial-gas-cell-eos-gpu-plan-ready',
    sourceKindId: kind,
    sourceKind: SOURCE_KIND_NAME[kind],
    sourceRowCount: rowCount,
    sourceRowStrideFloats: stride,
    sourceRowByteLength: rowCount * stride * FLOAT32_BYTES,
    sourceCapacity: capacity,
    gasCellCapacity: outputCapacity,
    requiredGasCellCapacity,
    gasPressureCellRowStrideFloats: SPH_GAS_PRESSURE_CELL_ROW_FLOATS,
    gasPressureCellRowsBufferByteLength: outputCapacity * SPH_GAS_PRESSURE_CELL_ROW_FLOATS * FLOAT32_BYTES,
    gridDims: [...normalizedGrid.gridDims],
    gridCellCount: normalizedGrid.gridCellCount,
    maxGridCellCount: gridCapacity,
    gasCellLookupBufferByteLength: gridCapacity * UINT32_BYTES,
    metadataBufferByteLength: SPH_GAS_CELL_EOS_METADATA_BYTES,
    sourceKeyBufferByteLength: capacity * UINT32_BYTES,
    boxDimsM: [...dims],
    sourceDispatch,
    gridGroupDispatch,
    compactDispatch,
    maxComputeWorkgroupsPerDimension: maxDispatch,
    outputSlotCount: OUTPUT_SLOT_COUNT,
    noReadback: true,
    cpuDecode: false,
    cpuReupload: false
  });
}

export const sphSpatialGasCellEosGpuWgsl = /* wgsl */ `
struct Params {
  source_row_count: u32,
  source_stride_floats: u32,
  source_kind: u32,
  output_capacity: u32,
  grid_x: u32,
  grid_y: u32,
  grid_z: u32,
  grid_cell_count: u32,
  generation: u32,
  lane_hash_low: u32,
  lane_hash_high: u32,
  max_dispatch_dimension: u32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  fallback_support_volume_m3: f32,
  gas_constant_j_per_mol_k: f32,
  fallback_temperature_k: f32,
  min_volume_m3: f32,
  source_dispatch_x: u32,
  source_epoch: u32,
  source_generation: u32,
  exact_authority_enabled: u32,
  exact_authority_generation: u32,
  exact_authority_capacity: u32,
  exact_authority_stride: u32,
  grid_group_dispatch_x: u32,
  compact_dispatch_x: u32,
  _pad0: u32,
  _pad1: u32,
};

const INVALID_KEY: u32 = 0xffffffffu;
const META_MAGIC: u32 = 0u;
const META_VERSION: u32 = 1u;
const META_GENERATION: u32 = 2u;
const META_SOURCE_KIND: u32 = 3u;
const META_SOURCE_COUNT: u32 = 4u;
const META_SOURCE_STRIDE: u32 = 5u;
const META_OUTPUT_CAPACITY: u32 = 6u;
const META_UNIQUE_COUNT: u32 = 7u;
const META_RAW_ACTIVE_COUNT: u32 = 8u;
const META_ADMITTED_ACTIVE_COUNT: u32 = 9u;
const META_INVALID_SOURCE_COUNT: u32 = 10u;
const META_OVERFLOW_COUNT: u32 = 11u;
const META_STATUS: u32 = 12u;
const META_GRID_X: u32 = 13u;
const META_GRID_Y: u32 = 14u;
const META_GRID_Z: u32 = 15u;
const META_GRID_CELL_COUNT: u32 = 16u;
const META_LANE_HASH_LOW: u32 = 17u;
const META_LANE_HASH_HIGH: u32 = 18u;
const META_SOURCE_EPOCH: u32 = 19u;
const META_SOURCE_GENERATION: u32 = 20u;
const META_REDUCTION_DISPATCH_X: u32 = 21u;
const META_EVIDENCE_FLAGS: u32 = 22u;

fn source_position(source_rows: ptr<storage, array<f32>, read>, row: u32, stride: u32) -> vec3<f32> {
  let base = row * stride;
  return vec3<f32>((*source_rows)[base], (*source_rows)[base + 1u], (*source_rows)[base + 2u]);
}

fn source_moles(source_rows: ptr<storage, array<f32>, read>, row: u32, params: Params) -> f32 {
  let base = row * params.source_stride_floats;
  return select((*source_rows)[base + 5u], (*source_rows)[base + 9u], params.source_kind == 1u);
}

fn source_mass(source_rows: ptr<storage, array<f32>, read>, row: u32, params: Params) -> f32 {
  let base = row * params.source_stride_floats;
  return select((*source_rows)[base + 4u], (*source_rows)[base + 3u], params.source_kind == 1u);
}

fn source_temperature(source_rows: ptr<storage, array<f32>, read>, row: u32, params: Params) -> f32 {
  let base = row * params.source_stride_floats;
  return select((*source_rows)[base + 6u], (*source_rows)[base + 16u], params.source_kind == 1u);
}

fn source_volume(source_rows: ptr<storage, array<f32>, read>, row: u32, params: Params) -> f32 {
  let base = row * params.source_stride_floats;
  let supplied = select((*source_rows)[base + 7u], (*source_rows)[base + 23u], params.source_kind == 1u);
  return select(params.fallback_support_volume_m3, supplied, supplied > 0.0);
}

fn source_status(source_rows: ptr<storage, array<f32>, read>, row: u32, params: Params) -> f32 {
  let base = row * params.source_stride_floats;
  return select((*source_rows)[base + 10u], (*source_rows)[base + 18u], params.source_kind == 1u);
}

fn source_routing(source_rows: ptr<storage, array<f32>, read>, row: u32, params: Params) -> f32 {
  let base = row * params.source_stride_floats;
  return select((*source_rows)[base + 11u], (*source_rows)[base + 10u], params.source_kind == 1u);
}

fn finite_value(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn source_valid(source_rows: ptr<storage, array<f32>, read>, row: u32, params: Params) -> bool {
  let p = source_position(source_rows, row, params.source_stride_floats);
  let moles = source_moles(source_rows, row, params);
  let temperature = source_temperature(source_rows, row, params);
  let volume = source_volume(source_rows, row, params);
  let status = source_status(source_rows, row, params);
  let routing = source_routing(source_rows, row, params);
  return status > 0.5 && routing > 0.5 && routing < 1.5
    && moles > 0.0 && volume >= params.min_volume_m3 && temperature > 0.0
    && finite_value(p.x) && finite_value(p.y) && finite_value(p.z)
    && finite_value(moles) && finite_value(volume) && finite_value(temperature);
}

fn grid_key(position: vec3<f32>, params: Params) -> u32 {
  let normalized = clamp(
    position / vec3<f32>(params.box_x, params.box_y, params.box_z),
    vec3<f32>(0.0),
    vec3<f32>(0.99999994)
  );
  let cell = vec3<u32>(floor(normalized * vec3<f32>(f32(params.grid_x), f32(params.grid_y), f32(params.grid_z))));
  return cell.x + cell.y * params.grid_x + cell.z * params.grid_x * params.grid_y;
}

fn exact_authority_valid(
  authority: ptr<storage, array<u32>, read>,
  authority_dispatch: ptr<storage, array<u32>, read>,
  params: Params
) -> bool {
  if (params.exact_authority_enabled != 1u
    || arrayLength(authority) < 16u
    || arrayLength(authority_dispatch) < 3u) {
    return false;
  }
  let occupied = (*authority)[2u];
  let live_count = (*authority)[3u];
  let capacity = (*authority)[4u];
  let expected_dispatch_x = (live_count + 63u) / 64u;
  return (*authority)[0u] == 1431062352u
    && (*authority)[1u] == 1u
    && occupied == live_count
    && live_count <= capacity
    && live_count <= params.source_row_count
    && capacity == params.exact_authority_capacity
    && (*authority)[7u] == params.exact_authority_generation
    && (*authority)[8u] == params.exact_authority_stride
    && params.exact_authority_stride == params.source_stride_floats
    && (*authority)[6u] == 0u
    && (*authority)[15u] == 1u
    && (*authority_dispatch)[0] == expected_dispatch_x
    && (*authority_dispatch)[1] == 1u
    && (*authority_dispatch)[2] == 1u;
}

@group(0) @binding(0) var<storage, read> key_source_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> source_keys: array<u32>;
@group(0) @binding(2) var<storage, read_write> key_metadata: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> key_params: Params;
@group(0) @binding(4) var<storage, read> key_exact_authority: array<u32>;
@group(0) @binding(5) var<storage, read> key_exact_authority_dispatch: array<u32>;

@compute @workgroup_size(64)
fn build_keys(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * key_params.source_dispatch_x;
  let row = linear_group * 64u + local_id.x;
  let exact_requested = key_params.exact_authority_enabled == 1u;
  let exact_valid = !exact_requested || exact_authority_valid(
    &key_exact_authority,
    &key_exact_authority_dispatch,
    key_params
  );
  let exact_count = select(
    key_params.source_row_count,
    key_exact_authority[${SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.activeRowCount}u],
    exact_requested && exact_valid
  );
  if (row == 0u) {
    atomicStore(&key_metadata[META_MAGIC], ${SPH_GAS_CELL_EOS_MAGIC}u);
    atomicStore(&key_metadata[META_VERSION], ${SPH_GAS_CELL_EOS_VERSION}u);
    atomicStore(&key_metadata[META_GENERATION], key_params.generation);
    atomicStore(&key_metadata[META_SOURCE_KIND], key_params.source_kind);
    atomicStore(&key_metadata[META_SOURCE_COUNT], key_params.source_row_count);
    atomicStore(&key_metadata[META_SOURCE_STRIDE], key_params.source_stride_floats);
    atomicStore(&key_metadata[META_OUTPUT_CAPACITY], key_params.output_capacity);
    atomicStore(&key_metadata[META_GRID_X], key_params.grid_x);
    atomicStore(&key_metadata[META_GRID_Y], key_params.grid_y);
    atomicStore(&key_metadata[META_GRID_Z], key_params.grid_z);
    atomicStore(&key_metadata[META_GRID_CELL_COUNT], key_params.grid_cell_count);
    atomicStore(&key_metadata[META_LANE_HASH_LOW], key_params.lane_hash_low);
    atomicStore(&key_metadata[META_LANE_HASH_HIGH], key_params.lane_hash_high);
    atomicStore(&key_metadata[META_SOURCE_EPOCH], key_params.source_epoch);
    atomicStore(&key_metadata[META_SOURCE_GENERATION], key_params.source_generation);
    atomicStore(&key_metadata[META_EVIDENCE_FLAGS], 7u);
    if (!exact_valid) {
      atomicStore(&key_metadata[META_STATUS], ${SPH_GAS_CELL_EOS_GPU_STATUS.blocked}u);
      atomicStore(&key_metadata[META_OVERFLOW_COUNT], 1u);
    }
  }
  if (row >= key_params.source_row_count) { return; }
  if (row >= exact_count) {
    source_keys[row] = INVALID_KEY;
    atomicAdd(&key_metadata[META_INVALID_SOURCE_COUNT], 1u);
  } else if (source_valid(&key_source_rows, row, key_params)) {
    source_keys[row] = grid_key(
      source_position(&key_source_rows, row, key_params.source_stride_floats),
      key_params
    );
  } else {
    source_keys[row] = INVALID_KEY;
    atomicAdd(&key_metadata[META_INVALID_SOURCE_COUNT], 1u);
  }
}

@group(0) @binding(0) var<storage, read> exact_prepare_authority: array<u32>;
@group(0) @binding(1) var<storage, read> exact_prepare_authority_dispatch: array<u32>;
@group(0) @binding(2) var<storage, read_write> exact_prepare_metadata: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> exact_gated_dispatch: array<u32>;
@group(0) @binding(4) var<storage, read_write> exact_prepare_unique_evidence: array<u32>;
@group(0) @binding(5) var<uniform> exact_prepare_params: Params;

@compute @workgroup_size(1)
fn prepare_exact_prefix() {
  atomicStore(&exact_prepare_metadata[META_MAGIC], 1431062343u);
  atomicStore(&exact_prepare_metadata[META_VERSION], 1u);
  atomicStore(&exact_prepare_metadata[META_GENERATION], exact_prepare_params.generation);
  atomicStore(&exact_prepare_metadata[META_SOURCE_KIND], exact_prepare_params.source_kind);
  atomicStore(&exact_prepare_metadata[META_SOURCE_STRIDE], exact_prepare_params.source_stride_floats);
  atomicStore(&exact_prepare_metadata[META_OUTPUT_CAPACITY], exact_prepare_params.output_capacity);
  atomicStore(&exact_prepare_metadata[META_GRID_X], exact_prepare_params.grid_x);
  atomicStore(&exact_prepare_metadata[META_GRID_Y], exact_prepare_params.grid_y);
  atomicStore(&exact_prepare_metadata[META_GRID_Z], exact_prepare_params.grid_z);
  atomicStore(&exact_prepare_metadata[META_GRID_CELL_COUNT], exact_prepare_params.grid_cell_count);
  atomicStore(&exact_prepare_metadata[META_LANE_HASH_LOW], exact_prepare_params.lane_hash_low);
  atomicStore(&exact_prepare_metadata[META_LANE_HASH_HIGH], exact_prepare_params.lane_hash_high);
  atomicStore(&exact_prepare_metadata[META_SOURCE_EPOCH], exact_prepare_params.source_epoch);
  atomicStore(&exact_prepare_metadata[META_SOURCE_GENERATION], exact_prepare_params.source_generation);
  atomicStore(&exact_prepare_metadata[META_EVIDENCE_FLAGS], 7u);
  let valid = exact_authority_valid(
    &exact_prepare_authority,
    &exact_prepare_authority_dispatch,
    exact_prepare_params
  );
  let live_count = select(0u, exact_prepare_authority[3u], valid);
  atomicStore(&exact_prepare_metadata[META_SOURCE_COUNT], live_count);
  if (!valid) {
    atomicStore(&exact_prepare_metadata[META_OVERFLOW_COUNT], 1u);
    atomicStore(&exact_prepare_metadata[META_STATUS], 3u);
  }
  exact_prepare_unique_evidence[0] = exact_prepare_params.generation;
  exact_prepare_unique_evidence[1] = live_count;
  exact_prepare_unique_evidence[2] = 0u;
  exact_prepare_unique_evidence[3] = select(0u, 1u, valid);
  exact_prepare_unique_evidence[4] = select(1u, 0u, valid);
  exact_prepare_unique_evidence[5] = 1u;
  exact_prepare_unique_evidence[6] = 1u;
  exact_prepare_unique_evidence[7] = 0u;
  exact_gated_dispatch[0] = select(0u, 1u, valid && live_count > 0u);
  exact_gated_dispatch[1] = 1u;
  exact_gated_dispatch[2] = 1u;
}

@group(0) @binding(0) var<storage, read> exact_source_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> exact_source_keys: array<u32>;
@group(0) @binding(2) var<storage, read_write> exact_indices_a: array<u32>;
@group(0) @binding(3) var<storage, read_write> exact_indices_b: array<u32>;
@group(0) @binding(4) var<storage, read_write> exact_histogram: array<u32>;
@group(0) @binding(5) var<storage, read_write> exact_unique_keys: array<u32>;
@group(0) @binding(6) var<storage, read_write> exact_unique_offsets: array<u32>;
@group(0) @binding(7) var<storage, read_write> exact_unique_evidence: array<u32>;
@group(0) @binding(8) var<uniform> exact_params: Params;

fn exact_stable_digit_a_to_b(count: u32, shift: u32) {
  var bucket = 0u;
  while (bucket < 256u) {
    exact_histogram[bucket] = 0u;
    bucket = bucket + 1u;
  }
  var position = 0u;
  while (position < count) {
    let source_index = exact_indices_a[position];
    bucket = (exact_source_keys[source_index] >> shift) & 255u;
    exact_histogram[bucket] = exact_histogram[bucket] + 1u;
    position = position + 1u;
  }
  var prefix = 0u;
  bucket = 0u;
  while (bucket < 256u) {
    let bucket_count = exact_histogram[bucket];
    exact_histogram[bucket] = prefix;
    prefix = prefix + bucket_count;
    bucket = bucket + 1u;
  }
  position = 0u;
  while (position < count) {
    let source_index = exact_indices_a[position];
    bucket = (exact_source_keys[source_index] >> shift) & 255u;
    let destination = exact_histogram[bucket];
    exact_indices_b[destination] = source_index;
    exact_histogram[bucket] = destination + 1u;
    position = position + 1u;
  }
}

fn exact_stable_digit_b_to_a(count: u32, shift: u32) {
  var bucket = 0u;
  while (bucket < 256u) {
    exact_histogram[bucket] = 0u;
    bucket = bucket + 1u;
  }
  var position = 0u;
  while (position < count) {
    let source_index = exact_indices_b[position];
    bucket = (exact_source_keys[source_index] >> shift) & 255u;
    exact_histogram[bucket] = exact_histogram[bucket] + 1u;
    position = position + 1u;
  }
  var prefix = 0u;
  bucket = 0u;
  while (bucket < 256u) {
    let bucket_count = exact_histogram[bucket];
    exact_histogram[bucket] = prefix;
    prefix = prefix + bucket_count;
    bucket = bucket + 1u;
  }
  position = 0u;
  while (position < count) {
    let source_index = exact_indices_b[position];
    bucket = (exact_source_keys[source_index] >> shift) & 255u;
    let destination = exact_histogram[bucket];
    exact_indices_a[destination] = source_index;
    exact_histogram[bucket] = destination + 1u;
    position = position + 1u;
  }
}

@compute @workgroup_size(1)
fn group_exact_prefix() {
  let count = exact_unique_evidence[1];
  var invalid_count = 0u;
  var row = 0u;
  while (row < count) {
    let valid = source_valid(&exact_source_rows, row, exact_params);
    exact_source_keys[row] = select(
      INVALID_KEY,
      grid_key(
        source_position(&exact_source_rows, row, exact_params.source_stride_floats),
        exact_params
      ),
      valid
    );
    invalid_count = invalid_count + select(1u, 0u, valid);
    exact_indices_a[row] = row;
    row = row + 1u;
  }
  exact_stable_digit_a_to_b(count, 0u);
  exact_stable_digit_b_to_a(count, 8u);
  exact_stable_digit_a_to_b(count, 16u);
  exact_stable_digit_b_to_a(count, 24u);
  var unique_count = 0u;
  var position = 0u;
  while (position < count) {
    let source_index = exact_indices_a[position];
    let key = exact_source_keys[source_index];
    if (position == 0u
      || key != exact_source_keys[exact_indices_a[position - 1u]]) {
      exact_unique_keys[unique_count] = key;
      exact_unique_offsets[unique_count] = position;
      unique_count = unique_count + 1u;
    }
    position = position + 1u;
  }
  exact_unique_offsets[unique_count] = count;
  exact_unique_evidence[0] = exact_params.generation;
  exact_unique_evidence[1] = count;
  exact_unique_evidence[2] = unique_count;
  exact_unique_evidence[3] = 1u;
  exact_unique_evidence[4] = 0u;
  exact_unique_evidence[5] = 1u;
  exact_unique_evidence[6] = 1u;
  exact_unique_evidence[7] = invalid_count;
}
@group(0) @binding(0) var<storage, read> direct_source_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> direct_sorted_keys: array<u32>;
@group(0) @binding(2) var<storage, read_write> direct_sorted_indices: array<u32>;
@group(0) @binding(3) var<storage, read_write> direct_unique_keys: array<u32>;
@group(0) @binding(4) var<storage, read_write> direct_unique_offsets: array<u32>;
@group(0) @binding(5) var<storage, read_write> direct_unique_evidence: array<u32>;
@group(0) @binding(6) var<storage, read_write> direct_metadata: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> direct_params: Params;

// Small prefixes are cheaper to sort deterministically in one invocation than
// to launch the complete radix graph. Stable insertion order produces the
// same key/index ordering consumed by the shared reduction path.
@compute @workgroup_size(1)
fn group_direct_prefix() {
  atomicStore(&direct_metadata[META_MAGIC], ${SPH_GAS_CELL_EOS_MAGIC}u);
  atomicStore(&direct_metadata[META_VERSION], ${SPH_GAS_CELL_EOS_VERSION}u);
  atomicStore(&direct_metadata[META_GENERATION], direct_params.generation);
  atomicStore(&direct_metadata[META_SOURCE_KIND], direct_params.source_kind);
  atomicStore(&direct_metadata[META_SOURCE_COUNT], direct_params.source_row_count);
  atomicStore(&direct_metadata[META_SOURCE_STRIDE], direct_params.source_stride_floats);
  atomicStore(&direct_metadata[META_OUTPUT_CAPACITY], direct_params.output_capacity);
  atomicStore(&direct_metadata[META_GRID_X], direct_params.grid_x);
  atomicStore(&direct_metadata[META_GRID_Y], direct_params.grid_y);
  atomicStore(&direct_metadata[META_GRID_Z], direct_params.grid_z);
  atomicStore(&direct_metadata[META_GRID_CELL_COUNT], direct_params.grid_cell_count);
  atomicStore(&direct_metadata[META_LANE_HASH_LOW], direct_params.lane_hash_low);
  atomicStore(&direct_metadata[META_LANE_HASH_HIGH], direct_params.lane_hash_high);
  atomicStore(&direct_metadata[META_SOURCE_EPOCH], direct_params.source_epoch);
  atomicStore(&direct_metadata[META_SOURCE_GENERATION], direct_params.source_generation);
  atomicStore(&direct_metadata[META_EVIDENCE_FLAGS], 7u);

  var invalid_count = 0u;
  var row = 0u;
  while (row < direct_params.source_row_count) {
    let valid = source_valid(&direct_source_rows, row, direct_params);
    let key = select(
      INVALID_KEY,
      grid_key(
        source_position(&direct_source_rows, row, direct_params.source_stride_floats),
        direct_params
      ),
      valid
    );
    invalid_count = invalid_count + select(1u, 0u, valid);
    var insertion = row;
    while (insertion > 0u && direct_sorted_keys[insertion - 1u] > key) {
      direct_sorted_keys[insertion] = direct_sorted_keys[insertion - 1u];
      direct_sorted_indices[insertion] = direct_sorted_indices[insertion - 1u];
      insertion = insertion - 1u;
    }
    direct_sorted_keys[insertion] = key;
    direct_sorted_indices[insertion] = row;
    row = row + 1u;
  }

  var unique_count = 0u;
  row = 0u;
  while (row < direct_params.source_row_count) {
    let key = direct_sorted_keys[row];
    if (row == 0u || key != direct_sorted_keys[row - 1u]) {
      direct_unique_keys[unique_count] = key;
      direct_unique_offsets[unique_count] = row;
      unique_count = unique_count + 1u;
    }
    row = row + 1u;
  }
  direct_unique_offsets[unique_count] = direct_params.source_row_count;
  direct_unique_evidence[0] = direct_params.generation;
  direct_unique_evidence[1] = direct_params.source_row_count;
  direct_unique_evidence[2] = unique_count;
  direct_unique_evidence[3] = 1u;
  direct_unique_evidence[4] = 0u;
  direct_unique_evidence[5] = 1u;
  direct_unique_evidence[6] = 1u;
  direct_unique_evidence[7] = 1u;
  atomicStore(&direct_metadata[META_INVALID_SOURCE_COUNT], invalid_count);
}

@group(0) @binding(0) var<storage, read> prepare_unique_evidence: array<u32>;
@group(0) @binding(1) var<storage, read_write> prepare_metadata: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> reduction_dispatch: array<u32>;
@group(0) @binding(3) var<storage, read_write> gradient_dispatch: array<u32>;
@group(0) @binding(4) var<uniform> prepare_params: Params;

@compute @workgroup_size(1)
fn prepare_dispatch() {
  let expected_source_count = select(
    prepare_params.source_row_count,
    atomicLoad(&prepare_metadata[META_SOURCE_COUNT]),
    prepare_params.exact_authority_enabled == 1u
  );
  let evidence_valid = prepare_unique_evidence[0] == prepare_params.generation
    && prepare_unique_evidence[1] == expected_source_count
    && prepare_unique_evidence[3] == 1u
    && prepare_unique_evidence[4] == 0u;
  let unique_count = prepare_unique_evidence[2];
  if (prepare_params.exact_authority_enabled == 1u) {
    atomicStore(&prepare_metadata[META_INVALID_SOURCE_COUNT], prepare_unique_evidence[7]);
  }
  atomicStore(&prepare_metadata[META_UNIQUE_COUNT], unique_count);
  if (!evidence_valid || unique_count > prepare_params.output_capacity) {
    atomicStore(&prepare_metadata[META_OVERFLOW_COUNT], select(1u, unique_count - prepare_params.output_capacity, unique_count > prepare_params.output_capacity));
    atomicStore(&prepare_metadata[META_STATUS], ${SPH_GAS_CELL_EOS_GPU_STATUS.blocked}u);
    reduction_dispatch[0] = 0u;
    reduction_dispatch[1] = 1u;
    reduction_dispatch[2] = 1u;
    gradient_dispatch[0] = 0u;
    gradient_dispatch[1] = 1u;
    gradient_dispatch[2] = 1u;
    return;
  }
  let dispatch_x = min(max(unique_count, 1u), prepare_params.max_dispatch_dimension);
  let dispatch_y = (unique_count + dispatch_x - 1u) / dispatch_x;
  atomicStore(&prepare_metadata[META_REDUCTION_DISPATCH_X], dispatch_x);
  reduction_dispatch[0] = select(0u, dispatch_x, unique_count > 0u);
  reduction_dispatch[1] = select(1u, dispatch_y, unique_count > 0u);
  reduction_dispatch[2] = 1u;
  gradient_dispatch[0] = (unique_count + 63u) / 64u;
  gradient_dispatch[1] = 1u;
  gradient_dispatch[2] = 1u;
}

@group(0) @binding(0) var<storage, read> reduce_source_rows: array<f32>;
@group(0) @binding(1) var<storage, read> sorted_source_indices: array<u32>;
@group(0) @binding(2) var<storage, read> unique_cell_keys: array<u32>;
@group(0) @binding(3) var<storage, read> unique_cell_offsets: array<u32>;
@group(0) @binding(4) var<storage, read_write> gas_pressure_cells: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> gas_cell_lookup: array<u32>;
@group(0) @binding(6) var<storage, read_write> reduce_metadata: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> reduce_params: Params;

var<workgroup> sum_moles: array<f32, 64>;
var<workgroup> sum_mass: array<f32, 64>;
var<workgroup> sum_temperature_moles: array<f32, 64>;
var<workgroup> sum_volume: array<f32, 64>;
var<workgroup> sum_position_x: array<f32, 64>;
var<workgroup> sum_position_y: array<f32, 64>;
var<workgroup> sum_position_z: array<f32, 64>;

@compute @workgroup_size(64)
fn reduce_cells(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let dispatch_x = atomicLoad(&reduce_metadata[META_REDUCTION_DISPATCH_X]);
  let unique_index = workgroup_id.x + workgroup_id.y * dispatch_x;
  let unique_count = atomicLoad(&reduce_metadata[META_UNIQUE_COUNT]);
  var cell_key = INVALID_KEY;
  if (unique_index < unique_count) {
    cell_key = unique_cell_keys[unique_index];
  }
  let group_active = atomicLoad(&reduce_metadata[META_STATUS]) != ${SPH_GAS_CELL_EOS_GPU_STATUS.blocked}u
    && unique_index < unique_count && unique_index < reduce_params.output_capacity
    && cell_key != INVALID_KEY;
  var start = 0u;
  var end = 0u;
  if (group_active) {
    start = unique_cell_offsets[unique_index];
    end = unique_cell_offsets[unique_index + 1u];
  }
  var moles = 0.0;
  var mass = 0.0;
  var temperature_moles = 0.0;
  var volume = 0.0;
  var weighted_position = vec3<f32>(0.0);
  var sorted_position = start + local_id.x;
  while (sorted_position < end) {
    let source_row = sorted_source_indices[sorted_position];
    let row_moles = source_moles(&reduce_source_rows, source_row, reduce_params);
    let row_position = source_position(&reduce_source_rows, source_row, reduce_params.source_stride_floats);
    moles = moles + row_moles;
    mass = mass + max(0.0, source_mass(&reduce_source_rows, source_row, reduce_params));
    temperature_moles = temperature_moles + row_moles * source_temperature(&reduce_source_rows, source_row, reduce_params);
    volume = volume + source_volume(&reduce_source_rows, source_row, reduce_params);
    weighted_position = weighted_position + row_position * row_moles;
    sorted_position = sorted_position + 64u;
  }
  sum_moles[local_id.x] = moles;
  sum_mass[local_id.x] = mass;
  sum_temperature_moles[local_id.x] = temperature_moles;
  sum_volume[local_id.x] = volume;
  sum_position_x[local_id.x] = weighted_position.x;
  sum_position_y[local_id.x] = weighted_position.y;
  sum_position_z[local_id.x] = weighted_position.z;
  workgroupBarrier();
  var width = 32u;
  while (width > 0u) {
    if (local_id.x < width) {
      sum_moles[local_id.x] = sum_moles[local_id.x] + sum_moles[local_id.x + width];
      sum_mass[local_id.x] = sum_mass[local_id.x] + sum_mass[local_id.x + width];
      sum_temperature_moles[local_id.x] = sum_temperature_moles[local_id.x] + sum_temperature_moles[local_id.x + width];
      sum_volume[local_id.x] = sum_volume[local_id.x] + sum_volume[local_id.x + width];
      sum_position_x[local_id.x] = sum_position_x[local_id.x] + sum_position_x[local_id.x + width];
      sum_position_y[local_id.x] = sum_position_y[local_id.x] + sum_position_y[local_id.x + width];
      sum_position_z[local_id.x] = sum_position_z[local_id.x] + sum_position_z[local_id.x + width];
    }
    workgroupBarrier();
    width = width >> 1u;
  }
  if (local_id.x != 0u || !group_active) { return; }
  let total_moles = sum_moles[0];
  let total_volume = sum_volume[0];
  let pressure = sum_temperature_moles[0] * reduce_params.gas_constant_j_per_mol_k / total_volume;
  if (!(total_moles > 0.0 && total_volume >= reduce_params.min_volume_m3 && pressure >= 0.0
    && finite_value(total_moles) && finite_value(total_volume) && finite_value(pressure))) {
    atomicAdd(&reduce_metadata[META_OVERFLOW_COUNT], 1u);
    return;
  }
  let xy = reduce_params.grid_x * reduce_params.grid_y;
  let grid_z = cell_key / xy;
  let remaining = cell_key - grid_z * xy;
  let grid_y = remaining / reduce_params.grid_x;
  let grid_x = remaining - grid_y * reduce_params.grid_x;
  let center = vec3<f32>(sum_position_x[0], sum_position_y[0], sum_position_z[0]) / total_moles;
  gas_pressure_cells[unique_index * 3u] = vec4<f32>(f32(grid_x), f32(grid_y), f32(grid_z), 1.0);
  gas_pressure_cells[unique_index * 3u + 1u] = vec4<f32>(center, pressure);
  gas_pressure_cells[unique_index * 3u + 2u] = vec4<f32>(0.0, 0.0, 0.0, total_volume);
  gas_cell_lookup[cell_key] = unique_index + 1u;
  atomicAdd(&reduce_metadata[META_RAW_ACTIVE_COUNT], 1u);
}

@group(0) @binding(0) var<storage, read_write> finalize_metadata: array<atomic<u32>>;
@group(0) @binding(1) var<storage, read> finalize_unique_evidence: array<u32>;
@group(0) @binding(2) var<uniform> finalize_params: Params;

@compute @workgroup_size(1)
fn finalize_evidence() {
  if (atomicLoad(&finalize_metadata[META_STATUS]) == ${SPH_GAS_CELL_EOS_GPU_STATUS.blocked}u) {
    atomicStore(&finalize_metadata[META_ADMITTED_ACTIVE_COUNT], 0u);
    return;
  }
  let unique_count = atomicLoad(&finalize_metadata[META_UNIQUE_COUNT]);
  let invalid_source_count = atomicLoad(&finalize_metadata[META_INVALID_SOURCE_COUNT]);
  let expected_active_count = unique_count - select(0u, 1u, invalid_source_count > 0u);
  let raw_active_count = atomicLoad(&finalize_metadata[META_RAW_ACTIVE_COUNT]);
  let overflow_count = atomicLoad(&finalize_metadata[META_OVERFLOW_COUNT]);
  let expected_source_count = select(
    finalize_params.source_row_count,
    atomicLoad(&finalize_metadata[META_SOURCE_COUNT]),
    finalize_params.exact_authority_enabled == 1u
  );
  let evidence_valid = finalize_unique_evidence[0] == finalize_params.generation
    && finalize_unique_evidence[1] == expected_source_count
    && finalize_unique_evidence[2] == unique_count
    && finalize_unique_evidence[3] == 1u
    && finalize_unique_evidence[4] == 0u;
  if (!evidence_valid || overflow_count > 0u || raw_active_count != expected_active_count) {
    atomicStore(&finalize_metadata[META_STATUS], ${SPH_GAS_CELL_EOS_GPU_STATUS.blocked}u);
    atomicStore(&finalize_metadata[META_ADMITTED_ACTIVE_COUNT], 0u);
    if (overflow_count == 0u) { atomicStore(&finalize_metadata[META_OVERFLOW_COUNT], 1u); }
    return;
  }
  atomicStore(&finalize_metadata[META_ADMITTED_ACTIVE_COUNT], raw_active_count);
  atomicStore(
    &finalize_metadata[META_STATUS],
    select(${SPH_GAS_CELL_EOS_GPU_STATUS.empty}u, ${SPH_GAS_CELL_EOS_GPU_STATUS.ready}u, raw_active_count > 0u)
  );
}

fn pressure_row_from_lookup(cell_key: u32, admitted_count: u32) -> i32 {
  if (cell_key >= gradient_params.grid_cell_count) { return -1; }
  let encoded = gradient_lookup[cell_key];
  if (encoded == 0u || encoded - 1u >= admitted_count) { return -1; }
  return i32(encoded - 1u);
}

fn pressure_gradient_axis(row_index: u32, axis: u32, admitted_count: u32) -> f32 {
  let row0 = gradient_cells[row_index * 3u];
  let row1 = gradient_cells[row_index * 3u + 1u];
  let cell = vec3<u32>(row0.xyz);
  let dim = select(select(gradient_params.grid_z, gradient_params.grid_y, axis == 1u), gradient_params.grid_x, axis == 0u);
  let coordinate = select(select(cell.z, cell.y, axis == 1u), cell.x, axis == 0u);
  var plus_row = -1;
  var minus_row = -1;
  let axis_stride = select(select(gradient_params.grid_x * gradient_params.grid_y, gradient_params.grid_x, axis == 1u), 1u, axis == 0u);
  let key = cell.x + cell.y * gradient_params.grid_x + cell.z * gradient_params.grid_x * gradient_params.grid_y;
  if (coordinate + 1u < dim) { plus_row = pressure_row_from_lookup(key + axis_stride, admitted_count); }
  if (coordinate > 0u) { minus_row = pressure_row_from_lookup(key - axis_stride, admitted_count); }
  if (plus_row >= 0 && minus_row >= 0) {
    let plus = gradient_cells[u32(plus_row) * 3u + 1u];
    let minus = gradient_cells[u32(minus_row) * 3u + 1u];
    let distance = plus[axis] - minus[axis];
    return select(0.0, (plus.w - minus.w) / distance, abs(distance) > 1.0e-12);
  }
  if (plus_row >= 0) {
    let plus = gradient_cells[u32(plus_row) * 3u + 1u];
    let distance = plus[axis] - row1[axis];
    return select(0.0, (plus.w - row1.w) / distance, abs(distance) > 1.0e-12);
  }
  if (minus_row >= 0) {
    let minus = gradient_cells[u32(minus_row) * 3u + 1u];
    let distance = row1[axis] - minus[axis];
    return select(0.0, (row1.w - minus.w) / distance, abs(distance) > 1.0e-12);
  }
  return 0.0;
}

@group(0) @binding(0) var<storage, read_write> gradient_cells: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> gradient_lookup: array<u32>;
@group(0) @binding(2) var<storage, read_write> gradient_metadata: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> gradient_params: Params;

@compute @workgroup_size(64)
fn compute_gradients(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  let admitted_count = atomicLoad(&gradient_metadata[META_ADMITTED_ACTIVE_COUNT]);
  if (atomicLoad(&gradient_metadata[META_STATUS]) != ${SPH_GAS_CELL_EOS_GPU_STATUS.ready}u
    || row_index >= admitted_count) { return; }
  let prior = gradient_cells[row_index * 3u + 2u];
  let gradient = vec3<f32>(
    pressure_gradient_axis(row_index, 0u, admitted_count),
    pressure_gradient_axis(row_index, 1u, admitted_count),
    pressure_gradient_axis(row_index, 2u, admitted_count)
  );
  if (!(finite_value(gradient.x) && finite_value(gradient.y) && finite_value(gradient.z))) {
    atomicStore(&gradient_metadata[META_STATUS], ${SPH_GAS_CELL_EOS_GPU_STATUS.blocked}u);
    atomicStore(&gradient_metadata[META_ADMITTED_ACTIVE_COUNT], 0u);
    atomicAdd(&gradient_metadata[META_OVERFLOW_COUNT], 1u);
    return;
  }
  gradient_cells[row_index * 3u + 2u] = vec4<f32>(gradient, prior.w);
}
`;

function createPipeline(device, module, label, entryPoint) {
  return device.createComputePipeline({
    label,
    layout: 'auto',
    compute: { module, entryPoint }
  });
}

function bindGroup(device, pipeline, label, entries) {
  return device.createBindGroup({
    label,
    layout: pipeline.getBindGroupLayout(0),
    entries: entries.map(([binding, buffer, offset = null, size = null]) => {
      const resource = { buffer };
      if (offset != null) resource.offset = offset;
      if (size != null) resource.size = size;
      return { binding, resource };
    })
  });
}

function paramsArray(plan, {
  generation,
  laneHash,
  sourceEpoch,
  sourceGeneration,
  fallbackSupportVolumeM3,
  fallbackTemperatureK,
  minVolumeM3,
  exactPrefixAuthority = null
}) {
  const buffer = new ArrayBuffer(PARAMS_BYTE_LENGTH);
  const view = new DataView(buffer);
  const u32 = (word, value) => view.setUint32(word * 4, value >>> 0, true);
  const f32 = (word, value) => view.setFloat32(word * 4, value, true);
  u32(0, plan.sourceRowCount);
  u32(1, plan.sourceRowStrideFloats);
  u32(2, plan.sourceKindId);
  u32(3, plan.gasCellCapacity);
  u32(4, plan.gridDims[0]);
  u32(5, plan.gridDims[1]);
  u32(6, plan.gridDims[2]);
  u32(7, plan.gridCellCount);
  u32(8, generation);
  u32(9, laneHash[0]);
  u32(10, laneHash[1]);
  u32(11, plan.maxComputeWorkgroupsPerDimension);
  f32(12, plan.boxDimsM[0]);
  f32(13, plan.boxDimsM[1]);
  f32(14, plan.boxDimsM[2]);
  f32(15, fallbackSupportVolumeM3);
  f32(16, GAS_CONSTANT_J_PER_MOL_K);
  f32(17, fallbackTemperatureK);
  f32(18, minVolumeM3);
  u32(19, plan.sourceDispatch[0]);
  u32(20, sourceEpoch);
  u32(21, sourceGeneration);
  u32(22, exactPrefixAuthority ? 1 : 0);
  u32(23, exactPrefixAuthority?.generationId ?? 0);
  u32(24, exactPrefixAuthority?.capacityRows ?? 0);
  u32(25, exactPrefixAuthority?.strideFloats ?? 0);
  u32(26, plan.gridGroupDispatch[0]);
  u32(27, plan.compactDispatch[0]);
  return buffer;
}

function blockedResult(reason, details = {}) {
  return {
    schema: ULG_SPH_SPATIAL_GAS_CELL_EOS_GPU_RESULT_SCHEMA,
    status: 'sph-spatial-gas-cell-eos-gpu-blocked',
    ready: false,
    blocker: reason,
    backend: 'webgpu',
    normalHotLoopReadbackFree: true,
    fullReadbackPerformed: false,
    mapAsyncCalled: false,
    cpuDecodePerformed: false,
    cpuGasCellRowsUploaded: false,
    pressureInterfaceGasPressureCellRowCount: 0,
    pressureInterfaceGasPressureCellRowCapacity: 0,
    retainedGasPressureBufferRefs: [],
    ...details
  };
}

function borrowSourceHandle(source) {
  const handle = source?.sourceHandle;
  if (!handle || typeof handle !== 'object') {
    return { admitted: true, protocol: 'no-source-handle', release: () => false };
  }
  let released = false;
  const once = (release) => () => {
    if (released) return false;
    released = true;
    return release();
  };
  const advertisesLeaseProtocol = typeof handle.addConsumerLease === 'function'
    || typeof handle.releaseConsumerLease === 'function';
  if (advertisesLeaseProtocol) {
    if (typeof handle.addConsumerLease !== 'function' || typeof handle.releaseConsumerLease !== 'function') {
      return {
        admitted: false,
        protocol: 'explicit-consumer-lease',
        reason: 'spatial-gas-source-consumer-lease-protocol-incomplete',
        release: () => false
      };
    }
    let lease;
    try {
      lease = handle.addConsumerLease({ consumerStage: 'gasCellEosProducer', reason: 'gpu-spatial-gas-eos' });
    } catch (error) {
      return {
        admitted: false,
        protocol: 'explicit-consumer-lease',
        reason: error?.message || 'spatial-gas-source-consumer-lease-rejected',
        release: () => false
      };
    }
    const leaseId = lease?.leaseId ?? lease;
    if (leaseId == null || lease?.accepted === false || String(lease?.status || '').includes('rejected')) {
      return {
        admitted: false,
        protocol: 'explicit-consumer-lease',
        reason: lease?.reason || 'spatial-gas-source-consumer-lease-rejected',
        release: () => false
      };
    }
    return {
      admitted: true,
      protocol: 'explicit-consumer-lease',
      leaseId,
      release: once(() => handle.releaseConsumerLease(leaseId, { reason: 'gas-cell-eos-source-submit-complete' }))
    };
  }
  handle.__ulgActiveBorrowCount = (handle.__ulgActiveBorrowCount | 0) + 1;
  return {
    admitted: true,
    protocol: 'legacy-retained-handle-borrow-counter',
    release: once(() => {
      handle.__ulgActiveBorrowCount = Math.max(0, (handle.__ulgActiveBorrowCount | 0) - 1);
      return true;
    })
  };
}

export function createSphSpatialGasCellEosGpuLane(device, {
  sourceCapacity,
  gasCellCapacity = null,
  maxGridCellCount = null,
  label = 'ulg-sph-spatial-gas-cell-eos',
  requireLaneIdentity = true,
  laneId = null,
  stateKey = null,
  sourceFamily = null,
  maxComputeWorkgroupsPerDimension = null,
  outputSlotCount = OUTPUT_SLOT_COUNT,
  paramsSlotCount = null
} = {}) {
  assertDevice(device);
  const resolvedSourceCapacity = positiveInteger(sourceCapacity, 'sourceCapacity');
  const resolvedGasCellCapacity = positiveInteger(gasCellCapacity ?? (resolvedSourceCapacity + 1), 'gasCellCapacity');
  const resolvedMaxGridCellCount = positiveInteger(maxGridCellCount ?? resolvedSourceCapacity, 'maxGridCellCount');
  const maxDispatch = positiveInteger(
    maxComputeWorkgroupsPerDimension ?? device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'maxComputeWorkgroupsPerDimension'
  );
  const resolvedParamsSlotCount = positiveInteger(
    paramsSlotCount ?? outputSlotCount ?? DEFAULT_PARAMS_SLOT_COUNT,
    'paramsSlotCount'
  );
  if (resolvedParamsSlotCount > MAX_PARAMS_SLOT_COUNT) {
    throw new RangeError(`paramsSlotCount exceeds ${MAX_PARAMS_SLOT_COUNT}`);
  }
  const paramsByteStride = Math.max(
    MIN_UNIFORM_BUFFER_OFFSET_ALIGNMENT,
    positiveInteger(
      device.limits?.minUniformBufferOffsetAlignment ?? MIN_UNIFORM_BUFFER_OFFSET_ALIGNMENT,
      'minUniformBufferOffsetAlignment'
    )
  );
  const sourceKeyBuffer = createStorageBuffer(device, `${label}-source-keys`, resolvedSourceCapacity * UINT32_BYTES);
  const directSourceCapacity = Math.min(
    resolvedSourceCapacity,
    SPH_GAS_CELL_EOS_DIRECT_SOURCE_LIMIT
  );
  const directSortedIndexBuffer = createStorageBuffer(
    device,
    `${label}-direct-sorted-indices`,
    directSourceCapacity * UINT32_BYTES
  );
  const directUniqueKeyBuffer = createStorageBuffer(
    device,
    `${label}-direct-unique-keys`,
    directSourceCapacity * UINT32_BYTES
  );
  const directUniqueOffsetBuffer = createStorageBuffer(
    device,
    `${label}-direct-unique-offsets`,
    (directSourceCapacity + 1) * UINT32_BYTES
  );
  const directUniqueEvidenceBuffer = createStorageBuffer(
    device,
    `${label}-direct-unique-evidence`,
    8 * UINT32_BYTES
  );
  const radix = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: resolvedSourceCapacity,
    maxKeyWordCount: 1,
    label: `${label}-radix`,
    maxComputeWorkgroupsPerDimension: maxDispatch
  });
  const exactLinearRadixSupported = resolvedSourceCapacity
    <= SPH_GAS_CELL_EOS_EXACT_LINEAR_RADIX_MAX_SOURCE_CAPACITY;
  const exactSortedIndexBufferA = createStorageBuffer(
    device,
    `${label}-exact-sorted-indices-a`,
    resolvedSourceCapacity * UINT32_BYTES
  );
  const exactSortedIndexBufferB = createStorageBuffer(
    device,
    `${label}-exact-sorted-indices-b`,
    resolvedSourceCapacity * UINT32_BYTES
  );
  const exactHistogramBuffer = createStorageBuffer(
    device,
    `${label}-exact-histogram`,
    256 * UINT32_BYTES
  );
  const exactUniqueKeyBuffer = createStorageBuffer(
    device,
    `${label}-exact-unique-keys`,
    resolvedSourceCapacity * UINT32_BYTES
  );
  const exactUniqueOffsetBuffer = createStorageBuffer(
    device,
    `${label}-exact-unique-offsets`,
    (resolvedSourceCapacity + 1) * UINT32_BYTES
  );
  const exactUniqueEvidenceBuffer = createStorageBuffer(
    device,
    `${label}-exact-unique-evidence`,
    8 * UINT32_BYTES
  );
  const exactGatedDispatchBuffer = createStorageBuffer(
    device,
    `${label}-exact-gated-dispatch`,
    INDIRECT_DISPATCH_BYTES,
    GPU_BUFFER_USAGE.INDIRECT
  );
  const module = device.createShaderModule({ label: `${label}-shader`, code: sphSpatialGasCellEosGpuWgsl });
  const pipelines = {
    keys: createPipeline(device, module, `${label}-build-keys`, 'build_keys'),
    direct: createPipeline(device, module, `${label}-group-direct-prefix`, 'group_direct_prefix'),
    exactPrepare: createPipeline(
      device,
      module,
      `${label}-prepare-exact-prefix`,
      'prepare_exact_prefix'
    ),
    exactGroup: createPipeline(
      device,
      module,
      `${label}-group-exact-prefix`,
      'group_exact_prefix'
    ),
    prepare: createPipeline(device, module, `${label}-prepare-dispatch`, 'prepare_dispatch'),
    reduce: createPipeline(device, module, `${label}-reduce-cells`, 'reduce_cells'),
    finalize: createPipeline(device, module, `${label}-finalize-evidence`, 'finalize_evidence'),
    gradient: createPipeline(device, module, `${label}-compute-gradients`, 'compute_gradients')
  };
  const slots = Array.from({ length: OUTPUT_SLOT_COUNT }, (_, index) => ({
    index,
    leased: false,
    generation: 0,
    batchOrdinal: 0,
    commandEncoder: null,
    nextParamsSlot: 0,
    records: new Set(),
    latestRecord: null,
    submissionRecorded: false,
    cancelledBeforeSubmit: false,
    releaseScheduled: false,
    bindGroupCache: new Map(),
    bindGroupCreationCount: 0,
    bindGroupReuseCount: 0,
    rowsBuffer: createStorageBuffer(
      device,
      `${label}-pressure-cells-${index}`,
      resolvedGasCellCapacity * SPH_GAS_PRESSURE_CELL_ROW_FLOATS * FLOAT32_BYTES
    ),
    metadataBuffer: createStorageBuffer(device, `${label}-metadata-${index}`, SPH_GAS_CELL_EOS_METADATA_BYTES),
    lookupBuffer: createStorageBuffer(device, `${label}-lookup-${index}`, resolvedMaxGridCellCount * UINT32_BYTES),
    reductionDispatchBuffer: createStorageBuffer(
      device,
      `${label}-reduction-dispatch-${index}`,
      3 * UINT32_BYTES,
      GPU_BUFFER_USAGE.INDIRECT
    ),
    gradientDispatchBuffer: createStorageBuffer(
      device,
      `${label}-gradient-dispatch-${index}`,
      3 * UINT32_BYTES,
      GPU_BUFFER_USAGE.INDIRECT
    ),
    paramsBuffer: tagWebGpuBufferDevice(device.createBuffer({
      label: `${label}-params-${index}`,
      size: resolvedParamsSlotCount * paramsByteStride,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    }), device)
  }));
  const cachedSlotBindGroup = (
    slot,
    cacheKey,
    pipeline,
    bindLabel,
    entries,
    telemetry
  ) => {
    const cached = slot.bindGroupCache.get(cacheKey);
    const matches = cached
      && cached.pipeline === pipeline
      && cached.entries.length === entries.length
      && cached.entries.every((entry, index) => (
        entry[0] === entries[index][0]
        && entry[1] === entries[index][1]
        && entry[2] === entries[index][2]
        && entry[3] === entries[index][3]
      ));
    if (matches) {
      slot.bindGroupReuseCount += 1;
      telemetry.reused += 1;
      return cached.bindGroup;
    }
    const resolved = bindGroup(device, pipeline, bindLabel, entries);
    slot.bindGroupCache.set(cacheKey, {
      pipeline,
      entries: entries.map((entry) => [...entry]),
      bindGroup: resolved
    });
    slot.bindGroupCreationCount += 1;
    telemetry.created += 1;
    return resolved;
  };
  let nextGeneration = 1;
  let nextBatchOrdinal = 1;
  let nextConsumerLease = 1;
  let destroyed = false;
  let destroyRequested = false;

  function destroyBuffers() {
    if (destroyed) return;
    destroyed = true;
    sourceKeyBuffer.destroy?.();
    directSortedIndexBuffer.destroy?.();
    directUniqueKeyBuffer.destroy?.();
    directUniqueOffsetBuffer.destroy?.();
    directUniqueEvidenceBuffer.destroy?.();
    exactSortedIndexBufferA.destroy?.();
    exactSortedIndexBufferB.destroy?.();
    exactHistogramBuffer.destroy?.();
    exactUniqueKeyBuffer.destroy?.();
    exactUniqueOffsetBuffer.destroy?.();
    exactUniqueEvidenceBuffer.destroy?.();
    exactGatedDispatchBuffer.destroy?.();
    radix.destroy();
    for (const slot of slots) {
      slot.rowsBuffer.destroy?.();
      slot.metadataBuffer.destroy?.();
      slot.lookupBuffer.destroy?.();
      slot.reductionDispatchBuffer.destroy?.();
      slot.gradientDispatchBuffer.destroy?.();
      slot.paramsBuffer.destroy?.();
    }
  }

  function maybeDestroy() {
    if (destroyRequested && slots.every((slot) => !slot.leased)) destroyBuffers();
  }

  function releaseBatchSlot(slot) {
    if (!slot.leased) return false;
    for (const record of slot.records) {
      record.released = true;
      if (record.result) record.result.publicationStatus = 'retired-after-submit-fence';
    }
    slot.leased = false;
    slot.commandEncoder = null;
    slot.nextParamsSlot = 0;
    slot.records.clear();
    slot.latestRecord = null;
    slot.submissionRecorded = false;
    slot.cancelledBeforeSubmit = false;
    slot.releaseScheduled = false;
    maybeDestroy();
    return true;
  }

  function scheduleBatchSlotRelease(slot) {
    if (!slot.leased || slot.releaseScheduled || slot.records.size === 0) return;
    const records = [...slot.records];
    if (records.some((record) => !record.retirementRequested || record.consumers.size > 0)) return;
    if (slot.cancelledBeforeSubmit) {
      releaseBatchSlot(slot);
      return;
    }
    if (records.some((record) => !record.submissionRecorded)) return;
    slot.releaseScheduled = true;
    if (records.every((record) => record.queueCompletionStatus === 'queue-work-completed')) {
      releaseBatchSlot(slot);
      return;
    }
    deferSubmittedWorkCleanup(device, () => releaseBatchSlot(slot));
  }

  function encode(commandEncoder, {
    source,
    gpuResidentLaneLeaseIdentity = null,
    gridDims,
    boxDimsM,
    fallbackSupportVolumeM3 = 0,
    fallbackTemperatureK = DEFAULT_FALLBACK_TEMPERATURE_K,
    minVolumeM3 = DEFAULT_MIN_VOLUME_M3,
    timestampProfiler = null,
    timestampMetadata = {}
  } = {}) {
    if (destroyed || destroyRequested) return blockedResult('sph-spatial-gas-cell-eos-gpu-lane-destroyed');
    if (!commandEncoder?.beginComputePass || !commandEncoder?.clearBuffer) {
      throw new TypeError('SPH spatial gas-cell EOS encode requires a GPUCommandEncoder-like object');
    }
    if (!source?.ready) return blockedResult(source?.blocker || 'spatial-gas-source-not-ready');
    if (requireLaneIdentity && !webGpuBufferDevice(source.sourceBuffer)) {
      return blockedResult('spatial-gas-source-device-provenance-required');
    }
    if (!webGpuBufferMatchesDevice(source.sourceBuffer, device)) {
      return blockedResult('spatial-gas-source-device-mismatch', {
        sourceDeviceId: source.sourceBuffer ? webGpuDeviceId(source.sourceBuffer.__peercomputeUlgWebGpuDevice) : null,
        consumerDeviceId: webGpuDeviceId(device)
      });
    }
    const exactPrefixAuthority = source.exactPrefixAuthorityReady === true
      ? source.exactPrefixAuthority
      : null;
    if (source.exactPrefixAuthorityRequested && !exactPrefixAuthority) {
      return blockedResult(
        source.blocker || 'resident-product-event-exact-prefix-authority-not-ready'
      );
    }
    if (exactPrefixAuthority && (
      !webGpuBufferMatchesDevice(exactPrefixAuthority.metadataBuffer, device)
      || !webGpuBufferMatchesDevice(exactPrefixAuthority.dispatchIndirectBuffer, device)
    )) {
      return blockedResult('resident-product-event-exact-prefix-authority-device-mismatch');
    }
    if (source.sourceRowCount > resolvedSourceCapacity) {
      return blockedResult('spatial-gas-source-capacity-exceeded', {
        sourceRowCount: source.sourceRowCount,
        sourceCapacity: resolvedSourceCapacity
      });
    }
    const laneIdentity = validateLaneIdentity(gpuResidentLaneLeaseIdentity, {
      required: requireLaneIdentity,
      laneId,
      stateKey,
      sourceFamily
    });
    if (!laneIdentity.ready) return blockedResult(laneIdentity.reason);
    let plan;
    try {
      plan = createSphSpatialGasCellEosGpuPlan({
        sourceRowCount: source.sourceRowCount,
        sourceRowStrideFloats: source.sourceRowStrideFloats,
        sourceKind: source.sourceKindId,
        sourceCapacity: resolvedSourceCapacity,
        gasCellCapacity: resolvedGasCellCapacity,
        maxGridCellCount: resolvedMaxGridCellCount,
        gridDims,
        boxDimsM,
        maxComputeWorkgroupsPerDimension: maxDispatch
      });
    } catch (error) {
      return blockedResult(error?.message || String(error));
    }
    let slot = slots.find((candidate) => candidate.leased
      && candidate.commandEncoder === commandEncoder
      && !candidate.submissionRecorded
      && !candidate.cancelledBeforeSubmit);
    const batchSlotReused = Boolean(slot);
    if (slot) {
      if (slot.nextParamsSlot >= resolvedParamsSlotCount) {
        return blockedResult('sph-spatial-gas-cell-eos-params-slot-capacity-exhausted', {
          batchSlotIndex: slot.index,
          paramsSlotCount: resolvedParamsSlotCount
        });
      }
      if (!slot.latestRecord || slot.latestRecord.consumers.size === 0) {
        return blockedResult('sph-spatial-gas-cell-eos-command-ordered-consumer-required', {
          batchSlotIndex: slot.index,
          priorGeneration: slot.latestRecord?.generation ?? null
        });
      }
      slot.latestRecord.superseded = true;
      if (slot.latestRecord.result) {
        slot.latestRecord.result.publicationStatus =
          'superseded-after-command-ordered-consumer-lease';
      }
    } else {
      slot = slots.find((candidate) => !candidate.leased);
      if (!slot) {
        return blockedResult('sph-spatial-gas-cell-eos-batch-slot-capacity-exhausted', {
          batchSlotCount: OUTPUT_SLOT_COUNT,
          liveBatchCount: slots.filter((candidate) => candidate.leased).length
        });
      }
      slot.leased = true;
      slot.batchOrdinal = nextBatchOrdinal++;
      slot.commandEncoder = commandEncoder;
      slot.nextParamsSlot = 0;
      slot.records.clear();
      slot.latestRecord = null;
      slot.submissionRecorded = false;
      slot.cancelledBeforeSubmit = false;
      slot.releaseScheduled = false;
    }
    const generation = nextGeneration++;
    slot.generation = generation;
    const paramsSlotIndex = slot.nextParamsSlot++;
    const paramsByteOffset = paramsSlotIndex * paramsByteStride;
    const consumers = new Map();
    const record = {
      generation,
      consumers,
      retirementRequested: false,
      cancelledBeforeSubmit: false,
      submissionRecorded: false,
      transientCleanupScheduled: false,
      superseded: false,
      released: false,
      queueCompletionStatus: 'encoded-awaiting-caller-submit',
      cleanupTransients: null,
      result: null
    };
    slot.records.add(record);
    slot.latestRecord = record;
    const params = paramsArray(plan, {
      generation,
      laneHash: laneIdentity.laneHash,
      sourceEpoch: source.sourceEpoch,
      sourceGeneration: source.sourceGeneration,
      fallbackSupportVolumeM3: Math.max(0, Number(fallbackSupportVolumeM3) || 0),
      fallbackTemperatureK: finitePositive(fallbackTemperatureK, DEFAULT_FALLBACK_TEMPERATURE_K),
      minVolumeM3: finitePositive(minVolumeM3, DEFAULT_MIN_VOLUME_M3),
      exactPrefixAuthority
    });
    device.queue.writeBuffer(slot.paramsBuffer, paramsByteOffset, params);
    commandEncoder.clearBuffer(slot.rowsBuffer);
    commandEncoder.clearBuffer(slot.metadataBuffer);
    commandEncoder.clearBuffer(slot.lookupBuffer);
    commandEncoder.clearBuffer(slot.reductionDispatchBuffer);
    commandEncoder.clearBuffer(slot.gradientDispatchBuffer);
    if (exactPrefixAuthority && exactLinearRadixSupported) {
      commandEncoder.clearBuffer(exactGatedDispatchBuffer);
    }
    const stageMetadata = (sphGasCellEosStage) => ({
      ...timestampMetadata,
      sphGasCellEosStage,
      generation,
      sourceEpoch: source.sourceEpoch,
      sourceGeneration: source.sourceGeneration
    });
    const bindGroupTelemetry = { created: 0, reused: 0 };
    const bindGroupForStage = (stage, pipeline, entries) => cachedSlotBindGroup(
      slot,
      `${paramsSlotIndex}:${stage}`,
      pipeline,
      `${label}-${stage}-bind-${generation}`,
      entries,
      bindGroupTelemetry
    );

    const exactPrefix = Boolean(exactPrefixAuthority && exactLinearRadixSupported);
    const directPrefix = !exactPrefix && plan.sourceRowCount <= directSourceCapacity;
    const timestampActive = timestampProfiler?.active === true;
    let unique;
    let radixEncoding = null;
    let pass;
    let encodedDispatchCount = 0;
    let encodedComputePassCount = 0;
    let gpuGatedIndirectDispatchCount = 0;
    if (exactPrefix) {
      const authorityMetadata = exactPrefixAuthority.metadataBuffer;
      const authorityDispatch = exactPrefixAuthority.dispatchIndirectBuffer;
      unique = {
        sortedIndicesBuffer: exactSortedIndexBufferA,
        uniqueKeysBuffer: exactUniqueKeyBuffer,
        uniqueOffsetsBuffer: exactUniqueOffsetBuffer,
        uniqueEvidenceBuffer: exactUniqueEvidenceBuffer
      };
      const prepareExactBindGroup = bindGroupForStage(
        'exact-prepare',
        pipelines.exactPrepare,
        [
          [0, authorityMetadata], [1, authorityDispatch], [2, slot.metadataBuffer],
          [3, exactGatedDispatchBuffer], [4, exactUniqueEvidenceBuffer],
          [5, slot.paramsBuffer, paramsByteOffset, PARAMS_BYTE_LENGTH]
        ]
      );
      pass = commandEncoder.beginComputePass(timestampPassDescriptor(
        timestampProfiler,
        SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.exactPrepare,
        stageMetadata('exact-authority-prepare')
      ));
      pass.setPipeline(pipelines.exactPrepare);
      pass.setBindGroup(0, prepareExactBindGroup);
      pass.dispatchWorkgroups(1);
      pass.end();

      const exactGroupBindGroup = bindGroupForStage(
        'exact-group',
        pipelines.exactGroup,
        [
          [0, source.sourceBuffer], [1, sourceKeyBuffer],
          [2, exactSortedIndexBufferA], [3, exactSortedIndexBufferB],
          [4, exactHistogramBuffer], [5, exactUniqueKeyBuffer],
          [6, exactUniqueOffsetBuffer], [7, exactUniqueEvidenceBuffer],
          [8, slot.paramsBuffer, paramsByteOffset, PARAMS_BYTE_LENGTH]
        ]
      );
      pass = commandEncoder.beginComputePass(timestampActive
        ? timestampPassDescriptor(
            timestampProfiler,
            SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.exactGroup,
            stageMetadata('gpu-exact-stable-counting-radix')
          )
        : { label: `${label}-exact-prefix-and-dispatch-prepare` });
      pass.setPipeline(pipelines.exactGroup);
      pass.setBindGroup(0, exactGroupBindGroup);
      pass.dispatchWorkgroupsIndirect(exactGatedDispatchBuffer, 0);
      if (timestampActive) pass.end();
      gpuGatedIndirectDispatchCount = 3;
    } else if (directPrefix) {
      unique = {
        sortedIndicesBuffer: directSortedIndexBuffer,
        uniqueKeysBuffer: directUniqueKeyBuffer,
        uniqueOffsetsBuffer: directUniqueOffsetBuffer,
        uniqueEvidenceBuffer: directUniqueEvidenceBuffer
      };
      pass = commandEncoder.beginComputePass(timestampActive
        ? timestampPassDescriptor(
            timestampProfiler,
            SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.directGroup,
            stageMetadata('direct-key-sort-unique')
          )
        : { label: `${label}-direct-prefix-and-dispatch-prepare` });
      pass.setPipeline(pipelines.direct);
      pass.setBindGroup(0, bindGroupForStage('direct-group', pipelines.direct, [
        [0, source.sourceBuffer], [1, sourceKeyBuffer], [2, directSortedIndexBuffer],
        [3, directUniqueKeyBuffer], [4, directUniqueOffsetBuffer],
        [5, directUniqueEvidenceBuffer], [6, slot.metadataBuffer],
        [7, slot.paramsBuffer, paramsByteOffset, PARAMS_BYTE_LENGTH]
      ]));
      pass.dispatchWorkgroups(1);
      if (timestampActive) pass.end();
    } else {
      pass = commandEncoder.beginComputePass(timestampPassDescriptor(
        timestampProfiler,
        SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.keyBuild,
        stageMetadata('key-build')
      ));
      pass.setPipeline(pipelines.keys);
      pass.setBindGroup(0, bindGroupForStage('build-keys', pipelines.keys, [
        [0, source.sourceBuffer], [1, sourceKeyBuffer], [2, slot.metadataBuffer],
        [3, slot.paramsBuffer, paramsByteOffset, PARAMS_BYTE_LENGTH],
        [4, exactPrefixAuthority?.metadataBuffer ?? slot.metadataBuffer],
        [5, exactPrefixAuthority?.dispatchIndirectBuffer ?? slot.reductionDispatchBuffer]
      ]));
      pass.dispatchWorkgroups(...plan.sourceDispatch);
      pass.end();

      radixEncoding = radix.encodeSortUnique(commandEncoder, {
        keyBuffer: sourceKeyBuffer,
        elementCount: plan.sourceRowCount,
        keyWordCount: 1,
        keyStrideWords: 1,
        generationId: generation,
        consumerWorkgroupSize: 1,
        timestampProfiler,
        timestampMetadata: stageMetadata('radix')
      });
      unique = radixEncoding;
    }
    {
      const prepareBindGroup = bindGroupForStage('prepare', pipelines.prepare, [
        [0, unique.uniqueEvidenceBuffer], [1, slot.metadataBuffer],
        [2, slot.reductionDispatchBuffer], [3, slot.gradientDispatchBuffer],
        [4, slot.paramsBuffer, paramsByteOffset, PARAMS_BYTE_LENGTH]
      ]);
      if (timestampActive || (!directPrefix && !exactPrefix)) {
        pass = commandEncoder.beginComputePass(timestampPassDescriptor(
          timestampProfiler,
          SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.dispatchPrepare,
          stageMetadata('dispatch-prepare')
        ));
      }
      pass.setPipeline(pipelines.prepare);
      pass.setBindGroup(0, prepareBindGroup);
      pass.dispatchWorkgroups(1);
      pass.end();

      const reduceBindGroup = bindGroupForStage('reduce', pipelines.reduce, [
        [0, source.sourceBuffer], [1, unique.sortedIndicesBuffer], [2, unique.uniqueKeysBuffer],
        [3, unique.uniqueOffsetsBuffer], [4, slot.rowsBuffer], [5, slot.lookupBuffer],
        [6, slot.metadataBuffer], [7, slot.paramsBuffer, paramsByteOffset, PARAMS_BYTE_LENGTH]
      ]);
      const finalizeBindGroup = bindGroupForStage('finalize', pipelines.finalize, [
        [0, slot.metadataBuffer], [1, unique.uniqueEvidenceBuffer],
        [2, slot.paramsBuffer, paramsByteOffset, PARAMS_BYTE_LENGTH]
      ]);
      const gradientBindGroup = bindGroupForStage('gradient', pipelines.gradient, [
        [0, slot.rowsBuffer], [1, slot.lookupBuffer], [2, slot.metadataBuffer],
        [3, slot.paramsBuffer, paramsByteOffset, PARAMS_BYTE_LENGTH]
      ]);
      const groupedConsumerPass = timestampActive
        ? null
        : commandEncoder.beginComputePass({ label: `${label}-grouped-reduce-finalize-gradient` });
      pass = groupedConsumerPass || commandEncoder.beginComputePass(timestampPassDescriptor(
        timestampProfiler,
        SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.cellReduce,
        stageMetadata('cell-reduce')
      ));
      pass.setPipeline(pipelines.reduce);
      pass.setBindGroup(0, reduceBindGroup);
      pass.dispatchWorkgroupsIndirect(slot.reductionDispatchBuffer, 0);
      if (!groupedConsumerPass) pass.end();

      pass = groupedConsumerPass || commandEncoder.beginComputePass(timestampPassDescriptor(
        timestampProfiler,
        SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.finalize,
        stageMetadata('finalize')
      ));
      pass.setPipeline(pipelines.finalize);
      pass.setBindGroup(0, finalizeBindGroup);
      pass.dispatchWorkgroups(1);
      if (!groupedConsumerPass) pass.end();

      pass = groupedConsumerPass || commandEncoder.beginComputePass(timestampPassDescriptor(
        timestampProfiler,
        SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.gradient,
        stageMetadata('gradient')
      ));
      pass.setPipeline(pipelines.gradient);
      pass.setBindGroup(0, gradientBindGroup);
      pass.dispatchWorkgroupsIndirect(slot.gradientDispatchBuffer, 0);
      pass.end();
      encodedDispatchCount = exactPrefix
        ? 6
        : (directPrefix
            ? 5
            : 5 + Math.max(0, Number(radixEncoding?.encodedDispatchCount) || 0));
      encodedComputePassCount = exactPrefix
        ? (timestampActive ? 6 : 3)
        : (directPrefix
            ? (timestampActive ? 5 : 2)
            : (timestampActive
                ? 5 + Math.max(0, Number(radixEncoding?.encodedComputePassCount) || 0)
                : 3 + Math.max(0, Number(radixEncoding?.encodedComputePassCount) || 0)));
      if (!exactPrefix) gpuGatedIndirectDispatchCount = 2;
    }

    const cleanupTransients = () => {
      if (record.transientCleanupScheduled) return;
      record.transientCleanupScheduled = true;
      if (radixEncoding) radix.releaseTransientBuffers(radixEncoding);
    };
    record.cleanupTransients = cleanupTransients;
    const result = {
      schema: ULG_SPH_SPATIAL_GAS_CELL_EOS_GPU_RESULT_SCHEMA,
      status: 'sph-spatial-gas-cell-eos-gpu-encoded',
      ready: true,
      backend: 'webgpu',
      generation,
      batchSlotIndex: slot.index,
      batchOrdinal: slot.batchOrdinal,
      batchSlotReused,
      batchSlotCount: OUTPUT_SLOT_COUNT,
      paramsSlotIndex,
      paramsSlotCount: resolvedParamsSlotCount,
      paramsByteOffset,
      paramsByteStride,
      aggregationStrategy: exactPrefix
        ? 'gpu-exact-stable-counting-radix'
        : (directPrefix
            ? 'deterministic-direct-key-sort-unique'
            : 'stable-radix-sort-unique'),
      directSourceLimit: directSourceCapacity,
      directPrefix,
      exactPrefix,
      exactPrefixAuthorityUsed: exactPrefix,
      exactPrefixAuthorityAvailable: Boolean(exactPrefixAuthority),
      exactPrefixAuthorityFallbackReason: exactPrefixAuthority && !exactPrefix
        ? 'geometric-source-capacity-class-exceeds-fixed-command-bound'
        : null,
      exactPrefixLinearRadixCapacityLimit:
        SPH_GAS_CELL_EOS_EXACT_LINEAR_RADIX_MAX_SOURCE_CAPACITY,
      exactPrefixStaticSourceCapacityBound: resolvedSourceCapacity,
      exactPrefixStaticOperationBound: exactPrefix
        ? resolvedSourceCapacity * 10 + 2_048
        : 0,
      exactPrefixCostModel:
        'admit-when-geometric-source-capacity-class-at-most-65536-rows',
      exactSourceRowCount: null,
      exactSourceRowCountAuthority: exactPrefixAuthority?.exactCountAuthority ?? null,
      exactSourceRowCountMetadataBuffer: exactPrefixAuthority?.metadataBuffer ?? null,
      exactSourceRowCountMetadataWord:
        exactPrefixAuthority?.activeRowCountMetadataWord ?? null,
      exactSourceDispatchIndirectBuffer:
        exactPrefixAuthority?.dispatchIndirectBuffer ?? null,
      exactPrefixGatedDispatchBuffer: exactPrefix ? exactGatedDispatchBuffer : null,
      gpuGatedIndirectDispatchCount,
      gpuGatedExecutedWorkgroupCount: null,
      gpuGatedExecutedWorkgroupCountAuthority: exactPrefix
        ? 'resident-product-event-arena-exact-count-and-derived-gas-metadata'
        : 'gas-cell-eos-derived-indirect-dispatch',
      encodedButGpuGatedDispatchCount: gpuGatedIndirectDispatchCount,
      radixBypassed: exactPrefix || directPrefix,
      encodedDispatchCount,
      encodedComputePassCount,
      bindGroupCreationCount: bindGroupTelemetry.created,
      bindGroupReuseCount: bindGroupTelemetry.reused,
      primitiveBindGroupCreationCount:
        Math.max(0, Number(radixEncoding?.bindGroupCreationCount) || 0),
      primitiveBindGroupReuseCount:
        Math.max(0, Number(radixEncoding?.bindGroupReuseCount) || 0),
      totalEncodedBindGroupCreationCount: bindGroupTelemetry.created
        + Math.max(0, Number(radixEncoding?.bindGroupCreationCount) || 0),
      bindGroupCacheEntryCount: slot.bindGroupCache.size,
      laneBindGroupCreationCount: slot.bindGroupCreationCount,
      laneBindGroupReuseCount: slot.bindGroupReuseCount,
      outputReusePolicy: 'same-command-encoder-ordered-substeps',
      publicationStatus: 'active-batch-final-generation',
      deviceId: webGpuDeviceId(device),
      gpuResidentLaneLeaseIdentity: laneIdentity.identity,
      laneIdentityHashLow: laneIdentity.laneHash[0],
      laneIdentityHashHigh: laneIdentity.laneHash[1],
      source,
      sourceSchema: source.schema,
      sourceKind: source.sourceKind,
      sourceTaskId: source.sourceTaskId,
      sourceEpoch: source.sourceEpoch,
      sourceGeneration: source.sourceGeneration,
      sourceRowCount: plan.sourceRowCount,
      sourceRowCountUpperBound: plan.sourceRowCount,
      sourceRowCountIsExact: !exactPrefixAuthority,
      sourceRowStrideFloats: plan.sourceRowStrideFloats,
      sourceRowByteLength: plan.sourceRowByteLength,
      sourceCapacity: plan.sourceCapacity,
      gasPressureCellsBuffer: slot.rowsBuffer,
      gasPressureCellMetadataBuffer: slot.metadataBuffer,
      gasPressureCellLookupBuffer: slot.lookupBuffer,
      gasPressureCellReductionDispatchBuffer: slot.reductionDispatchBuffer,
      gasPressureCellGradientDispatchBuffer: slot.gradientDispatchBuffer,
      pressureInterfaceGasPressureCellRowCount: 0,
      pressureInterfaceGasPressureCellRowCountSource: `gasPressureCellMetadataBuffer[${SPH_GAS_CELL_EOS_METADATA.admittedActiveCellCount}]`,
      pressureInterfaceGasPressureCellRowCapacity: plan.gasCellCapacity,
      pressureInterfaceGasPressureCellRowStrideFloats: SPH_GAS_PRESSURE_CELL_ROW_FLOATS,
      pressureInterfaceGasPressureCellRowsBufferByteLength: plan.gasPressureCellRowsBufferByteLength,
      pressureInterfaceGasPressureCellRowsBufferRetained: true,
      pressureInterfaceGasPressureCellMetadataBufferRetained: true,
      pressureInterfaceGasPressureCellLookupBufferRetained: true,
      pressureInterfaceGasPressureCellMetadataLayout: { ...SPH_GAS_CELL_EOS_METADATA },
      pressureInterfaceGasPressureCellMetadataWordCount: SPH_GAS_CELL_EOS_METADATA_WORDS,
      pressureInterfaceGasPressureCellStatusReadyCode: SPH_GAS_CELL_EOS_GPU_STATUS.ready,
      gridDims: [...plan.gridDims],
      gridCellCount: plan.gridCellCount,
      maxGridCellCount: plan.maxGridCellCount,
      boxDimsM: [...plan.boxDimsM],
      retainedGasPressureBufferRefs: [
        'resident-gas-pressure-cells-buffer',
        'resident-gas-pressure-cell-metadata-buffer',
        'resident-gas-pressure-cell-lookup-buffer'
      ],
      workerRetainedGasPressureBufferRefs: [],
      retainedGasCellFieldSource: {
        schema: ULG_PRESSURE_INTERFACE_GPU_GAS_CELL_FIELD_SOURCE_SCHEMA,
        status: 'pressure-interface-gpu-gas-cell-field-source-encoded',
        generation,
        deviceId: webGpuDeviceId(device),
        sourceTaskId: source.sourceTaskId,
        sourceEpoch: source.sourceEpoch,
        sourceGeneration: source.sourceGeneration,
        sourceKind: source.sourceKind,
        laneId: laneIdentity.identity?.laneId || null,
        stateKey: laneIdentity.identity?.stateKey || null,
        sourceFamily: laneIdentity.identity?.sourceFamily || null,
        gasPressureCellsBuffer: slot.rowsBuffer,
        gasPressureCellMetadataBuffer: slot.metadataBuffer,
        gasPressureCellLookupBuffer: slot.lookupBuffer,
        gasPressureCellRowCapacity: plan.gasCellCapacity,
        gasPressureCellRowStrideFloats: SPH_GAS_PRESSURE_CELL_ROW_FLOATS,
        metadataLayout: { ...SPH_GAS_CELL_EOS_METADATA },
        gridDims: [...plan.gridDims],
        gridCellCount: plan.gridCellCount,
        boxDimsM: [...plan.boxDimsM],
        retainedGasPressureBufferRefs: [
          'resident-gas-pressure-cells-buffer',
          'resident-gas-pressure-cell-metadata-buffer',
          'resident-gas-pressure-cell-lookup-buffer'
        ],
        consumerAccessProtocol: 'same-device-gpu-metadata-guarded-cell-lookup',
        stateManagerAdmissionRequired: true
      },
      gpuEvidence: {
        schema: ULG_SPH_SPATIAL_GAS_CELL_EOS_GPU_EVIDENCE_SCHEMA,
        status: 'gpu-evidence-buffer-encoded-awaiting-submit',
        generation,
        metadataBuffer: slot.metadataBuffer,
        metadataWordCount: SPH_GAS_CELL_EOS_METADATA_WORDS,
        metadataLayout: { ...SPH_GAS_CELL_EOS_METADATA },
        failCloseProtocol: 'metadata-status-ready-and-zero-overflow-required-by-consumer',
        expectedMagic: SPH_GAS_CELL_EOS_MAGIC,
        expectedVersion: SPH_GAS_CELL_EOS_VERSION,
        expectedLaneHashLow: laneIdentity.laneHash[0],
        expectedLaneHashHigh: laneIdentity.laneHash[1],
        expectedSourceEpoch: source.sourceEpoch,
        expectedSourceGeneration: source.sourceGeneration,
        fullReadbackPerformed: false,
        mapAsyncCalled: false
      },
      normalHotLoopReadbackFree: true,
      fullReadbackPerformed: false,
      mapAsyncCalled: false,
      cpuDecodePerformed: false,
      cpuGasCellRowsUploaded: false,
      gpuTimestampRequested: timestampProfiler?.capability?.requested === true
        || timestampProfiler?.active === true,
      gpuTimestampStatus: timestampProfiler
        ? 'shared-profiler-deferred'
        : 'not-requested',
      callerOwnedEncoder: true,
      queueCompletionStatus: 'encoded-awaiting-caller-submit',
      queueCompletionMethod: 'caller-owned-command-encoder',
      addConsumerLease({ consumerStage = 'pressureInterface', reason = null } = {}) {
        if (record.retirementRequested || record.cancelledBeforeSubmit || record.superseded
          || record.released || slot.cancelledBeforeSubmit || slot.releaseScheduled) {
          return {
            accepted: false,
            leaseId: null,
            status: 'gas-cell-eos-consumer-lease-rejected-generation-retiring',
            reason: 'gas-cell-eos-generation-retiring'
          };
        }
        const leaseId = `${label}:generation:${generation}:consumer:${nextConsumerLease++}`;
        consumers.set(leaseId, { leaseId, consumerStage, reason });
        return leaseId;
      },
      releaseConsumerLease(leaseId) {
        const released = consumers.delete(leaseId);
        scheduleBatchSlotRelease(slot);
        return released;
      },
      markSubmitted({ queueCompletionStatus = 'queue-submitted', queueCompletionMethod = 'queue.submit' } = {}) {
        if (record.cancelledBeforeSubmit || record.released || slot.cancelledBeforeSubmit) return false;
        if (!record.submissionRecorded) {
          record.submissionRecorded = true;
          slot.submissionRecorded = true;
          deferSubmittedWorkCleanup(device, cleanupTransients);
        }
        record.queueCompletionStatus = queueCompletionStatus;
        result.queueCompletionStatus = queueCompletionStatus;
        result.queueCompletionMethod = queueCompletionMethod;
        result.gpuEvidence.status = queueCompletionStatus === 'queue-work-completed'
          ? 'gpu-evidence-buffer-submitted-and-fenced'
          : 'gpu-evidence-buffer-submitted';
        scheduleBatchSlotRelease(slot);
        return result;
      },
      cancelBeforeSubmit({ reason = 'gas-cell-eos-consumer-sequence-aborted-before-submit' } = {}) {
        if (slot.submissionRecorded || slot.releaseScheduled || slot.cancelledBeforeSubmit
          || record.released) return false;
        slot.cancelledBeforeSubmit = true;
        for (const batchRecord of slot.records) {
          batchRecord.retirementRequested = true;
          batchRecord.cancelledBeforeSubmit = true;
          batchRecord.queueCompletionStatus = 'cancelled-before-submit';
          if (batchRecord.result) {
            batchRecord.result.retirementReason = reason;
            batchRecord.result.queueCompletionStatus = 'cancelled-before-submit';
            batchRecord.result.queueCompletionMethod = 'caller-cancelled-command-encoding';
            batchRecord.result.status = 'sph-spatial-gas-cell-eos-gpu-cancelled-before-submit';
            batchRecord.result.publicationStatus = 'cancelled-before-submit';
          }
          batchRecord.cleanupTransients?.();
        }
        scheduleBatchSlotRelease(slot);
        return true;
      },
      abort(options = {}) {
        return result.cancelBeforeSubmit(options);
      },
      retire({ reason = 'replaced-gas-cell-eos-generation' } = {}) {
        if (record.released) return true;
        record.retirementRequested = true;
        result.retirementReason = reason;
        scheduleBatchSlotRelease(slot);
        return consumers.size === 0;
      },
      destroyGasPressureCellsBuffer() {
        return result.retire({ reason: 'explicit-gas-cell-eos-result-destroy' });
      }
    };
    record.result = result;
    return result;
  }

  return {
    schema: ULG_SPH_SPATIAL_GAS_CELL_EOS_GPU_LANE_SCHEMA,
    status: 'sph-spatial-gas-cell-eos-gpu-lane-ready',
    device,
    deviceId: webGpuDeviceId(device),
    sourceCapacity: resolvedSourceCapacity,
    sourceCapacityClass: resolvedSourceCapacity,
    gasCellCapacity: resolvedGasCellCapacity,
    gasCellCapacityClass: resolvedGasCellCapacity,
    maxGridCellCount: resolvedMaxGridCellCount,
    maxGridCellCountClass: resolvedMaxGridCellCount,
    maxComputeWorkgroupsPerDimension: maxDispatch,
    exactLinearRadixSupported,
    exactLinearRadixCapacityLimit:
      SPH_GAS_CELL_EOS_EXACT_LINEAR_RADIX_MAX_SOURCE_CAPACITY,
    outputSlotCount: OUTPUT_SLOT_COUNT,
    batchSlotCount: OUTPUT_SLOT_COUNT,
    paramsSlotCount: resolvedParamsSlotCount,
    paramsByteStride,
    requireLaneIdentity,
    laneId,
    stateKey,
    sourceFamily,
    encode,
    allocationEntries() {
      return [
        { role: 'source-keys', buffer: sourceKeyBuffer },
        { role: 'direct-sorted-indices', buffer: directSortedIndexBuffer },
        { role: 'direct-unique-keys', buffer: directUniqueKeyBuffer },
        { role: 'direct-unique-offsets', buffer: directUniqueOffsetBuffer },
        { role: 'direct-unique-evidence', buffer: directUniqueEvidenceBuffer },
        { role: 'exact-sorted-indices-a', buffer: exactSortedIndexBufferA },
        { role: 'exact-sorted-indices-b', buffer: exactSortedIndexBufferB },
        { role: 'exact-histogram', buffer: exactHistogramBuffer },
        { role: 'exact-unique-keys', buffer: exactUniqueKeyBuffer },
        { role: 'exact-unique-offsets', buffer: exactUniqueOffsetBuffer },
        { role: 'exact-unique-evidence', buffer: exactUniqueEvidenceBuffer },
        { role: 'exact-gated-dispatch', buffer: exactGatedDispatchBuffer },
        ...radix.allocationEntries(),
        ...slots.flatMap((slot) => [
          { role: `gas-pressure-cells-${slot.index}`, buffer: slot.rowsBuffer },
          { role: `gas-pressure-metadata-${slot.index}`, buffer: slot.metadataBuffer },
          { role: `gas-pressure-lookup-${slot.index}`, buffer: slot.lookupBuffer },
          { role: `gas-pressure-reduction-dispatch-${slot.index}`, buffer: slot.reductionDispatchBuffer },
          { role: `gas-pressure-gradient-dispatch-${slot.index}`, buffer: slot.gradientDispatchBuffer },
          { role: `gas-pressure-params-${slot.index}`, buffer: slot.paramsBuffer }
        ])
      ];
    },
    liveGenerationCount() {
      return slots.reduce((count, slot) => count + (slot.leased ? slot.records.size : 0), 0);
    },
    liveBatchCount() {
      return slots.filter((slot) => slot.leased).length;
    },
    isDestroyed() {
      return destroyed;
    },
    destroy() {
      destroyRequested = true;
      maybeDestroy();
    }
  };
}

function cachedLaneKey({
  sourceCapacity,
  gasCellCapacity,
  maxGridCellCount,
  requireLaneIdentity,
  laneId,
  stateKey,
  sourceFamily,
  paramsSlotCount,
  maxComputeWorkgroupsPerDimension
}) {
  return JSON.stringify([
    sourceCapacity,
    gasCellCapacity,
    maxGridCellCount,
    requireLaneIdentity === true,
    laneId || null,
    stateKey || null,
    sourceFamily || null,
    paramsSlotCount || DEFAULT_PARAMS_SLOT_COUNT,
    maxComputeWorkgroupsPerDimension
  ]);
}

export function getOrCreateSphSpatialGasCellEosGpuLane(device, options = {}) {
  assertDevice(device);
  const requestedSourceCapacity = positiveInteger(options.sourceCapacity, 'sourceCapacity');
  const requestedGasCellCapacity = positiveInteger(
    options.gasCellCapacity ?? (requestedSourceCapacity + 1),
    'gasCellCapacity'
  );
  const requestedMaxGridCellCount = positiveInteger(
    options.maxGridCellCount ?? requestedSourceCapacity,
    'maxGridCellCount'
  );
  const resolvedMaxComputeWorkgroupsPerDimension = positiveInteger(
    options.maxComputeWorkgroupsPerDimension
      ?? device.limits?.maxComputeWorkgroupsPerDimension
      ?? 65535,
    'maxComputeWorkgroupsPerDimension'
  );
  const normalized = {
    ...options,
    sourceCapacity: sphGasCellEosGeometricCapacityClass(requestedSourceCapacity, {
      floor: SPH_GAS_CELL_EOS_SOURCE_CAPACITY_CLASS_FLOOR
    }),
    gasCellCapacity: sphGasCellEosGeometricCapacityClass(requestedGasCellCapacity),
    maxGridCellCount: sphGasCellEosGeometricCapacityClass(requestedMaxGridCellCount),
    maxComputeWorkgroupsPerDimension: resolvedMaxComputeWorkgroupsPerDimension,
    requireLaneIdentity: options.requireLaneIdentity !== false,
    outputSlotCount: OUTPUT_SLOT_COUNT,
    paramsSlotCount: positiveInteger(
      options.paramsSlotCount ?? options.outputSlotCount ?? DEFAULT_PARAMS_SLOT_COUNT,
      'paramsSlotCount'
    )
  };
  const key = cachedLaneKey(normalized);
  let cache = CACHED_LANES_BY_DEVICE.get(device);
  if (!cache) {
    cache = new Map();
    CACHED_LANES_BY_DEVICE.set(device, cache);
  }
  const existing = cache.get(key);
  if (existing && !existing.isDestroyed()) {
    existing.cacheStatus = 'gpu-gas-cell-eos-lane-cache-hit';
    existing.cacheRequest = {
      requestedSourceCapacity,
      requestedGasCellCapacity,
      requestedMaxGridCellCount,
      sourceCapacityClass: normalized.sourceCapacity,
      gasCellCapacityClass: normalized.gasCellCapacity,
      maxGridCellCountClass: normalized.maxGridCellCount,
      maxComputeWorkgroupsPerDimension: resolvedMaxComputeWorkgroupsPerDimension,
      compatibleCapacityClassReused: true
    };
    return existing;
  }
  if (existing) cache.delete(key);
  if (cache.size >= MAX_CACHED_LANES_PER_DEVICE) {
    const reusable = [...cache.entries()].find(([, lane]) => lane.liveGenerationCount() === 0);
    if (!reusable) {
      throw new Error('GPU gas-cell EOS lane cache is full with live retained generations');
    }
    reusable[1].destroy();
    cache.delete(reusable[0]);
  }
  const lane = createSphSpatialGasCellEosGpuLane(device, normalized);
  lane.cacheKey = key;
  lane.cacheStatus = 'gpu-gas-cell-eos-lane-cache-miss-created';
  lane.cacheRequest = {
    requestedSourceCapacity,
    requestedGasCellCapacity,
    requestedMaxGridCellCount,
    sourceCapacityClass: normalized.sourceCapacity,
    gasCellCapacityClass: normalized.gasCellCapacity,
    maxGridCellCountClass: normalized.maxGridCellCount,
    maxComputeWorkgroupsPerDimension: resolvedMaxComputeWorkgroupsPerDimension,
    compatibleCapacityClassReused: false
  };
  cache.set(key, lane);
  return lane;
}

export function destroyCachedSphSpatialGasCellEosGpuLanes(device) {
  const cache = CACHED_LANES_BY_DEVICE.get(device);
  if (!cache) return 0;
  let count = 0;
  for (const lane of cache.values()) {
    lane.destroy();
    count += 1;
  }
  cache.clear();
  CACHED_LANES_BY_DEVICE.delete(device);
  return count;
}

export async function runSphSpatialGasCellEosGpu({
  device,
  lane = null,
  commandEncoder = null,
  source = null,
  gpuResidentLaneLeaseIdentity = null,
  gridDims,
  boxDimsM,
  sourceCapacity = null,
  gasCellCapacity = null,
  maxGridCellCount = null,
  fallbackSupportVolumeM3 = 0,
  fallbackTemperatureK = DEFAULT_FALLBACK_TEMPERATURE_K,
  minVolumeM3 = DEFAULT_MIN_VOLUME_M3,
  requireLaneIdentity = true,
  laneId = null,
  stateKey = null,
  sourceFamily = null,
  outputSlotCount = OUTPUT_SLOT_COUNT,
  paramsSlotCount = null,
  awaitQueueFence = true,
  measureGpuTimestamps = false,
  timestampProfiler: sharedTimestampProfiler = null,
  timestampMetadata = {},
  ...sourceOptions
} = {}) {
  assertDevice(device);
  const resolvedSource = source?.schema === ULG_SPH_SPATIAL_GAS_CELL_EOS_GPU_SOURCE_SCHEMA
    ? source
    : resolveSphSpatialGasCellEosGpuSource({ source, ...sourceOptions });
  if (!resolvedSource.ready) return blockedResult(resolvedSource.blocker, { source: resolvedSource });
  const resolvedLane = lane || getOrCreateSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: sourceCapacity ?? resolvedSource.sourceRowCount,
    gasCellCapacity: gasCellCapacity ?? (resolvedSource.sourceRowCount + 1),
    maxGridCellCount: maxGridCellCount ?? normalizeGridDims(gridDims).gridCellCount,
    requireLaneIdentity,
    laneId: laneId || gpuResidentLaneLeaseIdentity?.laneId || null,
    stateKey: stateKey || gpuResidentLaneLeaseIdentity?.stateKey || null,
    sourceFamily: sourceFamily || gpuResidentLaneLeaseIdentity?.sourceFamily || null,
    outputSlotCount: OUTPUT_SLOT_COUNT,
    paramsSlotCount: paramsSlotCount ?? outputSlotCount
  });
  if (resolvedLane.device !== device) return blockedResult('sph-spatial-gas-cell-eos-lane-device-mismatch');
  const sourceBorrow = borrowSourceHandle(resolvedSource);
  if (!sourceBorrow.admitted) {
    return blockedResult(sourceBorrow.reason || 'spatial-gas-source-consumer-lease-rejected', {
      source: resolvedSource,
      sourceBorrowProtocol: sourceBorrow.protocol
    });
  }
  const callerOwnsEncoder = commandEncoder != null;
  if (callerOwnsEncoder && measureGpuTimestamps && !sharedTimestampProfiler) {
    sourceBorrow.release();
    return blockedResult('caller-owned-encoder-requires-shared-timestamp-profiler', {
      source: resolvedSource
    });
  }
  const ownsTimestampProfiler = !callerOwnsEncoder && sharedTimestampProfiler == null;
  const timestampProfiler = sharedTimestampProfiler || (ownsTimestampProfiler
    ? createWebGpuTimestampProfiler(device, {
        requested: Boolean(measureGpuTimestamps),
        label: 'ulg-sph-spatial-gas-cell-eos',
        maxSpans: 64
      })
    : null);
  const encoder = commandEncoder || device.createCommandEncoder();
  let result;
  try {
    result = resolvedLane.encode(encoder, {
      source: resolvedSource,
      gpuResidentLaneLeaseIdentity,
      gridDims,
      boxDimsM,
      fallbackSupportVolumeM3,
      fallbackTemperatureK,
      minVolumeM3,
      timestampProfiler,
      timestampMetadata
    });
    if (!result.ready) {
      sourceBorrow.release();
      if (ownsTimestampProfiler) timestampProfiler.destroy();
      return result;
    }
    result.callerOwnedEncoder = callerOwnsEncoder;
    result.residentGasCellEosLane = resolvedLane;
    result.residentGasCellEosLaneCacheStatus = lane ? 'caller-supplied-persistent-lane' : resolvedLane.cacheStatus;
    result.residentGasCellEosLaneCapacityClass = lane
      ? (resolvedLane.cacheRequest
          ? { ...resolvedLane.cacheRequest }
          : {
          requestedSourceCapacity: sourceCapacity ?? resolvedSource.sourceRowCount,
          requestedGasCellCapacity: gasCellCapacity ?? (resolvedSource.sourceRowCount + 1),
          requestedMaxGridCellCount:
            maxGridCellCount ?? normalizeGridDims(gridDims).gridCellCount,
          sourceCapacityClass: resolvedLane.sourceCapacity,
          gasCellCapacityClass: resolvedLane.gasCellCapacity,
          maxGridCellCountClass: resolvedLane.maxGridCellCount,
          compatibleCapacityClassReused: true
        })
      : { ...resolvedLane.cacheRequest };
    if (callerOwnsEncoder) {
      result.gpuAllocationEvidence = summarizeWebGpuBufferAllocations(
        resolvedLane.allocationEntries(),
        { scope: 'sph-spatial-gas-cell-eos-shared-submission' }
      );
      result.queueCompletionStatus = 'encoded-awaiting-caller-submit';
      result.queueCompletionMethod = 'caller-owned-command-encoder';
      const originalMarkSubmitted = result.markSubmitted;
      const originalCancelBeforeSubmit = result.cancelBeforeSubmit;
      result.markSubmitted = (evidence = {}) => {
        sourceBorrow.release();
        return originalMarkSubmitted(evidence);
      };
      result.cancelBeforeSubmit = (evidence = {}) => {
        sourceBorrow.release();
        return originalCancelBeforeSubmit(evidence);
      };
      result.abort = result.cancelBeforeSubmit;
      return result;
    }
    if (ownsTimestampProfiler) timestampProfiler.encodeResolve(encoder);
    device.queue.submit([encoder.finish()]);
    sourceBorrow.release();
    result.markSubmitted({ queueCompletionStatus: 'queue-submitted', queueCompletionMethod: 'queue.submit' });
    if (awaitQueueFence && typeof device.queue.onSubmittedWorkDone === 'function') {
      await device.queue.onSubmittedWorkDone();
      result.markSubmitted({
        queueCompletionStatus: 'queue-work-completed',
        queueCompletionMethod: 'queue.onSubmittedWorkDone'
      });
    }
    const gpuTimestampProfile = ownsTimestampProfiler
      ? await timestampProfiler.read()
      : null;
    result.gpuTimestampProfile = gpuTimestampProfile;
    result.gpuTimestampRequested = Boolean(measureGpuTimestamps || sharedTimestampProfiler);
    result.gpuTimestampStatus = ownsTimestampProfiler
      ? gpuTimestampProfile?.status ?? null
      : 'shared-profiler-deferred';
    result.gpuTimestampMappedByteLength = gpuTimestampProfile?.mappedByteLength ?? 0;
    result.gpuAllocationEvidence = summarizeWebGpuBufferAllocations([
      ...resolvedLane.allocationEntries(),
      ...(timestampProfiler?.allocationEntries?.() || [])
    ], { scope: 'sph-spatial-gas-cell-eos' });
    return result;
  } catch (error) {
    if (ownsTimestampProfiler) timestampProfiler?.destroy?.();
    sourceBorrow.release();
    if (result?.cancelBeforeSubmit) {
      result.cancelBeforeSubmit({ reason: 'gas-cell-eos-runner-failed-before-submit' });
    } else if (result?.retire) {
      result.retire({ reason: 'gas-cell-eos-runner-failed' });
    }
    return blockedResult(error?.message || String(error), { source: resolvedSource });
  }
}
