import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import { GPU_PHASE_IDS, stableOpticalMaterialId } from '../src/runtime/material/opticalGpuBuffers.js';
import { buildSphThermalMaterialTable } from '../src/runtime/sph/sphThermalGpuKernel.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from '../src/runtime/sph/sphGpuBuffers.js';
import {
  ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA,
  ULG_SPH_GPU_REACTION_STEP_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
  buildSphReactionTable,
  compareSphReactionStepParity,
  runSphReactionStepCpu,
  runSphReactionStepWithOptionalWebGpu
} from '../src/runtime/sph/sphReactionGpuKernel.js';

const materialProperties = {
  a: {
    molarMassKgPerMol: 0.01,
    phases: [{ name: 'solid', temperatureRange: [0, 2000], cpJPerKgK: 1000, densityKgPerM3: 1000, bulkModulusPa: 1e6, shearModulusPa: 2e5 }],
    transitions: []
  },
  b: {
    molarMassKgPerMol: 0.02,
    phases: [{ name: 'liquid', temperatureRange: [0, 2000], cpJPerKgK: 1200, densityKgPerM3: 800, bulkModulusPa: 8e5, shearModulusPa: 0 }],
    transitions: []
  },
  ab: {
    molarMassKgPerMol: 0.03,
    phases: [{ name: 'liquid', temperatureRange: [0, 3000], cpJPerKgK: 1500, densityKgPerM3: 500, bulkModulusPa: 5e5, shearModulusPa: 0 }],
    transitions: []
  }
};

function packedThreeParticles() {
  const state = new Float32Array(3 * SPH_GPU_PARTICLE_STATE_FLOATS);
  state.set([0, 0, 0, 2, 0, 0, 0, 100], 0);
  state.set([0.04, 0, 0, 4, 0, 0, 0, 200], SPH_GPU_PARTICLE_STATE_FLOATS);
  state.set([1, 0, 0, 3, 0, 0, 0, 300], SPH_GPU_PARTICLE_STATE_FLOATS * 2);

  const thermo = new Float32Array(3 * SPH_GPU_PARTICLE_THERMO_FLOATS);
  thermo.set([stableOpticalMaterialId('a'), GPU_PHASE_IDS.solid, 300, 1000, 1, 0, 0, 0, 0.1, 1, 1, 0], 0);
  thermo.set([stableOpticalMaterialId('b'), GPU_PHASE_IDS.liquid, 300, 800, 0, 1, 0, 0, 0.1, 1, 1, 0], SPH_GPU_PARTICLE_THERMO_FLOATS);
  thermo.set([stableOpticalMaterialId('b'), GPU_PHASE_IDS.liquid, 300, 800, 0, 1, 0, 0, 0.1, 1, 1, 0], SPH_GPU_PARTICLE_THERMO_FLOATS * 2);

  const mechanics = new Float32Array(3 * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS);
  for (let i = 0; i < 3; i += 1) {
    const offset = i * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    mechanics.set([
      2, 0, 0, 0,
      2, 0, 0, 0,
      2, 0, 0, 0,
      9, 9, 9, 9,
      9, 9, 8, 0.01,
      1, 1, 1e6, 2e5,
      8e5, 30, 1, 1,
      0, 0, 0, 0
    ], offset);
  }

  return {
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      status: 'test-packed',
      particleCount: 3,
      step: 0,
      time: 0,
      smoothingLengthM: 0.1,
      state,
      thermo
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      status: 'test-packed',
      particleCount: 3,
      step: 0,
      time: 0,
      mechanics
    }
  };
}

function reactionTable() {
  return buildSphReactionTable([{
    a: 'a',
    b: 'b',
    product: 'ab',
    activationTemperatureK: 0,
    phaseRequirements: { b: ['liquid'] },
    specificEnthalpyJPerKg: -1000
  }], {
    materialProperties,
    contactRadiusM: 0.1
  });
}

test('SPH reaction table packs derived reaction and product phase mechanics rows', () => {
  const table = reactionTable();
  assert.equal(table.schema, ULG_SPH_GPU_REACTION_TABLE_SCHEMA);
  assert.equal(table.status, 'derived-reaction-table-ready');
  assert.equal(table.reactionCount, 1);
  assert.equal(table.productPhaseCount, 1);
  assert.equal(table.combinedRecordCount, 2);
  assert.equal(table.records[0], stableOpticalMaterialId('a'));
  assert.equal(table.records[1], stableOpticalMaterialId('b'));
  assert.equal(table.records[2], stableOpticalMaterialId('ab'));
  assert.equal(table.records[7], 1 << GPU_PHASE_IDS.liquid);
  assert.equal(table.productPhaseRecords[0], stableOpticalMaterialId('ab'));
  assert.equal(table.productPhaseRecords[1], GPU_PHASE_IDS.liquid);
  assert.equal(table.productPhaseRecords[2], 500);
  assert.equal(table.productPhaseRecords[3], 5e5);
  assert.deepEqual(
    Array.from(table.combinedRecords.slice(table.records.length, table.records.length + 4)),
    Array.from(table.productPhaseRecords.slice(0, 4))
  );
  assert.equal(table.scientificValidation, false);
  assert.equal(table.chemistryValidation, false);
});

test('SPH reaction CPU step converts only mutual nearest contact pairs and resets product mechanics', () => {
  const packed = packedThreeParticles();
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties);
  const result = runSphReactionStepCpu({
    ...packed,
    reactionTable: reactionTable(),
    thermalMaterialTable
  });

  assert.equal(result.schema, ULG_SPH_GPU_REACTION_STEP_SCHEMA);
  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.eventCount, 1);
  assert.equal(result.conversionCount, 2);
  assert.equal(result.thermo[0], stableOpticalMaterialId('ab'));
  assert.equal(result.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS], stableOpticalMaterialId('ab'));
  assert.equal(result.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS * 2], stableOpticalMaterialId('b'));
  assert.equal(result.state[7], 1100);
  assert.equal(result.state[SPH_GPU_PARTICLE_STATE_FLOATS + 7], 1200);
  assert.equal(result.mechanics[18], 1);
  assert.ok(Math.abs(result.mechanics[19] - (2 / 500)) < 1e-8);
  assert.equal(result.mechanics[20], 0);
  assert.equal(result.mechanics[22], 5e5);
  assert.equal(result.proposals[0], 1);
  assert.equal(result.proposals[4], 0);
  assert.equal(result.proposals[8], -1);
});

test('SPH reaction optional WebGPU accepts a parity-passing reaction runner', async () => {
  const packed = packedThreeParticles();
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties);
  const table = reactionTable();
  const execution = await runSphReactionStepWithOptionalWebGpu({
    ...packed,
    reactionTable: table,
    thermalMaterialTable,
    preferWebGpu: true,
    device: {},
    webGpuRunner(args) {
      const result = runSphReactionStepCpu(args);
      return { ...result, backend: 'webgpu' };
    }
  });

  assert.equal(execution.schema, ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.status, 'webgpu-accepted');
  assert.equal(execution.webgpuParity.status, 'pass');
  assert.equal(execution.result.backend, 'webgpu');
  assert.equal(execution.chemistryValidation, false);
});

test('SPH reaction parity rejects reaction output drift', () => {
  const packed = packedThreeParticles();
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties);
  const cpu = runSphReactionStepCpu({
    ...packed,
    reactionTable: reactionTable(),
    thermalMaterialTable
  });
  const drifted = {
    ...cpu,
    backend: 'webgpu',
    state: new Float32Array(cpu.state),
    thermo: new Float32Array(cpu.thermo),
    mechanics: new Float32Array(cpu.mechanics),
    proposals: new Float32Array(cpu.proposals)
  };
  drifted.thermo[0] = stableOpticalMaterialId('a');
  drifted.mechanics[22] += 100;

  const parity = compareSphReactionStepParity(cpu, drifted, { tolerance: 1e-4 });
  assert.equal(parity.schema, 'peercompute.ulg.sph-gpu-reaction-step-parity.v0');
  assert.equal(parity.status, 'fail');
  assert.ok(parity.maxThermoAbs > 0);
  assert.ok(parity.maxMechanicsAbs > 1);
});
