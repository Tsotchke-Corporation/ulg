import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  OPTICAL_GPU_RECORD_FLOATS,
  OPTICAL_GPU_RECORD_LAYOUT,
  OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS,
  OPTICAL_GPU_SPECTRAL_SAMPLE_LAYOUT,
  ULG_OPTICAL_GPU_BUFFER_SET_SCHEMA,
  ULG_OPTICAL_GPU_TABLE_SCHEMA,
  buildOpticalGpuTable,
  uploadOpticalGpuTable
} from '../src/runtime/material/opticalGpuBuffers.js';

test('optical GPU table packs derived PBR records and spectral samples', () => {
  const table = buildOpticalGpuTable([
    { material: 'h2o', phase: 'liquid' },
    {
      material: 'Au',
      phase: 'solid',
      properties: {
        conductionElectronDensityPerM3: 5.9e28,
        opticalInterbandOscillators: []
      }
    }
  ]);

  assert.equal(table.schema, ULG_OPTICAL_GPU_TABLE_SCHEMA);
  assert.equal(table.status, 'cpu-derived-gpu-buffer-ready');
  assert.equal(table.recordCount, 2);
  assert.equal(table.records.length, table.recordCount * OPTICAL_GPU_RECORD_FLOATS);
  assert.equal(table.spectralSamples.length, table.spectralSampleCount * OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS);
  assert.deepEqual(table.recordLayout, OPTICAL_GPU_RECORD_LAYOUT);
  assert.deepEqual(table.spectralSampleLayout, OPTICAL_GPU_SPECTRAL_SAMPLE_LAYOUT);
  assert.match(table.wgslStructs, /struct OpticalMaterialRecord/);
  assert.match(table.wgslStructs, /struct OpticalSpectralSample/);

  const water = table.recordMetadata.find((record) => record.material === 'h2o');
  const gold = table.recordMetadata.find((record) => record.material === 'Au');
  assert.equal(water.phase, 'liquid');
  assert.equal(water.renderModel, 'molecular-transparent-beer-lambert-pbr');
  assert.ok(water.spectralCount > 0);
  assert.equal(gold.renderModel, 'conductor-drude-free-electron');
  assert.ok(gold.renderModelId > 0);
  assert.equal(table.scientificValidation, false);
  assert.equal(table.fullPhysicsValidation, false);
});

test('optical GPU table deduplicates material-phase records and preserves stable ids', () => {
  const table = buildOpticalGpuTable([
    { material: 'h2o', phase: 'liquid' },
    { material: 'h2o', phase: 'liquid' },
    { material: 'h2o', phase: 'gas' }
  ]);

  assert.equal(table.recordCount, 2);
  assert.deepEqual(table.materialMap, [{ material: 'h2o', materialId: 1 }]);
  assert.deepEqual(
    table.recordMetadata.map((record) => ({ phase: record.phase, phaseId: record.phaseId })),
    [
      { phase: 'liquid', phaseId: 2 },
      { phase: 'gas', phaseId: 3 }
    ]
  );
});

test('optical GPU table upload writes records and spectral samples to storage buffers', () => {
  const table = buildOpticalGpuTable([{ material: 'h2o', phase: 'liquid' }]);
  const writes = [];
  const device = {
    createBuffer(descriptor) {
      return { ...descriptor };
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ label: buffer.label, offset, byteLength: data.byteLength });
      }
    }
  };

  const buffers = uploadOpticalGpuTable(device, table);
  assert.equal(buffers.schema, ULG_OPTICAL_GPU_BUFFER_SET_SCHEMA);
  assert.equal(buffers.recordCount, 1);
  assert.equal(buffers.recordsBuffer.label, 'ulg-optical-material-records');
  assert.equal(buffers.spectralSamplesBuffer.label, 'ulg-optical-spectral-samples');
  assert.deepEqual(
    writes.map((write) => write.label),
    ['ulg-optical-material-records', 'ulg-optical-spectral-samples']
  );
  assert.equal(writes[0].byteLength, table.records.byteLength);
  assert.equal(writes[1].byteLength, table.spectralSamples.byteLength);
});
