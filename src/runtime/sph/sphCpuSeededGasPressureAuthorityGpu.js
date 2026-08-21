import {
  cancelQueueOrderedCleanupClaim,
  createQueueOrderedCleanupClaimIssuer,
  registerQueueOrderedCleanupClaim,
  releaseSubmittedWorkCleanupQueueOrdered
} from '../webgpuComputeLayout.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

export const ULG_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_SCHEMA =
  'peercompute.ulg.sph-cpu-seeded-gas-pressure-authority.v1';
export const ULG_SPH_CPU_SEEDED_GAS_PRESSURE_CONSUMER_RECEIPT_SCHEMA =
  'peercompute.ulg.sph-cpu-seeded-gas-pressure-consumer-receipt.v1';

const GPU_BUFFER_USAGE = {
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
};
const PRODUCER_FAMILY = 'sph-cpu-seeded-gas-pressure-authority';
const cleanupClaimIssuer = createQueueOrderedCleanupClaimIssuer({
  producerFamily: PRODUCER_FAMILY
});
const authorityRecords = new WeakMap();
const consumerReceiptRecords = new WeakMap();

function authorityError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function positiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
  return value;
}

function requiredAuthorityRecord(source) {
  const record = authorityRecords.get(source);
  if (!record || record.source !== source) {
    throw authorityError(
      'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_FOREIGN',
      'CPU-seeded gas pressure requires the exact producer-issued source'
    );
  }
  return record;
}

function ownDataDescriptor(target, key, label) {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(target, key);
  } catch (cause) {
    const error = authorityError(
      'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_OPTIONS_INVALID',
      `${label} could not be inspected`
    );
    error.cause = cause;
    throw error;
  }
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
    throw authorityError(
      'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_OPTIONS_INVALID',
      `${label} must be an own data property`
    );
  }
  return descriptor;
}

function snapshotPublicEntries(publicEntries, device) {
  if (!Array.isArray(publicEntries)) {
    throw authorityError(
      'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID',
      'publicEntries must be a dense Array'
    );
  }
  let keys;
  try {
    keys = Reflect.ownKeys(publicEntries);
  } catch (cause) {
    const error = authorityError(
      'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID',
      'publicEntries keys could not be inspected'
    );
    error.cause = cause;
    throw error;
  }
  const expectedKeys = Array.from(
    { length: publicEntries.length },
    (_, index) => String(index)
  );
  const allowedKeys = new Set([...expectedKeys, 'length']);
  if (
    keys.some((key) => typeof key !== 'string' || !allowedKeys.has(key))
    || expectedKeys.some((key) => !keys.includes(key))
  ) {
    throw authorityError(
      'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID',
      'publicEntries must be dense and contain no extra properties'
    );
  }
  const seenBindings = new Set();
  const snapshot = [];
  for (let index = 0; index < publicEntries.length; index += 1) {
    const entry = ownDataDescriptor(
      publicEntries,
      String(index),
      `publicEntries[${index}]`
    ).value;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw authorityError(
        'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID',
        `publicEntries[${index}] must be an object`
      );
    }
    let entryKeys;
    try {
      entryKeys = Reflect.ownKeys(entry);
    } catch (cause) {
      const error = authorityError(
        'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID',
        `publicEntries[${index}] keys could not be inspected`
      );
      error.cause = cause;
      throw error;
    }
    if (
      entryKeys.length !== 2
      || !entryKeys.includes('binding')
      || !entryKeys.includes('resource')
    ) {
      throw authorityError(
        'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID',
        `publicEntries[${index}] must contain only binding and resource`
      );
    }
    const binding = ownDataDescriptor(
      entry,
      'binding',
      `publicEntries[${index}].binding`
    ).value;
    if (!Number.isInteger(binding) || binding < 0 || binding > 0xffff_ffff) {
      throw authorityError(
        'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID',
        `publicEntries[${index}].binding must be a u32`
      );
    }
    if (binding === 3 || binding === 6) {
      throw authorityError(
        'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_RESERVED_BINDING',
        `CPU-seeded gas pressure privately owns binding ${binding}`
      );
    }
    if (seenBindings.has(binding)) {
      throw authorityError(
        'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID',
        `publicEntries repeats binding ${binding}`
      );
    }
    seenBindings.add(binding);
    const resource = ownDataDescriptor(
      entry,
      'resource',
      `publicEntries[${index}].resource`
    ).value;
    if (!resource || typeof resource !== 'object' || Array.isArray(resource)) {
      throw authorityError(
        'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID',
        `publicEntries[${index}].resource must be a buffer binding object`
      );
    }
    let resourceKeys;
    try {
      resourceKeys = Reflect.ownKeys(resource);
    } catch (cause) {
      const error = authorityError(
        'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID',
        `publicEntries[${index}].resource keys could not be inspected`
      );
      error.cause = cause;
      throw error;
    }
    if (
      !resourceKeys.includes('buffer')
      || resourceKeys.some((key) => (
        typeof key !== 'string'
        || !['buffer', 'offset', 'size'].includes(key)
      ))
    ) {
      throw authorityError(
        'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID',
        `publicEntries[${index}].resource must be a canonical buffer binding`
      );
    }
    const buffer = ownDataDescriptor(
      resource,
      'buffer',
      `publicEntries[${index}].resource.buffer`
    ).value;
    if (!webGpuBufferMatchesDevice(buffer, device)) {
      throw authorityError(
        'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_DEVICE_MISMATCH',
        `publicEntries[${index}] belongs to another WebGPU device`
      );
    }
    const resourceSnapshot = { buffer };
    for (const key of ['offset', 'size']) {
      if (!resourceKeys.includes(key)) continue;
      const value = ownDataDescriptor(
        resource,
        key,
        `publicEntries[${index}].resource.${key}`
      ).value;
      if (!Number.isSafeInteger(value) || value < (key === 'size' ? 1 : 0)) {
        throw authorityError(
          'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID',
          `publicEntries[${index}].resource.${key} is invalid`
        );
      }
      resourceSnapshot[key] = value;
    }
    snapshot.push(Object.freeze({
      binding,
      resource: Object.freeze(resourceSnapshot)
    }));
  }
  return Object.freeze(snapshot);
}

export function createSphCpuSeededGasPressureAuthorityGpu(device, {
  rows,
  rowCount,
  rowStrideFloats = 12,
  label = 'ulg-sph-cpu-seeded-gas-pressure-authority'
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer || !device.queue?.submit) {
    throw new TypeError(
      'CPU-seeded gas pressure authority requires one WebGPU-like device'
    );
  }
  if (!(rows instanceof Float32Array)) {
    throw new TypeError('CPU-seeded gas pressure rows must be a Float32Array');
  }
  const count = positiveSafeInteger(rowCount, 'rowCount');
  const stride = positiveSafeInteger(rowStrideFloats, 'rowStrideFloats');
  if (rows.length !== count * stride) {
    throw new RangeError(
      'CPU-seeded gas pressure rows must exactly fill rowCount * rowStrideFloats'
    );
  }
  const rowByteLength = rows.byteLength;
  const source = Object.freeze({
    schema: ULG_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_SCHEMA,
    status: 'sph-cpu-seeded-gas-pressure-authority-ready',
    ready: true,
    deviceId: webGpuDeviceId(device),
    rowCount: count,
    rowCapacity: count,
    rowStrideFloats: stride,
    rowByteLength,
    sourceAuthorship: 'cpu-seeded-single-queue-write',
    logicalCountGpuAuthored: false,
    queueWriteBufferCount: 1
  });
  let rawBuffer = null;
  let record = null;
  try {
    rawBuffer = device.createBuffer({
      label: `${String(label)}-rows`,
      size: rowByteLength,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    });
    const buffer = tagWebGpuBufferDevice(rawBuffer, device);
    device.queue.writeBuffer(buffer, 0, rows);
    record = {
      source,
      device,
      deviceId: source.deviceId,
      buffer,
      rowCount: count,
      rowStrideFloats: stride,
      rowByteLength,
      state: 'active',
      activeReceipt: null,
      consumerSubmitCount: 0,
      destroyed: false,
      cleanupClaim: null,
      cleanup: null
    };
    record.cleanup = () => {
      if (record.destroyed) return false;
      record.destroyed = true;
      record.state = 'retired';
      buffer.destroy?.();
      return true;
    };
    record.cleanupClaim = registerQueueOrderedCleanupClaim(
      cleanupClaimIssuer,
      device,
      {
        producerOutput: source,
        cleanup: record.cleanup
      }
    );
    authorityRecords.set(source, record);
    return source;
  } catch (error) {
    if (record) {
      record.destroyed = true;
      record.state = 'construction-failed';
    }
    try {
      rawBuffer?.destroy?.();
    } catch {
      // Preserve the construction failure after exactly one rollback attempt.
    }
    throw error;
  }
}

export function isExactSphCpuSeededGasPressureAuthorityGpu(source, device) {
  const record = authorityRecords.get(source);
  return Boolean(
    record?.source === source
    && record.device === device
    && (record.state === 'active' || record.state === 'borrowed')
  );
}

export function describeSphCpuSeededGasPressureAuthorityGpu(
  source,
  { device = null } = {}
) {
  const record = authorityRecords.get(source);
  if (!record?.source || record.source !== source) return null;
  return Object.freeze({
    schema: 'peercompute.ulg.sph-cpu-seeded-gas-pressure-telemetry.v1',
    status: 'sph-cpu-seeded-gas-pressure-telemetry-only',
    telemetryOnly: true,
    bindable: false,
    exactSourceObserved: true,
    deviceAuthenticated: record.device === device,
    deviceId: record.deviceId,
    rowCount: record.rowCount,
    rowCapacity: record.rowCount,
    rowStrideFloats: record.rowStrideFloats,
    rowByteLength: record.rowByteLength,
    sourceAuthorship: 'cpu-seeded-single-queue-write',
    logicalCountGpuAuthored: false,
    consumerBorrowedObserved: record.state === 'borrowed',
    consumerSubmittedObserved: record.consumerSubmitCount > 0,
    retiredObserved: record.state === 'retired'
  });
}

function reserveConsumerReceipt(record) {
  if (record.state !== 'active' || record.activeReceipt) {
    throw authorityError(
      'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_CONSUMED',
      'CPU-seeded gas pressure authority is borrowed, consumed, or retired'
    );
  }
  const receipt = Object.freeze({
    schema: ULG_SPH_CPU_SEEDED_GAS_PRESSURE_CONSUMER_RECEIPT_SCHEMA,
    status: 'sph-cpu-seeded-gas-pressure-consumer-borrowed',
    deviceId: record.deviceId,
    rowCount: record.rowCount,
    rowStrideFloats: record.rowStrideFloats
  });
  consumerReceiptRecords.set(receipt, {
    receipt,
    record,
    state: 'borrowed'
  });
  record.activeReceipt = receipt;
  record.state = 'borrowed';
  return receipt;
}

export function encodeSphCpuSeededGasPressureAuthorityGpu(source, options = {}) {
  const record = requiredAuthorityRecord(source);
  const receipt = reserveConsumerReceipt(record);
  try {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw authorityError(
        'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_OPTIONS_INVALID',
        'CPU-seeded gas pressure encoding options must be an object'
      );
    }
    let optionKeys;
    try {
      optionKeys = Reflect.ownKeys(options);
    } catch (cause) {
      const error = authorityError(
        'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_OPTIONS_INVALID',
        'CPU-seeded gas pressure encoding options could not be inspected'
      );
      error.cause = cause;
      throw error;
    }
    const allowed = new Set([
      'device',
      'passEncoder',
      'bindGroupLayout',
      'bindGroupIndex',
      'controlSentinelBuffer',
      'publicEntries'
    ]);
    if (optionKeys.some((key) => !allowed.has(key))) {
      throw authorityError(
        'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_OPTIONS_INVALID',
        'CPU-seeded gas pressure encoding options contain an unsupported property'
      );
    }
    const device = ownDataDescriptor(
      options,
      'device',
      'CPU-seeded gas pressure options.device'
    ).value;
    const passEncoder = ownDataDescriptor(
      options,
      'passEncoder',
      'CPU-seeded gas pressure options.passEncoder'
    ).value;
    const bindGroupLayout = ownDataDescriptor(
      options,
      'bindGroupLayout',
      'CPU-seeded gas pressure options.bindGroupLayout'
    ).value;
    const publicEntries = ownDataDescriptor(
      options,
      'publicEntries',
      'CPU-seeded gas pressure options.publicEntries'
    ).value;
    const controlSentinelBuffer = ownDataDescriptor(
      options,
      'controlSentinelBuffer',
      'CPU-seeded gas pressure options.controlSentinelBuffer'
    ).value;
    const bindGroupIndex = optionKeys.includes('bindGroupIndex')
      ? ownDataDescriptor(
          options,
          'bindGroupIndex',
          'CPU-seeded gas pressure options.bindGroupIndex'
        ).value
      : 0;
    if (record.device !== device) {
      throw authorityError(
        'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_DEVICE_MISMATCH',
        'CPU-seeded gas pressure authority belongs to another WebGPU device'
      );
    }
    if (
      !webGpuBufferMatchesDevice(controlSentinelBuffer, device)
      || !Number.isSafeInteger(controlSentinelBuffer?.size)
      || controlSentinelBuffer.size < 32 * Uint32Array.BYTES_PER_ELEMENT
    ) {
      throw authorityError(
        'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_CONTROL_INVALID',
        'CPU-seeded gas pressure requires the pressure owner\'s exact same-device zero control sentinel'
      );
    }
    if (
      !Number.isInteger(bindGroupIndex)
      || bindGroupIndex < 0
      || bindGroupIndex > 0xffff_ffff
    ) {
      throw authorityError(
        'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_OPTIONS_INVALID',
        'CPU-seeded gas pressure bindGroupIndex must be a u32'
      );
    }
    if (
      !bindGroupLayout
      || (
        typeof bindGroupLayout !== 'object'
        && typeof bindGroupLayout !== 'function'
      )
    ) {
      throw new TypeError('bindGroupLayout must be a WebGPU layout object');
    }
    if (typeof device.createBindGroup !== 'function') {
      throw new TypeError('device.createBindGroup must be a function');
    }
    if (typeof passEncoder?.setBindGroup !== 'function') {
      throw new TypeError('passEncoder.setBindGroup must be a function');
    }
    const publicSnapshot = snapshotPublicEntries(publicEntries, device);
    const bindGroup = device.createBindGroup({
      label: `${source.status}-bind-group`,
      layout: bindGroupLayout,
      entries: [
        ...publicSnapshot,
        { binding: 3, resource: { buffer: record.buffer } },
        { binding: 6, resource: { buffer: controlSentinelBuffer } }
      ]
    });
    passEncoder.setBindGroup(bindGroupIndex, bindGroup);
  } catch (error) {
    abandonSphCpuSeededGasPressureAuthorityConsumer(receipt);
    throw error;
  }
  return Object.freeze({
    receipt,
    rowCount: record.rowCount,
    rowCapacity: record.rowCount,
    rowStrideFloats: record.rowStrideFloats,
    logicalCountGpuAuthored: false,
    sourceAuthorship: 'cpu-seeded-single-queue-write'
  });
}

export function sphCpuSeededGasPressureAuthorityQueueOrderedClaim(
  receipt,
  device
) {
  const receiptRecord = consumerReceiptRecords.get(receipt);
  const record = receiptRecord?.record;
  if (
    !record
    || receiptRecord.receipt !== receipt
    || receiptRecord.state !== 'borrowed'
    || record.activeReceipt !== receipt
    || record.state !== 'borrowed'
    || record.device !== device
  ) {
    throw authorityError(
      'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_RECEIPT_INVALID',
      'CPU-seeded gas pressure cleanup claim requires its exact borrowed receipt and device'
    );
  }
  return record.cleanupClaim;
}

export function retireSphCpuSeededGasPressureAuthorityQueueOrdered(
  receipt,
  device,
  queueOrderedFinalConsumer
) {
  const receiptRecord = consumerReceiptRecords.get(receipt);
  const record = receiptRecord?.record;
  if (
    !record
    || receiptRecord.receipt !== receipt
    || receiptRecord.state !== 'borrowed'
    || record.activeReceipt !== receipt
    || record.state !== 'borrowed'
    || record.device !== device
  ) {
    return false;
  }
  try {
    releaseSubmittedWorkCleanupQueueOrdered(
      device,
      record.cleanup,
      {
        queueOrderedFinalConsumer,
        producerClaim: record.cleanupClaim,
        producerOutput: record.source,
        producerFamily: PRODUCER_FAMILY
      }
    );
  } catch (error) {
    if (record.state === 'retired') {
      receiptRecord.state = 'terminal';
      record.activeReceipt = null;
    }
    throw error;
  }
  receiptRecord.state = 'submitted';
  record.activeReceipt = null;
  record.consumerSubmitCount += 1;
  return true;
}

export function abandonSphCpuSeededGasPressureAuthorityConsumer(receipt) {
  const receiptRecord = consumerReceiptRecords.get(receipt);
  const record = receiptRecord?.record;
  if (
    !record
    || receiptRecord.receipt !== receipt
    || receiptRecord.state !== 'borrowed'
    || record.activeReceipt !== receipt
    || record.state !== 'borrowed'
  ) return false;
  receiptRecord.state = 'abandoned';
  record.activeReceipt = null;
  record.state = 'active';
  return true;
}

export function discardSphCpuSeededGasPressureAuthorityGpu(source, device) {
  const record = requiredAuthorityRecord(source);
  if (record.device !== device) {
    throw authorityError(
      'ERR_SPH_CPU_SEEDED_GAS_PRESSURE_AUTHORITY_DEVICE_MISMATCH',
      'CPU-seeded gas pressure discard requires its exact device'
    );
  }
  if (record.state !== 'active' || record.activeReceipt) return false;
  cancelQueueOrderedCleanupClaim(
    record.cleanupClaim,
    device,
    {
      producerOutput: record.source,
      cleanup: record.cleanup
    }
  );
  return record.cleanup();
}
