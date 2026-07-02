import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
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
  resolveReactionParticleBinGrid,
  runSphReactionStepCpu,
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
  assert.deepEqual(
    Array.from(table.combinedRecords.slice(table.records.length, table.records.length + 4)),
    Array.from(table.productPhaseRecords.slice(0, 4))
  );
  assert.equal(table.scientificValidation, false);
  assert.equal(table.chemistryValidation, false);
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
  assert.equal(table.productTermRecords[16 + 1], stableOpticalMaterialId('c2'));
  assert.equal(table.productTermRecords[16 + 5], 1);
  assert.equal(table.productTermRecords[16 + 13], stableOpticalMaterialId('c2'));
  assert.equal(table.gasProductRecords[2], stableOpticalMaterialId('c2'));
  assert.equal(table.gasProductRecords[3], 1);
  assert.equal(table.metadata[0].productTerms.map((term) => term.material).join(','), 'ab,c2');
  assert.equal(table.metadata[0].gasProductTerms[0].material, 'c2');
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
  assert.equal(table.productTermMetadata[1].material, 'h2');
  assert.equal(table.productTermMetadata[1].routing, 'gas');
  assert.equal(table.gasProductCount, 1);
  assert.equal(table.gasProductMetadata[0].material, 'h2');
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
  assert.equal(result.mechanics[18], 1);
  assert.ok(Math.abs(result.mechanics[19] - (2 / 500)) < 1e-8);
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

test('SPH reaction WGSL routes gas products out of visible particle slots', () => {
  assert.match(sphReactionStepWgsl, /fn\s+product_term_for_visible_slot/);
  assert.match(sphReactionStepWgsl, /let\s+condensed\s*=\s*term1\.y\s*<\s*0\.5/);
  assert.match(sphReactionStepWgsl, /product_term_for_visible_slot\(reaction_index,\s*local_product_slot\)/);
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
  assert.match(sphReactionStepWgsl, /@binding\(20\)\s+var<storage,\s*read>\s+schroeder_reaction_law_queue_rows/);
  assert.match(sphReactionStepWgsl, /@binding\(21\)\s+var<uniform>\s+schroeder_reaction_law_queue_params/);
  assert.match(sphReactionStepWgsl, /fn\s+schroeder_reaction_law_queue_allows_particle/);
  assert.match(sphReactionStepWgsl, /SCHROEDER_REACTION_LAW_QUEUE_REACTION_ELIGIBLE_OFFSET/);
  assert.match(sphReactionStepWgsl, /if\s*\(\s*!schroeder_reaction_law_queue_allows_particle\(particle_index\)\s*\)/);
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

  assert.equal(explicit.thermalPhaseResponseTableSchema, 'peercompute.ulg.sph-gpu-thermal-phase-response-table.v0');
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
  const execution = await runSphReactionStepWithOptionalWebGpu({
    ...packed,
    reactionTable: table,
    thermalMaterialTable,
    preferWebGpu: true,
    device: {},
    readbackMode: 'no-full-readback',
    schroederLawQueue,
    webGpuRunner(args) {
      assert.equal(args.schroederLawQueue, schroederLawQueue);
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
        reactionProposalNeighborMode: 'schroeder-law-queue-gated-fixed-capacity-particle-bin-grid'
      };
    }
  });

  assert.equal(execution.status, 'webgpu-accepted-no-full-readback');
  assert.equal(execution.result.schroederLawQueueStatus, 'schroeder-reaction-law-queue-ready');
  assert.equal(execution.result.schroederLawQueueConsumerStatus, 'schroeder-reaction-law-queue-consumed');
  assert.equal(execution.result.schroederLawQueueBufferConsumed, true);
  assert.equal(execution.result.reactionProposalNeighborMode, 'schroeder-law-queue-gated-fixed-capacity-particle-bin-grid');
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
