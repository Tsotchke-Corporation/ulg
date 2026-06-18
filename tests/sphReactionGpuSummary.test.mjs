import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
  ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_INVENTORY_SCHEMA,
  ULG_SPH_GPU_REACTION_SUMMARY_EXECUTION_SCHEMA,
  ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  decodeSphReactionAtomResidualValues,
  decodeSphReactionGasSpeciesSummaryValues,
  decodeSphReactionProductEventValues,
  decodeSphReactionProductInventoryValues,
  decodeSphReactionSummaryValues,
  createResidentProductMassHandle,
  reactionStrictGateFromSummary,
  runSphReactionSummaryWebGpu,
  SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  SPH_GPU_REACTION_SUMMARY_FLOATS
} from '../src/runtime/sph/sphReactionGpuSummary.js';

function fakeSummaryDevice(
  summaryValues,
  gasSpeciesValues = new Float32Array(),
  productInventoryValues = new Float32Array(),
  atomResidualValues = new Float32Array(),
  productEventValues = new Float32Array()
) {
  const createdBuffers = [];
  const bindGroups = [];
  const dispatches = [];
  const shaderModules = [];
  const copies = [];
  const submissions = [];
  const writes = [];
  return {
    createdBuffers,
    bindGroups,
    dispatches,
    shaderModules,
    copies,
    submissions,
    writes,
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ label: buffer.label, offset, byteLength: data.byteLength });
      },
      submit(commands) {
        submissions.push(commands);
      }
    },
    createBuffer({ label, size, usage }) {
      const buffer = {
        label,
        size,
        usage,
        destroyed: false,
        async mapAsync() {},
        getMappedRange() {
          const source = label.includes('product-event')
            ? productEventValues
            : label.includes('atom-residual')
            ? atomResidualValues
            : label.includes('product-inventory')
            ? productInventoryValues
            : label.includes('gas-species')
              ? gasSpeciesValues
              : summaryValues;
          return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
        },
        unmap() {
          this.unmapped = true;
        },
        destroy() {
          this.destroyed = true;
        }
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule({ code }) {
      const module = { code };
      shaderModules.push(module);
      return module;
    },
    createComputePipeline({ label, layout, compute }) {
      return {
        label,
        layout,
        compute,
        getBindGroupLayout(index) {
          return { index, entryPoint: compute.entryPoint };
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
            setPipeline(pipeline) {
              this.pipeline = pipeline;
            },
            setBindGroup(index, bindGroup) {
              this.bindGroup = { index, bindGroup };
            },
            dispatchWorkgroups(count) {
              dispatches.push({ count, pipeline: this.pipeline, bindGroup: this.bindGroup?.bindGroup });
            },
            end() {
              this.ended = true;
            }
          };
        },
        copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
          copies.push({ source, sourceOffset, destination, destinationOffset, size });
        },
        finish() {
          return { dispatches: [...dispatches], copies: [...copies] };
        }
      };
    }
  };
}

function reactionTable() {
  return {
    schema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
    reactionCount: 1,
    productPhaseCount: 1,
    reactantTermCount: 2,
    productTermCount: 2,
    gasProductCount: 1,
    atomTermCount: 4,
    combinedRecords: new Float32Array(120),
    productTermMetadata: [
      {
        productTermIndex: 0,
        reactionIndex: 0,
        material: 'ab',
        materialId: 300,
        coefficient: 2,
        molarMassKgPerMol: 0.03,
        routing: 'condensed',
        status: 1
      },
      {
        productTermIndex: 1,
        reactionIndex: 0,
        material: 'c2',
        materialId: 400,
        coefficient: 1,
        molarMassKgPerMol: 0.004,
        routing: 'gas',
        status: 1
      }
    ],
    gasProductMetadata: [{
      gasRecordIndex: 0,
      productTermIndex: 1,
      reactionIndex: 0,
      material: 'c2',
      materialId: 400,
      molarMassKgPerMol: 0.004,
      pressureRouting: 'sealed-box-gas-inventory',
      status: 1
    }],
    metadata: [{
      stoichiometry: {
        equation: '2 A + B -> 2 AB + C2',
        atomBalance: { balanced: true },
        chargeBalance: { balanced: true },
        provisionalEnergeticsStatus: null
      },
      energyModel: 'atomic-kohn-sham-tight-binding-v0'
    }],
    atomTermMetadata: [
      {
        reactionIndex: 0,
        termKind: 'reactant',
        termKindId: 1,
        termIndex: 0,
        atomicNumberZ: 1,
        atomsPerFormula: 1,
        coefficient: 2,
        charge: 0,
        material: 'a',
        formula: 'A'
      },
      {
        reactionIndex: 0,
        termKind: 'reactant',
        termKindId: 1,
        termIndex: 1,
        atomicNumberZ: 2,
        atomsPerFormula: 1,
        coefficient: 1,
        charge: 0,
        material: 'b',
        formula: 'B'
      },
      {
        reactionIndex: 0,
        termKind: 'product',
        termKindId: 2,
        termIndex: 0,
        atomicNumberZ: 1,
        atomsPerFormula: 1,
        coefficient: 2,
        charge: 0,
        material: 'ab',
        formula: 'AB'
      },
      {
        reactionIndex: 0,
        termKind: 'product',
        termKindId: 2,
        termIndex: 1,
        atomicNumberZ: 2,
        atomsPerFormula: 1,
        coefficient: 1,
        charge: 0,
        material: 'c2',
        formula: 'C2'
      }
    ]
  };
}

test('SPH reaction compact summary decoder exposes visible gas/product counters', () => {
  const summary = decodeSphReactionSummaryValues(new Float32Array([
    65, 1, 2, 1,
    3, 2, 5, 1.5,
    1.5, 10, 9, -1,
    60, 5, 65, 1,
    1, 6, 6, 6.4,
    5.625, 0.375, 0.375, 0,
    0.375, 93.75, 6000, 0.4,
    1, 0, 1, 1
  ]));

  assert.equal(summary.schema, ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA);
  assert.equal(summary.executionSchema, ULG_SPH_GPU_REACTION_SUMMARY_EXECUTION_SCHEMA);
  assert.equal(summary.status, 'reaction-compact-summary-ready');
  assert.equal(summary.reactionSummaryAvailable, true);
  assert.equal(summary.visibleProductMassKg, 5);
  assert.equal(summary.visibleGasProductMassKg, 1.5);
  assert.equal(summary.outputGasPhaseMassKg, 1.5);
  assert.equal(summary.massDeltaKg, -1);
  assert.equal(summary.canonicalReactionEventCount, 1);
  assert.equal(summary.ledgerUnplacedProductMassKg, 0.375);
  assert.equal(summary.ledgerGasProductMassKg, 0.375);
  assert.equal(summary.ledgerUnplacedGasProductMassKg, 0.375);
  assert.equal(summary.sealedBoxGasProductMoles, 93.75);
  assert.equal(summary.reactionHeatJ, 6000);
  assert.equal(summary.compactLedgerAvailable, true);
  assert.equal(summary.compactReadbackFloatCount ?? SPH_GPU_REACTION_SUMMARY_FLOATS, 32);
  assert.equal(summary.visibleOnly, true);
  assert.equal(summary.unplacedProductInventoryIncluded, true);
});

test('SPH reaction gas species decoder aggregates duplicate gas rows by material', () => {
  const ledger = decodeSphReactionGasSpeciesSummaryValues(new Float32Array([
    400, 0.2, 50, 0.05, 0.15, 1, 0, 1,
    400, 0.1, 25, 0.0, 0.1, 1, 1, 1,
    500, 0.03, 10, 0.03, 0, 1, 2, 1
  ]), {
    gasProductMetadata: [
      { gasRecordIndex: 0, material: 'c2', materialId: 400, molarMassKgPerMol: 0.004, status: 1 },
      { gasRecordIndex: 1, material: 'c2', materialId: 400, molarMassKgPerMol: 0.004, status: 1 },
      { gasRecordIndex: 2, material: 'd2', materialId: 500, molarMassKgPerMol: 0.003, status: 1 }
    ]
  });

  assert.equal(ledger.schema, ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA);
  assert.equal(ledger.recordCount, 3);
  assert.equal(ledger.speciesCount, 2);
  assert.ok(Math.abs(ledger.bySpecies.c2.massKg - 0.3) < 1e-7);
  assert.equal(ledger.bySpecies.c2.moles, 75);
  assert.deepEqual(ledger.bySpecies.c2.gasProductIndices, [0, 1]);
  assert.equal(ledger.bySpecies.d2.unplacedMassKg, 0);
  assert.equal(ledger.fullParticleReadbackPerformed, false);
});

test('SPH reaction product inventory decoder aggregates visible and unplaced products', () => {
  const inventory = decodeSphReactionProductInventoryValues(new Float32Array([
    300, 5.625, 5.625, 0, 93.75, 1, 0, 0,
    0, 0, 0, 1, 2, 0.03, 5.625, 0.9375,
    400, 0.375, 0, 0.375, 93.75, 1, 1, 0,
    1, 0, 0, 1, 1, 0.004, 0.4, 0.9375,
    300, 1, 0.25, 0.75, 16.666666, 1, 2, 0,
    0, 0, 0, 1, 1, 0.06, 1, 1
  ]), {
    productTermMetadata: [
      { productTermIndex: 0, material: 'ab', materialId: 300, molarMassKgPerMol: 0.03, routing: 'condensed', status: 1 },
      { productTermIndex: 1, material: 'c2', materialId: 400, molarMassKgPerMol: 0.004, routing: 'gas', status: 1 },
      { productTermIndex: 2, material: 'ab', materialId: 300, molarMassKgPerMol: 0.06, routing: 'condensed', status: 1 }
    ]
  });

  assert.equal(inventory.schema, ULG_SPH_GPU_REACTION_PRODUCT_INVENTORY_SCHEMA);
  assert.equal(inventory.recordCount, 3);
  assert.equal(inventory.materialCount, 2);
  assert.ok(Math.abs(inventory.byMaterial.ab.massKg - 6.625) < 1e-6);
  assert.ok(Math.abs(inventory.byMaterial.ab.visibleMassKg - 5.875) < 1e-6);
  assert.ok(Math.abs(inventory.byMaterial.ab.unplacedMassKg - 0.75) < 1e-6);
  assert.deepEqual(inventory.byMaterial.ab.productTermIndices, [0, 2]);
  assert.equal(inventory.byMaterial.c2.routing, 'gas');
  assert.equal(inventory.byMaterial.c2.unplacedMassKg, 0.375);
  assert.equal(inventory.fullParticleReadbackPerformed, false);
});

test('SPH reaction product event decoder exposes sparse renderable product rows', () => {
  const rows = new Float32Array(4 * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);
  rows.set([
    0.25, 0.5, 0.75, 5.625,
    300, 0, 0, 8,
    9, 93.75, 0, 2,
    5.625, 0, 2, 0.03,
    360, 2130, 1, 0
  ], 0);
  rows.set([
    0.25, 0.5, 0.75, 0.375,
    400, 1, 0, 8,
    9, 93.75, 1, 3,
    0, 0.375, 1, 0.004,
    360, 0.09, 1, 0
  ], SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);

  const events = decodeSphReactionProductEventValues(rows, reactionTable());

  assert.equal(events.schema, ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA);
  assert.equal(events.status, 'product-event-sparse-storage-ready');
  assert.equal(events.rowCount, 4);
  assert.equal(events.activeEventCount, 2);
  assert.equal(events.materialCount, 2);
  assert.equal(events.activeMassKg, 6);
  assert.equal(events.unplacedMassKg, 0.375);
  assert.equal(events.records[0].material, 'ab');
  assert.equal(events.records[0].phaseId, 2);
  assert.deepEqual(events.records[0].positionM, [0.25, 0.5, 0.75]);
  assert.equal(events.records[1].routing, 'gas');
  assert.equal(events.records[1].phaseId, 3);
  assert.equal(events.records[1].supportVolumeM3, 0);
  assert.equal(events.records[1].soundSpeedMPerS, 0);
  assert.equal(events.byMaterial.ab.eventCount, 1);
  assert.equal(events.byMaterial.c2.unplacedMassKg, 0.375);
  assert.deepEqual(events.byMaterial.c2.productTermIndices, [1]);
  assert.equal(events.sparseStorage, true);
  assert.equal(events.renderableProductStorage, true);
  assert.equal(events.fullParticleReadbackPerformed, false);
});

test('resident product mass handle preserves positioned product-event records', () => {
  const reactionSummary = {
    status: 'reaction-compact-summary-ready',
    productEventBufferRetained: true,
    productEventBuffer: { label: 'resident-product-events' },
    productEventBufferByteLength: 128,
    productEventRowCount: 1,
    productEventActiveEventCount: 1,
    productEvents: {
      schema: ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
      status: 'product-event-sparse-storage-ready',
      records: [
        {
          status: 'ready',
          material: 'h2',
          materialId: 1,
          routing: 'gas',
          productTermIndex: 1,
          massKg: 0.001,
          moles: 0.5,
          positionM: [0.5, 1, 1],
          supportVolumeM3: 4
        }
      ]
    }
  };

  const handle = createResidentProductMassHandle(reactionSummary);

  assert.equal(handle.status, 'resident-product-mass-buffer-retained');
  assert.equal(handle.productEvents.schema, ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA);
  assert.equal(handle.productEvents.records.length, 1);
  assert.deepEqual(handle.productEvents.records[0].positionM, [0.5, 1, 1]);
  assert.equal(handle.productEvents.records[0].supportVolumeM3, 4);
  assert.notEqual(handle.productEvents.records[0], reactionSummary.productEvents.records[0]);
});

test('SPH reaction atom residual decoder aggregates atom and charge parity rows', () => {
  const residual = decodeSphReactionAtomResidualValues(new Float32Array([
    0, 11, -10, 0, 1, 1, 0, 1,
    0, 8, -5, 0, 1, 1, 1, 1,
    0, 11, 10, 0, 1, 2, 0, 1,
    0, 8, 5, 0, 1, 2, 1, 1
  ]), {
    atomTermMetadata: [
      { reactionIndex: 0, termKind: 'reactant', termIndex: 0, atomicNumberZ: 11, atomsPerFormula: 1, coefficient: 2, material: 'na', formula: 'Na' },
      { reactionIndex: 0, termKind: 'reactant', termIndex: 1, atomicNumberZ: 8, atomsPerFormula: 1, coefficient: 2, material: 'h2o', formula: 'H2O' },
      { reactionIndex: 0, termKind: 'product', termIndex: 0, atomicNumberZ: 11, atomsPerFormula: 1, coefficient: 2, material: 'naoh', formula: 'NaOH' },
      { reactionIndex: 0, termKind: 'product', termIndex: 1, atomicNumberZ: 8, atomsPerFormula: 1, coefficient: 2, material: 'naoh', formula: 'NaOH' }
    ]
  });

  assert.equal(residual.schema, ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA);
  assert.equal(residual.recordCount, 4);
  assert.equal(residual.readyEventCount, 1);
  assert.equal(residual.problemRowCount, 0);
  assert.equal(residual.atomResidualMolByZ['11'], 0);
  assert.equal(residual.atomResidualMolByZ['8'], 0);
  assert.equal(residual.maxAbsAtomResidualMol, 0);
  assert.equal(residual.chargeResidualMol, 0);
  assert.equal(residual.records[2].termKind, 'product');
  assert.equal(residual.fullParticleReadbackPerformed, false);
});

test('SPH reaction strict gate blocks provisional energetics and atom residual drift', () => {
  const compactSummary = decodeSphReactionSummaryValues(new Float32Array([
    65, 1, 2, 1,
    3, 2, 5, 1.5,
    1.5, 10, 9, -1,
    60, 5, 65, 1,
    1, 6, 6, 6.4,
    5.625, 0.375, 0.375, 0,
    0.375, 93.75, 6000, 0.4,
    1, 0, 1, 1
  ]));
  const clean = reactionStrictGateFromSummary({
    compactSummary,
    atomResidualSummary: {
      recordCount: 4,
      maxAbsAtomResidualMol: 0,
      chargeResidualMol: 0
    },
    reactionTable: reactionTable()
  });
  assert.equal(clean.status, 'strict-reaction-gate-pass');
  assert.equal(clean.strictForceCouplingAllowed, true);
  assert.deepEqual(clean.blockers, []);
  assert.deepEqual(clean.warnings, ['product-raw-mass-scaled-to-consumed-reactant-mass']);

  const residualBlocked = reactionStrictGateFromSummary({
    compactSummary,
    atomResidualSummary: {
      recordCount: 4,
      maxAbsAtomResidualMol: 1e-3,
      chargeResidualMol: 2e-3
    },
    reactionTable: reactionTable()
  });
  assert.equal(residualBlocked.status, 'strict-reaction-gate-blocked');
  assert.deepEqual(residualBlocked.blockers, [
    'atom-residual-out-of-tolerance',
    'charge-residual-out-of-tolerance'
  ]);

  const provisional = reactionStrictGateFromSummary({
    compactSummary,
    atomResidualSummary: {
      recordCount: 4,
      maxAbsAtomResidualMol: 0,
      chargeResidualMol: 0
    },
    reactionTable: {
      ...reactionTable(),
      metadata: [{
        stoichiometry: {
          atomBalance: { balanced: true },
          provisionalEnergeticsStatus: 'provisional-heuristic-not-scientifically-validated'
        },
        energyModel: 'heuristic'
      }]
    }
  });
  assert.equal(provisional.status, 'strict-reaction-gate-blocked');
  assert.deepEqual(provisional.blockers, ['provisional-energetics-not-strict']);
});

test('SPH reaction compact summary runs a two-pass WebGPU reduction without particle readback', async () => {
  const values = new Float32Array([
    65, 1, 2, 1,
    3, 2, 5, 1.5,
    1.5, 10, 9, -1,
    60, 5, 65, 1,
    1, 6, 6, 6.4,
    5.625, 0.375, 0.375, 0,
    0.375, 93.75, 6000, 0.4,
    1, 0, 1, 1
  ]);
  const gasValues = new Float32Array([
    400, 0.375, 93.75, 0, 0.375, 1, 0, 1
  ]);
  const productInventoryValues = new Float32Array([
    300, 5.625, 5.625, 0, 93.75, 1, 0, 0,
    0, 0, 0, 1, 2, 0.03, 5.625, 0.9375,
    400, 0.375, 0, 0.375, 93.75, 1, 1, 0,
    1, 0, 0, 1, 1, 0.004, 0.4, 0.9375
  ]);
  const atomResidualValues = new Float32Array([
    0, 1, -187.5, 0, 1, 1, 0, 1,
    0, 2, -93.75, 0, 1, 1, 1, 1,
    0, 1, 187.5, 0, 1, 2, 0, 1,
    0, 2, 93.75, 0, 1, 2, 1, 1
  ]);
  const productEventValues = new Float32Array(65 * 2 * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);
  productEventValues.set([
    0.5, 0.25, 0, 5.625,
    300, 0, 0, 0,
    1, 93.75, 0, 2,
    5.625, 0, 2, 0.03,
    360, 2130, 1, 0
  ], 0);
  productEventValues.set([
    0.5, 0.25, 0, 0.375,
    400, 1, 0, 0,
    1, 93.75, 1, 3,
    0, 0.375, 1, 0.004,
    360, 0.09, 1, 0
  ], SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);
  const device = fakeSummaryDevice(values, gasValues, productInventoryValues, atomResidualValues, productEventValues);
  const buffer = (label) => ({ label });
  const proposalBuffer = buffer('reaction-proposals');
  const summary = await runSphReactionSummaryWebGpu({
    device,
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 65
    },
    reactionTable: reactionTable(),
    sourceStateBuffer: buffer('source-state'),
    sourceThermoBuffer: buffer('source-thermo'),
    nextStateBuffer: buffer('next-state'),
    nextThermoBuffer: buffer('next-thermo'),
    proposalBuffer,
    readProductEvents: true
  });

  assert.equal(summary.status, 'reaction-compact-summary-ready');
  assert.equal(summary.reductionStrategy, 'two-pass-workgroup-reduction');
  assert.equal(summary.fullParticleReadbackPerformed, false);
  assert.equal(summary.compactReadbackByteLength, 128);
  assert.equal(summary.compactReadbackFloatCount, 32);
  assert.equal(summary.compactPartialSummaryCount, 2);
  assert.equal(summary.compactLedgerProposalBufferBound, true);
  assert.equal(summary.gasSpeciesLedger.schema, ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA);
  assert.equal(summary.gasSpeciesLedgerCount, 1);
  assert.equal(summary.gasSpeciesLedger.bySpecies.c2.massKg, 0.375);
  assert.equal(summary.gasSpeciesLedger.bySpecies.c2.moles, 93.75);
  assert.equal(summary.gasSpeciesReadbackByteLength, 32);
  assert.equal(summary.productInventory.schema, ULG_SPH_GPU_REACTION_PRODUCT_INVENTORY_SCHEMA);
  assert.equal(summary.productInventoryCount, 2);
  assert.equal(summary.productInventory.byMaterial.ab.visibleMassKg, 5.625);
  assert.equal(summary.productInventory.byMaterial.c2.unplacedMassKg, 0.375);
  assert.equal(summary.productInventoryReadbackByteLength, 128);
  assert.equal(summary.productEvents.schema, ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA);
  assert.equal(summary.productEvents.status, 'product-event-sparse-storage-ready');
  assert.equal(summary.productEventRowCount, 130);
  assert.equal(summary.productEventActiveEventCount, 2);
  assert.equal(summary.productEvents.byMaterial.ab.visibleMassKg, 5.625);
  assert.equal(summary.productEvents.byMaterial.c2.unplacedMassKg, 0.375);
  assert.equal(summary.productEventReadbackFloatCount, 65 * 2 * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);
  assert.equal(summary.productEventReadbackByteLength, 65 * 2 * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(summary.productEventBufferByteLength, 65 * 2 * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(summary.productEventWorkgroupCount, 3);
  assert.equal(summary.productEventBufferRetained, false);
  assert.equal(summary.productEventBuffer, null);
  assert.equal(summary.destroyProductEventBuffer, null);
  assert.equal(summary.atomResidualSummary.schema, ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA);
  assert.equal(summary.atomResidualCount, 4);
  assert.equal(summary.atomResidualReadbackByteLength, 128);
  assert.equal(summary.atomResidualSummary.maxAbsAtomResidualMol, 0);
  assert.equal(summary.atomResidualSummary.chargeResidualMol, 0);
  assert.equal(summary.strictReactionGate.status, 'strict-reaction-gate-pass');
  assert.equal(summary.strictReactionGate.strictForceCouplingAllowed, true);
  assert.equal(summary.ledgerUnplacedGasProductMassKg, 0.375);
  assert.equal(summary.sealedBoxGasProductMoles, 93.75);
  assert.deepEqual(device.dispatches.map((dispatch) => dispatch.count), [2, 1, 2, 3, 4, 1]);
  assert.deepEqual(device.bindGroups.map((group) => group.entries.length), [8, 3, 8, 8, 6, 8]);
  assert.equal(device.copies.length, 5);
  assert.equal(device.copies[0].size, 128);
  assert.equal(device.copies[1].size, 65 * 2 * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(device.copies[2].size, 128);
  assert.equal(device.copies[3].size, 32);
  assert.equal(device.copies[4].size, 128);
  assert.equal(device.submissions.length, 1);
  assert.equal(device.shaderModules.length, 6);
  assert.ok(device.writes.some((write) => write.label === 'ulg-sph-reaction-summary-records' && write.byteLength === 120 * 4));
  assert.ok(device.writes.some((write) => write.label === 'ulg-sph-reaction-summary-params' && write.byteLength === 48));
  assert.equal(device.createdBuffers.filter((created) => created.destroyed).length, device.createdBuffers.length);
});

test('SPH reaction product events can remain GPU-resident without product-event readback', async () => {
  const values = new Float32Array([
    65, 1, 2, 1,
    3, 2, 5, 1.5,
    1.5, 10, 9, -1,
    60, 5, 65, 1,
    1, 6, 6, 6.4,
    5.625, 0.375, 0.375, 0,
    0.375, 93.75, 6000, 0.4,
    1, 0, 1, 1
  ]);
  const gasValues = new Float32Array([
    400, 0.375, 93.75, 0, 0.375, 1, 0, 1
  ]);
  const productInventoryValues = new Float32Array([
    300, 5.625, 5.625, 0, 93.75, 1, 0, 0,
    0, 0, 0, 1, 2, 0.03, 5.625, 0.9375,
    400, 0.375, 0, 0.375, 93.75, 1, 1, 0,
    1, 0, 0, 1, 1, 0.004, 0.4, 0.9375
  ]);
  const atomResidualValues = new Float32Array([
    0, 1, -187.5, 0, 1, 1, 0, 1,
    0, 2, -93.75, 0, 1, 1, 1, 1,
    0, 1, 187.5, 0, 1, 2, 0, 1,
    0, 2, 93.75, 0, 1, 2, 1, 1
  ]);
  const device = fakeSummaryDevice(values, gasValues, productInventoryValues, atomResidualValues);
  const buffer = (label) => ({ label });
  const summary = await runSphReactionSummaryWebGpu({
    device,
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 65
    },
    reactionTable: reactionTable(),
    sourceStateBuffer: buffer('source-state'),
    sourceThermoBuffer: buffer('source-thermo'),
    nextStateBuffer: buffer('next-state'),
    nextThermoBuffer: buffer('next-thermo'),
    proposalBuffer: buffer('reaction-proposals'),
    retainProductEventBuffer: true
  });

  assert.equal(summary.productEvents.schema, ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA);
  assert.equal(summary.productEvents.status, 'product-event-sparse-storage-gpu-resident');
  assert.equal(summary.productEventRowCount, 130);
  assert.equal(summary.productEventActiveEventCount, 0);
  assert.equal(summary.productEventReadbackFloatCount, 0);
  assert.equal(summary.productEventReadbackByteLength, 0);
  assert.equal(summary.productEventBufferByteLength, 65 * 2 * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(summary.productEventWorkgroupCount, 3);
  assert.equal(summary.productEventBufferRetained, true);
  assert.equal(summary.productEventBuffer.label, 'ulg-sph-reaction-product-event-out');
  assert.equal(typeof summary.destroyProductEventBuffer, 'function');
  assert.deepEqual(device.dispatches.map((dispatch) => dispatch.count), [2, 1, 2, 3, 4, 1]);
  assert.deepEqual(device.copies.map((copy) => copy.size), [128, 128, 32, 128]);
  assert.equal(device.shaderModules.length, 6);
  const retained = device.createdBuffers.find((created) => created.label === 'ulg-sph-reaction-product-event-out');
  assert.equal(retained.destroyed, false);
  assert.equal(device.createdBuffers.filter((created) => created.destroyed).length, device.createdBuffers.length - 1);
  summary.destroyProductEventBuffer();
  assert.equal(retained.destroyed, true);
});

test('SPH reaction resident product-event mode skips compact summary readbacks', async () => {
  const values = new Float32Array(SPH_GPU_REACTION_SUMMARY_FLOATS);
  const device = fakeSummaryDevice(values);
  const buffer = (label) => ({ label });
  const summary = await runSphReactionSummaryWebGpu({
    device,
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 65
    },
    reactionTable: reactionTable(),
    sourceStateBuffer: buffer('source-state'),
    sourceThermoBuffer: buffer('source-thermo'),
    nextStateBuffer: buffer('next-state'),
    nextThermoBuffer: buffer('next-thermo'),
    proposalBuffer: buffer('reaction-proposals'),
    retainProductEventBuffer: true,
    readCompactSummary: false,
    readGasSpeciesSummary: false,
    readProductInventory: false,
    readAtomResidual: false
  });

  assert.equal(summary.status, 'reaction-resident-product-event-buffer-ready');
  assert.equal(summary.readbackMode, 'resident-product-event-buffer-no-readback');
  assert.equal(summary.reactionSummaryAvailable, false);
  assert.equal(summary.compactSummaryReadbackSkipped, true);
  assert.equal(summary.compactReadbackByteLength, 0);
  assert.equal(summary.gasSpeciesReadbackByteLength, 0);
  assert.equal(summary.productInventoryReadbackByteLength, 0);
  assert.equal(summary.atomResidualReadbackByteLength, 0);
  assert.equal(summary.productEventRowCount, 130);
  assert.equal(summary.productEventBufferRetained, true);
  assert.deepEqual(device.dispatches.map((dispatch) => dispatch.count), [3]);
  assert.deepEqual(device.copies, []);
  assert.equal(device.shaderModules.length, 1);
  assert.equal(device.createdBuffers.some((created) => created.label.includes('summary-readback')), false);
  assert.equal(device.createdBuffers.some((created) => created.label.includes('product-inventory-readback')), false);
  const retained = device.createdBuffers.find((created) => created.label === 'ulg-sph-reaction-product-event-out');
  assert.equal(retained.destroyed, false);
  summary.destroyProductEventBuffer();
  assert.equal(retained.destroyed, true);
});
