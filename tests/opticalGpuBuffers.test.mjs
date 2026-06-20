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
  ULG_OPTICAL_MATERIAL_BANK_PBR_WARM_INPUT_CONSUMER_SCHEMA,
  buildOpticalGpuTable,
  buildOpticalGpuLookupQueries,
  createOpticalGpuLookupParityReport,
  decodeOpticalGpuLookupOutputRows,
  opticalLookupWgsl,
  requestOpticalGpuDevice,
  runOpticalGpuLookup,
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

function sodiumWarmInputTable() {
  return {
    schema: 'peercompute.ulg.material-property-bank.gpu-warm-input-table.v0',
    status: 'material-bank-gpu-warm-input-table-ready',
    rowLayout: [
      'materialId:f32',
      'atomicNumber:f32',
      'temperatureK:f32',
      'pressurePa:f32',
      'targetNeighborCount:f32',
      'phaseCount:f32',
      'baseColorSrgbR:f32',
      'baseColorSrgbG:f32',
      'baseColorSrgbB:f32',
      'metalness:f32',
      'roughness:f32',
      'ior:f32',
      'strictSourceOfTruth:f32',
      'status:f32',
      'pad0:f32',
      'pad1:f32'
    ],
    rowStrideFloats: 16,
    rowCount: 1,
    rows: Float32Array.from([
      stableOpticalMaterialId('Na'),
      11,
      290,
      101325,
      64,
      1,
      0.86,
      0.82,
      0.72,
      1,
      0.31,
      1.1,
      0,
      1,
      0,
      0
    ]),
    metadata: [{
      role: 'drop',
      material: 'Na',
      requestedMaterial: 'na',
      materialId: stableOpticalMaterialId('Na'),
      atomicNumber: 11,
      temperatureK: 290,
      pressurePa: 101325,
      bankFamily: 'elements',
      bankSchemaVersion: 1,
      generatorFingerprint: 'test-bank'
    }]
  };
}

function fakeOpticalLookupDevice() {
  const queueWrites = [];
  const bindGroupLayouts = [];
  const bindGroups = [];
  const destroyed = [];
  const makeBuffer = ({ label, size, usage }) => ({
    label,
    size,
    usage,
    data: new ArrayBuffer(Math.max(16, size)),
    destroyed: false,
    destroy() {
      this.destroyed = true;
      destroyed.push(label);
    },
    async mapAsync() {},
    getMappedRange() {
      return this.data;
    },
    unmap() {}
  });
  return {
    queueWrites,
    bindGroupLayouts,
    bindGroups,
    destroyed,
    queue: {
      writeBuffer(buffer, offset, data) {
        queueWrites.push({ label: buffer?.label ?? null, offset, byteLength: data?.byteLength ?? 0 });
        if (buffer?.data && data?.buffer) {
          new Uint8Array(buffer.data).set(
            new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
            offset
          );
        }
      },
      submit() {}
    },
    createBuffer(descriptor) {
      return makeBuffer(descriptor);
    },
    createShaderModule({ code }) {
      return { code };
    },
    createBindGroupLayout(descriptor) {
      bindGroupLayouts.push(descriptor);
      return descriptor;
    },
    createPipelineLayout(descriptor) {
      return descriptor;
    },
    createComputePipeline({ compute }) {
      return {
        compute,
        getBindGroupLayout(index) {
          return { index };
        }
      };
    },
    createBindGroup({ layout, entries }) {
      const bindGroup = { layout, entries };
      bindGroups.push(bindGroup);
      return bindGroup;
    },
    createCommandEncoder() {
      return {
        beginComputePass() {
          return {
            setPipeline() {},
            setBindGroup() {},
            dispatchWorkgroups() {},
            end() {}
          };
        },
        copyBufferToBuffer(source, sourceOffset, target, targetOffset, size) {
          if (!source?.data || !target?.data) return;
          new Uint8Array(target.data).set(
            new Uint8Array(source.data, sourceOffset, size),
            targetOffset
          );
        },
        finish() {
          return {};
        }
      };
    }
  };
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

test('optical GPU table carries non-authoritative material-bank PBR warm inputs', () => {
  const warmInputTable = sodiumWarmInputTable();
  const table = buildOpticalGpuTable([
    { material: 'Na', phase: 'solid' },
    { material: 'h2o', phase: 'liquid' }
  ], {
    materialPropertyBankGpuWarmInputTable: warmInputTable
  });
  const sodium = table.recordMetadata.find((record) => record.material === 'Na');
  const water = table.recordMetadata.find((record) => record.material === 'h2o');

  assert.equal(
    table.materialPropertyBankPbrWarmInputConsumer.schema,
    ULG_OPTICAL_MATERIAL_BANK_PBR_WARM_INPUT_CONSUMER_SCHEMA
  );
  assert.equal(
    table.materialPropertyBankPbrWarmInputConsumer.status,
    'optical-gpu-table-annotated-with-material-bank-pbr-warm-inputs'
  );
  assert.equal(table.materialPropertyBankPbrWarmInputConsumer.sourceRowCount, 1);
  assert.equal(table.materialPropertyBankPbrWarmInputConsumer.matchedRecordCount, 1);
  assert.equal(table.materialPropertyBankPbrWarmInputConsumer.strictSourceOfTruth, false);
  assert.equal(table.materialPropertyBankPbrWarmInputConsumer.shaderBound, false);
  assert.equal(table.materialPropertyBankPbrWarmInputRowCount, 1);
  assert.equal(table.materialPropertyBankPbrWarmInputRows.length, warmInputTable.rows.length);
  assert.equal(table.materialPropertyBankPbrWarmInputRowStrideFloats, 16);
  assert.equal(table.materialPropertyBankPbrWarmInputMatchedRecordCount, 1);
  assert.equal(sodium.materialPropertyBankPbrWarmInput.material, 'Na');
  assert.ok(Math.abs(sodium.materialPropertyBankPbrWarmInput.baseColorSrgb[0] - 0.86) < 1e-6);
  assert.ok(Math.abs(sodium.materialPropertyBankPbrWarmInput.baseColorSrgb[1] - 0.82) < 1e-6);
  assert.ok(Math.abs(sodium.materialPropertyBankPbrWarmInput.baseColorSrgb[2] - 0.72) < 1e-6);
  assert.equal(sodium.materialPropertyBankPbrWarmInput.strictSourceOfTruth, false);
  assert.equal(sodium.materialPropertyBankPbrWarmInputStatus, 'material-bank-pbr-warm-input-attached');
  assert.equal(water.materialPropertyBankPbrWarmInput, null);
  assert.equal(water.materialPropertyBankPbrWarmInputStatus, 'no-material-bank-pbr-warm-input');
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

test('optical GPU table packs air as transparent Rayleigh PBR instead of blocked black', () => {
  const table = buildOpticalGpuTable([
    {
      material: 'air',
      phase: 'gas',
      properties: { phases: [{ name: 'gas', densityKgPerM3: 1.225 }] }
    }
  ]);
  const metadata = table.recordMetadata[0];
  assert.equal(table.recordCount, 1);
  assert.equal(metadata.material, 'air');
  assert.equal(metadata.phase, 'gas');
  assert.equal(metadata.renderModel, 'gas-rayleigh-transparent-pbr');

  const lookup = buildOpticalGpuLookupQueries(table, [{ material: 'air', phase: 'gas' }]);
  const result = sampleOpticalGpuTableCpu(table, lookup);
  const [row] = decodeOpticalGpuLookupOutputRows(result, lookup);
  assert.equal(row.material, 'air');
  assert.equal(row.phase, 'gas');
  assert.equal(row.status, 1);
  assert.notEqual(row.status, 255);
  assert.ok(row.transmission > 0.999);
  assert.ok(row.opacity < 0.001);
  assert.ok(row.scatteringCoefficientPerM > 0);
  assert.ok(row.baseColorLinear.every((value) => value > 0.6));
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
  assert.match(opticalLookupWgsl, /@binding\(4\) var<storage, read> material_bank_pbr_warm_input_rows/);
  assert.match(opticalLookupWgsl, /fn material_bank_pbr_warm_input_anchor/);
  assert.match(opticalLookupWgsl, /optical_outputs\[query_index \* 4u\]/);
  assert.match(opticalLookupWgsl, /row1\.x \+ warm_input_anchor, row1\.y, row1\.z, row2\.z/);
  assert.match(opticalLookupWgsl, /row5\.w == query\.z/);
  assert.match(opticalLookupWgsl, /row5\.x, row4\.y, row4\.x, row5\.w/);
});

test('optical GPU lookup binds material-bank PBR warm inputs without overriding closure records', async () => {
  const table = buildOpticalGpuTable([
    { material: 'Na', phase: 'solid' }
  ], {
    materialPropertyBankGpuWarmInputTable: sodiumWarmInputTable()
  });
  const lookup = buildOpticalGpuLookupQueries(table, [{ material: 'Na', phase: 'solid' }]);
  const device = fakeOpticalLookupDevice();

  const result = await runOpticalGpuLookupWithOptionalWebGpu({
    table,
    lookup,
    preferWebGpu: true,
    device,
    webGpuRunner: runOpticalGpuLookup,
    parityTolerance: Number.POSITIVE_INFINITY
  });

  assert.equal(result.backend, 'webgpu');
  assert.equal(
    result.materialPropertyBankPbrWarmInputConsumer.schema,
    ULG_OPTICAL_MATERIAL_BANK_PBR_WARM_INPUT_CONSUMER_SCHEMA
  );
  assert.equal(
    result.materialPropertyBankPbrWarmInputConsumer.status,
    'optical-material-bank-pbr-warm-inputs-bound-in-shader'
  );
  assert.equal(result.materialPropertyBankPbrWarmInputConsumer.shaderBound, true);
  assert.equal(result.materialPropertyBankPbrWarmInputConsumer.shaderBinding, 4);
  assert.equal(result.materialPropertyBankPbrWarmInputConsumer.shaderRowCount, 1);
  assert.equal(result.materialPropertyBankPbrWarmInputConsumer.bufferSource, 'optical-gpu-table');
  assert.equal(result.materialPropertyBankPbrWarmInputRowCount, 1);
  assert.equal(result.materialPropertyBankPbrWarmInputMatchedRecordCount, 1);
  assert.ok(device.bindGroupLayouts.at(-1).entries.some((entry) => entry.binding === 4));
  assert.ok(device.bindGroups.at(-1).entries.some((entry) => (
    entry.binding === 4
      && entry.resource.buffer.label === 'ulg-optical-material-bank-pbr-warm-input-rows'
  )));
  assert.equal(
    device.queueWrites.some((write) => write.label === 'ulg-optical-material-bank-pbr-warm-input-rows'),
    true
  );
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
