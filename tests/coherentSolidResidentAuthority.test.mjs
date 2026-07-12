import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COHERENT_SOLID_FRAME_WORDS,
  COHERENT_SOLID_MEMBER_WORDS,
  ULG_COHERENT_SOLID_CHART_TRANSITION_SCHEMA,
  ULG_COHERENT_SOLID_COMMIT_DELTA_SCHEMA,
  ULG_COHERENT_SOLID_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA,
  ULG_COHERENT_SOLID_FRAME_SCHEMA,
  ULG_COHERENT_SOLID_INVARIANT_EVIDENCE_SCHEMA,
  ULG_COHERENT_SOLID_MEMBER_MEMBERSHIP_SCHEMA,
  ULG_COHERENT_SOLID_MEMBER_SCHEMA,
  ULG_COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_SCHEMA,
  ULG_COHERENT_SOLID_REST_MESH_SCHEMA,
  ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA,
  ULG_COHERENT_SOLID_STATE_DELTA_SCHEMA
} from '../ulg-gpu-abi/src/coherentSolid.js';
import { validateCoherentSolidCommitDelta } from '../src/runtime/peercomputeResidentCommitBridge.js';
import {
  createCoherentSolidAuthorityController,
  validateCoherentSolidCurrentSourceBundle
} from '../src/runtime/solid/coherentSolidAuthority.js';
import { createCoherentSolidFrameGpuPlan } from '../src/runtime/solid/coherentSolidFrameGpu.js';
import { createCoherentSolidPresentationLeaseRegistry } from '../src/runtime/solid/coherentSolidPresentationLease.js';
import {
  acquireCoherentSolidResidentLaneRuntime,
  destroyCoherentSolidResidentLaneCaches
} from '../src/runtime/solid/coherentSolidResidentLaneCache.js';
import {
  COHERENT_SOLID_BOOTSTRAP_TASK_FAMILY,
  COHERENT_SOLID_RESIDENT_COMMIT_SCOPE,
  createCoherentSolidChartTransition,
  runCoherentSolidFrameComputeTask
} from '../src/runtime/solid/coherentSolidResidentTask.js';

function createFakeDevice() {
  const buffers = [];
  const pipelines = [];
  return {
    buffers,
    pipelines,
    limits: {
      maxBufferSize: 1 << 28,
      maxStorageBufferBindingSize: 1 << 27,
      maxComputeWorkgroupsPerDimension: 65535
    },
    queue: { writeBuffer() {} },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroy() { this.destroyed = true; }
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule({ label, code }) { return { label, code }; },
    createBindGroup(descriptor) { return descriptor; },
    createComputePipeline({ label }) {
      const pipeline = { label, getBindGroupLayout() { return {}; } };
      pipelines.push(pipeline);
      return pipeline;
    }
  };
}

function validDelta() {
  const taskId = 'solid-task:2';
  return {
    schema: ULG_COHERENT_SOLID_COMMIT_DELTA_SCHEMA,
    taskId,
    scope: COHERENT_SOLID_RESIDENT_COMMIT_SCOPE,
    version: 2,
    timestamp: 1,
    payload: {
      schema: ULG_COHERENT_SOLID_STATE_DELTA_SCHEMA,
      status: 'coherent-solid-gpu-candidate-awaiting-state-manager-admission',
      stateKey: 'solid-state',
      laneId: 'solid-lane',
      leaseId: 'solid-lane:lease:1',
      producerTaskId: taskId,
      frameLeaseId: 41,
      frameLeaseEpoch: 0,
      sourceFamily: 'coherent-solid-frame',
      sourceGenerationId: 1,
      targetGenerationId: 2,
      bodyCount: 1,
      memberCount: 4,
      contactProxyCount: 3,
      sourcePositionEpoch: 1,
      targetPositionEpoch: 2,
      sourceChartId: 0,
      sourceLevelId: 0,
      sourceHierarchyGeneration: 1,
      chartId: 0,
      levelId: 0,
      hierarchyGeneration: 1,
      geometryKey: 9,
      topologyGeneration: 2,
      thirdLevelHold: true,
      retainedBufferRefs: ['coherent-solid-frame-buffer'],
      gpuFence: {
        fenceSatisfied: true,
        laneId: 'solid-lane',
        stateKey: 'solid-state'
      },
      invariantGate: {
        mode: 'gpu-resident-fail-closed-consumer-gate',
        failedBodiesProduceZeroIndirectInstances: true,
        readbackRequiredForAdmission: false,
        candidateFramesFailClosedOnGlobalRejection: true
      },
      executionShape: {
        workgroupSize: 64,
        maxComputeWorkgroupsPerDimension: 65535,
        bodyReductionDispatch: [1, 1, 1],
        bodyLinearDispatch: [1, 1, 1],
        memberLinearDispatch: [1, 1, 1],
        proxyIndirectDispatch: true
      },
      proxyCompactionGate: {
        schema: ULG_COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_SCHEMA,
        generationId: 2,
        inputProxyCount: 3,
        outputCapacity: 3,
        evidenceByteLength: 64,
        ordering: 'stable-gpu-radix-unique-body-id-proxy-id',
        failedCompactionProducesZeroIndirectInstances: true,
        readbackRequiredForAdmission: false
      },
      rawGpuBufferTransferDetected: false
    }
  };
}

test('resident solid lane cache shares 26 pipelines and bounds live generations to two slots', () => {
  const device = createFakeDevice();
  const plan = createCoherentSolidFrameGpuPlan({
    bodyCapacity: 1,
    memberCapacity: 4,
    membershipIndexCapacity: 4,
    arenaByteBudget: 1 << 20
  });
  const source = { size: COHERENT_SOLID_FRAME_WORDS * 4 };
  const common = {
    device,
    laneId: 'solid-lane',
    stateKey: 'solid-state',
    sourceFamily: 'coherent-solid-frame',
    frameLeaseId: 41,
    geometryKey: 9,
    topologyGeneration: 2,
    bodyCapacity: 1,
    memberCapacity: 4,
    membershipIndexCapacity: 4,
    contactProxyCapacity: 3,
    plan
  };
  const first = acquireCoherentSolidResidentLaneRuntime({
    ...common,
    taskId: 'solid:2',
    sourceFrameBuffer: source,
    targetGenerationId: 2
  });
  assert.equal(first.cacheHit, false);
  assert.equal(first.snapshot().pipelineCreationCount, 26);
  assert.equal(first.snapshot().retainedBufferAllocationCount, 40);
  assert.equal(device.pipelines.length, 26);
  assert.equal(device.buffers.length, 40);

  const second = acquireCoherentSolidResidentLaneRuntime({
    ...common,
    taskId: 'solid:3',
    sourceFrameBuffer: first.frameRuntime.candidateFrameBuffer,
    targetGenerationId: 3
  });
  assert.equal(second.cacheHit, true);
  assert.notEqual(second.slotIndex, first.slotIndex);
  assert.equal(second.snapshot().liveGenerationCount, 2);
  assert.throws(() => acquireCoherentSolidResidentLaneRuntime({
    ...common,
    taskId: 'solid:4-blocked',
    sourceFrameBuffer: second.frameRuntime.candidateFrameBuffer,
    targetGenerationId: 4
  }), /ping-pong arenas are occupied/);

  assert.equal(first.release(), true);
  const third = acquireCoherentSolidResidentLaneRuntime({
    ...common,
    taskId: 'solid:4',
    sourceFrameBuffer: second.frameRuntime.candidateFrameBuffer,
    targetGenerationId: 4
  });
  assert.equal(third.slotIndex, first.slotIndex);
  assert.equal(device.pipelines.length, 26);
  assert.equal(device.buffers.length, 40);
  second.release();
  third.release();
  assert.equal(destroyCoherentSolidResidentLaneCaches(device), 1);
  assert.ok(device.buffers.every(({ destroyed }) => destroyed));
});

test('resident solid rollover keeps the prior slot unavailable until its presentation consumer releases', () => {
  const device = createFakeDevice();
  const plan = createCoherentSolidFrameGpuPlan({
    bodyCapacity: 1,
    memberCapacity: 4,
    membershipIndexCapacity: 4,
    arenaByteBudget: 1 << 20
  });
  const source = { size: COHERENT_SOLID_FRAME_WORDS * 4 };
  const common = {
    device,
    laneId: 'solid-presentation-lane',
    stateKey: 'solid-presentation-state',
    sourceFamily: 'coherent-solid-frame',
    frameLeaseId: 41,
    geometryKey: 9,
    topologyGeneration: 2,
    bodyCapacity: 1,
    memberCapacity: 4,
    membershipIndexCapacity: 4,
    contactProxyCapacity: 3,
    plan
  };
  const first = acquireCoherentSolidResidentLaneRuntime({
    ...common,
    taskId: 'solid:presentation:2',
    sourceFrameBuffer: source,
    targetGenerationId: 2
  });
  const presentation = first.acquirePresentationConsumer({
    consumerId: 'native-surface',
    publicationGeneration: 2,
    admissionId: 19
  });
  assert.equal(presentation.validate(), true);
  assert.equal(first.release(), false);
  assert.equal(first.snapshot().presentationConsumerCount, 1);
  assert.equal(first.snapshot().producerReleasePending[first.slotIndex], true);

  const second = acquireCoherentSolidResidentLaneRuntime({
    ...common,
    taskId: 'solid:presentation:3',
    sourceFrameBuffer: first.frameRuntime.candidateFrameBuffer,
    targetGenerationId: 3
  });
  assert.equal(second.release(), true);
  assert.throws(() => acquireCoherentSolidResidentLaneRuntime({
    ...common,
    taskId: 'solid:presentation:4-blocked',
    sourceFrameBuffer: second.frameRuntime.candidateFrameBuffer,
    targetGenerationId: 4
  }), /ping-pong arenas are occupied/);

  assert.equal(presentation.release(), true);
  assert.equal(presentation.validate(), false);
  const fourth = acquireCoherentSolidResidentLaneRuntime({
    ...common,
    taskId: 'solid:presentation:4',
    sourceFrameBuffer: second.frameRuntime.candidateFrameBuffer,
    targetGenerationId: 4
  });
  assert.equal(fourth.slotIndex, first.slotIndex);
  fourth.release();
  assert.equal(destroyCoherentSolidResidentLaneCaches(device), 1);
});

test('delayed publication adoption fails closed after retirement while its prior consumer retains the slot', () => {
  const device = createFakeDevice();
  const plan = createCoherentSolidFrameGpuPlan({
    bodyCapacity: 1,
    memberCapacity: 4,
    membershipIndexCapacity: 4,
    arenaByteBudget: 1 << 20
  });
  const cacheLease = acquireCoherentSolidResidentLaneRuntime({
    device,
    laneId: 'solid-authority-lane',
    stateKey: 'solid-authority-state',
    sourceFamily: 'coherent-solid-frame',
    taskId: 'solid:authority:2',
    frameLeaseId: 41,
    geometryKey: 9,
    topologyGeneration: 2,
    bodyCapacity: 1,
    memberCapacity: 4,
    membershipIndexCapacity: 4,
    contactProxyCapacity: 3,
    plan,
    sourceFrameBuffer: { size: COHERENT_SOLID_FRAME_WORDS * 4 },
    targetGenerationId: 2
  });
  let publicationLive = true;
  const publication = Object.freeze({
    device,
    publicationGeneration: 2,
    admissionId: 19
  });
  const registry = createCoherentSolidPresentationLeaseRegistry({
    validatePublication(candidate) {
      return publicationLive && candidate === publication ? publication : null;
    }
  });
  registry.register(publication, {
    localRetainedRefs: {
      acquirePresentationConsumer(options) {
        return cacheLease.acquirePresentationConsumer(options);
      },
      destroy() {
        cacheLease.release();
      }
    }
  });
  const consumer = registry.acquire(publication, {
    consumerId: 'delayed-native-publication',
    device,
    publicationGeneration: 2,
    admissionId: 19
  });
  assert.equal(consumer.validate().valid, true);
  assert.equal(registry.snapshot(publication).activeConsumerCount, 1);

  publicationLive = false;
  assert.equal(registry.retire(publication, {
    reason: 'superseded-by-generation-3',
    replacedByGeneration: 3
  }), true);
  assert.equal(consumer.validate().valid, false);
  assert.equal(consumer.validate().reason, 'publication-retired');
  assert.equal(registry.acquire(publication, { device }), null);
  assert.equal(cacheLease.snapshot().liveGenerationCount, 1);
  assert.equal(cacheLease.snapshot().producerReleasePending[cacheLease.slotIndex], true);

  assert.equal(consumer.release(), true);
  assert.equal(cacheLease.snapshot().liveGenerationCount, 0);
  assert.equal(registry.snapshot(publication).activeConsumerCount, 0);
  assert.equal(destroyCoherentSolidResidentLaneCaches(device), 1);
});

test('current publication source bundle rejects retired replay, mixed sources, and generation forks', () => {
  const device = {};
  const admissionId = 19;
  const frameSource = {
    device,
    generationId: 7,
    positionEpoch: 9,
    stateManagerAdmissionId: admissionId
  };
  const sourceBundle = {
    frameSource,
    memberSource: {},
    membershipSource: {},
    localContactProxySource: {
      device,
      positionEpoch: 9,
      stateManagerAdmissionId: admissionId
    },
    restMesh: {},
    shapeCarrier: {
      generationId: 7,
      positionEpoch: 9,
      stateManagerAdmissionId: admissionId
    }
  };
  const publication = {
    device,
    publicationGeneration: 7,
    sourceEpoch: 9,
    admissionId,
    stateKey: 'solid-state',
    laneId: 'solid-lane',
    leaseIdentity: { sourceFamily: 'coherent-solid-frame' }
  };
  const options = {
    ...sourceBundle,
    device,
    stateKey: publication.stateKey,
    laneId: publication.laneId,
    sourceFamily: publication.leaseIdentity.sourceFamily,
    targetGenerationId: 8,
    sourcePositionEpoch: 9,
    targetPositionEpoch: 10
  };
  assert.equal(validateCoherentSolidCurrentSourceBundle({
    publication,
    sourceBundle,
    options
  }).accepted, true);
  assert.equal(validateCoherentSolidCurrentSourceBundle({
    publication,
    sourceBundle,
    options: { ...options, frameSource: { ...frameSource } }
  }).reason, 'frameSource-not-owned-by-current-publication');
  assert.equal(validateCoherentSolidCurrentSourceBundle({
    publication,
    sourceBundle,
    options: { ...options, targetGenerationId: 9 }
  }).reason, 'target-generation-not-current-plus-one');
  sourceBundle.localContactProxySource.stateManagerAdmissionId = 20;
  assert.equal(validateCoherentSolidCurrentSourceBundle({
    publication,
    sourceBundle,
    options
  }).reason, 'mutable-contact-source-authority-mismatch');
});

test('ComputeManager solid task identity and source epochs are exact before GPU encoding', async () => {
  const device = {
    createCommandEncoder() {},
    queue: { submit() {}, onSubmittedWorkDone() {} }
  };
  const frameSource = {
    bodyCount: 1,
    generationId: 7,
    positionEpoch: 9,
    leaseId: 41,
    leaseEpoch: 2
  };
  const memberSource = { memberCount: 1, leaseId: 41, leaseEpoch: 2 };
  const membershipSource = { leaseId: 41, leaseEpoch: 2 };
  const localContactProxySource = { proxyCount: 0, leaseId: 41, leaseEpoch: 2 };
  const base = {
    gpuResidentLaneLeaseIdentity: {
      schema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
      authoritative: true,
      laneId: 'solid-lane',
      stateKey: 'solid-state',
      sourceFamily: 'coherent-solid-frame',
      taskId: 'solid-task:8'
    },
    computeTaskId: 'solid-task:8',
    laneId: 'solid-lane',
    stateKey: 'solid-state',
    sourceFamily: 'coherent-solid-frame',
    device,
    frameSource,
    memberSource,
    membershipSource,
    localContactProxySource,
    targetGenerationId: 8,
    sourcePositionEpoch: 9,
    targetPositionEpoch: 10
  };
  await assert.rejects(runCoherentSolidFrameComputeTask({
    ...base,
    gpuResidentLaneLeaseIdentity: {
      ...base.gpuResidentLaneLeaseIdentity,
      taskId: 'forged-task'
    }
  }), /taskId does not match/);
  await assert.rejects(runCoherentSolidFrameComputeTask({
    ...base,
    targetGenerationId: 9
  }), /exactly once/);
  await assert.rejects(runCoherentSolidFrameComputeTask({
    ...base,
    sourcePositionEpoch: 8,
    targetPositionEpoch: 9
  }), /must match the admitted frame position epoch/);
});

test('occupied cache teardown completes automatically after the last presentation release', () => {
  const device = createFakeDevice();
  const plan = createCoherentSolidFrameGpuPlan({
    bodyCapacity: 1,
    memberCapacity: 4,
    membershipIndexCapacity: 4,
    arenaByteBudget: 1 << 20
  });
  const cacheLease = acquireCoherentSolidResidentLaneRuntime({
    device,
    laneId: 'solid-teardown-lane',
    stateKey: 'solid-teardown-state',
    sourceFamily: 'coherent-solid-frame',
    taskId: 'solid:teardown:2',
    frameLeaseId: 41,
    geometryKey: 9,
    topologyGeneration: 2,
    bodyCapacity: 1,
    memberCapacity: 4,
    membershipIndexCapacity: 4,
    contactProxyCapacity: 3,
    plan,
    sourceFrameBuffer: { size: COHERENT_SOLID_FRAME_WORDS * 4 },
    targetGenerationId: 2
  });
  const presentation = cacheLease.acquirePresentationConsumer({
    publicationGeneration: 2,
    admissionId: 19,
    consumerId: 'teardown-test'
  });
  assert.equal(cacheLease.release(), false);
  assert.equal(destroyCoherentSolidResidentLaneCaches(device), 0);
  assert.equal(cacheLease.snapshot().status, 'resident-lane-cache-destroy-pending');
  assert.ok(device.buffers.some(({ destroyed }) => !destroyed));
  assert.equal(presentation.release(), true);
  assert.equal(cacheLease.snapshot().status, 'destroyed');
  assert.ok(device.buffers.every(({ destroyed }) => destroyed));
  assert.equal(destroyCoherentSolidResidentLaneCaches(device), 0);
});

test('terminal device release invalidates presentation leases and completes pending cache teardown', () => {
  const device = createFakeDevice();
  const plan = createCoherentSolidFrameGpuPlan({
    bodyCapacity: 1,
    memberCapacity: 4,
    membershipIndexCapacity: 4,
    arenaByteBudget: 1 << 20
  });
  const cacheLease = acquireCoherentSolidResidentLaneRuntime({
    device,
    laneId: 'solid-device-loss-lane',
    stateKey: 'solid-device-loss-state',
    sourceFamily: 'coherent-solid-frame',
    taskId: 'solid:device-loss:2',
    frameLeaseId: 41,
    geometryKey: 9,
    topologyGeneration: 2,
    bodyCapacity: 1,
    memberCapacity: 4,
    membershipIndexCapacity: 4,
    contactProxyCapacity: 3,
    plan,
    sourceFrameBuffer: { size: COHERENT_SOLID_FRAME_WORDS * 4 },
    targetGenerationId: 2
  });
  const publication = Object.freeze({ device, publicationGeneration: 2, admissionId: 19 });
  const registry = createCoherentSolidPresentationLeaseRegistry({
    validatePublication(candidate) { return candidate === publication ? publication : null; }
  });
  registry.register(publication, {
    localRetainedRefs: {
      acquirePresentationConsumer(options) {
        return cacheLease.acquirePresentationConsumer(options);
      },
      destroy() { cacheLease.release(); }
    }
  });
  const consumer = registry.acquire(publication, { device });
  assert.equal(consumer.validate().valid, true);
  assert.equal(destroyCoherentSolidResidentLaneCaches(device), 0);
  assert.equal(registry.terminateDevice(device), 1);
  assert.equal(consumer.validate().valid, false);
  assert.equal(consumer.release(), false);
  assert.equal(cacheLease.snapshot().status, 'destroyed');
  assert.ok(device.buffers.every(({ destroyed }) => destroyed));
});

test('resident solid lane cache isolates workgroup and dispatch partition variants', () => {
  const device = createFakeDevice();
  const source = { size: COHERENT_SOLID_FRAME_WORDS * 4 };
  const acquire = ({ workgroupSize, maxComputeWorkgroupsPerDimension, taskId }) => {
    const plan = createCoherentSolidFrameGpuPlan({
      bodyCapacity: 1,
      memberCapacity: 4,
      membershipIndexCapacity: 4,
      arenaByteBudget: 1 << 20,
      workgroupSize,
      maxComputeWorkgroupsPerDimension
    });
    return acquireCoherentSolidResidentLaneRuntime({
      device,
      laneId: 'solid-lane',
      stateKey: 'solid-state',
      sourceFamily: 'coherent-solid-frame',
      taskId,
      frameLeaseId: 41,
      geometryKey: 9,
      topologyGeneration: 2,
      bodyCapacity: 1,
      memberCapacity: 4,
      membershipIndexCapacity: 4,
      contactProxyCapacity: 3,
      plan,
      workgroupSize,
      maxComputeWorkgroupsPerDimension,
      sourceFrameBuffer: source,
      targetGenerationId: 2
    });
  };
  const group32 = acquire({
    workgroupSize: 32,
    maxComputeWorkgroupsPerDimension: 1,
    taskId: 'solid:wg32'
  });
  const group64 = acquire({
    workgroupSize: 64,
    maxComputeWorkgroupsPerDimension: 2,
    taskId: 'solid:wg64'
  });
  assert.equal(group32.cacheHit, false);
  assert.equal(group64.cacheHit, false);
  assert.notEqual(group32.cacheEntryId, group64.cacheEntryId);
  assert.equal(device.pipelines.length, 52);
  group32.release();
  group64.release();
  assert.equal(destroyCoherentSolidResidentLaneCaches(device), 2);
});

test('StateManager rejects bootstrap labels without an exact retained GPU evidence descriptor', () => {
  const normal = validDelta();
  assert.equal(validateCoherentSolidCommitDelta(normal).accepted, true);
  const missing = structuredClone(normal);
  missing.payload.initialState = true;
  missing.payload.bootstrapTaskFamily = COHERENT_SOLID_BOOTSTRAP_TASK_FAMILY;
  assert.equal(
    validateCoherentSolidCommitDelta(missing).reason,
    'missing-bootstrap-gpu-evidence-descriptor'
  );
  const exact = structuredClone(missing);
  exact.payload.bootstrapEvidence = {
    schema: ULG_COHERENT_SOLID_INVARIANT_EVIDENCE_SCHEMA,
    byteLength: 128,
    generationId: 2,
    frameLeaseId: 41,
    leaseEpoch: 0,
    producerTaskId: exact.taskId,
    sameDeviceRetained: true,
    gpuGlobalInvariantFailCloseApplied: true
  };
  assert.equal(validateCoherentSolidCommitDelta(exact).accepted, true);
  exact.payload.bootstrapEvidence.generationId = 3;
  assert.equal(
    validateCoherentSolidCommitDelta(exact).reason,
    'bootstrap-gpu-evidence-generation-mismatch'
  );
});

test('StateManager rejects coherent-solid generation forks and unbound producer leases', () => {
  const forkedGeneration = validDelta();
  forkedGeneration.payload.targetGenerationId = 3;
  assert.equal(
    validateCoherentSolidCommitDelta(forkedGeneration).reason,
    'invalid-generation-advance'
  );
  const skippedEpoch = validDelta();
  skippedEpoch.payload.targetPositionEpoch = 3;
  assert.equal(
    validateCoherentSolidCommitDelta(skippedEpoch).reason,
    'invalid-position-epoch-advance'
  );
  const forgedProducer = validDelta();
  forgedProducer.payload.producerTaskId = 'forged-task';
  assert.equal(
    validateCoherentSolidCommitDelta(forgedProducer).reason,
    'producer-task-id-mismatch'
  );
  const missingFrameLeaseEpoch = validDelta();
  delete missingFrameLeaseEpoch.payload.frameLeaseEpoch;
  assert.equal(
    validateCoherentSolidCommitDelta(missingFrameLeaseEpoch).reason,
    'invalid-frame-lease-epoch'
  );
});

test('StateManager admits exact level transition continuity and rejects stale or unsupported variants', () => {
  const transitionDelta = validDelta();
  Object.assign(transitionDelta.payload, {
    chartId: 7,
    levelId: 1,
    hierarchyGeneration: 2,
    chartTransition: createCoherentSolidChartTransition({
      sourceChartId: 0,
      sourceLevelId: 0,
      sourceHierarchyGeneration: 1,
      sourcePositionEpoch: 1,
      targetChartId: 7,
      targetLevelId: 1,
      targetHierarchyGeneration: 2,
      targetPositionEpoch: 2,
      geometryKey: 9,
      topologyGeneration: 2,
      proxyGenerationId: 1
    })
  });
  assert.equal(transitionDelta.payload.chartTransition.schema, ULG_COHERENT_SOLID_CHART_TRANSITION_SCHEMA);
  assert.equal(validateCoherentSolidCommitDelta(transitionDelta).accepted, true);

  const missing = structuredClone(transitionDelta);
  delete missing.payload.chartTransition;
  assert.equal(
    validateCoherentSolidCommitDelta(missing).reason,
    'missing-coherent-solid-chart-transition'
  );

  const stale = structuredClone(transitionDelta);
  stale.payload.chartTransition.sourcePositionEpoch = 0;
  assert.equal(
    validateCoherentSolidCommitDelta(stale).reason,
    'chart-transition-sourcePositionEpoch-mismatch'
  );

  const thirdLevel = structuredClone(transitionDelta);
  thirdLevel.payload.levelId = 2;
  thirdLevel.payload.chartTransition.targetLevelId = 2;
  assert.equal(
    validateCoherentSolidCommitDelta(thirdLevel).reason,
    'coherent-solid-third-ss-level-rejected'
  );

  const regressed = structuredClone(transitionDelta);
  regressed.payload.sourceHierarchyGeneration = 3;
  regressed.payload.chartTransition.sourceHierarchyGeneration = 3;
  assert.equal(
    validateCoherentSolidCommitDelta(regressed).reason,
    'coherent-solid-hierarchy-generation-regressed'
  );

  const invalidWorkgroup = structuredClone(transitionDelta);
  invalidWorkgroup.payload.executionShape.workgroupSize = 48;
  assert.equal(
    validateCoherentSolidCommitDelta(invalidWorkgroup).reason,
    'invalid-coherent-solid-workgroup-size'
  );

  const staleProxyGate = structuredClone(transitionDelta);
  staleProxyGate.payload.proxyCompactionGate.generationId = 1;
  assert.equal(
    validateCoherentSolidCommitDelta(staleProxyGate).reason,
    'proxy-compaction-generation-mismatch'
  );
});

test('authority ignores caller bootstrap assertions and requires its ComputeManager task evidence', async () => {
  const device = {};
  let submittedTask = null;
  const controller = createCoherentSolidAuthorityController({
    computeManager: {
      async submitTask(task) {
        submittedTask = task;
        return {
          bootstrapValidation: true,
          targetGenerationId: 2,
          computeTaskId: task.id,
          commitDelta: { payload: { initialState: true } },
          bootstrapEvidence: {
            schema: ULG_COHERENT_SOLID_INVARIANT_EVIDENCE_SCHEMA,
            device,
            byteLength: 128,
            generationId: 2,
            leaseId: 41,
            leaseEpoch: 0,
            producerTaskId: task.id,
            gpuGlobalInvariantFailCloseApplied: true
          },
          localRetainedRefs: {
            frameMutationCandidate: { gpuGlobalInvariantFailCloseApplied: true },
            destroy() {}
          }
        };
      }
    },
    stateManager: {
      setHotBuffer() {},
      getHotBuffer() { return null; },
      commitDelta() {}
    }
  });
  const frameSource = {
    schema: ULG_COHERENT_SOLID_FRAME_SCHEMA,
    device,
    buffer: { size: COHERENT_SOLID_FRAME_WORDS * 4 },
    bodyCount: 1,
    strideWords: COHERENT_SOLID_FRAME_WORDS,
    generationId: 1,
    leaseId: 41,
    leaseEpoch: 0
  };
  const memberSource = {
    schema: ULG_COHERENT_SOLID_MEMBER_SCHEMA,
    device,
    buffer: { size: COHERENT_SOLID_MEMBER_WORDS * 4 },
    memberCount: 1,
    strideWords: COHERENT_SOLID_MEMBER_WORDS,
    generationId: 1,
    leaseId: 41,
    leaseEpoch: 0
  };
  const membershipSource = {
    schema: ULG_COHERENT_SOLID_MEMBER_MEMBERSHIP_SCHEMA,
    device,
    leaseId: 41,
    leaseEpoch: 0
  };
  const localContactProxySource = {
    schema: ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA,
    device,
    leaseId: 41,
    leaseEpoch: 0
  };
  await assert.rejects(controller.admitInitialState({
    frameSource,
    memberSource,
    membershipSource,
    localContactProxySource,
    restMesh: {
      schema: ULG_COHERENT_SOLID_REST_MESH_SCHEMA,
      device,
      geometryKey: 9,
      topologyGeneration: 2
    },
    shapeCarrier: {
      schema: ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA,
      geometryKey: 9,
      topologyGeneration: 2
    },
    bootstrapEvidence: { gpuValidated: true }
  }), /did not produce exact same-device GPU evidence/);
  assert.equal(submittedTask.exportName, 'runCoherentSolidBootstrapComputeTask');
});

test('failed StateManager admission releases the pending coherent-solid cache owner exactly once', async () => {
  const device = {};
  let destroyCount = 0;
  const controller = createCoherentSolidAuthorityController({
    computeManager: {
      async submitTask(task) {
        const delta = validDelta();
        delta.taskId = task.id;
        delta.payload.producerTaskId = task.id;
        Object.assign(delta.payload, {
          stateKey: 'ulg:coherent-solid-state',
          laneId: 'ulg:coherent-solid:active',
          initialState: true,
          bootstrapTaskFamily: COHERENT_SOLID_BOOTSTRAP_TASK_FAMILY,
          bootstrapEvidence: {
            schema: ULG_COHERENT_SOLID_INVARIANT_EVIDENCE_SCHEMA,
            byteLength: 128,
            generationId: 2,
            frameLeaseId: 41,
            leaseEpoch: 0,
            producerTaskId: task.id,
            sameDeviceRetained: true,
            gpuGlobalInvariantFailCloseApplied: true
          }
        });
        const evidenceBuffer = {};
        const candidateBuffer = {};
        return {
          schema: ULG_COHERENT_SOLID_COMPUTE_TASK_RESULT_SCHEMA,
          status: 'coherent-solid-frame-candidate-gpu-complete-awaiting-state-manager-admission',
          bootstrapTaskFamily: COHERENT_SOLID_BOOTSTRAP_TASK_FAMILY,
          targetGenerationId: 2,
          computeTaskId: task.id,
          gpuFence: { fenceSatisfied: true },
          laneLeaseIdentity: {
            schema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
            authoritative: true,
            taskId: task.id,
            stateKey: 'ulg:coherent-solid-state',
            laneId: 'ulg:coherent-solid:active',
            sourceFamily: 'coherent-solid-frame'
          },
          commitDelta: delta,
          bootstrapEvidence: {
            schema: ULG_COHERENT_SOLID_INVARIANT_EVIDENCE_SCHEMA,
            device,
            buffer: evidenceBuffer,
            byteLength: 128,
            generationId: 2,
            leaseId: 41,
            leaseEpoch: 0,
            producerTaskId: task.id,
            gpuGlobalInvariantFailCloseApplied: true
          },
          localRetainedRefs: {
            invariantEvidence: { buffer: evidenceBuffer },
            frameMutationCandidate: {
              buffer: candidateBuffer,
              generationId: 2,
              gpuGlobalInvariantFailCloseApplied: true
            },
            gpuDrawRange: { frameSource: { buffer: candidateBuffer } },
            destroy() { destroyCount += 1; }
          }
        };
      }
    },
    stateManager: {
      setHotBuffer() {},
      getHotBuffer() { return null; },
      getWarmDeltas() { return {}; },
      commitDelta() {}
    }
  });
  const frameSource = {
    schema: ULG_COHERENT_SOLID_FRAME_SCHEMA,
    device,
    buffer: {},
    generationId: 1,
    leaseId: 41,
    leaseEpoch: 0
  };
  await assert.rejects(controller.admitInitialState({
    frameSource,
    memberSource: {
      schema: ULG_COHERENT_SOLID_MEMBER_SCHEMA,
      device,
      leaseId: 41,
      leaseEpoch: 0
    },
    membershipSource: {
      schema: ULG_COHERENT_SOLID_MEMBER_MEMBERSHIP_SCHEMA,
      device,
      leaseId: 41,
      leaseEpoch: 0
    },
    localContactProxySource: {
      schema: ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA,
      device,
      leaseId: 41,
      leaseEpoch: 0
    },
    restMesh: {
      schema: ULG_COHERENT_SOLID_REST_MESH_SCHEMA,
      device
    },
    shapeCarrier: { schema: ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA },
    thirdLevelHold: true
  }), /StateManager warm admission missing/);
  assert.equal(destroyCount, 1);
});

test('authority rejects matching-looking results not returned by its ComputeManager', async () => {
  const controller = createCoherentSolidAuthorityController({
    computeManager: { async submitTask() { throw new Error('not used'); } },
    stateManager: {
      setHotBuffer() {},
      getHotBuffer() { return null; },
      commitDelta() {}
    }
  });
  await assert.rejects(controller.admitTaskResult({
    schema: ULG_COHERENT_SOLID_COMPUTE_TASK_RESULT_SCHEMA,
    status: 'coherent-solid-frame-candidate-gpu-complete-awaiting-state-manager-admission',
    gpuFence: { fenceSatisfied: true },
    commitDelta: validDelta()
  }), /this controller's ComputeManager result identity/);
});

test('authority controller teardown is idempotent and rejects new admissions', async () => {
  const controller = createCoherentSolidAuthorityController({
    computeManager: { async submitTask() { throw new Error('not used'); } },
    stateManager: {
      setHotBuffer() {},
      getHotBuffer() { return null; },
      commitDelta() {}
    }
  });
  const first = controller.destroy({ reason: 'test-teardown' });
  assert.equal(first.status, 'coherent-solid-authority-controller-destroyed');
  const second = controller.destroy({ reason: 'test-teardown-repeat' });
  assert.equal(second.status, 'coherent-solid-authority-controller-already-destroyed');
  await assert.rejects(controller.admitTaskResult({}), /controller is destroyed/);
});
