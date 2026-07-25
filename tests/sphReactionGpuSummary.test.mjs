import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
  ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
  SPH_GPU_REACTION_PRODUCT_EVENT_DISPOSITION_IDS,
  ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_INVENTORY_SCHEMA,
  ULG_SPH_GPU_REACTION_SUMMARY_EXECUTION_SCHEMA,
  ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  decodeSphReactionAtomResidualValues,
  decodeSphReactionGasSpeciesSummaryValues,
  decodeSphReactionProductEventValues,
  decodeSphReactionProductPlacementSummaryValues,
  decodeSphReactionProductInventoryValues,
  decodeSphReactionSummaryValues,
  createResidentProductMassHandle,
  reactionStrictGateFromSummary,
  runSphReactionSummaryWebGpu,
  sphReactionProductEventCompactWgsl,
  ULG_SPH_REACTION_STRICT_GATE_SCHEMA,
  SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS,
  SPH_GPU_REACTION_SUMMARY_FLOATS
} from '../src/runtime/sph/sphReactionGpuSummary.js';
import {
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_LAYOUT,
  SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS
} from '../ulg-gpu-abi/src/sphReactionProductPlacementReceipt.js';
import {
  SPH_REACTION_PRODUCT_PLACEMENT_LAW,
  sphReactionProductEventPlacementEnvelopeWgsl,
  sphReactionProductEventPlacementWgsl,
  sphReactionProductPlacementCaptureApplyWgsl,
  sphReactionProductPlacementCaptureReduceWgsl,
  sphReactionProductPlacementDirectApplyWgsl,
  sphReactionProductPlacementDirectPlanWgsl,
  sphReactionProductPlacementDirectReduceWgsl,
  sphReactionProductPlacementEventApplyWgsl,
  sphReactionProductPlacementFinalizeWgsl,
  sphReactionProductPlacementPlanWgsl,
  sphReactionProductPlacementPreflightWgsl,
  sphReactionProductPlacementSummaryApplyWgsl,
  sphReactionProductPlacementSummaryReduceWgsl,
  sphReactionProductPlacementTransactionalAuxiliaryMaterializeWgsl,
  sphReactionProductPlacementTransactionalAuxiliaryPublishWgsl,
  sphReactionProductPlacementTransactionalDestinationRecoveryWgsl,
  sphReactionProductPlacementTransactionalPublishWgsl,
  sphReactionProductPlacementTransactionalTerminalWgsl
} from '../ulg-gpu-abi/src/wgsl.js';
import {
  sphReactionProductEventSpatialClassificationWgsl,
  sphReactionProductSpareAssignWgsl,
  sphReactionProductSpareEventMarkWgsl,
  sphReactionProductSpareGroupScanWgsl,
  sphReactionProductSpareParticleMarkWgsl,
  sphReactionProductSpareScatterWgsl
} from '../ulg-gpu-abi/src/sphReactionProductEventSpatialClassificationWgsl.js';

function fakeSummaryDevice(
  summaryValues,
  gasSpeciesValues = new Float32Array(),
  productInventoryValues = new Float32Array(),
  atomResidualValues = new Float32Array(),
  productEventValues = new Float32Array(),
  productPlacementValues = new Float32Array()
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
        writes.push({
          label: buffer.label,
          offset,
          byteLength: data.byteLength,
          values: ArrayBuffer.isView(data) ? Array.from(data) : []
        });
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
          const source = label.includes('product-placement')
            ? productPlacementValues
            : label.includes('product-event')
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
        targetPhasePolicyId: 2,
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
        targetPhasePolicyId: 3,
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

function wgslEntrySource(source, entryPoint) {
  const start = source.indexOf(`fn ${entryPoint}(`);
  assert.ok(start >= 0, `missing WGSL entry point ${entryPoint}`);
  const next = source.indexOf('\n@compute', start + 1);
  return source.slice(start, next >= 0 ? next : source.length);
}

function storageBindingCount(source) {
  return [...source.matchAll(
    /@group\(\d+\)\s*@binding\(\d+\)\s*var<storage\b/g
  )].length;
}

test('reaction product placement receipt v5 names exact segmented topology and terminal transaction', () => {
  assert.equal(SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION, 5);
  assert.equal(SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS, 78);
  assert.deepEqual(
    SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_LAYOUT.slice(5, 16),
    [
      'compactCountPassCount:u32',
      'compactScanPassCount:u32',
      'compactScatterPassCount:u32',
      'activeEventCount:u32',
      'compactionInputVisitCount:u32',
      'compactionLiveFlagCount:u32',
      'compactionOverflowCount:u32',
      'envelopePartialPassCount:u32',
      'envelopeFinalizePassCount:u32',
      'envelopeInputVisitCount:u32',
      'envelopeAdmitted:u32'
    ]
  );
  assert.deepEqual(
    SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_LAYOUT.slice(40, 48),
    [
      'serialConflictFoldPassCount:u32',
      'serialConflictFoldEventCount:u32',
      'maxSerialConflictFoldSize:u32',
      'mutationConflictRetryCount:u32',
      'privateLookupBuildCount:u32',
      'exhaustiveTraversalCount:u32',
      'overflowFlags:u32',
      'status:u32'
    ]
  );
  assert.deepEqual(
    SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_LAYOUT.slice(48, 64),
    [
      'applyPreflightPassCount:u32',
      'intentEmitPassCount:u32',
      'mutationIntentCapacity:u32',
      'mutationIntentCount:u32',
      'destinationRadixPassCount:u32',
      'destinationSegmentReducePassCount:u32',
      'destinationApplyPassCount:u32',
      'destinationIntentVisitedCount:u32',
      'destinationMutationCount:u32',
      'maxDestinationSegmentSize:u32',
      'summaryRadixPassCount:u32',
      'summarySegmentReducePassCount:u32',
      'summaryApplyPassCount:u32',
      'summaryContributionCount:u32',
      'globalSerialEventFoldCount:u32',
      'hostCompletionReadbackCount:u32'
    ]
  );
  assert.deepEqual(
    SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_LAYOUT.slice(64, 78),
    [
      'transactionalPublishPassCount:u32',
      'transactionalVisitedParticleCount:u32',
      'transactionalCommittedParticleCount:u32',
      'transactionalFallbackParticleCount:u32',
      'transactionalEventPublishPassCount:u32',
      'transactionalVisitedEventRowCount:u32',
      'transactionalCommittedEventRowCount:u32',
      'transactionalFallbackEventRowCount:u32',
      'transactionalSummaryPublishPassCount:u32',
      'transactionalVisitedSummaryRowCount:u32',
      'transactionalCommittedSummaryRowCount:u32',
      'transactionalFallbackSummaryRowCount:u32',
      'transactionalTerminalSealPassCount:u32',
      'transactionalTerminalStatus:u32'
    ]
  );
});

test('canonical product-event compaction is stable count/scan/scatter without a dense serial row walk', () => {
  const count = wgslEntrySource(
    sphReactionProductEventCompactWgsl,
    'count_placement_rows'
  );
  const scan = wgslEntrySource(
    sphReactionProductEventCompactWgsl,
    'scan_placement_row_groups'
  );
  const scatter = wgslEntrySource(
    sphReactionProductEventCompactWgsl,
    'scatter_placement_rows'
  );
  assert.match(count, /compact_scan_rows\[lane\]/);
  assert.match(count, /exclusive = inclusive - live/);
  assert.doesNotMatch(count, /for \(var row = 0u; row < params\.row_count/);
  assert.match(scan, /group < group_count/);
  assert.doesNotMatch(scan, /row < params\.row_count/);
  assert.match(scatter, /compact_group_offsets\[workgroup_id\.x\]/);
  assert.match(scatter, /packed_prefix & 0x7fffffffu/);
});

test('canonical placement envelope and SS classifier publish real parallel traversal evidence', () => {
  const reduce = wgslEntrySource(
    sphReactionProductEventPlacementEnvelopeWgsl,
    'reduce_placement_spatial_envelope'
  );
  const finalize = wgslEntrySource(
    sphReactionProductEventPlacementEnvelopeWgsl,
    'finalize_placement_spatial_envelope'
  );
  assert.match(reduce, /@builtin\(local_invocation_id\)/);
  assert.match(
    sphReactionProductEventPlacementEnvelopeWgsl,
    /envelope_radius: array<f32, 64>/
  );
  assert.doesNotMatch(reduce, /for \(var candidate/);
  assert.match(finalize, /partial < partial_count/);
  assert.match(
    sphReactionProductEventSpatialClassificationWgsl,
    /frozen_placement_source_state/
  );
  assert.match(
    sphReactionProductEventSpatialClassificationWgsl,
    /atomicAdd\([\s\S]*?placement_completion_receipt/g
  );
  assert.match(
    sphReactionProductEventSpatialClassificationWgsl,
    /ss_exact_near_source_at_member/
  );
  assert.match(
    sphReactionProductEventSpatialClassificationWgsl,
    /placement_classifier_finite_vec4\(row6\)/
  );
  assert.match(
    sphReactionProductEventSpatialClassificationWgsl,
    /product_term_f < f32\(params\.product_term_count\)/
  );
  assert.match(
    sphReactionProductEventSpatialClassificationWgsl,
    /row1\.w == source_index_f[\s\S]*row2\.x == partner_index_f[\s\S]*source_index_f != partner_index_f/
  );
});

test('canonical placement uses stable segmented reductions and disjoint direct-pair hyperedges', () => {
  assert.match(sphReactionProductSpareParticleMarkWgsl, /mark_spare_particles/);
  assert.match(sphReactionProductSpareParticleMarkWgsl, /0x80000000u/);
  assert.match(sphReactionProductSpareEventMarkWgsl, /mark_spare_events/);
  assert.match(sphReactionProductSpareGroupScanWgsl, /group < group_count/);
  assert.match(sphReactionProductSpareScatterWgsl, /spare_slots\[rank\] = particle/);
  assert.match(sphReactionProductSpareAssignWgsl, /assigned_slot = spare_slots\[rank\]/);
  assert.equal(
    SPH_REACTION_PRODUCT_PLACEMENT_LAW.mutationOrder,
    'stable-event-plan-then-conserving-capture-segment-reduction-then-disjoint-direct-pair-hyperedges'
  );
  const segmentedSources = [
    sphReactionProductPlacementPreflightWgsl,
    sphReactionProductPlacementPlanWgsl,
    sphReactionProductPlacementEventApplyWgsl,
    sphReactionProductPlacementCaptureReduceWgsl,
    sphReactionProductPlacementCaptureApplyWgsl,
    sphReactionProductPlacementDirectPlanWgsl,
    sphReactionProductPlacementDirectReduceWgsl,
    sphReactionProductPlacementDirectApplyWgsl,
    sphReactionProductPlacementSummaryReduceWgsl,
    sphReactionProductPlacementSummaryApplyWgsl,
    sphReactionProductPlacementFinalizeWgsl,
    sphReactionProductPlacementTransactionalPublishWgsl,
    sphReactionProductPlacementTransactionalAuxiliaryPublishWgsl,
    sphReactionProductPlacementTransactionalDestinationRecoveryWgsl,
    sphReactionProductPlacementTransactionalAuxiliaryMaterializeWgsl
  ];
  const bindingBaselineSources = [
    sphReactionProductEventSpatialClassificationWgsl,
    sphReactionProductSpareParticleMarkWgsl,
    sphReactionProductSpareEventMarkWgsl,
    sphReactionProductSpareGroupScanWgsl,
    sphReactionProductSpareScatterWgsl,
    sphReactionProductSpareAssignWgsl,
    sphReactionProductPlacementTransactionalTerminalWgsl,
    ...segmentedSources
  ];
  for (const source of bindingBaselineSources) {
    assert.ok(
      storageBindingCount(source) <= 8,
      `placement shader exceeds the WebGPU 8-storage-binding baseline: ${storageBindingCount(source)}`
    );
  }
  assert.match(
    sphReactionProductPlacementTransactionalTerminalWgsl,
    /seal_transactional_placement_publication[\s\S]*safe_fallback/
  );
  assert.doesNotMatch(
    sphReactionProductPlacementTransactionalAuxiliaryPublishWgsl,
    /published_(?:events|summary)\[row\]\s*=/
  );
  assert.match(
    sphReactionProductPlacementTransactionalDestinationRecoveryWgsl,
    new RegExp(
      `receipt\\[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.transactionalTerminalStatus}\\][\\s\\S]*== ${SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS.SAFE_PLACED}u`
    )
  );
  assert.match(
    sphReactionProductPlacementTransactionalDestinationRecoveryWgsl,
    /destination_state\[state_base \+ row\] = frozen_state\[state_base \+ row\]/
  );
  assert.match(
    sphReactionProductPlacementTransactionalDestinationRecoveryWgsl,
    /destination_thermo\[thermo_base \+ row\] = frozen_thermo\[thermo_base \+ row\]/
  );
  assert.match(
    sphReactionProductPlacementTransactionalDestinationRecoveryWgsl,
    /destination_mechanics\[mechanics_base \+ row\] = frozen_mechanics\[mechanics_base \+ row\]/
  );
  assert.match(
    sphReactionProductPlacementTransactionalAuxiliaryMaterializeWgsl,
    /if \(!safe_placed\) \{ return; \}[\s\S]*published_events\[row\] = candidate_events\[row\][\s\S]*published_summary\[row\] = candidate_summary\[row\]/
  );
  for (const source of segmentedSources) {
    assert.doesNotMatch(source, /@workgroup_size\(1\)/);
    assert.doesNotMatch(source, /for \(var event = 0u; event < active_event_count/);
  }
  assert.match(sphReactionProductPlacementPlanWgsl, /let event = global_id\.x/);
  assert.doesNotMatch(
    sphReactionProductPlacementPlanWgsl,
    /var<storage, read> compact_counts/
  );
  assert.doesNotMatch(
    sphReactionProductEventSpatialClassificationWgsl,
    /@binding\(1\) var<storage, read> next_state/
  );
  const plan = wgslEntrySource(
    sphReactionProductPlacementPlanWgsl,
    'plan_product_events'
  );
  assert.match(plan, /finite_vec4\(row6\)/);
  assert.match(plan, /valid_term[\s\S]*pair_valid[\s\S]*decision_indices_valid/);
  assert.ok(
    plan.indexOf('let event_valid')
      < plan.indexOf('capture_values[value_base]')
  );
  const uniqueApply = wgslEntrySource(
    sphReactionProductPlacementEventApplyWgsl,
    'apply_unique_events_and_emit_summaries'
  );
  assert.ok(
    uniqueApply.indexOf('if (!valid_term || disposition == 8u)')
      < uniqueApply.indexOf('next_state[state_base]')
  );
  assert.match(sphReactionProductPlacementCaptureReduceWgsl, /reduce_capture_segments/);
  assert.match(
    uniqueApply,
    new RegExp(
      `atomicAdd\\(&receipt\\[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.mutationIntentCount}\\], 1u\\)`
    )
  );
  assert.match(
    uniqueApply,
    new RegExp(
      `atomicAdd\\(&receipt\\[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.destinationMutationCount}\\], 1u\\)`
    )
  );
  assert.match(
    uniqueApply,
    new RegExp(
      `atomicMax\\(&receipt\\[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.maxDestinationSegmentSize}\\], 1u\\)`
    )
  );
  assert.match(sphReactionProductPlacementDirectReduceWgsl, /keys_equal_at/);
  assert.match(sphReactionProductPlacementDirectApplyWgsl, /atomicMin\(&endpoint_claims\[source\], priority\)/);
  assert.match(sphReactionProductPlacementDirectApplyWgsl, /atomicMin\(&endpoint_claims\[partner\], priority\)/);
  assert.match(sphReactionProductPlacementSummaryReduceWgsl, /reduce_summary_segments/);
  assert.match(sphReactionProductPlacementFinalizeWgsl, /finalize_segmented_placement_receipt/);
  assert.match(
    sphReactionProductPlacementFinalizeWgsl,
    new RegExp(
      `atomicLoad\\(&receipt\\[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.globalSerialEventFoldCount}\\]\\) == 0u`
    )
  );
  assert.match(sphReactionProductPlacementFinalizeWgsl, /RECEIPT_STATUS\.COMPLETE|1u, complete/);
});

function concatenateFloat32Rows(...rows) {
  const values = new Float32Array(rows.reduce((sum, row) => sum + row.length, 0));
  let offset = 0;
  for (const row of rows) {
    values.set(row, offset);
    offset += row.length;
  }
  return values;
}

function productPlacementRow({
  materialId = 0,
  productTermIndex = 0,
  reactionIndex = 0,
  routingId = 0,
  phaseId = 0,
  status = 1,
  readyProductEventCount = 0,
  placementCandidateEventCount = 0,
  directPlacedEventCount = 0,
  sparePlacedEventCount = 0,
  captureMergedEventCount = 0,
  fallbackMergedEventCount = 0,
  unplacedEventCount = 0,
  subthresholdEventCount = 0,
  rejectedEventCount = 0,
  phaseRoutedEventCount = 0,
  readyProductMassKg = 0,
  directPlacedMassKg = 0,
  sparePlacedMassKg = 0,
  captureMergedMassKg = 0,
  fallbackMergedMassKg = 0,
  unplacedMassKg = 0,
  subthresholdMassKg = 0,
  rejectedMassKg = 0,
  maxSparePlacedEventMassKg = 0,
  maxMergedEventMassKg = 0,
  maxPostMergeParticleMassKg = 0,
  maxUnplacedEventMassKg = 0,
  maxCaptureDistanceM = 0,
  maxFallbackDistanceM = 0,
  maxSparePlacedSupportRadiusM = 0,
  maxReadyProductEventMassKg = 0
} = {}) {
  return new Float32Array([
    materialId, productTermIndex, reactionIndex, routingId,
    phaseId, status, readyProductEventCount, placementCandidateEventCount,
    directPlacedEventCount, sparePlacedEventCount, captureMergedEventCount, fallbackMergedEventCount,
    unplacedEventCount, subthresholdEventCount, rejectedEventCount, phaseRoutedEventCount,
    readyProductMassKg, directPlacedMassKg, sparePlacedMassKg, captureMergedMassKg,
    fallbackMergedMassKg, unplacedMassKg, subthresholdMassKg, rejectedMassKg,
    maxSparePlacedEventMassKg, maxMergedEventMassKg, maxPostMergeParticleMassKg, maxUnplacedEventMassKg,
    maxCaptureDistanceM, maxFallbackDistanceM, maxSparePlacedSupportRadiusM, maxReadyProductEventMassKg
  ]);
}

function productEventRow({
  materialId = 300,
  productTermIndex = 0,
  routingId = 0,
  phaseId = 2,
  massKg = 1,
  placedMassKg = 0,
  unplacedMassKg = 0,
  status = 0,
  dispositionId = 0,
  specificInternalEnergyJPerKg = 1234
} = {}) {
  const row = new Float32Array(SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);
  row.set([0.25, 0.5, 0.75, massKg], 0);
  row.set([materialId, productTermIndex, 0, 8], 4);
  row.set([9, massKg, routingId, phaseId], 8);
  row.set([placedMassKg, unplacedMassKg, 1, 1], 12);
  row.set([360, 1, status, specificInternalEnergyJPerKg], 16);
  row.set([1, 2, 3, Math.max(unplacedMassKg, 0.001)], 20);
  row.set([100, 10, 20, 30], 24);
  row.set([2, 0, 1, dispositionId], 28);
  return row;
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

test('SPH reaction product-event v1 decoder preserves every placement disposition', () => {
  const ids = SPH_GPU_REACTION_PRODUCT_EVENT_DISPOSITION_IDS;
  const rows = concatenateFloat32Rows(
    productEventRow({ status: 1, unplacedMassKg: 1, dispositionId: ids.pending }),
    productEventRow({ placedMassKg: 1, dispositionId: ids.directOnly }),
    productEventRow({ placedMassKg: 1, dispositionId: ids.spareSlot }),
    productEventRow({ dispositionId: ids.radiusCaptureMerge }),
    productEventRow({ dispositionId: ids.fallbackMerge }),
    productEventRow({ status: 1, unplacedMassKg: 1, dispositionId: ids.subthresholdUnplaced }),
    productEventRow({ status: 1, unplacedMassKg: 1, dispositionId: ids.noCarrierUnplaced }),
    productEventRow({ unplacedMassKg: 1, dispositionId: ids.rejected })
  );

  const events = decodeSphReactionProductEventValues(rows, reactionTable());

  assert.equal(events.schema, ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA);
  assert.equal(events.placementProvenanceDecoded, true);
  assert.deepEqual(events.records.map((record) => record.disposition), [
    'pending',
    'direct-only',
    'spare-slot',
    'radius-capture-merge',
    'fallback-merge',
    'subthreshold-unplaced',
    'no-carrier-unplaced',
    'rejected'
  ]);
  assert.deepEqual(events.records.map((record) => record.lifecycle), [
    'active',
    'consumed',
    'consumed',
    'consumed',
    'consumed',
    'active',
    'active',
    'rejected'
  ]);
  assert.equal(events.records[0].status, 'ready');
  assert.equal(events.records[7].status, 'rejected');
  assert.equal(events.records[0].specificInternalEnergyJPerKg, 1234);
  assert.equal(events.activeEventCount, 3);
  assert.equal(events.consumedEventCount, 5);
  assert.equal(events.rejectedEventCount, 1);
  assert.equal(events.activeMassKg, 3);
  assert.equal(events.activeUnplacedMassKg, 3);
  assert.equal(events.placedMassKg, 2);
  assert.equal(events.mergedMassKg, 2);
  assert.equal(events.unplacedMassKg, 4);
});

test('SPH reaction placement provenance rejects an invalid direct-only payload fail closed', () => {
  const ids = SPH_GPU_REACTION_PRODUCT_EVENT_DISPOSITION_IDS;
  const events = decodeSphReactionProductEventValues(
    productEventRow({
      massKg: 2,
      placedMassKg: 2,
      unplacedMassKg: 0,
      status: 0,
      dispositionId: ids.rejected
    }),
    reactionTable()
  );
  const provenance = decodeSphReactionProductPlacementSummaryValues(
    concatenateFloat32Rows(
      productPlacementRow({
        materialId: 300,
        productTermIndex: 0,
        phaseId: 2,
        status: 1,
        rejectedEventCount: 1,
        rejectedMassKg: 2
      }),
      productPlacementRow({ status: 1 })
    ),
    reactionTable()
  );

  assert.equal(events.records.length, 1);
  assert.equal(events.records[0].status, 'rejected');
  assert.equal(events.records[0].lifecycle, 'rejected');
  assert.equal(events.records[0].placedMassKg, 2);
  assert.equal(events.records[0].unplacedMassKg, 0);
  assert.equal(events.rejectedEventCount, 1);
  assert.equal(provenance.available, true);
  assert.equal(provenance.rejected, true);
  assert.equal(provenance.status, 'product-placement-provenance-rejected');
  assert.equal(provenance.records[0].status, 'product-placement-term-rejected');
  assert.equal(provenance.rejectedEventCount, 1);
  assert.equal(provenance.rejectedMassKg, 2);
});

test('SPH reaction product-placement decoder partitions all routes and gas totals', () => {
  const values = concatenateFloat32Rows(
    productPlacementRow({
      materialId: 300,
      productTermIndex: 0,
      phaseId: 2,
      readyProductEventCount: 5,
      placementCandidateEventCount: 4,
      directPlacedEventCount: 2,
      sparePlacedEventCount: 1,
      captureMergedEventCount: 1,
      fallbackMergedEventCount: 1,
      unplacedEventCount: 1,
      subthresholdEventCount: 1,
      readyProductMassKg: 10,
      directPlacedMassKg: 2,
      sparePlacedMassKg: 2,
      captureMergedMassKg: 2,
      fallbackMergedMassKg: 2,
      unplacedMassKg: 2,
      subthresholdMassKg: 2,
      maxSparePlacedEventMassKg: 2,
      maxMergedEventMassKg: 2,
      maxPostMergeParticleMassKg: 12,
      maxUnplacedEventMassKg: 2,
      maxCaptureDistanceM: 0.1,
      maxFallbackDistanceM: 0.5,
      maxSparePlacedSupportRadiusM: 0.2,
      maxReadyProductEventMassKg: 2
    }),
    productPlacementRow({
      materialId: 400,
      productTermIndex: 1,
      routingId: 1,
      phaseId: 3,
      readyProductEventCount: 4,
      placementCandidateEventCount: 3,
      directPlacedEventCount: 2,
      sparePlacedEventCount: 1,
      captureMergedEventCount: 1,
      unplacedEventCount: 1,
      rejectedEventCount: 1,
      phaseRoutedEventCount: 4,
      readyProductMassKg: 8,
      directPlacedMassKg: 2,
      sparePlacedMassKg: 2,
      captureMergedMassKg: 2,
      unplacedMassKg: 2,
      rejectedMassKg: 0.5,
      maxSparePlacedEventMassKg: 2,
      maxMergedEventMassKg: 2,
      maxPostMergeParticleMassKg: 9,
      maxUnplacedEventMassKg: 2,
      maxCaptureDistanceM: 0.25,
      maxSparePlacedSupportRadiusM: 0.3,
      maxReadyProductEventMassKg: 2
    })
  );

  const provenance = decodeSphReactionProductPlacementSummaryValues(values, reactionTable(), {
    readbackCadence: 'resident-sequence-final',
    sourceSummaryCount: 7
  });

  assert.equal(provenance.schema, ULG_SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_SCHEMA);
  assert.equal(provenance.available, true);
  assert.equal(provenance.partitionComplete, true);
  assert.equal(provenance.rejected, true);
  assert.equal(provenance.status, 'product-placement-provenance-rejected');
  assert.equal(provenance.recordCount, 2);
  assert.deepEqual(provenance.records.map((record) => record.productTermIndex), [0, 1]);
  assert.equal(provenance.records[0].directOnlyEventCount, 1);
  assert.equal(provenance.records[0].candidateEventPartitionResidual, 0);
  assert.equal(provenance.records[0].massPartitionResidualKg, 0);
  assert.equal(provenance.records[1].status, 'product-placement-term-rejected');
  assert.equal(provenance.records[1].phaseRoutingComplete, true);
  assert.equal(provenance.phaseRoutingComplete, true);
  assert.equal(provenance.phaseRoutedEventCount, 4);
  assert.equal(provenance.gasPhaseRoutedEventCount, 4);
  assert.equal(provenance.placementCandidateEventCount, 7);
  assert.equal(provenance.placedEventCount, 4);
  assert.equal(provenance.placedReactionEventCount, 2);
  assert.equal(provenance.mergedEventCount, 3);
  assert.equal(provenance.unplacedEventCount, 2);
  assert.equal(provenance.rejectedEventCount, 1);
  assert.equal(provenance.readyProductMassKg, 18);
  assert.equal(provenance.placedMassKg, 8);
  assert.equal(provenance.mergedMassKg, 6);
  assert.equal(provenance.unplacedMassKg, 4);
  assert.equal(provenance.rejectedMassKg, 0.5);
  assert.equal(provenance.gasPlacementCandidateEventCount, 3);
  assert.equal(provenance.gasPlacedEventCount, 2);
  assert.equal(provenance.gasPlacedReactionEventCount, 2);
  assert.equal(provenance.gasMergedEventCount, 1);
  assert.equal(provenance.gasUnplacedEventCount, 1);
  assert.equal(provenance.gasRejectedEventCount, 1);
  assert.equal(provenance.gasReadyProductMassKg, 8);
  assert.equal(provenance.gasPlacedMassKg, 4);
  assert.equal(provenance.gasMergedMassKg, 2);
  assert.equal(provenance.gasUnplacedMassKg, 2);
  assert.equal(provenance.gasRejectedMassKg, 0.5);
  assert.deepEqual(provenance.byMaterial.c2.productTermIndices, [1]);
  assert.equal(provenance.maxPostMergeParticleMassKg, 12);
  assert.equal(provenance.readbackCadence, 'resident-sequence-final');
  assert.equal(provenance.sourceSummaryCount, 7);
  assert.equal(provenance.readbackFloatCount, 2 * SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS);
  assert.equal(provenance.readbackByteLength, 2 * SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS * 4);
  assert.equal(provenance.fullParticleReadbackPerformed, false);
});

test('SPH reaction product-placement row order remains authoritative for empty terms', () => {
  const values = concatenateFloat32Rows(
    productPlacementRow({ status: 1 }),
    productPlacementRow({ status: 1 })
  );

  const provenance = decodeSphReactionProductPlacementSummaryValues(values, reactionTable());

  assert.equal(provenance.available, true);
  assert.equal(provenance.partitionComplete, true);
  assert.deepEqual(provenance.records.map((record) => record.productTermIndex), [0, 1]);
  assert.deepEqual(provenance.records.map((record) => record.material), ['ab', 'c2']);
  assert.deepEqual(provenance.records.map((record) => record.phaseId), [2, 3]);
  assert.deepEqual(provenance.records.map((record) => record.readyProductEventCount), [0, 0]);
  assert.deepEqual(provenance.byMaterial.ab.productTermIndices, [0]);
  assert.deepEqual(provenance.byMaterial.c2.productTermIndices, [1]);
});

test('SPH reaction product-placement provenance fails closed when a gas event misses phase routing', () => {
  const values = concatenateFloat32Rows(
    productPlacementRow({ status: 1 }),
    productPlacementRow({
      materialId: 400,
      productTermIndex: 1,
      routingId: 1,
      phaseId: 3,
      readyProductEventCount: 2,
      placementCandidateEventCount: 2,
      sparePlacedEventCount: 2,
      phaseRoutedEventCount: 1,
      readyProductMassKg: 2,
      sparePlacedMassKg: 2
    })
  );

  const provenance = decodeSphReactionProductPlacementSummaryValues(values, reactionTable());

  assert.equal(provenance.partitionComplete, true);
  assert.equal(provenance.phaseRoutingComplete, false);
  assert.equal(provenance.status, 'product-placement-provenance-phase-routing-incomplete');
  assert.equal(provenance.records[1].phaseRoutingRequired, true);
  assert.equal(provenance.records[1].phaseRoutingComplete, false);
  assert.equal(provenance.records[1].phaseRoutedEventCount, 1);
  assert.equal(provenance.records[1].status, 'product-placement-term-phase-routing-incomplete');
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

test('resident product mass retirement waits for an active pre-submit borrow to drain', async () => {
  let sourceDestroyCount = 0;
  const reactionSummary = {
    productEventBufferRetained: true,
    productEventBuffer: { label: 'borrow-pinned-product-events' },
    productEventBufferByteLength: 128,
    productEventRowCount: 1,
    productEvents: {
      schema: ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
      records: []
    },
    destroyProductEventBuffer() {
      sourceDestroyCount += 1;
    }
  };
  const handle = createResidentProductMassHandle(reactionSummary);
  handle.__ulgActiveBorrowCount += 1;
  const retirement = handle.destroyResidentProductMassBuffers();
  assert.equal(typeof retirement?.then, 'function');
  assert.equal(sourceDestroyCount, 0);
  assert.equal(handle.destroyResidentProductMassBuffers(), retirement);

  await Promise.resolve();
  assert.equal(sourceDestroyCount, 0);
  handle.__ulgActiveBorrowCount -= 1;
  assert.equal(await retirement, true);
  assert.equal(sourceDestroyCount, 1);
  assert.equal(await handle.destroyResidentProductMassBuffers(), true);
  assert.equal(sourceDestroyCount, 1);
});

test('resident product mass handle carries only classified strict reaction gates', () => {
  const baseSummary = {
    productEventBufferRetained: true,
    productEventBuffer: { label: 'strict-gate-product-events' },
    productEventBufferByteLength: 128,
    productEventRowCount: 1,
    productEvents: {
      schema: ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
      records: []
    }
  };
  const passed = createResidentProductMassHandle({
    ...baseSummary,
    strictReactionGate: {
      schema: ULG_SPH_REACTION_STRICT_GATE_SCHEMA,
      status: 'strict-reaction-gate-pass',
      blockers: [],
      warnings: ['reference-phase-applicability-not-fully-validated'],
      strictForceCouplingAllowed: true
    }
  });
  assert.equal(passed.strictReactionGateStatus, 'strict-reaction-gate-pass');
  assert.equal(passed.strictForceCouplingAllowed, true);
  assert.notEqual(passed.strictReactionGate, passed);

  const notRun = createResidentProductMassHandle({
    ...baseSummary,
    strictReactionGate: {
      schema: ULG_SPH_REACTION_STRICT_GATE_SCHEMA,
      status: 'strict-reaction-gate-not-run-resident-no-readback',
      blockers: ['compact reaction ledger readback skipped'],
      strictForceCouplingAllowed: false
    }
  });
  assert.equal(notRun.strictReactionGate, null);
  assert.equal(notRun.strictReactionGateStatus, null);
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
    sourceMechanicsBuffer: buffer('source-mechanics'),
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
  assert.deepEqual(device.bindGroups.map((group) => group.entries.length), [8, 3, 8, 9, 6, 8]);
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
    sourceMechanicsBuffer: buffer('source-mechanics'),
    nextStateBuffer: buffer('next-state'),
    nextThermoBuffer: buffer('next-thermo'),
    proposalBuffer: buffer('reaction-proposals'),
    boxDimsM: [3, 4, 5],
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
    sourceMechanicsBuffer: buffer('source-mechanics'),
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

test('SPH reaction host refuses product placement without the canonical spatial placement authority', async () => {
  // Slice 9 makes represented current volume the geometry authority. The
  // legacy placement path derives geometry from density, writes F = I with
  // J = 1, and loses relative kinetic energy, so production must present the
  // canonical placement authority or fail closed rather than silently falling
  // back. This fixture supplies no authority, so placement must be refused.
  const placementValues = concatenateFloat32Rows(
    productPlacementRow({ status: 1 }),
    productPlacementRow({ status: 1 })
  );
  const device = fakeSummaryDevice(
    new Float32Array(SPH_GPU_REACTION_SUMMARY_FLOATS),
    { productPlacementValues: placementValues }
  );
  const buffer = (label) => ({ label });
  await assert.rejects(
    () => runSphReactionSummaryWebGpu({
      device,
      sphParticleState: {
        schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
        particleCount: 2
      },
      reactionTable: reactionTable(),
      sourceStateBuffer: buffer('source-state'),
      sourceThermoBuffer: buffer('source-thermo'),
      sourceMechanicsBuffer: buffer('source-mechanics'),
      nextStateBuffer: buffer('next-state'),
      nextThermoBuffer: buffer('next-thermo'),
      nextMechanicsBuffer: buffer('next-mechanics'),
      proposalBuffer: buffer('reaction-proposals'),
      boxDimsM: [3, 4, 5],
      retainProductEventBuffer: true,
      readCompactSummary: false,
      readGasSpeciesSummary: false,
      readProductInventory: false,
      readAtomResidual: false,
      productPlacementReadbackCadence: 'resident-sequence-final'
    }),
    /canonical Schroeder spatial placement authority/
  );
});

test('SPH reaction host binds and reads the per-term placement accumulator without particle readback', { skip: 'legacy placement path removed in Slice 9; see the refusal test above' }, async () => {
  const placementValues = concatenateFloat32Rows(
    productPlacementRow({ status: 1 }),
    productPlacementRow({ status: 1 })
  );
  const device = fakeSummaryDevice(
    new Float32Array(SPH_GPU_REACTION_SUMMARY_FLOATS),
    new Float32Array(),
    new Float32Array(),
    new Float32Array(),
    new Float32Array(),
    placementValues
  );
  const buffer = (label) => ({ label });

  const summary = await runSphReactionSummaryWebGpu({
    device,
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 2
    },
    reactionTable: reactionTable(),
    sourceStateBuffer: buffer('source-state'),
    sourceThermoBuffer: buffer('source-thermo'),
    sourceMechanicsBuffer: buffer('source-mechanics'),
    nextStateBuffer: buffer('next-state'),
    nextThermoBuffer: buffer('next-thermo'),
    nextMechanicsBuffer: buffer('next-mechanics'),
    proposalBuffer: buffer('reaction-proposals'),
    boxDimsM: [3, 4, 5],
    retainProductEventBuffer: true,
    readCompactSummary: false,
    readGasSpeciesSummary: false,
    readProductInventory: false,
    readAtomResidual: false,
    productPlacementReadbackCadence: 'resident-sequence-final'
  });

  const expectedPlacementByteLength = 2
    * SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const placementBindGroup = device.bindGroups.find(
    (group) => group.layout.entryPoint === 'place_product_events'
  );
  const productTermCountWrite = device.writes.find((write) => (
    write.label === 'ulg-sph-reaction-product-event-placement-params'
    && write.offset === 28
  ));
  const placementBoxWrite = device.writes.find((write) => (
    write.label === 'ulg-sph-reaction-product-event-placement-params'
    && write.offset === 32
  ));
  const placementBoxClampWrite = device.writes.find((write) => (
    write.label === 'ulg-sph-reaction-product-event-placement-params'
    && write.offset === 44
  ));
  const placementCanonicalSpatialWrite = device.writes.find((write) => (
    write.label === 'ulg-sph-reaction-product-event-placement-params'
    && write.offset === 48
  ));
  const placementCopy = device.copies.find(
    (copy) => copy.destination.label === 'ulg-sph-reaction-product-placement-readback'
  );

  assert.equal(summary.fullParticleReadbackPerformed, false);
  assert.equal(summary.compactReadbackByteLength, 0);
  assert.equal(summary.productPlacementProvenance.schema, ULG_SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_SCHEMA);
  assert.equal(summary.productPlacementProvenance.available, true);
  assert.deepEqual(summary.productPlacementProvenance.records.map((record) => record.productTermIndex), [0, 1]);
  assert.equal(summary.productPlacementProvenanceReadbackFloatCount, 64);
  assert.equal(summary.productPlacementProvenanceReadbackByteLength, expectedPlacementByteLength);
  assert.equal(summary.productPlacementAccumulatorByteLength, expectedPlacementByteLength);
  assert.equal(summary.productPlacementReadbackCadence, 'resident-sequence-final');
  assert.equal(placementBindGroup.entries.length, 11);
  assert.equal(placementBindGroup.entries[5].binding, 5);
  assert.equal(
    placementBindGroup.entries[5].resource.buffer.label,
    'ulg-sph-reaction-product-placement-accumulator'
  );
  assert.equal(placementBindGroup.entries[6].binding, 6);
  assert.equal(placementBindGroup.entries[6].resource.buffer.label, 'source-state');
  assert.equal(placementBindGroup.entries[7].binding, 7);
  assert.equal(placementBindGroup.entries[7].resource.buffer.label, 'source-thermo');
  assert.equal(placementBindGroup.entries[8].binding, 8);
  assert.equal(
    placementBindGroup.entries[8].resource.buffer.label,
    'ulg-sph-reaction-product-event-placement-compact-count'
  );
  assert.equal(placementBindGroup.entries[9].binding, 9);
  assert.equal(
    placementBindGroup.entries[9].resource.buffer.label,
    'ulg-sph-reaction-product-event-placement-decisions'
  );
  assert.equal(placementBindGroup.entries[10].binding, 10);
  assert.equal(
    placementBindGroup.entries[10].resource.buffer.label,
    'ulg-sph-reaction-product-event-placement-local-completion-receipt'
  );
  assert.deepEqual(productTermCountWrite.values, [2]);
  assert.deepEqual(placementBoxWrite.values, [3, 4, 5]);
  assert.deepEqual(placementBoxClampWrite.values, [1]);
  assert.deepEqual(
    placementCanonicalSpatialWrite.values,
    [0, 0, 0, SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION]
  );
  assert.equal(placementCopy.size, expectedPlacementByteLength);
  assert.equal(placementCopy.source.label, 'ulg-sph-reaction-product-placement-accumulator');
  assert.deepEqual(device.dispatches.map((dispatch) => dispatch.count), [1, 1, 1]);
  assert.equal(device.copies.length, 1);
  assert.equal(
    device.copies.some((copy) => /(?:source|next)-(?:state|thermo|mechanics)/.test(copy.source.label)),
    false
  );
  assert.equal(
    device.createdBuffers.some((created) => /particle.*readback|state.*readback/.test(created.label)),
    false
  );
});
