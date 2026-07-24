import {
  SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS,
  SCHROEDER_SPATIAL_EPOCH_MAGIC,
  SCHROEDER_SPATIAL_EPOCH_VERSION,
  SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT
} from '../../../ulg-gpu-abi/src/index.js';
import {
  ULG_SCHROEDER_SPATIAL_DIRECTORY_SOURCE_SCHEMA,
  ULG_SCHROEDER_SPATIAL_GPU_LOGICAL_COUNT_SOURCE_SCHEMA,
  quarantineSchroederSpatialEpochGenerationAfterDeviceLoss,
  releaseSchroederSpatialEpochGenerationAfterQueue,
  runSchroederSpatialEpochGenerationWithBackpressureWebGpu
} from './schroederSpatialEpochGpu.js';
import {
  residentProductMassDevice,
  tagWebGpuBufferDevice,
  webGpuBufferDevice,
  webGpuDeviceId,
  webGpuDeviceMismatchInfo
} from './sphGpuDeviceIdentity.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import { createWebGpuU32ExclusiveScan } from '../webgpuRadixScanUnique.js';

export const ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA_V1 =
  'peercompute.ulg.sph-retained-spatial-gas-ledger-source.v1';
export const ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V1 =
  'peercompute.ulg.sph-retained-gas-cell-eos-source.v1';
export const ULG_SPH_SPATIAL_GAS_LEDGER_EOS_EXECUTION_SCHEMA_V1 =
  'peercompute.ulg.sph-spatial-gas-ledger-eos-execution.v1';
export const ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA =
  'peercompute.ulg.sph-retained-spatial-gas-ledger-source.v2';
export const ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA =
  'peercompute.ulg.sph-retained-gas-cell-eos-source.v2';
export const ULG_SPH_SPATIAL_GAS_LEDGER_EOS_EXECUTION_SCHEMA =
  'peercompute.ulg.sph-spatial-gas-ledger-eos-execution.v2';
export const ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA =
  'peercompute.ulg.sph-gas-pressure-authority-telemetry.v1';
export const ULG_SPH_GAS_PRESSURE_CONSUMER_RECEIPT_SCHEMA =
  'peercompute.ulg.sph-gas-pressure-consumer-receipt.v1';

export const SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS = 12;
export const SPH_SPATIAL_GAS_ACTIVE_NODE_ROW_FLOATS = 16;
export const SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS = 12;
export const SPH_SPATIAL_GAS_LEDGER_EOS_WORKGROUP_SIZE = 64;
export const SPH_SPATIAL_GAS_LEDGER_EOS_ARENA_COUNT = 3;
export const SPH_SPATIAL_GAS_AUTHORITY_CONTROL_MAGIC = 0x5347_4132;
export const SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION = 2;
export const SPH_SPATIAL_GAS_AUTHORITY_CONTROL_WORDS = 32;
export const SPH_SPATIAL_GAS_AUTHORITY_CONTROL_BYTES =
  SPH_SPATIAL_GAS_AUTHORITY_CONTROL_WORDS * Uint32Array.BYTES_PER_ELEMENT;

export const SPH_SPATIAL_GAS_AUTHORITY_STATUS = Object.freeze({
  INITIALIZED: 1 << 0,
  COMPACT_READY: 1 << 1,
  DIRECTORY_READY: 1 << 2,
  EOS_READY: 1 << 3,
  PRESSURE_READY: 1 << 4,
  EMPTY: 1 << 5,
  FAILED: 0x8000_0000
});
export const SPH_SPATIAL_GAS_AUTHORITY_ERROR = Object.freeze({
  INVALID_CANDIDATE: 1 << 0,
  CONSERVATION: 1 << 1,
  COMPACTION_OVERFLOW: 1 << 2,
  DIRECTORY_REJECTED: 1 << 3,
  EOS_INVALID: 1 << 4,
  COUNT_MISMATCH: 1 << 5,
  GENERATION_MISMATCH: 1 << 6,
  CAPACITY_OVERFLOW: 1 << 7
});
export const SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS = Object.freeze({
  MAGIC: 0,
  VERSION: 1,
  STATUS_FLAGS: 2,
  ERROR_FLAGS: 3,
  EXECUTION_GENERATION: 4,
  COMPLETION_GENERATION: 5,
  SOURCE_STORAGE_GENERATION: 6,
  SOURCE_CAPACITY: 7,
  LIVE_RESIDUAL_COUNT: 8,
  DIRECTORY_GENERATION: 9,
  DIRECTORY_CELL_COUNT: 10,
  READY_PRESSURE_COUNT: 11,
  INVALID_CANDIDATE_COUNT: 12,
  COMPACTION_OVERFLOW_COUNT: 13,
  DIRECTORY_ERROR_COUNT: 14,
  EOS_ERROR_COUNT: 15,
  SS_KEY_DISPATCH_X: 16,
  SS_KEY_DISPATCH_Y: 17,
  SS_KEY_DISPATCH_Z: 18,
  SS_ASSEMBLE_DISPATCH_X: 19,
  SS_ASSEMBLE_DISPATCH_Y: 20,
  SS_ASSEMBLE_DISPATCH_Z: 21,
  EOS_AGGREGATE_DISPATCH_X: 22,
  EOS_AGGREGATE_DISPATCH_Y: 23,
  EOS_AGGREGATE_DISPATCH_Z: 24,
  EOS_GRADIENT_DISPATCH_X: 25,
  EOS_GRADIENT_DISPATCH_Y: 26,
  EOS_GRADIENT_DISPATCH_Z: 27,
  COMPACT_STRIDE: 28,
  ACTIVE_NODE_STRIDE: 29,
  PRESSURE_STRIDE: 30,
  RESERVED: 31
});

export const SPH_SPATIAL_GAS_DIAGNOSTICS_NONE = 'none';
export const SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE =
  'full-spatial-gas-oracle';

const PRODUCT_EVENT_POSITION_AUTHORITY =
  'reaction-product-event-birth-position';
const PRODUCT_EVENT_SOURCE_FAMILY =
  'sph-reaction-product-event-capacity-gas-ledger';
const DEFAULT_GAS_CONSTANT_J_PER_MOL_K = 8.31446261815324;
const DEFAULT_GAS_TEMPERATURE_K = 293.15;
const SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS =
  SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.length;
const MAX_EXACT_F32_INTEGER = 0x00ff_ffff;
const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const FLOAT32_BYTES = Float32Array.BYTES_PER_ELEMENT;
const PARAMS_BUFFER_BYTES = 256;

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};
const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

const deviceRuntimes = new WeakMap();
const retainedExecutions = new WeakMap();
const retainedSpatialGasSources = new WeakMap();
const retainedGasCellSources = new WeakMap();
const retainedPressureConsumerReceipts = new WeakMap();
const lostDevices = new WeakSet();

function pressureAuthorityError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function exactPressureSourceRecord(source) {
  const record = retainedGasCellSources.get(source);
  if (
    !record
    || record.gasCellSource !== source
    || source?.schema !== ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA
    || source?.gasPressureCellsBuffer !== record.slot.gasPressureCellsBuffer
    || source?.gasAuthorityControlBuffer !== record.slot.controlBuffer
    || source?.gasPressureCellRowCapacity !== record.capacity
    || source?.pressureInterfaceGasPressureCellRowStrideFloats
      !== SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS
    || source?.executionGeneration !== record.executionGeneration
    || source?.storageGeneration !== record.storageGeneration
  ) {
    return null;
  }
  return record;
}

function terminalizePressureConsumerReceipt(record) {
  const receipt = record.activePressureConsumerReceipt;
  const receiptRecord = retainedPressureConsumerReceipts.get(receipt);
  if (receiptRecord?.record === record && receiptRecord.state === 'borrowed') {
    receiptRecord.state = 'terminal';
  }
  record.activePressureConsumerReceipt = null;
}

function exactU32(value, label, { positive = false } = {}) {
  const number = value;
  if (
    typeof number !== 'number'
    ||
    !Number.isInteger(number)
    || number < (positive ? 1 : 0)
    || number > 0xffff_ffff
  ) {
    throw new RangeError(
      `${label} must be an integer in [${positive ? 1 : 0}, 4294967295]`
    );
  }
  return number;
}

function positiveFiniteF32(value, label) {
  const number = Math.fround(Number(value));
  if (!Number.isFinite(number) || !(number > 0)) {
    throw new RangeError(`${label} must be a positive finite f32`);
  }
  return number;
}

function nonNegativeFiniteF32(value, label) {
  const number = Math.fround(Number(value));
  if (!Number.isFinite(number) || number < 0) {
    throw new RangeError(`${label} must be a non-negative finite f32`);
  }
  return number;
}

function nextPowerOfTwo(value) {
  let capacity = 1;
  while (capacity < value) capacity *= 2;
  return capacity;
}

function alignedBytes(value) {
  return Math.max(4, Math.ceil(value / 4) * 4);
}

export function sphSpatialGasLedgerEosDispatchWorkgroups(device, rowCount) {
  const count = exactU32(rowCount, 'spatial gas rowCount', { positive: true });
  const required = Math.max(
    1,
    Math.ceil(count / SPH_SPATIAL_GAS_LEDGER_EOS_WORKGROUP_SIZE)
  );
  const advertisedLimit = Number(
    device?.limits?.maxComputeWorkgroupsPerDimension ?? 65_535
  );
  const limit = Number.isInteger(advertisedLimit) && advertisedLimit > 0
    ? advertisedLimit
    : 65_535;
  if (required > limit) {
    const error = new RangeError(
      `spatial gas/EOS dispatch requires ${required} x-workgroups; device limit is ${limit}`
    );
    error.code = 'ERR_SPH_SPATIAL_GAS_LEDGER_EOS_DISPATCH_LIMIT';
    error.requiredWorkgroups = required;
    error.maxComputeWorkgroupsPerDimension = limit;
    throw error;
  }
  return required;
}

function signedOrderKey(value) {
  return ((value | 0) ^ 0x8000_0000) >>> 0;
}

function createOwnedBuffer(device, descriptor) {
  return tagWebGpuBufferDevice(device.createBuffer(descriptor), device);
}

function destroyBufferOnce(slot, buffer) {
  if (!buffer || slot.destroyedBuffers.has(buffer)) return false;
  slot.destroyedBuffers.add(buffer);
  buffer.destroy?.();
  return true;
}

function destroySlot(slot) {
  if (slot.destroyed) return false;
  slot.destroyed = true;
  destroyBufferOnce(slot, slot.compactRowsBuffer);
  destroyBufferOnce(slot, slot.activeNodeBuffer);
  destroyBufferOnce(slot, slot.gasPressureCellsBuffer);
  destroyBufferOnce(slot, slot.candidateFlagsBuffer);
  destroyBufferOnce(slot, slot.candidateOffsetsBuffer);
  destroyBufferOnce(slot, slot.controlBuffer);
  destroyBufferOnce(slot, slot.paramsBuffer);
  slot.compactionScan?.destroy?.();
  return true;
}

function createArenaSlot(device, capacity, arenaIndex) {
  const label = `ulg-sph-spatial-gas-ledger-eos-${capacity}-arena-${arenaIndex}`;
  return {
    arenaIndex,
    label,
    capacity,
    inUse: false,
    terminal: false,
    destroyed: false,
    executionSerial: 0,
    ownerToken: null,
    releasePromise: null,
    retainedExecution: null,
    pendingFailure: null,
    destroyedBuffers: new Set(),
    candidateFlagsBuffer: createOwnedBuffer(device, {
      label: `${label}-candidate-flags`,
      size: alignedBytes(capacity * UINT32_BYTES),
      usage: GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST
    }),
    candidateOffsetsBuffer: createOwnedBuffer(device, {
      label: `${label}-candidate-offsets`,
      size: alignedBytes(capacity * UINT32_BYTES),
      usage: GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST
    }),
    controlBuffer: createOwnedBuffer(device, {
      label: `${label}-authority-control`,
      size: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_BYTES,
      usage: GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST
    }),
    compactionScan: createWebGpuU32ExclusiveScan(device, {
      maxElementCount: capacity,
      fixedElementCount: capacity,
      retainParamsBuffer: true,
      label: `${label}-candidate-scan`
    }),
    compactRowsBuffer: createOwnedBuffer(device, {
      label: `${label}-compact-rows`,
      size: alignedBytes(
        capacity * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS * FLOAT32_BYTES
      ),
      usage: GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST
    }),
    activeNodeBuffer: createOwnedBuffer(device, {
      label: `${label}-active-node-adapter`,
      size: alignedBytes(
        capacity * SPH_SPATIAL_GAS_ACTIVE_NODE_ROW_FLOATS * FLOAT32_BYTES
      ),
      usage: GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST
    }),
    gasPressureCellsBuffer: createOwnedBuffer(device, {
      label: `${label}-gas-pressure-cells`,
      size: alignedBytes(
        capacity * SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS * FLOAT32_BYTES
      ),
      usage: GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST
    }),
    paramsBuffer: createOwnedBuffer(device, {
      label: `${label}-params`,
      size: PARAMS_BUFFER_BYTES,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    })
  };
}

function terminalizeRuntimeAfterDeviceLoss(runtime) {
  if (runtime.terminal) return false;
  runtime.terminal = true;
  lostDevices.add(runtime.device);
  for (const slot of runtime.slots) {
    slot.terminal = true;
    const pendingFailure = slot.pendingFailure;
    if (
      pendingFailure
      && pendingFailure.ownerToken === slot.ownerToken
    ) {
      pendingFailure.terminal = true;
      pendingFailure.status = 'spatial-gas-ledger-eos-failure-device-lost';
      pendingFailure.releaseSourceBorrow();
      if (pendingFailure.spatialGeneration) {
        quarantineSchroederSpatialEpochGenerationAfterDeviceLoss(
          pendingFailure.spatialGeneration,
          runtime.device
        );
      }
      slot.pendingFailure = null;
    }
    const execution = slot.retainedExecution;
    if (execution) {
      const record = retainedExecutions.get(execution);
      if (record) {
        if (!record.terminal) {
          record.terminal = true;
          record.status = 'spatial-gas-ledger-eos-device-lost';
        }
        terminalizePressureConsumerReceipt(record);
        // Idempotent even when an earlier unconfirmed fence already marked the
        // record terminal; device loss is what finally makes borrow retirement
        // and buffer destruction safe for that quarantined execution.
        record.releaseSourceBorrow();
        if (record.spatialGeneration) {
          quarantineSchroederSpatialEpochGenerationAfterDeviceLoss(
            record.spatialGeneration,
            runtime.device
          );
        }
      }
    }
    destroySlot(slot);
  }
  return true;
}

function runtimeForCapacity(device, capacity) {
  if (lostDevices.has(device)) {
    const error = new Error('spatial gas ledger/EOS device is lost');
    error.code = 'ERR_SPH_SPATIAL_GAS_LEDGER_EOS_DEVICE_LOST';
    throw error;
  }
  let byCapacity = deviceRuntimes.get(device);
  if (!byCapacity) {
    byCapacity = new Map();
    deviceRuntimes.set(device, byCapacity);
  }
  let runtime = byCapacity.get(capacity);
  if (runtime) return runtime;
  runtime = {
    schema: 'peercompute.ulg.sph-spatial-gas-ledger-eos-arena.v1',
    status: 'spatial-gas-ledger-eos-arena-ready',
    device,
    deviceId: webGpuDeviceId(device),
    capacity,
    terminal: false,
    acquireCount: 0,
    reuseCount: 0,
    slots: Array.from(
      { length: SPH_SPATIAL_GAS_LEDGER_EOS_ARENA_COUNT },
      (_, arenaIndex) => createArenaSlot(device, capacity, arenaIndex)
    )
  };
  byCapacity.set(capacity, runtime);
  if (device?.lost && typeof device.lost.then === 'function') {
    device.lost.then(
      () => terminalizeRuntimeAfterDeviceLoss(runtime),
      () => terminalizeRuntimeAfterDeviceLoss(runtime)
    );
  }
  return runtime;
}

async function acquireArenaSlot(device, rowCount) {
  const capacity = nextPowerOfTwo(rowCount);
  const runtime = runtimeForCapacity(device, capacity);
  let waited = false;
  for (;;) {
    if (runtime.terminal) {
      const error = new Error('spatial gas ledger/EOS arena is terminal');
      error.code = 'ERR_SPH_SPATIAL_GAS_LEDGER_EOS_ARENA_TERMINAL';
      throw error;
    }
    const slot = runtime.slots.find((candidate) => (
      !candidate.inUse && !candidate.terminal && !candidate.destroyed
    ));
    if (slot) {
      slot.inUse = true;
      slot.executionSerial += 1;
      slot.ownerToken = Object.freeze({
        arenaIndex: slot.arenaIndex,
        serial: slot.executionSerial
      });
      slot.releasePromise = null;
      runtime.acquireCount += 1;
      if (waited || slot.executionSerial > 1) {
        runtime.reuseCount += 1;
      }
      return { runtime, slot, capacity, backpressureWaited: waited };
    }
    const pendingReleases = runtime.slots
      .map((candidate) => candidate.releasePromise)
      .filter((promise) => typeof promise?.then === 'function');
    if (pendingReleases.length === 0) {
      const error = new Error(
        'spatial gas ledger/EOS arena exhausted without a scheduled final-consumer release'
      );
      error.code = 'ERR_SPH_SPATIAL_GAS_LEDGER_EOS_ARENA_BACKPRESSURE';
      error.capacity = capacity;
      error.arenaCount = runtime.slots.length;
      throw error;
    }
    waited = true;
    await Promise.any(pendingReleases.map((promise) => (
      Promise.resolve(promise).then((released) => {
        if (released === true) return true;
        throw new Error('spatial gas arena release was not confirmed');
      })
    )));
  }
}

function releaseSlot(record, confirmed) {
  if (record.slot.ownerToken !== record.ownerToken) return false;
  if (record.slot.retainedExecution !== record.execution) return false;
  record.slot.releasePromise = null;
  record.status = confirmed
    ? 'spatial-gas-ledger-eos-released-after-final-consumer'
    : 'spatial-gas-ledger-eos-release-unconfirmed';
  if (confirmed === true) {
    terminalizePressureConsumerReceipt(record);
    record.releaseSourceBorrow();
    record.slot.retainedExecution = null;
    record.slot.ownerToken = null;
    record.slot.inUse = false;
    record.released = true;
    record.terminal = true;
    return true;
  }
  // A rejected/unconfirmed fence is not permission to reuse or destroy memory
  // that the device may still reference. Keep the source borrow and all owned
  // buffers quarantined until device loss proves that no queued work survives.
  record.terminal = true;
  record.slot.terminal = true;
  return false;
}

function sourceBorrowFor(source) {
  if (!source || !Object.hasOwn(source, '__ulgActiveBorrowCount')) {
    return null;
  }
  source.__ulgActiveBorrowCount = (source.__ulgActiveBorrowCount | 0) + 1;
  let released = false;
  return () => {
    if (released) return false;
    released = true;
    source.__ulgActiveBorrowCount = Math.max(
      0,
      (source.__ulgActiveBorrowCount | 0) - 1
    );
    return true;
  };
}

function rejectedExecution(status, reason, extra = {}) {
  return {
    schema: ULG_SPH_SPATIAL_GAS_LEDGER_EOS_EXECUTION_SCHEMA,
    status,
    reason,
    ready: false,
    selected: false,
    backend: 'webgpu-rejected',
    failClosed: true,
    normalHotLoopReadbackFree: true,
    mapAsyncCount: 0,
    hostMaterializedRowCount: 0,
    queueCompletionFenceWaited: false,
    ...extra
  };
}

function normalizeEpochIdentity(epochIdentity = null) {
  try {
    return {
      storageGeneration: exactU32(
        epochIdentity?.storageGeneration,
        'epochIdentity.storageGeneration',
        { positive: true }
      ),
      physicsTick: exactU32(epochIdentity?.physicsTick, 'epochIdentity.physicsTick'),
      physicsSubstep: exactU32(
        epochIdentity?.physicsSubstep,
        'epochIdentity.physicsSubstep'
      ),
      positionEpoch: exactU32(
        epochIdentity?.positionEpoch,
        'epochIdentity.positionEpoch'
      ),
      topologyEpoch: exactU32(
        epochIdentity?.topologyEpoch,
        'epochIdentity.topologyEpoch'
      ),
      chartEpoch: exactU32(epochIdentity?.chartEpoch, 'epochIdentity.chartEpoch'),
      levelEpoch: exactU32(epochIdentity?.levelEpoch, 'epochIdentity.levelEpoch'),
      supportEpoch: exactU32(
        epochIdentity?.supportEpoch,
        'epochIdentity.supportEpoch'
      )
    };
  } catch (error) {
    return { error };
  }
}

function normalizeSource({
  device,
  retainedProductEventSource = null,
  residentProductMass = null,
  productEventBuffer = null,
  productEventRowCount = null,
  productEventStrideFloats = null
}) {
  const source = retainedProductEventSource || residentProductMass || null;
  const buffer = productEventBuffer || source?.productEventBuffer || null;
  const rowCount = Number(
    productEventRowCount ?? source?.productEventRowCount
  );
  const strideFloats = Number(
    productEventStrideFloats ?? source?.productEventStrideFloats
      ?? SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
  );
  if (!source || source.productEventBufferRetained !== true) {
    return {
      error: rejectedExecution(
        'spatial-gas-ledger-eos-rejected-unretained-source',
        'A retained product-event source is required'
      )
    };
  }
  if (!buffer || buffer !== source.productEventBuffer) {
    return {
      error: rejectedExecution(
        'spatial-gas-ledger-eos-rejected-source-buffer',
        'The exact retained product-event buffer was not provided'
      )
    };
  }
  if (
    !Number.isInteger(rowCount)
    || rowCount < 1
    || rowCount > MAX_EXACT_F32_INTEGER
  ) {
    return {
      error: rejectedExecution(
        'spatial-gas-ledger-eos-rejected-source-count',
        `Product-event row count must be in [1, ${MAX_EXACT_F32_INTEGER}]`,
        { productEventRowCount: Number.isFinite(rowCount) ? rowCount : null }
      )
    };
  }
  if (strideFloats !== SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS) {
    return {
      error: rejectedExecution(
        'spatial-gas-ledger-eos-rejected-source-stride',
        `Product-event stride must be ${SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS} floats`,
        { productEventStrideFloats: strideFloats }
      )
    };
  }
  const requiredBytes = rowCount * strideFloats * FLOAT32_BYTES;
  if (
    Number.isFinite(Number(buffer.size))
    && Number(buffer.size) < requiredBytes
  ) {
    return {
      error: rejectedExecution(
        'spatial-gas-ledger-eos-rejected-source-byte-length',
        `Product-event buffer has ${buffer.size} bytes; ${requiredBytes} required`,
        { requiredProductEventByteLength: requiredBytes }
      )
    };
  }
  if (
    Number.isFinite(Number(buffer.usage))
    && (Number(buffer.usage) & GPU_BUFFER_USAGE.STORAGE) === 0
  ) {
    return {
      error: rejectedExecution(
        'spatial-gas-ledger-eos-rejected-source-usage',
        'The retained product-event buffer is not storage-bindable'
      )
    };
  }
  if (
    Number.isFinite(Number(device?.limits?.maxStorageBufferBindingSize))
    && requiredBytes > Number(device.limits.maxStorageBufferBindingSize)
  ) {
    return {
      error: rejectedExecution(
        'spatial-gas-ledger-eos-rejected-source-binding-size',
        `Product-event binding requires ${requiredBytes} bytes beyond maxStorageBufferBindingSize`,
        { requiredProductEventByteLength: requiredBytes }
      )
    };
  }
  const mismatch = webGpuDeviceMismatchInfo({
    buffer,
    residentProductMass: source,
    device
  });
  const sourceDevice = residentProductMassDevice(source)
    || webGpuBufferDevice(buffer)
    || source.productEventDevice
    || null;
  if (mismatch.mismatch || sourceDevice !== device) {
    return {
      error: rejectedExecution(
        sourceDevice
          ? 'spatial-gas-ledger-eos-rejected-cross-device-source'
          : 'spatial-gas-ledger-eos-rejected-unknown-source-device',
        sourceDevice
          ? 'The retained product-event source belongs to another WebGPU device'
          : 'The retained product-event source has no exact WebGPU device provenance',
        {
          sourceDeviceId: sourceDevice ? webGpuDeviceId(sourceDevice) : null,
          consumerDeviceId: webGpuDeviceId(device)
        }
      )
    };
  }
  if (!Object.hasOwn(source, '__ulgActiveBorrowCount')) {
    return {
      error: rejectedExecution(
        'spatial-gas-ledger-eos-rejected-source-lifecycle',
        'The retained product-event source does not expose its exact consumer-borrow lifecycle'
      )
    };
  }
  return { source, buffer, rowCount, strideFloats, requiredBytes };
}

function adapterParams({
  rowCount,
  sourceCapacity,
  strideFloats,
  cellSizeM,
  chartId,
  level,
  executionGeneration,
  fallbackTemperatureK
}) {
  const data = new ArrayBuffer(48);
  const view = new DataView(data);
  view.setUint32(0, rowCount, true);
  view.setUint32(4, sourceCapacity, true);
  view.setUint32(8, strideFloats, true);
  view.setUint32(12, SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS, true);
  view.setUint32(16, SPH_SPATIAL_GAS_ACTIVE_NODE_ROW_FLOATS, true);
  view.setUint32(20, executionGeneration, true);
  view.setUint32(24, chartId, true);
  view.setInt32(28, level, true);
  view.setFloat32(32, cellSizeM, true);
  view.setFloat32(36, fallbackTemperatureK, true);
  return new Uint8Array(data);
}

function initialAuthorityControl({
  executionGeneration,
  storageGeneration,
  sourceCapacity
}) {
  const words = new Uint32Array(SPH_SPATIAL_GAS_AUTHORITY_CONTROL_WORDS);
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.MAGIC] =
    SPH_SPATIAL_GAS_AUTHORITY_CONTROL_MAGIC;
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.VERSION] =
    SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION;
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.STATUS_FLAGS] =
    SPH_SPATIAL_GAS_AUTHORITY_STATUS.INITIALIZED;
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.EXECUTION_GENERATION] =
    executionGeneration;
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.SOURCE_STORAGE_GENERATION] =
    storageGeneration;
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.SOURCE_CAPACITY] =
    sourceCapacity;
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.COMPACT_STRIDE] =
    SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS;
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.ACTIVE_NODE_STRIDE] =
    SPH_SPATIAL_GAS_ACTIVE_NODE_ROW_FLOATS;
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.PRESSURE_STRIDE] =
    SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS;
  return words;
}

function eosParams({
  sourceCapacity,
  executionGeneration,
  generation,
  gasConstantJPerMolK,
  cellSizeM,
  fallbackTemperatureK,
  chartId,
  level
}) {
  const execution = generation.execution;
  const layout = execution.layout;
  const data = new ArrayBuffer(64);
  const view = new DataView(data);
  view.setUint32(0, sourceCapacity, true);
  view.setUint32(4, SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS, true);
  view.setUint32(8, SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS, true);
  view.setUint32(12, execution.generationId, true);
  view.setUint32(16, layout.wordLength, true);
  view.setUint32(20, layout.cellCapacity, true);
  view.setUint32(24, layout.cellKeysOffsetWords, true);
  view.setUint32(28, layout.cellOffsetsOffsetWords, true);
  view.setUint32(32, layout.cellMembersOffsetWords, true);
  view.setUint32(36, layout.particleToCellOffsetWords, true);
  view.setUint32(40, chartId, true);
  view.setUint32(44, signedOrderKey(level), true);
  view.setFloat32(48, gasConstantJPerMolK, true);
  view.setFloat32(52, cellSizeM, true);
  view.setFloat32(56, fallbackTemperatureK, true);
  view.setUint32(60, executionGeneration, true);
  return new Uint8Array(data);
}

export const sphSpatialGasLedgerProductEventAdapterWgsl = /* wgsl */ `
struct SpatialGasAdapterParams {
  source_row_count: u32,
  source_capacity: u32,
  product_event_stride: u32,
  compact_stride: u32,
  active_node_stride: u32,
  execution_generation: u32,
  chart_id: u32,
  level: i32,
  cell_size_m: f32,
  fallback_temperature_k: f32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> product_events: array<f32>;
@group(0) @binding(1) var<storage, read_write> candidate_flags: array<u32>;
@group(0) @binding(2) var<storage, read> candidate_offsets: array<u32>;
@group(0) @binding(3) var<storage, read_write> compact_rows: array<f32>;
@group(0) @binding(4) var<storage, read_write> active_nodes: array<f32>;
@group(0) @binding(5) var<storage, read_write> authority: array<atomic<u32>>;
@group(0) @binding(6) var<uniform> params: SpatialGasAdapterParams;

const CONTROL_MAGIC: u32 = 0x53474132u;
const CONTROL_VERSION: u32 = 2u;
const STATUS_INITIALIZED: u32 = 1u;
const STATUS_COMPACT_READY: u32 = 2u;
const STATUS_EMPTY: u32 = 32u;
const STATUS_FAILED: u32 = 0x80000000u;
const ERROR_INVALID_CANDIDATE: u32 = 1u;
const ERROR_CONSERVATION: u32 = 2u;
const ERROR_COMPACTION_OVERFLOW: u32 = 4u;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

@compute @workgroup_size(64)
fn classify_product_events(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.source_capacity) {
    return;
  }
  candidate_flags[row_index] = 0u;
  if (row_index >= params.source_row_count) { return; }
  let source = row_index * params.product_event_stride;
  let routing = product_events[source + 10u];
  let source_status = product_events[source + 18u];
  let gas_routed_ready = finite_f32(routing)
    && routing > 0.5 && routing < 1.5
    && finite_f32(source_status) && source_status > 0.5;
  if (!gas_routed_ready) { return; }

  let total_mass = product_events[source + 3u];
  let total_moles = product_events[source + 9u];
  let placed_mass = product_events[source + 12u];
  let unplaced_mass = product_events[source + 13u];
  let density = product_events[source + 17u];
  let scalars_valid = finite_f32(total_mass) && total_mass >= 0.0
    && finite_f32(total_moles) && total_moles >= 0.0
    && finite_f32(placed_mass) && placed_mass >= 0.0
    && finite_f32(unplaced_mass) && unplaced_mass >= 0.0
    && finite_f32(density) && density > 0.0;
  if (!scalars_valid) {
    atomicOr(&authority[3u], ERROR_INVALID_CANDIDATE);
    atomicAdd(&authority[12u], 1u);
    return;
  }
  let partition_mass = placed_mass + unplaced_mass;
  let conservation_tolerance = max(1.0e-7, max(total_mass, partition_mass) * 1.0e-4);
  if (
    !finite_f32(partition_mass)
    || !finite_f32(conservation_tolerance)
    || abs(total_mass - partition_mass) > conservation_tolerance
  ) {
    atomicOr(&authority[3u], ERROR_CONSERVATION);
    atomicAdd(&authority[12u], 1u);
    return;
  }
  if (unplaced_mass == 0.0) { return; }

  let position = vec3<f32>(
    product_events[source + 0u],
    product_events[source + 1u],
    product_events[source + 2u]
  );
  let material_id = product_events[source + 4u];
  let product_term = product_events[source + 5u];
  let residual_fraction = unplaced_mass / total_mass;
  let residual_moles = total_moles * residual_fraction;
  let residual_volume = unplaced_mass / density;
  let candidate_valid = total_mass > 0.0 && total_moles > 0.0
    && all(vec3<bool>(
      finite_f32(position.x),
      finite_f32(position.y),
      finite_f32(position.z)
    ))
    && finite_f32(material_id) && material_id > 0.0
    && finite_f32(product_term) && product_term >= 0.0
    && finite_f32(residual_fraction) && residual_fraction > 0.0
    && residual_fraction <= 1.0001
    && finite_f32(residual_moles) && residual_moles > 0.0
    && finite_f32(residual_volume) && residual_volume > 0.0;
  if (!candidate_valid) {
    atomicOr(&authority[3u], ERROR_INVALID_CANDIDATE);
    atomicAdd(&authority[12u], 1u);
    return;
  }
  candidate_flags[row_index] = 1u;
}

@compute @workgroup_size(1)
fn finalize_compaction() {
  if (
    atomicLoad(&authority[0u]) != CONTROL_MAGIC
    || atomicLoad(&authority[1u]) != CONTROL_VERSION
    || atomicLoad(&authority[4u]) != params.execution_generation
    || atomicLoad(&authority[7u]) != params.source_capacity
  ) {
    atomicOr(&authority[3u], ERROR_INVALID_CANDIDATE);
  }
  var live_count = 0u;
  if (params.source_capacity > 0u) {
    let last = params.source_capacity - 1u;
    live_count = candidate_offsets[last] + candidate_flags[last];
  }
  if (live_count > params.source_capacity) {
    atomicOr(&authority[3u], ERROR_COMPACTION_OVERFLOW);
    atomicStore(&authority[13u], live_count - params.source_capacity);
  }
  let errors = atomicLoad(&authority[3u]);
  if (errors != 0u) {
    live_count = 0u;
    atomicStore(&authority[2u], STATUS_INITIALIZED | STATUS_FAILED);
  } else {
    var status = STATUS_INITIALIZED | STATUS_COMPACT_READY;
    if (live_count == 0u) { status = status | STATUS_EMPTY; }
    atomicStore(&authority[2u], status);
  }
  atomicStore(&authority[8u], live_count);
  let dispatch_x = (live_count + 63u) / 64u;
  atomicStore(&authority[16u], dispatch_x);
  atomicStore(&authority[17u], select(1u, 0u, dispatch_x == 0u));
  atomicStore(&authority[18u], select(1u, 0u, dispatch_x == 0u));
  atomicStore(&authority[19u], dispatch_x);
  atomicStore(&authority[20u], select(1u, 0u, dispatch_x == 0u));
  atomicStore(&authority[21u], select(1u, 0u, dispatch_x == 0u));
}

@compute @workgroup_size(64)
fn scatter_compact_rows(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let source_index = global_id.x;
  if (
    source_index >= params.source_capacity
    || candidate_flags[source_index] == 0u
    || atomicLoad(&authority[3u]) != 0u
    || (atomicLoad(&authority[2u]) & STATUS_COMPACT_READY) == 0u
  ) { return; }
  let output_index = candidate_offsets[source_index];
  let live_count = atomicLoad(&authority[8u]);
  if (output_index >= live_count || output_index >= params.source_capacity) {
    atomicOr(&authority[3u], ERROR_COMPACTION_OVERFLOW);
    atomicAdd(&authority[13u], 1u);
    atomicOr(&authority[2u], STATUS_FAILED);
    atomicStore(&authority[8u], 0u);
    return;
  }
  let source = source_index * params.product_event_stride;
  let compact = output_index * params.compact_stride;
  let active_base = output_index * params.active_node_stride;
  let total_mass = product_events[source + 3u];
  let unplaced_mass = product_events[source + 13u];
  let residual_fraction = clamp(unplaced_mass / total_mass, 0.0, 1.0);
  let residual_moles = product_events[source + 9u] * residual_fraction;
  let residual_volume = unplaced_mass / product_events[source + 17u];
  if (
    !finite_f32(residual_fraction) || !(residual_fraction > 0.0)
    || !finite_f32(residual_moles) || !(residual_moles > 0.0)
    || !finite_f32(residual_volume) || !(residual_volume > 0.0)
  ) {
    atomicOr(&authority[3u], ERROR_INVALID_CANDIDATE);
    atomicAdd(&authority[12u], 1u);
    atomicOr(&authority[2u], STATUS_FAILED);
    atomicStore(&authority[8u], 0u);
    return;
  }
  let source_temperature = product_events[source + 16u];
  let temperature = select(
    params.fallback_temperature_k,
    source_temperature,
    finite_f32(source_temperature) && source_temperature > 0.0
  );
  for (var word = 0u; word < params.active_node_stride; word = word + 1u) {
    active_nodes[active_base + word] = 0.0;
  }
  for (var word = 0u; word < params.compact_stride; word = word + 1u) {
    compact_rows[compact + word] = 0.0;
  }
  compact_rows[compact + 0u] = product_events[source + 0u];
  compact_rows[compact + 1u] = product_events[source + 1u];
  compact_rows[compact + 2u] = product_events[source + 2u];
  compact_rows[compact + 3u] = product_events[source + 4u];
  compact_rows[compact + 4u] = unplaced_mass;
  compact_rows[compact + 5u] = residual_moles;
  compact_rows[compact + 6u] = temperature;
  compact_rows[compact + 7u] = residual_volume;
  compact_rows[compact + 8u] = product_events[source + 5u];
  compact_rows[compact + 9u] = f32(source_index);
  compact_rows[compact + 10u] = 1.0;
  compact_rows[compact + 11u] = product_events[source + 10u];

  active_nodes[active_base + 0u] = f32(params.level);
  active_nodes[active_base + 8u] = params.cell_size_m;
  active_nodes[active_base + 10u] = f32(output_index);
  active_nodes[active_base + 11u] = 1.0;
  active_nodes[active_base + 12u] = product_events[source + 0u];
  active_nodes[active_base + 13u] = product_events[source + 1u];
  active_nodes[active_base + 14u] = product_events[source + 2u];
  active_nodes[active_base + 15u] = f32(params.chart_id);
}
`;

export const sphSpatialGasLedgerEosWgsl = /* wgsl */ `
struct SpatialGasEosParams {
  source_capacity: u32,
  compact_stride: u32,
  pressure_stride: u32,
  directory_generation_id: u32,
  directory_capacity_words: u32,
  cell_capacity: u32,
  cell_keys_offset_words: u32,
  cell_offsets_offset_words: u32,
  cell_members_offset_words: u32,
  particle_to_cell_offset_words: u32,
  chart_id: u32,
  level_order_key: u32,
  gas_constant_j_per_mol_k: f32,
  cell_size_m: f32,
  fallback_temperature_k: f32,
  execution_generation: u32,
};

@group(0) @binding(0) var<storage, read> compact_rows: array<f32>;
@group(0) @binding(1) var<storage, read> directory: array<u32>;
@group(0) @binding(2) var<storage, read_write> pressure_cells: array<f32>;
@group(0) @binding(3) var<uniform> params: SpatialGasEosParams;
@group(0) @binding(4) var<storage, read_write> authority: array<atomic<u32>>;

const SPATIAL_MAGIC: u32 = 0x53534531u;
const SPATIAL_VERSION: u32 = 1u;
const SPATIAL_STATUS_READY: u32 = 1u;
const SPATIAL_STATUS_ADMITTED: u32 = 2u;
const SPATIAL_STATUS_REJECT_MASK: u32 = 28u;
const SPATIAL_SORT_LEXICOGRAPHIC: u32 = 2u;
const SPATIAL_ACTIVE_NODE_ADAPTER: u32 = 1u;
const CONTROL_MAGIC: u32 = 0x53474132u;
const CONTROL_VERSION: u32 = 2u;
const CONTROL_STATUS_INITIALIZED: u32 = 1u;
const CONTROL_STATUS_COMPACT_READY: u32 = 2u;
const CONTROL_STATUS_DIRECTORY_READY: u32 = 4u;
const CONTROL_STATUS_EOS_READY: u32 = 8u;
const CONTROL_STATUS_PRESSURE_READY: u32 = 16u;
const CONTROL_STATUS_EMPTY: u32 = 32u;
const CONTROL_STATUS_FAILED: u32 = 0x80000000u;
const CONTROL_ERROR_DIRECTORY_REJECTED: u32 = 8u;
const CONTROL_ERROR_EOS_INVALID: u32 = 16u;
const CONTROL_ERROR_COUNT_MISMATCH: u32 = 32u;
const CONTROL_ERROR_GENERATION_MISMATCH: u32 = 64u;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn authority_identity_ready() -> bool {
  let control_status = atomicLoad(&authority[2u]);
  return atomicLoad(&authority[0u]) == CONTROL_MAGIC
    && atomicLoad(&authority[1u]) == CONTROL_VERSION
    && atomicLoad(&authority[4u]) == params.execution_generation
    && atomicLoad(&authority[7u]) == params.source_capacity
    && atomicLoad(&authority[8u]) <= params.source_capacity
    && atomicLoad(&authority[28u]) == params.compact_stride
    && atomicLoad(&authority[30u]) == params.pressure_stride
    && (control_status & (
      CONTROL_STATUS_INITIALIZED | CONTROL_STATUS_COMPACT_READY
    )) == (CONTROL_STATUS_INITIALIZED | CONTROL_STATUS_COMPACT_READY)
    && (control_status & CONTROL_STATUS_FAILED) == 0u;
}

fn directory_contract_ready() -> bool {
  let status = directory[2u];
  let live_count = atomicLoad(&authority[8u]);
  return authority_identity_ready()
    && directory[0u] == SPATIAL_MAGIC
    && directory[1u] == SPATIAL_VERSION
    && (status & (SPATIAL_STATUS_READY | SPATIAL_STATUS_ADMITTED))
      == (SPATIAL_STATUS_READY | SPATIAL_STATUS_ADMITTED)
    && (status & SPATIAL_STATUS_REJECT_MASK) == 0u
    && directory[3u] == params.directory_generation_id
    && directory[8u] == atomicLoad(&authority[6u])
    && directory[16u] == live_count
    && directory[17u] == params.source_capacity
    && directory[18u] <= live_count
    && directory[19u] == params.cell_capacity
    && directory[22u] == params.directory_capacity_words
    && directory[23u] == 0u
    && directory[24u] == 0u
    && directory[25u] == 5u
    && directory[26u] == 5u
    && directory[27u] == SPATIAL_SORT_LEXICOGRAPHIC
    && directory[28u] == 48u
    && directory[29u] == params.cell_keys_offset_words
    && directory[30u] == params.cell_offsets_offset_words
    && directory[31u] == params.cell_members_offset_words
    && directory[32u] == params.particle_to_cell_offset_words
    && directory[33u] == directory[35u]
    && directory[35u] != 0u
    && directory[36u] == params.directory_generation_id
    && directory[37u] == live_count
    && directory[38u] == directory[18u]
    && directory[39u] == 1u
    && directory[40u] == 0u
    && directory[41u] == 1u
    && directory[42u] == atomicLoad(&authority[22u])
    && directory[43u] == atomicLoad(&authority[23u])
    && directory[44u] == atomicLoad(&authority[24u])
    && directory[42u] == atomicLoad(&authority[25u])
    && directory[43u] == atomicLoad(&authority[26u])
    && directory[44u] == atomicLoad(&authority[27u])
    && directory[46u] == SPATIAL_ACTIVE_NODE_ADAPTER;
}

fn directory_ready() -> bool {
  return directory_contract_ready() && atomicLoad(&authority[3u]) == 0u;
}

fn record_eos_error(error_flag: u32) {
  atomicOr(&authority[3u], error_flag);
  atomicAdd(&authority[15u], 1u);
}

fn linear_cell_index(
  local_id: vec3<u32>,
  workgroup_id: vec3<u32>,
  dispatch_x: u32
) -> u32 {
  let linear_group = workgroup_id.x
    + workgroup_id.y * max(dispatch_x, 1u);
  return linear_group * 64u + local_id.x;
}

fn key_word(cell_index: u32, word: u32) -> u32 {
  return directory[params.cell_keys_offset_words + cell_index * 5u + word];
}

fn decoded_signed_order_key(value: u32) -> i32 {
  return bitcast<i32>(value ^ 0x80000000u);
}

fn compare_cell_key(cell_index: u32, sought_key: array<u32, 5>) -> i32 {
  for (var word = 0u; word < 5u; word = word + 1u) {
    let actual = key_word(cell_index, word);
    if (actual < sought_key[word]) { return -1; }
    if (actual > sought_key[word]) { return 1; }
  }
  return 0;
}

fn find_cell(sought_key: array<u32, 5>) -> u32 {
  var low = 0u;
  var high = directory[18u];
  loop {
    if (low >= high) { break; }
    let middle = low + (high - low) / 2u;
    let comparison = compare_cell_key(middle, sought_key);
    if (comparison < 0) {
      low = middle + 1u;
    } else {
      high = middle;
    }
  }
  if (low < directory[18u] && compare_cell_key(low, sought_key) == 0) {
    return low;
  }
  return 0xffffffffu;
}

@compute @workgroup_size(64)
fn aggregate_cells(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let cell_index = linear_cell_index(
    local_id,
    workgroup_id,
    atomicLoad(&authority[22u])
  );
  if (
    !directory_ready()
    || cell_index >= directory[18u]
  ) {
    return;
  }
  let output = cell_index * params.pressure_stride;
  for (var word = 0u; word < params.pressure_stride; word = word + 1u) {
    pressure_cells[output + word] = 0.0;
  }
  if (
    key_word(cell_index, 0u) != params.chart_id
    || key_word(cell_index, 1u) != params.level_order_key
  ) {
    record_eos_error(CONTROL_ERROR_EOS_INVALID);
    return;
  }
  let member_begin = directory[params.cell_offsets_offset_words + cell_index];
  let member_end = directory[params.cell_offsets_offset_words + cell_index + 1u];
  let live_count = atomicLoad(&authority[8u]);
  if (member_begin > member_end || member_end > live_count) {
    record_eos_error(CONTROL_ERROR_EOS_INVALID);
    return;
  }

  var total_moles = 0.0;
  var total_mass_kg = 0.0;
  var total_volume_m3 = 0.0;
  var mole_temperature_k = 0.0;
  var mole_position_m = vec3<f32>(0.0);
  for (var member = member_begin; member < member_end; member = member + 1u) {
    let source_index = directory[params.cell_members_offset_words + member];
    if (source_index >= live_count) {
      record_eos_error(CONTROL_ERROR_EOS_INVALID);
      return;
    }
    let row = source_index * params.compact_stride;
    let status = compact_rows[row + 10u];
    let routing = compact_rows[row + 11u];
    let moles = compact_rows[row + 5u];
    let volume_m3 = compact_rows[row + 7u];
    let position_m = vec3<f32>(
      compact_rows[row + 0u],
      compact_rows[row + 1u],
      compact_rows[row + 2u]
    );
    let row_ready = status > 0.5
      && routing > 0.5
      && routing < 1.5
      && finite_f32(moles)
      && moles > 0.0
      && finite_f32(volume_m3)
      && volume_m3 > 0.0
      && all(vec3<bool>(
        finite_f32(position_m.x),
        finite_f32(position_m.y),
        finite_f32(position_m.z)
      ));
    let source_mass_kg = compact_rows[row + 4u];
    if (!row_ready || !finite_f32(source_mass_kg) || !(source_mass_kg > 0.0)) {
      record_eos_error(CONTROL_ERROR_EOS_INVALID);
      return;
    }
    let source_temperature = compact_rows[row + 6u];
    let temperature_k = select(
      params.fallback_temperature_k,
      source_temperature,
      finite_f32(source_temperature) && source_temperature > 0.0
    );
    total_moles = total_moles + moles;
    total_mass_kg = total_mass_kg + source_mass_kg;
    total_volume_m3 = total_volume_m3 + volume_m3;
    mole_temperature_k = mole_temperature_k + moles * temperature_k;
    mole_position_m = mole_position_m + position_m * moles;
  }
  if (!(total_moles > 0.0) || !(total_volume_m3 > 0.0)) {
    record_eos_error(CONTROL_ERROR_EOS_INVALID);
    return;
  }
  let pressure_pa = mole_temperature_k
    * params.gas_constant_j_per_mol_k / total_volume_m3;
  let center_m = mole_position_m / total_moles;
  if (
    !finite_f32(pressure_pa)
    || pressure_pa < 0.0
    || !all(vec3<bool>(
      finite_f32(center_m.x),
      finite_f32(center_m.y),
      finite_f32(center_m.z)
    ))
  ) {
    record_eos_error(CONTROL_ERROR_EOS_INVALID);
    return;
  }
  pressure_cells[output + 0u] = f32(decoded_signed_order_key(key_word(cell_index, 2u)));
  pressure_cells[output + 1u] = f32(decoded_signed_order_key(key_word(cell_index, 3u)));
  pressure_cells[output + 2u] = f32(decoded_signed_order_key(key_word(cell_index, 4u)));
  pressure_cells[output + 3u] = 1.0;
  pressure_cells[output + 4u] = center_m.x;
  pressure_cells[output + 5u] = center_m.y;
  pressure_cells[output + 6u] = center_m.z;
  pressure_cells[output + 7u] = pressure_pa;
  pressure_cells[output + 8u] = 0.0;
  pressure_cells[output + 9u] = 0.0;
  pressure_cells[output + 10u] = 0.0;
  pressure_cells[output + 11u] = total_volume_m3;
  atomicAdd(&authority[11u], 1u);
}

fn ready_neighbor(cell_index: u32) -> bool {
  if (cell_index == 0xffffffffu || cell_index >= directory[18u]) {
    return false;
  }
  let row = cell_index * params.pressure_stride;
  return pressure_cells[row + 3u] > 0.5
    && finite_f32(pressure_cells[row + 7u])
    && pressure_cells[row + 7u] >= 0.0;
}

fn neighbor_key(cell_index: u32, axis: u32, positive: bool) -> array<u32, 5> {
  var key: array<u32, 5>;
  for (var word = 0u; word < 5u; word = word + 1u) {
    key[word] = key_word(cell_index, word);
  }
  let component = 2u + axis;
  if (positive) {
    if (key[component] == 0xffffffffu) {
      key[0u] = 0xffffffffu;
      key[1u] = 0xffffffffu;
      return key;
    }
    key[component] = key[component] + 1u;
  } else {
    if (key[component] == 0u) {
      key[0u] = 0xffffffffu;
      key[1u] = 0xffffffffu;
      return key;
    }
    key[component] = key[component] - 1u;
  }
  return key;
}

@compute @workgroup_size(64)
fn derive_gradients(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let cell_index = linear_cell_index(
    local_id,
    workgroup_id,
    atomicLoad(&authority[25u])
  );
  if (
    !directory_ready()
    || cell_index >= directory[18u]
  ) {
    return;
  }
  let output = cell_index * params.pressure_stride;
  if (pressure_cells[output + 3u] <= 0.5) {
    record_eos_error(CONTROL_ERROR_EOS_INVALID);
    return;
  }
  let center_pressure = pressure_cells[output + 7u];
  var gradient = vec3<f32>(0.0);
  for (var axis = 0u; axis < 3u; axis = axis + 1u) {
    let plus_index = find_cell(neighbor_key(cell_index, axis, true));
    let minus_index = find_cell(neighbor_key(cell_index, axis, false));
    let plus_ready = ready_neighbor(plus_index);
    let minus_ready = ready_neighbor(minus_index);
    var component = 0.0;
    if (plus_ready && minus_ready) {
      let plus = plus_index * params.pressure_stride;
      let minus = minus_index * params.pressure_stride;
      let distance_m = 2.0 * params.cell_size_m;
      if (distance_m != 0.0) {
        component = (pressure_cells[plus + 7u] - pressure_cells[minus + 7u])
          / distance_m;
      }
    } else if (plus_ready) {
      let plus = plus_index * params.pressure_stride;
      let distance_m = params.cell_size_m;
      if (distance_m != 0.0) {
        component = (pressure_cells[plus + 7u] - center_pressure) / distance_m;
      }
    } else if (minus_ready) {
      let minus = minus_index * params.pressure_stride;
      let distance_m = params.cell_size_m;
      if (distance_m != 0.0) {
        component = (center_pressure - pressure_cells[minus + 7u]) / distance_m;
      }
    }
    if (finite_f32(component)) {
      gradient[axis] = component;
    }
  }
  pressure_cells[output + 8u] = gradient.x;
  pressure_cells[output + 9u] = gradient.y;
  pressure_cells[output + 10u] = gradient.z;
}

@compute @workgroup_size(1)
fn finalize_eos() {
  let identity_ready = authority_identity_ready();
  let directory_ready_for_eos = directory_contract_ready();
  let live_count = atomicLoad(&authority[8u]);
  let directory_cell_count = select(0u, directory[18u], directory_ready_for_eos);
  if (!identity_ready) {
    atomicOr(&authority[3u], CONTROL_ERROR_GENERATION_MISMATCH);
    atomicAdd(&authority[15u], 1u);
  } else if (!directory_ready_for_eos) {
    atomicOr(&authority[3u], CONTROL_ERROR_DIRECTORY_REJECTED);
    atomicAdd(&authority[14u], 1u);
  } else if (atomicLoad(&authority[11u]) != directory_cell_count) {
    atomicOr(&authority[3u], CONTROL_ERROR_COUNT_MISMATCH);
    atomicAdd(&authority[15u], 1u);
  }

  let errors = atomicLoad(&authority[3u]);
  if (errors == 0u) {
    atomicStore(&authority[9u], directory[3u]);
    atomicStore(&authority[10u], directory_cell_count);
    atomicStore(&authority[5u], params.execution_generation);
    var status = atomicLoad(&authority[2u])
      | CONTROL_STATUS_DIRECTORY_READY
      | CONTROL_STATUS_EOS_READY
      | CONTROL_STATUS_PRESSURE_READY;
    if (live_count == 0u) { status = status | CONTROL_STATUS_EMPTY; }
    atomicStore(&authority[2u], status);
  } else {
    atomicOr(&authority[2u], CONTROL_STATUS_FAILED);
    atomicStore(&authority[5u], 0u);
    atomicStore(&authority[9u], 0u);
    atomicStore(&authority[10u], 0u);
  }
}
`;

function adapterPipelines(device) {
  return {
    classify: createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-sph-spatial-gas-ledger-product-event-classify.v2',
      label: 'ulg-sph-spatial-gas-ledger-product-event-classify',
      code: sphSpatialGasLedgerProductEventAdapterWgsl,
      entryPoint: 'classify_product_events',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(5, 'storage'),
        computeBufferBinding(6, 'uniform')
      ]
    }),
    finalize: createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-sph-spatial-gas-ledger-product-event-finalize.v2',
      label: 'ulg-sph-spatial-gas-ledger-product-event-finalize',
      code: sphSpatialGasLedgerProductEventAdapterWgsl,
      entryPoint: 'finalize_compaction',
      bindings: [
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(5, 'storage'),
        computeBufferBinding(6, 'uniform')
      ]
    }),
    scatter: createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-sph-spatial-gas-ledger-product-event-scatter.v2',
      label: 'ulg-sph-spatial-gas-ledger-product-event-scatter',
      code: sphSpatialGasLedgerProductEventAdapterWgsl,
      entryPoint: 'scatter_compact_rows',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'storage'),
        computeBufferBinding(4, 'storage'),
        computeBufferBinding(5, 'storage'),
        computeBufferBinding(6, 'uniform')
      ]
    })
  };
}

function eosPipelines(device) {
  const bindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'uniform'),
    computeBufferBinding(4, 'storage')
  ];
  return {
    aggregate: createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-sph-spatial-gas-ledger-eos-aggregate.v2',
      label: 'ulg-sph-spatial-gas-ledger-eos-aggregate',
      code: sphSpatialGasLedgerEosWgsl,
      entryPoint: 'aggregate_cells',
      bindings
    }),
    gradient: createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-sph-spatial-gas-ledger-eos-gradient.v2',
      label: 'ulg-sph-spatial-gas-ledger-eos-gradient',
      code: sphSpatialGasLedgerEosWgsl,
      entryPoint: 'derive_gradients',
      bindings
    }),
    finalize: createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-sph-spatial-gas-ledger-eos-finalize.v2',
      label: 'ulg-sph-spatial-gas-ledger-eos-finalize',
      code: sphSpatialGasLedgerEosWgsl,
      entryPoint: 'finalize_eos',
      bindings
    })
  };
}

function makeBindGroup(device, label, layout, entries) {
  return device.createBindGroup({ label, layout, entries });
}

function activeNodeDirectorySource({
  slot,
  capacity,
  executionGeneration,
  epochIdentity,
  cellSizeM,
  chartId,
  level
}) {
  const logicalSourceCountAuthority = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_GPU_LOGICAL_COUNT_SOURCE_SCHEMA,
    status: 'schroeder-spatial-gpu-logical-count-source-ready',
    ready: true,
    buffer: slot.controlBuffer,
    byteOffset:
      SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.LIVE_RESIDUAL_COUNT
      * UINT32_BYTES,
    sourceCapacity: capacity,
    storageGeneration: epochIdentity.storageGeneration,
    executionGeneration
  });
  return {
    schema: 'peercompute.ulg.sph-spatial-gas-active-node-adapter.v2',
    status: 'sph-spatial-gas-active-node-adapter-submitted',
    spatialDirectorySourceSchema: ULG_SCHROEDER_SPATIAL_DIRECTORY_SOURCE_SCHEMA,
    spatialDirectorySourceStatus: 'schroeder-spatial-directory-source-ready',
    spatialDirectorySourceReady: true,
    spatialEpochSourceSchema:
      'peercompute.ulg.sph-product-event-capacity-spatial-source.v1',
    spatialEpochSourceStatus: 'sph-product-event-capacity-spatial-source-ready',
    spatialEpochSourceReady: true,
    spatialEpochPositionAuthority: PRODUCT_EVENT_POSITION_AUTHORITY,
    spatialEpochLevelSpacingMode: 'uniform-gas-cell-size',
    spatialEpochBaseGridSpacingM: cellSizeM,
    spatialEpochMinLevel: level,
    spatialEpochMaxLevel: level,
    spatialEpochChartId: chartId,
    activeCandidateCount: capacity,
    activeNodeCount: capacity,
    activeNodeStrideFloats: SPH_SPATIAL_GAS_ACTIVE_NODE_ROW_FLOATS,
    activeNodeBuffer: slot.activeNodeBuffer,
    buffer: slot.activeNodeBuffer,
    logicalSourceCountAuthority,
    logicalSourceCountGpuAuthored: true,
    spatialEpochStorageGeneration: epochIdentity.storageGeneration,
    spatialEpochPhysicsTick: epochIdentity.physicsTick,
    spatialEpochPhysicsSubstep: epochIdentity.physicsSubstep,
    spatialEpochPositionEpoch: epochIdentity.positionEpoch,
    spatialEpochTopologyEpoch: epochIdentity.topologyEpoch,
    spatialEpochChartEpoch: epochIdentity.chartEpoch,
    spatialEpochLevelEpoch: epochIdentity.levelEpoch,
    spatialEpochSupportEpoch: epochIdentity.supportEpoch,
    phaseVolumeAssignmentOverlayEnabled: false,
    sourceValidityAuthority:
      'stable-gpu-residual-compaction-with-authenticated-logical-prefix-count'
  };
}

function scheduleFailureCleanup({
  device,
  slot,
  ownerToken,
  spatialGeneration = null,
  releaseSourceBorrow,
  workSubmitted = false
}) {
  if (workSubmitted !== true) {
    // No command using the borrowed source or arena slot reached the queue, so
    // synchronous retirement is exact and avoids consuming a slot forever on
    // a setup/validation exception.
    releaseSourceBorrow();
    if (slot.ownerToken === ownerToken) {
      slot.pendingFailure = null;
      slot.retainedExecution = null;
      slot.releasePromise = null;
      slot.ownerToken = null;
      slot.inUse = false;
    }
    return Promise.resolve(true);
  }
  const failureRecord = {
    ownerToken,
    spatialGeneration,
    releaseSourceBorrow,
    released: false,
    terminal: false,
    status: 'spatial-gas-ledger-eos-submit-failure-awaiting-retirement'
  };
  slot.pendingFailure = failureRecord;
  let completion = null;
  if (spatialGeneration?.selected === true) {
    try {
      const scheduled = releaseSchroederSpatialEpochGenerationAfterQueue(
        spatialGeneration,
        device
      );
      if (scheduled || spatialGeneration.releaseScheduled === true) {
        completion = spatialGeneration.releasePromise;
      }
    } catch {
      completion = null;
    }
  }
  if (!completion && typeof device.queue?.onSubmittedWorkDone === 'function') {
    try {
      completion = device.queue.onSubmittedWorkDone().then(
        () => true,
        () => false
      );
    } catch {
      completion = null;
    }
  }
  if (!completion) {
    // There is no proof that submitted commands stopped using this slot. Fail
    // closed by quarantining the slot and its source borrow until device loss.
    slot.terminal = true;
    failureRecord.terminal = true;
    failureRecord.status =
      'spatial-gas-ledger-eos-submit-failure-quarantined-no-fence';
    const quarantinePromise = Promise.resolve(false);
    slot.releasePromise = quarantinePromise;
    return quarantinePromise;
  }
  const releasePromise = Promise.resolve(completion).then((confirmed) => {
    if (
      slot.ownerToken !== ownerToken
      || slot.pendingFailure !== failureRecord
    ) return false;
    slot.releasePromise = null;
    if (confirmed === true) {
      failureRecord.releaseSourceBorrow();
      failureRecord.released = true;
      failureRecord.status =
        'spatial-gas-ledger-eos-submit-failure-retired';
      const attachedExecution = slot.retainedExecution;
      const attachedRecord = retainedExecutions.get(attachedExecution);
      if (attachedRecord?.ownerToken === ownerToken) {
        attachedRecord.terminal = true;
        attachedRecord.status = 'spatial-gas-ledger-eos-submit-failure-retired';
      }
      slot.pendingFailure = null;
      slot.retainedExecution = null;
      slot.ownerToken = null;
      slot.inUse = false;
      return true;
    }
    const attachedRecord = retainedExecutions.get(slot.retainedExecution);
    if (attachedRecord?.ownerToken === ownerToken) {
      attachedRecord.terminal = true;
      attachedRecord.status = 'spatial-gas-ledger-eos-submit-failure-unconfirmed';
    }
    failureRecord.terminal = true;
    failureRecord.status =
      'spatial-gas-ledger-eos-submit-failure-unconfirmed';
    slot.terminal = true;
    return false;
  }, () => {
    const attachedRecord = retainedExecutions.get(slot.retainedExecution);
    if (attachedRecord?.ownerToken === ownerToken) {
      attachedRecord.terminal = true;
      attachedRecord.status = 'spatial-gas-ledger-eos-submit-failure-unconfirmed';
    }
    failureRecord.terminal = true;
    failureRecord.status =
      'spatial-gas-ledger-eos-submit-failure-unconfirmed';
    slot.terminal = true;
    slot.releasePromise = null;
    return false;
  });
  slot.releasePromise = releasePromise;
  return releasePromise;
}

function attachLifecycleTarget(target, record, releaseOwner) {
  Object.defineProperties(target, {
    releaseStatus: {
      enumerable: true,
      get() { return record.status; }
    },
    releaseScheduled: {
      enumerable: true,
      get() { return Boolean(record.releasePromise); }
    },
    releasePromise: {
      enumerable: true,
      get() { return record.releasePromise; }
    },
    released: {
      enumerable: true,
      get() { return record.released; }
    },
    terminal: {
      enumerable: true,
      get() { return record.terminal; }
    },
    gasPressureAuthorityConsumerSubmitted: {
      enumerable: true,
      get() { return record.pressureConsumerSubmitted; }
    },
    gasPressureAuthorityConsumerBorrowed: {
      enumerable: true,
      get() { return Boolean(record.activePressureConsumerReceipt); }
    },
    releaseAfterFinalConsumerQueue: {
      enumerable: true,
      value: releaseOwner
    }
  });
}

function attachLifecycle(execution, spatialSource, gasCellSource, record) {
  retainedExecutions.set(execution, record);
  retainedSpatialGasSources.set(spatialSource, record);
  retainedGasCellSources.set(gasCellSource, record);
  const releaseOwner = () => releaseSphSpatialGasLedgerEosAfterQueue(execution);
  attachLifecycleTarget(execution, record, releaseOwner);
  attachLifecycleTarget(spatialSource, record, releaseOwner);
  attachLifecycleTarget(gasCellSource, record, releaseOwner);
  Object.defineProperties(execution, {
    oracleDiagnostics: {
      enumerable: true,
      get() { return record.oracleDiagnostics; }
    },
    destroySpatialGasLedgerEosBuffers: {
      enumerable: true,
      value: releaseOwner
    },
    destroySpatialGasLedgerRowsBuffer: {
      enumerable: true,
      value: releaseOwner
    },
    destroyGasPressureCellsBuffer: {
      enumerable: true,
      value: releaseOwner
    }
  });
  Object.defineProperty(spatialSource, 'destroySpatialGasLedgerRowsBuffer', {
    enumerable: true,
    value: releaseOwner
  });
  Object.defineProperty(gasCellSource, 'destroyGasPressureCellsBuffer', {
    enumerable: true,
    value: releaseOwner
  });
}

/** True only for the producer-issued source identity; clones never authenticate. */
export function isExactSphSpatialGasPressureAuthoritySource(source) {
  return exactPressureSourceRecord(source) !== null;
}

/**
 * Return a portable observation snapshot. It is deliberately neither a live
 * capability nor sufficient input to the pressure binder.
 */
export function describeSphSpatialGasPressureAuthority(source) {
  const record = exactPressureSourceRecord(source);
  if (!record) return null;
  return Object.freeze({
    schema: ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA,
    status: 'gas-pressure-authority-telemetry-only',
    telemetryOnly: true,
    bindable: false,
    sourceSchema: source.schema,
    sourceStatusObserved: source.status,
    readyObserved: source.ready === true,
    executionGeneration: record.executionGeneration,
    storageGeneration: record.storageGeneration,
    spatialGenerationId: record.spatialGeneration.execution.generationId,
    pressureCellCapacity: record.capacity,
    pressureCellStrideFloats: SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS,
    epochIdentity: record.epochIdentity,
    releaseStatusObserved: record.status,
    releaseScheduledObserved: Boolean(record.releasePromise),
    releasedObserved: record.released,
    terminalObserved: record.terminal,
    consumerSubmittedObserved: record.pressureConsumerSubmitted
  });
}

/**
 * Borrow the exact same-device gas-pressure authority for one pressure-stage
 * queue submission. The GPU-authored ready prefix remains in the control
 * buffer; no host logical count is exposed here.
 */
export function bindSphSpatialGasPressureAuthority(source, { device } = {}) {
  const record = exactPressureSourceRecord(source);
  if (!record) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_UNBRANDED',
      'Gas pressure binding requires the exact producer-issued v2 source'
    );
  }
  if (record.device !== device) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_DEVICE_MISMATCH',
      'Gas pressure authority belongs to another WebGPU device'
    );
  }
  if (
    record.terminal
    || record.released
    || record.releasePromise
    || record.slot.terminal
    || record.slot.destroyed
    || record.spatialGeneration?.releaseScheduled === true
    || record.spatialGeneration?.released === true
  ) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_TERMINAL',
      'Gas pressure authority is releasing, released, or terminal'
    );
  }
  if (
    record.execution?.ready !== true
    || record.slot.ownerToken !== record.ownerToken
    || record.slot.retainedExecution !== record.execution
    || record.spatialGeneration?.selected !== true
    || record.spatialGeneration?.execution?.generationId
      !== source.sourceSpatialGasLedgerGenerationId
  ) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_OWNER_MISMATCH',
      'Gas pressure authority no longer matches its live arena generation'
    );
  }
  if (record.activePressureConsumerReceipt) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_BORROWED',
      'Gas pressure authority already has an outstanding consumer receipt'
    );
  }
  if (record.pressureConsumerSubmitted) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_CONSUMED',
      'Gas pressure authority has already been submitted by its pressure consumer'
    );
  }
  const receipt = Object.freeze({
    schema: ULG_SPH_GAS_PRESSURE_CONSUMER_RECEIPT_SCHEMA,
    status: 'gas-pressure-authority-consumer-borrowed',
    deviceId: webGpuDeviceId(device),
    executionGeneration: record.executionGeneration,
    storageGeneration: record.storageGeneration,
    pressureCellCapacity: record.capacity,
    pressureCellStrideFloats: SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS
  });
  const receiptRecord = {
    receipt,
    record,
    state: 'borrowed'
  };
  retainedPressureConsumerReceipts.set(receipt, receiptRecord);
  record.activePressureConsumerReceipt = receipt;
  record.pressureConsumerBindCount += 1;
  return Object.freeze({
    schema: 'peercompute.ulg.sph-gas-pressure-authority-binding.v1',
    status: 'gas-pressure-authority-binding-authenticated',
    authenticated: true,
    source,
    gasPressureCellsBuffer: record.slot.gasPressureCellsBuffer,
    gasAuthorityControlBuffer: record.slot.controlBuffer,
    gasPressureCellRowCapacity: record.capacity,
    pressureInterfaceGasPressureCellRowStrideFloats:
      SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS,
    executionGeneration: record.executionGeneration,
    storageGeneration: record.storageGeneration,
    receipt,
    consumerReceipt: receipt
  });
}

/** Mark the exact receipt immediately after the pressure command is submitted. */
export function markSphSpatialGasPressureAuthoritySubmitted(receipt) {
  const receiptRecord = retainedPressureConsumerReceipts.get(receipt);
  const record = receiptRecord?.record;
  if (
    !record
    || receiptRecord.receipt !== receipt
    || receiptRecord.state !== 'borrowed'
    || record.activePressureConsumerReceipt !== receipt
    || record.terminal
    || record.released
    || record.releasePromise
    || record.slot.ownerToken !== record.ownerToken
    || record.slot.retainedExecution !== record.execution
  ) {
    return false;
  }
  receiptRecord.state = 'submitted';
  record.activePressureConsumerReceipt = null;
  record.pressureConsumerSubmitted = true;
  record.pressureConsumerSubmitCount += 1;
  return true;
}

/** Abandon only a pre-submit borrow so a later valid consumer may retry. */
export function abandonSphSpatialGasPressureAuthority(receipt) {
  const receiptRecord = retainedPressureConsumerReceipts.get(receipt);
  const record = receiptRecord?.record;
  if (
    !record
    || receiptRecord.receipt !== receipt
    || receiptRecord.state !== 'borrowed'
    || record.activePressureConsumerReceipt !== receipt
  ) {
    return false;
  }
  receiptRecord.state = 'abandoned';
  record.activePressureConsumerReceipt = null;
  record.pressureConsumerAbandonCount += 1;
  return true;
}

/**
 * Build a retained product-event gas source, one family-specific SS directory,
 * and the local ideal-gas EOS pressure rows without mapping or fencing the
 * normal hot path. The returned owner must be released only after its final
 * same-queue consumer has submitted.
 */
export async function runSphSpatialGasLedgerEosRetainedWebGpu({
  device,
  retainedProductEventSource = null,
  residentProductMass = null,
  productEventBuffer = null,
  productEventRowCount = null,
  productEventStrideFloats = null,
  epochIdentity = null,
  spatialGasCellSizeM = null,
  spatialGasSupportVolumeFallbackM3 = 0,
  fallbackTemperatureK = DEFAULT_GAS_TEMPERATURE_K,
  gasConstantJPerMolK = DEFAULT_GAS_CONSTANT_J_PER_MOL_K,
  chartId = 0,
  level = 0,
  laneId = 'sph-spatial-gas-ledger-eos',
  diagnosticsMode = SPH_SPATIAL_GAS_DIAGNOSTICS_NONE
} = {}) {
  if (
    !device?.createBuffer
    || !device?.createCommandEncoder
    || !device?.queue?.writeBuffer
    || !device?.queue?.submit
  ) {
    throw new TypeError(
      'runSphSpatialGasLedgerEosRetainedWebGpu requires a WebGPU-like device and queue'
    );
  }
  if (
    diagnosticsMode !== SPH_SPATIAL_GAS_DIAGNOSTICS_NONE
    && diagnosticsMode !== SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE
  ) {
    return rejectedExecution(
      'spatial-gas-ledger-eos-rejected-diagnostics-mode',
      `Unsupported diagnostics mode: ${diagnosticsMode}`
    );
  }
  const normalizedSource = normalizeSource({
    device,
    retainedProductEventSource,
    residentProductMass,
    productEventBuffer,
    productEventRowCount,
    productEventStrideFloats
  });
  if (normalizedSource.error) return normalizedSource.error;
  const normalizedEpoch = normalizeEpochIdentity(epochIdentity);
  if (normalizedEpoch.error) {
    return rejectedExecution(
      'spatial-gas-ledger-eos-rejected-epoch-identity',
      normalizedEpoch.error.message
    );
  }
  let cellSizeM;
  let supportVolumeFallbackM3;
  let resolvedFallbackTemperatureK;
  let resolvedGasConstant;
  let resolvedChartId;
  let resolvedLevel;
  let capacityDispatchCount;
  try {
    supportVolumeFallbackM3 = nonNegativeFiniteF32(
      spatialGasSupportVolumeFallbackM3,
      'spatialGasSupportVolumeFallbackM3'
    );
    const inferredCellSizeM = spatialGasCellSizeM == null
      ? Math.cbrt(supportVolumeFallbackM3)
      : spatialGasCellSizeM;
    cellSizeM = positiveFiniteF32(inferredCellSizeM, 'spatialGasCellSizeM');
    resolvedFallbackTemperatureK = positiveFiniteF32(
      fallbackTemperatureK,
      'fallbackTemperatureK'
    );
    resolvedGasConstant = positiveFiniteF32(
      gasConstantJPerMolK,
      'gasConstantJPerMolK'
    );
    resolvedChartId = exactU32(chartId, 'chartId');
    if (resolvedChartId > MAX_EXACT_F32_INTEGER) {
      throw new RangeError('chartId exceeds exact f32 integer identity');
    }
    resolvedLevel = Number(level);
    if (
      !Number.isInteger(resolvedLevel)
      || resolvedLevel < -MAX_EXACT_F32_INTEGER
      || resolvedLevel > MAX_EXACT_F32_INTEGER
    ) {
      throw new RangeError('level exceeds exact f32 signed integer identity');
    }
    capacityDispatchCount = sphSpatialGasLedgerEosDispatchWorkgroups(
      device,
      nextPowerOfTwo(normalizedSource.rowCount)
    );
  } catch (error) {
    return rejectedExecution(
      error?.code === 'ERR_SPH_SPATIAL_GAS_LEDGER_EOS_DISPATCH_LIMIT'
        ? 'spatial-gas-ledger-eos-rejected-dispatch-limit'
        : 'spatial-gas-ledger-eos-rejected-grid-contract',
      error.message,
      error?.code === 'ERR_SPH_SPATIAL_GAS_LEDGER_EOS_DISPATCH_LIMIT'
        ? {
            errorCode: error.code,
            requiredWorkgroups: error.requiredWorkgroups,
            maxComputeWorkgroupsPerDimension:
              error.maxComputeWorkgroupsPerDimension
          }
        : {}
    );
  }

  const releaseSourceBorrow = sourceBorrowFor(normalizedSource.source);
  if (!releaseSourceBorrow) {
    return rejectedExecution(
      'spatial-gas-ledger-eos-rejected-source-lifecycle',
      'Unable to acquire the exact retained source borrow'
    );
  }
  let arena;
  try {
    arena = await acquireArenaSlot(device, normalizedSource.rowCount);
  } catch (error) {
    releaseSourceBorrow();
    return rejectedExecution(
      error.code === 'ERR_SPH_SPATIAL_GAS_LEDGER_EOS_ARENA_BACKPRESSURE'
        ? 'spatial-gas-ledger-eos-backpressure'
        : 'spatial-gas-ledger-eos-rejected-arena',
      error.message,
      { errorCode: error.code ?? null }
    );
  }
  const { runtime, slot, capacity, backpressureWaited } = arena;
  const ownerToken = slot.ownerToken;
  const executionGeneration = exactU32(
    ownerToken.serial,
    'spatial gas execution generation',
    { positive: true }
  );
  let adapterSubmitted = false;
  let spatialGeneration = null;
  let adapterScanDispatchCount = 0;
  try {
    const adapter = adapterPipelines(device);
    device.queue.writeBuffer(slot.controlBuffer, 0, initialAuthorityControl({
      executionGeneration,
      storageGeneration: normalizedEpoch.storageGeneration,
      sourceCapacity: capacity
    }));
    device.queue.writeBuffer(slot.paramsBuffer, 0, adapterParams({
      rowCount: normalizedSource.rowCount,
      sourceCapacity: capacity,
      strideFloats: normalizedSource.strideFloats,
      cellSizeM,
      chartId: resolvedChartId,
      level: resolvedLevel,
      executionGeneration,
      fallbackTemperatureK: resolvedFallbackTemperatureK
    }));
    const classifyBindGroup = makeBindGroup(
      device,
      `${slot.label}-adapter-classify-bind-group`,
      adapter.classify.bindGroupLayout,
      [
        {
          binding: 0,
          resource: {
            buffer: normalizedSource.buffer,
            offset: 0,
            size: normalizedSource.requiredBytes
          }
        },
        { binding: 1, resource: { buffer: slot.candidateFlagsBuffer } },
        { binding: 5, resource: { buffer: slot.controlBuffer } },
        { binding: 6, resource: { buffer: slot.paramsBuffer } }
      ]
    );
    const finalizeBindGroup = makeBindGroup(
      device,
      `${slot.label}-adapter-finalize-bind-group`,
      adapter.finalize.bindGroupLayout,
      [
        { binding: 1, resource: { buffer: slot.candidateFlagsBuffer } },
        { binding: 2, resource: { buffer: slot.candidateOffsetsBuffer } },
        { binding: 5, resource: { buffer: slot.controlBuffer } },
        { binding: 6, resource: { buffer: slot.paramsBuffer } }
      ]
    );
    const scatterBindGroup = makeBindGroup(
      device,
      `${slot.label}-adapter-scatter-bind-group`,
      adapter.scatter.bindGroupLayout,
      [
        {
          binding: 0,
          resource: {
            buffer: normalizedSource.buffer,
            offset: 0,
            size: normalizedSource.requiredBytes
          }
        },
        { binding: 1, resource: { buffer: slot.candidateFlagsBuffer } },
        { binding: 2, resource: { buffer: slot.candidateOffsetsBuffer } },
        { binding: 3, resource: { buffer: slot.compactRowsBuffer } },
        { binding: 4, resource: { buffer: slot.activeNodeBuffer } },
        { binding: 5, resource: { buffer: slot.controlBuffer } },
        { binding: 6, resource: { buffer: slot.paramsBuffer } }
      ]
    );
    const adapterEncoder = device.createCommandEncoder({
      label: `${slot.label}-adapter-encoder`
    });
    const classifyPass = adapterEncoder.beginComputePass({
      label: `${slot.label}-adapter-classify-pass`
    });
    classifyPass.setPipeline(adapter.classify.pipeline);
    classifyPass.setBindGroup(0, classifyBindGroup);
    classifyPass.dispatchWorkgroups(capacityDispatchCount);
    classifyPass.end();
    const preparedScan = slot.compactionScan.prepare({
      inputBuffer: slot.candidateFlagsBuffer,
      outputBuffer: slot.candidateOffsetsBuffer,
      elementCount: capacity
    });
    slot.compactionScan.encodePrepared(adapterEncoder, preparedScan, {
      labelPrefix: `${slot.label}-adapter-candidate`
    });
    adapterScanDispatchCount = preparedScan.encodedDispatchCount;
    const finalizePass = adapterEncoder.beginComputePass({
      label: `${slot.label}-adapter-finalize-pass`
    });
    finalizePass.setPipeline(adapter.finalize.pipeline);
    finalizePass.setBindGroup(0, finalizeBindGroup);
    finalizePass.dispatchWorkgroups(1);
    finalizePass.end();
    const scatterPass = adapterEncoder.beginComputePass({
      label: `${slot.label}-adapter-scatter-pass`
    });
    scatterPass.setPipeline(adapter.scatter.pipeline);
    scatterPass.setBindGroup(0, scatterBindGroup);
    scatterPass.dispatchWorkgroups(capacityDispatchCount);
    scatterPass.end();
    device.queue.submit([adapterEncoder.finish()]);
    adapterSubmitted = true;

    const directorySource = activeNodeDirectorySource({
      slot,
      capacity,
      executionGeneration,
      epochIdentity: normalizedEpoch,
      cellSizeM,
      chartId: resolvedChartId,
      level: resolvedLevel
    });
    spatialGeneration = await runSchroederSpatialEpochGenerationWithBackpressureWebGpu({
      device,
      activeNodeList: directorySource,
      particleCount: capacity,
      laneId,
      sourceFamily: PRODUCT_EVENT_SOURCE_FAMILY,
      allowPhaseVolumeOverlay: false
    });
    if (
      spatialGeneration?.ready !== true
      || spatialGeneration?.selected !== true
      || spatialGeneration?.execution?.sourceBuffer !== slot.activeNodeBuffer
      || spatialGeneration?.execution?.directoryBuffer == null
      || spatialGeneration?.execution?.logicalSourceCountAuthority
        !== directorySource.logicalSourceCountAuthority
      || spatialGeneration?.source?.logicalSourceCountAuthority
        !== directorySource.logicalSourceCountAuthority
      || spatialGeneration?.source?.positionEpoch !== normalizedEpoch.positionEpoch
      || spatialGeneration?.source?.topologyEpoch !== normalizedEpoch.topologyEpoch
    ) {
      const reason = spatialGeneration?.reason
        || 'The gas source-family SS directory was not retained and generation-bound';
      const cleanupPromise = scheduleFailureCleanup({
        device,
        slot,
        ownerToken,
        spatialGeneration,
        releaseSourceBorrow,
        workSubmitted: adapterSubmitted
      });
      return rejectedExecution(
        'spatial-gas-ledger-eos-rejected-spatial-generation',
        reason,
        {
          cleanupScheduled: true,
          cleanupPromise,
          spatialGenerationStatus: spatialGeneration?.status ?? null
        }
      );
    }

    const pipelines = eosPipelines(device);
    device.queue.writeBuffer(slot.paramsBuffer, 0, eosParams({
      sourceCapacity: capacity,
      executionGeneration,
      generation: spatialGeneration,
      gasConstantJPerMolK: resolvedGasConstant,
      cellSizeM,
      fallbackTemperatureK: resolvedFallbackTemperatureK,
      chartId: resolvedChartId,
      level: resolvedLevel
    }));
    const eosEntries = [
      { binding: 0, resource: { buffer: slot.compactRowsBuffer } },
      {
        binding: 1,
        resource: { buffer: spatialGeneration.execution.directoryBuffer }
      },
      { binding: 2, resource: { buffer: slot.gasPressureCellsBuffer } },
      { binding: 3, resource: { buffer: slot.paramsBuffer } },
      { binding: 4, resource: { buffer: slot.controlBuffer } }
    ];
    const aggregateBindGroup = makeBindGroup(
      device,
      `${slot.label}-eos-aggregate-bind-group`,
      pipelines.aggregate.bindGroupLayout,
      eosEntries
    );
    const gradientBindGroup = makeBindGroup(
      device,
      `${slot.label}-eos-gradient-bind-group`,
      pipelines.gradient.bindGroupLayout,
      eosEntries
    );
    const finalizerBindGroup = makeBindGroup(
      device,
      `${slot.label}-eos-finalizer-bind-group`,
      pipelines.finalize.bindGroupLayout,
      eosEntries
    );
    const eosEncoder = device.createCommandEncoder({
      label: `${slot.label}-eos-encoder`
    });
    eosEncoder.copyBufferToBuffer(
      spatialGeneration.execution.consumerDispatchBuffer,
      0,
      slot.controlBuffer,
      SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.EOS_AGGREGATE_DISPATCH_X
        * UINT32_BYTES,
      3 * UINT32_BYTES
    );
    eosEncoder.copyBufferToBuffer(
      spatialGeneration.execution.consumerDispatchBuffer,
      0,
      slot.controlBuffer,
      SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.EOS_GRADIENT_DISPATCH_X
        * UINT32_BYTES,
      3 * UINT32_BYTES
    );
    const aggregatePass = eosEncoder.beginComputePass({
      label: `${slot.label}-eos-aggregate-pass`
    });
    aggregatePass.setPipeline(pipelines.aggregate.pipeline);
    aggregatePass.setBindGroup(0, aggregateBindGroup);
    aggregatePass.dispatchWorkgroupsIndirect(
      spatialGeneration.execution.consumerDispatchBuffer,
      0
    );
    aggregatePass.end();
    const gradientPass = eosEncoder.beginComputePass({
      label: `${slot.label}-eos-gradient-pass`
    });
    gradientPass.setPipeline(pipelines.gradient.pipeline);
    gradientPass.setBindGroup(0, gradientBindGroup);
    gradientPass.dispatchWorkgroupsIndirect(
      spatialGeneration.execution.consumerDispatchBuffer,
      0
    );
    gradientPass.end();
    const finalizerPass = eosEncoder.beginComputePass({
      label: `${slot.label}-eos-finalizer-pass`
    });
    finalizerPass.setPipeline(pipelines.finalize.pipeline);
    finalizerPass.setBindGroup(0, finalizerBindGroup);
    finalizerPass.dispatchWorkgroups(1);
    finalizerPass.end();
    device.queue.submit([eosEncoder.finish()]);

    const deviceId = webGpuDeviceId(device);
    const compactRowByteLength = capacity
      * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS
      * FLOAT32_BYTES;
    const pressureRowByteLength = capacity
      * SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS
      * FLOAT32_BYTES;
    const frozenEpochIdentity = Object.freeze({ ...normalizedEpoch });
    const retainedSpatialGasLedgerSource = {
      schema: ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA,
      status: 'retained-spatial-gas-ledger-source-submitted',
      ready: true,
      deviceId,
      sourceFamily: PRODUCT_EVENT_SOURCE_FAMILY,
      positionAuthority: PRODUCT_EVENT_POSITION_AUTHORITY,
      sourceProductEventBuffer: normalizedSource.buffer,
      sourceProductEventBufferBorrowed: true,
      sourceProductEventRowCount: normalizedSource.rowCount,
      sourceProductEventStrideFloats: normalizedSource.strideFloats,
      compactSpatialGasRowsBuffer: slot.compactRowsBuffer,
      compactSpatialGasRowCapacity: capacity,
      compactSpatialGasRowStrideFloats:
        SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS,
      compactSpatialGasRowByteLength: compactRowByteLength,
      compactSpatialGasLogicalCountAuthority:
        directorySource.logicalSourceCountAuthority,
      activeNodeBuffer: slot.activeNodeBuffer,
      activeNodeRowCapacity: capacity,
      activeNodeRowStrideFloats: SPH_SPATIAL_GAS_ACTIVE_NODE_ROW_FLOATS,
      gasAuthorityControlBuffer: slot.controlBuffer,
      gasAuthorityControlSchema:
        'peercompute.ulg.sph-spatial-gas-authority-control.v2',
      gasAuthorityControlByteLength: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_BYTES,
      gasAuthorityControlMagic: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_MAGIC,
      gasAuthorityControlVersion: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION,
      gasAuthorityControlOffsets: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS,
      executionGeneration,
      storageGeneration: normalizedEpoch.storageGeneration,
      spatialEpochGeneration: spatialGeneration,
      spatialEpochGenerationId: spatialGeneration.execution.generationId,
      spatialEpochDirectoryBuffer: spatialGeneration.execution.directoryBuffer,
      spatialEpochDirectoryByteLength: spatialGeneration.execution.layout.byteLength,
      epochIdentity: frozenEpochIdentity,
      spatialGasCellSizeM: cellSizeM,
      spatialGasSupportVolumeFallbackM3: supportVolumeFallbackM3,
      sourceValidityAuthority:
        'gpu-compacted-logical-prefix-inside-authenticated-capacity-allocation',
      consumerAccessProtocol:
        'same-device-exact-retained-gpu-authority.v2',
      lifecycleOwner: 'spatial-gas-ledger-eos-final-consumer-owner',
      finalConsumerReleaseRequired: true,
      diagnosticsMode
    };
    const retainedGasCellFieldSource = {
      schema: ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
      status: 'retained-gas-cell-eos-source-submitted',
      ready: true,
      deviceId,
      gasPressureCellsBuffer: slot.gasPressureCellsBuffer,
      retainedGasPressureCellsBuffer: slot.gasPressureCellsBuffer,
      pressureInterfaceGasPressureCellsBuffer: slot.gasPressureCellsBuffer,
      gasPressureCellRowCapacity: capacity,
      pressureInterfaceGasPressureCellRowCapacity: capacity,
      pressureInterfaceGasPressureCellRowStrideFloats:
        SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS,
      pressureInterfaceGasPressureCellRowByteLength: pressureRowByteLength,
      pressureInterfaceGasPressureCellRowsBufferRetained: true,
      gasPressureCellRowsBufferBorrowed: false,
      gasAuthorityControlBuffer: slot.controlBuffer,
      gasAuthorityControlSchema:
        'peercompute.ulg.sph-spatial-gas-authority-control.v2',
      gasAuthorityControlByteLength: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_BYTES,
      gasAuthorityControlMagic: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_MAGIC,
      gasAuthorityControlVersion: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION,
      gasAuthorityControlOffsets: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS,
      gasPressureCellLogicalCountAuthority:
        'gas-authority-control-ready-pressure-count-u32',
      executionGeneration,
      storageGeneration: normalizedEpoch.storageGeneration,
      epochIdentity: frozenEpochIdentity,
      gasPressureCellCountAuthority:
        'gpu-authenticated-directory-header-cell-count-with-zero-sealed-capacity-tail',
      sourceSpatialGasLedgerGenerationId:
        spatialGeneration.execution.generationId,
      sourceSpatialGasLedger: retainedSpatialGasLedgerSource,
      pressureFieldMode: 'local-gas-cell-pressure-gradient',
      pressureFieldResolution: 'schroeder-spatial-directory-cells',
      localPressureGradientReady: false,
      localPressureGradientStatus:
        'gpu-authenticated-readiness-in-authority-control-buffer',
      gasCellFieldSnapshot: null,
      hostMaterialized: false,
      eosPressureClosure: 'ideal-gas-law-per-directory-cell',
      scientificValidation: false,
      gasValidation: false,
      fullPhysicsValidation: false,
      consumerAccessProtocol:
        'same-device-exact-retained-gpu-authority.v2',
      finalConsumerReleaseRequired: true
    };
    const execution = {
      schema: ULG_SPH_SPATIAL_GAS_LEDGER_EOS_EXECUTION_SCHEMA,
      status: 'spatial-gas-ledger-eos-gpu-submitted',
      reason: null,
      ready: true,
      selected: true,
      backend: 'webgpu-retained-same-device',
      deviceId,
      productEventRowCount: normalizedSource.rowCount,
      productEventStrideFloats: normalizedSource.strideFloats,
      compactSpatialGasRowsBuffer: slot.compactRowsBuffer,
      compactSpatialGasRowCapacity: capacity,
      compactSpatialGasRowStrideFloats:
        SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS,
      compactSpatialGasRowByteLength: compactRowByteLength,
      compactSpatialGasLogicalCountAuthority:
        directorySource.logicalSourceCountAuthority,
      spatialGasLedgerRowsBufferRetained: true,
      spatialGasLedgerRowsBufferBorrowed: false,
      spatialGeneration,
      spatialGenerationId: spatialGeneration.execution.generationId,
      gasPressureCellsBuffer: slot.gasPressureCellsBuffer,
      retainedGasPressureCellsBuffer: slot.gasPressureCellsBuffer,
      gasPressureCellRowCapacity: capacity,
      pressureInterfaceGasPressureCellRowCapacity: capacity,
      pressureInterfaceGasPressureCellRowStrideFloats:
        SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS,
      pressureInterfaceGasPressureCellRowByteLength: pressureRowByteLength,
      pressureInterfaceGasPressureCellRowsBufferRetained: true,
      gasAuthorityControlBuffer: slot.controlBuffer,
      gasAuthorityControlSchema:
        'peercompute.ulg.sph-spatial-gas-authority-control.v2',
      gasAuthorityControlByteLength: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_BYTES,
      gasAuthorityControlMagic: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_MAGIC,
      gasAuthorityControlVersion: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION,
      gasAuthorityControlOffsets: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS,
      executionGeneration,
      storageGeneration: normalizedEpoch.storageGeneration,
      epochIdentity: frozenEpochIdentity,
      retainedSpatialGasLedgerSourceSchema:
        ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA,
      retainedSpatialGasLedgerSourceStatus:
        retainedSpatialGasLedgerSource.status,
      retainedSpatialGasLedgerSourceReady: true,
      retainedSpatialGasLedgerSource,
      retainedGasCellFieldSourceSchema:
        ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
      retainedGasCellFieldSourceStatus: retainedGasCellFieldSource.status,
      retainedGasCellFieldSourceReady: true,
      retainedGasCellFieldSource,
      spatialGasSpeciesLedger: null,
      gasCellFieldSnapshot: null,
      normalHotLoopReadbackFree: true,
      compactSpatialGasReadbackPerformed: false,
      compactSpatialGasReadbackByteLength: 0,
      gasCellEosReadbackPerformed: false,
      gasCellEosReadbackByteLength: 0,
      mapAsyncCount: 0,
      hostMaterializedRowCount: 0,
      queueCompletionFenceWaited: false,
      queueCompletionStatus: 'queue-submitted-no-host-wait',
      queueCompletionMethod: 'same-device-queue-order',
      adapterDispatchCount: 3 + adapterScanDispatchCount,
      adapterDirectDispatchCount: 3,
      adapterScanDispatchCount,
      spatialDirectoryBuildCount: 1,
      privateSpatialLookupBuildCount: 0,
      exhaustiveSpatialScanCount: 0,
      eosDispatchCount: 3,
      eosIndirectDispatchCount: 2,
      eosFinalizerDispatchCount: 1,
      arenaCapacity: capacity,
      arenaIndex: slot.arenaIndex,
      arenaBackpressureWaited: backpressureWaited,
      arenaBufferReuseCount: runtime.reuseCount,
      diagnosticsMode,
      failClosed: true
    };
    const record = {
      execution,
      spatialSource: retainedSpatialGasLedgerSource,
      gasCellSource: retainedGasCellFieldSource,
      device,
      runtime,
      slot,
      ownerToken,
      spatialGeneration,
      capacity,
      executionGeneration,
      storageGeneration: normalizedEpoch.storageGeneration,
      epochIdentity: frozenEpochIdentity,
      releaseSourceBorrow,
      releasePromise: null,
      released: false,
      terminal: false,
      oracleDiagnostics: null,
      activePressureConsumerReceipt: null,
      pressureConsumerSubmitted: false,
      pressureConsumerBindCount: 0,
      pressureConsumerSubmitCount: 0,
      pressureConsumerAbandonCount: 0,
      status: 'spatial-gas-ledger-eos-retained-for-final-consumer'
    };
    slot.pendingFailure = null;
    slot.retainedExecution = execution;
    attachLifecycle(
      execution,
      retainedSpatialGasLedgerSource,
      retainedGasCellFieldSource,
      record
    );
    Object.freeze(retainedSpatialGasLedgerSource);
    Object.freeze(retainedGasCellFieldSource);

    if (diagnosticsMode === SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE) {
      record.oracleDiagnostics = await observeSphSpatialGasLedgerEosOracle(
        execution
      );
    }
    return Object.freeze(execution);
  } catch (error) {
    const cleanupPromise = scheduleFailureCleanup({
      device,
      slot,
      ownerToken,
      spatialGeneration,
      releaseSourceBorrow,
      workSubmitted: adapterSubmitted
    });
    return rejectedExecution(
      'spatial-gas-ledger-eos-rejected-submit',
      error instanceof Error ? error.message : String(error),
      {
        errorCode: error?.code ?? null,
        adapterSubmitted,
        spatialGenerationStatus: spatialGeneration?.status ?? null,
        cleanupScheduled: true,
        cleanupPromise
      }
    );
  }
}

/** Schedule the one generation-owner fence after the final queue consumer. */
export function releaseSphSpatialGasLedgerEosAfterQueue(execution) {
  const record = retainedExecutions.get(execution);
  if (!record || record.terminal || record.released || record.releasePromise) {
    return false;
  }
  if (record.activePressureConsumerReceipt) {
    record.status =
      'spatial-gas-ledger-eos-release-blocked-active-pressure-consumer';
    return false;
  }
  if (
    execution?.ready !== true
    || execution?.gasPressureCellsBuffer !== record.slot.gasPressureCellsBuffer
    || record.slot.ownerToken !== record.ownerToken
    || record.slot.retainedExecution !== execution
  ) {
    record.status = 'spatial-gas-ledger-eos-release-owner-mismatch';
    return false;
  }
  const scheduled = releaseSchroederSpatialEpochGenerationAfterQueue(
    record.spatialGeneration,
    record.device
  );
  if (
    scheduled !== true
    && record.spatialGeneration.releaseScheduled !== true
  ) {
    record.status = record.spatialGeneration.releaseStatus
      || 'spatial-gas-ledger-eos-release-fence-unavailable';
    return false;
  }
  record.status = 'spatial-gas-ledger-eos-release-scheduled-after-final-consumer';
  record.releasePromise = Promise.resolve(
    record.spatialGeneration.releasePromise
  ).then(
    (confirmed) => releaseSlot(record, confirmed === true),
    () => releaseSlot(record, false)
  );
  record.slot.releasePromise = record.releasePromise;
  return true;
}

async function mappedBufferCopy(device, sourceBuffer, byteLength, label) {
  const size = alignedBytes(byteLength);
  const readback = createOwnedBuffer(device, {
    label,
    size,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  try {
    const encoder = device.createCommandEncoder({ label: `${label}-encoder` });
    encoder.copyBufferToBuffer(sourceBuffer, 0, readback, 0, size);
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPU_MAP_MODE.READ, 0, size);
    const copy = readback.getMappedRange(0, size).slice(0, byteLength);
    readback.unmap();
    return copy;
  } finally {
    readback.destroy?.();
  }
}

function decodeCompactOracle(values) {
  const rows = [];
  for (
    let offset = 0;
    offset + SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS <= values.length;
    offset += SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS
  ) {
    if (!(values[offset + 10] > 0.5)) continue;
    rows.push({
      positionM: Array.from(values.slice(offset, offset + 3)),
      materialId: values[offset + 3],
      massKg: values[offset + 4],
      moles: values[offset + 5],
      temperatureK: values[offset + 6],
      supportVolumeM3: values[offset + 7],
      productTermIndex: values[offset + 8],
      sourceRowIndex: values[offset + 9],
      status: values[offset + 10],
      routingId: values[offset + 11]
    });
  }
  return rows;
}

function decodePressureOracle(values) {
  const cells = [];
  for (
    let offset = 0;
    offset + SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS <= values.length;
    offset += SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS
  ) {
    if (!(values[offset + 3] > 0.5)) continue;
    cells.push({
      index: offset / SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS,
      gridIndex: Array.from(values.slice(offset, offset + 3)),
      centerM: Array.from(values.slice(offset + 4, offset + 7)),
      pressurePa: values[offset + 7],
      pressureGradientPaPerM: Array.from(values.slice(offset + 8, offset + 11)),
      volumeM3: values[offset + 11],
      status: 'local-gas-pressure-cell-ready'
    });
  }
  return cells;
}

function decodeAuthorityControlOracle(copy, record) {
  const words = new Uint32Array(copy);
  const at = SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS;
  const status = words[at.STATUS_FLAGS] >>> 0;
  const errors = words[at.ERROR_FLAGS] >>> 0;
  const requiredReady = SPH_SPATIAL_GAS_AUTHORITY_STATUS.INITIALIZED
    | SPH_SPATIAL_GAS_AUTHORITY_STATUS.COMPACT_READY
    | SPH_SPATIAL_GAS_AUTHORITY_STATUS.DIRECTORY_READY
    | SPH_SPATIAL_GAS_AUTHORITY_STATUS.EOS_READY
    | SPH_SPATIAL_GAS_AUTHORITY_STATUS.PRESSURE_READY;
  const invalid = (
    words[at.MAGIC] !== SPH_SPATIAL_GAS_AUTHORITY_CONTROL_MAGIC
    || words[at.VERSION] !== SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION
    || words[at.EXECUTION_GENERATION] !== record.executionGeneration
    || words[at.COMPLETION_GENERATION] !== record.executionGeneration
    || words[at.SOURCE_STORAGE_GENERATION] !== record.storageGeneration
    || words[at.SOURCE_CAPACITY] !== record.capacity
    || words[at.COMPACT_STRIDE] !== SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS
    || words[at.ACTIVE_NODE_STRIDE] !== SPH_SPATIAL_GAS_ACTIVE_NODE_ROW_FLOATS
    || words[at.PRESSURE_STRIDE] !== SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS
    || errors !== 0
    || (status & SPH_SPATIAL_GAS_AUTHORITY_STATUS.FAILED) !== 0
    || (status & requiredReady) !== requiredReady
  );
  const liveResidualCount = words[at.LIVE_RESIDUAL_COUNT] >>> 0;
  const directoryCellCount = words[at.DIRECTORY_CELL_COUNT] >>> 0;
  const readyPressureCount = words[at.READY_PRESSURE_COUNT] >>> 0;
  if (
    invalid
    || liveResidualCount > record.capacity
    || directoryCellCount > liveResidualCount
    || readyPressureCount !== directoryCellCount
  ) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_CONTROL_INVALID',
      'Gas authority control did not publish one complete authenticated prefix'
    );
  }
  return {
    words,
    status,
    errors,
    liveResidualCount,
    directoryGeneration: words[at.DIRECTORY_GENERATION] >>> 0,
    directoryCellCount,
    readyPressureCount,
    empty: (status & SPH_SPATIAL_GAS_AUTHORITY_STATUS.EMPTY) !== 0
  };
}

/**
 * Explicit O(N) diagnostic oracle. This is the only module path that maps or
 * materializes compact/EOS rows on the host.
 */
export async function observeSphSpatialGasLedgerEosOracle(execution) {
  const record = retainedExecutions.get(execution);
  if (
    !record
    || record.terminal
    || record.released
    || record.releasePromise
    || record.slot.ownerToken !== record.ownerToken
    || record.slot.retainedExecution !== execution
    || execution?.ready !== true
  ) {
    throw new Error('spatial gas ledger/EOS oracle requires a live retained execution');
  }
  const controlCopy = await mappedBufferCopy(
    record.device,
    record.slot.controlBuffer,
    SPH_SPATIAL_GAS_AUTHORITY_CONTROL_BYTES,
    'ulg-sph-spatial-gas-ledger-full-oracle-control'
  );
  const control = decodeAuthorityControlOracle(controlCopy, record);
  const compactByteLength = control.liveResidualCount
    * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS
    * FLOAT32_BYTES;
  const pressureByteLength = control.readyPressureCount
    * SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS
    * FLOAT32_BYTES;
  const headerByteLength = SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS * UINT32_BYTES;
  const [compactCopy, pressureCopy, directoryHeaderCopy] = await Promise.all([
    mappedBufferCopy(
      record.device,
      execution.compactSpatialGasRowsBuffer,
      compactByteLength,
      'ulg-sph-spatial-gas-ledger-full-oracle-compact'
    ),
    mappedBufferCopy(
      record.device,
      execution.gasPressureCellsBuffer,
      pressureByteLength,
      'ulg-sph-spatial-gas-ledger-full-oracle-pressure'
    ),
    mappedBufferCopy(
      record.device,
      record.spatialGeneration.execution.directoryBuffer,
      headerByteLength,
      'ulg-sph-spatial-gas-ledger-full-oracle-directory-header'
    )
  ]);
  const compactValues = new Float32Array(compactCopy);
  const pressureValues = new Float32Array(pressureCopy);
  const directoryHeader = new Uint32Array(directoryHeaderCopy);
  if (
    directoryHeader[0] !== SCHROEDER_SPATIAL_EPOCH_MAGIC
    || directoryHeader[1] !== SCHROEDER_SPATIAL_EPOCH_VERSION
    || directoryHeader[3] !== control.directoryGeneration
    || directoryHeader[16] !== control.liveResidualCount
    || directoryHeader[17] !== record.capacity
    || directoryHeader[18] !== control.directoryCellCount
    || directoryHeader[37] !== control.liveResidualCount
    || directoryHeader[38] !== control.directoryCellCount
  ) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_DIRECTORY_INVALID',
      'Gas authority directory header disagrees with its sealed control record'
    );
  }
  const compactRows = decodeCompactOracle(compactValues);
  const pressureCells = decodePressureOracle(pressureValues);
  return {
    schema: 'peercompute.ulg.sph-spatial-gas-ledger-eos-oracle.v2',
    status: 'spatial-gas-ledger-eos-full-oracle-observed',
    explicitDiagnostic: true,
    diagnosticsMode: SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE,
    mapAsyncCount: 4,
    readbackByteLength:
      SPH_SPATIAL_GAS_AUTHORITY_CONTROL_BYTES
      + compactByteLength + pressureByteLength + headerByteLength,
    hostMaterializedRowCount: compactRows.length + pressureCells.length,
    compactValues,
    compactRows,
    pressureValues,
    pressureCells,
    controlWords: control.words,
    controlStatusFlags: control.status,
    controlErrorFlags: control.errors,
    liveResidualCount: control.liveResidualCount,
    readyPressureCount: control.readyPressureCount,
    empty: control.empty,
    directoryHeader,
    directoryCellCount: control.directoryCellCount,
    directoryStatusFlags: directoryHeader[2] ?? 0,
    directoryGenerationId: directoryHeader[3] ?? 0,
    scientificValidation: false,
    gasValidation: false,
    fullPhysicsValidation: false
  };
}

export function sphSpatialGasLedgerEosArenaStats(device) {
  const byCapacity = deviceRuntimes.get(device);
  const runtimes = byCapacity ? [...byCapacity.values()] : [];
  return {
    schema: 'peercompute.ulg.sph-spatial-gas-ledger-eos-arena-stats.v1',
    status: runtimes.length
      ? 'spatial-gas-ledger-eos-arena-stats-ready'
      : 'spatial-gas-ledger-eos-arena-uninitialized',
    deviceId: device ? webGpuDeviceId(device) : null,
    runtimeCount: runtimes.length,
    capacities: runtimes.map((runtime) => runtime.capacity),
    retainedBufferCount: runtimes.reduce(
      (sum, runtime) => sum + runtime.slots.reduce(
        (slotSum, slot) => slotSum + 7
          + slot.compactionScan.allocationEntries().length,
        0
      ),
      0
    ),
    retainedBufferByteLength: runtimes.reduce(
      (sum, runtime) => sum + runtime.slots.reduce((slotSum, slot) => {
        const direct = [
          slot.compactRowsBuffer,
          slot.activeNodeBuffer,
          slot.gasPressureCellsBuffer,
          slot.candidateFlagsBuffer,
          slot.candidateOffsetsBuffer,
          slot.controlBuffer,
          slot.paramsBuffer
        ];
        const scan = slot.compactionScan.allocationEntries()
          .map((entry) => entry.buffer);
        return slotSum + [...direct, ...scan].reduce(
          (byteSum, buffer) => byteSum + Math.max(0, Number(buffer?.size) || 0),
          0
        );
      }, 0), 0
    ),
    inUseSlotCount: runtimes.reduce(
      (sum, runtime) => sum + runtime.slots.filter((slot) => slot.inUse).length,
      0
    ),
    acquireCount: runtimes.reduce((sum, runtime) => sum + runtime.acquireCount, 0),
    reuseCount: runtimes.reduce((sum, runtime) => sum + runtime.reuseCount, 0),
    terminal: lostDevices.has(device)
  };
}

/** Destroy only fully idle warm arenas. Live retained outputs fail closed. */
export function destroySphSpatialGasLedgerEosGpu(device) {
  const byCapacity = deviceRuntimes.get(device);
  if (!byCapacity) return false;
  if ([...byCapacity.values()].some((runtime) => (
    runtime.slots.some((slot) => slot.inUse)
  ))) {
    return false;
  }
  for (const runtime of byCapacity.values()) {
    runtime.terminal = true;
    for (const slot of runtime.slots) {
      slot.terminal = true;
      destroySlot(slot);
    }
  }
  deviceRuntimes.delete(device);
  return true;
}

export const SPH_SPATIAL_GAS_LEDGER_EOS_DIRECTORY_ABI = Object.freeze({
  schema: ULG_SPH_SPATIAL_GAS_LEDGER_EOS_EXECUTION_SCHEMA,
  productEventRowStrideFloats: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  compactRowStrideFloats: SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS,
  activeNodeRowStrideFloats: SPH_SPATIAL_GAS_ACTIVE_NODE_ROW_FLOATS,
  pressureCellRowStrideFloats: SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS,
  pressureCellLayout: Object.freeze([
    'cellX:f32',
    'cellY:f32',
    'cellZ:f32',
    'ready:f32',
    'centerXM:f32',
    'centerYM:f32',
    'centerZM:f32',
    'pressurePa:f32',
    'gradientXPaPerM:f32',
    'gradientYPaPerM:f32',
    'gradientZPaPerM:f32',
    'representedVolumeM3:f32'
  ]),
  sourcePositionAuthority: PRODUCT_EVENT_POSITION_AUTHORITY,
  directoryAuthority: 'generic-schroeder-spatial-epoch-v1',
  sparseSourcePolicy:
    'stable-gpu-compacted-logical-prefix-with-capacity-sized-allocation',
  normalReadbackPolicy: 'none',
  diagnosticReadbackPolicy: SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE,
  retirementPolicy: 'final-consumer-queue-fence-generation-owner',
  scientificValidation: false
});

// Keep the shader-side constants visibly tied to the imported SS ABI.
if (
  SCHROEDER_SPATIAL_EPOCH_MAGIC !== 0x53534531
  || SCHROEDER_SPATIAL_EPOCH_VERSION !== 1
  || SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS !== 48
) {
  throw new Error('Spatial gas ledger/EOS WGSL requires Schroeder spatial epoch ABI v1');
}
