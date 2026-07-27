import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ULG_CLOSURE_LAW_GRAPH_SCHEMA } from '../ulg-gpu-abi/src/index.js';
import { sphThermalStepWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import { evaluateClosureLawGraphCpu } from '../src/runtime/closureLawGraph.js';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { stableOpticalMaterialId, GPU_PHASE_IDS } from '../src/runtime/material/opticalGpuBuffers.js';
import { MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_ROW_LAYOUT } from '../src/runtime/material/materialPropertyBank.js';
import { equilibriumFromSpecificEnergy } from '../src/runtime/material/phaseEquilibrium.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';
import { createSphState } from '../src/runtime/sph/sphState.js';
import {
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS,
  buildSphGpuParticleBuffers
} from '../src/runtime/sph/sphGpuBuffers.js';
import {
  encodeMlsMpmParticleSeparationPasses
} from '../src/runtime/sph/sphG2pGpuKernel.js';
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
  createSphThermalStepWebGpuEncoderStage,
  destroySphThermalResponseGraphBuffers,
  resolveThermalCarrierEnergyDomainForTemperatureRangeFromTable,
  resolveThermalCarrierEnergyDomainFromTable,
  resolveThermalCarrierTemperatureSlopeFromTable,
  resolveThermalPhaseResponseFromTable,
  resolveThermalStateFromGraphPhaseResponseCpu,
  resolveThermalStateFromTable,
  SPH_THERMAL_STEFAN_BOLTZMANN_W_PER_M2_K4,
  thermalEmissivityFromTable,
  thermalResponseGraphUploadMatchesDevice,
  runSphThermalStepCpu,
  runSphThermalStepWebGpu,
  runSphThermalStepWithOptionalWebGpu,
  uploadSphThermalResponseGraphBuffers,
  resolveThermalMaxPairSupportM,
  SPH_THERMAL_PHASE_RESPONSE_FLOATS
} from '../src/runtime/sph/sphThermalGpuKernel.js';

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

function nextPositiveFloat32(value) {
  const scalar = new Float32Array([value]);
  const words = new Uint32Array(scalar.buffer);
  words[0] += 1;
  return scalar[0];
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
  const submissions = [];
  const encodedPassLabels = [];
  const device = {
    destroyed,
    buffers,
    bindGroups,
    queueWrites,
    submissions,
    encodedPassLabels,
    failMapAsync: false,
    fenceRequestedCount: 0,
    resolveFence,
    queue: {
      writeBuffer(buffer, offset, data) {
        queueWrites.push({ label: buffer?.label ?? null, offset, byteLength: data?.byteLength ?? 0 });
      },
      submit(commandBuffers) { submissions.push(commandBuffers); },
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
        },
        mapAsync() {
          return device.failMapAsync
            ? Promise.reject(new Error('injected thermal map failure'))
            : Promise.resolve();
        },
        getMappedRange() { return new ArrayBuffer(size); },
        unmap() {}
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule({ label, code }) {
      return { label, code };
    },
    createComputePipeline() {
      return {
        getBindGroupLayout(index) {
          return { index };
        }
      };
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
        clearBuffer() {},
        copyBufferToBuffer() {},
        beginComputePass(descriptor = {}) {
          encodedPassLabels.push(descriptor.label ?? null);
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
  return device;
}

function classicThermalStageArgs(device, {
  readbackMode = 'no-full-readback',
  retainOutputParticleBuffers = false
} = {}) {
  const sphParticleState = packedTwoWaterParticles();
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties);
  const thermalClosureGraphSet = buildSphThermalClosureGraphBuffers(
    thermalMaterialTable
  );
  const thermalPhaseResponseTable = buildSphThermalPhaseResponseTable(
    thermalMaterialTable,
    thermalClosureGraphSet
  );
  return {
    device,
    sphParticleState,
    thermalMaterialTable,
    thermalClosureGraphSet,
    thermalClosureGraphBank: thermalClosureGraphSet.graphBank,
    thermalPhaseResponseTable,
    sphParticleUpload: {
      stateBuffer: device.createBuffer({
        label: 'thermal-failure-fixture-source-state',
        size: sphParticleState.state.byteLength,
        usage: 128
      }),
      thermoBuffer: device.createBuffer({
        label: 'thermal-failure-fixture-source-thermo',
        size: sphParticleState.thermo.byteLength,
        usage: 128
      })
    },
    readbackMode,
    retainOutputParticleBuffers
  };
}

test('thermal records carry a pressure carrier law only where a plateau admits one', () => {
  const table = buildSphThermalMaterialTable(materialProperties);
  const stride = table.recordStrideFloats;
  assert.equal(stride, 8, 'v1 must repurpose the pads without changing stride');
  assert.deepEqual(table.recordLayout.slice(5), [
    'pressureCarrierLawId:f32',
    'referencePressurePa:f32',
    'clausiusInvTemperatureLogSlopePerK:f32'
  ]);

  const byMaterial = new Map(table.metadata.map((row) => [row.material, row]));

  // Water has exactly one liquid-to-gas plateau, so it is pressure-shiftable
  // and the slope must be the real beta = R/(L*M) for that plateau.
  const water = byMaterial.get('h2o');
  assert.equal(water.pressureCarrierLawId, 1);
  assert.equal(water.referencePressurePa, 101325);
  const waterSegments = table.segmentMetadata.filter((segment) => (
    segment.material === 'h2o' && segment.from === 'liquid' && segment.to === 'gas'
  ));
  assert.equal(waterSegments.length, 1);
  const latentHeatJPerKg = waterSegments[0].eEnd - waterSegments[0].eStart;
  const expectedSlope =
    8.314462618 / (latentHeatJPerKg * closures.h2o.properties.molarMassKgPerMol);
  nearlyEqual(
    water.clausiusInvTemperatureLogSlopePerK,
    expectedSlope,
    1e-12 * Math.max(1, expectedSlope)
  );
  // Sanity: a real vaporization latent heat, and a slope that moves the boil by
  // a physically sensible amount over a halving of pressure.
  assert.ok(latentHeatJPerKg > 1.5e6 && latentHeatJPerKg < 3.5e6, `${latentHeatJPerKg}`);
  const referenceTemperatureK = waterSegments[0].temperatureK;
  const halfAtmosphereK =
    1 / (1 / referenceTemperatureK - expectedSlope * Math.log(0.5));
  assert.ok(
    halfAtmosphereK < referenceTemperatureK - 5,
    `half an atmosphere must boil meaningfully lower, got ${halfAtmosphereK}`
  );

  // Air has no admitted liquid-to-gas plateau in this closure, so it must stay
  // on the identity law rather than be given a manufactured one.
  const air = byMaterial.get('air');
  assert.equal(air.pressureCarrierLawId, 0);
  assert.equal(air.referencePressurePa, 0);
  assert.equal(air.clausiusInvTemperatureLogSlopePerK, 0);

  // The response table must carry the same lanes through verbatim.
  const graphSet = buildSphThermalClosureGraphBuffers(table);
  const responseTable = buildSphThermalPhaseResponseTable(table, graphSet);
  assert.deepEqual(responseTable.recordLayout.slice(5), [
    'pressureCarrierLawId:f32',
    'referencePressurePa:f32',
    'clausiusInvTemperatureLogSlopePerK:f32'
  ]);
  // Compare against the packed f32 records rather than the f64 metadata: the
  // packed buffer is what the device reads, so exact carry-through has to hold
  // there.
  for (const record of responseTable.metadata) {
    const sourceIndex = table.metadata.findIndex(
      (row) => row.materialId === record.materialId
    );
    const base = sourceIndex * stride;
    assert.equal(record.pressureCarrierLawId, table.records[base + 5]);
    assert.equal(record.referencePressurePa, table.records[base + 6]);
    assert.equal(
      record.clausiusInvTemperatureLogSlopePerK,
      table.records[base + 7]
    );
  }
});

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

test('SPH thermal carrier slope resolves the exact shared-endpoint phase matrix', () => {
  const table = buildSphThermalMaterialTable(materialProperties);
  const waterId = stableOpticalMaterialId('h2o');
  const recordStride = table.recordStrideFloats;
  const segmentStride = table.segmentStrideFloats;
  const waterRecordOffset = Array.from(table.records).findIndex((value, index) => (
    index % recordStride === 0 && value === waterId
  ));
  const segmentOffset = table.records[waterRecordOffset + 1];
  const segmentCount = table.records[waterRecordOffset + 2];
  const segments = Array.from({ length: segmentCount }, (_, local) => {
    const offset = (segmentOffset + local) * segmentStride;
    return {
      type: Math.round(table.segments[offset + 1]),
      phaseFromId: Math.round(table.segments[offset + 2]),
      phaseToId: Math.round(table.segments[offset + 3]),
      energyStartJPerKg: table.segments[offset + 4],
      energyEndJPerKg: table.segments[offset + 5]
    };
  });
  const sharedEndpoints = [];

  for (let index = 0; index + 1 < segments.length; index += 1) {
    const left = segments[index];
    const right = segments[index + 1];
    assert.equal(left.energyEndJPerKg, right.energyStartJPerKg);
    const phase = left.type === 1 ? left : right;
    const plateau = left.type === 2 ? left : right;
    assert.equal(phase.type, 1);
    assert.equal(plateau.type, 2);
    const pureFractions = [0, 0, 0, 0];
    pureFractions[phase.phaseFromId - GPU_PHASE_IDS.solid] = 1;
    const mixedFractions = [0, 0, 0, 0];
    mixedFractions[plateau.phaseFromId - GPU_PHASE_IDS.solid] = 0.5;
    mixedFractions[plateau.phaseToId - GPU_PHASE_IDS.solid] = 0.5;
    const energy = left.energyEndJPerKg;
    const pureSlope = resolveThermalCarrierTemperatureSlopeFromTable(
      table,
      waterId,
      energy,
      phase.phaseFromId,
      pureFractions
    );
    const mixedSlope = resolveThermalCarrierTemperatureSlopeFromTable(
      table,
      waterId,
      energy,
      plateau.phaseToId,
      mixedFractions
    );
    sharedEndpoints.push({ energy, phaseId: phase.phaseFromId, pureSlope, mixedSlope });
  }

  assert.equal(sharedEndpoints.length, 4);
  for (const endpoint of sharedEndpoints) {
    assert.ok(endpoint.pureSlope > 0, `expected phase ${endpoint.phaseId} to have a sensible-heat slope`);
    nearlyEqual(endpoint.mixedSlope, 0, 1e-12);
  }
});

test('SPH thermal carrier domain unions adjacent responses only at an exact shared knot', () => {
  const table = buildSphThermalMaterialTable(materialProperties);
  const waterId = stableOpticalMaterialId('h2o');
  const recordOffset = Array.from(table.records).findIndex((value, index) => (
    index % table.recordStrideFloats === 0 && value === waterId
  ));
  const firstSegmentIndex = table.records[recordOffset + 1];
  const firstOffset = firstSegmentIndex * table.segmentStrideFloats;
  const secondOffset = (firstSegmentIndex + 1) * table.segmentStrideFloats;
  const sharedEnergy = table.segments[firstOffset + 5];
  assert.equal(sharedEnergy, table.segments[secondOffset + 4]);

  const atKnot = resolveThermalCarrierEnergyDomainFromTable(
    table,
    waterId,
    sharedEnergy
  );
  assert.equal(atKnot.ready, true);
  assert.equal(atKnot.containingSegmentCount, 2);
  assert.equal(atKnot.energyMinJPerKg, table.segments[firstOffset + 4]);
  assert.equal(atKnot.energyMaxJPerKg, table.segments[secondOffset + 5]);

  const interiorEnergy = (
    table.segments[secondOffset + 4] + table.segments[secondOffset + 5]
  ) * 0.5;
  const interior = resolveThermalCarrierEnergyDomainFromTable(
    table,
    waterId,
    interiorEnergy
  );
  assert.equal(interior.ready, true);
  assert.equal(interior.containingSegmentCount, 1);
  assert.equal(interior.energyMinJPerKg, table.segments[secondOffset + 4]);
  assert.equal(interior.energyMaxJPerKg, table.segments[secondOffset + 5]);

  const temperature = resolveThermalStateFromTable(table, waterId, interiorEnergy).temperatureK;
  const temperatureIntersection =
    resolveThermalCarrierEnergyDomainForTemperatureRangeFromTable(
      table,
      waterId,
      interiorEnergy,
      temperature,
      temperature
    );
  assert.equal(temperatureIntersection.ready, true);
  assert.ok(temperatureIntersection.energyMinJPerKg <= interiorEnergy);
  assert.ok(temperatureIntersection.energyMaxJPerKg >= interiorEnergy);
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
  destroySphThermalResponseGraphBuffers(upload);
  assert.equal(upload.destroyed, true);
  assert.deepEqual(destroyed, [
    'ulg-sph-thermal-phase-response-records',
    'ulg-sph-thermal-phase-responses',
    'ulg-sph-thermal-graph-nodes',
    'ulg-sph-thermal-graph-samples'
  ]);
});

test('SPH thermal response graph uploads are reusable only on their owning device', () => {
  const table = buildSphThermalMaterialTable(materialProperties);
  const graphSet = buildSphThermalClosureGraphBuffers(table);
  const responseTable = buildSphThermalPhaseResponseTable(table, graphSet);
  const createDevice = () => ({
    createBuffer({ label }) {
      return { label, destroy() {} };
    },
    queue: { writeBuffer() {} }
  });
  const deviceA = createDevice();
  const deviceB = createDevice();
  const upload = uploadSphThermalResponseGraphBuffers(deviceA, {
    thermalMaterialTable: table,
    thermalClosureGraphSet: graphSet,
    thermalClosureGraphBank: graphSet.graphBank,
    thermalPhaseResponseTable: responseTable
  });

  assert.equal(thermalResponseGraphUploadMatchesDevice(upload, deviceA), true);
  assert.equal(thermalResponseGraphUploadMatchesDevice(upload, deviceB), false);
  assert.equal(thermalResponseGraphUploadMatchesDevice({
    ...upload,
    responseRecordBuffer: { label: 'untagged-response-records' }
  }, deviceA), false);
  const differentTable = buildSphThermalMaterialTable({ h2o: materialProperties.h2o });
  const differentGraphSet = buildSphThermalClosureGraphBuffers(differentTable);
  const differentResponseTable = buildSphThermalPhaseResponseTable(
    differentTable,
    differentGraphSet
  );
  assert.equal(thermalResponseGraphUploadMatchesDevice(upload, deviceA, {
    thermalClosureGraphBank: differentGraphSet.graphBank,
    thermalPhaseResponseTable: differentResponseTable
  }), false);
  const equivalentTable = buildSphThermalMaterialTable(materialProperties);
  const equivalentGraphSet = buildSphThermalClosureGraphBuffers(equivalentTable);
  const equivalentResponseTable = buildSphThermalPhaseResponseTable(
    equivalentTable,
    equivalentGraphSet
  );
  assert.equal(thermalResponseGraphUploadMatchesDevice(upload, deviceA, {
    thermalClosureGraphBank: equivalentGraphSet.graphBank,
    thermalPhaseResponseTable: equivalentResponseTable
  }), true);

  destroySphThermalResponseGraphBuffers(upload);
  destroySphThermalResponseGraphBuffers(upload);
  assert.equal(upload.destroyed, true);
  assert.equal(thermalResponseGraphUploadMatchesDevice(upload, deviceA), false);
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

test('SPH thermal CPU derives pair temperatures from material and U instead of stale cached thermo', () => {
  const packed = packedTwoWaterParticles(330, 250);
  const table = buildSphThermalMaterialTable(materialProperties);
  const hotStateOffset = 0;
  const coldStateOffset = SPH_GPU_PARTICLE_STATE_FLOATS;
  packed.thermo[2] = 1;
  packed.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS + 2] = 1e6;
  const beforeEnergyJ = totalInternalEnergyJ(packed);
  const result = runSphThermalStepCpu({
    sphParticleState: packed,
    thermalMaterialTable: table,
    wallTemperaturesK: {},
    boxDimsM: [5, 5, 5],
    dtS: 1e-4,
    conductionRate: 1.5e4,
    ambientTemperatureK: 0,
    wallRate: 0
  });
  const afterEnergyJ = totalInternalEnergyJ({ ...packed, state: result.state });

  assert.ok(result.state[hotStateOffset + 7] < packed.state[hotStateOffset + 7]);
  assert.ok(result.state[coldStateOffset + 7] > packed.state[coldStateOffset + 7]);
  assert.ok(result.thermo[2] > 250 && result.thermo[2] < 330);
  assert.ok(
    result.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS + 2] > 250
    && result.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS + 2] < 330
  );
  nearlyEqual(afterEnergyJ, beforeEnergyJ, 1e-3);
});

test('SPH thermal CPU clamps a microscopic steam carrier against hot iron and conserves pair energy', () => {
  const sourceTable = buildSphThermalMaterialTable(materialProperties);
  const table = {
    ...sourceTable,
    records: new Float32Array(sourceTable.records)
  };
  for (let record = 0; record < table.materialCount; record += 1) {
    table.records[record * table.recordStrideFloats + 4] = 0;
  }
  const waterId = stableOpticalMaterialId('h2o');
  const waterRecordOffset = Array.from(table.records).findIndex((value, index) => (
    index % table.recordStrideFloats === 0 && value === waterId
  ));
  const waterSegmentOffset = table.records[waterRecordOffset + 1];
  const waterSegmentCount = table.records[waterRecordOffset + 2];
  let boilingUpperEnergyJPerKg = null;
  for (let local = 0; local < waterSegmentCount; local += 1) {
    const offset = (waterSegmentOffset + local) * table.segmentStrideFloats;
    const isLiquidGasPlateau = Math.round(table.segments[offset + 1]) === 2
      && Math.round(table.segments[offset + 2]) === GPU_PHASE_IDS.liquid
      && Math.round(table.segments[offset + 3]) === GPU_PHASE_IDS.gas;
    if (isLiquidGasPlateau) boilingUpperEnergyJPerKg = table.segments[offset + 5];
  }
  assert.ok(boilingUpperEnergyJPerKg > 0);

  const steamMassKg = (917 / 125) * 1e-7 * 1.01;
  const packed = buildSphGpuParticleBuffers(createSphState({
    smoothingLengthM: 0.248,
    dimension: 3,
    particles: [
      {
        id: 'microscopic-steam-carrier',
        material: 'h2o',
        x: [2, 2, 2],
        v: [0, 0, 0],
        massKg: steamMassKg,
        specificInternalEnergyJPerKg: boilingUpperEnergyJPerKg
      },
      {
        id: 'hot-iron-neighbor',
        material: 'fe',
        x: [2.1, 2, 2],
        v: [0, 0, 0],
        massKg: 1507.68 / 27,
        specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(materialProperties.fe, 1850)
      }
    ]
  }), { materialProperties });
  assert.equal(packed.thermo[1], GPU_PHASE_IDS.gas);
  nearlyEqual(packed.thermo[6], 1, 1e-7);
  const steamSlope = resolveThermalCarrierTemperatureSlopeFromTable(
    table,
    waterId,
    packed.state[7],
    packed.thermo[1],
    packed.thermo.subarray(4, 8)
  );
  assert.ok(steamSlope > 0);

  const before = totalInternalEnergyJ(packed);
  const result = runSphThermalStepCpu({
    sphParticleState: packed,
    thermalMaterialTable: table,
    wallTemperaturesK: {},
    boxDimsM: [5, 5, 5],
    dtS: 5e-4,
    conductionRate: 1500,
    ambientTemperatureK: 0,
    wallRate: 0
  });
  const after = totalInternalEnergyJ({ ...packed, state: result.state });
  const steamSpecificEnergyGain = result.state[7] - packed.state[7];

  assert.ok(result.thermo[2] > packed.thermo[2]);
  assert.ok(result.thermo[2] < packed.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS + 2]);
  assert.ok(steamSpecificEnergyGain > 0);
  assert.ok(steamSpecificEnergyGain < 1e6);
  nearlyEqual(after, before, Math.max(2, Math.abs(before) * 2e-7));
});

test('SPH thermal WGSL preserves visual particle radius while refreshing thermo rows', () => {
  assert.match(sphThermalStepWgsl, /vec4<f32>\(source_row2\.x,\s*source_row2\.y,\s*255\.0,\s*source_row2\.w\)/);
  assert.match(sphThermalStepWgsl, /vec4<f32>\(source_row2\.x,\s*source_row2\.y,\s*1\.0,\s*source_row2\.w\)/);
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

test('SPH thermal CPU reciprocal directional budgets conserve a multi-neighbor star', () => {
  const particles = [{
    id: 'cold-center',
    material: 'h2o',
    x: [2, 2, 2],
    v: [0, 0, 0],
    massKg: 1,
    specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(materialProperties.h2o, 300)
  }];
  for (let index = 0; index < 10; index += 1) {
    const angle = index * 2 * Math.PI / 10;
    particles.push({
      id: `warm-${index}`,
      material: 'h2o',
      x: [2 + 0.1 * Math.cos(angle), 2 + 0.1 * Math.sin(angle), 2],
      v: [0, 0, 0],
      massKg: 1,
      specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(materialProperties.h2o, 320)
    });
  }
  const packed = buildSphGpuParticleBuffers(createSphState({
    smoothingLengthM: 0.2,
    dimension: 3,
    particles
  }), { materialProperties });
  const table = buildSphThermalMaterialTable(materialProperties);
  const beforeEnergyJ = totalInternalEnergyJ(packed);
  const result = runSphThermalStepCpu({
    sphParticleState: packed,
    thermalMaterialTable: table,
    wallTemperaturesK: {},
    boxDimsM: [5, 5, 5],
    dtS: 1e-3,
    conductionRate: 1e12,
    ambientTemperatureK: 0,
    wallRate: 0
  });
  const afterEnergyJ = totalInternalEnergyJ({ ...packed, state: result.state });

  nearlyEqual(afterEnergyJ, beforeEnergyJ, 2);
  for (let index = 0; index < packed.particleCount; index += 1) {
    const temperatureK = result.thermo[index * SPH_GPU_PARTICLE_THERMO_FLOATS + 2];
    assert.ok(temperatureK >= 300 - 1e-3, `particle ${index} cooled below the source range`);
    assert.ok(temperatureK <= 320 + 1e-3, `particle ${index} heated above the source range`);
  }
  assert.ok(result.thermo[2] > packed.thermo[2]);
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

test('SPH thermal CPU bounds a latent plateau carrier to one adjacent ingress ULP and ledgers accepted wall heat', () => {
  const table = buildSphThermalMaterialTable(materialProperties);
  const waterId = stableOpticalMaterialId('h2o');
  const recordOffset = Array.from(table.records).findIndex((value, index) => (
    index % table.recordStrideFloats === 0 && value === waterId
  ));
  const segmentOffset = table.records[recordOffset + 1];
  const segmentCount = table.records[recordOffset + 2];
  let plateauLo = null;
  let plateauHi = null;
  for (let local = 0; local < segmentCount; local += 1) {
    const offset = (segmentOffset + local) * table.segmentStrideFloats;
    if (
      Math.round(table.segments[offset + 1]) === 2
      && Math.round(table.segments[offset + 2]) === GPU_PHASE_IDS.solid
      && Math.round(table.segments[offset + 3]) === GPU_PHASE_IDS.liquid
    ) {
      plateauLo = table.segments[offset + 4];
      plateauHi = table.segments[offset + 5];
      break;
    }
  }
  assert.ok(plateauHi > plateauLo);
  const plateauMid = Math.fround((plateauLo + plateauHi) * 0.5);
  const packed = buildSphGpuParticleBuffers(createSphState({
    smoothingLengthM: 0.1,
    dimension: 3,
    particles: [{
      id: 'melting-water-carrier',
      material: 'h2o',
      x: [0.01, 2, 2],
      v: [0, 0, 0],
      massKg: 1,
      specificInternalEnergyJPerKg: plateauMid
    }]
  }), { materialProperties });
  assert.ok(packed.thermo[4] > 0);
  assert.ok(packed.thermo[5] > 0);

  const result = runSphThermalStepCpu({
    sphParticleState: packed,
    thermalMaterialTable: table,
    wallTemperaturesK: { xMin: 500 },
    boxDimsM: [5, 5, 5],
    dtS: 1,
    conductionRate: 0,
    ambientTemperatureK: 0,
    wallRate: 1e12,
    wallLayerM: 0.1
  });
  const acceptedSpecificEnergyJPerKg = result.state[7] - packed.state[7];

  assert.equal(result.state[7], nextPositiveFloat32(plateauHi));
  assert.ok(Number.isFinite(result.thermo[2]));
  assert.ok(result.thermo[2] < 1e6);
  nearlyEqual(result.wallHeatJ.xMin, acceptedSpecificEnergyJPerKg, 1e-3);
  nearlyEqual(
    acceptedSpecificEnergyJPerKg,
    nextPositiveFloat32(plateauHi) - packed.state[7],
    1e-3
  );
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
    'thermal-material-bank-warm-inputs-bound-in-shader'
  );
  assert.equal(result.materialPropertyBankWarmInputConsumer.shaderBound, true);
  assert.equal(result.materialPropertyBankWarmInputConsumer.shaderBinding, 9);
  assert.equal(result.materialPropertyBankWarmInputConsumer.shaderRowCount, 1);
  assert.equal(result.materialPropertyBankWarmInputConsumer.bufferSource, 'sph-particle-upload');
  assert.equal(result.materialPropertyBankWarmInputRowCount, 1);
  assert.equal(result.materialPropertyBankWarmInputMatchedMaterialCount, 1);
  assert.equal(
    result.neighborLookupMode,
    'canonical-diagnosed-exhaustive-thermal-proposals'
  );
  assert.equal(result.legacyPrivateSpatialBuildCount, 0);
  assert.equal(result.legacyExhaustiveTraversalCount, 0);
  assert.equal(result.thermalPairLaw, 'reciprocal-directional-energy-budget-v2');
  assert.equal(result.thermalProposalMode, 'classic-lookup-neutral-v2');
  assert.equal(result.thermalProposalLookupMode,
    'immutable-source-deterministic-exhaustive');
  assert.equal(result.thermalProposalDispatchCount, 4);
  assert.equal(result.thermalProposalProducerApplySingleSubmission, true);
  assert.equal(result.thermalProposalNormalLookupBinned, false);
  assert.equal(result.thermalProposalExhaustiveTraversalConfiguredCount, 2);
  assert.equal(result.thermalProposalExhaustiveTraversalPotentialCount, 0);
  assert.equal(result.thermalProposalFallbackReason, 'post-separation-bins-missing');
  assert.equal(result.thermalProposalSchroederSpatialBuildCount, 0);
  assert.equal(device.submissions.length, 1);
  assert.deepEqual(device.encodedPassLabels, [
    'ulg-classic-thermal-v2-derived-prepass',
    'ulg-classic-thermal-v2-directional-budget',
    'ulg-classic-thermal-v2-budget-resolve',
    'ulg-classic-thermal-v2-reciprocal-limited-proposal',
    'ulg-sph-thermal-v2-canonical-proposal-apply'
  ]);
  assert.ok(device.bindGroups.at(-1).entries.some((entry) => (
    entry.binding === 9 && entry.resource.buffer.label === 'material-bank-warm-inputs'
  )));
  assert.equal(device.queueWrites.some((write) => write.label === 'ulg-sph-thermal-output-state'), false);
  assert.equal(device.queueWrites.some((write) => write.label === 'ulg-sph-thermal-output-thermo'), false);
  assert.equal(typeof result.destroyOutputParticleBuffers, 'function');
  result.destroyOutputParticleBuffers();
  result.destroyOutputParticleBuffers();
  assert.equal(device.destroyed.includes('ulg-sph-thermal-output-state'), false);
  assert.equal(device.destroyed.includes('ulg-sph-thermal-output-thermo'), false);

  device.resolveFence();
  // Cleanups are coalesced onto a shared queue fence, so a batch registered
  // while an earlier fence was in flight settles on the next one -- a fixed two
  // microtask turns is no longer enough to drain them all.
  for (let turn = 0; turn < 16; turn += 1) await Promise.resolve();

  assert.equal(device.destroyed.filter((label) => label === 'ulg-sph-thermal-output-state').length, 1);
  assert.equal(device.destroyed.filter((label) => label === 'ulg-sph-thermal-output-thermo').length, 1);
  assert.equal(device.fenceRequestedCount, 2);
});

test('SPH thermal setup failure releases the classic arena and every local buffer', () => {
  const device = fakeThermalDeviceWithFence();
  const args = classicThermalStageArgs(device);
  const createBindGroup = device.createBindGroup.bind(device);
  let bindGroupCallCount = 0;
  device.createBindGroup = (descriptor) => {
    bindGroupCallCount += 1;
    if (bindGroupCallCount === 5) {
      throw new Error('injected thermal apply bind-group failure');
    }
    return createBindGroup(descriptor);
  };
  assert.throws(
    () => createSphThermalStepWebGpuEncoderStage(args),
    /injected thermal apply bind-group failure/
  );
  assert.ok(device.destroyed.includes('ulg-sph-thermal-output-state'));
  assert.ok(device.destroyed.includes('ulg-sph-thermal-output-thermo'));
  assert.ok(device.destroyed.includes('ulg-sph-thermal-params'));
  device.createBindGroup = createBindGroup;
  const retried = createSphThermalStepWebGpuEncoderStage(args);
  assert.equal(retried.status, 'thermal-encoder-stage-ready');
  assert.equal(retried.cleanupAbortedWork(), true);
});

test('SPH thermal map failure destroys readbacks and releases the arena after the queue settles', async () => {
  const device = fakeThermalDeviceWithFence();
  const args = classicThermalStageArgs(device, {
    readbackMode: 'full-parity-readback'
  });
  device.failMapAsync = true;
  await assert.rejects(
    runSphThermalStepWebGpu(args),
    /injected thermal map failure/
  );
  assert.equal(
    device.destroyed.filter((label) => label === 'ulg-sph-thermal-readback').length,
    2
  );
  device.resolveFence();
  // Cleanups are coalesced onto a shared queue fence, so a batch registered
  // while an earlier fence was in flight settles on the next one -- a fixed two
  // microtask turns is no longer enough to drain them all.
  for (let turn = 0; turn < 16; turn += 1) await Promise.resolve();
  assert.ok(device.destroyed.includes('ulg-sph-thermal-output-state'));
  assert.ok(device.destroyed.includes('ulg-sph-thermal-output-thermo'));
  device.failMapAsync = false;
  const retried = createSphThermalStepWebGpuEncoderStage({
    ...args,
    readbackMode: 'no-full-readback'
  });
  assert.equal(retried.status, 'thermal-encoder-stage-ready');
  assert.equal(retried.cleanupAbortedWork(), true);
});

test('SPH thermal WebGPU rejects hand-labelled post-separation bins as proposal authority', () => {
  const packed = packedTwoWaterParticles();
  const table = buildSphThermalMaterialTable(materialProperties);
  const graphSet = buildSphThermalClosureGraphBuffers(table);
  const responseTable = buildSphThermalPhaseResponseTable(table, graphSet);
  const device = fakeThermalDeviceWithFence();
  const neighborBinsBuffer = { label: 'borrowed-postintegration-bins' };
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
    sphParticleUpload: {
      stateBuffer: { label: 'source-state' },
      thermoBuffer: { label: 'source-thermo' }
    },
    neighborBins: {
      binsBuffer: neighborBinsBuffer,
      capacity: 16,
      nx: 4,
      ny: 4,
      nz: 4,
      cellSizeM: 0.2,
      refreshedAfterSeparation: true,
      positionAuthority: 'post-separation-in-place-state'
    },
    readbackMode: 'no-full-readback'
  });

  assert.equal(
    stage.result.neighborLookupMode,
    'canonical-diagnosed-exhaustive-thermal-proposals'
  );
  assert.equal(stage.result.legacyPrivateSpatialBuildCount, 0);
  assert.equal(stage.result.legacyExhaustiveTraversalCount, 0);
  assert.equal(stage.result.thermalPairLaw, 'reciprocal-directional-energy-budget-v2');
  assert.equal(stage.result.thermalProposalMode, 'classic-lookup-neutral-v2');
  assert.equal(stage.result.thermalProposalLookupMode,
    'immutable-source-deterministic-exhaustive');
  assert.equal(stage.result.thermalProposalNormalLookupBinned, false);
  assert.equal(
    stage.result.thermalProposalResidentOverflowFallbackCapable,
    false
  );
  assert.equal(
    stage.result.thermalProposalProducerApplySingleSubmission,
    true
  );
  assert.equal(stage.result.thermalProposalBinnedTraversalCount, 0);
  assert.equal(stage.result.thermalProposalExhaustiveTraversalConfiguredCount, 2);
  assert.equal(stage.result.thermalProposalExhaustiveTraversalPotentialCount, 0);
  assert.equal(stage.result.thermalProposalFallbackEvidenceWord, 15);
  assert.equal(
    stage.result.thermalProposalFallbackReason,
    'post-separation-bin-authority-unproven'
  );
  assert.equal(stage.result.thermalProposalSchroederSpatialBuildCount, 0);
  assert.equal(
    stage.thermalProposalDiagnostics.exhaustiveFallbackEvidenceWord,
    15
  );
  assert.equal(
    stage.thermalProposalDiagnostics.ownership,
    'borrowed-until-pooled-arena-reuse'
  );
  assert.equal(
    device.bindGroups.some(({ entries }) => entries.some((entry) => (
      entry.binding === 2 && entry.resource.buffer === neighborBinsBuffer
    ))),
    false
  );
  assert.notEqual(
    device.bindGroups.at(-1).entries.find((entry) => entry.binding === 10)
      .resource.buffer,
    neighborBinsBuffer
  );
  stage.cleanupSubmittedWork();
});

test('G2P keeps separation bins private while retaining the post-apply thermal refill candidate', () => {
  const device = fakeThermalDeviceWithFence();
  const encoder = device.createCommandEncoder();
  const separation = encodeMlsMpmParticleSeparationPasses(device, encoder, {
    stateBuffer: { label: 'post-g2p-state' },
    mechanicsBuffer: { label: 'post-g2p-mechanics' },
    particleCount: 2,
    boxDimsM: [1, 1, 1],
    maxPairRestDistanceM: 0.1,
    minCellSizeM: 0.1
  });

  assert.equal(separation.enabled, true);
  assert.equal(separation.neighborBinsPublished, false);
  assert.equal(separation.neighborBinsRefreshedAfterSeparation, true);
  assert.equal(
    separation.postSeparationThermalBinCandidate.stateBuffer.label,
    'post-g2p-state'
  );
  assert.equal(
    separation.postSeparationThermalBinCandidate.binsBuffer,
    separation.scratch.binsBuffer
  );
  assert.equal(
    device.encodedPassLabels.includes(
      'ulg-mls-mpm-particle-separation-post-apply-bin-refill'
    ),
    true
  );
});

test('SPH thermal WebGPU binds full-row empty material-bank warm input sentinel', async () => {
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

  assert.deepEqual(
    device.queueWrites.find((write) => write.label === 'ulg-sph-thermal-material-bank-warm-input-rows-empty'),
    {
      label: 'ulg-sph-thermal-material-bank-warm-input-rows-empty',
      offset: 0,
      byteLength: MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT
    }
  );
  assert.equal(result.materialPropertyBankWarmInputConsumer.shaderRowCount, 0);
  result.destroyOutputParticleBuffers();
  device.resolveFence();
  // Cleanups are coalesced onto a shared queue fence, so a batch registered
  // while an earlier fence was in flight settles on the next one -- a fixed two
  // microtask turns is no longer enough to drain them all.
  for (let turn = 0; turn < 16; turn += 1) await Promise.resolve();
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

test('thermal max pair support is memoised per state buffer', () => {
  // The scan is O(N) and used to run while constructing every GPU stage.
  const count = 4096;
  const state = new Float32Array(count * SPH_GPU_PARTICLE_STATE_FLOATS);
  const thermo = new Float32Array(count * SPH_GPU_PARTICLE_THERMO_FLOATS);
  for (let i = 0; i < count; i += 1) {
    state[i * SPH_GPU_PARTICLE_STATE_FLOATS + 3] = 1;
    thermo[i * SPH_GPU_PARTICLE_THERMO_FLOATS] = 1;
  }
  const responses = new Float32Array(SPH_THERMAL_PHASE_RESPONSE_FLOATS);
  responses[0] = 1; responses[8] = 900; responses[9] = 1000;
  const particleState = { state, thermo, particleCount: count };
  const table = { responses };
  const first = resolveThermalMaxPairSupportM(particleState, table);
  assert.ok(first > 0);
  // Same buffer and count must return the identical value without rescanning.
  assert.equal(resolveThermalMaxPairSupportM(particleState, table), first);
});

test('thermal max pair support never narrows for the same state buffer', () => {
  // A stale CPU mirror that reports smaller masses must not shrink the
  // neighbour scan radius: narrowing silently drops radiation pairs, while
  // widening only costs extra cells.
  const count = 32;
  const state = new Float32Array(count * SPH_GPU_PARTICLE_STATE_FLOATS);
  const thermo = new Float32Array(count * SPH_GPU_PARTICLE_THERMO_FLOATS);
  for (let i = 0; i < count; i += 1) {
    state[i * SPH_GPU_PARTICLE_STATE_FLOATS + 3] = 8;
    thermo[i * SPH_GPU_PARTICLE_THERMO_FLOATS] = 1;
  }
  const responses = new Float32Array(SPH_THERMAL_PHASE_RESPONSE_FLOATS);
  responses[0] = 1; responses[8] = 900; responses[9] = 1000;
  const table = { responses };
  const wide = resolveThermalMaxPairSupportM({ state, thermo, particleCount: count }, table);
  // Shrink every mass, and change the count so the memo fast path is bypassed.
  for (let i = 0; i < count; i += 1) state[i * SPH_GPU_PARTICLE_STATE_FLOATS + 3] = 0.001;
  const afterShrink = resolveThermalMaxPairSupportM(
    { state, thermo, particleCount: count - 1 },
    table
  );
  assert.equal(afterShrink, wide, 'support radius must not narrow');
});
