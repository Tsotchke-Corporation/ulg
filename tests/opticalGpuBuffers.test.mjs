import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  OPTICAL_GPU_RECORD_FLOATS,
  OPTICAL_GPU_RECORD_LAYOUT,
  OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS,
  OPTICAL_GPU_LOOKUP_QUERY_FLOATS,
  OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS,
  OPTICAL_GPU_SPECTRAL_SAMPLE_LAYOUT,
  ULG_OPTICAL_GPU_BUFFER_SET_SCHEMA,
  ULG_OPTICAL_GPU_LOOKUP_EXECUTION_SCHEMA,
  ULG_OPTICAL_GPU_LOOKUP_PARITY_SCHEMA,
  ULG_OPTICAL_GPU_LOOKUP_SCHEMA,
  ULG_OPTICAL_GPU_TABLE_SCHEMA,
  buildOpticalGpuTable,
  buildOpticalGpuLookupQueries,
  createOpticalGpuLookupParityReport,
  decodeOpticalGpuLookupOutputRows,
  opticalLookupWgsl,
  requestOpticalGpuDevice,
  runOpticalGpuLookupWithOptionalWebGpu,
  sampleOpticalGpuTableCpu,
  stableOpticalMaterialId,
  stableOpticalStateId,
  uploadOpticalGpuTable
} from '../src/runtime/material/opticalGpuBuffers.js';

function createLookupFixture() {
  const table = buildOpticalGpuTable([
    { material: 'h2o', phase: 'liquid' },
    { material: 'h2o', phase: 'gas' }
  ]);
  const lookup = buildOpticalGpuLookupQueries(table, [
    { material: 'h2o', phase: 'liquid' },
    { material: 'h2o', phase: 'gas' }
  ]);
  const cpuReference = sampleOpticalGpuTableCpu(table, lookup);
  return { table, lookup, cpuReference };
}

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

test('requestOpticalGpuDevice asks for the resident SPH storage-buffer limit when supported', async () => {
  const device = { lost: new Promise(() => {}) };
  let requestDescriptor = null;
  const result = await requestOpticalGpuDevice({
    gpu: {
      async requestAdapter() {
        return {
          limits: {
            maxStorageBuffersPerShaderStage: 10,
            maxBufferSize: 512 * 1024 * 1024,
            maxStorageBufferBindingSize: 512 * 1024 * 1024
          },
          async requestDevice(descriptor) {
            requestDescriptor = descriptor;
            return device;
          }
        };
      }
    }
  });

  assert.equal(result.status, 'webgpu-device-ready');
  assert.equal(result.device, device);
  assert.deepEqual(requestDescriptor, {
    requiredLimits: {
      maxStorageBuffersPerShaderStage: 10,
      maxBufferSize: 512 * 1024 * 1024,
      maxStorageBufferBindingSize: 512 * 1024 * 1024
    }
  });
  assert.equal(result.requiredLimits.maxStorageBuffersPerShaderStage, 10);
  assert.equal(result.requiredLimits.maxBufferSize, 512 * 1024 * 1024);
  assert.equal(result.requiredLimits.maxStorageBufferBindingSize, 512 * 1024 * 1024);
  assert.equal(result.adapterLimits.maxStorageBuffersPerShaderStage, 10);
  assert.equal(result.adapterLimits.maxBufferSize, 512 * 1024 * 1024);
  assert.equal(result.adapterLimits.maxStorageBufferBindingSize, 512 * 1024 * 1024);
});

test('requestOpticalGpuDevice asks for adapter-scale resident buffer limits', async () => {
  const device = { lost: new Promise(() => {}) };
  const adapterLimit = (4 * 1024 * 1024 * 1024) - 4;
  let requestDescriptor = null;
  const result = await requestOpticalGpuDevice({
    gpu: {
      async requestAdapter() {
        return {
          limits: {
            maxStorageBuffersPerShaderStage: 12,
            maxBufferSize: adapterLimit,
            maxStorageBufferBindingSize: adapterLimit
          },
          async requestDevice(descriptor) {
            requestDescriptor = descriptor;
            return device;
          }
        };
      }
    }
  });

  assert.equal(result.status, 'webgpu-device-ready');
  assert.equal(requestDescriptor.requiredLimits.maxBufferSize, adapterLimit);
  assert.equal(requestDescriptor.requiredLimits.maxStorageBufferBindingSize, adapterLimit);
  assert.equal(result.requiredLimits.maxBufferSize, adapterLimit);
  assert.equal(result.requiredLimits.maxStorageBufferBindingSize, adapterLimit);
});

test('optical GPU table deduplicates material-phase records and preserves stable ids', () => {
  const table = buildOpticalGpuTable([
    { material: 'h2o', phase: 'liquid' },
    { material: 'h2o', phase: 'liquid' },
    { material: 'h2o', phase: 'gas' }
  ]);

  assert.equal(table.recordCount, 2);
  assert.deepEqual(table.materialMap, [{ material: 'h2o', materialId: stableOpticalMaterialId('h2o') }]);
  assert.deepEqual(
    table.recordMetadata.map((record) => ({ phase: record.phase, phaseId: record.phaseId })),
    [
      { phase: 'liquid', phaseId: 2 },
      { phase: 'gas', phaseId: 3 }
    ]
  );
});

test('stable optical material ids use atomic numbers for elements and deterministic ids for compounds', () => {
  assert.equal(stableOpticalMaterialId('Au'), 79);
  assert.equal(stableOpticalMaterialId('au'), 79);
  assert.equal(stableOpticalMaterialId('fe'), 26);
  assert.equal(stableOpticalMaterialId('h2o'), stableOpticalMaterialId('H2O'));
  assert.ok(stableOpticalMaterialId('h2o') > 1000);
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

test('optical GPU table upload binds a full spectral row when descriptors have no samples', () => {
  const table = buildOpticalGpuTable([{ material: 'unknown-material', phase: 'solid' }]);
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
  assert.equal(table.spectralSampleCount, 0);
  assert.equal(buffers.spectralSampleCount, 0);
  assert.equal(
    buffers.spectralSamplesBuffer.size,
    OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  assert.equal(
    writes.find((write) => write.label === 'ulg-optical-spectral-samples')?.byteLength,
    OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
});

test('optical GPU lookup queries sample packed records by material and phase ids', () => {
  const table = buildOpticalGpuTable([
    { material: 'h2o', phase: 'liquid' },
    { material: 'h2o', phase: 'gas' }
  ]);
  const lookup = buildOpticalGpuLookupQueries(table, [
    { material: 'h2o', phase: 'liquid' },
    { material: 'h2o', phase: 'gas' },
    { material: 'Au', phase: 'solid' }
  ]);
  const result = sampleOpticalGpuTableCpu(table, lookup);

  assert.equal(lookup.schema, ULG_OPTICAL_GPU_LOOKUP_SCHEMA);
  assert.equal(lookup.queries.length, lookup.queryCount * OPTICAL_GPU_LOOKUP_QUERY_FLOATS);
  assert.equal(result.outputs.length, lookup.queryCount * OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS);
  assert.equal(result.backend, 'cpu-reference');
  assert.ok(result.outputs[3] > 0, 'liquid water opacity output should be populated');
  assert.equal(result.outputs[11], 0, 'first query should match record index 0');
  assert.equal(result.outputs[OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS + 11], 1, 'second query should match record index 1');
  assert.equal(result.outputs[OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS * 2 + 10], 255, 'unknown query should return blocked status');
  assert.equal(result.outputs[OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS * 2 + 11], -1, 'unknown query should return no record index');
  assert.equal(
    result.outputs[OPTICAL_GPU_LOOKUP_OUTPUT_FLOATS * 2 + 15],
    lookup.queries[OPTICAL_GPU_LOOKUP_QUERY_FLOATS * 2 + 2],
    'unknown query should preserve requested optical state id'
  );
});

test('optical GPU table and lookup distinguish phase-resolved optical state', () => {
  const clearVaporState = {
    temperatureK: 450,
    h2oPartialPressurePa: 100,
    pressurePa: 101325
  };
  const supersaturatedState = {
    temperatureK: 300,
    h2oPartialPressurePa: 1e6,
    pressurePa: 1e6
  };
  const table = buildOpticalGpuTable([
    { material: 'h2o', phase: 'gas', opticalState: clearVaporState },
    { material: 'h2o', phase: 'gas', opticalState: supersaturatedState }
  ]);
  const lookup = buildOpticalGpuLookupQueries(table, [
    { material: 'h2o', phase: 'gas', opticalState: supersaturatedState },
    { material: 'h2o', phase: 'gas', opticalState: clearVaporState },
    { material: 'h2o', phase: 'gas' }
  ]);
  const result = sampleOpticalGpuTableCpu(table, lookup);
  const rows = decodeOpticalGpuLookupOutputRows(result, lookup);

  assert.equal(table.recordCount, 2);
  assert.deepEqual(
    table.recordMetadata.map((record) => record.opticalStateId),
    [stableOpticalStateId(clearVaporState), stableOpticalStateId(supersaturatedState)]
  );
  assert.notEqual(table.recordMetadata[0].opticalStateId, table.recordMetadata[1].opticalStateId);
  assert.equal(table.recordMetadata[0].renderModel, 'molecular-vapor-transparent-spectrum');
  assert.equal(table.recordMetadata[1].renderModel, 'molecular-condensed-droplet-scattering-pbr');
  assert.match(table.recordMetadata[1].opticalStateKey, /h2oPartialPressurePa/);
  assert.match(table.recordMetadata[1].opticalStateKey, /temperatureK/);
  assert.ok(table.records[(table.recordMetadata[1].recordIndex * OPTICAL_GPU_RECORD_FLOATS) + 17] > 0);
  assert.ok(table.records[(table.recordMetadata[1].recordIndex * OPTICAL_GPU_RECORD_FLOATS) + 20] > 0);
  assert.equal(rows[0].recordIndex, 1);
  assert.equal(rows[1].recordIndex, 0);
  assert.equal(rows[2].status, 255);
  assert.equal(rows[2].recordIndex, -1);
  assert.ok(rows[0].scatteringCoefficientPerM > rows[1].scatteringCoefficientPerM);
  assert.ok(rows[0].opticalDepth > rows[1].opticalDepth);
  assert.equal(rows[0].outputOpticalStateId, stableOpticalStateId(supersaturatedState));
  assert.equal(lookup.queries[2], stableOpticalStateId(supersaturatedState));
});

test('optical GPU lookup output rows decode draw-state fields with query metadata', () => {
  const { lookup, cpuReference } = createLookupFixture();
  const rows = decodeOpticalGpuLookupOutputRows(cpuReference, lookup);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].material, 'h2o');
  assert.equal(rows[0].phase, 'liquid');
  assert.deepEqual(rows[0].baseColorLinear.map((value) => Number.isFinite(value)), [true, true, true]);
  assert.ok(rows[0].opacity > 0);
  assert.equal(rows[0].recordIndex, 0);
  assert.ok(Number.isFinite(rows[0].opticalDepth));
  assert.ok(Number.isFinite(rows[0].scatteringCoefficientPerM));
  assert.ok(Number.isFinite(rows[0].absorptionCoefficientPerM));
  assert.equal(rows[0].outputOpticalStateId, rows[0].opticalStateId);
  assert.equal(rows[1].phase, 'gas');
});

test('optical GPU lookup output decoder rejects missing output buffers', () => {
  assert.throws(() => decodeOpticalGpuLookupOutputRows({ outputs: [] }), /Float32Array lookup outputs/);
});

test('optical GPU lookup WGSL consumes packed vec4 rows without struct alignment drift', () => {
  assert.match(opticalLookupWgsl, /record_index \* 6u/);
  assert.match(opticalLookupWgsl, /optical_outputs\[query_index \* 4u\]/);
  assert.match(opticalLookupWgsl, /row1\.x, row1\.y, row1\.z, row2\.z/);
  assert.match(opticalLookupWgsl, /row5\.w == query\.z/);
  assert.match(opticalLookupWgsl, /row5\.x, row4\.y, row4\.x, row5\.w/);
});

test('optional optical GPU lookup returns CPU reference when WebGPU is not requested', async () => {
  const { table, lookup, cpuReference } = createLookupFixture();
  const result = await runOpticalGpuLookupWithOptionalWebGpu({
    table,
    lookup,
    cpuReference,
    preferWebGpu: false,
    navigatorRef: {
      gpu: {
        async requestAdapter() {
          throw new Error('should not request WebGPU');
        }
      }
    }
  });

  assert.equal(result.schema, ULG_OPTICAL_GPU_LOOKUP_EXECUTION_SCHEMA);
  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.webgpuStatus.status, 'not-requested');
  assert.equal(result.outputs.length, cpuReference.outputs.length);
  assert.equal(result.scientificValidation, false);
});

test('optional optical GPU lookup falls back to CPU when navigator.gpu is unavailable', async () => {
  const { table, lookup, cpuReference } = createLookupFixture();
  const result = await runOpticalGpuLookupWithOptionalWebGpu({
    table,
    lookup,
    cpuReference,
    preferWebGpu: true,
    navigatorRef: {}
  });

  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.webgpuStatus.status, 'blocked-webgpu-unavailable');
  assert.equal(result.webgpuStatus.fallback, 'cpu-reference');
  assert.equal(result.outputs.length, cpuReference.outputs.length);
});

test('optional optical GPU lookup accepts WebGPU only after parity passes', async () => {
  const { table, lookup, cpuReference } = createLookupFixture();
  const result = await runOpticalGpuLookupWithOptionalWebGpu({
    table,
    lookup,
    cpuReference,
    preferWebGpu: true,
    deviceResult: {
      status: 'webgpu-device-ready',
      reason: 'fake device',
      device: { lost: new Promise(() => {}) }
    },
    async webGpuRunner() {
      return {
        ...cpuReference,
        backend: 'webgpu',
        outputs: new Float32Array(cpuReference.outputs)
      };
    },
    parityTolerance: 1e-8
  });

  assert.equal(result.backend, 'webgpu');
  assert.equal(result.webgpuStatus.status, 'webgpu-executed');
  assert.equal(result.webgpuParity.schema, ULG_OPTICAL_GPU_LOOKUP_PARITY_SCHEMA);
  assert.equal(result.webgpuParity.status, 'pass');
  assert.equal(result.webgpuParity.maxOutputAbs, 0);
});

test('optional optical GPU lookup rejects parity drift and keeps CPU output', async () => {
  const { table, lookup, cpuReference } = createLookupFixture();
  const drifted = new Float32Array(cpuReference.outputs);
  drifted[0] += 0.5;
  const result = await runOpticalGpuLookupWithOptionalWebGpu({
    table,
    lookup,
    cpuReference,
    preferWebGpu: true,
    deviceResult: {
      status: 'webgpu-device-ready',
      reason: 'fake device',
      device: { lost: new Promise(() => {}) }
    },
    async webGpuRunner() {
      return {
        ...cpuReference,
        backend: 'webgpu',
        outputs: drifted
      };
    },
    parityTolerance: 1e-8
  });

  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.webgpuStatus.status, 'webgpu-parity-failed');
  assert.equal(result.webgpuParity.status, 'fail');
  assert.ok(result.webgpuParity.maxOutputAbs > 0.1);
  assert.equal(result.outputs[0], cpuReference.outputs[0]);
});

test('optional optical GPU lookup reports device-lost CPU fallback', async () => {
  const { table, lookup, cpuReference } = createLookupFixture();
  const losses = [];
  const result = await runOpticalGpuLookupWithOptionalWebGpu({
    table,
    lookup,
    cpuReference,
    preferWebGpu: true,
    deviceResult: {
      status: 'webgpu-device-ready',
      reason: 'fake device',
      device: { lost: Promise.resolve({ reason: 'destroyed' }) }
    },
    onDeviceLost(info) {
      losses.push(info.reason);
    },
    async webGpuRunner() {
      throw new Error('runner should not execute after immediate device loss');
    }
  });

  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.webgpuStatus.status, 'webgpu-device-lost-fallback');
  assert.equal(result.webgpuStatus.reason, 'destroyed');
  assert.deepEqual(losses, ['destroyed']);
});

test('optical GPU lookup parity report is explicit and non-scientific', () => {
  const { cpuReference } = createLookupFixture();
  const parity = createOpticalGpuLookupParityReport({
    cpuReference,
    gpuResult: { ...cpuReference, backend: 'webgpu', outputs: new Float32Array(cpuReference.outputs) },
    tolerance: 1e-8
  });

  assert.equal(parity.schema, ULG_OPTICAL_GPU_LOOKUP_PARITY_SCHEMA);
  assert.equal(parity.status, 'pass');
  assert.equal(parity.scientificValidation, false);
  assert.equal(parity.fullPhysicsValidation, false);
});
