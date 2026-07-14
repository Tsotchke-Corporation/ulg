import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_ROW_LAYOUT,
  MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_TABLE_SCHEMA
} from '../src/runtime/material/materialPropertyBank.js';
import { GPU_PHASE_IDS, stableOpticalMaterialId } from '../src/runtime/material/opticalGpuBuffers.js';
import {
  buildMlsMpmMechanicsMaterialTable,
  findMechanicsMaterialPhaseRecord,
  MLS_MPM_EOS_MODEL_IDS,
  ULG_MLS_MPM_MECHANICS_MATERIAL_BANK_WARM_INPUT_CONSUMER_SCHEMA
} from '../src/runtime/sph/sphMechanicsMaterialTable.js';
import {
  destroyMlsMpmMechanicsMaterialPhaseUpload,
  refreshMlsMpmMechanicsCpu,
  runMlsMpmMechanicsRefreshWebGpu,
  uploadMlsMpmMechanicsMaterialPhaseRecords
} from '../src/runtime/sph/sphMechanicsRefreshGpuKernel.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import { mlsMpmMechanicsRefreshWgsl } from '../ulg-gpu-abi/src/wgsl.js';

function nearlyEqual(actual, expected, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test('MLS-MPM mechanics material table packs phase mechanics for condensed and gas phases', () => {
  const table = buildMlsMpmMechanicsMaterialTable({
    h2o: {
      molarMassKgPerMol: 0.018015,
      phases: [
        { name: 'liquid', densityKgPerM3: 997, bulkModulusPa: 2.2e9, shearModulusPa: 0, cpJPerKgK: 4184, temperatureRange: [273.15, 373.15] },
        { name: 'gas', densityKgPerM3: 0.6, bulkModulusPa: null, shearModulusPa: 0, cpJPerKgK: 2010, temperatureRange: [373.15, 1000] }
      ]
    }
  }, { soundSpeedScale: 0.5 });

  assert.equal(table.schema, 'peercompute.ulg.mls-mpm-mechanics-material-table.v0');
  assert.equal(table.phaseRecordCount, 2);
  const liquid = findMechanicsMaterialPhaseRecord(table, stableOpticalMaterialId('h2o'), 2);
  assert.equal(liquid.restDensityKgPerM3, 997);
  nearlyEqual(liquid.effectiveBulkModulusPa, 2.2e9 * 0.25, 128);
  assert.equal(liquid.eosModelId, MLS_MPM_EOS_MODEL_IDS.taitCondensed);
  assert.equal(liquid.solidFlag, 0);
  const gas = findMechanicsMaterialPhaseRecord(table, stableOpticalMaterialId('h2o'), 3);
  assert.equal(gas.effectiveBulkModulusPa, 0);
  assert.equal(gas.eosModelId, MLS_MPM_EOS_MODEL_IDS.gasLinearized);
  assert.ok(gas.soundSpeedMPerS >= 40);
});

test('MLS-MPM mechanics material table annotates material-bank warm inputs without making them authoritative', () => {
  const table = buildMlsMpmMechanicsMaterialTable({
    h2o: {
      molarMassKgPerMol: 0.018015,
      phases: [
        { name: 'liquid', densityKgPerM3: 997, bulkModulusPa: 2.2e9, shearModulusPa: 0, cpJPerKgK: 4184, temperatureRange: [273.15, 373.15] }
      ]
    },
    fe: {
      molarMassKgPerMol: 0.055845,
      phases: [
        { name: 'solid', densityKgPerM3: 7874, bulkModulusPa: 1.7e11, shearModulusPa: 8.2e10, cpJPerKgK: 449, temperatureRange: [0, 1811] }
      ]
    }
  }, {
    materialPropertyBankGpuWarmInputTable: {
      schema: MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_TABLE_SCHEMA,
      status: 'material-bank-gpu-warm-input-table-ready',
      rowCount: 1,
      rows: new Float32Array(16),
      metadata: [{
        material: 'Fe',
        requestedMaterial: 'Fe',
        atomicNumber: 26,
        temperatureK: 300,
        pressurePa: 101325,
        strictSourceOfTruth: false,
        status: 'ready'
      }]
    }
  });

  assert.equal(
    table.materialPropertyBankWarmInputConsumer.schema,
    ULG_MLS_MPM_MECHANICS_MATERIAL_BANK_WARM_INPUT_CONSUMER_SCHEMA
  );
  assert.equal(
    table.materialPropertyBankWarmInputConsumer.status,
    'mechanics-material-table-annotated-with-material-bank-warm-inputs'
  );
  assert.equal(table.materialPropertyBankWarmInputConsumer.sourceRowCount, 1);
  assert.equal(table.materialPropertyBankWarmInputConsumer.matchedMaterialCount, 1);
  assert.equal(table.materialPropertyBankWarmInputConsumer.strictSourceOfTruth, false);
  assert.equal(table.materialPropertyBankWarmInputConsumer.shaderBound, false);
  assert.equal(table.materialPropertyBankWarmInputRowCount, 1);
  assert.equal(table.materialPropertyBankWarmInputMatchedMaterialCount, 1);
  const iron = table.metadata.find((entry) => entry.material === 'fe');
  const water = table.metadata.find((entry) => entry.material === 'h2o');
  assert.equal(iron.materialPropertyBankWarmInput.material, 'Fe');
  assert.equal(iron.materialPropertyBankWarmInputStatus, 'material-bank-warm-input-attached');
  assert.equal(water.materialPropertyBankWarmInput, null);
  assert.equal(water.materialPropertyBankWarmInputStatus, 'no-material-bank-warm-input');
});

test('CPU mechanics refresh updates constitutive fields from current thermo phase', () => {
  const table = buildMlsMpmMechanicsMaterialTable({
    h2o: {
      molarMassKgPerMol: 0.018015,
      phases: [
        { name: 'solid', densityKgPerM3: 917, bulkModulusPa: 8.8e9, shearModulusPa: 3.5e9, cpJPerKgK: 2100, temperatureRange: [0, 273.15] },
        { name: 'liquid', densityKgPerM3: 997, bulkModulusPa: 2.2e9, shearModulusPa: 0, cpJPerKgK: 4184, temperatureRange: [273.15, 373.15], dynamicViscosityPaS: 0.001, surfaceTensionNPerM: 0.072 }
      ]
    }
  }, { viscosityEnabled: true, viscosityLengthM: 0.05, surfaceTensionEnabled: true });
  const state = new Float32Array([0, 0, 0, 9.17, 0, 0, 0, 300]);
  const thermo = new Float32Array(SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length);
  thermo[0] = stableOpticalMaterialId('h2o');
  thermo[1] = GPU_PHASE_IDS.liquid;
  thermo[3] = 917;
  const mechanics = new Float32Array(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length);
  mechanics[18] = 1;
  mechanics[19] = 1;
  mechanics[20] = 0;
  mechanics[22] = 2.2e9;
  mechanics[28] = 1234;
  const result = refreshMlsMpmMechanicsCpu({
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      state,
      thermo
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      mechanics
    },
    mechanicsMaterialTable: table
  });

  assert.equal(result.status, 'mechanics-constitutive-refresh-executed');
  nearlyEqual(result.mechanics[19], 9.17 / 917);
  assert.equal(result.mechanics[20], 0);
  nearlyEqual(result.mechanics[22], 2.2e9, 1024);
  nearlyEqual(result.mechanics[23], 0, 1e-6);
  assert.equal(result.mechanics[26], MLS_MPM_EOS_MODEL_IDS.taitCondensed);
  assert.equal(result.mechanics[28], 1234);
  assert.ok(result.mechanics[29] > 0.001);
  nearlyEqual(result.mechanics[30], 0.072, 1e-6);
});

test('CPU mechanics refresh resets deformation history on large gas to condensed phase change', () => {
  const table = buildMlsMpmMechanicsMaterialTable({
    h2o: {
      molarMassKgPerMol: 0.018015,
      phases: [
        { name: 'liquid', densityKgPerM3: 997, bulkModulusPa: 2.2e9, shearModulusPa: 0, cpJPerKgK: 4184, temperatureRange: [273.15, 373.15] },
        { name: 'gas', densityKgPerM3: 0.6, bulkModulusPa: null, shearModulusPa: 0, cpJPerKgK: 2010, temperatureRange: [373.15, 1000] }
      ]
    }
  });
  const state = new Float32Array([0, 0, 0, 0.6, 0, 0, 0, 300]);
  const thermo = new Float32Array(SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length);
  thermo[0] = stableOpticalMaterialId('h2o');
  thermo[1] = GPU_PHASE_IDS.liquid;
  thermo[3] = 997;
  const mechanics = new Float32Array(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length);
  mechanics.set([2, 0.1, 0, 0.2, 2, 0, 0, 0.3, 2], 0);
  mechanics.set([4, 5, 6, 7, 8, 9, 10, 11, 12], 9);
  mechanics[18] = 8;
  mechanics[19] = 1;
  mechanics[20] = 0;
  mechanics[26] = MLS_MPM_EOS_MODEL_IDS.gasLinearized;
  const result = refreshMlsMpmMechanicsCpu({
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      state,
      thermo
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      mechanics
    },
    mechanicsMaterialTable: table
  });

  nearlyEqual(result.mechanics[0], 1);
  nearlyEqual(result.mechanics[4], 1);
  nearlyEqual(result.mechanics[8], 1);
  for (let index = 1; index < 9; index += 1) {
    if (index === 4 || index === 8) continue;
    nearlyEqual(result.mechanics[index], 0);
  }
  for (let index = 9; index <= 17; index += 1) nearlyEqual(result.mechanics[index], 0);
  nearlyEqual(result.mechanics[18], 1);
  nearlyEqual(result.mechanics[19], 0.6 / 997, 1e-9);
  assert.equal(result.mechanics[26], MLS_MPM_EOS_MODEL_IDS.taitCondensed);
});

test('CPU mechanics refresh initializes a newly activated invalid product row', () => {
  const table = buildMlsMpmMechanicsMaterialTable({
    naoh: {
      molarMassKgPerMol: 0.039997,
      phases: [
        { name: 'liquid', densityKgPerM3: 687, bulkModulusPa: 1.5e9, shearModulusPa: 0, cpJPerKgK: 2000, temperatureRange: [273.15, 2000] }
      ]
    }
  });
  const state = new Float32Array([0, 0, 0, 0.687, 0, 0, 0, 300]);
  const thermo = new Float32Array(SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length);
  thermo[0] = stableOpticalMaterialId('naoh');
  thermo[1] = GPU_PHASE_IDS.liquid;
  thermo[3] = 687;
  const mechanics = new Float32Array(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length);
  mechanics.set([9, 8, 7, 6, 5, 4, 3, 2, 1], 0);
  mechanics[18] = 0;
  mechanics[19] = 0;
  mechanics[21] = 0;
  mechanics[27] = 0;

  const result = refreshMlsMpmMechanicsCpu({
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      state,
      thermo
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      mechanics
    },
    mechanicsMaterialTable: table
  });

  assert.deepEqual(Array.from(result.mechanics.slice(0, 9)), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.equal(result.mechanics[18], 1);
  nearlyEqual(result.mechanics[19], 0.001, 1e-9);
  assert.equal(result.mechanics[21], 1);
  assert.equal(result.mechanics[27], 1);
});

test('WGSL mechanics refresh updates rest volume and constitutive rows without state readback', () => {
  assert.match(mlsMpmMechanicsRefreshWgsl, /fn find_phase_mechanics/);
  assert.match(mlsMpmMechanicsRefreshWgsl, /@binding\(6\) var<storage, read> material_bank_warm_input_rows/);
  assert.match(mlsMpmMechanicsRefreshWgsl, /fn material_bank_warm_input_anchor/);
  assert.match(mlsMpmMechanicsRefreshWgsl, /mechanics_refresh_should_reset/);
  assert.match(mlsMpmMechanicsRefreshWgsl, /if \(!previous_reference_valid\)/);
  assert.match(mlsMpmMechanicsRefreshWgsl, /rest_ratio >= 2\.0/);
  assert.match(mlsMpmMechanicsRefreshWgsl, /out_mechanics\[mechanics_base \+ row\] = source_mechanics\[mechanics_base \+ row\]/);
  assert.match(mlsMpmMechanicsRefreshWgsl, /out_mechanics\[mechanics_base \+ 4u\]/);
  assert.match(mlsMpmMechanicsRefreshWgsl, /out_mechanics\[mechanics_base \+ 5u\]/);
  assert.match(mlsMpmMechanicsRefreshWgsl, /out_mechanics\[mechanics_base \+ 6u\]/);
  assert.match(mlsMpmMechanicsRefreshWgsl, /row2\.z/);
  assert.match(mlsMpmMechanicsRefreshWgsl, /row2\.w/);
});

test('WebGPU mechanics refresh leaves output mechanics initialization to the shader', async () => {
  const table = buildMlsMpmMechanicsMaterialTable({
    h2o: {
      molarMassKgPerMol: 0.018015,
      phases: [
        { name: 'liquid', densityKgPerM3: 997, bulkModulusPa: 2.2e9, shearModulusPa: 0, cpJPerKgK: 4184, temperatureRange: [273.15, 373.15] }
      ]
    }
  }, {
    materialPropertyBankGpuWarmInputTable: {
      schema: MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_TABLE_SCHEMA,
      status: 'material-bank-gpu-warm-input-table-ready',
      rowCount: 1,
      rows: new Float32Array(16),
      metadata: [{
        material: 'h2o',
        requestedMaterial: 'h2o',
        atomicNumber: 8,
        temperatureK: 300,
        pressurePa: 101325,
        strictSourceOfTruth: false,
        status: 'ready'
      }]
    }
  });
  const state = new Float32Array([0, 0, 0, 9.97, 0, 0, 0, 300]);
  const thermo = new Float32Array(SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length);
  thermo[0] = stableOpticalMaterialId('h2o');
  thermo[1] = GPU_PHASE_IDS.liquid;
  thermo[3] = 997;
  const mechanics = new Float32Array(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length);
  mechanics[18] = 1;
  mechanics[19] = 1;

  const queueWrites = [];
  const bindGroups = [];
  const device = {
    queue: {
      writeBuffer(buffer, offset, data) {
        queueWrites.push({ label: buffer?.label ?? null, offset, byteLength: data?.byteLength ?? 0 });
      },
      submit() {},
      onSubmittedWorkDone() {
        return Promise.resolve();
      }
    },
    createBuffer({ label, size, usage }) {
      return {
        label,
        size,
        usage,
        destroyed: false,
        destroy() {
          this.destroyed = true;
        }
      };
    },
    createShaderModule({ label, code }) {
      return { label, code };
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
        finish() {
          return {};
        }
      };
    }
  };

  const result = await runMlsMpmMechanicsRefreshWebGpu({
    device,
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      state,
      thermo
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      mechanics
    },
    mechanicsMaterialTable: table,
    sphParticleUpload: {
      stateBuffer: { label: 'borrowed-state' },
      thermoBuffer: { label: 'borrowed-thermo' },
      materialPropertyBankWarmInputBuffer: { label: 'material-bank-warm-inputs' },
      materialPropertyBankWarmInputRowCount: 1
    },
    mlsMpmParticleUpload: {
      mechanicsBuffer: { label: 'borrowed-mechanics' }
    },
    retainOutputParticleBuffers: true,
    readbackMode: 'no-full-readback'
  });

  assert.equal(result.status, 'mechanics-constitutive-refresh-executed');
  assert.equal(result.outputBufferInitializationMode, 'shader-copies-source-mechanics-rows');
  assert.equal(
    result.mechanicsMaterialBankWarmInputConsumer.schema,
    ULG_MLS_MPM_MECHANICS_MATERIAL_BANK_WARM_INPUT_CONSUMER_SCHEMA
  );
  assert.equal(
    result.mechanicsMaterialBankWarmInputConsumer.status,
    'mechanics-material-bank-warm-inputs-bound-in-shader'
  );
  assert.equal(result.mechanicsMaterialBankWarmInputConsumer.shaderBound, true);
  assert.equal(result.mechanicsMaterialBankWarmInputConsumer.shaderBinding, 6);
  assert.equal(result.mechanicsMaterialBankWarmInputConsumer.shaderRowCount, 1);
  assert.equal(result.mechanicsMaterialBankWarmInputConsumer.bufferSource, 'sph-particle-upload');
  assert.equal(result.mechanicsMaterialBankWarmInputRowCount, 1);
  assert.equal(result.mechanicsMaterialBankWarmInputMatchedMaterialCount, 1);
  assert.ok(bindGroups.at(-1).entries.some((entry) => (
    entry.binding === 6 && entry.resource.buffer.label === 'material-bank-warm-inputs'
  )));
  assert.equal(queueWrites.some((write) => write.label === 'ulg-mls-mpm-mechanics-refresh-output-mechanics'), false);
});

test('WebGPU mechanics refresh reuses uploaded material phase records', async () => {
  const table = buildMlsMpmMechanicsMaterialTable({
    h2o: {
      molarMassKgPerMol: 0.018015,
      phases: [
        { name: 'liquid', densityKgPerM3: 997, bulkModulusPa: 2.2e9, shearModulusPa: 0, cpJPerKgK: 4184, temperatureRange: [273.15, 373.15] }
      ]
    }
  });
  const state = new Float32Array([0, 0, 0, 9.97, 0, 0, 0, 300]);
  const thermo = new Float32Array(SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length);
  thermo[0] = stableOpticalMaterialId('h2o');
  thermo[1] = GPU_PHASE_IDS.liquid;
  thermo[3] = 997;
  const mechanics = new Float32Array(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length);
  mechanics[18] = 1;
  mechanics[19] = 1;

  const queueWrites = [];
  const device = {
    queue: {
      writeBuffer(buffer, offset, data) {
        queueWrites.push({ label: buffer?.label ?? null, offset, byteLength: data?.byteLength ?? 0 });
      },
      submit() {},
      onSubmittedWorkDone() {
        return Promise.resolve();
      }
    },
    createBuffer({ label, size, usage }) {
      return {
        label,
        size,
        usage,
        destroyed: false,
        destroy() {
          this.destroyed = true;
        }
      };
    },
    createShaderModule({ label, code }) {
      return { label, code };
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
      return { layout, entries };
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
        finish() {
          return {};
        }
      };
    }
  };

  const materialPhaseUpload = uploadMlsMpmMechanicsMaterialPhaseRecords(device, table);
  assert.equal(materialPhaseUpload.status, 'webgpu-uploaded');
  assert.equal(queueWrites.some((write) => write.label === 'ulg-mls-mpm-mechanics-material-phase-records'), true);
  queueWrites.length = 0;

  const result = await runMlsMpmMechanicsRefreshWebGpu({
    device,
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      state,
      thermo
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      mechanics
    },
    mechanicsMaterialTable: table,
    mechanicsMaterialPhaseUpload: materialPhaseUpload,
    sphParticleUpload: {
      stateBuffer: { label: 'borrowed-state' },
      thermoBuffer: { label: 'borrowed-thermo' }
    },
    mlsMpmParticleUpload: {
      mechanicsBuffer: { label: 'borrowed-mechanics' }
    },
    retainOutputParticleBuffers: true,
    readbackMode: 'no-full-readback'
  });

  assert.equal(result.status, 'mechanics-constitutive-refresh-executed');
  assert.equal(result.mechanicsMaterialPhaseUploadStatus, 'webgpu-uploaded');
  assert.equal(result.mechanicsMaterialPhaseUploadReused, true);
  assert.equal(queueWrites.some((write) => write.label === 'ulg-mls-mpm-mechanics-material-phase-records'), false);
  assert.deepEqual(
    queueWrites.find((write) => write.label === 'ulg-mls-mpm-mechanics-material-bank-warm-input-rows-empty'),
    {
      label: 'ulg-mls-mpm-mechanics-material-bank-warm-input-rows-empty',
      offset: 0,
      byteLength: MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT
    }
  );
  assert.equal(result.mechanicsMaterialBankWarmInputConsumer.shaderRowCount, 0);
  assert.equal(materialPhaseUpload.destroyed, false);
  destroyMlsMpmMechanicsMaterialPhaseUpload(materialPhaseUpload);
  assert.equal(materialPhaseUpload.destroyed, true);
});
