import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPATIAL_MECHANICAL_BATCH_SOLVER_BUDGET,
  SCHROEDER_SPATIAL_MECHANICAL_INTERACTIVE_SOLVER_BUDGET,
  SCHROEDER_SPATIAL_MECHANICAL_PROJECTION_VARIANTS,
  enumerateSchroederSpatialMechanicalPrewarmPipelineDescriptors,
  schroederSpatialMechanicalPipelineDescriptors
} from '../src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js';
import {
  enumerateSchroederSpatialReactionDiscoveryPrewarmPipelineDescriptors,
  schroederSpatialReactionDiscoveryPipelineDescriptors
} from '../src/runtime/sph/schroederSpatialReactionDiscoveryProposalGpu.js';
import {
  enumerateSphReactionProductPlacementSegmentedPrewarmPipelineDescriptors,
  sphReactionProductPlacementSegmentedPipelineDescriptors
} from '../src/runtime/sph/schroederSpatialReactionProductPlacementGpu.js';
import {
  enumerateSphReactionStepPrewarmPipelineDescriptors,
  sphReactionStepPipelineDescriptors
} from '../src/runtime/sph/sphReactionGpuKernel.js';
import {
  enumerateSphReactionCanonicalSummaryPrewarmPipelineDescriptors,
  sphReactionCanonicalSummaryPipelineDescriptors
} from '../src/runtime/sph/sphReactionGpuSummary.js';
import {
  enumerateSphPhaseCarrierOneToFourPrewarmPipelineDescriptors,
  sphPhaseCarrierOneToFourPipelineDescriptor
} from '../src/runtime/sph/sphPhaseCarrierMaterializationGpu.js';
import {
  createCachedExplicitComputePipeline,
  prewarmCachedExplicitComputePipeline
} from '../src/runtime/webgpuComputeLayout.js';
import {
  enumerateWorkerSchroederLanePrewarmPipelineDescriptors,
  prewarmWorkerSchroederLaneComputePipelines
} from '../src/services/ulgMechanicsResidentStage.worker.js';

// Same fake-device pattern as tests/webgpuComputePipelinePrewarm.test.mjs.
function fakeDevice({ asyncCreation = true } = {}) {
  const counters = { sync: 0, async: 0, modules: 0 };
  let pipelineOrdinal = 0;
  const makePipeline = (descriptor) => ({
    label: descriptor.label,
    ordinal: (pipelineOrdinal += 1),
    getBindGroupLayout(index) { return { index, from: descriptor.label }; }
  });
  const device = {
    counters,
    createShaderModule(descriptor) {
      counters.modules += 1;
      return { label: descriptor.label, code: descriptor.code };
    },
    createBindGroupLayout(descriptor) { return { label: descriptor.label }; },
    createPipelineLayout(descriptor) { return { label: descriptor.label }; },
    createComputePipeline(descriptor) {
      counters.sync += 1;
      return makePipeline(descriptor);
    }
  };
  if (asyncCreation) {
    device.createComputePipelineAsync = async (descriptor) => {
      counters.async += 1;
      await Promise.resolve();
      return makePipeline(descriptor);
    };
  }
  return device;
}

function assertCompleteDescriptor(descriptor, context) {
  assert.equal(typeof descriptor.cacheKey, 'string', `${context} cacheKey`);
  assert.ok(descriptor.cacheKey.length > 0, `${context} cacheKey non-empty`);
  assert.equal(typeof descriptor.label, 'string', `${context} label`);
  assert.equal(typeof descriptor.code, 'string', `${context} code`);
  assert.ok(descriptor.code.length > 0, `${context} code non-empty`);
  assert.equal(typeof descriptor.entryPoint, 'string', `${context} entryPoint`);
  assert.ok(Array.isArray(descriptor.bindings), `${context} bindings`);
  assert.ok(descriptor.bindings.length > 0, `${context} bindings non-empty`);
}

test('descriptor factory produces complete budget-keyed descriptors', () => {
  const table = schroederSpatialMechanicalPipelineDescriptors({
    solverBudget: SCHROEDER_SPATIAL_MECHANICAL_BATCH_SOLVER_BUDGET,
    mechanicalProjectionVariant: 'aggregate',
    directoryAbiVersion: 1,
    diagnosticTrace: false
  });
  assert.equal(
    table.schema,
    'peercompute.ulg.schroeder-spatial-mechanical-pipeline-descriptors.v1'
  );
  assert.equal(
    table.solverBudgetCacheKey,
    SCHROEDER_SPATIAL_MECHANICAL_BATCH_SOLVER_BUDGET.cacheKey
  );
  // Fixed-key control pipelines keep their exact historical cache keys.
  assert.equal(
    table.initialize.cacheKey,
    'ulg-schroeder-spatial-mechanical-contact-graph-initialize.v12.pair-graph-v10'
  );
  assert.equal(
    table.index.cacheKey,
    'ulg-schroeder-spatial-mechanical-contact-graph-index-csr.v8.pair-graph-v10'
  );
  for (const descriptor of [
    table.initialize,
    table.finalizeCounts,
    table.scatter,
    table.validate,
    table.index,
    table.publish,
    table.zeroContactComplete,
    table.seal,
    table.commit
  ]) {
    assert.match(descriptor.cacheKey, /\.pair-graph-v10(?:\.|$)/);
  }
  // Variant-keyed build pipelines carry the projection variant and ABI.
  assert.equal(
    table.reduction.cacheKey,
    'ulg-schroeder-spatial-mechanical-contact-graph-support-reduction.aggregate.directory-v1.v13'
  );
  assert.equal(
    table.materialize.cacheKey,
    'ulg-schroeder-spatial-mechanical-contact-graph-traversal.aggregate.directory-v1.v16'
  );
  assert.match(table.solverMeasure.cacheKey, /measure-runtime\.v3\./);
  assert.match(table.solverSolve.cacheKey, /solve-runtime\.v3\./);
  assert.match(
    table.solverAllocateEnergy.cacheKey,
    /energy-allocate-runtime\.v3\./
  );
  // Budget-compiled pipelines carry the sealed j{n}.p{n} suffix.
  const budgetSuffix = `.${SCHROEDER_SPATIAL_MECHANICAL_BATCH_SOLVER_BUDGET.cacheKey}`;
  for (const [field, descriptor] of [
    ['solverSolve', table.solverSolve],
    ['initializeMatchingConstraints', table.initializeMatchingConstraints],
    ['matchingCleanupOwner', table.matchingCleanupOwner],
    ['restoreMatchingTrust', table.restoreMatchingTrust],
    ['verify', table.verify],
    ['verifyEnergy', table.verifyEnergy],
    ['initializeInterfaceReceipt', table.initializeInterfaceReceipt],
    ['publish', table.publish],
    ['commit', table.commit]
  ]) {
    assertCompleteDescriptor(descriptor, field);
    assert.ok(
      descriptor.cacheKey.endsWith(budgetSuffix),
      `${field} carries the solver-budget cacheKey suffix`
    );
  }
  // Non-diagnostic tables never expose diagnostic-only pipelines.
  assert.equal(table.matchingCleanup, null);
  assert.equal(table.diagnosticTracePipelines, null);
});

test('diagnostic-trace factory swaps the owner pipeline for per-pass cleanup and trace descriptors', () => {
  const table = schroederSpatialMechanicalPipelineDescriptors({
    solverBudget: SCHROEDER_SPATIAL_MECHANICAL_INTERACTIVE_SOLVER_BUDGET,
    mechanicalProjectionVariant: 'flat',
    directoryAbiVersion: 1,
    diagnosticTrace: true
  });
  assert.equal(table.matchingCleanupOwner, null);
  for (const key of ['select', 'copy', 'apply', 'walls', 'finalize']) {
    assertCompleteDescriptor(table.matchingCleanup[key], `matchingCleanup.${key}`);
  }
  for (const key of ['replay', 'apply', 'measure', 'select', 'materialize']) {
    assertCompleteDescriptor(
      table.diagnosticTracePipelines[key],
      `diagnosticTracePipelines.${key}`
    );
  }
});

test('descriptor factory refuses unknown variants, ABI versions, and unresolved budgets', () => {
  assert.throws(
    () => schroederSpatialMechanicalPipelineDescriptors({ solverBudget: null }),
    TypeError
  );
  assert.throws(
    () => schroederSpatialMechanicalPipelineDescriptors({
      solverBudget: SCHROEDER_SPATIAL_MECHANICAL_BATCH_SOLVER_BUDGET,
      mechanicalProjectionVariant: 'diagonal'
    }),
    RangeError
  );
  assert.throws(
    () => schroederSpatialMechanicalPipelineDescriptors({
      solverBudget: SCHROEDER_SPATIAL_MECHANICAL_BATCH_SOLVER_BUDGET,
      directoryAbiVersion: 3
    }),
    RangeError
  );
  assert.deepEqual(
    [...SCHROEDER_SPATIAL_MECHANICAL_PROJECTION_VARIANTS],
    ['aggregate', 'active-rank', 'flat']
  );
});

test('prewarm enumeration is a deduplicated flat list covering both canonical budgets', () => {
  const descriptors = enumerateSchroederSpatialMechanicalPrewarmPipelineDescriptors();
  assert.ok(descriptors.length > 0);
  const cacheKeys = descriptors.map((descriptor) => descriptor.cacheKey);
  assert.equal(new Set(cacheKeys).size, cacheKeys.length, 'cache keys are unique');
  for (const descriptor of descriptors) {
    assertCompleteDescriptor(descriptor, descriptor.cacheKey);
  }
  const batchSuffix = `.${SCHROEDER_SPATIAL_MECHANICAL_BATCH_SOLVER_BUDGET.cacheKey}`;
  const interactiveSuffix =
    `.${SCHROEDER_SPATIAL_MECHANICAL_INTERACTIVE_SOLVER_BUDGET.cacheKey}`;
  assert.ok(cacheKeys.some((key) => key.endsWith(batchSuffix)));
  assert.ok(cacheKeys.some((key) => key.endsWith(interactiveSuffix)));
  // Both default projection variants of the build pipelines are present.
  assert.ok(cacheKeys.includes(
    'ulg-schroeder-spatial-mechanical-contact-graph-traversal.aggregate.directory-v1.v16'
  ));
  assert.ok(cacheKeys.includes(
    'ulg-schroeder-spatial-mechanical-contact-graph-traversal.flat.directory-v1.v16'
  ));
  // Diagnostic-only pipelines never leak into the default prewarm set.
  assert.ok(!cacheKeys.some((key) => key.includes('diagnostic-trace')));
  assert.ok(!cacheKeys.some((key) => key.includes('matching-cleanup-select')));
});

test('prewarm enumeration keys are exactly the keys the encode-path factory asks for', () => {
  const descriptors = enumerateSchroederSpatialMechanicalPrewarmPipelineDescriptors();
  const enumeratedKeys = new Set(descriptors.map((d) => d.cacheKey));
  const encodeTable = schroederSpatialMechanicalPipelineDescriptors({
    solverBudget: SCHROEDER_SPATIAL_MECHANICAL_BATCH_SOLVER_BUDGET,
    mechanicalProjectionVariant: 'aggregate',
    directoryAbiVersion: 1,
    diagnosticTrace: false
  });
  for (const [field, value] of Object.entries(encodeTable)) {
    if (!value || typeof value !== 'object') continue;
    if (typeof value.cacheKey !== 'string') continue;
    assert.ok(
      enumeratedKeys.has(value.cacheKey),
      `encode descriptor ${field} (${value.cacheKey}) is prewarmed`
    );
  }
});

test('every enumerated descriptor prewarms into the cache the sync path then hits', async () => {
  const device = fakeDevice();
  const descriptors = enumerateSchroederSpatialMechanicalPrewarmPipelineDescriptors();
  for (const descriptor of descriptors) {
    const warmed = await prewarmCachedExplicitComputePipeline(device, descriptor);
    assert.equal(warmed.cacheStatus, 'pipeline-prewarmed', descriptor.cacheKey);
  }
  for (const descriptor of descriptors) {
    const synchronous = createCachedExplicitComputePipeline(device, descriptor);
    assert.equal(
      synchronous.cacheStatus,
      'pipeline-cache-hit',
      `${descriptor.cacheKey} consumed the prewarmed pipeline`
    );
  }
  assert.equal(device.counters.sync, 0, 'the sync path never compiled');
});

test('reaction-step prewarm covers one fixed material-agnostic pipeline family', () => {
  const table = sphReactionStepPipelineDescriptors();
  assert.equal(
    table.schema,
    'peercompute.ulg.sph-reaction-step-pipeline-descriptors.v0'
  );
  const descriptors = enumerateSphReactionStepPrewarmPipelineDescriptors();
  assert.equal(descriptors.length, 5);
  assert.deepEqual(
    descriptors.map((descriptor) => descriptor.entryPoint),
    ['pack_source', 'bin_particles', 'propose', 'resolve', 'unpack']
  );
  assert.equal(
    new Set(descriptors.map((descriptor) => descriptor.code)).size,
    1,
    'all reaction-table passes share the same generic WGSL module'
  );
  for (const descriptor of descriptors) {
    assertCompleteDescriptor(descriptor, descriptor.entryPoint);
    assert.equal(descriptor.cacheKey, 'ulg-sph-reaction-step');
  }
});

test('reaction-discovery prewarm covers both envelope routes for both live directory ABIs', () => {
  const tables = [1, 2].map((directoryAbiVersion) =>
    schroederSpatialReactionDiscoveryPipelineDescriptors({
      directoryAbiVersion
    }));
  const descriptors =
    enumerateSchroederSpatialReactionDiscoveryPrewarmPipelineDescriptors();
  assert.equal(descriptors.length, 14);
  const identity = (descriptor) => JSON.stringify([
    descriptor.cacheKey,
    descriptor.label,
    descriptor.entryPoint,
    descriptor.bindings
  ]);
  const identities = new Set(descriptors.map(identity));
  for (const table of tables) {
    for (const descriptor of [
      table.displacement,
      table.proposal,
      table.seal,
      table.activationMotionBounds,
      table.activationMotionWatch,
      table.activationObservationWithMotion,
      table.activationObservationWithoutMotion
    ]) {
      assert.ok(
        identities.has(identity(descriptor)),
        `directory v${table.directoryAbiVersion} ${descriptor.entryPoint}`
      );
    }
  }
  assert.equal(
    new Set(descriptors.map((descriptor) => descriptor.code)).size,
    2,
    'the fixed warm set covers both supported spatial-directory ABIs'
  );
  for (const descriptor of descriptors) {
    assertCompleteDescriptor(descriptor, descriptor.entryPoint);
  }
});

test('segmented reaction placement exposes one fixed 22-pass generic warm set', () => {
  const table = sphReactionProductPlacementSegmentedPipelineDescriptors();
  assert.equal(
    table.schema,
    'peercompute.ulg.sph-reaction-product-placement-segmented-pipeline-descriptors.v0'
  );
  const descriptors =
    enumerateSphReactionProductPlacementSegmentedPrewarmPipelineDescriptors();
  assert.equal(descriptors.length, 22);
  assert.equal(
    new Set(descriptors.map((descriptor) => descriptor.cacheKey)).size,
    22
  );
  for (const descriptor of descriptors) {
    assertCompleteDescriptor(descriptor, descriptor.entryPoint);
    assert.doesNotMatch(
      `${descriptor.cacheKey}|${descriptor.label}`,
      /sodium|cesium|fluorine|water|preset|material[-_]?id/i
    );
  }
});

test('canonical reaction summary shares twelve passes and warms both ABI classifiers', () => {
  const v1 = sphReactionCanonicalSummaryPipelineDescriptors({
    directoryAbiVersion: 1
  });
  const v2 = sphReactionCanonicalSummaryPipelineDescriptors({
    directoryAbiVersion: 2
  });
  assert.equal(
    v2.schema,
    'peercompute.ulg.sph-reaction-canonical-summary-pipeline-descriptors.v0'
  );
  const descriptors =
    enumerateSphReactionCanonicalSummaryPrewarmPipelineDescriptors();
  assert.equal(descriptors.length, 14);
  const cacheKeys = new Set(descriptors.map((descriptor) => descriptor.cacheKey));
  assert.ok(cacheKeys.has(v1.placementClassification.cacheKey));
  assert.ok(cacheKeys.has(v2.placementClassification.cacheKey));
  for (const descriptor of descriptors) {
    assertCompleteDescriptor(descriptor, descriptor.entryPoint);
    assert.doesNotMatch(
      `${descriptor.cacheKey}|${descriptor.label}`,
      /sodium|cesium|fluorine|water|preset|material[-_]?id/i
    );
  }
});

test('phase-carrier one-to-four transition prewarms one capacity-independent program', () => {
  const descriptor = sphPhaseCarrierOneToFourPipelineDescriptor();
  assert.deepEqual(
    enumerateSphPhaseCarrierOneToFourPrewarmPipelineDescriptors(),
    [descriptor]
  );
  assertCompleteDescriptor(descriptor, descriptor.entryPoint);
  assert.doesNotMatch(
    `${descriptor.cacheKey}|${descriptor.label}`,
    /sodium|cesium|fluorine|water|preset|material[-_]?id/i
  );
});

test('worker warm-program identities never encode material, reaction instance, or scenario data', () => {
  const descriptors = enumerateWorkerSchroederLanePrewarmPipelineDescriptors();
  const sourceByProgramIdentity = new Map();
  for (const descriptor of descriptors) {
    assert.equal(typeof descriptor.cacheKey, 'string');
    assert.equal(typeof descriptor.label, 'string');
    assert.equal(typeof descriptor.code, 'string');
    assert.equal(typeof descriptor.entryPoint, 'string');
    assert.ok(Array.isArray(descriptor.bindings));
    assert.doesNotMatch(
      `${descriptor.cacheKey}|${descriptor.label}`,
      /sodium|cesium|fluorine|water|iron|ice|steam|smoke|preset|scenario|material[-_]?(?:id|key|name)|reaction[-_]?(?:id|index)[-_:]?\d|phase[-_]?id[-_:]?\d/i
    );
    const programIdentity = JSON.stringify([
      descriptor.cacheKey,
      descriptor.label,
      descriptor.entryPoint,
      descriptor.bindings
    ]);
    const priorSource = sourceByProgramIdentity.get(programIdentity);
    if (priorSource == null) {
      sourceByProgramIdentity.set(programIdentity, descriptor.code);
    } else {
      assert.equal(
        descriptor.code,
        priorSource,
        'one stable program identity cannot select scenario-dependent WGSL'
      );
    }
  }
});

test('worker lane-admission hook reports a truthful settled summary from the default enumeration', async () => {
  const device = fakeDevice();
  const summary = await prewarmWorkerSchroederLaneComputePipelines(device);
  assert.equal(
    summary.schema,
    'peercompute.ulg.worker-schroeder-lane-pipeline-prewarm.v0'
  );
  assert.equal(summary.status, 'worker-lane-pipeline-prewarm-completed');
  assert.equal(summary.reason, null);
  const expectedCount =
    enumerateWorkerSchroederLanePrewarmPipelineDescriptors().length;
  assert.equal(summary.requestedCount, expectedCount);
  assert.equal(summary.firedCount, expectedCount);
  assert.equal(summary.settledCount, expectedCount);
  assert.equal(summary.failedCount, 0);
});

test('worker lane-admission hook settles failures and remains fail-open', async () => {
  // A device with no methods at all: every prewarm fails INSIDE the
  // primitive (resolved pipeline-prewarm-failed, never a rejection), and the
  // hook still resolves with a truthful failure summary.
  const summary = await prewarmWorkerSchroederLaneComputePipelines({});
  assert.equal(summary.status, 'worker-lane-pipeline-prewarm-completed');
  assert.ok(summary.firedCount > 0);
  assert.equal(summary.firedCount, summary.requestedCount);
  assert.equal(summary.settledCount, summary.requestedCount);
  assert.equal(summary.failedCount, summary.requestedCount);
});

test('worker lane-admission hook reports a throwing enumeration truthfully', async () => {
  const summary = await prewarmWorkerSchroederLaneComputePipelines(fakeDevice(), {
    enumeratePipelines() {
      throw new Error('enumeration exploded');
    }
  });
  assert.equal(
    summary.status,
    'worker-lane-pipeline-prewarm-skipped-enumeration-failed'
  );
  assert.equal(summary.reason, 'enumeration exploded');
  assert.equal(summary.requestedCount, 0);
  assert.equal(summary.firedCount, 0);
});

test('worker lane-admission hook reports an empty enumeration as a skip', async () => {
  const summary = await prewarmWorkerSchroederLaneComputePipelines(fakeDevice(), {
    enumeratePipelines: () => []
  });
  assert.equal(
    summary.status,
    'worker-lane-pipeline-prewarm-skipped-no-enumeration'
  );
  assert.equal(summary.requestedCount, 0);
  assert.equal(summary.firedCount, 0);
});
