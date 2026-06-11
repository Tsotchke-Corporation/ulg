import assert from 'node:assert/strict';
import { test } from 'node:test';
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
  ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
  buildSphThermalMaterialTable,
  compareSphThermalStepParity,
  resolveThermalStateFromTable,
  runSphThermalStepCpu,
  runSphThermalStepWithOptionalWebGpu
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
  assert.equal(resolveThermalStateFromTable(table, waterId, iceEnergy).phaseId, GPU_PHASE_IDS.solid);
  assert.equal(resolveThermalStateFromTable(table, waterId, liquidEnergy).phaseId, GPU_PHASE_IDS.liquid);
  assert.equal(resolveThermalStateFromTable(table, waterId, steamEnergy).phaseId, GPU_PHASE_IDS.gas);
  nearlyEqual(
    resolveThermalStateFromTable(table, waterId, liquidEnergy).temperatureK,
    equilibriumFromSpecificEnergy(materialProperties.h2o, liquidEnergy).temperatureK,
    1e-3
  );
});

test('SPH thermal CPU table step conserves pair conduction energy and refreshes thermo rows', () => {
  const packed = packedTwoWaterParticles();
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
