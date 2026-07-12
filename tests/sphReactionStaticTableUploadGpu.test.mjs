import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  ULG_SPH_REACTION_STATIC_TABLE_UPLOAD_GPU_SCHEMA,
  assertSphReactionStaticTableUploadGpu,
  createSphReactionStaticTableUploadGpu,
  destroySphReactionStaticTableUploadGpu
} from '../src/runtime/sph/sphReactionStaticTableUploadGpu.js';

function fakeDevice() {
  const buffers = [];
  const writes = [];
  return {
    buffers,
    writes,
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroyCount: 0,
        destroy() {
          this.destroyed = true;
          this.destroyCount += 1;
        }
      };
      buffers.push(buffer);
      return buffer;
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, offset, byteLength: data.byteLength });
      }
    }
  };
}

function reactionTable({ generationPaddingRows = 0 } = {}) {
  const combinedRecordCount = 2 + generationPaddingRows;
  return {
    schema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
    reactionCount: 1,
    reactionHeaderCount: 1,
    reactantTermCount: 2,
    productTermCount: 1,
    gasProductCount: 0,
    atomTermCount: 3,
    productPhaseCount: 1,
    combinedRecordCount,
    combinedRecords: new Float32Array(combinedRecordCount * 4)
  };
}

function thermalResponseGraphUpload(device, prefix = 'thermal') {
  const buffer = (suffix, size) => tagWebGpuBufferDevice(device.createBuffer({
    label: `${prefix}-${suffix}`,
    size,
    usage: 128
  }), device);
  return {
    schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    responseRecordBuffer: buffer('response-records', 16),
    responseBuffer: buffer('responses', 32),
    graphNodeBuffer: buffer('graph-nodes', 48),
    graphSampleBuffer: buffer('graph-samples', 64),
    responseRecordBufferByteLength: 16,
    responseBufferByteLength: 32,
    graphNodeBufferByteLength: 48,
    graphSampleBufferByteLength: 64
  };
}

test('reaction static table upload owns one immutable record buffer and borrows thermal resources', () => {
  const device = fakeDevice();
  const table = reactionTable();
  const thermalUpload = thermalResponseGraphUpload(device);
  const thermalBuffers = [
    thermalUpload.responseRecordBuffer,
    thermalUpload.responseBuffer,
    thermalUpload.graphNodeBuffer,
    thermalUpload.graphSampleBuffer
  ];
  const upload = createSphReactionStaticTableUploadGpu({
    device,
    reactionTable: table,
    reactionTableContentGeneration: 'reaction-table-hash:abc',
    thermalResponseGraphUpload: thermalUpload,
    thermalResponseUploadProvenance: 7,
    label: 'test-static-reaction'
  });

  assert.equal(upload.schema, ULG_SPH_REACTION_STATIC_TABLE_UPLOAD_GPU_SCHEMA);
  assert.equal(upload.status, 'reaction-static-table-upload-ready');
  assert.equal(upload.reactionRecordBufferByteLength, table.combinedRecords.byteLength);
  assert.equal(upload.reactionRecordUploadWriteCount, 1);
  assert.equal(upload.reactionRecordUploadWriteByteLength, table.combinedRecords.byteLength);
  assert.equal(upload.borrowedThermalResponseByteLength, 160);
  assert.equal(upload.staticBindingResourceCount, 5);
  assert.equal(upload.ownsReactionRecordBuffer, true);
  assert.equal(upload.ownsThermalResponseGraphUpload, false);
  assert.equal(upload.thermalResponseGraphUpload, thermalUpload);
  assert.equal(device.writes.length, 1);
  assert.equal(device.writes[0].buffer, upload.reactionRecordBuffer);
  assert.equal(
    assertSphReactionStaticTableUploadGpu(device, upload, {
      reactionTable: table,
      reactionTableContentGeneration: 'reaction-table-hash:abc',
      thermalResponseGraphUpload: thermalUpload,
      thermalResponseUploadProvenance: 7
    }),
    upload
  );

  assert.equal(destroySphReactionStaticTableUploadGpu(upload), true);
  assert.equal(destroySphReactionStaticTableUploadGpu(upload), false);
  assert.equal(upload.reactionRecordBuffer.destroyCount, 1);
  assert.equal(thermalBuffers.every((buffer) => !buffer.destroyed), true);
});

test('reaction static table upload fails closed on key, structure, device, and lifecycle drift', () => {
  const device = fakeDevice();
  const otherDevice = fakeDevice();
  const table = reactionTable();
  const thermalUpload = thermalResponseGraphUpload(device);
  const upload = createSphReactionStaticTableUploadGpu({
    device,
    reactionTable: table,
    reactionTableContentGeneration: 11,
    thermalResponseGraphUpload: thermalUpload,
    thermalResponseUploadProvenance: 'thermal-upload:4'
  });
  const expected = {
    reactionTable: table,
    reactionTableContentGeneration: 11,
    thermalResponseGraphUpload: thermalUpload,
    thermalResponseUploadProvenance: 'thermal-upload:4'
  };

  assert.throws(
    () => assertSphReactionStaticTableUploadGpu(otherDevice, upload, expected),
    /device mismatch/
  );
  assert.throws(
    () => assertSphReactionStaticTableUploadGpu(device, upload, {
      ...expected,
      reactionTableContentGeneration: 12
    }),
    /content generation mismatch/
  );
  assert.throws(
    () => assertSphReactionStaticTableUploadGpu(device, upload, {
      ...expected,
      thermalResponseUploadProvenance: 'thermal-upload:5'
    }),
    /provenance mismatch/
  );
  assert.throws(
    () => assertSphReactionStaticTableUploadGpu(device, upload, {
      ...expected,
      thermalResponseGraphUpload: thermalResponseGraphUpload(device, 'replacement')
    }),
    /upload identity mismatch/
  );
  assert.throws(
    () => assertSphReactionStaticTableUploadGpu(device, upload, {
      ...expected,
      reactionTable: reactionTable({ generationPaddingRows: 1 })
    }),
    /combinedRecordCount mismatch/
  );
  upload.reactionRecordBuffer.size -= 4;
  assert.throws(
    () => assertSphReactionStaticTableUploadGpu(device, upload, expected),
    /buffer size mismatch/
  );
  upload.reactionRecordBuffer.size += 4;
  upload.destroy();
  assert.throws(
    () => assertSphReactionStaticTableUploadGpu(device, upload, expected),
    /is not ready/
  );

  const foreignThermalUpload = thermalResponseGraphUpload(otherDevice, 'foreign');
  assert.throws(
    () => createSphReactionStaticTableUploadGpu({
      device,
      reactionTable: table,
      reactionTableContentGeneration: 1,
      thermalResponseGraphUpload: foreignThermalUpload,
      thermalResponseUploadProvenance: 1
    }),
    /device mismatch/
  );
  assert.throws(
    () => createSphReactionStaticTableUploadGpu({
      device,
      reactionTable: table,
      thermalResponseGraphUpload: thermalUpload,
      thermalResponseUploadProvenance: 1
    }),
    /reactionTableContentGeneration must be an explicit/
  );
});
