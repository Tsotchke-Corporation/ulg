import {
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

export const ULG_SPH_REACTION_STATIC_TABLE_UPLOAD_GPU_SCHEMA =
  'peercompute.ulg.sph-reaction-static-table-upload-gpu.v0';

const GPU_BUFFER_USAGE = {
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
};

const THERMAL_BUFFER_FIELDS = Object.freeze([
  ['responseRecordBuffer', 'responseRecordBufferByteLength'],
  ['responseBuffer', 'responseBufferByteLength'],
  ['graphNodeBuffer', 'graphNodeBufferByteLength'],
  ['graphSampleBuffer', 'graphSampleBufferByteLength']
]);

const REACTION_COUNT_FIELDS = Object.freeze([
  'reactionCount',
  'reactionHeaderCount',
  'reactantTermCount',
  'productTermCount',
  'gasProductCount',
  'atomTermCount',
  'productPhaseCount',
  'combinedRecordCount'
]);

function explicitGeneration(value, label) {
  if (Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && value.trim().length > 0) return value;
  throw new TypeError(`${label} must be an explicit non-negative safe integer or non-empty string`);
}

function bufferByteLength(buffer) {
  const byteLength = Number(buffer?.size ?? buffer?.byteLength ?? 0);
  return Number.isSafeInteger(byteLength) && byteLength >= 0 ? byteLength : 0;
}

function tableCombinedRecords(reactionTable) {
  if (reactionTable?.schema !== ULG_SPH_GPU_REACTION_TABLE_SCHEMA) {
    throw new TypeError('reactionTable schema mismatch');
  }
  if (!(reactionTable.combinedRecords instanceof Float32Array)) {
    throw new TypeError('reactionTable.combinedRecords must be a Float32Array');
  }
  const combinedRecordCount = Number(reactionTable.combinedRecordCount);
  if (!Number.isSafeInteger(combinedRecordCount) || combinedRecordCount < 0) {
    throw new RangeError('reactionTable.combinedRecordCount must be a non-negative safe integer');
  }
  const expectedByteLength = combinedRecordCount * 4 * Float32Array.BYTES_PER_ELEMENT;
  if (reactionTable.combinedRecords.byteLength !== expectedByteLength) {
    throw new RangeError(
      `reactionTable.combinedRecords has ${reactionTable.combinedRecords.byteLength} bytes; expected ${expectedByteLength}`
    );
  }
  for (const field of REACTION_COUNT_FIELDS) {
    const value = Number(reactionTable[field] ?? 0);
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`reactionTable.${field} must be a non-negative safe integer`);
    }
  }
  return reactionTable.combinedRecords;
}

function assertThermalResponseGraphUpload(device, upload) {
  if (upload?.schema !== ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA) {
    throw new TypeError('thermalResponseGraphUpload schema mismatch');
  }
  if (upload.status !== 'webgpu-uploaded') {
    throw new Error('thermalResponseGraphUpload must have webgpu-uploaded status');
  }
  if (upload.device && upload.device !== device) {
    throw new Error('thermalResponseGraphUpload device mismatch');
  }
  let totalByteLength = 0;
  for (const [bufferField, byteLengthField] of THERMAL_BUFFER_FIELDS) {
    const buffer = upload[bufferField];
    const requiredByteLength = Number(upload[byteLengthField]);
    if (!buffer) {
      throw new TypeError(`thermalResponseGraphUpload.${bufferField} is required`);
    }
    if (!Number.isSafeInteger(requiredByteLength) || requiredByteLength < 0) {
      throw new RangeError(
        `thermalResponseGraphUpload.${byteLengthField} must be a non-negative safe integer`
      );
    }
    if (!webGpuBufferMatchesDevice(buffer, device)) {
      throw new Error(`thermalResponseGraphUpload.${bufferField} device mismatch`);
    }
    if (bufferByteLength(buffer) < Math.max(4, requiredByteLength)) {
      throw new RangeError(
        `thermalResponseGraphUpload.${bufferField} is smaller than ${Math.max(4, requiredByteLength)} bytes`
      );
    }
    totalByteLength += requiredByteLength;
  }
  return totalByteLength;
}

function reactionTableCounts(reactionTable) {
  return Object.freeze(Object.fromEntries(
    REACTION_COUNT_FIELDS.map((field) => [field, Number(reactionTable[field] ?? 0)])
  ));
}

function assertExpectedCounts(upload, reactionTable) {
  for (const field of REACTION_COUNT_FIELDS) {
    if (upload.reactionTableCounts?.[field] !== Number(reactionTable[field] ?? 0)) {
      throw new Error(`reaction static table upload ${field} mismatch`);
    }
  }
}

export function createSphReactionStaticTableUploadGpu({
  device,
  reactionTable,
  reactionTableContentGeneration,
  thermalResponseGraphUpload,
  thermalResponseUploadProvenance,
  label = 'ulg-sph-reaction-static-tables'
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError(
      'createSphReactionStaticTableUploadGpu requires a WebGPU-like device with queue.writeBuffer'
    );
  }
  const combinedRecords = tableCombinedRecords(reactionTable);
  const contentGeneration = explicitGeneration(
    reactionTableContentGeneration,
    'reactionTableContentGeneration'
  );
  const responseUploadProvenance = explicitGeneration(
    thermalResponseUploadProvenance,
    'thermalResponseUploadProvenance'
  );
  const borrowedThermalResponseByteLength = assertThermalResponseGraphUpload(
    device,
    thermalResponseGraphUpload
  );
  const reactionRecordBufferByteLength = Math.max(4, combinedRecords.byteLength);
  const reactionRecordBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${String(label || 'ulg-sph-reaction-static-tables')}-reaction-records-and-product-phases`,
    size: reactionRecordBufferByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  try {
    if (combinedRecords.byteLength > 0) {
      device.queue.writeBuffer(reactionRecordBuffer, 0, combinedRecords);
    }
  } catch (error) {
    reactionRecordBuffer.destroy?.();
    throw error;
  }

  let destroyed = false;
  const upload = {
    schema: ULG_SPH_REACTION_STATIC_TABLE_UPLOAD_GPU_SCHEMA,
    status: 'reaction-static-table-upload-ready',
    device,
    deviceId: webGpuDeviceId(device),
    reactionTableSchema: reactionTable.schema,
    reactionTableContentGeneration: contentGeneration,
    reactionTableCounts: reactionTableCounts(reactionTable),
    reactionRecordBuffer,
    reactionRecordBufferByteLength,
    reactionRecordUploadWriteCount: combinedRecords.byteLength > 0 ? 1 : 0,
    reactionRecordUploadWriteByteLength: combinedRecords.byteLength,
    ownsReactionRecordBuffer: true,
    thermalResponseGraphUpload,
    thermalResponseGraphUploadSchema: thermalResponseGraphUpload.schema,
    thermalResponseUploadProvenance: responseUploadProvenance,
    borrowedThermalResponseByteLength,
    ownsThermalResponseGraphUpload: false,
    staticBindingResourceCount: 5,
    allocationEntries: Object.freeze([Object.freeze({
      role: 'reaction-static-records-and-product-phases',
      buffer: reactionRecordBuffer,
      owned: true,
      lifetime: 'persistent-static-upload',
      createdThisSubmission: true
    })]),
    destroyed: false,
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      upload.destroyed = true;
      upload.status = 'reaction-static-table-upload-destroyed';
      if (upload.ownsReactionRecordBuffer !== false) reactionRecordBuffer.destroy?.();
      return true;
    }
  };
  return upload;
}

export function assertSphReactionStaticTableUploadGpu(device, upload, {
  reactionTable,
  reactionTableContentGeneration,
  thermalResponseGraphUpload,
  thermalResponseUploadProvenance
} = {}) {
  if (upload?.schema !== ULG_SPH_REACTION_STATIC_TABLE_UPLOAD_GPU_SCHEMA) {
    throw new TypeError('reactionStaticTableUpload schema mismatch');
  }
  if (upload.destroyed === true || upload.status !== 'reaction-static-table-upload-ready') {
    throw new Error('reactionStaticTableUpload is not ready');
  }
  if (upload.device !== device || !webGpuBufferMatchesDevice(upload.reactionRecordBuffer, device)) {
    throw new Error('reactionStaticTableUpload device mismatch');
  }
  const combinedRecords = tableCombinedRecords(reactionTable);
  const contentGeneration = explicitGeneration(
    reactionTableContentGeneration,
    'reactionTableContentGeneration'
  );
  const responseUploadProvenance = explicitGeneration(
    thermalResponseUploadProvenance,
    'thermalResponseUploadProvenance'
  );
  if (upload.reactionTableSchema !== reactionTable.schema) {
    throw new Error('reaction static table upload reaction table schema mismatch');
  }
  if (!Object.is(upload.reactionTableContentGeneration, contentGeneration)) {
    throw new Error('reaction static table upload content generation mismatch');
  }
  assertExpectedCounts(upload, reactionTable);
  if (upload.reactionRecordBufferByteLength !== Math.max(4, combinedRecords.byteLength)
    || bufferByteLength(upload.reactionRecordBuffer) < Math.max(4, combinedRecords.byteLength)) {
    throw new RangeError('reaction static table upload reaction record buffer size mismatch');
  }
  if (upload.thermalResponseGraphUpload !== thermalResponseGraphUpload) {
    throw new Error('reaction static table upload thermal response upload identity mismatch');
  }
  if (!Object.is(upload.thermalResponseUploadProvenance, responseUploadProvenance)) {
    throw new Error('reaction static table upload thermal response provenance mismatch');
  }
  const borrowedThermalResponseByteLength = assertThermalResponseGraphUpload(
    device,
    thermalResponseGraphUpload
  );
  if (upload.borrowedThermalResponseByteLength !== borrowedThermalResponseByteLength) {
    throw new Error('reaction static table upload thermal response byte length mismatch');
  }
  return upload;
}

export function destroySphReactionStaticTableUploadGpu(upload) {
  return upload?.destroy?.() ?? false;
}
