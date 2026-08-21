import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
  ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
  SPH_GPU_REACTION_PRODUCT_EVENT_DISPOSITION_IDS,
  sphReactionStrictGateF32ToBits,
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
  createSphReactionStrictGateProducerShadow,
  createSphReactionStrictGateProducerReceipt,
  createSphReactionStrictGateGpuFinalizePlan,
  createResidentProductMassHandle,
  deriveSphReactionStrictGateStaticBlockerFlags,
  finalizeSphReactionStrictGateCpu,
  hashSphReactionStrictGateF32Rows,
  reactionStrictGateFromSummary,
  resolveSphReactionProductPlacementClassificationProgram,
  runSphReactionSummaryWebGpu,
  sphReactionProductEventCompactWgsl,
  sphReactionStrictGateFinalizeWgsl,
  validateSphReactionStrictGateControl,
  SPH_REACTION_STRICT_GATE_BLOCKER,
  SPH_REACTION_STRICT_GATE_BYTES,
  SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE,
  SPH_REACTION_STRICT_GATE_INDEX,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_STATUS,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION,
  SPH_REACTION_STRICT_GATE_STATUS,
  SPH_REACTION_STRICT_GATE_VERSION,
  ULG_SPH_REACTION_STRICT_GATE_SCHEMA,
  SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS,
  SPH_GPU_REACTION_SUMMARY_FLOATS
} from '../src/runtime/sph/sphReactionGpuSummary.js';
import {
  createQueueOrderedCleanupClaimIssuer,
  registerQueueOrderedCleanupClaim,
  releaseSubmittedWorkCleanupQueueOrdered
} from '../src/runtime/webgpuComputeLayout.js';
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
  createSphReactionProductEventSpatialClassificationWgsl,
  sphReactionProductEventSpatialClassificationV2Wgsl,
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
  productPlacementValues = new Float32Array(),
  {
    throwDestroyOnceLabel = null
  } = {}
) {
  const createdBuffers = [];
  const bindGroups = [];
  const dispatches = [];
  const shaderModules = [];
  const copies = [];
  const submissions = [];
  const writes = [];
  let queueFenceCount = 0;
  let destroyThrowConsumed = false;
  return {
    createdBuffers,
    bindGroups,
    dispatches,
    shaderModules,
    copies,
    submissions,
    writes,
    get queueFenceCount() {
      return queueFenceCount;
    },
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
      },
      onSubmittedWorkDone() {
        queueFenceCount += 1;
        return Promise.resolve();
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
          if (
            label === throwDestroyOnceLabel
            && !destroyThrowConsumed
          ) {
            destroyThrowConsumed = true;
            throw new Error(`injected one-shot destroy failure: ${label}`);
          }
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
    atomTermStrideFloats: SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT.length,
    atomTermLayout: [...SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT],
    atomTermRecords: new Float32Array([
      0, 1, 0, 1, 1, 2, 0, 1,
      0, 1, 1, 2, 1, 1, 0, 1,
      0, 2, 0, 1, 1, 2, 0, 1,
      0, 2, 1, 2, 1, 1, 0, 1
    ]),
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
      reactantTermOffset: 0,
      reactantTermCount: 2,
      productTermOffset: 0,
      productTermCount: 2,
      energyModel: 'atomic-kohn-sham-tight-binding-v0'
    }],
    atomTermMetadata: [
      {
        atomTermIndex: 0,
        reactionIndex: 0,
        termKind: 'reactant',
        termKindId: 1,
        termIndex: 0,
        atomicNumberZ: 1,
        atomsPerFormula: 1,
        coefficient: 2,
        charge: 0,
        material: 'a',
        formula: 'A',
        status: 1
      },
      {
        atomTermIndex: 1,
        reactionIndex: 0,
        termKind: 'reactant',
        termKindId: 1,
        termIndex: 1,
        atomicNumberZ: 2,
        atomsPerFormula: 1,
        coefficient: 1,
        charge: 0,
        material: 'b',
        formula: 'B',
        status: 1
      },
      {
        atomTermIndex: 2,
        reactionIndex: 0,
        termKind: 'product',
        termKindId: 2,
        termIndex: 0,
        atomicNumberZ: 1,
        atomsPerFormula: 1,
        coefficient: 2,
        charge: 0,
        material: 'ab',
        formula: 'AB',
        status: 1
      },
      {
        atomTermIndex: 3,
        reactionIndex: 0,
        termKind: 'product',
        termKindId: 2,
        termIndex: 1,
        atomicNumberZ: 2,
        atomsPerFormula: 1,
        coefficient: 1,
        charge: 0,
        material: 'c2',
        formula: 'C2',
        status: 1
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

test('canonical placement classifier source and host selection match directory ABI exactly', () => {
  assert.match(
    sphReactionProductEventSpatialClassificationWgsl,
    /spatial_expectation: SchroederSpatialExactNearExpectationV1/
  );
  assert.match(
    sphReactionProductEventSpatialClassificationWgsl,
    /SS_EXACT_NEAR_ABI_VERSION_V1: u32 = 1u/
  );
  assert.doesNotMatch(
    sphReactionProductEventSpatialClassificationWgsl,
    /SchroederSpatialExactNearExpectationV2/
  );
  assert.match(
    sphReactionProductEventSpatialClassificationV2Wgsl,
    /spatial_expectation: SchroederSpatialExactNearExpectationV2/
  );
  assert.match(
    sphReactionProductEventSpatialClassificationV2Wgsl,
    /SS_EXACT_NEAR_ABI_VERSION_V2: u32 = 2u/
  );
  assert.doesNotMatch(
    sphReactionProductEventSpatialClassificationV2Wgsl,
    /SchroederSpatialExactNearExpectationV1/
  );
  assert.equal(
    sphReactionProductEventSpatialClassificationWgsl.match(
      /spatial_expectation\.source_count/g
    )?.length,
    3
  );
  assert.doesNotMatch(
    sphReactionProductEventSpatialClassificationWgsl,
    /spatial_expectation\.physical_source_count/
  );
  assert.equal(
    sphReactionProductEventSpatialClassificationV2Wgsl.match(
      /spatial_expectation\.physical_source_count/g
    )?.length,
    3
  );
  assert.doesNotMatch(
    sphReactionProductEventSpatialClassificationV2Wgsl,
    /spatial_expectation\.source_count/
  );
  assert.throws(
    () => createSphReactionProductEventSpatialClassificationWgsl(3),
    /unsupported reaction-product placement directory ABI version/
  );

  const expectationData = new Uint32Array(28);
  const placementV1 = {
    directoryAbiVersion: 1,
    expectationBufferByteLength: expectationData.byteLength,
    generation: { execution: { abiVersion: 1 } },
    authentication: {
      directoryAbiVersion: 1,
      expectationUniformBytes: expectationData.byteLength,
      expectationData
    }
  };
  const placementV2 = {
    ...placementV1,
    directoryAbiVersion: 2,
    generation: { execution: { abiVersion: 2 } },
    authentication: {
      ...placementV1.authentication,
      directoryAbiVersion: 2
    }
  };
  const programV1 =
    resolveSphReactionProductPlacementClassificationProgram(placementV1);
  const programV2 =
    resolveSphReactionProductPlacementClassificationProgram(placementV2);
  assert.equal(programV1.cacheKeySuffix, 'directory-v1');
  assert.equal(programV1.shaderCode, sphReactionProductEventSpatialClassificationWgsl);
  assert.equal(programV2.cacheKeySuffix, 'directory-v2');
  assert.equal(programV2.shaderCode, sphReactionProductEventSpatialClassificationV2Wgsl);

  assert.throws(
    () => resolveSphReactionProductPlacementClassificationProgram({
      ...placementV2,
      directoryAbiVersion: 3
    }),
    {
      code:
        'ERR_SPH_REACTION_PRODUCT_PLACEMENT_CLASSIFICATION_UNSUPPORTED_DIRECTORY_ABI'
    }
  );
  assert.throws(
    () => resolveSphReactionProductPlacementClassificationProgram({
      ...placementV2,
      generation: { execution: { abiVersion: 1 } }
    }),
    {
      code:
        'ERR_SPH_REACTION_PRODUCT_PLACEMENT_CLASSIFICATION_DIRECTORY_ABI_MISMATCH'
    }
  );
  assert.throws(
    () => resolveSphReactionProductPlacementClassificationProgram({
      ...placementV2,
      expectationBufferByteLength: expectationData.byteLength + 4
    }),
    {
      code:
        'ERR_SPH_REACTION_PRODUCT_PLACEMENT_CLASSIFICATION_DIRECTORY_ABI_MISMATCH'
    }
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
  for (const source of [
    sphReactionProductPlacementDirectReduceWgsl,
    sphReactionProductPlacementSummaryReduceWgsl
  ]) {
    assert.doesNotMatch(
      source,
      /output_values\[[^\]]+\]\.[xyzw]{2,4}\s*=/,
      'storage-buffer vector lanes must be replaced with a whole-vector write'
    );
  }
  assert.match(
    sphReactionProductPlacementDirectReduceWgsl,
    /output_values\[out\] = vec4<f32>\(current\.x \+ prior\.x, selected\.yzw\)/
  );
  assert.match(
    sphReactionProductPlacementSummaryReduceWgsl,
    /output_values\[out \+ 1u\] = vec4<f32>\(/
  );
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

function strictGateAtomTermAuthority(atomResidualValues) {
  const authority = new Float32Array(atomResidualValues.length);
  for (let offset = 0; offset < atomResidualValues.length; offset += 8) {
    authority.set([
      atomResidualValues[offset],
      atomResidualValues[offset + 5],
      atomResidualValues[offset + 6],
      atomResidualValues[offset + 1],
      1,
      1,
      0,
      atomResidualValues[offset + 7]
    ], offset);
  }
  return authority;
}

function finalizeStrictGateFixture({
  atomResidualValues,
  atomTermValues = strictGateAtomTermAuthority(atomResidualValues),
  receiptAtomResidualValues = atomResidualValues,
  receiptAtomTermValues = atomTermValues,
  producerShadowWords = undefined,
  reactionCount = 1,
  atomTermCount = atomResidualValues.length / 8,
  atomResidualCapacity = atomResidualValues.length / 8,
  atomTermCapacity = atomTermValues.length / 8,
  receiptSourceGeneration = 17,
  receiptCompletionGeneration = 18,
  receiptSeal = 19,
  expectedSourceGeneration = receiptSourceGeneration,
  expectedCompletionGeneration = receiptCompletionGeneration,
  expectedSeal = receiptSeal,
  receiptReactionCount = reactionCount,
  receiptAtomTermCount = atomTermCount,
  receiptAtomResidualCapacity = atomResidualCapacity,
  receiptAtomTermCapacity = atomTermCapacity,
  ...overrides
}) {
  const resolvedProducerShadowWords = producerShadowWords === undefined
    ? createSphReactionStrictGateProducerShadow({
        atomResidualValues: receiptAtomResidualValues,
        atomTermValues: receiptAtomTermValues,
        atomTermCount: receiptAtomTermCount
      })
    : producerShadowWords;
  const producerReceipt = createSphReactionStrictGateProducerReceipt({
    atomResidualValues: receiptAtomResidualValues,
    atomTermValues: receiptAtomTermValues,
    producerShadowWords: resolvedProducerShadowWords,
    sourceGeneration: receiptSourceGeneration,
    completionGeneration: receiptCompletionGeneration,
    seal: receiptSeal,
    reactionCount: receiptReactionCount,
    atomTermCount: receiptAtomTermCount,
    atomResidualCapacity: receiptAtomResidualCapacity,
    atomTermCapacity: receiptAtomTermCapacity,
    producerSequence: 20
  });
  return finalizeSphReactionStrictGateCpu({
    atomResidualValues,
    atomTermValues,
    producerShadowWords: resolvedProducerShadowWords,
    producerReceipt,
    reactionCount,
    atomTermCount,
    atomResidualCapacity,
    atomTermCapacity,
    expectedSourceGeneration,
    expectedCompletionGeneration,
    expectedSeal,
    ...overrides
  });
}

test('GPU strict-gate CPU oracle authenticates exact atom-term rows and fails closed', () => {
  const balancedRows = new Float32Array([
    0, 11, -2, -1, 1, 1, 0, 1,
    0, 8, -1, -1, 1, 1, 1, 1,
    0, 11, 2, 1, 1, 2, 0, 1,
    0, 8, 1, 1, 1, 2, 1, 1
  ]);
  const finalize = (overrides = {}) => finalizeStrictGateFixture({
    atomResidualValues: overrides.atomResidualValues ?? balancedRows,
    ...overrides
  });
  const passed = finalize();
  assert.equal(passed.pass, true);
  assert.equal(passed.blockerFlags, 0);
  assert.deepEqual(passed.atomResidualMolByReactionAndZ, {
    0: { 8: 0, 11: 0 }
  });
  assert.deepEqual(passed.chargeResidualMolByReaction, { 0: 0 });
  assert.equal(passed.maxAbsAtomResidualMol, 0);
  assert.equal(passed.maxAbsChargeResidualMol, 0);
  assert.equal(passed.controlWords.byteLength, SPH_REACTION_STRICT_GATE_BYTES);
  assert.equal(
    validateSphReactionStrictGateControl(passed.controlWords, {
      sourceGeneration: 17,
      completionGeneration: 18,
      seal: 19,
      reactionCount: 1,
      atomTermCount: 4,
      atomResidualCapacity: 4,
      atomTermCapacity: 4,
      atomResidualStrideVec4: 2,
      atomTermStrideVec4: 2,
      atomResidualToleranceMol: 1e-6,
      chargeResidualToleranceMol: 1e-6,
      gateVersion: SPH_REACTION_STRICT_GATE_VERSION,
      producerReceiptVersion: SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION,
      producerReceipt: passed.producerReceipt
    }).pass,
    true
  );

  const driftRows = balancedRows.slice();
  driftRows[18] += 1e-3;
  assert.notEqual(
    finalize({ atomResidualValues: driftRows }).blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.ATOM_RESIDUAL_OUT_OF_TOLERANCE,
    0
  );
  const chargedRows = balancedRows.slice();
  chargedRows[19] += 1e-3;
  assert.notEqual(
    finalize({ atomResidualValues: chargedRows }).blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.CHARGE_RESIDUAL_OUT_OF_TOLERANCE,
    0
  );
  const problemRows = balancedRows.slice();
  problemRows[31] = 0;
  assert.notEqual(
    finalize({ atomResidualValues: problemRows }).blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.PROBLEM_ROW,
    0
  );
  const nonfiniteRows = balancedRows.slice();
  nonfiniteRows[2] = Number.NaN;
  assert.notEqual(
    finalize({ atomResidualValues: nonfiniteRows }).blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.NONFINITE_EVIDENCE,
    0
  );
  assert.notEqual(
    finalize({
      atomResidualValues: balancedRows.slice(0, 24),
      atomTermCount: 4
    }).blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE,
    0
  );
  assert.notEqual(
    finalize({ expectedSourceGeneration: 99 }).blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.GENERATION_MISMATCH,
    0
  );
  assert.notEqual(
    finalize({ expectedSeal: 99 }).blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.SEAL_MISMATCH,
    0
  );
  assert.notEqual(
    finalize({
      staticBlockerFlags: SPH_REACTION_STRICT_GATE_BLOCKER.PROVISIONAL_ENERGETICS
    }).blockerFlags & SPH_REACTION_STRICT_GATE_BLOCKER.PROVISIONAL_ENERGETICS,
    0
  );
  assert.notEqual(
    finalize({ expectedSourceGeneration: '17' }).blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.GENERATION_MISMATCH,
    0
  );
  assert.notEqual(
    finalize({ expectedSeal: '19' }).blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.SEAL_MISMATCH,
    0
  );
  assert.notEqual(
    finalize({ reactionCount: '1' }).blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH,
    0
  );
  assert.notEqual(
    finalize({ atomResidualToleranceMol: '0.001' }).blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID,
    0
  );
});

test('GPU strict-gate validation binds the exact independently expected tolerance policy', () => {
  const passed = finalizeStrictGateFixture({
    atomResidualValues: new Float32Array([
      0, 1, 0, 0, 1, 1, 0, 1
    ])
  });
  assert.equal(passed.pass, true);
  const expectedAuthority = {
    sourceGeneration: 17,
    completionGeneration: 18,
    seal: 19,
    reactionCount: 1,
    atomTermCount: 1,
    atomResidualCapacity: 1,
    atomTermCapacity: 1,
    atomResidualStrideVec4: 2,
    atomTermStrideVec4: 2,
    atomResidualToleranceMol: 1e-6,
    chargeResidualToleranceMol: 1e-6,
    gateVersion: SPH_REACTION_STRICT_GATE_VERSION,
    producerReceiptVersion: SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION,
    producerReceipt: passed.producerReceipt
  };
  assert.equal(validateSphReactionStrictGateControl(
    passed.controlWords,
    expectedAuthority
  ).pass, true);

  for (const producerReceipt of [0, false, '', Number.NaN]) {
    const validation = validateSphReactionStrictGateControl(
      passed.controlWords,
      {
        ...expectedAuthority,
        producerReceipt,
        requireExpectedAuthority: false
      }
    );
    assert.equal(validation.valid, false);
    assert.equal(validation.pass, false);
    assert.ok(validation.reasons.includes(
      'producer-producer-receipt-byte-length-mismatch'
    ));
  }

  for (const [field, toleranceName] of [
    [SPH_REACTION_STRICT_GATE_INDEX.atomResidualToleranceMol,
      'atomResidualToleranceMol'],
    [SPH_REACTION_STRICT_GATE_INDEX.chargeResidualToleranceMol,
      'chargeResidualToleranceMol']
  ]) {
    const replayedLoosePolicy = passed.controlWords.slice();
    replayedLoosePolicy[field] = sphReactionStrictGateF32ToBits(1);
    const validation = validateSphReactionStrictGateControl(
      replayedLoosePolicy,
      expectedAuthority
    );
    assert.equal(validation.authorityBound, true);
    assert.equal(validation.pass, false);
    assert.ok(validation.reasons.includes(`${toleranceName}-mismatch`));
  }

  const {
    atomResidualToleranceMol: _omittedAtomTolerance,
    chargeResidualToleranceMol: _omittedChargeTolerance,
    ...missingToleranceAuthority
  } = expectedAuthority;
  const missingToleranceValidation = validateSphReactionStrictGateControl(
    passed.controlWords,
    missingToleranceAuthority
  );
  assert.equal(missingToleranceValidation.authorityBound, false);
  assert.equal(missingToleranceValidation.pass, false);
  assert.ok(missingToleranceValidation.reasons.includes(
    'expected-atomResidualToleranceMol-required'
  ));
  assert.ok(missingToleranceValidation.reasons.includes(
    'expected-chargeResidualToleranceMol-required'
  ));
});

test('GPU strict-gate uses deterministic binary32 sums at rounding, subnormal, and overflow edges', () => {
  const nextAfterOne = Math.fround(1 + 2 ** -23);
  const tieRoundsUp = finalizeStrictGateFixture({
    atomResidualValues: new Float32Array([
      0, 1, nextAfterOne, 0, 1, 1, 0, 1,
      0, 1, 2 ** -24, 0, 1, 2, 0, 1
    ]),
    atomResidualToleranceMol: nextAfterOne
  });
  assert.equal(tieRoundsUp.maxAbsAtomResidualMol, Math.fround(
    1 + 2 * (2 ** -23)
  ));
  assert.notEqual(
    tieRoundsUp.blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.ATOM_RESIDUAL_OUT_OF_TOLERANCE,
    0
  );

  const minimumSubnormal = new Float32Array(Uint32Array.of(1).buffer)[0];
  const subnormal = finalizeStrictGateFixture({
    atomResidualValues: new Float32Array([
      0, 1, minimumSubnormal, 0, 1, 1, 0, 1
    ]),
    atomResidualToleranceMol: 0
  });
  assert.equal(subnormal.maxAbsAtomResidualMol, minimumSubnormal);
  assert.notEqual(
    subnormal.blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.ATOM_RESIDUAL_OUT_OF_TOLERANCE,
    0
  );

  const maximumFinite = new Float32Array(
    Uint32Array.of(0x7f7f_ffff).buffer
  )[0];
  const overflow = finalizeStrictGateFixture({
    atomResidualValues: new Float32Array([
      0, 1, maximumFinite, 0, 1, 1, 0, 1,
      0, 1, maximumFinite, 0, 1, 2, 0, 1
    ]),
    atomResidualToleranceMol: maximumFinite
  });
  assert.notEqual(
    overflow.blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.NONFINITE_EVIDENCE,
    0
  );
  assert.equal(overflow.pass, false);
});

test('GPU strict-gate oracle cannot cancel atom or charge drift across reactions', () => {
  const finalize = (atomResidualValues) => finalizeStrictGateFixture({
    atomResidualValues,
    reactionCount: 2,
    atomTermCount: 2,
    receiptSourceGeneration: 21,
    receiptCompletionGeneration: 22,
    receiptSeal: 23
  });
  const atomCancellation = finalize(new Float32Array([
    0, 1, 1, 0, 1, 1, 0, 1,
    1, 1, -1, 0, 1, 1, 0, 1
  ]));
  assert.equal(atomCancellation.pass, false);
  assert.equal(atomCancellation.maxAbsAtomResidualMol, 1);
  assert.deepEqual(atomCancellation.atomResidualMolByReactionAndZ, {
    0: { 1: 1 },
    1: { 1: -1 }
  });
  assert.notEqual(
    atomCancellation.blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.ATOM_RESIDUAL_OUT_OF_TOLERANCE,
    0
  );

  const chargeCancellation = finalize(new Float32Array([
    0, 1, 0, 1, 1, 1, 0, 1,
    1, 1, 0, -1, 1, 1, 0, 1
  ]));
  assert.equal(chargeCancellation.pass, false);
  assert.equal(chargeCancellation.maxAbsChargeResidualMol, 1);
  assert.equal(
    chargeCancellation.validation.control.maxAbsChargeResidualMol,
    1
  );
  assert.equal(chargeCancellation.validation.valid, true);
  assert.deepEqual(chargeCancellation.chargeResidualMolByReaction, {
    0: 1,
    1: -1
  });
  assert.notEqual(
    chargeCancellation.blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.CHARGE_RESIDUAL_OUT_OF_TOLERANCE,
    0
  );

  const outOfOrder = finalize(new Float32Array([
    1, 1, 0, 0, 1, 1, 0, 1,
    0, 1, 0, 0, 1, 1, 0, 1
  ]));
  assert.equal(outOfOrder.pass, false);
  assert.notEqual(
    outOfOrder.blockerFlags & SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH,
    0
  );

  const uncoveredReaction = finalizeStrictGateFixture({
    atomResidualValues: new Float32Array([
      0, 1, 0, 0, 1, 1, 0, 1
    ]),
    reactionCount: 2,
    atomTermCount: 1,
    receiptSourceGeneration: 21,
    receiptCompletionGeneration: 22,
    receiptSeal: 23
  });
  assert.equal(uncoveredReaction.pass, false);
  assert.notEqual(
    uncoveredReaction.blockerFlags & SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE,
    0
  );
});

test('GPU strict-gate rejects duplicate, relabelled, stale, and copied evidence', () => {
  const canonicalEvidence = new Float32Array([
    0, 1, 0, 0, 1, 1, 0, 1,
    0, 8, 0, 0, 1, 2, 0, 1
  ]);
  const canonicalAuthority = strictGateAtomTermAuthority(canonicalEvidence);
  const passed = finalizeStrictGateFixture({
    atomResidualValues: canonicalEvidence,
    atomTermValues: canonicalAuthority
  });
  assert.equal(passed.pass, true);

  const duplicated = canonicalEvidence.slice();
  duplicated.set(duplicated.subarray(0, 8), 8);
  const duplicateResult = finalizeStrictGateFixture({
    atomResidualValues: duplicated,
    atomTermValues: canonicalAuthority
  });
  assert.equal(duplicateResult.pass, false);
  assert.notEqual(
    duplicateResult.blockerFlags & SPH_REACTION_STRICT_GATE_BLOCKER.PROBLEM_ROW,
    0
  );

  const relabelled = canonicalEvidence.slice();
  relabelled[2] = 1;
  relabelled[9] = 1;
  relabelled[10] = -1;
  const relabelledResult = finalizeStrictGateFixture({
    atomResidualValues: relabelled,
    atomTermValues: canonicalAuthority
  });
  assert.equal(relabelledResult.pass, false);
  assert.notEqual(
    relabelledResult.blockerFlags & SPH_REACTION_STRICT_GATE_BLOCKER.PROBLEM_ROW,
    0
  );

  const staleReceiptResult = finalizeStrictGateFixture({
    atomResidualValues: canonicalEvidence,
    atomTermValues: canonicalAuthority,
    receiptSourceGeneration: 17,
    expectedSourceGeneration: 117
  });
  assert.equal(staleReceiptResult.pass, false);
  assert.notEqual(
    staleReceiptResult.blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.GENERATION_MISMATCH,
    0
  );

  const changedEvidence = canonicalEvidence.slice();
  changedEvidence[9] = 2;
  const changedAuthority = strictGateAtomTermAuthority(changedEvidence);
  const copiedReceiptResult = finalizeStrictGateFixture({
    atomResidualValues: changedEvidence,
    atomTermValues: changedAuthority,
    receiptAtomResidualValues: canonicalEvidence,
    receiptAtomTermValues: canonicalAuthority
  });
  assert.equal(copiedReceiptResult.pass, false);
  assert.notEqual(
    copiedReceiptResult.blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.BITWISE_SHADOW_MISMATCH,
    0
  );

  assert.equal(validateSphReactionStrictGateControl(passed.controlWords).pass, false);
  const missingCapacityStrideExpectations = validateSphReactionStrictGateControl(
    passed.controlWords,
    {
      sourceGeneration: 17,
      completionGeneration: 18,
      seal: 19,
      reactionCount: 1,
      atomTermCount: 2,
      atomResidualToleranceMol: 1e-6,
      chargeResidualToleranceMol: 1e-6,
      gateVersion: SPH_REACTION_STRICT_GATE_VERSION,
      producerReceiptVersion: SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION,
      producerReceipt: passed.producerReceipt
    }
  );
  assert.equal(missingCapacityStrideExpectations.pass, false);
  assert.ok(missingCapacityStrideExpectations.reasons.some((reason) =>
    reason.includes('expected-atomResidualCapacity-required')
  ));
  assert.ok(missingCapacityStrideExpectations.reasons.some((reason) =>
    reason.includes('expected-atomTermStrideVec4-required')
  ));
  const impossibleZeroReaction = passed.controlWords.slice();
  impossibleZeroReaction[SPH_REACTION_STRICT_GATE_INDEX.reactionCount] = 0;
  assert.equal(validateSphReactionStrictGateControl(impossibleZeroReaction, {
    sourceGeneration: 17,
    completionGeneration: 18,
    seal: 19,
    reactionCount: 0,
    atomTermCount: 2,
    atomResidualCapacity: 2,
    atomTermCapacity: 2,
    atomResidualStrideVec4: 2,
    atomTermStrideVec4: 2,
    atomResidualToleranceMol: 1e-6,
    chargeResidualToleranceMol: 1e-6,
    gateVersion: SPH_REACTION_STRICT_GATE_VERSION,
    producerReceiptVersion: SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION,
    producerReceipt: passed.producerReceipt
  }).pass, false);
});

test('GPU strict-gate rejects signed-zero identity aliases before aggregation', () => {
  const canonicalEvidence = new Float32Array([
    0, 1, 0, 0, 1, 1, 0, 1
  ]);
  const canonicalAuthority = strictGateAtomTermAuthority(canonicalEvidence);
  for (const [residualLane, authorityLane, label] of [
    [0, 0, 'reaction index'],
    [6, 2, 'term index']
  ]) {
    const signedZeroEvidence = canonicalEvidence.slice();
    signedZeroEvidence[residualLane] = -0;
    const crossPlaneResult = finalizeStrictGateFixture({
      atomResidualValues: signedZeroEvidence,
      atomTermValues: canonicalAuthority
    });
    assert.equal(crossPlaneResult.pass, false, label);
    assert.notEqual(
      crossPlaneResult.blockerFlags & SPH_REACTION_STRICT_GATE_BLOCKER.PROBLEM_ROW,
      0,
      label
    );
    assert.equal(
      crossPlaneResult.blockerFlags
        & SPH_REACTION_STRICT_GATE_BLOCKER.BITWISE_SHADOW_MISMATCH,
      0,
      `${label} must be rejected even when both shadow planes are authentic`
    );

    const signedZeroAuthority = canonicalAuthority.slice();
    signedZeroAuthority[authorityLane] = -0;
    const canonicalizationResult = finalizeStrictGateFixture({
      atomResidualValues: signedZeroEvidence,
      atomTermValues: signedZeroAuthority
    });
    assert.equal(canonicalizationResult.pass, false, `${label} canonicalization`);
    assert.notEqual(
      canonicalizationResult.blockerFlags
        & SPH_REACTION_STRICT_GATE_BLOCKER.PROBLEM_ROW,
      0,
      `${label} canonicalization`
    );
  }
});

test('GPU strict-gate exact shadows reject concrete FNV checksum collisions', () => {
  const canonicalEvidence = new Float32Array([
    0, 1, 0, 0, 1, 1, 0, 1,
    0, 1, 0, 0, 1, 2, 0, 1
  ]);
  const collidingEvidence = new Float32Array([
    0, 1, 0, 0, 24, 1, 0, 1,
    0, 1, 0, 0, 384, 2, 0, 1
  ]);
  assert.equal(
    hashSphReactionStrictGateF32Rows(canonicalEvidence, 2),
    0x85e9_1905
  );
  assert.equal(
    hashSphReactionStrictGateF32Rows(collidingEvidence, 2),
    0x85e9_1905
  );
  const evidenceCollision = finalizeStrictGateFixture({
    atomResidualValues: collidingEvidence,
    receiptAtomResidualValues: canonicalEvidence
  });
  assert.equal(evidenceCollision.pass, false);
  assert.notEqual(
    evidenceCollision.blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.BITWISE_SHADOW_MISMATCH,
    0
  );

  const canonicalAuthority = new Float32Array([
    0, 1, 0, 1, 1, 1, 0, 1,
    0, 2, 0, 1, 1, 1, 0, 1
  ]);
  const collidingAuthority = new Float32Array([
    0, 1, 0, 1, 1, 1, -999935, 1,
    0, 2, 0, 1, 1, 1, 969331, 1
  ]);
  assert.equal(
    hashSphReactionStrictGateF32Rows(canonicalAuthority, 2),
    0x29e9_1905
  );
  assert.equal(
    hashSphReactionStrictGateF32Rows(collidingAuthority, 2),
    0x29e9_1905
  );
  const authorityCollision = finalizeStrictGateFixture({
    atomResidualValues: canonicalEvidence,
    atomTermValues: collidingAuthority,
    receiptAtomTermValues: canonicalAuthority
  });
  assert.equal(authorityCollision.pass, false);
  assert.notEqual(
    authorityCollision.blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.BITWISE_SHADOW_MISMATCH,
    0
  );

  const missingShadow = finalizeStrictGateFixture({
    atomResidualValues: canonicalEvidence,
    atomTermValues: canonicalAuthority,
    producerShadowWords: null
  });
  assert.equal(missingShadow.pass, false);
  assert.notEqual(
    missingShadow.blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE,
    0
  );
});

test('GPU strict-gate exact shadow authenticates every lane and exact planar layout', () => {
  const canonicalEvidence = new Float32Array([
    0, 1, 0, 0, 1, 1, 0, 1,
    0, 8, 0, 0, 1, 2, 0, 1
  ]);
  const canonicalAuthority = strictGateAtomTermAuthority(canonicalEvidence);
  const assertShadowBlocked = (result, message) => {
    assert.equal(result.pass, false, message);
    assert.notEqual(
      result.blockerFlags
        & SPH_REACTION_STRICT_GATE_BLOCKER.BITWISE_SHADOW_MISMATCH,
      0,
      message
    );
    assert.notEqual(
      result.blockerFlags & SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE,
      0,
      message
    );
  };

  for (let lane = 0; lane < 16; lane += 1) {
    const liveEvidence = canonicalEvidence.slice();
    const liveAuthority = canonicalAuthority.slice();
    const liveWords = lane < 8
      ? new Uint32Array(liveEvidence.buffer)
      : new Uint32Array(liveAuthority.buffer);
    const wordIndex = lane < 8 ? lane : lane - 8;
    liveWords[wordIndex] = (liveWords[wordIndex] ^ 1) >>> 0;
    assertShadowBlocked(finalizeStrictGateFixture({
      atomResidualValues: liveEvidence,
      atomTermValues: liveAuthority,
      receiptAtomResidualValues: canonicalEvidence,
      receiptAtomTermValues: canonicalAuthority
    }), `lane ${lane} must be bitwise authenticated`);
  }

  const negativeZeroEvidence = canonicalEvidence.slice();
  new Uint32Array(negativeZeroEvidence.buffer)[2] = 0x8000_0000;
  assertShadowBlocked(finalizeStrictGateFixture({
    atomResidualValues: negativeZeroEvidence,
    atomTermValues: canonicalAuthority,
    receiptAtomResidualValues: canonicalEvidence,
    receiptAtomTermValues: canonicalAuthority
  }), '+0 and -0 must not authenticate as the same evidence');

  const canonicalNanEvidence = canonicalEvidence.slice();
  const differentNanEvidence = canonicalEvidence.slice();
  new Uint32Array(canonicalNanEvidence.buffer)[2] = 0x7fc0_0001;
  new Uint32Array(differentNanEvidence.buffer)[2] = 0x7fc0_0002;
  const canonicalNanAuthority = strictGateAtomTermAuthority(canonicalNanEvidence);
  assertShadowBlocked(finalizeStrictGateFixture({
    atomResidualValues: differentNanEvidence,
    atomTermValues: canonicalNanAuthority,
    receiptAtomResidualValues: canonicalNanEvidence,
    receiptAtomTermValues: canonicalNanAuthority
  }), 'distinct NaN payloads must not authenticate');

  const permutedEvidence = new Float32Array([
    ...canonicalEvidence.subarray(8, 16),
    ...canonicalEvidence.subarray(0, 8)
  ]);
  const permutedAuthority = new Float32Array([
    ...canonicalAuthority.subarray(8, 16),
    ...canonicalAuthority.subarray(0, 8)
  ]);
  assertShadowBlocked(finalizeStrictGateFixture({
    atomResidualValues: permutedEvidence,
    atomTermValues: permutedAuthority,
    receiptAtomResidualValues: canonicalEvidence,
    receiptAtomTermValues: canonicalAuthority
  }), 'row permutations must not authenticate');

  const canonicalShadow = createSphReactionStrictGateProducerShadow({
    atomResidualValues: canonicalEvidence,
    atomTermValues: canonicalAuthority,
    atomTermCount: 2
  });
  const extendedShadow = new Uint32Array(canonicalShadow.length + 1);
  extendedShadow.set(canonicalShadow);
  for (const malformedShadow of [
    canonicalShadow.slice(0, -1),
    extendedShadow
  ]) {
    const result = finalizeStrictGateFixture({
      atomResidualValues: canonicalEvidence,
      atomTermValues: canonicalAuthority,
      producerShadowWords: malformedShadow
    });
    assert.equal(result.pass, false);
    assert.notEqual(
      result.blockerFlags & SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH,
      0
    );
  }
  const validReceipt = createSphReactionStrictGateProducerReceipt({
    atomResidualValues: canonicalEvidence,
    atomTermValues: canonicalAuthority,
    producerShadowWords: canonicalShadow,
    sourceGeneration: 17,
    completionGeneration: 18,
    seal: 19,
    reactionCount: 1,
    atomTermCount: 2,
    atomResidualCapacity: 2,
    atomTermCapacity: 2,
    producerSequence: 20
  });
  const swappedShadow = new Uint32Array(canonicalShadow.length);
  swappedShadow.set(canonicalShadow.subarray(16), 0);
  swappedShadow.set(canonicalShadow.subarray(0, 16), 16);
  assertShadowBlocked(finalizeStrictGateFixture({
    atomResidualValues: canonicalEvidence,
    atomTermValues: canonicalAuthority,
    producerShadowWords: swappedShadow,
    producerReceipt: validReceipt
  }), 'swapped shadow planes must not authenticate');
  for (const receiptIndex of [
    SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.shadowPlaneWordCount,
    SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.shadowLogicalWordCount
  ]) {
    const malformedReceipt = validReceipt.slice();
    malformedReceipt[receiptIndex] += 1;
    const result = finalizeStrictGateFixture({
      atomResidualValues: canonicalEvidence,
      atomTermValues: canonicalAuthority,
      producerShadowWords: canonicalShadow,
      producerReceipt: malformedReceipt
    });
    assert.equal(result.pass, false);
    assert.notEqual(
      result.blockerFlags & SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH,
      0
    );
    assert.ok(result.producerReceiptValidation.reasons.includes(
      'producer-receipt-shadow-layout-invalid'
    ));
  }
  const v1Receipt = validReceipt.slice();
  v1Receipt[SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.version] = 1;
  assert.equal(finalizeStrictGateFixture({
    atomResidualValues: canonicalEvidence,
    atomTermValues: canonicalAuthority,
    producerShadowWords: canonicalShadow,
    producerReceipt: v1Receipt
  }).pass, false);
});

test('GPU strict-gate CPU oracle mirrors WGSL receipt blocker classification', () => {
  const atomResidualValues = new Float32Array([
    0, 8, 0, 0, 1, 1, 0, 1,
    0, 8, 0, 0, 1, 2, 0, 1
  ]);
  const baseline = finalizeStrictGateFixture({ atomResidualValues });
  assert.equal(baseline.pass, true);

  const missingAndLayout = (
    SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
    | SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH
  ) >>> 0;
  const cases = [
    {
      id: 'status-not-ready',
      mutate(receipt) {
        receipt[SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.statusFlags] =
          SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_STATUS.BLOCKED
          | SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_STATUS.FAIL_CLOSED;
      },
      expectedBlockers: missingAndLayout,
      expectedReadyRows: 0
    },
    {
      id: 'producer-blocker-present',
      mutate(receipt) {
        receipt[SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.blockerFlags] =
          SPH_REACTION_STRICT_GATE_BLOCKER.PROBLEM_ROW;
      },
      expectedBlockers: missingAndLayout,
      expectedReadyRows: 0
    },
    {
      id: 'producer-sequence-zero',
      mutate(receipt) {
        receipt[SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.producerSequence] = 0;
      },
      expectedBlockers: missingAndLayout,
      expectedReadyRows: 0
    },
    {
      id: 'camel-case-reaction-count-drift',
      mutate(receipt) {
        receipt[SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.reactionCount] = 2;
      },
      expectedBlockers: missingAndLayout,
      expectedReadyRows: 0
    },
    {
      id: 'camel-case-stride-drift',
      mutate(receipt) {
        receipt[
          SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.atomResidualStrideVec4
        ] = 3;
      },
      expectedBlockers: missingAndLayout,
      expectedReadyRows: 0
    },
    {
      id: 'source-generation-drift',
      mutate(receipt) {
        receipt[SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.sourceGeneration] = 0;
      },
      expectedBlockers: (
        SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
        | SPH_REACTION_STRICT_GATE_BLOCKER.GENERATION_MISMATCH
      ) >>> 0,
      expectedReadyRows: 2
    },
    {
      id: 'completion-generation-drift',
      mutate(receipt) {
        receipt[
          SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.completionGeneration
        ] = 0;
      },
      expectedBlockers: (
        SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
        | SPH_REACTION_STRICT_GATE_BLOCKER.GENERATION_MISMATCH
      ) >>> 0,
      expectedReadyRows: 2
    },
    {
      id: 'seal-drift',
      mutate(receipt) {
        receipt[SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX.seal] = 0;
      },
      expectedBlockers: (
        SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
        | SPH_REACTION_STRICT_GATE_BLOCKER.SEAL_MISMATCH
      ) >>> 0,
      expectedReadyRows: 2
    }
  ];

  for (const receiptCase of cases) {
    const producerReceipt = baseline.producerReceipt.slice();
    receiptCase.mutate(producerReceipt);
    const result = finalizeStrictGateFixture({
      atomResidualValues,
      producerReceipt
    });
    assert.equal(
      result.blockerFlags,
      receiptCase.expectedBlockers,
      receiptCase.id
    );
    assert.equal(result.readyRowCount, receiptCase.expectedReadyRows, receiptCase.id);
    assert.equal(
      result.problemRowCount,
      atomResidualValues.length / 8 - receiptCase.expectedReadyRows,
      receiptCase.id
    );
  }

  const shortReceipt = finalizeStrictGateFixture({
    atomResidualValues,
    producerReceipt: Uint32Array.of(0)
  });
  assert.equal(
    shortReceipt.blockerFlags,
    (
      SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
      | SPH_REACTION_STRICT_GATE_BLOCKER.GENERATION_MISMATCH
      | SPH_REACTION_STRICT_GATE_BLOCKER.SEAL_MISMATCH
      | SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH
    ) >>> 0
  );
  assert.equal(shortReceipt.readyRowCount, 0);
  assert.equal(shortReceipt.problemRowCount, 2);
});

test('GPU strict-gate enforces exact f32 index bounds and max-f32 finiteness', () => {
  const evidence = new Float32Array([
    0, 1, 0, 0, SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE, 1, 0, 1
  ]);
  assert.equal(finalizeStrictGateFixture({ atomResidualValues: evidence }).pass, true);

  const outOfRangeTerm = evidence.slice();
  outOfRangeTerm[6] = SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE;
  const outOfRangeTermResult = finalizeStrictGateFixture({
    atomResidualValues: outOfRangeTerm
  });
  assert.equal(outOfRangeTermResult.pass, false);
  assert.notEqual(
    outOfRangeTermResult.blockerFlags & SPH_REACTION_STRICT_GATE_BLOCKER.PROBLEM_ROW,
    0
  );

  const inexactEventCount = evidence.slice();
  inexactEventCount[4] = SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE + 2;
  assert.equal(finalizeStrictGateFixture({
    atomResidualValues: inexactEventCount
  }).pass, false);

  const invalidReactionCount = finalizeStrictGateFixture({
    atomResidualValues: new Float32Array(),
    reactionCount: SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE,
    atomTermCount: 0,
    receiptReactionCount: SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
  });
  assert.notEqual(
    invalidReactionCount.blockerFlags & SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH,
    0
  );
  const invalidTermCount = finalizeStrictGateFixture({
    atomResidualValues: new Float32Array(),
    reactionCount: 0,
    atomTermCount: SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE,
    receiptAtomTermCount: SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
  });
  assert.notEqual(
    invalidTermCount.blockerFlags & SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH,
    0
  );

  const maxFiniteF32 = new Float32Array(
    new Uint32Array([0x7f7f_ffff]).buffer
  )[0];
  const maxFiniteResidual = evidence.slice();
  maxFiniteResidual[2] = maxFiniteF32;
  const maxFiniteResult = finalizeStrictGateFixture({
    atomResidualValues: maxFiniteResidual
  });
  assert.equal(maxFiniteResult.pass, false);
  assert.equal(
    maxFiniteResult.blockerFlags & SPH_REACTION_STRICT_GATE_BLOCKER.NONFINITE_EVIDENCE,
    0
  );
  assert.notEqual(
    maxFiniteResult.blockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.ATOM_RESIDUAL_OUT_OF_TOLERANCE,
    0
  );
});

test('GPU strict-gate treats zero reactions as vacuously balanced only with zero terms', () => {
  const empty = finalizeStrictGateFixture({
    atomResidualValues: new Float32Array(),
    reactionCount: 0,
    atomTermCount: 0,
    receiptSourceGeneration: 24,
    receiptCompletionGeneration: 25,
    receiptSeal: 26
  });
  assert.equal(empty.pass, true);
  assert.equal(empty.maxAbsAtomResidualMol, 0);
  assert.equal(empty.maxAbsChargeResidualMol, 0);
  assert.deepEqual(empty.atomResidualMolByReactionAndZ, {});
  assert.deepEqual(empty.chargeResidualMolByReaction, {});
  assert.equal(empty.producerShadowWords.byteLength, Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(empty.producerShadowWords[0], 0);

  const emptyTable = {
    schema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
    reactionCount: 0,
    reactantTermCount: 0,
    productTermCount: 0,
    atomTermCount: 0,
    metadata: [],
    atomTermRecords: new Float32Array(),
    atomTermMetadata: [],
    atomTermStrideFloats: SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT.length,
    atomTermLayout: [...SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT]
  };
  const emptyPlan = createSphReactionStrictGateGpuFinalizePlan({
    reactionTable: emptyTable,
    expectedSourceGeneration: 24,
    expectedCompletionGeneration: 25,
    expectedSeal: 26
  });
  assert.equal(emptyPlan.configuredToPass, true);
  assert.equal(emptyPlan.producerShadow.logicalWordCount, 0);
  assert.equal(emptyPlan.producerShadow.logicalByteLength, 0);
  assert.equal(emptyPlan.producerShadow.bindingByteLength, empty.producerShadowWords.byteLength);
  assert.equal(emptyPlan.bindings[5].byteLength, Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(emptyPlan.producerShadow.zeroRowSentinelWord, 0);

  for (const malformedShadow of [new Uint32Array(), Uint32Array.of(1)]) {
    const malformed = finalizeStrictGateFixture({
      atomResidualValues: new Float32Array(),
      producerShadowWords: malformedShadow,
      reactionCount: 0,
      atomTermCount: 0,
      receiptSourceGeneration: 24,
      receiptCompletionGeneration: 25,
      receiptSeal: 26
    });
    assert.equal(malformed.pass, false);
    assert.notEqual(
      malformed.blockerFlags & SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE,
      0
    );
    assert.notEqual(
      malformed.blockerFlags & SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH,
      0
    );
  }

  const missing = finalizeStrictGateFixture({
    atomResidualValues: new Float32Array(),
    reactionCount: 1,
    atomTermCount: 0,
    receiptSourceGeneration: 24,
    receiptCompletionGeneration: 25,
    receiptSeal: 26
  });
  assert.equal(missing.pass, false);
  assert.notEqual(
    missing.blockerFlags & SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE,
    0
  );
});

test('GPU strict-gate build plan stays resident and begins from a blocked sentinel', () => {
  const table = reactionTable();
  assert.equal(deriveSphReactionStrictGateStaticBlockerFlags(table), 0);
  const selfAuthenticatedPlan = createSphReactionStrictGateGpuFinalizePlan({
    reactionTable: table
  });
  assert.equal(selfAuthenticatedPlan.configuredToPass, false);
  assert.notEqual(
    selfAuthenticatedPlan.configurationBlockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.GENERATION_MISMATCH,
    0
  );
  assert.notEqual(
    selfAuthenticatedPlan.configurationBlockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.SEAL_MISMATCH,
    0
  );
  const plan = createSphReactionStrictGateGpuFinalizePlan({
    reactionTable: table,
    atomResidualCapacity: table.atomTermCount,
    atomTermCapacity: table.atomTermCount,
    expectedSourceGeneration: 31,
    expectedCompletionGeneration: 32,
    expectedSeal: 33
  });
  assert.equal(plan.status, 'sph-reaction-strict-gate-gpu-finalize-plan-ready');
  assert.equal(plan.configuredToPass, true);
  assert.equal(plan.failClosed, true);
  assert.equal(plan.gpuAuthoredControl, true);
  assert.equal(plan.hostReadbackRequired, false);
  assert.equal(plan.producerReceipt.required, true);
  assert.equal(plan.producerReceipt.gpuAuthored, true);
  assert.equal(plan.producerReceipt.finalizerAccess, 'read-only');
  assert.equal(plan.producerReceipt.identityProof, 'full-bitwise-planar-shadow-v1');
  assert.equal('identityHash' in plan.producerReceipt, false);
  assert.equal(plan.producerShadow.required, true);
  assert.equal(plan.producerShadow.gpuAuthored, true);
  assert.equal(plan.producerShadow.hostReadbackRequired, false);
  assert.equal(plan.producerShadow.layout, 'planar-raw-u32-v1');
  assert.equal(plan.producerShadow.sourceRowWords, 8);
  assert.equal(plan.producerShadow.planeCount, 2);
  assert.equal(plan.producerShadow.logicalWordCount, table.atomTermCount * 16);
  assert.equal(plan.producerShadow.exactBindingLengthRequired, true);
  assert.deepEqual(plan.producerShadow.requiredUsage, ['COPY_DST', 'STORAGE']);
  assert.equal(plan.producerShadow.copyOperations.length, 2);
  assert.equal(plan.control.byteLength, 64);
  assert.equal(plan.params.byteLength, 64);
  assert.equal(plan.producerReceipt.byteLength, 64);
  assert.deepEqual(plan.dispatchWorkgroups, [1, 1, 1]);
  assert.equal(plan.shader.code, sphReactionStrictGateFinalizeWgsl);
  assert.equal(plan.shader.entryPoint, 'finalize_reaction_strict_gate');
  assert.equal(plan.bindings[0].rowStrideBytes, 32);
  assert.equal(plan.bindings[1].role, 'authoritative-atom-term-table');
  assert.equal(plan.bindings[1].rowStrideBytes, 32);
  assert.equal(plan.bindings[2].role, 'atom-residual-producer-receipt');
  assert.equal(plan.bindings[2].bufferType, 'read-only-storage');
  assert.equal(plan.bindings[3].role, 'strict-gate-control');
  assert.equal(plan.bindings[4].role, 'strict-gate-params');
  assert.equal(plan.bindings[5].role, 'exact-producer-shadow');
  assert.equal(plan.bindings[5].bufferType, 'read-only-storage');
  assert.notEqual(
    plan.control.initialWords[SPH_REACTION_STRICT_GATE_INDEX.statusFlags]
      & SPH_REACTION_STRICT_GATE_STATUS.BLOCKED,
    0
  );
  assert.equal(
    plan.control.initialWords[SPH_REACTION_STRICT_GATE_INDEX.statusFlags]
      & SPH_REACTION_STRICT_GATE_STATUS.PASS,
    0
  );

  const provisionalTable = {
    ...table,
    metadata: [{
      ...table.metadata[0],
      stoichiometry: {
        ...table.metadata[0].stoichiometry,
        provisionalEnergeticsStatus: 'provisional-heuristic'
      }
    }]
  };
  const blockedPlan = createSphReactionStrictGateGpuFinalizePlan({
    reactionTable: provisionalTable,
    expectedSourceGeneration: 31,
    expectedCompletionGeneration: 32,
    expectedSeal: 33
  });
  assert.equal(
    blockedPlan.status,
    'sph-reaction-strict-gate-gpu-finalize-plan-fail-closed'
  );
  assert.equal(blockedPlan.configuredToPass, false);
  assert.notEqual(
    blockedPlan.staticBlockerFlags
      & SPH_REACTION_STRICT_GATE_BLOCKER.PROVISIONAL_ENERGETICS,
    0
  );
});

test('GPU strict-gate static authority rejects duplicated, relabelled, and out-of-range atom terms', () => {
  const duplicate = reactionTable();
  duplicate.atomTermRecords = duplicate.atomTermRecords.slice();
  duplicate.atomTermRecords.set(duplicate.atomTermRecords.subarray(0, 8), 8);
  duplicate.atomTermMetadata = duplicate.atomTermMetadata.map((record) => ({
    ...record
  }));
  duplicate.atomTermMetadata[1] = {
    ...duplicate.atomTermMetadata[0],
    atomTermIndex: 1
  };
  assert.notEqual(
    deriveSphReactionStrictGateStaticBlockerFlags(duplicate)
      & SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID,
    0
  );

  for (const [rowOffset, metadataField, replacement] of [
    [4, 'atomsPerFormula', 2],
    [5, 'coefficient', 3],
    [6, 'charge', 1]
  ]) {
    const mismatched = reactionTable();
    mismatched.atomTermRecords = mismatched.atomTermRecords.slice();
    mismatched.atomTermRecords[rowOffset] = replacement;
    assert.notEqual(
      deriveSphReactionStrictGateStaticBlockerFlags(mismatched)
        & SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID,
      0,
      `${metadataField} mismatch must fail closed`
    );
  }

  const coercedMetadata = reactionTable();
  coercedMetadata.atomTermMetadata = coercedMetadata.atomTermMetadata.map(
    (record) => ({ ...record })
  );
  coercedMetadata.atomTermMetadata[0].atomsPerFormula = '1';
  assert.notEqual(
    deriveSphReactionStrictGateStaticBlockerFlags(coercedMetadata)
      & SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID,
    0
  );

  const fractionalDiscreteMetadata = reactionTable();
  fractionalDiscreteMetadata.atomTermMetadata =
    fractionalDiscreteMetadata.atomTermMetadata.map((record) => ({ ...record }));
  fractionalDiscreteMetadata.atomTermMetadata[0].termKindId =
    1 + Number.EPSILON;
  assert.notEqual(
    deriveSphReactionStrictGateStaticBlockerFlags(fractionalDiscreteMetadata)
      & SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID,
    0
  );

  const outOfRange = reactionTable();
  outOfRange.atomTermRecords = outOfRange.atomTermRecords.slice();
  outOfRange.atomTermRecords[2] =
    SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE - 1;
  outOfRange.atomTermMetadata = outOfRange.atomTermMetadata.map((record) => ({
    ...record
  }));
  outOfRange.atomTermMetadata[0].termIndex =
    SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE - 1;
  assert.notEqual(
    deriveSphReactionStrictGateStaticBlockerFlags(outOfRange)
      & SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID,
    0
  );

  const sparse = reactionTable();
  sparse.atomTermCount -= 1;
  sparse.atomTermRecords = sparse.atomTermRecords.slice(0, -8);
  sparse.atomTermMetadata = sparse.atomTermMetadata.slice(0, -1);
  assert.notEqual(
    deriveSphReactionStrictGateStaticBlockerFlags(sparse)
      & SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID,
    0
  );

  const twoReaction = {
    ...reactionTable(),
    reactionCount: 2,
    reactantTermCount: 2,
    productTermCount: 2,
    atomTermCount: 4,
    metadata: [0, 1].map((reactionIndex) => ({
      stoichiometry: {
        atomBalance: { balanced: true },
        chargeBalance: { balanced: true },
        provisionalEnergeticsStatus: null
      },
      reactantTermOffset: reactionIndex,
      reactantTermCount: 1,
      productTermOffset: reactionIndex,
      productTermCount: 1
    })),
    atomTermRecords: new Float32Array([
      0, 1, 0, 1, 1, 1, 0, 1,
      0, 2, 0, 1, 1, 1, 0, 1,
      1, 1, 1, 1, 1, 1, 0, 1,
      1, 2, 1, 1, 1, 1, 0, 1
    ]),
    atomTermMetadata: [
      [0, 1, 0],
      [0, 2, 0],
      [1, 1, 1],
      [1, 2, 1]
    ].map(([reactionIndex, termKindId, termIndex], atomTermIndex) => ({
      atomTermIndex,
      reactionIndex,
      termKind: termKindId === 1 ? 'reactant' : 'product',
      termKindId,
      termIndex,
      atomicNumberZ: 1,
      atomsPerFormula: 1,
      coefficient: 1,
      charge: 0,
      status: 1
    }))
  };
  assert.equal(deriveSphReactionStrictGateStaticBlockerFlags(twoReaction), 0);
  const crossReactionTerm = {
    ...twoReaction,
    atomTermRecords: twoReaction.atomTermRecords.slice(),
    atomTermMetadata: twoReaction.atomTermMetadata.map((record) => ({
      ...record
    }))
  };
  crossReactionTerm.atomTermRecords[2] = 1;
  crossReactionTerm.atomTermMetadata[0].termIndex = 1;
  assert.notEqual(
    deriveSphReactionStrictGateStaticBlockerFlags(crossReactionTerm)
      & SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID,
    0
  );

  for (const [rowOffset, label] of [
    [0, 'reaction index'],
    [2, 'term index'],
    [6, 'charge']
  ]) {
    const signedZero = reactionTable();
    signedZero.atomTermRecords = signedZero.atomTermRecords.slice();
    signedZero.atomTermRecords[rowOffset] = -0;
    assert.notEqual(
      deriveSphReactionStrictGateStaticBlockerFlags(signedZero)
        & SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID,
      0,
      `${label} signed-zero metadata alias must fail closed`
    );
  }
});

test('GPU strict-gate diagnostic validation never grants unbound admission', () => {
  const passed = finalizeStrictGateFixture({
    atomResidualValues: new Float32Array([
      0, 1, 0, 0, 1, 1, 0, 1
    ])
  });
  const diagnostic = validateSphReactionStrictGateControl(
    passed.controlWords,
    { requireExpectedAuthority: false }
  );
  assert.equal(diagnostic.valid, true);
  assert.equal(diagnostic.authorityBound, false);
  assert.equal(diagnostic.pass, false);
  assert.equal(diagnostic.blocked, true);
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
  assert.equal(summary.readbackTelemetryComplete, true);
  assert.equal(summary.mapAsyncCount, 5);
  assert.equal(
    summary.readbackBytes,
    128
      + 32
      + 128
      + (65 * 2 * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
        * Float32Array.BYTES_PER_ELEMENT)
      + 128
  );
  assert.equal(summary.hostQueueFenceCount, 0);
  assert.equal(summary.finalDiagnosticMapAsyncCount, 0);
  assert.equal(summary.unclassifiedMapAsyncCount, 5);
  assert.equal(summary.unclassifiedReadbackBytes, summary.readbackBytes);
  assert.equal(summary.normalHotLoopReadbackFree, false);
  assert.equal(summary.productionHotLoopHostDependencyFree, false);
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
  assert.equal(summary.readbackTelemetryComplete, true);
  assert.equal(summary.mapAsyncCount, 4);
  assert.equal(summary.readbackBytes, 416);
  assert.equal(summary.hostQueueFenceCount, 0);
  assert.equal(summary.finalDiagnosticMapAsyncCount, 0);
  assert.equal(summary.unclassifiedMapAsyncCount, 4);
  assert.equal(summary.normalHotLoopReadbackFree, false);
  assert.equal(summary.productionHotLoopHostDependencyFree, false);
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
  assert.equal(summary.readbackTelemetryComplete, true);
  assert.equal(summary.mapAsyncCount, 0);
  assert.equal(summary.readbackBytes, 0);
  assert.equal(summary.hostQueueFenceCount, 1);
  assert.equal(summary.deferredCleanupHostQueueFenceCount, 1);
  assert.equal(summary.unclassifiedHostQueueFenceCount, 0);
  assert.equal(summary.normalHotLoopReadbackFree, false);
  assert.equal(summary.productionHotLoopHostDependencyFree, true);
  assert.equal(summary.localBufferCleanupHostQueueFenceCount, 1);
  assert.equal(
    summary.localBufferCleanupMethod,
    'gpu-queue-on-submitted-work-done'
  );
  assert.equal(device.queueFenceCount, 1);
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

test('SPH reaction exact summary cleanup falls back to one fence and retries a one-shot destructor failure', async () => {
  const device = fakeSummaryDevice(
    new Float32Array(SPH_GPU_REACTION_SUMMARY_FLOATS),
    new Float32Array(),
    new Float32Array(),
    new Float32Array(),
    new Float32Array(),
    new Float32Array(),
    {
      throwDestroyOnceLabel: 'ulg-sph-reaction-summary-records'
    }
  );
  const producerOutput = {};
  let externalCleanupCount = 0;
  const externalCleanup = () => {
    externalCleanupCount += 1;
  };
  const issuer = createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'test-reaction-summary-upstream'
  });
  const producerClaim = registerQueueOrderedCleanupClaim(
    issuer,
    device,
    {
      producerOutput,
      cleanup: externalCleanup
    }
  );
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
    readAtomResidual: false,
    queueOrderedProducerClaims: [producerClaim]
  });

  assert.equal(device.queueFenceCount, 1);
  assert.equal(summary.hostQueueFenceCount, 1);
  assert.equal(summary.deferredCleanupHostQueueFenceCount, 1);
  assert.equal(summary.unclassifiedHostQueueFenceCount, 0);
  assert.equal(summary.normalHotLoopReadbackFree, false);
  assert.equal(summary.productionHotLoopHostDependencyFree, true);
  await Promise.resolve();
  await Promise.resolve();
  const recordsBuffer = device.createdBuffers.find(
    ({ label }) => label === 'ulg-sph-reaction-summary-records'
  );
  assert.equal(recordsBuffer.destroyed, true);
  releaseSubmittedWorkCleanupQueueOrdered(
    device,
    externalCleanup,
    {
      queueOrderedFinalConsumer:
        summary.queueOrderedFinalConsumerCapability,
      producerClaim,
      producerOutput,
      producerFamily: 'test-reaction-summary-upstream'
    }
  );
  assert.equal(externalCleanupCount, 1);
  assert.equal(device.queueFenceCount, 1);
  summary.destroyProductEventBuffer();
});

test('SPH reaction host refuses product placement without the canonical spatial placement authority', async () => {
  // Reference-state birth (F = I, J = 1) is only one part of placement. The
  // legacy path still lacks canonical routing, deterministic conflict folds,
  // represented-entity publication, and relative-kinetic-energy
  // thermalization, so production must fail closed without the authority.
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
    (error) => {
      assert.equal(
        error.code,
        'ERR_SPH_REACTION_PRODUCT_PLACEMENT_AUTHORITY_REQUIRED'
      );
      assert.match(
        error.message,
        /canonical Schroeder spatial placement authority/
      );
      assert.equal(error.readbackTelemetry.readbackTelemetryComplete, true);
      assert.equal(error.readbackTelemetry.mapAsyncCount, 0);
      assert.equal(error.readbackTelemetry.readbackBytes, 0);
      assert.equal(error.readbackTelemetry.hostQueueFenceCount, 0);
      assert.equal(error.readbackTelemetry.normalHotLoopReadbackFree, true);
      assert.equal(
        error.readbackTelemetry.productionHotLoopHostDependencyFree,
        true
      );
      return true;
    }
  );
});
