import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ULG_CLOSURE_LAW_GRAPH_SCHEMA } from '../ulg-gpu-abi/src/index.js';
import { sphThermalStepWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import { evaluateClosureLawGraphCpu } from '../src/runtime/closureLawGraph.js';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { stableOpticalMaterialId, GPU_PHASE_IDS } from '../src/runtime/material/opticalGpuBuffers.js';
import { equilibriumFromSpecificEnergy } from '../src/runtime/material/phaseEquilibrium.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';
import { createSphState } from '../src/runtime/sph/sphState.js';
import {
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS,
  buildSphGpuParticleBuffers
} from '../src/runtime/sph/sphGpuBuffers.js';
import {
  SPH_THERMAL_CLOSURE_GRAPH_SLOTS,
  ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA,
  ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA,
  ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_PHASE_RESPONSE_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
  ULG_SPH_THERMAL_MATERIAL_BANK_WARM_INPUT_CONSUMER_SCHEMA,
  buildSphThermalPhaseResponseTable,
  buildSphThermalClosureGraphBuffers,
  buildSphThermalMaterialTable,
  compareSphThermalStepParity,
  destroySphThermalResponseGraphBuffers,
  resolveThermalPhaseResponseFromTable,
  resolveThermalStateFromGraphPhaseResponseCpu,
  resolveThermalStateFromTable,
  SPH_THERMAL_STEFAN_BOLTZMANN_W_PER_M2_K4,
  thermalEmissivityFromTable,
  createSphThermalStepWebGpuEncoderStage,
  runSphThermalStepCpu,
  runSphThermalStepWebGpu,
  runSphThermalStepWithOptionalWebGpu,
  uploadSphThermalResponseGraphBuffers
} from '../src/runtime/sph/sphThermalGpuKernel.js';
import { createSphThermalWorkspaceGpu } from '../src/runtime/sph/sphThermalWorkspaceGpu.js';

const closures = createReferenceMaterialClosures();
const materialProperties = {
  h2o: closures.h2o.properties,
  fe: closures.fe.properties,
  air: closures.air.properties
};

function nearlyEqual(actual, expected, tolerance = 1e-3) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function packedTwoWaterParticles(hotK = 330, coldK = 250) {
  const state = createSphState({
    smoothingLengthM: 0.1,
    dimension: 3,
    particles: [
      {
        id: 'hot',
        material: 'h2o',
        x: [2, 2, 2],
        v: [0, 0, 0],
        massKg: 1,
        specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(materialProperties.h2o, hotK)
      },
      {
        id: 'cold',
        material: 'h2o',
        x: [2.08, 2, 2],
        v: [0, 0, 0],
        massKg: 1,
        specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(materialProperties.h2o, coldK)
      }
    ]
  });
  return buildSphGpuParticleBuffers(state, { materialProperties });
}

function totalInternalEnergyJ(packed) {
  let total = 0;
  for (let i = 0; i < packed.particleCount; i += 1) {
    const offset = i * SPH_GPU_PARTICLE_STATE_FLOATS;
    total += packed.state[offset + 3] * packed.state[offset + 7];
  }
  return total;
}

function fakeThermalDeviceWithFence() {
  let resolveFence;
  const fence = new Promise((resolve) => {
    resolveFence = resolve;
  });
  const destroyed = [];
  const buffers = [];
  const bindGroups = [];
  const queueWrites = [];
  const pipelines = [];
  const dispatches = [];
  const device = {
    destroyed,
    buffers,
    bindGroups,
    queueWrites,
    pipelines,
    dispatches,
    fenceRequestedCount: 0,
    resolveFence,
    queue: {
      writeBuffer(buffer, offset, data) {
        queueWrites.push({ label: buffer?.label ?? null, offset, byteLength: data?.byteLength ?? 0 });
      },
      submit() {},
      onSubmittedWorkDone() {
        device.fenceRequestedCount += 1;
        return fence;
      }
    },
    createBuffer({ label, size, usage }) {
      const buffer = {
        label,
        size,
        usage,
        destroyed: false,
        destroy() {
          if (this.destroyed) return;
          this.destroyed = true;
          destroyed.push(label);
        }
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule({ label, code }) {
      return { label, code };
    },
    createComputePipeline(descriptor) {
      const pipeline = {
        ...descriptor,
        getBindGroupLayout(index) {
          return { index };
        }
      };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroupLayout({ label, entries }) {
      return { label, entries };
    },
    createPipelineLayout({ label, bindGroupLayouts }) {
      return { label, bindGroupLayouts };
    },
    createBindGroup({ layout, entries }) {
      const bindGroup = { layout, entries };
      bindGroups.push(bindGroup);
      return bindGroup;
    },
    createCommandEncoder() {
      return {
        beginComputePass() {
          let pipeline = null;
          return {
            setPipeline(nextPipeline) {
              pipeline = nextPipeline;
            },
            setBindGroup() {},
            dispatchWorkgroups(count) {
              dispatches.push({
                count,
                entryPoint: pipeline?.compute?.entryPoint ?? null
              });
            },
            end() {}
          };
        },
        finish() {
          return {};
        }
      };
    }
  };
  return device;
}

test('SPH thermal material table packs closure-derived energy/phase segments', () => {
  const table = buildSphThermalMaterialTable(materialProperties);
  const waterId = stableOpticalMaterialId('h2o');
  const waterRecordIndex = Array.from(table.records).findIndex((value, index) => (
    index % 4 === 0 && value === waterId
  ));

  assert.equal(table.schema, ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA);
  assert.equal(table.status, 'closure-derived-thermal-table-ready');
  assert.ok(table.materialCount >= 3);
  assert.ok(table.segmentCount > table.materialCount);
  assert.notEqual(waterRecordIndex, -1);
  assert.equal(table.scientificValidation, false);
  assert.equal(table.phaseChangeValidation, false);

  const iceEnergy = specificInternalEnergyJPerKg(materialProperties.h2o, 250);
  const liquidEnergy = specificInternalEnergyJPerKg(materialProperties.h2o, 300);
  const steamEnergy = specificInternalEnergyJPerKg(materialProperties.h2o, 450);
  const ironId = stableOpticalMaterialId('fe');
  const ironEnergy = specificInternalEnergyJPerKg(materialProperties.fe, 300);
  assert.equal(resolveThermalStateFromTable(table, waterId, iceEnergy).phaseId, GPU_PHASE_IDS.solid);
  assert.equal(resolveThermalStateFromTable(table, waterId, liquidEnergy).phaseId, GPU_PHASE_IDS.liquid);
  assert.equal(resolveThermalStateFromTable(table, waterId, steamEnergy).phaseId, GPU_PHASE_IDS.gas);
  nearlyEqual(
    resolveThermalStateFromTable(table, waterId, liquidEnergy).temperatureK,
    equilibriumFromSpecificEnergy(materialProperties.h2o, liquidEnergy).temperatureK,
    1e-3
  );
  nearlyEqual(
    resolveThermalStateFromTable(table, ironId, ironEnergy).temperatureK,
    equilibriumFromSpecificEnergy(materialProperties.fe, ironEnergy).temperatureK,
    1e-6
  );
});

test('SPH thermal material table carries non-authoritative material-bank warm inputs', () => {
  const warmInputTable = {
    schema: 'peercompute.ulg.material-property-bank.gpu-warm-input-table.v0',
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
  };
  const table = buildSphThermalMaterialTable(materialProperties, {
    materialPropertyBankGpuWarmInputTable: warmInputTable
  });
  const iron = table.metadata.find((entry) => entry.material === 'fe');
  const water = table.metadata.find((entry) => entry.material === 'h2o');

  assert.equal(
    table.materialPropertyBankWarmInputConsumer.schema,
    ULG_SPH_THERMAL_MATERIAL_BANK_WARM_INPUT_CONSUMER_SCHEMA
  );
  assert.equal(
    table.materialPropertyBankWarmInputConsumer.status,
    'thermal-material-table-annotated-with-material-bank-warm-inputs'
  );
  assert.equal(table.materialPropertyBankWarmInputConsumer.sourceRowCount, 1);
  assert.equal(table.materialPropertyBankWarmInputConsumer.matchedMaterialCount, 1);
  assert.equal(table.materialPropertyBankWarmInputConsumer.strictSourceOfTruth, false);
  assert.equal(table.materialPropertyBankWarmInputConsumer.shaderBound, false);
  assert.equal(table.materialPropertyBankWarmInputRowCount, 1);
  assert.equal(table.materialPropertyBankWarmInputMatchedMaterialCount, 1);
  assert.equal(iron.materialPropertyBankWarmInput.material, 'Fe');
  assert.equal(iron.materialPropertyBankWarmInputStatus, 'material-bank-warm-input-attached');
  assert.equal(water.materialPropertyBankWarmInput, null);
  assert.equal(water.materialPropertyBankWarmInputStatus, 'no-material-bank-warm-input');
});

test('SPH thermal graph buffer set exports flat energy-temperature segment closures', () => {
  const table = buildSphThermalMaterialTable(materialProperties);
  const graphSet = buildSphThermalClosureGraphBuffers(table);
  const responseTable = buildSphThermalPhaseResponseTable(table, graphSet);
  const materials = new Set(graphSet.metadata.map((entry) => entry.material));

  assert.equal(graphSet.schema, ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA);
  assert.equal(graphSet.status, 'thermal-segment-closure-law-graphs-ready');
  assert.equal(graphSet.sourceSchema, ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA);
  assert.equal(graphSet.graphSchema, ULG_CLOSURE_LAW_GRAPH_SCHEMA);
  assert.equal(graphSet.graphBank.schema, ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA);
  assert.equal(graphSet.graphBank.graphCount, graphSet.graphCount);
  assert.equal(graphSet.graphBank.nodeCount, graphSet.graphCount);
  assert.ok(graphSet.graphBank.sampleCount >= graphSet.graphCount * 2);
  assert.equal(graphSet.segmentCount, table.segmentCount);
  assert.equal(graphSet.graphCount, table.segmentCount);
  assert.equal(graphSet.skippedSegmentCount, 0);
  assert.equal(graphSet.scientificValidation, false);
  assert.equal(graphSet.phaseChangeValidation, false);
  assert.ok(materials.has('h2o'));
  assert.ok(materials.has('fe'));
  assert.ok(materials.has('air'));
  assert.ok(graphSet.metadata.some((entry) => entry.sourceSegmentDebyeTemperatureK && entry.graphSampleCount > 2));
  assert.equal(responseTable.schema, ULG_SPH_GPU_THERMAL_PHASE_RESPONSE_TABLE_SCHEMA);
  assert.equal(responseTable.status, 'closure-derived-phase-response-table-ready');
  assert.equal(responseTable.responseCount, table.segmentCount);
  assert.equal(responseTable.graphBankSchema, ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA);

  for (const metadata of graphSet.metadata) {
    const graph = graphSet.graphs[metadata.graphIndex];
    const segmentSampleFraction = metadata.segmentType === 'plateau' ? 0.75 : 0.5;
    const midpointEnergy = new Float32Array([
      metadata.energyStartJPerKg + segmentSampleFraction * (metadata.energyEndJPerKg - metadata.energyStartJPerKg)
    ])[0];
    const execution = evaluateClosureLawGraphCpu(graph, { inputs: { 0: midpointEnergy } });
    const resolved = resolveThermalStateFromTable(table, metadata.materialId, midpointEnergy);

    assert.equal(graph.schema, ULG_CLOSURE_LAW_GRAPH_SCHEMA);
    assert.equal(graph.sourceSegmentIndex, metadata.segmentIndex);
    assert.equal(graph.sourcePhaseFromId, metadata.phaseFromId);
    assert.equal(graph.nodeRows[13], metadata.materialId);
    assert.equal(graph.nodeRows[14], metadata.phaseFromId);
    assert.equal(execution.status, 'closure-law-graph-evaluated');
    assert.equal(graph.outputName, 'temperatureK');
    assert.equal(graph.outputSlots.temperatureK, SPH_THERMAL_CLOSURE_GRAPH_SLOTS.temperatureK);
    assert.equal(graph.slotCount, Object.keys(SPH_THERMAL_CLOSURE_GRAPH_SLOTS).length);
    const graphTolerance = metadata.sourceSegmentDebyeTemperatureK
      ? 1.5
      : Math.max(5e-2, Math.abs(resolved.temperatureK) * 1e-7);
    nearlyEqual(
      execution.slots[SPH_THERMAL_CLOSURE_GRAPH_SLOTS.temperatureK].value,
      resolved.temperatureK,
      graphTolerance
    );

    const response = resolveThermalPhaseResponseFromTable(responseTable, metadata.materialId, midpointEnergy);
    const graphResponse = resolveThermalStateFromGraphPhaseResponseCpu({
      graphSet,
      responseTable,
      materialId: metadata.materialId,
      specificInternalEnergyJPerKg: midpointEnergy
    });
    assert.equal(response.temperatureGraphIndex, metadata.graphIndex);
    assert.equal(response.phaseId, resolved.phaseId);
    assert.equal(graphResponse.phaseId, resolved.phaseId);
    nearlyEqual(graphResponse.temperatureK, resolved.temperatureK, graphTolerance);
    nearlyEqual(graphResponse.restDensityKgPerM3, resolved.restDensityKgPerM3, Math.max(1e-4, Math.abs(resolved.restDensityKgPerM3) * 1e-6));
    nearlyEqual(graphResponse.phaseFractions.solid, resolved.phaseFractions.solid, 1e-6);
    nearlyEqual(graphResponse.phaseFractions.liquid, resolved.phaseFractions.liquid, 1e-6);
    nearlyEqual(graphResponse.phaseFractions.gas, resolved.phaseFractions.gas, 1e-6);
    nearlyEqual(graphResponse.phaseFractions.plasma, resolved.phaseFractions.plasma, 1e-6);
  }
});

test('SPH thermal phase response table preserves plateau, edge, and clamp semantics', () => {
  const table = buildSphThermalMaterialTable(materialProperties);
  const graphSet = buildSphThermalClosureGraphBuffers(table);
  const responseTable = buildSphThermalPhaseResponseTable(table, graphSet);
  const waterId = stableOpticalMaterialId('h2o');
  const waterRecordOffset = Array.from(table.records).findIndex((value, index) => index % 4 === 0 && value === waterId);
  const segmentOffset = table.records[waterRecordOffset + 1];
  const segmentCount = table.records[waterRecordOffset + 2];
  const firstSegmentOffset = segmentOffset * 12;
  const lastSegmentOffset = (segmentOffset + segmentCount - 1) * 12;
  const lowClampEnergy = table.segments[firstSegmentOffset + 4] - 1;
  const highClampEnergy = table.segments[lastSegmentOffset + 5] + Math.max(1, Math.abs(table.segments[lastSegmentOffset + 5]) * 1e-3);
  let meltPlateauMid = null;

  for (let local = 0; local < segmentCount; local += 1) {
    const offset = (segmentOffset + local) * 12;
    const response = resolveThermalPhaseResponseFromTable(responseTable, waterId, table.segments[offset + 4]);
    assert.equal(response.status, 1);
    assert.notEqual(response.temperatureGraphIndex, -1);
    if (table.segments[offset + 1] === 2 && meltPlateauMid == null) {
      meltPlateauMid = table.segments[offset + 4] + 0.5 * (table.segments[offset + 5] - table.segments[offset + 4]);
    }
  }

  const belowIce = resolveThermalStateFromGraphPhaseResponseCpu({
    graphSet,
    responseTable,
    materialId: waterId,
    specificInternalEnergyJPerKg: lowClampEnergy
  });
  const highSteam = resolveThermalStateFromGraphPhaseResponseCpu({
    graphSet,
    responseTable,
    materialId: waterId,
    specificInternalEnergyJPerKg: highClampEnergy
  });
  const plateau = resolveThermalStateFromGraphPhaseResponseCpu({
    graphSet,
    responseTable,
    materialId: waterId,
    specificInternalEnergyJPerKg: meltPlateauMid
  });

  assert.equal(belowIce.response.domainStatus, 'clamped-low');
  assert.equal(belowIce.phaseId, GPU_PHASE_IDS.solid);
  assert.equal(highSteam.response.domainStatus, 'clamped-high');
  assert.equal(highSteam.phaseId, GPU_PHASE_IDS.gas);
  assert.equal(plateau.phaseId, GPU_PHASE_IDS.liquid);
  nearlyEqual(plateau.phaseFractions.solid, 0.5, 1e-5);
  nearlyEqual(plateau.phaseFractions.liquid, 0.5, 1e-5);
});

test('SPH thermal response graph upload persists phase-response and graph buffers', () => {
  const table = buildSphThermalMaterialTable(materialProperties);
  const graphSet = buildSphThermalClosureGraphBuffers(table);
  const responseTable = buildSphThermalPhaseResponseTable(table, graphSet);
  const writes = [];
  const destroyed = [];
  const device = {
    createBuffer({ label, size, usage }) {
      return {
        label,
        size,
        usage,
        destroy() {
          destroyed.push(label);
        }
      };
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ label: buffer.label, offset, byteLength: data.byteLength, usage: buffer.usage });
      }
    }
  };

  const upload = uploadSphThermalResponseGraphBuffers(device, {
    thermalMaterialTable: table,
    thermalClosureGraphSet: graphSet,
    thermalClosureGraphBank: graphSet.graphBank,
    thermalPhaseResponseTable: responseTable
  });

  assert.equal(upload.schema, ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA);
  assert.equal(upload.status, 'webgpu-uploaded');
  assert.equal(upload.responseCount, responseTable.responseCount);
  assert.equal(upload.graphCount, graphSet.graphBank.graphCount);
  assert.equal(upload.responseRecordBufferByteLength, responseTable.records.byteLength);
  assert.equal(upload.responseBufferByteLength, responseTable.responses.byteLength);
  assert.equal(upload.graphNodeBufferByteLength, graphSet.graphBank.nodeRows.byteLength);
  assert.equal(upload.graphSampleBufferByteLength, graphSet.graphBank.sampleRows.byteLength);
  assert.deepEqual(writes.map((write) => write.label), [
    'ulg-sph-thermal-phase-response-records',
    'ulg-sph-thermal-phase-responses',
    'ulg-sph-thermal-graph-nodes',
    'ulg-sph-thermal-graph-samples'
  ]);
  assert.deepEqual(writes.map((write) => write.byteLength), [
    responseTable.records.byteLength,
    responseTable.responses.byteLength,
    graphSet.graphBank.nodeRows.byteLength,
    graphSet.graphBank.sampleRows.byteLength
  ]);

  destroySphThermalResponseGraphBuffers(upload);
  assert.deepEqual(destroyed, [
    'ulg-sph-thermal-phase-response-records',
    'ulg-sph-thermal-phase-responses',
    'ulg-sph-thermal-graph-nodes',
    'ulg-sph-thermal-graph-samples'
  ]);
});

test('SPH thermal CPU table step conserves pair conduction energy and refreshes thermo rows', () => {
  const packed = packedTwoWaterParticles();
  packed.thermo[11] = 0.0375;
  packed.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS + 11] = 0.04125;
  const table = buildSphThermalMaterialTable(materialProperties);
  const before = totalInternalEnergyJ(packed);
  const beforeTempGap = Math.abs(packed.thermo[2] - packed.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS + 2]);
  const result = runSphThermalStepCpu({
    sphParticleState: packed,
    thermalMaterialTable: table,
    wallTemperaturesK: {},
    boxDimsM: [5, 5, 5],
    dtS: 1e-4,
    conductionRate: 1.5e4,
    wallRate: 0
  });
  const after = totalInternalEnergyJ({ ...packed, state: result.state });
  const afterTempGap = Math.abs(result.thermo[2] - result.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS + 2]);

  assert.equal(result.schema, ULG_SPH_GPU_THERMAL_STEP_SCHEMA);
  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.phaseChangeValidation, false);
  assert.ok(afterTempGap < beforeTempGap);
  nearlyEqual(after, before, 1e-4);
  assert.equal(result.thermo[1], GPU_PHASE_IDS.liquid);
  assert.equal(result.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS + 1], GPU_PHASE_IDS.solid);
  nearlyEqual(result.thermo[11], 0.0375, 1e-8);
  nearlyEqual(result.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS + 11], 0.04125, 1e-8);
});

test('SPH thermal WGSL preserves visual particle radius while refreshing thermo rows', () => {
  assert.match(sphThermalStepWgsl, /vec4<f32>\(source_row2\.x,\s*source_row2\.y,\s*255\.0,\s*source_row2\.w\)/);
  assert.match(sphThermalStepWgsl, /vec4<f32>\(source_row2\.x,\s*source_row2\.y,\s*1\.0,\s*source_row2\.w\)/);
});

test('SPH thermal WGSL prepares closure properties once per particle before pair scans', () => {
  assert.match(sphThermalStepWgsl, /@binding\(9\).*thermal_particle_properties/);
  assert.match(sphThermalStepWgsl, /fn prepare_particle_thermal_properties/);
  assert.match(sphThermalStepWgsl, /thermal_temperature_slope\(row0\.x, vel_u\.w\)/);
  assert.match(sphThermalStepWgsl, /thermal_emissivity\(row0\.x\)/);
  assert.match(sphThermalStepWgsl, /particle_nominal_radius_m\(pos_mass\.w, row0\.w\)/);
  const pairPass = sphThermalStepWgsl.slice(sphThermalStepWgsl.indexOf('fn main('));
  assert.doesNotMatch(pairPass, /thermal_temperature_slope\(/);
  assert.doesNotMatch(pairPass, /thermal_emissivity\(/);
  assert.doesNotMatch(pairPass, /particle_nominal_radius_m\(/);
  assert.equal(
    pairPass.match(/other_nominal_radius_m = other_thermal_properties\.z/g)?.length,
    3
  );
  assert.doesNotMatch(sphThermalStepWgsl, /material_bank_warm_input_anchor/);
  assert.doesNotMatch(sphThermalStepWgsl, /material_bank_warm_input_rows/);
});

test('SPH thermal CPU pair conduction does not overshoot pair equilibrium', () => {
  const packed = packedTwoWaterParticles(320, 300);
  const table = buildSphThermalMaterialTable(materialProperties);
  const result = runSphThermalStepCpu({
    sphParticleState: packed,
    thermalMaterialTable: table,
    wallTemperaturesK: {},
    boxDimsM: [5, 5, 5],
    dtS: 1e-3,
    conductionRate: 1e12,
    wallRate: 0
  });
  const hotAfter = result.thermo[2];
  const coldAfter = result.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS + 2];

  assert.ok(hotAfter <= 320);
  assert.ok(hotAfter >= 300);
  assert.ok(coldAfter <= 320);
  assert.ok(coldAfter >= 300);
  assert.ok(Math.abs(hotAfter - coldAfter) < 20);
});

test('SPH thermal CPU table step applies wall heat from six explicit wall reservoirs', () => {
  const packed = packedTwoWaterParticles(350, 350);
  const table = buildSphThermalMaterialTable(materialProperties);
  packed.state[0] = 0.02;
  packed.state[SPH_GPU_PARTICLE_STATE_FLOATS] = 4.98;
  const result = runSphThermalStepCpu({
    sphParticleState: packed,
    thermalMaterialTable: table,
    wallTemperaturesK: { xMin: 233.15, xMax: 500, yMin: 350, yMax: 350, zMin: 350, zMax: 350 },
    boxDimsM: [5, 5, 5],
    dtS: 1e-4,
    conductionRate: 0,
    wallRate: 6e4,
    wallLayerM: 0.1
  });

  assert.ok(result.wallHeatJ.xMin < 0);
  assert.ok(result.wallHeatJ.xMax > 0);
  assert.ok(result.state[7] < packed.state[7]);
  assert.ok(result.state[SPH_GPU_PARTICLE_STATE_FLOATS + 7] > packed.state[SPH_GPU_PARTICLE_STATE_FLOATS + 7]);
});

test('SPH thermal CPU wall reservoir does not overshoot wall temperature in one explicit step', () => {
  const packed = packedTwoWaterParticles(330, 330);
  const table = buildSphThermalMaterialTable(materialProperties);
  packed.state[0] = 0.02;
  packed.state[SPH_GPU_PARTICLE_STATE_FLOATS] = 2.5;
  const result = runSphThermalStepCpu({
    sphParticleState: packed,
    thermalMaterialTable: table,
    wallTemperaturesK: { xMin: 293.15 },
    boxDimsM: [5, 5, 5],
    dtS: 1e-4,
    conductionRate: 0,
    wallRate: 1e10,
    wallLayerM: 0.1
  });

  nearlyEqual(result.thermo[2], 293.15, 2e-3);
  assert.equal(result.thermo[1], GPU_PHASE_IDS.liquid);
});

test('SPH thermal optional WebGPU accepts parity-passing thermal runner', async () => {
  const packed = packedTwoWaterParticles();
  const table = buildSphThermalMaterialTable(materialProperties);
  const execution = await runSphThermalStepWithOptionalWebGpu({
    sphParticleState: packed,
    thermalMaterialTable: table,
    wallTemperaturesK: {},
    boxDimsM: [5, 5, 5],
    dtS: 1e-4,
    wallRate: 0,
    preferWebGpu: true,
    device: {},
    webGpuRunner(args) {
      const result = runSphThermalStepCpu(args);
      return { ...result, backend: 'webgpu' };
    }
  });

  assert.equal(execution.schema, ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.status, 'webgpu-accepted');
  assert.equal(execution.webgpuParity.status, 'pass');
  assert.equal(execution.result.backend, 'webgpu');
  assert.equal(execution.phaseChangeValidation, false);
});

test('SPH thermal optional WebGPU accepts no-full retained output without CPU parity', async () => {
  const packed = packedTwoWaterParticles();
  const table = buildSphThermalMaterialTable(materialProperties);
  const execution = await runSphThermalStepWithOptionalWebGpu({
    sphParticleState: packed,
    thermalMaterialTable: table,
    wallTemperaturesK: {},
    boxDimsM: [5, 5, 5],
    dtS: 1e-4,
    wallRate: 0,
    preferWebGpu: true,
    device: {},
    readbackMode: 'no-full-readback',
    webGpuRunner(args) {
      assert.equal(args.readbackMode, 'no-full-readback');
      return {
        ...runSphThermalStepCpu(args),
        backend: 'webgpu',
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: { label: 'thermal-state-retained' },
        thermoBuffer: { label: 'thermal-thermo-retained' },
        retainedOutputParticleBuffers: true,
        fullReadbackPerformed: false,
        normalHotLoopReadbackFree: true,
        readbackMode: 'no-full-readback'
      };
    }
  });

  assert.equal(execution.schema, ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.status, 'webgpu-accepted-no-full-readback');
  assert.equal(execution.cpuReference, null);
  assert.equal(execution.webgpuParity.status, 'not-run-no-full-readback');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed-no-full-readback');
  assert.equal(execution.result.stateBuffer.label, 'thermal-state-retained');
  assert.equal(execution.result.thermoBuffer.label, 'thermal-thermo-retained');
  assert.equal(execution.result.normalHotLoopReadbackFree, true);
});

test('SPH thermal WebGPU defers retained output buffer destruction until submitted work completes', async () => {
  const packed = packedTwoWaterParticles();
  const table = buildSphThermalMaterialTable(materialProperties, {
    materialPropertyBankGpuWarmInputTable: {
      schema: 'peercompute.ulg.material-property-bank.gpu-warm-input-table.v0',
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
  const graphSet = buildSphThermalClosureGraphBuffers(table);
  const responseTable = buildSphThermalPhaseResponseTable(table, graphSet);
  const device = fakeThermalDeviceWithFence();
  const sourceStateBuffer = { label: 'source-state' };
  const sourceThermoBuffer = { label: 'source-thermo' };
  const thermalResponseGraphUpload = {
    schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    responseRecordBuffer: { label: 'response-records' },
    responseBuffer: { label: 'responses' },
    graphNodeBuffer: { label: 'graph-nodes' },
    graphSampleBuffer: { label: 'graph-samples' },
    responseBufferByteLength: responseTable.responses.byteLength,
    graphSampleBufferByteLength: graphSet.graphBank.sampleRows.byteLength
  };

  const result = await runSphThermalStepWebGpu({
    device,
    sphParticleState: packed,
    thermalMaterialTable: table,
    thermalClosureGraphSet: graphSet,
    thermalClosureGraphBank: graphSet.graphBank,
    thermalPhaseResponseTable: responseTable,
    thermalResponseGraphUpload,
    sphParticleUpload: {
      stateBuffer: sourceStateBuffer,
      thermoBuffer: sourceThermoBuffer,
      materialPropertyBankWarmInputBuffer: { label: 'material-bank-warm-inputs' },
      materialPropertyBankWarmInputRowCount: 1
    },
    retainOutputParticleBuffers: true,
    readbackMode: 'no-full-readback'
  });

  assert.equal(result.retainedOutputParticleBuffers, true);
  assert.equal(result.outputBufferInitializationMode, 'shader-writes-all-particle-rows');
  assert.equal(
    result.materialPropertyBankWarmInputConsumer.schema,
    ULG_SPH_THERMAL_MATERIAL_BANK_WARM_INPUT_CONSUMER_SCHEMA
  );
  assert.equal(
    result.materialPropertyBankWarmInputConsumer.status,
    'thermal-material-table-annotated-with-material-bank-warm-inputs'
  );
  assert.equal(result.materialPropertyBankWarmInputConsumer.shaderBound, false);
  assert.equal(result.materialPropertyBankWarmInputConsumer.shaderBinding, null);
  assert.equal(result.materialPropertyBankWarmInputConsumer.shaderRowCount, 0);
  assert.equal(result.materialPropertyBankWarmInputConsumer.bufferSource, null);
  assert.equal(result.materialPropertyBankWarmInputRowCount, 1);
  assert.equal(result.materialPropertyBankWarmInputMatchedMaterialCount, 1);
  assert.ok(device.bindGroups.at(-1).entries.some((entry) => (
    entry.binding === 9 && entry.resource.buffer.label === 'ulg-sph-thermal-particle-properties'
  )));
  assert.equal(
    device.bindGroups.at(-1).layout.entries.filter((entry) => (
      entry.buffer.type === 'storage' || entry.buffer.type === 'read-only-storage'
    )).length,
    10
  );
  assert.equal(
    device.bindGroups.at(-1).layout.entries.find((entry) => entry.binding === 8)?.buffer.type,
    'uniform'
  );
  assert.equal(result.thermalParticlePropertiesBufferByteLength, 32);
  assert.equal(
    result.thermalParticlePropertiesInitializationMode,
    'gpu-prepass-writes-all-live-particle-rows'
  );
  assert.equal(result.thermalParticlePropertiesHostUploadByteLength, 0);
  assert.equal(result.thermalPropertyPrepassDispatchCount, 1);
  assert.equal(
    result.thermalPairPassMaterialGraphLookupMode,
    'gpu-precomputed-per-particle-properties'
  );
  assert.deepEqual(device.dispatches.map((dispatch) => dispatch.entryPoint), [
    'prepare_particle_thermal_properties',
    'main'
  ]);
  assert.equal(device.queueWrites.some((write) => write.label === 'ulg-sph-thermal-output-state'), false);
  assert.equal(device.queueWrites.some((write) => write.label === 'ulg-sph-thermal-output-thermo'), false);
  assert.equal(device.queueWrites.some((write) => write.label === 'ulg-sph-thermal-particle-properties'), false);
  assert.equal(device.queueWrites.some((write) => write.label === 'material-bank-warm-inputs'), false);
  assert.equal(typeof result.destroyOutputParticleBuffers, 'function');
  result.destroyOutputParticleBuffers();
  result.destroyOutputParticleBuffers();
  assert.equal(device.destroyed.includes('ulg-sph-thermal-output-state'), false);
  assert.equal(device.destroyed.includes('ulg-sph-thermal-output-thermo'), false);

  device.resolveFence();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(device.destroyed.filter((label) => label === 'ulg-sph-thermal-output-state').length, 1);
  assert.equal(device.destroyed.filter((label) => label === 'ulg-sph-thermal-output-thermo').length, 1);
  assert.equal(device.destroyed.filter((label) => label === 'ulg-sph-thermal-particle-properties').length, 1);
  assert.equal(device.fenceRequestedCount, 2);
});

test('SPH thermal WebGPU omits zero-valued material-bank shadow binding', async () => {
  const packed = packedTwoWaterParticles();
  const table = buildSphThermalMaterialTable(materialProperties);
  const graphSet = buildSphThermalClosureGraphBuffers(table);
  const responseTable = buildSphThermalPhaseResponseTable(table, graphSet);
  const device = fakeThermalDeviceWithFence();
  const thermalResponseGraphUpload = {
    schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    responseRecordBuffer: { label: 'response-records' },
    responseBuffer: { label: 'responses' },
    graphNodeBuffer: { label: 'graph-nodes' },
    graphSampleBuffer: { label: 'graph-samples' },
    responseBufferByteLength: responseTable.responses.byteLength,
    graphSampleBufferByteLength: graphSet.graphBank.sampleRows.byteLength
  };

  const result = await runSphThermalStepWebGpu({
    device,
    sphParticleState: packed,
    thermalMaterialTable: table,
    thermalClosureGraphSet: graphSet,
    thermalClosureGraphBank: graphSet.graphBank,
    thermalPhaseResponseTable: responseTable,
    thermalResponseGraphUpload,
    sphParticleUpload: {
      stateBuffer: { label: 'source-state' },
      thermoBuffer: { label: 'source-thermo' }
    },
    retainOutputParticleBuffers: true,
    readbackMode: 'no-full-readback'
  });

  assert.equal(
    device.queueWrites.some((write) => write.label.includes('material-bank-warm-input')),
    false
  );
  assert.ok(device.bindGroups.at(-1).entries.some((entry) => (
    entry.binding === 9 && entry.resource.buffer.label === 'ulg-sph-thermal-particle-properties'
  )));
  assert.equal(result.materialPropertyBankWarmInputConsumer.shaderRowCount, 0);
  assert.equal(result.materialPropertyBankWarmInputConsumer.shaderBound, false);
  assert.equal(result.thermalParticlePropertiesHostUploadByteLength, 0);
  result.destroyOutputParticleBuffers();
  device.resolveFence();
  await Promise.resolve();
  await Promise.resolve();
});

test('SPH thermal encoder stages reuse aligned params slots and cached bind groups', () => {
  const packed = packedTwoWaterParticles();
  const table = buildSphThermalMaterialTable(materialProperties);
  const graphSet = buildSphThermalClosureGraphBuffers(table);
  const responseTable = buildSphThermalPhaseResponseTable(table, graphSet);
  const device = fakeThermalDeviceWithFence();
  const thermalResponseGraphUpload = {
    schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    responseRecordBuffer: { label: 'response-records' },
    responseBuffer: { label: 'responses' },
    graphNodeBuffer: { label: 'graph-nodes' },
    graphSampleBuffer: { label: 'graph-samples' },
    responseBufferByteLength: responseTable.responses.byteLength,
    graphSampleBufferByteLength: graphSet.graphBank.sampleRows.byteLength
  };
  const workspace = createSphThermalWorkspaceGpu({
    device,
    particleCapacity: packed.particleCount,
    sequenceStepCapacity: 2,
    label: 'shared-thermal'
  });
  const outputStateBuffer = device.createBuffer({
    label: 'shared-thermal-output-state',
    size: packed.state.byteLength,
    usage: 128
  });
  const outputThermoBuffer = device.createBuffer({
    label: 'shared-thermal-output-thermo',
    size: packed.thermo.byteLength,
    usage: 128
  });
  const neighborBinsBuffer = device.createBuffer({
    label: 'shared-thermal-neighbor-bins',
    size: 64,
    usage: 128
  });
  const stageOptions = {
    device,
    sphParticleState: packed,
    thermalMaterialTable: table,
    thermalClosureGraphSet: graphSet,
    thermalClosureGraphBank: graphSet.graphBank,
    thermalPhaseResponseTable: responseTable,
    thermalResponseGraphUpload,
    sourceStateBuffer: { label: 'source-state' },
    sourceThermoBuffer: { label: 'source-thermo' },
    outputStateBuffer,
    outputThermoBuffer,
    neighborBins: {
      binsBuffer: neighborBinsBuffer,
      capacity: 2,
      nx: 1,
      ny: 1,
      nz: 1,
      cellSizeM: 0.2
    },
    thermalWorkspace: workspace,
    retainOutputParticleBuffers: true,
    readbackMode: 'no-full-readback'
  };

  const first = createSphThermalStepWebGpuEncoderStage({
    ...stageOptions,
    thermalParamsSlotIndex: 0
  });
  const second = createSphThermalStepWebGpuEncoderStage({
    ...stageOptions,
    thermalParamsSlotIndex: 1
  });
  const third = createSphThermalStepWebGpuEncoderStage({
    ...stageOptions,
    thermalParamsSlotIndex: 1
  });
  const thermalBindGroups = device.bindGroups.slice(-2);

  assert.equal(first.thermalWorkspace, workspace);
  assert.equal(second.thermalWorkspace, workspace);
  assert.equal(third.thermalWorkspace, workspace);
  assert.equal(first.thermalWorkspaceBorrowed, true);
  assert.equal(second.thermalWorkspaceBorrowed, true);
  assert.equal(first.result.thermalWorkspaceOwned, false);
  assert.equal(first.result.thermalWorkspaceBorrowed, true);
  assert.equal(first.result.thermalParamsSlotIndex, 0);
  assert.equal(second.result.thermalParamsSlotIndex, 1);
  assert.equal(first.result.thermalParamsByteOffset, 0);
  assert.equal(second.result.thermalParamsByteOffset, workspace.paramsSlotStrideBytes);
  assert.equal(first.thermalBindGroupCacheHit, false);
  assert.equal(second.thermalBindGroupCacheHit, false);
  assert.equal(third.thermalBindGroupCacheHit, true);
  assert.equal(device.buffers.filter((buffer) => buffer.label === 'shared-thermal-particle-properties').length, 1);
  assert.equal(device.buffers.filter((buffer) => buffer.label === 'shared-thermal-params-arena').length, 1);
  assert.equal(device.buffers.filter((buffer) => buffer.label === 'ulg-sph-thermal-params').length, 0);
  assert.equal(device.bindGroups.length, 2);
  assert.ok(thermalBindGroups.every((bindGroup) => (
    bindGroup.entries.find((entry) => entry.binding === 9)?.resource?.buffer
      === workspace.propertyBuffer
  )));
  assert.equal(device.queueWrites.some(
    (write) => write.label === 'shared-thermal-particle-properties'
  ), false);
  assert.deepEqual(
    device.queueWrites
      .filter((write) => write.label === 'shared-thermal-params-arena')
      .map((write) => write.offset),
    [0, workspace.paramsSlotStrideBytes, workspace.paramsSlotStrideBytes]
  );
  assert.deepEqual(
    thermalBindGroups.map((bindGroup) => (
      bindGroup.entries.find((entry) => entry.binding === 8)?.resource?.offset
    )),
    [0, workspace.paramsSlotStrideBytes]
  );
  assert.deepEqual(workspace.bindGroupCacheEvidence(), {
    slotCapacity: 2,
    populatedSlotCount: 2,
    hitCount: 1,
    missCount: 2
  });

  first.cleanupSubmittedWork();
  second.cleanupSubmittedWork();
  third.cleanupSubmittedWork();
  assert.equal(workspace.destroyed, false);
  assert.equal(workspace.propertyBuffer.destroyed, false);
  workspace.destroy();
  assert.equal(workspace.propertyBuffer.destroyed, true);
});

test('SPH thermal encoder stage borrows caller-owned ping outputs without destroying them', () => {
  const packed = packedTwoWaterParticles();
  const table = buildSphThermalMaterialTable(materialProperties);
  const graphSet = buildSphThermalClosureGraphBuffers(table);
  const responseTable = buildSphThermalPhaseResponseTable(table, graphSet);
  const device = fakeThermalDeviceWithFence();
  const sourceStateBuffer = { label: 'thermal-ping-source-state' };
  const sourceThermoBuffer = { label: 'thermal-ping-source-thermo' };
  const outputStateBuffer = device.createBuffer({
    label: 'thermal-ping-output-state',
    size: packed.state.byteLength,
    usage: 128
  });
  const outputThermoBuffer = device.createBuffer({
    label: 'thermal-ping-output-thermo',
    size: packed.thermo.byteLength,
    usage: 128
  });
  const thermalResponseGraphUpload = {
    schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    responseRecordBuffer: { label: 'response-records' },
    responseBuffer: { label: 'responses' },
    graphNodeBuffer: { label: 'graph-nodes' },
    graphSampleBuffer: { label: 'graph-samples' },
    responseBufferByteLength: responseTable.responses.byteLength,
    graphSampleBufferByteLength: graphSet.graphBank.sampleRows.byteLength
  };

  const stage = createSphThermalStepWebGpuEncoderStage({
    device,
    sphParticleState: packed,
    thermalMaterialTable: table,
    thermalClosureGraphSet: graphSet,
    thermalClosureGraphBank: graphSet.graphBank,
    thermalPhaseResponseTable: responseTable,
    thermalResponseGraphUpload,
    sourceStateBuffer,
    sourceThermoBuffer,
    outputStateBuffer,
    outputThermoBuffer,
    retainOutputParticleBuffers: true,
    readbackMode: 'no-full-readback'
  });

  assert.equal(stage.stateBuffer, outputStateBuffer);
  assert.equal(stage.thermoBuffer, outputThermoBuffer);
  assert.equal(stage.outputStateBufferOwned, false);
  assert.equal(stage.outputThermoBufferOwned, false);
  assert.equal(stage.result.outputParticleBuffersBorrowed, true);
  const bindGroup = device.bindGroups.at(-1);
  assert.equal(bindGroup.entries.find((entry) => entry.binding === 6).resource.buffer, outputStateBuffer);
  assert.equal(bindGroup.entries.find((entry) => entry.binding === 7).resource.buffer, outputThermoBuffer);

  stage.cleanupSubmittedWork();
  stage.result.destroyOutputParticleBuffers();
  assert.equal(outputStateBuffer.destroyed, false);
  assert.equal(outputThermoBuffer.destroyed, false);

  assert.throws(
    () => createSphThermalStepWebGpuEncoderStage({
      device,
      sphParticleState: packed,
      thermalMaterialTable: table,
      thermalClosureGraphSet: graphSet,
      thermalClosureGraphBank: graphSet.graphBank,
      thermalPhaseResponseTable: responseTable,
      thermalResponseGraphUpload,
      sourceStateBuffer,
      sourceThermoBuffer,
      outputStateBuffer: sourceStateBuffer,
      outputThermoBuffer
    }),
    /distinct from every source/
  );
});

test('SPH thermal parity rejects state or thermo drift', () => {
  const packed = packedTwoWaterParticles();
  const table = buildSphThermalMaterialTable(materialProperties);
  const cpu = runSphThermalStepCpu({
    sphParticleState: packed,
    thermalMaterialTable: table,
    wallTemperaturesK: {},
    boxDimsM: [5, 5, 5],
    dtS: 1e-4,
    wallRate: 0
  });
  const drifted = {
    ...cpu,
    backend: 'webgpu',
    state: new Float32Array(cpu.state),
    thermo: new Float32Array(cpu.thermo)
  };
  drifted.state[7] += 10;
  drifted.thermo[2] += 1;

  const parity = compareSphThermalStepParity(cpu, drifted, { tolerance: 1e-4 });
  assert.equal(parity.schema, 'peercompute.ulg.sph-gpu-thermal-step-parity.v0');
  assert.equal(parity.status, 'fail');
  assert.ok(parity.maxStateAbs > 1);
  assert.ok(parity.maxThermoAbs > 0.5);
  assert.equal(parity.phaseChangeValidation, false);
});


// Radiative cooling invariant: an isolated hot particle in a large box must
// follow the analytic Stefan-Boltzmann curve dT/dt = -eps*sigma*A*(T^4-Tamb^4)
// / (m*du/dT). The reference integrates the same law with the lane's own
// temperature map, so agreement verifies the kernel's radiation term (area,
// emissivity, clamps) rather than a copied implementation.
test('SPH thermal isolated hot particle cools along the Stefan-Boltzmann curve', () => {
  const massKg = 0.001;
  const startK = 1200;
  const ambientK = 293;
  const state = createSphState({
    smoothingLengthM: 0.1,
    dimension: 3,
    particles: [{
      id: 'ember',
      material: 'fe',
      x: [10, 10, 10],
      v: [0, 0, 0],
      massKg,
      specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(materialProperties.fe, startK)
    }]
  });
  let packed = buildSphGpuParticleBuffers(state, { materialProperties });
  const table = buildSphThermalMaterialTable(materialProperties);
  const materialId = packed.thermo[0];
  const emissivity = thermalEmissivityFromTable(table, materialId);
  assert.ok(emissivity > 0.02 && emissivity < 0.5, `iron emissivity ${emissivity} should be conductor-class`);
  const restDensity = packed.thermo[3];
  const radiusM = Math.cbrt((3 * massKg) / (4 * Math.PI * restDensity));
  const areaM2 = 4 * Math.PI * radiusM * radiusM;
  // ~2 K/s at 1200 K for this ember (eps 0.065, r 3.1 mm): integrate 5 s of
  // sim time so the cooling is far above f32 state quantization.
  const dtS = 5e-3;
  const steps = 1000;
  // Reference: forward-Euler of the analytic law on specific energy, using
  // the same closure temperature map as the lane.
  let uRef = packed.state[7];
  for (let n = 0; n < steps; n += 1) {
    const tRef = resolveThermalStateFromTable(table, materialId, uRef).temperatureK;
    uRef += emissivity * SPH_THERMAL_STEFAN_BOLTZMANN_W_PER_M2_K4
      * (ambientK ** 4 - tRef ** 4) * areaM2 * dtS / massKg;
  }
  const referenceEndK = resolveThermalStateFromTable(table, materialId, uRef).temperatureK;
  for (let n = 0; n < steps; n += 1) {
    const result = runSphThermalStepCpu({
      sphParticleState: packed,
      thermalMaterialTable: table,
      wallTemperaturesK: {},
      boxDimsM: [20, 20, 20],
      dtS,
      wallRate: 0,
      ambientTemperatureK: ambientK
    });
    packed = { ...packed, state: result.state, thermo: result.thermo };
  }
  const laneEndK = packed.thermo[2];
  assert.ok(laneEndK < startK - 5, `particle should cool measurably, got ${laneEndK}`);
  assert.ok(laneEndK > ambientK, `cooling must not cross ambient, got ${laneEndK}`);
  const coolingRef = startK - referenceEndK;
  const coolingLane = startK - laneEndK;
  assert.ok(
    Math.abs(coolingLane - coolingRef) <= Math.max(2, 0.05 * coolingRef),
    `lane cooling ${coolingLane.toFixed(2)}K vs analytic ${coolingRef.toFixed(2)}K`
  );
  // Overshoot guard: the crossing clamp computes the equalizing du from the
  // LOCAL dT/du, so across a 900 K plunge the Debye cp curvature leaves a
  // bounded residual past ambient rather than an exact stop; a second step
  // clamps back. The guarantees under test: bounded near ambient (no runaway
  // past the relaxation target) and convergence onto ambient.
  let giantPacked = packed;
  for (let n = 0; n < 2; n += 1) {
    const giant = runSphThermalStepCpu({
      sphParticleState: giantPacked,
      thermalMaterialTable: table,
      wallTemperaturesK: {},
      boxDimsM: [20, 20, 20],
      dtS: 1e6,
      wallRate: 0,
      ambientTemperatureK: ambientK
    });
    giantPacked = { ...giantPacked, state: giant.state, thermo: giant.thermo };
    assert.ok(
      Math.abs(giantPacked.thermo[2] - ambientK) < 60,
      `giant step ${n} must land near ambient, got ${giantPacked.thermo[2]}`
    );
  }
  assert.ok(
    Math.abs(giantPacked.thermo[2] - ambientK) < 5,
    `after two giant steps temperature must converge onto ambient, got ${giantPacked.thermo[2]}`
  );
});
