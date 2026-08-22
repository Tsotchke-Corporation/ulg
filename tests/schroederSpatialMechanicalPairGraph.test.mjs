import assert from 'node:assert/strict';
import test from 'node:test';

import * as abiIndex from '../ulg-gpu-abi/src/index.js';
import {
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ABI,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_BYTES_PER_DIRECTED_PAIR,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONDITIONAL_DISPATCH_COUNT,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONDITIONAL_DISPATCH_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONDITIONAL_DISPATCH_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD_OFFSETS,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_DIRECTED_ROW_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_DIRECTED_ROW_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ENERGY_ROW_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ENERGY_ROW_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD_OFFSETS,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_FAILURE,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_INDIRECT_DISPATCH_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_INDIRECT_DISPATCH_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_CONTROL_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_CONTROL_LANE_COUNT,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_CONTROL_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_REFERENCE_PASSES,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCALE_ROW_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGING_ROW_LAYOUT,
  ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA,
  createSchroederSpatialMechanicalPairGraphCapacityPlan,
  createSchroederSpatialMechanicalPairGraphLayout,
  schroederSpatialMechanicalMatchingCleanupControlWordsForPasses
} from '../ulg-gpu-abi/src/schroederSpatialMechanicalPairGraph.js';
import {
  SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE as RUNTIME_MECHANICAL_GRAPH_FAILURE,
  SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE as RUNTIME_MECHANICAL_GRAPH_STAGE
} from '../src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js';

const UINT32_MAX = 0xffff_ffff;

function limits(maxBufferSize = 65_536, maxStorageBufferBindingSize = 65_536) {
  return { maxBufferSize, maxStorageBufferBindingSize };
}

test('mechanical pair-graph ABI fixes one-traversal deterministic directed CSR semantics', () => {
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_LAYOUT.length, 130);
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_LAYOUT.length, 48);
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.magic, 0);
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.requiredDirectedPairCount,
    12
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.dispatchIndirectX,
    29
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.dispatchIndirectZ,
    31
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.energyMeasureCount0,
    32
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.energyResidualJ,
    39
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.fullSolverPath,
    40
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.zeroEdgeDispatchX,
    41
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.zeroEdgeDispatchZ,
    43
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.measureCount4,
    44
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.solveCount7,
    51
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.energyMeasureCount7,
    55
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.measureCount8,
    56
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.solveCount15,
    71
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.energyMeasureCount15,
    79
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .preSolveMaxPositionResidualOrderedF32_0,
    80
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .preSolveMaxPositionViolationRatioOrderedF32_0,
    96
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .preSolveMaxVelocityResidualOrderedF32_15,
    127
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .matchingCleanupPassCount,
    128
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .matchingCleanupTrustRestoreCount,
    129
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_CONTROL_WORDS,
    7_180
  );
  // CONTROL_WORDS sizing follows the declared pass budget: one fixed
  // 12-word header plus seven per-pass evidence lanes.
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_CONTROL_HEADER_WORDS,
    12
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_CONTROL_LANE_COUNT,
    7
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_REFERENCE_PASSES,
    1024
  );
  assert.equal(
    schroederSpatialMechanicalMatchingCleanupControlWordsForPasses(1024),
    7_180
  );
  assert.equal(
    schroederSpatialMechanicalMatchingCleanupControlWordsForPasses(512),
    12 + 7 * 512
  );
  assert.throws(
    () => schroederSpatialMechanicalMatchingCleanupControlWordsForPasses(0),
    RangeError
  );
  const budgetedLayout = createSchroederSpatialMechanicalPairGraphLayout({
    particleCapacity: 4,
    directedPairCapacity: 64,
    matchingCleanupPasses: 512
  });
  assert.equal(budgetedLayout.matchingCleanupPasses, 512);
  assert.equal(
    budgetedLayout.matchingCleanupControlWords,
    12 + 7 * 512
  );
  assert.equal(
    budgetedLayout.bufferLayouts.matchingCleanupControl.wordLength,
    12 + 7 * 512
  );
  const budgetedPlan = createSchroederSpatialMechanicalPairGraphCapacityPlan({
    particleCapacity: 4,
    matchingCleanupPasses: 512,
    maxRetainedBytes: 1024 * 1024
  });
  assert.equal(budgetedPlan.matchingCleanupPasses, 512);
  assert.equal(
    budgetedPlan.layout.matchingCleanupControlWords,
    12 + 7 * 512
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.publishedDirectedPairCount,
    17
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.energyMeasurePassCount,
    32
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.negativeInternalEnergyCount,
    39
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.candidateVisitCount,
    40
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.projectedPeerVisitCount,
    47
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD_OFFSETS,
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD_OFFSETS,
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD
  );
  assert.deepEqual(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGING_ROW_LAYOUT, [
    'sourceIndex:u32',
    'peerIndex:u32',
    'sourceLocalRank:u32'
  ]);
  assert.deepEqual(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_DIRECTED_ROW_LAYOUT, [
    'peerIndex:u32'
  ]);
  assert.deepEqual(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_INDIRECT_DISPATCH_LAYOUT,
    ['dispatchX:u32', 'dispatchY:u32', 'dispatchZ:u32']
  );
  assert.deepEqual(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONDITIONAL_DISPATCH_LAYOUT,
    [
      'zeroEdgeDispatchX:u32',
      'zeroEdgeDispatchY:u32',
      'zeroEdgeDispatchZ:u32'
    ]
  );
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_INDIRECT_DISPATCH_WORDS, 3);
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONDITIONAL_DISPATCH_COUNT, 1);
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONDITIONAL_DISPATCH_WORDS, 3);
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_DIRECTED_ROW_WORDS, 1);
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_BYTES_PER_DIRECTED_PAIR, 16);
  assert.deepEqual(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE, {
    INITIALIZED: 1,
    SUPPORT_REDUCED: 2,
    TRAVERSED: 4,
    SCANNED: 8,
    CSR_SCATTERED: 16,
    GRAPH_VERIFIED: 32,
    ITERATION_0: 64,
    ITERATION_1: 128,
    ITERATION_2: 256,
    ITERATION_3: 512,
    RESIDUAL_VERIFIED: 1024,
    PROPOSAL_PUBLISHED: 2048,
    COMMITTED: 4096,
    ENERGY_ITERATION_0: 8192,
    ENERGY_ITERATION_1: 16384,
    ENERGY_ITERATION_2: 32768,
    ENERGY_ITERATION_3: 65536,
    ENERGY_VERIFIED: 131072,
    ITERATION_4: 262144,
    ITERATION_5: 524288,
    ITERATION_6: 1048576,
    ITERATION_7: 2097152,
    ENERGY_ITERATION_4: 4194304,
    ENERGY_ITERATION_5: 8388608,
    ENERGY_ITERATION_6: 16777216,
    ENERGY_ITERATION_7: 33554432,
    ITERATIONS_8_15: 67108864,
    ENERGY_ITERATIONS_8_15: 134217728,
    MATCHING_CLEANUP: 268435456,
    MATCHING_TRUST_RESTORED: 536870912,
    CONTACT_INTERFACE_RECEIPT_PUBLISHED: 1073741824
  });
  assert.deepEqual(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_FAILURE, {
    DIRECTORY_REJECT: 1,
    MALFORMED_TRAVERSAL: 2,
    COUNTER_OVERFLOW: 4,
    GRAPH_CAPACITY: 8,
    SCAN_COUNT_MISMATCH: 16,
    CSR_BOUNDS_OR_RANK: 32,
    DUPLICATE_ENDPOINT: 64,
    MISSING_RECIPROCAL: 128,
    LEVEL_OR_SOURCE_IDENTITY: 256,
    NONFINITE: 512,
    ITERATION_INCOMPLETE: 1024,
    POSITION_RESIDUAL: 2048,
    VELOCITY_RESIDUAL: 4096,
    HEADER_OR_EPOCH: 8192,
    PUBLICATION_INCOMPLETE: 16384,
    STAGE_ORDER: 32768,
    ENERGY_GAIN: 65536,
    ENERGY_CLOSURE: 131072,
    NEGATIVE_INTERNAL_ENERGY: 262144,
    CONTACT_INTERFACE_RECEIPT: 524288
  });
  assert.deepEqual(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCALE_ROW_LAYOUT, [
    'barrierDxScale:f32-bits',
    'barrierDvScale:f32-bits',
    'softDxScale:f32-bits',
    'softDvScale:f32-bits'
  ]);
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ENERGY_ROW_WORDS, 8);
  assert.deepEqual(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ENERGY_ROW_LAYOUT, [
    'iterationQuadraticBudgetFraction:f32-bits',
    'iterationQuadraticEnergyJ:f32-bits',
    'iterationHalfLinearLossBudgetJ:f32-bits',
    'iterationWallKineticLossJ:f32-bits',
    'cumulativePairKineticDeltaJ:f32-bits',
    'cumulativePairHeatJ:f32-bits',
    'cumulativeWallHeatJ:f32-bits',
    'initialSpecificInternalEnergyJPerKg:f32-bits'
  ]);
  assert.deepEqual(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE,
    RUNTIME_MECHANICAL_GRAPH_STAGE
  );
  assert.deepEqual(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_FAILURE,
    RUNTIME_MECHANICAL_GRAPH_FAILURE
  );
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ABI.exactNearTraversalCount, 1);
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ABI.version, 8);
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ABI.schema,
    'peercompute.ulg.schroeder-spatial-mechanical-pair-graph.v8'
  );
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ABI.radixSortRequired, false);
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ABI.sentinelPaddingRequired, false);
  assert.match(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ABI.construction,
    /one-exact-near-traversal.*exclusive-scan.*local-rank-scatter/
  );
  assert.match(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ABI.overflowPolicy,
    /no-truncated-prefix-publication/
  );
  assert.match(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ABI.controlDispatchEvidence,
    /control-words-29-through-31.*evidence-only/
  );
  assert.match(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ABI.indirectDispatchBufferPolicy,
    /dedicated-three-u32.*no-control-alias/
  );
  assert.match(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ABI.conditionalDispatchBufferPolicy,
    /zero-edge-triplet.*phase-reuses.*matching-cleanup.*without host readback/
  );
  assert.match(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ABI.reciprocityValidation,
    /duplicate-peer.*reciprocal-source/
  );
  assert.match(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ABI.candidateVisitPolicy,
    /including-self.*rejected-by-contact-filters/
  );
  assert.ok(Object.isFrozen(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ABI));
  assert.ok(Object.isFrozen(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE));
  assert.ok(Object.isFrozen(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_FAILURE));
  assert.equal(
    abiIndex.ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA,
    ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA
  );
  assert.equal(
    abiIndex.createSchroederSpatialMechanicalPairGraphLayout,
    createSchroederSpatialMechanicalPairGraphLayout
  );
});

test('mechanical pair-graph layout accounts every retained buffer and CSR terminator', () => {
  const layout = createSchroederSpatialMechanicalPairGraphLayout({
    particleCapacity: 5,
    directedPairCapacity: 21,
    maxRetainedBytes: 30_460,
    deviceLimits: { limits: limits() }
  });
  assert.equal(layout.schema, ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA);
  assert.equal(layout.sourceCountWordLength, 5);
  assert.equal(layout.sourceOffsetWordLength, 6);
  assert.equal(layout.stagingWordLength, 63);
  assert.equal(layout.directedPeerWordLength, 21);
  assert.equal(layout.scratchStateWordLength, 40);
  assert.equal(layout.scaleWordLength, 20);
  assert.equal(layout.energyRowWords, 8);
  assert.equal(layout.energyWordLength, 40);
  assert.equal(layout.energyLedgerAliasedToProposalRows, true);
  assert.equal(layout.energyLedgerAliasWordOffset, 16);
  assert.equal(layout.energyLedgerAliasByteOffset, 64);
  assert.equal(
    layout.energyLedgerAliasLifetime,
    'solver-scratch-until-proposal-publication'
  );
  assert.equal(layout.proposalWordLength, 56);
  assert.equal(layout.fixedRetainedByteLength, 30_124);
  assert.equal(layout.retainedWordLength, 7_615);
  assert.equal(layout.retainedByteLength, 30_460);
  assert.equal(
    layout.indirectDispatchBufferRole,
    'mechanical-pair-graph-indirect-dispatch'
  );
  assert.equal(layout.indirectDispatchWords, 3);
  assert.equal(layout.conditionalDispatchWords, 3);
  assert.equal(layout.conditionalDispatchCount, 1);
  assert.equal(layout.indirectDispatchOffsetWords, 0);
  assert.equal(layout.indirectDispatchOffsetBytes, 0);
  assert.equal(layout.conditionalDispatchOffsetWords, 0);
  assert.equal(layout.conditionalDispatchOffsetBytes, 0);
  assert.equal(layout.conditionalDispatchSourceOffsetWords, 41);
  assert.equal(layout.conditionalDispatchSourceOffsetBytes, 164);
  assert.equal(layout.controlDispatchEvidenceOffsetWords, 29);
  assert.equal(layout.controlDispatchEvidenceOffsetBytes, 116);
  assert.equal(layout.bufferLayouts.control.wordLength, 130);
  assert.equal(layout.bufferLayouts.control.byteLength, 520);
  assert.equal(layout.bufferLayouts.evidence.wordLength, 48);
  assert.equal(layout.bufferLayouts.evidence.byteLength, 192);
  assert.equal(layout.bufferLayouts.matchingCleanupControl.wordLength, 7_180);
  assert.equal(layout.bufferLayouts.matchingCleanupControl.byteLength, 28_720);
  assert.equal(layout.bufferLayouts.control.indirect, false);
  assert.equal(layout.bufferLayouts.indirectDispatch.wordLength, 3);
  assert.equal(layout.bufferLayouts.indirectDispatch.byteLength, 12);
  assert.equal(layout.bufferLayouts.indirectDispatch.indirect, true);
  assert.equal(layout.bufferLayouts.conditionalDispatch.wordLength, 3);
  assert.equal(layout.bufferLayouts.conditionalDispatch.byteLength, 12);
  assert.equal(layout.bufferLayouts.conditionalDispatch.indirect, true);
  assert.equal(layout.bufferLayouts.sourceCounts.wordLength, 5);
  assert.equal(layout.bufferLayouts.sourceOffsets.wordLength, 6);
  assert.equal(layout.bufferLayouts.appendStaging.byteLength, 252);
  assert.equal(layout.bufferLayouts.directedPeers.byteLength, 84);
  assert.equal(layout.bufferLayouts.scratchStateA.byteLength, 160);
  assert.equal(layout.bufferLayouts.scratchStateB.byteLength, 160);
  assert.equal(layout.bufferLayouts.scales.byteLength, 80);
  assert.equal(layout.bufferLayouts.energyLedger.wordLength, 40);
  assert.equal(layout.bufferLayouts.energyLedger.byteLength, 160);
  assert.equal(layout.bufferLayouts.energyLedger.aliased, true);
  assert.equal(
    layout.bufferLayouts.energyLedger.aliasOf,
    'mechanical-pair-graph-proposals'
  );
  assert.equal(layout.bufferLayouts.energyLedger.aliasWordOffset, 16);
  assert.equal(layout.bufferLayouts.energyLedger.aliasByteOffset, 64);
  assert.equal(layout.interfaceReceiptMaximumPublishedRows, 20);
  assert.equal(layout.interfaceReceiptWordLength, 62);
  assert.equal(layout.interfaceReceiptAliasedToAppendStaging, true);
  assert.equal(layout.bufferLayouts.interfaceReceipt.wordLength, 62);
  assert.equal(layout.bufferLayouts.interfaceReceipt.byteLength, 248);
  assert.equal(layout.bufferLayouts.interfaceReceipt.aliased, true);
  assert.equal(
    layout.bufferLayouts.interfaceReceipt.aliasOf,
    'mechanical-pair-graph-append-staging'
  );
  assert.equal(layout.bufferLayouts.proposals.byteLength, 224);
  assert.equal(layout.buffers.length, 13);
  assert.equal(layout.bufferAliases.length, 2);
  assert.equal(layout.bufferAliases[0], layout.bufferLayouts.energyLedger);
  assert.equal(layout.bufferAliases[1], layout.bufferLayouts.interfaceReceipt);
  assert.equal(
    layout.buffers.some((buffer) => (
      buffer.role === 'mechanical-pair-graph-energy-ledger'
    )),
    false
  );
  assert.deepEqual(
    layout.buffers.filter((buffer) => buffer.indirect).map((buffer) => buffer.role),
    [
      'mechanical-pair-graph-indirect-dispatch',
      'mechanical-pair-graph-conditional-dispatch'
    ]
  );
  assert.ok(layout.buffers.every(Object.isFrozen));
  assert.ok(Object.isFrozen(layout));
  assert.ok(Object.isFrozen(layout.bufferLayouts));
  assert.ok(Object.isFrozen(layout.bufferByteLengths));
  assert.equal(layout.readbackRequired, false);
});

test('mechanical pair-graph capacity plan obeys retained-byte, binding, and caller ceilings', () => {
  const budgetBound = createSchroederSpatialMechanicalPairGraphCapacityPlan({
    particleCapacity: 5,
    maxRetainedBytes: 30_460,
    deviceLimits: limits()
  });
  assert.equal(budgetBound.fixedRetainedByteLength, 30_124);
  assert.equal(budgetBound.directedPairCapacity, 21);
  assert.equal(budgetBound.layout.retainedByteLength, 30_460);
  assert.deepEqual(budgetBound.limitingFactors, ['retainedByteBudget']);

  const bindingBound = createSchroederSpatialMechanicalPairGraphCapacityPlan({
    particleCapacity: 2,
    maxRetainedBytes: 110_000,
    deviceLimits: limits(110_000, 43_056)
  });
  assert.equal(bindingBound.directedPairCapacity, 3588);
  assert.equal(bindingBound.capacityLimits.stagingMaxStorageBufferBindingSize, 3588);
  assert.ok(bindingBound.limitingFactors.includes('stagingMaxStorageBufferBindingSize'));

  const callerBound = createSchroederSpatialMechanicalPairGraphCapacityPlan({
    particleCapacity: 2,
    maximumDirectedPairCapacity: 8,
    maxRetainedBytes: 50_000,
    deviceLimits: limits()
  });
  assert.equal(callerBound.directedPairCapacity, 8);
  assert.deepEqual(callerBound.limitingFactors, ['requestedMaximum']);
  assert.ok(Object.isFrozen(callerBound.capacityLimits));
  assert.ok(Object.isFrozen(callerBound.limitingFactors));
});

test('mechanical pair-graph exact particle capacity removes the rounding cliff and enforces a minimum directed degree', () => {
  const maxRetainedBytes = 8 * 1024 * 1024;
  const below = createSchroederSpatialMechanicalPairGraphCapacityPlan({
    particleCapacity: 32_768,
    maxRetainedBytes
  });
  const above = createSchroederSpatialMechanicalPairGraphCapacityPlan({
    particleCapacity: 32_769,
    maxRetainedBytes
  });
  assert.equal(below.fixedRetainedByteLength, 3_961_684);
  assert.equal(above.fixedRetainedByteLength, below.fixedRetainedByteLength + 120);
  assert.equal(below.directedPairCapacity, 276_682);
  assert.equal(above.directedPairCapacity, 276_675);
  assert.ok(below.directedPairCapacity - above.directedPairCapacity <= 8);

  const minimumDirectedPairCapacity = 32_769 * 16;
  assert.throws(() => createSchroederSpatialMechanicalPairGraphCapacityPlan({
    particleCapacity: 32_769,
    minimumDirectedPairCapacity,
    maxRetainedBytes
  }), /cannot admit the required 524304 directed pairs/);
  const adaptiveByteBudget = above.fixedRetainedByteLength
    + minimumDirectedPairCapacity
      * SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_BYTES_PER_DIRECTED_PAIR;
  const adaptive = createSchroederSpatialMechanicalPairGraphCapacityPlan({
    particleCapacity: 32_769,
    minimumDirectedPairCapacity,
    maxRetainedBytes: adaptiveByteBudget
  });
  assert.equal(adaptive.minimumDirectedPairCapacity, minimumDirectedPairCapacity);
  assert.equal(adaptive.directedPairCapacity, minimumDirectedPairCapacity);
  assert.equal(adaptive.layout.retainedByteLength, adaptiveByteBudget);
  assert.equal(adaptive.layout.energyLedgerAliasedToProposalRows, true);
});

test('mechanical pair-graph layout rejects device buffer, binding, and retained-byte overflow', () => {
  assert.doesNotThrow(() => createSchroederSpatialMechanicalPairGraphLayout({
    particleCapacity: 2,
    directedPairCapacity: 16,
    maxRetainedBytes: 30_020,
    deviceLimits: limits(43_056, 43_056)
  }));
  assert.throws(() => createSchroederSpatialMechanicalPairGraphLayout({
    particleCapacity: 2,
    directedPairCapacity: 3589,
    maxRetainedBytes: 101_524,
    deviceLimits: limits(43_056, 100_000)
  }), /append-staging.*maxBufferSize/);
  assert.throws(() => createSchroederSpatialMechanicalPairGraphLayout({
    particleCapacity: 2,
    directedPairCapacity: 3589,
    maxRetainedBytes: 101_524,
    deviceLimits: limits(100_000, 43_056)
  }), /append-staging.*maxStorageBufferBindingSize/);
  assert.throws(() => createSchroederSpatialMechanicalPairGraphLayout({
    particleCapacity: 5,
    directedPairCapacity: 21,
    maxRetainedBytes: 30_459,
    deviceLimits: limits()
  }), /retained byte length 30460 exceeds maxRetainedBytes 30459/);
  assert.throws(() => createSchroederSpatialMechanicalPairGraphLayout({
    particleCapacity: 5,
    directedPairCapacity: 20,
    maxRetainedBytes: 50_000,
    deviceLimits: limits()
  }), /interface receipt word length 62 exceeds aliased append-staging word length 60/);
  assert.throws(() => createSchroederSpatialMechanicalPairGraphLayout({
    particleCapacity: 2,
    directedPairCapacity: 1,
    maxRetainedBytes: 1024,
    arenaByteLimit: 2048,
    deviceLimits: limits()
  }), /must match/);
  assert.throws(() => createSchroederSpatialMechanicalPairGraphCapacityPlan({
    particleCapacity: 5,
    maxRetainedBytes: 30_444,
    deviceLimits: limits()
  }), /cannot admit the required 21 directed pairs/);
});

test('mechanical pair-graph capacity arithmetic rejects u32 and unsafe-number inputs', () => {
  assert.throws(() => createSchroederSpatialMechanicalPairGraphLayout({
    particleCapacity: Math.floor(UINT32_MAX / 8) + 1,
    directedPairCapacity: 1
  }), /scratch-state word length.*u32 word range/);
  assert.throws(() => createSchroederSpatialMechanicalPairGraphLayout({
    particleCapacity: 1,
    directedPairCapacity: Math.floor(UINT32_MAX / 3) + 1
  }), /append-staging word length.*u32 word range/);
  assert.throws(() => createSchroederSpatialMechanicalPairGraphLayout({
    particleCapacity: UINT32_MAX,
    directedPairCapacity: 1
  }), /source-offset word length.*u32 word range/);
  assert.throws(() => createSchroederSpatialMechanicalPairGraphLayout({
    particleCapacity: 1,
    directedPairCapacity: 1,
    maxRetainedBytes: Number.MAX_SAFE_INTEGER + 1
  }), /positive safe integer byte count/);
  assert.throws(() => createSchroederSpatialMechanicalPairGraphLayout({
    particleCapacity: 1,
    directedPairCapacity: 1,
    deviceLimits: limits(Number.MAX_SAFE_INTEGER + 1, 4096)
  }), /deviceLimits\.maxBufferSize.*positive safe integer/);
  assert.throws(() => createSchroederSpatialMechanicalPairGraphLayout({
    particleCapacity: 1,
    directedPairCapacity: 1,
    deviceLimits: limits(4096, Number.POSITIVE_INFINITY)
  }), /deviceLimits\.maxStorageBufferBindingSize.*positive safe integer/);
  assert.throws(() => createSchroederSpatialMechanicalPairGraphCapacityPlan({
    particleCapacity: 1,
    maximumDirectedPairCapacity: 0,
    maxRetainedBytes: 4096,
    deviceLimits: limits()
  }), /maximumDirectedPairCapacity.*positive u32/);
});
