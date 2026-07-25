import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import { GPU_PHASE_IDS, stableOpticalMaterialId } from '../src/runtime/material/opticalGpuBuffers.js';
import {
  buildSphThermalClosureGraphBuffers,
  buildSphThermalMaterialTable,
  buildSphThermalPhaseResponseTable
} from '../src/runtime/sph/sphThermalGpuKernel.js';
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
  inspectSphReactionStoichiometryContract,
  releaseSphReactionTransferredDestinationAfterSettledFences,
  resolveReactionParticleBinGrid,
  runSphReactionStepCpu,
  runSphReactionStepWebGpu,
  runSphReactionStepWithOptionalWebGpu
} from '../src/runtime/sph/sphReactionGpuKernel.js';
import { sphReactionStepWgsl } from '../ulg-gpu-abi/src/wgsl.js';

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
  },
  c2: {
    molarMassKgPerMol: 0.004,
    phases: [{ name: 'gas', temperatureRange: [0, 3000], cpJPerKgK: 14000, densityKgPerM3: 0.1, bulkModulusPa: 1e5, shearModulusPa: 0 }],
    transitions: []
  }
};

const sphReactionGpuKernelSource = readFileSync(
  new URL('../src/runtime/sph/sphReactionGpuKernel.js', import.meta.url),
  'utf8'
);

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

function fakeReactionFailureDevice({ failAt = null } = {}) {
  const createdBuffers = [];
  let encoderFailed = false;
  const createBuffer = ({ label = 'buffer', size = 4 } = {}) => {
    const buffer = {
      label,
      size,
      destroyed: false,
      destroyCount: 0,
      mapState: 'unmapped',
      destroy() {
        this.destroyed = true;
        this.destroyCount += 1;
      },
      mapAsync() {
        if (
          failAt === 'map'
          && label === 'ulg-sph-reaction-particle-bin-metadata-readback'
        ) {
          return Promise.reject(new Error('injected-reaction-map-failure'));
        }
        this.mapState = 'mapped';
        return Promise.resolve();
      },
      getMappedRange() {
        return new ArrayBuffer(size);
      },
      unmap() {
        this.mapState = 'unmapped';
      }
    };
    createdBuffers.push(buffer);
    return buffer;
  };
  const pass = {
    setPipeline() {},
    setBindGroup() {},
    dispatchWorkgroups() {},
    end() {}
  };
  const device = {
    createdBuffers,
    limits: {
      maxBufferSize: 1 << 28,
      maxStorageBufferBindingSize: 1 << 28
    },
    queue: {
      writeBuffer() {},
      submit() {},
      onSubmittedWorkDone() { return Promise.resolve(true); }
    },
    createBuffer,
    createShaderModule() { return {}; },
    createBindGroupLayout() { return {}; },
    createPipelineLayout() { return {}; },
    createComputePipeline() {
      if (failAt === 'pipeline') {
        throw new Error('injected-reaction-pipeline-failure');
      }
      return { getBindGroupLayout() { return {}; } };
    },
    createBindGroup() { return {}; },
    createCommandEncoder() {
      if (failAt === 'encoder' && !encoderFailed) {
        encoderFailed = true;
        throw new Error('injected-reaction-encoder-failure');
      }
      return {
        beginComputePass() { return pass; },
        copyBufferToBuffer() {},
        finish() { return {}; }
      };
    }
  };
  return device;
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

function productionShapedCsfFixture() {
  const properties = {
    F: {
      formula: 'F2',
      molarMassKgPerMol: 0.037996,
      phases: [{
        name: 'gas',
        temperatureRange: [0, 3000],
        cpJPerKgK: 824,
        densityKgPerM3: 1.7,
        bulkModulusPa: 1e5,
        shearModulusPa: 0
      }],
      transitions: []
    },
    // This formula-key placeholder mirrors the incomplete alias mounted in
    // production. It must not shadow the selected live F carrier above.
    f2: { formula: 'F2' },
    // The mounted view can retain an incomplete display-key row while its
    // derived closure is available under a case-normalized alias. Carrier
    // identity stays `Cs`; readiness must come from the complete same-ID row.
    Cs: { formula: 'Cs' },
    cs: {
      molarMassKgPerMol: 0.13291,
      phases: [{
        name: 'solid',
        temperatureRange: [0, 3000],
        cpJPerKgK: 242,
        densityKgPerM3: 1873,
        bulkModulusPa: 1.6e9,
        shearModulusPa: 0.6e9
      }],
      transitions: []
    },
    csf: {
      formula: 'CsF',
      molarMassKgPerMol: 0.170906,
      phases: [{
        name: 'solid',
        temperatureRange: [0, 3000],
        cpJPerKgK: 400,
        densityKgPerM3: 4100,
        bulkModulusPa: 2e10,
        shearModulusPa: 8e9
      }],
      transitions: []
    }
  };
  const reaction = {
    a: 'Cs',
    b: 'F',
    product: 'csf',
    activationTemperatureK: 0,
    specificEnthalpyJPerKg: -1000,
    stoichiometry: {
      equation: '2 Cs + F2 -> 2 CsF',
      atomBalance: { balanced: true },
      reactants: [
        { coefficient: 2, formula: 'Cs' },
        { coefficient: 1, formula: 'F2' }
      ],
      products: [
        { coefficient: 2, formula: 'CsF', material: 'csf' }
      ]
    }
  };
  return { properties, reaction };
}

function multiProductReactionTable() {
  return buildSphReactionTable([{
    a: 'a',
    b: 'b',
    product: 'ab',
    activationTemperatureK: 0,
    phaseRequirements: { b: ['liquid'] },
    specificEnthalpyJPerKg: -1000,
    stoichiometry: {
      equation: '2 A + 2 B -> 2 AB + C2',
      atomBalance: { balanced: true },
      reactants: [
        { coefficient: 2, formula: 'A', material: 'a' },
        { coefficient: 2, formula: 'B', material: 'b' }
      ],
      products: [
        { coefficient: 2, formula: 'AB', material: 'ab' },
        { coefficient: 1, formula: 'C2', material: 'c2' }
      ]
    }
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
  assert.equal(table.combinedRecordCount, table.combinedRecords.length / 4);
  assert.equal(table.records[0], stableOpticalMaterialId('a'));
  assert.equal(table.records[1], stableOpticalMaterialId('b'));
  assert.equal(table.records[2], stableOpticalMaterialId('ab'));
  assert.equal(table.records[7], 1 << GPU_PHASE_IDS.liquid);
  assert.equal(table.productPhaseRecords[0], stableOpticalMaterialId('ab'));
  assert.equal(table.productPhaseRecords[1], GPU_PHASE_IDS.liquid);
  assert.equal(table.productPhaseRecords[2], 500);
  assert.equal(table.productPhaseRecords[3], 5e5);
  assert.equal(table.productTermRecords[6], GPU_PHASE_IDS.liquid);
  assert.equal(table.productTermRecords[7], 1);
  assert.deepEqual(
    Array.from(table.combinedRecords.slice(table.records.length, table.records.length + 4)),
    Array.from(table.productPhaseRecords.slice(0, 4))
  );
  assert.equal(table.scientificValidation, false);
  assert.equal(table.chemistryValidation, false);
});

test('SPH reaction table rejects ambiguous same-material binary roles', () => {
  const table = buildSphReactionTable([{
    a: 'a',
    b: 'a',
    product: 'ab',
    activationTemperatureK: 0,
    specificEnthalpyJPerKg: -1000
  }], {
    materialProperties,
    contactRadiusM: 0.1
  });

  assert.notEqual(table.records[8], 1);
  assert.notEqual(table.metadata[0].status, 1);
});

test('SPH reaction table packs balanced reactant/product/gas term rows', () => {
  const table = buildSphReactionTable([{
    a: 'a',
    b: 'b',
    product: 'ab',
    activationTemperatureK: 0,
    phaseRequirements: { b: ['liquid'] },
    specificEnthalpyJPerKg: -1000,
    stoichiometry: {
      equation: '2 A + 2 B -> 2 AB + C2',
      atomBalance: { balanced: true },
      reactants: [
        { coefficient: 2, formula: 'A', material: 'a' },
        { coefficient: 2, formula: 'B', material: 'b' }
      ],
      products: [
        { coefficient: 2, formula: 'AB', material: 'ab' },
        { coefficient: 1, formula: 'C2', material: 'c2' }
      ]
    }
  }], {
    materialProperties,
    contactRadiusM: 0.1
  });

  assert.equal(table.reactionClosureSchema, 'peercompute.ulg.reaction-closure.v0');
  assert.equal(table.reactionHeaderCount, 1);
  assert.equal(table.reactantTermCount, 2);
  assert.equal(table.productTermCount, 2);
  assert.equal(table.gasProductCount, 1);
  assert.equal(table.productPhaseCount, 2);
  assert.equal(table.reactionHeaders[2], 2);
  assert.equal(table.reactionHeaders[4], 2);
  assert.equal(table.reactionHeaders[6], 1);
  assert.equal(table.reactionHeaders[10], 1);
  assert.equal(table.reactantTermRecords[1], stableOpticalMaterialId('a'));
  assert.equal(table.reactantTermRecords[2], 2);
  assert.equal(table.productTermRecords[1], stableOpticalMaterialId('ab'));
  assert.equal(table.productTermRecords[2], 2);
  assert.ok(Math.abs(table.productTermRecords[4] - (0.06 / 0.064)) < 1e-6);
  assert.equal(table.productTermRecords[6], GPU_PHASE_IDS.liquid);
  assert.equal(table.productTermRecords[16 + 1], stableOpticalMaterialId('c2'));
  assert.equal(table.productTermRecords[16 + 5], 1);
  assert.equal(table.productTermRecords[16 + 6], GPU_PHASE_IDS.gas);
  assert.equal(table.productTermRecords[16 + 13], stableOpticalMaterialId('c2'));
  assert.equal(table.gasProductRecords[2], stableOpticalMaterialId('c2'));
  assert.equal(table.gasProductRecords[3], 1);
  assert.equal(table.metadata[0].productTerms.map((term) => term.material).join(','), 'ab,c2');
  assert.equal(table.metadata[0].gasProductTerms[0].material, 'c2');
});

test('SPH reaction table preserves live carrier IDs while resolving complete same-ID properties', () => {
  const { properties, reaction } = productionShapedCsfFixture();
  const table = buildSphReactionTable([reaction], {
    materialProperties: properties,
    contactRadiusM: 0.1
  });
  const fluorineOffset = 12;

  assert.equal(table.records[0], stableOpticalMaterialId('Cs'));
  assert.equal(table.records[1], stableOpticalMaterialId('F'));
  assert.equal(table.reactantTermRecords[1], stableOpticalMaterialId('Cs'));
  assert.ok(Math.abs(
    table.reactantTermRecords[3] - properties.cs.molarMassKgPerMol
  ) < 1e-8);
  assert.equal(table.reactantTermRecords[10], 1);
  assert.equal(
    table.reactantTermRecords[fluorineOffset + 1],
    stableOpticalMaterialId('F')
  );
  assert.notEqual(
    table.reactantTermRecords[fluorineOffset + 1],
    stableOpticalMaterialId('f2')
  );
  assert.ok(Math.abs(
    table.reactantTermRecords[fluorineOffset + 3]
      - properties.F.molarMassKgPerMol
  ) < 1e-8);
  assert.equal(table.reactantTermRecords[fluorineOffset + 10], 1);
  assert.equal(table.reactantTermMetadata[1].material, 'F');
  assert.equal(table.reactantTermMetadata[1].role, 'b');

  const diagnostic = inspectSphReactionStoichiometryContract(table);
  assert.equal(diagnostic.status, 'extended-stoichiometry-ready');
  assert.equal(diagnostic.failClosed, false);
  assert.equal(diagnostic.invalidReactionCount, 0);
});

test('SPH reaction table routes only gas-only or explicitly gas product terms to gas ledger', () => {
  const mixedPhaseProperties = {
    fe: {
      molarMassKgPerMol: 0.055845,
      phases: [{ name: 'solid', densityKgPerM3: 7800, bulkModulusPa: 1e11, shearModulusPa: 8e10 }],
      transitions: []
    },
    h2o: {
      molarMassKgPerMol: 0.018015,
      phases: [{ name: 'liquid', densityKgPerM3: 1000, bulkModulusPa: 2e9, shearModulusPa: 0 }],
      transitions: []
    },
    feoh2: {
      molarMassKgPerMol: 0.089859,
      phases: [
        { name: 'solid', densityKgPerM3: 3400, bulkModulusPa: 2e10, shearModulusPa: 1e10 },
        { name: 'liquid', densityKgPerM3: 3000, bulkModulusPa: 1e9, shearModulusPa: 0 },
        { name: 'gas', densityKgPerM3: 1, bulkModulusPa: 1e5, shearModulusPa: 0 }
      ],
      transitions: []
    },
    h2: {
      molarMassKgPerMol: 0.002016,
      phases: [{ name: 'gas', densityKgPerM3: 0.09, bulkModulusPa: 1e5, shearModulusPa: 0 }],
      transitions: []
    }
  };
  const table = buildSphReactionTable([{
    a: 'fe',
    b: 'h2o',
    product: 'feoh2',
    activationTemperatureK: 0,
    specificEnthalpyJPerKg: -1000,
    stoichiometry: {
      equation: 'Fe + 2 H2O -> Fe(OH)2 + H2',
      atomBalance: { balanced: true },
      reactants: [
        { coefficient: 1, formula: 'Fe', material: 'fe' },
        { coefficient: 2, formula: 'H2O', material: 'h2o' }
      ],
      products: [
        { coefficient: 1, formula: 'Fe(OH)2', material: 'feoh2' },
        { coefficient: 1, formula: 'H2', material: 'h2' }
      ]
    }
  }], {
    materialProperties: mixedPhaseProperties,
    contactRadiusM: 0.1
  });

  assert.equal(table.productTermMetadata[0].material, 'feoh2');
  assert.equal(table.productTermMetadata[0].routing, 'condensed');
  assert.equal(table.productTermMetadata[0].targetPhasePolicyId, GPU_PHASE_IDS.unknown);
  assert.equal(table.productTermRecords[7], 254);
  assert.equal(table.records[8], 254);
  assert.equal(table.productTermMetadata[1].material, 'h2');
  assert.equal(table.productTermMetadata[1].routing, 'gas');
  assert.equal(table.productTermMetadata[1].targetPhasePolicyId, GPU_PHASE_IDS.gas);
  assert.equal(table.gasProductCount, 1);
  assert.equal(table.gasProductMetadata[0].material, 'h2');

  const explicitLiquidTable = buildSphReactionTable([{
    a: 'fe',
    b: 'h2o',
    product: 'feoh2',
    activationTemperatureK: 0,
    specificEnthalpyJPerKg: -1000,
    stoichiometry: {
      equation: 'Fe + 2 H2O -> Fe(OH)2 + H2',
      atomBalance: { balanced: true },
      reactants: [
        { coefficient: 1, formula: 'Fe', material: 'fe' },
        { coefficient: 2, formula: 'H2O', material: 'h2o' }
      ],
      products: [
        { coefficient: 1, formula: 'Fe(OH)2', material: 'feoh2', targetPhase: 'liquid' },
        { coefficient: 1, formula: 'H2', material: 'h2' }
      ]
    }
  }], {
    materialProperties: mixedPhaseProperties,
    contactRadiusM: 0.1
  });
  assert.equal(explicitLiquidTable.records[8], 1);
  assert.equal(explicitLiquidTable.productTermRecords[6], GPU_PHASE_IDS.liquid);
  assert.equal(explicitLiquidTable.productTermRecords[7], 1);

  const explicitGasTable = buildSphReactionTable([{
    a: 'fe',
    b: 'h2o',
    product: 'feoh2',
    activationTemperatureK: 0,
    specificEnthalpyJPerKg: -1000,
    stoichiometry: {
      equation: 'Fe + 2 H2O -> Fe(OH)2 + H2',
      atomBalance: { balanced: true },
      reactants: [
        { coefficient: 1, formula: 'Fe', material: 'fe' },
        { coefficient: 2, formula: 'H2O', material: 'h2o' }
      ],
      products: [
        { coefficient: 1, formula: 'Fe(OH)2', material: 'feoh2', targetPhasePolicy: 'gas' },
        { coefficient: 1, formula: 'H2', material: 'h2', targetPhasePolicyId: 0 }
      ]
    }
  }], {
    materialProperties: mixedPhaseProperties,
    contactRadiusM: 0.1
  });
  assert.equal(explicitGasTable.records[8], 1);
  assert.equal(explicitGasTable.productTermRecords[5], 1);
  assert.equal(explicitGasTable.productTermRecords[6], GPU_PHASE_IDS.gas);
  assert.equal(explicitGasTable.productTermMetadata[0].routing, 'gas');
  assert.equal(explicitGasTable.productTermRecords[16 + 6], GPU_PHASE_IDS.gas);
  assert.equal(explicitGasTable.gasProductCount, 2);

  const zeroSentinelTable = buildSphReactionTable([{
    a: 'a',
    b: 'b',
    product: 'ab',
    activationTemperatureK: 0,
    specificEnthalpyJPerKg: -1000,
    stoichiometry: {
      reactants: [
        { coefficient: 1, material: 'a' },
        { coefficient: 1, material: 'b' }
      ],
      products: [{ coefficient: 1, material: 'ab', targetPhasePolicyId: 0 }]
    }
  }], {
    materialProperties,
    contactRadiusM: 0.1
  });
  assert.equal(zeroSentinelTable.records[8], 1);
  assert.equal(zeroSentinelTable.productTermRecords[6], GPU_PHASE_IDS.liquid);
  assert.equal(zeroSentinelTable.productTermRecords[7], 1);

  const conflictingRoutingTable = buildSphReactionTable([{
    a: 'fe',
    b: 'h2o',
    product: 'feoh2',
    activationTemperatureK: 0,
    specificEnthalpyJPerKg: -1000,
    stoichiometry: {
      reactants: [
        { coefficient: 1, material: 'fe' },
        { coefficient: 2, material: 'h2o' }
      ],
      products: [
        { coefficient: 1, material: 'feoh2', targetPhase: 'liquid', routing: 'gas' },
        { coefficient: 1, material: 'h2' }
      ]
    }
  }], {
    materialProperties: mixedPhaseProperties,
    contactRadiusM: 0.1
  });
  assert.equal(conflictingRoutingTable.records[8], 254);
  assert.equal(conflictingRoutingTable.productTermRecords[5], 0);
  assert.equal(conflictingRoutingTable.productTermRecords[6], GPU_PHASE_IDS.unknown);
  assert.equal(conflictingRoutingTable.productTermRecords[7], 254);
  assert.equal(conflictingRoutingTable.gasProductCount, 1);
});

test('SPH reaction CPU step converts only mutual nearest contact pairs and resets product mechanics', () => {
  const packed = packedThreeParticles();
  packed.sphParticleState.thermo[11] = 0.03125;
  packed.sphParticleState.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS + 11] = 0.046875;
  packed.sphParticleState.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS * 2 + 11] = 0.0625;
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
  assert.equal(result.thermo[11], 0.03125);
  assert.equal(result.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS + 11], 0.046875);
  assert.equal(result.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS * 2 + 11], 0.0625);
  assert.ok(Math.abs(result.state[7] - 1166.6667) < 1e-3);
  assert.ok(Math.abs(result.state[SPH_GPU_PARTICLE_STATE_FLOATS + 7] - 1166.6667) < 1e-3);
  assert.equal(result.reactionLedger.schema, 'peercompute.ulg.sph-gpu-reaction-ledger.v0');
  assert.equal(result.reactionLedger.eventCount, 1);
  assert.equal(result.reactionLedger.unplacedProductMassKg, 0);
  assert.equal(result.reactionLedger.productMassKgByMaterial.ab, 6);
  assert.ok(Math.abs(result.mechanics[18] - (0.16 * (2 / 6)) / (2 / 500)) < 1e-5);
  assert.ok(Math.abs(result.mechanics[19] - (2 / 500)) < 1e-8);
  assert.ok(Math.abs(
    result.mechanics[18] * result.mechanics[19]
      + result.mechanics[MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS + 18]
        * result.mechanics[MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS + 19]
      - 0.16
  ) < 1e-6);
  assert.equal(result.mechanics[20], 0);
  assert.equal(result.mechanics[22], 5e5);
  assert.equal(result.proposals[0], 1);
  assert.equal(result.proposals[4], 0);
  assert.equal(result.proposals[8], -1);
});

test('SPH reaction CPU reference consumes balanced product term rows for gas byproducts', () => {
  const packed = packedThreeParticles();
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties);
  const result = runSphReactionStepCpu({
    ...packed,
    reactionTable: multiProductReactionTable(),
    thermalMaterialTable
  });

  assert.equal(result.eventCount, 1);
  assert.equal(result.conversionCount, 1);
  assert.equal(result.thermo[0], stableOpticalMaterialId('ab'));
  assert.equal(result.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS], stableOpticalMaterialId('b'));
  assert.ok(Math.abs(result.state[3] - 5.625) < 1e-6);
  assert.equal(result.state[SPH_GPU_PARTICLE_STATE_FLOATS + 3], 0);
  assert.equal(result.mechanics[20], 0);
  assert.equal(result.mechanics[MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS + 19], 0);
  assert.ok(Math.abs(result.reactionLedger.gasMassKgByMaterial.c2 - 0.375) < 1e-6);
  assert.ok(Math.abs(result.reactionLedger.unplacedProductMassKg - 0.375) < 1e-6);
  assert.ok(Math.abs(result.reactionLedger.unplacedProductMassKgByMaterial.c2 - 0.375) < 1e-6);
  assert.ok(Math.abs(result.reactionLedger.visibleProductMassKgByMaterial.ab - 5.625) < 1e-6);
  assert.equal(result.reactionLedger.visibleProductMassKgByMaterial.c2 ?? 0, 0);
});

test('SPH reaction WGSL places gas products into freed parent slots after condensed products', () => {
  // Contract updated 2026-07-10: condensed products still claim parent slots
  // first (visible-slot routing), but gas products now become real eos=2
  // particles in the remaining freed slots instead of evaporating into
  // immovable product events (task #6 item 3). They still never displace a
  // condensed product and never enter the condensed pressure solve.
  assert.match(sphReactionStepWgsl, /fn\s+product_term_for_visible_slot/);
  assert.match(sphReactionStepWgsl, /let\s+condensed\s*=\s*term1\.y\s*<\s*0\.5/);
  assert.match(sphReactionStepWgsl, /fn\s+product_term_for_gas_slot/);
  assert.match(sphReactionStepWgsl, /fn\s+product_term_for_parent_slot/);
  assert.match(sphReactionStepWgsl, /fn\s+particle_current_volume/);
  assert.match(
    sphReactionStepWgsl,
    /if \(!\(self_current_volume > 0\.0\) \|\| !\(partner_current_volume > 0\.0\)\)/
  );
  assert.doesNotMatch(
    sphReactionStepWgsl,
    /select\(\s*rest_volume,\s*current_volume_m3/
  );
  assert.match(sphReactionStepWgsl, /product_term_for_parent_slot\(reaction_index,\s*local_product_slot\)/);
  // Products launch at the consumed pair's COM velocity (momentum-exact).
  assert.match(sphReactionStepWgsl, /product_com_velocity/);
  assert.match(sphReactionStepWgsl, /consumed_total_energy/);
  assert.match(
    sphReactionStepWgsl,
    /0\.5 \* consumed_mass \* dot\(product_com_velocity, product_com_velocity\)/
  );
});

test('SPH reaction product placement receives simulation-domain dimensions, not translated bin bounds', () => {
  assert.match(
    sphReactionGpuKernelSource,
    /runSphReactionSummaryWebGpu\(\{[\s\S]*?proposalBuffer,[\s\S]*?boxDimsM,[\s\S]*?readProductEvents: false/
  );
  assert.doesNotMatch(
    sphReactionGpuKernelSource,
    /boxDimsM:\s*reactionParticleBins\.boxDimsM/
  );
});

test('SPH reaction product placement borrows the canonical directory and publishes only placed destinations', () => {
  assert.match(
    sphReactionGpuKernelSource,
    /createSphReactionResolvePositionInvariantCertificate\(\{[\s\S]*?ancestorGeneration:\s*schroederSpatialEpochGeneration,[\s\S]*?frozenResolvedStateBuffer:\s*outStateBuffer/
  );
  assert.match(
    sphReactionGpuKernelSource,
    /reactionPlacementEpochRunner\(\{[\s\S]*?frozenSourceStateBuffer:\s*outStateBuffer,[\s\S]*?frozenSourceThermoBuffer:\s*outThermoBuffer,[\s\S]*?frozenSourceMechanicsBuffer:\s*outMechanicsBuffer/
  );
  assert.match(
    sphReactionGpuKernelSource,
    /continuationStateBuffer\s*=\s*[\s\S]*?reactionPlacementSourceFamily\.placedDestinationStateBuffer/
  );
  assert.match(
    sphReactionGpuKernelSource,
    /createSchroederSpatialReactionProductPlacementAuthorityWebGpu\(\{[\s\S]*?placementSourceFamily:\s*reactionPlacementSourceFamily/
  );
  assert.doesNotMatch(
    sphReactionGpuKernelSource,
    /createSchroederSpatialReactionProductPlacementAuthorityWebGpu\(\{[\s\S]{0,500}?generation:\s*schroederSpatialEpochGeneration/
  );
  assert.match(
    sphReactionGpuKernelSource,
    /nextStateBuffer:\s*continuationStateBuffer,[\s\S]*?nextThermoBuffer:\s*continuationThermoBuffer,[\s\S]*?nextMechanicsBuffer:\s*continuationMechanicsBuffer/
  );
  assert.match(
    sphReactionGpuKernelSource,
    /const\s+placementArtifact\s*=\s*reactionSummary\?\.reactionProductPlacementSubmissionArtifact\s*\?\?\s*null/
  );
  assert.doesNotMatch(
    sphReactionGpuKernelSource,
    /const\s+placementArtifact\s*=[\s\S]{0,300}?reactionProductPlacementArtifact/
  );
  assert.match(
    sphReactionGpuKernelSource,
    /releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue\([\s\S]*?transferSchroederSpatialReactionPlacementDestinationOwnership/
  );
  assert.match(
    sphReactionGpuKernelSource,
    /destroyRetainedOutputParticleBuffers[\s\S]*?preserveResidentProductMass\s*=\s*false/
  );
  assert.match(
    sphReactionGpuKernelSource,
    /residentProductMassSettlement[\s\S]*?onSubmittedWorkDone[\s\S]*?releaseSphReactionTransferredDestinationAfterSettledFences/
  );
  assert.match(
    sphReactionGpuKernelSource,
    /if\s*\(reactionPlacementSourceFamily\)[\s\S]*?reactionPlacementDestinationOwnershipTransferred[\s\S]*?releaseSphReactionTransferredDestinationAfterSettledFences[\s\S]*?else if[\s\S]*?reactionWarmArenaLease[\s\S]*?!reactionWarmArenaReleaseOwnedByOutput[\s\S]*?reactionWarmArenaReleaseRunner/
  );
  assert.match(
    sphReactionGpuKernelSource,
    /if\s*\(reactionPlacementSourceFamily\s*&&\s*!retainOutputParticleBuffers\)[\s\S]*?releaseSphReactionTransferredDestinationAfterSettledFences/
  );
  assert.doesNotMatch(
    sphReactionGpuKernelSource,
    /if\s*\(\s*reactionWarmArenaLease\s*&&\s*reactionPlacementSourceFamily\s*&&\s*!retainOutputParticleBuffers/
  );
});

test('SPH reaction WGSL preserves visual particle radius while resolving product thermo rows', () => {
  assert.match(sphReactionStepWgsl, /vec4<f32>\(source_row2\.x,\s*source_row2\.y,\s*255\.0,\s*source_row2\.w\)/);
  assert.match(sphReactionStepWgsl, /vec4<f32>\(source_row2\.x,\s*source_row2\.y,\s*1\.0,\s*source_row2\.w\)/);
});

test('SPH reaction WGSL can propose reactions from a GPU particle-bin grid', () => {
  assert.match(sphReactionStepWgsl, /struct\s+ReactionParticleBinParams/);
  assert.match(sphReactionStepWgsl, /fn\s+bin_particles/);
  assert.match(sphReactionStepWgsl, /fn\s+reaction_particle_bin_ready/);
  assert.match(sphReactionStepWgsl, /fn\s+reaction_partner_candidate/);
  assert.match(sphReactionStepWgsl, /if\s*\(\s*reaction_particle_bin_ready\(\)\s*\)/);
  assert.match(sphReactionStepWgsl, /atomicLoad\(&reaction_particle_bin_counts\[cell_index\]\)/);
});

test('SPH reaction WGSL can gate reaction proposals from a Schroeder law queue', () => {
  assert.match(sphReactionStepWgsl, /struct\s+SchroederReactionLawQueueParams/);
  assert.match(sphReactionStepWgsl, /struct\s+SchroederReactionLawNeighborParams/);
  assert.match(sphReactionStepWgsl, /@binding\(20\)\s+var<storage,\s*read>\s+schroeder_reaction_law_queue_rows/);
  assert.match(sphReactionStepWgsl, /@binding\(21\)\s+var<uniform>\s+schroeder_reaction_law_queue_params/);
  assert.match(sphReactionStepWgsl, /@binding\(22\)\s+var<storage,\s*read>\s+schroeder_reaction_neighbor_candidate_rows/);
  assert.match(sphReactionStepWgsl, /@binding\(23\)\s+var<uniform>\s+schroeder_reaction_neighbor_candidate_params/);
  assert.match(sphReactionStepWgsl, /@binding\(24\)\s+var<storage,\s*read>\s+schroeder_reaction_source_span_rows/);
  assert.match(sphReactionStepWgsl, /fn\s+schroeder_reaction_law_queue_allows_particle/);
  assert.match(sphReactionStepWgsl, /fn\s+schroeder_reaction_neighbor_candidates_enabled/);
  assert.match(sphReactionStepWgsl, /fn\s+schroeder_reaction_source_spans_enabled/);
  assert.match(sphReactionStepWgsl, /fn\s+schroeder_reaction_neighbor_candidate_span/);
  assert.match(sphReactionStepWgsl, /fn\s+schroeder_reaction_neighbor_candidate_partner/);
  assert.match(sphReactionStepWgsl, /SCHROEDER_REACTION_LAW_QUEUE_REACTION_ELIGIBLE_OFFSET/);
  assert.match(sphReactionStepWgsl, /let\s+using_schroeder_candidate_rows\s*=\s*schroeder_reaction_neighbor_candidates_enabled\(\)/);
  assert.match(sphReactionStepWgsl, /if\s*\(\s*!using_schroeder_candidate_rows\s*&&\s*!schroeder_reaction_law_queue_allows_particle\(particle_index\)\s*\)/);
  assert.match(sphReactionStepWgsl, /if\s*\(\s*using_schroeder_candidate_rows\s*\)/);
  assert.match(sphReactionStepWgsl, /let\s+span\s*=\s*schroeder_reaction_neighbor_candidate_span\(particle_index\)/);
  assert.match(sphReactionStepWgsl, /for\s*\(\s*var\s+candidate_index\s*=\s*candidate_start;\s*candidate_index\s*<\s*candidate_end/);
  assert.match(sphReactionStepWgsl, /else\s+if\s*\(\s*reaction_particle_bin_ready\(\)\s*\)/);
  assert.doesNotMatch(sphReactionStepWgsl, /particle_index\s*\*\s*candidate_budget/);
  assert.match(sphReactionStepWgsl, /proposals\[particle_index\]\s*=\s*vec4<f32>\(-1\.0,\s*-1\.0,\s*0\.0,\s*0\.0\)/);
});

test('SPH reaction particle-bin grid uses bounded adaptive capacity', () => {
  const packed = packedThreeParticles();
  const grid = resolveReactionParticleBinGrid({
    boxDimsM: [5, 5, 5],
    sphParticleState: packed.sphParticleState,
    reactionTable: reactionTable(),
    particleCount: 10000
  });

  assert.equal(grid.status, 'reaction-particle-bin-grid-ready');
  assert.equal(grid.enabled, true);
  assert.equal(grid.neighborMode, 'fixed-capacity-particle-bin-grid');
  assert.ok(grid.cellCount > 0);
  assert.ok(grid.binCapacity >= 64);
  assert.ok(grid.indexBufferByteLength <= 128 * 1024 * 1024);
  assert.ok(Math.abs(grid.maxContactRadiusM - 0.1) < 1e-6);
});

test('SPH reaction particle-bin grid falls back without positive reaction radius', () => {
  const packed = packedThreeParticles();
  const table = buildSphReactionTable([{
    a: 'a',
    b: 'b',
    product: 'ab',
    activationTemperatureK: 0,
    phaseRequirements: { b: ['liquid'] },
    specificEnthalpyJPerKg: -1000,
    contactRadiusM: 0
  }], { materialProperties, contactRadiusM: 0 });
  const grid = resolveReactionParticleBinGrid({
    boxDimsM: [5, 5, 5],
    sphParticleState: packed.sphParticleState,
    reactionTable: table
  });

  assert.equal(grid.enabled, false);
  assert.equal(grid.neighborMode, 'all-particle-scan-fallback');
  assert.equal(grid.status, 'reaction-particle-bin-grid-disabled');
});

test('SPH reaction CPU reference preserves excess reactant and ledgers unplaced gas products', () => {
  const packed = packedThreeParticles();
  packed.sphParticleState.state[SPH_GPU_PARTICLE_STATE_FLOATS + 3] = 8;
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties);
  const result = runSphReactionStepCpu({
    ...packed,
    reactionTable: multiProductReactionTable(),
    thermalMaterialTable
  });

  assert.equal(result.eventCount, 1);
  assert.equal(result.conversionCount, 1);
  assert.equal(result.thermo[0], stableOpticalMaterialId('ab'));
  assert.equal(result.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS], stableOpticalMaterialId('b'));
  assert.ok(Math.abs(result.state[3] - 5.625) < 1e-6);
  assert.ok(Math.abs(result.state[SPH_GPU_PARTICLE_STATE_FLOATS + 3] - 4) < 1e-6);
  assert.ok(Math.abs(result.mechanics[MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS + 19] - (4 / 800)) < 1e-8);
  assert.ok(Math.abs(result.reactionLedger.productMassKgByMaterial.ab - 5.625) < 1e-6);
  assert.ok(Math.abs(result.reactionLedger.gasMassKgByMaterial.c2 - 0.375) < 1e-6);
  assert.ok(Math.abs(result.reactionLedger.unplacedProductMassKgByMaterial.c2 - 0.375) < 1e-6);
  assert.ok(Math.abs(result.reactionLedger.visibleProductMassKgByMaterial.ab - 5.625) < 1e-6);
});

test('SPH reaction unequal-mass stoichiometry retains excess reactant and conserves total mass', () => {
  const { properties: csfProperties, reaction } =
    productionShapedCsfFixture();
  const packed = packedThreeParticles();
  const fluorineMassKg = 1.579538;
  const cesiumMassKg = 155.911697;
  packed.sphParticleState.state[3] = cesiumMassKg;
  packed.sphParticleState.state[SPH_GPU_PARTICLE_STATE_FLOATS + 3] =
    fluorineMassKg;
  packed.sphParticleState.thermo[0] = stableOpticalMaterialId('Cs');
  packed.sphParticleState.thermo[1] = GPU_PHASE_IDS.solid;
  packed.sphParticleState.thermo[3] = 1873;
  packed.sphParticleState.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS] =
    stableOpticalMaterialId('F');
  packed.sphParticleState.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS + 1] =
    GPU_PHASE_IDS.gas;
  packed.sphParticleState.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS + 3] = 1.7;
  const table = buildSphReactionTable([reaction], {
    materialProperties: csfProperties,
    contactRadiusM: 0.1
  });
  const result = runSphReactionStepCpu({
    ...packed,
    reactionTable: table,
    thermalMaterialTable: buildSphThermalMaterialTable({
      F: csfProperties.F,
      Cs: csfProperties.cs,
      csf: csfProperties.csf
    })
  });

  const extentMol = fluorineMassKg / csfProperties.F.molarMassKgPerMol;
  const expectedCesiumConsumedKg = extentMol
    * 2
    * csfProperties.cs.molarMassKgPerMol;
  const expectedCesiumRemainingKg = cesiumMassKg - expectedCesiumConsumedKg;
  const expectedProductMassKg = fluorineMassKg + expectedCesiumConsumedKg;
  const initialMassKg = Array.from({ length: 3 }, (_, index) => (
    packed.sphParticleState.state[index * SPH_GPU_PARTICLE_STATE_FLOATS + 3]
  )).reduce((sum, value) => sum + value, 0);
  const finalMassKg = Array.from({ length: 3 }, (_, index) => (
    result.state[index * SPH_GPU_PARTICLE_STATE_FLOATS + 3]
  )).reduce((sum, value) => sum + value, 0);

  assert.equal(result.eventCount, 1);
  assert.equal(result.conversionCount, 1);
  assert.equal(result.thermo[0], stableOpticalMaterialId('Cs'));
  assert.equal(
    result.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS],
    stableOpticalMaterialId('csf')
  );
  assert.ok(Math.abs(result.state[3] - expectedCesiumRemainingKg) < 2e-5);
  assert.ok(Math.abs(
    result.state[SPH_GPU_PARTICLE_STATE_FLOATS + 3]
      - expectedProductMassKg
  ) < 2e-5);
  assert.ok(Math.abs(finalMassKg - initialMassKg) < 2e-5);
  assert.equal(
    result.reactionStoichiometryDiagnosticStatus,
    'extended-stoichiometry-ready'
  );
  assert.equal(result.reactionStoichiometryInvalidReactionCount, 0);
  assert.equal(result.stoichiometryFailClosedPairCount, 0);
});

test('SPH reaction current-schema corrupt and missing terms fail closed without mutating parents', () => {
  const source = reactionTable();
  const cloneTable = () => ({
    ...source,
    records: new Float32Array(source.records),
    productPhaseRecords: new Float32Array(source.productPhaseRecords),
    reactionHeaders: new Float32Array(source.reactionHeaders),
    reactantTermRecords: new Float32Array(source.reactantTermRecords),
    productTermRecords: new Float32Array(source.productTermRecords),
    combinedRecords: new Float32Array(source.combinedRecords)
  });
  const combinedHeaderOffset = source.records.length
    + source.productPhaseRecords.length;
  const combinedReactantOffset = combinedHeaderOffset
    + source.reactionHeaders.length;
  const cases = [
    {
      name: 'corrupt combined upload term status',
      prepare(table) {
        table.combinedRecords[combinedReactantOffset + 10] = 255;
      },
      reason: 'reactant-term-prefix-mismatch'
    },
    {
      name: 'missing second reactant term in header',
      prepare(table) {
        table.reactionHeaders[2] = 1;
        table.combinedRecords[combinedHeaderOffset + 2] = 1;
      },
      reason: 'binary-reactant-term-range-invalid'
    }
  ];

  for (const fixture of cases) {
    const table = cloneTable();
    fixture.prepare(table);
    const diagnostic = inspectSphReactionStoichiometryContract(table);
    const packed = packedThreeParticles();
    const result = runSphReactionStepCpu({
      ...packed,
      reactionTable: table,
      thermalMaterialTable: buildSphThermalMaterialTable(materialProperties)
    });

    assert.equal(diagnostic.status,
      'extended-stoichiometry-invalid-fail-closed', fixture.name);
    assert.ok(diagnostic.reactions[0].reasons.includes(fixture.reason),
      fixture.name);
    assert.deepEqual(Array.from(result.state),
      Array.from(packed.sphParticleState.state), fixture.name);
    assert.deepEqual(Array.from(result.thermo),
      Array.from(packed.sphParticleState.thermo), fixture.name);
    assert.deepEqual(Array.from(result.mechanics),
      Array.from(packed.mlsMpmParticleState.mechanics), fixture.name);
    assert.equal(result.eventCount, 0, fixture.name);
    assert.equal(result.conversionCount, 0, fixture.name);
    assert.equal(result.reactionLedger, null, fixture.name);
    assert.equal(result.reactionStoichiometryInvalidReactionCount, 1,
      fixture.name);
    assert.equal(result.stoichiometryFailClosedPairCount, 1, fixture.name);
  }
});

test('SPH reaction whole-parent conversion remains available only for a distinguishable legacy table', () => {
  const source = reactionTable();
  const legacyTable = {
    ...source,
    reactionHeaderCount: 0,
    reactantTermCount: 0,
    productTermCount: 0,
    gasProductCount: 0,
    reactionHeaders: new Float32Array(),
    reactantTermRecords: new Float32Array(),
    productTermRecords: new Float32Array(),
    gasProductRecords: new Float32Array(),
    atomTermRecords: new Float32Array(),
    combinedRecords: new Float32Array([
      ...source.records,
      ...source.productPhaseRecords
    ])
  };
  legacyTable.combinedRecordCount = legacyTable.combinedRecords.length / 4;
  const packed = packedThreeParticles();
  const result = runSphReactionStepCpu({
    ...packed,
    reactionTable: legacyTable,
    thermalMaterialTable: buildSphThermalMaterialTable(materialProperties)
  });

  assert.equal(result.reactionStoichiometryTableMode, 'legacy-whole-particle');
  assert.equal(
    result.reactionStoichiometryDiagnosticStatus,
    'legacy-whole-particle-schema-admitted'
  );
  assert.equal(result.conversionCount, 2);
  assert.equal(result.thermo[0], stableOpticalMaterialId('ab'));
  assert.equal(
    result.thermo[SPH_GPU_PARTICLE_THERMO_FLOATS],
    stableOpticalMaterialId('ab')
  );
  assert.equal(result.state[3], packed.sphParticleState.state[3]);
  assert.equal(
    result.state[SPH_GPU_PARTICLE_STATE_FLOATS + 3],
    packed.sphParticleState.state[SPH_GPU_PARTICLE_STATE_FLOATS + 3]
  );
});

test('SPH reaction CPU step resolves product phase state from thermal graph response artifacts', () => {
  const packed = packedThreeParticles();
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties);
  const thermalClosureGraphSet = buildSphThermalClosureGraphBuffers(thermalMaterialTable);
  const thermalPhaseResponseTable = buildSphThermalPhaseResponseTable(thermalMaterialTable, thermalClosureGraphSet);
  const generated = runSphReactionStepCpu({
    ...packed,
    reactionTable: reactionTable(),
    thermalMaterialTable
  });
  const explicit = runSphReactionStepCpu({
    ...packed,
    reactionTable: reactionTable(),
    thermalMaterialTable,
    thermalClosureGraphSet,
    thermalClosureGraphBank: thermalClosureGraphSet.graphBank,
    thermalPhaseResponseTable
  });

  assert.equal(explicit.thermalPhaseResponseTableSchema, 'peercompute.ulg.sph-gpu-thermal-phase-response-table.v1');
  assert.equal(explicit.thermalClosureGraphSetSchema, 'peercompute.ulg.sph-gpu-thermal-closure-graph-set.v0');
  assert.equal(explicit.thermalClosureGraphBankSchema, 'peercompute.ulg.sph-gpu-thermal-closure-graph-bank.v0');
  assert.equal(explicit.responseCount, thermalPhaseResponseTable.responseCount);
  assert.equal(explicit.thermalGraphCount, thermalClosureGraphSet.graphBank.graphCount);
  assert.deepEqual(Array.from(explicit.state), Array.from(generated.state));
  assert.deepEqual(Array.from(explicit.thermo), Array.from(generated.thermo));
  assert.deepEqual(Array.from(explicit.mechanics), Array.from(generated.mechanics));
});

test('SPH reaction optional WebGPU accepts a parity-passing reaction runner', async () => {
  const packed = packedThreeParticles();
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties);
  const thermalClosureGraphSet = buildSphThermalClosureGraphBuffers(thermalMaterialTable);
  const thermalPhaseResponseTable = buildSphThermalPhaseResponseTable(thermalMaterialTable, thermalClosureGraphSet);
  const table = reactionTable();
  const execution = await runSphReactionStepWithOptionalWebGpu({
    ...packed,
    reactionTable: table,
    thermalMaterialTable,
    thermalClosureGraphSet,
    thermalClosureGraphBank: thermalClosureGraphSet.graphBank,
    thermalPhaseResponseTable,
    preferWebGpu: true,
    device: {},
    webGpuRunner(args) {
      assert.equal(args.thermalClosureGraphSet, thermalClosureGraphSet);
      assert.equal(args.thermalClosureGraphBank, thermalClosureGraphSet.graphBank);
      assert.equal(args.thermalPhaseResponseTable, thermalPhaseResponseTable);
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

test('SPH reaction optional WebGPU accepts no-full retained output without CPU parity', async () => {
  const packed = packedThreeParticles();
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties);
  const table = reactionTable();
  const execution = await runSphReactionStepWithOptionalWebGpu({
    ...packed,
    reactionTable: table,
    thermalMaterialTable,
    preferWebGpu: true,
    device: {},
    readbackMode: 'no-full-readback',
    reactionParticleBinMetadataReadback: true,
    webGpuRunner(args) {
      assert.equal(args.readbackMode, 'no-full-readback');
      assert.equal(args.reactionParticleBinMetadataReadback, true);
      return {
        schema: ULG_SPH_GPU_REACTION_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'reaction-step-executed',
        particleCount: packed.sphParticleState.particleCount,
        reactionCount: table.reactionCount,
        productTermCount: table.productTermCount,
        gasProductCount: table.gasProductCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        mechanics: new Float32Array(),
        proposals: new Float32Array(),
        stateBuffer: { label: 'reaction-state-retained' },
        thermoBuffer: { label: 'reaction-thermo-retained' },
        mechanicsBuffer: { label: 'reaction-mechanics-retained' },
        retainedOutputParticleBuffers: true,
        fullReadbackPerformed: false,
        normalHotLoopReadbackFree: true,
        readbackMode: 'no-full-readback'
      };
    }
  });

  assert.equal(execution.schema, ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.status, 'webgpu-accepted-no-full-readback');
  assert.equal(execution.cpuReference, null);
  assert.equal(execution.webgpuParity.status, 'not-run-no-full-readback');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed-no-full-readback');
  assert.equal(execution.result.stateBuffer.label, 'reaction-state-retained');
  assert.equal(execution.result.thermoBuffer.label, 'reaction-thermo-retained');
  assert.equal(execution.result.mechanicsBuffer.label, 'reaction-mechanics-retained');
});

test('SPH reaction optional WebGPU forwards a Schroeder law queue into the runner', async () => {
  const packed = packedThreeParticles();
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties);
  const table = reactionTable();
  const schroederLawQueue = {
    schema: ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
    status: 'schroeder-law-queue-submitted',
    lawQueueBuffer: { label: 'retained-schroeder-law-queue' },
    activeNodeCount: packed.sphParticleState.particleCount,
    lawQueueStrideFloats: 32,
    enabledLawMask: 1,
    reactionScopeStatus: 'sedenion-scope-preserved-for-reaction-queue'
  };
  const schroederLawNeighborCandidates = {
    schema: ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
    status: 'schroeder-law-neighbor-candidates-submitted',
    neighborCandidateBuffer: { label: 'retained-schroeder-law-neighbor-candidates' },
    neighborCandidateCount: 12,
    neighborCandidateStrideFloats: 16,
    candidateBudget: 4,
    lawQueueCount: 3,
    enabledLawMask: 1,
    enumerationMode: 'schroeder-law-queue-bounded-window-neighbor-enumeration',
    treeTraversalStatus: 'placeholder-window-traversal-before-sorted-schroeder-tree-neighbor-walk'
  };
  const execution = await runSphReactionStepWithOptionalWebGpu({
    ...packed,
    reactionTable: table,
    thermalMaterialTable,
    preferWebGpu: true,
    device: {},
    readbackMode: 'no-full-readback',
    schroederLawQueue,
    schroederLawNeighborCandidates,
    webGpuRunner(args) {
      assert.equal(args.schroederLawQueue, schroederLawQueue);
      assert.equal(args.schroederLawNeighborCandidates, schroederLawNeighborCandidates);
      return {
        schema: ULG_SPH_GPU_REACTION_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'reaction-step-executed',
        particleCount: packed.sphParticleState.particleCount,
        reactionCount: table.reactionCount,
        productTermCount: table.productTermCount,
        gasProductCount: table.gasProductCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        mechanics: new Float32Array(),
        proposals: new Float32Array(),
        retainedOutputParticleBuffers: false,
        fullReadbackPerformed: false,
        normalHotLoopReadbackFree: true,
        readbackMode: 'no-full-readback',
        schroederLawQueueStatus: 'schroeder-reaction-law-queue-ready',
        schroederLawQueueConsumerStatus: 'schroeder-reaction-law-queue-consumed',
        schroederLawQueueBufferConsumed: true,
        schroederLawNeighborCandidateStatus: 'schroeder-reaction-law-neighbor-candidates-ready',
        schroederLawNeighborCandidateConsumerStatus:
          'schroeder-reaction-law-neighbor-candidates-observed-not-authoritative',
        schroederLawNeighborCandidateBufferObserved: true,
        schroederLawNeighborCandidateBufferConsumed: false,
        reactionProposalNeighborMode: 'schroeder-law-queue-gated-schroeder-law-neighbor-candidates-observed-fixed-capacity-particle-bin-grid'
      };
    }
  });

  assert.equal(execution.status, 'webgpu-accepted-no-full-readback');
  assert.equal(execution.result.schroederLawQueueStatus, 'schroeder-reaction-law-queue-ready');
  assert.equal(execution.result.schroederLawQueueConsumerStatus, 'schroeder-reaction-law-queue-consumed');
  assert.equal(execution.result.schroederLawQueueBufferConsumed, true);
  assert.equal(execution.result.schroederLawNeighborCandidateStatus, 'schroeder-reaction-law-neighbor-candidates-ready');
  assert.equal(
    execution.result.schroederLawNeighborCandidateConsumerStatus,
    'schroeder-reaction-law-neighbor-candidates-observed-not-authoritative'
  );
  assert.equal(execution.result.schroederLawNeighborCandidateBufferObserved, true);
  assert.equal(execution.result.schroederLawNeighborCandidateBufferConsumed, false);
  assert.equal(
    execution.result.reactionProposalNeighborMode,
    'schroeder-law-queue-gated-schroeder-law-neighbor-candidates-observed-fixed-capacity-particle-bin-grid'
  );
});

test('SPH reaction setup, encoder, and map failures drain every non-borrowed local resource', async () => {
  for (const failAt of ['pipeline', 'encoder', 'map']) {
    const packed = packedThreeParticles();
    const device = fakeReactionFailureDevice({ failAt });
    let failure = null;
    try {
      await runSphReactionStepWebGpu({
        ...packed,
        device,
        reactionTable: reactionTable(),
        thermalMaterialTable:
          buildSphThermalMaterialTable(materialProperties),
        readbackMode: 'no-full-readback',
        reactionParticleBinMetadataReadback: failAt === 'map'
      });
    } catch (error) {
      failure = error;
    }

    assert.match(
      failure?.message || '',
      new RegExp(`injected-reaction-${failAt}-failure`)
    );
    assert.equal(await failure.reactionResourceCleanupCompletion, true);
    assert.ok(device.createdBuffers.length > 0);
    assert.ok(
      device.createdBuffers.every((buffer) => buffer.destroyCount === 1),
      `${failAt} left a local reaction buffer live`
    );
  }
});

test('SPH reaction pipeline failure returns a warm arena lease before retry', async () => {
  const packed = packedThreeParticles();
  const device = fakeReactionFailureDevice({ failAt: 'pipeline' });
  const warmBuffers = Object.fromEntries([
    'packedSource',
    'fallbackState',
    'fallbackThermo',
    'fallbackMechanics',
    'packedOutput',
    'resolvedState',
    'resolvedThermo',
    'resolvedMechanics',
    'reactionParams',
    'productEvent'
  ].map((name) => [name, device.createBuffer({
    label: `warm-${name}`,
    size: 1 << 16
  })]));
  const arena = {
    schema: 'test-reaction-warm-arena',
    capacityKey: 'test-capacity',
    slotIndex: 0,
    buffers: warmBuffers
  };
  const borrowedReactionRecordBuffer = device.createBuffer({
    label: 'borrowed-canonical-reaction-records',
    size: 4096
  });
  const borrowedProposalBuffer = device.createBuffer({
    label: 'borrowed-canonical-reaction-proposals',
    size: 4096
  });
  let leased = false;
  let acquireCount = 0;
  let releaseCount = 0;
  const acquire = async () => {
    assert.equal(leased, false, 'warm arena was not returned before retry');
    leased = true;
    acquireCount += 1;
    return { arena, warmReuse: acquireCount > 1, bufferCreationCount: 0 };
  };
  const release = (_lease, { completionFence }) => Promise.resolve(
    completionFence
  ).then(() => {
    assert.equal(leased, true);
    leased = false;
    releaseCount += 1;
    return true;
  });
  const canonicalResolver = () => ({
    admitted: true,
    status: 'canonical-spatial-reaction-discovery-admitted',
    generationId: 'test-generation',
    epochIdentity: { positionEpoch: 1 },
    reactionRecordBuffer: borrowedReactionRecordBuffer,
    proposalBuffer: borrowedProposalBuffer,
    receipt: {
      consumerId: 'test-consumer',
      supportProfileId: 'test-support',
      traversalCount: 1
    }
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let failure = null;
    try {
      await runSphReactionStepWebGpu({
        ...packed,
        device,
        reactionTable: reactionTable(),
        thermalMaterialTable:
          buildSphThermalMaterialTable(materialProperties),
        readbackMode: 'no-full-readback',
        schroederSpatialEpochGeneration: {},
        schroederSpatialReactionDiscoveryProposal: {},
        canonicalReactionDiscoveryResolver: canonicalResolver,
        reactionWarmArenaAcquireRunner: acquire,
        reactionWarmArenaResolveRunner: () => arena,
        reactionWarmArenaReleaseRunner: release
      });
    } catch (error) {
      failure = error;
    }
    assert.match(
      failure?.message || '',
      /injected-reaction-pipeline-failure/
    );
    await failure.reactionResourceCleanupCompletion;
    assert.equal(leased, false);
  }

  assert.equal(acquireCount, 2);
  assert.equal(releaseCount, 2);
  assert.ok(
    device.createdBuffers
      .filter((buffer) => !buffer.label.startsWith('warm-')
        && !buffer.label.startsWith('borrowed-canonical-'))
      .every((buffer) => buffer.destroyCount === 1)
  );
  assert.ok(Object.values(warmBuffers).every(
    (buffer) => buffer.destroyCount === 0
  ));
  assert.equal(borrowedReactionRecordBuffer.destroyCount, 0);
  assert.equal(borrowedProposalBuffer.destroyCount, 0);
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

test('SPH non-warm destination fallback waits all settled fences and retires exactly once', async () => {
  let resolveQueue;
  const queueFence = new Promise((resolve) => {
    resolveQueue = resolve;
  });
  const destroyed = [];
  const destination = (label) => ({
    label,
    destroy() { destroyed.push(label); }
  });
  const sourceFamily = {
    placedDestinationStateBuffer: destination('state'),
    placedDestinationThermoBuffer: destination('thermo'),
    placedDestinationMechanicsBuffer: destination('mechanics')
  };
  let ownerReleaseCount = 0;
  const releaseRunner = () => {
    ownerReleaseCount += 1;
    return Promise.reject(new Error('injected-source-release-failure'));
  };
  const completion =
    releaseSphReactionTransferredDestinationAfterSettledFences({
      device: {
        queue: { onSubmittedWorkDone: () => queueFence }
      },
      sourceFamily,
      completionFence: Promise.reject(
        new Error('injected-downstream-release-failure')
      ),
      settlementFences: [queueFence],
      releaseRunner
    });
  const replay =
    releaseSphReactionTransferredDestinationAfterSettledFences({
      device: {
        queue: { onSubmittedWorkDone: () => Promise.resolve() }
      },
      sourceFamily,
      releaseRunner
    });

  assert.equal(replay, completion);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(destroyed, []);
  assert.equal(ownerReleaseCount, 1);

  resolveQueue(true);
  assert.equal(await completion, false);
  assert.deepEqual(destroyed.sort(), ['mechanics', 'state', 'thermo']);
  assert.equal(ownerReleaseCount, 1);
  assert.equal(await replay, false);
  assert.equal(destroyed.length, 3);
});
